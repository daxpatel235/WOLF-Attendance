import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, FlaskConical, RotateCcw, CalendarOff, CalendarCheck, Info } from "lucide-react";
import type { Day, Mark } from "../../types";
import { api } from "../../api";
import { MarkControl, MARK_META } from "./MarkControl";
import { cn } from "../../lib/utils";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const CATEGORY_META: Record<string, { label: string; color: string; blurb: string }> = {
  "required":      { label: "Attend",       color: "var(--go)",      blurb: "You need this day to hit your minimum." },
  "attend":        { label: "Attending",    color: "var(--go)",      blurb: "You logged this as attended." },
  "past-attended": { label: "Attended",     color: "var(--go)",      blurb: "Counted toward your attendance." },
  "buffer":        { label: "Buffer",       color: "var(--buffer)",  blurb: "Optional — attend for extra safety margin." },
  "skip":          { label: "Free",         color: "var(--skip)",    blurb: "You can stay home without dropping below your minimum." },
  "skip-forced":   { label: "Skipped",      color: "var(--danger)",  blurb: "You logged this as skipped." },
  "past-skipped":  { label: "Missed",       color: "var(--danger)",  blurb: "Counted against your attendance." },
  "cancelled":     { label: "Cancelled",    color: "var(--holiday)", blurb: "Removed from your totals entirely." },
  "holiday":       { label: "Holiday",      color: "var(--holiday)", blurb: "No classes scheduled." },
  "pre-tracking":  { label: "Before tracking", color: "var(--holiday)", blurb: "Outside your tracking window — covered by your baseline instead." },
};

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, month: MONTHS[(m || 1) - 1], year: y };
}

