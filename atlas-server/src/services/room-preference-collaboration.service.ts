import type { Server as HttpServer } from 'node:http';
import { URL } from 'node:url';

import { WebSocketServer, WebSocket } from 'ws';

import { prisma } from '../lib/prisma.js';
import type { AuthPayload } from '../middleware/authenticate.js';
import { consumeCollaborationTicket, type CollaborationScope } from './timetable-collaboration-ticket.service.js';
import { resolveCanonicalFacultyMirror } from './faculty-identity.service.js';
import { onRoomPreferenceEvent } from './room-preference-events.service.js';
import { onTimetableEvent } from './timetable-events.service.js';

export type CollaborationViewMode = 'FACULTY_ACTIVE_DRAFT' | 'SCHEDULER_REVIEW' | 'SCHEDULER_QUEUE';

export type CollaborationSelection = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	day?: string;
	startTime?: string;
	endTime?: string;
	entryId?: string;
	source?: 'GRID_CELL' | 'REQUEST_CARD' | 'SESSION';
};

export type CollaborationPresence = {
	connectionId: string;
	userId: number;
	role: string;
	displayName: string | null;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	viewMode: CollaborationViewMode;
	lastActive: string;
};

type CollaborationJoinMessage = {
	type: 'collab.join';
	schoolId: number;
	schoolYearId: number;
	runId: number;
	viewMode?: CollaborationViewMode;
};

type CollaborationHeartbeatMessage = {
	type: 'collab.heartbeat';
};

type CollaborationSelectionMessage = {
	type: 'collab.selection';
	selection: CollaborationSelection;
};

type CollaborationViewModeMessage = {
	type: 'collab.view-mode';
	viewMode: CollaborationViewMode;
};

type ClientMessage = CollaborationJoinMessage | CollaborationHeartbeatMessage | CollaborationSelectionMessage | CollaborationViewModeMessage;

type SocketState = {
	connectionId: string;
	ws: WebSocket;
	auth: AuthPayload;
	joined: CollaborationPresence | null;
	allowedScope: CollaborationScope;
	lastHeartbeatAt: number;
	lastSelectionAt: number;
};

type CollaborationOptions = {
	path?: string;
	heartbeatTimeoutMs?: number;
	pruneIntervalMs?: number;
};

const DEFAULT_WS_PATH = '/api/v1/room-preferences/collaboration/ws';
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 30000;
const DEFAULT_PRUNE_INTERVAL_MS = 5000;

const VIEW_MODES: Set<CollaborationViewMode> = new Set(['FACULTY_ACTIVE_DRAFT', 'SCHEDULER_REVIEW', 'SCHEDULER_QUEUE']);
const DAYS = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);

function parseTicketFromRequest(requestUrl: string | undefined) {
	const parsedUrl = new URL(requestUrl ?? '/', 'http://localhost');
	const ticket = parsedUrl.searchParams.get('ticket');
	const schoolId = Number(parsedUrl.searchParams.get('schoolId'));
	const schoolYearId = Number(parsedUrl.searchParams.get('schoolYearId'));
	const runId = Number(parsedUrl.searchParams.get('runId'));
	if (!ticket || ![schoolId, schoolYearId, runId].every((value) => Number.isSafeInteger(value) && value > 0)) return null;
	const scope = { schoolId, schoolYearId, runId };
	const consumed = consumeCollaborationTicket(ticket, scope);
	if (!consumed) return null;
	const actor = consumed.actor;
	const auth: AuthPayload = {
		userId: actor.userId,
		role: actor.role,
		schoolId: actor.schoolId,
		accountName: cleanDisplayName(actor.displayName) ?? undefined,
		capabilities: actor.capabilities,
	};
	return { auth, scope };
}

