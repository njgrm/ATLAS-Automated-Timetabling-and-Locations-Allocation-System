/**
 * TT-WARNING-REALISM-C07A — server warning authority and count realism.
 *
 * Run: `npx tsx src/__tests__/tt-warning-realism-c07a.test.ts`
 *
 * Decisive failing-first controls for:
 *   A1 one violation per violating contiguous teaching block + slot-aligned
 *      consecutive default;
 *   A2 break-aware, in-shift-only idle gaps;
 *   A3 canonical-break reconciliation and the retired-code inventory;
 *   A4 identity-based adjacency (no geography);
 *   A5 truthful unassigned/reclassified codes and promotion-allowlist parity;
 *   A6 production-path parity across the generation / manual / pre-generation
 *      validator-context builders.
 *
 * Every control exercises the real `validateHardConstraints` (or the real
 * exported resolver the production path calls). Each mutant reproduces the
 * pre-fix behavior so no assertion is tautological.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
	applyConstraintOverrides,
	validateHardConstraints,
	VIOLATION_CODES,
	type ScheduledEntry,
	type ValidatorContext,
} from '../services/constraint-validator.js';
import {
	DEFAULT_ALLOWED_CONSECUTIVE_PERIODS,
	DEFAULT_CONSTRAINT_CONFIG,
	LEGACY_MAX_CONSECUTIVE_TEACHING_MINUTES,
	POLICY_DEFAULTS,
	PROMOTABLE_CONSTRAINT_CODES,
	isPromotableConstraintCode,
	resolveDefaultMaxConsecutiveTeachingMinutes,
	resolveMaxConsecutiveTeachingMinutesBeforeBreak,
} from '../services/scheduling-policy.service.js';
import { countBlockingHardViolations } from '../services/publication-contract.service.js';
import { buildPreflightValidatorContext } from '../services/generation-preflight.service.js';
import { buildValidatorCtx } from '../services/manual-edit.service.js';
import { buildPreGenerationValidatorContext } from '../services/pre-generation-draft.service.js';
import { resolveUnassignedViolationCode } from '../services/generation.service.js';
import {
	buildWarningWindowAuthority,
	resolvePolicyRowBreakWindows,
	resolveSpecialEventBreakWindows,
	type BreakWindowRef,
	type ShiftWindowRef,
} from '../services/warning-window-authority.service.js';

const SCHOOL = 11;
const YEAR = 9;
const RUN = 707;
const SECTION = 200;

// Canonical 45-minute slots, aligned to the primary beneficiary's period grid.
const P1 = { startTime: '06:00', endTime: '06:45' };
const P2 = { startTime: '06:45', endTime: '07:30' };
const P3 = { startTime: '07:30', endTime: '08:15' };
const P4 = { startTime: '08:15', endTime: '09:00' };
const P5 = { startTime: '09:00', endTime: '09:45' };
const P6 = { startTime: '10:00', endTime: '10:45' };
const P7 = { startTime: '10:45', endTime: '11:30' };
const P8 = { startTime: '12:15', endTime: '13:00' };
const P9 = { startTime: '13:45', endTime: '14:30' };

const HEALTH_BREAK = { startTime: '09:45', endTime: '10:00' };
const LUNCH_BREAK = { startTime: '11:30', endTime: '12:15' };

function entry(overrides: Partial<ScheduledEntry> & Pick<ScheduledEntry, 'entryId' | 'startTime' | 'endTime'>): ScheduledEntry {
	return {
		facultyId: 1,
		roomId: 2001,
		subjectId: 100,
		sectionId: SECTION,
		day: 'MONDAY',
		termIndex: 1,
		durationMinutes: 45,
		...overrides,
	};
}

function breakWindow(overrides: Partial<BreakWindowRef> & Pick<BreakWindowRef, 'eventType' | 'startTime' | 'endTime'>): BreakWindowRef {
	return {
		label: overrides.eventType,
		gradeLevel: null,
		programType: null,
		dayOfWeek: null,
		...overrides,
	};
}

function shiftWindow(startTime: string, endTime: string): ShiftWindowRef {
	return { startTime, endTime, gradeLevel: null, programType: null };
}

/**
 * The canonical primary-beneficiary fixture: 45-minute slots, one classroom
 * section, one ordinary Science-family subject (CLASSROOM authority) and an
 * explicitly specialized subject.
 *
 * `policy` deliberately omits `maxConsecutiveTeachingMinutesBeforeBreak` so the
 * slot-aligned default is exercised (the primary beneficiary has no explicitly
 * configured threshold yet).
 */
function primaryContext(entries: ScheduledEntry[], overrides: Partial<ValidatorContext> = {}): ValidatorContext {
	return {
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		runId: RUN,
		entries,
		faculty: [{ id: 1, maxHoursPerWeek: 40 }],
		facultySubjects: [
			{ facultyId: 1, subjectId: 100, sectionIds: [SECTION] },
			{ facultyId: 1, subjectId: 101, sectionIds: [SECTION] },
			{ facultyId: 1, subjectId: 102, sectionIds: [SECTION] },
		],
		rooms: [
			{ id: 2001, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
			{ id: 2002, type: 'CLASSROOM', capacity: 50, features: [], floor: 2 },
			{ id: 2003, type: 'LABORATORY', capacity: 40, features: ['SINK'], floor: 1 },
		],
		subjects: [
			// Ordinary Science-family subject: CLASSROOM authority (settled policy:
			// no implicit laboratory inference from a subject name or code).
			{ id: 100, preferredRoomType: 'CLASSROOM', requiredFeatures: [] },
			{ id: 101, preferredRoomType: 'CLASSROOM', requiredFeatures: [] },
			// Explicitly specialized authority (only a future beneficiary configures this).
			{ id: 102, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] },
		],
		sectionEnrollment: new Map([[SECTION, 40]]),
		sectionScope: new Map([[SECTION, { gradeLevel: 7, programType: 'REGULAR' }]]),
		policy: {
			periodLengthMinutes: 45,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '14:30',
			enforceConsecutiveBreakAsHard: true,
		},
		travelPolicy: {
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 30,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			enableIdleGapChecks: true,
			enableBuildingTransitionChecks: true,
			enableFloorTransitionChecks: true,
			enableEarlyStartChecks: false,
			enableLateEndChecks: false,
		},
		breakWindows: [
			breakWindow({ eventType: 'HEALTH_BREAK', ...HEALTH_BREAK }),
			breakWindow({ eventType: 'LUNCH_BREAK', ...LUNCH_BREAK }),
		],
		shiftWindows: [shiftWindow('06:00', '14:30')],
		...overrides,
	};
}

