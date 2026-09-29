# A9 C6 — Campus & Rooms: readiness filter buttons, natural room order, map inset

Fix 1.2 items **7.2** and **10.2**. Client-surface only. Item 36.2 was out of scope and
`campusEditorCanvas.ts` was not touched.

- **Base SHA:** `7d008db78ae0efe40e2e68a6cf9df342ff6c0eb8` (clean, branch `work/a9-c6-room-filters`)
- **Candidate SHA:** `feat(campus): readiness filter buttons, natural room order, map inset`
- **Worktree disposition:** `KEEP_ACTIVE`
- **Worktree:** `E:\ATLAS-worktrees\lane-a9-c6-room-filters`

## Changed paths

| Path | What |
|---|---|
| `atlas-client/src/components/campus-map/RoomReadinessList.tsx` | 7.2 + the list half of 10.2 |
| `atlas-client/src/components/campus-map/CampusMapOverview.tsx` | 10.2, one line (`:722`) |
| `atlas-client/src/components/BuildingView.tsx` | 10.2, two classNames (`:795`, `:867`) |
| `atlas-client/src/components/CampusMap.tsx` | 10.2, one-look alignment (`:52`) |
| `atlas-client/src/lib/__tests__/a3-c4-map-truth.test.ts` | non-subtractive widening + 2 added assertions |
| `atlas-client/src/components/campus-map/__tests__/a9-c6-room-readiness-filters.test.ts` | new, 17 tests |
| `atlas-client/package.json` | new `test:a9-c6-room-filters` script |

## What changed and why

**7.2 — the toggle became four real filters.** `showAllRooms`, the
`room-readiness-show-all` `<Button>` and the `ChevronDown` import are **removed**, not
reworded: the `All rooms` default already is "show all rooms", so keeping the toggle would
put two controls for one job on the row. The replacement is a labelled
`role="group" aria-label="Filter rooms by readiness"` region whose row and per-button classes
are copied from `TeacherAttentionFilters.tsx:40-58` (`flex min-w-0 flex-nowrap items-center
gap-2 overflow-x-auto pb-0.5`; `h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs
font-bold`; `variant={active ? 'secondary' : 'outline'}`; `aria-pressed`; count in
`ml-1 tabular-nums text-muted-foreground`). No local variant, no page-local override, no new
sentence, chip or count line outside the buttons. Each button carries `data-testid="room-readiness-filter"`,
`data-filter` and `data-active` so a control reads the active state without parsing a class.

The mapping is **pure and exported**, never grepped out of the JSX: `RoomReadinessFilter`,
`ROOM_READINESS_FILTERS`, `roomMatchesFilter`, `roomReadinessCounts`,
`compareRoomNamesNatural`, `roomReadinessFilterEmptySentence`, and `RoomWithBuilding`.
`needs-attention` is exactly the three `needs-*` statuses — the same test the problems
region has always used (`status !== 'ready' && status !== 'unavailable'`) — and **excludes
`unavailable`**, because a store room is not broken, it was never meant for a class. An
unknown filter id matches **nothing** (fail closed), not everything.

**Natural order in every filter.** `compareRoomNamesNatural` uses
`localeCompare(undefined, { numeric: true, sensitivity: 'base' })` on the room name, then the
building name, then the room id, so 2 < 10 < 101 < 102 < 201 and two buildings that both hold
a `G10 Room 101` still order deterministically. The array sorted is the **result of
`rooms.filter(...)`**, i.e. a new array: `buildRoomProblemGroups(rooms)` is handed the
declaration-order array first, and the problems region keeps its own worst-first ordering.
`buildRoomProblemGroups`, `roomProblemSummary`, `getRoomStatus`, `STATUS_COPY`, `StatusIcon`,
the problems-region markup and its `data-testid`s, the per-row `Badge` and every
`data-room-status` are untouched.

**Empty state.** `room-readiness-empty` renders the filter's sentence; `Needs attention` is
the operator's verbatim `No rooms currently marked as Needs attention.` The zero-rooms branch
for the whole card is **kept** (the summary `<p>` still carries the existing
`No rooms yet. Open Edit maps to add the first teaching room.`, and the four-button row is not
drawn over an empty school).

**10.2 — wrapping and inset.** `CampusMapOverview.tsx:722` `truncate` → `break-words`
(`block` and the parent's `min-w-0` kept, `Cap:` badge still `shrink-0`, room-type span
untouched). `RoomReadinessList.tsx:291` got the same treatment — the same defect on the same
list — and the ledger says so; the `Building · N seats` locator line beneath it still
truncates deliberately. `BuildingView.tsx:795` toolbar and `:867` drawing surface both gained
`px-4 md:px-6`; `CampusMap.tsx:52` gained `md:px-6`.

