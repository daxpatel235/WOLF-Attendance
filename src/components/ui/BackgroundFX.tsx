import React from "react";
import { useApp } from "../../store";

/**
 * Living wallpaper. Two atmospheres driven by the active institution mode —
 * pure CSS/SVG (no rAF), GPU-composited, pointer-transparent. Kept deliberately
 * subtle so it never competes with foreground content (stronger only on auth).
 *   · college → drifting aurora mesh + faint dot grid
 *   · school  → pastel sky, a couple of soft clouds + a paper plane
 */
export function BackgroundFX({ dense = false }: { dense?: boolean }) {
  const { mode, isDark } = useApp();
  const k = isDark ? 0.5 : 1;           // dark → calmer
  const b = dense ? 1.15 : 1;           // auth screens → a touch richer
  const cloudOp = isDark ? 0.1 : 0.42;

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, var(--bg) 0%, var(--bg-2) 100%)" }} />

      {mode === "college" ? (
        <>
          <Blob className="w-[44vw] h-[44vw] -top-[12vw] -left-[8vw]" color="var(--accent)" o={0.22 * k * b} dur={30} />
          <Blob className="w-[38vw] h-[38vw] top-[34vh] -right-[10vw]" color="var(--accent-2)" o={0.18 * k * b} dur={36} delay={-8} />
          <Blob className="w-[34vw] h-[34vw] -bottom-[12vw] left-[26vw]" color="var(--buffer)" o={0.12 * k * b} dur={32} delay={-14} />
          <div className="absolute inset-0 dot-grid opacity-[0.25]" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(120% 85% at 50% -10%, transparent 55%, var(--bg) 100%)" }} />
        </>
      ) : (
        <>
          <Blob className="w-[38vw] h-[38vw] -top-[10vw] right-[8vw]" color="var(--accent-3)" o={0.28 * k * b} dur={26} />
          <Blob className="w-[36vw] h-[36vw] top-[40vh] -left-[10vw]" color="var(--accent)" o={0.2 * k * b} dur={32} delay={-8} />
          <Blob className="w-[30vw] h-[30vw] bottom-[2vh] right-[18vw]" color="var(--accent-2)" o={0.16 * k * b} dur={30} delay={-14} />
          <div className="absolute inset-0 paper-lines" style={{ opacity: isDark ? 0.5 : 0.6 }} />
          {/* Clouds only read well on a bright pastel sky — skip them in dark mode
              where a white cloud turns into a murky grey blob. */}
          {!isDark && (
            <>
              <Cloud className="top-[10vh] scale-90" dur={120} delay={0} op={cloudOp} />
              <Cloud className="top-[64vh] scale-110" dur={150} delay={-70} op={cloudOp * 0.8} />
              {dense && <Plane className="top-[26vh]" dur={26} delay={-4} />}
            </>
          )}
        </>
      )}
      {/* legibility scrim so text always wins over the wallpaper */}
      <div className="absolute inset-0" style={{ background: isDark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

function Blob({ className, color, o, dur, delay = 0 }: { className: string; color: string; o: number; dur: number; delay?: number }) {
  return (
    <div className={`absolute rounded-full blur-[90px] ${className}`}
      style={{ background: color, opacity: o, animation: `auroraShift ${dur}s ease-in-out ${delay}s infinite`, willChange: "transform" }} />
  );
}

function Cloud({ className, dur, delay, op }: { className: string; dur: number; delay: number; op: number }) {
  return (
    <div className={`absolute left-0 ${className}`} style={{ animation: `drift ${dur}s linear ${delay}s infinite`, willChange: "transform" }}>
      <svg width="160" height="62" viewBox="0 0 180 70" fill="none">
        <g fill="#ffffff" fillOpacity={op}>
          <ellipse cx="60" cy="45" rx="55" ry="24" />
          <circle cx="55" cy="34" r="26" />
          <circle cx="92" cy="30" r="30" />
          <circle cx="120" cy="42" r="22" />
        </g>
      </svg>
    </div>
  );
}

function Plane({ className, dur, delay }: { className: string; dur: number; delay: number }) {
  return (
    <div className={`absolute left-0 ${className}`} style={{ animation: `fly ${dur}s linear ${delay}s infinite`, willChange: "transform" }}>
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <path d="M22 3 L2 11 L10 13 L12 21 L15 14 L22 3 Z" fill="var(--accent)" fillOpacity="0.7" />
        <path d="M10 13 L15 14 L12 21 Z" fill="var(--accent-2)" fillOpacity="0.75" />
      </svg>
    </div>
  );
}

export const SceneBackground = BackgroundFX;
