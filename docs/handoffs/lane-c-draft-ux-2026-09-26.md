# Lane C handoff — draft scheduler UX (DRAFT-UX-C01), 2026-09-26

**Stream:** manual draft placements / simple scheduler UX (operator report, 2026-09-25, run 318, Term 2).
**State:** integrated on `main` as `9f42190e` (2026-09-26); release pending (sequential after `861d89a2`).
Live is still `eb0e3038`.

## Refs

- Packet `docs/prompts/lane-c-draft-ux-c01-2026-09-25.md` (this branch, `docs/lane-c-draft-ux`).
- Base `d6ff9a44` · candidate `1670a611` (`work/lane-c-draft-ux-c01`, commits `f7d1098b`, `3e894d0e`, `1670a611`).
- Integration merge `b15050cb` on `integration/lane-c-draft-ux-c01-20260926` (parent `origin/main` `a7603540`; the
  client tree equals the candidate; `origin/main..b15050cb` = the three candidate commits + the merge only).
- Executor handoff `docs/handoffs/lane-c-draft-ux-c01-2026-09-25.md` (on the work branch).
- Operator screenshot (local, git-ignored):
  `E:/ATLAS-worktrees/lane-c-draft-ux-docs/qa-artifacts/lane-c-draft-ux-2026-09-25/operator-warning-cell-bottom-sheet-1917w.png`.

## Findings from reproduction (Chrome, 1366×768, read-only, 5/0/0)

- "Saved source data": **not the stall.** `/enrollpro-api/settings/public` and `enrollpro-uploads/…` 502;
  `tailscale status` shows `dev-jegs` offline (last seen 4 h, rx 0); curl to `dev-jegs`/`dev` timed out at 6 s.
  ATLAS points EnrollPro at `https://dev-jegs.buru-degree.ts.net/api`. Host/network issue, not ATLAS.
- Header had 10 controls; "Term"/"View type" labels; cells showed "Schedule note · N"; a warning cell opened a
  full-width bottom sheet on desktop with a wrong TIME card; no path to unassigned sessions in the simple layout.
- Whether run 318 has unassigned items is **unverified** (DB and in-page API reads were refused by the
  classifier as credential exploration).

## QA (atlas-qa, Opus) — ACCEPT_READY, S1–S6 6/6

NON_BLOCKING, carry into D1: (1) the task-bound primary (e.g. "Open Teaching Load" in plan-draft) is gone from the
header; verify the no-timetable plan-draft path; (2) unassigned **count** uses raw `termFilter` while the list uses
`effectiveTermFilter` + reason filter (`TimetableSimpleHeader.tsx:470-474`), so they can differ; (3) some
re-pinned rows moved from render to source-text assertions; (4) `draft-ux-c01.test.tsx` is only in its own
script (the existing "every client test file is named" failure is baseline). Executor defaults: plain session
click keeps the inline bar (dialog opens for warning cells and "View class details"); breakpoint 768 via new
`useMediaMinWidth`; published → status in the primary slot, "New version" in More.

## Cost (`subagent_tokens`)

Reproduction 58,530 (runner broke the no-spawn rule) + 107,208 (its nested runner) + 101,998 (rows) = 267,736;
atlas-search 79,187; executor 416,404; QA 117,082. Total for one accepted candidate ≈ 880k.

## Next (updated 2026-09-26, integration session)

1. **Done:** integration refreshed over `origin/main` `9a14295a` (merge `9f42190e`) and fast-forwarded to `main`
   (`9a14295a..9f42190e`). Worktrees `lane-c-draft-ux-c01`, `-int`, `-docs` retired (`RETIRE_AFTER_INTEGRATION`).
2. **Wait:** releases are **sequential** (operator, 2026-09-26): the `861d89a2` cutover
   (`docs/prompts/deploy-861d89a2-active-term-c02-2026-09-25.md`, other lane) first, then
   `docs/prompts/deploy-9f42190e-draft-ux-c01-2026-09-26.md` (HIGH; explicit operator approval; rollback
   basis `861d89a2`; client-only delta). E: 48 GiB free — reclaim first.
3. After the release: D1-S1…S5 + D1-N1/N2 via `atlas-browser-qa` on Claude in Chrome at 1366×768 and 390×844.
4. Open: EnrollPro `dev-jegs` offline; F1–F3; A3; remote `docs/lane-c-*` branches cannot be deleted (repo rule).

Integration session cost: planner only, no subagent dispatched (`subagent_tokens` 0).
