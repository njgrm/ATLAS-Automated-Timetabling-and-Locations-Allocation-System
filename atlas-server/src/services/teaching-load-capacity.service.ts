/**
 * A8 TL-SHORTAGE-C2 — the ONE Teaching Load capacity contract.
 *
 * This module is deliberately dependency-free (it imports only the pure
 * workload-policy constants) so every consumer may use it without pulling in
 * the Prisma data context. Four surfaces previously each re-derived "how many
 * minutes is this teacher over?" and disagreed on live data (the generator
 * reported 5 over limit, Teaching Load reported 0):
 *
 *  - `constraint-validator.ts` (generation HARD `FACULTY_OVERLOAD`)
 *  - `teaching-load-reconciliation.service.ts` (TL truth panel)
 *  - `teaching-load-automation.service.ts` auto-fill over-cap report
 *  - `teaching-load-automation.service.ts` over-cap rebalance
 *
 * Both the minutes and the applicable cap are defined here, so a consumer
 * cannot accidentally pair one surface's minutes with another's cap.
 *
 * INVARIANT (item 5): `effectiveWeeklyCapMinutes` reproduces the generator's
 * existing projection exactly — `computeEffectiveWeeklyTeachingMinutes` (raw
 * `maxHoursPerWeek`, minus ancillary) floored to whole hours. Routing the
 * generator through this rule therefore cannot change the generator's HARD
 * violation count; a change in that count is a defect, not a tuning knob.
 * The policy `hardCapMinutes` / `teachingStandardMinutes` / `advisoryCreditMinutes`
 * keep their existing meanings and are NOT folded into the per-teacher cap.
 */

import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';

/**
 * Which coverage strategy's cap ceiling applies to a real faculty member.
 * Mirrors `CoverageMode` in the automation service without importing it (that
 * module imports this one).
 */
export type TeachingLoadCapMode = 'REAL_FACULTY_STANDARD' | 'REAL_FACULTY_HARD_CAP';

export interface FacultyCapResolutionInput {
	/** `FacultyMirror.maxHoursPerWeek` — the teacher's own weekly contract. */
	maxHoursPerWeek: number;
	mode: TeachingLoadCapMode;
	/**
	 * The applicable policy ceiling, in minutes. `REAL_FACULTY_STANDARD` uses
	 * `teachingStandardMinutes`; `REAL_FACULTY_HARD_CAP` uses `hardCapMinutes`.
	 */
	policyStandardMinutes: number;
	policyHardCapMinutes: number;
	/**
	 * Non-teaching minutes (advisory credit + ancillary) already charged against
	 * this teacher's weekly budget. Advisory/ancillary never *raise* the cap.
	 */
	nonTeachingMinutes?: number | null;
}

/**
 * The single rule for "how many teaching minutes may this real teacher be
 * promised this week".
 *
 * Both coverage modes use the same shape — `min(teacher contract, policy
 * ceiling)` — so a 30-hour teacher is never promised a 40-hour budget by the
 * hard-cap mode and then flagged over cap. The only difference between modes is
 * which policy ceiling is the outer bound.
 *
 * `proposal.service.ts` (receiver capacity for a reviewed MOVE) and
 * `teaching-load-automation.service.ts` (auto-fill capacity gate) MUST call
 * this function rather than re-deriving the cap.
 */
export function resolveRealFacultyCapMinutes(input: FacultyCapResolutionInput): number {
	const policyCeiling = input.mode === 'REAL_FACULTY_STANDARD'
		? input.policyStandardMinutes
		: input.policyHardCapMinutes;
	const rawCap = Math.min(Math.max(0, Math.round(input.maxHoursPerWeek * 60)), policyCeiling);
	const nonTeachingMinutes = Math.max(0, Math.round(input.nonTeachingMinutes ?? 0));
	if (nonTeachingMinutes > 0) {
		return Math.max(0, rawCap - nonTeachingMinutes);
	}
	return rawCap;
}

export interface EffectiveWeeklyCapInput {
	/** Raw `FacultyMirror.maxHoursPerWeek`. */
	maxHoursPerWeek: number;
	/** Raw `FacultyMirror.ancillaryMinutesPerWeek` (HR-synced). */
	ancillaryMinutesPerWeek?: number | null;
	/**
	 * When true (the generator's path) the cap is floored to whole hours,
	 * reproducing `generation-preflight.service.ts`'s existing
	 * `Math.floor(minutes / 60) * 60` projection byte-for-byte.
	 */
	floorToWholeHours?: boolean;
}

/** The one applicable weekly teaching cap for a teacher. Minutes. */
export function effectiveWeeklyCapMinutes(input: EffectiveWeeklyCapInput): number {
	const minutes = computeEffectiveWeeklyTeachingMinutes(input.maxHoursPerWeek, input.ancillaryMinutesPerWeek);
	return input.floorToWholeHours === true ? Math.floor(minutes / 60) * 60 : minutes;
}

export interface WeeklyLoadEvaluation {
	/** The teacher's concurrent weekly teaching minutes (term-peak rollup). */
	teachingMinutes: number;
	/** The applicable weekly cap produced by the ONE rule. */
	capMinutes: number;
	/** Minutes over the applicable cap; never negative. */
	overMinutes: number;
	/** `teachingMinutes > capMinutes` — the shared over-limit predicate. */
	isOverLimit: boolean;
}

/**
 * The single over-limit evaluation. `teachingMinutes` must already be the
 * canonical concurrent weekly teaching minutes for the teacher (raw placed
 * minutes with the term-peak rotation rollup), which is what both the
 * generator's validator and the Teaching Load truth panel compute.
 *
 * The whole-hour projection is ON by default so that this function reproduces
 * the generator's existing cap exactly. That is what makes "Teaching Load and
 * generation agree on who is over limit" achievable without moving the
 * generator's HARD `FACULTY_OVERLOAD` count: both surfaces now read the same
 * cap instead of the generator reading a floored cap and the truth panel
 * reading an unfloored one.
 */
export function evaluateWeeklyLoad(
	teachingMinutes: number,
	cap: EffectiveWeeklyCapInput,
): WeeklyLoadEvaluation {
	const teaching = Math.max(0, Math.round(teachingMinutes));
	const capMinutes = effectiveWeeklyCapMinutes({ floorToWholeHours: true, ...cap });
	return {
		teachingMinutes: teaching,
		capMinutes,
		overMinutes: Math.max(0, teaching - capMinutes),
		isOverLimit: teaching > capMinutes,
	};
}
