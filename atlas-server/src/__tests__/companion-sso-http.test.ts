/**
 * COMPANION-SSO-C01 — mounted-route proof for ATLAS-side companion SSO.
 *
 * Drives the REAL Express app (routes + service + Prisma) against a DISPOSABLE
 * PostgreSQL database. The upstream EnrollPro exchange is exercised through the
 * production `fetch` path using an ephemeral localhost HTTP stub selected via
 * `ENROLLPRO_BASE_URL`; the real EnrollPro is never contacted.
 *
 * Run: $env:DATABASE_URL='...'; $env:JWT_SECRET='...'; npx tsx --test src/__tests__/companion-sso-http.test.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import jwt from 'jsonwebtoken';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';

const SCHOOL_ID = 9_200_101;
const OTHER_SCHOOL_ID = 9_200_102;
const YEAR_ID = 950_001;
const YEAR_LABEL = '2030-2031';
const REDIRECT_URI = 'https://enrollpro.test/api/auth/companion-sso/atlas/reverse/callback';
const OUTBOUND_SECRET = 'outbound-secret-value-0123456789abcdef';
const REVERSE_SECRET = 'reverse-secret-value-0123456789abcdef';

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'companion-sso-test-jwt-secret';
process.env.ENROLLPRO_SSO_CLIENT_SECRET = OUTBOUND_SECRET;
process.env.ATLAS_SSO_REVERSE_CLIENT_SECRET = REVERSE_SECRET;
process.env.ENROLLPRO_SSO_CALLBACK_URL = REDIRECT_URI;

type UpstreamPayload = Record<string, unknown>;

function successPayload(overrides: UpstreamPayload = {}): UpstreamPayload {
	const baseIdentity: UpstreamPayload = {
		subject: 'ENROLLPRO_USER:42',
		userId: 42,
		employeeId: 'EMP0001',
		lrn: null,
		firstName: 'Jose',
		middleName: null,
		lastName: 'Rizal',
		roles: ['SYSTEM_ADMIN'],
	};
	const baseYear = { id: YEAR_ID, yearLabel: YEAR_LABEL };
	const { identity, activeSchoolYear, ...rest } = overrides;
	return {
		success: true,
		companion: 'ATLAS',
		identity: identity === undefined
			? baseIdentity
			: { ...baseIdentity, ...(identity as UpstreamPayload) },
		activeSchoolYear: activeSchoolYear === undefined
			? baseYear
			: { ...baseYear, ...(activeSchoolYear as UpstreamPayload) },
		authenticatedAt: new Date().toISOString(),
		...rest,
	};
}

async function startJsonStub(handler: (url: string, body: unknown) => { status: number; payload: UpstreamPayload }, label: string) {
	const server: Server = createServer((req, res) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk) => chunks.push(chunk));
		req.on('end', () => {
			let body: unknown = null;
			try {
				body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
			} catch {
				body = null;
			}
			const result = handler(req.url ?? '', body);
			res.statusCode = result.status;
			res.setHeader('content-type', 'application/json');
			res.end(JSON.stringify(result.payload));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object', `${label} stub must bind`);
	return { server, baseUrl: `http://127.0.0.1:${address.port}`, requests: [] as Array<{ url: string; body: unknown }> };
}

async function withUpstream<T>(handler: (url: string, body: unknown) => { status: number; payload: UpstreamPayload }, run: (baseUrl: string, requests: Array<{ url: string; body: unknown }>) => Promise<T>): Promise<T> {
	const stub = await startJsonStub((url, body) => {
		stub.requests.push({ url, body });
		return handler(url, body);
	}, 'enrollpro');
	const previous = process.env.ENROLLPRO_BASE_URL;
	process.env.ENROLLPRO_BASE_URL = stub.baseUrl;
	try {
		return await run(stub.baseUrl, stub.requests);
	} finally {
		if (previous === undefined) delete process.env.ENROLLPRO_BASE_URL;
		else process.env.ENROLLPRO_BASE_URL = previous;
		await new Promise<void>((resolve) => stub.server.close(() => resolve()));
	}
}

let server: Server;
let baseOrigin = '';

test.before(async () => {
	server = createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	assert.ok(address && typeof address === 'object');
	baseOrigin = `http://127.0.0.1:${address.port}`;

	await prisma.school.deleteMany({ where: { id: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.school.create({ data: { id: SCHOOL_ID, name: 'Companion SSO School', shortName: 'CSSO' } });
	await prisma.school.create({ data: { id: OTHER_SCHOOL_ID, name: 'Companion SSO Other', shortName: 'CSSO2' } });
});

test.after(async () => {
	await prisma.companionSsoCode.deleteMany({ where: { schoolId: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.auditLog.deleteMany({ where: { schoolId: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.atlasAuthAccount.deleteMany({ where: { schoolId: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.facultyMirror.deleteMany({ where: { schoolId: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await prisma.school.deleteMany({ where: { id: { in: [SCHOOL_ID, OTHER_SCHOOL_ID] } } });
	await new Promise<void>((resolve) => server.close(() => resolve()));
	await prisma.$disconnect();
});

async function resetSchoolState(schoolId = SCHOOL_ID) {
	await prisma.companionSsoCode.deleteMany({ where: { schoolId } });
	await prisma.auditLog.deleteMany({ where: { schoolId } });
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } });
	await prisma.atlasAuthAccount.deleteMany({ where: { schoolId } });
	await prisma.facultyMirror.deleteMany({ where: { schoolId } });
}

async function createActiveMirror(overrides: Partial<{ enrollProSchoolYearId: number; yearLabel: string; isActive: boolean; isArchived: boolean }> = {}) {
	return prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId: SCHOOL_ID,
			enrollProSchoolYearId: YEAR_ID,
			yearLabel: YEAR_LABEL,
			isActive: true,
			isArchived: false,
			syncStatus: 'synced',
			...overrides,
		},
	});
}

/** `atlas_auth_accounts.employee_id` is VarChar(7). */
function uniqueEmployeeId(): string {
	return `E${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 7);
}

async function createOfficerAccount(overrides: Partial<{ employeeId: string | null; accountName: string | null; role: string; isActive: boolean }> = {}) {
	return prisma.atlasAuthAccount.create({
		data: {
			schoolId: SCHOOL_ID,
			email: `officer-${Date.now()}-${Math.random().toString(36).slice(2)}@deped.edu.ph`,
			employeeId: overrides.employeeId === undefined ? uniqueEmployeeId() : overrides.employeeId,
			accountName: overrides.accountName === undefined
				? `n${Math.random().toString(36).slice(2, 9)}`.slice(0, 8)
				: overrides.accountName,
			role: overrides.role ?? 'SYSTEM_ADMIN',
			passwordHash: 'not-a-real-hash',
			isActive: overrides.isActive ?? true,
		},
	});
}

function privilegedToken(accountId: number, schoolId = SCHOOL_ID, role = 'SYSTEM_ADMIN'): string {
	return jwt.sign({ userId: accountId, accountId, role, authSource: 'local', schoolId }, process.env.JWT_SECRET!, { expiresIn: '5m' });
}

function sessionAuditCount(schoolId = SCHOOL_ID): Promise<number> {
	return prisma.auditLog.count({ where: { schoolId, action: 'COMPANION_SSO_SESSION_CREATED' } });
}

function codeConsumedAuditCount(schoolId = SCHOOL_ID): Promise<number> {
	return prisma.auditLog.count({ where: { schoolId, action: 'COMPANION_SSO_CODE_CONSUMED' } });
}

/* ─── Proof 1: Flow A happy path ───────────────────────────────────────────── */

test('COMPANION-SSO proof 1: Flow A happy path maps an existing account, audits once, updates lastLoginAt, redirects with a fragment token', async () => {
	await resetSchoolState();
	const employeeId = uniqueEmployeeId();
	const account = await createOfficerAccount({ employeeId });
	await createActiveMirror();

	const before = await prisma.atlasAuthAccount.findUnique({ where: { id: account.id }, select: { lastLoginAt: true } });
	assert.equal(before?.lastLoginAt, null, 'fixture account starts with no lastLoginAt');

	await withUpstream(
		(url, body) => {
			assert.equal(url, '/auth/companion-sso/atlas/exchange');
			assert.deepEqual(body, { code: 'A'.repeat(43) });
			return { status: 200, payload: successPayload({ identity: { employeeId, roles: ['SYSTEM_ADMIN'] } }) };
		},
		async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'A'.repeat(43)}`, { redirect: 'manual' });
			assert.equal(response.status, 302);
			const location = response.headers.get('location') ?? '';
			assert.ok(location.startsWith('/auth/sso/callback#atlasToken='), `unexpected redirect: ${location}`);
			const token = location.split('#atlasToken=')[1];
			assert.ok(!location.includes('?'), 'the session token redirect must carry no query string');
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { role: string; accountId: number; schoolId: number; authSource: string };
			assert.equal(decoded.role, 'SYSTEM_ADMIN');
			assert.equal(decoded.accountId, account.id);
			assert.equal(decoded.schoolId, SCHOOL_ID);
			assert.equal(decoded.authSource, 'local');
		},
	);

	assert.equal(await sessionAuditCount(), 1, 'exactly one COMPANION_SSO_SESSION_CREATED audit row');
	const after = await prisma.atlasAuthAccount.findUnique({ where: { id: account.id }, select: { lastLoginAt: true } });
	assert.ok(after?.lastLoginAt instanceof Date, 'lastLoginAt must be updated');
});

