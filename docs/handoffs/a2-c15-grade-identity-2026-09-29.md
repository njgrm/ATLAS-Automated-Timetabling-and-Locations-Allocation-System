# A2 C15 — Grade identity handoff (2026-09-29)

**Candidate:** `33653bc9` + the additive final commit (this range's tip).
**Base:** `6c8fd5d1`. **Branch:** `work/a2-c15-grade-identity`. **Worktree:** `E:/ATLAS-worktrees/lane-c-a2-c15-grade-identity`.
**Goal:** a section's numeric grade is 7–10, derived from `gradeLevelName` (then `displayOrder` when it is 7–12), and **never** from EnrollPro's internal `grade_level_id` — which re-mints on every wipe (5..8, then 17..20, then 1..4 as of 2026-09-28).

## What changed, and what it fixed

`GR1` beside LUNA/RIZAL and `GR2` beside MAKATAO/ORCHID on the Teachers load surface. Staging, before → after, in the Review load inspector for FERNANDEZ, JANELLA MARIE: `LUNA GR1` → **`GR7`**, `RIZAL GR1` → **`GR7`**, `MAKATAO GR2` → **`GR8`**, `ORCHID GR2` → **`GR9`**.

- **ONE server authority** — `services/grade-level-resolver.ts`. `gradeNumberOf(ref)` = name → `displayOrder` (7–12 only) → `null`, never the id. `resolveSectionGradeLevel(ref, registry?, fallback?)` keeps the 2026-09-28 name → registry → legacy legs for consumers that must return a number and can supply a registry.
- **ONE client twin** — `lib/schedule-review-helpers.ts::gradeNumberOf`, with `resolveSectionGradeNumber` re-exporting it. Three divergent client resolvers collapsed to one.
- **Four private resolvers deleted**: `workbook-export.service.ts` (D1), `official-program-docx.service.ts` (three D1-pattern sites, one of which printed `GRADE 1` on an official form), `FacultyRow.tsx::getSectionGradeNumber`, and `teacher-program-export.service.ts::parseGradeNumber` (found by the second review).
- **Sites routed:** S1 `teacherWorkloadProfile.ts` · S2/L2/L3 `pre-generation-draft.service.ts` (shape contract, per-grade shift window, canonical `classProgramSlot` scope, validator window scope, board Grade filter) · S3 `published-schedule.service.ts` · S4 `published-identity-snapshot.service.ts` · S5 `workbook-export.service.ts` · L1 `locked-session.service.ts` · L4 `section-adapter.ts` · B2 `pages/Sections.tsx` (Grade column, extracted to `lib/sections-sort.ts` to stay under the 1000-line cap), `lib/teaching-load-helpers.ts` (grade filter), `section.service.ts:609` (SP overlay ordering).

## Evidence

| gate | result |
|---|---|
| `test:a2-c15-grade-identity` (server) | **27/27** — 19 authority/site rows + the repo-wide sweep + the 6-row 2026-09-28 hotfix suite |
| `test:a2-c15-grade-identity` (client) | **26/26** — 11 c15 rows + 15 `faculty-assignment-helpers` |
| `tt-output-c05r1-teacher-program.test.ts` (owner of the fourth resolver) | **11/11** |
| `timetable-grid-shape-authority.test.ts` | **7/7** |
| `test:server-db` mounted draft + S3 rows | **6/6**, zero residue |
| `test:encoding` | **1/1** |
| `tsc` server / client | clean / 5 pre-existing, 0 in changed files |
| **Baseline diff, `test:client-suite`** | base `6c8fd5d1` 1311 tests / **43 fail**; candidate 1312 / **42 fail**; **0 failures only on the candidate**; 42 present in both = pre-existing |
| **Baseline diff, 4 `test:server-db` files** | all 4 fail on base with identical codes (`GENERATION_PREFLIGHT_BLOCKED`, `TERM_AUTHORITY_UNRESOLVED`, the `teaching-load-automation.service.ts` `TypeError`) = pre-existing |

**Failing-first controls, each reverted with the Edit tool and verified byte-exact** (`git diff --stat` empty after each; no `git checkout`/`reset`/`clean`): client S1 → 4 rows red, rendering `GR2`; server S4 + L3 → 5 rows red; server S2 draft leg (mounted) → the grid reaches `06:00`…`15:55`, the policy fallback; **server S3 (mounted)** → *"the published section grade must be 7, not the EnrollPro id 1"* and the negative twin both red; **the new repo-wide sweep** → a reintroduced private `parseGradeNumber` in `section-adapter.ts` produced *"declares \"parseGradeNumber\", which is not a sanctioned re-export of the one authority"*.

**Badge-text decision.** The shared `GR` prefix is kept, per `lib/grade-labels.ts` Decision 5. The defect was the **value**, not the prefix; a local restyle was explicitly out of scope. The 9px tie-break is handed to Lane C (below).

---

## Auditable follow-up list

**F1 — BLOCKING follow-up, latent not live-wrong. Owner: Lane C / the derived-demand owner.**
`atlas-server/src/services/subject.service.ts` (~296–330, writes at ~1246/~1249) puts the EnrollPro `grade_level_id` into `Subject.gradeLevels` / `interSectionGradeLevels`, which the demand model normalises through `normalizeGradeSet` → `normalizeGradeLevelSync`. On the current id space that yields `[1,2,3,4]`, which cannot intersect a real Grade 7–10 scope, so a TLE-specialisation subject would contribute **no demand lines**.
**Measured staging 2026-09-29: `tle_specialization` is NULL/empty on 0 of 20 sections in EVERY school year (1, 2, 8, 9, 10) — so it is latent today.**
**Trigger condition: the moment a TLE specialisation is configured for any section, this becomes live-wrong and must be fixed before that configuration is used.** Deferred deliberately: it is a data-shape change to a canonical demand-model input, not a mechanical id-read, and needs its own review. Not touched in this range.

**F2 — NON_BLOCKING.** The `displayOrder`-as-within-grade-order claim survives in unexamined code. `useTimetableLookupHelpers.ts` carried it; its comment was corrected to the measured truth, but any *other* consumer built on the within-grade reading is unexamined. `displayOrder` measures 7..10 in every school year; where a fixture asserts otherwise, the fixture is not the surface.

**F3 — NON_BLOCKING.** `section.service.ts:609` became a fetch + in-memory sort: a Prisma `orderBy: [{ gradeLevelId: 'asc' }]` cannot express the resolved grade, so `gradeLevelName`/`displayOrder` were added to the select and the ordering applied in memory. All measured id spaces are monotonic with grade, so live output ordering is unchanged, but the secondary-key precedence changed (`programType`/`name` are now secondary to the grade).

**F4 — NON_BLOCKING.** `resolveSectionGradeLevel` returns `1..4` for an unnamed post-wipe row on its two no-registry consumers — `pre-generation-draft.service.ts` ~741, and `workbook-export.service.ts` ~361/650/868 — because it must return a number and `legacyGradeFromInternalId(1)` is `1`. The frozen leg of that same workbook field uses a different fallback (`gradeNumberOf(...) ?? 0`), so the live and frozen legs of one field disagree on the unresolved case. Both are documented in the authority; neither is a wrong grade on any measured row.

**F5 — NON_BLOCKING, inherited UX debt, deliberately NOT touched.** The 9px grade label inside a 16px `GradeLevelBadge` chip; `moreFilters: 1` on /sections and /teachers; sub-12px stat-banner text. Measured **identical on base and candidate**; `GradeLevelBadge.tsx` is not in this range. Owner: the UI-foundation stream. AGENTS §8 forbids fixing a shared primitive inside a defect lane.

**F6 — reviewer could not execute.** The mounted draft-leg rows (D1–D3, D5) and the mounted S3 rows (D4, D4b) were **UNVERIFIED BY THE REVIEWER**, which had no sanctioned disposable-DB credential and judged them by reading only. The executor ran them: 6/6, and the S3 failing-first control was executed and both rows went red. The 9px/major audit rows are likewise executor-run.

**F7 — NON_BLOCKING, open incident.** `D:\ATLAS\node_modules` is a real **EMPTY** directory, `LastWriteTime 2026-09-29 18:06:58`, with `.package-lock.json`, `.bin` and `.prisma` all absent, while the root `package.json` declares 10 dependencies + 11 devDependencies. **Cause unattributed.** Not caused by this lane as far as established: every junction of this lane was verified `LinkType = Junction` before `cmd /c rmdir`, no delete of this lane was ever pointed at that path, and the three donors this lane's gates resolve through are **intact** (server 209 entries, `lane-a2-c13` client 156). **Where it bites: 4 of the 5 client `tsc` errors are unresolvable hoisted-workspace `playwright` imports.** Open for the operator / A4 (E: and D: capacity owner).

**F8 — NON_BLOCKING.** A staging preview may still be listening on `127.0.0.1:5276` (pid 43140) from the proof round. Not stopped (no process may be stopped by name or port). Needs cleanup by name.

## Constraints honoured
No deploy, no migration, no live or staging data write, no generation, no publication. Every database touched was a guarded `atlas_restore_drill_*` created and dropped by `scripts/run-db-suite.mjs`, which fails closed on any other name; final census shows only another lane's pre-existing `atlas_restore_drill_20260929_a8c4`. `atlas_live` and the shared `atlas_staging` were never connected to. No restyle. No change to `subject.service.ts`. `git push` was denied throughout; all commits are local and pushed by the integrator.
