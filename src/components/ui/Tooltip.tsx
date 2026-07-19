import React from "react";
import * as RT from "@radix-ui/react-tooltip";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <RT.Provider delayDuration={120} skipDelayDuration={300}>{children}</RT.Provider>;
}

interface TooltipProps {
  children: React.ReactNode;
  label: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

/** Premium glass tooltip with rich content support. */
export function Tooltip({ children, label, side = "right", align = "center", sideOffset = 14 }: TooltipProps) {
  return (
    <RT.Root>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          align={align}
          sideOffset={sideOffset}
          className="z-[100] select-none rounded-[var(--r-sm)] glass px-3.5 py-2.5 shadow-[var(--shadow-lg)]
                     data-[state=delayed-open]:animate-[tipIn_0.16s_var(--ease-spring)]
                     data-[side=right]:origin-left data-[side=left]:origin-right"
        >
          {label}
          <RT.Arrow className="fill-[var(--glass-bg)]" width={12} height={6} />
          <style>{`@keyframes tipIn { from { opacity:0; transform: scale(0.9) translateX(-4px);} to {opacity:1; transform:none;} }`}</style>
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
