<div align="center">

<br />

# 🐺 WOLF Attendance

### Attend the minimum. Stay home the rest.

A desktop app that calculates the **fewest college days** you need to attend so that
every subject — lectures **and** labs — stays safely above its attendance requirement.

<br />

[![Version](https://img.shields.io/badge/version-3.0.0-6C4DF6?style=for-the-badge)](CHANGELOG.md) &nbsp; [![Platform](https://img.shields.io/badge/platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#-install) &nbsp; [![License](https://img.shields.io/badge/license-MIT-22C55E?style=for-the-badge)](LICENSE)

[![Offline](https://img.shields.io/badge/privacy-100%25%20offline-EF4444?style=for-the-badge)](#-privacy)

<br />

![Electron](https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9) &nbsp; ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) &nbsp; ![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8) &nbsp; ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) &nbsp; ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

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
- [AI timetable import (BYOK)](#-ai-timetable-import-byok)
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

It's lab-aware, holiday-aware, and runs entirely on your machine. Upload a photo of
your timetable, let AI read it, and get a personal "safe-to-skip" calendar in seconds.

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 🎯 | **Minimum-days planner** | A lab-aware greedy algorithm finds the smallest set of days to attend — everything else is safe to skip. Sundays and holidays never count. |
| 🧪 | **Lab-smart** | Auto-detects labs (e.g. codes like `5J1`), enforces a stricter lab attendance %, prioritises lab days, and ignores library/break slots. |
| 🤖 | **AI timetable import** | Upload a photo/PDF of your timetable and let AI read each session's day, time, code & type. Review before saving — nothing is auto-trusted. |
| 🔑 | **Bring your own key** | Choose **any** provider — Gemini, OpenAI, Claude, OpenRouter, Mistral, Groq — and use your own API key. No keys shipped, no middleman. |
| 🗓 | **Clean dashboard** | Colour-coded monthly calendar (Mon–Sat), per-subject progress rings, and at-a-glance stats. |
| 🌗 | **Light & dark mode** | A premium design system that looks great either way. |
| 🔒 | **Private & offline** | Your data lives on your device. The only network call is the one-time AI import to your chosen provider. |
| 📦 | **One-file installer** | A single Windows `.exe` — no Node, no Python, nothing else to install. |

---

## 📸 Screenshots

> _Drop your images into a `docs/` folder and they'll render here._

<div align="center">

| Dashboard | Monthly Calendar |
|:---:|:---:|
| _`docs/dashboard.png`_ | _`docs/calendar.png`_ |
| **Subject Progress** | **AI Import** |
| _`docs/subjects.png`_ | _`docs/import.png`_ |

</div>

---

## 📦 Install

1. Download and run **`WOLF-Attendance-Setup.exe`**.
2. Choose your install folder — it creates Desktop & Start-Menu shortcuts.
3. That's it. Nothing else needs to be installed on the PC.

> On first launch, open **Settings → AI provider & key**, pick a provider and paste
> your own API key (used only for the one-time timetable import).

---

## 🚀 Usage

```text
1.  Launch WOLF Attendance
2.  Settings  →  enter institution details + your AI provider & API key
3.  Import    →  upload a photo/PDF of your timetable
4.  Review    →  confirm the detected sessions (day · time · code · type)
5.  Dashboard →  see your minimum-days calendar — green = attend, everything else = skip
```

---

## 🤖 AI timetable import (BYOK)

Pick whichever provider you already have a key for. **No key is bundled** with the app.

| Provider | Models | Image | PDF |
|---|---|:---:|:---:|
| **Google Gemini** | `gemini-2.5-flash` & others | ✅ | ✅ |
| **Anthropic (Claude)** | Claude 4.x family | ✅ | ✅ |
| **OpenAI** | GPT vision models | ✅ | ❌ |
| **OpenRouter** | Many, via one key | ✅ | ❌ |
| **Mistral** | Vision models | ✅ | ❌ |
| **Groq** | Vision models | ✅ | ❌ |

> 💡 PDFs are supported on **Gemini** and **Claude**; other providers are image-only.
> Your key is stored locally and used only for the import call.

---

## 🧠 How it works

The planner is a **lab-aware greedy minimum-set algorithm**:

```text
┌──────────────────────────────────────────────────────────────┐
│  1.  Classify every session                                  │
│        • LAB   →  code matches ^[1-8][A-Za-z][0-9]  (e.g. 5J1)│
│        • SKIP  →  library / break / lunch / free slots       │
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

- 📍 **On-device storage** — everything lives at `%APPDATA%\wolf-attendance\data.json`.
- 🌐 **One network call, by you** — the only outbound request is the timetable import
  to the AI provider you chose, with the key you supplied.
- 🚫 **No telemetry, no accounts, no cloud sync.**

---

## 🗂 Project structure

```text
electron-app/
├─ main.js                 Electron main — starts Express on localhost, opens the window
├─ server/                 Express backend (REST /api + serves the built client)
│  ├─ index.js             routes
│  ├─ providers.js         multi-provider AI parsing (BYOK)
│  ├─ planner.js           lab-aware minimum-days algorithm
│  ├─ classify.js          lab detection + library/break exclusion
│  ├─ storage.js           on-device JSON store
│  └─ config.js · dateUtils.js
├─ client/                 React + Vite + Tailwind UI
│  └─ src/  App.jsx · index.css · api.js · main.jsx
└─ tools/                  build helper (7za wrapper for the installer)
```

---

## 🛠 Develop

```bash
npm install            # main deps
npm run build:client   # installs + builds the React UI into client/dist
npm start              # launch the app
```

> 💡 For live UI reload, run `npm run client` (Vite dev server) alongside `npm start`.

---

## 🏗 Build the installer

```bash
npm run dist           # → dist/WOLF-Attendance-Setup-<version>.exe
```

> ⚠️ On a standard (non-admin) Windows account, electron-builder's `winCodeSign`
> step needs symlink privilege. This repo includes a `7za` wrapper fix — see
> [`tools/README.md`](tools/README.md). Or simply enable **Windows Developer Mode**
> and `npm run dist` works directly.

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| 🖥 **Shell** | Electron (bundled Chromium) |
| 🎨 **Frontend** | React + Vite + Tailwind CSS |
| ⚙️ **Backend** | Node.js + Express (runs on localhost) |
| 🤖 **AI import** | Gemini · OpenAI · Claude · OpenRouter · Mistral · Groq (your key) |
| 💾 **Storage** | Local JSON in Electron `userData` |
| 📦 **Packaging** | electron-builder (NSIS installer) |

---

## 🗺 Roadmap

- [x] 🖥 **Windows desktop app** — Electron + React + Express (shipped)
- [x] 🤖 Multi-provider, bring-your-own-key AI import
- [x] 🧪 Lab-aware minimum-days planner
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
