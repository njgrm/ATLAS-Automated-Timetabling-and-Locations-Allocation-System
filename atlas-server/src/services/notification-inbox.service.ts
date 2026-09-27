import { hasPrivilegedRole } from '../middleware/authorize.js';
import { createHash } from 'node:crypto';
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
 *
 * A2-TIMETABLE-CUSTODY (20:59 trace) — `editId` is ALSO content-stable, and its
 * absence was a silent data-loss defect rather than over-deduping. For
 * `TIMETABLE_EDIT_COMMITTED` the only `resourceId` pointer present is `runId`
 * (`toNotificationRow` reads `runId` first), so the pre-fix key for every manual
 * edit on a run was `school:year:TYPE:timetable:<runId>:<actorId>` — identical
 * for the first swap and the second. `persistNotificationEvent` calls
 * `createMany({ skipDuplicates: true })`, so every swap after the first was
 * dropped before it reached the table: a committed swap wrote
 * `manual_schedule_edits` and bumped `generation_runs.version`, returned 200, and
 * left `notifications` unchanged. Traced three ways (bell DOM, the
 * `notification-inbox` route, and a direct count) because one empty surface
 * proves nothing.
 *
 * Why `editId` is the RIGHT discriminator and not `event.id`/`timestamp`:
 * `editId` names the committed change, so re-delivering the SAME edit still
 * collapses to one row (the D1b property is preserved) while two DIFFERENT
 * swaps are two different changes and each persists. Using the in-memory event
 * id instead would have re-broken D1b on every redelivery.
 *
 * A2-TIMETABLE-CUSTODY-R1 (QA C4): the same slot now also carries a BATCH's
 * change identity, so `commitManualEditBatch` (which publishes `metadata.editIds`,
 * plural) is no longer deduped into its predecessor. The parameter is still one
 * string; the plural form is resolved by `metadataChangeIdentity` below and this
 * function stays the single place the join shape is written.
 */
export const NOTIFICATION_DEDUPE_KEY_MAX_LENGTH = 255;

export function buildNotificationDedupeKey(input: {
	schoolId: number;
	schoolYearId: number | null | undefined;
	type: string;
	resourceType: string | null | undefined;
	resourceId: string | null | undefined;
	actorId: number;
	/**
	 * The per-change identity when the event names one (a committed manual edit).
	 * `null`/absent contributes the `-` sentinel, so an event that carries no
	 * change identity keeps exactly its previous key.
	 */
	editId?: string | null;
}): string {
	return [
		input.schoolId,
		input.schoolYearId ?? 0,
		input.type,
		input.resourceType ?? '-',
		input.resourceId ?? '-',
		input.actorId,
		input.editId ?? '-',
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
 * A2-TIMETABLE-CUSTODY-R1 (QA C4) — the per-CHANGE identity, for the BATCH
 * commit path as well as the single-edit one.
 *
 * `f9879289` read `metadata.editId` (singular) and nothing else, which repaired
 * the single-swap path. `commitManualEditBatch` (`manual-edit.service.ts:1609`)
 * publishes `metadata.editIds` — a PLURAL array — so `firstMetadataString` found
 * nothing, the key's change slot fell back to the `-` sentinel, and two DISTINCT
 * batch commits on one run by one actor still collided on
 * `1:1:TIMETABLE_EDIT_COMMITTED:timetable:321:46:-`. QA measured both producing
 * that exact string. `createMany({ skipDuplicates: true })` then dropped the
 * second batch, so a whole multi-edit commit wrote the schedule, returned 200,
 * and never moved the bell — the same class of silent drop the singular fix
 * closed, one call site over.
 *
 * The identity is the SET of committed edit ids, sorted and de-duplicated. That
 * keeps the two properties the singular fix established and that D1b depends on:
 * two different batches are two different sets and each persists, while a
 * redelivery of the SAME batch resolves to the same set and still collapses to
 * one row. It is deliberately not the in-memory event id or timestamp, and not
 * the batch size, either of which would re-break D1b on redelivery.
 */
function metadataChangeIdentity(metadata: Record<string, unknown> | undefined): string | null {
	if (!metadata) return null;
	// The single-edit publishers (`commitTimetableSwap`, the room-request and
	// revert paths) carry `editId`; that stays first so their keys are unchanged.
	const single = firstMetadataString(metadata, ['editId']);
	if (single != null) return single;
	const many = metadata['editIds'];
	if (!Array.isArray(many) || many.length === 0) return null;
	const ids = many
		.filter((value) => (typeof value === 'string' && value.trim().length > 0)
			|| (typeof value === 'number' && Number.isFinite(value)))
		.map((value) => String(value).trim())
		.filter((value) => value.length > 0);
	if (ids.length === 0) return null;
	const unique = [...new Set(ids)];
	unique.sort((a, b) => {
		const byNumber = Number(a) - Number(b);
		// A non-numeric member makes the subtraction NaN (falsy), so the
		// lexicographic order decides and the result is still a total order.
		return byNumber || a.localeCompare(b);
	});
	return unique.join(',');
}

/**
 * Documented event → row mapping (no `any`, no silent field loss):
 * - `resourceType` ← the event domain (what family the thing belongs to);
 * - `resourceId` ← the first present metadata pointer (`runId`, `requestId`,
 *   `preferenceId`, `entryId`), else null;
 * - `title` ← the event message (capped at the column width);
 * - `body` ← null (the message is the title; no second text exists on the event);
 * - `data` ← the full event metadata so nothing the publisher sent is dropped.
 *
 * A2-TIMETABLE-CUSTODY: `editId` is read for the DEDUPE KEY only, never for
 * `resourceId`. `resourceId` stays `runId` because the client inbox routes on
 * it (M6 in `timetable-swap-notification-message-a2.test.ts` asserts the entry
 * ids stay in `data` and the inbox routes on the run), so folding `editId` into
 * `resourceId` would have fixed the collision by breaking routing.
 *
 * A2-TIMETABLE-CUSTODY-R1 (QA C4): the change identity comes from
 * `metadataChangeIdentity`, which reads `metadata.editId` first and then
 * `metadata.editIds`, so the BATCH commit path is distinguished too. Neither
 * form reaches `resourceId`.
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
	const changeId = metadataChangeIdentity(event.metadata);
	const keyInput = {
		schoolId: event.schoolId,
		schoolYearId: event.schoolYearId,
		type: event.type,
		resourceType,
		resourceId,
		actorId,
		editId: changeId,
	};
	// `dedupe_key` is `VARCHAR(255)` and uniqueness is enforced BY that column, so
	// an over-long key is not a truncation concern — it is an insert that throws,
	// which would turn the silent drop this fix exists to remove into a louder
	// failure on the notify path. A batch identity is the only unbounded part
	// (it lists every committed edit), so when the composed key would not fit, the
	// change slot becomes a deterministic digest of it: still content-stable, still
	// different batches apart, and short. Everything else in the key is untouched,
	// so a key that already fitted is byte-identical to the one `f9879289` built.
	const composedKey = buildNotificationDedupeKey(keyInput);
	const dedupeKey = composedKey.length <= NOTIFICATION_DEDUPE_KEY_MAX_LENGTH
		? composedKey
		: buildNotificationDedupeKey({
			...keyInput,
			editId: `h${createHash('sha256').update(changeId ?? '').digest('hex').slice(0, 16)}`,
		});
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
		dedupeKey,
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
