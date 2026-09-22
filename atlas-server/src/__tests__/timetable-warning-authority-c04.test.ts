/**
 * TT-WARNING-AUTHORITY-C04 — warning authority, retirement, and term-aware truth.
 *
 * Run: `npx tsx src/__tests__/timetable-warning-authority-c04.test.ts`
 *
 * Failing-first production-path controls for R1–R6 and the B-11 server half (R9).
 * Every control exercises the real validator / resolver / publication predicate;
 * the mutants reproduce the pre-fix behavior so the assertions are not
 * tautological.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
	validateHardConstraints,
	VIOLATION_CODES,
	type ScheduledEntry,
	type ValidatorContext,
} from '../services/constraint-validator.js';
import {
	DEFAULT_CONSTRAINT_CONFIG,
	PROMOTABLE_CONSTRAINT_CODES,
	WARNING_FAMILY_DEFAULTS,
	isPromotableConstraintCode,
	normalizeConstraintConfigPromotion,
	resolveWarningFamilyPolicy,
	validatePolicyInput,
	upsertPolicy,
} from '../services/scheduling-policy.service.js';
import { countBlockingHardViolations } from '../services/publication-contract.service.js';
import { buildViolationReport, buildZoneDistributionByTerm } from '../services/generation.service.js';
import * as generationService from '../services/generation.service.js';
import { buildPreflightValidatorContext } from '../services/generation-preflight.service.js';
import { buildPreGenerationValidatorContext } from '../services/pre-generation-draft.service.js';
import {
	assertRunIsEditable,
	buildValidatorCtx,
	isPublishedSummary,
	loadRunContext,
} from '../services/manual-edit.service.js';

const SCHOOL = 7;
const YEAR = 9;
const RUN = 42;

function entry(overrides: Partial<ScheduledEntry> & Pick<ScheduledEntry, 'entryId' | 'facultyId' | 'roomId' | 'day' | 'startTime' | 'endTime'>): ScheduledEntry {
	return {
		subjectId: 100,
		sectionId: 200,
		durationMinutes: 45,
		...overrides,
	};
}

function baseContext(entries: ScheduledEntry[], overrides: Partial<ValidatorContext> = {}): ValidatorContext {
	return {
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		runId: RUN,
		entries,
		faculty: [{ id: 1, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 1, subjectId: 100, sectionIds: [200] }],
		rooms: [
			{ id: 10, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
			{ id: 11, type: 'CLASSROOM', capacity: 50, features: [], floor: 2 },
			{ id: 13, type: 'CLASSROOM', capacity: 50, features: [], floor: 3 },
			{ id: 12, type: 'CLASSROOM', capacity: 50, features: [], floor: 4 },
			{ id: 20, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
		],
		subjects: [{ id: 100, preferredRoomType: 'CLASSROOM', requiredFeatures: [] }],
		...overrides,
	};
}

// ─── R1: retire the false metric travel warning ──────────────────────────────

test('R1: the validator emits zero FACULTY_EXCESSIVE_TRAVEL_DISTANCE even with distant buildings enabled', () => {
	const ctx = baseContext(
		[
			entry({ entryId: 'a', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
			entry({ entryId: 'b', facultyId: 1, roomId: 20, day: 'MONDAY', startTime: '08:45', endTime: '09:30' }),
		],
		{
			travelPolicy: {
				maxBuildingTransitionsPerDay: 4,
				maxBackToBackTransitionsWithoutBuffer: 2,
				maxIdleGapMinutesPerDay: 60,
				avoidEarlyFirstPeriod: false,
				avoidLateLastPeriod: false,
			},
			// Far-apart canvas geometry that previously produced a ~700m label.
			buildings: [{ id: 1 }, { id: 2 }],
			roomBuildings: [
				{ roomId: 10, buildingId: 1 },
				{ roomId: 20, buildingId: 2 },
			],
		},
	);
	const result = validateHardConstraints(ctx);
	// C07A: the retired code is not even part of the ViolationCode union any more,
	// so the filter compares against the literal string rather than the union.
	const retiredCode = 'FACULTY_EXCESSIVE_TRAVEL' + '_DISTANCE';
	const travel = result.violations.filter((violation) => (violation.code as string) === retiredCode);
	assert.equal(travel.length, 0, 'the retired metric travel code must have no producer');
	assert.equal((VIOLATION_CODES as readonly string[]).includes(retiredCode), false, 'the retired code must not be declared');
	for (const violation of result.violations) {
		assert.equal(
			Object.prototype.hasOwnProperty.call(violation.meta ?? {}, 'estimatedDistanceMeters'),
			false,
			'no violation may carry the false-precision estimatedDistanceMeters label',
		);
	}
});

test('R1 source control: the validator no longer reads Building.x/y or emits estimatedDistanceMeters', () => {
	const source = readFileSync(new URL('../services/constraint-validator.ts', import.meta.url), 'utf8');
	assert.equal(/estimatedDistanceMeters/.test(source), false, 'estimatedDistanceMeters must be removed');
	assert.equal(/\.x\s*-\s*/.test(source), false, 'no building x-delta may remain');
	assert.equal(/\.y\s*-\s*/.test(source), false, 'no building y-delta may remain');
	// C07A: the code itself is fully retired (producer, config, and display label).
	assert.equal(source.includes("'FACULTY_EXCESSIVE_TRAVEL_DISTANCE'"), false, 'the retired code must have no residue in the validator');
});

