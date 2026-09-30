# A9 — Sections & rooms, operator docx (`section.docx`), 2026-09-30

**Role for the implementer:** `atlas-executor-ds-delegate` (DeepSeek V4.1 Flash, variant **high**, 160 steps).
**Planner:** A9 (primary planner, this cycle). **QA:** fresh `atlas-qa-ds-delegate` over the frozen range — not you.

## Boundary

| | |
|---|---|
| Base SHA | `69b404fff7ec37173d34fab6305cfb44f3368a53` (`origin/main` tip at authoring) |
| Worktree | `E:/ATLAS-worktrees/lane-a9-docx-sections` |
| Branch | `work/a9-docx-sections` |
| Scope | **`atlas-client/**` only.** No `atlas-server/**`, no `prisma/**`, no schema, no migration, no env, no runtime, no deploy, no live/shared-database write. |
| Commits | **ONE candidate. SIX commits, one per item, in the order below.** |
| Do not touch | `D:/ATLAS/**` (denied), `docs/plans/live-state.md`, `CHANGELOG.md` (the integration owner consolidates those) |
| Disposition | `KEEP_ACTIVE` until the planner has integrated; **do not remove any worktree, ever** |

### Dependencies — read this before running anything

`atlas-client/node_modules` in this worktree is a **junction** to the shared donor
`E:\ATLAS-worktrees\lane-a5-c3-20260929\atlas-client\node_modules` (156 entries, verified at authoring).

- **Never run `npm install`, `npm ci`, `npm update`, or any package manager in this worktree.** An install writes
  *through* the junction into another lane's live dependency tree.
- **Never run `git worktree remove`** on this or any worktree — a bare removal follows the junction and empties the
  donor (this has already happened once, 2026-09-29, 156 entries → 0).
- If a dependency is genuinely missing, **stop and report it**; do not install.

## Why this cycle exists

The operator's own review file is `section.docx` (repo root, untracked; six numbered items, each with a screenshot).
Lane C's 30 Sep 02:40 checkpoint records the dispatch wording verbatim:
`a9-ds-sections (badges dark, room text full, remove Browse room map, drawer -> normal-width dialog, rotation row,
Apply rooms receipt + Undo)`. That is the item order below. I extracted the screenshots; the "now" quotes below are
read off the operator's own images, so they are the real surface, not a guess.

Two locked operator decisions bind this cycle and **override the docx wording where they conflict**:

- **#10 (30 Sep 02:15):** dialogs open at a **normal centred width (about 42 rem), never near full screen**;
  resizing is optional.
