// Core lab-aware planner — Rust port of the validated algorithm.
// Smallest set of college days so every subject (lecture & lab) stays above its
// requirement. Sunday excluded; holidays free. Labs use a stricter % and are
// weighted so their days are locked in first.
use crate::config;
use crate::dateutils::{compare_iso, is_sunday, list_dates, weekday_name};
use crate::models::{
    Banner, Day, DaySession, DaySubject, Plan, Settings, SubjectCard, Timetable, TtSubject,
};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};

const DAYS: [&str; 6] = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

#[derive(Clone)]
struct CollegeDay {
    date: String,
    weekday: String,
    lectures: Vec<(String, i64)>, // (subject name, count), in subject order
    total: i64,
}

fn ceil_pct(total: i64, pct: f64) -> i64 {
    ((total as f64) * pct / 100.0).ceil() as i64
}

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// Score a day against remaining need: weighted coverage + number of subjects touched.
fn score_day(
    lectures: &[(String, i64)],
    need: &HashMap<String, i64>,
    weight_of: &HashMap<String, i64>,
) -> (i64, i64) {
    let mut score = 0;
    let mut covered = 0;
    for (n, c) in lectures {
        let nd = *need.get(n).unwrap_or(&0);
        if nd > 0 {
            score += weight_of.get(n).copied().unwrap_or(1) * nd.min(*c);
            covered += 1;
        }
    }
    (score, covered)
}

fn any_need(subjects: &[String], need: &HashMap<String, i64>) -> bool {
    subjects.iter().any(|s| *need.get(s).unwrap_or(&0) > 0)
}