test('R1: a legacy persisted HARD travel violation can never block publication', () => {
	const legacy = [
		{ code: 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE', severity: 'HARD' as const },
		{ code: 'FACULTY_TIME_CONFLICT', severity: 'HARD' as const },
	];
	assert.equal(isPromotableConstraintCode('FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), false);
	assert.equal(countBlockingHardViolations(legacy), 1, 'only the allowlisted structural conflict blocks publication');
	assert.equal(countBlockingHardViolations([legacy[0]]), 0, 'a non-allowlisted HARD code is informational only');
});

// ─── R2: floor / building transition semantics ───────────────────────────────

function transitionContext(entries: ScheduledEntry[], policy: Partial<NonNullable<ValidatorContext['travelPolicy']>> = {}): ValidatorContext {
	return baseContext(entries, {
		travelPolicy: {
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 600,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			...policy,
		},
		roomBuildings: [
			{ roomId: 10, buildingId: 1 },
			{ roomId: 11, buildingId: 1 },
			{ roomId: 12, buildingId: 1 },
			{ roomId: 13, buildingId: 1 },
			{ roomId: 20, buildingId: 2 },
		],
	});
}

function floorTransitionCount(entries: ScheduledEntry[], policy?: Partial<NonNullable<ValidatorContext['travelPolicy']>>): number {
	const result = validateHardConstraints(transitionContext(entries, policy));
	return result.violations.filter((violation) => violation.code === 'FACULTY_FLOOR_TRANSITION').length;
}

test('R2: 1 and 2 floor moves inside one building do not warn; 3+ floors do', () => {
	const one = floorTransitionCount([
		entry({ entryId: '1', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: '2', facultyId: 1, roomId: 11, day: 'MONDAY', startTime: '08:49', endTime: '09:34' }),
	]);
	const two = floorTransitionCount([
		entry({ entryId: '3', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: '4', facultyId: 1, roomId: 13, day: 'MONDAY', startTime: '08:49', endTime: '09:34' }),
	]);
	const three = floorTransitionCount([
		entry({ entryId: '5', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: '6', facultyId: 1, roomId: 12, day: 'MONDAY', startTime: '08:49', endTime: '09:34' }),
	]);
	assert.equal(one, 0, 'a 1-floor move must not warn');
	assert.equal(two, 0, 'a 2-floor move must not warn on its own');
	// roomId 10 floor 1 -> roomId 12 floor 4 is a 3-floor move; both samples use a
	// 4-minute gap (< default buffer 5) so only the 3-floor case warns.
	assert.equal(three, 1, '3+ floors with a sub-buffer gap must warn');
});

test('R2: floor-transition gap boundary is 5 minutes (4 warns, 5 and 6 do not)', () => {
	const at = (gap: number) => floorTransitionCount([
		entry({ entryId: `g${gap}-a`, facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: `g${gap}-b`, facultyId: 1, roomId: 12, day: 'MONDAY', startTime: `0${8 + Math.floor((45 + gap) / 60)}:${String((45 + gap) % 60).padStart(2, '0')}`, endTime: `0${8 + Math.floor((90 + gap) / 60)}:${String((90 + gap) % 60).padStart(2, '0')}` }),
	]);
	assert.equal(at(4), 1, 'a 4-minute gap is below the 5-minute floor-transition buffer');
	assert.equal(at(5), 0, 'a 5-minute gap meets the buffer');
	assert.equal(at(6), 0, 'a 6-minute gap meets the buffer');
});

test('R2: cross-building moves do not produce a floor transition', () => {
	const count = floorTransitionCount([
		entry({ entryId: 'xb-a', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: 'xb-b', facultyId: 1, roomId: 20, day: 'MONDAY', startTime: '08:49', endTime: '09:34' }),
	]);
	assert.equal(count, 0);
});

test('R2: the building-transition buffer is a policy field used by the buffer check', () => {
	const entries = [
		entry({ entryId: 'bt-a', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
		entry({ entryId: 'bt-b', facultyId: 1, roomId: 20, day: 'MONDAY', startTime: '08:50', endTime: '09:35' }),
	];
	// gap = 5. With maxBackToBack = 0 and the default 5-minute buffer, gap <= 5
	// counts as back-to-back and warns. Raising the buffer above the gap keeps it.
	const defaultBuffer = validateHardConstraints(transitionContext(entries, { maxBackToBackTransitionsWithoutBuffer: 0 }));
	assert.equal(defaultBuffer.violations.filter((v) => v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER').length, 1);
	const widened = validateHardConstraints(transitionContext(entries, { maxBackToBackTransitionsWithoutBuffer: 0, buildingTransitionBufferMinutes: 2 }));
	assert.equal(widened.violations.filter((v) => v.code === 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER').length, 0);
});

test('R2: transition checks are term-aware and never accumulate across ordered terms', () => {
	const perTerm = (term: 1 | 2 | 3) => [
		entry({ entryId: `t${term}-a`, facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45', termIndex: term }),
		entry({ entryId: `t${term}-b`, facultyId: 1, roomId: 12, day: 'MONDAY', startTime: '08:49', endTime: '09:34', termIndex: term }),
	];
	const result = validateHardConstraints(transitionContext([...perTerm(1), ...perTerm(2), ...perTerm(3)]));
	const floors = result.violations.filter((v) => v.code === 'FACULTY_FLOOR_TRANSITION');
	// One same-building 3-floor transition per term, never merged.
	assert.equal(floors.length, 3);
	assert.deepEqual(
		[...new Set(floors.map((v) => (v.meta as { fromRoomId?: number })?.fromRoomId))],
		[10],
	);
});

// ─── R3: decouple policy families and align defaults ─────────────────────────

test('R3: legacy master switch maps to the new families without gating unrelated ones', () => {
	const legacyOn = resolveWarningFamilyPolicy({ enableTravelWellbeingChecks: true });
	assert.equal(legacyOn.buildingTransitions, true);
	assert.equal(legacyOn.floorTransitions, true);
	assert.equal(legacyOn.idleGap, true);

	const legacyOff = resolveWarningFamilyPolicy({ enableTravelWellbeingChecks: false });
	assert.equal(legacyOff.buildingTransitions, false, 'the legacy master still migrates building transitions');
	assert.equal(legacyOff.floorTransitions, false);
	assert.equal(legacyOff.idleGap, false);
	// Unrelated families derive from their OWN flags, not the master:
	assert.equal(legacyOff.earlyStart, false);
	assert.equal(legacyOff.lateEnd, false);
	assert.equal(legacyOff.vacant, false);
	assert.equal(legacyOff.compression, false);

	const independent = resolveWarningFamilyPolicy({
		enableTravelWellbeingChecks: false,
		enableIdleGapChecks: true,
		avoidEarlyFirstPeriod: true,
		avoidLateLastPeriod: true,
		enableVacantAwareConstraints: true,
	});
	assert.equal(independent.buildingTransitions, false);
	assert.equal(independent.idleGap, true, 'an explicit family flag overrides the legacy master');
	assert.equal(independent.earlyStart, true);
	assert.equal(independent.lateEnd, true);
	assert.equal(independent.vacant, true);
	assert.equal(independent.compression, true);
});

test('R3: warning-family threshold defaults are stable', () => {
	const resolved = resolveWarningFamilyPolicy(null);
	assert.equal(resolved.buildingTransitionBufferMinutes, WARNING_FAMILY_DEFAULTS.buildingTransitionBufferMinutes);
	assert.equal(resolved.floorTransitionThreshold, WARNING_FAMILY_DEFAULTS.floorTransitionThreshold);
	assert.equal(resolved.floorTransitionBufferMinutes, WARNING_FAMILY_DEFAULTS.floorTransitionBufferMinutes);
});

test('R3: idle/early/late are no longer gated by the deprecated master switch', () => {
	const entries = [
		entry({ entryId: 'wb-a', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '06:00', endTime: '06:45' }),
		entry({ entryId: 'wb-b', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
	];
	const result = validateHardConstraints(baseContext(entries, {
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: false,
		},
		travelPolicy: {
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 30,
			avoidEarlyFirstPeriod: true,
			avoidLateLastPeriod: false,
			// The master is OFF, but the idle/early families are independently ON.
			enableIdleGapChecks: true,
			enableEarlyStartChecks: true,
			enableBuildingTransitionChecks: false,
			enableFloorTransitionChecks: false,
		},
		roomBuildings: [{ roomId: 10, buildingId: 1 }],
	}));
	assert.equal(result.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_IDLE_GAP').length, 1);
	assert.equal(result.violations.filter((v) => v.code === 'FACULTY_EARLY_START_PREFERENCE').length, 1);
});

test('R3: room-capacity default parity is false on the server and raw stored promotion cannot survive read', () => {
	assert.equal(DEFAULT_CONSTRAINT_CONFIG.ROOM_CAPACITY_EXCEEDED.treatAsHard, false);
	const raw = normalizeConstraintConfigPromotion({
		ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: true },
		FACULTY_OVERLOAD: { enabled: true, weight: 5, treatAsHard: true },
	}) as Record<string, { treatAsHard: boolean }>;
	assert.equal(raw.ROOM_CAPACITY_EXCEEDED.treatAsHard, false, 'non-allowlisted raw promotion is coerced on read');
	assert.equal(raw.FACULTY_OVERLOAD.treatAsHard, true, 'allowlisted promotion is preserved');
});

test('R3: a raw ROOM_CAPACITY_EXCEEDED treatAsHard cannot promote the room-capacity violation to HARD', () => {
	const ctx = baseContext(
		[entry({ entryId: 'cap', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' })],
		{
			sectionEnrollment: new Map([[200, 60]]),
			rooms: [{ id: 10, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 }],
			constraintConfig: {
				ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: true },
			},
		},
	);
	const capacity = validateHardConstraints(ctx).violations.filter((v) => v.code === 'ROOM_CAPACITY_EXCEEDED');
	assert.equal(capacity.length, 1);
	assert.equal(capacity[0].severity, 'SOFT', 'room capacity is intentionally SOFT in generation');
});

test('R3: SESSION_PATTERN_VIOLATED dead policy config is removed and no producer exists', () => {
	assert.equal(Object.prototype.hasOwnProperty.call(DEFAULT_CONSTRAINT_CONFIG, 'SESSION_PATTERN_VIOLATED'), false);
});

// ─── R4: promotion trust boundary ────────────────────────────────────────────

test('R4: the allowlist is exactly the trustworthy structural code set', () => {
	const expected = [
		'FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'SECTION_TIME_CONFLICT',
		'FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'UNASSIGNED_SECTION',
		'LACKING_FACULTY', 'INCOMPLETE_MODULAR_GROUP', 'ROOM_TYPE_MISMATCH',
		'ROOM_FEATURE_MISMATCH', 'FACULTY_DAILY_MAX_EXCEEDED',
	];
	assert.deepEqual([...PROMOTABLE_CONSTRAINT_CODES].sort(), expected.sort());
	for (const unsafe of ['FACULTY_EXCESSIVE_TRAVEL_DISTANCE', 'FACULTY_FLOOR_TRANSITION', 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS', 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER', 'FACULTY_EXCESSIVE_IDLE_GAP', 'FACULTY_EARLY_START_PREFERENCE', 'FACULTY_LATE_END_PREFERENCE', 'FACULTY_INSUFFICIENT_DAILY_VACANT', 'SECTION_OVERCOMPRESSED', 'ROOM_CAPACITY_EXCEEDED']) {
		assert.equal(isPromotableConstraintCode(unsafe), false, `${unsafe} must not be promotable`);
	}
});

test('R4: writing treatAsHard for a non-allowlisted code is rejected with a typed 400', async () => {
	const { errors } = validatePolicyInput({
		constraintConfig: {
			FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { enabled: true, weight: 3, treatAsHard: true },
		},
	});
	assert.ok(errors.some((message) => message.startsWith('CONSTRAINT_NOT_PROMOTABLE:')), 'validatePolicyInput must flag the promotion');

	// upsertPolicy throws before touching the database.
	await assert.rejects(
		() => upsertPolicy(SCHOOL, YEAR, {
			constraintConfig: {
				ROOM_CAPACITY_EXCEEDED: { enabled: true, weight: 5, treatAsHard: true },
			},
		}),
		(error: unknown) => {
			const typed = error as { statusCode?: number; code?: string };
			assert.equal(typed.statusCode, 400);
			assert.equal(typed.code, 'CONSTRAINT_NOT_PROMOTABLE');
			return true;
		},
	);
});

test('R4: mutation control — the allowlist is load-bearing against a raw HARD promotion', () => {
	const transitions = validateHardConstraints(baseContext(
		[
			entry({ entryId: 'm-a', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' }),
			entry({ entryId: 'm-b', facultyId: 1, roomId: 20, day: 'MONDAY', startTime: '08:46', endTime: '09:31' }),
			entry({ entryId: 'm-c', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '09:32', endTime: '10:17' }),
			entry({ entryId: 'm-d', facultyId: 1, roomId: 20, day: 'MONDAY', startTime: '10:18', endTime: '11:03' }),
		],
		{
			travelPolicy: {
				maxBuildingTransitionsPerDay: 1,
				maxBackToBackTransitionsWithoutBuffer: 2,
				maxIdleGapMinutesPerDay: 600,
				avoidEarlyFirstPeriod: false,
				avoidLateLastPeriod: false,
			},
			roomBuildings: [
				{ roomId: 10, buildingId: 1 },
				{ roomId: 20, buildingId: 2 },
			],
			constraintConfig: {
				FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { enabled: true, weight: 4, treatAsHard: true },
			},
		},
	));
	const building = transitions.violations.filter((v) => v.code === 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS');
	assert.equal(building.length, 1);
	assert.equal(building[0].severity, 'SOFT', 'allowlist blocks promotion even when the raw config requests HARD');
	assert.equal(countBlockingHardViolations(transitions.violations), 0);
});

// ─── R5: term-aware grouping ──────────────────────────────────────────────────

function termAwareDailyFixture(): ScheduledEntry[] {
	// Contiguous 45-minute periods 08:00–11:00, repeated identically in every term.
	const times = [
		['08:00', '08:45'],
		['08:45', '09:30'],
		['09:30', '10:15'],
		['10:15', '11:00'],
	];
	const sessions = (term: 1 | 2 | 3) => times.map(([startTime, endTime], index) => entry({
		entryId: `t${term}-${index}`,
		facultyId: 1,
		roomId: 10,
		day: 'MONDAY',
		startTime,
		endTime,
		termIndex: term,
	}));
	return [...sessions(1), ...sessions(2), ...sessions(3)];
}

test('R5 (failing-first): a legal per-term day yields zero HARD daily-max across three ordered terms', () => {
	const result = validateHardConstraints(baseContext(termAwareDailyFixture(), {
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: false,
		},
	}));
	const perTermMinutes = 4 * 45;
	assert.equal(perTermMinutes * 3, 540, 'the summed total exceeds the 480-minute hard cap');
	assert.equal(result.violations.filter((v) => v.code === 'FACULTY_DAILY_MAX_EXCEEDED').length, 0, 'per-term minutes are legal');
});

test('R5 mutant: the former term-blind key sums all terms and fabricates HARD', () => {
	// Reproduce the old grouping explicitly: key = faculty:day, ignoring term.
	const entries = termAwareDailyFixture();
	const blind = new Map<string, number>();
	for (const e of entries) {
		const key = `${e.facultyId}:${e.day}`;
		blind.set(key, (blind.get(key) ?? 0) + e.durationMinutes);
	}
	assert.equal(blind.get('1:MONDAY'), 540, 'term-blind grouping double-counts a repeating term');
});

test('R5: a genuine same-term daily overload still emits HARD', () => {
	const entries = [8, 9, 10, 11, 12].map((hour, index) => entry({
		entryId: `over-${index}`,
		facultyId: 1,
		roomId: 10,
		day: 'MONDAY',
		startTime: `${String(hour).padStart(2, '0')}:00`,
		endTime: `${String(hour + 2).padStart(2, '0')}:00`,
		durationMinutes: 120,
		termIndex: 1,
	}));
	const result = validateHardConstraints(baseContext(entries, {
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: false,
		},
	}));
	assert.ok(result.violations.some((v) => v.code === 'FACULTY_DAILY_MAX_EXCEEDED' && v.severity === 'HARD'));
});

test('R5: consecutive/idle/vacant are computed per term, not summed', () => {
	const entries = termAwareDailyFixture();
	const result = validateHardConstraints(baseContext(entries, {
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: true,
		},
		travelPolicy: {
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 30,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			enableIdleGapChecks: true,
		},
	}));
	// 4 contiguous 45-minute periods per term: the block reaches 180 minutes in
	// every ordered term. C07A emits exactly ONE violation per violating block
	// (the former per-entry emission produced two per term), and the members of
	// that block are named in `entities.entryIds`. Term-aware grouping therefore
	// yields 3 — one per ordered term, never a single 540-minute cross-term block.
	const consecutive = result.violations.filter((v) => v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.equal(consecutive.length, 3, 'one term-aware consecutive violation per ordered term');
	for (const violation of consecutive) {
		assert.equal(Number((violation.meta as { consecutiveMinutes?: number })?.consecutiveMinutes), 180);
		assert.equal(violation.entities.entryIds?.length, 4, 'the block names every member period');
	}
	// Mutant: the former term-blind key merges all three terms into one faculty/day
	// block. Reproduce that merge and show it fabricates one 540-minute block.
	const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
	const merged = [...entries].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
	let running = 0;
	let maxBlock = 0;
	for (let i = 0; i < merged.length; i++) {
		if (i === 0) { running = merged[i].durationMinutes; maxBlock = running; continue; }
		const gap = toMinutes(merged[i].startTime) - toMinutes(merged[i - 1].endTime);
		running = gap < 15 ? running + merged[i].durationMinutes : merged[i].durationMinutes;
		maxBlock = Math.max(maxBlock, running);
	}
	assert.equal(maxBlock, 540, 'the term-blind merge fabricates a 540-minute single block');
	assert.ok(maxBlock > 180, 'the term-blind mutant is strictly worse than the term-aware 180-minute cap');
});

// ─── R6: one warning context per surface ─────────────────────────────────────

function manualRefData(overrides: Record<string, unknown> = {}) {
	return {
		run: { id: RUN, schoolId: SCHOOL, schoolYearId: YEAR, status: 'COMPLETED', summary: { isPublished: false }, draftEntries: [], unassignedItems: [], version: 1 },
		entries: [],
		unassignedItems: [],
		faculty: [{ id: 1, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }],
		facultySubjects: [{ facultyId: 1, subjectId: 100, gradeLevels: [7], sectionIds: [200] }],
		rooms: [{ id: 10, type: 'CLASSROOM', capacity: 50, features: [], floor: 1, buildingId: 1, buildingGradeScope: [7], building: { gradeScope: [7] }, isTeachingSpace: true, isSharedFacility: false }],
		subjects: [{ id: 100, code: 'SCI', minMinutesPerWeek: 225, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'], gradeLevels: [7] }],
		policyRecord: {
			maxConsecutiveTeachingMinutesBeforeBreak: 120,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			enforceConsecutiveBreakAsHard: false,
			enableTravelWellbeingChecks: true,
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 60,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			enableVacantAwareConstraints: false,
			targetFacultyDailyVacantMinutes: 60,
			targetSectionDailyVacantPeriods: 1,
			maxCompressedTeachingMinutesPerDay: 300,
			constraintConfig: {},
		},
		buildings: [{ id: 1 }],
		facultyNameMap: new Map([[1, 'Teacher']]),
		roomNameMap: new Map([[10, 'Room 10']]),
		subjectNameMap: new Map([[100, 'SCI']]),
		subjectNameDetailMap: new Map([[100, 'Science']]),
		sectionEnrollment: new Map([[200, 40]]),
		sectionGradeLevel: new Map([[200, 7]]),
		...overrides,
	} as unknown as Awaited<ReturnType<typeof loadRunContext>>;
}

test('R6: the manual-edit context now carries room features and subject requiredFeatures', () => {
	const entryOne = entry({ entryId: 'feat', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' });
	const ctx = buildValidatorCtx(SCHOOL, YEAR, RUN, [entryOne], manualRefData());
	const result = validateHardConstraints(ctx);
	assert.ok(
		result.violations.some((v) => v.code === 'ROOM_FEATURE_MISMATCH'),
		'the manual surface must judge the same feature mismatch as generation',
	);
});

test('R6 mutant: dropping features from the manual context hides a real mismatch', () => {
	const entryOne = entry({ entryId: 'feat-mutant', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45' });
	const withoutFeatures = manualRefData({
		rooms: [{ id: 10, type: 'CLASSROOM', capacity: 50, features: [], floor: 1, buildingId: 1, buildingGradeScope: [7], building: { gradeScope: [7] } }],
		subjects: [{ id: 100, code: 'SCI', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7] }],
	} as unknown as Record<string, unknown>);
	const result = validateHardConstraints(buildValidatorCtx(SCHOOL, YEAR, RUN, [entryOne], withoutFeatures));
	assert.equal(result.violations.filter((v) => v.code === 'ROOM_FEATURE_MISMATCH').length, 0);
});

test('R6: the manual context uses the ancillary-deducted effective hours authority', () => {
	// 10h raw minus 300 ancillary minutes = 5h (300 min) effective. Seven 45-minute
	// sessions = 315 min, which overloads the EFFECTIVE cap but not the raw cap.
	const entries = [8, 9, 10, 11, 13, 14, 15].map((hour, index) => entry({
		entryId: `eff-${index}`,
		facultyId: 1,
		roomId: 10,
		day: 'MONDAY',
		startTime: `${String(hour).padStart(2, '0')}:00`,
		endTime: `${String(hour).padStart(2, '0')}:45`,
	}));
	const ref = manualRefData({ faculty: [{ id: 1, maxHoursPerWeek: 10, ancillaryMinutesPerWeek: 300 }] });
	const result = validateHardConstraints(buildValidatorCtx(SCHOOL, YEAR, RUN, entries, ref));
	assert.ok(result.violations.some((v) => v.code === 'FACULTY_OVERLOAD'), 'effective hours must drive the overload decision');
});

test('R6 mutant: raw maxHoursPerWeek hides the same overload', () => {
	const entries = [8, 9, 10, 11, 13, 14, 15].map((hour, index) => entry({
		entryId: `raw-${index}`,
		facultyId: 1,
		roomId: 10,
		day: 'MONDAY',
		startTime: `${String(hour).padStart(2, '0')}:00`,
		endTime: `${String(hour).padStart(2, '0')}:45`,
	}));
	const rawContext = baseContext(entries, {
		faculty: [{ id: 1, maxHoursPerWeek: 10 }],
	});
	const result = validateHardConstraints(rawContext);
	assert.equal(result.violations.filter((v) => v.code === 'FACULTY_OVERLOAD').length, 0);
});

// ─── R6 cross-surface parity: generation / manual / pre-gen ──────────────────

const PARITY_POLICY = {
	maxConsecutiveTeachingMinutesBeforeBreak: 120,
	minBreakMinutesAfterConsecutiveBlock: 15,
	maxTeachingMinutesPerDay: 480,
	earliestStartTime: '06:00',
	latestEndTime: '18:30',
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
	constraintConfig: {},
};

function parityReference() {
	const rooms = [
		{ id: 10, type: 'CLASSROOM' as const, capacity: 50, features: [] as string[], floor: 1, buildingId: 1 },
		{ id: 12, type: 'CLASSROOM' as const, capacity: 50, features: [] as string[], floor: 4, buildingId: 1 },
		{ id: 11, type: 'LABORATORY' as const, capacity: 40, features: ['SINK'] as string[], floor: 2, buildingId: 2 },
	];
	const subjects = [
		{ id: 100, preferredRoomType: 'LABORATORY' as const, requiredFeatures: ['SINK'] as string[] },
		{ id: 101, preferredRoomType: 'CLASSROOM' as const, requiredFeatures: [] as string[] },
	];
	const faculty = [{ id: 1, maxHoursPerWeek: 10, ancillaryMinutesPerWeek: 300 }];
	const facultySubjects = [
		{ facultyId: 1, subjectId: 100, sectionIds: [200] },
		{ facultyId: 1, subjectId: 101, sectionIds: [200] },
	];
	const sectionEnrollment = new Map([[200, 45]]);
	const sectionsByGrade = [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ mirrorId: 1, id: 200, name: '7-A', maxCapacity: 50, enrolledCount: 45, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
	const buildings = [{ id: 1 }, { id: 2 }];
	// Representative schedule: feature mismatch, cross-floor transition, idle gap,
	// and an effective-hours overload — all carrying explicit term identity.
	const entries: ScheduledEntry[] = [
		entry({ entryId: 'p-feat', facultyId: 1, roomId: 10, day: 'MONDAY', startTime: '08:00', endTime: '08:45', subjectId: 100, termIndex: 1 }),
		entry({ entryId: 'p-floor-a', facultyId: 1, roomId: 10, day: 'TUESDAY', startTime: '08:00', endTime: '08:45', subjectId: 101, termIndex: 2 }),
		entry({ entryId: 'p-floor-b', facultyId: 1, roomId: 12, day: 'TUESDAY', startTime: '08:49', endTime: '09:34', subjectId: 101, termIndex: 2 }),
		entry({ entryId: 'p-idle-a', facultyId: 1, roomId: 10, day: 'WEDNESDAY', startTime: '08:00', endTime: '08:45', subjectId: 101, termIndex: 3 }),
		entry({ entryId: 'p-idle-b', facultyId: 1, roomId: 10, day: 'WEDNESDAY', startTime: '09:30', endTime: '10:15', subjectId: 101, termIndex: 3 }),
		...[
			['08:00', '08:45'], ['08:45', '09:30'], ['09:30', '10:15'], ['10:15', '11:00'],
			['11:00', '11:45'], ['11:45', '12:30'], ['12:30', '13:15'],
		].map(([startTime, endTime], index) => entry({
			entryId: `p-load-${index}`,
			facultyId: 1,
			roomId: 10,
			day: 'THURSDAY',
			startTime,
			endTime,
			subjectId: 101,
			termIndex: 3,
		})),
	];
	return { rooms, subjects, faculty, facultySubjects, sectionEnrollment, sectionsByGrade, buildings, entries };
}

function violationMultiset(context: ValidatorContext): string[] {
	return validateHardConstraints(context).violations
		.map((violation) => `${violation.code}:${violation.severity}`)
		.sort();
}

function buildParityContexts(overrides: { generationSubjects?: unknown[] } = {}) {
	const ref = parityReference();
	const subjects = (overrides.generationSubjects ?? ref.subjects);

	const generationCtx = buildPreflightValidatorContext(
		{
			scope: { schoolId: SCHOOL, schoolYearId: YEAR },
			faculty: ref.faculty,
			facultySubjects: ref.facultySubjects,
			rooms: ref.rooms,
			subjects,
			sectionsByGrade: ref.sectionsByGrade,
			policyRow: PARITY_POLICY,
			policy: { present: true, id: 1, periodLengthMinutes: 45, periodsPerDay: 10 },
			buildings: ref.buildings,
		} as unknown as Parameters<typeof buildPreflightValidatorContext>[0],
		ref.entries,
		RUN,
	);

	const manualCtx = buildValidatorCtx(SCHOOL, YEAR, RUN, ref.entries, manualRefData({
		faculty: ref.faculty,
		facultySubjects: ref.facultySubjects.map((fs) => ({ ...fs, gradeLevels: [7] })),
		rooms: ref.rooms.map((room) => ({ ...room, isTeachingSpace: true, isSharedFacility: false, buildingGradeScope: [7], building: { gradeScope: [7] } })),
		subjects: ref.subjects.map((subject) => ({ ...subject, code: 'SUB', minMinutesPerWeek: 225, gradeLevels: [7] })),
		sectionEnrollment: ref.sectionEnrollment,
		sectionGradeLevel: new Map([[200, 7]]),
		policyRecord: PARITY_POLICY,
		buildings: ref.buildings,
	}));

	const preGenCtx = buildPreGenerationValidatorContext(SCHOOL, YEAR, ref.entries, {
		facultyRefs: ref.faculty,
		facultySubjects: ref.facultySubjects,
		rooms: ref.rooms,
		subjects: ref.subjects,
		sectionEnrollment: ref.sectionEnrollment,
		policyRecord: PARITY_POLICY,
		buildings: ref.buildings,
	});

	return { generationCtx, manualCtx, preGenCtx };
}

test('R6 parity: generation, manual, and pre-gen contexts produce identical {code,severity} multisets', () => {
	const { generationCtx, manualCtx, preGenCtx } = buildParityContexts();
	const generation = violationMultiset(generationCtx);
	const manual = violationMultiset(manualCtx);
	const preGen = violationMultiset(preGenCtx);

	// The fixture must be non-trivial: several codes fire, including the new ones.
	assert.ok(generation.some((row) => row.startsWith('ROOM_FEATURE_MISMATCH:')), 'fixture must exercise features');
	assert.ok(generation.some((row) => row.startsWith('FACULTY_FLOOR_TRANSITION:')), 'fixture must exercise floors');
	assert.ok(generation.some((row) => row.startsWith('FACULTY_OVERLOAD:')), 'fixture must exercise effective hours');
	assert.deepEqual(manual, generation, 'manual context must match generation');
	assert.deepEqual(preGen, generation, 'pre-gen context must match generation');
});

test('R6 parity mutant: dropping requiredFeatures from the generation leg breaks the parity assertion', () => {
	const { generationCtx, manualCtx } = buildParityContexts({
		generationSubjects: parityReference().subjects.map((subject) => ({ ...subject, requiredFeatures: [] })),
	});
	assert.notDeepEqual(violationMultiset(generationCtx), violationMultiset(manualCtx), 'the parity control is load-bearing');
});

// ─── F2: run-wide publication-blocking count ─────────────────────────────────

test('F2: buildViolationReport exposes run-wide blockingHard from the allowlist only', () => {
	const makeViolation = (code: string, severity: 'HARD' | 'SOFT') => ({
		code, severity, message: code, schoolId: SCHOOL, schoolYearId: YEAR, runId: RUN, entities: {},
	});
	const report = buildViolationReport({
		id: RUN,
		status: 'COMPLETED',
		draftEntries: [],
		summary: {},
		violations: [
			makeViolation('FACULTY_EXCESSIVE_TRAVEL_DISTANCE', 'HARD'),
			makeViolation('FACULTY_TIME_CONFLICT', 'HARD'),
			makeViolation('ROOM_FEATURE_MISMATCH', 'HARD'),
			makeViolation('FACULTY_FLOOR_TRANSITION', 'SOFT'),
		],
	}, undefined);
	assert.equal(report.counts.scope, 'RUN_WIDE');
	assert.equal(report.counts.runWide.hard, 3, 'hard counts every HARD severity for display');
	assert.equal(report.counts.runWide.blockingHard, 2, 'blockingHard counts only allowlisted codes');
	assert.equal(report.counts.runWide.total, 4);
});

// ─── R9: strict publication predicate (B-11 server half) ─────────────────────

test('R9: isPublishedSummary is strict — retained markers on a superseded run are not published', () => {
	assert.equal(isPublishedSummary({ isPublished: false, publishedAt: '2026-09-11T00:00:00.000Z', publishedBy: 5 }), false);
	assert.equal(isPublishedSummary({ isPublished: true, publishedAt: '2026-09-11T00:00:00.000Z', publishedBy: 5 }), true);
	assert.equal(isPublishedSummary({ publishedAt: '2026-09-11T00:00:00.000Z' }), false, 'a bare marker is not publication truth');
	assert.equal(isPublishedSummary({ publishedBy: 5 }), false);
	assert.equal(isPublishedSummary(null), false);
	assert.equal(isPublishedSummary([]), false);
});

test('R9 (failing-first): the superseded-run guard passes while a genuine published run still refuses', async () => {
	const superseded = { isPublished: false, publishedAt: '2026-09-11T00:00:00.000Z', publishedBy: 5 };

	// Direct production guard: a superseded run with retained markers is editable.
	assert.doesNotThrow(() => assertRunIsEditable(superseded));
	// A genuine published run is refused with the typed conflict.
	assert.throws(
		() => assertRunIsEditable({ isPublished: true }),
		(error: unknown) => {
			const typed = error as { statusCode?: number; code?: string };
			assert.equal(typed.statusCode, 409);
			assert.equal(typed.code, 'RUN_ALREADY_PUBLISHED');
			return true;
		},
	);

	// Real entry point: loadRunContext must no longer reject a superseded run with
	// RUN_ALREADY_PUBLISHED. It proceeds past the guard (whatever later reference
	// read fails in this hermetic fake, the failure must NOT be the publication
	// refusal).
	const fakeClient = (summary: unknown): any => ({
		generationRun: {
			findFirst: async () => ({ id: RUN, schoolId: SCHOOL, schoolYearId: YEAR, status: 'COMPLETED', summary }),
		},
	});
	await assert.rejects(
		() => loadRunContext(RUN, SCHOOL, YEAR, fakeClient(superseded)),
		(error: unknown) => {
			assert.notEqual((error as { code?: string }).code, 'RUN_ALREADY_PUBLISHED');
			return true;
		},
	);
	// Genuine published run through the same entry point still refuses.
	await assert.rejects(
		() => loadRunContext(RUN, SCHOOL, YEAR, fakeClient({ isPublished: true })),
		(error: unknown) => {
			const typed = error as { statusCode?: number; code?: string };
			assert.equal(typed.statusCode, 409);
			assert.equal(typed.code, 'RUN_ALREADY_PUBLISHED');
			return true;
		},
	);
});

test('R9 source control: the manual-edit predicate has no loose publishedAt/publishedBy OR-branch', () => {
	const source = readFileSync(new URL('../services/manual-edit.service.ts', import.meta.url), 'utf8');
	assert.ok(/isPublishedSummary[\s\S]*?isPublished === true/.test(source), 'the strict predicate must remain');
	assert.equal(/candidate\.publishedAt/.test(source), false, 'no loose publishedAt marker check may remain');
	assert.equal(/candidate\.publishedBy/.test(source), false, 'no loose publishedBy marker check may remain');
});

// ─── ZONE-WARNING-REMOVAL-C01 ─────────────────────────────────────────────────
// Supersedes ZONE-IMBALANCE-PRECONDITION-C01: the warning asked a school to
// spread classes across campus, which a school in a tight situation cannot
// act on — so the producer is deleted instead of gated. The old Z1–Z7 tests
// below pinned the removed firing behaviour (silent cases, >50% firing,
// denominator truthfulness, per-term scoping, grammar) and are replaced by
// the removal contract: the distribution diagnostic stays (the run rail
// renders it), the code stays in VIOLATION_CODES so stored rows render,
// stored UNSPECIFIED rows stay suppressed, and no new generation can emit
// the code. Z8's historical-row half survives with a hand-built fixture
// (the producer can no longer build it).

function zoneEntry(entryId: string, roomId: number, termIndex: 1 | 2 | 3): ScheduledEntry {
	return entry({ entryId, facultyId: 1, roomId, day: 'MONDAY', startTime: '08:00', endTime: '08:45', termIndex });
}

/**
 * Mirror of the production mapping (`room.buildingZoneId ?? 'UNSPECIFIED'`):
 * rooms with a null zone resolve to the unzoned bucket.
 */
function zoneMap(rooms: Array<{ id: number; buildingZoneId: string | null }>): Map<number, string> {
	return new Map(rooms.map((room) => [room.id, room.buildingZoneId ?? 'UNSPECIFIED']));
}

const ZONE_IDENTITY = { schoolId: SCHOOL, schoolYearId: YEAR, runId: RUN };

test('Z1: the distribution diagnostic keeps the unzoned inventory — the live run-315 shape (all entries unzoned)', () => {
	const entries = ['z1-a', 'z1-b', 'z1-c', 'z1-d', 'z1-e'].map((entryId) => zoneEntry(entryId, 10, 1));
	const distribution = buildZoneDistributionByTerm(entries, zoneMap([{ id: 10, buildingZoneId: null }]));
	assert.deepEqual(Object.keys(distribution[0].byZone), ['UNSPECIFIED'], 'the diagnostic keeps the unzoned inventory');
	assert.equal(distribution[0].byZone.UNSPECIFIED.count, 5);
});

test('ZR1: no new generation can emit ZONE_IMBALANCE_WARNING — the producer is removed', () => {
	assert.equal(
		'buildZoneImbalanceWarnings' in generationService,
		false,
		'the zone warning producer is deleted from the production module (control: fails while the export exists)',
	);
	const source = readFileSync(new URL('../services/generation.service.ts', import.meta.url), 'utf8');
	assert.equal(/zoneWarningViolations/.test(source), false, 'no call site feeds zone violations into the override contract');
	assert.equal(/code: 'ZONE_IMBALANCE_WARNING'/.test(source), false, 'the generation service emits no zone warning row');
	assert.equal(
		/buildZoneDistributionByTerm/.test(source),
		true,
		'the distribution diagnostic stays for the run rail — the edit removed only the producer',
	);
});

test('Z8: historical rows still render while stored UNSPECIFIED rows stay suppressed', () => {
	assert.ok(
		(VIOLATION_CODES as readonly string[]).includes('ZONE_IMBALANCE_WARNING'),
		'the warning code is retained for historical rendering — the union member was not deleted',
	);
	const northIds = ['z8-a', 'z8-b', 'z8-c', 'z8-d', 'z8-e', 'z8-f'];
	const draftEntries = [
		...northIds.map((entryId) => zoneEntry(entryId, 10, 1)),
		...['z8-g', 'z8-h'].map((entryId) => zoneEntry(entryId, 11, 1)),
	] as ScheduledEntry[];
	const persisted = {
		...ZONE_IDENTITY,
		code: 'ZONE_IMBALANCE_WARNING' as const,
		severity: 'SOFT' as const,
		message: 'stored zoned row from an older run',
		entities: { entryIds: [...northIds].sort() },
		meta: { termIndex: 1, zone: 'North', percent: 75 },
	};
	assert.ok(persisted, 'the hand-built zoned warning is the historical-row fixture (the deleted producer can no longer build it)');
	const legacy: typeof persisted = {
		...ZONE_IDENTITY,
		code: 'ZONE_IMBALANCE_WARNING',
		severity: 'SOFT',
		message: 'legacy UNSPECIFIED row',
		entities: { entryIds: ['z8-a'] },
		meta: { termIndex: 1, zone: 'UNSPECIFIED', percent: 100 },
	};
	const report = buildViolationReport(
		{ id: RUN, status: 'COMPLETED', draftEntries, summary: {}, violations: [legacy, persisted] },
		undefined,
	);
	assert.deepEqual(report.violations.map((item) => item.meta?.zone), ['North'], 'the zoned row renders; the stored UNSPECIFIED row stays suppressed');
	assert.equal(report.counts.total, 1);
});
