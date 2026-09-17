# CLIENT-QUALITY-C01 — execution evidence (2026-09-17)

- **Stream:** `CLIENT-QUALITY-C01`
- **Worktree:** `E:/ATLAS-worktrees/client-quality-c01`
- **Branch:** `work/client-quality-c01`
- **Base SHA:** `11de142b47ee044122d2d364e4c6f5be214f38e4` (short `11de142b`; `origin/main`; register/activation commit over spec base `74f4e66e`)
- **Directive:** `origin/main:AGENTS.md`, blob `09ede31cbb133ed424039049cbaf44382dd3e4bf`, LF-SHA-256 `3ef09bb64eb623a6c7412fb98549c9143e16589739628656036b19c144a70d79`
- **Risk:** MEDIUM (source). The release swap that ships these fixes is a separate HIGH action and was **not** performed.
- **Toolchain:** no `node_modules` existed in the worktree. `npm install` / `npm ci` are denied by the executor tool policy and the executor role may not install packages, so only already-present trees were reused **read-only via directory junctions** (recorded):
  - root `node_modules` → `E:/ATLAS-worktrees/g9g10-grid-delta-probe/node_modules` (root `package-lock.json` SHA-256 `9332EF25…C56C8` identical)
  - `atlas-client/node_modules` → `E:/ATLAS-worktrees/tl-operator-workspace-c05/atlas-client/node_modules` (client `package-lock.json` SHA-256 `CE1AE84E…B9F1E` identical)
  - Resolved: Playwright `1.59.1`, TypeScript `6.0.2`, tsx `4.21.0`. No lockfile was created or modified.

## Verdict summary

`REVIEW_REQUIRED`. Eight of nine MANDATORY_SOURCE rows PASS. The three ESLint-execution
rows are **BLOCKED by an authority/tooling divergence** (see below), and the
MANDATORY_LIVE "every route passes once the release is live" row is
**BLOCKED_EXTERNAL** by design (the release swap is the separate HIGH action).

## Precondition divergence (must be resolved by the planner)

Part A1 requires installing `eslint typescript-eslint eslint-plugin-react-hooks`
into the worktree. That exact command is denied by the executor harness
(`bash` permission patterns `npm install*` and `npm ci*` are `deny`), and my role
authority explicitly says I may not install packages. No reusable ESLint tree
exists anywhere on the host (searched every `E:/ATLAS-worktrees/*` dependency
tree; the only cached ESLint is an `_npx` copy without `typescript-eslint` or
`eslint-plugin-react-hooks`). I did **not** substitute a workaround or fabricate a
lint run.

Consequence: the three ESLint execution rows are BLOCKED, not PASS:

| Row | State |
|---|---|
| lint config loads and reports the baseline | **BLOCKED** — ESLint not installable |
| hook-after-early-return fixture makes lint exit nonzero | **BLOCKED** — ESLint not installable; a hermetic source-order control is provided instead (see source proof 1) |
| new-`any` fixture makes lint exit nonzero | **BLOCKED** — ESLint not installable |

A1 source *is* delivered and syntax-validated: `eslint.config.js`,
`ops/lint/no-explicit-any-ratchet.json` (39 client files / 208 `TSAnyKeyword`
nodes, TypeScript-AST census), `ops/lint/eslint-rules/no-explicit-any-ratchet.cjs`,
and the root `lint` script. Their execution must be verified once the toolchain is
provisioned.

## Trace table

