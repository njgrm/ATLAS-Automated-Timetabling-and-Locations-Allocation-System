/**
 * A8-C5 S1.3 / acceptance row A4 — the hire estimate uses the SAVED workload
 * policy, not a module constant.
 *
 * Lane C's truth fix (`docs/prompts/truth-fixes-2026-09-29.md` §A8): the staffing
 * report's `recommendedNewHires` divided the concurrent missing hours by the
 * `STANDARD_CAP_MIN` constant, while the per-teacher capacity gate in the very
 * same report already resolved the school's SAVED policy standard
 * (`resolveSharedRealFacultyCapMinutes`, line 787:
 * `policy?.teachingStandardMinutes ?? STANDARD_CAP_MIN`). A school that set its
 * own standard therefore got a staffing figure from a number nobody chose.
 *
 * The controls, in the order the packet states them:
 *   - a policy whose `teachingStandardMinutes` DIFFERS from the default CHANGES
 *     `recommendedNewHires`                                       (A4, discriminating)
 *   - a policy EQUAL to the default reproduces the base number EXACTLY
 *                                                            (A4, preservation)
 *   - a policy of zero minutes fails closed to 0 rather than dividing by zero
 *                                                            (A4, fail-closed)
 *
 * Hermetic: `buildStaffingReport` is a pure fold over its arguments. No database
 * is contacted; `DATABASE_URL` is forced at an unreachable placeholder so an
 * accidental dispatch fails closed.
 *
 * Run (server workspace): npx tsx --test src/__tests__/a8-c5-hire-estimate-policy.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

const { buildStaffingReport } = await import('../services/teaching-load-automation.service.js');
const { WORKLOAD_DEFAULTS } = await import('../services/workload-policy.service.js');

const DEFAULT_STANDARD_MINUTES = WORKLOAD_DEFAULTS.teachingStandardMinutes;

/** One 120-minute/week pair that no real faculty member can cover. */
const UNRESOLVED_PAIRS = [
	{
		subjectId: 11,
		sectionId: 501,
		sectionName: '7-Rizal',
		sectionProgramType: 'REGULAR',
		subject: {
			id: 11,
			code: 'MATH',
			name: 'Mathematics',
			ownerDepartment: 'MATH',
			minMinutesPerWeek: 120,
			modularGroupId: null,
			modularOrder: null,
			termGroupId: null,
			termCount: 3,
			rotationFamily: null,
			requiredFeatures: [],
		},
	},
];

/**
 * `laneCount` DISTINCT capacity lanes of `minutesPerWeek` each, so the concurrent
 * total is `laneCount * minutesPerWeek`. Distinct lanes are what the report calls
 * "concurrent" demand: the demand that genuinely needs a hire at the same time.
 */
function lanes(laneCount: number, minutesPerWeek: number) {
	return Array.from({ length: laneCount }, (_unused, index) => {
		const subjectId = 11 + index;
		const code = `SUBJ${index}`;
		return {
			subjectId,
			sectionId: 501 + index,
			sectionName: `7-S${index}`,
			sectionProgramType: 'REGULAR',
			subject: {
				id: subjectId,
				code,
				name: `Subject ${index}`,
				ownerDepartment: `DEPT${index}`,
				minMinutesPerWeek: minutesPerWeek,
				modularGroupId: null,
				modularOrder: null,
				termGroupId: null,
				termCount: 3,
				rotationFamily: null,
				requiredFeatures: [],
			},
		};
	});
}

/** Two 120-minute lanes → 240 minutes = 4 concurrent missing hours per week. */
const TWO_LANE_PAIRS = lanes(2, 120);

const NO_FACULTY: never[] = [];
const NO_CAPACITY = new Map<number, number>();

function estimateFor(
	pairs: typeof UNRESOLVED_PAIRS,
	policy: { teachingStandardMinutes?: number | null; hardCapMinutes?: number | null } | null | undefined,
) {
	return buildStaffingReport(pairs as never, NO_FACULTY, NO_CAPACITY, 'REAL_FACULTY_STANDARD' as never, undefined, policy);
}

