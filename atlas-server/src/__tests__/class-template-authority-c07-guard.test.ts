/**
 * AUTHZ-CLASS-TEMPLATE-C07 — dispatch-free authority guard suite (G01..G06, G11, G13).
 *
 * Design: the REAL Express app is booted with `DATABASE_URL` pointed at a
 * syntactically valid database that DOES NOT EXIST (`atlas_c07_absent_<random>`,
 * cloned from the configured source URL; never created, never printed). Every
 * guard row must therefore be rejected BEFORE any service dispatch: a pre-guard
 * dispatch against the absent database would surface as a `500`, so an exact
 * typed rejection (and never `500`, never `200`) is the zero-dispatch control.
 *
 * Mechanism used: real-app mount against a non-existent database. The
 * instrumented `withDataContext()` counter fallback was NOT needed.
 *
 * Run: `npx tsx src/__tests__/class-template-authority-c07-guard.test.ts`
 * (from `atlas-server`). No database is created, written, or dropped here.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

let passCount = 0;
let failCount = 0;

function check(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, '..');
const WORKDIR = process.cwd();
const RUNTIME_ENV = 'D:/ATLAS-runtime-config/atlas-server.env';

function readEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	try {
		for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			if (!key) continue;
			out[key] = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
		}
	} catch {
		/* absent */
	}
	return out;
}

/** Recursively list `.ts` files under a root, skipping `__tests__` directories. */
function listSourceFiles(root: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(root)) {
		if (entry === '__tests__' || entry === 'node_modules' || entry === 'dist') continue;
		const full = join(root, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) listSourceFiles(full, acc);
		else if (entry.endsWith('.ts')) acc.push(full);
	}
	return acc;
}

