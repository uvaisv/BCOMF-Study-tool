#!/usr/bin/env node
/* Builds plain web pages for search engines from the app's data:
 *   notes/index.html               all courses
 *   notes/<code>/index.html        one course, topics in priority order
 *   notes/<code>/<topic>/index.html one topic: notes, examples, diagrams, past questions
 * and sitemap.xml listing them, plus app/data/summary.json (Home progress, Continue) and
 * app/data/search.json (Search) and app/data/choices.json (internal choices, for the readiness
 * check) for the app. The app (app/) stays the main way to study;
 * every page links back into it. Topic priorities come from app/js/analysis.js,
 * the same code the app uses.
 *
 *   node tools/build_pages.js          rebuild notes/ and sitemap.xml
 *   node tools/build_pages.js --check  exit 1 if they are out of date with app/data
 *
 * Run it after every change to app/data/*.json (see CLAUDE.md). */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");
const OUT = "notes";
const SITE = "https://bcomradar.vercel.app";
const NAME = "BCom Radar";

const { analyse } = require(path.join(APP, "js/analysis.js"));
global.window = {};
require(path.join(APP, "js/figures.js"));
const FIGURES = global.window.FIGURES;

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(APP, p), "utf8"));

/* ---------- helpers (same wording as app/js/app.js) ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MONTHS = { "06": "Jun", "12": "Dec", "02": "Feb" };
const sessionLabel = (s) => `${MONTHS[s.slice(5)] || s.slice(5)} ${s.slice(0, 4)}`;
const marks = (m) => Math.round(m * 10) / 10;
const badge = (level) => `<span class="badge ${level.id}">${level.label}</span>`;
const evidence = (t, n, mcq) => `Asked in ${t.seen} of ${n} papers · avg ${Math.round(t.avg)} ${mcq ? "questions" : "marks"}`;
const slug = (code) => code.toLowerCase();
const coursePath = (code) => `/${OUT}/${slug(code)}/`;
const topicPath = (code, id) => `/${OUT}/${slug(code)}/${id}/`;
const appLink = (hash) => `/app/#/${hash}`;
const clip = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)).replace(/[\s,;:—–-]+$/, "") + "…");

// Past questions of a topic, most important first (as in the app's askedList).
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

/* ---------- page shell ---------- */
// Saved app settings (theme, text size, density) apply here too: same site, same storage.
const PREFS = `<script>try{var d=document.documentElement,g=function(k){var v=localStorage.getItem(k);return v===null?null:JSON.parse(v)};if(g("theme"))d.dataset.theme=g("theme");d.dataset.textsize=g("textsize")||"m";d.dataset.density=g("density")||"comfortable"}catch(e){}</script>`;

function page({ urlPath, title, description, crumbs, openHref, body }) {
  const url = SITE + urlPath;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + p }))
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="${NAME}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${SITE}/app/icons/icon-512.png">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#0f766e">
  <link rel="icon" href="/app/icons/icon.svg" type="image/svg+xml">
  <link rel="icon" href="/app/icons/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
  <link rel="stylesheet" href="/app/css/style.css">
  ${PREFS}
  <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body class="web-page">
  <header class="topbar">
    <a href="/app/" class="brand" aria-label="${NAME} app">
      <img class="brand-mark" src="/app/icons/icon.svg" width="32" height="32" alt="">
      <span class="brand-text">${NAME}</span>
    </a>
    <div class="topbar-actions"><a class="top-open" href="${openHref}">Open in app</a></div>
  </header>

  <main class="container">
    <nav class="crumbs" aria-label="Breadcrumb">${crumbs.slice(0, -1).map(([name, p]) => `<a href="${p}">${esc(name)}</a>`).join(`<span aria-hidden="true">›</span>`)}</nav>
${body}
    <footer class="page-foot">
      <p>${NAME} is a free, independent study aid for B.Com (BCOMF) students. It is not affiliated with or endorsed by IGNOU. Notes and examples are our own; past questions are quoted for study reference. Topic priorities are guidance, not a guarantee.</p>
      <p><a href="/app/">Open ${NAME}</a> · <a href="/${OUT}/">All notes</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

/* ---------- pages ---------- */
function topicRow(code, t, n, mcq) {
  return `<a class="row" href="${topicPath(code, t.id)}">
        <span class="row-main"><span class="row-title">${esc(t.name)}</span>
          <span class="row-sub">${evidence(t, n, mcq)}</span></span>
        <span class="row-end">${badge(t.level)}<span class="chev" aria-hidden="true">›</span></span>
      </a>`;
}

