# Handoff — Planner A2 → next session (updated 2026-09-26, session 2)

**Read this first, then `docs/plans/live-state.md` (`## Live release`, `## Capacity`, and the Lane A2
section at the end).** This file supersedes the session-1 handoff of the same date; its still-valid
process rules and mistake list are carried forward below, and its state table is replaced.
`atlas-session-checkpoint` could not be loaded in session 2 (skill loading is restricted), so the minimum
resumable state is recorded here rather than in a second ledger.

## 1. THE ONE ACTION: deploy product pin `0da104f9`

Session 2 closed two more packet items but deliberately **did not deploy** — the cutover was not
pre-verified and a half-executed swap of the shared runtime is worse than none. That is now the whole job.

> **STATUS UPDATE (session 3).** The deploy has been taken through **two rounds of independent pre-action
> review**, and both are recorded here because they changed the plan:
> - **Round 1 → `CORRECTION_REQUIRED` 13/15/2/0.** The register entry claimed the range was *client-only*.
>   **That was false and it was my error**: `e4989b72..0da104f9` is **40 files, 14 under `atlas-server/` plus
>   `prisma/seed.js`**, because my branch merged `origin/main` repeatedly and Lane A's credential scrub
>   (tip `d330870a`, recorded `ACCEPT_READY` 9/9/0/0) rides along. The load-bearing file is
>   `atlas-server/src/services/local-auth.service.ts`, where `seedLocalAuthAccounts` now **requires** a
>   password and throws on blank — removing the committed `Atlas2026!` default from a public repo. It is a
>   **security improvement, and the first time this server build reaches production.** Corrected at `5d071e5a`.
> - **Round 2 → `CORRECTION_REQUIRED` 24/25/1/0.** Both prior findings verified genuinely closed. One **new**
>   blocker: `E:` is **49.48 GiB, below the §3 50 GiB warning**, and §3 requires the release-directory reclaim
>   **before the next release build** — which is the deploy's first step. Two register lines still claimed no
>   reclaim was owed (one citing a stale `E: 55.28`); both are now superseded by a dated recheck at `e9747b79`.
>
> **§3 GATE NOW DISCHARGED (session 3, later).** `4893cbde-20260923` (1.80 GiB) was **retired** under a
> frozen manifest (`docs/reviews/reclaim-4893cbde-20260926/`) and an independent pre-action audit that first
> returned `CORRECTION_REQUIRED` 13/14/1/0 on two blockers — an authority gap I had created, and a
> worktree-count baseline of 41 that was really 42 — both cleared before execution. `E:` **49.48 → 51.34 GiB**,
> above the 50 GiB warning, so **capacity no longer blocks the deploy.** All tripwires held: all ten
> `node_modules` counts unchanged (server 209 ×5; client 155/155/156/155/156 with the donor's 156
> load-bearing), `@prisma/client` resolving, four reads 200, listeners unmoved, `git worktree list` 42,
> stashes 3, no branch or ref deleted.
>
> **The decisive fact, and the reason this was safe:** the dirt was **already fixed for every tree created
> since**. `D:\ATLAS\.git\info\exclude` carries `/ops/runtime/logs/` precisely because the supervisor writes
> `supervisor-state.json` into the release tree it runs from; `.git/info/exclude` is **per-clone**, so this
> standalone clone predates its own fix. No work, no evidence, no keep-set slot.
>
> **So the deploy's EVERY pre-action gate is now closed.** The only reason it has not run is remaining
> context in the session that discovered this: build → dry run → elevated execute → server-side byte proof
> → fresh post-action QA will not fit, and a half-executed cutover is the one outcome to refuse. **Start a
> fresh session and run it.**
>
> **Do not expect margin:** the build costs ≈1.46 GiB and lands `E:` at **≈49.8 GiB, again just under the
> warning.** The deploy will need its own successor reclaim manifest. That is expected, not a surprise.


### Also carry forward from the two review rounds

