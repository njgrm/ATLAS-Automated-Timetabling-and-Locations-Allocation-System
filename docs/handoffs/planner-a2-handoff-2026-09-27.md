# Handoff - Planner A2 -> next session (2026-09-27)

Supersedes `planner-a2-handoff-2026-09-26.md` for resumption. Read this first, then
`docs/handoffs/lane-c-to-a2.md` (**newest first, and it changes often - read it at the start of every cycle and
before every integration or release**), then `docs/plans/live-state.md` (`## Live release`, `## Capacity`,
`## Lane A2`).

`atlas-session-checkpoint` cannot be loaded in this session (skill loading is denied by the tool permission
rules), so the minimum resumable state is here rather than in a second ledger.

## 0. Ten commands that re-derive every fact below

Do not trust this file over the live system; it is dated. Run these first.

| Fact | Command |
| --- | --- |
| `origin/main` | `git -C D:/ATLAS fetch origin --prune` then `rev-parse origin/main` |
| Lane worktree state | `git -C E:/ATLAS-worktrees/lane-a2-timetable-custody status --short --branch` |
| Live release | `[Environment]::GetEnvironmentVariable('ATLAS_RUNTIME_RELEASE_SHA','Machine')` - **never** from `Env:` |
| Live source dir | same call with `ATLAS_RUNTIME_SOURCE_DIR` |
| Live health | `Invoke-WebRequest https://njgrm.buru-degree.ts.net/api/v1/health` and `/api/v1/health/ready` |
| **DB-backed** read | `Invoke-RestMethod "https://njgrm.buru-degree.ts.net/api/v1/subjects?schoolId=1"` (health is liveness only) |
| E: free | `Get-PSDrive E` - measure before every build |
| Stashes | `git -C D:/ATLAS stash list` - expect **3**, on other branches, never touch |
| Public schedule (A3) | `Invoke-RestMethod "https://njgrm.buru-degree.ts.net/api/v1/schools/1/schedules/published?date=$(Get-Date -Format yyyy-MM-dd)&termIndex=active"` and read `source.termIndex` and `source.activeTermVerified` **literally** |
| Room features | `Invoke-RestMethod "https://njgrm.buru-degree.ts.net/api/v1/map/schools/1/buildings"` -> count rooms missing `features` |

**The inherited-env trap is still live.** A fresh shell's inherited `ATLAS_RUNTIME_SOURCE_DIR` reads a stale
release and **overrides machine scope**. Judge identity by machine scope, the scheduled-task action
(`schtasks /query /tn ATLAS-Runtime-Supervisor /fo LIST /v`) and the listener command lines. Also:
`supervisor-state.json`'s `productPin` is a reviewed **ancestor milestone** that only has to be reachable
(`verifyProductPin` enforces `isAncestor`) - it is not the live release. Live identity is `releaseSha` + `sourceDir`.

## 1. State, dated

- **Live `0da104f9`**, deployed 2026-09-26 19:55 +08. Acceptance: **5 PASS / 1 FAIL / 1 BLOCKED**
  (Lane C, Claude in Chrome). PASS: sign-in persists, `/my` retired, public term switch keeps a valid section,
  Runs settled states, 0 console errors. BLOCKED: the 390 px drift leg - the runner's viewport floor is 1280 px
  and `5f09a133` is not in this release. **FAIL is A3 only.**
- **Live data, as of 2026-09-26 ~23:00 and it moves** (the operator authorised Lane C to commit, publish and
  regenerate on live; live holds only test data): **run 319 published** at 14:23:48Z, one dated revision effective
  2026-09-27 (GR7 - Luna, Mon SCIENCE <-> MAPEH, reason "QA test swap - live browser QA verification"),
  **run 320** the current draft, **run 318 kept** with its broken swap for diagnosis. Re-derive before relying.
- **`E:` 49.80 GiB, no reclaim owed.** Threshold is warn < 25 GiB / fail closed < 15 GiB (`6404c213`). A release
  build costs ~1.46 GiB and may start; measure first. **My earlier line claiming capacity needed an operator
  decision was wrong under the new threshold** and is corrected.
- Lane worktree `E:\ATLAS-worktrees\lane-a2-timetable-custody`, branch `work/a2-timetable-custody`,
  `KEEP_ACTIVE`, clean, level with `origin/main` at `dc404306` when written.

