import React, { ReactNode, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

interface AnimatedCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: ReactNode;
  className?: string;
  /** Soft gradient glow behind the card. */
  glow?: boolean;
  /** Cursor-following spotlight highlight. */
  spotlight?: boolean;
  /** Subtle 3D tilt toward the cursor. */
  tilt?: boolean;
  /** Lift on hover (default true). */
  lift?: boolean;
}

/**
 * The workhorse surface of the app. Floating glass card with optional
 * cursor spotlight, 3D tilt and gradient glow — all GPU-accelerated.
 * API is a superset of the original so every existing call site upgrades for free.
 */
export function AnimatedCard({
  children, className, glow = false, spotlight = true, tilt = false, lift = true, style, ...props
}: AnimatedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const rx = useSpring(useTransform(my, [0, 100], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 100], [-6, 6]), { stiffness: 200, damping: 20 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    mx.set(px); my.set(py);
    el.style.setProperty("--mx", `${px}%`);
    el.style.setProperty("--my", `${py}%`);
  };
  const onLeave = () => { mx.set(50); my.set(50); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={spotlight || tilt ? onMove : undefined}
      onMouseLeave={spotlight || tilt ? onLeave : undefined}
      whileHover={lift ? { y: -4 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      style={{
        ...(tilt ? { rotateX: rx, rotateY: ry, transformPerspective: 1000 } : {}),
        ...style,
      }}
      className={cn(
        "group/card edge-hi relative rounded-[var(--r-lg)] border border-[var(--border)]",
        "bg-[var(--surface)] backdrop-blur-2xl",
        "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow)]",
        "transition-shadow duration-300 overflow-hidden p-6",
        className,
      )}
      {...props}
    >
      {glow && (
        <div
          aria-hidden
          className="absolute -inset-8 rounded-[var(--r-xl)] pointer-events-none z-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"
          style={{ background: "radial-gradient(280px circle at var(--mx,50%) var(--my,50%), var(--accent-soft), transparent 70%)" }}
        />
      )}
      {spotlight && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-[inherit] pointer-events-none z-0 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
          style={{ background: "radial-gradient(420px circle at var(--mx,50%) var(--my,50%), rgba(255,255,255,0.10), transparent 40%)" }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}
