/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import type { GenerationRunStatus } from '@prisma/client';
import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
	type Violation,
} from './constraint-validator.js';
import {
	constructBaseline,
	computeDemand,
	buildTimetableShapeContract,
	type ConstructorInput,
	type DemandItem,
	type HomeRoomFallbackCause,
	type TimetableShapeContract,
	type UnassignedItem,
	type RoomAssignmentReason,
} from './schedule-constructor.js';
import { runHybridScheduler, type SeedQualitySummary, type RepairImpact } from './hybrid-scheduler.js';
import { getSectionSummary, syncSectionsFromExternal } from './section.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getTemplatePeriodProfiles, ensureDefaultTemplates, ensureTemplatesForProgramTypes } from './class-template.service.js';
import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import { reconcileSubjectContractFromUpstream } from './subject.service.js';
import { ensurePhase3GradeWindows } from './grade-window.service.js';
import { syncCohorts } from './cohort.service.js';
import { repairActiveSubjectCoverageWithPlaceholders, getActiveSubjectCoverageSummary } from './faculty-assignment.service.js';

// ─── Helpers ───

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

function err(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	e.actionHint = options?.actionHint;
	e.details = options?.details;
	return e;
}

function extractDraftFacultyIds(draftEntries: unknown): number[] {
	if (!Array.isArray(draftEntries)) return [];
	const facultyIds = draftEntries
		.map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? (entry as { facultyId?: unknown }).facultyId : undefined))
		.filter((facultyId): facultyId is number => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
	return [...new Set(facultyIds)];
}

function extractNoQualifiedSubjectIds(unassignedItems: unknown): number[] {
	if (!Array.isArray(unassignedItems)) return [];
	const subjectIds = new Set<number>();
	for (const item of unassignedItems) {
		if (typeof item !== 'object' || item == null) continue;
		const row = item as { reason?: unknown; subjectId?: unknown };
		if (row.reason !== 'NO_QUALIFIED_FACULTY') continue;
		if (typeof row.subjectId !== 'number' || !Number.isInteger(row.subjectId) || row.subjectId <= 0) continue;
		subjectIds.add(row.subjectId);
	}
	return [...subjectIds].sort((left, right) => left - right);
}

async function getActiveFacultyMirrorIdSet(schoolId: number): Promise<Set<number>> {
	const faculty = await prisma.facultyMirror.findMany({
		where: { schoolId, isActiveForScheduling: true, isStale: false },
		select: { id: true },
	});
	return new Set(faculty.map((member) => member.id));
}

function getStaleFacultyIdsForRun(run: { draftEntries: unknown }, activeFacultyIds: Set<number>): number[] {
	return extractDraftFacultyIds(run.draftEntries).filter((facultyId) => !activeFacultyIds.has(facultyId));
}

// ─── Types ───

export interface RunSummary {
	classesProcessed: number;
	assignedCount: number;
	unassignedCount: number;
	roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
	homeRoomAttemptedCount?: number;
	homeRoomAssignedCount?: number;
	homeRoomSuccessRate?: number;
	policyBlockedCount: number;
	hardViolationCount: number;
	prePlacedCount?: number;
	invalidPrePlacedCount?: number;
	skippedPrePlacedReasons?: string[];
	violationCounts?: Record<string, number>;
	lockWarnings?: string[];
	modularWarnings?: string[];
	cohortCount?: number;
	cohortizedClassCount?: number;
	contractWarnings?: string[];
	// H-ALG-5: Hybrid scheduler diagnostics
	hybridEnabled?: boolean;
	selectedSeedProfile?: string;
	seedQuality?: SeedQualitySummary[];
	repairImpact?: RepairImpact;
	resourceDiagnostics?: {
		qualifiedFacultyCoverageBySubject: Array<{ subjectId: number; subjectCode: string; requiredAssignments: number; qualifiedAssignments: number; coveragePercent: number }>;
		slotSaturationByInterval: Array<{ day: string; startTime: string; endTime: string; assigned: number; capacity: number; saturationPercent: number }>;
		unassignedBySubjectGrade: Array<{ subjectId: number; subjectCode: string; gradeLevel: number; count: number; reasons: Record<string, number> }>;
		roomAssignmentReasonCounts?: Record<string, number>;
		homeRoomFallbackDiagnostics?: {
			homeRoomOccupied: number;
			noSameZoneStandardRoom: number;
			onlySpecializedRoomsAvailable: number;
			policyOrShiftWindowIncompatible: number;
		};
		zoneDistributionByTerm?: Array<{ termIndex: 1 | 2 | 3; total: number; byZone: Record<string, { count: number; percent: number }> }>;
	};
	shiftWindowPolicy?: 'ENFORCED' | 'DISABLED';
	configuredShiftWindowCount?: number;
	termCounts?: {
		term1: number;
		term2: number;
		term3: number;
	};
	timetableShapeContracts?: TimetableShapeContract[];
	timetableDisplaySlots?: Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean }>;
}

function normalizeProgramType(programType?: string | null): string {
	return (programType ?? 'REGULAR').toUpperCase();
}

function hasTleSplitSectionOwnership(
	gradeLevels: Array<{ sections: Array<{ tleProgramId?: number | null; tleSpecialization?: string | null; tleProgramCategory?: string | null }> }>,
): boolean {
	for (const grade of gradeLevels) {
		for (const section of grade.sections) {
			if (section.tleProgramId != null) return true;
			if (section.tleSpecialization != null && section.tleSpecialization.trim().length > 0) return true;
			if (section.tleProgramCategory != null && section.tleProgramCategory.trim().length > 0) return true;
		}
	}
	return false;
}

