import { prisma } from '../lib/prisma.js';
import { Prisma, type LockedSession, type PreGenerationDraftEntryKind, type PreGenerationDraftStatus, type RoomType } from '@prisma/client';
import {
	validateHardConstraints,
	type ScheduledEntry,
	type ValidatorContext,
	type Violation,
} from './constraint-validator.js';
import {
	buildPeriodSlots,
	computeDemand,
	getDemandAssignmentKey,
	type ConstructorInput,
	type DemandItem,
	type PeriodSlot,
	type PolicyInput,
} from './schedule-constructor.js';
import { sectionAdapter } from './section-adapter.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';

function err(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
	const error = new Error(message) as Error & { statusCode: number; code: string; details?: Record<string, unknown> };
	error.statusCode = statusCode;
	error.code = code;
	error.details = details;
	return error;
}

const VALID_DAYS = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);

export interface DraftPlacementInput {
	placementId?: number;
	entryKind?: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	notes?: string | null;
	expectedVersion?: number;
}

export interface DraftPlacementRow {
	id: number;
	schoolId: number;
	schoolYearId: number;
	entryKind: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number | null;
	roomId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode: string | null;
	status: PreGenerationDraftStatus;
	lockedRunId: number | null;
	notes: string | null;
	version: number;
	createdBy: number;
	createdAt: string;
	updatedAt: string;
}

export interface FacultyOptionEnriched {
	id: number;
	name: string;
	department: string | null;
	canTeachOutsideDepartment: boolean;
	/** Existing DRAFT placement minutes per day for this faculty (day → minutes) */
	dailyMinutesByDay: Record<string, number>;
}

export interface DraftQueueItem {
	assignmentKey: string;
	entryKind: 'SECTION' | 'COHORT';
	sectionId: number;
	sectionName: string;
	gradeLevel: number;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sessionNumber: number;
	sessionsPerWeek: number;
	preferredRoomType: RoomType;
	cohortCode: string | null;
	cohortName: string | null;
	programCode: string | null;
	programName: string | null;
	expectedEnrollment: number | null;
	facultyOptions: number[];
	/** Enriched faculty options with daily load context */
	facultyOptionsEnriched: FacultyOptionEnriched[];
	/** True when no faculty is assigned in teaching load for this session */
	hasNoTeacher: boolean;
}

export interface DraftBoardState {
	placements: DraftPlacementRow[];
	queue: DraftQueueItem[];
	periodSlots: PeriodSlot[];
	counts: {
		draft: number;
		lockedForRun: number;
		archived: number;
		unscheduled: number;
	};
	filters: {
		grades: number[];
		departments: string[];
		buildings: Array<{ id: number; name: string; shortCode: string | null }>;
	};
}

export interface DraftPlacementPreview {
	allowed: boolean;
	hardViolations: Violation[];
	softViolations: Violation[];
	violationDelta: {
		hardBefore: number;
		hardAfter: number;
		softBefore: number;
		softAfter: number;
	};
	humanConflicts: Array<{
		code: string;
		severity: 'HARD' | 'SOFT';
		humanTitle: string;
		humanDetail: string;
	}>;
	affectedEntries: Array<{
		entryId: string;
		subjectId: number;
		sectionId: number;
		facultyId: number;
		roomId: number;
		day: string;
		startTime: string;
		endTime: string;
		phase: 'before' | 'after';
		entryKind?: 'SECTION' | 'COHORT';
		cohortCode?: string | null;
	}>;
	policyImpactSummary: Array<{
		code: string;
		label: string;
		summary: string;
		severity: 'HARD' | 'SOFT';
	}>;
	/** Daily teaching-load band for the proposed faculty on the target day */
	dailyLoadBand: 'ok' | 'soft' | 'hard';
	/** Total teaching minutes for the faculty on the target day after this placement */
	dailyMinutesAfter: number;
	/** Faculty teaching minutes per day (from existing DRAFT placements + this candidate) */
	facultyWeeklyMinutes: Record<string, number>;
}

export interface DraftPlacementCommitResult {
	placement: DraftPlacementRow;
	preview: DraftPlacementPreview;
	board: DraftBoardState;
}

export interface DraftPlacementSwapInput {
	sourcePlacementId: number;
	targetPlacementId: number;
	sourceExpectedVersion?: number;
	targetExpectedVersion?: number;
}

export interface DraftPlacementSwapPreview {
	allowed: boolean;
	hardViolations: Violation[];
	softViolations: Violation[];
	violationDelta: {
		hardBefore: number;
		hardAfter: number;
		softBefore: number;
		softAfter: number;
	};
	humanConflicts: Array<{
		code: string;
		severity: 'HARD' | 'SOFT';
		humanTitle: string;
		humanDetail: string;
	}>;
	policyImpactSummary: Array<{
		code: string;
		label: string;
		summary: string;
		severity: 'HARD' | 'SOFT';
	}>;
	dailyLoads: {
		source: {
			placementId: number;
			facultyId: number;
			day: string;
			dailyLoadBand: 'ok' | 'soft' | 'hard';
			dailyMinutesAfter: number;
			facultyWeeklyMinutes: Record<string, number>;
		};
		target: {
			placementId: number;
			facultyId: number;
			day: string;
			dailyLoadBand: 'ok' | 'soft' | 'hard';
			dailyMinutesAfter: number;
			facultyWeeklyMinutes: Record<string, number>;
		};
	};
}

export interface DraftPlacementSwapResult {
	placements: {
		source: DraftPlacementRow;
		target: DraftPlacementRow;
	};
	preview: DraftPlacementSwapPreview;
	board: DraftBoardState;
}

export interface DraftConsumeResult {
	lockedEntries: ConstructorInput['lockedEntries'];
	prePlacedCount: number;
	invalidPrePlacedCount: number;
	skippedPrePlacedReasons: string[];
	acceptedPlacementIds: number[];
}

type DraftContext = Awaited<ReturnType<typeof loadDraftContext>>;

function toDraftRow(placement: LockedSession): DraftPlacementRow {
	return {
		id: placement.id,
		schoolId: placement.schoolId,
		schoolYearId: placement.schoolYearId,
		entryKind: placement.entryKind,
		sectionId: placement.sectionId,
		subjectId: placement.subjectId,
		facultyId: placement.facultyId,
		roomId: placement.roomId,
		day: placement.day,
		startTime: placement.startTime,
		endTime: placement.endTime,
		cohortCode: placement.cohortCode,
		status: placement.status,
		lockedRunId: placement.lockedRunId,
		notes: placement.notes,
		version: placement.version,
		createdBy: placement.createdBy,
		createdAt: placement.createdAt.toISOString(),
		updatedAt: placement.updatedAt.toISOString(),
	};
}

function buildAssignmentKey(input: { entryKind?: 'SECTION' | 'COHORT'; sectionId: number; subjectId: number; cohortCode?: string | null }) {
	return input.entryKind === 'COHORT' && input.cohortCode
		? `${input.cohortCode}:${input.subjectId}`
		: `${input.sectionId}:${input.subjectId}`;
}