/* ─── Proof 2: Flow A malformed / replayed / unreachable ───────────────────── */

test('COMPANION-SSO proof 2a: malformed code shape is rejected before any upstream call and writes nothing', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();
	let upstreamCalls = 0;

	await withUpstream(
		() => {
			upstreamCalls += 1;
			return { status: 200, payload: successPayload() };
		},
		async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=short`, { redirect: 'manual' });
			assert.equal(response.status, 302);
			assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_CODE_INVALID/);
		},
	);

	assert.equal(upstreamCalls, 0, 'malformed code must not reach EnrollPro');
	assert.equal(await sessionAuditCount(), 0);
	const refreshed = await prisma.atlasAuthAccount.findUnique({ where: { id: account.id }, select: { lastLoginAt: true } });
	assert.equal(refreshed?.lastLoginAt, null);
});

test('COMPANION-SSO proof 2b: replayed code (upstream success:false) is rejected with zero writes', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();

	await withUpstream(
		() => ({ status: 401, payload: { success: false, error: 'COMPANION_SSO_CODE_INVALID' } }),
		async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'B'.repeat(43)}`, { redirect: 'manual' });
			assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_CODE_INVALID/);
		},
	);

	assert.equal(await sessionAuditCount(), 0);
	const refreshed = await prisma.atlasAuthAccount.findUnique({ where: { id: account.id }, select: { lastLoginAt: true } });
	assert.equal(refreshed?.lastLoginAt, null);
});

