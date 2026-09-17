# CLIENT-QUALITY-C01 — execution evidence (2026-09-17)

- **Stream:** `CLIENT-QUALITY-C01`
- **Worktree:** `E:/ATLAS-worktrees/client-quality-c01`
- **Branch:** `work/client-quality-c01`
- **Base SHA:** `11de142b47ee044122d2d364e4c6f5be214f38e4` (`origin/main`; register/activation commit over spec base `74f4e66e`)
- **Directive:** `origin/main:AGENTS.md`, blob `09ede31cbb133ed424039049cbaf44382dd3e4bf`, LF-SHA-256 `3ef09bb64eb623a6c7412fb98549c9143e16589739628656036b19c144a70d79`
- **Risk:** MEDIUM (source). The release swap that ships these fixes is a separate HIGH action and was **not** performed.
- **Candidate history:** first candidate `649948ecd40cef509f1eca2ac58006cf6eeda6df`; this document is updated by the additive correction commit that unblocks the ESLint rows (its SHA is the correction candidate reported in the handoff).

## Correction round summary

The first candidate reported the three ESLint rows BLOCKED because `npm install` /
`npm ci` are denied for the executor role and both application `node_modules`
entries are junctions into other worktrees (installing there would write through
into another worktree's tree). The primary planner provisioned a **scoped,
reproducible toolchain** at `ops/lint/toolchain/` with its own committed
`package-lock.json`. This correction wires it, runs the three rows with real exit
codes, replaces the AST-estimated ratchet baseline with the ESLint-verified one,
and re-runs every previously-passing row.

**Tally after correction: MANDATORY_SOURCE 9/9 PASS; MANDATORY_LIVE 2/3 PASS with
1 BLOCKED_EXTERNAL (the separate HIGH release swap); DEFERRED_EXTERNAL 1.**

## Scoped toolchain (provisioned by the planner, committed by this correction)

- `ops/lint/toolchain/package.json` — pins `eslint ^9`, `typescript-eslint ^8`, `eslint-plugin-react-hooks ^5`.
- `ops/lint/toolchain/package-lock.json` — committed; reproducible without touching the app dependency tree.
- `ops/lint/toolchain/node_modules/` — installed; **gitignored** (explicit `.gitignore` entry at line 77) and never committed.
- Resolved versions: `eslint 9.39.5`, `typescript-eslint 8.70.0`, `eslint-plugin-react-hooks 5.2.0`, `typescript 6.0.3`.
- The correction ran **no install**. The application `node_modules` trees remain the
  read-only junctions recorded below and are byte-unchanged.

**Wiring.** The root `lint` script is
`node ops/lint/toolchain/node_modules/eslint/bin/eslint.js atlas-client/src`.
It resolves ESLint's JS entry through `node` rather than the literal
`ops/lint/toolchain/node_modules/.bin/eslint` shim because `cmd.exe` mangles
forward-slash paths to the `.bin` shim (`'ops' is not recognized as an internal or
external command`); the JS entry is the exact scoped binary and is cross-platform.
`eslint.config.js` resolves its plugins with `createRequire` rooted at
`ops/lint/toolchain/package.json`, because `typescript-eslint` is `exports`-only
(no `main`), so a direct relative directory `require` fails. Both choices work
from a clean checkout after only the scoped install.

## Gate results (real exit codes)

| # | Class | Gate | State | Evidence (this correction) |
|---|---|---|---|---|
| S1 | SOURCE | `eslint.config.js` loads and reports the baseline | **PASS** | `npm run lint` → **exit 0**; 0 errors, 65 `react-hooks/exhaustive-deps` warnings |
| S2 | SOURCE | hook-after-early-return fixture → lint nonzero | **PASS** | fixture eslint **exit 1**, `react-hooks/rules-of-hooks`; verifier exit 0 |
| S3 | SOURCE | new explicit-`any` fixture → lint nonzero | **PASS** | fixture eslint **exit 1**, `@typescript-eslint/no-explicit-any`; verifier exit 0 |
| S4 | SOURCE | client `typecheck` exits 0 | **PASS** | `npm run typecheck` → **exit 0** (rerun) |
| S5 | SOURCE | `#310` fails before the hoist | **PASS** | pre-hoist mutant → regression **exit 1**; live smoke React #310 on `/timetable` |
| S6 | SOURCE | `remainingHours` null path fails before guard | **PASS** | dereference mutant → **exit 1**, exact `TypeError` |
| S7 | SOURCE | client build succeeds | **PASS** | `vite build` → **exit 0** (rerun) |
| S8 | SOURCE | focused suites pass, no assertion removals | **PASS** | 645/645 (71 files) → **exit 0** (rerun) |
| S9 | SOURCE | `git diff --check` clean | **PASS** | exit 0 (range check at closure) |
| L1 | LIVE | smoke fails on the live deployment, naming `/timetable` | **PASS** | run exit 1; 4× React #310, all on `/timetable`, every other route clean |
| L2 | LIVE | every route passes once the release is live | **BLOCKED_EXTERNAL** | requires the separate HIGH release swap; not performed |
| L3 | LIVE | zero mutation via before/after signatures | **PASS** | read-only census: only the two login rows changed |
| D1 | DEFERRED_EXTERNAL | release swap | **DEFERRED** | separate HIGH action, not performed |

## S1 — config loads and reports the baseline

```
> atlas@1.0.0 lint
> node ops/lint/toolchain/node_modules/eslint/bin/eslint.js atlas-client/src
✖ 65 problems (0 errors, 65 warnings)
LINT_EXIT=0
```

The 65 warnings are all `react-hooks/exhaustive-deps` (configured `warn`). There
are **0 errors**: every `@typescript-eslint/no-explicit-any` occurrence is inside
a baselined file and within its recorded count.

## S2/S3 — negative-control fixtures (durable, committed)

Fixtures live under `ops/lint/fixtures/` (deliberately broken, excluded from the
default lint target) with a dedicated `ops/lint/fixtures/eslint.config.cjs` and a
repo-owned verifier `ops/lint/verify-fixtures.cjs`.

```
S2  ops/lint/fixtures/hook-after-early-return.tsx
    18:20  error  React Hook "useCallback" is called conditionally … react-hooks/rules-of-hooks
    S2_EXIT=1
S3  ops/lint/fixtures/new-explicit-any.tsx
    9:59  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
    S3_EXIT=1
npm run test:lint-fixtures → PASS 2/2, VERIFIER_EXIT=0
```

The verifier exits nonzero if either rule stops firing, so `test:lint-fixtures`
is a real regression, not a one-off probe.

## Corrected ratchet baseline (ESLint-verified, not estimated)

The first candidate's baseline was a TypeScript-AST census (39 files / 208
`TSAnyKeyword` nodes). Running the official rule over 381 client files emitted:

