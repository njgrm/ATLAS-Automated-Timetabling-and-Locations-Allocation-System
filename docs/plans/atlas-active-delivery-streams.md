# ATLAS Active Delivery Streams

Last reconciled: 2026-09-11 (Asia/Manila)

This is the current operational register for executor, QA, integration, and
operator-action streams. Historical phase plans and per-stream ledgers are
evidence, not alternate status boards. Only the primary planner or integration
owner updates this file.

## Current objective

Complete an understandable EnrollPro-driven rollover into one authoritative
derived-demand flow, preserve prior-year Teaching Load as visible history with
an optional audited carry-forward, and reach one generated schedule with zero
hard blockers before separately approving publication.

## Current coordination snapshot

- Wave 1 and subsequent accepted planner evidence are integrated and pushed.
  This reconciliation adds the TL-UX-C01/C01R integration merge `151f02ee` on
  top of `origin/main` `e7121e75`.
- All three source lanes passed independent QA and the combined integration
  gates. The approved term schema migration is applied and verified; deploying
  the integrated runtime remains a separate service-lifecycle action.
- The EnrollPro fork and canonical READ_ONLY clone were fast-forwarded to
  correction commit `5887d685`. Live probes confirm the authoritative ordered
  three-term contract for year 9 / `2030-2031` and strict malformed-ID
  rejection. The live typed `ACTIVE_TERM_UNRESOLVED` response is expected while
  the host date remains in 2026; ATLAS currently mislabels it as unreachable.
  AIMS and SMART reference clones remain at their last verified tips
  `a22c9c88` and `c3806e12`.
- No carry-forward, generation, or publication is authorized by this register.

## Stream register

