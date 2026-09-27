/**
 * A2-TIMETABLE-CUSTODY (#61 correction) — the persisted swap message must be
 * id-free, at the SOURCE, on the DURABLE path.
 *
 * WHY THIS CONTROL EXISTS. The original candidate claimed in its module docstring
 * that "an id never reaches an operator-facing string, on ANY path", and named a
 * test F9 to that effect. Both were false. The candidate suppressed the TOAST, but
 * the string is authored by the server and travels a path the client does not own:
 *
 *   manual-edit.service.ts  message: "Manual swap committed between entries <idA> and <idB>"
 *     -> publishTimetableEvent
 *        -> notification-events.service.ts:260 bridges it (message: event.message)
 *           -> :122 notifyDurableListeners(resolved)   [UNCONDITIONAL, no self-exclusion]
 *              -> :306 persistNotificationEvent(event)
 *                 -> notification-inbox.service.ts:173  title: event.message.slice(0, 200)
 *                    -> NotificationBell.tsx:27 renders item.title
 *
 * So the ids were PERSISTED into the durable per-actor inbox, not merely shown.
 *
 * THIS CONTROL ASSERTS ON THE DURABLE PROJECTION, not on the SSE payload, because
 * the stored row is what outlives the session. `toNotificationRow` is the exact
 * function `persistNotificationEvent` uses to build every row, so a row produced
 * here is what would be written. The mounted section goes further and reads the
 * title back out of a real disposable PostgreSQL database.
 *
 * Rows:
 *   M1 no TIMETABLE_EDIT_COMMITTED message that the durable projection would
 *      store contains an entry id - the swap path, through the real builder.
 *   M2 MUTANT: the pre-fix message DOES trip M1, so M1 discriminates and is not
 *      tautological. This is the control that would have caught the finding.
 *   M3 honest degradation: an entry whose subject is not in the mirror yields the
 *      contentless sentence, never a vague one that implies more than it knows.
 *   M4 the named sentence names the classes in words and claims only the exchange.
 *   M5 an auto-fix additionally discloses the relocation; a direct swap does not
 *      claim one.
 *   M6 the entry ids REMAIN in the event metadata, because the accepted client
 *      fix resolves its labels from them and the inbox routes on runId. This row
 *      stops a future over-redaction from breaking that.
 *   M7 MOUNTED: a real persistNotificationEvent writes a real row and the stored
 *      title is id-free, with zero rows left behind.
 *   M8 the durable audience includes the committing actor - reported, NOT fixed.
 *
 * Run: npm run test:timetable-swap-notification-message-a2 (wired in
 * atlas-server/package.json in this same commit). The mounted row provisions and
 * drops its own disposable database and proves zero residue.
 */

import assert from 'node:assert/strict';
import test, { after, before, describe } from 'node:test';

import {
	describeSwapCommitMessage,
	UNNAMED_SWAP_COMMIT_MESSAGE,
} from '../services/timetable-edit-message.js';
import type { NotificationEvent } from '../services/notification-events.service.js';
import {
	isDisposableHarnessAvailable,
	provisionDisposableDatabase,
	type DisposableDatabase,
} from './helpers/tt-source-freshness-db.js';

process.env.ENROLLPRO_API = 'http://127.0.0.1:1/api';
process.env.ENROLLPRO_CLIENT_URL = 'http://127.0.0.1:1';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'a2-swap-notification-message-secret';
process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN ?? 'a2-swap-notification-message-system-token';

const RUNNABLE = isDisposableHarnessAvailable();

/**
 * Provision at MODULE scope, not in before().
 *
 * `notification-inbox.service.js` builds its Prisma singleton at import time, so
 * if that module is imported before DATABASE_URL points at the disposable
 * database, the singleton binds to the SOURCE database and every mounted query
 * runs against it. Pointing the variable here, before the first dynamic import of
 * that module, is what keeps the mounted rows off the source database. This is the
 * same discipline `timetable-swap-custody-a2.test.ts` uses.
 */
const harness: DisposableDatabase | null = RUNNABLE ? provisionDisposableDatabase('a2swapmsg') : null;
if (harness) process.env.DATABASE_URL = harness.targetUrl;

let prisma: any = null;

/**
 * The durable projection, loaded lazily so the module is only ever imported after
 * DATABASE_URL is correct, and memoised so every row sees the same instance.
 */
