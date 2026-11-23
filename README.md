# BCom Radar

An exam-preparation tool for IGNOU BCOMF (B.Com Honours) students. It uses previous-year question papers to show which topics matter most, what to study first, and a plan for the time a student has left.

> An independent study aid — not an official IGNOU product. Priorities are based on past papers and are guidance, not a guarantee.

## What it does

Built around one rule (see `CLAUDE.md`): **help students study — never add setup or extra work.**

- **About** (Settings): version, disclaimer, and **Sources & credits** — question papers © IGNOU (from webservices.ignou.ac.in), notes in our own words pointing to IGNOU's eGyanKosh material (CC BY-NC-SA), our own MCQ answers, a note that visits are counted anonymously (Vercel Web Analytics: app opens plus Home, course and topic pages, live site only), a note that students are counted by a random device code sent once a day with the open year (to CMA Radar's counter, live site only), and a contact for rights holders.
- **Welcome screen**: on the first open only, an animated full-screen welcome says what the app gives (ranked topics, notes, diagrams, past papers, a plan), with an *Install the app* button; tap anywhere to continue.
- **Launch screen**: on every later open, the logo with a radar ring and a real past-paper fact ("Sale of Goods Act came up in every one of the last 11 BCOC-133 papers" — the student's last course first) full screen on the app's own background (the phone's status bar matches it meanwhile). It holds for 3 seconds from opening (longer only while the page is still loading); *Tap to skip* closes it at once. Then the logo moves up into the header while the header, tab bar and page fade in.
- **Navigation**: a bottom bar (**Home · Search · Ask AI · Settings**) on every screen, and a back arrow with the parent page's name in the header on every inner page (it uses the browser's Back when that is the parent, so the scroll position comes back).
- **Home**: the course list by year. Once a topic has been opened, a one-line **Continue** strip above it leads to that topic (or, once it is done, the next "study first" topic). Course rows show the topic count, or *2 of 7 must-study done* with a small bar once started. On the first 3 opens, a small card offers to install the app (✕ hides it for good).
- **Search** finds courses, topics (with their priority) and past questions across all courses, from `app/data/search.json`.
- **Course page**: compact header (facts as chips), tabs on one row that stick under the header (Study · Past papers · Plan · Exam tips; switching tabs doesn't add to Back), then **Study these first** — the smallest set of topics that has carried enough marks to answer the paper (per part when the paper is split into parts), with *Start/Next: topic*, a thin progress line once something is done, and *Quick revision* cards. Each topic row has a round check (one tap marks it done) and small bars showing which past papers asked it.
- **How ready am I?** Once a topic is marked done, a card under *Study these first* replays every past paper of the course against the done topics: roughly how many marks the student could have written on average (choosing their best questions), in how many papers they could have answered everything the paper asks for, and the one topic that would add the most next. *See it paper by paper* (`#/c/<code>/ready`) switches between **Marks** and **Full answers**, shows each paper as a chip, and breaks one paper down question by question (each opens in the app). A question counts as answerable when the done topics carry at least 75% of its marks (in "any N of M parts" questions, found in the paper text and listed in `data/choices.json`, knowing N parts is the whole question); papers split into sections are checked section by section; MCQ and all-compulsory papers show marks only. The logic is `readiness()` / `bestNext()` in `js/analysis.js`. It describes past papers, never a prediction.
- **Topic page**: a study-style switch at the top (**Full** — the default, the notes as written · **Short** · **Examples** — the notes plus worked examples · **Visual**), where the topic is in the IGNOU study material, **Asked as** (the top 3 past questions; *See all* opens the full list), section chips that jump to and follow each part (points, examples, diagram, method, formulas, answer, mistakes), and a **Revise** mode (the topic's points, formulas and mistakes as swipe cards). A bar at the bottom holds *Ask AI*, *Mark as done* (with Undo) and *Next*. Diagrams: all BECC-101 topics; product life cycle, break-even chart, stress–performance curve; time-series trend and components, correlation scatter plots, regression lines, cash flow statement, DuPont ratio tree; stock levels, EOQ, variance tree, Maslow's pyramid, communication process, control cycle, line and staff chart, channel levels, buying and selling processes, heads of income, data abstraction, supply chain flows, accounting process, SLM vs WDV, and the BECS-184 statistics figures.
- **Past question**: opens **just that question inside the app** — term, question number, printed marks and the part asked — with a link to its topic's notes, ‹ › to move through the same paper, *Ask AI to solve this*, and a link to download the full paper.
- **Plan**: one tap for the time left (3 hours, 6 hours, 2 days, 1 week). Times start from now (for the short plans), each topic has a tick box (ticking marks it done), and topics already done are left out.
- **Settings**: one short screen of groups — Study (study style), Display (theme, text size, density as switches), AI assistant (key), App (install, welcome screen) and Help (feedback, creators, about and disclaimer). Rows open their own page (`#/settings/style`, `ai`, `feedback`, `creators`, `about`).
- **Ask AI** (bottom bar, the ✦ button on topic pages, *Ask AI to solve this* on past questions): an optional study assistant on Google Gemini using the student's **own free API key**, saved in Settings → AI assistant (checked with Google before it is saved). The chosen course and topic notes are sent with each question so answers stay consistent with the notes; answers stream in and are rendered from Markdown with all model text escaped. The question box stays at the bottom of the screen. Calls go straight from the browser to `generativelanguage.googleapis.com`; the key is kept only in that browser's localStorage. If the saved model is retired, the app picks the newest stable Flash model from the key's model list and remembers it. A model the student chooses in Settings → AI assistant is never replaced behind their back: if Google has no such model for the key, only that question is answered with the newest model, the answer says so, and the choice stays. If Google answers with a server error (5xx, usually a busy or brand-new model), the app waits a moment and tries the same model once more, then one older stable Flash model for that question only, and says under the answer which model replied; the student's saved model is not changed, and a 429 (free limit) or a key error is never retried. `#/ai-guide` explains how to create a key in Google AI Studio, the free-tier limits, privacy on the free tier, and keeping the key secret.
- **Installable**: *Install app* in Settings (or the welcome screen) shows the browser's install prompt on Android, or short steps for iPhone and in-app browsers. Installed, it opens full-screen; pages already opened still load offline.
- **Motion**: taps shrink slightly, pages fade up, switches slide, Done draws a check — all short, and off when the phone asks for reduced motion.

Courses with full analysis: all 8 Year 1 courses (BCOC-131, BCOC-132, BECC-101, BRL-101, BCOS-183, BCOS-186, BEVAE-181, BEDSV-101), all 8 Year 2 courses (BCOC-133, BCOC-134, BCOC-136, BCOE-141, BCOS-184, BCOS-185, BEGAE-182, BPAS-184), and all 8 Year 3 courses (BCOC-135, BCOC-137, BCOC-138, BCOE-142, CPI-102, BPCS-186, BMS-1, and BECS-184 Data Analysis, taken instead of the internship). BEVAE-181 is an MCQ paper: its 550 past questions are tagged by topic, and questions repeated across papers are listed on the course page. Most MCQs have an answer (`answers` in `BEVAE-181.json`, shown behind **Show answer** on the question and inline in the repeated list). IGNOU publishes no answer key, so these are our own answers, labelled as such. Answers that depend on IGNOU's own wording were checked against the IGNOU BEVAE-181 study material; 11 questions it does not settle (or that are misprinted) have no answer. Other courses show their past papers until their analysis is added.

## Google Search

`app/index.html` carries a search description, a canonical address and link-preview (Open Graph) tags; `robots.txt` and `sitemap.xml` sit at the site root. They all use the live address `https://bcomradar.vercel.app` — if the site moves to its own domain, replace that address in `index.html`, `app/index.html` and `robots.txt`, and in `SITE` at the top of `tools/build_pages.js`, then rebuild the pages.

The app uses `#` addresses, which Google treats as one page. So every course and topic also gets a plain web page under `notes/` (`notes/<code>/` and `notes/<code>/<topic>/`), with the notes, worked examples, diagrams and past questions, each linking back into the app. These pages and `sitemap.xml` are **generated** from `app/data` — never edit them by hand:

```
node tools/build_pages.js          # rebuild notes/ and sitemap.xml
node tools/build_pages.js --check  # fails if they are out of date
```

Run it after every change to `app/data/*.json` or `app/js/figures.js`, and commit the result.

Search Console: the site is verified with the `google-site-verification` tag in `index.html` and `app/index.html` (keep it), and `sitemap.xml` is submitted there.

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

To publish on Vercel, import the repo with Framework Preset **Other**, no build command, and the Root Directory left as the repo root: `vercel.json` sends the root address to `app/` with a permanent (308) redirect, and `trailingSlash` sends `/app` and other folder paths to their `/`-ending form (the root `index.html` still forwards to `app/` when the site is served elsewhere), and the paper downloads are served from `question-papers/` (named `<CODE> <Mon YYYY>.pdf`). Every push to `main` then updates the site.

**Security** (`vercel.json`): every page is sent with a Content-Security-Policy that allows scripts, styles and data only from the site itself, plus the Gemini API for Ask AI; no inline scripts or `on…=` handlers run, and no other site can show BCom Radar in a frame. `.vercelignore` keeps repo files that are not part of the website (CLAUDE.md, README.md, tools/, firebase.json, the papers' README and index.csv) off the site.

## Layout

```
app/
  index.html, css/, js/app.js
  js/boot.js              runs before the first paint (app and notes pages): saved theme and text size, launch screen
  data/summary.json       generated: each course's "study first" topics (Home progress, Continue) and its most-asked topic (launch screen fact)
  data/search.json        generated: courses, topics and past questions for Search
  data/choices.json       generated: questions with an internal choice ("any 4 of 6"), for the readiness check
  js/analysis.js          topic priorities, shared by the app and tools/build_pages.js
  js/figures.js           topic diagrams, drawn as SVG from equations; a topic lists them in "figures"
  manifest.webmanifest, sw.js, icons/   home-screen app: name, icon, full-screen launch, offline cache
  data/courses.json       all courses (year, exam format, paper count)
  data/papers.json        past-paper links per course (built from question-papers/index.csv)
  data/<CODE>.json        topics, study notes, exam tips and every past question tagged to a topic
  data/text/<CODE>.json   each paper's English questions as text, for the in-app paper view
  qimg/<CODE>/            question images for papers whose maths does not survive as text (BCOC-134)
question-papers/          228 official papers + index.csv (see its README)
notes/                    generated web pages per course and topic (tools/build_pages.js)
tools/build_pages.js      builds notes/, sitemap.xml, app/data/summary.json and app/data/search.json from app/data
vercel.json, .vercelignore   security headers for every page; repo files kept off the site
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
4. Run `node tools/build_pages.js` to update the web pages and sitemap.

Every ranking, chart and plan updates automatically.

## Adding a course

Create `app/data/<CODE>.json` in the same shape as `BCOC-131.json`, set `"ready": true` for it in `courses.json`, then run `node tools/build_pages.js`.
