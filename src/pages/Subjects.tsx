import React, { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { useApp } from "../store";
import { overallStats } from "../analytics";
import { SubjectCard } from "../components/shared/SubjectCard";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { Segmented } from "../components/ui/Segmented";
import { stagger, rise } from "../lib/motion";

type Filter = "all" | "safe" | "warning" | "danger";

export function Subjects() {
  const { st, go } = useApp();
  const plan = st?.plan;
  const [filter, setFilter] = useState<Filter>("all");

  if (!plan?.ready) {
    return <EmptyState icon={<BookOpen className="w-14 h-14" />} title="No subjects yet" message="Import your timetable and WOLF will track attendance for every lecture and lab automatically." actionLabel="Build timetable" onAction={() => go("timetable")} />;
  }

  const stats = overallStats(plan);
  const norm = (s: string) => (s === "safe" ? "safe" : s === "warning" ? "warning" : "danger");
  const shown = plan.subjects.filter((s) => filter === "all" || norm(s.status) === filter);

  return (
    <div>
      <PageHeader
        title="Subjects" subtitle="Attendance status and headroom for every subject."
        icon={<BookOpen className="w-6 h-6" />}
        actions={
          <Segmented<Filter> layoutId="subjfilter" value={filter} onChange={setFilter} size="sm"
            options={[
              { value: "all", label: `All ${plan.subjects.length}` },
              { value: "safe", label: `Safe ${stats.safe}` },
              { value: "warning", label: `Watch ${stats.warning}` },
              { value: "danger", label: `Risk ${stats.danger}` },
            ]} />
        }
      />
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((s) => <motion.div key={s.key} variants={rise}><SubjectCard s={s} baseline={st?.settings?.baselines?.[s.key]} /></motion.div>)}
      </motion.div>
      {shown.length === 0 && <p className="text-center text-[var(--text-3)] font-semibold py-16">No subjects in this category — nice work. 🎉</p>}
    </div>
  );
}
