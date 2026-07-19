import React, { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import {
  LayoutGrid, CalendarRange, BookOpen, PieChart, CalendarDays,
  GraduationCap, Target, Settings, LogOut, Moon, Sun,
} from "lucide-react";
import { useApp } from "../../store";
import { Tooltip } from "../ui/Tooltip";
import { Mascot } from "../ui/Mascot";

interface NavItem { id: string; icon: React.ElementType; label: string; desc: string; key: string; }

const NAV: NavItem[] = [
  { id: "dashboard",    icon: LayoutGrid,    label: "Home",        desc: "Your day at a glance",        key: "1" },
  { id: "timetable",    icon: CalendarRange, label: "Timetable",   desc: "Weekly class schedule",       key: "2" },
  { id: "subjects",     icon: BookOpen,      label: "Subjects",    desc: "Attendance per subject",      key: "3" },
  { id: "calendar",     icon: CalendarDays,  label: "Calendar",    desc: "Plan the semester day by day",key: "4" },
  { id: "analytics",    icon: PieChart,      label: "Insights",    desc: "Trends & risk analysis",      key: "5" },
  { id: "academics",    icon: GraduationCap, label: "Academics",   desc: "Tasks, CGPA & exams",         key: "6" },
  { id: "productivity", icon: Target,        label: "Focus",       desc: "Pomodoro, goals & habits",    key: "7" },
];

export function Dock() {
  const { view, go, isDark, toggleDark, logout, mode } = useApp();

  return (
    <div className="shrink-0 h-full py-4 pl-4 pr-1 z-30 flex">
      <nav className="relative flex flex-col items-center w-[76px] h-full rounded-[var(--dock-radius)] glass shadow-[var(--shadow-lg)] py-4 overflow-visible">
        {/* Brand */}
        <button onClick={() => go("dashboard")} className="relative mb-3 group" aria-label="WOLF home">
          {mode === "school" ? (
            <div className="w-12 h-12 grid place-items-center rounded-[var(--r)] bg-[image:var(--grad)] shadow-[var(--shadow-glow)]">
              <Mascot size={38} animate={false} />
            </div>
          ) : (
            <div className="w-12 h-12 grid place-items-center rounded-[var(--r)] bg-[image:var(--grad)] text-white font-black text-2xl shadow-[var(--shadow-glow)] font-display group-hover:scale-105 transition-transform">
              W
            </div>
          )}
        </button>

        <div className="w-8 h-px bg-[var(--border)] mb-3" />

        {/* Primary nav */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          {NAV.map((n) => (
            <DockButton key={n.id} item={n} active={view === n.id} onClick={() => go(n.id)} />
          ))}
        </div>

        {/* Utilities */}
        <div className="flex flex-col items-center gap-1.5 mt-3">
          <div className="w-8 h-px bg-[var(--border)] mb-1.5" />
          <Tooltip label={<TipBody title={isDark ? "Light mode" : "Dark mode"} desc="Switch the vibe" />}>
            <IconShell onClick={toggleDark} ariaLabel="Toggle dark mode">
              <motion.span key={isDark ? "d" : "l"} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} className="grid place-items-center text-[var(--text-2)]">
                {isDark ? <Sun className="w-[22px] h-[22px]" /> : <Moon className="w-[22px] h-[22px]" />}
              </motion.span>
            </IconShell>
          </Tooltip>
          <Tooltip label={<TipBody title="Settings" desc="Profile & targets" k="," />}>
            <IconShell onClick={() => go("settings")} active={view === "settings"} ariaLabel="Settings">
              <Settings className={`w-[22px] h-[22px] transition-transform duration-500 group-hover/icon:rotate-90 ${view === "settings" ? "text-[var(--accent)]" : "text-[var(--text-2)]"}`} />
            </IconShell>
          </Tooltip>
          <Tooltip label={<TipBody title="Log out" desc="Return to sign in" />}>
            <IconShell onClick={logout} ariaLabel="Log out" danger>
              <LogOut className="w-[22px] h-[22px] text-[var(--danger)] transition-transform group-hover/icon:translate-x-0.5" />
            </IconShell>
          </Tooltip>
        </div>
      </nav>
    </div>
  );
}

function DockButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <Tooltip label={<TipBody title={item.label} desc={item.desc} k={item.key} />}>
      <MagneticButton onClick={onClick} active={active} ariaLabel={item.label}>
        {active && (
          <>
            <motion.span layoutId="dock-active" transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute inset-0 rounded-[var(--r)] bg-[image:var(--grad)] shadow-[var(--shadow-glow)]" />
            <motion.span layoutId="dock-indicator" transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute -left-[11px] top-1/2 -translate-y-1/2 w-[5px] h-6 rounded-full bg-[image:var(--grad)]" />
          </>
        )}
        <Icon className={`relative z-10 w-[23px] h-[23px] transition-all duration-300 ${active ? "text-[var(--accent-contrast)] scale-110" : "text-[var(--text-2)] group-hover/icon:text-[var(--accent)]"}`} />
      </MagneticButton>
    </Tooltip>
  );
}

/** Magnetic hover: the button leans toward the cursor. */
const MagneticButton = React.forwardRef<HTMLButtonElement, {
  children: React.ReactNode; onClick: () => void; active?: boolean; ariaLabel: string;
} & React.HTMLAttributes<HTMLButtonElement>>(({ children, onClick, active, ariaLabel, ...rest }, fref) => {
  const localRef = useRef<HTMLButtonElement | null>(null);
  const x = useMotionValue(0), y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 350, damping: 18 });
  const sy = useSpring(y, { stiffness: 350, damping: 18 });

  const move = (e: React.MouseEvent) => {
    const el = localRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 10);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 10);
  };
  const leave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={(node) => { localRef.current = node; if (typeof fref === "function") fref(node); else if (fref) (fref as any).current = node; }}
      onClick={onClick} onMouseMove={move} onMouseLeave={leave}
      style={{ x: sx, y: sy }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      aria-label={ariaLabel}
      className="group/icon relative w-12 h-12 grid place-items-center rounded-[var(--r)] hover:bg-[var(--surface-3)]"
      {...(rest as any)}
    >
      {children}
    </motion.button>
  );
});
MagneticButton.displayName = "MagneticButton";

const IconShell = React.forwardRef<HTMLButtonElement, {
  children: React.ReactNode; onClick: () => void; active?: boolean; ariaLabel: string; danger?: boolean;
} & React.HTMLAttributes<HTMLButtonElement>>(({ children, onClick, active, ariaLabel, danger, ...rest }, ref) => (
  <motion.button
    ref={ref} onClick={onClick} aria-label={ariaLabel}
    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
    transition={{ type: "spring", stiffness: 400, damping: 20 }}
    className={`group/icon relative w-12 h-12 grid place-items-center rounded-[var(--r)] transition-colors
      ${active ? "bg-[var(--accent-soft)]" : danger ? "hover:bg-[var(--danger)]/10" : "hover:bg-[var(--surface-3)]"}`}
    {...(rest as any)}
  >
    {children}
  </motion.button>
));
IconShell.displayName = "IconShell";

function TipBody({ title, desc, k }: { title: string; desc: string; k?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-[150px]">
      <div className="flex-1">
        <div className="font-bold text-[var(--text)] text-sm leading-tight font-display">{title}</div>
        <div className="text-[11px] text-[var(--text-3)] font-medium mt-0.5">{desc}</div>
      </div>
      {k && <kbd className="shrink-0 px-1.5 py-0.5 rounded-md bg-[var(--surface-3)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-3)] tabnums">⌘{k}</kbd>}
    </div>
  );
}