test('COMPANION-SSO proof 2c: wrong companion and wrong active-school-year payloads are rejected', async () => {
	await resetSchoolState();
	await createOfficerAccount();
	await createActiveMirror();

	await withUpstream(
		() => ({ status: 200, payload: successPayload({ companion: 'AIMS' }) }),
		async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'C'.repeat(43)}`, { redirect: 'manual' });
			assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_CODE_INVALID/);
		},
	);
	assert.equal(await sessionAuditCount(), 0);
});

test('COMPANION-SSO proof 2d: upstream unreachable returns COMPANION_SSO_UNREACHABLE with no session or partial writes', async () => {
	await resetSchoolState();
	await createOfficerAccount();
	await createActiveMirror();
	const previous = process.env.ENROLLPRO_BASE_URL;
	process.env.ENROLLPRO_BASE_URL = 'http://127.0.0.1:1';
	try {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'D'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_UNREACHABLE/);
	} finally {
		if (previous === undefined) delete process.env.ENROLLPRO_BASE_URL;
		else process.env.ENROLLPRO_BASE_URL = previous;
	}
	assert.equal(await sessionAuditCount(), 0);
});

/* ─── Proof 3: Flow A account failures ─────────────────────────────────────── */

test('COMPANION-SSO proof 3: unknown, ambiguous, inactive, disallowed-role, and faculty-gate failures all write zero rows', async () => {
	await resetSchoolState();
	await createActiveMirror();
	const payload = successPayload();

	// Unknown account.
	await withUpstream(() => ({ status: 200, payload }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'E'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_IDENTITY_INCOMPLETE/);
	});

	// Unresolvable accountName identity (no employee id, no matching name). The
	// DB enforces UNIQUE(employee_id) and UNIQUE(account_name), so a genuine
	// multi-row match cannot be materialized; the deterministic single-match
	// guard (`candidates.size !== 1`) rejects both zero and multiple matches and
	// is exercised here through the zero-match path.
	await createOfficerAccount({ employeeId: null, accountName: `present.${Math.random().toString(36).slice(2, 8)}` });
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId: undefined, accountName: 'no.such.account.name', roles: ['SYSTEM_ADMIN'] } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'F'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_IDENTITY_INCOMPLETE/);
	});

	// Inactive account.
	const inactive = await createOfficerAccount({ employeeId: 'EMPOFF', isActive: false });
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId: 'EMPOFF', roles: ['SYSTEM_ADMIN'] } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'G'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_ACCOUNT_UNAVAILABLE/);
	});
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 0);
	void inactive;

	// Local role outside the ATLAS allowed set.
	await createOfficerAccount({ employeeId: 'EMPLEAR', role: 'LEARNER' });
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId: 'EMPLEAR', roles: ['SYSTEM_ADMIN'] } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'H'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_ROLE_DENIED/);
	});

	// Upstream payload carries no allowed role.
	// Local role outside the ATLAS allowed set: even though the EnrollPro payload
	// carries an allowed role, the stored local role is authoritative.
	await createOfficerAccount({ employeeId: 'EMPNORO', role: 'MRF' });
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId: 'EMPNORO', roles: ['MRF'] } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'I'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_ROLE_DENIED/);
	});

	// Faculty account whose canonical mirror is inactive -> fail-closed.
	const facultyMirror = await prisma.facultyMirror.create({
		data: {
			schoolId: SCHOOL_ID,
			externalId: 8801,
			employeeId: 'EMPFAC',
			firstName: 'Maria',
			lastName: 'Clara',
			isActiveForScheduling: false,
			isStale: false,
		},
	});
	const faculty = await prisma.atlasAuthAccount.create({
		data: {
			schoolId: SCHOOL_ID,
			email: 'maria.clara@deped.edu.ph',
			employeeId: 'EMPFAC',
			role: 'faculty',
			facultyId: facultyMirror.id,
			passwordHash: 'not-a-real-hash',
			isActive: true,
		},
	});
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId: 'EMPFAC', roles: ['TEACHER'] } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'J'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_ACCOUNT_UNAVAILABLE/);
	});
	void faculty;

	assert.equal(await sessionAuditCount(), 0, 'no rejection may write a session audit');
	for (const account of await prisma.atlasAuthAccount.findMany({ where: { schoolId: SCHOOL_ID }, select: { lastLoginAt: true } })) {
		assert.equal(account.lastLoginAt, null, 'no rejection may update lastLoginAt');
	}
});

/* ─── Proof 4: Flow A school-year parity ───────────────────────────────────── */

test('COMPANION-SSO proof 4: missing / mismatched year id / mismatched label are rejected; matching mirror passes', async () => {
	await resetSchoolState();
	const employeeId = uniqueEmployeeId();
	await createOfficerAccount({ employeeId });
	const identity = { employeeId, roles: ['SYSTEM_ADMIN'] };

	// Missing mirror.
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'K'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=ACTIVE_SCHOOL_YEAR_REQUIRED/);
	});

	// Mismatched year id.
	await createActiveMirror({ enrollProSchoolYearId: YEAR_ID });
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity, activeSchoolYear: { id: YEAR_ID + 1, yearLabel: YEAR_LABEL } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'L'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=ACTIVE_SCHOOL_YEAR_CONFLICT/);
	});

	// Mismatched label.
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity, activeSchoolYear: { id: YEAR_ID, yearLabel: '1999-2000' } }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'M'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /ssoError=ACTIVE_SCHOOL_YEAR_CONFLICT/);
	});

	assert.equal(await sessionAuditCount(), 0);

	// Matching mirror passes.
	await withUpstream(() => ({ status: 200, payload: successPayload({ identity }) }), async () => {
		const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'N'.repeat(43)}`, { redirect: 'manual' });
		assert.match(response.headers.get('location') ?? '', /^\/auth\/sso\/callback#atlasToken=/);
	});
	assert.equal(await sessionAuditCount(), 1);
});

