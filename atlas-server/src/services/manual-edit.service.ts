/**
 * Manual schedule edit service — preview, commit, revert, and history
 * for manual drag-and-drop adjustments during the Review phase.
 * Business logic only; no transport concerns.
 */

import { prisma } from '../lib/prisma.js';
import {
	validateHardConstraints,
	type ValidatorContext,
	type ScheduledEntry,
	type ValidationResult,
	type Violation,
} from './constraint-validator.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import type { RunSummary, DraftReport } from './generation.service.js';

// ─── Helpers ───

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const e = new Error(message) as Error & { statusCode: number; code: string };
	e.statusCode = statusCode;
	e.code = code;
	return e;
}

// ─── Types ───

export type ManualEditType =
	| 'PLACE_UNASSIGNED'
	| 'MOVE_ENTRY'
	| 'CHANGE_ROOM'
	| 'CHANGE_FACULTY'
	| 'CHANGE_TIMESLOT'
	| 'REVERT';

export interface ManualEditProposal {
	editType: ManualEditType;
	/** For PLACE_UNASSIGNED: the unassigned item index/identity */
	sectionId?: number;
	subjectId?: number;
	session?: number;
	/** The existing entryId being moved (for MOVE_ENTRY, CHANGE_ROOM, etc.) */
	entryId?: string;
	/** Target values */
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetRoomId?: number;
	targetFacultyId?: number;
}

export interface PreviewResult {
	allowed: boolean;
	hardViolations: Violation[];
	softViolations: Violation[];
	/** Net change in violation counts relative to current draft */
	violationDelta: {
		hardBefore: number;
		hardAfter: number;
		softBefore: number;
		softAfter: number;
	};
	/** Human-readable conflict descriptions built server-side */
	humanConflicts: HumanConflict[];
	/** Entries affected by this edit (before/after pair) */
	affectedEntries: AffectedEntry[];
	/** Policy threshold summaries for delta display */
	policyImpactSummary: PolicyImpact[];
}

/** Machine-readable code + human-readable strings for UI rendering */
export interface HumanConflict {
	code: string;
	severity: 'HARD' | 'SOFT';
	/** Short title for card header, e.g. "Faculty Time Conflict" */
	humanTitle: string;
	/** Full human-readable detail, e.g. "Dela Cruz, Juan is already teaching 7-Einstein in Room 101 on Mon 8:00 AM–9:00 AM" */
	humanDetail: string;
	/** Optional delta string, e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
	delta?: string;
}

export interface AffectedEntry {
	entryId: string;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	/** 'before' = the entry before the edit, 'after' = the entry after the edit */
	phase: 'before' | 'after';
}

export interface PolicyImpact {
	code: string;
	label: string;
	/** e.g. "Limit: 200 min · Observed: 320 min · Δ +120 min" */
	summary: string;
	severity: 'HARD' | 'SOFT';
}

export interface CommitResult {
	editId: number;
	draft: DraftReport;
	violationDelta: PreviewResult['violationDelta'];
	warnings: Violation[];
	newVersion: number;
}

export interface ManualEditRecord {
	id: number;
	runId: number;
	actorId: number;
	editType: string;
	beforePayload: unknown;
	afterPayload: unknown;
	validationSummary: unknown;
	createdAt: string;
}

// ─── Internal: load run + reference data for validation ───