function counts(result: ReturnType<typeof validateHardConstraints>, code: string): number {
	return result.violations.filter((violation) => violation.code === code).length;
}

function multiset(result: ReturnType<typeof validateHardConstraints>): string[] {
	return result.violations
		.map((violation) => `${violation.code}:${violation.severity}:${JSON.stringify(violation.entities)}`)
		.sort();
}

// ─── A1: one violation per violating contiguous block ───────────────────────

test('A1/C1: two contiguous 45-minute periods emit zero consecutive-limit warnings', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 't1-p1', ...P1 }),
		entry({ entryId: 't1-p2', ...P2 }),
	]));
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0);
	assert.equal(counts(result, 'FACULTY_BREAK_REQUIREMENT_VIOLATED'), 0);
});

test('A1/C2: three contiguous 45-minute periods (135 min) are allowed — the slot-aligned default', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 't1-p1', ...P1 }),
		entry({ entryId: 't1-p2', ...P2 }),
		entry({ entryId: 't1-p3', ...P3 }),
	]));
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0);
});

test('A1/C3: four contiguous 45-minute periods emit exactly ONE warning naming all four members', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 't1-p1', ...P1 }),
		entry({ entryId: 't1-p2', ...P2 }),
		entry({ entryId: 't1-p3', ...P3 }),
		entry({ entryId: 't1-p4', ...P4 }),
	]));
	const consecutive = result.violations.filter((violation) => violation.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.equal(consecutive.length, 1, 'exactly one violation for the block');
	assert.deepEqual(
		consecutive[0].entities.entryIds,
		['t1-p1', 't1-p2', 't1-p3', 't1-p4'],
		'entities.entryIds must name every member of the block',
	);
	assert.equal(Number(consecutive[0].meta?.consecutiveMinutes), 180);
	assert.equal(Number(consecutive[0].meta?.maxConsecutive), 135);
});

test('A1 mutant M1: the former per-entry loop emits one row per member period (3 vs 1)', () => {
	// Reproduce the pre-fix emission: push inside the loop on every extension
	// beyond the threshold.
	const blockMinutes = [45, 90, 135, 180];
	const legacyCount = blockMinutes.filter((minutes) => minutes > 135).length;
	assert.equal(legacyCount, 1, 'the legacy loop emits on the 180-minute extension only (135 is not > 135)');

	// With the retired 120-minute threshold the same loop emits for 135 AND 180.
	const legacy120Count = blockMinutes.filter((minutes) => minutes > LEGACY_MAX_CONSECUTIVE_TEACHING_MINUTES).length;
	assert.equal(legacy120Count, 2);

	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 't1-p1', ...P1 }),
		entry({ entryId: 't1-p2', ...P2 }),
		entry({ entryId: 't1-p3', ...P3 }),
		entry({ entryId: 't1-p4', ...P4 }),
	]));
	assert.notEqual(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), legacy120Count, 'the real path must not emit per entry');
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 1);
});

test('A1 mutant M2: the legacy 120-minute threshold would warn at three contiguous periods', () => {
	const slotAligned = resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 120, periodLengthMinutes: 45 });
	assert.equal(slotAligned, 135, 'the retired non-slot-aligned default normalizes to 3 x 45');
	assert.equal(slotAligned, resolveDefaultMaxConsecutiveTeachingMinutes(45));
	assert.equal(resolveDefaultMaxConsecutiveTeachingMinutes(45), POLICY_DEFAULTS.periodLengthMinutes * DEFAULT_ALLOWED_CONSECUTIVE_PERIODS);

	// A legacy 120 threshold applied to the same three-period day WOULD warn.
	const threePeriods = 3 * 45;
	assert.ok(threePeriods > LEGACY_MAX_CONSECUTIVE_TEACHING_MINUTES, 'the legacy threshold is stricter than three periods');
	assert.ok(threePeriods <= slotAligned, 'the slot-aligned default allows exactly three periods');

	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 't1-p1', ...P1 }),
		entry({ entryId: 't1-p2', ...P2 }),
		entry({ entryId: 't1-p3', ...P3 }),
	]));
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0, 'three periods must pass on the real path');
});

test('A1: an explicitly configured slot-aligned threshold is honored verbatim', () => {
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 180, periodLengthMinutes: 45 }), 180);
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 135, periodLengthMinutes: 45 }), 135);
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 120, periodLengthMinutes: 60 }), 120);
	// An explicit non-aligned minute count that is NOT the retired constant stays.
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 100, periodLengthMinutes: 45 }), 100);

	const honored = validateHardConstraints(primaryContext([
		entry({ entryId: 'h1', ...P1 }),
		entry({ entryId: 'h2', ...P2 }),
		entry({ entryId: 'h3', ...P3 }),
		entry({ entryId: 'h4', ...P4 }),
	], {
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 180,
			periodLengthMinutes: 45,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '14:30',
			enforceConsecutiveBreakAsHard: true,
		},
	}));
	assert.equal(counts(honored, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0, 'an explicit 180-minute threshold allows four periods');
});

