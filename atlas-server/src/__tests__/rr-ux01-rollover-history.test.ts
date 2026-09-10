/**
 * RR-UX01 — rollover awareness + read-only Teaching Load history.
 *
 * Hermetic and zero-write:
 *  - notification scoping is exercised through the real service;
 *  - the school-level SSE route and the history router are mounted on a real
 *    ephemeral Express server;
 *  - the history router runs against an injected fake data context whose every
 *    write method throws and increments a counter, proving GET-only behavior.
 *
 * No database, no live rollover, no EnrollPro call.
 */

import assert from 'node:assert/strict';
import { createServer, request as httpRequest, type Server } from 'node:http';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import notificationRouter from '../routes/notification.router.js';
import teachingLoadHistoryRouter from '../routes/teaching-load-history.router.js';
import { withDataContext } from '../lib/data-context.js';
import {
	getNotificationEventsSince,
	getSchoolNotificationEventsSince,
	publishNotificationEvent,
	subscribeNotificationEvents,
	subscribeSchoolNotificationEvents,
	type NotificationEvent,
} from '../services/notification-events.service.js';

const SECRET = 'rr-ux01-hermetic-secret';

function sign(payload: Record<string, unknown>): string {
	return jwt.sign(payload, SECRET);
}

const officer7 = () => sign({ userId: 70, role: 'officer', authSource: 'local', schoolId: 7 });
const officer8 = () => sign({ userId: 80, role: 'officer', authSource: 'local', schoolId: 8 });
const faculty7 = () => sign({ userId: 30, role: 'faculty', authSource: 'local', schoolId: 7 });
const noSchool = () => sign({ userId: 90, role: 'officer', authSource: 'local' });

