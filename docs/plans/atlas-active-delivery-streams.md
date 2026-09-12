# ATLAS Active Delivery Streams

Last reconciled: 2026-09-12 (Asia/Manila)

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

- Readiness-wave cycle `readiness-wave-20260911` (COMPLETE): GEN-C02R1
  (`6f7b3c52...b1348113`) is integrated at `c3744dc6`, UX-C01R
  (`89440321...9e280369`) at `fc8796c6`, and TL-RR01R (`95ceedf9...f66ca392`)
  at `8f210d7c`. All three passed fresh independent QA (`ACCEPT_READY`, only
  NON_BLOCKING documentation/coverage findings); combined client/server
  type-checks, builds, focused suites, disposable-PostgreSQL zero-write checks,
  `git diff --check`, and isolated built-server mount probes passed on all three
  integration trees. The dirty `D:/ATLAS` checkout was never an integration
  boundary.
- Cycle recovery: `readiness-wave-20260911` (COMPLETE) closed 2026-09-11
  (Asia/Manila); QA tasks `ses_f6f668ffcffe1ULPdPjVT04A7C` (GEN),
  `ses_f6f66737affeT2ec6hA674pxcm` (UX), `ses_f6f665c6cffeQ8ofy3A5E64vGS` (TL);
  merges `c3744dc6` / `fc8796c6` / `8f210d7c`; no return remains.
- Cycle recovery: `rrtc01-20260911` (COMPLETE) closed 2026-09-11
  (Asia/Manila). RR-TERM-CACHE-C01 candidate `45f08955` (base `77894b7a`),
  executor task `ses_f6eec5975ffeSK3zIMF5TJH8QZ`, fresh QA task
  `ses_f6ed2bab5ffeWTf6B3FlAyh8cI` (`ACCEPT_READY` 17/17, blocked 0,
  unperformed 0), integrated by the primary planner at merge `8c0a1207`
  (see stream row for integration-tier reruns); no return remains.
- Cycle recovery: `rrtc01r-20260912` (COMPLETE) closed 2026-09-12
  (Asia/Manila). RR-TERM-CACHE-C01R candidate `86376ba7` (base `904818d4`),
  executor task `ses_f6eb907c8ffe6wL543zVg9J8vf`, fresh QA task
  `ses_f6ea90129ffeLNAgqyXpBndWvg` (`ACCEPT_READY` 17/17, blocked 0,
  unperformed 0), integrated by the primary planner at merge `a1256506`; the
  bounded deployment packet is prepared at
  `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`. No return
  remains.
- Cycle recovery: `rrtc01r2-20260912` (RUNNING) started 2026-09-12 (Asia/Manila).
  Objective: correct the session-bound actor-school resolver cache and the HIGH
  deployment packet's impossible start-before-stop ordering; no deployment is
  authorized by this cycle. Owned worktree
  `D:/ATLAS-worktrees/rr-term-cache-c01r2` / `work/rr-term-cache-c01r2` (base
  `781a457f`); candidate pending. Next recoverable action: validate the executor
  candidate identity, dispatch fresh QA on the immutable range, then
  integrate/push and repin the deployment packet to the final integrated SHA.
