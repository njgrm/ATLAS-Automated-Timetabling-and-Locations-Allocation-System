# A3 c16 — "no codes on screen" — handoff

Lane C packet `docs/prompts/truth-fixes-2026-09-29.md`, section **A3 c16 (after c15)**.
Verbatim scope: *"Teachers shows raw subject codes (`STE_APPLIED_PHYS 1, STE_RESEARCH 1`,
`TLE_ICT_EXP`, `SCI_BIO`): show subject names. Sweep every page for enum/code rendering (the code
audit's class 6) and fix what you find."*

- Base `888d856d8c162f1a82d354cc8cf92532219e1e22` (origin/main tip when the packet was read)
- Candidate `780e95fa` on `work/a3-c16-no-codes`, pushed. Four additive commits, none amended:
  `0a68e973` faculty, `9d4fe01d` unclaimed-surface sweep, `2bd2219f` rendered-pass correction,
  `780e95fa` QA round 1 closure.
- Client only. No `atlas-server/`, no `prisma/`, no deploy, no live-data, no generation,
  no publication. Nothing is deployed; every render below is a loopback preview on real staging data.
- Worktree `E:/ATLAS-worktrees/lane-a3-c16-codes`, `atlas-client/node_modules` and
  `atlas-server/node_modules` are junctions to the shared donor
  `E:/ATLAS-worktrees/lane-c-a7c7/.../node_modules` (client re-counted **156** after the
  base-tree junction was removed with `cmd /c rmdir` before deleting that tree).
  Disposition: **RETIRE_AFTER_INTEGRATION**, and the two junctions must be `cmd /c rmdir`'d
  before any `git worktree remove`.

## 1. The named defect, before and after, on real staging data

Loopback preview on port 5241 proxying the **staging** API `:5101`, viewport **1366x768**,
asserted `window.location.origin`, signed in through `/__dev/staging-login` (never the credential
file). Real subject names confirmed against staging `GET /api/v1/subjects?schoolId=1` (22 subjects).

| Site | Before | After |
|---|---|---|
| Desktop single-subject cell | `MATH · 8 sections` | `Mathematics · 8 sections` |
| Desktop multi-subject cell | `DEVL_READING 1, FIL 5` | `Developmental Reading 1, Filipino 5` |
| Desktop multi-subject cell | `AP · 6 sections` | `Araling Panlipunan · 6 sections` |
| Desktop multi-subject cell | `ESP · 8 sections` | `ESP/GMRC · 8 sections` |
| Desktop multi-subject cell | `TLE_ICT_EXP 6, TLE_AFA_EXP 10 +1 more` | `TLE Exploratory - ICT 6 +2 more` |
| Desktop multi-subject cell | `STE_APPLIED_PHYS 1, STE_RESEARCH 1 +3 more` | `Applied Physics 1, Research 1 +3 more` |
| Desktop multi-subject cell | `STE_BIOTECH 1, STE_ENV_SCI 1 +4 more` | `Biotechnology 1, Environmental Science 1 +4 more` |
| Mobile card | same six shapes | same six shapes |
| Breakdowns popover row | `[MATH] GR7–GR9` + `8 sections` | `Mathematics MATH GR7–GR9` + `8 sections` (name leads, code is the muted detail, `GR` range and counts unchanged) |
| Assignment with no subject record | `SUBJ#12 · 1 section` | `Unknown subject · 1 section` |
| Subject with a blank name | (code) | `SCI_BIO · 1 section` — the documented fallback, never an empty cell |

Measured across **all 40 roster rows**: **0** matches of a raw-code pattern in the inline cell,
no horizontal scrollbar, no cell wrapped (`scrollHeight == clientHeight`), row heights 119/133/134px.
This change also *removed* the worst small text on the surface: the popover's `text-[0.6rem]`
(9.6px) code chip.

## 2. What changed, and why (16 paths, client only)

**Teachers (the named defect).** `atlas-client/src/components/faculty/FacultyRow.tsx`.
`buildSubjectSummaries` already carried `subject.name` and rendered `subject.code`; the name is now
the label at all six render sites plus the popover. `code` is kept on the type as the React key and
the "No sections yet" filter — the identity, not the label. `SUBJ#${subjectId}` survives as a key
and is never printed. Pattern copied from the already-committed
`tlHistorySubjectPrimary` / `tlHistorySubjectCodeDetail` in
`atlas-client/src/lib/teaching-load-history-plain.ts`: the name leads, and a code appears only as a
muted detail when it differs from the label (`''` when it does not), so "the code appears once" is
true by construction rather than by reviewer attention.

**The one-line rule (`2bd2219f`, widened in `780e95fa`).** The 1366x768 render showed the name swap
improving 8 of 9 rows and making one worse: a teacher on two long special-program subjects read
`Special Program in the Arts: Specialization 2, Special Program in Sports: Specialization 2 +1
more` across three lines, in a row visibly taller than its neighbours, with two near-identical
40-character titles. That is the "too literal" outcome. `pickInlineSubjects` now keeps the first
name and reports the rest through the `+N more` the cell already had, so the row is one line again.
No clamp, no ellipsis, no added word — a subtraction. The full per-subject breakdown with every
count stays one click away in `AssignmentBreakdownPopover`, which is the page's own affordance.
The ceiling is **40 characters of the whole composed line** (separator, both counts and the
overflow included), derived from the measured 259px inner text column of the cell in 12px text.

**The sweep (13 files, `9d4fe01d`)** — subject code -> name wherever a name was already on the
record or already resolvable, plus the two raw department codes that had a committed resolver:
`LeftRailContent.tsx` (the draft-queue filter was seeded from codes, so the *dropdown* was a list of
codes), `TimetableTaskDrawer.tsx` (including its `aria-label`, which was the code),
`GeneratedRunRailPanels.tsx`, `QuickPlaceSummaryModal.tsx` (was code-then-name, the reverse of the
convention everywhere else), `UnassignedInsertionWorkflow.tsx` (+ `programType` through the
existing `programShortLabel`), `TacticalSandboxDock.parts.tsx` (raw department through the existing
`departmentLabel`), `modals/TimetableWorkflowDialogs.tsx`, `ScheduleReviewWorkspace.tsx`,
`simplePublishReadiness.ts` (the code deliberately **won** over the label here; the precedence is
now inverted), `LockPanel.tsx` (plus `:336`, which printed `Subj #12` in the same function),
`components/runtime/CarryForwardReviewPanel.tsx`, and `pages/Audit.tsx` (the finding title used
`subjectName` while the body repeated `subjectCode`; both now route through one exported
`sectionCoverageGapSubjectLabel`, so they agree by construction). `SectionDetailsSheet.tsx` was
examined and deliberately **left unchanged**: both sites already name-lead with a muted code
sub-line, which is the allowed pattern.

`atlas-client/package.json` gains one line, `test:a3-c16-no-codes`, in the same commit as the tests
it reaches. A test no gate runs is not evidence.

## 3. Gate rows, as actually run

From `atlas-client` unless noted. Literal commands, literal tallies.

| Command | Result |
|---|---|
| `npm run test:a3-c16-no-codes` | **16 / 16 pass, 0 fail** |
| `npm run test:a3-c10-teacher-surface` | 21 / 21, 0 fail |
| `npm run test:a6-teachers` | 13 / 13, 0 fail (the `FIL` / `DEVL_READING` `<code>` pins in the untouched profile sheet still pass) |
| `npm run test:a7-year-setup-plain-words` | 17 / 17, 0 fail (base 17/17; the candidate was 16/17 before `780e95fa`) |
| `npm run test:a3-c4-copy` | 18 tests / 14 pass / **1 fail** / 3 skipped — pre-existing, reproduced on base identically by QA |
| `npm run test:ux-audit-findings` | 22 / 21 / **1 fail** — pre-existing, reproduced on base identically by QA |
| `npm run test:plain-language-j2j3-c01` | 18 / 18, 0 fail |
| `npx tsc --noEmit -p tsconfig.json` | exit 2, exactly **5** errors, all in files absent from the changed set (3x `Cannot find module 'playwright'`, 1x its implicit-any, 1x `TS2367` in `timetable-truth-labels-a2.test.ts:523`) |
| `npm run test:encoding` (repo root) | 1 / 1, 0 fail |
| `npm run test:client-suite` | 1311 tests / 1269 pass / **42 fail** — see §4 |

`npm run build` was **not** run: the repo's own fail-closed `VITE_ENROLLPRO_URL` guard blocks it by
design and A4 owns that at release.

## 4. The combined suite, stated honestly

`test:client-suite` is **red at base and red at the candidate**, and this range does not cause it.
Both trees were run with the identical command and compared by failing test name:

- **base `888d856d`: 1311 tests, 1268 pass, 43 fail**
- **candidate `780e95fa`: 1311 tests, 1269 pass, 42 fail**
- the sets of failing names are **identical except for one row that fails on base and not on the
  candidate** (`H9 RANGE-SCOPE ROW (NOT a behavioural row): every past-year module is byte-identical
  to the base`). **There is no candidate-only failure — this range introduces no regression.**

The 42 shared failures are a pre-existing condition of `main` and are other lanes' rows: exact
class-string and source-text contracts that in-flight work has already invalidated
(`ux-audit-findings-c01.test.tsx:340` pins a class string in `TimetableGrid.tsx`;
`a3-c4-subjects-copy.test.ts:327` pins `SubjectFormModal.tsx`), plus a large set of timetable
header/label contract rows. The 42 names are kept verbatim in the reviewer's log; the honest
summary is: **do not read "42 failures" as this lane's debt.**

## 5. Rendered proof (real staging data, 1366x768, asserted origin)

| Page | raw code tokens | `ux-audit` major | notes |
|---|---|---|---|
| `/teachers` | **0** of 40 roster cells | **7** | identical to Lane C's own live baseline for this page in `codex-live-truth-e75d6b8f.md`; every contributor is pre-existing (`More filters`, which is **A6 c8's** row; sub-12px stat labels; Radix `aria-hidden` tooltip copies at 1px). Nothing introduced here, and one 9.6px offender removed. |
| `/audit` | **0** | **0** | the section-coverage cards read `TLE Exploratory - ICT`, `TLE Exploratory - Agriculture and Fishery Arts`, `TLE Exploratory - Family and Consumer Science`; title and body agree |
| `/timetable` | **0** | **0** | **unperformed row, stated not hidden:** staging has no run for 2023-2024, so the run-only surfaces this range also changed — the diagnostics rails, the Lock/placement panel, Quick Place, the tactical sandbox dock, the placement and workflow dialogs — are **code-and-test proven, not render proven**. Reaching them needs a generated run, which is a HIGH action and was not performed. |

