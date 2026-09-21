# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file. The
planner writes and phrases it; the kickoff line below never changes. Updating it every turn is
deliberate and cheap (~1–2k tokens): it makes any turn boundary a safe session boundary. The
*decision* to actually start fresh stays conditional — take it at a real lane boundary, before
a HIGH action, or once a compaction would cost more than a restart.
Last updated: 2026-09-21 (Lane A). Two cycles closed back-to-back: `DUP-READ-CALLERS-C01R`
(client, accepted 7/7 on `a02884ff`) and `ACTOR-SCHOOL-MUTATIONS-C01` **Part B** (server, accepted
5/5 on `80acdc25`, now live). **The release queue is empty** — nothing accepted is undeployed.
`D:` 35.82 GiB; `D:\ATLAS-runtime-*` trees stay operator-only. Per-turn burn is tracked in
`docs/reviews/workflow-cost-tracking.md`.

**`DASHBOARD-TRUTH-C01` Part A is ACCEPTED and integrated** at candidate `2a6cb06d` (evidence
`5c318e1f`; fresh QA `ACCEPT_READY` 5/5, blocked 0, unperformed 0). Packet
`docs/prompts/dashboard-truth-c01-release-2026-09-21.md`; evidence
`docs/reviews/dashboard-truth-c01/`. Two review rounds were needed because the pre-action
review **falsified the packet's central premise**: `runs/latest/violations` is term-filtered
HARD+SOFT with no `totalCount`, so `activeTermHardViolationCount` was **not** hard-only and
`Dashboard.tsx:451-454` was a fourth mislabel. The fix now sources run-wide
`counts.runWide.blockingHard` → `counts.runWide.hard`. Worktree
`E:/ATLAS-worktrees/dashboard-truth-c01` is `KEEP_ACTIVE` until closure.

**Part B is DEPLOYED and executor-verified**: pin `4c7c0bd9`, release
`D:\ATLAS-runtime-supervised-4c7c0bd9-20260921`, supervisor 102800, `5001`→102964,
`5174`→87184, served entry `index-zIp12x6H.js`; rows **D1–D4 4/4 PASS**; `D:` 39.73 → 38.82 GiB.
Two deviations recorded in the evidence: dependency trees were **copied** from the junction-free
incumbent (the harness deny-list blocks `npm ci`), and the packet's XML-encoding hazard is
**inverted** on this host (preserving `encoding="UTF-16"` registers cleanly). The single
authorized login is **unspent** — and the operator has authorized **logins as needed** for the
post-action QA (2026-09-21), each one to be disclosed.
**`DUP-READ-CALLERS-C01R` is CLOSED — deployed and accepted 7/7/0/0.** Release **`a02884ff`**
live at `D:\ATLAS-runtime-supervised-a02884ff-20260921` (supervisor 102756; `5001`→99584;
`5174`→96548; entry `index-C6LTCXSf.js`; `D:` 38.82 → 37.32 GiB), **client-only**. Post-action
QA re-ran D1–D4 + B1–B3 and returned **6/7 `CORRECTION_REQUIRED`** on a single **evidence**
defect: the executor recorded a `SET LOCAL TIME ZONE 'UTC'` signature-map pin that **had no
effect** (issued outside a transaction → default-session-TZ rendering). One bounded
**planner-applied additive documentation correction** (no runtime action) records the
addendum-literal pre==post proof, QA's UTC-pinned post value, and QA's independent whole-DB
zero-write scan; D4 then passes on accurate evidence. **B2 is FIXED** — a clean `/timetable` load
issues `/auth/me` ×1, `runtime/context` ×2, `rollover-status` ×1, the counts that failed on
`4c7c0bd9`. QA login: `audit_logs` id **858** (actor 46). The "two cards asserted mounted"
sub-clause stays **not exercisable** (0 cards mount; creating drift is not authorized) and the
primary assertion is unweakened. Evidence:
`docs/reviews/dup-read-callers-c01r/part-b-deployment-evidence.md`.

