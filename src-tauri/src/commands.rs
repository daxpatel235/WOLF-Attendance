// Tauri commands — the data layer the React frontend talks to via `invoke`.
// These replace the old Express REST routes 1:1.
use crate::models::{
    Course, Exam, MarkResponse, Meta, Plan, Settings, StateResp, Timetable, TimetableSnapshot,
    TtSession, TtSubject,
};
use crate::planner::compute_plan;
use crate::storage::Store;
use crate::{config, dateutils};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_notification::NotificationExt;

pub type SharedStore = Mutex<Store>;

const WEEKDAYS: [&str; 6] = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

fn meta(store: &Store) -> Meta {
    Meta {
        app: config::APP_NAME.into(),
        version: config::APP_VERSION.into(),
        tagline: config::APP_TAGLINE.into(),
        institution_types: config::INSTITUTION_TYPES.iter().map(|s| s.to_string()).collect(),
        data_path: store.data_path(),
    }
}

fn make_plan(store: &Store) -> Plan {
    compute_plan(
        store.settings(),
        store.timetable(),
        &store.data.attendance,
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
    let plan = compute_plan(store.settings(), store.timetable(), &store.data.attendance, &today);
    if let Some(day) = plan.days.iter().find(|d| d.date == tomorrow) {
        if day.category != "holiday" && day.total_lectures > 0 {
            let tip = match day.category.as_str() {
                "required" | "attend" => "You should attend.",
                "buffer" => "Optional buffer day — attend for safety.",
                _ => "You can stay home if you like.",
            };
            let name = store.settings().first_name.trim().to_string();
            let who = if name.is_empty() { String::new() } else { format!("{}, ", name) };
            return (true, format!("{}tomorrow is a {} day. {}", who, inst, tip));
        }
    }
    (false, format!("No {} tomorrow — enjoy the day off! 😴", inst))
}

fn num(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::String(s) => s.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

fn clamp_pct(v: &Value) -> f64 {
    num(v).max(0.0).min(100.0)
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
            "reminderTime" => set_str(&mut s.reminder_time, v),
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
            _ => {}
        }
    }
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
    let s = store.lock().unwrap();
    make_state(&s, true, None)
}

#[tauri::command]
pub fn save_settings(patch: HashMap<String, Value>, store: State<SharedStore>) -> StateResp {
    let mut s = store.lock().unwrap();
    // Mirror the old server: only validate order when both dates are in the patch.
    if let (Some(a), Some(b)) = (
        patch.get("semesterStart").and_then(|v| v.as_str()),
        patch.get("semesterEnd").and_then(|v| v.as_str()),
    ) {
        if !a.is_empty() && !b.is_empty() && a > b {
            return make_state(&s, false, Some("Start date must be on or before end date.".into()));
        }
    }
    apply_settings_patch(&mut s.data.settings, &patch);
    let _ = s.save();
    make_state(&s, true, None)
}

#[tauri::command]
pub fn add_holiday(date: String, store: State<SharedStore>) -> StateResp {
    let mut s = store.lock().unwrap();
    s.add_holiday(&date);
    make_state(&s, true, None)
}

#[tauri::command]
pub fn remove_holiday(date: String, store: State<SharedStore>) -> StateResp {
    let mut s = store.lock().unwrap();
    s.remove_holiday(&date);
    make_state(&s, true, None)
}

#[tauri::command]
pub fn mark_day(date: String, status: String, store: State<SharedStore>) -> MarkResponse {
    let mut s = store.lock().unwrap();
    s.mark_day(&date, &status);
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
    let mut s = store.lock().unwrap();
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
            kind: if subj.kind == "lab" { "lab".into() } else { "lecture".into() },
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
                TimetableSnapshot { saved_at: dateutils::today_iso(), timetable: prev },
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
    let mut s = store.lock().unwrap();
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
    let mut s = store.lock().unwrap();
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

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart(enabled: bool, app: AppHandle, store: State<SharedStore>) -> StateResp {
    let mgr = app.autolaunch();
    let _ = if enabled { mgr.enable() } else { mgr.disable() };
    let mut s = store.lock().unwrap();
    s.data.settings.autostart_enabled = enabled;
    let _ = s.save();
    make_state(&s, true, None)
}

/// Fire the "tomorrow is a college/school day" notification immediately (used by
/// the "Test reminder" button so the user can preview it).
#[tauri::command]
pub fn test_reminder(app: AppHandle, store: State<SharedStore>) -> Result<(), String> {
    let (is_college, body) = {
        let s = store.lock().unwrap();
        tomorrow_message(&s)
    };
    let title = if is_college { "📚 You have classes tomorrow" } else { "😴 Day off tomorrow" };
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}
