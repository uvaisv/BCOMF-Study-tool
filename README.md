# BCOMF Exam Prep

An exam-preparation tool for IGNOU BCOMF (B.Com Honours) students. It uses previous-year question papers to show which topics matter most, what to study first, and a plan for the time a student has left.

> An independent study aid — not an official IGNOU product. Priorities are based on past papers and are guidance, not a guarantee.

## What's in v1

- **Course picker** — Year 1–3 tabs and one search box (type `131` or `financial`).
- **BCOC-131 Financial Accounting**, analysed from 11 papers (Dec 2020 – Jun 2026):
  - **Priorities** — every topic ranked Critical / High / Moderate / Low, with the evidence (papers asked, average marks, a per-session strip) and a marks-by-block chart.
  - **Minimum preparation** — the smallest set of topics that covers enough marks to choose 5 questions.
  - **Topic pages** — key points, method for problems, formulas, answer structure, common mistakes, and every past question on the topic.
  - **Plan** — pick hours left and a mode (Exam today, Last minute, Score-oriented, Full) to get a timed schedule.
  - **Exam tips** — time plan, choosing questions, writing theory answers, presenting numericals.
  - **Progress** — mark each topic Learned / Practised / Revised; readiness is saved on the device.
- **BCOC-134 Business Mathematics and Statistics**, analysed from 11 papers. Its paper is split into parts (Q1 compulsory, then 2 of 4 from Part A and 2 of 4 from Part B), so the minimum preparation is worked out per part.
- Other courses show their exam format and past papers until their analysis is added.

## Run it

It is a static site — no build step.

```
python3 -m http.server --directory app 8000
```

Then open http://localhost:8000. To publish, enable GitHub Pages on the `main` branch (root); the root `index.html` redirects to `app/`.

## Layout

```
app/
  index.html, css/, js/app.js
  data/courses.json       all courses (year, exam format, paper count)
  data/papers.json        past-paper links per course (built from question-papers/index.csv)
  data/<CODE>.json        topics, study notes, exam tips and every past question tagged to a topic
question-papers/          200 official papers + index.csv (see its README)
```

## How priorities are calculated

For each topic, from the tagged questions in `data/<CODE>.json`:

- **avg** = total marks asked ÷ number of papers
- **recent** = the same over the latest 4 papers
- **score** = 0.6 × avg + 0.4 × recent
- Critical ≥ 15, High ≥ 10, Moderate ≥ 6, otherwise Low (marks per paper, out of 180 on offer)

The minimum set takes topics in score order until they cover the marks needed plus spare choice (`pattern.spare`, default 1.2 × questions × marks). When `pattern.parts` is set, this is done separately for each part that has a choice, counting only that part's questions; a compulsory part is covered by a definitions sweep in the planner.

## Adding a new exam session

1. Add the PDF under `question-papers/` and a row to `index.csv`.
2. In `data/<CODE>.json`, add the session to `sessions` and one entry per question to `questions` (`s`, `q`, `t`, `m`, `k` = `th`/`num`, `topic`).
3. Rebuild `app/data/papers.json` from `index.csv`.

Every ranking, chart and plan updates automatically.

## Adding a course

Create `app/data/<CODE>.json` in the same shape as `BCOC-131.json` and set `"ready": true` for it in `courses.json`.
