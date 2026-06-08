// Express backend: serves the built React client and the REST API.
// All logic runs locally; data is stored on-device in the given dataDir.
const path = require("path");
const express = require("express");
const config = require("./config");
const { Store } = require("./storage");
const providers = require("./providers");
const { computePlan } = require("./planner");
const { todayISO } = require("./dateUtils");

function createApp(dataDir) {
  const store = new Store(dataDir);
  const app = express();
  app.use(express.json({ limit: "30mb" }));

  const plan = () =>
    computePlan({ settings: store.settings, timetable: store.timetable,
                  marks: store.attendance, today: todayISO() });
  const state = (extra = {}) =>
    ({ ok: true, settings: store.settings, timetable: store.timetable, plan: plan(), ...extra });

  app.get("/api/bootstrap", (req, res) => {
    res.json(state({
      today: todayISO(),
      meta: {
        app: config.APP_NAME, version: config.APP_VERSION, tagline: config.APP_TAGLINE,
        institutionTypes: config.INSTITUTION_TYPES, providers: providers.providerList(),
        dataPath: store.dataPath(),
      },
    }));
  });

  app.put("/api/settings", (req, res) => {
    const allowed = ["institutionType", "institutionName", "className", "division", "semester",
      "timetableName", "batchName", "semesterStart", "semesterEnd", "minPercent",
      "targetPercent", "labPercent", "holidays", "appearance", "apiKey", "provider", "model"];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    for (const k of ["minPercent", "targetPercent", "labPercent"]) {
      if (k in patch) patch[k] = Math.max(0, Math.min(100, Number(patch[k]) || 0));
    }
    if (patch.semesterStart && patch.semesterEnd && patch.semesterStart > patch.semesterEnd) {
      return res.status(400).json({ ok: false, error: "Start date must be on or before end date." });
    }
    store.updateSettings(patch);
    res.json(state());
  });

  app.post("/api/holiday", (req, res) => { store.addHoliday(req.body.date); res.json(state()); });
  app.delete("/api/holiday/:date", (req, res) => { store.removeHoliday(req.params.date); res.json(state()); });

  app.post("/api/attendance", (req, res) => {
    store.markDay(req.body.date, req.body.status);
    res.json({ ok: true, plan: plan() });
  });

  app.post("/api/timetable/parse", async (req, res) => {
    try {
      const { base64, mime, batchName } = req.body;
      const s = store.settings;
      const result = await providers.parseTimetable(
        { base64, mime },
        { provider: s.provider, model: s.model, key: (s.apiKey || "").trim(), batchName: batchName || "" }
      );
      res.json({ ok: true, result });
    } catch (e) {
      res.status(200).json({ ok: false, error: e.message });
    }
  });

  app.post("/api/timetable", (req, res) => {
    try {
      const pal = config.SUBJECT_PALETTE;
      const clean = [];
      for (const s of req.body.subjects || []) {
        const name = (s.name || "").trim();
        if (!name) continue;
        const schedule = {};
        for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
          schedule[day] = Math.max(0, Math.round(Number((s.schedule || {})[day]) || 0));
        }
        clean.push({
          name, code: (s.code || "").trim(), kind: s.kind === "lab" ? "lab" : "lecture",
          color: pal[clean.length % pal.length], schedule, sessions: s.sessions || [],
        });
      }
      if (!clean.length) return res.status(400).json({ ok: false, error: "Add at least one subject." });
      const batch = (req.body.batchName || "").trim();
      store.setTimetable({ batchName: batch, subjects: clean });
      if (batch && !store.settings.batchName) store.updateSettings({ batchName: batch });
      res.json(state());
    } catch (e) {
      res.status(200).json({ ok: false, error: e.message });
    }
  });

  // Serve the built React client.
  const clientDir = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDir));
  app.get("*", (req, res) => res.sendFile(path.join(clientDir, "index.html")));

  return app;
}

module.exports = { createApp };
