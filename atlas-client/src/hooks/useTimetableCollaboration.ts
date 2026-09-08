import { useEffect, useRef, useState } from 'react';

import { getPreferredAccessToken } from '@/lib/auth';
import {
	createRoomPreferenceCollaborationSocket,
	type CollaborationSocket,
} from '@/lib/roomPreferenceCollaboration';
import type { CollaborationPresence, CollaborationSelection, ScheduledEntry } from '@/types';

type TimetableCollaborationOptions = {
	schoolId: number | null;
	schoolYearId: number | null;
	runId: number | null;
	selectedEntry: ScheduledEntry | null;
	onTimetableEvent: () => void;
};

type TimetableCollaborationHookRuntime = {
	useEffect: typeof useEffect;
	useRef: typeof useRef;
	useState: typeof useState;
};

type TimetableCollaborationDependencies = {
	getAccessToken: typeof getPreferredAccessToken;
	createSocket: CollaborationSocketFactory;
};

type CollaborationSocketFactory = typeof createRoomPreferenceCollaborationSocket;

export type TimetableCollaborationConnection = {
	readonly schoolId: number;
	readonly schoolYearId: number;
	readonly runId: number;
	readonly socket: CollaborationSocket;
	readonly active: () => boolean;
	close: () => void;
};

type CreateTimetableCollaborationConnectionOptions = {
	schoolId: number | null;
	schoolYearId: number | null;
	runId: number | null;
	accessToken: string | null;
	createSocket?: CollaborationSocketFactory;
	onEvent: Parameters<CollaborationSocketFactory>[0]['onEvent'];
	onReset: () => void;
};

const isPositiveInteger = (value: number | null): value is number => (
	typeof value === 'number' && Number.isInteger(value) && value > 0
);

export function createTimetableCollaborationConnection({
	schoolId,
	schoolYearId,
	runId,
	accessToken,
	createSocket = createRoomPreferenceCollaborationSocket,
	onEvent,
	onReset,
}: CreateTimetableCollaborationConnectionOptions): TimetableCollaborationConnection | null {
	if (!isPositiveInteger(schoolId) || !isPositiveInteger(schoolYearId) || !isPositiveInteger(runId) || !accessToken) return null;

	const resolvedSchoolId = schoolId;
	let isActive = true;
	let socket: CollaborationSocket;
	socket = createSocket({
		accessToken,
		onEvent: (event) => {
			if (!isActive) return;
			if (event.type === 'open') {
				socket.join({ schoolId: resolvedSchoolId, schoolYearId, runId, viewMode: 'SCHEDULER_REVIEW' });
			}
			onEvent(event);
		},
	});

	return {
		schoolId: resolvedSchoolId,
		schoolYearId,
		runId,
		socket,
		active: () => isActive,
		close: () => {
			if (!isActive) return;
			isActive = false;
			socket.close();
			onReset();
		},
	};
}

export function sendTimetableCollaborationSelection(
	connection: TimetableCollaborationConnection | null,
	entryId: string,
): boolean {
	if (!connection?.active() || !isPositiveInteger(connection.schoolId) || !isPositiveInteger(connection.schoolYearId) || !isPositiveInteger(connection.runId)) return false;
	connection.socket.sendSelection({
		schoolId: connection.schoolId,
		schoolYearId: connection.schoolYearId,
		runId: connection.runId,
		entryId,
		source: 'SESSION',
	});
	return true;
}

