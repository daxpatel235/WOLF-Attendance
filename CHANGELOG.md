# Changelog

All notable changes to WOLF Attendance are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [3.1.0] — 2026-07-18
### Removed
- **AI timetable import & the entire bring-your-own-key (BYOK) subsystem.** The
  multi-provider AI parsing (Gemini/OpenAI/Claude/OpenRouter/Mistral/Groq), the
  image/PDF upload flow, and the provider/model/API-key settings are gone. Timetables
  are now built with the **manual builder** — quick, private, and fully offline with
  **no network calls whatsoever**. Dropped the `reqwest` and `regex` crates and deleted
  `providers.rs` and `classify.rs`, shrinking the binary and build.

### Added
- **Analytics page** — an overall-attendance ring, a **GitHub-style attendance heatmap**
  across the whole semester, and per-subject bars with each subject's required-minimum marker.
- **Streaks & gamification** — a current/longest **attendance streak**, an **XP & level**
  system (Cub → Alpha Wolf → Legend) and eight unlockable **badges**.
- **Academics page** — a **CGPA calculator** (10- or 4-point scale), a **"what-if"** grade
  planner (the average grade needed across upcoming credits to hit a target CGPA), and an
  **exam countdown** board with colour-coded time-to-go.
- **Dashboard quick strip** — streak, overall %, level and next-exam countdown at a glance.

## [3.0.0-tauri] — 2026-07-10
### Changed
- **Rewritten on Tauri 2 + Rust** (frontend now React + **TypeScript**). The Electron
  shell and the Node/Express backend were replaced by a native Tauri app whose Rust
  backend is called directly over the Tauri bridge (`invoke`) instead of a localhost
  REST server. All planner, storage and (then) AI logic was ported to Rust; the old
  `main.js`, `server/`, `client/` and `tools/` were removed.
- Installers now built by the Tauri bundler as **NSIS `.exe` + MSI** (was electron-builder).
- On-device data now lives at `%APPDATA%\com.wolf.attendance\data.json`.

### Added
- **First-run onboarding** — a designed welcome screen that collects name, age, email
  and School/College, with the themed background previewing live as you choose.
- **Profile page** — avatar, your details, a "tomorrow is a college/school day" card, your
  current timetable and a history of past ones (the previous timetable is archived on save).
- **School vs College themes** — bold animated backgrounds that adapt to the institution
  type: warm/playful for school, cool/sleek for college (respects reduced-motion).
- **Daily reminders** — an evening notification telling you if tomorrow is a teaching day.
  Runs from a background thread; WOLF lives in the **system tray** (close-to-tray while
  reminders are on) and can **auto-start with Windows** (launching minimized to the tray).
- **Manual timetable builder** — set periods per day, each period's time, the lunch break,
  and lab spans in a guided grid; back-to-back cells of the same subject merge into one
  longer (e.g. lab) session. Plus a directly editable table.
- **Attendance mode** setting — enforce/count **labs + lectures**, **lectures only**, or **labs only**.

## [3.0.0] — 2026-06-08
### Added
- Native desktop app built with **Electron + React (Vite) + Tailwind** and an
  **Express** backend — fast, consistent startup (Electron bundles Chromium).
- **Bring-your-own-key**, multi-provider AI timetable import: Google Gemini,
  OpenAI, Anthropic (Claude), OpenRouter, Mistral, Groq. User picks a provider,
  model and supplies their own key in Settings.
- **Lab-aware** minimum-days algorithm: detects labs (e.g. code `5J1`), applies a
  stricter lab attendance %, weights lab days first, and excludes library/breaks.
- Timetable parsing reads **per-session day + time + code + type**; lab time spans
  convert to period counts.
- Dashboard, monthly calendar (Mon–Sat, colour-coded), per-subject cards with
  progress rings, timetable import/review, and settings with light/dark mode.
- Windows **NSIS installer** (`WOLF-Attendance-Setup.exe`) that lets you choose the
  install folder and creates shortcuts.
- On-device storage at `%APPDATA%\wolf-attendance\data.json` (no cloud).

### Notes
- Earlier prototypes (Node/MongoDB browser app, Python CustomTkinter/PySide6,
  pywebview) were removed in favour of the Electron stack.
