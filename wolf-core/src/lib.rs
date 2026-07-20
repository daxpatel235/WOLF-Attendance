//! WOLF core — pure attendance-planner logic.
//!
//! Extracted from the Tauri backend so the exact same algorithm can run on the
//! desktop app, the cloud API and (via WASM) in the browser. No I/O, no Tauri,
//! no serde — data in, plan out, so it is trivially testable.
//!
//! # What this algorithm guarantees
//!
//! Given a semester range, a weekly timetable and what the student has logged,
//! it answers: **"what is the smallest set of days I must attend so that every
//! subject finishes at or above its required attendance percentage?"**
//!
//! Invariants it upholds in every situation (day 1 → a full year):
//!  1. `min_needed = ceil(total_periods * required_pct)` — never off-by-one.
//!  2. Sundays, holidays and cancelled classes never count toward totals.
//!  3. Explicit marks always beat inference.
//!  4. If the target is mathematically unreachable it is reported, never faked.
//!  5. Labs use their own threshold and are locked in first (weighted).
//!  6. Nothing panics, divides by zero, or overflows on degenerate input.
//!  7. Percentages are clamped to a sane 0–100 range.
//!  8. Subjects are identified by a stable key, so duplicate names cannot collide.
//!  9. A student adopting the app mid-semester can supply a real baseline
//!     instead of being assumed perfect.

use chrono::{Datelike, Duration, NaiveDate};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

pub const LAB_WEIGHT: i64 = 3;
pub const LECTURE_WEIGHT: i64 = 1;

pub const WEEKDAYS: [&str; 7] = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const DAYS: [&str; 6] = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

pub const MARK_ATTENDED: &str = "attended";
pub const MARK_SKIPPED: &str = "skipped";
pub const MARK_CANCELLED: &str = "cancelled";

// ───────────────────────────── date helpers ─────────────────────────────

pub fn parse_iso(iso: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(iso.trim(), "%Y-%m-%d").ok()
}
pub fn to_iso(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}
pub fn weekday_name(iso: &str) -> String {
    match parse_iso(iso) {
        Some(d) => WEEKDAYS[d.weekday().num_days_from_sunday() as usize].to_string(),
        None => String::new(),
    }
}
pub fn is_sunday(iso: &str) -> bool {
    matches!(parse_iso(iso), Some(d) if d.weekday().num_days_from_sunday() == 0)
}
/// Inclusive list of dates. Empty when unset/malformed or start > end.
pub fn list_dates(start: &str, end: &str) -> Vec<String> {
    let mut out = Vec::new();
    let (s, e) = match (parse_iso(start), parse_iso(end)) {
        (Some(s), Some(e)) => (s, e),
        _ => return out,
    };
    if s > e {
        return out;
    }
    let mut cur = s;
    while cur <= e {
        out.push(to_iso(cur));
        cur += Duration::days(1);
    }
    out
}
/// Zero-padded ISO dates compare lexicographically == chronologically.
pub fn compare_iso(a: &str, b: &str) -> Ordering {
    a.cmp(b)
}

// ───────────────────────────── input models ─────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct TtSession {
    pub day: String,
    pub start: String,
    pub end: String,
}

#[derive(Clone, Debug, Default)]
pub struct TtSubject {
    pub name: String,
    pub code: String,
    /// "lecture" | "lab"
    pub kind: String,
    pub color: String,
    /// weekday name -> number of periods that day
    pub schedule: HashMap<String, i64>,
    pub sessions: Vec<TtSession>,
}

#[derive(Clone, Debug, Default)]
pub struct Timetable {
    pub batch_name: String,
    pub subjects: Vec<TtSubject>,
}

/// Attendance that happened *before* the student started tracking with WOLF.
/// Lets someone adopt the app mid-semester without being assumed perfect.
#[derive(Clone, Copy, Debug, Default)]
pub struct Baseline {
    pub conducted: i64,
    pub attended: i64,
}

#[derive(Clone, Debug)]
pub struct Settings {
    pub semester_start: String,
    pub semester_end: String,
    pub min_percent: f64,
    pub target_percent: f64,
    pub lab_percent: f64,
    pub holidays: Vec<String>,
    /// "both" | "lectures" | "labs"
    pub attendance_mode: String,
    /// First date WOLF is responsible for. Empty => the whole semester.
    /// Days before this are shown but never inferred; `baselines` covers them.
    pub tracking_start: String,
    /// subject key -> attendance already accrued before `tracking_start`.
    pub baselines: HashMap<String, Baseline>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            semester_start: String::new(),
            semester_end: String::new(),
            min_percent: 75.0,
            target_percent: 85.0,
            lab_percent: 70.0,
            holidays: Vec::new(),
            attendance_mode: "both".into(),
            tracking_start: String::new(),
            baselines: HashMap::new(),
        }
    }
}

/// Everything the student has logged.
#[derive(Clone, Debug, Default)]
pub struct Attendance {
    /// date -> "attended" | "skipped" | "cancelled" (applies to the whole day)
    pub days: HashMap<String, String>,
    /// (date, subject key) -> mark. Overrides the day mark for that one subject,
    /// so "I went to DS but skipped Physics on Tuesday" is representable.
    pub subjects: HashMap<(String, String), String>,
}

impl Attendance {
    pub fn from_days(days: &HashMap<String, String>) -> Self {
        Self { days: days.clone(), subjects: HashMap::new() }
    }
    fn day_mark(&self, date: &str) -> Option<&str> {
        self.days.get(date).map(|s| s.as_str())
    }
    /// Per-subject mark wins; otherwise the whole-day mark applies.
    fn mark_for(&self, date: &str, key: &str) -> Option<&str> {
        self.subjects
            .get(&(date.to_string(), key.to_string()))
            .map(|s| s.as_str())
            .or_else(|| self.day_mark(date))
    }
}

// ───────────────────────────── output models ─────────────────────────────

