import assert from 'node:assert/strict';
import test from 'node:test';

import { deriveSimplePublishReadiness, type SimplePublishReadiness } from '../../components/timetable/simplePublishReadiness';
import type { DraftReport, UnassignedItem, Violation } from '../../types';

const sectionLabel = (id: number) => `Section ${id}`;
const subjectLabel = (id: number) => `Subject ${id}`;
const facultyLabel = (id: number) => `Teacher ${id}`;

function makeUnassignedItem(overrides: Partial<UnassignedItem> = {}): UnassignedItem {
	return {
		sectionId: 1,
		subjectId: 10,
		gradeLevel: 7,
		session: 1,
		reason: 'FACULTY_OVERLOADED',
		...overrides,
	};
}

function makeViolation(overrides: Partial<Violation> = {}): Violation {
	return {
		code: 'UNASSIGNED_SECTION',
		severity: 'HARD',
		message: 'Test violation',
		schoolId: 1,
		schoolYearId: 2,
		runId: 427,
		entities: {},
		...overrides,
	};
}

function makeDraft(unassignedItems: UnassignedItem[] = []): DraftReport {
	return {
		runId: 427,
		status: 'COMPLETED',
		entries: [],
		unassignedItems,
		summary: null,
		version: 1,
		finishedAt: null,
		createdAt: '',
	};
}

