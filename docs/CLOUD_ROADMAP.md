# WOLF Attendance — Cloud Roadmap

Moving from an offline-first desktop app to a **cloud-native, multi-device product** —
without losing what makes WOLF good (the minimum-days planner and a fast, private-feeling UX).

---

## 0. The core decision

Today WOLF is a **Tauri desktop app**: a Rust backend computes the attendance plan and
stores everything in local JSON. "Fully cloud" means: **accounts + a hosted API + a database +
sync**, with web / mobile / desktop clients all talking to the same backend.

**Biggest lever:** the planner/classify/config logic already lives in Rust (`src-tauri/src/`).
Extract it into a shared crate (`wolf-core`) and run it **server-side** — you reuse the hardest,
most-tested code instead of rewriting it. Optionally compile the same crate to **WASM** so clients
can plan instantly offline and sync later.

### ⚠️ Privacy is a first-class decision, not an afterthought
WOLF's identity has been "100% private, runs on your device." Cloud changes that story. Decide
early and be transparent:
- [ ] Keep a **"local-only" mode** toggle (no account, data never leaves device) as a first-class option
- [ ] Encrypt data at rest + in transit; consider client-side encryption for sensitive fields
- [ ] Write a real **privacy policy + terms**; make cloud sync **opt-in**
- [ ] GDPR/DPDP basics: export my data, delete my account, data-residency choice
- [ ] Minimize what you store; never sell/share; document the data model publicly

---

## 1. Recommended stack (solo-dev friendly, cheap to start)

| Layer | Recommendation | Why |
|---|---|---|
| Core logic | `wolf-core` Rust crate (extracted from `src-tauri`) | Reuse the planner on server + (WASM) client |
| API | **Rust + Axum** on Fly.io / Railway / Render | Reuses `wolf-core`; fast; cheap |
| Database | **Postgres** via Supabase or Neon | Relational fits timetable/marks; free tier |
| Auth | **Supabase Auth** or **Clerk** | Google + GitHub already in the login UI |
| File storage | Supabase Storage / S3 | AI timetable image/PDF uploads, avatars |
| Realtime/sync | Supabase Realtime or WebSockets | Multi-device live updates |
| Background jobs | Cron/queue worker (Fly Machine / Supabase cron) | Reminders, notifications, digests |
| Web hosting | Vercel / Cloudflare Pages (+ PWA) | The existing React app ships as-is |
| Clients | Web (primary) + Tauri desktop (thin client) + PWA/Tauri-mobile | One frontend, many surfaces |

> **Fast path:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions) for everything,
> with a tiny Rust `wolf-core` service on Fly that the API calls for planning. Ship in weeks, not months.

---

## 2. New features the cloud unlocks

### Accounts & sync
- Real accounts (email + Google + GitHub — login UI already built)
- Multi-device sync: desktop ↔ web ↔ phone, always current
- Automatic cloud backup + restore ("never lose your timetable")

### Notifications & reminders (server-driven, work even when the app is closed)
- Web push, mobile push, email, and a **WhatsApp/Telegram bot**
- Smart alerts: *"Attend today or you'll drop below 75% in Physics"*, *"last safe skip used"*,
  morning "today's plan", exam countdowns
- Replaces the current local Rust tray scheduler with a cloud scheduler

### Social & gamification
- Opt-in **class / friends leaderboards** (streaks, XP)
- Streak challenges, shareable achievement cards
- **Server-authoritative** XP/badges (no local tampering)

### Sharing & collaboration
- **Shared timetables**: a class rep publishes once; classmates import by code/link
- Section/batch **template library**
- Optional teacher/CR "official timetable" + per-institution holiday calendar

### AI features
- **AI timetable import**: photo/PDF/screenshot → structured timetable (LLM vision)
- **AI assistant**: *"Can I skip Friday and still stay safe?"* natural-language planning
- AI study planner from exam dates + syllabus; AI insights ("your Tuesdays are risky")

### Integrations
- **Google Calendar** 2-way sync + `.ics` subscribe/export
- Auto-fetch institution/region holiday calendars
- (Later) Google Classroom / LMS import