let inboxModule: typeof import('../services/notification-inbox.service.js') | null = null;
async function inbox(): Promise<typeof import('../services/notification-inbox.service.js')> {
	if (!inboxModule) inboxModule = await import('../services/notification-inbox.service.js');
	return inboxModule;
}

/** The live payload from the finding, on draft run 321. */
const ENTRY_A_ID = 'entry-321::t2';
const ENTRY_B_ID = 'entry-421::t2';
const SLOT_A = { day: 'MONDAY', startTime: '07:30', endTime: '08:15' };
const SLOT_B = { day: 'WEDNESDAY', startTime: '08:15', endTime: '09:00' };

/**
 * The PRE-FIX message, verbatim from manual-edit.service.ts:2481 at base
 * a43e8c25. Kept here as the mutant that proves M1 discriminates.
 */
const PRE_FIX_MESSAGE = `Manual swap committed between entries ${ENTRY_A_ID} and ${ENTRY_B_ID}`;

/** An entry id as ATLAS mints them: entry-<n>::t<term>. */
const ENTRY_ID_PATTERN = /entry-\d+(?:::\w+)?|\bentryId[AB]\b/i;

/** The exact swap inputs the service passes at the publish site. */
const NAMED_INPUT = {
	strategy: 'DIRECT_SWAP',
	subjectA: 'MAPEH',
	subjectB: 'ESP',
	slotA: SLOT_A,
	slotB: SLOT_B,
} as const;

function buildEvent(message: string, actorId: number, schoolId: number): NotificationEvent {
	return {
		id: 9001,
		type: 'TIMETABLE_EDIT_COMMITTED',
		timestamp: '2026-09-27T00:00:00.000Z',
		domain: 'timetable',
		severity: 'warning',
		audience: 'PRIVILEGED',
		schoolId,
		schoolYearId: 1,
		facultyId: null,
		message,
		metadata: {
			runId: 321,
			actorId,
			editId: 77,
			strategy: 'DIRECT_SWAP',
			entryIdA: ENTRY_A_ID,
			entryIdB: ENTRY_B_ID,
			affectedTermIndices: [2],
		},
	} as NotificationEvent;
}

/**
 * The durable projection, driven with the REAL builder. `toNotificationRow` is the
 * function `persistNotificationEvent` maps every recipient through, so the title
 * asserted here is the string that gets stored.
 */
function durableRowFor(message: string, actorId: number, schoolId: number) {
	if (!inboxModule) throw new Error('inbox module not loaded; await inbox() first');
	return inboxModule.toNotificationRow(buildEvent(message, actorId, schoolId), actorId);
}

// ── M1 the durable projection never stores an entry id ─────────────────────

test('M1 no TIMETABLE_EDIT_COMMITTED message the durable projection stores contains an entry id', async () => {
	await inbox();
	// The matrix of every message the swap path can now produce, plus the
	// degenerate ones, each carried through the REAL durable projection.
	const messages: Array<[string, string]> = [
		['direct swap, both subjects resolvable', describeSwapCommitMessage(NAMED_INPUT)],
		['auto-fix, both subjects resolvable', describeSwapCommitMessage({ ...NAMED_INPUT, strategy: 'AUTO_FIX_MOVE_BLOCKING' })],
		['auto-fix source, both subjects resolvable', describeSwapCommitMessage({ ...NAMED_INPUT, strategy: 'AUTO_FIX_MOVE_SOURCE' })],
		['subject A missing from the mirror', describeSwapCommitMessage({ ...NAMED_INPUT, subjectA: null })],
		['subject B missing from the mirror', describeSwapCommitMessage({ ...NAMED_INPUT, subjectB: null })],
		['both subjects missing', describeSwapCommitMessage({ ...NAMED_INPUT, subjectA: null, subjectB: null })],
		['slot A malformed', describeSwapCommitMessage({ ...NAMED_INPUT, slotA: { day: 'MONDAY', startTime: '', endTime: '08:15' } })],
		['slot B null', describeSwapCommitMessage({ ...NAMED_INPUT, slotB: null })],
		['unknown strategy', describeSwapCommitMessage({ ...NAMED_INPUT, strategy: 'SOMETHING_NEW' })],
		['empty strategy', describeSwapCommitMessage({ ...NAMED_INPUT, strategy: '' })],
	];

	for (const [label, message] of messages) {
		const row = durableRowFor(message, 46, 1);
		assert.ok(
			!ENTRY_ID_PATTERN.test(row.title),
			`${label}: the STORED title carries an entry id - ${JSON.stringify(row.title)}`,
		);
		assert.equal(
			row.title,
			message.slice(0, 200),
			`${label}: the stored title is the message, so this control really reads the durable projection`,
		);
		assert.equal(row.type, 'TIMETABLE_EDIT_COMMITTED', `${label}: this is the swap event type`);
	}
});