## 5c — `BuildingView.tsx:834` CHECKED AND DECLINED (a reviewer must confirm this)

The operator wrote "also check". Checked. Line 834 is the **room-utilization legend**, not a
room name, and it **keeps `truncate`**. The two tests that decide it are, by name:

1. `a3-c4-map-truth.test.ts` → **"B: the legend sentence is never hover-GATED — both surfaces
   emit the full words in an @/ui surface"** — records decision N2, KEEP `truncate`, because
   the identical complete sentence is already emitted in the `TooltipContent` directly
   beneath the span, so the wording is never truncated-into-ambiguity.
2. `a3-c4-map-truth.test.ts` → **"B: the legend changes no canvas geometry and adds no height
   to any pane"** — pins the toolbar as a SINGLE row whose height is bound by its `h-7`
   buttons, precisely so the three fixed-height callers (500 / 480 / 420) keep their height.
   Wrapping the legend adds a line box to that row and pushes all three stages down.

**What 10.2 *does* fix for that line** is the operator's actual complaint — the legend text
and the `NN%` zoom pill sitting flush against the stage's right border — and `px-4 md:px-6`
resolves it with zero vertical change. I added one assertion to case 2 so the decline is
machine-checked rather than only narrated.

## Why the drawing surface padding is safe (reviewer must confirm)

`BuildingView.tsx:494` is `const w = entries[0]?.contentRect.width;`, and
`setContainerW(Math.floor(w))` drives `Stage width={containerW}`. `contentRect` is the
observed element's **content box**, which by definition excludes padding and border, so the
`px-4 md:px-6` is already subtracted before Konva is told how wide to draw and the Stage still
fits exactly inside the border. Had the code measured `clientWidth` (content + padding), the
Stage would have overflowed the padding by 16px at base and 32px at `md`. The measurement, the
`- 32` in `buildingFitScale`, `HOST_BORDER_PX`, `BUILDING_PAN_PADDING_PX`,
`buildingContentWidth`/`buildingContentHeight`/`clampBuildingPan` and the room-card geometry
constants are all **unchanged**. `setHostHeight` reads the *parent*'s `clientHeight` and the
container gained no vertical padding, so the three fixed-stage callers are unaffected.

**Decision, with its reason (not an omission):** `CampusMap`'s drawing surface (line 93,
`flex-1 overflow-hidden relative bg-slate-50 shadow-inner`) got **no** horizontal padding,
because its `Stage` is a hard-coded `width={920}` inside a `flex-1` box — padding there would
clip the canvas rather than inset it. Its *toolbar* was brought to `px-4 pt-4 md:px-6` so the
two campus maps read as one control row. This is recorded in the source at `CampusMap.tsx:51`.

## `a3-c4-map-truth.test.ts` — what was widened and what was added

Nothing deleted; test B intact; the fabrication/hygiene controls untouched. The exact-match
toolbar regex at old `:491` became `/<div ref=\{toolbarRef\} className="mb-2 flex items-center
gap-1(?: px-4 md:px-6)?">/`, with the superseded form and the reason recorded in the comment
beside it. **Three assertions were ADDED** so the widening cannot remove the height guard
while appearing to keep it: the toolbar's class list is read out and must contain **no**
`py-`/`pt-`/`pb-`/`pl-`/`pr-`/`p-`/`h-`/`mh-`/`min-h-`/`max-h-`; it must carry the operator's
`px-4`; and the drawing surface must carry `px-4 md:px-6`. Plus the case-2 `truncate` pin from
5c.

## Gates run — literal commands and results

`npm run <script>` could not resolve its binaries: this worktree's
`atlas-client/node_modules` is a junction to `D:\ATLAS\atlas-client\node_modules`, and that
donor has **no `node_modules/.bin` directory at all** (the 2026-09-29 junction incident), so
`tsx`, `tsc` and `vite` are unresolvable and `npm run` fails with *"'tsx' is not recognized"*.
Recorded literally, per `AGENTS.md` §11. To run anything I created a **junction inside my own
worktree** at `atlas-client/src/node_modules` → the complete tree at
`E:\ATLAS-worktrees\lane-a9-tl-history\atlas-client\node_modules`, and invoked each script's
exact payload by absolute path. **That junction has been removed**; `git status --short` is
empty of it. No `npm install`, no write into any `node_modules` tree, no change to
`D:\ATLAS`.

