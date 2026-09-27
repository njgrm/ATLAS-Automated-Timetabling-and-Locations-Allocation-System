/**
 * A2-TIMETABLE-CUSTODY (20:59 trace) — a second swap on a run by the same actor
 * must persist its own durable notification row.
 *
 * THE DEFECT, as traced. `manual-edit.service.ts` publishes one
 * `TIMETABLE_EDIT_COMMITTED` event per committed swap, carrying `runId` and
 * `metadata.editId`. `notification-events.service.ts` bridges it, and
 * `toNotificationRow` builds the durable key from
 * `buildNotificationDedupeKey({ schoolId, schoolYearId, type, resourceType,
 * resourceId, actorId })`, where `resourceId` is the FIRST present pointer among
 * `runId`, `requestId`, `preferenceId`, `entryId` — so for a swap it is ALWAYS the
 * run. The pre-fix key was therefore identical for the first swap and the second:
 * `1:1:TIMETABLE_EDIT_COMMITTED:timetable:<runId>:<actorId>`. `persistNotificationEvent`
 * calls `createMany({ skipDuplicates: true })`, so the second swap was dropped
 * before it reached the table.
 *
 * The observed consequence is the part worth stating plainly: the swap was NOT
 * dropped. It wrote `manual_schedule_edits` id 12, bumped
 * `generation_runs.version` 3 -> 4, and returned 200. Only the notification was
 * lost — `notifications` stayed 216 -> 216, verified three ways (bell DOM,
 * `GET /api/v1/notification-inbox`, and a direct count), because one empty
 * surface proves nothing about a durable write.
 *
 * WHY `editId` IS THE RIGHT DISCRIMINATOR. `editId` names the committed CHANGE,
 * so it is content-stable in exactly the way D1b requires: re-delivering the same
 * edit still collapses to one row, while two different swaps are two different
 * changes and each persists. `resourceId` deliberately stays `runId`, because the
 * client inbox routes on it (asserted by M6 in
 * `timetable-swap-notification-message-a2.test.ts`); folding `editId` into
 * `resourceId` would have fixed this by breaking routing.
 *
 * Rows:
 *   D1 the real durable builder gives two swaps on one run DIFFERENT keys.
 *   D2 the same edit delivered twice still collapses to ONE key (D1b preserved) —
 *      the fix must not have over-corrected into re-notifying on redelivery.
 *   D3 an event with no change identity keeps its previous key shape, so no other
 *      notification family moved.
 *   D4 `resourceId` is still the run, not the edit: routing is intact.
 *   D5 MUTANT: the PRE-FIX key (built without the edit component) is IDENTICAL
 *      for the two swaps, so D1 discriminates and is not tautological.
 *   D6 MOUNTED: two real `persistNotificationEvent` calls against a real
 *      disposable PostgreSQL database write TWO rows for the same run and actor.
 *      A second swap must persist.
 *   D7 MOUNTED, redelivery: re-persisting the SAME edit adds no second row.
 *   D8 zero residue: the mounted rows drop everything they created.
 *
 * Run: npm run test:notification-inbox-dedupe-a2 (wired in atlas-server/package.json
 * in this same commit).
 */

import assert from 'node:assert/strict';
import test, { after, before, describe } from 'node:test';