| Requirement | Production path | Negative control | Verification command | Result |
|---|---|---|---|---|
| `#310` hook before early returns | `ScheduleReviewWorkspace.tsx` `armSwapSessions` | restore pre-hoist file; regression must fail | `tsx --test client-quality-c01-regressions.test.ts` | PASS (mutant exit 1) |
| `remainingHours` null-safe | `remainingCapacityMinutesForLoadProfile` → `TeacherGridMode`/`TeachingLoad` | dereference mutant must fail | `tsx --test client-quality-c01-regressions.test.ts` | PASS (mutant exit 1) |
| Route ErrorBoundary | `App.tsx` `errorElement`, `RouteErrorBoundary.tsx` | route render error degrades | live smoke crawl | PASS (source); live build has none |
| Banner dismiss/expiry | `AppShell.tsx` dismiss control, `rollover-awareness.ts` | expired notice re-hydration | `rollover-awareness.test.ts`, `rollover-ui-guardrails.test.ts` | PASS |
| Archived load in-page | `TeachingLoad.tsx` `teaching-load-history-link` | n/a (additive control) | `client-quality-c01-regressions.test.ts` | PASS |
| Truth panel collapsed | `TeachingLoadTruthPanel.tsx` Accordion | R3 shell contract updated | `tl-operator-workspace-c05-r3-truth.test.ts` | PASS |
| Dashboard Run Health removed | `Dashboard.tsx`, two `DashboardCharts*.tsx` deleted | build has no chunk | `vite build` | PASS |
| Client typecheck | `atlas-client/package.json` `typecheck` | n/a | `npm run typecheck` | PASS (exit 0) |
| Route smoke | `client-route-smoke.spec.ts` | live build must fail naming `/timetable` | `playwright test -c playwright.config.ts ...` | PASS (live exit 1, React #310 on `/timetable`) |
| Zero mutation | live Postgres signature | before/after delta | read-only `READ ONLY` transaction census | PASS (only 2 login rows) |
| ESLint gate | `eslint.config.js` + ratchet | hook/`any` fixtures | `npm run lint` | BLOCKED (toolchain) |

## Proof 1 — `#310` fails-first (hermetic + live)

Hermetic control (no DOM renderer is available and installs are denied, so the
same-instance render is proven live): `client-quality-c01-regressions.test.ts`
asserts every component-level hook in `ScheduleReviewWorkspace` is declared before
the first early return. Restoring the pre-hoist base file produced:

```
✖ #310 ScheduleReviewWorkspace declares every top-level hook before its first early return
✖ #310 armSwapSessions is an unconditional hook declared before the loading/error/context returns
MUTANT_EXIT=1  (file restored byte-exact: SHA-256 279678DE…29CF6)
```

Live decisive control (`npm run test:visual:route-smoke`, run against
`https://njgrm.buru-degree.ts.net`): the spec **fails** and names `/timetable`:

```
[client-route-smoke] { "route": "/timetable", "name": "ScheduleReview",
  "url": "https://njgrm.buru-degree.ts.net/timetable",
  "failures": [
    "react-error: Error handled by React Router default ErrorBoundary: Error: Minified React error #310; …",
    "react-error: Error: Minified React error #310; … at ko (…/assets/index-BpNxUQA8.js:9:48794)\n    at Object.gs [as useCallback] (…",
    "react-error: React Router caught the following error during render Error: Minified React error #310; …"
  ] }
SMOKE_EXIT=1
```

Exactly four `react-error` entries, all on `/timetable`; every other route's
`failures` array is empty. Captured before any fix ships (the deployment is
unchanged by this lane). Raw run: `qa-artifacts/smoke-live-run-2.txt` (gitignored).

## Proof 2 — `remainingHours` null path fails-first

Mutating `remainingCapacityMinutesForLoadProfile` to dereference
`loadProfile.remainingHours` produced the exact live error and exit 1:

```
✖ remaining capacity is null-safe for an unresolved workload profile
TypeError: Cannot read properties of null (reading 'remainingHours')
MUTANT_EXIT=1  (file restored byte-exact: SHA-256 A9E8AD8D…5DE5E15B)
```

## Client typecheck and build

```
npm run typecheck   → tsc --noEmit -p tsconfig.json → exit 0
npm run build       → vite build → exit 0 (no DashboardCharts chunk emitted)
```

## Existing focused suites (no assertion removals)

Full tracked client inventory: **639 tests, 639 pass, 0 fail, exit 0**
(all `atlas-client/src/**/__tests__/*.test.ts`, 70 files).
New/changed suites: **34/34 pass**.

Two pre-existing scripts reference files that are not tracked in the repository
(`test:auth-session`, `test:timetable-conflict` → `auth-session.test.ts`,
`timetable-live-conflict.test.ts`, `tactical-sandbox-dock-helpers.test.ts`); they
fail identically on the base and are unrelated to this candidate.

## Deliberately updated guarded contracts (justified)

1. `tl-operator-workspace-c05-r3-truth.test.ts` — the assertion that the truth
   strip is suppressed via `[@media(max-height:640px)]:hidden` is replaced by an
   assertion that the panel renders the `@/ui` Accordion disclosure with a
   one-line summary (`teaching-load-truth-summary-line`) and is **not** hidden on
   short viewports. Justification: the panel is now collapsed to one line, so
   collapsing reclaims the vertical space the media query was protecting; hiding
   the compact summary would contradict the "keep a one-line summary" contract.
   All canonical metric assertions, the zero-write assertion, and the shadcn
   control assertion are preserved unchanged.
2. `rollover-ui-guardrails.test.ts` — a new test asserts the banner exposes a
   dismiss control wired to `clearRolloverAwarenessNotice`, clears the in-session
   state, and that `rollover-awareness.ts` declares a bounded window
   (`ROLLOVER_NOTICE_TTL_MS`) evaluated from `changedAt`. Justification: the
   banner previously re-hydrated forever with no dismiss control; the guard must
   now pin the new dismiss/expiry contract. No existing assertion was removed.

No assertion was deleted anywhere; the new suite is additive.

## Fix inventory

1. `ScheduleReviewWorkspace.tsx` — `armSwapSessions` `useCallback` + R3 comment relocated above `isDraftPublished` and the early returns (declaration order only; dependency array unchanged).
2. `TeacherGridMode.tsx` — `loadProfile: LoadProfile | null` (was `any`); both `remainingCapacityMinutes` uses now call `remainingCapacityMinutesForLoadProfile`.
3. `WorkloadInspector.tsx` — `loadProfile?.remainingHours?.toFixed(1) ?? '0.0'`.
4. `faculty-assignment-helpers.ts` — new exported null-safe `remainingCapacityMinutesForLoadProfile`.
5. `RouteErrorBoundary.tsx` (new) + `App.tsx` `errorElement` on all top-level routes.
6. `rollover-awareness.ts` — `ROLLOVER_NOTICE_TTL_MS` (14 days), `isRolloverNoticeExpired`, `clearRolloverAwarenessNotice`; `readRolloverAwarenessNotice` rejects expired notices.
7. `AppShell.tsx` — dismiss control (`rollover-awareness-dismiss`) removes the durable entry and clears state.
8. `TeachingLoad.tsx` — in-page `Archived load` control (`teaching-load-history-link` → `/teaching-load/history`); truth strip wrapper no longer hidden on short viewports.
9. `TeachingLoadTruthPanel.tsx` — collapsed by default behind `@/ui` Accordion with a one-line summary.
10. `Dashboard.tsx` — Run Health `DashboardCharts` block and lazy import removed; `DashboardCharts.tsx` + `DashboardChartsInner.tsx` deleted.
11. `atlas-client/package.json` — `typecheck` and `test:client-quality` scripts.
12. Root `package.json` — `lint` and `test:visual:route-smoke` scripts; `.gitignore` exception for the new spec.

## Part A gate rows (9 MANDATORY_SOURCE / 3 MANDATORY_LIVE / 1 DEFERRED_EXTERNAL)

| # | Class | Gate | State | Evidence |
|---|---|---|---|---|
| S1 | SOURCE | lint config loads / reports baseline | **BLOCKED** | toolchain not installable; config + 39-file/208-node baseline authored |
| S2 | SOURCE | hook fixture → lint nonzero | **BLOCKED** | same; hermetic source-order control fails-first (exit 1) |
| S3 | SOURCE | new-`any` fixture → lint nonzero | **BLOCKED** | same |
| S4 | SOURCE | client `typecheck` exits 0 | **PASS** | `npm run typecheck` exit 0 |
| S5 | SOURCE | `#310` loading→loaded same-instance fails before hoist | **PASS** | live smoke React #310 on `/timetable` + hermetic mutant exit 1 |
| S6 | SOURCE | `remainingHours` null path fails before guard | **PASS** | mutant exit 1, exact `TypeError` |
| S7 | SOURCE | client build succeeds | **PASS** | `vite build` exit 0 |
| S8 | SOURCE | focused suites pass, no assertion removals | **PASS** | 639/639; guardrail updates justified; additive-only |
| S9 | SOURCE | `git diff --check` clean | **PASS** | see handoff |
| L1 | LIVE | smoke spec fails against live, naming `/timetable` | **PASS** | run exit 1; 4× React #310 on `/timetable` only |
| L2 | LIVE | every route passes once release is live | **BLOCKED_EXTERNAL** | requires the separate HIGH release swap; today all non-`/timetable` routes are clean |
| L3 | LIVE | zero mutation via before/after signatures | **PASS** | read-only census: only 2 login rows changed |
| D1 | DEFERRED_EXTERNAL | release swap | **DEFERRED** | separate HIGH action, not performed |

## Login disclosure

Two smoke-spec runs each performed exactly one login (the earlier origin-check
abort performed none). Expected and observed delta:

- `audit_logs`: `260 → 262` rows, `maxId 811 → 813`; rows 812 and 813 are
  `LOCAL_LOGIN_SUCCESS` for actor `46`.
- `atlas_auth_accounts.last_login_at` maximum advanced to `2026-09-17 19:15:15.23`.

No credential value was printed or committed; credentials were read from
`%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md` at runtime only.

## Zero-mutation signature

Read-only `SELECT` census over all 46 public tables inside
`BEGIN TRANSACTION READ ONLY` (DSN never printed):

```
BEFORE_HASH=04206126d3d913aa2371a315aa7e8bf57fae0d1772d2625e35cb1274dc0d62d7
AFTER_HASH =099c5cb22caa72d9f9b072094c79dcc77460a3146d36889db6dc864f0a5c7d12
CHANGED audit_logs : count 260 → 262 ; maxId 811 → 813
CHANGED atlas_auth_accounts.last_login_at : → 2026-09-17 19:15:15.23
(45 other tables: delta 0 — no generation, publication, Teaching Load, term-cache,
rollover, or migration change)
```

The crawl's request guard aborted every non-safe HTTP method and recorded zero
crawl-dispatched writes (`crawlWrites == []`).

## Known risks

- **BLOCKING (planner decision):** the three ESLint execution rows cannot run
  under the current executor authority. The planner must either provision the
  toolchain through an authorized install scope or accept the config as
  source-only and re-run the lint fixtures before the release swap.
- **BLOCKING (external):** the smoke gate cannot pass on the live origin until
  the separate HIGH release swap deploys these fixes; today it fails only on
  `/timetable`.
- **NON_BLOCKING:** the `#310` regression is a source-order control rather than a
  DOM render test because no jsdom/happy-dom/react-test-renderer exists in the
  dependency tree; the live browser smoke supplies the true same-instance render
  proof.
- **NON_BLOCKING:** the ratchet baseline is a TypeScript-AST census
  (`TSAnyKeyword`), accurate to the rule's node, but its ESLint execution is
  unverified until the toolchain is installed; the runtime-source-of-truth map
  and `CHANGELOG.md` are left to the integration owner.
- **NON_BLOCKING:** `/enrollpro-api/settings/public` returned 401 during the live
  crawl (the still-ungranted `ENROLLPRO-PROXY-RECOVERY-LIVE` lane). The client
  degrades; the smoke allow-list documents it.