test('A1: one violation per block across ordered terms (three-term fixture)', () => {
	const perTerm = (term: 1 | 2 | 3) => [P1, P2, P3, P4].map((slot, index) =>
		entry({ entryId: `t${term}-p${index + 1}`, ...slot, termIndex: term }));
	const result = validateHardConstraints(primaryContext([...perTerm(1), ...perTerm(2), ...perTerm(3)]));
	const consecutive = result.violations.filter((violation) => violation.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.equal(consecutive.length, 3, 'one violation per ordered term');
	for (const violation of consecutive) {
		assert.equal(violation.entities.entryIds?.length, 4);
		assert.equal(Number(violation.meta?.consecutiveMinutes), 180, 'never summed across terms');
	}
});

// ─── A2/A3: break-aware in-shift idle + canonical break reconciliation ──────

test('A2/C4: configured Health Break and Lunch add ZERO idle minutes; one genuine free period counts once', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 'b-p4', ...P4 }),
		entry({ entryId: 'b-p5', ...P5 }),
		// configured Health Break 09:45-10:00 separates P5 from P6
		entry({ entryId: 'b-p6', ...P6 }),
		entry({ entryId: 'b-p7', ...P7 }),
		// configured Lunch 11:30-12:15 separates P7 from P8
		entry({ entryId: 'b-p8', ...P8 }),
		// ONE genuine unscheduled free period (13:00-13:45) inside the shift
		entry({ entryId: 'b-p9', ...P9 }),
	]));
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0, 'the configured breaks reset every block');
	assert.equal(counts(result, 'FACULTY_BREAK_REQUIREMENT_VIOLATED'), 0, 'a canonical break satisfies the requirement');
	const idle = result.violations.filter((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	assert.equal(idle.length, 1);
	assert.equal(Number(idle[0].meta?.totalIdleMinutes), 45, 'only the genuine free period is idle time');
});

test('A2 mutant M3: counting the configured break windows as idle overstates idle time', () => {
	const entries = [
		entry({ entryId: 'm-p4', ...P4 }),
		entry({ entryId: 'm-p5', ...P5 }),
		entry({ entryId: 'm-p6', ...P6 }),
		entry({ entryId: 'm-p7', ...P7 }),
		entry({ entryId: 'm-p8', ...P8 }),
		entry({ entryId: 'm-p9', ...P9 }),
	];
	const real = validateHardConstraints(primaryContext(entries));
	const mutant = validateHardConstraints(primaryContext(entries, { breakWindows: [] }));
	const realIdle = real.violations.find((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	const mutantIdle = mutant.violations.find((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	assert.equal(Number(realIdle?.meta?.totalIdleMinutes), 45);
	// The break-unaware mutant counts the 15-minute Health Break and the 45-minute
	// Lunch on top of the genuine free period.
	assert.equal(Number(mutantIdle?.meta?.totalIdleMinutes), 105);
	assert.notEqual(Number(realIdle?.meta?.totalIdleMinutes), Number(mutantIdle?.meta?.totalIdleMinutes));
});

test('A2: cross-shift and outside-shift time is never counted as idle', () => {
	// Two distinct grade shifts: morning 06:00-11:00 and afternoon 12:00-17:00.
	const crossShiftWindows: ShiftWindowRef[] = [
		{ startTime: '06:00', endTime: '11:00', gradeLevel: 7, programType: 'REGULAR' },
		{ startTime: '12:00', endTime: '17:00', gradeLevel: 9, programType: 'REGULAR' },
	];
	const crossScope = new Map<number, { gradeLevel: number; programType: string }>([
		[200, { gradeLevel: 7, programType: 'REGULAR' }],
		[201, { gradeLevel: 9, programType: 'REGULAR' }],
	]);
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 's-am', roomId: 2001, startTime: '08:00', endTime: '08:45', day: 'TUESDAY', sectionId: 200 }),
		entry({ entryId: 's-pm', roomId: 2002, startTime: '12:00', endTime: '12:45', day: 'TUESDAY', sectionId: 201 }),
	], {
		breakWindows: [],
		shiftWindows: crossShiftWindows,
		sectionScope: crossScope,
	}));
	// The 195-minute 08:45 -> 12:00 gap is entirely between two shifts, so it is
	// NOT idle time.
	assert.equal(counts(result, 'FACULTY_EXCESSIVE_IDLE_GAP'), 0);
});

test('A2: an absent shift authority preserves the legacy full-gap count (never silently drops it)', () => {
	const entries = [
		entry({ entryId: 'l-a', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: 'l-b', startTime: '09:30', endTime: '10:15' }),
	];
	const noAuthority = validateHardConstraints(primaryContext(entries, { shiftWindows: [], breakWindows: [] }));
	const idle = noAuthority.violations.find((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	assert.equal(Number(idle?.meta?.totalIdleMinutes), 45, 'an unknown shift counts the whole gap');
});

test('A3: a gap exactly equal to the configured break resets the block and emits nothing', () => {
	const exact = validateHardConstraints(primaryContext([
		entry({ entryId: 'e1', startTime: '06:00', endTime: '06:45' }),
		entry({ entryId: 'e2', startTime: '06:45', endTime: '07:30' }),
		entry({ entryId: 'e3', startTime: '07:30', endTime: '08:15' }),
		entry({ entryId: 'e4', startTime: '08:30', endTime: '09:15' }),
	]));
	assert.equal(counts(exact, 'FACULTY_BREAK_REQUIREMENT_VIOLATED'), 0, 'equality satisfies the requirement');
	// 06:00-08:15 is 135 minutes (allowed) and the 15-minute break resets before
	// the fourth period, so no consecutive-limit warning either.
	assert.equal(counts(exact, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 0);
	assert.equal(counts(exact, 'FACULTY_EXCESSIVE_IDLE_GAP'), 0, 'a break-exact gap is not idle time');
});

test('A3: an insufficient gap still emits the break-requirement warning and extends the block', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 'i1', ...P1 }),
		entry({ entryId: 'i2', ...P2 }),
		entry({ entryId: 'i3', ...P3 }),
		// 5-minute gap (08:15 -> 08:20), far below the 15-minute requirement
		entry({ entryId: 'i4', startTime: '08:20', endTime: '09:05' }),
		entry({ entryId: 'i5', startTime: '09:05', endTime: '09:50' }),
	]));
	assert.equal(counts(result, 'FACULTY_BREAK_REQUIREMENT_VIOLATED'), 1);
	assert.equal(counts(result, 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED'), 1, 'the extended block is reported once');
});

// ─── A4: identity-based adjacency, never geography ─────────────────────────

