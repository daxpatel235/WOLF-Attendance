// Data layer: thin wrappers over Tauri commands.
// Falls back to a localStorage mock ONLY when running in a plain browser
// (`npm run dev` without Tauri). Inside the desktop app every call goes to the
// Rust backend, and failures surface as errors instead of silently writing to a
// throwaway browser store.
import { invoke } from "@tauri-apps/api/core";
import type { State, MarkResponse, Course, Exam } from "./types";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<any>;

/** True when running inside the Tauri desktop shell. */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

// The pure browser fallback for UI development without the Rust backend.
const mockBackend: Invoke = async (cmd, args) => {
  const getSt = (): any =>
    JSON.parse(localStorage.getItem("wolf_state") || '{"settings":{}, "timetable": null, "plan": {"ready": false}}');
  const setSt = (s: any) => localStorage.setItem("wolf_state", JSON.stringify(s));

  const st = getSt();

  if (cmd === "bootstrap") {
    return { ok: true, ...st };
  }

  if (cmd === "save_settings") {
    st.settings = { ...st.settings, ...((args?.patch as object) || {}) };
    setSt(st);
    return { ok: true, ...st };
  }

  if (cmd === "save_timetable") {
    const payload = args?.payload as any;
    st.timetable = payload;
    st.plan = {
      ...st.plan,
      ready: true,
      subjects:
        payload?.subjects?.map((s: any) => ({ name: s.name, color: s.color || "#4f6bed", currentPct: 100, status: "safe" })) || [],
    };
    setSt(st);
    return { ok: true, ...st };
  }

  if (cmd === "save_exams") {
    st.exams = args?.exams || [];
    setSt(st);
    return { ok: true, ...st };
  }

  if (cmd === "test_reminder" || cmd === "open_external") {
    if (cmd === "open_external") window.open(String(args?.url || ""), "_blank", "noopener");
    return null;
  }

  // Generic ok response for other mocked endpoints
  return { ok: true, ...st };
};

const _invoke: Invoke = (cmd, args) => (isTauri() ? invoke(cmd, args) : mockBackend(cmd, args));

export const api = {
  bootstrap:      ()                                                  => _invoke("bootstrap")                    as Promise<State>,
  saveSettings:   (patch: Record<string, unknown>)                    => _invoke("save_settings", { patch })     as Promise<State>,
  addHoliday:     (date: string)                                      => _invoke("add_holiday", { date })        as Promise<State>,
  removeHoliday:  (date: string)                                      => _invoke("remove_holiday", { date })     as Promise<State>,
  markDay:        (date: string, status: string)                      => _invoke("mark_day", { date, status })   as Promise<MarkResponse>,
  // Per-subject override — beats the whole-day mark for that one subject.
  markSubject:    (date: string, subjectKey: string, status: string)  => _invoke("mark_subject", { date, subjectKey, status }) as Promise<MarkResponse>,
  clearSubjects:  (date: string)                                      => _invoke("clear_subject_marks", { date }) as Promise<MarkResponse>,
  saveTimetable:  (payload: { batchName: string; subjects: unknown[] }) => _invoke("save_timetable", { payload }) as Promise<State>,
  saveCourses:    (courses: Course[])                                  => _invoke("save_courses", { courses })   as Promise<State>,
  saveExams:      (exams: Exam[])                                      => _invoke("save_exams", { exams })       as Promise<State>,
  openExternal:   (url: string)                                        => _invoke("open_external", { url })      as Promise<void>,
  setAutostart:   (enabled: boolean)                                   => _invoke("set_autostart", { enabled })  as Promise<State>,
  testReminder:   ()                                                   => _invoke("test_reminder")               as Promise<void>,
};