| Script | Command actually run (from `atlas-client`, detached + log) | Result |
|---|---|---|
| `test:a9-c6-room-filters` | `node …/tsx/dist/cli.mjs --test src/components/campus-map/__tests__/a9-c6-room-readiness-filters.test.ts` | **17 tests, 17 pass, 0 fail** |
| `test:a9-c3-sections-rooms` | `node …/tsx/dist/cli.mjs --experimental-test-module-mocks --test src/lib/__tests__/a9-c3-review-copy.test.ts src/components/sections/__tests__/a9-c3-guided-home-room-step.test.tsx` | **17 / 17 pass, 0 fail** |
| `test:a3-sections-map` | `node …/tsx/dist/cli.mjs --test src/components/sections/__tests__/a3-sections-map-layout.test.ts …a3-sections-map-picker-occupant.test.tsx …a3-sections-map-home-room-persist.test.tsx …a3-room-picker-uniform-rows.test.tsx …a3-c10-room-picker-anchor-width-names.test.tsx` | **42 / 42 pass, 0 fail** |
| `test:a3-c11-pan-bounds` | `node …/tsx/dist/cli.mjs --test src/components/sections/__tests__/a3-c11-pan-bounds.test.ts` | **7 / 7 pass, 0 fail** |
| `test:a3-c11-campus` (part 1) | `node …/tsx/dist/cli.mjs --test src/components/__tests__/a3-c11-campus-editor-canvas.test.tsx` | **13 / 13 pass, 0 fail** |
| `test:a3-c11-campus` (part 2) | `node …/tsx/dist/cli.mjs --experimental-test-module-mocks --test src/components/__tests__/a3-c11-campus-overview-layout.test.tsx` | **7 tests, 6 pass, 0 fail, 1 skipped** (pre-existing skip) |
| `test:a3-c11-explorer` | `node …/tsx/dist/cli.mjs --experimental-test-module-mocks --test src/components/sections/__tests__/a3-c11-building-explorer-list.test.tsx` | **4 / 4 pass, 0 fail** |
| `test:a3-c11-room-card` | `node …/tsx/dist/cli.mjs --test src/components/__tests__/a3-c11-room-card-pill-and-meter.test.tsx` | **7 / 7 pass, 0 fail** |
| `test:a3-c4-map-truth` | `node …/tsx/dist/cli.mjs --test src/lib/__tests__/a3-c4-map-truth.test.ts` | **11 / 11 pass, 0 fail** |
| `test:a9-c4-map-fit` | `node …/tsx/dist/cli.mjs --test src/components/__tests__/a9-c4-map-fit.test.tsx` | **10 / 10 pass, 0 fail** |
| `test:a3-palette-ratchet-s-e` + `test:a3-palette-token-sweep` + `test:a3-palette-slate400-s-f` + `test:a3-c8-warning-token` (one invocation, four files) | `node …/tsx/dist/cli.mjs --test src/lib/__tests__/palette-ratchet-a3-s-e.test.ts …palette-token-sweep-a3-s-e.test.ts …palette-slate400-step2-a3-s-f.test.ts …a3-c8-warning-token.test.ts` | **37 tests, 36 pass, 1 fail** — see below |
| `typecheck` | `node …/typescript/bin/tsc --noEmit -p tsconfig.json` | **5 errors, 0 in any file I changed** — see below |
| `build` | `node …/vite/bin/vite.js build` | **BLOCKED** — see below |

### `test:a3-c8-warning-token` — 1 failure, PRE-EXISTING, NOT MINE, NOT RE-PINNED

`PINNED_REMAINING_FILES = 66` vs measured **67**. The pin was last set at the A9-C3 integration
boundary on `4f60b5a3`; my base is `7d008db7`. `git diff 4f60b5a3..7d008db7 --
atlas-client/src/pages atlas-client/src/components` shows **3 raw amber lines ADDED by other
lanes**, at least one in a file that was previously clean — which is the +1 file. Proof it is
not this candidate: `git diff 7d008db7 -- <my 4 production files>` contains **0 added and 0
removed lines** matching `(amber|yellow)-[0-9]{2,3}`. **I did not re-pin the literal.** My own
exemption-free re-derivation of the same walk returned 68, not 67, so the two implementations
disagree; raising a pin to 67 would be exactly the "pin that silently reconciles two
disagreeing counts" failure this file's own header documents. This needs an operator/A4
decision on a debt I did not create.

