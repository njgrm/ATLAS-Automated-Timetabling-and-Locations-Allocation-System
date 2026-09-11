/**
 * GEN-C02 — Canonical generation readiness / zero-write dry run.
 *
 * One READ-ONLY service that answers "can this school/year reach a
 * zero-hard-blocker schedule?" using the exact same authorities, input
 * assembly shape contracts, scheduler, validator context, and snapshot domain
 * as the real generation trigger:
 *
 *   - demand authority      -> canonical derived demand (DEMAND-C01)
 *   - shape assembly        -> `generation-shape-assembly.service.ts`
 *   - scheduler             -> `runHybridScheduler` (real multi-seed + repair)
 *   - validation            -> `validateHardConstraints`
 *   - retained locks        -> the real pre-generation draft consumer
 *
 * It NEVER creates runs, drafts, locks, audits, cycles, assignments,
 * revisions, snapshots, or notifications. A before/after database signature is
 * returned as explicit zero-write proof.
 */

import { createHash } from 'node:crypto';

import { getDataContext, withDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import {
	validateHardConstraints,
	type ScheduledEntry,
	type ValidatorContext,
} from './constraint-validator.js';
import type { ConstructorInput, DemandItem } from './schedule-constructor.js';
import {
	buildDerivedDemand,
	toSchedulerDemandOverride,
	type DerivedDemandBlocker,
	type DerivedDemandResult,
	type DerivedDemandSuccess,
} from './derived-demand.service.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import type { SectionsByGrade } from './section-adapter.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { DEFAULT_CONSTRAINT_CONFIG, POLICY_DEFAULTS, computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import { getTemplatePeriodProfiles } from './class-template.service.js';
import {
	readCanonicalClassProgramSlotsCoverage,
	resolveClassProgramSlots,
	type CanonicalTemplateCoverage,
} from './class-program-slot.service.js';
import { buildRunTimetableShapeContracts, normalizeProgramType } from './generation-shape-assembly.service.js';
import { consumeDraftPlacementsForRun, type DraftConsumeRejection } from './pre-generation-draft.service.js';
import type { VerifiedTermContract } from './enrollpro-term-contract.service.js';

const db = () => getDataContext();

export type GenerationReadinessBlockerCategory =
	| 'DEMAND_AUTHORITY'
	| 'DATA_GAP'
	| 'POLICY_BLOCKER'
	| 'RESOURCE_INFEASIBLE'
	| 'ALGORITHM_LIMIT';

export interface GenerationReadinessBlocker {
	code: string;
	category: GenerationReadinessBlockerCategory;
	termIdentity: string | null;
	sectionId: number | null;
	subjectId: number | null;
	subjectCode: string | null;
	entity: string;
	reason: string;
	owningSurface: string;
	nextAction: string;
}

export interface GenerationReadinessDatabaseSignature {
	generationRunCount: number;
	generationRunMaxId: number | null;
	lockedSessionCount: number;
	lockedSessionMaxUpdatedAt: string | null;
	lockedSessionActionCount: number;
	auditLogCount: number;
	teachingLoadCycleVersions: number[];
	teachingLoadOwnershipCount: number;
}

export interface GenerationReadinessResult {
	scope: { schoolId: number; schoolYearId: number };
	status: 'READY' | 'BLOCKED';
	generateAllowed: boolean;
	/** true only when a real scheduler dry run executed without hard blockers. */
	schedulerExecuted: boolean;
	derivedDemandRevision: string | null;
	derivedDemandBlockers: DerivedDemandBlocker[];
	termStructure: { format: 'TRIMESTER' | 'QUARTERS'; terms: Array<{ identity: string; order: number }> } | null;
	totals: { lines: number; pairs: number; sessionsByTerm: Record<string, number> };
	teachingLoadCoverage: {
		requiredPairs: number;
		ownedPairs: number;
		missingPairs: number;
		inactiveOrStalePairs: number;
		outsideScopePairs: number;
		missing: Array<{ subjectId: number; subjectCode: string; sectionMirrorId: number; sectionExternalId: number; termIdentities: string[] }>;
	};
	resources: {
		roomCount: number;
		teachingRoomCount: number;
		totalCapacity: number;
		featureCoverage: Record<string, number>;
	};
	gradeWindows: { resolvedCount: number; missingScopes: Array<{ gradeLevel: number; programType: string }> };
	classProgramSlots: { coverage: CanonicalTemplateCoverage[]; missingScopes: Array<{ gradeLevel: number; programType: string }> };
	policy: { present: boolean; id: number | null; periodLengthMinutes: number; periodsPerDay: number };
	retainedLocks: { draftCount: number; retainedCount: number; rejected: DraftConsumeRejection[] };
	scheduler: {
		ran: boolean;
		assignedCount: number;
		unassignedCount: number;
		policyBlockedCount: number;
		classesProcessed: number;
		selectedProfileId: string | null;
		runtimeMs: number;
	};
	violations: { hardCount: number; softCount: number; hardCodes: Record<string, number>; softCodes: Record<string, number> };
	blockers: GenerationReadinessBlocker[];
	databaseSignature: { before: GenerationReadinessDatabaseSignature; after: GenerationReadinessDatabaseSignature; zeroWrite: boolean };
}

export interface GenerationReadinessDependencies {
	client?: unknown;
	termContract?: VerifiedTermContract;
	/** Enforce persisted grade shift windows in the shape contracts (default true). */
	enforceShiftWindows?: boolean;
}

function sha256(value: unknown): string {
	return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex').toUpperCase();
}

async function computeDatabaseSignature(schoolId: number, schoolYearId: number): Promise<GenerationReadinessDatabaseSignature> {
	const client = db() as any;
	const [generationRunCount, generationRunMax, lockedSessionCount, lockedSessionMax, lockedSessionActionCount, auditLogCount, cycleRows, teachingLoadOwnershipCount] = await Promise.all([
		client.generationRun.count(),
		client.generationRun.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
		client.lockedSession.count(),
		client.lockedSession.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
		client.lockedSessionAction.count(),
		client.auditLog.count(),
		client.teachingLoadCycle.findMany({ where: { schoolId, schoolYearId }, select: { version: true } }),
		client.subjectSectionOwnership.count({ where: { schoolId, schoolYearId } }),
	]);
	return {
		generationRunCount,
		generationRunMaxId: generationRunMax?.id ?? null,
		lockedSessionCount,
		lockedSessionMaxUpdatedAt: lockedSessionMax?.updatedAt ? new Date(lockedSessionMax.updatedAt).toISOString() : null,
		lockedSessionActionCount,
		auditLogCount,
		teachingLoadCycleVersions: (cycleRows as Array<{ version: number }>).map((row) => row.version).sort((a, b) => a - b),
		teachingLoadOwnershipCount,
	};
}

function emptyTotals(): { lines: number; pairs: number; sessionsByTerm: Record<string, number> } {
	return { lines: 0, pairs: 0, sessionsByTerm: {} };
}

function classifyDemandBlocker(blocker: DerivedDemandBlocker): GenerationReadinessBlocker {
	return {
		code: blocker.code,
		category: 'DEMAND_AUTHORITY',
		termIdentity: null,
		sectionId: null,
		subjectId: blocker.subjectId ?? null,
		subjectCode: blocker.subjectCode ?? null,
		entity: blocker.subjectCode ? `Subject ${blocker.subjectCode}` : 'Active school year / term structure',
		reason: blocker.message,
		owningSurface: 'Subject scheduling authority / EnrollPro term contract',
		nextAction: 'Resolve the ordered EnrollPro term contract and Subject rotation metadata, then re-run readiness.',
	};
}

/**
 * Deterministic classification of one unassigned session into a data gap, a
 * policy blocker, genuine resource infeasibility, or a search/algorithm limit.
 */
function classifyUnassigned(item: {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: string;
	roomAssignmentReason?: string;
	homeRoomFallbackCause?: string;
}): GenerationReadinessBlocker {
	const base = {
		termIdentity: null as string | null,
		sectionId: item.sectionId,
		subjectId: item.subjectId,
		subjectCode: null as string | null,
		entity: `Section ${item.sectionId} · Subject ${item.subjectId} · session ${item.session}`,
	};
	const roomReason = item.roomAssignmentReason;
	if (item.reason === 'NO_QUALIFIED_FACULTY' || roomReason === 'NO_QUALIFIED_FACULTY') {
		return {
			...base,
			code: 'TL_NO_QUALIFIED_OWNER',
			category: 'DATA_GAP',
			reason: 'No qualified faculty owner covers this section/subject demand.',
			owningSurface: 'Teaching Load',
			nextAction: 'Assign a qualified owner for this section/subject in Teaching Load, then re-run readiness.',
		};
	}
	if (item.reason === 'FACULTY_OVERLOADED' || roomReason === 'FACULTY_SLOT_UNAVAILABLE') {
		return {
			...base,
			code: 'WORKLOAD_POLICY_BLOCK',
			category: 'POLICY_BLOCKER',
			reason: 'Every candidate owner is at their workload/slot limit for this session.',
			owningSurface: 'Teaching Load / Scheduling policy',
			nextAction: 'Reduce assigned load or adjust the workload policy for this school year.',
		};
	}
	if (item.reason === 'NO_COMPATIBLE_ROOM' || item.reason === 'ROOM_CAPACITY_EXCEEDED' || roomReason === 'ROOM_PATH_EXHAUSTED' || roomReason === 'SPECIALIZED_ROOM_UNAVAILABLE' || roomReason === 'HOME_ROOM_UNAVAILABLE') {
		return {
			...base,
			code: 'ROOM_RESOURCE_UNAVAILABLE',
			category: 'RESOURCE_INFEASIBLE',
			reason: `No room matched the required type/features/capacity for this session${item.homeRoomFallbackCause ? ` (${item.homeRoomFallbackCause})` : ''}.`,
			owningSurface: 'Campus map / rooms',
			nextAction: 'Add or reclassify a suitable room (type, features, capacity), then re-run readiness.',
		};
	}
	if (roomReason === 'POLICY_SLOT_BLOCKED' || roomReason === 'NO_VALID_PERIOD_IN_POLICY_WINDOW') {
		return {
			...base,
			code: 'POLICY_WINDOW_BLOCK',
			category: 'POLICY_BLOCKER',
			reason: 'No valid period exists inside the configured policy/grade window for this session.',
			owningSurface: 'Scheduling policy / grade windows',
			nextAction: 'Widen the day-shape window or reduce the required weekly sessions, then re-run readiness.',
		};
	}
	return {
		...base,
		code: 'SEARCH_LIMIT_UNRESOLVED',
		category: 'ALGORITHM_LIMIT',
		reason: `The scheduler could not place this session (${item.reason}) within its bounded search.`,
		owningSurface: 'Generation algorithm',
		nextAction: 'Inspect coordinated resources for this grade/program and re-run readiness after data/policy fixes.',
	};
}

function countByCode(codes: string[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const code of codes) counts[code] = (counts[code] ?? 0) + 1;
	return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function sortBlockers(blockers: GenerationReadinessBlocker[]): GenerationReadinessBlocker[] {
	return [...blockers].sort((a, b) =>
		`${a.category}:${a.code}:${String(a.sectionId ?? -1).padStart(12, '0')}:${String(a.subjectId ?? -1).padStart(12, '0')}:${a.entity}`
			.localeCompare(`${b.category}:${b.code}:${String(b.sectionId ?? -1).padStart(12, '0')}:${String(b.subjectId ?? -1).padStart(12, '0')}:${b.entity}`),
	);
}

export async function buildGenerationReadiness(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationReadinessDependencies = {},
): Promise<GenerationReadinessResult> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) throw readinessError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) throw readinessError(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');

	const run = () => buildGenerationReadinessWithContext(schoolId, schoolYearId, dependencies);
	return dependencies.client ? withDataContext(dependencies.client, run) : run();
}

function readinessError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

async function buildGenerationReadinessWithContext(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationReadinessDependencies,
): Promise<GenerationReadinessResult> {
	const startedAt = Date.now();
	const client = db() as any;
	// Mirror the real trigger: shift windows are opt-in (enforceShiftWindows ===
	// true). When disabled they are still reported, but never become blockers.
	const enforceShiftWindows = dependencies.enforceShiftWindows === true;

	const databaseBefore = await computeDatabaseSignature(schoolId, schoolYearId);

	const policyRow = await client.schedulingPolicy.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	const policy = {
		present: policyRow != null,
		id: policyRow?.id ?? null,
		periodLengthMinutes: policyRow?.periodLengthMinutes ?? POLICY_DEFAULTS.periodLengthMinutes,
		periodsPerDay: policyRow?.periodsPerDay ?? POLICY_DEFAULTS.periodsPerDay,
	};

	const derived = await buildDerivedDemand(schoolId, schoolYearId, {
		termContract: dependencies.termContract,
		periodLengthMinutes: policy.periodLengthMinutes,
	});

	const blockers: GenerationReadinessBlocker[] = [];
	if (!policy.present) {
		blockers.push({
			code: 'POLICY_UNINITIALIZED',
			category: 'POLICY_BLOCKER',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Scheduling policy · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No scheduling policy row exists for this school year.',
			owningSurface: 'Scheduling policy',
			nextAction: 'Save the scheduling policy for this school year, then re-run readiness.',
		});
	}

	if (!derived.ok) {
		for (const blocker of derived.blockers) blockers.push(classifyDemandBlocker(blocker));
	}

	// ── Read-only reference inputs ──────────────────────────────────────────
	const sectionMirrorCount = await client.sectionMirror.count({ where: { schoolId, schoolYearId, isStale: false } });
	if (sectionMirrorCount === 0) {
		blockers.push({
			code: 'SECTION_SETUP_REQUIRED',
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Sections · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No active, non-stale section mirrors exist for this school year.',
			owningSurface: 'Sections / EnrollPro sync',
			nextAction: 'Sync and review sections from EnrollPro, then re-run readiness.',
		});
	}

	const [
		faculty,
		facultySubjectRows,
		rooms,
		subjects,
		preferences,
		buildings,
		specialEvents,
		gradeWindows,
		ownershipRows,
	] = await Promise.all([
		client.facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true, isStale: false },
			select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, department: true, isActiveForScheduling: true, isStale: true },
		}),
		client.facultySubject.findMany({ where: { schoolId, schoolYearId } }),
		client.room.findMany({
			where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
			select: { id: true, type: true, isTeachingSpace: true, isSharedFacility: true, capacity: true, features: true, buildingId: true, buildingZoneId: true, building: { select: { gradeScope: true } } },
		}),
		client.subject.findMany({
			where: { schoolId, isActive: true },
			select: {
				id: true, code: true, name: true, ownerDepartment: true, qualificationPriority: true, minMinutesPerWeek: true,
				preferredRoomType: true, gradeLevels: true, interSectionEnabled: true, interSectionGradeLevels: true,
				programScopes: true, allowedSpecializations: true, requiredFeatures: true, modularGroupId: true, modularOrder: true,
			},
		}),
		client.facultyPreference.findMany({ where: { schoolId, schoolYearId }, select: { facultyId: true, status: true } }),
		client.building.findMany({ where: { schoolId }, select: { id: true, name: true, x: true, y: true } }),
		client.policySpecialEvent.findMany({ where: { schoolId, schoolYearId, enabled: true }, orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }] }),
		client.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } }),
		client.subjectSectionOwnership.findMany({ where: { schoolId, schoolYearId } }),
	]);

	const sectionResult = sectionMirrorCount > 0
		? { gradeLevels: await loadReadOnlySectionsByGrade(schoolId, schoolYearId, client) }
		: { gradeLevels: [] as SectionsByGrade[] };
	const sectionsByGrade = sectionResult.gradeLevels as ConstructorInput['sectionsByGrade'];
	const roomsWithGradeScope = rooms.map((r: any) => ({ ...r, buildingGradeScope: r.building?.gradeScope ?? [] }));

	const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
	const activeFacultyIdSet = new Set(faculty.map((member: any) => member.id));
	const facultySubjects = facultySubjectRows
		.filter((assignment: any) => activeFacultyIdSet.has(assignment.facultyId))
		.map((assignment: any) => {
			const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
			return { facultyId: assignment.facultyId, subjectId: assignment.subjectId, gradeLevels: normalized.gradeLevels, sectionIds: normalized.sectionIds };
		});

	const schedulableSubjects = subjects.filter((subject: any) => subject.code !== 'HG');

	// ── Teaching Load coverage from the derived pairs ───────────────────────
	const facultyById = new Map<number, { isActiveForScheduling: boolean; isStale: boolean }>();
	for (const member of faculty) facultyById.set(member.id, { isActiveForScheduling: member.isActiveForScheduling, isStale: member.isStale });
	const scopeByFacultySubject = new Map<string, any>();
	for (const fs of facultySubjectRows) scopeByFacultySubject.set(`${fs.facultyId}:${fs.subjectId}`, fs);
	const ownershipBySubjectSection = new Map<string, any[]>();
	for (const row of ownershipRows) {
		const key = `${row.subjectId}:${row.sectionId}`;
		const list = ownershipBySubjectSection.get(key) ?? [];
		list.push(row);
		ownershipBySubjectSection.set(key, list);
	}

	const coverage = derived.ok
		? summarizeTeachingLoadCoverage(derived, ownershipBySubjectSection, facultyById, scopeByFacultySubject)
		: { requiredPairs: 0, ownedPairs: 0, missingPairs: 0, inactiveOrStalePairs: 0, outsideScopePairs: 0, missing: [] };
	for (const missing of coverage.missing) {
		blockers.push({
			code: 'TL_DEMAND_UNCOVERED',
			category: 'DATA_GAP',
			termIdentity: missing.termIdentities[0] ?? null,
			sectionId: missing.sectionExternalId,
			subjectId: missing.subjectId,
			subjectCode: missing.subjectCode,
			entity: `Section ${missing.sectionExternalId} · Subject ${missing.subjectCode}`,
			reason: 'Derived demand exists but no active Teaching Load owner covers this section/subject.',
			owningSurface: 'Teaching Load',
			nextAction: 'Assign a qualified owner for this section/subject in Teaching Load, then re-run readiness.',
		});
	}

	// ── Class-program template coverage (read-only) ─────────────────────────
	const slotCoverage = await readCanonicalClassProgramSlotsCoverage(schoolId, schoolYearId);
	const detectedScopes = collectDetectedScopes(sectionsByGrade);
	const slotCoverageByKey = new Map(slotCoverage.map((entry) => [`${entry.gradeLevel}:${entry.programType}`, entry]));
	const missingSlotScopes: Array<{ gradeLevel: number; programType: string }> = [];
	for (const scope of detectedScopes) {
		if (!KNOWN_GRADE_LEVELS.has(scope.gradeLevel)) continue;
		const entry = slotCoverageByKey.get(`${scope.gradeLevel}:${scope.programType}`);
		if (!entry || entry.issues.length > 0) {
			missingSlotScopes.push(scope);
			blockers.push({
				code: 'CANONICAL_TEMPLATE_INCOMPLETE',
				category: 'DATA_GAP',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Grade ${scope.gradeLevel} ${scope.programType}`,
				reason: 'The active-year class-program template is missing or incomplete.',
				owningSurface: 'Class-program template',
				nextAction: 'Review and complete the class-program template for this grade/program, then re-run readiness.',
			});
		}
	}

	// ── Grade window resolution ─────────────────────────────────────────────
	const windowKeys = new Set((gradeWindows as any[]).map((w) => `${normalizeGrade(w.gradeLevel)}:${normalizeProgramType(w.programType)}`));
	const missingWindows: Array<{ gradeLevel: number; programType: string }> = [];
	if (enforceShiftWindows) {
		for (const scope of detectedScopes) {
			if (!KNOWN_GRADE_LEVELS.has(scope.gradeLevel)) continue;
			const hasExact = windowKeys.has(`${scope.gradeLevel}:${scope.programType}`);
			const hasAll = windowKeys.has(`${scope.gradeLevel}:ALL`);
			if (!hasExact && !hasAll) {
				missingWindows.push(scope);
				blockers.push({
					code: 'GRADE_WINDOW_MISSING',
					category: 'POLICY_BLOCKER',
					termIdentity: null,
					sectionId: null,
					subjectId: null,
					subjectCode: null,
					entity: `Grade ${scope.gradeLevel} ${scope.programType}`,
					reason: 'No persisted grade shift window (exact or ALL) covers this grade/program.',
					owningSurface: 'Grade windows',
					nextAction: 'Set a grade shift window for this grade/program, then re-run readiness.',
				});
			}
		}
	}

	// ── Retained pre-generation locks (real consumer, read-only) ────────────
	let retainedLocks: GenerationReadinessResult['retainedLocks'] = { draftCount: 0, retainedCount: 0, rejected: [] };
	try {
		const consumed = await consumeDraftPlacementsForRun(0, schoolId, schoolYearId, undefined, { readOnly: true });
		retainedLocks = { draftCount: consumed.prePlacedCount + consumed.invalidPrePlacedCount, retainedCount: consumed.prePlacedCount, rejected: consumed.rejectedPlacements };
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code !== 'SECTION_SNAPSHOT_UNAVAILABLE') throw error;
		blockers.push({
			code: 'SECTION_SNAPSHOT_UNAVAILABLE',
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Section snapshot · school ${schoolId} · year ${schoolYearId}`,
			reason: 'Retained locks could not be validated because no saved section snapshot exists and the read-only dry run will not sync upstream.',
			owningSurface: 'Sections / EnrollPro sync',
			nextAction: 'Sync sections from EnrollPro once, then re-run readiness.',
		});
	}
	for (const rejected of retainedLocks.rejected) {
		blockers.push({
			code: `RETAINED_LOCK_${rejected.code}`,
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: rejected.sectionId,
			subjectId: rejected.subjectId,
			subjectCode: null,
			entity: `Retained lock #${rejected.placementId}`,
			reason: rejected.reason,
			owningSurface: 'Pre-generation draft',
			nextAction: 'Fix or remove the rejected draft placement, then re-run readiness.',
		});
	}

	// ── Real scheduler dry run + validator ──────────────────────────────────
	let scheduler: GenerationReadinessResult['scheduler'] = { ran: false, assignedCount: 0, unassignedCount: 0, policyBlockedCount: 0, classesProcessed: 0, selectedProfileId: null, runtimeMs: 0 };
	let violations: GenerationReadinessResult['violations'] = { hardCount: 0, softCount: 0, hardCodes: {}, softCodes: {} };
	const schedulerCanRun = derived.ok && sectionsByGrade.length > 0 && !missingSlotScopes.length && policy.present;
	if (schedulerCanRun && derived.ok) {
		const templateProfiles = await getTemplatePeriodProfiles(schoolId);
		const canonicalSlotsByGradeProgram = new Map<string, Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>>();
		for (const scope of detectedScopes) {
			const allSlots = await resolveClassProgramSlots(schoolId, schoolYearId, scope.gradeLevel as any, scope.programType as any);
			if (allSlots.length > 0) {
				canonicalSlotsByGradeProgram.set(`${scope.gradeLevel}:${scope.programType}`, allSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, subjectFamily: s.subjectFamily, subjectLabel: s.subjectLabel, rowKind: s.rowKind })));
			}
		}
		const timetableShapeContracts = buildRunTimetableShapeContracts({
			sectionsByGrade,
			gradeWindows: (enforceShiftWindows ? gradeWindows : []).map((gw: any) => ({ gradeLevel: gw.gradeLevel, programType: gw.programType ?? null, startTime: gw.startTime, endTime: gw.endTime })),
			templateProfiles,
			canonicalSlots: canonicalSlotsByGradeProgram,
			policy: {
				...(policyRow as any),
				periodLengthMinutes: policy.periodLengthMinutes,
				periodsPerDay: policy.periodsPerDay,
			} as ConstructorInput['policy'],
		});
		const classTemplatePeriods: Record<string, number> = {};
		for (const profile of templateProfiles) classTemplatePeriods[profile.programType] = profile.periodLengthMinutes;

		const demand = toSchedulerDemandOverride(derived, sectionsByGrade, schedulableSubjects as Parameters<typeof toSchedulerDemandOverride>[2]);
		const constructorInput: ConstructorInput = {
			schoolId, schoolYearId,
			roomingStrategy: 'HOME_ROOM_FIRST',
			sectionsByGrade,
			subjects: schedulableSubjects,
			cohorts: [],
			faculty: faculty.map((member: any) => ({
				id: member.id,
				maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
				department: member.department,
			})),
			facultySubjects,
			rooms: roomsWithGradeScope,
			preferences: preferences.map((p: any) => ({ facultyId: p.facultyId, status: p.status, timeSlots: [] })),
			policy: {
				...(policyRow as any),
				periodLengthMinutes: policy.periodLengthMinutes,
				periodsPerDay: policy.periodsPerDay,
			} as ConstructorInput['policy'],
			lockedEntries: [],
			gradeWindows: (enforceShiftWindows ? gradeWindows : []).map((gw: any) => ({ gradeLevel: gw.gradeLevel, programType: gw.programType ?? null, startTime: gw.startTime, endTime: gw.endTime })),
			buildings: buildings.map((b: any) => ({ id: b.id, name: b.name })),
			classTemplatePeriods,
			timetableShapes: timetableShapeContracts,
			demandOverride: demand,
		};

		const schedulerStartedAt = Date.now();
		const result = runHybridScheduler(constructorInput);
		scheduler = {
			ran: true,
			assignedCount: result.assignedCount,
			unassignedCount: result.unassignedCount,
			policyBlockedCount: result.policyBlockedCount,
			classesProcessed: result.classesProcessed,
			selectedProfileId: result.selectedProfileId,
			runtimeMs: Date.now() - schedulerStartedAt,
		};

		const validatorCtx: ValidatorContext = {
			schoolId, schoolYearId, runId: 0,
			entries: result.entries as ScheduledEntry[],
			faculty: constructorInput.faculty,
			facultySubjects,
			rooms,
			subjects,
			sectionEnrollment: new Map(sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount] as const))),
			policy: {
				...constructorInput.policy!,
				maxTeachingMinutesPerDay: policyRow?.maxTeachingMinutesPerDay,
				enforceConsecutiveBreakAsHard: policyRow?.enforceConsecutiveBreakAsHard,
			},
			travelPolicy: {
				enableTravelWellbeingChecks: policyRow?.enableTravelWellbeingChecks,
				maxWalkingDistanceMetersPerTransition: policyRow?.maxWalkingDistanceMetersPerTransition,
				maxBuildingTransitionsPerDay: policyRow?.maxBuildingTransitionsPerDay,
				maxBackToBackTransitionsWithoutBuffer: policyRow?.maxBackToBackTransitionsWithoutBuffer,
				maxIdleGapMinutesPerDay: policyRow?.maxIdleGapMinutesPerDay,
				avoidEarlyFirstPeriod: policyRow?.avoidEarlyFirstPeriod,
				avoidLateLastPeriod: policyRow?.avoidLateLastPeriod,
			},
			vacantPolicy: {
				enableVacantAwareConstraints: policyRow?.enableVacantAwareConstraints,
				targetFacultyDailyVacantMinutes: policyRow?.targetFacultyDailyVacantMinutes,
				targetSectionDailyVacantPeriods: policyRow?.targetSectionDailyVacantPeriods,
				maxCompressedTeachingMinutesPerDay: policyRow?.maxCompressedTeachingMinutesPerDay,
			},
			buildings,
			roomBuildings: rooms.map((r: any) => ({ roomId: r.id, buildingId: r.buildingId })),
			constraintConfig: {
				...DEFAULT_CONSTRAINT_CONFIG,
				...(policyRow?.constraintConfig as Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }> ?? {}),
			},
		};
		const validation = validateHardConstraints(validatorCtx);
		const hard = validation.violations.filter((v) => v.severity === 'HARD');
		const soft = validation.violations.filter((v) => v.severity === 'SOFT');
		violations = { hardCount: hard.length, softCount: soft.length, hardCodes: countByCode(hard.map((v) => v.code)), softCodes: countByCode(soft.map((v) => v.code)) };

		for (const item of result.unassignedItems) {
			blockers.push(classifyUnassigned(item as any));
		}
		for (const violation of hard) {
			blockers.push({
				code: violation.code,
				category: violation.code.includes('ROOM') ? 'RESOURCE_INFEASIBLE' : 'ALGORITHM_LIMIT',
				termIdentity: null,
				sectionId: violation.entities?.sectionId ?? null,
				subjectId: violation.entities?.subjectId ?? null,
				subjectCode: null,
				entity: `Run validation · ${violation.code}`,
				reason: violation.message,
				owningSurface: 'Generation assembly',
				nextAction: 'Resolve the reported hard conflict, then re-run readiness.',
			});
		}
	}

	// ── Aggregate readiness ─────────────────────────────────────────────────
	const sortedBlockers = sortBlockers(blockers);
	const generateAllowed = sortedBlockers.length === 0 && scheduler.ran && violations.hardCount === 0;
	const status: GenerationReadinessResult['status'] = generateAllowed ? 'READY' : 'BLOCKED';

	const databaseAfter = await computeDatabaseSignature(schoolId, schoolYearId);

	const termStructure = derived.ok
		? { format: derived.termStructure.format, terms: derived.termStructure.terms.map((t) => ({ identity: t.identity, order: t.order })) }
		: null;

	return {
		scope: { schoolId, schoolYearId },
		status,
		generateAllowed,
		schedulerExecuted: scheduler.ran,
		derivedDemandRevision: derived.ok ? derived.revision : null,
		derivedDemandBlockers: derived.ok ? [] : derived.blockers,
		termStructure,
		totals: derived.ok ? { lines: derived.totalLines, pairs: derived.totalPairs, sessionsByTerm: derived.totalsByTerm } : emptyTotals(),
		teachingLoadCoverage: coverage,
		resources: {
			roomCount: rooms.length,
			teachingRoomCount: rooms.filter((r: any) => r.isTeachingSpace).length,
			totalCapacity: rooms.reduce((sum: number, r: any) => sum + (r.capacity ?? 0), 0),
			featureCoverage: countByCode(rooms.flatMap((r: any) => (r.features ?? []) as string[])),
		},
		gradeWindows: { resolvedCount: gradeWindows.length, missingScopes: missingWindows },
		classProgramSlots: { coverage: slotCoverage, missingScopes: missingSlotScopes },
		policy,
		retainedLocks,
		scheduler,
		violations,
		blockers: sortedBlockers,
		databaseSignature: { before: databaseBefore, after: databaseAfter, zeroWrite: sha256(databaseBefore) === sha256(databaseAfter) },
	};
}

