# Simple Timetable operator audit — 2026-09-11

## Verdict

`CORRECTION_REQUIRED`. The current Simple Timetable is not yet ready for an
older scheduler to operate without guidance. The live current year has no
generated run, so live evidence is authoritative for the no-run path only;
data-filled placement, swap, repair, and publication-state behavior must be
exercised with controlled browser fixtures before any live generation.

## Evidence boundary

- Live Tailnet: `https://njgrm.buru-degree.ts.net`, authenticated as the
  configured scheduler officer, school 1.
- Runtime year: 9 / 2030-2031.
- Read-only database check: no current-year generation run or published
  revision. The only stored run is failed run 179 for archived year 8.
- Safe browser actions performed: navigation, opening menus/sheets/tutorials,
  changing the schedule-view selector, and entering the pre-generation view.
- No generation, save, swap, publication, migration, or database mutation was
  triggered. Login produced only the expected authentication audit/timestamp
  effects.
- Source review: `work/timetable-ux-01` at
  `aa38d7845ed7fafa79638b9512b584c29400d48e`, reviewed against its recorded
  base `aab8fb00`.

## Confirmed material findings

### TT-A01 — the live no-run surface contradicts itself

The first live Timetable surface showed `GENERATED RUN #-`, enabled run tools,
and `No violations - schedule is clean` despite there being no current-year
run. Review, unresolved placement, swap, draft-planner, and room-request
actions were simultaneously offered. The newer pre-generation surface is more
honest, but the transition exposes two competing lifecycle presentations.

Required outcome: every Simple and Advanced entry point must derive from one
current-school/current-year lifecycle and must never describe an absent run as
clean, generated, reviewable, or publishable.

### TT-A02 — the primary repair action points to superseded authority

The no-run task card says that no term configuration exists and offers `Fix
Curriculum Requirements`, navigating to `/curriculum-requirements`. That page
is no longer the intended annual authority. Ordered terms come from EnrollPro,
and ATLAS is moving to derived demand rather than operator-maintained duplicate
requirements.

Required outcome: use a truthful term-source/setup state. Where EnrollPro term
authority is absent, send the scheduler to one year/setup status surface and
explain the external dependency. Do not restore Curriculum Requirements as the
normal repair workflow.

### TT-A03 — Advanced mode retains a generation-gate bypass

Simple mode uses a richer readiness decision, while the Advanced header still
offers a direct Generate action guarded mainly by loading, year, drift, and
generation state. A scheduler can therefore encounter a different generation
decision depending on the selected view.

Required outcome: one shared generation capability decision must govern every
visible and hidden Simple/Advanced trigger. When blocked, show one repair
action; when eligible, show a confirmation that summarizes the exact year,
terms, demand, Teaching Load ownership, draft anchors, and expected effects.

### TT-A04 — important class repair is split or mislabeled

Simple mode exposes Move and Swap, but not an explicit selected-class Change
Room action. Its `Change teacher`/`Reassign teacher` affordance opens the bulk
teacher-departure workflow, while the underlying authority is Teaching Load
ownership. Advanced mode separately exposes Change Room and Change Teaching
Load owner.

Required outcome: Simple mode must provide the high-frequency selected-class
repairs—Move time, Change room, Swap—and a clearly named `Change Teaching Load
owner` route or explanation. `Teacher leaving` remains a separate bulk task and
must never masquerade as a one-class edit.

### TT-A05 — placement guidance depends too heavily on color

Pointer previews decorate cells with color/rings and only the active hovered
cell receives limited conflict information. A clean empty target, occupied swap
target, warning target, and blocked target are not persistently labeled in
plain language. The status key is buried under More.

Required outcome: the active task must have a compact visible legend and target
cells must use text/icon labels such as `Place`, `Swap`, `Warning`, and
`Blocked`. The selected/hovered target must state the affected class, teacher,
room/time, reason, and next action. Color cannot be the only cue.

### TT-A06 — swap dialogs reduce serious conflicts to counts

Controlled data-filled evidence shows swap dialogs with very large warning
totals but no useful explanation of the warnings. Blocked swaps can say only
`No safe swap option available`; draft and generated swap dialogs count hard
and soft issues without consistently listing their human titles/details or a
repair destination.

Required outcome: blocked swaps list the decisive blockers. Warning-bearing
swaps group the most important warnings, explain their consequences, and let
the scheduler expand the remainder. A write must not be offered when any hard
blocker exists.

### TT-A07 — the tutorial is fixed rather than state-aware

The eight-step tutorial teaches placement, full-day display, export, and
Advanced tools even in a no-run state where those actions cannot be completed.
It also says ATLAS shows a review before saving, while the clean generated
placement path can commit immediately and rely on Undo.

Required outcome: tutorial/help content must match the actual lifecycle and
write behavior. No-run help should explain setup and generation; generated-run
help should explain select, preview, save, and undo. If a clean action is
one-click, the UI must label it honestly before the click and expose a prominent
Undo afterward.

### TT-A08 — capability gates are over-broad in some places and absent in others

Run-dependent tools are sometimes available with no run, while other useful
setup/navigation actions are disabled by a broad shared flag. The More menu
mixes routine and expert operations without explaining when each is available.

Required outcome: derive per-capability gates for view selection, setup/input
status, room requests, move, room change, swap, owner repair, issue review,
generate, and publish. Disabled actions must give a short reason and the next
reachable repair action.

## Simple versus Advanced decision

Simple mode already supports section/teacher/room schedule selection, filters,
run selection, refresh, export, unresolved placement, swap, teacher-departure,
issue review, generation, edit history, and entry to Advanced mode.

The following high-frequency capabilities should be reachable from Simple:

- selected-class Move time;
- selected-class Change room;
- Swap sessions;
- clearly scoped Teaching Load owner repair;
- room-request and input-status review when they block the current task;
- visible Undo after a successful edit.

Policy editing, campus map administration, global setup synchronization, the
full matrix, diagnostics, and tactical sandbox remain Advanced tools. They
should not be copied into Simple merely for parity.

## Required verification strategy

Because the live current year has no generated timetable, the correction must
use both:

1. read-only Tailnet QA for login, no-run truth, menus, repair destinations,
   responsive layout, and the generation confirmation boundary; and
2. a controlled browser fixture rendering production Timetable components for
   generated data, move, room change, clean/warning/blocked placement,
   clean/warning/blocked swap, missing owner/room, stale-write recovery,
   failed-run recovery, published read-only behavior, and Undo.

The live browser must never cross the generation confirmation or invoke a
write endpoint. Controlled fixture writes must be intercepted and asserted;
they are interaction evidence, not live mutation.
