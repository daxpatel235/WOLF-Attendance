import React, { useEffect, useState, useCallback } from "react";
import { api } from "./api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const C = { go: "var(--go)", skip: "var(--skip)", buffer: "var(--buffer)", warn: "var(--warn)",
  danger: "var(--danger)", lab: "var(--lab)", holiday: "var(--holiday)" };
const CLS = { required: "go", attend: "attend", skip: "skip", "skip-forced": "skipforced",
  buffer: "buffer", holiday: "holiday", "past-attended": "past", "past-skipped": "past" };
const TAG = { required: "GO", attend: "GO ✓", buffer: "BUFFER", skip: "STAY HOME", "skip-forced": "SKIP ✕", holiday: "HOLIDAY" };

const pad = (n) => String(n).padStart(2, "0");
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function isoNice(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

const ICONS = {
  dashboard: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  calendar: <><rect x="3" y="4" width="18" height="17" rx="2.5" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  subjects: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  timetable: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M3 9h18M9 9v11M15 9v11" /></>,
  settings: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.6H10l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L3.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4z" /></>,
};
const NavIcon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>
);

function Ring({ pct, color }) {
  const r = 32, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  return (
    <div className="ring">
      <svg width="76" height="76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
      </svg>
      <div className="val">{Math.round(pct)}%</div>
    </div>
  );
}

