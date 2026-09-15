/**
 * EXPORT-PRESENTATION-SCHEMA-GUARD-C06B — mandatory acceptance matrix (S1..S17).
 *
 * Proves, on a GUARDED DISPOSABLE PostgreSQL database and a REAL mounted express
 * app (real routers + real `authenticate` + real `errorHandler` + hand-signed
 * JWTs), that when migration `0003_teacher_program_presentation` is NOT applied
 * the official teacher-program DOCX export and the presentation settings route
 * fail closed with one typed, non-leaking `503 EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE`
 * response and zero document bytes — while every other failure mode (P2002/P2034
 * conflicts, plain errors, unrelated Prisma codes) keeps its existing behavior.
 *
 * S13/S14 prove the translation is load-bearing: the SAME missing table/column,
 * read directly (no guard) and routed through the real `errorHandler`, still
 * yields `500` with the raw `P2021`/`P2022` code.
 *
 * The configured (non-disposable) database is only ever probed read-only for
 * `to_regclass(...)` and is never the target of any migration in this suite.
 *
 * Run: `npx tsx src/__tests__/export-presentation-schema-guard-c06b.test.ts`
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import {
	PSQL,
	isDisposableHarnessAvailable,
	readSourceDatabaseUrl,
	provisionDisposableDatabase,
	seedCanonicalFixture,
	teardownCanonicalFixture,
} from './helpers/tt-source-freshness-db.js';

// ─── Pinned contract (must equal the service/router constant) ───

const CODE = 'EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE';
const MESSAGE =
	'Teacher-program presentation settings are unavailable because the required presentation schema has not been provisioned on this deployment. No official document can be produced until an administrator applies the pending schema migration.';
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PRESENTATION_TABLE = 'teacher_program_presentation_revisions';
const PROBE_SQL = `SELECT to_regclass('public.${PRESENTATION_TABLE}')::text`;

const RUN_JWT_SECRET = 'export-presentation-schema-guard-c06b-fixture-secret';
const RUNNABLE = isDisposableHarnessAvailable();

// ─── Helpers ───

function psqlValue(sourceUrl: string, databaseName: string, sql: string): string {
	const source = new URL(sourceUrl);
	const env: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	return execFileSync(
		PSQL,
		['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', databaseName, '-tAc', sql],
		{ env, stdio: 'pipe' },
	).toString().trim();
}

function assertNoDocumentBytes(label: string, headers: any, body: Buffer): void {
	assert.equal(headers.get('content-disposition'), null, `${label}: a rejected export must not attach a file`);
	assert.doesNotMatch(String(headers.get('content-type') ?? ''), /wordprocessingml|spreadsheetml/, `${label}: a rejected export must not emit a document content type`);
	assert.equal(body.includes(Buffer.from('PK\x03\x04', 'latin1')), false, `${label}: a rejected export must contain no ZIP/DOCX signature`);
}

function assertTypedSchemaUnavailable(label: string, status: number, headers: any, body: Buffer): void {
	assert.equal(status, 503, `${label}: must fail closed with the typed 503`);
	assert.match(String(headers.get('content-type') ?? ''), /application\/json/, `${label}: JSON body required`);
	assert.equal(body.includes(Buffer.from('PK\x03\x04', 'latin1')), false, `${label}: no ZIP/DOCX signature may appear`);
	assert.ok(body.length < 600, `${label}: bounded error body (${body.length} bytes), never document bytes`);
	const text = body.toString('utf8');
	assert.doesNotMatch(text, /<html|<!doctype/i, `${label}: must not return HTML`);
	assert.doesNotMatch(text, /\bat [^\s()]+:\d+:\d+/, `${label}: must not leak a stack frame`);
	let parsed: { code?: unknown; message?: unknown; details?: unknown } = {};
	try {
		parsed = JSON.parse(text) as typeof parsed;
	} catch {
		assert.fail(`${label}: body must parse as JSON (got ${JSON.stringify(text.slice(0, 120))})`);
	}
	assert.equal(parsed.code, CODE, `${label}: typed code`);
	assert.equal(parsed.message, MESSAGE, `${label}: pinned client-facing message`);
	assert.equal(Object.prototype.hasOwnProperty.call(parsed, 'details'), false, `${label}: no details payload`);
	for (const token of ['P2021', 'P2022', 'prisma', 'Prisma', 'public.', 'relation', PRESENTATION_TABLE, 'footer_text', 'does not exist']) {
		assert.equal(text.includes(token), false, `${label}: must not leak "${token}"`);
	}
}

// ─── S15 — the configured database is never migrated by this suite ───

test('S15 — configured database remains unapplied before the suite', () => {
	assert.ok(RUNNABLE, 'FATAL: disposable PostgreSQL harness unavailable (S1 precondition cannot be satisfied)');
	const sourceUrl = readSourceDatabaseUrl();
	assert.ok(sourceUrl, 'DATABASE_URL must resolve from the environment, atlas-server/.env, or the durable runtime env');
	const configured = new URL(sourceUrl!).pathname.replace(/^\//, '');
	const before = psqlValue(sourceUrl!, configured, PROBE_SQL);
	assert.equal(before, '', `S15(before): public.${PRESENTATION_TABLE} must not exist on the configured database`);
});

// ─── S1..S14, S16 — the disposable matrix ───

test('teacher-program presentation schema guard matrices on a disposable PostgreSQL database', async () => {
	assert.ok(RUNNABLE, 'FATAL: disposable PostgreSQL harness unavailable (S1 precondition cannot be satisfied)');

	const sourceUrl = readSourceDatabaseUrl();
	assert.ok(sourceUrl, 'DATABASE_URL must resolve from the environment, atlas-server/.env, or the durable runtime env');
	const configuredDatabase = new URL(sourceUrl!).pathname.replace(/^\//, '');

	const disposable = provisionDisposableDatabase('c06b');
	assert.ok(disposable, 'a disposable database must be provisioned');
	assert.notEqual(disposable!.name, configuredDatabase, 'the disposable database must never be the configured database');
	assert.ok(disposable!.name.startsWith('atlas_restore_drill_'), 'the guard-named disposable database is required');

	let prisma: any = null;
	let server: http.Server | null = null;
	let schoolId = 0;
	let configuredAfter = '';
	const dispatch: string[] = [];

	try {
		// MUST precede the first import of lib/prisma so the singleton targets the
		// disposable database, never the configured one.
		process.env.DATABASE_URL = disposable!.targetUrl;
		process.env.JWT_SECRET = RUN_JWT_SECRET;

		const prismaModule: any = await import('../lib/prisma.js');
		prisma = prismaModule.prisma;

		// ── S1 — freshly generated client precondition (fails loudly, never skips) ──
		assert.equal(
			typeof prisma?.teacherProgramPresentationRevision?.findFirst,
			'function',
			'S1: the freshly generated Prisma client MUST expose teacherProgramPresentationRevision.findFirst; a stale client would make the P2021 control vacuous',
		);
		assert.equal(typeof prisma?.teacherProgramPresentationRevision?.create, 'function', 'S1: the fresh client must expose the revision create delegate');
		await prisma.$queryRawUnsafe('SELECT 1');
		const tableProbe = await prisma.$queryRawUnsafe(PROBE_SQL) as Array<{ to_regclass?: string | null }>;
		assert.equal(
			tableProbe[0]?.to_regclass ?? null,
			PRESENTATION_TABLE,
			'S1: canonical migrations must have created the presentation table inside the disposable database',
		);

		const instrumented = prisma.$extends({
			query: {
				$allModels: {
					async $allOperations({ model, operation, args, query }: any) {
						dispatch.push(`${model}.${operation}`);
						return query(args);
					},
				},
			},
		});

		const generationRouter = (await import('../routes/generation.router.js')).default;
		const exportPresentationRouter = (await import('../routes/export-presentation.router.js')).default;
		const { errorHandler } = await import('../middleware/errorHandler.js');
		const { withDataContext } = await import('../lib/data-context.js');
		const service: any = await import('../services/export-presentation.service.js');
		const { PresentationProfileError, readEffectiveSignatoryProfile, readSignatoryProfileAsOfPublication, saveSignatoryProfile } = service;

		// The pinned message constant must be shared by every consumer.
		assert.equal(service.EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_CODE, CODE, 'the service must export the single typed code constant');
		assert.equal(service.EXPORT_PRESENTATION_SCHEMA_UNAVAILABLE_MESSAGE, MESSAGE, 'the service must pin the single client-facing message');

		const app = express();
		app.use(express.json());
		app.use((_req, _res, next) => { void (withDataContext as any)(instrumented, async () => { next(); }); });
		app.use('/api/v1/generation', generationRouter);
		app.use('/api/v1/export-presentation', exportPresentationRouter);
		// S13/S14 only — the UNGUARDED direct store read, wired through the real
		// production errorHandler so the raw Prisma failure is observable.
		app.get('/__c06b/unguarded-presentation-read', async (req, res, next) => {
			try {
				const row = await prisma.teacherProgramPresentationRevision.findFirst({
					where: { schoolId: Number(req.query.schoolId), schoolYearId: Number(req.query.schoolYearId) },
					select: { revision: true, footerText: true },
				});
				res.status(200).json({ row });
			} catch (error) {
				next(error);
			}
		});
		app.use(errorHandler);

		server = http.createServer(app);
		await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		const baseUrl = `http://127.0.0.1:${address.port}`;

		const fixture = await seedCanonicalFixture(prisma);
		schoolId = fixture.schoolId;
		const schoolYearId = fixture.schoolYearId;
		const run = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				triggeredBy: 1,
				summary: { isPublished: false, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] },
				draftEntries: [{
					entryId: 'c06b-1',
					sectionId: fixture.sectionExternalId,
					subjectId: fixture.subjectIdByCode.MATH,
					facultyId: fixture.facultyId,
					roomId: fixture.roomId,
					day: 'MONDAY',
					startTime: '07:00',
					endTime: '08:00',
					durationMinutes: 60,
					termIndex: 1,
				}],
			},
		});

		const adminToken = jwt.sign({ userId: 1, role: 'admin', authSource: 'local', schoolId }, RUN_JWT_SECRET, { expiresIn: '10m' });
		const facultyToken = jwt.sign({ userId: 2, role: 'faculty', authSource: 'local', schoolId }, RUN_JWT_SECRET, { expiresIn: '10m' });
		const crossSchoolToken = jwt.sign({ userId: 3, role: 'admin', authSource: 'local', schoolId: schoolId + 1 }, RUN_JWT_SECRET, { expiresIn: '10m' });

		const exportPath = `/api/v1/generation/${schoolId}/${schoolYearId}/runs/${run.id}/export/teacher-program.docx?facultyId=${fixture.facultyId}&termIndex=1`;
		const settingsPath = `/api/v1/export-presentation/${schoolId}/${schoolYearId}`;
		const unguardedPath = `/__c06b/unguarded-presentation-read?schoolId=${schoolId}&schoolYearId=${schoolYearId}`;

		// ═══ Table present: S6 positive, S8..S12 authorization, S2 narrowness ═══

		// ── S6 — present table renders the real DOCX ──
		dispatch.length = 0;
		const ok = await fetch(`${baseUrl}${exportPath}`, { headers: { Authorization: `Bearer ${adminToken}` } });
		const okBuffer = Buffer.from(await ok.arrayBuffer());
		assert.equal(ok.status, 200, 'S6: the export succeeds once the revision table exists');
		assert.match(String(ok.headers.get('content-type') ?? ''), /wordprocessingml/, 'S6: DOCX content type');
		assert.equal(
			ok.headers.get('content-disposition'),
			`attachment; filename="teacher-program-${fixture.facultyId}-SY2026-2027-term1.docx"`,
			'S6: entity-scoped DOCX attachment filename',
		);
		assert.equal(okBuffer.subarray(0, 4).toString('latin1'), 'PK\x03\x04', 'S6: the body is a real DOCX (ZIP) container');
		assert.equal(dispatch.some((entry) => /teacherProgramPresentationRevision/i.test(entry)), true, `S6: the export reads the presentation store (saw ${dispatch.join(',')})`);
		assert.equal(dispatch.some((entry) => /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)$/.test(entry)), false, 'S6: the export is zero-write');

		// ── S8..S12 — authorization rows dispatch zero Prisma work ──
		type AuthRow = { id: string; path: string; headers: Record<string, string>; status: number; code: string };
		const authRows: AuthRow[] = [
			{ id: 'S8', path: exportPath, headers: {}, status: 401, code: 'NO_TOKEN' },
			{ id: 'S9', path: exportPath, headers: { Authorization: 'Bearer not-a-real-jwt' }, status: 401, code: 'INVALID_TOKEN' },
			{ id: 'S10', path: exportPath, headers: { Authorization: `Bearer ${facultyToken}` }, status: 403, code: 'FORBIDDEN' },
			{ id: 'S11', path: exportPath, headers: { Authorization: `Bearer ${crossSchoolToken}` }, status: 403, code: 'CROSS_SCHOOL_DENIED' },
			{ id: 'S12', path: settingsPath, headers: { Authorization: `Bearer ${crossSchoolToken}` }, status: 403, code: 'CROSS_SCHOOL_DENIED' },
		];
		for (const row of authRows) {
			dispatch.length = 0;
			const response = await fetch(`${baseUrl}${row.path}`, { headers: row.headers });
			const body = Buffer.from(await response.arrayBuffer());
			assert.equal(response.status, row.status, `${row.id}: expected ${row.status} ${row.code} (got ${response.status})`);
			assert.equal((JSON.parse(body.toString('utf8')) as any).code, row.code, `${row.id}: typed rejection code`);
			assert.equal(dispatch.length, 0, `${row.id}: rejected request must dispatch zero Prisma operations`);
			assertNoDocumentBytes(row.id, response.headers, body);
		}

		// ── S2 — the translation is NOT over-broad (real service functions) ──
		const storeOf = (findFirst: () => Promise<unknown>) => ({ teacherProgramPresentationRevision: { findFirst } });
		for (const code of ['P2002', 'P2034', 'P2025', 'P9999']) {
			const sentinel = Object.assign(new Error(`sentinel ${code}`), { code });
			let caught: any = null;
			try {
				await readEffectiveSignatoryProfile({ schoolId: 1, schoolYearId: 1, client: storeOf(async () => { throw sentinel; }) });
			} catch (error) { caught = error; }
			assert.equal(caught, sentinel, `S2: ${code} must propagate byte-identically from the read path`);
			assert.equal(caught instanceof PresentationProfileError, false, `S2: ${code} must not be converted to the typed schema error`);
		}
		const plain = new Error('plain presentation failure');
		let plainCaught: any = null;
		try {
			await readSignatoryProfileAsOfPublication({ schoolId: 1, schoolYearId: 1, publishedAt: '2030-01-01T00:00:00.000Z', client: storeOf(async () => { throw plain; }) });
		} catch (error) { plainCaught = error; }
		assert.equal(plainCaught, plain, 'S2: a plain Error must propagate unchanged from the as-of-publication read');
		assert.equal(plainCaught instanceof PresentationProfileError, false, 'S2: a plain Error must not be converted');

		// The existing conflict mapping is untouched: P2002/P2034 -> PRESENTATION_PROFILE_STALE.
		for (const code of ['P2002', 'P2034']) {
			const conflict = Object.assign(new Error('conflict'), { code });
			const client = {
				enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 1 }] },
				teacherProgramPresentationRevision: { findFirst: async () => null },
				$transaction: async () => { throw conflict; },
			};
			await assert.rejects(
				() => saveSignatoryProfile({ schoolId: 1, schoolYearId: 1, actorId: 1, expectedRevision: 0, input: {}, client }),
				(error: any) => error instanceof PresentationProfileError && error.code === 'PRESENTATION_PROFILE_STALE' && error.details?.conflictCode === code,
				`S2: ${code} must still map to PRESENTATION_PROFILE_STALE`,
			);
		}
		const txPlain = new Error('transaction plain failure');
		await assert.rejects(
			() => saveSignatoryProfile({
				schoolId: 1,
				schoolYearId: 1,
				actorId: 1,
				expectedRevision: 0,
				input: {},
				client: {
					enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 1 }] },
					teacherProgramPresentationRevision: { findFirst: async () => null },
					$transaction: async () => { throw txPlain; },
				},
			}),
			(error: any) => error === txPlain,
			'S2: an unrelated transaction failure must propagate unchanged',
		);
		// Contrast: the guard DOES translate P2021/P2022 at the same seam.
		for (const code of ['P2021', 'P2022']) {
			await assert.rejects(
				() => readEffectiveSignatoryProfile({ schoolId: 1, schoolYearId: 1, client: storeOf(async () => { throw Object.assign(new Error('missing'), { code }); }) }),
				(error: any) => error instanceof PresentationProfileError && error.statusCode === 503 && error.code === CODE && error.details === undefined,
				`S2 contrast: ${code} must translate to the typed 503`,
			);
		}

		// ═══ Column dropped: S5 (guarded route) + S14 (mutant) ═══

		await prisma.$executeRawUnsafe(`ALTER TABLE "${PRESENTATION_TABLE}" DROP COLUMN "footer_text"`);

		dispatch.length = 0;
		const dropped = await fetch(`${baseUrl}${exportPath}`, { headers: { Authorization: `Bearer ${adminToken}` } });
		const droppedBody = Buffer.from(await dropped.arrayBuffer());
		assertTypedSchemaUnavailable('S5', dropped.status, dropped.headers, droppedBody);

		let rawP2022: any = null;
		try {
			await prisma.teacherProgramPresentationRevision.findFirst({ where: { schoolId, schoolYearId }, select: { revision: true, footerText: true } });
		} catch (error) { rawP2022 = error; }
		assert.ok(rawP2022, 'S14: the direct unguarded read must fail while the column is absent');
		assert.equal(rawP2022.code, 'P2022', 'S14: the raw Prisma failure keeps its P2022 code');
		assert.equal(rawP2022 instanceof PresentationProfileError, false, 'S14: the raw failure is not the typed error');
		const mutantP2022 = await fetch(`${baseUrl}${unguardedPath}`);
		const mutantP2022Body = Buffer.from(await mutantP2022.arrayBuffer());
		assert.equal(mutantP2022.status, 500, 'S14: the unguarded path must surface a 500 through the real errorHandler');
		assert.equal((JSON.parse(mutantP2022Body.toString('utf8')) as any).code, 'P2022', 'S14: the unguarded 500 body keeps the raw P2022 code');

		// ═══ Table dropped: S3 + S4 (guarded route), S7 (settings), S13 (mutant) ═══

		await prisma.$executeRawUnsafe(`DROP TABLE "${PRESENTATION_TABLE}"`);

		dispatch.length = 0;
		const missing = await fetch(`${baseUrl}${exportPath}`, { headers: { Authorization: `Bearer ${adminToken}` } });
		const missingBody = Buffer.from(await missing.arrayBuffer());
		assertTypedSchemaUnavailable('S3', missing.status, missing.headers, missingBody);
		// S4 — zero document bytes on exactly that response.
		assertNoDocumentBytes('S4', missing.headers, missingBody);
		assert.equal(missingBody.length < 600, true, 'S4: the failure body is an error payload, not a document');
		assert.equal(dispatch.some((entry) => /\.(create|update|delete|upsert)/.test(entry)), false, 'S4: the failure path performs no write');

		dispatch.length = 0;
		const settings = await fetch(`${baseUrl}${settingsPath}`, { headers: { Authorization: `Bearer ${adminToken}` } });
		const settingsBody = Buffer.from(await settings.arrayBuffer());
		assertTypedSchemaUnavailable('S7', settings.status, settings.headers, settingsBody);

		let rawP2021: any = null;
		try {
			await prisma.teacherProgramPresentationRevision.findFirst({ where: { schoolId, schoolYearId } });
		} catch (error) { rawP2021 = error; }
		assert.ok(rawP2021, 'S13: the direct unguarded read must fail while the table is absent');
		assert.equal(rawP2021.code, 'P2021', 'S13: the raw Prisma failure keeps its P2021 code');
		assert.equal(rawP2021 instanceof PresentationProfileError, false, 'S13: the raw failure is not the typed error');
		const mutantP2021 = await fetch(`${baseUrl}${unguardedPath}`);
		const mutantP2021Body = Buffer.from(await mutantP2021.arrayBuffer());
		assert.equal(mutantP2021.status, 500, 'S13: the unguarded path must surface a 500 through the real errorHandler');
		assert.equal((JSON.parse(mutantP2021Body.toString('utf8')) as any).code, 'P2021', 'S13: the unguarded 500 body keeps the raw P2021 code');
	} finally {
		if (prisma) {
			await teardownCanonicalFixture(prisma, schoolId).catch(() => undefined);
			await prisma.$disconnect().catch(() => undefined);
		}
		if (server) {
			await new Promise<void>((resolve) => server!.close(() => resolve()));
			assert.equal(server.listening, false, 'S16: no stray HTTP listener may remain');
		}
		disposable!.drop();
		disposable!.assertDropped();
		configuredAfter = psqlValue(sourceUrl!, configuredDatabase, PROBE_SQL);
	}

	assert.equal(configuredAfter, '', `S15(after): public.${PRESENTATION_TABLE} must still not exist on the configured database`);
});
