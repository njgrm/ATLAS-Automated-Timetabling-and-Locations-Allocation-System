import { useCallback, useEffect, useRef, useState } from 'react';

import atlasApi from '@/lib/api';
import {
	getAtlasTokenEpochVersion,
	getPreferredAccessToken,
	subscribeAtlasTokenEpoch,
} from '@/lib/auth';
import { resolveActorSchoolId } from '@/lib/settings';

/**
 * NOTIFICATION-INBOX-C01 (D4) — durable inbox client binding.
 *
 * Bound to the authenticated token epoch and the actor school the same way
 * the other actor-scoped hooks are: no school-1 default, zero dispatch while
 * the session is absent or the school unresolved, and late responses from an
 * obsolete epoch are discarded. The live SSE stream keeps its job
 * (`useNotificationStream` is untouched); a stream event only invalidates the
 * inbox query via the `atlas:notification-inbox-invalidated` window event so
 * the bell updates live without polling.
 */

export const NOTIFICATION_INBOX_INVALIDATED_EVENT = 'atlas:notification-inbox-invalidated';

export function notifyNotificationInboxInvalidated(): void {
	window.dispatchEvent(new CustomEvent(NOTIFICATION_INBOX_INVALIDATED_EVENT));
}

export type InboxNotification = {
	id: number;
	type: string;
	title: string;
	body: string | null;
	domain: string;
	severity: string;
	resourceType: string | null;
	resourceId: string | null;
	read: boolean;
	createdAt: string;
};

/**
 * Pure routing target for an inbox item. Returns null when the item carries
 * no resource pointer — the bell renders such items inert instead of a dead
 * link that pretends to navigate.
 */
export function resolveNotificationRoute(
	resourceType: string | null | undefined,
	resourceId: string | null | undefined,
): string | null {
	if (!resourceType || !resourceId) return null;
	const id = resourceId.trim();
	if (!id) return null;
	switch (resourceType) {
		case 'timetable':
		case 'generation':
			return `/timetable?runId=${encodeURIComponent(id)}`;
		case 'published-schedule':
			return `/schedules?revision=${encodeURIComponent(id)}`;
		// D6 — the retired teacher-portal deep links (`/preferences`, `/rooms`)
		// are deleted; those resource types are inert (null) rather than a dead
		// link that pretends to navigate.
		case 'integration':
			return `/admin/year-setup?event=${encodeURIComponent(id)}`;
		default:
			return null;
	}
}

export function useNotificationInbox() {
	const [items, setItems] = useState<InboxNotification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [refreshNonce, setRefreshNonce] = useState(0);
	const sequenceRef = useRef(0);

	const refresh = useCallback(() => {
		setRefreshNonce((nonce) => nonce + 1);
	}, []);

	useEffect(() => {
		let disposed = false;
		const requestSequence = ++sequenceRef.current;
		const token = getPreferredAccessToken();
		const epoch = getAtlasTokenEpochVersion();

		const isCurrent = () =>
			!disposed
			&& requestSequence === sequenceRef.current
			&& getPreferredAccessToken() === token
			&& getAtlasTokenEpochVersion() === epoch;

		if (!token) {
			setItems([]);
			setUnreadCount(0);
			setLoading(false);
			return () => {
				disposed = true;
			};
		}

		setLoading(true);
		void (async () => {
			const schoolId = await resolveActorSchoolId();
			// Late resolution from an obsolete epoch is discarded — never
			// dispatched, never applied.
			if (!isCurrent()) return;
			if (typeof schoolId !== 'number' || !Number.isInteger(schoolId) || schoolId <= 0) {
				setItems([]);
				setUnreadCount(0);
				setLoading(false);
				return;
			}
			try {
				const [listResponse, countResponse] = await Promise.all([
					atlasApi.get<{ items: InboxNotification[] }>('/notification-inbox/', {
						params: { limit: 20 },
					}),
					atlasApi.get<{ count: number }>('/notification-inbox/unread-count'),
				]);
				if (!isCurrent()) return;
				setItems(Array.isArray(listResponse.data?.items) ? listResponse.data.items : []);
				setUnreadCount(
					typeof countResponse.data?.count === 'number' ? countResponse.data.count : 0,
				);
			} catch {
				if (!isCurrent()) return;
				setItems([]);
				setUnreadCount(0);
			} finally {
				if (isCurrent()) setLoading(false);
			}
		})();

		return () => {
			disposed = true;
		};
	}, [refreshNonce]);

	useEffect(() => {
		// ACTOR-SCOPE: on ANY token mutation, synchronously drop the previous
		// actor's inbox before re-resolving, then refresh under the new epoch.
		const unsubscribe = subscribeAtlasTokenEpoch(() => {
			sequenceRef.current += 1;
			setItems([]);
			setUnreadCount(0);
			setLoading(false);
			setRefreshNonce((nonce) => nonce + 1);
		});
		const handleInvalidated = () => {
			setRefreshNonce((nonce) => nonce + 1);
		};
		window.addEventListener(NOTIFICATION_INBOX_INVALIDATED_EVENT, handleInvalidated);
		return () => {
			unsubscribe();
			window.removeEventListener(NOTIFICATION_INBOX_INVALIDATED_EVENT, handleInvalidated);
		};
	}, []);

	const markRead = useCallback(async (id: number) => {
		const token = getPreferredAccessToken();
		if (!token) return;
		await atlasApi.post(`/notification-inbox/${id}/read`);
		setItems((previous) => previous.map((item) => (item.id === id ? { ...item, read: true } : item)));
		setUnreadCount((previous) => Math.max(0, previous - 1));
	}, []);

	const markAllRead = useCallback(async () => {
		const token = getPreferredAccessToken();
		if (!token) return;
		await atlasApi.post('/notification-inbox/read-all');
		setItems((previous) => previous.map((item) => ({ ...item, read: true })));
		setUnreadCount(0);
	}, []);

	return { items, unreadCount, loading, markRead, markAllRead, refresh };
}
