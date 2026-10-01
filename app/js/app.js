/* BCom Buddy — single-page app, no build step.
 * Product rule (see CLAUDE.md): help students study, never add setup or extra work.
 * Every screen leads with something to study; tracking is one optional tap.
 * Topic priorities are computed from the past-paper questions in data/<CODE>.json,
 * so adding a new session's questions updates every ranking automatically. */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const cache = {};
  const YEAR_COLORS = { 1: "var(--y1)", 2: "var(--y2)", 3: "var(--y3)" };
  const LEVELS = [
    { id: "critical", label: "Critical", min: 15, advice: "Must study" },
    { id: "high", label: "High", min: 10, advice: "Strongly recommended" },
    { id: "moderate", label: "Moderate", min: 6, advice: "Study if time" },
    { id: "low", label: "Low", min: 0, advice: "Optional" }
  ];
  const RECENT = 4;          // sessions counted as "recent"
  const SPARE = 1.2;         // the minimum set covers 1.2 × the marks a student must answer, for choice
  const HOURS_BY_KIND = { theory: 1, numerical: 1.5, mixed: 2 };
  const PAPER_ROOT = "../";   // where question-papers/ sits, relative to this page

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
  /* ---------- viewer preferences (Settings) ---------- */
  const APP_VERSION = "2.1";
  const APP_RELEASED = "October 2026";
  // Study styles change what a topic page shows; "standard" is the full notes as written.
  const STYLES = [
    ["standard", "Standard", "The full notes, as written"],
    ["short", "Short", "Quick revision: top points, formulas and steps"],
    ["detailed", "Detailed", "Everything, with diagram explanations and past questions on the page"],
    ["visual", "Visual", "Diagrams and formulas first, points as numbered cards"],
    ["example", "Example-oriented", "The standard notes plus worked examples"]
  ];
  const studyStyle = () => { const v = store.get("style", "standard"); return STYLES.some(([k]) => k === v) ? v : "standard"; };
  function applyPrefs() {
    document.documentElement.dataset.textsize = store.get("textsize", "m");
    document.documentElement.dataset.density = store.get("density", "comfortable");
  }
  applyPrefs();

  const isDone = (code, id) => store.get(`done:${code}:${id}`, false) === true;
  const setDone = (code, id, v) => store.set(`done:${code}:${id}`, v);

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = { "06": "Jun", "12": "Dec", "02": "Feb" };
  const sessionLabel = (s) => `${MONTHS[s.slice(5)] || s.slice(5)} ${s.slice(0, 4)}`;
  const clock = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const duration = (h) => { const m = Math.round(h * 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`; };
  const marks = (m) => Math.round(m * 10) / 10;

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
    // Levels are judged by share of the paper, scaled to a 180-mark paper,
    // so a 50-mark MCQ paper and a 180-mark written paper rank alike.
    const offer = course.questions.reduce((a, q) => a + q.m, 0) / sessions.length;
    const scale = 180 / offer;
    const topics = course.topics.map((t) => {
      const qs = course.questions.filter((q) => q.topic === t.id);
      const total = qs.reduce((a, q) => a + q.m, 0);
      const avg = total / sessions.length;
      const recentAvg = qs.filter((q) => recent.includes(q.s)).reduce((a, q) => a + q.m, 0) / recent.length;
      const bySession = sessions.map((s) => qs.filter((q) => q.s === s).reduce((a, q) => a + q.m, 0));
      const seen = bySession.filter((m) => m > 0).length;
      const score = 0.6 * avg + 0.4 * recentAvg;
      const level = LEVELS.find((l) => score * scale >= l.min);
      const numShare = total ? qs.filter((q) => q.k === "num").reduce((a, q) => a + q.m, 0) / total : 0;
      return { ...t, qs, total, avg, recentAvg, bySession, seen, score, level, numShare };
    }).sort((a, b) => b.score - a.score);

    // Minimum preparation: per part where the paper is split into parts with their own choice
    // (e.g. "2 of 4 from Part A"), otherwise across the whole paper. A compulsory part is
    // handled separately (see `compulsory`).
    // Per-part lists only when each topic belongs to one part (e.g. Maths vs Statistics);
    // when topics span sections, one list for the whole paper is shorter and just as safe.
    const p = course.pattern;
    const spare = p.spare || SPARE;
    const perPart = p.parts && course.topics.some((t) => t.part);
    const whole = { id: null, name: "", attempt: p.attempt, of: p.questions, target: (p.parts ? p.marks : p.attempt * p.each) * spare };
    const groups = (perPart ? p.parts : [whole])
      .filter((g) => !perPart || g.attempt < g.of)
      .map((g) => {
        const each = g.each || p.each;
        const target = g.target || g.attempt * each * spare;
        const inGroup = (q) => !g.id || q.part === g.id;
        let covered = 0;
        const ids = [];
        // Topics tied to one part are only picked for that part; otherwise count each topic's marks in this part.
        for (const t of topics.filter((x) => !g.id || !x.part || x.part === g.id)) {
          const m = t.qs.filter(inGroup).reduce((a, q) => a + q.m, 0) / sessions.length;
          if (!m) continue;
          if (covered >= target) break;
          ids.push(t.id);
          covered += m;
        }
        return { ...g, ids, covered, need: g.attempt * each };
      });
    const mvp = [...new Set(groups.flatMap((g) => g.ids))];
    const compulsory = perPart ? p.parts.find((g) => g.attempt === g.of) : null;
    return { topics, mvp, groups, compulsory };
  }

  /* ---------- small components ---------- */
  const badge = (level) => `<span class="badge ${level.id}">${level.label}</span>`;
  const evidence = (t, n, mcq) => `Asked in ${t.seen} of ${n} papers · avg ${Math.round(t.avg)} ${mcq ? "questions" : "marks"}`;
  const doneMark = (code, id) => (isDone(code, id) ? `<span class="done-tick" aria-label="Done">✓</span>` : "");

  function topicRow(code, t, n, mcq) {
    return `<a class="row" href="#/c/${code}/t/${t.id}">
      <span class="row-main"><span class="row-title">${esc(t.name)}</span>
        <span class="row-sub">${evidence(t, n, mcq)}</span></span>
      <span class="row-end">${doneMark(code, t.id)}${badge(t.level)}<span class="chev" aria-hidden="true">›</span></span>
    </a>`;
  }

  function courseTabs(code, active) {
    const tabs = [["", "Study"], ["/papers", "Past papers"], ["/plan", "Plan"], ["/exam", "Exam tips"]];
    return `<nav class="seg" aria-label="Course sections">${tabs.map(([p, l]) =>
      `<a href="#/c/${code}${p}" ${active === p ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
  }

  function examLine(c, course) {
    if (course) {
      const p = course.pattern;
      return p.mcq ? `${p.time} · ${p.marks} marks · ${p.questions} MCQs, all compulsory`
        : p.parts || p.pick ? `${p.time} · ${p.marks} marks · ${pickText(p)}` : `${p.time} · ${p.marks} marks · any ${p.attempt} of ${p.questions} questions`;
    }
    return c.exam ? `${c.exam.time} · ${c.exam.marks} marks · ${c.exam.format}` : "";
  }

  function courseHeader(c, course) {
    return `<a class="back" href="#/">← All courses</a>
      <h1>${esc(c.title)}</h1>
      <p class="muted small head-meta">${esc(c.code)} · Year ${c.year}${examLine(c, course) ? ` · ${esc(examLine(c, course))}` : ""}</p>`;
  }

  // "Q1 + 2 from Part A + 2 from Part B" or "any 5 questions" (pattern.pick says it when neither fits).
  function pickText(p) {
    if (p.pick) return p.pick;
    if (p.mcq) return `all ${p.questions} questions`;
    if (!p.parts) return `any ${p.attempt} questions`;
    return p.parts.map((g) => g.attempt === g.of
      ? g.name.replace(/\s*\((compulsory|both)[^)]*\)/i, "") + " (compulsory)"
      : `${g.attempt} from ${g.name.split(/[:(]/)[0].trim()}`).join(" + ");
  }

  // A paper downloads from this site as "<CODE> <Mon YYYY>.pdf", so every term gets its own
  // name (IGNOU names each term's file just "<CODE>.pdf").
  const paperHref = (code, p) => p.file
    ? `href="${esc(PAPER_ROOT + p.file)}" download="${esc(`${code} ${sessionLabel(p.s)}.pdf`)}"`
    : `href="${esc(p.url)}"`;

  // MCQ answers are our own (IGNOU publishes no answer key); only confirmed ones are included.
  const ANSWER_NOTE = "Our answers, not an official IGNOU key.";
  const answerText = (i, opt) => `(${i}) ${esc(opt)}`;

  function paperButtons(code, papers, limit) {
    const list = limit ? papers.slice(0, limit) : papers;
    return `<div class="papers">${list.map((p) =>
      `<a class="paper" ${paperHref(code, p)} target="_blank" rel="noopener"><span class="paper-s">${sessionLabel(p.s)}</span><span class="paper-l">PDF ↓</span></a>`).join("")}</div>`;
  }

  // Diagrams from js/figures.js that a topic lists in "figures"; captions explain how to read them.
  function figuresHtml(t, captions = true) {
    const figs = (t.figures || []).map((id) => window.FIGURES && window.FIGURES[id]).filter(Boolean);
    if (!figs.length) return "";
    return `<h2>${figs.length > 1 ? "Diagrams" : "Diagram"}</h2>${figs.map((f) => `
      <figure class="card fig"><figcaption class="fig-title">${esc(f.title)}</figcaption>${f.draw()}${captions ? `<p class="fig-note">${esc(f.caption)}</p>` : ""}</figure>`).join("")}`;
  }

  // Worked examples (shown in the Example-oriented style). A blank line separates paragraphs.
  function examplesHtml(t) {
    if (!t.examples || !t.examples.length) return `<h2>Examples</h2><p class="muted small">Examples for this topic are being added.</p>`;
    return `<h2>${t.examples.length > 1 ? "Examples" : "Example"}</h2>${t.examples.map((e) => `
      <section class="card example">${e.split(/\n+/).map((l, i) => i ? `<p>${esc(l)}</p>` : `<h3>${esc(l)}</h3>`).join("")}</section>`).join("")}`;
  }

  /* ---------- views ---------- */
  async function viewHome() {
    const { courses } = await load("data/courses.json");
    let year = store.get("year", 1);
    let query = "";

    app.innerHTML = `
      <div class="tabs" role="tablist" aria-label="Year">
        ${[1, 2, 3].map((y) => `<button class="tab" role="tab" data-year="${y}" style="--tab-color:${YEAR_COLORS[y]}">Year ${y}</button>`).join("")}
      </div>
      <input id="q" class="search" type="search" placeholder="Search course code or name, e.g. 131" autocomplete="off" aria-label="Search courses">
      <div id="list" class="list"></div>`;

    const list = app.querySelector("#list");
    const render = () => {
      app.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(!query && +b.dataset.year === year)));
      const q = query.toLowerCase().replace(/[\s-]/g, "");
      const shown = courses.filter((c) => q
        ? (c.code.toLowerCase().replace(/[\s-]/g, "") + c.title.toLowerCase().replace(/\s+/g, "")).includes(q)
        : c.year === year);
      list.innerHTML = shown.length ? shown.map((c) => `
        <a class="row course" href="#/c/${esc(c.code)}" style="--year-color:${YEAR_COLORS[c.year]}">
          <span class="course-code">${esc(c.code)}</span>
          <span class="row-main"><span class="row-title">${esc(c.title)}</span>
            <span class="row-sub">${c.ready ? "Topics, notes, plan & past papers" : c.papers ? `${c.papers} past papers` : "No past papers yet"}${query ? ` · Year ${c.year}` : ""}</span></span>
          <span class="chev" aria-hidden="true">›</span>
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

  async function viewCourse(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!c) return viewNotFound();
    const papers = (await load("data/papers.json"))[code] || [];
    if (!course) {
      app.innerHTML = `${courseHeader(c)}
        <h2>Past papers</h2>
        ${papers.length ? paperButtons(code, papers) : `<p class="muted">No past papers found for this course yet.</p>`}
        <p class="muted small">Topic priorities and notes for this course are being prepared.</p>`;
      return;
    }
    const { topics, groups, compulsory } = analysis;
    const n = course.sessions.length;
    const byId = (id) => topics.find((t) => t.id === id);
    const split = groups.length > 1 || groups[0].id;
    const others = topics.filter((t) => !analysis.mvp.includes(t.id));
    const mcq = !!course.pattern.mcq;
    const repeated = course.repeated || [];
    const repeatItem = (r) => `<li><span class="rep-q">${esc(r.t)}</span>
        <span class="rep-opts">${r.opts.map((o, i) => `<span>(${i + 1}) ${esc(o)}</span>`).join("")}</span>
        ${r.a ? `<span class="rep-ans"><strong>Answer:</strong> ${answerText(r.a, r.opts[r.a - 1])}</span>` : ""}
        <span class="rep-meta">Asked ${r.sessions.length}× · ${r.sessions.map(sessionLabel).join(", ")}</span></li>`;

    app.innerHTML = `${courseHeader(c, course)}
      ${courseTabs(code, "")}

      <section class="card focus">
        <h2 class="focus-title">Study these first</h2>
        <p class="muted small">${split
          ? `They give you enough choice in each section, based on ${n} past papers.`
          : mcq
            ? `They have given about ${Math.round(groups[0].covered)} of the ${course.pattern.questions} questions on an average paper. Based on ${n} past papers.`
            : `They have carried about ${Math.round(groups[0].covered)} marks on an average paper${(course.pattern.spare || SPARE) >= 1 ? ` — enough to answer ${esc(pickText(course.pattern))}` : ""}. Based on ${n} past papers.`}</p>
        ${course.pattern.caution ? `<p class="note small">${esc(course.pattern.caution)}</p>` : ""}
        ${compulsory && compulsory.sweep ? `<p class="note small"><strong>${esc(compulsory.name)}:</strong> ${esc(compulsory.sweep)}</p>` : ""}
        ${groups.map((g) => `${split ? `<h3>${esc(g.name)}</h3>` : ""}<div class="rows">${g.ids.map((id) => topicRow(code, byId(id), n, mcq)).join("")}</div>`).join("")}
      </section>

      ${repeated.length ? `<h2>Asked again and again</h2>
      <p class="muted small">These exact questions have come up in more than one paper. Read them with the topic notes.${repeated.some((r) => r.a) ? ` ${ANSWER_NOTE}` : ""}</p>
      <section class="card"><ul class="replist">${repeated.slice(0, 8).map(repeatItem).join("")}</ul>
        ${repeated.length > 8 ? `<details><summary>Show all ${repeated.length}</summary><ul class="replist">${repeated.slice(8).map(repeatItem).join("")}</ul></details>` : ""}
      </section>` : ""}

      <div class="section-head"><h2>Latest past papers</h2><a href="#/c/${code}/papers">All ${papers.length} →</a></div>
      ${paperButtons(code, papers, 4)}

      ${others.length ? `<h2>Other topics</h2>
      <p class="muted small">In order of priority. Study these after the list above.</p>
      <div class="rows card">${others.map((t) => topicRow(code, t, n, mcq)).join("")}</div>` : ""}`;
  }

  // Past questions of a topic, most important first: identical questions grouped, ranked by
  // the marks they have carried in all papers together, then by how recent they are.
  function askedList(t) {
    const byText = new Map();
    [...t.qs].sort((a, b) => b.s.localeCompare(a.s)).forEach((q) => {
      const k = q.t.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!byText.has(k)) byText.set(k, { ...q, times: 0, carried: 0 });
      const g = byText.get(k);
      g.times += 1; g.carried += q.m;
    });
    return [...byText.values()].sort((a, b) => b.carried - a.carried || b.s.localeCompare(a.s));
  }

  // Each row opens the latest paper it was asked in, at that question.
  const askedItem = (code, q, mcq) => `<li><a class="ask" href="#/c/${code}/paper/${q.s}/${encodeURIComponent(q.q)}">
          <span class="ask-main"><span class="ask-q">${esc(q.t)}</span>
            <span class="ask-meta">${q.times > 1 ? `Asked ${q.times}× · ` : ""}${sessionLabel(q.s)}${mcq ? "" : ` · ${marks(q.m)} marks`}</span></span>
          <span class="chev" aria-hidden="true">›</span></a></li>`;

  // All past questions of one topic, on their own page.
  async function viewAsked(code, id) {
    const { c, course, analysis } = await getCourse(code);
    const t = analysis && analysis.topics.find((x) => x.id === id);
    if (!t) return viewNotFound();
    const mcq = !!course.pattern.mcq;
    const asked = askedList(t);
    const papers = new Set(t.qs.map((q) => q.s)).size;
    app.innerHTML = `
      <a class="back" href="#/c/${code}/t/${id}">← ${esc(t.name)}</a>
      <h1>Asked in past papers</h1>
      <p class="muted small">${asked.length} questions from ${papers} of ${course.sessions.length} papers · most important first · ${esc(c.code)}</p>
      <section class="card asked-card"><ul class="asked">${asked.map((q) => askedItem(code, q, mcq)).join("")}</ul></section>`;
  }

  async function viewTopic(code, id) {
    const { c, course, analysis } = await getCourse(code);
    const t = analysis && analysis.topics.find((x) => x.id === id);
    if (!t) return viewNotFound();
    const n = course.sessions.length;
    const mcq = !!course.pattern.mcq;
    const asked = askedList(t);
    // Next topic in study order: the "study first" list, then the rest.
    const order = [...analysis.mvp, ...analysis.topics.map((x) => x.id).filter((x) => !analysis.mvp.includes(x))];
    const next = analysis.topics.find((x) => x.id === order[order.indexOf(id) + 1]);

    const style = studyStyle(), styleName = STYLES.find(([k]) => k === style)[1];
    const short = style === "short", detailed = style === "detailed", visual = style === "visual";
    const SHORT_N = 4;
    const pointList = (list) => `<ul class="points">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
    const pointsHtml = visual
      ? `<h2>Key points</h2><ol class="pt-cards">${t.points.map((p, i) => `<li><span class="pt-n" aria-hidden="true">${i + 1}</span><span>${esc(p)}</span></li>`).join("")}</ol>`
      : `<h2>Key points</h2>
      <section class="card" id="pts">${pointList(short ? t.points.slice(0, SHORT_N) : t.points)}${short && t.points.length > SHORT_N ? `<button type="button" class="more" id="morePts">Show all ${t.points.length} points</button>` : ""}</section>`;
    const methodHtml = t.method ? (visual
      ? `<h2>How to solve</h2><ol class="flow-steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>`
      : `<h2>How to solve</h2>
      <section class="card"><ol class="steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>`) : "";
    const formulaHtml = t.formula && t.formula.length ? `<h2>Formulas</h2>
      <section class="card">${t.formula.map((f) => `<div class="formula">${esc(f)}</div>`).join("")}</section>` : "";
    const frameHtml = t.frame && !short ? `<h2>How to write the answer</h2>
      <section class="card"><p class="flush">${esc(t.frame)}</p></section>` : "";
    const mistakesHtml = t.mistakes && t.mistakes.length && !short ? `<h2>Common mistakes</h2>
      <div class="callout warn"><ul class="points">${t.mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : "";
    const pastHtml = detailed && asked.length ? `<h2>Asked in past papers</h2>
      <section class="card asked-card"><ul class="asked">${asked.slice(0, 5).map((q) => askedItem(code, q, mcq)).join("")}</ul></section>` : "";
    const body = visual
      ? [figuresHtml(t), formulaHtml, pointsHtml, methodHtml, frameHtml, mistakesHtml]
      : [pointsHtml, style === "example" ? examplesHtml(t) : "", figuresHtml(t, !short), methodHtml, formulaHtml, frameHtml, mistakesHtml, pastHtml];

    app.innerHTML = `
      <a class="back" href="#/c/${code}">← ${esc(c.title)}</a>
      <h1>${esc(t.name)}</h1>
      <p class="head-meta">${badge(t.level)} <span class="muted small">${evidence(t, n, mcq)}</span></p>
      <p class="style-chip">Study style: <strong>${styleName}</strong> · <a href="#/settings">Change</a></p>
      <p class="lead">${esc(t.summary)}</p>
      ${t.units && t.units.length ? `<p class="book-ref"><span class="book-ref-h">In your IGNOU book</span>${t.units.map((u) =>
        `<span>${u.block ? `Block ${u.block} · ` : ""}Unit ${u.unit} ${esc(u.title)}${u.part ? ` <span class="muted">(${esc(u.part)})</span>` : ""}</span>`).join("")}</p>` : ""}

${body.join("\n")}

      <a class="btn secondary ai-btn" href="#/ask/${code}/${id}">${AI_SPARK} Ask AI about this topic</a>
      ${asked.length ? `<a class="btn secondary see-all" href="#/c/${code}/t/${id}/asked">${detailed ? "All past questions" : "Asked in past papers"} (${asked.length}) <span aria-hidden="true">→</span></a>` : ""}

      <div class="topic-foot">
        <button type="button" class="btn secondary" id="done" aria-pressed="${isDone(code, id)}">${isDone(code, id) ? "✓ Done" : "Mark as done"}</button>
        ${next ? `<a class="btn" href="#/c/${code}/t/${next.id}">Next: ${esc(next.name)} →</a>` : `<a class="btn" href="#/c/${code}">Back to course</a>`}
      </div>`;

    const more = app.querySelector("#morePts");
    if (more) more.addEventListener("click", () => { app.querySelector("#pts").innerHTML = pointList(t.points); });
    app.querySelector("#done").addEventListener("click", (e) => {
      const v = !isDone(code, id);
      setDone(code, id, v);
      e.currentTarget.setAttribute("aria-pressed", String(v));
      e.currentTarget.textContent = v ? "✓ Done" : "Mark as done";
    });
  }

  /* ---------- past question view ---------- */
  // One past question shown in the app (no download): term, number, marks and the question
  // as printed, with the part asked marked. Text comes from data/text/<CODE>.json;
  // ^{..} and _{..} mark super- and subscripts.
  const fmt = (s) => esc(s).replace(/\^\{([^}]*)\}/g, "<sup>$1</sup>").replace(/_\{([^}]*)\}/g, "<sub>$1</sub>");

  // "8(b)" → question 8, part b; "2(a,b)", "6(a–c)", "1(ii,iii)", "1 (or)".
  function parseRef(ref) {
    const m = /^(\d+)\s*(?:\(([^)]*)\))?/.exec(ref || "");
    if (!m) return { n: null, subs: [] };
    const inner = (m[2] || "").trim();
    if (inner === "or") return { n: +m[1], subs: [], alt: true };
    const subs = [];
    inner.split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => {
      const r = /^([a-h])\s*[–-]\s*([a-h])$/.exec(x);
      if (r) for (let c = r[1].charCodeAt(0); c <= r[2].charCodeAt(0); c++) subs.push(String.fromCharCode(c));
      else subs.push(x);
    });
    return { n: +m[1], subs };
  }

  // The question's body, and the marks printed for the part asked (or the whole question).
  function questionBody(q, ref) {
    let afterOr = false;
    const marked = [];
    const blocks = (q.b || []).map((b) => {
      if (b.or) { afterOr = true; return `<p class="por">Or</p>`; }
      if (b.t) return `<pre class="ptable">${fmt(b.t.join("\n"))}</pre>`;
      const mark = (b.s && ref.subs.includes(b.s)) || (ref.alt && afterOr);
      if (mark) marked.push(b);
      return `<p class="pp${mark ? " mark" : ""}">${fmt(b.p)}${b.m ? ` <span class="pm">${esc(b.m)}</span>` : ""}</p>`;
    }).join("");
    const opts = q.o ? `<ol class="popts">${q.o.map((o) => `<li>${fmt(o)}</li>`).join("")}</ol>` : "";
    const imgs = (q.img || []).map((i) => `<img class="pimg" src="${esc(i.src)}" width="${i.w}" height="${i.h}" alt="Question ${q.n} as printed">`).join("");
    // Marks as printed: the part asked if it has its own, else the whole question's
    // (its first line, or the parts' marks added up when only the parts carry them).
    const printed = (list) => list.map((b) => b.m).filter(Boolean);
    const all = (q.b || []).filter((b) => b.p);
    const whole = all.length && all[0].m ? [all[0].m] : printed(all);
    const m = printed(marked).length ? printed(marked) : whole.slice(0, marked.length ? 1 : whole.length);
    return { html: imgs || `${blocks}${opts}`, marks: m.join(" + ") };
  }

  async function viewQuestion(code, s, refText) {
    const { c, course } = await getCourse(code);
    if (!course) return viewNotFound();
    const [papers, text] = await Promise.all([load("data/papers.json"), load(`data/text/${code}.json`).catch(() => null)]);
    const pdf = (papers[code] || []).find((p) => p.s === s);
    const paper = text && text.papers[s];
    const ref = parseRef(refText);
    const q = paper && paper.items.find((it) => it.n === ref.n);
    const label = (refText || "").replace(/\s*\(or\)$/, " (Or)");
    let section = "";
    if (paper && q) for (const it of paper.items) { if (it === q) break; if (it.h) section = it.h; }
    const body = q ? questionBody(q, ref) : null;
    const known = course.questions.find((x) => x.s === s && String(x.q) === refText);
    const markText = paper && paper.mcq ? "1 mark" : body && body.marks ? `${body.marks} marks` : known ? `${marks(known.m)} marks` : "";
    const exact = (paper && paper.mcq) || course.topics.every((t) => t.kind === "theory") || (q && q.img);
    const ansKey = `${s}/${ref.n}`;
    const ans = q && q.o && course.answers && course.answers[ansKey];
    app.innerHTML = `
      ${prevHash ? `<a class="back" href="#${prevHash}" id="back">← Back</a>` : `<a class="back" href="#/c/${code}">← ${esc(c.title)}</a>`}
      <h1>Question ${esc(label)}</h1>
      <p class="qv-meta"><span><strong>${sessionLabel(s)}</strong> term-end exam</span>${markText ? `<span><strong>${esc(markText)}</strong></span>` : ""}${section ? `<span>${esc(section)}</span>` : ""}</p>
      <p class="muted small head-meta">${esc(c.code)} · ${esc(c.title)}</p>
      ${q ? `<section class="card qv">${body.html}</section>`
        : `<p class="muted">This question isn't available as text yet.</p>`}
      ${ans ? `<details class="qv-ans"><summary>Show answer</summary>
        <p><strong>Answer:</strong> ${answerText(ans, q.o[ans - 1])}</p>
        <p class="small muted">${ANSWER_NOTE}</p></details>` : ""}
      ${q ? `<button type="button" class="btn ai-btn" id="aiSolve">${AI_SPARK} ${paper && paper.mcq ? "Ask AI to explain this" : "Ask AI to solve this"}</button>` : ""}
      ${pdf ? `<a class="btn secondary qv-pdf" ${paperHref(code, pdf)} target="_blank" rel="noopener">Download full paper (PDF)</a>` : ""}
      ${q && !exact ? `<p class="small muted">Text from the official paper; tables and formulas may look slightly different in print.</p>` : ""}`;
    // Wide tables (trial balances) shrink to fit the screen rather than hide columns.
    app.querySelectorAll(".ptable").forEach((t) => {
      const fit = t.clientWidth / t.scrollWidth;
      if (fit < 1) t.style.fontSize = `${Math.max(0.6, 0.8 * fit * 0.97).toFixed(3)}rem`;
    });
    const solve = app.querySelector("#aiSolve");
    if (solve) solve.addEventListener("click", () => {
      const topic = known && known.topic;
      aiDraft = { key: `${code}/${topic || "-"}`, text: `${paper && paper.mcq ? "Explain the correct answer to this multiple-choice question" : "Solve this question"} from the ${sessionLabel(s)} ${c.code} term-end paper${markText ? ` (${markText})` : ""}${ref.subs.length ? `, part ${ref.subs.join(", ")}` : ""}:\n\n${questionText(q, ref)}` };
      location.hash = `#/ask/${code}${topic ? `/${topic}` : ""}`;
    });
    const backLink = app.querySelector("#back");
    if (backLink) backLink.addEventListener("click", (e) => { e.preventDefault(); history.back(); });
  }

  /* ---------- planner ---------- */
  // One tap: the time left decides which topics go in. No separate mode setting.
  const TIME_CHOICES = [
    { h: 3, label: "3 hours", pick: (t, a) => a.mvp.includes(t.id) },
    { h: 6, label: "6 hours", pick: (t, a) => a.mvp.includes(t.id) },
    { h: 16, label: "2 days", pick: (t) => ["critical", "high"].includes(t.level.id) },
    { h: 40, label: "1 week", pick: (t) => t.level.id !== "low" }
  ];

  // What to do in a topic's slot.
  function slotHow(t, short, mcq) {
    if (mcq) return short ? "Read the key points." : "Read the notes, then go through its past questions.";
    if (short) return `Read the key points${t.kind === "theory" ? " and answer outline" : ", method and formulas"}.`;
    const nums = t.qs.filter((q) => q.k === "num");
    const solve = t.kind !== "theory" && nums.length > 0;
    const qs = solve ? nums : t.qs.filter((q) => q.k === "th");
    // Practise on a full-length question: a short note is weak practice for a long answer.
    const big = Math.max(0, ...qs.map((q) => q.m)) / 2;
    const q = qs.filter((x) => x.m >= big).sort((a, b) => b.s.localeCompare(a.s))[0];
    const ref = q ? `“${q.t}” (${sessionLabel(q.s)})` : "a past question";
    return solve ? `Learn the method, then solve: ${ref}.` : `Read the notes, then outline: ${ref}.`;
  }

  function buildPlan(code, course, analysis, choice) {
    const hours = choice.h;
    const mcq = !!course.pattern.mcq;
    const reserve = Math.max(0.5, hours * 0.15);
    let left = hours - reserve;
    const slots = [];
    let at = 0;
    if (analysis.compulsory && analysis.compulsory.sweep && left >= 1.5) {
      slots.push({ from: 0, to: 0.5, what: `${analysis.compulsory.name}: quick sweep`, how: analysis.compulsory.sweep });
      at = 0.5; left -= 0.5;
    }
    const todo = analysis.topics
      .filter((x) => choice.pick(x, analysis) && !isDone(code, x.id))
      .map((t) => ({ t, need: HOURS_BY_KIND[t.kind] }));
    // When time is short, shrink every topic rather than dropping later ones:
    // the student needs enough topics to choose their questions from.
    // Round down to quarter hours so the plan fits, then give the spare
    // quarters back to the highest-priority topics.
    const totalNeed = todo.reduce((a, x) => a + x.need, 0);
    const squeeze = totalNeed > left ? left / totalNeed : 1;
    const gives = todo.map(({ need }) => Math.max(0.5, Math.floor(need * squeeze * 4 + 1e-9) / 4));
    const used = (k) => gives.slice(0, k).reduce((a, b) => a + b, 0);
    let keep = todo.length;
    while (keep > 0 && used(keep) > left + 1e-9) keep--;
    let spare = left - used(keep);
    for (let more = true; more; ) {
      more = false;
      for (let i = 0; i < keep && spare >= 0.25 - 1e-9; i++) {
        if (gives[i] + 0.25 <= todo[i].need + 1e-9) { gives[i] += 0.25; spare -= 0.25; more = true; }
      }
    }
    todo.slice(0, keep).forEach(({ t, need }, i) => {
      slots.push({ from: at, to: at + gives[i], what: t.name, id: t.id, level: t.level, how: slotHow(t, gives[i] < need * 0.75, mcq) });
      at += gives[i]; left -= gives[i];
    });
    const skipped = todo.slice(keep).map((x) => x.t);
    if (left >= 1 && hours > 6) {
      const last = course.sessions[course.sessions.length - 1];
      const mock = Math.min(3, left);
      slots.push({ from: at, to: at + mock, what: "Mock paper", how: `${mcq ? "Attempt" : "Write"} the ${sessionLabel(last)} paper against the clock (${pickText(course.pattern)}).` });
      at += mock; left -= mock;
    }
    const formulas = analysis.topics.some((t) => t.formula || t.kind !== "theory");
    slots.push({ from: at, to: at + reserve + Math.max(0, left), what: "Final revision",
      how: mcq ? "Go over the key points and the questions asked again and again."
        : `Go over the ${formulas ? "formulas, " : ""}key points and answer outlines above.` });
    return { slots, skipped };
  }

  async function viewPlan(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!course) return viewNotFound();
    let h = store.get("planHours", 6);
    if (!TIME_CHOICES.some((x) => x.h === h)) h = 6;

    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/plan")}
      <p class="small muted">Time left before the exam:</p>
      <div class="options" id="hours">${TIME_CHOICES.map((x) => `<button type="button" data-h="${x.h}">${x.label}</button>`).join("")}</div>
      <section class="card" id="plan"></section>`;

    const render = () => {
      const choice = TIME_CHOICES.find((x) => x.h === h);
      app.querySelectorAll("#hours button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.h === h)));
      const { slots, skipped } = buildPlan(code, course, analysis, choice);
      app.querySelector("#plan").innerHTML = `
        ${slots.map((s) => `<div class="slot">
          <span class="slot-time">${h > 8 ? duration(s.to - s.from) : `${clock(s.from)}–${clock(s.to)}`}</span>
          <span><span class="slot-what">${s.id ? `<a href="#/c/${code}/t/${s.id}">${esc(s.what)}</a>` : esc(s.what)}</span> ${s.level ? badge(s.level) : ""}<br>
          <span class="slot-how">${esc(s.how)}</span></span></div>`).join("")}
        ${skipped.length ? `<p class="small muted">No time left for: ${skipped.map((t) => esc(t.name)).join(", ")}.</p>` : ""}`;
    };
    app.querySelector("#hours").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      h = +b.dataset.h; store.set("planHours", h); render();
    });
    render();
  }

  async function viewExam(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!course) return viewNotFound();
    const p = course.pattern;
    // Writing time: the paper's time less 10 minutes to choose and 15 to check.
    const perMark = Math.round((((parseFloat(p.time) || 3) * 60 - 25) / p.marks) * 10) / 10;
    const eachList = p.marksEach || [...new Set((p.parts || [p]).map((g) => g.each || p.each))].sort((a, b) => b - a);
    const top = analysis.topics.slice(0, 4).map((t) => t.name).join(", ");
    const tips = course.examTips || {};
    const list = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");
    if (p.mcq) {
      app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/exam")}
        <section class="card">
          <p>${esc(p.summary)}</p>
          <p class="flush">Asked most: <strong>${esc(top)}</strong>.</p>
        </section>
        <h2>In the exam hall</h2>
        <section class="card"><ul class="points">${list(tips.mcq || [])}</ul></section>`;
      return;
    }
    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/exam")}
      <section class="card">
        <p>${esc(p.summary)}</p>
        ${p.note ? `<p class="muted small">${esc(p.note)}</p>` : ""}
        <p class="flush">Asked most: <strong>${esc(top)}</strong>.</p>
      </section>

      <h2>In the exam hall</h2>
      <section class="card"><ul class="points">
        <li><strong>First 10 min:</strong> read every question, choose yours (${esc(pickText(p))}) plus one backup.</li>
        <li><strong>Writing:</strong> about ${perMark} min per mark (${eachList.map((m) => `${m} marks ≈ ${Math.round(m * perMark)} min`).join(", ")}). Start with the one you know best.</li>
        <li><strong>Last 15 min:</strong> check calculations, question numbers and anything left blank.</li>
      </ul></section>

      <h2>Choosing questions</h2>
      <section class="card"><ul class="points">
        ${list(tips.choosing || [])}
        <li>For 10 + 10 questions, attempt only if you can write both parts.</li>
      </ul></section>

      <h2>Writing answers</h2>
      <section class="card"><ul class="points">
        <li>Start with a 2–3 line definition.</li>
        <li>Use headed points: 6–8 for 20 marks, 4–5 for 10 marks.</li>
        <li>Use a table for "distinguish between" and a diagram wherever one fits.</li>
        ${list(tips.numerical || ["Show working for every calculation — it earns marks on its own."])}
        <li>If you only partly know a question, write the definition, format or formula and the steps — partial marks are common.</li>
      </ul></section>`;
  }

  async function viewPapers(code) {
    const { c, course } = await getCourse(code);
    if (!c) return viewNotFound();
    const papers = (await load("data/papers.json"))[code] || [];
    const notes = course ? Object.entries(course.sessionNotes || {}).map(([s, n]) => `<li><strong>${sessionLabel(s)}:</strong> ${esc(n)}</li>`).join("") : "";
    app.innerHTML = `${courseHeader(c, course)}${course ? courseTabs(code, "/papers") : ""}
      <p class="muted small">Official IGNOU papers, saved as course code and term. Try the latest two under exam conditions.</p>
      ${paperButtons(code, papers)}
      ${notes ? `<ul class="points small muted">${notes}</ul>` : ""}`;
  }

  async function viewSettings(sub) {
    const { courses } = await load("data/courses.json");
    const papers = courses.reduce((a, c) => a + (c.papers || 0), 0);
    const seg = (name, key, def, opts) => `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map(([v, l]) =>
      `<button type="button" role="radio" class="seg-btn" data-key="${key}" data-val="${v}" aria-checked="${v === store.get(key, def)}">${l}</button>`).join("")}</div>`;
    const theme = store.get("theme", null) || "system";
    app.innerHTML = `
      <h1>Settings</h1>

      <h2>Study style</h2>
      <p class="muted small">How topic pages show your notes. Change it any time.</p>
      <div class="choices" role="radiogroup" aria-label="Study style">${STYLES.map(([v, l, d]) => `
        <button type="button" role="radio" class="choice" data-style="${v}" aria-checked="${v === studyStyle()}">
          <span class="choice-l">${l}${v === "standard" ? ` <span class="muted small">(default)</span>` : ""}</span>
          <span class="choice-d">${d}</span></button>`).join("")}
      </div>

      <h2 id="ai"${sub === "ai" ? " data-anchor" : ""}>AI assistant</h2>
      <section class="card ai-set">
        <p class="small" id="aiStatus"></p>
        <label class="field-l" for="aiKeyIn">Your Gemini API key</label>
        <div class="ai-key-row">
          <input id="aiKeyIn" class="search" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste your key (usually starts with AIza…)">
          <button type="button" class="btn secondary" id="aiShow" aria-pressed="false">Show</button>
        </div>
        <div class="ai-key-btns">
          <button type="button" class="btn" id="aiSave">Save and test</button>
          <button type="button" class="btn secondary" id="aiRemove">Remove key</button>
        </div>
        <p class="small" id="aiMsg" role="status"></p>
        <label class="field-l" for="aiModelSel">Model</label>
        <select id="aiModelSel" class="search"></select>
        <p class="small"><a href="#/ai-guide">How to get a free Gemini API key →</a></p>
        <p class="small muted flush">Your key is saved only in this browser on this device and is sent only to Google. Anyone using this device could see it, so remove it on a shared phone.</p>
      </section>

      <h2>Text size</h2>
      ${seg("Text size", "textsize", "m", [["s", "Small"], ["m", "Default"], ["l", "Large"], ["xl", "Extra large"]])}

      <h2>Text density</h2>
      ${seg("Text density", "density", "comfortable", [["comfortable", "Comfortable"], ["compact", "Compact"]])}

      <h2>Theme</h2>
      <div class="seg" role="radiogroup" aria-label="Theme">${[["light", "Light"], ["dark", "Dark"], ["system", "Same as device"]].map(([v, l]) =>
        `<button type="button" role="radio" class="seg-btn" data-theme="${v}" aria-checked="${v === theme}">${l}</button>`).join("")}</div>

      <h2>Welcome screen</h2>
      <button type="button" class="btn secondary" id="showWelcome">Show the welcome screen</button>

      <h2>About</h2>
      <section class="card about">
        <div class="about-head"><img src="icons/icon.svg" width="48" height="48" alt="">
          <div><strong>BCom Buddy</strong><br><span class="muted small">Version ${APP_VERSION} · ${APP_RELEASED}</span></div></div>
        <p class="small">Exam preparation for IGNOU BCOMF (B.Com) students: topics ranked from past papers, short notes checked against the study material, diagrams, past papers and a study plan.</p>
        <p class="small muted flush">${courses.length} courses · ${papers} past papers · no sign-up; your settings and progress stay on this phone.</p>
      </section>

      <h2>Disclaimer</h2>
      <p class="note small">Independent study aid, not affiliated with IGNOU. Topic priorities are guidance, not a guarantee.</p>`;

    const pick = (sel, b) => app.querySelectorAll(sel).forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    app.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => { store.set("style", b.dataset.style); pick(".choice", b); }));
    app.querySelectorAll(".seg-btn[data-key]").forEach((b) => b.addEventListener("click", () => {
      store.set(b.dataset.key, b.dataset.val); applyPrefs(); pick(`.seg-btn[data-key="${b.dataset.key}"]`, b);
    }));
    app.querySelectorAll(".seg-btn[data-theme]").forEach((b) => b.addEventListener("click", () => {
      setTheme(b.dataset.theme === "system" ? null : b.dataset.theme); pick(".seg-btn[data-theme]", b);
    }));
    app.querySelector("#showWelcome").addEventListener("click", showWelcome);

    // AI key: saved only after Google confirms it works.
    const keyIn = app.querySelector("#aiKeyIn"), msg = app.querySelector("#aiMsg"), modelSel = app.querySelector("#aiModelSel");
    const fillModels = (names) => {
      const cur = aiModel();
      const list = names.includes(cur) ? names : [cur, ...names];
      modelSel.innerHTML = list.map((n) => `<option value="${esc(n)}"${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("");
    };
    const status = () => {
      const k = aiKey();
      app.querySelector("#aiStatus").innerHTML = k
        ? `<span class="ok-tick">✓</span> Key saved (ending <code>${esc(k.slice(-4))}</code>). <a href="#/ask">Open Ask AI</a>`
        : "Not set up. The assistant needs your own free Gemini API key.";
      app.querySelector("#aiRemove").hidden = !k;
      modelSel.disabled = !k;
      fillModels(store.get("aiModels", []));
    };
    status();
    app.querySelector("#aiShow").addEventListener("click", (e) => {
      const show = keyIn.type === "password";
      keyIn.type = show ? "text" : "password";
      e.currentTarget.textContent = show ? "Hide" : "Show";
      e.currentTarget.setAttribute("aria-pressed", String(show));
    });
    app.querySelector("#aiSave").addEventListener("click", async (e) => {
      const k = keyIn.value.replace(/\s+/g, "") || aiKey();
      if (!k) { msg.textContent = "Paste your key first."; return; }
      const btn = e.currentTarget;
      btn.disabled = true; msg.className = "small"; msg.textContent = "Checking the key with Google…";
      try {
        const names = await aiListModels(k);
        store.set("aiKey", k);
        store.set("aiModels", names);
        if (!names.includes(store.get("aiModel", ""))) store.set("aiModel", aiPickModel(names));
        keyIn.value = "";
        msg.className = "small ok"; msg.textContent = `✓ Your key works. Using ${aiModel()}.`;
        status();
      } catch (err) {
        msg.className = "small bad";
        msg.textContent = err.friendly || "Couldn't reach Google. Check your internet connection and try again.";
      } finally { btn.disabled = false; }
    });
    app.querySelector("#aiRemove").addEventListener("click", () => {
      store.set("aiKey", ""); store.set("aiModel", ""); store.set("aiModels", []);
      msg.className = "small"; msg.textContent = "Key removed from this device.";
      status();
    });
    modelSel.addEventListener("change", () => store.set("aiModel", modelSel.value));
  }

  /* ---------- AI study assistant (the student's own Gemini API key) ---------- */
  // Optional. Requests go straight from this device to Google's Gemini API with the key the
  // student saved in Settings; the key stays in this browser's storage and nowhere else.
  const AI_BASE = "https://generativelanguage.googleapis.com/v1beta";
  const AI_DEFAULT_MODEL = "gemini-2.5-flash";
  const AI_KEY_PAGE = "https://aistudio.google.com/app/apikey";
  const aiKey = () => String(store.get("aiKey", "") || "").trim();
  const aiModel = () => store.get("aiModel", "") || AI_DEFAULT_MODEL;
  const aiChats = {};   // conversations for this visit, one per course/topic
  let aiDraft = null;   // { key, text } handed over from a past-question page
  let aiBusy = null;    // AbortController of the answer being written

  async function aiError(r) {
    let msg = "";
    try { const d = await r.json(); msg = (d.error && d.error.message) || ""; } catch (e) { /* not JSON */ }
    const err = new Error(msg || `HTTP ${r.status}`);
    err.status = r.status;
    err.friendly = r.status === 400 && /api key/i.test(msg) ? "Google didn't accept this API key. Copy it again from Google AI Studio and save it in Settings."
      : r.status === 401 || r.status === 403 ? "This key can't use the Gemini API. Create a key in Google AI Studio and save it in Settings."
      : r.status === 429 ? "You've reached your free Gemini limit for now. Wait a minute and try again (the daily limit resets the next day)."
      : r.status === 404 ? "That AI model isn't available for your key."
      : r.status >= 500 ? "Google's AI service is busy right now. Please try again in a moment."
      : `The AI service returned an error${msg ? `: ${msg}` : "."}`;
    return err;
  }

  // Gemini models this key can use for chat.
  async function aiListModels(key) {
    const r = await fetch(`${AI_BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) throw await aiError(r);
    const d = await r.json();
    return (d.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, "")).filter((n) => /^gemini-/.test(n));
  }
  // The newest stable "flash" model: quick, and inside the free tier.
  function aiPickModel(names) {
    const ver = (n) => parseFloat((/^gemini-(\d+(?:\.\d+)?)/.exec(n) || [])[1] || 0);
    const stable = names.filter((n) => /flash/.test(n) && !/lite|preview|exp|image|tts|live|audio|thinking|embed/.test(n))
      .sort((a, b) => ver(b) - ver(a) || a.length - b.length);
    return stable[0] || names.find((n) => /flash/.test(n)) || names[0] || AI_DEFAULT_MODEL;
  }

  // Instructions for the model, plus our notes on the topic so answers match them.
  function aiSystem(ctx) {
    const lines = [
      "You are the study assistant inside BCom Buddy, an exam-preparation app for Indian students of the IGNOU B.Com (BCOMF) programme.",
      "Help only with studying: accounting, commerce, business law, economics, taxation, management, statistics, English and the other courses of this programme, including how to write exam answers. Politely decline anything unrelated.",
      "Write in simple, clear English for an Indian undergraduate. Use ₹ for money, and Indian laws and examples.",
      "For a numerical problem: list the given data, state the formula, show every step of the working, check the arithmetic, and state the final answer clearly. Show journal entries, ledger accounts and statements as tables.",
      "For a theory question: give an exam-ready answer — a short definition or introduction, the main points under headings, an example, and a brief conclusion. If the marks are given, match the length roughly to the marks.",
      "Never invent case names, section numbers, dates or figures. If a law, rate or limit may have changed, say so and advise checking the latest study material. If you are not sure, say that you are not sure.",
      "Format with Markdown: ### headings, bullet or numbered lists, **bold** for key terms, and tables. Do not use LaTeX; write formulas in plain text, for example Profit = Sales − Cost."
    ];
    if (ctx.c) lines.push("", `The student is studying ${ctx.c.code} ${ctx.c.title}.`);
    if (ctx.t) {
      const t = ctx.t;
      lines.push(`Current topic: ${t.name}. The app's notes on it are below — keep your answer consistent with them.`, `Summary: ${t.summary || ""}`,
        ...t.points.map((p) => `- ${p}`));
      if (t.formula && t.formula.length) lines.push(`Formulas: ${t.formula.join("; ")}`);
      if (t.method && t.method.length) lines.push(`Method: ${t.method.join(" ")}`);
    }
    return lines.join("\n");
  }

  // Streams an answer; onText gets the whole text so far.
  async function aiAsk(history, system, onText, signal) {
    const key = aiKey();
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature: 0.4 }
    });
    const send = (model) => fetch(`${AI_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body, signal });
    let r = await send(aiModel());
    if (r.status === 404) {   // the saved model was retired: switch to a current one once
      const model = aiPickModel(await aiListModels(key));
      store.set("aiModel", model);
      r = await send(model);
    }
    if (!r.ok) throw await aiError(r);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "", finish = "", blocked = "";
    const take = (line) => {
      line = line.trim();
      if (!line.startsWith("data:")) return;
      let d;
      try { d = JSON.parse(line.slice(5)); } catch (e) { return; }
      if (d.promptFeedback && d.promptFeedback.blockReason) blocked = d.promptFeedback.blockReason;
      const cand = (d.candidates || [])[0];
      if (!cand) return;
      if (cand.finishReason) finish = cand.finishReason;
      const piece = ((cand.content && cand.content.parts) || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
      if (piece) { text += piece; onText(text); }
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) { take(buf.slice(0, i)); buf = buf.slice(i + 1); }
    }
    take(buf);
    return { text, finish, blocked };
  }

  // A small Markdown renderer for answers. Everything is escaped first, so the model's
  // text can never inject HTML; only the tags made here appear.
  function md(src) {
    const inline = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");
    const lines = String(src).replace(/\r/g, "").split("\n");
    const out = [];
    let para = [];
    const flush = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
    const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*```/.test(l)) {
        flush();
        const code = [];
        while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i]);
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      } else if (/^\s*#{1,6}\s/.test(l)) {
        flush();
        const n = /^\s*(#+)/.exec(l)[1].length;
        out.push(`<${n <= 3 ? "h3" : "h4"}>${inline(l.replace(/^\s*#+\s*/, "").replace(/\s*#+\s*$/, ""))}</${n <= 3 ? "h3" : "h4"}>`);
      } else if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flush();
        const head = cells(l);
        const rows = [];
        i++;
        while (i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) rows.push(cells(lines[++i]));
        out.push(`<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      } else if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
        flush();
        const ordered = /^\s*\d/.test(l);
        const items = [];
        i--;
        while (i + 1 < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i + 1]) && /^\s*\d/.test(lines[i + 1]) === ordered)
          items.push(lines[++i].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
        out.push(`<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push("<hr>"); }
      else if (!l.trim()) flush();
      else para.push(l);
    }
    flush();
    return out.join("");
  }

  // Plain text of a past question, to hand to the assistant.
  // Only the part asked (and any lines shared by all parts) when a part is given.
  function questionText(q, ref) {
    const plain = (s) => String(s).replace(/\^\{([^}]*)\}/g, "^$1").replace(/_\{([^}]*)\}/g, "_$1");
    const keep = (b) => !b.s || !ref || !ref.subs.length || ref.subs.includes(b.s);
    const body = (q.b || []).filter(keep).map((b) => b.or ? "Or" : b.t ? b.t.map(plain).join("\n") : `${plain(b.p)}${b.m ? ` [${b.m}]` : ""}`);
    const opts = (q.o || []).map((o, i) => `${String.fromCharCode(97 + i)}) ${plain(o)}`);
    return [...body, ...opts].join("\n");
  }

  const AI_SPARK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9z"/><path d="M19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9z"/></svg>`;

  async function viewAsk(code, topicId) {
    const { courses } = await load("data/courses.json");
    const ready = courses.filter((c) => c.ready);
    const ctx = {};
    if (code) {
      const g = await getCourse(code);
      if (g.c && g.analysis) { ctx.c = g.c; ctx.topics = g.analysis.topics; ctx.t = topicId ? g.analysis.topics.find((t) => t.id === topicId) : null; }
    }
    const key = `${ctx.c ? ctx.c.code : "-"}/${ctx.t ? ctx.t.id : "-"}`;
    const chat = aiChats[key] || (aiChats[key] = []);
    const back = ctx.t ? `<a class="back" href="#/c/${ctx.c.code}/t/${ctx.t.id}">← ${esc(ctx.t.name)}</a>`
      : ctx.c ? `<a class="back" href="#/c/${ctx.c.code}">← ${esc(ctx.c.title)}</a>` : "";

    if (!aiKey()) {
      app.innerHTML = `${back}
        <h1>Ask AI</h1>
        <p class="muted">Ask any study question — explain a topic, write a model answer, or solve a past-paper problem step by step.</p>
        <section class="card ai-setup">
          <p><strong>One-time setup:</strong> the assistant runs on Google Gemini with your own free API key. Getting one takes about two minutes.</p>
          <div class="ai-setup-btns">
            <a class="btn" href="#/ai-guide">How to get a free key</a>
            <a class="btn secondary" href="#/settings/ai">I have a key — add it</a>
          </div>
        </section>`;
      return;
    }

    const suggestions = ctx.t ? [
      `Explain "${ctx.t.name}" in simple words`,
      ctx.t.kind && ctx.t.kind !== "theory" ? `Give me a numerical problem on ${ctx.t.name} and solve it step by step` : `Write a 10-mark exam answer on ${ctx.t.name}`,
      `Quiz me with 5 short questions on ${ctx.t.name}, then show the answers`,
      `What mistakes do students make on ${ctx.t.name}?`
    ] : ctx.c ? [
      `Which topics of ${ctx.c.title} are most important, and why?`,
      `Explain the basic ideas of ${ctx.c.title} simply`,
      `Quiz me with 5 questions from ${ctx.c.title}`
    ] : [
      "Explain the difference between capital and revenue expenditure",
      "How should I write a 10-mark theory answer?",
      "Solve: find the break-even point if fixed cost is ₹60,000, price ₹50 and variable cost ₹30"
    ];

    app.innerHTML = `${back}
      <h1>Ask AI</h1>
      <div class="ai-ctx">
        <label>Course<select id="aiCourse"><option value="">Any subject</option>${ready.map((c) =>
          `<option value="${c.code}"${ctx.c && ctx.c.code === c.code ? " selected" : ""}>${esc(c.code)} · ${esc(c.title)}</option>`).join("")}</select></label>
        ${ctx.c ? `<label>Topic<select id="aiTopic"><option value="">Whole course</option>${ctx.topics.map((t) =>
          `<option value="${t.id}"${ctx.t && ctx.t.id === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>` : ""}
      </div>
      <div id="aiLog" class="ai-log" aria-live="polite"></div>
      <div id="aiSugg" class="ai-sugg">${suggestions.map((s) => `<button type="button" class="ai-chip">${esc(s)}</button>`).join("")}</div>
      <form id="aiForm" class="ai-form">
        <label for="aiIn" class="sr-only">Your question</label>
        <textarea id="aiIn" rows="3" placeholder="Ask a question, or paste one from a past paper…"></textarea>
        <div class="ai-actions">
          <button type="button" class="btn secondary" id="aiNew">New chat</button>
          <button type="submit" class="btn" id="aiSend">Send</button>
        </div>
      </form>
      <p class="small muted">AI answers can be wrong — check them against your study material. Your questions go from this device to Google using your key. <a href="#/settings/ai">AI settings</a></p>`;

    const log = app.querySelector("#aiLog"), input = app.querySelector("#aiIn"), sendBtn = app.querySelector("#aiSend");
    const sugg = app.querySelector("#aiSugg");
    const bubble = (m) => m.role === "user"
      ? `<div class="ai-msg user">${esc(m.text).replace(/\n/g, "<br>")}</div>`
      : `<div class="ai-msg bot${m.error ? " err" : ""}"><div class="ai-md">${m.error ? esc(m.text) : md(m.text)}</div>${m.text && !m.error ? `<button type="button" class="ai-copy">Copy</button>` : ""}</div>`;
    const render = () => {
      log.innerHTML = chat.map(bubble).join("");
      sugg.hidden = chat.length > 0;
      log.querySelectorAll(".ai-copy").forEach((b, i) => b.addEventListener("click", () => {
        const bots = chat.filter((m) => m.role === "model" && !m.error && m.text);
        if (navigator.clipboard) navigator.clipboard.writeText(bots[i].text).then(() => { b.textContent = "Copied"; }, () => {});
      }));
    };
    render();

    const go = (c, t) => location.replace(`#/ask${c ? `/${c}${t ? `/${t}` : ""}` : ""}`);
    app.querySelector("#aiCourse").addEventListener("change", (e) => go(e.target.value, ""));
    const topicSel = app.querySelector("#aiTopic");
    if (topicSel) topicSel.addEventListener("change", (e) => go(ctx.c.code, e.target.value));
    app.querySelector("#aiNew").addEventListener("click", () => { if (aiBusy) aiBusy.abort(); chat.length = 0; render(); input.focus(); });
    sugg.querySelectorAll(".ai-chip").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
    app.querySelector("#aiForm").addEventListener("submit", (e) => {
      e.preventDefault();
      if (aiBusy) { aiBusy.abort(); return; }
      ask(input.value);
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); app.querySelector("#aiForm").requestSubmit(); } });
    // A question handed over from a past paper: show it ready to send, not buried under suggestions.
    if (aiDraft && aiDraft.key === key) {
      input.value = aiDraft.text;
      aiDraft = null;
      sugg.hidden = true;
      input.rows = Math.min(10, Math.max(4, Math.ceil(input.value.length / 38) + input.value.split("\n").length));
      const form = app.querySelector("#aiForm");
      form.dataset.anchor = "";   // the router scrolls this into view
      form.insertAdjacentHTML("afterbegin", `<p class="ai-ready small" role="status">Question added from the past paper — check it and tap <strong>Send</strong>.</p>`);
    }

    async function ask(q) {
      q = String(q || "").trim();
      if (!q || aiBusy) return;
      input.value = "";
      chat.push({ role: "user", text: q });
      const ans = { role: "model", text: "" };
      chat.push(ans);
      render();
      const last = log.lastElementChild.querySelector(".ai-md");
      last.innerHTML = `<p class="muted ai-wait">Thinking…</p>`;
      log.lastElementChild.scrollIntoView({ block: "nearest" });
      aiBusy = new AbortController();
      sendBtn.textContent = "Stop";
      let pending = false;
      try {
        const res = await aiAsk(chat.slice(0, -1).filter((m) => !m.error), aiSystem(ctx), (text) => {
          ans.text = text;
          if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; if (last.isConnected) last.innerHTML = md(ans.text); }); }
        }, aiBusy.signal);
        if (!res.text) {
          ans.error = true;
          ans.text = res.blocked || res.finish === "SAFETY" ? "The AI declined to answer this. Try rephrasing your question."
            : "No answer came back. Please try again.";
        } else if (res.finish === "MAX_TOKENS") ans.text += "\n\n*(The answer was cut short — ask “continue” for the rest.)*";
      } catch (err) {
        if (err.name === "AbortError") { if (!ans.text) { ans.error = true; ans.text = "Stopped."; } }
        else { ans.error = true; ans.text = err.friendly || "Couldn't reach Google's AI service. Check your internet connection and try again."; }
      } finally {
        aiBusy = null;
        if (sendBtn.isConnected) { sendBtn.textContent = "Send"; render(); }
      }
    }
  }

  function viewAiGuide() {
    app.innerHTML = `
      <a class="back" href="#/settings/ai">← AI settings</a>
      <h1>Get a free Gemini API key</h1>
      <p class="muted">BCom Buddy's AI assistant runs on Google Gemini. You use your own key, so there is no sign-up with us and no charge from us. It takes about two minutes.</p>

      <h2>Steps</h2>
      <ol class="guide-steps">
        <li><strong>Open Google AI Studio.</strong> Tap the button below; it opens Google's own site in a new tab.
          <a class="btn secondary guide-link" href="${AI_KEY_PAGE}" target="_blank" rel="noopener noreferrer">Open Google AI Studio ↗</a></li>
        <li><strong>Sign in with your Google (Gmail) account.</strong> If asked, accept Google's terms. Google's terms say you must be 18 or older.</li>
        <li><strong>Tap “Create API key”.</strong> If it asks for a project, choose the one it suggests or let it create a new one.</li>
        <li><strong>Copy the key.</strong> It is a long code that usually starts with <code>AIza</code>. Use the copy button next to it.</li>
        <li><strong>Paste it in BCom Buddy.</strong> Go to <a href="#/settings/ai">Settings → AI assistant</a>, paste the key and tap <em>Save and test</em>. A green tick means it works.</li>
        <li><strong>Start asking.</strong> Tap <span class="kbd">${AI_SPARK}</span> at the top, or <em>Ask AI about this topic</em> on any topic page.</li>
      </ol>

      <h2>Good to know</h2>
      <ul class="points">
        <li><strong>Free tier:</strong> you don't need to add a card. The free tier has limits on requests per minute and per day; if you hit one, wait and try again.</li>
        <li><strong>Privacy:</strong> on the free tier Google may use what you send to improve its products, and people may review it. Don't type personal details such as phone numbers, Aadhaar or passwords.</li>
        <li><strong>Keep your key secret:</strong> it works like a password. BCom Buddy saves it only in this browser on this device and sends it only to Google.</li>
        <li><strong>Lost or shared phone?</strong> Delete the key in Google AI Studio (API keys page) and create a new one. On a shared device, remove the key from Settings when you're done.</li>
        <li><strong>Check the answers:</strong> AI can make mistakes, especially with laws, tax rates and figures. Your study material is the final word.</li>
      </ul>

      <h2>If it doesn't work</h2>
      <ul class="points">
        <li><em>“Key not accepted”</em> — copy the whole key again with no spaces, and paste it once more.</li>
        <li><em>“Limit reached”</em> — the free quota is used up for now; try again later.</li>
        <li><em>“Couldn't reach Google”</em> — check your internet connection. The assistant needs internet even though the notes work offline.</li>
      </ul>`;
  }

  /* ---------- welcome screen (first open; again from Settings) ---------- */
  function showWelcome() {
    const el = document.createElement("div");
    el.className = "splash";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Welcome to BCom Buddy");
    el.tabIndex = 0;
    el.innerHTML = `<div class="splash-in">
      <svg class="sp-logo" viewBox="0 0 512 512" aria-hidden="true">
        <rect class="sp-tile" width="512" height="512" rx="112"/>
        <g transform="translate(0 -30)">
          <path class="sp-page sp-l" d="M250 170c-34-22-84-30-138-24v176c54-6 104 2 138 24z"/>
          <path class="sp-page sp-r" d="M262 170c34-22 84-30 138-24v176c-54-6-104 2-138 24z"/>
          <path class="sp-smile" d="M176 392q80 52 160 0"/>
        </g></svg>
      <h1 class="sp-name">BCom Buddy</h1>
      <p class="sp-tag">Know what to study first — for IGNOU BCOMF exams</p>
      <ul class="sp-list">
        <li>Topics ranked by how often they are asked</li>
        <li>Short notes checked against your study material</li>
        <li>Diagrams, formulas and answer outlines</li>
        <li>Past papers and a study plan, one tap away</li>
      </ul>
      <p class="sp-tap">Tap anywhere to continue</p>
    </div>`;
    document.body.appendChild(el);
    document.body.classList.add("no-scroll");
    el.focus();
    const close = () => {
      store.set("welcomed", true);
      el.classList.add("out");
      document.body.classList.remove("no-scroll");
      setTimeout(() => el.remove(), 320);
    };
    el.addEventListener("click", close);
    el.addEventListener("keydown", (e) => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); close(); } });
  }

  function viewNotFound() {
    app.innerHTML = `<h1>Page not found</h1><p><a href="#/">Go to all courses</a></p>`;
  }

  /* ---------- router ---------- */
  let prevHash = null;   // the page before this one, for the question view's Back link
  let thisHash = null;
  async function route() {
    prevHash = thisHash;
    thisHash = location.hash.replace(/^#/, "") || "/";
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    try {
      if (!parts.length) await viewHome();
      else if (parts[0] === "settings") await viewSettings(parts[1]);
      else if (parts[0] === "ask") await viewAsk(parts[1], parts[2]);
      else if (parts[0] === "ai-guide") viewAiGuide();
      else if (parts[0] === "c" && parts[1]) {
        const code = parts[1];
        if (parts[2] === "t" && parts[3] && parts[4] === "asked") await viewAsked(code, parts[3]);
        else if (parts[2] === "t" && parts[3]) await viewTopic(code, parts[3]);
        else if (parts[2] === "paper" && parts[3]) await viewQuestion(code, parts[3], parts[4]);
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
    const anchor = app.querySelector("[data-anchor]");
    if (anchor) anchor.scrollIntoView();
    app.focus({ preventScroll: true });
  }

  /* ---------- theme ---------- */
  const themeBtn = document.getElementById("themeToggle");
  function setTheme(t) {   // "light", "dark" or null to follow the device
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    store.set("theme", t);
  }
  const savedTheme = store.get("theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  themeBtn.addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "light" : "dark");
    if (location.hash.replace(/^#\/?/, "") === "settings") viewSettings();
  });

  window.addEventListener("hashchange", route);
  route();
  if (!store.get("welcomed", false)) showWelcome();

  // Makes the app installable as a home-screen app and keeps opened pages readable offline.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
