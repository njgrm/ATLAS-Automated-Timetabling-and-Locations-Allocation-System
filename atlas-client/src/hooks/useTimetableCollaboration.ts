import { useEffect, useRef, useState } from 'react';

import { getPreferredAccessToken } from '@/lib/auth';
import {
	createRoomPreferenceCollaborationSocket,
	type CollaborationSocket,
} from '@/lib/roomPreferenceCollaboration';
import type { CollaborationPresence, CollaborationSelection, ScheduledEntry } from '@/types';

type TimetableCollaborationOptions = {
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	selectedEntry: ScheduledEntry | null;
	onTimetableEvent: () => void;
};

export function useTimetableCollaboration({
	schoolId,
	schoolYearId,
	runId,
	selectedEntry,
	onTimetableEvent,
}: TimetableCollaborationOptions) {
	const [connected, setConnected] = useState(false);
	const [presence, setPresence] = useState<CollaborationPresence[]>([]);
	const [remoteSelections, setRemoteSelections] = useState<Record<string, CollaborationSelection>>({});
	const [lastError, setLastError] = useState<string | null>(null);
	const socketRef = useRef<CollaborationSocket | null>(null);
	const selfConnectionIdRef = useRef<string | null>(null);
	const lastSelectionSentAtRef = useRef(0);
	const pendingSelectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!schoolYearId || !runId || Number.isNaN(runId)) return;
		const token = getPreferredAccessToken();
		if (!token) return;

		const socket = createRoomPreferenceCollaborationSocket({
			accessToken: token,
			onEvent: (event) => {
				if (event.type === 'connected') {
					selfConnectionIdRef.current = event.payload.connectionId;
					setLastError(null);
					return;
				}
				if (event.type === 'open') {
					setConnected(true);
					setLastError(null);
					socket.join({ schoolId, schoolYearId, runId, viewMode: 'SCHEDULER_REVIEW' });
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
		});

		socketRef.current = socket;
		return () => {
			socket.close();
			if (socketRef.current === socket) socketRef.current = null;
			if (pendingSelectionTimerRef.current) {
				clearTimeout(pendingSelectionTimerRef.current);
				pendingSelectionTimerRef.current = null;
			}
			setConnected(false);
			setPresence([]);
			setRemoteSelections({});
		};
	}, [onTimetableEvent, runId, schoolId, schoolYearId]);

	useEffect(() => {
		if (!connected || !socketRef.current || !selectedEntry || !runId || !schoolYearId) return;
		const selection = {
			schoolId,
			schoolYearId,
			runId,
			entryId: selectedEntry.entryId,
			source: 'SESSION',
		} as const;
		const send = () => {
			if (!socketRef.current) return;
			socketRef.current.sendSelection(selection);
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
