# Workflow metrics (Lane C) — one row per finished planner cycle

Purpose: judge the agentic workflow by outcomes, not activity (operator, 2026-09-28). Lane C appends a row at each cycle
exit and reviews trends after every 3 rows; each process change is logged below with the metric it should move.

| Date · lane · cycle | Rules | Wall time | Fixes seen live (Codex/staging) | Integrated not seen | Dropped | Review rounds (max) | Release stalls | Notes |
|---|---|---|---|---|---|---|---|---|
| 09-27→28 · A2/A3 · c0–c10 overnight (baseline) | pre-b8e6bda7 | ~18 h | 6 (4c35cc8f) | ~40 | — | 4+ | 3 (c9, c10, c12) | A3 ledger inflated 4 rows |
| 09-28 · A4 · release #1 | A4 §14 | ~45 min | pending Lane C rows | — | 0 | 2 | 0 | first-try ship 7590d485 |
| 09-28 · A4 · staging | A4 §14 | ~40 min | n/a | — | 0 | 1 | 0 | 26 s deploy; 3 BLOCKING script guards from Codex review |
| 09-28 · A2 · c11 slice 1 | pre-b8e6bda7 | ~3 h | pending staging walk | D, M1–M5 | 0 | 4 | — | first slice on draft/manual flow |

## Process changes and the metric each should move
- 2026-09-28 a981032b — A4 release lane → release stalls ↓, A2 wall time on product ↑.
- 2026-09-28 b8e6bda7 — 2 review rounds; original-words grading; fixes-live metric; staging first → review rounds ≤ 2, fixes seen live per cycle ↑.
- 2026-09-28 — Codex does all browser rows (fresh run each) → Lane C tokens per accepted fix ↓.
- 2026-09-28 — split A3 into A3/A5/A6 by screen → fixes live per wall-hour ↑; watch merge conflicts.
