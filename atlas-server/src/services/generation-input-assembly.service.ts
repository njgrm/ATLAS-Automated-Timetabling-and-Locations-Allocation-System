/**
 * Generation input assembly (GEN-C01).
 *
 * Single read-only assembly used by BOTH the live generation trigger and the
 * canonical read-only diagnostic. It fetches the authoritative persisted
 * inputs for (schoolId, schoolYearId) and builds the exact `ConstructorInput`
 * the scheduling core consumes, so the diagnostic is a faithful dry-run of the
 * live generator without ever reaching persistence.
 *
 * This module NEVER writes. Mutations that the live trigger performs before
 * assembly (section sync, policy ensure, grade-window bootstrap, canonical
 * template seeding, placeholder repair) are explicitly NOT part of this
 * module; the diagnostic reads whatever is currently persisted and reports
 * gaps instead of creating them.
 */

import { getDataContext } from '../lib/data-context.js';
import {
	buildSectionRosterIndex,
	normalizeStoredAssignmentScope,
	type SectionRosterIndex,
} from './faculty-assignment-scope.service.js';
import { getTemplatePeriodProfiles } from './class-template.service.js';
import {
	resolveClassProgramSlots,
	normalizeInternalGradeId,
	KNOWN_PROGRAM_TYPES,
	type ResolvedSlotRow,
} from './class-program-slot.service.js';
import type { SectionsByGrade } from './section-adapter.js';
import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import {
	computeDemand,
	buildTimetableShapeContract,
	type ConstructorInput,
	type DemandItem,
	type FacultySubjectInput,
	type InstructionalCohortInput,
	type PolicyInput,
	type RoomInput,
	type SubjectInput,
	type TimetableShapeContract,
} from './schedule-constructor.js';
import type { ScheduledEntry, ValidatorContext } from './constraint-validator.js';

const db = () => getDataContext();

export const ENABLE_LEGACY_TIME_PREFERENCES = process.env.ATLAS_ENABLE_LEGACY_TIME_PREFERENCES === 'true';
export { normalizeInternalGradeId } from './class-program-slot.service.js';

export function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').toUpperCase();
}

export type CanonicalSlotRow = {
	startTime: string;
	endTime: string;
	subjectFamily: string | null;
	subjectLabel?: string | null;
	rowKind: string;
};

export interface GradeWindowLike {
	gradeLevel: number;
	programType?: string | null;
	startTime: string;
	endTime: string;
}

export interface PolicyRecordLike {
	id: number;
	periodLengthMinutes?: number | null;
	periodsPerDay?: number | null;
	maxConsecutiveTeachingMinutesBeforeBreak: number;
	minBreakMinutesAfterConsecutiveBlock: number;
	maxTeachingMinutesPerDay: number;
	earliestStartTime: string;
	latestEndTime: string;
	enforceConsecutiveBreakAsHard?: boolean | null;
	enableTravelWellbeingChecks?: boolean | null;
	maxWalkingDistanceMetersPerTransition?: number | null;
	maxBuildingTransitionsPerDay?: number | null;
	maxBackToBackTransitionsWithoutBuffer?: number | null;
	maxIdleGapMinutesPerDay?: number | null;
	avoidEarlyFirstPeriod?: boolean | null;
	avoidLateLastPeriod?: boolean | null;
	enableVacantAwareConstraints?: boolean | null;
	targetFacultyDailyVacantMinutes?: number | null;
	targetSectionDailyVacantPeriods?: number | null;
	maxCompressedTeachingMinutesPerDay?: number | null;
	lunchStartTime?: string | null;
	lunchEndTime?: string | null;
	enableLunchWindow?: boolean | null;
	enforceLunchWindow?: boolean | null;
	showSpecialEventsInGrid?: boolean | null;
	enableFlagCeremony?: boolean | null;
	flagCeremonyStartTime?: string | null;
	flagCeremonyEndTime?: string | null;
	enableRecess?: boolean | null;
	recessStartTime?: string | null;
	recessEndTime?: string | null;
	enableTleTwoPassPriority?: boolean | null;
	allowFlexibleSubjectAssignment?: boolean | null;
	allowConsecutiveLabSessions?: boolean | null;
	constraintConfig?: unknown;
}

export interface SpecialEventLike {
	eventType: string;
	label: string;
	startTime: string;
	endTime: string;
	gradeGroup?: string | null;
	programType?: string | null;
}

export interface FacultySubjectRowLike {
	facultyId: number;
	subjectId: number;
	gradeLevels?: number[] | null;
	sectionIds?: number[] | null;
}

