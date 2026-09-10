import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { getPreferredAccessToken } from '@/lib/auth';

type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';
type NotificationDomain =
	| 'preference'
	| 'room-request'
	| 'timetable'
	| 'published-schedule'
	| 'generation'
	| 'integration';

export type NotificationStreamEvent = {
	id: number;
	type: string;
	domain: NotificationDomain;
	severity: NotificationSeverity;
	message: string;
	schoolId: number;
	schoolYearId: number;
	metadata?: Record<string, unknown>;
};

const GLOBAL_TOAST_DOMAINS = new Set<NotificationDomain>([
	'timetable',
	'published-schedule',
	'generation',
	'integration',
]);
const NOTIFICATION_EVENT_TYPES = new Set<string>([
	'GENERATION_RUN_STARTED', 'GENERATION_RUN_COMPLETED', 'GENERATION_RUN_FAILED',
	'SUBJECT_SYNC_DEGRADED', 'SECTION_SYNC_DEGRADED', 'FACULTY_SYNC_COMPLETED',
	'FACULTY_SYNC_FAILED', 'SECTION_SYNC_COMPLETED', 'SUBJECT_OFFERINGS_SYNC_COMPLETED',
	'COHORT_SYNC_COMPLETED', 'COHORT_SYNC_FAILED', 'TIMETABLE_SETUP_SYNC_COMPLETED',
	'ROLLOVER_SYNC_COMPLETED', 'ROLLOVER_AUTO_SYNC_COMPLETED', 'ROLLOVER_ATTENTION_REQUIRED',
	'ROLLOVER_ARCHIVE_SYNC_COMPLETED', 'TEST_YEAR_RECOVERY_COMPLETED', 'SCHOOL_YEAR_ARCHIVED',
	'SERVER_FATAL_ERROR', 'DUMMY_YEAR_RESET_COMPLETED', 'DUMMY_YEAR_RESET_PREVIEWED',
	'TIMETABLE_EDIT_COMMITTED', 'TIMETABLE_REVERTED', 'SCHEDULE_PUBLISHED', 'SCHEDULE_REVISED',
]);
const ROLLOVER_COMPLETION_TYPES = new Set<string>([
	'ROLLOVER_SYNC_COMPLETED',
	'ROLLOVER_AUTO_SYNC_COMPLETED',
	'ROLLOVER_ARCHIVE_SYNC_COMPLETED',
	'TEST_YEAR_RECOVERY_COMPLETED',
	'DUMMY_YEAR_RESET_COMPLETED',
]);
const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_DEDUPED_EVENTS = 500;

export function isRolloverCompletionEvent(event: Pick<NotificationStreamEvent, 'type' | 'domain'>): boolean {
	return event.domain === 'integration' && ROLLOVER_COMPLETION_TYPES.has(event.type);
}

/**
 * Bounded, school-scoped delivery deduper. School id is part of the key so the
 * same event id delivered by two scoped streams (year + school) is toasted and
 * applied exactly once.
 */
export function createEventDeduper(maxEntries: number = MAX_DEDUPED_EVENTS) {
	const seen = new Set<string>();
	return {
		shouldDeliver(event: Pick<NotificationStreamEvent, 'schoolId' | 'id'>): boolean {
			const key = `${event.schoolId}:${event.id}`;
			if (seen.has(key)) return false;
			seen.add(key);
			if (seen.size > maxEntries) {
				const oldest = seen.values().next().value as string | undefined;
				if (oldest) seen.delete(oldest);
			}
			return true;
		},
		size(): number {
			return seen.size;
		},
	};
}

function notify(event: NotificationStreamEvent) {
	if (!GLOBAL_TOAST_DOMAINS.has(event.domain)) return;
	const options = { id: `notification-${event.schoolId}-${event.id}` };
	switch (event.severity) {
		case 'success': toast.success(event.message, options); break;
		case 'warning': toast.warning(event.message, options); break;
		case 'error': toast.error(event.message, options); break;
		default: toast.info(event.message, options); break;
	}
}

