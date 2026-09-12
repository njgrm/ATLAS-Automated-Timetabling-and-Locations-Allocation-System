/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 *
 * Prompt 03A: all data access resolves through the injectable data context so
 * tests can instrument the exact production path. Production uses the singleton.
 */

const db = () => getDataContext();

import { getDataContext } from '../lib/data-context.js';
import type { GenerationRunStatus } from '@prisma/client';
import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
	type Violation,
} from './constraint-validator.js';
import {
	buildUnionDisplaySlots,
	type ConstructorInput,
	type DemandItem,
	type HomeRoomFallbackCause,
	type TimetableShapeContract,
	type UnassignedItem,
	type RoomAssignmentReason,
} from './schedule-constructor.js';
import {
	buildGenerationPreflight,
	revalidateGenerationPreflight,
	buildPreflightConstructorInput,
	buildPreflightValidatorContext,
} from './generation-preflight.service.js';
import { resolveRequestedTermIndex } from './academic-term.service.js';
import { runHybridScheduler, type SeedQualitySummary, type RepairImpact } from './hybrid-scheduler.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { publishNotificationEvent } from './notification-events.service.js';
import { publishSchedule } from './publication-contract.service.js';
import {
	compareCurrentInputsForRun,
	computeGenerationInputSnapshot,
	type GenerationInputComparison,
	type GenerationInputSnapshot,
} from './generation-input-snapshot.service.js';
import { assertActiveSchoolYearForGeneration } from './school-year-drift-guard.service.js';
import { CANONICAL_TEMPLATE_VERSION } from './class-program-slot.service.js';

// ─── Helpers ───

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

type RunSummaryRecord = Record<string, unknown>;

type PublishedStateReconciliationResult = {
	reconciledCount: number;
	reconciledRunIds: number[];
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

function asSummaryRecord(summary: unknown): RunSummaryRecord {
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
		return {};
	}
	return summary as RunSummaryRecord;
}

function hasPublishedMarkers(summary: unknown): boolean {
	const candidate = asSummaryRecord(summary);
	if (candidate.isPublished === true) return true;
	if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0) return true;
	return typeof candidate.publishedBy === 'number';
}

function buildUnpublishedSummary(
	summary: unknown,
	context: {
		reason: string;
		previousStatus: GenerationRunStatus;
		reconciledAtIso: string;
	},
): RunSummaryRecord {
	const candidate = asSummaryRecord(summary);
	const existingIntegrity = asSummaryRecord(candidate.publicationIntegrity);
	return {
		...candidate,
		isPublished: false,
		publishedAt: null,
		publishedBy: null,
		publicationIntegrity: {
			...existingIntegrity,
			reconciledAt: context.reconciledAtIso,
			reason: context.reason,
			previousStatus: context.previousStatus,
		},
	};
}

export async function reconcileInvalidPublishedRunStates(
	schoolId: number,
	options?: {
		schoolYearId?: number;
		reason?: string;
		actorId?: number;
	},
): Promise<PublishedStateReconciliationResult> {
	const reason = options?.reason ?? 'PUBLISHED_STATE_CONTRACT_RECONCILIATION';
	const candidates = await db().generationRun.findMany({
		where: {
			schoolId,
			...(options?.schoolYearId ? { schoolYearId: options.schoolYearId } : {}),
			NOT: { status: 'COMPLETED' },
		},
		select: {
			id: true,
			schoolYearId: true,
			status: true,
			summary: true,
		},
	});

	const invalidPublishedRuns = candidates.filter((run) => hasPublishedMarkers(run.summary));
	if (invalidPublishedRuns.length === 0) {
		return { reconciledCount: 0, reconciledRunIds: [] };
	}

	const reconciledAtIso = new Date().toISOString();
	await db().$transaction(async (tx) => {
		for (const run of invalidPublishedRuns) {
			const nextSummary = buildUnpublishedSummary(run.summary, {
				reason,
				previousStatus: run.status,
				reconciledAtIso,
			});
			await tx.generationRun.update({
				where: { id: run.id },
				data: { summary: nextSummary as object },
			});

			if (typeof options?.actorId === 'number' && Number.isInteger(options.actorId) && options.actorId > 0) {
				await tx.auditLog.create({
					data: {
						schoolId,
						schoolYearId: run.schoolYearId,
						action: 'GENERATION_RUN_PUBLICATION_RECONCILED',
						actorId: options.actorId,
						targetIds: [run.id],
						metadata: {
							runId: run.id,
							reason,
							reconciledAt: reconciledAtIso,
							previousStatus: run.status,
						} as object,
					},
				});
			}
		}
	});

	return {
		reconciledCount: invalidPublishedRuns.length,
		reconciledRunIds: invalidPublishedRuns.map((run) => run.id),
	};
}

