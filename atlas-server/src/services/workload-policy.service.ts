/**
 * Workload policy service — canonical calculation primitives for teaching load metrics.
 *
 * One computation contract consumed by Teaching Load, Teachers, auto-fill,
 * rebalance, readiness, and generation. No advisory/ancillary leakage into
 * teaching utilization.
 */

// ─── DTO ───

export interface WorkloadPolicy {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
}

export interface WorkloadComputation {
	actualTeachingMinutes: number;
	advisoryCreditMinutes: number;
	ancillaryCreditMinutes: number;
	creditedWorkloadMinutes: number;
	teachingStandardMinutes: number;
	teachingUtilizationPercent: number;
	teachingCapacityRemainingMinutes: number;
	excessTeachingMinutes: number;
}

// ─── Defaults ───

export const WORKLOAD_DEFAULTS: WorkloadPolicy = {
	teachingStandardMinutes: 1_800,  // 30 hours
	advisoryCreditMinutes: 300,      // 5 hours
	hardCapMinutes: 2_400,           // 40 hours
} as const;

// ─── Pure computation ───

/**
 * Compute the canonical workload breakdown for a faculty member.
 *
 * `actualTeachingMinutes` = scheduled instructional subject minutes only.
 * Advisory and ancillary are separately reported and never leak into
 * teaching utilization or teaching capacity remaining.
 */
export function computeWorkload(
	actualTeachingMinutes: number,
	advisoryCreditMinutes: number,
	ancillaryCreditMinutes: number,
	policy: WorkloadPolicy,
): WorkloadComputation {
	const teaching = Math.max(0, Math.round(actualTeachingMinutes));
	const advisory = Math.max(0, Math.round(advisoryCreditMinutes));
	const ancillary = Math.max(0, Math.round(ancillaryCreditMinutes));
	const standard = Math.max(0, Math.round(policy.teachingStandardMinutes));

	const creditedWorkloadMinutes = teaching + advisory + ancillary;
	const teachingUtilizationPercent = standard > 0
		? Math.round((teaching / standard) * 10_000) / 100
		: 0;
	const teachingCapacityRemainingMinutes = Math.max(standard - teaching, 0);
	const excessTeachingMinutes = Math.max(teaching - standard, 0);

	return {
		actualTeachingMinutes: teaching,
		advisoryCreditMinutes: advisory,
		ancillaryCreditMinutes: ancillary,
		creditedWorkloadMinutes,
		teachingStandardMinutes: standard,
		teachingUtilizationPercent,
		teachingCapacityRemainingMinutes,
		excessTeachingMinutes,
	};
}


