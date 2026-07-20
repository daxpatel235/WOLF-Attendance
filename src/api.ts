// Data layer: thin wrappers over Tauri commands.
// Falls back to a localStorage mock when running in a plain browser (no Tauri backend).
import type { State, MarkResponse, Course, Exam } from "./types";

let _invokePromise: Promise<(cmd: string, args?: Record<string, unknown>) => Promise<any>> | null = null;

// The pure browser fallback for when the Rust backend isn't available
const mockBackend = async (cmd: string, args?: Record<string, any>) => {
  const getSt = (): any => JSON.parse(localStorage.getItem("wolf_state") || '{"settings":{}, "timetable": null, "plan": {"ready": false}}');
  const setSt = (s: any) => localStorage.setItem("wolf_state", JSON.stringify(s));
  
  const st = getSt();

  if (cmd === "bootstrap") {
    return st;
  }
  
  if (cmd === "save_settings") {
    st.settings = { ...st.settings, ...(args?.patch || {}) };
    setSt(st);
    return { ok: true, ...st };
  }
  
  if (cmd === "save_timetable") {
    st.timetable = args?.payload;
    st.plan = { ...st.plan, ready: true, subjects: args?.payload?.subjects?.map((s: any) => ({ name: s.name, color: s.color || "#4f6bed", currentPct: 100, status: "safe" })) || [] };
    setSt(st);
    return { ok: true, ...st };
  }

  // Generic ok response for other mocked endpoints
  return { ok: true, ...st };
};

function getInvoke() {
  if (_invokePromise) return _invokePromise;
  
  if ((window as any).__TAURI_INTERNALS__) {
    _invokePromise = import("@tauri-apps/api/core")
      .then(m => m.invoke)
      .catch(() => mockBackend);
  } else {
    _invokePromise = Promise.resolve(mockBackend);
  }
  
  return _invokePromise;
}

const _invoke = async (cmd: string, args?: Record<string, unknown>) => {
  const invoke = await getInvoke();
  return invoke(cmd, args);
};

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
  openExternal:   (url: string)                                        => _invoke("open_external", { url }),
  setAutostart:   (enabled: boolean)                                   => _invoke("set_autostart", { enabled })  as Promise<State>,
  testReminder:   ()                                                   => _invoke("test_reminder"),
};
