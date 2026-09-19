# Planner Handoff — 2026-09-19

**To:** incoming primary planner
**From:** outgoing primary planner (OpenCode session)
**Repo:** `origin/main` = **`9803dc70`**
**Purpose:** full continuity transfer. Read this, then `docs/plans/live-state.md`.

---

## 0. Objective

Ship a presentable live demo of ATLAS on the **active school year**
(`schoolYearId` = upstream **10**, S.Y. 2031-2032) at
`https://njgrm.buru-degree.ts.net`, with:

1. generation running end to end,
2. **exports** (class program / teacher program / room program / summary),
3. corrected **Teaching Load and Timetable UX**, and
4. working **EnrollPro↔ATLAS SSO**.

**Operator's acceptance standard for UX, stated verbatim:** ATLAS must *"feel like
it's really the same system"* as SMART. *"Right now it looks disconnected, we look
like a distinct different system from them."* And, most recently:

> **"What the users are reacting to is the entire timetable page itself because it
> looks like a pilot cockpit, not just the high amount of numbers."**

That reframing is the most important input in the latest message. The UX problem is
**the whole page**, not the warning count. Do not treat "fewer numbers" as the fix.

---

## 1. Immediate next actions (in order)

### 1a. `gradeScope` apply — **APPROVED, NOT YET EXECUTED**

The operator approved this HIGH action on 2026-09-19. It was deliberately not
executed; the outgoing planner was asked to hand off first.

**What:** set `Building.gradeScope` on the four academic wings (school 1):

```
building 1 -> [7]      building 2 -> [8]      building 3 -> [9]      building 4 -> [10]
```

**Why:** all four are currently `[]`. `buildingMatchScore`
(`atlas-server/src/services/home-room-auto-assign.service.ts:79-82`) returns `1`
(any-grade) for every building, so the tiebreak falls to `buildingName`, and
`"Grade 10 Academic Wing"` sorts before `"Grade 7 Academic Wing"` (`'1' < '7'`).
Measured live: auto-assign proposes **all 20 sections into the Grade 10 Academic
Wing**. The source fix is integrated; the data apply is not.

**Rollback:** `update buildings set "gradeScope" = '{}' where id in (1,2,3,4);`

**Required:** preview first, record before/after signature, then apply, then verify
with `POST /api/v1/sections/home-rooms/10/auto-assign` in `mode: 'preview'`,
`overwriteExisting: true` — it must reproduce the persisted per-grade assignment
(5 sections per wing, zero cross-grade leakage).

### 1b. Regenerate + republish — **HIGH, needs its own approval**

**Only after 1a.** Fixes the stale published artifact: the live public schedule shows
Grade 7 section **Aguinaldo** in `G10 Room 101 @ Grade 10 Academic Wing` while its
persisted home room is `G7 Room 101 @ Grade 7 Academic Wing`.

All 20 persisted home rooms are verified per-grade correct, and generation consumes
home rooms (`homeRoomAssignedCount 2130 / 2130`), so regeneration will produce
correct rooms. Run #315 is the published run (revision 42); Run #316 is the latest,
unpublished.

### 1c. Term-scoping fix for the public published view — **the highest-value code defect**

`/public/schedules` renders **every cell three times**. Root cause confirmed against
the API: the published payload holds **2,760 entries = 920 × 3 terms**, and 720 of
1,320 (section, day, time, subject) groups contain 3 entries with distinct
`termIndex` 1/2/3 but identical room and faculty. The view flattens all three terms
into one weekly grid.

This violates the directive's ordered-term invariant: *"it must not … merge different
terms into one weekly cell."* No packet exists yet — author one.

### 1d. Warning counting — operator decision

> **"report unique issues per term only, the warnings should change if a different
> problem arises in a different term"**

Interpretation to implement (confirm if ambiguous): **group by term; within a term,
collapse duplicate rows to unique issues; preserve term identity so a different
problem in a different term appears separately.** The current behaviour is wrong in
both directions — the API returns one row *per term* for the identical issue
(`entry-523::t1`, `::t2`, `::t3`), producing **335 rows for 116 unique issues**,
while the UI silently dedupes to **113**. Two screens, same schedule, different
numbers.

