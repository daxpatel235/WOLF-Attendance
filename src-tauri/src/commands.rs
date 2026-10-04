// Tauri commands — the data layer the React frontend talks to via `invoke`.
// These replace the old Express REST routes 1:1.
use crate::models::{
    Baseline, Course, Exam, MarkResponse, Meta, Plan, Settings, StateResp, Timetable,
    TimetableSnapshot, TtSession, TtSubject,
};
use crate::planner::compute_plan;
use crate::storage::Store;
use crate::{config, dateutils};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

pub type SharedStore = Mutex<Store>;

/// Lock the store, recovering from a poisoned mutex. A panic in one command
/// must not brick every later command (and the reminder thread) for the rest
/// of the session — the data itself is still valid.
pub fn lock(store: &SharedStore) -> MutexGuard<'_, Store> {
    store.lock().unwrap_or_else(|e| e.into_inner())
}

const WEEKDAYS: [&str; 6] = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

fn meta(store: &Store) -> Meta {
    Meta {
        app: config::APP_NAME.into(),
        version: config::APP_VERSION.into(),
        tagline: config::APP_TAGLINE.into(),
        institution_types: config::INSTITUTION_TYPES
            .iter()
            .map(|s| s.to_string())
            .collect(),
        data_path: store.data_path(),
    }
}

fn make_plan(store: &Store) -> Plan {
    compute_plan(
        store.settings(),
        store.timetable(),
        &store.data.attendance,
        &store.data.subject_attendance,
        &dateutils::today_iso(),
    )
}

fn make_state(store: &Store, ok: bool, error: Option<String>) -> StateResp {
    StateResp {
        ok,
        error,
        settings: store.settings().clone(),
        timetable: store.timetable().clone(),
        timetable_history: store.data.timetable_history.clone(),
        courses: store.data.courses.clone(),
        exams: store.data.exams.clone(),
        plan: make_plan(store),
        subject_attendance: store.data.subject_attendance.clone(),
        today: Some(dateutils::today_iso()),
        meta: meta(store),
    }
}

/// Whether tomorrow is a teaching day, plus a human message for the reminder.
pub fn tomorrow_message(store: &Store) -> (bool, String) {
    let today = dateutils::today_iso();
    let tomorrow = dateutils::add_days(&today, 1);
    let inst = if store
        .settings()
        .institution_type
        .to_lowercase()
        .contains("school")
    {
        "school"
    } else {
        "college"
    };
    let plan = make_plan(store);
    if let Some(day) = plan.days.iter().find(|d| d.date == tomorrow) {
        if day.category != "holiday" && day.total_lectures > 0 {
            let tip = match day.category.as_str() {
                "required" | "attend" => "You should attend.",
                "buffer" => "Optional buffer day — attend for safety.",
                _ => "You can stay home if you like.",
            };
            let name = store.settings().first_name.trim().to_string();
            let who = if name.is_empty() {
                String::new()
            } else {
                format!("{}, ", name)
            };
            return (true, format!("{}tomorrow is a {} day. {}", who, inst, tip));
        }
    }
    (
        false,
        format!("No {} tomorrow — enjoy the day off! 😴", inst),
    )
}