**The popover was not opened in the browser.** Its trigger is a `<button>` nested inside the cell's
own `<button>`, so a real click does not open it (QA's pre-existing finding N4; byte-identical
between base and candidate). Its three rows are covered by rendered JSDOM tests
(`A3-c16-5`, `-6`, `-9`) instead. Recorded as a limitation, not as a pass.

## 6. Named follow-ups (each with the exact site) — the honest bound of "sweep every page"

Lane C asked for a sweep of *every* page. This lane fixed every site whose file no other lane has in
flight, and the remainder are **not** silently dropped:

1. **`atlas-client/src/lib/timetable-reference-labels.ts:37` — `buildSubjectLabel` returns
   `subject.displayCode ?? subject.code`, and `Subject #${id}` for an unknown id.** This is the
   highest-volume code-rendering surface in the product: it is the label authority for the whole
   timetable. Its own committed test **pins the code as the label**:
   `atlas-client/src/lib/__tests__/timetable-cell-info.test.ts:49-50` asserts
   `buildSubjectLabel(SUBJECT_MAP)(1) === 'FIL'` and `(11) === 'TLE'`. Not changed here: it is the
   timetable lane's surface, its semantics are not this lane's to decide, and flipping it changes
   ~30 consumers at once. **This needs its own packet on the timetable lane, and it must update
   those two assertions in the same change.**
