import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Ban } from "lucide-react";
import type { Mark } from "../../types";
import { cn } from "../../lib/utils";

/** The three states a day (or a single subject on a day) can be logged as. */
export const MARK_META: Record<Mark, { label: string; short: string; color: string; icon: React.ReactNode; hint: string }> = {
  attended:  { label: "Attended",  short: "Went",      color: "var(--go)",     icon: <CheckCircle2 className="w-4 h-4" />, hint: "You were present — counts toward your percentage." },
  skipped:   { label: "Skipped",   short: "Skipped",   color: "var(--danger)", icon: <XCircle className="w-4 h-4" />,      hint: "You were absent — the class still counts against you." },
  cancelled: { label: "Cancelled", short: "Cancelled", color: "var(--holiday)", icon: <Ban className="w-4 h-4" />,         hint: "The class never happened — removed from the total entirely." },
};

export const MARKS: Mark[] = ["attended", "skipped", "cancelled"];

interface Props {
  value: Mark | null;
  onChange: (m: Mark | null) => void;
  /** `sm` is the inline per-subject control; `md` is the day-level one. */
  size?: "sm" | "md";
  /** Show text labels alongside the icons. */
  labels?: boolean;
  /** Renders muted, e.g. an inherited (not explicitly set) mark. */
  inherited?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * Tri-state mark picker. Clicking the active option clears it, which is how you
 * fall back from a per-subject override to the whole-day mark.
 */
export function MarkControl({ value, onChange, size = "md", labels = true, inherited = false, className, disabled }: Props) {
  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} role="group" aria-label="Attendance">
      {MARKS.map((m) => {
        const meta = MARK_META[m];
        const active = value === m;
        return (
          <motion.button
            key={m}
            type="button"
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.93 }}
            whileHover={disabled ? undefined : { y: -1 }}
            onClick={() => onChange(active ? null : m)}
            title={meta.hint}
            aria-pressed={active}
            // Icon-only variants still need a name for screen readers.
            aria-label={meta.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--r-sm)] font-bold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
              !active && "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--border-strong)]",
            )}
            style={
              active
                ? inherited
                  // Inherited from the day mark: tinted, not solid, so an explicit
                  // override reads as visually "stronger" than an inherited one.
                  ? { background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, borderColor: `color-mix(in srgb, ${meta.color} 45%, transparent)`, color: meta.color }
                  : { background: meta.color, borderColor: meta.color, color: "#fff" }
                : undefined
            }
          >
            {meta.icon}
            {labels && <span>{size === "sm" ? meta.short : meta.label}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Small read-only chip for showing a resolved mark in dense layouts. */
export function MarkChip({ mark, className }: { mark: Mark | null; className?: string }) {
  if (!mark) return null;
  const meta = MARK_META[mark];
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide", className)}
      style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
    >
      {meta.icon}
      {meta.short}
    </span>
  );
}
