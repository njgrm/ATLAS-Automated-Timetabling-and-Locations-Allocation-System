/**
 * Hotfix 2026-09-28 — EnrollPro grade NAME is the grade authority.
 *
 * Run (server workspace): `npx tsx --test src/__tests__/grade-level-name-authority-hotfix.test.ts`
 *
 * Live finding: after the EnrollPro wipe, section_mirrors for the active year
 * carry grade_level_id 1..4 named 'Grade 7'..'Grade 10'. The hard-coded id map
 * resolved 1..4 to no JHS grade, so derived demand was empty and the Teaching
 * Load suggestion reported 0 rows as "balanced". A future rollover minting ids
 * 5..8 would have resolved id 7 ('Grade 7') to Grade 9.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDerivedDemand } from '../services/derived-demand.service.js';
import { buildRunTimetableShapeContracts } from '../services/generation-shape-assembly.service.js';
import { resolveCarryForwardGrade, canonicalCarryForwardSectionKeyFromMirror } from '../services/teaching-load-carry-forward.service.js';
import { buildSectionScopeMap } from '../services/generation-preflight.service.js';
import {
	buildGradeLevelRegistry,
	gradeFromGradeLevelName,
	resolveSectionGradeLevel,
} from '../services/grade-level-resolver.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';
import type { SectionsByGrade } from '../services/section-adapter.js';

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 1;

const TERM_CONTRACT: VerifiedTermContract = {
	schoolId: SCHOOL_ID,
	schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2026-2027' },
	format: 'QUARTERS',
	terms: [
		{ identity: 'Q1', displayLabel: 'First Quarter', order: 1, startDate: '2026-06-01', endDate: '2026-08-01' },
		{ identity: 'Q2', displayLabel: 'Second Quarter', order: 2, startDate: '2026-08-02', endDate: '2026-10-01' },
		{ identity: 'Q3', displayLabel: 'Third Quarter', order: 3, startDate: '2026-10-02', endDate: '2027-01-01' },
		{ identity: 'Q4', displayLabel: 'Fourth Quarter', order: 4, startDate: '2027-01-02', endDate: '2027-04-01' },
	],
	semanticRevision: 'B'.repeat(64),
	activeTerm: { identity: 'Q1', displayLabel: 'First Quarter', order: 1 },
	activeTermState: { availability: 'RESOLVED', code: null, message: 'resolved', reachable: true, identity: 'Q1' },
};

type MirrorRow = { id: number; externalId: number; displayOrder: number; gradeLevelId: number; gradeLevelName: string | null; programType: string; isActiveForScheduling: boolean; isStale: boolean };

function subject(id: number, code: string, gradeLevels: number[]) {
	return {
		id, code, name: code, schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels, programScopes: ['REGULAR'],
		rotationFamily: null, modularOrder: null, minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', requiredFeatures: [], isActive: true,
	};
}

/** Minimal read-only client: exactly the reads `buildDerivedDemand` performs. */
function demandClient(sections: MirrorRow[]) {
	return {
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2026-2027' }],
		},
		sectionMirror: { findMany: async () => sections },
		subject: {
			findMany: async () => [
				subject(11, 'MATH7', [7]),
				subject(12, 'ENG7', [7]),
				subject(21, 'MATH9', [9]),
			],
		},
		schedulingPolicy: { findUnique: async () => ({ periodLengthMinutes: 60 }) },
	};
}

function mirror(id: number, gradeLevelId: number, gradeLevelName: string | null, displayOrder = 7): MirrorRow {
	return { id, externalId: 9000 + id, displayOrder, gradeLevelId, gradeLevelName, programType: 'REGULAR', isActiveForScheduling: true, isStale: false };
}

async function demandFor(sections: MirrorRow[]) {
	const result = await buildDerivedDemand(SCHOOL_ID, SCHOOL_YEAR_ID, { client: demandClient(sections) as never, termContract: TERM_CONTRACT });
	assert.equal(result.ok, true, `derived demand must succeed: ${JSON.stringify(!result.ok ? result.blockers : null)}`);
	if (!result.ok) throw new Error('unreachable');
	return result;
}