export interface SectionsByGradeResult {
	sectionsByGrade: SectionsByGrade[];
	totalSections: number;
	totalEnrolled: number;
	sectionsMissing: boolean;
}

export interface GenerationInputAssemblyOptions {
	roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
	enforceShiftWindows?: boolean;
	/** Inject the persisted policy row when the caller already holds it (live trigger). */
	policyRecord?: PolicyRecordLike | null;
	/** Inject grade windows when the caller already loaded them (live trigger). */
	gradeWindows?: GradeWindowLike[];
	lockedEntries?: ConstructorInput['lockedEntries'];
	/** Inject canonical class-program slots when the caller seeded them (live trigger). */
	canonicalSlotsByGradeProgram?: Map<string, CanonicalSlotRow[]>;
	/** Read-only mode: never sync sections, never create policy, never seed. */
	readOnly?: boolean;
}

export interface GenerationInputAssembly {
	schoolId: number;
	schoolYearId: number;
	sectionsByGrade: SectionsByGrade[];
	totalSections: number;
	totalEnrolled: number;
	sectionsMissing: boolean;
	rosterIndex: SectionRosterIndex;
	faculty: NonNullable<ConstructorInput['faculty']>;
	facultySubjects: FacultySubjectInput[];
	facultySubjectRows: FacultySubjectRowLike[];
	rooms: RoomInput[];
	subjects: SubjectInput[];
	preferences: NonNullable<ConstructorInput['preferences']>;
	policyRecord: PolicyRecordLike | null;
	policyMissing: boolean;
	buildings: Array<{ id: number; name: string }>;
	buildingsRaw: Array<{ id: number; x: number; y: number }>;
	gradeWindows: GradeWindowLike[];
	specialEvents: SpecialEventLike[];
	cohorts: InstructionalCohortInput[];
	classTemplatePeriods: Record<string, number>;
	timetableShapes: TimetableShapeContract[];
	canonicalSlotsByGradeProgram: Map<string, CanonicalSlotRow[]>;
	demand: DemandItem[];
	constructorInput: ConstructorInput;
}

function buildSectionsByGrade(
	schoolId: number,
	schoolYearId: number,
	mirrors: Array<{
		id: number;
		externalId: number;
		name: string;
		maxCapacity: number;
		enrolledCount: number;
		gradeLevelId: number;
		gradeLevelName: string;
		displayOrder: number;
		homeRoomId: number | null;
		buildingZoneId: string | null;
		programType: string | null;
		programCode: string | null;
		programName: string | null;
		isSpecialProgram: boolean;
		tleProgramId: number | null;
		tleSpecialization: string | null;
		tleProgramCategory: string | null;
	}>,
): SectionsByGradeResult {
	const glMap = new Map<number, SectionsByGrade>();
	for (const m of mirrors) {
		let grade = glMap.get(m.gradeLevelId);
		if (!grade) {
			grade = {
				gradeLevelId: m.gradeLevelId,
				gradeLevelName: m.gradeLevelName,
				displayOrder: m.displayOrder,
				sections: [],
			};
			glMap.set(m.gradeLevelId, grade);
		}
		grade.sections.push({
			mirrorId: m.id,
			id: m.externalId,
			name: m.name,
			maxCapacity: m.maxCapacity,
			enrolledCount: m.enrolledCount,
			gradeLevelId: m.gradeLevelId,
			gradeLevelName: m.gradeLevelName,
			displayOrder: m.displayOrder,
			homeRoomId: m.homeRoomId,
			buildingZoneId: m.buildingZoneId,
			programType: m.programType as never,
			programCode: m.programCode,
			programName: m.programName,
			isSpecialProgram: m.isSpecialProgram,
			tleProgramId: m.tleProgramId,
			tleSpecialization: m.tleSpecialization,
			tleProgramCategory: m.tleProgramCategory,
		});
	}
	const sectionsByGrade = Array.from(glMap.values()).sort((a, b) => a.displayOrder - b.displayOrder);
	const totalEnrolled = mirrors.reduce((sum, m) => sum + m.enrolledCount, 0);
	return {
		sectionsByGrade,
		totalSections: mirrors.length,
		totalEnrolled,
		sectionsMissing: mirrors.length === 0,
	};
}