export function useTimetableCollaboration({
	schoolId,
	schoolYearId,
	runId,
	selectedEntry,
	onTimetableEvent,
}: TimetableCollaborationOptions,
	runtime: TimetableCollaborationHookRuntime = { useEffect, useRef, useState },
	dependencies: TimetableCollaborationDependencies = {
		getAccessToken: getPreferredAccessToken,
		createSocket: createRoomPreferenceCollaborationSocket,
	},
) {
	const [connected, setConnected] = runtime.useState(false);
	const [presence, setPresence] = runtime.useState<CollaborationPresence[]>([]);
	const [remoteSelections, setRemoteSelections] = runtime.useState<Record<string, CollaborationSelection>>({});
	const [lastError, setLastError] = runtime.useState<string | null>(null);
	const socketRef = runtime.useRef<CollaborationSocket | null>(null);
	const connectionRef = runtime.useRef<TimetableCollaborationConnection | null>(null);
	const selfConnectionIdRef = runtime.useRef<string | null>(null);
	const lastSelectionSentAtRef = runtime.useRef(0);
	const pendingSelectionTimerRef = runtime.useRef<ReturnType<typeof setTimeout> | null>(null);
	const accessToken = dependencies.getAccessToken();

	runtime.useEffect(() => {
		const connection = createTimetableCollaborationConnection({
			schoolId,
			schoolYearId,
			runId,
			accessToken,
			createSocket: dependencies.createSocket,
			onEvent: (event) => {
				if (event.type === 'connected') {
					selfConnectionIdRef.current = event.payload.connectionId;
					setLastError(null);
					return;
				}
				if (event.type === 'open') {
					setConnected(true);
					setLastError(null);
					return;
				}
				if (event.type === 'snapshot') {
					const selfId = selfConnectionIdRef.current;
					setPresence(event.payload.presence.filter((item) => item.connectionId !== selfId));
					setRemoteSelections({});
					return;
				}
				if (event.type === 'presence-upsert') {
					if (event.payload.connectionId === selfConnectionIdRef.current) return;
					setPresence((current) => [
						...current.filter((item) => item.connectionId !== event.payload.connectionId),
						event.payload,
					]);
					return;
				}
				if (event.type === 'presence-leave') {
					setPresence((current) => current.filter((item) => item.connectionId !== event.payload.connectionId));
					setRemoteSelections((current) => {
						const next = { ...current };
						delete next[event.payload.connectionId];
						return next;
					});
					return;
				}
				if (event.type === 'selection') {
					if (event.payload.presence.connectionId === selfConnectionIdRef.current) return;
					setRemoteSelections((current) => ({
						...current,
						[event.payload.presence.connectionId]: event.payload.selection,
					}));
					return;
				}
				if (event.type === 'timetable-event') {
					onTimetableEvent();
					return;
				}
				if (event.type === 'error') {
					setLastError(event.payload.message);
					return;
				}
				if (event.type === 'close') setConnected(false);
			},
			onReset: () => {
				setConnected(false);
				setPresence([]);
				setRemoteSelections({});
				setLastError(null);
				selfConnectionIdRef.current = null;
				lastSelectionSentAtRef.current = 0;
				if (pendingSelectionTimerRef.current) {
					clearTimeout(pendingSelectionTimerRef.current);
					pendingSelectionTimerRef.current = null;
				}
			},
		});
		if (!connection) return;

		connectionRef.current = connection;
		socketRef.current = connection.socket;
		return () => {
			connection.close();
			if (connectionRef.current === connection) connectionRef.current = null;
			if (socketRef.current === connection.socket) socketRef.current = null;
			if (pendingSelectionTimerRef.current) {
				clearTimeout(pendingSelectionTimerRef.current);
				pendingSelectionTimerRef.current = null;
			}
		};
	}, [accessToken, dependencies.createSocket, onTimetableEvent, runId, schoolId, schoolYearId]);

	runtime.useEffect(() => {
		if (!connected || !connectionRef.current || !selectedEntry) return;
		const send = () => {
			if (!sendTimetableCollaborationSelection(connectionRef.current, selectedEntry.entryId)) return;
			lastSelectionSentAtRef.current = Date.now();
			pendingSelectionTimerRef.current = null;
		};
		const elapsed = Date.now() - lastSelectionSentAtRef.current;
		if (elapsed >= 100) {
			if (pendingSelectionTimerRef.current) {
				clearTimeout(pendingSelectionTimerRef.current);
				pendingSelectionTimerRef.current = null;
			}
			send();
			return;
		}
		if (pendingSelectionTimerRef.current) clearTimeout(pendingSelectionTimerRef.current);
		pendingSelectionTimerRef.current = setTimeout(send, 100 - elapsed);
		return () => {
			if (pendingSelectionTimerRef.current) {
				clearTimeout(pendingSelectionTimerRef.current);
				pendingSelectionTimerRef.current = null;
			}
		};
	}, [connected, runId, schoolId, schoolYearId, selectedEntry?.entryId]);

	return { connected, presence, remoteSelections, lastError };
}