const KNOWN_GRADE_LEVELS = new Set([7, 8, 9, 10]);

/**
 * Read-only section grouping. Mirrors `getSectionSummary`'s mirror mapping
 * (sections[].id = externalId) without invoking `resolveRuntimeContext` or the
 * upstream EnrollPro sync, so the readiness dry run stays bounded and
 * zero-write.
 */
async function loadReadOnlySectionsByGrade(schoolId: number, schoolYearId: number, client: any): Promise<SectionsByGrade[]> {
	const mirrors = await client.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
	});
	const byGrade = new Map<number, SectionsByGrade>();
	for (const m of mirrors) {
		if (!byGrade.has(m.gradeLevelId)) {
			byGrade.set(m.gradeLevelId, { gradeLevelId: m.gradeLevelId, gradeLevelName: m.gradeLevelName, displayOrder: m.displayOrder, sections: [] });
		}
		byGrade.get(m.gradeLevelId)!.sections.push({
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
			programType: m.programType,
			programCode: m.programCode,
			programName: m.programName,
			isSpecialProgram: m.isSpecialProgram,
			tleProgramId: m.tleProgramId,
			tleSpecialization: m.tleSpecialization,
			tleProgramCategory: m.tleProgramCategory,
		});
	}
	return [...byGrade.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

function normalizeGrade(value: number): number {
	if (value >= 7 && value <= 10) return value;
	const mappings: Record<number, number> = { 5: 7, 6: 8, 7: 9, 8: 10, 17: 7, 18: 8, 19: 9, 20: 10 };
	if (value in mappings) return mappings[value];
	if (value >= 100) {
		const normalized = value % 100;
		if (normalized >= 1 && normalized <= 12) return normalized;
	}
	return value;
}

function collectDetectedScopes(sectionsByGrade: ConstructorInput['sectionsByGrade']): Array<{ gradeLevel: number; programType: string }> {
	const scopes = new Map<string, { gradeLevel: number; programType: string }>();
	for (const grade of sectionsByGrade) {
		const gradeLevel = normalizeGrade(grade.gradeLevelId);
		for (const section of grade.sections) {
			const programType = normalizeProgramType(section.programType);
			const key = `${gradeLevel}:${programType}`;
			if (!scopes.has(key)) scopes.set(key, { gradeLevel, programType });
		}
	}
	return [...scopes.values()];
}

function summarizeTeachingLoadCoverage(
	derived: DerivedDemandSuccess,
	ownershipBySubjectSection: Map<string, any[]>,
	facultyById: Map<number, { isActiveForScheduling: boolean; isStale: boolean }>,
	scopeByFacultySubject: Map<string, any>,
): GenerationReadinessResult['teachingLoadCoverage'] {
	let ownedPairs = 0;
	let missingPairs = 0;
	let inactiveOrStalePairs = 0;
	let outsideScopePairs = 0;
	const missing: GenerationReadinessResult['teachingLoadCoverage']['missing'] = [];
	for (const pair of derived.teachingLoadPairs) {
		const ownerRows = ownershipBySubjectSection.get(`${pair.subjectId}:${pair.sectionExternalId}`) ?? [];
		if (ownerRows.length === 0) {
			missingPairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		const owner = ownerRows[0];
		const faculty = facultyById.get(owner.facultyId);
		if (!faculty || faculty.isStale || !faculty.isActiveForScheduling) {
			inactiveOrStalePairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		const scope = scopeByFacultySubject.get(`${owner.facultyId}:${pair.subjectId}`);
		if (!scope) {
			outsideScopePairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		ownedPairs += 1;
	}
	return {
		requiredPairs: derived.teachingLoadPairs.length,
		ownedPairs,
		missingPairs,
		inactiveOrStalePairs,
		outsideScopePairs,
		missing: missing.sort((a, b) => `${a.sectionExternalId}:${a.subjectId}`.localeCompare(`${b.sectionExternalId}:${b.subjectId}`)),
	};
}
