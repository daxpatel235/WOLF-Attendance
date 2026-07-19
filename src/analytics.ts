// Pure, dependency-free analytics derived from the plan the Rust backend returns.
// Everything here is frontend-only maths over data we already have, so no extra
// round-trips are needed for the heatmap, streaks, gamification or GPA views.
import type { Plan, Course } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// ---- Overall attendance ---------------------------------------------------
export interface OverallStats {
  conducted: number;
  attended: number;
  pct: number;
  safe: number;
  warning: number;
  danger: number;
  subjects: number;
}

export function overallStats(plan: Plan): OverallStats {
  let conducted = 0, attended = 0, safe = 0, warning = 0, danger = 0;
  for (const s of plan.subjects || []) {
    conducted += s.conducted;
    attended += s.attendedSoFar;
    if (s.status === "safe") safe++;
    else if (s.status === "warning") warning++;
    else danger++;
  }
  const pct = conducted > 0 ? Math.round((attended / conducted) * 1000) / 10 : 100;
  return { conducted, attended, pct, safe, warning, danger, subjects: (plan.subjects || []).length };
}

// ---- Marking / attendance streak -----------------------------------------
export interface StreakInfo { current: number; longest: number; attendedDays: number; loggedDays: number; }

// Past teaching days in date order; a "hit" is a day attended (unmarked past days
// count as attended, matching the planner). Skipped days break the streak.
export function streakInfo(plan: Plan): StreakInfo {
  const past = (plan.days || [])
    .filter((d) => d.isPast && d.category !== "holiday" && d.totalLectures > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0, run = 0, current = 0, attendedDays = 0, loggedDays = 0;
  for (const d of past) {
    const attended = d.category !== "past-skipped" && d.marked !== "skipped";
    if (d.marked) loggedDays++;
    if (attended) { attendedDays++; run++; if (run > longest) longest = run; }
    else run = 0;
  }
  // Current streak = trailing run up to the most recent past teaching day.
  for (let i = past.length - 1; i >= 0; i--) {
    const attended = past[i].category !== "past-skipped" && past[i].marked !== "skipped";
    if (attended) current++; else break;
  }
  return { current, longest, attendedDays, loggedDays };
}

// ---- XP / level -----------------------------------------------------------
export interface LevelInfo { xp: number; level: number; title: string; intoLevel: number; span: number; }
const TITLES = ["Cub", "Pup", "Scout", "Tracker", "Hunter", "Pack Leader", "Alpha Wolf", "Legend"];

export function levelInfo(stats: OverallStats, streak: StreakInfo): LevelInfo {
  // Reward attending, keeping a streak, and every subject that stays safe.
  const xp = Math.round(
    streak.attendedDays * 10 + streak.longest * 6 + stats.safe * 40 + Math.max(0, stats.pct - 60) * 3
  );
  let level = 1, need = 140, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need = Math.round(need * 1.25); }
  return { xp, level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], intoLevel: xp - acc, span: need };
}

// ---- Badges ---------------------------------------------------------------
export interface Badge { icon: string; label: string; desc: string; earned: boolean; }

export function badges(plan: Plan, stats: OverallStats, streak: StreakInfo, targetPct: number): Badge[] {
  const labSubs = (plan.subjects || []).filter((s) => s.kind === "lab");
  const labsSafe = labSubs.length > 0 && labSubs.every((s) => s.status === "safe");
  return [
    { icon: "🌱", label: "First Steps", desc: "Log or attend your first day", earned: streak.attendedDays >= 1 },
    { icon: "🔥", label: "On a Roll", desc: "7-day attendance streak", earned: streak.current >= 7 || streak.longest >= 7 },
    { icon: "💪", label: "Iron Will", desc: "30-day attendance streak", earned: streak.longest >= 30 },
    { icon: "🎯", label: "On Target", desc: `Overall ≥ ${Math.round(targetPct)}%`, earned: stats.pct >= targetPct },
    { icon: "🏆", label: "90 Club", desc: "Overall attendance ≥ 90%", earned: stats.pct >= 90 },
    { icon: "🧪", label: "Lab Master", desc: "Every lab in the safe zone", earned: labsSafe },
    { icon: "🟢", label: "All Clear", desc: "Every subject in the safe zone", earned: stats.subjects > 0 && stats.danger === 0 && stats.warning === 0 },
    { icon: "📅", label: "Committed", desc: "Log 20 days of attendance", earned: streak.loggedDays >= 20 },
  ];
}

// ---- Heatmap (GitHub-style, weeks as columns, Sun..Sat rows) --------------
export interface HeatCell { date: string; cls: string; count: number; isToday: boolean; }

export function heatWeeks(plan: Plan, startIso: string, endIso: string, todayIso: string): HeatCell[][] {
  if (!startIso || !endIso) return [];
  const byDate: Record<string, Plan["days"][number]> = {};
  (plan.days || []).forEach((d) => (byDate[d.date] = d));
  const start = parseIso(startIso), end = parseIso(endIso);
  // Back up to the Sunday on/before the start date.
  const cur = new Date(start);
  cur.setDate(cur.getDate() - cur.getDay());
  const weeks: HeatCell[][] = [];
  let guard = 0;
  while (cur <= end && guard < 80) {
    const week: HeatCell[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = isoOf(cur.getFullYear(), cur.getMonth(), cur.getDate());
      const inRange = cur >= start && cur <= end;
      let cls = "off";
      let count = 0;
      if (inRange) {
        const info = byDate[iso];
        if (!info) cls = "off"; // Sundays have no plan day
        else {
          count = info.totalLectures;
          cls = heatClass(info.category);
        }
      } else cls = "out";
      week.push({ date: iso, cls, count, isToday: iso === todayIso });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    guard++;
  }
  return weeks;
}

function heatClass(category: string): string {
  switch (category) {
    case "past-attended": return "att";
    case "attend": return "att";
    case "past-skipped": return "miss";
    case "skip-forced": return "miss";
    case "holiday": return "hol";
    case "required": return "plan";
    case "buffer": return "plan";
    default: return "free"; // skip / no-class weekday
  }
}

// ---- GPA / CGPA -----------------------------------------------------------
export interface GpaResult { cgpa: number; credits: number; points: number; }

export function cgpa(courses: Course[]): GpaResult {
  let credits = 0, points = 0;
  for (const c of courses) {
    if (c.credits > 0) { credits += c.credits; points += c.credits * c.grade; }
  }
  return { cgpa: credits > 0 ? Math.round((points / credits) * 1000) / 1000 : 0, credits, points };
}

// Average grade needed across `addCredits` more credits to reach `target` CGPA.
export function requiredGrade(cur: GpaResult, addCredits: number, target: number): number | null {
  if (addCredits <= 0) return null;
  const needed = (target * (cur.credits + addCredits) - cur.points) / addCredits;
  return Math.round(needed * 100) / 100;
}

// ---- Exam countdown -------------------------------------------------------
export function daysUntil(iso: string, todayIso: string): number | null {
  if (!iso || !todayIso) return null;
  const a = parseIso(todayIso), b = parseIso(iso);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
