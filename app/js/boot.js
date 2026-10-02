/* Runs in <head> before the first paint, on the app and on the notes pages: the saved theme,
 * text size and density. In the app (script tag marked data-launch) it also turns on the launch
 * screen on every open except the first (the welcome screen plays then), and gives the phone's
 * status bar the launch background meanwhile.
 * A file, not inline code: the site's Content-Security-Policy (vercel.json) allows no inline scripts. */
(function () {
  try {
    var d = document.documentElement;
    var g = function (k) { var v = localStorage.getItem(k); return v === null ? null : JSON.parse(v); };
    var t = g("theme");
    if (t) d.dataset.theme = t;
    d.dataset.textsize = g("textsize") || "m";
    d.dataset.density = g("density") || "comfortable";
    var s = document.currentScript;
    if (s && s.hasAttribute("data-launch") && g("welcomed") === true) {
      d.classList.add("launching");
      var m = document.querySelector('meta[name="theme-color"]');
      var dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      if (m) { m.dataset.app = m.content; m.content = dark ? "#0f1419" : "#f6f7f9"; }
    }
  } catch (e) { /* storage blocked: defaults, no launch screen */ }
})();