function indexPage(courses) {
  const years = [...new Set(courses.map(({ c }) => c.year))].sort();
  const body = `
    <h1>B.Com notes by course</h1>
    <p class="lead">Short notes, worked examples, diagrams and past exam questions for every BCOMF course — each course's topics ranked by how often they have been asked.</p>
    ${years.map((y) => `<h2>Year ${y}</h2>
    <div class="rows card">${courses.filter(({ c }) => c.year === y).map(({ c, course }) => `
      <a class="row" href="${coursePath(c.code)}">
        <span class="row-main"><span class="row-title">${esc(c.code)} · ${esc(c.title)}</span>
          <span class="row-sub">${course.topics.length} topics · ${course.sessions.length} past papers</span></span>
        <span class="chev" aria-hidden="true">›</span>
      </a>`).join("")}
    </div>`).join("\n    ")}`;
  return page({
    urlPath: `/${OUT}/`,
    title: `B.Com (BCOMF) notes for every course | ${NAME}`,
    description: "Free BCOMF (B.Com) study notes for all courses: topics ranked from past IGNOU papers, short notes, worked examples, diagrams and past questions.",
    crumbs: [["All notes", `/${OUT}/`]],
    openHref: "/app/",
    body
  });
}

function coursePage(c, course, analysis) {
  const code = c.code, n = course.sessions.length, mcq = !!course.pattern.mcq;
  const { topics, groups } = analysis;
  const byId = (id) => topics.find((t) => t.id === id);
  const split = groups.length > 1 || groups[0].id;
  const others = topics.filter((t) => !analysis.mvp.includes(t.id));
  const tips = course.examTips || {};
  const tipList = [...(tips.choosing || []), ...(tips.numerical || []), ...(tips.mcq || [])];
  const p = course.pattern;
  const body = `
    <h1>${esc(c.title)}</h1>
    <p class="muted small head-meta">${esc(code)} · Year ${c.year} · ${esc(p.time)} · ${p.marks} marks</p>
    <p class="lead">${esc(p.summary)}</p>

    <section class="card focus">
      <h2 class="focus-title">Study these first</h2>
      <p class="muted small">Ranked from ${n} past papers.</p>
      ${groups.map((g) => `${split ? `<h3>${esc(g.name)}</h3>` : ""}<div class="rows">${g.ids.map((id) => topicRow(code, byId(id), n, mcq)).join("")}</div>`).join("\n      ")}
    </section>

    ${others.length ? `<h2>Other topics</h2>
    <p class="muted small">In order of priority.</p>
    <div class="rows card">${others.map((t) => topicRow(code, t, n, mcq)).join("")}</div>` : ""}

    ${tipList.length ? `<h2>Exam tips</h2>
    <section class="card"><ul class="points">${tipList.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}

    <a class="btn web-cta" href="${appLink(`c/${code}`)}">Open ${esc(code)} in ${NAME} →</a>
    <p class="muted small">In the app: study plan, past papers, progress ticks and an AI tutor.</p>`;
  return page({
    urlPath: coursePath(code),
    title: `${code} ${c.title} notes and important topics | ${NAME}`,
    description: clip(`${code} ${c.title}: important topics ranked from ${n} past IGNOU papers, with short notes, worked examples and past questions for each topic.`, 160),
    crumbs: [["All notes", `/${OUT}/`], [`${code} ${c.title}`, coursePath(code)]],
    openHref: appLink(`c/${code}`),
    body
  });
}

function topicPage(c, course, analysis, t) {
  const code = c.code, n = course.sessions.length, mcq = !!course.pattern.mcq;
  const asked = askedList(t);
  const order = [...analysis.mvp, ...analysis.topics.map((x) => x.id).filter((x) => !analysis.mvp.includes(x))];
  const at = order.indexOf(t.id);
  const prev = analysis.topics.find((x) => x.id === order[at - 1]);
  const next = analysis.topics.find((x) => x.id === order[at + 1]);
  const figs = (t.figures || []).map((id) => FIGURES[id]).filter(Boolean);
  const items = (list) => list.map((x) => `<li>${esc(x)}</li>`).join("");

  const sections = [
    `<h2>Key points</h2>
    <section class="card"><ul class="points">${items(t.points)}</ul></section>`,
    t.examples && t.examples.length ? `<h2>${t.examples.length > 1 ? "Worked examples" : "Worked example"}</h2>${t.examples.map((e) => `
    <section class="card example">${e.split(/\n+/).map((l, i) => i ? `<p>${esc(l)}</p>` : `<h3>${esc(l)}</h3>`).join("")}</section>`).join("")}` : "",
    figs.length ? `<h2>${figs.length > 1 ? "Diagrams" : "Diagram"}</h2>${figs.map((f) => `
    <figure class="card fig"><figcaption class="fig-title">${esc(f.title)}</figcaption>${f.draw()}<p class="fig-note">${esc(f.caption)}</p></figure>`).join("")}` : "",
    t.method ? `<h2>How to solve</h2>
    <section class="card"><ol class="steps">${items(t.method)}</ol></section>` : "",
    t.formula && t.formula.length ? `<h2>Formulas</h2>
    <section class="card">${t.formula.map((f) => `<div class="formula">${esc(f)}</div>`).join("")}</section>` : "",
    t.frame ? `<h2>How to write the answer</h2>
    <section class="card"><p class="flush">${esc(t.frame)}</p></section>` : "",
    t.mistakes && t.mistakes.length ? `<h2>Common mistakes</h2>
    <div class="callout warn"><ul class="points">${items(t.mistakes)}</ul></div>` : "",
    asked.length ? `<h2>Asked in past papers</h2>
    <p class="muted small">${asked.length} questions from ${new Set(t.qs.map((q) => q.s)).size} of ${n} papers · most important first</p>
    <section class="card asked-card"><ul class="asked">${asked.map((q) => `<li><a class="ask" href="${appLink(`c/${code}/paper/${q.s}/${encodeURIComponent(q.q)}`)}">
      <span class="ask-main"><span class="ask-q">${esc(q.t)}</span>
        <span class="ask-meta">${q.times > 1 ? `Asked ${q.times}× · ` : ""}${sessionLabel(q.s)}${mcq ? "" : ` · ${marks(q.m)} marks`}</span></span>
      <span class="chev" aria-hidden="true">›</span></a></li>`).join("")}</ul></section>` : ""
  ].filter(Boolean);

  const body = `
    <h1>${esc(t.name)}</h1>
    <p class="head-meta">${badge(t.level)} <span class="muted small">${evidence(t, n, mcq)}</span></p>
    <p class="lead">${esc(t.summary)}</p>
    ${t.units && t.units.length ? `<p class="book-ref"><span class="book-ref-h">In your IGNOU book</span>${t.units.map((u) =>
      `<span>${u.block ? `Block ${u.block} · ` : ""}Unit ${u.unit} ${esc(u.title)}${u.part ? ` <span class="muted">(${esc(u.part)})</span>` : ""}</span>`).join("")}</p>` : ""}

    ${sections.join("\n\n    ")}

    <div class="web-cta-row">
      <a class="btn" href="${appLink(`c/${code}/t/${t.id}`)}">Study this in ${NAME}</a>
      <a class="btn secondary" href="${appLink(`ask/${code}/${t.id}`)}">Ask AI about this topic</a>
    </div>

    <nav class="topic-foot web-pager" aria-label="More topics">
      ${prev ? `<a class="btn secondary" href="${topicPath(code, prev.id)}">← ${esc(prev.name)}</a>` : `<a class="btn secondary" href="${coursePath(code)}">← All ${esc(code)} topics</a>`}
      ${next ? `<a class="btn secondary" href="${topicPath(code, next.id)}">${esc(next.name)} →</a>` : `<a class="btn secondary" href="${coursePath(code)}">All ${esc(code)} topics →</a>`}
    </nav>`;
  return page({
    urlPath: topicPath(code, t.id),
    title: `${t.name} – ${code} ${c.title} notes | ${NAME}`,
    description: clip(`${t.name} (${code} ${c.title}): key points${t.examples && t.examples.length ? ", worked examples" : ""}${asked.length ? " and past exam questions" : ""}. ${t.summary}`, 160),
    crumbs: [["All notes", `/${OUT}/`], [`${code} ${c.title}`, coursePath(code)], [t.name, topicPath(code, t.id)]],
    openHref: appLink(`c/${code}/t/${t.id}`),
    body
  });
}

/* ---------- internal choices ("any four of the following"), for the readiness check ---------- */
// From each paper's text (app/data/text/<CODE>.json): a question whose opening line says
// "any N of the following" and lists M lettered parts, N < M. Keyed "<session>/<question>",
// with "/or" for the alternative of an Or question. Value: [N, M].
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const ANY_OF = /\bany\s*(one|two|three|four|five|six|seven|eight|\d)\s*(?:of\s*)?(?:the\s*)?following/i;
function findChoices(loaded) {
  const out = {};
  for (const { c } of loaded) {
    const f = path.join(APP, "data/text", `${c.code}.json`);
    if (!fs.existsSync(f)) continue;
    const text = JSON.parse(fs.readFileSync(f, "utf8"));
    const map = {};
    for (const [s, paper] of Object.entries(text.papers || {})) {
      for (const it of paper.items || []) {
        if (!it.n) continue;
        const versions = [[]];
        (it.b || []).forEach((b) => { if (b.or) versions.push([]); else versions[versions.length - 1].push(b); });
        versions.forEach((blocks, v) => {
          let lead = null;
          for (const b of blocks) { if (b.s) break; if (b.p && ANY_OF.test(b.p)) { lead = b; break; } }
          if (!lead) return;
          const w = ANY_OF.exec(lead.p)[1].toLowerCase();
          const n = NUM[w] || +w;
          const m = blocks.filter((b) => b.s).length;
          if (n > 0 && m > n) map[`${s}/${it.n}${v ? "/or" : ""}`] = [n, m];
        });
      }
    }
    if (Object.keys(map).length) out[c.code] = map;
  }
  return out;
}

/* ---------- build ---------- */
function build() {
  const { courses } = readJson("data/courses.json");
  const files = new Map();   // path relative to ROOT → content
  const loaded = courses.filter((c) => c.ready).map((c) => ({ c, course: readJson(`data/${c.code}.json`) }));
  files.set(`${OUT}/index.html`, indexPage(loaded));
  const urls = ["/app/", `/${OUT}/`];
  for (const { c, course } of loaded) {
    const analysis = analyse(course);
    files.set(`${OUT}/${slug(c.code)}/index.html`, coursePage(c, course, analysis));
    urls.push(coursePath(c.code));
    for (const t of analysis.topics) {
      if (!/^[a-z0-9-]+$/.test(t.id)) throw new Error(`${c.code}: topic id "${t.id}" is not usable in a web address`);
      files.set(`${OUT}/${slug(c.code)}/${t.id}/index.html`, topicPage(c, course, analysis, t));
      urls.push(topicPath(c.code, t.id));
    }
  }
  // Small data files for the app itself: per-course "study first" lists (Home progress and the
  // Continue strip) and a search index of courses, topics and past questions (Search).
  const summary = {}, search = { courses: [], topics: [], questions: [] };
  for (const { c, course } of loaded) {
    const analysis = analyse(course);
    summary[c.code] = { topics: course.topics.length, mvp: analysis.mvp.map((id) => { const t = analysis.topics.find((x) => x.id === id); return [id, t.name, t.level.label]; }) };
    // The launch screen's fact: the topic asked in the most papers (ties go to the higher-ranked one).
    const top = analysis.topics.reduce((a, t) => (t.seen > a.seen ? t : a));
    if (top.seen) summary[c.code].fact = [top.id, top.name, top.seen, course.sessions.length];
    search.courses.push([c.code, c.title, c.year]);
    analysis.topics.forEach((t) => search.topics.push([c.code, t.id, t.name, t.level.label]));
    const seen = new Set();
    [...course.questions].sort((a, b) => b.s.localeCompare(a.s)).forEach((q) => {
      const k = q.t.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(k)) return;
      seen.add(k);
      search.questions.push([c.code, q.s, String(q.q), q.t, marks(q.m), q.topic]);
    });
  }
  files.set("app/data/summary.json", JSON.stringify(summary) + "\n");
  files.set("app/data/choices.json", JSON.stringify(findChoices(loaded)) + "\n");
  files.set("app/data/search.json", JSON.stringify(search) + "\n");
  files.set("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join("\n")}
</urlset>
`);
  return files;
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

