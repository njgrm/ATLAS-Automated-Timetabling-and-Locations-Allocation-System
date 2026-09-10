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

- Wave 1 and subsequent accepted planner evidence are integrated and pushed:
  `origin/main` now points to `d2dce4a8d3995eb78e3a08ae897a730987d67d34`.
- All three source lanes passed independent QA and the combined integration
  gates. The approved term schema migration is applied and verified; deploying
  the integrated runtime remains a separate service-lifecycle action.
- The EnrollPro fork was fast-forwarded from upstream and its canonical
  READ_ONLY reference clone now points to `396a9892`. The authoritative ordered
  term implementation is present as the single commit
  `3e282e2b...396a9892` and awaits independent contract QA; its database
  migration remains unapplied. AIMS and SMART reference clones remain at their
  last verified tips `a22c9c88` and `c3806e12`.
- No carry-forward, generation, or publication is authorized by this register.

## Stream register

| Stream | Objective | State | Risk | Git boundary | Dependency or blocker | Last decisive evidence | Exact next action |
|---|---|---|---|---|---|---|---|
| GEN-ZW01 | Make generation passive over Teaching Load and close actor/audit/write authority | `INTEGRATED` | MEDIUM | `work/generation-zw01`; `e39da520...00488bbf` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| RR-UX01 | Visible rollover awareness, one Year Setup status surface, and read-only archived Teaching Load | `INTEGRATED` | MEDIUM | `work/rollover-rrux01`; `00488bbf...ea44e155` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| TERM-SUBJ-C01 | Consume exact EnrollPro term authority and prepare Subject scheduling metadata without false operative controls | `INTEGRATED` | MEDIUM source; HIGH live migration | `work/term-subject-c01`; `e39da520...8abc2ab1` | Live migration remains separate | Independent QA passed 13/13 server authority and 11/11 client controls; combined builds passed | Prepare the separate live migration preview; do not apply without HIGH approval |
| W1-INTEGRATION | Combine the three accepted Wave-1 source lanes | `INTEGRATED` | MEDIUM | `integration/rollover-derived-demand-w1`; `e39da520...36c5d3d1` | None | Shared-doc-only conflicts matched forecast; focused GEN/RR/TERM suites, both builds/type-checks, diff-check, and isolated server health passed | Closed and pushed to `origin/main` at `36c5d3d1` |
| ENROLLPRO-TERM-HANDOFF | Make EnrollPro expose authoritative ordered term identities, labels, dates, and active term | `REVIEW_REQUIRED` | External dependency; READ_ONLY QA | EnrollPro `3e282e2b...396a9892`; canonical mirror `D:\EnrollPro` | Source is delivered; EnrollPro migration is explicitly pending and ATLAS consumption must wait for contract QA | Fork `njgrm/EnrollPro:main` and canonical mirror both resolve `396a9892`; commit adds the ordered-term schema, service, tests, endpoint wiring, label migration, rollover preservation, and documentation across 20 paths | Run independent read-only QA of exactly `3e282e2b...396a9892`; return any upstream correction as a developer handoff, never edit EnrollPro from ATLAS |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `PLANNED` | LOW | Fresh branch from current `origin/main` | None; must preserve backup revalidation and spawn ordering | First live invocation passed its backup gate but Prisma stopped before migration because the wrapper omitted `../prisma/schema.prisma`; supported forwarded argument succeeded | Implement a narrow command-path correction with failing-first spawn-argument coverage; no live migration |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify truthful blocked term authority | `PLANNED` | MEDIUM service lifecycle | Current `origin/main`; isolated build before shared-runtime action | Coordinate with any TL-UX live browser run; EnrollPro ordered term contract may still be absent | Port 5001 health is 200 but `/subjects` returns no new disposition projection after migration, proving the live process predates integrated Wave-1 source | Prepare a bounded build/restart/Tailnet acceptance handoff; do not restart while another live-QA stream is using port 5001 |
| TL-UX-C01 | Rebuild Teaching Load as an accessible assignment workspace and unify suggestion/balance authority | `CORRECTION_REQUIRED` | MEDIUM UI and HIGH write/concurrency guards | `work/teaching-load-ux-c01`; `36c5d3d1...1f867eb8` | Do not integrate current candidate; continue additively in the same worktree | Planner reran 11/11 ownership, 33/33 canonical, 21/21 route-intent, client type-check/build; live read-only production probes show 7 faculty at 37.5h, 5 zero-load ESP/FIL teachers, auto-fill 265 `KEPT_EXISTING`/0 suggestions, while rebalance finds 14 valid moves; candidate falsely claims everyone is within capacity and skipped adviser priority | Execute `docs/prompts/teaching-load-ux-allocation-correction-tluxc01r-2026-09-11.md`; return an additive reviewed candidate without live apply |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `CORRECTION_REQUIRED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...aa38d784` | Must not implement DEMAND-C01 or trigger live generation; avoid TL-UX shared paths | Live year 9 has no run; audit found contradictory no-run controls, dead Curriculum Requirements repair, Advanced generation bypass, missing Simple room repair, bulk teacher-leaving mislabeled as class reassignment, color-only placement cues, count-only swap explanations, and state-insensitive help | Execute `docs/prompts/timetable-simple-operator-one-shot-ttux01r2-2026-09-11.md` in the existing worktree; use controlled data-filled browser fixtures plus read-only Tailnet QA |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `PLANNED` | MEDIUM | Fresh branch after Wave-1 integration | Accepted term contract and passive generation/TL boundaries | Governing sequence exists in `rollover-derived-demand-generation-readiness-sequence-2026-09-10.md` | Author and execute the bounded DEMAND-C01 prompt from the integrated Wave-1 base |
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
| Year-8 SCA/TL data applies | `CLOSED` | Historical transition completed; do not mistake those applies for automatic authority in the newly rolled-over year |