- **#11 (30 Sep 02:15):** **no second confirmation after a review dialog** — applying saves at once with a plain
  receipt and Undo. *(This supersedes docx item 4's "confirmation modal".)*
- **#5:** every automated action leaves a **plain receipt** on the action page *and* the affected page —
  what was done, how many, what was **not** done and why, next step (`docs/plans/codex-walk-standard.md`).
- **#6:** presentation outranks function; a UX regression blocks the train.

Read `docs/plans/operator-decisions.md` before you start. A commit that reverts a line there is a failed commit.

---

# The six items, in order

## c1 — `fix(sections): program badges are solid and dark, with white text`

**Operator (item 6):** *"change the color style of the badge (BEC, STE, SPA, SPS). Currently it is in a lighter color
and low opacity … follow how the color is in the 2nd image (having darker background with white text)."*

**Now (operator's screenshot, `/sections` row sub-header):** `Bonifacio` carries `STE` and `Mabini` carries `SPS` as
pale chips — `bg-emerald-50 text-emerald-700 border-emerald-200` / `bg-orange-50 …` — sitting beside the emerald `GR7`
grade badge; at that strength the program badge reads as part of the grade badge. `Aguinaldo`/`Luna` carry no badge at
all, only the grey caption `REGULAR PROGRAM`.

**Where:** `atlas-client/src/components/sections/SectionRow.tsx` — `PROGRAM_BADGE` (≈32–40) and the badge render
(≈133–139, note `border-opacity-50`).

**After:** every program badge is a **solid dark fill with white text** (`bg-emerald-600 text-white border-emerald-700`
class), one distinct hue per program, visibly stronger than the grade badge and never confusable with it. A regular
section shows a **`BEC`** badge — the locked vocabulary already ships in `src/lib/subject-constants.ts`
(`{ value: 'REGULAR', label: 'BEC' }`) — and the badge, not a second grey caption, is the row's program signifier
(subtract the duplicated caption; keep a spelled-out special-program name only if removing it loses meaning).

**Hard limits:** the stored value stays `REGULAR` (no schema, no API change). White-on-fill contrast ≥ 4.5:1.

**Acceptance (rendered, 1366×768, `/sections`):** a BEC row, an STE row and an SPS row are each visible; each program
badge is dark-with-white; the grade badge is clearly a different object. Quote the before/after and keep a screenshot.

---

## c2 — `fix(sections): the home-room dropdown shows the room name in full`

**Operator (item 3):** *"notice the text inside of dropdown, adjust the container so that the text will be full to
read."*

**Now (operator's crop, exact text):** the trigger reads
`G7 Room 101  - Grade 7 Academic V`
— clipped mid-word; the building name `Grade 7 Academic Wing` is cut. The row also spends its right-hand gutter on a
second, separately truncated label (`same grade wing`).

**Where:** `atlas-client/src/components/sections/HomeRoomAutoAssignDialog.tsx` — the per-row room `Select` inside the
`Give every section a home room` dialog.

**After:** the trigger's container is wide enough that a normal room + building label reads **in full** at 1366×768 and
1280×720, without widening the dialog past operator decision #10. **Subtract first:** the row's slack currently goes to
the redundant right-hand gutter label — take the width from there, do not grow the dialog and do not shrink the type.

**Acceptance:** rendered screenshot of the open dialog at 1366×768 quoting the trigger text in full
(`G7 Room 101 - Grade 7 Academic Wing`) with the dialog still inside its normal width.

---

## c3 — `feat(sections): remove the school-wide Browse room map control`

**Operator (item 5):** *"should we just remove browser room map because each section has button directing to the map
but dedicated to specific section"* → **yes.**

**Where:** `atlas-client/src/pages/Sections.tsx` `secondaryActions` (≈778–789, the `MapIcon` + `Browse room map` /
`Rooms` button), its state `globalBrowseModalOpen` (≈129), and the global-browse `SectionRoomMapModal` mount in
`SectionsHomeRoomMapModals.tsx` (`globalBrowseOpen`, the `sectionId=0` / `canWrite=false` instance).

**After:** the header control and its state are gone. The **per-section** room map (row → `View room map` → `mapTarget`,
which writes through the same confirm path) is untouched and still works. If, after removal, the global-browse mount has
**no opener anywhere**, prove it (`grep -rn "globalBrowse" atlas-client/src`) and remove that mount and its prop too —
dead code is subtracted, not parked. If an opener survives, keep the mount.

**Do not** touch `SectionRoomMapModal`'s shell: `a3-sections-map-layout.test.ts` pins
`h-[90vh] flex flex-col p-0 overflow-hidden` and its self-scrolling `ScrollArea`.

**Acceptance:** rendered `/sections` header with no map control; grep output proving no remaining opener; the row map
still opens.

---

## c4 — `refactor(sections): section details open as a centred dialog, not a drawer`

**Operator (item 1):** *"currently it is a drawer. Make this as a modal at the center of the page."*
**Operator decision #10:** normal centred width, **about 42 rem, never near full screen**; resizing is **optional**.

**Now:** `atlas-client/src/components/sections/SectionDetailsSheet.tsx` opens from the row's `DETAILS` control as a
right-side `Sheet` (`<SheetContent className="w-full overflow-y-auto sm:max-w-xl">`).

**After:** a centred dialog at about 42 rem, both side gutters visible at 1366×768, internal scroll for long content,
same props/API to `Sections.tsx`, same facts on screen (grade + program chips, home room, building, assigned/unassigned
counts, the class list, and the `Manage Section Teaching Load` link). Decision #10 makes resizing optional: build the
fixed normal width properly; add resizing only if it costs nothing extra — a harder-than-full-screen dialog is a
**failed** item even if it is resizable.

**Limits:** no new text below 11 px; this file is owned by the sub-11 px ratchet and is in the palette sweep's scope
(see controls).

---

## c5 — `refactor(sections): unassigned classes read per term, and read cleanly`

**Operator (item 2):** *"after making it as a modal, notice the unassigned classes. Improve the UI. Maybe do it per term
instead of per subject if that is better."*

**Now (operator's screenshot):** the dialog's `UNASSIGNED CLASSES` list is flat, one row per subject, and reads
raggedly — `MAPEH` printed twice (name over code), then `SCIENCE`/`TERM 2`, `SCIENCE`/`TERM 3`,
`TLE_ROTATION`/`TERM 2`, `TLE_ROTATION`/`TERM 3` as violet pills, each with `225 min` right-aligned.

**Where:** `SectionDetailsSheet.tsx` ≈284–322 (the list, plus `resolveRotationTermLabel`, which already resolves
`rotationTermLabel`/`rotationTermRank`).

**After:** a calm, scannable list. Group the rows **by term** where the data carries a rotation term, with a term
heading and the classes beneath it; collapse the duplicated name/code pair to one line; keep the rotation family as a
cue; keep `min …/week` right-aligned and keep the `UNASSIGNED` tile count truthful. If term-grouping is genuinely
worse on the real data, keep one list but make every row read cleanly — **say which you chose and why** in the layout
note. Either way the operator's `MAPEH MAPEH` duplication is gone.

**Limits:** identical to c4 (≥11 px text; the same ratchet, type-scale pin and palette-sweep controls).

---

## c6 — `feat(sections): applying rooms leaves a plain receipt with Undo`

**Operator (item 4, docx):** *"create a confirmation modal when clicking the 'apply rooms' button."*
**Operator decision #11 (later the same night, and it wins):** *"No second confirmation after a review dialog:
applying saves at once with a plain receipt and Undo."* → **do NOT add a confirmation modal.**

**Now:** `HomeRoomAutoAssignDialog.tsx` — `Apply these N rooms` PUTs the whole reviewed set in one call
(`/sections/home-rooms/:schoolYearId`, `apply()` ≈279–306) with no confirm step, and already sets a sentence from
`saveOutcomeSentence({ requested, updated })` and passes it to `onNotice`.

**After:** three things, all in this commit:
1. **Save at once** — no second dialog, no second click beyond Apply.
2. **A plain-words receipt** on the action page *and* on the page whose data changed (`/sections` via `onNotice`):
   what was done, **how many**, what was **not** done and why (the `result.skipped` rows), and the next step —
   the receipts rule in `docs/plans/codex-walk-standard.md`. Plain words, no codes, no jargon.
3. **Undo**, one click, offered while the receipt is on screen: it states what it will do before doing it, writes the
   previous rooms back through the **same** endpoint, cannot double-submit (disabled in flight), and leaves its **own**
   receipt. The endpoint already accepts `homeRoomId: null` (proved by
   `atlas-server/src/__tests__/section-route-authority-c01.test.ts` E2/E7), and this dialog only ever assigns sections
   that had **no** room (`overwriteExisting: false`), so Undo is a PUT of `homeRoomId: null` for exactly the sections it
   assigned.

**If Undo cannot be reached without a server change, STOP and report `BLOCKED` with the exact evidence** — do not fake
it, do not add a server change, and do not widen this commit. (A9 c7 disclosed that choosing `Unassigned` in the *row
picker* dispatches nothing; if that is the same defect and it blocks Undo, report it as `BLOCKED` and scope it out.)

---

# Rules for every commit

- Stage **only** the paths you changed; `git diff --cached --check` before each commit; one conventional message per
  item, in the order above.
- **A test no gate runs is not evidence.** Any new or changed test file must be reachable from a committed
  `atlas-client/package.json` script **in the same commit** (extend `test:a9-c3-sections-rooms` or add a script).
- **Design before code.** Write a short layout note (what stays, what goes, what moves) and check it against `AGENTS.md`
  §8 (no global scrollbar, `@/ui` primitives only, no raw `<details>`/`title`, DepEd grade colours, ≤1000 lines per
  component) before writing JSX. `Sections.tsx` is 987 lines and `SectionRoomPicker.tsx` is 998 — **extract a
  sub-component rather than grow either one.**
- Keep every existing rendered fact and every existing control that the operator did not ask you to remove.
- Do not push, do not merge, do not deploy, do not run generation/publication, do not touch the shared 5001/5174 runtime.

## Preservation controls (all must run green at the tip, and be reported with their real tallies)

```
npx tsc --noEmit
npm run build
npm run test:a3-sections-map
npm run test:a3-c4-sections
npm run test:a9-c3-sections-rooms
npm run test:a9-c6-room-filters
npm run test:ux-type-scale-a7c8
npm run test:a3-palette-token-sweep
npm run test:a3-palette-ratchet-s-e
npm run test:ux-guardrails
```

- **Sub-11 px ratchet** (`a3-sections-map-layout.test.ts`): every owned file — including `Sections.tsx`,
  `SectionDetailsSheet.tsx`, `SectionRow.tsx`, `HomeRoomAutoAssignDialog.tsx`, `SectionRoomPicker.tsx` — must hold
  **no authored text below 11 px**. `text-[0.6875rem]` is exactly 11.0 px and is legal; anything smaller is a failure.
- **Type-scale pins** (`a7-c8-type-scale.test.ts`) — measured counts, updated **only** if your change moves them, in the
  same commit, never deleted: `SectionDetailsSheet.tsx|text-[0.6875rem]` = 11 · `SectionDetailsSheet.tsx|text-[0.7rem]` = 2
  · `SectionRow.tsx|text-[0.6875rem]` = 5.
- **Palette sweep** (`palette-token-sweep-a3-s-e.test.ts`): `SectionDetailsSheet.tsx` is IN_SCOPE and must hold **zero**
  `text-slate-900` and **zero** `text-slate-500`. Do not introduce raw neutrals there.
- **Zero-write control** (`a3-sections-map-home-room-persist.test.tsx`): Cancel dispatches zero PUT.
- **Global scrollbars**: no new global scrollbar (`global-scrollbars-c01` is covered by the suites above).

## Rendered evidence (mandatory — *done means seen*)

For each of c1–c6 that changes what is on screen, a **built** loopback render at **1366×768** with the before/after
quoted in words, saved under `docs/reviews/a9-sections-docx-20260930/`. A source-only assertion is not acceptance
evidence for a user-facing change.

**Loopback safety (AGENTS.md §5, non-negotiable):** a preview must talk to the **staging** API —
`VITE_ATLAS_API=http://127.0.0.1:5101` — never the default `127.0.0.1:5001` (live). Start any preview with
`Start-Process -WindowStyle Hidden -PassThru`, poll the port with a cap, run the walk, then `Stop-Process` that PID in
the **same** command. **Never** run a preview/dev server as a foreground command.

## Report back (≤ 8 lines plus one handoff page)

`docs/handoffs/a9-sections-docx-20260930-executor.md`, and your final message states: candidate SHA · per-item commit
SHAs · the exact commands actually run with their results · the rendered rows with their before/after quotes · any
`BLOCKED` row with its evidence · worktree disposition. Keep the handoff to one page; put the images and raw output in
the evidence directory and link them, do not paste them.
