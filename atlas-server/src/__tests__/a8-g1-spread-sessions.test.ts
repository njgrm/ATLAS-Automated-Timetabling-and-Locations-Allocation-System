/**
 * A8-G1 — a section's weekly classes must spread across the week.
 *
 * Packet: `docs/prompts/a8-g1-spread-sessions-2026-09-29.md`
 * Approach: `docs/prompts/a8-g1-spread-sessions-approach-2026-09-29-r2.md`
 *
 * Live Run 347 read as "Filipino, Filipino, Filipino, Filipino, Filipino —
 * Monday" for 8-Makatao. The root cause was that `daysUsedForPair` was a SOFT
 * `+2.5` score penalty that the home-room `-0.5` term exactly cancelled, so a
 * used day with a free home room tied an unused day with a busy one and Monday
 * won the `DAYS.indexOf` tie-break.
 *
 * The fix is ONE new first sort key (`dayUseCount`) on the existing
 * `possibleSlots` array. Nothing else about the placement loop changes, so
 * `unplaced` and the three overlap counts cannot move.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {
	constructBaseline,
	isDeclaredBlockSubject,
	type ConstructorInput,
	type LockedEntryInput,
	type SpreadOrdering,
} from '../services/schedule-constructor.js';
import {
	frameMismatchReason,
	frameRepresentationProblem,
	measureShape,
	REPRESENTATION_MIN_REPEAT_PAIRS,
	REPRESENTATION_MIN_WORST_CELL,
	type MeasurableEntry,
} from '../scripts/a8-g1-live-shape-proof.js';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const HOME_ROOM_ID = 30;
const OTHER_ROOM_ID = 31;
const SECTION_ID = 7;
const SUBJECT_ID = 1;
const FACULTY_ID = 1;
const LOCK_FACULTY_ID = 99;
const LOCK_SECTION_ID = 98;
const LOCK_SUBJECT_ID = 97;

// Five 45-minute periods: 07:30 through 11:30, matching the live run's
// 07:30/08:15/10:00/10:45/11:30 spread. Five is what lets the "spread is
// genuinely impossible" fixture put all five sessions on the one remaining day
// WITHOUT losing any to the period grid, so that row isolates the day rule
// instead of re-testing period capacity.
const PERIODS = [
	{ startTime: '07:30', endTime: '08:15' },
	{ startTime: '08:15', endTime: '09:00' },
	{ startTime: '09:00', endTime: '09:45' },
	{ startTime: '09:45', endTime: '10:30' },
	{ startTime: '10:30', endTime: '11:15' },
] as const;

const POLICY = {
	maxConsecutiveTeachingMinutesBeforeBreak: 300,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 600,
	earliestStartTime: '07:30',
	latestEndTime: '11:15',
	periodLengthMinutes: 45,
	periodsPerDay: 5,
	enableRecess: false,
	enableLunchWindow: false,
	enableFlagCeremony: false,
	showSpecialEventsInGrid: false,
} as const;

const SECTIONS_BY_GRADE = [
	{
		gradeLevelId: 8,
		// The packet's "8-Makatao" is a COMPOSED display string. The stored
		// pieces are the grade-level name and the section name; `DemandItem`
		// itself carries no section name at all.
		gradeLevelName: 'Grade 8',
		displayOrder: 8,
		sections: [
			{
				id: SECTION_ID,
				name: 'Makatao',
				enrolledCount: 32,
				gradeLevelId: 8,
				gradeLevelName: 'Grade 8',
				maxCapacity: 40,
				displayOrder: 1,
				programType: 'REGULAR',
				homeRoomId: HOME_ROOM_ID,
			},
		],
	},
] as const;

const SUBJECTS = [
	{
		id: SUBJECT_ID,
		code: 'FIL',
		// The exact label the receipt must show.
		name: 'Filipino',
		minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM',
		gradeLevels: [8],
		requiredFeatures: [],
		programScopes: ['REGULAR'],
	},
] as const;

const ROOMS = [HOME_ROOM_ID, OTHER_ROOM_ID].map((id) => ({
	id,
	name: `Room ${id}`,
	type: 'CLASSROOM',
	isTeachingSpace: true,
	isSharedFacility: false,
	capacity: 40,
	features: [],
	floor: 0,
	buildingId: 1,
	buildingGradeScope: [8],
	building: { gradeScope: [8], name: 'Grade 8 Academic Wing', shortCode: 'G8' },
}));

/** One Filipino session per period, 5 per week — the packet's fixture. */
const FIL_DEMAND = [
	{
		sectionId: SECTION_ID,
		subjectId: SUBJECT_ID,
		subjectCode: 'FIL',
		gradeLevel: 8,
		sessionsPerWeek: 5,
		durationPerSession: 45,
		enrolledCount: 32,
		entryKind: 'SECTION',
		homeRoomId: HOME_ROOM_ID,
		programType: 'REGULAR',
	} as const,
];

