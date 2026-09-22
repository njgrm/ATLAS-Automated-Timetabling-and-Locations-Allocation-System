import { hasPrivilegedRole } from '../middleware/authorize.js';
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import type { NotificationEvent } from './notification-events.service.js';

/**
 * NOTIFICATION-INBOX-C01 (D3) — durable persistence for the events the SSE
 * stream already carries.
 *
 * Recipient resolution mirrors the AIMS pattern (per-user inbox rows,
 * unread state) with ATLAS actor scope: every recipient is an active
 * `AtlasAuthAccount` in the event's own school, and writes are deduped by a
 * content-stable key so a repeated sync tick collapses to one row per actor.
 */

/** A single event must never be able to write an unbounded fan-out. */
export const NOTIFICATION_RECIPIENT_CAP = 200;

export type NotificationRecipientAccount = {
	id: number;
	schoolId: number;
	facultyId: number | null;
	role: string;
	isActive: boolean;
};

export type RecipientResolution = {
	/** Recipient actor ids. Empty when the event matches nobody or the cap refused. */
	ids: number[];
	/** True when the match set exceeded the cap and nothing was persisted for the event. */
	capped: boolean;
};

/**
 * D1b — the dedupe key is content-stable, not event-identity-stable. The
 * in-memory `NotificationEvent.id` and `timestamp` are deliberately excluded
 * so re-raising the same delta resolves to the same key.
 */
export function buildNotificationDedupeKey(input: {
	schoolId: number;
	schoolYearId: number | null | undefined;
	type: string;
	resourceType: string | null | undefined;
	resourceId: string | null | undefined;
	actorId: number;
}): string {
	return [
		input.schoolId,
		input.schoolYearId ?? 0,
		input.type,
		input.resourceType ?? '-',
		input.resourceId ?? '-',
		input.actorId,
	].join(':');
}

/**
 * Pure recipient core: filter an account set against the event audience.
 * Never returns an actor whose school differs from the event school, and
 * never returns an inactive account. Above the cap the whole event is
 * refused (`capped: true`, `ids: []`) — partial fan-outs would be dishonest.
 */
export function resolveRecipientIds(
	accounts: NotificationRecipientAccount[],
	event: Pick<NotificationEvent, 'schoolId' | 'audience' | 'facultyId' | 'facultyIds'>,
): RecipientResolution {
	const inSchool = accounts.filter(
		(account) => account.isActive && account.schoolId === event.schoolId,
	);
	let matched: NotificationRecipientAccount[];
	switch (event.audience) {
		case 'FACULTY': {
			const wanted = new Set<number>();
			if (event.facultyId != null) wanted.add(event.facultyId);
			for (const id of event.facultyIds ?? []) wanted.add(id);
			matched = wanted.size === 0
				? inSchool.filter((account) => account.facultyId != null)
				: inSchool.filter((account) => account.facultyId != null && wanted.has(account.facultyId));
			break;
		}
		case 'PRIVILEGED': {
			matched = inSchool.filter((account) => hasPrivilegedRole(account.role));
			break;
		}
		case 'ALL': {
			matched = inSchool;
			break;
		}
	}
	if (matched.length > NOTIFICATION_RECIPIENT_CAP) {
		return { ids: [], capped: true };
	}
	return { ids: matched.map((account) => account.id), capped: false };
}

/**
 * DB-backed recipient resolution for one event. Queries only active accounts
 * in the event's school, then applies the pure audience core. A cap refusal
 * is recorded as a typed skip (log, no throw) and resolves to no recipients
 * so the event persists nothing.
 */
export async function resolveNotificationRecipients(
	event: Pick<NotificationEvent, 'schoolId' | 'audience' | 'facultyId' | 'facultyIds'>,
): Promise<number[]> {
	const facultyWanted = new Set<number>();
	if (event.audience === 'FACULTY') {
		if (event.facultyId != null) facultyWanted.add(event.facultyId);
		for (const id of event.facultyIds ?? []) facultyWanted.add(id);
	}
	const accounts = await prisma.atlasAuthAccount.findMany({
		where: {
			schoolId: event.schoolId,
			isActive: true,
			...(facultyWanted.size > 0 ? { facultyId: { in: [...facultyWanted] } } : {}),
		},
		select: { id: true, schoolId: true, facultyId: true, role: true, isActive: true },
	});
	const resolution = resolveRecipientIds(accounts, event);
	if (resolution.capped) {
		console.warn(
			`[notification-inbox] recipient cap refused ${accounts.length} matches ` +
				`(cap ${NOTIFICATION_RECIPIENT_CAP}); persisting nothing for this event.`,
		);
	}
	return resolution.ids;
}

function firstMetadataString(metadata: Record<string, unknown> | undefined, keys: string[]): string | null {
	if (!metadata) return null;
	for (const key of keys) {
		const value = metadata[key];
		if (typeof value === 'string' && value.trim().length > 0) return value;
		if (typeof value === 'number' && Number.isFinite(value)) return String(value);
	}
	return null;
}

/**
 * Documented event → row mapping (no `any`, no silent field loss):
 * - `resourceType` ← the event domain (what family the thing belongs to);
 * - `resourceId` ← the first present metadata pointer (`runId`, `requestId`,
 *   `preferenceId`, `entryId`), else null;
 * - `title` ← the event message (capped at the column width);
 * - `body` ← null (the message is the title; no second text exists on the event);
 * - `data` ← the full event metadata so nothing the publisher sent is dropped.
 */
export function toNotificationRow(
	event: NotificationEvent,
	actorId: number,
): {
	actorId: number;
	schoolId: number;
	schoolYearId: number | null;
	type: string;
	title: string;
	body: string | null;
	domain: string;
	severity: string;
	resourceType: string | null;
	resourceId: string | null;
	// The event metadata is JSON-serializable by construction (it already
	// travels over SSE as JSON), so this narrowing cast is total.
	data: Prisma.InputJsonValue | undefined;
	dedupeKey: string;
} {
	const resourceType: string | null = event.domain;
	const resourceId = firstMetadataString(event.metadata, ['runId', 'requestId', 'preferenceId', 'entryId']);
	return {
		actorId,
		schoolId: event.schoolId,
		schoolYearId: event.schoolYearId,
		type: event.type,
		title: event.message.slice(0, 200),
		body: null,
		domain: event.domain,
		severity: event.severity,
		resourceType,
		resourceId,
		data: event.metadata as Prisma.InputJsonValue | undefined,
		dedupeKey: buildNotificationDedupeKey({
			schoolId: event.schoolId,
			schoolYearId: event.schoolYearId,
			type: event.type,
			resourceType,
			resourceId,
			actorId,
		}),
	};
}

/**
 * Persist what the stream already carries: one row per recipient actor,
 * deduped on the content-stable key so re-raising the same delta writes zero
 * new rows. Total: never throws for a cap refusal or an empty audience —
 * those are typed skips, not errors.
 */
export async function persistNotificationEvent(
	event: NotificationEvent,
): Promise<{ inserted: number; skipped: boolean }> {
	const recipients = await resolveNotificationRecipients(event);
	if (recipients.length === 0) {
		return { inserted: 0, skipped: true };
	}
	const rows = recipients.map((actorId) => toNotificationRow(event, actorId));
	const result = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
	return { inserted: result.count, skipped: false };
}
