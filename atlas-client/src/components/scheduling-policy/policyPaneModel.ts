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

export interface LocalPolicy {
	teacherMoveEnabled: boolean;
	periodLengthMinutes: number;
	periodsPerDay: number;
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
		return 'Program-aware windows use EnrollPro program ownership. TLE specialization ownership is also upstream-managed and synchronized into ATLAS when available.';
	}
	const sections = summary.sections ?? [];
	const programs = [...new Set(sections
		.map((section) => section.programType)
		.filter((programType): programType is NonNullable<typeof programType> => Boolean(programType)))];
	const sectionsWithTleSpecialization = sections.filter((section) => Boolean(section.tleSpecialization && section.tleSpecialization.trim().length > 0));

	if (sectionsWithTleSpecialization.length > 0) {
		return `Program options are sourced from EnrollPro sections (${programs.join(', ') || 'REGULAR'}). ${sectionsWithTleSpecialization.length} section(s) currently include EnrollPro TLE specialization ownership.`;
	}

	return `Program options are sourced from EnrollPro sections (${programs.join(', ') || 'REGULAR'}). No section-level TLE specialization ownership is currently present in this school-year feed.`;
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
