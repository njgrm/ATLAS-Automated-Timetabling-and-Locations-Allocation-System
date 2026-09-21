# DASHBOARD-TRUTH-C01 — Lane A (client) executor handoff

Part A only — the source change. No deployment, no release build, no browser, no
login, and no `atlas-server/**` file was read for edit or changed.

- **Base SHA:** `42beaa6b` (`origin/main`), clean worktree at start.
- **Candidate SHA:** `2a6cb06d` (`work/dashboard-truth-c01`).
- **Worktree:** `E:\ATLAS-worktrees\dashboard-truth-c01` (disposition `RETIRE_AFTER_INTEGRATION`).
- **Risk:** MEDIUM (displayed truth only). Part B deployment stays HIGH and untouched.

## Changed paths

Source commit `2a6cb06d` (5 files, +402/−46):

- `atlas-client/src/hooks/useDashboardData.ts`
- `atlas-client/src/pages/Dashboard.tsx`
- `atlas-client/src/lib/__tests__/dashboard-truth-c01.test.ts` (new)
- `atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts`
- `atlas-client/package.json` (test-script entry only)

Evidence commit adds this file under `docs/reviews/dashboard-truth-c01/`.

## What changed and why

The latest run's `GET /generation/:schoolId/:schoolYearId/runs/latest/violations`
report is **term-filtered HARD+SOFT** and has **no `totalCount`**
(`buildViolationReport` → `filterViolationsByTerm`, `generation.service.ts:1615-1672`).
The Dashboard presented that combined total (and the summary's combined
`generation.violationCount`) as "review blockers".

