import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Search, Flame, Sparkles, GraduationCap, Backpack } from "lucide-react";
import { useApp } from "../../store";
import { api } from "../../api";
import { levelInfo, overallStats, streakInfo } from "../../analytics";
import { greeting, initials } from "../../lib/utils";

export function Topbar() {
  const { st, go, mode, setMode } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");

  const plan = st?.plan;
  const name = st?.settings?.firstName || "Student";
  let lvl = 1, title = "Cub", streak = 0;
  if (plan?.ready) {
    const stats = overallStats(plan);
    const s = streakInfo(plan);
    const li = levelInfo(stats, s);
    lvl = li.level; title = li.title; streak = s.current;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const switchMode = (m: "school" | "college") => {
    if (m === mode) return;
    setMode(m);
    api.saveSettings({ institutionType: m === "school" ? "School" : "College" }).catch(() => {});
  };

  return (
    <header className="shrink-0 flex items-center gap-5 w-full h-20 pl-6 pr-8">
      {/* Greeting */}
      <div className="hidden lg:block min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-black tracking-tight font-display truncate">
            {greeting()}, <span className="text-gradient">{name}</span>
          </h1>
          <motion.span animate={{ rotate: [0, 18, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3 }}>👋</motion.span>
        </div>
        <p className="text-xs font-semibold text-[var(--text-3)] mt-0.5">
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Command bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <div className="group flex items-center gap-3 h-11 px-4 rounded-[var(--r)] glass shadow-[var(--shadow-sm)] transition-all focus-within:shadow-[var(--shadow)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
          <Search className="w-[18px] h-[18px] text-[var(--text-3)] group-focus-within:text-[var(--accent)] transition-colors shrink-0" />
          <input
            ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search classes, subjects, tasks…"
            className="w-full bg-transparent outline-none text-[15px] font-medium placeholder:text-[var(--text-3)]"
          />
          <div className="hidden sm:flex items-center gap-1 opacity-70 shrink-0">
            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--text-3)] text-[11px] font-bold">⌘</kbd>
            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--text-3)] text-[11px] font-bold">K</kbd>
          </div>
        </div>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Identity switch */}
        <div className="hidden md:flex items-center gap-0.5 rounded-[var(--r)] glass p-1 shadow-[var(--shadow-sm)]">
          {([["college", GraduationCap], ["school", Backpack]] as const).map(([m, Icon]) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`relative w-9 h-8 grid place-items-center rounded-[calc(var(--r)-6px)] transition-colors ${mode === m ? "text-[var(--accent-contrast)]" : "text-[var(--text-3)] hover:text-[var(--text)]"}`}
              aria-label={`${m} mode`} title={`${m[0].toUpperCase()}${m.slice(1)} mode`}>
              {mode === m && <motion.span layoutId="mode-pill" transition={{ type: "spring", stiffness: 400, damping: 30 }} className="absolute inset-0 rounded-[calc(var(--r)-6px)] bg-[image:var(--grad)]" />}
              <Icon className="relative z-10 w-4 h-4" />
            </button>
          ))}
        </div>

        {streak > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 h-10 px-3 rounded-[var(--r)] glass shadow-[var(--shadow-sm)]">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="font-black text-sm tabnums">{streak}</span>
          </div>
        )}

        {/* Profile */}
        <button onClick={() => go("profile")} aria-label="Profile" className="group flex items-center gap-2.5 h-12 pl-1.5 pr-3 rounded-[var(--r)] glass shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] transition-all">
          <div className="relative w-9 h-9 rounded-[calc(var(--r)-8px)] bg-[image:var(--grad)] grid place-items-center text-[var(--accent-contrast)] font-black text-sm shadow-[var(--shadow-glow)]">
            {initials(name)}
            <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 px-1 h-4 rounded-full bg-[var(--surface-solid)] border border-[var(--border)] text-[9px] font-black text-[var(--accent)] shadow-sm">
              <Sparkles className="w-2 h-2" />{lvl}
            </span>
          </div>
          <div className="hidden xl:block text-left pr-1">
            <div className="text-[13px] font-black leading-tight group-hover:text-[var(--accent)] transition-colors">{title}</div>
            <div className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest">Level {lvl}</div>
          </div>
        </button>
      </div>
    </header>
  );
}
