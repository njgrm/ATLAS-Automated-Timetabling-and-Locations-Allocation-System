# PUBLISHED-IMMUTABILITY-C08R1 — close the snapshot-consistency and sync-resurrection blockers

- Stream: `PUBLISHED-IMMUTABILITY-C08R1` (successor of the integrated `PUBLISHED-IMMUTABILITY-C08`)
- Kind: `CYCLE`, source-only. Risk: `MEDIUM` source; publication/generation stay `HIGH`-gated.
- Base: `f84e43c3fda49bc2ad3bdf85cd4974b1c1b3c6d9` (current `origin/main`, which contains the C08 integration `f3537544` and candidate `37a5074c`)
- Writable worktree: `E:/ATLAS-worktrees/published-immutability-c08` (already contains the C08 tree; fast-forwarded to the base)
- Branch: `work/published-immutability-c08`
- **Additive commits only** — do not amend, rebase, or force-push the reviewed candidate.
- Directive pin: `origin/main:AGENTS.md`, blob `051ad26a07509e3af4f1c1762e1ccfff8bb6cc88`, LF-SHA-256 `7663164608a330af5440a6e0ea1ffade20987b49a7bb0d939f3b50f1aa2df0a3`. **Pin correction 2026-09-17 (WF-C10, planner):** the previous value `ffd1452004753aa0f2b7ef21d990cb1df6e540c2850155b30dece990b8b82bd5` reproduces at no `AGENTS.md` blob in reachable history; the directive at this packet's own base `f84e43c3` was already `051ad26a…` = `76631646…`, so this is the historically truthful pin.
- Recommended executor reasoning: `high` (not `max`)

## Origin of this correction

The fresh Wave Completion Auditor over the integrated C08 wave returned
`CORRECTION_REQUIRED` with two BLOCKING findings. Both were independently
re-verified by the primary planner at source. They must be fixed before any
publication/generation unlock.

### B1 — the snapshot-consistency gate rejects the canonical production publication

`assertSnapshotConsistency` (`atlas-server/src/services/published-identity-snapshot.service.ts:201-257`)
matches each frozen special event's **raw** `(startTime,endTime)` against frozen
display-slot intervals by **exact string identity** in both directions
(`EVENT_INTERVAL_MISSING` `:217`, `SPECIAL_EVENT_SLOT_UNBACKED` `:245`).

The real producer builds the run display slots in
`atlas-server/src/services/schedule-constructor.ts` and **snaps** the Monday
Flag/HGP overlay to its containing canonical CLASS row via
`resolveContainingClassRow`, while the frozen `policy_special_events` row keeps
its raw window (`07:00-07:30` inside canonical `06:45-07:30`). `publishSchedule`
calls the snapshot builder inside the publication transaction
(`publication-contract.service.ts:311-327`), so **every canonical-shape
publication fails closed with 422 `PUBLICATION_SNAPSHOT_INCONSISTENT` and zero
writes** — the stream's own objective is unreachable.

The C08 suite masked this because its positive path hand-wrote a `07:00-07:30`
`SPECIAL_EVENT` display slot that the real producer cannot emit. That is a
production-shape equivalence violation and must be removed from the positive
path.

### B2 — the drift branch re-publishes superseded runs

`invalidateStaleCompletedRuns` (`atlas-server/src/services/generation.service.ts:1618-1641`)
routes on the loose `hasPublishedMarkers` (`:93-98` — true when `publishedAt` is
a non-empty string OR `publishedBy` is a number) and then explicitly writes
`isPublished: true` (`:1629`). The production supersession path keeps those
informational markers while setting `isPublished: false`
(`publication-contract.service.ts:344-352`), so a superseded run is re-asserted
as current published truth. Two `isPublished: true` runs in one school/year make
`published-schedule.service.ts:247` throw `409 PUBLISHED_RUN_AMBIGUOUS`,
breaking every published read and export, and it regresses the supersession path
packet §4.9 forbids regressing.

## Required corrections

### R1 (closes B1)
Replace exact-interval matching in `assertSnapshotConsistency` with one
containment + day-scope authority mirroring `resolveContainingClassRow`
semantics, applied symmetrically:
- **event → slots**: an event window is satisfied when at least one display slot
  *contains* `[event.startTime, event.endTime]`; if `event.dayOfWeek != null`, at
  least one containing slot must carry the same `dayOfWeek` (else keep
  `DAY_SCOPED_EVENT_NOT_DAY_SCOPED`); keep `EVENT_INTERVAL_MISSING` only when no
  containing slot exists.
