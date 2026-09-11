/**
 * GEN-C02 — Shared read-only generation shape assembly.
 *
 * These pure helpers are consumed by BOTH the real generation trigger
 * (`generation.service.ts`) and the read-only canonical readiness/diagnostic
 * (`generation-readiness.service.ts`) so the dry run resolves the exact same
 * timetable shape contracts and grade/program normalization as a real run.
 * Zero database access, zero writes.
 */

import { buildTimetableShapeContract, type ConstructorInput, type TimetableShapeContract } from './schedule-constructor.js';

export function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').toUpperCase();
}

/**
 * Normalize EnrollPro internal grade_level_id to actual grade number.
 * Unlike normalizeGradeLevel, this ALWAYS maps known internal IDs (5-8 and the
 * current 17-20 feed IDs) to actual grades (7-10).
 */
export function normalizeInternalGradeId(value: number): number {
	const ENROLLPRO_MAPPINGS: Record<number, number> = {
		5: 7,
		6: 8,
		7: 9,
		8: 10,
		17: 7,
		18: 8,
		19: 9,
		20: 10,
	};

	if (value in ENROLLPRO_MAPPINGS) return ENROLLPRO_MAPPINGS[value];
	if (value >= 7 && value <= 10) return value;
	if (value >= 100) {
		const normalized = value % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}
	return value;
}

export function buildRunTimetableShapeContracts(input: {
	sectionsByGrade: Array<{ gradeLevelId: number; sections: Array<{ programType?: string | null }> }>;
	gradeWindows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>;
	templateProfiles: Array<{ programType: string; periodLengthMinutes: number; periodsPerDay: number }>;
	policy: ConstructorInput['policy'];
	canonicalSlots?: Map<string, Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>>;
}): TimetableShapeContract[] {
	const templateByProgram = new Map(input.templateProfiles.map((profile) => [normalizeProgramType(profile.programType), profile]));
	const regularTemplate = templateByProgram.get('REGULAR') ?? { programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 10 };
	const policyPeriodLengthMinutes = input.policy && 'periodLengthMinutes' in input.policy
		? (input.policy as { periodLengthMinutes?: number }).periodLengthMinutes
		: undefined;
	const policyPeriodsPerDay = input.policy && 'periodsPerDay' in input.policy
		? (input.policy as { periodsPerDay?: number }).periodsPerDay
		: undefined;
	const effectivePeriodLengthMinutes = policyPeriodLengthMinutes && policyPeriodLengthMinutes > 0
		? policyPeriodLengthMinutes
		: 45;
	const effectivePeriodsPerDay = policyPeriodsPerDay && policyPeriodsPerDay > 0
		? policyPeriodsPerDay
		: 10;

	const contracts: TimetableShapeContract[] = [];
	for (const grade of input.sectionsByGrade) {
		// gradeLevelId is an internal EnrollPro ID, normalize to actual grade number
		const normalizedGradeLevel = normalizeInternalGradeId(grade.gradeLevelId);
		const programTypes = new Set<string>(['REGULAR']);
		for (const section of grade.sections) {
			programTypes.add(normalizeProgramType(section.programType));
		}

		for (const programType of programTypes) {
			const canonicalRows = input.canonicalSlots?.get(`${normalizedGradeLevel}:${programType}`);
			const window = input.gradeWindows.find((row) => normalizeInternalGradeId(row.gradeLevel) === normalizedGradeLevel && normalizeProgramType(row.programType) === programType)
				?? input.gradeWindows.find((row) => normalizeInternalGradeId(row.gradeLevel) === normalizedGradeLevel && normalizeProgramType(row.programType) === 'ALL');
			const template = templateByProgram.get(programType) ?? regularTemplate;
			const canonicalClassRows = canonicalRows?.filter((row) => row.rowKind === 'CLASS') ?? [];
			const periodLengthMinutes = canonicalClassRows.length > 0 ? 45 : (effectivePeriodLengthMinutes || template.periodLengthMinutes);
			const periodsPerDay = canonicalClassRows.length > 0 ? canonicalClassRows.length : (effectivePeriodsPerDay || template.periodsPerDay);
			contracts.push(buildTimetableShapeContract({
				gradeLevel: normalizedGradeLevel,
				programType,
				startTime: canonicalRows?.[0]?.startTime ?? window?.startTime ?? input.policy?.earliestStartTime ?? '07:00',
				endTime: canonicalRows?.[canonicalRows.length - 1]?.endTime ?? window?.endTime ?? input.policy?.latestEndTime ?? '17:00',
				periodLengthMinutes,
				periodsPerDay,
				basePolicy: input.policy,
				canonicalSlots: canonicalRows,
			}));
		}
	}

	return contracts;
}
