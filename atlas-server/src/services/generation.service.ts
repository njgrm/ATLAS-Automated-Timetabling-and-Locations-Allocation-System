/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 *
 * Prompt 03A: all data access resolves through the injectable data context so
 * tests can instrument the exact production path. Production uses the singleton.
 */

const db = () => getDataContext();

import { getDataContext } from '../lib/data-context.js';
import { Prisma, type GenerationRunStatus } from '@prisma/client';
import {
	applyConstraintOverrides,
	validateHardConstraints,
	VIOLATION_CODES,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
	type Violation,
	type ViolationCode,
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
import {
	resolvePerTermScheduleEntries,
	resolvePerTermUnassignedItems,
	type OrderedTermRef,
} from './per-term-schedule-resolution.service.js';
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
import { isPromotableConstraintCode } from './scheduling-policy.service.js';

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

/**
 * TIMETABLE-TRUTHFULNESS-C01 (D1) — the publication marker exposed by the run
 * list. Mirrors the canonical strict predicate every workspace consumer uses
 * (`atlas-client/src/components/timetable/timetableWorkspaceTruth.ts`
 * `isRunPublishedStrict`: `summary.isPublished === true`) so the list and the
 * workspace can never disagree. A superseded run keeps `isPublished:false` and
 * therefore never reads as live even though it retains its old publish markers.
 */
function isRunPublishedForList(summary: unknown): boolean {
	return asSummaryRecord(summary).isPublished === true;
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
	/**
	 * Run-wide HARD violations that may actually block publication, i.e. only
	 * codes on the server-owned promotable allowlist (R4/F2). Always <=
	 * `hardViolationCount`. `hardViolationCount` remains the unfiltered display
	 * count.
	 */
	blockingHardViolationCount?: number;
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

/**
 * C07A — truthful violation code for an unassigned session.
 *
 * The observed failure cause decides the code. A faculty/data refusal (missing
 * subject, missing qualified faculty, workload refusal, availability refusal) is
 * NEVER laundered into the SOFT specialized-room warning; `SPECIALIZED_ROOM_UNAVAILABLE`
 * requires both a room-path failure (`NO_COMPATIBLE_ROOM`) and the
 * specialized-room authority recorded by the constructor.
 */
export function resolveUnassignedViolationCode(item: Pick<UnassignedItem, 'reason' | 'roomAssignmentReason'>): {
	code: 'LACKING_FACULTY' | 'SPECIALIZED_ROOM_UNAVAILABLE' | 'UNASSIGNED_SECTION';
	severity: 'HARD' | 'SOFT';
} {
	if (item.reason === 'NO_QUALIFIED_FACULTY' || item.roomAssignmentReason === 'NO_QUALIFIED_FACULTY') {
		// Missing subject / missing qualified teacher: a structural faculty-authority
		// blocker, never a room result.
		return { code: 'LACKING_FACULTY', severity: 'HARD' };
	}
	if (
		item.reason === 'FACULTY_OVERLOADED'
		|| item.roomAssignmentReason === 'FACULTY_SLOT_UNAVAILABLE'
		|| item.roomAssignmentReason === 'POLICY_SLOT_BLOCKED'
	) {
		return { code: 'UNASSIGNED_SECTION', severity: 'HARD' };
	}
	if (item.reason === 'NO_COMPATIBLE_ROOM' && item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE') {
		return { code: 'SPECIALIZED_ROOM_UNAVAILABLE', severity: 'SOFT' };
	}
	return { code: 'UNASSIGNED_SECTION', severity: 'HARD' };
}

export type ZoneDistributionByTerm = Array<{
	termIndex: 1 | 2 | 3 | 4;
	total: number;
	byZone: Record<string, { count: number; percent: number; entryIds: string[] }>;
}>;

export function buildZoneDistributionByTerm(
	entries: ScheduledEntry[],
	roomZoneByRoomId: Map<number, string>,
): ZoneDistributionByTerm {
	const termAgg = new Map<1 | 2 | 3 | 4, Map<string, { count: number; entryIds: string[] }>>();
	for (const entry of entries) {
		const termIndex = normalizeTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex);
		const zone = roomZoneByRoomId.get(entry.roomId) ?? 'UNSPECIFIED';
		const zoneMap = termAgg.get(termIndex) ?? new Map<string, { count: number; entryIds: string[] }>();
		const bucket = zoneMap.get(zone) ?? { count: 0, entryIds: [] };
		bucket.count += 1;
		bucket.entryIds.push(entry.entryId);
		zoneMap.set(zone, bucket);
		termAgg.set(termIndex, zoneMap);
	}

	// Preserve the historical trimester shape; surface the fourth ordered term
	// only when a verified four-term (QUARTERS) run actually carries it.
	const highestTerm = Math.max(3, ...termAgg.keys()) as 1 | 2 | 3 | 4;
	const terms: Array<1 | 2 | 3 | 4> = [];
	for (let term = 1; term <= highestTerm; term += 1) terms.push(term as 1 | 2 | 3 | 4);
	return terms.map((termIndex) => {
		const zoneMap = termAgg.get(termIndex) ?? new Map<string, { count: number; entryIds: string[] }>();
		const total = [...zoneMap.values()].reduce((sum, bucket) => sum + bucket.count, 0);
		const byZone: Record<string, { count: number; percent: number; entryIds: string[] }> = {};
		for (const [zone, bucket] of zoneMap.entries()) {
			byZone[zone] = {
				count: bucket.count,
				percent: total > 0 ? Math.round((bucket.count / total) * 10000) / 100 : 0,
				entryIds: [...bucket.entryIds].sort(),
			};
		}
		return { termIndex, total, byZone };
	});
}

/**
 * ZONE-WARNING-REMOVAL-C01 — the zone-imbalance warning producer lived here
 * and was deleted: a school that cannot spread classes across campus cannot
 * act on this warning, so no new generation may emit it. The
 * `zoneDistributionByTerm` diagnostic above stays (the run rail renders it),
 * the code stays in `VIOLATION_CODES` so stored rows render with historical
 * wording, and the UNSPECIFIED suppression in `projectViolationIssues` stays
 * so stored noise never resurfaces.
 */

/**
 * TT-OUTPUT-C03R3: a missing term identity is NEVER coerced to Term 1.
 *
 * `normalizeTermIndex` remains a display/diagnostic bucket for entries that are
 * already resolved; the read helpers below use `explicitTermIndex` so an
 * unresolved entry contributes to no selected term instead of silently joining
 * the first one.
 */
function normalizeTermIndex(value: unknown): 1 | 2 | 3 | 4 {
	const parsed = Number(value);
	if (parsed === 2) return 2;
	if (parsed === 3) return 3;
	if (parsed === 4) return 4;
	return 1;
}

function explicitTermIndex(value: unknown): 1 | 2 | 3 | 4 | null {
	const parsed = Number(value);
	if (parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4) return parsed;
	return null;
}

function deriveTermIndexFromMetadata(entry: ScheduledEntry): 1 | 2 | 3 | 4 | null {
	return explicitTermIndex(entry.metadata?.modularAssignments?.[0]?.termIndex);
}

function resolveEntryTermIndex(entry: ScheduledEntry): number {
	return explicitTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex)
		?? deriveTermIndexFromMetadata(entry)
		?? 0;
}