async function main() {
	section('G13 census (mechanical, no dispatch)');
	const servicePath = resolve(SRC_ROOT, 'services/class-template.service.ts');
	const routerPath = resolve(SRC_ROOT, 'routes/class-template.router.ts');
	const serviceText = readFileSync(servicePath, 'utf8');
	const routerText = readFileSync(routerPath, 'utf8');
	const productionFiles = listSourceFiles(SRC_ROOT);

	const census = (needle: string) =>
		productionFiles
			.filter((file) => readFileSync(file, 'utf8').includes(needle))
			.map((file) => file.slice(SRC_ROOT.length + 1).replace(/\\/g, '/'));

	const ensureDefaultCallers = census('ensureDefaultTemplates(');
	check(
		ensureDefaultCallers.length === 1 && ensureDefaultCallers[0] === 'services/class-template.service.ts',
		`G13 ensureDefaultTemplates has no production caller outside the service (found: ${ensureDefaultCallers.join(', ') || 'none'})`,
	);
	const initializeSpanStart = serviceText.indexOf('export async function initializeDefaultTemplatesForSchool(');
	const initializeSpanEnd = serviceText.indexOf('\nexport ', initializeSpanStart + 1);
	const initializeSpan = serviceText.slice(initializeSpanStart, initializeSpanEnd < 0 ? undefined : initializeSpanEnd);
	check(
		initializeSpan.includes('await ensureDefaultTemplates(schoolId, tx)'),
		'G13 initializeDefaultTemplatesForSchool is the caller of ensureDefaultTemplates (transaction-bound)',
	);
	const ensureProgramTypeCallers = census('ensureTemplatesForProgramTypes(');
	check(
		ensureProgramTypeCallers.length === 1 && ensureProgramTypeCallers[0] === 'services/class-template.service.ts',
		`G13 ensureTemplatesForProgramTypes has zero production callers, export retained (found: ${ensureProgramTypeCallers.join(', ') || 'none'})`,
	);
	const forbiddenDefaults = ['?? 1', '|| 1', 'DEFAULT_SCHOOL_ID'];
	for (const needle of forbiddenDefaults) {
		check(!routerText.includes(needle), `G13 router contains no "${needle}"`);
		check(!serviceText.includes(needle), `G13 service contains no "${needle}"`);
	}
	// Both GET handlers (from the first GET registration to the initialize command)
	// must contain no write token.
	const getSpanStart = routerText.indexOf("router.get('/'");
	const getSpanEnd = routerText.indexOf("router.post('/initialize'");
	const getSpan = routerText.slice(getSpanStart, getSpanEnd);
	const writeTokens = [
		'ensureDefaultTemplates',
		'createTemplate',
		'updateTemplate',
		'updateTemplateForSchool',
		'setTemplateSubjects',
		'initializeDefaultTemplatesForSchool',
		'.$transaction',
		'.create(',
		'.update(',
		'.delete',
	];
	for (const token of writeTokens) {
		check(!getSpan.includes(token), `G13 GET handlers contain no write token "${token}"`);
	}
	check(
		routerText.includes("import { authenticate } from '../middleware/authenticate.js';")
			&& !routerText.includes('authenticateWithSystemToken'),
		'G13 router uses `authenticate` and never `authenticateWithSystemToken`',
	);

	section('Absent-database mount (zero-dispatch control)');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];

	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	const configuredUrl = pick('DATABASE_URL');
	if (!configuredUrl || !configuredUrl.startsWith('postgres')) {
		console.error('[BLOCKED] no configured PostgreSQL DATABASE_URL is resolvable');
		process.exit(3);
	}
	const absentName = `atlas_c07_absent_${randomBytes(6).toString('hex')}`;
	const absentUrl = (() => {
		const copy = new URL(configuredUrl);
		copy.pathname = `/${absentName}`;
		return copy.toString();
	})();
	// The app (and its Prisma singleton) must bind to the absent database.
	process.env.DATABASE_URL = absentUrl;
	console.log(`[INFO] guard suite database target: ${absentName} (never created, URL never printed)`);

	const secret = process.env.JWT_SECRET;
	if (!secret) {
		console.error('[BLOCKED] JWT_SECRET is unavailable; cannot hand-sign guard JWTs');
		process.exit(3);
	}

	let app: any;
	try {
		app = (await import('../app.js')).default;
	} catch (error) {
		console.error('[BLOCKED] the real app could not be imported:', (error as Error)?.message);
		process.exit(3);
	}

	const server: any = await new Promise((resolveServer, rejectServer) => {
		const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
		listener.on('error', rejectServer);
	});
	const port = (server.address() as any).port as number;
	const baseUrl = `http://127.0.0.1:${port}`;

	const sign = (payload: Record<string, unknown>): string => (jwt as any).sign(payload, secret, { expiresIn: '5m' });
	const officer = (schoolId?: number) => sign({ userId: 9201, role: 'officer', authSource: 'local', ...(schoolId === undefined ? {} : { schoolId }) });
	const faculty = (schoolId: number) => sign({ userId: 9202, role: 'faculty', authSource: 'local', schoolId });
	const systemToken = process.env.ATLAS_SYSTEM_TOKEN;

	type Row = {
		gate: string;
		label: string;
		method: string;
		path: string;
		token?: string | null;
		body?: unknown;
		status: number;
		code: string;
	};

	const rows: Row[] = [
		{ gate: 'G01', label: 'unauthenticated GET /', method: 'GET', path: '/api/v1/class-templates?schoolId=1', status: 401, code: 'NO_TOKEN' },
		{ gate: 'G02', label: 'unauthenticated GET /:id', method: 'GET', path: '/api/v1/class-templates/999999', status: 401, code: 'NO_TOKEN' },
		{ gate: 'G03', label: 'malformed token GET /', method: 'GET', path: '/api/v1/class-templates?schoolId=1', token: 'not-a-valid-jwt', status: 401, code: 'INVALID_TOKEN' },
		{ gate: 'G03', label: 'malformed token GET /:id', method: 'GET', path: '/api/v1/class-templates/999999', token: 'not-a-valid-jwt', status: 401, code: 'INVALID_TOKEN' },
		{ gate: 'G03', label: 'faculty role GET /', method: 'GET', path: '/api/v1/class-templates?schoolId=1', token: faculty(1), status: 403, code: 'FORBIDDEN' },
		{ gate: 'G03', label: 'faculty role GET /:id', method: 'GET', path: '/api/v1/class-templates/999999', token: faculty(1), status: 403, code: 'FORBIDDEN' },
		{ gate: 'G03', label: 'faculty role POST /initialize', method: 'POST', path: '/api/v1/class-templates/initialize', token: faculty(1), body: {}, status: 403, code: 'FORBIDDEN' },
		{ gate: 'G04', label: 'missing actor school GET /', method: 'GET', path: '/api/v1/class-templates?schoolId=1', token: officer(), status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G04', label: 'missing actor school GET /:id', method: 'GET', path: '/api/v1/class-templates/999999', token: officer(), status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G04', label: 'missing actor school POST /initialize', method: 'POST', path: '/api/v1/class-templates/initialize', token: officer(), body: {}, status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G04', label: 'missing actor school POST /', method: 'POST', path: '/api/v1/class-templates', token: officer(), body: { name: 'n', label: 'l', programType: 'OTHER', gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8 }, status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G04', label: 'missing actor school PATCH /:id', method: 'PATCH', path: '/api/v1/class-templates/999999', token: officer(), body: { name: 'n' }, status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G04', label: 'missing actor school PUT /:id/subjects', method: 'PUT', path: '/api/v1/class-templates/999999/subjects', token: officer(), body: { subjectIds: [1] }, status: 403, code: 'ACTOR_SCHOOL_REQUIRED' },
		{ gate: 'G05', label: 'cross-school collection GET (schoolId != actor)', method: 'GET', path: '/api/v1/class-templates?schoolId=2', token: officer(1), status: 403, code: 'CROSS_SCHOOL_DENIED' },
		{ gate: 'G05', label: 'malformed schoolId wins over actor', method: 'GET', path: '/api/v1/class-templates?schoolId=0', token: officer(1), status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G05', label: 'malformed schoolId (non-numeric)', method: 'GET', path: '/api/v1/class-templates?schoolId=abc', token: officer(1), status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G05', label: 'malformed id GET /:id', method: 'GET', path: '/api/v1/class-templates/abc', token: officer(1), status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G05', label: 'malformed id PATCH /:id', method: 'PATCH', path: '/api/v1/class-templates/abc', token: officer(1), body: { name: 'n' }, status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G05', label: 'malformed id PUT /:id/subjects', method: 'PUT', path: '/api/v1/class-templates/abc/subjects', token: officer(1), body: { subjectIds: [1] }, status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G11', label: 'foreign body school POST /initialize', method: 'POST', path: '/api/v1/class-templates/initialize', token: officer(1), body: { schoolId: 2 }, status: 403, code: 'CROSS_SCHOOL_DENIED' },
		{ gate: 'G11', label: 'malformed body school POST /initialize', method: 'POST', path: '/api/v1/class-templates/initialize', token: officer(1), body: { schoolId: -3 }, status: 400, code: 'INVALID_PARAM' },
		{ gate: 'G12', label: 'foreign body school POST /', method: 'POST', path: '/api/v1/class-templates', token: officer(1), body: { schoolId: 2, name: 'n', label: 'l', programType: 'OTHER', gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8 }, status: 403, code: 'CROSS_SCHOOL_DENIED' },
		{ gate: 'G03', label: 'system token is never accepted on this router', method: 'GET', path: '/api/v1/class-templates?schoolId=1', token: systemToken ?? 'no-system-token', status: 401, code: 'INVALID_TOKEN' },
	];

	try {
		for (const row of rows) {
			const res = await fetch(baseUrl + row.path, {
				method: row.method,
				headers: {
					...(row.token ? { Authorization: `Bearer ${row.token}` } : {}),
					...(row.body === undefined ? {} : { 'Content-Type': 'application/json' }),
				},
				body: row.body === undefined ? undefined : JSON.stringify(row.body),
			});
			const text = await res.text();
			let json: any = {};
			try {
				json = text ? JSON.parse(text) : {};
			} catch {
				json = { raw: text };
			}
			check(res.status === row.status, `${row.gate} ${row.label} -> ${res.status} (expected ${row.status})`);
			check(json.code === row.code, `${row.gate} ${row.label} -> code ${json.code} (expected ${row.code})`);
			check(res.status !== 500, `${row.gate} ${row.label} never 500 (pre-guard dispatch control)`);
			check(res.status !== 200 && res.status !== 201, `${row.gate} ${row.label} never 200/201`);
			check(
				!Object.prototype.hasOwnProperty.call(json, 'templates') && !Object.prototype.hasOwnProperty.call(json, 'template'),
				`${row.gate} ${row.label} response carries no template payload`,
			);
		}
		// A raw ABSENT database must be genuinely unreachable: prove the control is
		// load-bearing by showing the absent target fails a real read.
		const { PrismaClient } = await import('@prisma/client');
		const probe = new PrismaClient({ datasourceUrl: absentUrl });
		let absentReachable = false;
		try {
			await probe.school.count();
			absentReachable = true;
		} catch {
			absentReachable = false;
		} finally {
			await probe.$disconnect().catch(() => undefined);
		}
		check(!absentReachable, 'the absent-database control is load-bearing (a real query against it fails, so any pre-guard dispatch would have produced 500)');
	} finally {
		await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
	}

	console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
