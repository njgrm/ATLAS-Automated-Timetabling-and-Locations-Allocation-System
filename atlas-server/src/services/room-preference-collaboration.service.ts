import type { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { URL } from 'node:url';

import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';

import { prisma } from '../lib/prisma.js';
import type { AuthPayload } from '../middleware/authenticate.js';
import { onRoomPreferenceEvent } from './room-preference-events.service.js';

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
	email: string | null;
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
	lastHeartbeatAt: number;
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

function normalizeAuthPayload(decoded: AuthPayload): AuthPayload {
	return {
		...decoded,
		authSource: decoded.authSource === 'local' ? 'local' : 'bridge',
	};
}

function parseAuthFromRequest(req: IncomingMessage): AuthPayload | null {
	const secret = process.env.JWT_SECRET;
	if (!secret) return null;

	const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
	const queryToken = parsedUrl.searchParams.get('accessToken');
	const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
	const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	const token = headerToken ?? queryToken;
	if (!token) return null;

	try {
		const decoded = jwt.verify(token, secret) as AuthPayload;
		if (!decoded?.userId || !decoded?.role) return null;
		return normalizeAuthPayload(decoded);
	} catch {
		return null;
	}
}

function parseClientMessage(raw: string): ClientMessage | null {
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

	const wss = new WebSocketServer({ server, path: wsPath });
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

	async function resolveFacultyIdForUser(schoolId: number, userId: number): Promise<number | null> {
		const faculty = await prisma.facultyMirror.findFirst({ where: { schoolId, externalId: userId }, select: { id: true } });
		return faculty?.id ?? null;
	}

	async function canJoinChannel(auth: AuthPayload, channel: { schoolId: number; schoolYearId: number; runId: number }) {
		const run = await prisma.generationRun.findFirst({
			where: { id: channel.runId, schoolId: channel.schoolId, schoolYearId: channel.schoolYearId },
			select: { id: true },
		});
		if (!run) {
			return { ok: false, code: 'RUN_NOT_FOUND', message: 'Run was not found in this school scope.' } as const;
		}

		if (auth.role === 'admin' || auth.role === 'officer' || auth.role === 'SYSTEM_ADMIN') {
			return { ok: true, facultyId: null } as const;
		}

		const facultyId = await resolveFacultyIdForUser(channel.schoolId, auth.userId);
		if (!facultyId) {
			return { ok: false, code: 'FACULTY_MAPPING_REQUIRED', message: 'Faculty profile mapping is required for collaboration.' } as const;
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

	const pruneTimer = setInterval(() => {
		const cutoff = Date.now() - heartbeatTimeoutMs;
		for (const state of sockets.values()) {
			if (state.lastHeartbeatAt >= cutoff) continue;
			closeWithReason(state, 'HEARTBEAT_TIMEOUT', 'Connection timed out due to inactivity.');
		}
	}, pruneIntervalMs);

	wss.on('connection', (ws, req) => {
		const auth = parseAuthFromRequest(req);
		if (!auth) {
			safeSend(ws, { type: 'collab.error', code: 'UNAUTHORIZED', message: 'Invalid or missing access token.' });
			ws.close();
			return;
		}

		const connectionId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const state: SocketState = {
			connectionId,
			ws,
			auth,
			joined: null,
			lastHeartbeatAt: Date.now(),
		};
		sockets.set(connectionId, state);

		safeSend(ws, {
			type: 'collab.connected',
			connectionId,
			user: {
				userId: auth.userId,
				role: auth.role,
				email: auth.email ?? null,
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
				if (!Number.isInteger(schoolId) || !Number.isInteger(schoolYearId) || !Number.isInteger(runId)) {
					safeSend(ws, { type: 'collab.error', code: 'INVALID_SCOPE', message: 'Join scope must include valid school, year, and run ids.' });
					return;
				}

				const channel = { schoolId, schoolYearId, runId };
				const permission = await canJoinChannel(state.auth, channel);
				if (!permission.ok) {
					safeSend(ws, { type: 'collab.error', code: permission.code, message: permission.message });
					return;
				}

				const presence: CollaborationPresence = {
					connectionId: state.connectionId,
					userId: state.auth.userId,
					role: state.auth.role,
					email: state.auth.email ?? null,
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
				const selection = message.selection;
				if (!selection || selection.runId !== state.joined.runId || selection.schoolId !== state.joined.schoolId || selection.schoolYearId !== state.joined.schoolYearId) {
					safeSend(ws, { type: 'collab.error', code: 'SELECTION_SCOPE_MISMATCH', message: 'Selection scope must match joined channel.' });
					return;
				}

				state.joined.lastActive = nowIso();
				broadcastToChannel(state.joined, {
					type: 'collab.selection',
					selection,
					presence: {
						connectionId: state.joined.connectionId,
						userId: state.joined.userId,
						role: state.joined.role,
						email: state.joined.email,
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
