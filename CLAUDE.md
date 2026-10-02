# BCom Radar — project rules

## Product rule (from the product owner — applies to every change)

Students use this tool to study **efficiently and effectively**. The tool must help them study; it must never create extra work or a long setup.

- **Help first, ask never (or last).** Every screen opens with something useful to study or read. Do not lead with questions, forms, scores or progress tracking.
- **Zero setup.** No required settings, profiles, sign-up or configuration before a student gets value. If an input is needed (e.g. time left for a plan), offer sensible one-tap choices with a ready answer already shown.
- **Explain the tool in one glance.** On first sight a student must understand what the app does and what it gives them (what to study first, notes, past papers, a plan) — in a few words, not a paragraph. This is the animated welcome screen on the first open (tap to continue); after that the course list comes first (it can be shown again from Settings). Only two things may sit above the list: a one-line **Continue** strip once a topic has been opened, and the small install card on the first 3 opens. Settings (study style, text size, density, theme) are optional preferences; the defaults must always be the full, standard notes.
- **Shortest path to studying.** Course → what to study first → notes, in as few taps as possible. Past papers are one tap away from every course page (students value this highly).
- **Read in the app, download only on request.** A past question opens the paper inside the app at that question, highlighted — never a PDF download per tap. Downloads stay on the Past papers tab.
- **Short lists.** Keep pages short: show only what matters most and put long lists one tap away (e.g. a topic shows its top 3 past questions; the full list opens on its own page from one link).
- **Tracking is optional and silent.** At most a single tap (e.g. "Done", a round check on a topic row, a tick in the plan) that never blocks or nags; Undo is offered, never a confirmation. No multi-step status selectors. Progress ("2 of 7 done") is one small line inside a card, never what a screen leads with.
- **Less on screen.** Cut anything that does not help a student decide what to study or understand a topic.

Check every UI change against these rules before shipping.

## Other conventions

- Topic priorities are computed from tagged past-paper questions (`app/data/<CODE>.json`); never hand-set a priority.
- Priorities are guidance from past papers, never a guarantee — keep that wording.
- The readiness check ("How ready am I?") says what the done topics *would have* covered in past papers. Never word it as a prediction or a pass/fail result, and never show a pass mark.
- Not an official IGNOU product: no IGNOU logo or branding.
- Static site, no build step; test at phone width (390px) in light and dark mode before pushing.
- **Navigation:** the bottom bar (Home · Search · Ask AI · Settings) and the header back arrow (set with `setBack(href, label)` in each inner view) are the only navigation chrome; don't add back links inside pages. Bars fixed to the bottom of a page go in `.actbar` or `.composer`, which the router moves out of `<main>`.
- **Motion:** short (≤ 250 ms), only to show that something happened, and always off under `prefers-reduced-motion`.
- The app itself has no build step, but the search pages in `notes/`, `sitemap.xml`, `app/data/summary.json`, `app/data/search.json` and `app/data/choices.json` are generated from `app/data`: after any change to `app/data/*.json`, `app/data/text/*.json` or `app/js/figures.js`, run `node tools/build_pages.js` and commit the result (`--check` must pass). Never edit `notes/` by hand.
- **AI assistant is optional.** Nothing in the app may depend on it. It uses the student's own Gemini key, stored only on their device; never add a shared key, a proxy that sees keys, or analytics on questions. Answers must carry the reminder that AI can be wrong, and model text must always be escaped before rendering.