### Analytics & platform
- **Cross-semester** history & trends (today it's single-semester)
- Predictive attendance ("at this pace you'll finish at 79%")
- Anonymous cohort benchmarks
- **PWA / mobile app**, public achievement profile (opt-in), admin/teacher portal

---

## 3. Improving *current* features at cloud level

- **Timetable** → cloud store + version history + shared templates + AI import
- **Attendance marking** → offline-first sync with conflict resolution; "official vs self-reported"; bulk mark
- **Planner** → runs server-side, cached; **"what-if" simulations**; multi-semester
- **Calendar** → Google Calendar sync; auto holidays; reminder hooks
- **Gamification** → server-authoritative XP/badges + leaderboards + pushed unlocks
- **Reminders** → cloud scheduler, multi-channel (currently local-only)
- **Exams / CGPA** → synced; shared exam schedules; transcript/PDF export
- **Profile/Settings** → cloud profile, avatar upload, theme/mode synced across devices

---

## 4. Task list — phased roadmap

### Phase 0 — Foundations & decisions
- [ ] Choose stack (Supabase-fast vs Rust-Axum-control) and hosting regions
- [ ] Extract `wolf-core` Rust crate (planner, classify, config, models) from `src-tauri`
- [ ] Design the **data model / schema** (users, profiles, institutions, timetables, sessions, marks, exams, courses, badges, devices)
- [ ] Define the **API contract** (OpenAPI): auth, settings, timetable CRUD, mark day, get plan, exams, courses
- [ ] Decide sync strategy (server-authoritative + offline queue) and conflict rules
- [ ] Set up repos/CI, environments (dev/staging/prod), secrets management

### Phase 1 — Cloud MVP (auth + data in the cloud)
- [ ] Stand up Postgres + run migrations; Row-Level Security so users only see their data
- [ ] Auth: email + Google + GitHub; wire the existing Login/Onboarding to real auth
- [ ] API endpoints for settings, timetable, marks, exams, courses (replace Tauri `invoke` calls)
- [ ] Server-side **planner endpoint** using `wolf-core`; cache computed plans
- [ ] Refactor frontend `src/api.ts` to talk to the cloud API (keep the localStorage mock for dev)
- [ ] Migrate existing local users' JSON → cloud on first sign-in
- [ ] Ship the web build (Vercel/Cloudflare) + keep desktop as a thin client

### Phase 2 — Notifications & offline-first
- [ ] Background worker + scheduler (cron/queue)
- [ ] Push (web + mobile), email; opt-in preferences per channel
- [ ] Smart alert rules engine (risk thresholds, morning plan, exam countdown)
- [ ] Offline-first sync: local cache + mutation queue + conflict resolution
- [ ] Retire the local Rust tray scheduler in favor of the cloud one (or make it a fallback)

### Phase 3 — Sharing & AI
- [ ] Shared timetables (publish → import by code/link); template library
- [ ] File uploads (Storage) for AI import
- [ ] AI timetable import (LLM vision) → structured timetable + confirm/edit step
- [ ] AI assistant endpoint (natural-language "can I skip X?") over `wolf-core`
- [ ] AI study planner from exams/syllabus

### Phase 4 — Social, mobile, integrations
- [ ] Opt-in leaderboards + streak challenges (privacy controls)
- [ ] Google Calendar 2-way sync + `.ics` export
- [ ] Auto holiday calendars by institution/region
- [ ] PWA polish / Tauri-mobile build; app-store prep
- [ ] Public profile / shareable achievement cards

### Phase 5 — Scale, security, launch
- [ ] Rate limiting, input validation, abuse/anti-cheat on gamification
- [ ] Observability (logs, metrics, error tracking, uptime)
- [ ] Load test the planner endpoint; add caching/queues where needed
- [ ] Backups + disaster recovery; data export/delete flows (GDPR)
- [ ] Billing (if monetizing): free vs pro tiers, Stripe
- [ ] Docs, onboarding, marketing site, beta → public launch

---

## 5. Cross-cutting (do these continuously)
- [ ] **Security:** RLS everywhere, least-privilege keys, secrets rotation, dependency audits
- [ ] **Privacy/compliance:** privacy policy, opt-in, export/delete, encryption, local-only mode
- [ ] **DevOps:** CI/CD, migrations, staging, feature flags, rollbacks
- [ ] **Cost control:** stay on free tiers early; watch DB/egress/AI spend; cache aggressively
- [ ] **Testing:** unit tests for `wolf-core`, contract tests for the API, e2e for critical flows
- [ ] **Accessibility & performance:** keep the redesigned UX fast (60fps) and a11y-clean

---

## 6. Suggested first three moves
1. **Extract `wolf-core`** — decouple the planner from Tauri so it can run anywhere.
2. **Pick Supabase (or Neon+Clerk)** and model the schema + turn on auth.
3. **Swap `src/api.ts`** from Tauri `invoke` to real HTTP calls behind a feature flag — the whole
   redesigned frontend then works as a cloud web app on day one.
