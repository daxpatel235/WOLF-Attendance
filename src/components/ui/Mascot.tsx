import React from "react";
import { motion } from "framer-motion";

/**
 * WOLFIE — the friendly pack mascot. A rounded, Duolingo-ish wolf face built
 * from pure SVG so it inherits theme colors and needs no assets. Blinks + bobs.
 */
export function Mascot({ size = 120, className, animate = true }: { size?: number; className?: string; animate?: boolean }) {
  return (
    <motion.svg
      width={size} height={size} viewBox="0 0 120 120" fill="none"
      className={className}
      initial={animate ? { y: 0 } : undefined}
      animate={animate ? { y: [0, -6, 0], rotate: [-2, 2, -2] } : undefined}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        <linearGradient id="wolfBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      {/* ears */}
      <path d="M28 34 L20 8 L46 24 Z" fill="url(#wolfBody)" />
      <path d="M92 34 L100 8 L74 24 Z" fill="url(#wolfBody)" />
      <path d="M30 30 L26 16 L40 26 Z" fill="var(--accent-soft)" />
      <path d="M90 30 L94 16 L80 26 Z" fill="var(--accent-soft)" />
      {/* head */}
      <path d="M60 18 C88 18 100 40 100 64 C100 90 82 106 60 106 C38 106 20 90 20 64 C20 40 32 18 60 18 Z" fill="url(#wolfBody)" />
      {/* snout patch */}
      <path d="M60 54 C74 54 84 64 84 78 C84 94 72 104 60 104 C48 104 36 94 36 78 C36 64 46 54 60 54 Z" fill="#fff" fillOpacity="0.92" />
      {/* eyes */}
      <motion.g animate={animate ? { scaleY: [1, 1, 0.1, 1, 1] } : undefined} transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }} style={{ transformOrigin: "60px 58px" }}>
        <circle cx="47" cy="58" r="6.5" fill="#241c4e" />
        <circle cx="73" cy="58" r="6.5" fill="#241c4e" />
        <circle cx="49" cy="56" r="2" fill="#fff" />
        <circle cx="75" cy="56" r="2" fill="#fff" />
      </motion.g>
      {/* nose */}
      <path d="M60 72 C64 72 66 75 66 78 C66 82 63 85 60 85 C57 85 54 82 54 78 C54 75 56 72 60 72 Z" fill="#241c4e" />
      {/* smile */}
      <path d="M52 88 C56 93 64 93 68 88" stroke="#241c4e" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* cheeks */}
      <circle cx="40" cy="76" r="5" fill="var(--accent-2)" fillOpacity="0.35" />
      <circle cx="80" cy="76" r="5" fill="var(--accent-2)" fillOpacity="0.35" />
    </motion.svg>
  );
}