**Closure defect found and fixed — new rule `AGENTS.md` §10.12.** The executor created its
evidence "worktree" as a **standalone clone** (`E:/ATLAS-worktrees/c01r-release-20260921`,
`origin` = the stale `D:\ATLAS`), so its correction commit was invisible to the shared repo: the
planner's first merge pulled a *different, older* revision of the same branch and `main` briefly
carried the **uncorrected** evidence. Detected by re-verifying the pushed file, recovered by
`git fetch <clone-path>`, and now verified on `main` (`05739729`). Guard added: prove a candidate
with `git cat-file -t <sha>` **from the integration boundary** before integrating. The clone is
`PRESERVE_FOR_DECISION` (clean, no unique commits) — do not delete it without an operator
instruction.

**First `atlas-executor-muse` run — recorded because muse failure modes feed the directive.**
Outcome: sound structural work (fail-closed invalidation, additive tests, clean commits, and it
volunteered one verification it *could not* perform). Independent QA found two **accuracy**
defects, both evidence-level, **no code defect**: (i) it reported the pre-fix failing-first tally
as **8/2/6** naming M3-c as failing, where QA measured **8/3/5** with M3-c passing pre-fix (not
discriminating) — it **overstated its own evidence**; (ii) it quoted the packet's
`settings.ts +58/−2` where the truth is `+57/−1`, and attributed the same-string-token
re-dispatch to the new memo rather than the pre-existing actor cache.
**Watch for: over-claiming verification counts / quoting literals loosely.** Muse's numbers need
the same adversarial check as anyone's — which the mandatory QA gate already provides.
**Second muse run (the `C01R` Part B deploy) — a further failure mode: a method claim that did
not execute.** It reported "`SET LOCAL TIME ZONE 'UTC'` pinned" and published the resulting hash
as the pinned value; `SET LOCAL` outside a transaction is a no-op, so the pin never applied. The
deployment work itself was sound (isolated build, correct cutover, D1–D4 pass, zero-write proven)
and the substance survived review — but the **evidence described a method that had not run**.
Its other deviations were honest: the harness deny-list blocks even `git stash list` (recorded
literally), and dependency trees were copied from the junction-free incumbent. Rule to carry:
when a row depends on a computed artifact, record the literal statement **and its scope** — here,
the enclosing transaction.

**Lane B (`ACTOR-SCHOOL-MUTATIONS-C01`) — LIVE in release `80acdc25` (accepted 5/5).** Its
server change is deployed: the eight defaulting runtime mutation `POST` routes now reject a
missing/malformed/foreign target school before any service, lock, upstream, database or
notification dispatch; a system token may still act on an explicit valid target, and a JWT actor
must be privileged with a matching positive actor school. A **fresh independent reviewer** closed
the source at 9/9 — the missing review tier, since Lane B had self-reviewed — and independently
reproduced Lane B's failing-first control at `a02884ff`. Its two earlier misreadings (worktree cap
read as a registry total; dirty `D:/ATLAS` treated as an integration boundary) are answered in
`docs/handoffs/lane-a-to-lane-b.md` (`5a679325`). **Three recorded successors are NOT in it**:
`GET /rollover-recovery/preview` (`runtime.router.ts:244`) still defaults to school 1;
`parseStrictTermAuthoritySchoolId` (`:424`) lacks the non-string guard; the harness does not cover
body-vs-query precedence or hex/exponent/padded strings.