- Cycle recovery: `w1-runtime-deploy-20260911`
  (`DEPLOYED_ACCEPTANCE_INCOMPLETE`) updated 2026-09-11
  22:52 Asia/Manila. The approved HIGH `W1-RUNTIME-DEPLOY` packet was executed:
  product `fdd0c8c7` is deployed live (server PID 11564 + client PID 6756 from
  `D:/ATLAS-worktrees/w1-runtime-deploy`) with Tailnet health 200, rollover
  automation disabled, and zero unauthorized writes (SIGNATURE_DIFFS=0; audit
  232→232). Executor task `ses_f6f297342ffes5Eg42fvNe7GbE` returned
  `REVIEW_REQUIRED` (candidate `1ead5622`, docs-only); fresh QA task
  `ses_f6f13d9a2ffew9fdIM6xu3sY1q` returned `ACCEPT_READY`, but primary-planner
  audit rejects that terminal verdict because four mandatory authenticated or
  diagnostic rows were unperformed. Evidence is integrated at `ed44d62f`; this
  records a successful deployment, not complete acceptance. The live rollover
  preview reads year drift `aligned`/`NONE`, while the active mirror has no
  persisted term contract. Canonical derived demand therefore fails closed with
  `TERM_STRUCTURE_UNAVAILABLE`; year alignment must not be interpreted as global
  no-action readiness. Read-only DB verification also shows year 9 already has
  88 FacultySubject rows, 265 ownerships, and a POPULATED v2 cycle;
  `teachingLoadResetRequired: true` is a dummy-reset-preview field, not proof that
  active-year Teaching Load should be reset. No rollover sync, Teaching Load
  mutation, generation, or publication is authorized.
- Wave 1 and subsequent accepted planner evidence are integrated and pushed.
  TT-UX01R2 is independently ratified at integration merge `a0ca05e5`.
  TERM-CONSUME-C02 is independently accepted at `a55abf7e`, integrated by the
  primary planner at `5fa9b227`, and pushed through main `bb5cd487`.
  TL-UX-C01R2, DASH-RESILIENCE-C01, and MIG-GUARD-R1 have now passed primary
  planner verification and are combined on `integration/readiness-20260911`.
- TL-RR01 is independently accepted and integrated as merge `618589dc`; the
  planner pushed it to `origin/main` (`8052d727...618589dc`) after a docs-only
  `CHANGELOG.md` union conflict. That was an intermediate transition; final
  `origin/main` for this reconciliation is `282dca6a`.
- All three source lanes passed independent QA and the combined integration
  gates. The approved term schema migration is applied and verified; deploying
  the integrated runtime remains a separate service-lifecycle action.
- DEMAND-C01 through C01R2 is independently accepted and integrated at
  `b96caf40`. Derived demand and ordered-term consumers now share one authority;
  live use still requires the bounded runtime deployment and explicit rollover
  term-cache sync.
- The EnrollPro fork and canonical READ_ONLY clone were fast-forwarded to
  correction commit `5887d685`. Live probes confirm the authoritative ordered
  three-term contract for year 9 / `2030-2031` and strict malformed-ID
  rejection. The live typed `ACTIVE_TERM_UNRESOLVED` response is expected while
  the host date remains in 2026; ATLAS currently mislabels it as unreachable.
  The READ_ONLY AIMS fork and local reference clone were fast-forwarded cleanly
  to upstream commit `2332d92e`; SMART remains at `c3806e12`.
- No carry-forward apply, generation, or publication is authorized by this
  register.

## Stream register

