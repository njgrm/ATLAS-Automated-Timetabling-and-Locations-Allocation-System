/**
 * ACTOR-SCOPE-C01 — mounted runtime READ-route actor/tenant scope proof.
 *
 * Mounts the REAL runtime router and the REAL `authenticateWithSystemToken`
 * middleware in express and exercises the strict gate on exactly:
 *   GET /api/v1/runtime/context
 *   GET /api/v1/runtime/rollover-status
 *   GET /api/v1/runtime/rollover-recovery/classify
 *
 * The disposable-PostgreSQL test is declared FIRST so `DATABASE_URL` points at
 * the disposable database before `lib/prisma` constructs its singleton; the
 * negative matrix test follows and dispatches nothing (it uses an injected,
 * unconnected client and asserts zero DB + zero upstream work on every
 * rejection, which is the decisive fail-closed proof).
 *
 * Run: `npx tsx src/__tests__/runtime-router-actor-scope.test.ts`
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

const WORKDIR = process.cwd();
const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';
const JWT_SECRET = 'actor-scope-c01-disposable-proof-secret';
const SYSTEM_TOKEN = 'actor-scope-c01-system-token-not-a-jwt';

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

function psqlRunner(env: NodeJS.ProcessEnv) {
	return (args: string[]) => execFileSync(PSQL, args, { env, stdio: 'pipe' }).toString().trim();
}

// ── Positive: valid same-school scope reaches the service (disposable DB) ─────

test('runtime read routes accept valid same-school scope (disposable PostgreSQL)', { skip: RUNNABLE ? false : 'disposable PostgreSQL unavailable' }, async () => {
	const source = new URL(SOURCE_URL!);
	const disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_asc${randomBytes(4).toString('hex')}`;
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/);
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''), 'never target the configured database');
	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const psql = psqlRunner(adminEnv);
	const targetUrl = (() => { const copy = new URL(source.toString()); copy.pathname = `/${disposableName}`; return copy.toString(); })();

	let appServer: http.Server | null = null;
	let enrollProServer: http.Server | null = null;
	let disposableCreated = false;
	const SCHOOL_YEAR_ID = 9_000_077;

	try {
		try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`]); } catch { /* absent */ }
		psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `CREATE DATABASE ${disposableName}`]);
		disposableCreated = true;
		execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], { env: { ...process.env, DATABASE_URL: targetUrl }, cwd: WORKDIR, stdio: 'pipe', shell: true });

		// MUST precede the first import of lib/prisma so the singleton targets the
		// disposable database, never the configured one.
		process.env.DATABASE_URL = targetUrl;
		process.env.JWT_SECRET = JWT_SECRET;
		process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;

		enrollProServer = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', 'http://127.0.0.1');
			res.setHeader('content-type', 'application/json');
			if (url.pathname.endsWith('/integration/v1/health')) { res.end(JSON.stringify({ status: 'ok', service: 'enrollpro' })); return; }
			if (url.pathname.endsWith('/integration/v1/school-year')) {
				res.end(JSON.stringify({ data: { id: SCHOOL_YEAR_ID, schoolId: 1, yearLabel: '2030-2031', termFormat: 'TRIMESTER', terms: [
					{ identity: 'T1', displayLabel: 'First Trimester', startDate: '2030-06-03', endDate: '2030-09-13' },
					{ identity: 'T2', displayLabel: 'Second Trimester', startDate: '2030-09-16', endDate: '2031-01-10' },
					{ identity: 'T3', displayLabel: 'Third Trimester', startDate: '2031-01-13', endDate: '2031-04-04' },
				] } }));
				return;
			}
			if (url.pathname.endsWith('/integration/v1/active-term')) { res.statusCode = 409; res.end(JSON.stringify({ code: 'ACTIVE_TERM_UNRESOLVED', message: 'no term contains today' })); return; }
			if (url.pathname.endsWith('/integration/v1/sections')) { res.end(JSON.stringify({ data: [], meta: { page: 1, limit: 200, totalPages: 1 } })); return; }
			if (url.pathname.endsWith('/integration/v1/faculty') || url.pathname.endsWith('/integration/v1/default/faculty')) { res.end(JSON.stringify({ data: [], meta: { page: 1, limit: 200, totalPages: 1 } })); return; }
			if (url.pathname.endsWith('/settings/public')) { res.end(JSON.stringify({ schoolName: 'ACTOR-SCOPE-C01 Sandbox', activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2030-2031' })); return; }
			res.statusCode = 404;
			res.end(JSON.stringify({ error: 'not found' }));
		});
		await new Promise<void>((resolve) => enrollProServer!.listen(0, '127.0.0.1', resolve));
		const enrollProAddress = enrollProServer.address();
		if (enrollProAddress && typeof enrollProAddress === 'object') process.env.ENROLLPRO_API = `http://127.0.0.1:${enrollProAddress.port}`;

		const { PrismaClient } = await import('@prisma/client');
		const prisma = new PrismaClient({ datasourceUrl: targetUrl });
		await prisma.$connect();
		const school = await prisma.school.create({ data: { name: 'ACTOR-SCOPE-C01 Disposable', shortName: 'ASC01' } });
		const schoolId = school.id as number;
		await prisma.enrollProSchoolYearMirror.create({ data: { schoolId, enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2030-2031', isActive: true, isArchived: false, syncStatus: 'synced' } });
		await prisma.schedulingPolicy.create({ data: { schoolId, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' } });

		const runtimeRouter = (await import('../routes/runtime.router.js')).default;
		const app = express();
		app.use(express.json());
		app.use('/api/v1/runtime', runtimeRouter);
		app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) }); });
		appServer = http.createServer(app);
		await new Promise<void>((resolve) => appServer!.listen(0, '127.0.0.1', resolve));
		const appAddress = appServer.address();
		const port = typeof appAddress === 'object' && appAddress ? appAddress.port : 0;
		const baseUrl = `http://127.0.0.1:${port}`;
		const privileged = jwt.sign({ userId: 1, role: 'officer', schoolId, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
		const faculty = jwt.sign({ userId: 3, role: 'faculty', schoolId, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
		const get = (path: string, token: string) => fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });

		// Positive: valid same-school operator reaches the service (not gated).
		const statusRes = await get(`/api/v1/runtime/rollover-status?schoolId=${schoolId}`, privileged);
		const statusBody = await statusRes.text();
		assert.ok(statusRes.status < 400, `same-school operator rollover-status should not be gated (got ${statusRes.status}: ${statusBody})`);

		// Positive: /context remains readable by same-school faculty.
		const facultyContext = await get(`/api/v1/runtime/context?schoolId=${schoolId}`, faculty);
		assert.notEqual(facultyContext.status, 403, `same-school faculty /context must not be forbidden (got ${facultyContext.status})`);

		// Positive: system token with an explicit school is allowed for any school.
		const systemStatus = await get(`/api/v1/runtime/rollover-status?schoolId=${schoolId}`, SYSTEM_TOKEN);
		assert.ok(systemStatus.status < 400, `system token with explicit school should not be gated (got ${systemStatus.status})`);
	} finally {
		if (appServer) await new Promise<void>((resolve) => appServer!.close(() => resolve()));
		if (enrollProServer) await new Promise<void>((resolve) => enrollProServer!.close(() => resolve()));
		if (disposableCreated) {
			try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`]); } catch { /* best effort */ }
			assert.equal(psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`]), '0', 'disposable database dropped (zero residue)');
		}
	}
});

