// Multi-provider timetable parsing (bring-your-own-key). The user picks a
// provider in Settings and supplies their own API key (+ optional model).
// Supported: Google Gemini, OpenAI, Anthropic (Claude), OpenRouter, Mistral, Groq.
// All extract the same timed-session JSON; normalization/lab logic is shared.
const config = require("./config");
const classify = require("./classify");

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ALIASES = {
  mon: "Monday", monday: "Monday", tue: "Tuesday", tues: "Tuesday", tuesday: "Tuesday",
  wed: "Wednesday", wednesday: "Wednesday", thu: "Thursday", thur: "Thursday",
  thurs: "Thursday", thursday: "Thursday", fri: "Friday", friday: "Friday",
  sat: "Saturday", saturday: "Saturday",
};

// ---- Provider registry (metadata is also sent to the UI) -----------------
const PROVIDERS = {
  gemini: {
    label: "Google Gemini", keyUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"],
    defaultModel: "gemini-2.5-flash", supportsPdf: true,
  },
  openai: {
    label: "OpenAI (GPT-4o)", keyUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    defaultModel: "gpt-4o-mini", supportsPdf: false,
  },
  anthropic: {
    label: "Anthropic (Claude)", keyUrl: "https://console.anthropic.com/settings/keys",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    defaultModel: "claude-3-5-sonnet-latest", supportsPdf: true,
  },
  openrouter: {
    label: "OpenRouter (any model)", keyUrl: "https://openrouter.ai/keys",
    models: ["google/gemini-2.0-flash-001", "openai/gpt-4o-mini",
             "anthropic/claude-3.5-sonnet", "meta-llama/llama-3.2-90b-vision-instruct"],
    defaultModel: "google/gemini-2.0-flash-001", supportsPdf: false,
  },
  mistral: {
    label: "Mistral (Pixtral)", keyUrl: "https://console.mistral.ai/api-keys/",
    models: ["pixtral-12b-latest", "pixtral-large-latest"],
    defaultModel: "pixtral-12b-latest", supportsPdf: false,
  },
  groq: {
    label: "Groq (Llama Vision)", keyUrl: "https://console.groq.com/keys",
    models: ["meta-llama/llama-4-scout-17b-16e-instruct", "llama-3.2-90b-vision-preview"],
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct", supportsPdf: false,
  },
};

const OPENAI_COMPAT_URL = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
};

function providerList() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id, label: p.label, keyUrl: p.keyUrl, models: p.models,
    defaultModel: p.defaultModel, supportsPdf: p.supportsPdf,
  }));
}

// ---- prompt + normalization (shared) -------------------------------------
function buildPrompt(ctx) {
  const who = ctx ? `batch / division / class: "${ctx}"` : "the single batch shown";
  return `You are an expert at reading college and school weekly timetables from a photo or scan. Read carefully and precisely.

Target ${who}. If the timetable shows several batches/divisions, extract ONLY the target's slots and ignore all others.

Look at the grid: rows/columns give the DAY and the TIME of each slot. For EVERY teaching slot of the target, output one session object with:
- "day": one of Monday..Saturday (never Sunday)
- "start": slot start time in 24-hour "HH:MM"
- "end": slot end time in 24-hour "HH:MM"
- "name": the subject name (exact text; if only a code is shown, repeat the code)
- "code": the subject code if printed (e.g. "MA101", "5J1"), else ""
- "type": one of "lecture", "lab", "library", "break"

Type rules (very important):
- "lab" if it is a practical/laboratory/workshop slot, OR if the subject CODE matches the pattern <digit 1-8><letter><number> (for example 5J1, 3A2, 7C4). These codes denote LABS, the most important sessions.
- "library" for library / reading-room slots.
- "break" for breaks, recess, lunch, free periods and empty cells.
- otherwise "lecture".

Read times exactly. Labs usually span multiple hours (e.g. 09:00-12:00) — give the full span. Do not invent slots. Do not merge different subjects.

Return STRICT JSON ONLY (no markdown), shaped exactly like:
{"batch":"<batch you used>","sessions":[{"day":"Monday","start":"09:00","end":"10:00","name":"Mathematics","code":"MA101","type":"lecture"},{"day":"Tuesday","start":"09:00","end":"12:00","name":"Data Structures Lab","code":"5J1","type":"lab"}]}`;
}