function asScheduledEntry(input: DraftPlacementInput, entryId: string, demandItem: DemandItem): ScheduledEntry {
	return {
		entryId,
		facultyId: input.facultyId,
		roomId: input.roomId,
		subjectId: input.subjectId,
		sectionId: input.sectionId,
		day: input.day,
		startTime: input.startTime,
		endTime: input.endTime,
		durationMinutes: timeToMinutes(input.endTime) - timeToMinutes(input.startTime),
		entryKind: input.entryKind ?? 'SECTION',
		programType: demandItem.programType ?? null,
		programCode: demandItem.programCode ?? null,
		programName: demandItem.programName ?? null,
		cohortCode: input.cohortCode ?? demandItem.cohortCode ?? null,
		cohortName: demandItem.cohortName ?? null,
		cohortMemberSectionIds: demandItem.cohortMemberSectionIds,
		cohortExpectedEnrollment: demandItem.entryKind === 'COHORT' ? demandItem.enrolledCount : null,
		adviserId: demandItem.adviserId ?? null,
		adviserName: demandItem.adviserName ?? null,
	};
}

function placementToScheduledEntry(placement: LockedSession, demandItem: DemandItem): ScheduledEntry {
	return asScheduledEntry(
		{
			placementId: placement.id,
			entryKind: placement.entryKind,
			sectionId: placement.sectionId,
			subjectId: placement.subjectId,
			facultyId: placement.facultyId ?? 0,
			roomId: placement.roomId ?? 0,
			day: placement.day,
			startTime: placement.startTime,
			endTime: placement.endTime,
			cohortCode: placement.cohortCode,
			notes: placement.notes,
		},
		`draft-${placement.id}`,
		demandItem,
	);
}

function placementToInput(placement: LockedSession): DraftPlacementInput {
	if (placement.facultyId == null || placement.roomId == null) {
		throw err(422, 'INCOMPLETE_DRAFT_PLACEMENT', `Draft placement ${placement.id} is missing faculty or room assignment.`);
	}
	return {
		placementId: placement.id,
		entryKind: placement.entryKind,
		sectionId: placement.sectionId,
		subjectId: placement.subjectId,
		facultyId: placement.facultyId,
		roomId: placement.roomId,
		day: placement.day,
		startTime: placement.startTime,
		endTime: placement.endTime,
		cohortCode: placement.cohortCode,
		notes: placement.notes,
		expectedVersion: placement.version,
	};
}

function timeToMinutes(value: string) {
	const [hours, minutes] = value.split(':').map(Number);
	return hours * 60 + minutes;
}

/** Sum teaching minutes for a faculty member on a given day from a list of entries */
function computeFacultyDailyMinutes(facultyId: number, day: string, entries: ScheduledEntry[]): number {
	return entries
		.filter((e) => e.facultyId === facultyId && e.day === day)
		.reduce((sum, e) => sum + e.durationMinutes, 0);
}

/** Compute all-day teaching minutes map for a faculty from existing DRAFT placements */
function computeFacultyWeeklyMinutes(facultyId: number, placements: LockedSession[]): Record<string, number> {
	const result: Record<string, number> = { MONDAY: 0, TUESDAY: 0, WEDNESDAY: 0, THURSDAY: 0, FRIDAY: 0 };
	for (const p of placements) {
		if (p.facultyId === facultyId && p.status === 'DRAFT') {
			const mins = timeToMinutes(p.endTime) - timeToMinutes(p.startTime);
			result[p.day] = (result[p.day] ?? 0) + Math.max(0, mins);
		}
	}
	return result;
}

function computeFacultyWeeklyMinutesFromEntries(facultyId: number, entries: ScheduledEntry[]): Record<string, number> {
	const result: Record<string, number> = { MONDAY: 0, TUESDAY: 0, WEDNESDAY: 0, THURSDAY: 0, FRIDAY: 0 };
	for (const entry of entries) {
		if (entry.facultyId === facultyId) {
			result[entry.day] = (result[entry.day] ?? 0) + entry.durationMinutes;
		}
	}
	return result;
}

const DAILY_LOAD_SOFT_THRESHOLD = 360; // 6 hours
const DAILY_LOAD_HARD_THRESHOLD = 480; // 8 hours

function classifyDailyLoadBand(minutesAfter: number): 'ok' | 'soft' | 'hard' {
	if (minutesAfter > DAILY_LOAD_HARD_THRESHOLD) return 'hard';
	if (minutesAfter > DAILY_LOAD_SOFT_THRESHOLD) return 'soft';
	return 'ok';
}

const HUMAN_VIOLATION_TITLES: Partial<Record<string, string>> = {
	FACULTY_TIME_CONFLICT: 'Faculty Schedule Conflict',
	ROOM_TIME_CONFLICT: 'Room Double-Booked',
	FACULTY_OVERLOAD: 'Faculty Weekly Overload',
	ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
	ROOM_CAPACITY_EXCEEDED: 'Room Capacity Exceeded',
	SESSION_PATTERN_VIOLATED: 'Session Pattern Violated',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Faculty Not Qualified',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily Load Exceeded',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement Violated',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Teaching Limit Exceeded',
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Too Many Building Transitions',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient Transition Buffer',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Excessive Idle Gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early Start Preference',
};

function buildHumanConflicts(violations: Violation[], ctx?: DraftContext) {
	const facultyName = (id?: number): string => {
		if (!id) return `Faculty #?`;
		const f = ctx?.facultyMirrors.find((m) => m.id === id);
		if (!f) return `Faculty #${id}`;
		const initial = f.firstName ? `${f.firstName.charAt(0).toUpperCase()}.` : '';
		return initial ? `${initial} ${f.lastName}` : f.lastName;
	};
	const roomName = (id?: number): string => {
		if (!id) return `Room #?`;
		const r = ctx?.rooms.find((rm) => rm.id === id);
		if (!r) return `Room #${id}`;
		const bldgLabel = r.building?.shortCode || r.building?.name || '';
		return bldgLabel ? `${r.name} · ${bldgLabel}` : r.name;
	};
	const sectionName = (id?: number): string => {
		if (!id) return `Section #?`;
		const s = ctx?.sectionsById.get(id);
		return s?.name ?? `Section #${id}`;
	};

	return violations.map((v) => {
		const humanTitle = HUMAN_VIOLATION_TITLES[v.code] ?? v.code.replaceAll('_', ' ');
		let humanDetail = v.message;
		// Replace raw numeric IDs with display names for common entity references
		if (v.entities.facultyId != null) {
			humanDetail = humanDetail
				.replace(new RegExp(`Faculty ${v.entities.facultyId}(?=\\s|,|:|\\.|-|$)`, 'g'), facultyName(v.entities.facultyId));
		}
		if (v.entities.roomId != null) {
			humanDetail = humanDetail
				.replace(new RegExp(`Room ${v.entities.roomId}(?=\\s|,|:|\\.|-|$)`, 'g'), roomName(v.entities.roomId));
		}
		if (v.entities.sectionId != null) {
			humanDetail = humanDetail
				.replace(new RegExp(`section ${v.entities.sectionId}(?=\\s|,|:|\\.|-|$)`, 'gi'), sectionName(v.entities.sectionId));
		}
		return { code: v.code, severity: v.severity, humanTitle, humanDetail };
	});
}