function extractDraftFacultyIds(draftEntries: unknown): number[] {
	if (!Array.isArray(draftEntries)) return [];
	const facultyIds = draftEntries
		.map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? (entry as { facultyId?: unknown }).facultyId : undefined))
		.filter((facultyId): facultyId is number => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
	return [...new Set(facultyIds)];
}

async function getActiveFacultyMirrorIdSet(schoolId: number): Promise<Set<number>> {
	const faculty = await db().facultyMirror.findMany({
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
			crossBuildingStandardRoomExhausted: number;
			onlySpecializedRoomsAvailable: number;
			facultyDailyLimitExceeded: number;
			facultyConsecutiveLimitExceeded: number;
			noValidPeriodInPolicyWindow: number;
		};
		zoneDistributionByTerm?: Array<{ termIndex: 1 | 2 | 3 | 4; total: number; byZone: Record<string, { count: number; percent: number }> }>;
	};
	shiftWindowPolicy?: 'ENFORCED' | 'DISABLED';
	configuredShiftWindowCount?: number;
	termCounts?: {
		term1: number;
		term2: number;
		term3: number;
		term4?: number;
	};
	timetableShapeContracts?: TimetableShapeContract[];
	canonicalTemplateVersion?: string;
	timetableDisplaySlots?: Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean; dayOfWeek?: string }>;
	inputSnapshot?: GenerationInputSnapshot;
	/** DEMAND-C01: canonical derived-demand semantic revision the run was built from. */
	derivedDemandRevision?: string;
}

function normalizeGradeLevel(value: number): number {
	if (!Number.isFinite(value)) return value;

	// If it's already a valid actual grade number (7-10), return as-is
	if (value >= 7 && value <= 10) return value;

	// EnrollPro internal grade_level_id -> actual grade number mapping
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

	// If value >= 100, use modulo normalization
	if (value >= 100) {
		const normalized = value % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}

	return value;
}