function buildRunTimetableShapeContracts(input: {
	sectionsByGrade: Array<{ gradeLevelId: number; sections: Array<{ programType?: string | null }> }>;
	gradeWindows: Array<{ gradeLevel: number; programType?: string | null; startTime: string; endTime: string }>;
	templateProfiles: Array<{ programType: string; periodLengthMinutes: number; periodsPerDay: number }>;
	policy: ConstructorInput['policy'];
}): TimetableShapeContract[] {
	const templateByProgram = new Map(input.templateProfiles.map((profile) => [normalizeProgramType(profile.programType), profile]));
	const regularTemplate = templateByProgram.get('REGULAR') ?? { programType: 'REGULAR', periodLengthMinutes: 50, periodsPerDay: 8 };

	const contracts: TimetableShapeContract[] = [];
	for (const grade of input.sectionsByGrade) {
		const programTypes = new Set<string>(['REGULAR']);
		for (const section of grade.sections) {
			programTypes.add(normalizeProgramType(section.programType));
		}

		for (const programType of programTypes) {
			const window = input.gradeWindows.find((row) => row.gradeLevel === grade.gradeLevelId && normalizeProgramType(row.programType) === programType)
				?? input.gradeWindows.find((row) => row.gradeLevel === grade.gradeLevelId && normalizeProgramType(row.programType) === 'ALL');
			const template = templateByProgram.get(programType) ?? regularTemplate;
			contracts.push(buildTimetableShapeContract({
				gradeLevel: grade.gradeLevelId,
				programType,
				startTime: window?.startTime ?? input.policy?.earliestStartTime ?? '07:00',
				endTime: window?.endTime ?? input.policy?.latestEndTime ?? '17:00',
				periodLengthMinutes: template.periodLengthMinutes,
				periodsPerDay: template.periodsPerDay,
				basePolicy: input.policy,
			}));
		}
	}

	return contracts;
}

function buildRoomAssignmentReasonCounts(entries: ScheduledEntry[], unassignedItems: UnassignedItem[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const entry of entries) {
		const reason = entry.metadata?.roomAssignmentReason;
		if (!reason) continue;
		counts[reason] = (counts[reason] ?? 0) + 1;
	}
	for (const unassigned of unassignedItems) {
		const reason = (unassigned.roomAssignmentReason ?? 'FALLBACK_UNRESOLVED') as RoomAssignmentReason;
		counts[reason] = (counts[reason] ?? 0) + 1;
	}
	return counts;
}

function buildHomeRoomStats(entries: ScheduledEntry[], unassignedItems: UnassignedItem[]): {
	attempted: number;
	assigned: number;
	successRate: number;
} {
	let assigned = 0;
	let unavailable = 0;
	let unresolved = 0;

	for (const entry of entries) {
		const reason = entry.metadata?.roomAssignmentReason;
		if (reason === 'HOME_ROOM_ASSIGNED') assigned += 1;
		else if (reason === 'HOME_ROOM_UNAVAILABLE') unavailable += 1;
	}

	for (const item of unassignedItems) {
		if (item.homeRoomId != null) {
			unresolved += 1;
		}
	}

	const attempted = assigned + unavailable + unresolved;
	return {
		attempted,
		assigned,
		successRate: attempted > 0 ? Math.round((assigned / attempted) * 10000) / 100 : 0,
	};
}

function buildHomeRoomFallbackDiagnostics(
	entries: ScheduledEntry[],
	unassignedItems: UnassignedItem[],
): {
	homeRoomOccupied: number;
	noSameZoneStandardRoom: number;
	onlySpecializedRoomsAvailable: number;
	policyOrShiftWindowIncompatible: number;
} {
	const diagnostics = {
		homeRoomOccupied: 0,
		noSameZoneStandardRoom: 0,
		onlySpecializedRoomsAvailable: 0,
		policyOrShiftWindowIncompatible: 0,
	};

	const applyCause = (cause?: HomeRoomFallbackCause) => {
		if (cause === 'NO_SAME_ZONE_STANDARD_ROOM') diagnostics.noSameZoneStandardRoom += 1;
		else if (cause === 'ONLY_SPECIALIZED_ROOMS_AVAILABLE') diagnostics.onlySpecializedRoomsAvailable += 1;
		else if (cause === 'POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE') diagnostics.policyOrShiftWindowIncompatible += 1;
		else diagnostics.homeRoomOccupied += 1;
	};

	for (const entry of entries) {
		if (entry.metadata?.roomAssignmentReason !== 'HOME_ROOM_UNAVAILABLE') continue;
		applyCause(entry.metadata?.homeRoomFallbackCause as HomeRoomFallbackCause | undefined);
	}

	for (const item of unassignedItems) {
		if (item.homeRoomId == null) continue;
		applyCause(item.homeRoomFallbackCause);
	}

	return diagnostics;
}

function buildZoneDistributionByTerm(
	entries: ScheduledEntry[],
	roomZoneByRoomId: Map<number, string>,
): Array<{ termIndex: 1 | 2 | 3; total: number; byZone: Record<string, { count: number; percent: number }> }> {
	const termAgg = new Map<1 | 2 | 3, Map<string, number>>();
	for (const entry of entries) {
		const termIndex = normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex);
		const zone = roomZoneByRoomId.get(entry.roomId) ?? 'UNSPECIFIED';
		const zoneMap = termAgg.get(termIndex) ?? new Map<string, number>();
		zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + 1);
		termAgg.set(termIndex, zoneMap);
	}

	const terms: Array<1 | 2 | 3> = [1, 2, 3];
	return terms.map((termIndex) => {
		const zoneMap = termAgg.get(termIndex) ?? new Map<string, number>();
		const total = [...zoneMap.values()].reduce((sum, count) => sum + count, 0);
		const byZone: Record<string, { count: number; percent: number }> = {};
		for (const [zone, count] of zoneMap.entries()) {
			byZone[zone] = {
				count,
				percent: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
			};
		}
		return { termIndex, total, byZone };
	});
}

