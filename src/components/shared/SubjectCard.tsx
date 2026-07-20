import React from "react";
import { motion } from "framer-motion";
import { FlaskConical, AlertTriangle, History } from "lucide-react";
import { ProgressRing } from "./ProgressRing";
import type { SubjectCard as SubjectCardT, Baseline } from "../../types";

const statusColor = (s: string) => (s === "safe" ? "var(--go)" : s === "warning" ? "var(--warn)" : "var(--danger)");

/** `baseline` is what the student reported for the period before they started
 *  tracking. Surfaced so the totals below are never mysterious. */
export function SubjectCard({ s, baseline }: { s: SubjectCardT; baseline?: Baseline }) {
  const col = statusColor(s.status);
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="group relative flex items-center gap-5 p-5 rounded-[var(--r-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] transition-shadow overflow-hidden"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(220px circle at 100% 0%, ${col}18, transparent 60%)` }} />
      {/* left accent bar in subject color */}
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full" style={{ background: s.color }} />

      <ProgressRing pct={s.currentPct} color={col} size={72} />

      <div className="flex-1 min-w-0 relative">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <h3 className="font-black text-[15px] leading-tight truncate">{s.name}</h3>
          {s.kind === "lab" && <FlaskConical className="w-3.5 h-3.5 text-[var(--lab)] shrink-0" />}
          <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest" style={{ background: `${col}18`, color: col }}>{s.status}</span>
        </div>

        <div className="text-xs font-semibold text-[var(--text-2)]">
          Attended <strong className="text-[var(--text)]">{s.attendedSoFar}</strong> / <strong className="text-[var(--text)]">{s.minNeeded}</strong> needed · min {s.reqPercent}%
        </div>

        <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, s.currentPct)}%`, background: col }} />
        </div>

        {baseline && baseline.conducted > 0 && (
          <div className="text-[11px] font-bold text-[var(--text-3)] mt-2 flex items-center gap-1.5"
            title="Attendance you reported for before you started tracking with WOLF">
            <History className="w-3 h-3 shrink-0" />
            Includes {baseline.attended}/{baseline.conducted} from before tracking
          </div>
        )}

        <div className="text-[11px] font-bold text-[var(--text-3)] mt-2 flex items-center gap-1.5">
          {s.impossible ? (
            <span className="inline-flex items-center gap-1 text-[var(--danger)]"><AlertTriangle className="w-3 h-3" /> Can't reach minimum</span>
          ) : (
            <>Can still skip <strong className="text-[var(--text-2)]">{s.canStillSkipDays}</strong> day{s.canStillSkipDays === 1 ? "" : "s"}</>
          )}
        </div>
      </div>
    </motion.div>
  );
}
