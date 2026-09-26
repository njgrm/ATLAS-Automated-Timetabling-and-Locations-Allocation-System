# HIGH packet R3 — one severity authority for manual-edit constraint checks

Date: 2026-09-26 (Asia/Manila) · Lane: A · Tier: **HIGH** (write-path constraint authority) · Status:
**DRAFT R3 — requires a fresh independent pre-action review.** Supersedes R1 (`11f2c7d2`) and R2 (`d8bf3f6d`),
both withdrawn after pre-action review.

## 0. Decisions taken (recorded so the reviewer can check them, not re-litigate them)

These follow from the scoped investigation in `docs/plans/live-state.md` and are **decisions, not preferences**:

- **D1 — route choice must not change constraint severity.** `/commit` and `/batch/commit` must return the same
  verdict for the same edit. Today `deferredRoomTypePreference` is written **only** at `:1484` inside
  `commitManualEditBatch` and merely read at `:414`; `commitManualEdit` has no auto-defer, so the same edit is HARD on
  one route and SOFT on the other. The lenient route is a bypass.
- **D2 — a recorded room-type deviation must NOT forgive a feature shortfall.** The auto-defer's comment (`:1475`)
  and its condition (`:1481`, `room.type !== subject.preferredRoomType`) are type-only, and
  `constraint-validator.ts:860-863` documents the feature constraint as "a HARD violation that would block
  publication". The flag must stop gating the feature check.
- **D3 — the blanket auto-defer over `newEntries` is removed, not narrowed.** `:1478` re-stamps the entire draft
  (the code distinguishes `applied`, used at `:1492`), unrecorded, so one lenient route reaches the whole schedule
  silently. The legitimate case it exists for — Quick Place placing a room of a different type — is served by the
  **server-owned channel** in change 1, which is justified per placement instead of stamped per draft.

## 1. The mechanism is PINNED (R2's review required this; do not re-open it)

**All of it lands in `atlas-server/src/services/manual-edit.service.ts`, at the `applyProposal` choke point that
every path funnels through. No router-level stripping is part of this fix**, because it provably cannot reach
`timetable-teaching-load-repair.router.ts:134`, and because a router-scoped fix is what R2 wrongly offered.

1. **Entry metadata for `PLACE_UNASSIGNED` arrives as an explicit, body-inaccessible parameter.** Change
   `applyProposal` (and `applyProposalBatch`) to take server-owned entry metadata as a **separate argument** — not
   from `proposal`. Delete `metadata: proposal.metadata ? {...} : undefined` at `:692` and remove
   `metadata?: Record<string, any>` from the wire-reachable `ManualEditProposal` (`:88`).
2. **The two legitimate server producers pass their value through that new argument:**
   `timetable-quick-place.service.ts:430` (`buildQuickPlaceCommitProposals`, entry built at `:345-348`) and
   `timetable-teaching-load-repair.service.ts:62,806-808` (the `placementProposal` path).
   **Expected tripwire:** a compile error at `:430` and in the repair service. **Resolve it by re-pointing the
   producer to the new argument. Never re-add a wire-writable field, and never cast.** If either producer turns out
   to depend on *client* metadata rather than server-derived metadata, **STOP and report** — that would mean the
   client channel has a legitimate consumer and the premise is wrong.
3. **Delete the blanket auto-defer at `:1475-1487`** per D3.
4. **Split the flag's consumption (D2).** In `constraint-validator.ts`, `deferredRoomTypePreference` must relax
   **only** the room-type check (`:838,841`). It must **not** affect the feature check at `:869,872`. Since nothing
   today sets a *feature-scoped* deferral, room-feature compliance becomes **HARD** on every path. Update the
   `:860-863` comment so it matches the enforced rule.

Net effect: every path computes severity from server-owned state only, and the same edit yields the same verdict
whichever route carries it.

## 2. Required controls — all committed, all reachable from an existing `test:*` script

