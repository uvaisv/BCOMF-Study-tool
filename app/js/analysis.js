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

  const api = { LEVELS, RECENT, SPARE, analyse };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ANALYSIS = api;
})(typeof window !== "undefined" ? window : this);
