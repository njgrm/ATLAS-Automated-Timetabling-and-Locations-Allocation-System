import { prisma } from '../lib/prisma.js';
import type {
	DayOfWeek,
	RoomRequestAppealHistoryAction,
	RoomRequestAppealStatus,
	RoomPreferenceDecisionStatus,
	RoomPreferenceStatus,
} from '@prisma/client';
import * as generationService from './generation.service.js';
import * as manualEditService from './manual-edit.service.js';
import { publishRoomPreferenceEvent } from './room-preference-events.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { normalizeSubjectDisplayLabel } from './schedule-output-normalization.service.js';

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

type DraftEntry = generationService.DraftReport['entries'][number];

export interface SaveRoomPreferenceDraftInput {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	facultyId: number;
	entryId: string;
	requestedRoomId?: number;
	actionType?: RoomPreferenceActionType;
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetEntryId?: string;
	rationale?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number;
}

export interface SubmitRoomPreferenceInput extends SaveRoomPreferenceDraftInput {
	requestVersion?: number;
}

export type RoomPreferenceSyncActionType = 'SAVE_DRAFT' | 'SUBMIT' | 'DELETE';

export type RoomPreferenceActionType = 'ROOM_CHANGE' | 'MOVE_TO_EMPTY_SLOT' | 'SWAP_WITH_OCCUPIED' | 'TIME_AND_ROOM_CHANGE';

export interface RoomPreferenceRequestMeta {
	actionType: RoomPreferenceActionType;
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetEntryId?: string;
}

const REQUEST_META_PREFIX = '[ATLAS_REQ_META]';

function encodeRationaleWithMeta(meta: RoomPreferenceRequestMeta, rationale?: string | null): string | null {
	const plainRationale = (rationale ?? '').trim();
	const encodedMeta = Buffer.from(JSON.stringify(meta), 'utf8').toString('base64url');
	return `${REQUEST_META_PREFIX}${encodedMeta}\n${plainRationale}`;
}

function decodeRationaleAndMeta(rawRationale: string | null | undefined): {
	rationale: string | null;
	meta: RoomPreferenceRequestMeta | null;
} {
	if (!rawRationale) return { rationale: null, meta: null };
	if (!rawRationale.startsWith(REQUEST_META_PREFIX)) {
		return { rationale: rawRationale, meta: null };
	}
	const newlineIdx = rawRationale.indexOf('\n');
	const encodedMeta = newlineIdx >= 0
		? rawRationale.slice(REQUEST_META_PREFIX.length, newlineIdx)
		: rawRationale.slice(REQUEST_META_PREFIX.length);
	const plainRationale = newlineIdx >= 0 ? rawRationale.slice(newlineIdx + 1).trim() : '';
	try {
		const parsed = JSON.parse(Buffer.from(encodedMeta, 'base64url').toString('utf8')) as RoomPreferenceRequestMeta;
		return { rationale: plainRationale || null, meta: parsed };
	} catch {
		return { rationale: plainRationale || null, meta: null };
	}
}

export interface RoomPreferenceSyncAction {
	actionId: string;
	type: RoomPreferenceSyncActionType;
	entryId: string;
	requestedRoomId?: number;
	actionType?: RoomPreferenceActionType;
	targetDay?: string;
	targetStartTime?: string;
	targetEndTime?: string;
	targetEntryId?: string;
	rationale?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number;
}

export interface ReviewRoomPreferenceInput {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	requestId: number;
	reviewerId: number;
	decisionStatus: 'APPROVED' | 'REJECTED';
	reviewerNotes?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number;
	allowSoftOverride?: boolean;
}

export interface FacultyRoomPreferenceEntry {
	entryId: string;
	subjectId: number;
	sectionId: number;
	facultyId: number;
	currentRoomId: number;
	currentRoomName: string;
	requestedRoomId: number | null;
	requestedRoomName: string | null;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	status: RoomPreferenceStatus | null;
	decisionStatus: RoomPreferenceDecisionStatus | null;
	rationale: string | null;
	submittedAt: string | null;
	version: number | null;
	subjectCode: string;
	subjectDisplayLabel: string;
	subjectName: string;
	sectionName: string;
	requestId: number | null;
	reviewerNotes: string | null;
	reviewedAt: string | null;
	entryKind?: DraftEntry['entryKind'];
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
	actionType?: RoomPreferenceActionType | null;
	targetDay?: string | null;
	targetStartTime?: string | null;
	targetEndTime?: string | null;
	targetEntryId?: string | null;
	/** True when the requested room type differs from the subject's preferred room type. Warning-only. */
	roomTypeOverride?: boolean;
}

export interface FacultyGlobalDraftEntry {
	entryId: string;
	facultyId: number | null;
	facultyName: string;
	sectionId: number;
	sectionName: string;
	subjectId: number;
	subjectCode: string;
	subjectDisplayLabel: string;
	subjectName: string;
	roomId: number;
	roomName: string;
	day: string;
	startTime: string;
	endTime: string;
	durationMinutes: number;
	owned: boolean;
	entryKind?: DraftEntry['entryKind'];
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
}

export interface FacultyRoomPreferenceState {
	runId: number;
	runVersion: number;
	runGeneratedAt: string | null;
	entries: FacultyRoomPreferenceEntry[];
	globalEntries: FacultyGlobalDraftEntry[];
}

export interface RoomPreferenceSummaryItem {
	id: number;
	runId: number;
	entryId: string;
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
	subjectDisplayLabel: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	currentRoomId: number;
	currentRoomName: string;
	requestedRoomId: number;
	requestedRoomName: string;
	day: DayOfWeek;
	startTime: string;
	endTime: string;
	status: RoomPreferenceStatus;
	decisionStatus: RoomPreferenceDecisionStatus;
	rationale: string | null;
	submittedAt: string | null;
	version: number;
	reviewerId: number | null;
	reviewerNotes: string | null;
	reviewedAt: string | null;
	entryKind?: DraftEntry['entryKind'];
	cohortCode?: string | null;
	cohortName?: string | null;
	programCode?: string | null;
	programName?: string | null;
	appealCount: number;
	openAppealCount: number;
	latestAppealStatus: RoomRequestAppealStatus | null;
	latestAppealUpdatedAt: string | null;
}

