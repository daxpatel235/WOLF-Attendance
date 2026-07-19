import React from "react";
import { motion } from "framer-motion";
import {
  Flame, Trophy, ArrowRight, Sparkles, Clock, CalendarCheck, CalendarX,
  Coffee, FlaskConical, CheckCircle2, XCircle, Zap, GraduationCap, ChevronRight,
} from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { overallStats, streakInfo, levelInfo, daysUntil, badges } from "../analytics";
import { SubjectCard } from "../components/shared/SubjectCard";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { ProgressRing } from "../components/shared/ProgressRing";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Mascot } from "../components/ui/Mascot";
import { stagger, rise } from "../lib/motion";
import { dayLabel } from "../lib/utils";

const nowHHMM = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export function Dashboard() {
  const { st, go, refresh, mode } = useApp();

  if (!st?.plan?.ready) {
    return (
      <EmptyState
        icon={<GraduationCap className="w-14 h-14" />}
        title="Let's set up your semester"
        message="Add your semester dates and import your timetable, and WOLF will compute the fewest days you need to attend."
        actionLabel="Configure settings"
        onAction={() => go("settings")}
      />
    );
  }

  const plan = st.plan;
  const b = plan.banner!;
  const stats = overallStats(plan);
  const streak = streakInfo(plan);
  const lvl = levelInfo(stats, streak);
  const earned = badges(plan, stats, streak, st.settings.targetPercent).filter((x) => x.earned);
  const today = st.today || "";
  const todayDay = plan.days.find((d) => d.isToday) || plan.days.find((d) => d.date === today);
  const sessions = (todayDay?.sessions || []).slice().sort((a, b) => toMin(a.start) - toMin(b.start));
  const now = nowHHMM();

  const nextExam = (st.exams || [])
    .filter((e) => !e.done && e.date && (daysUntil(e.date, today) ?? -1) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextExamDays = nextExam ? daysUntil(nextExam.date, today) : null;

  const nextSession = sessions.find((s) => toMin(s.start) > now);
  const minsToNext = nextSession ? toMin(nextSession.start) - now : null;

  const ovCol = stats.pct >= st.settings.targetPercent ? "var(--go)" : stats.pct >= st.settings.minPercent ? "var(--warn)" : "var(--danger)";
  const pctToNextLvl = lvl.span > 0 ? Math.round((lvl.intoLevel / lvl.span) * 100) : 0;

  const marked = todayDay?.marked;
  const mark = async (status: string) => {
    if (!today) return;
    try { await api.markDay(today, marked === status ? "" : status); refresh(); } catch { /* ignore */ }
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

      {/* ── HERO ── */}
      <motion.div variants={rise}>
        <AnimatedCard glow className="p-0 overflow-hidden rounded-[var(--hero-radius)]">
          <div className="relative grid lg:grid-cols-[1.6fr_1fr]">
            <div className="p-8 lg:p-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-black uppercase tracking-widest">
                  <Sparkles className="w-3.5 h-3.5" /> {b.todayAction || "Your plan"}
                </span>
              </div>
              <h2 className="text-3xl lg:text-[2.6rem] font-black tracking-tight leading-[1.08] font-display mb-3">
                {mode === "school" ? "Go get 'em! Attend " : "You must attend "}
                <span className="text-gradient">{b.attendDaysCount}</span> more day{b.attendDaysCount === 1 ? "" : "s"}
              </h2>
              <p className="text-[var(--text-2)] text-lg font-medium">
                You can stay home <strong className="text-[var(--text)]">{b.stayHomeCount}</strong> day{b.stayHomeCount === 1 ? "" : "s"}
                {b.bufferDaysCount > 0 && <> · <strong className="text-[var(--text)]">{b.bufferDaysCount}</strong> buffer day{b.bufferDaysCount === 1 ? "" : "s"}</>}.
              </p>

              {plan.feasible === false && (
                <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-[var(--r-sm)] bg-[var(--danger)]/10 text-[var(--danger)] text-sm font-bold">
                  ⚠️ Some subjects can't reach the minimum even attending every day.
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-7">
                <Stat label="Attend" value={b.attendDaysCount} color="var(--go)" icon={<CalendarCheck className="w-4 h-4" />} />
                <Stat label="Stay home" value={b.stayHomeCount} color="var(--skip)" icon={<Coffee className="w-4 h-4" />} />
                <Stat label="Buffer" value={b.bufferDaysCount} color="var(--buffer)" icon={<CalendarX className="w-4 h-4" />} />
              </div>
            </div>

            {/* attendance ring panel */}
            <div className="relative flex flex-col items-center justify-center gap-4 p-8 border-t lg:border-t-0 lg:border-l border-[var(--border)]"
              style={{ background: "radial-gradient(120% 120% at 100% 0%, var(--accent-soft), transparent 60%)" }}>
              {mode === "school" && <div className="absolute top-4 right-4 opacity-90"><Mascot size={54} /></div>}
              <BigRing pct={stats.pct} color={ovCol} />
              <div className="text-center">
                <div className="text-sm font-black uppercase tracking-widest text-[var(--text-3)]">Overall attendance</div>
                <div className="text-xs font-semibold text-[var(--text-2)] mt-1">
                  {stats.attended}/{stats.conducted} attended · min {st.settings.minPercent}%
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── LEFT: today + subjects ── */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={rise}>
            <AnimatedCard spotlight={false}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black font-display flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--go)] shadow-[0_0_12px_var(--go)] animate-[pulseGlow_2s_infinite]" />
                  Today's classes
                </h3>
                {nextSession && (
                  <span className="text-sm font-bold text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Next in {minsToNext! < 60 ? `${minsToNext}m` : `${Math.floor(minsToNext! / 60)}h ${minsToNext! % 60}m`}
                  </span>
                )}
              </div>

              {sessions.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10">
                  <div className="w-16 h-16 rounded-[var(--r)] grid place-items-center bg-[var(--surface-3)] text-[var(--text-3)] mb-3"><Coffee className="w-8 h-8" /></div>
                  <p className="font-bold text-[var(--text)]">No classes today</p>
                  <p className="text-sm text-[var(--text-3)] font-medium">Enjoy the day off — or get ahead on your goals.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-3 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[var(--go)] before:via-[var(--border)] before:to-transparent">
                  {sessions.map((s, i) => {
                    const active = now >= toMin(s.start) && now < toMin(s.end);
                    const past = now >= toMin(s.end);
                    return (
                      <motion.div key={i} whileHover={{ x: 4 }} className="relative flex items-center gap-4 group">
                        <span className={`absolute -left-6 w-4 h-4 rounded-full border-4 border-[var(--surface-solid)] ${active ? "bg-[var(--go)] shadow-[0_0_14px_var(--go)]" : past ? "bg-[var(--text-3)]" : "bg-[var(--surface-3)]"}`} />
                        <div className="flex-1 flex items-center gap-4 p-4 rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface-2)] group-hover:bg-[var(--surface)] group-hover:shadow-[var(--shadow-sm)] transition-all"
                          style={active ? { borderColor: "var(--go)" } : undefined}>
                          <div className="w-1.5 h-10 rounded-full shrink-0" style={{ background: s.color }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-[15px] truncate">{s.name}</span>
                              {s.kind === "lab" && <FlaskConical className="w-3.5 h-3.5 text-[var(--lab)] shrink-0" />}
                            </div>
                            <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider">{s.code || s.kind}</div>
                          </div>
                          <div className={`text-sm font-black tabnums ${active ? "text-[var(--go)]" : "text-[var(--text-2)]"}`}>{s.start}<span className="text-[var(--text-3)]">–{s.end}</span></div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* mark today */}
              {todayDay && todayDay.totalLectures > 0 && (
                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[var(--border)]">
                  <span className="text-sm font-bold text-[var(--text-3)] mr-auto">Log today</span>
                  <MarkBtn active={marked === "attended"} onClick={() => mark("attended")} color="var(--go)" icon={<CheckCircle2 className="w-4 h-4" />} label="Attended" />
                  <MarkBtn active={marked === "skipped"} onClick={() => mark("skipped")} color="var(--danger)" icon={<XCircle className="w-4 h-4" />} label="Skipped" />
                </div>
              )}
            </AnimatedCard>
          </motion.div>

          <motion.div variants={rise}>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xl font-black font-display">Subjects overview</h3>
              <button onClick={() => go("subjects")} className="text-sm font-bold text-[var(--accent)] hover:underline flex items-center gap-1 group">
                View all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {plan.subjects.slice(0, 4).map((s) => <SubjectCard key={s.name} s={s} />)}
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT: level + streak + exam + actions ── */}
        <div className="space-y-6">
          <motion.div variants={rise}>
            <AnimatedCard tilt glow className="bg-[image:var(--grad)] text-[var(--accent-contrast)] border-none">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-[var(--r)] bg-white/20 grid place-items-center backdrop-blur"><Trophy className="w-5 h-5" /></div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest opacity-80">Level {lvl.level}</div>
                    <div className="text-lg font-black font-display leading-tight">{lvl.title}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black tabnums">{lvl.xp}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">XP</div>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-black/20 overflow-hidden">
                <motion.div className="h-full rounded-full bg-white/90" initial={{ width: 0 }} animate={{ width: `${pctToNextLvl}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
              </div>
              <div className="flex justify-between text-[11px] font-bold mt-2 opacity-90">
                <span>{lvl.intoLevel} / {lvl.span} XP</span>
                <span>Level {lvl.level + 1} →</span>
              </div>
            </AnimatedCard>
          </motion.div>

          <motion.div variants={rise} className="grid grid-cols-2 gap-4">
            <MiniStat onClick={() => go("analytics")} icon={<Flame className="w-6 h-6" />} grad="from-orange-400 to-red-500" value={`${streak.current}`} label="Day streak" />
            <MiniStat onClick={() => go("profile")} icon={<Zap className="w-6 h-6" />} grad="from-violet-500 to-indigo-600" value={`${earned.length}`} label="Badges" />
          </motion.div>

          <motion.div variants={rise}>
            <AnimatedCard>
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-3)] mb-4">Next exam</h3>
              {nextExam ? (
                <button onClick={() => go("academics")} className="w-full flex items-center gap-4 text-left group">
                  <div className="w-14 h-14 rounded-[var(--r)] bg-gradient-to-br from-rose-400 to-orange-400 grid place-items-center text-white shrink-0 shadow-[var(--shadow-sm)]">
                    <span className="text-lg font-black tabnums">{nextExamDays}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-black truncate group-hover:text-[var(--accent)] transition-colors">{nextExam.title}</div>
                    <div className="text-xs font-bold text-[var(--text-3)]">{nextExam.subject || "Exam"} · {dayLabel(nextExamDays)}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-3)] ml-auto group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <p className="text-sm font-semibold text-[var(--text-3)] py-2">No upcoming exams. Add them in Academics.</p>
              )}
            </AnimatedCard>
          </motion.div>

          <motion.div variants={rise}>
            <AnimatedCard spotlight={false}>
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-3)] mb-4">Quick actions</h3>
              <div className="grid grid-cols-2 gap-2.5">
                <QuickAction onClick={() => go("timetable")} label="Timetable" />
                <QuickAction onClick={() => go("calendar")} label="Calendar" />
                <QuickAction onClick={() => go("productivity")} label="Focus" />
                <QuickAction onClick={() => go("settings")} label="Settings" />
              </div>
            </AnimatedCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -3 }} className="flex items-center gap-3 px-4 py-3 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
      <span className="w-9 h-9 rounded-[var(--r-sm)] grid place-items-center text-white shrink-0" style={{ background: color }}>{icon}</span>
      <div>
        <div className="text-2xl font-black leading-none tabnums" style={{ color }}>{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mt-1">{label}</div>
      </div>
    </motion.div>
  );
}

function BigRing({ pct, color }: { pct: number; color: string }) {
  const size = 168, sw = 14, r = (size - sw) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: off }} transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 10px ${color}66)` }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-4xl font-black tabnums" style={{ color }}>{stats0(pct)}<span className="text-lg">%</span></div>
      </div>
    </div>
  );
}
const stats0 = (n: number) => Math.round(n);

function MarkBtn({ active, onClick, color, icon, label }: { active: boolean; onClick: () => void; color: string; icon: React.ReactNode; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--r-sm)] text-sm font-bold border-2 transition-colors"
      style={active ? { background: color, borderColor: color, color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
      {icon}{label}
    </motion.button>
  );
}

function MiniStat({ onClick, icon, grad, value, label }: { onClick: () => void; icon: React.ReactNode; grad: string; value: string; label: string }) {
  return (
    <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.96 }} onClick={onClick}
      className="flex flex-col gap-2 p-4 rounded-[var(--r-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)] transition-all text-left">
      <span className={`w-11 h-11 rounded-[var(--r)] grid place-items-center text-white bg-gradient-to-br ${grad} shadow-[var(--shadow-sm)]`}>{icon}</span>
      <div>
        <div className="text-2xl font-black tabnums leading-none">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mt-1">{label}</div>
      </div>
    </motion.button>
  );
}

function QuickAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }} onClick={onClick}
      className="flex items-center justify-between px-3.5 py-3 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)] text-sm font-bold hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors group">
      {label}<ArrowRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </motion.button>
  );
}
