import { describe, expect, it } from "vitest";
import { overallStats, streakInfo, levelInfo, daysUntil, cgpa, requiredGrade, heatWeeks } from "./analytics";
import type { Day, Plan, SubjectCard } from "./types";

const day = (date: string, category: string, extra: Partial<Day> = {}): Day => ({
  date, weekday: "", isPast: true, isToday: false, category, marked: null,
  subjects: [], sessions: [], hasLab: false, totalLectures: 2, ...extra,
});
const card = (status: string, conducted: number, attended: number): SubjectCard => ({
  key: status + conducted, name: "S", code: "", kind: "lecture", color: "#000", totalLectures: 40,
  minNeeded: 30, targetNeeded: 34, reqPercent: 75, attendedSoFar: attended, conducted,
  currentPct: 0, projectedMinPct: 0, canStillSkipDays: 0, status, impossible: false,
});
const plan = (p: Partial<Plan>): Plan => ({ ready: true, message: "", banner: null, subjects: [], days: [], feasible: true, ...p });

describe("overallStats", () => {
  it("aggregates conducted/attended and statuses", () => {
    const s = overallStats(plan({ subjects: [card("safe", 10, 9), card("warning", 10, 6), card("danger", 0, 0)] }));
    expect(s).toMatchObject({ conducted: 20, attended: 15, pct: 75, safe: 1, warning: 1, danger: 1, subjects: 3 });
  });
  it("is 100% with nothing conducted yet", () => {
    expect(overallStats(plan({})).pct).toBe(100);
  });
});

describe("streakInfo", () => {
  it("breaks on skipped days and ignores pre-tracking days", () => {
    const s = streakInfo(plan({
      days: [
        day("2026-01-01", "pre-tracking"),
        day("2026-01-05", "past-attended"),
        day("2026-01-06", "past-skipped", { marked: "skipped" }),
        day("2026-01-07", "past-attended", { marked: "attended" }),
        day("2026-01-08", "past-attended"),
        day("2026-01-09", "holiday"),
      ],
    }));
    expect(s).toEqual({ current: 2, longest: 2, attendedDays: 3, loggedDays: 2 });
  });
});

describe("levelInfo", () => {
  it("starts at level 1 and progresses", () => {
    const zero = levelInfo(overallStats(plan({})), { current: 0, longest: 0, attendedDays: 0, loggedDays: 0 });
    expect(zero.level).toBeGreaterThanOrEqual(1);
    const lots = levelInfo(overallStats(plan({})), { current: 50, longest: 50, attendedDays: 100, loggedDays: 0 });
    expect(lots.level).toBeGreaterThan(zero.level);
    expect(lots.intoLevel).toBeLessThan(lots.span);
  });
});

describe("dates & GPA", () => {
  it("counts calendar days without timezone drift", () => {
    expect(daysUntil("2026-03-30", "2026-03-28")).toBe(2); // spans a DST change in many zones
    expect(daysUntil("2026-01-01", "2026-01-05")).toBe(-4);
    expect(daysUntil("", "2026-01-05")).toBeNull();
  });
  it("computes CGPA and the grade needed", () => {
    const r = cgpa([{ id: "1", name: "A", credits: 4, grade: 9 }, { id: "2", name: "B", credits: 0, grade: 2 }, { id: "3", name: "C", credits: 2, grade: 6 }]);
    expect(r).toEqual({ cgpa: 8, credits: 6, points: 48 });
    expect(requiredGrade(r, 6, 8.5)).toBe(9);
    expect(requiredGrade(r, 0, 9)).toBeNull();
  });
  it("lays the heatmap out in whole weeks", () => {
    const weeks = heatWeeks(plan({ days: [day("2026-01-05", "required")] }), "2026-01-05", "2026-01-31", "2026-01-05");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().find((c) => c.date === "2026-01-05")?.cls).toBe("plan");
  });
});