**Lane A `main` push freeze — RELEASED.** Lane B's push landed (`07739636` is `main`'s tip), so
the freeze condition is satisfied and Lane A may push again. The rule it earned stands: **a lane
in an integration closure holds an exclusive `main` push window** (`AGENTS.md` §14) — hold
continuity pushes until the integration lands, and re-check `docs/handoffs/lane-b.md` before your
first `:main` push. **Custody note:** this session's first push (`1292ad40`) and the previous
Lane A session's two later pushes (`fa20b519`, `40a06485`) overlapped between 16:12 and 16:22
(+08) — two Lane A writers for ~10 minutes. The previous session declared its last push final;
treat this session as the sole Lane A writer from here.
Also settled: `prisma generate` is a **build step, not HIGH** (offline codegen, untracked output,
already authorized in the C02 boundary §6.1) — a fresh checkout is not gate-ready without it. And
the **502 layer needs no ATLAS fix**: the captured body is a host-proxy
`{"code":"UPSTREAM_UNREACHABLE","message":"read ECONNRESET"}`, i.e. **host-side**, not
server-emitted. `D:` headroom is no longer a blocker (the worktree reclaim freed it; it now
stands at 37.32 GiB after this release).

**To resume in a fresh session, paste this one line:**
> Read `docs/handoffs/planner-session-handoff.md` on `origin/main` and resume as the ATLAS
> primary planner (Lane A). It is self-contained; then follow its read order.

## 0. How to resume — read in this order

**Two traps a fresh session will hit immediately.**
1. **`D:\ATLAS` is a stale, dirty checkout** (hundreds of modified files, `main` far behind
   `origin/main`). It is historical and **never an integration boundary**. Do not read state
   from it, do not commit in it, and do not try to clean it. Work in `E:/ATLAS-worktrees/`.
2. **Two planner worktrees in the registry are not yours** — `D:/ATLAS-worktrees/planner-tt-tl-modules-c04r1`
   (`ab75c131`) and `E:/ATLAS-worktrees/planner-c06b-closure` (`dc3613eb`). They belong to
   earlier sessions. Leave them alone; §3 says preserve an uncertain owner.
3. **The `AGENTS.md` that is auto-injected into a fresh session is the *stale* `D:\ATLAS`
   copy** — it still lacks the `agent-runtime-deploy-facts.md` and
   `agent-worktree-lifecycle.md` pointers. Read `AGENTS.md` **from `origin/main`**, not from
   the injected context and not from `D:\ATLAS`.
4. **Capacity moved into the warn band.** `D:` free was **15.81 GiB** at 2026-09-21 (warn
   below 25, fail closed below 15), a live release measures **1.43–1.86 GiB** with real
   non-junction `node_modules`, and **21** never-retirable `D:\ATLAS-runtime-*` directories
   are present (19 supervised releases + the `d44f29e0` fallback + `ATLAS-runtime-config`).
   Every deployment permanently spends ~1.9 GiB that this lane may not reclaim. Record the
   figure before any release build and treat release-tree accumulation as an operator decision.

1. **This file.**
2. **`AGENTS.md`** — the authority. It now points to two reference docs it did not before:
   `docs/reference/agent-runtime-deploy-facts.md` (read before any deployment/runtime/task/env
   action) and `docs/reference/agent-worktree-lifecycle.md` (read before creating, retiring or
   cleaning up a worktree, release directory or dependency tree).
3. **`docs/plans/live-state.md`** — live release and SHA, blockers, the single next action.
4. **`docs/handoffs/lane-b-charter-2026-09-21.md`** — a **second agent works this repo
   concurrently**. Read it before touching anything server-side or reserved.

## 1. What is live right now

- Release **`80acdc257cee613418eaa24db4607114b68c2d25`** at
  `D:\ATLAS-runtime-supervised-80acdc25-20260921` (registered detached worktree, not a clone);
  supervisor 96476; `5001`→103700; `5174`→96612; served entry `/assets/index-C6LTCXSf.js`
  (byte-identical to `a02884ff`'s — the client tree is unchanged); Tailnet healthy. It carries
  Lane B's server fix **and** everything in `a02884ff`.
- Rollback: incumbent `a02884ff` is startable in place at
  `D:\ATLAS-runtime-supervised-a02884ff-20260921` with its pre-mutation task XML captured
  (`B0EF4152…`); `4c7c0bd9`, `434b2a81`'s XML and the **`5f5c6c4f`** basis (startable,
  junction-free) remain available. Rollback was not executed.