- **The server build is now the decisive proof artefact, not the client.** Because a *server* build ships,
  client-only chunk evidence is no longer sufficient. Prove
  `Select-String -SimpleMatch 'Atlas2026!' atlas-server\dist\server.js` returns **0 hits in the new build and
  ≥1 hit in the incumbent's** — that byte-distinguishes the servers *and* demonstrates the credential removal
  shipped. Client-side, SHA-256 the chunk containing the `/my` tombstone, new vs incumbent.
- Post-action QA must re-verify on the **live** build that `dist/server.js` carries no `Atlas2026!`, that
  login still authenticates correctly and rejects wrong/empty credentials, and that `GET /api/v1/auth/me`
  behaves.
- Two credential-scrub items Lane A itself flagged as unclosed: no behavioural test covers the
  blank-password guard (verified only by out-of-tree harnesses), and `.gitignore` un-ignores exactly two
  Playwright spec filenames, so a new spec under `qa-artifacts/playwright/specs/` is silently unscanned.


| Fact | Value | How to confirm |
| --- | --- | --- |
| **Deploy target (product pin)** | `0da104f96696aef7de7016e5364f29b50d0ed00f` | full 40-char; runner rejects 8-char prefixes |
| Docs-only commits above the pin | `e4df0019` (live-state) — safe to ship alongside | `git log --oneline 0da104f9..e4df0019` |
| `origin/main` | `e4df00198311ce320e8bc9903a4e8a7dec2055cc` | `git -C D:/ATLAS fetch origin --prune` then `rev-parse origin/main` |
| **Rollback basis** | `400a6909` (retained, never executed) | keep-set per the retention policy |
| Live release now | `e4989b725394204898ebcd429db74daaf7316323` | machine-scope env, **not** the inherited shell |
| Live release dir | `E:\ATLAS-runtime-supervised-e4989b72-20260926` | — |
| Health | 5001 health 200 · ready 200 · **DB-backed** subjects 200 · 5174 200 | `Invoke-WebRequest` each |
| `E:` free | **49.48 GiB** — below the 50 GiB warn line | `Get-PSDrive E` |
| Dependency donor | `861d89a2` — **never retire**, lanes copy `node_modules` from it | — |

### Required sequence (HIGH — none of it is waived)

1. **RE-CHECK PLANNER A FIRST.** No lane had claimed an integration or deploy window as of session 2 close,
   but A works alongside and may start at any time. Re-check immediately before the swap, not from memory.
2. **Register before cutover.** `ops/runtime/deploy-runner.ps1` refuses to swap unless
   `docs/plans/live-state.md` on `origin/main` already names the target **and** its rollback basis in
   `## Live release`. Commit and push that entry **first** — the current block still describes `e4989b72`.
3. Independent **pre-action review** (one dispatch closing the source range *and* the packet's
   satisfiability lint in the same pass).
4. Build the release dir: `npm ci` both packages, `prisma generate --schema ../prisma/schema.prisma` from
   `atlas-server`, server build, client build with `VITE_ENROLLPRO_URL` set. **Never junction
   `node_modules`**; verify 0 reparse points.
5. Dry run (`mutates: false`, `secretsPrinted: false`), read the plan under `C:\ProgramData\ATLAS\release-audit`,
   then the identical arguments with `-Execute` **elevated**.
6. **Prove it** by fetching a chunk that exists only in the new build and comparing byte-for-byte. For
   `e4989b72` the proof was the `schedules-selected-term` / `schedules-view-term` test-ids appearing live.
7. Fresh independent **post-action QA** with a real `passed/blocked/unperformed` tally. `ACCEPT_READY`
   requires `passed == total`, `blocked: 0`, `unperformed: 0`. A healthy process is `DEPLOYED`, not done.

### Deploy gotchas learned the hard way

- **The client build fails closed** without `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`
  (`atlas-client/vite.config.ts:13,29`) and exits 1 **silently, pre-compilation**. Session 2 hit this.
- **A supervisor state read is env-sensitive.** An inherited shell `ATLAS_RUNTIME_SOURCE_DIR` can be one
  release behind and it **overrides machine scope**, so `cli.mjs status` reports a displaced release with
  dead child PIDs and looks like a downed runtime. Session 2 raised a false "deploy incomplete" alarm this
  way. Judge identity by machine scope, the scheduled-task action, and the listener command lines.
