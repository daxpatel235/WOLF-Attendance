import { useEffect, useState } from "react";

/**
 * useState that survives restarts. Used for small, UI-only lists (tasks, goals,
 * focus sessions, CGPA rows) that don't need to live in the Rust data file.
 * In the desktop app this is the WebView's own storage under the app's data
 * folder, so it persists between launches. Corrupt or missing values fall back
 * to `initial` instead of crashing the page.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const storageKey = `wolf_${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* storage full or unavailable — keep working in memory */
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

/** Local calendar date as YYYY-MM-DD (not UTC, so late-night work counts today). */
export function localIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
