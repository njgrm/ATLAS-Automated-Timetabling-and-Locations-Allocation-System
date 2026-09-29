# A2 c17 — packet: "were teacher preferences kept?" (executor packet)

Base: `df5c249c` (origin/main tip at issue). Branch: `work/a2-c17-preferences-kept`.
Worktree: `E:/ATLAS-worktrees/lane-a2-c17-prefs`. **This is your only writable tree.**
Issued by the A2 planner, 2026-09-29 18:55. Parent packet: `docs/prompts/a2-c17-preferences-kept-2026-09-29.md`.

## Intent first (design judgement gate — this is the deliverable, the strings are not)

The user is an older, mouse-first scheduler. They have just run the generator. They asked three teachers what they
can and cannot teach, approved it, and then hit **Build**. Their real question, which no screen answers today, is:
**"did it keep what I asked for?"** Generation honours it — REVIEWED `UNAVAILABLE` is a hard exclusion
(`schedule-constructor.ts:1831-1856, 2072-2080`), `PREFERRED` is a soft ranking (`:1858-1863, 2229-2231`) — but the
scheduler cannot see the answer anywhere.

It should feel like the run summary finally answering one more question, in the scheduler's own words, in one
calm sentence that is there when it matters and **gone when nobody asked for anything**. It must not feel like a
new analytics panel, a score, a percentage, or a reward for a good run. Older user, one sentence, one obvious
next step (read the list). Subtraction first (§11 design gate): **if you add this line to a region, remove at least
as much visible weight from that region, or explain in the handoff why the region had nothing to remove.**

## Risk tier: MEDIUM. Do not touch the generation service.

This is the planner's design decision, made to keep the tier MEDIUM and the answer *true after manual edits*:

**The report is computed on read, not persisted at generation time.** The parent packet requires the line on the
draft timetable, on the published timetable, and after a generation run. A value snapshotted into the run summary
would be wrong the moment a scheduler drags a class, and would need a migration-free rewrite when the run is
re-published. So: **one pure server function**, one read route, one client line. `generation.service.ts` is
out of scope — do not edit it, do not add a field to `RunSummary`, do not change `schedule-constructor.ts`.
If you conclude that read-computation is impossible, stop and report that in the handoff; do not widen scope.

## 1. Server: one pure function + one read route

New file, e.g. `atlas-server/src/services/preference-adherence.service.ts`:

```ts
export type PreferenceAdherenceGroup = {
  kind: 'UNAVAILABLE' | 'PREFERRED';
  label: string;            // human phrase, e.g. "Unavailable Friday afternoon" | "Prefers mornings"
  slotCount: number;        // slots collapsed into this phrase
  kept: boolean;            // UNAVAILABLE: true when no class of that teacher overlaps any of its slots
  metCount: number;         // PREFERRED: how many of the group's slots received at least one of their classes
};
export type PreferenceAdherenceReport = {
  runId: number; schoolYearId: number; termIndex: number;
  totals: { unavailableSlots: number; unavailableKept: number; preferredSlots: number; preferredMet: number };
  teachers: Array<{ facultyId: number; name: string; groups: PreferenceAdherenceGroup[] }>;
  notReviewedTeacherCount: number;
  notReviewedTeacherNames: string[];
  hasAny: boolean;          // false => the client renders NOTHING (see §3)
};
export function computePreferenceAdherence(input: /* reviewed records + placed entries */): PreferenceAdherenceReport;
```

Rules, all unit-tested:
- **Reviewed authority only.** Read `facultyAvailability` rows for the run's `schoolId` + `schoolYearId` +
  `termIndex` with `status = 'REVIEWED'` (the same filter generation uses:
  `faculty-availability.service.ts:346`, `generation-input-snapshot.service.ts:313`). DRAFT / SUBMITTED /
  REJECTED rows must not influence any count.
- **UNAVAILABLE slot kept** = no placed entry for that teacher overlaps that slot (same overlap rule the
  constructor uses to exclude; match its day/period/time comparison, do not invent a looser one).
