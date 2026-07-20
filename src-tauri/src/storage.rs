// Local on-device JSON storage. The data directory comes from Tauri
// (app_data_dir) so data persists per-device with no cloud.
use crate::models::{Course, Data, Exam, Settings, Timetable};
use std::fs;
use std::path::PathBuf;

pub struct Store {
    dir: PathBuf,
    file: PathBuf,
    pub data: Data,
}

impl Store {
    pub fn load(data_dir: PathBuf) -> Store {
        let file = data_dir.join("data.json");
        let data = fs::read_to_string(&file)
            .ok()
            .and_then(|txt| serde_json::from_str::<Data>(&txt).ok())
            .unwrap_or_default();
        Store { dir: data_dir, file, data }
    }

    /// Atomic write: serialize to `<file>.tmp`, then rename over the target.
    pub fn save(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let tmp = self.file.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(&self.data)
            .unwrap_or_else(|_| "{}".to_string());
        fs::write(&tmp, json)?;
        fs::rename(&tmp, &self.file)?;
        Ok(())
    }

    pub fn settings(&self) -> &Settings {
        &self.data.settings
    }

    pub fn timetable(&self) -> &Option<Timetable> {
        &self.data.timetable
    }

    pub fn set_timetable(&mut self, tt: Timetable) {
        self.data.timetable = Some(tt);
        let _ = self.save();
    }

    pub fn set_courses(&mut self, courses: Vec<Course>) {
        self.data.courses = courses;
        let _ = self.save();
    }

    pub fn set_exams(&mut self, exams: Vec<Exam>) {
        self.data.exams = exams;
        let _ = self.save();
    }

    pub fn mark_day(&mut self, date: &str, status: &str) {
        if status.is_empty() || status == "clear" {
            self.data.attendance.remove(date);
        } else {
            self.data.attendance.insert(date.to_string(), status.to_string());
        }
        let _ = self.save();
    }

    /// Mark a single subject on a single day, overriding that day's mark for it.
    /// Clearing the last override for a date removes the (now empty) date entry
    /// so the file never accumulates dead keys.
    pub fn mark_subject(&mut self, date: &str, key: &str, status: &str) {
        if date.is_empty() || key.is_empty() {
            return;
        }
        if status.is_empty() || status == "clear" {
            if let Some(day) = self.data.subject_attendance.get_mut(date) {
                day.remove(key);
                if day.is_empty() {
                    self.data.subject_attendance.remove(date);
                }
            }
        } else {
            self.data
                .subject_attendance
                .entry(date.to_string())
                .or_default()
                .insert(key.to_string(), status.to_string());
        }
        let _ = self.save();
    }

    pub fn add_holiday(&mut self, d: &str) {
        if d.is_empty() {
            return;
        }
        let h = &mut self.data.settings.holidays;
        if !h.iter().any(|x| x == d) {
            h.push(d.to_string());
            h.sort();
            let _ = self.save();
        }
    }

    pub fn remove_holiday(&mut self, d: &str) {
        let h = &mut self.data.settings.holidays;
        if let Some(i) = h.iter().position(|x| x == d) {
            h.remove(i);
            let _ = self.save();
        }
    }

    pub fn data_path(&self) -> String {
        self.file.to_string_lossy().to_string()
    }
}
