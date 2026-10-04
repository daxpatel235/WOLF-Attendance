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
        let data = match fs::read_to_string(&file) {
            Ok(txt) => match serde_json::from_str::<Data>(&txt) {
                Ok(d) => d,
                Err(_) => {
                    // Never let a corrupt file be silently overwritten by the
                    // next save: keep a copy the user (or support) can recover.
                    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
                    let backup = data_dir.join(format!("data.corrupt-{stamp}.json"));
                    let _ = fs::copy(&file, &backup);
                    Data::default()
                }
            },
            Err(_) => Data::default(),
        };
        Store {
            dir: data_dir,
            file,
            data,
        }
    }

    /// Atomic write: serialize to `<file>.tmp`, then rename over the target.
    pub fn save(&self) -> std::io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let tmp = self.file.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(&self.data).unwrap_or_else(|_| "{}".to_string());
        fs::write(&tmp, &json)?;
        if fs::rename(&tmp, &self.file).is_err() {
            // On Windows an antivirus / indexer can briefly lock the target and
            // make the rename fail. Fall back to a direct write so the change
            // is not lost, then tidy up the temp file.
            fs::write(&self.file, &json)?;
            let _ = fs::remove_file(&tmp);
        }
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
            self.data
                .attendance
                .insert(date.to_string(), status.to_string());
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

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!(
            "wolf-test-{name}-{}-{}",
            std::process::id(),
            chrono::Local::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = temp_dir("roundtrip");
        let mut s = Store::load(dir.clone());
        s.data.settings.first_name = "Dax".into();
        s.mark_day("2026-01-05", "attended");
        s.mark_subject("2026-01-06", "CS201", "skipped");
        s.add_holiday("2026-01-26");
        s.save().unwrap();

        let again = Store::load(dir.clone());
        assert_eq!(again.settings().first_name, "Dax");
        assert_eq!(again.data.attendance["2026-01-05"], "attended");
        assert_eq!(
            again.data.subject_attendance["2026-01-06"]["CS201"],
            "skipped"
        );
        assert_eq!(again.settings().holidays, vec!["2026-01-26".to_string()]);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn corrupt_file_is_backed_up_not_lost() {
        let dir = temp_dir("corrupt");
        fs::write(dir.join("data.json"), "{ this is not json").unwrap();
        let s = Store::load(dir.clone());
        assert!(!s.settings().onboarded, "falls back to defaults");
        let backups: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with("data.corrupt-"))
            .collect();
        assert_eq!(backups.len(), 1, "the unreadable file must be preserved");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn clearing_last_subject_mark_removes_the_date() {
        let dir = temp_dir("clear");
        let mut s = Store::load(dir.clone());
        s.mark_subject("2026-01-06", "CS201", "attended");
        s.mark_subject("2026-01-06", "CS201", "");
        assert!(!s.data.subject_attendance.contains_key("2026-01-06"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn older_files_missing_new_fields_still_load() {
        let dir = temp_dir("legacy");
        fs::write(
            dir.join("data.json"),
            r#"{"settings":{"semesterStart":"2026-01-05","semesterEnd":"2026-05-30"},"attendance":{}}"#,
        )
        .unwrap();
        let s = Store::load(dir.clone());
        assert_eq!(s.settings().semester_start, "2026-01-05");
        assert_eq!(s.settings().reminder_time, "20:00");
        assert!(s.data.exams.is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
