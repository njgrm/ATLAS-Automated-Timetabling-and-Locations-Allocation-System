# DASH-RESILIENCE-C01 — Progress Ledger

- **Authoritative prompt:** `docs/prompts/dashboard-stale-readiness-correction-2026-09-11.md`
- **Audit:** `docs/analysis/dashboard-stale-readiness-audit-2026-09-11.md`
- **Worktree:** `D:\ATLAS-worktrees\dashboard-resilience-c01`
- **Branch:** `work/dashboard-resilience-c01`
- **Base SHA:** `ec7d54ed3b94db51fca9a8095a4be13f592b90e6` (refreshed `origin/main`)
- **Risk tier:** MEDIUM (cross-layer read path, no live mutation)
- **QA mode:** `EXTERNAL_QA_BUNDLE` enabled

## Task status

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| T1 | Preserve typed EnrollPro non-2xx in `active-term-adapter.service.ts` | DONE | `term-subject-authority.test.ts` typed-409 + network-failure tests |
| T2 | Explicit per-domain availability in `dashboard-readiness.service.ts` | DONE | `dashboard-stale-readiness.test.ts` aggregate controls |
| T3 | Single authoritative `/dashboard/readiness-summary` pipeline in `useDashboardData.ts` | DONE | legacy fan-out removed; browser retention test |
| T4 | 401/403 canonical auth/scope handling; no legacy fan-out | DONE | `classifyDashboardLoadError` / `resolveDashboardLoadFailure` tests; browser 401/403 tests |
| T5 | No synthetic zero/`[]`/`NONE`; genuine zeros preserved | DONE | aggregate + browser zero tests |
| T6 | Retain last same-school snapshot on transient refresh; one retry | DONE | `resolveDashboardLoadFailure` + browser desktop/mobile tests |
| T7 | Session-expired canonical UX | DONE | `expireAtlasSession` + AppShell listener; browser 401 test |
| T8 | Superseded Curriculum Requirements recorded as DEMAND-C01 debt | DONE | Out-of-scope note below |
| T9 | Focused tests, typechecks, builds, `git diff --check` | DONE | see Verification below |
| T10 | Playwright desktop + 390px, zero-write proof | DONE | local browser evidence (spec is gitignored) |
| T11 | Read-only Tailnet confirmation | DONE | health 200 + public subjects read |

## Decisions

- **Availability over nullable-only:** each domain block carries `available: boolean` AND nullable values (`0`/`[]`/`'NONE'` are never synthesized). `generation.latestRunStatus` is `null` when unavailable, and the lifecycle holds at `SETUP` for any unknown value.
- **Single pipeline:** the legacy `loadLegacyDashboardData` fan-out was deleted. The only supplementary reads after a successful summary are actor-scoped, fail-closed enrichments (coverage summary, per-term published/violations/unassigned) that never substitute zero.
- **Canonical session expiry:** `expireAtlasSession()` clears auth storage and raises `atlas:session-expired`; `AppShell` performs the same clear-and-navigate-to-`/login` flow it uses for a failed `verifySessionToken()`.
- **`activeTerm` on the summary:** added to `/dashboard/readiness-summary` so the single client pipeline can surface the typed term state (including `ACTIVE_TERM_UNRESOLVED`) without a second runtime call.

## Out of scope (recorded dependency)

- The superseded Curriculum Requirements repair workflow is unchanged and remains owned by the separate **DEMAND-C01 / UX-C01** stream.

## Verification evidence

- Server focused: `term-subject-authority.test.ts` (15 pass), `dashboard-stale-readiness.test.ts` (9 pass), `dashboard-lifecycle-truth.test.ts` (12 pass), `dashboard-http-authority.test.ts` (38 pass), `term-contract-atlas-consumption-c02.test.ts` + `term-contract-cache-instrumentation.test.ts` (41 pass).
- Client focused: `dashboard-lifecycle-truth.test.ts` (12 pass).
- Typechecks: `atlas-server` `npx tsc --noEmit` clean; `atlas-client` `npx tsc --noEmit` clean.
- Builds: `atlas-server` `npm run build` (tsc) clean; `atlas-client` `vite build` clean.
- `git diff --check` clean.
- Browser (local, gitignored spec): 6/6 Playwright pass at desktop and 390px — retained snapshot + one retry, unavailable-not-zero, canonical 401, blocked 403, genuine zero, no overflow/mojibake, zero non-GET requests.
- Read-only Tailnet: `GET /api/v1/health` → 200 `{status:ok}`; `GET /api/v1/subjects` reachable. No restart, no data mutation.

## Sandbox / mutation note

- Real-DB integration tests create and delete only disposable sandbox school id `7799101` with a pre-existence guard, a `finally` cleanup, and a zero-residue assertion. No shared/business row is created or altered. Browser tests never touch the shared runtime (fully intercepted API).

## Remaining risks

- `runtime-context.service.ts` still has no dedicated unit suite; its active-term independence is covered through `dashboard-stale-readiness.test.ts` and `dashboard-http-authority.test.ts`. NON-BLOCKING.
- Browser evidence is local-only (spec under gitignored `qa-artifacts/`); the committed proof is the server integration + client decision-helper tests. NON-BLOCKING for a REVIEW_REQUIRED candidate.
- `npm install` was not run; worktree `node_modules` are junctions to the main checkout (identical dependency manifests). Local environment detail only; not committed.
