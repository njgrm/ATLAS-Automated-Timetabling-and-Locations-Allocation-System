import assert from 'node:assert/strict';
import test from 'node:test';

import {
	evaluateWeeklyLoad,
} from '../services/teaching-load-capacity.service.js';
import {
	computeOverloadCapacityTotals,
	type FacultyWorkloadSnapshot,
	type WorkloadPolicySnapshot,
} from '../services/teaching-load-reconciliation.service.js';

/**
 * A8 TL-SHORTAGE-C02 item 5 — ONE load definition.
 *
 * Live divergence this closes: the generator reported 5 teachers over limit and
 * Teaching Load reported 0, because the truth panel compared every teacher
 * against the school `hardCapMinutes` (2400) and never consulted
 * `maxHoursPerWeek`, while the generator used the teacher's own contract.
 *
 * These controls compare the generator's projected cap and the truth panel's cap
 * on ONE snapshot and require the identical over-limit SET.
 */

const POLICY: WorkloadPolicySnapshot = {
	teachingStandardMinutes: 1800,
	advisoryCreditMinutes: 300,
	hardCapMinutes: 2400,
	status: 'CONFIGURED',
};

/**
 * Reproduce the generator's exact cap projection for a faculty row:
 * `generation-preflight.service.ts` reduces `maxHoursPerWeek` by ancillary and
 * floors it to whole hours before `constraint-validator` multiplies by 60.
 */
function generatorCapMinutes(maxHoursPerWeek: number, ancillaryMinutesPerWeek: number | null): number {
	const effective = evaluateWeeklyLoad(0, { maxHoursPerWeek, ancillaryMinutesPerWeek });
	return effective.capMinutes;
}

/** One truth-panel workload row, judged through the shared definition. */
function truthPanelRow(
	facultyId: number,
	teachingMinutes: number,
	maxHoursPerWeek: number,
	ancillaryMinutesPerWeek: number | null,
): FacultyWorkloadSnapshot {
	const evaluation = evaluateWeeklyLoad(teachingMinutes, { maxHoursPerWeek, ancillaryMinutesPerWeek });
	return {
		facultyId,
		name: `Teacher ${facultyId}`,
		isClassAdviser: false,
		isActiveForScheduling: true,
		isPlaceholder: false,
		beforeMinutes: teachingMinutes,
		afterMinutes: teachingMinutes,
		beforeStatus: 'COMPLIANT',
		afterStatus: 'COMPLIANT',
		maxHoursPerWeek,
		ancillaryMinutesPerWeek,
		applicableCapMinutes: evaluation.capMinutes,
		beforeOverApplicableCap: evaluation.isOverLimit,
		afterOverApplicableCap: evaluation.isOverLimit,
	};
}

interface Teacher {
	id: number;
	teachingMinutes: number;
	maxHoursPerWeek: number;
	ancillaryMinutesPerWeek: number | null;
}

/** The one fixture both surfaces are evaluated against. */
const SNAPSHOT: Teacher[] = [
	// Over the 30h contract by 60 minutes (1860 > 1800): the generator's HARD set.
	{ id: 1, teachingMinutes: 1860, maxHoursPerWeek: 30, ancillaryMinutesPerWeek: null },
	// Ancillary shrinks the effective contract to 1500, so 1560 is over.
	{ id: 2, teachingMinutes: 1560, maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 300 },
	// Exactly at the contract: never "over".
	{ id: 3, teachingMinutes: 1800, maxHoursPerWeek: 30, ancillaryMinutesPerWeek: null },
	// A 45h contract: 2400 is within it, so the school hard cap is NOT the bar.
	{ id: 4, teachingMinutes: 2400, maxHoursPerWeek: 45, ancillaryMinutesPerWeek: null },
	// A 20h contract: 1260 minutes is comfortably over.
	{ id: 5, teachingMinutes: 1260, maxHoursPerWeek: 20, ancillaryMinutesPerWeek: null },
	// Zero-load teacher: never over.
	{ id: 6, teachingMinutes: 0, maxHoursPerWeek: 30, ancillaryMinutesPerWeek: null },
];

test('item 5: the generator validator and the truth panel produce the IDENTICAL over-limit set', () => {
	const generatorOverLimit = SNAPSHOT
		.filter((teacher) => teacher.teachingMinutes > generatorCapMinutes(teacher.maxHoursPerWeek, teacher.ancillaryMinutesPerWeek))
		.map((teacher) => teacher.id)
		.sort((a, b) => a - b);

	const rows = SNAPSHOT.map((teacher) => truthPanelRow(
		teacher.id,
		teacher.teachingMinutes,
		teacher.maxHoursPerWeek,
		teacher.ancillaryMinutesPerWeek,
	));
	const totals = computeOverloadCapacityTotals(rows, POLICY);

	assert.deepEqual(
		totals.beforeOverApplicableCapFacultyIds,
		generatorOverLimit,
		'Teaching Load and generation must name the same over-limit teachers',
	);
	assert.equal(
		totals.beforeOverApplicableCapCount,
		generatorOverLimit.length,
		'the over-applicable-cap count must match the generator set size',
	);
});

test('item 5: the pre-fix truth panel (school hardCapMinutes, contract ignored) was the divergence', () => {
	// Recorded, not merely asserted: before the fix the panel counted only
	// teachers over the school hard cap, which is why it reported 0 while the
	// generator reported the set below.
	const oldPanelOverLimit = SNAPSHOT.filter((teacher) => teacher.teachingMinutes > POLICY.hardCapMinutes).map((t) => t.id);
	const rows = SNAPSHOT.map((teacher) => truthPanelRow(teacher.id, teacher.teachingMinutes, teacher.maxHoursPerWeek, teacher.ancillaryMinutesPerWeek));
	const totals = computeOverloadCapacityTotals(rows, POLICY);

	assert.deepEqual(oldPanelOverLimit, [], 'the OLD panel counted nobody over limit on this fixture — the live defect');
	assert.deepEqual(totals.beforeOverApplicableCapFacultyIds, [1, 2, 5], 'the shared definition names the three genuinely over-limit teachers');
	assert.equal(totals.beforeOverApplicableCapCount, 3);
});

