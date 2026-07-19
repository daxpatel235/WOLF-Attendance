import React from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Percent, ShieldCheck, Lock } from "lucide-react";
import { useApp } from "../store";
import { overallStats, streakInfo, levelInfo, badges } from "../analytics";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { EmptyState } from "../components/ui/EmptyState";
import { Mascot } from "../components/ui/Mascot";
import { stagger, rise } from "../lib/motion";
import { initials } from "../lib/utils";

export function Profile() {
  const { st, go, mode } = useApp();
  const plan = st?.plan;

  if (!plan?.ready) {
    return <EmptyState title="No profile yet" message="Import a timetable and start logging attendance to build your profile, earn XP and unlock badges." actionLabel="Set up now" onAction={() => go("settings")} />;
  }

  const stats = overallStats(plan);
  const streak = streakInfo(plan);
  const lvl = levelInfo(stats, streak);
  const progress = lvl.span > 0 ? (lvl.intoLevel / lvl.span) * 100 : 0;
  const allBadges = badges(plan, stats, streak, st!.settings.targetPercent);
  const unlocked = allBadges.filter((b) => b.earned).length;
  const name = st!.settings.firstName || "Student";

  const xpParts = [
    { label: "Days attended", value: streak.attendedDays * 10, hint: `${streak.attendedDays} × 10` },
    { label: "Longest streak", value: streak.longest * 6, hint: `${streak.longest} × 6` },
    { label: "Subjects kept safe", value: stats.safe * 40, hint: `${stats.safe} × 40` },
    { label: "Attendance bonus", value: Math.max(0, Math.round((stats.pct - 60) * 3)), hint: `>60%` },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      {/* identity + level hero */}
      <motion.div variants={rise}>
        <AnimatedCard glow tilt className="overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative shrink-0">
              <div className="w-28 h-28 rounded-[var(--r-xl)] bg-[image:var(--grad)] grid place-items-center text-[var(--accent-contrast)] text-4xl font-black font-display shadow-[var(--shadow-glow)]">
                {mode === "school" ? <Mascot size={82} /> : initials(name)}
              </div>
              <span className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-[var(--surface-solid)] border border-[var(--border)] text-xs font-black text-[var(--accent)] shadow-[var(--shadow-sm)]">Lv {lvl.level}</span>
            </div>

            <div className="flex-1 w-full text-center md:text-left">
              <h1 className="text-3xl font-black tracking-tight font-display">{name}</h1>
              <p className="text-[var(--text-2)] font-semibold mt-1">
                {lvl.title} · <span className="text-[var(--text-3)]">{st!.settings.institutionName || (mode === "school" ? "School" : "College")}</span>
              </p>

              <div className="mt-5">
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <span className="text-[var(--text-3)] uppercase tracking-wider text-xs">Progress to Level {lvl.level + 1}</span>
                  <span className="text-[var(--accent)] tabnums">{lvl.intoLevel} / {lvl.span} XP</span>
                </div>
                <div className="h-3.5 rounded-full bg-[var(--surface-3)] overflow-hidden shadow-inner">
                  <motion.div className="relative h-full rounded-full bg-[image:var(--grad)]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1.4, ease: "easeOut" }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_2.2s_infinite]" />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedCard>
      </motion.div>

      {/* quick stats */}
      <motion.div variants={rise} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon={<Percent className="w-5 h-5" />} grad="from-emerald-400 to-teal-500" value={`${stats.pct}%`} label="Overall" />
        <StatTile icon={<Flame className="w-5 h-5" />} grad="from-orange-400 to-red-500" value={`${streak.current}`} label="Current streak" />
        <StatTile icon={<ShieldCheck className="w-5 h-5" />} grad="from-violet-500 to-indigo-600" value={`${stats.safe}/${stats.subjects}`} label="Subjects safe" />
        <StatTile icon={<Trophy className="w-5 h-5" />} grad="from-amber-300 to-yellow-500" value={`${unlocked}/${allBadges.length}`} label="Badges" />
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* badges */}
        <motion.div variants={rise} className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-black font-display flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /> Achievements</h2>
            <span className="text-sm font-bold text-[var(--text-3)]">{unlocked} / {allBadges.length} unlocked</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {allBadges.map((b, i) => (
              <motion.div key={b.label} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={`relative flex items-center gap-4 p-4 rounded-[var(--r-lg)] border transition-all overflow-hidden ${b.earned ? "bg-[var(--surface)] border-[var(--border)] shadow-[var(--shadow-sm)]" : "bg-[var(--surface-2)] border-[var(--border)] opacity-70"}`}>
                {b.earned && <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-[image:var(--grad)] opacity-15 blur-xl" />}
                <div className={`w-14 h-14 rounded-[var(--r)] grid place-items-center text-2xl shrink-0 ${b.earned ? "bg-[var(--accent-soft)]" : "bg-[var(--surface-3)] grayscale"}`}>{b.icon}</div>
                <div className="min-w-0">
                  <div className="font-black flex items-center gap-1.5">{b.label} {!b.earned && <Lock className="w-3 h-3 text-[var(--text-3)]" />}</div>
                  <div className="text-xs font-semibold text-[var(--text-3)] leading-snug mt-0.5">{b.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* xp breakdown */}
        <motion.div variants={rise}>
          <AnimatedCard className="h-full">
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-3)] mb-5">How you earned XP</h3>
            <div className="space-y-4">
              {xpParts.map((p) => (
                <div key={p.label}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-sm font-bold">{p.label}</span>
                    <span className="text-sm font-black text-[var(--accent)] tabnums">+{p.value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                    <motion.div className="h-full rounded-full bg-[image:var(--grad)]" initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (p.value / Math.max(1, lvl.xp)) * 100)}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                  </div>
                  <div className="text-[10px] font-bold text-[var(--text-3)] mt-1">{p.hint}</div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-5 border-t border-[var(--border)] flex justify-between items-center">
              <span className="text-sm font-bold text-[var(--text-3)]">Total XP</span>
              <span className="text-2xl font-black text-gradient tabnums">{lvl.xp}</span>
            </div>
          </AnimatedCard>
        </motion.div>
      </div>
    </motion.div>
  );
}

function StatTile({ icon, grad, value, label }: { icon: React.ReactNode; grad: string; value: string; label: string }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="flex items-center gap-3.5 p-4 rounded-[var(--r-lg)] bg-[var(--surface)] border border-[var(--border)] shadow-[var(--shadow-sm)]">
      <span className={`w-11 h-11 rounded-[var(--r)] grid place-items-center text-white bg-gradient-to-br ${grad} shadow-[var(--shadow-sm)]`}>{icon}</span>
      <div>
        <div className="text-2xl font-black tabnums leading-none">{value}</div>
        <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mt-1">{label}</div>
      </div>
    </motion.div>
  );
}