function selectPrimaryTimetableShapeContract(contracts: TimetableShapeContract[]): TimetableShapeContract | null {
	if (contracts.length === 0) return null;
	return contracts.find((contract) => contract.programType === 'REGULAR') ?? contracts[0] ?? null;
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

export function buildHomeRoomStats(entries: ScheduledEntry[], unassignedItems: UnassignedItem[]): {
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

export function buildHomeRoomFallbackDiagnostics(
	entries: ScheduledEntry[],
	unassignedItems: UnassignedItem[],
): {
	homeRoomOccupied: number;
	noSameZoneStandardRoom: number;
	crossBuildingStandardRoomExhausted: number;
	onlySpecializedRoomsAvailable: number;
	facultyDailyLimitExceeded: number;
	facultyConsecutiveLimitExceeded: number;
	noValidPeriodInPolicyWindow: number;
} {
	const diagnostics = {
		homeRoomOccupied: 0,
		noSameZoneStandardRoom: 0,
		crossBuildingStandardRoomExhausted: 0,
		onlySpecializedRoomsAvailable: 0,
		facultyDailyLimitExceeded: 0,
		facultyConsecutiveLimitExceeded: 0,
		noValidPeriodInPolicyWindow: 0,
	};

	const applyCause = (cause?: HomeRoomFallbackCause) => {
		if (cause === 'NO_SAME_ZONE_STANDARD_ROOM') diagnostics.noSameZoneStandardRoom += 1;
		else if (cause === 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED') diagnostics.crossBuildingStandardRoomExhausted += 1;
		else if (cause === 'ONLY_SPECIALIZED_ROOMS_AVAILABLE') diagnostics.onlySpecializedRoomsAvailable += 1;
		else if (cause === 'FACULTY_DAILY_LIMIT_EXCEEDED') diagnostics.facultyDailyLimitExceeded += 1;
		else if (cause === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED') diagnostics.facultyConsecutiveLimitExceeded += 1;
		else if (cause === 'NO_VALID_PERIOD_IN_POLICY_WINDOW') diagnostics.noValidPeriodInPolicyWindow += 1;
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
): Array<{ termIndex: 1 | 2 | 3 | 4; total: number; byZone: Record<string, { count: number; percent: number }> }> {
	const termAgg = new Map<1 | 2 | 3 | 4, Map<string, number>>();
	for (const entry of entries) {
		const termIndex = normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex);
		const zone = roomZoneByRoomId.get(entry.roomId) ?? 'UNSPECIFIED';
		const zoneMap = termAgg.get(termIndex) ?? new Map<string, number>();
		zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + 1);
		termAgg.set(termIndex, zoneMap);
	}

	// Preserve the historical trimester shape; surface the fourth ordered term
	// only when a verified four-term (QUARTERS) run actually carries it.
	const highestTerm = Math.max(3, ...termAgg.keys()) as 1 | 2 | 3 | 4;
	const terms: Array<1 | 2 | 3 | 4> = [];
	for (let term = 1; term <= highestTerm; term += 1) terms.push(term as 1 | 2 | 3 | 4);
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

function normalizeTermIndex(value: unknown): 1 | 2 | 3 | 4 {
	const parsed = Number(value);
	if (parsed === 2) return 2;
	if (parsed === 3) return 3;
	if (parsed === 4) return 4;
	return 1;
}

function deriveTermIndexFromMetadata(entry: ScheduledEntry): 1 | 2 | 3 | 4 {
	const firstTermIndex = entry.metadata?.modularAssignments?.[0]?.termIndex;
	if (firstTermIndex === 2 || firstTermIndex === 3 || firstTermIndex === 4) return firstTermIndex;
	return 1;
}

function resolveEntryTermIndex(entry: ScheduledEntry): 1 | 2 | 3 | 4 {
	return normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex ?? deriveTermIndexFromMetadata(entry));
}

function ensureEntriesHaveTermIndex(entries: ScheduledEntry[]): ScheduledEntry[] {
	for (const entry of entries) {
		entry.termIndex = resolveEntryTermIndex(entry);
	}
	return entries;
}

function buildTermCounts(entries: ScheduledEntry[]): { term1: number; term2: number; term3: number; term4?: number } {
	const counts = { term1: 0, term2: 0, term3: 0, term4: 0 };
	for (const entry of entries) {
		const termIndex = normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex);
		if (termIndex === 2) counts.term2 += 1;
		else if (termIndex === 3) counts.term3 += 1;
		else if (termIndex === 4) counts.term4 += 1;
		else counts.term1 += 1;
	}
	return counts.term4 > 0 ? counts : { term1: counts.term1, term2: counts.term2, term3: counts.term3 };
}

export function buildQualifiedCoverageBySubject(
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

export function buildSlotSaturation(entries: ScheduledEntry[], roomCapacity: number): Array<{ day: string; startTime: string; endTime: string; assigned: number; capacity: number; saturationPercent: number }> {
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

export function buildUnassignedBySubjectGrade(unassignedItems: UnassignedItem[], subjectCodeById: Map<number, string>) {
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
	await assertActiveSchoolYearForGeneration(schoolId, schoolYearId, options?.authToken);

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

	// ── GEN-C02R1 F1: one complete read-only preflight before ANY write ──
	// The trigger consumes the exact same shared assembly as the readiness dry
	// run. Missing persisted setup, blocked authority, invalid demand, and
	// nonuniform rotation contracts are typed blockers here rather than
	// setup-healing writes. No GenerationRun/event/audit/draft/lock/policy/
	// window/template/slot/section/ownership/cycle write may precede this.
	const preflight = await buildGenerationPreflight(schoolId, schoolYearId, {
		enforceShiftWindows: options?.enforceShiftWindows === true,
	});
	if (!preflight.ok) {
		throw err(
			409,
			'GENERATION_PREFLIGHT_BLOCKED',
			'Generation is blocked by its read-only preflight. Resolve the reported setup, authority, and demand items before generating.',
			{
				actionHint: preflight.blockers[0]?.nextAction ?? 'Resolve the reported blockers, then generate again.',
				details: { schoolId, schoolYearId, blockers: preflight.blockers },
			},
		);
	}

	// Revalidate the bound revisions immediately before the first write. Drift is
	// a typed stale-preflight error with zero writes, never a silent rebuild.
	const freshness = await revalidateGenerationPreflight(preflight.assembly);
	if (!freshness.ok) {
		throw err(
			409,
			'GENERATION_PREFLIGHT_STALE',
			'Generation inputs changed after the read-only preflight. Re-run generation so it binds the current setup.',
			{
				actionHint: 'Re-run generation to bind the current setup data.',
				details: { schoolId, schoolYearId, changedRevisions: freshness.changed, blockers: freshness.current.blockers },
			},
		);
	}
	const assembly = preflight.assembly;

	// Create run as QUEUED
	const run = await db().generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			triggeredBy: actorId,
			status: 'QUEUED',
		},
	});

	// Transition to RUNNING
	const startedAt = new Date();
	await db().generationRun.update({
		where: { id: run.id },
		data: { status: 'RUNNING', startedAt },
	});
	publishNotificationEvent({
		type: 'GENERATION_RUN_STARTED',
		domain: 'generation',
		severity: 'info',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId,
		facultyId: null,
		message: `Generation run #${run.id} started.`,
		metadata: {
			runId: run.id,
			actorId,
			roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
			gateOverrideUsed: Boolean(options?.ignoreRoomRequestGate),
			shiftWindowPolicy: options?.enforceShiftWindows === true ? 'ENFORCED' : 'DISABLED',
		},
	});

	let stage = 'init';
	try {
		const enforceShiftWindows = options?.enforceShiftWindows === true;
		stage = 'pre-generation-drafts';
		// GEN-C02R1 F1: the accepted retained placements were already resolved
		// read-only by the shared preflight; no draft consume/setup writer runs here.
		const preGenerationDrafts = {
			lockedEntries: assembly.retained.lockedEntries,
			prePlacedCount: assembly.retained.prePlacedCount,
			invalidPrePlacedCount: assembly.retained.invalidPrePlacedCount,
			skippedPrePlacedReasons: assembly.retained.skippedPrePlacedReasons,
			acceptedPlacementIds: assembly.retained.acceptedPlacementIds,
		};

		// ── G.17: Diagnostic output for pre-gen consume phase ──
		console.log(`[generation][run=${run.id}] pre-gen consume: accepted=${preGenerationDrafts.prePlacedCount}, skipped=${preGenerationDrafts.invalidPrePlacedCount}, lockedEntries=${preGenerationDrafts.lockedEntries?.length ?? 0}`);
		if ((preGenerationDrafts.skippedPrePlacedReasons?.length ?? 0) > 0) {
			console.log(`[generation][run=${run.id}] skipped reasons:`, preGenerationDrafts.skippedPrePlacedReasons.slice(0, 10));
		}

		// ── GEN-C02R1 F1: the bound read-only preflight assembly IS the input ──
		// No subject-catalog reconciliation, section sync, template seeding,
		// grade-window healing, or canonical-slot creation occurs on this path.
		const sectionsByGrade = assembly.sectionsByGrade;
		const cohorts = assembly.cohorts;
		const facultySubjects = assembly.facultySubjects;
		const subjects = assembly.subjects;
		const rooms = assembly.rooms;
		const buildings = assembly.buildings;
		const gradeWindows = assembly.gradeWindows;
		const policyRecord = (assembly.policyRow ?? {}) as any;
		const policyMaxDailyMinutes = policyRecord.maxTeachingMinutesPerDay;
		const demand = assembly.demand;
		const timetableShapeContracts = assembly.timetableShapeContracts;
		const cohortSyncWarnings: string[] = [];
		if (cohorts.length === 0) {
			cohortSyncWarnings.push('No instructional cohorts are currently active for this run; inter-section breakout lanes will fall back to section-scoped demand where needed.');
		}

		stage = 'constructor';
		const constructorInput: ConstructorInput = buildPreflightConstructorInput(assembly, {
			roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
			lockedEntries: preGenerationDrafts.lockedEntries,
		});
		const result = runHybridScheduler(constructorInput);
		const entriesWithTerms = ensureEntriesHaveTermIndex(result.entries);

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

		// ── Validate constructed entries with the same bound assembly policy ──
		stage = 'validator';
		const validatorCtx: ValidatorContext = buildPreflightValidatorContext(assembly, entriesWithTerms, run.id);
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
					homeRoomFallbackCause: item.homeRoomFallbackCause,
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
		const timetableDisplaySlots = buildUnionDisplaySlots(timetableShapeContracts);
		const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);

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
			termCounts,
			contractWarnings: cohortSyncWarnings.length > 0 ? [...cohortSyncWarnings] : undefined,
			// H-ALG-5: Hybrid scheduler diagnostics
			hybridEnabled: result.hybridEnabled,
			selectedSeedProfile: result.selectedProfileId,
			seedQuality: result.seedQuality?.length > 0 ? result.seedQuality : undefined,
			repairImpact: result.repairImpact,
			resourceDiagnostics,
			shiftWindowPolicy: enforceShiftWindows ? 'ENFORCED' : 'DISABLED',
			configuredShiftWindowCount: gradeWindows.length,
			timetableShapeContracts,
			canonicalTemplateVersion: CANONICAL_TEMPLATE_VERSION,
			timetableDisplaySlots,
			inputSnapshot,
			derivedDemandRevision: assembly.derivedDemandRevision ?? undefined,
		};

		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();

		// Finalize as COMPLETED with draft entries
		stage = 'persist';
		const completed = await db().generationRun.update({
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
		await db().auditLog.create({
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
					shiftWindowPolicy: enforceShiftWindows ? 'ENFORCED' : 'DISABLED',
					gradeWindowCount: gradeWindows.length,
					gateOpenRequestCountAtTrigger: gateStatus.openCount,
				} as object,
			},
		});

		await preGenerationDraftService.markPlacementsLockedForRun(schoolId, schoolYearId, run.id, preGenerationDrafts.acceptedPlacementIds);
		publishNotificationEvent({
			type: 'GENERATION_RUN_COMPLETED',
			domain: 'generation',
			severity: summary.hardViolationCount > 0 ? 'warning' : 'success',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: `Generation run #${run.id} completed with ${summary.unassignedCount} unassigned session(s).`,
			metadata: {
				runId: run.id,
				durationMs,
				assignedCount: summary.assignedCount,
				unassignedCount: summary.unassignedCount,
				hardViolationCount: summary.hardViolationCount,
				softViolationCount: mergedValidationResult.violations.filter((violation) => violation.severity === 'SOFT').length,
				roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
				termCounts: summary.termCounts ?? null,
			},
		});

		return completed;
	} catch (error) {
		// Finalize as FAILED with stage-tagged diagnostics
		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();
		const rawMessage = error instanceof Error ? error.message : String(error);
		const errorMessage = `[${stage}] ${rawMessage}`;

		const failed = await db().generationRun.update({
			where: { id: run.id },
			data: {
				status: 'FAILED',
				finishedAt,
				durationMs,
				error: errorMessage,
			},
		});

		await db().auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_FAILED',
				actorId,
				targetIds: [run.id],
				metadata: { durationMs, stage, error: rawMessage } as object,
			},
		});
		publishNotificationEvent({
			type: 'GENERATION_RUN_FAILED',
			domain: 'generation',
			severity: 'error',
			audience: 'PRIVILEGED',
			schoolId,
			schoolYearId,
			facultyId: null,
			message: `Generation run #${run.id} failed during ${stage}.`,
			metadata: {
				runId: failed.id,
				durationMs,
				stage,
				error: rawMessage,
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

	const openCount = await db().facultyRoomPreference.count({
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
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	return run;
}

export async function getLatestRun(schoolId: number, schoolYearId: number) {
	const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
	return getRunById(runId, schoolId, schoolYearId);
}

async function resolveLatestValidRunId(schoolId: number, schoolYearId: number): Promise<number> {
	const [runCandidates, activeFacultyIds] = await Promise.all([
		db().generationRun.findMany({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				schoolYearId: true,
				status: true,
				createdAt: true,
				summary: true,
			},
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	if (runCandidates.length === 0) {
		throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
	}

	for (const candidate of runCandidates) {
		const runDraft = await db().generationRun.findUnique({
			where: { id: candidate.id },
			select: { id: true, draftEntries: true },
		});
		if (runDraft && getStaleFacultyIdsForRun(runDraft, activeFacultyIds).length === 0) {
			return candidate.id;
		}
	}

	const latestRun = await db().generationRun.findUnique({
		where: { id: runCandidates[0].id },
		select: { id: true, draftEntries: true },
	});
	const staleFacultyIds = latestRun ? getStaleFacultyIdsForRun(latestRun, activeFacultyIds) : [];
	throw err(
		409,
		'STALE_RUN_DATA',
		'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.',
		{
			actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
			details: { latestRunId: runCandidates[0].id, staleFacultyIds },
		},
	);
}

export async function assertLatestRunIsCurrent(schoolId: number, schoolYearId: number) {
	const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
	return getRunById(runId, schoolId, schoolYearId);
}

export async function listRuns(schoolId: number, schoolYearId: number, limit: number = 20) {
	const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 20;
	const safeLimit = Math.min(Math.max(normalizedLimit, 1), 100);
	return db().generationRun.findMany({
		where: { schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
		take: safeLimit,
		select: {
			id: true,
			schoolId: true,
			schoolYearId: true,
			status: true,
			runType: true,
			triggeredBy: true,
			startedAt: true,
			finishedAt: true,
			durationMs: true,
			error: true,
			version: true,
			createdAt: true,
			updatedAt: true,
		},
	});
}

/** Select a safe fixture source without loading any timetable JSON payloads. */
export async function getPerformanceFixtureSource(schoolId: number, schoolYearId: number) {
	const candidates = await db().generationRun.findMany({
		where: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			runType: { not: 'PERFORMANCE_FIXTURE' },
		},
		orderBy: { createdAt: 'desc' },
		take: 50,
		select: { id: true, summary: true, createdAt: true },
	});
	// First try to find a zero-hard-violation run (ideal case)
	const idealSource = candidates.find((candidate) => {
		const summary = asSummaryRecord(candidate.summary);
		return !hasPublishedMarkers(summary) && Number(summary.hardViolationCount ?? 0) === 0;
	});
	if (idealSource) {
		return { id: idealSource.id, createdAt: idealSource.createdAt.toISOString() };
	}
	// Fallback: allow runs with hard violations if they have enough entries for teacher reassignment
	const fallbackSource = candidates.find((candidate) => {
		const summary = asSummaryRecord(candidate.summary);
		const entryCount = Number(summary.assignedCount ?? 0);
		return !hasPublishedMarkers(summary) && entryCount >= 10;
	});
	if (fallbackSource) {
		return { id: fallbackSource.id, createdAt: fallbackSource.createdAt.toISOString() };
	}
	throw err(404, 'NO_FIXTURE_SOURCE', 'No completed, unpublished run with enough entries is available for performance verification.');
}

type PerformanceFixturePurpose = 'PERFORMANCE' | 'TEACHER_DEPARTURE';

function isDraftEntryRecord(value: unknown): value is ScheduledEntry & Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function maybePositiveInt(value: unknown): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n > 0 ? n : null;
}

async function preparePerformanceFixtureDraftEntries(
	draftEntries: unknown[],
	schoolId: number,
	schoolYearId: number,
	purpose: PerformanceFixturePurpose,
): Promise<{ draftEntries: unknown[]; metadata: Record<string, unknown> }> {
	if (purpose !== 'TEACHER_DEPARTURE') {
		return { draftEntries, metadata: { purpose } };
	}

	const entries = draftEntries.map((entry) => (isDraftEntryRecord(entry) ? { ...entry } : entry));
	const entryRecords = entries.filter(isDraftEntryRecord);
	const subjectIds = [...new Set(entryRecords.map((entry) => maybePositiveInt(entry.subjectId)).filter((id): id is number => id != null))];
	const subjectRows = subjectIds.length === 0
		? []
		: await db().subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true },
		});
	const subjectCodeById = new Map(subjectRows.map((subject) => [subject.id, subject.code.toUpperCase()]));
	const candidatePairMap = new Map<string, { subjectId: number; sectionId: number }>();
	for (const entry of entryRecords) {
		if (entry.entryKind === 'COHORT') continue;
		const subjectId = maybePositiveInt(entry.subjectId);
		const sectionId = maybePositiveInt(entry.sectionId);
		if (!subjectId || !sectionId || subjectCodeById.get(subjectId) === 'HG') continue;
		candidatePairMap.set(`${subjectId}:${sectionId}`, { subjectId, sectionId });
	}
	const candidatePairs = [...candidatePairMap.values()];
	if (candidatePairs.length === 0) {
		throw err(409, 'TEACHER_DEPARTURE_FIXTURE_UNAVAILABLE', 'No section timetable entries are available for a teacher-departure fixture.');
	}

	const [ownershipRows, activeFaculty] = await Promise.all([
		db().subjectSectionOwnership.findMany({
			where: {
				schoolId,
				schoolYearId,
				OR: candidatePairs.map((pair) => ({ subjectId: pair.subjectId, sectionId: pair.sectionId })),
			},
			select: { facultyId: true, subjectId: true, sectionId: true },
		}),
		db().facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true },
			select: { id: true },
			orderBy: { id: 'asc' },
		}),
	]);
	const activeFacultyIds = new Set(activeFaculty.map((faculty) => faculty.id));
	const ownerByPair = new Map(ownershipRows.map((owner) => [`${owner.subjectId}:${owner.sectionId}`, owner.facultyId]));

	for (const pair of candidatePairs) {
		const sourceFacultyId = ownerByPair.get(`${pair.subjectId}:${pair.sectionId}`);
		if (!sourceFacultyId || !activeFacultyIds.has(sourceFacultyId)) continue;
		const targetFacultyId = activeFaculty.find((faculty) => faculty.id !== sourceFacultyId)?.id ?? null;
		if (!targetFacultyId) continue;

		const affectedEntries = entryRecords.filter((entry) =>
			maybePositiveInt(entry.subjectId) === pair.subjectId
			&& maybePositiveInt(entry.sectionId) === pair.sectionId
			&& entry.entryKind !== 'COHORT',
		);
		if (affectedEntries.length === 0) continue;
		const section = await db().sectionMirror.findFirst({
			where: { schoolId, schoolYearId, externalId: pair.sectionId },
			select: { name: true },
		});

		for (const entry of entryRecords) {
			if (entry.facultyId === sourceFacultyId || entry.facultyId === targetFacultyId) {
				entry.facultyId = null;
			}
		}
		for (const entry of affectedEntries) {
			entry.facultyId = sourceFacultyId;
		}

		return {
			draftEntries: entries,
			metadata: {
				purpose,
				sourceFacultyId,
				targetFacultyId,
				subjectId: pair.subjectId,
				sectionId: pair.sectionId,
				sectionName: section?.name ?? null,
				affectedEntryIds: affectedEntries.map((entry) => entry.entryId).filter((entryId): entryId is string => typeof entryId === 'string'),
			},
		};
	}

	throw err(409, 'TEACHER_DEPARTURE_FIXTURE_UNAVAILABLE', 'No active canonical teacher pair is available for a reversible teacher-departure fixture.');
}

