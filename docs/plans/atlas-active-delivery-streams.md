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
  TERM-CONSUME-C02 is independently accepted at `a55abf7e`, integrated by the
  primary planner at `5fa9b227`, and pushed through main `bb5cd487`.
  TL-UX-C01R2, DASH-RESILIENCE-C01, and MIG-GUARD-R1 have now passed primary
  planner verification and are combined on `integration/readiness-20260911`.
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
| TERM-CONSUME-C02 | Accept EnrollPro ordered term structure independently from nullable current-term state and cache it through explicit rollover sync | `INTEGRATED` | MEDIUM cross-layer authority | `work/term-consume-c02`; `e7121e75...a55abf7e`; integration `5fa9b227`; main `bb5cd487` | Deployment remains separate | Primary planner reproduced 8/8 C02 unit, 13/13 authority unit, 32/32 PostgreSQL cache/zero-write, mounted HTTP 1/1, both type-checks, and both production builds | Closed and pushed to `origin/main`; deploy only after TL-UX-C01R2 and Dashboard resilience close |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `INTEGRATED` | LOW | `work/migration-guard-r1`; `ec7d54ed...63bf48eb`; integration commits `be4b4a16` + `bb499bf3` | None | Primary planner reproduced 31/31, TypeScript, production build, canonical-schema negative control, and zero-spawn failure ordering | Closed; use the guarded wrapper for future migrations, but do not re-run migration 0001 |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify the corrected EnrollPro term contract | `PLANNED` | MEDIUM service lifecycle | Current integration branch; isolated build passed | Coordinate with live browser activity; source integration is not deployment authority | Combined server/client type-checks and production builds pass after Dashboard, Teaching Load authority, and migration-guard integration | Perform one bounded shared-runtime deployment and Tailnet acceptance; no data apply, generation, or publication |
| DASH-RESILIENCE-C01 | Preserve saved Dashboard truth and typed term state when EnrollPro or one ATLAS read is unavailable | `INTEGRATED` | MEDIUM cross-layer read path | `work/dashboard-resilience-c01`; `ec7d54ed...9b05a7c6`; integration `47a4405d` | Deployment remains separate | Primary planner reproduced 9/9 resilience, 38/38 HTTP authority, 11/11 server lifecycle, 12/12 client lifecycle, term-authority coverage, both type-checks, and both builds | Closed in source; verify saved-data and typed unresolved-term UX during bounded runtime deployment |
| TL-UX-C01R2 | Correct the integrated Teaching Load suggestion apply authority | `INTEGRATED` | HIGH write/concurrency guards | `work/teaching-load-ux-c01r2`; `ec7d54ed...52224ce3`; integration `1d9a06ec` | Live suggestion apply remains a separate HIGH action | Primary planner reproduced 61/61 disposable-PostgreSQL authority, 13/13 distribution, write-authority and 56/56 policy suites; combined type/build gates passed | Closed in source; do not invoke suggestion apply without its own reviewed preview and explicit approval |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `INTEGRATED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...b0f607bb`; merged at `a0ca05e5` | None | Primary planner reproduced 58/58 focused, 179/179 full client suite, TypeScript, candidate-to-main source parity, and clean integration diff | Closed; one-click clean placement + prominent Undo is accepted for now. Plan narrow Advanced Requests and duplicate-publish cleanup later |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `CORRECTION_REQUIRED` | MEDIUM cross-layer authority | `work/derived-demand-c01`; `ec7d54ed...422460fa` | C01R closes its original six defects, but downstream publication/revision/routes/client still reject or hide Q4 and the expanded generation snapshot remains schema version 1 | Primary planner reproduced the focused demand/TL/timetable/publication gates and confirmed hard-coded 1..3 production consumers plus the unversioned snapshot shape; the protected PostgreSQL concurrency suite correctly refused the non-disposable live-like DB target | Execute `docs/prompts/derived-demand-authority-c01r2-ordered-term-consumer-closure-2026-09-11.md` as one additive correction; do not integrate `422460fa` |
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

1. TL-UX-C01R2, DASH-RESILIENCE-C01, and MIG-GUARD-R1 are integrated; coordinate
   one bounded runtime deployment without interrupting live QA.
2. TT-UX01R2 Simple-operator closure is independently ratified at `a0ca05e5`; no further
   TT-UX01 integration step remains.
3. Complete DEMAND-C01R2 as one ordered-term consumer closure on its existing
   branch, then commission fresh independent QA over the complete immutable
   range.
4. After DEMAND-C01, run UX-C01, TL-RR01 preview, and GEN-C02 in parallel where
   their file ownership is disjoint.
5. Resolve GEN-C02 hard blockers and produce a zero-hard-blocker generation
   preview.
6. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- DEMAND-C01R2 is the active cross-layer authority lane; do not run another
  demand, generation, publication, revision, or timetable-term consumer lane
  against its unaccepted contract.
- A bounded Wave-1 runtime deployment is safe only when no executor is using
  the shared Tailnet runtime for browser evidence.

Do not integrate the current DEMAND-C01 candidate or start UX-C01, TL-RR01,
GEN-C02, generation, or publication until DEMAND-C01R passes fresh independent
QA. Do not restart the shared runtime while live browser QA is active.

## Awaited returns and decisions

- DEMAND-C01R2 executor correction and a fresh independent QA verdict are
  awaited. Candidate `422460fa` is rejected for integration.
- EnrollPro correction `5887d685` has been pulled and its live contract is
  available. No EnrollPro executor return is awaited.
- TERM-CONSUME-C02, DASH-RESILIENCE-C01, TL-UX-C01R2, and MIG-GUARD-R1 are
  accepted and integrated; no executor return remains for those streams.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. Runtime deployment remains a separate planner-coordinated action.
- TT-UX01R2 is ratified at `a0ca05e5`; the primary planner accepts the bounded
  one-click clean-placement + prominent Undo contract. Advanced Requests and
  duplicate-publish cleanup remain non-blocking follow-ups.
- The shared runtime still needs the bounded deployment/Tailnet acceptance;
  source integration alone does not authorize data apply, generation, or
  publication.

## Update protocol

For each status change, update the affected row, the queue, safe parallel work,
and awaited returns in the same planner turn. Record only current concise truth
here; put detailed commands, test counts, findings, and correction history in
the stream's progress ledger and Git commits.

For new implementation phases, prefer the largest coherent one-shot packet
that can be completed and independently reviewed without crossing an unmet
dependency, an unresolved product decision, a conflicting worktree boundary,
or a separate HIGH action. Do not split one production contract into ceremonial
micro-phases. Keep review-found corrections narrow and additive, and keep live
data applies, generation, publication, migration, deployment, and other locked
actions behind their own explicit gates.
