import React, { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowRight, Sparkles, CheckCircle2, CalendarCheck, TrendingUp, Backpack, GraduationCap } from "lucide-react";
import { useApp } from "../store";
import { api } from "../api";
import { Button } from "../components/ui/Button";
import { Mascot } from "../components/ui/Mascot";
import { stagger, rise } from "../lib/motion";

export function Login() {
  const { refresh, go, mode, setMode } = useApp();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  const finish = async () => {
    setBusy(true);
    try { await api.saveSettings({ onboarded: true }); } catch { /* mock */ }
    if (!(window as any).__TAURI_INTERNALS__) {
      const raw = localStorage.getItem("wolf_state");
      const s = raw ? JSON.parse(raw) : { settings: {} };
      s.settings = { ...(s.settings || {}), onboarded: true };
      localStorage.setItem("wolf_state", JSON.stringify(s));
    }
    go("dashboard");
    setTimeout(refresh, 120);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
      <div className="grid w-full max-w-6xl lg:grid-cols-2 rounded-[var(--r-xl)] overflow-hidden glass shadow-[var(--shadow-lg)] gradient-border min-h-[600px]">

        {/* ── Brand / scene ── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden"
          style={{ background: "linear-gradient(150deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%)" }}>
          <div className="absolute inset-0 paper-lines opacity-40" />
          <div className="absolute -bottom-16 -right-10 w-72 h-72 rounded-full bg-[image:var(--grad)] opacity-30 blur-3xl" />

          <motion.div variants={rise} className="relative flex items-center gap-3">
            {mode === "school"
              ? <Mascot size={52} />
              : <div className="w-12 h-12 rounded-[var(--r)] bg-[image:var(--grad)] grid place-items-center text-white font-black text-2xl font-display shadow-[var(--shadow-glow)]">W</div>}
            <div>
              <div className="text-2xl font-black tracking-tight font-display">WOLF</div>
              <div className="text-xs font-bold text-[var(--text-3)] uppercase tracking-[0.2em]">Attendance</div>
            </div>
          </motion.div>

          <motion.div variants={rise} className="relative">
            <h2 className="text-4xl font-black tracking-tight leading-[1.1] font-display mb-4">
              {mode === "school" ? <>Never miss a day.<br /><span className="text-gradient">Make it a game.</span></> : <>The fewest days in.<br /><span className="text-gradient">The best marks out.</span></>}
            </h2>
            <p className="text-[var(--text-2)] font-medium max-w-sm">
              {mode === "school"
                ? "Track attendance, earn XP and keep every subject in the green — with Wolfie cheering you on."
                : "Know exactly which days you can skip while staying safely above every attendance requirement."}
            </p>
          </motion.div>

          <motion.div variants={rise} className="relative flex flex-col gap-3">
            {[
              { icon: CalendarCheck, t: "Minimum-days planner, lab-aware" },
              { icon: TrendingUp, t: "Live insights, streaks & CGPA" },
              { icon: CheckCircle2, t: "100% private — runs on your device" },
            ].map((f) => (
              <div key={f.t} className="flex items-center gap-3 text-sm font-semibold text-[var(--text-2)]">
                <span className="w-8 h-8 rounded-[var(--r-sm)] grid place-items-center bg-[var(--surface)] border border-[var(--border)] text-[var(--accent)] shadow-sm"><f.icon className="w-4 h-4" /></span>
                {f.t}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── Form ── */}
        <div className="relative flex flex-col justify-center p-8 md:p-12 bg-[var(--surface)]">
          {/* theme preview */}
          <div className="absolute top-6 right-6 flex items-center gap-1 rounded-[var(--r)] bg-[var(--surface-3)] p-1">
            {([["college", GraduationCap], ["school", Backpack]] as const).map(([m, Icon]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`relative w-9 h-8 grid place-items-center rounded-[calc(var(--r)-6px)] transition-colors ${mode === m ? "text-[var(--accent-contrast)]" : "text-[var(--text-3)]"}`}
                title={`Preview ${m} theme`}>
                {mode === m && <motion.span layoutId="login-mode" className="absolute inset-0 rounded-[calc(var(--r)-6px)] bg-[image:var(--grad)]" />}
                <Icon className="relative z-10 w-4 h-4" />
              </button>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h1 className="text-3xl font-black tracking-tight font-display mb-1.5">Welcome back 👋</h1>
            <p className="text-[var(--text-2)] font-medium mb-8">Sign in to pick up where you left off.</p>

            <form onSubmit={(e) => { e.preventDefault(); finish(); }} className="space-y-4">
              <FloatingInput icon={<Mail className="w-[18px] h-[18px]" />} type="email" label="Email address" value={email} onChange={setEmail} />
              <FloatingInput icon={<Lock className="w-[18px] h-[18px]" />} type="password" label="Password" value={pwd} onChange={setPwd} />

              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setRemember((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-2)] select-none">
                  <span className={`w-5 h-5 rounded-md border-2 grid place-items-center transition-colors ${remember ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-strong)]"}`}>
                    {remember && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </span>
                  Remember me
                </button>
                <button type="button" className="text-sm font-bold text-[var(--accent)] hover:underline">Forgot password?</button>
              </div>

              <Button type="submit" block size="lg" className="mt-2 group" iconRight={<ArrowRight className="w-5 h-5" />}>
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs font-bold text-[var(--text-3)] uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SocialButton onClick={finish} label="Google"><GoogleIcon /></SocialButton>
              <SocialButton onClick={finish} label="GitHub"><GitHubIcon /></SocialButton>
            </div>

            <p className="text-center text-sm text-[var(--text-2)] font-medium mt-8">
              New here? <button onClick={finish} className="font-bold text-[var(--accent)] hover:underline inline-flex items-center gap-1">Create an account <Sparkles className="w-3.5 h-3.5" /></button>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function FloatingInput({ icon, type, label, value, onChange }: { icon: React.ReactNode; type: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative group">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-3)] group-focus-within:text-[var(--accent)] transition-colors z-10">{icon}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder=" " required
        className="peer w-full h-14 pl-12 pr-4 pt-4 rounded-[var(--r)] bg-[var(--surface-2)] border-2 border-[var(--border)] outline-none font-semibold
                   focus:border-[var(--accent)] focus:bg-[var(--surface-solid)] transition-all"
      />
      <label className="pointer-events-none absolute left-12 text-[var(--text-3)] font-semibold transition-all duration-200
                        top-1/2 -translate-y-1/2 text-[15px]
                        peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:text-[var(--accent)]
                        peer-[:not(:placeholder-shown)]:top-2.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px]">
        {label}
      </label>
    </div>
  );
}

function SocialButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onClick} type="button"
      className="flex items-center justify-center gap-2.5 h-12 rounded-[var(--r)] bg-[var(--surface-2)] border-2 border-[var(--border)] font-bold text-sm hover:border-[var(--accent)] transition-colors">
      {children}<span>{label}</span>
    </motion.button>
  );
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
);
const GitHubIcon = () => (
  <svg className="w-5 h-5 fill-[var(--text)]" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg>
);
