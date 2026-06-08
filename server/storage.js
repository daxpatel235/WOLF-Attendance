// Local on-device JSON storage. The data directory is provided by Electron
// (app.getPath('userData')) so data persists per-device with no cloud.
const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  settings: {
    institutionType: "College", institutionName: "", className: "", division: "",
    semester: "", timetableName: "", batchName: "", semesterStart: "", semesterEnd: "",
    minPercent: 60, targetPercent: 75, labPercent: 75, holidays: [],
    provider: "gemini", model: "", apiKey: "", appearance: "light",
  },
  timetable: null,
  attendance: {},
};

class Store {
  constructor(dataDir) {
    this.dir = dataDir;
    this.file = path.join(dataDir, "data.json");
    this.data = null;
    this.load();
  }
  load() {
    try {
      if (fs.existsSync(this.file)) this.data = JSON.parse(fs.readFileSync(this.file, "utf-8"));
    } catch { this.data = null; }
    if (!this.data || typeof this.data !== "object") this.data = JSON.parse(JSON.stringify(DEFAULTS));
    for (const k of Object.keys(DEFAULTS)) if (!(k in this.data)) this.data[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
    for (const [k, v] of Object.entries(DEFAULTS.settings)) if (!(k in this.data.settings)) this.data.settings[k] = v;
    return this.data;
  }
  save() {
    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file); // atomic on same volume
  }
  get settings() { return this.data.settings; }
  get timetable() { return this.data.timetable; }
  get attendance() { return this.data.attendance; }

  updateSettings(patch) { Object.assign(this.data.settings, patch); this.save(); }
  setTimetable(tt) { this.data.timetable = tt; this.save(); }
  markDay(date, status) {
    if (!status || status === "clear") delete this.data.attendance[date];
    else this.data.attendance[date] = status;
    this.save();
  }
  addHoliday(d) {
    const h = this.data.settings.holidays;
    if (!h.includes(d)) { h.push(d); h.sort(); this.save(); }
  }
  removeHoliday(d) {
    const h = this.data.settings.holidays;
    const i = h.indexOf(d); if (i >= 0) { h.splice(i, 1); this.save(); }
  }
  effectiveApiKey(fallback) { return (this.settings.apiKey || "").trim() || fallback; }
  dataPath() { return this.file; }
}

module.exports = { Store };
