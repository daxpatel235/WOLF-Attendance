import { describe, expect, it } from "vitest";
import { buildRows, editorFromTimetable, toHHMM, toMin, type Slot, type MSubject } from "./timetable";
import type { Timetable } from "../types";

const slotsOf = (start: string, len: number, n: number): Slot[] =>
  Array.from({ length: n }, (_, i) => ({ start: toHHMM(toMin(start) + i * len), end: toHHMM(toMin(start) + (i + 1) * len), lunch: false }));
const emptyGrid = (rows: number) => Array.from({ length: rows }, () => Array<number | null>(6).fill(null));

describe("time helpers", () => {
  it("round-trips HH:MM", () => {
    expect(toMin("09:45")).toBe(585);
    expect(toHHMM(585)).toBe("09:45");
    expect(toHHMM(24 * 60 + 5)).toBe("00:05");
  });
});

describe("buildRows", () => {
  const subs: MSubject[] = [
    { name: "Data Structures", code: "CS201", kind: "lecture" },
    { name: "Physics Lab", code: "", kind: "lab" },
  ];

  it("counts one period per slot even with 45-minute periods", () => {
    // Regression: periods used to be estimated from clock hours, so a
    // 3 x 45-minute lab (135 min) was saved as only 2 periods.
    const slots = slotsOf("09:00", 45, 4);
    const grid = emptyGrid(4);
    grid[0][1] = 1; grid[1][1] = 1; grid[2][1] = 1; // Tuesday: 3-slot lab
    grid[3][0] = 0; // Monday last slot: one lecture
    const rows = buildRows(slots, subs, grid);
    const lab = rows.find((r) => r.name === "Physics Lab")!;
    expect(lab.schedule.Tuesday).toBe(3);
    expect(lab.sessions).toEqual([{ day: "Tuesday", start: "09:00", end: "11:15", periods: 3 }]);
    expect(rows.find((r) => r.code === "CS201")!.schedule.Monday).toBe(1);
  });

  it("does not merge across a lunch slot", () => {
    const slots = slotsOf("09:00", 60, 3);
    slots[1].lunch = true;
    const grid = emptyGrid(3);
    grid[0][0] = 0; grid[1][0] = 0; grid[2][0] = 0;
    const [row] = buildRows(slots, subs, grid);
    expect(row.schedule.Monday).toBe(2);
    expect(row.sessions).toHaveLength(2);
  });

  it("skips unnamed subjects and returns nothing for an empty grid", () => {
    expect(buildRows(slotsOf("09:00", 60, 2), subs, emptyGrid(2))).toEqual([]);
    const grid = emptyGrid(1); grid[0][0] = 0;
    expect(buildRows(slotsOf("09:00", 60, 1), [{ name: "  ", code: "", kind: "lecture" }], grid)).toEqual([]);
  });
});

describe("editorFromTimetable", () => {
  it("returns null when there is nothing saved", () => {
    expect(editorFromTimetable(null)).toBeNull();
    expect(editorFromTimetable({ batchName: "", subjects: [] })).toBeNull();
  });

  it("rebuilds the grid so saving again produces the same timetable", () => {
    const slots = slotsOf("08:30", 50, 5);
    const subs: MSubject[] = [
      { name: "Maths", code: "MTH1", kind: "lecture" },
      { name: "Chem Lab", code: "CHL", kind: "lab" },
    ];
    const grid = emptyGrid(5);
    grid[0][0] = 0; grid[1][2] = 1; grid[2][2] = 1; grid[4][5] = 0;
    const rows = buildRows(slots, subs, grid);
    const saved: Timetable = {
      batchName: "B2",
      subjects: rows.map((r, i) => ({ ...r, color: `#00000${i}` })),
    };

    const ed = editorFromTimetable(saved)!;
    expect(ed.subs.map((s) => s.name)).toEqual(["Maths", "Chem Lab"]);
    const again = buildRows(ed.slots, ed.subs, ed.grid);
    expect(again.map((r) => r.schedule)).toEqual(rows.map((r) => r.schedule));
    expect(again.map((r) => r.sessions)).toEqual(rows.map((r) => r.sessions));
  });
});
