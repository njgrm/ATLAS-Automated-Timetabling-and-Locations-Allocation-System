# A3 packet c14 — School Year Setup: calm, plain, one next step

Base: `origin/main` at launch. New branch `work/a3-c14-year-setup-calm`, new worktree
`E:/ATLAS-worktrees/lane-a3-c14-year-setup`. Client only. Risk MEDIUM. Deadline: on main by **17:30**; demo Wed
2026-09-30. Loop: executor -> one fresh QA with REJECT_UX authority -> integrate -> post `ready for release`.
**Browser proof with REAL staging data** (staging QA login; staging is on 2023-2024 after a real rollover sync).
Shell calls are force-killed at 20 min.

## Operator direction (13:35)
"We need to continue improving UX/UI of year setup, it's still too technical and overwhelming." Older, mouse-first
schedulers; never dense, never intimidating, no guesswork or tedium.

## Ownership
`/admin/year-setup` page (`pages/AdminYearSetup.tsx` and `components/runtime/*` it renders) is yours for layout and
words. **A7 c7** (running, due 15:30) owns the rollover banner and the year-list *meaning* (id space; hiding or
marking the 2029-2032 drill years). Rebase on A7 c7 when it lands; do not change its logic.

## What the page must feel like
A scheduler opens it for one of three reasons. The top of the page answers the one that applies, in one sentence and
one button:
1. **All is well** — "This school year is 2023-2024 (Term 1). ATLAS matches EnrollPro." Nothing else competes.
2. **EnrollPro moved** — "EnrollPro has started 2023-2024. Start it in ATLAS too." -> one button, "Start 2023-2024",
   which previews first ("20 teachers, 20 sections; your rules and time windows come along") and then applies.
   The two carry switches are shown as plain sentences, on by default.
3. **Something needs attention** — one plain sentence naming the problem and who fixes it.

Everything else — term authority, drift status, fingerprints, semantic revisions, sync status codes, counts tables,
test-mode, reset/recovery tools, "persisted/unverified" — goes behind one quiet "Details for IT" fold, closed by
default. Past years: one short list ("2022-2023 — kept, view its timetable"). No raw codes (`TERM_AUTHORITY_MISSING`,
`atlas-stale`, `RUN_ROLLOVER_SYNC`) anywhere a scheduler can see.

"Verifying session…" / "Checking the school year now…" must never sit forever: after 8 s, say what is slow and offer
Retry (live today sat on "Checking the school year now…" and the preview button stayed disabled).

## Rules
- Subtract: the default view ends far shorter than today; count visible words before/after and report both.
- 1366x768 without page scroll for the default view.
- Browser rows for Lane C: default view on staging (2023-2024) at 1366; the Details fold closed by default; no raw
  code visible; the slow-check message appears after 8 s with Retry.
