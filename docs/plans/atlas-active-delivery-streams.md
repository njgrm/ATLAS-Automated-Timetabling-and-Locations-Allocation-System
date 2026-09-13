# ATLAS Active Delivery Streams

Last reconciled: 2026-09-13 (Asia/Manila)

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

- Cycle recovery: `tt-tl-runtime-acceptance-20260912` (DEPLOYED_ACCEPTANCE_INCOMPLETE) activated
  2026-09-12 (Asia/Manila) by the operator (`CYCLE ON`) for the packet
  `docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md`: deploy target
  `3d916b26` (contained in `origin/main`; rollback: supervised reset to
  `9d293879`, plus the `d44f29e0` fallback retained as a manual last resort),
  Tailnet-only read-only TT/TL acceptance, stop before any mutation. Planner
  boundary: `integration/tt-tl-runtime-acceptance-20260912`. Pre-action wave
  audit `ses_f6a6a5982ffeHfh3VnGllXY9EW` returned `CORRECTION_REQUIRED`
  (B1: no durable release switch named; B2: `d44f29e0` is not
  supervisor-startable). Packet amended R1 (`b40a22a4`); fresh re-audit
  `ses_f6a60dc69ffeLSEf0CUPZUTEwv` verified B1/B2 resolved and its one
  register-consistency finding is fixed. Primary-planner validation found the
  remaining session-satisfiability gap: point-in-time executor authentication
  neither survives the cutover by itself nor supplies the fresh QA context.
  R3 assigns one retained QA-owned context, a 90-minute action budget plus
  15-minute expiry margin, and an immediate pre-stop recheck. The R3 final
  audit (`ses_f6a0e829bffeYKI1HEUwT13EjU`, 10/9/1) returned
  `CORRECTION_REQUIRED` (F1: out-of-process `cli.mjs stop` cannot durably
  quiesce the resident supervisor); the bounded quiesce correction (supervisor
  process tree + `cli.mjs stop` + at least a 10-second settle window, section 8
  updated) is applied at `9221864b`. The fresh re-audit
  `ses_f6a02e067ffecMsB3E1Wrzr1hV` returned `AUDIT_CLEAR` 10/10 (blocked 0,
  unperformed 0; capsule at
  `docs/reviews/tt-tl-runtime-acceptance-20260912/wave-completion-audit.md`).
  The operator returned the exact R3 approval sentence on 2026-09-12 and
  execution started in the R3 order. The stage-1 QA custodian preflight
  (`ses_f69dad967ffen0hM5EDqWA0Rib`) returned
  `EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`: the persistent profile holds no
  authenticated session (zero cookies, no token, protected routes redirect to
  `/login`). Per the approved sentence the execution stopped before any
  listener, environment, or task change — no deployment occurred; the incumbent
  runtime is untouched. The operator authorized exactly one bounded login
  (2026-09-12) and execution ran in the R3 order: stage-1 custodian
  (`ses_f69d33196ffejxlBcbheFMv8ad`) logged in once and passed 6/6 preflight
  gates (480 min; custody retained); build phase complete
  (`ses_f69cdcf4fffeXGkBqe0X0q9QrD`; target built + verified in
  `D:\ATLAS-runtime-supervised-3d916b26-20260912`); pre-stop recheck PASS
  (470 min); switch phase complete — release `3d916b26` now serving (supervisor
  44336; 5001→30032 / 5174→27408; local health/ready + Tailnet 200; boot task
  re-pointed); acceptance tally 6/4/2/0 with rows 4–5 blocked by
  `TERM_STRUCTURE_UNAVAILABLE` (missing persisted term snapshot); final session
  cleanup complete (logout; `GET /api/v1/auth/me` 401 `NO_TOKEN`; tabs closed).
  Cycle: `DEPLOYED_ACCEPTANCE_INCOMPLETE`. Post-action wave audit complete
  (`ses_f69a14a86ffesfDuO2Q34bYpyW`): `AUDIT_CLEAR` 11/11 (blocked 0,
  unperformed 0) scoped to the deployment; capsule committed at
  `docs/reviews/tt-tl-runtime-acceptance-20260912/wave-completion-audit-postaction.md`.
  The authorized R3 execution login is `LOCAL_LOGIN_SUCCESS` audit id 773
  (2026-09-12T15:13:43Z, actor 46, school 1); earlier auth-only rows 763
  (16:57:46 +08), 764 (17:15:34 +08), and 772 (22:18:33 +08) are disclosed as
  pre-cycle/pre-execution observations with zero mutations — the earlier
  "no other login" wording applies only to the R3 execution window. No
  apply/sync/generation/publication. The reviewed term-cache catch-up preview
  packet is prepared at `docs/prompts/term-cache-catchup-preview-2026-09-13.md`;
  its one-bounded-login authorization is awaited before the preview can run.
- Cycle recovery: `tt-sync-term-c03r4-20260913` (`COMPLETE`)
  activated 2026-09-13 (Asia/Manila) by the operator (`CYCLE ON`) for one
  bounded source correction: worktree `D:\ATLAS-worktrees\tt-sync-term-c03r4`,
  branch `work/tt-sync-term-c03r4`, base `def0dcc9`, frozen candidate `09027671`
  (executor task `ses_f679c8bcfffejOJM5wsSLnzvs7`; additive commits `2c0f3378`,
  `52cb9e35`, `09027671`); fresh QA task `ses_f67812ec1ffeuHBDkIaaZE7Dlg`
  returned `ACCEPT_READY` 19/19/0/0 after independently reproducing controls
  A-K, the mounted zero-dispatch authority matrix, CAS/concurrency/replay, and
  the client contract, with adjudications X1 legacy HG/COHORT, X2
  `SOURCE_AUTHORITY_STALE` interleave, X3 preflight snapshot window, X4
  disposable isolation, and X5 writer inventory all classified NON_BLOCKING
  with evidence. Integrated at merge `5328c9f6`; combined gates green on the
  merged tree (server tsc/build + 11/11 sync suite; client tsc/build + 6/6
  contract suite; `git diff --check`; integrated product tree byte-identical to
  the reviewed candidate). No deployment, live DB, term-cache, Teaching Load,
  generation, or publication action. Wave audit
  `ses_f6772c5e6ffe46xW9W6z7Xo3d0` returned `AUDIT_CLEAR` 16/16/0/0 (capsule at
  `docs/reviews/tt-sync-term-c03r4-20260913/wave-completion-audit.md`); cycle
  `COMPLETE` with origin/main `990d3592` and the docs-only PID reconciliation in
  the closure commit.
- Cycle recovery: `companion-sso-and-term-cache-prep-20260913` (COMPLETE)
  closed 2026-09-13 (Asia/Manila). Phase 1 post-action reconciliation
  `8bcf6ecd`; Phase 2 COMPANION-SSO-C01 base `a284d775` → product `3e0103a3` →
  correction `fbb9dc63` → merge `c989f03d` (executor
  `ses_f69734e0dffem8zaeflO4T4WK6`; round-1 QA
  `ses_f695230a5ffeGQ2waSBqD7Nlxb` `CORRECTION_REQUIRED` 21/19/1/1; fresh QA
  `ses_f694593f8ffe2VZhrp3QQSUkBV` `ACCEPT_READY` 24/24/0/0); Phase 3
  term-cache catch-up preview packet prepared
  (`docs/prompts/term-cache-catchup-preview-2026-09-13.md`,
  `AUTH_SESSION_REQUIRED`); final wave audit
  `ses_f693a866bffeaOWmjfKrP3P45W` `AUDIT_CLEAR` 8/8/0/0 (capsule at
  `docs/reviews/companion-sso-and-term-cache-prep-20260913/wave-completion-audit.md`).
  No product or live mutation beyond the accepted source integration. Hard
  boundaries preserved: `tt-output-c03` untouched; no runtime/task/env/live-data
  action.