async function startServer(app: express.Express): Promise<{ server: Server; baseUrl: string }> {
	const server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	assert(address && typeof address !== 'string');
	return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function jsonErrorHandler(error: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction): void {
	res.status(error.statusCode ?? 500).json({ code: error.code ?? 'SERVER_ERROR', message: error.message });
}

/* ───────────────────────── Part 1: notification scoping ───────────────────────── */

function collect(schoolScoped: boolean, schoolId: number, schoolYearId = 0, facultyId: number | null = null) {
	const received: NotificationEvent[] = [];
	const unsubscribe = schoolScoped
		? subscribeSchoolNotificationEvents({ schoolId, send: (event) => received.push(event) })
		: subscribeNotificationEvents({ schoolId, schoolYearId, facultyId, send: (event) => received.push(event) });
	return { received, unsubscribe };
}

async function notificationScopingTests(): Promise<void> {
	const schoolStream = collect(true, 7);
	const oldYearStream = collect(false, 7, 19, null);
	const otherSchoolStream = collect(true, 8);
	const facultyStream = collect(false, 7, 20, 3);

	const rollover = publishNotificationEvent({
		type: 'ROLLOVER_ARCHIVE_SYNC_COMPLETED',
		domain: 'integration',
		severity: 'success',
		audience: 'PRIVILEGED',
		schoolId: 7,
		schoolYearId: 20,
		facultyId: null,
		message: 'Archived the old year and synced SY 2026-2027.',
	});

	assert.ok(
		schoolStream.received.some((event) => event.id === rollover.id),
		'privileged school-level stream receives the new-year rollover',
	);
	assert.equal(
		oldYearStream.received.length,
		0,
		'sensitivity: an old-year school-year stream does NOT receive the new-year rollover',
	);
	assert.equal(otherSchoolStream.received.length, 0, 'cross-school school-level stream receives nothing');
	assert.equal(facultyStream.received.length, 0, 'faculty year stream does not receive a privileged integration event');

	// Exact year-scoped delivery is preserved for ordinary events.
	const yearSubscriber = collect(false, 7, 19, null);
	const ordinary = publishNotificationEvent({
		type: 'GENERATION_RUN_COMPLETED',
		domain: 'generation',
		severity: 'success',
		audience: 'PRIVILEGED',
		schoolId: 7,
		schoolYearId: 19,
		facultyId: null,
		message: 'Generation complete.',
	});
	assert.ok(
		yearSubscriber.received.some((event) => event.id === ordinary.id),
		'exact year-scoped delivery still works',
	);
	assert.ok(
		!schoolStream.received.some((event) => event.id === ordinary.id),
		'school-level stream ignores non-integration/PRIVILEGED events',
	);

	// Missed-event replay is school-scoped and excludes cross-school/old-year.
	assert.ok(
		getSchoolNotificationEventsSince(rollover.id - 1, 7).some((event) => event.id === rollover.id),
		'school-level replay returns the rollover for the actor school',
	);
	assert.equal(
		getSchoolNotificationEventsSince(rollover.id - 1, 8).some((event) => event.id === rollover.id),
		false,
		'school-level replay for another school excludes the rollover',
	);
	const oldYearReplay = getNotificationEventsSince(rollover.id - 1, { schoolId: 7, schoolYearId: 19, facultyId: null });
	assert.ok(oldYearReplay.some((event) => event.id === ordinary.id), 'year-scoped replay returns same-year events');
	assert.equal(
		oldYearReplay.some((event) => event.id === rollover.id),
		false,
		'sensitivity: old-year replay never surfaces the new-year rollover',
	);

	for (const subscription of [schoolStream, oldYearStream, otherSchoolStream, facultyStream, yearSubscriber]) {
		subscription.unsubscribe();
	}
	const afterUnsubscribe = publishNotificationEvent({
		type: 'ROLLOVER_SYNC_COMPLETED',
		domain: 'integration',
		severity: 'success',
		audience: 'PRIVILEGED',
		schoolId: 7,
		schoolYearId: 21,
		facultyId: null,
		message: 'Another rollover.',
	});
	assert.equal(schoolStream.received.some((event) => event.id === afterUnsubscribe.id), false, 'unsubscribe stops delivery');
	console.log('PASS: notification scoping (school-level rollover, cross-school, faculty, old-year sensitivity)');
}

/* ───────────────────────── Part 2: mounted notification route ───────────────────────── */

async function notificationRouteTests(): Promise<void> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = SECRET;
	let started: { server: Server; baseUrl: string } | undefined;
	try {
		const app = express();
		app.use(express.json());
		app.use('/api/v1/notifications', notificationRouter);
		app.use(jsonErrorHandler);
		started = await startServer(app);
		const { baseUrl } = started;

		const get = (path: string, token?: string) => fetch(`${baseUrl}${path}`, {
			headers: token ? { authorization: `Bearer ${token}` } : {},
		});

		assert.equal((await get('/api/v1/notifications/7/events')).status, 401, 'school stream requires a token');
		assert.equal((await get('/api/v1/notifications/7/events', faculty7())).status, 403, 'faculty cannot open the privileged school stream');
		assert.equal((await get('/api/v1/notifications/7/events?', officer8())).status, 403, 'cross-school school stream is rejected');
		const mismatch = await get('/api/v1/notifications/8/events', officer7());
		assert.equal(mismatch.status, 403);
		assert.equal((await mismatch.json() as { code: string }).code, 'SCHOOL_SCOPE_MISMATCH');
		const noScope = await get('/api/v1/notifications/7/events', noSchool());
		assert.equal(noScope.status, 403);
		assert.equal((await noScope.json() as { code: string }).code, 'SCHOOL_SCOPE_REQUIRED');
		assert.equal((await get('/api/v1/notifications/abc/events', officer7())).status, 400, 'invalid schoolId rejected');

		// Real SSE path: an old-year officer still receives the new-year rollover.
		const sse = await readSseRollover(baseUrl, 7, officer7());
		assert.equal(sse.status, 200, 'school-level SSE connects for the actor school');
		assert.ok(sse.text.includes('retry: 2000'), 'SSE stream opens');
		assert.ok(sse.text.includes('"type":"ROLLOVER_SYNC_COMPLETED"'), 'SSE stream delivers the rollover event');
		assert.ok(sse.text.includes('"schoolYearId":20'), 'delivered event names the new active year');
		console.log('PASS: mounted notification route guards + SSE rollover delivery');
	} finally {
		if (started) await closeServer(started.server);
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

function readSseRollover(baseUrl: string, schoolId: number, token: string): Promise<{ status: number; text: string }> {
	const url = new URL(`${baseUrl}/api/v1/notifications/${schoolId}/events`);
	return new Promise((resolve, reject) => {
		const chunks: string[] = [];
		let published = false;
		const timer = setTimeout(() => {
			request.destroy();
			reject(new Error('timed out waiting for the rollover SSE frame'));
		}, 8000);
		const request = httpRequest(
			{ hostname: url.hostname, port: url.port, path: url.pathname, headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' } },
			(response) => {
				const status = response.statusCode ?? 0;
				response.setEncoding('utf8');
				response.on('data', (chunk: string) => {
					chunks.push(chunk);
					if (!published && chunks.join('').includes('retry: 2000')) {
						published = true;
						publishNotificationEvent({
							type: 'ROLLOVER_SYNC_COMPLETED',
							domain: 'integration',
							severity: 'success',
							audience: 'PRIVILEGED',
							schoolId,
							schoolYearId: 20,
							facultyId: null,
							message: 'Synced the new active year.',
						});
					}
					if (chunks.join('').includes('"type":"ROLLOVER_SYNC_COMPLETED"')) {
						clearTimeout(timer);
						request.destroy();
						resolve({ status, text: chunks.join('') });
					}
				});
				response.on('end', () => {
					clearTimeout(timer);
					resolve({ status, text: chunks.join('') });
				});
			},
		);
		request.on('error', () => { /* destroyed after resolve */ });
		request.end();
	});
}

/* ───────────────────────── Part 3: mounted history router ───────────────────────── */

type YearRow = {
	schoolId: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isArchived: boolean;
	archivedAt: Date | null;
	archiveReason: string | null;
};
type CycleRow = {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: Date;
	updatedAt: Date;
};

const NOW = new Date('2026-09-10T00:00:00.000Z');

function historyFixture() {
	const years: YearRow[] = [
		{ schoolId: 7, enrollProSchoolYearId: 19, yearLabel: 'SY 2025-2026', isArchived: true, archivedAt: NOW, archiveReason: 'rollover' },
		{ schoolId: 7, enrollProSchoolYearId: 18, yearLabel: 'SY 2024-2025', isArchived: true, archivedAt: NOW, archiveReason: 'rollover' },
		{ schoolId: 7, enrollProSchoolYearId: 20, yearLabel: 'SY 2026-2027', isArchived: false, archivedAt: null, archiveReason: null },
		{ schoolId: 8, enrollProSchoolYearId: 30, yearLabel: 'SY 2025-2026', isArchived: true, archivedAt: NOW, archiveReason: 'rollover' },
	];
	const cycles: CycleRow[] = [
		{ schoolId: 7, schoolYearId: 19, state: 'POPULATED', version: 4, initializedAt: NOW, updatedAt: NOW },
		{ schoolId: 7, schoolYearId: 18, state: 'EMPTY', version: 1, initializedAt: NOW, updatedAt: NOW },
		{ schoolId: 8, schoolYearId: 30, state: 'POPULATED', version: 2, initializedAt: NOW, updatedAt: NOW },
	];
	const assignments = [
		{
			schoolId: 7, schoolYearId: 19, id: 501, sectionIds: [101], assignedAt: NOW,
			faculty: { id: 11, firstName: 'Ana', lastName: 'Reyes', department: 'Mathematics' },
			subject: { id: 21, code: 'MATH7', name: 'Mathematics 7', outputLabel: 'Mathematics 7', minMinutesPerWeek: 240 },
		},
	];
	const sections = [
		{ schoolId: 7, schoolYearId: 19, externalId: 101, name: 'Grade 7 - Rizal', gradeLevelName: 'Grade 7', displayOrder: 7 },
	];
	return { years, cycles, assignments, sections };
}

function historyClient(fixture: ReturnType<typeof historyFixture>, writes: { count: number }) {
	const unsupported = (model: string) => async () => {
		writes.count += 1;
		throw new Error(`unexpected write on ${model}`);
	};
	const writeMethods = (model: string) => ({
		create: unsupported(model), createMany: unsupported(model), update: unsupported(model),
		updateMany: unsupported(model), upsert: unsupported(model), delete: unsupported(model), deleteMany: unsupported(model),
	});
	const client: any = {
		enrollProSchoolYearMirror: {
			findMany: async ({ where }: any) => fixture.years
				.filter((year) => year.schoolId === where.schoolId && year.isArchived === where.isArchived)
				.map((year) => ({ ...year })),
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_enrollProSchoolYearId;
				const match = fixture.years.find((year) => year.schoolId === key.schoolId && year.enrollProSchoolYearId === key.enrollProSchoolYearId);
				return match ? { ...match } : null;
			},
			...writeMethods('enrollProSchoolYearMirror'),
		},
		teachingLoadCycle: {
			findMany: async ({ where }: any) => fixture.cycles
				.filter((cycle) => cycle.schoolId === where.schoolId && where.schoolYearId.in.includes(cycle.schoolYearId))
				.map((cycle) => ({ ...cycle })),
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_schoolYearId;
				const match = fixture.cycles.find((cycle) => cycle.schoolId === key.schoolId && cycle.schoolYearId === key.schoolYearId);
				return match ? { ...match } : null;
			},
			...writeMethods('teachingLoadCycle'),
		},
		facultySubject: {
			findMany: async ({ where }: any) => fixture.assignments
				.filter((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId)
				.map((row) => structuredClone(row)),
			...writeMethods('facultySubject'),
		},
		sectionMirror: {
			findMany: async ({ where }: any) => fixture.sections
				.filter((row) => row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId)
				.map((row) => ({ ...row })),
			...writeMethods('sectionMirror'),
		},
	};
	return client;
}

async function historyRouteTests(): Promise<void> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = SECRET;
	const writes = { count: 0 };
	const client = historyClient(historyFixture(), writes);
	let started: { server: Server; baseUrl: string } | undefined;
	try {
		await withDataContext(client, async () => {
			const app = express();
			app.use(express.json());
			app.use('/api/v1/teaching-load', teachingLoadHistoryRouter);
			app.use(jsonErrorHandler);
			started = await startServer(app);
			const { baseUrl } = started;
			const get = (path: string, token?: string) => fetch(`${baseUrl}${path}`, {
				headers: token ? { authorization: `Bearer ${token}` } : {},
			});

			assert.equal((await get('/api/v1/teaching-load/history-years')).status, 401, 'history years require auth');
			assert.equal((await get('/api/v1/teaching-load/history-years', faculty7())).status, 403, 'history years are privileged-only');

			const list = await get('/api/v1/teaching-load/history-years', officer7());
			assert.equal(list.status, 200);
			const listBody = await list.json() as { schoolId: number; years: Array<{ schoolYearId: number; isArchived: boolean; cycle: unknown }> };
			assert.equal(listBody.schoolId, 7, 'history is scoped to the authenticated actor school');
			assert.deepEqual(listBody.years.map((year) => year.schoolYearId).sort((a, b) => a - b), [18, 19], 'only this school’s archived years are returned');
			assert.ok(listBody.years.every((year) => year.isArchived === true), 'only archived years are listed');

			const otherList = await get('/api/v1/teaching-load/history-years', officer8());
			const otherBody = await otherList.json() as { schoolId: number; years: Array<{ schoolYearId: number }> };
			assert.equal(otherBody.schoolId, 8);
			assert.deepEqual(otherBody.years.map((year) => year.schoolYearId), [30], 'another school never sees school 7 history');

			const detail = await get('/api/v1/teaching-load/history-years/19', officer7());
			assert.equal(detail.status, 200);
			const detailBody = await detail.json() as any;
			assert.equal(detailBody.isArchived, true);
			assert.equal(detailBody.cycle.state, 'POPULATED');
			assert.equal(detailBody.teachers.length, 1);
			assert.equal(detailBody.teachers[0].assignments[0].subjectCode, 'MATH7');
			assert.equal(detailBody.teachers[0].assignments[0].sections[0].sectionName, 'Grade 7 - Rizal');

			const emptyCycle = await get('/api/v1/teaching-load/history-years/18', officer7());
			assert.equal(emptyCycle.status, 200);
			assert.equal(((await emptyCycle.json()) as any).cycle.state, 'EMPTY');

			const notArchived = await get('/api/v1/teaching-load/history-years/20', officer7());
			assert.equal(notArchived.status, 409);
			assert.equal(((await notArchived.json()) as { code: string }).code, 'HISTORY_YEAR_NOT_ARCHIVED');

			const crossSchoolYear = await get('/api/v1/teaching-load/history-years/19', officer8());
			assert.equal(crossSchoolYear.status, 404, 'another school cannot open school 7 archived history');

			const missing = await get('/api/v1/teaching-load/history-years/999', officer7());
			assert.equal(missing.status, 404);
			assert.equal(((await missing.json()) as { code: string }).code, 'HISTORY_YEAR_NOT_FOUND');

			assert.equal((await get('/api/v1/teaching-load/history-years/not-a-number', officer7())).status, 400);
		});
		assert.equal(writes.count, 0, 'history browsing performed zero writes');
		console.log('PASS: mounted history router actor/school/year scoping + zero writes');
	} finally {
		if (started) await closeServer(started.server);
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

async function main(): Promise<void> {
	await notificationScopingTests();
	await notificationRouteTests();
	await historyRouteTests();
	console.log('\nRR-UX01 rollover awareness + history tests: PASS');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