function normalizeTermIndex(value: unknown): 1 | 2 | 3 {
	const parsed = Number(value);
	if (parsed === 2) return 2;
	if (parsed === 3) return 3;
	return 1;
}

function deriveTermIndexFromMetadata(entry: ScheduledEntry): 1 | 2 | 3 {
	const firstTermIndex = entry.metadata?.modularAssignments?.[0]?.termIndex;
	if (firstTermIndex === 2 || firstTermIndex === 3) return firstTermIndex;
	return 1;
}

function withTermIndex(entries: ScheduledEntry[]): ScheduledEntry[] {
	return entries.map((entry) => ({
		...entry,
		termIndex: normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex ?? deriveTermIndexFromMetadata(entry)),
	}));
}

function buildTermCounts(entries: ScheduledEntry[]): { term1: number; term2: number; term3: number } {
	return entries.reduce(
		(acc, entry) => {
			const termIndex = normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex);
			if (termIndex === 2) acc.term2 += 1;
			else if (termIndex === 3) acc.term3 += 1;
			else acc.term1 += 1;
			return acc;
		},
		{ term1: 0, term2: 0, term3: 0 },
	);
}

function buildQualifiedCoverageBySubject(
	demand: DemandItem[],
	facultySubjects: Array<{ facultyId: number; subjectId: number; sectionIds: number[] }>,
): Array<{ subjectId: number; subjectCode: string; requiredAssignments: number; qualifiedAssignments: number; coveragePercent: number }> {
	const qualifiedKey = new Set<string>();
	for (const assignment of facultySubjects) {
		for (const sectionId of assignment.sectionIds) {
			qualifiedKey.add(`${sectionId}:${assignment.subjectId}`);
		}
	}

	const agg = new Map<number, { subjectCode: string; requiredAssignments: number; qualifiedAssignments: number }>();
	for (const item of demand) {
		const stat = agg.get(item.subjectId) ?? { subjectCode: item.subjectCode, requiredAssignments: 0, qualifiedAssignments: 0 };
		const sectionIds = item.entryKind === 'COHORT' && item.cohortMemberSectionIds?.length ? item.cohortMemberSectionIds : [item.sectionId];
		const qualified = sectionIds.every((sectionId) => qualifiedKey.has(`${sectionId}:${item.subjectId}`));
		stat.requiredAssignments += item.sessionsPerWeek;
		if (qualified) stat.qualifiedAssignments += item.sessionsPerWeek;
		agg.set(item.subjectId, stat);
	}

	return [...agg.entries()].map(([subjectId, stat]) => ({
		subjectId,
		subjectCode: stat.subjectCode,
		requiredAssignments: stat.requiredAssignments,
		qualifiedAssignments: stat.qualifiedAssignments,
		coveragePercent: stat.requiredAssignments > 0
			? Math.round((stat.qualifiedAssignments / stat.requiredAssignments) * 10000) / 100
			: 0,
	})).sort((left, right) => left.coveragePercent - right.coveragePercent || left.subjectCode.localeCompare(right.subjectCode));
}

function buildSlotSaturation(entries: ScheduledEntry[], roomCapacity: number): Array<{ day: string; startTime: string; endTime: string; assigned: number; capacity: number; saturationPercent: number }> {
	const slotCounts = new Map<string, { day: string; startTime: string; endTime: string; assigned: number }>();
	for (const entry of entries) {
		const key = `${entry.day}:${entry.startTime}:${entry.endTime}`;
		const slot = slotCounts.get(key) ?? { day: entry.day, startTime: entry.startTime, endTime: entry.endTime, assigned: 0 };
		slot.assigned += 1;
		slotCounts.set(key, slot);
	}
	return [...slotCounts.values()]
		.map((slot) => ({
			...slot,
			capacity: roomCapacity,
			saturationPercent: roomCapacity > 0 ? Math.round((slot.assigned / roomCapacity) * 10000) / 100 : 0,
		}))
		.sort((left, right) => right.saturationPercent - left.saturationPercent || left.day.localeCompare(right.day) || left.startTime.localeCompare(right.startTime));
}

function buildUnassignedBySubjectGrade(unassignedItems: UnassignedItem[], subjectCodeById: Map<number, string>) {
	const agg = new Map<string, { subjectId: number; subjectCode: string; gradeLevel: number; count: number; reasons: Record<string, number> }>();
	for (const item of unassignedItems) {
		const key = `${item.subjectId}:${item.gradeLevel}`;
		const row = agg.get(key) ?? {
			subjectId: item.subjectId,
			subjectCode: subjectCodeById.get(item.subjectId) ?? `SUBJECT_${item.subjectId}`,
			gradeLevel: item.gradeLevel,
			count: 0,
			reasons: {},
		};
		row.count += 1;
		row.reasons[item.reason] = (row.reasons[item.reason] ?? 0) + 1;
		agg.set(key, row);
	}
	return [...agg.values()].sort((left, right) => right.count - left.count || left.gradeLevel - right.gradeLevel || left.subjectCode.localeCompare(right.subjectCode));
}

// ─── Trigger ───

