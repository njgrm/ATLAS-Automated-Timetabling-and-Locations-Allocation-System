# Subjects, Faculty & Sections Hardening Plan
**Created:** 2026-05-11  
**Scope:** Post-phase-2 data integrity and UX hardening for Subject CRUD, Faculty column layout, Section program filtering, seed correctness, and auto-qualification seeding.

---

## Execution Order

```
Bug A  →  Bundle 1  →  Bundle 4  →  Bundle 2  →  Bundle 3  →  Bundle 5
(STE)    (Dept+Spec)  (Seed)      (Modal CRUD) (Grouping)  (Auto-seed)
```

Bundles 4 and 5 are backend-only and can run in parallel with Bundles 2 and 3.

---

## Bug A — STE Sections Not Appearing in Filter

**Status:** ⬜ Not started

**Root cause:** `PROGRAM_METADATA_BY_UPSTREAM_TYPE` in `section-adapter.ts` only maps the long-form key `SCIENCE_TECHNOLOGY_AND_ENGINEERING`. If EnrollPro sends the short code `STE` (e.g. from a cached or flat-format response), the normalization falls through to `OTHER`, which then fails the `programType === 'STE'` filter in Sections.tsx.  
SPA likely worked because that specific EnrollPro instance sent `SPECIAL_PROGRAM_IN_THE_ARTS`.

**Fix:**
- Add short-code aliases (`STE`, `SPA`, `SPS`, `SPJ`, `SPFL`, `SPTVE`) to `PROGRAM_METADATA_BY_UPSTREAM_TYPE` in `section-adapter.ts`, each pointing to the same metadata object as their long-form key.
- Files changed: `atlas-server/src/services/section-adapter.ts`

---

## Bundle 1 — Faculty: Department + Specialization Two-Column Model

**Status:** ⬜ Not started

**Context:** EnrollPro's `GET /api/teachers/atlas/faculty-sync` sends **both** `department` (academic dept, e.g. "Mathematics") and `specialization` (subject focus, e.g. "Algebra"). Currently the adapter discards `department` and stores `specialization → department` in FacultyMirror. We need to store and display both.

**Changes:**
1. `prisma/schema.prisma` — Add `specialization String? @map("specialization")` to `FacultyMirror`
2. `prisma db push` — apply column
3. `faculty-adapter.ts` — `ExternalFaculty` gets `specialization: string | null`; EnrollPro adapter maps `t.department → department`, `t.specialization → specialization`; stub data gets both fields
4. `faculty.service.ts` — `LocalMirrorComparable` + sync upsert include `specialization` field
5. `atlas-client/src/types.ts` — `FacultyMirror` type gains `specialization: string | null`
6. `Faculty.tsx` — Replace single "Specialization" column with stacked cell: dept name in subdued text on top, specialization in primary weight below — matching EnrollPro's faculty table layout
7. `SubjectRow.tsx` + `FacultyAssignments.tsx` — The spec-mismatch badge uses `faculty.department` (academic dept) for matching, not `specialization`. `allowedSpecializations` on Subject should be compared against `department` values.

---

## Bundle 2 — Subject CRUD: Modal Form

**Status:** ⬜ Not started

**Context:** Current UX has the Add form as a side-panel (`showAdd`) and Edit as an inline table row expansion. Both should be replaced with a unified Dialog modal.

**Changes:**
1. `atlas-client/src/components/subjects/SubjectFormModal.tsx` (new) — Single `<Dialog>` handling both Add and Edit modes, driven by `mode: 'add' | 'edit'` + optional `initialValues?: Subject`. Absorbs all form logic from `SubjectAddForm.tsx` and the inline edit row in `Subjects.tsx`.
2. `atlas-client/src/components/subjects/SubjectAddForm.tsx` — Remove (logic migrated into modal), or keep as thin re-export if referenced elsewhere.
3. `atlas-client/src/pages/Subjects.tsx` — Replace `showAdd` panel + inline edit rows with `<SubjectFormModal open={...} mode={...} initialValues={...} onClose={...} onSave={...} />`. Toolbar "Add Subject" opens modal in `add` mode; row "Edit" button opens in `edit` mode. Remove all inline edit state and DOM.

---

## Bundle 3 — Subjects Table: Program-Type Group Ordering

**Status:** ⬜ Not started

**Context:** All Regular (core) subjects should appear first. Special-program subjects (STE, SPA, etc.) appear in groups below with a subtle header divider row between groups.

**Changes:**
1. `atlas-client/src/pages/Subjects.tsx` — After applying filters, group subjects: REGULAR first, then STE, then SPA, then others. Inject lightweight `<tr>` group header rows as visual dividers between groups when rendering.

---

## Bundle 4 — Seed: Per-Grade TLE (ICT) + Corrected STE Subjects

