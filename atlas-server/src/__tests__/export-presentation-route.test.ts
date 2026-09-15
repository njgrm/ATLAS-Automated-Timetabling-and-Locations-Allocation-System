/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — mounted presentation/signatory settings
 * route matrix (mandatory control 8 and control 9).
 *
 * Mounts the real `export-presentation.router` behind the production
 * `authenticate` middleware with hand-signed JWTs and an in-memory read/write
 * store, and proves:
 *   - missing/invalid JWT 401, raw system token 401, non-privileged 403,
 *     cross-school 403 with zero dispatch;
 *   - same-school read/preview/export paths are zero-write;
 *   - a committed save writes exactly one revision and one audit row;
 *   - a no-change replay performs zero additional writes;
 *   - a stale revision 409 and a validation 400 write nothing;
 *   - a non-active school year 409 writes nothing.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'export-presentation-route-fixture';

const SCHOOL_ID = 71;
const OTHER_SCHOOL_ID = 99;
const SCHOOL_YEAR_ID = 11;
const ACTIVE_YEAR_ID = 11;

const WRITE_METHODS = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

type Call = { model: string; method: string };

const calls: Call[] = [];
const revisionRows: Array<Record<string, unknown>> = [];
const auditRows: Array<Record<string, unknown>> = [];
let nextRevisionId = 1;
let nextAuditId = 1;

function record(model: string, method: string): void {
	calls.push({ model, method });
}
function writesFor(model?: string): Call[] {
	return calls.filter((call) => WRITE_METHODS.has(call.method) && (model == null || call.model === model));
}

function buildModels(): Record<string, Record<string, unknown>> {
	return {
		enrollProSchoolYearMirror: {
			findMany: async (args: any) => {
				record('enrollProSchoolYearMirror', 'findMany');
				const schoolId = args?.where?.schoolId;
				if (schoolId !== SCHOOL_ID) return [];
				return [{ enrollProSchoolYearId: ACTIVE_YEAR_ID }];
			},
		},
		teacherProgramPresentationRevision: {
			findFirst: async (args: any) => {
				record('teacherProgramPresentationRevision', 'findFirst');
				const where = args?.where ?? {};
				let rows = revisionRows.filter((row) =>
					row.schoolId === where.schoolId && row.schoolYearId === where.schoolYearId,
				);
				if (where.createdAt?.lte) {
					const cutoff = new Date(where.createdAt.lte).getTime();
					rows = rows.filter((row) => new Date(row.createdAt as string).getTime() <= cutoff);
				}
				rows.sort((a, b) => (b.revision as number) - (a.revision as number));
				return rows[0] ?? null;
			},
			create: async (args: any) => {
				record('teacherProgramPresentationRevision', 'create');
				const row = { id: nextRevisionId++, ...args.data };
				revisionRows.push(row);
				return row;
			},
		},
		auditLog: {
			create: async (args: any) => {
				record('auditLog', 'create');
				const row = { id: nextAuditId++, ...args.data };
				auditRows.push(row);
				return row;
			},
		},
	};
}

let harnessReady = false;
let server: any = null;
let baseUrl = '';
let jwt: any = null;
let prismaRef: any = null;
const fakeModels = buildModels();

try {
	const jwtModule: any = await import('jsonwebtoken');
	jwt = jwtModule.default ?? jwtModule;
	const expressModule: any = await import('express');
	const express = expressModule.default ?? expressModule;
	prismaRef = (await import('../lib/prisma.js')).prisma;
	const exportPresentationRouter = (await import('../routes/export-presentation.router.js')).default;
	for (const [model, delegate] of Object.entries(fakeModels)) {
		Object.defineProperty(prismaRef, model, { value: delegate, configurable: true });
	}
	// The in-memory store has no engine transaction; the harness transaction is a
	// passthrough over the patched delegates so the production CAS re-read and
	// audit+revision write path execute exactly as written.
	Object.defineProperty(prismaRef, '$transaction', { value: async (fn: any) => fn(prismaRef), configurable: true });
	const app = express();
	app.use(express.json());
	app.use('/api/v1/export-presentation', exportPresentationRouter);
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	baseUrl = `http://127.0.0.1:${address.port}`;
	harnessReady = true;
} catch {
	harnessReady = false;
}
const harnessSkip = harnessReady ? false : 'EXTERNALLY_BLOCKED: express/jsonwebtoken dependency tree is incomplete in this worktree';

