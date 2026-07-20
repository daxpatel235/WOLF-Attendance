import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, User, Sparkles, Backpack, GraduationCap, Check, History, CalendarCheck } from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { Button } from "../components/ui/Button";
import { Mascot } from "../components/ui/Mascot";

export function Onboarding() {
  const { refresh, mode, setMode } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [joining, setJoining] = useState<"start" | "mid">("start");
  const [trackFrom, setTrackFrom] = useState("");
  const total = 4;

  const complete = async () => {
    setBusy(true);
    const patch = {
      onboarded: true,
      firstName: name.trim() || "Student",
      institutionType: mode === "school" ? "School" : "College",
      // Per-subject numbers need a timetable, so those are collected in Settings.
      // All we can honestly capture here is the date to start counting from.
      trackingStart: joining === "mid" ? trackFrom : "",
    };
    try { await api.saveSettings(patch); } catch { /* mock */ }
    if (!(window as any).__TAURI_INTERNALS__) {
      const raw = localStorage.getItem("wolf_state");
      const s = raw ? JSON.parse(raw) : { settings: {} };
      s.settings = { ...(s.settings || {}), ...patch };
      localStorage.setItem("wolf_state", JSON.stringify(s));
    }
    setTimeout(refresh, 150);
  };

  const next = () => setStep((s) => Math.min(total - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-1.5 rounded-full transition-all duration-500" style={{ width: i === step ? 40 : 14, background: i <= step ? "var(--accent)" : "var(--surface-3)" }} />
          ))}
        </div>

        <div className="relative rounded-[var(--r-xl)] glass gradient-border shadow-[var(--shadow-lg)] p-8 md:p-12 overflow-hidden min-h-[440px] flex flex-col">
          <div className="absolute inset-0 paper-lines opacity-30 pointer-events-none" />
          <AnimatePresence mode="wait">
            {step === 0 && (
              <Step key="welcome">
                <div className="text-center flex-1 flex flex-col items-center justify-center">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
                    <Mascot size={120} />
                  </motion.div>
                  <h1 className="text-4xl font-black tracking-tight font-display mt-6 mb-3">Meet <span className="text-gradient">WOLF</span></h1>
                  <p className="text-lg text-[var(--text-2)] font-medium max-w-sm mb-8">Your academic companion that turns attendance into a game you actually want to win.</p>
                  <Button size="lg" onClick={next} iconRight={<ArrowRight className="w-5 h-5" />}>Get started</Button>
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step key="name">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="w-11 h-11 rounded-[var(--r-sm)] grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]"><User className="w-5 h-5" /></span>
                    <h2 className="text-2xl font-black tracking-tight font-display">What should we call you?</h2>
                  </div>
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name"
                    onKeyDown={(e) => e.key === "Enter" && name.trim() && next()}
                    className="w-full text-3xl font-black bg-transparent border-b-2 border-[var(--border)] focus:border-[var(--accent)] outline-none py-4 transition-colors placeholder:text-[var(--text-3)]/50 font-display" />
                  <p className="text-sm text-[var(--text-3)] font-medium mt-3">We'll use this to personalize your dashboard.</p>
                  <div className="mt-auto pt-8 flex items-center justify-between">
                    <Button variant="ghost" onClick={back} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
                    <Button onClick={next} disabled={!name.trim()} iconRight={<ArrowRight className="w-5 h-5" />}>Continue</Button>
                  </div>
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step key="vibe">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-11 h-11 rounded-[var(--r-sm)] grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]"><Sparkles className="w-5 h-5" /></span>
                    <h2 className="text-2xl font-black tracking-tight font-display">Pick your world</h2>
                  </div>
                  <p className="text-sm text-[var(--text-3)] font-medium mb-6">This transforms the entire app. You can switch anytime.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <VibeCard active={mode === "school"} onClick={() => setMode("school")} icon={<Backpack className="w-6 h-6" />} title="School" desc="Playful, colorful, rewarding. XP, badges & Wolfie." />
                    <VibeCard active={mode === "college"} onClick={() => setMode("college")} icon={<GraduationCap className="w-6 h-6" />} title="College" desc="Premium, minimal, focused. Glass, insights & calm." />
                  </div>

                  <div className="mt-auto pt-8 flex items-center justify-between">
                    <Button variant="ghost" onClick={back} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
                    <Button onClick={next} iconRight={<ArrowRight className="w-5 h-5" />}>Continue</Button>
                  </div>
                </div>
              </Step>
            )}

            {step === 3 && (
              <Step key="when">
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-11 h-11 rounded-[var(--r-sm)] grid place-items-center bg-[var(--accent-soft)] text-[var(--accent)]"><History className="w-5 h-5" /></span>
                    <h2 className="text-2xl font-black tracking-tight font-display">Where are you starting?</h2>
                  </div>
                  <p className="text-sm text-[var(--text-3)] font-medium mb-6">
                    So WOLF plans from what actually happened — never from a guess.
                  </p>

                  <div className="space-y-3">
                    <VibeCard active={joining === "start"} onClick={() => setJoining("start")} icon={<CalendarCheck className="w-6 h-6" />}
                      title="From day one" desc="It's the beginning of the semester — track everything." wide />
                    <VibeCard active={joining === "mid"} onClick={() => setJoining("mid")} icon={<History className="w-6 h-6" />}
                      title="I'm joining mid-semester" desc="Classes already happened. You'll enter those totals next." wide />
                  </div>

                  <AnimatePresence initial={false}>
                    {joining === "mid" && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                        <div className="pt-5">
                          <label className="block text-xs font-black text-[var(--text-3)] uppercase tracking-widest mb-2.5">Start tracking from</label>
                          <input type="date" className="field max-w-xs" value={trackFrom} onChange={(e) => setTrackFrom(e.target.value)} />
                          <p className="text-xs font-medium text-[var(--text-3)] mt-2">
                            Add your attendance so far under Settings → Catch-up baseline once your timetable is in.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-auto pt-8 flex items-center justify-between">
                    <Button variant="ghost" onClick={back} icon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
                    <Button onClick={complete} disabled={busy} iconRight={<Sparkles className="w-5 h-5" />}>{busy ? "Setting up…" : "Enter WOLF"}</Button>
                  </div>
                </div>
              </Step>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.div initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -26 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative flex-1 flex flex-col">
      {children}
    </motion.div>
  );
}

function VibeCard({ active, onClick, icon, title, desc, wide }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string; wide?: boolean }) {
  return (
    <motion.button whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`relative text-left p-5 rounded-[var(--r-lg)] border-2 transition-all overflow-hidden w-full ${wide ? "flex items-center gap-4" : ""} ${active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--border-strong)]"}`}>
      {active && <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--accent)] grid place-items-center text-white"><Check className="w-3.5 h-3.5" /></span>}
      <div className={`w-12 h-12 rounded-[var(--r)] grid place-items-center shrink-0 ${wide ? "" : "mb-3"} ${active ? "bg-[image:var(--grad)] text-white shadow-[var(--shadow-glow)]" : "bg-[var(--surface-3)] text-[var(--text-2)]"}`}>{icon}</div>
      <div className={wide ? "min-w-0 pr-7" : ""}>
        <div className="text-lg font-black font-display">{title}</div>
        <div className="text-xs font-semibold text-[var(--text-3)] mt-1 leading-relaxed">{desc}</div>
      </div>
    </motion.button>
  );
}
