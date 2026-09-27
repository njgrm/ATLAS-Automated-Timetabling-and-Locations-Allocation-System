# DEPLOY PACKET — A2 release `d31bfacb` (HIGH) — **client + server**

**Authority:** operator standing authorization (2026-09-20) plus the explicit overnight deploy authorization
("go, deploys authorised overnight", in chat with Lane C, 2026-09-27). The approval round-trip is waived; **no gate
is waived** (§13). Both source ranges below are independently reviewed and accepted on `origin/main`.

**Supersedes:** `docs/prompts/a2-release-a56ac86d-2026-09-28.md`, which was written for `a56ac86d` and never
executed. **`a56ac86d` is not the tip** — `d31bfacb` adds one docs commit on top of it, so the built client
artifact is byte-identical while the released SHA and its recorded identity are not. The `a56ac86d` packet is
committed as history, marked `SUPERSEDED by d31bfacb`, and must not be executed.

**Why this release, and why now:** it is the `origin/main` tip at the start of the overnight window, so it ships
A2's item-2 batch (one meaning per number, run identity on screen, the batch-notification defect) **and** A3's
`f0602703` (truthful teaching-load percentage, no fabricated room utilisation) in one cutover. Early, so the
night's remaining QA and the demo walkthrough run against a current build. The live register was **false** when
this packet was written (`9b28c572` named LIVE while `c0d91827` was serving); that is corrected in the same commit
that records this target, because `Assert-LiveReleaseRecorded` reads that section.

## 1. Pin

| | |
|---|---|
| **Target** | `d31bfacbfeadb8e90bf9cf1f7a8ddcad62ab129a` |
| **Live now** | `c0d91827311e247ac0f2073a83cc50f5a5efcdb2`, dir `E:\ATLAS-worktrees\lane-a2-release-c0d91827` |
| **New dir** | `E:\ATLAS-worktrees\lane-a2-release-d31bfacb` (HEAD `d31bfacb`, `git status --short` empty, own `npm ci` tree, `prisma generate` from `atlas-server` against the **repo-root** schema, `tsc` build 0, client build 0 with `VITE_ENROLLPRO_URL` exported) |
| **Rollback** | supervised reset to the retained `c0d91827` dir — **verified present, clean, both `dist`s built.** One-step supervised reset. |
| **Direction** | **FORWARD.** `git merge-base --is-ancestor c0d91827 d31bfacb` exits **0** — verified, nothing is reverted and every fix currently live stays live. |
| **Elevation** | `IsInRole(Administrator)` = **True** (required by §6 for the task-XML route; `deploy-runner.ps1` re-checks it). |

## 2. Exact delta — 29 non-docs paths, enumerated by `git log c0d91827..d31bfacb --name-only`

15 commits, 38 unique paths, **29 non-docs** (`docs/` + `AGENTS.md` excluded). **This is not a client-only
release:** two `atlas-server/` production files are in it. No `prisma/` path, no migration, no schema, no seed,
no root `package.json`, no `package-lock.json`, no `.env`, no `vite.config.ts`, no `tsconfig`. The two
`package.json` changes are `scripts` entries only.

### 2a. Lane A2 — 19 paths, independently reviewed

