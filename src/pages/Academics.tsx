import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, FileText, Calculator, CalendarClock, Plus, X, Check, TrendingUp, Trash2 } from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Button } from "../components/ui/Button";
import { daysUntil } from "../analytics";
import { dayLabel } from "../lib/utils";
import type { Exam } from "../types";
import { stagger, rise } from "../lib/motion";

type Tab = "tasks" | "cgpa" | "exams";
type Task = { id: string; title: string; course: string; status: "todo" | "doing" | "done" };

const seedTasks: Task[] = [
  { id: "1", title: "Data Structures Assignment 3", course: "CS-201", status: "todo" },
  { id: "2", title: "Read Chapter 4", course: "PHY-101", status: "todo" },
  { id: "3", title: "Lab Report Analysis", course: "CHEM-L", status: "doing" },
  { id: "4", title: "Calculus Worksheet", course: "MTH-102", status: "done" },
];

export function Academics() {
  const [tab, setTab] = useState<Tab>("tasks");
  return (
    <div>
      <PageHeader title="Academics" subtitle="Assignments, grades and exams — all in one place." icon={<GraduationCap className="w-6 h-6" />}
        actions={
          <Segmented<Tab> layoutId="acad" value={tab} onChange={setTab}
            options={[
              { value: "tasks", label: "Tasks", icon: <FileText className="w-4 h-4" /> },
              { value: "cgpa", label: "CGPA", icon: <Calculator className="w-4 h-4" /> },
              { value: "exams", label: "Exams", icon: <CalendarClock className="w-4 h-4" /> },
            ]} />
        } />
      <AnimatePresence mode="wait">
        {tab === "tasks" && <TasksBoard key="t" />}
        {tab === "cgpa" && <CgpaCalc key="c" />}
        {tab === "exams" && <ExamsPanel key="e" />}
      </AnimatePresence>
    </div>
  );
}

/* ── Tasks (local demo board) ── */
function TasksBoard() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [adding, setAdding] = useState("");
  const cols: { id: Task["status"]; label: string; color: string }[] = [
    { id: "todo", label: "To do", color: "var(--text-3)" },
    { id: "doing", label: "In progress", color: "var(--warn)" },
    { id: "done", label: "Done", color: "var(--go)" },
  ];
  const cycle = (id: string) => setTasks((t) => t.map((x) => x.id === id ? { ...x, status: x.status === "todo" ? "doing" : x.status === "doing" ? "done" : "todo" } : x));
  const add = () => { if (!adding.trim()) return; setTasks((t) => [...t, { id: Date.now().toString(), title: adding.trim(), course: "NEW", status: "todo" }]); setAdding(""); };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -16 }} className="grid md:grid-cols-3 gap-5">
      {cols.map((c) => (
        <motion.div key={c.id} variants={rise} className="flex flex-col rounded-[var(--r-lg)] bg-[var(--surface-2)] border border-[var(--border)] p-4 min-h-[520px]">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-black flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />{c.label}</h3>
            <span className="text-xs font-black text-[var(--text-3)] bg-[var(--surface)] px-2 py-1 rounded-lg tabnums">{tasks.filter((t) => t.status === c.id).length}</span>
          </div>
          <div className="flex-1 space-y-3">
            {tasks.filter((t) => t.status === c.id).map((t) => (
              <motion.button layout key={t.id} whileHover={{ y: -3 }} onClick={() => cycle(t.id)}
                className="w-full text-left p-4 rounded-[var(--r)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)] transition-colors group">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span className="text-[11px] font-black text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-md">{t.course}</span>
                  {t.status === "done" && <Check className="w-4 h-4 text-[var(--go)]" />}
                </div>
                <p className={`font-bold text-sm ${t.status === "done" ? "line-through text-[var(--text-3)]" : ""}`}>{t.title}</p>
              </motion.button>
            ))}
            {c.id === "todo" && (
              <div className="flex gap-2">
                <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a task…"
                  className="flex-1 px-3 py-2.5 rounded-[var(--r)] bg-[var(--surface)] border border-dashed border-[var(--border-strong)] text-sm font-semibold outline-none focus:border-[var(--accent)] transition-colors" />
                <button onClick={add} className="w-10 shrink-0 grid place-items-center rounded-[var(--r)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── CGPA (semester calculator) ── */
function CgpaCalc() {
  const [sems, setSems] = useState([{ id: 1, gpa: 8.4, credits: 22 }, { id: 2, gpa: 8.9, credits: 24 }]);
  const totalCr = sems.reduce((a, s) => a + s.credits, 0);
  const cgpa = sems.reduce((a, s) => a + s.gpa * s.credits, 0) / (totalCr || 1);
  const upd = (i: number, patch: Partial<{ gpa: number; credits: number }>) => setSems((p) => p.map((x, j) => j === i ? { ...x, ...patch } : x));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -16 }} className="grid lg:grid-cols-3 gap-6">
      <motion.div variants={rise} className="lg:col-span-2">
        <AnimatedCard>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-black font-display flex items-center gap-2"><Calculator className="w-5 h-5 text-[var(--accent)]" /> Semester records</h3>
            <Button size="sm" variant="soft" icon={<Plus className="w-4 h-4" />} onClick={() => setSems((p) => [...p, { id: Date.now(), gpa: 0, credits: 20 }])}>Add</Button>
          </div>
          <div className="space-y-2">
            {sems.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)]">
                <span className="font-black w-28 shrink-0">Semester {i + 1}</span>
                <label className="text-xs font-bold text-[var(--text-3)]">GPA</label>
                <input type="number" min={0} max={10} step={0.1} value={s.gpa} onChange={(e) => upd(i, { gpa: parseFloat(e.target.value) || 0 })}
                  className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)] px-3 py-1.5 text-sm font-black outline-none focus:border-[var(--accent)]" />
                <label className="text-xs font-bold text-[var(--text-3)]">Credits</label>
                <input type="number" min={0} max={40} value={s.credits} onChange={(e) => upd(i, { credits: parseInt(e.target.value) || 0 })}
                  className="w-20 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xs)] px-3 py-1.5 text-sm font-black outline-none focus:border-[var(--accent)]" />
                <span className="ml-auto font-bold text-[var(--text-2)] tabnums">{(s.gpa * s.credits).toFixed(1)} pts</span>
                <button onClick={() => setSems((p) => p.filter((_, j) => j !== i))} className="p-1.5 text-[var(--text-3)] hover:text-[var(--danger)] transition-colors"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </AnimatedCard>
      </motion.div>
      <motion.div variants={rise}>
        <AnimatedCard glow tilt className="h-full flex flex-col items-center justify-center text-center py-12">
          <div className="w-20 h-20 rounded-[var(--r-lg)] bg-[image:var(--grad)] grid place-items-center text-white shadow-[var(--shadow-glow)] mb-5"><TrendingUp className="w-10 h-10" /></div>
          <div className="text-[var(--text-3)] font-black uppercase tracking-widest text-xs mb-2">Cumulative GPA</div>
          <div className="text-6xl font-black tabnums text-gradient">{cgpa.toFixed(2)}</div>
          <p className="mt-4 text-sm font-semibold text-[var(--text-3)] px-6">Across {totalCr} credits. Keep it climbing! 🚀</p>
        </AnimatedCard>
      </motion.div>
    </motion.div>
  );
}

