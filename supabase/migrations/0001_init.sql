-- WOLF Attendance — initial cloud schema
--
-- Design notes
--  * Every table is owned by a user and protected by Row Level Security, so a
--    leaked anon key still cannot read another student's attendance.
--  * The shape mirrors `wolf-core`'s model deliberately: a subject is identified
--    by its `key` (code if present, else lowercased name), day marks and
--    per-subject marks are separate, and baselines cover the pre-tracking span.
--  * Constraints encode the same invariants the Rust fuzz suite checks, so the
--    database refuses data the planner would consider impossible.

-- ─────────────────────────── types ───────────────────────────

create type mark_kind as enum ('attended', 'skipped', 'cancelled');
create type subject_kind as enum ('lecture', 'lab');
create type attendance_mode as enum ('both', 'lectures', 'labs');

-- ─────────────────────────── helpers ───────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────── profiles ───────────────────────────
-- One row per auth user. Created by the trigger below on sign-up so the client
-- never has to race an insert.

create table profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  first_name       text        not null default '',
  age              text        not null default '',
  email            text        not null default '',
  institution_type text        not null default 'College',
  institution_name text        not null default '',
  class_name       text        not null default '',
  division         text        not null default '',
  batch_name       text        not null default '',
  onboarded        boolean     not null default false,
  appearance       text        not null default 'dark',
  gpa_scale        numeric(5,2) not null default 10 check (gpa_scale between 1 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────── semesters ───────────────────────────
-- Targets and dates live per-semester rather than on the profile, so a student
-- keeps their history when a new term starts.

create table semesters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null default '',
  label           text not null default '',           -- e.g. "Sem 4"
  start_date      date not null,
  end_date        date not null,
  min_percent     numeric(5,2) not null default 75 check (min_percent between 0 and 100),
  target_percent  numeric(5,2) not null default 80 check (target_percent between 0 and 100),
  lab_percent     numeric(5,2) not null default 75 check (lab_percent between 0 and 100),
  attendance_mode attendance_mode not null default 'both',
  -- Empty tracking_start => WOLF owns the whole semester (legacy behaviour).
  tracking_start  date,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint semester_dates_ordered check (start_date <= end_date),
  constraint tracking_start_within_semester
    check (tracking_start is null
           or (tracking_start >= start_date and tracking_start <= end_date))
);

create index semesters_user_idx on semesters (user_id);
-- At most one active semester per user.
create unique index semesters_one_active
  on semesters (user_id) where is_active;

create trigger semesters_updated_at
  before update on semesters
  for each row execute function set_updated_at();

-- ─────────────────────────── holidays ───────────────────────────

create table holidays (
  semester_id uuid not null references semesters (id) on delete cascade,
  date        date not null,
  label       text not null default '',
  primary key (semester_id, date)
);

-- ─────────────────────────── timetable ───────────────────────────

create table timetables (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  semester_id uuid not null references semesters (id) on delete cascade,
  batch_name  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index timetables_semester_idx on timetables (semester_id);

create trigger timetables_updated_at
  before update on timetables
  for each row execute function set_updated_at();

create table subjects (
  id           uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables (id) on delete cascade,
  -- Stable identity: subject code uppercased, else lowercased name.
  -- Unique per timetable, which is exactly what stops two subjects sharing a
  -- display name from silently merging.
  key          text not null check (length(trim(key)) > 0),
  name         text not null check (length(trim(name)) > 0),
  code         text not null default '',
  kind         subject_kind not null default 'lecture',
  color        text not null default '#6B6560',

  unique (timetable_id, key)
);

create index subjects_timetable_idx on subjects (timetable_id);

-- How many periods of this subject fall on each weekday.
create table subject_schedule (
  subject_id uuid not null references subjects (id) on delete cascade,
  -- ISO-8601: 1 = Monday … 7 = Sunday.
  weekday    smallint not null check (weekday between 1 and 7),
  periods    integer  not null default 0 check (periods >= 0),
  primary key (subject_id, weekday)
);

-- Timed sessions, used to render the day view.
create table subject_sessions (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time   time not null,

  constraint session_times_ordered check (start_time < end_time)
);

create index subject_sessions_subject_idx on subject_sessions (subject_id);

-- ─────────────────────────── baselines ───────────────────────────
-- Attendance accrued before `semesters.tracking_start`. Keyed by subject key
-- rather than subject id so a timetable edit never orphans the student's
-- reported history.

create table baselines (
  semester_id uuid not null references semesters (id) on delete cascade,
  subject_key text not null,
  conducted   integer not null check (conducted >= 0),
  attended    integer not null check (attended >= 0),
  primary key (semester_id, subject_key),

  -- You cannot attend more classes than were held.
  constraint attended_not_over_conducted check (attended <= conducted)
);

-- ─────────────────────────── attendance ───────────────────────────

-- Whole-day marks.
create table day_marks (
  semester_id uuid not null references semesters (id) on delete cascade,
  date        date not null,
  mark        mark_kind not null,
  updated_at  timestamptz not null default now(),
  primary key (semester_id, date)
);

create trigger day_marks_updated_at
  before update on day_marks
  for each row execute function set_updated_at();

-- Per-subject overrides. Beats the whole-day mark for that one subject, which
-- is what makes "went to DS, skipped Physics on Tuesday" representable.
create table subject_marks (
  semester_id uuid not null references semesters (id) on delete cascade,
  date        date not null,
  subject_key text not null,
  mark        mark_kind not null,
  updated_at  timestamptz not null default now(),
  primary key (semester_id, date, subject_key)
);

create index subject_marks_date_idx on subject_marks (semester_id, date);

create trigger subject_marks_updated_at
  before update on subject_marks
  for each row execute function set_updated_at();

-- ─────────────────────────── academics ───────────────────────────

create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  semester_id uuid references semesters (id) on delete set null,
  name        text not null default '',
  credits     numeric(6,2) not null default 0 check (credits >= 0),
  grade       numeric(6,2) not null default 0 check (grade >= 0)
);

