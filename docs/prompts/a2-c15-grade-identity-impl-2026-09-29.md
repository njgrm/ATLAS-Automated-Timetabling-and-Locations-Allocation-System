# A2 c15 — implementation packet: a grade is 7-10, never EnrollPro's gradeLevelId

Parent packet: `docs/prompts/a2-c15-grade-identity-2026-09-29.md` (Lane C, 2026-09-29 17:05, HIGH).
Worktree: `E:/ATLAS-worktrees/lane-c-a2-c15-grade-identity`. Branch: `work/a2-c15-grade-identity`. Base: `4c515b01`.
Risk: HIGH (generation input, published schedule, exports). One fresh high-tier review pass.

## 0. Measured fact base (planner, read-only, staging `atlas_staging`, 2026-09-29)

`select school_year_id, grade_level_id, grade_level_name, display_order, count(*), min("createdAt"), max("updatedAt")
 from section_mirrors group by 1,2,3,4` — 20 groups, 5 sections each:

| school_year_id | grade_level_id | grade_level_name | display_order | first_seen | last_updated |
|---|---|---|---|---|---|
| 1 | 1 / 2 / 3 / 4 | Grade 7 / 8 / 9 / 10 | 7 / 8 / 9 / 10 | **2026-09-28 14:39:59** | 2026-09-29 05:28 / 06:12 |
| 2 | 1 / 2 / 3 / 4 | Grade 7 / 8 / 9 / 10 | 7 / 8 / 9 / 10 | **2026-09-29 05:31:08** | 2026-09-29 06:12 |
| 8 | 17 / 18 / 19 / 20 | Grade 7 / 8 / 9 / 10 | 7 / 8 / 9 / 10 | 2026-09-06 15:34 | 2026-09-06 |
| 9 | 17 / 18 / 19 / 20 | Grade 7 / 8 / 9 / 10 | 7 / 8 / 9 / 10 | 2026-09-10 11:14 | 2026-09-10 |
| 10 | 17 / 18 / 19 / 20 | Grade 7 / 8 / 9 / 10 | 7 / 8 / 9 / 10 | 2026-09-17 17:16 | 2026-09-28 02:39-03:13 |

Three conclusions the parent packet's evidence did not state, and which change the fix:

1. **`grade_level_name` is always `Grade 7`..`Grade 10`.** It is the stable identity. EnrollPro re-mints
   `grade_level_id` on every wipe/rollover: `5..8` -> `17..20` -> **`1..4`**. The id is never a grade.
2. **`display_order` is always the true grade `7..10` in every school year** — it is a *second* reliable
   source, and a safe fallback when the name is absent.
3. **The current id space is `1..4`, first written 2026-09-28 14:39:59 (S.Y. 1) and 2026-09-29 05:31:08
   (S.Y. 2).** Before that the ids were `17..20`, which the existing legacy map translates correctly to
   `7..10`. So every defect below became wrong **on 2026-09-28**, and only for school years 1 and 2.
   `legacyGradeFromInternalId` has no `1..4` entry, which is correct: an unnamed `1` must not become `7`.

Note the consequence for the "since when" answer: because `display_order` is populated, a site written as
`displayOrder ?? gradeLevelId` was **not** wrong before today and is **not** wrong now. It is *latently*
wrong (a null `displayOrder` reintroduces the bug) and must still be routed through the authority.

## 1. The single authority

There is already a server authority, `atlas-server/src/services/grade-level-resolver.ts`
(`resolveSectionGradeLevel` = name -> registry -> legacy id map, name-first). Do **not** add a competing
module. Instead:

- Add one exported server helper in `grade-level-resolver.ts`:
  `gradeNumberOf(ref: { gradeLevelName?, displayOrder?, gradeLevelId? }): number | null` — parse `7..12` from
  `gradeLevelName` (reuse `gradeFromGradeLevelName`), else `displayOrder` **only if it is `7..12`**, else
  `null`. It must **never** return a value derived from `gradeLevelId`. Keep the existing exports working;
  make `resolveSectionGradeLevel` delegate to it where that is behaviour-preserving, or document precisely
  where the two differ and why.
