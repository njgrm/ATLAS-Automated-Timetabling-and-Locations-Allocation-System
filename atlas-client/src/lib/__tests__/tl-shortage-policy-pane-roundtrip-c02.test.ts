/**
 * A8 TL-SHORTAGE-C02 item 6 — a scheduling-policy pane save must not reset the
 * workload contract.
 *
 * LIVE DEFECT THIS CLOSES: `PUT /policies/scheduling/:schoolId/:schoolYearId`
 * upserts the policy row from the request body, and the server's
 * `requirePositiveInt` falls back to `POLICY_DEFAULTS` (1800 / 300 / 2400) for
 * any omitted field. `LocalPolicy` had no field for those three, so saving ANY
 * unrelated scheduling-policy change from the pane silently reset a school's
 * entire Teaching Load contract.
 *
 * `buildPolicySavePayload` is the exact body the pane sends, so this is a real
 * round trip: pane model -> payload -> the server's own resolution rule.
 *
 * Run: npx tsx --test src/lib/__tests__/tl-shortage-policy-pane-roundtrip-c02.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildPolicySavePayload,
	LOCAL_POLICY_WORKLOAD_DEFAULTS,
	LOCAL_POLICY_WORKLOAD_RANGES,
	workloadMinutesOf,
} from '../../components/scheduling-policy/policyWorkloadContract';
import type { LocalPolicy } from '../../components/scheduling-policy/policyWorkloadContract';

/** The server's `POLICY_DEFAULTS`, mirrored so a server default change is visible. */
const SERVER_POLICY_DEFAULTS = {
	teachingStandardMinutes: 1800,
	advisoryCreditMinutes: 300,
	hardCapMinutes: 2400,
};

/**
 * A school that deliberately set a NON-default workload contract — the case a
 * pane save used to destroy.
 */
const CUSTOMISED_WORKLOAD = {
	teachingStandardMinutes: 1500,
	advisoryCreditMinutes: 150,
	hardCapMinutes: 2100,
};

function localPolicy(overrides: Partial<LocalPolicy> = {}): LocalPolicy {
	return {
		teacherMoveEnabled: true,
		periodLengthMinutes: 45,
		periodsPerDay: 10,
		...LOCAL_POLICY_WORKLOAD_DEFAULTS,
		maxConsecutiveTeachingMinutesBeforeBreak: 135,
		minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480,
		earliestStartTime: '06:00',
		latestEndTime: '17:00',
		enforceConsecutiveBreakAsHard: true,
		enableTravelWellbeingChecks: true,
		maxWalkingDistanceMetersPerTransition: 300,
		maxBuildingTransitionsPerDay: 4,
		maxBackToBackTransitionsWithoutBuffer: 3,
		maxIdleGapMinutesPerDay: 45,
		avoidEarlyFirstPeriod: false,
		avoidLateLastPeriod: false,
		enableVacantAwareConstraints: true,
		targetFacultyDailyVacantMinutes: 60,
		targetSectionDailyVacantPeriods: 2,
		maxCompressedTeachingMinutesPerDay: 240,
		lunchStartTime: '12:00',
		lunchEndTime: '13:00',
		enforceLunchWindow: true,
		showSpecialEventsInGrid: true,
		enableFlagCeremony: true,
		flagCeremonyStartTime: '07:00',
		flagCeremonyEndTime: '07:30',
		enableRecess: true,
		recessStartTime: '09:45',
		recessEndTime: '10:00',
		enableLunchWindow: true,
		enableTeacherLunchWindow: true,
		enforceTeacherLunchWindow: false,
		enableShiftCoherenceGuard: true,
		enforceShiftCoherenceGuard: false,
		enableTleTwoPassPriority: true,
		allowFlexibleSubjectAssignment: false,
		allowConsecutiveLabSessions: false,
		constraintConfig: {},
		...overrides,
	};
}

/**
 * The server's own `requirePositiveInt` semantics, reproduced exactly as in
 * `scheduling-policy.service.ts`: an omitted field takes the server default, an
 * out-of-range field is an error. This is the rule that turned an omitted field
 * into a silent reset.
 */
function serverResolvedWorkload(body: Record<string, unknown>): {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
	errors: string[];
} {
	const errors: string[] = [];
	const requirePositiveInt = (val: unknown, name: string, min: number, max: number, fallback: number): number => {
		if (val === undefined || val === null) return fallback;
		const n = Number(val);
		if (!Number.isInteger(n) || n < min || n > max) {
			errors.push(`${name} must be an integer between ${min} and ${max}.`);
			return fallback;
		}
		return n;
	};
	const teachingStandardMinutes = requirePositiveInt(body.teachingStandardMinutes, 'teachingStandardMinutes', LOCAL_POLICY_WORKLOAD_RANGES.teachingStandardMinutes.min, LOCAL_POLICY_WORKLOAD_RANGES.teachingStandardMinutes.max, SERVER_POLICY_DEFAULTS.teachingStandardMinutes);
	const advisoryCreditMinutes = requirePositiveInt(body.advisoryCreditMinutes, 'advisoryCreditMinutes', LOCAL_POLICY_WORKLOAD_RANGES.advisoryCreditMinutes.min, LOCAL_POLICY_WORKLOAD_RANGES.advisoryCreditMinutes.max, SERVER_POLICY_DEFAULTS.advisoryCreditMinutes);
	const hardCapMinutes = requirePositiveInt(body.hardCapMinutes, 'hardCapMinutes', LOCAL_POLICY_WORKLOAD_RANGES.hardCapMinutes.min, LOCAL_POLICY_WORKLOAD_RANGES.hardCapMinutes.max, SERVER_POLICY_DEFAULTS.hardCapMinutes);
	if (errors.length === 0 && hardCapMinutes < teachingStandardMinutes) {
		errors.push('hardCapMinutes must be >= teachingStandardMinutes.');
	}
	return { teachingStandardMinutes, advisoryCreditMinutes, hardCapMinutes, errors };
}

