/* Exam-style diagrams for topic pages, drawn as inline SVG from real equations,
 * so the textbook relationships hold (MC cuts AC at its minimum, MR = MC, …).
 * A topic lists the diagrams it uses in data/<CODE>.json → "figures": ["id", …].
 * Colours come from CSS (--fig-1…3, validated for colour-blind separation in both
 * themes); every curve is also labelled in text, so colour is never the only cue. */
(function () {
  "use strict";

  const W = 320, LEFT = 40, RIGHT = 306;

  function Fig(height, aria) {
    this.h = height; this.aria = aria; this.parts = [];
  }
  Fig.prototype = {
    // A plot panel: x from 0..xmax, y from ymin..ymax, drawn between pixel rows top..bottom.
    // left/right default to the full width; smaller values give side-by-side panels.
    panel(xmax, ymin, ymax, top, bottom, left = LEFT, right = RIGHT) {
      this.xmax = xmax; this.ymin = ymin; this.ymax = ymax; this.top = top; this.bottom = bottom;
      this.l = left; this.r = right;
      return this;
    },
    X(x) { return this.l + (x / this.xmax) * (this.r - this.l); },
    // The x-axis sits at y = 0, or at the bottom of the panel when the y range starts above 0.
    base() { return this.ymin > 0 ? this.bottom : this.Y(0); },
    Y(y) { return this.bottom - ((y - this.ymin) / (this.ymax - this.ymin)) * (this.bottom - this.top); },
    add(s) { this.parts.push(s); return this; },
    axes(xl, yl, origin = true) {
      const b = this.base();
      this.add(`<path class="ax" d="M${this.l} ${this.top - 4}V${this.bottom}M${this.l} ${b}H${this.r + 4}"/>`);
      if (xl) this.add(`<text class="axl" x="${this.r + 4}" y="${b + 14}" text-anchor="end">${xl}</text>`);
      if (yl) this.add(`<text class="axl" x="${this.l + 5}" y="${this.top + 4}">${yl}</text>`);
      if (origin && this.ymin <= 0) this.add(`<text class="tick" x="${this.l - 4}" y="${b + 12}" text-anchor="end">O</text>`);
      return this;
    },
    curve(f, x0, x1, cls, n = 80) {
      let d = "";
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        d += `${i ? "L" : "M"}${this.X(x).toFixed(1)} ${this.Y(f(x)).toFixed(1)}`;
      }
      return this.add(`<path class="${cls}" d="${d}"/>`);
    },
    line(x1, y1, x2, y2, cls) {
      return this.add(`<path class="${cls}" d="M${this.X(x1).toFixed(1)} ${this.Y(y1).toFixed(1)}L${this.X(x2).toFixed(1)} ${this.Y(y2).toFixed(1)}"/>`);
    },
    area(pts, cls) {
      return this.add(`<polygon class="${cls}" points="${pts.map(([x, y]) => `${this.X(x).toFixed(1)},${this.Y(y).toFixed(1)}`).join(" ")}"/>`);
    },
    // Dashed guides from a point down to the x-axis and across to the y-axis, with tick labels.
    guide(x, y, xt, yt) {
      if (xt !== null) this.add(`<path class="guide" d="M${this.X(x)} ${this.Y(y)}V${this.base()}"/>`);
      if (yt !== null) this.add(`<path class="guide" d="M${this.X(x)} ${this.Y(y)}H${this.l}"/>`);
      if (xt) this.add(`<text class="tick" x="${this.X(x)}" y="${this.base() + 12}" text-anchor="middle">${xt}</text>`);
      if (yt) this.add(`<text class="tick" x="${this.l - 4}" y="${this.Y(y) + 4}" text-anchor="end">${yt}</text>`);
      return this;
    },
    vline(x, cls = "guide") { return this.add(`<path class="${cls}" d="M${this.X(x)} ${this.top}V${this.bottom}"/>`); },
    dot(x, y) { return this.add(`<circle class="dot" cx="${this.X(x)}" cy="${this.Y(y)}" r="4"/>`); },
    text(x, y, s, o = {}) {
      const a = o.anchor || "start", cls = o.cls || "lbl";
      return this.add(`<text class="${cls}" x="${(this.X(x) + (o.dx || 0)).toFixed(1)}" y="${(this.Y(y) + (o.dy || 0)).toFixed(1)}" text-anchor="${a}">${s}</text>`);
    },
    // Horizontal bracket between x1 and x2 at height y, with a label under or over it.
    bracket(x1, x2, y, s, above) {
      const yy = this.Y(y), t = above ? -4 : 4;
      this.add(`<path class="brk" d="M${this.X(x1)} ${yy - t}V${yy}H${this.X(x2)}V${yy - t}"/>`);
      return this.text((x1 + x2) / 2, y, s, { anchor: "middle", dy: above ? -8 : 14, cls: "lbl sm" });
    },
    // Bracket under the x-axis (in the tick row) between x1 and x2.
    underBracket(x1, x2, s) {
      const yy = this.base() + 8;
      this.add(`<path class="brk" d="M${this.X(x1)} ${yy - 4}V${yy}H${this.X(x2)}V${yy - 4}"/>`);
      return this.add(`<text class="lbl sm" x="${(this.X(x1) + this.X(x2)) / 2}" y="${yy + 12}" text-anchor="middle">${s}</text>`);
    },
    pt(x, y, cls = "pt1") { return this.add(`<circle class="${cls}" cx="${this.X(x).toFixed(1)}" cy="${this.Y(y).toFixed(1)}" r="3.5"/>`); },
    // Pixel-space pieces for flow and tree diagrams.
    box(x, y, w, h, lines, bar, bold = 1, xs = false) {
      this.add(`<rect class="bx" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`);
      if (bar) this.add(`<rect class="${bar}" x="${x}" y="${y}" width="5" height="${h}" rx="2"/>`);
      const lh = 13, y0 = y + h / 2 - ((lines.length - 1) * lh) / 2 + 4, cx = x + w / 2;
      lines.forEach((t, i) => this.add(`<text class="${xs ? "lbl xs" : i < bold ? "lbl" : "lbl sm"}" x="${cx}" y="${y0 + i * lh}" text-anchor="middle">${t}</text>`));
      return this;
    },
    ptext(x, y, s, cls = "lbl", anchor = "middle") { return this.add(`<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`); },
    pline(x1, y1, x2, y2, cls = "ax") { return this.add(`<path class="${cls}" d="M${x1} ${y1}L${x2} ${y2}"/>`); },
    // Arrow in pixel space with a small head at (x2, y2).
    arrow(x1, y1, x2, y2, cls = "arr") {
      const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
      const p1 = [x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45)], p2 = [x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45)];
      return this.add(`<path class="${cls}" d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/><polygon class="${cls}-h" points="${x2.toFixed(1)},${y2.toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}"/>`);
    },
    svg() {
      return `<svg viewBox="0 0 ${W} ${this.h}" role="img" aria-label="${this.aria}">${this.parts.join("")}</svg>`;
    }
  };

  // Minimum of f on [a, b] by sampling (for marking minimum points exactly on the drawn curve).
  function argmin(f, a, b) {
    let bx = a, by = f(a);
    for (let i = 1; i <= 4000; i++) { const x = a + ((b - a) * i) / 4000, y = f(x); if (y < by) { by = y; bx = x; } }
    return bx;
  }

  const F = {};

  F["ppc"] = {
    title: "Production possibility curve",
    caption: "The PPC is concave to the origin because opportunity cost rises as more of one good is produced. A point inside it (A) means idle or wasted resources, a point on it (B) is efficient, and a point outside it (C) cannot be reached until more resources or better technology shift the curve outward.",
    draw() {
      const g = new Fig(240, "Production possibility curve").panel(11, 0, 11, 14, 206).axes("Good X", "Good Y");
      g.curve((x) => Math.sqrt(Math.max(0, 81 - x * x)), 0, 9, "c1");
      g.curve((x) => Math.sqrt(Math.max(0, 110 - x * x)), 0, Math.sqrt(110), "c4");
      g.text(3, Math.sqrt(72), "PPC", { dx: 4, dy: -6 }).text(8.4, 6.6, "PPC₂ (growth)", { dx: 2, cls: "lbl sm" });
      const b = 9 / Math.SQRT2;
      g.dot(3, 3).text(3, 3, "A", { dx: 7, dy: 4 });
      g.dot(b, b).text(b, b, "B", { dx: -14, dy: 12 });
      g.dot(9.3, 9.3).text(9.3, 9.3, "C", { dx: 8, dy: 4 });
      return g.svg();
    }
  };

  F["demand-supply"] = {
    title: "Market equilibrium with consumer and producer surplus",
    caption: "Equilibrium E is where demand equals supply, fixing price P* and quantity Q*. Consumer surplus (CS) is the area below demand and above P*; producer surplus (PS) is above supply and below P*. A price ceiling below P* causes a shortage; a floor above P* causes a surplus.",
    draw() {
      const g = new Fig(240, "Demand and supply equilibrium").panel(10, 0, 11, 14, 206).axes("Quantity", "Price");
      g.area([[0, 10], [0, 6], [4, 6]], "a1").area([[0, 6], [0, 2], [4, 6]], "a2");
      g.curve((q) => 10 - q, 0, 9, "c1").curve((q) => 2 + q, 0, 8.5, "c2");
      g.guide(4, 6, "Q*", "P*").dot(4, 6).text(4, 6, "E", { dx: 7, dy: -5 });
      g.text(9, 1, "D", { dx: 4 }).text(8.5, 10.5, "S", { dx: 4, dy: 4 });
      g.text(1.1, 7, "CS", { cls: "lbl sm" }).text(1.1, 4.6, "PS", { cls: "lbl sm" });
      return g.svg();
    }
  };

  F["elasticity"] = {
    title: "Point elasticity on a straight-line demand curve",
    caption: "On a straight-line demand curve, elasticity at a point = lower segment ÷ upper segment. It is 1 at the midpoint M, more than 1 above it, less than 1 below it, infinite where the curve meets the price axis and zero where it meets the quantity axis.",
    draw() {
      const g = new Fig(240, "Elasticity along a linear demand curve").panel(11, 0, 11, 14, 206).axes("Quantity", "Price");
      g.curve((q) => 10 - q, 0, 10, "c1");
      g.dot(5, 5).text(5, 5, "M: e = 1", { dx: 8, dy: -4 });
      g.text(2.3, 7.7, "e > 1 (elastic)", { dx: 8, cls: "lbl sm" });
      g.text(7.3, 2.7, "e < 1 (inelastic)", { dx: 8, cls: "lbl sm" });
      g.text(0, 10, "e = ∞", { dx: 6, dy: -2, cls: "lbl sm" }).text(10, 0, "e = 0", { dx: -6, dy: -8, anchor: "end", cls: "lbl sm" });
      g.text(0.8, 9.2, "D", { dx: 8, dy: 2 });
      return g.svg();
    }
  };

  F["utility"] = {
    title: "Total and marginal utility",
    caption: "As more units are consumed, total utility (TU) rises at a falling rate because marginal utility (MU) diminishes. TU is at its maximum exactly where MU is zero (point of satiety); after that MU is negative and TU falls.",
    draw() {
      const g = new Fig(330, "Total utility and marginal utility curves").panel(7.5, 0, 28, 14, 150).axes("Units", "TU");
      g.curve((q) => 10 * q - q * q, 0, 7, "c1").text(7, 21, "TU", { dx: 4 });
      g.dot(5, 25).text(5, 25, "TU max", { dy: -8, anchor: "middle", cls: "lbl sm" });
      g.add(`<path class="guide" d="M${g.X(5)} ${g.Y(25)}V${g.Y(0)}"/>`);
      g.panel(7.5, -5, 11, 180, 320).axes("Units", "MU");
      g.curve((q) => 10 - 2 * q, 0, 7, "c2").text(7, -4, "MU", { dx: 4, dy: 4 });
      g.dot(5, 0).text(5, 0, "MU = 0", { dx: 6, dy: -6, cls: "lbl sm" });
      g.add(`<path class="guide" d="M${g.X(5)} ${g.top}V${g.Y(0)}"/>`);
      return g.svg();
    }
  };

  F["indifference"] = {
    title: "Consumer equilibrium with indifference curves",
    caption: "Indifference curves (IC) slope down and are convex; a higher curve means more satisfaction. The budget line AB shows what the income can buy. The consumer is in equilibrium at E, where the budget line just touches the highest reachable curve: MRSxy = Px/Py.",
    draw() {
      const g = new Fig(240, "Indifference curves and budget line").panel(10.5, 0, 10.5, 14, 206).axes("Good X", "Good Y");
      [[9, "IC₁"], [16, "IC₂"], [25, "IC₃"]].forEach(([k, n]) => {
        g.curve((x) => k / x, k / 10, 10, "c1").text(10, k / 10, n, { dx: -2, dy: -6, anchor: "end", cls: "lbl sm" });
      });
      g.line(0, 8, 8, 0, "c2").text(0, 8, "A", { dx: -12, dy: 4 }).text(8, 0, "B", { dx: -3, dy: 13 });
      g.guide(4, 4, "", "").dot(4, 4).text(4, 4, "E", { dx: 7, dy: -6 });
      return g.svg();
    }
  };

  F["price-effect"] = {
    title: "Price effect = substitution effect + income effect (Hicks)",
    caption: "When the price of X falls, the budget line swings from AB to AB′ and the consumer moves from Q to S. Draw a dashed compensating line parallel to AB′ just touching the old curve IC₁ at R: Q→R is the substitution effect (always more X), R→S is the income effect.",
    draw() {
      const g = new Fig(236, "Splitting the price effect into substitution and income effects").panel(21, 0, 11, 14, 206).axes("Good X", "Good Y");
      g.curve((x) => 25 / x, 2.4, 20, "c1").text(20, 1.25, "IC₁", { dy: -5, anchor: "end", cls: "lbl sm" });
      g.curve((x) => 50 / x, 4.8, 20, "c1").text(20, 2.5, "IC₂", { dy: -5, anchor: "end", cls: "lbl sm" });
      g.line(0, 10, 10, 0, "c2").line(0, 10, 20, 0, "c2");
      const m = Math.sqrt(50);
      g.line(0, m, 2 * m, 0, "c4");
      g.text(0, 10, "A", { dx: -12, dy: 4 }).text(10, 0, "B", { dx: 5, dy: -5 }).text(20, 0, "B′", { dx: -6, dy: -5, anchor: "end" });
      g.dot(5, 5).text(5, 5, "Q", { dx: 6, dy: -6 });
      g.dot(m, m / 2).text(m, m / 2, "R", { dx: 6, dy: -8 });
      g.dot(10, 5).text(10, 5, "S", { dx: 6, dy: -6 });
      [5, m, 10].forEach((x) => g.add(`<path class="guide" d="M${g.X(x)} ${g.Y(x === m ? m / 2 : 5)}V${g.Y(0)}"/>`));
      g.underBracket(5, m, "SE").underBracket(m, 10, "IE");
      return g.svg();
    }
  };

  F["production"] = {
    title: "Law of variable proportions: three stages",
    caption: "Stage I: AP rises (MP above AP) — increasing returns. Stage II: AP and MP both fall but MP is positive — the rational stage where a producer operates. Stage III: MP is negative and TP falls. MP cuts AP at AP's maximum; TP is at its maximum where MP = 0.",
    draw() {
      const g = new Fig(340, "Total, average and marginal product with three stages").panel(7.5, 0, 118, 22, 150).axes("Labour", "TP");
      g.curve((l) => 9 * l * l - l * l * l, 0, 7, "c1").text(7, 98, "TP", { dx: 4 });
      g.vline(4.5).vline(6);
      g.text(2.25, 112, "Stage I", { anchor: "middle", cls: "lbl sm" }).text(5.25, 112, "II", { anchor: "middle", cls: "lbl sm" }).text(6.75, 112, "III", { anchor: "middle", cls: "lbl sm" });
      g.panel(7.5, -24, 30, 180, 330).axes("Labour", "AP, MP");
      g.vline(4.5).vline(6);
      g.curve((l) => 9 * l - l * l, 0, 7, "c2").text(7, 14, "AP", { dx: 4 });
      g.curve((l) => 18 * l - 3 * l * l, 0, 7, "c3").text(7, -21, "MP", { dx: 4, dy: 4 });
      g.dot(4.5, 20.25).text(4.5, 20.25, "MP = AP", { dx: 6, dy: -6, cls: "lbl sm" });
      g.dot(6, 0).text(6, 0, "MP = 0", { dx: 5, dy: -6, cls: "lbl sm" });
      return g.svg();
    }
  };

  F["costs"] = {
    title: "Short-run cost curves",
    caption: "AFC keeps falling as output rises. AVC, AC and MC are U-shaped. MC cuts AVC and then AC at their lowest points; the gap between AC and AVC is AFC, so it narrows as output grows.",
    draw() {
      const avc = (q) => q * q - 6 * q + 15, mc = (q) => 3 * q * q - 12 * q + 15, afc = (q) => 10 / q, ac = (q) => avc(q) + afc(q);
      const g = new Fig(250, "Short-run average and marginal cost curves").panel(6.2, 0, 34, 14, 214).axes("Output", "Cost");
      g.curve(afc, 0.6, 5.9, "c4").text(5.9, afc(5.9), "AFC", { dx: 3, dy: 4, cls: "lbl sm" });
      g.curve(avc, 0.45, 5.9, "c3").text(5.9, avc(5.9), "AVC", { dx: 3, dy: 6, cls: "lbl sm" });
      g.curve(ac, 0.62, 5.9, "c1").text(5.9, ac(5.9), "AC", { dx: 3, dy: -2, cls: "lbl sm" });
      g.curve(mc, 0.9, 5.25, "c2").text(5.25, mc(5.25), "MC", { dx: 4, dy: 4, cls: "lbl sm" });
      const qa = argmin(ac, 1, 5.5);
      g.dot(3, avc(3)).text(3, avc(3), "min AVC", { dx: -8, dy: -6, anchor: "end", cls: "lbl sm" });
      g.dot(qa, ac(qa)).text(qa, ac(qa), "min AC", { dx: -8, dy: -8, anchor: "end", cls: "lbl sm" });
      return g.svg();
    }
  };

  F["perfect-competition"] = {
    title: "Firm under perfect competition (long run)",
    caption: "The firm is a price-taker, so price = AR = MR is a horizontal line. It produces where MC = MR with MC rising. In the long run free entry and exit push price to the lowest point of AC: the firm earns only normal profit at E.",
    draw() {
      const ac = (q) => 10 / q + 2 + 0.5 * q, mc = (q) => 2 + q;
      const q = Math.sqrt(20), p = ac(q);
      const g = new Fig(240, "Long-run equilibrium of a competitive firm").panel(9, 0, 15, 14, 206).axes("Output", "Cost, revenue");
      g.curve(ac, 1, 8.8, "c1").text(8.8, ac(8.8), "AC", { dx: -2, dy: -6, anchor: "end" });
      g.curve(mc, 0, 11.5, "c2").text(8.2, mc(8.2), "MC", { dx: -6, dy: -4, anchor: "end" });
      g.line(0, p, 9, p, "c3").text(9, p, "P = AR = MR", { dy: 14, anchor: "end", cls: "lbl sm" });
      g.guide(q, p, "Q", null).dot(q, p).text(q, p, "E", { dx: -4, dy: -8, anchor: "end" });
      return g.svg();
    }
  };

  F["monopoly"] = {
    title: "Monopoly equilibrium with supernormal profit",
    caption: "The monopolist faces a downward-sloping demand (AR) with MR below it. Output Q is set where MR = MC; the price P is read up on the AR curve. Because P is above AC at that output, the shaded rectangle is supernormal profit.",
    draw() {
      const ac = (q) => 10 / q + 2 + 0.5 * q, mc = (q) => 2 + q;
      const q = 3.6, p = 20 - 2 * q, c = ac(q);
      const g = new Fig(250, "Monopoly price and output").panel(10.5, 0, 22, 14, 214).axes("Output", "Price, cost");
      g.area([[0, c], [q, c], [q, p], [0, p]], "a1");
      g.curve((x) => 20 - 2 * x, 0, 9.5, "c1").text(9, 0, "AR = D", { dy: -4, anchor: "end", cls: "lbl sm" });
      g.curve((x) => 20 - 4 * x, 0, 5, "c3").text(5, 0, "MR", { dx: 4, dy: -4, cls: "lbl sm" });
      g.curve(mc, 0, 10, "c2").text(10, mc(10), "MC", { dx: -6, dy: 0, anchor: "end", cls: "lbl sm" });
      g.curve(ac, 1.3, 10, "c4").text(10, ac(10), "AC", { dx: 2, dy: 14, anchor: "end", cls: "lbl sm" });
      g.guide(q, p, "Q", "P").add(`<path class="guide" d="M${g.X(q)} ${g.Y(c)}H${g.X(0)}"/>`);
      g.text(0, c, "C", { dx: -4, dy: 4, anchor: "end", cls: "tick" });
      g.dot(q, mc(q)).text(q, mc(q), "MR = MC", { dx: 6, dy: 12, cls: "lbl sm" }).dot(q, p);
      g.text(0.75, p - 1, "Profit", { anchor: "middle", dy: 4, cls: "lbl sm" });
      return g.svg();
    }
  };

  F["kinked"] = {
    title: "Kinked demand curve (Sweezy)",
    caption: "Rivals follow a price cut but not a price rise, so demand is elastic above the kink K and inelastic below it. This leaves a gap in the MR curve; MC can move anywhere within the gap (MC₁ to MC₂) without changing price or output — which is why oligopoly prices stay rigid.",
    draw() {
      const g = new Fig(240, "Kinked demand curve with a gap in marginal revenue").panel(10.5, 0, 10, 14, 206).axes("Output", "Price");
      g.curve((q) => 8.5 - 0.3 * q, 0, 5, "c1").curve((q) => 13 - 1.2 * q, 5, 10, "c1").text(10, 1, "D", { dx: 4 });
      g.curve((q) => 8.5 - 0.6 * q, 0, 5, "c3").curve((q) => 13 - 2.4 * q, 5, 5.4, "c3").text(5.4, 0.1, "MR", { dx: 4, dy: -2, cls: "lbl sm" });
      g.line(5, 5.5, 5, 1, "guide");
      g.curve((q) => 1.5 + 0.6 * q, 1, 9, "c2").text(9, 6.9, "MC₁", { dx: 4, cls: "lbl sm" });
      g.curve((q) => 2.2 + 0.6 * q, 1, 9, "c4").text(9, 7.6, "MC₂", { dx: 4, dy: -2, cls: "lbl sm" });
      g.guide(5, 7, "Q", "P").dot(5, 7).text(5, 7, "K", { dx: 6, dy: -6 });
      g.text(5, 3.2, "gap", { dx: -5, anchor: "end", cls: "lbl sm" });
      return g.svg();
    }
  };

  F["min-wage"] = {
    title: "Minimum wage above the equilibrium wage",
    caption: "Without intervention the labour market clears at wage W and employment L. A legal minimum wage Wmin above W raises the wage for those employed, but firms hire only Ld while Ls people want work: Ls − Ld is unemployment.",
    draw() {
      const g = new Fig(240, "Labour market with a minimum wage").panel(10, 0, 11, 14, 206).axes("Labour", "Wage");
      g.curve((l) => 10 - l, 0, 9, "c1").text(9, 1, "D", { dx: 5, dy: 4 });
      g.curve((l) => 2 + l, 0, 8.5, "c2").text(8.5, 10.5, "S", { dx: 5, dy: 4 });
      g.line(0, 8, 9.5, 8, "c3").text(9.5, 8, "Wmin", { dy: -5, anchor: "end", cls: "lbl sm" });
      g.guide(4, 6, "L", "W").dot(4, 6);
      g.guide(2, 8, "Ld", null).guide(6, 8, "Ls", null);
      g.bracket(2, 6, 8, "unemployment", true);
      return g.svg();
    }
  };

  F["externality"] = {
    title: "Negative externality: over-production and deadweight loss",
    caption: "The market produces where private cost (MPC) meets demand, at Qm. Society's cost is higher (MSC = MPC + external cost), so the social optimum is the smaller Qs. The shaded triangle is the deadweight loss; a Pigouvian tax equal to the external cost moves output back to Qs.",
    draw() {
      const g = new Fig(240, "Negative externality with marginal social cost above marginal private cost").panel(10, 0, 12, 14, 206).axes("Quantity", "Price, cost");
      g.area([[3, 7], [4, 8], [4, 6]], "a2");
      g.curve((q) => 10 - q, 0, 9.5, "c1").text(7.2, 2.8, "D = MSB", { dx: 6, dy: 12, cls: "lbl sm" });
      g.curve((q) => 2 + q, 0, 8.5, "c2").text(8.5, 10.5, "MPC", { dx: 4, dy: 8, cls: "lbl sm" });
      g.curve((q) => 4 + q, 0, 7.5, "c3").text(7.5, 11.5, "MSC", { dx: 4, dy: 4, cls: "lbl sm" });
      g.guide(4, 6, "Qm", null).dot(4, 6).guide(3, 7, "Qs", null).dot(3, 7);
      g.text(4, 7, "DWL", { dx: 6, dy: 4, cls: "lbl sm" });
      return g.svg();
    }
  };

  F["plc"] = {
    title: "Product life cycle",
    caption: "Sales start slowly (introduction), rise fast (growth), level off (maturity) and fall (decline). Profit is negative at first because of launch costs, peaks during growth or early maturity — before sales peak — and shrinks as competition and decline set in.",
    draw() {
      const s = (t) => 10 * t * t * Math.exp(-t / 2.5), p = (t) => 12 * t * t * Math.exp(-t / 2) - 8 * Math.exp(-t / 3);
      const g = new Fig(250, "Product life cycle sales and profit curves").panel(12, -12, 38, 34, 216).axes("Time", "Sales, profit");
      [2, 4.5, 8].forEach((x) => g.vline(x));
      [[1, "Intro"], [3.25, "Growth"], [6.25, "Maturity"], [10, "Decline"]].forEach(([x, n]) => g.add(`<text class="lbl sm" x="${g.X(x)}" y="14" text-anchor="middle">${n}</text>`));
      g.curve(s, 0, 12, "c1").text(10.3, s(10.3), "Sales", { dx: 4, dy: -10, cls: "lbl sm" });
      g.curve(p, 0, 12, "c2").text(6.2, p(6.2), "Profit", { dx: 4, dy: -6, cls: "lbl sm" });
      return g.svg();
    }
  };

  F["break-even"] = {
    title: "Break-even chart",
    caption: "Fixed cost is a flat line; total cost starts at the fixed cost and rises with output; sales revenue starts at zero. Where sales cross total cost is the break-even point (BEP): losses to its left, profits to its right. The distance from BEP to actual sales is the margin of safety; the angle at which sales cut total cost is the angle of incidence — the wider it is, the faster profit grows.",
    draw() {
      const g = new Fig(250, "Break-even chart with fixed cost, total cost and sales lines").panel(36, 0, 150, 14, 214).axes("Output", "Cost, revenue");
      g.area([[0, 40], [16, 64], [0, 0]], "a2").area([[16, 64], [35, 140], [35, 92.5]], "a1");
      g.line(0, 40, 35, 40, "c4").text(22, 40, "Fixed cost", { dy: -5, anchor: "middle", cls: "lbl sm" });
      g.line(0, 40, 35, 92.5, "c2").text(24, 76, "Total cost", { dy: 14, anchor: "middle", cls: "lbl sm" });
      g.line(0, 0, 35, 140, "c1").text(35, 140, "Sales", { dx: -6, dy: 4, anchor: "end", cls: "lbl sm" });
      g.guide(16, 64, "", null).dot(16, 64).text(16, 64, "BEP", { dx: -6, dy: -8, anchor: "end" });
      g.text(11, 50.3, "Loss", { anchor: "middle", dy: 4, cls: "lbl sm" }).text(25.5, 94, "Profit", { anchor: "middle", dy: 4, cls: "lbl sm" });
      g.add(`<path class="guide" d="M${g.X(30)} ${g.Y(120)}V${g.Y(0)}"/>`);
      g.underBracket(16, 30, "margin of safety");
      return g.svg();
    }
  };

  F["yerkes-dodson"] = {
    title: "Stress and performance (Yerkes–Dodson law)",
    caption: "Performance rises with stress (arousal) up to an optimum and then falls. Too little stress brings boredom and low effort; too much brings anxiety, errors and burnout. Stress management aims to stay near the optimum.",
    draw() {
      const g = new Fig(230, "Inverted-U relationship between stress and performance").panel(10, 0, 11, 14, 196).axes("Stress (arousal)", "Performance");
      g.curve((x) => 10 - 0.4 * (x - 5) * (x - 5), 0, 10, "c1");
      g.dot(5, 10).text(5, 10, "Optimum", { dy: -8, anchor: "middle", cls: "lbl sm" });
      g.text(1.8, 1.2, "Boredom", { anchor: "middle", cls: "lbl sm" }).text(8.2, 1.2, "Anxiety", { anchor: "middle", cls: "lbl sm" });
      return g.svg();
    }
  };

  /* ---------- statistics and accounting ---------- */

  // Repeatable pseudo-random numbers, so a scatter plot looks the same on every visit.
  function rng(seed) { let v = seed; return () => (v = (v * 1103515245 + 12345) % 2147483648) / 2147483648; }
  function pearson(pts) {
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
    return { r: sxy / Math.sqrt(sxx * syy), mx, my, byx: sxy / sxx, bxy: sxy / syy };
  }
  const clamp = (v) => Math.max(0.4, Math.min(9.6, v));
  const signed = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

  F["ts-trend"] = {
    title: "Fitting a straight-line trend by least squares",
    caption: "The dots are actual yearly sales; they rise and fall, but the general direction is up. The least-squares line is the one for which the squared gaps between the dots and the line are smallest. Take X = year − middle year so that ΣX = 0; then a = ΣY ÷ n and b = ΣXY ÷ ΣX². Put any year's X into Yc = a + bX to get its trend value or a forecast.",
    draw() {
      const Y = [42, 47, 45, 53, 58, 54, 63, 67, 66], n = Y.length, X = Y.map((_, i) => i - 4);
      const a = Y.reduce((p, v) => p + v, 0) / n, b = X.reduce((p, x, i) => p + x * Y[i], 0) / X.reduce((p, x) => p + x * x, 0);
      const g = new Fig(250, "Actual values and least-squares trend line").panel(9, 35, 75, 26, 206).axes("", "Sales (₹ lakh)", false);
      [40, 50, 60, 70].forEach((v) => g.add(`<text class="tick" x="${g.l - 4}" y="${g.Y(v) + 4}" text-anchor="end">${v}</text>`));
      [0, 2, 4, 6, 8].forEach((i) => g.add(`<text class="tick" x="${g.X(i + 0.5)}" y="${g.bottom + 12}" text-anchor="middle">${2016 + i}</text>`));
      g.curve((x) => a + b * (x - 4.5), 0.2, 8.8, "c1");
      let d = ""; Y.forEach((v, i) => { d += `${i ? "L" : "M"}${g.X(i + 0.5).toFixed(1)} ${g.Y(v).toFixed(1)}`; });
      g.add(`<path class="c2 thin" d="${d}"/>`);
      Y.forEach((v, i) => g.pt(i + 0.5, v, "pt2"));
      g.text(8.8, a + b * 4.3, "Trend", { dx: -2, dy: -8, anchor: "end", cls: "lbl sm" });
      g.text(0.5, Y[0], "Actual", { dx: 6, dy: 14, cls: "lbl sm" });
      g.ptext(g.l + 4, 14, `Yc = ${a.toFixed(0)} + ${b.toFixed(2)}X, where X = year − 2020`, "lbl sm", "start");
      return g.svg();
    }
  };

  F["ts-components"] = {
    title: "The four components of a time series",
    caption: "Secular trend is the long-term direction (e.g. rising population). Seasonal variation repeats within every year (e.g. umbrella sales each monsoon). Cyclical variation is a longer wave of boom and depression lasting several years. Irregular variation is sudden and unpredictable (floods, strikes, a pandemic). Additive model: Y = T + S + C + I; multiplicative: Y = T × S × C × I.",
    draw() {
      const rows = [
        ["Secular trend", "long-term direction", (t) => 1 + 0.55 * t, "c1"],
        ["Seasonal", "repeats every year", (t) => 4 + 2.2 * Math.sin(2 * Math.PI * t), "c2"],
        ["Cyclical", "boom and slump over years", (t) => 4 + 2.6 * Math.sin((2 * Math.PI * t) / 8), "c3"],
        ["Irregular", "sudden, unpredictable", (t) => 3 + 0.35 * Math.sin(7.3 * t) + 0.25 * Math.sin(13.1 * t) + (Math.abs(t - 6.2) < 0.25 ? 3.6 * (1 - Math.abs(t - 6.2) / 0.25) : 0), "c4"],
      ];
      const g = new Fig(300, "Trend, seasonal, cyclical and irregular components");
      rows.forEach(([name, note, f, cls], i) => {
        const top = 8 + i * 73;
        g.panel(8, 0, 8, top + 18, top + 64, 14, 306);
        g.ptext(14, top + 10, name, "lbl", "start").ptext(306, top + 10, note, "tick", "end");
        g.add(`<path class="ax" d="M14 ${top + 64}H306"/>`);
        g.curve(f, 0, 8, cls, 240);
      });
      return g.svg();
    }
  };

  F["correlation-types"] = {
    title: "Positive, negative and no correlation",
    caption: "In a scatter diagram each dot is one pair of values (X, Y). Dots rising from left to right show positive correlation, dots falling show negative correlation, and a shapeless cloud shows no correlation. The closer the dots lie to a straight line, the nearer r is to +1 or −1. The r shown for each is calculated from its dots.",
    draw() {
      const rnd = rng(7), noise = () => (rnd() + rnd() + rnd() - 1.5) * 2.2;
      const sets = [
        ["Positive", () => { const x = 1 + 8 * rnd(); return [x, clamp(x + noise())]; }],
        ["Negative", () => { const x = 1 + 8 * rnd(); return [x, clamp(10 - x + noise())]; }],
        ["No correlation", ((z) => () => [1 + 8 * z(), 1 + 8 * z()])(rng(23))],
      ];
      const g = new Fig(170, "Scatter diagrams for positive, negative and no correlation");
      sets.forEach(([name, make], i) => {
        const left = 18 + i * 102, pts = Array.from({ length: 16 }, make), { r } = pearson(pts);
        g.panel(10, 0, 10, 30, 130, left, left + 88).axes("", "", false);
        pts.forEach(([x, y]) => g.pt(x, y));
        g.ptext(left + 44, 16, name, "lbl sm").ptext(left + 44, 150, `r = ${signed(r)}`, "lbl sm");
      });
      return g.svg();
    }
  };

  F["regression-lines"] = {
    title: "The two regression lines",
    caption: "Y on X (used to estimate Y) and X on Y (used to estimate X) are different lines, and both pass through the point of means (x̄, ȳ). The closer they are, the stronger the correlation: they coincide when r = ±1 and are at right angles when r = 0. The r and slopes shown are calculated from these dots.",
    draw() {
      const rnd = rng(21), noise = () => (rnd() + rnd() + rnd() - 1.5) * 2.4;
      const pts = Array.from({ length: 14 }, () => { const x = 1.2 + 7.6 * rnd(); return [x, clamp(1 + 0.8 * x + noise())]; });
      const { r, mx, my, byx, bxy } = pearson(pts);
      const g = new Fig(250, "Regression lines of Y on X and X on Y crossing at the means").panel(10, 0, 10, 26, 206).axes("X", "Y");
      pts.forEach(([x, y]) => g.pt(x, y));
      const yx = (x) => my + byx * (x - mx), xy = (x) => my + (x - mx) / bxy;
      g.curve(yx, 0.3, 9.7, "c2").text(0.4, yx(0.4), "Y on X", { dx: -2, dy: -14, cls: "lbl sm" });
      const x0 = Math.max(0.3, mx + bxy * (0.3 - my)), x1 = Math.min(9.7, mx + bxy * (9.7 - my));
      g.curve(xy, x0, x1, "c3").text(x1, xy(x1), "X on Y", { dx: -6, dy: 4, anchor: "end", cls: "lbl sm" });
      g.guide(mx, my, "x̄", "ȳ").dot(mx, my).text(mx, my, "(x̄, ȳ)", { dx: 8, dy: 14, cls: "lbl sm" });
      g.ptext(g.l + 4, 14, `r = ${signed(r)} · byx = ${byx.toFixed(2)} · bxy = ${bxy.toFixed(2)}`, "lbl sm", "start");
      return g.svg();
    }
  };

  F["cash-flow"] = {
    title: "How the cash flow statement adds up (AS 3)",
    caption: "Every cash movement goes into exactly one of three activities. Their net total is the increase or decrease in cash for the year; added to the opening balance it must equal the closing cash and cash equivalents in the balance sheet — use this as your check. For a non-financial company, interest and dividend received are investing flows and interest and dividend paid are financing flows.",
    draw() {
      const g = new Fig(372, "Operating, investing and financing cash flows adding up to closing cash");
      const x = 30, w = 260;
      const rows = [
        [["Operating activities", "customers in; suppliers, staff, tax out"], "bar1"],
        [["Investing activities", "buy or sell fixed assets and investments"], "bar2"],
        [["Financing activities", "issue or repay shares and loans"], "bar3"],
      ];
      rows.forEach(([lines, bar], i) => { g.box(x, 6 + i * 62, w, 42, lines, bar); if (i < 2) g.ptext(160, 6 + i * 62 + 57, "+", "lbl"); });
      g.ptext(160, 6 + 2 * 62 + 57, "=", "lbl");
      g.box(x, 192, w, 38, ["Net increase / (decrease) in cash"]);
      g.ptext(160, 250, "+ Opening cash and cash equivalents", "lbl sm").ptext(160, 272, "=", "lbl");
      g.box(x, 282, w, 42, ["Closing cash and cash equivalents", "must match the balance sheet"]);
      g.ptext(160, 350, "Cash equivalents: liquid investments maturing", "tick").ptext(160, 364, "within 3 months of acquisition", "tick");
      return g.svg();
    }
  };

  F["cash-from-operations"] = {
    title: "Cash from operations by the indirect method (example)",
    caption: "Start from net profit before tax. Add back non-cash and non-operating charges (depreciation, loss on sale of assets), take away non-operating gains, adjust for working-capital changes (an increase in current assets uses cash; an increase in current liabilities provides cash), and deduct tax paid. The figures here are an example: 100 + 20 + 5 − 8 − 15 + 10 − 25 = 87.",
    draw() {
      const steps = [["Net profit before tax", 100, "tot"], ["+ Depreciation", 20], ["+ Loss on sale of machine", 5], ["− Gain on sale of investment", -8],
        ["− Increase in debtors", -15], ["+ Increase in creditors", 10], ["− Income tax paid", -25], ["Cash from operations", 87, "tot"]];
      const g = new Fig(8 + steps.length * 28 + 8, "Waterfall of adjustments from net profit to cash from operations");
      const L = 150, R = 292, sc = (v) => L + (v / 130) * (R - L);
      let run = 0;
      steps.forEach(([name, v, kind], i) => {
        const y = 10 + i * 28, from = kind ? 0 : run, to = kind ? v : run + v;
        const x1 = sc(Math.min(from, to)), x2 = sc(Math.max(from, to));
        const cls = kind ? "wf-tot" : v >= 0 ? "wf-up" : "wf-down";
        g.add(`<rect class="${cls}" x="${x1.toFixed(1)}" y="${y}" width="${Math.max(2, x2 - x1).toFixed(1)}" height="16" rx="3"/>`);
        g.ptext(L - 8, y + 12, name, kind ? "lbl sm b" : "lbl sm", "end");
        g.ptext(x2 + 4, y + 12, kind ? String(v) : (v > 0 ? "+" : "−") + Math.abs(v), "tick", "start");
        if (i < steps.length - 1) { const nx = sc(kind ? v : run + v); g.pline(nx, y + 16, nx, y + 28, "guide"); }
        run = kind ? v : run + v;
      });
      g.pline(L, 6, L, 8 + steps.length * 28, "ax");
      return g.svg();
    }
  };

  F["dupont"] = {
    title: "DuPont analysis: what drives return on equity",
    caption: "Return on equity is split into three ratios whose product gives it back, because Sales and Total assets cancel out: (NP ÷ Sales) × (Sales ÷ Total assets) × (Total assets ÷ Equity) = NP ÷ Equity. So ROE can rise through better margins, more efficient use of assets, or more borrowing — and the last one also raises risk.",
    draw() {
      const g = new Fig(236, "DuPont tree: net profit margin times asset turnover times equity multiplier");
      g.box(70, 6, 180, 44, ["Return on equity (ROE)", "Net profit ÷ Equity"], "bar1");
      g.pline(160, 50, 160, 70).pline(51, 70, 271, 70).pline(51, 70, 51, 88).pline(161, 70, 161, 88).pline(271, 70, 271, 88);
      const kids = [["Net profit", "margin", "NP ÷ Sales", "profitability"], ["Asset", "turnover", "Sales ÷ Assets", "efficiency"], ["Equity", "multiplier", "Assets ÷ Equity", "leverage"]];
      kids.forEach(([a, b, f, what], i) => {
        const x = 3 + i * 110;
        g.box(x, 88, 96, 86, [a, b, f], ["bar1", "bar2", "bar3"][i], 2);
        g.ptext(x + 48, 192, what, "tick");
        if (i < 2) g.ptext(x + 103, 136, "×", "lbl");
      });
      g.ptext(160, 222, "ROE = margin × turnover × multiplier", "lbl sm");
      return g.svg();
    }
  };

  /* ---------- flows, cycles and charts ---------- */

  // A vertical chain of steps: [[title, detail], …], optionally with a loop back from the last to the first.
  function vflow(aria, steps, loop) {
    const bh = 40, gap = 16, x = 44, w = 250, h = 8 + steps.length * (bh + gap) - gap + 8;
    const g = new Fig(h, aria);
    steps.forEach(([t, d], i) => {
      const y = 8 + i * (bh + gap);
      g.box(x, y, w, bh, d ? [t, d] : [t], i === 0 || i === steps.length - 1 ? "bar1" : null);
      if (i < steps.length - 1) g.arrow(x + w / 2, y + bh, x + w / 2, y + bh + gap - 1);
    });
    if (loop) {
      const yl = 8 + (steps.length - 1) * (bh + gap) + bh / 2, yf = 8 + bh / 2;
      g.add(`<path class="arr" d="M${x} ${yl}H${x - 22}V${yf}"/>`).arrow(x - 22, yf, x - 1, yf);
      g.add(`<text class="tick" transform="translate(${x - 28} ${(yl + yf) / 2}) rotate(-90)" text-anchor="middle">${loop}</text>`);
    }
    return g;
  }

  F["stock-levels"] = {
    title: "Stock levels (example)",
    caption: "Example: usage 50–150 units a week (normal 100), lead time 2–6 weeks (normal 4), reorder quantity 800. Reorder level = 150 × 6 = 900; minimum level = 900 − 100 × 4 = 500; maximum level = 900 + 800 − 50 × 2 = 1,600; danger level (1-week emergency supply) = 100 × 1 = 100. Stock falls with use; an order is placed when it reaches the reorder level and arrives after the lead time, just as stock reaches the minimum.",
    draw() {
      const g = new Fig(250, "Saw-tooth stock chart with maximum, reorder, minimum and danger levels").panel(24, 0, 1800, 20, 206).axes("Weeks", "Units");
      const lv = [[1600, "Maximum 1,600"], [900, "Reorder 900"], [500, "Minimum 500"], [100, "Danger 100"]];
      lv.forEach(([v, n]) => { g.line(0, v, 23.5, v, "c4").text(23.5, v, n, { dy: -4, anchor: "end", cls: "tick" }); });
      let d = `M${g.X(0)} ${g.Y(1300)}`;
      [0, 8].forEach((t0) => { d += `L${g.X(t0 + 8)} ${g.Y(500)}L${g.X(t0 + 8)} ${g.Y(1300)}`; });
      g.add(`<path class="c1" d="${d}"/>`);
      [4, 12].forEach((t) => g.dot(t, 900));
      g.text(4, 900, "order placed", { dx: -2, dy: 16, anchor: "end", cls: "lbl sm" });
      g.text(8, 1300, "delivery", { dx: 6, dy: -6, cls: "lbl sm" });
      g.bracket(4, 8, 250, "lead time", true);
      return g.svg();
    }
  };

  F["eoq"] = {
    title: "Economic order quantity (example)",
    caption: "Example: annual usage A = 1,200 units, cost per order O = ₹100, carrying cost C = ₹6 per unit a year. Ordering cost (A ÷ Q × O) falls as each order gets bigger; carrying cost (Q ÷ 2 × C) rises. Total cost is lowest where the two are equal: EOQ = √(2AO ÷ C) = √(2 × 1,200 × 100 ÷ 6) = 200 units, at a total cost of ₹1,200.",
    draw() {
      const A = 1200, O = 100, C = 6, q = Math.sqrt((2 * A * O) / C);
      const oc = (x) => (A / x) * O, cc = (x) => (x / 2) * C;
      const g = new Fig(250, "Ordering, carrying and total cost with the economic order quantity").panel(520, 0, 3000, 14, 206).axes("Order size (units)", "Cost (₹)");
      g.curve(oc, 45, 500, "c2").text(500, oc(500), "Ordering cost", { dx: -2, dy: -6, anchor: "end", cls: "lbl sm" });
      g.curve(cc, 0, 500, "c3").text(440, cc(440), "Carrying cost", { dx: 2, dy: 16, anchor: "end", cls: "lbl sm" });
      g.curve((x) => oc(x) + cc(x), 70, 500, "c1").text(500, oc(500) + cc(500), "Total cost", { dx: -2, dy: -6, anchor: "end", cls: "lbl sm" });
      g.guide(q, oc(q) + cc(q), "EOQ 200", "1,200").dot(q, oc(q) + cc(q)).dot(q, oc(q));
      return g.svg();
    }
  };

  F["variance-tree"] = {
    title: "Material and labour variances",
    caption: "Each total variance splits into parts that add back to it, so you can check your answer: cost variance = price (or rate) variance + usage (or efficiency) variance. Usage splits further into mix and yield; for labour, idle time is shown separately. Standard more than actual is favourable (F); actual more than standard is adverse (A).",
    draw() {
      const g = new Fig(330, "Tree of material and labour cost variances");
      const tree = (y, bar, root, a, b, b1, b2, extra) => {
        g.box(80, y, 160, 30, [root], bar);
        const kids = extra ? [a, b, extra] : [a, b], kw = extra ? 96 : 124, xs = extra ? [4, 112, 220] : [14, 144];
        g.pline(160, y + 30, 160, y + 42).pline(xs[0] + kw / 2, y + 42, xs[kids.length - 1] + kw / 2, y + 42);
        kids.forEach((k, i) => { g.pline(xs[i] + kw / 2, y + 42, xs[i] + kw / 2, y + 52); g.box(xs[i], y + 52, kw, 28, [k]); });
        const bx = xs[1] + kw / 2;
        g.pline(bx, y + 80, bx, y + 90).pline(bx - 58, y + 90, bx + 58, y + 90);
        g.pline(bx - 58, y + 90, bx - 58, y + 98).pline(bx + 58, y + 90, bx + 58, y + 98);
        g.box(bx - 108, y + 98, 100, 26, [b1], null, 0).box(bx + 8, y + 98, 100, 26, [b2], null, 0);
      };
      tree(4, "bar1", "Material cost variance", "Price variance", "Usage variance", "Mix", "Yield (sub-usage)");
      tree(170, "bar2", "Labour cost variance", "Rate", "Efficiency", "Mix", "Sub-efficiency", "Idle time");
      return g.svg();
    }
  };

  F["maslow"] = {
    title: "Maslow's hierarchy of needs",
    caption: "Needs arise in order from the bottom: physiological, safety, social, esteem and self-actualisation. A need that is satisfied no longer motivates, so the next level up becomes the motivator. Managers use pay and security for the lower needs, and recognition, responsibility and growth for the higher ones.",
    draw() {
      const g = new Fig(236, "Pyramid of five levels of needs");
      const lv = [["Self-actualisation", "growth, challenging work"], ["Esteem", "recognition, status, awards"], ["Social", "belonging, teamwork"], ["Safety", "job security, insurance"], ["Physiological", "food, shelter, basic pay"]];
      const top = 10, lh = 42, base = 150, apex = 76;
      lv.forEach(([n, e], i) => {
        const y0 = top + i * lh, y1 = y0 + lh - 3, w0 = (base * (i * lh)) / (lv.length * lh), w1 = (base * ((i + 1) * lh - 3)) / (lv.length * lh);
        g.add(`<polygon class="${i === 0 ? "pyr-top" : "pyr"}" points="${apex - w0 / 2},${y0} ${apex + w0 / 2},${y0} ${apex + w1 / 2},${y1} ${apex - w1 / 2},${y1}"/>`);
        g.ptext(apex, y1 - 12, String(5 - i), "lbl");
        g.ptext(162, y0 + 18, n, "lbl", "start").ptext(162, y0 + 32, e, "tick", "start");
      });
      return g.svg();
    }
  };

  F["comm-process"] = {
    title: "The communication process",
    caption: "The sender encodes an idea into a message (words, signs, symbols) and sends it through a channel or medium; the receiver decodes it; feedback tells the sender whether it was understood — without feedback communication is incomplete. Noise is anything that disturbs the message at any stage, such as physical noise, unclear language or emotions.",
    draw() {
      const g = new Fig(170, "Sender, encoding, channel, decoding, receiver with feedback and noise");
      const names = ["Sender", "Encoding", "Channel", "Decoding", "Receiver"], w = 56, gap = 8;
      names.forEach((n, i) => {
        const x = 4 + i * (w + gap);
        g.box(x, 54, w, 34, [n], null, 1, true);
        if (i < 4) g.arrow(x + w, 71, x + w + gap - 1, 71);
      });
      g.ptext(4 + 1.5 * (w + gap) + w / 2 - 32, 46, "message", "tick");
      const xs = 4 + w / 2, xr = 4 + 4 * (w + gap) + w / 2;
      g.add(`<path class="arr" d="M${xr} 88V122H${xs}"/>`).arrow(xs, 122, xs, 89);
      g.ptext(160, 138, "Feedback", "lbl sm");
      const xc = 4 + 2 * (w + gap) + w / 2;
      g.ptext(xc, 18, "Noise", "lbl sm").arrow(xc - 16, 24, xc - 8, 52, "arr-n").arrow(xc + 16, 24, xc + 8, 52, "arr-n");
      return g.svg();
    }
  };

  F["control-cycle"] = {
    title: "The control process",
    caption: "Control is a continuous cycle: set standards (from plans), measure actual performance, compare it with the standards and find the causes of any deviation, then take corrective action — which feeds back into the next round of planning and standards.",
    draw() {
      const g = new Fig(212, "Four-step control cycle");
      const bx = [[10, 14, "1. Set standards"], [170, 14, "2. Measure performance"], [170, 138, "3. Compare, find causes"], [10, 138, "4. Correct deviations"]];
      bx.forEach(([x, y, t], i) => g.box(x, y, 140, 58, t.split(/(?<=\.) /), i === 0 ? "bar1" : null, 1));
      g.arrow(150, 43, 169, 43).arrow(240, 72, 240, 137).arrow(170, 167, 151, 167).arrow(80, 138, 80, 73);
      return g.svg();
    }
  };

  F["line-staff"] = {
    title: "Line and staff organisation",
    caption: "Line authority (solid lines) runs straight down from the top: each person takes orders from one superior. Staff specialists (dashed, e.g. a legal adviser or HR expert) advise the line managers but cannot give them orders. It suits large firms; the risk is conflict between line and staff.",
    draw() {
      const g = new Fig(258, "Organisation chart with line managers and a staff adviser");
      g.box(90, 8, 140, 32, ["Managing Director"], "bar1");
      g.box(232, 56, 84, 32, ["Staff", "legal adviser"]);
      g.add(`<path class="stf" d="M160 48H274V56"/>`);
      g.pline(160, 40, 160, 104).pline(76, 104, 244, 104).pline(76, 104, 76, 116).pline(244, 104, 244, 116);
      g.box(16, 116, 120, 32, ["Production Manager"]).box(184, 116, 120, 32, ["Sales Manager"]);
      [[76, "Foreman"], [244, "Sales Supervisor"]].forEach(([cx, t]) => {
        g.pline(cx, 148, cx, 164).box(cx - 60, 164, 120, 30, [t]).pline(cx, 194, cx, 208).box(cx - 50, 208, 100, 28, ["Workers"]);
      });
      g.pline(8, 252, 30, 252).ptext(34, 255, "line", "tick", "start").add(`<path class="stf" d="M78 252H100"/>`).ptext(104, 255, "staff (advice)", "tick", "start");
      return g.svg();
    }
  };

  F["channel-levels"] = {
    title: "Channel levels",
    caption: "A channel's level is the number of middlemen between the producer and the consumer. Zero-level is direct selling (company websites, Amway); one-level uses a retailer; two-level adds a wholesaler (common for groceries); three-level adds an agent. More levels mean wider reach but less control and higher cost to the consumer.",
    draw() {
      const rows = [["Zero-level (direct)", ["Producer", "Consumer"]], ["One-level", ["Producer", "Retailer", "Consumer"]],
        ["Two-level", ["Producer", "Wholesaler", "Retailer", "Consumer"]], ["Three-level", ["Producer", "Agent", "Wholesaler", "Retailer", "Consumer"]]];
      const g = new Fig(4 + rows.length * 62, "Zero, one, two and three level distribution channels");
      rows.forEach(([name, chain], r) => {
        const y = 6 + r * 62, w = 58, gap = 6;
        g.ptext(4, y + 10, name, "lbl sm", "start");
        chain.forEach((c, i) => {
          const x = 4 + (i === chain.length - 1 ? 4 : i) * (w + gap);
          g.box(x, y + 18, w, 28, [c], null, 1, true);
          if (i < chain.length - 1) { const nx = 4 + (i + 1 === chain.length - 1 ? 4 : i + 1) * (w + gap); g.arrow(x + w, y + 32, nx - 1, y + 32); }
        });
      });
      return g.svg();
    }
  };

  F["buying-process"] = {
    title: "The buying decision process",
    caption: "A buyer moves through five stages. Post-purchase feelings (satisfaction, or doubt called cognitive dissonance) decide whether they buy again and what they tell others — so the process loops back to the next need. Marketers act at every stage: reminders at need recognition, information and reviews at search, comparisons and demos at evaluation, offers at purchase, and follow-up after it.",
    draw() {
      return vflow("Five stages of the buying decision", [["Need recognition", "a problem or want is felt"], ["Information search", "friends, ads, reviews, stores"], ["Evaluation of alternatives", "compare brands, price, features"], ["Purchase decision", "where, when, how to pay"], ["Post-purchase behaviour", "satisfaction or dissonance"]], "repeat purchase").svg();
    }
  };

  F["selling-process"] = {
    title: "The seven-step selling process",
    caption: "The salesperson finds and qualifies prospects (need, authority, ability to pay, eligibility), learns about them before meeting (pre-approach), makes a good first impression, presents and demonstrates the product, answers objections, closes the sale, and follows up — which builds the relationship and brings repeat sales and referrals.",
    draw() {
      return vflow("Seven steps of personal selling", [["Prospecting and qualifying", "find buyers with need, authority, money"], ["Pre-approach", "learn about the prospect"], ["Approach", "first impression, open the talk"], ["Presentation and demonstration", "show benefits, AIDA"], ["Handling objections", "yes-but, boomerang, denial"], ["Closing", "watch for buying signals"], ["Follow-up", "delivery, service, referrals"]], "referrals and repeat sales").svg();
    }
  };

  F["total-income"] = {
    title: "From the five heads to total income",
    caption: "Compute income under each of the five heads, club other persons' income where the law requires and set off losses — the sum is gross total income (GTI). Subtract Chapter VI-A deductions such as 80C, 80D and 80G to get total income, then apply the tax rates (special rates for items like casual income, on which no deductions are allowed).",
    draw() {
      const g = new Fig(300, "Five heads of income adding to gross total income, less deductions, equals total income");
      const heads = [["Salaries"], ["House", "property"], ["Business,", "profession"], ["Capital", "gains"], ["Other", "sources"]], w = 56, gap = 8;
      heads.forEach((h, i) => { const x = 4 + i * (w + gap); g.box(x, 8, w, 40, h, null, 2, true); g.pline(x + w / 2, 48, x + w / 2, 62); });
      g.pline(4 + w / 2, 62, 4 + 4 * (w + gap) + w / 2, 62).arrow(160, 62, 160, 79);
      g.box(40, 80, 240, 40, ["Gross total income", "after clubbing and set-off of losses"], "bar1");
      g.arrow(160, 120, 160, 139);
      g.box(40, 140, 240, 40, ["− Deductions (Chapter VI-A)", "80C, 80D, 80G, 80GGC …"]);
      g.arrow(160, 180, 160, 199);
      g.box(40, 200, 240, 36, ["= Total income"], "bar1");
      g.arrow(160, 236, 160, 255);
      g.box(40, 256, 240, 36, ["Tax at the applicable rates"]);
      return g.svg();
    }
  };

  F["data-abstraction"] = {
    title: "Three levels of data abstraction",
    caption: "Users see only their own views (external level). The logical level describes what data is stored and how it is related (tables, keys). The physical level describes how it is actually stored on disk. Because the levels are separate, one can change without breaking the level above: that is logical and physical data independence.",
    draw() {
      const g = new Fig(222, "View, logical and physical levels of a database");
      g.ptext(160, 12, "View (external) level: what each user sees", "tick");
      ["View 1", "View 2", "View 3"].forEach((v, i) => { g.box(40 + i * 82, 20, 74, 30, [v]); g.pline(77 + i * 82, 50, 160, 88); });
      g.ptext(300, 74, "logical data", "tick", "end").ptext(300, 86, "independence", "tick", "end");
      g.box(40, 94, 238, 40, ["Logical level", "what data, tables and relations"], "bar1");
      g.pline(160, 134, 160, 176);
      g.ptext(300, 152, "physical data", "tick", "end").ptext(300, 164, "independence", "tick", "end");
      g.box(40, 176, 238, 40, ["Physical level", "how data is stored on disk"], "bar2");
      return g.svg();
    }
  };

  F["supply-chain"] = {
    title: "Flows in a supply chain",
    caption: "Goods move from the supplier to the customer (with returns coming back). Information — orders, forecasts, delivery status — moves in both directions. Money moves back from the customer to the supplier. Supply chain management coordinates all three so the whole chain works as one.",
    draw() {
      const g = new Fig(170, "Supplier to customer chain with product, information and money flows");
      const names = ["Supplier", "Maker", "Distributor", "Retailer", "Customer"], w = 56, gap = 8;
      names.forEach((n, i) => g.box(4 + i * (w + gap), 14, w, 32, [n], null, 1, true));
      const x0 = 18, x1 = 302;
      g.arrow(x0, 72, x1, 72, "arr-1").ptext(160, 66, "Products →", "lbl sm");
      g.arrow(x0, 102, x1, 102, "arr-2").arrow(x1, 108, x0, 108, "arr-2").ptext(160, 96, "Information (orders, status) ↔", "lbl sm");
      g.arrow(x1, 138, x0, 138, "arr-3").ptext(160, 132, "← Money (payments)", "lbl sm");
      return g.svg();
    }
  };

  F["accounting-process"] = {
    title: "The accounting process",
    caption: "Every transaction is supported by a voucher, recorded first in the journal (or a subsidiary book) by double entry, posted to ledger accounts and balanced. A trial balance checks the arithmetic, final accounts (trading and P&L account, balance sheet) are prepared from it, and the results are analysed and reported to users.",
    draw() {
      return vflow("Steps from transaction to financial statements", [["Transaction and voucher", "source document"], ["Journal / subsidiary books", "book of original entry"], ["Ledger", "posting and balancing"], ["Trial balance", "arithmetical check"], ["Final accounts", "trading, P&L account, balance sheet"], ["Analysis and reporting", "ratios, decisions"]]).svg();
    }
  };

  F["depreciation-methods"] = {
    title: "Book value under SLM and WDV (example)",
    caption: "Example: a machine costing ₹1,00,000 with a 5-year life. Straight line method: the same charge every year (₹18,000, leaving a scrap value of ₹10,000), so book value falls in a straight line. Written down value method at 30%: the charge is a fixed percentage of the reducing balance — large in early years, smaller later — so the book value curve flattens and never reaches zero.",
    draw() {
      const g = new Fig(240, "Book value over five years under straight line and written down value methods").panel(5.4, 0, 110, 14, 206).axes("", "Book value (₹ '000)", false);
      [0, 1, 2, 3, 4, 5].forEach((t) => g.add(`<text class="tick" x="${g.X(t)}" y="${g.base() + 12}" text-anchor="middle">${t ? `Yr ${t}` : "0"}</text>`));
      [25, 50, 75, 100].forEach((v) => g.add(`<text class="tick" x="${g.l - 4}" y="${g.Y(v) + 4}" text-anchor="end">${v}</text>`));
      const slm = (t) => 100 - 18 * t, wdv = [0, 1, 2, 3, 4, 5].map((t) => 100 * Math.pow(0.7, t));
      g.curve(slm, 0, 5, "c1").text(2.5, slm(2.5), "SLM", { dx: 6, dy: -6, cls: "lbl sm" });
      let d = ""; wdv.forEach((v, t) => { d += `${t ? "L" : "M"}${g.X(t).toFixed(1)} ${g.Y(v).toFixed(1)}`; });
      g.add(`<path class="c2" d="${d}"/>`);
      wdv.forEach((v, t) => g.pt(t, v, "pt2"));
      [0, 1, 2, 3, 4, 5].forEach((t) => g.pt(t, slm(t)));
      g.text(2.5, 100 * Math.pow(0.7, 2.5), "WDV 30%", { dx: -4, dy: 16, anchor: "end", cls: "lbl sm" });
      return g.svg();
    }
  };

  window.FIGURES = F;
})();
