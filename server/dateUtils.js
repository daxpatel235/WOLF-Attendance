// Calendar-date helpers on "YYYY-MM-DD" strings (timezone-safe).
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function todayISO() { return toISO(new Date()); }
function weekdayName(iso) { return WEEKDAYS[parseISO(iso).getDay()]; }
function isSunday(iso) { return parseISO(iso).getDay() === 0; }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function listDates(startISO, endISO) {
  const out = [];
  if (!startISO || !endISO) return out;
  if (parseISO(startISO) > parseISO(endISO)) return out;
  let cur = startISO;
  while (parseISO(cur) <= parseISO(endISO)) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}
function compareISO(a, b) {
  const da = parseISO(a).getTime(), db = parseISO(b).getTime();
  return da < db ? -1 : da > db ? 1 : 0;
}

module.exports = { WEEKDAYS, parseISO, toISO, todayISO, weekdayName, isSunday, addDays, listDates, compareISO };
