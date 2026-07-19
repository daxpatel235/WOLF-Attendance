<div align="center">

<br />

# 🐺 WOLF Attendance

### Attend the minimum. Stay home the rest.

A desktop app that calculates the **fewest college days** you need to attend so that
every subject — lectures **and** labs — stays safely above its attendance requirement.

<br />

[![Version](https://img.shields.io/badge/version-3.1.0-6C4DF6?style=for-the-badge)](CHANGELOG.md) &nbsp; [![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#-install) &nbsp; [![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)

[![Offline](https://img.shields.io/badge/privacy-100%25%20offline-EF4444?style=for-the-badge)](#-privacy)

<br />

![Tauri](https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white) &nbsp; ![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white) &nbsp; ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) &nbsp; ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white) &nbsp; ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)

<br />

[**✨ Features**](#-features) · [**📦 Install**](#-install) · [**🚀 Usage**](#-usage) · [**🧠 How it works**](#-how-it-works) · [**🛠 Develop**](#-develop) · [**🗺 Roadmap**](#-roadmap)

</div>

---

## 📑 Table of Contents

- [Why WOLF?](#-why-wolf)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Install](#-install)
- [Usage](#-usage)
- [How it works](#-how-it-works)
- [Privacy](#-privacy)
- [Project structure](#-project-structure)
- [Develop](#-develop)
- [Build the installer](#-build-the-installer)
- [Tech stack](#-tech-stack)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🎯 Why WOLF?

> Most attendance trackers tell you **how much you've attended**.
> WOLF tells you **how little you can attend** — the exact minimum number of days
> to show up so nothing drops below the line.

It's lab-aware, holiday-aware, and runs **entirely on your machine with zero network
calls**. Build your timetable in the guided grid and get a personal "safe-to-skip"
calendar in seconds — plus attendance analytics, streaks, CGPA and exam countdowns.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎯 | **Minimum-days planner** | A lab-aware greedy algorithm finds the smallest set of days to attend — everything else is safe to skip. Sundays and holidays never count. |
| 👋 | **Onboarding & profile** | A friendly first-run setup (name, age, email, school/college) and a profile page with your details, tomorrow's status, and your current + past timetables. |
| 🎨 | **School / College themes** | Bold animated backgrounds that adapt to your institution — warm & playful for school, cool & sleek for college. |
| 🔔 | **Daily reminders** | A tray app that notifies you the evening before whether tomorrow is a college/school day — at a time you choose, even when the window is closed. |
| 🧪 | **Lab-smart** | Auto-detects labs (e.g. codes like `5J1`), enforces a stricter lab attendance %, prioritises lab days, and ignores library/break slots. |
| ✍️ | **Manual timetable builder** | Build your week by hand: set periods/day, each period's time, the lunch break, and lab spans in a guided grid — back-to-back cells of the same subject merge into one longer session. Or edit the table directly. |
| 📊 | **Attendance analytics** | An overall-attendance ring, a **semester-long heatmap**, and per-subject bars with each subject's required-minimum marker. |
| 🔥 | **Streaks & rewards** | A current/longest attendance streak, an **XP & level** system (Cub → Alpha Wolf → Legend), and eight unlockable **badges** to keep you logging. |
| 🎓 | **CGPA & exams** | A **CGPA calculator** (10- or 4-point), a **"what-if"** grade planner, and an **exam countdown** board. |
| ⚖️ | **Count what matters** | Choose whether attendance is enforced for **labs + lectures**, **lectures only**, or **labs only**. |
| 🗓 | **Clean dashboard** | Colour-coded monthly calendar (Mon–Sat), per-subject progress rings, and at-a-glance stats. |
| 🌗 | **Light & dark mode** | A premium design system that looks great either way. |
| 🔒 | **Private & 100% offline** | Your data lives on your device. **No accounts, no cloud, and not a single network request** — WOLF has no online features at all. |
| 📦 | **Native installers** | Ships as a Windows **NSIS `.exe`** and **MSI** — a tiny Rust/Tauri binary, no Node or Chromium bundled. |

---

## 📸 Screenshots

> _Drop your images into a `docs/` folder and they'll render here._

<div align="center">

| Dashboard | Monthly Calendar |
|:---:|:---:|
| _`docs/dashboard.png`_ | _`docs/calendar.png`_ |
| **Analytics & Heatmap** | **Academics (CGPA & Exams)** |
| _`docs/analytics.png`_ | _`docs/academics.png`_ |

</div>

---

## 📦 Install

1. Download and run **`WOLF-Attendance-Setup.exe`**.
2. Choose your install folder — it creates Desktop & Start-Menu shortcuts.
3. That's it. Nothing else needs to be installed on the PC.

> On first launch, a short onboarding collects your name and whether you're at
> school or college. No account, no key, nothing to sign up for.

---

## 🚀 Usage

```text
1.  Launch WOLF Attendance  →  quick onboarding (name · school/college)
2.  Settings   →  institution details, semester dates, target %, attendance mode
3.  Timetable  →  "Build my timetable": set periods & lunch, list subjects, fill the grid
4.  Dashboard  →  your minimum-days calendar — green = attend, everything else = skip
5.  Analytics  →  heatmap, streaks & badges  ·  Academics → CGPA & exam countdown
```

> ⚖️ In **Settings → Count attendance for**, choose whether the planner enforces
> **labs + lectures**, **lectures only**, or **labs only**.

---

## 🧠 How it works

The planner is a **lab-aware greedy minimum-set algorithm**:

```text
┌──────────────────────────────────────────────────────────────┐
│  1.  Read your timetable  →  each subject marked lecture/lab  │
│      in the builder; lunch/breaks are left out of the grid    │
│  2.  Weight lab days ×3  →  they lock in first                │
│  3.  Greedily pick the fewest days that keep EVERY subject    │
│      above its threshold (labs use a stricter % than lectures)│
│  4.  Exclude Sundays & holidays from the count                │
└──────────────────────────────────────────────────────────────┘
```

The result: a calendar where **green days are the only ones you must attend** — and
every subject still finishes safely above its required attendance.

---

## 🔒 Privacy

- 📍 **On-device storage** — everything lives at `%APPDATA%\com.wolf.attendance\data.json`.
- 🌐 **Zero network calls** — WOLF makes no outbound requests at all; there are no online
  features. (The only time anything is downloaded is the one-time WebView2 bootstrap by
  the installer, if your PC doesn't already have it.)
- 🚫 **No telemetry, no accounts, no cloud sync.**

---

## 🗂 Project structure

```text
wolf-attendance/
├─ index.html              Vite entry
├─ src/                    React + TypeScript UI
│  ├─ App.tsx              all views + the manual timetable builder
│  ├─ analytics.ts         pure maths: heatmap, streaks, XP/badges, CGPA
│  ├─ api.ts               data layer — thin wrappers over Tauri `invoke`
│  ├─ types.ts             shared types (mirror the Rust structs)
│  └─ index.css · main.tsx
└─ src-tauri/              Rust backend (Tauri 2)
   ├─ src/
   │  ├─ lib.rs            Tauri builder — manages state, registers commands
   │  ├─ commands.rs       invoke commands (bootstrap, settings, timetable, courses, exams, …)
   │  ├─ planner.rs        lab-aware minimum-days algorithm
   │  ├─ storage.rs        on-device JSON store
   │  ├─ models.rs         serde structs shared with the frontend
   │  └─ config.rs · dateutils.rs
   └─ tauri.conf.json      window + NSIS/MSI bundle config
```

---

## 🛠 Develop

**Prerequisites:** [Node.js](https://nodejs.org) 18+, the [Rust toolchain](https://rustup.rs)
(stable MSVC on Windows), and the WebView2 runtime (preinstalled on Windows 10/11).

```bash
npm install            # frontend deps (React, Vite, Tauri CLI)
npm run tauri dev      # compiles Rust, launches the app with hot-reloaded UI
```

Frontend-only checks:

```bash
npm run typecheck      # tsc --noEmit
npm run build          # type-check + vite build → dist/
```

---

## 🏗 Build the installer

```bash
npm run tauri build    # → src-tauri/target/release/bundle/
                       #    nsis/WOLF Attendance_<version>_x64-setup.exe
                       #    msi/WOLF Attendance_<version>_x64_en-US.msi
```

The NSIS installer lets the user choose the install folder and creates Start-Menu &
Desktop shortcuts; WebView2 is fetched by the bootstrapper if missing.

> ⚠️ **Windows Smart App Control (SAC).** If SAC is **On**, it blocks every locally
> compiled, unsigned executable — including Rust build scripts — so `cargo`/`tauri`
> builds fail with *"An Application Control policy has blocked this file"* (os error
> 4551). Build on a machine (or CI runner) with SAC off, or turn SAC off in
> **Windows Security → App & browser control → Smart App Control**. Note that turning
> SAC off cannot be undone without resetting Windows.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| 🖥 **Shell** | Tauri 2 (native WebView2, tiny Rust binary) |
| 🎨 **Frontend** | React + TypeScript + Vite + Tailwind CSS |
| ⚙️ **Backend** | Rust — commands invoked over the Tauri bridge |
| 🔔 **Reminders** | System tray + `tauri-plugin-notification` + `tauri-plugin-autostart` |
| 📊 **Analytics** | Pure TypeScript over the plan — heatmap, streaks, XP/badges, CGPA (no libraries) |
| 💾 **Storage** | Local JSON in the app data dir |
| 📦 **Packaging** | Tauri bundler — NSIS `.exe` + MSI |

---

## 🗺 Roadmap

- [x] 🖥 **Windows desktop app** — Tauri 2 + React/TypeScript + Rust (shipped)
- [x] ✍️ Manual timetable builder + labs/lectures attendance modes
- [x] 🧪 Lab-aware minimum-days planner
- [x] 📊 Attendance analytics, heatmap, streaks & badges
- [x] 🎓 CGPA "what-if" calculator + exam countdown
- [ ] 📱 **Android app** (planned)
- [ ] 🌓 More themes & calendar export
- [ ] 🍎 iOS — _not planned_

---

## 📄 License

Released under the [MIT License](LICENSE) — © 2026 **Patel**.

<div align="center">

<br />

**Made with 🐺 for students who'd rather sleep in.**

⭐ _If this saved you a few early mornings, give it a star._

</div>