fn num(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::String(s) => s.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn clamp_pct(v: &Value) -> f64 {
    // NaN is handled explicitly: bare `clamp` would propagate it, and a NaN
    // percentage would poison every downstream comparison.
    let n = num(v);
    if n.is_nan() {
        0.0
    } else {
        n.clamp(0.0, 100.0)
    }
}

fn apply_settings_patch(s: &mut Settings, patch: &HashMap<String, Value>) {
    for (k, v) in patch {
        match k.as_str() {
            "institutionType" => set_str(&mut s.institution_type, v),
            "institutionName" => set_str(&mut s.institution_name, v),
            "className" => set_str(&mut s.class_name, v),
            "division" => set_str(&mut s.division, v),
            "semester" => set_str(&mut s.semester, v),
            "timetableName" => set_str(&mut s.timetable_name, v),
            "batchName" => set_str(&mut s.batch_name, v),
            "semesterStart" => set_str(&mut s.semester_start, v),
            "semesterEnd" => set_str(&mut s.semester_end, v),
            "appearance" => set_str(&mut s.appearance, v),
            "firstName" => set_str(&mut s.first_name, v),
            "age" => set_str(&mut s.age, v),
            "email" => set_str(&mut s.email, v),
            "reminderTime" => {
                if let Some(t) = v.as_str().and_then(normalize_hhmm) {
                    s.reminder_time = t;
                }
            }
            "onboarded" => set_bool(&mut s.onboarded, v),
            "reminderEnabled" => set_bool(&mut s.reminder_enabled, v),
            "autostartEnabled" => set_bool(&mut s.autostart_enabled, v),
            "attendanceMode" => {
                if let Some(x) = v.as_str() {
                    if ["both", "lectures", "labs"].contains(&x) {
                        s.attendance_mode = x.to_string();
                    }
                }
            }
            "minPercent" => s.min_percent = clamp_pct(v),
            "targetPercent" => s.target_percent = clamp_pct(v),
            "labPercent" => s.lab_percent = clamp_pct(v),
            "gpaScale" => s.gpa_scale = num(v).clamp(1.0, 100.0),
            "holidays" => {
                if let Some(arr) = v.as_array() {
                    s.holidays = arr
                        .iter()
                        .filter_map(|x| x.as_str().map(|y| y.to_string()))
                        .collect();
                }
            }
            "trackingStart" => set_str(&mut s.tracking_start, v),
            // { "CS201": { "conducted": 18, "attended": 12 }, ... }
            // A baseline can never claim more attended than conducted, and a
            // zero-conducted entry is dropped rather than stored as noise.
            "baselines" => {
                if let Some(obj) = v.as_object() {
                    let mut out: HashMap<String, Baseline> = HashMap::new();
                    for (key, val) in obj {
                        let conducted = val.get("conducted").map(num).unwrap_or(0.0).round() as i64;
                        let attended = val.get("attended").map(num).unwrap_or(0.0).round() as i64;
                        let conducted = conducted.max(0);
                        if conducted == 0 {
                            continue;
                        }
                        out.insert(
                            key.clone(),
                            Baseline {
                                conducted,
                                attended: attended.clamp(0, conducted),
                            },
                        );
                    }
                    s.baselines = out;
                }
            }
            _ => {}
        }
    }
}

/// "9:5", "09:05" or "09:05:00" -> "09:05". Anything unparseable is rejected so
/// the reminder scheduler always compares like with like.
pub fn normalize_hhmm(t: &str) -> Option<String> {
    let t = t.trim();
    chrono::NaiveTime::parse_from_str(t, "%H:%M")
        .or_else(|_| chrono::NaiveTime::parse_from_str(t, "%H:%M:%S"))
        .ok()
        .map(|x| x.format("%H:%M").to_string())
}

fn set_str(field: &mut String, v: &Value) {
    if let Some(x) = v.as_str() {
        *field = x.to_string();
    }
}

fn set_bool(field: &mut bool, v: &Value) {
    if let Some(x) = v.as_bool() {
        *field = x;
    }
}

// ---- commands -------------------------------------------------------------
#[tauri::command]
pub fn bootstrap(store: State<SharedStore>) -> StateResp {
    let s = lock(&store);
    make_state(&s, true, None)
}

#[tauri::command]
pub fn save_settings(patch: HashMap<String, Value>, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    // Validate the *merged* result, so changing only one of the two dates can't
    // sneak an end-before-start semester past the check.
    let mut next = s.settings().clone();
    apply_settings_patch(&mut next, &patch);
    let (a, b) = (next.semester_start.as_str(), next.semester_end.as_str());
    if !a.is_empty() && !b.is_empty() {
        if dateutils::parse_iso(a).is_none() || dateutils::parse_iso(b).is_none() {
            return make_state(
                &s,
                false,
                Some("Semester dates must be valid dates.".into()),
            );
        }
        if a > b {
            return make_state(
                &s,
                false,
                Some("Start date must be on or before end date.".into()),
            );
        }
    }
    s.data.settings = next;
    if let Err(e) = s.save() {
        return make_state(&s, false, Some(format!("Could not save your data: {e}")));
    }
    make_state(&s, true, None)
}

#[tauri::command]
pub fn add_holiday(date: String, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    s.add_holiday(&date);
    make_state(&s, true, None)
}

#[tauri::command]
pub fn remove_holiday(date: String, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    s.remove_holiday(&date);
    make_state(&s, true, None)
}

/// Only the three real marks (plus an empty/"clear" reset) may be persisted, so
/// a typo from the frontend can never poison the stored data.
fn clean_mark(status: &str) -> String {
    match status {
        wolf_core::MARK_ATTENDED | wolf_core::MARK_SKIPPED | wolf_core::MARK_CANCELLED => {
            status.to_string()
        }
        _ => String::new(),
    }
}

#[tauri::command]
pub fn mark_day(date: String, status: String, store: State<SharedStore>) -> MarkResponse {
    let mut s = lock(&store);
    s.mark_day(&date, &clean_mark(&status));
    MarkResponse {
        ok: true,
        plan: make_plan(&s),
    }
}

/// Mark one subject on one day — "I went to DS but skipped Physics on Tuesday".
#[tauri::command]
pub fn mark_subject(
    date: String,
    subject_key: String,
    status: String,
    store: State<SharedStore>,
) -> MarkResponse {
    let mut s = lock(&store);
    s.mark_subject(&date, &subject_key, &clean_mark(&status));
    MarkResponse {
        ok: true,
        plan: make_plan(&s),
    }
}

/// Clear every per-subject override on a date, falling back to the day mark.
#[tauri::command]
pub fn clear_subject_marks(date: String, store: State<SharedStore>) -> MarkResponse {
    let mut s = lock(&store);
    s.data.subject_attendance.remove(&date);
    let _ = s.save();
    MarkResponse {
        ok: true,
        plan: make_plan(&s),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingSubject {
    #[serde(default)]
    name: String,
    #[serde(default)]
    code: String,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    schedule: HashMap<String, Value>,
    #[serde(default)]
    sessions: Vec<TtSession>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTimetablePayload {
    #[serde(default)]
    batch_name: String,
    #[serde(default)]
    subjects: Vec<IncomingSubject>,
}

#[tauri::command]
pub fn save_timetable(payload: SaveTimetablePayload, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    let mut clean: Vec<TtSubject> = Vec::new();
    for subj in &payload.subjects {
        let name = subj.name.trim().to_string();
        if name.is_empty() {
            continue;
        }
        let mut schedule: HashMap<String, i64> = HashMap::new();
        for day in WEEKDAYS {
            let n = subj.schedule.get(day).map(num).unwrap_or(0.0).round() as i64;
            schedule.insert(day.to_string(), n.max(0));
        }
        let idx = clean.len();
        clean.push(TtSubject {
            name,
            code: subj.code.trim().to_string(),
            kind: if subj.kind == "lab" {
                "lab".into()
            } else {
                "lecture".into()
            },
            color: config::palette_color(idx),
            schedule,
            sessions: subj.sessions.clone(),
        });
    }
    if clean.is_empty() {
        return make_state(&s, false, Some("Add at least one subject.".into()));
    }
    let batch = payload.batch_name.trim().to_string();
    let had_batch = !s.settings().batch_name.is_empty();
    // Archive the current timetable (most recent first, keep the last 8).
    if let Some(prev) = s.data.timetable.clone() {
        if !prev.subjects.is_empty() {
            s.data.timetable_history.insert(
                0,
                TimetableSnapshot {
                    saved_at: dateutils::today_iso(),
                    timetable: prev,
                },
            );
            s.data.timetable_history.truncate(8);
        }
    }
    s.set_timetable(Timetable {
        batch_name: batch.clone(),
        subjects: clean,
    });
    if !batch.is_empty() && !had_batch {
        s.data.settings.batch_name = batch;
    }
    let _ = s.save();
    make_state(&s, true, None)
}

/// Replace the saved GPA course list (grades tracker).
#[tauri::command]
pub fn save_courses(courses: Vec<Course>, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    let clean: Vec<Course> = courses
        .into_iter()
        .filter(|c| !c.name.trim().is_empty())
        .map(|c| Course {
            id: c.id,
            name: c.name.trim().to_string(),
            credits: c.credits.max(0.0),
            grade: c.grade.max(0.0),
        })
        .collect();
    s.set_courses(clean);
    make_state(&s, true, None)
}

/// Replace the saved exam list (countdown board).
#[tauri::command]
pub fn save_exams(exams: Vec<Exam>, store: State<SharedStore>) -> StateResp {
    let mut s = lock(&store);
    let clean: Vec<Exam> = exams
        .into_iter()
        .filter(|e| !e.title.trim().is_empty())
        .map(|e| Exam {
            id: e.id,
            title: e.title.trim().to_string(),
            subject: e.subject.trim().to_string(),
            date: e.date.trim().to_string(),
            done: e.done,
        })
        .collect();
    s.set_exams(clean);
    make_state(&s, true, None)
}

/// Open a web/mail link in the user's default app. Only http(s) and mailto are
/// allowed: handing an arbitrary string to the OS shell would let any page
/// content launch local programs or files.
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let u = url.trim();
    let lower = u.to_ascii_lowercase();
    if !(lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("mailto:"))
    {
        return Err("Only http(s) and mailto links can be opened.".into());
    }
    open::that(u).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(enabled: bool, app: AppHandle, store: State<SharedStore>) -> StateResp {
    let mgr = app.autolaunch();
    let res = if enabled { mgr.enable() } else { mgr.disable() };
    let mut s = lock(&store);
    if let Err(e) = res {
        // Keep the stored flag truthful: it only flips when the OS accepted it.
        return make_state(
            &s,
            false,
            Some(format!("Could not change start-up setting: {e}")),
        );
    }
    s.data.settings.autostart_enabled = enabled;
    let _ = s.save();
    make_state(&s, true, None)
}

/// Fire the "tomorrow is a college/school day" notification immediately (used by
/// the "Test reminder" button so the user can preview it).
#[tauri::command]
pub fn test_reminder(app: AppHandle, store: State<SharedStore>) -> Result<(), String> {
    let (is_college, body) = {
        let s = lock(&store);
        tomorrow_message(&s)
    };
    let title = if is_college {
        "📚 You have classes tomorrow"
    } else {
        "😴 Day off tomorrow"
    };
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn patch(v: Value) -> HashMap<String, Value> {
        serde_json::from_value(v).unwrap()
    }

    #[test]
    fn reminder_time_is_normalised_or_rejected() {
        assert_eq!(normalize_hhmm("9:05").as_deref(), Some("09:05"));
        assert_eq!(normalize_hhmm("20:00:00").as_deref(), Some("20:00"));
        assert_eq!(normalize_hhmm("25:00"), None);
        assert_eq!(normalize_hhmm("tonight"), None);

        let mut s = Settings::default();
        apply_settings_patch(&mut s, &patch(json!({ "reminderTime": "7:30" })));
        assert_eq!(s.reminder_time, "07:30");
        apply_settings_patch(&mut s, &patch(json!({ "reminderTime": "garbage" })));
        assert_eq!(s.reminder_time, "07:30", "bad input must not overwrite");
    }

    #[test]
    fn percentages_are_clamped_and_strings_accepted() {
        let mut s = Settings::default();
        apply_settings_patch(
            &mut s,
            &patch(json!({ "minPercent": "150", "labPercent": -4, "targetPercent": "80" })),
        );
        assert_eq!(s.min_percent, 100.0);
        assert_eq!(s.lab_percent, 0.0);
        assert_eq!(s.target_percent, 80.0);
    }

    #[test]
    fn baselines_are_sanitised() {
        let mut s = Settings::default();
        apply_settings_patch(
            &mut s,
            &patch(json!({ "baselines": {
                "CS201": { "conducted": 10, "attended": 14 },
                "PHY":   { "conducted": 0,  "attended": 0 },
                "MTH":   { "conducted": "8", "attended": "-3" }
            }})),
        );
        assert_eq!(s.baselines["CS201"].attended, 10);
        assert!(!s.baselines.contains_key("PHY"));
        assert_eq!(s.baselines["MTH"].attended, 0);
    }

    #[test]
    fn unknown_attendance_mode_is_ignored() {
        let mut s = Settings::default();
        apply_settings_patch(&mut s, &patch(json!({ "attendanceMode": "everything" })));
        assert_eq!(s.attendance_mode, "both");
        apply_settings_patch(&mut s, &patch(json!({ "attendanceMode": "labs" })));
        assert_eq!(s.attendance_mode, "labs");
    }

    #[test]
    fn only_web_and_mail_links_can_be_opened() {
        // Rejected before anything is handed to the OS.
        assert!(open_external("C:\\Windows\\System32\\calc.exe".into()).is_err());
        assert!(open_external("file:///etc/passwd".into()).is_err());
        assert!(open_external("javascript:alert(1)".into()).is_err());
    }

    #[test]
    fn marks_are_whitelisted() {
        assert_eq!(clean_mark("attended"), "attended");
        assert_eq!(clean_mark("skipped"), "skipped");
        assert_eq!(clean_mark("cancelled"), "cancelled");
        assert_eq!(clean_mark("Attended"), "");
        assert_eq!(clean_mark("present"), "");
    }
}