async function resolveCanonicalSlotsReadOnly(
	schoolId: number,
	schoolYearId: number,
	sectionsByGrade: SectionsByGrade[],
): Promise<Map<string, CanonicalSlotRow[]>> {
	const canonicalSlotsByGradeProgram = new Map<string, CanonicalSlotRow[]>();
	for (const grade of sectionsByGrade) {
		const actualGradeNumber = normalizeInternalGradeId(grade.gradeLevelId);
		const programTypes = new Set<string>(['REGULAR']);
		for (const section of grade.sections) {
			programTypes.add(normalizeProgramType(section.programType));
		}
		for (const programType of programTypes) {
			const allSlots: ResolvedSlotRow[] = await resolveClassProgramSlots(schoolId, schoolYearId, actualGradeNumber, programType as never);
			const key = `${actualGradeNumber}:${programType}`;
			if (allSlots.length > 0) {
				canonicalSlotsByGradeProgram.set(key, allSlots.map((s) => ({
					startTime: s.startTime,
					endTime: s.endTime,
					subjectFamily: s.subjectFamily,
					subjectLabel: s.subjectLabel,
					rowKind: s.rowKind,
				})));
			}
		}
	}
	return canonicalSlotsByGradeProgram;
}

export function buildRunTimetableShapeContracts(input: {
	sectionsByGrade: Array<{ gradeLevelId: number; sections: Array<{ programType?: string | null }> }>;
	gradeWindows: GradeWindowLike[];
	templateProfiles: Array<{ programType: string; periodLengthMinutes: number; periodsPerDay: number }>;
	policy: PolicyInput | undefined;
	canonicalSlots?: Map<string, CanonicalSlotRow[]>;
}): TimetableShapeContract[] {
	const templateByProgram = new Map(input.templateProfiles.map((profile) => [normalizeProgramType(profile.programType), profile]));
	const regularTemplate = templateByProgram.get('REGULAR') ?? { programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 10 };
	const policyPeriodLengthMinutes = input.policy?.periodLengthMinutes;
	const policyPeriodsPerDay = input.policy?.periodsPerDay;
	const effectivePeriodLengthMinutes = policyPeriodLengthMinutes && policyPeriodLengthMinutes > 0
		? policyPeriodLengthMinutes
		: 45;
	const effectivePeriodsPerDay = policyPeriodsPerDay && policyPeriodsPerDay > 0
		? policyPeriodsPerDay
		: 10;

	const contracts: TimetableShapeContract[] = [];
	for (const grade of input.sectionsByGrade) {
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

/**
 * Assemble the authoritative persisted inputs for (schoolId, schoolYearId) and
 * build the exact constructor input the hybrid scheduler consumes.
 *
 * Read-only by design: never syncs sections, never creates a policy row, never
 * seeds canonical slots or grade windows. Callers that already performed those
 * mutations (the live trigger) inject their results via `options`.
 */
export async function assembleGenerationInputs(
	schoolId: number,
	schoolYearId: number,
	options: GenerationInputAssemblyOptions = {},
): Promise<GenerationInputAssembly> {
	const enforceShiftWindows = options.enforceShiftWindows === true;

	const sectionMirrors = await db().sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
	});
	const sectionsByGradeResult = buildSectionsByGrade(schoolId, schoolYearId, sectionMirrors);
	const sectionsByGrade = sectionsByGradeResult.sectionsByGrade;

	const [
		faculty,
		facultySubjectRows,
		rooms,
		subjects,
		preferenceRows,
		policyRecord,
		buildings,
		gradeWindowRows,
		specialEvents,
		cohorts,
		templateProfiles,
	] = await Promise.all([
		db().facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true, isStale: false },
			select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, department: true },
		}),
		db().facultySubject.findMany({
			where: { schoolId, schoolYearId },
			select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
		}),
		db().room.findMany({
			where: {
				isTeachingSpace: true,
				building: { schoolId, isTeachingBuilding: true },
			},
			select: { id: true, type: true, isTeachingSpace: true, isSharedFacility: true, capacity: true, buildingId: true, buildingZoneId: true, building: { select: { gradeScope: true } } },
		}),
		db().subject.findMany({
			where: { schoolId, isActive: true },
			select: {
				id: true,
				code: true,
				name: true,
				ownerDepartment: true,
				qualificationPriority: true,
				minMinutesPerWeek: true,
				preferredRoomType: true,
				gradeLevels: true,
				interSectionEnabled: true,
				interSectionGradeLevels: true,
				programScopes: true,
				allowedSpecializations: true,
				requiredFeatures: true,
				modularGroupId: true,
				modularOrder: true,
			},
		}),
		db().facultyPreference.findMany({
			where: { schoolId, schoolYearId },
			select: {
				facultyId: true,
				status: true,
				timeSlots: ENABLE_LEGACY_TIME_PREFERENCES
					? { select: { day: true, startTime: true, endTime: true, preference: true } }
					: false,
			},
		}),
		options.policyRecord !== undefined
			? Promise.resolve(options.policyRecord)
			: db().schedulingPolicy.findUnique({
				where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			}),
		db().building.findMany({
			where: { schoolId },
			select: { id: true, name: true, x: true, y: true },
		}),
		options.gradeWindows !== undefined
			? Promise.resolve(options.gradeWindows)
			: enforceShiftWindows
				? db().gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } })
				: Promise.resolve([]),
		db().policySpecialEvent.findMany({
			where: { schoolId, schoolYearId, enabled: true },
			orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }],
		}),
		db().instructionalCohort.findMany({
			where: { schoolId, schoolYearId, isActive: true },
			orderBy: [{ gradeLevel: 'asc' }, { cohortCode: 'asc' }],
			select: {
				cohortCode: true,
				specializationCode: true,
				specializationName: true,
				gradeLevel: true,
				memberSectionIds: true,
				expectedEnrollment: true,
				preferredRoomType: true,
			},
		}),
		getTemplatePeriodProfiles(schoolId),
	]);

	const roomsWithGradeScope: RoomInput[] = rooms.map((r) => ({
		...r,
		buildingGradeScope: r.building?.gradeScope ?? [],
	}));

	const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
	const activeFacultyIdSet = new Set(faculty.map((member) => member.id));
	const facultySubjects: FacultySubjectInput[] = facultySubjectRows
		.filter((assignment) => activeFacultyIdSet.has(assignment.facultyId))
		.map((assignment) => {
			const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
			return {
				facultyId: assignment.facultyId,
				subjectId: assignment.subjectId,
				gradeLevels: normalized.gradeLevels,
				sectionIds: normalized.sectionIds,
			};
		});

	const classTemplatePeriods: Record<string, number> = {};
	for (const tp of templateProfiles) {
		classTemplatePeriods[tp.programType] = tp.periodLengthMinutes;
	}

	const canonicalSlotsByGradeProgram = options.canonicalSlotsByGradeProgram ?? (await resolveCanonicalSlotsReadOnly(schoolId, schoolYearId, sectionsByGrade));

	const policy: PolicyInput | undefined = policyRecord
		? {
			periodLengthMinutes: policyRecord.periodLengthMinutes ?? undefined,
			periodsPerDay: policyRecord.periodsPerDay ?? undefined,
			maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
			minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
			maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
			earliestStartTime: policyRecord.earliestStartTime,
			latestEndTime: policyRecord.latestEndTime,
			lunchStartTime: policyRecord.lunchStartTime ?? undefined,
			lunchEndTime: policyRecord.lunchEndTime ?? undefined,
			enableLunchWindow: policyRecord.enableLunchWindow ?? undefined,
			enforceLunchWindow: policyRecord.enforceLunchWindow ?? undefined,
			showSpecialEventsInGrid: policyRecord.showSpecialEventsInGrid ?? undefined,
			enableFlagCeremony: policyRecord.enableFlagCeremony ?? undefined,
			flagCeremonyStartTime: policyRecord.flagCeremonyStartTime ?? undefined,
			flagCeremonyEndTime: policyRecord.flagCeremonyEndTime ?? undefined,
			enableRecess: policyRecord.enableRecess ?? undefined,
			recessStartTime: policyRecord.recessStartTime ?? undefined,
			recessEndTime: policyRecord.recessEndTime ?? undefined,
			enableTleTwoPassPriority: policyRecord.enableTleTwoPassPriority ?? true,
			allowFlexibleSubjectAssignment: policyRecord.allowFlexibleSubjectAssignment ?? false,
			allowConsecutiveLabSessions: policyRecord.allowConsecutiveLabSessions ?? false,
			specialEvents: specialEvents.map((se) => ({
				eventType: se.eventType,
				label: se.label,
				startTime: se.startTime,
				endTime: se.endTime,
				gradeGroup: se.gradeGroup,
				programType: se.programType,
			})),
		}
		: undefined;

	const gradeWindows = (options.gradeWindows !== undefined ? options.gradeWindows : gradeWindowRows as GradeWindowLike[])
		.map((gw) => ({ gradeLevel: gw.gradeLevel, programType: gw.programType ?? null, startTime: gw.startTime, endTime: gw.endTime }));

	const timetableShapes = buildRunTimetableShapeContracts({
		sectionsByGrade,
		gradeWindows,
		templateProfiles,
		policy,
		canonicalSlots: canonicalSlotsByGradeProgram,
	});

	const schedulableSubjects = subjects.filter((subject) => subject.code !== 'HG');
	const demand = computeDemand(sectionsByGrade, schedulableSubjects, cohorts as never, classTemplatePeriods);

	const facultyInput = faculty.map((member) => ({
		id: member.id,
		maxHoursPerWeek: Math.floor(
			computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60,
		),
		department: member.department,
	}));

	const constructorInput: ConstructorInput = {
		schoolId,
		schoolYearId,
		roomingStrategy: options.roomerStrategy ?? 'HOME_ROOM_FIRST',
		sectionsByGrade,
		subjects: schedulableSubjects as SubjectInput[],
		cohorts: cohorts as never,
		faculty: facultyInput,
		facultySubjects,
		rooms: roomsWithGradeScope,
		preferences: preferenceRows.map((p) => ({
			facultyId: p.facultyId,
			status: p.status,
			timeSlots: ENABLE_LEGACY_TIME_PREFERENCES && 'timeSlots' in p && Array.isArray(p.timeSlots) ? p.timeSlots.map((ts) => ({
				day: ts.day,
				startTime: ts.startTime,
				endTime: ts.endTime,
				preference: ts.preference,
			})) : [],
		})),
		policy,
		lockedEntries: options.lockedEntries,
		gradeWindows,
		buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
		classTemplatePeriods,
		timetableShapes,
	};

	return {
		schoolId,
		schoolYearId,
		sectionsByGrade,
		totalSections: sectionsByGradeResult.totalSections,
		totalEnrolled: sectionsByGradeResult.totalEnrolled,
		sectionsMissing: sectionsByGradeResult.sectionsMissing,
		rosterIndex,
		faculty: facultyInput,
		facultySubjects,
		facultySubjectRows,
		rooms: roomsWithGradeScope,
		subjects: schedulableSubjects as SubjectInput[],
		preferences: constructorInput.preferences!,
		policyRecord: policyRecord as PolicyRecordLike | null,
		policyMissing: !policyRecord,
		buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
		buildingsRaw: buildings.map((b) => ({ id: b.id, x: b.x, y: b.y })),
		gradeWindows,
		specialEvents: specialEvents as SpecialEventLike[],
		cohorts: cohorts as never,
		classTemplatePeriods,
		timetableShapes,
		canonicalSlotsByGradeProgram,
		demand,
		constructorInput,
	};
}