/* ── Exams (persisted to backend) ── */
function ExamsPanel() {
  const { st, refresh } = useApp();
  const today = st?.today || "";
  const [exams, setExams] = useState<Exam[]>(st?.exams || []);
  const [form, setForm] = useState({ title: "", subject: "", date: "" });

  const persist = async (next: Exam[]) => { setExams(next); try { await api.saveExams(next); refresh(); } catch { /* mock */ } };
  const addExam = () => {
    if (!form.title.trim() || !form.date) return;
    persist([...exams, { id: Date.now().toString(), title: form.title.trim(), subject: form.subject.trim(), date: form.date, done: false }]);
    setForm({ title: "", subject: "", date: "" });
  };
  const toggle = (id: string) => persist(exams.map((e) => e.id === id ? { ...e, done: !e.done } : e));
  const remove = (id: string) => persist(exams.filter((e) => e.id !== id));

  const sorted = [...exams].sort((a, b) => (a.done === b.done ? a.date.localeCompare(b.date) : a.done ? 1 : -1));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -16 }} className="grid lg:grid-cols-3 gap-6">
      <motion.div variants={rise}>
        <AnimatedCard className="h-full">
          <h3 className="text-lg font-black font-display mb-5 flex items-center gap-2"><Plus className="w-5 h-5 text-[var(--accent)]" /> Add an exam</h3>
          <div className="space-y-3">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Exam title" className="field" />
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject (optional)" className="field" />
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="field" />
            <Button block onClick={addExam} icon={<Plus className="w-4 h-4" />}>Add exam</Button>
          </div>
        </AnimatedCard>
      </motion.div>

      <motion.div variants={rise} className="lg:col-span-2">
        <AnimatedCard spotlight={false} className="h-full">
          <h3 className="text-lg font-black font-display mb-5 flex items-center gap-2"><CalendarClock className="w-5 h-5 text-[var(--accent)]" /> Upcoming exams</h3>
          {sorted.length === 0 ? (
            <div className="text-center py-16 text-[var(--text-3)] font-semibold">No exams yet — add your first one to start the countdown. 📚</div>
          ) : (
            <div className="space-y-2.5">
              {sorted.map((e) => {
                const dd = daysUntil(e.date, today);
                const soon = dd != null && dd >= 0 && dd <= 3;
                return (
                  <motion.div layout key={e.id} className={`flex items-center gap-4 p-3.5 rounded-[var(--r)] border transition-colors ${e.done ? "bg-[var(--surface-2)] border-[var(--border)] opacity-60" : "bg-[var(--surface)] border-[var(--border)]"}`}>
                    <button onClick={() => toggle(e.id)} className={`w-6 h-6 rounded-lg border-2 grid place-items-center shrink-0 transition-colors ${e.done ? "bg-[var(--go)] border-[var(--go)]" : "border-[var(--border-strong)] hover:border-[var(--accent)]"}`}>{e.done && <Check className="w-3.5 h-3.5 text-white" />}</button>
                    <div className="min-w-0 flex-1">
                      <div className={`font-black text-sm ${e.done ? "line-through" : ""}`}>{e.title}</div>
                      <div className="text-xs font-bold text-[var(--text-3)]">{e.subject || "Exam"} · {new Date(e.date + "T00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                    </div>
                    {!e.done && <span className={`text-xs font-black px-2.5 py-1 rounded-full ${soon ? "bg-[var(--danger)]/15 text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}>{dayLabel(dd)}</span>}
                    <button onClick={() => remove(e.id)} className="p-1.5 text-[var(--text-3)] hover:text-[var(--danger)] transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatedCard>
      </motion.div>
    </motion.div>
  );
}