### `typecheck` — 5 errors, all in files I never touched

`3 × TS2307 Cannot find module 'playwright'` (`timetable-post-deploy-c04.test.ts`,
`…-c05.test.ts`, `timetable-scheduling-quality-c03.test.tsx`) — `playwright` is absent from
**both** the donor and the complete tree, so it is not installed on this machine; `1 × TS7006
implicit any` is its consequence; `1 × TS2367` is a real pre-existing error in
`src/lib/__tests__/timetable-truth-labels-a2.test.ts:523`. A `Select-String` over the
typecheck log for `RoomReadinessList|CampusMapOverview|BuildingView|CampusMap.tsx|a9-c6-room-readiness|a3-c4-map-truth`
returns **no match**: the six files this candidate touches are clean. `tsc` compiles the same
TS surface `vite build` would.

### `build` — BLOCKED, environmental, with the exact remedy

```
failed to load config from …\atlas-client\vite.config.ts
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@jridgewell/remapping'
  imported from D:\ATLAS\atlas-client\node_modules\@tailwindcss\node\dist\index.mjs
```

The donor is missing `@jridgewell/remapping` (the complete tree has it), so the Tailwind
plugin cannot be loaded. Vite bundles the config and imports it from a temp file beside
`vite.config.ts`, so its `node_modules` lookup stops at `atlas-client/node_modules` — the
junction I am forbidden to re-point — and no shadow inside the worktree can be reached. A
copy of the config elsewhere would break its own `__dirname`-based `@` alias. **Remedy, for
the operator/A4, not for me:** re-point this worktree's `atlas-client/node_modules` at a
complete install (e.g. `E:\ATLAS-worktrees\lane-a9-tl-history\atlas-client\node_modules`) or
restore the donor, then `npm run build` with `VITE_ENROLLPRO_URL` set (the config's
fail-closed production guard). I set no environment variable and touched no runtime config.
Not "not applicable" — `BLOCKED`, with the reason.

## Pinned counts

**None moved.** `palette-token-sweep-a3-s-e.test.ts`'s `['src/components/campus-map/
CampusMapOverview.tsx', 9]`, `palette-slate400-step2-a3-s-f.test.ts`'s slate-400 table, the
c8 file/line pins and `a3-sections-map-layout.test.ts`'s sub-11px `ROOM_SURFACE_OWNED` sweep
were all left untouched and all pass (or fail pre-existing, above). Deliberately: my
`CampusMapOverview` edit swapped `truncate` → `break-words` on a line whose `text-slate-800`
stayed, and the `BuildingView` / `CampusMap` edits added only `px-4` / `md:px-6`, so no
palette or text-size count was disturbed. **No new sub-11px text was added** (the filter
buttons are `text-xs`), and a control asserts `text-[9px]`/`text-[10px]` stay absent from
`RoomReadinessList.tsx`.

## Risks

- **NON_BLOCKING** — the room list is now **visible by default** where it was behind
  `Show all rooms`. That is the operator's request (`All rooms` is the default), but on a
  103-room school the card is now long by default. It is bounded by the same `compact`
  `max-h-44 overflow-auto` region that governed it before, and it never touches the page's
  root scroll container.
- **NON_BLOCKING** — the filter row governs the **full list only**; the problems region above
  is deliberately unfiltered (it is already only the broken buildings). A user could expect
  the whole card to narrow. Recorded as a scope decision, and asserted.
- **NON_BLOCKING** — `a3-c8-warning-token`'s pin is red at my base (see above). Operator
  decision, not a candidate defect.
- **NON_BLOCKING** — the environment cannot run `npm run`, `build`, or a `playwright`-dependent
  check. Every test above ran from the real source; only the *invocation path* was substituted,
  recorded literally.
- **BLOCKING for a release, not for review** — no rendered evidence on a live or staging
  origin was gathered: this cycle is source-only and the packet does not carry deployment
  authority. A reviewer or QA with a browser should view `/map` before release; `All rooms`,
  `Needs attention` and the empty sentence are the three states to look at, at 1366x768.

## Residue

`git status --short` after staging shows only the 7 intended paths (6 modified + 1 new test
dir). `git stash list` — I created no stash; the four entries visible in the shared repo
belong to other branches and cycles and predate this session. Nothing was written under
`D:\ATLAS` (its `node_modules` still holds 138 package directories, unchanged).