export interface RoomPreferenceSummaryResponse {
	runId: number;
	counts: {
		total: number;
		draft: number;
		submitted: number;
		pending: number;
		approved: number;
		rejected: number;
	};
	requests: RoomPreferenceSummaryItem[];
	runVersion: number;
}

export interface RoomRequestAppealHistoryItem {
	id: number;
	actorId: number;
	actorName: string;
	action: RoomRequestAppealHistoryAction;
	fromStatus: RoomRequestAppealStatus | null;
	toStatus: RoomRequestAppealStatus | null;
	note: string | null;
	createdAt: string;
}

export interface RoomRequestAppealItem {
	id: number;
	requestId: number;
	requesterId: number;
	requesterName: string;
	reason: string;
	status: RoomRequestAppealStatus;
	createdAt: string;
	updatedAt: string;
	history: RoomRequestAppealHistoryItem[];
}

export interface RoomPreferenceDetailResponse {
	request: RoomPreferenceSummaryItem;
	runVersion: number;
	appeals: RoomRequestAppealItem[];
}

function buildEntryMap(entries: DraftEntry[]) {
	return new Map(entries.map((entry) => [entry.entryId, entry]));
}

async function getRunDraftWithVersion(runId: number, schoolId: number, schoolYearId: number) {
	const draft = await generationService.getRunDraft(runId, schoolId, schoolYearId);
	return draft;
}

function assertRunVersion(actualVersion: number, expectedVersion?: number) {
	if (expectedVersion != null && actualVersion !== expectedVersion) {
		throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${actualVersion}. Please reload and retry.`);
	}
}

function assertRequestVersion(actualVersion: number, expectedVersion?: number) {
	if (expectedVersion != null && actualVersion !== expectedVersion) {
		throw err(409, 'VERSION_CONFLICT', `Request version conflict: expected ${expectedVersion}, actual ${actualVersion}. Please reload and retry.`);
	}
}

async function getTeachingRoom(schoolId: number, roomId: number) {
	const room = await prisma.room.findFirst({
		where: {
			id: roomId,
			isTeachingSpace: true,
			building: {
				schoolId,
				isTeachingBuilding: true,
			},
		},
		include: {
			building: {
				select: { name: true, shortCode: true },
			},
		},
	});
	if (!room) {
		throw err(404, 'ROOM_NOT_FOUND', 'Requested room was not found in this school or is not a teaching space.');
	}
	return room;
}

function ensureFacultyOwnsEntry(entry: DraftEntry | undefined, facultyId: number) {
	if (!entry) {
		throw err(404, 'ENTRY_NOT_FOUND', 'Draft entry was not found in this generation run.');
	}
	if (entry.facultyId !== facultyId) {
		throw err(403, 'FORBIDDEN', 'This draft entry is not assigned to the requested faculty member.');
	}
	return entry;
}

async function buildLookupMaps(schoolId: number, entryIds: string[], entries: DraftEntry[]) {
	const subjectIds = [...new Set(entries.map((entry) => entry.subjectId))];
	const sectionIds = [...new Set(entries.map((entry) => entry.sectionId))];
	const roomIds = [...new Set(entries.map((entry) => entry.roomId))];
	const facultyIds = [...new Set(entries.map((entry) => entry.facultyId).filter((id): id is number => id != null))];

	const [subjects, snapshot, rooms, faculty] = await Promise.all([
		prisma.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, name: true, preferredRoomType: true, modularGroupId: true },
		}),
		prisma.sectionSnapshot.findFirst({
			where: { schoolId },
			orderBy: { fetchedAt: 'desc' },
			select: { payload: true },
		}),
		prisma.room.findMany({
			where: { id: { in: roomIds } },
			select: {
				id: true,
				name: true,
				type: true,
				building: { select: { name: true, shortCode: true } },
			},
		}),
		prisma.facultyMirror.findMany({
			where: { schoolId, id: { in: facultyIds } },
			select: { id: true, firstName: true, lastName: true },
		}),
	]);

	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	const sectionMap = new Map<number, string>();
	if (Array.isArray(snapshot?.payload)) {
		for (const grade of snapshot.payload as Array<{ sections?: Array<{ id: number; name: string }> }>) {
			for (const section of grade.sections ?? []) {
				if (sectionIds.includes(section.id)) {
					sectionMap.set(section.id, section.name);
				}
			}
		}
	}
	const roomMap = new Map(
		rooms.map((room) => [
			room.id,
			`${room.name} · ${room.building.shortCode || room.building.name}`,
		]),
	);
	const roomTypeMap = new Map(rooms.map((room) => [room.id, room.type]));
	const facultyMap = new Map(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`]));

	return { subjectMap, sectionMap, roomMap, roomTypeMap, facultyMap };
}

function resolveRequestTargets(input: SaveRoomPreferenceDraftInput, entry: DraftEntry, draftEntries: DraftEntry[]) {
	const actionType: RoomPreferenceActionType = input.actionType ?? 'ROOM_CHANGE';
	const targetDay = input.targetDay ?? entry.day;
	const targetStartTime = input.targetStartTime ?? entry.startTime;
	const targetEndTime = input.targetEndTime ?? entry.endTime;

	let resolvedTargetEntryId = input.targetEntryId ?? null;
	if (actionType === 'SWAP_WITH_OCCUPIED' && !resolvedTargetEntryId) {
		const occupied = draftEntries.find((candidate) =>
			candidate.entryId !== entry.entryId
			&& candidate.day === targetDay
			&& candidate.startTime === targetStartTime
			&& candidate.endTime === targetEndTime,
		);
		resolvedTargetEntryId = occupied?.entryId ?? null;
	}

	const requestedRoomId = input.requestedRoomId
		?? (actionType === 'SWAP_WITH_OCCUPIED' && resolvedTargetEntryId
			? draftEntries.find((candidate) => candidate.entryId === resolvedTargetEntryId)?.roomId
			: undefined)
		?? entry.roomId;

	return {
		actionType,
		targetDay,
		targetStartTime,
		targetEndTime,
		targetEntryId: resolvedTargetEntryId,
		requestedRoomId,
	};
}

