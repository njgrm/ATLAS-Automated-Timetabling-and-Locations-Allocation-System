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
  TT-UX01R2 is independently ratified at integration merge `a0ca05e5`.
  TERM-CONSUME-C02 is independently accepted at `a55abf7e` and integrated by
  the primary planner at `5fa9b227`. TL-UX-C01/C01R was pushed by a QA delegate
  at `151f02ee`, but primary-planner re-review found material suggestion-apply
  authority gaps; that integrated feature is now `CORRECTION_REQUIRED` and
  must not be deployed or used for writes until TL-UX-C01R2 is accepted.
- All three source lanes passed independent QA and the combined integration
  gates. The approved term schema migration is applied and verified; deploying
  the integrated runtime remains a separate service-lifecycle action.
- The EnrollPro fork and canonical READ_ONLY clone were fast-forwarded to
  correction commit `5887d685`. Live probes confirm the authoritative ordered
  three-term contract for year 9 / `2030-2031` and strict malformed-ID
  rejection. The live typed `ACTIVE_TERM_UNRESOLVED` response is expected while
  the host date remains in 2026; ATLAS currently mislabels it as unreachable.
  The READ_ONLY AIMS fork and local reference clone were fast-forwarded cleanly
  to upstream commit `2332d92e`; SMART remains at `c3806e12`.
- No carry-forward, generation, or publication is authorized by this register.

## Stream register

| Stream | Objective | State | Risk | Git boundary | Dependency or blocker | Last decisive evidence | Exact next action |
|---|---|---|---|---|---|---|---|
| GEN-ZW01 | Make generation passive over Teaching Load and close actor/audit/write authority | `INTEGRATED` | MEDIUM | `work/generation-zw01`; `e39da520...00488bbf` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| RR-UX01 | Visible rollover awareness, one Year Setup status surface, and read-only archived Teaching Load | `INTEGRATED` | MEDIUM | `work/rollover-rrux01`; `00488bbf...ea44e155` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| TERM-SUBJ-C01 | Consume exact EnrollPro term authority and prepare Subject scheduling metadata without false operative controls | `INTEGRATED` | MEDIUM source; HIGH live migration | `work/term-subject-c01`; `e39da520...8abc2ab1` | Live migration remains separate | Independent QA passed 13/13 server authority and 11/11 client controls; combined builds passed | Prepare the separate live migration preview; do not apply without HIGH approval |
| W1-INTEGRATION | Combine the three accepted Wave-1 source lanes | `INTEGRATED` | MEDIUM | `integration/rollover-derived-demand-w1`; `e39da520...36c5d3d1` | None | Shared-doc-only conflicts matched forecast; focused GEN/RR/TERM suites, both builds/type-checks, diff-check, and isolated server health passed | Closed and pushed to `origin/main` at `36c5d3d1` |
| ENROLLPRO-TERM-HANDOFF | Make EnrollPro expose authoritative ordered term identities, labels, dates, and active term | `ACCEPT_READY` | External dependency; READ_ONLY QA | EnrollPro `396a9892...5887d685`; canonical mirror `D:\EnrollPro` clean at `5887d685` | ATLAS consumption and deployment remain separate | Source review confirms strict integer parsing and validate-before-write term mutation; live probes return the ordered three-term year-9 contract, reject malformed/duplicate IDs with typed 400s, and return truthful 409 `ACTIVE_TERM_UNRESOLVED` for the 2026/2030 calendar mismatch | Consume the corrected contract in ATLAS; do not edit the EnrollPro mirror |
| TERM-CONSUME-C02 | Accept EnrollPro ordered term structure independently from nullable current-term state and cache it through explicit rollover sync | `INTEGRATED` | MEDIUM cross-layer authority | `work/term-consume-c02`; `e7121e75...a55abf7e`; integration `5fa9b227` | Deployment remains separate | Primary planner reproduced 8/8 C02 unit, 13/13 authority unit, 32/32 PostgreSQL cache/zero-write; passive read has zero writes and rollover is the explicit cache writer | Closed into the integration branch; push after final combined gates |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `PLANNED` | LOW | Fresh branch from current `origin/main` | None; must preserve backup revalidation and spawn ordering | First live invocation passed its backup gate but Prisma stopped before migration because the wrapper omitted `../prisma/schema.prisma`; supported forwarded argument succeeded | Implement a narrow command-path correction with failing-first spawn-argument coverage; no live migration |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify the corrected EnrollPro term contract | `BLOCKED` | MEDIUM service lifecycle | Current `origin/main`; isolated build before shared-runtime action | DASH-RESILIENCE-C01 and TL-UX-C01R2 must be integrated; coordinate live browser runs | Port 5001 is healthy but serves the pre-integration bundle; the current main contains a TL suggestion apply path that primary QA has marked do-not-deploy | Correct TL suggestion authority and integrate Dashboard resilience, then perform one bounded build/restart/Tailnet acceptance |
| DASH-RESILIENCE-C01 | Preserve saved Dashboard truth and typed term state when EnrollPro or one ATLAS read is unavailable | `PLANNED` | MEDIUM cross-layer read path | Fresh worktree from current `origin/main` | May run beside TL/TT UX; avoid their files and all data mutation | Live EnrollPro health/year routes are 200 and Dashboard saved counts are 20 sections/22 subjects/42 faculty/98 teaching rooms, but ATLAS maps typed active-term 409 to unreachable and its legacy fallback substitutes zeros/empties on failed reads | Execute `docs/prompts/dashboard-stale-readiness-correction-2026-09-11.md`; commit and return a reviewed read-only candidate |
| TL-UX-C01R2 | Correct the integrated Teaching Load suggestion apply authority | `CORRECTION_REQUIRED` | HIGH write/concurrency guards | Integrated precursor `36c5d3d1...2aad67a3` at merge `151f02ee`; fresh correction branch required | Primary review found unreviewed legacy-plan moves, partial in-transaction revalidation, stale move minutes/qualification authority, and default/credited cap drift | Unit gates remain green, but no PostgreSQL apply fixture existed and source inspection disproves the claimed all-authority revalidation | Execute `docs/prompts/teaching-load-ux-suggestion-authority-correction-tluxc01r2-2026-09-11.md`; do not deploy or invoke suggestion apply |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `INTEGRATED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...b0f607bb`; merged at `a0ca05e5` | None | Primary planner reproduced 58/58 focused, 179/179 full client suite, TypeScript, candidate-to-main source parity, and clean integration diff | Closed; one-click clean placement + prominent Undo is accepted for now. Plan narrow Advanced Requests and duplicate-publish cleanup later |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `PLANNED` | MEDIUM | Fresh branch from post-TERM integration main | Keep its source boundary disjoint from TL suggestion correction and Dashboard resilience | TERM-CONSUME-C02 now supplies the ordered structure without requiring a current active term; governing sequence exists in `rollover-derived-demand-generation-readiness-sequence-2026-09-10.md` | Prepare/execute the derived-demand prompt after this integration push |
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
| TL-UX-C01 / TL-UX-C01R | `SUPERSEDED` | The UI consolidation remains useful, but its integrated suggestion-apply authority is superseded by TL-UX-C01R2 correction work; do not deploy the write path as accepted |
| Year-8 SCA/TL data applies | `CLOSED` | Historical transition completed; do not mistake those applies for automatic authority in the newly rolled-over year |

