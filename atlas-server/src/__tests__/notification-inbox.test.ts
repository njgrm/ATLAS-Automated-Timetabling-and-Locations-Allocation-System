/**
 * NOTIFICATION-INBOX-C01 — hermetic inbox authority proofs (no database).
 *
 * Run (server workspace): `npx tsx --test src/__tests__/notification-inbox.test.ts`
 *
 * Fixtures are built from the REAL `NotificationEvent` surface carried by
 * `notification-events.service.ts` (real domain/audience/severity literals,
 * real metadata pointer keys) — never from invented text.
 *
 * Proves:
 *  1. Dedupe-key determinism: the same delta twice ⇒ the same key.
 *  2. Content-stability: the key excludes the in-memory event id/timestamp
 *     (failing-first: a key that embedded the event id would differ per raise
 *     and re-raising the same delta would flood the inbox).
 *  3. A different resource ⇒ a different key.
 *  4. Recipient resolution for each of the four audiences (FACULTY single,
 *     FACULTY multi, PRIVILEGED, ALL), including the 200-recipient cap refusal
 *     and the actor-school exclusion (a foreign-school actor is never returned).
 *  5. A dead durable listener never breaks the publish path (RR-08 mirror):
 *     publishing with a throwing listener still returns the event.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	buildNotificationDedupeKey,
	resolveRecipientIds,
	toNotificationRow,
	NOTIFICATION_RECIPIENT_CAP,
	type NotificationRecipientAccount,
} from '../services/notification-inbox.service.js';
import {
	publishNotificationEvent,
	registerDurableNotificationListener,
	type NotificationEvent,
} from '../services/notification-events.service.js';

const SCHOOL = 7701;
const FOREIGN_SCHOOL = 7702;
const YEAR = 9101;

/** A real-shape stream event: the sync-tick delta the inbox must collapse. */
function syncTickEvent(overrides?: Partial<NotificationEvent>): NotificationEvent {
	return {
		id: 501,
		type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
		domain: 'integration',
		severity: 'success',
		audience: 'PRIVILEGED',
		timestamp: '2026-09-23T00:00:00.000Z',
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		facultyId: null,
		message: 'Timetable setup sync completed for 2030-2031.',
		metadata: { runId: 77 },
		...overrides,
	};
}

function account(overrides: Partial<NotificationRecipientAccount> & { id: number }): NotificationRecipientAccount {
	return {
		schoolId: SCHOOL,
		facultyId: null,
		role: 'officer',
		isActive: true,
		...overrides,
	};
}

test('dedupe key is deterministic: the same delta twice resolves to the same key', () => {
	const first = syncTickEvent();
	// A repeated sync tick arrives as a NEW in-memory event (new id, new timestamp).
	const second = syncTickEvent({ id: 502, timestamp: '2026-09-23T00:05:00.000Z' });
	const rowA = toNotificationRow(first, 46);
	const rowB = toNotificationRow(second, 46);
	assert.equal(rowA.dedupeKey, rowB.dedupeKey, 're-raising the same delta must collapse to one key');
	assert.equal(
		rowA.dedupeKey,
		`${SCHOOL}:${YEAR}:TIMETABLE_SETUP_SYNC_COMPLETED:integration:77:46`,
		'exact pinned shape schoolId:schoolYearId:type:resourceType:resourceId:actorId',
	);
});

test('dedupe key is content-stable, not event-identity-stable (failing-first control)', () => {
	// CONTROL: if the key embedded the in-memory event id or timestamp, these
	// two raises of the same delta would differ and the inbox would flood.
	// The implementation must exclude both — this assertion fails RED against
	// any identity-stable key construction.
	const a = syncTickEvent({ id: 9001, timestamp: '2026-09-23T01:00:00.000Z' });
	const b = syncTickEvent({ id: 9002, timestamp: '2026-09-23T02:00:00.000Z' });
	assert.equal(
		toNotificationRow(a, 46).dedupeKey,
		toNotificationRow(b, 46).dedupeKey,
		'event id / timestamp must not participate in the key (old behaviour floods)',
	);
	// And the key genuinely binds the actor: two actors get two rows.
	assert.notEqual(
		toNotificationRow(a, 46).dedupeKey,
		toNotificationRow(a, 47).dedupeKey,
		'the same delta for a different actor is a different row',
	);
});

test('a different resource resolves to a different key', () => {
	const base = syncTickEvent();
	const otherRun = syncTickEvent({ metadata: { runId: 78 } });
	assert.notEqual(
		toNotificationRow(base, 46).dedupeKey,
		toNotificationRow(otherRun, 46).dedupeKey,
		'a different runId must not collapse',
	);
	const nullYear = syncTickEvent({ schoolYearId: null as unknown as number });
	assert.ok(
		toNotificationRow(nullYear, 46).dedupeKey.includes(`:${0}:`),
		'null schoolYearId normalises to the 0 slot, never to "null"/"undefined"',
	);
});

