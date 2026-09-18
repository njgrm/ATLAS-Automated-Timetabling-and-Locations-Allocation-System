import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildTimetableShapeContract,
	constructBaseline,
	type ConstructorInput,
	type UnassignedItem,
} from '../services/schedule-constructor.js';
import { repairUnassignedByEjection, runHybridScheduler } from '../services/hybrid-scheduler.js';
import type { ScheduledEntry } from '../services/constraint-validator.js';

const SCHOOL_ID = 91;
const SCHOOL_YEAR_ID = 3;
const BLOCKING_SECTION = 701;
const UNRESOLVED_SECTION = 702;
const SHARED_TEACHER = 501;
const FILLER_TEACHER = 502;
const MATH_SUBJECT = 11;
const ENG_SUBJECT = 12;

function canonicalShape() {
	return buildTimetableShapeContract({
		gradeLevel: 7,
		programType: 'REGULAR',
		startTime: '08:00',
		endTime: '10:00',
		periodLengthMinutes: 60,
		periodsPerDay: 2,
		canonicalSlots: [
			{ startTime: '08:00', endTime: '09:00', subjectFamily: null, rowKind: 'CLASS' },
			{ startTime: '09:00', endTime: '10:00', subjectFamily: null, rowKind: 'CLASS' },
		],
	});
}

function baseInput(): ConstructorInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [
			{
				gradeLevelId: 1,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [
					{
						id: BLOCKING_SECTION,
						name: '7-A',
						maxCapacity: 40,
						enrolledCount: 30,
						gradeLevelId: 1,
						gradeLevelName: 'Grade 7',
						displayOrder: 7,
						programType: 'REGULAR',
					},
					{
						id: UNRESOLVED_SECTION,
						name: '7-B',
						maxCapacity: 40,
						enrolledCount: 30,
						gradeLevelId: 1,
						gradeLevelName: 'Grade 7',
						displayOrder: 7,
						programType: 'REGULAR',
					},
				],
			},
		],
		subjects: [
			{ id: MATH_SUBJECT, code: 'MATH', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
			{ id: ENG_SUBJECT, code: 'ENG', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
		],
		faculty: [
			{ id: SHARED_TEACHER, maxHoursPerWeek: 40 },
			{ id: FILLER_TEACHER, maxHoursPerWeek: 40 },
		],
		facultySubjects: [
			{ facultyId: SHARED_TEACHER, subjectId: MATH_SUBJECT, gradeLevels: [7], sectionIds: [UNRESOLVED_SECTION] },
			{ facultyId: SHARED_TEACHER, subjectId: ENG_SUBJECT, gradeLevels: [7], sectionIds: [BLOCKING_SECTION] },
		],
		rooms: [
			{ id: 601, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 },
			{ id: 602, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 },
		],
		preferences: [],
		policy: {
			periodLengthMinutes: 60,
			earliestStartTime: '08:00',
			latestEndTime: '10:00',
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 20,
			maxTeachingMinutesPerDay: 480,
		},
		timetableShapes: [canonicalShape()],
	};
}

/** The shared teacher is already placed in section 701 at 08:00-09:00. */
function blockingEntry(): ScheduledEntry {
	return {
		entryId: 'entry-blocker',
		facultyId: SHARED_TEACHER,
		roomId: 602,
		subjectId: ENG_SUBJECT,
		sectionId: BLOCKING_SECTION,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '09:00',
		durationMinutes: 60,
		entryKind: 'SECTION',
		programType: 'REGULAR',
		metadata: { roomAssignmentReason: 'GENERAL_POOL_ASSIGNED' },
	};
}

function unresolvedSession(): UnassignedItem {
	return {
		sectionId: UNRESOLVED_SECTION,
		subjectId: MATH_SUBJECT,
		gradeLevel: 7,
		session: 1,
		reason: 'NO_AVAILABLE_SLOT',
		roomAssignmentReason: 'FACULTY_SLOT_UNAVAILABLE',
		facultyId: SHARED_TEACHER,
		entryKind: 'SECTION',
	};
}