- **`useDashboardData.ts`** — removed `activeTermHardViolationCount` (a name that
  misstated both scope and severity) and added two truthful run-wide states,
  resolved from the **already-existing** violations request (no new network call):
  `runWideHardViolationCount` (`counts.runWide.blockingHard` → `counts.runWide.hard`,
  else `null`) and `runWideSoftViolationCount` (`counts.runWide.soft`, else `null`).
  `violationCount` (the server's combined total) and `hardViolationCount`
  (pre-existing cleared-state placeholder) are retained unchanged and are now
  consumed by no blocker surface.
- **`Dashboard.tsx`** — all four surfaces now read the run-wide HARD state:
  - **surface 1** lifecycle callout (`pickNextStep` REVIEW): HARD-only blocker
    language; SOFT acknowledged as warnings; `null` → explicit "Hard-violation
    count unavailable" and never routes to `/schedules`.
  - **surface 2** checklist "Timetable generated and reviewed": `done` is
    `COMPLETED && hard === 0` (A3: SOFT-only no longer blocks); hint is
    hard-only/warnings/unavailable.
  - **surface 3** header tile: extracted `RunBlockerTile` — "No hard violations
    · N warnings acknowledged" / "N run-wide review blockers" / explicit
    "Hard-violation count unavailable".
  - **surface 4** term popover row: extracted `ActiveTermHardViolationsRow`,
    labelled "Hard violations (run-wide)"; zero renders no figure, `null` renders
    explicit "Unavailable".

No server-side count meaning changed; no new request; generation/publication
behaviour untouched. All existing assertions preserved; `pickNextStep` fixtures
were renamed additively to the new contract.

## Hard-count provenance (route + service)

`generation.router.ts:330-361` (`runs/latest/violations`) → `buildViolationReport`
(`generation.service.ts:1615-1649`) → `counts.runWide.blockingHard` (`:1643`,
allowlist-filtered HARD), `counts.runWide.hard` (`:1641`), `counts.runWide.soft`
(`:1644`). Client precedence mirrors `resolveHardViolationCount`
(`useTimetableData.ts:164-173`); unlike that helper it returns `null` (never a
term-filtered `violations.length`) when no run-wide count exists. The report's
top-level `violations`/`counts.total` are the term-filtered HARD+SOFT display
list and are never used as a blocker count.

## Decisive commands actually run

| Command | Result |
|---|---|
| `npm run test:dashboard-truth-c01` **before the fix** | **13 tests / 0 pass / 13 fail** (failing-first, literal below) |
| `npm run test:dashboard-truth-c01` after the fix | **13 tests / 13 pass / 0 fail** |
| `npm run typecheck` (`tsc --noEmit`) | exit 0, no diagnostics |
| `npm run test:derived-setup-ux` | 23 / 23 / 0 |
| `npm run test:uxc01r` | 38 / 38 / 0 |
| `npm run test:ux-guardrails` | 21 / 21 / 0 |
| `npm run test:client-quality` | 34 / 34 / 0 |
| `npm run test:timetable-operator-ux` | 58 / 58 / 0 |
| `npm run test:timetable-sync-setup` | 6 / 6 / 0 |
| `npm run test:timetable-route-keys` | 57 / 57 / 0 |
| `npm run test:dup-read-callers` | 68 / 68 / 0 |
| `npm run test:derived-setup-readiness` | 15 / 15 / 0 |
| `npm run test:published-revision` | 4 / 4 / 0 |
| `git diff --cached --check` | exit 0 |

Pre-existing, out of scope: `test:auth-session` and `test:timetable-conflict`
name files deleted by `4794bd9e` (`auth-session.test.ts`,
`timetable-live-conflict.test.ts`, `tactical-sandbox-dock-helpers.test.ts`), so
`tsx` exits "Could not find". This is identical on the base and unrelated to this
change (the ATLAS §11 stale-script precedent); it was not repaired here because
it is outside this stream's authorized delta.

## S1–S5 results

- **S1 — PASSED.** All four surfaces render hard-only blocker language; with the
  0 HARD / 335 SOFT fixture no surface renders a blocker claim and surface 4
  renders no non-zero "Hard violations" figure. Failing-first control included
  (13/13 fail pre-fix). Null/unavailable control included; per-surface statement
  below.
- **S2 — PASSED.** The SOFT total is shown only as warnings ("335 warnings
  acknowledged") or omitted; the combined total is never labelled as blockers
  (the Dashboard no longer consumes it — asserted by a source guard).
- **S3 — PASSED.** With zero HARD and non-zero SOFT the "Timetable generated and
  reviewed" step reads `done` (asserted), and the callout does not describe the
  run as blocked.
- **S4 — PASSED.** No new network request (the existing `runs/latest/violations`
  request is reused); no server file touched; no count meaning changed; no
  existing assertion deleted or weakened (fixtures renamed additively, all
  original assertions retained and passing).
- **S5 — PASSED.** The new test file is reached by the committed
  `atlas-client/package.json` script `test:dashboard-truth-c01` in the same
  commit; client type-check passes; the committed client suites above pass.

## Per-surface `null`/unavailable behaviour

| Surface | When the run-wide HARD count is unavailable (`null`) |
|---|---|
| 1 — lifecycle callout (`pickNextStep` REVIEW) | explicit strings: title "Confirm the latest run", warn "Hard-violation count unavailable"; href `/audit?focus=timetable` (never `/schedules`) |
| 2 — checklist "Timetable generated and reviewed" | `done: false`; hint "Hard-violation count is unavailable — open the timetable to confirm" |
| 3 — header tile (`RunBlockerTile`) | explicit "Hard-violation count unavailable" |
| 4 — term popover row (`ActiveTermHardViolationsRow`) | row rendered with explicit "Unavailable" figure under "Hard violations (run-wide)" |

No surface renders `0` or "No blockers"/"No hard violations" when the count is
unavailable.

## Failing-first (literal, before the fix)

Command: `npm run test:dashboard-truth-c01` (run against base `42beaa6b` source).

```
✖ DTC01-A1: the run-wide HARD count prefers blockingHard, then hard — never the combined total
    TypeError: resolveRunWideHardViolationCount is not a function
✖ DTC01-A1 null control: a report without run-wide counts resolves to null, never 0 or a term-filtered length
    TypeError: resolveRunWideHardViolationCount is not a function
✖ DTC01-A2: the run-wide SOFT warning total resolves truthfully, null when absent
    TypeError: resolveRunWideSoftViolationCount is not a function
✖ DTC01-S1 surface 1 (lifecycle callout): 0 HARD / 335 SOFT never claims blockers and states the warnings
    AssertionError: the acknowledged SOFT total must not be silently dropped
    actual: 'Generation finished with no hard violations. Confirm the result and publish it.'
✖ DTC01-S1 surface 1 null control: an unresolved HARD count never reads as clean or publishable
    AssertionError: null must never render as a clean "no hard violations" claim
    actual: 'Review and publish the schedule Generation finished with no hard violations. Confirm the result and publish it. '
✖ DTC01-A3/S3 ... (buildRunReviewChecklistItem is not a function)
✖ DTC01-S1 surface 2 ... (buildRunReviewChecklistItem is not a function)
✖ DTC01-S1 surface 2 null control ... (buildRunReviewChecklistItem is not a function)
✖ DTC01-S1 surface 3 (header tile) ... (Element type is invalid: ... got: undefined)
✖ DTC01-S1 surface 3 non-zero ... (Element type is invalid)
✖ DTC01-S1 surface 3 null control ... (Element type is invalid)
✖ DTC01-S1 surface 4 (term popover) ... (Element type is invalid)
✖ DTC01-A1 source: the Dashboard no longer consumes the combined violation total as blockers
    AssertionError: the tile/checklist must source the run-wide HARD state
ℹ tests 13  ℹ pass 0  ℹ fail 13
```

## Risks

- `NON_BLOCKING` — the run-wide counts are fetched only when an active term
  (`termIndex`) and active school year are present (the pre-existing request's
  gate). Without them the surfaces correctly show "unavailable" rather than a
  number. A non-privileged viewer (403 on the violations route) also gets
  "unavailable" — truthful, fail-closed.
- `NON_BLOCKING` — `test:auth-session` / `test:timetable-conflict` reference
  files deleted at `4794bd9e`; pre-existing on the base, not caused by this
  change, not repaired here.
- `NON_BLOCKING` — `hardViolationCount` and `violationCount` remain exported by
  the hook but are consumed by no blocker surface; retained (not removed) to keep
  the change additive and avoid deleting existing assertions.
- `NON_BLOCKING` — no production `vite build` was run (the fail-closed
  `VITE_ENROLLPRO_URL` guard and the instruction not to start a release build);
  type-check plus the committed suites are the source-row harness.

## Verdict

`REVIEW_REQUIRED` — one immutable candidate `2a6cb06d`.
