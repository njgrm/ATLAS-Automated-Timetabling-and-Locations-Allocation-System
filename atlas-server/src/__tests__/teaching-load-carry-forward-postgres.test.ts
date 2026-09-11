/**
 * TL-RR01 — Teaching Load carry-forward DISPOSABLE PostgreSQL suite.
 *
 * Creates a unique fixture school with one archived source year and one active
 * target year, exercises the REAL carry-forward service and the REAL mounted
 * router, and removes everything in `finally` with a zero-residue assertion.
 * A rolled-back positive control proves the write detector observes real writes.
 *
 * Requires a reachable database. Run with `npx tsx <this-file>`.
 */

import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import carryForwardRouter from '../routes/teaching-load-carry-forward.router.js';
import { withDataContext } from '../lib/data-context.js';
import {
	applyTeachingLoadCarryForward,
	previewTeachingLoadCarryForward,
	TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
} from '../services/teaching-load-carry-forward.service.js';

let passCount = 0;
let failCount = 0;

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
	assert(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function loadServerEnv() {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		const content = readFileSync(resolve(here, '../../.env'), 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {}
}

const WRITE_ACTIONS = new Set([
	'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
	'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
]);

const recorded: Array<{ model?: string; action: string }> = [];
function writes() {
	return recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
}
function resetRecording() {
	recorded.length = 0;
}

const ACTOR = 1;

async function main() {
	loadServerEnv();
	if (!process.env.DATABASE_URL) {
		console.warn('[SKIP] TL-RR01 carry-forward PostgreSQL suite requires DATABASE_URL.');
		console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
		process.exit(0);
	}
	await runFixtureTests();
	console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
	process.exit(failCount > 0 ? 1 : 0);
}

async function runFixtureTests() {
	const prismaModule = await import('../lib/prisma.js');
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
	const run = <T>(fn: () => Promise<T>): Promise<T> => withDataContext(instrumented, fn);

	const FIXTURE_NAME = `TL-RR01 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	let fixtureSchoolId = 0;
	const yearBase = 9000 + (Date.now() % 200);
	const sourceYearId = yearBase;
	const targetYearId = yearBase + 1;

	const stand = 1800;
	const cap = 2400;
	const mathMinutes = 240;
	const engMinutes = 240;

	const ids: Record<string, number> = {};
	const ownershipIds: Record<string, number> = {};

	async function withMountedRouter<T>(fn: (baseUrl: string, token: string) => Promise<T>): Promise<T> {
		const previousSecret = process.env.JWT_SECRET;
		process.env.JWT_SECRET = 'tl-rr01-hermetic-secret';
		let server: Server | undefined;
		try {
			return await withDataContext(instrumented, async () => {
				const app = express();
				app.use(express.json());
				app.use('/api/v1/teaching-load', carryForwardRouter);
				app.use((error: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
					res.status(error.statusCode ?? 500).json({ code: error.code ?? 'SERVER_ERROR', message: error.message });
				});
				server = createServer(app);
				await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
				const address = server.address();
				assert(Boolean(address) && typeof address !== 'string', 'mounted carry-forward router bound to an ephemeral TCP port');
				const token = jwt.sign({ userId: ACTOR, role: 'officer', authSource: 'local', schoolId: fixtureSchoolId }, process.env.JWT_SECRET!);
				return fn(`http://127.0.0.1:${(address as { port: number }).port}`, token);
			});
		} finally {
			if (server) await new Promise<void>((res, rej) => server!.close((error) => (error ? rej(error) : res())));
			if (previousSecret === undefined) delete process.env.JWT_SECRET;
			else process.env.JWT_SECRET = previousSecret;
		}
	}

	async function post(baseUrl: string, token: string | null, path: string, body: unknown) {
		return fetch(`${baseUrl}${path}`, {
			method: 'POST',
			headers: token
				? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
				: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
	}

	async function createSubject(code: string, extra: Record<string, unknown> = {}) {
		const row = await instrumented.subject.create({
			data: {
				schoolId: fixtureSchoolId,
				code,
				name: `${code} Subject`,
				minMinutesPerWeek: code === 'ENG' ? engMinutes : mathMinutes,
				gradeLevels: [7],
				programScopes: ['REGULAR'],
				ownerDepartment: code === 'ENG' ? 'ENG' : code === 'OBS' ? 'MATH' : 'MATH',
				isActive: code !== 'OBS',
				...extra,
			},
			select: { id: true },
		});
		return (row as any).id as number;
	}

	async function createSection(schoolYearId: number, externalId: number, name: string, programType = 'REGULAR', gradeLevelId = 7, displayOrder = 7) {
		const row = await instrumented.sectionMirror.create({
			data: {
				schoolId: fixtureSchoolId,
				schoolYearId,
				externalId,
				name,
				// gradeLevelId is the authoritative grade; displayOrder is deliberately
				// set independently to prove it is never used as grade truth.
				gradeLevelId,
				gradeLevelName: 'Grade 7',
				displayOrder,
				maxCapacity: 50,
				enrolledCount: 45,
				programType,
				isActiveForScheduling: true,
				isStale: false,
			},
			select: { id: true },
		});
		return (row as any).id as number;
	}

	async function createFaculty(employeeId: string, externalId: number, department: string, extra: Record<string, unknown> = {}) {
		const row = await instrumented.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId, employeeId, firstName: 'Test', lastName: employeeId, department, isActiveForScheduling: true, ...extra },
			select: { id: true },
		});
		return (row as any).id as number;
	}

	async function createFacultySubject(schoolYearId: number, facultyId: number, subjectId: number, sectionIds: number[]) {
		const row = await instrumented.facultySubject.create({
			data: { schoolId: fixtureSchoolId, schoolYearId, facultyId, subjectId, sectionIds, gradeLevels: [7], assignedBy: ACTOR },
			select: { id: true },
		});
		return (row as any).id as number;
	}

	async function createOwnership(schoolYearId: number, subjectId: number, sectionId: number, facultyId: number, facultySubjectId: number) {
		const row = await instrumented.subjectSectionOwnership.create({
			data: { schoolId: fixtureSchoolId, schoolYearId, subjectId, sectionId, facultyId, facultySubjectId, assignedAt: new Date() },
			select: { id: true },
		});
		return (row as any).id as number;
	}

	try {
		section('F1. fixture setup (disposable school/year, zero live impact)');
		const school = await instrumented.school.create({ data: { name: FIXTURE_NAME, shortName: 'RR01FX' }, select: { id: true } });
		fixtureSchoolId = (school as any).id as number;
		assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);

		await instrumented.schedulingPolicy.create({
			data: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, teachingStandardMinutes: stand, advisoryCreditMinutes: 300, hardCapMinutes: cap, periodLengthMinutes: 45 },
		});

		const termCache = {
			schoolId: fixtureSchoolId,
			schoolYear: { id: targetYearId },
			format: 'TRIMESTER',
			terms: [
				{ identity: 'T1', displayLabel: 'First Term', order: 1 },
				{ identity: 'T2', displayLabel: 'Second Term', order: 2 },
				{ identity: 'T3', displayLabel: 'Third Term', order: 3 },
			],
		};
		await instrumented.enrollProSchoolYearMirror.create({
			data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: sourceYearId, yearLabel: '2028-2029', isActive: false, isArchived: true, archivedAt: new Date(), archiveReason: 'fixture rollover', syncStatus: 'synced' },
		});
		await instrumented.enrollProSchoolYearMirror.create({
			data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: targetYearId, yearLabel: '2029-2030', isActive: true, isArchived: false, syncStatus: 'synced', termContractCache: termCache, termContractCachedAt: new Date() },
		});

		ids.math = await createSubject('MATH');
		ids.eng = await createSubject('ENG');
		ids.obs = await createSubject('OBS', { isActive: false });
		ids.hg = await createSubject('HG', { schedulingDisposition: 'REFERENCE_ONLY' });

		// Archived source sections (their own external ids). gradeLevelId 17 = Grade 7
		// via the EnrollPro normalization; displayOrder is set to a conflicting value
		// (9) so a displayOrder-as-grade implementation would fail to match.
		const sourceSectionNames: Array<[number, string]> = [
			[1101, 'Sampaguita'], [1102, 'Narra'], [1103, 'Rizal'], [1104, 'Mabini'], [1105, 'Bonifacio'],
			[1106, 'DelPilar'], [1107, 'Malvar'], [1108, 'Aguinaldo'], [1109, 'Aguinaldo'], [1110, 'Balintawak'],
			[1111, 'Luna'], [1112, 'Quezon'], [1113, 'Tandang Sora'],
		];
		for (const [externalId, name] of sourceSectionNames) await createSection(sourceYearId, externalId, name, 'REGULAR', 17, 9);

		// Active target sections. gradeLevelId 17 = Grade 7 with displayOrder 7.
		// Balintawak appears twice on purpose (canonical ambiguity).
		const targetSectionNames: Array<[number, string]> = [
			[2101, 'Sampaguita'], [2102, 'Narra'], [2103, 'Rizal'], [2104, 'Mabini'], [2105, 'Bonifacio'],
			[2106, 'DelPilar'], [2107, 'Aguinaldo'], [2108, 'Balintawak'], [2118, 'Balintawak'], [2109, 'Luna'],
			[2110, 'Quezon'], [2113, 'Tandang Sora'],
		];
		for (let i = 1; i <= 10; i += 1) targetSectionNames.push([2120 + i, `Cap Section ${i}`]);
		for (const [externalId, name] of targetSectionNames) await createSection(targetYearId, externalId, name, 'REGULAR', 17, 7);

		// Different actual grades sharing the same display order/name/program: the
		// target "Katipunan" is Grade 8 (gradeLevelId 18) while the source is Grade 7.
		// A displayOrder-as-grade matcher would wrongly match them; the authoritative
		// grade keeps them apart.
		await createSection(sourceYearId, 1114, 'Katipunan', 'REGULAR', 17, 7);
		await createSection(targetYearId, 2114, 'Katipunan', 'REGULAR', 18, 7);

		ids.fa = await createFaculty('RR1FA', 7001, 'MATH');
		ids.fb = await createFaculty('RR1FB', 7002, 'MATH');
		ids.fc = await createFaculty('RR1FC', 7003, 'MATH', { isActiveForScheduling: false });
		ids.fd = await createFaculty('RR1FD', 7004, 'ENG');
		ids.fe = await createFaculty('RR1FE', 7005, 'MATH');
		ids.fh = await createFaculty('RR1FH', 7006, 'MATH', { isStale: true, staleReason: 'fixture stale', staleAt: new Date() });

		// Archived source Teaching Load (immutable).
		const faMath = await createFacultySubject(sourceYearId, ids.fa, ids.math, [1101, 1107, 1108, 1109, 1110]);
		const fbMath = await createFacultySubject(sourceYearId, ids.fb, ids.math, [1102]);
		const fcMath = await createFacultySubject(sourceYearId, ids.fc, ids.math, [1103]);
		const fdMath = await createFacultySubject(sourceYearId, ids.fd, ids.math, [1104]);
		const feMath = await createFacultySubject(sourceYearId, ids.fe, ids.math, [1105]);
		const fhMath = await createFacultySubject(sourceYearId, ids.fh, ids.math, [1106]);
		const faHg = await createFacultySubject(sourceYearId, ids.fa, ids.hg, [1111]);
		const faObs = await createFacultySubject(sourceYearId, ids.fa, ids.obs, [1112]);
		const fdEng = await createFacultySubject(sourceYearId, ids.fd, ids.eng, [1113]);

		ownershipIds.source1 = await createOwnership(sourceYearId, ids.math, 1101, ids.fa, faMath);
		await createOwnership(sourceYearId, ids.math, 1102, ids.fb, fbMath);
		await createOwnership(sourceYearId, ids.math, 1103, ids.fc, fcMath);
		await createOwnership(sourceYearId, ids.math, 1104, ids.fd, fdMath);
		await createOwnership(sourceYearId, ids.math, 1105, ids.fe, feMath);
		await createOwnership(sourceYearId, ids.math, 1106, ids.fh, fhMath);
		await createOwnership(sourceYearId, ids.math, 1107, ids.fa, faMath);
		await createOwnership(sourceYearId, ids.math, 1108, ids.fa, faMath);
		await createOwnership(sourceYearId, ids.math, 1109, ids.fa, faMath);
		await createOwnership(sourceYearId, ids.math, 1110, ids.fa, faMath);
		await createOwnership(sourceYearId, ids.hg, 1111, ids.fa, faHg);
		await createOwnership(sourceYearId, ids.obs, 1112, ids.fa, faObs);
		await createOwnership(sourceYearId, ids.eng, 1113, ids.fd, fdEng);
		// Source Grade 7 Katipunan vs target Grade 8 Katipunan (same display order).
		await createOwnership(sourceYearId, ids.math, 1114, ids.fa, faMath);

		await instrumented.teachingLoadCycle.create({ data: { schoolId: fixtureSchoolId, schoolYearId: sourceYearId, state: 'POPULATED', version: 1 } });

		// Active target already-occupied + cap-loading ownership.
		ids.fbTargetFs = await createFacultySubject(targetYearId, ids.fb, ids.math, [2102]);
		await createOwnership(targetYearId, ids.math, 2102, ids.fb, ids.fbTargetFs);
		const capSections = Array.from({ length: 10 }, (_, i) => 2121 + i);
		ids.feTargetFs = await createFacultySubject(targetYearId, ids.fe, ids.math, capSections);
		for (const sectionId of capSections) await createOwnership(targetYearId, ids.math, sectionId, ids.fe, ids.feTargetFs);

		resetRecording();

		section('F2. rolled-back positive control proves the write detector');
		{
			resetRecording();
			let caught = false;
			try {
				await run(() => instrumented.$transaction(async (tx: any) => {
					await tx.facultyMirror.update({ where: { id: ids.fa }, data: { version: { increment: 1 } } });
					throw new Error('rr01 rolled back');
				}));
			} catch {
				caught = true;
			}
			assert(caught, 'positive control transaction rolled back');
			assert(writes().some((write) => write.model === 'FacultyMirror' && write.action === 'update'), 'write detector observed the rolled-back write');
			resetRecording();
		}

		section('F3. preview is zero-write and classifies every archived row');
		let preview = await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
		assertEqual(writes().length, 0, 'preview performed zero writes');
		assertEqual(preview.totalsSummary.sourceRows, 14, 'preview covered all 14 archived rows');
		// Archived source sections carry displayOrder=9 while the matching target
		// sections carry displayOrder=7. The two carries below resolve ONLY because
		// grade authority comes from gradeLevelId (17 -> Grade 7), not displayOrder.
		assertEqual(preview.totals.EXACT_CARRY, 2, 'two rows are exact carries despite independent displayOrder values');
		assertEqual(preview.totals.ALREADY_OCCUPIED, 1, 'one occupied target pair is preserved');
		assertEqual(preview.totals.MISSING_FACULTY, 2, 'inactive/stale faculty are typed missing');
		assertEqual(preview.totals.UNQUALIFIED, 1, 'a department-mismatched owner is typed unqualified');
		assertEqual(preview.totals.CAP_BLOCKED, 1, 'an over-cap carry is typed cap blocked');
		assertEqual(preview.totals.MISSING_SECTION, 2, 'same-display-order different-grade and no-target sections are typed missing');
		assertEqual(preview.totals.NO_CURRENT_DEMAND, 2, 'reference-only / inactive subjects are not demand');
		assertEqual(preview.totals.AMBIGUOUS, 3, 'duplicate canonical source rows and duplicate target sections are ambiguous');
		assertEqual(preview.totals.OTHER, 0, 'no rows fall through to other');
		assertEqual(JSON.stringify(preview.zeroWriteProof), JSON.stringify({ preview: true, writes: 0 }), 'preview reports zero writes');
		assert(typeof preview.fingerprint === 'string' && preview.fingerprint.length > 0, 'preview binds a fingerprint');
		assert(typeof preview.sourceRevision === 'string' && preview.sourceRevision.length > 0, 'preview binds the source revision');
		assert(typeof preview.targetRevision === 'string' && preview.targetRevision.length > 0, 'preview binds the target revision');
		assert(typeof preview.derivedDemandRevision === 'string' && preview.derivedDemandRevision.length > 0, 'preview binds the DERIVED_DEMAND_V2 revision');
		assert(preview.rows.every((row) => row.reason !== 'EXACT_CARRY' || row.action === 'CARRY'), 'exact carry rows are action CARRY');
		assert(preview.rows.every((row) => row.reason === 'EXACT_CARRY' || row.action === 'SKIP'), 'skipped rows are never labelled carried');
		assertEqual(preview.perDepartment.length > 0, true, 'preview carries a compact per-department review');
		assertEqual(preview.before.demandCount > 0, true, 'preview resolves current demand');

		section('F3b. unconfigured workload policy fails preview closed with zero writes');
		{
			const policyRow = await instrumented.schedulingPolicy.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId }, select: { id: true } });
			await instrumented.schedulingPolicy.delete({ where: { id: (policyRow as any).id } });
			resetRecording();
			let code: string | undefined;
			try {
				await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
			} catch (error) {
				code = (error as { code?: string })?.code;
			}
			assertEqual(code, 'WORKLOAD_POLICY_UNCONFIGURED', 'unconfigured policy blocks preview with a typed 409');
			assertEqual(writes().length, 0, 'unconfigured-policy preview performed zero writes');
			await instrumented.schedulingPolicy.create({ data: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, teachingStandardMinutes: stand, advisoryCreditMinutes: 300, hardCapMinutes: cap, periodLengthMinutes: 45 } });
			resetRecording();
			const recheck = await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
			assertEqual(recheck.totals.EXACT_CARRY, 2, 'preview resumes once the policy is configured again');
		}

		section('F4. mounted-route auth, role, strict-body and year validation (zero reads/writes)');
		{
			let noTokenStatus = 0;
			resetRecording();
			await withMountedRouter(async (baseUrl) => {
				const response = await post(baseUrl, null, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId });
				noTokenStatus = response.status;
			});
			assertEqual(noTokenStatus, 401, 'no bearer token returns 401');
			assertEqual(recorded.length, 0, 'rejected unauthenticated request performed zero data reads');

			const previousSecret = process.env.JWT_SECRET;
			process.env.JWT_SECRET = 'tl-rr01-hermetic-secret';
			const facultyToken = jwt.sign({ userId: 2, role: 'faculty', authSource: 'local', schoolId: fixtureSchoolId }, process.env.JWT_SECRET);
			let facultyStatus = 0;
			resetRecording();
			await withMountedRouter(async (baseUrl) => {
				const response = await post(baseUrl, facultyToken, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId });
				facultyStatus = response.status;
			});
			assertEqual(facultyStatus, 403, 'a non-privileged role returns 403');
			assertEqual(recorded.length, 0, 'role rejection performed zero data reads');
			if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;

			let unknownFieldStatus = 0;
			resetRecording();
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId, unexpected: true });
				unknownFieldStatus = response.status;
			});
			assertEqual(unknownFieldStatus, 400, 'an unknown body field returns 400');
			assertEqual(recorded.length, 0, 'strict-body rejection performed zero data reads and writes');

			let arrayBodyStatus = 0;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', [fixtureSchoolId]);
				arrayBodyStatus = response.status;
			});
			assertEqual(arrayBodyStatus, 400, 'a non-object body returns 400');

			let missingFieldStatus = 0;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId });
				missingFieldStatus = response.status;
			});
			assertEqual(missingFieldStatus, 400, 'a missing required field returns 400');

			resetRecording();
			let mismatchStatus = 0;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId + 12345, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId });
				mismatchStatus = response.status;
			});
			assertEqual(mismatchStatus, 403, 'a cross-school request returns 403');
			assertEqual(writes().length, 0, 'cross-school rejection performed zero writes');

			let routePreviewCarried = -1;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId });
				const body = await response.json();
				routePreviewCarried = body.totalsSummary?.carried ?? -1;
			});
			assertEqual(routePreviewCarried, 2, 'mounted preview route returns the two carries');

			let notArchivedStatus = 0;
			await withMountedRouter(async (baseUrl, token) => {
				const response = await post(baseUrl, token, '/api/v1/teaching-load/carry-forward/preview', { schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: targetYearId });
				notArchivedStatus = response.status;
			});
			assertEqual(notArchivedStatus, 409, 'a same/active source year is rejected with 409');
		}

		section('F4b. apply requires a strict positive authenticated userId (403, zero reads/writes)');
		{
			const previousSecret = process.env.JWT_SECRET;
			process.env.JWT_SECRET = 'tl-rr01-hermetic-secret';
			const badActorIds: Array<[string, unknown]> = [
				['missing', undefined],
				['zero', 0],
				['negative', -1],
				['fractional', 1.5],
				['wrong-type', 'abc'],
			];
			for (const [label, userId] of badActorIds) {
				const payload: Record<string, unknown> = { role: 'officer', authSource: 'local', schoolId: fixtureSchoolId };
				if (userId !== undefined) payload.userId = userId;
				const badToken = jwt.sign(payload, process.env.JWT_SECRET);
				let status = 0;
				let body: any = null;
				resetRecording();
				await withMountedRouter(async (baseUrl) => {
					const response = await post(baseUrl, badToken, '/api/v1/teaching-load/carry-forward/apply', {
						schoolId: fixtureSchoolId, targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
						expectedFingerprint: 'x', expectedSourceRevision: 'y', expectedTargetRevision: 'z', confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
					});
					status = response.status;
					body = await response.json();
				});
				assertEqual(status, 403, `apply with ${label} userId returns 403`);
				assertEqual(body?.code, 'ACTOR_USER_REQUIRED', `apply with ${label} userId returns ACTOR_USER_REQUIRED`);
				assertEqual(recorded.length, 0, `apply with ${label} userId performed zero data reads`);
			}
			if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;

			// Direct service invocation also fails closed before any read.
			resetRecording();
			let serviceCode: string | undefined;
			try {
				await run(() => applyTeachingLoadCarryForward({
					actorSchoolId: fixtureSchoolId, actorId: 0, schoolId: fixtureSchoolId,
					targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
					expectedFingerprint: 'x', expectedSourceRevision: 'y', expectedTargetRevision: 'z',
					confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
				}));
			} catch (error) {
				serviceCode = (error as { code?: string })?.code;
			}
			assertEqual(serviceCode, 'ACTOR_USER_REQUIRED', 'direct apply with actorId 0 returns ACTOR_USER_REQUIRED');
			assertEqual(recorded.length, 0, 'direct actorId-0 rejection performed zero data reads');
		}

		section('F4c. apply revalidates the workload policy inside the Serializable transaction');
		{
			preview = await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
			const policyRow = await instrumented.schedulingPolicy.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId }, select: { id: true } });
			await instrumented.schedulingPolicy.delete({ where: { id: (policyRow as any).id } });
			resetRecording();
			let code: string | undefined;
			try {
				await run(() => applyTeachingLoadCarryForward({
					actorSchoolId: fixtureSchoolId, actorId: ACTOR, schoolId: fixtureSchoolId,
					targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
					expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision, expectedTargetRevision: preview.targetRevision,
					confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
				}));
			} catch (error) {
				code = (error as { code?: string })?.code;
			}
			assertEqual(code, 'WORKLOAD_POLICY_UNCONFIGURED', 'policy removed after preview aborts apply with the typed blocker');
			assertEqual(writes().length, 0, 'policy-revalidation abort performed zero writes');
			await instrumented.schedulingPolicy.create({ data: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, teachingStandardMinutes: stand, advisoryCreditMinutes: 300, hardCapMinutes: cap, periodLengthMinutes: 45 } });
			resetRecording();
		}

		section('F5. stale target revision aborts with zero writes');
		{
			preview = await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
			const injected = await createOwnership(targetYearId, ids.math, 2107, ids.fb, ids.fbTargetFs);
			resetRecording();
			let code: string | undefined;
			try {
				await run(() => applyTeachingLoadCarryForward({
					actorSchoolId: fixtureSchoolId,
					actorId: ACTOR,
					schoolId: fixtureSchoolId,
					targetSchoolYearId: targetYearId,
					sourceSchoolYearId: sourceYearId,
					expectedFingerprint: preview.fingerprint,
					expectedSourceRevision: preview.sourceRevision,
					expectedTargetRevision: preview.targetRevision,
					confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
				}));
			} catch (error) {
				code = (error as { code?: string })?.code;
			}
			assert(code === 'TARGET_DRIFT' || code === 'FINGERPRINT_MISMATCH', `stale target aborts (code=${code})`);
			assertEqual(writes().length, 0, 'stale-target abort performed zero writes');
			await instrumented.subjectSectionOwnership.delete({ where: { id: injected } });
			resetRecording();
		}

		section('F6. concurrent apply creates exactly the carried pairs (no duplicates)');
		{
			preview = await run(() => previewTeachingLoadCarryForward(fixtureSchoolId, targetYearId, sourceYearId, fixtureSchoolId));
			const beforeCount = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId } });
			const settled = await Promise.allSettled([
				run(() => applyTeachingLoadCarryForward({
					actorSchoolId: fixtureSchoolId, actorId: ACTOR, schoolId: fixtureSchoolId,
					targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
					expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision, expectedTargetRevision: preview.targetRevision,
					confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
				})),
				run(() => applyTeachingLoadCarryForward({
					actorSchoolId: fixtureSchoolId, actorId: ACTOR, schoolId: fixtureSchoolId,
					targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
					expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision, expectedTargetRevision: preview.targetRevision,
					confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
				})),
			]);
			const fulfilled = settled.filter((entry) => entry.status === 'fulfilled');
			const appliedCount = fulfilled.filter((entry) => entry.status === 'fulfilled' && (entry.value as any).carried === 2).length;
			assert(appliedCount >= 1, 'at least one concurrent apply carried the two pairs');
			const afterCount = await instrumented.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId } });
			assertEqual(afterCount - beforeCount, 2, 'exactly two target ownerships were created, with no duplicates');
			for (const entry of settled) {
				if (entry.status === 'rejected') assert((entry.reason as any)?.code === 'TRANSACTION_CONFLICT', 'a rejected concurrent apply fails closed with TRANSACTION_CONFLICT');
			}
		}

		section('F7. replay is idempotent with zero writes and cardinal audit/cycle');
		{
			const auditsBefore = await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, action: 'TEACHING_LOAD_CARRY_FORWARD' } });
			const cyclesBefore = await instrumented.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId } });
			assertEqual(auditsBefore, 1, 'exactly one carry-forward audit exists after apply');
			assertEqual(cyclesBefore, 1, 'exactly one target Teaching Load cycle exists after apply');
			assertEqual(writes().length >= 2, true, 'apply wrote ownership rows');

			resetRecording();
			const replay = await run(() => applyTeachingLoadCarryForward({
				actorSchoolId: fixtureSchoolId, actorId: ACTOR, schoolId: fixtureSchoolId,
				targetSchoolYearId: targetYearId, sourceSchoolYearId: sourceYearId,
				expectedFingerprint: preview.fingerprint, expectedSourceRevision: preview.sourceRevision, expectedTargetRevision: preview.targetRevision,
				confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
			}));
			assertEqual(replay.replayed, true, 'a repeat apply reports a replay receipt');
			assertEqual(writes().length, 0, 'replay performed zero writes');
			assertEqual(await instrumented.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, action: 'TEACHING_LOAD_CARRY_FORWARD' } }), 1, 'replay created no additional audit');
		}

		section('F8. archived source remains immutable');
		{
			const sourceOwnerships = await instrumented.subjectSectionOwnership.findMany({ where: { schoolId: fixtureSchoolId, schoolYearId: sourceYearId }, select: { id: true, facultyId: true, subjectId: true, sectionId: true } });
			assertEqual(sourceOwnerships.length, 14, 'all 14 archived ownership rows still exist');
			const sourceFacultySubjects = await instrumented.facultySubject.count({ where: { schoolId: fixtureSchoolId, schoolYearId: sourceYearId } });
			assertEqual(sourceFacultySubjects, 9, 'archived FacultySubject rows are unchanged');
		}

		section('F9. rollback identities match persisted rows');
		{
			const appliedOwnerships = await instrumented.subjectSectionOwnership.findMany({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId }, select: { id: true } });
			const createdSampaguita = await instrumented.subjectSectionOwnership.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, subjectId: ids.math, sectionId: 2101 }, select: { id: true, facultyId: true } });
			assertEqual((createdSampaguita as any)?.facultyId, ids.fa, 'Sampaguita MATH carried to the archived owner resolved by external identity');
			const createdEng = await instrumented.subjectSectionOwnership.findFirst({ where: { schoolId: fixtureSchoolId, schoolYearId: targetYearId, subjectId: ids.eng, sectionId: 2113 }, select: { id: true, facultyId: true } });
			assertEqual((createdEng as any)?.facultyId, ids.fd, 'Tandang Sora ENG carried to the archived owner');
			const targetCycle = await instrumented.teachingLoadCycle.findUnique({ where: { schoolId_schoolYearId: { schoolId: fixtureSchoolId, schoolYearId: targetYearId } }, select: { state: true } });
			assertEqual((targetCycle as any)?.state, 'POPULATED', 'target cycle refreshed to POPULATED');
			void appliedOwnerships;
		}
	} finally {
		section('F10. fixture cleanup (zero residue)');
		await instrumented.$transaction(async (tx: any) => {
			await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.facultySubject.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.teachingLoadCycle.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.sectionMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.facultyMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.specializationAlias.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.schedulingPolicy.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.subject.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
			await tx.school.delete({ where: { id: fixtureSchoolId } });
		});
		const residue = await instrumented.$transaction(async (tx: any) => {
			return Promise.all([
				tx.school.count({ where: { id: fixtureSchoolId } }),
				tx.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultySubject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.sectionMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultyMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.subject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId } }),
				tx.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
				tx.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId } }),
				tx.enrollProSchoolYearMirror.count({ where: { schoolId: fixtureSchoolId } }),
			]);
		});
		assertEqual(residue.reduce((sum: number, value: number) => sum + value, 0), 0, 'zero residue across all fixture-scoped models');
		await base.$disconnect();
	}
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