test('H1. post-wipe id 1 named "Grade 7" produces Grade 7 SCHEDULED_TEACHING demand', async () => {
	const result = await demandFor([mirror(501, 1, 'Grade 7')]);
	assert.ok(result.timetableLines.length > 0, 'demand rows must exist for Grade 7 subjects');
	assert.equal(result.timetableLines.every((line) => line.gradeLevel === 7), true);
	const subjectIds = new Set(result.timetableLines.map((line) => line.subjectId));
	assert.deepEqual([...subjectIds].sort(), [11, 12], 'only the Grade 7 subjects apply');
});

test('H2. a future rollover id 7 named "Grade 7" resolves to Grade 7, never Grade 9', async () => {
	const result = await demandFor([mirror(502, 7, 'Grade 7')]);
	assert.equal(result.timetableLines.every((line) => line.gradeLevel === 7), true);
	assert.equal(result.timetableLines.some((line) => line.subjectId === 21), false, 'Grade 9 MATH must not apply');
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 7, gradeLevelName: 'Grade 7' }), 7);
	assert.equal(resolveCarryForwardGrade(7, 'Grade 7'), 7);
});

test('H3. legacy id 17 without a name still resolves to Grade 7', async () => {
	const result = await demandFor([mirror(503, 17, null)]);
	assert.ok(result.timetableLines.length > 0);
	assert.equal(result.timetableLines.every((line) => line.gradeLevel === 7), true);
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 17 }), 7);
	assert.equal(resolveCarryForwardGrade(17), 7);
});

test('H4. an unnamed section learns its grade from a named sibling of the same year', async () => {
	const result = await demandFor([mirror(504, 3, 'Grade 9', 9), mirror(505, 3, null, 9)]);
	const sectionsWithDemand = new Set(result.timetableLines.map((line) => line.sectionMirrorId));
	assert.deepEqual([...sectionsWithDemand].sort(), [504, 505]);
	assert.equal(result.timetableLines.every((line) => line.gradeLevel === 9 && line.subjectId === 21), true);
});

test('H5. generation shape contracts and scope maps take the grade from the name', () => {
	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 1,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ mirrorId: 501, id: 9501, name: '7-A', maxCapacity: 40, enrolledCount: 35, gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
	const contracts = buildRunTimetableShapeContracts({
		sectionsByGrade,
		gradeWindows: [],
		templateProfiles: [],
		policy: undefined,
	});
	assert.deepEqual(contracts.map((contract) => contract.gradeLevel), [7]);
	assert.equal(buildSectionScopeMap(sectionsByGrade).get(9501)?.gradeLevel, 7);
	// Carry-forward identity must match across a source year (17) and a target year (1).
	assert.equal(
		canonicalCarryForwardSectionKeyFromMirror({ gradeLevelId: 1, gradeLevelName: 'Grade 7', programType: 'REGULAR', name: '7-A' }),
		canonicalCarryForwardSectionKeyFromMirror({ gradeLevelId: 17, gradeLevelName: 'Grade 7', programType: 'REGULAR', name: '7-A' }),
	);
});

test('H6. name parsing and registry never let the legacy map override a name', () => {
	assert.equal(gradeFromGradeLevelName('Grade 10'), 10);
	assert.equal(gradeFromGradeLevelName('grade7'), 7);
	assert.equal(gradeFromGradeLevelName('Kinder'), null);
	assert.equal(gradeFromGradeLevelName(null), null);
	const registry = buildGradeLevelRegistry([
		{ gradeLevelId: 5, gradeLevelName: 'Grade 9' },
		{ gradeLevelId: 6, gradeLevelName: null },
	]);
	// Legacy map says 5 -> 7; the year's own name says 9.
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 5 }, registry), 9);
	// Not in the registry (no name) -> legacy fallback.
	assert.equal(resolveSectionGradeLevel({ gradeLevelId: 6 }, registry), 8);
	assert.equal(registry.has(6), false);
});
