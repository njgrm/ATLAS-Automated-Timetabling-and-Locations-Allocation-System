# HIGH packet R2 — separate the server-owned channel from the client-writable one on `PLACE_UNASSIGNED`

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (write-path constraint authority) · Status:
**DRAFT R2 — requires a fresh independent pre-action review. Supersedes R1 (`11f2c7d2`), which is withdrawn.**

## 1. The defect (unchanged, re-verified by the R1 review)

`atlas-server/src/services/manual-edit.service.ts:692`, in `applyProposal`'s `PLACE_UNASSIGNED` branch, writes
`metadata: proposal.metadata ? { ...proposal.metadata } : undefined` onto a **newly created, persisted** entry.
`ManualEditProposal.metadata` is `Record<string, any>` (`:88`), and the **client's own proposal type omits it**
(`atlas-client/src/types.ts:1384-1400`) — no client author writes it deliberately.

That bag decides constraint severity: `constraint-validator.ts:869,872` sets
`ROOM_FEATURE_MISMATCH` to `SOFT` when `deferredRoomTypePreference` is set, and `:838,841` likewise downgrades
`ROOM_TYPE_MISMATCH` via `roomAssignmentReason` (`:832`). The commit gate only tests `hardAfter.length > 0`
(`:1341`), and `ManualEditPanel.tsx:215` sends `allowSoftOverride: true` unconditionally.

R1's review proved it live with a probe on the real chain:
`NO_METADATA {"allowed":false,"hardAfter":1,"hardCodes":["ROOM_FEATURE_MISMATCH"]}` versus
`CLIENT_METADATA {"allowed":true,"hardAfter":0,"softCodes":["ROOM_FEATURE_MISMATCH"]}` — so the client flag both
downgrades the violation **and makes the preview report it as permitted**.

The commit path is properly authorised — `manual-edit.router.ts:64-90` requires `authenticate`,
`assertTimetableCapability(...,'timetable:edit')` and `assertRequestSchoolScope` — and the proposal is taken
verbatim from `req.body` (`:78`) with only `editType` presence checked (`:79`), with no allowlist or sanitisation
anywhere in the service.

## 2. Why R1's fix was wrong — do not repeat it

R1 proposed deleting `:692` and the type member, reasoning that `UnassignedItemInput` has no `metadata` field so
there is "no legitimate payload". **That was a false premise: R1 checked who *consumes* the unassigned item and
never checked who else *writes* the proposal.** The field is **dual-sourced**:
`timetable-quick-place.service.ts:430` sets `metadata: matchedEntry?.metadata ? { ...matchedEntry.metadata } :
undefined` on server-built `ManualEditProposal[]` (`buildQuickPlaceCommitProposals:404-433`, entry built at
`:345-348`), and `applyQuickPlace` commits them with `allowSoftOverride: true` (`:567-577`). A probe confirmed that
deleting `:692` turns Quick Place's own deferral into a **new HARD** `ROOM_FEATURE_MISMATCH` and a 422 block. **R1's
"fix" would have broken a working production path.**

## 3. The required property (state this, not the mechanism)

**The entry metadata used for a `PLACE_UNASSIGNED` commit must originate only from server-owned state, and must be
unreachable from any request body.** Concretely, the service must **not** derive it from its `proposal` parameter.
A client-sent `metadata` must have no path to the persisted entry, and the server's own Quick Place producer must
keep working unchanged in effect.

The exact shape is yours to choose — for example: carry the value on an internal, body-inaccessible parameter or an
internal proposal type used only by in-process callers, **and/or** strip the field at the request boundary in
`manual-edit.router.ts` for **both** wire routes (`manual-edits/preview` at `:37-57` and `manual-edits/commit` at
`:64-90`). What is **not** negotiable is the property above; a fix that only deletes the field is the R1 mistake.

**Expected tripwire:** a compile error at `timetable-quick-place.service.ts:430` when the client-reachable member
goes away. **Resolve it by re-pointing the server producer** to the new server-owned channel. **Never** resolve it
by re-adding a wire-writable field, and never by casting.

## 4. Required controls — all committed, all reachable from an existing `test:*` script

