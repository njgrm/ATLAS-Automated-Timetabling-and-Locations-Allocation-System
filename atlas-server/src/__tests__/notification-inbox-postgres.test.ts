/**
 * NOTIFICATION-INBOX-C01 — mounted disposable-PostgreSQL inbox acceptance.
 *
 * Run (server workspace, disposable DATABASE_URL only):
 *   `npx tsx --test src/__tests__/notification-inbox-postgres.test.ts`
 * (gated through `npm run test:server-db`, which builds the per-file template
 * with `prisma migrate deploy` — the `notifications` table exists there.)
 *
 * Exercises the REAL production surface (real router + real persistence):
 *  1. A notification created while the actor is not on the page is present
 *     after a fresh list read, with the correct unread count.
 *  2. Mark-one decrements and mark-all zeroes.
 *  3. A notification is not visible to a different actor OR a different school
 *     (cross-actor read ⇒ typed 404; cross-school list ⇒ empty).
 *  4. The same delta raised twice produces ONE row (dedupe collapse).
 *  5. The item carries resourceType/resourceId for the client route.
 *
 * Failing-first authority controls: the cross-actor 404 and the unresolved
 * actor 403 are asserted against the live route — under the old behaviour
 * (no actor binding) a foreign id would resolve or the request would proceed.
 *
 * Zero residue: every sandbox row is removed in `finally` and the suite proves
 * no rows remain; the database itself is dropped by the runner.
 */
import http from 'node:http';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';
import { persistNotificationEvent } from '../services/notification-inbox.service.js';

const SAND_MAIN = 7799101;
const SAND_OTHER = 7799102;
const SAND_CAP = 7799103;
const YEAR = 9201;

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}

async function requestJson(baseUrl: string, path: string, options?: { token?: string; method?: string }) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (options?.token) headers.Authorization = `Bearer ${options.token}`;
	const response = await fetch(`${baseUrl}${path}`, { method: options?.method ?? 'GET', headers });
	let json: any = null;
	try {
		json = await response.json();
	} catch {
		json = null;
	}
	return { status: response.status, json };
}