test('deriveSimplePublishReadiness returns clean state when no violations or unassigned', () => {
	const result = deriveSimplePublishReadiness(makeDraft(), [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalHardBlockers, 0);
	assert.equal(result.totalUnresolved, 0);
	assert.equal(result.totalSoftWarnings, 0);
	assert.equal(result.blockerGroups.length, 0);
	assert.equal(result.warningGroups.length, 0);
	assert.equal(result.isClean, true);
	assert.equal(result.hasBlockers, false);
	assert.match(result.summaryText, /Ready to publish/);
});

test('deriveSimplePublishReadiness groups unassigned items by reason', () => {
	const items = [
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED', sectionId: 1, subjectId: 10 }),
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED', sectionId: 2, subjectId: 11 }),
		makeUnassignedItem({ reason: 'NO_AVAILABLE_SLOT', sectionId: 3, subjectId: 12 }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(items), [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalUnresolved, 3);
	assert.equal(result.totalHardBlockers, 3);
	assert.equal(result.blockerGroups.length, 2);

	const overloaded = result.blockerGroups.find((g: { reason: string }) => g.reason === 'FACULTY_OVERLOADED');
	assert.ok(overloaded, 'Should have FACULTY_OVERLOADED group');
	assert.equal(overloaded!.count, 2);
	assert.equal(overloaded!.plainLabel, 'Teachers are overloaded');
	assert.equal(overloaded!.actionLabel, 'Open Teaching Load');
	assert.equal(overloaded!.actionHref, '/teaching-load');

	const noSlot = result.blockerGroups.find((g: { reason: string }) => g.reason === 'NO_AVAILABLE_SLOT');
	assert.ok(noSlot, 'Should have NO_AVAILABLE_SLOT group');
	assert.equal(noSlot!.count, 1);
	assert.equal(noSlot!.plainLabel, 'No allowed time slot was found');
	assert.equal(noSlot!.actionLabel, 'Place manually');

	assert.match(result.summaryText, /Cannot publish yet/);
	assert.match(result.summaryText, /3 sessions still need fixing/);
});

test('deriveSimplePublishReadiness maps all known reasons to plain labels', () => {
	const items = [
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED' }),
		makeUnassignedItem({ reason: 'NO_AVAILABLE_SLOT' }),
		makeUnassignedItem({ reason: 'NO_QUALIFIED_FACULTY' }),
		makeUnassignedItem({ reason: 'NO_COMPATIBLE_ROOM' }),
		makeUnassignedItem({ reason: 'ROOM_CAPACITY_EXCEEDED' }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(items), [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.blockerGroups.length, 5);
	for (const group of result.blockerGroups) {
		assert.ok(group.plainLabel.length > 0, `${group.reason} should have a plain label`);
		assert.ok(group.actionLabel.length > 0, `${group.reason} should have an action label`);
		assert.ok(group.actionHref.length > 0, `${group.reason} should have an action href`);
	}
});

test('deriveSimplePublishReadiness produces items with grade labels in GR format', () => {
	const items = [
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED', gradeLevel: 7 }),
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED', gradeLevel: 10 }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(items), [], sectionLabel, subjectLabel, facultyLabel);

	const group = result.blockerGroups.find((g: { reason: string }) => g.reason === 'FACULTY_OVERLOADED');
	assert.ok(group);
	assert.equal(group!.items[0].gradeLabel, 'GR7');
	assert.equal(group!.items[1].gradeLabel, 'GR10');
});

test('deriveSimplePublishReadiness falls back to violations when no unassigned items', () => {
	const violations = [
		makeViolation({ code: 'UNASSIGNED_SECTION', entities: { sectionId: 1, subjectId: 10 } }),
		makeViolation({ code: 'UNASSIGNED_SECTION', entities: { sectionId: 2, subjectId: 11 } }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(), violations, sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalHardBlockers, 2);
	assert.equal(result.blockerGroups.length, 1);
	assert.equal(result.blockerGroups[0].reason, 'UNASSIGNED_SECTION');
	assert.equal(result.blockerGroups[0].count, 2);
});

test('deriveSimplePublishReadiness groups soft violations as warnings', () => {
	const violations = [
		makeViolation({ code: 'FACULTY_TIME_CONFLICT', severity: 'SOFT' }),
		makeViolation({ code: 'FACULTY_TIME_CONFLICT', severity: 'SOFT' }),
		makeViolation({ code: 'ROOM_TYPE_MISMATCH', severity: 'SOFT' }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(), violations, sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalSoftWarnings, 3);
	assert.equal(result.warningGroups.length, 2);

	const conflicts = result.warningGroups.find((g: { code: string }) => g.code === 'FACULTY_TIME_CONFLICT');
	assert.ok(conflicts);
	assert.equal(conflicts!.count, 2);
	assert.equal(conflicts!.plainLabel, 'Teacher time conflict');
});

test('deriveSimplePublishReadiness shows warnings-only copy when no hard blockers', () => {
	const violations = [
		makeViolation({ code: 'FACULTY_TIME_CONFLICT', severity: 'SOFT' }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(), violations, sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.hasBlockers, false);
	assert.equal(result.hasWarnings, true);
	assert.match(result.summaryText, /Ready except for warnings/);
});

test('deriveSimplePublishReadiness uses resourceDiagnostics when unassignedItems is empty', () => {
	const draft = makeDraft();
	draft.summary = {
		classesProcessed: 100,
		assignedCount: 820,
		unassignedCount: 105,
		hardViolationCount: 105,
		policyBlockedCount: 0,
		resourceDiagnostics: {
			qualifiedFacultyCoverageBySubject: [],
			slotSaturationByInterval: [],
			unassignedBySubjectGrade: [
				{
					subjectId: 10,
					subjectCode: 'MATH',
					gradeLevel: 7,
					count: 3,
					reasons: { FACULTY_OVERLOADED: 2, NO_AVAILABLE_SLOT: 1 },
				},
			],
		},
	};

	const result = deriveSimplePublishReadiness(draft, [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalHardBlockers, 3);
	const overloaded = result.blockerGroups.find((g: { reason: string }) => g.reason === 'FACULTY_OVERLOADED');
	assert.ok(overloaded);
	assert.equal(overloaded!.count, 2);
});

test('deriveSimplePublishReadiness sorts blocker groups by count descending', () => {
	const items = [
		makeUnassignedItem({ reason: 'NO_AVAILABLE_SLOT' }),
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED' }),
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED' }),
		makeUnassignedItem({ reason: 'FACULTY_OVERLOADED' }),
		makeUnassignedItem({ reason: 'NO_QUALIFIED_FACULTY' }),
		makeUnassignedItem({ reason: 'NO_QUALIFIED_FACULTY' }),
	];

	const result = deriveSimplePublishReadiness(makeDraft(items), [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.blockerGroups[0].reason, 'FACULTY_OVERLOADED');
	assert.equal(result.blockerGroups[0].count, 3);
	assert.equal(result.blockerGroups[1].reason, 'NO_QUALIFIED_FACULTY');
	assert.equal(result.blockerGroups[1].count, 2);
	assert.equal(result.blockerGroups[2].reason, 'NO_AVAILABLE_SLOT');
	assert.equal(result.blockerGroups[2].count, 1);
});

test('deriveSimplePublishReadiness handles empty draft gracefully', () => {
	const result = deriveSimplePublishReadiness(null, [], sectionLabel, subjectLabel, facultyLabel);

	assert.equal(result.totalUnresolved, 0);
	assert.equal(result.totalHardBlockers, 0);
	assert.equal(result.isClean, true);
});