/** Parse SSE frames and preserve the final incomplete frame. */
export function parseSseFrames(buffer: string): { events: Array<{ id: number | null; event: string; data: string }>; remainder: string } {
	const events: Array<{ id: number | null; event: string; data: string }> = [];
	const frames = buffer.replaceAll('\r\n', '\n').split('\n\n');
	const remainder = frames.pop() ?? '';
	for (const frame of frames) {
		if (!frame.trim()) continue;
		let id: number | null = null;
		let eventType = 'message';
		const dataLines: string[] = [];
		for (const line of frame.split('\n')) {
			if (line.startsWith('id: ')) {
				const parsed = Number(line.slice(4));
				if (Number.isFinite(parsed)) id = parsed;
			} else if (line.startsWith('event: ')) {
				eventType = line.slice(7).trim();
			} else if (line.startsWith('data: ')) {
				dataLines.push(line.slice(6));
			}
		}
		if (dataLines.length > 0) events.push({ id, event: eventType, data: dataLines.join('\n') });
	}
	return { events, remainder };
}

function useSseConnection(params: {
	url: string | null;
	enabled: boolean;
	onEvent: (event: NotificationStreamEvent) => void;
}) {
	const lastEventIdRef = useRef<number | null>(null);
	const callbackRef = useRef(params.onEvent);
	callbackRef.current = params.onEvent;
	useEffect(() => {
		if (!params.enabled || !params.url) return;
		let cancelled = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let controller: AbortController | null = null;
		let backoffMs = INITIAL_BACKOFF_MS;
		const connect = async () => {
			const token = getPreferredAccessToken();
			if (!token || cancelled) return;
			controller = new AbortController();
			const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' };
			if (lastEventIdRef.current) headers['Last-Event-Id'] = String(lastEventIdRef.current);
			try {
				const response = await fetch(params.url!, {
					method: 'GET', headers, credentials: 'include', signal: controller.signal,
				});
				if (response.status === 401 || response.status === 403) return;
				if (!response.ok) throw new Error(`SSE connect failed: ${response.status}`);
				if (!response.body) throw new Error('SSE response has no body');
				backoffMs = INITIAL_BACKOFF_MS;
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';
				while (!cancelled) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const parsed = parseSseFrames(buffer);
					buffer = parsed.remainder;
					for (const frame of parsed.events) {
						if (frame.id !== null) lastEventIdRef.current = frame.id;
						if (!NOTIFICATION_EVENT_TYPES.has(frame.event)) continue;
						try { callbackRef.current(JSON.parse(frame.data) as NotificationStreamEvent); } catch { /* malformed frame */ }
					}
				}
			} catch (error: unknown) {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				if (cancelled) return;
			} finally {
				if (!cancelled) {
					reconnectTimer = setTimeout(() => {
						backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
						void connect();
					}, backoffMs);
				}
			}
		};
		void connect();
		return () => {
			cancelled = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			controller?.abort();
		};
	}, [params.enabled, params.url]);
}

export function useNotificationStream(params: {
	schoolId: number | null;
	schoolYearId: number | null;
	enabled: boolean;
	schoolEventsEnabled?: boolean;
	onEvent?: (event: NotificationStreamEvent) => void;
}) {
	const deduperRef = useRef(createEventDeduper());
	const callbackRef = useRef(params.onEvent);
	callbackRef.current = params.onEvent;
	const apiBase = import.meta.env.VITE_ATLAS_API ?? '/api/v1';
	const yearUrl = params.schoolId && params.schoolYearId
		? `${apiBase}/notifications/${params.schoolId}/${params.schoolYearId}/events`
		: null;
	const schoolUrl = params.schoolId ? `${apiBase}/notifications/${params.schoolId}/events` : null;
	const deliver = (event: NotificationStreamEvent) => {
		if (!deduperRef.current.shouldDeliver(event)) return;
		notify(event);
		callbackRef.current?.(event);
	};
	useSseConnection({ url: yearUrl, enabled: params.enabled, onEvent: deliver });
	useSseConnection({ url: schoolUrl, enabled: params.enabled && params.schoolEventsEnabled === true, onEvent: deliver });
}
