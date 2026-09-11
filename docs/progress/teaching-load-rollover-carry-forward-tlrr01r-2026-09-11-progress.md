# TL-RR01R — Teaching Load Carry-Forward Correction Progress

- Correction of the integrated TL-RR01 workflow (integrated at `618589dc`, `origin/main` `95ceedf9`).
- Branch: `work/teaching-load-carry-forward-tlrr01r`
- Base SHA: `95ceedf9e3633e431a50990e988339987529e40e` (`origin/main`)
- Risk: MEDIUM preview; HIGH apply (apply implemented, not invoked)
- Current phase: correction complete; fresh independent QA pending

## Corrections

| # | Correction | Status | Evidence |
|---|---|---|---|
| 1 | Grade authority from `SectionMirror.gradeLevelId` via `normalizeGradeLevelSync`; never `displayOrder` | DONE | `resolveCarryForwardGrade`, source/target snapshots, source/target revisions; mutants in authority suite |
| 2 | Fail closed on unconfigured workload policy; typed blocker before writes; in-transaction revalidation; no infinite cap | DONE | preview guard, apply guard reordered before drift checks, `buildCarryForwardPlan` guard; F3b + F4c |
| 3 | Strict positive authenticated `userId` before apply; typed 403, zero reads/writes | DONE | router `actorUserIdOf`, service `actorId` guard; F4b |
| 4 | Force-add Playwright spec as durable; correct handoff `PENDING_COMMIT` wording | DONE | `git add -f qa-artifacts/playwright/specs/teaching-load-carry-forward.spec.ts`; handoff updated |
| 5 | Preserve fill-empty-only, source immutability, fingerprint/revision checks, concurrency, replay, preview-only client | DONE | existing suites + F5/F6/F7/F8/F9/F10 still pass |

## Decisive checks (this run)

| Check | Command | Result |
|---|---|---|
| Server typecheck | `tsc --noEmit -p atlas-server` | 0 errors |
| Server build | `npm --prefix atlas-server run build` | 0 errors |
| Client typecheck | `tsc --noEmit -p atlas-client` | 0 errors |
| Client build | `npm --prefix atlas-client run build` | built |
| Authority + mutants | `tsx teaching-load-carry-forward-authority.test.ts` | 12/12 |
| Disposable PostgreSQL + mounted route | `tsx teaching-load-carry-forward-postgres.test.ts` | 87/87 |
| Playwright (desktop + mobile) | `playwright test -c playwright.carry-forward.config.ts` | 5/5 |
| Client helpers | `tsx --test teaching-load-carry-forward-helpers.test.ts` | 11/11 |
| Full-range diff-check | `git diff --check 95ceedf9...HEAD` | clean |

## Failing-first controls

- Hermetic mutant: same displayOrder/name/program across different actual grades →
  corrected MATCH vs displayOrder-as-grade AMBIGUOUS.
- Hermetic mutant: displayOrder changes independently → corrected MATCH vs
  displayOrder-as-grade MISSING.
- Integrated fixture: archived sections carry `gradeLevelId=17` (Grade 7) with
  `displayOrder=9` while target sections carry `displayOrder=7`; the two exact
  carries only appear when grade comes from `gradeLevelId`. A displayOrder-as-grade
  build would yield `EXACT_CARRY=0` and `MISSING_SECTION=14`.
- Unconfigured policy: preview and apply both return typed
  `WORKLOAD_POLICY_UNCONFIGURED` with zero writes.
- Bad actor ids (missing/0/-1/1.5/"abc"): typed 403 `ACTOR_USER_REQUIRED`, zero reads.

## Remaining risks

- `BLOCKING`: fresh independent QA pending.
- `NON_BLOCKING`: live preview requires deployment and the explicit year-9 term
  snapshot sync; apply remains a separate HIGH approval.

## Stop-eligibility

- Safe incomplete tasks: 0
- Required deferred/absent/collapsed tasks: 0
- Invalid/missing required reviews: fresh independent QA pending at this boundary
- Accessible read-only routes not probed: none in scope