- A new release dir costs ~1.46 GiB, taking `E:` to ~48 GiB and **re-triggering the §3 warning** recorded in
  the Capacity block. Do not rebuild twice.
- Test every harness actually runs. A test no committed `package.json` script reaches is not evidence.

## 2. Closed in source, accepted, and on `main` (nothing left to do but deploy)

| Item | Evidence |
| --- | --- |
| Room Schedules term scoping (was inventing 10 conflicts in G7 Room 103) | `e4989b72`, live and accepted: term resolves `verified: true, termIndex: 2`, page renders "Showing TERM 2", **page reports no conflicts** |
| `/my` faculty portal retired — unreachable, reversible | candidate `5680c87a`, QA `ACCEPT_READY` 14/14/0/0, merge `d902c69a` |
| Browser-QA **#4** one name for a blocking problem ("Must fix") | candidate `b6db07b3`, QA `ACCEPT_READY` 14/14/0/0, merge `0da104f9` |
| Browser-QA **#3c** public term switch no longer clears a valid section | same candidate/merge |
| Browser-QA **#3a/3b** public term authority | **closed as a negative diagnosis** — the server was already correct |
| `E:` release-directory reclaim (owed since the warning was crossed) | `eb0e3038` retired, 1.46 GiB, independent audit `CLEAR_TO_PROCEED` 12/12/0/0 |

**#3a/3b detail worth not re-deriving:** `published-schedule.router.ts:44-51,54,67` maps a missing
`termIndex` to `'active'` and never to `1`; `published-schedule.service.ts:774-783` resolves `'active'` solely
from the verified ordered-term contract and **throws** 409 (`TERM_STRUCTURE_UNAVAILABLE` /
`TERM_SELECTION_REQUIRED`) rather than defaulting. Zero `?? 1` / `|| 1` in that path. The walk's "TERM 1" was
**display-side** — prime suspect `academic-term.ts:50-52` `academicTermFallbackLabel` → `T1` on a blank
`displayLabel` (used by `RoomSchedules.tsx:128,133`).

## 3. Open, in order

1. **#5 drift banner at 390 px** (HIGH) — `components/timetable/simple/SimpleDriftBanner.tsx` has **11
   `shrink-0` sites**, incl. `:229` Preview impact and `:256` Regenerate. Fix the layout at the component
   boundary. **Do not weaken a regeneration guard, do not turn the read-only preview into a write, preserve
   every `data-testid`.**
2. **#6 Runs claims "none" while loading** (MEDIUM) — `TimetableRunsPane.tsx:73-85` derives both the header
   sentence and the empty state from `runs.length === 0` with **no pending input**. Thread the parent's real
   loading signal; pending must announce nothing, a settled empty response announces the empty state
   **exactly once**, and a **rejected** request must show an honest error, never "No generation runs yet".
3. **#2 shared lifecycle model** (BLOCKING) — dashboard, timetable and public describe the same lifecycle
   differently; a reviewing draft was badged "Live". **Still blocked exactly as session 1 found it:**
   `useDashboardData` exposes only the boolean `activeTermPublished`, not run / revision / `publishedAt` /
   `termIndex` / `termVerified`. Expose the facts, then wire the model. **Do not half-wire.**
   *Note: `/my` is now retired, so this is three surfaces, not four.*
4. **#4 completion** — raw `'Must fix'` literals remain in `TimetableGridConflictBadge.tsx:90,156`,
   `simple/SimpleSessionDetails.tsx:107`, `TimetableGrid.tsx:460-461`. Not a regression
   (`test:plain-tokens-c04` T7 passes) but **#4 is partial, not done**. Re-run T7 if the rename extends.
5. **Fail-open default class** — `runtime.router.ts:204` still treats an absent `verifyUpstream` as
   unverified, contradicting `runtime-context.service.ts:375`. The cheap systemic fix is a shared
   `boolParam` helper at the route boundary that **states its absent-default**; the route layer currently
   mixes both conventions with nothing announcing which, and `subject.router.ts` uses both in one file
   (`:40-41` vs `:227-229`).