function toMinutes(t) {
  if (!t) return null;
  const s = String(t).trim().toLowerCase().replace(".", ":");
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2] || "0", 10);
  const ap = m[3];
  if (ap === "pm" && h !== 12) h += 12;
  else if (ap === "am" && h === 12) h = 0;
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}
function periods(start, end) {
  const a = toMinutes(start), b = toMinutes(end);
  if (a == null || b == null || b <= a) return 1;
  return Math.max(1, Math.min(8, Math.round((b - a) / 60)));
}

function normalizeSessions(parsed) {
  const raw = parsed.sessions;
  if (!Array.isArray(raw)) return normalizeLegacy(parsed);
  const groups = {}, order = [];
  for (const s of raw) {
    if (!s || typeof s !== "object") continue;
    let name = String(s.name || "").trim();
    const code = String(s.code || "").trim();
    const typ = String(s.type || "").trim();
    const day = DAY_ALIASES[String(s.day || "").trim().toLowerCase()];
    if (!day) continue;
    if (classify.isExcluded(name, typ)) continue;
    if (!name && code) name = code;
    if (!name) continue;
    const kind = classify.kindOf(name, code, typ);
    const p = periods(s.start, s.end);
    const key = code ? code.toUpperCase() : name.toLowerCase();
    if (!groups[key]) {
      groups[key] = { name, code, kind, schedule: Object.fromEntries(WEEKDAYS.map((d) => [d, 0])), sessions: [] };
      order.push(key);
    }
    const g = groups[key];
    g.schedule[day] += p;
    if (kind === "lab") g.kind = "lab";
    if (code && !g.code) g.code = code;
    if (name.length > g.name.length) g.name = name;
    g.sessions.push({ day, start: String(s.start || ""), end: String(s.end || ""), periods: p });
  }
  const subjects = [];
  for (const key of order) {
    const g = groups[key];
    if (!Object.values(g.schedule).some((v) => v > 0)) continue;
    g.color = config.SUBJECT_PALETTE[subjects.length % config.SUBJECT_PALETTE.length];
    subjects.push(g);
  }
  if (!subjects.length) throw new Error("No valid lectures or labs were found for this batch.");
  return subjects;
}

function normalizeLegacy(parsed) {
  if (!Array.isArray(parsed.subjects)) throw new Error("The model did not return any sessions or subjects.");
  const subjects = [];
  for (const s of parsed.subjects) {
    if (!s || !s.name) continue;
    const name = String(s.name).trim();
    const code = String(s.code || "").trim();
    if (classify.isExcluded(name, s.type || "")) continue;
    const schedule = {}; let has = false;
    for (const day of WEEKDAYS) {
      let n = Math.round(Number((s.schedule || {})[day]) || 0);
      if (n < 0) n = 0;
      schedule[day] = n; if (n > 0) has = true;
    }
    if (!has) continue;
    subjects.push({
      name, code, kind: classify.kindOf(name, code, s.type || ""),
      color: config.SUBJECT_PALETTE[subjects.length % config.SUBJECT_PALETTE.length],
      schedule, sessions: [],
    });
  }
  if (!subjects.length) throw new Error("No subjects with lectures were found for this batch.");
  return subjects;
}