- **slot → events**: a `SPECIAL_EVENT` slot is backed when it contains some
  frozen event window, or when the frozen policy's global break interval equals
  its interval; keep `SPECIAL_EVENT_SLOT_UNBACKED` otherwise.
- Keep `FLAG_HGP_REJECTED_DAY`, the 422 code, and zero-write behavior unchanged.
- Re-express the G01b mutant so the control still fails: set every
  `SPECIAL_EVENT` slot's `dayOfWeek` to `null` while a Monday event exists →
  `DAY_SCOPED_EVENT_NOT_DAY_SCOPED`.

#### R1 mandatory control
Add a decisive positive control whose `summary.timetableDisplaySlots` is
produced by the **real producer** (`buildRunTimetableShapeContracts` +
`buildUnionDisplaySlots`) for `getExpectedCanonicalSlots(7,'REGULAR')` with a
persisted `FLAG_OR_HGP 07:00-07:30` row, asserting the snapshot builds and that
the frozen flag slot is `06:45-07:30` MONDAY. **Remove the hand-written slot
list from the positive path.**

#### R1 mutant
Null every `SPECIAL_EVENT` slot's `dayOfWeek` in the real-producer control →
`DAY_SCOPED_EVENT_NOT_DAY_SCOPED` control FAILS. Restore byte-exactly.

### R2 (closes B2)
In `invalidateStaleCompletedRuns` never *assert* publication. Replace
`isPublished: true` (`generation.service.ts:1629`) with copy-through:
```ts
const nextSummary = {
  ...candidate,
  publicationIntegrity: {
    ...existingIntegrity,
    driftDetectedAt, driftReason: 'FACULTY_SYNC_DRIFT', driftStaleFacultyIds,
  },
};
```
Keep the non-destructive branch for every marker-carrying run and keep the
destructive `FAILED` path for unpublished runs. A current published run keeps
`isPublished: true`; a superseded run keeps `isPublished: false` and its
`publishedAt`/`publishedBy` as informational markers.

#### R2 mandatory control
Fixture with a current published run and a superseded run
(`isPublished:false` + `publishedAt` + `publishedBy` + `publicationSuperseded*`),
both referencing a deactivated faculty. Assert: (a) exactly one run has
`isPublished === true` after sync; (b) the superseded run's `isPublished` is
`false` with its markers preserved; (c) neither run is `FAILED`; (d) exactly one
drift audit per drifted run; (e) the published read resolves one candidate with
no `PUBLISHED_RUN_AMBIGUOUS`.

#### R2 mutant
Restore the `isPublished: true` assertion → the R2 control FAILS. Restore
byte-exactly.

## Gates — exactly 8 `MANDATORY_SOURCE` rows, 0 `MANDATORY_LIVE`

| # | Gate |
|---|---|
| 1 | C08 suite whole (`atlas-server/src/__tests__/published-immutability-c08.test.ts`) green with the new R1/R2 controls and the real-producer positive path |
| 2 | R1 real-producer positive control (canonical Flag/HGP overlay builds; frozen flag slot `06:45-07:30` MONDAY) |
| 3 | R1 mutant (`dayOfWeek` nulled) fails `DAY_SCOPED_EVENT_NOT_DAY_SCOPED`, restored byte-exactly |
| 4 | R2 supersession control (a–e above) |
| 5 | R2 mutant (`isPublished:true` restored) fails the R2 control, restored byte-exactly |
| 6 | `publication-contract-readiness.test.ts` + `publication-contract-postgres-concurrency.test.ts` (disposable DB only) |
| 7 | `npm --prefix atlas-server run build` (tsc) + `npm --prefix atlas-client run build` (vite) |
| 8 | `git diff --check` clean + `npm run workflow:verify -- --state docs/plans/atlas-delivery-cycles.json` exit 0 + built-server startup (`node atlas-server/dist/server.js`) with explicit `.js` runtime-import proof |

## Boundaries
No live login, deployment, restart, runtime/task/env change, shared/live DB
write, generation, publication, migration, or companion edit. Do not edit the
living register or `phasePlan.md`. No migration. Disposable DBs only, dropped
with zero residue.

## Return
Commit additively on `work/published-immutability-c08`, return `REVIEW_REQUIRED`
with base/candidate SHA, changed paths, the 8-row trace table, both mutant
results with byte-exact restore proof, and the disposable-DB cleanup proof.