export async function triggerGenerationRun(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	options?: {
		ignoreRoomRequestGate?: boolean;
		enforceShiftWindows?: boolean;
		roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
		authToken?: string;
	},
) {
	const gateStatus = await getGenerationRoomRequestGateStatus(schoolId, schoolYearId);
	if (gateStatus.blocked && !options?.ignoreRoomRequestGate) {
		throw err(
			409,
			'OPEN_ROOM_REQUESTS_BLOCK_GENERATION',
			`Generation is blocked until all submitted faculty requests are decided. ${gateStatus.openCount} request(s) remain pending.`,
			{
				actionHint: 'Resolve all pending requests in the room-request panel, or use Generate Anyway to override this gate for a fresh draft.',
				details: { runId: gateStatus.runId, openRequestCount: gateStatus.openCount },
			},
		);
	}

	// Create run as QUEUED
	const run = await prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			triggeredBy: actorId,
			status: 'QUEUED',
		},
	});

	// Transition to RUNNING
	const startedAt = new Date();
	await prisma.generationRun.update({
		where: { id: run.id },
		data: { status: 'RUNNING', startedAt },
	});

	let stage = 'init';
	try {
		stage = 'pre-generation-drafts';
		const preGenerationDrafts = await preGenerationDraftService.consumeDraftPlacementsForRun(run.id, schoolId, schoolYearId, options?.authToken);

		// ── G.17: Diagnostic output for pre-gen consume phase ──
		console.log(`[generation][run=${run.id}] pre-gen consume: accepted=${preGenerationDrafts.prePlacedCount}, skipped=${preGenerationDrafts.invalidPrePlacedCount}, lockedEntries=${preGenerationDrafts.lockedEntries?.length ?? 0}`);
		if ((preGenerationDrafts.skippedPrePlacedReasons?.length ?? 0) > 0) {
			console.log(`[generation][run=${run.id}] skipped reasons:`, preGenerationDrafts.skippedPrePlacedReasons.slice(0, 10));
		}

		// ── Fetch all input data for construction ──
		stage = 'subject-contract-sync';
		await reconcileSubjectContractFromUpstream(schoolId, schoolYearId, options?.authToken);
		await ensureDefaultTemplates(schoolId);
		await syncSectionsFromExternal(schoolId, schoolYearId, options?.authToken);
		await ensurePhase3GradeWindows(schoolId, schoolYearId);
		const sectionResult = await getSectionSummary(schoolYearId, schoolId, options?.authToken);
		const hasTleOwnershipSignals = hasTleSplitSectionOwnership(sectionResult.gradeLevels);
		const cohortSyncWarnings: string[] = [];
		if (hasTleOwnershipSignals) {
			const cohortSyncResult = await syncCohorts(schoolId, schoolYearId, options?.authToken);
			cohortSyncWarnings.push(...(cohortSyncResult.warnings ?? []));
		} else {
			cohortSyncWarnings.push('MATATAG section-scoped TLE contract active; cohort-based TLE inputs are bypassed for this run.');
		}

		stage = 'coverage-repair';
		const latestCompletedRun = await prisma.generationRun.findFirst({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { id: 'desc' },
			select: { id: true, unassignedItems: true },
		});
		const dynamicTleSubjects = await prisma.subject.findMany({
			where: {
				schoolId,
				isActive: true,
				code: { startsWith: 'TLE_SPEC_' },
			},
			select: { code: true },
		});
		const noQualifiedSubjectIds = extractNoQualifiedSubjectIds(latestCompletedRun?.unassignedItems);
		const noQualifiedSubjects = noQualifiedSubjectIds.length > 0
			? await prisma.subject.findMany({
				where: { schoolId, isActive: true, id: { in: noQualifiedSubjectIds } },
				select: { code: true },
			})
			: [];
		const coverageSummary = await getActiveSubjectCoverageSummary(schoolId, schoolYearId, options?.authToken);
		const uncoveredNoRealFacultyCodes = coverageSummary.rows
			.filter((row) => row.uncoveredSectionCount > 0 && row.ownedByRealFacultyCount === 0 && row.subjectCode !== 'HG')
			.map((row) => row.subjectCode);

		const targetedCoverageSubjectCodes = [
			...new Set([
				...dynamicTleSubjects.map((subject) => subject.code),
				...noQualifiedSubjects.map((subject) => subject.code),
				...uncoveredNoRealFacultyCodes,
			]),
		].filter((subjectCode) => subjectCode !== 'HG');

		if (targetedCoverageSubjectCodes.length > 0) {
			await repairActiveSubjectCoverageWithPlaceholders({
				schoolId,
				schoolYearId,
				assignedBy: actorId,
				apply: true,
				subjectCodes: targetedCoverageSubjectCodes,
				authToken: options?.authToken,
			});
		}

		stage = 'sections-fetch';
		const [faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows] = await Promise.all([
			prisma.facultyMirror.findMany({
				where: { schoolId, isActiveForScheduling: true, isStale: false },
				select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, department: true },
			}),
			prisma.facultySubject.findMany({
				where: { schoolId },
				select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
			}),
			prisma.room.findMany({
				where: {
					isTeachingSpace: true,
					building: { schoolId, isTeachingBuilding: true },
				},
				select: { id: true, type: true, isTeachingSpace: true, isSharedFacility: true, capacity: true, buildingId: true, buildingZoneId: true },
			}),
			prisma.subject.findMany({
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
			prisma.facultyPreference.findMany({
				where: { schoolId, schoolYearId },
				select: {
					facultyId: true,
					status: true,
					timeSlots: { select: { day: true, startTime: true, endTime: true, preference: true } },
				},
			}),
			getOrCreatePolicy(schoolId, schoolYearId),
			prisma.building.findMany({
				where: { schoolId },
				select: { id: true, name: true, x: true, y: true },
			}),
			options?.enforceShiftWindows === false
				? Promise.resolve([])
				: prisma.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } }),
		]);

		const cohorts = hasTleOwnershipSignals
			? await prisma.instructionalCohort.findMany({
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
			})
			: [];

		const rosterIndex = buildSectionRosterIndex(sectionResult.gradeLevels);
		const activeFacultyIdSet = new Set(faculty.map((member) => member.id));
		const facultySubjects = facultySubjectRows
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

		// ── Run hybrid multi-seed constructor (H-ALG-1 through H-ALG-3) ──
		stage = 'constructor';
		const sectionsByGrade = sectionResult.gradeLevels;

		// Auto-seed class templates for any program types found in the fetched sections
		// so that schedule generation uses the correct period lengths for special programs.
		const detectedProgramTypes = [
			...new Set(
				sectionsByGrade
					.flatMap((g) => g.sections)
					.map((s) => s.programType)
					.filter((pt): pt is NonNullable<typeof pt> => pt != null),
			),
		];
		if (detectedProgramTypes.length > 0) {
			await ensureTemplatesForProgramTypes(schoolId, detectedProgramTypes as any);
		}

		// Build classTemplatePeriods map: programType -> periodLengthMinutes
		const templateProfiles = await getTemplatePeriodProfiles(schoolId);
		const classTemplatePeriods: Record<string, number> = {};
		for (const tp of templateProfiles) {
			classTemplatePeriods[tp.programType] = tp.periodLengthMinutes;
		}
		const timetableShapeContracts = buildRunTimetableShapeContracts({
			sectionsByGrade,
			gradeWindows: gradeWindows.map((gw) => ({
				gradeLevel: gw.gradeLevel,
				programType: gw.programType ?? null,
				startTime: gw.startTime,
				endTime: gw.endTime,
			})),
			templateProfiles,
			policy: {
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
			},
		});

		const demand = computeDemand(sectionsByGrade, subjects, cohorts, classTemplatePeriods);
		const policyMaxDailyMinutes = policyRecord.maxTeachingMinutesPerDay;
		const constructorInput: ConstructorInput = {
			schoolId,
			schoolYearId,
			roomingStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
			sectionsByGrade,
			subjects,
			cohorts,
			faculty: faculty.map((member) => ({
				id: member.id,
				maxHoursPerWeek: Math.floor(
					computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60,
				),
				department: member.department,
			})),
			facultySubjects,
			rooms,
			preferences: preferences.map((p) => ({
				facultyId: p.facultyId,
				status: p.status,
				timeSlots: p.timeSlots.map((ts) => ({
					day: ts.day,
					startTime: ts.startTime,
					endTime: ts.endTime,
					preference: ts.preference,
				})),
			})),
			policy: {
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
			},
			lockedEntries: preGenerationDrafts.lockedEntries,
			gradeWindows: gradeWindows.map((gw) => ({
				gradeLevel: gw.gradeLevel,
				programType: gw.programType ?? null,
				startTime: gw.startTime,
				endTime: gw.endTime,
			})),
			buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
			classTemplatePeriods,
			timetableShapes: timetableShapeContracts,
		};
		const result = runHybridScheduler(constructorInput);
		const entriesWithTerms = withTermIndex(result.entries);

		// ── G.17: Diagnostic output for constructor result ──
		console.log(`[generation][run=${run.id}] constructor: assigned=${result.assignedCount}, unassigned=${result.unassignedCount}, policyBlocked=${result.policyBlockedCount}, entries=${result.entries.length}, hybrid=${result.hybridEnabled}, selectedProfile=${result.selectedProfileId}`);
		if (result.lockWarnings.length > 0) {
			console.log(`[generation][run=${run.id}] lock warnings:`, result.lockWarnings.slice(0, 5));
		}
		if (result.unassignedItems.length > 0) {
			const reasonCounts: Record<string, number> = {};
			for (const item of result.unassignedItems) {
				reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1;
			}
			console.log(`[generation][run=${run.id}] top unassigned reasons:`, reasonCounts);
		}

		// ── Validate constructed entries ──
		stage = 'validator';
		const validatorCtx: ValidatorContext = {
			schoolId, schoolYearId, runId: run.id,
			entries: entriesWithTerms, faculty: constructorInput.faculty, facultySubjects, rooms, subjects,
			sectionEnrollment: new Map(
				sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount] as const)),
			),
			policy: {
				...constructorInput.policy!,
				maxTeachingMinutesPerDay: policyMaxDailyMinutes,
				enforceConsecutiveBreakAsHard: policyRecord.enforceConsecutiveBreakAsHard,
			},
			travelPolicy: {
				enableTravelWellbeingChecks: policyRecord.enableTravelWellbeingChecks,
				maxWalkingDistanceMetersPerTransition: policyRecord.maxWalkingDistanceMetersPerTransition,
				maxBuildingTransitionsPerDay: policyRecord.maxBuildingTransitionsPerDay,
				maxBackToBackTransitionsWithoutBuffer: policyRecord.maxBackToBackTransitionsWithoutBuffer,
				maxIdleGapMinutesPerDay: policyRecord.maxIdleGapMinutesPerDay,
				avoidEarlyFirstPeriod: policyRecord.avoidEarlyFirstPeriod,
				avoidLateLastPeriod: policyRecord.avoidLateLastPeriod,
			},
			vacantPolicy: {
				enableVacantAwareConstraints: policyRecord.enableVacantAwareConstraints,
				targetFacultyDailyVacantMinutes: policyRecord.targetFacultyDailyVacantMinutes,
				targetSectionDailyVacantPeriods: policyRecord.targetSectionDailyVacantPeriods,
				maxCompressedTeachingMinutesPerDay: policyRecord.maxCompressedTeachingMinutesPerDay,
			},
			buildings,
			roomBuildings: rooms.map((r) => ({ roomId: r.id, buildingId: r.buildingId })),
			constraintConfig: {
				...DEFAULT_CONSTRAINT_CONFIG,
				...(policyRecord.constraintConfig as Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }> ?? {}),
			},
		};
		const validationResult = validateHardConstraints(validatorCtx);
		const modularWarnings = result.modularWarnings ?? [];
		const modularWarningViolations: Violation[] = modularWarnings.map((warning) => ({
			code: warning.code,
			severity: 'SOFT',
			message: warning.message,
			schoolId,
			schoolYearId,
			runId: run.id,
			entities: {
				sectionId: warning.sectionId,
				subjectId: warning.subjectId,
			},
			meta: warning.meta,
		}));
		const unassignedViolations: Violation[] = result.unassignedItems.map((item) => {
			const isSpecializedUnavailable = item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE';
			return {
				code: isSpecializedUnavailable ? 'SPECIALIZED_ROOM_UNAVAILABLE' : 'UNASSIGNED_SECTION',
				severity: isSpecializedUnavailable ? 'SOFT' : 'HARD',
				message: isSpecializedUnavailable
					? `Section ${item.sectionId} subject ${item.subjectId} could not be assigned to a specialized room in session ${item.session}.`
					: `Section ${item.sectionId} subject ${item.subjectId} remained unassigned in session ${item.session}.`,
				schoolId,
				schoolYearId,
				runId: run.id,
				entities: {
					sectionId: item.sectionId,
					subjectId: item.subjectId,
				},
				meta: {
					reason: item.reason,
					roomAssignmentReason: item.roomAssignmentReason,
					session: item.session,
					gradeLevel: item.gradeLevel,
				},
			};
		});

		const roomZoneByRoomId = new Map<number, string>(
			rooms.map((room) => [room.id, room.buildingZoneId ?? 'UNSPECIFIED']),
		);
		const zoneDistributionByTerm = buildZoneDistributionByTerm(entriesWithTerms, roomZoneByRoomId);
		const zoneWarningViolations: Violation[] = zoneDistributionByTerm.flatMap((termZone) => {
			const zoneRows = Object.entries(termZone.byZone);
			if (zoneRows.length === 0 || termZone.total === 0) return [];
			const [zone, data] = zoneRows.reduce((max, current) => (current[1].percent > max[1].percent ? current : max));
			if (data.percent <= 50) return [];
			return [{
				code: 'ZONE_IMBALANCE_WARNING',
				severity: 'SOFT',
				message: `Term ${termZone.termIndex} zone ${zone} has ${data.percent}% of scheduled entries, exceeding the 50% balancing threshold.`,
				schoolId,
				schoolYearId,
				runId: run.id,
				entities: {},
				meta: {
					termIndex: termZone.termIndex,
					zone,
					percent: data.percent,
					total: termZone.total,
				},
			}];
		});
		const mergedViolationCounts = { ...validationResult.counts.byCode } as Record<string, number>;
		for (const warning of [...modularWarningViolations, ...unassignedViolations, ...zoneWarningViolations]) {
			mergedViolationCounts[warning.code] = (mergedViolationCounts[warning.code] ?? 0) + 1;
		}
		const mergedValidationResult: ValidationResult = {
			violations: [
				...validationResult.violations,
				...modularWarningViolations,
				...unassignedViolations,
				...zoneWarningViolations,
			],
			counts: {
				total: validationResult.counts.total + modularWarningViolations.length + unassignedViolations.length + zoneWarningViolations.length,
				byCode: mergedViolationCounts as ValidationResult['counts']['byCode'],
			},
		};
		const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
		const resourceDiagnostics: NonNullable<RunSummary['resourceDiagnostics']> = {
			qualifiedFacultyCoverageBySubject: buildQualifiedCoverageBySubject(demand, facultySubjects),
			slotSaturationByInterval: buildSlotSaturation(entriesWithTerms, Math.max(rooms.length, 1)).slice(0, 20),
			unassignedBySubjectGrade: buildUnassignedBySubjectGrade(result.unassignedItems, subjectCodeById).slice(0, 20),
			roomAssignmentReasonCounts: buildRoomAssignmentReasonCounts(entriesWithTerms, result.unassignedItems),
			homeRoomFallbackDiagnostics: buildHomeRoomFallbackDiagnostics(entriesWithTerms, result.unassignedItems),
			zoneDistributionByTerm,
		};
		const termCounts = buildTermCounts(entriesWithTerms);
		const homeRoomStats = buildHomeRoomStats(entriesWithTerms, result.unassignedItems);
		const timetableDisplaySlots = timetableShapeContracts
			.flatMap((contract) => contract.displaySlots)
			.filter((slot, index, slots) => {
				const key = `${slot.startTime}-${slot.endTime}-${slot.eventName ?? ''}-${slot.isSpecialEvent ? '1' : '0'}`;
				return slots.findIndex((candidate) => `${candidate.startTime}-${candidate.endTime}-${candidate.eventName ?? ''}-${candidate.isSpecialEvent ? '1' : '0'}` === key) === index;
			})
			.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));

		const summary: RunSummary = {
			classesProcessed: result.classesProcessed,
			assignedCount: result.assignedCount,
			unassignedCount: result.unassignedCount,
			roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
			homeRoomAttemptedCount: homeRoomStats.attempted,
			homeRoomAssignedCount: homeRoomStats.assigned,
			homeRoomSuccessRate: homeRoomStats.successRate,
			policyBlockedCount: result.policyBlockedCount,
			hardViolationCount: mergedValidationResult.violations.filter((v) => v.severity === 'HARD').length,
			prePlacedCount: preGenerationDrafts.prePlacedCount,
			invalidPrePlacedCount: preGenerationDrafts.invalidPrePlacedCount,
			skippedPrePlacedReasons: preGenerationDrafts.skippedPrePlacedReasons.length > 0 ? preGenerationDrafts.skippedPrePlacedReasons : undefined,
			violationCounts: mergedValidationResult.counts.byCode,
			lockWarnings: result.lockWarnings.length > 0 ? result.lockWarnings : undefined,
			modularWarnings: modularWarnings.length > 0 ? modularWarnings.map((warning) => warning.message) : undefined,
			cohortCount: cohorts.length,
			cohortizedClassCount: entriesWithTerms.filter((entry) => entry.entryKind === 'COHORT').length,
			termCounts,
			contractWarnings: [
				...(sectionResult.contractWarnings ?? []),
				...cohortSyncWarnings,
			].length > 0 ? [
				...(sectionResult.contractWarnings ?? []),
				...cohortSyncWarnings,
			] : undefined,
			// H-ALG-5: Hybrid scheduler diagnostics
			hybridEnabled: result.hybridEnabled,
			selectedSeedProfile: result.selectedProfileId,
			seedQuality: result.seedQuality?.length > 0 ? result.seedQuality : undefined,
			repairImpact: result.repairImpact,
			resourceDiagnostics,
			shiftWindowPolicy: options?.enforceShiftWindows === false ? 'DISABLED' : 'ENFORCED',
			configuredShiftWindowCount: gradeWindows.length,
			timetableShapeContracts,
			timetableDisplaySlots,
		};

		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();

		// Finalize as COMPLETED with draft entries
		stage = 'persist';
		const completed = await prisma.generationRun.update({
			where: { id: run.id },
			data: {
				status: 'COMPLETED',
				finishedAt,
				durationMs,
				summary: summary as object,
				violations: mergedValidationResult.violations as unknown as object[],
				draftEntries: entriesWithTerms as unknown as object[],
				unassignedItems: result.unassignedItems as unknown as object[],
			},
		});

		// Audit log
		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_COMPLETED',
				actorId,
				targetIds: [run.id],
				metadata: {
					durationMs,
					summary,
					gateOverrideUsed: Boolean(options?.ignoreRoomRequestGate),
					roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
					shiftWindowPolicy: options?.enforceShiftWindows === false ? 'DISABLED' : 'ENFORCED',
					gradeWindowCount: gradeWindows.length,
					gateOpenRequestCountAtTrigger: gateStatus.openCount,
				} as object,
			},
		});

		await preGenerationDraftService.markPlacementsLockedForRun(schoolId, schoolYearId, run.id, preGenerationDrafts.acceptedPlacementIds);

		return completed;
	} catch (error) {
		// Finalize as FAILED with stage-tagged diagnostics
		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();
		const rawMessage = error instanceof Error ? error.message : String(error);
		const errorMessage = `[${stage}] ${rawMessage}`;

		const failed = await prisma.generationRun.update({
			where: { id: run.id },
			data: {
				status: 'FAILED',
				finishedAt,
				durationMs,
				error: errorMessage,
			},
		});

		await prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_FAILED',
				actorId,
				targetIds: [run.id],
				metadata: { durationMs, stage, error: rawMessage } as object,
			},
		});

		return failed;
	}
}