/**
 * Create an isolated completed run for destructive performance verification.
 * The fixture is deliberately marked in both runType and summary metadata so
 * the companion deletion operation can never target an operator-owned run.
 */
export async function createPerformanceFixture(
	sourceRunId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	options: { purpose?: PerformanceFixturePurpose } = {},
) {
	const source = await db().generationRun.findFirst({
		where: { id: sourceRunId, schoolId, schoolYearId, status: 'COMPLETED' },
		select: {
			id: true,
			summary: true,
			violations: true,
			draftEntries: true,
			unassignedItems: true,
		},
	});
	if (!source) throw err(404, 'RUN_NOT_FOUND', 'Completed source run not found in this school/year scope.');
	if (hasPublishedMarkers(source.summary)) {
		throw err(409, 'PUBLISHED_RUN_FORBIDDEN', 'A published timetable cannot be used as a performance fixture source.');
	}
	if (!Array.isArray(source.draftEntries) || source.draftEntries.length === 0) {
		throw err(409, 'EMPTY_RUN_FORBIDDEN', 'A performance fixture requires at least one scheduled entry.');
	}

	const now = new Date();
	const purpose = options.purpose ?? 'PERFORMANCE';
	const preparedDraft = await preparePerformanceFixtureDraftEntries(source.draftEntries, schoolId, schoolYearId, purpose);
	const fixtureSummary = {
		...asSummaryRecord(source.summary),
		isPublished: false,
		publishedAt: null,
		publishedBy: null,
		performanceFixture: {
			sourceRunId: source.id,
			createdBy: actorId,
			createdAt: now.toISOString(),
			reversible: true,
			...preparedDraft.metadata,
		},
	};
	const fixture = await db().generationRun.create({
		data: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			runType: 'PERFORMANCE_FIXTURE',
			triggeredBy: actorId,
			startedAt: now,
			finishedAt: now,
			durationMs: 0,
			summary: fixtureSummary as object,
			violations: (source.violations ?? []) as object,
			draftEntries: preparedDraft.draftEntries as object,
			unassignedItems: (source.unassignedItems ?? []) as object,
			version: 1,
		},
		select: { id: true, version: true, createdAt: true },
	});
	await db().auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'PERFORMANCE_FIXTURE_CREATED',
			actorId,
			targetIds: [fixture.id],
			metadata: { sourceRunId, fixtureRunId: fixture.id, reversible: true, ...preparedDraft.metadata } as object,
		},
	});
	return { ...fixture, sourceRunId, fixtureMetadata: preparedDraft.metadata };
}