| Stream | Objective | State | Risk | Git boundary | Dependency or blocker | Last decisive evidence | Exact next action |
|---|---|---|---|---|---|---|---|
| GEN-ZW01 | Make generation passive over Teaching Load and close actor/audit/write authority | `INTEGRATED` | MEDIUM | `work/generation-zw01`; `e39da520...00488bbf` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| RR-UX01 | Visible rollover awareness, one Year Setup status surface, and read-only archived Teaching Load | `INTEGRATED` | MEDIUM | `work/rollover-rrux01`; `00488bbf...ea44e155` | None | Independent QA and combined Wave-1 integration gates passed | Closed into `origin/main` at `36c5d3d1` |
| TERM-SUBJ-C01 | Consume exact EnrollPro term authority and prepare Subject scheduling metadata without false operative controls | `INTEGRATED` | MEDIUM source; HIGH live migration | `work/term-subject-c01`; `e39da520...8abc2ab1` | None in source; migration is already closed separately | Independent QA passed 13/13 server authority and 11/11 client controls; combined builds passed | Closed in source; migration 0001 is recorded under TERM-LIVE-APPLY and must not be re-run |
| W1-INTEGRATION | Combine the three accepted Wave-1 source lanes | `INTEGRATED` | MEDIUM | `integration/rollover-derived-demand-w1`; `e39da520...36c5d3d1` | None | Shared-doc-only conflicts matched forecast; focused GEN/RR/TERM suites, both builds/type-checks, diff-check, and isolated server health passed | Closed and pushed to `origin/main` at `36c5d3d1` |
| ENROLLPRO-TERM-HANDOFF | Make EnrollPro expose authoritative ordered term identities, labels, dates, and active term | `ACCEPT_READY` | External dependency; READ_ONLY QA | EnrollPro `396a9892...5887d685`; canonical mirror `D:\EnrollPro` clean at `5887d685` | Runtime deployment/acceptance remains separate | Source review confirms strict integer parsing and validate-before-write term mutation; live probes return the ordered three-term year-9 contract, reject malformed/duplicate IDs with typed 400s, and return truthful 409 `ACTIVE_TERM_UNRESOLVED` for the 2026/2030 calendar mismatch; ATLAS consumption is integrated through TERM-CONSUME-C02 | Keep the mirror READ_ONLY; verify the integrated consumer against the matched deployed runtime |
| TERM-CONSUME-C02 | Accept EnrollPro ordered term structure independently from nullable current-term state and cache it through explicit rollover sync | `INTEGRATED` | MEDIUM cross-layer authority | `work/term-consume-c02`; `e7121e75...a55abf7e`; integration `5fa9b227`; main `bb5cd487` | Deployment remains separate | Primary planner reproduced 8/8 C02 unit, 13/13 authority unit, 32/32 PostgreSQL cache/zero-write, mounted HTTP 1/1, both type-checks, and both production builds | Closed and pushed to `origin/main`; deploy only after TL-UX-C01R2 and Dashboard resilience close |
| TERM-LIVE-APPLY | Apply the accepted Subject/term schema migration to the verified ATLAS database | `CLOSED` | HIGH | `work/term-live-migration-preview`; `36c5d3d1...1520d1fc` | None | Exact operator approval received; guarded wrapper revalidated the approved backup; `0001` applied; enum/columns exact; 21 scheduled + one canonical-HG reference-only; protected domains unchanged; receipt at `docs/verification/term-subject-live-migration-apply-2026-09-11.md` | Closed at evidence commit `1520d1fc`; rollback remains available but was not executed |
| MIG-GUARD-R1 | Make the canonical guarded migration command locate the root Prisma schema without manual forwarded arguments | `INTEGRATED` | LOW | `work/migration-guard-r1`; `ec7d54ed...63bf48eb`; integration commits `be4b4a16` + `bb499bf3` | None | Primary planner reproduced 31/31, TypeScript, production build, canonical-schema negative control, and zero-spawn failure ordering | Closed; use the guarded wrapper for future migrations, but do not re-run migration 0001 |
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify the corrected EnrollPro term contract | `DEPLOYED_ACCEPTANCE_INCOMPLETE` | HIGH shared-runtime deployment/cutover | Deployed `fdd0c8c7` live; evidence `fdd0c8c7...1ead5622` merged at `ed44d62f` | Four mandatory authenticated/diagnostic rows remain blocked; active year 9 is aligned but its required persisted term snapshot is missing | Deployment identity, rollover-disabled log, localhost/Tailnet health, unauthenticated responsive pages, and zero unauthorized DB writes are independently verified. QA's global `ACCEPT_READY` is rejected because mandatory Stage C/D checks were not run | Blocked until `RR-TERM-CACHE-C01R2` is accepted, integrated, and the packet is repinned to the final integrated SHA; then execute the corrected deployment packet `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`, then complete the separately approved catch-up and authenticated Stage C/diagnostic |
| RR-TERM-CACHE-C01 | Separate year alignment from persisted ordered-term readiness and provide one narrow, previewed term-cache catch-up path | `INTEGRATED` | MEDIUM source; HIGH future cache apply | `work/rr-term-cache-c01`; `77894b7a...45f08955`; merge `8c0a1207` | Live term-cache apply remains separately gated | Fresh QA ACCEPT_READY 17/17 (blocked 0, unperformed 0); planner pre-QA reproduced status 11/11 and client 6/6; integration-tier reruns C02 8/8, cache-instrumentation 32/32 zero-residue, lifecycle 208/0, rr-ux01 pass; both builds/startup previously verified; rollover-automation suite not independently rerun (seeded-disposable only; all changed-field assertions expect false and the change is strictly more conservative) | Closed in source; its deployment is superseded by the RR-TERM-CACHE-C01R correction (merge `a1256506`), which must be deployed before the reviewed term-cache catch-up preview |
| RR-TERM-CACHE-C01R | Close term-authority JWT/actor-school authority, client school-1 defaults, and in-transaction complete active-year election | `INTEGRATED` | MEDIUM source; HIGH future cache apply | `work/rr-term-cache-c01r`; `904818d4...86376ba7`; merge `a1256506` | Live term-cache apply remains separately gated | Fresh QA ACCEPT_READY 17/17 (blocked 0, unperformed 0): mounted JWT/system-token matrix with zero dispatch, no school-1 defaults, fail-closed actor-scoped wrapper, scope-transition clearing, in-transaction complete-set re-election (`ACTIVE_YEAR_AMBIGUOUS`, zero writes), replay/audit invariants, both tsc/builds, isolated built-server 401s; integration gates rerun on the merged tree | Closed in source; execute the prepared bounded deployment packet, then prepare the reviewed term-cache catch-up preview and stop for its separate HIGH approval |
| RR-TERM-CACHE-C01R2 | Bind the client actor-school resolver cache to the authenticated token epoch and make the deploy packet's listener sequence executable (stop-then-start with per-stage rollback) | `RUNNING` | MEDIUM source + docs; deployment stays HIGH | `work/rr-term-cache-c01r2`; base `781a457f`; candidate pending | None in source; live deployment remains separately gated | Planner audit of the integrated C01R source found a module-lifetime `cachedActorSchoolId` cache that survives logout/re-login/late `/auth/me` responses, and section 3 of the prepared packet requires starting new listeners before stopping incumbents | Execute the bounded correction packet; fresh QA on the immutable range; integrate and push; then repin the packet to the final integrated SHA |
| DASH-RESILIENCE-C01 | Preserve saved Dashboard truth and typed term state when EnrollPro or one ATLAS read is unavailable | `INTEGRATED` | MEDIUM cross-layer read path | `work/dashboard-resilience-c01`; `ec7d54ed...9b05a7c6`; integration `47a4405d` | Deployment remains separate | Primary planner reproduced 9/9 resilience, 38/38 HTTP authority, 11/11 server lifecycle, 12/12 client lifecycle, term-authority coverage, both type-checks, and both builds | Closed in source; verify saved-data and typed unresolved-term UX during bounded runtime deployment |
| TL-UX-C01R2 | Correct the integrated Teaching Load suggestion apply authority | `INTEGRATED` | HIGH write/concurrency guards | `work/teaching-load-ux-c01r2`; `ec7d54ed...52224ce3`; integration `1d9a06ec` | Live suggestion apply remains a separate HIGH action | Primary planner reproduced 61/61 disposable-PostgreSQL authority, 13/13 distribution, write-authority and 56/56 policy suites; combined type/build gates passed | Closed in source; do not invoke suggestion apply without its own reviewed preview and explicit approval |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `INTEGRATED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...b0f607bb`; merged at `a0ca05e5` | None | Primary planner reproduced 58/58 focused, 179/179 full client suite, TypeScript, candidate-to-main source parity, and clean integration diff | Closed; one-click clean placement + prominent Undo is accepted for now. Plan narrow Advanced Requests and duplicate-publish cleanup later |
| DEMAND-C01 | Replace annual Curriculum Requirements authority with one deterministic derived-demand contract | `INTEGRATED` | MEDIUM cross-layer authority | `work/derived-demand-c01`; `ec7d54ed...c9263b5f`; integration `b96caf40` | Live deployment and explicit rollover term-cache sync remain separate | Primary planner reproduced C01/C01R/C01R2 authority, timetable, publication, term, TypeScript, and production-build gates; doc-only merge conflicts were reconciled | Closed in source; verify derived year-9 demand during bounded runtime deployment/sync |
| UX-C01R | Gate every Timetable generation action on the canonical generation diagnostic; stop Dashboard overclaiming final readiness | `INTEGRATED` | MEDIUM UI with HIGH interaction guardrails | `work/ux-c01-derived-setup`; `89440321...9e280369`; merge `fc8796c6` | Combined positive readiness browser matrix belongs to the bounded runtime deployment | Fresh independent QA ACCEPT_READY: 36/36 UX-C01R + 58/58 operator UX + 21/21 guardrails client; 6/6 + 11/11 + 9/9 + 5/5 server incl. disposable-PostgreSQL zero-write; both tsc/build; field-for-field contract parity; integration gates and isolated mount probe reproduced on the merged tree; runtime-map attribution corrected at integration | Closed in source; verify the positive readiness UX during the bounded runtime deployment |
| TL-RR01 | Preview and optionally carry forward last year's Teaching Load into empty current-year demand | `INTEGRATED` | MEDIUM preview; HIGH apply | `work/teaching-load-carry-forward-tlrr01`; `89440321...23eae7de`; integration merge `618589dc` | Live preview requires deployed demand authority and synced year-9 terms; apply remains separately gated | Independent QA ACCEPT_READY: reproduced 8/8 authority+mutant, 11/11 client helpers, 60/60 disposable-PostgreSQL mounted-route, server/client type-checks+builds, health 200 on a live built process; the pre-existing `teaching-load-reconciliation-route.test.ts` failure reproduced identically on base and candidate; only `CHANGELOG.md` conflicted (docs-only union) | Closed in source at `origin/main` `618589dc`; do not invoke carry-forward apply without a separate reviewed preview and explicit HIGH approval |
| TL-RR01R | Correct integrated carry-forward grade authority, workload-policy gating, and actor identity | `INTEGRATED` | MEDIUM preview; HIGH apply | `work/teaching-load-carry-forward-tlrr01r`; `95ceedf9...f66ca392`; merge `8f210d7c` | Live apply remains separately gated | Fresh independent QA ACCEPT_READY: 12/12 authority incl. displayOrder mutants; 87/87 disposable-PostgreSQL mounted suite; tsc/build; active DB untouched; integration reproduced 87/87 on the merged tree plus a built-server mount probe | Closed in source; live preview requires the bounded runtime deployment and year-9 term sync; apply requires its own reviewed preview and explicit HIGH approval |
| GEN-C02R1 | Consume one shared passive preflight in readiness and the real generation trigger; prove stakeholder shape and nonuniform rotation | `INTEGRATED` | MEDIUM source; HIGH generation | `integration/readiness-20260911`; `6f7b3c52...b1348113`; merge `c3744dc6` | None | Fresh independent QA ACCEPT_READY (5/5 production-trigger, 12/12 stakeholder shape, 7/7 rotation, 5/5 actor scope, 14/14 canonical, 1/1 disposable-PostgreSQL zero-write; tsc/build/startup/diff-check); integration gates reproduced on the merged tree | Closed in source; do not run live generation without its separate fingerprinted preview and explicit HIGH approval |
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
3. GEN-C02R1 (`c3744dc6`), UX-C01R (`fc8796c6`), and TL-RR01R (`8f210d7c`) are
   integrated; no wave follow-up remains before the runtime deployment.