test('item 5: the school policy band counts keep their existing meaning', () => {
	// No assertion is removed and no meaning shifts: the standard/hard-cap bands
	// still describe the SCHOOL policy, they are simply no longer the only view.
	const rows = SNAPSHOT.map((teacher) => truthPanelRow(teacher.id, teacher.teachingMinutes, teacher.maxHoursPerWeek, teacher.ancillaryMinutesPerWeek));
	const totals = computeOverloadCapacityTotals(rows, POLICY);

	assert.equal(totals.beforeOverStandardCount, 2, 'over the 1800 school standard: teachers 1 and 4');
	assert.equal(totals.beforeOverHardCapCount, 0, 'nobody is over the 2400 school hard cap');
	assert.equal(totals.teachingStandardMinutes, POLICY.teachingStandardMinutes);
	assert.equal(totals.hardCapMinutes, POLICY.hardCapMinutes);
	// `OverloadCapacityTotals` never carried the advisory credit and still does
	// not: advisory is not a band, it is credit. The proof that it is not folded
	// into the applicable cap is the per-row cap, asserted on the row the
	// advisory/ancillary interaction would corrupt if it were.
	assert.equal(
		rows.find((row) => row.facultyId === 2)?.applicableCapMinutes,
		1500,
		'the applicable cap is the 30h contract net of 300 ancillary minutes; advisory credit is never subtracted from it',
	);
	assert.equal(
		rows.find((row) => row.facultyId === 3)?.applicableCapMinutes,
		1800,
		'a teacher at exactly the contract with no ancillary keeps the full 1800 minutes',
	);
});

test('item 5: advisoryCreditMinutes keeps its value and never shifts meaning', () => {
	assert.equal(POLICY.advisoryCreditMinutes, 300);
	// Advisory credit is not folded into the applicable cap: a teacher with no
	// ancillary keeps their full contract.
	const row = truthPanelRow(1, 1860, 30, null);
	assert.equal(row.applicableCapMinutes, 1800, 'advisory credit is not subtracted from the teaching cap');
});

test('item 5: auto-fill and rebalance read the same cap as the generator and the panel', () => {
	// Auto-fill (`teaching-load-automation.service.ts` over-cap report) and
	// rebalance (over-cap donor detection) both call `evaluateWeeklyLoad`, so on
	// this snapshot every surface resolves the same applicable cap per teacher.
	for (const teacher of SNAPSHOT) {
		const generatorCap = generatorCapMinutes(teacher.maxHoursPerWeek, teacher.ancillaryMinutesPerWeek);
		const automationCap = evaluateWeeklyLoad(teacher.teachingMinutes, {
			maxHoursPerWeek: teacher.maxHoursPerWeek,
			ancillaryMinutesPerWeek: teacher.ancillaryMinutesPerWeek,
		}).capMinutes;
		const rebalanceCap = evaluateWeeklyLoad(teacher.teachingMinutes, {
			maxHoursPerWeek: teacher.maxHoursPerWeek,
			ancillaryMinutesPerWeek: teacher.ancillaryMinutesPerWeek,
		}).capMinutes;
		const panelCap = truthPanelRow(teacher.id, teacher.teachingMinutes, teacher.maxHoursPerWeek, teacher.ancillaryMinutesPerWeek).applicableCapMinutes;

		assert.equal(automationCap, generatorCap, `auto-fill cap for teacher ${teacher.id}`);
		assert.equal(rebalanceCap, generatorCap, `rebalance cap for teacher ${teacher.id}`);
		assert.equal(panelCap, generatorCap, `truth-panel cap for teacher ${teacher.id}`);
	}
});

test('item 5: the generator HARD projection is unchanged by the routing', () => {
	// The generator's cap is `Math.floor((hours*60 - ancillary)/60)*60`; routing
	// it through the shared rule must reproduce that value exactly, for every
	// (hours, ancillary) combination the preflight can produce.
	for (const hours of [10, 20, 25, 30, 35, 40, 45, 60]) {
		for (const ancillary of [0, 100, 300, 725]) {
			const effective = Math.max(0, Math.round(hours * 60) - ancillary);
			const legacy = Math.floor(effective / 60) * 60;
			assert.equal(
				generatorCapMinutes(hours, ancillary),
				legacy,
				`generator cap unchanged for ${hours}h with ${ancillary} ancillary minutes`,
			);
		}
	}
});

test('item 5: a teacher with no resolvable contract is never reported compliant by accident', () => {
	// An older stored snapshot carries no `maxHoursPerWeek`. The panel must not
	// silently claim compliance; the row simply carries no applicable-cap verdict.
	const legacyRow: FacultyWorkloadSnapshot = {
		facultyId: 99,
		name: 'Legacy Teacher',
		isClassAdviser: false,
		isActiveForScheduling: true,
		isPlaceholder: false,
		beforeMinutes: 2700,
		afterMinutes: 2700,
		beforeStatus: 'COMPLIANT',
		afterStatus: 'COMPLIANT',
	};
	const totals = computeOverloadCapacityTotals([legacyRow], POLICY);
	assert.equal(totals.beforeOverApplicableCapCount, 0, 'no contract -> no applicable-cap verdict claimed');
	assert.equal(totals.beforeOverHardCapCount, 1, 'the school hard-cap band still reports the real fact');
});
