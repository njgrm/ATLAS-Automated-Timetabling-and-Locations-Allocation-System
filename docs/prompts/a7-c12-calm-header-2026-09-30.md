# A7 c12b — the calm Class Schedule header, one vocabulary, and the Setup-card year bug

**Role / model.** Executor: `atlas-executor-ds-delegate` (reasoning variant **high** — multi-file user-facing
composition with a data-source defect). Planner: A7, high. QA: fresh `atlas-qa-ds-delegate` (high), read-only,
range-only.

**Cycle id.** `a7-c12-calendar-header-20260930` (c12b). **Owner (one writer):** A7 executor in
`E:/ATLAS-worktrees/lane-a7-c12-calm-header`, branch `work/a7-c12-calm-header`.
**Base SHA:** `a93e4785b11bc97a7d887cd24f9183a346360712` (`origin/main`, the decision-8 approval commit).
**Risk tier:** MEDIUM — user-facing production composition + copy, **client-only** (no server, no auth, no API,
no data, no route-target change).

**Governing sources (read them; they are the specification, not background).**
- `docs/plans/operator-decisions.md` — **decision 2** (tabs stay, Expert view retired, one vocabulary, ≤7 controls
  above the grid, only A7 edits this layout/words; guard = A7 rendered control-budget test) and **decision 8**
  (the proposal is approved as written; the unplaced label is **"N classes need a time slot"**).
- `docs/handoffs/lane-c-to-a2.md`, post **"A7 -> Lane C, proposal — Step 0, the calm Class Schedule page"** —
  the per-tab/per-panel proposals and the **27-row word table**. That table IS the copy spec.
- `docs/prompts/timetable-calm-2026-09-29.md` — the operator's words and the CORRECTION (items 1-5).

## Intent (write this at the top of your layout note, before touching JSX)

The user is an older, mouse-first scheduler on `/timetable` at 1366x768. Their task on this screen is to see the
state of the draft and take one obvious next step. What must feel different: **calmer** — one row of controls, one
status chip, one primary action, one plain sentence when the year changed. Subtracting is the goal; meeting a row
count by cramming is a failure. Every change below must remove at least as much as it adds (§8, §11 design gate).

## Deliverables

### D1 — Header composition (`/timetable`, Simple mode)

Entry point: `atlas-client/src/components/timetable/TimetableSimpleHeader.tsx` (root
`data-testid="timetable-simple-header"`; `TimetableSubNavRow` renders **inside** it at line ~709), with
`simple/SimpleHeaderHelpers.tsx`, `simple/SimpleHeaderActions.tsx`, `simple/SimpleMoreMenuContent.tsx`,
`simple/SimpleHeaderTrailingSurfaces.tsx`, `simple/SimpleChangeNotice.tsx`, `TimetableSubNav.tsx`, `AppShell.tsx`.

1. **Budget: at most 7 interactive controls above the grid.** The counted region = the rendered
   `[data-testid="timetable-simple-header"]` subtree **plus** the app-shell rollover notice
   (`[data-testid="rollover-awareness-notice"]`). Excluded from the count: the page title and the tab row
   (`TimetableSubNavRow`) — decision 2 keeps the tabs. Expected inventory on the Schedule tab with no draft:
   the status chip, `Generate a draft`, `More`, `Term`, `Show`, `Schedule for` (=6) + the banner's single link
   (=1) = **7 exactly**. Any 8th control fails.
2. **Tabs stay** — Schedule · Draft · Setup · Policies · Runs. `TimetableSubNav.tsx:36` label `Planning` becomes
   **`Draft`** (key/route unchanged: `/timetable/pre-generation`). Expert **view** (the switch) is retired: no
   user-visible route or switch to it remains.
3. **Delete** the standalone sentence `Setup inputs are not ready` from the control row (it becomes the `Generate`
   Tooltip text only if the primitive already supports it; do not touch tooltip styling/geometry).
