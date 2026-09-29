/* BCOMF Exam Prep — single-page app, no build step.
 * Topic priorities are computed from the past-paper questions in data/<CODE>.json,
 * so adding a new session's questions updates every ranking automatically. */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const cache = {};
  const YEAR_COLORS = { 1: "var(--y1)", 2: "var(--y2)", 3: "var(--y3)" };
  const STAGES = ["Not started", "Learned", "Practised", "Revised"];
  const STAGE_WEIGHT = [0, 0.4, 0.75, 1];
  const LEVELS = [
    { id: "critical", label: "Critical", min: 15, advice: "Must study" },
    { id: "high", label: "High", min: 10, advice: "Strongly recommended" },
    { id: "moderate", label: "Moderate", min: 6, advice: "Study if time" },
    { id: "low", label: "Low", min: 0, advice: "Optional" }
  ];
  const RECENT = 4;          // sessions counted as "recent"
  const MVP_TARGET = 120;    // default: average marks the minimum set should cover (5 × 20 plus spare choice)
  const HOURS_BY_KIND = { theory: 1, numerical: 1.5, mixed: 2 };

  /* ---------- storage (per-viewer convenience only) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    }
  };
  const getStage = (code, id) => store.get(`stage:${code}:${id}`, 0);
  const setStage = (code, id, n) => store.set(`stage:${code}:${id}`, n);

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = { "06": "Jun", "12": "Dec", "02": "Feb" };
  const sessionLabel = (s) => `${MONTHS[s.slice(5)] || s.slice(5)} ${s.slice(0, 4)}`;
  const fmtHours = (h) => { const m = Math.round(h * 60); const hh = Math.floor(m / 60), mm = m % 60; return hh ? (mm ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`; };
  const clock = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };

  async function load(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then((r) => { if (!r.ok) throw new Error(path); return r.json(); });
    }
    return cache[path];
  }

  /* ---------- analysis ---------- */
  function analyse(course) {
    const sessions = course.sessions;
    const recent = sessions.slice(-RECENT);
    const topics = course.topics.map((t) => {
      const qs = course.questions.filter((q) => q.topic === t.id);
      const total = qs.reduce((a, q) => a + q.m, 0);
      const avg = total / sessions.length;
      const recentAvg = qs.filter((q) => recent.includes(q.s)).reduce((a, q) => a + q.m, 0) / recent.length;
      const bySession = sessions.map((s) => qs.filter((q) => q.s === s).reduce((a, q) => a + q.m, 0));
      const seen = bySession.filter((m) => m > 0).length;
      const score = 0.6 * avg + 0.4 * recentAvg;
      const level = LEVELS.find((l) => score >= l.min);
      const diff = recentAvg - avg;
      const trend = diff >= 4 ? "Rising" : diff <= -4 ? "Falling" : "";
      const numShare = total ? qs.filter((q) => q.k === "num").reduce((a, q) => a + q.m, 0) / total : 0;
      return { ...t, qs, total, avg, recentAvg, bySession, seen, score, level, trend, numShare };
    }).sort((a, b) => b.score - a.score);

    // Minimum preparation: per part where the paper is split into parts with their own choice
    // (e.g. "2 of 4 from Part A"), otherwise across the whole paper. A compulsory part is
    // covered by the definitions sweep, not by picking topics.
    const p = course.pattern;
    const spare = p.spare || MVP_TARGET / (p.attempt * p.each);
    const groups = (p.parts || [{ id: null, name: "", attempt: p.attempt, of: p.questions }])
      .filter((g) => g.attempt < g.of)
      .map((g) => {
        const target = g.attempt * p.each * spare;
        const inGroup = (q) => !g.id || q.part === g.id;
        let covered = 0;
        const ids = [];
        for (const t of topics.filter((x) => !g.id || x.part === g.id)) {
          if (covered >= target) break;
          ids.push(t.id);
          covered += t.qs.filter(inGroup).reduce((a, q) => a + q.m, 0) / sessions.length;
        }
        return { ...g, ids, covered, need: g.attempt * p.each };
      });
    const mvp = groups.flatMap((g) => g.ids);
    const compulsory = (p.parts || []).find((g) => g.attempt === g.of);
    return { topics, mvp, groups, compulsory };
  }

  function readiness(code, topics) {
    const weight = topics.reduce((a, t) => a + t.avg, 0) || 1;
    return topics.reduce((a, t) => a + t.avg * STAGE_WEIGHT[getStage(code, t.id)], 0) / weight;
  }

  /* ---------- small components ---------- */
  const badge = (level) => `<span class="badge ${level.id}">${level.label}</span>`;

  function evidenceLine(t, n) {
    const type = t.numShare >= 0.6 ? "Mostly numerical" : t.numShare >= 0.2 ? "Theory + numerical" : "Theory";
    return `Asked in ${t.seen} of ${n} papers · avg ${t.avg.toFixed(0)} marks per paper · ${type}`;
  }

  function dots(t, sessions) {
    const cells = t.bySession.map((m, i) => {
      const cls = m >= 20 ? "on" : m > 0 ? "half" : "";
      const rec = i >= sessions.length - RECENT ? " recent" : "";
      return `<span class="dot ${cls}${rec}" title="${sessionLabel(sessions[i])}: ${m ? m + " marks" : "not asked"}"></span>`;
    }).join("");
    return `<div class="dots" aria-label="Marks per paper, oldest to newest">${cells}<span class="dots-label">${sessionLabel(sessions[0])} → ${sessionLabel(sessions[sessions.length - 1])}</span></div>`;
  }

  function ring(fraction) {
    const r = 26, c = 2 * Math.PI * r, pct = Math.round(fraction * 100);
    return `<svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${pct}% ready">
      <circle class="track" cx="32" cy="32" r="${r}"/>
      <circle class="bar" cx="32" cy="32" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - fraction)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="37" text-anchor="middle">${pct}%</text></svg>`;
  }

  function courseTabs(code, active) {
    const tabs = [["", "Priorities"], ["/plan", "Plan"], ["/exam", "Exam tips"], ["/papers", "Papers"]];
    return `<nav class="seg" aria-label="Course sections">${tabs.map(([p, l]) =>
      `<a href="#/c/${code}${p}" ${active === p ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  }

  function courseHeader(c, course) {
    const p = course ? course.pattern : null;
    const chips = p
      ? [`${p.time}`, `${p.marks} marks`, `Attempt ${p.attempt} of ${p.questions}`, `${p.each} marks each`]
      : c.exam ? [c.exam.time, `${c.exam.marks} marks`, c.exam.format] : [];
    return `<a class="back" href="#/">← All courses</a>
      <h1>${esc(c.code)} · ${esc(c.title)}</h1>
      <div class="chips"><span class="chip">Year ${c.year}</span>${chips.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>`;
  }

  /* ---------- views ---------- */
  async function viewHome() {
    const { courses } = await load("data/courses.json");
    let year = store.get("year", 1);
    let query = "";

    app.innerHTML = `
      <section class="card hero">
        <h1>Study what matters most</h1>
        <p>Pick your course to see which topics IGNOU asks most often, what to study first, and a plan for the time you have left.</p>
      </section>
      <label class="muted small" for="q">Search by course code or title</label>
      <input id="q" class="search" type="search" placeholder="e.g. 131 or Financial" autocomplete="off">
      <div class="tabs" role="tablist" aria-label="Year">
        ${[1, 2, 3].map((y) => `<button class="tab" role="tab" data-year="${y}" style="--tab-color:${YEAR_COLORS[y]}">Year ${y}</button>`).join("")}
      </div>
      <div id="list"></div>`;

    const list = app.querySelector("#list");
    const render = () => {
      app.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(!query && +b.dataset.year === year)));
      const q = query.toLowerCase().replace(/\s+/g, "");
      const shown = courses.filter((c) => q
        ? (c.code.toLowerCase().replace(/[\s-]/g, "") + c.title.toLowerCase().replace(/\s+/g, "")).includes(q.replace(/-/g, ""))
        : c.year === year);
      list.innerHTML = shown.length ? shown.map((c) => `
        <a class="card card-link course" href="#/c/${esc(c.code)}" style="--year-color:${YEAR_COLORS[c.year]}">
          <span class="course-code">${esc(c.code)}</span>
          <span>
            <span class="course-title">${esc(c.title)}</span><br>
            <span class="course-meta">${query ? `Year ${c.year} · ` : ""}${c.papers} past papers${c.exam ? ` · ${esc(c.exam.format)}` : ""}</span>
            ${c.ready ? '<span class="pill">Ready</span>' : '<span class="pill soon">Papers only</span>'}
          </span>
        </a>`).join("") : `<p class="muted">No course matches “${esc(query)}”.</p>`;
    };
    app.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
      year = +b.dataset.year; store.set("year", year); query = ""; app.querySelector("#q").value = ""; render();
    }));
    app.querySelector("#q").addEventListener("input", (e) => { query = e.target.value.trim(); render(); });
    render();
  }

  async function getCourse(code) {
    const { courses } = await load("data/courses.json");
    const c = courses.find((x) => x.code === code);
    if (!c) return {};
    const course = c.ready ? await load(`data/${code}.json`) : null;
    return { c, course, analysis: course ? analyse(course) : null };
  }

  async function viewCoursePending(c) {
    const papers = (await load("data/papers.json"))[c.code] || [];
    app.innerHTML = `${courseHeader(c)}
      <div class="callout">Topic analysis for this course is coming soon. Meanwhile, here are its past papers.</div>
      ${papersList(papers)}`;
  }

  function papersList(papers) {
    if (!papers.length) return `<p class="muted">No past papers found for this course yet.</p>`;
    return `<div class="card"><table class="simple"><thead><tr><th>Session</th><th>Paper</th></tr></thead><tbody>
      ${papers.map((p) => `<tr><td>${sessionLabel(p.s)}</td><td><a href="${esc(p.url)}" target="_blank" rel="noopener">Open PDF (IGNOU)</a></td></tr>`).join("")}
      </tbody></table></div>`;
  }

  async function viewCourse(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!c) return viewNotFound();
    if (!course) return viewCoursePending(c);
    const { topics, groups, compulsory } = analysis;
    const n = course.sessions.length;
    const parts = course.pattern.parts || [];
    const byId = (id) => topics.find((t) => t.id === id);
    const checkRow = (t) => `
          <label class="check">
            <input type="checkbox" data-topic="${t.id}" ${getStage(code, t.id) >= 3 ? "checked" : ""}>
            <span><a href="#/c/${code}/t/${t.id}">${esc(t.name)}</a><br><span class="muted small">${badge(t.level)} ${t.seen} of ${n} papers · avg ${t.avg.toFixed(0)} marks</span></span>
          </label>`;
    const topicCard = (t) => `
        <a class="card card-link" href="#/c/${code}/t/${t.id}">
          <div class="topic-head">
            <span class="topic-name">${esc(t.name)}</span>
            <span>${badge(t.level)}</span>
          </div>
          <div class="evidence">${evidenceLine(t, n)}${t.trend ? ` · <span class="trend">${t.trend} recently</span>` : ""}</div>
          ${dots(t, course.sessions)}
          ${getStage(code, t.id) ? `<div class="stage" style="margin-top:8px">✓ ${STAGES[getStage(code, t.id)]}</div>` : ""}
        </a>`;
    const mvpHtml = groups.length === 1 && !groups[0].id
      ? `<p>Short on time? These <strong>${groups[0].ids.length} topics</strong> have carried about <strong>${Math.round(groups[0].covered)} marks</strong> on an average paper — enough to pick your ${groups[0].attempt} questions with some choice to spare.</p>
        ${groups[0].ids.map((id) => checkRow(byId(id))).join("")}`
      : `<p>Short on time? You need <strong>${groups.map((g) => `${g.attempt} questions from ${esc(g.name.split(":")[0])}`).join(" and ")}</strong>. These topics give you enough choice in each part.</p>
        ${compulsory ? `<div class="callout small"><strong>${esc(compulsory.name)}:</strong> short answers from across the syllabus. Read the key points and formulas of every topic once — 30 minutes is enough.</div>` : ""}
        ${groups.map((g) => `<h3>${esc(g.name)}</h3>
          <p class="muted small">These have carried about ${Math.round(g.covered)} marks per paper in this part; you need ${g.need}.</p>
          ${g.ids.map((id) => checkRow(byId(id))).join("")}`).join("")}`;
    const topicsHtml = parts.some((g) => g.attempt < g.of)
      ? parts.filter((g) => g.attempt < g.of).map((g) =>
          `<h3>${esc(g.name)}</h3>${topics.filter((t) => t.part === g.id).map(topicCard).join("")}`).join("")
      : topics.map(topicCard).join("");

    const blocks = course.blocks.map((b) => {
      const marks = topics.filter((t) => t.block === b.no).reduce((a, t) => a + t.avg, 0);
      return { ...b, marks };
    });
    const maxBlock = Math.max(...blocks.map((b) => b.marks));

    app.innerHTML = `${courseHeader(c, course)}
      ${courseTabs(code, "")}
      <section class="card">
        <div class="progress-row">
          ${ring(readiness(code, topics))}
          <div><strong>Your exam readiness</strong><br><span class="muted small">Weighted by how many marks each topic carries. Mark topics as Learned, Practised or Revised to fill it.</span></div>
        </div>
      </section>

      <h2>Start here: minimum preparation</h2>
      <section class="card">
        ${mvpHtml}
        <p class="muted small">Ticking a topic marks it as Revised.</p>
      </section>

      <h2>All topics by priority</h2>
      <p class="muted small">Ranked from ${n} papers (${sessionLabel(course.sessions[0])} – ${sessionLabel(course.sessions[n - 1])}). Recent papers count extra. Full squares = a 20-mark question that session; half = 10 marks or less.</p>
      ${topicsHtml}

      <h2>Marks by ${parts.length ? "area" : "block"}</h2>
      <section class="card">
        <p class="muted small">Average marks each ${parts.length ? "area" : "block"} of the syllabus carries per paper.</p>
        <div class="bars">
          ${blocks.map((b) => `
            <div class="bar-row">
              <span>${b.part ? `Part ${b.part} · ` : `Block ${b.no}: `}${esc(b.title)}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${(b.marks / maxBlock) * 100}%;display:block"></span></span>
              <span class="bar-val">${Math.round(b.marks)}</span>
            </div>`).join("")}
        </div>
      </section>
      <p class="muted small">Priorities are based on past papers and show what IGNOU has asked before. They are not a guarantee of what will be asked next.</p>`;

    app.querySelectorAll("input[data-topic]").forEach((box) => box.addEventListener("change", () => {
      const id = box.dataset.topic;
      setStage(code, id, box.checked ? 3 : 0);
      viewCourse(code);
    }));
  }

  async function viewTopic(code, id) {
    const { c, course, analysis } = await getCourse(code);
    const t = analysis && analysis.topics.find((x) => x.id === id);
    if (!t) return viewNotFound();
    const n = course.sessions.length;
    const papers = (await load("data/papers.json"))[code] || [];
    const paperUrl = (s) => (papers.find((p) => p.s === s) || {}).url;
    const asked = [...t.qs].sort((a, b) => b.s.localeCompare(a.s) || a.q.localeCompare(b.q));
    const block = course.blocks.find((b) => b.no === t.block);
    const stage = getStage(code, id);

    app.innerHTML = `
      <a class="back" href="#/c/${code}">← ${esc(code)} priorities</a>
      <h1>${esc(t.name)}</h1>
      <div class="chips">${badge(t.level)}<span class="chip">${block.part ? `Part ${block.part} · ` : `Block ${block.no}: `}${esc(block.title)}</span><span class="chip">${esc(t.level.advice)}</span></div>
      <p class="evidence" style="margin-top:10px">${evidenceLine(t, n)}${t.trend ? ` · ${t.trend} recently` : ""}</p>
      ${dots(t, course.sessions)}
      <div class="callout">${esc(t.summary)}</div>

      <section class="card">
        <strong>Where are you with this topic?</strong>
        <div class="stages" style="margin-top:10px">
          ${STAGES.map((s, i) => `<button type="button" data-stage="${i}" aria-pressed="${stage === i}">${s}</button>`).join("")}
        </div>
      </section>

      <h2>Key points</h2>
      <section class="card"><ul class="points">${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>

      ${t.method ? `<h2>Method for problems</h2>
      <section class="card"><ol class="steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}

      ${t.formula && t.formula.length ? `<h2>Formulas & rules</h2>
      <section class="card">${t.formula.map((f) => `<div class="formula">${esc(f)}</div>`).join("")}</section>` : ""}

      ${t.frame ? `<h2>How to write the answer</h2>
      <section class="card"><p style="margin:0">${esc(t.frame)}</p></section>` : ""}

      ${t.mistakes && t.mistakes.length ? `<h2>Common mistakes</h2>
      <div class="callout warn"><ul class="points">${t.mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}

      <h2>Asked before (${asked.length})</h2>
      <section class="card"><ul class="qlist">
        ${asked.map((q) => `<li>
          <span class="qsess">${sessionLabel(q.s)}<br>Q${esc(q.q)}</span>
          <span>${esc(q.t)}<br><span class="qtype">${q.k === "num" ? "Numerical" : "Theory"}</span>
            ${paperUrl(q.s) ? ` · <a class="small" href="${esc(paperUrl(q.s))}" target="_blank" rel="noopener">paper</a>` : ""}</span>
          <span class="qmarks">${q.m} m</span></li>`).join("")}
      </ul></section>`;

    app.querySelectorAll("[data-stage]").forEach((b) => b.addEventListener("click", () => {
      setStage(code, id, +b.dataset.stage);
      app.querySelectorAll("[data-stage]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }));
  }

  /* ---------- planner ---------- */
  const MODES = [
    { id: "today", label: "Exam today", pick: (t, a) => a.mvp.includes(t.id), reserve: 0.15, hint: "Only the minimum set, then a quick revision." },
    { id: "last", label: "Last minute", pick: (t) => ["critical", "high"].includes(t.level.id), reserve: 0.15, hint: "Critical and High topics only." },
    { id: "score", label: "Score-oriented", pick: (t) => t.level.id !== "low", reserve: 0.2, hint: "Everything except Low priority." },
    { id: "full", label: "Full preparation", pick: () => true, reserve: 0.2, hint: "Every topic, plus revision and a mock paper." }
  ];
  const HOUR_PRESETS = [3, 5, 8, 16, 24, 40];

  // "Q1 plus 2 from Part A and 2 from Part B" or "5 questions".
  function pickText(p) {
    if (!p.parts) return `pick ${p.attempt} questions`;
    return "answer " + p.parts.map((g) => g.attempt === g.of
      ? g.name.replace(/\s*\(compulsory\)/, "")
      : `${g.attempt} from ${g.name.split(":")[0]}`).join(" + ");
  }

  function buildPlan(code, course, analysis, mode, hours) {
    const reserve = Math.max(0.5, hours * mode.reserve);
    let left = hours - reserve;
    const slots = [];
    const skipped = [];
    let at = 0;
    if (analysis.compulsory && left >= 1.5) {
      slots.push({ from: 0, to: 0.5, what: `${analysis.compulsory.name}: definitions sweep`, how: "Read the key points and formulas of every topic once. Q1 asks short answers from across the syllabus." });
      at = 0.5; left -= 0.5;
    }
    const todo = analysis.topics
      .filter((x) => mode.pick(x, analysis) && getStage(code, x.id) < 3)
      .map((t) => ({ t, need: HOURS_BY_KIND[t.kind] * (1 - STAGE_WEIGHT[getStage(code, t.id)]) }));
    // When time is short, shrink every topic rather than dropping later ones:
    // the student needs enough topics to choose 5 questions from.
    const totalNeed = todo.reduce((a, x) => a + x.need, 0);
    const squeeze = totalNeed > left ? left / totalNeed : 1;
    const quarter = (h) => Math.max(0.5, Math.round(h * 4) / 4);
    for (const { t, need } of todo) {
      if (left < 0.5) { skipped.push(t); continue; }
      const give = Math.min(quarter(need * squeeze), left);
      const latest = [...t.qs].sort((a, b) => b.s.localeCompare(a.s));
      const num = latest.find((q) => q.k === "num");
      const th = latest.find((q) => q.k === "th");
      const partial = give < need * 0.75;
      const how = partial
        ? `Short on time: learn the key points${t.kind === "theory" ? " and the answer outline" : ", the method steps and formulas"} only.`
        : t.kind === "theory"
          ? `Learn the key points, then outline an answer to: “${th ? th.t : "a past question"}” (${th ? sessionLabel(th.s) : ""}).`
          : `Learn the method and formulas, then solve ${num ? `the ${sessionLabel(num.s)} Q${num.q} problem: “${num.t}”` : "one past problem"}.${th ? " Skim the theory points too." : ""}`;
      slots.push({ from: at, to: at + give, what: t.name, id: t.id, level: t.level, how });
      at += give; left -= give;
    }
    if (left >= 1 && mode.id !== "today") {
      const last = course.sessions[course.sessions.length - 1];
      const mock = Math.min(3, left);
      slots.push({ from: at, to: at + mock, what: "Mock paper", how: `Attempt the ${sessionLabel(last)} paper: ${pickText(course.pattern)}, and write against the clock.` });
      at += mock; left -= mock;
    }
    const rev = reserve + Math.max(0, left);
    slots.push({ from: at, to: at + rev, what: "Final revision", how: "Revise formulas, key points and answer outlines of the topics above. Read the exam tips." });
    return { slots, skipped };
  }

  async function viewPlan(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!course) return viewNotFound();
    let hours = store.get(`plan:${code}:hours`, 5);
    let modeId = store.get(`plan:${code}:mode`, "today");

    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/plan")}
      <section class="card">
        <div class="field"><label>How much study time do you have before the exam?</label>
          <div class="options" id="hours">${HOUR_PRESETS.map((h) => `<button type="button" data-h="${h}">${h <= 8 ? h + " hours" : h / 8 + " days (" + h + "h)"}</button>`).join("")}</div>
        </div>
        <div class="field"><label>Preparation mode</label>
          <div class="options" id="modes">${MODES.map((m) => `<button type="button" data-m="${m.id}">${m.label}</button>`).join("")}</div>
          <span class="muted small" id="modeHint"></span>
        </div>
      </section>
      <section class="card" id="plan"></section>`;

    const render = () => {
      const mode = MODES.find((m) => m.id === modeId);
      app.querySelectorAll("#hours button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.h === hours)));
      app.querySelectorAll("#modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === modeId)));
      app.querySelector("#modeHint").textContent = mode.hint + " Topics you marked Revised are skipped.";
      const { slots, skipped } = buildPlan(code, course, analysis, mode, hours);
      app.querySelector("#plan").innerHTML = `<strong>Your ${fmtHours(hours)} plan</strong>
        ${slots.map((s) => `<div class="slot">
          <span class="slot-time">${clock(s.from)} – ${clock(s.to)}</span>
          <span><span class="slot-what">${s.id ? `<a href="#/c/${code}/t/${s.id}">${esc(s.what)}</a>` : esc(s.what)}</span> ${s.level ? badge(s.level) : ""}<br>
          <span class="slot-how">${esc(s.how)}</span></span></div>`).join("")}
        ${skipped.length ? `<div class="callout warn">Not enough time for: ${skipped.map((t) => esc(t.name)).join(", ")}. Add time or accept the risk.</div>` : ""}`;
    };
    app.querySelector("#hours").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      hours = +b.dataset.h; store.set(`plan:${code}:hours`, hours);
      if (hours > 8 && modeId === "today") { modeId = "last"; store.set(`plan:${code}:mode`, modeId); }
      render();
    });
    app.querySelector("#modes").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      modeId = b.dataset.m; store.set(`plan:${code}:mode`, modeId); render();
    });
    render();
  }

  async function viewExam(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!course) return viewNotFound();
    const p = course.pattern;
    const perQ = Math.floor((180 - 25) / p.attempt);
    const top = analysis.topics.slice(0, 5).map((t) => t.name).join(", ");
    const tips = course.examTips || {};
    const list = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");
    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/exam")}
      <h2>The paper</h2>
      <section class="card"><p>${esc(p.summary)}</p>
        ${p.note ? `<p class="muted small">${esc(p.note)}</p>` : ""}
        <p style="margin:0">The same areas return every session: <strong>${esc(top)}</strong>. If you have prepared these, you can usually find the questions you need.</p></section>

      <h2>Time plan (3 hours)</h2>
      <section class="card"><table class="simple"><tbody>
        <tr><td><strong>First 10 min</strong></td><td>Read all ${p.questions} questions. Decide what you will attempt (${esc(pickText(p))}) and one backup.</td></tr>
        <tr><td><strong>${p.attempt} × ${perQ} min</strong></td><td>One question at a time. Start with the one you know best to build confidence.</td></tr>
        <tr><td><strong>Last 15 min</strong></td><td>Check totals and calculations, number every answer correctly, fill any gaps.</td></tr>
      </tbody></table></section>

      <h2>Choosing questions</h2>
      <section class="card"><ul class="points">
        <li>A numerical you can solve fully is the safest 20 marks — step marks are usually given even if the final figure is off.</li>
        ${list(tips.choosing || [])}
        <li>For 10 + 10 questions, attempt only if you can write both parts; half an answer caps you at 10.</li>
      </ul></section>

      <h2>Writing theory answers</h2>
      <section class="card"><ol class="steps">
        <li><strong>Definition first</strong> (2–3 lines), in textbook words where you can.</li>
        <li><strong>Headed points</strong>: 6–8 points for 20 marks, 4–5 for 10 marks — a heading plus one or two lines each.</li>
        <li><strong>Diagram or table</strong> for any "distinguish between" question — a two-column comparison scores well.</li>
        <li><strong>Example</strong> for each concept — one line each.</li>
        <li><strong>One-line conclusion.</strong></li>
      </ol></section>

      <h2>Presenting numericals</h2>
      <section class="card"><ul class="points">
        ${list(tips.numerical || ["Write working notes for every calculation — they earn marks on their own."])}
        <li>State any assumption you make in one line.</li>
      </ul></section>

      <h2>If you only partly know a question</h2>
      <section class="card"><ul class="points">
        <li>Write the definition, the format or formula, and the steps — partial credit is common.</li>
        <li>In a numerical, set up the working and get as far as you can; don't leave it blank.</li>
      </ul></section>

      <h2>The night before and on the day</h2>
      <section class="card"><ul class="points">
        <li>Revise formulas and the method steps of the Critical topics — not new chapters.</li>
        <li>Carry hall ticket, ID card, 2 pens, pencil, ruler and a simple calculator if allowed.</li>
        <li>Sleep — tired recall costs more marks than one extra chapter gains.</li>
      </ul></section>`;
  }

  async function viewPapers(code) {
    const { c, course } = await getCourse(code);
    if (!course) return viewNotFound();
    const papers = (await load("data/papers.json"))[code] || [];
    const notes = Object.entries(course.sessionNotes || {}).map(([s, n]) => `<li><strong>${sessionLabel(s)}:</strong> ${esc(n)}</li>`).join("");
    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/papers")}
      <p class="muted small">Official papers from IGNOU's website. Practise the latest two under exam conditions.</p>
      ${papersList(papers)}
      ${notes ? `<ul class="points small muted">${notes}</ul>` : ""}`;
  }

  function viewNotFound() {
    app.innerHTML = `<h1>Page not found</h1><p><a href="#/">Go to all courses</a></p>`;
  }

  /* ---------- router ---------- */
  async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (!parts.length) await viewHome();
      else if (parts[0] === "c" && parts[1]) {
        const code = parts[1];
        if (parts[2] === "t" && parts[3]) await viewTopic(code, parts[3]);
        else if (parts[2] === "plan") await viewPlan(code);
        else if (parts[2] === "exam") await viewExam(code);
        else if (parts[2] === "papers") await viewPapers(code);
        else await viewCourse(code);
      } else viewNotFound();
    } catch (err) {
      app.innerHTML = `<h1>Couldn't load this page</h1><p class="muted">Check your connection and try again.</p>`;
      console.error(err);
    }
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  }

  /* ---------- theme ---------- */
  const themeBtn = document.getElementById("themeToggle");
  const savedTheme = store.get("theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  themeBtn.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set("theme", next);
  });

  window.addEventListener("hashchange", route);
  route();
})();