- **PREFERRED slot met** = at least one placed entry of that teacher falls inside that slot.
- **Scope** to the run's own year + term. Never fall back to another term, another year, or a default school.
- **Unreviewed teachers** are counted separately: availability rows for the same year/term whose status is
  DRAFT or SUBMITTED (or REJECTED), distinct faculty. `REJECTED` counts as *not in use* too — say the same thing.
- `hasAny` is false when there are no REVIEWED slots **and** `notReviewedTeacherCount` is 0.

Route: read-only `GET`, on the existing timetable/runs router surface (do not add a new top-level router file
unless the codebase forces it). Actor-school scoped like its neighbours — no `parseSchoolId` school-1 default
(§ observation backlog; `parseSchoolId` defaulting is a known open defect, do not copy it). Typed `400` on a
malformed run id, typed `404` when the run is not visible to the actor, `200` with the report otherwise.
**Zero writes** — no create/update/delete on any table in this path.

## 2. Group label humaniser

A small pure helper (same file or its own) turns slots into phrases:
- contiguous/overlapping slots on the same day collapse into one group;
- a day-wide block reads as a day name (`"Friday afternoon"`), a partial window as a period range using the
  app's existing day/period vocabulary — search `atlas-client/src/lib/timetable-plain-language.ts` and the
  timetable day constants and **reuse** them; do not invent a second set of day names;
- no raw `"MONDAY"` enum, no `"09:00-10:00"` on its own, no `"…"` ellipsis (§ walk standard), no truncation.

## 3. Client: one line, one list, one button, silence otherwise

- **Anchor:** the run summary strip in the **Simple timetable workspace body** — the place that already renders
  the run's state/unplaced sentence (`runStateSentence` / `runUnplacedSentence` /
  `runAnchorLabel` in `atlas-client/src/lib/timetable-plain-language.ts` are rendered there). **Do not put it in
  the header stat row** (`ScheduleReviewWorkspaceSummaryStats.tsx`): §8 caps a header at two calm rows and this is
  already a full one. If the exact anchor does not exist on the surface you land on, take the nearest existing
  one-line summary strip on the same page and **name the choice and the reason in the handoff**.
- **Copy, exact:**
  - `Teacher preferences: 2 of 2 unavailable times kept · 5 of 7 preferred times met`
  - Omit a segment whose denominator is 0 (`0 of 0 preferred times met` is noise). If both denominators are 0,
    `hasAny` is false and nothing renders.
  - Per-teacher group: `Unavailable Friday afternoon — kept` / `Prefers mornings — 3 of 5`.
  - Unreviewed: `2 teachers' preferences are not reviewed yet, so they were not used` — singular when 1
    (`1 teacher's preferences are not reviewed yet…` is wrong; write it as a person: `1 teacher's preferences are
    not reviewed yet, so they were not used` is ungrammatical — choose a grammatical form and unit-test it).
- **The line is a control, so it must look like one** (operator rule, 2026-09-29): visible border/fill, a verb or
  chevron in the label, `cursor-pointer`, hover **and** focus-visible states. A sentence-shaped number that is
  clickable but looks like read-only text is a defect. Read-only figures around it must not gain pressable styling.
- The list opens on click/Enter/Space and closes on Escape; it is a list of teacher groups, scrollable, with the
  per-teacher name. Keyboard reachable. Use an existing `@/ui` primitive (Popover/Dialog/Sheet) — **no raw
  `<details>`, no raw `<button>`, no native `<select>`, no `title=` attribute.**
- The unreviewed notice carries a button/label that **looks clickable** and navigates to the existing Teacher
  Preferences page. Find the real route (`/teachers` is not assumed correct — find the one the preferences UI
  lives on and use it).
- Shown on the draft view **and** the published view of the same run.
- §8 file cap: no touched React file over 1000 physical lines; extract before continuing.
- No page-local restyle of a shared primitive. If a shared primitive is wrong, fix it there and say so.

## 4. Acceptance rows (every one gets a real result; nothing is "n/a")