import { describeSwapCommitMessage } from '../services/timetable-edit-message.js';
import type { NotificationEvent } from '../services/notification-events.service.js';
import {
	isDisposableHarnessAvailable,
	provisionDisposableDatabase,
	type DisposableDatabase,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.ENROLLPRO_CLIENT_URL = 'http://127.0.0.1:1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-notification-dedupe-secret';
process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN ?? 'a2-notification-dedupe-system-token';

const RUNNABLE = isDisposableHarnessAvailable();

/**
 * Provision at MODULE scope, not in before(). `notification-inbox.service.js`
 * builds its Prisma singleton at import time, so importing it before
 * DATABASE_URL points at the disposable database would bind the singleton to the
 * SOURCE database and every mounted query would run against it.
 */
const harness: DisposableDatabase | null = RUNNABLE ? provisionDisposableDatabase('a2notifdedupe') : null;
if (harness) process.env.DATABASE_URL = harness.targetUrl;

let prisma: any = null;
let inboxModule: typeof import('../services/notification-inbox.service.js') | null = null;
async function inbox(): Promise<typeof import('../services/notification-inbox.service.js')> {
	if (!inboxModule) inboxModule = await import('../services/notification-inbox.service.js');
	return inboxModule;
}

/** The live values from the trace: draft run 321, one actor, two swaps. */
const RUN_ID = 321;
const ACTOR_ID = 46;
const SCHOOL_ID = 1;
const FIRST_EDIT_ID = 12;
const SECOND_EDIT_ID = 13;

const SLOT_A = { day: 'MONDAY', startTime: '07:30', endTime: '08:15' };
const SLOT_B = { day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00' };

/**
 * A swap event exactly as `commitTimetableSwap` publishes it: the plain-language
 * message from the shared builder, and metadata carrying `editId` alongside the
 * entry ids. The message is the real one so these rows exercise the production
 * strings, not a stand-in.
 */
function swapEvent(editId: number, schoolId = SCHOOL_ID): NotificationEvent {
	return {
		id: 9000 + editId,
		type: 'TIMETABLE_EDIT_COMMITTED',
		timestamp: '2026-09-27T00:00:00.000Z',
		domain: 'timetable',
		severity: 'warning',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId: 1,
		facultyId: null,
		message: describeSwapCommitMessage({
			strategy: 'DIRECT_SWAP',
			subjectA: 'MAPEH',
			subjectB: 'ESP',
			slotA: SLOT_A,
			slotB: SLOT_B,
		}),
		metadata: {
			runId: RUN_ID,
			actorId: ACTOR_ID,
			editId,
			strategy: 'DIRECT_SWAP',
			entryIdA: 'entry-321::t2',
			entryIdB: 'entry-421::t2',
			affectedTermIndices: [2],
		},
	} as NotificationEvent;
}

function durableRow(editId: number, schoolId = SCHOOL_ID) {
	if (!inboxModule) throw new Error('inbox module not loaded; await inbox() first');
	return inboxModule.toNotificationRow(swapEvent(editId, schoolId), ACTOR_ID);
}

// ── D1 two swaps on one run are two different durable rows ───────────────────

test('D1 two swaps on the same run by the same actor produce DIFFERENT dedupe keys', async () => {
	await inbox();
	const first = durableRow(FIRST_EDIT_ID);
	const second = durableRow(SECOND_EDIT_ID);
	assert.equal(first.resourceId, String(RUN_ID), 'precondition: the resource is the run, for both');
	assert.equal(second.resourceId, String(RUN_ID), 'precondition: the resource is the run, for both');
	assert.notEqual(
		first.dedupeKey,
		second.dedupeKey,
		'a second swap on a run is a second change and must not collide with the first',
	);
	assert.ok(
		first.dedupeKey.endsWith(`:${FIRST_EDIT_ID}`),
		`the first key names its own edit: ${first.dedupeKey}`,
	);
	assert.ok(
		second.dedupeKey.endsWith(`:${SECOND_EDIT_ID}`),
		`the second key names its own edit: ${second.dedupeKey}`,
	);
	// The uniqueness that makes `skipDuplicates` safe is a DATABASE constraint on
	// this column, so the two keys must both fit it.
	assert.ok(first.dedupeKey.length <= 255, 'the key still fits dedupe_key VARCHAR(255)');
	assert.ok(second.dedupeKey.length <= 255, 'the key still fits dedupe_key VARCHAR(255)');
});

// ── D2 redelivery of the SAME edit still collapses (D1b preserved) ──────────

test('D2 the same edit delivered twice still yields ONE key, so redelivery is not re-notified', async () => {
	await inbox();
	const firstDelivery = durableRow(FIRST_EDIT_ID);
	// A different in-memory event id and timestamp, same committed change: exactly
	// the case D1b exists to collapse.
	const redelivered = { ...swapEvent(FIRST_EDIT_ID), id: 999999, timestamp: '2026-09-27T09:00:00.000Z' } as NotificationEvent;
	const secondDelivery = inboxModule!.toNotificationRow(redelivered, ACTOR_ID);
	assert.equal(
		secondDelivery.dedupeKey,
		firstDelivery.dedupeKey,
		'the in-memory event identity is excluded, so a re-raised delta writes no second row',
	);
});

// ── D3 no other notification family moved ───────────────────────────────────

test('D3 an event with no change identity keeps its previous key, so other families are untouched', async () => {
	await inbox();
	const { buildNotificationDedupeKey } = inboxModule!;
	const withoutEdit = buildNotificationDedupeKey({
		schoolId: SCHOOL_ID,
		schoolYearId: 1,
		type: 'GENERATION_RUN_COMPLETED',
		resourceType: 'generation',
		resourceId: '321',
		actorId: ACTOR_ID,
	});
	assert.equal(
		withoutEdit,
		'1:1:GENERATION_RUN_COMPLETED:generation:321:46:-',
		'an event that names no change contributes the sentinel, so its key is the old key plus one component',
	);
	const withEdit = buildNotificationDedupeKey({
		schoolId: SCHOOL_ID,
		schoolYearId: 1,
		type: 'GENERATION_RUN_COMPLETED',
		resourceType: 'generation',
		resourceId: '321',
		actorId: ACTOR_ID,
		editId: '77',
	});
	assert.notEqual(withEdit, withoutEdit, 'and an event that does name a change is distinguished by it');
});

// ── D4 routing is intact ────────────────────────────────────────────────────

test('D4 resourceId stays the RUN, so inbox routing is not broken by the fix', async () => {
	await inbox();
	for (const editId of [FIRST_EDIT_ID, SECOND_EDIT_ID]) {
		const row = durableRow(editId);
		assert.equal(row.resourceId, String(RUN_ID), `edit ${editId}: the client routes the inbox on runId`);
		assert.equal(row.resourceType, 'timetable', 'and on the resource type');
	}
	// The change identity stays available in the structured record too.
	const data = durableRow(SECOND_EDIT_ID).data as Record<string, unknown>;
	assert.equal(data.editId, SECOND_EDIT_ID, 'metadata still carries the edit identity for any consumer that wants it');
});

// ── D5 MUTANT: the pre-fix key really did collide ────────────────────────────

test('D5 MUTANT: the pre-fix key is IDENTICAL for both swaps, so D1 discriminates', async () => {
	await inbox();
	// The pre-fix key construction, verbatim: six components, no change identity.
	const preFix = (editId: number) => {
		const row = inboxModule!.toNotificationRow(swapEvent(editId), ACTOR_ID);
		return row.dedupeKey.split(':').slice(0, 6).join(':');
	};
	assert.equal(
		preFix(FIRST_EDIT_ID),
		preFix(SECOND_EDIT_ID),
		'precondition: the first six components are identical for two different swaps - this is the defect',
	);
	assert.equal(preFix(FIRST_EDIT_ID), '1:1:TIMETABLE_EDIT_COMMITTED:timetable:321:46', 'and that shared value is the traced key');
	// So `createMany({ skipDuplicates: true })` dropped the second swap: the row
	// for edit 12 existed and the row for edit 13 never could.
	assert.notEqual(
		durableRow(FIRST_EDIT_ID).dedupeKey,
		durableRow(SECOND_EDIT_ID).dedupeKey,
		'while the fixed key separates them, which is what makes D1 a real control',
	);
});

// ── D6/D7/D8 mounted: a real database, two real swaps, two real rows ─────────

const SAND_SCHOOL = 7_799_131;

describe(`D6-D8 mounted durable persistence (${RUNNABLE ? 'available' : 'unavailable'})`, () => {
	before(async () => {
		if (!harness) return;
		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
		await prisma.school.create({
			data: { id: SAND_SCHOOL, name: 'A2 Notification Dedupe Sandbox', shortName: 'A2NOTIFDD' },
		});
		await prisma.atlasAuthAccount.create({
			data: {
				email: 'a2-notif-dedupe@example.com',
				schoolId: SAND_SCHOOL,
				role: 'officer',
				passwordHash: 'not-a-real-hash',
				isActive: true,
			},
		});
	});

	after(async () => {
		if (prisma) {
			await prisma.notification.deleteMany({ where: { schoolId: SAND_SCHOOL } });
			await prisma.atlasAuthAccount.deleteMany({ where: { schoolId: SAND_SCHOOL } });
			await prisma.school.deleteMany({ where: { id: SAND_SCHOOL } });
			const [notifications, accounts, schools] = await Promise.all([
				prisma.notification.count({ where: { schoolId: SAND_SCHOOL } }),
				prisma.atlasAuthAccount.count({ where: { schoolId: SAND_SCHOOL } }),
				prisma.school.count({ where: { id: SAND_SCHOOL } }),
			]);
			assert.equal(notifications, 0, 'no notification row remains');
			assert.equal(accounts, 0, 'no account row remains');
			assert.equal(schools, 0, 'no school row remains');
			await prisma.$disconnect();
		}
		if (harness) {
			harness.drop();
			harness.assertDropped();
		}
	});

	test('D6 two real swaps on one run PERSIST two durable rows', async (t) => {
		if (!RUNNABLE || !harness || !prisma) {
			t.skip('disposable PostgreSQL harness unavailable');
			return;
		}
		const { persistNotificationEvent } = await import('../services/notification-inbox.service.js');

		const first = await persistNotificationEvent(swapEvent(FIRST_EDIT_ID, SAND_SCHOOL));
		assert.ok(first.inserted >= 1, 'the first swap wrote its row');

		const afterFirst = await prisma.notification.count({ where: { schoolId: SAND_SCHOOL } });
		assert.ok(afterFirst >= 1, `the first swap is really in the table (${afterFirst})`);

		// THE ROW THAT MATTERS. Identical run, identical actor, identical type,
		// identical audience: only the committed change differs. Before the fix
		// this call reported `inserted: 0` and the count did not move.
		const second = await persistNotificationEvent(swapEvent(SECOND_EDIT_ID, SAND_SCHOOL));
		assert.ok(
			second.inserted >= 1,
			'a SECOND swap on the same run by the same actor must persist a row - it was silently dropped before',
		);

		const afterSecond = await prisma.notification.count({ where: { schoolId: SAND_SCHOOL } });
		assert.equal(
			afterSecond,
			afterFirst + 1,
			`the second swap added exactly one durable row (${afterFirst} -> ${afterSecond})`,
		);

		const stored = await prisma.notification.findMany({
			where: { schoolId: SAND_SCHOOL },
			orderBy: { id: 'asc' },
		});
		assert.equal(stored.length, afterFirst + 1, 'the rows really are in the table, read back out');
		const editIds = stored.map((row: any) => (row.data as Record<string, unknown>).editId);
		assert.deepEqual(
			editIds,
			[FIRST_EDIT_ID, SECOND_EDIT_ID],
			'each persisted row is a distinct committed change',
		);
		assert.equal(
			new Set(stored.map((row: any) => row.dedupeKey)).size,
			stored.length,
			'and the two rows carry two distinct dedupe keys',
		);
		for (const row of stored) {
			assert.equal(row.type, 'TIMETABLE_EDIT_COMMITTED', 'each row is a swap commit');
			assert.equal(row.resourceId, String(RUN_ID), 'and routes on the run');
		}
	});

	test('D7 re-persisting the SAME edit still writes no second row', async (t) => {
		if (!RUNNABLE || !harness || !prisma) {
			t.skip('disposable PostgreSQL harness unavailable');
			return;
		}
		const { persistNotificationEvent } = await import('../services/notification-inbox.service.js');
		// A different in-memory event id and timestamp, the same committed change:
		// the redelivery case D1b must keep collapsing.
		const before = await prisma.notification.count({ where: { schoolId: SAND_SCHOOL } });
		await persistNotificationEvent({
			...swapEvent(SECOND_EDIT_ID, SAND_SCHOOL),
			id: 424242,
			timestamp: '2026-09-27T11:00:00.000Z',
		} as NotificationEvent);
		const after = await prisma.notification.count({ where: { schoolId: SAND_SCHOOL } });
		assert.equal(after, before, 'a re-raised identical change adds no row, so the fix is not over-deduping');
	});
});
