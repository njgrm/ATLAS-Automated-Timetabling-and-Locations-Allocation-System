import assert from 'node:assert/strict';
import test from 'node:test';

import {
	computeOverloadCapacityTotals,
	type FacultyWorkloadSnapshot,
	type WorkloadPolicySnapshot,
} from '../services/teaching-load-reconciliation.service';

/**
 * TL-OPERATOR-WORKSPACE-C05 correction C-2.
 *
 * The canonical capacity basis is the faculty workload set — the same rows
 * `beforeTeachingMinutes` sums over — NOT the owned subject-section pair count,
 * and NOT implied from a single teacher's standard.
 *
 * Hermetic: no database, no network.
 */

const STANDARD = 1800;
const HARD_CAP = 2400;

function workload(facultyId: number, beforeMinutes: number, afterMinutes = beforeMinutes): FacultyWorkloadSnapshot {
	return {
		facultyId,
		name: `Teacher ${facultyId}`,
		isClassAdviser: false,
		isActiveForScheduling: true,
		isPlaceholder: false,
		beforeMinutes,
		afterMinutes,
		beforeStatus: 'COMPLIANT',
		afterStatus: 'COMPLIANT',
	};
}

// Five active faculty rows (including zero-load), totalling 7500 minutes.
const ROWS: FacultyWorkloadSnapshot[] = [
	workload(1, 2700),
	workload(2, 1200),
	workload(3, 0),
	workload(4, 3600),
	workload(5, 0),
];

const CONFIGURED: WorkloadPolicySnapshot = {
	teachingStandardMinutes: STANDARD,
	advisoryCreditMinutes: 300,
	hardCapMinutes: HARD_CAP,
	status: 'CONFIGURED',
};

const UNCONFIGURED: WorkloadPolicySnapshot = {
	teachingStandardMinutes: STANDARD,
	advisoryCreditMinutes: 300,
	hardCapMinutes: HARD_CAP,
	status: 'UNCONFIGURED',
};

test('C-2 capacityMinutes is the standard times the faculty workload count', () => {
	const totals = computeOverloadCapacityTotals(ROWS, CONFIGURED);
	assert.equal(totals.beforeTeachingMinutes, 7500);
	assert.equal(totals.capacityMinutes, STANDARD * ROWS.length);
	assert.equal(totals.capacityMinutes, 9000);

	// The unit-incoherent alternatives the client used to apply must differ.
	const ownedPairCount = 2;
	assert.notEqual(totals.capacityMinutes, STANDARD * ownedPairCount);
});

test('C-2 beforeExcessMinutes sums per-faculty over-standard minutes', () => {
	const totals = computeOverloadCapacityTotals(ROWS, CONFIGURED);
	// (2700-1800) + 0 + 0 + (3600-1800) + 0 = 900 + 1800
	assert.equal(totals.beforeExcessMinutes, 2700);

	// It is NOT `aggregate - one standard` (7500 - 1800 = 5700).
	assert.notEqual(totals.beforeExcessMinutes, totals.beforeTeachingMinutes - STANDARD);
	assert.equal(totals.beforeTeachingMinutes - STANDARD, 5700);
});

test('C-2 over-standard and over-hard-cap counts stay per-faculty', () => {
	const totals = computeOverloadCapacityTotals(ROWS, CONFIGURED);
	assert.equal(totals.beforeOverStandardCount, 2, '2700 and 3600 exceed 1800');
	assert.equal(totals.beforeOverHardCapCount, 2, '2700 and 3600 exceed 2400');
	assert.equal(totals.beforeOverStandardCount, ROWS.filter((row) => row.beforeMinutes > STANDARD).length);
});

test('C-2 zero-load faculty contribute capacity but no excess', () => {
	const totals = computeOverloadCapacityTotals([workload(1, 0), workload(2, 0)], CONFIGURED);
	assert.equal(totals.capacityMinutes, STANDARD * 2);
	assert.equal(totals.beforeTeachingMinutes, 0);
	assert.equal(totals.beforeExcessMinutes, 0);
	assert.equal(totals.beforeOverStandardCount, 0);
});

test('C-2 an unconfigured policy yields null capacity and null excess, never a default', () => {
	const totals = computeOverloadCapacityTotals(ROWS, UNCONFIGURED);
	assert.equal(totals.capacityMinutes, null);
	assert.equal(totals.beforeExcessMinutes, null);
	assert.equal(totals.teachingStandardMinutes, null);
	assert.equal(totals.hardCapMinutes, null);
	assert.equal(totals.beforeOverStandardCount, 0);
	assert.equal(totals.beforeOverHardCapCount, 0);
	// The raw aggregate is still reported truthfully.
	assert.equal(totals.beforeTeachingMinutes, 7500);
});

test('C-2 an empty faculty set has zero capacity and zero excess', () => {
	const totals = computeOverloadCapacityTotals([], CONFIGURED);
	assert.equal(totals.capacityMinutes, 0);
	assert.equal(totals.beforeExcessMinutes, 0);
	assert.equal(totals.beforeTeachingMinutes, 0);
});

test('C-2 the builder consumes the pure helper so payload and helper cannot drift', async () => {
	const { readFileSync } = await import('node:fs');
	const { fileURLToPath } = await import('node:url');
	const { dirname, resolve } = await import('node:path');
	const here = dirname(fileURLToPath(import.meta.url));
	const service = readFileSync(resolve(here, '../services/teaching-load-reconciliation.service.ts'), 'utf8');
	assert.match(service, /const overloadCapacityTotals = computeOverloadCapacityTotals\(plan\.facultyWorkloads, snapshot\.workloadPolicy\)/);
	// The inlined duplicate computation must be gone.
	assert.doesNotMatch(service, /beforeOverStandardCount: countAbove\(plan\.facultyWorkloads, standard\)/);
});