const files = build();
const existing = listFiles(path.join(ROOT, OUT)).map((f) => path.relative(ROOT, f).split(path.sep).join("/"));

if (process.argv.includes("--check")) {
  const stale = [...files].filter(([p, s]) => !fs.existsSync(path.join(ROOT, p)) || fs.readFileSync(path.join(ROOT, p), "utf8") !== s).map(([p]) => p);
  const extra = existing.filter((p) => !files.has(p));
  if (stale.length || extra.length) {
    console.error(`Web pages or app search data are out of date (${stale.length} changed, ${extra.length} to remove). Run: node tools/build_pages.js`);
    process.exit(1);
  }
  console.log(`Web pages are up to date (${[...files.keys()].filter((p) => p.startsWith(OUT)).length} pages).`);
} else {
  existing.filter((p) => !files.has(p)).forEach((p) => fs.unlinkSync(path.join(ROOT, p)));
  for (const [p, s] of files) {
    fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, p), s);
  }
  // Remove folders left empty by deleted topics.
  const prune = (d) => { fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).forEach((e) => prune(path.join(d, e.name))); if (!fs.readdirSync(d).length) fs.rmdirSync(d); };
  prune(path.join(ROOT, OUT));
  console.log(`Wrote ${[...files.keys()].filter((p) => p.startsWith(OUT)).length} pages, sitemap.xml and the app search data.`);
}
