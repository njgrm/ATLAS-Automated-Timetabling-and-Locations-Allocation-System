/**
 * SMART-DRAFT-READ-S3 — companion read-only DRAFT schedule family.
 *
 * Runs the REAL Express app (the mounted `draft-schedule.router`) over a GUARDED
 * DISPOSABLE PostgreSQL database created by `provisionDisposableDatabase('draft')`
 * and dropped with a zero-residue assertion in `finally`. The configured source
 * database is probed read-only; it is never written.
 *
 * Proves:
 *   A  auth/param negatives: 401 NO_TOKEN, 400 TERM_INDEX_REQUIRED /
 *      INVALID_TERM_INDEX / TERM_INDEX_OUTSIDE_CONTRACT, 404 FACULTY_NOT_FOUND,
 *      403 DRAFT_SHARING_DISABLED with zero payload/writes
 *   B  the sharing toggle: capability/actor-school/body guards, ON write + audit,
 *      idempotent re-apply
 *   C  scoped reads while shared: faculty-external returns only that teacher's
 *      entries for the requested term; sections scopes to one section; whole-run
 *      returns the shared run; active resolves through the verified contract;
 *      CROSS_FACULTY_DENIED for a self-identified teacher reading another's draft
 *   D  a published run is never a draft (404 read, 409 share)
 *
 * Run: `npx tsx src/__tests__/smart-draft-read-s3.test.ts` (from `atlas-server`).
 */

import { readFileSync } from 'node:fs';

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

const SCHOOL_YEAR_ID = 9_200_101;
const FACULTY_A_EXTERNAL = 810;
const FACULTY_B_EXTERNAL = 811;
const SECTION_S1 = 9_201;
const SECTION_S2 = 9_202;