export async function getFacultyRoomPreferenceState(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	facultyId: number,
): Promise<FacultyRoomPreferenceState> {
	const draft = await getRunDraftWithVersion(runId, schoolId, schoolYearId);
	const assignedEntries = draft.entries
		.filter((entry) => entry.facultyId === facultyId)
		.sort((left, right) =>
			left.day.localeCompare(right.day)
			|| left.startTime.localeCompare(right.startTime)
			|| left.subjectId - right.subjectId,
		);

	const requests = await prisma.facultyRoomPreference.findMany({
		where: { schoolId, schoolYearId, runId, facultyId },
		include: {
			requestedRoom: {
				select: {
					id: true,
					name: true,
					building: { select: { name: true, shortCode: true } },
				},
			},
		},
	});

	const requestMap = new Map(requests.map((request) => [request.entryId, request]));
	const { subjectMap, sectionMap, roomMap, roomTypeMap } = await buildLookupMaps(
		schoolId,
		assignedEntries.map((entry) => entry.entryId),
		assignedEntries,
	);

	const { subjectMap: allSubjectMap, sectionMap: allSectionMap, roomMap: allRoomMap, facultyMap } = await buildLookupMaps(
		schoolId,
		draft.entries.map((entry) => entry.entryId),
		draft.entries,
	);

	return {
		runId: draft.runId,
		runVersion: draft.version,
		runGeneratedAt: draft.finishedAt ?? draft.createdAt,
		entries: assignedEntries.map((entry) => {
			const request = requestMap.get(entry.entryId);
			const decoded = decodeRationaleAndMeta(request?.rationale ?? null);
			const subject = subjectMap.get(entry.subjectId);
			const subjectDisplayLabel = normalizeSubjectDisplayLabel({
				code: subject?.code,
				name: subject?.name,
				modularGroupId: subject?.modularGroupId,
			});
			const requestedRoomType = request ? roomTypeMap.get(request.requestedRoomId) : undefined;
			const roomTypeOverride =
				request != null &&
				subject?.preferredRoomType != null &&
				requestedRoomType != null &&
				requestedRoomType !== subject.preferredRoomType;
			return {
				entryId: entry.entryId,
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				facultyId,
				currentRoomId: entry.roomId,
				currentRoomName: roomMap.get(entry.roomId) ?? `Room #${entry.roomId}`,
				requestedRoomId: request?.requestedRoomId ?? null,
				requestedRoomName: request
					? `${request.requestedRoom.name} · ${request.requestedRoom.building.shortCode || request.requestedRoom.building.name}`
					: null,
				day: entry.day,
				startTime: entry.startTime,
				endTime: entry.endTime,
				durationMinutes: entry.durationMinutes,
				status: request?.status ?? null,
				decisionStatus: request?.decisionStatus ?? null,
				rationale: decoded.rationale,
				submittedAt: request?.submittedAt?.toISOString() ?? null,
				version: request?.version ?? null,
				subjectCode: subject?.code ?? `Subject #${entry.subjectId}`,
				subjectDisplayLabel,
				subjectName: subject?.name ?? `Subject #${entry.subjectId}`,
				sectionName: sectionMap.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
				requestId: request?.id ?? null,
				reviewerNotes: request?.reviewerNotes ?? null,
				reviewedAt: request?.reviewedAt?.toISOString() ?? null,
				entryKind: entry.entryKind,
				cohortCode: entry.cohortCode ?? null,
				cohortName: entry.cohortName ?? null,
				programCode: entry.programCode ?? null,
				programName: entry.programName ?? null,
				actionType: decoded.meta?.actionType ?? null,
				targetDay: decoded.meta?.targetDay ?? null,
				targetStartTime: decoded.meta?.targetStartTime ?? null,
				targetEndTime: decoded.meta?.targetEndTime ?? null,
				targetEntryId: decoded.meta?.targetEntryId ?? null,
				roomTypeOverride,
			};
		}),
		globalEntries: draft.entries
			.map((entry) => ({
				subjectDisplayLabel: normalizeSubjectDisplayLabel({
					code: allSubjectMap.get(entry.subjectId)?.code,
					name: allSubjectMap.get(entry.subjectId)?.name,
					modularGroupId: allSubjectMap.get(entry.subjectId)?.modularGroupId,
				}),
				entryId: entry.entryId,
				facultyId: entry.facultyId,
				facultyName: entry.facultyId != null
					? (facultyMap.get(entry.facultyId) ?? `Faculty #${entry.facultyId}`)
					: 'Unassigned Faculty',
				sectionId: entry.sectionId,
				sectionName: allSectionMap.get(entry.sectionId) ?? `Section #${entry.sectionId}`,
				subjectId: entry.subjectId,
				subjectCode: allSubjectMap.get(entry.subjectId)?.code ?? `Subject #${entry.subjectId}`,
				subjectName: allSubjectMap.get(entry.subjectId)?.name ?? `Subject #${entry.subjectId}`,
				roomId: entry.roomId,
				roomName: allRoomMap.get(entry.roomId) ?? `Room #${entry.roomId}`,
				day: entry.day,
				startTime: entry.startTime,
				endTime: entry.endTime,
				durationMinutes: entry.durationMinutes,
				owned: entry.facultyId === facultyId,
				entryKind: entry.entryKind,
				cohortCode: entry.cohortCode ?? null,
				cohortName: entry.cohortName ?? null,
				programCode: entry.programCode ?? null,
				programName: entry.programName ?? null,
			}))
			.sort((left, right) =>
				left.day.localeCompare(right.day)
				|| left.startTime.localeCompare(right.startTime)
				|| left.sectionName.localeCompare(right.sectionName),
			),
	};
}

