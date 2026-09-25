/**
 * READINESS-STALL-C01 — the readiness diagnostic
 * (`GET /api/v1/generation/:schoolId/:schoolYearId/readiness/diagnostic`)
 * blocks the whole Node event loop (~3.1 s offline, ~7 s live measured
 * 2026-09-25 against school 1 / year 10) because it re-runs the full
 * `runHybridScheduler` synchronously on every `/timetable` page load, and the
 * scheduler's inner occupancy checks re-parse "HH:MM" time strings with a
 * regex + string split on every call (millions of times per run).
 *
 * This file proves two behaviour-identical performance changes:
 *
 *   T1 `timeToCandidateMinutes` (timetable-candidate-domain.ts) returns
 *      byte-identical results to the pre-change implementation for every
 *      valid, invalid, and edge-case "HH:MM" string.
 *   T2 the readiness path's new scheduler-result cache
 *      (`runHybridSchedulerCached`, generation-readiness.service.ts) runs the
 *      real scheduler once for repeated identical input, re-runs it for any
 *      changed input, respects its bounded (evict-oldest) capacity, and never
 *      hands back a result an outside mutation can corrupt for the next hit.
 *   T3 `runHybridScheduler` itself is deterministic for a moderately sized
 *      synthetic input, and the cache wrapper's output is deep-equal to a
 *      direct, uncached call for the same input — the cache changes latency,
 *      never the answer.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { timeToCandidateMinutes } from '../services/timetable-candidate-domain.js';
import { runHybridScheduler } from '../services/hybrid-scheduler.js';
import { runHybridSchedulerCached, SCHEDULER_RESULT_CACHE_LIMIT } from '../services/generation-readiness.service.js';
import type { ConstructorInput } from '../services/schedule-constructor.js';

// ───────────────────────── T1: time-parse parity ─────────────────────────

/** The pre-READINESS-STALL-C01 implementation, copied verbatim as the oracle. */
const OLD_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function oldTimeToCandidateMinutes(value: string): number | null {
	if (!OLD_TIME_PATTERN.test(value)) return null;
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

const TIME_PARSE_FIXTURES = [
	'00:00', '07:30', '09:45', '12:00', '18:30', '23:59',
	// invalid: out-of-range hour/minute
	'24:00', '99:99', '12:60', '-1:00',
	// invalid: shape
	'1:30', '12:0', '12:005', '1230', '',
	// invalid: whitespace / trailing garbage
	' 12:00', '12:00 ', '12:00:00', '12:00am',
	// invalid: non-numeric
	'ab:cd', 'NaN:NaN',
] as const;

test('T1: timeToCandidateMinutes matches the pre-change implementation for every fixture string', () => {
	for (const value of TIME_PARSE_FIXTURES) {
		assert.equal(
			timeToCandidateMinutes(value),
			oldTimeToCandidateMinutes(value),
			`mismatch for ${JSON.stringify(value)}`,
		);
	}
});

test('T1b: repeated calls with the same string are stable (memoization does not perturb output)', () => {
	for (const value of TIME_PARSE_FIXTURES) {
		const first = timeToCandidateMinutes(value);
		const second = timeToCandidateMinutes(value);
		const third = timeToCandidateMinutes(value);
		assert.equal(first, second);
		assert.equal(second, third);
	}
});

// ───────────────────── T2/T3: scheduler cache + parity ─────────────────────

const SCHOOL_ID = 5501;
const SCHOOL_YEAR_ID = 12;
const SECTION_A = 9101;
const SECTION_B = 9102;
const SECTION_C = 9103;
const TEACHER_MATH = 8001;
const TEACHER_ENG = 8002;
const TEACHER_SCI = 8003;
const MATH_SUBJECT = 21;
const ENG_SUBJECT = 22;
const SCI_SUBJECT = 23;

/** A moderately sized, deterministic, fast-to-schedule fixture (3 sections x 3 subjects). */
function moderateFixture(): ConstructorInput {
	const section = (id: number, name: string) => ({
		id, name, maxCapacity: 40, enrolledCount: 32,
		gradeLevelId: 1, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' as const,
	});
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: [{
			gradeLevelId: 1,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			sections: [section(SECTION_A, '7-A'), section(SECTION_B, '7-B'), section(SECTION_C, '7-C')],
		}],
		subjects: [
			{ id: MATH_SUBJECT, code: 'MATH', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
			{ id: ENG_SUBJECT, code: 'ENG', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
			{ id: SCI_SUBJECT, code: 'SCI', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
		],
		faculty: [
			{ id: TEACHER_MATH, maxHoursPerWeek: 40 },
			{ id: TEACHER_ENG, maxHoursPerWeek: 40 },
			{ id: TEACHER_SCI, maxHoursPerWeek: 40 },
		],
		facultySubjects: [
			{ facultyId: TEACHER_MATH, subjectId: MATH_SUBJECT, gradeLevels: [7], sectionIds: [SECTION_A, SECTION_B, SECTION_C] },
			{ facultyId: TEACHER_ENG, subjectId: ENG_SUBJECT, gradeLevels: [7], sectionIds: [SECTION_A, SECTION_B, SECTION_C] },
			{ facultyId: TEACHER_SCI, subjectId: SCI_SUBJECT, gradeLevels: [7], sectionIds: [SECTION_A, SECTION_B, SECTION_C] },
		],
		rooms: [
			{ id: 701, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 },
			{ id: 702, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 },
			{ id: 703, type: 'CLASSROOM', isTeachingSpace: true, capacity: 40 },
		],
		preferences: [],
		policy: {
			periodLengthMinutes: 60,
			earliestStartTime: '07:00',
			latestEndTime: '15:00',
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			minBreakMinutesAfterConsecutiveBlock: 20,
			maxTeachingMinutesPerDay: 480,
		},
		demandOverride: [SECTION_A, SECTION_B, SECTION_C].flatMap((sectionId) => ([
			{ sectionId, subjectId: MATH_SUBJECT, subjectCode: 'MATH', gradeLevel: 7, sessionsPerWeek: 2, durationPerSession: 60, enrolledCount: 32, entryKind: 'SECTION' as const, programType: 'REGULAR', roomTypePreference: 'CLASSROOM' as const },
			{ sectionId, subjectId: ENG_SUBJECT, subjectCode: 'ENG', gradeLevel: 7, sessionsPerWeek: 2, durationPerSession: 60, enrolledCount: 32, entryKind: 'SECTION' as const, programType: 'REGULAR', roomTypePreference: 'CLASSROOM' as const },
			{ sectionId, subjectId: SCI_SUBJECT, subjectCode: 'SCI', gradeLevel: 7, sessionsPerWeek: 2, durationPerSession: 60, enrolledCount: 32, entryKind: 'SECTION' as const, programType: 'REGULAR', roomTypePreference: 'CLASSROOM' as const },
		])),
	};
}

/** Same shape, one field changed (schoolYearId) — must hash to a different cache key. */
function changedFixture(): ConstructorInput {
	return { ...moderateFixture(), schoolYearId: SCHOOL_YEAR_ID + 1 };
}

test('T2a: an identical input hits the cache on the second call (scheduler runs once)', () => {
	const fixture = moderateFixture();
	const first = runHybridSchedulerCached(fixture);
	assert.equal(first.cached, false, 'first call for a novel input must be a miss (real scheduler run)');

	const second = runHybridSchedulerCached(moderateFixture()); // fresh object, same logical content
	assert.equal(second.cached, true, 'second call with byte-identical logical input must hit the cache');
	assert.deepEqual(second.result.entries, first.result.entries);
	assert.deepEqual(second.result.unassignedItems, first.result.unassignedItems);
	assert.equal(second.result.assignedCount, first.result.assignedCount);
});

test('T2b: any changed field re-runs the scheduler (new cache key)', () => {
	runHybridSchedulerCached(moderateFixture());
	const changed = runHybridSchedulerCached(changedFixture());
	assert.equal(changed.cached, false, 'a changed constructorInput field must miss the cache and re-run the scheduler');
});

test('T2c: returned results are not shared-mutable across cache hits', () => {
	const fixture = moderateFixture();
	const first = runHybridSchedulerCached(fixture);
	const originalLength = first.result.entries.length;

	// Mutate the caller's copy of the result.
	(first.result.entries as unknown[]).push({ tampered: true });
	(first.result as { assignedCount: number }).assignedCount = -999;

	const second = runHybridSchedulerCached(moderateFixture());
	assert.equal(second.cached, true);
	assert.equal(second.result.entries.length, originalLength, 'a mutation on one caller\'s copy must not leak into the next cache hit');
	assert.notEqual(second.result.assignedCount, -999);
});

test('T2d: the cache is bounded — evict-oldest holds at capacity', () => {
	// Fresh, distinct, cheap-to-schedule inputs (empty demand short-circuits quickly).
	const distinctInput = (n: number): ConstructorInput => ({
		schoolId: SCHOOL_ID,
		schoolYearId: 90000 + n,
		sectionsByGrade: [],
		subjects: [],
		faculty: [],
		facultySubjects: [],
		rooms: [],
		preferences: [],
		demandOverride: [],
	});

	const first = distinctInput(0);
	const firstMiss = runHybridSchedulerCached(first);
	assert.equal(firstMiss.cached, false);

	// Insert enough new distinct entries to push the first one out under an
	// evict-oldest bound of SCHEDULER_RESULT_CACHE_LIMIT.
	for (let i = 1; i <= SCHEDULER_RESULT_CACHE_LIMIT; i++) {
		const miss = runHybridSchedulerCached(distinctInput(i));
		assert.equal(miss.cached, false, `input #${i} must be a novel cache key`);
	}

	// The very first input should now be evicted.
	const revisited = runHybridSchedulerCached(distinctInput(0));
	assert.equal(revisited.cached, false, 'the oldest entry must have been evicted once capacity was exceeded');

	// The most recently inserted input should still be resident.
	const stillWarm = runHybridSchedulerCached(distinctInput(SCHEDULER_RESULT_CACHE_LIMIT));
	assert.equal(stillWarm.cached, true, 'a recently inserted entry must still be cached');
});

test('T3: runHybridScheduler is deterministic, and the cache wrapper is deep-equal to a direct call', () => {
	const fixtureA = moderateFixture();
	const fixtureB = moderateFixture(); // logically identical, separate object graph

	const direct1 = runHybridScheduler(fixtureA);
	const direct2 = runHybridScheduler(fixtureB);
	assert.deepEqual(direct1.entries, direct2.entries, 'runHybridScheduler must be deterministic for identical input');
	assert.deepEqual(direct1.unassignedItems, direct2.unassignedItems);
	assert.equal(direct1.assignedCount, direct2.assignedCount);
	assert.equal(direct1.unassignedCount, direct2.unassignedCount);
	assert.equal(direct1.policyBlockedCount, direct2.policyBlockedCount);
	assert.equal(direct1.classesProcessed, direct2.classesProcessed);
	assert.equal(direct1.selectedProfileId, direct2.selectedProfileId);

	// The cached wrapper (used by the readiness path) must return the exact
	// same decision — caching is a latency change, never an answer change.
	const viaCache = runHybridSchedulerCached(moderateFixture());
	assert.deepEqual(viaCache.result.entries, direct1.entries);
	assert.deepEqual(viaCache.result.unassignedItems, direct1.unassignedItems);
	assert.equal(viaCache.result.assignedCount, direct1.assignedCount);
});
