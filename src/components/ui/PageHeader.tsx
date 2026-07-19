import React from "react";
import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Consistent, premium page title block. */
export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="flex flex-wrap items-end justify-between gap-4 mb-7">
      <div className="flex items-center gap-4">
        {icon && (
          <div className="w-12 h-12 rounded-[var(--r)] grid place-items-center bg-[image:var(--grad)] text-[var(--accent-contrast)] shadow-[var(--shadow-glow)] shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight font-display">{title}</h1>
          {subtitle && <p className="text-[var(--text-2)] font-medium mt-1">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}