| Stream | Objective | State | Risk | Git boundary | Dependency or blocker | Last decisive evidence | Exact next action |
|---|---|---|---|---|---|---|---|
| GEN-ZW01 | Make generation passive over Teaching Load and close actor/audit/write authority | `INTEGRATED` | MEDIUM | `work/generation-zw01`; `e39da520...00488bbf` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| RR-UX01 | Visible rollover awareness, one Year Setup status surface, and read-only archived Teaching Load | `INTEGRATED` | MEDIUM | `work/rollover-rrux01`; `00488bbf...ea44e155` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| TERM-SUBJ-C01 | Consume exact EnrollPro term authority and prepare Subject scheduling metadata without false operative controls | `INTEGRATED` | MEDIUM source; HIGH live migration | `work/term-subject-c01`; `e39da520...8abc2ab1` | Live migration remains separate | Independent QA passed 13/13 server authority and 11/11 client controls; combined builds passed | Prepare the separate live migration preview; do not apply without HIGH approval |
| W1-INTEGRATION | Combine the three accepted Wave-1 source lanes | `INTEGRATED` | MEDIUM | `integration/rollover-derived-demand-w1`; `e39da520...36c5d3d1` | None | Shared-doc-only conflicts matched forecast; focused GEN/RR/TERM suites, both builds/type-checks, diff-check, and isolated server health passed | Closed and pushed to `origin/main` at `36c5d3d1` |
| ENROLLPRO-TERM-HANDOFF | Make EnrollPro expose authoritative ordered term identities, labels, dates, and active term | `ACCEPT_READY` | External dependency; READ_ONLY QA | EnrollPro `396a9892...5887d685`; canonical mirror `D:\EnrollPro` clean at `5887d685` | ATLAS consumption and deployment remain separate | Source review confirms strict integer parsing and validate-before-write term mutation; live probes return the ordered three-term year-9 contract, reject malformed/duplicate IDs with typed 400s, and return truthful 409 `ACTIVE_TERM_UNRESOLVED` for the 2026/2030 calendar mismatch | Consume the corrected contract in ATLAS; do not edit the EnrollPro mirror |
| TERM-CONSUME-C02 | Accept EnrollPro ordered term structure independently from nullable current-term state and cache it through explicit rollover sync | `PLANNED` | MEDIUM cross-layer authority | Fresh worktree from current `origin/main` | EnrollPro correction `5887d685` is live; must precede DEMAND-C01 | Current ATLAS requires school-year and active-term 200 together, makes `activeTerm` mandatory, and may write its cache from a passive Subjects GET; live year contract is valid while active-term truthfully returns 409 because the test year is future-dated | Execute `docs/prompts/term-contract-atlas-consumption-c02-2026-09-11.md`; commit and return reviewed candidate without live mutation |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `PLANNED` | LOW | Fresh branch from current `origin/main` | None; must preserve backup revalidation and spawn ordering | First live invocation passed its backup gate but Prisma stopped before migration because the wrapper omitted `../prisma/schema.prisma`; supported forwarded argument succeeded | Implement a narrow command-path correction with failing-first spawn-argument coverage; no live migration |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify the corrected EnrollPro term contract | `PLANNED` | MEDIUM service lifecycle | Current `origin/main`; isolated build before shared-runtime action | Coordinate with active TL/TT/Dashboard live browser runs | Port 5001 is healthy and serves saved year-9 readiness, but the visible Dashboard still exposes the superseded Curriculum Requirements workflow and the runtime contains the active-term error-classification defect | Integrate DASH-RESILIENCE-C01 first, then perform one bounded build/restart/Tailnet acceptance; do not restart during another live-QA run |
| DASH-RESILIENCE-C01 | Preserve saved Dashboard truth and typed term state when EnrollPro or one ATLAS read is unavailable | `PLANNED` | MEDIUM cross-layer read path | Fresh worktree from current `origin/main` | May run beside TL/TT UX; avoid their files and all data mutation | Live EnrollPro health/year routes are 200 and Dashboard saved counts are 20 sections/22 subjects/42 faculty/98 teaching rooms, but ATLAS maps typed active-term 409 to unreachable and its legacy fallback substitutes zeros/empties on failed reads | Execute `docs/prompts/dashboard-stale-readiness-correction-2026-09-11.md`; commit and return a reviewed read-only candidate |
| TL-UX-C01 | Rebuild Teaching Load as an accessible assignment workspace and unify suggestion/balance authority | `INTEGRATED` | MEDIUM UI and HIGH write/concurrency guards | `work/teaching-load-ux-c01`; `36c5d3d1...2aad67a3`; integration `151f02ee` | None | Independent changed-scope reviews closed after three correction rounds (`ACCEPT_READY`); server distribution 13/13 and write-authority exit 0; client ownership 11/11, canonical 33/33, route-intent 21/21, distribution-ui 2/2, ux-guardrails 21/21; both tsc/build green; live read-only year-9 proof 7 above-standard donors / 14 exact moves / idle ESP-FIL receivers | Closed into `origin/main` at `151f02ee`; DB-backed apply test remains unrun (no test DB) |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `CORRECTION_REQUIRED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...aa38d784` | Must not implement DEMAND-C01 or trigger live generation; avoid TL-UX shared paths | Live year 9 has no run; audit found contradictory no-run controls, dead Curriculum Requirements repair, Advanced generation bypass, missing Simple room repair, bulk teacher-leaving mislabeled as class reassignment, color-only placement cues, count-only swap explanations, and state-insensitive help | Execute `docs/prompts/timetable-simple-operator-one-shot-ttux01r2-2026-09-11.md` in the existing worktree; use controlled data-filled browser fixtures plus read-only Tailnet QA |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `BLOCKED` | MEDIUM | Fresh branch after TERM-CONSUME-C02 integration | TERM-CONSUME-C02 plus passive generation/TL boundaries | Governing sequence exists in `rollover-derived-demand-generation-readiness-sequence-2026-09-10.md` | Execute after ATLAS can consume/cache the live term structure without requiring a current active term |
| UX-C01 | Remove Curriculum Requirements/Decision Workspace from normal workflow and explain derived setup plainly | `BLOCKED` | MEDIUM UI | Not started | DEMAND-C01 must be real first | Product decision recorded in governing sequence | Start in parallel with later demand-consumer work only after DEMAND-C01 establishes replacement truth |
| TL-RR01 | Preview and optionally carry forward last year's Teaching Load into empty current-year demand | `BLOCKED` | MEDIUM preview; HIGH apply | Not started | DEMAND-C01 plus visible archived history | Carry-forward rules are defined in the governing sequence | Build zero-write preview after DEMAND-C01; require a separate approval for apply |
| GEN-C02 | Use canonical term-aware derived demand and close grade-window/class-program-slot/hard-blocker gaps | `BLOCKED` | MEDIUM source; HIGH generation | Not started | DEMAND-C01 and reconciled/carry-forward current-year Teaching Load | GEN-C01 proved the old production-demand mismatch and is superseded | Execute read-only canonical dry-run work after derived demand is authoritative |
| LIVE-GENERATION | Generate one current-year schedule and reach zero hard violations/unresolved sessions | `BLOCKED` | HIGH | Not started | GEN-C02 zero-hard-blocker preview and explicit approval | No current authorization | Prepare fingerprinted preview, independent QA, then request explicit generation approval |
| LIVE-PUBLICATION | Publish the accepted zero-hard-blocker schedule | `BLOCKED` | HIGH | Publication authority source is integrated on `origin/main` | Completed current-year run with zero hard violations, fresh publication preview, independent QA, explicit approval | PUB-C01R3 source is integrated; no publication authorized | Begin only after successful generation and review closure |

