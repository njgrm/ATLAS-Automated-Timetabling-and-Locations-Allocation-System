/**
 * AUTHZ-CLASS-TEMPLATE-C07 — mounted actor-school authority suite (G06..G12, G18; NC3/NC4 target).
 *
 * Runs the REAL Express app and the REAL service layer over a GUARDED
 * DISPOSABLE PostgreSQL database created by `provisionDisposableDatabase('c07')`
 * and dropped with a zero-residue assertion in `finally`. The configured source
 * database is probed read-only; it is never written.
 *
 * Fixture schools (disposable only):
 *   A — read rows (template-less at G07 time)
 *   B — initialize rows (no templates until the command runs)
 *   C — item/mutation rows (one pre-created template, zero subject bindings)
 *
 * The helper import MUST precede the dynamic `../app.js` import so the Prisma
 * singleton binds to the disposable database.
 *
 * Run: `npx tsx src/__tests__/class-template-authority-c07.test.ts` (from `atlas-server`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { provisionDisposableDatabase } from './helpers/tt-source-freshness-db.js';

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

function checkEqual(actual: unknown, expected: unknown, label: string) {
	check(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

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

async function main() {
	section('G18 setup. guarded disposable database');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];
	const configuredSourceUrl = pick('DATABASE_URL');

	const disposable = provisionDisposableDatabase('c07');
	if (!disposable) {
		console.error('EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)');
		process.exit(3);
	}
	// MUST precede the first import of ../app.js / ../lib/prisma.js.
	process.env.DATABASE_URL = disposable.targetUrl;
	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	const secret = process.env.JWT_SECRET;
	if (!secret) {
		console.error('EXTERNALLY_BLOCKED(JWT_SECRET_UNAVAILABLE)');
		disposable.drop();
		disposable.assertDropped();
		process.exit(3);
	}
	console.log(`[INFO] disposable database ready: ${disposable.name}`);

	const { default: app } = await import('../app.js');
	const { createTestPrismaClient } = await import('../lib/prisma.js');
	const prisma: any = createTestPrismaClient();
	const jwt = await import('jsonwebtoken');

	const FIXTURE_NAME = `AUTHZ-CLASS-TEMPLATE-C07 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	const ACTOR = { a: 9411, b: 9412, c: 9413 };
	const schoolIds: number[] = [];
	let server: any = null;

	const sign = (payload: Record<string, unknown>): string =>
		(jwt.default as any).sign(payload, secret, { expiresIn: '10m' });
	const officer = (schoolId: number, userId: number) => sign({ userId, role: 'officer', authSource: 'local', schoolId });

	let schoolA = 0;
	let schoolB = 0;
	let schoolC = 0;
	let templateC = 0;
	let subjectC1 = 0;
	let subjectC2 = 0;
	let subjectA = 0;

	try {
		section('F0. disposable fixture (three schools; C owns one template)');
		const a = await prisma.school.create({ data: { name: `${FIXTURE_NAME} A`, shortName: 'C07A' }, select: { id: true } });
		schoolA = a.id as number;
		const b = await prisma.school.create({ data: { name: `${FIXTURE_NAME} B`, shortName: 'C07B' }, select: { id: true } });
		schoolB = b.id as number;
		const c = await prisma.school.create({ data: { name: `${FIXTURE_NAME} C`, shortName: 'C07C' }, select: { id: true } });
		schoolC = c.id as number;
		schoolIds.push(schoolA, schoolB, schoolC);
		check(schoolA > 0 && schoolB > 0 && schoolC > 0, `fixture schools created (A=${schoolA} B=${schoolB} C=${schoolC})`);

		const s1 = await prisma.subject.create({
			data: { schoolId: schoolC, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, programScopes: ['REGULAR'], gradeLevels: [7], preferredRoomType: 'CLASSROOM', isActive: true },
			select: { id: true },
		});
		subjectC1 = s1.id as number;
		const s2 = await prisma.subject.create({
			data: { schoolId: schoolC, code: 'ENG', name: 'English', minMinutesPerWeek: 180, programScopes: ['REGULAR'], gradeLevels: [7], preferredRoomType: 'CLASSROOM', isActive: true },
			select: { id: true },
		});
		subjectC2 = s2.id as number;
		// A subject owned by ANOTHER school (school A). School A stays template-less,
		// so the G07 row is unaffected; this subject must never become bindable from
		// school C's templates.
		const foreign = await prisma.subject.create({
			data: { schoolId: schoolA, code: 'A_FOREIGN_MATH', name: 'A Foreign Mathematics', minMinutesPerWeek: 240, programScopes: ['REGULAR'], gradeLevels: [7], preferredRoomType: 'CLASSROOM', isActive: true },
			select: { id: true },
		});
		subjectA = foreign.id as number;
		const preCreated = await prisma.classTemplate.create({
			data: {
				schoolId: schoolC,
				name: 'C07 Precreated',
				label: 'C07 Precreated',
				programType: 'REGULAR',
				gradeApplicability: [7],
				periodLengthMinutes: 60,
				periodsPerDay: 8,
				isActive: true,
				isDefault: false,
			},
			select: { id: true },
		});
		templateC = preCreated.id as number;
		check(templateC > 0, `school C pre-created template (id=${templateC}) with zero subject bindings`);

		server = await new Promise<any>((resolveServer, rejectServer) => {
			const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
			listener.on('error', rejectServer);
		});
		const port = (server.address() as any).port as number;
		const baseUrl = `http://127.0.0.1:${port}`;

		async function call(method: string, path: string, token: string | null, body?: unknown) {
			const res = await fetch(baseUrl + path, {
				method,
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			});
			const text = await res.text();
			let json: any = {};
			try {
				json = text ? JSON.parse(text) : {};
			} catch {
				json = { raw: text };
			}
			return { status: res.status, json, text };
		}

		const fixtureCounts = async () => ({
			templates: await prisma.classTemplate.count({ where: { schoolId: { in: schoolIds } } }),
			bindings: await prisma.classTemplateSubject.count({ where: { template: { schoolId: { in: schoolIds } } } }),
			audits: await prisma.auditLog.count({ where: { schoolId: { in: schoolIds } } }),
		});

		const tokenA = officer(schoolA, ACTOR.a);
		const tokenB = officer(schoolB, ACTOR.b);
		const tokenC = officer(schoolC, ACTOR.c);

		section('G07. same-school collection GET on a template-less school writes nothing');
		const beforeG07 = await fixtureCounts();
		let res = await call('GET', `/api/v1/class-templates?schoolId=${schoolA}`, tokenA);
		checkEqual(res.status, 200, 'G07 same-school collection GET returns 200');
		check(Array.isArray(res.json.templates) && res.json.templates.length === 0, 'G07 template-less school returns templates: []');
		const afterG07 = await fixtureCounts();
		checkEqual(afterG07.templates, beforeG07.templates, 'G07 created zero classTemplate rows (write-on-read removed)');
		checkEqual(afterG07.audits, beforeG07.audits, 'G07 wrote zero audit rows');
		checkEqual(
			await prisma.classTemplate.count({ where: { schoolId: schoolA } }),
			0,
			'G07 school A still has zero classTemplate rows',
		);

		section('G08. same-school item GET and absent id');
		res = await call('GET', `/api/v1/class-templates/${templateC}`, tokenC);
		checkEqual(res.status, 200, 'G08 same-school item GET returns 200');
		checkEqual(res.json.template?.id, templateC, 'G08 same-school item GET returns the requested template');
		checkEqual(res.json.template?.schoolId, schoolC, 'G08 returned template belongs to the actor school');
		res = await call('GET', `/api/v1/class-templates/999999`, tokenC);
		checkEqual(res.status, 404, 'G08 absent id returns 404');
		checkEqual(res.json.code, 'NOT_FOUND', 'G08 absent id code NOT_FOUND');

		section('G06. cross-school item GET denies without payload');
		const beforeG06 = await fixtureCounts();
		res = await call('GET', `/api/v1/class-templates/${templateC}`, tokenA);
		checkEqual(res.status, 403, 'G06 foreign-owned item GET returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'G06 foreign-owned item GET code CROSS_SCHOOL_DENIED');
		check(!Object.prototype.hasOwnProperty.call(res.json, 'template'), 'G06 response has no `template` key');
		check(!res.text.includes('C07 Precreated'), 'G06 response leaks no foreign label/name data');
		const afterG06 = await fixtureCounts();
		checkEqual(JSON.stringify(afterG06), JSON.stringify(beforeG06), 'G06 cross-school item GET wrote zero rows');

		section('G09. POST /initialize creates the missing defaults + exactly one audit row');
		const beforeG09 = await fixtureCounts();
		res = await call('POST', '/api/v1/class-templates/initialize', tokenB, {});
		checkEqual(res.status, 200, 'G09 initialize returns 200');
		checkEqual(res.json.createdCount, 4, 'G09 createdCount = 4 (the four DEFAULT_TEMPLATE_SPECS)');
		check(
			Array.isArray(res.json.createdProgramTypes) && res.json.createdProgramTypes.length === 4,
			'G09 createdProgramTypes has four entries',
		);
		checkEqual(res.json.idempotent, false, 'G09 first invocation reports idempotent: false');
		check(Array.isArray(res.json.templates) && res.json.templates.length === 4, 'G09 response projects the four templates');
		const afterG09 = await fixtureCounts();
		checkEqual(afterG09.templates, beforeG09.templates + 4, 'G09 created exactly four classTemplate rows');
		checkEqual(afterG09.audits, beforeG09.audits + 1, 'G09 wrote exactly one audit row');
		const bTemplates = await prisma.classTemplate.findMany({ where: { schoolId: schoolB }, select: { id: true } });
		const bTemplateIds = (bTemplates as Array<{ id: number }>).map((t) => t.id).sort((x, y) => x - y);
		const audit1 = await prisma.auditLog.findFirst({
			where: { schoolId: schoolB, action: 'CLASS_TEMPLATE_INITIALIZE' },
			orderBy: { id: 'asc' },
		});
		check(audit1 !== null, 'G09 audit row exists');
		checkEqual(audit1?.schoolId, schoolB, 'G09 audit row schoolId = actor school');
		checkEqual(audit1?.schoolYearId, null, 'G09 audit row schoolYearId = null');
		checkEqual(audit1?.actorId, ACTOR.b, 'G09 audit row actorId = fixture actor');
		checkEqual(
			JSON.stringify([...(audit1?.targetIds ?? [])].sort((x: number, y: number) => x - y)),
			JSON.stringify(bTemplateIds),
			'G09 audit targetIds = the created template ids',
		);
		const meta1: any = audit1?.metadata ?? {};
		checkEqual(meta1.source, 'class-template.initialize', 'G09 audit metadata.source = class-template.initialize');
		checkEqual(meta1.createdCount, 4, 'G09 audit metadata.createdCount = 4');
		checkEqual(meta1.idempotent, false, 'G09 audit metadata.idempotent = false');
		check(
			JSON.stringify(meta1.createdProgramTypes) === JSON.stringify(['REGULAR', 'STE', 'SPA', 'SPS']),
			'G09 audit metadata.createdProgramTypes = the four default program types',
		);

		section('G10. POST /initialize replay is idempotent');
		const beforeG10 = await fixtureCounts();
		res = await call('POST', '/api/v1/class-templates/initialize', tokenB, {});
		checkEqual(res.status, 200, 'G10 replay returns 200');
		checkEqual(res.json.createdCount, 0, 'G10 replay createdCount = 0');
		checkEqual(res.json.idempotent, true, 'G10 replay idempotent = true');
		const afterG10 = await fixtureCounts();
		checkEqual(afterG10.templates, beforeG10.templates, 'G10 replay created zero classTemplate rows');
		checkEqual(afterG10.audits, beforeG10.audits + 1, 'G10 replay still wrote exactly one audit row');
		const audit2 = await prisma.auditLog.findFirst({
			where: { schoolId: schoolB, action: 'CLASS_TEMPLATE_INITIALIZE' },
			orderBy: { id: 'desc' },
		});
		checkEqual(audit2?.actorId, ACTOR.b, 'G10 replay audit row actorId = fixture actor');
		check(Array.isArray(audit2?.targetIds) && audit2?.targetIds.length === 0, 'G10 replay audit targetIds is empty');
		checkEqual((audit2?.metadata as any)?.idempotent, true, 'G10 replay audit metadata.idempotent = true');

		section('G11. POST /initialize foreign body school is rejected with zero writes');
		const beforeG11 = await fixtureCounts();
		res = await call('POST', '/api/v1/class-templates/initialize', tokenB, { schoolId: schoolA });
		checkEqual(res.status, 403, 'G11 foreign body school returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'G11 foreign body school code CROSS_SCHOOL_DENIED');
		const afterG11 = await fixtureCounts();
		checkEqual(JSON.stringify(afterG11), JSON.stringify(beforeG11), 'G11 wrote zero template/audit rows');
		checkEqual(
			await prisma.classTemplate.count({ where: { schoolId: schoolA } }),
			0,
			'G11 requested school A still has zero templates',
		);

		section('G12. mutation binding');
		// foreign body school on POST /
		let before = await fixtureCounts();
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			schoolId: schoolA, name: 'Hijack', label: 'Hijack', programType: 'OTHER',
			gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8,
		});
		checkEqual(res.status, 403, 'G12 POST / foreign body school returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'G12 POST / foreign body school code CROSS_SCHOOL_DENIED');
		let after = await fixtureCounts();
		checkEqual(after.templates, before.templates, 'G12 POST / foreign body school wrote zero templates');
		checkEqual(await prisma.classTemplate.count({ where: { schoolId: schoolA } }), 0, 'G12 requested school A has zero templates');

		// foreign template on PATCH /:id
		before = await fixtureCounts();
		res = await call('PATCH', `/api/v1/class-templates/${templateC}`, tokenA, { name: 'Hijacked' });
		checkEqual(res.status, 403, 'G12 PATCH /:id foreign template returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'G12 PATCH /:id foreign template code CROSS_SCHOOL_DENIED');
		check(!Object.prototype.hasOwnProperty.call(res.json, 'template'), 'G12 PATCH rejection carries no template payload');
		const foreignRow = await prisma.classTemplate.findUnique({ where: { id: templateC }, select: { name: true, schoolId: true } });
		checkEqual(foreignRow?.name, 'C07 Precreated', 'G12 foreign PATCH left the foreign row unchanged');
		checkEqual(foreignRow?.schoolId, schoolC, 'G12 foreign row still belongs to school C');
		after = await fixtureCounts();
		checkEqual(JSON.stringify(after), JSON.stringify(before), 'G12 foreign PATCH wrote zero rows');

		// foreign template on PUT /:id/subjects
		before = await fixtureCounts();
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenA, { subjectIds: [subjectC1] });
		checkEqual(res.status, 403, 'G12 PUT /:id/subjects foreign template returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'G12 PUT /:id/subjects foreign template code CROSS_SCHOOL_DENIED');
		after = await fixtureCounts();
		checkEqual(after.bindings, before.bindings, 'G12 foreign PUT touched zero classTemplateSubject rows');
		checkEqual(after.templates, before.templates, 'G12 foreign PUT wrote zero templates');
		checkEqual(
			await prisma.classTemplateSubject.count({ where: { templateId: templateC } }),
			0,
			'G12 foreign template still has zero subject bindings',
		);

		// absent ids
		before = await fixtureCounts();
		res = await call('PATCH', `/api/v1/class-templates/999999`, tokenC, { name: 'Nope' });
		checkEqual(res.status, 404, 'G12 PATCH absent id returns 404');
		checkEqual(res.json.code, 'NOT_FOUND', 'G12 PATCH absent id code NOT_FOUND');
		res = await call('PUT', `/api/v1/class-templates/999999/subjects`, tokenC, { subjectIds: [subjectC1] });
		checkEqual(res.status, 404, 'G12 PUT absent id returns 404');
		checkEqual(res.json.code, 'NOT_FOUND', 'G12 PUT absent id code NOT_FOUND');
		after = await fixtureCounts();
		checkEqual(JSON.stringify(after), JSON.stringify(before), 'G12 absent-id rejects wrote zero rows');

		// positive same-school PATCH
		res = await call('PATCH', `/api/v1/class-templates/${templateC}`, tokenC, { name: 'C07 Renamed', periodsPerDay: 9 });
		checkEqual(res.status, 200, 'G12 positive same-school PATCH returns 200');
		checkEqual(res.json.template?.name, 'C07 Renamed', 'G12 positive PATCH applied the intended change');
		checkEqual(res.json.template?.periodsPerDay, 9, 'G12 positive PATCH applied the period change');

		// positive same-school PUT
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [subjectC1, subjectC2] });
		checkEqual(res.status, 200, 'G12 positive same-school PUT returns 200');
		checkEqual(res.json.template?.subjects?.length, 2, 'G12 positive PUT applied the two-subject bundle');
		checkEqual(
			await prisma.classTemplateSubject.count({ where: { templateId: templateC } }),
			2,
			'G12 positive PUT created exactly two bindings',
		);

		// positive same-school POST / with no body schoolId (actor school used)
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			name: 'C07 Other', label: 'OTHER', programType: 'OTHER',
			gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8,
		});
		checkEqual(res.status, 201, 'G12 positive same-school POST / (no body schoolId) returns 201');
		checkEqual(res.json.template?.schoolId, schoolC, 'G12 positive POST bound the template to the actor school');

		// typed 409 duplicate preserved
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			name: 'C07 Other 2', label: 'OTHER', programType: 'OTHER',
			gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8,
		});
		checkEqual(res.status, 409, 'G12 duplicate program type still returns 409');
		checkEqual(res.json.code, 'DUPLICATE', 'G12 duplicate code DUPLICATE');

		// typed 400s preserved
		res = await call('PATCH', `/api/v1/class-templates/${templateC}`, tokenC, { periodLengthMinutes: 0 });
		checkEqual(res.status, 400, 'G12 invalid periodLengthMinutes still returns 400');
		checkEqual(res.json.code, 'INVALID_PERIOD_LENGTH', 'G12 invalid periodLength code INVALID_PERIOD_LENGTH');
		res = await call('PATCH', `/api/v1/class-templates/${templateC}`, tokenC, { periodsPerDay: -1 });
		checkEqual(res.status, 400, 'G12 invalid periodsPerDay still returns 400');
		checkEqual(res.json.code, 'INVALID_PERIODS_PER_DAY', 'G12 invalid periodsPerDay code INVALID_PERIODS_PER_DAY');
		res = await call('POST', '/api/v1/class-templates', tokenC, { name: 'x' });
		checkEqual(res.status, 400, 'G12 missing fields still returns 400');
		checkEqual(res.json.code, 'MISSING_FIELDS', 'G12 missing fields code MISSING_FIELDS');
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [] });
		checkEqual(res.status, 400, 'G12 empty subjectIds still returns 400');
		checkEqual(res.json.code, 'MISSING_FIELDS', 'G12 empty subjectIds code MISSING_FIELDS');

		section('R2. subject-bundle tenant binding (CROSS_SCHOOL_DENIED / INVALID_PARAM)');
		const bindingsForTemplate = () => prisma.classTemplateSubject.count({ where: { templateId: templateC } });
		const bindingsAnywhere = () => prisma.classTemplateSubject.count({ where: { subjectId: subjectA } });

		// 1. foreign subject on PUT /:id/subjects
		let r2Before = await fixtureCounts();
		let r2BindingsBefore = await bindingsForTemplate();
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [subjectC1, subjectA] });
		checkEqual(res.status, 403, 'R2 PUT /:id/subjects foreign subject returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'R2 PUT foreign subject code CROSS_SCHOOL_DENIED');
		checkEqual(await bindingsForTemplate(), r2BindingsBefore, 'R2 PUT foreign subject touched zero classTemplateSubject rows');
		let r2After = await fixtureCounts();
		checkEqual(JSON.stringify(r2After), JSON.stringify(r2Before), 'R2 PUT foreign subject wrote zero fixture rows');
		checkEqual(await bindingsAnywhere(), 0, 'R2 foreign subject is never bound anywhere');

		// 2. foreign subject on POST /
		r2Before = await fixtureCounts();
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			name: 'C07 Cross', label: 'CROSS', programType: 'SPA',
			gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8, subjectIds: [subjectC1, subjectA],
		});
		checkEqual(res.status, 403, 'R2 POST / foreign subject returns 403');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'R2 POST foreign subject code CROSS_SCHOOL_DENIED');
		check(!Object.prototype.hasOwnProperty.call(res.json, 'template'), 'R2 POST foreign subject carries no template payload');
		r2After = await fixtureCounts();
		checkEqual(JSON.stringify(r2After), JSON.stringify(r2Before), 'R2 POST foreign subject wrote zero templates/bindings');
		checkEqual(await bindingsAnywhere(), 0, 'R2 POST foreign subject is still never bound');

		// 3. unknown subject id (does not exist at all)
		r2Before = await fixtureCounts();
		r2BindingsBefore = await bindingsForTemplate();
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [subjectC1, 987654321] });
		checkEqual(res.status, 400, 'R2 PUT /:id/subjects unknown subject returns 400');
		checkEqual(res.json.code, 'INVALID_PARAM', 'R2 PUT unknown subject code INVALID_PARAM');
		checkEqual(await bindingsForTemplate(), r2BindingsBefore, 'R2 PUT unknown subject touched zero bindings');
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			name: 'C07 Unknown', label: 'UNKNOWN', programType: 'SPS',
			gradeApplicability: [7], periodLengthMinutes: 60, periodsPerDay: 8, subjectIds: [987654321],
		});
		checkEqual(res.status, 400, 'R2 POST / unknown subject returns 400');
		checkEqual(res.json.code, 'INVALID_PARAM', 'R2 POST unknown subject code INVALID_PARAM');
		r2After = await fixtureCounts();
		checkEqual(JSON.stringify(r2After), JSON.stringify(r2Before), 'R2 unknown-subject rejects wrote zero rows');

		// 4. mixed foreign + unknown prefers the typed 403
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [subjectA, 987654321] });
		checkEqual(res.status, 403, 'R2 mixed foreign+unknown returns 403 (foreign wins)');
		checkEqual(res.json.code, 'CROSS_SCHOOL_DENIED', 'R2 mixed foreign+unknown code CROSS_SCHOOL_DENIED');
		checkEqual(await bindingsForTemplate(), r2BindingsBefore, 'R2 mixed reject touched zero bindings');

		// 5. the actor's own read never discloses the foreign subject
		res = await call('GET', `/api/v1/class-templates?schoolId=${schoolC}`, tokenC);
		checkEqual(res.status, 200, 'R2 same-school collection GET still returns 200');
		check(!res.text.includes('A_FOREIGN_MATH') && !res.text.includes('A Foreign Mathematics'), 'R2 actor read never projects the foreign subject code/name');

		// 6. positive same-school rows still succeed
		res = await call('PUT', `/api/v1/class-templates/${templateC}/subjects`, tokenC, { subjectIds: [subjectC1] });
		checkEqual(res.status, 200, 'R2 positive same-school PUT still returns 200');
		checkEqual(await bindingsForTemplate(), 1, 'R2 positive same-school PUT bound exactly one subject');
		res = await call('POST', '/api/v1/class-templates', tokenC, {
			name: 'C07 Science', label: 'SPA', programType: 'SPA',
			gradeApplicability: [7], periodLengthMinutes: 45, periodsPerDay: 10, subjectIds: [subjectC2],
		});
		checkEqual(res.status, 201, 'R2 positive same-school POST with subjectIds returns 201');
		checkEqual(res.json.template?.subjects?.length, 1, 'R2 positive POST bound the same-school subject');
		checkEqual(res.json.template?.subjects?.[0]?.id, subjectC2, 'R2 positive POST bound exactly the requested same-school subject');
	} finally {
		section('G18. cleanup + zero residue');
		if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
		try {
			await prisma.classTemplateSubject.deleteMany({ where: { template: { schoolId: { in: schoolIds } } } });
			await prisma.auditLog.deleteMany({ where: { schoolId: { in: schoolIds } } });
			await prisma.classTemplate.deleteMany({ where: { schoolId: { in: schoolIds } } });
			await prisma.subject.deleteMany({ where: { schoolId: { in: schoolIds } } });
			await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
		} catch (error) {
			console.error('[WARN] fixture cleanup error:', (error as Error)?.message);
		}
		await prisma.$disconnect().catch(() => undefined);

		disposable.drop();
		disposable.assertDropped();
		check(true, `G18 disposable database ${disposable.name} dropped and asserted absent`);

		if (configuredSourceUrl && configuredSourceUrl.startsWith('postgres')) {
			const { PrismaClient } = await import('@prisma/client');
			const sourceProbe = new PrismaClient({ datasourceUrl: configuredSourceUrl });
			try {
				const fixtureSchoolsInSource = await (sourceProbe as any).school.count({
					where: { name: { startsWith: 'AUTHZ-CLASS-TEMPLATE-C07 FIXTURE' } },
				});
				checkEqual(fixtureSchoolsInSource, 0, 'G18 configured source database contains zero fixture schools (so zero fixture-keyed rows)');
			} catch (error) {
				console.error('[WARN] source-database read-only probe unavailable:', (error as Error)?.message);
				check(false, 'G18 configured source database was probed read-only');
			} finally {
				await sourceProbe.$disconnect().catch(() => undefined);
			}
		} else {
			console.error('[WARN] configured source URL unavailable; read-only source probe skipped');
			check(false, 'G18 configured source database was probed read-only');
		}
	}

	console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
