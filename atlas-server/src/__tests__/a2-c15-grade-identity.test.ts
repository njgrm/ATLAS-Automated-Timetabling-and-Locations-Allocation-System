/**
 * A2 c15 — A SECTION'S GRADE IS 7-10, NEVER EnrollPro's `grade_level_id`.
 *
 * Run (server workspace): `npm run test:a2-c15-grade-identity`
 *
 * THE DEFECT, quoted from the packet. EnrollPro re-mints `grade_level_id` on
 * every wipe or rollover, so the id is never a grade. Measured on `atlas_staging`
 * on 2026-09-28 (planner, read-only):
 *
 *   school_year_id | grade_level_id | grade_level_name | display_order | first_seen
 *   1, 2           | 1, 2, 3, 4    | Grade 7..10      | 7, 8, 9, 10  | 2026-09-28 14:39:59
 *   8, 9, 10       | 17,18,19,20   | Grade 7..10      | 7, 8, 9, 10  | 2026-09-06
 *   pre-09-28 feed | 5, 6, 7, 8    | Grade 7..10      | 7, 8, 9, 10  | (earlier)
 *
 * THE FIXTURES BELOW ARE THAT TABLE, not invented values (AGENTS.md §11: a
 * control validated against an invented fixture once passed while live stayed
 * broken). Every row must produce 7..10 through every entry point.
 *
 * COVERAGE MAP — one row per packet site, each deciding its own site:
 *   S2  pre-generation-draft shape contract grade      (behavioural — C15-S2-3)
 *   S2  pre-generation-draft per-grade shift window   (wiring row — see note)
 *   S3  published-schedule `SectionReference.gradeLevel`              (wiring row)
 *   S4  published identity snapshot frozen `gradeLevel`               (behavioural)
 *   S5  workbook frozen-snapshot export rows                          (behavioural)
 *   D1  the private `resolveSectionGradeLevel` that shadowed the shared authority
 *   L1  locked-session canonical scope                                (wiring row)
 *   L2  draft canonical `classProgramSlot` scope                      (wiring row)
 *   L3  draft validator window scope                                  (behavioural)
 *   L4  section-adapter fallback GRADE LABEL                          (behavioural)
 *
 * COVERAGE NOTE, stated rather than hidden. Four sites have no pure or
 * client-injectable seam, so their rows are source-contract (wiring)
 * assertions and are LABELLED `WIRING`. They are not acceptance evidence for
 * those sites:
 *   - S2's shift-window lookup and L2's canonical-grid lookup live inside
 *     `loadDraftContext`, which is private and unconditionally calls
 *     `buildDerivedDemand()` (ambient Prisma plus a verified EnrollPro term
 *     contract). Proving them behaviourally needs a mounted disposable database,
 *     which is out of this packet's scope.
 *   - S3's `resolvePublishedRun` and L1's `createLock` read the ambient Prisma
 *     client with no override parameter.
 * What DOES carry those four: the shared authority rows, S2-3 (the production
 * shape contract), the S4/S5 behavioural rows that read the same mirror leg, the
 * L3 behavioural rows (the same grade scope in the same service), the
 * preservation suites named in the handoff, and the browser row.
 * The S2 shift-window and L2 canonical-scope WIRING rows are the two a reviewer
 * should weigh most carefully, and the mounted-DB suite is the follow-up that
 * would close them.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { gradeNumberOf, resolveSectionGradeLevel, buildGradeLevelRegistry } from '../services/grade-level-resolver.js';
import { normalizeEnrollProSectionsResponse } from '../services/section-adapter.js';
import { buildPreGenerationValidatorContext } from '../services/pre-generation-draft.service.js';
import { frozenReferenceMaps, type PublishedIdentitySnapshot } from '../services/published-identity-snapshot.service.js';
import { loadExportContext } from '../services/workbook-export.service.js';
import { buildRunTimetableShapeContracts } from '../services/generation-shape-assembly.service.js';

const readSource = (relative: string): string =>
	readFileSync(resolve(import.meta.dirname, '..', '..', '..', relative), 'utf8');

/** The measured staging rows, verbatim. */
const STAGING_ROWS: Array<{ note: string; gradeLevelId: number; gradeLevelName: string; displayOrder: number; expected: number }> = [
	{ note: 'SY1/2 post-re-mint id 1', gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'SY1/2 post-re-mint id 2', gradeLevelId: 2, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'SY1/2 post-re-mint id 3', gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'SY1/2 post-re-mint id 4', gradeLevelId: 4, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
	{ note: 'SY8-10 id 17', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'SY8-10 id 18', gradeLevelId: 18, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'SY8-10 id 19', gradeLevelId: 19, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'SY8-10 id 20', gradeLevelId: 20, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
	{ note: 'legacy id 5', gradeLevelId: 5, gradeLevelName: 'Grade 7', displayOrder: 7, expected: 7 },
	{ note: 'legacy id 6', gradeLevelId: 6, gradeLevelName: 'Grade 8', displayOrder: 8, expected: 8 },
	{ note: 'legacy id 7', gradeLevelId: 7, gradeLevelName: 'Grade 9', displayOrder: 9, expected: 9 },
	{ note: 'legacy id 8', gradeLevelId: 8, gradeLevelName: 'Grade 10', displayOrder: 10, expected: 10 },
];

// ─── C15-AUTH: the one server authority ─────────────────────────────────────

test('C15-AUTH-1. every measured staging row resolves to its real grade 7-10', () => {
	for (const row of STAGING_ROWS) {
		assert.equal(gradeNumberOf(row), row.expected, `${row.note}: gradeNumberOf must return ${row.expected}`);
		assert.equal(resolveSectionGradeLevel(row), row.expected, `${row.note}: resolveSectionGradeLevel must return ${row.expected}`);
	}
});

test('C15-AUTH-2. name first, then displayOrder only inside 7-12, never the id', () => {
	// A name that disagrees with the id: the name is the grade.
	assert.equal(gradeNumberOf({ gradeLevelId: 3, gradeLevelName: 'Grade 7', displayOrder: 7 }), 7);
	// No name: the measured displayOrder is the second reliable source.
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 7 }), 7);
	assert.equal(gradeNumberOf({ gradeLevelId: 20, displayOrder: 10 }), 10);
	// A name outside the JHS band is not a grade, and must not stop the next leg.
	assert.equal(gradeNumberOf({ gradeLevelName: 'Grade 1', displayOrder: 7 }), 7);
	assert.equal(gradeNumberOf({ gradeLevelName: 'Kinder', displayOrder: 7 }), 7);
	assert.equal(gradeNumberOf({ gradeLevelName: 'Grade 1', displayOrder: 0 }), null);
	// A displayOrder outside 7-12 is a sentinel, not a grade.
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 0 }), null);
	assert.equal(gradeNumberOf({ gradeLevelId: 1, displayOrder: 3 }), null);
	// Upstream name shapes.
	assert.equal(gradeNumberOf({ gradeLevelName: 'GRADE 9 - STE' }), 9);
	assert.equal(gradeNumberOf({ gradeLevelName: 'grade10' }), 10);
});

