# BCOMF Exam Prep

An exam-preparation tool for IGNOU BCOMF (B.Com Honours) students. It uses previous-year question papers to show which topics matter most, what to study first, and a plan for the time a student has left.

> An independent study aid — not an official IGNOU product. Priorities are based on past papers and are guidance, not a guarantee.

## What it does

Built around one rule (see `CLAUDE.md`): **help students study — never add setup or extra work.**

- **Home** says in one glance what the app gives: ranked topics, short notes, past papers, a study plan. Pick a year or search `131` / `financial`.
- **Course page** opens straight on **Study these first** — the smallest set of topics that has carried enough marks to answer the paper (worked out per part when the paper is split into parts). Then the latest past papers (one tap to the PDF) and the other topics in priority order.
- **Topic page**: key points, how to solve, formulas, how to write the answer, common mistakes, and every past question on it with a link to the paper. **Next topic** keeps you moving; **Mark as done** is optional.
- **Plan**: one tap for the time left (3 hours, 6 hours, 2 days, 1 week) and the schedule is there — no settings.
- **Exam tips** and **Past papers** tabs.

Courses with full analysis: BCOC-131, BCOC-132, BECC-101, BCOS-183 (Year 1) and BCOC-134 (Year 2). Other courses show their past papers until their analysis is added.

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

The minimum set takes topics in score order until they cover 1.2 × the marks a student must answer (`pattern.spare` overrides 1.2). When the paper has parts and every topic belongs to one part (`topic.part`), this is done per part; a compulsory part can add a quick `sweep` to the plan.

## Adding a new exam session

1. Add the PDF under `question-papers/` and a row to `index.csv`.
2. In `data/<CODE>.json`, add the session to `sessions` and one entry per question to `questions` (`s`, `q`, `t`, `m`, `k` = `th`/`num`, `topic`).
3. Rebuild `app/data/papers.json` from `index.csv`.

Every ranking, chart and plan updates automatically.

## Adding a course

Create `app/data/<CODE>.json` in the same shape as `BCOC-131.json` and set `"ready": true` for it in `courses.json`.
