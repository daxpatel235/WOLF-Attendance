import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, FlaskConical } from "lucide-react";
import { useApp } from "../store";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const catColor = (cat: string) => {
  if (cat === "required" || cat === "attend" || cat === "past-attended") return "var(--go)";
  if (cat === "skip" || cat === "skip-forced" || cat === "past-skipped") return "var(--skip)";
  if (cat === "buffer") return "var(--buffer)";
  return "var(--holiday)";
};

export function Calendar() {
  const { st, go } = useApp();
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth());
  const [dir, setDir] = useState(1);

  const shift = (n: number) => {
    setDir(n);
    let m = calM + n, y = calY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setCalM(m); setCalY(y);
  };

  const plan = st?.plan;
  if (!plan?.ready) {
    return <EmptyState icon={<CalendarDays className="w-14 h-14" />} title="Your semester, mapped out" message="Set your semester dates and import a timetable to see exactly which days to attend, skip or keep as buffer." actionLabel="Configure" onAction={() => go("settings")} />;
  }

  const byDate: Record<string, any> = {};
  plan.days.forEach((d: any) => (byDate[d.date] = d));

  const dim = new Date(calY, calM + 1, 0).getDate();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = Array(6).fill(null), has = false;
  for (let d = 1; d <= dim; d++) {
    const wd = new Date(calY, calM, d).getDay();
    if (wd === 0) { if (has) { weeks.push(week); week = Array(6).fill(null); has = false; } continue; }
    if (wd === 1 && has) { weeks.push(week); week = Array(6).fill(null); has = false; }
    week[wd - 1] = isoOf(calY, calM, d); has = true;
  }
  if (has) weeks.push(week);

  const legend = [
    { t: "Go to class", color: "var(--go)" }, { t: "Stay home", color: "var(--skip)" },
    { t: "Buffer", color: "var(--buffer)" }, { t: "Holiday", color: "var(--holiday)" },
  ];

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Plan the semester, one day at a time." icon={<CalendarDays className="w-6 h-6" />}
        actions={
          <div className="flex flex-wrap gap-1.5 rounded-[var(--r)] glass px-2.5 py-2 shadow-[var(--shadow-sm)]">
            {legend.map((l) => (
              <div key={l.t} className="flex items-center gap-1.5 px-2 text-xs font-bold text-[var(--text-2)]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.t}
              </div>
            ))}
          </div>
        } />

      <AnimatedCard spotlight={false} className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <NavBtn onClick={() => shift(-1)}><ChevronLeft className="w-5 h-5" /></NavBtn>
          <div className="relative h-9 w-56 grid place-items-center overflow-hidden">
            <AnimatePresence mode="popLayout" custom={dir}>
              <motion.h2 key={`${calY}-${calM}`} custom={dir}
                initial={{ opacity: 0, y: dir * 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: dir * -20 }}
                className="absolute text-2xl font-black tracking-tight font-display">{MONTHS[calM]} {calY}</motion.h2>
            </AnimatePresence>
          </div>
          <NavBtn onClick={() => shift(1)}><ChevronRight className="w-5 h-5" /></NavBtn>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-6 gap-2 mb-2">
            {DOW.map((d) => <div key={d} className="text-center text-[11px] font-black uppercase tracking-widest text-[var(--text-3)] pb-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-6 gap-2">
            {weeks.map((wk, wi) => wk.map((iso, ci) => {
              if (!iso) return <div key={`${wi}-${ci}`} className="min-h-[96px] rounded-[var(--r)]" />;
              const info = byDate[iso]; const dn = Number(iso.slice(8));
              if (!info) return (
                <div key={iso} className="min-h-[96px] rounded-[var(--r)] bg-[var(--surface-3)]/40 p-2.5 opacity-50">
                  <span className="text-sm font-black text-[var(--text-3)]">{dn}</span>
                </div>
              );
              const col = catColor(info.category);
              const past = info.isPast, todayCell = info.isToday;
              return (
                <motion.div key={iso} whileHover={{ y: -3, scale: 1.03 }} transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  className="relative min-h-[96px] rounded-[var(--r)] p-2.5 flex flex-col cursor-default overflow-hidden"
                  style={{ background: past ? "var(--surface-2)" : `${col}14`, border: `1.5px solid ${todayCell ? "var(--accent)" : "transparent"}`, opacity: past ? 0.62 : 1 }}>
                  {todayCell && <span className="absolute top-2 right-2 flex h-2.5 w-2.5"><span className="animate-ping absolute h-full w-full rounded-full bg-[var(--accent)] opacity-70" /><span className="relative rounded-full h-2.5 w-2.5 bg-[var(--accent)]" /></span>}
                  <span className="text-sm font-black" style={{ color: past ? "var(--text-3)" : col }}>{dn}</span>
                  {info.hasLab && <FlaskConical className="absolute top-2.5 right-2.5 w-3 h-3 text-[var(--lab)]" />}
                  <div className="mt-auto flex flex-wrap gap-1">
                    {(info.subjects || []).slice(0, 6).map((s: any, i: number) => <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />)}
                  </div>
                </motion.div>
              );
            }))}
          </div>
        </div>
      </AnimatedCard>
    </div>
  );
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={onClick}
      className="w-11 h-11 grid place-items-center rounded-[var(--r-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
      {children}
    </motion.button>
  );
}