function buildPolicyImpactSummary(violations: Violation[]) {
	return violations
		.filter((violation) => violation.meta != null)
		.map((violation) => ({
			code: violation.code,
			label: violation.code.replaceAll('_', ' '),
			summary: violation.message,
			severity: violation.severity,
		}));
}

async function loadDraftContext(schoolId: number, schoolYearId: number) {
	const [sectionResult, facultyMirrors, facultyRefs, facultySubjectRows, subjects, rooms, buildings, policyRecord, gradeWindows, placements, cohorts] = await Promise.all([
		sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId),
		prisma.facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true, isStale: false },
			select: { id: true, firstName: true, lastName: true, department: true, maxHoursPerWeek: true, isActiveForScheduling: true, canTeachOutsideDepartment: true },
		}),
		prisma.facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true, isStale: false },
			select: { id: true, maxHoursPerWeek: true },
		}),
		prisma.facultySubject.findMany({
			where: { schoolId },
			select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
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
			},
		}),
		prisma.room.findMany({
			where: { building: { schoolId, isTeachingBuilding: true } },
			select: {
				id: true,
				name: true,
				type: true,
				capacity: true,
				isTeachingSpace: true,
				floor: true,
				buildingId: true,
				building: { select: { id: true, name: true, shortCode: true, x: true, y: true } },
			},
		}),
		prisma.building.findMany({ where: { schoolId }, select: { id: true, name: true, shortCode: true, x: true, y: true } }),
		getOrCreatePolicy(schoolId, schoolYearId),
		prisma.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } }),
		prisma.lockedSession.findMany({ where: { schoolId, schoolYearId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
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
	]);

	const rosterIndex = buildSectionRosterIndex(sectionResult.gradeLevels);
	const facultySubjects = facultySubjectRows.map((assignment) => {
		const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
		return {
			facultyId: assignment.facultyId,
			subjectId: assignment.subjectId,
			gradeLevels: normalized.gradeLevels,
			sectionIds: normalized.sectionIds,
		};
	});

	const sectionsById = new Map(sectionResult.gradeLevels.flatMap((grade) => grade.sections.map((section) => [section.id, section] as const)));
	const sectionEnrollment = new Map(sectionResult.gradeLevels.flatMap((grade) => grade.sections.map((section) => [section.id, section.enrolledCount] as const)));
	const periodSlots = buildPeriodSlots({
		maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
		minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
		maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
		earliestStartTime: policyRecord.earliestStartTime,
		latestEndTime: policyRecord.latestEndTime,
		lunchStartTime: policyRecord.lunchStartTime ?? undefined,
		lunchEndTime: policyRecord.lunchEndTime ?? undefined,
		enforceLunchWindow: policyRecord.enforceLunchWindow ?? undefined,
	} satisfies PolicyInput);

	const demand = computeDemand(sectionResult.gradeLevels, subjects, cohorts);
	const demandByKey = new Map(demand.map((item) => [getDemandAssignmentKey(item), item]));
	const qualifiedByKey = new Map<string, number[]>();
	for (const assignment of facultySubjects) {
		for (const sectionId of assignment.sectionIds) {
			const key = `${sectionId}:${assignment.subjectId}`;
			const list = qualifiedByKey.get(key) ?? [];
			list.push(assignment.facultyId);
			qualifiedByKey.set(key, list);
		}
	}

	return {
		sections: sectionResult.gradeLevels,
		sectionsById,
		sectionEnrollment,
		facultyMirrors,
		facultyRefs,
		facultySubjects,
		subjects,
		cohorts,
		rooms,
		buildings,
		policyRecord,
		gradeWindows,
		placements,
		periodSlots,
		demand,
		demandByKey,
		qualifiedByKey,
	};
}

function buildValidatorCtx(schoolId: number, schoolYearId: number, entries: ScheduledEntry[], ctx: DraftContext): ValidatorContext {
	return {
		schoolId,
		schoolYearId,
		runId: 0,
		entries,
		faculty: ctx.facultyRefs,
		facultySubjects: ctx.facultySubjects,
		rooms: ctx.rooms.map((room) => ({ id: room.id, type: room.type, capacity: room.capacity })),
		subjects: ctx.subjects.map((subject) => ({ id: subject.id, preferredRoomType: subject.preferredRoomType, sessionPattern: subject.sessionPattern })),
		sectionEnrollment: ctx.sectionEnrollment,
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: ctx.policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
			minBreakMinutesAfterConsecutiveBlock: ctx.policyRecord.minBreakMinutesAfterConsecutiveBlock,
			maxTeachingMinutesPerDay: ctx.policyRecord.maxTeachingMinutesPerDay,
			earliestStartTime: ctx.policyRecord.earliestStartTime,
			latestEndTime: ctx.policyRecord.latestEndTime,
			enforceConsecutiveBreakAsHard: ctx.policyRecord.enforceConsecutiveBreakAsHard,
		},
		travelPolicy: {
			enableTravelWellbeingChecks: ctx.policyRecord.enableTravelWellbeingChecks,
			maxWalkingDistanceMetersPerTransition: ctx.policyRecord.maxWalkingDistanceMetersPerTransition,
			maxBuildingTransitionsPerDay: ctx.policyRecord.maxBuildingTransitionsPerDay,
			maxBackToBackTransitionsWithoutBuffer: ctx.policyRecord.maxBackToBackTransitionsWithoutBuffer,
			maxIdleGapMinutesPerDay: ctx.policyRecord.maxIdleGapMinutesPerDay,
			avoidEarlyFirstPeriod: ctx.policyRecord.avoidEarlyFirstPeriod,
			avoidLateLastPeriod: ctx.policyRecord.avoidLateLastPeriod,
		},
		vacantPolicy: {
			enableVacantAwareConstraints: ctx.policyRecord.enableVacantAwareConstraints,
			targetFacultyDailyVacantMinutes: ctx.policyRecord.targetFacultyDailyVacantMinutes,
			targetSectionDailyVacantPeriods: ctx.policyRecord.targetSectionDailyVacantPeriods,
			maxCompressedTeachingMinutesPerDay: ctx.policyRecord.maxCompressedTeachingMinutesPerDay,
		},
		buildings: ctx.buildings,
		roomBuildings: ctx.rooms.map((room) => ({ roomId: room.id, buildingId: room.buildingId })),
		constraintConfig: {
			...DEFAULT_CONSTRAINT_CONFIG,
			...(ctx.policyRecord.constraintConfig as Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }> ?? {}),
		},
	};
}

