// App-wide constants and palette (shared with the planner and providers).

pub const APP_NAME: &str = "WOLF Attendance";
pub const APP_TAGLINE: &str = "Attend the minimum. Stay home the rest.";
pub const APP_VERSION: &str = "3.1.0";

pub const SUBJECT_PALETTE: [&str; 12] = [
    "#4A7C59", "#4A6B8A", "#C49A3C", "#C4704F", "#7C6F58", "#5A7A6A", "#8A6D5A", "#6A5A7A",
    "#4F6F8A", "#8A8246", "#A94438", "#6B6560",
];

// Lab/lecture weighting is part of the algorithm and now lives in `wolf-core`
// (see wolf_core::LAB_WEIGHT / LECTURE_WEIGHT) so there is a single source of truth.

pub const INSTITUTION_TYPES: [&str; 4] =
    ["College", "School", "University", "Coaching / Institute"];

/// Palette colour for the Nth subject (wraps around).
pub fn palette_color(index: usize) -> String {
    SUBJECT_PALETTE[index % SUBJECT_PALETTE.len()].to_string()
}