async function loadRunContext(runId: number, schoolId: number, schoolYearId: number) {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	if (run.status !== 'COMPLETED') throw err(400, 'RUN_NOT_COMPLETED', 'Manual edits can only be applied to COMPLETED runs.');

	const entries = (run.draftEntries ?? []) as unknown as ScheduledEntry[];
	const unassignedItems = (run.unassignedItems ?? []) as unknown as Array<{
		sectionId: number;
		subjectId: number;
		gradeLevel: number;
		session: number;
		reason: string;
	}>;

	const [faculty, facultySubjects, rooms, subjects, policyRecord, buildings, facultyNames, roomNames, subjectNames] = await Promise.all([
		prisma.facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true },
			select: { id: true, maxHoursPerWeek: true },
		}),
		prisma.facultySubject.findMany({
			where: { schoolId },
			select: { facultyId: true, subjectId: true, gradeLevels: true },
		}),
		prisma.room.findMany({
			where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
			select: { id: true, type: true, isTeachingSpace: true, capacity: true, buildingId: true },
		}),
		prisma.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, minMinutesPerWeek: true, preferredRoomType: true, sessionPattern: true, gradeLevels: true },
		}),
		getOrCreatePolicy(schoolId, schoolYearId),
		prisma.building.findMany({
			where: { schoolId },
			select: { id: true, x: true, y: true },
		}),
		// Name data for human-readable conflict messages
		prisma.facultyMirror.findMany({
			where: { schoolId },
			select: { id: true, firstName: true, lastName: true, maxHoursPerWeek: true },
		}),
		prisma.room.findMany({
			where: { building: { schoolId } },
			select: { id: true, name: true, buildingId: true, type: true, capacity: true, building: { select: { name: true, shortCode: true } } },
		}),
		prisma.subject.findMany({
			where: { schoolId },
			select: { id: true, code: true, name: true },
		}),
	]);

	// Build name lookup maps
	const facultyNameMap = new Map(facultyNames.map((f) => [f.id, `${f.lastName}, ${f.firstName}`]));
	const roomNameMap = new Map(roomNames.map((r) => [r.id, `${r.name} · ${r.building.shortCode || r.building.name}`]));
	const subjectNameMap = new Map(subjectNames.map((s) => [s.id, s.code]));

	return { run, entries, unassignedItems, faculty, facultySubjects, rooms, subjects, policyRecord, buildings, facultyNameMap, roomNameMap, subjectNameMap };
}

