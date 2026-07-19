// Shared shapes mirrored from the Rust backend (serde renames everything to
// camelCase, so these match the JSON returned by the Tauri commands 1:1).

export interface Settings {
  institutionType: string;
  institutionName: string;
  className: string;
  division: string;
  semester: string;
  timetableName: string;
  batchName: string;
  semesterStart: string;
  semesterEnd: string;
  minPercent: number;
  targetPercent: number;
  labPercent: number;
  holidays: string[];
  appearance: string;
  gpaScale: number; // 10 (Indian CGPA) or 4 (US)
  attendanceMode: string; // "both" | "lectures" | "labs"
  // Profile
  firstName: string;
  age: string;
  email: string;
  onboarded: boolean;
  // Reminders (fire from the Rust tray scheduler)
  reminderEnabled: boolean;
  reminderTime: string; // "HH:MM"
  autostartEnabled: boolean;
}

export interface TimetableSnapshot { savedAt: string; timetable: Timetable; }

export interface TtSession { day: string; start: string; end: string; periods?: number; }

export interface TtSubject {
  name: string;
  code: string;
  kind: string;
  color: string;
  schedule: Record<string, number>;
  sessions: TtSession[];
}

export interface Timetable { batchName: string; subjects: TtSubject[]; }

export interface Course { id: string; name: string; credits: number; grade: number; }
export interface Exam { id: string; title: string; subject: string; date: string; done: boolean; }

export interface Meta {
  app: string;
  version: string;
  tagline: string;
  institutionTypes: string[];
  dataPath: string;
}

export interface Banner {
  attendDaysCount: number;
  stayHomeCount: number;
  bufferDaysCount: number;
  futureCollegeDaysCount: number;
  labDaysCount: number;
  todayAction: string;
  minPercent: number;
  targetPercent: number;
  labPercent: number;
}

export interface SubjectCard {
  name: string;
  code: string;
  kind: string;
  color: string;
  totalLectures: number;
  minNeeded: number;
  targetNeeded: number;
  reqPercent: number;
  attendedSoFar: number;
  conducted: number;
  currentPct: number;
  projectedMinPct: number;
  canStillSkipDays: number;
  status: string;
  impossible: boolean;
}

export interface DaySubject { name: string; count: number; color: string; kind: string; }
export interface DaySession { name: string; code: string; kind: string; color: string; start: string; end: string; }

export interface Day {
  date: string;
  weekday: string;
  isPast: boolean;
  isToday: boolean;
  category: string;
  marked: string | null;
  subjects: DaySubject[];
  sessions: DaySession[];
  hasLab: boolean;
  totalLectures: number;
}

export interface Plan {
  ready: boolean;
  message: string;
  banner: Banner | null;
  subjects: SubjectCard[];
  days: Day[];
  feasible: boolean;
}

export interface State {
  ok: boolean;
  error?: string;
  settings: Settings;
  timetable: Timetable | null;
  timetableHistory?: TimetableSnapshot[];
  courses: Course[];
  exams: Exam[];
  plan: Plan;
  today?: string;
  meta: Meta;
}

export interface MarkResponse { ok: boolean; plan: Plan; }