test('C15-AUTH-3. C15-NEG — an id-only reference yields no grade, never the id', () => {
	for (const gradeLevelId of [1, 2, 3, 4, 5, 6, 7, 8, 17, 18, 19, 20]) {
		assert.equal(gradeNumberOf({ gradeLevelId }), null, `gradeLevelId ${gradeLevelId} alone must never be read as a grade`);
	}
	// The two labels the defect produced must not be constructible from an id.
	assert.equal(gradeNumberOf({ gradeLevelId: 1 }) === 1, false, 'gradeNumberOf must not yield 1 for gradeLevelId 1');
	assert.ok(!`Grade ${gradeNumberOf({ gradeLevelId: 1 })}`.includes('Grade 1'), 'no "Grade 1" label may be produced from an id');
});

test('C15-AUTH-4. resolveSectionGradeLevel still answers for a consumer that needs a number', () => {
	// Registry leg, unchanged from the 2026-09-28 hotfix.
	const registry = buildGradeLevelRegistry([
		{ gradeLevelId: 5, gradeLevelName: 'Grade 9' },
		{ gradeLevelId: 6, gradeLevelName: null },
	]);
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 5 }, registry), 9);
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 6 }, registry), 8);
	// Legacy leg, for an unnamed row the registry cannot help.
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 17 }), 7);
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 20 }), 10);
	// The documented difference: a name/orderless post-re-mint id 1 has no grade.
	// It must stay unresolvable rather than silently becoming Grade 7.
	assert.equal(gradeNumberOf({ gradeLevelId: 1 }), null);
});

