# BCOMF Exam Prep — project rules

## Product rule (from the product owner — applies to every change)

Students use this tool to study **efficiently and effectively**. The tool must help them study; it must never create extra work or a long setup.

- **Help first, ask never (or last).** Every screen opens with something useful to study or read. Do not lead with questions, forms, scores or progress tracking.
- **Zero setup.** No required settings, profiles, sign-up or configuration before a student gets value. If an input is needed (e.g. time left for a plan), offer sensible one-tap choices with a ready answer already shown.
- **Explain the tool in one glance.** On first sight a student must understand what the app does and what it gives them (what to study first, notes, past papers, a plan) — in a few words, not a paragraph.
- **Shortest path to studying.** Course → what to study first → notes, in as few taps as possible. Past papers are one tap away from every course page (students value this highly).
- **Tracking is optional and silent.** At most a single tap (e.g. "Done") that never blocks or nags. No multi-step status selectors.
- **Less on screen.** Cut anything that does not help a student decide what to study or understand a topic.

Check every UI change against these rules before shipping.

## Other conventions

- Topic priorities are computed from tagged past-paper questions (`app/data/<CODE>.json`); never hand-set a priority.
- Priorities are guidance from past papers, never a guarantee — keep that wording.
- Not an official IGNOU product: no IGNOU logo or branding.
- Static site, no build step; test at phone width (390px) in light and dark mode before pushing.