test('item 6: a CUSTOMISED workload contract round-trips through the pane unchanged', () => {
	const pane = localPolicy({ ...CUSTOMISED_WORKLOAD });
	// The operator changes something completely unrelated.
	pane.periodsPerDay = 8;

	const body = buildPolicySavePayload(pane);
	const resolved = serverResolvedWorkload(body);

	assert.deepEqual(resolved.errors, []);
	assert.equal(resolved.teachingStandardMinutes, CUSTOMISED_WORKLOAD.teachingStandardMinutes);
	assert.equal(resolved.advisoryCreditMinutes, CUSTOMISED_WORKLOAD.advisoryCreditMinutes);
	assert.equal(resolved.hardCapMinutes, CUSTOMISED_WORKLOAD.hardCapMinutes);
	assert.equal(body.periodsPerDay, 8, 'the unrelated edit is still saved');
});

test('item 6: the payload never omits the three fields, so a server default cannot be substituted', () => {
	const body = buildPolicySavePayload(localPolicy());
	for (const field of ['teachingStandardMinutes', 'advisoryCreditMinutes', 'hardCapMinutes'] as const) {
		assert.equal(Object.prototype.hasOwnProperty.call(body, field), true, `${field} is present in the payload`);
		assert.notEqual(body[field], undefined, `${field} is not undefined`);
	}
});

test('item 6: a policy that really does carry the defaults resolves to those defaults', () => {
	const resolved = serverResolvedWorkload(buildPolicySavePayload(localPolicy()));
	assert.deepEqual(resolved.errors, []);
	assert.equal(resolved.teachingStandardMinutes, SERVER_POLICY_DEFAULTS.teachingStandardMinutes);
	assert.equal(resolved.advisoryCreditMinutes, SERVER_POLICY_DEFAULTS.advisoryCreditMinutes);
	assert.equal(resolved.hardCapMinutes, SERVER_POLICY_DEFAULTS.hardCapMinutes);
});

test('item 6: the pre-existing lunch-window mirror on the server column is preserved', () => {
	const body = buildPolicySavePayload(localPolicy({ enableLunchWindow: false, enforceLunchWindow: true }));
	assert.equal(body.enforceLunchWindow, false, 'enforceLunchWindow mirrors enableLunchWindow exactly as before');
	assert.equal(body.enableLunchWindow, false);
});

test('item 6: the PRE-FIX payload really did reset the contract (the control discriminates)', () => {
	// The body the pane sent before item 6: every LocalPolicy field EXCEPT the
	// three workload columns, which the model did not have.
	const {
		teachingStandardMinutes: _t,
		advisoryCreditMinutes: _a,
		hardCapMinutes: _h,
		...withoutWorkload
	} = localPolicy({ ...CUSTOMISED_WORKLOAD }) as LocalPolicy & Record<string, unknown>;

	const resolved = serverResolvedWorkload(withoutWorkload);
	assert.equal(resolved.teachingStandardMinutes, SERVER_POLICY_DEFAULTS.teachingStandardMinutes);
	assert.equal(resolved.advisoryCreditMinutes, SERVER_POLICY_DEFAULTS.advisoryCreditMinutes);
	assert.equal(resolved.hardCapMinutes, SERVER_POLICY_DEFAULTS.hardCapMinutes);
	assert.notEqual(resolved.teachingStandardMinutes, CUSTOMISED_WORKLOAD.teachingStandardMinutes);
	assert.notEqual(resolved.hardCapMinutes, CUSTOMISED_WORKLOAD.hardCapMinutes);
});

test('item 6: the server stays authoritative on invalid values instead of trusting the pane', () => {
	const inverted = buildPolicySavePayload(localPolicy({ teachingStandardMinutes: 2400, hardCapMinutes: 1800 }));
	assert.ok(
		serverResolvedWorkload(inverted).errors.includes('hardCapMinutes must be >= teachingStandardMinutes.'),
		'hardCap below the teaching standard is still rejected',
	);

	const outOfRange = buildPolicySavePayload(localPolicy({ teachingStandardMinutes: 9000 }));
	assert.ok(
		serverResolvedWorkload(outOfRange).errors.includes('teachingStandardMinutes must be an integer between 600 and 4800.'),
		'an out-of-range value is rejected, never silently clamped by the pane',
	);
});

test('item 6: a policy response without the three columns falls back to the server defaults', () => {
	// `policyToLocal` reads the columns through a narrow augmentation because the
	// shared client type does not carry them. A response missing them must show
	// the server defaults, not `undefined` (which would have been written back
	// and rejected, or defaulted to a different number by the server).
	assert.deepEqual(workloadMinutesOf(null), { ...LOCAL_POLICY_WORKLOAD_DEFAULTS });
	assert.deepEqual(workloadMinutesOf(undefined), { ...LOCAL_POLICY_WORKLOAD_DEFAULTS });
	assert.deepEqual(workloadMinutesOf({ teachingStandardMinutes: null }), { ...LOCAL_POLICY_WORKLOAD_DEFAULTS });
	assert.deepEqual(workloadMinutesOf({ teachingStandardMinutes: 1500 }), {
		teachingStandardMinutes: 1500,
		advisoryCreditMinutes: LOCAL_POLICY_WORKLOAD_DEFAULTS.advisoryCreditMinutes,
		hardCapMinutes: LOCAL_POLICY_WORKLOAD_DEFAULTS.hardCapMinutes,
	});
});