```
REAL_OFFENDER_FILES=39  REAL_TOTAL=208  BASELINE_KEYS=39  DIFFS=0
```

The real per-file counts **match the estimate exactly** — there was no numeric
correction to make, and I am stating that explicitly. The committed
`ops/lint/no-explicit-any-ratchet.json` metadata now records
`method: typescript-ast-census+eslint-verified`, `verifiedWith` (eslint 9.39.5 /
typescript-eslint 8.70.0 / eslint-plugin-react-hooks 5.2.0), and the real
`clientFilesScanned=381`. No baseline count was raised or widened.

## Ratchet-only-decreases proof

| Control | Command | Result |
|---|---|---|
| New `any` in a previously-clean file (`RouteErrorBoundary.tsx`) | `eslint atlas-client/src/components/RouteErrorBoundary.tsx` | **exit 1** — `@typescript-eslint/no-explicit-any` at 6:21 |
| Removing the one `any` in a baselined file (`TeacherGridMode.tsx`, baseline 1 → actual 0) | `eslint … TeacherGridMode.tsx` | **exit 0** — decrease is tolerated |
| Adding a second `any` to that same baselined file (actual 2 > baseline 1) | `eslint … TeacherGridMode.tsx` | **exit 1** — `atlas-ratchet/no-explicit-any-ratchet`: "has 2 `any` node(s) but the ratchet baseline allows 1" |