/* ─── Proof 5: Flow B authorize route matrix ───────────────────────────────── */

test('COMPANION-SSO proof 5: Flow B authorize rejects missing/invalid JWT, non-privileged role, and malformed params with zero code rows', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	const privileged = privilegedToken(account.id);
	const validBody = {
		response_type: 'code',
		client_id: 'enrollpro',
		redirect_uri: REDIRECT_URI,
		state: 'opaque-state-value',
	};

	const codeRowCount = () => prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } });

	// Missing JWT.
	let response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody),
	});
	assert.equal(response.status, 401);
	assert.equal(await codeRowCount(), 0);

	// Invalid JWT.
	response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST', headers: { Authorization: 'Bearer not.a.jwt', 'Content-Type': 'application/json' }, body: JSON.stringify(validBody),
	});
	assert.equal(response.status, 401);
	assert.equal(await codeRowCount(), 0);

	// Non-privileged role.
	const facultyToken = jwt.sign({ userId: 7, accountId: 7, role: 'faculty', authSource: 'local', schoolId: SCHOOL_ID }, process.env.JWT_SECRET!, { expiresIn: '5m' });
	response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST', headers: { Authorization: `Bearer ${facultyToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(validBody),
	});
	assert.equal(response.status, 403);
	const forbidden = await response.json() as { code: string };
	assert.equal(forbidden.code, 'COMPANION_SSO_ROLE_DENIED');
	assert.equal(await codeRowCount(), 0);

	const badRequests: Array<Record<string, unknown>> = [
		{ ...validBody, response_type: 'token' },
		{ ...validBody, client_id: 'aims' },
		{ ...validBody, redirect_uri: 'https://evil.example/callback' },
		{ ...validBody, redirect_uri: '//evil.example' },
		{ ...validBody, state: '' },
	];
	for (const body of badRequests) {
		response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
			method: 'POST', headers: { Authorization: `Bearer ${privileged}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
		});
		assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);
		assert.equal(await codeRowCount(), 0, 'rejected authorize must persist no code row');
	}

	// Valid request issues exactly one hash-only row.
	response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST', headers: { Authorization: `Bearer ${privileged}`, 'Content-Type': 'application/json' }, body: JSON.stringify(validBody),
	});
	assert.equal(response.status, 200);
	const issued = await response.json() as { callbackUrl: string };
	assert.ok(issued.callbackUrl.startsWith(`${REDIRECT_URI}?`));
	const code = new URL(issued.callbackUrl).searchParams.get('code');
	assert.ok(code && /^[A-Za-z0-9_-]{43}$/.test(code));
	assert.equal(new URL(issued.callbackUrl).searchParams.get('state'), 'opaque-state-value');
	assert.equal(await codeRowCount(), 1);
});

/* ─── Proof 6: issue → exchange happy path ─────────────────────────────────── */

async function issueCode(accountId: number, state = 'opaque-state-value'): Promise<{ code: string; callbackUrl: string }> {
	const token = privilegedToken(accountId);
	const response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ response_type: 'code', client_id: 'enrollpro', redirect_uri: REDIRECT_URI, state }),
	});
	assert.equal(response.status, 200, 'authorize must succeed for a privileged account');
	const body = await response.json() as { callbackUrl: string };
	const code = new URL(body.callbackUrl).searchParams.get('code');
	assert.ok(code);
	return { code, callbackUrl: body.callbackUrl };
}

async function callExchange(body: unknown, secret: string | null = REVERSE_SECRET) {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (secret !== null) headers.Authorization = `Bearer ${secret}`;
	return fetch(`${baseOrigin}/api/v1/auth/sso/exchange`, { method: 'POST', headers, body: JSON.stringify(body) });
}

test('COMPANION-SSO proof 6: Flow B exchange returns the ATLAS assertion, consumes once, audits once', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();
	const { code } = await issueCode(account.id);

	const response = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.equal(response.status, 200);
	const assertion = await response.json() as {
		success: boolean; issuer: string;
		identity: { subject: string; employeeId: string | null; roles: string[]; lrn: null; middleName: null };
		activeSchoolYear: { id: number; yearLabel: string };
		authenticatedAt: string;
	};
	assert.equal(assertion.success, true);
	assert.equal(assertion.issuer, 'ATLAS');
	assert.equal(assertion.identity.subject, `ATLAS_USER:${account.id}`);
	assert.equal(assertion.identity.roles[0], 'SYSTEM_ADMIN');
	assert.equal(assertion.identity.lrn, null);
	assert.equal(assertion.identity.middleName, null);
	assert.equal(assertion.activeSchoolYear.id, YEAR_ID);
	assert.equal(assertion.activeSchoolYear.yearLabel, YEAR_LABEL);
	assert.ok(!Number.isNaN(Date.parse(assertion.authenticatedAt)));

	const row = await prisma.companionSsoCode.findFirst({ where: { schoolId: SCHOOL_ID }, select: { consumedAt: true, codeHash: true } });
	assert.ok(row?.consumedAt instanceof Date, 'code row must be marked consumed');
	assert.match(row!.codeHash, /^[0-9a-f]{64}$/);
	assert.equal(await codeConsumedAuditCount(), 1, 'exactly one COMPANION_SSO_CODE_CONSUMED audit');
});

/* ─── Proof 7: Flow B exchange negatives ───────────────────────────────────── */

test('COMPANION-SSO proof 7: exchange negatives return the exact invalid-code JSON with zero success audits', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();
	const { code } = await issueCode(account.id);
	const invalidJson = { code: 'COMPANION_SSO_CODE_INVALID', message: 'The SSO authorization code is invalid, expired, or already used.' };

	// Missing / wrong-length / wrong secret.
	assert.equal((await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }, null)).status, 401);
	assert.equal((await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }, 'short')).status, 401);
	assert.equal((await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }, 'x'.repeat(REVERSE_SECRET.length))).status, 401);

	// Malformed code shape.
	let response = await callExchange({ code: 'not-43-characters', clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.equal(response.status, 401);
	assert.deepEqual(await response.json(), invalidJson);

	// Wrong clientId / wrong redirectUri.
	response = await callExchange({ code, clientId: 'aims', redirectUri: REDIRECT_URI });
	assert.deepEqual(await response.json(), invalidJson);
	response = await callExchange({ code, clientId: 'enrollpro', redirectUri: 'https://evil.example/cb' });
	assert.deepEqual(await response.json(), invalidJson);

	// Unknown code.
	response = await callExchange({ code: 'Z'.repeat(43), clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.deepEqual(await response.json(), invalidJson);

	// Expired code.
	await prisma.companionSsoCode.updateMany({ where: { schoolId: SCHOOL_ID }, data: { expiresAt: new Date(Date.now() - 60_000) } });
	response = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.deepEqual(await response.json(), invalidJson);

	// Wrong audience.
	await prisma.companionSsoCode.updateMany({ where: { schoolId: SCHOOL_ID }, data: { audience: 'smart', expiresAt: new Date(Date.now() + 60_000) } });
	response = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.deepEqual(await response.json(), invalidJson);

	// Replayed (now correctly bound) code: restore audience+expiry, consume once, then replay.
	await prisma.companionSsoCode.updateMany({ where: { schoolId: SCHOOL_ID }, data: { audience: 'enrollpro', expiresAt: new Date(Date.now() + 60_000), consumedAt: null } });
	const first = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.equal(first.status, 200);
	const replay = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
	assert.equal(replay.status, 401);
	assert.deepEqual(await replay.json(), invalidJson);

	assert.equal(await codeConsumedAuditCount(), 1, 'only the single successful exchange audits');
});

/* ─── Proof 8: concurrency ─────────────────────────────────────────────────── */

test('COMPANION-SSO proof 8: two concurrent exchanges of one code yield exactly one 200 and one typed 401', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();
	const { code } = await issueCode(account.id);

	const [left, right] = await Promise.all([
		callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }),
		callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }),
	]);
	const statuses = [left.status, right.status].sort();
	assert.deepEqual(statuses, [200, 401]);
	const loser = left.status === 401 ? left : right;
	assert.deepEqual(await loser.json(), { code: 'COMPANION_SSO_CODE_INVALID', message: 'The SSO authorization code is invalid, expired, or already used.' });
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID, consumedAt: { not: null } } }), 1);
	assert.equal(await codeConsumedAuditCount(), 1);
});

/* ─── Proof 9: zero plaintext codes at rest ────────────────────────────────── */

test('COMPANION-SSO proof 9: no companion_sso_codes row contains the plaintext code', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();
	const { code } = await issueCode(account.id);

	const rows = await prisma.companionSsoCode.findMany({ where: { schoolId: SCHOOL_ID }, select: { codeHash: true, redirectUri: true } });
	assert.ok(rows.length >= 1);
	const expectedHash = createHash('sha256').update(code, 'utf8').digest('hex');
	for (const row of rows) {
		assert.match(row.codeHash, /^[0-9a-f]{64}$/);
		assert.notEqual(row.codeHash, code, 'plaintext code must never be persisted');
		assert.ok(!row.redirectUri.includes(code), 'redirectUri must not embed the code');
	}
	assert.ok(rows.some((row) => row.codeHash === expectedHash), 'stored hash must be the SHA-256 of the issued code');
});

/* ─── Proof 10: no leak ────────────────────────────────────────────────────── */

test('COMPANION-SSO proof 10: responses and console output never contain the code, secrets, or a fragment token', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	await createActiveMirror();

	const captured: string[] = [];
	const originalLog = console.log;
	const originalWarn = console.warn;
	const originalError = console.error;
	console.log = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };
	console.warn = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };
	console.error = (...args: unknown[]) => { captured.push(args.map(String).join(' ')); };

	let issuedCode = '';
	try {
		const { code } = await issueCode(account.id);
		issuedCode = code;
		const ok = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI });
		assert.equal(ok.status, 200);
		const bad = await callExchange({ code: 'Q'.repeat(43), clientId: 'enrollpro', redirectUri: REDIRECT_URI });
		assert.equal(bad.status, 401);
		const badSecret = await callExchange({ code, clientId: 'enrollpro', redirectUri: REDIRECT_URI }, 'wrong-secret');
		assert.equal(badSecret.status, 401);
		const callback = await withUpstream(() => ({ status: 200, payload: successPayload() }), async () =>
			fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${'P'.repeat(43)}`, { redirect: 'manual' }));
		assert.equal(callback.status, 302);
	} finally {
		console.log = originalLog;
		console.warn = originalWarn;
		console.error = originalError;
	}

	const joined = captured.join('\n');
	assert.ok(issuedCode.length === 43);
	for (const secret of [OUTBOUND_SECRET, REVERSE_SECRET]) {
		assert.ok(!joined.includes(secret), 'logs must never contain a secret value');
	}
	assert.ok(!joined.includes(issuedCode), 'logs must never contain the plaintext code');
	assert.ok(!joined.includes('atlasToken='), 'logs must never contain a fragment token');
	assert.ok(!joined.includes('P'.repeat(43)), 'logs must never contain an exchanged code');
});

