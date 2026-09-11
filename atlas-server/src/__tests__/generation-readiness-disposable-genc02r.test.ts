/**
 * GEN-C02R Correction 2 — mounted disposable-PostgreSQL zero-write proof.
 *
 * Provisions a NEW guarded disposable database (never the live-like
 * `atlas_recovery_clean_rebuild_*` or the configured development database),
 * applies the canonical schema only inside it, seeds the smallest fixture that
 * can execute the authenticated privileged readiness route through the real
 * scheduler path, asserts `zeroWrite:true` with unchanged before/after domain
 * signatures, exercises a rolled-back positive control, then removes every row
 * and drops the database. `try/finally` guarantees zero residue.
 *
 * Run: `npx tsx src/__tests__/generation-readiness-disposable-genc02r.test.ts`
 * Skips safely when no DATABASE_URL is configured.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';

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
const JWT_SECRET = 'genc02r-disposable-proof-secret-value';

function psql(argumentsList: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, argumentsList, { env, stdio: 'pipe' }).toString().trim();
}

test('C2. mounted readiness diagnostic is zero-write against a disposable PostgreSQL fixture', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	process.env.JWT_SECRET = JWT_SECRET;
	const source = new URL(SOURCE_URL!);
	const disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_genc02r${randomBytes(4).toString('hex')}`;
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/, 'disposable name must satisfy the repository guard');
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''), 'must never target the configured database');

	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	let prisma: any = null;
	let server: http.Server | null = null;
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

		// ── In-database census signature ──────────────────────────────────────
		const census = async () => ({
			generationRun: await prisma.generationRun.count(),
			lockedSession: await prisma.lockedSession.count(),
			lockedSessionAction: await prisma.lockedSessionAction.count(),
			auditLog: await prisma.auditLog.count(),
			ownership: await prisma.subjectSectionOwnership.count(),
			teachingLoadCycle: await prisma.teachingLoadCycle.count(),
			publishedRevision: await prisma.publishedScheduleRevision.count(),
		});

		// ── Seed fixture ──────────────────────────────────────────────────────
		const school = await prisma.school.create({ data: { name: 'GEN-C02R Disposable', shortName: 'G02R' } });
		const schoolId = school.id;
		const schoolYearId = 8;
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId, enrollProSchoolYearId: schoolYearId, yearLabel: '2026-2027', isActive: true, isArchived: false,
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

		const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');
		await prisma.classProgramSlot.createMany({
			data: getExpectedCanonicalSlots(7, 'REGULAR').map((slot) => ({
				schoolId, schoolYearId, gradeLevel: 7, programType: 'REGULAR' as const,
				startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind as any,
				subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, isActive: true,
			})),
		});
		await prisma.classTemplate.create({ data: { schoolId, name: 'Regular', label: 'Regular', programType: 'REGULAR' as const, gradeApplicability: [7, 8, 9, 10], periodLengthMinutes: 60, periodsPerDay: 8, isActive: true } });

		const building = await prisma.building.create({ data: { schoolId, name: 'Building 1', gradeScope: [7] } });
		await prisma.room.create({ data: { buildingId: building.id, name: 'R1', type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' } });

		const math = await prisma.subject.create({ data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true } });
		const eng = await prisma.subject.create({ data: { schoolId, code: 'ENG', name: 'English', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true } });
		await prisma.sectionMirror.create({ data: { externalId: 9001, schoolId, schoolYearId, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', isActiveForScheduling: true, isStale: false } });
		const faculty = await prisma.facultyMirror.create({ data: { externalId: 710, schoolId, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false } });
		for (const subject of [math, eng]) {
			const fs = await prisma.facultySubject.create({ data: { facultyId: faculty.id, subjectId: subject.id, schoolId, schoolYearId, gradeLevels: [7], sectionIds: [9001], assignedBy: 1 } });
			await prisma.subjectSectionOwnership.create({ data: { schoolId, schoolYearId, facultySubjectId: fs.id, facultyId: faculty.id, subjectId: subject.id, sectionId: 9001 } });
		}

		// ── Mounted route invocation ──────────────────────────────────────────
		const { default: generationRouter } = await import('../routes/generation.router.js');
		const app = express();
		app.use(express.json());
		app.use('/api/v1/generation', generationRouter);
		app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
			res.status(500).json({ code: 'UNHANDLED', message: err instanceof Error ? err.message : String(err) });
		});
		server = http.createServer(app);
		await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		const port = typeof address === 'object' && address ? address.port : 0;
		const bearer = jwt.sign({ userId: 1, role: 'officer', schoolId }, JWT_SECRET, { expiresIn: '5m' });

		const before = await census();
		const response = await fetch(`http://127.0.0.1:${port}/api/v1/generation/${schoolId}/${schoolYearId}/readiness/diagnostic`, { headers: { authorization: `Bearer ${bearer}` } });
		const body = await response.json() as any;
		const after = await census();

		assert.equal(response.status, 200, `mounted readiness must return 200 (got ${response.status})`);
		assert.ok(body.readiness, 'the readiness payload must be present');
		assert.equal(body.readiness.databaseSignature.zeroWrite, true, 'the diagnostic must be zero-write');
		assert.deepEqual(after, before, 'all domain signatures must be unchanged');
		assert.ok(body.readiness.derivedDemandRevision, 'the derived revision must be present');
		assert.equal(body.readiness.totals.pairs, 2, 'exactly the seeded subject/section pairs are derived');

		// ── Rolled-back positive control: the census detects a write ──────────
		const controlRun = await prisma.generationRun.create({ data: { schoolId, schoolYearId, status: 'QUEUED', triggeredBy: 1 } });
		const changed = await census();
		assert.notDeepEqual(changed, before, 'the census must detect a write');
		await prisma.generationRun.delete({ where: { id: controlRun.id } });
		assert.deepEqual(await census(), before, 'cleanup must return the census to its baseline');

		// ── Cleanup fixture rows (FK-safe order) ──────────────────────────────
		await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } });
		await prisma.facultySubject.deleteMany({ where: { schoolId } });
		await prisma.facultyMirror.deleteMany({ where: { schoolId } });
		await prisma.sectionMirror.deleteMany({ where: { schoolId } });
		await prisma.subject.deleteMany({ where: { schoolId } });
		await prisma.room.deleteMany({ where: { building: { schoolId } } });
		await prisma.building.deleteMany({ where: { schoolId } });
		await prisma.classProgramSlot.deleteMany({ where: { schoolId } });
		await prisma.classTemplate.deleteMany({ where: { schoolId } });
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId } });
		await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } });
		await prisma.school.deleteMany({ where: { id: schoolId } });
	} finally {
		if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
		if (prisma) await prisma.$disconnect().catch(() => undefined);
		if (disposableCreated) {
			try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* best effort */ }
			assert.equal(psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`], adminEnv), '0', 'the disposable database must be dropped (zero residue)');
		}
	}
});