// ── M2 the mutant: the pre-fix message trips M1 ─────────────────────────────

test('M2 MUTANT: the pre-fix message fails M1, so M1 is the control that catches the finding', async () => {
	await inbox();
	const preFixRow = durableRowFor(PRE_FIX_MESSAGE, 46, 1);
	assert.equal(
		preFixRow.title,
		'Manual swap committed between entries entry-321::t2 and entry-421::t2',
		'precondition: the pre-fix message is stored VERBATIM as the inbox title - this is the defect',
	);
	assert.ok(
		ENTRY_ID_PATTERN.test(preFixRow.title),
		'so the pre-fix durable row carries an entry id, and M1 discriminates',
	);
	// And it is stored for EVERY recipient, not just one: the durable notify is
	// unconditional, so the defect reached each privileged actor in the school.
	assert.ok(
		durableRowFor(PRE_FIX_MESSAGE, 52, 1).title === preFixRow.title,
		'precondition: the stored title does not depend on the recipient',
	);
});

// ── M3 honest degradation ───────────────────────────────────────────────────

test('M3 an entry the server cannot name yields the contentless sentence, never a vague one', () => {
	for (const [label, input] of [
		['subject A unresolvable', { ...NAMED_INPUT, subjectA: null }],
		['subject B unresolvable', { ...NAMED_INPUT, subjectB: null }],
		['blank subject', { ...NAMED_INPUT, subjectA: '   ' }],
		['slot A missing its end', { ...NAMED_INPUT, slotA: { day: 'MONDAY', startTime: '07:30', endTime: '' } }],
		['slot B absent', { ...NAMED_INPUT, slotB: null }],
		['slot A absent', { ...NAMED_INPUT, slotA: undefined }],
	] as const) {
		const message = describeSwapCommitMessage(input as never);
		assert.equal(message, UNNAMED_SWAP_COMMIT_MESSAGE, `${label} yields the contentless sentence`);
		// It must not read as though it named something it did not.
		assert.ok(
			!/exchanged|between| and /i.test(message.replace(UNNAMED_SWAP_COMMIT_MESSAGE, '')),
			`${label}: the unnamed sentence claims no exchange it could not prove`,
		);
		assert.ok(!ENTRY_ID_PATTERN.test(message), `${label}: and carries no id`);
	}
	assert.equal(
		UNNAMED_SWAP_COMMIT_MESSAGE,
		'A manual change was committed to this schedule.',
		'the unnamed sentence states the one fact the server does know, and stops',
	);
});

// ── M4 the named sentence names the classes in words ────────────────────────

test('M4 the named sentence names both classes in words and claims only the exchange', () => {
	const message = describeSwapCommitMessage(NAMED_INPUT);
	assert.equal(
		message,
		'Manual swap committed: MAPEH and ESP exchanged their times between MONDAY 07:30-08:15 and WEDNESDAY 08:15-09:00.',
		'the message names the two classes and the two slots, in words',
	);
	assert.ok(!ENTRY_ID_PATTERN.test(message), 'and no id');
	// Direction-free on purpose: the server is given the PRE-swap positions, so a
	// "X took Y's slot" claim would assert a direction it was not given.
	assert.ok(!/took|replaced|moved to/i.test(message), 'it claims no direction the server was not given');
});

// ── M5 relocation disclosure matches the strategy ───────────────────────────

test('M5 an auto-fix discloses the relocation; a direct swap claims none', () => {
	const direct = describeSwapCommitMessage(NAMED_INPUT);
	assert.ok(!/relocated/.test(direct), 'a direct swap relocates nothing and claims no relocation');

	for (const strategy of ['AUTO_FIX_MOVE_BLOCKING', 'AUTO_FIX_MOVE_SOURCE']) {
		const message = describeSwapCommitMessage({ ...NAMED_INPUT, strategy });
		assert.match(message, /relocated to a different time/, `${strategy} discloses the relocation`);
		assert.match(message, /MAPEH and ESP exchanged their times/, `${strategy} still names the exchange`);
		assert.ok(!ENTRY_ID_PATTERN.test(message), `${strategy} still carries no id`);
	}
});

