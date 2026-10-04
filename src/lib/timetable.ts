// Pure timetable-editor helpers (kept out of the page so they can be unit-tested).
import type { Timetable } from "../types";

export const MB_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;

export type Slot = { start: string; end: string; lunch: boolean };
export type MSubject = { name: string; code: string; kind: string };
export type Session = { day: string; start: string; end: string; periods: number };
export type Row = { name: string; code: string; kind: string; schedule: Record<string, number>; sessions: Session[] };

/**
 * Turn the editor grid (slot x weekday -> subject index) into the rows the
 * backend stores. Consecutive slots of the same subject become one session;
 * each slot is one period.
 */
export function buildRows(slots: Slot[], subs: MSubject[], grid: (number | null)[][]): Row[] {
  const groups: Record<string, Row> = {}; const order: string[] = [];
  for (let d = 0; d < 6; d++) {
    let i = 0;
    while (i < slots.length) {
      if (slots[i].lunch || grid[i]?.[d] == null) { i++; continue; }
      const subjIdx = grid[i][d] as number; let j = i;
      // Merge only slots that really touch in time, so a free gap between two
      // classes never gets swallowed into one long session.
      while (j + 1 < slots.length && !slots[j + 1].lunch && grid[j + 1]?.[d] === subjIdx && slots[j].end === slots[j + 1].start) j++;
      const sub = subs[subjIdx];
      if (sub && sub.name.trim()) {
        const key = sub.code.trim() ? sub.code.trim().toUpperCase() : sub.name.trim().toLowerCase();
        if (!groups[key]) { groups[key] = { name: sub.name.trim(), code: sub.code.trim(), kind: sub.kind, schedule: {}, sessions: [] }; order.push(key); }
        // A block of consecutive slots counts as one period per slot — never an
        // estimate from clock hours, which undercounts 45/50-minute periods.
        const g = groups[key]; const start = slots[i].start, end = slots[j].end, p = j - i + 1; const dayName = MB_DAYS[d];
        g.schedule[dayName] = (g.schedule[dayName] || 0) + p;
        if (sub.kind === "lab") g.kind = "lab";
        g.sessions.push({ day: dayName, start, end, periods: p });
      }
      i = j + 1;
    }
  }
  return order.map((k) => groups[k]).filter((r) => Object.values(r.schedule).some((v) => v > 0));
}

/**
 * Rebuild the editor (subjects, slots, grid) from a saved timetable, so "Edit"
 * starts from what the student already entered instead of a blank form.
 * Each saved session spans `periods` equal slots.
 */
export function editorFromTimetable(tt: Timetable | null | undefined): { subs: MSubject[]; slots: Slot[]; grid: (number | null)[][] } | null {
  if (!tt?.subjects?.length) return null;
  const subs: MSubject[] = tt.subjects.map((s) => ({ name: s.name, code: s.code, kind: s.kind || "lecture" }));
  type Piece = { start: number; end: number; day: number; sub: number };
  const pieces: Piece[] = [];
  tt.subjects.forEach((sub, si) => {
    for (const sess of sub.sessions || []) {
      const day = MB_DAYS.indexOf(sess.day);
      const a = toMin(sess.start), b = toMin(sess.end);
      if (day < 0 || b <= a) continue;
      const n = Math.max(1, sess.periods || 1);
      const len = (b - a) / n;
      for (let k = 0; k < n; k++) pieces.push({ start: Math.round(a + k * len), end: Math.round(a + (k + 1) * len), day, sub: si });
    }
  });
  if (!pieces.length) return { subs, slots: [], grid: [] };
  const keyOf = (p: { start: number; end: number }) => `${p.start}-${p.end}`;
  const slotMap = new Map<string, { start: number; end: number }>();
  pieces.forEach((p) => slotMap.set(keyOf(p), { start: p.start, end: p.end }));
  const ordered = [...slotMap.values()].sort((x, y) => x.start - y.start || x.end - y.end);
  const index = new Map(ordered.map((o, i) => [keyOf(o), i]));
  const slots: Slot[] = ordered.map((o) => ({ start: toHHMM(o.start), end: toHHMM(o.end), lunch: false }));
  const grid: (number | null)[][] = slots.map(() => Array(6).fill(null));
  pieces.forEach((p) => { grid[index.get(keyOf(p))!][p.day] = p.sub; });
  return { subs, slots, grid };
}

