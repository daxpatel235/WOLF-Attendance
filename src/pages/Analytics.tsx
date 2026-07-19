import React from "react";
import { motion } from "framer-motion";
import { PieChart, TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import { useApp } from "../store";
import { overallStats } from "../analytics";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { stagger, rise } from "../lib/motion";

const statusColor = (s: string, imp?: boolean) => (imp ? "var(--danger)" : s === "safe" ? "var(--go)" : s === "warning" ? "var(--warn)" : "var(--danger)");

export function Analytics() {
  const { st, go } = useApp();
  const plan = st?.plan;

  if (!plan?.ready) {
    return <EmptyState icon={<PieChart className="w-14 h-14" />} title="Nothing to analyze yet" message="Once you log a few days of attendance, WOLF will chart your trends and flag any subject at risk." actionLabel="Go to dashboard" onAction={() => go("dashboard")} />;
  }

  const stats = overallStats(plan);

  // Real cumulative-attendance curve from past teaching days.
  const past = (plan.days || [])
    .filter((d) => d.isPast && d.category !== "holiday" && d.totalLectures > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  let cAtt = 0, cCon = 0;
  const trend: number[] = [];
  for (const d of past) {
    const attended = d.category !== "past-skipped" && d.marked !== "skipped";
    cCon += d.totalLectures;
    if (attended) cAtt += d.totalLectures;
    trend.push(cCon > 0 ? (cAtt / cCon) * 100 : 100);
  }
  const points = trend.length >= 2 ? trend : [stats.pct, stats.pct];
  const delta = points[points.length - 1] - points[0];
  const isUp = delta >= 0;

  const w = 800, h = 200;
  const min = Math.max(0, Math.min(...points) - 6), max = Math.min(100, Math.max(...points) + 6), range = max - min || 1;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (points.length - 1)) * w} ${h - ((p - min) / range) * h}`).join(" ");

  const dist = [
    { label: "Safe", value: stats.safe, color: "var(--go)" },
    { label: "Watch", value: stats.warning, color: "var(--warn)" },
    { label: "Risk", value: stats.danger, color: "var(--danger)" },
  ];
  const totalSub = Math.max(1, stats.subjects);

  return (
    <div>
      <PageHeader title="Insights" subtitle="Deep dive into your attendance performance." icon={<PieChart className="w-6 h-6" />} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div variants={rise} className="lg:col-span-2">
            <AnimatedCard glow className="relative h-full overflow-hidden">
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div>
                  <h3 className="font-black text-lg flex items-center gap-2 font-display"><Activity className="w-5 h-5 text-[var(--accent)]" /> Attendance trend</h3>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-4xl font-black tabnums">{stats.pct}%</span>
                    <span className={`inline-flex items-center gap-1 text-sm font-black px-2.5 py-1 rounded-full ${isUp ? "bg-[var(--go)]/15 text-[var(--go)]" : "bg-[var(--danger)]/15 text-[var(--danger)]"}`}>
                      {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}{Math.abs(delta).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-3)] mt-1">Across {past.length} teaching days this semester</p>
                </div>
              </div>
              <div className="h-[150px] w-full">
                <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="agrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill="url(#agrad)" />
                  <motion.path d={path} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: "easeOut" }} />
                </svg>
              </div>
            </AnimatedCard>
          </motion.div>

          <motion.div variants={rise}>
            <AnimatedCard className="h-full flex flex-col">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-3)] mb-5">Subject health</h3>
              <div className="flex-1 flex flex-col justify-center gap-4">
                {dist.map((d) => (
                  <div key={d.label}>
                    <div className="flex justify-between text-sm font-bold mb-1.5"><span>{d.label}</span><span className="tabnums text-[var(--text-3)]">{d.value}</span></div>
                    <div className="h-2.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: d.color }} initial={{ width: 0 }} animate={{ width: `${(d.value / totalSub) * 100}%` }} transition={{ duration: 1, ease: "easeOut" }} />
                    </div>
                  </div>
                ))}
              </div>
              {stats.danger > 0 && (
                <div className="mt-5 flex items-center gap-2 p-3 rounded-[var(--r-sm)] bg-[var(--danger)]/10 text-[var(--danger)] text-sm font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {stats.danger} subject{stats.danger === 1 ? "" : "s"} need attention
                </div>
              )}
            </AnimatedCard>
          </motion.div>
        </div>

        <motion.div variants={rise}>
          <AnimatedCard spotlight={false}>
            <h3 className="font-black text-xl mb-5 font-display">Risk matrix</h3>
            <div className="overflow-x-auto -mx-2">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="text-left">
                    {["Subject", "Status", "Current", "Required", "Skip days"].map((th, i) => (
                      <th key={th} className={`py-3 px-3 text-[11px] font-black text-[var(--text-3)] uppercase tracking-widest ${i === 4 ? "text-right" : ""}`}>{th}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plan.subjects.map((s) => {
                    const col = statusColor(s.status, s.impossible);
                    return (
                      <tr key={s.name} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                        <td className="py-4 px-3">
                          <div className="font-black text-sm flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: s.color }} /> {s.name}</div>
                          {s.code && <div className="text-xs font-semibold text-[var(--text-3)] ml-4">{s.code}</div>}
                        </td>
                        <td className="py-4 px-3"><span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider rounded-full" style={{ background: `${col}18`, color: col }}>{s.impossible ? "critical" : s.status}</span></td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-2.5">
                            <span className="font-black w-11 tabnums">{s.currentPct}%</span>
                            <div className="w-20 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, s.currentPct)}%`, background: col }} /></div>
                          </div>
                        </td>
                        <td className="py-4 px-3 font-bold text-[var(--text-2)] tabnums">{s.reqPercent}%</td>
                        <td className="py-4 px-3 text-right"><span className="font-black text-lg tabnums" style={{ color: s.canStillSkipDays > 0 ? "var(--text)" : "var(--danger)" }}>{s.canStillSkipDays}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </AnimatedCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