export async function getLatestFacultyRoomPreferenceState(
	schoolId: number,
	schoolYearId: number,
	facultyId: number,
) {
	const run = await resolveActiveDraftRun(schoolId, schoolYearId);
	return getFacultyRoomPreferenceState(schoolId, schoolYearId, run.id, facultyId);
}

export async function previewFacultyRoomPreferenceAction(input: SaveRoomPreferenceDraftInput) {
	const draft = await getRunDraftWithVersion(input.runId, input.schoolId, input.schoolYearId);
	assertRunVersion(draft.version, input.expectedRunVersion);
	const entryMap = buildEntryMap(draft.entries);
	const entry = ensureFacultyOwnsEntry(entryMap.get(input.entryId), input.facultyId);
	const target = resolveRequestTargets(input, entry, draft.entries);

	if (target.actionType === 'SWAP_WITH_OCCUPIED') {
		if (!target.targetEntryId) {
			throw err(422, 'SWAP_TARGET_REQUIRED', 'Swap request requires a target occupied session.');
		}
		const swapPreview = await manualEditService.previewManualSwapEntries(
			input.runId,
			input.schoolId,
			input.schoolYearId,
			entry.entryId,
			target.targetEntryId,
		);
		return {
			actionType: target.actionType,
			target,
			preview: swapPreview.direct,
			swap: swapPreview,
		};
	}

	const preview = await manualEditService.previewManualEdit(input.runId, input.schoolId, input.schoolYearId, {
		editType: target.actionType === 'ROOM_CHANGE' ? 'CHANGE_ROOM' : 'MOVE_ENTRY',
		entryId: entry.entryId,
		targetDay: target.targetDay,
		targetStartTime: target.targetStartTime,
		targetEndTime: target.targetEndTime,
		targetRoomId: target.requestedRoomId,
	});

	return {
		actionType: target.actionType,
		target,
		preview,
	};
}

async function upsertRoomPreference(
	input: SaveRoomPreferenceDraftInput,
	status: RoomPreferenceStatus,
) {
	const draft = await getRunDraftWithVersion(input.runId, input.schoolId, input.schoolYearId);
	assertRunVersion(draft.version, input.expectedRunVersion);

	const entryMap = buildEntryMap(draft.entries);
	const entry = ensureFacultyOwnsEntry(entryMap.get(input.entryId), input.facultyId);
	const target = resolveRequestTargets(input, entry, draft.entries);
	const requestedRoom = await getTeachingRoom(input.schoolId, target.requestedRoomId);

	if (target.actionType === 'MOVE_TO_EMPTY_SLOT') {
		const occupied = draft.entries.find((candidate) =>
			candidate.entryId !== entry.entryId
			&& candidate.day === target.targetDay
			&& candidate.startTime === target.targetStartTime
			&& candidate.endTime === target.targetEndTime,
		);
		if (occupied) {
			throw err(422, 'TARGET_SLOT_OCCUPIED', 'Selected target slot is occupied. Use swap request instead.');
		}
	}

	if (target.actionType === 'SWAP_WITH_OCCUPIED') {
		if (!target.targetEntryId) {
			throw err(422, 'SWAP_TARGET_REQUIRED', 'Swap request requires a target occupied session.');
		}
		const swapTarget = draft.entries.find((candidate) => candidate.entryId === target.targetEntryId);
		if (!swapTarget) {
			throw err(404, 'ENTRY_NOT_FOUND', 'Swap target session was not found in this draft run.');
		}
		const swapPreview = await manualEditService.previewManualSwapEntries(
			input.runId,
			input.schoolId,
			input.schoolYearId,
			entry.entryId,
			target.targetEntryId,
		);
		if (swapPreview.direct.hardViolations.length > 0 && !(input.rationale ?? '').trim()) {
			throw err(422, 'SWAP_REASON_REQUIRED', 'A reason is required for swap requests with hard conflict risks.');
		}
	}

	const existing = await prisma.facultyRoomPreference.findUnique({
		where: { runId_entryId: { runId: input.runId, entryId: input.entryId } },
	});

	if (existing && existing.facultyId !== input.facultyId) {
		throw err(403, 'FORBIDDEN', 'This room preference belongs to a different faculty member.');
	}
	if (existing?.decisionStatus === 'APPROVED') {
		throw err(422, 'ALREADY_APPROVED', 'An approved room preference can no longer be modified.');
	}
	assertRequestVersion(existing?.version ?? 1, input.requestVersion);

	const data = {
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: input.runId,
		entryId: input.entryId,
		facultyId: input.facultyId,
		subjectId: entry.subjectId,
		sectionId: entry.sectionId,
		currentRoomId: entry.roomId,
		requestedRoomId: requestedRoom.id,
		day: target.targetDay as DayOfWeek,
		startTime: target.targetStartTime,
		endTime: target.targetEndTime,
		rationale: encodeRationaleWithMeta({
			actionType: target.actionType,
			targetDay: target.targetDay,
			targetStartTime: target.targetStartTime,
			targetEndTime: target.targetEndTime,
			targetEntryId: target.targetEntryId ?? undefined,
		}, input.rationale),
		status,
		submittedAt: status === 'SUBMITTED' ? new Date() : null,
		decisionStatus: 'PENDING' as const,
		reviewerId: null,
		reviewerNotes: null,
		reviewedAt: null,
	};

	const preference = existing
		? await prisma.facultyRoomPreference.update({
			where: { id: existing.id },
			data: {
				...data,
				version: { increment: 1 },
			},
		})
		: await prisma.facultyRoomPreference.create({
			data,
		});

	await prisma.auditLog.create({
		data: {
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			action: status === 'SUBMITTED' ? 'ROOM_PREFERENCE_SUBMITTED' : 'ROOM_PREFERENCE_DRAFT_SAVED',
			actorId: input.facultyId,
			targetIds: [input.runId, preference.id],
			metadata: {
				entryId: input.entryId,
				requestedRoomId: requestedRoom.id,
				actionType: target.actionType,
				targetDay: target.targetDay,
				targetStartTime: target.targetStartTime,
				targetEndTime: target.targetEndTime,
				targetEntryId: target.targetEntryId,
				status,
			} as object,
		},
	});

	publishRoomPreferenceEvent({
		type: status === 'SUBMITTED' ? 'ROOM_REQUEST_SUBMITTED' : 'ROOM_REQUEST_DRAFT_SAVED',
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: input.runId,
		facultyId: input.facultyId,
		requestId: preference.id,
		entryId: input.entryId,
		message: status === 'SUBMITTED'
			? 'Faculty submitted a room request for review.'
			: 'Faculty saved a room request draft.',
		metadata: {
			requestedRoomId: requestedRoom.id,
			actionType: target.actionType,
			targetDay: target.targetDay,
			targetStartTime: target.targetStartTime,
			targetEndTime: target.targetEndTime,
			targetEntryId: target.targetEntryId,
			status,
		},
	});

	return getFacultyRoomPreferenceState(input.schoolId, input.schoolYearId, input.runId, input.facultyId);
}