function ensureEntriesHaveTermIndex(entries: ScheduledEntry[]): ScheduledEntry[] {
	for (const entry of entries) {
		const resolved = explicitTermIndex((entry as ScheduledEntry & { termIndex?: unknown }).termIndex)
			?? deriveTermIndexFromMetadata(entry);
		if (resolved != null) entry.termIndex = resolved;
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

	// ── SOURCE-FRESHNESS B-03: capture ONE canonical source snapshot BEFORE any
	// scheduling and bind the produced output to it. The post-scheduling global
	// snapshot (`computeGenerationInputSnapshot(schoolId, schoolYearId)`) is no
	// longer used: it could attach a newer snapshot to output computed from older
	// data. The captured fingerprint is revalidated with the TRANSACTION client
	// inside the final Serializable write transaction below; any covered input
	// change aborts with typed `SOURCE_AUTHORITY_STALE` and zero COMPLETED writes.
	const capturedSourceSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);

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

		// ── TT-OUTPUT-C03R3: resolve EXPLICIT per-term entries BEFORE validation
		// and persistence. The former `ensureEntriesHaveTermIndex` collapsed every
		// year-long entry into Term 1 and left rotating lanes split across terms.
		// The resolver replaces both with one entry per applicable ordered term.
		const termRefs: OrderedTermRef[] = (assembly.termStructure?.terms ?? []).map((term) => ({
			identity: term.identity,
			order: term.order,
			displayLabel: term.displayLabel,
		}));
		const subjectIdByCode = new Map(subjects.map((subject) => [subject.code, subject.id]));
		const entriesWithTerms: ScheduledEntry[] = termRefs.length > 0
			? (resolvePerTermScheduleEntries(result.entries, termRefs, { subjectIdByCode }) as unknown as ScheduledEntry[])
			: (result.entries as ScheduledEntry[]);
		const resolvedUnassignedItems: UnassignedItem[] = termRefs.length > 0
			? (resolvePerTermUnassignedItems(result.unassignedItems, termRefs) as unknown as UnassignedItem[])
			: result.unassignedItems;

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
		const unassignedViolations: Violation[] = resolvedUnassignedItems.map((item) => {
			// C07A: the violation code is derived from the OBSERVED failure cause, not
			// from the room label alone. A missing subject / missing qualified
			// faculty / workload refusal is never laundered into a SOFT specialized
			// room warning; the room code requires both a room-path failure and the
			// specialized-room authority recorded by the constructor.
			const verdict = resolveUnassignedViolationCode(item);
			const isSpecializedUnavailable = verdict.code === 'SPECIALIZED_ROOM_UNAVAILABLE';
			const isLackingFaculty = verdict.code === 'LACKING_FACULTY';
			return {
				code: verdict.code,
				severity: verdict.severity,
				message: isSpecializedUnavailable
					? `Section ${item.sectionId} subject ${item.subjectId} could not be assigned to a specialized room in term ${item.termIndex} session ${item.session}.`
					: isLackingFaculty
						? `Section ${item.sectionId} subject ${item.subjectId} has no qualified faculty available in term ${item.termIndex} session ${item.session}.`
						: `Section ${item.sectionId} subject ${item.subjectId} remained unassigned in term ${item.termIndex} session ${item.session}.`,
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
					termIndex: item.termIndex,
				},
			};
		});

		const roomZoneByRoomId = new Map<number, string>(
			rooms.map((room) => [room.id, room.buildingZoneId ?? 'UNSPECIFIED']),
		);
		const zoneDistributionByTerm = buildZoneDistributionByTerm(entriesWithTerms, roomZoneByRoomId);
		// C07A: every injected violation obeys the same configured authority as the
		// validator's own violations (disable-drop, allowlisted promotion, weight).
		const injectedViolations = applyConstraintOverrides(
			[...modularWarningViolations, ...unassignedViolations],
			validatorCtx.constraintConfig,
		);
		const mergedViolationCounts = { ...validationResult.counts.byCode } as Record<string, number>;
		for (const warning of injectedViolations) {
			mergedViolationCounts[warning.code] = (mergedViolationCounts[warning.code] ?? 0) + 1;
		}
		const mergedValidationResult: ValidationResult = {
			violations: [
				...validationResult.violations,
				...injectedViolations,
			],
			counts: {
				total: validationResult.counts.total + injectedViolations.length,
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
			blockingHardViolationCount: mergedValidationResult.violations.filter((v) => v.severity === 'HARD' && isPromotableConstraintCode(v.code)).length,
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
			derivedDemandRevision: assembly.derivedDemandRevision ?? undefined,
		};

		const finishedAt = new Date();
		const durationMs = finishedAt.getTime() - startedAt.getTime();

		// Finalize as COMPLETED with draft entries, binding the persisted
		// `inputSnapshot` to the source snapshot that produced the schedule.
		// The complete fingerprint is recomputed with the TRANSACTION client and
		// compared against the captured pre-scheduling snapshot; ANY covered input
		// change (rooms/buildings, grade-shift windows, policy, subjects/templates,
		// sections, faculty mirrors/qualifications/ownership, or the verified
		// ordered-term + derived-demand revision) aborts with typed
		// `SOURCE_AUTHORITY_STALE` and zero COMPLETED timetable / zero success audit
		// / zero success notification.
		stage = 'persist';
		const completed = await db().$transaction(async (tx) => {
			const txInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, tx);
			if (txInputSnapshot.fingerprint !== capturedSourceSnapshot.fingerprint) {
				throw err(
					409,
					'SOURCE_AUTHORITY_STALE',
					'Generation inputs changed while this schedule was being built. Re-run generation so it binds the current setup.',
					{
						actionHint: 'Re-run generation to bind the current setup data.',
						details: { schoolId, schoolYearId },
					},
				);
			}
			const boundSummary: RunSummary = { ...summary, inputSnapshot: txInputSnapshot };

			const updated = await tx.generationRun.update({
				where: { id: run.id },
				data: {
					status: 'COMPLETED',
					finishedAt,
					durationMs,
					summary: boundSummary as object,
					violations: mergedValidationResult.violations as unknown as object[],
					draftEntries: entriesWithTerms as unknown as object[],
					unassignedItems: resolvedUnassignedItems as unknown as object[],
				},
			});

			// Audit log
			await tx.auditLog.create({
				data: {
					schoolId,
					schoolYearId,
					action: 'GENERATION_RUN_COMPLETED',
					actorId,
					targetIds: [run.id],
					metadata: {
						durationMs,
						summary: boundSummary,
						gateOverrideUsed: Boolean(options?.ignoreRoomRequestGate),
						roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
						shiftWindowPolicy: enforceShiftWindows ? 'ENFORCED' : 'DISABLED',
						gradeWindowCount: gradeWindows.length,
						gateOpenRequestCountAtTrigger: gateStatus.openCount,
					} as object,
				},
			});

			return updated;
		}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 10_000 });

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

		// SOURCE-FRESHNESS B-03: a stale source rejection is recorded as FAILED
		// under the existing lifecycle (no completed timetable/audit/notification),
		// but the typed error must reach the route so the operator sees
		// `SOURCE_AUTHORITY_STALE` rather than a generic failure.
		if ((error as { code?: string } | null | undefined)?.code === 'SOURCE_AUTHORITY_STALE') {
			throw error;
		}

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

