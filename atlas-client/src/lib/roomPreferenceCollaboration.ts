import type { CollaborationPresence, CollaborationSelection, RoomPreferenceEvent } from '@/types';

const WS_PATH = '/room-preferences/collaboration/ws';

export type CollaborationConnectedPayload = {
	connectionId: string;
	user: {
		userId: number;
		role: string;
		email: string | null;
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
	presence: Pick<CollaborationPresence, 'connectionId' | 'userId' | 'role' | 'email' | 'viewMode' | 'lastActive'>;
};

export type CollaborationEvent =
	| { type: 'connected'; payload: CollaborationConnectedPayload }
	| { type: 'snapshot'; payload: CollaborationSnapshotPayload }
	| { type: 'presence-upsert'; payload: CollaborationPresence }
	| { type: 'presence-leave'; payload: { connectionId: string } }
	| { type: 'selection'; payload: CollaborationSelectionPayload }
	| { type: 'room-request-event'; payload: RoomPreferenceEvent }
	| { type: 'error'; payload: { code: string; message: string } }
	| { type: 'open' }
	| { type: 'close' };

export type CollaborationSocket = {
	join: (scope: { schoolId: number; schoolYearId: number; runId: number; viewMode: CollaborationPresence['viewMode'] }) => void;
	sendSelection: (selection: CollaborationSelection) => void;
	updateViewMode: (viewMode: CollaborationPresence['viewMode']) => void;
	close: () => void;
};

function resolveWsBaseUrl(): string {
	const envBase = import.meta.env.VITE_ATLAS_API as string | undefined;
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
	onEvent: (event: CollaborationEvent) => void;
}): CollaborationSocket {
	const wsUrl = new URL(resolveWsBaseUrl());
	wsUrl.searchParams.set('accessToken', params.accessToken);

	const socket = new WebSocket(wsUrl.toString());
	let heartbeatInterval: number | null = null;
	let selectionThrottleTimer: number | null = null;
	let pendingSelection: CollaborationSelection | null = null;

	const flushSelection = () => {
		if (!pendingSelection || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify({ type: 'collab.selection', selection: pendingSelection }));
		pendingSelection = null;
	};

	socket.addEventListener('open', () => {
		params.onEvent({ type: 'open' });
		heartbeatInterval = window.setInterval(() => {
			if (socket.readyState !== WebSocket.OPEN) return;
			socket.send(JSON.stringify({ type: 'collab.heartbeat' }));
		}, 10000);
	});

	socket.addEventListener('close', () => {
		if (heartbeatInterval != null) {
			window.clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}
		if (selectionThrottleTimer != null) {
			window.clearTimeout(selectionThrottleTimer);
			selectionThrottleTimer = null;
		}
		params.onEvent({ type: 'close' });
	});

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

	return {
		join: (scope) => {
			if (socket.readyState !== WebSocket.OPEN) return;
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
			if (socket.readyState !== WebSocket.OPEN) return;
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
			socket.close();
		},
	};
}