## 2. Integrated and verified - do not redo

| What | Commit | Evidence |
| --- | --- | --- |
| **Timetable control inventory**, 296 rows, every control on `/timetable` + sub-views | `bfa6c2c9` on `main` | Two executor passes + planner review. Tally: `OK` 121, `UNTESTED` 149, `MISLABELLED` 9, `DUPLICATE` 3, `DEAD` 1, `UNMOUNTED` 5, `NOT FOUND` 2. `docs/reviews/timetable-control-inventory-2026-09-26.md` |
| **"Change room" crash fixed** | fix `d6513f32`, integrated `c50b15ff` | Fresh independent QA **`ACCEPT_READY` 10/10, blocked 0, unperformed 0**. Merged tree: `test:a2-timetable-custody` **27/27**; `test:client-suite` **1142 / 1130 pass / 12 fail = the identical 12 pre-existing names** |
| Queue re-rank + channel acks | `dc404306` | 6 `**A2 ack:**` lines under the Lane C entries acted on |

**The crash's real cause, because Lane C's suspect was wrong and the correction matters:**
`aa7f6f67` is **exonerated** - it moved derivation lines verbatim and never touched `useTimetableData.ts`.
The client `RoomInfo` type (`useTimetableData.ts:204-213`) had nine fields and **no `features`**; the room-map
builder (`:1608-1622`) copied those same nine, so `features` was `undefined` on every room at runtime;
`manual-edit-foundation.ts:34` declared `features: string[]` **required**, which is why `tsc` was blind; and
`ManualEditPanel.tsx:514` read `!selectedRoom?.features.length` - the `?.` guards the room, not
`room.features`. `git log -L` dates it to `5de6a2e3b` (2026-05-12), 1996 commits earlier. It looked flaky because
a subject **with** `requiredFeatures` short-circuits the `&&`; live subject 6 (MAPEH) has `requiredFeatures: []`,
so it always threw. Live `GET /api/v1/map/schools/1/buildings` returns `features` on **all 103 rooms**, so the
data was always there. It was also hiding a second defect: `useManualEditOptionGroups` computed `missing` as
empty, so **every room was silently treated as feature-compatible**. Four structurally identical `RoomInfo`
copies exist; two were fixed, `LockPanel.tsx:55` and `useTimetableMutations.ts:49` still lack the field (both have
zero `features` reads, so they are inert debt).

## 3. The queue, in order. One candidate at a time, fresh independent QA before each integration.

Items 1 and 2 were re-ranked above my own list by Lane C's committed-path QA. Each entry gives the acceptance
contract so the next session can dispatch without re-deriving.

### 1. BLOCKING x2 - Swap commits something other than its preview; Revert does nothing

- **Symptom (committed in Chrome, confirmed by Codex, run 318):** swap Mon 07:30 MAPEH <-> Wed 08:15 ESP
  (GR7 - Luna, Term 2). The preview said ESP -> Mon 07:30. The commit (`AUTO_FIX_MOVE_BLOCKING`) put ESP at
  **Wed 12:15, after the section's day ends**, and left **Mon 07:30 empty**. "Revert this edit" then logged
  "Undid an earlier change" and restored nothing. Terms 1 and 3 intact; only Term 2 diverges.
- **Lead:** `findAutoFixTarget`, `atlas-server/src/services/manual-edit.service.ts:2065`, has **no term filter**
  and **no shift bound**.
- **Treat these as TWO defects with TWO fixes.** The missing term filter is a **section 7 fail-closed breach**:
  an auto-fix may only move a session *within the selected verified ordered term*. The missing shift bound is
  what let a class land after the section's day ends. **Do not accept a fix that closes only the term filter.**
- **Contract, adopted verbatim from Lane C:** *a commit must apply exactly what its preview showed, or refuse;
  an undo must restore the prior state or say it cannot.* And the preview must show the exact auto-fix move
  before commit, **or there is no auto-fix**. Evidence for the second half: warnings dropped 159 -> 69 while the
  visible grid was unchanged, and the preview said "Safe to review".
- **The revert defect is independent** and is its own gate. A control that reports success while restoring
  nothing is worse than one that refuses, because it teaches the operator to trust a broken undo.
- **Risk: HIGH.** Server-side manual-edit authority with live writes. One executor, one fresh independent QA,
  and a **failing-first proof on a disposable database** - never on live.