create index courses_user_idx on courses (user_id);

create table exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  semester_id uuid references semesters (id) on delete set null,
  title       text not null default '',
  subject     text not null default '',
  date        date,
  done        boolean not null default false
);

create index exams_user_idx on exams (user_id);

-- ─────────────────────────── row level security ───────────────────────────
-- Default deny. Tables that hang off a semester are reached through a subquery
-- on `semesters.user_id`, so ownership is enforced in exactly one place.

alter table profiles         enable row level security;
alter table semesters        enable row level security;
alter table holidays         enable row level security;
alter table timetables       enable row level security;
alter table subjects         enable row level security;
alter table subject_schedule enable row level security;
alter table subject_sessions enable row level security;
alter table baselines        enable row level security;
alter table day_marks        enable row level security;
alter table subject_marks    enable row level security;
alter table courses          enable row level security;
alter table exams            enable row level security;

create policy own_profile on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy own_semesters on semesters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_timetables on timetables
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_courses on courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy own_exams on exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Semester-scoped tables.
create policy own_holidays on holidays
  for all using (exists (select 1 from semesters s
                          where s.id = holidays.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from semesters s
                       where s.id = holidays.semester_id and s.user_id = auth.uid()));

create policy own_baselines on baselines
  for all using (exists (select 1 from semesters s
                          where s.id = baselines.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from semesters s
                       where s.id = baselines.semester_id and s.user_id = auth.uid()));

create policy own_day_marks on day_marks
  for all using (exists (select 1 from semesters s
                          where s.id = day_marks.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from semesters s
                       where s.id = day_marks.semester_id and s.user_id = auth.uid()));

create policy own_subject_marks on subject_marks
  for all using (exists (select 1 from semesters s
                          where s.id = subject_marks.semester_id and s.user_id = auth.uid()))
  with check (exists (select 1 from semesters s
                       where s.id = subject_marks.semester_id and s.user_id = auth.uid()));

-- Timetable-scoped tables.
create policy own_subjects on subjects
  for all using (exists (select 1 from timetables t
                          where t.id = subjects.timetable_id and t.user_id = auth.uid()))
  with check (exists (select 1 from timetables t
                       where t.id = subjects.timetable_id and t.user_id = auth.uid()));

create policy own_subject_schedule on subject_schedule
  for all using (exists (select 1 from subjects sub
                          join timetables t on t.id = sub.timetable_id
                          where sub.id = subject_schedule.subject_id and t.user_id = auth.uid()))
  with check (exists (select 1 from subjects sub
                       join timetables t on t.id = sub.timetable_id
                       where sub.id = subject_schedule.subject_id and t.user_id = auth.uid()));

create policy own_subject_sessions on subject_sessions
  for all using (exists (select 1 from subjects sub
                          join timetables t on t.id = sub.timetable_id
                          where sub.id = subject_sessions.subject_id and t.user_id = auth.uid()))
  with check (exists (select 1 from subjects sub
                       join timetables t on t.id = sub.timetable_id
                       where sub.id = subject_sessions.subject_id and t.user_id = auth.uid()));