function ejectionInput(withFreeRelocationTarget: boolean): { input: ConstructorInput; entries: ScheduledEntry[]; unassigned: UnassignedItem[] } {
	const input = baseInput();
	input.demandOverride = [
		{
			sectionId: UNRESOLVED_SECTION,
			subjectId: MATH_SUBJECT,
			subjectCode: 'MATH',
			gradeLevel: 7,
			sessionsPerWeek: 1,
			durationPerSession: 60,
			enrolledCount: 30,
			entryKind: 'SECTION',
			programType: 'REGULAR',
			roomTypePreference: 'CLASSROOM',
		},
		{
			sectionId: BLOCKING_SECTION,
			subjectId: ENG_SUBJECT,
			subjectCode: 'ENG',
			gradeLevel: 7,
			sessionsPerWeek: 1,
			durationPerSession: 60,
			enrolledCount: 30,
			entryKind: 'SECTION',
			programType: 'REGULAR',
			roomTypePreference: 'CLASSROOM',
		},
	];
	const entries: ScheduledEntry[] = [blockingEntry()];
	if (!withFreeRelocationTarget) {
		// Fully occupy section 701 across the whole Mon-Fri shape so the blocker
		// has no free slot and cannot be relocated.
		const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
		let index = 0;
		for (const day of days) {
			for (const slot of [{ startTime: '08:00', endTime: '09:00' }, { startTime: '09:00', endTime: '10:00' }]) {
				if (day === 'MONDAY' && slot.startTime === '08:00') continue;
				index++;
				entries.push({
					...blockingEntry(),
					entryId: `entry-filler-${index}`,
					day,
					startTime: slot.startTime,
					endTime: slot.endTime,
				});
			}
		}
	}
	return { input, entries, unassigned: [unresolvedSession()] };
}

function hasConflict(entries: ScheduledEntry[]): boolean {
	const overlaps = (a: ScheduledEntry, b: ScheduledEntry) =>
		a.day === b.day
		&& Number(a.startTime.slice(0, 2)) * 60 + Number(a.startTime.slice(3)) < Number(b.endTime.slice(0, 2)) * 60 + Number(b.endTime.slice(3))
		&& Number(b.startTime.slice(0, 2)) * 60 + Number(b.startTime.slice(3)) < Number(a.endTime.slice(0, 2)) * 60 + Number(a.endTime.slice(3));
	for (let i = 0; i < entries.length; i++) {
		for (let j = i + 1; j < entries.length; j++) {
			const a = entries[i];
			const b = entries[j];
			if (!overlaps(a, b)) continue;
			if (a.facultyId != null && a.facultyId === b.facultyId) return true;
			if (a.roomId === b.roomId) return true;
			if (a.sectionId === b.sectionId) return true;
		}
	}
	return false;
}

test('ejection repair places a residual session by relocating one blocking teacher entry', () => {
	const { input, entries, unassigned } = ejectionInput(true);
	const before = JSON.parse(JSON.stringify(entries));
	const repaired = repairUnassignedByEjection(input, entries, unassigned);

	assert.equal(repaired.impact.considered, 1);
	assert.equal(repaired.impact.placed, 1);
	assert.equal(repaired.impact.relocatedEntries, 1);
	assert.equal(repaired.unassignedItems.length, 0);

	// The blocker moved to the free 09:00-10:00 slot and the residual session was placed at 08:00-09:00.
	const blocker = repaired.entries.find((entry) => entry.entryId === 'entry-blocker');
	assert.equal(blocker?.startTime, '09:00');
	const placed = repaired.entries.find((entry) => entry.sectionId === UNRESOLVED_SECTION && entry.subjectId === MATH_SUBJECT);
	assert.ok(placed, 'the unresolved session must be placed');
	assert.equal(placed?.day, 'MONDAY');
	assert.equal(placed?.startTime, '08:00');
	assert.equal(placed?.facultyId, SHARED_TEACHER);
	assert.equal(hasConflict(repaired.entries), false, 'the repaired schedule must be conflict free');

	// The pass is additive over a copy and never mutates the caller's array or entries.
	assert.deepEqual(JSON.parse(JSON.stringify(entries)), before);
});

