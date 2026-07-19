import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  children?: React.ReactNode;
  block?: boolean;
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm gap-1.5 rounded-[var(--r-sm)]",
  md: "h-11 px-5 text-[15px] gap-2 rounded-[var(--r)]",
  lg: "h-14 px-7 text-lg gap-2.5 rounded-[var(--r-lg)]",
};

const variants: Record<Variant, string> = {
  primary:
    "text-[var(--accent-contrast)] bg-[image:var(--grad)] shadow-[var(--shadow-glow)] sheen",
  secondary:
    "text-[var(--text)] bg-[var(--surface)] backdrop-blur-xl border border-[var(--border-strong)] shadow-[var(--shadow-sm)] hover:border-[var(--accent)]",
  soft:
    "text-[var(--accent)] bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] hover:brightness-105",
  ghost:
    "text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]",
  danger:
    "text-white bg-[var(--danger)] shadow-[0_10px_30px_-8px_var(--danger)] sheen",
};

/** Alive button: sheen sweep, click ripple, magnetic spring press. */
export function Button({
  variant = "primary", size = "md", icon, iconRight, children, block, className, onClick, ...props
}: ButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== id)), 600);
    }
    onClick?.(e);
  };

  return (
    <motion.button
      ref={ref}
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 24 }}
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center justify-center font-bold select-none overflow-hidden",
        "transition-[filter,background,border-color,color] duration-200 focus-visible:outline-none",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        sizes[size], variants[variant], block && "w-full", className,
      )}
      {...(props as any)}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute rounded-full bg-current opacity-25"
          style={{ left: r.x, top: r.y, width: 8, height: 8, transform: "translate(-50%,-50%)", animation: "ripple 0.6s ease-out forwards" }}
        />
      ))}
      {icon && <span className="relative z-10 shrink-0 grid place-items-center">{icon}</span>}
      {children && <span className="relative z-10">{children}</span>}
      {iconRight && <span className="relative z-10 shrink-0 grid place-items-center transition-transform group-hover:translate-x-0.5">{iconRight}</span>}
      <style>{`@keyframes ripple { to { width: 320px; height: 320px; opacity: 0; } }`}</style>
    </motion.button>
  );
}
