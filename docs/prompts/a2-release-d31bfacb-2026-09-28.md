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

**17 commits** (`git rev-list --count c0d91827..d31bfacb` = 17; 2 A2 source, 1 test-only, 1 A3 source, 3 merges,
10 docs), 38 unique paths, **29 non-docs** (`docs/` + `AGENTS.md` excluded). **This is not a client-only
release:** two `atlas-server/` production files are in it. No `prisma/` path, no migration, no schema, no seed,
no root `package.json`, no `package-lock.json`, no `.env`, no `vite.config.ts`, no `tsconfig`. The two
`package.json` changes are `scripts` entries only.

> **The split is `A2 20 + A3 10 − 1 shared = 29`, not `19 + 10` (pre-action review NON_BLOCKING-2).**
> `atlas-client/package.json` is touched by **both** lanes and appears in both tables below, so summing the two
> table sizes double-counts it once. The unique total **29** is the load-bearing number and is independently
> correct; the per-lane split is stated the way it is arithmetically true. A short split on a tripwire is the
> §11 "count the rows against the list it protects" defect class, and it is recorded here rather than smoothed
> over.

### 2a. Lane A2 — 19 paths in this table, 20 unique with the shared `package.json` (see §2)

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

**A2 19 + A3 10 = 29** (see the arithmetic note in §2: the split is `20 + 10 − 1 shared`). A3 reviewed its own range under its own lane process and posted
`A3 integrated for release at 1e417694` in `lane-a-to-c.md`; the merge `e6a60967` carries the source. **A3 is a
foreign lane in this release: its 9 live-acceptance steps are executed in this cycle as row B6 below** (not as
"B1–B9", which was a dangling reference to rows this packet does not define — pre-action review NON_BLOCKING-4),
**and its rows are reported as A3's, not as A2's.** A3's `1e417694` is in the range; its earlier `d9d5def1`
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
2. **Client — the `timetable-plain-language` chunk, with the literal count as the deciding assertion.**
   - ⚠ **The chunk is MODIFIED, not new (pre-action review NON_BLOCKING-3, correcting this packet's own premise).**
     `timetable-plain-language.ts` exists at `c0d91827`, and the live build already ships
     `timetable-plain-language-DqO6YBTZ.js` (2 660 B). **So the glob `timetable-plain-language-*.js` matches
     before the cutover too, and the glob alone is NOT a discriminator.** It is recorded here precisely so that
     nobody later "simplifies" this row down to a filename. **The deciding assertions are the literal and the
     404s**, both measured below.
   - **Deciding assertion, measured:** the literal `weekly sessions not yet placed` occurs **0 times across every
     chunk in the live build** and **1 time in the new** `timetable-plain-language-BYLpdAgL.js` (3 367 B).
   - **Corroborating 404s, measured:** the pre-cutover entry chunk `index-WFjDBxxH.js` and workspace chunk
     `ScheduleReviewWorkspace-SrCPH0Zz.js` are both **404** on the new host; the new entry is
     `index-CIHphcTQ.js` and the new workspace chunk is `ScheduleReviewWorkspace-BmIuPk5g.js`.
   - Note the new build's entry chunk is `index-CIHphcTQ.js`, the same name A2's unexecuted `a56ac86d` build
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

> ### ⚠ THE ATLAS EVIDENCE ORIGIN IS NAMED HERE, AND IT IS NOT `127.0.0.1` (pre-action review, BLOCKING-1)
>
> **Every browser row in this packet — B1, B2, B3, B4, B5, B6, B7 — is performed on
> `https://njgrm.buru-degree.ts.net`, and every one of them asserts `window.location.origin` before the row is
> recorded.** Not `http://127.0.0.1:5174`, not `localhost`, not "whatever the host serves".
>
> **Why this is a blocking row and not a footnote:** `127.0.0.1:5174` reaches the same supervisor-served release
> but is a **different origin**. An ATLAS login cookie is **not sent to it**, so the seeded session is invisible
> there and every authenticated row — **including B2, the row that proves this release's headline fix on real
> data** — becomes unperformable and would be reported `BLOCKED(AUTH_SESSION_REQUIRED)` for a reason that has
> nothing to do with the product. This is not hypothetical on this program: on 2026-09-27 a session opened
> `127.0.0.1:5174` for a Tailnet acceptance row **because the packet named no origin at all**, and the environment
> had to be guessed. That is why the row is written this way.
>
> **If the row cannot be performed on the Tailnet origin, report it `BLOCKED` or `UNPERFORMED` with that reason.
> Do not substitute the loopback origin and do not declare a row applicable-and-passing without performing it.**

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

**B2's precondition is checked, not assumed — and the check is named precisely** (pre-action review
NON_BLOCKING-6). Run **321 is not a "draft" by status**: `GenerationRunStatus` has **no** `DRAFT` member and run
321's status is `COMPLETED`. It is a *draft* in the operational sense that decides this row, and the check is:
**`SELECT count(*) FROM published_schedule_revisions WHERE "sourceRunId" = 321` = 0, and the maximum
`sourceRunId` in that table is 320, and the live `currentPublishedRunId` is 320** — the column is
**`sourceRunId`**, not `run_id` and not `generationRunId`. An executor grepping `status = 'DRAFT'` will find
nothing and may wrongly conclude the row is unperformable. Verified at review time: 321 → 0 rows, max 320.
If the precondition does not hold, **stop and report** — the row would be a published-run mutation and out of
bounds. B2 is a **draft** swap and is authorised; it is **not** a revert test, must not be reverted, and its
resulting state is disclosed.