function validateInputOrThrow(input: DraftPlacementInput, ctx: DraftContext) {
	if (!VALID_DAYS.has(input.day)) {
		throw err(400, 'INVALID_DAY', 'Day must be one of MONDAY, TUESDAY, WEDNESDAY, THURSDAY, or FRIDAY.');
	}
	if (!ctx.periodSlots.some((slot) => slot.startTime === input.startTime && slot.endTime === input.endTime)) {
		throw err(422, 'INVALID_TIME_SLOT', `Time slot ${input.startTime}-${input.endTime} is outside the configured policy window.`);
	}
	const assignmentKey = buildAssignmentKey(input);
	const demandItem = ctx.demandByKey.get(assignmentKey);
	if (!demandItem) {
		throw err(422, 'ORPHANED_ASSIGNMENT_SCOPE', 'This placement no longer maps to an active section/cohort scheduling demand.', { assignmentKey });
	}
	if (!ctx.sectionsById.has(input.sectionId)) {
		throw err(422, 'ORPHANED_SECTION', 'Section reference is no longer available from the current EnrollPro section snapshot.');
	}
	if (!ctx.subjects.some((subject) => subject.id === input.subjectId)) {
		throw err(422, 'ORPHANED_SUBJECT', 'Subject reference is not active in the current school scope.');
	}
	if (!ctx.facultyMirrors.some((faculty) => faculty.id === input.facultyId)) {
		throw err(422, 'ORPHANED_FACULTY', 'Faculty reference is no longer active in the current faculty mirror set.');
	}
	const room = ctx.rooms.find((candidate) => candidate.id === input.roomId && candidate.isTeachingSpace);
	if (!room) {
		throw err(422, 'ORPHANED_ROOM', 'Room reference is not an active teaching room in the current campus map.');
	}
	// Room vs enrollment capacity is validated as SOFT in constraint-validator (ROOM_CAPACITY_EXCEEDED), not a hard pre-check here.
	const gradeWindow = ctx.gradeWindows.find((window) => window.gradeLevel === demandItem.gradeLevel);
	if (gradeWindow) {
		const startMinutes = timeToMinutes(input.startTime);
		const endMinutes = timeToMinutes(input.endTime);
		if (startMinutes < timeToMinutes(gradeWindow.startTime) || endMinutes > timeToMinutes(gradeWindow.endTime)) {
			throw err(422, 'GRADE_WINDOW_BLOCK', `Selected slot is outside Grade ${demandItem.gradeLevel} scheduling window ${gradeWindow.startTime}-${gradeWindow.endTime}.`);
		}
	}
	return demandItem;
}


function buildExistingEntries(ctx: DraftContext, excludedPlacementIds?: Iterable<number>) {
	const excludedIds = new Set(excludedPlacementIds ?? []);
	return ctx.placements
		.filter((placement) => placement.status === 'DRAFT' && !excludedIds.has(placement.id))
		.map((placement) => {
			const demandItem = ctx.demandByKey.get(buildAssignmentKey({
				entryKind: placement.entryKind,
				sectionId: placement.sectionId,
				subjectId: placement.subjectId,
				cohortCode: placement.cohortCode,
			}));
			if (!demandItem || placement.facultyId == null || placement.roomId == null) {
				return null;
			}
			return placementToScheduledEntry(placement, demandItem);
		})
		.filter((entry): entry is ScheduledEntry => entry != null);
}

export async function previewPlacement(schoolId: number, schoolYearId: number, input: DraftPlacementInput): Promise<DraftPlacementPreview> {
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	const existingPlacement = input.placementId != null
		? ctx.placements.find((placement) => placement.id === input.placementId && placement.status === 'DRAFT')
		: null;
	if (input.placementId != null && !existingPlacement) {
		throw err(404, 'PLACEMENT_NOT_FOUND', 'Draft placement was not found or is no longer editable.');
	}
	const demandItem = validateInputOrThrow({ ...input, entryKind: input.entryKind ?? existingPlacement?.entryKind ?? 'SECTION' }, ctx);
	const currentEntries = buildExistingEntries(ctx);
	const currentValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, currentEntries, ctx));
	const candidateEntry = asScheduledEntry({
		...input,
		entryKind: input.entryKind ?? existingPlacement?.entryKind ?? 'SECTION',
		cohortCode: input.cohortCode ?? existingPlacement?.cohortCode ?? null,
	}, `draft-preview-${input.placementId ?? 'new'}`, demandItem);
	const nextEntries = [...buildExistingEntries(ctx, input.placementId != null ? [input.placementId] : []), candidateEntry];
	const nextValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, nextEntries, ctx));
	const hardViolations = nextValidation.violations.filter((violation) => violation.severity === 'HARD');
	const softViolations = nextValidation.violations.filter((violation) => violation.severity === 'SOFT');

	// Daily load band computation (independent of policy maxTeachingMinutesPerDay)
	const existingDailyMinutes = computeFacultyDailyMinutes(input.facultyId, input.day, buildExistingEntries(ctx, input.placementId != null ? [input.placementId] : []));
	const candidateDuration = timeToMinutes(input.endTime) - timeToMinutes(input.startTime);
	const dailyMinutesAfter = existingDailyMinutes + Math.max(0, candidateDuration);
	const dailyLoadBand = classifyDailyLoadBand(dailyMinutesAfter);

	// Faculty weekly minutes (existing DRAFT placements + candidate for target day)
	const facultyWeeklyMinutes = computeFacultyWeeklyMinutes(input.facultyId, ctx.placements);
	facultyWeeklyMinutes[input.day] = dailyMinutesAfter;

	const beforeEntry = existingPlacement && existingPlacement.facultyId != null && existingPlacement.roomId != null
		? asScheduledEntry({
			placementId: existingPlacement.id,
			entryKind: existingPlacement.entryKind,
			sectionId: existingPlacement.sectionId,
			subjectId: existingPlacement.subjectId,
			facultyId: existingPlacement.facultyId,
			roomId: existingPlacement.roomId,
			day: existingPlacement.day,
			startTime: existingPlacement.startTime,
			endTime: existingPlacement.endTime,
			cohortCode: existingPlacement.cohortCode,
			notes: existingPlacement.notes,
		}, `draft-${existingPlacement.id}`, demandItem)
		: null;
	return {
		allowed: hardViolations.length === 0,
		hardViolations,
		softViolations,
		violationDelta: {
			hardBefore: currentValidation.violations.filter((violation) => violation.severity === 'HARD').length,
			hardAfter: hardViolations.length,
			softBefore: currentValidation.violations.filter((violation) => violation.severity === 'SOFT').length,
			softAfter: softViolations.length,
		},
		humanConflicts: buildHumanConflicts([...hardViolations, ...softViolations], ctx),
		affectedEntries: [
			...(beforeEntry ? [{
				entryId: beforeEntry.entryId,
				subjectId: beforeEntry.subjectId,
				sectionId: beforeEntry.sectionId,
				facultyId: beforeEntry.facultyId,
				roomId: beforeEntry.roomId,
				day: beforeEntry.day,
				startTime: beforeEntry.startTime,
				endTime: beforeEntry.endTime,
				phase: 'before' as const,
				entryKind: beforeEntry.entryKind,
				cohortCode: beforeEntry.cohortCode ?? null,
			}] : []),
			{
				entryId: candidateEntry.entryId,
				subjectId: candidateEntry.subjectId,
				sectionId: candidateEntry.sectionId,
				facultyId: candidateEntry.facultyId,
				roomId: candidateEntry.roomId,
				day: candidateEntry.day,
				startTime: candidateEntry.startTime,
				endTime: candidateEntry.endTime,
				phase: 'after' as const,
				entryKind: candidateEntry.entryKind,
				cohortCode: candidateEntry.cohortCode ?? null,
			},
		],
		policyImpactSummary: buildPolicyImpactSummary([...hardViolations, ...softViolations]),
		dailyLoadBand,
		dailyMinutesAfter,
		facultyWeeklyMinutes,
	};
}