interface Props {
  day: Day | null;
  /** Explicit per-subject overrides for this date (not inherited ones). */
  overrides: Record<string, Mark>;
  isHoliday: boolean;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Detail sheet for a single day: log the whole day at once, or override any
 * individual subject on it.
 */
export function DaySheet({ day, overrides, isHoliday, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  // Escape to dismiss, and don't let the page scroll behind the sheet.
  useEffect(() => {
    if (!day) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [day, onClose]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); onChanged(); } catch { /* the store refresh will resync */ }
    finally { setBusy(false); }
  };

  const body = (
    <AnimatePresence>
      {day && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label={`Attendance for ${day.date}`}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative w-full sm:max-w-lg max-h-[88vh] flex flex-col rounded-t-[var(--r-lg)] sm:rounded-[var(--r-lg)] glass shadow-[var(--shadow-lg)] overflow-hidden"
          >
            <Header day={day} onClose={onClose} />

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <DayLevel day={day} busy={busy} run={run} />
              <Subjects day={day} overrides={overrides} busy={busy} run={run} />
            </div>

            <Footer day={day} isHoliday={isHoliday} busy={busy} run={run} hasOverrides={Object.keys(overrides).length > 0} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(body, document.body);
}

function Header({ day, onClose }: { day: Day; onClose: () => void }) {
  const { day: dd, month, year } = prettyDate(day.date);
  const meta = CATEGORY_META[day.category] ?? { label: day.category, color: "var(--text-3)", blurb: "" };
  return (
    <div className="relative px-6 pt-6 pb-5 border-b border-[var(--border)] shrink-0">
      <div
        className="absolute inset-0 opacity-[0.10] pointer-events-none"
        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${meta.color}, transparent 62%)` }}
      />
      <div className="relative flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-[var(--r)] grid place-items-center shrink-0 shadow-[var(--shadow-sm)]"
          style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
        >
          <span className="text-2xl font-black tabnums leading-none">{dd}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-black font-display leading-tight truncate">{day.weekday}</h2>
          <p className="text-sm font-semibold text-[var(--text-3)]">{month} {dd}, {year}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide"
              style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
            >
              {meta.label}
            </span>
            {day.isToday && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-[var(--accent-soft)] text-[var(--accent)]">
                Today
              </span>
            )}
            {day.hasLab && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ background: "color-mix(in srgb, var(--lab) 16%, transparent)", color: "var(--lab)" }}>
                <FlaskConical className="w-3 h-3" /> Lab
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose} aria-label="Close"
          className="w-9 h-9 grid place-items-center rounded-[var(--r-sm)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {meta.blurb && <p className="relative text-[13px] font-medium text-[var(--text-2)] mt-3">{meta.blurb}</p>}
    </div>
  );
}

function DayLevel({ day, busy, run }: { day: Day; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  return (
    <section>
      <SectionLabel>Log the whole day</SectionLabel>
      <MarkControl
        value={day.marked}
        disabled={busy}
        onChange={(m) => run(() => api.markDay(day.date, m ?? ""))}
      />
      <p className="text-xs font-medium text-[var(--text-3)] mt-2.5">
        {day.marked
          ? MARK_META[day.marked].hint
          : "Not logged yet. Until you log it, WOLF treats it as part of your plan."}
      </p>
    </section>
  );
}

function Subjects({
  day, overrides, busy, run,
}: { day: Day; overrides: Record<string, Mark>; busy: boolean; run: (fn: () => Promise<unknown>) => void }) {
  if (day.totalLectures <= 0) {
    return (
      <section>
        <SectionLabel>Classes</SectionLabel>
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[var(--text-3)] py-3">
          <CalendarOff className="w-4 h-4" /> No classes scheduled on this day.
        </div>
      </section>
    );
  }

  // Prefer sessions (they carry times); fall back to the aggregated subject list.
  const rows = day.sessions.length > 0
    ? day.sessions.map((s) => ({ key: s.key, name: s.name, sub: `${s.start}–${s.end}`, color: s.color, kind: s.kind, mark: s.mark }))
    : day.subjects.map((s) => ({ key: s.key, name: s.name, sub: `${s.count} period${s.count === 1 ? "" : "s"}`, color: s.color, kind: s.kind, mark: s.mark }));

  return (
    <section>
      <SectionLabel>
        Per class
        <span className="ml-2 normal-case tracking-normal font-semibold text-[var(--text-3)]">
          override just one subject
        </span>
      </SectionLabel>
      <div className="space-y-2">
        {rows.map((r) => {
          const explicit = overrides[r.key] != null;
          return (
            <div
              key={r.key + r.sub}
              className={cn(
                "flex flex-wrap items-center gap-3 p-3 rounded-[var(--r)] border transition-colors",
                explicit ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface-2)]",
              )}
            >
              <span className="w-1.5 h-9 rounded-full shrink-0" style={{ background: r.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm truncate">{r.name}</span>
                  {r.kind === "lab" && <FlaskConical className="w-3.5 h-3.5 text-[var(--lab)] shrink-0" />}
                </div>
                <div className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider tabnums">
                  {r.sub}{explicit && " · overridden"}
                </div>
              </div>
              <MarkControl
                size="sm" labels={false} value={r.mark} inherited={!explicit} disabled={busy}
                onChange={(m) => run(() => api.markSubject(day.date, r.key, m ?? ""))}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-start gap-2 mt-3 text-xs font-medium text-[var(--text-3)]">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <p>A faded button means the mark comes from the whole day. Tap one to override that subject; tap it again to go back.</p>
      </div>
    </section>
  );
}

function Footer({
  day, isHoliday, busy, run, hasOverrides,
}: { day: Day; isHoliday: boolean; busy: boolean; run: (fn: () => Promise<unknown>) => void; hasOverrides: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-2)] shrink-0">
      <FooterBtn
        disabled={busy}
        onClick={() => run(() => (isHoliday ? api.removeHoliday(day.date) : api.addHoliday(day.date)))}
        icon={isHoliday ? <CalendarCheck className="w-4 h-4" /> : <CalendarOff className="w-4 h-4" />}
      >
        {isHoliday ? "Remove holiday" : "Mark as holiday"}
      </FooterBtn>
      {hasOverrides && (
        <FooterBtn disabled={busy} onClick={() => run(() => api.clearSubjects(day.date))} icon={<RotateCcw className="w-4 h-4" />}>
          Reset overrides
        </FooterBtn>
      )}
    </div>
  );
}

function FooterBtn({ children, onClick, icon, disabled }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }} onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[var(--r-sm)] text-sm font-bold border border-[var(--border)] bg-[var(--surface-solid)] text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
    >
      {icon}{children}
    </motion.button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-3)] mb-3">{children}</h3>;
}