test('ejection repair reverts a relocation that cannot complete (no partial mutation)', () => {
	const { input, entries, unassigned } = ejectionInput(false);
	const before = JSON.parse(JSON.stringify(entries));
	const repaired = repairUnassignedByEjection(input, entries, unassigned);

	assert.equal(repaired.impact.placed, 0);
	assert.equal(repaired.impact.relocatedEntries, 0);
	assert.equal(repaired.unassignedItems.length, 1);
	assert.deepEqual(repaired.entries, entries, 'an unplaceable residual must leave the schedule unchanged');
	assert.deepEqual(JSON.parse(JSON.stringify(entries)), before);
});

test('ejection repair is deterministic across repeated runs', () => {
	const first = ejectionInput(true);
	const second = ejectionInput(true);
	const runA = repairUnassignedByEjection(first.input, first.entries, first.unassigned);
	const runB = repairUnassignedByEjection(second.input, second.entries, second.unassigned);
	assert.deepEqual(runA.entries, runB.entries);
	assert.deepEqual(runA.unassignedItems, runB.unassignedItems);
	assert.deepEqual(runA.impact, runB.impact);
});

test('ejection repair leaves a fully-placeable fixture untouched', () => {
	// Feasible fixture: one section, one subject, two distinct slots, one teacher.
	const input = baseInput();
	input.demandOverride = [
		{
			sectionId: UNRESOLVED_SECTION,
			subjectId: MATH_SUBJECT,
			subjectCode: 'MATH',
			gradeLevel: 7,
			sessionsPerWeek: 2,
			durationPerSession: 60,
			enrolledCount: 30,
			entryKind: 'SECTION',
			programType: 'REGULAR',
			roomTypePreference: 'CLASSROOM',
		},
	];
	const baseline = constructBaseline(input);
	assert.equal(baseline.unassignedCount, 0, 'the baseline must already place every session');

	const repaired = repairUnassignedByEjection(input, baseline.entries, baseline.unassignedItems);
	assert.equal(repaired.impact.considered, 0);
	assert.equal(repaired.impact.placed, 0);
	assert.equal(repaired.unassignedItems.length, 0);
	assert.deepEqual(repaired.entries, baseline.entries);
});

test('runHybridScheduler is deterministic and adds no unassigned on a fully-placeable fixture', () => {
	const first = baseInput();
	first.demandOverride = [
		{
			sectionId: UNRESOLVED_SECTION,
			subjectId: MATH_SUBJECT,
			subjectCode: 'MATH',
			gradeLevel: 7,
			sessionsPerWeek: 2,
			durationPerSession: 60,
			enrolledCount: 30,
			entryKind: 'SECTION',
			programType: 'REGULAR',
			roomTypePreference: 'CLASSROOM',
		},
	];
	const second = JSON.parse(JSON.stringify(first)) as ConstructorInput;

	const runA = runHybridScheduler(first);
	const runB = runHybridScheduler(second);

	assert.equal(runA.unassignedCount, 0);
	assert.equal(runA.ejectionImpact.placed, 0);
	assert.equal(runA.ejectionImpact.considered, 0);
	assert.equal(runA.hybridEnabled, true);

	assert.deepEqual(runA.entries, runB.entries);
	assert.deepEqual(runA.unassignedItems, runB.unassignedItems);
	assert.deepEqual(runA.seedQuality, runB.seedQuality);
	assert.deepEqual(runA.ejectionImpact, runB.ejectionImpact);
	assert.equal(runA.assignedCount, runB.assignedCount);
	assert.equal(runA.unassignedCount, runB.unassignedCount);
	assert.equal(runA.selectedProfileId, runB.selectedProfileId);
});
