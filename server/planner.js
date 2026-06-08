// Core lab-aware planner — JS port of the validated algorithm.
// Smallest set of college days so every subject (lecture & lab) stays above its
// requirement. Sunday excluded; holidays free. Labs use a stricter % and are
// weighted so their days are locked in first.
const config = require("./config");
const { listDates, weekdayName, isSunday, compareISO, parseISO } = require("./dateUtils");

const LECTURE_WEIGHT = 1;
const LAB_WEIGHT = config.LAB_WEIGHT;
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function computePlan({ settings, timetable, marks = {}, today }) {
  const result = { ready: false, message: "", banner: null, subjects: [], days: [], feasible: true };

  if (!settings || !settings.semesterStart || !settings.semesterEnd) {
    result.message = "Semester start and end dates are not set yet.";
    return result;
  }
  if (!timetable || !timetable.subjects || !timetable.subjects.length) {
    result.message = "No timetable has been imported yet.";
    return result;
  }

  const minPercent = settings.minPercent ?? 60;
  const targetPercent = settings.targetPercent ?? 75;
  const labPercent = settings.labPercent ?? config.DEFAULT_LAB_PERCENT;
  const holidaySet = new Set(settings.holidays || []);
  const subjects = timetable.subjects;

  const kindOf = {}, colorOf = {}, codeOf = {}, weightOf = {};
  for (const s of subjects) {
    kindOf[s.name] = s.kind || "lecture";
    colorOf[s.name] = s.color || "#6B6560";
    codeOf[s.name] = s.code || "";
    weightOf[s.name] = kindOf[s.name] === "lab" ? LAB_WEIGHT : LECTURE_WEIGHT;
  }

  const sessionsByWd = {}; DAYS.forEach((d) => (sessionsByWd[d] = []));
  for (const s of subjects) {
    for (const sess of s.sessions || []) {
      if (sessionsByWd[sess.day]) {
        sessionsByWd[sess.day].push({
          name: s.name, code: s.code || "", kind: kindOf[s.name], color: colorOf[s.name],
          start: sess.start || "", end: sess.end || "",
        });
      }
    }
  }
  for (const d of DAYS) sessionsByWd[d].sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  // 1. College days
  const allDates = listDates(settings.semesterStart, settings.semesterEnd);
  const collegeDays = [], holidayDays = [];
  for (const date of allDates) {
    if (isSunday(date)) continue;
    if (holidaySet.has(date)) { holidayDays.push(date); continue; }
    const wd = weekdayName(date);
    const lectures = {}; let total = 0;
    for (const subj of subjects) {
      const n = (subj.schedule && subj.schedule[wd]) || 0;
      if (n > 0) { lectures[subj.name] = n; total += n; }
    }
    collegeDays.push({ date, weekday: wd, lectures, total });
  }

  // 2. Totals + required
  const totalLectures = {}; subjects.forEach((s) => (totalLectures[s.name] = 0));
  for (const day of collegeDays) for (const [n, c] of Object.entries(day.lectures)) totalLectures[n] += c;

  const minNeeded = {}, targetNeeded = {};
  for (const s of subjects) {
    const t = totalLectures[s.name];
    const pct = kindOf[s.name] === "lab" ? labPercent : minPercent;
    minNeeded[s.name] = Math.ceil((t * pct) / 100);
    const tpct = kindOf[s.name] === "lab" ? Math.max(targetPercent, labPercent) : targetPercent;
    targetNeeded[s.name] = Math.ceil((t * tpct) / 100);
  }

  // 3. Fixed vs candidate
  const fixedAttend = [], candidates = [];
  for (const day of collegeDays) {
    const status = marks[day.date];
    const isPast = compareISO(day.date, today) < 0;
    if (status === "attended") fixedAttend.push(day);
    else if (status === "skipped") { /* missed/forced-skip */ }
    else if (isPast) fixedAttend.push(day);
    else candidates.push(day);
  }
  const attended = {}; subjects.forEach((s) => (attended[s.name] = 0));
  for (const day of fixedAttend) for (const [n, c] of Object.entries(day.lectures)) attended[n] += c;

  // 4. Greedy minimum (labs weighted)
  const remaining = {};
  for (const s of subjects) remaining[s.name] = Math.max(0, minNeeded[s.name] - attended[s.name]);
  const requiredSet = new Set();
  const pool = candidates.slice();
  const scoreDay = (day, need) => {
    let score = 0, covered = 0;
    for (const [n, c] of Object.entries(day.lectures)) {
      if (need[n] > 0) { score += weightOf[n] * Math.min(need[n], c); covered += 1; }
    }
    return { score, covered };
  };
  const anyNeed = (need) => subjects.some((s) => need[s.name] > 0);

  while (anyNeed(remaining)) {
    let best = null, bestScore = -1, bestCov = -1;
    for (const day of pool) {
      if (requiredSet.has(day.date)) continue;
      const { score, covered } = scoreDay(day, remaining);
      if (score <= 0) continue;
      if (score > bestScore || (score === bestScore && covered > bestCov) ||
          (score === bestScore && covered === bestCov && best && compareISO(day.date, best.date) < 0)) {
        best = day; bestScore = score; bestCov = covered;
      }
    }
    if (!best) break;
    requiredSet.add(best.date);
    for (const [n, c] of Object.entries(best.lectures)) if (remaining[n] > 0) remaining[n] = Math.max(0, remaining[n] - c);
  }

  const impossible = new Set();
  for (const s of subjects) if (remaining[s.name] > 0) { impossible.add(s.name); result.feasible = false; }

  // 5. Buffer toward target
  const secured = { ...attended };
  for (const date of requiredSet) {
    const day = collegeDays.find((d) => d.date === date);
    for (const [n, c] of Object.entries(day.lectures)) secured[n] = (secured[n] || 0) + c;
  }
  const bufferNeed = {};
  for (const s of subjects) bufferNeed[s.name] = Math.max(0, targetNeeded[s.name] - (secured[s.name] || 0));
  const bufferSet = new Set();
  while (anyNeed(bufferNeed)) {
    let best = null, bestScore = -1;
    for (const day of pool) {
      if (requiredSet.has(day.date) || bufferSet.has(day.date)) continue;
      const { score } = scoreDay(day, bufferNeed);
      if (score <= 0) continue;
      if (score > bestScore || (score === bestScore && best && compareISO(day.date, best.date) < 0)) { best = day; bestScore = score; }
    }
    if (!best) break;
    bufferSet.add(best.date);
    for (const [n, c] of Object.entries(best.lectures)) if (bufferNeed[n] > 0) bufferNeed[n] = Math.max(0, bufferNeed[n] - c);
  }

  // 6. Classify days
  const days = [];
  for (const day of collegeDays) {
    const status = marks[day.date];
    const isPast = compareISO(day.date, today) < 0;
    const isToday = compareISO(day.date, today) === 0;
    let category;
    if (isPast) category = status === "skipped" ? "past-skipped" : "past-attended";
    else if (status === "attended") category = "attend";
    else if (status === "skipped") category = "skip-forced";
    else if (requiredSet.has(day.date)) category = "required";
    else if (bufferSet.has(day.date)) category = "buffer";
    else category = "skip";
    const subjEntries = Object.entries(day.lectures).map(([n, c]) => ({
      name: n, count: c, color: colorOf[n] || "#6B6560", kind: kindOf[n] || "lecture",
    }));
    days.push({
      date: day.date, weekday: day.weekday, isPast, isToday, category, marked: status || null,
      subjects: subjEntries, sessions: sessionsByWd[day.weekday] || [],
      hasLab: subjEntries.some((e) => e.kind === "lab"), totalLectures: day.total,
    });
  }
  for (const date of holidayDays) {
    days.push({
      date, weekday: weekdayName(date), isPast: compareISO(date, today) < 0,
      isToday: compareISO(date, today) === 0, category: "holiday", marked: null,
      subjects: [], sessions: [], hasLab: false, totalLectures: 0,
    });
  }
  days.sort((a, b) => parseISO(a.date) - parseISO(b.date));

  // 7. Subject cards
  const conducted = {}, attendedSoFar = {}, futureRemaining = {};
  subjects.forEach((s) => { conducted[s.name] = 0; attendedSoFar[s.name] = 0; futureRemaining[s.name] = 0; });
  for (const day of collegeDays) {
    const isPast = compareISO(day.date, today) < 0;
    const status = marks[day.date];
    for (const [n, c] of Object.entries(day.lectures)) {
      if (isPast) { conducted[n] += c; if (status !== "skipped") attendedSoFar[n] += c; }
      else if (status !== "attended" && status !== "skipped") futureRemaining[n] += c;
    }
  }
  const skippable = {}; subjects.forEach((s) => (skippable[s.name] = 0));
  for (const day of days) if (day.category === "skip") for (const s of day.subjects) skippable[s.name] += 1;

  let subjectCards = subjects.map((subj) => {
    const name = subj.name, total = totalLectures[name], cond = conducted[name], att = attendedSoFar[name];
    const currentPct = cond > 0 ? (att / cond) * 100 : 100;
    const maxReachable = attended[name] + futureRemaining[name];
    const projMinPct = total > 0 ? ((secured[name] || 0) / total) * 100 : 100;
    const reqPct = kindOf[name] === "lab" ? labPercent : minPercent;
    let status;
    if (maxReachable < minNeeded[name]) status = "danger";
    else if (cond > 0 && currentPct < reqPct) status = "warning";
    else if (maxReachable < targetNeeded[name]) status = "warning";
    else status = "safe";
    return {
      name, code: codeOf[name] || "", kind: kindOf[name] || "lecture", color: subj.color || "#6B6560",
      totalLectures: total, minNeeded: minNeeded[name], targetNeeded: targetNeeded[name], reqPercent: reqPct,
      attendedSoFar: att, conducted: cond, currentPct: Math.round(currentPct * 10) / 10,
      projectedMinPct: Math.round(projMinPct * 10) / 10, canStillSkipDays: skippable[name],
      status, impossible: impossible.has(name),
    };
  });
  subjectCards.sort((a, b) => (a.kind !== "lab") - (b.kind !== "lab") || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  // 8. Banner
  const futureCollege = days.filter((d) => !d.isPast && d.category !== "holiday");
  const stayHome = days.filter((d) => !d.isPast && (d.category === "skip" || d.category === "skip-forced")).length;
  const labDays = days.filter((d) => !d.isPast && (d.category === "required" || d.category === "attend") && d.hasLab).length;
  let todayAction = "no-college";
  const todayDay = days.find((d) => d.isToday);
  if (todayDay) {
    if (todayDay.category === "holiday") todayAction = "holiday";
    else if (todayDay.category === "required" || todayDay.category === "attend") todayAction = "go";
    else if (todayDay.category === "buffer") todayAction = "recommended";
    else todayAction = "stay-home";
  } else if (today && isSunday(today)) todayAction = "sunday";

  result.ready = true;
  result.banner = {
    attendDaysCount: requiredSet.size, stayHomeCount: stayHome, bufferDaysCount: bufferSet.size,
    futureCollegeDaysCount: futureCollege.length, labDaysCount: labDays, todayAction,
    minPercent, targetPercent, labPercent,
  };
  result.subjects = subjectCards;
  result.days = days;
  return result;
}

module.exports = { computePlan };
