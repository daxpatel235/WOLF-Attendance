# Changelog

All notable changes to WOLF Attendance are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

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