function SubjectCard({ s, minPercent }) {
  const stCol = s.status === "safe" ? C.go : s.status === "warning" ? C.warn : C.danger;
  return (
    <div className="card subj" style={{ margin: 0 }}>
      <Ring pct={s.currentPct} color={stCol} />
      <div className="info">
        <div className="title">
          <span className="dot" style={{ background: s.color }} />{s.name}
          {s.code ? <span className="code">{s.code}</span> : null}
          {s.kind === "lab" ? <span className="badge lab">Lab</span> : null}
          <span className="spacer" /><span className={"badge " + s.status}>{s.status}</span>
        </div>
        <div className="meta">Attended <b>{s.attendedSoFar}</b> of <b>{s.minNeeded}</b> needed · min {s.reqPercent}%</div>
        <div className="meta">Can still skip <b>{s.canStillSkipDays}</b> more day{s.canStillSkipDays === 1 ? "" : "s"} with this
          {s.impossible ? <span style={{ color: "var(--danger)" }}> · can't reach minimum</span> : null}</div>
      </div>
    </div>
  );
}

function SetupPrompt({ go, msg }) {
  return (
    <div className="card setup">
      <div className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></div>
      <div className="h2">Let's set up WOLF</div>
      <p className="muted" style={{ margin: "6px 0 16px", maxWidth: 560 }}>{msg || "Set your semester dates, then import your timetable."}</p>
      <div className="row">
        <button className="btn primary" onClick={() => go("settings")}>Open Settings</button>
        <button className="btn" onClick={() => go("timetable")}>Import Timetable</button>
      </div>
    </div>
  );
}

function Dashboard({ st, go }) {
  const plan = st.plan;
  if (!plan || !plan.ready) return (<><div className="page-head"><h1>Dashboard</h1><p>{st.meta.tagline}</p></div><SetupPrompt go={go} msg={plan && plan.message} /></>);
  const b = plan.banner;
  const pills = { go: ["Go to college", C.go], "stay-home": ["Stay home today", C.skip], recommended: ["Recommended buffer day", C.buffer], holiday: ["Holiday", C.holiday], sunday: ["Sunday — off", C.holiday], "no-college": ["No college today", C.holiday] };
  const [pt, pc] = pills[b.todayAction] || ["—", C.holiday];
  let sub = `You can stay home ${b.stayHomeCount} day${b.stayHomeCount === 1 ? "" : "s"}`;
  sub += b.bufferDaysCount ? `, plus ${b.bufferDaysCount} buffer day${b.bufferDaysCount === 1 ? "" : "s"} for safety.` : ".";
  const stats = [[b.attendDaysCount, "must attend", C.go], [b.stayHomeCount, "can stay home", C.skip], [b.bufferDaysCount, "buffer (optional)", C.buffer], [b.labDaysCount, "lab days ahead", C.lab]];
  return (
    <>
      <div className="page-head"><h1>Dashboard</h1><p>{st.meta.tagline}</p></div>
      <div className="card hero pad-lg">
        <h2>You must attend {b.attendDaysCount} more day{b.attendDaysCount === 1 ? "" : "s"} this semester.</h2>
        <div className="sub">{sub}</div>
        <div className="today">Today: <span className="pill" style={{ background: pc }}>{pt}</span></div>
        {plan.feasible === false ? <div className="warnline">⚠ Some subjects can't reach the minimum even by attending every day — see Subjects.</div> : null}
        <div className="stats">
          {stats.map(([n, l, col], i) => (<div className="stat" key={i} style={{ "--bar": col }}><div className="n">{n}</div><div className="l">{l}</div></div>))}
        </div>
      </div>
      <div className="page-head" style={{ margin: "26px 0 14px" }}><div className="h2">Subjects at a glance</div></div>
      <div className="subjects-grid">{plan.subjects.map((s) => <SubjectCard key={s.name} s={s} minPercent={b.minPercent} />)}</div>
    </>
  );
}

function Subjects({ st, go }) {
  const plan = st.plan;
  if (!plan || !plan.ready) return (<><div className="page-head"><h1>Subjects</h1></div><SetupPrompt go={go} msg={plan && plan.message} /></>);
  return (<><div className="page-head"><h1>Subjects</h1><p>Attendance status for each subject. Labs first.</p></div>
    <div className="subjects-grid">{plan.subjects.map((s) => <SubjectCard key={s.name} s={s} minPercent={plan.banner.minPercent} />)}</div></>);
}

function Calendar({ st, go, calY, calM, setCal, onDay }) {
  const plan = st.plan;
  if (!plan || !plan.ready) return (<><div className="page-head"><h1>Calendar</h1></div><SetupPrompt go={go} msg={plan && plan.message} /></>);
  const byDate = {}; plan.days.forEach((d) => (byDate[d.date] = d));
  const dim = new Date(calY, calM + 1, 0).getDate();
  const weeks = []; let week = Array(6).fill(null); let has = false;
  for (let d = 1; d <= dim; d++) {
    const wd = new Date(calY, calM, d).getDay();
    if (wd === 0) { if (has) { weeks.push(week); week = Array(6).fill(null); has = false; } continue; }
    if (wd === 1 && has) { weeks.push(week); week = Array(6).fill(null); has = false; }
    week[wd - 1] = isoOf(calY, calM, d); has = true;
  }
  if (has) weeks.push(week);
  const shift = (n) => { let m = calM + n, y = calY; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } setCal(y, m); };
  const legend = [["go", "Go"], ["skip", "Stay home"], ["buffer", "Buffer"], ["holiday", "Holiday/Past"]];
  return (
    <>
      <div className="cal-head">
        <button className="btn icon" onClick={() => shift(-1)}>‹</button>
        <div className="cal-title">{MONTHS[calM]} {calY}</div>
        <button className="btn icon" onClick={() => shift(1)}>›</button>
        <div className="legend">{legend.map(([k, t]) => (<span key={k}><i style={{ background: `var(--${k === "go" ? "go" : k === "skip" ? "skip" : k === "buffer" ? "buffer" : "holiday"})` }} />{t}</span>))}</div>
      </div>
      <div className="card">
        <div className="cal">
          {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
          {weeks.map((wk, wi) => wk.map((iso, ci) => {
            if (!iso) return <div className="cell blank" key={wi + "-" + ci} />;
            const info = byDate[iso]; const dn = Number(iso.slice(8));
            if (!info) return <div className="cell empty" key={iso}><div className="day-n">{dn}</div></div>;
            const cls = CLS[info.category] || "";
            const click = !info.isPast && info.category !== "holiday";
            let tag = TAG[info.category] || "";
            if (info.category === "past-attended") tag = "✓";
            if (info.category === "past-skipped") tag = "✕";
            return (
              <div key={iso} className={`cell ${cls} ${click ? "click" : ""} ${info.isToday ? "today" : ""}`} onClick={click ? () => onDay(iso) : undefined}>
                <div className="day-n">{dn}</div>
                {info.hasLab ? <span className="lab-mark">🧪</span> : null}
                <div className="dots">{(info.subjects || []).slice(0, 6).map((s, i) => <i key={i} style={{ background: s.color }} />)}</div>
                <div className="tag">{tag}</div>
              </div>
            );
          }))}
        </div>
      </div>
    </>
  );
}

function Timetable({ st, setSt, toast, go }) {
  const [batch, setBatch] = useState(st.settings.batchName || "");
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState(null); // review rows

  const onFile = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, base64: String(reader.result).split(",")[1], mime: f.type || "application/octet-stream" });
    reader.readAsDataURL(f);
  };
  const doParse = async () => {
    if (!file) return toast("Choose a timetable file first.");
    if (!batch.trim()) return toast("Enter your batch name.");
    setParsing(true); setStatus(null);
    const r = await api.parse(file.base64, file.mime, batch.trim());
    setParsing(false);
    if (!r.ok) return toast(r.error || "Parsing failed.");
    const labs = r.result.subjects.filter((x) => x.kind === "lab").length;
    setStatus(`Found ${r.result.subjects.length} subjects (${labs} lab${labs === 1 ? "" : "s"}).`);
    setRows(r.result.subjects.map((s) => ({ name: s.name, code: s.code || "", kind: s.kind || "lecture", schedule: { ...s.schedule }, sessions: s.sessions || [] })));
  };
  const upd = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const updDay = (i, day, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, schedule: { ...r.schedule, [day]: Math.max(0, parseInt(v) || 0) } } : r)));
  const save = async () => {
    const subjects = (rows || []).filter((r) => r.name.trim());
    if (!subjects.length) return toast("Add at least one subject.");
    const r = await api.saveTimetable({ batchName: batch.trim(), subjects });
    if (!r.ok) return toast(r.error || "Could not save.");
    setSt((s) => ({ ...s, settings: r.settings, timetable: r.timetable, plan: r.plan }));
    setRows(null); toast("Timetable saved on this device."); go("dashboard");
  };

  const tt = st.timetable;
  return (
    <>
      <div className="page-head"><h1>Timetable</h1><p>Import once with AI, review, save. The file isn't stored.</p></div>
      {!st.settings.apiKey ? (
        <div className="card" style={{ borderColor: "var(--warn)", marginBottom: 16 }}>
          <div className="row between">
            <span className="small">⚠ No AI key yet. Choose a provider and add your own key to import (bring your own key).</span>
            <button className="btn" onClick={() => go("settings")}>Open Settings</button>
          </div>
        </div>
      ) : null}
      <div className="card">
        <div className="h2" style={{ marginBottom: 14 }}>Import from image or PDF</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div><label className="field-label">Your batch / division</label>
            <input type="text" placeholder="e.g. CS-B2" value={batch} onChange={(e) => setBatch(e.target.value)} /></div>
          <div><label className="field-label">Timetable file</label>
            <div className="row">
              <label className="btn" style={{ cursor: "pointer" }}>Choose file…
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={onFile} /></label>
              <span className="small">{file ? file.name : "No file chosen"}</span>
            </div></div>
        </div>
        <div className="row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={doParse} disabled={parsing}>{parsing ? <><span className="spinner" /> Parsing…</> : "Parse with Gemini"}</button>
          {status ? <span className="small status-ok">{status}</span> : null}
        </div>
      </div>

      {rows ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div className="h2">Review &amp; correct</div>
            <button className="btn" onClick={() => setRows((rs) => [...rs, { name: "", code: "", kind: "lecture", schedule: {}, sessions: [] }])}>+ Add subject</button>
          </div>
          <p className="small" style={{ marginBottom: 12 }}>Type = lecture/lab. Codes like <b>5J1</b> are labs (most important). Numbers are periods per day.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Subject</th><th>Code</th><th>Type</th>{DOW.map((d) => <th key={d}>{d}</th>)}<th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><input type="text" value={r.name} onChange={(e) => upd(i, { name: e.target.value })} /></td>
                    <td><input type="text" style={{ width: 80 }} value={r.code} onChange={(e) => upd(i, { code: e.target.value })} /></td>
                    <td><select value={r.kind} onChange={(e) => upd(i, { kind: e.target.value })}><option value="lecture">lecture</option><option value="lab">lab</option></select></td>
                    {DAYS.map((d) => <td key={d}><input className="num" type="number" min="0" value={r.schedule[d] || 0} onChange={(e) => updDay(i, d, e.target.value)} /></td>)}
                    <td><button className="btn ghost icon danger-text" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={save}>Save timetable</button>
            <button className="btn ghost" onClick={() => setRows(null)}>Cancel</button>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2" style={{ marginBottom: 4 }}>Current timetable</div>
        {!tt || !tt.subjects || !tt.subjects.length ? (
          <p className="small">No timetable saved yet. Import one above.</p>
        ) : (<>
          <p className="small" style={{ marginBottom: 12 }}>Batch: {tt.batchName || "—"}</p>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Subject</th><th>Code</th><th>Type</th>{DOW.map((d) => <th key={d}>{d}</th>)}</tr></thead>
              <tbody>{tt.subjects.map((s) => (
                <tr key={s.name}>
                  <td><span className="dot" style={{ display: "inline-block", background: s.color, marginRight: 8 }} />{s.name}</td>
                  <td>{s.code || ""}</td><td>{s.kind === "lab" ? <span className="badge lab">lab</span> : "lecture"}</td>
                  {DAYS.map((d) => <td key={d}>{s.schedule[d] || 0}</td>)}
                </tr>))}</tbody>
            </table>
          </div>
        </>)}
      </div>
    </>
  );
}