function buildValidatorCtx(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	entries: ScheduledEntry[],
	refData: Awaited<ReturnType<typeof loadRunContext>>,
): ValidatorContext {
	const { faculty, facultySubjects, rooms, subjects, policyRecord, buildings } = refData;
	return {
		schoolId,
		schoolYearId,
		runId,
		entries,
		faculty,
		facultySubjects,
		rooms,
		subjects,
		policy: {
			maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
			minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
			maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
			earliestStartTime: policyRecord.earliestStartTime,
			latestEndTime: policyRecord.latestEndTime,
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
}

/** Apply a proposal to a draft entries array, returning the new entries + the before/after entry payloads */
function applyProposal(
	entries: ScheduledEntry[],
	unassigned: Array<{ sectionId: number; subjectId: number; gradeLevel: number; session: number; reason: string }>,
	proposal: ManualEditProposal,
): {
	newEntries: ScheduledEntry[];
	newUnassigned: typeof unassigned;
	beforeEntry: ScheduledEntry | null;
	afterEntry: ScheduledEntry | null;
} {
	const newEntries = [...entries];
	let newUnassigned = [...unassigned];
	let beforeEntry: ScheduledEntry | null = null;
	let afterEntry: ScheduledEntry | null = null;

	if (proposal.editType === 'PLACE_UNASSIGNED') {
		// Find matching unassigned item
		const uIdx = newUnassigned.findIndex(
			(u) =>
				u.sectionId === proposal.sectionId &&
				u.subjectId === proposal.subjectId &&
				(proposal.session == null || u.session === proposal.session),
		);
		if (uIdx === -1) throw err(400, 'UNASSIGNED_NOT_FOUND', 'Specified unassigned item not found.');

		const uItem = newUnassigned[uIdx];
		if (!proposal.targetDay || !proposal.targetStartTime || !proposal.targetEndTime || !proposal.targetRoomId || !proposal.targetFacultyId) {
			throw err(400, 'MISSING_TARGET', 'PLACE_UNASSIGNED requires targetDay, targetStartTime, targetEndTime, targetRoomId, targetFacultyId.');
		}

		const durationMinutes = timeToMinutes(proposal.targetEndTime) - timeToMinutes(proposal.targetStartTime);
		const newEntry: ScheduledEntry = {
			entryId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			facultyId: proposal.targetFacultyId,
			roomId: proposal.targetRoomId,
			subjectId: uItem.subjectId,
			sectionId: uItem.sectionId,
			day: proposal.targetDay,
			startTime: proposal.targetStartTime,
			endTime: proposal.targetEndTime,
			durationMinutes,
		};

		afterEntry = newEntry;
		newEntries.push(newEntry);
		newUnassigned = newUnassigned.filter((_, i) => i !== uIdx);
	} else if (proposal.editType === 'MOVE_ENTRY' || proposal.editType === 'CHANGE_ROOM' || proposal.editType === 'CHANGE_FACULTY' || proposal.editType === 'CHANGE_TIMESLOT') {
		if (!proposal.entryId) throw err(400, 'MISSING_ENTRY_ID', 'entryId is required for move/change edits.');
		const idx = newEntries.findIndex((e) => e.entryId === proposal.entryId);
		if (idx === -1) throw err(400, 'ENTRY_NOT_FOUND', `Entry ${proposal.entryId} not found in draft.`);

		beforeEntry = { ...newEntries[idx] };
		const updated = { ...newEntries[idx] };

		if (proposal.targetDay != null) updated.day = proposal.targetDay;
		if (proposal.targetStartTime != null) updated.startTime = proposal.targetStartTime;
		if (proposal.targetEndTime != null) {
			updated.endTime = proposal.targetEndTime;
			updated.durationMinutes = timeToMinutes(updated.endTime) - timeToMinutes(updated.startTime);
		}
		if (proposal.targetRoomId != null) updated.roomId = proposal.targetRoomId;
		if (proposal.targetFacultyId != null) updated.facultyId = proposal.targetFacultyId;

		afterEntry = updated;
		newEntries[idx] = updated;
	} else {
		throw err(400, 'INVALID_EDIT_TYPE', `Unsupported edit type: ${proposal.editType}`);
	}

	return { newEntries, newUnassigned, beforeEntry, afterEntry };
}

function timeToMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

function computeSummary(entries: ScheduledEntry[], unassigned: unknown[], validation: ValidationResult): RunSummary {
	const assignedCount = entries.length;
	const unassignedCount = Array.isArray(unassigned) ? unassigned.length : 0;
	const hardViolationCount = validation.violations.filter((v) => v.severity === 'HARD').length;
	return {
		classesProcessed: assignedCount + unassignedCount,
		assignedCount,
		unassignedCount,
		policyBlockedCount: 0,
		hardViolationCount,
		violationCounts: validation.counts.byCode as Record<string, number>,
	};
}

// ─── Human-readable conflict builder ───

const VIOLATION_TITLES: Record<string, string> = {
	FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
	ROOM_TIME_CONFLICT: 'Room Time Conflict',
	FACULTY_OVERLOAD: 'Faculty Overload',
	ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Faculty Not Qualified',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Teaching Limit',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement Violated',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily Max Exceeded',
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Excessive Building Transitions',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient Transition Buffer',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Excessive Idle Gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early Start Preference',
	FACULTY_LATE_END_PREFERENCE: 'Late End Preference',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Insufficient Daily Vacant Time',
	SECTION_OVERCOMPRESSED: 'Section Overcompressed',
};

const DAY_LABELS: Record<string, string> = {
	MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};

function formatTimeAmPm(hhmm: string): string {
	const [h, m] = hhmm.split(':').map(Number);
	const suffix = h >= 12 ? 'PM' : 'AM';
	const hour12 = h % 12 || 12;
	return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function buildHumanConflicts(
	violations: Violation[],
	entries: ScheduledEntry[],
	refData: Awaited<ReturnType<typeof loadRunContext>>,
): HumanConflict[] {
	const { facultyNameMap, roomNameMap, subjectNameMap } = refData;
	const entryMap = new Map(entries.map((e) => [e.entryId, e]));

	return violations.map((v) => {
		const title = VIOLATION_TITLES[v.code] ?? v.code;
		let detail = v.message; // fallback
		let delta: string | undefined;

		const fName = v.entities.facultyId ? facultyNameMap.get(v.entities.facultyId) ?? `Faculty #${v.entities.facultyId}` : undefined;
		const rName = v.entities.roomId ? roomNameMap.get(v.entities.roomId) ?? `Room #${v.entities.roomId}` : undefined;
		const dayLabel = v.entities.day ? (DAY_LABELS[v.entities.day] ?? v.entities.day) : undefined;
		const timeRange = v.entities.startTime && v.entities.endTime
			? `${formatTimeAmPm(v.entities.startTime)}–${formatTimeAmPm(v.entities.endTime)}`
			: undefined;

		// Find conflicting entries for context
		const conflictEntries = (v.entities.entryIds ?? []).map((id) => entryMap.get(id)).filter(Boolean) as ScheduledEntry[];

		switch (v.code) {
			case 'FACULTY_TIME_CONFLICT': {
				const otherEntries = conflictEntries.filter((e) => e.facultyId === v.entities.facultyId);
				const sectionNames = otherEntries.map((e) => subjectNameMap.get(e.subjectId) ?? `Subject #${e.subjectId}`).join(', ');
				detail = `${fName} is already teaching ${sectionNames}${dayLabel && timeRange ? ` on ${dayLabel} ${timeRange}` : ''}`;
				break;
			}
			case 'ROOM_TIME_CONFLICT': {
				const otherEntries = conflictEntries.filter((e) => e.roomId === v.entities.roomId);
				const classes = otherEntries.map((e) => subjectNameMap.get(e.subjectId) ?? `Subject #${e.subjectId}`).join(', ');
				detail = `${rName} is already occupied by ${classes}${dayLabel && timeRange ? ` on ${dayLabel} ${timeRange}` : ''}`;
				break;
			}
			case 'FACULTY_OVERLOAD': {
				const m = v.meta;
				if (m?.totalMinutes != null && m?.maxMinutes != null) {
					detail = `${fName} total teaching: ${m.totalMinutes} min/week exceeds max ${m.maxMinutes} min/week`;
					delta = `Limit: ${m.maxMinutes} min · Observed: ${m.totalMinutes} min · Δ +${Number(m.totalMinutes) - Number(m.maxMinutes)} min`;
				} else {
					detail = `${fName} exceeds weekly teaching hour limit`;
				}
				break;
			}
			case 'ROOM_TYPE_MISMATCH': {
				detail = `${rName} type does not match preferred room type for subject`;
				break;
			}
			case 'FACULTY_SUBJECT_NOT_QUALIFIED': {
				const sName = v.entities.subjectId ? subjectNameMap.get(v.entities.subjectId) ?? `Subject #${v.entities.subjectId}` : 'unknown subject';
				detail = `${fName} is not qualified to teach ${sName}`;
				break;
			}
			case 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED': {
				const m = v.meta;
				if (m?.consecutiveMinutes != null && m?.maxConsecutive != null) {
					detail = `${fName} teaches ${m.consecutiveMinutes} consecutive minutes${dayLabel ? ` on ${dayLabel}` : ''}`;
					delta = `Limit: ${m.maxConsecutive} min · Observed: ${m.consecutiveMinutes} min · Δ +${Number(m.consecutiveMinutes) - Number(m.maxConsecutive)} min`;
				} else {
					detail = `${fName} exceeds consecutive teaching limit${dayLabel ? ` on ${dayLabel}` : ''}`;
				}
				break;
			}
			case 'FACULTY_BREAK_REQUIREMENT_VIOLATED': {
				const m = v.meta;
				if (m?.actualGapMinutes != null && m?.requiredBreakMinutes != null) {
					detail = `${fName} has only ${m.actualGapMinutes} min break${dayLabel ? ` on ${dayLabel}` : ''}, needs ${m.requiredBreakMinutes} min`;
					delta = `Required: ${m.requiredBreakMinutes} min · Actual: ${m.actualGapMinutes} min · Short by ${Number(m.requiredBreakMinutes) - Number(m.actualGapMinutes)} min`;
				} else {
					detail = `${fName} does not have required break${dayLabel ? ` on ${dayLabel}` : ''}`;
				}
				break;
			}
			case 'FACULTY_DAILY_MAX_EXCEEDED': {
				const m = v.meta;
				if (m?.dailyMinutes != null && m?.maxTeachingMinutesPerDay != null) {
					detail = `${fName} teaches ${m.dailyMinutes} min${dayLabel ? ` on ${dayLabel}` : ''}, exceeds daily max`;
					delta = `Limit: ${m.maxTeachingMinutesPerDay} min · Observed: ${m.dailyMinutes} min · Δ +${Number(m.dailyMinutes) - Number(m.maxTeachingMinutesPerDay)} min`;
				} else {
					detail = `${fName} exceeds daily max teaching minutes`;
				}
				break;
			}
			case 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE': {
				const m = v.meta;
				if (m?.estimatedDistanceMeters != null) {
					const limit = m?.configuredThresholds ? (m.configuredThresholds as Record<string, unknown>).maxWalkingDistanceMetersPerTransition : undefined;
					detail = `${fName} travels ~${m.estimatedDistanceMeters}m between classes${dayLabel ? ` on ${dayLabel}` : ''}`;
					if (limit != null) delta = `Limit: ${limit}m · Observed: ~${m.estimatedDistanceMeters}m · Δ +${Number(m.estimatedDistanceMeters) - Number(limit)}m`;
				}
				break;
			}
			case 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS': {
				const m = v.meta;
				if (m?.buildingTransitions != null) {
					const limit = m?.configuredThresholds ? (m.configuredThresholds as Record<string, unknown>).maxBuildingTransitionsPerDay : undefined;
					detail = `${fName} has ${m.buildingTransitions} building transitions${dayLabel ? ` on ${dayLabel}` : ''}`;
					if (limit != null) delta = `Limit: ${limit} · Observed: ${m.buildingTransitions} · Δ +${Number(m.buildingTransitions) - Number(limit)}`;
				}
				break;
			}
			case 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER': {
				const m = v.meta;
				if (m?.backToBackTransitions != null) {
					detail = `${fName} has ${m.backToBackTransitions} back-to-back cross-building transitions${dayLabel ? ` on ${dayLabel}` : ''}`;
				}
				break;
			}
			case 'FACULTY_EXCESSIVE_IDLE_GAP': {
				const m = v.meta;
				if (m?.totalIdleMinutes != null) {
					const limit = m?.configuredThresholds ? (m.configuredThresholds as Record<string, unknown>).maxIdleGapMinutesPerDay : undefined;
					detail = `${fName} has ${m.totalIdleMinutes} min idle gap${dayLabel ? ` on ${dayLabel}` : ''}`;
					if (limit != null) delta = `Limit: ${limit} min · Observed: ${m.totalIdleMinutes} min · Δ +${Number(m.totalIdleMinutes) - Number(limit)} min`;
				}
				break;
			}
			case 'FACULTY_INSUFFICIENT_DAILY_VACANT': {
				const m = v.meta;
				if (m?.vacantMinutes != null && m?.targetVacantMinutes != null) {
					detail = `${fName} has ${m.vacantMinutes} min vacant time${dayLabel ? ` on ${dayLabel}` : ''}, target is ${m.targetVacantMinutes} min`;
					delta = `Target: ${m.targetVacantMinutes} min · Observed: ${m.vacantMinutes} min · Short by ${Number(m.targetVacantMinutes) - Number(m.vacantMinutes)} min`;
				} else {
					detail = `${fName} has insufficient vacant time${dayLabel ? ` on ${dayLabel}` : ''}`;
				}
				break;
			}
			case 'SECTION_OVERCOMPRESSED': {
				const m = v.meta;
				const sectionId = v.entities.sectionId;
				if (m?.vacantPeriods != null && m?.targetVacantPeriods != null) {
					detail = `Section ${sectionId} has ${m.vacantPeriods} vacant period(s)${dayLabel ? ` on ${dayLabel}` : ''}, target is ${m.targetVacantPeriods}`;
					delta = `Target: ${m.targetVacantPeriods} period(s) · Observed: ${m.vacantPeriods} period(s)`;
				} else if (m?.sectionDailyMinutes != null && m?.maxCompressedMinutes != null) {
					detail = `Section ${sectionId} has ${m.sectionDailyMinutes} teaching min${dayLabel ? ` on ${dayLabel}` : ''}, exceeds ${m.maxCompressedMinutes} min limit`;
					delta = `Limit: ${m.maxCompressedMinutes} min · Observed: ${m.sectionDailyMinutes} min · Δ +${Number(m.sectionDailyMinutes) - Number(m.maxCompressedMinutes)} min`;
				} else {
					detail = `Section ${sectionId} schedule is overcompressed${dayLabel ? ` on ${dayLabel}` : ''}`;
				}
				break;
			}
			default:
				break;
		}

		return { code: v.code, severity: v.severity, humanTitle: title, humanDetail: detail, delta };
	});
}

