import React from "react";
import { motion } from "framer-motion";

interface ProgressRingProps {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function ProgressRing({ pct, color, size = 72, strokeWidth = 8, label }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className="relative grid place-items-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }}
          transition={{ duration: 1.3, ease: "easeOut", delay: 0.15 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="font-black tabnums text-[var(--text)]" style={{ fontSize: size * 0.26 }}>{Math.round(pct)}<span className="text-[0.6em] align-top">%</span></span>
        {label && <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-3)] mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