**B2's attribution is precise about which path it exercises** (pre-action review NON_BLOCKING-7).
`manual-edit.service.ts:1651-1652` publishes **both** `editId` (singular) and `editIds` (plural), and
`metadataChangeIdentity` reads `editId` first — so **a single swap takes the singular branch** and the
batch/plural branch (`:201-216`) is covered by the committed unit test
(`notification-inbox-dedupe-a2.test.ts:156-316`), not by B2. B2 is still the right live row and it does
discriminate: on the **live** build the key is `schoolId:schoolYearId:type:resourceType:resourceId:actorId` with
**no change identity at all**, so a *second* swap collides and `skipDuplicates` drops it — exactly the recorded
`9b28c572` D10 finding, `notifications` 216 → 216. The new build adds the identity, so a second distinct swap
persists. **A failed B2 is therefore a real finding to report, not a harness problem.**

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

---

## 7. Pre-action review record

**Reviewer:** fresh independent read-only reviewer, one batched dispatch covering **all** pre-action gates — the
source range, the delta enumeration, both discriminators re-measured, the `Assert-LiveReleaseRecorded` predicate
run against this packet's own commit, the D-row satisfiability lint, migrations, the authority boundary, candidate
reachability, elevation and capacity. §11 allows one pre-action dispatch; it is used here, and it earned its keep.

**Verdict: `CORRECTION_REQUIRED` — 10 mandatory rows, 9 passed, 0 blocked, 0 unperformed, 1 failed (§5
satisfiability). One BLOCKING finding, corrected in this revision.**

| Row | Result |
|---|---|
| R1 live-record truth | **PASS** — machine scope, task action and listeners all `c0d91827`; served entry `index-WFjDBxxH.js` matches live; the reviewer's own process env was *also* stale at `9b28c572` and was not used |
| R2 direction | **PASS** — both `--is-ancestor` exit 0 |
| R3 delta enumeration | **PASS on substance** — 29 non-docs, exactly 2 server production files, 0 `prisma/`, both `package.json` diffs `scripts`-only, no test/production misclassification; three count errors folded in as NON_BLOCKING-1/-2 |
| R4 discriminators | **PASS** — reviewer re-measured both sides independently: `metadataChangeIdentity` 0 → 4, file hashes differ; client literal 0 → 1; dist census fully explained, nothing unexplained ships |
| R5 gate predicate | **PASS** — `PRESENT = True` at this packet's commit; the manual-route bypass is disclosed; the runner resolves its own root via `git rev-parse --git-common-dir` |
| R6 satisfiability | **FAIL → corrected** — D1/D2/D6/D7/D8 all verified against the live service, D6 an **exact** match; B2 held up under scrutiny; **BLOCKING-1: no ATLAS evidence origin named for any of B1–B7** |
| R7 migrations | **PASS** — 11 → 11 by the pinned method, full `prisma/migrations` trees byte-identical |
| R8 authority | **PASS** — §7 narrow and complete; the `fix/committed-credential-scrub-20260926` prohibition is moot because it is already an ancestor of the target |
| R9 reachability | **PASS** — every introducing commit is an ancestor of both the target and `origin/main`; `cat-file -t` resolves; nothing lives only in a clone |
| R10 elevation/capacity | **PASS** — `IsInRole(Administrator)` = True; E: 32.03 GiB, D: 39.37 GiB, above the warn line; deferring the three stale release dirs until after the cutover is **safe** because the safety net (`c0d91827` live and retained) is untouched |

**What the correction changed, and what it did not.** It changed **wording only**: it names the Tailnet origin
and a per-row `window.location.origin` assertion, and it corrects three counts, one dangling row reference, one
false premise about the client discriminator, and two pieces of row-precision about `sourceRunId` and which
notification path B2 exercises. **It moved no gate, changed no byte of source, altered no authority boundary and
added no write.** Per §11, a documentation-only correction whose defect is wording and which neither grants
authority nor contains a HIGH approval boundary is applied and verified by the planner directly — **no second
review round, and no re-review of the source range or the discriminators**, which the reviewer explicitly said
were clean and need no repetition. **A finding is never closed by deleting evidence:** every one of the ten rows,
including the failed one, is preserved above with its result.


## 8. Not authorised by this packet

No migration. No data backfill. No generation. No publication. No term-cache or Teaching Load apply. No revert
test. No companion (EnrollPro/SMART/AIMS) write. No `ATLAS_SYSTEM_TOKEN` rotation. No history rewrite. No
`fix/committed-credential-scrub-20260926` push. No removal of anything outside this lane's own retired worktrees.
No environment change beyond the release source-dir/SHA pair and the task action. **B2 is the single authorised
write, and it is a draft swap, bounded and recorded.**