export async function saveRoomPreferenceDraft(input: SaveRoomPreferenceDraftInput) {
	return upsertRoomPreference(input, 'DRAFT');
}

export async function submitRoomPreference(input: SubmitRoomPreferenceInput) {
	return upsertRoomPreference(input, 'SUBMITTED');
}

export async function deleteRoomPreferenceDraft(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	facultyId: number,
	entryId: string,
	requestVersion?: number,
) {
	const existing = await prisma.facultyRoomPreference.findUnique({
		where: { runId_entryId: { runId, entryId } },
	});
	if (!existing || existing.schoolId !== schoolId || existing.schoolYearId !== schoolYearId) {
		throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
	}
	if (existing.facultyId !== facultyId) {
		throw err(403, 'FORBIDDEN', 'This room preference belongs to a different faculty member.');
	}
	if (existing.decisionStatus === 'APPROVED') {
		throw err(422, 'ALREADY_APPROVED', 'An approved room preference can no longer be deleted.');
	}
	assertRequestVersion(existing.version, requestVersion);

	await prisma.facultyRoomPreference.delete({ where: { id: existing.id } });
	await prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'ROOM_PREFERENCE_DELETED',
			actorId: facultyId,
			targetIds: [runId, existing.id],
			metadata: {
				entryId,
				requestedRoomId: existing.requestedRoomId,
			} as object,
		},
	});

	publishRoomPreferenceEvent({
		type: 'ROOM_REQUEST_DELETED',
		schoolId,
		schoolYearId,
		runId,
		facultyId,
		requestId: existing.id,
		entryId,
		message: 'Faculty cleared a room request.',
		metadata: {
			requestedRoomId: existing.requestedRoomId,
		},
	});

	return getFacultyRoomPreferenceState(schoolId, schoolYearId, runId, facultyId);
}