/**
 * TIMETABLE-TRUTHFULNESS-C01 (D1) — the one runtime-active publication for the
 * exact school/year, resolved in SQL with the same strict predicate the
 * Dashboard publication path uses (`status = COMPLETED` AND
 * `summary.isPublished = true`) and the same deterministic
 * newest-first ordering. Cheap: a single indexed id-only read, independent of
 * the requested list window, so a publication older than the window is still
 * named instead of silently reading as "none published".
 */
export async function resolveActivePublishedRunId(schoolId: number, schoolYearId: number): Promise<number | null> {
	const row = await db().generationRun.findFirst({
		where: {
			schoolId,
			schoolYearId,
			status: 'COMPLETED',
			summary: { path: ['isPublished'], equals: true },
		},
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		select: { id: true },
	});
	return row?.id ?? null;
}

export async function listRuns(schoolId: number, schoolYearId: number, limit: number = 20) {
	const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 20;
	const safeLimit = Math.min(Math.max(normalizedLimit, 1), 100);
	const [runs, activePublishedRunId] = await Promise.all([
		db().generationRun.findMany({
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
				// D1 — the list previously omitted every publication marker, so a
				// consumer could not tell a published run from an unpublished one
				// from the list alone ("all COMPLETED" was mis-read as "none
				// published" while two revisions were live). Only the publication
				// flag is projected out of `summary`; no other summary payload is
				// returned (heavy inputSnapshot/resourceDiagnostics stay unloaded
				// from the response).
				summary: true,
			},
		}),
		resolveActivePublishedRunId(schoolId, schoolYearId),
	]);
	return {
		activePublishedRunId,
		runs: runs.map(({ summary, ...run }) => ({
			...run,
			summary: { isPublished: isRunPublishedForList(summary) },
		})),
	};
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
		/**
		 * Documented scope of the `violations` array and the `total`/`byCode`
		 * fields above. When a term filter is requested the display scope is
		 * `SELECTED_TERM`; otherwise it is `RUN_WIDE`.
		 */
		scope: 'RUN_WIDE' | 'SELECTED_TERM';
		/**
		 * Run-wide authoritative gate counts, independent of the selected-term
		 * display filter. The client publish gate must consume `runWide.hard`;
		 * the rail keeps rendering the term-scoped display list.
		 */
		runWide: {
			total: number;
			hard: number;
			/** HARD violations on the server publication allowlist (the real gate). */
			blockingHard: number;
			soft: number;
			byCode: Record<string, number>;
		};
	};
}

