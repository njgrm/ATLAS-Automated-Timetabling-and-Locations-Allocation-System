# CLIENT-QUALITY-C01 - add the missing gates and fix the defects they exist to catch

ROLE: EXECUTOR. Recommended reasoning variant: `high`. Risk tier: **MEDIUM** for
the source change; the release swap that ships it is a **separate HIGH action**
and must not be performed here.

## Why

Two live defects reached the deployed release with no gate objecting, and there is
no ESLint in this repository, `vite build` does not type-check, and no acceptance
matrix ever loaded a product page:

- `/timetable` throws React **#310** - `armSwapSessions` (`useCallback`) is declared
  **after** the early returns at `ScheduleReviewWorkspace.tsx:176/180/203`, which is
  the canonical `react-hooks/rules-of-hooks` violation.
- Opening "review load" throws `Cannot read properties of null (reading
  'remainingHours')` - `TeacherGridMode.tsx:56` types `loadProfile` as **`any`** and
  dereferences it at `:533/:567`, while `TeachingLoad.tsx:406` already proves the
  value is nullable by using `?.`.

Both are caught statically by the rules added in Part A.

## Identity

- Base: `origin/main` at dispatch (short `74f4e66e`; re-read and record the full SHA).
- Worktree `E:/ATLAS-worktrees/client-quality-c01`, branch `work/client-quality-c01`.
- Directive: read `origin/main:AGENTS.md` and record its blob + LF-SHA-256.
- This is a Tier A lane: no lease, no receipt, no Wave Completion Auditor.

## Part A - the three gates

### A1. ESLint with the React Hooks plugin

- Add a flat `eslint.config.js` at the repo root using `typescript-eslint` and
  `eslint-plugin-react-hooks`.
- `react-hooks/rules-of-hooks` = **error**. `react-hooks/exhaustive-deps` = **warn**.
- `@typescript-eslint/no-explicit-any` = **error**, with a checked-in ratchet
  baseline listing existing offenders. The count may only decrease. Known sites:
  `TeacherGridMode.tsx` (`loadProfile`), `CenterWorkspace.tsx` (10 props),
  `RightPanel.tsx` (6 props), `ViolationsSidebar.tsx` (`panelRef`),
  `timetableContexts.types.ts` (`kbSelectedSource`).
- **Install into this worktree only**:
  `npm install --no-save --no-package-lock eslint typescript-eslint eslint-plugin-react-hooks`.
  Do **not** create or commit a lockfile and do not modify another checkout's tree.
  Disclose the resolved versions.
- Add a `lint` script.

### A2. Client type-check

- Add a `typecheck` script to `atlas-client` running `tsc --noEmit` against its
  `tsconfig.json`. The server build already runs `tsc`; the client has none.

### A3. Route smoke spec

- A Playwright spec reusing the existing `test:visual` harness and config that
  loads every route declared in `App.tsx` (`/`, `/subjects`, `/teachers`,
  `/teaching-load`, `/teaching-load/history`, `/faculty`, `/assignments`,
  `/sections`, `/faculty/preferences`, `/timetable`, `/room-schedules`,
  `/schedules`, `/map`, `/audit`, `/admin/year-setup`, plus the public routes),
  opens each page's primary **non-mutating** controls, and **fails** on any
  `pageerror`, React render error, or unexpected response `>= 400`.
- Enforce a mechanical write deny-list (save, apply, submit, generate, publish,
  delete, remove, confirm, sync, reset, create, add, import, upload, archive,
  rollover, carry, assign, unassign, approve, commit, wipe, seed, logout) and
  allow-list the documented benign 404s.
- The sessions may log in under the directive's standing browser-QA authorization:
  disclose one login and its expected delta (one `LOCAL_LOGIN_SUCCESS` plus that
  actor's `last_login_at`), and prove zero mutation with before/after signatures.

## Part B - the fixes

1. **#310**: in `ScheduleReviewWorkspace.tsx`, move the `armSwapSessions`
   `useCallback` (approx. lines 244-255, with its R3 comment) to **above** the
   first early return (before approx. line 174). Declaration relocation only; the
   dependency array is unchanged and nothing between feeds it.
2. **remainingHours**: `TeacherGridMode.tsx` - change `loadProfile: any` to a
   nullable `WorkloadProfile` type and guard both usages
   (`loadProfile?.remainingHours ?? 0`), plus `WorkloadInspector.tsx:199`
   (`loadProfile?.remainingHours?.toFixed(1) ?? '0.0'`).
3. **ErrorBoundary**: add a route-level error boundary (prefer the router's
   existing `errorElement` pattern) so a component failure degrades instead of
   replacing the page with the framework crash screen.
4. **Year-change banner** (`AppShell.tsx:535-555`): it is persisted to
   `localStorage` by `lib/rollover-awareness.ts` and re-hydrated on every load,
   with **no dismiss control** and no expiry (`changedAt` is stored but unused).
   Add an explicit dismiss that removes the cache entry, and expire notices older
   than a bounded window using `changedAt`.
5. **Archived load in-page**: the archived surface already exists
   (`/teaching-load/history`, and `?view=history` on the main route). Expose it as
   a control **within** the Teaching Load page so the global banner is not the only
   path.
6. **Truth panel** (`TeachingLoad.tsx:681-688`): make `TeachingLoadTruthPanel`
   collapsed by default behind a `@/ui` disclosure, keeping a one-line summary.
   **This changes a guarded contract**: `tl-operator-workspace-c05-r3-truth.test.ts:370`
   asserts the current `[@media(max-height:640px)]:hidden` behaviour and must be
   updated deliberately, not deleted.
7. **Dashboard Run Health card**: remove the `DashboardCharts` block
   (`Dashboard.tsx:815-824`), its lazy import (`:26`), and the two
   `DashboardCharts*.tsx` files. Single usage; safe.
8. **Banner behaviour guardrail**: `rollover-ui-guardrails.test.ts` guards the
   banner; update it deliberately for the dismiss/expiry behaviour.

## Acceptance

MANDATORY_SOURCE (9): lint config loads and reports the baseline; a
hook-after-early-return fixture makes lint exit nonzero; a new-`any` fixture makes
lint exit nonzero; client `typecheck` exits 0; the `#310` regression test renders
loading-then-loaded on the same instance and fails before the hoist; the
`remainingHours` null path is covered by a test that fails before the guard; the
client build succeeds; the existing focused suites pass with **no assertion
removals**; `git diff --check` clean.

MANDATORY_LIVE (3): the smoke spec **fails against the live deployment as it
stands today, naming `/timetable`** (the decisive teeth-proof, and only capturable
before any fix ships); every route then passes once the release is live; zero
mutation is proven by before/after signatures.

DEFERRED_EXTERNAL (1): the release swap itself - separate HIGH action, separate
approval sentence, not part of this lane.

## Forbidden

No runtime restart, task, env, database, generation, publication, Teaching Load
apply, term-cache, rollover, migration, or companion change. Do not create or
commit a lockfile. Do not weaken a rule or widen an allow-list to make a gate pass;
a suppressed violation goes into the ratchet baseline with its rationale. Do not
ship the fixes - that is the separate release swap.

## Deliverable

One evidence document under `docs/reviews/client-quality-c01/`: the config diff and
resolved tool versions, the ratchet baseline count by rule, the three failing-first
proofs with exit codes (including the live smoke failure), the client typecheck
result, per-route smoke results, the eight fix diffs with their regression tests,
the guardrail tests updated deliberately with justification, and the zero-mutation
proof. Return `REVIEW_REQUIRED` with base and candidate SHAs, changed paths, the
gate tally, and known risks. Do not push.
