/**
 * Workload policy unit tests — canonical computation contract.
 *
 * These tests prove the 7-vs-9 discrepancy fix: advisory/ancillary never
 * leak into teaching utilization.
 */

import { computeWorkload, WORKLOAD_DEFAULTS } from '../services/workload-policy.service.js';

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
	try {
		fn();
		passCount += 1;
		console.log(`[PASS] ${name}`);
	} catch (e: any) {
		failCount += 1;
		console.error(`[FAIL] ${name}: ${e.message}`);
	}
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
	if (actual !== expected) {
		throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
	}
}

function assertApprox(actual: number, expected: number, tolerance: number, label: string) {
	if (Math.abs(actual - expected) > tolerance) {
		throw new Error(`${label}: expected ~${expected} (±${tolerance}), got ${actual}`);
	}
}

// ─── computeWorkload ───

test('zero teaching + 5h advisory => 0% utilization, 5h credited', () => {
	const w = computeWorkload(0, 300, 0, WORKLOAD_DEFAULTS);
	assertEqual(w.actualTeachingMinutes, 0, 'actualTeachingMinutes');
	assertEqual(w.advisoryCreditMinutes, 300, 'advisoryCreditMinutes');
	assertEqual(w.ancillaryCreditMinutes, 0, 'ancillaryCreditMinutes');
	assertEqual(w.creditedWorkloadMinutes, 300, 'creditedWorkloadMinutes');
	assertEqual(w.teachingStandardMinutes, 1800, 'teachingStandardMinutes');
	assertEqual(w.teachingUtilizationPercent, 0, 'teachingUtilizationPercent');
	assertEqual(w.teachingCapacityRemainingMinutes, 1800, 'teachingCapacityRemainingMinutes');
	assertEqual(w.excessTeachingMinutes, 0, 'excessTeachingMinutes');
});

test('26.25h teaching + 5h advisory => under 30h standard, 31.25h credited', () => {
	const teachingMinutes = 1575; // 26.25h
	const advisoryMinutes = 300;  // 5h
	const w = computeWorkload(teachingMinutes, advisoryMinutes, 0, WORKLOAD_DEFAULTS);
	assertEqual(w.actualTeachingMinutes, 1575, 'actualTeachingMinutes');
	assertEqual(w.advisoryCreditMinutes, 300, 'advisoryCreditMinutes');
	assertEqual(w.creditedWorkloadMinutes, 1875, 'creditedWorkloadMinutes');
	assertApprox(w.teachingUtilizationPercent, 87.5, 0.1, 'teachingUtilizationPercent');
	assertEqual(w.teachingCapacityRemainingMinutes, 225, 'teachingCapacityRemainingMinutes');
	assertEqual(w.excessTeachingMinutes, 0, 'excessTeachingMinutes');
});

test('37.5h teaching => 7.5h excess and zero negative remaining', () => {
	const teachingMinutes = 2250; // 37.5h
	const w = computeWorkload(teachingMinutes, 0, 0, WORKLOAD_DEFAULTS);
	assertEqual(w.actualTeachingMinutes, 2250, 'actualTeachingMinutes');
	assertEqual(w.creditedWorkloadMinutes, 2250, 'creditedWorkloadMinutes');
	assertEqual(w.teachingCapacityRemainingMinutes, 0, 'teachingCapacityRemainingMinutes');
	assertEqual(w.excessTeachingMinutes, 450, 'excessTeachingMinutes');
});

test('advisory does not affect teaching utilization', () => {
	const teachingMinutes = 1500; // 25h
	const advisoryMinutes = 600;  // 10h
	const w = computeWorkload(teachingMinutes, advisoryMinutes, 0, WORKLOAD_DEFAULTS);
	assertApprox(w.teachingUtilizationPercent, 83.33, 0.1, 'teachingUtilizationPercent (advisory should not inflate)');
	assertEqual(w.teachingCapacityRemainingMinutes, 300, 'teachingCapacityRemainingMinutes (advisory should not reduce)');
	assertEqual(w.excessTeachingMinutes, 0, 'excessTeachingMinutes');
});

test('ancillary does not affect teaching utilization', () => {
	const teachingMinutes = 1500; // 25h
	const ancillaryMinutes = 300; // 5h
	const w = computeWorkload(teachingMinutes, 0, ancillaryMinutes, WORKLOAD_DEFAULTS);
	assertApprox(w.teachingUtilizationPercent, 83.33, 0.1, 'teachingUtilizationPercent (ancillary should not inflate)');
	assertEqual(w.teachingCapacityRemainingMinutes, 300, 'teachingCapacityRemainingMinutes (ancillary should not reduce)');
	assertEqual(w.excessTeachingMinutes, 0, 'excessTeachingMinutes');
});

test('different persisted standards for two schools/years do not leak', () => {
	const schoolA = { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 };
	const schoolB = { teachingStandardMinutes: 1500, advisoryCreditMinutes: 200, hardCapMinutes: 2000 };

	const teachingMinutes = 1680; // 28h
	const wA = computeWorkload(teachingMinutes, 0, 0, schoolA);
	const wB = computeWorkload(teachingMinutes, 0, 0, schoolB);

	assertEqual(wA.teachingStandardMinutes, 1800, 'schoolA standard');
	assertEqual(wB.teachingStandardMinutes, 1500, 'schoolB standard');
	assertEqual(wA.teachingCapacityRemainingMinutes, 120, 'schoolA remaining');
	assertEqual(wB.teachingCapacityRemainingMinutes, 0, 'schoolB remaining (reached standard)');
	assertEqual(wB.excessTeachingMinutes, 180, 'schoolB excess');
});

test('negative inputs are clamped to zero', () => {
	const w = computeWorkload(-100, -50, -20, WORKLOAD_DEFAULTS);
	assertEqual(w.actualTeachingMinutes, 0, 'actualTeachingMinutes clamped');
	assertEqual(w.advisoryCreditMinutes, 0, 'advisoryCreditMinutes clamped');
	assertEqual(w.ancillaryCreditMinutes, 0, 'ancillaryCreditMinutes clamped');
	assertEqual(w.creditedWorkloadMinutes, 0, 'creditedWorkloadMinutes');
});

test('rounding preserves exact minutes', () => {
	const w = computeWorkload(1575, 300, 120, WORKLOAD_DEFAULTS);
	assertEqual(w.actualTeachingMinutes, 1575, 'exact minutes preserved');
	assertEqual(w.advisoryCreditMinutes, 300, 'exact advisory preserved');
	assertEqual(w.ancillaryCreditMinutes, 120, 'exact ancillary preserved');
	assertEqual(w.creditedWorkloadMinutes, 1995, 'exact sum');
});

// ─── Summary ───

console.log(`\n=== Workload Policy Tests ===`);
console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
if (failCount > 0) process.exit(1);
