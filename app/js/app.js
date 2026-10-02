/* BCom Radar — single-page app, no build step.
 * Product rule (see CLAUDE.md): help students study, never add setup or extra work.
 * Every screen leads with something to study; tracking is one optional tap.
 * Topic priorities are computed from the past-paper questions in data/<CODE>.json,
 * so adding a new session's questions updates every ranking automatically. */
(function () {
  "use strict";

  const app = document.getElementById("app");
  const cache = {};
  const YEAR_COLORS = { 1: "var(--y1)", 2: "var(--y2)", 3: "var(--y3)" };
  const { SPARE, analyse, readiness, bestNext } = window.ANALYSIS;   // js/analysis.js
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
  const APP_VERSION = "3.2";
  const APP_RELEASED = "October 2026";
  // Study styles change what a topic page shows; "standard" (Full) is the notes as written and the default.
  // The style is switched on the topic page itself, and also in Settings.
  const STYLES = [
    ["standard", "Full", "The full notes, as written"],
    ["short", "Short", "Quick revision: top points, formulas and steps"],
    ["example", "Examples", "The full notes plus worked examples"],
    ["visual", "Visual", "Diagrams and formulas first, points as numbered cards"]
  ];
  // "Meet the creators" in Settings; the section is hidden while this list is empty.
  // Each entry: { name, role, url } — url is the person's portfolio, opened in a new tab.
  const CREATORS = [
    { name: "Abdul Shukkoor", role: "Finance, Accounting & AI", url: "https://abdul-shukkoor.vercel.app/" },
    { name: "Muhammed Uvais V.", role: "Finance, AI & Automation", url: "https://uvaisv-portfolio.vercel.app/" }
  ];
  // "Send feedback" in Settings opens the student's mail app; hidden while this is empty.
  const FEEDBACK_EMAIL = "feedback.bcomradar@gmail.com";
  const studyStyle = () => { const v = store.get("style", "standard"); return STYLES.some(([k]) => k === v) ? v : "standard"; };   // an old "detailed" choice reads as Full
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
  const sessionLabel = (s) => esc(`${MONTHS[s.slice(5)] || s.slice(5)} ${s.slice(0, 4)}`);   // escaped: a link can carry any text here
  const clock = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const duration = (h) => { const m = Math.round(h * 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`; };
  const marks = (m) => Math.round(m * 10) / 10;

  async function load(path) {
    if (!cache[path]) {
      cache[path] = fetch(path).then((r) => { if (!r.ok) throw new Error(path); return r.json(); });
    }
    return cache[path];
  }

  /* ---------- small components ---------- */
  const badge = (level) => `<span class="badge ${level.id}">${level.label}</span>`;
  const levelOf = (label) => ({ id: String(label).toLowerCase(), label });
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TICK = `<svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
  const ARROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>`;
  const SEARCH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`;

  // How often a topic was asked, one small bar per past paper (filled = asked that term).
  const freqBars = (t) => `<span class="freq" aria-hidden="true">${t.bySession.map((m) => `<i${m > 0 ? ' class="on"' : ""}></i>`).join("")}</span>`;
  const evidence = (t, n, mcq) => `Asked in ${t.seen} of ${n} papers · avg ${Math.round(t.avg)} ${mcq ? "questions" : "marks"}`;

  // A topic in a list: a round check (one optional tap marks it done) and the topic itself.
  function topicRow(code, t, n, mcq) {
    const done = isDone(code, t.id);
    return `<div class="trow${done ? " done" : ""}">
      <button type="button" class="tcheck" data-done="${code}/${t.id}" aria-pressed="${done}" aria-label="Done: ${esc(t.name)}">${TICK}</button>
      <a class="row-link" href="#/c/${code}/t/${t.id}">
        <span class="row-main"><span class="row-title">${esc(t.name)}</span>
          <span class="row-sub">${freqBars(t)}<span>${t.seen}/${n} papers · avg ${Math.round(t.avg)} ${mcq ? "questions" : "marks"}</span></span></span>
        <span class="row-end">${badge(t.level)}<span class="chev" aria-hidden="true">›</span></span>
      </a>
    </div>`;
  }

  // A segmented control: buttons or links in a tray, with a highlight that slides to the
  // selected item (see placeSlides). `from` is the index it slides from.
  function placeSlides(root = document, animate = true) {
    root.querySelectorAll("[data-slide-from]").forEach((box) => {
      const ind = box.querySelector(".slide-ind");
      if (!ind) return;
      const items = [...box.children].filter((x) => x !== ind);
      const cur = items.find((x) => ["aria-current", "aria-selected", "aria-checked", "aria-pressed"].some((a) => {
        const v = x.getAttribute(a); return v === "true" || v === "page";
      }));
      if (!cur) { ind.style.opacity = "0"; return; }
      const put = (el) => { ind.style.width = `${el.offsetWidth}px`; ind.style.transform = `translateX(${el.offsetLeft}px)`; };
      const from = items[+box.dataset.slideFrom];
      if (animate && from && from !== cur && !reduceMotion()) {
        ind.style.transition = "none"; put(from); void ind.offsetWidth; ind.style.transition = "";
      }
      put(cur);
      ind.style.opacity = "1";
      box.dataset.slideFrom = String(items.indexOf(cur));
    });
  }
  window.addEventListener("resize", () => placeSlides(document, false));

  let lastTab = null;   // { code, i }: the course tab shown last, so the highlight slides from it
  function courseTabs(code, active) {
    const tabs = [["", "Study"], ["/papers", "Past papers"], ["/plan", "Plan"], ["/exam", "Exam tips"]];
    const i = tabs.findIndex(([p]) => p === active);
    const from = lastTab && lastTab.code === code ? lastTab.i : i;
    lastTab = { code, i };
    return `<nav class="ctabs" aria-label="Course sections"><div class="segctl" data-slide-from="${from}">${tabs.map(([p, l]) =>
      `<a href="#/c/${code}${p}" ${active === p ? 'aria-current="page"' : ""} data-replace>${l}</a>`).join("")}<span class="slide-ind" aria-hidden="true"></span></div></nav>`;
  }

  function examLine(c, course) {
    if (course) {
      const p = course.pattern;
      return p.mcq ? `${p.time} · ${p.marks} marks · ${p.questions} MCQs, all compulsory`
        : p.parts || p.pick ? `${p.time} · ${p.marks} marks · ${pickText(p)}` : `${p.time} · ${p.marks} marks · any ${p.attempt} of ${p.questions} questions`;
    }
    return c.exam ? `${c.exam.time} · ${c.exam.marks} marks · ${c.exam.format}` : "";
  }

  // Course title with its facts as small chips; the header's back arrow returns to All courses.
  function courseHeader(c, course) {
    setBack("#/", "All courses");
    const line = examLine(c, course);
    return `<h1>${esc(c.title)}</h1>
      <p class="chips">${[c.code, `Year ${c.year}`, ...(line ? line.split(" · ") : [])].map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</p>`;
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
    return `<h2 id="sec-figures">${figs.length > 1 ? "Diagrams" : "Diagram"}</h2>${figs.map((f) => `
      <figure class="card fig"><figcaption class="fig-title">${esc(f.title)}</figcaption>${f.draw()}${captions ? `<p class="fig-note">${esc(f.caption)}</p>` : ""}</figure>`).join("")}`;
  }

  // Worked examples (the Examples style). A blank line separates paragraphs.
  function examplesHtml(t) {
    if (!t.examples || !t.examples.length) return `<h2 id="sec-examples">Examples</h2><p class="muted small">Examples for this topic are being added.</p>`;
    return `<h2 id="sec-examples">${t.examples.length > 1 ? "Examples" : "Example"}</h2>${t.examples.map((e) => `
      <section class="card example">${e.split(/\n+/).map((l, i) => i ? `<p>${esc(l)}</p>` : `<h3>${esc(l)}</h3>`).join("")}</section>`).join("")}`;
  }

  // A short message at the bottom of the screen, optionally with Undo. It never blocks anything.
  let toastTimer = null;
  function toast(html, undo) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<span>${html}</span>${undo ? `<button type="button">Undo</button>` : ""}`;
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
    if (undo) el.querySelector("button").addEventListener("click", () => { hideToast(); undo(); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 3200);
  }
  function hideToast() { const el = document.getElementById("toast"); if (el) el.classList.remove("show"); }

  /* ---------- views ---------- */
  // The one-line "Continue" strip on Home: the topic opened last, or once that is done, the next
  // must-study topic of the same course. Shown only after a topic has been opened.
  function continueStrip(summary) {
    const last = store.get("last", null);
    if (!last || !last.code || !summary[last.code]) return "";
    let t = !isDone(last.code, last.id) ? { id: last.id, name: last.name, level: last.level } : null;
    if (!t) { const nx = summary[last.code].mvp.find(([id]) => !isDone(last.code, id)); if (nx) t = { id: nx[0], name: nx[1], level: nx[2] }; }
    if (!t) return "";
    return `<a class="continue" href="#/c/${esc(last.code)}/t/${esc(t.id)}">
      <span class="cont-main"><span class="cont-k">Continue · ${esc(last.code)}</span><span class="cont-n">${esc(t.name)} ${badge(levelOf(t.level))}</span></span>
      <span class="cont-go" aria-hidden="true">${ARROW}</span></a>`;
  }

  async function viewHome() {
    const [{ courses }, summary] = await Promise.all([load("data/courses.json"), load("data/summary.json").catch(() => ({}))]);
    let year = store.get("year", 1);
    app.innerHTML = `
      ${continueStrip(summary)}
      ${installCardHome()}
      <a class="search-link" href="#/search">${SEARCH_ICON}<span>Search courses, topics or questions</span></a>
      <div class="segctl years" role="tablist" aria-label="Year" data-slide-from="${year - 1}">
        ${[1, 2, 3].map((y) => `<button type="button" role="tab" data-year="${y}" aria-selected="${y === year}">Year ${y}</button>`).join("")}<span class="slide-ind" aria-hidden="true"></span>
      </div>
      <div id="list" class="list"></div>`;
    bindInstallCard();

    const list = app.querySelector("#list");
    const render = () => {
      list.innerHTML = courses.filter((c) => c.year === year).map((c) => {
        const s = summary[c.code];
        const d = s ? s.mvp.filter(([id]) => isDone(c.code, id)).length : 0;
        const sub = !c.ready ? (c.papers ? `${c.papers} past papers` : "No past papers yet")
          : s && d ? `<span class="mini" aria-hidden="true"><i style="width:${Math.round((d / s.mvp.length) * 100)}%"></i></span>${d} of ${s.mvp.length} must-study done`
            : s ? `${s.topics} topics · ${s.mvp.length} to study first` : "Topics, notes and past papers";
        return `<a class="row course" href="#/c/${esc(c.code)}" style="--year-color:${YEAR_COLORS[c.year]}">
          <span class="course-code">${esc(c.code)}</span>
          <span class="row-main"><span class="row-title">${esc(c.title)}</span><span class="row-sub">${sub}</span></span>
          <span class="chev" aria-hidden="true">›</span>
        </a>`;
      }).join("");
    };
    app.querySelectorAll("[data-year]").forEach((b) => b.addEventListener("click", () => {
      year = +b.dataset.year; store.set("year", year);
      app.querySelectorAll("[data-year]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      placeSlides(app); render();
    }));
    render();
  }

  /* ---------- search: courses, topics and past questions (data/search.json, built by tools/build_pages.js) ---------- */
  let searchQ = "";
  async function viewSearch() {
    app.innerHTML = `<h1>Search</h1>
      <input id="sq" class="search" type="search" enterkeyhint="search" placeholder="e.g. depreciation, ratio, 131" autocomplete="off" spellcheck="false" aria-label="Search courses, topics and past questions" value="${esc(searchQ)}">
      <div id="sres" class="sres" aria-live="polite"></div>`;
    const input = app.querySelector("#sq"), out = app.querySelector("#sres");
    if (!searchQ) input.focus({ preventScroll: true });
    out.innerHTML = `<p class="muted small">Loading…</p>`;
    let idx;
    try { idx = await load("data/search.json"); } catch (e) { out.innerHTML = `<p class="muted">Search needs an internet connection the first time.</p>`; return; }
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9₹%]+/g, " ").trim();
    const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let limit = 10;
    const run = () => {
      searchQ = input.value;
      const q = norm(input.value);
      if (q.length < 2) {
        out.innerHTML = `<p class="muted small">Find a course, a topic, or a past exam question.</p>
          <div class="chips">${["depreciation", "ratio analysis", "joint venture", "tally", "131"].map((x) => `<button type="button" class="chip chip-btn" data-try="${x}">${x}</button>`).join("")}</div>`;
        return;
      }
      const words = q.split(" ");
      const hit = (text) => { const n = norm(text), m = n.replace(/ /g, ""); return words.every((w) => n.includes(w) || m.includes(w)); };
      const hlRe = words.some((w) => w.length > 1) ? new RegExp(`(${words.filter((w) => w.length > 1).map(reEsc).join("|")})`, "ig") : null;
      const hl = (text) => (hlRe ? String(text).split(hlRe).map((x, i) => (i % 2 ? `<mark>${esc(x)}</mark>` : esc(x))).join("") : esc(text));
      const courseName = Object.fromEntries(idx.courses.map((c) => [c[0], c[1]]));
      const cs = idx.courses.filter((c) => hit(`${c[0]} ${c[1]}`)).slice(0, 5);
      const rank = { Critical: 0, High: 1, Moderate: 2, Low: 3 };
      const tp = idx.topics.filter((t) => hit(t[2])).sort((a, b) => rank[a[3]] - rank[b[3]]).slice(0, 8);
      const qs = idx.questions.filter((x) => hit(x[3]));
      out.innerHTML = (!cs.length && !tp.length && !qs.length) ? `<p class="muted">Nothing found for “${esc(input.value.trim())}”. Try a shorter word.</p>` : `
        ${tp.length ? `<h2>Topics</h2><div class="rows card">${tp.map((t) => `<a class="row" href="#/c/${t[0]}/t/${t[1]}"><span class="row-main"><span class="row-title">${hl(t[2])}</span><span class="row-sub">${esc(t[0])} · ${esc(courseName[t[0]] || "")}</span></span><span class="row-end">${badge(levelOf(t[3]))}</span></a>`).join("")}</div>` : ""}
        ${qs.length ? `<h2>Past questions <span class="muted small">(${qs.length})</span></h2><div class="rows card">${qs.slice(0, limit).map((x) => `<a class="row" href="#/c/${x[0]}/paper/${x[1]}/${encodeURIComponent(x[2])}"><span class="row-main"><span class="row-title q-title">${hl(x[3])}</span><span class="row-sub">${esc(x[0])} · ${sessionLabel(x[1])} · ${x[4]} marks</span></span><span class="chev" aria-hidden="true">›</span></a>`).join("")}</div>
          ${qs.length > limit ? `<button type="button" class="btn secondary wide" id="more">Show more questions</button>` : ""}` : ""}
        ${cs.length ? `<h2>Courses</h2><div class="rows card">${cs.map((c) => `<a class="row" href="#/c/${c[0]}"><span class="row-main"><span class="row-title">${hl(c[1])}</span><span class="row-sub">${hl(c[0])} · Year ${c[2]}</span></span><span class="chev" aria-hidden="true">›</span></a>`).join("")}</div>` : ""}`;
      const more = out.querySelector("#more");
      if (more) more.addEventListener("click", () => { limit += 20; run(); });
    };
    let timer = null;
    input.addEventListener("input", () => { limit = 10; clearTimeout(timer); timer = setTimeout(run, 90); });
    out.addEventListener("click", (e) => { const b = e.target.closest("[data-try]"); if (b) { input.value = b.dataset.try; run(); } });
    run();
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
    const choices = course ? await courseChoices(code) : null;
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
    const mvp = analysis.mvp.map(byId);
    const doneN = mvp.filter((t) => isDone(code, t.id)).length;
    const next = mvp.find((t) => !isDone(code, t.id));
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
        ${doneN ? `<div class="prog"><span class="bar" aria-hidden="true"><i style="width:${Math.round((doneN / mvp.length) * 100)}%"></i></span><span>${doneN} of ${mvp.length} done</span></div>` : ""}
        ${next ? `<a class="btn start-btn" href="#/c/${code}/t/${next.id}"><span>${doneN ? "Next" : "Start"}: ${esc(next.name)}</span>${ARROW}</a>`
          : `<p class="all-done">${TICK} All of these are done. Revise them, or carry on with the other topics.</p>`}
        ${groups.map((g) => `${split ? `<h3>${esc(g.name)}</h3>` : ""}<div class="rows">${g.ids.map((id) => topicRow(code, byId(id), n, mcq)).join("")}</div>`).join("")}
        <a class="text-link revise-link" href="#/c/${code}/revise">Quick revision of these topics →</a>
      </section>

      ${readyCard(code, course, analysis, choices)}

      ${repeated.length ? `<h2>Asked again and again</h2>
      <p class="muted small">These exact questions have come up in more than one paper. Read them with the topic notes.${repeated.some((r) => r.a) ? ` ${ANSWER_NOTE}` : ""}</p>
      <section class="card"><ul class="replist">${repeated.slice(0, 8).map(repeatItem).join("")}</ul>
        ${repeated.length > 8 ? `<details><summary>Show all ${repeated.length}</summary><ul class="replist">${repeated.slice(8).map(repeatItem).join("")}</ul></details>` : ""}
      </section>` : ""}

      <div class="section-head"><h2>Latest past papers</h2><a class="text-link" href="#/c/${code}/papers">All ${papers.length} →</a></div>
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
    setBack(`#/c/${code}/t/${id}`, t.name);
    const mcq = !!course.pattern.mcq;
    const asked = askedList(t);
    const papers = new Set(t.qs.map((q) => q.s)).size;
    app.innerHTML = `
      <h1>Asked in past papers</h1>
      <p class="muted small head-meta">${esc(t.name)} · ${asked.length} questions from ${papers} of ${course.sessions.length} papers · most important first · ${esc(c.code)}</p>
      <section class="card asked-card"><ul class="asked">${asked.map((q) => askedItem(code, q, mcq)).join("")}</ul></section>`;
  }

  // The order a student studies a course in: the "study first" list, then the rest.
  const studyOrder = (analysis) => [...analysis.mvp, ...analysis.topics.map((x) => x.id).filter((x) => !analysis.mvp.includes(x))];

  async function viewTopic(code, id) {
    const { c, course, analysis } = await getCourse(code);
    const t = analysis && analysis.topics.find((x) => x.id === id);
    if (!t) return viewNotFound();
    setBack(`#/c/${code}`, c.title);
    store.set("last", { code, id, name: t.name, level: t.level.label });
    const n = course.sessions.length;
    const mcq = !!course.pattern.mcq;
    const asked = askedList(t);
    const order = studyOrder(analysis);
    const next = analysis.topics.find((x) => x.id === order[order.indexOf(id) + 1]);

    const style = studyStyle();
    const short = style === "short", visual = style === "visual";
    const SHORT_N = 4;
    const pointList = (list) => `<ul class="points">${list.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
    const pointsHtml = visual
      ? `<h2 id="sec-points">Key points</h2><ol class="pt-cards">${t.points.map((p, i) => `<li><span class="pt-n" aria-hidden="true">${i + 1}</span><span>${esc(p)}</span></li>`).join("")}</ol>`
      : `<h2 id="sec-points">Key points</h2>
      <section class="card" id="pts">${pointList(short ? t.points.slice(0, SHORT_N) : t.points)}${short && t.points.length > SHORT_N ? `<button type="button" class="more" id="morePts">Show all ${t.points.length} points</button>` : ""}</section>`;
    const methodHtml = t.method ? (visual
      ? `<h2 id="sec-method">How to solve</h2><ol class="flow-steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>`
      : `<h2 id="sec-method">How to solve</h2>
      <section class="card"><ol class="steps">${t.method.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></section>`) : "";
    const formulaHtml = t.formula && t.formula.length ? `<h2 id="sec-formulas">Formulas</h2>
      <section class="card">${t.formula.map((f) => `<div class="formula">${esc(f)}</div>`).join("")}</section>` : "";
    const frameHtml = t.frame && !short ? `<h2 id="sec-frame">How to write the answer</h2>
      <section class="card"><p class="flush">${esc(t.frame)}</p></section>` : "";
    const mistakesHtml = t.mistakes && t.mistakes.length && !short ? `<h2 id="sec-mistakes">Common mistakes</h2>
      <div class="callout warn"><ul class="points">${t.mistakes.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>` : "";
    const body = visual
      ? [figuresHtml(t), formulaHtml, pointsHtml, methodHtml, frameHtml, mistakesHtml]
      : [pointsHtml, style === "example" ? examplesHtml(t) : "", figuresHtml(t, !short), methodHtml, formulaHtml, frameHtml, mistakesHtml];
    const html = body.join("\n");
    // Jump chips for the sections this page actually has, in page order.
    const CHIPS = [["sec-points", "Points"], ["sec-examples", "Examples"], ["sec-figures", "Diagram"], ["sec-method", "Method"], ["sec-formulas", "Formulas"], ["sec-frame", "Answer"], ["sec-mistakes", "Mistakes"]];
    const chips = CHIPS.filter(([sid]) => html.includes(`id="${sid}"`)).sort((a, b) => html.indexOf(`id="${a[0]}"`) - html.indexOf(`id="${b[0]}"`));
    const styleBtns = STYLES.map(([v, l]) => `<button type="button" data-style="${v}" aria-pressed="${v === style}">${l}</button>`).join("");
    const done = isDone(code, id);

    app.innerHTML = `
      <p class="kicker">${esc(c.code)} · ${esc(c.title)}</p>
      <h1>${esc(t.name)}</h1>
      <p class="head-meta">${badge(t.level)} <span class="muted small">${evidence(t, n, mcq)}</span></p>
      <div class="segctl styles" role="group" aria-label="Study style" data-slide-from="${STYLES.findIndex(([k]) => k === style)}">${styleBtns}<span class="slide-ind" aria-hidden="true"></span></div>
      <p class="lead">${esc(t.summary)}</p>
      ${t.units && t.units.length ? `<p class="book-ref"><span class="book-ref-h">In your IGNOU book</span>${t.units.map((u) =>
        `<span>${u.block ? `Block ${u.block} · ` : ""}Unit ${u.unit} ${esc(u.title)}${u.part ? ` <span class="muted">(${esc(u.part)})</span>` : ""}</span>`).join("")}</p>` : ""}
      ${asked.length ? `<section class="card asked-card asked-top"><h3 class="card-h">Asked as</h3>
        <ul class="asked">${asked.slice(0, 3).map((q) => askedItem(code, q, mcq)).join("")}</ul>
        ${asked.length > 3 ? `<a class="text-link" href="#/c/${code}/t/${id}/asked">See all ${asked.length} past questions →</a>` : ""}</section>` : ""}
      ${chips.length > 1 ? `<nav class="secnav" aria-label="On this page">${chips.map(([sid, l]) => `<button type="button" data-jump="${sid}">${l}</button>`).join("")}<a class="secnav-rev" href="#/c/${code}/t/${id}/revise">Revise</a></nav>` : ""}

${html}

      <div class="actbar">
        <a class="btn secondary act-ai" href="#/ask/${code}/${id}" aria-label="Ask AI about this topic">${AI_SPARK}</a>
        <button type="button" class="btn secondary act-done" id="done" aria-pressed="${done}">${done ? `${TICK} Done` : "Mark as done"}</button>
        ${next ? `<a class="btn act-next" href="#/c/${code}/t/${next.id}" title="Next: ${esc(next.name)}">Next<span class="sr-only">: ${esc(next.name)}</span> ${ARROW}</a>`
          : `<a class="btn act-next" href="#/c/${code}">Course ${ARROW}</a>`}
      </div>`;

    const more = app.querySelector("#morePts");
    if (more) more.addEventListener("click", () => { const box = app.querySelector("#pts"); box.innerHTML = pointList(t.points); box.classList.add("grow"); });
    app.querySelectorAll("[data-style]").forEach((b) => b.addEventListener("click", () => {
      if (b.getAttribute("aria-pressed") === "true") return;
      store.set("style", b.dataset.style);
      refresh();
    }));
    const doneBtn = app.querySelector("#done");
    const mvpIds = analysis.mvp;
    const setDoneUi = (v) => {
      doneBtn.setAttribute("aria-pressed", String(v));
      doneBtn.innerHTML = v ? `${TICK} Done` : "Mark as done";
      doneBtn.classList.toggle("pop", v);
    };
    doneBtn.addEventListener("click", () => {
      const v = !isDone(code, id);
      setDone(code, id, v);
      setDoneUi(v);
      if (v) {
        const inMvp = mvpIds.includes(id);
        const k = mvpIds.filter((x) => isDone(code, x)).length;
        toast(inMvp ? `${TICK} Done · ${k} of ${mvpIds.length} must-study topics` : `${TICK} Marked as done`, () => { setDone(code, id, false); setDoneUi(false); });
      } else hideToast();
    });
  }

  /* ---------- readiness: the topics marked done, replayed against every past paper ---------- */
  // Marks: roughly how much of each paper the student could have written, choosing their best
  // questions. Full answers: whether the done topics covered every question the paper asks for.
  // Both are about past papers, never a prediction (CLAUDE.md: priorities are guidance).
  const doneTopics = (code, analysis) => new Set(analysis.topics.filter((t) => isDone(code, t.id)).map((t) => t.id));
  const readyMode = (hasChoice) => (hasChoice && store.get("readyView", "marks") === "full" ? "full" : "marks");
  const asMarks = (pct, course) => Math.round((pct * course.pattern.marks) / 100);
  const rTone = (pct) => (pct >= 75 ? "ok" : pct >= 45 ? "mid" : "no");

  // Internal choices ("any four of the following") per course, from data/choices.json (built by tools/build_pages.js).
  const courseChoices = async (code) => ((await load("data/choices.json").catch(() => ({})))[code]) || null;

  function readyCard(code, course, analysis, choices) {
    const known = doneTopics(code, analysis);
    if (!known.size) return `<p class="muted small ready-hint">Tick topics as you finish them, and the app checks them against every past paper of this course.</p>`;
    const r = readiness(course, known, choices);
    const nx = bestNext(course, known, studyOrder(analysis), "marks", choices);
    const t = nx && analysis.topics.find((x) => x.id === nx.id);
    const n = course.sessions.length;
    return `<section class="card ready-card">
        <h2 class="ready-h">Your preparation vs past papers</h2>
        <p class="ready-big"><b class="${rTone(r.pct)}">${asMarks(r.pct, course)}</b><span>of ${course.pattern.marks} marks you could have written, on average</span></p>
        <p class="muted small">${r.hasChoice ? `Full answers in ${r.enough} of ${n} papers · ` : ""}from the ${known.size} topic${known.size > 1 ? "s" : ""} you marked done</p>
        ${t && nx.morePct >= 0.5 ? `<a class="ready-next" href="#/c/${code}/t/${t.id}"><span><span class="rn-k">Study next</span><span class="rn-n">${esc(t.name)}</span></span><span class="rn-g">+${asMarks(nx.morePct, course)} marks</span></a>` : ""}
        <a class="text-link" href="#/c/${code}/ready">See it paper by paper →</a>
      </section>`;
  }

  let readySel = null;   // { code, i }: the paper shown in detail, kept while the page re-renders
  let readyOpen = false; // the topic list stays open while ticking topics in it
  async function viewReady(code) {
    const { c, course, analysis } = await getCourse(code);
    if (!course) return viewNotFound();
    setBack(`#/c/${code}`, c.title);
    const choices = await courseChoices(code);
    const known = doneTopics(code, analysis);
    const r = readiness(course, known, choices);
    const mode = readyMode(r.hasChoice);
    const n = course.sessions.length;
    if (!readySel || readySel.code !== code) readySel = { code, i: n - 1 };   // the latest paper
    const sel = Math.min(readySel.i, n - 1);
    const nx = known.size < analysis.topics.length ? bestNext(course, known, studyOrder(analysis), mode, choices) : null;
    const nt = nx && analysis.topics.find((x) => x.id === nx.id);
    const topicName = (id) => { const t = analysis.topics.find((x) => x.id === id); return t ? t.name : id; };
    const p = r.papers[sel];
    const needText = (() => {
      const g = p.groups.filter((x) => !x.compulsory);
      return g.length === 1 && !g[0].name ? `${g[0].attempt} questions` : g.map((x) => `${x.attempt} from ${x.name}`).join(" + ");
    })();
    const lowI = r.papers.reduce((a, x, i) => (x.pct < r.papers[a].pct ? i : a), 0);

    const big = mode === "marks"
      ? `<p class="ready-big"><b class="${rTone(r.pct)}">${asMarks(r.pct, course)}</b><span>of ${course.pattern.marks} marks, on average</span></p>
         <p class="muted small">${known.size ? `What you could have written in each past paper with the ${known.size} topic${known.size > 1 ? "s" : ""} you marked done, choosing your best questions. Lowest: ${asMarks(r.papers[lowI].pct, course)} in ${sessionLabel(r.papers[lowI].s)}.` : "Mark topics as done (below, or on any topic page) to see what they would have earned you in each past paper."}</p>`
      : `<p class="ready-big"><b class="${r.enough === n ? "ok" : r.enough >= n * 0.6 ? "mid" : "no"}">${r.enough} of ${n}</b><span>past papers fully covered</span></p>
         <p class="muted small">Papers where the topics you marked done would have let you answer ${esc(needText)} in full.</p>`;
    const chips = r.papers.map((x, i) => {
      const tone = mode === "marks" ? rTone(x.pct) : x.enough ? "ok" : "no";
      const v = mode === "marks" ? asMarks(x.pct, course) : x.enough ? "✓" : `${x.got}/${x.need}`;
      return `<button type="button" class="pchip ${tone}" data-paper="${i}" aria-pressed="${i === sel}" aria-label="${sessionLabel(x.s)}: ${mode === "marks" ? `about ${v} marks` : x.enough ? "fully covered" : `${x.got} of ${x.need} questions`}"><span class="pc-s">${sessionLabel(x.s).replace(/ 20(\d\d)$/, " ’$1")}</span><span class="pc-v">${v}</span></button>`;
    }).join("");
    const allDone = mode === "marks" ? r.pct >= 99.5 : r.enough === n;
    const nextHtml = allDone ? `<p class="all-done">${TICK} ${mode === "marks" ? "Every past paper fully covered." : "Enough in every past paper."} Time to revise.</p>`
      : nt && (mode === "marks" ? nx.morePct >= 0.5 : nx.morePapers > 0 || nx.moreAnswerable > 0)
        ? `<a class="ready-next" href="#/c/${code}/t/${nt.id}"><span><span class="rn-k">Study next</span><span class="rn-n">${esc(nt.name)}</span></span><span class="rn-g">${mode === "marks" ? `+${asMarks(nx.morePct, course)} marks` : nx.morePapers > 0 ? `+${nx.morePapers} paper${nx.morePapers > 1 ? "s" : ""}` : `+${nx.moreAnswerable} questions`}</span></a>` : "";

    const qRow = (q) => {
      const tag = mode === "marks" ? `${Math.round(q.km * 10) / 10} / ${Math.round(q.tm * 10) / 10}${q.chosen ? " ★" : ""}` : q.ok ? "can answer" : q.some ? "partly" : "not yet";
      const items = q.versions.map((v, k) => `${k ? `<span class="rq-or">or</span>` : ""}${v.items.map(([id, m]) => `<span class="rq-t${known.has(id) ? " k" : ""}">${known.has(id) ? "✓ " : ""}${esc(topicName(id))} <span class="rq-m">· ${Math.round(((m * (v.choice ? v.choice[1] : 1)) / (v.choice ? v.choice[0] : 1)) * 10) / 10}</span></span>`).join("")}`).join("");
      return `<a class="rq" href="#/c/${code}/paper/${p.s}/${q.n}"><span class="rq-n">Q${q.n}</span><span class="rq-main">${q.choice ? `<span class="rq-or">any ${q.choice[0]} of ${q.choice[1]}</span>` : ""}${items}</span><span class="rtag ${q.ok ? "ok" : q.some ? "mid" : "no"}">${tag}</span></a>`;
    };
    const detail = `<h2 class="rd-h"><span>${sessionLabel(p.s)} paper</span><span class="rd-r">${mode === "marks" ? `about ${Math.round(p.marks)} of ${Math.round(p.outOf)} marks` : p.enough ? "Fully covered ✓" : `${p.short} more question${p.short > 1 ? "s" : ""} needed`}</span></h2>
      ${p.groups.map((g) => `<div class="rgrp"><div class="rgrp-h"><span>${g.name ? `${esc(g.name)} · ` : ""}${g.compulsory ? "compulsory" : `answer ${g.attempt} of ${g.of}`}</span><span>${mode === "marks" ? `${Math.round(g.marks)} of ${Math.round(g.outOf)}` : g.compulsory ? `${g.got} of ${g.qs.length} known` : `you could answer ${g.got}`}</span></div>
        ${g.qs.map(qRow).join("")}</div>`).join("")}
      ${mode === "marks" ? `<p class="muted small rd-foot">★ the questions you'd choose. A question counts in full when you've done all its topics, and in part when you've done some. In "any 4 of 6" questions, 4 known parts are the whole question.</p>` : ""}`;

    app.innerHTML = `
      <p class="kicker">${esc(c.code)} · ${esc(c.title)}</p>
      <h1>How ready am I?</h1>
      ${r.hasChoice ? `<div class="segctl rmode" role="group" aria-label="Show" data-slide-from="${mode === "marks" ? 0 : 1}"><button type="button" data-rmode="marks" aria-pressed="${mode === "marks"}">Marks</button><button type="button" data-rmode="full" aria-pressed="${mode === "full"}">Full answers</button><span class="slide-ind" aria-hidden="true"></span></div>` : ""}
      <section class="card ready-card">
        ${big}
        <div class="pchips" role="group" aria-label="Past papers">${chips}</div>
        ${known.size ? nextHtml : ""}
      </section>
      <section class="card rd" id="rdetail">${detail}</section>
      <details class="rtopics"${readyOpen ? " open" : ""}>
        <summary>Topics you've done: ${known.size} of ${analysis.topics.length} <span class="muted small">· change</span></summary>
        <div class="rows card">${studyOrder(analysis).map((id) => topicRow(code, analysis.topics.find((t) => t.id === id), n, !!course.pattern.mcq)).join("")}</div>
      </details>
      <p class="muted small">Based on the ${n} past papers in the app, not a prediction of the next one. A question counts as answerable when the topics you've done carry at least three quarters of its marks.</p>`;

    app.querySelector(".rtopics").addEventListener("toggle", (e) => { readyOpen = e.currentTarget.open; });
    app.querySelectorAll("[data-rmode]").forEach((b) => b.addEventListener("click", () => { store.set("readyView", b.dataset.rmode); refresh(); }));
    app.querySelectorAll("[data-paper]").forEach((b) => b.addEventListener("click", () => { readySel = { code, i: +b.dataset.paper }; refresh(); }));
  }

  /* ---------- revise mode: key points as cards, one at a time ---------- */
  // A topic's points, formulas and common mistakes; or, for a course, the first points and the
  // formulas of every "study first" topic, for the last hour before the exam.
  async function viewRevise(code, topicId) {
    const { c, analysis } = await getCourse(code);
    if (!analysis) return viewNotFound();
    const t = topicId ? analysis.topics.find((x) => x.id === topicId) : null;
    if (topicId && !t) return viewNotFound();
    if (t) setBack(`#/c/${code}/t/${t.id}`, t.name); else setBack(`#/c/${code}`, c.title);
    const cardsOf = (x, few) => [
      ...(few ? x.points.slice(0, 4) : x.points).map((p) => ({ k: "Key point", t: p, topic: x.name })),
      ...(x.formula || []).map((f) => ({ k: "Formula", t: f, topic: x.name, mono: true })),
      ...(few ? [] : (x.mistakes || []).map((m) => ({ k: "Common mistake", t: m, topic: x.name, warn: true })))
    ];
    const cards = t ? cardsOf(t, false) : analysis.mvp.flatMap((id) => cardsOf(analysis.topics.find((x) => x.id === id), true));
    let i = 0;
    app.innerHTML = `
      <p class="kicker">${esc(c.code)} · Revise</p>
      <h1>${t ? esc(t.name) : "Study-first topics"}</h1>
      <div class="rv-prog" aria-hidden="true"><i id="rvBar"></i></div>
      <div class="rv-stage" id="rvStage" tabindex="0" aria-roledescription="flashcards" aria-label="Revision cards. Swipe or use the arrow keys."></div>
      <div class="rv-nav">
        <button type="button" class="btn secondary" id="rvPrev">‹ Back</button>
        <span class="muted small" id="rvCount" aria-live="polite"></span>
        <button type="button" class="btn" id="rvNext">Next ›</button>
      </div>
      <p class="muted small rv-hint">Swipe left or right. Say each point in your own words before moving on.</p>`;
    const stage = app.querySelector("#rvStage"), bar = app.querySelector("#rvBar"), count = app.querySelector("#rvCount");
    const prevB = app.querySelector("#rvPrev"), nextB = app.querySelector("#rvNext");
    const order = studyOrder(analysis);
    const nextTopic = t ? analysis.topics.find((x) => x.id === order[order.indexOf(t.id) + 1]) : null;
    const show = (dir) => {
      const end = i >= cards.length;
      const k = cards[i];
      stage.innerHTML = end
        ? `<div class="rv-card rv-end"><span class="rv-k">Finished</span><p class="rv-t">You went through ${cards.length} cards${t ? "" : ` from ${analysis.mvp.length} topics`}.</p>
            <div class="rv-end-btns">${t ? `${isDone(code, t.id) ? "" : `<button type="button" class="btn" id="rvDone">Mark ${esc(t.name)} as done</button>`}
              ${nextTopic ? `<a class="btn secondary" href="#/c/${code}/t/${nextTopic.id}">Next topic: ${esc(nextTopic.name)}</a>` : ""}`
              : `<a class="btn" href="#/c/${code}">Back to the course</a>`}
              <button type="button" class="btn secondary" id="rvAgain">Start again</button></div></div>`
        : `<div class="rv-card${k.warn ? " warn" : ""}"><span class="rv-k">${k.k}${t ? "" : ` · ${esc(k.topic)}`}</span><p class="rv-t${k.mono ? " mono" : ""}">${esc(k.t)}</p></div>`;
      const card = stage.firstElementChild;
      if (dir && !reduceMotion()) card.classList.add(dir > 0 ? "in-right" : "in-left");
      bar.style.width = `${Math.round((Math.min(i, cards.length) / cards.length) * 100)}%`;
      count.textContent = end ? `${cards.length} of ${cards.length}` : `${i + 1} of ${cards.length}`;
      prevB.disabled = i === 0;
      nextB.hidden = end;
      const again = stage.querySelector("#rvAgain");
      if (again) again.addEventListener("click", () => { i = 0; show(-1); });
      const doneB = stage.querySelector("#rvDone");
      if (doneB) doneB.addEventListener("click", () => { setDone(code, t.id, true); doneB.outerHTML = `<p class="all-done">${TICK} Marked as done</p>`; });
    };
    const go = (d) => { const j = Math.max(0, Math.min(cards.length, i + d)); if (j !== i) { i = j; show(d); } };
    prevB.addEventListener("click", () => go(-1));
    nextB.addEventListener("click", () => go(1));
    stage.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); });
    // Swipe: a horizontal drag of 50px or more moves one card.
    let x0 = null, y0 = null;
    stage.addEventListener("pointerdown", (e) => { x0 = e.clientX; y0 = e.clientY; });
    stage.addEventListener("pointerup", (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    });
    show(0);
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
    const { c, course, analysis } = await getCourse(code);
    if (!course || !course.sessions.includes(s)) return viewNotFound();
    const [papers, text] = await Promise.all([load("data/papers.json"), load(`data/text/${code}.json`).catch(() => null)]);
    const pdf = (papers[code] || []).find((p) => p.s === s);
    const paper = text && text.papers[s];
    const ref = parseRef(refText);
    const q = paper && paper.items.find((it) => it.n === ref.n);
    const label = (refText || "").replace(/\s*\(or\)$/, " (Or)");
    let section = "";
    if (paper && q) for (const it of paper.items) { if (it === q) break; if (it.h) section = it.h; }
    const body = q ? questionBody(q, ref) : null;
    const known = course.questions.find((x) => x.s === s && String(x.q) === refText)
      || course.questions.find((x) => x.s === s && parseRef(String(x.q)).n === ref.n);
    const topic = known && analysis.topics.find((t) => t.id === known.topic);
    const markText = paper && paper.mcq ? "1 mark" : body && body.marks ? `${body.marks} marks` : known && String(known.q) === refText ? `${marks(known.m)} marks` : "";
    const exact = (paper && paper.mcq) || course.topics.every((t) => t.kind === "theory") || (q && q.img);
    const ansKey = `${s}/${ref.n}`;
    const ans = q && q.o && course.answers && course.answers[ansKey];
    // Back goes where the student came from (a topic, a list, search), else to the course.
    setBack(prevHash ? `#${prevHash}` : `#/c/${code}`, prevHash ? "Back" : c.title);
    // Previous and next question in the same paper.
    const nums = paper ? [...new Set(paper.items.filter((it) => it.n).map((it) => it.n))] : [];
    const at = nums.indexOf(ref.n);
    const prevN = at > 0 ? nums[at - 1] : null, nextN = at >= 0 && at < nums.length - 1 ? nums[at + 1] : null;
    app.innerHTML = `
      <p class="kicker">${esc(c.code)} · ${esc(c.title)}</p>
      <h1>Question ${esc(label)}</h1>
      <p class="qv-meta"><span><strong>${sessionLabel(s)}</strong> term-end exam</span>${markText ? `<span><strong>${esc(markText)}</strong></span>` : ""}${section ? `<span>${esc(section)}</span>` : ""}</p>
      ${topic ? `<a class="topic-link" href="#/c/${code}/t/${topic.id}"><span class="tl-main"><span class="tl-k">Topic</span><span class="tl-n">${esc(topic.name)} ${badge(topic.level)}</span></span><span class="tl-go">Read the notes ${ARROW}</span></a>` : ""}
      ${q ? `<section class="card qv">${body.html}</section>`
        : `<p class="muted">This question isn't available as text yet.</p>`}
      ${ans ? `<details class="qv-ans"><summary>Show answer</summary>
        <div class="details-body"><p><strong>Answer:</strong> ${answerText(ans, q.o[ans - 1])}</p>
        <p class="small muted">${ANSWER_NOTE}</p></div></details>` : ""}
      ${q ? `<button type="button" class="btn ai-btn" id="aiSolve">${AI_SPARK} ${paper && paper.mcq ? "Ask AI to explain this" : "Ask AI to solve this"}</button>` : ""}
      ${pdf ? `<a class="text-link qv-pdf" ${paperHref(code, pdf)} target="_blank" rel="noopener">Download the full ${sessionLabel(s)} paper (PDF)</a>` : ""}
      ${q && !exact ? `<p class="small muted">Text from the official paper; tables and formulas may look slightly different in print.</p>` : ""}
      ${nums.length > 1 && at >= 0 ? `<nav class="pager" aria-label="Questions in this paper">
        ${prevN ? `<a class="pager-btn" href="#/c/${code}/paper/${s}/${prevN}" data-replace>‹ Q${prevN}</a>` : `<span></span>`}
        <span class="muted small">${at + 1} of ${nums.length}</span>
        ${nextN ? `<a class="pager-btn" href="#/c/${code}/paper/${s}/${nextN}" data-replace>Q${nextN} ›</a>` : `<span></span>`}
      </nav>` : ""}`;
    // Wide tables (trial balances) shrink to fit the screen rather than hide columns.
    app.querySelectorAll(".ptable").forEach((t) => {
      const fit = t.clientWidth / t.scrollWidth;
      if (fit < 1) t.style.fontSize = `${Math.max(0.6, 0.8 * fit * 0.97).toFixed(3)}rem`;
    });
    const solve = app.querySelector("#aiSolve");
    if (solve) solve.addEventListener("click", () => {
      const tid = known && known.topic;
      aiDraft = { key: `${code}/${tid || "-"}`, text: `${paper && paper.mcq ? "Explain the correct answer to this multiple-choice question" : "Solve this question"} from the ${sessionLabel(s)} ${c.code} term-end paper${markText ? ` (${markText})` : ""}${ref.subs.length ? `, part ${ref.subs.join(", ")}` : ""}:\n\n${questionText(q, ref)}` };
      location.hash = `#/ask/${code}${tid ? `/${tid}` : ""}`;
    });
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

  function buildPlan(code, course, analysis, choice, doneSet) {
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
      .filter((x) => choice.pick(x, analysis) && !(doneSet ? doneSet.has(x.id) : isDone(code, x.id)))
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
    // Topics already done when the page opened stay out of the plan; ticking a slot marks its topic
    // done but keeps it on screen (struck through) until the time choice changes.
    let doneAtOpen = new Set(analysis.topics.filter((t) => isDone(code, t.id)).map((t) => t.id));
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5);
    const at = (hrs) => new Date(start.getTime() + hrs * 3600e3).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s/g, "\u202f").toLowerCase();

    app.innerHTML = `${courseHeader(c, course)}${courseTabs(code, "/plan")}
      <p class="small muted flush">Time left before the exam</p>
      <div class="segctl hours" role="group" aria-label="Time left" id="hours" data-slide-from="${TIME_CHOICES.findIndex((x) => x.h === h)}">${TIME_CHOICES.map((x) => `<button type="button" data-h="${x.h}" aria-pressed="${x.h === h}">${x.label}</button>`).join("")}<span class="slide-ind" aria-hidden="true"></span></div>
      <p class="small muted plan-note" id="planNote"></p>
      <section class="card" id="plan"></section>`;

    const render = () => {
      const choice = TIME_CHOICES.find((x) => x.h === h);
      const { slots, skipped } = buildPlan(code, course, analysis, choice, doneAtOpen);
      const left = analysis.topics.filter((t) => choice.pick(t, analysis) && doneAtOpen.has(t.id)).length;
      app.querySelector("#planNote").innerHTML = `${h > 8 ? "" : `Starting now, at ${at(0)}.`}${left ? ` ${left} topic${left > 1 ? "s" : ""} you marked done ${left > 1 ? "are" : "is"} left out.` : ""}`;
      app.querySelector("#plan").innerHTML = `
        ${slots.map((sl) => { const ticked = sl.id && isDone(code, sl.id);
          return `<div class="slot${ticked ? " ticked" : ""}">
          ${sl.id ? `<button type="button" class="slot-check" data-slot="${sl.id}" aria-pressed="${ticked}" aria-label="Done: ${esc(sl.what)}">${TICK}</button>` : `<span class="slot-check-gap"></span>`}
          <span class="slot-time">${h > 8 ? duration(sl.to - sl.from) : `${at(sl.from)}<br>– ${at(sl.to)}`}</span>
          <span><span class="slot-what">${sl.id ? `<a href="#/c/${code}/t/${sl.id}">${esc(sl.what)}</a>` : esc(sl.what)}</span> ${sl.level ? badge(sl.level) : ""}<br>
          <span class="slot-how">${esc(sl.how)}</span></span></div>`; }).join("")}
        ${skipped.length ? `<p class="small muted">No time left for: ${skipped.map((t) => esc(t.name)).join(", ")}.</p>` : ""}`;
    };
    app.querySelector("#hours").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      h = +b.dataset.h; store.set("planHours", h);
      doneAtOpen = new Set(analysis.topics.filter((t) => isDone(code, t.id)).map((t) => t.id));
      app.querySelectorAll("#hours button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      placeSlides(app);
      render();
    });
    app.querySelector("#plan").addEventListener("click", (e) => {
      const b = e.target.closest("[data-slot]"); if (!b) return;
      const v = !isDone(code, b.dataset.slot);
      setDone(code, b.dataset.slot, v);
      b.setAttribute("aria-pressed", String(v));
      b.closest(".slot").classList.toggle("ticked", v);
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

  // Settings: one short screen of groups (Study · Display · AI assistant · App · Help).
  // Display switches work in place; everything longer opens on its own page (#/settings/<sub>).
  async function viewSettings(sub) {
    if (sub === "style") return viewSettingsStyle();
    if (sub === "ai") return viewSettingsAi();
    if (sub === "feedback" && FEEDBACK_EMAIL) return viewSettingsFeedback();
    if (sub === "creators" && CREATORS.length) return viewSettingsCreators();
    if (sub === "about") return viewSettingsAbout();
    const toggles = (name, attr, cur, opts) => `<div class="segctl" role="radiogroup" aria-label="${name}" data-slide-from="${Math.max(0, opts.findIndex(([v]) => v === cur))}">${opts.map(([v, l]) =>
      `<button type="button" role="radio" ${attr}="${v}" aria-checked="${v === cur}">${l}</button>`).join("")}<span class="slide-ind" aria-hidden="true"></span></div>`;
    const row = (href, title, value) => `<a class="row set-row" href="${href}"><span class="row-main"><span class="row-title">${title}</span></span>${value ? `<span class="set-v">${value}</span>` : ""}<span class="chev" aria-hidden="true">›</span></a>`;
    const theme = store.get("theme", null) || "system";
    const styleName = STYLES.find(([k]) => k === studyStyle())[1];
    const installed = runningInstalled();
    app.innerHTML = `
      <h1>Settings</h1>

      <h2 class="group-h">Study</h2>
      <div class="rows card">${row("#/settings/style", "Study style", esc(styleName))}</div>

      <h2 class="group-h">Display</h2>
      <section class="card display-card">
        <div class="opt"><span class="opt-l">Theme</span>${toggles("Theme", "data-theme-v", theme, [["light", "Light"], ["dark", "Dark"], ["system", "Auto"]])}</div>
        <div class="opt"><span class="opt-l">Text size</span>${toggles("Text size", "data-textsize", store.get("textsize", "m"), [["s", "Small"], ["m", "Default"], ["l", "Large"], ["xl", "X-large"]])}</div>
        <div class="opt"><span class="opt-l">Density</span>${toggles("Text density", "data-density", store.get("density", "comfortable"), [["comfortable", "Comfortable"], ["compact", "Compact"]])}</div>
      </section>

      <h2 class="group-h">AI assistant</h2>
      <div class="rows card">${row("#/settings/ai", "Gemini API key", aiKey() ? `<span class="ok">✓ Saved</span>` : "Not set up")}</div>

      <h2 class="group-h">App</h2>
      <div class="rows card">
        ${installed ? `<div class="row set-row"><span class="row-main"><span class="row-title">Install app</span></span><span class="set-v"><span class="ok">✓ Installed</span></span></div>`
          : `<button type="button" class="row set-row row-btn" data-install><span class="row-main"><span class="row-title">Install app</span><span class="row-sub">Opens like an app, works offline</span></span><span class="set-v">${store.get("installed", false) ? `<span class="ok">✓ Added</span>` : ""}</span><span class="chev" aria-hidden="true">›</span></button>`}
        <button type="button" class="row set-row row-btn" id="showWelcome"><span class="row-main"><span class="row-title">Show the welcome screen</span></span><span class="chev" aria-hidden="true">›</span></button>
      </div>

      <h2 class="group-h">Help</h2>
      <div class="rows card">
        ${FEEDBACK_EMAIL ? row("#/settings/feedback", "Send feedback") : ""}
        ${CREATORS.length ? row("#/settings/creators", "Meet the creators") : ""}
        ${row("#/settings/about", "About &amp; disclaimer", `v${APP_VERSION}`)}
      </div>`;

    const pick = (sel, b) => { app.querySelectorAll(sel).forEach((x) => x.setAttribute("aria-checked", String(x === b))); placeSlides(app); };
    app.querySelectorAll("[data-textsize]").forEach((b) => b.addEventListener("click", () => { store.set("textsize", b.dataset.textsize); applyPrefs(); pick("[data-textsize]", b); }));
    app.querySelectorAll("[data-density]").forEach((b) => b.addEventListener("click", () => { store.set("density", b.dataset.density); applyPrefs(); pick("[data-density]", b); }));
    app.querySelectorAll("[data-theme-v]").forEach((b) => b.addEventListener("click", () => { setTheme(b.dataset.themeV === "system" ? null : b.dataset.themeV); pick("[data-theme-v]", b); }));
    app.querySelector("#showWelcome").addEventListener("click", showWelcome);
    bindInstall(app);
  }

  function viewSettingsStyle() {
    setBack("#/settings", "Settings");
    app.innerHTML = `
      <h1>Study style</h1>
      <p class="muted small">How topic pages show your notes. You can also switch at the top of any topic.</p>
      <div class="choices" role="radiogroup" aria-label="Study style">${STYLES.map(([v, l, d]) => `
        <button type="button" role="radio" class="choice" data-style="${v}" aria-checked="${v === studyStyle()}">
          <span class="choice-l">${l}${v === "standard" ? ` <span class="muted small">(default)</span>` : ""}</span>
          <span class="choice-d">${d}</span></button>`).join("")}
      </div>`;
    app.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      store.set("style", b.dataset.style);
      app.querySelectorAll(".choice").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }));
  }

  function viewSettingsFeedback() {
    setBack("#/settings", "Settings");
    app.innerHTML = `
      <h1>Send feedback</h1>
      <p>Found a mistake in the notes, or have an idea? Tell us. It opens your email app with the details filled in.</p>
      <div class="fb-btns fb-stack">${[["mistake", "Report a mistake"], ["idea", "Suggest a feature"], ["other", "Other feedback"]].map(([k, l]) =>
        `<a class="btn secondary" href="${feedbackMail(k)}">${l}</a>`).join("")}</div>
      <p class="small muted field-help">No email app? Write to <a href="mailto:${esc(FEEDBACK_EMAIL)}">${esc(FEEDBACK_EMAIL)}</a>.</p>`;
  }

  function viewSettingsCreators() {
    setBack("#/settings", "Settings");
    app.innerHTML = `
      <h1>Meet the creators</h1>
      <div class="creators">${CREATORS.map((p) => `
        <a class="card creator" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">
          <span class="creator-av" aria-hidden="true">${esc(p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</span>
          <span class="creator-main"><strong>${esc(p.name)}</strong>${p.role ? `<span class="muted small">${esc(p.role)}</span>` : ""}<span class="small creator-link">View portfolio ↗</span></span>
        </a>`).join("")}
      </div>`;
  }

  async function viewSettingsAbout() {
    setBack("#/settings", "Settings");
    const { courses } = await load("data/courses.json");
    const papers = courses.reduce((a, c) => a + (c.papers || 0), 0);
    app.innerHTML = `
      <h1>About</h1>
      <section class="card about">
        <div class="about-head"><img src="icons/icon.svg" width="48" height="48" alt="">
          <div><strong>BCom Radar</strong><br><span class="muted small">Version ${APP_VERSION} · ${APP_RELEASED}</span></div></div>
        <p class="small">Exam preparation for IGNOU BCOMF (B.Com) students: topics ranked from past papers, short notes checked against the study material, diagrams, past papers and a study plan.</p>
        <p class="small muted flush">${courses.length} courses · ${papers} past papers · no sign-up; your settings and progress stay on this phone.</p>
      </section>
      <h2>Disclaimer</h2>
      <p class="note small">Independent study aid, not affiliated with IGNOU. Topic priorities are guidance from past papers, not a guarantee.</p>`;
  }

  function viewSettingsAi() {
    setBack("#/settings", "Settings");
    app.innerHTML = `
      <h1>AI assistant</h1>
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
        <div id="aiModelBox"><label class="field-l" for="aiModelSel">Model</label>
        <select id="aiModelSel" class="search"></select></div>
      </section>
      <p class="small field-help"><a href="#/ai-guide">How to get a free Gemini API key →</a></p>
      <p class="small muted">Your key is saved only in this browser on this device and is sent only to Google. Anyone using this device could see it, so remove it on a shared phone.</p>`;

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
      app.querySelector("#aiModelBox").hidden = !k;
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
      "You are the study assistant inside BCom Radar, an exam-preparation app for Indian students of the IGNOU B.Com (BCOMF) programme.",
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
    if (ctx.t) setBack(`#/c/${ctx.c.code}/t/${ctx.t.id}`, ctx.t.name);
    else if (ctx.c) setBack(`#/c/${ctx.c.code}`, ctx.c.title);

    if (!aiKey()) {
      app.innerHTML = `
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

    const ctxName = ctx.t ? `${ctx.t.name} · ${ctx.c.code}` : ctx.c ? `${ctx.c.code} · ${ctx.c.title}` : "Any subject";
    app.innerHTML = `
      <div class="ai-head"><h1>Ask AI</h1><button type="button" class="text-link" id="aiNew">New chat</button></div>
      <details class="ai-ctxbox">
        <summary><span class="ctx-chip">${esc(ctxName)}</span><span class="text-link">Change</span></summary>
        <div class="ai-ctx">
          <label>Course<select id="aiCourse"><option value="">Any subject</option>${ready.map((c) =>
            `<option value="${c.code}"${ctx.c && ctx.c.code === c.code ? " selected" : ""}>${esc(c.code)} · ${esc(c.title)}</option>`).join("")}</select></label>
          ${ctx.c ? `<label>Topic<select id="aiTopic"><option value="">Whole course</option>${ctx.topics.map((t) =>
            `<option value="${t.id}"${ctx.t && ctx.t.id === t.id ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>` : ""}
        </div>
      </details>
      <div id="aiLog" class="ai-log" aria-live="polite"></div>
      <p class="small muted ai-foot">AI answers can be wrong — check them against your study material. Your questions go from this device to Google using your key. <a href="#/settings/ai">AI settings</a></p>
      <div class="composer">
        <div id="aiSugg" class="ai-sugg">${suggestions.map((s) => `<button type="button" class="ai-chip">${esc(s)}</button>`).join("")}</div>
        <form id="aiForm" class="ai-form">
          <label for="aiIn" class="sr-only">Your question</label>
          <textarea id="aiIn" rows="1" placeholder="Ask, or paste a question…"></textarea>
          <button type="submit" class="send-btn" id="aiSend" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg></button>
        </form>
      </div>`;

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
    // The question box grows with what is typed, up to about 7 lines.
    const fit = () => { input.style.height = "auto"; input.style.height = `${Math.min(input.scrollHeight, 168)}px`; };
    input.addEventListener("input", fit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); input.form.requestSubmit(); } });
    // A question handed over from a past paper: show it ready to send, not buried under suggestions.
    if (aiDraft && aiDraft.key === key) {
      input.value = aiDraft.text;
      aiDraft = null;
      sugg.hidden = true;
      fit();
      app.querySelector(".composer").insertAdjacentHTML("afterbegin", `<p class="ai-ready small" role="status">Question added from the past paper. Check it and tap Send.</p>`);
    }

    async function ask(q) {
      q = String(q || "").trim();
      if (!q || aiBusy) return;
      input.value = "";
      fit();
      chat.push({ role: "user", text: q });
      const ans = { role: "model", text: "" };
      chat.push(ans);
      render();
      const last = log.lastElementChild.querySelector(".ai-md");
      last.innerHTML = `<p class="muted ai-wait">Thinking…</p>`;
      log.lastElementChild.scrollIntoView({ block: "nearest" });
      aiBusy = new AbortController();
      sendBtn.classList.add("busy"); sendBtn.setAttribute("aria-label", "Stop");
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
        if (sendBtn.isConnected) { sendBtn.classList.remove("busy"); sendBtn.setAttribute("aria-label", "Send"); render(); }
      }
    }
  }

  function viewAiGuide() {
    setBack("#/settings/ai", "AI settings");
    app.innerHTML = `
      <h1>Get a free Gemini API key</h1>
      <p class="muted">BCom Radar's AI assistant runs on Google Gemini. You use your own key, so there is no sign-up with us and no charge from us. It takes about two minutes.</p>

      <h2>Steps</h2>
      <ol class="guide-steps">
        <li><strong>Open Google AI Studio.</strong> Tap the button below; it opens Google's own site in a new tab.
          <a class="btn secondary guide-link" href="${AI_KEY_PAGE}" target="_blank" rel="noopener noreferrer">Open Google AI Studio ↗</a></li>
        <li><strong>Sign in with your Google (Gmail) account.</strong> If asked, accept Google's terms. Google's terms say you must be 18 or older.</li>
        <li><strong>Tap “Create API key”.</strong> If it asks for a project, choose the one it suggests or let it create a new one.</li>
        <li><strong>Copy the key.</strong> It is a long code that usually starts with <code>AIza</code>. Use the copy button next to it.</li>
        <li><strong>Paste it in BCom Radar.</strong> Go to <a href="#/settings/ai">Settings → AI assistant</a>, paste the key and tap <em>Save and test</em>. A green tick means it works.</li>
        <li><strong>Start asking.</strong> Tap <em>Ask AI</em> in the bottom bar, or the <span class="kbd">${AI_SPARK}</span> button at the bottom of any topic page.</li>
      </ol>

      <h2>Good to know</h2>
      <ul class="points">
        <li><strong>Free tier:</strong> you don't need to add a card. The free tier has limits on requests per minute and per day; if you hit one, wait and try again.</li>
        <li><strong>Privacy:</strong> on the free tier Google may use what you send to improve its products, and people may review it. Don't type personal details such as phone numbers, Aadhaar or passwords.</li>
        <li><strong>Keep your key secret:</strong> it works like a password. BCom Radar saves it only in this browser on this device and sends it only to Google.</li>
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

  // mailto: link with a subject and a short template; the version helps us trace problems.
  function feedbackMail(kind) {
    const subj = { mistake: "Mistake in the notes", idea: "Feature idea", other: "Feedback" }[kind];
    const body = {
      mistake: "Course code:\nTopic or question:\nWhat is wrong:\nWhat it should be (if you know):\n",
      idea: "My idea:\nHow it would help me:\n",
      other: ""
    }[kind] + `\n— BCom Radar ${APP_VERSION}`;
    return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`BCom Radar: ${subj}`)}&body=${encodeURIComponent(body)}`;
  }

  /* ---------- welcome screen (first open; again from Settings) ---------- */
  /* ---------- install as a home-screen app ---------- */
  // Chrome, Edge and Samsung Internet on Android offer a one-tap install (beforeinstallprompt).
  // iPhone browsers and in-app browsers (Instagram, Facebook) do not, so those get short steps.
  const INSTALL_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`;
  const SHARE_ICON = `<svg class="kbd-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>`;
  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener("appinstalled", () => { installPrompt = null; store.set("installed", true); refreshInstall(); });
  const runningInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  function browserKind() {
    const ua = navigator.userAgent;
    if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|; wv\)/i.test(ua)) return "inapp";
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    if (/SamsungBrowser/.test(ua)) return "samsung";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  }

  function refreshInstall() {
    if (/^#\/settings\/?$/.test(location.hash)) refresh();
  }
  function bindInstall(root) {
    root.querySelectorAll("[data-install]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); startInstall(); }));
  }

  // A small card on Home for students who never saw the welcome screen's install button. It shows
  // on the first 3 app opens at most, never once installed, and ✕ hides it for good.
  const homeVisits = (() => { const n = store.get("instVisits", 0) + 1; store.set("instVisits", n); return n; })();
  function installCardHome() {
    if (runningInstalled() || store.get("installed", false) || store.get("instHidden", false) || homeVisits > 3) return "";
    return `<div class="inst-card" id="instCard">
      <img src="icons/icon.svg" width="36" height="36" alt="">
      <span class="inst-main"><strong>Install BCom Radar</strong><span class="muted small">Opens like an app, works offline.</span></span>
      <button type="button" class="btn inst-go" data-install>Install</button>
      <button type="button" class="inst-x" id="instX" aria-label="Don't show this again">✕</button>
    </div>`;
  }
  function bindInstallCard() {
    const card = document.getElementById("instCard");
    if (!card) return;
    bindInstall(card);
    card.querySelector("#instX").addEventListener("click", () => { store.set("instHidden", true); card.remove(); });
  }

  // Must run inside the tap that asked for it: the browser only shows its prompt then.
  function startInstall() {
    if (installPrompt) {
      const p = installPrompt;
      installPrompt = null;   // a prompt can be shown only once
      p.prompt();
      p.userChoice.then((c) => { if (c.outcome === "accepted") store.set("installed", true); refreshInstall(); }).catch(() => {});
      return;
    }
    showInstallSteps();
  }

  function showInstallSteps() {
    const kind = browserKind();
    const link = location.origin + location.pathname;
    const steps = {
      inapp: { lead: "You opened this inside another app (like Instagram or Facebook), which cannot install apps. Open it in your phone's browser first:",
        list: ["Tap the <strong>⋮</strong> or <strong>•••</strong> menu at the top.", "Choose <strong>Open in browser</strong> (or Open in Chrome / Safari).", "Then tap <strong>Install app</strong> in Settings again."] },
      ios: { lead: "On iPhone and iPad, apps are added from the Share menu:",
        list: [`Tap the <strong>Share</strong> button ${SHARE_ICON} — at the bottom in Safari, at the top right in Chrome.`, "Scroll down and tap <strong>Add to Home Screen</strong>.", "Tap <strong>Add</strong>. BCom Radar appears on your home screen."] },
      samsung: { lead: "In Samsung Internet:",
        list: ["Tap the <strong>≡</strong> menu at the bottom right.", "Tap <strong>Add page to</strong> → <strong>Home screen</strong> (or <strong>Install app</strong> if you see it).", "Tap <strong>Add</strong>."] },
      android: { lead: "In Chrome:",
        list: ["Tap the <strong>⋮</strong> menu at the top right.", "Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.", "Tap <strong>Install</strong>. BCom Radar appears on your home screen."],
        note: "Opened the link from WhatsApp? Tap <strong>⋮</strong> → <strong>Open in Chrome</strong> first." },
      desktop: { lead: "On a computer, in Chrome or Edge:",
        list: ["Click the install icon at the right end of the address bar,", "or open the <strong>⋮</strong> / <strong>…</strong> menu and look for <strong>Install BCom Radar</strong>."],
        note: "Best on your phone: open bcomradar.vercel.app there and install it from Settings." }
    }[kind];
    const back = document.createElement("div");
    back.className = "sheet-back";
    back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT" tabindex="-1">
        <h2 id="sheetT">Install BCom Radar</h2>
        <p class="small">${steps.lead}</p>
        <ol class="steps">${steps.list.map((x) => `<li>${x}</li>`).join("")}</ol>
        ${steps.note ? `<p class="muted small">${steps.note}</p>` : ""}
        <div class="sheet-btns">
          ${kind === "inapp" ? `<button type="button" class="btn secondary" id="sheetCopy">Copy link</button>` : ""}
          <button type="button" class="btn" id="sheetOk">Got it</button>
        </div>
      </div>`;
    const before = document.activeElement;
    document.body.appendChild(back);
    document.body.classList.add("no-scroll");
    const sheet = back.querySelector(".sheet");
    sheet.focus();
    const close = () => {
      back.remove();
      document.body.classList.remove("no-scroll");
      if (before && before.focus) before.focus({ preventScroll: true });
    };
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    back.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    back.querySelector("#sheetOk").addEventListener("click", close);
    const copy = back.querySelector("#sheetCopy");
    if (copy) copy.addEventListener("click", () => {
      const done = () => { copy.textContent = "Link copied ✓"; };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => { copy.textContent = link; });
      else copy.textContent = link;
    });
  }

  function showWelcome() {
    const el = document.createElement("div");
    el.className = "splash";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Welcome to BCom Radar");
    el.tabIndex = 0;
    el.innerHTML = `<div class="splash-in">
      <svg class="sp-logo" viewBox="0 0 512 512" aria-hidden="true">
        <rect class="sp-tile" width="512" height="512" rx="112"/>
        <g transform="translate(0 -30)">
          <path class="sp-page sp-l" d="M250 170c-34-22-84-30-138-24v176c54-6 104 2 138 24z"/>
          <path class="sp-page sp-r" d="M262 170c34-22 84-30 138-24v176c-54-6-104 2-138 24z"/>
          <path class="sp-smile" d="M176 392q80 52 160 0"/>
        </g></svg>
      <h1 class="sp-name">BCom Radar</h1>
      <p class="sp-tag">Know what to study first — for IGNOU BCOMF exams</p>
      <ul class="sp-list">
        <li>Topics ranked by how often they are asked</li>
        <li>Short notes checked against your study material</li>
        <li>Diagrams, formulas and answer outlines</li>
        <li>Past papers and a study plan, one tap away</li>
      </ul>
      ${runningInstalled() ? "" : `<button type="button" class="sp-install" data-install>${INSTALL_ICON} Install the app</button>`}
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
    const inst = el.querySelector("[data-install]");
    if (inst) {
      inst.addEventListener("click", (e) => { e.stopPropagation(); close(); startInstall(); });
      inst.addEventListener("keydown", (e) => e.stopPropagation());   // Enter/Space on the button installs, not "continue"
    }
    el.addEventListener("click", close);
    el.addEventListener("keydown", (e) => { if (["Enter", " ", "Escape"].includes(e.key)) { e.preventDefault(); close(); } });
  }

  function viewNotFound() {
    setBack("#/", "All courses");
    app.innerHTML = `<h1>Page not found</h1><p class="muted">This page doesn't exist, or the link is incomplete.</p><a class="btn" href="#/">Go to all courses</a>`;
  }

  /* ---------- router ---------- */
  let prevHash = null;   // the page before this one (the header back arrow returns there when it is the parent)
  let thisHash = null;
  let replacing = false; // the current change came from a data-replace link
  let back = null;       // { href, label } for the header back arrow; each view sets it, Home and the tabs don't
  const setBack = (href, label) => { back = { href, label }; };
  const topBack = document.getElementById("topBack"), topBackLabel = document.getElementById("topBackLabel");
  const brand = document.getElementById("brand"), tabbar = document.getElementById("tabbar");
  const fixedSlot = document.getElementById("fixed");
  const SKELETON = `<div class="skeleton" aria-label="Loading"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div></div>`;
  let quiet = false;     // refresh(): re-render the same page in place, keeping the scroll position

  async function route() {
    // A swap (data-replace) keeps the page before, so Back still returns past the swapped pages.
    if (!quiet) { if (!replacing) prevHash = thisHash; replacing = false; thisHash = location.hash.replace(/^#/, "") || "/"; }
    back = null;
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    const slow = quiet ? null : setTimeout(() => { app.innerHTML = SKELETON; }, 160);
    try {
      if (!parts.length) await viewHome();
      else if (parts[0] === "search") await viewSearch();
      else if (parts[0] === "settings") await viewSettings(parts[1]);
      else if (parts[0] === "ask") await viewAsk(parts[1], parts[2]);
      else if (parts[0] === "ai-guide") viewAiGuide();
      else if (parts[0] === "c" && parts[1]) {
        const code = parts[1];
        if (parts[2] === "t" && parts[3] && parts[4] === "asked") await viewAsked(code, parts[3]);
        else if (parts[2] === "t" && parts[3] && parts[4] === "revise") await viewRevise(code, parts[3]);
        else if (parts[2] === "t" && parts[3]) await viewTopic(code, parts[3]);
        else if (parts[2] === "revise") await viewRevise(code, null);
        else if (parts[2] === "ready") await viewReady(code);
        else if (parts[2] === "paper" && parts[3]) await viewQuestion(code, parts[3], parts[4]);
        else if (parts[2] === "plan") await viewPlan(code);
        else if (parts[2] === "exam") await viewExam(code);
        else if (parts[2] === "papers") await viewPapers(code);
        else await viewCourse(code);
      } else viewNotFound();
    } catch (err) {
      app.innerHTML = `<h1>Couldn't load this page</h1><p class="muted">Check your connection and try again.</p><button type="button" class="btn" onclick="location.reload()">Try again</button>`;
      console.error(err);
    }
    clearTimeout(slow);

    // Header: a back arrow with the parent's name on inner pages, the app name on Home and the tabs.
    topBack.hidden = !back;
    brand.hidden = !!back;
    if (back) { topBack.href = back.href; topBackLabel.textContent = back.label; topBack.setAttribute("aria-label", `Back to ${back.label}`); }
    const tab = !parts.length || parts[0] === "c" ? "home" : parts[0] === "ai-guide" ? "ask" : parts[0];
    tabbar.querySelectorAll("a").forEach((a) => { if (a.dataset.nav === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    const h1 = app.querySelector("h1");
    const code = parts[0] === "c" && parts[1] ? parts[1] : null;
    document.title = h1 && parts.length ? `${h1.textContent.trim()}${code && !h1.textContent.includes(code) ? ` · ${code}` : ""} · BCom Radar` : "BCom Radar";
    // Bars fixed to the bottom live outside <main>: its page-change animation would otherwise pin them to the page.
    fixedSlot.replaceChildren(...app.querySelectorAll(":scope > .actbar, :scope > .composer"));
    document.body.classList.toggle("has-actbar", !!fixedSlot.querySelector(".actbar"));
    document.body.classList.toggle("has-composer", !!fixedSlot.querySelector(".composer"));
    placeSlides(app, true);
    spySections();
    if (quiet) return;
    if (!reduceMotion()) { app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter"); }
    hideToast();
    window.scrollTo(0, 0);
    const anchor = app.querySelector("[data-anchor]");
    if (anchor) anchor.scrollIntoView();
    app.focus({ preventScroll: true });
  }

  // Re-render the current page in place (after a style switch or a Done tap), keeping the scroll.
  async function refresh() {
    const y = window.scrollY;
    quiet = true;
    try { await route(); } finally { quiet = false; }
    window.scrollTo(0, y);
  }

  // The back arrow uses the browser's own Back when the parent is the page before, so the
  // scroll position comes back too.
  topBack.addEventListener("click", (e) => {
    if (back && prevHash && back.href === `#${prevHash}`) { e.preventDefault(); history.back(); }
  });

  // Links marked data-replace (course tabs, question pager) swap the page without adding to history.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-replace]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    if (a.getAttribute("href") === location.hash) return;
    replacing = true;
    location.replace(a.getAttribute("href"));
  });

  // Round checks on topic rows: one tap marks a topic done (or not), nothing else asked.
  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-done]");
    if (!b) return;
    const [code, id] = b.dataset.done.split("/");
    const v = !isDone(code, id);
    setDone(code, id, v);
    refresh();
  });

  // Topic page: section chips jump to a section and follow the scroll.
  app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    if (!b) return;
    const h = document.getElementById(b.dataset.jump);
    if (h) { spyHold = Date.now() + 900; markChip(b.dataset.jump); h.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); }
  });
  let spyHold = 0, spyTick = false;
  function markChip(id) {
    app.querySelectorAll(".secnav [data-jump]").forEach((x) => {
      const on = x.dataset.jump === id;
      x.classList.toggle("on", on);
      if (on && x.scrollIntoView) { const nav = x.parentElement; nav.scrollTo({ left: x.offsetLeft - 16, behavior: reduceMotion() ? "auto" : "smooth" }); }
    });
  }
  function spySections() {
    const nav = app.querySelector(".secnav");
    if (!nav || Date.now() < spyHold) return;
    const line = nav.getBoundingClientRect().bottom + 24;
    let cur = null;
    nav.querySelectorAll("[data-jump]").forEach((b) => { const h = document.getElementById(b.dataset.jump); if (h && h.getBoundingClientRect().top <= line) cur = b.dataset.jump; });
    const on = nav.querySelector(".on");
    if ((on && on.dataset.jump) !== cur) { if (cur) markChip(cur); else if (on) on.classList.remove("on"); }
  }
  window.addEventListener("scroll", () => { if (spyTick) return; spyTick = true; requestAnimationFrame(() => { spyTick = false; spySections(); }); }, { passive: true });

  /* ---------- theme (Settings → Display) ---------- */
  function setTheme(t) {   // "light", "dark" or null to follow the device
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    store.set("theme", t);
  }
  const savedTheme = store.get("theme", null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  /* ---------- launch screen (every open after the first) ---------- */
  // Full screen from the first paint (index.html adds html.launching). It holds until LAUNCH_HOLD ms after the
  // app was opened, or longer only while the first page is still loading; a tap or key skips the wait.
  // Meanwhile it shows real past-paper facts: the student's last course first, then others.
  const LAUNCH_HOLD = 3000;
  function launchScreen(ready) {
    const html = document.documentElement, el = document.getElementById("launch");
    if (!el || !html.classList.contains("launching")) return;
    const factEl = document.getElementById("launchFact");
    let loaded = false, waited = false, done = false, rot = null;
    if (navigator.onLine === false) document.getElementById("launchOff").hidden = false;
    const factHtml = (code, [, name, seen, of]) => `<span class="k">From the last ${of} ${esc(code)} papers</span><b>${esc(name)}</b> came up in ${seen === of ? "every one" : `${seen} of the ${of}`}.`;
    load("data/summary.json").then((summary) => {
      if (done) return;
      const codes = Object.keys(summary).filter((c) => summary[c].fact).sort(() => Math.random() - 0.5);
      const last = store.get("last", null);
      if (last && codes.includes(last.code)) codes.unshift(...codes.splice(codes.indexOf(last.code), 1));
      if (!codes.length) return;
      let i = 0;
      const show = () => { const c = codes[i++ % codes.length]; factEl.innerHTML = factHtml(c, summary[c].fact); factEl.classList.add("show"); };
      show();
      rot = setInterval(() => { factEl.classList.remove("show"); setTimeout(() => { if (!done) show(); }, reduceMotion() ? 0 : 250); }, LAUNCH_HOLD);
    }).catch(() => {});

    const finish = () => {
      if (done || !loaded || !waited) return;
      done = true;
      clearInterval(rot);
      window.removeEventListener("keydown", skip);
      // The big logo moves into the header's logo; the launch fades; the page underneath fades up.
      const logo = document.getElementById("launchLogo"), mark = brand.querySelector(".brand-mark");
      const fly = !reduceMotion() && !brand.hidden && mark ? logo.cloneNode() : null;
      if (fly) {
        const a = logo.getBoundingClientRect();
        fly.className = "l-fly";
        Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
        document.body.appendChild(fly);
        logo.style.visibility = "hidden";
        mark.style.opacity = "0";
      }
      el.classList.add("out");
      html.classList.remove("launching");
      const bar = document.querySelector('meta[name="theme-color"]');
      if (bar && bar.dataset.app) bar.content = bar.dataset.app;
      if (fly) {
        const a = fly.getBoundingClientRect(), b = mark.getBoundingClientRect();
        fly.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${b.width / a.width})`;
      }
      if (!reduceMotion()) app.classList.add("l-in-page");
      setTimeout(() => { if (mark) mark.style.opacity = ""; if (fly) fly.remove(); el.remove(); app.classList.remove("l-in-page"); }, 400);
    };
    const skip = () => { waited = true; finish(); };
    el.addEventListener("click", skip);
    window.addEventListener("keydown", skip);
    setTimeout(skip, Math.max(0, LAUNCH_HOLD - performance.now()));
    ready.then(() => { loaded = true; finish(); });
  }

  window.addEventListener("hashchange", route);
  const firstPage = route();
  if (!store.get("welcomed", false)) showWelcome();
  else launchScreen(firstPage);

  // Makes the app installable as a home-screen app and keeps opened pages readable offline.
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