async function buildBoardStateFromContext(schoolId: number, schoolYearId: number, ctx: DraftContext): Promise<DraftBoardState> {
	const placements = ctx.placements.map(toDraftRow);
	const counts = {
		draft: placements.filter((placement) => placement.status === 'DRAFT').length,
		lockedForRun: placements.filter((placement) => placement.status === 'LOCKED_FOR_RUN').length,
		archived: placements.filter((placement) => placement.status === 'ARCHIVED').length,
		unscheduled: 0,
	};
	const queue: DraftQueueItem[] = [];
	const draftCounts = new Map<string, number>();
	for (const placement of ctx.placements.filter((row) => row.status === 'DRAFT')) {
		const key = buildAssignmentKey({ entryKind: placement.entryKind, sectionId: placement.sectionId, subjectId: placement.subjectId, cohortCode: placement.cohortCode });
		draftCounts.set(key, (draftCounts.get(key) ?? 0) + 1);
	}
	for (const demandItem of ctx.demand) {
		const key = getDemandAssignmentKey(demandItem);
		const placedCount = draftCounts.get(key) ?? 0;
		for (let sessionNumber = placedCount + 1; sessionNumber <= demandItem.sessionsPerWeek; sessionNumber++) {
			const section = ctx.sectionsById.get(demandItem.sectionId);
			const rawFacultyOptions = (demandItem.entryKind === 'COHORT' && demandItem.cohortMemberSectionIds?.length)
				? demandItem.cohortMemberSectionIds
					.map((sectionId) => ctx.qualifiedByKey.get(`${sectionId}:${demandItem.subjectId}`) ?? [])
					.reduce<number[]>((carry, list, index) => index === 0 ? [...list] : carry.filter((facultyId) => list.includes(facultyId)), [])
					.sort((left, right) => left - right)
				: [...(ctx.qualifiedByKey.get(`${demandItem.sectionId}:${demandItem.subjectId}`) ?? [])].sort((left, right) => left - right);

			const facultyOptionsEnriched: FacultyOptionEnriched[] = rawFacultyOptions.map((fId) => {
				const mirror = ctx.facultyMirrors.find((m) => m.id === fId);
				return {
					id: fId,
					name: mirror ? `${mirror.lastName}, ${mirror.firstName}` : `Faculty #${fId}`,
					department: mirror?.department ?? null,
					canTeachOutsideDepartment: mirror?.canTeachOutsideDepartment ?? false,
					dailyMinutesByDay: computeFacultyWeeklyMinutes(fId, ctx.placements),
				};
			});

			queue.push({
				assignmentKey: key,
				entryKind: demandItem.entryKind,
				sectionId: demandItem.sectionId,
				sectionName: section?.name ?? `Section #${demandItem.sectionId}`,
				gradeLevel: demandItem.gradeLevel,
				subjectId: demandItem.subjectId,
				subjectCode: demandItem.subjectCode,
				subjectName: ctx.subjects.find((subject) => subject.id === demandItem.subjectId)?.name ?? demandItem.subjectCode,
				sessionNumber,
				sessionsPerWeek: demandItem.sessionsPerWeek,
				preferredRoomType: demandItem.roomTypePreference ?? ctx.subjects.find((subject) => subject.id === demandItem.subjectId)?.preferredRoomType ?? 'CLASSROOM',
				cohortCode: demandItem.cohortCode ?? null,
				cohortName: demandItem.cohortName ?? null,
				programCode: demandItem.programCode ?? null,
				programName: demandItem.programName ?? null,
				expectedEnrollment: demandItem.enrolledCount,
				facultyOptions: rawFacultyOptions,
				facultyOptionsEnriched,
				hasNoTeacher: rawFacultyOptions.length === 0,
			});
			counts.unscheduled++;
		}
	}
	return {
		placements,
		queue,
		periodSlots: ctx.periodSlots,
		counts,
		filters: {
			grades: [...new Set(ctx.sections.map((grade) => grade.displayOrder))].sort((left, right) => left - right),
			departments: [...new Set(ctx.facultyMirrors.map((faculty) => faculty.department).filter((department): department is string => Boolean(department)))].sort((left, right) => left.localeCompare(right)),
			buildings: ctx.buildings.map((building) => ({ id: building.id, name: building.name, shortCode: building.shortCode })),
		},
	};
}

export async function listDraftBoardState(schoolId: number, schoolYearId: number): Promise<DraftBoardState> {
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	return buildBoardStateFromContext(schoolId, schoolYearId, ctx);
}

export async function getDraftPlacement(schoolId: number, schoolYearId: number, placementId: number): Promise<DraftPlacementRow> {
	const placement = await prisma.lockedSession.findFirst({ where: { id: placementId, schoolId, schoolYearId } });
	if (!placement) {
		throw err(404, 'PLACEMENT_NOT_FOUND', 'Draft placement was not found in this school/year scope.');
	}
	return toDraftRow(placement);
}

