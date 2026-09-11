/**
 * UX-C01R — mounted read-only derived-demand readiness route.
 *
 * Two layers of proof:
 *  1. Hermetic: auth, privilege, actor-school scope, and malformed-param
 *     rejection happen BEFORE any authority call (the injected spy records zero
 *     invocations). Ready/typed-blocked/unclassified-failure responses keep the
 *     revision/blockers/totals without ever being coerced into ready/zero.
 *  2. Disposable PostgreSQL (skips when no DATABASE_URL): the real authority is
 *     invoked through the mounted route, a full write census proves zero writes,
 *     and a rolled-back positive control proves the census is sensitive.
 *
 * Run: `npx tsx src/__tests__/uxc01r-derived-demand-route.test.ts`
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

import { createDerivedDemandRouter, type DerivedDemandAuthority } from '../routes/derived-demand.router.js';
import type { DerivedDemandResult } from '../services/derived-demand.service.js';

const JWT_SECRET = 'uxc01r-derived-demand-route-secret';
const SCHOOL = 1;
const YEAR = 8;

function signToken(payload: Record<string, unknown>): string {
	return jwt.sign({ userId: 1, role: 'officer', schoolId: SCHOOL, ...payload }, JWT_SECRET, { expiresIn: '5m' });
}

async function startServer(authority: DerivedDemandAuthority): Promise<{ base: string; close: () => Promise<void> }> {
	const app = express();
	app.use(express.json());
	app.use('/api/v1/derived-demand', createDerivedDemandRouter(authority));
	app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		const status = (err as { statusCode?: number })?.statusCode;
		res.status(typeof status === 'number' ? status : 500).json({ code: 'UNHANDLED', message: err instanceof Error ? err.message : String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	return {
		base: `http://127.0.0.1:${port}/api/v1/derived-demand`,
		close: () => new Promise<void>((resolve) => server.close(() => resolve())),
	};
}

function readyResult(): DerivedDemandResult {
	return {
		ok: true,
		scope: { schoolId: SCHOOL, schoolYearId: YEAR },
		yearLabel: '2030-2031',
		revision: 'REV-A',
		termStructure: {
			format: 'QUARTERS',
			semanticRevision: 'TERM-REV-A',
			terms: [
				{ identity: 'Q1', displayLabel: 'Quarter 1', order: 1 },
				{ identity: 'Q2', displayLabel: 'Quarter 2', order: 2 },
			],
		},
		periodLengthMinutes: 60,
		timetableLines: [],
		teachingLoadPairs: [],
		totalsByTerm: { Q1: 20, Q2: 20 },
		totalLines: 40,
		totalPairs: 12,
	};
}

test('UX-C01R route: auth/scope/param rejection happens before any authority call', async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	let calls = 0;
	const authority: DerivedDemandAuthority = async () => { calls += 1; return readyResult(); };
	const server = await startServer(authority);
	try {
		const cases: Array<{ name: string; path: string; token?: string; status: number; code: string }> = [
			{ name: 'missing auth', path: `/${SCHOOL}/${YEAR}/readiness`, status: 401, code: 'NO_TOKEN' },
			{ name: 'invalid auth', path: `/${SCHOOL}/${YEAR}/readiness`, token: 'not-a-jwt', status: 401, code: 'INVALID_TOKEN' },
			{ name: 'non-privileged role', path: `/${SCHOOL}/${YEAR}/readiness`, token: signToken({ role: 'faculty' }), status: 403, code: 'FORBIDDEN' },
			{ name: 'unresolved actor school', path: `/${SCHOOL}/${YEAR}/readiness`, token: signToken({ schoolId: undefined }), status: 403, code: 'SCHOOL_SCOPE_REQUIRED' },
			{ name: 'cross-school scope', path: `/${SCHOOL}/${YEAR}/readiness`, token: signToken({ schoolId: 2 }), status: 403, code: 'CROSS_SCHOOL_DENIED' },
			{ name: 'malformed schoolId', path: `/abc/${YEAR}/readiness`, token: signToken({}), status: 400, code: 'INVALID_PARAM' },
			{ name: 'zero schoolId', path: `/0/${YEAR}/readiness`, token: signToken({}), status: 400, code: 'INVALID_PARAM' },
			{ name: 'malformed schoolYearId', path: `/${SCHOOL}/nope/readiness`, token: signToken({}), status: 400, code: 'INVALID_PARAM' },
			{ name: 'negative schoolYearId', path: `/${SCHOOL}/-1/readiness`, token: signToken({}), status: 400, code: 'INVALID_PARAM' },
		];
		for (const entry of cases) {
			const response = await fetch(`${server.base}${entry.path}`, {
				headers: entry.token ? { authorization: `Bearer ${entry.token}` } : {},
			});
			const body = await response.json() as { code?: string };
			assert.equal(response.status, entry.status, `${entry.name} must return ${entry.status}`);
			assert.equal(body.code, entry.code, `${entry.name} must return code ${entry.code}`);
		}
		assert.equal(calls, 0, 'no rejected request may invoke the authority service');
	} finally {
		await server.close();
	}
});

test('UX-C01R route: a ready authority response preserves revision, totals, and term structure', async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	let calls = 0;
	const server = await startServer(async () => { calls += 1; return readyResult(); });
	try {
		const response = await fetch(`${server.base}/${SCHOOL}/${YEAR}/readiness`, { headers: { authorization: `Bearer ${signToken({})}` } });
		const body = await response.json() as any;
		assert.equal(response.status, 200);
		assert.equal(body.available, true);
		assert.equal(body.ready, true);
		assert.equal(body.revision, 'REV-A');
		assert.equal(body.totals.totalPairs, 12);
		assert.deepEqual(body.termStructure.terms.map((t: any) => t.identity), ['Q1', 'Q2']);
		assert.equal(calls, 1);
	} finally {
		await server.close();
	}
});

test('UX-C01R route: a typed authority blocker stays available-but-not-ready with its code', async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	const server = await startServer(async () => {
		const error = new Error('Rotation family TLE needs an explicit integer term order.') as Error & { statusCode: number; code: string };
		error.statusCode = 422;
		error.code = 'ROTATION_ORDER_MISSING';
		throw error;
	});
	try {
		const response = await fetch(`${server.base}/${SCHOOL}/${YEAR}/readiness`, { headers: { authorization: `Bearer ${signToken({})}` } });
		const body = await response.json() as any;
		assert.equal(response.status, 200);
		assert.equal(body.available, true, 'a typed blocker is a successful read');
		assert.equal(body.ready, false);
		assert.equal(body.blockerCode, 'ROTATION_ORDER_MISSING');
		assert.equal(body.totals, null, 'a blocked derivation never reports synthetic totals');
	} finally {
		await server.close();
	}
});

test('UX-C01R route: an unclassified dependency failure is never coerced into ready or a synthetic zero', async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	const server = await startServer(async () => { throw new Error('datasource connection reset'); });
	try {
		const response = await fetch(`${server.base}/${SCHOOL}/${YEAR}/readiness`, { headers: { authorization: `Bearer ${signToken({})}` } });
		const body = await response.json() as any;
		assert.equal(response.status, 500, 'an unclassified failure must surface as a server error');
		assert.notEqual(body.available, true, 'it must not be converted into an available readiness payload');
		assert.notEqual(body.ready, true, 'it must never be coerced into a ready or synthetic-zero response');
	} finally {
		await server.close();
	}
});

// ─── Disposable PostgreSQL zero-write proof ──────────────────────────────────

const WORKDIR = process.cwd();
const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';

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
const RUNNABLE = Boolean(SOURCE_URL) && SOURCE_URL!.startsWith('postgres');

function psql(argumentsList: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, argumentsList, { env, stdio: 'pipe' }).toString().trim();
}

test('UX-C01R route: mounted read-only endpoint is zero-write against a disposable PostgreSQL fixture', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const source = new URL(SOURCE_URL!);
	const disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_uxc01r${randomBytes(4).toString('hex')}`;
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/, 'disposable name must satisfy the repository guard');
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''), 'must never target the configured database');

	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	let prisma: any = null;
	let server: { base: string; close: () => Promise<void> } | null = null;
	let disposableCreated = false;
	try {
		try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* not present */ }
		psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `CREATE DATABASE ${disposableName}`], adminEnv);
		disposableCreated = true;

		execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
			env: { ...process.env, DATABASE_URL: targetUrl },
			cwd: WORKDIR,
			stdio: 'pipe',
			shell: true,
		});

		process.env.DATABASE_URL = targetUrl;
		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: targetUrl });
		await prisma.$connect();

		const census = async () => ({
			subject: await prisma.subject.count(),
			sectionMirror: await prisma.sectionMirror.count(),
			facultyMirror: await prisma.facultyMirror.count(),
			facultySubject: await prisma.facultySubject.count(),
			subjectSectionOwnership: await prisma.subjectSectionOwnership.count(),
			generationRun: await prisma.generationRun.count(),
			auditLog: await prisma.auditLog.count(),
		});

		const school = await prisma.school.create({ data: { name: 'UX-C01R Disposable', shortName: 'UXR' } });
		const schoolId = school.id;
		const schoolYearId = YEAR;
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId, enrollProSchoolYearId: schoolYearId, yearLabel: '2030-2031', isActive: true, isArchived: false,
				termContractCache: {
					schoolId, schoolYear: { id: schoolYearId }, format: 'TRIMESTER',
					terms: [
						{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
						{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
						{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
					],
				},
				termContractCachedAt: new Date(),
			},
		});
		await prisma.schedulingPolicy.create({ data: { schoolId, schoolYearId, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' } });
		const math = await prisma.subject.create({ data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'], isActive: true } });
		const eng = await prisma.subject.create({ data: { schoolId, code: 'ENG', name: 'English', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'], isActive: true } });
		await prisma.sectionMirror.create({ data: { externalId: 9001, schoolId, schoolYearId, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', isActiveForScheduling: true, isStale: false } });
		const faculty = await prisma.facultyMirror.create({ data: { externalId: 710, schoolId, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false } });
		for (const subject of [math, eng]) {
			const fsRow = await prisma.facultySubject.create({ data: { facultyId: faculty.id, subjectId: subject.id, schoolId, schoolYearId, gradeLevels: [7], sectionIds: [9001], assignedBy: 1 } });
			await prisma.subjectSectionOwnership.create({ data: { schoolId, schoolYearId, facultySubjectId: fsRow.id, facultyId: faculty.id, subjectId: subject.id, sectionId: 9001 } });
		}

		const { buildDerivedDemand } = await import('../services/derived-demand.service.js');
		server = await startServer((s, y) => buildDerivedDemand(s, y, { client: prisma }));

		const before = await census();
		const response = await fetch(`${server.base}/${schoolId}/${schoolYearId}/readiness`, { headers: { authorization: `Bearer ${signToken({ schoolId })}` } });
		const body = await response.json() as any;
		const after = await census();

		assert.equal(response.status, 200, `mounted derived-demand readiness must return 200 (got ${response.status})`);
		assert.equal(body.available, true);
		assert.ok(body.revision, 'the derived revision must be present on a ready read');
		assert.deepEqual(after, before, 'the read-only route must perform zero writes');

		// Rolled-back positive control: the census detects a write.
		const control = await prisma.subject.create({ data: { schoolId, code: 'CTRL', name: 'Control', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM', gradeLevels: [7], programScopes: ['REGULAR'], isActive: true } });
		assert.notDeepEqual(await census(), before, 'the census must detect a write');
		await prisma.subject.delete({ where: { id: control.id } });
		assert.deepEqual(await census(), before, 'cleanup must return the census to baseline');
	} finally {
		if (server) await server.close();
		if (prisma) {
			try {
				await prisma.subjectSectionOwnership.deleteMany({});
				await prisma.facultySubject.deleteMany({});
				await prisma.facultyMirror.deleteMany({});
				await prisma.sectionMirror.deleteMany({});
				await prisma.subject.deleteMany({});
				await prisma.schedulingPolicy.deleteMany({});
				await prisma.enrollProSchoolYearMirror.deleteMany({});
				await prisma.school.deleteMany({});
			} catch { /* best effort */ }
			await prisma.$disconnect().catch(() => undefined);
		}
		if (disposableCreated) {
			try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* best effort */ }
			assert.equal(psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`], adminEnv), '0', 'the disposable database must be dropped (zero residue)');
		}
	}
});
