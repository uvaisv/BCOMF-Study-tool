/* Topic priorities from past papers, shared by the app (js/app.js) and the
 * web-page generator (tools/build_pages.js), so both rank topics the same way.
 * Works in a browser (window.ANALYSIS) and in Node (module.exports). */
(function (root) {
  "use strict";

  const LEVELS = [
    { id: "critical", label: "Critical", min: 15, advice: "Must study" },
    { id: "high", label: "High", min: 10, advice: "Strongly recommended" },
    { id: "moderate", label: "Moderate", min: 6, advice: "Study if time" },
    { id: "low", label: "Low", min: 0, advice: "Optional" }
  ];
  const RECENT = 4;          // sessions counted as "recent"
  const SPARE = 1.2;         // the minimum set covers 1.2 × the marks a student must answer, for choice

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

  /* ---------- readiness: the student's done topics replayed against every past paper ---------- */
  // A question counts as answerable when the done topics carry at least this share of its marks
  // (a 10 + 10 question on two topics needs both).
  const ANSWERABLE = 0.75;

  // The sections of a paper and which questions belong to each. Questions carry `part` where the
  // data has it; otherwise sections are filled in paper order by their size ("2 of 3", "3 of 5").
  function paperGroups(course) {
    const p = course.pattern;
    if (!p.parts) return [{ id: "all", name: "", attempt: p.attempt, of: p.questions }];
    return p.parts.map((g) => ({ id: g.id, name: g.name.replace(/\s*\(.*\)\s*$/, ""), attempt: g.attempt, of: g.of }));
  }

  function paperResult(course, s, known) {
    const groups = paperGroups(course);
    const partOf = (n, q) => {
      if (q.part) return q.part;
      if (groups.length === 1) return groups[0].id;
      let k = 0;
      for (const g of groups) { k += g.of; if (n <= k) return g.id; }
      return groups[groups.length - 1].id;
    };
    // question number → its versions (an "Or" question has two), each a list of [topic, marks]
    const nums = new Map();
    course.questions.filter((q) => q.s === s).forEach((q) => {
      const n = +String(q.q).match(/^\d+/)[0];
      const v = /\(or\)/i.test(q.q) ? 1 : 0;
      if (!nums.has(n)) nums.set(n, { n, part: partOf(n, q), versions: [] });
      const e = nums.get(n);
      (e.versions[v] = e.versions[v] || []).push([q.topic, q.m]);
    });
    const res = groups.map((g) => {
      const qs = [...nums.values()].filter((q) => q.part === g.id).sort((a, b) => a.n - b.n).map((q) => {
        const vs = q.versions.filter(Boolean).map((items) => {
          const t = items.reduce((a, [, m]) => a + m, 0), k = items.reduce((a, [id, m]) => a + (known.has(id) ? m : 0), 0);
          return { items, t, k, ok: t > 0 && k >= ANSWERABLE * t - 1e-9 };
        });
        const best = vs.reduce((x, y) => (y.k > x.k ? y : x));
        return { n: q.n, versions: vs, ok: vs.some((v) => v.ok), km: best.k, tm: Math.max(...vs.map((v) => v.t)), some: vs.some((v) => v.k > 0) };
      });
      const got = qs.filter((q) => q.ok).length;
      const compulsory = g.attempt >= g.of;
      // Marks: your best `attempt` questions by what you know, out of the best `attempt` by full marks.
      const take = Math.min(g.attempt, qs.length);
      const chosen = [...qs].sort((a, b) => b.km - a.km).slice(0, take);
      const marks = chosen.reduce((a, q) => a + q.km, 0);
      const outOf = [...qs].sort((a, b) => b.tm - a.tm).slice(0, take).reduce((a, q) => a + q.tm, 0);
      chosen.forEach((q) => { if (q.km > 0) q.chosen = true; });
      return { ...g, qs, got, compulsory, met: compulsory || got >= g.attempt, marks, outOf };
    });
    const choice = res.filter((g) => !g.compulsory);
    // With no choice anywhere (an MCQ paper, or every question compulsory), "enough" means every question.
    const enough = choice.length ? choice.every((g) => g.met) : res.every((g) => g.qs.every((q) => q.ok));
    const marks = res.reduce((a, g) => a + g.marks, 0), outOf = res.reduce((a, g) => a + g.outOf, 0);
    return {
      s, groups: res, enough, marks, outOf, pct: outOf ? (100 * marks) / outOf : 0,
      got: choice.reduce((a, g) => a + Math.min(g.got, g.attempt), 0),
      need: choice.reduce((a, g) => a + g.attempt, 0),
      short: choice.reduce((a, g) => a + Math.max(0, g.attempt - g.got), 0)
    };
  }

  // known: a Set of topic ids the student has marked done.
  function readiness(course, known) {
    const papers = course.sessions.map((s) => paperResult(course, s, known));
    const hasChoice = paperGroups(course).some((g) => g.attempt < g.of);
    return {
      papers, hasChoice,
      enough: papers.filter((r) => r.enough).length,
      answerable: papers.reduce((a, r) => a + r.got, 0),
      pct: papers.reduce((a, r) => a + r.pct, 0) / papers.length   // average share of the paper's marks
    };
  }

  // The not-done topic that helps most next: by marks (default) or by papers fully covered.
  // `order` lists topic ids in study order and breaks ties.
  function bestNext(course, known, order, by) {
    const base = readiness(course, known);
    let best = null;
    order.forEach((id) => {
      if (known.has(id)) return;
      const r = readiness(course, new Set([...known, id]));
      const key = by === "full" ? [r.enough, r.answerable, r.pct] : [r.pct, r.enough, r.answerable];
      const better = !best || key.some((v, i) => key.slice(0, i).every((w, j) => Math.abs(w - best.key[j]) < 1e-9) && v > best.key[i] + 1e-9);
      if (better) best = { id, key, r };
    });
    if (!best) return null;
    return { id: best.id, papers: best.r.enough, morePapers: best.r.enough - base.enough, pct: best.r.pct, morePct: best.r.pct - base.pct, moreAnswerable: best.r.answerable - base.answerable };
  }

  const api = { LEVELS, RECENT, SPARE, analyse, readiness, bestNext };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ANALYSIS = api;
})(typeof window !== "undefined" ? window : this);
