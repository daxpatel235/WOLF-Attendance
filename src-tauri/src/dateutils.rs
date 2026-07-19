// Calendar-date helpers on "YYYY-MM-DD" strings (timezone-safe, local dates).
use chrono::{Datelike, Duration, Local, NaiveDate};

pub const WEEKDAYS: [&str; 7] = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/// Parse "YYYY-MM-DD"; returns None on malformed input.
pub fn parse_iso(iso: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(iso.trim(), "%Y-%m-%d").ok()
}

pub fn to_iso(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// Today's date in the machine's local timezone (matches the old JS `new Date()`).
pub fn today_iso() -> String {
    to_iso(Local::now().date_naive())
}

/// Full weekday name (Sunday..Saturday); empty string if the date is malformed.
pub fn weekday_name(iso: &str) -> String {
    match parse_iso(iso) {
        Some(d) => WEEKDAYS[d.weekday().num_days_from_sunday() as usize].to_string(),
        None => String::new(),
    }
}

pub fn is_sunday(iso: &str) -> bool {
    matches!(parse_iso(iso), Some(d) if d.weekday().num_days_from_sunday() == 0)
}

pub fn add_days(iso: &str, n: i64) -> String {
    match parse_iso(iso) {
        Some(d) => to_iso(d + Duration::days(n)),
        None => iso.to_string(),
    }
}

/// Inclusive list of every date from start..=end. Empty if unset or start > end.
pub fn list_dates(start_iso: &str, end_iso: &str) -> Vec<String> {
    let mut out = Vec::new();
    let (start, end) = match (parse_iso(start_iso), parse_iso(end_iso)) {
        (Some(s), Some(e)) => (s, e),
        _ => return out,
    };
    if start > end {
        return out;
    }
    let mut cur = start;
    while cur <= end {
        out.push(to_iso(cur));
        cur = cur + Duration::days(1);
    }
    out
}

/// Compare two ISO date strings. Since they are zero-padded YYYY-MM-DD, a plain
/// lexicographic comparison is equivalent to a chronological one.
pub fn compare_iso(a: &str, b: &str) -> std::cmp::Ordering {
    a.cmp(b)
}
