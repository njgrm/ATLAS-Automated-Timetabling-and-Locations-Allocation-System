import assert from 'node:assert/strict';
import test from 'node:test';

import {
	isHomeroomGuidanceCode,
	resolveOfferingTerms,
	buildDemandLineKey,
	expectedProgramForSection,
	computeDemandSourceRevision,
	type TermReference,
} from '../services/timetable-demand.service.js';
import { normalizeStoredAssignmentScope, buildSectionRosterIndex } from '../services/faculty-assignment-scope.service.js';
import { roomCanFitEnrollment } from '../services/timetable-candidate-domain.js';

const TERM_CONFIG: TermReference = {
	id: 1,
	termCount: 3,
	termIdentities: ['Term 1', 'Term 2', 'Term 3'],
	isActive: true,
	updatedAt: '2026-09-01T00:00:00.000Z',
};

function offering(overrides: Partial<Parameters<typeof resolveOfferingTerms>[0]> = {}) {
	return {
		termMode: 'ALL' as const,
		rotationFamily: null,
		rotationOrder: null,
		termAssignments: [] as { termIdentity: string }[],
		...overrides,
	};
}

test('HG is never a timetable-demand subject code', () => {
	assert.equal(isHomeroomGuidanceCode('HG'), true);
	assert.equal(isHomeroomGuidanceCode('hg'), true);
	assert.equal(isHomeroomGuidanceCode('HOMEROOM GUIDANCE'), false);
	assert.equal(isHomeroomGuidanceCode('MATH'), false);
	assert.equal(isHomeroomGuidanceCode(null), false);
	assert.equal(isHomeroomGuidanceCode(undefined), false);
});

test('rotating family members occur only in their single assigned term', () => {
	const rotating = offering({
		termMode: 'ROTATING_FAMILY_MEMBER',
		rotationFamily: 'TLE',
		rotationOrder: 1,
		termAssignments: [{ termIdentity: 'Term 2' }],
	});
	const resolved = resolveOfferingTerms(rotating, TERM_CONFIG);
	assert.deepEqual(resolved, [{ termIdentity: 'Term 2', termIndex: 2 }]);
});

test('a rotating member without exactly one assigned term resolves to zero terms', () => {
	assert.deepEqual(
		resolveOfferingTerms(offering({ termMode: 'ROTATING_FAMILY_MEMBER', rotationFamily: 'TLE', termAssignments: [] }), TERM_CONFIG),
		[],
	);
	assert.deepEqual(
		resolveOfferingTerms(offering({ termMode: 'ROTATING_FAMILY_MEMBER', rotationFamily: 'TLE', termAssignments: [{ termIdentity: 'Term 1' }, { termIdentity: 'Term 2' }] }), TERM_CONFIG),
		[],
	);
	assert.deepEqual(
		resolveOfferingTerms(offering({ termMode: 'ROTATING_FAMILY_MEMBER', rotationFamily: null, termAssignments: [{ termIdentity: 'Term 1' }] }), TERM_CONFIG),
		[],
	);
});

test('ALL offerings span every configured term in config order', () => {
	const resolved = resolveOfferingTerms(offering({ termMode: 'ALL' }), TERM_CONFIG);
	assert.deepEqual(resolved, [
		{ termIdentity: 'Term 1', termIndex: 1 },
		{ termIdentity: 'Term 2', termIndex: 2 },
		{ termIdentity: 'Term 3', termIndex: 3 },
	]);
});

test('EMPTY offerings and inactive term configs produce zero terms', () => {
	assert.deepEqual(resolveOfferingTerms(offering({ termMode: 'EMPTY' }), TERM_CONFIG), []);
	assert.deepEqual(
		resolveOfferingTerms(offering({ termMode: 'ALL' }), { ...TERM_CONFIG, isActive: false }),
		[],
	);
});