test('FACULTY audience resolves the single addressed faculty account', () => {
	const addressed = account({ id: 11, role: 'faculty', facultyId: 301 });
	const other = account({ id: 12, role: 'faculty', facultyId: 302 });
	const event = syncTickEvent({ audience: 'FACULTY', facultyId: 301 });
	const resolution = resolveRecipientIds([addressed, other], event);
	assert.deepEqual(resolution.ids, [11], 'only the addressed faculty account receives');
	assert.equal(resolution.capped, false, 'no cap trip on a small audience');
});

test('FACULTY audience with facultyIds resolves each addressed account', () => {
	const a = account({ id: 11, role: 'faculty', facultyId: 301 });
	const b = account({ id: 12, role: 'faculty', facultyId: 302 });
	const c = account({ id: 13, role: 'faculty', facultyId: 303 });
	const event = syncTickEvent({ audience: 'FACULTY', facultyIds: [301, 303] });
	assert.deepEqual(resolveRecipientIds([a, b, c], event).ids, [11, 13], 'every listed faculty id resolves');
});

test('PRIVILEGED audience resolves exactly the privileged roles via the shared predicate', () => {
	const admin = account({ id: 21, role: 'admin' });
	const officer = account({ id: 22, role: 'officer' });
	const faculty = account({ id: 23, role: 'faculty', facultyId: 301 });
	const event = syncTickEvent({ audience: 'PRIVILEGED' });
	assert.deepEqual(
		resolveRecipientIds([admin, officer, faculty], event).ids,
		[21, 22],
		'faculty accounts are excluded from the privileged audience',
	);
});

test('ALL audience resolves every active account in the event school', () => {
	const active = account({ id: 31, role: 'faculty', facultyId: 301 });
	const inactive = account({ id: 32, role: 'faculty', facultyId: 302, isActive: false });
	const event = syncTickEvent({ audience: 'ALL' });
	assert.deepEqual(
		resolveRecipientIds([active, inactive], event).ids,
		[31],
		'inactive accounts never receive',
	);
});

test('the resolver never returns a foreign-school actor', () => {
	const local = account({ id: 41 });
	const foreign = account({ id: 42, schoolId: FOREIGN_SCHOOL });
	for (const audience of ['FACULTY', 'PRIVILEGED', 'ALL'] as const) {
		const event = syncTickEvent({ audience });
		const ids = resolveRecipientIds([local, foreign], event).ids;
		assert.ok(!ids.includes(42), `${audience}: foreign-school actor must never resolve`);
	}
	assert.ok(
		resolveRecipientIds([local, foreign], syncTickEvent({ audience: 'ALL' })).ids.includes(41),
		'ALL: the local actor still resolves',
	);
});

test('above the 200-recipient cap the whole event is refused, never partially fanned out', () => {
	assert.equal(NOTIFICATION_RECIPIENT_CAP, 200, 'cap is pinned at 200');
	const crowd: NotificationRecipientAccount[] = Array.from(
		{ length: NOTIFICATION_RECIPIENT_CAP + 1 },
		(_, index) => account({ id: 1000 + index, role: 'faculty', facultyId: 5000 + index }),
	);
	const resolution = resolveRecipientIds(crowd, syncTickEvent({ audience: 'ALL' }));
	assert.equal(resolution.capped, true, 'over-cap match sets the typed refusal');
	assert.deepEqual(resolution.ids, [], 'over-cap persists nothing — no partial fan-out');
	const atCap = resolveRecipientIds(crowd.slice(0, NOTIFICATION_RECIPIENT_CAP), syncTickEvent({ audience: 'ALL' }));
	assert.equal(atCap.capped, false, 'exactly 200 still resolves');
	assert.equal(atCap.ids.length, 200, 'exactly 200 ids resolve at the boundary');
});

test('a dead durable listener never breaks the publish path', () => {
	const unregister = registerDurableNotificationListener(() => {
		throw new Error('durable sink is down');
	});
	try {
		const event = publishNotificationEvent({
			type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'ALL',
			schoolId: SCHOOL,
			schoolYearId: YEAR,
			facultyId: null,
			message: 'sync tick under test',
		});
		assert.ok(event.id > 0, 'publish still returns the event when the durable listener throws');
	} finally {
		unregister();
	}
});

test('buildNotificationDedupeKey pins the exact join shape', () => {
	assert.equal(
		buildNotificationDedupeKey({
			schoolId: 1,
			schoolYearId: null,
			type: 'X',
			resourceType: null,
			resourceId: undefined,
			actorId: 2,
		}),
		'1:0:X:-:-:2',
		'nullish slots render as 0 / - in the pinned positions',
	);
});