#[derive(Clone, Debug, Default)]
pub struct DaySubject {
    /// Stable identity (see `subject_key`) — what the UI marks against.
    pub key: String,
    pub name: String,
    pub count: i64,
    pub color: String,
    pub kind: String,
    /// Effective mark for this subject on this day: the per-subject override if
    /// one exists, otherwise the whole-day mark. `None` = not logged yet.
    pub mark: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct DaySession {
    pub key: String,
    pub name: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    pub start: String,
    pub end: String,
    /// Effective mark, resolved exactly the way the planner resolves it.
    pub mark: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct Day {
    pub date: String,
    pub weekday: String,
    pub is_past: bool,
    pub is_today: bool,
    /// past-attended | past-skipped | pre-tracking | attend | skip-forced |
    /// required | buffer | skip | holiday | cancelled
    pub category: String,
    pub marked: Option<String>,
    pub subjects: Vec<DaySubject>,
    pub sessions: Vec<DaySession>,
    pub has_lab: bool,
    pub total_lectures: i64,
}

#[derive(Clone, Debug, Default)]
pub struct SubjectCard {
    /// Stable identity (see `subject_key`) — what baselines are keyed by.
    pub key: String,
    pub name: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    pub total_lectures: i64,
    pub min_needed: i64,
    pub target_needed: i64,
    pub req_percent: f64,
    pub attended_so_far: i64,
    pub conducted: i64,
    pub current_pct: f64,
    pub projected_min_pct: f64,
    pub can_still_skip_days: i64,
    pub status: String,
    pub impossible: bool,
}

#[derive(Clone, Debug, Default)]
pub struct Banner {
    pub attend_days_count: i64,
    pub stay_home_count: i64,
    pub buffer_days_count: i64,
    pub future_college_days_count: i64,
    pub lab_days_count: i64,
    pub today_action: String,
    pub min_percent: f64,
    pub target_percent: f64,
    pub lab_percent: f64,
}

#[derive(Clone, Debug, Default)]
pub struct Plan {
    pub ready: bool,
    pub message: String,
    pub banner: Option<Banner>,
    pub subjects: Vec<SubjectCard>,
    pub days: Vec<Day>,
    pub feasible: bool,
}

// ───────────────────────────── helpers ─────────────────────────────

#[derive(Clone)]
struct CollegeDay {
    date: String,
    weekday: String,
    /// (subject key, periods)
    lectures: Vec<(String, i64)>,
    total: i64,
}

fn ceil_pct(total: i64, pct: f64) -> i64 {
    if total <= 0 || pct <= 0.0 {
        return 0;
    }
    ((total as f64) * pct / 100.0).ceil() as i64
}
fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}
/// Percentages arriving from settings/UI/API can be anything. Make them sane.
fn clamp_pct(p: f64) -> f64 {
    if p.is_nan() {
        return 0.0;
    }
    p.clamp(0.0, 100.0)
}

/// Stable identity for a subject: its code if it has one, else its name.
/// Prevents two subjects sharing a display name from colliding.
pub fn subject_key(s: &TtSubject) -> String {
    let code = s.code.trim();
    if !code.is_empty() {
        code.to_uppercase()
    } else {
        s.name.trim().to_lowercase()
    }
}

/// Fold duplicate subjects (same key) into one logical subject.
fn merge_subjects(list: &[TtSubject]) -> Vec<TtSubject> {
    let mut order: Vec<String> = Vec::new();
    let mut by_key: HashMap<String, TtSubject> = HashMap::new();
    for s in list {
        let k = subject_key(s);
        match by_key.get_mut(&k) {
            None => {
                order.push(k.clone());
                by_key.insert(k, s.clone());
            }
            Some(existing) => {
                for (day, n) in &s.schedule {
                    *existing.schedule.entry(day.clone()).or_insert(0) += *n;
                }
                existing.sessions.extend(s.sessions.iter().cloned());
                // A subject that is a lab anywhere is treated as a lab.
                if s.kind == "lab" {
                    existing.kind = "lab".into();
                }
                if existing.color.is_empty() {
                    existing.color = s.color.clone();
                }
            }
        }
    }
    order.into_iter().filter_map(|k| by_key.remove(&k)).collect()
}

fn score_day(
    lectures: &[(String, i64)],
    need: &HashMap<String, i64>,
    weight_of: &HashMap<String, i64>,
) -> (i64, i64) {
    let mut score = 0;
    let mut covered = 0;
    for (k, c) in lectures {
        let nd = *need.get(k).unwrap_or(&0);
        if nd > 0 {
            score += weight_of.get(k).copied().unwrap_or(1) * nd.min(*c);
            covered += 1;
        }
    }
    (score, covered)
}

fn any_need(keys: &[String], need: &HashMap<String, i64>) -> bool {
    keys.iter().any(|k| *need.get(k).unwrap_or(&0) > 0)
}

// ───────────────────────────── algorithm ─────────────────────────────

/// Back-compatible entry point: whole-day marks only.
pub fn compute_plan(
    settings: &Settings,
    timetable: &Option<Timetable>,
    marks: &HashMap<String, String>,
    today: &str,
) -> Plan {
    compute_plan_with(settings, timetable, &Attendance::from_days(marks), today)
}

pub fn compute_plan_with(
    settings: &Settings,
    timetable: &Option<Timetable>,
    att: &Attendance,
    today: &str,
) -> Plan {
    let mut result = Plan {
        ready: false,
        message: String::new(),
        banner: None,
        subjects: Vec::new(),
        days: Vec::new(),
        feasible: true,
    };

    if settings.semester_start.is_empty() || settings.semester_end.is_empty() {
        result.message = "Semester start and end dates are not set yet.".into();
        return result;
    }
    let tt = match timetable {
        Some(t) if !t.subjects.is_empty() => t,
        _ => {
            result.message = "No timetable has been imported yet.".into();
            return result;
        }
    };

    // Invariant 7: sanitise percentages before anything depends on them.
    let min_percent = clamp_pct(settings.min_percent);
    let target_percent = clamp_pct(settings.target_percent);
    let lab_percent = clamp_pct(settings.lab_percent);
    let holiday_set: HashSet<&String> = settings.holidays.iter().collect();

    let mode = settings.attendance_mode.as_str();
    // Invariant 8: merge duplicates, then key everything by a stable id.
    let subjects: Vec<TtSubject> = merge_subjects(&tt.subjects)
        .into_iter()
        .filter(|s| {
            let is_lab = s.kind == "lab";
            match mode {
                "lectures" => !is_lab,
                "labs" => is_lab,
                _ => true,
            }
        })
        .collect();
    if subjects.is_empty() {
        result.message = match mode {
            "lectures" => "Your timetable has no lecture subjects for the current attendance mode.".into(),
            "labs" => "Your timetable has no lab subjects for the current attendance mode.".into(),
            _ => "No timetable has been imported yet.".into(),
        };
        return result;
    }

    let keys: Vec<String> = subjects.iter().map(subject_key).collect();
    let mut name_of: HashMap<String, String> = HashMap::new();
    let mut kind_of: HashMap<String, String> = HashMap::new();
    let mut color_of: HashMap<String, String> = HashMap::new();
    let mut code_of: HashMap<String, String> = HashMap::new();
    let mut weight_of: HashMap<String, i64> = HashMap::new();
    for s in &subjects {
        let k = subject_key(s);
        let kind = if s.kind.is_empty() { "lecture".to_string() } else { s.kind.clone() };
        weight_of.insert(k.clone(), if kind == "lab" { LAB_WEIGHT } else { LECTURE_WEIGHT });
        kind_of.insert(k.clone(), kind);
        color_of.insert(
            k.clone(),
            if s.color.is_empty() { "#6B6560".to_string() } else { s.color.clone() },
        );
        code_of.insert(k.clone(), s.code.clone());
        name_of.insert(k.clone(), s.name.clone());
    }

    let mut sessions_by_wd: HashMap<String, Vec<DaySession>> = HashMap::new();
    for d in DAYS {
        sessions_by_wd.insert(d.to_string(), Vec::new());
    }
    for s in &subjects {
        let k = subject_key(s);
        for sess in &s.sessions {
            if let Some(list) = sessions_by_wd.get_mut(&sess.day) {
                list.push(DaySession {
                    key: k.clone(),
                    name: s.name.clone(),
                    code: s.code.clone(),
                    kind: kind_of[&k].clone(),
                    color: color_of[&k].clone(),
                    start: sess.start.clone(),
                    end: sess.end.clone(),
                    mark: None, // resolved per-date below
                });
            }
        }
    }
    for d in DAYS {
        sessions_by_wd.get_mut(d).unwrap().sort_by(|a, b| a.start.cmp(&b.start));
    }

    // Tracking window. Empty => WOLF owns the whole semester (legacy behaviour).
    let tracking_start = settings.tracking_start.trim().to_string();
    let in_tracking = |date: &str| -> bool {
        tracking_start.is_empty() || compare_iso(date, &tracking_start) != Ordering::Less
    };

    // 1. College days (Sundays, holidays and fully-cancelled days are not classes)
    let all_dates = list_dates(&settings.semester_start, &settings.semester_end);
    let mut college_days: Vec<CollegeDay> = Vec::new();
    let mut holiday_days: Vec<String> = Vec::new();
    let mut cancelled_days: Vec<String> = Vec::new();
    for date in &all_dates {
        if is_sunday(date) {
            continue;
        }
        if holiday_set.contains(date) {
            holiday_days.push(date.clone());
            continue;
        }
        if att.day_mark(date) == Some(MARK_CANCELLED) {
            cancelled_days.push(date.clone());
            continue;
        }
        let wd = weekday_name(date);
        let mut lectures: Vec<(String, i64)> = Vec::new();
        let mut total = 0;
        for subj in &subjects {
            let k = subject_key(subj);
            let n = subj.schedule.get(&wd).copied().unwrap_or(0);
            // Invariant 2: a class cancelled for this subject did not happen.
            if n > 0 && att.mark_for(date, &k) != Some(MARK_CANCELLED) {
                lectures.push((k, n));
                total += n;
            }
        }
        college_days.push(CollegeDay { date: date.clone(), weekday: wd, lectures, total });
    }

    // 2. Totals + thresholds. Only tracked days count; the baseline covers the rest.
    let base_of = |k: &str| -> Baseline { settings.baselines.get(k).copied().unwrap_or_default() };
    let mut total_lectures: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    for day in &college_days {
        if !in_tracking(&day.date) {
            continue;
        }
        for (k, c) in &day.lectures {
            *total_lectures.get_mut(k).unwrap() += c;
        }
    }
    for k in &keys {
        *total_lectures.get_mut(k).unwrap() += base_of(k).conducted;
    }

    let mut min_needed: HashMap<String, i64> = HashMap::new();
    let mut target_needed: HashMap<String, i64> = HashMap::new();
    for k in &keys {
        let t = total_lectures[k];
        let is_lab = kind_of[k] == "lab";
        let req = if is_lab { lab_percent } else { min_percent };
        // A "target" below the hard minimum is incoherent — never aim lower.
        let tgt = target_percent.max(req);
        min_needed.insert(k.clone(), ceil_pct(t, req));
        target_needed.insert(k.clone(), ceil_pct(t, tgt));
    }

    // 3. What is already banked, and which future days are still choosable.
    //    Per-subject marks beat day marks; unmarked past days are assumed
    //    attended *only inside the tracking window*.
    let mut candidates: Vec<CollegeDay> = Vec::new();
    let mut attended: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    for k in &keys {
        *attended.get_mut(k).unwrap() += base_of(k).attended;
    }
    for day in &college_days {
        if !in_tracking(&day.date) {
            continue; // covered by the baseline
        }
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        let day_mark = att.day_mark(&day.date);

        // Bank whatever is already settled for this day, subject by subject.
        for (k, c) in &day.lectures {
            let m = att.mark_for(&day.date, k);
            let banked = match m {
                Some(MARK_ATTENDED) => true,
                Some(MARK_SKIPPED) => false,
                _ => is_past, // unmarked past day => assumed attended
            };
            if banked {
                *attended.get_mut(k).unwrap() += c;
            }
        }

        // A future day is choosable unless the student already decided about it.
        if !is_past && day_mark != Some(MARK_ATTENDED) && day_mark != Some(MARK_SKIPPED) {
            let open: Vec<(String, i64)> = day
                .lectures
                .iter()
                .filter(|(k, _)| {
                    let m = att.mark_for(&day.date, k);
                    m != Some(MARK_ATTENDED) && m != Some(MARK_SKIPPED)
                })
                .cloned()
                .collect();
            if !open.is_empty() {
                let total = open.iter().map(|(_, c)| *c).sum();
                candidates.push(CollegeDay {
                    date: day.date.clone(),
                    weekday: day.weekday.clone(),
                    lectures: open,
                    total,
                });
            }
        }
    }

    // 4. Greedy minimum set (labs weighted so their days are locked in first)
    let mut remaining: HashMap<String, i64> = HashMap::new();
    for k in &keys {
        remaining.insert(k.clone(), (min_needed[k] - attended[k]).max(0));
    }
    let mut required_set: HashSet<String> = HashSet::new();
    while any_need(&keys, &remaining) {
        let mut best: Option<usize> = None;
        let mut best_score = -1;
        let mut best_cov = -1;
        for (i, day) in candidates.iter().enumerate() {
            if required_set.contains(&day.date) {
                continue;
            }
            let (score, covered) = score_day(&day.lectures, &remaining, &weight_of);
            if score <= 0 {
                continue;
            }
            let replace = score > best_score
                || (score == best_score && covered > best_cov)
                || (score == best_score
                    && covered == best_cov
                    && best.map_or(false, |b| {
                        compare_iso(&day.date, &candidates[b].date) == Ordering::Less
                    }));
            if replace {
                best = Some(i);
                best_score = score;
                best_cov = covered;
            }
        }
        let bi = match best {
            Some(i) => i,
            None => break, // nothing left that helps — the rest is impossible
        };
        required_set.insert(candidates[bi].date.clone());
        for (k, c) in candidates[bi].lectures.clone() {
            if remaining[&k] > 0 {
                let v = (remaining[&k] - c).max(0);
                remaining.insert(k, v);
            }
        }
    }

    // Invariant 4: report unreachable targets honestly.
    let mut impossible: HashSet<String> = HashSet::new();
    for k in &keys {
        if remaining[k] > 0 {
            impossible.insert(k.clone());
            result.feasible = false;
        }
    }

    // 5. Buffer toward the target percentage.
    //    NOTE: add only the *open* lectures of each required day. Using the full
    //    college-day list would double-count any subject already banked via a
    //    per-subject "attended" override, pushing projections past 100%.
    let candidate_by_date: HashMap<String, usize> = candidates
        .iter()
        .enumerate()
        .map(|(i, d)| (d.date.clone(), i))
        .collect();
    let mut secured = attended.clone();
    for date in &required_set {
        if let Some(&idx) = candidate_by_date.get(date) {
            for (k, c) in &candidates[idx].lectures {
                if let Some(v) = secured.get_mut(k) {
                    *v += c;
                }
            }
        }
    }
    let mut buffer_need: HashMap<String, i64> = HashMap::new();
    for k in &keys {
        buffer_need.insert(k.clone(), (target_needed[k] - secured[k]).max(0));
    }
    let mut buffer_set: HashSet<String> = HashSet::new();
    while any_need(&keys, &buffer_need) {
        let mut best: Option<usize> = None;
        let mut best_score = -1;
        for (i, day) in candidates.iter().enumerate() {
            if required_set.contains(&day.date) || buffer_set.contains(&day.date) {
                continue;
            }
            let (score, _) = score_day(&day.lectures, &buffer_need, &weight_of);
            if score <= 0 {
                continue;
            }
            let replace = score > best_score
                || (score == best_score
                    && best.map_or(false, |b| {
                        compare_iso(&day.date, &candidates[b].date) == Ordering::Less
                    }));
            if replace {
                best = Some(i);
                best_score = score;
            }
        }
        let bi = match best {
            Some(i) => i,
            None => break,
        };
        buffer_set.insert(candidates[bi].date.clone());
        for (k, c) in candidates[bi].lectures.clone() {
            if buffer_need[&k] > 0 {
                let v = (buffer_need[&k] - c).max(0);
                buffer_need.insert(k, v);
            }
        }
    }

    // 6. Classify every day
    let mut days: Vec<Day> = Vec::new();
    for day in &college_days {
        let status = att.day_mark(&day.date);
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        let is_today = compare_iso(&day.date, today) == Ordering::Equal;
        let category = if !in_tracking(&day.date) {
            "pre-tracking"
        } else if is_past {
            if status == Some(MARK_SKIPPED) { "past-skipped" } else { "past-attended" }
        } else if status == Some(MARK_ATTENDED) {
            "attend"
        } else if status == Some(MARK_SKIPPED) {
            "skip-forced"
        } else if required_set.contains(&day.date) {
            "required"
        } else if buffer_set.contains(&day.date) {
            "buffer"
        } else {
            "skip"
        };
        let subj_entries: Vec<DaySubject> = day
            .lectures
            .iter()
            .map(|(k, c)| DaySubject {
                key: k.clone(),
                name: name_of.get(k).cloned().unwrap_or_else(|| k.clone()),
                count: *c,
                color: color_of.get(k).cloned().unwrap_or_else(|| "#6B6560".into()),
                kind: kind_of.get(k).cloned().unwrap_or_else(|| "lecture".into()),
                mark: att.mark_for(&day.date, k).map(|s| s.to_string()),
            })
            .collect();
        let has_lab = subj_entries.iter().any(|e| e.kind == "lab");
        // Sessions are cached per weekday, so stamp the per-date mark on a clone.
        let mut day_sessions = sessions_by_wd.get(&day.weekday).cloned().unwrap_or_default();
        for s in &mut day_sessions {
            s.mark = att.mark_for(&day.date, &s.key).map(|m| m.to_string());
        }
        days.push(Day {
            date: day.date.clone(),
            weekday: day.weekday.clone(),
            is_past,
            is_today,
            category: category.to_string(),
            marked: status.map(|s| s.to_string()),
            subjects: subj_entries,
            sessions: day_sessions,
            has_lab,
            total_lectures: day.total,
        });
    }
    let mut push_plain = |date: &String, category: &str| {
        days.push(Day {
            date: date.clone(),
            weekday: weekday_name(date),
            is_past: compare_iso(date, today) == Ordering::Less,
            is_today: compare_iso(date, today) == Ordering::Equal,
            category: category.to_string(),
            marked: None,
            subjects: Vec::new(),
            sessions: Vec::new(),
            has_lab: false,
            total_lectures: 0,
        });
    };
    for date in &holiday_days {
        push_plain(date, "holiday");
    }
    for date in &cancelled_days {
        push_plain(date, "cancelled");
    }
    days.sort_by(|a, b| a.date.cmp(&b.date));

    // 7. Subject cards
    let mut conducted: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    let mut attended_so_far: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    let mut future_remaining: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    for k in &keys {
        let b = base_of(k);
        *conducted.get_mut(k).unwrap() += b.conducted;
        *attended_so_far.get_mut(k).unwrap() += b.attended;
    }
    for day in &college_days {
        if !in_tracking(&day.date) {
            continue;
        }
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        for (k, c) in &day.lectures {
            let m = att.mark_for(&day.date, k);
            if is_past {
                *conducted.get_mut(k).unwrap() += c;
                if m != Some(MARK_SKIPPED) {
                    *attended_so_far.get_mut(k).unwrap() += c;
                }
            } else if m != Some(MARK_ATTENDED) && m != Some(MARK_SKIPPED) {
                *future_remaining.get_mut(k).unwrap() += c;
            }
        }
    }
    let mut skippable: HashMap<String, i64> = keys.iter().map(|k| (k.clone(), 0)).collect();
    for day in &days {
        if day.category == "skip" {
            for s in &day.subjects {
                // day.subjects carries display names; map back via name -> key
                for k in &keys {
                    if name_of.get(k).map(|n| n == &s.name).unwrap_or(false) {
                        *skippable.get_mut(k).unwrap() += 1;
                    }
                }
            }
        }
    }

    let mut subject_cards: Vec<SubjectCard> = subjects
        .iter()
        .map(|subj| {
            let k = subject_key(subj);
            let total = total_lectures[&k];
            let cond = conducted[&k];
            let att_far = attended_so_far[&k];
            let current_pct = if cond > 0 { (att_far as f64 / cond as f64) * 100.0 } else { 100.0 };
            let max_reachable = attended[&k] + future_remaining[&k];
            let proj_min_pct = if total > 0 { (secured[&k] as f64 / total as f64) * 100.0 } else { 100.0 };
            let is_lab = kind_of[&k] == "lab";
            let req_pct = if is_lab { lab_percent } else { min_percent };
            let status = if max_reachable < min_needed[&k] {
                "danger"
            } else if cond > 0 && current_pct < req_pct {
                "warning"
            } else if max_reachable < target_needed[&k] {
                "warning"
            } else {
                "safe"
            };
            SubjectCard {
                key: k.clone(),
                name: subj.name.clone(),
                code: code_of.get(&k).cloned().unwrap_or_default(),
                kind: kind_of.get(&k).cloned().unwrap_or_else(|| "lecture".into()),
                color: if subj.color.is_empty() { "#6B6560".into() } else { subj.color.clone() },
                total_lectures: total,
                min_needed: min_needed[&k],
                target_needed: target_needed[&k],
                req_percent: req_pct,
                attended_so_far: att_far,
                conducted: cond,
                current_pct: round1(current_pct),
                projected_min_pct: round1(proj_min_pct),
                can_still_skip_days: skippable[&k],
                status: status.to_string(),
                impossible: impossible.contains(&k),
            }
        })
        .collect();
    subject_cards.sort_by(|a, b| {
        let ka = if a.kind == "lab" { 0 } else { 1 };
        let kb = if b.kind == "lab" { 0 } else { 1 };
        ka.cmp(&kb).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    // 8. Banner
    let future_college = days
        .iter()
        .filter(|d| !d.is_past && d.category != "holiday" && d.category != "cancelled")
        .count() as i64;
    let stay_home = days
        .iter()
        .filter(|d| !d.is_past && (d.category == "skip" || d.category == "skip-forced"))
        .count() as i64;
    let lab_days = days
        .iter()
        .filter(|d| !d.is_past && (d.category == "required" || d.category == "attend") && d.has_lab)
        .count() as i64;

    let today_action = if let Some(td) = days.iter().find(|d| d.is_today) {
        match td.category.as_str() {
            "holiday" => "holiday",
            "cancelled" => "cancelled",
            "required" | "attend" => "go",
            "buffer" => "recommended",
            _ => "stay-home",
        }
    } else if !today.is_empty() && is_sunday(today) {
        "sunday"
    } else {
        "no-college"
    };

    result.ready = true;
    result.banner = Some(Banner {
        attend_days_count: required_set.len() as i64,
        stay_home_count: stay_home,
        buffer_days_count: buffer_set.len() as i64,
        future_college_days_count: future_college,
        lab_days_count: lab_days,
        today_action: today_action.to_string(),
        min_percent,
        target_percent,
        lab_percent,
    });
    result.subjects = subject_cards;
    result.days = days;
    result
}

// ───────────────────────────── tests ─────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // 2026-01-05 is a Monday. Anchor for all fixtures.
    const MON: &str = "2026-01-05";

    fn subj(name: &str, kind: &str, sched: &[(&str, i64)]) -> TtSubject {
        let mut schedule = HashMap::new();
        let mut sessions = Vec::new();
        for (d, n) in sched {
            schedule.insert(d.to_string(), *n);
            sessions.push(TtSession { day: d.to_string(), start: "09:00".into(), end: "10:00".into() });
        }
        TtSubject {
            name: name.into(),
            code: String::new(),
            kind: kind.into(),
            color: "#4A7C59".into(),
            schedule,
            sessions,
        }
    }
    fn coded(mut s: TtSubject, code: &str) -> TtSubject {
        s.code = code.into();
        s
    }
    fn tt(subjects: Vec<TtSubject>) -> Option<Timetable> {
        Some(Timetable { batch_name: "B1".into(), subjects })
    }
    fn settings(start: &str, end: &str, min: f64, lab: f64, target: f64) -> Settings {
        Settings {
            semester_start: start.into(),
            semester_end: end.into(),
            min_percent: min,
            lab_percent: lab,
            target_percent: target,
            ..Default::default()
        }
    }
    fn marks(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs.iter().map(|(d, s)| (d.to_string(), s.to_string())).collect()
    }
    fn card<'a>(p: &'a Plan, name: &str) -> &'a SubjectCard {
        p.subjects.iter().find(|c| c.name == name).expect("subject card")
    }
    fn cat(p: &Plan, date: &str) -> String {
        p.days.iter().find(|d| d.date == date).map(|d| d.category.clone()).unwrap_or_default()
    }

