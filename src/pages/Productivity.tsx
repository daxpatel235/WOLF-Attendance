import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target, CheckCircle2, Flame, Award, Plus, Trash2, Timer } from "lucide-react";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { PomodoroTimer } from "../components/shared/PomodoroTimer";
import { stagger, rise } from "../lib/motion";
import { usePersistentState, localIso } from "../lib/usePersistentState";

type Goal = { id: number; text: string; done: boolean };
/** date (YYYY-MM-DD) -> completed 25-minute focus sessions that day. */
type FocusLog = Record<string, number>;

const FOCUS_MIN = 25;
const WEEKS = 26;

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Current + longest run of consecutive days with at least one focus session. */
function focusStreaks(log: FocusLog, today: Date) {
  const days = Object.keys(log).filter((k) => log[k] > 0).sort();
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of days) {
    run = prev && localIso(addDays(new Date(prev + "T00:00"), 1)) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  // The current streak may end today or (if nothing yet today) yesterday.
  let current = 0;
  let cur = log[localIso(today)] > 0 ? today : addDays(today, -1);
  while (log[localIso(cur)] > 0) { current++; cur = addDays(cur, -1); }
  return { current, longest };
}

export function Productivity() {
  const [goals, setGoals] = usePersistentState<Goal[]>("goals", []);
  const [log, setLog] = usePersistentState<FocusLog>("focus_log", {});
  const [newGoal, setNewGoal] = useState("");
  const done = goals.filter((g) => g.done).length;

  const today = new Date();
  const todayIso = localIso(today);

  const recordSession = () => setLog((l) => ({ ...l, [todayIso]: (l[todayIso] || 0) + 1 }));
  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals((p) => [...p, { id: Date.now(), text: newGoal.trim(), done: false }]);
    setNewGoal("");
  };

  // Heatmap: the last WEEKS weeks, columns are weeks (Sun..Sat rows), ending this week.
  const cells = useMemo(() => {
    const start = addDays(today, -today.getDay() - (WEEKS - 1) * 7);
    return Array.from({ length: WEEKS * 7 }, (_, i) => {
      const d = addDays(start, i);
      const iso = localIso(d);
      return { iso, n: log[iso] || 0, future: d > today };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, todayIso]);

  const streak = focusStreaks(log, today);
  const weekStart = addDays(today, -6);
  const weekSessions = Object.entries(log)
    .filter(([k]) => k >= localIso(weekStart) && k <= todayIso)
    .reduce((a, [, n]) => a + n, 0);
  const allSessions = Object.values(log).reduce((a, n) => a + n, 0);
  const todaySessions = log[todayIso] || 0;
  const hours = (n: number) => {
    const m = n * FOCUS_MIN;
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m}m`;
  };

  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  const intensity = (v: number) => ["var(--surface-3)", "color-mix(in srgb, var(--accent) 30%, transparent)", "color-mix(in srgb, var(--accent) 55%, transparent)", "var(--accent)", "var(--go)"][v];

  return (
    <div>
      <PageHeader title="Focus" subtitle="Deep-work timer, daily goals and your real focus history." icon={<Target className="w-6 h-6" />} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid xl:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6">
          <motion.div variants={rise}><PomodoroTimer onFocusComplete={recordSession} /></motion.div>
          <motion.div variants={rise}>
            <AnimatedCard className="flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-lg font-display flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[var(--accent)]" /> Daily goals</h3>
                <div className="flex items-center gap-3">
                  {done > 0 && (
                    <button onClick={() => setGoals((p) => p.filter((g) => !g.done))} className="text-[11px] font-bold text-[var(--text-3)] hover:text-[var(--accent)]">
                      Clear done
                    </button>
                  )}
                  <span className="text-xs font-black text-[var(--text-3)] tabnums">{done}/{goals.length}</span>
                </div>
              </div>
              <div className="space-y-2.5">
                {goals.length === 0 && <p className="text-sm font-semibold text-[var(--text-3)] py-2">No goals yet — add one below.</p>}
                {goals.map((g) => (
                  <motion.div layout key={g.id} className="flex items-center gap-2 group">
                    <button onClick={() => setGoals((p) => p.map((x) => x.id === g.id ? { ...x, done: !x.done } : x))}
                      className={`flex-1 flex items-center gap-3 p-3 rounded-[var(--r)] border text-left transition-colors ${g.done ? "bg-[var(--go)]/10 border-[var(--go)]/25" : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]"}`}>
                      <span className={`w-5 h-5 rounded-md grid place-items-center shrink-0 transition-colors ${g.done ? "bg-[var(--go)] text-white" : "border-2 border-[var(--text-3)]"}`}>{g.done && <CheckCircle2 className="w-3 h-3" />}</span>
                      <span className={`font-semibold text-sm ${g.done ? "line-through text-[var(--text-3)]" : ""}`}>{g.text}</span>
                    </button>
                    <button onClick={() => setGoals((p) => p.filter((x) => x.id !== g.id))} aria-label="Delete goal"
                      className="p-1.5 text-[var(--text-3)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] transition-opacity">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGoal(); }}
                  placeholder="Add a goal…" className="flex-1 px-3 py-2.5 rounded-[var(--r)] bg-[var(--surface-2)] border border-dashed border-[var(--border-strong)] text-sm font-semibold outline-none focus:border-[var(--accent)] transition-colors" />
                <button onClick={addGoal} aria-label="Add goal" className="w-10 grid place-items-center rounded-[var(--r)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            </AnimatedCard>
          </motion.div>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-2">
          <motion.div variants={rise}>
            <AnimatedCard glow>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="font-black text-lg font-display flex items-center gap-2"><Flame className="w-5 h-5 text-orange-500" /> Consistency</h3>
                <div className="flex gap-5">
                  <div className="text-center"><div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Current</div><div className="text-lg font-black text-orange-500 tabnums">{streak.current} day{streak.current === 1 ? "" : "s"}</div></div>
                  <div className="text-center"><div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Longest</div><div className="text-lg font-black tabnums">{streak.longest} day{streak.longest === 1 ? "" : "s"}</div></div>
                </div>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5">
                  {cells.map((c) => (
                    <div key={c.iso} className="w-3.5 h-3.5 rounded-[4px] hover:ring-2 ring-[var(--accent)] transition-all"
                      style={{ background: c.future ? "transparent" : intensity(level(c.n)), outline: c.iso === todayIso ? "1.5px solid var(--accent)" : undefined }}
                      title={c.future ? "" : `${c.iso}: ${c.n} focus session${c.n === 1 ? "" : "s"}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-1.5 mt-3 text-[11px] font-bold text-[var(--text-3)]">
                <span>Each square is a day; finish a 25-minute focus session to fill it.</span>
                <span className="flex items-center gap-1.5">Less {[0, 1, 2, 3, 4].map((v) => <span key={v} className="w-3 h-3 rounded-[3px]" style={{ background: intensity(v) }} />)} More</span>
              </div>
            </AnimatedCard>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div variants={rise}>
              <AnimatedCard tilt className="h-full bg-[image:var(--grad)] text-[var(--accent-contrast)] border-none relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl" />
                <Award className="w-9 h-9 mb-4 opacity-90" />
                <h3 className="text-xl font-black font-display mb-2">This week</h3>
                <p className="opacity-90 font-medium text-sm">
                  {weekSessions > 0
                    ? <>You've completed <strong>{weekSessions}</strong> focus session{weekSessions === 1 ? "" : "s"} ({hours(weekSessions)}) in the last 7 days.</>
                    : "No focus sessions in the last 7 days yet — start the timer to begin your streak."}
                </p>
              </AnimatedCard>
            </motion.div>
            <motion.div variants={rise}>
              <AnimatedCard className="h-full">
                <h3 className="font-black text-center mb-5 font-display flex items-center justify-center gap-2"><Timer className="w-5 h-5 text-[var(--accent)]" /> Focus time</h3>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { l: "Today", n: todaySessions },
                    { l: "7 days", n: weekSessions },
                    { l: "All time", n: allSessions },
                  ].map((x) => (
                    <div key={x.l} className="p-3 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)]">
                      <div className="text-xl font-black tabnums">{hours(x.n)}</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mt-1">{x.l}</div>
                      <div className="text-[11px] font-semibold text-[var(--text-3)] tabnums">{x.n} session{x.n === 1 ? "" : "s"}</div>
                    </div>
                  ))}
                </div>
              </AnimatedCard>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