function Settings({ st, setSt, toast }) {
  const s0 = st.settings;
  const [f, setF] = useState({ ...s0 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    const r = await api.saveSettings({
      institutionType: f.institutionType, institutionName: f.institutionName, className: f.className,
      division: f.division, semester: f.semester, timetableName: f.timetableName, batchName: f.batchName,
      semesterStart: f.semesterStart, semesterEnd: f.semesterEnd,
      minPercent: +f.minPercent, labPercent: +f.labPercent, targetPercent: +f.targetPercent,
    });
    if (!r.ok) return toast(r.error || "Could not save.");
    setSt((p) => ({ ...p, settings: r.settings, plan: r.plan })); toast("Settings saved ✓");
  };
  const addHol = async () => {
    if (!f.newHoliday) return toast("Pick a date.");
    const r = await api.addHoliday(f.newHoliday);
    setSt((p) => ({ ...p, settings: r.settings, plan: r.plan })); setF((p) => ({ ...p, holidays: r.settings.holidays, newHoliday: "" }));
  };
  const rmHol = async (d) => { const r = await api.removeHoliday(d); setSt((p) => ({ ...p, settings: r.settings, plan: r.plan })); setF((p) => ({ ...p, holidays: r.settings.holidays })); };

  const slider = (label, key) => (
    <div className="slider-row">
      <div className="slider-top"><span className="field-label" style={{ margin: 0 }}>{label}</span><span className="v">{f[key]}%</span></div>
      <input type="range" min="0" max="100" value={f[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const field = (label, key, ph, type = "text") => (
    <div><label className="field-label">{label}</label>
      <input type={type} value={f[key] || ""} placeholder={ph} onChange={(e) => set(key, e.target.value)} /></div>
  );

  return (
    <>
      <div className="page-head"><h1>Settings</h1><p>Your institution, semester, targets, holidays and key.</p></div>
      <div className="card">
        <div className="h2" style={{ marginBottom: 14 }}>Institution &amp; class</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: 16 }}>
          <div><label className="field-label">Type</label>
            <select value={f.institutionType} onChange={(e) => set("institutionType", e.target.value)}>
              {(st.meta.institutionTypes || ["College", "School"]).map((t) => <option key={t}>{t}</option>)}
            </select></div>
          {field("College / School name", "institutionName", "e.g. ABC Institute of Technology")}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 14 }}>
          {field("Class / Year", "className", "e.g. SE / 2nd Yr")}
          {field("Division", "division", "e.g. A")}
          {field("Batch", "batchName", "e.g. B2")}
          {field("Semester", "semester", "e.g. 4")}
        </div>
        <div style={{ marginTop: 14 }}>{field("Timetable name", "timetableName", "e.g. Sem 4 — Spring 2026")}</div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2" style={{ marginBottom: 14 }}>Semester &amp; targets</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {field("Semester start date", "semesterStart", "", "date")}
          {field("Semester end date", "semesterEnd", "", "date")}
        </div>
        <div style={{ marginTop: 8 }}>
          {slider("Minimum attendance % — lectures", "minPercent")}
          {slider("Minimum attendance % — labs (most important)", "labPercent")}
          {slider("Target % — buffer days", "targetPercent")}
        </div>
        <div className="row" style={{ marginTop: 6 }}><button className="btn primary" onClick={save}>Save settings</button></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">Holidays</div>
        <p className="small" style={{ margin: "4px 0 12px" }}>Free skip days, excluded from all calculations.</p>
        <div className="row"><input type="date" style={{ maxWidth: 220 }} value={f.newHoliday || ""} onChange={(e) => set("newHoliday", e.target.value)} /><button className="btn" onClick={addHol}>Add holiday</button></div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {(f.holidays || []).length ? (f.holidays).map((h) => (<span className="chip" key={h}>{isoNice(h)}<button onClick={() => rmHol(h)}>✕</button></span>)) : <span className="small">No holidays added.</span>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h2">AI provider &amp; key (bring your own)</div>
        <p className="small" style={{ margin: "4px 0 10px" }}>Pick any provider and paste your own API key — used only for the one-time timetable import, stored locally on this device.</p>
        <ProviderField st={st} setSt={setSt} toast={toast} />
        <p className="small" style={{ marginTop: 14, color: "var(--text-3)" }}>{st.meta.app} v{st.meta.version} · data: {st.meta.dataPath}</p>
      </div>
    </>
  );
}

function ProviderField({ st, setSt, toast }) {
  const provs = st.meta.providers || [];
  const [provider, setProvider] = useState(st.settings.provider || "gemini");
  const [model, setModel] = useState(st.settings.model || "");
  const [key, setKey] = useState(st.settings.apiKey || "");
  const cur = provs.find((p) => p.id === provider) || provs[0] || {};
  const save = async () => {
    const r = await api.saveSettings({ provider, model: model.trim(), apiKey: key.trim() });
    if (r.settings) setSt((p) => ({ ...p, settings: r.settings, plan: r.plan }));
    toast("Saved — using " + (cur.label || provider) + ".");
  };
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <label className="field-label">Provider</label>
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(""); }}>
            {provs.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Model {cur.defaultModel ? <span style={{ color: "var(--text-3)" }}>(default: {cur.defaultModel})</span> : null}</label>
          <input list="modelopts" type="text" placeholder={cur.defaultModel || "default"} value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="modelopts">{(cur.models || []).map((m) => <option key={m} value={m} />)}</datalist>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="field-label">API key {cur.keyUrl ? <a href={cur.keyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>· get a key ↗</a> : null}</label>
        <input type="password" placeholder="Paste your API key here" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <div className="row" style={{ marginTop: 8, gap: 10 }}>
        <button className="btn primary" onClick={save}>Save</button>
        {cur.supportsPdf === false ? <span className="small">{cur.label}: images only (use Gemini/Claude for PDFs)</span> : <span className="small">Supports images &amp; PDFs</span>}
      </div>
    </>
  );
}