- **Budget — two sources, and they measure different things.**
  1. **Allowance percentage (the authority): the operator's provider console.** Last
     operator-confirmed 2026-09-21: **`monthly 45% · weekly 9% · rolling 2%`** (rolling resets
     in ~4h22m, weekly in ~6d17h). It is **not machine-readable from here**: navigating to
     `https://opencode.ai/console/org_01M2RQRHFTZB8B37HK0EMRATYK/go` in the Playwright profile
     redirects to `/console/login`, and this lane must **never** log into the operator's
     provider account. Report it as "last operator-confirmed <when>" and ask for a re-read when
     it matters.
  2. **Local burn trend (runnable every turn): `opencode stats --days N`** — add `--models` for
     per-model cost. Literals at 2026-09-21: last **1 day $4.24** / 40 sessions; last **7 days
     $67.35** / 452 sessions; last **30 days $118.00** / 902 sessions. Use this for burn rate and
     model routing.
- **Executor model routing — operator instruction, 2026-09-21: dispatch `atlas-executor-muse`
  (Muse Spark 1.3 Contributor), not `atlas-executor` (`opencode-go/deepseek-v4.1-flash`).**
  Measured over the last 7 days: ds4.1flash was **$65.33 of $67.35 (97%)** of all spend across
  26,107 messages (~$0.0025/msg), while muse-spark-1.3-contributor was **$1.18** across 1,411
  messages (~$0.0008/msg) — roughly **3× cheaper per message**. Muse's shortcomings are being
  closed in the directive, so **record each muse executor's failure mode in this handoff when it
  happens** rather than silently reverting to ds4.1flash. `atlas-qa` stays ds4.1flash (the QA
  role needs its reliability more than its price).
- **Console access (operator granted it 2026-09-21, but it is not usable yet).** The console
  login page offers only *Continue with Google / GitHub / email* — OAuth, which this lane
  cannot complete and must **never** complete using operator credentials. **Cheapest fix: the
  operator logs in once in the Playwright profile**
  (`C:\Users\njgro\.config\opencode\playwright-profile`); the session then persists and the
  percentages become readable each turn with no credential handling. Until then: last-confirmed
  console percentages + `opencode stats`.
- **Planner model (operator, 2026-09-21): the planner stays on `deepseek-v4.1-flash` for now.**
  Muse is a candidate to take the planner role **only if it proves itself**; keep monitoring
  model cost and quality either way. Note planner context is the dominant cost driver, not
  executor dispatch.
- **STANDING RULE — offer a fresh planner handoff when context stops paying for itself.**
  Suggest it **proactively, without being asked**, when any of these holds: many turns of large
  tool output have accumulated; re-reading the same artifacts is replacing new work; a lane
  boundary or a HIGH action is imminent. Name the handoff commit and let the operator choose.
  The trigger is *context harming usage*, not turn count alone — a fresh session re-pays
  prompt-cache setup, so it must be worth it.
- **Compaction is configured, so the choice between "compact" and "fresh session" is ours only
  until compaction fires on its own.** `~/.config/opencode/opencode.jsonc`: global
  `compaction { auto: true, prune: true, reserved: 12000 }`, and the `plan` agent overrides the
  compaction *model* to `deepseek-v4.1-flash` variant `low`. `deepseek-v4.1-flash` has a
  **1,000,000-token** window, so a session can run very long before `auto` triggers — this is a
  cost/quality decision, not a hard limit. **Prefer an explicit handoff boundary over drifting
  into automatic compaction**, because compaction replaces precise committed evidence with an
  unauditable model-written summary, whereas this file is versioned and reviewable. Two
  directives still bound the choice: never reset through an uncommitted correction or an active
  HIGH action, and note that compaction invalidates the prompt-cache prefix too, so it is not a
  cache win.

