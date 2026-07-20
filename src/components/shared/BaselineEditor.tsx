import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Info, FlaskConical, AlertTriangle } from "lucide-react";
import type { Baseline, SubjectCard } from "../../types";
import { cn } from "../../lib/utils";

interface Props {
  /** Subjects to collect a baseline for — from the computed plan. */
  subjects: SubjectCard[];
  enabled: boolean;
  onToggle: (v: boolean) => void;
  trackingStart: string;
  onTrackingStart: (v: string) => void;
  baselines: Record<string, Baseline>;
  onBaselines: (b: Record<string, Baseline>) => void;
  /** Semester bounds, so tracking start can't be set outside them. */
  semesterStart?: string;
  semesterEnd?: string;
}

/**
 * Mid-semester adoption. Without this, WOLF assumes every unmarked past day was
 * attended — a student joining in week 6 sees a reassuring 100%, gets told they
 * can skip, and fails. Here they state what actually happened before they
 * started tracking, and everything after is measured from the truth.
 */
export function BaselineEditor({
  subjects, enabled, onToggle, trackingStart, onTrackingStart,
  baselines, onBaselines, semesterStart, semesterEnd,
}: Props) {
  const setOne = (key: string, patch: Partial<Baseline>) => {
    const cur = baselines[key] ?? { conducted: 0, attended: 0 };
    const next = { ...cur, ...patch };
    next.conducted = Math.max(0, Math.round(next.conducted || 0));
    // Attending more classes than were held is not a thing.
    next.attended = Math.min(next.conducted, Math.max(0, Math.round(next.attended || 0)));
    onBaselines({ ...baselines, [key]: next });
  };

  const totals = Object.values(baselines).reduce(
    (acc, b) => ({ conducted: acc.conducted + (b?.conducted || 0), attended: acc.attended + (b?.attended || 0) }),
    { conducted: 0, attended: 0 },
  );
  const totalPct = totals.conducted > 0 ? (totals.attended / totals.conducted) * 100 : null;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-lg">
          <div className="font-black text-[15px]">Starting mid-semester?</div>
          <p className="text-sm font-medium text-[var(--text-2)] mt-1">
            By default WOLF assumes you attended every day before today. If you're
            joining late, tell it what really happened so the plan is built on facts.
          </p>
        </div>
        <Switch checked={enabled} onChange={onToggle} label="Enable catch-up baseline" />
      </div>

      <AnimatePresence initial={false}>
        {enabled && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-6 space-y-5">
              <div className="max-w-xs">
                <label className="block text-xs font-black text-[var(--text-3)] uppercase tracking-widest mb-2.5">
                  Start tracking from
                </label>
                <input
                  type="date" className="field" value={trackingStart}
                  min={semesterStart || undefined} max={semesterEnd || undefined}
                  onChange={(e) => onTrackingStart(e.target.value)}
                />
                <p className="text-xs font-medium text-[var(--text-3)] mt-2">
                  Days before this are never guessed at — your numbers below cover them.
                </p>
              </div>

              {subjects.length === 0 ? (
                <div className="flex items-start gap-2.5 p-4 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)] text-sm font-semibold text-[var(--text-2)]">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  Import a timetable first — then each subject shows up here.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-[1fr_6.5rem_6.5rem_4.5rem] gap-3 px-3 pb-1">
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-3)]">Subject</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-3)]">Held</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-3)]">Attended</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-[var(--text-3)] text-right">So far</span>
                  </div>
                  {subjects.map((s) => (
                    <Row key={s.key} subject={s} value={baselines[s.key]} onChange={(p) => setOne(s.key, p)} />
                  ))}
                </div>
              )}

              {totalPct !== null && (
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)]">
                  <History className="w-4 h-4 text-[var(--text-3)]" />
                  <span className="text-sm font-bold text-[var(--text-2)]">
                    Before tracking: {totals.attended}/{totals.conducted} classes
                  </span>
                  <span
                    className="ml-auto text-lg font-black tabnums px-3 py-0.5 rounded-lg"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {totalPct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ subject, value, onChange }: { subject: SubjectCard; value?: Baseline; onChange: (p: Partial<Baseline>) => void }) {
  const conducted = value?.conducted ?? 0;
  const attended = value?.attended ?? 0;
  const pct = conducted > 0 ? (attended / conducted) * 100 : null;
  const below = pct !== null && pct < subject.reqPercent;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-[1fr_6.5rem_6.5rem_4.5rem] gap-3 items-center p-3 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="col-span-2 sm:col-span-1 flex items-center gap-2.5 min-w-0">
        <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: subject.color }} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-sm truncate">{subject.name}</span>
            {subject.kind === "lab" && <FlaskConical className="w-3.5 h-3.5 text-[var(--lab)] shrink-0" />}
          </div>
          <div className="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider">
            {subject.code || subject.kind} · needs {subject.reqPercent}%
          </div>
        </div>
      </div>
      <NumField label="Held" value={conducted} onChange={(n) => onChange({ conducted: n })} />
      <NumField label="Attended" value={attended} onChange={(n) => onChange({ attended: n })} max={conducted} />
      <div className="col-span-2 sm:col-span-1 text-right">
        {pct === null ? (
          <span className="text-sm font-bold text-[var(--text-3)]">—</span>
        ) : (
          <span
            className={cn("inline-flex items-center gap-1 text-sm font-black tabnums", below ? "text-[var(--danger)]" : "text-[var(--go)]")}
            title={below ? `Below the ${subject.reqPercent}% this subject requires` : "On track"}
          >
            {below && <AlertTriangle className="w-3.5 h-3.5" />}
            {pct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange, max }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <label className="block">
      <span className="sm:hidden block text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-1">{label}</span>
      <input
        type="number" min={0} max={max} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field !h-10 text-center tabnums"
      />
    </label>
  );
}

/** Accessible switch — a real checkbox so it is keyboard- and label-driven. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none shrink-0">
      <input
        type="checkbox" className="sr-only peer" checked={checked} aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={cn(
          "relative w-12 h-7 rounded-full transition-colors duration-200 peer-focus-visible:ring-4 peer-focus-visible:ring-[var(--accent-soft)]",
          checked ? "bg-[var(--accent)]" : "bg-[var(--surface-3)] border border-[var(--border)]",
        )}
      >
        <motion.span
          layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-[var(--shadow-sm)]"
          style={{ left: checked ? "calc(100% - 1.5rem)" : "0.25rem" }}
        />
      </span>
    </label>
  );
}