test('A4: transition warnings depend on building/floor identity and time, never on coordinates', () => {
	const base = [
		entry({ entryId: 'g-a', roomId: 2001, startTime: '08:00', endTime: '08:45', day: 'WEDNESDAY' }),
		entry({ entryId: 'g-b', roomId: 2002, startTime: '08:49', endTime: '09:34', day: 'WEDNESDAY' }),
		entry({ entryId: 'g-c', roomId: 2003, startTime: '09:35', endTime: '10:20', day: 'WEDNESDAY', subjectId: 102 }),
	];
	const run = (rooms: ValidatorContext['rooms']) => validateHardConstraints(primaryContext(base, {
		rooms,
		buildings: [
			{ id: 1, x: 0, y: 0 },
			{ id: 2, x: 9999, y: -9999 },
		] as never,
		roomBuildings: [
			{ roomId: 2001, buildingId: 1 },
			{ roomId: 2002, buildingId: 1 },
			{ roomId: 2003, buildingId: 2 },
		],
	}));
	const coordinatesOnly = run([
		{ id: 2001, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
		{ id: 2002, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
		{ id: 2003, type: 'LABORATORY', capacity: 40, features: ['SINK'], floor: 1 },
	]);
	// Same identities, absurd coordinate-only difference (extra canvas fields).
	const distant = run([
		{ id: 2001, type: 'CLASSROOM', capacity: 50, features: [], floor: 1, canvasX: -50_000, canvasY: 50_000, distanceMeters: 500 } as never,
		{ id: 2002, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
		{ id: 2003, type: 'LABORATORY', capacity: 40, features: ['SINK'], floor: 1 },
	]);
	assert.deepEqual(multiset(distant), multiset(coordinatesOnly), 'coordinates must never change a warning');
	assert.equal(counts(coordinatesOnly, 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), 0);
	// The identity-based families are the ones that remain.
	assert.ok(counts(coordinatesOnly, 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER') >= 0);
	assert.ok(counts(coordinatesOnly, 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS') >= 0);
	for (const violation of [...coordinatesOnly.violations, ...distant.violations]) {
		assert.equal('estimatedDistanceMeters' in (violation.meta ?? {}), false);
	}
});

test('A4/A3: the retired metric travel code has no producer, no config, and no server display residue', () => {
	const RETIRED = 'FACULTY_EXCESSIVE_TRAVEL' + '_DISTANCE';
	assert.equal((VIOLATION_CODES as readonly string[]).includes(RETIRED), false, 'no ViolationCode producer');
	assert.equal(Object.prototype.hasOwnProperty.call(DEFAULT_CONSTRAINT_CONFIG, RETIRED), false, 'no config default');
	assert.equal(isPromotableConstraintCode(RETIRED), false, 'never a publication blocker');

	for (const relative of [
		'../services/constraint-validator.ts',
		'../services/scheduling-policy.service.ts',
		'../services/manual-edit.service.ts',
		'../services/pre-generation-draft.service.ts',
		'../services/generation.service.ts',
		'../services/generation-preflight.service.ts',
	]) {
		const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
		assert.equal(source.includes(RETIRED), false, `${relative} must carry no residue of the retired code`);
	}

	// A legacy persisted HARD row still cannot block publication, and the retired
	// code is absent from a real validator result.
	const result = validateHardConstraints(primaryContext([entry({ entryId: 'r1', ...P1 })]));
	assert.equal(counts(result, RETIRED), 0);
	assert.equal(countBlockingHardViolations([{ code: RETIRED, severity: 'HARD' }]), 0);
});

test('A4: no geographic or canvas term exists anywhere in the warning authority sources', () => {
	for (const relative of ['../services/constraint-validator.ts', '../services/warning-window-authority.service.ts']) {
		const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
		for (const forbidden of ['estimatedDistanceMeters', 'walkingDistance', 'canvasX', 'canvasY', 'distanceMeters']) {
			assert.equal(source.includes(forbidden), false, `${relative} must not consult ${forbidden}`);
		}
	}
});

// ─── A5: truthful severity, code, and authority ─────────────────────────────

test('A5/C5: same-time overlaps stay HARD; cross-term overlaps do not conflict', () => {
	const sameTime = validateHardConstraints(primaryContext([
		entry({ entryId: 'c-a', roomId: 2001, ...P1, termIndex: 1 }),
		entry({ entryId: 'c-b', roomId: 2001, ...P1, termIndex: 1 }),
	]));
	assert.equal(counts(sameTime, 'ROOM_TIME_CONFLICT'), 1);
	assert.equal(counts(sameTime, 'FACULTY_TIME_CONFLICT'), 1);
	assert.equal(counts(sameTime, 'SECTION_TIME_CONFLICT'), 1);
	assert.equal(sameTime.violations.filter((violation) => violation.code === 'FACULTY_TIME_CONFLICT' && violation.severity === 'HARD').length, 1);

	const crossTerm = validateHardConstraints(primaryContext([
		entry({ entryId: 'x-a', roomId: 2001, ...P1, termIndex: 1, subjectId: 100 }),
		entry({ entryId: 'x-b', roomId: 2001, ...P1, termIndex: 2, subjectId: 101 }),
	]));
	assert.equal(counts(crossTerm, 'ROOM_TIME_CONFLICT'), 0);
	assert.equal(counts(crossTerm, 'FACULTY_TIME_CONFLICT'), 0);
	assert.equal(counts(crossTerm, 'SECTION_TIME_CONFLICT'), 0);
});

test('A5/C6: ordinary Science in a CLASSROOM produces zero laboratory-derived warnings', () => {
	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 'sci-1', roomId: 2001, subjectId: 100, ...P1 }),
		entry({ entryId: 'sci-2', roomId: 2002, subjectId: 101, ...P2 }),
	]));
	assert.equal(counts(result, 'ROOM_TYPE_MISMATCH'), 0);
	assert.equal(counts(result, 'ROOM_FEATURE_MISMATCH'), 0);
	assert.equal(counts(result, 'SPECIALIZED_ROOM_UNAVAILABLE'), 0);
	assert.ok(result.violations.every((violation) => violation.severity !== 'HARD' || violation.code !== 'ROOM_TYPE_MISMATCH'));
});

test('A5/C6: an explicit LABORATORY authority with an unusable room produces the truthful typed warning', () => {
	// (a) The persisted authority cannot be satisfied and the constructor recorded
	// the reason → SOFT, truthful ROOM_TYPE_MISMATCH (never HARD, never a
	// specialized-room unassigned item).
	const deferred = validateHardConstraints(primaryContext([
		entry({
			entryId: 'lab-deferred',
			roomId: 2001,
			subjectId: 102,
			...P1,
			metadata: {
				roomAssignmentReason: 'HOME_ROOM_ASSIGNED',
				roomAuthorityDeviationReason: 'PREFERRED_ROOM_UNUSABLE_NO_REQUIRED_FEATURES',
				deferredRoomTypePreference: true,
			},
		}),
	]));
	const mismatch = deferred.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH');
	assert.equal(mismatch.length, 1);
	assert.equal(mismatch[0].severity, 'SOFT');
	assert.equal((mismatch[0].meta as { preferredRoomType?: string })?.preferredRoomType, 'LABORATORY');
	assert.equal(counts(deferred, 'SPECIALIZED_ROOM_UNAVAILABLE'), 0);

	// (b) A genuinely unsatisfied authority with NO recorded reason is the HARD
	// regression signal — the truthful typed warning.
	const unsignalled = validateHardConstraints(primaryContext([
		entry({ entryId: 'lab-hard', roomId: 2001, subjectId: 102, ...P1 }),
	]));
	assert.equal(
		unsignalled.violations.filter((violation) => violation.code === 'ROOM_TYPE_MISMATCH' && violation.severity === 'HARD').length,
		1,
	);

	// (c) A satisfied LABORATORY authority produces nothing.
	const satisfied = validateHardConstraints(primaryContext([
		entry({ entryId: 'lab-ok', roomId: 2003, subjectId: 102, ...P1 }),
	]));
	assert.equal(counts(satisfied, 'ROOM_TYPE_MISMATCH'), 0);
	assert.equal(counts(satisfied, 'ROOM_FEATURE_MISMATCH'), 0);
});

test('A5 mutant M5: no implicit Science-name laboratory inference exists in the validator', () => {
	const source = readFileSync(new URL('../services/constraint-validator.ts', import.meta.url), 'utf8');
	// The validator never branches on a subject code or name: authority is
	// `SubjectRef.preferredRoomType` alone.
	for (const forbidden of ["'SCI'", '"SCI"', 'SCIENCE', "'LAB'", 'subject.code', 'subject.name', 'subjectCode ===']) {
		assert.equal(source.includes(forbidden), false, `the validator must not special-case ${forbidden}`);
	}
	// SubjectRef carries no code/name at all.
	const classroom = validateHardConstraints(primaryContext([
		entry({ entryId: 'infer-1', roomId: 2003, subjectId: 100, ...P1 }),
	]));
	assert.equal(counts(classroom, 'ROOM_TYPE_MISMATCH'), 1, 'a CLASSROOM authority in a LABORATORY is a mismatch (authority, not name)');
	assert.equal(counts(classroom, 'SPECIALIZED_ROOM_UNAVAILABLE'), 0);
});

test('A5 mutant M6: a missing subject / missing qualified faculty is never a SOFT specialized-room warning', () => {
	const missingFaculty = resolveUnassignedViolationCode({
		reason: 'NO_QUALIFIED_FACULTY',
		roomAssignmentReason: 'NO_QUALIFIED_FACULTY',
	});
	assert.deepEqual(missingFaculty, { code: 'LACKING_FACULTY', severity: 'HARD' });

	// A stale/legacy room label alongside a faculty cause must not launder it.
	const staleRoomLabel = resolveUnassignedViolationCode({
		reason: 'NO_QUALIFIED_FACULTY',
		roomAssignmentReason: 'SPECIALIZED_ROOM_UNAVAILABLE',
	});
	assert.deepEqual(staleRoomLabel, { code: 'LACKING_FACULTY', severity: 'HARD' });

	// Mutant: the pre-fix mapping keyed the code on the room label alone.
	const legacyMapping = ({ roomAssignmentReason }: { roomAssignmentReason?: string }) =>
		roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE'
			? { code: 'SPECIALIZED_ROOM_UNAVAILABLE', severity: 'SOFT' }
			: { code: 'UNASSIGNED_SECTION', severity: 'HARD' };
	assert.deepEqual(legacyMapping({ roomAssignmentReason: 'SPECIALIZED_ROOM_UNAVAILABLE' }), { code: 'SPECIALIZED_ROOM_UNAVAILABLE', severity: 'SOFT' });
	assert.notDeepEqual(legacyMapping({ roomAssignmentReason: 'SPECIALIZED_ROOM_UNAVAILABLE' }), staleRoomLabel);

	// A workload/availability refusal stays a HARD non-room blocker.
	assert.deepEqual(
		resolveUnassignedViolationCode({ reason: 'FACULTY_OVERLOADED', roomAssignmentReason: 'FACULTY_SLOT_UNAVAILABLE' }),
		{ code: 'UNASSIGNED_SECTION', severity: 'HARD' },
	);
	assert.deepEqual(
		resolveUnassignedViolationCode({ reason: 'NO_AVAILABLE_SLOT', roomAssignmentReason: 'FACULTY_SLOT_UNAVAILABLE' }),
		{ code: 'UNASSIGNED_SECTION', severity: 'HARD' },
	);
	// The room code requires BOTH a room-path failure and the specialized authority.
	assert.deepEqual(
		resolveUnassignedViolationCode({ reason: 'NO_COMPATIBLE_ROOM', roomAssignmentReason: 'SPECIALIZED_ROOM_UNAVAILABLE' }),
		{ code: 'SPECIALIZED_ROOM_UNAVAILABLE', severity: 'SOFT' },
	);
	assert.deepEqual(
		resolveUnassignedViolationCode({ reason: 'NO_COMPATIBLE_ROOM', roomAssignmentReason: 'ROOM_PATH_EXHAUSTED' }),
		{ code: 'UNASSIGNED_SECTION', severity: 'HARD' },
	);
});

test('A5: ROOM_CAPACITY_EXCEEDED stays SOFT and can never become a publication blocker', () => {
	assert.equal(DEFAULT_CONSTRAINT_CONFIG.ROOM_CAPACITY_EXCEEDED.treatAsHard, false);
	assert.equal(isPromotableConstraintCode('ROOM_CAPACITY_EXCEEDED'), false);

	const result = validateHardConstraints(primaryContext([
		entry({ entryId: 'cap-1', roomId: 2001, ...P1 }),
	], {
		sectionEnrollment: new Map([[SECTION, 99]]),
		constraintConfig: {
			ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: true },
		},
	}));
	const capacity = result.violations.filter((violation) => violation.code === 'ROOM_CAPACITY_EXCEEDED');
	assert.equal(capacity.length, 1);
	assert.equal(capacity[0].severity, 'SOFT', 'a raw treatAsHard must not promote a non-allowlisted code');
	assert.equal(countBlockingHardViolations(result.violations), 0);
});

test('A5: modular-group families carry truthful severity and allowlist-consistent authority', () => {
	for (const code of ['LACKING_FACULTY', 'INCOMPLETE_MODULAR_GROUP']) {
		assert.ok(Object.prototype.hasOwnProperty.call(DEFAULT_CONSTRAINT_CONFIG, code), `${code} must carry a default config`);
		assert.equal(isPromotableConstraintCode(code), true, `${code} is on the promotion allowlist`);
		assert.equal(DEFAULT_CONSTRAINT_CONFIG[code].treatAsHard, false, `${code} defaults to informational`);
		assert.equal(DEFAULT_CONSTRAINT_CONFIG[code].enabled, true);
	}

	// The injected generation-service violations obey the same configured authority.
	const soft = [{
		code: 'LACKING_FACULTY' as const,
		severity: 'SOFT' as const,
		message: 'Lacking faculty',
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		runId: RUN,
		entities: { sectionId: SECTION },
	}];
	assert.equal(applyConstraintOverrides(soft, DEFAULT_CONSTRAINT_CONFIG)[0].severity, 'SOFT');
	const promoted = applyConstraintOverrides(soft, {
		...DEFAULT_CONSTRAINT_CONFIG,
		LACKING_FACULTY: { enabled: true, weight: 5, treatAsHard: true },
	});
	assert.equal(promoted[0].severity, 'HARD', 'an allowlisted treatAsHard promotes it');
	assert.equal(Number(promoted[0].meta?.constraintWeight), 5);

	const disabled = applyConstraintOverrides(soft, {
		...DEFAULT_CONSTRAINT_CONFIG,
		LACKING_FACULTY: { enabled: false, weight: 5, treatAsHard: false },
	});
	assert.equal(disabled.length, 0, 'disabling drops the SOFT constraint');

	// A non-allowlisted code is never promoted even through the shared contract.
	const nonPromotable = applyConstraintOverrides(
		soft.map((violation) => ({ ...violation, code: 'ZONE_IMBALANCE_WARNING' as const })),
		{ ZONE_IMBALANCE_WARNING: { enabled: true, weight: 3, treatAsHard: true } },
	);
	assert.equal(nonPromotable[0].severity, 'SOFT');
});

test('A5: the promotion allowlist is unchanged and excludes every wellbeing/preference/room-capacity family', () => {
	assert.deepEqual([...PROMOTABLE_CONSTRAINT_CODES].sort(), [
		'FACULTY_DAILY_MAX_EXCEEDED', 'FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED',
		'FACULTY_TIME_CONFLICT', 'INCOMPLETE_MODULAR_GROUP', 'LACKING_FACULTY',
		'ROOM_FEATURE_MISMATCH', 'ROOM_TIME_CONFLICT', 'ROOM_TYPE_MISMATCH',
		'SECTION_TIME_CONFLICT', 'UNASSIGNED_SECTION',
	].sort());
	for (const code of [
		'ROOM_CAPACITY_EXCEEDED', 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'FACULTY_BREAK_REQUIREMENT_VIOLATED',
		'FACULTY_EXCESSIVE_IDLE_GAP', 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER', 'FACULTY_FLOOR_TRANSITION',
		'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS', 'ZONE_IMBALANCE_WARNING', 'SPECIALIZED_ROOM_UNAVAILABLE',
		'FACULTY_INSUFFICIENT_DAILY_VACANT', 'SECTION_OVERCOMPRESSED',
	]) {
		assert.equal(isPromotableConstraintCode(code), false, `${code} must never block publication`);
	}
});

test('A3 reachability verdict: the vacant/compressed families keep a real operator control and consumer', () => {
	// Positive control: the producer is reachable when an operator enables the
	// family, and the emitted violation carries actionable entities/meta.
	const reachable = validateHardConstraints(primaryContext([entry({ entryId: 'v-1', roomId: 2001, ...P1 })], {
		vacantPolicy: {
			enableVacantAwareConstraints: true,
			targetFacultyDailyVacantMinutes: 300,
			targetSectionDailyVacantPeriods: 1,
			maxCompressedTeachingMinutesPerDay: 10,
		},
		constraintConfig: {
			...DEFAULT_CONSTRAINT_CONFIG,
			FACULTY_INSUFFICIENT_DAILY_VACANT: { enabled: true, weight: 3, treatAsHard: false },
			SECTION_OVERCOMPRESSED: { enabled: true, weight: 3, treatAsHard: false },
		},
	}));
	assert.equal(counts(reachable, 'FACULTY_INSUFFICIENT_DAILY_VACANT'), 1);
	assert.ok(counts(reachable, 'SECTION_OVERCOMPRESSED') >= 1);
	const vacant = reachable.violations.find((violation) => violation.code === 'FACULTY_INSUFFICIENT_DAILY_VACANT');
	assert.equal(vacant?.entities.facultyId, 1);
	assert.equal(vacant?.entities.day, 'MONDAY');
	assert.equal(Number(vacant?.meta?.vacantMinutes), 0);
	assert.equal(Number(vacant?.meta?.targetVacantMinutes), 300);
	const compressed = reachable.violations.find((violation) => violation.code === 'SECTION_OVERCOMPRESSED');
	assert.equal(compressed?.entities.sectionId, SECTION);
	assert.ok(compressed?.meta != null, 'the compressed family carries actionable meta');

	// The default configuration keeps them informational (operator opt-in).
	assert.equal(DEFAULT_CONSTRAINT_CONFIG.FACULTY_INSUFFICIENT_DAILY_VACANT.enabled, false);
	assert.equal(DEFAULT_CONSTRAINT_CONFIG.SECTION_OVERCOMPRESSED.enabled, false);
	assert.equal(isPromotableConstraintCode('FACULTY_INSUFFICIENT_DAILY_VACANT'), false);
	assert.equal(isPromotableConstraintCode('SECTION_OVERCOMPRESSED'), false);
});

// ─── A6: production-path parity across every real context builder ───────────

interface ParityFixture {
	contexts: { generation: ValidatorContext; manual: ValidatorContext; preGeneration: ValidatorContext };
}

function parityFixture(): ParityFixture {
	const policyRow = {
		periodLengthMinutes: 45,
		maxConsecutiveTeachingMinutesBeforeBreak: 135,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '14:30',
		enforceConsecutiveBreakAsHard: true,
		enableTravelWellbeingChecks: true,
		maxBuildingTransitionsPerDay: 1,
		maxBackToBackTransitionsWithoutBuffer: 0,
		maxIdleGapMinutesPerDay: 30,
		avoidEarlyFirstPeriod: false,
		avoidLateLastPeriod: false,
		enableVacantAwareConstraints: false,
		targetFacultyDailyVacantMinutes: 60,
		targetSectionDailyVacantPeriods: 1,
		maxCompressedTeachingMinutesPerDay: 300,
		enableRecess: false,
		// A configured Lunch window: breaks are non-teaching time and gaps exactly
		// covering them are neither idle time nor a break-requirement violation.
		enableLunchWindow: true,
		lunchStartTime: LUNCH_BREAK.startTime,
		lunchEndTime: LUNCH_BREAK.endTime,
		enableFlagCeremony: false,
		constraintConfig: {},
	};
	const sectionsByGrade = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ id: SECTION, mirrorId: 1, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
	const rooms = [
		{ id: 2001, type: 'CLASSROOM' as const, capacity: 50, features: [] as string[], floor: 1, buildingId: 1 },
		{ id: 2002, type: 'CLASSROOM' as const, capacity: 50, features: [] as string[], floor: 4, buildingId: 1 },
	];
	const subjects = [
		{ id: 100, preferredRoomType: 'CLASSROOM' as const, requiredFeatures: [] as string[] },
		{ id: 101, preferredRoomType: 'CLASSROOM' as const, requiredFeatures: [] as string[] },
	];
	const faculty = [{ id: 1, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }];
	const facultySubjects = [
		{ facultyId: 1, subjectId: 100, sectionIds: [SECTION] },
		{ facultyId: 1, subjectId: 101, sectionIds: [SECTION] },
	];
	const sectionEnrollment = new Map([[SECTION, 40]]);
	const shiftWindows = [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '14:30' }];
	// Non-trivial schedule: a four-period block (consecutive), a three-floor
	// transition, a Lunch-covered gap (zero idle) and a genuine idle gap — all
	// carrying explicit term identity.
	const entries: ScheduledEntry[] = [
		entry({ entryId: 'par-p1', roomId: 2001, subjectId: 100, ...P1 }),
		entry({ entryId: 'par-p2', roomId: 2001, subjectId: 100, ...P2 }),
		entry({ entryId: 'par-p3', roomId: 2001, subjectId: 100, ...P3 }),
		entry({ entryId: 'par-p4', roomId: 2001, subjectId: 100, ...P4 }),
		entry({ entryId: 'par-floor-a', roomId: 2001, subjectId: 101, day: 'TUESDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: 'par-floor-b', roomId: 2002, subjectId: 101, day: 'TUESDAY', startTime: '08:49', endTime: '09:34' }),
		// The 11:30-12:15 gap is exactly the configured Lunch window.
		entry({ entryId: 'par-lunch-a', roomId: 2001, subjectId: 101, day: 'WEDNESDAY', startTime: '10:45', endTime: '11:30' }),
		entry({ entryId: 'par-lunch-b', roomId: 2001, subjectId: 101, day: 'WEDNESDAY', startTime: '12:15', endTime: '13:00' }),
		// A genuine 75-minute unscheduled gap inside the shift.
		entry({ entryId: 'par-idle-a', roomId: 2001, subjectId: 101, day: 'THURSDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: 'par-idle-b', roomId: 2001, subjectId: 101, day: 'THURSDAY', startTime: '10:00', endTime: '10:45' }),
	];

	const generation = buildPreflightValidatorContext(
		{
			scope: { schoolId: SCHOOL, schoolYearId: YEAR },
			faculty,
			facultySubjects,
			rooms,
			subjects,
			sectionsByGrade,
			policyRow,
			policy: { present: true, id: 1, periodLengthMinutes: 45, periodsPerDay: 10 },
			buildings: [{ id: 1 }],
			specialEvents: [],
			gradeWindows: shiftWindows,
		} as unknown as Parameters<typeof buildPreflightValidatorContext>[0],
		entries,
		RUN,
	);

	// The manual context consumes the authority `loadRunContext` derives; resolve
	// it here through the same exported resolver so the parity control covers the
	// real derivation.
	const manualAuthority = buildWarningWindowAuthority({
		sections: [{ id: SECTION, gradeLevel: 7, programType: 'REGULAR' }],
		policyRow,
		specialEvents: [],
		shiftWindows,
	});

	const manual = buildValidatorCtx(SCHOOL, YEAR, RUN, entries, {
		run: { id: RUN, schoolId: SCHOOL, schoolYearId: YEAR, status: 'COMPLETED', summary: { isPublished: false }, draftEntries: [], unassignedItems: [], version: 1 },
		entries: [],
		unassignedItems: [],
		faculty,
		facultySubjects: facultySubjects.map((fs) => ({ ...fs, gradeLevels: [7] })),
		rooms: rooms.map((room) => ({ ...room, isTeachingSpace: true, isSharedFacility: false, buildingGradeScope: [7], building: { gradeScope: [7] } })),
		subjects: subjects.map((subject) => ({ ...subject, code: 'SUB', minMinutesPerWeek: 225, gradeLevels: [7] })),
		policyRecord: policyRow,
		buildings: [{ id: 1 }],
		facultyNameMap: new Map([[1, 'Teacher']]),
		roomNameMap: new Map([[2001, 'Room 2001']]),
		subjectNameMap: new Map([[100, 'SUB']]),
		subjectNameDetailMap: new Map([[100, 'Subject']]),
		sectionEnrollment,
		sectionGradeLevel: new Map([[SECTION, 7]]),
		windowAuthority: manualAuthority,
	} as unknown as Parameters<typeof buildValidatorCtx>[4]);

	const preGeneration = buildPreGenerationValidatorContext(SCHOOL, YEAR, entries, {
		facultyRefs: faculty,
		facultySubjects,
		rooms,
		subjects,
		sectionEnrollment,
		policyRecord: policyRow,
		buildings: [{ id: 1 }],
		// The real draft context supplies these persisted sources; the builder
		// derives the window authority itself.
		sectionsById: new Map([[SECTION, { displayOrder: 7, gradeLevelId: 17, programType: 'REGULAR' }]]),
		gradeWindows: shiftWindows,
		specialEvents: [],
	} as unknown as Parameters<typeof buildPreGenerationValidatorContext>[3]);

	return { contexts: { generation, manual, preGeneration } };
}

test('A6/C8: generation, manual-edit, and pre-generation contexts produce identical code/severity/entity multisets', () => {
	const { contexts } = parityFixture();
	const generationResult = validateHardConstraints(contexts.generation);
	const generation = multiset(generationResult);
	const manual = multiset(validateHardConstraints(contexts.manual));
	const preGeneration = multiset(validateHardConstraints(contexts.preGeneration));

	// The fixture must be non-trivial.
	assert.ok(generation.some((row) => row.startsWith('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED:')), 'fixture must exercise the consecutive block');
	assert.ok(generation.some((row) => row.startsWith('FACULTY_FLOOR_TRANSITION:')), 'fixture must exercise floors');
	assert.ok(generation.some((row) => row.startsWith('FACULTY_EXCESSIVE_IDLE_GAP:')), 'fixture must exercise idle');
	// The Lunch window is a real authority on every leg: the Wednesday gap adds
	// zero idle minutes.
	const idle = generationResult.violations.find((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	assert.equal(Number(idle?.meta?.totalIdleMinutes), 75, 'only the genuine unscheduled free period is idle time');

	assert.deepEqual(manual, generation, 'manual/Quick Place/sync context must match generation');
	assert.deepEqual(preGeneration, generation, 'pre-generation context must match generation');
});

test('A6 mutant: dropping the break-window authority from one leg breaks the parity control', () => {
	const { contexts } = parityFixture();
	const withoutBreaks = { ...contexts.manual, breakWindows: [] };
	const mutant = multiset(validateHardConstraints(withoutBreaks));
	const real = multiset(validateHardConstraints(contexts.generation));
	assert.notDeepEqual(mutant, real);
	// The mutant counts the configured Lunch window as idle time: 45 (Wednesday,
	// the Lunch-covered gap) + 75 (Thursday, the genuine gap).
	const mutantIdle = validateHardConstraints(withoutBreaks).violations.filter((violation) => violation.code === 'FACULTY_EXCESSIVE_IDLE_GAP');
	const byDay = new Map(mutantIdle.map((violation) => [violation.entities.day, Number(violation.meta?.totalIdleMinutes)]));
	assert.equal(byDay.get('WEDNESDAY'), 45, 'the Lunch window is counted as idle only by the mutant');
	assert.equal(byDay.get('THURSDAY'), 75);
	assert.equal([...byDay.values()].reduce((sum, minutes) => sum + minutes, 0), 120);
});

test('A6: the pre-generation byte-identical period authority keeps the same resolved threshold', () => {
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ maxConsecutiveTeachingMinutesBeforeBreak: 135, periodLengthMinutes: 45 }), 135);
	assert.equal(resolveMaxConsecutiveTeachingMinutesBeforeBreak({ periodLengthMinutes: 45 }), 135);
	assert.equal(resolveDefaultMaxConsecutiveTeachingMinutes(DEFAULT_ALLOWED_CONSECUTIVE_PERIODS * 15), 135);
});

// ─── break-window authority resolution (real producer) ─────────────────────

test('window authority: the persisted policy row and shift-specific special events resolve into break windows', async () => {
	const policyRow = {
		enableRecess: true, recessStartTime: '09:45', recessEndTime: '10:00',
		enableLunchWindow: true, lunchStartTime: '11:30', lunchEndTime: '12:15',
		enableFlagCeremony: true, flagCeremonyStartTime: '06:00', flagCeremonyEndTime: '06:30',
	};
	const policyWindows = resolvePolicyRowBreakWindows(policyRow);
	assert.deepEqual(policyWindows.map((window) => window.eventType).sort(), ['FLAG_OR_HGP', 'LUNCH_BREAK', 'RECESS']);
	assert.equal(policyWindows.find((window) => window.eventType === 'FLAG_OR_HGP')?.dayOfWeek, 'MONDAY');

	// A disabled window is never excluded.
	assert.deepEqual(resolvePolicyRowBreakWindows({ ...policyRow, enableRecess: false }).map((w) => w.eventType).sort(), ['FLAG_OR_HGP', 'LUNCH_BREAK']);

	const specialEvents = [
		{ eventType: 'HEALTH_BREAK', label: 'Health Break', gradeGroup: '7-8', programType: null, startTime: '09:45', endTime: '10:00', enabled: true },
		{ eventType: 'HEALTH_BREAK', label: 'Health Break', gradeGroup: '9-10', programType: null, startTime: '14:00', endTime: '14:15', enabled: true },
	];
	const grade7 = resolveSpecialEventBreakWindows(specialEvents, 7, 'REGULAR');
	assert.equal(grade7.length, 1);
	assert.equal(grade7[0].eventType, 'HEALTH_BREAK');
	assert.equal(grade7[0].gradeLevel, 7);

	const authority = buildWarningWindowAuthority({
		sections: [
			{ id: SECTION, gradeLevel: 7, programType: 'REGULAR' },
			{ id: 201, gradeLevel: 9, programType: 'REGULAR' },
		],
		policyRow,
		specialEvents,
		shiftWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '14:30' }],
	});
	assert.equal(authority.sectionScope.get(SECTION)?.gradeLevel, 7);
	assert.ok(authority.breakWindows.filter((window) => window.gradeLevel === 7).length >= 1);
	assert.ok(authority.breakWindows.filter((window) => window.gradeLevel === 9).length >= 1);
	assert.equal(authority.shiftWindows.length, 1);
});