## 2. Two agents, two lanes — custody

- **Lane A (this session):** client timetable surface, `AppShell.tsx`, `App.tsx`,
  `navigation.ts`, `atlas-client/package.json`, **all continuity documents**, deployment, and
  the single browser controller.
- **Lane B (GPT 5.6, ChatGPT harness):** server authority lane — `atlas-server/src/**` and its
  own docs. Charter at `docs/handoffs/lane-b-charter-2026-09-21.md`. Its first stream
  `ACTOR-SCHOOL-MUTATIONS-C01` was **approved for implementation** at
  `docs/handoffs/lane-a-to-lane-b.md` (I verified its count of eight routes independently).
  **Status: checkpointed, implementation not started, one blocking item.** It committed the
  failing-first reproducer and the `package.json` script that reaches it, but the test process
  did not terminate cleanly, so the RED was not captured with its assertion detail; and the
  checkpoint `836abba9` is **local and unpushed**, so it is not reviewable from Git. Both are
  Lane B's to clear (§4).
- **Lane B's budget shape is not ours:** ChatGPT **Plus** has no monthly cap, so its **5-hour
  window is the budget unit** and it drains faster than a Pro plan. It must work in bounded
  bursts, checkpoint a coherent commit *before* the window drains, and resume after the reset —
  never start a workstream near the limit.
- **Reserved to Lane A:** `docs/plans/live-state.md`, the delivery register and its generated
  projection, `AGENTS.md`, `CHANGELOG.md`, `atlas-client/**`, `ops/**`, `prisma/**`,
  `.opencode/**`, the root `package.json`, every `.env`, `D:\ATLAS-runtime-config\**`.
- **Serialized:** one runtime (no deploy from Lane B), one browser controller, no migrations or
  database mutation, no login.

## 2b. Lane A worktrees right now (so a fresh session never guesses)