4. W1 deployment evidence is integrated at `ed44d62f` and the runtime is live,
   but acceptance is incomplete. Authenticated Stage C/D awaits an operator
   session decision. RR-TERM-CACHE-C01R is integrated at merge `a1256506`: year
   alignment and persisted term authority stay separate states, and the narrow
   preview/apply repair contract now has JWT-only actor-school authority, no
   client school-1 default, and a complete in-transaction active-year election.
5. `RR-TERM-CACHE-C01R2` (RUNNING, base `781a457f`) is correcting the
   session-bound actor-school resolver cache and the packet's impossible
   start-before-stop ordering; after fresh QA, integration, and repin, execute
   the corrected deployment packet
   (`docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`) in the next
   bounded runtime window, then prepare and independently review the term-cache
   catch-up preview and stop for its separate HIGH approval. After an approved
   catch-up, run the canonical readiness diagnostic for the live school/year.
   Only if it proves zero hard blockers and exact source freshness, prepare the
   fingerprinted generation approval package; otherwise return the typed blocker
   list and corrective handoff.
6. Obtain explicit HIGH approval, generate once, verify the completed run, then
   prepare the separate publication preview and approval.

## Safe parallel work now

- One bounded executor stream is authorized: `RR-TERM-CACHE-C01R2` (client
  actor-school resolver session authority + deploy-packet ordering) in
  `work/rr-term-cache-c01r2`. No other executor stream is authorized.
  RR-TERM-CACHE-C01R source is integrated at merge `a1256506`; no shared-runtime
  action was taken. The W1 deployment is live and its accepted evidence is
  integrated at `ed44d62f`; authenticated acceptance and the canonical
  generation diagnostic remain blocked on an operator session decision.
  Carry-forward apply, suggestion apply, generation, and publication remain
  separately gated.
