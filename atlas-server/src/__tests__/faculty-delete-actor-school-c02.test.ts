/**
 * ACTOR-SCHOOL-MUTATIONS-C02 — mounted faculty placeholder delete authority.
 *
 * This test uses the real router and delete service with hermetic Prisma
 * delegates. Rejections must dispatch no delegate operation; allowed controls
 * must traverse the service exactly once.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'actor-school-mutations-c02-disposable-proof-secret';
const SCHOOL_ID = 41;
const REQUEST_TIMEOUT_MS = 1_000;

type Dispatches = { findUnique: number; transaction: number; deleteMany: number; delete: number };

function token(payload: Record<string, unknown>): string {
	return jwt.sign(payload, JWT_SECRET, { expiresIn: '10m' });
}

async function request(
	baseUrl: string,
	path: string,
	jwtToken?: string,
	body?: unknown,
): Promise<{ status: number; payload: any }> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(`${baseUrl}${path}`, {
			method: 'DELETE',
			headers: { ...(jwtToken === undefined ? {} : { authorization: `Bearer ${jwtToken}` }), 'content-type': 'application/json' },
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: controller.signal,
		});
		return { status: response.status, payload: await response.json() };
	} finally {
		clearTimeout(timeout);
	}
}

test('mounted faculty placeholder delete is strictly actor-school scoped', async () => {
	process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';
	process.env.JWT_SECRET = JWT_SECRET;
	process.env.ATLAS_SYSTEM_TOKEN = 'actor-school-mutations-c02-system-token';

	const { prisma } = await import('../lib/prisma.js');
	const facultyRouter = (await import('../routes/faculty.router.js')).default;
	const dispatches: Dispatches = { findUnique: 0, transaction: 0, deleteMany: 0, delete: 0 };
	const originals = {
		findUnique: prisma.facultyMirror.findUnique,
		transaction: prisma.$transaction,
		facultySubjectDeleteMany: prisma.facultySubject.deleteMany,
		facultyMirrorDelete: prisma.facultyMirror.delete,
	};

	prisma.facultyMirror.findUnique = (async () => {
		dispatches.findUnique += 1;
		return { id: 9001, schoolId: SCHOOL_ID, isPlaceholder: true };
	}) as unknown as typeof prisma.facultyMirror.findUnique;
	prisma.$transaction = (async (callback: (tx: any) => Promise<unknown>) => {
		dispatches.transaction += 1;
		return callback({
			facultySubject: {
				deleteMany: async () => {
					dispatches.deleteMany += 1;
					return { count: 1 };
				},
			},
			facultyMirror: {
				delete: async () => {
					dispatches.delete += 1;
					return { id: 9001 };
				},
			},
		});
	}) as typeof prisma.$transaction;

	const app = express();
	app.use(express.json());
	app.use('/api/v1/faculty', facultyRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}/api/v1/faculty`;
	const sameSchool = token({ userId: 1, role: 'officer', authSource: 'local', schoolId: SCHOOL_ID });
	const crossSchool = token({ userId: 2, role: 'officer', authSource: 'local', schoolId: SCHOOL_ID + 1 });
	const noSchool = token({ userId: 3, role: 'officer', authSource: 'local' });
	const stringSchool = token({ userId: 5, role: 'officer', authSource: 'local', schoolId: String(SCHOOL_ID) });
	const faculty = token({ userId: 4, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID });
	const reset = () => {
		dispatches.findUnique = 0;
		dispatches.transaction = 0;
		dispatches.deleteMany = 0;
		dispatches.delete = 0;
	};
	const assertNoDispatch = () => assert.deepEqual(dispatches, { findUnique: 0, transaction: 0, deleteMany: 0, delete: 0 });

	try {
		for (const [label, actor, expectedCode] of [
			['missing JWT', undefined, 'NO_TOKEN'],
			['invalid JWT', 'not-a-valid-jwt', 'INVALID_TOKEN'],
		] as const) {
			reset();
			const response = await request(baseUrl, `/9001?schoolId=${SCHOOL_ID}`, actor);
			assert.equal(response.status, 401, label);
			assert.equal(response.payload.code, expectedCode, label);
			assertNoDispatch();
		}

		const invalidValues: Array<[string, unknown]> = [
			['missing', undefined], ['null', null], ['empty', ''], ['zero', 0], ['fraction', 1.5],
			['negative', -1], ['boolean', true], ['array', [SCHOOL_ID]], ['object', { value: SCHOOL_ID }],
			['hex', '0x10'], ['exponent', '1e2'], ['leading-zero', '041'], ['padded', ' 41 '],
			['plus', '+41'], ['unsafe-number', Number.MAX_SAFE_INTEGER + 1], ['unsafe-string', '9007199254740992'],
		];
		for (const [label, value] of invalidValues) {
			reset();
			const response = await request(baseUrl, value === undefined ? '/9001' : `/9001?schoolId=${SCHOOL_ID}`, sameSchool, value === undefined ? undefined : { schoolId: value });
			assert.equal(response.status, 400, `${label}: expected 400`);
			assert.equal(response.payload.code, 'INVALID_PARAM', `${label}: expected INVALID_PARAM`);
			assertNoDispatch();
		}

		reset();
		const missingBody = await request(baseUrl, '/9001', sameSchool, {});
		assert.equal(missingBody.status, 400, 'missing schoolId must be rejected');
		assert.equal(missingBody.payload.code, 'INVALID_PARAM');
		assertNoDispatch();

		for (const [label, body] of [
			['body wins invalid', { schoolId: 'bad' }],
			['body wins cross-school', { schoolId: SCHOOL_ID + 1 }],
		] as const) {
			reset();
			const response = await request(baseUrl, `/9001?schoolId=${SCHOOL_ID}`, sameSchool, body);
			assert.equal(response.status, label.includes('invalid') ? 400 : 403, label);
			assert.equal(response.payload.code, label.includes('invalid') ? 'INVALID_PARAM' : 'CROSS_SCHOOL_DENIED', label);
			assertNoDispatch();
		}

		for (const [label, actor, expectedCode] of [
			['missing actor school', noSchool, 'SCHOOL_SCOPE_REQUIRED'],
			['string actor school', stringSchool, 'SCHOOL_SCOPE_REQUIRED'],
			['cross-school actor', crossSchool, 'CROSS_SCHOOL_DENIED'],
			['non-privileged actor', faculty, 'FORBIDDEN'],
		] as const) {
			reset();
			const response = await request(baseUrl, `/9001?schoolId=${SCHOOL_ID}`, actor, {});
			assert.equal(response.status, 403, label);
			assert.equal(response.payload.code, expectedCode, label);
			assertNoDispatch();
		}

		for (const [label, body, query] of [
			['same-school numeric body', { schoolId: SCHOOL_ID }, ''],
			['same-school canonical string body', { schoolId: String(SCHOOL_ID) }, ''],
			['same-school canonical query', {}, `?schoolId=${SCHOOL_ID}`],
		] as const) {
			reset();
			const response = await request(baseUrl, `/9001${query}`, sameSchool, body);
			assert.equal(response.status, 200, `${label}: ${response.status}/${response.payload.code}`);
			assert.equal(response.payload.success, true, label);
			assert.deepEqual(dispatches, { findUnique: 1, transaction: 1, deleteMany: 1, delete: 1 }, label);
		}
	} finally {
		prisma.facultyMirror.findUnique = originals.findUnique;
		prisma.$transaction = originals.transaction;
		prisma.facultySubject.deleteMany = originals.facultySubjectDeleteMany;
		prisma.facultyMirror.delete = originals.facultyMirrorDelete;
		server.closeAllConnections();
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await prisma.$disconnect();
	}
});