- **BLOCKING question for Lane C, asked and unanswered:** after a swap whose commit auto-moved a third session,
  does the live edit history record **one** entry or **two**? If two, the revert target is ambiguous and the fix
  belongs in the history model, not the revert button. **Check `lane-a-to-c.md` for the answer before
  implementing.**
- Dispatch prompt: **section 5** below, ready to send.

### 2. BLOCKING - Publishing takes the public schedule offline for the rest of the day

- After run 319 was published, `published?date=2026-09-26&termIndex=active` returned **409
  `PUBLISHED_REVISION_INVALID`**, while the same URL with `date=2026-09-27` or with no date returned 200. The
  public page sends today's date, so parents saw "Unable to load public schedule". Before the publish, the same
  URL returned 200.
- **Contract:** a date must resolve to the publication in force **on that date** (falling back to the prior
  one), never to an error.
- **Risk: HIGH** - a public read on a shared live surface. Source-only change, but it needs its own reviewed
  packet and a zero-write proof.
- Possibly the same resolver as item 3; keep them separate candidates unless the implementation turns out to be
  one function, and say so explicitly if you merge them.

### 3. HIGH - A3, the public default term (still open)

- Live: `published?date=...&termIndex=active` -> 200 with
  `source {"termIndex":1,"termScope":"active","activeTermVerified":true}` while every signed-in surface shows
  **Term 2**. A **server** fault at `atlas-server/src/services/published-schedule.service.ts:758-773`: for a
  frozen run, `active` resolves through the **publication-time** `activeTermOrder`.
- **This breaks the section 7 fail-closed rule** - a term identity is asserted verified that is not the current
  one. The earlier "the server was already correct" negative diagnosis is **withdrawn**.
- Lane C's #13 sharpens it rather than clearing it: run 319 answers Term 2 **only because it was published in
  Term 2**. So the answer tracks *when it was published*, not *what is current*.
- **Contract:** resolve the **current** verified active term, or fail closed. Never report
  `activeTermVerified: true` for a historical term. Read `source.termIndex` from the API to decide it - never a
  rendered label.

### 4. Also open, dated 2026-09-26

- **`SchedulingPolicyPane.tsx` U+FFFD damage** (inventory rows 204-207): four **user-visible** strings at
  `:548,555,712,724,851`. The file is *validly encoded* with **committed `U+FFFD` replacement characters** (93
  total, 7 on rendered lines) - the only such file in `atlas-client/src`. Visible in
  `tt-warning-surface-realism-c07b`'s failure output, which is one of the 12 baseline failures.
- **Runs "Published" tag**: run 319 is published but Runs does not show it; the list endpoint returns no
  `summary` (`TimetableRunsPane.tsx:7-10`).
- **Daily-load cap preview**: "11.3h (max 8h)" on a *same-day* swap, probably summed across terms, and labelled
  "Safe to review" directly under a "Must fix" line.
- **"Change owner"** lands on `/teaching-load?facultyId=19&sectionId=141&subjectId=6&task=missing-load` showing a
  **different teacher**, with no way back to the class.
- **Dashboard "Exceptions"** points at nothing. Correction from Lane C: a real post-publish path exists (More >
  Swap sessions, dated) - so this is `MISLABELLED` copy, cheap, not a missing feature.
- **Teacher-leaving wizard**: no control shows who holds program authority, so "Grant authority first" names a
  control that does not exist; refusals print ids and codes instead of names.
- **Duplicate Undo controls** in the Advanced layout sharing one `aria-label` **and** one
  `data-testid="timetable-visible-undo"` (`TimetableAdvancedHeaderHelp.tsx:64`, `TimetableUndoRedoControl.tsx:41`,
  both in the same `advanced` arm). Any future `getByTestId` on it fails on multiple matches and nothing detects
  it today.
- **Every room on `/timetable/building` renders "0%"** - `CenterWorkspace.tsx:651-660` passes no
  `roomUtilization` while `BuildingView.tsx:439` prints the number unconditionally. A fabricated fact on a
  screen the operator will show.
- **149 `UNTESTED` rows** in the inventory, including *all* of `ManualEditPanel`, `BuildingView`,
  `TacticalSandboxDock` and the policy field set.
