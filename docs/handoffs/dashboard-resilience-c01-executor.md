# DASH-RESILIENCE-C01 — Executor Handoff

- **Stream:** `DASH-RESILIENCE-C01`
- **Governing prompt:** `docs/prompts/dashboard-stale-readiness-correction-2026-09-11.md`
- **Risk tier:** MEDIUM (cross-layer read path; no live mutation)
- **Worktree:** `D:\ATLAS-worktrees\dashboard-resilience-c01`
- **Branch:** `work/dashboard-resilience-c01`
- **Base SHA:** `ec7d54ed3b94db51fca9a8095a4be13f592b90e6`
- **Candidate SHA:** tip of `work/dashboard-resilience-c01` (the commit that introduces this file; resolve with `git rev-parse work/dashboard-resilience-c01`)
- **Verdict:** `REVIEW_REQUIRED`
- **External QA bundle:** enabled

## Exact changed paths

```
atlas-server/src/services/active-term-adapter.service.ts
atlas-server/src/services/dashboard-readiness.service.ts
atlas-server/src/__tests__/dashboard-stale-readiness.test.ts        (new)
atlas-server/src/__tests__/term-subject-authority.test.ts
atlas-client/src/lib/auth.ts
atlas-client/src/lib/settings.ts
atlas-client/src/hooks/useDashboardData.ts
atlas-client/src/hooks/__tests__/dashboard-lifecycle-truth.test.ts
atlas-client/src/pages/Dashboard.tsx
atlas-client/src/components/AppShell.tsx
atlas-client/src/components/dashboard/DashboardCharts.tsx
atlas-client/src/components/dashboard/DashboardChartsInner.tsx
docs/reference/atlas-runtime-source-of-truth-map.md
docs/progress/dashboard-resilience-c01-2026-09-11-progress.md     (new)
docs/handoffs/dashboard-resilience-c01-executor.md                (new)
CHANGELOG.md
```

No migrations, schema, `.env`, EnrollPro/AIMS/SMART source, generation, publication, or curriculum-derivation files were touched.

## Before / after state matrix

| # | Prompt correction | Before | After |
|---|-------------------|--------|-------|
| 1 | Typed non-2xx | Any non-2xx → `enrollpro-unreachable` (409 code discarded) | 409 `ACTIVE_TERM_UNRESOLVED` → `source:'enrollpro-unresolved'`, `reachable:true`, `code:'ACTIVE_TERM_UNRESOLVED'`; other non-2xx preserve the upstream code |
| 2 | Year independent of term | Year/term fetched in parallel but term failure mislabeled | Verified year keeps saved counts; summary exposes typed `activeTerm`; unresolved term is reachable, not an outage |
| 3 | Single pipeline | `useDashboardData` fell back to legacy fan-out on any non-403 error | Legacy fan-out deleted; `/dashboard/readiness-summary` is the only load pipeline |
| 4 | 401/403 are auth/scope | Only 403 handled; 401 fell into legacy fan-out | 401 → `expireAtlasSession()` + AppShell `atlas:session-expired` → `/login`; 403 → blocked-scope card; neither dispatches legacy requests |
| 5 | No synthetic business values | Failed subjects/faculty → `0`; campus → `[]`; generation → `NONE`; lifecycle advanced | Failed domain → `available:false` + `null`; lifecycle holds at `SETUP` for unknown values |
| 6 | Retain same-school snapshot | Transient failure erased a good snapshot | Same-school transient failure retains the snapshot with one retry; never retained across actor-school change |
| 7 | Genuine zeros | Zero indistinguishable from unavailable | `available:true, count:0` renders `0`; unavailable renders `—`/`Unavailable` |
| 8 | Curriculum workflow | Superseded workflow present | Unchanged; recorded as DEMAND-C01/UX-C01 debt |

## Decisive tests / commands