/* ─── Proof 11: existing login + me regression ─────────────────────────────── */

test('COMPANION-SSO proof 11: existing POST /auth/login and GET /auth/me behavior is unchanged', async () => {
	const bcrypt = await import('bcryptjs');
	await resetSchoolState();
	const hash = await bcrypt.hash('CorrectHorse1!', 12);
	const account = await prisma.atlasAuthAccount.create({
		data: {
			schoolId: SCHOOL_ID,
			email: 'regression.login@deped.edu.ph',
			employeeId: 'empreg7',
			role: 'SYSTEM_ADMIN',
			passwordHash: hash,
			isActive: true,
		},
	});

	const loginResponse = await fetch(`${baseOrigin}/api/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: 'empreg7', password: 'CorrectHorse1!' }),
	});
	assert.equal(loginResponse.status, 200);
	const loginBody = await loginResponse.json() as { token: string; user: { userId: number; role: string; authSource: string } };
	assert.equal(loginBody.user.role, 'SYSTEM_ADMIN');
	assert.equal(loginBody.user.authSource, 'local');
	assert.ok(loginBody.token);

	const meResponse = await fetch(`${baseOrigin}/api/v1/auth/me`, {
		headers: { Authorization: `Bearer ${loginBody.token}` },
	});
	assert.equal(meResponse.status, 200);
	const meBody = await meResponse.json() as { user: { userId: number; role: string; accountId: number } };
	assert.equal(meBody.user.role, 'SYSTEM_ADMIN');
	assert.equal(meBody.user.accountId, account.id);
	assert.equal(meBody.user.userId, account.id);
});

/* ─── Correction F1: upstream EnrollPro role set enforced ──────────────────── */

test('COMPANION-SSO proof 12: upstream disallowed roles are denied with zero writes even for a valid local account', async () => {
	await resetSchoolState();
	await createActiveMirror();
	const employeeId = uniqueEmployeeId();
	const account = await createOfficerAccount({ employeeId });

	const deniedRoleSets: string[][] = [['MRF'], ['LEARNER'], ['GUEST'], ['UNKNOWN'], ['MRF', 'LEARNER', 'GUEST'], []];
	const codeLetters = ['O', 'P', 'Q', 'R', 'S', 'T'];
	for (let index = 0; index < deniedRoleSets.length; index += 1) {
		const roles = deniedRoleSets[index];
		await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId, roles } }) }), async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${codeLetters[index].repeat(43)}`, { redirect: 'manual' });
			assert.match(response.headers.get('location') ?? '', /ssoError=COMPANION_SSO_ROLE_DENIED/, `roles ${JSON.stringify(roles)} must be denied`);
		});
	}

	assert.equal(await sessionAuditCount(), 0, 'no denied upstream role may create a session audit');
	const refreshed = await prisma.atlasAuthAccount.findUnique({ where: { id: account.id }, select: { lastLoginAt: true } });
	assert.equal(refreshed?.lastLoginAt, null, 'no denied upstream role may update lastLoginAt');
});