| # | Row | How it is decided |
|---|---|---|
| R1 | Pure function, all kept | unit test: 2 UNAVAILABLE slots, no overlaps → `2 of 2 kept`, all groups `kept: true` |
| R2 | **Pure function, one violated** | unit test fixture: 2 UNAVAILABLE slots, one teacher's class placed inside one of them → `1 of 2 kept`, exactly one group `kept: false` (this is the parent packet's named fixture) |
| R3 | Preferred partial | unit test: 7 PREFERRED slots, classes in 5 → `5 of 7 preferred times met` |
| R4 | Reviewed-only | unit test: same teacher has a DRAFT row with an overlapping slot and a REVIEWED row without → the DRAFT slot does not change any count |
| R5 | Unreviewed disclosure | unit test: 2 faculty with DRAFT/SUBMITTED rows only → `notReviewedTeacherCount: 2`, `hasAny: true`, totals all 0 |
| R6 | Silence | unit test: no availability rows at all → `hasAny: false`; client test asserts the component renders **nothing** (not an empty box, not a zero line) |
| R7 | Scope | unit test: rows from another term / another year are ignored |
| R8 | Route | mounted/real-route test: 200 with a computed report for a visible run; typed 400 on a malformed run id; typed 404 for a run outside the actor's school; **instrumented zero writes** (assert no create/update/delete call on the client) |
| R9 | Client render | component test: exact line text for a mixed report, the group phrases, the list opens/closes, the unreviewed sentence and its Teacher Preferences link resolve to the real route |
| R10 | Staging render | **staging, real data, 1366x768**: enter and REVIEW real preferences for 2–3 teachers through the page, then screenshot the run summary line and the open list on the draft view and the published view. Run `scripts/qa/ux-audit.js` in the page JS context with the list open and closed; `major` must be 0 and nothing you touched under 14px. Attach the JSON and the screenshot paths. |
| R11 | `npm run test:encoding` | green |
| R12 | Existing gates | the timetable/preference suites and `test:ux-guardrails` (if it exists) still pass on the merged-shaped tree; `atlas-server` and `atlas-client` type-check |

**R10 constraints — read carefully.** Use `scripts/dev/start-preview.ps1 -ClientDir <dir> -Port <52xx>` and open
`http://127.0.0.1:<port>/__dev/staging-login`. Never point the preview at `:5001`/`live`. Never type credentials
anywhere. Never read, cat, echo or open `D:\ATLAS-runtime-config\atlas-staging-qa.env`. If the login route 404s,
your worktree is stale: `git merge origin/main` and restart. **You may not run generation** — that is HIGH
(Lane A4 only). If staging has no completed run to show the line against, report R10 as
`UNPERFORMED(STAGING_HAS_NO_COMPLETED_RUN)` with what you saw, do **not** generate, and continue. Entering and
reviewing preferences through the page is an ordinary UI mutation and is allowed; a generation is not.

## 5. Process

- Commit and **push** your work branch at least every 30 minutes and before any long step. A `wip(...)`
  checkpoint is expected, not optional.
- Never `git checkout --`, `git reset --hard`, `git clean` or revert a file you have uncommitted changes to.
  `git stash push -u -m <why>` or commit first.
- **Never write to `D:\ATLAS`.** Commit, push, edit and run only in your worktree. Comparison copies go to
  `$env:TEMP`.
- Node modules: your worktree has none. `npm ci`/`npm install` inside `atlas-server` and `atlas-client` as needed
  (E: has 38 GiB free). Never create a `node_modules` junction to another lane's tree.
- Never start a server or watcher in a foreground command that waits. Long steps:
  `scripts/dev/start-detached.ps1 -Dir -Command -Log [-Env] [-Port]`, then poll the log in short calls. Screenshots
  only via the Playwright MCP, which gives you your own headless browser. Never run `chrome.exe` directly.
- No PowerShell `Get-Content | Set-Content` round-trips on repository files (they destroy em dashes — it has
  happened). Use the Edit/Write tools and `git diff`.
- Record the literal command and result for every row in R1–R12. A row you could not run is
  `BLOCKED(reason)` or `UNPERFORMED(reason)`, never silently dropped.

## 6. Handoff (one page, in your final message)

base SHA · candidate SHA · exact changed paths · what changed and why, in one sentence per file group · the
anchor you chose for the line and why (if not the run summary strip) · the literal commands and results for
R1–R12 · known risks each marked `BLOCKING` or `NON_BLOCKING` · worktree disposition · the layout note you wrote
before coding (what stays, what goes, what moved behind a disclosure) · verdict.