- **Shared lifecycle model still unwired**: `atlas-client/src/lib/schedule-lifecycle.ts` (13 exports) is
  imported by nothing but its own test; its commit says "Deliberately NOT wired yet". `/timetable` states
  neither draft nor published. **Expose run / revision / publishedAt / termIndex / termVerified first, then
  wire - do not half-wire**; a model written while two surfaces name different current terms relocates the defect.
- **One label per violation code**: Review issues and Publish Readiness disagree. `9b1ec14a` checks each code
  *has* a label, not that it has *exactly one*. Extend it, then clear the remaining raw `Must fix` literals
  (`TimetableGridConflictBadge.tsx:90,156`, `simple/SimpleSessionDetails.tsx:107`, `TimetableGrid.tsx:460-461`).
- **More menu regroup**: six groups interleave everyday work with expert/data tools. Regroup only; nothing
  removed without a reachable replacement.

### 5. Release packet (HIGH) - when items 1-3 have landed

- Must include `5f09a133` (Runs loading state + 390 px drift banner), which is on `main` and **not live**.
- **Enumerate the actual range** with `git diff --name-only <live>..<target>` and name every foreign lane's
  contribution. Do not describe a range from the candidates you happen to have reviewed - a previous session
  claimed "client-only" for a range carrying 14 `atlas-server/` files plus `prisma/seed.js`, and pre-action
  review caught it.
- No longer blocked on capacity. **The moment the last pre-action gate closes, execute.** A previous session
  refused to deploy three times citing remaining context when every gate was already closed; that is the
  failure mode to avoid, and it is written up in the previous handoff section 8.

## 4. Test state - compare by failing NAME, never by count

- **12 pre-existing client failures**, all real debt, several of them authority guards **currently failing**:
  `B4` policy-pane allowlist drift, `F2` server promotable allowlist, the four `F4` loose-predicate/sync-route
  family, `C04` sync success toasts, `A8` control warning marker, `R6` shared drift banner, and three
  term/export source-scan guards. No candidate has cleared them; do not read them as cleared and do not count
  them as regressions.
- **Typecheck baseline: exactly 4 errors** - 3x TS2307 `playwright`
  (`timetable-post-deploy-c04:7`, `-c05:7`, `timetable-scheduling-quality-c03:9`) and 1 TS7006
  (`timetable-scheduling-quality-c03.test.tsx:101`).
- **Green and worth trusting:** `test:a2-timetable-custody` 27/27, `test:plain-language-j2j3-c01` 18/18,
  `test:plain-tokens-c04` 30/30, `test:ux-guardrails` 31/31, `test:timetable-ux-rehaul` 35/35,
  `test:scheduler-concern` 26/26, `test:retired-faculty-portal` 5/5.
- **The client build fails closed** without `VITE_ENROLLPRO_URL=https://dev-jegs.buru-degree.ts.net`: it exits
  1 and prints `Missing required production build configuration: VITE_ENROLLPRO_URL`. It is not silent.
- **`cn()` is `twMerge`**: a `sm:basis-auto` written before `sm:flex-1` is silently deleted (both set
  `flex-basis`). Assert the **rendered** class string, not the written one.

## 5. The next dispatch, ready to send

Risk tier **HIGH** (server-side manual-edit authority with live writes). Loop: one executor, one fresh
independent QA, then planner integration. Post before dispatch:

> You are the executor for ONE bounded HIGH-risk server fix in ATLAS: a timetable swap that commits something
> other than its preview, and an undo that reports success while restoring nothing. Read `AGENTS.md` at the root
> of your worktree first; do not reload it later.
>
> **Custody.** Work only in `E:/ATLAS-worktrees/lane-a2-timetable-custody`, branch `work/a2-timetable-custody`.
> Never write in `D:/ATLAS`. Do not push. Do not touch the live runtime, ports 5001/5174, any scheduled task, or
> **any live database** - every test runs against a **disposable** PostgreSQL instance and must leave zero rows.
> Never echo a credential value.
>
> **The two defects, from a committed browser reproduction (run 318, GR7 - Luna, Term 2).** Swap Mon 07:30 MAPEH
> <-> Wed 08:15 ESP. The preview said ESP -> Mon 07:30. The commit (`AUTO_FIX_MOVE_BLOCKING`) placed ESP at
> **Wed 12:15, after the section's day ends**, and left **Mon 07:30 empty**. "Revert this edit" logged "Undid an
> earlier change" and restored nothing. Terms 1 and 3 were intact; only Term 2 diverged.
>
> **Lead:** `findAutoFixTarget`, `atlas-server/src/services/manual-edit.service.ts:2065`, has no term filter and
> no shift bound. Treat these as two defects with two fixes:
> (a) **no term filter is a section 7 fail-closed breach.** An auto-fix may only move a session *within the
> selected verified ordered term*. A missing term identity must never become Term 1 or any other term.
> (b) **no shift bound** is what allowed a class to land after the section's day ends.
> A fix that closes only (a) is not acceptable.
>
> **The contract, which is the acceptance test.** *A commit must apply exactly what its preview showed, or
> refuse. An undo must restore the prior state, or say it cannot.* And the preview must show the exact auto-fix
> move before the operator commits, or there is no auto-fix - a preview that says "Safe to review" while the
> commit relocates a third session is the defect. Observed: warnings dropped 159 -> 69 with the visible grid
> unchanged.
>
> **Method requirements.** (1) Reproduce failing-first on a disposable database and show the exact pre-fix
> behaviour, including the out-of-shift placement and the revert that changes nothing. (2) Prove the term guard
> with a real interleaving, not a unit predicate. (3) Prove the revert restores the prior state byte for byte,
> and that when it cannot, it says so and writes nothing. (4) No new write path may appear that the preview
> does not describe. (5) Record the exact SQL and serialisation for any fingerprint you compute.
> (6) A test no committed `package.json` script runs is not evidence - wire it in the same commit.
> (7) Corrections are additive: never delete an assertion to close a finding.
>
> **Report:** base and candidate SHA, exact changed paths, what changed and why, the literal failing-first and
> post-fix output, every gate with its count, zero-residue proof for the disposable database, known risks marked
> `BLOCKING` or `NON_BLOCKING`, and anything that contradicts the diagnosis above - if the lead is wrong, say so
> with evidence rather than fixing around it.

## 6. Traps that cost time, kept in one place

- **A byte-level truncate-and-append must open a file `Open`/`Write`, never `Create`.** `Create` truncates to
  zero, so a following `SetLength` pads with NUL bytes instead of keeping the prefix - a 2,312-line
  `live-state.md` became 61 lines plus ~175 KB of zeros, and the tool output looked plausible. Caught by
  re-measuring, restored with `git checkout --`. **Prove the result with a `git diff -U0` hunk count, not a byte
  count** - the byte count reported the truncation as success. This is the same class as the `Get-Content |
  Set-Content` ban in `AGENTS.md` section 2, from the other direction. **Still not added to `AGENTS.md`** - that
  edit wants its own review, not the end of a long session.
- **`main` moves constantly.** A push of `e8e2141f` was rejected non-fast-forward, and my crash-fix push was
  rejected too because `main` advanced mid-gates. `git fetch` and re-check **immediately before every push**, and
  merge rather than force. After a merge, re-verify that your reviewed blobs are unchanged before pushing.
- **A shared register with four lanes.** Edit only your own section plus the `## Live release` block when you
  deploy. If a merge conflicts inside another lane's section, take theirs. The Lane A2 section is **72 lines**
  against the ~40-line guidance (it was 320) - narrative goes in this handoff, not there.
- **Session lanes overlap in the client.** `origin/work/public-published-view-term-c01` touches the public
  schedule; `origin/integration/*` and `origin/work/lane-c-*` belong to Lane C. Check remote work branches before
  starting, and re-check before integrating.
- **`docs/qa` is gitignored.** Lane C's channel had to move to `docs/handoffs/lane-c-to-a2.md` for that reason.

## 7. Channels

- **Lane C -> A2:** `docs/handoffs/lane-c-to-a2.md`, newest first. Add `**A2 ack:** <commit or decision>` under
  each entry acted on; do not delete entries.
- **A2 -> Lane C:** `docs/handoffs/lane-a-to-c.md`, which I authored with the open questions and the test
  requests Lane C owes me. Keep it current - it is how the next session tells Lane C what to run.

## 8. Operator decisions - not mine to take

Undo/Redo in the Simple layout; lunch-window and 180-minute blocks as warning or blocking; constraint severity
D1-D3; and **whether committed-path QA runs on live or on a local snapshot** - Lane C recommends a local copy,
because live commits touch real teachers' and the public's schedule. The operator has authorised Lane C to
commit, publish and regenerate on live, holding only test data; that is why live state changes under us.