// ── M6 the ids stay in metadata, on purpose ────────────────────────────────

test('M6 the entry ids REMAIN in the event metadata, and this is load-bearing', async () => {
	await inbox();
	const row = durableRowFor(describeSwapCommitMessage(NAMED_INPUT), 46, 1);
	const data = row.data as Record<string, unknown>;
	assert.equal(
		data.entryIdA,
		ENTRY_A_ID,
		'the structured record keeps entryIdA: the accepted client fix resolves its labels from it',
	);
	assert.equal(
		data.entryIdB,
		ENTRY_B_ID,
		'the structured record keeps entryIdB for the same reason',
	);
	// The separation is the point: the HUMAN-READABLE projection is id-free while
	// the STRUCTURED one is not. Asserting both stops an over-broad redaction.
	assert.ok(
		!ENTRY_ID_PATTERN.test(row.title),
		'while the operator-readable title is id-free - the two are different surfaces',
	);
});

// ── M7 mounted: a real row in a real disposable database ───────────────────

const SAND_SCHOOL = 7_799_130;

describe(`M7 mounted durable projection (${RUNNABLE ? 'available' : 'unavailable'})`, () => {
	before(async () => {
		if (!harness) return;
		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: harness.targetUrl });
		await prisma.school.create({
			data: { id: SAND_SCHOOL, name: 'A2 Swap Message Sandbox', shortName: 'A2SWAPMSG' },
		});
		await prisma.atlasAuthAccount.create({
			data: {
				email: 'a2-swap-msg@example.com',
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
			// Zero residue, proved rather than asserted.
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

	test('M7 a real persistNotificationEvent writes a real id-free inbox title', async (t) => {
		if (!RUNNABLE || !harness || !prisma) {
			t.skip('disposable PostgreSQL harness unavailable');
			return;
		}
		const { persistNotificationEvent } = await import('../services/notification-inbox.service.js');
		const message = describeSwapCommitMessage(NAMED_INPUT);
		const { inserted } = await persistNotificationEvent(
			buildEvent(message, 46, SAND_SCHOOL),
		);
		assert.ok(inserted >= 1, 'the real durable path wrote a row');

		// Read the STORED title back out of the database, not out of the builder.
		const stored = await prisma.notification.findMany({ where: { schoolId: SAND_SCHOOL } });
		assert.ok(stored.length >= 1, 'the row is really persisted');
		for (const row of stored) {
			assert.ok(
				!ENTRY_ID_PATTERN.test(row.title),
				`the PERSISTED title carries an entry id: ${JSON.stringify(row.title)}`,
			);
			assert.equal(row.title, message.slice(0, 200), 'the persisted title is the plain-language message');
			assert.equal(row.type, 'TIMETABLE_EDIT_COMMITTED', 'and it is the swap event');
		}
	});
});

// ── M8 the self-exclusion gap, reported not fixed ──────────────────────────

test('M8 the durable audience includes the committing actor - reported, not fixed here', async () => {
	await inbox();
	// `resolveNotificationRecipients` resolves PRIVILEGED to every privileged
	// account in the school with no regard for who committed, and
	// `notifyDurableListeners` runs before any subscriber filtering. So the
	// committer receives their own row. That is a SEPARATE finding and this
	// candidate does not change it; this row documents the fact so the next lane
	// does not have to re-derive it.
	const row = durableRowFor(describeSwapCommitMessage(NAMED_INPUT), 46, 1);
	assert.equal(row.actorId, 46, 'a row is built for the committing actor themselves');
	assert.equal(row.type, 'TIMETABLE_EDIT_COMMITTED', 'and it is the swap event, not a filtered-out one');
	// Consequence of the correction: because the message is now plain-language and
	// describes the committed change accurately, that self-row is HONEST and merely
	// REDUNDANT - it is a true statement about something the operator just did. It
	// is not a misattribution, because it never claims anyone else made the change.
	assert.ok(!/someone|another|other scheduler/i.test(row.title), 'the self-row never claims another person acted');
});