export async function commitPlacement(schoolId: number, schoolYearId: number, actorId: number, input: DraftPlacementInput, allowSoftOverride = false): Promise<DraftPlacementCommitResult> {
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	const preview = await previewPlacement(schoolId, schoolYearId, input);
	if (preview.hardViolations.length > 0) {
		throw err(422, 'HARD_VIOLATION_BLOCK', 'Placement cannot be committed while hard conflicts remain.', { hardViolations: preview.hardViolations.map((violation) => violation.code) });
	}
	// Daily load hard block: no override allowed above 8 hours
	if (preview.dailyLoadBand === 'hard') {
		throw err(422, 'DAILY_LOAD_HARD_BLOCK', `This placement would exceed the 8-hour daily teaching limit (${Math.round(preview.dailyMinutesAfter / 60 * 10) / 10}h on ${input.day}). Choose a different day, slot, or faculty.`, { dailyMinutesAfter: preview.dailyMinutesAfter });
	}
	void allowSoftOverride;

	let placement: LockedSession;
	let actionType: string;
	let beforePayload: object | null = null;
	if (input.placementId != null) {
		const existing = ctx.placements.find((row) => row.id === input.placementId && row.status === 'DRAFT');
		if (!existing) {
			throw err(404, 'PLACEMENT_NOT_FOUND', 'Draft placement was not found or is no longer editable.');
		}
		if (input.expectedVersion != null && existing.version !== input.expectedVersion) {
			throw err(409, 'VERSION_CONFLICT', `Draft placement version conflict: expected ${input.expectedVersion}, actual ${existing.version}.`);
		}
		actionType = 'UPDATE';
		beforePayload = existing as unknown as object;
		placement = await prisma.lockedSession.update({
			where: { id: existing.id },
			data: {
				entryKind: input.entryKind ?? existing.entryKind,
				sectionId: input.sectionId,
				subjectId: input.subjectId,
				facultyId: input.facultyId,
				roomId: input.roomId,
				day: input.day as any,
				startTime: input.startTime,
				endTime: input.endTime,
				cohortCode: input.cohortCode ?? null,
				notes: input.notes ?? null,
				status: 'DRAFT',
				lockedRunId: null,
				version: { increment: 1 },
			},
		});
	} else {
		actionType = 'CREATE';
		placement = await prisma.lockedSession.create({
			data: {
				schoolId,
				schoolYearId,
				entryKind: input.entryKind ?? 'SECTION',
				sectionId: input.sectionId,
				subjectId: input.subjectId,
				facultyId: input.facultyId,
				roomId: input.roomId,
				day: input.day as any,
				startTime: input.startTime,
				endTime: input.endTime,
				cohortCode: input.cohortCode ?? null,
				notes: input.notes ?? null,
				createdBy: actorId,
				status: 'DRAFT',
			},
		});
	}

	await prisma.$transaction([
		prisma.lockedSessionAction.create({
			data: {
				lockId: placement.id,
				schoolId,
				schoolYearId,
				actorId,
				actionType,
				beforePayload: beforePayload ?? Prisma.JsonNull,
				afterPayload: placement as unknown as object,
			},
		}),
		prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PRE_GENERATION_DRAFT_COMMIT',
				actorId,
				targetIds: [placement.id],
				metadata: { actionType, preview } as object,
			},
		}),
	]);

	const refreshed = await loadDraftContext(schoolId, schoolYearId);
	return {
		placement: toDraftRow(placement),
		preview,
		board: await buildBoardStateFromContext(schoolId, schoolYearId, refreshed),
	};
}

function getDraftPlacementOrThrow(ctx: DraftContext, placementId: number, expectedVersion?: number) {
	const placement = ctx.placements.find((row) => row.id === placementId && row.status === 'DRAFT');
	if (!placement) {
		throw err(404, 'PLACEMENT_NOT_FOUND', `Draft placement ${placementId} was not found or is no longer editable.`);
	}
	if (expectedVersion != null && placement.version !== expectedVersion) {
		throw err(409, 'VERSION_CONFLICT', `Draft placement version conflict: expected ${expectedVersion}, actual ${placement.version}.`, { placementId });
	}
	return placement;
}

function buildSwapPreview(ctx: DraftContext, sourcePlacement: LockedSession, targetPlacement: LockedSession): DraftPlacementSwapPreview {
	const currentEntries = buildExistingEntries(ctx);
	const currentValidation = validateHardConstraints(buildValidatorCtx(sourcePlacement.schoolId, sourcePlacement.schoolYearId, currentEntries, ctx));
	const sourceOriginal = placementToInput(sourcePlacement);
	const targetOriginal = placementToInput(targetPlacement);
	const sourceInput: DraftPlacementInput = {
		...sourceOriginal,
		day: targetPlacement.day,
		startTime: targetPlacement.startTime,
		endTime: targetPlacement.endTime,
	};
	const targetInput: DraftPlacementInput = {
		...targetOriginal,
		day: sourcePlacement.day,
		startTime: sourcePlacement.startTime,
		endTime: sourcePlacement.endTime,
	};
	const sourceDemand = validateInputOrThrow(sourceInput, ctx);
	const targetDemand = validateInputOrThrow(targetInput, ctx);
	const nextEntries = [
		...buildExistingEntries(ctx, [sourcePlacement.id, targetPlacement.id]),
		asScheduledEntry(sourceInput, `draft-swap-${sourcePlacement.id}`, sourceDemand),
		asScheduledEntry(targetInput, `draft-swap-${targetPlacement.id}`, targetDemand),
	];
	const nextValidation = validateHardConstraints(buildValidatorCtx(sourcePlacement.schoolId, sourcePlacement.schoolYearId, nextEntries, ctx));
	const hardViolations = nextValidation.violations.filter((violation) => violation.severity === 'HARD');
	const softViolations = nextValidation.violations.filter((violation) => violation.severity === 'SOFT');
	const sourceDailyMinutesAfter = computeFacultyDailyMinutes(sourceInput.facultyId, sourceInput.day, nextEntries);
	const targetDailyMinutesAfter = computeFacultyDailyMinutes(targetInput.facultyId, targetInput.day, nextEntries);
	return {
		allowed: hardViolations.length === 0
			&& classifyDailyLoadBand(sourceDailyMinutesAfter) !== 'hard'
			&& classifyDailyLoadBand(targetDailyMinutesAfter) !== 'hard',
		hardViolations,
		softViolations,
		violationDelta: {
			hardBefore: currentValidation.violations.filter((violation) => violation.severity === 'HARD').length,
			hardAfter: hardViolations.length,
			softBefore: currentValidation.violations.filter((violation) => violation.severity === 'SOFT').length,
			softAfter: softViolations.length,
		},
		humanConflicts: buildHumanConflicts([...hardViolations, ...softViolations], ctx),
		policyImpactSummary: buildPolicyImpactSummary([...hardViolations, ...softViolations]),
		dailyLoads: {
			source: {
				placementId: sourcePlacement.id,
				facultyId: sourceInput.facultyId,
				day: sourceInput.day,
				dailyLoadBand: classifyDailyLoadBand(sourceDailyMinutesAfter),
				dailyMinutesAfter: sourceDailyMinutesAfter,
				facultyWeeklyMinutes: computeFacultyWeeklyMinutesFromEntries(sourceInput.facultyId, nextEntries),
			},
			target: {
				placementId: targetPlacement.id,
				facultyId: targetInput.facultyId,
				day: targetInput.day,
				dailyLoadBand: classifyDailyLoadBand(targetDailyMinutesAfter),
				dailyMinutesAfter: targetDailyMinutesAfter,
				facultyWeeklyMinutes: computeFacultyWeeklyMinutesFromEntries(targetInput.facultyId, nextEntries),
			},
		},
	};
}