/**
 * Build the exact validator context the live generator passes to
 * `validateHardConstraints`. Shared so the diagnostic and the live run use the
 * same core validation inputs.
 */
export function buildGenerationValidatorContext(args: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	entries: ScheduledEntry[];
	assembly: GenerationInputAssembly;
	policyRecord: PolicyRecordLike;
	constraintConfig: Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }>;
}): ValidatorContext {
	const { assembly, policyRecord } = args;
	return {
		schoolId: args.schoolId,
		schoolYearId: args.schoolYearId,
		runId: args.runId,
		entries: args.entries,
		faculty: assembly.faculty,
		facultySubjects: assembly.facultySubjects,
		rooms: assembly.rooms,
		subjects: assembly.subjects,
		sectionEnrollment: new Map(
			assembly.sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount] as const)),
		),
		policy: {
			...assembly.constructorInput.policy!,
			maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
			enforceConsecutiveBreakAsHard: policyRecord.enforceConsecutiveBreakAsHard ?? false,
		},
		travelPolicy: {
			enableTravelWellbeingChecks: policyRecord.enableTravelWellbeingChecks ?? false,
			maxWalkingDistanceMetersPerTransition: policyRecord.maxWalkingDistanceMetersPerTransition ?? 0,
			maxBuildingTransitionsPerDay: policyRecord.maxBuildingTransitionsPerDay ?? 0,
			maxBackToBackTransitionsWithoutBuffer: policyRecord.maxBackToBackTransitionsWithoutBuffer ?? 0,
			maxIdleGapMinutesPerDay: policyRecord.maxIdleGapMinutesPerDay ?? 0,
			avoidEarlyFirstPeriod: policyRecord.avoidEarlyFirstPeriod ?? false,
			avoidLateLastPeriod: policyRecord.avoidLateLastPeriod ?? false,
		},
		vacantPolicy: {
			enableVacantAwareConstraints: policyRecord.enableVacantAwareConstraints ?? false,
			targetFacultyDailyVacantMinutes: policyRecord.targetFacultyDailyVacantMinutes ?? 0,
			targetSectionDailyVacantPeriods: policyRecord.targetSectionDailyVacantPeriods ?? 0,
			maxCompressedTeachingMinutesPerDay: policyRecord.maxCompressedTeachingMinutesPerDay ?? 0,
		},
		buildings: assembly.buildingsRaw,
		roomBuildings: assembly.rooms.map((r) => ({ roomId: r.id, buildingId: r.buildingId ?? 0 })),
		constraintConfig: args.constraintConfig,
	};
}