### 1e. Dispatch `WARNING-READABILITY-C01` — no approval needed

Packet ready at `docs/prompts/warning-readability-c01-2026-09-19.md`. Presentation
and copy only; touches neither generation nor publication.

### 1f. Continue UX-REHAUL-C01

Cycle is ON (Tier 3, full program). Delta order: `UX-R00` (refresh SMART baseline at
the new pin `79b182c`) → `UX-R01`/`UX-R01a` (PageHeader + shared visual language) →
`UX-R02` (Simple strip-down) → `UX-R03` (nested layout route; **unblocked** by
`UX-P01`) → `UX-R04` → `UX-R05`. `UX-P01` and `UX-R06` are already integrated.

---

## 2. Repo and runtime state (verified 2026-09-19)

### Git
- `origin/main` = **`9803dc70`**
- **`D:\ATLAS` is a stale/dirty checkout (~466 behind) and is NEVER an integration
  boundary.** Work from `E:/ATLAS-worktrees/*`.
- Integration worktree: `E:\ATLAS-worktrees\release-client-quality-01`
- The harness injects a **stale `D:/ATLAS/AGENTS.md`**. Always read the directive via
  `git show origin/main:AGENTS.md`.

### Live runtime
| Item | Value |
| --- | --- |
| Product pin | **`74c1f12a`** (`1400bea2` and later are docs-only above it) |
| Release dir | `D:\ATLAS-runtime-supervised-74c1f12a5c06-20260918` |
| Supervisor | PID 67028, `NT AUTHORITY\SYSTEM`, task-launched |
| Task | `ATLAS-Runtime-Supervisor` — ONSTART, SYSTEM, Highest, IgnoreNew, `PT0S` |
| 5001 (server) | PID 63688 — `atlas-server/dist/server.js` |
| 5174 (host) | PID 12992 — `ops/runtime/host.mjs` |
| Health | local health/ready 200, Tailnet health 200, DB-backed read 200 |
| Entry chunk | `assets/index-CtOKnF1z.js` |

Machine env (all three required; the task-launched process resolves the release from
these, **not** from its own directory):
`ATLAS_RUNTIME_ENV_FILE` = `D:\ATLAS-runtime-config\atlas-server.env` (17 keys),
`ATLAS_RUNTIME_SOURCE_DIR`, `ATLAS_RUNTIME_RELEASE_SHA`.

**Rollback:** set the two vars back to
`D:\ATLAS-runtime-supervised-f0d65a531e34-20260918` /
`f0d65a531e34ded9d8148a1c3f7bf5ddbf2eec4a`, then stop and start the task.

**Do not retire** `D:\ATLAS-runtime-supervised-0eb3b67fe94c-20260918` — it is the live
`atlas-server/node_modules` chain root.

`git config --system --add safe.directory "*"` is **required**; without it the
SYSTEM-owned supervisor fails its pin check with `PIN_UNRESOLVED` (dubious ownership).

### Database
`atlas_recovery_clean_rebuild_20260905` @ localhost:5432.
Active year = upstream `enrollProSchoolYearId` **10** (mirror row 551). **Data tables
key on the upstream id (10), not 551** — using 551 yields a false
`INACTIVE_HISTORICAL_YEAR`. Archived year = upstream 9.

`grade_shift_windows` seeded for year 10 (ids 1-20).
Rollback: `delete from grade_shift_windows where id between 1 and 20;`

### Worktrees
| Path | Purpose | Disposition |
| --- | --- | --- |
| `E:\ATLAS-worktrees\release-client-quality-01` | integration | KEEP_ACTIVE |
| `E:\ATLAS-worktrees\home-room-auto-assign-c01` | `9a263016` integrated | RETIRE_AFTER_INTEGRATION |
| `E:\ATLAS-worktrees\ux-r06-copy` | `eff7d507` integrated | RETIRE_AFTER_INTEGRATION |
| `E:\ATLAS-worktrees\ux-p01-data-layer` | `d2a94491` integrated | RETIRE_AFTER_INTEGRATION |
| `E:\ATLAS-worktrees\sso-client-config-c01` | `0a06f306` integrated | RETIRE_AFTER_INTEGRATION |