export async function assertGenerationRoomRequestGate(schoolId: number, schoolYearId: number) {
	const status = await getGenerationRoomRequestGateStatus(schoolId, schoolYearId);
	if (!status.blocked) return status;
	throw err(
		409,
		'OPEN_ROOM_REQUESTS_BLOCK_GENERATION',
		`Generation is blocked until all submitted faculty requests are decided. ${status.openCount} request(s) remain pending.`,
		{
			actionHint: 'Resolve all pending requests in the room-request panel, then retry generation.',
			details: { runId: status.runId, openRequestCount: status.openCount },
		},
	);
}

export async function getGenerationRoomRequestGateStatus(schoolId: number, schoolYearId: number) {
	let activeRunId: number | null = null;
	try {
		const activeRun = await resolveActiveDraftRun(schoolId, schoolYearId);
		activeRunId = activeRun.id;
	} catch (error) {
		const code = (error as { code?: string }).code;
		// Stale draft also means no valid draft to gate against — allow a fresh generation
		if (code === 'NO_ACTIVE_DRAFT' || code === 'STALE_RUN_DATA') return { blocked: false, openCount: 0, runId: null };
		throw error;
	}

	if (!activeRunId) return { blocked: false, openCount: 0, runId: null };

	const openCount = await prisma.facultyRoomPreference.count({
		where: {
			schoolId,
			schoolYearId,
			runId: activeRunId,
			status: 'SUBMITTED',
			decisionStatus: 'PENDING',
		},
	});

	return { blocked: openCount > 0, openCount, runId: activeRunId };
}

