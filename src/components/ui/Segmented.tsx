import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface SegOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
  /** unique id so multiple controls don't share a layout animation. */
  layoutId?: string;
}

/** Sliding pill segmented control with a shared-element highlight. */
export function Segmented<T extends string>({ options, value, onChange, className, size = "md", layoutId = "seg" }: SegmentedProps<T>) {
  return (
    <div className={cn("relative inline-flex items-center gap-1 rounded-[var(--r)] bg-[var(--surface-3)] p-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 inline-flex items-center gap-2 rounded-[calc(var(--r)-6px)] font-bold capitalize transition-colors duration-200",
              size === "sm" ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5 text-[15px]",
              active ? "text-[var(--accent)]" : "text-[var(--text-3)] hover:text-[var(--text)]",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-[calc(var(--r)-6px)] bg-[var(--surface-solid)] shadow-[var(--shadow-sm)]"
              />
            )}
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
