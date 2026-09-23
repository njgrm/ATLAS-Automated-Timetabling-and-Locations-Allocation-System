import type { CollaborationPresence, CollaborationSelection, RoomPreferenceEvent } from '@/types';

const WS_PATH = '/room-preferences/collaboration/ws';
const runtimeEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export type CollaborationConnectedPayload = {
	connectionId: string;
	user: {
		userId: number;
		role: string;
		displayName: string | null;
		authSource: 'local' | 'bridge';
	};
};

export type CollaborationSnapshotPayload = {
	channel: {
		schoolId: number;
		schoolYearId: number;
		runId: number;
	};
	presence: CollaborationPresence[];
};

export type CollaborationSelectionPayload = {
	selection: CollaborationSelection;
	presence: Pick<CollaborationPresence, 'connectionId' | 'userId' | 'role' | 'displayName' | 'viewMode' | 'lastActive'>;
};

export type CollaborationEvent =
	| { type: 'connected'; payload: CollaborationConnectedPayload }
	| { type: 'snapshot'; payload: CollaborationSnapshotPayload }
	| { type: 'presence-upsert'; payload: CollaborationPresence }
	| { type: 'presence-leave'; payload: { connectionId: string } }
	| { type: 'selection'; payload: CollaborationSelectionPayload }
	| { type: 'room-request-event'; payload: RoomPreferenceEvent }
	| { type: 'timetable-event'; payload: any }
	| { type: 'error'; payload: { code: string; message: string } }
	| { type: 'open' }
	| { type: 'close' };

export type CollaborationSocket = {
	join: (scope: { schoolId: number; schoolYearId: number; runId: number; viewMode: CollaborationPresence['viewMode'] }) => void;
	sendSelection: (selection: CollaborationSelection) => void;
	updateViewMode: (viewMode: CollaborationPresence['viewMode']) => void;
	close: () => void;
};

type CollaborationScope = { schoolId: number; schoolYearId: number; runId: number };

async function requestCollaborationTicket(accessToken: string, scope: CollaborationScope): Promise<string | null> {
	const apiBase = runtimeEnv?.VITE_ATLAS_API ?? '/api/v1';
	const url = `${apiBase.replace(/\/$/, '')}/room-preferences/collaboration/ticket`;
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(scope),
		});
		if (!response.ok) return null;
		const body = await response.json() as { ticket?: unknown };
		return typeof body.ticket === 'string' ? body.ticket : null;
	} catch {
		return null;
	}
}

function resolveWsBaseUrl(): string {
	const envBase = runtimeEnv?.VITE_ATLAS_API;
	if (envBase && /^https?:\/\//i.test(envBase)) {
		const httpUrl = new URL(envBase);
		httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
		httpUrl.pathname = `${httpUrl.pathname.replace(/\/$/, '')}${WS_PATH}`;
		httpUrl.search = '';
		return httpUrl.toString();
	}

	const locationUrl = new URL(window.location.href);
	locationUrl.protocol = locationUrl.protocol === 'https:' ? 'wss:' : 'ws:';
	locationUrl.pathname = `/api/v1${WS_PATH}`;
	locationUrl.search = '';
	return locationUrl.toString();
}