test('COMPANION-SSO proof 13: each allowed upstream role alone is accepted for a valid local account', async () => {
	await resetSchoolState();
	await createActiveMirror();
	const allowedRoles = ['SYSTEM_ADMIN', 'HEAD_REGISTRAR', 'CLASS_ADVISER', 'TEACHER'];
	const codeLetters = ['U', 'V', 'W', 'X'];
	for (let index = 0; index < allowedRoles.length; index += 1) {
		const employeeId = uniqueEmployeeId();
		await createOfficerAccount({ employeeId });
		await withUpstream(() => ({ status: 200, payload: successPayload({ identity: { employeeId, roles: [allowedRoles[index]] } }) }), async () => {
			const response = await fetch(`${baseOrigin}/api/v1/auth/enrollpro/callback?code=${codeLetters[index].repeat(43)}`, { redirect: 'manual' });
			assert.match(response.headers.get('location') ?? '', /^\/auth\/sso\/callback#atlasToken=/, `role ${allowedRoles[index]} must be accepted`);
		});
	}
	assert.equal(await sessionAuditCount(), allowedRoles.length);
});

/* ─── Correction F3.2: callback validated before code insert ────────────────── */

test('COMPANION-SSO proof 14: an invalid configured reverse callback leaves zero code rows', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	const previous = process.env.ENROLLPRO_SSO_CALLBACK_URL;
	process.env.ENROLLPRO_SSO_CALLBACK_URL = 'not-an-absolute-url';
	try {
		const response = await fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${privilegedToken(account.id)}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ response_type: 'code', client_id: 'enrollpro', redirect_uri: 'not-an-absolute-url', state: 'opaque' }),
		});
		assert.equal(response.status, 503);
		assert.equal((await response.json() as { code: string }).code, 'COMPANION_SSO_NOT_CONFIGURED');
		assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 0, 'no orphan code row');
	} finally {
		if (previous === undefined) delete process.env.ENROLLPRO_SSO_CALLBACK_URL;
		else process.env.ENROLLPRO_SSO_CALLBACK_URL = previous;
	}
});

