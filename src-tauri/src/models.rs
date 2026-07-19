// Shared data shapes. serde renames every field to camelCase so the JSON that
// crosses the Tauri bridge matches the TypeScript types in src/types.ts 1:1.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ---- Persisted settings ---------------------------------------------------
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub institution_type: String,
    pub institution_name: String,
    pub class_name: String,
    pub division: String,
    pub semester: String,
    pub timetable_name: String,
    pub batch_name: String,
    pub semester_start: String,
    pub semester_end: String,
    pub min_percent: f64,
    pub target_percent: f64,
    pub lab_percent: f64,
    pub holidays: Vec<String>,
    pub appearance: String,
    // GPA/CGPA scale — 10 for Indian colleges, 4 for the US 4-point scale.
    pub gpa_scale: f64,
    // "both" (labs + lectures), "lectures" (lectures only), or "labs" (labs only).
    pub attendance_mode: String,
    // Profile
    pub first_name: String,
    pub age: String,
    pub email: String,
    pub onboarded: bool,
    // Reminders (fired by the tray scheduler)
    pub reminder_enabled: bool,
    pub reminder_time: String,
    pub autostart_enabled: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            institution_type: "College".into(),
            institution_name: String::new(),
            class_name: String::new(),
            division: String::new(),
            semester: String::new(),
            timetable_name: String::new(),
            batch_name: String::new(),
            semester_start: String::new(),
            semester_end: String::new(),
            min_percent: 60.0,
            target_percent: 75.0,
            lab_percent: 75.0,
            holidays: Vec::new(),
            appearance: "light".into(),
            gpa_scale: 10.0,
            attendance_mode: "both".into(),
            first_name: String::new(),
            age: String::new(),
            email: String::new(),
            onboarded: false,
            reminder_enabled: false,
            reminder_time: "20:00".into(),
            autostart_enabled: false,
        }
    }
}

// ---- Timetable ------------------------------------------------------------
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct TtSession {
    pub day: String,
    pub start: String,
    pub end: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub periods: Option<i64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TtSubject {
    pub name: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    #[serde(default)]
    pub schedule: HashMap<String, i64>,
    #[serde(default)]
    pub sessions: Vec<TtSession>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct Timetable {
    pub batch_name: String,
    pub subjects: Vec<TtSubject>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimetableSnapshot {
    pub saved_at: String,
    pub timetable: Timetable,
}

// ---- Grades / exams -------------------------------------------------------
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Course {
    pub id: String,
    pub name: String,
    pub credits: f64,
    // Grade points on the chosen scale (e.g. 0–10 or 0–4).
    pub grade: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct Exam {
    pub id: String,
    pub title: String,
    pub subject: String,
    pub date: String, // ISO yyyy-mm-dd
    pub done: bool,
}

// ---- Persisted root -------------------------------------------------------
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(default)]
pub struct Data {
    pub settings: Settings,
    pub timetable: Option<Timetable>,
    pub attendance: HashMap<String, String>,
    pub timetable_history: Vec<TimetableSnapshot>,
    pub courses: Vec<Course>,
    pub exams: Vec<Exam>,
}

// ---- Plan output ----------------------------------------------------------
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DaySubject {
    pub name: String,
    pub count: i64,
    pub color: String,
    pub kind: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DaySession {
    pub name: String,
    pub code: String,
    pub kind: String,
    pub color: String,
    pub start: String,
    pub end: String,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Day {
    pub date: String,
    pub weekday: String,
    pub is_past: bool,
    pub is_today: bool,
    pub category: String,
    pub marked: Option<String>,
    pub subjects: Vec<DaySubject>,
    pub sessions: Vec<DaySession>,
    pub has_lab: bool,
    pub total_lectures: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubjectCard {
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

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
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

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub ready: bool,
    pub message: String,
    pub banner: Option<Banner>,
    pub subjects: Vec<SubjectCard>,
    pub days: Vec<Day>,
    pub feasible: bool,
}

// ---- Meta -----------------------------------------------------------------
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub app: String,
    pub version: String,
    pub tagline: String,
    pub institution_types: Vec<String>,
    pub data_path: String,
}

// ---- Command response envelopes -------------------------------------------
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StateResp {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub settings: Settings,
    pub timetable: Option<Timetable>,
    pub timetable_history: Vec<TimetableSnapshot>,
    pub courses: Vec<Course>,
    pub exams: Vec<Exam>,
    pub plan: Plan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub today: Option<String>,
    pub meta: Meta,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MarkResponse {
    pub ok: bool,
    pub plan: Plan,
}