- Shared `CHANGELOG.md`, runtime source maps, and this register belong to the
  integration owner; executor documentation overlap is resolved at integration.
- A bounded runtime deployment is safe only when no executor is using the
  shared Tailnet runtime for browser evidence.

DEMAND-C01, TL-RR01, and the readiness-wave streams are integrated. Live
Teaching Load carry-forward apply, suggestion apply, generation, and publication
remain locked behind their separate previews, QA, and explicit approvals. Do not
restart the shared runtime while live browser QA is active.

## Awaited returns and decisions

- No DEMAND executor return remains. DEMAND-C01R2 is integrated at `b96caf40`.
- All three readiness-wave candidates passed fresh QA and are integrated. No
  executor or QA return remains for this wave.
- EnrollPro correction `5887d685` has been pulled and its live contract is
  available. No EnrollPro executor return is awaited.
- TERM-CONSUME-C02, DASH-RESILIENCE-C01, TL-UX-C01R2, and MIG-GUARD-R1 are
  accepted and integrated; no executor return remains for those streams.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. The W1 runtime deployment is integrated and live.
- RR-TERM-CACHE-C01R2 executor return is awaited (fresh QA on the immutable
  range follows, then integration, push, and deployment-packet repin).
- TT-UX01R2 is ratified at `a0ca05e5`; the primary planner accepts the bounded
  one-click clean-placement + prominent Undo contract. Advanced Requests and
  duplicate-publish cleanup remain non-blocking follow-ups.
- The shared runtime serves `fdd0c8c7` with rollover automation disabled and
  deployment evidence integrated at `ed44d62f`. Its acceptance remains
  incomplete. Next operator decision: a reusable or authorized officer session
  for authenticated Stage C/D (a fresh login write is outside current
  authority). RR-TERM-CACHE-C01R is integrated at `a1256506`; its deployment
  packet is prepared at
  `docs/prompts/rr-term-cache-live-deploy-preview-2026-09-12.md`, and executing
  it plus preparing the separately approved term-cache catch-up preview remain
  the next bounded runtime steps.

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