**Status:** ⬜ Not started

**Context:** Current seed has generic `ICT` subject across all grades and several STE subjects with wrong grade scopes. Replace with specific per-grade TLE (ICT) subjects and correctly scoped STE subjects.

**New subjects:**
| Code | Name | Grades | `programScopes` | Room Type |
|------|------|--------|-----------------|-----------|
| `TLE_ICT_7` | TLE (ICT I) Computer Systems | [7] | `[REGULAR]` | COMPUTER_LAB |
| `TLE_ICT_8` | TLE (ICT II) Computer Systems II | [8] | `[REGULAR]` | COMPUTER_LAB |
| `TLE_ICT_9` | TLE (ICT III) Computer Systems Servicing III | [9] | `[REGULAR]` | COMPUTER_LAB |
| `TLE_ICT_10` | TLE (ICT IV) Computer Systems Servicing IV | [10] | `[REGULAR]` | COMPUTER_LAB |
| `ENV_SCI` | Environmental Science | [7] | `[STE]` | LABORATORY |
| `RESEARCH_I` | Research I | [7] | `[STE]` | CLASSROOM |
| `RESEARCH_II` | Research II | [8] | `[STE]` | CLASSROOM |
| `BIOTECHNOLOGY` | Biotechnology | [8] | `[STE]` | LABORATORY |
| `CONSUMERS_CHEMISTRY` | Consumers Chemistry | [9] | `[STE]` | LABORATORY |
| `RESEARCH_III` | Research III | [9] | `[STE]` | CLASSROOM |
| `ELECTRONICS_ROBOTICS` | Electronics and Robotics | [10] | `[STE]` | LABORATORY |
| `RESEARCH_IV` | Research IV | [10] | `[STE]` | CLASSROOM |

**Also:**
- Ensure all core BEC subjects have `programScopes: ['REGULAR']`
- Ensure all existing STE subjects have `programScopes: ['STE']`
- Ensure all SPA subjects have `programScopes: ['SPA']`
- All upserts are idempotent (safe to re-run)

**Files changed:** `prisma/seed.js`

---

## Bundle 5 — Auto-Seed Qualified Subject Assignments on Sync

**Status:** ⬜ Not started

**Context:** After every faculty or section sync, automatically create `FacultyAssignment` records (with `sectionIds: []`) for each faculty × subject pair where `faculty.department ∈ subject.allowedSpecializations`. These pre-populate the FacultyAssignments page with qualified pairings that the Scheduler then fills with section assignments.

**Changes:**
1. `atlas-server/src/services/assignment-seed.service.ts` (new) — `seedQualifiedAssignments(schoolId, schoolYearId): Promise<{ created, skipped }>` — queries all non-stale active faculty, all active subjects with non-empty `allowedSpecializations`, upserts assignment records for matching department→specialization pairs
2. `atlas-server/src/services/faculty.service.ts` — Call `seedQualifiedAssignments(schoolId, schoolYearId)` at end of `syncFacultyFromExternal()`
3. Section sync route or service — Call `seedQualifiedAssignments(schoolId, schoolYearId)` after section sync completes
4. `atlas-server/src/routes/faculty.router.ts` — Include `{ seededAssignments: result.seeded }` in sync response body

---

## Teaching Load Notes

No structural change needed. The `subjectHours` calculation in `faculty.service.ts` reads `FacultyAssignment.sectionIds.length × subject.minMinutesPerWeek`, which handles STE/SPA subjects correctly once they are seeded with proper `minMinutesPerWeek` values (Bundle 4).

---

## Files Touched Summary

| File | Bundles |
|------|---------|
| `atlas-server/src/services/section-adapter.ts` | Bug A |
| `prisma/schema.prisma` | Bundle 1 |
| `atlas-server/src/services/faculty-adapter.ts` | Bundle 1 |
| `atlas-server/src/services/faculty.service.ts` | Bundle 1, Bundle 5 |
| `atlas-client/src/types.ts` | Bundle 1 |
| `atlas-client/src/pages/Faculty.tsx` | Bundle 1 |
| `atlas-client/src/components/faculty-assignments/SubjectRow.tsx` | Bundle 1 |
| `atlas-client/src/pages/FacultyAssignments.tsx` | Bundle 1 |
| `atlas-client/src/components/subjects/SubjectFormModal.tsx` (new) | Bundle 2 |
| `atlas-client/src/components/subjects/SubjectAddForm.tsx` | Bundle 2 |
| `atlas-client/src/pages/Subjects.tsx` | Bundle 2, Bundle 3 |
| `prisma/seed.js` | Bundle 4 |
| `atlas-server/src/services/assignment-seed.service.ts` (new) | Bundle 5 |
| `atlas-server/src/routes/faculty.router.ts` | Bundle 5 |
