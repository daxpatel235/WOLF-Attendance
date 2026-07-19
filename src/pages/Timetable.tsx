import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Save, Clock, Layers, Grid3x3, Pencil, FlaskConical, CalendarRange } from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";

const MB_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MB_DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const toHHMM = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
const perOf = (s: string, e: string) => { const a = toMin(s), b = toMin(e); return b > a ? Math.max(1, Math.min(8, Math.round((b - a) / 60))) : 1; };

type Slot = { start: string; end: string; lunch: boolean };
type MSubject = { name: string; code: string; kind: string };
type Row = { name: string; code: string; kind: string; schedule: Record<string, number>; sessions: unknown[] };

export function Timetable() {
  const { st, refresh } = useApp();
  const tt = st?.timetable;
  const [batch, setBatch] = useState(st?.settings?.batchName || "");
  const [isEditing, setIsEditing] = useState(!tt?.subjects?.length);

  const [nPer, setNPer] = useState(6);
  const [startT, setStartT] = useState("09:00");
  const [lenMin, setLenMin] = useState(60);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [subs, setSubs] = useState<MSubject[]>([{ name: "", code: "", kind: "lecture" }]);
  const [grid, setGrid] = useState<(number | null)[][]>([]);

  const genSlots = () => {
    const out: Slot[] = []; let cur = toMin(startT);
    for (let i = 0; i < nPer; i++) { out.push({ start: toHHMM(cur), end: toHHMM(cur + lenMin), lunch: false }); cur += lenMin; }
    setSlots(out); setGrid(out.map(() => Array(6).fill(null)));
  };
  const setCell = (si: number, di: number, val: string) =>
    setGrid((g) => g.map((row, r) => (r === si ? row.map((c, d) => (d === di ? (val === "" ? null : Number(val)) : c)) : row)));
  const updSub = (i: number, patch: Partial<MSubject>) => setSubs((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const build = async () => {
    const groups: Record<string, Row> = {}; const order: string[] = [];
    for (let d = 0; d < 6; d++) {
      let i = 0;
      while (i < slots.length) {
        if (slots[i].lunch || grid[i]?.[d] == null) { i++; continue; }
        const subjIdx = grid[i][d] as number; let j = i;
        while (j + 1 < slots.length && !slots[j + 1].lunch && grid[j + 1]?.[d] === subjIdx) j++;
        const sub = subs[subjIdx];
        if (sub && sub.name.trim()) {
          const key = sub.code.trim() ? sub.code.trim().toUpperCase() : sub.name.trim().toLowerCase();
          if (!groups[key]) { groups[key] = { name: sub.name.trim(), code: sub.code.trim(), kind: sub.kind, schedule: {}, sessions: [] }; order.push(key); }
          const g = groups[key]; const start = slots[i].start, end = slots[j].end, p = perOf(start, end); const dayName = MB_DAYS[d];
          g.schedule[dayName] = (g.schedule[dayName] || 0) + p;
          if (sub.kind === "lab") g.kind = "lab";
          (g.sessions as unknown[]).push({ day: dayName, start, end, periods: p });
        }
        i = j + 1;
      }
    }
    const rows = order.map((k) => groups[k]).filter((r) => Object.values(r.schedule).some((v) => v > 0));
    if (!rows.length) return alert("Place at least one subject in the grid first.");
    const res = await api.saveTimetable({ batchName: batch.trim(), subjects: rows });
    if (!res.ok) return alert(res.error || "Could not save.");
    refresh(); setIsEditing(false);
  };

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Build your weekly schedule — private and offline." icon={<CalendarRange className="w-6 h-6" />}
        actions={!isEditing ? <Button variant="secondary" onClick={() => setIsEditing(true)} icon={<Pencil className="w-4 h-4" />}>Edit</Button> : undefined} />

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div key="edit" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5 max-w-5xl">
            <AnimatedCard spotlight={false}>
              <h3 className="text-lg font-black font-display mb-5 flex items-center gap-2"><Clock className="w-5 h-5 text-[var(--accent)]" /> 1 · Timing</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MiniField label="Batch / Division"><input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="CS-B2" className={inputCls} /></MiniField>
                <MiniField label="Periods / day"><input type="number" min={1} max={12} value={nPer} onChange={(e) => setNPer(Math.max(1, Math.min(12, +e.target.value || 1)))} className={inputCls} /></MiniField>
                <MiniField label="Day starts"><input type="time" value={startT} onChange={(e) => setStartT(e.target.value)} className={inputCls} /></MiniField>
                <MiniField label="Period length (min)"><input type="number" min={30} max={180} step={5} value={lenMin} onChange={(e) => setLenMin(+e.target.value || 60)} className={inputCls} /></MiniField>
              </div>
              <div className="mt-5"><Button onClick={genSlots} icon={<Grid3x3 className="w-4 h-4" />}>Generate grid</Button></div>
            </AnimatedCard>

            <AnimatedCard spotlight={false}>
              <h3 className="text-lg font-black font-display mb-5 flex items-center gap-2"><Layers className="w-5 h-5 text-[var(--accent)]" /> 2 · Subjects</h3>
              <div className="space-y-2.5">
                <div className="hidden sm:grid grid-cols-[1fr_7rem_8.5rem_2.5rem] gap-2.5 px-1 pb-1">
                  {["Subject", "Code", "Type", ""].map((h, i) => <span key={i} className="text-[11px] font-black text-[var(--text-3)] uppercase tracking-widest">{h}</span>)}
                </div>
                {subs.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_7rem_8.5rem_2.5rem] gap-2.5 items-center">
                    <input value={s.name} onChange={(e) => updSub(i, { name: e.target.value })} placeholder="e.g. Data Structures" className={inputCls} />
                    <input value={s.code} onChange={(e) => updSub(i, { code: e.target.value })} placeholder="CS201" className={inputCls} />
                    <select value={s.kind} onChange={(e) => updSub(i, { kind: e.target.value })} className={inputCls}><option value="lecture">Lecture</option><option value="lab">Lab</option></select>
                    <button onClick={() => setSubs((p) => p.filter((_, j) => j !== i))} className="w-10 h-11 grid place-items-center rounded-[var(--r)] text-[var(--text-3)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <Button variant="soft" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setSubs((p) => [...p, { name: "", code: "", kind: "lecture" }])}>Add subject</Button>
              </div>
            </AnimatedCard>

            {slots.length > 0 && (
              <AnimatedCard spotlight={false}>
                <h3 className="text-lg font-black font-display mb-5 flex items-center gap-2"><Grid3x3 className="w-5 h-5 text-[var(--accent)]" /> 3 · Place in grid</h3>
                <div className="overflow-x-auto -mx-2 pb-2">
                  <table className="w-full min-w-[760px] border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="p-2 text-left text-[11px] font-black text-[var(--text-3)] uppercase tracking-widest">Time</th>
                        {MB_DOW.map((d) => <th key={d} className="p-2 text-left text-[11px] font-black text-[var(--text-3)] uppercase tracking-widest">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((sl, si) => (
                        <tr key={si}>
                          <td className="p-2 text-xs font-bold text-[var(--text-2)] whitespace-nowrap tabnums">{sl.start}–{sl.end}</td>
                          {MB_DAYS.map((_, di) => (
                            <td key={di}>
                              <select value={grid[si]?.[di] ?? ""} onChange={(e) => setCell(si, di, e.target.value)}
                                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-[var(--r-xs)] px-2 py-2 text-sm font-semibold outline-none focus:border-[var(--accent)] transition-colors">
                                <option value="">—</option>
                                {subs.map((s, idx) => s.name.trim() ? <option key={idx} value={idx}>{s.name.trim()}{s.kind === "lab" ? " 🧪" : ""}</option> : null)}
                              </select>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  {tt?.subjects?.length ? <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button> : null}
                  <Button onClick={build} icon={<Save className="w-4 h-4" />}>Save timetable</Button>
                </div>
              </AnimatedCard>
            )}
          </motion.div>
        ) : (
          <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!tt?.subjects?.length ? (
              <EmptyState title="No timetable yet" message="Add your subjects and place them on the grid to generate your weekly schedule." actionLabel="Build it" onAction={() => setIsEditing(true)} />
            ) : <ReadGrid tt={tt} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputCls = "field";

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-black text-[var(--text-3)] uppercase tracking-widest mb-2">{label}</label>{children}</div>;
}

function ReadGrid({ tt }: { tt: any }) {
  const slotSet = new Set<string>();
  const map: Record<string, Record<string, any>> = {}; MB_DAYS.forEach((d) => (map[d] = {}));
  tt.subjects.forEach((sub: any) => sub.sessions?.forEach((s: any) => { const k = `${s.start} - ${s.end}`; slotSet.add(k); if (map[s.day]) map[s.day][k] = { ...sub, ...s }; }));
  const slots = Array.from(slotSet).sort((a, b) => toMin(a.split(" - ")[0]) - toMin(b.split(" - ")[0]));

  return (
    <AnimatedCard spotlight={false} className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-separate border-spacing-2 p-2">
          <thead>
            <tr>
              <th className="w-20"><Clock className="w-4 h-4 mx-auto text-[var(--text-3)]" /></th>
              {MB_DAYS.map((d) => <th key={d} className="p-2 text-left text-xs font-black uppercase tracking-widest text-[var(--text-2)]">{d.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => (
              <tr key={i}>
                <td className="text-center text-[11px] font-black text-[var(--text-3)] whitespace-nowrap tabnums">
                  <div>{slot.split(" - ")[0]}</div><div className="opacity-40">{slot.split(" - ")[1]}</div>
                </td>
                {MB_DAYS.map((day) => {
                  const cell = map[day][slot];
                  if (!cell) return <td key={day} className="rounded-[var(--r)]"><div className="min-h-[68px] rounded-[var(--r)] bg-[var(--surface-3)]/30" /></td>;
                  const color = cell.color || "var(--accent)";
                  return (
                    <td key={day}>
                      <motion.div whileHover={{ y: -3, scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}
                        className="relative min-h-[68px] p-3 rounded-[var(--r)] overflow-hidden group cursor-default"
                        style={{ background: `${color}18`, border: `1.5px solid ${color}38` }}>
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: color }} />
                        <div className="flex items-start justify-between gap-1.5 pl-1.5">
                          <h4 className="font-black text-[13px] leading-tight">{cell.name}</h4>
                          {cell.kind === "lab" && <FlaskConical className="w-3.5 h-3.5 shrink-0" style={{ color }} />}
                        </div>
                        <div className="flex items-center justify-between mt-2 pl-1.5 text-[11px] font-bold">
                          <span style={{ color }}>{cell.code || "—"}</span>
                          <span className="text-[var(--text-3)]">{cell.periods}p</span>
                        </div>
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AnimatedCard>
  );
}