async function main() {
	section('S3 setup. guarded disposable database');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];

	const disposable = provisionDisposableDatabase('draft');
	if (!disposable) {
		console.error('EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)');
		process.exit(3);
	}
	// MUST precede the first import of ../lib/prisma.js and ../app.js.
	process.env.DATABASE_URL = disposable.targetUrl;
	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	console.log(`[INFO] disposable database ready: ${disposable.name}`);

	const { createTestPrismaClient, prisma: singleton } = await import('../lib/prisma.js');
	const app = (await import('../app.js')).default;
	const jwtModule = await import('jsonwebtoken');
	const jwt: any = (jwtModule as any).default ?? jwtModule;

	const prisma: any = createTestPrismaClient();
	const secret = process.env.JWT_SECRET as string;
	const systemToken = (process.env.ATLAS_SYSTEM_TOKEN ?? '').trim();
	check(typeof secret === 'string' && secret.length > 0, 'JWT secret configured for route tests');
	check(systemToken.length > 0, 'system token configured for route tests');

	let server: any = null;
	let schoolId = 0;
	let sharedRunId = 0;
	let facultyAId = 0;
	let facultyBId = 0;

	try {
		section('S3 fixture. one active trimester year, two teachers, four draft entries');
		const school = await prisma.school.create({
			data: { name: `SMART-DRAFT-READ-S3 FIXTURE — SAFE TO DELETE — ${Date.now()}`, shortName: 'S3DRAFT' },
			select: { id: true },
		});
		schoolId = school.id as number;

		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId,
				enrollProSchoolYearId: SCHOOL_YEAR_ID,
				yearLabel: '2031-2032',
				isActive: true,
				isArchived: false,
				lastSyncedAt: new Date(),
				termContractCachedAt: new Date(),
				termContractCache: {
					schoolId,
					schoolYear: { id: SCHOOL_YEAR_ID, yearLabel: '2031-2032' },
					format: 'TRIMESTER',
					activeTerm: { identity: 'T1', order: 1 },
					terms: [
						{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
						{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
						{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
					],
				},
			},
		});
		await prisma.schedulingPolicy.create({
			data: {
				schoolId,
				schoolYearId: SCHOOL_YEAR_ID,
				periodLengthMinutes: 60,
				periodsPerDay: 8,
				earliestStartTime: '07:00',
				latestEndTime: '17:00',
			},
		});

		const facultyA = await prisma.facultyMirror.create({
			data: { externalId: FACULTY_A_EXTERNAL, schoolId, firstName: 'Ada', lastName: 'Alpha', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false },
			select: { id: true },
		});
		const facultyB = await prisma.facultyMirror.create({
			data: { externalId: FACULTY_B_EXTERNAL, schoolId, firstName: 'Ben', lastName: 'Beta', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false },
			select: { id: true },
		});
		facultyAId = facultyA.id as number;
		facultyBId = facultyB.id as number;

		const entry = (over: Record<string, unknown>) => ({
			entryId: 'e',
			facultyId: facultyAId,
			roomId: 1,
			subjectId: 1,
			sectionId: SECTION_S1,
			day: 'MONDAY',
			startTime: '07:00',
			endTime: '08:00',
			durationMinutes: 60,
			termIndex: 1,
			...over,
		});
		const draftEntries = [
			entry({ entryId: 'entry-A-term1-S1', facultyId: facultyAId, sectionId: SECTION_S1, termIndex: 1, day: 'MONDAY' }),
			entry({ entryId: 'entry-B-term1-S1', facultyId: facultyBId, sectionId: SECTION_S1, termIndex: 1, day: 'MONDAY', startTime: '08:00', endTime: '09:00' }),
			entry({ entryId: 'entry-A-term2-S1', facultyId: facultyAId, sectionId: SECTION_S1, termIndex: 2, day: 'TUESDAY' }),
			entry({ entryId: 'entry-A-term1-S2', facultyId: facultyAId, sectionId: SECTION_S2, termIndex: 1, day: 'WEDNESDAY', startTime: '09:00', endTime: '10:00' }),
		];

		const sharedRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId: SCHOOL_YEAR_ID,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: 1,
				startedAt: new Date(),
				finishedAt: new Date(),
				summary: { isPublished: false, timetableDisplaySlots: [] } as object,
				draftEntries: draftEntries as object,
				unassignedItems: [] as object,
			},
			select: { id: true, version: true },
		});
		sharedRunId = sharedRun.id as number;
		check(sharedRunId > 0 && facultyAId > 0 && facultyBId > 0, `fixture created (school=${schoolId}, run=${sharedRunId})`);

		section('S3 boot the real app');
		server = await new Promise<any>((resolveServer, rejectServer) => {
			const listener = app.listen(0, () => resolveServer(listener));
			listener.on('error', rejectServer);
		});
		const address = server.address();
		const port = typeof address === 'object' && address ? (address as any).port : 0;
		const baseUrl = `http://127.0.0.1:${port}`;
		check(port > 0, `ephemeral test server listening (port=${port})`);

		const signJwt = (payload: Record<string, unknown>): string => jwt.sign(payload, secret, { expiresIn: '5m' });
		const schedulerJwt = (school: number | null) =>
			signJwt(school == null ? { userId: 9301, role: 'scheduler', authSource: 'local' } : { userId: 9301, role: 'scheduler', authSource: 'local', schoolId: school });
		const teacherJwt = (facultyId: number, school: number | null) =>
			signJwt(school == null ? { userId: 9302, role: 'faculty', authSource: 'local', facultyId } : { userId: 9302, role: 'faculty', authSource: 'local', schoolId: school, facultyId });

		const draftBase = `/api/v1/schools/${schoolId}/school-years/${SCHOOL_YEAR_ID}/schedules/draft`;
		const facultyDraftPath = (externalId: number, term = '1') => `${draftBase}/faculty-external/${externalId}?termIndex=${term}`;
		const sectionDraftPath = (sectionId: number, term = '1') => `${draftBase}/sections/${sectionId}?termIndex=${term}`;
		const wholeRunDraftPath = (term = '1') => `${draftBase}?termIndex=${term}`;

		async function call(method: string, path: string, token: string | null, body?: unknown) {
			const res = await fetch(baseUrl + path, {
				method,
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					'Content-Type': 'application/json',
				},
				body: body === undefined ? undefined : JSON.stringify(body),
			});
			const json: any = await res.json().catch(() => ({}));
			return { status: res.status, json };
		}

		const auditCount = () => prisma.auditLog.count({ where: { schoolId } });

		// ── A. auth / param negatives ───────────────────────────────────────────
		section('A. auth and parameter negatives');
		const unauth = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL), null);
		check(unauth.status === 401 && unauth.json.code === 'NO_TOKEN', `A1 unauthenticated → ${unauth.status}/${unauth.json.code}`);

		const missingTerm = await call('GET', `${draftBase}/faculty-external/${FACULTY_A_EXTERNAL}`, systemToken);
		check(missingTerm.status === 400 && missingTerm.json.code === 'TERM_INDEX_REQUIRED', `A2 missing term → ${missingTerm.status}/${missingTerm.json.code}`);

		const invalidTerm = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL, 'abc'), systemToken);
		check(invalidTerm.status === 400 && invalidTerm.json.code === 'INVALID_TERM_INDEX', `A3 malformed term → ${invalidTerm.status}/${invalidTerm.json.code}`);

		const outsideTerm = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL, '4'), systemToken);
		check(outsideTerm.status === 400 && outsideTerm.json.code === 'TERM_INDEX_OUTSIDE_CONTRACT', `A4 out-of-contract term 4 (trimester) → ${outsideTerm.status}/${outsideTerm.json.code}`);

		const unknownFaculty = await call('GET', facultyDraftPath(999999), systemToken);
		check(unknownFaculty.status === 404 && unknownFaculty.json.code === 'FACULTY_NOT_FOUND', `A5 unknown external faculty → ${unknownFaculty.status}/${unknownFaculty.json.code}`);

		const auditBefore = await auditCount();
		const disabled = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL), systemToken);
		check(disabled.status === 403 && disabled.json.code === 'DRAFT_SHARING_DISABLED', `A6 toggle OFF → ${disabled.status}/${disabled.json.code}`);
		check(disabled.json.entries === undefined, 'A6 toggle OFF returns zero payload (no entries)');
		checkEqual(await auditCount(), auditBefore, 'A6 toggle OFF wrote no audit rows');

		// ── B. sharing toggle ───────────────────────────────────────────────────
		section('B. per-run share toggle (default OFF)');
		const togglePath = `/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/runs/${sharedRunId}/draft-sharing`;

		const noCapability = await call('PATCH', togglePath, teacherJwt(facultyAId, schoolId), { enabled: true });
		check(noCapability.status === 403 && noCapability.json.code === 'FORBIDDEN', `B1 teacher JWT lacks timetable:edit → ${noCapability.status}/${noCapability.json.code}`);

		const crossSchool = await call('PATCH', togglePath, schedulerJwt(999997), { enabled: true });
		check(crossSchool.status === 403 && crossSchool.json.code === 'CROSS_SCHOOL_DENIED', `B2 cross-school actor → ${crossSchool.status}/${crossSchool.json.code}`);

		const noActorSchool = await call('PATCH', togglePath, schedulerJwt(null), { enabled: true });
		check(noActorSchool.status === 403 && noActorSchool.json.code === 'SCHOOL_SCOPE_REQUIRED', `B3 unresolved actor school → ${noActorSchool.status}/${noActorSchool.json.code}`);

		const badBody = await call('PATCH', togglePath, schedulerJwt(schoolId), { enabled: 'yes' });
		check(badBody.status === 400 && badBody.json.code === 'INVALID_BODY', `B4 non-boolean body → ${badBody.status}/${badBody.json.code}`);

		const systemOnToggle = await call('PATCH', togglePath, systemToken, { enabled: true });
		check(systemOnToggle.status === 401, `B5 system token rejected on toggle (JWT-only authenticate) → ${systemOnToggle.status}`);
		checkEqual(await auditCount(), auditBefore, 'B5 rejected toggle attempts wrote no audit rows / flag still OFF');

		const enable = await call('PATCH', togglePath, schedulerJwt(schoolId), { enabled: true });
		check(enable.status === 200 && enable.json.enabled === true && enable.json.changed === true, `B6 enable → ${enable.status} changed=${enable.json.changed}`);
		checkEqual(await auditCount(), auditBefore + 1, 'B6 enable wrote exactly one audit row');

		const enableAgain = await call('PATCH', togglePath, schedulerJwt(schoolId), { enabled: true });
		check(enableAgain.status === 200 && enableAgain.json.changed === false, 'B7 idempotent enable reports changed=false');
		checkEqual(await auditCount(), auditBefore + 1, 'B7 idempotent enable wrote no additional audit rows');

		// ── C. scoped reads while shared ────────────────────────────────────────
		section('C. scoped draft reads while shared');
		const facultyRead = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL), systemToken);
		check(facultyRead.status === 200, `C1 faculty-external read → ${facultyRead.status}`);
		const facultyEntries: any[] = facultyRead.json.entries ?? [];
		check(facultyEntries.length === 2, `C1 teacher A term 1 has 2 entries (got ${facultyEntries.length})`);
		check(facultyEntries.every((e) => e.facultyId === facultyAId), 'C1 every entry belongs to teacher A');
		check(facultyEntries.every((e) => e.termIndex === 1), 'C1 every entry is term 1');
		check(!facultyEntries.some((e) => e.facultyId === facultyBId), 'C1 teacher B entries are absent');
		check(facultyRead.json.source?.isDraft === true && facultyRead.json.source?.termIndex === 1, 'C1 source provenance declares isDraft/termIndex');
		check(Array.isArray(facultyRead.json.source?.orderedTerms) && facultyRead.json.source.orderedTerms.length === 3, 'C1 source carries the 3-term ordered contract');
		check('inputFingerprint' in (facultyRead.json.source ?? {}), 'C1 source carries the input fingerprint field');
		checkEqual(facultyRead.json.unassignedItems?.length, 0, 'C1 scoped read exposes no run-wide unassigned items');

		const sectionRead = await call('GET', sectionDraftPath(SECTION_S1), systemToken);
		check(sectionRead.status === 200, `C2 section read → ${sectionRead.status}`);
		const sectionEntries: any[] = sectionRead.json.entries ?? [];
		check(sectionEntries.length === 2, `C2 section S1 term 1 has 2 entries (got ${sectionEntries.length})`);
		check(sectionEntries.some((e) => e.facultyId === facultyAId) && sectionEntries.some((e) => e.facultyId === facultyBId), 'C2 section read spans both teachers of the section');
		check(sectionEntries.every((e) => e.sectionId === SECTION_S1), 'C2 every entry is the requested section');
		check(!sectionEntries.some((e) => e.sectionId === SECTION_S2), 'C2 entries of another section are absent');

		const wholeRead = await call('GET', wholeRunDraftPath(), systemToken);
		check(wholeRead.status === 200, `C3 whole-run read → ${wholeRead.status}`);
		const wholeEntries: any[] = wholeRead.json.entries ?? [];
		check(wholeEntries.length === 3, `C3 whole-run term 1 has 3 entries (got ${wholeEntries.length})`);
		check(wholeEntries.every((e) => e.termIndex === 1), 'C3 whole-run read is term-scoped');
		checkEqual(wholeRead.json.runId, sharedRunId, 'C3 whole-run read resolves the shared run');

		const activeRead = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL, 'active'), systemToken);
		check(activeRead.status === 200 && activeRead.json.source?.termScope === 'active' && activeRead.json.source?.termIndex === 1, `C4 active resolves to T1 → ${activeRead.status} term=${activeRead.json.source?.termIndex}`);

		const crossFaculty = await call('GET', facultyDraftPath(FACULTY_A_EXTERNAL), teacherJwt(facultyBId, schoolId));
		check(crossFaculty.status === 403 && crossFaculty.json.code === 'CROSS_FACULTY_DENIED', `C5 teacher B reading A → ${crossFaculty.status}/${crossFaculty.json.code}`);
		const ownFaculty = await call('GET', facultyDraftPath(FACULTY_B_EXTERNAL), teacherJwt(facultyBId, schoolId));
		check(ownFaculty.status === 200 && (ownFaculty.json.entries ?? []).every((e: any) => e.facultyId === facultyBId), `C5 teacher B reading B → ${ownFaculty.status}`);

		// ── D. a published run is never a draft ─────────────────────────────────
		section('D. published run is not a draft');
		const publishedRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId: SCHOOL_YEAR_ID,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: 1,
				startedAt: new Date(),
				finishedAt: new Date(),
				summary: { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: 1 } as object,
				draftEntries: draftEntries as object,
				unassignedItems: [] as object,
			},
			select: { id: true },
		});
		const publishedRunId = publishedRun.id as number;

		const publishedRead = await call('GET', wholeRunDraftPath(), systemToken);
		check(publishedRead.status === 404 && publishedRead.json.code === 'DRAFT_RUN_NOT_FOUND', `D1 published latest run is not a draft → ${publishedRead.status}/${publishedRead.json.code}`);
		check(publishedRead.json.details?.reason === 'PUBLISHED_RUN_IS_NOT_A_DRAFT', 'D1 typed reason names the published-run case');

		const auditBeforePublishToggle = await auditCount();
		const publishedTogglePath = `/api/v1/generation/${schoolId}/${SCHOOL_YEAR_ID}/runs/${publishedRunId}/draft-sharing`;
		const publishedToggle = await call('PATCH', publishedTogglePath, schedulerJwt(schoolId), { enabled: true });
		check(publishedToggle.status === 409 && publishedToggle.json.code === 'RUN_ALREADY_PUBLISHED', `D2 published run cannot be shared → ${publishedToggle.status}/${publishedToggle.json.code}`);
		checkEqual(await auditCount(), auditBeforePublishToggle, 'D2 rejected published-run toggle wrote no audit row');
	} finally {
		if (server) server.close();
	}

	section('S3 zero residue. disconnect and drop the disposable database');
	await prisma.$disconnect().catch(() => undefined);
	await singleton.$disconnect().catch(() => undefined);
	disposable.drop();
	disposable.assertDropped();
	check(true, `disposable database dropped (${disposable.name})`);

	console.log(`\n${passCount} passed, ${failCount} failed`);
	process.exit(failCount === 0 ? 0 : 1);
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