## Dependency-ordered queue

1. Correct the guarded command's default Prisma schema path and coordinate one
   integrated Wave-1 runtime deployment without interrupting another live-QA
   stream.
2. Independently QA delivered EnrollPro term commit
   `3e282e2b...396a9892`, then prepare its migration/deployment decision and the
   ATLAS consumption boundary.
3. Correct TL-UX-C01 in its existing worktree so one reviewed suggestion can
   fill uncovered rows and rebalance avoidable excess without false success copy.
4. Execute the expanded TT-UX01R2 Simple-operator closure on its existing
   branch; do not integrate `aa38d784`.
5. Execute DEMAND-C01 after the live term contract and required ATLAS migration
   are available.
6. After DEMAND-C01, run UX-C01, TL-RR01 preview, and GEN-C02 in parallel where
   their file ownership is disjoint.
7. Resolve GEN-C02 hard blockers and produce a zero-hard-blocker generation
   preview.
8. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- Read-only EnrollPro term-contract QA over `3e282e2b...396a9892`; any required
  correction returns to the EnrollPro developer.
- MIG-GUARD-R1 source/test correction, with no live migration.
- TL-UX-C01R in its existing worktree, confined to Teaching Load client/server
  suggestion, allocation, exact ownership, and focused tests; no live apply.
- TT-UX01R2 in its existing client worktree. Avoid further shared primitive
  changes that could collide with TL-UX-C01 unless the correction proves they
  are necessary. Use fixture-backed data-filled browser QA and keep live
  Tailnet generation/write paths untouched.

Do not start DEMAND-C01, UX-C01, TL-RR01, GEN-C02, generation, or publication
until their dependency rows above are satisfied. Do not restart the shared
runtime while TL-UX live QA is active.

## Awaited returns and decisions

- No Wave-1 executor or QA result is awaited; all three candidates are integrated.
- EnrollPro term implementation is delivered at `396a9892`; await independent
  contract QA before migration/deployment or ATLAS consumption.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. Runtime deployment remains a separate planner-coordinated action.
- TT-UX01 is awaiting the expanded additive executor correction from
  `aa38d784` under the R2 prompt; the current candidate is not
  integration-ready and live generation remains unauthorized.
- TL-UX-C01 is awaiting the additive TL-UX-C01R correction; candidate
  `1f867eb8` is not integration-ready.

## Update protocol

For each status change, update the affected row, the queue, safe parallel work,
and awaited returns in the same planner turn. Record only current concise truth
here; put detailed commands, test counts, findings, and correction history in
the stream's progress ledger and Git commits.
