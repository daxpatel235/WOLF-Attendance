import React from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { useApp } from "../../store";
import { Mascot } from "./Mascot";
import { Button } from "./Button";
import { popIn } from "../../lib/motion";

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * Friendly empty state — Wolfie the mascot in School mode, an elegant campus
 * glyph in College mode. Never a dead end.
 */
export function EmptyState({ title, message, actionLabel, onAction, icon }: EmptyStateProps) {
  const { mode } = useApp();

  return (
    <motion.div
      variants={popIn} initial="hidden" animate="show"
      className="w-full min-h-[60vh] flex flex-col items-center justify-center text-center px-6"
    >
      <div className="relative mb-8">
        <div className="absolute inset-0 blur-3xl rounded-full bg-[image:var(--grad)] opacity-25 scale-110" aria-hidden />
        {mode === "school" ? (
          <Mascot size={140} className="relative drop-shadow-xl" />
        ) : (
          <div className="relative w-32 h-32 rounded-[var(--r-xl)] grid place-items-center bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-lg)] backdrop-blur-xl anim-float">
            <div className="text-[var(--accent)]">{icon ?? <Compass className="w-14 h-14" />}</div>
          </div>
        )}
      </div>
      <h2 className="text-3xl font-black tracking-tight mb-3 font-display">{title}</h2>
      <p className="text-[var(--text-2)] text-lg max-w-md mb-8 font-medium leading-relaxed">{message}</p>
      {actionLabel && onAction && (
        <Button size="lg" onClick={onAction}>{actionLabel}</Button>
      )}
    </motion.div>
  );
}
