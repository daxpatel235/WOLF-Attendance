// Lab detection + library/break exclusion.
// Lab code pattern: digit 1-8, then a letter, then a number, e.g. "5J1".
const LAB_CODE_RE = /^\s*[1-8][A-Za-z][0-9]/;
const LAB_WORDS = new Set(["lab", "labs", "practical", "practicals", "workshop", "prac"]);
const EXCLUDE_TYPES = new Set(["library", "break", "lunch", "recess", "free", "interval", "off"]);
const EXCLUDE_SUBSTR = ["library", "lunch", "recess", "interval", "tea break", "short break", "long break", "lib."];
const EXCLUDE_EXACT = new Set(["break", "free", "free period", "-", "--", "---", "x", "nan", "n/a", "na", "off", "holiday", "lib"]);

function isLabCode(code) { return !!code && LAB_CODE_RE.test(String(code)); }

function isLab(name = "", code = "", typ = "") {
  if (typ && typ.trim().toLowerCase() === "lab") return true;
  if (isLabCode(code)) return true;
  const words = new Set((name || "").toLowerCase().split(/[\s/_-]+/));
  for (const w of words) if (LAB_WORDS.has(w)) return true;
  return false;
}

function isExcluded(name = "", typ = "") {
  const t = (typ || "").trim().toLowerCase();
  if (EXCLUDE_TYPES.has(t)) return true;
  const n = (name || "").trim().toLowerCase();
  if (!n) return true;
  if (EXCLUDE_EXACT.has(n)) return true;
  return EXCLUDE_SUBSTR.some((s) => n.includes(s));
}

function kindOf(name = "", code = "", typ = "") {
  return isLab(name, code, typ) ? "lab" : "lecture";
}

module.exports = { isLabCode, isLab, isExcluded, kindOf };
