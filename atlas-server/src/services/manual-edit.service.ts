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

	const [faculty, facultySubjects, rooms, subjects, policyRecord, buildings] = await Promise.all([
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
			select: { id: true, type: true, isTeachingSpace: true, buildingId: true },
		}),
		prisma.subject.findMany({
			where: { schoolId, isActive: true },
			select: { id: true, minMinutesPerWeek: true, preferredRoomType: true, gradeLevels: true },
		}),
		getOrCreatePolicy(schoolId, schoolYearId),
		prisma.building.findMany({
			where: { schoolId },
			select: { id: true, x: true, y: true },
		}),
	]);

	return { run, entries, unassignedItems, faculty, facultySubjects, rooms, subjects, policyRecord, buildings };
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
	const { newEntries } = applyProposal(entries, unassignedItems, proposal);
	const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
	const newValidation = validateHardConstraints(newCtx);

	const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
	const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
	const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
	const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;

	const newHardViolations = newValidation.violations.filter((v) => v.severity === 'HARD');
	const newSoftViolations = newValidation.violations.filter((v) => v.severity === 'SOFT');

	return {
		allowed: newHardViolations.length === 0,
		hardViolations: newHardViolations,
		softViolations: newSoftViolations,
		violationDelta: { hardBefore, hardAfter, softBefore, softAfter },
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