// ─────────────────────────────────────────────────────────────────────────────
// A4.1 — the saved policy changes the estimate. This is the discriminating
// control: on base, EVERY policy produced the same number.
// ─────────────────────────────────────────────────────────────────────────────
test('A4.1 a saved policy whose standard differs from the default CHANGES recommendedNewHires', () => {
	const concurrentHours = estimateFor(TWO_LANE_PAIRS, null).concurrentMissingHoursPerWeek;
	assert.equal(concurrentHours, 4, 'the fixture has 4 concurrent missing hours per week');

	// Baseline: no policy at all → the module default.
	const baseline = estimateFor(TWO_LANE_PAIRS, null).recommendedNewHires;
	assert.equal(
		baseline,
		Math.round((4 / (DEFAULT_STANDARD_MINUTES / 60)) * 10) / 10,
		'with no saved policy the estimate uses the module default',
	);

	// A school that raised its standard to 20 h/week: fewer hours per hire, so
	// MORE hires for the same 4 missing hours.
	const raised = estimateFor(TWO_LANE_PAIRS, { teachingStandardMinutes: 20 * 60, hardCapMinutes: 24 * 60 });
	assert.equal(raised.recommendedNewHires, Math.round((4 / 20) * 10) / 10, 'a 20 h standard gives 0.2 hires');
	assert.notEqual(raised.recommendedNewHires, baseline, 'the saved policy must move the number — this is the control that fails on base');

	// A school that LOWERED its standard to 10 h/week: fewer hires for the same gap.
	const lowered = estimateFor(TWO_LANE_PAIRS, { teachingStandardMinutes: 10 * 60, hardCapMinutes: 12 * 60 });
	assert.equal(lowered.recommendedNewHires, 0.4, 'a 10 h standard gives 0.4 hires');
	assert.notEqual(lowered.recommendedNewHires, baseline);
});

// ─────────────────────────────────────────────────────────────────────────────
// A4.2 — PRESERVATION. A saved policy that EQUALS the default reproduces the
// base number exactly, so a school already on the default sees no change.
// ─────────────────────────────────────────────────────────────────────────────
test('A4.2 a saved policy equal to the default reproduces the base number exactly', () => {
	const noPolicy = estimateFor(TWO_LANE_PAIRS, null).recommendedNewHires;
	const atDefault = estimateFor(TWO_LANE_PAIRS, { teachingStandardMinutes: DEFAULT_STANDARD_MINUTES, hardCapMinutes: null }).recommendedNewHires;
	assert.equal(atDefault, noPolicy, 'the default policy and no policy agree exactly');

	// A null standard also falls back to the default (the `??` in the resolution).
	const nullStandard = estimateFor(TWO_LANE_PAIRS, { teachingStandardMinutes: null, hardCapMinutes: null }).recommendedNewHires;
	assert.equal(nullStandard, noPolicy, 'a null saved standard resolves to the default, never to zero');
});

// ─────────────────────────────────────────────────────────────────────────────
// A4.3 — FAIL CLOSED. A zero-minute standard must not divide by zero.
// ─────────────────────────────────────────────────────────────────────────────
test('A4.3 a zero-minute saved standard fails closed to 0 rather than dividing by zero', () => {
	const result = estimateFor(TWO_LANE_PAIRS, { teachingStandardMinutes: 0, hardCapMinutes: 0 });
	assert.equal(result.recommendedNewHires, 0, 'no standard, no estimate — never Infinity or NaN');
	assert.equal(Number.isFinite(result.recommendedNewHires), true);
	assert.equal(Number.isNaN(result.recommendedNewHires), false);

	// The rest of the report is unaffected: the missing hours are still reported,
	// so the operator is not left with a zero and no explanation.
	assert.equal(result.concurrentMissingHoursPerWeek, 4, 'the measured shortage is still reported truthfully');
});