/**
 * The "tight rooms" of the packet fixture: the home room is free on MONDAY and
 * taken on EVERY other day, at EVERY period. Those locks are what made the old
 * `+2.5` / `-0.5` terms cancel to an exact 3.0 tie on Tue–Fri.
 *
 * Every period matters. An earlier version of this fixture locked only period 0
 * on Tue–Fri, which left the home room free at periods 1-4 and therefore gave
 * the legacy comparator a 0.5 candidate on those days too — at which point
 * legacy ALSO spread, and the fixture stopped reproducing the defect it exists to
 * reproduce. It is also why the local mutant below and this fixture must agree
 * on the room state: the mutant treats `busy` as a whole-day property, so the
 * fixture has to make it one.
 */
function homeRoomBusyExceptMondayLocks(): LockedEntryInput[] {
	const locks: LockedEntryInput[] = [];
	for (const day of ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const) {
		for (const period of PERIODS) {
			locks.push({
				sectionId: LOCK_SECTION_ID,
				subjectId: LOCK_SUBJECT_ID,
				facultyId: LOCK_FACULTY_ID,
				roomId: HOME_ROOM_ID,
				day,
				startTime: period.startTime,
				endTime: period.endTime,
				entryKind: 'SECTION',
			});
		}
	}
	return locks;
}

/**
 * Spread genuinely impossible: the SECTION ITSELF is booked out on Tuesday to
 * Friday for every period, so Monday is the only candidate day no matter how
 * the candidates are ordered.
 */
function sectionBookedOutExceptMondayLocks(): LockedEntryInput[] {
	const locks: LockedEntryInput[] = [];
	for (const day of ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const) {
		for (const period of PERIODS) {
			locks.push({
				sectionId: SECTION_ID,
				subjectId: LOCK_SUBJECT_ID,
				facultyId: LOCK_FACULTY_ID,
				roomId: OTHER_ROOM_ID,
				day,
				startTime: period.startTime,
				endTime: period.endTime,
				entryKind: 'SECTION',
			});
		}
	}
	return locks;
}

function buildInput(lockedEntries: LockedEntryInput[], demandOverride: unknown[] = [...FIL_DEMAND]): ConstructorInput {
	return {
		schoolId: 1,
		schoolYearId: 10,
		roomingStrategy: 'HOME_ROOM_FIRST',
		sectionsByGrade: SECTIONS_BY_GRADE as unknown as ConstructorInput['sectionsByGrade'],
		subjects: SUBJECTS as unknown as ConstructorInput['subjects'],
		faculty: [
			{ id: FACULTY_ID, maxHoursPerWeek: 40, department: 'LANG' },
			{ id: LOCK_FACULTY_ID, maxHoursPerWeek: 40, department: 'LANG' },
		] as unknown as ConstructorInput['faculty'],
		facultySubjects: [
			{ facultyId: FACULTY_ID, subjectId: SUBJECT_ID, gradeLevels: [8], sectionIds: [SECTION_ID] },
			{ facultyId: LOCK_FACULTY_ID, subjectId: LOCK_SUBJECT_ID, gradeLevels: [8], sectionIds: [LOCK_SECTION_ID] },
		] as unknown as ConstructorInput['facultySubjects'],
		rooms: ROOMS as unknown as ConstructorInput['rooms'],
		preferences: [],
		policy: { ...POLICY },
		lockedEntries,
		demandOverride,
	} as unknown as ConstructorInput;
}

/** The same input object with only the ordering seam changed. */
function withOrdering(input: ConstructorInput, ordering: SpreadOrdering): ConstructorInput {
	return { ...input, spreadOrdering: ordering };
}

function entriesForSection(entries: ReadonlyArray<{ subjectId: number; sectionId: number; day: string }>) {
	return entries.filter((entry) => entry.subjectId === SUBJECT_ID && entry.sectionId === SECTION_ID);
}

// ─── 1. THE FIX: five sessions a week land on five different days ────────────

test('A8-G1 1: 5 sessions/week with a tight home room spread over 5 distinct days', () => {
	const result = constructBaseline(buildInput(homeRoomBusyExceptMondayLocks()));
	const placed = entriesForSection(result.entries);

	assert.equal(placed.length, 5, 'all five weekly sessions are placed');
	assert.equal(result.unassignedCount, 0, 'spreading never leaves a session unplaced');

	const days = placed.map((entry) => entry.day).sort();
	assert.deepEqual(
		days,
		['FRIDAY', 'MONDAY', 'THURSDAY', 'TUESDAY', 'WEDNESDAY'],
		'each session lands on its own day — the "Filipino x5 — Monday" run is gone',
	);
	assert.equal(new Set(days).size, 5, 'no day is used twice by this pair');

	// The receipt must be clean on a run that spread successfully.
	const report = result.spreadReport;
	assert.ok(report, 'a spread report is always present, not only on failure');
	assert.equal(report.sameDayRepeatPairs, 0, 'no pair repeated a day');
	assert.deepEqual(report.exceptions, [], 'and no exception is reported');
});

// ─── 2. THE DISCRIMINATING CONTROL ───────────────────────────────────────────
// A local re-implementation of the comparator this change REMOVED, run over the
// same candidate list the production path sees. The repo's idiom is a local
// mutant (see `a5-c2a-active-term-resolver.test.ts:148`), not `git show` and
// not a second checkout. If this control ever agreed with the production path,
// the row above would be vacuously green.