function DayModal({ st, iso, onClose, onMark }) {
  const info = st.plan.days.find((d) => d.date === iso);
  return (
    <div className="modal-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>{isoNice(iso)}</h3>
        {info && info.sessions && info.sessions.length ? info.sessions.map((se, i) => {
          const span = `${se.start || ""}–${se.end || ""}`.replace(/^–|–$/, "");
          return <div className={"sess " + (se.kind === "lab" ? "lab" : "")} key={i}>{span} &nbsp; {se.name}{se.code ? ` (${se.code})` : ""}{se.kind === "lab" ? " 🧪 LAB" : ""}</div>;
        }) : info && info.subjects && info.subjects.length ? <div className="sess">{info.subjects.map((s) => s.name).join(", ")}</div> : <div className="sess">No lectures scheduled.</div>}
        {info && info.marked ? <div className="sess" style={{ color: "var(--accent)" }}>Currently: {info.marked}</div> : null}
        <div className="actions">
          <button className="btn primary" onClick={() => onMark(iso, "attended")}>Mark attended (Go)</button>
          <button className="btn" onClick={() => onMark(iso, "skipped")}>Mark skipped (Stay home)</button>
          <button className="btn ghost" onClick={() => onMark(iso, "clear")}>Clear / auto</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [st, setSt] = useState(null);
  const [view, setView] = useState("dashboard");
  const [cal, setCalState] = useState({ y: null, m: null });
  const [toastMsg, setToastMsg] = useState("");
  const [dayIso, setDayIso] = useState(null);

  const toast = useCallback((m) => { setToastMsg(m); clearTimeout(window.__t); window.__t = setTimeout(() => setToastMsg(""), 2600); }, []);
  const setCal = (y, m) => setCalState({ y, m });

  useEffect(() => {
    api.bootstrap().then((b) => {
      setSt(b);
      document.documentElement.setAttribute("data-theme", (b.settings.appearance || "light"));
      let ref = b.today;
      if (b.settings.semesterStart && b.settings.semesterStart > ref) ref = b.settings.semesterStart;
      setCalState({ y: Number(ref.slice(0, 4)), m: Number(ref.slice(5, 7)) - 1 });
    });
  }, []);

  const toggleTheme = () => {
    const mode = (st.settings.appearance === "dark") ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", mode);
    setSt((p) => ({ ...p, settings: { ...p.settings, appearance: mode } }));
    api.saveSettings({ appearance: mode });
  };
  const go = (v) => setView(v);
  const onMark = async (iso, status) => {
    setDayIso(null);
    const r = await api.markDay(iso, status);
    if (r.plan) setSt((p) => ({ ...p, plan: r.plan }));
    toast("Updated — plan recalculated.");
  };

  if (!st) return (<div id="boot"><div className="bspin" /><div className="blogo">WOLF ATTENDANCE</div><div className="bsub">Loading…</div></div>);

  const nav = [["dashboard", "Dashboard"], ["calendar", "Calendar"], ["subjects", "Subjects"], ["timetable", "Timetable"], ["settings", "Settings"]];
  return (
    <div id="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l3 4 3-2 2 3 2-3 3 2 3-4-1 7c0 5-3 9-7 9s-7-4-7-9L4 4z" /></svg></div>
          <div><div className="name">WOLF</div><div className="sub">ATTENDANCE</div></div>
        </div>
        <nav className="nav">
          {nav.map(([k, label]) => (
            <button key={k} className={view === k ? "active" : ""} onClick={() => go(k)}><NavIcon name={k} />{label}</button>
          ))}
        </nav>
        <div className="side-bottom">
          <label className="theme-row"><span>Dark mode</span>
            <span className="switch"><input type="checkbox" checked={st.settings.appearance === "dark"} onChange={toggleTheme} /><span className="track" /><span className="thumb" /></span></label>
          <div className="side-ver">{st.meta.app} v{st.meta.version}</div>
        </div>
      </aside>
      <main className="main">
        <div className="page view-enter" key={view}>
          {view === "dashboard" && <Dashboard st={st} go={go} />}
          {view === "calendar" && <Calendar st={st} go={go} calY={cal.y} calM={cal.m} setCal={setCal} onDay={setDayIso} />}
          {view === "subjects" && <Subjects st={st} go={go} />}
          {view === "timetable" && <Timetable st={st} setSt={setSt} toast={toast} go={go} />}
          {view === "settings" && <Settings st={st} setSt={setSt} toast={toast} />}
        </div>
      </main>
      {dayIso ? <DayModal st={st} iso={dayIso} onClose={() => setDayIso(null)} onMark={onMark} /> : null}
      <div id="toast" className={toastMsg ? "show" : ""}>{toastMsg}</div>
    </div>
  );
}
