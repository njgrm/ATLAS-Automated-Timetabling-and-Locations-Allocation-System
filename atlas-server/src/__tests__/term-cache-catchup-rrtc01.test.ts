/**
 * RR-TERM-CACHE-C01 — mounted-route disposable PostgreSQL proof.
 *
 * Provisions a NEW guarded disposable database (never the configured
 * development database), applies the canonical schema only inside it, seeds one
 * fixture school whose active year is aligned with a fake EnrollPro but has NO
 * persisted term snapshot, then exercises the REAL mounted runtime routes:
 *
 *  - `GET /api/v1/runtime/rollover-status` reports year alignment and persisted
 *    term authority independently (`MISSING`) and never converts existing
 *    current-year Teaching Load rows into a global reset requirement.
 *  - `POST /api/v1/runtime/term-authority/preview` is zero-write, binds the
 *    ordered three-term contract (active term reachable 409 UNRESOLVED), and
 *    returns an exact fingerprint + confirmation text.
 *  - `POST /api/v1/runtime/term-authority/apply` rejects forged fingerprint,
 *    malformed confirmation, cross-school actors, and real upstream drift with
 *    typed 4xx and zero writes; a valid apply writes ONLY the active mirror's
 *    cache columns plus one scoped audit row; replay is idempotent.
 *  - canonical `buildDerivedDemand()` and the real generation readiness
 *    diagnostic move past `TERM_STRUCTURE_UNAVAILABLE` after the apply, with no
 *    helper injection.
 *
 * Positive write instrumentation proves the recorder observes real writes.
 * `try/finally` removes every row and drops the database (zero residue).
 *
 * Run: `npx tsx src/__tests__/term-cache-catchup-rrtc01.test.ts`
 * Skips safely when no PostgreSQL DATABASE_URL is configured.
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
const JWT_SECRET = 'rrtc01-disposable-proof-secret-value';
const SCHOOL_YEAR_ID = 9_000_077;

function psql(argumentsList: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, argumentsList, { env, stdio: 'pipe' }).toString().trim();
}

const WRITE_ACTIONS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany', 'executeRaw', 'queryRaw']);

test('RR-TC-C01 mounted term-authority catch-up against a disposable PostgreSQL fixture', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const source = new URL(SOURCE_URL!);
	const disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_rrtc${randomBytes(4).toString('hex')}`;
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/, 'disposable name must satisfy the repository guard');
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''), 'must never target the configured database');

	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	let prisma: any = null;
	let appServer: http.Server | null = null;
	let enrollProServer: http.Server | null = null;
	let disposableCreated = false;
	const recorded: Array<{ model?: string; action: string }> = [];

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

		// Env MUST be set before the modules capture DATABASE_URL / the token.
		process.env.DATABASE_URL = targetUrl;
		process.env.JWT_SECRET = JWT_SECRET;
		process.env.ENROLLPRO_SERVICE_TOKEN = 'rrtc01-fixture-token';

		// ── Fake EnrollPro (mutable term variant for drift) ───────────────────
		let activeSchoolId = 0;
		let termVariant: 'original' | 'renamed' = 'original';
		enrollProServer = http.createServer((req, res) => {
			const url = new URL(req.url ?? '/', 'http://127.0.0.1');
			res.setHeader('content-type', 'application/json');
			if (url.pathname.endsWith('/integration/v1/health')) {
				res.end(JSON.stringify({ status: 'ok', service: 'enrollpro' }));
				return;
			}
			if (url.pathname.endsWith('/integration/v1/school-year')) {
				const terms = [
					{ identity: 'T1', displayLabel: 'First Trimester', startDate: '2030-06-03', endDate: '2030-09-13' },
					{ identity: 'T2', displayLabel: termVariant === 'renamed' ? 'Second Cycle (renamed)' : 'Second Trimester', startDate: '2030-09-16', endDate: '2031-01-10' },
					{ identity: 'T3', displayLabel: 'Third Trimester', startDate: '2031-01-13', endDate: '2031-04-04' },
				];
				res.end(JSON.stringify({ data: { id: SCHOOL_YEAR_ID, schoolId: activeSchoolId, yearLabel: '2030-2031', termFormat: 'TRIMESTER', terms } }));
				return;
			}
			if (url.pathname.endsWith('/integration/v1/active-term')) {
				res.statusCode = 409;
				res.end(JSON.stringify({ code: 'ACTIVE_TERM_UNRESOLVED', message: 'no term contains today' }));
				return;
			}
			if (url.pathname.endsWith('/integration/v1/sections')) {
				res.end(JSON.stringify({ data: [{ id: 9_000_078_01, name: 'Catch-up Section', maxCapacity: 45, enrolledCount: 30, programType: 'REGULAR', gradeLevel: { id: 17, name: 'Grade 7', displayOrder: 7 } }], meta: { page: 1, limit: 200, totalPages: 1 } }));
				return;
			}
			if (url.pathname.endsWith('/integration/v1/faculty') || url.pathname.endsWith('/integration/v1/default/faculty')) {
				res.end(JSON.stringify({ data: [{ teacherId: 9_000_078, employeeId: '9000078', firstName: 'Catch', lastName: 'Teacher', fullName: 'Catch Teacher', departmentCode: 'MATH', departmentName: 'Mathematics', specialization: 'Mathematics', isActive: true, isTeachingExempt: false }], meta: { page: 1, limit: 200, totalPages: 1 } }));
				return;
			}
			if (url.pathname.endsWith('/settings/public')) {
				res.end(JSON.stringify({ schoolName: 'RR-TC-C01 Sandbox', activeSchoolYearId: SCHOOL_YEAR_ID, activeSchoolYearLabel: '2030-2031' }));
				return;
			}
			res.statusCode = 404;
			res.end(JSON.stringify({ error: 'not found' }));
		});
		await new Promise<void>((resolve) => enrollProServer!.listen(0, '127.0.0.1', resolve));
		const enrollProAddress = enrollProServer.address();
		if (!enrollProAddress || typeof enrollProAddress !== 'object') throw new Error('no enrollpro port');
		process.env.ENROLLPRO_API = `http://127.0.0.1:${enrollProAddress.port}`;

		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: targetUrl });
		await prisma.$connect();

		const prismaModule = await import('../lib/prisma.js');
		const dataContext = await import('../lib/data-context.js');
		const base = (prismaModule as any).createTestPrismaClient();
		const instrumented = base.$extends({
			query: {
				$allModels: {
					async $allOperations({ model, operation, args, query }: any) {
						recorded.push({ model, action: operation });
						return query(args);
					},
				},
			},
		});
		const writes = () => recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));

		// ── Fixture school + active mirror WITHOUT a term snapshot ────────────
		const school = await prisma.school.create({ data: { name: 'RR-TC-C01 Disposable', shortName: 'RRTC' } });
		const schoolId = school.id as number;
		activeSchoolId = schoolId;
		await prisma.enrollProSchoolYearMirror.create({
			data: { schoolId, enrollProSchoolYearId: SCHOOL_YEAR_ID, yearLabel: '2030-2031', isActive: true, isArchived: false, syncStatus: 'synced' },
		});
		await prisma.schedulingPolicy.create({ data: { schoolId, schoolYearId: SCHOOL_YEAR_ID, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' } });
		const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');
		await prisma.classProgramSlot.createMany({
			data: getExpectedCanonicalSlots(7, 'REGULAR').map((slot: any) => ({
				schoolId, schoolYearId: SCHOOL_YEAR_ID, gradeLevel: 7, programType: 'REGULAR' as const,
				startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind as any,
				subjectFamily: slot.subjectFamily ?? null, subjectLabel: slot.subjectLabel ?? null, isActive: true,
			})),
		});
		await prisma.classTemplate.create({ data: { schoolId, name: 'Regular', label: 'Regular', programType: 'REGULAR' as const, gradeApplicability: [7, 8, 9, 10], periodLengthMinutes: 60, periodsPerDay: 8, isActive: true } });
		const building = await prisma.building.create({ data: { schoolId, name: 'Building 1', gradeScope: [7] } });
		await prisma.room.create({ data: { buildingId: building.id, name: 'R1', type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' } });
		const math = await prisma.subject.create({ data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true } });
		const eng = await prisma.subject.create({ data: { schoolId, code: 'ENG', name: 'English', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true } });
		await prisma.sectionMirror.create({ data: { externalId: 9001, schoolId, schoolYearId: SCHOOL_YEAR_ID, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', isActiveForScheduling: true, isStale: false } });
		const faculty = await prisma.facultyMirror.create({ data: { externalId: 710, schoolId, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false } });
		// Existing current-year Teaching Load rows: these must NOT surface a reset requirement.
		for (const subject of [math, eng]) {
			const fs = await prisma.facultySubject.create({ data: { facultyId: faculty.id, subjectId: subject.id, schoolId, schoolYearId: SCHOOL_YEAR_ID, gradeLevels: [7], sectionIds: [9001], assignedBy: 1 } });
			await prisma.subjectSectionOwnership.create({ data: { schoolId, schoolYearId: SCHOOL_YEAR_ID, facultySubjectId: fs.id, facultyId: faculty.id, subjectId: subject.id, sectionId: 9001 } });
		}

		// ── Mount the REAL runtime + generation routers ───────────────────────
		const runtimeRouter = (await import('../routes/runtime.router.js')).default;
		const generationRouter = (await import('../routes/generation.router.js')).default;
		const app = express();
		app.use(express.json());
		app.use((_req, _res, next) => { void (dataContext as any).withDataContext(instrumented, async () => { next(); }); });
		app.use('/api/v1/runtime', runtimeRouter);
		app.use('/api/v1/generation', generationRouter);
		app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
			res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
		});
		appServer = http.createServer(app);
		await new Promise<void>((resolve) => appServer!.listen(0, '127.0.0.1', resolve));
		const appAddress = appServer.address();
		const port = typeof appAddress === 'object' && appAddress ? appAddress.port : 0;
		const baseUrl = `http://127.0.0.1:${port}`;
		const privileged = jwt.sign({ userId: 1, role: 'officer', schoolId, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
		const crossSchool = jwt.sign({ userId: 2, role: 'officer', schoolId: schoolId + 1, authSource: 'local' }, JWT_SECRET, { expiresIn: '10m' });
		const post = (path: string, body: unknown, token = privileged) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
		const get = (path: string, token = privileged) => fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });

		// ── 1. aligned year + missing term authority, and no false TL reset ──
		recorded.length = 0;
		const statusRes = await get(`/api/v1/runtime/rollover-status?schoolId=${schoolId}`);
		const status = (await statusRes.json()) as any;
		assert.equal(statusRes.status, 200, 'rollover-status returns 200');
		assert.equal(status.drift.status, 'aligned', 'year drift is aligned');
		assert.equal(status.drift.recommendedAction, 'NONE', 'year-drift action stays NONE (not overloaded)');
		assert.equal(status.termAuthority?.state, 'MISSING', 'term authority is independently MISSING');
		assert.equal(status.termAuthority?.needsRepair, true, 'missing term authority needs repair');
		assert.equal(status.termAuthority?.repairAction, 'PREVIEW_TERM_CACHE_SYNC', 'exactly one preview repair action is offered');
		assert.equal(status.teachingLoadResetRequired, false, 'existing current-year TL rows do not create a global reset requirement');
		assert.equal(status.teachingLoadReset?.applicable, false, 'the dummy reset path is not applicable to an aligned year');
		assert.equal(status.teachingLoadReset?.scope, 'DUMMY_YEAR_RESET_PREVIEW', 'the reset flag is namespaced to the dummy preview');

		// ── 2. canonical demand + real diagnostic are blocked before apply ───
		const derivedBefore = await (await import('../services/derived-demand.service.js')).buildDerivedDemand(schoolId, SCHOOL_YEAR_ID, { client: instrumented as never });
		assert.equal(derivedBefore.ok, false, 'derived demand is blocked before the snapshot exists');
		if (!derivedBefore.ok) assert.ok(derivedBefore.blockers.some((b) => b.code === 'TERM_STRUCTURE_UNAVAILABLE'), 'blocker is TERM_STRUCTURE_UNAVAILABLE');
		const diagBeforeRes = await get(`/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/readiness/diagnostic`);
		const diagBefore = (await diagBeforeRes.json()) as any;
		assert.equal(diagBeforeRes.status, 200, 'diagnostic returns 200 before apply');
		assert.ok((diagBefore.readiness?.derivedDemandBlockers ?? []).some((b: any) => b.code === 'TERM_STRUCTURE_UNAVAILABLE'), 'diagnostic derived-demand blockers include TERM_STRUCTURE_UNAVAILABLE');

		// ── 3. preview is zero-write and binds the ordered contract ──────────
		recorded.length = 0;
		const previewRes = await post('/api/v1/runtime/term-authority/preview', { schoolId });
		const preview = (await previewRes.json()) as any;
		assert.equal(previewRes.status, 200, 'preview returns 200');
		assert.equal(preview.state, 'READY', 'preview is ready to write');
		assert.equal(preview.zeroWrite, true, 'preview advertises zero-write');
		assert.deepEqual(preview.terms.map((t: any) => t.identity), ['T1', 'T2', 'T3'], 'exact ordered identities are bound');
		assert.equal(preview.activeTermAvailability, 'UNRESOLVED', 'reachable 409 ACTIVE_TERM_UNRESOLVED preserves the ordered structure');
		assert.equal(typeof preview.fingerprint, 'string');
		assert.equal(preview.fingerprint.length, 64, 'stable 64-char fingerprint');
		assert.equal(preview.confirmationText, `SAVE_TERM_AUTHORITY_${schoolId}_${SCHOOL_YEAR_ID}`, 'exact confirmation text');
		assert.equal(writes().length, 0, `preview performs zero writes (observed ${JSON.stringify(writes().slice(0, 5))})`);

		// ── 4. negative gates: each typed 4xx with zero writes ───────────────
		const gate = async (label: string, expectedStatus: number, body: unknown, token = privileged, expectCode?: string) => {
			recorded.length = 0;
			const res = await post('/api/v1/runtime/term-authority/apply', body, token);
			const json = (await res.json()) as any;
			assert.equal(res.status, expectedStatus, `${label} → ${expectedStatus} (got ${res.status}/${json.code})`);
			if (expectCode) assert.equal(json.code, expectCode, `${label} → ${expectCode}`);
			assert.equal(writes().length, 0, `${label} performs zero writes`);
		};
		await gate('forged fingerprint', 409, { schoolId, confirmationText: preview.confirmationText, fingerprint: '0'.repeat(64) }, privileged, 'FINGERPRINT_MISMATCH');
		await gate('malformed confirmation', 400, { schoolId, confirmationText: 'yes please', fingerprint: preview.fingerprint }, privileged, 'CONFIRMATION_REQUIRED');
		await gate('cross-school actor', 403, { schoolId, confirmationText: preview.confirmationText, fingerprint: preview.fingerprint }, crossSchool, 'CROSS_SCHOOL_DENIED');
		await gate('missing fingerprint', 400, { schoolId, confirmationText: preview.confirmationText }, privileged, 'FINGERPRINT_REQUIRED');

		// ── 5. real upstream drift rejects the stale preview, zero writes ────
		termVariant = 'renamed';
		await gate('upstream term rename', 409, { schoolId, confirmationText: preview.confirmationText, fingerprint: preview.fingerprint }, privileged, 'FINGERPRINT_MISMATCH');
		termVariant = 'original';

		// ── 6. valid apply writes ONLY the mirror cache + one audit row ──────
		recorded.length = 0;
		const applyRes = await post('/api/v1/runtime/term-authority/apply', { schoolId, confirmationText: preview.confirmationText, fingerprint: preview.fingerprint });
		const applied = (await applyRes.json()) as any;
		assert.equal(applyRes.status, 200, 'apply returns 200');
		assert.equal(applied.written, true, 'apply writes the cache');
		assert.equal(applied.replayed, false, 'first apply is not a replay');
		assert.equal(applied.previousSemanticRevision, null, 'first write has no previous revision');
		const writtenModels = new Set(writes().map((w) => `${w.model}:${w.action}`));
		const allowed = new Set(['EnrollProSchoolYearMirror:updateMany', 'AuditLog:create']);
		const outOfScope = Array.from(writtenModels).filter((entry) => !allowed.has(entry));
		assert.equal(outOfScope.length, 0, `apply writes only the mirror cache + audit (observed ${JSON.stringify(Array.from(writtenModels))})`);
		assert.equal(writes().filter((w) => w.model === 'EnrollProSchoolYearMirror').length, 1, 'exactly one mirror cache mutation');
		assert.equal(writes().filter((w) => w.model === 'AuditLog' && w.action === 'create').length, 1, 'exactly one scoped audit row');
		const forbidden = new Set(['FacultyMirror', 'SectionMirror', 'FacultySubject', 'SubjectSectionOwnership', 'TeachingLoadCycle', 'GenerationRun', 'PublishedScheduleRevision', 'ClassProgramSlot']);
		assert.equal(writes().filter((w) => forbidden.has(w.model ?? '')).length, 0, 'no faculty/section/Teaching Load/generation writes');
		const mirrored = await prisma.enrollProSchoolYearMirror.findUniqueOrThrow({ where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: SCHOOL_YEAR_ID } }, select: { termContractCache: true, termContractCachedAt: true } });
		assert.ok(mirrored.termContractCache, 'cache persisted');
		assert.ok(mirrored.termContractCachedAt, 'cached-at persisted');
		const auditRows = await prisma.auditLog.findMany({ where: { schoolId, action: 'TERM_CACHE_SYNC_APPLIED' }, select: { schoolYearId: true, metadata: true } });
		assert.equal(auditRows.length, 1, 'one TERM_CACHE_SYNC_APPLIED audit row');
		assert.equal(auditRows[0].schoolYearId, SCHOOL_YEAR_ID, 'audit row is scoped to the active year');
		assert.equal((auditRows[0].metadata as any)?.source, 'enrollpro-term-cache-catchup', 'audit row records the narrow source');

		// ── 7. persisted authority unblocks canonical demand + diagnostic ────
		const derivedAfter = await (await import('../services/derived-demand.service.js')).buildDerivedDemand(schoolId, SCHOOL_YEAR_ID, { client: instrumented as never });
		if (!derivedAfter.ok) {
			assert.equal(derivedAfter.blockers.some((b) => b.code === 'TERM_STRUCTURE_UNAVAILABLE'), false, 'no TERM_STRUCTURE_UNAVAILABLE blocker after apply');
		}
		const diagAfterRes = await get(`/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/readiness/diagnostic`);
		const diagAfter = (await diagAfterRes.json()) as any;
		assert.equal(diagAfterRes.status, 200, 'diagnostic returns 200 after apply');
		assert.equal((diagAfter.readiness?.derivedDemandBlockers ?? []).some((b: any) => b.code === 'TERM_STRUCTURE_UNAVAILABLE'), false, 'diagnostic derived-demand blockers no longer include TERM_STRUCTURE_UNAVAILABLE');

		// ── 8. replay is idempotent: zero writes, no second audit ────────────
		const auditCountBeforeReplay = await prisma.auditLog.count({ where: { schoolId, action: 'TERM_CACHE_SYNC_APPLIED' } });
		recorded.length = 0;
		const replayPreviewRes = await post('/api/v1/runtime/term-authority/preview', { schoolId });
		const replayPreview = (await replayPreviewRes.json()) as any;
		assert.equal(replayPreview.state, 'ALREADY_CURRENT', 're-preview reports the snapshot already current');
		recorded.length = 0;
		const replayRes = await post('/api/v1/runtime/term-authority/apply', { schoolId, confirmationText: replayPreview.confirmationText, fingerprint: replayPreview.fingerprint });
		const replayed = (await replayRes.json()) as any;
		assert.equal(replayRes.status, 200, 'replay returns 200');
		assert.equal(replayed.replayed, true, 'replay reports replayed');
		assert.equal(replayed.written, false, 'replay writes nothing');
		assert.equal(writes().length, 0, 'replay performs zero writes');
		assert.equal(await prisma.auditLog.count({ where: { schoolId, action: 'TERM_CACHE_SYNC_APPLIED' } }), auditCountBeforeReplay, 'replay creates no second audit row');

		// ── 9. concurrent identical apply: one mutation + one audit ──────────
		await instrumented.enrollProSchoolYearMirror.updateMany({ where: { schoolId }, data: { termContractCache: null, termContractCachedAt: null } });
		const concurrencyPreviewRes = await post('/api/v1/runtime/term-authority/preview', { schoolId });
		const concurrencyPreview = (await concurrencyPreviewRes.json()) as any;
		const auditCountBeforeConcurrency = await prisma.auditLog.count({ where: { schoolId, action: 'TERM_CACHE_SYNC_APPLIED' } });
		recorded.length = 0;
		const [firstRes, secondRes] = await Promise.all([
			post('/api/v1/runtime/term-authority/apply', { schoolId, confirmationText: concurrencyPreview.confirmationText, fingerprint: concurrencyPreview.fingerprint }),
			post('/api/v1/runtime/term-authority/apply', { schoolId, confirmationText: concurrencyPreview.confirmationText, fingerprint: concurrencyPreview.fingerprint }),
		]);
		const first = (await firstRes.json()) as any;
		const second = (await secondRes.json()) as any;
		const writers = [first, second].filter((r, index) => [firstRes, secondRes][index].status === 200 && r.written === true);
		assert.equal(writers.length, 1, `exactly one concurrent apply writes (got ${JSON.stringify([{ s: firstRes.status, w: first.written }, { s: secondRes.status, w: second.written }])})`);
		const other = firstRes.status !== 200 || first.written === true ? second : first;
		const otherStatus = firstRes.status !== 200 || first.written === true ? secondRes.status : firstRes.status;
		assert.ok(other.replayed === true || otherStatus === 409, 'the losing apply is an idempotent replay or a typed conflict');
		assert.equal(await prisma.auditLog.count({ where: { schoolId, action: 'TERM_CACHE_SYNC_APPLIED' } }), auditCountBeforeConcurrency + 1, 'concurrent applies create exactly one additional audit row');

		// ── 10. positive write instrumentation control ───────────────────────
		recorded.length = 0;
		await instrumented.enrollProSchoolYearMirror.updateMany({ where: { schoolId }, data: { syncStatus: 'synced' } });
		assert.equal(writes().filter((w) => w.model === 'EnrollProSchoolYearMirror').length, 1, 'recorder observes a real mirror write');
	} finally {
		if (appServer) await new Promise<void>((resolve) => appServer!.close(() => resolve()));
		if (enrollProServer) await new Promise<void>((resolve) => enrollProServer!.close(() => resolve()));
		if (prisma) {
			// FK-safe cleanup of every fixture row, then a zero-residue assertion.
			const createdSchoolIds = (await prisma.school.findMany({ where: { shortName: 'RRTC' }, select: { id: true } })).map((s: any) => s.id);
			for (const id of createdSchoolIds) {
				await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.facultySubject.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.facultyMirror.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.sectionMirror.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.auditLog.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.classProgramSlot.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.classTemplate.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.room.deleteMany({ where: { building: { schoolId: id } } }).catch(() => {});
				await prisma.building.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.subject.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.schedulingPolicy.deleteMany({ where: { schoolId: id } }).catch(() => {});
				await prisma.school.deleteMany({ where: { id } }).catch(() => {});
			}
			const residue = await prisma.school.count({ where: { shortName: 'RRTC' } });
			assert.equal(residue, 0, 'zero fixture school residue after cleanup');
			await prisma.$disconnect().catch(() => undefined);
		}
		if (disposableCreated) {
			try { psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv); } catch { /* best effort */ }
			assert.equal(psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`], adminEnv), '0', 'the disposable database must be dropped (zero residue)');
		}
	}
});
