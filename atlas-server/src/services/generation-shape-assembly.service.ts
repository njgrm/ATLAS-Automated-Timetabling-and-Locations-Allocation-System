/**
 * GEN-C02 — Shared read-only generation shape assembly.
 *
 * These pure helpers are consumed by BOTH the real generation trigger
 * (`generation.service.ts`) and the read-only canonical readiness/diagnostic
 * (`generation-readiness.service.ts`) so the dry run resolves the exact same
 * timetable shape contracts and grade/program normalization as a real run.
 * Zero database access, zero writes.
 */

import { resolveSectionGradeLevel } from './grade-level-resolver.js';
import { buildTimetableShapeContract, type ConstructorInput, type TimetableShapeContract } from './schedule-constructor.js';

export function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').toUpperCase();
}

// Grade resolution has one implementation: `grade-level-resolver.ts` (name first).
export { legacyGradeFromInternalId as normalizeInternalGradeId } from './grade-level-resolver.js';

export function buildRunTimetableShapeContracts(input: {
	sectionsByGrade: Array<{ gradeLevelId: number; gradeLevelName?: string | null; sections: Array<{ programType?: string | null }> }>;
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
		// The EnrollPro grade NAME is authoritative; the internal id is re-minted on
		// every EnrollPro rollover and is only a legacy fallback.
		const normalizedGradeLevel = resolveSectionGradeLevel(grade);
		const programTypes = new Set<string>(['REGULAR']);
		for (const section of grade.sections) {
			programTypes.add(normalizeProgramType(section.programType));
		}

		for (const programType of programTypes) {
			const canonicalRows = input.canonicalSlots?.get(`${normalizedGradeLevel}:${programType}`);
			// GEN-C02R Correction 6: `GradeShiftWindow.gradeLevel` is already an
			// actual grade (7–10). It must NOT be passed through the internal-ID
			// normalizer (which maps 7→9 / 8→10). Only `SectionMirror.gradeLevelId`
			// (an EnrollPro internal ID) uses that mapping.
			const window = input.gradeWindows.find((row) => row.gradeLevel === normalizedGradeLevel && normalizeProgramType(row.programType) === programType)
				?? input.gradeWindows.find((row) => row.gradeLevel === normalizedGradeLevel && normalizeProgramType(row.programType) === 'ALL');
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