/** Remove only an explicitly marked performance fixture and its cascade-owned edits. */
export async function deletePerformanceFixture(
	fixtureRunId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
) {
	const fixture = await db().generationRun.findFirst({
		where: { id: fixtureRunId, schoolId, schoolYearId },
		select: { id: true, runType: true, summary: true },
	});
	const marker = asSummaryRecord(fixture?.summary).performanceFixture as Record<string, unknown> | undefined;
	if (!fixture || fixture.runType !== 'PERFORMANCE_FIXTURE' || marker?.reversible === false) {
		throw err(409, 'FIXTURE_DELETE_FORBIDDEN', 'Only a marked performance fixture can be deleted.');
	}
	await db().$transaction([
		db().generationRun.delete({ where: { id: fixture.id } }),
		db().auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PERFORMANCE_FIXTURE_DELETED',
				actorId,
				targetIds: [fixture.id],
				metadata: { fixtureRunId: fixture.id, sourceRunId: marker?.sourceRunId ?? null } as object,
			},
		}),
	]);
	return { fixtureRunId: fixture.id, deleted: true };
}

export async function publishRun(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	actorId: number,
	options?: {
		acknowledgeSoftViolations?: boolean;
		actorSchoolId?: number;
	},
	dependencies: Parameters<typeof publishSchedule>[1] = {},
) {
	return publishSchedule({
		schoolId,
		schoolYearId,
		runId,
		actorId,
		actorSchoolId: options?.actorSchoolId ?? 0,
		acknowledgeSoftViolations: options?.acknowledgeSoftViolations,
	}, dependencies);
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
	if (termIndex !== 1 && termIndex !== 2 && termIndex !== 3 && termIndex !== 4) {
		return violations;
	}

	const entryTermById = new Map(entries.map((entry) => [entry.entryId, resolveEntryTermIndex(entry)]));
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
	const resolvedTermIndex = termIndex === undefined ? undefined : await resolveRequestedTermIndex(schoolId, schoolYearId, termIndex);
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	const entries = ensureEntriesHaveTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]);
	const violations = filterViolationsByTerm((run.violations ?? []) as unknown as Violation[], entries, resolvedTermIndex);
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
	const resolvedTermIndex = termIndex === undefined ? undefined : await resolveRequestedTermIndex(schoolId, schoolYearId, termIndex);
	const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	const entries = ensureEntriesHaveTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]);
	const violations = filterViolationsByTerm((run.violations ?? []) as unknown as Violation[], entries, resolvedTermIndex);
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
	inputState?: GenerationInputComparison;
	version: number;
	finishedAt: string | null;
	createdAt: string;
}

