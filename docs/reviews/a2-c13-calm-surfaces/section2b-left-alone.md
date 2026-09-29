# A2 C13 — §2b strings deliberately left alone

Candidate `e89a3100` (correction) on `bd2bab32`. Base `341bdb9d`.

§2b is a dated boundary, not an oversight. It names the prose that uses "timetable"
as the ordinary English noun, and it names files whose copy this candidate does not
touch. Rewording them here would have been the "too literal, no thought" change the
design judgement gate exists to catch: a separate, larger copy sweep, decided on its
own evidence, with its own reviewer.

## 1. Gate reasons in `src/lib/timetable-capabilities.ts` (full sentences, untouched)

`TimetableActionGate.reason` is the SENTENCE. The header's new visible line is
`TimetableActionGate.shortReason`, authored at the same `denied()` call. Both stand.

- `Waiting for your school and school year to load.`
- `Checking schedule information for this school year.`
- `Setup inputs for the active school year are not ready yet.`
- `Schedule information could not be checked.`
- `Generation readiness is not verified for this school year.`
- `The active school year is out of sync with setup.`
- `No generated timetable exists yet to publish.`
- `Finish the pre-generation draft before publishing.`
- `This timetable is already published.`
- `Fix N hard blocker(s) before publishing.` / `Place N unresolved session(s) before publishing.`
- `runOnlyReason(...)` — `${what} becomes available after ATLAS generates a timetable for this school year.`
- `Select a scheduled class on the grid first.`

`Resolve-time` sentences in `simple/SimpleHeaderHelpers.tsx` are also untouched:
`A generation run is already in progress.`, `The timetable is still loading.`,
`Generation is not available for this school year yet.`,
`Publishing is not available for this run yet.`

**Why:** §2b's class is "prose that uses 'timetable' as the ordinary English noun".
These are complete sentences whose meaning is the noun. Truncating or rewording them
to match the place-name sweep would change what they claim about the gate.

## 2. Files §2b names explicitly — zero edits

`PublicPublishedSchedule.tsx` · `Dashboard.tsx` · `notification-presentation.ts` ·
`RolloverResetPanel.tsx` · `SectionHomeRoomModals.tsx` · `UnassignedInsertionWorkflow.tsx` ·
`FacultyProfileSheet.tsx` · `TacticalSandboxDock*`

Not one line of any of these was changed by this candidate.

## 3. `PublishedRevisionDialog.tsx` — the badge changed, its neighbours did not

Changed (§2a, listed): line 150, the standalone control label
`Timetable revision` → `Schedule revision`.

Left alone on purpose, and this is the load-bearing part of the ruling:

- line 115 `Creating the published timetable revision now.`
- line 313 `Create timetable revision`
- `TacticalSandboxDock.parts.tsx:541` `Create timetable revision`
- `TacticalSandboxDock.tsx:392` `Create timetable revision`
- `TacticalSandboxDock.helpers.ts:100` `This schedule is already published. Create a timetable revision instead of rewriting Teaching Load.`

**Why:** §2b protects the SAME noun in the dock. Changing the badge to the place name
while the dock's "Create timetable revision" kept the plain noun would have put two
names for one thing in the same flow. The bare noun is correct there.

## 4. The operator-adjudicated carve-out (`schedule`, not `Class Schedule`)

`§2a place-name surfaces take CLASS_SCHEDULE_LABEL; the carve-out class — a person's
or a revision's own weekly schedule — takes the plain word "schedule".` Recorded per
the operator's 2026-09-29 adjudication; written into `src/lib/class-schedule-naming.ts`.

- `TimetableFacultyIssuePivotDialog.tsx:23,30` — `Open {teacher}'s schedule?` / `Open teacher schedule` (was `timetable`).
- `TimetableUndoRedoControl.tsx:146,153` — `Undo last manual schedule change` (was `timetable`).
- `PublishedRevisionDialog.tsx:150` — `Schedule revision` (see §3).

`SimpleTaskDrawerHelpers.tsx:293-294` and `SimplePublishReadinessSheet.tsx:238-239`
were named in §2a as "if you touch them" only. **They were not touched** and are left
for the same sweep that owns the ordinary-noun prose.

## 5. One remaining "Timetable" in user-visible text, by design

`src/components/timetable/timetableWorkspaceTruth.ts:5` is a source comment, not
rendered. `timetableWorkspaceTruth`, `timetable-capabilities`, `timetableUndoRedoState`
etc. remain the INTERNAL module names — the packet's ruling is that the internal name
is fine as long as it does not reach the screen.

## 6. Verification that this list is real, not decorative

`L6c` and `L6d` in `src/lib/__tests__/a2-c13-one-place-name.test.tsx` pin the entire
`{label, to}` navigation table and every `routeChromeOverrides` key and title as
literals, so the sweep provably did not move a route while changing a label.
`test:ux-a2-c13-calm-loading` — 11/11.