test('demand line key is a stable subject/section/term identity', () => {
	assert.equal(buildDemandLineKey({ subjectId: 12, sectionExternalId: 34, termIdentity: 'Term 2' }), '12:34:Term 2');
	assert.equal(buildDemandLineKey({ subjectId: 12, sectionExternalId: 34, termIdentity: 'Term 2' }), '12:34:Term 2');
	assert.notEqual(buildDemandLineKey({ subjectId: 12, sectionExternalId: 34, termIdentity: 'Term 2' }), '12:34:Term 3');
});

test('program types normalize to the canonical REGULAR default', () => {
	assert.equal(expectedProgramForSection('regular'), 'REGULAR');
	assert.equal(expectedProgramForSection('STE'), 'STE');
	assert.equal(expectedProgramForSection(null), 'OTHER');
	assert.equal(expectedProgramForSection('UNKNOWN'), 'OTHER');
});

test('stored reconciled section scope is preserved, never substituted by grade', () => {
	const gradeLevels = [
		{
			gradeLevelId: 17,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [
				{ id: 1001, name: '7-1', enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, mirrorId: 1 },
				{ id: 1002, name: '7-2', enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, mirrorId: 2 },
			],
		},
	] as never;
	const roster = buildSectionRosterIndex(gradeLevels as never);

	const reconciled = normalizeStoredAssignmentScope(
		{ subjectId: 7, sectionIds: [1001] },
		roster,
	);
	assert.equal(reconciled.scopeSource, 'sectionIds');
	assert.deepEqual(reconciled.sectionIds, [1001]);
	assert.deepEqual(reconciled.gradeLevels, [7]);

	const legacy = normalizeStoredAssignmentScope(
		{ subjectId: 7, gradeLevels: [7], sectionIds: [] },
		roster,
	);
	assert.equal(legacy.scopeSource, 'legacyGradeLevels');
	assert.deepEqual(legacy.sectionIds, [1001, 1002]);
});

test('room capacity uses the exact persisted enrollment boundary', () => {
	assert.equal(roomCanFitEnrollment(34, 35), false);
	assert.equal(roomCanFitEnrollment(35, 35), true);
});

test('stale source revision negative control: ownership changes change the revision hash', () => {
	const base = computeDemandSourceRevision({
		termConfig: TERM_CONFIG,
		offerings: [{ id: 1 }],
		ownershipRows: [{ id: 1, subjectId: 1, sectionId: 10, facultyId: 5 }],
		cycleVersion: 6,
		policyRevision: { id: 1, updatedAt: '2026-09-06T15:34:50.773Z' },
		activeSections: [{ id: 1, externalId: 10 }],
	});
	const changedOwner = computeDemandSourceRevision({
		termConfig: TERM_CONFIG,
		offerings: [{ id: 1 }],
		ownershipRows: [{ id: 2, subjectId: 1, sectionId: 10, facultyId: 99 }],
		cycleVersion: 6,
		policyRevision: { id: 1, updatedAt: '2026-09-06T15:34:50.773Z' },
		activeSections: [{ id: 1, externalId: 10 }],
	});
	assert.notEqual(changedOwner.sha256, base.sha256, 'owner substitution must change the source revision');
	assert.notEqual(changedOwner.teachingLoad.hash, base.teachingLoad.hash, 'ownership hash reflects the substituted owner');
});

test('stale source revision negative control: term config changes change the revision hash', () => {
	const base = computeDemandSourceRevision({
		termConfig: TERM_CONFIG,
		offerings: [],
		ownershipRows: [],
		cycleVersion: 6,
		policyRevision: null,
		activeSections: [],
	});
	const changedTerms = computeDemandSourceRevision({
		termConfig: { ...TERM_CONFIG, termIdentities: ['Term 1', 'Term 2', 'Term 3', 'Term 4'] },
		offerings: [],
		ownershipRows: [],
		cycleVersion: 6,
		policyRevision: null,
		activeSections: [],
	});
	assert.notEqual(changedTerms.sha256, base.sha256, 'term config changes must change the source revision');
});