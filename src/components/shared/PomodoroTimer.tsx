import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";
import { AnimatedCard } from "../ui/AnimatedCard";
import { usePersistentState } from "../../lib/usePersistentState";

const FOCUS_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;
type TimerMode = "focus" | "break";
type TimerState = { mode: TimerMode; endsAt: number | null; remaining: number };

/**
 * Pomodoro timer. It counts against a wall-clock deadline instead of ticking
 * a counter, so it stays accurate when the window is minimised to the tray
 * (where the WebView throttles timers), and its state is persisted so leaving
 * the Focus page does not reset a running session.
 */
export function PomodoroTimer({ onFocusComplete }: { onFocusComplete?: () => void }) {
  const [t, setT] = usePersistentState<TimerState>("pomodoro", { mode: "focus", endsAt: null, remaining: FOCUS_SECS });
  const [now, setNow] = useState(() => Date.now());
  const mode = t.mode;
  const isActive = t.endsAt != null;
  const timeLeft = isActive ? Math.max(0, Math.ceil((t.endsAt! - now) / 1000)) : t.remaining;
  const total = mode === "focus" ? FOCUS_SECS : BREAK_SECS;
  const setMode = (m: TimerMode) => setT({ mode: m, endsAt: null, remaining: m === "focus" ? FOCUS_SECS : BREAK_SECS });

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (!isActive || timeLeft > 0) return;
    // Session finished: record it and flip to the other phase.
    if (mode === "focus") onFocusComplete?.();
    setMode(mode === "focus" ? "break" : "focus");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => {
    const n = Date.now();
    setNow(n);
    setT((p) => (p.endsAt != null
      ? { ...p, endsAt: null, remaining: Math.max(0, Math.ceil((p.endsAt - n) / 1000)) }
      : { ...p, endsAt: n + (p.remaining > 0 ? p.remaining : total) * 1000 }));
  };
  const resetTimer = () => setT((p) => ({ ...p, endsAt: null, remaining: p.mode === "focus" ? FOCUS_SECS : BREAK_SECS }));

  const pct = ((total - timeLeft) / total) * 100;
    
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const color = mode === "focus" ? "var(--danger)" : "var(--go)";
  const bg = mode === "focus" ? "from-rose-400 to-red-500" : "from-emerald-400 to-green-500";

  return (
    <AnimatedCard className="w-full h-full flex flex-col items-center justify-center py-8 text-center" glow>
      <div className="flex gap-2 bg-[var(--surface-2)] p-1 rounded-xl mb-6">
        <button 
          onClick={() => setMode("focus")}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === "focus" ? "bg-[var(--surface)] shadow-sm text-[var(--danger)]" : "text-[var(--text-3)]"}`}
        >
          Focus
        </button>
        <button 
          onClick={() => setMode("break")}
          className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${mode === "break" ? "bg-[var(--surface)] shadow-sm text-[var(--go)]" : "text-[var(--text-3)]"}`}
        >
          Break
        </button>
      </div>

      <div className="relative w-40 h-40 mb-6 flex items-center justify-center group">
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--surface-3)" strokeWidth="6" />
          <motion.circle 
            cx="50" cy="50" r="45" fill="none" 
            stroke={color} 
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ strokeDasharray: "283 283", strokeDashoffset: 283 }}
            animate={{ strokeDashoffset: 283 - (283 * pct) / 100 }}
            transition={{ ease: "linear", duration: 1 }}
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div className="text-4xl font-black tracking-tighter" style={{ fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>
          {timeStr}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-auto">
        <button 
          onClick={resetTimer} aria-label="Reset timer"
          className="w-12 h-12 rounded-2xl bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        
        <button 
          onClick={toggleTimer} aria-label={isActive ? "Pause" : "Start"}
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${bg} text-white flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all`}
          style={{ boxShadow: `0 12px 24px ${color}40` }}
        >
          {isActive ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current" />}
        </button>
      </div>
    </AnimatedCard>
  );
}