const COMBINED_FACULTY_PRESSURE_CODES = new Set<ViolationCode>([
	'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
]);

function violationTermIndex(
	violation: Violation,
	entryTermById: Map<string, number | undefined>,
): number | undefined {
	const explicit = violation.meta?.termIndex;
	if (typeof explicit === 'number') return explicit;
	const terms = new Set(
		(violation.entities?.entryIds ?? [])
			.map((entryId) => entryTermById.get(entryId))
			.filter((term): term is number => typeof term === 'number'),
	);
	return terms.size === 1 ? [...terms][0] : undefined;
}

function normalizedEntryIds(violation: Violation): string[] {
	return [...new Set((violation.entities?.entryIds ?? []).map((entryId) => entryId.replace(/::t[1-4]$/i, '')))].sort();
}

function violationsShareEntries(left: Violation, right: Violation): boolean {
	const leftIds = new Set(normalizedEntryIds(left));
	return normalizedEntryIds(right).some((entryId) => leftIds.has(entryId));
}

function exactIssueKey(violation: Violation): string {
	return JSON.stringify({
		code: violation.code,
		severity: violation.severity,
		termIndex: violation.meta?.termIndex ?? null,
		facultyId: violation.entities?.facultyId ?? null,
		roomId: violation.entities?.roomId ?? null,
		sectionId: violation.entities?.sectionId ?? null,
		subjectId: violation.entities?.subjectId ?? null,
		day: violation.entities?.day ?? null,
		startTime: violation.entities?.startTime ?? null,
		endTime: violation.entities?.endTime ?? null,
		entryIds: normalizedEntryIds(violation),
	});
}