| Path | Commit | QA on record |
|---|---|---|
| `atlas-client/src/components/timetable/ScheduleReviewWorkspaceHeader.tsx` | `f9879289`, `8325834d` | `test:timetable-run-identity-a2` (new script entry) + the item-2 aggregate |
| `atlas-client/src/components/timetable/ScheduleReviewWorkspace.tsx` | `f9879289` | as above |
| `atlas-client/src/components/timetable/LeftRailContent.tsx` | `f9879289` | as above |
| `atlas-client/src/components/timetable/TimetableSubNav.tsx` | `f9879289` | as above |
| `atlas-client/src/components/timetable/modals/TimetableWorkflowDialogs.tsx` | `f9879289` | as above |
| `atlas-client/src/hooks/useTeachingLoadRouteIntent.ts` | `f9879289` | #3 Change owner returns to the right teacher |
| `atlas-client/src/hooks/useTimetableData.ts` | `f9879289` | #2 no cross-term daily-load sum |
| `atlas-client/src/lib/timetable-live-conflict.ts` | `f9879289` | truthful conflict wording |
| `atlas-client/src/lib/timetable-plain-language.ts` | `f9879289` | **NEW** — the one-noun, one-meaning wording module |
| `atlas-server/src/services/notification-inbox.service.ts` | `f9879289`, `8325834d` | `test:notification-inbox-dedupe-a2` (new) + `notification-inbox.test.ts` (amended) |
| `atlas-server/src/services/generation.service.ts` | `f9879289` | batch commit writes its per-change notification identity |
| 6 test files (3 client new + 2 amended, 1 server new) | `f9879289`, `8325834d`, `a56ac86d` | `a56ac86d` is test-only: it expresses the unscoped term the way the type allows and covers the null encoding |
| `atlas-client/package.json`, `atlas-server/package.json` | `f9879289`, `c35ee9f2` | **`scripts` entries only** — no dependency, build or config change |

> **The batch-notification change closes a named open BLOCKING finding.** `notification-inbox.service.ts:174-196`
> records the root cause in its own comments: the dedupe identity was per-*slot*, so a whole multi-edit commit
> (`commitManualEditBatch`, `manual-edit.service.ts:1609`) collided with the single-swap path, **wrote the
> schedule, returned 200, and persisted no notification row**. That is exactly the finding Lane C and the
> `9b28c572` post-action QA recorded on 2026-09-27 (`notifications` 216 → 216 after a committed swap, D10). It
> was open at the time this packet was written; it is fixed here. **The browser row below is the test that
> discriminates it, and it is a real-data write on the draft — it is authorised and its delta must be recorded.**

### 2b. Lane A3 — 10 paths, foreign contribution, with its own acceptance evidence