export async function previewSwapPlacements(
	schoolId: number,
	schoolYearId: number,
	input: DraftPlacementSwapInput,
): Promise<DraftPlacementSwapPreview> {
	if (input.sourcePlacementId === input.targetPlacementId) {
		throw err(422, 'NOOP_SWAP', 'Source and target placements must be different draft entries.');
	}
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	const sourcePlacement = getDraftPlacementOrThrow(ctx, input.sourcePlacementId, input.sourceExpectedVersion);
	const targetPlacement = getDraftPlacementOrThrow(ctx, input.targetPlacementId, input.targetExpectedVersion);
	return buildSwapPreview(ctx, sourcePlacement, targetPlacement);
}

export async function swapPlacements(
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	input: DraftPlacementSwapInput,
): Promise<DraftPlacementSwapResult> {
	if (input.sourcePlacementId === input.targetPlacementId) {
		throw err(422, 'NOOP_SWAP', 'Source and target placements must be different draft entries.');
	}
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	const sourcePlacement = getDraftPlacementOrThrow(ctx, input.sourcePlacementId, input.sourceExpectedVersion);
	const targetPlacement = getDraftPlacementOrThrow(ctx, input.targetPlacementId, input.targetExpectedVersion);
	const preview = buildSwapPreview(ctx, sourcePlacement, targetPlacement);
	if (preview.hardViolations.length > 0) {
		throw err(422, 'HARD_VIOLATION_BLOCK', 'Swap cannot be committed while hard conflicts remain.', { hardViolations: preview.hardViolations.map((violation) => violation.code) });
	}
	if (preview.dailyLoads.source.dailyLoadBand === 'hard' || preview.dailyLoads.target.dailyLoadBand === 'hard') {
		throw err(422, 'DAILY_LOAD_HARD_BLOCK', 'Swap cannot be committed because one leg exceeds the 8-hour daily teaching limit.', {
			sourceDailyMinutesAfter: preview.dailyLoads.source.dailyMinutesAfter,
			targetDailyMinutesAfter: preview.dailyLoads.target.dailyMinutesAfter,
		});
	}
	const [updatedSource, updatedTarget] = await prisma.$transaction(async (tx) => {
		const nextSource = await tx.lockedSession.update({
			where: { id: sourcePlacement.id },
			data: {
				day: targetPlacement.day as any,
				startTime: targetPlacement.startTime,
				endTime: targetPlacement.endTime,
				version: { increment: 1 },
			},
		});
		const nextTarget = await tx.lockedSession.update({
			where: { id: targetPlacement.id },
			data: {
				day: sourcePlacement.day as any,
				startTime: sourcePlacement.startTime,
				endTime: sourcePlacement.endTime,
				version: { increment: 1 },
			},
		});
		await tx.lockedSessionAction.createMany({
			data: [
				{
					lockId: sourcePlacement.id,
					schoolId,
					schoolYearId,
					actorId,
					actionType: 'SWAP',
					beforePayload: sourcePlacement as unknown as object,
					afterPayload: nextSource as unknown as object,
				},
				{
					lockId: targetPlacement.id,
					schoolId,
					schoolYearId,
					actorId,
					actionType: 'SWAP',
					beforePayload: targetPlacement as unknown as object,
					afterPayload: nextTarget as unknown as object,
				},
			],
		});
		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PRE_GENERATION_DRAFT_SWAP',
				actorId,
				targetIds: [sourcePlacement.id, targetPlacement.id],
				metadata: {
					sourcePlacementId: sourcePlacement.id,
					targetPlacementId: targetPlacement.id,
					preview,
				} as object,
			},
		});
		return [nextSource, nextTarget] as const;
	});
	const refreshed = await loadDraftContext(schoolId, schoolYearId);
	return {
		placements: {
			source: toDraftRow(updatedSource),
			target: toDraftRow(updatedTarget),
		},
		preview,
		board: await buildBoardStateFromContext(schoolId, schoolYearId, refreshed),
	};
}

export async function clearDraft(schoolId: number, schoolYearId: number, actorId: number) {
	const draftPlacements = await prisma.lockedSession.findMany({ where: { schoolId, schoolYearId, status: 'DRAFT' } });
	if (draftPlacements.length === 0) {
		return listDraftBoardState(schoolId, schoolYearId);
	}
	await prisma.$transaction([
		prisma.lockedSession.updateMany({ where: { schoolId, schoolYearId, status: 'DRAFT' }, data: { status: 'ARCHIVED', version: { increment: 1 } } }),
		prisma.lockedSessionAction.create({
			data: {
				schoolId,
				schoolYearId,
				actorId,
				actionType: 'CLEAR_DRAFT',
				beforePayload: draftPlacements as unknown as object,
				afterPayload: { archivedCount: draftPlacements.length } as object,
			},
		}),
		prisma.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PRE_GENERATION_DRAFT_CLEAR',
				actorId,
				targetIds: draftPlacements.map((placement) => placement.id),
				metadata: { archivedCount: draftPlacements.length } as object,
			},
		}),
	]);
	return listDraftBoardState(schoolId, schoolYearId);
}

export async function undoLastPlacement(schoolId: number, schoolYearId: number, actorId: number) {
	const action = await prisma.lockedSessionAction.findFirst({
		where: { schoolId, schoolYearId, actionType: { not: 'UNDO' } },
		orderBy: { createdAt: 'desc' },
	});
	if (!action) {
		throw err(400, 'NOTHING_TO_UNDO', 'No draft placement actions are available to undo.');
	}
	await prisma.$transaction(async (tx) => {
		if (action.actionType === 'CREATE' && action.lockId != null) {
			await tx.lockedSession.update({ where: { id: action.lockId }, data: { status: 'ARCHIVED', version: { increment: 1 } } });
		} else if (action.actionType === 'UPDATE' && action.lockId != null) {
			const before = action.beforePayload as Record<string, unknown> | null;
			if (!before) throw err(500, 'UNDO_STATE_INVALID', 'Missing previous state for placement update undo.');
			await tx.lockedSession.update({
				where: { id: action.lockId },
				data: {
					entryKind: before.entryKind as PreGenerationDraftEntryKind,
					sectionId: Number(before.sectionId),
					subjectId: Number(before.subjectId),
					facultyId: before.facultyId == null ? null : Number(before.facultyId),
					roomId: before.roomId == null ? null : Number(before.roomId),
					day: String(before.day) as any,
					startTime: String(before.startTime),
					endTime: String(before.endTime),
					cohortCode: before.cohortCode == null ? null : String(before.cohortCode),
					notes: before.notes == null ? null : String(before.notes),
					status: 'DRAFT',
					lockedRunId: null,
					version: { increment: 1 },
				},
			});
		} else if (action.actionType === 'CLEAR_DRAFT') {
			const beforeList = Array.isArray(action.beforePayload) ? action.beforePayload as Array<Record<string, unknown>> : [];
			for (const item of beforeList) {
				await tx.lockedSession.upsert({
					where: { id: Number(item.id) },
					update: {
						status: 'DRAFT',
						lockedRunId: null,
						version: { increment: 1 },
					},
					create: {
						id: Number(item.id),
						schoolId,
						schoolYearId,
						entryKind: item.entryKind as PreGenerationDraftEntryKind,
						sectionId: Number(item.sectionId),
						subjectId: Number(item.subjectId),
						facultyId: item.facultyId == null ? null : Number(item.facultyId),
						roomId: item.roomId == null ? null : Number(item.roomId),
						cohortCode: item.cohortCode == null ? null : String(item.cohortCode),
						status: 'DRAFT',
						lockedRunId: null,
						notes: item.notes == null ? null : String(item.notes),
						version: 1,
						day: String(item.day) as any,
						startTime: String(item.startTime),
						endTime: String(item.endTime),
						createdBy: Number(item.createdBy),
						createdAt: new Date(String(item.createdAt)),
					},
				});
			}
		}
		await tx.lockedSessionAction.create({
			data: {
				schoolId,
				schoolYearId,
				actorId,
				actionType: 'UNDO',
				beforePayload: action as unknown as object,
				afterPayload: { revertedActionId: action.id } as object,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PRE_GENERATION_DRAFT_UNDO',
				actorId,
				targetIds: action.lockId != null ? [action.lockId] : [],
				metadata: { revertedActionId: action.id, revertedActionType: action.actionType } as object,
			},
		});
	});
	return listDraftBoardState(schoolId, schoolYearId);
}

