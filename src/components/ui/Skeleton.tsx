import React from "react";
import { cn } from "../../lib/utils";

/** Shimmering placeholder block. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-[var(--r-sm)] bg-[var(--surface-3)]", className)}
      style={style}
    >
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
          animation: "shimmer 1.5s infinite",
        }}
      />
    </div>
  );
}

/** A full-card loading placeholder that mirrors the app's card shape. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-[var(--r-lg)] border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}