- Cycle recovery: `tt-output-c03r3-20260913` (`COMPLETE`)
  activated 2026-09-13 (Asia/Manila) by the operator (`CYCLE ON`) for one
  bounded production-term correction: worktree `D:\ATLAS-worktrees\tt-output-c03`,
  branch `work/tt-output-c03`, frozen candidate `e7deeb91` (`4e5ef1f6...e7deeb91`,
  15 commits; executor task `ses_f698ae6f4ffeEYa2jmNlH5gBCV`); QA rounds
  `ses_f696b93baffe4dPW7LsrSYAW0M` 38/36, `ses_f695442d1ffe568Btme9JM4fN4`
  31/30, `ses_f69440b5cffekqzFdwbc0orOex` 31/31, exact-range
  `ses_f693863c7ffe8xE4rlEp99yjDq` 14/14; integrated at merge `3c2fc2bd` with
  combined gates green; no HIGH action executed. The wave audit
  `ses_f692956d5ffemfOtICwokWAPU3` returned `CORRECTION_REQUIRED` (F1: the
  canonical readiness consumer still validates the pre-resolution scheduler
  output); the bounded `TT-READINESS-TERM-C03R3` correction ran (candidate
  `5256dc5a`, executor `ses_f691cf42affeC4B3iK5TviFgDq`, fresh QA
  `ses_f6914cdc2ffe4ZbvcQq14Kxqw0` `ACCEPT_READY` 17/17/0/0) and is integrated
  at merge `0abfe457` with combined gates green. The fresh wave re-audit
  `ses_f690e4b3fffeQ7Z62jwtkA6X3E` returned `AUDIT_CLEAR` 9/9/0/0 (capsule at
  `docs/reviews/tt-output-c03r3-20260913/wave-completion-audit.md`); cycle
  `COMPLETE`, no return remains.
- Shared runtime (2026-09-12, Asia/Manila): restored under the operator's exact
  HIGH approval (`runtime-supervisor-live-install-restore-20260912`, COMPLETE),
  then deployed to the integrated TT/TL release `3d916b26` under the operator's
  R3 approval. **Current identity (read-only re-verified 2026-09-13 by the
  `tt-sync-term-c03r4` wave audit):** release checkout
  `D:\ATLAS-runtime-supervised-3d916b26-20260912` (HEAD `3d916b26`); listeners
  5001→PID 14960 and 5174→PID 15024 under node PID 3060 (started 2026-09-13
  09:17); local `/api/v1/health` + `/api/v1/health/ready` 200 and Tailnet
  health 200. The previously recorded supervisor PID 44336 and children
  30032/27408 are absent (external restart/PID drift, not work of this cycle).
  Boot task `ATLAS-Runtime-Supervisor` re-pointed to the release at the restore
  execution (ONSTART, `PT0S`, SYSTEM, IgnoreNew; restore-time record, not
  re-verified by the 2026-09-13 read-only probe); legacy
  `ATLAS-DevServer-Temp2` disabled; durable env (outside every Git worktree)
  `D:\ATLAS-runtime-config\atlas-server.env`. Supervised rollback
  `D:\ATLAS-runtime-supervised-20260912` (`9d293879`) intact; `d44f29e0`
  fallback retained at `D:\ATLAS-runtime-fallback-d44-20260912` (manual,
  non-supervised). Port-5175 Vite and the unrelated `tsx` processes were never
  stopped or modified. TT/TL acceptance is `ACCEPTANCE_INCOMPLETE` (rows 4–5
  blocked on the missing persisted term snapshot; see the TT-TL row).
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
- Cycle recovery: `rrtc01r2-20260912` (COMPLETE) closed 2026-09-12
  (Asia/Manila). RR-TERM-CACHE-C01R2 candidate `4489bbbd` (base `781a457f`)
  passed fresh independent QA (`ACCEPT_READY`, mandatory 10/10, blocked 0,
  unperformed 0, with an independent mutant control) and is integrated at merge
  `a633db50`; the deployment packet is repinned in the integration finalization
  commit. No return remains; deployment stays separately gated.
- Cycle recovery: `actor-scope-20260912` (COMPLETE) closed 2026-09-12
  (Asia/Manila). ACTOR-SCOPE-C01 candidate `98ab5e04` (base `a4dcd061`,
  executor task `ses_f6c291590ffeVM4r1kXaujnDIH`) passed fresh independent QA
  task `ses_f6beb313cffeMLFmlIWVzPRpcz` with `ACCEPT_READY` (mandatory 18/18,
  blocked 0, unperformed 0; two independent mutant controls; product tree
  byte-identical to the reviewed candidate) after one bounded correction round
  (round-1 QA task `ses_f6bfb613dffe9yGI2YbSk3OxHL`,
  `CORRECTION_REQUIRED` 16/14/0/0 on tip `42faf6a7`: Sections `?? 0` child
  dispatch with unresolved actor school, and MyDashboard/MySchedule late
  session-A response overwrite). Integrated at merge `d44f29e0` and pushed to
  `origin/main`. Fresh wave-auditor task `ses_f6bdf461dffeyGdMmtYelWWo9x`
  returned `AUDIT_CLEAR` 6/6; its compact capsule is committed at
  `docs/reviews/actor-scope-20260912/wave-completion-audit.md`, and its one
  planner-owned non-blocking runtime-map correction is `0b7fa651`. The
  replacement deploy-as-restore packet is prepared at
  `docs/prompts/actor-scope-deploy-restore-2026-09-12.md`; the old stop-then-start
  swap packet is superseded by the confirmed outage. Deployment was separately
  gated and not executed by that cycle.
