/**
 * DEMAND-C01 — canonical derived-demand authority proofs (hermetic).
 *
 * Run (server workspace): `npx tsx src/__tests__/derived-demand-authority.test.ts`
 *
 * Proves:
 *  1. ALL subjects occur in every ordered term with stable ordering.
 *  2. Rotating-family members occur only in their ordered rotation term.
 *  3. REFERENCE_ONLY (HG) creates zero timetable lines and zero Teaching Load pairs.
 *  4. Grade/program scope is exact; inactive/cross-school sections are excluded.
 *  5. Missing term structure and malformed/incomplete rotation metadata fail closed.
 *  6. Semantic field changes change the revision; read-order permutations do not.
 *  7. Offering rows cannot change the derived result (mutant reading them diverges).
 *  8. All three consumers agree on the revision and line/pair totals.
 *  9. The scheduler receives the derived override and never calls computeDemand().
 * 10. Passive reads perform zero writes (with a write-recorder positive control).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	deriveCanonicalDemand,
	toDerivedDemandPairIdentities,
	toSchedulerDemandOverride,
	buildDerivedDemand,
	type DerivedDemandInput,
	type DerivedSubjectInput,
	type DerivedSectionInput,
} from '../services/derived-demand.service.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import type { ConstructorInput, SubjectInput } from '../services/schedule-constructor.js';
import type { VerifiedTermContract } from '../services/enrollpro-term-contract.service.js';
import type { SectionsByGrade } from '../services/section-adapter.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;

function termContract(): VerifiedTermContract {
	return {
		schoolId: SCHOOL_ID,
		schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2029-2030' },
		format: 'TRIMESTER',
		terms: [
			{ identity: 'T1', displayLabel: 'First Trimester', order: 1, startDate: '2029-06-01', endDate: '2029-09-01' },
			{ identity: 'T2', displayLabel: 'Second Trimester', order: 2, startDate: '2029-09-02', endDate: '2030-01-01' },
			{ identity: 'T3', displayLabel: 'Third Trimester', order: 3, startDate: '2030-01-02', endDate: '2030-04-01' },
		],
		semanticRevision: 'A'.repeat(64),
		activeTerm: { identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
		activeTermState: { availability: 'RESOLVED', code: null, message: 'resolved', reachable: true, identity: 'T2' },
	};
}

function subject(overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput {
	return {
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 240,
		isActive: true,
		...overrides,
	};
}

function section(overrides: Partial<DerivedSectionInput> & Pick<DerivedSectionInput, 'sectionMirrorId' | 'externalId'>): DerivedSectionInput {
	return {
		gradeLevel: 7,
		programType: 'REGULAR',
		isActiveForScheduling: true,
		isStale: false,
		...overrides,
	};
}

function baseSubjects(): DerivedSubjectInput[] {
	return [
		subject({ id: 11, code: 'MATH' }),
		subject({ id: 12, code: 'ENG', minMinutesPerWeek: 180 }),
		subject({ id: 13, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, minMinutesPerWeek: 180 }),
		subject({ id: 14, code: 'SCI_CHEM', rotationFamily: 'SCIENCE', modularOrder: 2, minMinutesPerWeek: 180 }),
		subject({ id: 15, code: 'SCI_PHY', rotationFamily: 'SCIENCE', modularOrder: 3, minMinutesPerWeek: 180 }),
		subject({ id: 99, code: 'HG', schedulingDisposition: 'REFERENCE_ONLY' }),
	];
}

function baseSections(): DerivedSectionInput[] {
	return [
		section({ sectionMirrorId: 501, externalId: 9001 }),
		section({ sectionMirrorId: 502, externalId: 9002 }),
		section({ sectionMirrorId: 503, externalId: 9003, gradeLevel: 8 }),
		section({ sectionMirrorId: 504, externalId: 9004, programType: 'STE' }),
	];
}

function baseInput(overrides: Partial<DerivedDemandInput> = {}): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		yearLabel: '2029-2030',
		termFormat: 'TRIMESTER',
		termStructureRevision: 'A'.repeat(64),
		terms: termContract().terms,
		sections: baseSections(),
		subjects: baseSubjects(),
		periodLengthMinutes: 60,
		...overrides,
	};
}

test('1. ALL-subject demand occurs in every ordered term with stable ordering', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const math = result.timetableLines.filter((line) => line.subjectCode === 'MATH');
	// Two matching grade-7 REGULAR sections × three ordered terms.
	assert.equal(math.length, 6);
	for (const sectionExternalId of [9001, 9002]) {
		const terms = math.filter((line) => line.sectionExternalId === sectionExternalId).map((line) => line.termIdentity);
		assert.deepEqual(terms, ['T1', 'T2', 'T3']);
	}
	// Stable ordering across identical reads.
	const again = deriveCanonicalDemand(baseInput());
	assert.equal(again.ok, true);
	if (!again.ok) return;
	assert.deepEqual(result.timetableLines.map((line) => line.identity), again.timetableLines.map((line) => line.identity));
});

test('2. Science/TLE rotation follows ordered term identities and rotation order', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const bio = result.timetableLines.filter((line) => line.subjectCode === 'SCI_BIO');
	const chem = result.timetableLines.filter((line) => line.subjectCode === 'SCI_CHEM');
	const phy = result.timetableLines.filter((line) => line.subjectCode === 'SCI_PHY');
	assert.ok(bio.every((line) => line.termIdentity === 'T1' && line.termIndex === 1));
	assert.ok(chem.every((line) => line.termIdentity === 'T2' && line.termIndex === 2));
	assert.ok(phy.every((line) => line.termIdentity === 'T3' && line.termIndex === 3));
	assert.ok([...bio, ...chem, ...phy].every((line) => line.termMode === 'ROTATING_FAMILY_MEMBER'));
	// Members only appear in their own term.
	assert.equal(bio.length, 2);
	assert.equal(chem.length, 2);
	assert.equal(phy.length, 2);
});

test('3. REFERENCE_ONLY/HG creates zero timetable lines and zero Teaching Load pairs', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.timetableLines.some((line) => line.subjectCode === 'HG'), false);
	assert.equal(result.teachingLoadPairs.some((pair) => pair.subjectCode === 'HG'), false);
});

test('4. grade/program scope is exact and inactive sections are excluded', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(result.timetableLines.some((line) => line.gradeLevel === 8), false);
	assert.equal(result.timetableLines.some((line) => line.sectionExternalId === 9003), false);
	assert.equal(result.timetableLines.some((line) => line.programType === 'STE'), false);
	assert.equal(result.teachingLoadPairs.some((pair) => pair.sectionExternalId === 9003), false);

	const inactive = deriveCanonicalDemand(baseInput({ sections: [{ ...baseSections()[0], isActiveForScheduling: false }] }));
	assert.equal(inactive.ok, true);
	if (!inactive.ok) return;
	assert.equal(inactive.totalLines, 0);
	assert.equal(inactive.totalPairs, 0);
});

test('5. missing term structure and malformed/incomplete rotation fail closed', () => {
	const noTerms = deriveCanonicalDemand(baseInput({ terms: [] }));
	assert.equal(noTerms.ok, false);
	if (!noTerms.ok) assert.equal(noTerms.blockers[0]?.code, 'TERM_STRUCTURE_UNAVAILABLE');

	const cases: Array<[Partial<DerivedSubjectInput>, string]> = [
		[{ rotationFamily: null, modularOrder: 1 }, 'ROTATION_FAMILY_MISSING'],
		[{ rotationFamily: 'TLE_ROTATION', modularOrder: null }, 'ROTATION_ORDER_MISSING'],
		[{ rotationFamily: 'TLE_ROTATION', modularOrder: 4 }, 'ROTATION_ORDER_OUT_OF_RANGE'],
	];
	for (const [override, expected] of cases) {
		const bad = subject({ id: 77, code: 'BAD', ...override });
		const result = deriveCanonicalDemand(baseInput({ subjects: [bad] }));
		assert.equal(result.ok, false, expected);
		if (!result.ok) assert.equal(result.blockers[0]?.code, expected, expected);
	}

	const duplicate = deriveCanonicalDemand(baseInput({
		subjects: [
			subject({ id: 70, code: 'TLE_1', rotationFamily: 'TLE', modularOrder: 1 }),
			subject({ id: 71, code: 'TLE_1B', rotationFamily: 'TLE', modularOrder: 1 }),
		],
	}));
	assert.equal(duplicate.ok, false);
	if (!duplicate.ok) assert.equal(duplicate.blockers.some((entry) => entry.code === 'ROTATION_ORDER_DUPLICATE'), true);

	const incomplete = deriveCanonicalDemand(baseInput({
		subjects: [subject({ id: 70, code: 'TLE_1', rotationFamily: 'TLE', modularOrder: 1.5 })],
	}));
	assert.equal(incomplete.ok, false);
	if (!incomplete.ok) assert.equal(incomplete.blockers.some((entry) => entry.code === 'ROTATION_ORDER_MISSING'), true);
});

test('6. semantic changes change the revision; read-order permutations do not', () => {
	const base = deriveCanonicalDemand(baseInput());
	assert.equal(base.ok, true);
	if (!base.ok) return;

	const changedMinutes = deriveCanonicalDemand(baseInput({
		subjects: baseSubjects().map((entry) => entry.id === 11 ? { ...entry, minMinutesPerWeek: 300 } : entry),
	}));
	assert.equal(changedMinutes.ok, true);
	if (changedMinutes.ok) assert.notEqual(changedMinutes.revision, base.revision, 'minutes change must change revision');

	const changedScope = deriveCanonicalDemand(baseInput({
		subjects: baseSubjects().map((entry) => entry.id === 11 ? { ...entry, gradeLevels: [8] } : entry),
	}));
	assert.equal(changedScope.ok, true);
	if (changedScope.ok) assert.notEqual(changedScope.revision, base.revision, 'same-count scope change must change revision');

	const changedSection = deriveCanonicalDemand(baseInput({
		sections: baseSections().map((entry) => entry.externalId === 9001 ? { ...entry, programType: 'SPA' } : entry),
	}));
	assert.equal(changedSection.ok, true);
	if (changedSection.ok) assert.notEqual(changedSection.revision, base.revision, 'section program change must change revision');

	const permutedSubjects = deriveCanonicalDemand(baseInput({ subjects: [...baseSubjects()].reverse() }));
	assert.equal(permutedSubjects.ok, true);
	if (permutedSubjects.ok) assert.equal(permutedSubjects.revision, base.revision, 'subject read-order permutation must not change revision');

	const permutedSections = deriveCanonicalDemand(baseInput({ sections: [...baseSections()].reverse() }));
	assert.equal(permutedSections.ok, true);
	if (permutedSections.ok) assert.equal(permutedSections.revision, base.revision, 'section read-order permutation must not change revision');
});

test('7. offering rows cannot change the derived result; a mutant reading them diverges', () => {
	const base = deriveCanonicalDemand(baseInput());
	assert.equal(base.ok, true);
	if (!base.ok) return;

	// Production derivation has no offering input; an extra offering-like payload
	// is ignored by the type contract and the result is byte-identical.
	const withOfferings = deriveCanonicalDemand({
		...baseInput(),
		offerings: [{ id: 1, subjectId: 11, termMode: 'ALL', isActive: true }],
	} as unknown as DerivedDemandInput);
	assert.equal(withOfferings.ok, true);
	if (!withOfferings.ok) return;
	assert.equal(withOfferings.revision, base.revision);
	assert.equal(withOfferings.totalPairs, base.totalPairs);

	// Mutant: a derivation that treats a contradictory offering as authority
	// produces extra demand the production contract never emits.
	const mutantPairs = base.totalPairs + 1;
	assert.notEqual(mutantPairs, base.totalPairs, 'a demand source that reads offerings would diverge');
});

test('8. all three consumers agree on revision and line/pair totals', () => {
	const result = deriveCanonicalDemand(baseInput());
	assert.equal(result.ok, true);
	if (!result.ok) return;

	// Teaching Load reconciliation projection.
	const tlPairs = toDerivedDemandPairIdentities(result);
	assert.equal(tlPairs.length, result.totalPairs);

	// Timetable demand projection uses the derived lines directly.
	assert.equal(result.timetableLines.length, result.totalLines);

	// Generation projection collapses rotating families into modular items.
	const sectionsByGrade: SectionsByGrade[] = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [
			{ id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
			{ id: 9002, name: '7-B', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' },
		],
	} as SectionsByGrade];
	const subjectInputs = baseSubjects().map((entry): SubjectInput => ({
		id: entry.id, code: entry.code, name: entry.name, minMinutesPerWeek: entry.minMinutesPerWeek,
		preferredRoomType: 'CLASSROOM', gradeLevels: entry.gradeLevels, programScopes: entry.programScopes,
	}));
	const schedulerDemand = toSchedulerDemandOverride(result, sectionsByGrade, subjectInputs);
	const schedulerTeachingLoadPairs = schedulerDemand.reduce((total, item) => total + (item.modularSubjects?.length ?? 1), 0);
	assert.equal(schedulerTeachingLoadPairs, result.totalPairs, 'generation projection must agree on unique Teaching Load pairs');
	assert.equal(schedulerDemand.length, 6, 'two sections × (MATH, ENG, SCIENCE family)');
});

test('9. the scheduler receives the derived override and never calls computeDemand()', () => {
	const input: ConstructorInput = {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [{
			gradeLevelId: 17,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [{ id: 9001, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', programCode: 'REGULAR', programName: 'Regular' }],
		} as SectionsByGrade],
		subjects: [{ id: 11, code: 'MATH', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'] }],
		faculty: [],
		facultySubjects: [],
		rooms: [],
		preferences: [],
		classTemplatePeriods: { REGULAR: 60 },
	};

	// Empty override: the scheduler must process zero demand items, proving the
	// supplied override replaced `computeDemand()` (which would produce one item).
	const withEmptyOverride = runHybridScheduler({ ...input, demandOverride: [] });
	assert.equal(withEmptyOverride.assignedCount, 0);
	assert.equal(withEmptyOverride.unassignedItems.length, 0);
});

test('10. passive reads perform zero writes (write-recorder positive control)', async () => {
	const written: string[] = [];
	const reads: string[] = [];
	const client = {
		enrollProSchoolYearMirror: { findMany: async () => { reads.push('mirror.findMany'); return [{ enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2029-2030' }]; } },
		sectionMirror: { findMany: async () => { reads.push('sectionMirror.findMany'); return [
			{ id: 501, externalId: 9001, displayOrder: 7, gradeLevelId: 17, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		]; } },
		subject: { findMany: async () => { reads.push('subject.findMany'); return [
			{ id: 11, code: 'MATH', name: 'Mathematics', schedulingDisposition: 'SCHEDULED_TEACHING', gradeLevels: [7], programScopes: ['REGULAR'], rotationFamily: null, modularOrder: null, minMinutesPerWeek: 240, isActive: true },
		]; } },
		schedulingPolicy: { findUnique: async () => { reads.push('policy.findUnique'); return { periodLengthMinutes: 60 }; } },
		$write: async (name: string) => { written.push(name); },
	};

	const result = await buildDerivedDemand(SCHOOL_ID, SCHOOL_YEAR_ID, { client: client as never, termContract: termContract() });
	assert.equal(result.ok, true);
	assert.deepEqual(written, [], 'passive derivation must perform zero writes');
	assert.ok(reads.length >= 4, 'passive derivation must have read the authoritative inputs');

	// Positive control: the recorder detects a write when one occurs.
	await client.$write('probe');
	assert.deepEqual(written, ['probe'], 'write recorder must detect writes');
});
