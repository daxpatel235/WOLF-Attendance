import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { api, isTauri } from "../api";
import type { State } from "../types";

export type Mode = "school" | "college";

interface AppContextType {
  st: State | null;
  view: string;
  go: (view: string) => void;
  refresh: () => void;
  loading: boolean;
  /** Set when the backend could not be reached / returned an error on load. */
  error: string | null;
  /** Institution identity — drives the entire visual language. */
  mode: Mode;
  /** Alias kept for backwards compatibility. */
  theme: Mode;
  setMode: (m: Mode) => void;
  isDark: boolean;
  toggleDark: () => void;
  setDark: (v: boolean) => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const isSchool = (t?: string) => /(school|coach|junior|kids|high)/i.test(t || "");
const root = () => document.documentElement;

export function AppProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState("dashboard");
  const [mode, setModeState] = useState<Mode>("college");
  const [isDark, setIsDark] = useState(
    () => (localStorage.getItem("wolf_dark") ?? "1") === "1"
  );
  const overrode = useRef(false); // did the user pick a mode this session (onboarding preview)?

  // Apply dark attribute up-front + whenever it changes.
  useEffect(() => {
    root().setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("wolf_dark", isDark ? "1" : "0");
  }, [isDark]);

  useEffect(() => {
    root().setAttribute("data-institution", mode);
  }, [mode]);

  const applyFromState = useCallback((state: State | null) => {
    const m: Mode = isSchool(state?.settings?.institutionType) ? "school" : "college";
    if (!overrode.current) setModeState(m);
  }, []);

  const refresh = useCallback(() => {
    if (!isTauri()) {
      let state: State;
      try {
        const raw = localStorage.getItem("wolf_state");
        state = (raw ? JSON.parse(raw) : { settings: { onboarded: false } }) as State;
      } catch {
        state = { settings: { onboarded: false } } as State;
      }
      setSt(state);
      applyFromState(state);
      setLoading(false);
      return;
    }
    api.bootstrap()
      .then((state) => { setSt(state); applyFromState(state); setError(null); })
      .catch((e) => { console.error(e); setError(String(e?.message ?? e ?? "Unknown error")); })
      .finally(() => setLoading(false));
  }, [applyFromState]);

  useEffect(() => {
    refresh();
    const onForce = () => refresh();
    window.addEventListener("force-refresh", onForce);
    return () => window.removeEventListener("force-refresh", onForce);
  }, [refresh]);

  const setMode = useCallback((m: Mode) => { overrode.current = true; setModeState(m); }, []);
  const toggleDark = useCallback(() => setIsDark((v) => !v), []);
  const setDark = useCallback((v: boolean) => setIsDark(v), []);

  const logout = useCallback(async () => {
    // Wait for the backend to persist the flag before reloading, otherwise the
    // refresh can race the save and bounce straight back into the app.
    try { await api.saveSettings({ onboarded: false }); } catch (e) { console.error(e); }
    setView("login");
    refresh();
  }, [refresh]);

  return (
    <AppContext.Provider
      value={{ st, view, go: setView, refresh, loading, error, mode, theme: mode, setMode, isDark, toggleDark, setDark, logout }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}