function relatedCodes(violation: Violation): ViolationCode[] {
	const related = Array.isArray(violation.meta?.relatedCodes)
		? violation.meta.relatedCodes.filter((code): code is ViolationCode => typeof code === 'string' && (VIOLATION_CODES as readonly string[]).includes(code))
		: [];
	return [...new Set<ViolationCode>([violation.code, ...related])];
}

function mergePresentedViolations(primary: Violation, supporting: Violation): Violation {
	return {
		...primary,
		entities: {
			...primary.entities,
			entryIds: [...new Set([...(primary.entities?.entryIds ?? []), ...(supporting.entities?.entryIds ?? [])])],
		},
		meta: {
			...(primary.meta ?? {}),
			relatedCodes: [...new Set([...relatedCodes(primary), ...relatedCodes(supporting)])],
			relatedMessages: [...new Set([
				...(Array.isArray(primary.meta?.relatedMessages) ? primary.meta.relatedMessages.filter((message): message is string => typeof message === 'string') : [primary.message]),
				supporting.message,
			])],
		},
	};
}

/**
 * Project persisted validator rows into operator-facing issues. The persisted
 * rows remain untouched for audit/publication acknowledgement. This projection
 * removes exact duplicate instances within one ordered term, combines the two
 * overlapping faculty-day pressure labels, and omits the meaningless
 * UNSPECIFIED-zone warning stored by historical runs without zone authority.
 *
 * ZONE-IMBALANCE-PRECONDITION-C01: the producer can no longer emit an
 * UNSPECIFIED zone (unzoned entries are excluded before the warning is
 * considered), so this suppression hides no live path. It is kept because
 * historical persisted rows — e.g. run 315's three UNSPECIFIED warnings —
 * still carry `meta.zone === 'UNSPECIFIED'` and must keep projecting to
 * nothing rather than resurfacing as operator noise.
 */
