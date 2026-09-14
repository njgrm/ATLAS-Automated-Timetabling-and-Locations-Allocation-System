/**
 * TT-TL-MODULES-C04 — focused module-consumed contract suite.
 *
 * This suite is deliberately tight. It proves ONLY the contract the Timetable
 * focused modules consume; the full S3 authority matrix lives in
 * `tt-tl-authority-guard-c04.test.ts` and is run separately (R1).
 *
 *   C1  canonical qualification refusal (`TEACHING_LOAD_QUALIFICATION_MISSING`)
 *       with zero ownership/FacultySubject writes;
 *   C2  stale source fingerprint (`TEACHING_LOAD_REPAIR_STALE`) with the
 *       protected tables byte-identical (zero ownership/run/edit/audit writes);
 *   C3  strict `isPublished === true` predicate: a genuine published run is
 *       refused, a superseded run retaining `publishedAt`/`publishedBy` markers
 *       remains repairable;
 *   C4  the phantom `reconciliation/apply` route is absent (404) and the
 *       exported service apply is a typed retired error;
 *   C5  the repair service consumes the single shared strict-predicate helper
 *       and does not define a duplicate local predicate.
 *
 * ALL database activity must target the disposable database supplied through
 * `DATABASE_URL` (see the packet's environment discipline). The suite never
 * provisions schema; the runner creates and drops the disposable database.
 * Live school 1 / any live year is never touched, and every fixture row is
 * removed in `finally` with a zero-residue assertion.
 *
 * Run: `npx tsx src/__tests__/tt-tl-modules-contract.test.ts`
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

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

async function main() {
	loadServerEnv();
	if (!process.env.DATABASE_URL) {
		console.error('[FAIL] DATABASE_URL is unavailable. This suite must run against its disposable database.');
		process.exit(1);
	}
	// Fail closed if a runner points the suite at the configured development
	// database instead of a disposable one: every disposable database created by
	// the repository guard is named `atlas_restore_drill_*`.
	const targetDatabase = (() => {
		try {
			return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ''));
		} catch {
			return '';
		}
	})();
	if (!/^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/.test(targetDatabase)) {
		console.error(`[FAIL] DATABASE_URL must point at a disposable atlas_restore_drill_* database; got "${targetDatabase || '<unparseable>'}".`);
		process.exit(1);
	}
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'tt-tl-modules-c04-hermetic-secret';
	}
	const prismaModule = await import('../lib/prisma.js');
	const base = (prismaModule as any).createTestPrismaClient();

	const FIXTURE_NAME = `TT-TL-MODULES-C04 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	const fixtureYearId = 9600 + (Date.now() % 300);
	let fixtureSchoolId = 0;
	let runId = 0;
	let entryId = '';
	let roomId = 0;
	let buildingId = 0;
	const ids: Record<string, number> = {};
	let server: any = null;

	const protectedCounts = async () => {
		const [ownership, facultySubjects, runs, edits, audits, cycles, policies] = await Promise.all([
			base.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.facultySubject.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.generationRun.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.manualScheduleEdit.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.auditLog.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.teachingLoadCycle.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
			base.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId, schoolYearId: fixtureYearId } }),
		]);
		return { ownership, facultySubjects, runs, edits, audits, cycles, policies };
	};

	try {
		section('F1. disposable fixture (school/year, subject, section, faculty, run)');
		const school = await base.school.create({ data: { name: FIXTURE_NAME, shortName: 'TTTLM04' }, select: { id: true } });
		fixtureSchoolId = school.id as number;
		assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);
		await base.enrollProSchoolYearMirror.create({
			data: {
				schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId, yearLabel: '2033-2034',
				isActive: true, isArchived: false, syncStatus: 'synced',
			},
		});
		const math = await base.subject.create({
			data: {
				schoolId: fixtureSchoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240,
				programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'MATH',
				allowedSpecializations: ['MATH'], preferredRoomType: 'CLASSROOM', isActive: true,
			},
			select: { id: true },
		});
		ids.math = math.id as number;
		const sectionRow = await base.sectionMirror.create({
			data: {
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 7601, name: 'Grade 7 - M',
				gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR',
				maxCapacity: 50, enrolledCount: 50, isActiveForScheduling: true, isStale: false,
			},
			select: { id: true },
		});
		ids.section = sectionRow.id as number;
		const qualifiedA = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7601, employeeId: 'E7601', firstName: 'Ada', lastName: 'Math', department: 'MATH', specialization: 'MATH', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		const qualifiedB = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7602, employeeId: 'E7602', firstName: 'Bela', lastName: 'Math', department: 'MATH', specialization: 'MATH', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		const unqualified = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7603, employeeId: 'E7603', firstName: 'Filo', lastName: 'Filipino', department: 'FIL', specialization: 'FIL', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		ids.facultyA = qualifiedA.id as number;
		ids.facultyB = qualifiedB.id as number;
		ids.facultyUnqualified = unqualified.id as number;
		await base.facultySubject.create({
			data: { facultyId: ids.facultyA, subjectId: ids.math, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, gradeLevels: [7], sectionIds: [ids.section], assignedBy: 0 },
		});
		const building = await base.building.create({
			data: { schoolId: fixtureSchoolId, name: 'Main', shortCode: 'MAIN', isTeachingBuilding: true, x: 1, y: 1 },
			select: { id: true },
		});
		buildingId = building.id as number;
		const room = await base.room.create({
			data: { buildingId, name: 'R101', type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 },
			select: { id: true },
		});
		roomId = room.id as number;
		entryId = 'entry-math-modules-1';
		const run = await base.generationRun.create({
			data: {
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, status: 'COMPLETED', runType: 'FULL', triggeredBy: 0,
				startedAt: new Date(Date.now() - 60_000), finishedAt: new Date(), version: 1,
				draftEntries: [{
					entryId, facultyId: ids.facultyA, roomId, subjectId: ids.math, sectionId: ids.section,
					day: 'MONDAY', startTime: '07:00', endTime: '08:00', durationMinutes: 60, termIndex: 1, entryKind: 'SECTION',
				}],
				unassignedItems: [],
				violations: [],
				summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, policyBlockedCount: 0, hardViolationCount: 0, violationCounts: {}, isPublished: false, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] },
			},
			select: { id: true },
		});
		runId = run.id as number;
		assert(runId > 0, `fixture run created (id=${runId})`);

		section('F2. real app boot + signed officer JWT');
		const app = (await import('../app.js')).default;
		const jwt = await import('jsonwebtoken');
		const secret = process.env.JWT_SECRET as string;
		const officerJwt = jwt.default.sign({ userId: 9601, role: 'officer', authSource: 'local', schoolId: fixtureSchoolId }, secret, { expiresIn: '5m' });
		server = await new Promise<any>((resolveServer, rejectServer) => {
			const listener = app.listen(0, () => resolveServer(listener));
			listener.on('error', rejectServer);
		});
		const port = (server.address() as any).port as number;
		const baseUrl = `http://127.0.0.1:${port}`;
		assert(port > 0, `ephemeral app server listening (port=${port})`);

		async function call(method: string, path: string, token: string | null, body?: unknown) {
			const res = await fetch(baseUrl + path, {
				method,
				headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
				body: body === undefined ? undefined : JSON.stringify(body),
			});
			const text = await res.text();
			let json: any = {};
			try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
			return { status: res.status, json };
		}

		const repairPreview = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/${runId}/teaching-load-repairs/preview`;
		const repairApply = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/${runId}/teaching-load-repairs/apply`;
		const reconBase = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/${runId}/reconciliation`;
		const changeTo = (toFacultyId: number, expectedRunVersion = 1) => ({
			changes: [{ kind: 'ENTRY', entryId, subjectId: ids.math, sectionId: ids.section, fromFacultyId: ids.facultyA, toFacultyId }],
			expectedRunVersion,
		});

		section('C1. canonical qualification refusal with zero writes');
		{
			const before = await protectedCounts();
			const res = await call('POST', repairPreview, officerJwt, changeTo(ids.facultyUnqualified));
			assert(res.status === 409 && res.json.code === 'TEACHING_LOAD_QUALIFICATION_MISSING', `C1 unqualified preview refused → ${res.status}/${res.json.code}`);
			const after = await protectedCounts();
			assertEqual(after.facultySubjects, before.facultySubjects, 'C1 refusal created zero FacultySubject rows');
			assertEqual(after.ownership, before.ownership, 'C1 refusal created zero ownership rows');
		}

		section('C2. stale source fingerprint fails closed with byte-identical protected tables');
		{
			const previewRes = await call('POST', repairPreview, officerJwt, changeTo(ids.facultyB));
			assert(previewRes.status === 200 && typeof previewRes.json.sourceFingerprint === 'string', `C2 preview issues sourceFingerprint → ${previewRes.status}`);
			const fingerprint = previewRes.json.sourceFingerprint as string;
			const before = await protectedCounts();
			const runBefore = await base.generationRun.findUnique({ where: { id: runId }, select: { version: true, draftEntries: true, summary: true } });
			// Deterministic non-demand interleave: add a teaching room after preview.
			await base.room.create({ data: { buildingId, name: 'R102-modules-interleave', type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 } });
			const applyRes = await call('POST', repairApply, officerJwt, { ...changeTo(ids.facultyB), expectedSourceFingerprint: fingerprint, allowSoftOverride: true });
			assert(applyRes.status === 409 && applyRes.json.code === 'TEACHING_LOAD_REPAIR_STALE', `C2 stale apply refused → ${applyRes.status}/${applyRes.json.code}`);
			const after = await protectedCounts();
			assertEqual(JSON.stringify(after), JSON.stringify(before), 'C2 stale apply left ownership/facultySubject/run/edit/audit/cycle/policy tables byte-identical');
			const runAfter = await base.generationRun.findUnique({ where: { id: runId }, select: { version: true, draftEntries: true, summary: true } });
			assertEqual(JSON.stringify(runAfter), JSON.stringify(runBefore), 'C2 stale apply left the run row byte-identical (no version/entries/summary mutation)');
		}

		section('C3. strict publication predicate for the module contract');
		{
			// A genuine published run is refused on both preview and apply.
			await base.generationRun.update({
				where: { id: runId },
				data: { summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, isPublished: true, publishedAt: '2033-01-01T00:00:00.000Z', publishedBy: 7, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] } },
			});
			const beforePublished = await protectedCounts();
			let res = await call('POST', repairPreview, officerJwt, changeTo(ids.facultyB));
			assert(res.status === 409 && res.json.code === 'RUN_ALREADY_PUBLISHED', `C3 published preview refused → ${res.status}/${res.json.code}`);
			res = await call('POST', repairApply, officerJwt, { ...changeTo(ids.facultyB), allowSoftOverride: true });
			assert(res.status === 409 && res.json.code === 'RUN_ALREADY_PUBLISHED', `C3 published apply refused → ${res.status}/${res.json.code}`);
			const afterPublished = await protectedCounts();
			assertEqual(JSON.stringify(afterPublished), JSON.stringify(beforePublished), 'C3 published refusal wrote nothing');
			// A superseded run retains the legacy markers but is NOT published, so
			// it stays repairable (it must never be mislabeled published).
			await base.generationRun.update({
				where: { id: runId },
				data: { summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, isPublished: false, publishedAt: '2033-01-01T00:00:00.000Z', publishedBy: 7, publicationSupersededAt: '2033-02-01T00:00:00.000Z', timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] } },
			});
			res = await call('POST', repairPreview, officerJwt, changeTo(ids.facultyB));
			assert(res.status === 200 && res.json.code !== 'RUN_ALREADY_PUBLISHED', `C3 superseded run with retained markers stays repairable → ${res.status}/${res.json.code}`);
		}

		section('C4. retired phantom reconciliation mutation');
		{
			const absentApply = await call('POST', `${reconBase}/apply`, officerJwt, { expectedRunVersion: 1, expectedFingerprint: 'x' });
			assertEqual(absentApply.status, 404, 'C4 reconciliation/apply route is absent (404)');
			const reconService = await import('../services/reconciliation.service.js');
			let retiredCode = '';
			let retiredStatus = 0;
			try {
				await reconService.applyRunReconciliation({ runId, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, actorId: 1, expectedRunVersion: 1, expectedFingerprint: 'x' });
			} catch (error: any) {
				retiredCode = error?.code ?? '';
				retiredStatus = error?.statusCode ?? 0;
			}
			assertEqual(retiredCode, 'RECONCILIATION_APPLY_RETIRED', 'C4 retired service apply throws the typed retired code');
			assertEqual(retiredStatus, 410, 'C4 retired service apply is a typed 410');
		}

		section('C5. single shared strict-predicate authority');
		{
			const serviceSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../services/timetable-teaching-load-repair.service.ts'), 'utf8');
			assert(/import\s*\{[^}]*isStrictlyPublishedSummary[^}]*\}\s*from\s*'\.\/reconciliation\.service\.js'/.test(serviceSource), 'C5 repair service imports the shared strict-predicate helper');
			assert(!/function\s+isStrictlyPublished\w*\s*\(/.test(serviceSource), 'C5 repair service defines no duplicate local strict-predicate helper');
			const reconciliationSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../services/reconciliation.service.ts'), 'utf8');
			assert(/export function isStrictlyPublishedSummary/.test(reconciliationSource), 'C5 shared helper is exported from reconciliation.service.ts');
		}
	} finally {
		section('F3. fixture cleanup (zero residue)');
		if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
		if (fixtureSchoolId) {
			await base.$transaction(async (tx: any) => {
				await tx.manualScheduleEdit.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.auditLog.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.subjectSectionOwnership.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.facultySubject.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.teachingLoadCycle.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.generationRun.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.sectionMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.facultyMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.subject.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.room.deleteMany({ where: { building: { schoolId: fixtureSchoolId } } });
				await tx.building.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.schedulingPolicy.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.schoolYearTermConfig.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.enrollProSchoolYearMirror.deleteMany({ where: { schoolId: fixtureSchoolId } });
				await tx.school.delete({ where: { id: fixtureSchoolId } });
			});
		}
		const residue = await base.$transaction(async (tx: any) => {
			const counts = await Promise.all([
				tx.school.count({ where: { id: fixtureSchoolId } }),
				tx.enrollProSchoolYearMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.subjectSectionOwnership.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultySubject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.generationRun.count({ where: { schoolId: fixtureSchoolId } }),
				tx.sectionMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.facultyMirror.count({ where: { schoolId: fixtureSchoolId } }),
				tx.subject.count({ where: { schoolId: fixtureSchoolId } }),
				tx.auditLog.count({ where: { schoolId: fixtureSchoolId } }),
				tx.room.count({ where: { building: { schoolId: fixtureSchoolId } } }),
				tx.schedulingPolicy.count({ where: { schoolId: fixtureSchoolId } }),
			]);
			return counts.reduce((sum: number, value: number) => sum + value, 0);
		});
		assertEqual(residue, 0, 'zero residue across all fixture-scoped models');
	}

	console.log(`\nRESULT: ${passCount} passed, ${failCount} failed`);
	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exit(2);
});