1. **Failing-first, the authority property (D1).** The same type-mismatched, feature-shortfall placement must be
   **rejected 422 `HARD_VIOLATION_BLOCK` on both `/commit` and `/batch/commit`**, and must not succeed under
   `allowSoftOverride`. Report **RED against base** and green after. DB-free form: `previewManualEdit` runs the
   production chain and returns `allowed`/`hardViolations` (`manual-edit.service.ts:1101-1107`);
   `atlas-server/src/__tests__/timetable-scheduling-quality-c03.test.ts` already imports it and is reached by
   `npm run test:timetable-scheduling-quality-c03`. The literal 422 assertion needs the DB harness — **name the
   script you use** (`test:server-db` / `scripts/run-db-suite.mjs`).
2. **Failing-first, the flag split (D2).** With `deferredRoomTypePreference` set, a room that is the right *type*
   but **lacks a required feature** must still be **HARD**. A room of the wrong type with features satisfied must be
   permitted. Both directions asserted.
3. **Quick Place preservation (mandatory — the control R1 lacked and R2 made satisfiable).**
   `buildQuickPlaceCommitProposals` → `applyProposalBatch` → `validateHardConstraints`: assert **no new HARD** and
   that `roomAssignmentReason` **survives** onto the committed entry.
   **Use the feature-mismatching fixture at `timetable-scheduling-quality-c03.test.ts:672`.** The default
   `quickPlacementFixture` has `requiredFeatures: []`, so `roomRequiredFeatures` yields `[]` and "no new HARD" would
   pass **vacuously** — R2's review caught exactly that.
4. **Teaching Load repair preservation.** The `placementProposal` path still places an unassigned item and its
   server-derived metadata still arrives — assert both.
5. **No client metadata persists** on any created entry, and the MOVE/CHANGE_ROOM/CHANGE_FACULTY/CHANGE_TIMESLOT
   branch still preserves existing server-written metadata untouched.
6. **No-regression control:** a fully compatible placement still commits on both routes.

## 3. Verification — commands corrected

- Server typecheck: **`atlas-server` has no `typecheck` script** (only `build`). Use
  `npx tsc --noEmit -p tsconfig.json` from `atlas-server`; state the measured baseline.
- Server `npm run build` must succeed.
- `manual-edit` and constraint-validator server suites, with exact tallies **and base classification**.
- Client `typecheck` and `build`, measured **in the executing worktree**, which must have `@types/node` installed —
  in `D:\ATLAS` the client typecheck aborts `TS2688` with no error count and is unmeasurable. Baseline is **exactly
  4** pre-existing errors there. Client suite must remain **15 failures across the same 10 files**, compared by
  failing **test name**.
- **Line-cap sweep as a DELTA row.** The base is **39** files over 1000 physical lines across
  `atlas-server/src` + `atlas-client/src` (73 repo-wide) at `d8bf3f6d`, including `schedule-constructor.ts` 2977,
  `types.ts` 2286, `manual-edit.service.ts` 2190, `constraint-validator.ts` 1320. **Record the base count you
  measure and require the post-fix count to equal it.** "Must be empty" is unsatisfiable and is a false mandatory row.
- `git diff --check` clean; `git status --short` EMPTY.

## 4. Data repair — none required, on a verified signal

`manual_schedule_edits` has **0 rows**: no manual edit of any kind has ever been committed on this database, so
none of these channels has been exercised. **Forward-looking only** — no migration, no data write.

## 5. Not authorized

Any deployment, runtime/task/env change, migration, live-data write, generation, publication, availability write,
term-cache apply, Teaching Load apply, or companion-repository action. **Source-only.** The live release
`26f7c907` is untouched; rollout is a separate HIGH action with its own packet, capacity reclaim, pre-action review
and acceptance.

## 6. Verify before editing

1. `proposal\.metadata` has exactly one read in the server, at `:692`.
2. `timetable-quick-place.service.ts:430` writes `metadata` onto a proposal — **the premise R1 got wrong; check first.**
3. `timetable-teaching-load-repair.service.ts:62,806-808` forwards a client `placementProposal` that reaches `:692`.
4. `deferredRoomTypePreference` is written **only** at `:1484`, inside `commitManualEditBatch`, and read only at `:414`.
5. `constraint-validator.ts:869,872` uses the same flag for the feature check that `:838,841` uses for type.
6. `atlas-server` has no `typecheck` script; the client worktree needs `@types/node`.

**If any premise fails, STOP and report it. Do not edit.**
