/**
 * TERM-CONSUME-C02 — cache-write authority and passive zero-write proof.
 *
 * Instruments the REAL production data-access path (`withDataContext` + Prisma
 * `$extends` query interception) and exercises:
 *
 *  A. The MOUNTED `GET /api/v1/subjects/scheduling-authority` route. A verified
 *     200 structure + 409 `ACTIVE_TERM_UNRESOLVED` must return a live verified
 *     ordered structure with `activeTerm: null` AND perform ZERO Prisma writes
 *     — the mirror cache must never be created, repaired, or updated by a
 *     passive read.
 *  B. A positive control proving the write detector observes a real,
 *     rolled-back write end-to-end.
 *  C. The explicit `syncActiveTermContractAuthority` writer: exactly one scoped
 *     cache revision is persisted, and a replay with the same semantic revision
 *     is idempotent (zero additional writes).
 *
 * Uses a disposable sandbox school and removes every created row in `finally`
 * with a zero-residue assertion. No migrations are applied.
 *
 * Run (server workspace): `npx tsx src/__tests__/term-contract-cache-instrumentation.test.ts`
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createServer, type Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';

const SCHOOL_ID = 9_100_077;
const ROLLOVER_SCHOOL_ID = 9_100_078;
const SCHOOL_YEAR_ID = 77;
const ACTOR_USER_ID = 9_100_077;

let passCount = 0;
let failCount = 0;

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
}

function loadServerEnv() {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		const content = readFileSync(resolve(here, '../../.env'), 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {}
}

const WRITE_ACTIONS = new Set([
	'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
	'executeRaw', 'queryRaw',
]);

type RecordedStatement = { model?: string; action: string };

const recorded: RecordedStatement[] = [];

function makeEnrollProServer(): Server {
	return createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		const activeYearId = SCHOOL_YEAR_ID;
		const activeYearLabel = '2030-2031';
		res.setHeader('content-type', 'application/json');
		if (url.pathname.endsWith('/integration/v1/health')) {
			res.end(JSON.stringify({ status: 'ok', service: 'enrollpro' }));
			return;
		}
		if (url.pathname.endsWith('/integration/v1/school-year')) {
			res.end(JSON.stringify({ data: {
				id: activeYearId,
				yearLabel: activeYearLabel,
				termFormat: 'TRIMESTER',
				terms: [
					{ identity: 'Term-A', displayLabel: 'Launch / Foundations', startDate: '2030-06-03', endDate: '2030-09-13' },
					{ identity: 'term-b', displayLabel: 'Studio Cycle β', startDate: '2030-09-16', endDate: '2031-01-10' },
					{ identity: 'term_C', displayLabel: 'Capstone + Defense', startDate: '2031-01-13', endDate: '2031-04-04' },
				],
			} }));
			return;
		}
		if (url.pathname.endsWith('/integration/v1/active-term')) {
			res.statusCode = 409;
			res.end(JSON.stringify({ code: 'ACTIVE_TERM_UNRESOLVED', message: 'no term contains today' }));
			return;
		}
		if (url.pathname.endsWith('/integration/v1/sections')) {
			res.end(JSON.stringify({
				data: [{ id: 9_100_078_01, name: 'C02 Rollover Section', maxCapacity: 45, enrolledCount: 30, programType: 'REGULAR', gradeLevel: { id: 7, name: 'Grade 7', displayOrder: 7 } }],
				meta: { page: 1, limit: 200, totalPages: 1 },
			}));
			return;
		}
		if (url.pathname.endsWith('/integration/v1/faculty') || url.pathname.endsWith('/integration/v1/default/faculty')) {
			res.end(JSON.stringify({
				data: [{
					teacherId: 9_100_078, employeeId: '9100078', firstName: 'C02', lastName: 'Teacher', fullName: 'C02 Teacher',
					departmentCode: 'MATH', departmentName: 'Mathematics', specialization: 'Mathematics',
					isActive: true, isTeachingExempt: false,
				}],
				meta: { page: 1, limit: 200, totalPages: 1 },
			}));
			return;
		}
		if (url.pathname.endsWith('/settings/public')) {
			res.end(JSON.stringify({ schoolName: 'C02 Rollover Sandbox', activeSchoolYearId: activeYearId, activeSchoolYearLabel: activeYearLabel }));
			return;
		}
		res.statusCode = 404;
		res.end(JSON.stringify({ error: 'not found' }));
	});
}

async function cleanupSchool(client: any, schoolId: number) {
	const runIds = (await client.generationRun.findMany({ where: { schoolId }, select: { id: true } })).map((run: any) => run.id);
	if (runIds.length > 0) {
		await client.manualScheduleEdit.deleteMany({ where: { runId: { in: runIds } } }).catch(() => {});
		await client.followUpFlag.deleteMany({ where: { runId: { in: runIds } } }).catch(() => {});
	}
	await client.generationRun.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.facultySnapshot.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.sectionSnapshot.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.schedulingPolicy.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.teachingLoadCycle.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.subjectSectionOwnership.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.facultySubject.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.classProgramSlot.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.auditLog.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.sectionMirror.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.facultyMirror.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } }).catch(() => {});
	await client.school.deleteMany({ where: { id: schoolId } }).catch(() => {});
}

async function main() {
	loadServerEnv();
	if (!process.env.DATABASE_URL) {
		console.error('[FAIL] DATABASE_URL is unavailable; cannot run the cache/zero-write test.');
		process.exit(1);
	}
	if (!process.env.JWT_SECRET) {
		console.error('[FAIL] JWT_SECRET is unavailable; cannot run the mounted-route test.');
		process.exit(1);
	}

	const prismaModule = await import('../lib/prisma.js');
	const dataContext = await import('../lib/data-context.js');
	const subjectRouter = (await import('../routes/subject.router.js')).default;
	const termService = await import('../services/enrollpro-term-contract.service.js');
	const rolloverService = await import('../services/enrollpro-rollover.service.js');

	const baseInstrumented = (prismaModule as any).createTestPrismaClient();
	const instrumented = baseInstrumented.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }: any) {
					recorded.push({ model, action: operation });
					return query(args);
				},
			},
		},
	});

	const enrollPro = makeEnrollProServer();
	await new Promise<void>((resolve) => enrollPro.listen(0, '127.0.0.1', resolve));
	const enrollProAddress = enrollPro.address();
	if (!enrollProAddress || typeof enrollProAddress !== 'object') throw new Error('no enrollpro port');
	const previousApi = process.env.ENROLLPRO_API;
	const previousToken = process.env.ENROLLPRO_SERVICE_TOKEN;
	process.env.ENROLLPRO_API = `http://127.0.0.1:${enrollProAddress.port}`;
	process.env.ENROLLPRO_SERVICE_TOKEN = 'term-cache-fixture-token';

	const testApp = express();
	testApp.use(express.json());
	testApp.use((_req, _res, next) => {
		void (dataContext as any).withDataContext(instrumented, async () => { next(); });
	});
	testApp.use('/api/v1/subjects', subjectRouter);
	const server = createServer(testApp);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address !== 'object') throw new Error('no app port');

	try {
		await baseInstrumented.school.create({ data: { id: SCHOOL_ID, name: 'TERM-C02 Zero-Write Sandbox', shortName: 'TC02Z' } });
		await baseInstrumented.enrollProSchoolYearMirror.create({ data: {
			schoolId: SCHOOL_ID,
			enrollProSchoolYearId: SCHOOL_YEAR_ID,
			yearLabel: '2030-2031',
			isActive: true,
			syncStatus: 'synced',
		} });

		section('A. mounted passive route verifies the structure, returns a null active term, and performs zero writes');

		const token = jwt.sign({ userId: ACTOR_USER_ID, role: 'admin', authSource: 'local', schoolId: SCHOOL_ID }, process.env.JWT_SECRET!, { expiresIn: '5m' });
		recorded.length = 0;
		const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/subjects/scheduling-authority?schoolYearId=${SCHOOL_YEAR_ID}`, {
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		});
		assertEqual(response.status, 200, 'mounted scheduling-authority returns 200');
		const body = await response.json() as any;
		assertEqual(body.termAuthority?.state, 'VERIFIED_LIVE', 'term authority is verified live');
		assertEqual(body.termAuthority?.contract?.activeTerm, null, 'active term is null under ACTIVE_TERM_UNRESOLVED');
		assertEqual(body.termAuthority?.contract?.activeTermState?.availability, 'UNRESOLVED', 'typed UNRESOLVED availability is preserved');
		assert(JSON.stringify(body.termAuthority?.contract?.terms?.map((term: any) => term.identity)) === JSON.stringify(['Term-A', 'term-b', 'term_C']), 'exact ordered identities are preserved');

		assert(recorded.some((stmt) => stmt.model === 'EnrollProSchoolYearMirror'), 'write detector is bound to the mounted route (mirror read observed)');
		const writes = recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
		assert(writes.length === 0, `mounted passive route performs zero Prisma writes (observed ${JSON.stringify(writes.slice(0, 5))})`);
		const mirrorAfterRead = await baseInstrumented.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { termContractCache: true, termContractCachedAt: true },
		});
		assertEqual(mirrorAfterRead?.termContractCache ?? null, null, 'passive read leaves the cache column NULL');
		assertEqual(mirrorAfterRead?.termContractCachedAt ?? null, null, 'passive read leaves the cached-at column NULL');

		section('B. positive control: the detector observes a real write, rolled back');

		const beforeControl = await baseInstrumented.enrollProSchoolYearMirror.findUniqueOrThrow({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { id: true, yearLabel: true },
		});
		recorded.length = 0;
		await instrumented.$transaction(async (tx: any) => {
			await tx.enrollProSchoolYearMirror.update({ where: { id: beforeControl.id }, data: { yearLabel: beforeControl.yearLabel } });
			throw new Error('TERM_C02_ROLLBACK_PROBE');
		}).catch((error: any) => {
			if (error?.message !== 'TERM_C02_ROLLBACK_PROBE') throw error;
		});
		const controlWrites = recorded.filter((stmt) => stmt.model === 'EnrollProSchoolYearMirror' && stmt.action === 'update');
		assert(controlWrites.length === 1, `detector observed the rolled-back mirror:update (${controlWrites.length})`);
		const afterControl = await baseInstrumented.enrollProSchoolYearMirror.findUniqueOrThrow({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { yearLabel: true },
		});
		assertEqual(afterControl.yearLabel, beforeControl.yearLabel, 'rolled-back control left persisted state unchanged');

		section('C. explicit sync writes exactly one scoped revision; replay is idempotent');

		recorded.length = 0;
		const sync1 = await (dataContext as any).withDataContext(instrumented, () =>
			(termService as any).syncActiveTermContractAuthority({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID }));
		assertEqual(sync1.state, 'VERIFIED_LIVE', 'first sync verifies live');
		assertEqual(sync1.written, true, 'first sync writes the cache');
		assertEqual(sync1.idempotent, false, 'first sync is not a replay');
		const syncWrites = recorded.filter((stmt) => stmt.model === 'EnrollProSchoolYearMirror' && WRITE_ACTIONS.has(stmt.action));
		assertEqual(syncWrites.length, 1, 'exactly one scoped cache write');
		const cached1 = await baseInstrumented.enrollProSchoolYearMirror.findUniqueOrThrow({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { termContractCache: true, termContractCachedAt: true },
		});
		assert(JSON.stringify((cached1.termContractCache as any)?.terms?.map((term: any) => term.identity)) === JSON.stringify(['Term-A', 'term-b', 'term_C']), 'cache stores the exact ordered identities');
		assertEqual((cached1.termContractCache as any)?.activeTerm ?? null, null, 'cache stores a nullable active term');
		assert(cached1.termContractCachedAt != null, 'cache stores the verification time');

		recorded.length = 0;
		const sync2 = await (dataContext as any).withDataContext(instrumented, () =>
			(termService as any).syncActiveTermContractAuthority({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID }));
		assertEqual(sync2.written, false, 'replay with the same semantic revision writes nothing');
		assertEqual(sync2.idempotent, true, 'replay is reported idempotent');
		assertEqual(sync2.semanticRevision, sync1.semanticRevision, 'replay shares the same semantic revision');
		const replayWrites = recorded.filter((stmt) => stmt.model === 'EnrollProSchoolYearMirror' && WRITE_ACTIONS.has(stmt.action));
		assertEqual(replayWrites.length, 0, 'replay performs zero additional writes');
		const cached2 = await baseInstrumented.enrollProSchoolYearMirror.findUniqueOrThrow({
			where: { schoolId_enrollProSchoolYearId: { schoolId: SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { termContractCachedAt: true },
		});
		assertEqual(cached2.termContractCachedAt!.getTime(), cached1.termContractCachedAt!.getTime(), 'replay leaves the verification time unchanged');

		section('D. the explicit actor-scoped rollover apply path persists the verified cache');

		await baseInstrumented.school.create({ data: { id: ROLLOVER_SCHOOL_ID, name: 'TERM-C02 Rollover Sandbox', shortName: 'TC02R' } });
		const rolloverResult = await (rolloverService as any).applyRolloverSync(ROLLOVER_SCHOOL_ID, 'term-cache-fixture-token', {
			actorId: ACTOR_USER_ID,
			initiatedBy: 'user',
			syncTermContract: true,
		});
		assertEqual(rolloverResult.termContract?.state, 'VERIFIED_LIVE', 'rollover reports a verified term-contract sync');
		assertEqual(rolloverResult.termContract?.written, true, 'rollover writes the verified cache');
		const rolloverMirror = await baseInstrumented.enrollProSchoolYearMirror.findUniqueOrThrow({
			where: { schoolId_enrollProSchoolYearId: { schoolId: ROLLOVER_SCHOOL_ID, enrollProSchoolYearId: SCHOOL_YEAR_ID } },
			select: { termContractCache: true, termContractCachedAt: true },
		});
		assert(JSON.stringify((rolloverMirror.termContractCache as any)?.terms?.map((term: any) => term.identity)) === JSON.stringify(['Term-A', 'term-b', 'term_C']), 'rollover persists the exact ordered identities');
		assertEqual((rolloverMirror.termContractCache as any)?.activeTerm ?? null, null, 'rollover persists a nullable active term');
		assert(rolloverMirror.termContractCachedAt != null, 'rollover persists the verification time');
	} finally {
		recorded.length = 0;
		await cleanupSchool(baseInstrumented, SCHOOL_ID);
		await cleanupSchool(baseInstrumented, ROLLOVER_SCHOOL_ID);
		const residueMirror = await baseInstrumented.enrollProSchoolYearMirror.count({ where: { schoolId: { in: [SCHOOL_ID, ROLLOVER_SCHOOL_ID] } } });
		const residueSchool = await baseInstrumented.school.count({ where: { id: { in: [SCHOOL_ID, ROLLOVER_SCHOOL_ID] } } });
		const residueSections = await baseInstrumented.sectionMirror.count({ where: { schoolId: { in: [SCHOOL_ID, ROLLOVER_SCHOOL_ID] } } });
		const residueAudits = await baseInstrumented.auditLog.count({ where: { schoolId: { in: [SCHOOL_ID, ROLLOVER_SCHOOL_ID] } } });
		assertEqual(residueMirror, 0, 'zero mirror residue after cleanup');
		assertEqual(residueSchool, 0, 'zero school residue after cleanup');
		assertEqual(residueSections, 0, 'zero section residue after cleanup');
		assertEqual(residueAudits, 0, 'zero audit residue after cleanup');
		await baseInstrumented.$disconnect();
		await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
		await new Promise<void>((resolve, reject) => enrollPro.close((error) => error ? reject(error) : resolve()));
		if (previousApi === undefined) delete process.env.ENROLLPRO_API; else process.env.ENROLLPRO_API = previousApi;
		if (previousToken === undefined) delete process.env.ENROLLPRO_SERVICE_TOKEN; else process.env.ENROLLPRO_SERVICE_TOKEN = previousToken;
	}

	console.log(`\n=== TERM-CONSUME-C02 cache/zero-write ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exit(1);
}

main().catch((error) => {
	console.error(`[FAIL] TERM-CONSUME-C02 cache/zero-write test crashed: ${String(error?.message ?? error).slice(0, 500)}`);
	process.exit(1);
});
