import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, FlaskConical, CornerDownLeft } from "lucide-react";
import { useApp } from "../store";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { DaySheet } from "../components/shared/DaySheet";
import { MARK_META } from "../components/shared/MarkControl";
import type { Day, Mark } from "../types";

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

/** Short label so a future day states its instruction outright, not just by hue. */
const catLabel = (cat: string) => {
  switch (cat) {
    case "required": case "attend": return "Attend";
    case "buffer":   return "Buffer";
    case "skip":     return "Free";
    case "holiday":  return "Holiday";
    default:         return "";
  }
};

export function Calendar() {
  const { st, go, refresh } = useApp();
  const [calY, setCalY] = useState(new Date().getFullYear());
  const [calM, setCalM] = useState(new Date().getMonth());
  const [dir, setDir] = useState(1);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const plan = st?.plan;

  const byDate = useMemo(() => {
    const m: Record<string, Day> = {};
    (plan?.days || []).forEach((d) => (m[d.date] = d));
    return m;
  }, [plan]);

  const shift = (n: number) => {
    setDir(n);
    let m = calM + n, y = calY;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    setCalM(m); setCalY(y);
  };

  const jumpToToday = () => {
    const now = new Date();
    setDir(now.getFullYear() * 12 + now.getMonth() >= calY * 12 + calM ? 1 : -1);
    setCalY(now.getFullYear()); setCalM(now.getMonth());
  };

  if (!plan?.ready) {
    return <EmptyState icon={<CalendarDays className="w-14 h-14" />} title="Your semester, mapped out" message="Set your semester dates and import a timetable to see exactly which days to attend, skip or keep as buffer." actionLabel="Configure" onAction={() => go("settings")} />;
  }

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

  const openDay = openDate ? byDate[openDate] ?? null : null;
  const overrides = (openDate && st?.subjectAttendance?.[openDate]) || {};
  const holidays = st?.settings?.holidays || [];

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Click any day to log it — the whole day, or one class at a time." icon={<CalendarDays className="w-6 h-6" />}
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
          <NavBtn onClick={() => shift(-1)} label="Previous month"><ChevronLeft className="w-5 h-5" /></NavBtn>
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-56 grid place-items-center overflow-hidden">
              <AnimatePresence mode="popLayout" custom={dir}>
                <motion.h2 key={`${calY}-${calM}`} custom={dir}
                  initial={{ opacity: 0, y: dir * 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: dir * -20 }}
                  className="absolute text-2xl font-black tracking-tight font-display">{MONTHS[calM]} {calY}</motion.h2>
              </AnimatePresence>
            </div>
            <button onClick={jumpToToday}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-sm)] text-xs font-black uppercase tracking-wide border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
              <CornerDownLeft className="w-3.5 h-3.5" /> Today
            </button>
          </div>
          <NavBtn onClick={() => shift(1)} label="Next month"><ChevronRight className="w-5 h-5" /></NavBtn>
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
              return <DayCell key={iso} info={info} dn={dn} onOpen={() => setOpenDate(iso)} />;
            }))}
          </div>
        </div>
      </AnimatedCard>

      <DaySheet
        day={openDay}
        overrides={overrides as Record<string, Mark>}
        isHoliday={openDate ? holidays.includes(openDate) : false}
        onClose={() => setOpenDate(null)}
        onChanged={refresh}
      />
    </div>
  );
}

function DayCell({ info, dn, onOpen }: { info: Day; dn: number; onOpen: () => void }) {
  const col = catColor(info.category);
  const past = info.isPast, todayCell = info.isToday;
  const markMeta = info.marked ? MARK_META[info.marked] : null;
  const label = catLabel(info.category);
  // A past day is described by what you did; a future day by what you should do.
  const railColor = past && markMeta ? markMeta.color : col;

  return (
    <motion.button
      onClick={onOpen}
      aria-label={`${info.weekday} ${dn} — ${info.category}${info.marked ? `, ${info.marked}` : ""}`}
      whileHover={{ y: -3, scale: 1.03 }} whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="relative min-h-[96px] rounded-[var(--r)] pl-3.5 pr-2.5 py-2.5 flex flex-col text-left cursor-pointer overflow-hidden group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)]"
      style={{
        // Mix into the surface rather than toward transparent, so the tint stays
        // visible in both light and dark themes.
        background: `color-mix(in srgb, ${railColor} ${past ? 7 : 13}%, var(--surface-2))`,
        border: `1.5px solid ${todayCell ? "var(--accent)" : `color-mix(in srgb, ${railColor} ${past ? 14 : 26}%, transparent)`}`,
      }}
    >
      {/* Colour rail — the at-a-glance signal that survives any theme. */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[var(--r)]"
        style={{ background: railColor, opacity: past ? 0.45 : 1 }}
      />

      <div className="flex items-start justify-between gap-1">
        <span className={past ? "text-sm font-black text-[var(--text-2)]" : "text-sm font-black text-[var(--text)]"}>{dn}</span>
        <div className="flex items-center gap-1 shrink-0">
          {info.hasLab && <FlaskConical className="w-3 h-3 text-[var(--lab)]" />}
          {todayCell ? (
            <span className="flex h-2.5 w-2.5">
              <span className="animate-ping absolute h-2.5 w-2.5 rounded-full bg-[var(--accent)] opacity-70" />
              <span className="relative rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
            </span>
          ) : markMeta ? (
            <span className="w-4 h-4 rounded-full grid place-items-center text-white" style={{ background: markMeta.color }}>
              {React.cloneElement(markMeta.icon as React.ReactElement, { className: "w-2.5 h-2.5" })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Say it in words too — colour alone isn't accessible. */}
      {label && !past && (
        <span className="mt-1 text-[10px] font-black uppercase tracking-wider" style={{ color: railColor }}>
          {label}
        </span>
      )}

      <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
        {(info.subjects || []).slice(0, 6).map((s, i) => (
          <span key={i} className="w-2 h-2 rounded-full" style={{ background: s.color, opacity: past ? 0.5 : 1 }} />
        ))}
      </div>

      <span className="absolute inset-0 rounded-[var(--r)] ring-2 ring-[var(--accent)] opacity-0 group-hover:opacity-45 transition-opacity pointer-events-none" />
    </motion.button>
  );
}

function NavBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }} onClick={onClick} aria-label={label}
      className="w-11 h-11 grid place-items-center rounded-[var(--r-sm)] bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
      {children}
    </motion.button>
  );
}