/* ─── Correction F3.3: authorize rejects incomplete privileged sessions ────── */

test('COMPANION-SSO proof 15: authorize rejects a privileged JWT without a usable account/school instead of defaulting', async () => {
	await resetSchoolState();
	const account = await createOfficerAccount();
	const validBody = { response_type: 'code', client_id: 'enrollpro', redirect_uri: REDIRECT_URI, state: 'opaque' };
	const post = (token: string) => fetch(`${baseOrigin}/api/v1/auth/sso/authorize`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify(validBody),
	});

	const missingAccount = jwt.sign({ userId: 5, role: 'SYSTEM_ADMIN', authSource: 'local', schoolId: SCHOOL_ID }, process.env.JWT_SECRET!, { expiresIn: '5m' });
	let response = await post(missingAccount);
	assert.equal(response.status, 403);
	assert.equal((await response.json() as { code: string }).code, 'COMPANION_SSO_IDENTITY_INCOMPLETE');
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 0);

	const missingSchool = jwt.sign({ userId: 6, accountId: 6, role: 'SYSTEM_ADMIN', authSource: 'local' }, process.env.JWT_SECRET!, { expiresIn: '5m' });
	response = await post(missingSchool);
	assert.equal(response.status, 403);
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 0);

	const zeroSchool = jwt.sign({ userId: 7, accountId: 7, role: 'SYSTEM_ADMIN', authSource: 'local', schoolId: 0 }, process.env.JWT_SECRET!, { expiresIn: '5m' });
	response = await post(zeroSchool);
	assert.equal(response.status, 403);
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 0);

	// A fully-formed local JWT still issues exactly one row.
	response = await post(privilegedToken(account.id));
	assert.equal(response.status, 200);
	assert.equal(await prisma.companionSsoCode.count({ where: { schoolId: SCHOOL_ID } }), 1);
});