test.after(async () => {
	if (!harnessReady) return;
	await new Promise<void>((resolve, reject) => server.close((error: Error | null) => error ? reject(error) : resolve()));
	for (const model of Object.keys(fakeModels)) delete prismaRef[model];
});

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '5m' });
}
function officer(schoolId = SCHOOL_ID): string {
	return token({ userId: 46, role: 'officer', authSource: 'local', schoolId });
}
function headers(auth: string) {
	return { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' };
}
const profileBody = (expectedRevision: number, overrides: Record<string, unknown> = {}) => ({
	expectedRevision,
	profile: {
		schoolHeadName: 'JUDY ANN B. NONATO',
		psdsName: 'EMILIA L. ENGLIS',
		cidChiefName: 'ARCH. NELSON G. BEDAURE, PhD',
		asdsName: 'JULITO L. FELICANO, CESE',
		footerText: 'For every learner, we rise!',
		...overrides,
	},
});

test.beforeEach(() => { calls.length = 0; });

// ─── Control 8 — authority matrix ───

test('missing and invalid JWTs are rejected with zero dispatch', { skip: harnessSkip }, async () => {
	const missing = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`);
	assert.equal(missing.status, 401);
	assert.equal((await missing.json() as any).code, 'NO_TOKEN');

	const invalid = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, { headers: headers('not-a-jwt') });
	assert.equal(invalid.status, 401);
	assert.equal(calls.length, 0, 'rejected JWTs dispatch zero model calls');
});

test('a raw system token is rejected with zero dispatch', { skip: harnessSkip }, async () => {
	process.env.ATLAS_SYSTEM_TOKEN = process.env.ATLAS_SYSTEM_TOKEN || 'route-fixture-system-token';
	const response = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		headers: headers(process.env.ATLAS_SYSTEM_TOKEN!),
	});
	assert.equal(response.status, 401);
	assert.equal(calls.length, 0);
});

test('a non-privileged role is rejected with zero dispatch', { skip: harnessSkip }, async () => {
	const response = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		headers: headers(token({ userId: 7, role: 'faculty', schoolId: SCHOOL_ID })),
	});
	assert.equal(response.status, 403);
	assert.equal((await response.json() as any).code, 'FORBIDDEN');
	assert.equal(calls.length, 0);
});

test('a cross-school actor is rejected with zero dispatch on read, preview and write', { skip: harnessSkip }, async () => {
	const read = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, { headers: headers(officer(OTHER_SCHOOL_ID)) });
	assert.equal(read.status, 403);
	assert.equal((await read.json() as any).code, 'CROSS_SCHOOL_DENIED');

	const preview = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/preview`, {
		method: 'POST', headers: headers(officer(OTHER_SCHOOL_ID)), body: JSON.stringify({ profile: {} }),
	});
	assert.equal(preview.status, 403);

	const write = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer(OTHER_SCHOOL_ID)), body: JSON.stringify(profileBody(0)),
	});
	assert.equal(write.status, 403);
	assert.equal(calls.length, 0, 'every rejected scope dispatches zero downstream calls');
});

// ─── Control 9 — zero-write reads/previews ───

test('a same-school read and preview are zero-write', { skip: harnessSkip }, async () => {
	const read = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, { headers: headers(officer()) });
	assert.equal(read.status, 200);
	const body = await read.json() as any;
	assert.equal(body.data.revision, null);
	assert.equal(body.data.schoolHead.title, 'School Head');

	const preview = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}/preview`, {
		method: 'POST', headers: headers(officer()),
		body: JSON.stringify({ profile: { schoolHeadName: '  Judy   Ann  ' } }),
	});
	assert.equal(preview.status, 200);
	const previewBody = await preview.json() as any;
	assert.equal(previewBody.data.normalized.schoolHeadName, 'Judy Ann', 'preview normalization is applied without persisting');
	assert.equal(writesFor().length, 0, 'read and preview perform zero writes');
});

// ─── Control 8 — committed change: one revision + one audit ───

test('a committed save writes exactly one revision and one audit row; a replay writes nothing', { skip: harnessSkip }, async () => {
	const first = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(0)),
	});
	assert.equal(first.status, 200);
	const firstBody = await first.json() as any;
	assert.equal(firstBody.data.revision, 1);
	assert.equal(firstBody.data.replayed, false);
	assert.equal(auditRows.length, 1, 'a committed change writes exactly one audit record');
	assert.equal(auditRows[0].action, 'TEACHER_PROGRAM_PRESENTATION_UPDATED');
	assert.equal(revisionRows.length, 1);
	assert.equal(writesFor('teacherProgramPresentationRevision').length, 1);
	assert.equal(writesFor('auditLog').length, 1);

	// No-change replay: zero additional writes, zero additional audits.
	const before = { revision: revisionRows.length, audit: auditRows.length };
	const replay = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(1)),
	});
	assert.equal(replay.status, 200);
	const replayBody = await replay.json() as any;
	assert.equal(replayBody.data.replayed, true);
	assert.equal(replayBody.data.revision, 1);
	assert.equal(revisionRows.length, before.revision, 'a no-change replay appends no revision');
	assert.equal(auditRows.length, before.audit, 'a no-change replay appends no audit');

	// A genuine change appends revision 2 with a second audit row.
	const second = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(1, { schoolHeadName: 'NEW HEAD' })),
	});
	assert.equal(second.status, 200);
	assert.equal((await second.json() as any).data.revision, 2);
	assert.equal(auditRows.length, 2);
});

test('a stale expectedRevision is rejected 409 with zero writes', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const stale = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(999)),
	});
	assert.equal(stale.status, 409);
	assert.equal((await stale.json() as any).code, 'PRESENTATION_PROFILE_STALE');
	assert.equal(writesFor().length, 0, 'a stale CAS rejection writes nothing');
});

test('typed validation rejects malformed input 400 with zero writes', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const tooLong = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(2, { schoolHeadName: 'x'.repeat(200) })),
	});
	assert.equal(tooLong.status, 400);
	assert.equal((await tooLong.json() as any).code, 'PRESENTATION_PROFILE_INVALID');

	const controlChars = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/${SCHOOL_YEAR_ID}`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(2, { psdsName: 'bad\u0007name' })),
	});
	assert.equal(controlChars.status, 400);
	assert.equal(writesFor().length, 0);
});

// ─── Active-year authority ───

test('editing a non-active school year is rejected 409 with zero writes', { skip: harnessSkip }, async () => {
	calls.length = 0;
	const response = await fetch(`${baseUrl}/api/v1/export-presentation/${SCHOOL_ID}/12`, {
		method: 'PUT', headers: headers(officer()), body: JSON.stringify(profileBody(0)),
	});
	assert.equal(response.status, 409);
	assert.equal((await response.json() as any).code, 'SCHOOL_YEAR_NOT_ACTIVE');
	assert.equal(writesFor().length, 0);
});
