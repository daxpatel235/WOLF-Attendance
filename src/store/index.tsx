import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { api } from "../api";
import type { State } from "../types";

export type Mode = "school" | "college";

interface AppContextType {
  st: State | null;
  view: string;
  go: (view: string) => void;
  refresh: () => void;
  loading: boolean;
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
    if (!(window as any).__TAURI_INTERNALS__) {
      const raw = localStorage.getItem("wolf_state");
      const state = (raw ? JSON.parse(raw) : { settings: { onboarded: false } }) as State;
      setSt(state);
      applyFromState(state);
      setLoading(false);
      return;
    }
    api.bootstrap()
      .then((state) => { setSt(state); applyFromState(state); })
      .catch((e) => console.error(e))
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

  const logout = useCallback(() => {
    api.saveSettings({ onboarded: false }).catch(() => {});
    if (!(window as any).__TAURI_INTERNALS__) {
      const raw = localStorage.getItem("wolf_state");
      const state = raw ? JSON.parse(raw) : { settings: {} };
      state.settings = { ...(state.settings || {}), onboarded: false };
      localStorage.setItem("wolf_state", JSON.stringify(state));
    }
    setView("login");
    setTimeout(refresh, 60);
  }, [refresh]);

  return (
    <AppContext.Provider
      value={{ st, view, go: setView, refresh, loading, mode, theme: mode, setMode, isDark, toggleDark, setDark, logout }}
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