Disk: `D:` ~23 GiB free (below the 25 GiB warn line), `E:` ~60 GiB. New worktrees go
to **`E:/ATLAS-worktrees/`**. Executors cannot create worktrees — the planner must.

---

## 3. Operator decisions — all resolved

| # | Decision |
| --- | --- |
| D-1 | **ADOPT** the SMART convergence contract, as amended by the delta, re-verified against the current pin. Carve-outs: it is UX guidance, not product authority (publication gates, ordered-term identity, actor-school scope, no-scroll shell outrank it); the delta overrides it where they conflict (**keep Radix — do NOT migrate to Base UI**; copy SMART's visual *language*, not its component *usage* — its own `PageHeader`/`DataTable`/`breadcrumb` have zero usage sites); its §15 stream order is superseded. |
| D-2 | **CYCLE ON**, full program (Tier 3 through UX-R05), stop at every HIGH boundary. **"Only what is necessary"** — do not reintroduce the ceremony that previously consumed the budget. |
| D-3 | **AUTHORIZED** — `UX-P01` data layer (integrated). |
| D-4 | **DONE** — `74c1f12a` deployed and verified. |
| D-5 | Covered by the standing browser-QA authorization; disclose the login delta. |
| D-6 | **ANSWERED, no defect.** Run #315 is the published run (revision 42, hard 0, blocking 0) and already carries `softViolationsAcknowledged: true` with `publishedSoftViolationCount: 335`. Run #316 is the latest, unpublished. The "remove warnings once published" mechanism already works. |
| **NEW** | **`gradeScope` HIGH action APPROVED** (not yet executed — see §1a). |
| **NEW** | **Warnings: report unique issues per term only** (see §1d). |
| **NEW** | **The UX problem is the whole timetable page** ("pilot cockpit"), not the number of warnings. |

Other standing rulings: publication/generation gate = **zero HARD violations**;
trigger gate = `preflight.ok`; `GENERATION_PREFLIGHT_STALE` is intended fail-closed;
labs are out of scope (subjects use `preferredRoomType = CLASSROOM`); cap stays
`maxTeachingMinutesPerDay = 400` for the demo; 225 min/wk is a MATATAG *subject*
allotment, not a teacher cap; `DEVL_READING` is a legitimate SPA/SPS specialization —
do not archive.

---

## 4. Integrated this session

| Lane | Candidate | QA |
| --- | --- | --- |
| `HOME-ROOM-AUTO-ASSIGN-C01` | `9a263016` | `ACCEPT_READY` 10/10/0/0 |
| `UX-R06` | `eff7d507` | round 1 `CORRECTION_REQUIRED` 14/12/2/0; round 2 `ACCEPT_READY` 8/8/0/0 |
| `UX-P01` | `d2a94491` | `ACCEPT_READY` 15/15/0/0 |
| `SSO-CLIENT-CONFIG-C01` | `0a06f306` | 12/11/1/0 `PLANNER_DECISION_REQUIRED` — browser row deferred to post-deploy acceptance |

Combined at merge `101d65c5` / `17c3d1dd`, both lanes byte-identical to their
reviewed tips.

**UX-P01 outcome:** load waterfall collapsed (max in-flight 1 → 3), scoped TanStack
Query cache keyed by `(schoolId, schoolYearId, runId, termIndex)`, hover prefetch,
stale-while-revalidate. `useTimetableData.ts` **shrank** 1836 → 1706. Full client
inventory 696 tests, 0 fail.

**SSO outcome:** `VITE_ENROLLPRO_URL` baked at build time; bundle `dev-jegs`
occurrences **0 → 2**; fail-closed build guard added; server gate now returns
`COMPANION_SSO_CODE_INVALID` (not `CLIENT_INVALID`) for a paired bearer, so the secret
gate passes. **NOT deployed.**

---

## 5. Confirmed defects and open work

### Code defects (no packet yet unless noted)
1. **Term merging in the public published view** — 3× duplication (§1c). Highest value.
2. **Warning count semantics** — 335 rows / 116 unique / 113 shown (§1d).
3. **`ZONE_IMBALANCE_WARNING` is a false category** — fires because **0 of 103 rooms**
   have a zone configured; reports *"zone UNSPECIFIED has 100% of scheduled entries
   (920 of 920)"*; carries 920 entry ids. A configuration gap presented as a schedule
   warning.
4. **`FACULTY_FLOOR_TRANSITION` message broken** — `(14:30→14:30) with only 0 min gap`
   reads as a zero-length transition.
5. **Duplicate warning classes** — `FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` and
   `FACULTY_INSUFFICIENT_TRANSITION_BUFFER` fire on the same faculty/day with
   overlapping entry sets.
6. **`test:ux-guardrails` is vacuous** — names `ux-guardrails.test.ts` and
   `public-schedule-grade.test.ts`, both deleted from main by `4794bd9e`; `tsx --test`
   silently ignores missing paths, so it exits 0 with 21 tests from one file. Must not
   be cited as evidence.
7. **Sibling section routes lack actor-school enforcement** — `GET`/`PUT
   /home-rooms/:schoolYearId`, `POST /sync` still accept a caller-supplied `schoolId`.
8. **Published-revision path performs NO hard-constraint validation** — a revision can
   introduce a HARD violation.
9. **`manual-edit.service.ts:461`** leaks `"Published repairs require the Prompt 6
   revision workflow"` to operators.
10. **Accessibility** — the section dropdown's grade grouping is visual only (no
    `role=group`).

