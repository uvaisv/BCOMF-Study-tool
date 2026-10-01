# BCom Radar

An exam-preparation tool for IGNOU BCOMF (B.Com Honours) students. It uses previous-year question papers to show which topics matter most, what to study first, and a plan for the time a student has left.

> An independent study aid — not an official IGNOU product. Priorities are based on past papers and are guidance, not a guarantee.

## What it does

Built around one rule (see `CLAUDE.md`): **help students study — never add setup or extra work.**

- **Welcome screen**: on the first open only, an animated full-screen welcome says what the app gives (ranked topics, notes, diagrams, past papers, a plan); tap anywhere to continue. After that the course list comes first. Pick a year or search `131` / `financial`.
- **Settings** (gear in the top bar):
  - **Study style**: changes how every topic page shows the notes. **Standard** (default) is the full notes, unchanged. **Short** gives the top points (tap for all), formulas and steps. **Detailed** adds diagram explanations and the top past questions on the page. **Visual** puts diagrams and formulas first, with points as numbered cards and steps as a flow. **Example-oriented** is the standard notes plus worked examples.
  - Text size, text density (comfortable or compact) and theme.
  - Show the welcome screen again, About (version) and a short disclaimer.
- **Ask AI** (sparkle in the top bar, *Ask AI about this topic* on topic pages, *Ask AI to solve this* on past questions): an optional study assistant on Google Gemini using the student's **own free API key**, saved in Settings → AI assistant (checked with Google before it is saved). The chosen course and topic notes are sent with each question so answers stay consistent with the notes; answers stream in and are rendered from Markdown with all model text escaped. Calls go straight from the browser to `generativelanguage.googleapis.com`; the key is kept only in that browser's localStorage. If the saved model is retired, the app picks the newest stable Flash model from the key's model list. `#/ai-guide` explains how to create a key in Google AI Studio, the free-tier limits, privacy on the free tier, and keeping the key secret.
- **Installable**: on a phone, *Add to Home screen* / *Install app* gives an icon that opens full-screen without the browser's address bar. Pages already opened still load offline.
- **Course page** opens straight on **Study these first** — the smallest set of topics that has carried enough marks to answer the paper (worked out per part when the paper is split into parts). Then the latest past papers (one tap to the PDF) and the other topics in priority order.
- **Topic page**: where the topic is in the IGNOU study material (block and unit; unit only where the book has no blocks), key points, an exam-style **diagram** where the topic has one (all BECC-101 topics; product life cycle, break-even chart, stress–performance curve; time-series trend and components, correlation scatter plots, regression lines, cash flow statement, DuPont ratio tree; stock levels, EOQ, variance tree, Maslow's pyramid, communication process, control cycle, line and staff chart, channel levels, buying and selling processes, heads of income, data abstraction, supply chain flows, accounting process, SLM vs WDV), how to solve, formulas, how to write the answer, common mistakes, and an **Asked in past papers** button that opens every past question on it, most important first, on its own page. Tapping a question opens **just that question inside the app** — term, question number, printed marks and the part asked — with a button to download the full paper. **Next topic** keeps you moving; **Mark as done** is optional.
- **Plan**: one tap for the time left (3 hours, 6 hours, 2 days, 1 week) and the schedule is there — no settings.
- **Exam tips** and **Past papers** tabs.

Courses with full analysis: all 8 Year 1 courses (BCOC-131, BCOC-132, BECC-101, BRL-101, BCOS-183, BCOS-186, BEVAE-181, BEDSV-101), all 8 Year 2 courses (BCOC-133, BCOC-134, BCOC-136, BCOE-141, BCOS-184, BCOS-185, BEGAE-182, BPAS-184), and all 8 Year 3 courses (BCOC-135, BCOC-137, BCOC-138, BCOE-142, CPI-102, BPCS-186, BMS-1, and BECS-184 Data Analysis, taken instead of the internship). BEVAE-181 is an MCQ paper: its 550 past questions are tagged by topic, and questions repeated across papers are listed on the course page. Most MCQs have an answer (`answers` in `BEVAE-181.json`, shown behind **Show answer** on the question and inline in the repeated list). IGNOU publishes no answer key, so these are our own answers, labelled as such. Answers that depend on IGNOU's own wording were checked against the IGNOU BEVAE-181 study material; 11 questions it does not settle (or that are misprinted) have no answer. Other courses show their past papers until their analysis is added.

## Google Search

`app/index.html` carries a search description, a canonical address and link-preview (Open Graph) tags; `robots.txt` and `sitemap.xml` sit at the site root. They all use the live address `https://bcomf-study.vercel.app` — if the site moves to its own domain, replace that address in those four files (`index.html`, `app/index.html`, `robots.txt`, `sitemap.xml`).

To get listed: open Google Search Console (https://search.google.com/search-console), add the site, verify ownership (the HTML-tag method gives a `<meta name="google-site-verification" …>` line to paste into `app/index.html`), then submit `sitemap.xml`. The app uses `#` addresses, so Google indexes it as one page; searches for the name or the course codes find it, individual topics do not.

## Host on Google (Firebase Hosting)

`firebase.json` is ready: it publishes `index.html`, `app/` and `question-papers/` (exactly the site files — no `.git`, docs or config), sends `/` to `/app/`, and makes browsers re-check pages, scripts and data so updates show at once.

1. Create a project at https://console.firebase.google.com (the free Spark plan is enough to start). The project ID becomes the address, e.g. `bcom-radar` → `https://bcom-radar.web.app/app/`.
2. On a computer with Node.js: `npm install -g firebase-tools`, then `firebase login`.
3. In this folder: `firebase use --add` (pick the project), then `firebase deploy --only hosting`.
4. Optional, deploy on every push: `firebase init hosting:github` (keep the existing `firebase.json` and `index.html` when asked).

Notes: browser storage is per address, so students who move from another address start fresh (progress, settings and their AI key must be set again) and should reinstall the home-screen app. The free plan includes 10 GB of storage and 360 MB of downloads a day; past-paper PDFs use most of that, so heavy use may need the pay-as-you-go plan.

## Run it

It is a static site — no build step.

```
python3 -m http.server 8000
```

Then open http://localhost:8000 (it forwards to `app/`).

To publish on Vercel, import the repo with Framework Preset **Other**, no build command, and the Root Directory left as the repo root: the root `index.html` redirects to `app/`, and the paper downloads are served from `question-papers/` (named `<CODE> <Mon YYYY>.pdf`). Every push to `main` then updates the site.

## Layout

```
app/
  index.html, css/, js/app.js
  js/figures.js           topic diagrams, drawn as SVG from equations; a topic lists them in "figures"
  manifest.webmanifest, sw.js, icons/   home-screen app: name, icon, full-screen launch, offline cache
  data/courses.json       all courses (year, exam format, paper count)
  data/papers.json        past-paper links per course (built from question-papers/index.csv)
  data/<CODE>.json        topics, study notes, exam tips and every past question tagged to a topic
  data/text/<CODE>.json   each paper's English questions as text, for the in-app paper view
  qimg/<CODE>/            question images for papers whose maths does not survive as text (BCOC-134)
question-papers/          228 official papers + index.csv (see its README)
```

## How priorities are calculated

For each topic, from the tagged questions in `data/<CODE>.json`:

- **avg** = total marks asked ÷ number of papers
- **recent** = the same over the latest 4 papers
- **score** = 0.6 × avg + 0.4 × recent
- Critical ≥ 15, High ≥ 10, Moderate ≥ 6, otherwise Low (marks per paper, out of 180 on offer)

The minimum set takes topics in score order until they cover 1.2 × the marks a student must answer (`pattern.spare` overrides 1.2). When the paper has parts and every topic belongs to one part (`topic.part`), this is done per part; a compulsory part can add a quick `sweep` to the plan.

## Adding a new exam session

1. Add the PDF under `question-papers/` and a row to `index.csv`.
2. In `data/<CODE>.json`, add the session to `sessions` and one entry per question to `questions` (`s`, `q`, `t`, `m`, `k` = `th`/`num`, `topic`).
3. Rebuild `app/data/papers.json` from `index.csv`, and `app/data/text/<CODE>.json` (the paper text for the in-app view) from the PDF.

Every ranking, chart and plan updates automatically.

## Adding a course

Create `app/data/<CODE>.json` in the same shape as `BCOC-131.json` and set `"ready": true` for it in `courses.json`.