export function projectViolationIssues(
	violations: Violation[],
	entries: ScheduledEntry[],
): Violation[] {
	const entryTermById = new Map(entries.map((entry) => [entry.entryId, resolveEntryTermIndex(entry)]));
	const projected: Violation[] = [];
	const exactIndex = new Map<string, number>();

	for (const raw of violations) {
		// Kept (not unreachable cleanup): historical runs stored UNSPECIFIED-zone
		// warnings that must stay suppressed; new generations cannot produce them.
		if (raw.code === 'ZONE_IMBALANCE_WARNING' && raw.meta?.zone === 'UNSPECIFIED') continue;
		const termIndex = violationTermIndex(raw, entryTermById);
		const violation: Violation = {
			...raw,
			entities: { ...(raw.entities ?? {}), entryIds: [...(raw.entities?.entryIds ?? [])] },
			meta: { ...(raw.meta ?? {}), ...(termIndex === undefined ? {} : { termIndex }) },
		};
		const key = exactIssueKey(violation);
		const exact = exactIndex.get(key);
		if (exact !== undefined) {
			projected[exact] = mergePresentedViolations(projected[exact], violation);
			continue;
		}

		const related = projected.findIndex((candidate) =>
			COMBINED_FACULTY_PRESSURE_CODES.has(candidate.code)
			&& COMBINED_FACULTY_PRESSURE_CODES.has(violation.code)
			&& candidate.meta?.termIndex === violation.meta?.termIndex
			&& candidate.entities?.facultyId === violation.entities?.facultyId
			&& candidate.entities?.day === violation.entities?.day
			&& violationsShareEntries(candidate, violation),
		);
		if (related >= 0) {
			projected[related] = mergePresentedViolations(projected[related], violation);
			continue;
		}

		exactIndex.set(key, projected.length);
		projected.push(violation);
	}

	return projected;
}

