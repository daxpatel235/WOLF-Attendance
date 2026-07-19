import type { Variants, Transition } from "framer-motion";

/** Spring presets shared across the app for a consistent physical feel. */
export const spring = {
  soft:  { type: "spring", stiffness: 260, damping: 26 } as Transition,
  snappy:{ type: "spring", stiffness: 420, damping: 30 } as Transition,
  bouncy:{ type: "spring", stiffness: 500, damping: 20 } as Transition,
  gentle:{ type: "spring", stiffness: 140, damping: 20 } as Transition,
};

/** Page-level enter/exit used by the router. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -10, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};

/** Staggered container + item for grids/lists. */
export const stagger: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 22 } },
};