4. **More menu** (`simple/SimpleMoreMenuContent.tsx`): delete the whole **`Expert tools` group** (line ~280,
   `expertToolCount`) and its entries `Expert view`, `Advanced rules`, `Review issues`, `Schedule history`
   (Policies is still the tab; readiness owns issues; the status chip carries history counts). Keep the other
   groups. Add a `Past years` item to the More menu pointing at
   `/teaching-load/history?schoolYearId=<previousSchoolYearId>` when a rollover notice exists (this is the
   proposal's "Moves to More: View past years"); hide it when there is no previous year.
5. **Year banner becomes one status-line sentence with one link.** In `AppShell.tsx` (~line 562) the
   `rollover-awareness-notice` collapses from a band with `View past years` + `Year Setup` + a dismiss `×` to
   **one `role="status"` sentence with exactly ONE interactive element**: the link **`Year Setup`** →
   `/admin/year-setup`. Sentence words stay truthful and unchanged except that the trailing sentence
   `This page refreshed with the new active year.` may be dropped if the line then reads as one sentence.
   Activating the link also clears the notice (`clearRolloverAwarenessNotice(actorSchoolId)`) — dismissal is
   preserved in effect; the 14-day TTL (`ROLLOVER_NOTICE_TTL_MS`) remains the backstop. Record this trade-off in
   the layout note as a design decision with its reason.
6. `simple/SimpleTutorial.tsx` must not point at a removed surface: any user-visible text naming
   `Expert tools` / `Expert view` is updated to the surviving location or removed. No new control is added.

### D2 — One vocabulary: the 27-row word table

Implement every row of the table in the Step 0 post that is **not** marked `keep`, at the named file:line. The
`Swept and already correct` list must not be touched. **Decision 8 overrides row 25**: the unplaced wording is
**`N classes need a time slot`** (singular `1 class needs a time slot`), everywhere it appears (More menu,
unplaced list, chips). Highlights that must be exact:

- tab `Planning` → `Draft`; `Generate when ready` / `Start draft` / `Try generating again` → `Generate a draft`;
  `Build a new draft` → `Generate a draft` with success `Draft ready`;
- `Reset the draft schedule?` / `Reset draft` → `Discard this draft?` / `Discard draft`;
- `Generated schedule · run N` → `Draft · run N`; `Generated — issues to review` / `Generated — ready to review`
  → `Draft — …`; every denial/nav `Generate a timetable` → `Generate a draft`;
- empty states: Schedule `No draft yet. Generate one to begin.`; Draft `Draft · nothing placed yet`;
  Runs `No drafts yet for this school year.` / `Drafts and published schedules appear here.` (delete the
  duplicate `Runs - read-only history` sub-row); Setup `No draft yet for <active year>`;
- More: `Publish schedule` → `Publish`, `Unassigned sessions (N)` → `N classes need a time slot`, `No generated
  schedule yet.` → `No draft yet.`;
- exports: `… one Draft (or the Published schedule) and one term …`, buttons keep `Download …`;
- Login/landing row 26.

**Rows that say `keep` must remain** and are asserted unchanged by the copy test.

### D3 — Setup card active-year bug (row 13, `live-03-setup-tab.png`)

Today the Setup tab can print `No 2025-2026 timetable yet` while the header chip says `2026-2027`. Both surfaces
must name the **active** year **from one source** — the workspace's `schoolYearContext.activeSchoolYearLabel`, the
same value the header chip uses. Remove any second/derived year source on that path. Production entry points:
`simple/SimpleHeaderHelpers.tsx:81` (`readinessLabel`) and `:799`, `simple/SimpleSetupSharedControls.tsx`
(`SimpleReadinessChip`), `TimetableSetupPane.tsx`. The greeting/order of the sentence becomes
`No draft yet for <active year>` (row 13).

## Tests (tests first — commit 1 must be the failing tests)

1. `atlas-client/src/components/timetable/__tests__/a7-c12-calm-header-budget.test.tsx` — the **rendered
   control-budget guard** (decision 2). Render the real `TimetableSimpleHeader` (use the `renderToStaticMarkup`
   technique and the itemised why-notes already proven in
   `__tests__/a2-header-budget-2026-09-29.test.tsx` — copy its harness rather than inventing one) plus the real
   rollover notice. Rows: (A) the header's counted-control inventory equals the exact named list and is ≤6;
   (B) the banner has exactly 1 interactive element (`a[href]` → `/admin/year-setup`, text `Year Setup`) and 0
   buttons; (C) the composite budget number is ≤7. **Pin the counting method in the test**: the selector set,
   the excluded regions (title, tab row), and the state fixture. A test that counts a different set must be a
   different named row.
2. `atlas-client/src/components/timetable/__tests__/a7-c12-calm-copy.test.tsx` — the **copy test**: for each of
   the 27 rows, the real rendered surface shows the new words and does not show the old ones (`keep` rows show
   their current words). Includes: the tab reads `Draft` and never `Planning`; More renders no `Expert tools`
   group; `N classes need a time slot` exact (decision 8); and the **D3 adversarial control** — a fixture where
   the Setup pane's year input disagrees with the header's active-year label, asserting the active year wins and
   the stale label never renders (this row must fail on the base).
3. Add the gate: in `atlas-client/package.json`,
   `"test:a7-c12-calm-header": "tsx --max-old-space-size=6144 --test src/components/timetable/__tests__/a7-c12-calm-header-budget.test.tsx src/components/timetable/__tests__/a7-c12-calm-copy.test.tsx"`.
   A test no script runs is not evidence (§11).
4. Two existing suites assert the surfaces you are removing — update them **additively**: mark the superseded
   assertion in place with a `SUPERSEDED (A7 c12b, decision 8 / CORRECTION item 1)` comment naming the decision,
   and add the replacement assertion beside it. Do not delete the old claim (§16):
   `__tests__/timetable-more-menu-a2.test.ts` (~line 350 `['Expert tools', 'expertToolCount']`) and
   `__tests__/a2-c11-draft-actions-correction.test.tsx` (~line 876).
5. Preservation suites to run and report (each: command + pass/fail counts): `test:ux-a2-header-budget`,
   `test:a2-ux-menu2-c2`, `test:ux-a2-c11-draft-actions`, `test:a2-c11-s2-header`, `test:draft-ux-c01`,
   `test:timetable-relaxed-main`, `test:ux-audit-findings`, `test:client-quality`, `test:ux-guardrails`,
   `npm run typecheck`, `npm run build`. Run them from the junctioned `atlas-client` with
   `.\node_modules\.bin\tsx` (a bare `npx` resolves a foreign tsx and a foreign package set — observed at this
   worktree's creation).

## Boundaries (hard)

- **Do NOT touch tooltips.** `atlas-client/src/ui/tooltip.tsx` and the call-site `className` sweep owned by
  c12a (`work/a7-c10-calm`, `aec13de2`) are out of scope. Your tip must not contain those paths.
- **Do NOT change any generation gate.** Decision 1 stands: Generate is never greyed out by problems. Label
  strings inside `lib/timetable-capabilities.ts` may change (rows 17, 20-22); its `enabled`/`disabled`
  decisions, `deriveTimetableCapabilities`, readiness predicates and A8 c5's table must not move by one byte of
  behaviour. The A8 c5 suite must still pass unmodified.
- **Client only.** No `atlas-server/**`, no prisma, no routes, no API, no auth, no DB, no runtime, no
  companion repo, no migration, no generation, no publication.
- Do not edit `docs/handoffs/lane-c-to-a2.md` (planner-owned) and do not edit `docs/plans/operator-decisions.md`.
- No `it.only` / `test.only` / skipped rows; no removed assertions; `git status --short` empty at the tip;
  `git stash list` empty.

## What to return (one handoff, ≤1 page)

`Base SHA · candidate SHA · exact changed paths · the layout note (what stays, what goes, what moves behind More,
and why) · the decisive commands actually run with their results (counts, not adjectives) · the failing-first
evidence: the commit where the new tests fail and the literal assertion text that failed · known risks each marked
BLOCKING or NON_BLOCKING · verdict`. Push the branch. Worktree disposition: `KEEP_ACTIVE` until integration, then
`RETIRE_AFTER_INTEGRATION` (junction `rmdir` first).

## Correction R1 (fresh QA, `a93e4785b..899cbd2e`)

Fresh independent QA over `a93e4785b..899cbd2e` returned **CORRECTION_REQUIRED, mandatory 12 / passed 9 /
blocked 0 / unperformed 0** with three blocking findings. This correction is ADDITIVE and bounded to them; no
other behaviour, string, layout or gate moves. Each remedy is appended to the existing copy test
(`__tests__/a7-c12-calm-copy.test.tsx`); no third test file is created.

- **C1 (B1) — row 13 only partially fixed; a second year source on the same screen.** QA found
  `AppShell.tsx:556-559` renders `Active year: {activeYearLabel}` fed from `resolveActiveSchoolYearContext(...)`
  at `AppShell.tsx:187`, while the timetable chip derives its year from
  `schoolYearContext.activeSchoolYearLabel`. **Determination, with evidence (branch (a)):** there is exactly ONE
  persisted authority and ONE field behind both surfaces — the resolver `resolveActiveSchoolYearContext` in
  `@/lib/enrollpro-public-settings`, which reads/writes the per-`schoolId` entry via
  `readCachedActiveSchoolYear` / `cacheActiveSchoolYearContext`, field `activeSchoolYearLabel`. Both call sites
  are named: `AppShell.tsx:177` (the badge) and `useTimetableData.ts:1394-1417` (the workspace's
  `schoolYearContext`); the Step-0 divergence was cache *freshness* inside that one authority (the shell
  verifies with `forceRefresh:true`, the timetable `preferCache`s), not a second authority. **Remedy:** add the
  one shared stringifier `resolveActiveYearLabel(context)` and route AppShell's badge through it; extract the
  badge to `components/app-shell/ActiveYearBadge.tsx` (words/placement/role byte-identical) so it is renderable;
  pin, in the copy test, that the badge and the chip name the same `activeSchoolYearLabel` from one context and
  that AppShell has exactly one year-label source. Residual (recorded, NON_BLOCKING): the two surfaces remain
  two React subscribers of the one authority, so a refresh window can show a stale label briefly; full
  reconciliation would need a shared runtime store, outside this bounded correction.
- **C2 (B2) — decision-8 wording not universal.** `N classes need a time slot` existed only at
  `simple/SimpleHeaderActions.tsx:390`. **Remedy:** `lib/timetable-plain-language.ts`
  `classesNeedingTime` now yields `1 class needs a time slot` / `N classes need a time slot` (so the
  generation-outcome toast `:705`, the generation notification `:720` and the publish-checklist sentence `:734`
  all follow); `publishBlockedSentence` `:108` uses the same function; `lib simplePublishReadiness.ts:706`
  becomes `needing a time slot`; `SimpleTutorial.tsx:118` says `need a time slot`. The copy test asserts
  `need a time` **not followed by ` slot`** appears in none of the strings it produces or renders.
- **C3 (B3) — old vocabulary survives.** `Generate a timetable` → `Generate a draft` at
  `SimplePublishReadinessSheet.tsx:239`, `simple/SimpleTaskDrawerHelpers.tsx:294`,
  `lib/simplePublishReadiness.ts:715`, `hooks/useTimetableData.ts:127`; a `git grep` confirms no other
  non-test user-visible hit.
- **C4 — in-workspace leftovers (NON_BLOCKING).** `TimetableTaskDrawer.tsx:110` title and
  `TimetableSimpleHeader.tsx:605` move to the `classes … a time slot` vocabularly.
  `ScheduleReviewWorkspaceHeader.tsx:390` is user-visible (reachable when a stale stored `advanced` layout is
  restored), so `Planning draft` → `Draft`; `Draft planner` is already Draft-consistent. **OUT OF SCOPE,
  recorded not changed:** `pages/Dashboard.tsx:668`, `pages/HowItWorks.tsx:72`,
  `components/campus-map/CampusMapOverview.tsx:324`, `components/dashboard/CampusReadinessCard.tsx:302`
  (other lanes' pages).
- **C5 — housekeeping.** The QA worktree/junction/donor count are the planner's; not touched.
- **C6 — close out.** Re-run the two acceptance files, every named preservation suite, typecheck and build;
  re-baseline newly red suites against `cd06734c` before classifying; commit additively and push.