// ─── Queries ───

export async function getRunById(runId: number, schoolId: number, schoolYearId: number) {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	return run;
}

export async function getLatestRun(schoolId: number, schoolYearId: number) {
	return getLatestValidRun(schoolId, schoolYearId);
}

export async function getLatestValidRun(schoolId: number, schoolYearId: number) {
	const [runs, activeFacultyIds] = await Promise.all([
		prisma.generationRun.findMany({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	if (runs.length === 0) {
		throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
	}

	for (const run of runs) {
		if (getStaleFacultyIdsForRun(run, activeFacultyIds).length === 0) {
			return run;
		}
	}

	const latestRun = runs[0];
	const staleFacultyIds = getStaleFacultyIdsForRun(latestRun, activeFacultyIds);
	throw err(
		409,
		'STALE_RUN_DATA',
		'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.',
		{
			actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
			details: { latestRunId: latestRun.id, staleFacultyIds },
		},
	);
}

export async function assertLatestRunIsCurrent(schoolId: number, schoolYearId: number) {
	const [latestRun, activeFacultyIds] = await Promise.all([
		prisma.generationRun.findFirst({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	if (!latestRun) {
		throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
	}

	const staleFacultyIds = getStaleFacultyIdsForRun(latestRun, activeFacultyIds);
	if (staleFacultyIds.length > 0) {
		throw err(
			409,
			'STALE_RUN_DATA',
			'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.',
			{
				actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
				details: { latestRunId: latestRun.id, staleFacultyIds },
			},
		);
	}

	return latestRun;
}

export async function listRuns(schoolId: number, schoolYearId: number, limit: number = 20) {
	return prisma.generationRun.findMany({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
		take: limit,
	});
}

export async function publishRun(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	actorId: number,
) {
	const run = await getRunById(runId, schoolId, schoolYearId);
	if (run.status !== 'COMPLETED') {
		throw err(422, 'RUN_NOT_COMPLETED', 'Only completed generation runs can be published.');
	}

	const summary = (run.summary ?? {}) as Record<string, unknown>;
	const hardViolationCount = Number(summary.hardViolationCount ?? 0);
	if (hardViolationCount > 0) {
		throw err(422, 'PUBLISH_BLOCKED_HARD_VIOLATIONS', 'Cannot publish while hard violations exist.', {
			details: { runId, hardViolationCount },
			actionHint: 'Resolve hard violations in Review and try publish again.',
		});
	}

	const publishedAtIso = new Date().toISOString();
	const nextSummary = {
		...summary,
		isPublished: true,
		publishedAt: publishedAtIso,
		publishedBy: actorId,
	};

	const updated = await prisma.generationRun.update({
		where: { id: run.id },
		data: {
			summary: nextSummary as object,
		},
	});

	await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'GENERATION_RUN_PUBLISHED',
			actorId,
			targetIds: [run.id],
			metadata: { runId: run.id, publishedAt: publishedAtIso } as object,
		},
	});

	return updated;
}

// ─── Violation queries ───

export interface ViolationReport {
	runId: number;
	status: string;
	violations: Violation[];
	counts: {
		total: number;
		byCode: Record<string, number>;
	};
}

function filterViolationsByTerm(
	violations: Violation[],
	entries: ScheduledEntry[],
	termIndex?: number,
): Violation[] {
	if (termIndex !== 1 && termIndex !== 2 && termIndex !== 3) {
		return violations;
	}

	const entryTermById = new Map(entries.map((entry) => [entry.entryId, entry.termIndex ?? 1]));
	return violations.filter((violation) => {
		const explicit = violation.meta?.termIndex;
		if (typeof explicit === 'number') {
			return explicit === termIndex;
		}
		const entryIds = violation.entities?.entryIds ?? [];
		if (Array.isArray(entryIds) && entryIds.length > 0) {
			return entryIds.some((entryId) => entryTermById.get(entryId) === termIndex);
		}
		return true;
	});
}

export async function getRunViolations(runId: number, schoolId: number, schoolYearId: number, termIndex?: number): Promise<ViolationReport> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	const entries = withTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]);
	const violations = filterViolationsByTerm((run.violations ?? []) as unknown as Violation[], entries, termIndex);
	const summary = (run.summary ?? {}) as Record<string, unknown>;
	const violationCounts = (summary.violationCounts ?? {}) as Record<string, number>;

	return {
		runId: run.id,
		status: run.status,
		violations,
		counts: {
			total: violations.length,
			byCode: violationCounts,
		},
	};
}

export async function getLatestRunViolations(schoolId: number, schoolYearId: number, termIndex?: number): Promise<ViolationReport> {
	const run = await getLatestValidRun(schoolId, schoolYearId);

	const entries = withTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]);
	const violations = filterViolationsByTerm((run.violations ?? []) as unknown as Violation[], entries, termIndex);
	const summary = (run.summary ?? {}) as Record<string, unknown>;
	const violationCounts = (summary.violationCounts ?? {}) as Record<string, number>;

	return {
		runId: run.id,
		status: run.status,
		violations,
		counts: {
			total: violations.length,
			byCode: violationCounts,
		},
	};
}

