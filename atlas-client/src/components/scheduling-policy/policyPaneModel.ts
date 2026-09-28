/**
 * Scheduling policy pane — pure model helpers.
 *
 * Extracted from `SchedulingPolicyPane.tsx` to keep the component inside the
 * AGENTS.md §8 1000-physical-line cap. Pure extraction: no control, copy, prop
 * or behaviour change.
 */

import type { ConstraintOverride, GradeShiftWindow, SectionSummaryResponse } from '@/types';
import {
	DEFAULT_PROGRAM_WINDOW_OPTIONS,
	type ProgramWindowOption,
} from '@/components/scheduling-policy/SchedulingPolicyDialogs';
import {
	DEFAULT_GRADE_WINDOWS,
	GRADE_LEVELS,
	type LocalGradeWindow,
} from '@/components/scheduling-policy/schedulingPolicyWindowModel';

// A8 TL-SHORTAGE-C02 item 6 — the workload contract and the save-payload builder
// live in their own dependency-free module so the pane's save body is testable
// without loading the component graph. Re-exported here so the pane keeps one
// import surface.
export {
	LOCAL_POLICY_WORKLOAD_DEFAULTS,
	LOCAL_POLICY_WORKLOAD_RANGES,
	buildPolicySavePayload,
	workloadMinutesOf,
	type PolicyWorkloadMinutes,
} from '@/components/scheduling-policy/policyWorkloadContract';

/**
 * A8 TL-SHORTAGE-C02 item 6 — the three WORKLOAD values.
 *
 * `PUT /policies/scheduling/:schoolId/:schoolYearId` upserts the policy row from
 * the request body, and the server's `requirePositiveInt` falls back to
 * `POLICY_DEFAULTS` for any field the body omits. The pane model had no field
 * for these three, so saving ANY scheduling-policy change from the pane silently
 * reset `teachingStandardMinutes`, `advisoryCreditMinutes` and `hardCapMinutes`
 * to the defaults — for a school that had deliberately set different values, an
 * unrelated save rewrote its entire Teaching Load contract. The defaults and the
 * save-payload builder therefore live in `policyWorkloadContract.ts` (re-exported
 * above) and these three fields are carried into the payload.
 */
export interface LocalPolicy {
	teacherMoveEnabled: boolean;
	periodLengthMinutes: number;
	periodsPerDay: number;
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard: boolean;
	enableTravelWellbeingChecks: boolean;
	maxWalkingDistanceMetersPerTransition: number;
	maxBuildingTransitionsPerDay: number;
	maxBackToBackTransitionsWithoutBuffer: number;
	maxIdleGapMinutesPerDay: number;
	avoidEarlyFirstPeriod: boolean;
	avoidLateLastPeriod: boolean;
	enableVacantAwareConstraints: boolean;
	targetFacultyDailyVacantMinutes: number;
	targetSectionDailyVacantPeriods: number;
	maxCompressedTeachingMinutesPerDay: number;
	lunchStartTime: string;
	lunchEndTime: string;
	enforceLunchWindow: boolean;
	showSpecialEventsInGrid: boolean;
	enableFlagCeremony: boolean;
	flagCeremonyStartTime: string;
	flagCeremonyEndTime: string;
	enableRecess: boolean;
	recessStartTime: string;
	recessEndTime: string;
	enableLunchWindow: boolean;
	enableTeacherLunchWindow: boolean;
	enforceTeacherLunchWindow: boolean;
	enableShiftCoherenceGuard: boolean;
	enforceShiftCoherenceGuard: boolean;
	enableTleTwoPassPriority: boolean;
	allowFlexibleSubjectAssignment: boolean;
	allowConsecutiveLabSessions: boolean;
	constraintConfig: Record<string, ConstraintOverride>;
}

/** The pane's typed setter for one `LocalPolicy` field. */
export type UpdateLocalPolicy = <K extends keyof LocalPolicy>(key: K, value: LocalPolicy[K]) => void;

export function toProgramOptionsFromSections(summary: SectionSummaryResponse | null): ProgramWindowOption[] {
	if (!summary) return DEFAULT_PROGRAM_WINDOW_OPTIONS;
	const sections = summary.sections ?? [];
	const availablePrograms = [...new Set(sections
		.map((section) => section.programType)
		.filter((programType): programType is NonNullable<typeof programType> => Boolean(programType)))];

	if (availablePrograms.length === 0) return DEFAULT_PROGRAM_WINDOW_OPTIONS;

	const labels: Record<string, string> = {
		REGULAR: 'Regular',
		STE: 'STE',
		SPS: 'SPS',
		SPA: 'SPA',
		SPJ: 'SPJ',
		SPFL: 'SPFL',
		SPTVE: 'SPTVE',
		OTHER: 'Other',
	};

	return [
		{ value: 'ALL', label: 'All Programs' },
		...availablePrograms
			.sort((left, right) => left.localeCompare(right))
			.map((programType) => ({ value: programType, label: labels[programType] ?? programType })) as ProgramWindowOption[],
	];
}

export function buildProgramContextNote(summary: SectionSummaryResponse | null): string {
	if (!summary) {
		return 'Program choices are based on the sections set up for this school year. You can use All Programs until you have reviewed the section list.';
	}
	const sections = summary.sections ?? [];
	const programs = [...new Set(sections
		.map((section) => section.programType)
		.filter((programType): programType is NonNullable<typeof programType> => Boolean(programType)))];
	const sectionsWithTleFocus = sections.some((section) => Boolean(section.tleSpecialization && section.tleSpecialization.trim().length > 0));
	const labels: Record<string, string> = {
		REGULAR: 'Regular', STE: 'Science, Technology and Engineering', SPS: 'Special Program in Sports',
		SPA: 'Special Program in the Arts', SPJ: 'Special Program in Journalism',
		SPFL: 'Special Program in Foreign Language', SPTVE: 'Technical-Vocational Education', OTHER: 'Other',
	};
	const programCopy = programs.map((program) => labels[program] ?? 'Other').join(', ') || 'All Programs';

	return `Program choices reflect the school's current sections: ${programCopy}.${sectionsWithTleFocus ? ' Some sections also have a Technology and Livelihood Education focus.' : ''}`;
}

export function toLocalGradeWindows(windows: GradeShiftWindow[]): LocalGradeWindow[] {
	const byKey = new Map<string, LocalGradeWindow>(DEFAULT_GRADE_WINDOWS.map((window) => [`${window.gradeLevel}:ALL`, window]));
	for (const window of windows) {
		if (!GRADE_LEVELS.includes(window.gradeLevel)) continue;
		const key = `${window.gradeLevel}:${window.programType ?? 'ALL'}`;
		byKey.set(key, {
			gradeLevel: window.gradeLevel,
			programType: (window.programType ?? null) as LocalGradeWindow['programType'],
			startTime: window.startTime,
			endTime: window.endTime,
		});
	}
	return [...byKey.values()].sort((left, right) => left.gradeLevel - right.gradeLevel || String(left.programType ?? 'ALL').localeCompare(String(right.programType ?? 'ALL')));
}

export function deepEqual(a: unknown, b: unknown) {
	return JSON.stringify(a) === JSON.stringify(b);
}
