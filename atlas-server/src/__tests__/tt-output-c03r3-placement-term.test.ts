/**
 * TT-OUTPUT-C03R3 correction — placement paths keep ordered-term identity.
 *
 * Run: `npx tsx src/__tests__/tt-output-c03r3-placement-term.test.ts`
 *
 * Failing-first proof through the real placement entry points
 * (`applyProposalBatch`, `previewManualEdit`, `solveQuickPlace`). Before the
 * correction a PLACE_UNASSIGNED proposal and a quick-place candidate dropped the
 * ordered term, so the created entry became unscoped: it collided with every
 * term and disappeared from the selected-term grid.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	applyProposalBatch,
	previewManualEdit,
	type ManualEditProposal,
} from '../services/manual-edit.service.js';
import { solveQuickPlace } from '../services/timetable-quick-place.service.js';
import type { ScheduledEntry } from '../services/constraint-validator.js';
import type { UnassignedItem } from '../services/schedule-constructor.js';

const SECTION_ID = 22;
const SUBJECT_ID = 44;
const FACULTY_ID = 11;
const ROOM_ID = 33;
const SLOT = { day: 'MONDAY', startTime: '08:00', endTime: '08:45' };

function baseEntry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
	return {
		entryId: 'existing',
		facultyId: FACULTY_ID,
		roomId: ROOM_ID,
		subjectId: SUBJECT_ID,
		sectionId: SECTION_ID,
		day: SLOT.day,
		startTime: SLOT.startTime,
		endTime: SLOT.endTime,
		durationMinutes: 45,
		...overrides,
	};
}

function baseUnassigned(termIndex?: number): UnassignedItem {
	return {
		sectionId: SECTION_ID,
		subjectId: SUBJECT_ID,
		gradeLevel: 7,
		session: 1,
		reason: 'NO_AVAILABLE_SLOT',
		facultyId: FACULTY_ID,
		homeRoomId: ROOM_ID,
		...(termIndex == null ? {} : { termIndex: termIndex as 1 | 2 | 3 | 4 }),
	};
}

function placementProposal(overrides: Partial<ManualEditProposal> = {}): ManualEditProposal {
	return {
		editType: 'PLACE_UNASSIGNED',
		sectionId: SECTION_ID,
		subjectId: SUBJECT_ID,
		session: 1,
		targetDay: SLOT.day,
		targetStartTime: SLOT.startTime,
		targetEndTime: SLOT.endTime,
		targetRoomId: ROOM_ID,
		targetFacultyId: FACULTY_ID,
		...overrides,
	};
}

function productionRefData(overrides: Record<string, unknown> = {}) {
	const room = {
		id: ROOM_ID, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false,
		capacity: 35, buildingId: 1, buildingGradeScope: [7], building: { gradeScope: [7] },
	};
	const subject = { id: SUBJECT_ID, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7] };
	return {
		run: {
			id: 3, schoolId: 1, schoolYearId: 2, status: 'COMPLETED', runType: 'FULL', version: 1,
			summary: { timetableDisplaySlots: [{ startTime: SLOT.startTime, endTime: SLOT.endTime }] },
			draftEntries: [] as unknown[], unassignedItems: [] as unknown[], violations: [], createdAt: new Date(), finishedAt: new Date(),
		},
		entries: [] as ScheduledEntry[],
		unassignedItems: [baseUnassigned(2)] as UnassignedItem[],
		faculty: [{ id: FACULTY_ID, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: FACULTY_ID, subjectId: SUBJECT_ID, gradeLevels: [7], sectionIds: [SECTION_ID] }],
		rooms: [room], subjects: [subject],
		policyRecord: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180, minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480, earliestStartTime: '07:00', latestEndTime: '17:00',
			enforceConsecutiveBreakAsHard: false, enableTravelWellbeingChecks: false,
			maxWalkingDistanceMetersPerTransition: 500, maxBuildingTransitionsPerDay: 10,
			maxBackToBackTransitionsWithoutBuffer: 10, maxIdleGapMinutesPerDay: 480,
			avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false,
			enableVacantAwareConstraints: false, targetFacultyDailyVacantMinutes: 0,
			targetSectionDailyVacantPeriods: 0, maxCompressedTeachingMinutesPerDay: 480,
			constraintConfig: {},
		},
		buildings: [{ id: 1, x: 0, y: 0 }],
		facultyNameMap: new Map([[FACULTY_ID, 'Teacher']]), roomNameMap: new Map([[ROOM_ID, 'Room']]),
		subjectNameMap: new Map([[SUBJECT_ID, 'MATH']]), subjectNameDetailMap: new Map([[SUBJECT_ID, 'Mathematics']]),
		sectionEnrollment: new Map([[SECTION_ID, 35]]), sectionGradeLevel: new Map([[SECTION_ID, 7]]),
		...overrides,
	};
}

// ─── Manual PLACE_UNASSIGNED ─────────────────────────────────────────────────

test('C03R3 placement: PLACE_UNASSIGNED keeps the ordered term on the created entry', () => {
	const cases: Array<{ label: string; item: UnassignedItem; proposal: ManualEditProposal; expected: number | undefined }> = [
		{ label: 'item term + proposal term', item: baseUnassigned(2), proposal: placementProposal({ termIndex: 2 }), expected: 2 },
		{ label: 'item term only', item: baseUnassigned(2), proposal: placementProposal(), expected: 2 },
		{ label: 'proposal term only', item: baseUnassigned(), proposal: placementProposal({ termIndex: 2 }), expected: 2 },
		// Mutant: the former behavior with no term anywhere leaves the entry unscoped.
		{ label: 'no term (former behavior)', item: baseUnassigned(), proposal: placementProposal(), expected: undefined },
	];
	for (const testCase of cases) {
		const result = applyProposalBatch([], [testCase.item], [testCase.proposal]);
		assert.equal(result.applied.length, 1, `${testCase.label}: proposal applies`);
		const after = result.applied[0].afterEntry;
		assert.ok(after, `${testCase.label}: an entry is created`);
		assert.equal(after.termIndex, testCase.expected, `${testCase.label}: created entry term`);
	}
});

test('C03R3 placement: an explicit proposal term that disagrees with the matched item is rejected', () => {
	const result = applyProposalBatch([], [baseUnassigned(2)], [placementProposal({ termIndex: 3 })]);
	assert.equal(result.items[0].status, 'FAILED');
	assert.equal(result.items[0].errorCode, 'TERM_MISMATCH');
	assert.equal(result.newEntries.length, 0, 'a term mismatch must create no entry');
});

test('C03R3 placement: a term-1 occupant does not block a term-2 placement, but a same-term overlap does', async () => {
	const crossTermRef = productionRefData({ entries: [baseEntry({ entryId: 't1-occupant', termIndex: 1 })] });
	const crossTerm = await previewManualEdit(3, 1, 2, placementProposal({ termIndex: 2 }), { loadRunContext: async () => crossTermRef as never });
	assert.equal(crossTerm.allowed, true, 'a term-1 occupant must not block the term-2 placement');
	assert.equal(crossTerm.hardViolations.length, 0);

	const sameTermRef = productionRefData({ entries: [baseEntry({ entryId: 't2-occupant', termIndex: 2 })] });
	const sameTerm = await previewManualEdit(3, 1, 2, placementProposal({ termIndex: 2 }), { loadRunContext: async () => sameTermRef as never });
	assert.equal(sameTerm.allowed, false, 'a same-term occupant still blocks the placement');
	assert.ok(sameTerm.hardViolations.length > 0);
});

// ─── Quick-place ─────────────────────────────────────────────────────────────

function quickPlaceDataAccess() {
	let writeAttempts = 0;
	const failWrite = () => { writeAttempts += 1; throw new Error('unexpected write'); };
	const dataAccess = {
		subjectSectionOwnership: { findMany: async () => [{ subjectId: SUBJECT_ID, sectionId: SECTION_ID, facultyId: FACULTY_ID }], create: failWrite, update: failWrite, delete: failWrite },
		sectionSnapshot: { findUnique: async () => ({ payload: [{ displayOrder: 7, sections: [{ id: SECTION_ID, name: '7-Test' }] }] }), create: failWrite, update: failWrite, delete: failWrite },
	} as never;
	return { dataAccess, writeAttempts: () => writeAttempts };
}

async function runQuickPlace(refData: ReturnType<typeof productionRefData>) {
	refData.run.draftEntries = refData.entries as unknown[];
	refData.run.unassignedItems = refData.unassignedItems as unknown[];
	const { dataAccess, writeAttempts } = quickPlaceDataAccess();
	const result = await solveQuickPlace(3, 1, 2, { loadRunContext: async () => refData as never, prisma: dataAccess });
	return { result, writeAttempts };
}

test('C03R3 placement: quick-place keeps the ordered term and is not rejected by another term', async () => {
	const termAware = productionRefData({ entries: [baseEntry({ entryId: 't1-occupant', termIndex: 1 })], unassignedItems: [baseUnassigned(2)] });
	const { result, writeAttempts } = await runQuickPlace(termAware);
	assert.equal(writeAttempts(), 0, 'quick-place preview performs zero writes');
	assert.equal(result.placed.length, 1, 'the term-2 item is placed despite the term-1 occupant');
	assert.equal(result.placed[0].day, 'MONDAY', 'the term-aware probe may reuse the term-1 occupant slot in another term');
	const created = (result.newEntries as ScheduledEntry[]).find((entry) => entry.entryId.startsWith('entry-qp-'));
	assert.ok(created, 'a quick-place entry is created');
	assert.equal(created.termIndex, 2, 'the placed entry keeps the item ordered term');
});

test('C03R3 placement mutant: dropping the item term reproduces the unscoped defect', async () => {
	const unscoped = productionRefData({ entries: [baseEntry({ entryId: 't1-occupant', termIndex: 1 })], unassignedItems: [baseUnassigned()] });
	const { result } = await runQuickPlace(unscoped);
	assert.equal(result.placed.length, 1, 'an unscoped item can still be placed somewhere');
	assert.equal(result.placed[0].day, 'TUESDAY', 'without a term the probe is blocked by the term-1 occupant and moves to another weekday');
	const created = (result.newEntries as ScheduledEntry[]).find((entry) => entry.entryId.startsWith('entry-qp-'));
	assert.ok(created, 'a quick-place entry is created');
	assert.notEqual(created.termIndex, 2, 'the mutant produces an unscoped entry, proving the term is load-bearing');
});