// ─── Draft queries ───

export interface DraftReport {
	runId: number;
	status: string;
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
	summary: RunSummary | null;
	version: number;
	finishedAt: string | null;
	createdAt: string;
}

export async function getRunDraft(runId: number, schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	return {
		runId: run.id,
		status: run.status,
		entries: withTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]),
		unassignedItems: (run.unassignedItems ?? []) as unknown as UnassignedItem[],
		summary: (run.summary ?? null) as RunSummary | null,
		version: run.version,
		finishedAt: run.finishedAt?.toISOString() ?? null,
		createdAt: run.createdAt.toISOString(),
	};
}

export async function getLatestRunDraft(schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const run = await getLatestValidRun(schoolId, schoolYearId);

	return {
		runId: run.id,
		status: run.status,
		entries: withTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]),
		unassignedItems: (run.unassignedItems ?? []) as unknown as UnassignedItem[],
		summary: (run.summary ?? null) as RunSummary | null,
		version: run.version,
		finishedAt: run.finishedAt?.toISOString() ?? null,
		createdAt: run.createdAt.toISOString(),
	};
}

export async function invalidateStaleCompletedRuns(schoolId: number, schoolYearId: number) {
	const [runs, activeFacultyIds] = await Promise.all([
		prisma.generationRun.findMany({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			select: { id: true, draftEntries: true },
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	const staleRunIds = runs
		.filter((run) => getStaleFacultyIdsForRun(run, activeFacultyIds).length > 0)
		.map((run) => run.id);

	if (staleRunIds.length === 0) {
		return { invalidatedCount: 0, staleRunIds: [] as number[] };
	}

	await prisma.generationRun.updateMany({
		where: { id: { in: staleRunIds } },
		data: {
			status: 'FAILED',
			error: 'INVALIDATED_BY_MIRROR_RESET',
		},
	});

	return { invalidatedCount: staleRunIds.length, staleRunIds };
}