6. **Then** continue timetable UX/UI/functions/flow/controls QA as an older, mouse-first scheduler.

## 4. Repo and test state

- Branch `work/a2-timetable-custody`, worktree `E:\ATLAS-worktrees\lane-a2-timetable-custody`, clean, fully
  pushed (`0/0` vs `origin/main` at `e4df0019`). No stashes of mine; 3 pre-existing entries belong to other
  branches — **do not touch them**.
- **Client suite baseline: 12 failures across 8 files, all pre-existing. Compare by FAILING TEST NAME,
  never by count.** Four `playwright` typecheck errors are also pre-existing (3× TS2307 + 1 TS7006).
- Those 12 are **real debt, not noise** — `B4` (policy-pane allowlist drift), `tt-source-freshness-client-c04`
  "server allowlist must have 11 codes (got 12)", and the `timetable-simple-sync-setup` / export-trigger /
  `isPublicationBlockingCode` source-scan family. **Several are authority guards currently failing.** No
  recent candidate cleared them; do not read them as cleared.
- Green gates worth trusting: `test:plain-language-j2j3-c01` 18/18, `test:plain-tokens-c04` 30/30,
  `test:ux-guardrails` 31/31, `test:scheduler-concern` 26/26, `test:timetable-ux-rehaul` 35/35,
  `test:retired-faculty-portal` 5/5.

## 5. Process rules that will bite you

- **Capacity: the reclaimable set is ONE directory, not three.** `26f7c907` is the **second most recent
  accepted release** and is keep-set — the old table in `ae523c9d` wrongly called it reclaimable, and acting
  on that table would have destroyed a keep-set rollback basis. `4893cbde` is **preserved as dirty**
  (`?? ops/runtime/logs/`). `eb0e3038` is gone. Keep: `e4989b72` (live), `400a6909`, `26f7c907`,
  `116a7658` (named fallback), `861d89a2` (**donor — never retire**).
- `26f7c907` and `eb0e3038` were **registered linked worktrees**, not standalone clones — `git worktree
  remove` applies; `Remove-Item -Recurse -Force` is reserved for standalone clones and leaves a stale
  registration.
- Retiring never authorises branch deletion.
- Read `docs/reference/agent-worktree-lifecycle.md` and `docs/reference/agent-timetable-invariants.md`
  before reclaiming or touching a term query. Missing term identity is unresolved authority and must
  **never** become Term 1.

## 6. Mistakes from session 1 worth not repeating

- Shipped the term-scoping fix **before** the resolver it depended on, after diagnosing that dependency
  myself — the page sat fail-closed in production. **Sequence dependencies first.** The same lesson applies
  to the `boolParam` fix above.
- Used the **EnrollPro** school-year id `551` where the API wants ATLAS's `school_year_id` `10`, and nearly
  filed a typo as a finding. Verify identifiers in the database.
- Used **localhost** for browser QA when the directive names the Tailnet origin; separate origin, separate
  storage, so it falsely looked like no session existed. **No seeding was ever needed.**
- Dumped a ~740 KB API payload into context. Filter every probe.
- Deferred a pre-verified deploy several times, converting caution into delay. **With HIGH authority, a
  pre-verified cutover plus its proof *is* the job.** (Session 2 honoured the intent by not starting an
  *unverified* one.)

## 7. Session-2 mistakes, recorded the same way

- Ran `cli.mjs status` from the wrong release directory and briefly reported the runtime as misconfigured.
  Cause: the read is env-sensitive, not directory-sensitive (§1).
- Wrote a tripwire baseline with **four** `node_modules` counts for **five** kept directories, omitting the
  dependency donor's `156` — the most consequential directory. An independent reviewer caught it before the
  reclaim executed. **When recording a baseline, count the rows against the list.**
- Told an executor to edit `timetable-header-collapse-c01.test.tsx` on a stale line citation. It pushed back
  with evidence: `'hard blockers'` there is only a case *label*, not an assertion. **The implementer was
  right and I was wrong** — and it also caught that an inherited residual had silently inverted four
  `doesNotMatch` guards into unsatisfiable rows, restoring them to base.
