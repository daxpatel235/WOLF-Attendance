//! Adapter over `wolf-core`.
//!
//! The attendance algorithm itself lives in the pure `wolf-core` crate, where it
//! is covered by a scenario + fuzz test suite (`cargo test -p wolf-core`). This
//! module only translates between the serde-facing models in `models.rs` and the
//! plain structs the core works with, so the desktop app, the cloud API and a
//! future WASM build all execute byte-for-byte the same planner.

use crate::models::{Banner, Day, DaySession, DaySubject, Plan, Settings, SubjectCard, Timetable};
use std::collections::HashMap;
use wolf_core as core;

fn to_core_settings(s: &Settings) -> core::Settings {
    core::Settings {
        semester_start: s.semester_start.clone(),
        semester_end: s.semester_end.clone(),
        min_percent: s.min_percent,
        target_percent: s.target_percent,
        lab_percent: s.lab_percent,
        holidays: s.holidays.clone(),
        attendance_mode: s.attendance_mode.clone(),
        tracking_start: s.tracking_start.clone(),
        baselines: s
            .baselines
            .iter()
            .map(|(k, b)| {
                (
                    k.clone(),
                    core::Baseline {
                        conducted: b.conducted,
                        attended: b.attended,
                    },
                )
            })
            .collect(),
    }
}

fn to_core_timetable(t: &Option<Timetable>) -> Option<core::Timetable> {
    t.as_ref().map(|tt| core::Timetable {
        batch_name: tt.batch_name.clone(),
        subjects: tt
            .subjects
            .iter()
            .map(|s| core::TtSubject {
                name: s.name.clone(),
                code: s.code.clone(),
                kind: s.kind.clone(),
                color: s.color.clone(),
                schedule: s.schedule.clone(),
                sessions: s
                    .sessions
                    .iter()
                    .map(|x| core::TtSession {
                        day: x.day.clone(),
                        start: x.start.clone(),
                        end: x.end.clone(),
                    })
                    .collect(),
            })
            .collect(),
    })
}

fn from_core_plan(p: core::Plan) -> Plan {
    Plan {
        ready: p.ready,
        message: p.message,
        feasible: p.feasible,
        banner: p.banner.map(|b| Banner {
            attend_days_count: b.attend_days_count,
            stay_home_count: b.stay_home_count,
            buffer_days_count: b.buffer_days_count,
            future_college_days_count: b.future_college_days_count,
            lab_days_count: b.lab_days_count,
            today_action: b.today_action,
            min_percent: b.min_percent,
            target_percent: b.target_percent,
            lab_percent: b.lab_percent,
        }),
        subjects: p
            .subjects
            .into_iter()
            .map(|c| SubjectCard {
                key: c.key,
                name: c.name,
                code: c.code,
                kind: c.kind,
                color: c.color,
                total_lectures: c.total_lectures,
                min_needed: c.min_needed,
                target_needed: c.target_needed,
                req_percent: c.req_percent,
                attended_so_far: c.attended_so_far,
                conducted: c.conducted,
                current_pct: c.current_pct,
                projected_min_pct: c.projected_min_pct,
                can_still_skip_days: c.can_still_skip_days,
                status: c.status,
                impossible: c.impossible,
            })
            .collect(),
        days: p
            .days
            .into_iter()
            .map(|d| Day {
                date: d.date,
                weekday: d.weekday,
                is_past: d.is_past,
                is_today: d.is_today,
                category: d.category,
                marked: d.marked,
                subjects: d
                    .subjects
                    .into_iter()
                    .map(|s| DaySubject {
                        key: s.key,
                        name: s.name,
                        count: s.count,
                        color: s.color,
                        kind: s.kind,
                        mark: s.mark,
                    })
                    .collect(),
                sessions: d
                    .sessions
                    .into_iter()
                    .map(|s| DaySession {
                        key: s.key,
                        name: s.name,
                        code: s.code,
                        kind: s.kind,
                        color: s.color,
                        start: s.start,
                        end: s.end,
                        mark: s.mark,
                    })
                    .collect(),
                has_lab: d.has_lab,
                total_lectures: d.total_lectures,
            })
            .collect(),
    }
}

/// `day_marks` maps an ISO date to `"attended" | "skipped" | "cancelled"`.
/// `subject_marks` maps a date to per-subject overrides (subject key -> mark),
/// which beat the whole-day mark for that one subject.
pub fn compute_plan(
    settings: &Settings,
    timetable: &Option<Timetable>,
    day_marks: &HashMap<String, String>,
    subject_marks: &HashMap<String, HashMap<String, String>>,
    today: &str,
) -> Plan {
    let mut att = core::Attendance::from_days(day_marks);
    for (date, per_subject) in subject_marks {
        for (key, mark) in per_subject {
            att.subjects
                .insert((date.clone(), key.clone()), mark.clone());
        }
    }
    let plan = core::compute_plan_with(
        &to_core_settings(settings),
        &to_core_timetable(timetable),
        &att,
        today,
    );
    from_core_plan(plan)
}
