import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Settings as SettingsIcon, User, Building2, Target, Check, Backpack, GraduationCap, History } from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { AnimatedCard } from "../components/ui/AnimatedCard";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { BaselineEditor } from "../components/shared/BaselineEditor";
import type { Baseline } from "../types";
import { stagger, rise } from "../lib/motion";

export function Settings() {
  const { st, refresh, setMode } = useApp();
  const [f, setF] = useState<any>({ ...(st?.settings || {}) });
  const [saved, setSaved] = useState(false);
  const set = (k: string, v: unknown) => setF((p: any) => ({ ...p, [k]: v }));

  // A baseline only exists if there's a tracking start to anchor it to.
  const [catchUp, setCatchUp] = useState<boolean>(!!st?.settings?.trackingStart);
  const [baselines, setBaselines] = useState<Record<string, Baseline>>({ ...(st?.settings?.baselines || {}) });
  const subjects = st?.plan?.subjects || [];

  const save = async () => {
    await api.saveSettings({
      firstName: f.firstName, age: String(f.age || ""), email: f.email,
      institutionType: f.institutionType, institutionName: f.institutionName, className: f.className,
      division: f.division, semester: f.semester, timetableName: f.timetableName, batchName: f.batchName,
      semesterStart: f.semesterStart, semesterEnd: f.semesterEnd,
      minPercent: +f.minPercent, labPercent: +f.labPercent, targetPercent: +f.targetPercent,
      attendanceMode: f.attendanceMode,
      // Turning catch-up off clears both halves, so a stale baseline can never
      // keep skewing the numbers after the student disables it.
      trackingStart: catchUp ? f.trackingStart || "" : "",
      baselines: catchUp ? baselines : {},
    });
    refresh();
    setSaved(true); setTimeout(() => setSaved(false), 2200);
  };

  const inst = /school/i.test(f.institutionType || "") ? "school" : "college";
  const setInst = (m: "school" | "college") => { set("institutionType", m === "school" ? "School" : "College"); setMode(m); };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Your profile, institution and attendance targets." icon={<SettingsIcon className="w-6 h-6" />} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-4xl mx-auto">
        <motion.div variants={rise}>
          <AnimatedCard spotlight={false}>
            <SectionTitle icon={<User className="w-5 h-5" />}>Personal</SectionTitle>
            <div className="grid sm:grid-cols-3 gap-5">
              <Field label="First name" value={f.firstName} onChange={(v) => set("firstName", v)} placeholder="e.g. Dax" />
              <Field label="Age" value={f.age} onChange={(v) => set("age", v)} placeholder="19" type="number" />
              <Field label="Email" value={f.email} onChange={(v) => set("email", v)} placeholder="you@example.com" type="email" />
            </div>
          </AnimatedCard>
        </motion.div>

        <motion.div variants={rise}>
          <AnimatedCard spotlight={false}>
            <SectionTitle icon={<Building2 className="w-5 h-5" />}>Institution</SectionTitle>
            <div className="mb-6">
              <Label>Experience</Label>
              <Segmented<"school" | "college"> layoutId="inst" value={inst} onChange={setInst}
                options={[{ value: "college", label: "College", icon: <GraduationCap className="w-4 h-4" /> }, { value: "school", label: "School", icon: <Backpack className="w-4 h-4" /> }]} />
            </div>
            <div className="grid sm:grid-cols-2 gap-5 mb-5">
              <Field label="Institution name" value={f.institutionName} onChange={(v) => set("institutionName", v)} placeholder="e.g. ABC Institute" />
              <Field label="Timetable name" value={f.timetableName} onChange={(v) => set("timetableName", v)} placeholder="e.g. Sem 4" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <Field label="Class / Year" value={f.className} onChange={(v) => set("className", v)} placeholder="SE" />
              <Field label="Division" value={f.division} onChange={(v) => set("division", v)} placeholder="A" />
              <Field label="Batch" value={f.batchName} onChange={(v) => set("batchName", v)} placeholder="B2" />
              <Field label="Semester" value={f.semester} onChange={(v) => set("semester", v)} placeholder="4" />
            </div>
          </AnimatedCard>
        </motion.div>

        <motion.div variants={rise}>
          <AnimatedCard spotlight={false}>
            <SectionTitle icon={<Target className="w-5 h-5" />}>Targets & semester</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-5 mb-6">
              <Field label="Semester start" value={f.semesterStart} onChange={(v) => set("semesterStart", v)} type="date" />
              <Field label="Semester end" value={f.semesterEnd} onChange={(v) => set("semesterEnd", v)} type="date" />
            </div>
            <div className="space-y-4 mb-6">
              <Slider label="Minimum attendance — lectures" value={f.minPercent} onChange={(v) => set("minPercent", v)} />
              <Slider label="Minimum attendance — labs" value={f.labPercent} onChange={(v) => set("labPercent", v)} />
              <Slider label="Target buffer" value={f.targetPercent} onChange={(v) => set("targetPercent", v)} />
            </div>
            <div>
              <Label>Count attendance for</Label>
              <Segmented<string> layoutId="attmode" value={f.attendanceMode || "both"} onChange={(v) => set("attendanceMode", v)}
                options={[{ value: "both", label: "Both" }, { value: "lectures", label: "Lectures" }, { value: "labs", label: "Labs" }]} />
            </div>
          </AnimatedCard>
        </motion.div>

        <motion.div variants={rise}>
          <AnimatedCard spotlight={false}>
            <SectionTitle icon={<History className="w-5 h-5" />}>Catch-up baseline</SectionTitle>
            <BaselineEditor
              subjects={subjects}
              enabled={catchUp}
              onToggle={setCatchUp}
              trackingStart={f.trackingStart || ""}
              onTrackingStart={(v) => set("trackingStart", v)}
              baselines={baselines}
              onBaselines={setBaselines}
              semesterStart={f.semesterStart}
              semesterEnd={f.semesterEnd}
            />
          </AnimatedCard>
        </motion.div>

        <motion.div variants={rise} className="flex justify-end pb-8">
          <Button size="lg" onClick={save} icon={<Check className="w-5 h-5" />}>Save changes</Button>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-[var(--r)] bg-[var(--go)] text-white font-bold shadow-[var(--shadow-lg)]">
            <Check className="w-5 h-5" /> Settings saved
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <h2 className="text-lg font-black font-display flex items-center gap-2.5 mb-6"><span className="w-9 h-9 rounded-[var(--r-sm)] grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]">{icon}</span>{children}</h2>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-black text-[var(--text-3)] uppercase tracking-widest mb-2.5">{children}</label>;
}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: any; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <input type={type} value={value || ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="field" />
    </div>
  );
}
function Slider({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div className="p-4 rounded-[var(--r)] bg-[var(--surface-2)] border border-[var(--border)]">
      <div className="flex justify-between items-center mb-3">
        <label className="text-sm font-bold text-[var(--text-2)]">{label}</label>
        <span className="text-lg font-black text-[var(--accent)] bg-[var(--accent-soft)] px-3 py-0.5 rounded-lg tabnums">{value || 0}%</span>
      </div>
      <input type="range" min={0} max={100} value={value || 0} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </div>
  );
}