// ---- HTTP helper ----------------------------------------------------------
async function postJson(url, headers, body, timeoutMs, providerLabel) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Could not reach ${providerLabel}: ${e.message}`);
  }
  clearTimeout(timer);
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}
  if (resp.status === 200) return data || {};
  const msg = (data && (data.error?.message || data.message || data.error)) || text.slice(0, 200);
  if (resp.status === 401 || resp.status === 403) {
    throw new Error(`${providerLabel} rejected your API key — check it in Settings.`);
  }
  if (resp.status === 429) throw new Error(`${providerLabel} rate limit hit — wait a moment and try again.`);
  throw new Error(`${providerLabel} error ${resp.status}: ${msg}`);
}

// ---- provider calls (each returns the raw model text) --------------------
async function callGemini({ model, key, prompt, base64, mime, timeout }) {
  const candidates = [model, ...config.GEMINI_MODELS].filter((v, i, a) => v && a.indexOf(v) === i);
  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };
  let lastErr = null;
  for (const m of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`;
    let resp;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
    } catch (e) { clearTimeout(timer); throw new Error("Could not reach Gemini: " + e.message); }
    clearTimeout(timer);
    if (resp.status === 200) {
      const d = await resp.json();
      try { return d.candidates[0].content.parts[0].text; }
      catch { throw new Error("Gemini returned an unexpected response."); }
    }
    let msg = ""; try { msg = (await resp.json()).error?.message || ""; } catch {}
    lastErr = `${resp.status}: ${msg}`;
    if (resp.status === 401 || resp.status === 403) throw new Error("Gemini rejected your API key — check it in Settings.");
    if (resp.status === 400) throw new Error("Gemini error " + lastErr);
    // 404/429/500/503 -> try the next Gemini model
  }
  throw new Error("Couldn't reach a Gemini model (" + (lastErr || "unknown") + "). It may be busy — try again.");
}

async function callAnthropic({ model, key, prompt, base64, mime, timeout, label }) {
  const isPdf = mime === "application/pdf";
  const media = isPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: mime, data: base64 } };
  const body = { model, max_tokens: 4096, messages: [{ role: "user", content: [media, { type: "text", text: prompt }] }] };
  const headers = { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
  const data = await postJson("https://api.anthropic.com/v1/messages", headers, body, timeout, label);
  const part = (data.content || []).find((c) => c.type === "text") || (data.content || [])[0];
  return part && part.text;
}

async function callOpenAICompatible(url, { model, key, prompt, base64, mime, timeout, label }) {
  const body = {
    model, max_tokens: 4096,
    messages: [{ role: "user", content: [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
    ] }],
  };
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  const data = await postJson(url, headers, body, timeout, label);
  return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
}

// ---- main entry -----------------------------------------------------------
async function parseTimetable(input, opts, timeoutMs = 120000) {
  const { provider = "gemini", model = "", key = "", batchName = "" } = opts || {};
  const prov = PROVIDERS[provider] || PROVIDERS.gemini;
  if (!key) throw new Error("No API key set. Pick a provider and add your own key in Settings.");
  const base64 = input.base64;
  const mime = input.mime || "application/octet-stream";
  if (!base64) throw new Error("No file data received.");
  if (mime === "application/pdf" && !prov.supportsPdf) {
    throw new Error(`${prov.label} can't read PDFs. Upload an image (PNG/JPG), or choose Gemini or Claude for PDFs.`);
  }
  const chosenModel = (model && model.trim()) || prov.defaultModel;
  const prompt = buildPrompt(batchName);
  const common = { model: chosenModel, key, prompt, base64, mime, timeout: timeoutMs, label: prov.label };

  let text;
  if (provider === "gemini") text = await callGemini(common);
  else if (provider === "anthropic") text = await callAnthropic(common);
  else {
    const url = OPENAI_COMPAT_URL[provider];
    if (!url) throw new Error("Unknown provider: " + provider);
    text = await callOpenAICompatible(url, common);
  }
  if (!text) throw new Error("The model returned an empty response. Try again or pick another model.");

  let parsed;
  try { parsed = JSON.parse(text); }
  catch { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); }

  return { batch: parsed.batch || batchName, subjects: normalizeSessions(parsed), provider, model: chosenModel };
}

module.exports = { parseTimetable, providerList, PROVIDERS };