- Add the client twin in `atlas-client/src/lib/schedule-review-helpers.ts` beside the existing
  `resolveSectionGradeNumber`, and make `resolveSectionGradeNumber`, `normalizeJhsGradeNumber` and
  `normalizeInternalGradeId` (client) delegate to it.
- Collapse the divergent third copy: `atlas-client/src/components/faculty/FacultyRow.tsx` has a private
  `getSectionGradeNumber` (name -> displayOrder -> id-if-7..10) that disagrees with the shared one. Delete
  it and call the twin, so the client has one resolver, not three.

## 2. Replace every site (production only; tests are section 3)

Live-wrong on staging since **2026-09-28** — the raw id arrives as `1..4` where a grade `7..10` is required:

| # | Site | What live output is wrong |
|---|---|---|
| S1 | `atlas-client/src/components/faculty/teacherWorkloadProfile.ts:73` `gradeLevel: section.gradeLevelId ?? 0` | Feeds `WorkloadInspector.tsx:254` `<GradeBadge grade={item.gradeLevel}>` -> renders **`GR1`/`GR2`**. This is the operator screenshot. Teachers > Review load + Profile. |
| S2 | `atlas-server/src/services/pre-generation-draft.service.ts:735-736, 739` — `window.gradeLevel === grade.gradeLevelId` and `buildTimetableShapeContract({ gradeLevel: grade.gradeLevelId })` | Per-grade **shift windows never match** (windows are keyed by real grade), so every scope silently falls back to `policyRecord.earliestStartTime/latestEndTime`, and the shape contract is built for grade `1..4` instead of `7..10`. Generation-input consequence. |
| S3 | `atlas-server/src/services/published-schedule.service.ts:709` `gradeLevel: section.gradeLevelId` | `SectionReference.gradeLevel` in the **published schedule** payload is `1..4`. |
| S4 | `atlas-server/src/services/published-identity-snapshot.service.ts:660` `gradeLevel: value.gradeLevelId ?? null` | The **frozen identity snapshot** records grade `1..4`, so identity/freshness comparison across a re-ID judges the wrong scope. |
| S5 | `atlas-server/src/services/workbook-export.service.ts:291` `gradeLevelId: value.gradeLevelId ?? 0` | Frozen-snapshot export rows carry `1..4`. |

Latent, not currently wrong (fix anyway — a null `displayOrder` reintroduces the bug):

| # | Site |
|---|---|
| L1 | `atlas-server/src/services/locked-session.service.ts:48` `Number(section.displayOrder ?? section.gradeLevelId ?? 0)` — the `select` does not even fetch `gradeLevelName`; add it. |
| L2 | `atlas-server/src/services/pre-generation-draft.service.ts:424` `canonicalScopeGrade` (`displayOrder ?? gradeLevelId`) — maps a draft grade group onto canonical `classProgramSlot` rows; with a wrong scope it silently loses the canonical grid. |
| L3 | `atlas-server/src/services/pre-generation-draft.service.ts:947` `Number(section.displayOrder ?? section.gradeLevelId ?? 0)` in the validator context. |
| L4 | `atlas-server/src/services/section-adapter.ts:324` `Grade ${gradeLevel.displayOrder ?? gradeLevelId}` — a fallback **label** that can print `Grade 1`. |

Second authority to remove:

| # | Site |
|---|---|
| D1 | `atlas-server/src/services/workbook-export.service.ts:173` defines a **private** `resolveSectionGradeLevel` that shadows the shared name, uses a narrower regex (`/Grade\s+(\d+)/i`) and falls back to `normalizeGradeLevelSync`. Delete it and import the shared authority. A second grade authority is how this defect recurs. |

`displayOrder ?? gradeLevelId` also appears in the `canonicalScopeGrade` doc comment (line 419) — update the
comment; a comment that teaches the bug keeps producing it.

Grep proof required in the handoff (must return nothing in production paths):
`gradeLevelId ??`, `gradeLevel: *.gradeLevelId`, `displayOrder ?? .*gradeLevelId`, `GR\$\{[^}]*[Ii]d`,
plus every new `resolveSectionGradeLevel` / `gradeNumberOf` call site listed above.

