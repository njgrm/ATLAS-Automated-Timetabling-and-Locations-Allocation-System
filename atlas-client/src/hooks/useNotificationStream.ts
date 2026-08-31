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
	'DUMMY_YEAR_RESET_COMPLETED',
	'DUMMY_YEAR_RESET_PREVIEWED',
	'TIMETABLE_EDIT_COMMITTED',
	'TIMETABLE_REVERTED',
	'SCHEDULE_PUBLISHED',
	'SCHEDULE_REVISED',
] as const;

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

export function useNotificationStream(params: {
	schoolId: number;
	schoolYearId: number | null;
	enabled: boolean;
}) {
	const lastEventIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (!params.enabled || !params.schoolYearId) return;
		const token = getPreferredAccessToken();
		if (!token) return;

		const apiBase = import.meta.env.VITE_ATLAS_API ?? '/api/v1';
		const search = new URLSearchParams();
		if (lastEventIdRef.current) {
			search.set('lastEventId', String(lastEventIdRef.current));
		}
		const query = search.toString();
		const source = new EventSource(
			`${apiBase}/notifications/${params.schoolId}/${params.schoolYearId}/events${query ? `?${query}` : ''}`,
			{ withCredentials: true },
		);

		const handleNotification = (raw: MessageEvent<string>) => {
			try {
				const event = JSON.parse(raw.data) as NotificationStreamEvent;
				if (Number.isInteger(event.id)) {
					lastEventIdRef.current = event.id;
				}
				notify(event);
			} catch {
				// Ignore malformed notification frames; the stream will continue.
			}
		};

		for (const eventType of NOTIFICATION_EVENT_TYPES) {
			source.addEventListener(eventType, handleNotification as EventListener);
		}

		source.onerror = () => {
			// EventSource reconnects automatically; avoid noisy connection toasts.
		};

		return () => {
			for (const eventType of NOTIFICATION_EVENT_TYPES) {
				source.removeEventListener(eventType, handleNotification as EventListener);
			}
			source.close();
		};
	}, [params.enabled, params.schoolId, params.schoolYearId]);
}