## Superseded or closed streams

| Stream | State | Disposition |
|---|---|---|
| SCA-01 through SCA-04 | `SUPERSEDED` | Useful evidence and year-8 transition history; the operator-facing Curriculum Requirements workflow is no longer the intended annual authority |
| GEN-C01 (`2e922d6d`) | `SUPERSEDED` | Diagnostic evidence feeds GEN-C02; do not rebase or integrate blindly because it used the split legacy demand model |
| TT-C02 / TT-C03 | `INTEGRATED` | Preview-only insertion and shared candidate invariants are represented on `origin/main` through integration commits |
| TT-C04 | `INTEGRATED` | Operator lifecycle UX hardening is on `origin/main` via `84d64437` |
| PUB-C01R3 | `INTEGRATED` | Publication authority hardening is on `origin/main` via `63a15a37`; live publication remains a separate HIGH action |
| TL-UX-C01 / TL-UX-C01R | `INTEGRATED` | Teaching Load workspace consolidation plus truthful coverage-and-distribution suggestion/balance authority are on `origin/main` via integration merge `151f02ee` |
| Year-8 SCA/TL data applies | `CLOSED` | Historical transition completed; do not mistake those applies for automatic authority in the newly rolled-over year |

## Dependency-ordered queue

1. Execute TERM-CONSUME-C02 so ATLAS accepts and caches the corrected ordered
   structure even while active term is legitimately unresolved.
2. Execute DASH-RESILIENCE-C01 after TERM-CONSUME-C02 so expired sessions and
   typed active-term states cannot appear as empty school data, then coordinate
   one integrated runtime deployment without interrupting live QA.
3. Correct the guarded command's default Prisma schema path; do not re-run the
   already applied migration.
4. TL-UX-C01/C01R is integrated at `151f02ee`; the superseded `1f867eb8`
   candidate is closed and no further TL source correction is active.
5. Execute the expanded TT-UX01R2 Simple-operator closure on its existing
   branch; do not integrate `aa38d784`.
6. Execute DEMAND-C01 after TERM-CONSUME-C02 is accepted and integrated; keep
   its source boundary disjoint from Dashboard/TL/TT UX work.
7. After DEMAND-C01, run UX-C01, TL-RR01 preview, and GEN-C02 in parallel where
   their file ownership is disjoint.
8. Resolve GEN-C02 hard blockers and produce a zero-hard-blocker generation
   preview.
9. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- TERM-CONSUME-C02 in a fresh worktree, limited to EnrollPro term adapters,
  explicit rollover cache persistence, Subjects authority projection, and
  focused tests.
- MIG-GUARD-R1 source/test correction, with no live migration.
- TT-UX01R2 in its existing client worktree. Avoid further shared primitive
  changes unless the correction proves they are necessary. Use fixture-backed
  data-filled browser QA and keep live Tailnet generation/write paths untouched.

Do not run DASH-RESILIENCE-C01 concurrently with TERM-CONSUME-C02 because both
touch active-term semantics. Do not start DEMAND-C01, UX-C01, TL-RR01, GEN-C02,
generation, or publication until their dependency rows above are satisfied. Do
not restart the shared runtime while live browser QA is active.

## Awaited returns and decisions

- No Wave-1 executor or QA result is awaited; all three candidates are integrated.
- EnrollPro correction `5887d685` has been pulled and its live contract is
  available. No EnrollPro executor return is awaited.
- TERM-CONSUME-C02 is the immediate contract successor; no executor result
  exists yet. DASH-RESILIENCE-C01 follows it because the two share active-term
  error semantics.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. Runtime deployment remains a separate planner-coordinated action.
- TT-UX01 is awaiting the expanded additive executor correction from
  `aa38d784` under the R2 prompt; the current candidate is not
  integration-ready and live generation remains unauthorized.
- TL-UX-C01/C01R is integrated (`2aad67a3` merged at `151f02ee`); no TL
  executor result is awaited. Its DB-backed apply test remains unrun because the
  isolated worktree had no test database.

## Update protocol

For each status change, update the affected row, the queue, safe parallel work,
and awaited returns in the same planner turn. Record only current concise truth
here; put detailed commands, test counts, findings, and correction history in
the stream's progress ledger and Git commits.