function buildPolicyImpacts(violations: Violation[], refData: Awaited<ReturnType<typeof loadRunContext>>): PolicyImpact[] {
	const { facultyNameMap } = refData;
	const impacts: PolicyImpact[] = [];
	const seen = new Set<string>();

	for (const v of violations) {
		const m = v.meta;
		if (!m) continue;

		const fName = v.entities.facultyId ? facultyNameMap.get(v.entities.facultyId) ?? `Faculty #${v.entities.facultyId}` : 'Unknown';
		const key = `${v.code}-${v.entities.facultyId ?? ''}-${v.entities.day ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);

		let summary = '';
		if (v.code === 'FACULTY_OVERLOAD' && m.totalMinutes != null && m.maxMinutes != null) {
			summary = `${fName}: ${m.totalMinutes} min/wk (max ${m.maxMinutes})`;
		} else if (v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED' && m.consecutiveMinutes != null && m.maxConsecutive != null) {
			summary = `${fName}: ${m.consecutiveMinutes} min consecutive (max ${m.maxConsecutive})`;
		} else if (v.code === 'FACULTY_DAILY_MAX_EXCEEDED' && m.dailyMinutes != null && m.maxTeachingMinutesPerDay != null) {
			summary = `${fName}: ${m.dailyMinutes} min/day (max ${m.maxTeachingMinutesPerDay})`;
		} else if (v.code === 'FACULTY_BREAK_REQUIREMENT_VIOLATED' && m.actualGapMinutes != null && m.requiredBreakMinutes != null) {
			summary = `${fName}: ${m.actualGapMinutes} min break (needs ${m.requiredBreakMinutes})`;
		} else if (v.code === 'FACULTY_INSUFFICIENT_DAILY_VACANT' && m.vacantMinutes != null && m.targetVacantMinutes != null) {
			summary = `${fName}: ${m.vacantMinutes} min vacant (target ${m.targetVacantMinutes})`;
		} else if (v.code === 'SECTION_OVERCOMPRESSED') {
			if (m.sectionDailyMinutes != null && m.maxCompressedMinutes != null) {
				summary = `Section ${v.entities.sectionId}: ${m.sectionDailyMinutes} min/day (max ${m.maxCompressedMinutes})`;
			} else if (m.vacantPeriods != null && m.targetVacantPeriods != null) {
				summary = `Section ${v.entities.sectionId}: ${m.vacantPeriods} vacant period(s) (target ${m.targetVacantPeriods})`;
			} else {
				continue;
			}
		} else {
			continue; // Only include policy threshold violations
		}

		impacts.push({ code: v.code, label: VIOLATION_TITLES[v.code] ?? v.code, summary, severity: v.severity });
	}

	return impacts;
}

// ─── Preview (no persistence) ───

export async function previewManualEdit(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	proposal: ManualEditProposal,
): Promise<PreviewResult> {
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const { entries, unassignedItems } = refData;

	// Validate current state
	const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
	const currentValidation = validateHardConstraints(currentCtx);

	// Apply proposal and validate new state
	const { newEntries, beforeEntry, afterEntry } = applyProposal(entries, unassignedItems, proposal);
	const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
	const newValidation = validateHardConstraints(newCtx);

	const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
	const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
	const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
	const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;

	const newHardViolations = newValidation.violations.filter((v) => v.severity === 'HARD');
	const newSoftViolations = newValidation.violations.filter((v) => v.severity === 'SOFT');

	const allNewViolations = [...newHardViolations, ...newSoftViolations];
	const humanConflicts = buildHumanConflicts(allNewViolations, newEntries, refData);
	const policyImpactSummary = buildPolicyImpacts(allNewViolations, refData);

	const affectedEntries: AffectedEntry[] = [];
	if (beforeEntry) {
		affectedEntries.push({
			entryId: beforeEntry.entryId, subjectId: beforeEntry.subjectId, sectionId: beforeEntry.sectionId,
			facultyId: beforeEntry.facultyId, roomId: beforeEntry.roomId,
			day: beforeEntry.day, startTime: beforeEntry.startTime, endTime: beforeEntry.endTime, phase: 'before',
		});
	}
	if (afterEntry) {
		affectedEntries.push({
			entryId: afterEntry.entryId, subjectId: afterEntry.subjectId, sectionId: afterEntry.sectionId,
			facultyId: afterEntry.facultyId, roomId: afterEntry.roomId,
			day: afterEntry.day, startTime: afterEntry.startTime, endTime: afterEntry.endTime, phase: 'after',
		});
	}

	return {
		allowed: newHardViolations.length === 0,
		hardViolations: newHardViolations,
		softViolations: newSoftViolations,
		violationDelta: { hardBefore, hardAfter, softBefore, softAfter },
		humanConflicts,
		affectedEntries,
		policyImpactSummary,
	};
}

// ─── Commit (persist) ───

export async function commitManualEdit(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
	proposal: ManualEditProposal,
	expectedVersion: number,
	allowSoftOverride = false,
): Promise<CommitResult> {
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const { run, entries, unassignedItems } = refData;

	// Optimistic concurrency check
	if (run.version !== expectedVersion) {
		throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${run.version}. Please reload and retry.`);
	}

	// Validate current state for delta
	const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
	const currentValidation = validateHardConstraints(currentCtx);

	// Apply proposal
	const { newEntries, newUnassigned, beforeEntry, afterEntry } = applyProposal(entries, unassignedItems, proposal);

	// Validate new state
	const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
	const newValidation = validateHardConstraints(newCtx);

	const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD');
	const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT');
	const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
	const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;

	// Block commit if hard violations exist
	if (hardAfter.length > 0) {
		throw err(422, 'HARD_VIOLATION_BLOCK', `Cannot commit: ${hardAfter.length} hard violation(s). ${hardAfter.map((v) => v.message).join('; ')}`);
	}

	// Block soft-only commit unless client explicitly acknowledges
	if (softAfter.length > 0 && !allowSoftOverride) {
		throw err(422, 'SOFT_OVERRIDE_REQUIRED', `Edit produces ${softAfter.length} soft warning(s). Client must set allowSoftOverride=true to proceed.`);
	}

	const newSummary = computeSummary(newEntries, newUnassigned, newValidation);
	const newVersion = run.version + 1;

	// Persist atomically: update run + create edit record
	const [updatedRun, editRecord] = await prisma.$transaction([
		prisma.generationRun.update({
			where: { id: runId, version: expectedVersion },
			data: {
				draftEntries: newEntries as unknown as object[],
				unassignedItems: newUnassigned as unknown as object[],
				violations: newValidation.violations as unknown as object[],
				summary: newSummary as object,
				version: newVersion,
			},
		}),
		prisma.manualScheduleEdit.create({
			data: {
				runId,
				schoolId,
				schoolYearId,
				actorId,
				editType: proposal.editType,
				beforePayload: (beforeEntry ?? {}) as object,
				afterPayload: (afterEntry ?? {}) as object,
				validationSummary: {
					hardCount: hardAfter.length,
					softCount: softAfter.length,
					delta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
				},
			},
		}),
	]);

	// Audit log
	await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'MANUAL_SCHEDULE_EDIT',
			actorId,
			targetIds: [runId],
			metadata: {
				editId: editRecord.id,
				editType: proposal.editType,
				entryId: proposal.entryId ?? afterEntry?.entryId,
			} as object,
		},
	});

	const draftReport: DraftReport = {
		runId: updatedRun.id,
		status: updatedRun.status,
		entries: newEntries,
		unassignedItems: newUnassigned as unknown as DraftReport['unassignedItems'],
		summary: newSummary,
		finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
		createdAt: updatedRun.createdAt.toISOString(),
		version: updatedRun.version,
	};

	return {
		editId: editRecord.id,
		draft: draftReport,
		violationDelta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
		warnings: softAfter,
		newVersion,
	};
}