| Path | Commit | Nature |
|---|---|---|
| `atlas-client/src/lib/room-utilization-display.ts` | `f0602703` | **production** — stops rendering unknown room utilisation as 0% (#53) |
| `atlas-client/src/components/BuildingView.tsx` | `f0602703` | **production** — consumer of the above |
| `atlas-client/src/components/campus-map/CampusMapOverview.tsx` | `f0602703` | **production** — consumer |
| `atlas-client/src/components/dashboard/CampusReadinessCard.tsx` | `f0602703` | **production** — consumer |
| `atlas-client/src/components/faculty-assignments/TeacherLoadReadout.tsx` | `f0602703` | **production** — labelled teaching-load percentage |
| `atlas-client/src/components/faculty-assignments/TeacherGridMode.tsx` | `f0602703` | **production** — consumer |
| 3 test files | `f0602703` | `a3-teacher-load-readout-a1`, `a3-room-picker-rows-01-02`, `room-utilization-display-a3` — A3's own gate, `test:a3-truthful-numbers` |
| `atlas-client/package.json` | `f0602703` | that script entry only |

**A2 19 + A3 10 = 29.** A3 reviewed its own range under its own lane process and posted
`A3 integrated for release at 1e417694` in `lane-a-to-c.md`; the merge `e6a60967` carries the source. **A3 is a
foreign lane in this release: its 9 live-acceptance steps are executed in this cycle (browser rows B1–B9 below),
and its rows are reported as A3's, not as A2's.** A3's `1e417694` is in the range; its earlier `d9d5def1`
test-only pin is already inside the incumbent.

> **Enumeration was run for real, not described from the candidates this lane reviewed** (§13). The count above
> comes from `git log c0d91827..d31bfacb --name-only` with per-commit attribution, which is how A3's six
> production files were found. Describing the range from "the two batches I reviewed" would have produced a
> client-only claim and a false delta.

## 3. Discriminators — TWO, one per side, both measured BEFORE cutover

`index.html` and `dist/server.js` remain **prohibited** markers (entry reference / thin stub). A proof artefact
must **differ** before it can prove anything (§11), so both rows below were measured on the two built trees
before any cutover, and the measured numbers are the assertion.

1. **Server — `atlas-server/dist/services/notification-inbox.service.js`.** The per-change identity is in this
   delta. **`metadataChangeIdentity` occurrence count: 0 in the live `c0d91827` build, 4 in the new build.**
   Measured. (`buildNotificationDedupeKey` is **not** used as the marker: it measures 2 live → 3 new, so it
   already exists in the incumbent and an "absent from live" assertion on it would read a false pass.)
   Secondary: the new build carries a file the incumbent does not —
   `atlas-server/dist/__tests__/notification-inbox-dedupe-a2.test.js` (only-new in the whole `dist` file list).
2. **Client — a new shared chunk, `assets/timetable-plain-language-*.js`.** `timetable-plain-language.ts` is
   **new in this release**, so the chunk is new. Measured: new chunk
   `timetable-plain-language-BYLpdAgL.js`, **3 367 B**, and the literal `weekly sessions not yet placed` occurs
   **0 times across every chunk in the live build** and **once in the new chunk**. The served entry also changed
   (`index-WFjDBxxH.js` live → `index-CIHphcTQ.js` new) and the workspace chunk changed
   (`ScheduleReviewWorkspace-SrCPH0Zz.js` live → `ScheduleReviewWorkspace-BmIuPk5g.js` new) — those are recorded as
   corroboration, **not** as the proof, because a filename cannot prove a *removal* or a shared-chunk change.
   Note the new build's entry chunk is `index-CIHphcTQ.js`, the same name A2's unexecuted `a56ac86d` build
   produced, which independently confirms the `a56ac86d → d31bfacb` delta is docs-only.

## 4. Zero-write and migrations

- **D5a** — no migration, no backfill, no new write-op call site. Decided by: migration count **11 → 11** by the
  pinned `git ls-tree -r <sha> -- prisma/migrations` method filtered to `migration.sql`; **zero** `prisma/` paths
  in the delta; `published_schedule_revisions` unchanged for every existing id.
- **D5b** — live before/after counts for `generation_runs`, `manual_schedule_edits`, `audit_logs`,
  `published_schedule_revisions`, `notifications`. `authorisedActorIds = { 46 }` pinned at cutover. **Any decrease
  in any table is BLOCKING, always.** An increase must trace to `authorisedActorIds` via `audit_logs.actor_id`
  **and** a `createdAt` inside the recorded literal UTC window; an unattributable increase is BLOCKING.
- **Expect zero delta from the cutover itself.** A supervised restart writes no audit row. Do not go looking for a
  write that is not there.
- **Baseline re-derived at the live release, 2026-09-28 00:05:44 +08:** `generation_runs` **9**,
  `manual_schedule_edits` **8**, `audit_logs` **451** (`max(id)` **1002**), `published_schedule_revisions` **6**,
  `notifications` **216**. **Re-derive again at cutover** — the draft is actively edited by another lane, so a
  stored count is stale by definition. Read via the durable env's `DATABASE_URL` into the process environment
  only; the value is never printed.
- **B2 (browser, below) is an authorised write** and is therefore sequenced **inside** the D5b window, with its
  delta recorded as authorised rather than as a zero-delta expectation.

## 5. Acceptance rows — every row names its harness

**A healthy deployed process is not acceptance** (§13). D1/D2/D3 prove the process; the rest are the acceptance.

| # | Row | Harness | Expectation |
|---|---|---|---|
| D1 | server serves the new build | `GET /api/v1/health/ready` + **DB-backed** `GET /api/v1/subjects?schoolId=1` | 200 `database:ok`; DB read 200 — liveness alone proves neither |
| D2 | client host serves the new client | `GET /__host/live` (**`content-type: application/json`**, a real probe, not SPA fallback) + `GET /` | 200 on both |
| D3 | **server discriminator** | `dist/services/notification-inbox.service.js` on the live dir | `metadataChangeIdentity` count **≥ 1** (measured **0** pre-cutover); the new-build-only `dist/__tests__/notification-inbox-dedupe-a2.test.js` present |
| D4 | **client discriminator** | `assets/timetable-plain-language-*.js` on the live dir | the named new chunk serves **200**; the literal `weekly sessions not yet placed` present; the pre-cutover entry chunk `-WFjDBxxH` and workspace chunk `-SrCPH0Zz` serve **404** |
| D5a | migrations + no write-op | `git ls-tree` × 2, delta path list | 11 → 11; zero `prisma/` paths |
| D5b | **zero-write around the cutover** | DB counts, literal window recorded | all deltas 0 except rows attributable to actor 46 inside the window |
| D6 | public schedule did not regress | `GET /api/v1/schools/1/schedules/published?date=` 09-20/25/26/27/28 | 200 throughout; runs **315/317/319/320/320**; `servedByFallback` **true/true/true/false/false**; `currentPublishedRunId` 320; **no 409** |
| D7 | term guard intact | `GET /api/v1/schools/1/school-years/10/schedules/published` | **400** without `termIndex`, **200** with |
| D8 | swap route mounted | `GET /api/v1/generation/1/10/runs/320/manual-edits` | **401**, not 404 |
| **B1** | **#57/#44 — one number for "classes to place"** | **browser**, `/timetable` draft 321, open the generate dialog, then read the checklist and the badge | the dialog, the toast, the checklist and the badge **agree**; no screen says "unassigned" while another says "0" |
| **B2** | **the batch-notification defect (real-data write)** | **browser** + DB | a **second** committed swap on the draft persists a `notifications` row (`notifications` count **increases by ≥ 1**, attributable to actor 46 inside the window). This is the row that was UNPERFORMED-and-BLOCKING on `9b28c572`; a **failed** result is a real finding, not a harness problem, and is reported as such |
| **B3** | **#2 — no cross-term daily-load sum** | **browser** | the daily-load cap preview on a same-day swap reads the **selected term's** load, not a sum across terms (no "11.3h (max 8h)") |
| **B4** | **#3 — Change owner lands on the right teacher** | **browser** | after Change owner, the workspace lands on **the teacher who was changed**, and the way back renders |
| **B5** | **#41/#51 — the run line and the state badge** | **browser** | on a **Draft** run and on a **Published** run, the screen names the run and the badge says which state it is in. `#51` is **A3's** row; it is reported as A3's |
| **B6** | **A3's remaining rows** | **browser** | the 9 steps in `planner-a3-non-timetable-ui-ux-handoff.md` → "Rows needing live acceptance". `#52` stays **UNPERFORMED** unless actually performed |
| B7 | public page DOM | **browser** `/public/schedules` | sections render, term shown, **no** "Unable to load public schedule" |

**B2's precondition is checked, not assumed:** before the swap, confirm **authenticated** that run **321** is a
**draft** (`published_schedule_revisions` has 0 rows for 321; `currentPublishedRunId` is 320). If the draft is not
321, **stop and report** — the row would be a published-run mutation and out of bounds. B2 is a **draft** swap
and is authorised; it is **not** a revert test, must not be reverted, and its resulting state is disclosed.

**B1–B7 are browser rows and are labelled as browser rows** (§11). Browser custody is taken with
`E:/ATLAS-worktrees/.browser-lock` before B1 and released after; A3 held the lock at 2026-09-27 23:49:59 +08, and
a lock naming A3 younger than 45 minutes means **wait and do other work**.

## 6. Operational facts — verified traps on this host

- **Identity is read from machine scope + the task action + the listeners, never from `Env:`.** This session's
  inherited process pair was `lane-a2-release-9b28c572` / `9b28c572` while machine scope, the task action and the
  live listeners all served `c0d91827` — §6's stale-override trap, live a third time. Inject
  `ATLAS_RUNTIME_SOURCE_DIR` / `ATLAS_RUNTIME_RELEASE_SHA` explicitly into every `cli.mjs` call.
- **`cli.mjs status` reports `"live": false` structurally.** Never read a deploy failure out of it. The state
  file's `state`/`ownedPids`/`releaseSha` are the trustworthy fields, and only the one inside the **active**
  `ATLAS_RUNTIME_SOURCE_DIR` is authoritative.
- **End the scheduled task first** — that alone quiesced the whole tree on prior A2 cutovers. An out-of-process
  `cli.mjs stop` does **not** quiesce the resident supervisor. Clear a stale `supervisor-state.json` before
  starting, or `start` fails with `ALREADY_RUNNING`.
- **Preferred cutover path: `ops/runtime/deploy-runner.ps1`** (dry run first, then `-Execute`). It enforces
  `Assert-LiveReleaseRecorded`, re-verifies target/incumbent identity and direction, captures the task XML and
  quiesces the tree. It reads `## Live release` from a **committed ref** — pass `-LiveStateRef <this packet's docs
  commit sha>` so another lane's docs push cannot move the gate under the deploy.
  - `Assert-LiveReleaseRecorded` (`deploy-runner.ps1:264-265`, predicate at `:214-216`) **fails closed** unless
    the **target** 8-char prefix appears in `## Live release` at the supplied ref. This packet's own commit adds
    `d31bfacb` to that section; the `-LiveStateRef` passed at execution is that commit and a descendant of it.
  - **If the manual task-XML route is used instead, this gate never runs** — a fail-closed gate silently
    disappears. The manual route is permitted only with that fact recorded and an independently executed
    equivalent check of the same predicate. **Preferred: use the runner.**
- `schtasks /change /tr` **fails on a path containing spaces**; the XML route is the fallback. Capture with
  **`cmd /c` redirection** — PowerShell's `>` re-encodes and breaks the file. **Leave `encoding="UTF-16"`
  unmodified** (measured on this host 2026-09-21: it registers cleanly as returned).
- `EADDRINUSE` on 5001 during cutover is **expected**, not a defect.
- `VITE_ENROLLPRO_URL` **must** be exported for the client build; the fail-closed guard emits no bundle without
  it. Used here: `https://dev-jegs.buru-degree.ts.net` (a non-secret origin, matching the durable env's
  `ENROLLPRO_PROXY_ORIGIN`).
- `prisma generate` runs **from `atlas-server`** with `--schema` at the **repo-root** `prisma/schema.prisma`, or
  the client lands in the wrong tree.
- **§2 corruption:** never `Get-Content | Set-Content` a repository file. Write with an explicit UTF-8 encoder
  and **no BOM**, and verify with a byte census.
- `git add` on a CRLF file emits a warning that can swallow a compound PowerShell command — stage in its own
  command and verify with `git diff --cached --name-only`. **A very long `git commit -m` can fault the CLR**; use
  a message file.
- **`git diff A..B` shows tree differences BOTH ways.** Use `git log A..B --name-only` for any §13 enumeration.
- **E: capacity (§3):** measured **32.86 GiB free** after this release's build, above the 25 GiB warn line, so no
  reclaim is owed before this cutover. Three stale release dirs (`0da104f9`, `b0736007`, `c5a9e832`) are neither
  live nor rollback and are retired **after** this cutover succeeds, not before it — retiring rollback-adjacent
  directories before proving the new rollback basis is startable would remove the safety net first.

## 7. Not authorised by this packet

No migration. No data backfill. No generation. No publication. No term-cache or Teaching Load apply. No revert
test. No companion (EnrollPro/SMART/AIMS) write. No `ATLAS_SYSTEM_TOKEN` rotation. No history rewrite. No
`fix/committed-credential-scrub-20260926` push. No removal of anything outside this lane's own retired worktrees.
No environment change beyond the release source-dir/SHA pair and the task action. **B2 is the single authorised
write, and it is a draft swap, bounded and recorded.**