export async function getRoomPreferenceSummary(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	filters?: {
		status?: RoomPreferenceStatus;
		decisionStatus?: RoomPreferenceDecisionStatus;
		facultyId?: number;
		requestedRoomId?: number;
	},
): Promise<RoomPreferenceSummaryResponse> {
	const draft = await getRunDraftWithVersion(runId, schoolId, schoolYearId);
	const entryMap = buildEntryMap(draft.entries);
	const requests = await prisma.facultyRoomPreference.findMany({
		where: {
			schoolId,
			schoolYearId,
			runId,
			status: filters?.status,
			decisionStatus: filters?.decisionStatus,
			facultyId: filters?.facultyId,
			requestedRoomId: filters?.requestedRoomId,
		},
		include: {
			faculty: { select: { firstName: true, lastName: true } },
			requestedRoom: {
				select: {
					id: true,
					name: true,
					building: { select: { name: true, shortCode: true } },
				},
			},
		},
		orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
	});

	const currentRoomIds = [...new Set(requests.map((request) => request.currentRoomId))];
	const [currentRooms, subjects, snapshot] = await Promise.all([
		prisma.room.findMany({
			where: { id: { in: currentRoomIds } },
			select: {
				id: true,
				name: true,
				building: { select: { name: true, shortCode: true } },
			},
		}),
		prisma.subject.findMany({
			where: { schoolId, id: { in: [...new Set(requests.map((request) => request.subjectId))] } },
			select: { id: true, code: true, name: true, modularGroupId: true },
		}),
		prisma.sectionSnapshot.findFirst({
			where: { schoolId },
			orderBy: { fetchedAt: 'desc' },
			select: { payload: true },
		}),
	]);

	const currentRoomMap = new Map(
		currentRooms.map((room) => [room.id, `${room.name} · ${room.building.shortCode || room.building.name}`]),
	);
	const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
	const sectionMap = new Map<number, string>();
	if (Array.isArray(snapshot?.payload)) {
		for (const grade of snapshot.payload as Array<{ sections?: Array<{ id: number; name: string }> }>) {
			for (const section of grade.sections ?? []) {
				sectionMap.set(section.id, section.name);
			}
		}
	}

	const requestIds = requests.map((request) => request.id);
	const appealRows = requestIds.length > 0
		? await prisma.roomRequestAppeal.findMany({
			where: { requestId: { in: requestIds } },
			select: { requestId: true, status: true, updatedAt: true },
			orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
		})
		: [];
	const appealByRequest = new Map<number, { count: number; openCount: number; latestStatus: RoomRequestAppealStatus | null; latestUpdatedAt: string | null }>();
	for (const row of appealRows) {
		const existing = appealByRequest.get(row.requestId) ?? {
			count: 0,
			openCount: 0,
			latestStatus: null,
			latestUpdatedAt: null,
		};
		existing.count += 1;
		if (row.status === 'OPEN' || row.status === 'UNDER_REVIEW') existing.openCount += 1;
		if (existing.latestStatus == null) {
			existing.latestStatus = row.status;
			existing.latestUpdatedAt = row.updatedAt.toISOString();
		}
		appealByRequest.set(row.requestId, existing);
	}

	const mappedRequests: RoomPreferenceSummaryItem[] = requests.map((request) => {
		const entry = entryMap.get(request.entryId);
		const subject = subjectMap.get(request.subjectId);
		const subjectDisplayLabel = normalizeSubjectDisplayLabel({
			code: subject?.code,
			name: subject?.name,
			modularGroupId: subject?.modularGroupId,
		});
		const appealSummary = appealByRequest.get(request.id);
		return {
			id: request.id,
			runId: request.runId,
			entryId: request.entryId,
			facultyId: request.facultyId,
			facultyName: `${request.faculty.lastName}, ${request.faculty.firstName}`,
			subjectId: request.subjectId,
			subjectCode: subject?.code ?? `Subject #${request.subjectId}`,
			subjectDisplayLabel,
			subjectName: subject?.name ?? `Subject #${request.subjectId}`,
			sectionId: request.sectionId,
			sectionName: sectionMap.get(request.sectionId) ?? `Section #${request.sectionId}`,
			currentRoomId: request.currentRoomId,
			currentRoomName: currentRoomMap.get(request.currentRoomId) ?? `Room #${request.currentRoomId}`,
			requestedRoomId: request.requestedRoomId,
			requestedRoomName: `${request.requestedRoom.name} · ${request.requestedRoom.building.shortCode || request.requestedRoom.building.name}`,
			day: request.day,
			startTime: request.startTime,
			endTime: request.endTime,
			status: request.status,
			decisionStatus: request.decisionStatus,
			rationale: decodeRationaleAndMeta(request.rationale).rationale,
			submittedAt: request.submittedAt?.toISOString() ?? null,
			version: request.version,
			reviewerId: request.reviewerId,
			reviewerNotes: request.reviewerNotes,
			reviewedAt: request.reviewedAt?.toISOString() ?? null,
			entryKind: entry?.entryKind,
			cohortCode: entry?.cohortCode ?? null,
			cohortName: entry?.cohortName ?? null,
			programCode: entry?.programCode ?? null,
			programName: entry?.programName ?? null,
			appealCount: appealSummary?.count ?? 0,
			openAppealCount: appealSummary?.openCount ?? 0,
			latestAppealStatus: appealSummary?.latestStatus ?? null,
			latestAppealUpdatedAt: appealSummary?.latestUpdatedAt ?? null,
		};
	});

	return {
		runId,
		counts: {
			total: requests.length,
			draft: requests.filter((request) => request.status === 'DRAFT').length,
			submitted: requests.filter((request) => request.status === 'SUBMITTED').length,
			pending: requests.filter((request) => request.decisionStatus === 'PENDING').length,
			approved: requests.filter((request) => request.decisionStatus === 'APPROVED').length,
			rejected: requests.filter((request) => request.decisionStatus === 'REJECTED').length,
		},
		requests: mappedRequests,
		runVersion: draft.version,
	};
}

export async function getLatestRoomPreferenceSummary(
	schoolId: number,
	schoolYearId: number,
	filters?: {
		status?: RoomPreferenceStatus;
		decisionStatus?: RoomPreferenceDecisionStatus;
		facultyId?: number;
		requestedRoomId?: number;
	},
) {
	const run = await resolveActiveDraftRun(schoolId, schoolYearId);
	return getRoomPreferenceSummary(schoolId, schoolYearId, run.id, filters);
}

export async function getRoomPreferenceDetail(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	requestId: number,
) {
	const summary = await getRoomPreferenceSummary(schoolId, schoolYearId, runId);
	const request = summary.requests.find((item) => item.id === requestId);
	if (!request) {
		throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
	}
	const appeals = await listRoomRequestAppeals(schoolId, schoolYearId, runId, requestId);
	return {
		request,
		runVersion: summary.runVersion,
		appeals,
	};
}

export async function previewRoomPreferenceDecision(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	requestId: number,
) {
	const detail = await getRoomPreferenceDetail(schoolId, schoolYearId, runId, requestId);
	const requestRow = await prisma.facultyRoomPreference.findUnique({ where: { id: requestId }, select: { rationale: true, day: true, startTime: true, endTime: true, requestedRoomId: true, entryId: true } });
	if (!requestRow) {
		throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
	}
	const decoded = decodeRationaleAndMeta(requestRow.rationale);
	const actionType = decoded.meta?.actionType ?? 'ROOM_CHANGE';
	let preview: manualEditService.PreviewResult;

	if (actionType === 'SWAP_WITH_OCCUPIED') {
		if (!decoded.meta?.targetEntryId) {
			throw err(422, 'SWAP_TARGET_REQUIRED', 'Swap request is missing its target session.');
		}
		const swapPreview = await manualEditService.previewManualSwapEntries(runId, schoolId, schoolYearId, requestRow.entryId, decoded.meta.targetEntryId);
		preview = swapPreview.direct;
	} else if (actionType === 'MOVE_TO_EMPTY_SLOT' || actionType === 'TIME_AND_ROOM_CHANGE') {
		preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
			editType: 'MOVE_ENTRY',
			entryId: detail.request.entryId,
			targetDay: decoded.meta?.targetDay ?? requestRow.day,
			targetStartTime: decoded.meta?.targetStartTime ?? requestRow.startTime,
			targetEndTime: decoded.meta?.targetEndTime ?? requestRow.endTime,
			targetRoomId: requestRow.requestedRoomId,
		});
	} else {
		preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
			editType: 'CHANGE_ROOM',
			entryId: detail.request.entryId,
			targetRoomId: detail.request.requestedRoomId,
		});
	}

	return {
		request: detail.request,
		runVersion: detail.runVersion,
		appeals: detail.appeals,
		preview,
	};
}