Server (from `atlas-server`, with `.env` loaded into the process):
```
npx tsx --test src/__tests__/dashboard-stale-readiness.test.ts        # 9 pass
npx tsx --test src/__tests__/dashboard-lifecycle-truth.test.ts        # 12 pass
npx tsx --test src/__tests__/dashboard-http-authority.test.ts         # 38 pass
npx tsx --test src/__tests__/term-subject-authority.test.ts           # 15 pass
npx tsx --test src/__tests__/term-contract-atlas-consumption-c02.test.ts \
                src/__tests__/term-contract-cache-instrumentation.test.ts  # 41 pass
npx tsc --noEmit                                                      # clean
npm run build                                                         # clean
```

Client (from `atlas-client`):
```
npx tsx --test src/hooks/__tests__/dashboard-lifecycle-truth.test.ts  # 12 pass
npx tsc --noEmit                                                      # clean
npm run build                                                         # clean
```

Range:
```
git -C D:\ATLAS-worktrees\dashboard-resilience-c01 diff --check       # clean
```

Key negative controls (mounted route + real DB sandbox):
- school-year 200 + active-term 409 `ACTIVE_TERM_UNRESOLVED` → 200, reachable typed term, saved counts available;
- unreachable EnrollPro with valid ATLAS mirrors → saved counts available, `sourceState: using_saved_data`;
- mounted `/dashboard/readiness-summary` 409 case 200; missing token 401 with no summary body;
- one failed domain → `available:false`/`null` and lifecycle `SETUP`;
- genuine zero → `available:true`/`0`;
- sandbox fixtures leave zero residue.

## Browser evidence (local; spec is gitignored)

- Spec: `qa-artifacts/playwright/specs/dashboard-resilience-c01.spec.ts` (gitignored, local only).
- Result: **6/6 pass** against the candidate `vite preview` build with fully intercepted APIs (no shared runtime, no writes), desktop + 390px:
  1. retained same-school snapshot + exactly one retry after a transient refresh failure (no non-GET requests);
  2. first-load failure shows `—` placeholders, not `0`;
  3. HTTP 401 → `/login`, no `/subjects/stats` or `/map/schools` legacy requests, no writes;
  4. HTTP 403 → blocked-scope card, no fallback-school requests, no writes;
  5. genuine persisted zero stays `0`;
  6. 390px degraded state: one retry, no horizontal overflow (`scrollWidth - clientWidth ≤ 1`), no `\uFFFD`/mojibake.

## Read-only live evidence

- `GET https://njgrm.buru-degree.ts.net/api/v1/health` → 200 `{status:"ok","service":"atlas"}`.
- `GET https://njgrm.buru-degree.ts.net/api/v1/subjects` reachable.
- The live runtime serves the pre-integration bundle, so the corrections above are not deployed there. No shared port 5001 restart, no login POST, no live data mutation.

## Zero-mutation proof

- Real-DB integration tests create/delete only disposable sandbox school id `7799101`; a pre-existence guard prevents clobbering, cleanup runs in `finally`, and a residue assertion confirms zero remaining rows.
- Browser tests intercept every `/api/**` and `/enrollpro-api/**` call; no request reaches the shared runtime, and non-GET requests are asserted to be zero.
- Service source guard asserts `dashboard-readiness.service.ts` performs no writer (`.create/.update/.delete/.upsert/...`) or raw-write calls.

## Known risks

- `runtime-context.service.ts` has no dedicated unit suite; its independence is covered via the dashboard integration suites. (NON_BLOCKING)
- Browser evidence is local-only (gitignored spec); committed proof is the server integration + client decision-helper tests. (NON_BLOCKING)
- Worktree `node_modules` are junctions to the main checkout (identical dependency manifests); not committed. (LOCAL ENVIRONMENT)

## Living-register delta for the planner

- `DASH-RESILIENCE-C01`: `PLANNED` → `REVIEW_REQUIRED`; base `ec7d54ed`; candidate = branch tip; blocker: none; last evidence: this handoff.
- On `ACCEPT_READY`, `W1-RUNTIME-DEPLOY` still awaits integration of this stream plus `TL-UX-C01R2`; do not restart shared port 5001 until then.

## Verdict

`REVIEW_REQUIRED`