    // ── 1. fresh semester ────────────────────────────────────────────────
    #[test]
    fn fresh_semester_requires_ceil_of_min_percent() {
        let s = settings(MON, "2026-01-09", 75.0, 70.0, 75.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert!(p.ready && p.feasible);
        let c = card(&p, "DS");
        assert_eq!(c.total_lectures, 3);
        assert_eq!(c.min_needed, 3, "ceil(3 * 75%) == 3");
        assert_eq!(c.conducted, 0);
        assert_eq!(c.current_pct, 100.0);
        assert_eq!(p.banner.unwrap().attend_days_count, 3);
    }

    #[test]
    fn half_percent_needs_fewer_days_and_picks_earliest() {
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert_eq!(card(&p, "DS").min_needed, 2);
        assert_eq!(p.banner.as_ref().unwrap().attend_days_count, 2);
        assert_eq!(cat(&p, "2026-01-05"), "required");
        assert_eq!(cat(&p, "2026-01-07"), "required");
        assert_eq!(cat(&p, "2026-01-09"), "skip");
    }

    // ── 2. smallest semester ─────────────────────────────────────────────
    #[test]
    fn single_day_semester() {
        let s = settings(MON, MON, 75.0, 70.0, 75.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert_eq!(card(&p, "DS").min_needed, 1);
        assert_eq!(cat(&p, MON), "required");
    }

    // ── 3. a full year ───────────────────────────────────────────────────
    #[test]
    fn full_year_is_consistent_and_fast() {
        let s = settings("2026-01-05", "2027-01-04", 75.0, 70.0, 85.0);
        let t = tt(vec![
            subj("DS", "lecture", &[("Monday", 2), ("Wednesday", 2), ("Friday", 1)]),
            subj("Phy Lab", "lab", &[("Thursday", 2)]),
        ]);
        let p = compute_plan(&s, &t, &HashMap::new(), "2026-01-05");
        assert!(p.ready && p.feasible);
        let ds = card(&p, "DS");
        assert!(ds.total_lectures > 200);
        assert_eq!(ds.min_needed, ceil_pct(ds.total_lectures, 75.0));
        assert!(p.days.iter().all(|d| !is_sunday(&d.date)));
    }

    // ── 4. holidays / Sundays ────────────────────────────────────────────
    #[test]
    fn holidays_and_sundays_excluded_from_totals() {
        let mut s = settings(MON, "2026-01-09", 75.0, 70.0, 75.0);
        s.holidays = vec!["2026-01-07".into()];
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert_eq!(card(&p, "DS").total_lectures, 2);
        assert_eq!(cat(&p, "2026-01-07"), "holiday");
    }

    // ── 5. impossible detection ──────────────────────────────────────────
    #[test]
    fn detects_impossible_when_too_many_missed() {
        let s = settings(MON, "2026-01-09", 100.0, 100.0, 100.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let m = marks(&[("2026-01-05", "skipped")]);
        let p = compute_plan(&s, &t, &m, "2026-01-06");
        let c = card(&p, "DS");
        assert!(c.impossible);
        assert!(!p.feasible);
        assert_eq!(c.status, "danger");
    }

    // ── 6. explicit marks win ────────────────────────────────────────────
    #[test]
    fn future_marks_are_respected() {
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let m = marks(&[("2026-01-07", "skipped"), ("2026-01-09", "attended")]);
        let p = compute_plan(&s, &t, &m, MON);
        assert_eq!(cat(&p, "2026-01-07"), "skip-forced");
        assert_eq!(cat(&p, "2026-01-09"), "attend");
    }

    // ── 7. labs ──────────────────────────────────────────────────────────
    #[test]
    fn labs_use_lab_percent_not_min_percent() {
        let s = settings(MON, "2026-01-09", 50.0, 100.0, 50.0);
        let t = tt(vec![
            subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)]),
            subj("Lab", "lab", &[("Tuesday", 1), ("Thursday", 1)]),
        ]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        let lab = card(&p, "Lab");
        assert_eq!(lab.req_percent, 100.0);
        assert_eq!(lab.min_needed, 2);
        assert_eq!(cat(&p, "2026-01-06"), "required");
        assert_eq!(cat(&p, "2026-01-08"), "required");
    }

    // ── 8. attendance mode ───────────────────────────────────────────────
    #[test]
    fn attendance_mode_lectures_ignores_labs() {
        let mut s = settings(MON, "2026-01-09", 75.0, 70.0, 75.0);
        s.attendance_mode = "lectures".into();
        let t = tt(vec![
            subj("DS", "lecture", &[("Monday", 1)]),
            subj("Lab", "lab", &[("Tuesday", 1)]),
        ]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert!(p.subjects.iter().all(|c| c.kind != "lab"));
        assert_eq!(p.subjects.len(), 1);
    }

    // ── 9. skip accounting ───────────────────────────────────────────────
    #[test]
    fn skippable_days_match_free_days() {
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        let free = p.days.iter()
            .filter(|d| d.category == "skip" && d.subjects.iter().any(|x| x.name == "DS"))
            .count() as i64;
        assert_eq!(card(&p, "DS").can_still_skip_days, free);
    }

    // ── 10. degenerate input never panics ────────────────────────────────
    #[test]
    fn degenerate_inputs_are_safe() {
        let s = settings("2026-02-01", "2026-01-01", 75.0, 70.0, 85.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert!(p.ready);
        assert_eq!(card(&p, "DS").total_lectures, 0);

        let s2 = settings(MON, "2026-01-09", 75.0, 70.0, 85.0);
        assert!(!compute_plan(&s2, &None, &HashMap::new(), MON).ready);

        let s3 = settings("", "", 75.0, 70.0, 85.0);
        assert!(!compute_plan(&s3, &t, &HashMap::new(), MON).ready);

        let s4 = settings(MON, "2026-01-09", 75.0, 70.0, 85.0);
        let t4 = tt(vec![subj("Ghost", "lecture", &[("Sunday", 3)])]);
        let p4 = compute_plan(&s4, &t4, &HashMap::new(), MON);
        assert_eq!(card(&p4, "Ghost").total_lectures, 0);
        assert_eq!(card(&p4, "Ghost").status, "safe");
    }

    // ── 11. FIX: percentages are clamped ─────────────────────────────────
    #[test]
    fn insane_percentages_are_clamped() {
        // 150% would demand more classes than exist => permanently impossible.
        let s = settings(MON, "2026-01-09", 150.0, -20.0, 999.0);
        let t = tt(vec![
            subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)]),
            subj("Lab", "lab", &[("Tuesday", 2)]),
        ]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        let ds = card(&p, "DS");
        assert_eq!(ds.req_percent, 100.0, "150% clamps to 100%");
        assert_eq!(ds.min_needed, 3, "never more than the total that exists");
        assert!(ds.min_needed <= ds.total_lectures, "INVARIANT: need <= total");
        let lab = card(&p, "Lab");
        assert_eq!(lab.req_percent, 0.0, "negative clamps to 0%");
        assert_eq!(lab.min_needed, 0);
        assert!(p.feasible, "clamped input must remain solvable");
    }

    // ── 12. FIX: duplicate subject names no longer collide ───────────────
    #[test]
    fn duplicate_names_are_merged_not_collided() {
        // Two different subjects that happen to share a display name, plus the
        // same subject listed twice under one code.
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![
            coded(subj("Lab", "lab", &[("Tuesday", 1)]), "PHY-L"),
            coded(subj("Lab", "lab", &[("Thursday", 1)]), "CHM-L"),
        ]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        assert_eq!(p.subjects.len(), 2, "distinct codes stay distinct");

        // Same code twice => one merged subject with both days.
        let t2 = tt(vec![
            coded(subj("DS", "lecture", &[("Monday", 1)]), "CS201"),
            coded(subj("DS", "lecture", &[("Wednesday", 1)]), "CS201"),
        ]);
        let p2 = compute_plan(&s, &t2, &HashMap::new(), MON);
        assert_eq!(p2.subjects.len(), 1, "same code merges");
        assert_eq!(card(&p2, "DS").total_lectures, 2, "both days counted once");
    }

    // ── 13. FIX: cancelled classes leave the denominator ─────────────────
    #[test]
    fn cancelled_day_is_not_conducted() {
        let s = settings(MON, "2026-01-09", 75.0, 70.0, 75.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let m = marks(&[("2026-01-07", "cancelled")]);
        let p = compute_plan(&s, &t, &m, "2026-01-09");
        let c = card(&p, "DS");
        assert_eq!(c.total_lectures, 2, "the cancelled Wednesday never happened");
        assert_eq!(c.conducted, 1, "only Monday actually took place before Friday");
        assert_eq!(cat(&p, "2026-01-07"), "cancelled");
    }

    #[test]
    fn cancelling_one_subject_does_not_cancel_the_day() {
        let s = settings(MON, "2026-01-09", 75.0, 70.0, 75.0);
        let t = tt(vec![
            coded(subj("DS", "lecture", &[("Monday", 1)]), "CS201"),
            coded(subj("Phy", "lecture", &[("Monday", 1)]), "PH101"),
        ]);
        let mut a = Attendance::default();
        a.subjects.insert((MON.to_string(), "CS201".into()), MARK_CANCELLED.into());
        let p = compute_plan_with(&s, &t, &a, "2026-01-06");
        assert_eq!(card(&p, "DS").total_lectures, 0, "DS was cancelled");
        assert_eq!(card(&p, "Phy").total_lectures, 1, "Phy still happened");
    }

    // ── 14. FIX: per-subject (partial day) marking ───────────────────────
    #[test]
    fn partial_day_attendance_is_representable() {
        // Monday has DS and Phy. Student attended DS, skipped Phy.
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![
            coded(subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1)]), "CS201"),
            coded(subj("Phy", "lecture", &[("Monday", 1), ("Wednesday", 1)]), "PH101"),
        ]);
        let mut a = Attendance::default();
        a.subjects.insert((MON.to_string(), "PH101".into()), MARK_SKIPPED.into());
        let p = compute_plan_with(&s, &t, &a, "2026-01-06"); // Monday is past

        assert_eq!(card(&p, "DS").attended_so_far, 1, "DS attended");
        assert_eq!(card(&p, "Phy").attended_so_far, 0, "Phy skipped");
        assert_eq!(card(&p, "Phy").conducted, 1, "but it was still conducted");
        assert_eq!(card(&p, "Phy").current_pct, 0.0);
    }

    // ── 14b. The UI contract: every day carries the key + effective mark ──
    #[test]
    fn days_expose_subject_keys_and_effective_marks() {
        let s = settings(MON, "2026-01-09", 50.0, 50.0, 50.0);
        let t = tt(vec![
            coded(subj("DS", "lecture", &[("Monday", 1)]), "CS201"),
            coded(subj("Phy", "lecture", &[("Monday", 1)]), "PH101"),
        ]);
        let mut a = Attendance::default();
        // Whole day attended, except Physics which was individually skipped.
        a.days.insert(MON.to_string(), MARK_ATTENDED.into());
        a.subjects.insert((MON.to_string(), "PH101".into()), MARK_SKIPPED.into());
        let p = compute_plan_with(&s, &t, &a, "2026-01-06");
        let day = p.days.iter().find(|d| d.date == MON).expect("monday");

        let ds = day.subjects.iter().find(|x| x.key == "CS201").expect("DS entry");
        let phy = day.subjects.iter().find(|x| x.key == "PH101").expect("Phy entry");
        assert_eq!(ds.mark.as_deref(), Some(MARK_ATTENDED), "inherits the day mark");
        assert_eq!(phy.mark.as_deref(), Some(MARK_SKIPPED), "override wins");

        // Sessions are cached per weekday — prove the per-date stamp is not shared.
        for sess in &day.sessions {
            let expected =
                if sess.key == "PH101" { MARK_SKIPPED } else { MARK_ATTENDED };
            assert_eq!(sess.mark.as_deref(), Some(expected), "session {}", sess.key);
        }
    }

    // ── 15. FIX: mid-semester adoption with a real baseline ──────────────
    #[test]
    fn baseline_replaces_the_assume_perfect_guess() {
        // Semester runs Jan 5 – Feb 27. Student adopts WOLF on Jan 19 and
        // truthfully reports 12 of 18 attended so far.
        let mut s = settings("2026-01-05", "2026-02-27", 75.0, 70.0, 85.0);
        s.tracking_start = "2026-01-19".into();
        s.baselines.insert("CS201".into(), Baseline { conducted: 18, attended: 12 });
        let t = tt(vec![coded(
            subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)]),
            "CS201",
        )]);
        let p = compute_plan(&s, &t, &HashMap::new(), "2026-01-19");
        let c = card(&p, "DS");

        assert_eq!(c.conducted, 18, "the truth, not an assumption");
        assert_eq!(c.attended_so_far, 12);
        assert_eq!(c.current_pct, 66.7, "12/18 — honestly below the 75% minimum");
        assert_eq!(c.status, "warning", "flagged, not silently 'safe'");
        // Days before tracking started are shown but never inferred.
        assert_eq!(cat(&p, "2026-01-07"), "pre-tracking");
    }

    #[test]
    fn without_baseline_behaviour_is_unchanged() {
        // Legacy path must still work exactly as before.
        let s = settings("2026-01-05", "2026-02-27", 75.0, 70.0, 85.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), "2026-01-19");
        let c = card(&p, "DS");
        assert!(c.conducted > 0);
        assert_eq!(c.current_pct, 100.0, "unmarked past still assumed attended");
    }

    // ── 16. INVARIANT sweep across a wide parameter space ────────────────
    #[test]
    fn invariants_hold_across_many_configurations() {
        let subject_sets: Vec<Vec<TtSubject>> = vec![
            vec![coded(subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 2)]), "A")],
            vec![
                coded(subj("DS", "lecture", &[("Monday", 2), ("Friday", 1)]), "A"),
                coded(subj("Lab", "lab", &[("Thursday", 2)]), "B"),
            ],
            vec![
                coded(subj("A1", "lecture", &[("Monday", 1), ("Tuesday", 1), ("Wednesday", 1), ("Thursday", 1), ("Friday", 1), ("Saturday", 1)]), "A"),
                coded(subj("B1", "lab", &[("Tuesday", 3)]), "B"),
                coded(subj("C1", "lecture", &[("Saturday", 2)]), "C"),
            ],
        ];
        let ends = ["2026-01-09", "2026-03-31", "2026-12-31"];
        let pcts = [0.0, 33.3, 50.0, 75.0, 90.0, 100.0];

        for subs in &subject_sets {
            for end in ends {
                for min in pcts {
                    for lab in pcts {
                        let s = settings(MON, end, min, lab, 85.0);
                        let t = tt(subs.clone());
                        let p = compute_plan(&s, &t, &HashMap::new(), MON);
                        assert!(p.ready, "must always produce a plan");
                        for c in &p.subjects {
                            // Never demand more classes than the semester holds.
                            assert!(
                                c.min_needed <= c.total_lectures,
                                "need {} > total {} for {}", c.min_needed, c.total_lectures, c.name
                            );
                            assert!(c.target_needed >= c.min_needed, "target must not undercut minimum");
                            assert!(c.target_needed <= c.total_lectures);
                            assert!((0.0..=100.0).contains(&c.current_pct));
                            assert!((0.0..=100.0).contains(&c.projected_min_pct));
                            assert!(c.attended_so_far <= c.conducted, "cannot attend more than happened");
                            assert!(c.can_still_skip_days >= 0);
                            // A fresh semester with reachable targets is never impossible.
                            assert!(!c.impossible, "fresh semester should always be feasible");
                        }
                        let b = p.banner.unwrap();
                        assert!(b.attend_days_count >= 0 && b.buffer_days_count >= 0);
                        assert!(b.attend_days_count <= b.future_college_days_count);
                    }
                }
            }
        }
    }

    // ── 17. the plan actually achieves the minimum ───────────────────────
    #[test]
    fn following_the_plan_reaches_the_requirement() {
        // The strongest guarantee: if you attend every "required" day, every
        // subject must land at or above its threshold.
        let cases = [
            (MON, "2026-03-31", 75.0, 70.0),
            (MON, "2026-06-30", 60.0, 90.0),
            (MON, "2026-12-31", 90.0, 80.0),
        ];
        for (start, end, min, lab) in cases {
            let s = settings(start, end, min, lab, 85.0);
            let t = tt(vec![
                coded(subj("DS", "lecture", &[("Monday", 2), ("Wednesday", 1), ("Friday", 1)]), "A"),
                coded(subj("Lab", "lab", &[("Thursday", 2)]), "B"),
                coded(subj("Math", "lecture", &[("Tuesday", 1), ("Saturday", 2)]), "C"),
            ]);
            let p = compute_plan(&s, &t, &HashMap::new(), start);
            assert!(p.feasible);

            // Tally what the plan secures for each subject.
            let mut got: HashMap<String, i64> = HashMap::new();
            for d in p.days.iter().filter(|d| d.category == "required") {
                for sj in &d.subjects {
                    *got.entry(sj.name.clone()).or_insert(0) += sj.count;
                }
            }
            for c in &p.subjects {
                let secured = *got.get(&c.name).unwrap_or(&0);
                assert!(
                    secured >= c.min_needed,
                    "{} secured {} but needs {} ({}%, total {})",
                    c.name, secured, c.min_needed, c.req_percent, c.total_lectures
                );
                let pct = if c.total_lectures > 0 {
                    secured as f64 / c.total_lectures as f64 * 100.0
                } else {
                    100.0
                };
                assert!(pct + 1e-9 >= c.req_percent, "{} would finish at {:.1}%", c.name, pct);
            }
        }
    }

    // ── 18. hostile input ────────────────────────────────────────────────
    #[test]
    fn malformed_dates_never_panic() {
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1)])]);
        for (a, b, now) in [
            ("not-a-date", "2026-01-09", MON),
            (MON, "garbage", MON),
            (MON, "2026-01-09", "???"),
            ("2026-13-45", "2026-99-99", ""),
            ("", "2026-01-09", MON),
        ] {
            let s = settings(a, b, 75.0, 70.0, 85.0);
            let _ = compute_plan(&s, &t, &HashMap::new(), now); // must not panic
        }
    }

    #[test]
    fn today_outside_the_semester_is_handled() {
        let s = settings(MON, "2026-01-09", 75.0, 70.0, 85.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1)])]);

        // Long before the semester: everything is still ahead.
        let before = compute_plan(&s, &t, &HashMap::new(), "2020-01-01");
        assert!(before.ready);
        assert!(before.days.iter().all(|d| !d.is_past));

        // Long after: nothing is left to plan.
        let after = compute_plan(&s, &t, &HashMap::new(), "2030-01-01");
        assert!(after.ready);
        assert_eq!(after.banner.unwrap().attend_days_count, 0);
        assert!(after.days.iter().all(|d| d.is_past));
    }

    #[test]
    fn skipping_absolutely_everything_is_reported_not_crashed() {
        let s = settings(MON, "2026-01-09", 75.0, 70.0, 85.0);
        let t = tt(vec![subj("DS", "lecture", &[("Monday", 1), ("Wednesday", 1), ("Friday", 1)])]);
        let m = marks(&[
            ("2026-01-05", "skipped"), ("2026-01-06", "skipped"), ("2026-01-07", "skipped"),
            ("2026-01-08", "skipped"), ("2026-01-09", "skipped"),
        ]);
        let p = compute_plan(&s, &t, &m, MON);
        let c = card(&p, "DS");
        assert!(c.impossible && !p.feasible);
        assert_eq!(c.status, "danger");
        assert_eq!(p.banner.unwrap().attend_days_count, 0, "nothing left to attend");
    }

    #[test]
    fn leap_day_is_a_normal_class_day() {
        // 2028-02-29 is a Tuesday.
        let s = settings("2028-02-28", "2028-03-01", 100.0, 100.0, 100.0);
        let t = tt(vec![subj("DS", "lecture", &[("Tuesday", 1)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), "2028-02-28");
        assert_eq!(weekday_name("2028-02-29"), "Tuesday");
        assert_eq!(card(&p, "DS").total_lectures, 1);
        assert_eq!(cat(&p, "2028-02-29"), "required");
    }

    #[test]
    fn huge_period_counts_do_not_overflow() {
        let s = settings(MON, "2026-12-31", 100.0, 100.0, 100.0);
        let t = tt(vec![subj("Mega", "lecture", &[("Monday", 1_000_000)])]);
        let p = compute_plan(&s, &t, &HashMap::new(), MON);
        let c = card(&p, "Mega");
        assert!(c.total_lectures > 0);
        assert_eq!(c.min_needed, c.total_lectures);
        assert!(p.feasible);
    }

    // ── 19. randomized fuzz: 2000 scenarios, invariants must never break ──
    struct Rng(u64);
    impl Rng {
        fn next(&mut self) -> u64 {
            self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            self.0 >> 33
        }
        fn below(&mut self, n: u64) -> u64 {
            if n == 0 { 0 } else { self.next() % n }
        }
    }

    #[test]
    fn fuzz_invariants_never_break() {
        let mut rng = Rng(0x9E3779B97F4A7C15);
        let base = parse_iso("2026-01-01").unwrap();
        let kinds = ["lecture", "lab"];
        let weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        for _ in 0..2000 {
            // random semester window (sometimes inverted / single day)
            let start = base + Duration::days(rng.below(400) as i64);
            let len = rng.below(400) as i64 - 20; // can go negative => inverted
            let end = start + Duration::days(len);
            let s_iso = to_iso(start);
            let e_iso = to_iso(end);

            // random subjects
            let n_sub = 1 + rng.below(4);
            let mut subs = Vec::new();
            for i in 0..n_sub {
                let mut sched: Vec<(&str, i64)> = Vec::new();
                for wd in weekdays {
                    let n = rng.below(4) as i64; // 0..3 periods
                    if n > 0 {
                        sched.push((wd, n));
                    }
                }
                let kind = kinds[rng.below(2) as usize];
                let sj = coded(subj(&format!("S{}", i), kind, &sched), &format!("K{}", i));
                subs.push(sj);
            }

            let mut set = settings(
                &s_iso,
                &e_iso,
                rng.below(101) as f64,
                rng.below(101) as f64,
                rng.below(101) as f64,
            );
            set.attendance_mode = ["both", "lectures", "labs"][rng.below(3) as usize].into();

            // random holidays
            for _ in 0..rng.below(6) {
                set.holidays.push(to_iso(start + Duration::days(rng.below(60) as i64)));
            }

            // random baselines (always internally consistent)
            if rng.below(3) == 0 {
                for i in 0..n_sub {
                    let conducted = rng.below(50) as i64;
                    let attended = rng.below((conducted + 1) as u64) as i64;
                    set.baselines.insert(format!("K{}", i), Baseline { conducted, attended });
                }
                set.tracking_start = to_iso(start + Duration::days(rng.below(40) as i64));
            }

            // random marks, including cancellations and per-subject overrides
            let mut att = Attendance::default();
            for _ in 0..rng.below(25) {
                let d = to_iso(start + Duration::days(rng.below(90) as i64));
                let m = [MARK_ATTENDED, MARK_SKIPPED, MARK_CANCELLED][rng.below(3) as usize];
                att.days.insert(d, m.into());
            }
            for _ in 0..rng.below(15) {
                let d = to_iso(start + Duration::days(rng.below(90) as i64));
                let k = format!("K{}", rng.below(n_sub));
                let m = [MARK_ATTENDED, MARK_SKIPPED, MARK_CANCELLED][rng.below(3) as usize];
                att.subjects.insert((d, k), m.into());
            }

            let today = to_iso(start + Duration::days(rng.below(200) as i64 - 30));

            // Must never panic.
            let p = compute_plan_with(&set, &tt(subs), &att, &today);
            if !p.ready {
                continue;
            }

            for c in &p.subjects {
                assert!(c.total_lectures >= 0, "negative total");
                assert!(
                    c.min_needed <= c.total_lectures,
                    "min_needed {} > total {} ({})", c.min_needed, c.total_lectures, c.name
                );
                assert!(c.target_needed >= c.min_needed, "target below minimum ({})", c.name);
                assert!(c.target_needed <= c.total_lectures, "target above total ({})", c.name);
                assert!(c.attended_so_far <= c.conducted, "attended > conducted ({})", c.name);
                assert!(c.attended_so_far >= 0 && c.conducted >= 0);
                assert!(
                    (0.0..=100.0).contains(&c.current_pct),
                    "current_pct {} out of range ({})", c.current_pct, c.name
                );
                assert!(
                    (0.0..=100.0).contains(&c.projected_min_pct),
                    "projected {} out of range ({})", c.projected_min_pct, c.name
                );
                assert!(c.can_still_skip_days >= 0);
                assert!(c.req_percent >= 0.0 && c.req_percent <= 100.0);
            }

            let b = p.banner.as_ref().unwrap();
            assert!(b.attend_days_count >= 0);
            assert!(b.buffer_days_count >= 0);
            assert!(b.stay_home_count >= 0);
            assert!(b.future_college_days_count >= 0);
            assert!(b.lab_days_count >= 0);

            // THE core guarantee. `projected_min_pct` is secured/total, where
            // secured = everything already banked + every day the plan tells you
            // to attend. Any subject not flagged impossible must be projected to
            // finish at or above its requirement. (0.06 absorbs 1-dp rounding.)
            for c in &p.subjects {
                if !c.impossible {
                    assert!(
                        c.projected_min_pct + 0.06 >= c.req_percent,
                        "plan projects {:.1}% for {} but it requires {:.1}% (total {}, need {})",
                        c.projected_min_pct, c.name, c.req_percent, c.total_lectures, c.min_needed
                    );
                }
            }
        }
    }
}