### Staleness (not code defects)
- Published artifact predates the corrected home rooms → fixed by regenerate + republish.
- Nav still reads "Timetable" (not "Class Schedule") — expected deploy lag; UX-R06 is
  integrated in source only.

### Warning trustworthiness — audited
**The faculty-comfort math is CORRECT** (three independently verified exactly):
`FACULTY_CONSECUTIVE_LIMIT_EXCEEDED` (Faculty 16 Monday = 4 contiguous periods =
180 min > 135 limit; `blockEntryIds` match exactly), `FACULTY_EXCESSIVE_IDLE_GAP`
(Faculty 39 Friday `06:00-06:45` → `08:15-09:00` = exactly 90 min; breaks properly
excluded), `FACULTY_EXCESSIVE_BUILDING_TRANSITIONS` (6 entries → 5 transitions).
The problems are presentation, duplication, term inflation, and one false category.

---

## 6. Packets ready

| Packet | State |
| --- | --- |
| `docs/prompts/home-room-auto-assign-c01-2026-09-18.md` | source integrated; §2 config apply APPROVED pending execution |
| `docs/prompts/warning-readability-c01-2026-09-19.md` | ready; no approval needed; covers **all ~46 codes** in `VIOLATION_CODES` |
| `docs/prompts/flag-compensation-slot-c01-2026-09-18.md` | all decisions resolved; large lane |
| `docs/prompts/export-presentation-c12-2026-09-18.md` | ready; sequence after flag |
| `docs/prompts/published-revision-authority-c12-2026-09-18.md` | second wave |
| `docs/prompts/sso-client-config-c01-2026-09-18.md` | source integrated; deploy is HIGH |

### Flag/compensation model (resolved, three strategies)
- **S1** Monday-only compensation row (`grade9STE_Sched.jpg`, Science at `9:15-10:00`)
- **S2** cross-day relocation into another day's free slot (`GRADE10_REGULAR.jpg`)
- **S3** partial occupancy, no relocation (`aral-prog_G7…`, the `6:00-6:45` row keeps a
  real subject for every section)
Blocking-vs-overlay must be a **per-shift, per-program configuration** on the existing
`grade_shift_windows` authority. `ec2430ab` is *right* for S3 and *wrong* for S1/S2.
G7/G8 specials spanning both shifts would attend **two** ceremonies with **two**
displacements — the model must be able to express that; it must not assume one.
Also: the G9/G10 STE/SPA/SPS shift window must move to **`09:15-18:30`** so the
compensation row does not precede its own section's window.

### Export architecture (resolved)
DepEd prescribes curriculum and time allotments, **not layout** — division memoranda
call the DO 9 s. 2026 samples *"illustrative references … not rigid or mandatory
templates"*. So: a default renderer matching the artifacts **plus** a
template-override seam, with the grade palette **switchable**. Grade palette verified
in `aral-prog_G7…`: `70AD47` + `E2EFD9` (Office Green Accent 6). Suggested continuation:
G8 `FFC000`/`FFF2CC`, G9 `C00000`/`F2DCDC`, G10 `4472C4`/`D9E2F3`.
**Two distinct shapes**: per-section (division template `DNO-CLASS-PROGRAM-TEMPLATE-2026-2027.docx`)
and **grade-level master with sections as columns** (`aral-prog_G7…`, with `ADVISER`
and `BLDG/ROOM NO.` rows). School: **Hinigaran National High School (HNHS)**.

