//! Calendar-date helpers on "YYYY-MM-DD" strings (timezone-safe, local dates).
//!
//! The canonical implementations live in `wolf-core`, so the app and the planner
//! can never disagree about what a weekday, a Sunday or a date range is.
#![allow(dead_code)]

use chrono::{Duration, Local};

pub use wolf_core::{parse_iso, to_iso};

/// Today's date in the machine's local timezone.
pub fn today_iso() -> String {
    to_iso(Local::now().date_naive())
}

pub fn add_days(iso: &str, n: i64) -> String {
    match parse_iso(iso) {
        Some(d) => to_iso(d + Duration::days(n)),
        None => iso.to_string(),
    }
}
