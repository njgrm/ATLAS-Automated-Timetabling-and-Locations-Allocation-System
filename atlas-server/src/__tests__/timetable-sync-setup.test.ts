/**
 * TT-SYNC-TERM-C03R4 — mounted "Sync timetable setup" per-term proof.
 *
 * Provisions a disposable PostgreSQL database (never the configured database),
 * applies the canonical schema only inside it, seeds one school whose active
 * year carries a verified ordered three-term contract, and exercises the REAL
 * `syncTimetableSetup` service plus the REAL mounted sync-setup router:
 *
 *  A. three-term ordinary demand (MATH five sessions in T1/T2/T3): a T1-only run
 *     must create five T2 and five T3 unassigned items and never report complete;
 *  B. rotation demand (BIO T1 / CHEM T2 / ES T3): wrong-term Science entries must
 *     not satisfy another member's demand;
 *  C. a correctly resolved three-term run produces zero new unassigned items;
 *  D. missing term identity expands through the canonical resolver; a present but
 *     out-of-contract term identity fails closed with a typed 409 and zero writes;
 *  E. assigned + unassigned per-term sessions equal canonical derived demand, and
 *     the canonical parity helper rejects T1-only and term-less mutants;
 *  F. mounted authorization matrix with an instrumented client proving every
 *     rejection dispatches zero service/DB operations;
 *  G. a stale expectedRunVersion returns typed 409 RUN_VERSION_STALE with a
 *     byte-identical run and zero new audit rows;
 *  H. two concurrent identical requests yield exactly one committed update and
 *     one typed stale rejection;
 *  I. a repeat sync against already-synchronized state replays with zero writes;
 * and a mounted committed sync publishes exactly one completion notification
 * while its verified replay publishes none.
 *
 * `try/finally` drops the disposable database and asserts zero residue.
 *
 * Run: `npx tsx src/__tests__/timetable-sync-setup.test.ts`
 * Skips safely when no PostgreSQL DATABASE_URL is configured.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

import { assertResolvedPerTermParity } from '../services/per-term-schedule-resolution.service.js';

const WORKDIR = process.cwd();
const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';
const JWT_SECRET = 'tt-sync-term-c03r4-disposable-proof-secret';
const ACTOR_ID = 1;
const SCHOOL_YEAR_ID = 9_000_246;
const SECTION_EXTERNAL_ID = 9_101;
const SESSIONS_PER_WEEK = 5;
const PERIOD_LENGTH_MINUTES = 45;

function readSourceDatabaseUrl(): string | null {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	try {
		const text = readFileSync(`${WORKDIR}/.env`, 'utf8');
		const line = text.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
		return line ? line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '') : null;
	} catch {
		return null;
	}
}

const SOURCE_URL = readSourceDatabaseUrl();
const RUNNABLE = Boolean(SOURCE_URL) && SOURCE_URL!.startsWith('postgres') && existsSync(PSQL);

function psql(argumentsList: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, argumentsList, { env, stdio: 'pipe' }).toString().trim();
}

let source: URL;
let disposableName: string;
let targetUrl: string;
let adminEnv: NodeJS.ProcessEnv;
let prisma: any = null;
let appServer: http.Server | null = null;
let disposableCreated = false;
let baseUrl = '';
let privilegedToken = '';
let facultyToken = '';
let noSchoolToken = '';
let crossSchoolToken = '';
let subscribeNotificationEvents: any;

let syncTimetableSetup: (schoolId: number, schoolYearId: number, runId: number, actorId: number, expectedRunVersion: number) => Promise<any>;

let schoolId: number;
const subjectIdByCode: Record<string, number> = {};
let facultyId: number;
let roomId: number;

function countUnassigned(items: any[], subjectId: number, termIndex: number): number {
	return items.filter((item) => item.subjectId === subjectId && item.termIndex === termIndex).length;
}

function countEntries(entries: any[], subjectId: number, termIndex: number): number {
	return entries.filter((entry) => entry.subjectId === subjectId && entry.termIndex === termIndex).length;
}

function makeEntries(subjectId: number, termIndex: number | undefined, count: number, prefix: string): any[] {
	const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	return Array.from({ length: count }, (_, index) => ({
		entryId: `${prefix}-${index + 1}`,
		facultyId,
		roomId,
		subjectId,
		sectionId: SECTION_EXTERNAL_ID,
		day: days[index % days.length],
		startTime: '07:00',
		endTime: '07:45',
		durationMinutes: PERIOD_LENGTH_MINUTES,
		...(termIndex === undefined ? {} : { termIndex }),
	}));
}

async function createRun(entries: any[], version = 1): Promise<any> {
	return prisma.generationRun.create({
		data: {
			schoolId,
			schoolYearId: SCHOOL_YEAR_ID,
			status: 'COMPLETED',
			triggeredBy: ACTOR_ID,
			draftEntries: entries as object[],
			unassignedItems: [] as object[],
			violations: [] as object[],
			summary: {} as object,
			version,
		},
	});
}

async function syncAuditCount(runId: number): Promise<number> {
	return prisma.auditLog.count({
		where: { schoolId, action: 'GENERATION_RUN_SYNCED_WITH_SETUP', targetIds: { has: runId } },
	});
}

function canonicalDemandEntries(): any[] {
	const entries: any[] = [];
	entries.push(...makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-t1'));
	entries.push(...makeEntries(subjectIdByCode.MATH, 2, SESSIONS_PER_WEEK, 'math-t2'));
	entries.push(...makeEntries(subjectIdByCode.MATH, 3, SESSIONS_PER_WEEK, 'math-t3'));
	entries.push(...makeEntries(subjectIdByCode.BIO, 1, SESSIONS_PER_WEEK, 'bio-t1'));
	entries.push(...makeEntries(subjectIdByCode.CHEM, 2, SESSIONS_PER_WEEK, 'chem-t2'));
	entries.push(...makeEntries(subjectIdByCode.ES, 3, SESSIONS_PER_WEEK, 'es-t3'));
	return entries;
}

before(async () => {
	if (!RUNNABLE) return;
	source = new URL(SOURCE_URL!);
	disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_synct${randomBytes(4).toString('hex')}`;
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/, 'disposable name must satisfy the repository guard');
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''), 'must never target the configured database');
	adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* absent */ }
	psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `CREATE DATABASE ${disposableName}`], adminEnv);
	disposableCreated = true;
	execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
		env: { ...process.env, DATABASE_URL: targetUrl },
		cwd: WORKDIR,
		stdio: 'pipe',
		shell: true,
	});

	// MUST precede the first import of lib/prisma so the singleton targets the
	// disposable database, never the configured one.
	process.env.DATABASE_URL = targetUrl;
	process.env.JWT_SECRET = JWT_SECRET;

	const { PrismaClient } = await import('@prisma/client');
	prisma = new PrismaClient({ datasourceUrl: targetUrl });
	await prisma.$connect();

	// ── Fixture school with a verified ordered three-term contract ───────────
	const school = await prisma.school.create({ data: { name: 'TT-SYNC-TERM-C03R4 Disposable', shortName: 'SYNCT' } });
	schoolId = school.id as number;
	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			yearLabel: '2030-2031',
			isActive: true,
			isArchived: false,
			syncStatus: 'synced',
			termContractCachedAt: new Date(),
			termContractCache: {
				schoolId,
				schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2030-2031' },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
					{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
					{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
				],
			},
		},
	});
	await prisma.schedulingPolicy.create({
		data: { schoolId, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: PERIOD_LENGTH_MINUTES, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' },
	});

	const building = await prisma.building.create({ data: { schoolId, name: 'Building 1', gradeScope: [7] } });
	const room = await prisma.room.create({ data: { buildingId: building.id, name: 'R1', type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' } });
	roomId = room.id as number;

	await prisma.sectionMirror.create({
		data: {
			externalId: SECTION_EXTERNAL_ID,
			schoolId,
			schoolYearId: SCHOOL_YEAR_ID,
			name: '7-A',
			gradeLevelId: 17,
			gradeLevelName: 'Grade 7',
			displayOrder: 7,
			maxCapacity: 50,
			enrolledCount: 40,
			programType: 'REGULAR',
			programCode: 'REGULAR',
			programName: 'Regular',
			isActiveForScheduling: true,
			isStale: false,
		},
	});

	const subjectRows = [
		{ code: 'MATH', name: 'Mathematics', rotationFamily: null as string | null, modularOrder: null as number | null },
		{ code: 'BIO', name: 'Biology', rotationFamily: 'SCIENCE', modularOrder: 1 },
		{ code: 'CHEM', name: 'Chemistry', rotationFamily: 'SCIENCE', modularOrder: 2 },
		{ code: 'ES', name: 'Earth Science', rotationFamily: 'SCIENCE', modularOrder: 3 },
	];
	for (const row of subjectRows) {
		const subject = await prisma.subject.create({
			data: {
				schoolId,
				code: row.code,
				name: row.name,
				schedulingDisposition: 'SCHEDULED_TEACHING' as const,
				minMinutesPerWeek: SESSIONS_PER_WEEK * PERIOD_LENGTH_MINUTES,
				preferredRoomType: 'CLASSROOM' as const,
				requiredFeatures: [],
				gradeLevels: [7],
				programScopes: ['REGULAR' as const],
				rotationFamily: row.rotationFamily,
				modularOrder: row.modularOrder,
				isActive: true,
			},
		});
		subjectIdByCode[row.code] = subject.id as number;
	}

	const faculty = await prisma.facultyMirror.create({
		data: { externalId: 710, schoolId, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 60, isActiveForScheduling: true, isStale: false },
	});
	facultyId = faculty.id as number;

	for (const code of Object.keys(subjectIdByCode)) {
		const subjectId = subjectIdByCode[code];
		const facultySubject = await prisma.facultySubject.create({
			data: { facultyId, subjectId, schoolId, schoolYearId: SCHOOL_YEAR_ID, gradeLevels: [7], sectionIds: [SECTION_EXTERNAL_ID], assignedBy: ACTOR_ID },
		});
		await prisma.subjectSectionOwnership.create({
			data: { schoolId, schoolYearId: SCHOOL_YEAR_ID, facultySubjectId: facultySubject.id, facultyId, subjectId, sectionId: SECTION_EXTERNAL_ID },
		});
	}

	// ── Mount the REAL sync-setup router with an instrumented data context ────
	const dataContext = await import('../lib/data-context.js');
	const prismaModule = await import('../lib/prisma.js');
	const base = (prismaModule as any).createTestPrismaClient();
	const instrumented = base.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }: any) {
					(globalThis as any).__syncSetupRecorded.push({ model, action: operation });
					return query(args);
				},
			},
		},
	});
	(globalThis as any).__syncSetupRecorded = [];

	const syncRouter = (await import('../routes/timetable-sync-setup.router.js')).default;
	syncTimetableSetup = (await import('../services/timetable-sync-setup.service.js')).syncTimetableSetup;
	subscribeNotificationEvents = (await import('../services/notification-events.service.js')).subscribeNotificationEvents;

	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void (dataContext as any).withDataContext(instrumented, async () => { next(); }); });
	app.use('/api/v1/generation', syncRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	appServer = http.createServer(app);
	await new Promise<void>((resolve) => appServer!.listen(0, '127.0.0.1', resolve));
	const address = appServer.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	baseUrl = `http://127.0.0.1:${port}`;
	privilegedToken = jwt.sign({ userId: ACTOR_ID, role: 'officer', schoolId, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	facultyToken = jwt.sign({ userId: 3, role: 'faculty', schoolId, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	noSchoolToken = jwt.sign({ userId: 4, role: 'officer', authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	crossSchoolToken = jwt.sign({ userId: 5, role: 'officer', schoolId: schoolId + 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
});

after(async () => {
	if (appServer) await new Promise<void>((resolve) => appServer!.close(() => resolve()));
	if (prisma) await prisma.$disconnect();
	if (disposableCreated) {
		try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* best effort */ }
		assert.equal(
			psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`], adminEnv),
			'0',
			'disposable database dropped (zero residue)',
		);
	}
});

const skip = RUNNABLE ? false : 'disposable PostgreSQL unavailable';

test('control A: a T1-only MATH schedule creates T2 and T3 unassigned items', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-t1'), 1);
	const result = await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);

	assert.equal(result.replayed, false);
	assert.equal(result.version, 2);
	assert.equal(result.addedUnassignedCount, 25, 'T2+T3 MATH (10) plus all 15 science sessions remain unresolved');
	assert.equal(result.summary.classesProcessed, 30, 'canonical three-term total');
	assert.equal(result.summary.assignedCount, 5);
	assert.equal(result.summary.unassignedCount, 25);

	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const unassignedItems = updated.unassignedItems as any[];
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 1), 0, 'T1 MATH is satisfied');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 2), SESSIONS_PER_WEEK, 'T2 MATH is unresolved');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 3), SESSIONS_PER_WEEK, 'T3 MATH is unresolved');
	for (const item of unassignedItems) {
		assert.ok(Number.isInteger(item.termIndex) && item.termIndex >= 1, 'every rebuilt unassigned item carries a positive termIndex');
	}
});

test('control B: wrong-term Science entries do not satisfy another rotation member', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.BIO, 1, SESSIONS_PER_WEEK, 'bio-t1'), 1);
	await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);
	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const unassignedItems = updated.unassignedItems as any[];

	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.BIO, 1), 0, 'BIO T1 is satisfied by the BIO entries');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.BIO, 2), 0, 'BIO never demands T2');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.BIO, 3), 0, 'BIO never demands T3');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.CHEM, 2), SESSIONS_PER_WEEK, 'CHEM T2 is unresolved');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.CHEM, 1), 0, 'CHEM never demands T1');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.ES, 3), SESSIONS_PER_WEEK, 'ES T3 is unresolved');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.ES, 2), 0, 'ES never demands T2');
});

test('control B2: a compact rotating-family lane expands to its term-owned members', { skip }, async () => {
	const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
	const lanes = days.map((day, index) => ({
		entryId: `sci-lane-${index + 1}`,
		facultyId,
		roomId,
		// The compact lane carries the family's primary subject id plus the
		// term-specific member/teacher; the canonical resolver maps the member
		// subject code to its real Subject id.
		subjectId: subjectIdByCode.BIO,
		sectionId: SECTION_EXTERNAL_ID,
		day,
		startTime: '07:00',
		endTime: '07:45',
		durationMinutes: PERIOD_LENGTH_MINUTES,
		metadata: {
			modularAssignments: [
				{ termIndex: 1, facultyId, subjectCode: 'BIO' },
				{ termIndex: 2, facultyId, subjectCode: 'CHEM' },
				{ termIndex: 3, facultyId, subjectCode: 'ES' },
			],
		},
	}));
	const run = await createRun(lanes, 1);
	await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);
	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const entries = updated.draftEntries as any[];
	const unassignedItems = updated.unassignedItems as any[];

	assert.equal(countEntries(entries, subjectIdByCode.BIO, 1), SESSIONS_PER_WEEK, 'BIO owns T1');
	assert.equal(countEntries(entries, subjectIdByCode.CHEM, 2), SESSIONS_PER_WEEK, 'CHEM owns T2');
	assert.equal(countEntries(entries, subjectIdByCode.ES, 3), SESSIONS_PER_WEEK, 'ES owns T3');
	assert.equal(unassignedItems.filter((item) => [subjectIdByCode.BIO, subjectIdByCode.CHEM, subjectIdByCode.ES].includes(item.subjectId)).length, 0, 'the rotation family is fully satisfied');
});

test('control C: a correctly resolved three-term run produces zero new unassigned items', { skip }, async () => {
	const run = await createRun(canonicalDemandEntries(), 1);
	const result = await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);

	assert.equal(result.replayed, false);
	assert.equal(result.addedUnassignedCount, 0, 'no canonical session is missing');
	assert.equal(result.summary.assignedCount, 30);
	assert.equal(result.summary.classesProcessed, 30);
	assert.equal(result.summary.unassignedCount, 0);

	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const entries = updated.draftEntries as any[];
	const unassignedItems = updated.unassignedItems as any[];
	assert.equal(entries.length, 30);
	assert.equal(unassignedItems.length, 0);
	assert.equal(countEntries(entries, subjectIdByCode.MATH, 1), SESSIONS_PER_WEEK);
	assert.equal(countEntries(entries, subjectIdByCode.MATH, 2), SESSIONS_PER_WEEK);
	assert.equal(countEntries(entries, subjectIdByCode.MATH, 3), SESSIONS_PER_WEEK);
	assert.equal(countEntries(entries, subjectIdByCode.BIO, 1), SESSIONS_PER_WEEK);
	assert.equal(countEntries(entries, subjectIdByCode.CHEM, 2), SESSIONS_PER_WEEK);
	assert.equal(countEntries(entries, subjectIdByCode.ES, 3), SESSIONS_PER_WEEK);
});

test('control D1: a missing term identity expands through the canonical resolver (never T1-only)', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.MATH, undefined, SESSIONS_PER_WEEK, 'math-any'), 1);
	await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);
	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const entries = updated.draftEntries as any[];
	const unassignedItems = updated.unassignedItems as any[];

	assert.equal(countEntries(entries, subjectIdByCode.MATH, 1), SESSIONS_PER_WEEK, 'year-long T1 expansion');
	assert.equal(countEntries(entries, subjectIdByCode.MATH, 2), SESSIONS_PER_WEEK, 'year-long T2 expansion');
	assert.equal(countEntries(entries, subjectIdByCode.MATH, 3), SESSIONS_PER_WEEK, 'year-long T3 expansion');
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 1), 0);
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 2), 0);
	assert.equal(countUnassigned(unassignedItems, subjectIdByCode.MATH, 3), 0);
});

test('control D2: a present but out-of-contract term identity fails closed with zero writes', { skip }, async () => {
	const invalidEntries = makeEntries(subjectIdByCode.MATH, 1, 1, 'math-bad');
	invalidEntries[0].termIndex = 9;
	const run = await createRun(invalidEntries, 1);
	const before = await prisma.generationRun.findUnique({ where: { id: run.id } });

	await assert.rejects(
		syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1),
		(error: any) => error?.statusCode === 409 && error?.code === 'INVALID_TERM_IDENTITY',
		'writes are never inferred from a present but invalid term identity',
	);

	const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(after.version, before.version);
	assert.deepEqual(after.draftEntries, before.draftEntries);
	assert.equal(await syncAuditCount(run.id), 0, 'no audit row exists for the rejected sync');
});

test('control E: canonical per-term parity rejects T1-only and term-less mutants', () => {
	const canonical = [
		{ subjectId: 1, sectionId: SECTION_EXTERNAL_ID, termIndex: 1, sessionsPerWeek: SESSIONS_PER_WEEK },
		{ subjectId: 1, sectionId: SECTION_EXTERNAL_ID, termIndex: 2, sessionsPerWeek: SESSIONS_PER_WEEK },
		{ subjectId: 1, sectionId: SECTION_EXTERNAL_ID, termIndex: 3, sessionsPerWeek: SESSIONS_PER_WEEK },
	];
	const t1Only = Array.from({ length: SESSIONS_PER_WEEK }, (_, index) => ({
		subjectId: 1,
		sectionId: SECTION_EXTERNAL_ID,
		termIndex: 1,
		sourceEntryId: `t1-${index}`,
	}));
	assert.throws(
		() => assertResolvedPerTermParity(t1Only, canonical),
		'the former subject/section-only match cannot satisfy three-term demand',
	);

	const termLess = [{ subjectId: 1, sectionId: SECTION_EXTERNAL_ID, termIndex: undefined as unknown as number, sourceEntryId: 'no-term' }];
	assert.throws(
		() => assertResolvedPerTermParity(termLess, [{ subjectId: 1, sectionId: SECTION_EXTERNAL_ID, termIndex: 1, sessionsPerWeek: 1 }]),
		'an entry without a term identity cannot satisfy canonical demand',
	);
});

test('control F: mounted authorization matrix rejects with zero service dispatch (and positive same-school commits)', { skip }, async () => {
	const recorded = () => (globalThis as any).__syncSetupRecorded as any[];
	const path = (runId: number) => `/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/runs/${runId}/sync-setup`;
	const post = (url: string, body: unknown, token?: string) => fetch(`${baseUrl}${url}`, {
		method: 'POST',
		headers: token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

	const run = await createRun(makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-f'), 1);

	// ── Positive: valid same-school actor commits, then replays without re-notifying ──
	let notificationCount = 0;
	const unsubscribe = subscribeNotificationEvents({
		schoolId,
		schoolYearId: SCHOOL_YEAR_ID,
		send: (event: any) => { if (event?.type === 'TIMETABLE_SETUP_SYNC_COMPLETED') notificationCount += 1; },
	});
	try {
		recorded().length = 0;
		const commitRes = await post(path(run.id), { expectedRunVersion: 1 }, privilegedToken);
		const commitBody = await commitRes.json();
		assert.equal(commitRes.status, 200, `same-school commit should succeed (got ${commitRes.status}/${commitBody.code})`);
		assert.equal(commitBody.replayed, false);
		assert.equal(commitBody.version, 2);
		assert.equal(notificationCount, 1, 'a committed sync publishes exactly one completion notification');

		recorded().length = 0;
		const replayRes = await post(path(run.id), { expectedRunVersion: 2 }, privilegedToken);
		const replayBody = await replayRes.json();
		assert.equal(replayRes.status, 200);
		assert.equal(replayBody.replayed, true);
		assert.equal(replayBody.version, 2);
		assert.equal(notificationCount, 1, 'a verified replay publishes no completion notification');
	} finally {
		unsubscribe();
	}

	// ── Negative matrix: every rejection precedes service/DB dispatch ─────────
	type Case = { label: string; url: string; body: unknown; token?: string; status: number; code?: string };
	const cases: Case[] = [
		{ label: 'missing token', url: path(run.id), body: { expectedRunVersion: 1 }, status: 401, code: 'NO_TOKEN' },
		{ label: 'invalid jwt', url: path(run.id), body: { expectedRunVersion: 1 }, token: 'not-a-jwt', status: 401, code: 'INVALID_TOKEN' },
		{ label: 'non-privileged actor', url: path(run.id), body: { expectedRunVersion: 1 }, token: facultyToken, status: 403, code: 'FORBIDDEN' },
		{ label: 'missing actor school', url: path(run.id), body: { expectedRunVersion: 1 }, token: noSchoolToken, status: 403, code: 'ACTOR_SCHOOL_UNRESOLVED' },
		{ label: 'cross-school actor', url: path(run.id), body: { expectedRunVersion: 1 }, token: crossSchoolToken, status: 403, code: 'CROSS_SCHOOL_DENIED' },
		{ label: 'malformed schoolId', url: `/api/v1/generation/0/${SCHOOL_YEAR_ID}/runs/${run.id}/sync-setup`, body: { expectedRunVersion: 1 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'malformed schoolYearId', url: `/api/v1/generation/${schoolId}/0/runs/${run.id}/sync-setup`, body: { expectedRunVersion: 1 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'malformed runId', url: `/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/runs/0/sync-setup`, body: { expectedRunVersion: 1 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'missing expectedRunVersion', url: path(run.id), body: {}, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'string expectedRunVersion', url: path(run.id), body: { expectedRunVersion: '2' }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'zero expectedRunVersion', url: path(run.id), body: { expectedRunVersion: 0 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'negative expectedRunVersion', url: path(run.id), body: { expectedRunVersion: -1 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'fractional expectedRunVersion', url: path(run.id), body: { expectedRunVersion: 1.5 }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
		{ label: 'boolean expectedRunVersion', url: path(run.id), body: { expectedRunVersion: true }, token: privilegedToken, status: 400, code: 'INVALID_PARAM' },
	];

	const auditsBefore = await syncAuditCount(run.id);
	for (const testCase of cases) {
		recorded().length = 0;
		const res = await post(testCase.url, testCase.body, testCase.token);
		const json = (await res.json()) as any;
		assert.equal(res.status, testCase.status, `${testCase.label} -> ${testCase.status} (got ${res.status}/${json.code})`);
		if (testCase.code) assert.equal(json.code, testCase.code, `${testCase.label} -> ${testCase.code}`);
		assert.equal(recorded().length, 0, `${testCase.label} dispatches zero service/DB operations`);
	}
	const runAfter = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(runAfter.version, 2, 'rejected requests never change the run');
	assert.equal(await syncAuditCount(run.id), auditsBefore, 'rejected requests never add an audit row');
});

test('control G: a stale expectedRunVersion returns typed 409 with zero writes', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-g'), 1);
	await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);
	const before = await prisma.generationRun.findUnique({ where: { id: run.id } });
	const auditsBefore = await syncAuditCount(run.id);

	await assert.rejects(
		syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1),
		(error: any) => error?.statusCode === 409 && error?.code === 'RUN_VERSION_STALE',
		'the stale expected version is rejected',
	);

	const after = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(after.version, before.version);
	assert.deepEqual(after.draftEntries, before.draftEntries);
	assert.equal(await syncAuditCount(run.id), auditsBefore, 'no audit row was written for the stale attempt');
});

test('control H: two concurrent identical requests yield one commit and one typed stale rejection', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-h'), 1);
	const settled = await Promise.allSettled([
		syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1),
		syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1),
	]);
	const fulfilled = settled.filter((entry) => entry.status === 'fulfilled');
	const rejected = settled.filter((entry): entry is PromiseRejectedResult => entry.status === 'rejected');

	assert.equal(fulfilled.length, 1, 'exactly one concurrent request commits');
	assert.equal(rejected.length, 1, 'the other is rejected');
	assert.equal((rejected[0].reason as any).code, 'RUN_VERSION_STALE', 'the losing request returns a typed stale rejection');

	const updated = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(updated.version, 2, 'exactly one version bump');
	assert.equal(await syncAuditCount(run.id), 1, 'exactly one audit row');
});

test('control I: a repeat sync against already-synchronized state replays with zero writes', { skip }, async () => {
	const run = await createRun(makeEntries(subjectIdByCode.MATH, 1, SESSIONS_PER_WEEK, 'math-i'), 1);
	const first = await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 1);
	assert.equal(first.replayed, false);
	const auditsAfterFirst = await syncAuditCount(run.id);
	const afterFirst = await prisma.generationRun.findUnique({ where: { id: run.id } });

	const replay = await syncTimetableSetup(schoolId, SCHOOL_YEAR_ID, run.id, ACTOR_ID, 2);
	assert.equal(replay.replayed, true);
	assert.equal(replay.noChange, true);
	assert.equal(replay.version, 2);
	assert.equal(replay.addedUnassignedCount, 0);

	const afterReplay = await prisma.generationRun.findUnique({ where: { id: run.id } });
	assert.equal(afterReplay.version, 2);
	assert.deepEqual(afterReplay.draftEntries, afterFirst.draftEntries, 'replay leaves the run byte-identical');
	assert.deepEqual(afterReplay.unassignedItems, afterFirst.unassignedItems);
	assert.equal(await syncAuditCount(run.id), auditsAfterFirst, 'replay writes no audit row');
});