async function buildDraftReport(run: {
	id: number;
	status: GenerationRunStatus;
	draftEntries: unknown;
	unassignedItems: unknown;
	summary: unknown;
	version: number;
	finishedAt: Date | null;
	createdAt: Date;
}, schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const inputState = await compareCurrentInputsForRun(run.summary, schoolId, schoolYearId);

	return {
		runId: run.id,
		status: run.status,
		entries: ensureEntriesHaveTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]),
		unassignedItems: (run.unassignedItems ?? []) as unknown as UnassignedItem[],
		summary: (run.summary ?? null) as RunSummary | null,
		inputState,
		version: run.version,
		finishedAt: run.finishedAt?.toISOString() ?? null,
		createdAt: run.createdAt.toISOString(),
	};
}

export async function getRunDraft(runId: number, schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	return buildDraftReport(run, schoolId, schoolYearId);
}

export async function getLatestRunDraft(schoolId: number, schoolYearId: number): Promise<DraftReport> {
	const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	return buildDraftReport(run, schoolId, schoolYearId);
}

export async function invalidateStaleCompletedRuns(schoolId: number, schoolYearId: number) {
	const [runs, activeFacultyIds] = await Promise.all([
		db().generationRun.findMany({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			select: { id: true, schoolYearId: true, status: true, draftEntries: true, summary: true },
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	const staleRuns = runs.filter((run) => getStaleFacultyIdsForRun(run, activeFacultyIds).length > 0);
	const staleRunIds = staleRuns.map((run) => run.id);

	if (staleRunIds.length === 0) {
		return { invalidatedCount: 0, staleRunIds: [] as number[], unpublishedRunIds: [] as number[] };
	}

	const reconciledAtIso = new Date().toISOString();
	const unpublishedRunIds: number[] = [];
	await db().$transaction(async (tx) => {
		for (const run of staleRuns) {
			const wasPublished = hasPublishedMarkers(run.summary);
			const data: {
				status: 'FAILED';
				error: string;
				summary?: object;
			} = {
				status: 'FAILED',
				error: 'INVALIDATED_BY_MIRROR_RESET',
			};

			if (wasPublished) {
				data.summary = buildUnpublishedSummary(run.summary, {
					reason: 'INVALIDATED_BY_MIRROR_RESET',
					previousStatus: run.status,
					reconciledAtIso,
				}) as object;
				unpublishedRunIds.push(run.id);
			}

			await tx.generationRun.update({
				where: { id: run.id },
				data,
			});
		}
	});

	return { invalidatedCount: staleRunIds.length, staleRunIds, unpublishedRunIds };
}