Every temporary mutation was restored byte-exact (SHA-256 verified) before the
next step; the final `npm run lint` re-run is exit 0.

## Two pre-existing violations fixed (no rule weakened)

Running the new gate surfaced two pre-existing client errors. Both were fixed
without weakening any rule:

1. `atlas-client/src/components/CampusMapEditor.tsx` carried a stale
   `{/* eslint-disable-next-line jsx-a11y/alt-text */}` above a react-konva
   `<Rect>`. The `jsx-a11y` plugin is not part of the scoped toolchain, so ESLint
   9 reported "Definition for rule 'jsx-a11y/alt-text' was not found." as an
   error. The directive was inert (it targeted a canvas `Rect`, not an `<img>`)
   and was removed.
2. `atlas-client/src/hooks/__tests__/useTimetableCollaboration.test.ts` is a
   manual test renderer that invokes the production hook from a plain `render()`
   helper across simulated renders, so the call site is neither a component nor a
   custom hook. It is recorded in the new checked-in
   `ops/lint/rules-of-hooks-baseline.json` with its rationale (renaming the helper
   to a `use`-prefix would make every `harness.render(...)` call site inside a
   `node:test` callback look like a hook call). `react-hooks/rules-of-hooks`
   remains `error` everywhere else.

No assertion or rule was removed; the ratchet baselines only ever cap existing
counts.

## Previously-passing rows re-run (not restated)

- **S4** `npm run typecheck` → exit 0.
- **S5** pre-hoist mutant → `#310` regression exit 1 (restored byte-exact).
- **S6** dereference mutant → null-path regression exit 1, `TypeError: Cannot read properties of null (reading 'remainingHours')` (restored byte-exact).
- **S7** `npm run build` → exit 0 (no `DashboardCharts` chunk).
- **S8** full tracked client inventory **645/645 pass, 0 fail, exit 0** (71 files), including the focused `test:client-quality` suite.
- **S9** `git diff --check` → exit 0.

## Fix inventory (unchanged from the first candidate)

1. `ScheduleReviewWorkspace.tsx` — `armSwapSessions` hoisted above the early returns.
2. `TeacherGridMode.tsx` — `loadProfile: LoadProfile | null`; null-safe capacity helper.
3. `WorkloadInspector.tsx` — `loadProfile?.remainingHours?.toFixed(1) ?? '0.0'`.
4. `faculty-assignment-helpers.ts` — new `remainingCapacityMinutesForLoadProfile`.
5. `RouteErrorBoundary.tsx` (new) + `App.tsx` `errorElement`.
6. `rollover-awareness.ts` — bounded expiry + `clearRolloverAwarenessNotice`.
7. `AppShell.tsx` — banner dismiss control.
8. `TeachingLoad.tsx` — in-page `Archived load` control; compact truth strip always available.
9. `TeachingLoadTruthPanel.tsx` — collapsed-by-default `@/ui` Accordion.
10. `Dashboard.tsx` — Run Health card and `DashboardCharts*.tsx` removed.
11. `atlas-client/package.json` — `typecheck`, `test:client-quality`.
12. Root `package.json` — `lint`, `test:visual:route-smoke`, `test:lint-fixtures`; `.gitignore` exceptions.

## Deliberately updated guarded contracts (justified)

1. `tl-operator-workspace-c05-r3-truth.test.ts` — the `[@media(max-height:640px)]:hidden` assertion is replaced by an assertion that the panel renders the `@/ui` Accordion disclosure with a one-line summary and is not hidden on short viewports. Justification: the panel is now collapsed to one line, which is what reclaims the vertical space; hiding the compact summary would contradict the "keep a one-line summary" contract. All canonical-metric, zero-write, and shadcn-control assertions are preserved.
2. `rollover-ui-guardrails.test.ts` — new assertion that the banner is dismissible (`rollover-awareness-dismiss` → `clearRolloverAwarenessNotice`) and expires via `ROLLOVER_NOTICE_TTL_MS` / `isRolloverNoticeExpired`. Justification: the banner previously re-hydrated forever with no dismiss control. No existing assertion removed.

