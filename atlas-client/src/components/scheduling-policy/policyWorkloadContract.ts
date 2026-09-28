/**
 * A8 TL-SHORTAGE-C02 item 6 — the WORKLOAD contract carried by a
 * scheduling-policy pane save.
 *
 * LIVE DEFECT THIS CLOSES: `PUT /policies/scheduling/:schoolId/:schoolYearId`
 * upserts the policy row from the request body, and the server's
 * `requirePositiveInt` falls back to `POLICY_DEFAULTS` for any field the body
 * omits. `LocalPolicy` had no field for the three workload values, so saving ANY
 * scheduling-policy change from the pane silently reset
 * `teachingStandardMinutes`, `advisoryCreditMinutes` and `hardCapMinutes` to
 * 1800 / 300 / 2400 — for a school that had deliberately set different values, an
 * unrelated save rewrote its entire Teaching Load contract.
 *
 * This module holds the contract and the payload builder and imports NOTHING at
 * runtime (the `LocalPolicy` import is type-only), so the save body is testable
 * without loading the pane's component graph. `policyPaneModel.ts` re-exports it.
 *
 * The server remains authoritative and its validation is unchanged:
 *   teachingStandardMinutes  integer 600..4800
 *   advisoryCreditMinutes    integer 0..1200
 *   hardCapMinutes           integer 600..6000, and >= teachingStandardMinutes
 */

/** Mirrors the server's `POLICY_DEFAULTS`; a server default change is visible here. */
export const LOCAL_POLICY_WORKLOAD_DEFAULTS = {
	teachingStandardMinutes: 1800,
	advisoryCreditMinutes: 300,
	hardCapMinutes: 2400,
} as const;

/** The server's accepted range for each workload field, documented, not enforced here. */
export const LOCAL_POLICY_WORKLOAD_RANGES = {
	teachingStandardMinutes: { min: 600, max: 4800 },
	advisoryCreditMinutes: { min: 0, max: 1200 },
	hardCapMinutes: { min: 600, max: 6000 },
} as const;

export interface PolicyWorkloadMinutes {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
}

/**
 * A policy response read through the narrow augmentation `policyToLocal` uses:
 * the shared `SchedulingPolicy` client type is owned elsewhere, so a missing or
 * NULL column is a real case the pane must tolerate.
 */
export type PolicyWorkloadSource = {
	[K in keyof PolicyWorkloadMinutes]?: PolicyWorkloadMinutes[K] | null;
};

// Type-only: erased at runtime, so this module has no import graph.
import type { LocalPolicy } from './policyPaneModel.js';
export type { LocalPolicy };

/**
 * The exact body sent to `PUT /policies/scheduling/:schoolId/:schoolYearId`.
 *
 * Every `LocalPolicy` field is carried, INCLUDING the three workload values, so
 * a pane save can no longer reset a school's Teaching Load contract by omission.
 * The one behaviour preserved from the previous inline payload is the mirror of
 * `enableLunchWindow` onto the server's `enforceLunchWindow` column.
 */
export function buildPolicySavePayload(local: LocalPolicy): Record<string, unknown> {
	return {
		...local,
		enableLunchWindow: local.enableLunchWindow,
		enforceLunchWindow: local.enableLunchWindow,
		teachingStandardMinutes: local.teachingStandardMinutes,
		advisoryCreditMinutes: local.advisoryCreditMinutes,
		hardCapMinutes: local.hardCapMinutes,
	};
}

/** Read the workload contract off a pane draft, or the defaults when it is absent. */
export function workloadMinutesOf(
	source: PolicyWorkloadSource | null | undefined,
): PolicyWorkloadMinutes {
	return {
		teachingStandardMinutes: source?.teachingStandardMinutes ?? LOCAL_POLICY_WORKLOAD_DEFAULTS.teachingStandardMinutes,
		advisoryCreditMinutes: source?.advisoryCreditMinutes ?? LOCAL_POLICY_WORKLOAD_DEFAULTS.advisoryCreditMinutes,
		hardCapMinutes: source?.hardCapMinutes ?? LOCAL_POLICY_WORKLOAD_DEFAULTS.hardCapMinutes,
	};
}