// ─── Revert ───

export async function revertLastEdit(
	runId: number,
	schoolId: number,
	schoolYearId: number,
	actorId: number,
): Promise<CommitResult> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	// Find the last non-REVERT edit for this run
	const lastEdit = await prisma.manualScheduleEdit.findFirst({
		where: { runId, schoolId, schoolYearId, editType: { not: 'REVERT' } },
		orderBy: { createdAt: 'desc' },
	});
	if (!lastEdit) throw err(400, 'NOTHING_TO_REVERT', 'No manual edits to revert.');

	const entries = (run.draftEntries ?? []) as unknown as ScheduledEntry[];
	const unassigned = (run.unassignedItems ?? []) as unknown as Array<{
		sectionId: number;
		subjectId: number;
		gradeLevel: number;
		session: number;
		reason: string;
	}>;

	const beforePayload = lastEdit.beforePayload as ScheduledEntry | null;
	const afterPayload = lastEdit.afterPayload as ScheduledEntry | null;

	let newEntries = [...entries];
	let newUnassigned = [...unassigned];

	if (lastEdit.editType === 'PLACE_UNASSIGNED') {
		// Remove the placed entry, put item back into unassigned
		if (afterPayload) {
			newEntries = newEntries.filter((e) => e.entryId !== afterPayload.entryId);
			// Re-add to unassigned
			newUnassigned.push({
				sectionId: afterPayload.sectionId,
				subjectId: afterPayload.subjectId,
				gradeLevel: 0, // approximate
				session: 1,
				reason: 'NO_AVAILABLE_SLOT',
			});
		}
	} else {
		// Restore before state
		if (beforePayload && afterPayload) {
			const idx = newEntries.findIndex((e) => e.entryId === afterPayload.entryId);
			if (idx !== -1) {
				newEntries[idx] = beforePayload;
			}
		}
	}

	// Re-validate
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
	const newValidation = validateHardConstraints(newCtx);
	const newSummary = computeSummary(newEntries, newUnassigned, newValidation);
	const newVersion = run.version + 1;

	const [updatedRun, editRecord] = await prisma.$transaction([
		prisma.generationRun.update({
			where: { id: runId },
			data: {
				draftEntries: newEntries as unknown as object[],
				unassignedItems: newUnassigned as unknown as object[],
				violations: newValidation.violations as unknown as object[],
				summary: newSummary as object,
				version: newVersion,
			},
		}),
		prisma.manualScheduleEdit.create({
			data: {
				runId,
				schoolId,
				schoolYearId,
				actorId,
				editType: 'REVERT',
				beforePayload: (afterPayload ?? {}) as object,
				afterPayload: (beforePayload ?? {}) as object,
				validationSummary: {
					revertedEditId: lastEdit.id,
					revertedEditType: lastEdit.editType,
				},
			},
		}),
	]);

	await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'MANUAL_SCHEDULE_EDIT_REVERT',
			actorId,
			targetIds: [runId],
			metadata: { revertedEditId: lastEdit.id, newEditId: editRecord.id } as object,
		},
	});

	const draftReport: DraftReport = {
		runId: updatedRun.id,
		status: updatedRun.status,
		entries: newEntries,
		unassignedItems: newUnassigned as unknown as DraftReport['unassignedItems'],
		summary: newSummary,
		finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
		createdAt: updatedRun.createdAt.toISOString(),
		version: updatedRun.version,
	};

	const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
	const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;

	return {
		editId: editRecord.id,
		draft: draftReport,
		violationDelta: { hardBefore: 0, hardAfter, softBefore: 0, softAfter },
		warnings: newValidation.violations.filter((v) => v.severity === 'SOFT'),
		newVersion,
	};
}

// ─── Edit History ───

export async function listManualEdits(
	runId: number,
	schoolId: number,
	schoolYearId: number,
): Promise<ManualEditRecord[]> {
	// Verify run exists in scope
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { id: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');

	const edits = await prisma.manualScheduleEdit.findMany({
		where: { runId, schoolId, schoolYearId },
		orderBy: { createdAt: 'desc' },
	});

	return edits.map((e) => ({
		id: e.id,
		runId: e.runId,
		actorId: e.actorId,
		editType: e.editType,
		beforePayload: e.beforePayload,
		afterPayload: e.afterPayload,
		validationSummary: e.validationSummary,
		createdAt: e.createdAt.toISOString(),
	}));
}

// ─── Get run version (for frontend optimistic locking) ───

export async function getRunVersion(
	runId: number,
	schoolId: number,
	schoolYearId: number,
): Promise<number> {
	const run = await prisma.generationRun.findFirst({
		where: { id: runId, schoolId, schoolYearId },
		select: { version: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	return run.version;
}