## 3. Tests

- One committed server suite and one committed client suite, **both reachable from a `package.json` script in
  the same commit** (a test no gate runs is not evidence).
- Fixtures must be taken from the **real** surface: both id spaces `1..4` and `17..20`, and `5..8` for the
  legacy map, each with `gradeLevelName: 'Grade 7'..'Grade 10'` and `displayOrder: 7..10` exactly as staging
  stores them. All must produce `7..10`.
- **Negative control:** `gradeLevelId: 1` with no name and no displayOrder must NOT yield `1` and must not
  render `GR1` / `Grade 1`; assert it fails on the base commit (failing-first) and passes on the candidate.
- Per-site assertions that S1..S5 and L1..L4 no longer consume the raw id; D1 removed.
- One preservation run of the suites that own the touched files (generation shape, published schedule,
  workbook export, teaching load carry-forward, faculty surface).
- `npm run test:encoding` must pass.

## 4. Badge text — deliberate reading, do not restyle

The parent packet says badge text must be `"Grade 7"` (or `"G7"`), never `"GR1"`.
`atlas-client/src/lib/grade-labels.ts` records **Decision 5** (`docs/phases/setup-content-area-improvement-plan-2026-08-05.md`):
the official compact format is `GR{grade}`, and the shorthand `G{grade}` is **intentionally absent**; the long
form `Grade {grade}` is for explanatory copy. `GradeBadge`/`GradeLevelBadge`, `FacultyRow`, `SubjectRow`,
`deped-glossary` and `timetable-reference-labels` all render `GR${grade}` today.

**Decision: render the correct grade through the existing shared primitive, so the badge reads `GR7`, not
`GR1`.** The defect is the *value* (1 instead of 7); the shared `GR` prefix is the sanctioned house form and
is used by every grade surface. Changing the prefix to `G7` across the app is a separate visual-consistency
change and would break AGENTS §8 "One look per control" if done only here. Do not locally restyle the badge.
Badge text must be >= 14px (UI foundation) — verify, do not assume.
Flag this reading explicitly in the handoff so Lane C can rule on it.

## 5. Proof required before REVIEW_REQUIRED

Real staging data at 1366x768, no fixtures, no harness pages. Start the preview with
`scripts/dev/start-preview.ps1` on a port in **5200-5299** (it proxies to the staging API `:5101`), then
open `http://127.0.0.1:<port>/__dev/staging-login`. Never read
`D:\ATLAS-runtime-config\atlas-staging-qa.env`. If the login route 404s, `git merge origin/main` and restart.
Screenshot every page **and** every page using a shared component you touched:
Teachers > Review load, Teacher Profile, Teaching Load, Sections, Class Schedule readiness.
Before done, check each screenshot for: any "More filters" disclosure, text outside its box, an ellipsis in a
trigger/menu/chip/header, garbled characters, a horizontal scrollbar, a footer covering content, a
clickable thing that looks like plain text. Any hit is a failing row.
Also paste `scripts/qa/ux-audit.js` into the JS context of **every** page/dialog in the proof and attach the
JSON: `major` must be 0 and nothing you touched may be under 14px.
The quoted before/after is mandatory: staging currently shows `GR1` for LUNA/RIZAL (FERNANDEZ) and `GR2` for
MAKATAO/ORCHID; after, those must read `GR7` and `GR8`.

## 6. Discipline

- Commit a `wip(a2-c15):` checkpoint and push the branch at least every 30 minutes and before any long step.
- Never `git checkout --`, `git reset --hard`, `git clean` or revert uncommitted work; `git stash push -u`
  or commit to `backup/a2-c15-<time>` first.
- Never write repository files through a PowerShell pipeline; use the Edit/Write tools or `git diff --output`.
- Do not touch `D:\ATLAS`. Write, commit and push only from this worktree.
- Do not stop processes by name or port. No bare test run against a shared database: DB-writing suites only via
  `npm run test:server-db` (disposable `atlas_restore_drill_*`), and never point at `atlas_live`.
- Nothing here is a HIGH *action*: no deploy, no migration, no live-data write, no generation, no publication.
