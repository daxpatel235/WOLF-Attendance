mod commands;
mod config;
mod dateutils;
mod models;
mod planner;
mod storage;

use std::sync::Mutex;
use std::time::Duration;
use storage::Store;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;

type SharedStore = Mutex<Store>;

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            // On-device data dir, e.g. %APPDATA%\<identifier>\data.json on Windows.
            let dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data directory");
            app.manage(Mutex::new(Store::load(dir)));

            // System-tray icon with a small menu.
            let show_i = MenuItem::with_id(app, "show", "Show WOLF", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("WOLF Attendance")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            // When Windows auto-launches us on login, start hidden in the tray.
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }

            // Background reminder scheduler: a plain OS thread that, once a day at
            // the user's chosen time, notifies whether tomorrow is a teaching day.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut last_notified = String::new();
                loop {
                    std::thread::sleep(Duration::from_secs(45));
                    let (enabled, when, today) = {
                        let state = handle.state::<SharedStore>();
                        let s = match state.lock() {
                            Ok(s) => s,
                            Err(_) => continue,
                        };
                        (
                            s.settings().reminder_enabled,
                            s.settings().reminder_time.clone(),
                            dateutils::today_iso(),
                        )
                    };
                    if !enabled || last_notified == today {
                        continue;
                    }
                    let now = chrono::Local::now().format("%H:%M").to_string();
                    if now == when {
                        last_notified = today;
                        let (is_college, body) = {
                            let state = handle.state::<SharedStore>();
                            let s = match state.lock() {
                                Ok(s) => s,
                                Err(_) => continue,
                            };
                            commands::tomorrow_message(&s)
                        };
                        let title = if is_college {
                            "📚 You have classes tomorrow"
                        } else {
                            "😴 Day off tomorrow"
                        };
                        let _ = handle
                            .notification()
                            .builder()
                            .title(title)
                            .body(body)
                            .show();
                    }
                }
            });

            Ok(())
        })
        // Closing the window hides it to the tray only while reminders are on, so
        // the scheduler keeps running in the background.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let keep = window
                    .app_handle()
                    .state::<SharedStore>()
                    .lock()
                    .map(|s| s.settings().reminder_enabled)
                    .unwrap_or(false);
                if keep {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::bootstrap,
            commands::save_settings,
            commands::add_holiday,
            commands::remove_holiday,
            commands::mark_day,
            commands::mark_subject,
            commands::clear_subject_marks,
            commands::save_timetable,
            commands::save_courses,
            commands::save_exams,
            commands::open_external,
            commands::set_autostart,
            commands::test_reminder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
