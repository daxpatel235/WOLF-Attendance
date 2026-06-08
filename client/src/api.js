// Thin REST client to the local Express backend (same origin).
async function j(path, opts) {
  const r = await fetch("/api" + path, opts);
  return r.json();
}
const J = (body) => ({ method: undefined, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const api = {
  bootstrap: () => j("/bootstrap"),
  saveSettings: (b) => j("/settings", { ...J(b), method: "PUT" }),
  addHoliday: (date) => j("/holiday", { ...J({ date }), method: "POST" }),
  removeHoliday: (date) => j("/holiday/" + date, { method: "DELETE" }),
  markDay: (date, status) => j("/attendance", { ...J({ date, status }), method: "POST" }),
  parse: (base64, mime, batchName) => j("/timetable/parse", { ...J({ base64, mime, batchName }), method: "POST" }),
  saveTimetable: (payload) => j("/timetable", { ...J(payload), method: "POST" }),
};
