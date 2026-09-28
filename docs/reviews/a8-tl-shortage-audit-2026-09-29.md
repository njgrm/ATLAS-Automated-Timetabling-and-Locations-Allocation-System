# A8 — read-only source audit: does Teaching Load help a short-staffed scheduler?

Base `57a2be20`; `83bb21f3` (Lane C's staging walk) is docs-only — 0 files changed under `atlas-client/` or
`atlas-server/` — so every line holds at HEAD. No code, DB, server or browser action taken. Corroborates
`docs/reviews/codex-staging-shortage-ce1257c8/report.md` (4/10, "before 25 → after 25"). `TLA` = `atlas-server/src/services/teaching-load-automation.service.ts`.

## 1. Strategies — one handler, three modes, and the 40h mode ignores `maxHoursPerWeek`

- Modes are `CoverageMode` (TLA:83-86); labels `atlas-client/src/lib/teaching-load-helpers.ts:100-113`. The shipped
  default is `REAL_FACULTY_THEN_TEACHER_X` (`useTeachingLoadUI.ts:63`) — plain `useState`, never persisted. All three
  modes share one selector (TLA:1734) and one guard (TLA:1811-1812); least-loaded is a ranking tie-break only
  (TLA:1493-1538, 1910-1932). Constants: `scheduling-policy.service.ts:126,128` (`1800`/`2400`).
- `resolveRealFacultyCapMinutes` (TLA:668-676): the 30h mode (`:670`) is `min(maxHoursPerWeek*60, STANDARD_CAP_MIN)` —
  correct. The 40h mode (`:671`) is `: HARD_CAP_MIN` and **never reads `maxHoursPerWeek`**. So yes: a 30h teacher gets a
  40h budget in both `REAL_FACULTY_HARD_CAP` and `REAL_FACULTY_THEN_TEACHER_X`. `canTeachOutsideDepartment` is not a
  filter but a qualification *widener* (TLA:1311-1313, tier 3).

## 2. Temporary substitutes are preview-only and can never be saved

- Synthesised TLA:3194-3208 with `facultyId: null`; stripped from the plan at TLA:2307-2315 (falls through both
  `KEPT_EXISTING` and `REAL_TEACHER`); apply writes only `plan.inserts`
  (`teaching-load-suggestion-proposal.service.ts:351-355`). **No client path persists them.** The headline then lies:
  TLA:3116 forces `finalUnresolved = 0` in Teacher-X mode, so the page reads complete while the same modal lists
  substitute rows — Lane C's "after 25". Generation then emits one `TL_DEMAND_UNCOVERED` blocker **per uncovered pair**
  (`generation-preflight.service.ts:967-980`). The one path that *does* save placeholders, `POST
  /faculty-assignments/coverage/repair` (`faculty-assignment.router.ts:437-471`), has **zero client callers**.

## 3. Placeholders: excluded from suggestions, accepted by the generator

- Never suggested: TLA:2611 `filter(m => !m.isPlaceholder)`, re-checked at apply
  (`teaching-load-suggestion-proposal.service.ts:417`). **The generator has no `isPlaceholder` filter at all** (0 hits in
  `generation-preflight.service.ts`; the owner check at `:557-562` tests only stale/active), so a *saved* placeholder
  unblocks generation while a substitute row does not. Creation stores department/specialization/hours but **no
  `facultySubject` row** (`faculty.service.ts:883-923`; `CreatePlaceholderDialog.tsx:127-136`, `DEFAULT_SCHOOL_ID = 1`
  hardcoded at `:23`), so a hand-made placeholder can never be auto-assigned.

## 4. Shortage visibility is per **department**, not per subject

- Server buckets by department (TLA:949-997, 1078-1089, 1175-1187); capacity is tracked per *faculty* (`:1007-1016`),
  never per subject. Rendered only in the preview modal — `AutoFillSummaryModal.tsx:453` `Detailed Shortage
  Drill-Down`, whose `:454` reads **`{report.shortages.length} Subjects Affected` over a department-keyed array**.
  Strings: `Unassigned Classes` (`:371`), `Weekly Teaching Shortage` (`:383-385`), `Target ~{n} full-time hires…` (`:533`).

## 5. Levers: almost all data-only

- `maxHoursPerWeek` and `canTeachOutsideDepartment` — **placeholder dialog only**
  (`CreatePlaceholderDialog.tsx:262-286, 289-296`); `faculty.service.ts:868-914` accepts hours for anyone, the client
  just never sends it for a real teacher. Subject qualification — **no per-teacher control** (only
  specialization→subject mapping, `SpecializationMapping.tsx:434-441`). Strategy picker is rendered
  (`WorkspaceToolbar.tsx:633-641`) but session-only state. 30h/40h caps — `PUT /policies/scheduling/:schoolId/:year`
  exists and the client pane calls it (`scheduling-policy.router.ts:45-65`, `SchedulingPolicyPane.tsx:230`), but
  `policyPaneModel.ts:20-60` has **no field for any of the three**, so a policy save can **silently reset 1800/300/2400**.

## 6. Why generation says 5 over-limit and Teaching Load says none — four definitions

- **Generator** (`constraint-validator.ts:796-802`): raw placed minutes, peak-term rollup, vs `maxHoursPerWeek*60`, with
  the cap already shrunk by ancillary and `Math.floor`ed (`generation-preflight.service.ts:1394`) — a 30h teacher trips
  1800. **TL truth panel** (`teaching-load-reconciliation.service.ts:1284-1288`): `minMinutesPerWeek` with peak-term lane
  collapsing, vs the **school policy** `hardCapMinutes` (2400), `maxHoursPerWeek` never consulted — same teacher, clean.
  **Auto-fill** (TLA:3133-3134): teaching **+** advisory + ancillary vs `maxHoursPerWeek*60`. **Rebalance**
  (TLA:3801-3802): teaching-only vs the **30h standard**. The client chip adds a fifth definition.

## Gaps/bugs, ranked by demo impact (Wednesday 2026-09-30)

1. **BLOCKER — 40h mode silently over-assigns.** TLA:671 ignores `maxHoursPerWeek`; a 30h teacher is promised 40h, then
   flagged over cap. *Fix: `min(maxHoursPerWeek*60, HARD_CAP_MIN)`; make `…proposal.service.ts:683-686` the single rule.* — **A6**
2. **BLOCKER — Teacher-X mode reports success it never delivers.** TLA:3116 forces `unresolved = 0`; substitute rows are
   stripped at :2307-2315 and never saved, so generation emits one blocker per pair. *Fix: show the unresolvable count.* — **A6**
3. **BLOCKER — no lever closes the gap the modal opens.** `coverage/repair` is server-only with no UI, and a hand-made
   placeholder gets no qualification row. *Fix: an "add to-be-hired teacher" button beside the shortage that creates
   the placeholder **with** its `facultySubject` row and assigns it.* — **A6**
4. **MAJOR — generator accepts placeholders, the suggestion engine rejects them** — the only thing that unblocks
   generation is invisible to the tool that fills load. *Fix: exclude `isPlaceholder` in `generation-preflight.service.ts`.* — **A6**
5. **MAJOR — four load definitions, so two screens disagree.** *Fix: one `computeEffectiveWeeklyTeachingMinutes` across
   all four sites; the TL chip and generation must read the same number.* — **A6**
6. **MAJOR — Apply 409 names no class.** `…proposal.service.ts:450-452` is correctly scoped to inserts (`:407-409`) but
   says only `One or more reviewed subject-section pairs changed ownership.`, so a `KEPT_EXISTING`→`INSERT` flip reads
   as real drift (Lane C hit it twice). *Fix: name the codes.* — **A6**
7. **MINOR — "Subjects Affected" counts departments** (`AutoFillSummaryModal.tsx:454`). *Fix: rename or re-bucket.* — **A6**
8. **MINOR — a policy save can reset the 30h/40h caps** (`policyPaneModel.ts:20-60`). *Fix: carry the fields through.* — **A6**