// ── Negative: every rejection is typed and dispatches ZERO work ───────────────

test('runtime read routes reject missing/invalid/cross-school scope with ZERO dispatch', async () => {
	// Fail-safe: if lib/prisma is first imported here (no disposable DB test),
	// point the singleton at a non-existent host so an accidental dispatch can
	// never touch a real database. Rejections must dispatch nothing.
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = SYSTEM_TOKEN;
	(globalThis as any).__runtimeScopeRecorded = [];

	let upstreamRequests = 0;
	const enrollPro = http.createServer((_req, res) => { upstreamRequests += 1; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ data: null })); });
	await new Promise<void>((resolve) => enrollPro.listen(0, '127.0.0.1', resolve));
	const enrollProAddress = enrollPro.address();
	if (enrollProAddress && typeof enrollProAddress === 'object') process.env.ENROLLPRO_API = `http://127.0.0.1:${enrollProAddress.port}`;

	const { createTestPrismaClient } = await import('../lib/prisma.js');
	const dataContext = await import('../lib/data-context.js');
	const runtimeRouter = (await import('../routes/runtime.router.js')).default;
	const base = createTestPrismaClient();
	const instrumented = base.$extends({ query: { $allModels: { async $allOperations({ model, operation, args, query }: any) { (globalThis as any).__runtimeScopeRecorded.push({ model, action: operation }); return query(args); } } } });
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void (dataContext as any).withDataContext(instrumented, async () => { next(); }); });
	app.use('/api/v1/runtime', runtimeRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) }); });
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}`;

	const privileged = jwt.sign({ userId: 1, role: 'officer', schoolId: 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	const faculty = jwt.sign({ userId: 3, role: 'faculty', schoolId: 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	const noSchoolActor = jwt.sign({ userId: 4, role: 'officer', authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
	const crossSchool = jwt.sign({ userId: 2, role: 'officer', schoolId: 99, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });

	const get = (path: string, headers: Record<string, string> = {}) => fetch(`${baseUrl}/api/v1/runtime${path}`, { headers });

	type Case = { label: string; path: string; headers?: Record<string, string>; status: number; code?: string };
	const routes = ['/context', '/rollover-status', '/rollover-recovery/classify'];
	const operatorOnly = new Set(['/rollover-status', '/rollover-recovery/classify']);

	const cases: Case[] = [];
	for (const route of routes) {
		cases.push({ label: `${route} no token`, path: `${route}?schoolId=1`, status: 401, code: 'NO_TOKEN' });
		cases.push({ label: `${route} invalid jwt`, path: `${route}?schoolId=1`, headers: { authorization: 'Bearer not-a-valid-jwt' }, status: 401, code: 'INVALID_TOKEN' });
		for (const [label, value] of [['missing', null], ['empty', ''], ['abc', 'abc'], ['zero', '0'], ['negative', '-1'], ['fractional', '1.5']] as const) {
			const query = value === null ? '' : `?schoolId=${encodeURIComponent(value)}`;
			cases.push({ label: `${route} system token schoolId ${label}`, path: `${route}${query}`, headers: { authorization: `Bearer ${SYSTEM_TOKEN}` }, status: 400, code: 'INVALID_PARAM' });
		}
		cases.push({ label: `${route} jwt missing actor school`, path: `${route}?schoolId=1`, headers: { authorization: `Bearer ${noSchoolActor}` }, status: 403, code: 'SCHOOL_SCOPE_REQUIRED' });
		cases.push({ label: `${route} jwt cross-school`, path: `${route}?schoolId=1`, headers: { authorization: `Bearer ${crossSchool}` }, status: 403, code: 'CROSS_SCHOOL_DENIED' });
		cases.push({ label: `${route} jwt malformed schoolId wins over actor`, path: `${route}?schoolId=0`, headers: { authorization: `Bearer ${privileged}` }, status: 400, code: 'INVALID_PARAM' });
		if (operatorOnly.has(route)) {
			cases.push({ label: `${route} jwt non-privileged faculty`, path: `${route}?schoolId=1`, headers: { authorization: `Bearer ${faculty}` }, status: 403, code: 'FORBIDDEN' });
		}
	}

	try {
		for (const testCase of cases) {
			(globalThis as any).__runtimeScopeRecorded.length = 0;
			const before = upstreamRequests;
			const res = await get(testCase.path, testCase.headers);
			const json = (await res.json()) as any;
			assert.equal(res.status, testCase.status, `${testCase.label} -> ${testCase.status} (got ${res.status}/${json.code})`);
			if (testCase.code) assert.equal(json.code, testCase.code, `${testCase.label} -> ${testCase.code}`);
			assert.equal((globalThis as any).__runtimeScopeRecorded.length, 0, `${testCase.label} dispatches zero DB operations`);
			assert.equal(upstreamRequests, before, `${testCase.label} dispatches zero upstream requests`);
		}
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await new Promise<void>((resolve) => enrollPro.close(() => resolve()));
	}
});