---

## 7. Boundaries — locked HIGH actions

Generation, publication, **regenerate + republish**, live revision apply, the
`gradeScope` apply (approved, pending), the `grade_shift_windows` apply, term-cache
apply, and deployment all require explicit approval. Companion repositories (SMART,
EnrollPro, AIMS) are **READ_ONLY**.

**Every production client build MUST set `VITE_ENROLLPRO_URL`** or the fail-closed
guard exits 1 and emits no bundle.

---

## 8. Working agreements (the lean directive)

`AGENTS.md` is ~433 lines and is a **living document** — update it in the same turn
when a session finds a failure mode a rule would have prevented, or a rule that is
wrong/stale/ceremony. It now carries the learning rule, the fork-sync rule, the
build-env requirement, and the state-file-authority rule.

Tracking: `docs/plans/live-state.md` is the single current-state doc. Git, the
changelog, and that file. **No cycle ceremony, no receipts, no gate-tally schemas.**

Companion repos: **sync before you inspect** — a mirror is evidence only at a recorded
commit. The SMART clone tracks upstream; the EnrollPro and AIMS clones track our forks.
Fast-forward push only; never force-push.

---

## 9. Traps

- `D:\ATLAS` stale/dirty — never a boundary.
- Harness injects a stale `AGENTS.md` — read from Git bytes.
- **Never chain `node_modules` junctions.** Single hop only, with verified lockfile
  identity, target recorded.
- Prisma: run `prisma generate` from `atlas-server` with `--schema ../prisma/schema.prisma`
  or the client lands in the wrong tree. A fresh worktree needs it before server tests
  will run (`@prisma/client did not initialize yet`).
- `npm ci` at the repo root installs **only root deps** — `atlas-server` and
  `atlas-client` are separate packages (the root `package.json` has **no** `workspaces`
  field). Install each.
- Only the `supervisor-state.json` inside the **active** `ATLAS_RUNTIME_SOURCE_DIR` is
  authoritative; the others are stale and will report a different release or `stopped`.
- PowerShell: `page.evaluate` rejects `??` and optional chaining; avoid `$` in
  double-quoted strings; `Remove-Item -Recurse` on a junction can delete the target —
  use `cmd /c rmdir`.
- The live deploy lags main — a missing UI element may be un-deployed, not broken.
- `/timetable` renders in 2 phases; wait for the grid before censusing.

---

## 10. Browser QA setup (working)

- Playwright MCP tools are available; browser installed
  (`npx -y @playwright/mcp@latest install-browser chrome-for-testing`).
- Persistent profile: `C:\Users\njgro\.config\opencode\playwright-profile` — **one
  controller at a time**.
- Login works. Credentials live at
  `%USERPROFILE%/.config/opencode/atlas-qa-credentials.local.md` (disposable test
  values; production identity will differ).
  **Allowed:** resolving them and entering them into a browser login form, even though
  the value appears in the interactive transcript.
  **Forbidden, always:** committing, staging, writing into any repository file, or
  letting them reach a screenshot, trace, fixture, shell history, log, handoff
  document, or the register.
- Every browser claim needs a `window.location.origin === "https://njgrm.buru-degree.ts.net"`
  assertion plus route, snapshot, console errors, and network statuses.
- A login creates one `LOCAL_LOGIN_SUCCESS` audit row — disclose the delta.
- **Targeted, not blanket:** run it as acceptance for anything deployed or
  user-facing; batch at deploy boundaries; skip for internal refactors.

---

## 11. Exact next action

Execute §1a (**`gradeScope` apply** — approved) with preview, before/after signature,
rollback, and a preview-mode verification that reproduces the per-grade assignment.
Then request approval for §1b (regenerate + republish). Author §1c (public-view
term scoping) in parallel — it needs no approval.