- Cycle recovery: `actor-scope-deploy-restore-20260912`
  (`INTEGRATED` — acceptance closed, Lane A audit cleared) started
  2026-09-12 (Asia/Manila) under the operator's explicit HIGH approval of
  ACTOR-SCOPE-DEPLOY-RESTORE-2026-09-12. Planner session
  `ses_f6bc8cee4ffe4v813ndCWIvFh1`. Deployment identity is the product pin
  `d44f29e0` (docs-only commits above it through `636109eb`); the fallback
  artifact `fdd0c8c7` was re-verified startable from
  `D:/ATLAS-worktrees/w1-runtime-deploy` (clean at `1ead5622`, docs-only above
  the pin) and `D:/ATLAS-worktrees/integration-tlrr01r-20260911` (at
  `fdd0c8c7`). Cycle-start preflight re-verified the outage: Tailnet health
  `502`, no listeners or connections on 5001/5174, and the env source present
  at `D:/ATLAS-worktrees/integration-rrtc01r-20260912/atlas-server/.env`
  (never printed). Executor task `ses_f6bc4ced2ffe392vbHzkal9GlX` executed the
  packet and returned `REVIEW_REQUIRED` with candidate `7d874c7c` (single docs
  evidence file on base `d44f29e0`); live server PID 38468 + client PID 38460
  from `D:/ATLAS-worktrees/actor-scope-deploy-restore-20260912`, Tailnet
  health/root `200`, one disclosed login footprint (`audit_logs` +1), labeled
  `EPHEMERAL_DEPLOYMENT`. Planner independently reproduced the range, PIDs,
  sockets, command lines, and rollover-disabled log. Fresh QA
  `ses_f6bb46404ffeB8erOdXSiL9uST` returned `PLANNER_DECISION_REQUIRED`
  (27/21/6/0): identity, runtime, Tailnet, unauthenticated controls, DB
  signatures, and evidence quality all pass; C2/C3/C4-positive/C5/C6/C8 are
  blocked because the persistent profile holds no reusable session (planner
  independently confirmed: no cookie/sessionStorage token, `/auth/me` 401) and
  the packet's single authorized login was consumed by the executor. Closure
  (2026-09-12): the operator supplied the additional recorded login (one
  login; delta ≤ one `LOCAL_LOGIN_SUCCESS` row id > 761 plus actor
  `last_login_at`). Fresh QA `ses_f6b893b57ffelxC4Jcm0m2HPxB` returned
  `ACCEPT_READY` 13/13 (blocked 0, unperformed 0): the six Stage C rows pass
  with the origin invariant asserted on every row; DB delta exactly one
  `LOCAL_LOGIN_SUCCESS` row (id 762, actor 46, school 1) plus that actor's
  `last_login_at` (`2026-09-12T07:19:30.928Z`); all other signatures delta 0;
  the QA-disclosed pre-login 401 had zero footprint. Evidence
  `d44f29e0...534832bc` integrated at `1add5323`; Lane A wave audit
  `AUDIT_CLEAR` 8/8 (see the wave cycle bullet). No live-data actions
  authorized.
- Cycle recovery: `runtime-stability-wave-20260912` (COMPLETE) closed
  2026-09-12 (Asia/Manila). Lane A: actor-scope acceptance closed; evidence
  integrated `1add5323`; wave audit `AUDIT_CLEAR` 8/8
  (`docs/reviews/runtime-stability-wave-20260912/wave-completion-audit.md`).
  Lane B: RUNTIME-SUPERVISION-C01 integrated at `0ec3b8f7` (`05143d65`, fresh
  QA 8/8); fresh pre-install auditor `ses_f6b5175c6ffejlywhgblmX7c5k`
  `AUDIT_CLEAR` 14/14 (capsule at
  `docs/reviews/runtime-stability-wave-20260912/wave-completion-audit-lane-b-preinstall-r2.md`).
  The HIGH installation packet
  `docs/prompts/runtime-supervisor-live-install-2026-09-12.md` was approved on
  2026-09-12, but the stop-incumbent cycle
  `runtime-supervisor-live-install-20260912` never completed: the elevated
  retry stopped at `PLANNER_DECISION_REQUIRED` before any mutation, and the
  runtime was then found down, so that path was superseded by the
  deploy-as-restore rebase (R1, integrated at `ac9121fc`). The live runtime was
  then `EPHEMERAL_DEPLOYMENT` from
  `D:/ATLAS-worktrees/actor-scope-deploy-restore-20260912`; no install,
  term-cache apply, rollover sync, Teaching Load mutation, generation, or
  publication was completed by this register transition.
- Planner validation and live-state correction (2026-09-12, Asia/Manila):
  `rrtc01r2-20260912` source claims were independently reproduced by the primary
  planner (candidate worktree at `4489bbbd` clean; actor-school session-epoch
  suite 9/9; an independent partial mutation of the epoch binding produced 6/9
  failing and was byte-restored before any commit; merged product tree
  `a633db50` is identical to the reviewed candidate and `327537ad` is docs-only).
  The same probe found the W1 runtime DOWN: Tailnet
  `https://njgrm.buru-degree.ts.net` returns 502, nothing listens on 5001/5174,
  and recorded PIDs 11564/6756 are absent; machine boot 2026-09-11 20:58
  predates the W1 deploy, so this is a post-deploy stop/crash, not a reboot.
  Earlier "live" wording in this register is superseded.