// ─── S2 + L2: WIRING rows (see the coverage note) ──────────────────────────

test('C15-S2-WIRING. the draft shape contract and its shift window are keyed by the authority, not the id', () => {
	const source = readSource('atlas-server/src/services/pre-generation-draft.service.ts');
	// The contract grade and both window lookups must read the resolved grade.
	assert.equal(/buildTimetableShapeContract\(\{\s*\n\s*gradeLevel,/.test(source), true, 'S2: the shape contract must be built for the resolved grade');
	assert.equal(/window\.gradeLevel === grade\.gradeLevelId/.test(source), false, 'S2: the per-grade shift window must not be matched on the EnrollPro id');
	assert.equal(/const gradeLevel = resolveSectionGradeLevel\(grade\)/.test(source), true, 'S2: the grade must come from the authority');
	// The one place the raw id may still appear is the authority's own call.
	const idAssignments = source.match(/gradeLevel:\s*[\w.]*gradeLevelId\b/g) ?? [];
	assert.deepEqual(idAssignments, [], 'S2: no grade may be assigned from the EnrollPro id');
});

test('C15-L2-WIRING. the draft canonical classProgramSlot scope is resolved by the authority', () => {
	const source = readSource('atlas-server/src/services/pre-generation-draft.service.ts');
	assert.equal(/function canonicalScopeGrade/.test(source), true, 'L2: the canonical scope helper must exist');
	assert.equal(/return gradeNumberOf\(grade\)/.test(source), true, 'L2: the canonical scope must come from the authority');
	assert.equal(/canonicalRowsByScope\.get\(`\$\{canonicalScope\}/.test(source), true, 'L2: the canonical lookup must use the resolved scope');
	// A null scope must not be turned into a fabricated grade.
	assert.equal(/canonicalScope === null \? \[\]/.test(source), true, 'L2: an unresolved scope must adopt no canonical rows');
});

// ─── L3: the draft validator's window scope ─────────────────────────────────

const POLICY_RECORD = {
	periodLengthMinutes: 50,
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 10,
	maxTeachingMinutesPerDay: 360,
	earliestStartTime: '06:00',
	latestEndTime: '17:00',
	enforceConsecutiveBreakAsHard: true,
	avoidEarlyFirstPeriod: false,
	avoidLateLastPeriod: false,
	maxBuildingTransitionsPerDay: 99,
	maxBackToBackTransitionsWithoutBuffer: 99,
	maxIdleGapMinutesPerDay: 999,
	enableBuildingTransitionChecks: false,
	enableFloorTransitionChecks: false,
	enableIdleGapChecks: false,
	enableEarlyStartChecks: false,
	enableLateEndChecks: false,
};

function validatorSection(overrides: Record<string, unknown>) {
	return { id: 9501, name: 'RIZAL', gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: null, programType: 'REGULAR', ...overrides };
}

function validatorContext(sectionsById: Map<number, unknown>, extra: Record<string, unknown> = {}) {
	return {
		policyRecord: POLICY_RECORD,
		sectionsById,
		gradeWindows: [],
		specialEvents: [],
		classProgramSlots: [],
		facultyRefs: [],
		facultySubjects: [],
		rooms: [],
		subjects: [],
		sectionEnrollment: new Map<number, number>(),
		...extra,
	} as never;
}

test('C15-L3-1. the validator section scope is the REAL grade when displayOrder is absent', () => {
	// The latent case the packet names: `displayOrder` absent. On the base this
	// read the mirror's displayOrder and fell back to the EnrollPro id = 1, so the
	// section's warning scope was grade 1 and no Grade 7 break/shift window could
	// ever apply to it.
	const ctx = buildPreGenerationValidatorContext(1, 1, [], validatorContext(
		new Map([[9501, validatorSection({})]]),
		{
			specialEvents: [{
				eventType: 'SHORT_BREAK', label: 'Snack', startTime: '09:40', endTime: '09:50',
				gradeGroup: 'GRADE_7', programType: 'REGULAR', dayOfWeek: null, enabled: true,
			}],
		},
	));

	assert.equal(ctx.sectionScope!.get(9501)?.gradeLevel, 7, 'the validator section scope must be the real grade 7, never the EnrollPro id 1');
});

test('C15-L3-2. C15-NEG — an id-only section is not scoped to grade 1 and adopts no id-keyed window', () => {
	const ctx = buildPreGenerationValidatorContext(1, 1, [], validatorContext(
		new Map([[9501, validatorSection({ gradeLevelName: null })]]),
		{
			// A break window keyed on the EnrollPro id 1. Only a raw-id scope would
			// ever reach it.
			specialEvents: [{
				eventType: 'SHORT_BREAK', label: 'Snack', startTime: '04:00', endTime: '04:10',
				gradeGroup: '1', programType: 'REGULAR', dayOfWeek: null, enabled: true,
			}],
		},
	));

	assert.equal(ctx.sectionScope!.get(9501)?.gradeLevel, 0, 'a section naming no real grade must not be scoped to the EnrollPro id 1');
	assert.equal(
		(ctx.breakWindows ?? []).some((window) => window.startTime === '04:00' && window.endTime === '04:10'),
		false,
		'a break window keyed on the EnrollPro id 1 must not be adopted for a section with no real grade',
	);
});

// ─── S4: the frozen published identity snapshot ─────────────────────────────

function frozenSnapshot(sections: Record<string, { name: string; gradeLevelId: number | null; gradeLevelName: string | null }>): PublishedIdentitySnapshot {
	return {
		schemaVersion: 1,
		runId: 1,
		schoolId: 1,
		schoolYearId: 1,
		createdAt: '2026-09-29T00:00:00.000Z',
		runSummary: { runId: 1, schoolId: 1, schoolYearId: 1, status: 'COMPLETED', isPublished: true, publishedAt: '2026-09-29T00:00:00.000Z' },
		entries: [],
		displaySlots: [],
		subjects: {},
		faculty: {},
		advisers: {},
		rooms: {},
		buildings: {},
		sections,
		cohorts: {},
		specializations: {},
		termContract: null,
	} as unknown as PublishedIdentitySnapshot;
}

test('C15-S4-1. the frozen snapshot grade is the real grade, recoverable from its own name field', () => {
	const snapshot = frozenSnapshot({
		'9501': { name: 'RIZAL', gradeLevelId: 1, gradeLevelName: 'Grade 7' },
		'9502': { name: 'ORCHID', gradeLevelId: 2, gradeLevelName: 'Grade 8' },
		'9503': { name: 'SANTOS', gradeLevelId: 17, gradeLevelName: 'Grade 7' },
		'9504': { name: 'DELA CRUZ', gradeLevelId: 5, gradeLevelName: 'Grade 7' },
	});
	const maps = frozenReferenceMaps(snapshot);
	assert.equal(maps.sectionById.get(9501)?.gradeLevel, 7, 'id 1 named Grade 7 must freeze as grade 7');
	assert.equal(maps.sectionById.get(9502)?.gradeLevel, 8, 'id 2 named Grade 8 must freeze as grade 8');
	assert.equal(maps.sectionById.get(9503)?.gradeLevel, 7, 'id 17 named Grade 7 must freeze as grade 7');
	assert.equal(maps.sectionById.get(9504)?.gradeLevel, 7, 'id 5 named Grade 7 must freeze as grade 7');
	for (const [, ref] of maps.sectionById) {
		assert.ok(ref.gradeLevel === null || (ref.gradeLevel >= 7 && ref.gradeLevel <= 12), 'a frozen grade is never 1..4');
	}
});

test('C15-S4-2. C15-NEG — a frozen row with no grade name freezes no grade rather than the id', () => {
	const maps = frozenReferenceMaps(frozenSnapshot({
		'9501': { name: 'UNNAMED', gradeLevelId: 1, gradeLevelName: null },
	}));
	assert.equal(maps.sectionById.get(9501)?.gradeLevel, null, 'an unnamed frozen row must not freeze grade 1');
});

test('C15-S4-3. the frozen snapshot the S4/S5 rows use is the shape the service reads', () => {
	// The S4 and S5 rows build a minimal snapshot; this pins that its `sections`
	// rows carry the two fields the grade can be recovered from.
	const snapshot = frozenSnapshot({ '9501': { name: 'RIZAL', gradeLevelId: 1, gradeLevelName: 'Grade 7' } });
	assert.deepEqual(snapshot.sections['9501'], { name: 'RIZAL', gradeLevelId: 1, gradeLevelName: 'Grade 7' });
});

// ─── S5 + D1: the workbook roster boundary ──────────────────────────────────

test('C15-S5-1. the live export roster resolves each section grade through the authority', async () => {
	const client = {
		generationRun: { findFirst: async () => ({ id: 7, status: 'COMPLETED', summary: { isPublished: false }, draftEntries: [] }) },
		school: { findUnique: async () => ({ name: 'Test School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		sectionMirror: {
			findMany: async () => STAGING_ROWS.map((row, index) => ({
				id: 900 + index,
				externalId: 9500 + index,
				name: row.note,
				gradeLevelId: row.gradeLevelId,
				gradeLevelName: row.gradeLevelName,
				displayOrder: row.displayOrder,
				programType: 'REGULAR',
			})),
		},
		facultyMirror: { findMany: async () => [] },
		subject: { findMany: async () => [] },
		room: { findMany: async () => [] },
	};
	const ctx = await loadExportContext({ schoolId: 1, schoolYearId: 1, runId: 7, client });
	assert.equal(ctx.sections.length, STAGING_ROWS.length);
	for (const [index, row] of STAGING_ROWS.entries()) {
		assert.equal(ctx.sections[index].gradeLevel, row.expected, `${row.note}: the export roster must carry grade ${row.expected}`);
	}
	// The resolved shape carries no id at all, so no later call site can read one.
	for (const section of ctx.sections) {
		assert.equal('gradeLevelId' in section, false, 'the export roster row must not carry gradeLevelId');
	}
});

test('C15-S5-2. the frozen export roster resolves the grade from the snapshot name', async () => {
	const snapshot = frozenSnapshot({
		'9501': { name: 'RIZAL', gradeLevelId: 1, gradeLevelName: 'Grade 7' },
		'9502': { name: 'ORCHID', gradeLevelId: 2, gradeLevelName: 'Grade 8' },
		'9503': { name: 'SANTOS', gradeLevelId: 20, gradeLevelName: 'Grade 10' },
	});
	const client = {
		generationRun: { findFirst: async () => ({ id: 7, status: 'COMPLETED', summary: { isPublished: true }, draftEntries: [] }) },
		school: { findUnique: async () => ({ name: 'Test School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2026-2027' }) },
		sectionMirror: { findMany: async () => [] },
		facultyMirror: { findMany: async () => [] },
		subject: { findMany: async () => [] },
		room: { findMany: async () => [] },
	};
	const ctx = await loadExportContext({
		schoolId: 1, schoolYearId: 1, runId: 7, client,
		publishedRunResolver: async () => ({ source: { runId: 7 }, entries: [], summary: { isPublished: true }, snapshot }),
	});
	assert.deepEqual(ctx.sections.map((s) => [s.externalId, s.gradeLevel]).sort(), [[9501, 7], [9502, 8], [9503, 10]]);
});

// ─── L4: the section adapter's fallback GRADE LABEL ──────────────────────────

test('C15-L4-1. the adapter fallback label is the real grade, never "Grade 1"', () => {
	const normalized = normalizeEnrollProSectionsResponse({
		gradeLevels: [
			// No name, but displayOrder carries the grade.
			{ gradeLevelId: 1, displayOrder: 7, sections: [] },
			{ gradeLevelId: 2, displayOrder: 8, sections: [] },
			// A supplied name is used verbatim.
			{ gradeLevelId: 3, gradeLevelName: 'Grade 9', displayOrder: 9, sections: [] },
			// No name and no usable displayOrder: the label must not be fabricated
			// from the EnrollPro id.
			{ gradeLevelId: 4, displayOrder: 0, sections: [] },
		],
	});
	const names = normalized.gradeLevels.map((grade) => grade.gradeLevelName);
	assert.deepEqual(names, ['Grade 7', 'Grade 8', 'Grade 9', 'Unknown grade']);
	assert.equal(names.includes('Grade 1'), false, 'no "Grade 1" label may be produced from an EnrollPro id');
	assert.equal(names.includes('Grade 4'), false, 'no "Grade 4" label may be produced from an EnrollPro id');
	// Every group still reports a resolvable grade through the authority.
	assert.equal(gradeNumberOf(normalized.gradeLevels[0]), 7);
	assert.equal(gradeNumberOf(normalized.gradeLevels[1]), 8);
	assert.equal(gradeNumberOf(normalized.gradeLevels[2]), 9);
	assert.equal(gradeNumberOf(normalized.gradeLevels[3]), null);
});

// ─── S2 (assembly parity) + the production shape contract ───────────────────

test('C15-S2-3. the draft and the generated shape contract resolve the SAME grade for the same mirror', () => {
	// The generation path already routed through the shared authority; this row
	// pins that the draft leg (S2) now agrees with it instead of the EnrollPro id.
	for (const row of STAGING_ROWS) {
		const contracts = buildRunTimetableShapeContracts({
			sectionsByGrade: [{
				gradeLevelId: row.gradeLevelId,
				gradeLevelName: row.gradeLevelName,
				displayOrder: row.displayOrder,
				sections: [],
			}] as never,
			gradeWindows: [],
			templateProfiles: [],
			policy: undefined as never,
		});
		assert.deepEqual(contracts.map((c) => c.gradeLevel), [row.expected], `${row.note}: the shape contract must be for grade ${row.expected}`);
	}
});

// ─── Wiring rows for the two sites with no injectable seam ──────────────────
// These assert the call site, not behaviour, and are LABELLED wiring rows.

test('C15-S3-WIRING. the published payload builds its grade from the authority, not the id', () => {
	const source = readSource('atlas-server/src/services/published-schedule.service.ts');
	assert.equal(/gradeLevel:\s*section\.gradeLevelId\b/.test(source), false, 'S3 must not assign the raw EnrollPro id to the published payload grade');
	assert.equal(/gradeLevel:\s*gradeNumberOf\(section\)/.test(source), true, 'S3 must assign the authority result');
});

test('C15-L1-WIRING. the locked-session canonical scope is resolved by the authority', () => {
	const source = readSource('atlas-server/src/services/locked-session.service.ts');
	assert.equal(/displayOrder\s*\?\?\s*section\.gradeLevelId/.test(source), false, 'L1 must not read displayOrder ?? gradeLevelId');
	assert.equal(/const gradeLevel = gradeNumberOf\(section\)/.test(source), true, 'L1 must resolve the grade through gradeNumberOf');
	assert.equal(/gradeLevelName: true/.test(source), true, 'L1 must select gradeLevelName, the primary authority field');
});

test('C15-D1-REMOVED. the workbook no longer defines a second grade resolver', () => {
	const source = readSource('atlas-server/src/services/workbook-export.service.ts');
	// The shared name must be IMPORTED, not DEFINED.
	assert.equal(/^function resolveSectionGradeLevel\(/m.test(source), false, 'D1: the private resolver must be deleted');
	assert.equal(/from '\.\/grade-level-resolver\.js'/.test(source), true, 'D1: the shared authority must be imported');
	// The narrow name regex that could not read "grade7" must be gone from code.
	assert.equal(/\.match\(\/Grade/.test(source), false, 'D1: the narrow name regex must be gone');
	// No production site may read an EnrollPro id as a grade.
	assert.equal(/gradeLevelId\s*\?\?/.test(source), false, 'no export row may default a grade from gradeLevelId');
	assert.equal(/resolveSectionGradeLevel\((?:a|b|section|sec|group\[0\])/.test(source), false, 'grade reads must use the pre-resolved roster field');
	// Every id that remains in the module is a SELECT column, never a grade value.
	const idReads = source.match(/gradeLevelId:(?! true)/g) ?? [];
	assert.deepEqual(idReads, [], 'gradeLevelId may appear in a select list only');
});

test('C15-GREP-PROOF. no production path reads an EnrollPro grade id as a grade', () => {
	const productionFiles = [
		'atlas-server/src/services/pre-generation-draft.service.ts',
		'atlas-server/src/services/locked-session.service.ts',
		'atlas-server/src/services/published-schedule.service.ts',
		'atlas-server/src/services/published-identity-snapshot.service.ts',
		'atlas-server/src/services/workbook-export.service.ts',
		'atlas-server/src/services/section-adapter.ts',
		'atlas-server/src/services/official-program-docx.service.ts',
		'atlas-client/src/components/faculty/teacherWorkloadProfile.ts',
		'atlas-client/src/components/faculty/FacultyRow.tsx',
		'atlas-client/src/lib/schedule-review-helpers.ts',
		'atlas-client/src/lib/faculty-assignment-helpers.ts',
	];
	for (const file of productionFiles) {
		const source = readSource(file);
		for (const pattern of [/gradeLevelId\s*\?\?/, /gradeLevel:\s*[\w.]*gradeLevelId\b/, /displayOrder\s*\?\?\s*[\w.]*gradeLevelId/, /GR\$\{[^}]*[Ii]d/]) {
			assert.equal(pattern.test(source), false, `${file} must not contain ${pattern}`);
		}
	}
});

/**
 * A REAL repository-wide sweep, walking the production source ON DISK.
 *
 * WHY THIS ROW WAS REWRITTEN (A2 c15 correction round 3). The previous version
 * of this proof called `readSource()` on ONE file and its comment claimed to
 * describe a repository-wide grep. It could not see past that one file, which
 * is exactly how a FOURTH private grade resolver
 * (`teacher-program-export.service.ts::parseGradeNumber`) survived two review
 * rounds. A gate that certifies a scope it cannot see is worse than no gate, so
 * this row now enumerates every `.ts`/`.tsx` under `atlas-server/src` and
 * `atlas-client/src`, excluding `__tests__` and `qa-artifacts`, and asserts
 * against the FULL hit set. Every remaining hit is named and shape-matched, so
 * a new one fails here instead of surviving to a reviewer.
 *
 * Measured on the current candidate: the loose `gradeLevel: .*gradeLevelId`
 * pattern returns 3 hits in 1 production file (15 in 4 files if `__tests__` is
 * included, which is where test fixtures and legacy assertions live).
 */
function productionSourceFiles(): string[] {
	const roots = [
		resolve(import.meta.dirname, '..', '..', '..', 'atlas-server', 'src'),
		resolve(import.meta.dirname, '..', '..', '..', 'atlas-client', 'src'),
	];
	const out: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === '__tests__' || entry.name === 'qa-artifacts') continue;
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.tsx?$/.test(entry.name)) out.push(full);
		}
	};
	for (const root of roots) walk(root);
	return out;
}

type SourceHit = { file: string; line: number; text: string };

function sweepProductionSources(pattern: RegExp): SourceHit[] {
	const hits: SourceHit[] = [];
	for (const file of productionSourceFiles()) {
		const rel = file.slice(file.indexOf('atlas-')).replace(/\\/g, '/');
		readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, index) => {
			if (pattern.test(text)) hits.push({ file: rel, line: index + 1, text: text.trim() });
		});
	}
	return hits;
}

test('C15-GREP-SWEEP. a real repository-wide sweep finds no id read as a grade', () => {
	// The four greps the packet named, run over EVERY production file on disk.
	// Each must be empty repo-wide. These are NOT weakened by the per-file row
	// above; that row is a subset of this one.
	const FORBIDDEN: Array<{ name: string; pattern: RegExp }> = [
		{ name: 'gradeLevelId ??', pattern: /gradeLevelId\s*\?\?/ },
		// The TIGHT form: the grade VALUE is the id.
		{ name: 'gradeLevel: <id>', pattern: /gradeLevel:\s*[\w.]*gradeLevelId\b/ },
		{ name: 'displayOrder ?? ... gradeLevelId', pattern: /displayOrder\s*\?\?\s*[\w.]*gradeLevelId/ },
		{ name: 'GR${...id}', pattern: /GR\$\{[^}]*[Ii]d/ },
	];
	for (const { name, pattern } of FORBIDDEN) {
		const hits = sweepProductionSources(pattern);
		assert.deepEqual(
			hits.map((hit) => `${hit.file}:${hit.line}: ${hit.text}`),
			[],
			`repo-wide sweep found ${name}`,
		);
	}

	// A private local resolver would declare a grade function of its own. The four
	// this range deleted each had one, and the fourth is the reason this sweep
	// exists: a NEW `function parseGradeNumber|resolveSectionGradeNumber|
	// getSectionGradeNumber` anywhere else is a second authority.
	//
	// Exactly two declarations are legitimate — the two sanctioned re-exports of
	// the ONE authority — and they are pinned to their own files, so the check
	// cannot be satisfied by moving one, duplicating one, or adding a third.
	const SANCTIONED_DECLARATIONS: Record<string, string[]> = {
		'atlas-server/src/services/teaching-load-carry-forward.service.ts': ['resolveCarryForwardGrade'],
		'atlas-client/src/lib/schedule-review-helpers.ts': ['resolveSectionGradeNumber'],
	};
	const declared = sweepProductionSources(
		/^\s*(?:export\s+)?function\s+(parseGradeNumber|resolveSectionGradeNumber|getSectionGradeNumber|resolveCarryForwardGrade)\s*\(/,
	).map((hit) => ({ ...hit, name: /function\s+(\w+)\s*\(/.exec(hit.text)?.[1] ?? '' }));
	for (const hit of declared) {
		assert.deepEqual(
			SANCTIONED_DECLARATIONS[hit.file] ?? [],
			[hit.name],
			`${hit.file}:${hit.line} declares "${hit.name}", which is not a sanctioned re-export of the one authority`,
		);
	}
	assert.equal(declared.length, 2, `exactly two sanctioned grade-authority re-exports must exist; saw ${declared.length}`);

	// Both must actually delegate, so the allowlist cannot be satisfied by a
	// function that computes a grade its own way.
	assert.match(
		readSource('atlas-server/src/services/teaching-load-carry-forward.service.ts'),
		/return resolveSectionGradeLevel\(\{ gradeLevelId, gradeLevelName \}, null, 'grade-first'\);/,
		'the server re-export must delegate to the shared authority',
	);
	assert.match(
		readSource('atlas-client/src/lib/schedule-review-helpers.ts'),
		/export function resolveSectionGradeNumber\(section: ExternalSection\): number \| null \{\s*\n\s*return gradeNumberOf\(section\);/,
		'the client re-export must delegate to the shared authority',
	);
});

test('C15-GREP-ACCOUNTED. every remaining loose `gradeLevel: ... gradeLevelId` hit is accounted for', () => {
	// The LOOSE form: `.*` also matches a call ARGUMENT list, so a line that
	// hands the id TO the authority matches even though the grade value is
	// correct. Measured repo-wide: 3 hits, 1 file.
	const loose = sweepProductionSources(/gradeLevel:\s*.*gradeLevelId/);
	assert.equal(
		loose.length,
		3,
		`the loose repo-wide sweep must return exactly three accounted lines; saw ${loose.length}: ${JSON.stringify(loose.map((h) => `${h.file}:${h.line}`))}`,
	);
	assert.deepEqual(
		[...new Set(loose.map((hit) => hit.file))],
		['atlas-server/src/services/teaching-load-carry-forward.service.ts'],
		'all three accounted lines must be in teaching-load-carry-forward and nowhere else',
	);
	for (const hit of loose) {
		// Each hands the id AND the name to the shared authority — never a bare
		// id, never a name-less read.
		assert.match(
			hit.text,
			/gradeLevel: resolveCarryForwardGrade\([\w.]+gradeLevelId, [\w.]+gradeLevelName\),/,
			`unaccounted loose hit at ${hit.file}:${hit.line}: ${hit.text}`,
		);
	}

	// The resolver those three lines call is the shared authority, not a second
	// one, and it reads the name first.
	const source = readSource('atlas-server/src/services/teaching-load-carry-forward.service.ts');
	assert.match(
		source,
		/export function resolveCarryForwardGrade\(gradeLevelId: number, gradeLevelName\?: string \| null\): number \{\s*\n\s*return resolveSectionGradeLevel\(\{ gradeLevelId, gradeLevelName \}, null, 'grade-first'\);/,
		'resolveCarryForwardGrade must delegate to the shared authority',
	);
});
