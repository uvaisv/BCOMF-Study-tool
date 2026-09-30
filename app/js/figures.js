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
    box(x, y, w, h, lines, bar, bold = 1) {
      this.add(`<rect class="bx" x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/>`);
      if (bar) this.add(`<rect class="${bar}" x="${x}" y="${y}" width="5" height="${h}" rx="2"/>`);
      const lh = 13, y0 = y + h / 2 - ((lines.length - 1) * lh) / 2 + 4, cx = x + w / 2;
      lines.forEach((t, i) => this.add(`<text class="${i < bold ? "lbl" : "lbl sm"}" x="${cx}" y="${y0 + i * lh}" text-anchor="middle">${t}</text>`));
      return this;
    },
    ptext(x, y, s, cls = "lbl", anchor = "middle") { return this.add(`<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`); },
    pline(x1, y1, x2, y2, cls = "ax") { return this.add(`<path class="${cls}" d="M${x1} ${y1}L${x2} ${y2}"/>`); },
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

  window.FIGURES = F;
})();