export function buildViolationReport(
	run: { id: number; status: string; violations: unknown; summary: unknown; draftEntries: unknown },
	resolvedTermIndex: number | undefined,
): ViolationReport {
	const entries = ensureEntriesHaveTermIndex((run.draftEntries ?? []) as unknown as ScheduledEntry[]);
	const persistedViolations = (run.violations ?? []) as unknown as Violation[];
	const allViolations = projectViolationIssues(persistedViolations, entries);
	const violations = filterViolationsByTerm(allViolations, entries, resolvedTermIndex);
	const runWideByCode: Record<string, number> = {};
	for (const violation of allViolations) {
		runWideByCode[violation.code] = (runWideByCode[violation.code] ?? 0) + 1;
	}
	const displayByCode: Record<string, number> = {};
	for (const violation of violations) {
		displayByCode[violation.code] = (displayByCode[violation.code] ?? 0) + 1;
	}
	return {
		runId: run.id,
		status: run.status,
		violations,
		counts: {
			total: violations.length,
			byCode: displayByCode,
			scope: resolvedTermIndex === undefined ? 'RUN_WIDE' : 'SELECTED_TERM',
		runWide: {
			total: allViolations.length,
			hard: allViolations.filter((violation) => violation.severity === 'HARD').length,
			/** HARD violations on the publication allowlist — the real gate count. */
			blockingHard: allViolations.filter((violation) => violation.severity === 'HARD' && isPromotableConstraintCode(violation.code)).length,
			soft: allViolations.filter((violation) => violation.severity === 'SOFT').length,
			byCode: runWideByCode,
		},
		},
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

	return buildViolationReport(run, resolvedTermIndex);
}

export async function getLatestRunViolations(schoolId: number, schoolYearId: number, termIndex?: number): Promise<ViolationReport> {
	const resolvedTermIndex = termIndex === undefined ? undefined : await resolveRequestedTermIndex(schoolId, schoolYearId, termIndex);
	const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
	const run = await db().generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	return buildViolationReport(run, resolvedTermIndex);
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

/** The routine-sync CAS-skip audit action (FACULTY-SYNC-PUBLICATION-CAS-C01 R2). */
export const GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED = 'GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED';

/**
 * The deterministic interleave seam (`PublicationDependencies` pattern).
 * Production passes nothing; `undefined` is behaviourally identical to the
 * pre-CAS implementation.
 */
export type InvalidateStaleCompletedRunsDependencies = {
	/**
	 * Invoked after the classification read and before the write transaction, so
	 * a test can transpose a concurrent publication between the read and the CAS
	 * write deterministically. Must not be used in production.
	 */
	afterClassification?: () => Promise<void> | void;
};

export type InvalidateStaleCompletedRunsResult = {
	/**
	 * TRUTHFUL invalidation count: the number of runs this call actually
	 * transitioned `COMPLETED -> FAILED` through the destructive CAS
	 * (`count === 1`). It is NOT `staleRunIds.length` (the classified set) when a
	 * concurrent publication changed a run between classification and the write.
	 */
	invalidatedCount: number;
	/**
	 * The runs the classification read found stale. Existing callers
	 * (`faculty.service.ts`, `scripts/seed-realistic.ts`) depend on this being
	 * the classified set, so it keeps that meaning even when a CAS skips a run.
	 */
	staleRunIds: number[];
	/**
	 * The destructive-branch runs actually set `FAILED` by this call. Truthful:
	 * only runs whose CAS matched are pushed (R2.3b).
	 */
	unpublishedRunIds: number[];
	/** Published-marker runs whose drift this call actually recorded. */
	driftedPublishedRunIds: number[];
	/**
	 * Runs whose write CAS missed because a concurrent writer changed the run
	 * (version/status) after classification. Zero writes were applied to them and
	 * each produced exactly one
	 * `GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED` audit row.
	 */
	concurrentChangedRunIds: number[];
};

/**
 * Compare a persisted id array with the classified stale set without imposing an
 * order contract. Used only for the replay-idempotency check below.
 */
function sameIdSet(left: unknown, right: number[]): boolean {
	if (!Array.isArray(left) || left.length !== right.length) return false;
	const leftIds = left.filter((value): value is number => typeof value === 'number' && Number.isInteger(value));
	if (leftIds.length !== right.length) return false;
	const leftSet = new Set(leftIds);
	return right.every((id) => leftSet.has(id));
}

/**
 * DEMAND/ROLLOVER mirror-reset protection for COMPLETED runs.
 *
 * PUBLISHED-IMMUTABILITY-C08 (D8) — routine faculty/subject/room/policy
 * synchronization must never erase published history. A run carrying published
 * markers is excluded from the destructive path: its `status`, `isPublished`,
 * `publishedAt`, `publishedBy`, and published revision are preserved and the
 * drift is recorded as a typed, audited successor condition. Unpublished
 * COMPLETED runs keep today's invalidation behavior.
 *
 * FACULTY-SYNC-PUBLICATION-CAS-C01 — both writes are compare-and-swap against
 * the classification's `version` (and pinned `schoolId`/`schoolYearId`, plus
 * `status: 'COMPLETED'` for the destructive transition), so a concurrent
 * `publishSchedule` can never be clobbered by a stale copy. A missed CAS is a
 * typed, singly-audited successor condition (`concurrentChangedRunIds`), never
 * a blind retry.
 */
export async function invalidateStaleCompletedRuns(
	schoolId: number,
	schoolYearId: number,
	dependencies: InvalidateStaleCompletedRunsDependencies = {},
): Promise<InvalidateStaleCompletedRunsResult> {
	const [runs, activeFacultyIds] = await Promise.all([
		db().generationRun.findMany({
			where: { schoolId, schoolYearId, status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			// `version` is the CAS predicate source: every write below is bound to
			// the row version observed by this read.
			select: { id: true, schoolYearId: true, status: true, draftEntries: true, summary: true, version: true },
		}),
		getActiveFacultyMirrorIdSet(schoolId),
	]);

	const staleRuns = runs.filter((run) => getStaleFacultyIdsForRun(run, activeFacultyIds).length > 0);
	const staleRunIds = staleRuns.map((run) => run.id);

	if (staleRunIds.length === 0) {
		return {
			invalidatedCount: 0,
			staleRunIds: [] as number[],
			unpublishedRunIds: [] as number[],
			driftedPublishedRunIds: [] as number[],
			concurrentChangedRunIds: [] as number[],
		};
	}

	// Deterministic test seam: the last point before the write transaction, so a
	// test can interleave a concurrent publication after classification.
	await dependencies.afterClassification?.();

	const reconciledAtIso = new Date().toISOString();
	const unpublishedRunIds: number[] = [];
	const driftedPublishedRunIds: number[] = [];
	const concurrentChangedRunIds: number[] = [];
	let invalidatedCount = 0;

	/**
	 * Exactly one audit row per CAS miss (R2). Distinct from
	 * `GENERATION_RUN_PUBLICATION_DRIFT_DETECTED` so per-run drift audit counts
	 * stay exactly one (the C08 suite asserts that).
	 */
	const recordConcurrentSkip = async (
		tx: Prisma.TransactionClient,
		runId: number,
		observedVersion: number,
		reason: string,
	): Promise<void> => {
		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED,
				actorId: 0,
				targetIds: [runId],
				metadata: {
					runId,
					observedVersion,
					reason,
					detectedAt: reconciledAtIso,
				} as object,
			},
		});
	};

	await db().$transaction(async (tx) => {
		for (const run of staleRuns) {
			const wasPublished = hasPublishedMarkers(run.summary);

			if (wasPublished) {
				// Synchronization must never unpublish a published run or mark it
				// FAILED. Preserve the published identity and record typed drift.
				//
				// COPY-THROUGH, never assert: a current published run keeps
				// `isPublished: true`, while a SUPERSEDED run keeps `isPublished:
				// false` plus its `publishedAt`/`publishedBy` informational markers
				// and its `publicationSuperseded*` pointers. Writing `isPublished:
				// true` here resurrected a superseded run into a second current
				// published run, which made every published read/export fail with
				// `409 PUBLISHED_RUN_AMBIGUOUS` and regressed the supersession path.
				const candidate = asSummaryRecord(run.summary);
				const existingIntegrity = asSummaryRecord(candidate.publicationIntegrity);
				const driftStaleFacultyIds = getStaleFacultyIdsForRun(run, activeFacultyIds);

				// R2.5 replay idempotency: the identical drift for the identical
				// stale set is already recorded, so a second no-input sync must not
				// write or re-audit it.
				if (
					existingIntegrity.driftReason === 'FACULTY_SYNC_DRIFT'
					&& typeof existingIntegrity.driftDetectedAt === 'string'
					&& existingIntegrity.driftDetectedAt.length > 0
					&& sameIdSet(existingIntegrity.driftStaleFacultyIds, driftStaleFacultyIds)
				) {
					driftedPublishedRunIds.push(run.id);
					continue;
				}

				const nextSummary = {
					...candidate,
					// `isPublished`/`publishedAt`/`publishedBy` are intentionally
					// copied through unchanged.
					publicationIntegrity: {
						...existingIntegrity,
						driftDetectedAt: reconciledAtIso,
						driftReason: 'FACULTY_SYNC_DRIFT',
						driftStaleFacultyIds,
					},
				};
				// CAS WITHOUT a version increment (R1.4): the published run's
				// version must be preserved through drift (C08 asserts this).
				const driftWrite = await tx.generationRun.updateMany({
					where: { id: run.id, schoolId, schoolYearId, version: run.version },
					data: { summary: nextSummary as object },
				});
				if (driftWrite.count !== 1) {
					// A concurrent publication changed the run after classification.
					// Do not clobber it; record exactly one typed skip.
					concurrentChangedRunIds.push(run.id);
					await recordConcurrentSkip(tx, run.id, run.version, 'PUBLICATION_DRIFT_CONCURRENT_CHANGE');
					continue;
				}
				await tx.auditLog.create({
					data: {
						schoolId,
						schoolYearId,
						action: 'GENERATION_RUN_PUBLICATION_DRIFT_DETECTED',
						actorId: 0,
						targetIds: [run.id],
						metadata: {
							runId: run.id,
							reason: 'FACULTY_SYNC_DRIFT',
							detectedAt: reconciledAtIso,
							preservedStatus: run.status,
						} as object,
					},
				});
				driftedPublishedRunIds.push(run.id);
				continue;
			}

			// Destructive branch: CAS with a version increment and the predicate
			// pinned to `status: 'COMPLETED'`, so `COMPLETED -> FAILED` is version
			// visible and cannot be applied to a run that already changed status.
			const destructiveWrite = await tx.generationRun.updateMany({
				where: { id: run.id, schoolId, schoolYearId, status: 'COMPLETED', version: run.version },
				data: {
					status: 'FAILED',
					error: 'INVALIDATED_BY_MIRROR_RESET',
					version: { increment: 1 },
				},
			});
			if (destructiveWrite.count !== 1) {
				concurrentChangedRunIds.push(run.id);
				await recordConcurrentSkip(tx, run.id, run.version, 'MIRROR_RESET_CONCURRENT_CHANGE');
				continue;
			}
			unpublishedRunIds.push(run.id);
			invalidatedCount += 1;
		}
	});

	// `invalidatedCount` counts runs actually set FAILED (truthful), while
	// `staleRunIds` stays the classified set for existing callers (R2.3).
	return { invalidatedCount, staleRunIds, unpublishedRunIds, driftedPublishedRunIds, concurrentChangedRunIds };
}
