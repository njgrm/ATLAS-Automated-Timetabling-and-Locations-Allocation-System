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
	type ConstructorInput,
	type DemandItem,
	type UnassignedItem,
	type RoomAssignmentReason,
} from './schedule-constructor.js';
import { runHybridScheduler, type SeedQualitySummary, type RepairImpact } from './hybrid-scheduler.js';
import { getSectionSummary } from './section.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getTemplatePeriodProfiles, ensureTemplatesForProgramTypes } from './class-template.service.js';
import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';

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
	};
	shiftWindowPolicy?: 'ENFORCED' | 'DISABLED';
	configuredShiftWindowCount?: number;
	termCounts?: {
		term1: number;
		term2: number;
		term3: number;
	};
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

function normalizeTermIndex(value: unknown): 1 | 2 | 3 {
	const parsed = Number(value);
	if (parsed === 2) return 2;
	if (parsed === 3) return 3;
	return 1;
}

function deriveTermIndexFromMetadata(entry: ScheduledEntry): 1 | 2 | 3 {
	const firstQuarter = entry.metadata?.modularAssignments?.[0]?.quarter;
	if (firstQuarter === 2 || firstQuarter === 3) return firstQuarter;
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
	options?: { ignoreRoomRequestGate?: boolean; enforceShiftWindows?: boolean; authToken?: string },
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
		stage = 'sections-fetch';
		const [sectionResult, faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows, cohorts, specializationAliases] = await Promise.all([
			getSectionSummary(schoolYearId, schoolId, options?.authToken),
			prisma.facultyMirror.findMany({
				where: { schoolId, isActiveForScheduling: true, isStale: false },
				select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, specialization: true, department: true },
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
				select: { id: true, type: true, isTeachingSpace: true, capacity: true, buildingId: true },
			}),
			prisma.subject.findMany({
				where: { schoolId, isActive: true },
				select: {
					id: true,
					code: true,
					name: true,
					minMinutesPerWeek: true,
					preferredRoomType: true,
					sessionPattern: true,
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
			prisma.instructionalCohort.findMany({
				where: { schoolId, schoolYearId },
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
			prisma.specializationAlias.findMany({
				where: { schoolId },
				select: { canonical: true, alias: true },
			}),
		]);

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

		const demand = computeDemand(sectionsByGrade, subjects, cohorts, classTemplatePeriods);
		const policyMaxDailyMinutes = policyRecord.maxTeachingMinutesPerDay;
		const constructorInput: ConstructorInput = {
			schoolId,
			schoolYearId,
			sectionsByGrade,
			subjects,
			cohorts,
			faculty: faculty.map((member) => ({
				id: member.id,
				maxHoursPerWeek: Math.floor(
					computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60,
				),
				specialization: member.specialization,
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
				startTime: gw.startTime,
				endTime: gw.endTime,
			})),
			buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
			specializationAliases,
			classTemplatePeriods,
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
		const mergedViolationCounts = { ...validationResult.counts.byCode } as Record<string, number>;
		for (const warning of modularWarningViolations) {
			mergedViolationCounts[warning.code] = (mergedViolationCounts[warning.code] ?? 0) + 1;
		}
		const mergedValidationResult: ValidationResult = {
			violations: [...validationResult.violations, ...modularWarningViolations],
			counts: {
				total: validationResult.counts.total + modularWarningViolations.length,
				byCode: mergedViolationCounts as ValidationResult['counts']['byCode'],
			},
		};
		const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
		const resourceDiagnostics: NonNullable<RunSummary['resourceDiagnostics']> = {
			qualifiedFacultyCoverageBySubject: buildQualifiedCoverageBySubject(demand, facultySubjects),
			slotSaturationByInterval: buildSlotSaturation(entriesWithTerms, Math.max(rooms.length, 1)).slice(0, 20),
			unassignedBySubjectGrade: buildUnassignedBySubjectGrade(result.unassignedItems, subjectCodeById).slice(0, 20),
			roomAssignmentReasonCounts: buildRoomAssignmentReasonCounts(entriesWithTerms, result.unassignedItems),
		};
		const termCounts = buildTermCounts(entriesWithTerms);

		const summary: RunSummary = {
			classesProcessed: result.classesProcessed,
			assignedCount: result.assignedCount,
			unassignedCount: result.unassignedCount,
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
			].length > 0 ? [
				...(sectionResult.contractWarnings ?? []),
			] : undefined,
			// H-ALG-5: Hybrid scheduler diagnostics
			hybridEnabled: result.hybridEnabled,
			selectedSeedProfile: result.selectedProfileId,
			seedQuality: result.seedQuality?.length > 0 ? result.seedQuality : undefined,
			repairImpact: result.repairImpact,
			resourceDiagnostics,
			shiftWindowPolicy: options?.enforceShiftWindows === false ? 'DISABLED' : 'ENFORCED',
			configuredShiftWindowCount: gradeWindows.length,
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