export async function removeSinglePlacement(schoolId: number, schoolYearId: number, actorId: number, placementId: number): Promise<DraftBoardState> {
	const placement = await prisma.lockedSession.findUnique({ where: { id: placementId } });
	if (!placement || placement.schoolId !== schoolId || placement.schoolYearId !== schoolYearId) {
		throw err(404, 'PLACEMENT_NOT_FOUND', 'Draft placement not found.');
	}
	if (placement.status !== 'DRAFT') {
		throw err(409, 'PLACEMENT_NOT_DRAFT', 'Only DRAFT placements can be removed.');
	}
	await prisma.$transaction(async (tx) => {
		await tx.lockedSession.update({
			where: { id: placementId },
			data: { status: 'ARCHIVED', version: { increment: 1 } },
		});
		await tx.lockedSessionAction.create({
			data: {
				schoolId,
				schoolYearId,
				actorId,
				actionType: 'CREATE', // record as inverse of CREATE so undo can restore it
				lockId: placementId,
				beforePayload: { ...placement, createdAt: placement.createdAt.toISOString(), updatedAt: placement.updatedAt.toISOString() } as object,
				afterPayload: { status: 'ARCHIVED' } as object,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'PRE_GENERATION_DRAFT_REMOVE',
				actorId,
				targetIds: [placementId],
				metadata: { placementId } as object,
			},
		});
	});
	return listDraftBoardState(schoolId, schoolYearId);
}

export async function consumeDraftPlacementsForRun(runId: number, schoolId: number, schoolYearId: number): Promise<DraftConsumeResult> {
	const ctx = await loadDraftContext(schoolId, schoolYearId);
	const draftPlacements = ctx.placements.filter((placement) => placement.status === 'DRAFT');
	const accepted: LockedSession[] = [];
	const skippedPrePlacedReasons: string[] = [];
	const acceptedCounts = new Map<string, number>();
	for (const placement of draftPlacements) {
		if (placement.facultyId == null || placement.roomId == null) {
			skippedPrePlacedReasons.push(`Placement ${placement.id} is missing faculty or room assignment.`);
			continue;
		}
		const input: DraftPlacementInput = {
			placementId: placement.id,
			entryKind: placement.entryKind,
			sectionId: placement.sectionId,
			subjectId: placement.subjectId,
			facultyId: placement.facultyId,
			roomId: placement.roomId,
			day: placement.day,
			startTime: placement.startTime,
			endTime: placement.endTime,
			cohortCode: placement.cohortCode,
			notes: placement.notes,
		};
		let demandItem: DemandItem;
		try {
			demandItem = validateInputOrThrow(input, ctx);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			skippedPrePlacedReasons.push(`Placement ${placement.id} skipped: ${message}`);
			continue;
		}
		const assignmentKey = buildAssignmentKey(input);
		if ((acceptedCounts.get(assignmentKey) ?? 0) >= demandItem.sessionsPerWeek) {
			skippedPrePlacedReasons.push(`Placement ${placement.id} skipped: scheduling demand for ${assignmentKey} is already fully pre-placed.`);
			continue;
		}
		const acceptedContextEntries = accepted.map((row) => {
			const item = ctx.demandByKey.get(buildAssignmentKey({ entryKind: row.entryKind, sectionId: row.sectionId, subjectId: row.subjectId, cohortCode: row.cohortCode }));
			return item && row.facultyId != null && row.roomId != null ? placementToScheduledEntry(row, item) : null;
		}).filter((entry): entry is ScheduledEntry => entry != null);
		const candidateEntry = asScheduledEntry(input, `draft-${placement.id}`, demandItem);
		const validation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, [...acceptedContextEntries, candidateEntry], ctx));
		const hardViolations = validation.violations.filter((violation) => violation.severity === 'HARD');
		if (hardViolations.length > 0) {
			skippedPrePlacedReasons.push(`Placement ${placement.id} skipped: ${hardViolations.map((violation) => violation.code).join(', ')}`);
			continue;
		}
		accepted.push(placement);
		acceptedCounts.set(assignmentKey, (acceptedCounts.get(assignmentKey) ?? 0) + 1);
	}
	return {
		lockedEntries: accepted.map((placement) => ({
			sectionId: placement.sectionId,
			subjectId: placement.subjectId,
			facultyId: placement.facultyId,
			roomId: placement.roomId,
			day: placement.day,
			startTime: placement.startTime,
			endTime: placement.endTime,
			entryKind: placement.entryKind,
			cohortCode: placement.cohortCode,
		})),
		prePlacedCount: accepted.length,
		invalidPrePlacedCount: skippedPrePlacedReasons.length,
		skippedPrePlacedReasons,
		acceptedPlacementIds: accepted.map((placement) => placement.id),
	};
}

export async function markPlacementsLockedForRun(schoolId: number, schoolYearId: number, runId: number, placementIds: number[]) {
	if (placementIds.length === 0) return;
	await prisma.lockedSession.updateMany({
		where: { schoolId, schoolYearId, id: { in: placementIds } },
		data: { status: 'LOCKED_FOR_RUN', lockedRunId: runId, version: { increment: 1 } },
	});
}

export async function archivePlacementsForRun(runId: number, schoolId: number, schoolYearId: number) {
	await prisma.lockedSession.updateMany({
		where: { schoolId, schoolYearId, lockedRunId: runId },
		data: { status: 'ARCHIVED', version: { increment: 1 } },
	});
}
