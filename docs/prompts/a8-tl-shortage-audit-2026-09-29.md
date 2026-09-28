# A8 packet — READ-ONLY source audit: does Teaching Load help a short-staffed scheduler? (operator 2026-09-29)

Fresh session, new lane A8 (audit only: **no code changes, no DB writes, no servers, no browser**). Codex runs the
browser half on staging in parallel (`docs/reviews/codex-staging-shortage-*` when it lands). Real case on live, S.Y.
2022-2023: 23 teachers, 920 weekly sessions (23 × 30 h = exactly demand), 2–3 MAPEH teachers for ~20 sections; after
Apply, generation still showed 438 blockers because TL "Temporary substitute" rows are never saved.

Start: `atlas-client/src/pages/TeachingLoad.tsx`, `lib/teaching-load-helpers.ts` (strategies ~L100-115, L217),
`lib/teaching-load-suggestion-presentation.ts`, `components/faculty-assignments/*`, `components/faculty/CreatePlaceholderDialog.tsx`;
server `teaching-load-suggestion-proposal.service.ts`, `faculty.service.ts` (~L866-910 placeholders), `faculty-assignment.service.ts`,
and the generation readiness code emitting "no Teaching Load owner" / "no qualified owner" / "every candidate owner is at their weekly limit".

Answer with file:line facts:
1. Each suggestion strategy: how it picks teachers; does it honour maxHoursPerWeek, the 30 h standard, the 40 h cap,
   canTeachOutsideDepartment? Can the "40h" strategy actually exceed a teacher's maxHoursPerWeek=30?
2. Temporary substitutes: persisted or not; what generation sees after Apply; any path substitute → saved placeholder (isPlaceholder)?
3. Placeholders: creation, department/qualification needs, does the suggestion engine assign them, does generation accept them
   as owners, where are they shown as "not a real person"?
4. Shortage visibility: is capacity vs demand per subject/department computed and shown? Quote UI strings.
5. Levers: per-teacher max hours, cross-department, qualifications — exposed in UI or data-only (file:line each).
6. Gaps and bugs, incl. TL vs generator load counting (generation: 5 teachers over limit, TLE #9/#25 with 30 pairs; TL: none).

Output: `docs/reviews/a8-tl-shortage-audit-2026-09-29.md`, ≤ 80 lines: answers 1-6, then "Gaps/bugs" ranked by demo
impact (Wednesday 2026-09-30), each with a one-line fix and owner suggestion (A6 = Teaching Load/teachers). Push that
one file to main and post a 3-line note in `docs/handoffs/lane-c-to-a2.md`. Do not end the run to wait for Lane C.