2. `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx:537` — `Object.entries` over
   `roomAssignmentReasonCounts` prints raw enum keys (`CROSS_BUILDING_FALLBACK_ASSIGNED`,
   `MODULAR_POOL_ASSIGNED`, `ROOM_PATH_EXHAUSTED`). No label authority for this enum exists anywhere
   in the repo, so writing one is new domain data, not a substitution.
3. `atlas-client/src/components/timetable/GeneratedRunRailPanels.tsx:548` — same, over
   `zoneDistributionByTerm[0].byZone` (campus zone codes).
4. `atlas-client/src/components/timetable/TacticalSandboxDock.parts.tsx:696` —
   `candidate.faculty.specialization` is still a raw token; there is no `specializationLabel` for
   this field.
5. `atlas-client/src/components/sections/SectionDetailsSheet.tsx:241` and `:301` — already name-lead
   with a muted code sub-line, i.e. the allowed pattern. Residual: the chip still duplicates the name
   when `subjectName === subjectCode`; `tlHistorySubjectCodeDetail`'s suppression could be applied.
6. `atlas-client/src/components/sections/SectionDetailsSheet.tsx:304` — `{cls.rotationFamily}` is a
   raw enum badge.
7. `atlas-client/src/components/timetable/UnassignedInsertionWorkflow.tsx:267` — the fallback arm of
   the preview-state badge still prints the raw `preview.state` enum. (`programType` was in scope and
   is fixed.)
8. `atlas-client/src/components/timetable/GeneratedUnassignedPanel.tsx:333` — a sibling
   `row.subjectCode` in a file A7 c8 has in flight.
9. **`More filters` on `/teachers`** (one `ux-audit` major contributor) — **A6 c8's row**, named in
   `fix-1.2`/A6 packets, not this lane's.
10. **Pre-existing, not attributable to this range:** the roster cell nests a `<button>` inside a
    `<button>` (React hydration warning, and the reason the popover cannot be opened in a browser);
    12px text in the cell and in the nav chrome is below the operator's 14px floor but predates this
    change, and the type scale was A7 c8's file to change.

## 7. Risks

- **NON_BLOCKING** — `departmentLabel` and `programShortLabel` return the raw code for an unmapped
  value (`ZZZ` stays `ZZZ`). Deliberate: translating is a courtesy, hiding data would be a lie. The
  same reasoning keeps the code as a muted detail where a name leads.
- **NON_BLOCKING** — the 40-character ceiling is a character budget measured at one viewport in one
  font. It is deliberately conservative, it is now a pure function with two direct rows
  (`A3-c16-10`, `-11`), and the rendered pass shows 0 of 40 cells wrapped. A different font size or a
  narrower window would need the measurement redone, not the rule re-argued.
- **NON_BLOCKING** — JSDOM performs no layout, so no test in this range proves the pixel budget. The
  browser pass is what proves it, and it is recorded above.
- **NON_BLOCKING** — the character budget cannot be font-aware; a much narrower viewport could still
  wrap a two-name line. The one-name fallback and the popover keep the information reachable either
  way.