## Dependency-ordered queue

1. Push the independently accepted TERM-CONSUME-C02 integration.
2. Execute TL-UX-C01R2 against the current main; keep the integrated suggestion
   apply path do-not-deploy until its PostgreSQL authority suite passes.
3. Execute DASH-RESILIENCE-C01 after TERM-CONSUME-C02 so expired sessions and
   typed active-term states cannot appear as empty school data, then coordinate
   one integrated runtime deployment without interrupting live QA.
4. Correct the guarded command's default Prisma schema path; do not re-run the
   already applied migration.
5. TT-UX01R2 Simple-operator closure is independently ratified at `a0ca05e5`; no further
   TT-UX01 integration step remains.
6. Execute DEMAND-C01 from the post-TERM main; keep
   its source boundary disjoint from Dashboard/TL/TT UX work.
7. After DEMAND-C01, run UX-C01, TL-RR01 preview, and GEN-C02 in parallel where
   their file ownership is disjoint.
8. Resolve GEN-C02 hard blockers and produce a zero-hard-blocker generation
   preview.
9. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- TL-UX-C01R2 in a fresh worktree, confined to Teaching Load suggestion
  preview/apply authority and a disposable PostgreSQL fixture; no live apply.
- DASH-RESILIENCE-C01 now that TERM-CONSUME-C02 is integrated.
- MIG-GUARD-R1 source/test correction, with no live migration.
- DEMAND-C01 may run in parallel only with a disjoint derived-demand boundary
  that does not edit TL suggestion or Dashboard files.

Do not start UX-C01, TL-RR01, GEN-C02,
generation, or publication until their dependency rows above are satisfied. Do
not restart the shared runtime while live browser QA is active.

## Awaited returns and decisions

- No Wave-1 executor or QA result is awaited; all three candidates are integrated.
- EnrollPro correction `5887d685` has been pulled and its live contract is
  available. No EnrollPro executor return is awaited.
- TERM-CONSUME-C02 is accepted and integrated; no executor return remains.
  DASH-RESILIENCE-C01 and DEMAND-C01 are now unlocked within disjoint bounds.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. Runtime deployment remains a separate planner-coordinated action.
- TT-UX01R2 is ratified at `a0ca05e5`; the primary planner accepts the bounded
  one-click clean-placement + prominent Undo contract. Advanced Requests and
  duplicate-publish cleanup remain non-blocking follow-ups.
- TL-UX-C01R2 is awaiting a fresh executor correction. The pushed predecessor
  is not deployment-ready and its suggestion apply must not be invoked.

## Update protocol

For each status change, update the affected row, the queue, safe parallel work,
and awaited returns in the same planner turn. Record only current concise truth
here; put detailed commands, test counts, findings, and correction history in
the stream's progress ledger and Git commits.