export function createRoomPreferenceCollaborationSocket(params: {
	accessToken: string;
	scope: CollaborationScope;
	onEvent: (event: CollaborationEvent) => void;
}): CollaborationSocket {
	let socket: WebSocket | null = null;
	let closed = false;
	let heartbeatInterval: number | null = null;
	let selectionThrottleTimer: number | null = null;
	let pendingSelection: CollaborationSelection | null = null;

	const flushSelection = () => {
		if (!pendingSelection || socket?.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify({ type: 'collab.selection', selection: pendingSelection }));
		pendingSelection = null;
	};

	const onSocketClose = () => {
		if (heartbeatInterval != null) {
			window.clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}
		if (selectionThrottleTimer != null) {
			window.clearTimeout(selectionThrottleTimer);
			selectionThrottleTimer = null;
		}
		params.onEvent({ type: 'close' });
	};

	const attachSocket = (createdSocket: WebSocket) => {
		socket = createdSocket;
		socket.addEventListener('open', () => {
			if (closed) { socket?.close(); return; }
			params.onEvent({ type: 'open' });
			heartbeatInterval = window.setInterval(() => {
				if (socket?.readyState !== WebSocket.OPEN) return;
				socket.send(JSON.stringify({ type: 'collab.heartbeat' }));
			}, 10000);
		});
		socket.addEventListener('close', onSocketClose);
		socket.addEventListener('message', (raw) => {
		try {
			const payload = JSON.parse(String(raw.data)) as { type?: string; [key: string]: unknown };
			switch (payload.type) {
				case 'collab.connected':
					params.onEvent({ type: 'connected', payload: payload as unknown as CollaborationConnectedPayload });
					break;
				case 'collab.snapshot':
					params.onEvent({ type: 'snapshot', payload: payload as unknown as CollaborationSnapshotPayload });
					break;
				case 'collab.presence.upsert':
					params.onEvent({ type: 'presence-upsert', payload: (payload as { presence: CollaborationPresence }).presence });
					break;
				case 'collab.presence.leave':
					params.onEvent({ type: 'presence-leave', payload: { connectionId: String((payload as { connectionId?: unknown }).connectionId ?? '') } });
					break;
				case 'collab.selection':
					params.onEvent({ type: 'selection', payload: payload as unknown as CollaborationSelectionPayload });
					break;
				case 'collab.room-request.event':
					params.onEvent({ type: 'room-request-event', payload: (payload as { event: RoomPreferenceEvent }).event });
					break;
				case 'collab.timetable.event':
					params.onEvent({ type: 'timetable-event', payload: payload.event as any });
					break;
				case 'collab.error':
					params.onEvent({ type: 'error', payload: { code: String((payload as { code?: unknown }).code ?? 'COLLAB_ERROR'), message: String((payload as { message?: unknown }).message ?? 'Collaboration error') } });
					break;
				default:
					break;
			}
		} catch {
			// Ignore malformed websocket payloads.
		}
		});
	};

	void requestCollaborationTicket(params.accessToken, params.scope).then((ticket) => {
		if (!ticket || closed) {
			if (!closed) params.onEvent({ type: 'error', payload: { code: 'TICKET_ISSUE_FAILED', message: 'Unable to open timetable collaboration right now.' } });
			return;
		}
		const wsUrl = new URL(resolveWsBaseUrl());
		wsUrl.searchParams.set('ticket', ticket);
		wsUrl.searchParams.set('schoolId', String(params.scope.schoolId));
		wsUrl.searchParams.set('schoolYearId', String(params.scope.schoolYearId));
		wsUrl.searchParams.set('runId', String(params.scope.runId));
		attachSocket(new WebSocket(wsUrl.toString()));
	});

	return {
		join: (scope) => {
			if (!socket || socket.readyState !== WebSocket.OPEN) return;
			socket.send(JSON.stringify({ type: 'collab.join', ...scope }));
		},
		sendSelection: (selection) => {
			pendingSelection = selection;
			if (selectionThrottleTimer != null) {
				return;
			}
			selectionThrottleTimer = window.setTimeout(() => {
				selectionThrottleTimer = null;
				flushSelection();
			}, 120);
		},
		updateViewMode: (viewMode) => {
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
			socket.send(JSON.stringify({ type: 'collab.view-mode', viewMode }));
		},
		close: () => {
			if (heartbeatInterval != null) {
				window.clearInterval(heartbeatInterval);
				heartbeatInterval = null;
			}
			if (selectionThrottleTimer != null) {
				window.clearTimeout(selectionThrottleTimer);
				selectionThrottleTimer = null;
			}
			closed = true;
			socket?.close();
		},
	};
}
