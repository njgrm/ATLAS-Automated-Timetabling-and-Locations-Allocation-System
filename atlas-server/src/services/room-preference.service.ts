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
	requestedRoomId: number;
	rationale?: string | null;
	expectedRunVersion?: number;
	requestVersion?: number;
}

export interface SubmitRoomPreferenceInput extends SaveRoomPreferenceDraftInput {
	requestVersion?: number;
}

export type RoomPreferenceSyncActionType = 'SAVE_DRAFT' | 'SUBMIT' | 'DELETE';

export interface RoomPreferenceSyncAction {
	actionId: string;
	type: RoomPreferenceSyncActionType;
	entryId: string;
	requestedRoomId?: number;
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
	/** True when the requested room type differs from the subject's preferred room type. Warning-only. */
	roomTypeOverride?: boolean;
}

export interface FacultyRoomPreferenceState {
	runId: number;
	runVersion: number;
	runGeneratedAt: string | null;
	entries: FacultyRoomPreferenceEntry[];
}

export interface RoomPreferenceSummaryItem {
	id: number;
	runId: number;
	entryId: string;
	facultyId: number;
	facultyName: string;
	subjectId: number;
	subjectCode: string;
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

	const [subjects, snapshot, rooms] = await Promise.all([
		prisma.subject.findMany({
			where: { schoolId, id: { in: subjectIds } },
			select: { id: true, code: true, name: true, preferredRoomType: true },
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

	return { subjectMap, sectionMap, roomMap, roomTypeMap };
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

	return {
		runId: draft.runId,
		runVersion: draft.version,
		runGeneratedAt: draft.finishedAt ?? draft.createdAt,
		entries: assignedEntries.map((entry) => {
			const request = requestMap.get(entry.entryId);
			const subject = subjectMap.get(entry.subjectId);
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
				facultyId: entry.facultyId,
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
				rationale: request?.rationale ?? null,
				submittedAt: request?.submittedAt?.toISOString() ?? null,
				version: request?.version ?? null,
				subjectCode: subject?.code ?? `Subject #${entry.subjectId}`,
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
				roomTypeOverride,
			};
		}),
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

async function upsertRoomPreference(
	input: SaveRoomPreferenceDraftInput,
	status: RoomPreferenceStatus,
) {
	const draft = await getRunDraftWithVersion(input.runId, input.schoolId, input.schoolYearId);
	assertRunVersion(draft.version, input.expectedRunVersion);

	const entryMap = buildEntryMap(draft.entries);
	const entry = ensureFacultyOwnsEntry(entryMap.get(input.entryId), input.facultyId);
	const requestedRoom = await getTeachingRoom(input.schoolId, input.requestedRoomId);

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
		day: entry.day as DayOfWeek,
		startTime: entry.startTime,
		endTime: entry.endTime,
		rationale: input.rationale ?? null,
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
			select: { id: true, code: true, name: true },
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
		const appealSummary = appealByRequest.get(request.id);
		return {
			id: request.id,
			runId: request.runId,
			entryId: request.entryId,
			facultyId: request.facultyId,
			facultyName: `${request.faculty.lastName}, ${request.faculty.firstName}`,
			subjectId: request.subjectId,
			subjectCode: subject?.code ?? `Subject #${request.subjectId}`,
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
			rationale: request.rationale,
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
	const preview = await manualEditService.previewManualEdit(runId, schoolId, schoolYearId, {
		editType: 'CHANGE_ROOM',
		entryId: detail.request.entryId,
		targetRoomId: detail.request.requestedRoomId,
	});

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

	let commitResult: manualEditService.CommitResult | null = null;
	if (input.decisionStatus === 'APPROVED') {
		if (input.expectedRunVersion == null) {
			throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when approving a room preference request.');
		}
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
				if (!Number.isInteger(action.requestedRoomId) || (action.requestedRoomId ?? 0) <= 0) {
					throw err(400, 'INVALID_ACTION', 'SAVE_DRAFT requires a valid requestedRoomId.');
				}
				const requestedRoomId = action.requestedRoomId as number;
				state = await saveRoomPreferenceDraft({
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					runId: input.runId,
					facultyId: input.facultyId,
					entryId: action.entryId,
					requestedRoomId,
					rationale: action.rationale ?? null,
					expectedRunVersion: action.expectedRunVersion,
					requestVersion: action.requestVersion,
				});
			} else if (action.type === 'SUBMIT') {
				if (!Number.isInteger(action.requestedRoomId) || (action.requestedRoomId ?? 0) <= 0) {
					throw err(400, 'INVALID_ACTION', 'SUBMIT requires a valid requestedRoomId.');
				}
				const requestedRoomId = action.requestedRoomId as number;
				state = await submitRoomPreference({
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					runId: input.runId,
					facultyId: input.facultyId,
					entryId: action.entryId,
					requestedRoomId,
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