export async function listRoomRequestAppeals(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	requestId: number,
): Promise<RoomRequestAppealItem[]> {
	const appeals = await prisma.roomRequestAppeal.findMany({
		where: { schoolId, schoolYearId, runId, requestId },
		include: {
			requester: { select: { firstName: true, lastName: true } },
			history: {
				include: {
					appeal: { select: { requesterId: true } },
				},
				orderBy: { createdAt: 'asc' },
			},
		},
		orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
	});
	if (appeals.length === 0) return [];

	const actorIds = new Set<number>();
	for (const appeal of appeals) {
		for (const item of appeal.history) actorIds.add(item.actorId);
	}
	const actors = actorIds.size > 0
		? await prisma.facultyMirror.findMany({
			where: { id: { in: [...actorIds] } },
			select: { id: true, firstName: true, lastName: true },
		})
		: [];
	const actorMap = new Map(actors.map((actor) => [actor.id, `${actor.lastName}, ${actor.firstName}`]));

	return appeals.map((appeal) => ({
		id: appeal.id,
		requestId: appeal.requestId,
		requesterId: appeal.requesterId,
		requesterName: `${appeal.requester.lastName}, ${appeal.requester.firstName}`,
		reason: appeal.reason,
		status: appeal.status,
		createdAt: appeal.createdAt.toISOString(),
		updatedAt: appeal.updatedAt.toISOString(),
		history: appeal.history.map((item) => ({
			id: item.id,
			actorId: item.actorId,
			actorName: actorMap.get(item.actorId) ?? `Faculty #${item.actorId}`,
			action: item.action,
			fromStatus: item.fromStatus,
			toStatus: item.toStatus,
			note: item.note ?? null,
			createdAt: item.createdAt.toISOString(),
		})),
	}));
}

export async function createRoomRequestAppeal(input: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	requestId: number;
	requesterId: number;
	reason: string;
}) {
	const reason = input.reason.trim();
	if (!reason) {
		throw err(400, 'INVALID_BODY', 'Appeal reason is required.');
	}

	const request = await prisma.facultyRoomPreference.findFirst({
		where: {
			id: input.requestId,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			runId: input.runId,
		},
		select: { id: true, entryId: true },
	});
	if (!request) {
		throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
	}

	const appeal = await prisma.$transaction(async (tx) => {
		const created = await tx.roomRequestAppeal.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				runId: input.runId,
				requestId: input.requestId,
				requesterId: input.requesterId,
				reason,
				status: 'OPEN',
			},
		});
		await tx.roomRequestAppealHistory.create({
			data: {
				appealId: created.id,
				actorId: input.requesterId,
				action: 'CREATED',
				fromStatus: null,
				toStatus: 'OPEN',
				note: reason,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'ROOM_REQUEST_APPEAL_CREATED',
				actorId: input.requesterId,
				targetIds: [input.runId, input.requestId, created.id],
				metadata: { entryId: request.entryId } as object,
			},
		});
		return created;
	});

	return {
		appealId: appeal.id,
		status: appeal.status,
	};
}

export async function updateRoomRequestAppealStatus(input: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	requestId: number;
	appealId: number;
	actorId: number;
	status: RoomRequestAppealStatus;
	note?: string | null;
}) {
	const appeal = await prisma.roomRequestAppeal.findFirst({
		where: {
			id: input.appealId,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			runId: input.runId,
			requestId: input.requestId,
		},
	});
	if (!appeal) {
		throw err(404, 'APPEAL_NOT_FOUND', 'Room request appeal was not found in this run scope.');
	}

	const updated = await prisma.$transaction(async (tx) => {
		const next = await tx.roomRequestAppeal.update({
			where: { id: appeal.id },
			data: { status: input.status },
		});
		await tx.roomRequestAppealHistory.create({
			data: {
				appealId: appeal.id,
				actorId: input.actorId,
				action: 'STATUS_CHANGED',
				fromStatus: appeal.status,
				toStatus: input.status,
				note: input.note ?? null,
			},
		});
		await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'ROOM_REQUEST_APPEAL_STATUS_CHANGED',
				actorId: input.actorId,
				targetIds: [input.runId, input.requestId, input.appealId],
				metadata: { fromStatus: appeal.status, toStatus: input.status, note: input.note ?? null } as object,
			},
		});
		return next;
	});

	return {
		appealId: updated.id,
		status: updated.status,
	};
}