/** The exact pre-change scoring and ordering, ~10 lines. */
function oldOrderingPicksMondayFiveTimes(daysHomeRoomBusy: readonly string[]): string[] {
	const busy = new Set<string>(daysHomeRoomBusy);
	const usedDays = new Set<string>(); // the old `daysUsedForPair` Set<string>
	const picks: string[] = [];
	for (let session = 0; session < 5; session++) {
		const candidates = DAYS.flatMap((day) =>
			PERIODS.map((period) => ({
				day,
				startTime: period.startTime,
				// old: 1 + (day used ? 2.5 : 0) + (home room busy ? 2 : -0.5)
				score: 1 + (usedDays.has(day) ? 2.5 : 0) + (busy.has(day) ? 2 : -0.5),
			})),
		);
		candidates.sort((a, b) =>
			a.score !== b.score
				? a.score - b.score
				: DAYS.indexOf(a.day as never) - DAYS.indexOf(b.day as never) || a.startTime.localeCompare(b.startTime),
		);
		picks.push(candidates[0].day);
		usedDays.add(candidates[0].day);
	}
	return picks;
}

test('A8-G1 2-control: the OLD ordering puts all five sessions on Monday', () => {
	const oldPicks = oldOrderingPicksMondayFiveTimes(['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);
	assert.deepEqual(
		oldPicks,
		['MONDAY', 'MONDAY', 'MONDAY', 'MONDAY', 'MONDAY'],
		'the removed comparator reproduces the live defect on this same fixture',
	);

	const production = entriesForSection(constructBaseline(buildInput(homeRoomBusyExceptMondayLocks())).entries);
	const productionDays = new Set(production.map((entry) => entry.day));
	assert.equal(
		productionDays.size,
		5,
		'and the production path disagrees with it — the control discriminates, it is not vacuous',
	);
	assert.equal(productionDays.has('MONDAY') && oldPicks.every((day) => day === 'MONDAY'), true);
});

// ─── 3. THE RECEIPT: a typed, NON-VIOLATION, correctly-labelled report ───────

test('A8-G1 3: when spread is impossible the run receipt states it with real labels', () => {
	const result = constructBaseline(buildInput(sectionBookedOutExceptMondayLocks()));
	const placed = entriesForSection(result.entries);

	assert.equal(placed.length, 5, 'the sessions are still placed — unplaced is never raised to satisfy spread');
	assert.equal(result.unassignedCount, 0, 'unplaced is unchanged');
	assert.ok(placed.every((entry) => entry.day === 'MONDAY'), 'all five land on the only day left');

	const report = result.spreadReport;
	assert.ok(report, 'the receipt group is present');
	assert.equal(report.sameDayRepeatPairs, 1, 'exactly one pair repeated a day');
	assert.equal(report.exceptions.length, 1, 'one exception for the one offending cell');

	const exception = report.exceptions[0];
	assert.deepEqual(
		{
			code: exception.code,
			sectionId: exception.sectionId,
			subjectId: exception.subjectId,
			day: exception.day,
			count: exception.count,
		},
		{
			code: 'SAME_DAY_REPEAT_NO_SPREAD_AVAILABLE',
			sectionId: SECTION_ID,
			subjectId: SUBJECT_ID,
			day: 'MONDAY',
			count: 5,
		},
		'the exception is typed and carries the real ids, day and count',
	);

	// The exact message from the packet, with the REAL label shapes:
	// `subjects.name` -> "Filipino"; the composed section label -> "8-Makatao"
	// (grade-level name with "Grade " removed, joined to the section name).
	assert.equal(exception.subjectLabel, 'Filipino');
	assert.equal(exception.sectionLabel, '8-Makatao');
	assert.equal(
		exception.message,
		'Filipino for 8-Makatao has 5 classes on Monday (no other day was free)',
		`the message must read exactly as the packet specifies, got: ${exception.message}`,
	);

	// The packet's own example wording, for the 2-class case it names.
	assert.equal(
		`${exception.subjectLabel} for ${exception.sectionLabel} has 2 classes on Monday (no other day was free)`,
		'Filipino for 8-Makatao has 2 classes on Monday (no other day was free)',
		'the message template produces the packet\'s literal example string',
	);
});

test('A8-G1 3b: the receipt is a grouped object, never a raw string[] and never a bare count', () => {
	const report = constructBaseline(buildInput(sectionBookedOutExceptMondayLocks())).spreadReport;
	assert.ok(report);
	assert.equal(typeof report.sameDayRepeatPairs, 'number', 'it carries a count');
	assert.ok(Array.isArray(report.exceptions), 'and a bounded exception list');
	for (const exception of report.exceptions) {
		assert.equal(typeof exception.message, 'string');
		assert.equal(typeof exception.code, 'string');
		assert.equal(typeof exception.sectionLabel, 'string');
		assert.equal(typeof exception.subjectLabel, 'string');
	}
});

test('A8-G1 3c: the receipt never becomes a violation', () => {
	const result = constructBaseline(buildInput(sectionBookedOutExceptMondayLocks()));
	// `modularWarnings` is the path that `generation.service.ts:1013-1014` maps
	// into `Violation[]`, which `publication-contract.service.ts` then refuses
	// publication over. A spread exception must not travel that road, and the
	// compiler proves the two code spaces are disjoint: `ModularWarning.code` is
	// a closed union that does not contain the spread code at all.
	const modularCodes: readonly string[] = (result.modularWarnings ?? []).map((warning) => warning.code);
	assert.equal(
		modularCodes.includes('SAME_DAY_REPEAT_NO_SPREAD_AVAILABLE'),
		false,
		'no spread code appears in modularWarnings',
	);
	assert.equal(
		JSON.stringify(result).includes('PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS'),
		false,
		'nothing in the constructor result references the soft-violation publication gate',
	);
	// The exception rides on its own grouped field instead.
	assert.ok(result.spreadReport?.exceptions.length);
});

// ─── 4. THE BLOCK PREDICATE: no migration, code only ────────────────────────

test('A8-G1 4: isDeclaredBlockSubject is false for every shape the schema can produce', () => {
	assert.equal(isDeclaredBlockSubject(null), false, 'a missing subject is not a block');
	assert.equal(isDeclaredBlockSubject(undefined), false);
	assert.equal(isDeclaredBlockSubject({ id: 1, modularGroupId: null }), false, 'a plain subject is not a block');
	// A modular rotation family is NOT a block, and must not be laundered into
	// one — otherwise a normal week could collapse into 2+2+1.
	assert.equal(isDeclaredBlockSubject({ id: 2, modularGroupId: 'SCIENCE' }), false, 'modular is not a block');
});

test('A8-G1 4b: `model Subject` declares no block/double-period field, so no migration is in scope', () => {
	const schemaPath = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		'../../../prisma/schema.prisma',
	);
	const schema = readFileSync(schemaPath, 'utf8');
	const model = schema.match(/^model Subject \{([\s\S]*?)^\}/m);
	assert.ok(model, 'prisma/schema.prisma must still declare `model Subject`');

	const fields = [...model[1].matchAll(/^\s{2}(\w+)\s+\S/gm)].map((match) => match[1]);
	assert.ok(fields.length > 0, 'the Subject model has fields to inspect');

	const blockLike = fields.filter((field) => /block|double|period|isPair|tandem/i.test(field));
	assert.deepEqual(
		blockLike,
		[],
		`no Subject column declares a block/double period; found ${JSON.stringify(blockLike)}. If a block column now exists, isDeclaredBlockSubject must consult it and this row is the signal to revisit the no-migration decision.`,
	);
});

// ─── 5. INVARIANTS THAT MUST NOT MOVE ──────────────────────────────────────

test('A8-G1 5: spreading introduces no teacher, section or room overlap', () => {
	const forTight = constructBaseline(buildInput(homeRoomBusyExceptMondayLocks()));
	const forImpossible = constructBaseline(buildInput(sectionBookedOutExceptMondayLocks()));

	for (const [label, result] of [['spread', forTight], ['forced repeat', forImpossible]] as const) {
		// Occupancy is interval-based, so two entries on one (holder, day, slot)
		// triple is exactly the overlap the packet forbids.
		const teacher = new Set<string>();
		const section = new Set<string>();
		const room = new Set<string>();
		for (const entry of result.entries) {
			for (const [set, holder] of [
				[teacher, `t${entry.facultyId}`],
				[section, `s${entry.sectionId}`],
				[room, `r${entry.roomId}`],
			] as const) {
				const key = `${holder}|${entry.day}|${entry.startTime}-${entry.endTime}`;
				assert.equal(set.has(key), false, `${label}: ${holder} double-booked ${entry.day} ${entry.startTime}`);
				set.add(key);
			}
		}
		assert.equal(result.unassignedCount, 0, `${label}: nothing was left unplaced`);
	}
});

test('A8-G1 5b: a lock counts as a day use, so it is seeded from ACCEPTED locks only', () => {
	// One accepted lock for OUR pair on Tuesday, plus one REJECTED lock (no
	// facultyId, so it never becomes an entry) also on Tuesday. The accepted
	// lock must consume Tuesday; the rejected one must not.
	const accepted: LockedEntryInput = {
		sectionId: SECTION_ID,
		subjectId: SUBJECT_ID,
		facultyId: FACULTY_ID,
		roomId: OTHER_ROOM_ID,
		day: 'TUESDAY',
		startTime: PERIODS[0].startTime,
		endTime: PERIODS[0].endTime,
		entryKind: 'SECTION',
	};
	const rejected: LockedEntryInput = { ...accepted, facultyId: null };

	const result = constructBaseline(buildInput([accepted, rejected]));
	assert.equal(result.lockWarnings.length, 1, 'exactly the faculty-less lock is rejected and warned about');
	assert.match(result.lockWarnings[0], /no valid facultyId/);

	// 4 sessions remain (one is fulfilled by the lock) and Tuesday is already
	// used, so the run must not put two of our pair's sessions on Tuesday.
	const placed = entriesForSection(result.entries);
	const tuesdaySessions = placed.filter((entry) => entry.day === 'TUESDAY');
	assert.equal(tuesdaySessions.length, 1, 'only the locked session is on Tuesday — the accepted lock seeded the day use');
	assert.equal(result.unassignedCount, 0);
});

test('A8-G1 5c: a subject with more sessions than days fills evenly before doubling', () => {
	// 8 sessions over 5 days: `preferredMaxPerDay` is ceil(8/5) = 2, so the
	// min-count key must give 2/2/2/1/1, not 5/1/1/1/0. Reaching 2 on a day is
	// the best a week can do for 8 sessions, so it is NOT an exception.
	const demand = FIL_DEMAND.map((item) => ({ ...item, sessionsPerWeek: 8 }));
	const result = constructBaseline(buildInput(homeRoomBusyExceptMondayLocks(), demand));
	const placed = entriesForSection(result.entries);
	assert.equal(placed.length, 8, 'all eight sessions placed');
	assert.equal(result.unassignedCount, 0);

	const perDay = new Map<string, number>();
	for (const entry of placed) perDay.set(entry.day, (perDay.get(entry.day) ?? 0) + 1);
	assert.deepEqual(
		[...perDay.values()].sort((a, b) => b - a),
		[2, 2, 2, 1, 1],
		'the spread fills the min-count day first: 2/2/2/1/1, and never 5 on one day',
	);
	assert.equal(result.spreadReport?.sameDayRepeatPairs, 0, 'filling days evenly to the cap is not an exception');
	assert.deepEqual(result.spreadReport?.exceptions, [], 'and reports nothing');

	// 11 sessions over 5 days: cap is ceil(11/5) = 3, so 3/2/2/2/2 is clean but
	// any day at 4+ is a real breach and must be reported.
	const heavy = FIL_DEMAND.map((item) => ({ ...item, sessionsPerWeek: 11 }));
	const heavyResult = constructBaseline(buildInput(homeRoomBusyExceptMondayLocks(), heavy));
	const heavyPlaced = entriesForSection(heavyResult.entries);
	assert.equal(heavyPlaced.length, 11, 'all eleven sessions placed');
	assert.equal(heavyResult.unassignedCount, 0, 'and still nothing unplaced');
	const heavyMax = Math.max(...DAYS.map((day) => heavyPlaced.filter((entry) => entry.day === day).length));
	assert.equal(heavyMax, 3, 'the heaviest day is exactly the cap, never more');
	assert.equal(heavyResult.spreadReport?.sameDayRepeatPairs, 0, 'reaching the cap is not a breach');
});

// ─── 6. D1: THE TWO SIDES OF THE PROOF MUST SHARE ONE FRAME ─────────────────
// The first proof attempt compared a saved 3-term run (2730 entries) against one
// constructor invocation (920 sessions) and produced a table that read as
// decisive. Nothing checked the frame, so every row in it was unquotable. These
// rows are the ones that must never be deleted.

test('A8-G1 6: both orderings are measured over the SAME input and the SAME frame', () => {
	const input = buildInput(homeRoomBusyExceptMondayLocks());
	const legacy = constructBaseline(withOrdering(input, 'LEGACY_SOFT_PENALTY'));
	const production = constructBaseline(withOrdering(input, 'DAY_COUNT_FIRST'));

	// The frame: how much work each side was asked to do. Identical by
	// construction, and asserted rather than assumed. It is 25, not 5, because
	// `classesProcessed` counts the 20 ACCEPTED locks as well as the five
	// sessions — and both sides must count them identically, which is part of
	// what makes the two sides comparable.
	assert.equal(legacy.classesProcessed, production.classesProcessed, 'both sides demand the same work');
	assert.equal(legacy.classesProcessed, 25, '20 accepted locks + 5 sessions, on both sides');
	assert.equal(legacy.assignedCount, 25, 'and every one is placed, on both sides');
	assert.equal(legacy.unassignedCount, 0);
	assert.equal(
		frameMismatchReason(
			measureShape(legacy.entries as unknown as MeasurableEntry[], legacy.classesProcessed),
			measureShape(production.entries as unknown as MeasurableEntry[], production.classesProcessed),
		),
		null,
		'the D1 frame guard must pass for a same-input comparison',
	);

	// And the one variable that differs really is the ordering.
	const legacyDays = new Set(entriesForSection(legacy.entries).map((entry) => entry.day));
	const productionDays = new Set(entriesForSection(production.entries).map((entry) => entry.day));
	assert.equal(legacyDays.size, 1, 'the legacy comparator puts every session on one day');
	assert.equal(productionDays.size, 5, 'and the production comparator spreads them');
	assert.deepEqual(legacy.entries.length, production.entries.length, 'both sides place the same number of sessions here');
});

test('A8-G1 6b: the frame guard REJECTS the first attempt\'s own table shape', () => {
	// 2730 entries from a 3-term run against 920 sessions from one week.
	const multiTerm = measureShape(
		Array.from({ length: 2730 }, (_, index) => ({
			facultyId: 1, roomId: 1, subjectId: 1, sectionId: 27,
			day: 'MONDAY', startTime: '07:30', endTime: '08:15',
		})),
		2730,
	);
	const oneWeek = measureShape(
		Array.from({ length: 855 }, (_, index) => ({
			facultyId: 1, roomId: 1, subjectId: 1, sectionId: 27,
			day: 'MONDAY', startTime: '07:30', endTime: '08:15',
		})),
		920,
	);
	const reason = frameMismatchReason(multiTerm, oneWeek);
	assert.notEqual(reason, null, 'a 3-term run and a one-week run are NOT comparable, and the guard must say so');
	assert.match(reason as string, /2730/);
	assert.match(reason as string, /920/);
});

test('A8-G1 6b2: the frame guard also rejects an empty frame', () => {
	const empty = measureShape([], 0);
	assert.notEqual(frameMismatchReason(empty, empty), null, 'zero sessions is not a comparison');
});

// ─── 7. D2: OVERLAPS ARE TERM-KEYED, BUT A SAME-TERM CLASH IS STILL FATAL ───

test('A8-G1 7: a re-teach in a different term is not an overlap', () => {
	// The artifact the first attempt measured: the same teacher, room and slot in
	// T1 and again in T2 is a legitimate rotation, not a double-book.
	const counts = measureShape(
		[
			{ facultyId: 5, roomId: 40, subjectId: 1, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
			{ facultyId: 5, roomId: 40, subjectId: 2, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 2 },
		],
		2,
	);
	assert.equal(counts.teacherOverlaps, 0, 'a cross-term re-teach is not a teacher overlap');
	assert.equal(counts.roomOverlaps, 0, 'nor a room overlap');
	assert.equal(counts.sectionOverlaps, 0, 'nor a section overlap');
});

test('A8-G1 7b: a double-book inside ONE term is still counted and is reported by term and slot', () => {
	const counts = measureShape(
		[
			{ facultyId: 5, roomId: 40, subjectId: 1, sectionId: 30, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
			{ facultyId: 5, roomId: 41, subjectId: 2, sectionId: 31, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 },
		],
		2,
	);
	assert.equal(counts.teacherOverlaps, 1, 'a genuine same-term double-book must never be filtered away');
	const detail = counts.overlapDetail[0];
	assert.ok(detail, 'and it must be reported so it can be checked');
	assert.equal(detail.holder, 't5');
	assert.equal(detail.term, 'T1');
	assert.equal(detail.day, 'MONDAY');
	assert.equal(detail.slot, '07:30-08:15');
	assert.equal(detail.samePair, false, 'two different pairs collided');
});

test('A8-G1 7c: the constructor leaves a concurrent lane unterm-ed, and that is its own bucket', () => {
	// `constructBaseline` sets `termIndex: sessionTermIndex`, which is undefined
	// for a non-modular lane. Two such lanes for one teacher in one slot must
	// still collide.
	const counts = measureShape(
		[
			{ facultyId: 6, roomId: 42, subjectId: 1, sectionId: 32, day: 'TUESDAY', startTime: '07:30', endTime: '08:15' },
			{ facultyId: 6, roomId: 43, subjectId: 2, sectionId: 33, day: 'TUESDAY', startTime: '07:30', endTime: '08:15' },
		],
		2,
	);
	assert.equal(counts.teacherOverlaps, 1, 'two concurrent lanes for one teacher in one slot DO overlap');
	assert.equal(counts.overlapDetail[0]?.term, 'CONCURRENT');
});

test('A8-G1 7d: NEITHER ordering can create an overlap, because occupancy gates every candidate', () => {
	// The structural reason the "75 teacher overlaps" cannot be attributed to
	// this change: `facultyOcc`/`roomOcc`/`sectionOcc` gate every candidate, and
	// A8-G1 only reorders the candidate list. Both orderings must agree.
	for (const ordering of ['LEGACY_SOFT_PENALTY', 'DAY_COUNT_FIRST'] as SpreadOrdering[]) {
		const result = constructBaseline(withOrdering(buildInput(homeRoomBusyExceptMondayLocks()), ordering));
		const counts = measureShape(result.entries as unknown as MeasurableEntry[], result.classesProcessed);
		assert.equal(counts.teacherOverlaps, 0, `${ordering}: a teacher is never double-booked`);
		assert.equal(counts.roomOverlaps, 0, `${ordering}: a room is never double-booked`);
		assert.equal(counts.sectionOverlaps, 0, `${ordering}: a section is never double-booked`);
	}
});

// ─── 8. THE UNPLACED MECHANISM: what spreading actually changes ─────────────
//
// The first attempt reported unplaced 10 -> 65. That comparison was between two
// different frames, so the rise is not yet attributable. What IS attributable,
// and is provable offline, is the MECHANISM the planner named: forcing a session
// onto an unused day changes WHICH days the section occupies, and therefore the
// residual grid every later demand item sees.
//
// These rows pin that mechanism's observable signature. They deliberately do NOT
// claim to reproduce the live magnitude of 55 — that needs the real restored
// inputs, and fabricating a fixture that "reproduced" it would prove a
// constraint I invented rather than the one that binds on live.

test('A8-G1 8: spreading raises the number of days a pair occupies, leaving less residual grid', () => {
	const input = buildInput(homeRoomBusyExceptMondayLocks());
	const legacy = constructBaseline(withOrdering(input, 'LEGACY_SOFT_PENALTY'));
	const production = constructBaseline(withOrdering(input, 'DAY_COUNT_FIRST'));

	const occupiedDays = (entries: Array<{ subjectId: number; sectionId: number; day: string }>) =>
		new Set(entriesForSection(entries).map((entry) => entry.day)).size;

	assert.equal(occupiedDays(legacy.entries), 1, 'legacy packs the pair onto one day');
	assert.equal(occupiedDays(production.entries), 5, 'production occupies five days for the same five sessions');

	// The cost side: the section's own occupancy is what every LATER demand item
	// has to route around. The pair still consumes exactly five section-slots —
	// the spread does not consume more work, it redistributes it across days.
	const sectionSlots = (entries: ReadonlyArray<{ subjectId: number; sectionId: number; day: string }>) => entriesForSection(entries).length;
	assert.equal(sectionSlots(legacy.entries), 5, 'the pair consumes five section-slots under legacy');
	assert.equal(sectionSlots(production.entries), 5, 'and exactly five under the spread — same total, different days');

	// The residual grid is the thing that changes. Count the (day, period) cells
	// this SECTION leaves free for its next subject, per day.
	const freeCellsPerDay = (entries: Array<{ sectionId: number; day: string; startTime: string }>, sectionId: number) => {
		const taken = new Set(entries.filter((e) => e.sectionId === sectionId).map((e) => `${e.day}|${e.startTime}`));
		return (day: string) => PERIODS.filter((p) => !taken.has(`${day}|${p.startTime}`)).length;
	};
	const legacyFree = freeCellsPerDay(legacy.entries, SECTION_ID);
	const productionFree = freeCellsPerDay(production.entries, SECTION_ID);

	// Legacy leaves 4 of 5 periods free on ONE day and all 5 free on the other
	// four. The spread leaves 4 free on every day. A later subject that needs a
	// contiguous block is served better by the legacy shape and worse by the
	// spread one — which is the mechanism, stated as a measurement.
	assert.equal(legacyFree('MONDAY'), 0, 'legacy fills Monday completely');
	assert.equal(legacyFree('TUESDAY'), 5, 'and leaves Tuesday entirely free');
	assert.equal(productionFree('MONDAY'), 4, 'the spread leaves 4 free on Monday');
	assert.equal(productionFree('TUESDAY'), 4, 'and 4 free on Tuesday as well');

	// On this fixture, where the grid is not binding, the redistribution costs
	// nothing. That is the honest scope of the offline claim: the rise is
	// capacity-dependent and only the restored live inputs can decide it.
	assert.equal(production.unassignedCount, legacy.unassignedCount, 'on a non-binding grid, unplaced is unchanged');
	assert.equal(production.unassignedCount, 0);
});

// ─── 9. D3 (frame content): the proof must run the PRODUCTION algorithm ─────
//
// Attempt 2 produced a LEGACY side with ZERO same-day repeats, so its `0 -> 0`
// spread result was vacuous rather than a pass. The cause was that the harness
// called `constructBaseline` directly, while `generation.service.ts:1006` calls
// `runHybridScheduler(constructorInput)` — multi-profile, best-by-completion,
// then `repairHardConflicts` and `repairUnassignedByEjection`. That is also why
// attempt 2 read 855/65 where production reads 910/10.

test('A8-G1 9: the production generation path is runHybridScheduler, not bare constructBaseline', async () => {
	const generationSource = readFileSync(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../services/generation.service.js'.replace(/\.js$/, '.ts')),
		'utf8',
	);
	// The row that would let a non-production frame back in: if generation stops
	// going through the hybrid scheduler, a bare-constructBaseline harness would
	// silently measure an algorithm that no run uses.
	assert.match(
		generationSource,
		/runHybridScheduler\(\s*constructorInput\s*\)/,
		'production generation must call runHybridScheduler(constructorInput)',
	);
	const { runHybridScheduler } = await import('../services/hybrid-scheduler.js');
	assert.equal(typeof runHybridScheduler, 'function', 'and the production entry point exists');
});

test('A8-G1 9b: the spreadOrdering seam survives the hybrid path into every profile run', async () => {
	const hybridSource = readFileSync(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../services/hybrid-scheduler.ts'),
		'utf8',
	);
	// Every `constructBaseline` call inside the hybrid scheduler must spread the
	// caller's input, or `spreadOrdering` would be dropped for all but one profile
	// and the two sides would not differ by exactly one variable.
	const calls = [...hybridSource.matchAll(/constructBaseline\(\{([^}]*)\}/g)].map((match) => match[1].trim());
	assert.ok(calls.length > 0, 'the hybrid scheduler must call constructBaseline');
	for (const call of calls) {
		assert.match(call, /\.\.\.input/, `every constructBaseline call must spread ...input, got: ${call}`);
	}
	// And the hybrid result still carries the constructor's spread report, so the
	// receipt survives the production path rather than only the bare one.
	const { runHybridScheduler } = await import('../services/hybrid-scheduler.js');
	const result = runHybridScheduler(withOrdering(buildInput(homeRoomBusyExceptMondayLocks()), 'DAY_COUNT_FIRST'));
	assert.ok(result.spreadReport, 'the production path still emits the spread receipt');
});

// ─── 10. D3: THE REPRESENTATION GUARD (permanent) ───────────────────────────
//
// The single gate for this round: the LEGACY side must reproduce the live-shaped
// defect, or the proof is worthless. A proof artefact must actually discriminate
// (AGENTS.md §11).

test('A8-G1 10: a LEGACY side that reproduces the defect PASSES the representation guard', () => {
	const legacyOnThisFixture = measureShape(
		constructBaseline(withOrdering(buildInput(homeRoomBusyExceptMondayLocks()), 'LEGACY_SOFT_PENALTY'))
			.entries as unknown as MeasurableEntry[],
		25,
	);
	assert.equal(
		frameRepresentationProblem(legacyOnThisFixture),
		null,
		'a legacy side with repeats and a worst cell of 5 is representative',
	);
	assert.ok(legacyOnThisFixture.sameDayRepeatPairs >= REPRESENTATION_MIN_REPEAT_PAIRS);
	assert.ok(legacyOnThisFixture.worstSameDayCount >= REPRESENTATION_MIN_WORST_CELL);
});

test('A8-G1 10b: a LEGACY side with repeats 0 is REJECTED, so a vacuous table can never pass', () => {
	// Attempt 2's exact situation: the production path on the restored data
	// produced repeats=0 and worst=0, which made `repeats 0 -> 0` meaningless.
	// 855 entries, every one its own (section, subject) pair, so no pair can
	// ever hold two sessions on one day.
	const vacuous = measureShape(
		Array.from({ length: 855 }, (_, index) => ({
			facultyId: 1, roomId: 1, subjectId: 1, sectionId: 1000 + index,
			day: 'MONDAY', startTime: '07:30', endTime: '08:15',
		})),
		920,
	);
	assert.equal(vacuous.sameDayRepeatPairs, 0, 'the fixture really does show no repeats');
	const reason = frameRepresentationProblem(vacuous);
	assert.notEqual(reason, null, 'the guard MUST fire when the before side cannot see the defect');
	assert.match(reason as string, /NOT representative/);
	assert.match(reason as string, /0 same-day repeat pair/);
});

test('A8-G1 10c: a LEGACY side whose worst cell is below 3 is REJECTED', () => {
	const weak = measureShape(
		[
			{ facultyId: 1, roomId: 60, subjectId: 1, sectionId: 50, day: 'MONDAY', startTime: '07:30', endTime: '08:15' },
			{ facultyId: 2, roomId: 60, subjectId: 1, sectionId: 50, day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		],
		2,
	);
	assert.equal(weak.worstSameDayCount, 2);
	const reason = frameRepresentationProblem(weak);
	assert.notEqual(reason, null, 'a worst cell of 2 is below the live Run 347 shape');
	assert.match(reason as string, /worst same-day cell/);
});

test('A8-G1 10d: the guard thresholds are pinned to the packet, not to whatever passes', () => {
	assert.equal(REPRESENTATION_MIN_REPEAT_PAIRS, 1, 'at least one repeated pair');
	assert.equal(REPRESENTATION_MIN_WORST_CELL, 3, 'live Run 347 held five Filipino sessions on Monday');
});

// ─── 11. D3: NULL-FACULTY ENTRIES ARE NOT TEACHER OVERLAPS ──────────────────

test('A8-G1 11: entries with no facultyId are excluded from the teacher counter and reported', () => {
	// Attempt 2 reported 71 "teacher overlaps", every one of them `holder=tnone`.
	// `schedule-constructor.ts:3203` emits `facultyId: isModularUnified ? null
	// : facId`, so a modular-unified lane has per-term teachers resolved
	// elsewhere. Collapsing them onto one placeholder holder manufactured the
	// count and made a real signal unfalsifiable.
	const counts = measureShape(
		[
			{ facultyId: null, roomId: 50, subjectId: 1, sectionId: 40, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
			{ facultyId: null, roomId: 51, subjectId: 2, sectionId: 41, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
			{ facultyId: null, roomId: 52, subjectId: 3, sectionId: 42, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
		],
		3,
	);
	assert.equal(counts.teacherOverlaps, 0, 'a null facultyId is not a teacher double-book');
	assert.equal(counts.entriesWithUnresolvedFaculty, 3, 'and the three entries are reported, not dropped');
	assert.deepEqual(counts.overlapDetail, [], 'no phantom offender is emitted');
});

test('A8-G1 11b: a REAL teacher double-book is still caught alongside null-faculty entries', () => {
	// The D3 fix must not become an escape hatch: it excludes only entries with
	// no faculty, never a genuine collision between two real teachers.
	const counts = measureShape(
		[
			{ facultyId: null, roomId: 50, subjectId: 1, sectionId: 40, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
			{ facultyId: 9, roomId: 53, subjectId: 4, sectionId: 43, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
			{ facultyId: 9, roomId: 54, subjectId: 5, sectionId: 44, day: 'MONDAY', startTime: '11:30', endTime: '12:15', termIndex: 1 },
		],
		3,
	);
	assert.equal(counts.teacherOverlaps, 1, 'the real teacher collision is still counted');
	assert.equal(counts.entriesWithUnresolvedFaculty, 1);
	assert.equal(counts.overlapDetail[0]?.holder, 't9', 'and the offender is the real teacher, not a placeholder');
});

test('A8-G1 11c: the constructor really does emit null facultyId for a modular-unified lane', () => {
	// Source-level confirmation of the D3 root cause, so the exclusion is tied to
	// a real constructor behaviour rather than to a guess about the log.
	const source = readFileSync(
		path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../services/schedule-constructor.ts'),
		'utf8',
	);
	assert.match(
		source,
		/facultyId:\s*isModularUnified\s*\?\s*null\s*:\s*facId/,
		'schedule-constructor.ts must emit facultyId: null for a modular-unified placement',
	);
});
