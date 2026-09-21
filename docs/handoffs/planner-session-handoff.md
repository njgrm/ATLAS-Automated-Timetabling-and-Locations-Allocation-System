# ATLAS planner session handoff (living document)

**Updated at the end of every turn** so a fresh session resumes from this one file. The
planner writes and phrases it; the kickoff line below never changes. Updating it every turn is
deliberate and cheap (~1–2k tokens): it makes any turn boundary a safe session boundary. The
*decision* to actually start fresh stays conditional — take it at a real lane boundary, before
a HIGH action, or once a compaction would cost more than a restart.
Last updated: 2026-09-21, Lane A resumed in a fresh session. `DUP-READ-CALLERS-C01` is at
**r2** after two review rounds (`CORRECTION_REQUIRED` twice, 5 blocking findings total, all
real and all accepted). The cycle is re-scoped **source-only**; the deployment is deferred on a
measured `D:` capacity gate, which is now an operator decision. Executor candidate `ce0e54ec`
(base `ccf31e77`) passed fresh QA on S1–S4 with **no assertion removed**; S5 was `BLOCKED` only
by an incomplete worktree dependency tree, now fixed (junction removed safely, `npm ci`, and
`68/68` + typecheck exit 0 re-run in the frozen state — see the evidence addendum). Next: the
bounded QA re-check of S5, then integration.
**Operator decision still pending: `D:` headroom** (deployment deferred).

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

- Release **`434b2a81`** at `D:\ATLAS-runtime-supervised-434b2a81-20260921`; supervisor 87396;
  `5001`→74212; `5174`→90380; served entry `index-BMgoX99N.js`; Tailnet healthy.
- Rollback basis **`5f5c6c4f`** (startable, junction-free, task-XML capture retained).
- **Budget:** `monthly 41% · weekly 3% · rolling 7%`. The DeepSeek V4.1 Flash **x4 promo was
  extended to Sep 27** (verified on the docs page, updated Sep 21) — so `atlas-qa` (ds4.1flash)
  stays cheaper than `dsflashv4` at identical token rates. Report the budget every turn.

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

## 3. Completed this session (newest first)

| Stream | Result | Key SHAs |
|---|---|---|
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

- **`DUP-READ-CALLERS-C01` — packet authored; pre-action review is the next step.** Packet
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
- **Lane B — two blocking items to clear before it implements** (both its own, neither mine):
  1. **Push the checkpoint.** `836abba9` is local only; the review discipline is that a
     candidate is reviewable from Git alone. `git fetch` before pushing, never force-push.
  2. **Fix the harness teardown so the RED is capturable.** A failing-first reproducer that
     hangs is not evidence. Close the mounted HTTP server and disconnect the instrumented
     Prisma client in teardown — copy whatever the existing mounted runtime read-scope test
     does — then capture the RED output to a file and commit it as evidence.
  Only after those: implement the route-local authority helper, then A1-A3 and A5-A6 with real
  tallies. Its own verdict (`CHECKPOINTED — IMPLEMENTATION NOT STARTED`) was honest and correct.
- **502 lead:** needs one failing response body (status/body/headers) from a browser lane.
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

## 6. Next actions, ordered

1. `callers` one-shot: author packet → pre-action review → executor (Part A) → deploy (Part B) →
   QA with browser custody → integrate → record in `live-state.md`.
2. Review Lane B's implementation range when the operator says it has finished.
3. Then: the dashboard truth issue, or the 502 lead once a failing response body exists.

## 7. Artifact index (paths only — do not paste contents)

- Packets: `docs/prompts/*.md` (one per stream; `current-source-live-deploy-c02-*` is the
  one-shot template).
- Evidence: `docs/reviews/<stream>/`.
- Charters and handoffs: `docs/handoffs/`.
- Continuity: `docs/plans/live-state.md`.
- Gates: `docs/reference/agent-verification-gates.md`; browser: `agent-live-browser-qa.md`;
  context economy: `agent-context-economy.md`; deploy facts: `agent-runtime-deploy-facts.md`;
  worktrees: `agent-worktree-lifecycle.md`.
