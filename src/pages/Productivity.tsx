import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Target, CheckCircle2, Flame, Award, Plus } from "lucide-react";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { PomodoroTimer } from "../components/shared/PomodoroTimer";
import { stagger, rise } from "../lib/motion";

export function Productivity() {
  const habit = useMemo(() => Array.from({ length: 364 }, () => Math.floor(Math.random() * 5)), []);
  const [goals, setGoals] = useState([
    { id: 1, text: "Read 20 pages of Advanced Physics", done: false },
    { id: 2, text: "Complete 2 Pomodoro sessions", done: true },
    { id: 3, text: "Review React components", done: false },
    { id: 4, text: "Drink 2L water", done: true },
  ]);
  const [newGoal, setNewGoal] = useState("");
  const done = goals.filter((g) => g.done).length;

  const intensity = (v: number) => ["var(--surface-3)", "color-mix(in srgb, var(--accent) 30%, transparent)", "color-mix(in srgb, var(--accent) 55%, transparent)", "var(--accent)", "var(--go)"][v];

  return (
    <div>
      <PageHeader title="Focus" subtitle="Deep-work tools and gamified habits." icon={<Target className="w-6 h-6" />} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid xl:grid-cols-3 gap-6">
        <div className="flex flex-col gap-6">
          <motion.div variants={rise}><PomodoroTimer /></motion.div>
          <motion.div variants={rise}>
            <AnimatedCard className="flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-lg font-display flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-[var(--accent)]" /> Daily goals</h3>
                <span className="text-xs font-black text-[var(--text-3)] tabnums">{done}/{goals.length}</span>
              </div>
              <div className="space-y-2.5">
                {goals.map((g) => (
                  <motion.button layout key={g.id} onClick={() => setGoals((p) => p.map((x) => x.id === g.id ? { ...x, done: !x.done } : x))}
                    className={`w-full flex items-center gap-3 p-3 rounded-[var(--r)] border text-left transition-colors ${g.done ? "bg-[var(--go)]/10 border-[var(--go)]/25" : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]"}`}>
                    <span className={`w-5 h-5 rounded-md grid place-items-center shrink-0 transition-colors ${g.done ? "bg-[var(--go)] text-white" : "border-2 border-[var(--text-3)]"}`}>{g.done && <CheckCircle2 className="w-3 h-3" />}</span>
                    <span className={`font-semibold text-sm ${g.done ? "line-through text-[var(--text-3)]" : ""}`}>{g.text}</span>
                  </motion.button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input value={newGoal} onChange={(e) => setNewGoal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newGoal.trim()) { setGoals((p) => [...p, { id: Date.now(), text: newGoal.trim(), done: false }]); setNewGoal(""); } }}
                  placeholder="Add a goal…" className="flex-1 px-3 py-2.5 rounded-[var(--r)] bg-[var(--surface-2)] border border-dashed border-[var(--border-strong)] text-sm font-semibold outline-none focus:border-[var(--accent)] transition-colors" />
                <button onClick={() => { if (newGoal.trim()) { setGoals((p) => [...p, { id: Date.now(), text: newGoal.trim(), done: false }]); setNewGoal(""); } }} className="w-10 grid place-items-center rounded-[var(--r)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"><Plus className="w-4 h-4" /></button>
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
                  <div className="text-center"><div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Current</div><div className="text-lg font-black text-orange-500 tabnums">12 days</div></div>
                  <div className="text-center"><div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Longest</div><div className="text-lg font-black tabnums">45 days</div></div>
                </div>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 min-w-[760px]">
                  {habit.map((v, i) => <div key={i} className="w-3.5 h-3.5 rounded-[4px] hover:ring-2 ring-[var(--accent)] transition-all" style={{ background: intensity(v) }} title={`${v} tasks`} />)}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 mt-3 text-[11px] font-bold text-[var(--text-3)]">
                Less {[0, 1, 2, 3, 4].map((v) => <span key={v} className="w-3 h-3 rounded-[3px]" style={{ background: intensity(v) }} />)} More
              </div>
            </AnimatedCard>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div variants={rise}>
              <AnimatedCard tilt className="h-full bg-[image:var(--grad)] text-[var(--accent-contrast)] border-none relative overflow-hidden">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/15 rounded-full blur-2xl" />
                <Award className="w-9 h-9 mb-4 opacity-90" />
                <h3 className="text-xl font-black font-display mb-2">Deep Work Master</h3>
                <p className="opacity-90 font-medium text-sm">You've logged 40+ hours of focused sessions this month — top 5% of students!</p>
              </AnimatedCard>
            </motion.div>
            <motion.div variants={rise}>
              <AnimatedCard className="h-full">
                <h3 className="font-black text-center mb-5 font-display">Focus distribution</h3>
                <div className="space-y-4">
                  {[{ l: "Academics", p: 65, c: "var(--accent)" }, { l: "Reading", p: 20, c: "var(--go)" }, { l: "Coding", p: 15, c: "var(--warn)" }].map((s) => (
                    <div key={s.l}>
                      <div className="flex justify-between text-sm font-bold mb-1.5"><span>{s.l}</span><span className="text-[var(--text-3)] tabnums">{s.p}%</span></div>
                      <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: s.c }} initial={{ width: 0 }} animate={{ width: `${s.p}%` }} transition={{ duration: 1, ease: "easeOut" }} /></div>
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
