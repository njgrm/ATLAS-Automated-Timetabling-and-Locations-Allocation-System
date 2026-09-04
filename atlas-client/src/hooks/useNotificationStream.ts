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

type NotificationStreamEvent = {
	id: number;
	type: string;
	domain: NotificationDomain;
	severity: NotificationSeverity;
	message: string;
	metadata?: Record<string, unknown>;
};

const GLOBAL_TOAST_DOMAINS = new Set<NotificationDomain>([
	'timetable',
	'published-schedule',
	'generation',
	'integration',
]);

const NOTIFICATION_EVENT_TYPES = [
	'GENERATION_RUN_STARTED',
	'GENERATION_RUN_COMPLETED',
	'GENERATION_RUN_FAILED',
	'SUBJECT_SYNC_DEGRADED',
	'SECTION_SYNC_DEGRADED',
	'FACULTY_SYNC_COMPLETED',
	'FACULTY_SYNC_FAILED',
	'SECTION_SYNC_COMPLETED',
	'SUBJECT_OFFERINGS_SYNC_COMPLETED',
	'COHORT_SYNC_COMPLETED',
	'COHORT_SYNC_FAILED',
	'TIMETABLE_SETUP_SYNC_COMPLETED',
	'ROLLOVER_SYNC_COMPLETED',
	'ROLLOVER_AUTO_SYNC_COMPLETED',
	'ROLLOVER_ATTENTION_REQUIRED',
	'ROLLOVER_ARCHIVE_SYNC_COMPLETED',
	'SCHOOL_YEAR_ARCHIVED',
	'SERVER_FATAL_ERROR',
	'DUMMY_YEAR_RESET_COMPLETED',
	'DUMMY_YEAR_RESET_PREVIEWED',
	'TIMETABLE_EDIT_COMMITTED',
	'TIMETABLE_REVERTED',
	'SCHEDULE_PUBLISHED',
	'SCHEDULE_REVISED',
] as const;

const NOTIFICATION_EVENT_TYPE_SET = new Set<string>(NOTIFICATION_EVENT_TYPES);

const INITIAL_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 30_000;

function notify(event: NotificationStreamEvent) {
	if (!GLOBAL_TOAST_DOMAINS.has(event.domain)) return;
	const options = { id: `notification-${event.id}` };
	switch (event.severity) {
		case 'success':
			toast.success(event.message, options);
			break;
		case 'warning':
			toast.warning(event.message, options);
			break;
		case 'error':
			toast.error(event.message, options);
			break;
		default:
			toast.info(event.message, options);
			break;
	}
}

/**
 * Parse SSE frames from a text buffer.
 * Returns parsed events and the remaining incomplete buffer.
 */
export function parseSseFrames(buffer: string): { events: Array<{ id: number | null; event: string; data: string }>; remainder: string } {
	const events: Array<{ id: number | null; event: string; data: string }> = [];
	const frames = buffer.split('\n\n');
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
			} else if (line.startsWith(':')) {
				// Heartbeat comment — ignore
			}
		}

		if (dataLines.length > 0) {
			events.push({ id, event: eventType, data: dataLines.join('\n') });
		}
	}

	return { events, remainder };
}

export function useNotificationStream(params: {
	schoolId: number;
	schoolYearId: number | null;
	enabled: boolean;
}) {
	const lastEventIdRef = useRef<number | null>(null);
	const abortRef = useRef<AbortController | null>(null);
	const backoffRef = useRef(INITIAL_BACKOFF_MS);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!params.enabled || !params.schoolYearId) return;

		let cancelled = false;

		const connect = async () => {
			const token = getPreferredAccessToken();
			if (!token) return;

			const apiBase = import.meta.env.VITE_ATLAS_API ?? '/api/v1';
			const url = `${apiBase}/notifications/${params.schoolId}/${params.schoolYearId}/events`;

			const controller = new AbortController();
			abortRef.current = controller;

			const headers: Record<string, string> = {
				'Authorization': `Bearer ${token}`,
				'Accept': 'text/event-stream',
			};
			if (lastEventIdRef.current) {
				headers['Last-Event-Id'] = String(lastEventIdRef.current);
			}

			try {
				const response = await fetch(url, {
					method: 'GET',
					headers,
					credentials: 'include',
					signal: controller.signal,
				});

				if (!response.ok) {
					// Auth failure (401/403) — stop reconnecting silently
					if (response.status === 401 || response.status === 403) {
						return;
					}
					throw new Error(`SSE connect failed: ${response.status}`);
				}

				if (!response.body) {
					throw new Error('SSE response has no body');
				}

				if (cancelled) return;

				// Successful connection — reset backoff
				backoffRef.current = INITIAL_BACKOFF_MS;

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				while (!cancelled) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const { events, remainder } = parseSseFrames(buffer);
					buffer = remainder;

					for (const frame of events) {
						// Update lastEventId for resume
						if (frame.id !== null) {
							lastEventIdRef.current = frame.id;
						}

						// Only process notification event types
						if (!NOTIFICATION_EVENT_TYPE_SET.has(frame.event)) continue;

						try {
							const event = JSON.parse(frame.data) as NotificationStreamEvent;
							notify(event);
						} catch {
							// Ignore malformed notification frames
						}
					}
				}
			} catch (err: unknown) {
				// AbortError = intentional disconnect (component unmount / token change)
				if (err instanceof DOMException && err.name === 'AbortError') return;
				if (cancelled) return;
				// Transient error — will reconnect with backoff below
			} finally {
				if (!cancelled) {
					// Exponential backoff before reconnect
					reconnectTimerRef.current = setTimeout(() => {
						if (!cancelled) {
							backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
							connect();
						}
					}, backoffRef.current);
				}
			}
		};

		connect();

		return () => {
			cancelled = true;
			if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
			abortRef.current?.abort();
		};
	}, [params.enabled, params.schoolId, params.schoolYearId]);
}