- Cycle recovery: `w1-runtime-deploy-20260911` (`SUPERSEDED` by the
  2026-09-12 restore) updated 2026-09-11
  22:52 Asia/Manila. The approved HIGH `W1-RUNTIME-DEPLOY` packet was executed:
  product `fdd0c8c7` was deployed live (server PID 11564 + client PID 6756 from
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
| W1-RUNTIME-DEPLOY | Deploy the integrated Wave-1 server/client against the migrated schema and verify the corrected EnrollPro term contract | `SUPERSEDED` | HIGH shared-runtime deployment/cutover | Deployed `fdd0c8c7`; evidence `fdd0c8c7...1ead5622` merged at `ed44d62f` | Replaced after the post-deploy outage by ACTOR-SCOPE-DEPLOY-RESTORE | Deployment identity, rollover-disabled log, unauthenticated pages, and zero unauthorized writes were independently verified; its global QA verdict was rejected for unperformed mandatory rows; ACTOR-SCOPE-DEPLOY-RESTORE re-verified the six approved Stage C rows (C2/C3/C4-positive/C5/C6/C8) at the `d44f29e0` pin; remaining W1 surface rows (Teaching Load history + carry-forward preview, authenticated Subjects, Simple Timetable) are explicitly deferred, not re-verified | Historical record; do not reuse its swap/probe wording. The later supervisor restore completed and passed its post-action wave audit (see RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE) |
| RR-TERM-CACHE-C01 | Separate year alignment from persisted ordered-term readiness and provide one narrow, previewed term-cache catch-up path | `INTEGRATED` | MEDIUM source; HIGH future cache apply | `work/rr-term-cache-c01`; `77894b7a...45f08955`; merge `8c0a1207` | Live term-cache apply remains separately gated | Fresh QA ACCEPT_READY 17/17 (blocked 0, unperformed 0); planner pre-QA reproduced status 11/11 and client 6/6; integration-tier reruns C02 8/8, cache-instrumentation 32/32 zero-residue, lifecycle 208/0, rr-ux01 pass; both builds/startup previously verified; rollover-automation suite not independently rerun (seeded-disposable only; all changed-field assertions expect false and the change is strictly more conservative) | Closed in source; deployed via the `d44f29e0` restore (its own deployment was superseded by the C01R correction at `a1256506`); term-cache apply remains separately gated |
| RR-TERM-CACHE-C01R | Close term-authority JWT/actor-school authority, client school-1 defaults, and in-transaction complete active-year election | `INTEGRATED` | MEDIUM source; HIGH future cache apply | `work/rr-term-cache-c01r`; `904818d4...86376ba7`; merge `a1256506` | Live term-cache apply remains separately gated | Fresh QA ACCEPT_READY 17/17 (blocked 0, unperformed 0): mounted JWT/system-token matrix with zero dispatch, no school-1 defaults, fail-closed actor-scoped wrapper, scope-transition clearing, in-transaction complete-set re-election (`ACTIVE_YEAR_AMBIGUOUS`, zero writes), replay/audit invariants, both tsc/builds, isolated built-server 401s; integration gates rerun on the merged tree | Closed in source; its code is deployed via the `d44f29e0` restore (the old bounded deployment packet is superseded). The reviewed catch-up preview packet is prepared at `docs/prompts/term-cache-catchup-preview-2026-09-13.md`; its one-login authorization (`AUTH_SESSION_REQUIRED`) and the later apply remain separately gated |
| RR-TERM-CACHE-C01R2 | Bind the client actor-school resolver cache to the authenticated token epoch and make the deploy packet's listener sequence executable (stop-then-start with per-stage rollback) | `INTEGRATED` | MEDIUM source + docs; deployment stays HIGH | `work/rr-term-cache-c01r2`; `781a457f...4489bbbd`; merge `a633db50` | Live deployment remains separately gated | Fresh QA `ACCEPT_READY` (mandatory 10/10, blocked 0, unperformed 0): real-path session-epoch transition (no-token fail-closed, logout/expiry, A→B re-login with zero school-1 dispatch, late obsolete-response discard in both orderings, bridge replacement, invalid-id rejection, zero scoped dispatch unresolved); independent mutant control 6/9 failing; client tsc/build; server status 11/11 + mounted disposable-PostgreSQL 1/1 preserved; packet re-read confirms stop-then-start and no zero-downtime claim | Closed in source; deployed via the `d44f29e0` restore (the corrected swap packet is SUPERSEDED by the outage and must not be executed). Term-cache apply remains separately gated |
| ACTOR-SCOPE-C01 | Close actor-school/year scope end to end: remove school-1 defaults from actor-sensitive helpers, bind client consumers to the authenticated token epoch, and gate the runtime read routes on explicit actor school | `INTEGRATED` | MEDIUM source; deployment stays HIGH | `work/actor-scope-c01`; `a4dcd061...98ab5e04`; merge `d44f29e0` | Live deployment and the remaining defaulting `parseSchoolId` sites on non-listed runtime mutation routes are separate successor actions | Fresh QA `ACCEPT_READY` (mandatory 18/18, blocked 0, unperformed 0): real-path epoch suites, 55/55 focused client tests, two independent mutant controls, mounted disposable-PostgreSQL runtime-route matrix with zero DB/upstream dispatch on every rejection, both builds; integration reproduced product-tree identity, client 55/55, and server 3/3 on the merged tree | Closed in source; deployed via ACTOR-SCOPE-DEPLOY-RESTORE (`d44f29e0` live, acceptance closed); the remaining defaulting sites stay backlog-only |
| ACTOR-SCOPE-DEPLOY-RESTORE | Restore the shared runtime from the confirmed outage by deploying product pin `d44f29e0` on 5001/5174 with rollover automation disabled, then run the bounded authenticated Tailnet Stage C acceptance | `INTEGRATED` | HIGH shared-runtime deploy-as-restore | `work/actor-scope-deploy-restore-20260912`; `d44f29e0...534832bc`; merge `1add5323` | Runtime was later restored by RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE (supervised release; see that row) | Fresh QA `ses_f6b893b57ffelxC4Jcm0m2HPxB` `ACCEPT_READY` 13/13 (blocked 0, unperformed 0): C2/C3/C4-positive/C5/C6/C8 on live Tailnet; DB delta exactly one `LOCAL_LOGIN_SUCCESS` (id 762, actor 46) + `last_login_at`, all else 0; product tree == pin; wave audit `ses_f6b724735ffezVWNnma0wKLgLJ` `AUDIT_CLEAR` 8/8 (F1–F4 non-blocking docs-only, reconciled) | Lane A COMPLETE; capsule at `docs/reviews/runtime-stability-wave-20260912/wave-completion-audit.md`; runtime later restored by RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE |
| RUNTIME-SUPERVISION-C01 | Replace the ephemeral Vite/unmanaged-PID runtime with a repository-owned, production-hosted, restartable supervision contract | `INTEGRATED` | MEDIUM source/test; HIGH future live install | `work/runtime-supervision-c01`; `cf9b7e6e...05143d65`; merge `0ec3b8f7` | Install remains separately gated by the prepared HIGH packet | Round-2 pin correction `05143d65` passed fresh QA `ses_f6b56dd43ffeG3CSnFNNJBficZ` `ACCEPT_READY` 8/8 (blocked 0, unperformed 0): real-tree pin positive (previously unsatisfiable), equality-mutant failing-first, `PIN_MISMATCH`/`RELEASE_SHA_*` fail-closed, distinct status, inventory redaction, 56/56 ops, ports untouched. Pre-install audit `ses_f6b5175c6ffejlywhgblmX7c5k` `AUDIT_CLEAR` 14/14 | Closed in source; original install packet SUPERSEDED; the deploy-as-restore packet (R1) was approved and executed — runtime restored (see RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE row) |
| RUNTIME-SUPERVISION-LIVE-INSTALL | Replace the ephemeral runtime by installing the reviewed supervisor on 5001/5174 with boot recovery and rollback | `SUPERSEDED` | HIGH shared-runtime cutover + boot-task registration | Correction packet `docs/prompts/runtime-supervisor-live-install-correction-2026-09-12.md`; frozen release `9d293879`; no candidate created | Replaced by the deploy-as-restore boundary after the runtime outage was reconfirmed (`d44f29e0` no longer running; Tailnet 502; no 5001/5174 listener) | Prior attempt `2794c40f` was independently rejected for Access Denied task registration; the elevated retry never ran because the runtime was found down before execution | Historical record; do not execute with swap wording |
| RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE | Restore the down shared runtime by starting the reviewed supervisor (`9d293879`, pin `d44f29e0`) on empty 5001/5174, registering boot recovery, then disabling the legacy task after health | `INTEGRATED` — COMPLETE (post-action audit cleared) | HIGH shared-runtime deploy-as-restore + boot-task registration | approval received 2026-09-12 (DB `atlas_recovery_clean_rebuild_20260905` confirmed); executor task `ses_f6aa9bd82ffeZuVkjof36wri6Z`; evidence `f52e4b1e...5c699f36`; merge `1792cca9`; pre-action audit `ses_f6abf6c5effeY3MI5UGXRdUkeQ`; post-action audit `ses_f6a97cff2ffe6GdgWaJ4O2A0c4` | Closed; residuals recorded (reboot-start unexercised; running supervisor is a detached manual process; ONSTART task is the restart mechanism) | Live: 5001→15388 / 5174→22272, health/ready/Tailnet 200, boot task ONSTART/`PT0S`, legacy Disabled; fresh QA `ACCEPT_READY` 9/9; post-action audit `AUDIT_CLEAR` 14/14; capsules under `docs/reviews/runtime-supervisor-live-install-restore-20260912/` | Closed; runtime map reconciled; next HIGH-prep is the term-cache catch-up preview (apply stays separately gated) |
| TT-TL-RUNTIME-ACCEPTANCE | Deploy integrated TT/TL source and perform read-only live diagnostics | `DEPLOYED_ACCEPTANCE_INCOMPLETE` (release `3d916b26` live; rows 4–5 blocked on `TERM_STRUCTURE_UNAVAILABLE`) | HIGH shared-runtime source deployment | `docs/prompts/tt-tl-runtime-acceptance-2026-09-12.md`; audit spec `docs/prompts/tt-tl-runtime-acceptance-r3-final-audit-2026-09-12.md`; deployed `3d916b26` (deployment-time supervisor 44336; 5001→30032 / 5174→27408; superseded by the 2026-09-13 PID drift recorded in the shared-runtime bullet; evidence merge `dbde5689`); rollback: supervised reset to `9d293879` + `d44f29e0` manual fallback | Blocked rows are mandatory and are re-verified after the separately approved term-cache catch-up (RR-TERM-CACHE-C01); post-action wave audit complete (`AUDIT_CLEAR` 11/11, capsule at `docs/reviews/tt-tl-runtime-acceptance-20260912/wave-completion-audit-postaction.md`) | Live: local health/ready + Tailnet 200; `releaseSha=3d916b26` (status + installed HEAD); QA tally 6/4/2/0 — origin/routes/no-write PASS (910 GETs), exactly two mandatory rows (4–5) blocked (`DERIVED_DEMAND_BLOCKED`, `termStructure:null`); authorized R3 execution login audit id 773; custody cleaned (logout, 401 `NO_TOKEN`) | Run the prepared term-cache catch-up preview after its one-login authorization (packet `docs/prompts/term-cache-catchup-preview-2026-09-13.md`); after an approved apply, re-run rows 4–5 and the readiness diagnostic; then close the cycle |
| DASH-RESILIENCE-C01 | Preserve saved Dashboard truth and typed term state when EnrollPro or one ATLAS read is unavailable | `INTEGRATED` | MEDIUM cross-layer read path | `work/dashboard-resilience-c01`; `ec7d54ed...9b05a7c6`; integration `47a4405d` | Deployment remains separate | Primary planner reproduced 9/9 resilience, 38/38 HTTP authority, 11/11 server lifecycle, 12/12 client lifecycle, term-authority coverage, both type-checks, and both builds | Closed in source; verify saved-data and typed unresolved-term UX during bounded runtime deployment |
| TL-UX-C01R2 | Correct the integrated Teaching Load suggestion apply authority | `INTEGRATED` | HIGH write/concurrency guards | `work/teaching-load-ux-c01r2`; `ec7d54ed...52224ce3`; integration `1d9a06ec` | Live suggestion apply remains a separate HIGH action | Primary planner reproduced 61/61 disposable-PostgreSQL authority, 13/13 distribution, write-authority and 56/56 policy suites; combined type/build gates passed | Closed in source; do not invoke suggestion apply without its own reviewed preview and explicit approval |
| TL-AUTHORITY-DIAGNOSTIC-C02 | Expose read-only Teaching Load authority diagnostics, zero-load faculty, adviser blockers, and HG exclusion | `INTEGRATED` | MEDIUM source; HIGH Teaching Load mutation | `work/tl-authority-diagnostic-c02`; `8f48a2fe...7cc6f587`; integration `b716e96f` | Suggestion/apply and carry-forward remain separately gated | Fresh QA accepted the scoped system-token/JWT authority correction; hermetic reconciliation 83/83, route authority/zero-write probes passed; the pre-existing R5 replay/null-fixture failure reproduced on base and candidate; fixture residue was removed and verified absent | Closed in source; use diagnostics before any Teaching Load apply preview; no write action is authorized by this lane |
| TL-SUGGESTION-C03R | Unify suggestion and over-cap qualification with persisted policy, include qualified zero-load faculty, expose typed rejection reasons, and scope every preview/report | `ACCEPT_READY` (reviewed candidate; not integrated) | MEDIUM cross-layer source; HIGH future apply | `work/tl-suggestion-c03`; base `4e5ef1f6`; reviewed candidate `6eb3a3b0`; tip `256e2658` (docs-only capsule commit above the candidate); capsule `docs/handoffs/tl-suggestion-c03r-planner-result.md` | Integration deferred while `atlas-client/src/types.ts` is shared with the actively running TT-OUTPUT-C03R3 lane; no live/shared DB, suggestion apply, carry-forward, generation, publication, deployment, or migration | Fresh QA round 2 `ses_f69d7ce8bffeG0p8qrdSm01hCR` `ACCEPT_READY` 11/11/0/0 on `4e5ef1f6..6eb3a3b0`; post-action audit re-verified the clean worktree, candidate identity, and capsule | Head-planner integration review of `4e5ef1f6...6eb3a3b0` after the TT `types.ts` overlap resolves; do not integrate before the TT lane freezes |
| TT-UX01 | Make Simple Timetable a guided, complete routine scheduling workspace while keeping expert administration in Advanced | `INTEGRATED` | MEDIUM UI with HIGH interaction guardrails | `work/timetable-ux-01`; `aab8fb00...b0f607bb`; merged at `a0ca05e5` | None | Primary planner reproduced 58/58 focused, 179/179 full client suite, TypeScript, candidate-to-main source parity, and clean integration diff | Closed; one-click clean placement + prominent Undo is accepted for now. Plan narrow Advanced Requests and duplicate-publish cleanup later |
| TT-SHAPE-DIAGNOSTIC-C02 | Bind timetable readiness to the 2026-2027 stakeholder shape policy and canonical section/teacher/room output projections | `INTEGRATED` | MEDIUM source; HIGH generation | `work/tt-shape-diagnostic-c02`; `8f48a2fe...ddbdaced`; integration `e83d25d5` | Live generation remains separately gated | Exact-range advisory coverage is carried by the committed 13-test C02 suite (the older committed advisory text is stale, per the wave audit); C02 13/13, stakeholder matrix 12/12, canonical readiness 14/14, real preflight/readiness zero-write mutants, server tsc/build and diff-check passed | Closed in source; use the diagnostic in the fingerprinted generation preview; do not generate or publish from this lane |
| TT-OUTPUT-C03R | Preserve weekday and term identity through the scheduler, main grid, section/teacher/room projections, and beneficiary class-program exports | `INTEGRATED` (candidate content carried onto `origin/main` by the TT-OUTPUT-C03R3 merge `3c2fc2bd`) | MEDIUM cross-layer source; HIGH future generation/publication | `work/tt-output-c03`; base `4e5ef1f6`; candidate `4f596af0`; capsule `docs/handoffs/tt-output-c03r-planner-result.md` | None in source | Fresh QA round 2 `ses_f69d7bda1ffeaHjNVOffKHo48U` `ACCEPT_READY` 14/14/0/0 on `4e5ef1f6..4f596af0`; the two post-capsule commits are covered by the C03R3 exact-range QA (see the C03R3 row) | Closed in source; live per-term output verification belongs to the bounded runtime deployment and its separately approved term-cache catch-up |
| TT-OUTPUT-C03R3 | Complete the beneficiary-output correction on the live branch above `f00daa69` and produce a frozen tip with fresh coverage for the two post-capsule commits | `INTEGRATED` (wave-audited `AUDIT_CLEAR` 9/9 via the readiness correction) | MEDIUM cross-layer source; HIGH future generation/publication | `work/tt-output-c03`; `4e5ef1f6...e7deeb91`; merge `3c2fc2bd` on `origin/main` | None in source | QA: round 1 `ses_f696b93baffe4dPW7LsrSYAW0M` `CORRECTION_REQUIRED` 38/36 (placement term loss); round 2 `ses_f695442d1ffe568Btme9JM4fN4` `CORRECTION_REQUIRED` 31/30 (quick-place commit binding); round 3 `ses_f69440b5cffekqzFdwbc0orOex` `ACCEPT_READY` 31/31/0/0; exact-range `ses_f693863c7ffe8xE4rlEp99yjDq` `ACCEPT_READY` 14/14/0/0 over `4e5ef1f6...e7deeb91`; integration gates: 43/43 candidate-path parity, server/client tsc+build, 14 decisive suites, `git diff --check`, all clean; wave audit `ses_f692956d5ffemfOtICwokWAPU3` F1 correction `TT-READINESS-TERM-C03R3` integrated and re-audited `AUDIT_CLEAR` 9/9 (`ses_f690e4b3fffeQ7Z62jwtkA6X3E`) | Closed in source; verify selected-term outputs only during the bounded runtime deployment after the approved term-cache catch-up; no generation/publication from this lane |
| TT-READINESS-TERM-C03R3 | Migrate the canonical readiness diagnostic to the resolved per-term entries so it reports `READY` for ordinary year-long + rotation datasets | `INTEGRATED` (wave-audited `AUDIT_CLEAR` 9/9) | MEDIUM server source; HIGH generation | `work/readiness-term-c03r3`; base `94b5c7bd`; candidate `5256dc5a`; merge `0abfe457` on `origin/main` | None in source; live generation remains separately gated | Wave audit `ses_f692956d5ffemfOtICwokWAPU3` F1 was the driver; fresh QA `ses_f6914cdc2ffe4ZbvcQq14Kxqw0` `ACCEPT_READY` 17/17/0/0 (positive control `READY`/`generateAllowed=true`, mutant reproduces the old false block); re-audit `ses_f690e4b3fffeQ7Z62jwtkA6X3E` `AUDIT_CLEAR` 9/9 with F1 closure and no missed consumer; integration gates: server tsc/build, readiness 16/16, tt-output-c03r3 12/12, placement-term 8/8, candidate parity and `git diff --check` clean | Closed; the term-cache catch-up apply remains the next operator decision |
| TT-SYNC-TERM-C03R4 | Reconcile the mounted “Sync timetable setup” workflow against canonical per-term derived demand with actor-school authority, version CAS, and replay idempotence | `INTEGRATED` — wave-audited `AUDIT_CLEAR` 16/16 | MEDIUM source/test; no live mutation | `work/tt-sync-term-c03r4`; `def0dcc9...09027671`; merge `5328c9f6` | None in source; deployment remains separately gated HIGH | Fresh QA `ses_f67812ec1ffeuHBDkIaaZE7Dlg` `ACCEPT_READY` 19/19/0/0 (T1-only no longer falsely satisfies T2/T3; explicit termIndex on rebuilt unassigned items; mounted 403 matrix with zero dispatch; Serializable CAS `RUN_VERSION_STALE`; replay writes nothing); combined integration gates green; executor disclosed non-blocking residuals (X2 stale-authority hook, legacy HG/COHORT intent) | Closed in source (wave-audited `AUDIT_CLEAR`; capsule at `docs/reviews/tt-sync-term-c03r4-20260913/wave-completion-audit.md`); do not deploy without its own reviewed HIGH action |
| COMPANION-SSO-C01 | Implement the complete ATLAS side of EnrollPro↔ATLAS SSO: Flow A callback/exchange/local session, Flow B reverse authorize/exchange with hash-only one-time codes, strict validation, and the Integrated Systems AppShell area | `INTEGRATED` — wave-audited `AUDIT_CLEAR` 8/8 | MEDIUM source (security-sensitive); live activation HIGH | `work/companion-sso-c01`; base `a284d775`; product `3e0103a3`; correction `fbb9dc63`; merge `c989f03d` | Live activation, env configuration, and companion-repo changes remain separately gated HIGH actions | Fresh QA `ses_f694593f8ffe2VZhrp3QQSUkBV` `ACCEPT_READY` 24/24/0/0 (server 18/18 mounted, client 14/14, role-intersection negative controls, atomic consume/concurrency, zero plaintext/leak, builds + isolated startup); round-1 QA found and the correction fixed the upstream allowed-role gap; wave audit `ses_f693a866bffeaOWmjfKrP3P45W` `AUDIT_CLEAR` 8/8 | Closed in source and wave-audited; do not deploy, configure env, or mutate companions from this lane (live activation is a separate HIGH action) |
| TERM-CACHE-CATCHUP-PREVIEW | Capture the live zero-write term-authority preview fingerprint/confirmation as the reviewed basis for the later term-cache catch-up apply | `HIGH_APPROVAL_REQUIRED` (blocked: `AUTH_SESSION_REQUIRED`) | LOW authorized (one login audit delta + zero-write preview); follow-on apply HIGH | Packet `docs/prompts/term-cache-catchup-preview-2026-09-13.md`; preparation only, no worktree | Exactly one bounded privileged login is not yet authorized; the apply remains a separate later HIGH action | Post-action audit (2026-09-13) confirms release `3d916b26` live; mirror 223 = EnrollPro year 9 / `2030-2031` with NULL cache; a reachable `ACTIVE_TERM_UNRESOLVED` remains a valid ordered-contract state; wave audit re-verified the packet against source (`AUDIT_CLEAR` 8/8) | Operator returns the packet §4 authorization sentence; then one custodian login runs the zero-write preview and records fingerprint/confirmation plus before/after signatures |
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
| RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE R0 candidate `2fa973e5` | `SUPERSEDED — NON_APPLICABLE` | First docs-only copy of the deploy-as-restore packet referenced the in-worktree env source `D:\ATLAS-worktrees\integration-rrtc01r-20260912\atlas-server\.env`. Superseded by R1, which moves the durable runtime reference to `D:\ATLAS-runtime-config\atlas-server.env`. Preserved unamended; not an execution boundary |
| TT-OUTPUT-C03R tip `f00daa69` acceptance claim | `CLOSED` | The former coverage gap is closed: fresh exact-range QA `ses_f693863c7ffe8xE4rlEp99yjDq` `ACCEPT_READY` 14/14/0/0 over `4e5ef1f6...e7deeb91` covers `19d6ee1c`/`f00daa69`; the corrected chain is integrated at merge `3c2fc2bd` |

## Dependency-ordered queue

1. TL-UX-C01R2, DASH-RESILIENCE-C01, and MIG-GUARD-R1 are integrated and
   deployed in the live `3d916b26` release; no further deployment step remains.
2. TT-UX01R2 Simple-operator closure is independently ratified at `a0ca05e5`; no further
   TT-UX01 integration step remains.
3. GEN-C02R1 (`c3744dc6`), UX-C01R (`fc8796c6`), and TL-RR01R (`8f210d7c`) are
   integrated and deployed in the live `3d916b26` release; no wave follow-up
   remains.
4. `actor-scope-deploy-restore-20260912` closed its acceptance: fresh QA
   `ACCEPT_READY` 13/13 (blocked 0, unperformed 0) on the live `d44f29e0`
   runtime with the exact approved login delta (audit id 762); evidence
   integrated at `1add5323`. Lane A wave audit `AUDIT_CLEAR` 8/8; the runtime
   later went down and was restored by the deploy-as-restore execution (R1
   approved and executed; post-action wave audit `AUDIT_CLEAR` 14/14).
5. RUNTIME-SUPERVISION-C01 is closed in source (`0ec3b8f7`). The first HIGH
   install attempt was rolled back because Windows denied both boot-task
   registrations; the deploy-as-restore packet
   `docs/prompts/runtime-supervisor-live-install-restore-2026-09-12.md` (R1) was
   approved and executed 2026-09-12 and the runtime is restored under the
   supervised release (see the RUNTIME-SUPERVISION-LIVE-INSTALL-RESTORE row);
   fresh QA `ACCEPT_READY` 9/9; post-action wave audit `AUDIT_CLEAR` 14/14 — cycle complete. The
   term-cache catch-up preview/apply (HIGH) remains a separate data action and
   must not share this listener restore.
6. After an approved term-cache catch-up AND the integrated
   `TT-READINESS-TERM-C03R3` correction (wave-audit F1), run the canonical
   readiness diagnostic for the live school/year. Only if it proves zero hard
   blockers and exact source freshness, prepare the fingerprinted generation
   approval package; otherwise return the typed blocker list and corrective
   handoff. Then obtain explicit HIGH approval, generate once, verify the
   completed run, then prepare the separate publication preview and approval.
7. `TT-TL-RUNTIME-ACCEPTANCE` is operator-activated (2026-09-12); its packet
   is amended R1 (`b40a22a4`) with the durable release switch and R3 with
   QA-owned session custody, expiry margin, immediate pre-stop recheck, and the
   resident-supervisor quiesce correction (`9221864b`). The corrected-R3
   re-audit (`ses_f6a02e067ffecMsB3E1Wrzr1hV`) returned `AUDIT_CLEAR` 10/10 and
   the operator returned the exact R3 approval sentence on 2026-09-12 and
   execution completed through: custodian login+preflight PASS 6/6, build
   phase, pre-stop recheck PASS, switch phase (target `3d916b26` now live on
   5001/5174 with machine env + boot task re-pointed; rollback = supervised
   reset to `9d293879`; `d44f29e0` manual last resort), QA acceptance
   6/4/2/0 (exactly two mandatory rows 4–5 blocked on
   `TERM_STRUCTURE_UNAVAILABLE`), evidence merged at `dbde5689`, and session
   cleanup. The post-action wave audit is complete (`AUDIT_CLEAR` 11/11,
   capsule committed 2026-09-13). Next: prepare the reviewed term-cache
   catch-up package; after its approved apply, re-run rows 4–5 and the
   readiness diagnostic before closing.
8. `TT-READINESS-TERM-C03R3` is integrated at merge `0abfe457` (fresh QA
   17/17) and wave-audited `AUDIT_CLEAR` 9/9. The term-cache catch-up apply
   remains the next operator decision. The separately tracked audit-F3 defect
   (`timetable-sync-setup.service.ts` rebuilt unassigned items without term
   identity) is fixed by `TT-SYNC-TERM-C03R4`.
9. `TT-SYNC-TERM-C03R4` is integrated at merge `5328c9f6` and wave-audited
   `AUDIT_CLEAR` 16/16 (`ses_f6772c5e6ffe46xW9W6z7Xo3d0`). No deployment or
   live action is unlocked by its closure; runtime deployment remains a
   separate HIGH approval.

## Safe parallel work now

- The TT/TL switch completed: release `3d916b26` serves the supervisor-owned
  5001/5174 (supervisor 44336; rollback = supervised reset to `9d293879`;
  `d44f29e0` is a manual non-supervised last resort only); no stream is
  currently authorized to stop/start the runtime again, and read-only
  monitoring is permitted. The mandatory acceptance rows blocked on the term
  snapshot are re-verified after the separately approved term-cache catch-up.
  The term-cache catch-up preview packet is prepared and awaits one
  bounded-login authorization; its apply remains separately gated.
  Carry-forward apply, suggestion apply, generation, and publication remain
  separately gated. The remaining defaulting `parseSchoolId` sites on non-listed
  runtime mutation routes and the `DEFAULT_SCHOOL_ID` backlog pages (MapEditor,
  MapView, SpecializationMapping, PublicPublishedSchedule, coverage.ts,
  CreatePlaceholderDialog) are non-blocking observation backlog pending a
  separate bounded authorization lane.
- `TT-SYNC-TERM-C03R4` is integrated at merge `5328c9f6` (candidate
  `09027671`) and wave-audited `AUDIT_CLEAR` 16/16. It authorizes no
  deployment: the
  corrected Sync setup route/client reach the shared runtime only through a
  separate reviewed HIGH action. The source lane may not touch the shared
  runtime, live/shared database, term-cache, Teaching Load, generation, or
  publication.
- `TL-SUGGESTION-C03R` is `ACCEPT_READY` (candidate `6eb3a3b0`, tip `256e2658`).
  The former integration deferral is cleared: `TT-OUTPUT-C03R3` is integrated
  at merge `3c2fc2bd`, so the shared `atlas-client/src/types.ts` overlap no
  longer blocks the head planner's integration review of `4e5ef1f6...6eb3a3b0`.
  The companion-SSO lane (`COMPANION-SSO-C01`) is integrated in source at
  merge `c989f03d`. Neither lane may touch the shared runtime, live/shared
  database, task/environment configuration, generation, publication, or the
  living register under ordinary integration authority.
- `RUNTIME-SUPERVISION-C01` is integrated in source at merge `0ec3b8f7`; its
  original install packet is `SUPERSEDED` and the deploy-as-restore execution is
  complete (runtime restored; post-action wave audit `AUDIT_CLEAR` 14/14). No other stream may
  install/modify a Windows task
  or service, or alter the shared 5001/5174 runtime. The term-cache
  catch-up preview packet is prepared (one-login authorization awaited); its
  apply stays separate.
- Shared `CHANGELOG.md`, runtime source maps, and this register belong to the
  integration owner; executor documentation overlap is resolved at integration.

DEMAND-C01, TL-RR01, and the readiness-wave streams are integrated. Live
Teaching Load carry-forward apply, suggestion apply, generation, and publication
remain locked behind their separate previews, QA, and explicit approvals.
Shared-runtime listener changes beyond the supervisor packet remain locked.

## Awaited returns and decisions

- No DEMAND executor return remains. DEMAND-C01R2 is integrated at `b96caf40`.
- All three readiness-wave candidates passed fresh QA and are integrated. No
  executor or QA return remains for this wave.
- EnrollPro correction `5887d685` has been pulled and its live contract is
  available. No EnrollPro executor return is awaited.
- TERM-CONSUME-C02, DASH-RESILIENCE-C01, TL-UX-C01R2, and MIG-GUARD-R1 are
  accepted and integrated; no executor return remains for those streams.
- No migration approval is awaited; `0001_term_subject_authority` is applied and
  verified. The shared runtime was restored 2026-09-12 and now serves the
  supervised release `3d916b26` (server 5001 / host 5174; health 200 local +
  Tailnet; see the TT-TL row); its post-action wave audit cleared (`AUDIT_CLEAR`
  11/11, task `ses_f69a14a86ffesfDuO2Q34bYpyW`).
- No ACTOR-SCOPE-C01 source return remains; the candidate is integrated at
  merge `d44f29e0`. The deploy-as-restore acceptance is closed: the operator
  login grant was supplied and consumed exactly once with the approved delta;
  fresh QA `ACCEPT_READY` 13/13 at candidate `534832bc`, evidence integrated at
  `1add5323`; the Lane A wave audit returned `AUDIT_CLEAR` 8/8. No operator
  decision is awaited for these streams.
- No RUNTIME-SUPERVISION-C01 source executor return remains; the pin correction
  `05143d65` passed fresh QA (`ACCEPT_READY` 8/8) and is integrated at merge
  `0ec3b8f7`; the pre-install audit cleared 14/14. The first live-install attempt
  returned `CORRECTION_REQUIRED` at final candidate `2794c40f`; no product
  candidate was integrated. The elevated retry never ran because the runtime was
  found down; the stop-incumbent packet is `SUPERSEDED`. R1 is integrated at
  `ac9121fc` after fresh QA `ACCEPT_READY` 12/12; wave audit `AUDIT_CLEAR` 6/6
  (task `ses_f6abf6c5effeY3MI5UGXRdUkeQ`; capsule at
  `docs/reviews/runtime-supervisor-live-install-restore-20260912/wave-completion-audit.md`;
  docs-only F1/F6 reconciliation at `fdc546a8`). The operator returned the exact
  HIGH approval on 2026-09-12 (DB target `atlas_recovery_clean_rebuild_20260905`
  confirmed); the execution completed (executor task `ses_f6aa9bd82ffeZuVkjof36wri6Z`,
  candidate `5c699f36`, evidence merged at `1792cca9`) and fresh QA returned
  `ACCEPT_READY` 9/9 (blocked 0, unperformed 0); the post-action wave audit
  returned `AUDIT_CLEAR` 14/14 (task `ses_f6a97cff2ffe6GdgWaJ4O2A0c4`). Nothing
  is awaited from this wave. No term-cache, Teaching Load, generation, or
  publication action is unlocked.
- Operator activated `TT-TL-RUNTIME-ACCEPTANCE` (`CYCLE ON`, 2026-09-12). The
  pre-action wave audit `ses_f6a6a5982ffeHfh3VnGllXY9EW` returned
  `CORRECTION_REQUIRED` (release-switch + rollback defects); the packet was
  amended R1 at `b40a22a4` and the fresh re-audit
  `ses_f6a60dc69ffeLSEf0CUPZUTEwv` verified B1/B2 resolved. Primary-planner
  validation found the pre-cutover session and cross-role custody gaps; R3
  added QA-owned custody, 105-minute remaining lifetime, immediate pre-stop
  recheck, and release identity from supervisor status + Git HEAD. The R3
   final audit returned `CORRECTION_REQUIRED` (F1 resident-supervisor quiesce);
  the correction was applied at `9221864b` and the fresh re-audit returned
  `AUDIT_CLEAR` 10/10; the operator returned the exact R3 approval sentence on
  2026-09-12. The stage-1 custodian preflight blocked
  (`EXTERNALLY_BLOCKED(AUTH_SESSION_REQUIRED)`; no session in the persistent
  profile; no mutation). The operator then authorized exactly one bounded login
  and execution completed in the R3 order: stage-1 login PASS 6/6, build phase,
  pre-stop recheck PASS, switch phase (release `3d916b26` live; evidence merge
  `dbde5689`), QA acceptance tally 6/4/2/0 (rows 4–5 blocked on
  `TERM_STRUCTURE_UNAVAILABLE`), and session cleanup (logout; 401 `NO_TOKEN`).
  Awaited: the one-bounded-login authorization for the prepared term-cache
  catch-up preview packet (`docs/prompts/term-cache-catchup-preview-2026-09-13.md`)
  before the next HIGH approval request. The post-action wave audit returned
  `AUDIT_CLEAR` 11/11 on 2026-09-13 (capsule at
  `docs/reviews/tt-tl-runtime-acceptance-20260912/wave-completion-audit-postaction.md`).
  No TT-TL executor or QA return remains in flight.
- `TL-SUGGESTION-C03R`: no executor return remains; the candidate `6eb3a3b0`
  (tip `256e2658`) is `ACCEPT_READY`. The former TT `types.ts` overlap is
  cleared (`TT-OUTPUT-C03R3` integrated at merge `3c2fc2bd`), so the candidate
  awaits only the head planner's integration review.
- `TT-OUTPUT-C03R3`: no executor or QA return remains. The corrected chain
  `4e5ef1f6...e7deeb91` (exact-range 14/14/0/0) is integrated at merge
  `3c2fc2bd`; the wave audit returned `CORRECTION_REQUIRED` (F1), the bounded
  `TT-READINESS-TERM-C03R3` correction was integrated at `0abfe457`, and the
  fresh re-audit returned `AUDIT_CLEAR` 9/9. The cycle is `COMPLETE` (no pending
  audit item).
- `TT-SYNC-TERM-C03R4`: no executor, QA, or audit return remains; candidate
  `09027671` passed fresh QA `ACCEPT_READY` 19/19/0/0, is integrated at merge
  `5328c9f6`, and the wave audit returned `AUDIT_CLEAR` 16/16. No operator
  decision is required by this source cycle.
- `COMPANION-SSO-C01`: no executor or QA return remains; the accepted
  candidate is integrated at merge `c989f03d`. Live activation/deployment/env
  configuration and any EnrollPro/SMART/AIMS change remain separate HIGH
  actions; Flow A `POST` variant remains deferred per its packet.
- Term-cache catch-up preview: `AUTH_SESSION_REQUIRED`. One bounded privileged
  login is awaited (exact sentence in
  `docs/prompts/term-cache-catchup-preview-2026-09-13.md` §4); the preview is
  zero-write and the apply remains separately gated.
- TT-UX01R2 is ratified at `a0ca05e5`; the primary planner accepts the bounded
  one-click clean-placement + prominent Undo contract. Advanced Requests and
  duplicate-publish cleanup remain non-blocking follow-ups.
- The shared runtime serves supervised release `3d916b26` on 5001/5174
  (health/ready/Tailnet 200), boot task re-pointed, legacy task disabled. The
  prior `EPHEMERAL_DEPLOYMENT` is superseded. Next bounded runtime step: the
  term-cache catch-up preview (one-login authorization awaited; its apply
  remains a separate HIGH action).
- Observation backlog (non-blocking, no new executor stream authorized): the
  non-listed runtime mutation routes still default `parseSchoolId` to school 1
  (`atlas-server/src/routes/runtime.router.ts:26-32` and its mutation call
  sites) and do not cross-check the actor school; pilot-school constants remain
  in `MapEditor.tsx`, `MapView.tsx`, `SpecializationMapping.tsx`,
  `PublicPublishedSchedule.tsx` (public-by-contract),
  `components/faculty/CreatePlaceholderDialog.tsx`, and `lib/coverage.ts`. The
  previously recorded `Subjects.tsx:192` fail-open read is fixed by
  ACTOR-SCOPE-C01 (no `?? 1` default remains). These are successors for a
  separate bounded authorization lane, not conclusions of this cycle.

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