## Live smoke (unchanged evidence from the first candidate)

`npm run test:visual:route-smoke` against `https://njgrm.buru-degree.ts.net`
failed (exit 1) with exactly four `react-error` entries, all on `/timetable`:

```
"route": "/timetable", "name": "ScheduleReview",
"failures": [
  "react-error: Error handled by React Router default ErrorBoundary: Error: Minified React error #310; …",
  "react-error: Error: Minified React error #310; … at Object.gs [as useCallback] (…/assets/index-BpNxUQA8.js:9:48794)"
]
```

Every other route reported an empty `failures` array; `window.location.origin`
was asserted as `https://njgrm.buru-degree.ts.net` on every route. This correction
did **not** re-run the live crawl and performed **zero logins**.

## Login disclosure (from the first candidate; none added since)

Two smoke-spec runs each performed exactly one login. Observed delta:
`audit_logs` `260 → 262` (rows 812, 813 = `LOCAL_LOGIN_SUCCESS`, actor `46`);
`atlas_auth_accounts.last_login_at` max → `2026-09-17 19:15:15.23`. No credential
was printed or committed.

## Zero-mutation signature (from the first candidate)

Read-only `SELECT` census over all 46 public tables inside
`BEGIN TRANSACTION READ ONLY` (DSN never printed):

```
BEFORE_HASH=04206126d3d913aa2371a315aa7e8bf57fae0d1772d2625e35cb1274dc0d62d7
AFTER_HASH =099c5cb22caa72d9f9b072094c79dcc77460a3146d36889db6dc864f0a5c7d12
CHANGED audit_logs : count 260 → 262 ; maxId 811 → 813
CHANGED atlas_auth_accounts.last_login_at
(45 other tables: delta 0)
```

This correction performed no live action at all: no login, no runtime, database,
generation, publication, Teaching Load, term-cache, rollover, migration, or
companion change. **No install was run and no lockfile was created or modified.**
The application dependency tree is byte-unchanged.

## Toolchain / dependency reuse record

- Application root `node_modules` → `E:/ATLAS-worktrees/g9g10-grid-delta-probe/node_modules` (root lockfile SHA-256 `9332EF25…C56C8` identical), read-only junction.
- `atlas-client/node_modules` → `E:/ATLAS-worktrees/tl-operator-workspace-c05/atlas-client/node_modules` (client lockfile SHA-256 `CE1AE84E…B9F1E` identical), read-only junction.
- Resolved there: Playwright `1.59.1`, TypeScript `6.0.2`, tsx `4.21.0`.

## Known risks

- **BLOCKING (external):** the smoke gate cannot pass on the live origin until the separate HIGH release swap deploys these fixes; today it fails only on `/timetable`.
- **NON_BLOCKING:** the `#310` hermetic control is a source-order assertion (no DOM renderer exists in the dependency tree); the live browser smoke supplies the true same-instance render proof.
- **NON_BLOCKING:** the `rules-of-hooks` baseline exempts one test-only manual renderer by file with a recorded rationale; `react-hooks/rules-of-hooks` stays `error` everywhere else.
- **NON_BLOCKING:** `react-hooks/exhaustive-deps` reports 65 pre-existing warnings (configured `warn`, exit 0); it is not part of the `no-explicit-any` ratchet.
- **NON_BLOCKING:** `/enrollpro-api/settings/public` returned 401 during the live crawl (the still-ungranted `ENROLLPRO-PROXY-RECOVERY-LIVE` lane); documented in the smoke allow-list.
- The runtime-source-of-truth map and `CHANGELOG.md` are left to the integration owner.
