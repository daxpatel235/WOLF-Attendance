# Cloud backend — setup

The schema in `migrations/0001_init.sql` is ready to apply. It creates 12 tables,
3 enums, and Row Level Security on every table, so a leaked anon key still cannot
read another student's data.

## What you need to do (about 10 minutes)

1. **Create the project** at [supabase.com](https://supabase.com) → New project.
   Pick a region close to your users (`ap-south-1` / Mumbai for India).
   Save the database password somewhere safe — it is shown once.

2. **Apply the schema.** Dashboard → SQL Editor → New query → paste the whole of
   `migrations/0001_init.sql` → Run. It should report success with no rows.

   Or, with the Supabase CLI:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Turn on the providers.** Authentication → Providers:
   - **Email** is on by default. Decide whether to require email confirmation.
   - **Google** and **GitHub** each need an OAuth app; paste the client ID/secret
     into Supabase and copy Supabase's callback URL back into the provider.
     The login UI already has buttons for both.

4. **Copy the keys** from Settings → API into a local `.env` (never commit it):
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
   The anon key is designed to be public — RLS is what protects the data. The
   `service_role` key is **not** safe to ship in a client; keep it server-side only.

## Verifying RLS actually works

Worth doing once, because a policy mistake is invisible until it isn't. Create two
accounts, add a semester on each, then from account A run:

```sql
select * from semesters;
```

You must see only A's rows. If you see B's, stop and re-check the policies before
putting real data in.

## Schema shape

Mirrors `wolf-core`'s model so the planner needs no translation layer:

| Table | Holds |
|---|---|
| `profiles` | identity, institution, appearance (1:1 with `auth.users`) |
| `semesters` | dates, min/target/lab percentages, attendance mode, tracking start |
| `holidays` | non-teaching dates per semester |
| `timetables` → `subjects` → `subject_schedule` / `subject_sessions` | the weekly plan |
| `baselines` | attendance accrued *before* `tracking_start` (mid-semester adoption) |
| `day_marks` | whole-day attended / skipped / cancelled |
| `subject_marks` | per-subject overrides that beat the day mark |
| `courses`, `exams` | academics |

Two deliberate choices:

- **Subjects are identified by `key`** (code uppercased, else lowercased name),
  unique per timetable. This is the same identity `wolf-core` uses, and it is what
  stops two subjects sharing a display name from silently merging.
- **`baselines` and `subject_marks` reference `subject_key`, not `subject_id`.**
  Editing or re-importing a timetable therefore never orphans the attendance a
  student has already reported.

Constraints encode the same invariants the Rust fuzz suite checks — for example
`attended <= conducted` on baselines, and percentages bounded to 0–100 — so the
database rejects data the planner would treat as impossible.

## Not done yet

- No migration path from local `data.json` → cloud on first sign-in (roadmap
  Phase 1). Existing desktop users would start empty today.
- `src/api.ts` still talks to Tauri `invoke`; the HTTP driver is the next piece.
- The planner still runs client/desktop-side. Running `wolf-core` server-side is
  what makes the web client work without shipping the algorithm to the browser.