pub fn compute_plan(
    settings: &Settings,
    timetable: &Option<Timetable>,
    marks: &HashMap<String, String>,
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

    let min_percent = settings.min_percent;
    let target_percent = settings.target_percent;
    let lab_percent = settings.lab_percent;
    let holiday_set: HashSet<&String> = settings.holidays.iter().collect();

    // Attendance mode decides which session kinds count toward the plan.
    let mode = settings.attendance_mode.as_str();
    let subjects: Vec<TtSubject> = tt
        .subjects
        .iter()
        .filter(|s| {
            let is_lab = s.kind == "lab";
            match mode {
                "lectures" => !is_lab,
                "labs" => is_lab,
                _ => true, // "both"
            }
        })
        .cloned()
        .collect();
    if subjects.is_empty() {
        result.message = match mode {
            "lectures" => "Your timetable has no lecture subjects for the current attendance mode.".into(),
            "labs" => "Your timetable has no lab subjects for the current attendance mode.".into(),
            _ => "No timetable has been imported yet.".into(),
        };
        return result;
    }
    let names: Vec<String> = subjects.iter().map(|s| s.name.clone()).collect();

    let mut kind_of: HashMap<String, String> = HashMap::new();
    let mut color_of: HashMap<String, String> = HashMap::new();
    let mut code_of: HashMap<String, String> = HashMap::new();
    let mut weight_of: HashMap<String, i64> = HashMap::new();
    for s in &subjects {
        let kind = if s.kind.is_empty() { "lecture".to_string() } else { s.kind.clone() };
        weight_of.insert(
            s.name.clone(),
            if kind == "lab" { config::LAB_WEIGHT } else { config::LECTURE_WEIGHT },
        );
        kind_of.insert(s.name.clone(), kind);
        color_of.insert(
            s.name.clone(),
            if s.color.is_empty() { "#6B6560".to_string() } else { s.color.clone() },
        );
        code_of.insert(s.name.clone(), s.code.clone());
    }

    // Weekly sessions grouped by weekday, sorted by start time.
    let mut sessions_by_wd: HashMap<String, Vec<DaySession>> = HashMap::new();
    for d in DAYS {
        sessions_by_wd.insert(d.to_string(), Vec::new());
    }
    for s in &subjects {
        for sess in &s.sessions {
            if let Some(list) = sessions_by_wd.get_mut(&sess.day) {
                list.push(DaySession {
                    name: s.name.clone(),
                    code: s.code.clone(),
                    kind: kind_of[&s.name].clone(),
                    color: color_of[&s.name].clone(),
                    start: sess.start.clone(),
                    end: sess.end.clone(),
                });
            }
        }
    }
    for d in DAYS {
        sessions_by_wd
            .get_mut(d)
            .unwrap()
            .sort_by(|a, b| a.start.cmp(&b.start));
    }

    // 1. College days
    let all_dates = list_dates(&settings.semester_start, &settings.semester_end);
    let mut college_days: Vec<CollegeDay> = Vec::new();
    let mut holiday_days: Vec<String> = Vec::new();
    for date in &all_dates {
        if is_sunday(date) {
            continue;
        }
        if holiday_set.contains(date) {
            holiday_days.push(date.clone());
            continue;
        }
        let wd = weekday_name(date);
        let mut lectures: Vec<(String, i64)> = Vec::new();
        let mut total = 0;
        for subj in &subjects {
            let n = subj.schedule.get(&wd).copied().unwrap_or(0);
            if n > 0 {
                lectures.push((subj.name.clone(), n));
                total += n;
            }
        }
        college_days.push(CollegeDay { date: date.clone(), weekday: wd, lectures, total });
    }
    let college_by_date: HashMap<String, usize> = college_days
        .iter()
        .enumerate()
        .map(|(i, d)| (d.date.clone(), i))
        .collect();

    // 2. Totals + required
    let mut total_lectures: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    for day in &college_days {
        for (n, c) in &day.lectures {
            *total_lectures.get_mut(n).unwrap() += c;
        }
    }
    let mut min_needed: HashMap<String, i64> = HashMap::new();
    let mut target_needed: HashMap<String, i64> = HashMap::new();
    for s in &subjects {
        let t = total_lectures[&s.name];
        let is_lab = kind_of[&s.name] == "lab";
        let pct = if is_lab { lab_percent } else { min_percent };
        min_needed.insert(s.name.clone(), ceil_pct(t, pct));
        let tpct = if is_lab { target_percent.max(lab_percent) } else { target_percent };
        target_needed.insert(s.name.clone(), ceil_pct(t, tpct));
    }

    // 3. Fixed vs candidate
    let mut candidates: Vec<CollegeDay> = Vec::new();
    let mut attended: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    for day in &college_days {
        let status = marks.get(&day.date).map(|s| s.as_str());
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        let fixed = match status {
            Some("attended") => true,
            Some("skipped") => false,
            _ => is_past,
        };
        if fixed {
            for (n, c) in &day.lectures {
                *attended.get_mut(n).unwrap() += c;
            }
        } else if status != Some("skipped") {
            candidates.push(day.clone());
        }
    }

    // 4. Greedy minimum (labs weighted)
    let mut remaining: HashMap<String, i64> = HashMap::new();
    for s in &subjects {
        remaining.insert(
            s.name.clone(),
            (min_needed[&s.name] - attended[&s.name]).max(0),
        );
    }
    let mut required_set: HashSet<String> = HashSet::new();
    while any_need(&names, &remaining) {
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
            None => break,
        };
        required_set.insert(candidates[bi].date.clone());
        for (n, c) in candidates[bi].lectures.clone() {
            if remaining[&n] > 0 {
                let v = (remaining[&n] - c).max(0);
                remaining.insert(n, v);
            }
        }
    }

    let mut impossible: HashSet<String> = HashSet::new();
    for s in &subjects {
        if remaining[&s.name] > 0 {
            impossible.insert(s.name.clone());
            result.feasible = false;
        }
    }

    // 5. Buffer toward target
    let mut secured = attended.clone();
    for date in &required_set {
        if let Some(&idx) = college_by_date.get(date) {
            for (n, c) in &college_days[idx].lectures {
                *secured.get_mut(n).unwrap() += c;
            }
        }
    }
    let mut buffer_need: HashMap<String, i64> = HashMap::new();
    for s in &subjects {
        buffer_need.insert(
            s.name.clone(),
            (target_needed[&s.name] - secured[&s.name]).max(0),
        );
    }
    let mut buffer_set: HashSet<String> = HashSet::new();
    while any_need(&names, &buffer_need) {
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
        for (n, c) in candidates[bi].lectures.clone() {
            if buffer_need[&n] > 0 {
                let v = (buffer_need[&n] - c).max(0);
                buffer_need.insert(n, v);
            }
        }
    }

    // 6. Classify days
    let mut days: Vec<Day> = Vec::new();
    for day in &college_days {
        let status = marks.get(&day.date).map(|s| s.as_str());
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        let is_today = compare_iso(&day.date, today) == Ordering::Equal;
        let category = if is_past {
            if status == Some("skipped") { "past-skipped" } else { "past-attended" }
        } else if status == Some("attended") {
            "attend"
        } else if status == Some("skipped") {
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
            .map(|(n, c)| DaySubject {
                name: n.clone(),
                count: *c,
                color: color_of.get(n).cloned().unwrap_or_else(|| "#6B6560".into()),
                kind: kind_of.get(n).cloned().unwrap_or_else(|| "lecture".into()),
            })
            .collect();
        let has_lab = subj_entries.iter().any(|e| e.kind == "lab");
        days.push(Day {
            date: day.date.clone(),
            weekday: day.weekday.clone(),
            is_past,
            is_today,
            category: category.to_string(),
            marked: status.map(|s| s.to_string()),
            subjects: subj_entries,
            sessions: sessions_by_wd.get(&day.weekday).cloned().unwrap_or_default(),
            has_lab,
            total_lectures: day.total,
        });
    }
    for date in &holiday_days {
        days.push(Day {
            date: date.clone(),
            weekday: weekday_name(date),
            is_past: compare_iso(date, today) == Ordering::Less,
            is_today: compare_iso(date, today) == Ordering::Equal,
            category: "holiday".to_string(),
            marked: None,
            subjects: Vec::new(),
            sessions: Vec::new(),
            has_lab: false,
            total_lectures: 0,
        });
    }
    days.sort_by(|a, b| a.date.cmp(&b.date));

    // 7. Subject cards
    let mut conducted: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    let mut attended_so_far: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    let mut future_remaining: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    for day in &college_days {
        let is_past = compare_iso(&day.date, today) == Ordering::Less;
        let status = marks.get(&day.date).map(|s| s.as_str());
        for (n, c) in &day.lectures {
            if is_past {
                *conducted.get_mut(n).unwrap() += c;
                if status != Some("skipped") {
                    *attended_so_far.get_mut(n).unwrap() += c;
                }
            } else if status != Some("attended") && status != Some("skipped") {
                *future_remaining.get_mut(n).unwrap() += c;
            }
        }
    }
    let mut skippable: HashMap<String, i64> = names.iter().map(|n| (n.clone(), 0)).collect();
    for day in &days {
        if day.category == "skip" {
            for s in &day.subjects {
                *skippable.get_mut(&s.name).unwrap() += 1;
            }
        }
    }

    let mut subject_cards: Vec<SubjectCard> = subjects
        .iter()
        .map(|subj| {
            let name = &subj.name;
            let total = total_lectures[name];
            let cond = conducted[name];
            let att = attended_so_far[name];
            let current_pct = if cond > 0 { (att as f64 / cond as f64) * 100.0 } else { 100.0 };
            let max_reachable = attended[name] + future_remaining[name];
            let proj_min_pct = if total > 0 { (secured[name] as f64 / total as f64) * 100.0 } else { 100.0 };
            let is_lab = kind_of[name] == "lab";
            let req_pct = if is_lab { lab_percent } else { min_percent };
            let status = if max_reachable < min_needed[name] {
                "danger"
            } else if cond > 0 && current_pct < req_pct {
                "warning"
            } else if max_reachable < target_needed[name] {
                "warning"
            } else {
                "safe"
            };
            SubjectCard {
                name: name.clone(),
                code: code_of.get(name).cloned().unwrap_or_default(),
                kind: kind_of.get(name).cloned().unwrap_or_else(|| "lecture".into()),
                color: if subj.color.is_empty() { "#6B6560".into() } else { subj.color.clone() },
                total_lectures: total,
                min_needed: min_needed[name],
                target_needed: target_needed[name],
                req_percent: req_pct,
                attended_so_far: att,
                conducted: cond,
                current_pct: round1(current_pct),
                projected_min_pct: round1(proj_min_pct),
                can_still_skip_days: skippable[name],
                status: status.to_string(),
                impossible: impossible.contains(name),
            }
        })
        .collect();
    subject_cards.sort_by(|a, b| {
        let ka = if a.kind == "lab" { 0 } else { 1 };
        let kb = if b.kind == "lab" { 0 } else { 1 };
        ka.cmp(&kb)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    // 8. Banner
    let future_college = days
        .iter()
        .filter(|d| !d.is_past && d.category != "holiday")
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
