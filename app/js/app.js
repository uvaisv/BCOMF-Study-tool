/* BCOMF Exam Prep — single-page app, no build step.
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

  /* ---------- views ---------- */
  async function viewHome() {
    const { courses } = await load("data/courses.json");
    let year = store.get("year", 1);
    let query = "";

    app.innerHTML = `
      <section class="hero">
        <h1>Know what to study first</h1>
        <p>For IGNOU BCOMF exams. Pick your course and start — no sign-up, no setup.</p>
        <ul class="offers">
          <li><strong>Topics ranked</strong> by how often IGNOU asks them</li>
          <li><strong>Short notes</strong> formulas and answer outlines</li>
          <li><strong>Past papers</strong> in one tap</li>
          <li><strong>A study plan</strong> for the hours you have left</li>
        </ul>
      </section>
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

    app.innerHTML = `
      <a class="back" href="#/c/${code}">← ${esc(c.title)}</a>
      <h1>${esc(t.name)}</h1>
      <p class="head-meta">${badge(t.level)} <span class="muted small">${evidence(t, n, mcq)}</span></p>
      <p class="lead">${esc(t.summary)}</p>
      ${t.units && t.units.length ? `<p class="book-ref"><span class="book-ref-h">In your IGNOU book</span>${t.units.map((u) =>
        `<span>${u.block ? `Block ${u.block} · ` : ""}Unit ${u.unit} ${esc(u.title)}${u.part ? ` <span class="muted">(${esc(u.part)})</span>` : ""}</span>`).join("")}</p>` : ""}

      <h2>Key points</h2>
      <section class="card"><ul class="points">${t.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></section>

      ${t.method ? `<h2>How to solve</h2>
      <section class="card"><ol class="steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>` : ""}

      ${t.formula && t.formula.length ? `<h2>Formulas</h2>
      <section class="card">${t.formula.map((f) => `<div class="formula">${esc(f)}</div>`).join("")}</section>` : ""}

      ${t.frame ? `<h2>How to write the answer</h2>
      <section class="card"><p class="flush">${esc(t.frame)}</p></section>` : ""}

      ${t.mistakes && t.mistakes.length ? `<h2>Common mistakes</h2>
      <div class="callout warn"><ul class="points">${t.mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : ""}

      ${asked.length ? `<a class="btn secondary see-all" href="#/c/${code}/t/${id}/asked">Asked in past papers (${asked.length}) <span aria-hidden="true">→</span></a>` : ""}

      <div class="topic-foot">
        <button type="button" class="btn secondary" id="done" aria-pressed="${isDone(code, id)}">${isDone(code, id) ? "✓ Done" : "Mark as done"}</button>
        ${next ? `<a class="btn" href="#/c/${code}/t/${next.id}">Next: ${esc(next.name)} →</a>` : `<a class="btn" href="#/c/${code}">Back to course</a>`}
      </div>`;

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
      ${pdf ? `<a class="btn secondary qv-pdf" ${paperHref(code, pdf)} target="_blank" rel="noopener">Download full paper (PDF)</a>` : ""}
      ${q && !exact ? `<p class="small muted">Text from the official paper; tables and formulas may look slightly different in print.</p>` : ""}`;
    // Wide tables (trial balances) shrink to fit the screen rather than hide columns.
    app.querySelectorAll(".ptable").forEach((t) => {
      const fit = t.clientWidth / t.scrollWidth;
      if (fit < 1) t.style.fontSize = `${Math.max(0.6, 0.8 * fit * 0.97).toFixed(3)}rem`;
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