- `E:/ATLAS-worktrees/planner-worktree-reclaim-20260921` — the continuity/**docs lane** (branch
  `docs/worktree-reclaim-20260921`). **`KEEP_ACTIVE`.** Continuity commits are pushed from here,
  and every push must `fetch` + merge first because **Lane B also moves `main`**.
- **Retired 2026-09-21 (non-forced; branches retained in Git):**
  `E:/ATLAS-worktrees/dashboard-truth-c01` (`work/dashboard-truth-c01`, `08a9b1cd`) and
  `E:/ATLAS-worktrees/dup-read-callers-c01r` (`work/dup-read-callers-c01r`, `2f1a8f33`) — both
  clean and both ancestors of `main` at removal, verified before the removal.
- `E:/ATLAS-worktrees/release-actor-school-mutations-c01-20260921` (branch
  `release/actor-school-mutations-c01-20260921`, `cbe1803e`) — the Part B deployment evidence,
  clean and integrated by this closure. **`RETIRE_AFTER_INTEGRATION`**: retire it (non-forced).
  This worktree was created the correct way — a registered worktree, not a clone.
- `E:/ATLAS-worktrees/c01r-release-20260921` — **NOT a worktree: a standalone clone** (own
  `.git`, `origin` = `D:\ATLAS`), created by the executor against `AGENTS.md` §10.12. Its only
  branch `release/dup-read-callers-c01r-20260921` (`beedb104`) is clean and now integrated into
  `main`, so it holds no unique commits — but `git worktree remove` does not apply to it and a
  raw recursive delete is not permitted. **`PRESERVE_FOR_DECISION`** (~1 GiB): flag to the
  operator, do not delete without an explicit instruction. The same deviation exists in the live
  release directory `D:\ATLAS-runtime-supervised-a02884ff-20260921` (a clone, not a registered
  detached worktree); it is verified and live, so it is **not** to be re-shaped.
- Retire with `git worktree remove <exact path>` then `git worktree prune` — never `--force`,
  never a glob or computed path, and **never delete the branch**.
- **Do not touch:** Lane B's `E:/ATLAS-worktrees/actor-school-mutations-c01`, the two
  uncertain-owner planner worktrees, `E:/ATLAS-worktrees/ux-quickfix-c01` (junction anchor), or
  any `D:\ATLAS-runtime-*` tree.
- **One Lane A writer at a time.** This session and the previous Lane A session overlapped for
  ~10 minutes on 2026-09-21 (see the custody note above); the previous one declared its last push
  final, so only one Lane A writer is active now. A second one on the same stream is a custody
  defect, not parallelism.

## 3. Completed this session (newest first)

| Stream | Result | Key SHAs |
|---|---|---|
| `DUP-READ-CALLERS-C01R` Part B/C | Re-release **`a02884ff`** deployed; D1–D4 + B1–B3 accepted **7/7/0/0** after one bounded planner-applied evidence correction; **B2 fixed** (`/auth/me` ×1) | `6e408e9a`, `beedb104` |
| `ACTOR-SCHOOL-MUTATIONS-C01` release | Server fix **live** in `80acdc25`: source review **9/9**, post-action QA `ACCEPT_READY` **5/5/0/0**, in-transaction-pinned signature map pre == post, independent zero-write DB scan, **no browser rows** (client delta empty) | `cbe1803e`, `80acdc25` |
| Lane B `ACTOR-SCHOOL-MUTATIONS-C01` source | Integrated on `main` at `07739636`: 8 runtime mutation `POST` routes gain actor-school enforcement | `ad79c2b3` |
| Directive relocation | `AGENTS.md` **3,843 → 3,195 words** (~850 tokens/request saved), 133-rule audit, 4 dropped rules restored | `01af8d71`, `1437e137` |
| `DUP-READ-DIAGNOSIS-C01` | Read-only diagnosis: duplicates are **not** StrictMode; per-caller causes named; 502s unproven | `5837a775`, `dbe7fde2` |
| `UX-R03e` | Runs + Setup panes; route split **complete**; QA `ACCEPT_READY` 13/13 | `5acb08b8`, `434b2a81`, `890fa67a` |
| `UX-R03d` | Outlet keying fix (no remount in-subtree); unwired-test correction | `5f5c6c4f`, `fc966a4c` |
| `UX-R03c` | Policy read ownership (duplicate fetch gone); exports pane | `c93dd2ee`, `608573e5` |
| Deploy C02 (one-shot) | 8/8 deploy rows + browser rows | `d50dde64` |
| Deploy C01 | 8/8 | `74999168` |
| `PRISMA-CLIENT-REPAIR-C01` | Restored the live release's restartability; 6/6 | `b63b4a12`, `608573e5` |
| Directive rules added | 4 rules, each from a named defect | `6df7f42f`, `2a5b66a2`, `d50dde64` |

**EnrollPro:** the proxy 502 was a companion outage, never ours; the peer came back on its own
and the proxy is healthy. The superseded `ENROLLPRO-PROXY-RECOVERY-LIVE` packet was correctly
**not** executed — executing it would have downgraded the runtime.

## 4. In flight / open

- **`DUP-READ-CALLERS-C01` / `-C01R` — CLOSED.** Source integrated, and the fix is live in
  `a02884ff`. The narrative below is the packet's correction history — keep it, but do not
  re-run it. Packet
  `docs/prompts/dup-read-callers-c01-2026-09-21.md`; worktree
  `E:/ATLAS-worktrees/dup-read-callers-c01`, branch `work/dup-read-callers-c01`, base
  `origin/main` `f6e5fce5`. One-shot under the standing authorization: the three named
  callers, deployment, browser acceptance with QA custody; 13 rows; capacity precondition in
  §0 of the packet. The planner re-verified all three callers at `origin/main` and confirmed
  the five implicated files are **unchanged since the diagnosis base `5ce47f60`** (empty
  diff), so the findings' line numbers hold. The previous session's worktree is gone; the
  stale local ref `docs/dup-read-callers-20260921` is 0-ahead/5-behind `origin/main` and
  carries nothing — do not reuse or reset it.
  1. `atlas-client/src/lib/settings.ts:463` — `resolveActorSchoolId` has no in-flight sharing
     (`/auth/me` races); share one promise per token epoch.
  2. `atlas-client/src/lib/enrollpro-public-settings.ts:231-241` — `forceRefresh` bypasses its
     own `inflightBySchool` dedup (`runtime/context`); make force join in-flight work, and drop
     the redundant `useTimetableData.ts:1175-1190` follow-up.
  3. `atlas-client/src/lib/settings.ts:528` (`fetchRolloverStatus`) — raw axios, zero dedup;
     two `RolloverGuidanceCard`s can mount. Share one in-flight request per school.
  **Explicitly not** an `atlasApi` coalesce (would touch every call).

  **State after the pre-action review (`ses_f3de7e123ffem8meOv9yZ6kAdl`).**
  `CORRECTION_REQUIRED` — 3 blocking findings, all real, all accepted in the r1 packet:
  (i) the capacity precondition gated only the pre-build figure, so a build would land
  **below the 15 GiB floor**; (ii) the `/auth/me` row was unsatisfiable unless the
  `verifySessionToken` unification became mandatory — it is now A1, and `AppShell.tsx` is
  authorized; (iii) A2's force-join would have **silently dropped `verifyUpstream`**, a
  user-visible drift/term regression — A2 now keys the in-flight registry by request profile.
  Also corrected: `rollover-status` keyed by school + `includeCounts`; the new script must run
  seven decisive suites that are in no script today; the two report-only rows are demoted to
  observations. r1 rows: **5 mandatory source rows**, 2 deferred browser rows, 2 observations.

  **Re-scoped: this cycle is SOURCE-ONLY.** The deployment cannot run at 15.81 GiB free — a
  1.43–1.86 GiB build lands at 13.95–14.38 GiB, below the floor, with PostgreSQL on `D:`.
  Deployment and browser acceptance are deferred into the next release.
  **Operator decision pending — `D:` headroom.** 21 `D:\ATLAS-runtime-*` directories are on
  Lane A's never-retire list, so reclaiming them is operator-only, and every future deploy
  lands below the floor until that is resolved.

  **r2.** The bounded re-review (`ses_f3de10bf8ffeM7Ban32pvyJIhi`) returned
  `CORRECTION_REQUIRED` again — 2 blocking, both in A2, both accepted: the request-profile key
  must also carry `allowStaleOnError` (`AppShell` passes `false`, `MySchedule` passes `true`,
  and they share a key today), and the `useTimetableData.ts:1175-1190` follow-up must be
  **kept**, because it is the only path propagating the fresh context to hook state — deleting
  it changes rendered `schoolYearSource`/`activeTerm`.
- **Lane B — CLOSED on both items; integrated at `07739636`, not deployed.** It pushed its
  checkpoint and captured the RED; its additive merge carries exactly its seven approved paths.
  The two items below are the historical residue of that episode:
  1. **Push the checkpoint.** `836abba9` is local only; the review discipline is that a
     candidate is reviewable from Git alone. `git fetch` before pushing, never force-push.
  2. **Fix the harness teardown so the RED is capturable.** A failing-first reproducer that
     hangs is not evidence. Close the mounted HTTP server and disconnect the instrumented
     Prisma client in teardown — copy whatever the existing mounted runtime read-scope test
     does — then capture the RED output to a file and commit it as evidence.
  Only after those: implement the route-local authority helper, then A1-A3 and A5-A6 with real
  tallies. Its own verdict (`CHECKPOINTED — IMPLEMENTATION NOT STARTED`) was honest and correct.
- **502 lead — CLOSED as no-ATLAS-fix.** O1 captured the failing body: a host-proxy
  `{"code":"UPSTREAM_UNREACHABLE","message":"read ECONNRESET"}`, and a token-authenticated retry
  returned 200. Reopen only on a contradicting capture. O2 also records repeats outside the three
  named callers (`runtime/context` ×2, `/notifications` per scope, and the app's own retry after
  a 502).
- **UX backlog:** the dashboard tile reporting "335 review blockers" on a zero-HARD published
  run; the advanced policy surface's layout switch + refetch (pre-existing).

## 5. Authorization and working rules that matter here

- **Standing authorization** for HIGH actions, deployment and browser acceptance for this
  program — gates retained, only the approval round-trip waived. Packets bundle source +
  deployment + browser acceptance into one cycle.
- **Per-pane / per-part checkpointing** is load-bearing: executors hit step limits repeatedly,
  and a checkpoint is what saved `UX-R03e`. Split executor runs into Part A (source) and Part B
  (deploy); hand browser custody to QA so browser rows are not self-graded.
- **A negative claim of mine needs the same adversarial check as a positive one.** Three of my
  own claims were falsified this session: the C02 element-identity row, "no run-list endpoint
  exists", and four rules dropped by my own compression. Independent review caught all three.
- **`git push <branch>:main` is an integration, not a docs sync** — now `AGENTS.md` §10.11.
  This session breached it: pushing the continuity docs from `work/dup-read-callers-c01` after
  the executor had committed carried the **unaccepted** candidate onto `main` (`ccf31e77` →
  `15c1725e`). History was not rewritten (no force-push; Lane B shares the remote). Acceptance
  is being completed on the already-pushed range and the ordering defect is disclosed here.
  Continuity commits need a docs-only branch.

## 6. Next actions, ordered

1. **Close the actor-school residual authority lane** — the highest-value item that is not
   operator-gated, and a *source-only* successor to what just shipped: `GET /rollover-recovery/preview`
   (`runtime.router.ts:244`) still defaults to school 1; `parseStrictTermAuthoritySchoolId` (`:424`)
   lacks the new non-string guard; harness hardening (body-vs-query precedence, hex/exponent/padded
   strings, an aggregate script). **That lane is `atlas-server/**`, i.e. Lane B's ownership** — hand
   it to Lane B or explicitly re-assign it, with its own packet and review.
2. **Operator-gated, each needing its own reviewed packet:** the term-cache catch-up **apply**
   (capture complete at `9c19b772`, still unbound) → canonical readiness diagnostic →
   fingerprinted generation preview → **generation** → then **publication**; and the SMART/AIMS
   companion handoffs to their repository owners.
3. Backlog (non-blocking): the dashboard tile reporting review blockers on a zero-HARD published
   run; the advanced policy surface's layout switch + refetch; the `parseSchoolId` defaulting on
   other non-listed routes.
2. Then: the remaining UX backlog — the dashboard tile still reporting review blockers on a
   zero-HARD published run, and the advanced policy surface's layout switch + refetch — plus the
   `parseSchoolId` defaulting backlog on non-listed routes.
3. The 502 lead needs **no** ATLAS fix (host-side `UPSTREAM_UNREACHABLE`/`ECONNRESET`, captured in
   O1). Revisit only if a new captured body contradicts that.

## 7. Artifact index (paths only — do not paste contents)

- Packets: `docs/prompts/*.md` (one per stream; `current-source-live-deploy-c02-*` is the
  one-shot template).
- Evidence: `docs/reviews/<stream>/`.
- Charters and handoffs: `docs/handoffs/`.
- Continuity: `docs/plans/live-state.md`.
- Gates: `docs/reference/agent-verification-gates.md`; browser: `agent-live-browser-qa.md`;
  context economy: `agent-context-economy.md`; deploy facts: `agent-runtime-deploy-facts.md`;
  worktrees: `agent-worktree-lifecycle.md`.