function parseClientMessage(raw: string): ClientMessage | null {
	if (raw.length > 4096) return null;
	try {
		const parsed = JSON.parse(raw) as ClientMessage;
		if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function cleanDisplayName(input: string | null | undefined): string | null {
	if (!input || typeof input !== 'string') return null;
	const cleaned = input.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80);
	return cleaned || null;
}

function sanitizeSelection(input: unknown, channel: CollaborationScope): CollaborationSelection | null {
	if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
	const value = input as Record<string, unknown>;
	if (value.schoolId !== channel.schoolId || value.schoolYearId !== channel.schoolYearId || value.runId !== channel.runId) return null;
	const selection: CollaborationSelection = { schoolId: channel.schoolId, schoolYearId: channel.schoolYearId, runId: channel.runId };
	if (value.day !== undefined) {
		if (typeof value.day !== 'string' || !DAYS.has(value.day)) return null;
		selection.day = value.day;
	}
	for (const field of ['startTime', 'endTime'] as const) {
		if (value[field] === undefined) continue;
		if (typeof value[field] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value[field] as string)) return null;
		selection[field] = value[field] as string;
	}
	if (value.entryId !== undefined) {
		if (typeof value.entryId !== 'string' || value.entryId.length > 128 || /[\u0000-\u001f\u007f]/.test(value.entryId)) return null;
		selection.entryId = value.entryId;
	}
	if (value.source !== undefined) {
		if (value.source !== 'GRID_CELL' && value.source !== 'REQUEST_CARD' && value.source !== 'SESSION') return null;
		selection.source = value.source;
	}
	return selection;
}

function safeSend(ws: WebSocket, payload: unknown) {
	if (ws.readyState !== WebSocket.OPEN) return;
	ws.send(JSON.stringify(payload));
}

function nowIso(): string {
	return new Date().toISOString();
}

function normalizeViewMode(input: unknown, fallback: CollaborationViewMode): CollaborationViewMode {
	if (typeof input !== 'string') return fallback;
	if (!VIEW_MODES.has(input as CollaborationViewMode)) return fallback;
	return input as CollaborationViewMode;
}

function sameChannel(a: CollaborationPresence, b: { schoolId: number; schoolYearId: number; runId: number }): boolean {
	return a.schoolId === b.schoolId && a.schoolYearId === b.schoolYearId && a.runId === b.runId;
}