function tokenFor(accountId: number, role: string, schoolId?: number): string {
	const payload: Record<string, unknown> = { userId: accountId, role, authSource: 'local', accountId };
	if (schoolId != null) payload.schoolId = schoolId;
	return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

async function seed() {
	for (const id of [SAND_MAIN, SAND_OTHER, SAND_CAP]) {
		await prisma.school.upsert({
			where: { id },
			create: { id, name: `NOTIF-INBOX Sandbox ${id}`, shortName: `NIB${id}` },
			update: {},
		});
	}
	const mkAccount = (email: string, schoolId: number, role: string) =>
		prisma.atlasAuthAccount.create({
			data: { email, schoolId, role, passwordHash: 'not-a-real-hash', isActive: true },
		});
	const actorA = await mkAccount('notif-inbox-a@example.com', SAND_MAIN, 'officer');
	const actorB = await mkAccount('notif-inbox-b@example.com', SAND_MAIN, 'officer');
	const actorC = await mkAccount('notif-inbox-c@example.com', SAND_OTHER, 'officer');
	return { actorA, actorB, actorC };
}

async function cleanup() {
	await prisma.notification.deleteMany({ where: { schoolId: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } });
	await prisma.atlasAuthAccount.deleteMany({ where: { schoolId: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } });
	await prisma.school.deleteMany({ where: { id: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } });
	return Promise.all([
		prisma.notification.count({ where: { schoolId: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } }),
		prisma.atlasAuthAccount.count({ where: { schoolId: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } }),
		prisma.school.count({ where: { id: { in: [SAND_MAIN, SAND_OTHER, SAND_CAP] } } }),
	]);
}

async function run() {
	if (!process.env.JWT_SECRET) {
		console.error('JWT_SECRET is not configured; aborting.');
		process.exitCode = 1;
		return;
	}

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	if (!address || typeof address === 'string') {
		server.close();
		process.exitCode = 1;
		return;
	}
	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	try {
		const { actorA, actorB, actorC } = await seed();
		const tokenA = tokenFor(actorA.id, 'officer', SAND_MAIN);
		const tokenB = tokenFor(actorB.id, 'officer', SAND_MAIN);
		const tokenC = tokenFor(actorC.id, 'officer', SAND_OTHER);

		section('Authority fails closed before any domain read');
		const noToken = await requestJson(baseUrl, '/notification-inbox/');
		assertEqual(noToken.status, 401, 'unauthenticated list → 401');
		assertEqual(noToken.json?.code, 'NO_TOKEN', 'unauthenticated list code');

		const unresolved = await requestJson(baseUrl, '/notification-inbox/', {
			token: tokenFor(actorA.id, 'officer'),
		});
		assertEqual(unresolved.status, 403, 'actor school unresolvable → 403');
		assertEqual(unresolved.json?.code, 'NOTIFICATION_ACTOR_UNRESOLVED', 'unresolved actor typed code');

		const unresolvedCount = await requestJson(baseUrl, '/notification-inbox/unread-count', {
			token: tokenFor(actorA.id, 'officer'),
		});
		assertEqual(unresolvedCount.status, 403, 'unresolved actor unread-count → 403');

		section('Acceptance 1 — created while away, present on fresh read');
		const first = await persistNotificationEvent({
			id: 7001,
			type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'ALL',
			timestamp: new Date().toISOString(),
			schoolId: SAND_MAIN,
			schoolYearId: YEAR,
			facultyId: null,
			message: 'Timetable setup sync completed for the sandbox year.',
			metadata: { runId: 77 },
		});
		assertEqual(first.skipped, false, 'first persist is not a skip');
		assertEqual(first.inserted, 2, 'ALL audience inserts one row per sandbox actor (A + B, never C)');

		const listA = await requestJson(baseUrl, '/notification-inbox/', { token: tokenA });
		assertEqual(listA.status, 200, 'fresh list read → 200');
		assertEqual(listA.json?.items?.length, 1, 'actor A sees exactly their own row');
		const countA = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenA });
		assertEqual(countA.json?.count, 1, 'unread count is 1 after the away-created notification');

		section('Acceptance 5 — the item carries its resource pointer');
		const item = listA.json?.items?.[0];
		assertEqual(item?.resourceType, 'integration', 'resourceType maps from the event domain');
		assertEqual(item?.resourceId, '77', 'resourceId maps from the metadata runId');
		assertEqual(item?.type, 'TIMETABLE_SETUP_SYNC_COMPLETED', 'type is verbatim from the event');
		assertEqual(item?.read, false, 'new row starts unread');

		section('Acceptance 3 — invisible across actors and schools');
		const listB = await requestJson(baseUrl, '/notification-inbox/', { token: tokenB });
		assertEqual(listB.json?.items?.length, 1, 'actor B sees exactly their own row');
		assert(
			listB.json?.items?.[0]?.id !== item?.id,
			'B’s row id differs from A’s row id (per-actor rows, never shared)',
		);
		const crossRead = await requestJson(baseUrl, `/notification-inbox/${item?.id}/read`, {
			token: tokenB,
			method: 'POST',
		});
		assertEqual(crossRead.status, 404, 'reading another actor’s id → 404');
		assertEqual(crossRead.json?.code, 'NOTIFICATION_NOT_FOUND', 'cross-actor read typed code');
		const listC = await requestJson(baseUrl, '/notification-inbox/', { token: tokenC });
		assertEqual(listC.json?.items?.length, 0, 'another school’s actor sees nothing');
		const countC = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenC });
		assertEqual(countC.json?.count, 0, 'another school’s unread count is 0');

		section('Acceptance 2 — mark-one decrements, mark-all zeroes');
		const markOne = await requestJson(baseUrl, `/notification-inbox/${item?.id}/read`, {
			token: tokenA,
			method: 'POST',
		});
		assertEqual(markOne.status, 200, 'mark-one → 200');
		assertEqual(markOne.json?.ok, true, 'mark-one body');
		const afterOne = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenA });
		assertEqual(afterOne.json?.count, 0, 'mark-one decrements the count to 0');
		const markOneAgain = await requestJson(baseUrl, `/notification-inbox/${item?.id}/read`, {
			token: tokenA,
			method: 'POST',
		});
		assertEqual(markOneAgain.status, 200, 'mark-one is idempotent → 200 again');

		const second = await persistNotificationEvent({
			id: 7002,
			type: 'ROOM_REQUEST_SYNC_COMPLETED',
			domain: 'room-request',
			severity: 'success',
			audience: 'PRIVILEGED',
			timestamp: new Date().toISOString(),
			schoolId: SAND_MAIN,
			schoolYearId: YEAR,
			facultyId: null,
			message: 'Room request sync completed for the sandbox year.',
			metadata: { requestId: 555 },
		});
		assertEqual(second.inserted, 2, 'PRIVILEGED audience inserts for both sandbox officers');
		const beforeAll = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenA });
		assertEqual(beforeAll.json?.count, 1, 'one unread before mark-all');
		const markAll = await requestJson(baseUrl, '/notification-inbox/read-all', {
			token: tokenA,
			method: 'POST',
		});
		assertEqual(markAll.json?.marked, 1, 'mark-all reports the marked total');
		const afterAll = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenA });
		assertEqual(afterAll.json?.count, 0, 'mark-all zeroes the count');
		const stillUnreadB = await requestJson(baseUrl, '/notification-inbox/unread-count', { token: tokenB });
		assertEqual(stillUnreadB.json?.count, 2, 'mark-all touches only the actor’s own rows');

		section('Acceptance 4 — the same delta raised twice produces one row');
		const rowsBefore = await prisma.notification.count({
			where: { actorId: actorA.id },
		});
		const repeat = await persistNotificationEvent({
			id: 7003,
			type: 'TIMETABLE_SETUP_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'ALL',
			timestamp: new Date().toISOString(),
			schoolId: SAND_MAIN,
			schoolYearId: YEAR,
			facultyId: null,
			message: 'Timetable setup sync completed for the sandbox year.',
			metadata: { runId: 77 },
		});
		assertEqual(repeat.inserted, 0, 're-raising the same delta inserts zero rows');
		const rowsAfter = await prisma.notification.count({ where: { actorId: actorA.id } });
		assertEqual(rowsAfter, rowsBefore, 'actor row total unchanged after the repeat raise');

		section('Keyset pagination holds newest-first');
		const paged = await requestJson(baseUrl, '/notification-inbox/?limit=1', { token: tokenA });
		assertEqual(paged.json?.items?.length, 1, 'limit=1 returns one item');
		assert(paged.json?.nextCursor != null, 'a next cursor is issued when more rows remain');
		const next = await requestJson(
			baseUrl,
			`/notification-inbox/?limit=1&cursor=${encodeURIComponent(paged.json.nextCursor)}`,
			{ token: tokenA },
		);
		assertEqual(next.json?.items?.length, 1, 'following the cursor returns the next item');
		assert(
			next.json?.items?.[0]?.id !== paged.json?.items?.[0]?.id,
			'the cursor advances (no repeated row)',
		);
		const badCursor = await requestJson(baseUrl, '/notification-inbox/?cursor=not-a-cursor', {
			token: tokenA,
		});
		assertEqual(badCursor.status, 400, 'malformed cursor → typed 400');

		section('Recipient cap refuses the whole fan-out on the real path');
		const capAccounts = Array.from({ length: 201 }, (_, index) =>
			prisma.atlasAuthAccount.create({
				data: {
					email: `notif-inbox-cap-${index}@example.com`,
					schoolId: SAND_CAP,
					role: 'faculty',
					passwordHash: 'not-a-real-hash',
					isActive: true,
				},
			}),
		);
		await Promise.all(capAccounts);
		const capped = await persistNotificationEvent({
			id: 7004,
			type: 'ROLLOVER_SYNC_COMPLETED',
			domain: 'integration',
			severity: 'success',
			audience: 'ALL',
			timestamp: new Date().toISOString(),
			schoolId: SAND_CAP,
			schoolYearId: YEAR,
			facultyId: null,
			message: 'Rollover sync completed for the cap sandbox.',
		});
		assertEqual(capped.skipped, true, 'over-cap event is a typed skip');
		assertEqual(capped.inserted, 0, 'over-cap event writes zero rows');
		assertEqual(
			await prisma.notification.count({ where: { schoolId: SAND_CAP } }),
			0,
			'no partial fan-out rows remain in the cap school',
		);
	} finally {
		const [notifications, accounts, schools] = await cleanup();
		assertEqual(notifications, 0, 'zero notification residue after cleanup');
		assertEqual(accounts, 0, 'zero account residue after cleanup');
		assertEqual(schools, 0, 'zero school residue after cleanup');
		server.close();
	}

	console.log(`\n═══ RESULT ${passCount} pass / ${failCount} fail ═══`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((err) => {
	console.error('Inbox postgres run failed:', err);
	process.exitCode = 1;
});