1. **Failing-first, the authority property.** A `PLACE_UNASSIGNED` whose request body carries
   `metadata: { deferredRoomTypePreference: true, roomAssignmentReason: 'MODULAR_POOL_ASSIGNED' }`, targeting a
   room that **lacks** a required feature, must still be **rejected** with 422 `HARD_VIOLATION_BLOCK`, and must not
   succeed under `allowSoftOverride`. **Report it RED against base and GREEN after the fix.** DB-free form:
   `previewManualEdit` already runs the production chain and returns `allowed`/`hardViolations`
   (`manual-edit.service.ts:1101-1107`); `atlas-server/src/__tests__/timetable-scheduling-quality-c03.test.ts`
   already imports it and is reached by `npm run test:timetable-scheduling-quality-c03` and `test:server-suite`.
   The literal 422 assertion needs the DB harness — **name which script you use** (`test:server-db` /
   `scripts/run-db-suite.mjs`).
2. **The same for `ROOM_TYPE_MISMATCH`**, since the R1 review found the bag downgrades that too.
3. **Quick Place preservation (mandatory — this is the control R1 lacked).**
   `buildQuickPlaceCommitProposals` → `applyProposalBatch` → `validateHardConstraints`: assert **no new HARD** and
   that `roomAssignmentReason` **survives** onto the committed entry. The compatible-room control alone passes
   post-fix and would have hidden the R1 break.
4. **No client metadata persists:** the created entry carries no client-supplied key.
5. Keep the R1 positive control: a compatible-room `PLACE_UNASSIGNED` still commits.

## 5. Verification — commands corrected, with the R1 errors fixed

- Server typecheck: **`atlas-server` has no `typecheck` script** (only `build`). Use
  `npx tsc --noEmit -p tsconfig.json` from `atlas-server`. State the measured baseline, do not assume it.
- Server `npm run build` must succeed.
- The `manual-edit` and constraint-validator server suites, with exact tallies **and base classification**.
- Client `typecheck` and `build`, measured **in the executing worktree** (not `D:\ATLAS`, where `@types/node` is
  absent and it is unmeasurable). Client typecheck baseline is **exactly 4** pre-existing errors; client suite must
  remain **15 failures across the same 10 files**, compared by failing **test name**.
- **Line-cap sweep as a DELTA row, not "must be empty":** the base sweep is **44+ files over 1000** (including
  `schedule-constructor.ts` 2977, `types.ts` 2286, `manual-edit.service.ts` 2190, `constraint-validator.ts` 1320).
  **Record the base count literally, and require the post-fix count to equal it.** A "must be empty" row is
  unsatisfiable and is a false mandatory row.
- `git diff --check` clean; `git status --short` EMPTY.

## 6. Data repair — none required, recorded deliberately

A read-only sweep of all 6 runs and ~13,800 draft entries found **zero** entries with a `manual-` entryId, so the
`:692` channel has **never written a live row**. Deferral-bearing keys only ever appear alongside server-written
companions (`modularAssignments`, `roomAuthorityDeviationReason`, `fallbackTier`), and the 150 rows carrying a lone
`roomAssignmentReason` are seed fixtures with no production producer. **This fix is forward-looking only; no
migration, no data write, no repair clause is required** — and that is stated here with its evidence rather than
left as an unanswered question.

## 7. Not authorized

Any deployment, runtime/task/env change, migration, live-data write, generation, publication, availability write,
term-cache apply, Teaching Load apply, or companion-repository action. **Source-only.** The live release
`26f7c907` is untouched by this packet; rolling the fix out is a separate HIGH action with its own packet, capacity
reclaim, pre-action review and acceptance.

## 8. Verify before editing

1. `:692` is the only read of `proposal\.metadata` in the server.
2. `timetable-quick-place.service.ts:430` **does** write `metadata` onto a `ManualEditProposal`
   (**this premise was the one R1 got wrong — check it first**).
3. The MOVE/CHANGE_ROOM/CHANGE_FACULTY/CHANGE_TIMESLOT branch (`:698-716`) assigns no `metadata`.
4. Both wire routes take a proposal from `req.body` — `preview` (`:37-57`) and `commit` (`:64-90`).
5. `ManualEditPanel.tsx:215` sends `allowSoftOverride: true` unconditionally.

**If any premise fails, STOP and report it. Do not edit.**
