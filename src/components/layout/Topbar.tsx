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

  // Search actually navigates: pages, subjects and exams that match the query.
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const PAGES: { label: string; view: string; words: string }[] = [
    { label: "Dashboard", view: "dashboard", words: "home today overview" },
    { label: "Timetable", view: "timetable", words: "schedule classes grid periods" },
    { label: "Subjects", view: "subjects", words: "courses attendance percentage" },
    { label: "Insights", view: "analytics", words: "analytics trend charts" },
    { label: "Calendar", view: "calendar", words: "days holiday mark log" },
    { label: "Academics", view: "academics", words: "tasks assignments cgpa gpa exams" },
    { label: "Focus", view: "productivity", words: "pomodoro timer goals productivity" },
    { label: "Profile", view: "profile", words: "badges level xp" },
    { label: "Settings", view: "settings", words: "semester reminder startup targets baseline" },
  ];
  const needle = q.trim().toLowerCase();
  const results = needle
    ? [
        ...PAGES.filter((p) => `${p.label} ${p.words}`.toLowerCase().includes(needle)).map((p) => ({ key: `p-${p.view}`, label: p.label, hint: "Page", view: p.view })),
        ...(st?.plan?.subjects || []).filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(needle))
          .map((s) => ({ key: `s-${s.key}`, label: s.name, hint: `Subject · ${Math.round(s.currentPct)}%`, view: "subjects" })),
        ...(st?.exams || []).filter((e) => `${e.title} ${e.subject}`.toLowerCase().includes(needle))
          .map((e) => ({ key: `e-${e.id}`, label: e.title, hint: `Exam · ${e.date}`, view: "academics" })),
      ].slice(0, 8)
    : [];
  const pick = (view: string) => { go(view); setQ(""); setOpen(false); inputRef.current?.blur(); };
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform || "");

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
      <div className="flex-1 max-w-xl mx-auto relative">
        <div className="group flex items-center gap-3 h-11 px-4 rounded-[var(--r)] glass shadow-[var(--shadow-sm)] transition-all focus-within:shadow-[var(--shadow)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
          <Search className="w-[18px] h-[18px] text-[var(--text-3)] group-focus-within:text-[var(--accent)] transition-colors shrink-0" />
          <input
            ref={inputRef} value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => Math.min(results.length - 1, i + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => Math.max(0, i - 1)); }
              else if (e.key === "Enter" && results[sel]) { e.preventDefault(); pick(results[sel].view); }
              else if (e.key === "Escape") { setQ(""); setOpen(false); inputRef.current?.blur(); }
            }}
            aria-label="Search"
            placeholder="Search pages, subjects, exams…"
            className="w-full bg-transparent outline-none text-[15px] font-medium placeholder:text-[var(--text-3)]"
          />
          <div className="hidden sm:flex items-center gap-1 opacity-70 shrink-0">
            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--text-3)] text-[11px] font-bold">{isMac ? "⌘" : "Ctrl"}</kbd>
            <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] text-[var(--text-3)] text-[11px] font-bold">K</kbd>
          </div>
        </div>
        {open && needle && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 rounded-[var(--r)] glass shadow-[var(--shadow-lg)] p-1.5">
            {results.length === 0 ? (
              <div className="px-3 py-2.5 text-sm font-semibold text-[var(--text-3)]">No matches for “{q.trim()}”.</div>
            ) : results.map((r, i) => (
              <button key={r.key} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r.view)} onMouseEnter={() => setSel(i)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[var(--r-sm)] text-left text-sm font-bold ${i === sel ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text)]"}`}>
                <span className="truncate">{r.label}</span>
                <span className="text-[11px] font-semibold text-[var(--text-3)] shrink-0">{r.hint}</span>
              </button>
            ))}
          </div>
        )}
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