export function registerRoomPreferenceCollaborationSocket(server: HttpServer, options?: CollaborationOptions) {
	const wsPath = options?.path ?? DEFAULT_WS_PATH;
	const heartbeatTimeoutMs = options?.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
	const pruneIntervalMs = options?.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;

	const wss = new WebSocketServer({ server, path: wsPath, maxPayload: 4096 });
	const sockets = new Map<string, SocketState>();

	function snapshotForChannel(channel: { schoolId: number; schoolYearId: number; runId: number }) {
		return [...sockets.values()]
			.filter((state) => state.joined && sameChannel(state.joined, channel))
			.map((state) => state.joined!)
			.sort((left, right) => left.lastActive.localeCompare(right.lastActive));
	}

	function broadcastToChannel(channel: { schoolId: number; schoolYearId: number; runId: number }, payload: unknown, exceptConnectionId?: string) {
		for (const state of sockets.values()) {
			if (!state.joined) continue;
			if (!sameChannel(state.joined, channel)) continue;
			if (exceptConnectionId && state.connectionId === exceptConnectionId) continue;
			safeSend(state.ws, payload);
		}
	}

	function closeWithReason(state: SocketState, code: string, message: string) {
		safeSend(state.ws, { type: 'collab.error', code, message });
		state.ws.close();
	}

	async function resolveFacultyIdForUser(auth: AuthPayload, channel: { schoolId: number; schoolYearId: number }): Promise<number | null> {
		const identity = await resolveCanonicalFacultyMirror({
			schoolId: channel.schoolId,
			schoolYearId: channel.schoolYearId,
			accountId: auth.accountId ?? null,
			linkedFacultyId: auth.facultyId ?? null,
			tokenUserId: auth.userId,
			email: auth.email ?? null,
			employeeId: auth.employeeId ?? null,
			accountName: auth.accountName ?? null,
		});
		return identity?.faculty.id ?? null;
	}

	async function canJoinChannel(auth: AuthPayload, channel: { schoolId: number; schoolYearId: number; runId: number }) {
		const run = await prisma.generationRun.findFirst({
			where: { id: channel.runId, schoolId: channel.schoolId, schoolYearId: channel.schoolYearId },
			select: { id: true },
		});
		if (!run) {
			return { ok: false, code: 'RUN_NOT_FOUND', message: 'Run was not found in this school scope.' } as const;
		}

	if (auth.role === 'admin' || auth.role === 'officer' || auth.role === 'SYSTEM_ADMIN' || auth.capabilities?.includes('timetable:read')) {
			return { ok: true, facultyId: null } as const;
		}

		const facultyId = await resolveFacultyIdForUser(auth, channel);
		if (!facultyId) {
			return { ok: false, code: 'FACULTY_MAPPING_REQUIRED', message: 'Teacher profile mapping is required for collaboration.' } as const;
		}

		return { ok: true, facultyId } as const;
	}

	function touch(state: SocketState) {
		state.lastHeartbeatAt = Date.now();
		if (state.joined) {
			state.joined.lastActive = nowIso();
		}
	}

	function removeSocket(connectionId: string) {
		const state = sockets.get(connectionId);
		if (!state) return;
		const joined = state.joined;
		sockets.delete(connectionId);
		if (joined) {
			broadcastToChannel(joined, { type: 'collab.presence.leave', connectionId: joined.connectionId });
		}
	}

	const stopRoomRequestBridge = onRoomPreferenceEvent((event) => {
		broadcastToChannel(
			{ schoolId: event.schoolId, schoolYearId: event.schoolYearId, runId: event.runId },
			{ type: 'collab.room-request.event', event },
		);
	});

	const stopTimetableBridge = onTimetableEvent((event) => {
		broadcastToChannel(
			{ schoolId: event.schoolId, schoolYearId: event.schoolYearId, runId: event.runId },
			{ type: 'collab.timetable.event', event },
		);
	});

	const pruneTimer = setInterval(() => {
		const cutoff = Date.now() - heartbeatTimeoutMs;
		for (const state of sockets.values()) {
			if (state.lastHeartbeatAt >= cutoff) continue;
			closeWithReason(state, 'HEARTBEAT_TIMEOUT', 'Connection timed out due to inactivity.');
		}
	}, pruneIntervalMs);

	wss.on('connection', (ws, req) => {
		const parsedTicket = parseTicketFromRequest(req.url);
		if (!parsedTicket) {
			safeSend(ws, { type: 'collab.error', code: 'UNAUTHORIZED', message: 'A valid collaboration ticket is required.' });
			ws.close();
			return;
		}
		const { auth, scope: allowedScope } = parsedTicket;

		const connectionId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const state: SocketState = {
			connectionId,
			ws,
			auth,
			joined: null,
			allowedScope,
			lastHeartbeatAt: Date.now(),
			lastSelectionAt: 0,
		};
		sockets.set(connectionId, state);

		safeSend(ws, {
			type: 'collab.connected',
			connectionId,
			user: {
				userId: auth.userId,
				role: auth.role,
				displayName: cleanDisplayName(auth.accountName),
				authSource: auth.authSource ?? 'bridge',
			},
		});

		ws.on('message', async (raw) => {
			touch(state);
			const message = parseClientMessage(String(raw));
			if (!message) {
				safeSend(ws, { type: 'collab.error', code: 'INVALID_MESSAGE', message: 'Unable to parse collaboration message.' });
				return;
			}

			if (message.type === 'collab.heartbeat') {
				safeSend(ws, { type: 'collab.heartbeat.ack', ts: nowIso() });
				return;
			}

			if (message.type === 'collab.join') {
				const schoolId = Number(message.schoolId);
				const schoolYearId = Number(message.schoolYearId);
				const runId = Number(message.runId);
				if (![schoolId, schoolYearId, runId].every((value) => Number.isSafeInteger(value) && value > 0)) {
					safeSend(ws, { type: 'collab.error', code: 'INVALID_SCOPE', message: 'Join scope must include valid school, year, and run ids.' });
					return;
				}

				const channel = { schoolId, schoolYearId, runId };
				if (channel.schoolId !== state.allowedScope.schoolId || channel.schoolYearId !== state.allowedScope.schoolYearId || channel.runId !== state.allowedScope.runId) {
					safeSend(ws, { type: 'collab.error', code: 'TICKET_SCOPE_MISMATCH', message: 'Join scope must match the issued collaboration ticket.' });
					return;
				}
				const permission = await canJoinChannel(state.auth, channel);
				if (!permission.ok) {
					safeSend(ws, { type: 'collab.error', code: permission.code, message: permission.message });
					return;
				}

				const presence: CollaborationPresence = {
					connectionId: state.connectionId,
					userId: state.auth.userId,
					role: state.auth.role,
					displayName: cleanDisplayName(state.auth.accountName),
					schoolId,
					schoolYearId,
					runId,
					viewMode: normalizeViewMode(message.viewMode, state.auth.role === 'faculty' ? 'FACULTY_ACTIVE_DRAFT' : 'SCHEDULER_QUEUE'),
					lastActive: nowIso(),
				};

				state.joined = presence;
				const snapshot = snapshotForChannel(channel);
				safeSend(ws, { type: 'collab.snapshot', channel, presence: snapshot });
				broadcastToChannel(channel, { type: 'collab.presence.upsert', presence }, state.connectionId);
				return;
			}

			if (!state.joined) {
				safeSend(ws, { type: 'collab.error', code: 'NOT_JOINED', message: 'Join a collaboration channel first.' });
				return;
			}

			if (message.type === 'collab.view-mode') {
				state.joined.viewMode = normalizeViewMode(message.viewMode, state.joined.viewMode);
				state.joined.lastActive = nowIso();
				broadcastToChannel(state.joined, { type: 'collab.presence.upsert', presence: state.joined });
				return;
			}

			if (message.type === 'collab.selection') {
				const selection = sanitizeSelection(message.selection, state.joined);
				if (!selection) {
					safeSend(ws, { type: 'collab.error', code: 'SELECTION_SCOPE_MISMATCH', message: 'Selection scope must match joined channel.' });
					return;
				}
				if (Date.now() - state.lastSelectionAt < 50) {
					safeSend(ws, { type: 'collab.error', code: 'SELECTION_RATE_LIMITED', message: 'Selection updates are being sent too quickly.' });
					return;
				}
				state.lastSelectionAt = Date.now();

				state.joined.lastActive = nowIso();
				broadcastToChannel(state.joined, {
					type: 'collab.selection',
					selection,
					presence: {
						connectionId: state.joined.connectionId,
						userId: state.joined.userId,
						role: state.joined.role,
						displayName: state.joined.displayName,
						viewMode: state.joined.viewMode,
						lastActive: state.joined.lastActive,
					},
				});
				return;
			}
		});

		ws.on('close', () => {
			removeSocket(connectionId);
		});

		ws.on('error', () => {
			removeSocket(connectionId);
		});
	});

	const dispose = () => {
		stopRoomRequestBridge();
		stopTimetableBridge();
		clearInterval(pruneTimer);
		for (const state of sockets.values()) {
			try {
				state.ws.close();
			} catch {
				// no-op
			}
		}
		sockets.clear();
		try {
			wss.close();
		} catch {
			// no-op
		}
	};

	server.on('close', dispose);

	return {
		path: wsPath,
		dispose,
	};
}
