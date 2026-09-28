import assert from 'node:assert/strict';
import test from 'node:test';

import {
	effectiveWeeklyCapMinutes,
	evaluateWeeklyLoad,
	resolveRealFacultyCapMinutes,
} from '../services/teaching-load-capacity.service.js';

/**
 * A8 TL-SHORTAGE-C02 item 1 — 40h mode must honour the teacher, through ONE rule.
 *
 * Failing-first evidence for this file is recorded in the handoff: the
 * `40h mode promises a 30h teacher their own 30h contract` control failed
 * against the pre-fix source, where the hard-cap branch was a bare
 * `HARD_CAP_MIN` that never read `maxHoursPerWeek`.
 */

const STANDARD = 1800;
const HARD_CAP = 2400;

function capFor(maxHoursPerWeek: number, mode: 'REAL_FACULTY_STANDARD' | 'REAL_FACULTY_HARD_CAP', nonTeachingMinutes = 0) {
	return resolveRealFacultyCapMinutes({
		maxHoursPerWeek,
		mode,
		policyStandardMinutes: STANDARD,
		policyHardCapMinutes: HARD_CAP,
		nonTeachingMinutes,
	});
}

test('40h mode promises a 30h teacher their own 30h contract, not 40h', () => {
	assert.equal(capFor(30, 'REAL_FACULTY_HARD_CAP'), 1800);
});

test('40h mode honours a teacher who is contracted for more than the hard cap', () => {
	// A 45h contract is still bounded by the policy hard cap: the ceiling wins.
	assert.equal(capFor(45, 'REAL_FACULTY_HARD_CAP'), HARD_CAP);
	assert.equal(capFor(45, 'REAL_FACULTY_STANDARD'), STANDARD);
});

test('both coverage modes use the same min(contract, ceiling) shape', () => {
	// The ONLY difference between modes is which policy ceiling bounds the cap.
	for (const hours of [20, 25, 30, 35, 40, 45, 60]) {
		assert.equal(
			capFor(hours, 'REAL_FACULTY_STANDARD'),
			Math.min(hours * 60, STANDARD),
			`30h mode cap for a ${hours}h teacher`,
		);
		assert.equal(
			capFor(hours, 'REAL_FACULTY_HARD_CAP'),
			Math.min(hours * 60, HARD_CAP),
			`40h mode cap for a ${hours}h teacher`,
		);
	}
});

test('a 30h teacher is never promised more than the auto-fill gate will honour', () => {
	// The contract that produced the live defect: the preview promised 40h and
	// the same plan then flagged the teacher over cap. One rule, one answer.
	const promised = capFor(30, 'REAL_FACULTY_HARD_CAP');
	const evaluation = evaluateWeeklyLoad(promised + 1, {
		maxHoursPerWeek: 30,
		ancillaryMinutesPerWeek: null,
	});
	assert.equal(evaluation.capMinutes, promised);
	assert.equal(evaluation.isOverLimit, true, 'the promised budget must be exactly the enforced cap');

	const atCap = evaluateWeeklyLoad(promised, { maxHoursPerWeek: 30, ancillaryMinutesPerWeek: null });
	assert.equal(atCap.isOverLimit, false, 'a teacher exactly at the promised cap is not over limit');
});

test('non-teaching credit reduces the cap but can never raise it', () => {
	assert.equal(capFor(30, 'REAL_FACULTY_HARD_CAP', 300), 1500);
	assert.equal(capFor(30, 'REAL_FACULTY_HARD_CAP', 99999), 0);
	// Advisory/ancillary already charged must not push the cap above the
	// un-credited contract.
	assert.ok(capFor(30, 'REAL_FACULTY_HARD_CAP', 300) < capFor(30, 'REAL_FACULTY_HARD_CAP'));
});

test('negative or non-finite contracts fail closed to zero rather than a negative cap', () => {
	assert.equal(capFor(-5, 'REAL_FACULTY_HARD_CAP'), 0);
	assert.equal(capFor(0, 'REAL_FACULTY_STANDARD'), 0);
});

test('the applicable cap is the teacher contract minus ancillary, per the shared rule', () => {
	assert.equal(effectiveWeeklyCapMinutes({ maxHoursPerWeek: 30, ancillaryMinutesPerWeek: null }), 1800);
	assert.equal(effectiveWeeklyCapMinutes({ maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 300 }), 1500);
	// The generator's whole-hour projection must be reproduced exactly: 1800-100
	// = 1700 raw, floored to 28h = 1680. This is the value the generator has
	// always used, so routing it through the shared rule cannot move its HARD
	// `FACULTY_OVERLOAD` count.
	assert.equal(
		effectiveWeeklyCapMinutes({ maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 100, floorToWholeHours: true }),
		1680,
	);
});

test('the over-limit predicate is shared and never reports negative excess', () => {
	const evaluation = evaluateWeeklyLoad(1500, { maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 300 });
	assert.deepEqual(evaluation, {
		teachingMinutes: 1500,
		capMinutes: 1500,
		overMinutes: 0,
		isOverLimit: false,
	});

	const over = evaluateWeeklyLoad(1860, { maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 300 });
	assert.equal(over.isOverLimit, true);
	assert.equal(over.overMinutes, 360);
});