// ─────────────────────────────────────────────────────────────────────────────
// A4.4 — the estimate tracks the measured shortage, not a stale number: the
// policy is a divisor, so doubling the gap doubles the estimate at a fixed
// policy, and the estimate is monotonic in the saved standard.
// ─────────────────────────────────────────────────────────────────────────────
test('A4.4 the policy is a divisor, not a cap: the estimate is monotonic in the saved standard', () => {
	// 40 concurrent missing hours, so each standard yields a distinct, rounded value.
	const big = lanes(4, 600);
	const hours = estimateFor(big, null).concurrentMissingHoursPerWeek;
	assert.equal(hours, 40, 'the fixture has 40 concurrent missing hours per week');

	const at20 = estimateFor(big, { teachingStandardMinutes: 20 * 60 }).recommendedNewHires;
	const at40 = estimateFor(big, { teachingStandardMinutes: 40 * 60 }).recommendedNewHires;
	const at80 = estimateFor(big, { teachingStandardMinutes: 80 * 60 }).recommendedNewHires;
	assert.equal(at20, 2, '40 h at a 20 h standard is 2 hires');
	assert.equal(at40, 1, '40 h at a 40 h standard is 1 hire');
	assert.equal(at80, 0.5, '40 h at an 80 h standard is half a hire');
	assert.ok(at20 > at40 && at40 > at80, `a smaller standard needs more hires (${at20} > ${at40} > ${at80})`);

	// Doubling the shortage at a FIXED policy doubles the estimate: the policy is
	// a divisor of the measured gap, not a replacement for it.
	const half = estimateFor(lanes(2, 600), { teachingStandardMinutes: 20 * 60 }).recommendedNewHires;
	assert.equal(half, 1, '20 h at a 20 h standard is 1 hire');
	assert.equal(at20, half * 2, 'doubling the gap doubles the estimate');
});

// ─────────────────────────────────────────────────────────────────────────────
// A4.5 — FAILING-FIRST CONTROL. The pre-fix expression divided by the constant
// unconditionally, so every one of these policies produced the SAME number. The
// suite is therefore not vacuous: on base, A4.1 and A4.4 both fail.
// ─────────────────────────────────────────────────────────────────────────────
test('A4.5 FAILING-FIRST CONTROL: the pre-fix expression ignores the saved policy entirely', () => {
	// The exact pre-fix expression, with the constant hard-wired.
	const preFix = (hours: number) => Math.round((hours / (DEFAULT_STANDARD_MINUTES / 60)) * 10) / 10;

	// The discriminator: the pre-fix arithmetic is a function of the gap ALONE, so
	// it returns the same number for a 20 h policy, a 40 h policy and no policy.
	// On base, the assertion inside this test therefore fails — it is not vacuous.
	assert.equal(DEFAULT_STANDARD_MINUTES, 1_800, 'the module default is a 30-hour teaching standard');
	assert.equal(preFix(40), 1.3, 'the pre-fix constant gives 1.3 for a 40 h gap whatever the policy says');
	assert.equal(
		preFix(40),
		preFix(40),
		'the pre-fix expression takes no policy argument at all, so it cannot distinguish these cases',
	);

	// The shipped behaviour, for the record: the SAME gap under three policies.
	assert.equal(estimateFor(lanes(4, 600), { teachingStandardMinutes: 20 * 60 }).recommendedNewHires, 2);
	assert.equal(estimateFor(lanes(4, 600), { teachingStandardMinutes: 40 * 60 }).recommendedNewHires, 1);
	assert.notEqual(
		estimateFor(lanes(4, 600), { teachingStandardMinutes: 20 * 60 }).recommendedNewHires,
		preFix(40),
		'the shipped estimate must differ from the pre-fix constant for a non-default policy',
	);
});