export async function reviewRoomPreference(input: ReviewRoomPreferenceInput) {
	const request = await prisma.facultyRoomPreference.findFirst({
		where: {
			id: input.requestId,
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			runId: input.runId,
		},
	});

	if (!request) {
		throw err(404, 'ROOM_PREFERENCE_NOT_FOUND', 'Room preference request was not found in this run scope.');
	}
	if (request.status !== 'SUBMITTED') {
		throw err(422, 'ROOM_PREFERENCE_NOT_SUBMITTED', 'Only submitted room preference requests can be reviewed.');
	}
	assertRequestVersion(request.version, input.requestVersion);

	const decoded = decodeRationaleAndMeta(request.rationale);
	const actionType = decoded.meta?.actionType ?? 'ROOM_CHANGE';

	let commitResult: manualEditService.CommitResult | null = null;
	if (input.decisionStatus === 'APPROVED') {
		if (input.expectedRunVersion == null) {
			throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when approving a room preference request.');
		}
		if (actionType === 'SWAP_WITH_OCCUPIED') {
			if (!decoded.meta?.targetEntryId) {
				throw err(422, 'SWAP_TARGET_REQUIRED', 'Swap request is missing target session data.');
			}
			commitResult = await manualEditService.swapManualEntries(
				input.runId,
				input.schoolId,
				input.schoolYearId,
				input.reviewerId,
				request.entryId,
				decoded.meta.targetEntryId,
				input.expectedRunVersion,
				'DIRECT_SWAP',
			);
		} else if (actionType === 'MOVE_TO_EMPTY_SLOT' || actionType === 'TIME_AND_ROOM_CHANGE') {
			commitResult = await manualEditService.commitManualEdit(
				input.runId,
				input.schoolId,
				input.schoolYearId,
				input.reviewerId,
				{
					editType: 'MOVE_ENTRY',
					entryId: request.entryId,
					targetDay: decoded.meta?.targetDay ?? request.day,
					targetStartTime: decoded.meta?.targetStartTime ?? request.startTime,
					targetEndTime: decoded.meta?.targetEndTime ?? request.endTime,
					targetRoomId: request.requestedRoomId,
				},
				input.expectedRunVersion,
				!!input.allowSoftOverride,
			);
		} else {
			commitResult = await manualEditService.commitManualEdit(
				input.runId,
				input.schoolId,
				input.schoolYearId,
				input.reviewerId,
				{
					editType: 'CHANGE_ROOM',
					entryId: request.entryId,
					targetRoomId: request.requestedRoomId,
				},
				input.expectedRunVersion,
				!!input.allowSoftOverride,
			);
		}
	}

	const updated = await prisma.facultyRoomPreference.update({
		where: { id: request.id },
		data: {
			decisionStatus: input.decisionStatus,
			reviewerId: input.reviewerId,
			reviewerNotes: input.reviewerNotes ?? null,
			reviewedAt: new Date(),
			version: { increment: 1 },
		},
	});

	await prisma.auditLog.create({
		data: {
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			action: input.decisionStatus === 'APPROVED' ? 'ROOM_PREFERENCE_APPROVED' : 'ROOM_PREFERENCE_REJECTED',
			actorId: input.reviewerId,
			targetIds: [input.runId, updated.id],
			metadata: {
				entryId: request.entryId,
				requestedRoomId: request.requestedRoomId,
				manualEditId: commitResult?.editId ?? null,
			} as object,
		},
	});

	publishRoomPreferenceEvent({
		type: 'ROOM_REQUEST_REVIEWED',
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: input.runId,
		facultyId: request.facultyId,
		requestId: updated.id,
		entryId: request.entryId,
		message: input.decisionStatus === 'APPROVED'
			? 'Scheduler approved a room request.'
			: 'Scheduler rejected a room request.',
		metadata: {
			decisionStatus: input.decisionStatus,
			reviewerId: input.reviewerId,
			manualEditId: commitResult?.editId ?? null,
		},
	});

	return {
		request: updated,
		commitResult,
	};
}

export async function processQueuedRoomPreferenceActions(input: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	facultyId: number;
	actions: RoomPreferenceSyncAction[];
}) {
	const results: Array<{
		actionId: string;
		ok: boolean;
		state?: FacultyRoomPreferenceState;
		error?: { code: string; message: string; statusCode: number };
	}> = [];

	for (const action of input.actions) {
		try {
			if (!action.entryId || !action.actionId) {
				throw err(400, 'INVALID_ACTION', 'Each queued action requires actionId and entryId.');
			}

			let state: FacultyRoomPreferenceState;
			if (action.type === 'SAVE_DRAFT') {
				state = await saveRoomPreferenceDraft({
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					runId: input.runId,
					facultyId: input.facultyId,
					entryId: action.entryId,
					requestedRoomId: action.requestedRoomId,
					actionType: action.actionType,
					targetDay: action.targetDay,
					targetStartTime: action.targetStartTime,
					targetEndTime: action.targetEndTime,
					targetEntryId: action.targetEntryId,
					rationale: action.rationale ?? null,
					expectedRunVersion: action.expectedRunVersion,
					requestVersion: action.requestVersion,
				});
			} else if (action.type === 'SUBMIT') {
				state = await submitRoomPreference({
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					runId: input.runId,
					facultyId: input.facultyId,
					entryId: action.entryId,
					requestedRoomId: action.requestedRoomId,
					actionType: action.actionType,
					targetDay: action.targetDay,
					targetStartTime: action.targetStartTime,
					targetEndTime: action.targetEndTime,
					targetEntryId: action.targetEntryId,
					rationale: action.rationale ?? null,
					expectedRunVersion: action.expectedRunVersion,
					requestVersion: action.requestVersion,
				});
			} else if (action.type === 'DELETE') {
				state = await deleteRoomPreferenceDraft(
					input.schoolId,
					input.schoolYearId,
					input.runId,
					input.facultyId,
					action.entryId,
					action.requestVersion,
				);
			} else {
				throw err(400, 'INVALID_ACTION', `Unsupported queued action type: ${action.type}.`);
			}

			results.push({ actionId: action.actionId, ok: true, state });
		} catch (error) {
			const known = error as { code?: string; statusCode?: number; message?: string };
			results.push({
				actionId: action.actionId,
				ok: false,
				error: {
					code: known.code ?? 'SYNC_ACTION_FAILED',
					message: known.message ?? 'Queued action failed during reconciliation.',
					statusCode: known.statusCode ?? 500,
				},
			});
		}
	}

	const latestState = await getFacultyRoomPreferenceState(input.schoolId, input.schoolYearId, input.runId, input.facultyId);
	publishRoomPreferenceEvent({
		type: 'ROOM_REQUEST_SYNC_COMPLETED',
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: input.runId,
		facultyId: input.facultyId,
		requestId: null,
		entryId: null,
		message: 'Queued room preference actions were reconciled.',
		metadata: {
			totalActions: input.actions.length,
			failedActions: results.filter((item) => !item.ok).length,
		},
	});

	return {
		runId: input.runId,
		runVersion: latestState.runVersion,
		results,
		state: latestState,
	};
}