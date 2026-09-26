# HIGH packet — close the client-controlled constraint-severity channel on `PLACE_UNASSIGNED`

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (write-path constraint authority) · Status:
**DRAFT — requires independent pre-action review before any execution**

## 1. The defect

`atlas-server/src/services/manual-edit.service.ts:692`, inside `applyProposal`'s **`PLACE_UNASSIGNED`** branch,
writes client-supplied data onto a newly created, persisted schedule entry:

```ts
metadata: proposal.metadata ? { ...proposal.metadata } : undefined,
```

`ManualEditProposal.metadata` is typed `Record<string, any>` (`:88`) — untyped, unvalidated. The **client's own
proposal type does not declare it** (`atlas-client/src/types.ts:1384-1400`), so no client author writes it
deliberately.

That metadata bag is what decides whether a **hard** scheduling constraint blocks the commit:
`constraint-validator.ts:869` computes `shouldDeferRoomFeatures = isModularPoolAssignment ||
e.metadata?.deferredRoomTypePreference === true`, and `:872` sets `severity: shouldDeferRoomFeatures ? 'SOFT' :
'HARD'` on `ROOM_FEATURE_MISMATCH`. `isModularPoolAssignment` is `e.metadata?.roomAssignmentReason ===
'MODULAR_POOL_ASSIGNED'` (`:832`) — the same bag. A SOFT-only commit then proceeds when `allowSoftOverride` is set
(`:1346-1347`), and `ManualEditPanel.tsx:215` already sends it.

**Net effect: any authenticated actor holding `timetable:edit` can downgrade a hard room-feature violation to an
overridable soft warning** by sending `metadata: { deferredRoomTypePreference: true }` (or
`roomAssignmentReason: 'MODULAR_POOL_ASSIGNED'`) on a `PLACE_UNASSIGNED` proposal.

**This is not an unauthenticated bypass.** `manual-edit.router.ts:64-90` requires `authenticate`,
`assertTimetableCapability(req, res, 'timetable:edit')` and `assertRequestSchoolScope`, and the proposal is taken
verbatim from `req.body` (`:78`) with only `proposal.editType` presence checked (`:79`) — **no field allowlist and
no metadata sanitisation anywhere in the service** (searched `allowlist|sanitiz|pick(|whitelist|stripUnknown`).

**Blast radius: `PLACE_UNASSIGNED` only.** The `MOVE_ENTRY` / `CHANGE_ROOM` / `CHANGE_FACULTY` branch
(`:703-716`) spreads the existing entry and assigns only `day`, `startTime`, `endTime`, `durationMinutes`, `roomId`
and `facultyId` — it never touches `metadata`, so an existing entry's server-written metadata cannot be tampered
with there. A repo-wide grep for `proposal.metadata` returns **exactly one** read: the assignment at `:692`.

## 2. Why the fix is to delete it, not to filter it

`applyProposal` follows a consistent convention in this very block: **substantive data from the authoritative
persisted unassigned item (`uItem`), placement targets from the proposal** — `:674` `subjectId`, `:675` `sectionId`,
`:681` `termIndex`, `:682-691` `entryKind`/program*/cohort*/adviser*, all from `uItem`; only
`day`/`startTime`/`endTime`/`roomId`/`facultyId`/`durationMinutes` from the proposal.

Line `:692` is the **single violation of that convention**, and — decisively — **`UnassignedItemInput` has no
`metadata` field at all** (`atlas-server/src/services/fix-suggestions.service.ts:42-59`; the persisted
unassigned item carries `sectionId`, `subjectId`, `gradeLevel`, `session`, `termIndex`, `reason`, `entryKind`,
program*, `cohort*`, `adviser*` and nothing else).

So the assignment is not carrying anything forward from an authoritative source. **There is no legitimate payload
for it.** Filtering an allowlist would be inventing a contract that does not exist; the fail-closed fix is to
remove it.

## 3. Required change — minimal, server-only

1. **Delete the `metadata` assignment at `:692`.** A `PLACE_UNASSIGNED`-created entry gets no `metadata`, matching
   the block's own convention (there is no unassigned-item metadata to carry). Change nothing else about entry
   construction.
2. **Close the channel at the type level:** remove `metadata?: Record<string, any>` from `ManualEditProposal`
   (`:88`). If any compile error results, that is a *finding about a real consumer*, not something to work around
   by re-adding the field — report it.
3. **Change no behaviour that is currently correct.** The MOVE/CHANGE_ROOM branch, the batch-commit derivation at
   `:1476-1487`, the scheduler's writes at `schedule-constructor.ts:3067-3074`, and every server-derived deferral
   path stay exactly as they are. **This packet removes a client channel; it does not touch server authority.**

## 4. Required regression control (the load-bearing evidence)

Committed server test proving the authority property, reachable from an existing `test:*` script:

- **Failing-first:** a `PLACE_UNASSIGNED` proposal whose body carries
  `metadata: { deferredRoomTypePreference: true, roomAssignmentReason: 'MODULAR_POOL_ASSIGNED' }`, targeting a room
  that **lacks** a feature the subject requires, must still be **rejected** with 422 `HARD_VIOLATION_BLOCK` — and
  must **not** succeed via `allowSoftOverride`. Prove this test is **RED against base** (base accepts it, or
  accepts it under override) and **green after the fix**. Report both outputs literally.
- A positive control: a `PLACE_UNASSIGNED` for a **compatible** room still commits successfully, so the fix has not
  broken the ordinary path.
- Assert the created entry carries **no** client-supplied metadata.
- A `PLACE_UNASSIGNED` that legitimately needs deferral must still work — i.e. confirm no *server*-derived path
  depends on the client supplying it. If one does, that is a `BLOCKING` finding, not something to accommodate.

## 5. Verification the executor must run and report literally

- Server `typecheck` and `build` — no new errors; state the measured baseline rather than assuming it.
- Server unit suites covering `manual-edit` and the constraint validator; report exact tallies and classify any
  change against the base run.
- `npm run test:client-suite` in `atlas-client` — must remain **15 failures across the same 10 files**; compare by
  failing **test name**, not count.
- Client `typecheck` — **exactly 4** pre-existing errors; client `build` passes.
- Your own repo-wide sweep for files over 1000 physical lines must be **empty**.
- `git diff --check` clean; `git status --short` EMPTY.

## 6. Not authorized by this packet

Any deployment, runtime/task/env change, migration, live-data write, generation, publication, availability write,
term-cache apply, Teaching Load apply, or companion-repository action. **This packet is source-only.** It changes
no committed live data, and the running release `26f7c907` is untouched by it. Rolling the fix out to the live
runtime is a **separate** HIGH action with its own packet, capacity reclaim, pre-action review and acceptance.

## 7. Verify the premises before building

Two packets in this area were withdrawn because their premises were wrong, so confirm before editing:
1. `:692` is the **only** read of `proposal.metadata` in the server (grep `proposal\.metadata`).
2. `applyProposal`'s MOVE/CHANGE_ROOM branch (`:703-716`) does **not** assign `metadata`.
3. `UnassignedItemInput` (`fix-suggestions.service.ts:42-59`) has **no** `metadata` field.
4. The commit route really does gate on `authenticate` + `assertTimetableCapability` + `assertRequestSchoolScope`.

**If any premise fails, STOP and report it. Do not edit.**
