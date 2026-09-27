# Overnight packet c1 — Planner A3 (non-timetable UI/UX) — 2026-09-27 23:10 +08 → 2026-09-28 06:30 +08

Issued by Lane C (overnight manager) after reviewing c0 (`overnight-a3-ui-ux-2026-09-27.md`, session
`ses_f1cdb5976ffeZApJg9uYqJopdx`, verdict in `docs/handoffs/lane-c-to-a2.md` → "Lane C review of A3 c0").
**Operator authorization, in chat with Lane C, 2026-09-27; live data is test data.** The operator is asleep: nobody
will answer a question tonight. Where this packet says decide, decide, record why in your handoff, and keep going.
Stop only at a real blocker, recorded as `BLOCKED(<reason>)` with evidence.

**Demo: Wednesday 2026-09-30.** The operator will walk older, mouse-first schedulers through the product. c0 made the
numbers honest; c1 must make the non-timetable half *look and read* like one calm product. UX weighs as much as
function: a correct screen that takes 40 words and three hunts to finish its task is a demo failure.

## Authority

- **Standing HIGH authorization** (`live-state.md` → Operator decisions, 2026-09-20), **with every gate retained**
  (one executor per candidate, fresh independent QA, labelled browser rows, real tally).
- Ordinary UI mutations for acceptance rows are allowed. You do not generate or publish timetables (A2's surface).
- **You do not deploy tonight. A2 owns every release** and ships what you have integrated on `origin/main`. When your
  last integration lands, post `A3 integrated for release at <sha>` in `docs/handoffs/lane-a-to-c.md` — **by 04:30 +08**
  if you want it in the night's second release — and list in your handoff the rows needing live acceptance, with exact
  steps, so A2's browser pass can run them.
- Out of bounds: timetable surfaces (`components/timetable/**`, `/timetable*`, `/runs`, `/manual-edit`,
  `/pre-generation`, `/policies`, `/room-schedules` — see your handoff → Ownership boundary), EnrollPro/SMART/AIMS
  writes, credentials/tokens, history rewrites.

## Coordination

- **Browser custody, one agent per profile (§12):** before any browser session create `E:/ATLAS-worktrees/.browser-lock`
  containing `A3 <ISO time> <purpose>`. If it names A2 and is younger than 45 min, do other work and retry. Delete it
  when done; older than 45 min is stale — overwrite and say so. (At 22:58 +08 A2 held it, written 22:46.)
- Loopback builds from your worktree are allowed for pre-integration evidence, labelled as isolated checks; Tailnet
  evidence only proves what is deployed. Live now is **`c0d91827`**; your `1e417694` is **not** live.
- **Worktree rule (earned in c0, binding):** never junction a disposable worktree's `node_modules` at a worktree you
  intend to keep, and never `git worktree remove` a worktree that contains a junction into another worktree. For
  shared deps use `npm ci` per worktree, or remove the junction with `cmd /c rmdir <link>` first and verify the target
  still has its files before any `worktree remove`. Tell your QA subagents this rule in their dispatch prompt.

## Queue, in order of demo value — each item ends integrated on `main` with its QA verdict, or `BLOCKED` with evidence

**0. Audit first, live, then fix (≤ 60 min, one browser session).** Tailnet, your profile, 1366x768. For each
non-timetable route below, record one row in a graded route table in your handoff:

| Route | Task the scheduler came to do | Words on first screen | Verbs (distinct action labels) | Status cues (icon/colour beside every status?) | Clicks to finish the task | Grade A–F | Top 3 stumbles |

Routes: `/` (Dashboard), `/sections`, `/subjects` (+ `/subjects/requirements`, `/subjects/decision-workspace`),
`/teachers`, `/teaching-load` (+ `/history`), `/faculty`, `/faculty/concerns`, `/faculty/preferences`,
`/faculty/room-preferences`, `/assignments`, `/map`, `/building`, `/exports` (+ sub-pages), `/setup`,
`/admin/year-setup`, `/audit`, `/my`, `/timetabling/how-it-works`. Rubric (memory `ux-communication-rubric`): fewest
words that still tell the truth, one verb per action, a visual cue beside every status, less is more, mouse-first,
no hover-only information, 1366x768 without page-level scroll where the task fits. Commit the table before fixing.

**1. Cohesion streams — `UX-R02`–`UX-R05` and the non-timetable half of `UX-R03c`** (`/setup`, `/exports` sub-pages
and their chrome overrides; `/timetable/runs` stays A2's). Fix in **consolidated streams** as in S1–S3 — one candidate
per stream, not per route: (S-a) page chrome and headers (one title pattern, one primary action slot, SMART-family
calm), (S-b) copy and verbs (cut words, one verb per action, consistent nouns), (S-c) status cues and empty/zero
states, (S-d) density at 1366x768. Order the streams by the grades from item 0, worst demo-path routes first. Each
stream: executor → fresh independent QA → integrate → live-acceptance steps listed for A2.

**2. Demo-walkthrough script, non-timetable half.** Write `docs/reviews/a3-demo-walkthrough-20260928/script.md`: the
operator's path **Dashboard → Sections → Subjects → Teachers / Teaching Load → Exports / Setup**, one numbered step per
action, each with the words the operator says, the click, and what the screen must show. Walk it **live** (Tailnet,
1366x768, origin asserted) once before your fixes and once on the latest deploy you can reach; grade each step
(pass / stumble / fail) for an older mouse-first user. Fix every stumble in your streams, or list it with the reason.
Hand the timetable half's entry point (the click into `/timetable`) to A2 as one line in `lane-a-to-c.md`.

**3. #53 follow-through (demo value, high).** After A2 deploys a release containing `1e417694`, look at `/map`
(click **Open map** first) and the Dashboard Campus Readiness card. If every room reads `Not available` / `n/a`, that is
honest but a wall of "n/a" is a poor demo screen: **wire the measured value from the published run** (run 320 is
published for 2026-09-27/28) through the same tri-state, or **hide the readout** when no room is measurable. Never
reintroduce a fabricated `0%`. If A2 has not deployed it by 03:00, decide from a loopback build, labelled isolated.

**4. #52 — Building view first render keeps the previous section's class grid.** Precondition: **`/map` renders 0
canvases until "Open map" is clicked** (canvas is then 616x500). Reproduce: Open map → select building A → note the
grid → switch to building B via the path the operator uses (find the `More`/switcher entry and record it) → sample the
canvas on the first frame against the sidebar's building identity. PASS/FAIL with evidence; fix only what reproduces.

**5. B5 — swap Cancel = zero change.** Never performed; the load-bearing unperformed row in this lane. Perform it on
live with a before/after count (the rows and IDs the dialog would touch, plus `audit_logs` max id if you can read it
read-only). If the control sits on an A2 timetable surface, coordinate with A2 in `lane-a-to-c.md` rather than editing.

**6. Debt:** `atlas-client/src/lib/__tests__/uxc01-derived-setup-surface.test.ts` 1-of-4 red on a `navigation.ts`
substring assertion (as of 2026-09-20). Re-verify first; correct the test contract (LOW, test-only) if still red and
fold it into your first stream's candidate. The double policy fetch stays A2's (both files are timetable surfaces).

**7. If time remains:** B1–B4, B10, B11 browser rows; 08 stays `BLOCKED_PRODUCT_DECISION` (your two options are
recorded); 27/28/34 stay `BLOCKED_SOURCE_GAP`. `/room-schedules` is a WIP page owned by the timetable lane — do not
redesign it tonight.

Keep going until 06:30 +08, then write the handoff.

## Deliverables (Lane C reads these when your run ends)

1. The graded route table (item 0) and the walkthrough script with both walks graded (item 2), committed.
2. Your handoff's ledger with every row terminal or explicitly blocked, plus a dated section "2026-09-28 c1":
   candidate and merge SHAs, QA verdicts + tallies, browser evidence paths, rows for live acceptance (exact steps).
3. `docs/plans/live-state.md` Lane A3 section updated and dated (do not touch the `Live release` block).
4. The `A3 integrated for release at <sha>` line in `docs/handoffs/lane-a-to-c.md`.
5. Everything pushed to `origin/main`; every process you started stopped, PIDs named; browser lock deleted.

Your final message: ≤ 15 lines — done / blocked / not reached, route-table grades (before → after), walkthrough
tally, last integrated SHA, handoff path.
