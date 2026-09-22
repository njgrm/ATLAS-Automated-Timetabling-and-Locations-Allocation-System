/**
 * Scheduling policy window model.
 *
 * Extracted verbatim from `SchedulingPolicyPane.tsx` during the
 * TIMETABLE-RELAXED-MAIN-C01 correction so that React component stays inside
 * the 1000-physical-line cap (AGENTS.md §8). These are the pane's pure
 * grade/shift-window helpers: they render no DOM and their bodies are moved
 * unchanged, so behaviour is identical.
 */

export type LocalGradeWindow = {
	gradeLevel: number;
	programType?: 'REGULAR' | 'STE' | 'SPS' | 'SPA' | 'SPJ' | 'SPFL' | 'SPTVE' | 'OTHER' | null;
	startTime: string;
	endTime: string;
};

export const GRADE_LEVELS: number[] = [7, 8, 9, 10];

export const DEFAULT_GRADE_WINDOWS: LocalGradeWindow[] = [
	{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 8, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 9, programType: null, startTime: '07:30', endTime: '17:00' },
	{ gradeLevel: 10, programType: null, startTime: '07:30', endTime: '17:00' },
];

export function createInitialOverride(): LocalGradeWindow {
	return {
		gradeLevel: GRADE_LEVELS[0],
		programType: null,
		startTime: '07:30',
		endTime: '17:00',
	};
}

export function getPresetWindowRange(mode: 'FULL_DAY' | 'HALF_DAY', gradeLevel: number): { startTime: string; endTime: string } {
	if (mode === 'HALF_DAY') {
		if (gradeLevel <= 8) {
			return { startTime: '06:00', endTime: '12:00' };
		}
		return { startTime: '12:00', endTime: '18:00' };
	}

	return { startTime: '07:30', endTime: '17:00' };
}
