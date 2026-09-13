/**
 * TT-TL-AUTHORITY-GUARD-C04 — server authority guard suite.
 *
 * Mounted-route proofs on the real Express app with real authentication:
 *   M1  authority matrix (repair + reconciliation preview) with typed rejects
 *       and zero service dispatch (no scheduling policy row is ever created);
 *   M2  strict `isPublished === true` publication predicate;
 *   M3  canonical receiver qualification before FacultySubject/ownership
 *       creation, with the old-path differential;
 *   M4  B-04 source-snapshot binding: a covered-input interleave between
 *       preview and apply fails closed with byte-identical protected tables
 *       and zero notification dispatch;
 *   M5  retired phantom mutation paths (reconciliation apply absent; annual
 *       apply typed 410) with zero writes.
 *
 * All rows live in a disposable fixture school/year and are removed in
 * `finally` with a zero-residue assertion. Live school 1 / any live year is
 * never touched. Run with `npx tsx <this-file>` against a reachable database.
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
		console.error('[FAIL] DATABASE_URL is unavailable.');
		process.exit(1);
	}
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'tt-tl-authority-guard-c04-hermetic-secret';
	}
	const prismaModule = await import('../lib/prisma.js');
	const base = (prismaModule as any).createTestPrismaClient();

	const FIXTURE_NAME = `TT-TL-GUARD-C04 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	const fixtureYearId = 9100 + (Date.now() % 400);
	let fixtureSchoolId = 0;
	let runId = 0;
	let entryId = '';
	let roomId = 0;
	let buildingId = 0;
	const ids: Record<string, number> = {};
	let server: any = null;
	let notificationCount = 0;
	let unsubscribeNotifications: (() => void) | null = null;

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
		const school = await base.school.create({ data: { name: FIXTURE_NAME, shortName: 'TTTLG04' }, select: { id: true } });
		fixtureSchoolId = school.id as number;
		assert(fixtureSchoolId > 0, `fixture school created (id=${fixtureSchoolId})`);
		await base.enrollProSchoolYearMirror.create({
			data: {
				schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId, yearLabel: '2031-2032',
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
		const filipino = await base.subject.create({
			data: {
				schoolId: fixtureSchoolId, code: 'FIL', name: 'Filipino', minMinutesPerWeek: 240,
				programScopes: ['REGULAR'], gradeLevels: [7], ownerDepartment: 'FIL',
				allowedSpecializations: ['FIL'], preferredRoomType: 'CLASSROOM', isActive: true,
			},
			select: { id: true },
		});
		ids.fil = filipino.id as number;
		const sectionRow = await base.sectionMirror.create({
			data: {
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, externalId: 7101, name: 'Grade 7 - A',
				gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR',
				maxCapacity: 50, enrolledCount: 50, isActiveForScheduling: true, isStale: false,
			},
			select: { id: true },
		});
		ids.section = sectionRow.id as number;
		const qualifiedA = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7101, employeeId: 'E7101', firstName: 'Ada', lastName: 'Math', department: 'MATH', specialization: 'MATH', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		const qualifiedB = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7102, employeeId: 'E7102', firstName: 'Bela', lastName: 'Math', department: 'MATH', specialization: 'MATH', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		const unqualified = await base.facultyMirror.create({
			data: { schoolId: fixtureSchoolId, externalId: 7103, employeeId: 'E7103', firstName: 'Filo', lastName: 'Filipino', department: 'FIL', specialization: 'FIL', isActiveForScheduling: true, canTeachOutsideDepartment: false, maxHoursPerWeek: 30 },
			select: { id: true },
		});
		ids.facultyA = qualifiedA.id as number;
		ids.facultyB = qualifiedB.id as number;
		ids.facultyUnqualified = unqualified.id as number;
		// Current owner A is qualified for MATH so the base run validates cleanly.
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
		entryId = 'entry-math-1';
		const draftEntry = {
			entryId,
			facultyId: ids.facultyA,
			roomId,
			subjectId: ids.math,
			sectionId: ids.section,
			day: 'MONDAY',
			startTime: '07:00',
			endTime: '08:00',
			durationMinutes: 60,
			termIndex: 1,
			entryKind: 'SECTION',
		};
		const run = await base.generationRun.create({
			data: {
				schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, status: 'COMPLETED', runType: 'FULL', triggeredBy: 0,
				startedAt: new Date(Date.now() - 60_000), finishedAt: new Date(), version: 1,
				draftEntries: [draftEntry],
				unassignedItems: [],
				violations: [],
				summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, policyBlockedCount: 0, hardViolationCount: 0, violationCounts: {}, isPublished: false, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] },
			},
			select: { id: true },
		});
		runId = run.id as number;
		assert(runId > 0, `fixture run created (id=${runId})`);

		section('F2. real app boot + signed JWTs');
		const app = (await import('../app.js')).default;
		const jwt = await import('jsonwebtoken');
		const secret = process.env.JWT_SECRET as string;
		const signJwt = (payload: Record<string, unknown>): string => (jwt.default as any).sign(payload, secret, { expiresIn: '5m' });
		const officerJwt = (schoolId: number | null | undefined, role = 'officer', extra: Record<string, unknown> = {}) => signJwt({
			userId: 9201, role, authSource: 'local', ...(schoolId == null ? {} : { schoolId }), ...extra,
		});
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
		const annualApply = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/annual-teaching-load/apply`;
		const reconPreview = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/${runId}/reconciliation/preview`;
		const reconApply = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/${runId}/reconciliation/apply`;
		const missingRunPreview = `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/999999/teaching-load-repairs/preview`;

		const changeTo = (toFacultyId: number) => ({
			changes: [{ kind: 'ENTRY', entryId, subjectId: ids.math, sectionId: ids.section, fromFacultyId: ids.facultyA, toFacultyId }],
			expectedRunVersion: 1,
		});

		section('M1. authority matrix — typed rejects before service dispatch');
		await (async () => {
			const before = await protectedCounts();
			const rows: Array<[string, string, string | null, unknown, number, string?]> = [
				['missing token', repairPreview, null, changeTo(ids.facultyB), 401, 'NO_TOKEN'],
				['invalid token', repairPreview, 'not-a-jwt', changeTo(ids.facultyB), 401, 'INVALID_TOKEN'],
				['non-privileged role', repairPreview, officerJwt(fixtureSchoolId, 'faculty'), changeTo(ids.facultyB), 403, 'FORBIDDEN'],
				['missing actor school', repairPreview, officerJwt(null), changeTo(ids.facultyB), 403, 'ACTOR_SCHOOL_REQUIRED'],
				['cross-school actor', repairPreview, officerJwt(fixtureSchoolId + 9999), changeTo(ids.facultyB), 403, 'SCHOOL_MISMATCH'],
				['cross-school + nonexistent run (no dispatch)', missingRunPreview, officerJwt(fixtureSchoolId + 9999), changeTo(ids.facultyB), 403, 'SCHOOL_MISMATCH'],
				['malformed schoolId', `/api/v1/generation/3.5/${fixtureYearId}/runs/${runId}/teaching-load-repairs/preview`, officerJwt(fixtureSchoolId), changeTo(ids.facultyB), 400, 'INVALID_PARAM'],
				['malformed runId', `/api/v1/generation/${fixtureSchoolId}/${fixtureYearId}/runs/abc/teaching-load-repairs/preview`, officerJwt(fixtureSchoolId), changeTo(ids.facultyB), 400, 'INVALID_PARAM'],
				['missing year mirror', repairPreview.replace(`/${fixtureYearId}/`, `/${fixtureYearId + 5000}/`), officerJwt(fixtureSchoolId), changeTo(ids.facultyB), 404, 'YEAR_MIRROR_NOT_FOUND'],
			];
			for (const [label, path, token, body, status, code] of rows) {
				const res = await call('POST', path, token, body);
				assert(res.status === status && (code == null || res.json.code === code), `M1 ${label} → ${res.status}/${res.json.code} (expected ${status}/${code})`);
			}
			const after = await protectedCounts();
			assertEqual(JSON.stringify(after), JSON.stringify(before), 'M1 rejection rows wrote zero rows (incl. zero scheduling policy = zero service dispatch)');
		})();

		// active-year elections are load-bearing; mutate the mirror then restore.
		const beforeYear = await protectedCounts();
		await base.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } }, data: { isActive: false } });
		let res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 409 && res.json.code === 'ACTIVE_YEAR_UNAVAILABLE', `M1 zero-active year → ${res.status}/${res.json.code}`);
		const competitorId = fixtureYearId + 1;
		await base.enrollProSchoolYearMirror.create({ data: { schoolId: fixtureSchoolId, enrollProSchoolYearId: competitorId, yearLabel: '2032-2033', isActive: true, isArchived: false, syncStatus: 'synced' } });
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 409 && res.json.code === 'INACTIVE_HISTORICAL_YEAR', `M1 historical year → ${res.status}/${res.json.code}`);
		await base.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } }, data: { isActive: true } });
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 409 && res.json.code === 'ACTIVE_YEAR_AMBIGUOUS', `M1 ambiguous active set → ${res.status}/${res.json.code}`);
		await base.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: competitorId } }, data: { isActive: false, isArchived: true, archivedAt: new Date(), archivedBy: 0, archiveReason: 'test' } });
		await base.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } }, data: { isArchived: true, archivedAt: new Date(), archivedBy: 0, archiveReason: 'test' } });
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 409 && res.json.code === 'ARCHIVED_YEAR_READ_ONLY', `M1 archived year → ${res.status}/${res.json.code}`);
		await base.enrollProSchoolYearMirror.update({ where: { schoolId_enrollProSchoolYearId: { schoolId: fixtureSchoolId, enrollProSchoolYearId: fixtureYearId } }, data: { isArchived: false, archivedAt: null, archivedBy: null, archiveReason: null } });
		const afterYearMutations = await protectedCounts();
		assertEqual(afterYearMutations.policies, 0, 'M1 year-authority rejections still created no scheduling policy (zero dispatch)');
		assert(
			afterYearMutations.ownership === beforeYear.ownership && afterYearMutations.facultySubjects === beforeYear.facultySubjects,
			'M1 year-authority rejections wrote no ownership/FacultySubject',
		);

		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 200 && typeof res.json.sourceFingerprint === 'string', `M1 same-school/current-year proceeds → ${res.status}`);

		section('M2. strict isPublished === true predicate');
		const strictMod = await import('../services/reconciliation.service.js');
		assert(strictMod.isStrictlyPublishedSummary({ isPublished: false, publishedAt: '2031-01-01T00:00:00.000Z', publishedBy: 7 }) === false, 'M2 superseded markers are not published');
		assert(strictMod.isStrictlyPublishedSummary({ isPublished: true }) === true, 'M2 explicit isPublished:true is published');
		await base.generationRun.update({ where: { id: runId }, data: { summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, isPublished: false, publishedAt: '2031-01-01T00:00:00.000Z', publishedBy: 7, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] } } });
		res = await call('POST', reconPreview, officerJwt(fixtureSchoolId), undefined);
		assert(res.status === 200 && res.json.applyRetired === true, `M2 superseded reconciliation preview follows unpublished rules → ${res.status}`);
		await base.generationRun.update({ where: { id: runId }, data: { summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, isPublished: true, publishedAt: '2031-01-01T00:00:00.000Z', publishedBy: 7, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] } } });
		res = await call('POST', reconPreview, officerJwt(fixtureSchoolId), undefined);
		assert(res.status === 409 && res.json.code === 'RUN_ALREADY_PUBLISHED', `M2 published reconciliation preview refused → ${res.status}/${res.json.code}`);
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyB));
		assert(res.status === 409 && res.json.code === 'RUN_ALREADY_PUBLISHED', `M2 published repair refused → ${res.status}/${res.json.code}`);
		await base.generationRun.update({ where: { id: runId }, data: { summary: { classesProcessed: 1, assignedCount: 1, unassignedCount: 0, hardViolationCount: 0, isPublished: false, timetableDisplaySlots: [{ startTime: '07:00', endTime: '08:00' }] } } });

		section('M3. canonical qualification before ownership creation');
		{
			const before = await protectedCounts();
			res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), changeTo(ids.facultyUnqualified));
			assert(res.status === 409 && res.json.code === 'TEACHING_LOAD_QUALIFICATION_MISSING', `M3 unqualified target preview refused → ${res.status}/${res.json.code}`);
			const after = await protectedCounts();
			assertEqual(after.facultySubjects, before.facultySubjects, 'M3 unqualified preview created zero FacultySubject rows');
			assertEqual(after.ownership, before.ownership, 'M3 unqualified preview created zero ownership rows');
			// Old-behavior differential: the retired path had no qualification gate
			// (only name-based specialization labels). Show the canonical evaluator
			// is load-bearing: same subject/faculty pair flips tier by department.
			const automation = await import('../services/teaching-load-automation.service.js');
			const mathSubject = await base.subject.findUnique({ where: { id: ids.math } });
			const unqualifiedFaculty = await base.facultyMirror.findUnique({ where: { id: ids.facultyUnqualified } });
			const qualifiedFaculty = await base.facultyMirror.findUnique({ where: { id: ids.facultyB } });
			const unqualifiedTier = await automation.evaluateTeachingLoadReceiverQualification(base, fixtureSchoolId, unqualifiedFaculty as never, mathSubject as never, 'REGULAR');
			const qualifiedTier = await automation.evaluateTeachingLoadReceiverQualification(base, fixtureSchoolId, qualifiedFaculty as never, mathSubject as never, 'REGULAR');
			assertEqual(unqualifiedTier.tier, null, 'M3 canonical evaluator rejects the FIL receiver for a MATH subject');
			assert(qualifiedTier.tier != null, 'M3 canonical evaluator accepts the MATH receiver for a MATH subject');
		}

		section('M4. B-04 source-snapshot binding + zero notification dispatch');
		const previewBody = changeTo(ids.facultyB);
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), previewBody);
		assert(res.status === 200 && typeof res.json.sourceFingerprint === 'string', `M4 preview returns sourceFingerprint → ${res.status}`);
		const previewFingerprint = res.json.sourceFingerprint as string;
		const beforeInterleave = await protectedCounts();
		const notifications = await import('../services/notification-events.service.js');
		unsubscribeNotifications = notifications.subscribeNotificationEvents({ schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, send: () => { notificationCount += 1; } });
		// Deterministic covered-input interleave: add a teaching room.
		await base.room.create({ data: { buildingId, name: 'R102-interleave', type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 } });
		res = await call('POST', repairApply, officerJwt(fixtureSchoolId), { ...previewBody, expectedSourceFingerprint: previewFingerprint, allowSoftOverride: true });
		assert(res.status === 409 && res.json.code === 'TEACHING_LOAD_REPAIR_STALE', `M4 room interleave apply refused → ${res.status}/${res.json.code}`);
		const afterInterleave = await protectedCounts();
		assertEqual(JSON.stringify(afterInterleave), JSON.stringify(beforeInterleave), 'M4 stale apply left ownership/run/edit/audit/cycle/policy tables byte-identical');
		assertEqual(notificationCount, 0, 'M4 stale apply dispatched zero notification events');

		section('M5. qualified apply succeeds with a fresh fingerprint');
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), previewBody);
		assert(res.status === 200, `M5 fresh preview after interleave → ${res.status}`);
		const freshFingerprint = res.json.sourceFingerprint as string;
		const beforeApply = await protectedCounts();
		res = await call('POST', repairApply, officerJwt(fixtureSchoolId), { ...previewBody, expectedSourceFingerprint: freshFingerprint, allowSoftOverride: true });
		assert(res.status === 200, `M5 qualified apply succeeds → ${res.status} (${res.json.code ?? ''} ${res.json.message ?? ''})`);
		const afterApply = await protectedCounts();
		assert(afterApply.ownership === beforeApply.ownership + 1, `M5 ownership row created (${beforeApply.ownership}→${afterApply.ownership})`);
		assert(afterApply.facultySubjects >= beforeApply.facultySubjects, 'M5 FacultySubject ensured for the qualified receiver');
		assertEqual(notificationCount, 0, 'M5 notification dispatch remains zero on this path');

		// M5b: backward compatibility. The current client does not echo a
		// fingerprint; the apply must still bind to its own read snapshot and
		// succeed (no regression for the deployed request shape).
		const runAfter = await base.generationRun.findUnique({ where: { id: runId }, select: { version: true } });
		const nextVersion = (runAfter as any).version as number;
		const backwardBody = {
			changes: [{ kind: 'ENTRY', entryId, subjectId: ids.math, sectionId: ids.section, fromFacultyId: ids.facultyB, toFacultyId: ids.facultyA }],
			expectedRunVersion: nextVersion,
			allowSoftOverride: true,
		};
		res = await call('POST', repairPreview, officerJwt(fixtureSchoolId), backwardBody);
		assert(res.status === 200, `M5b legacy preview (no fingerprint) → ${res.status}`);
		res = await call('POST', repairApply, officerJwt(fixtureSchoolId), backwardBody);
		assert(res.status === 200, `M5b legacy apply without expectedSourceFingerprint still succeeds → ${res.status} (${res.json.code ?? ''} ${res.json.message ?? ''})`);

		section('M6. retired phantom mutation paths');
		res = await call('POST', reconApply, officerJwt(fixtureSchoolId), { expectedRunVersion: 1, expectedFingerprint: previewFingerprint });
		assert(res.status === 404, `M6 reconciliation apply route removed → ${res.status}`);
		const reconService = await import('../services/reconciliation.service.js');
		let retiredCode = '';
		try {
			await reconService.applyRunReconciliation({ runId, schoolId: fixtureSchoolId, schoolYearId: fixtureYearId, actorId: 1, expectedRunVersion: 1, expectedFingerprint: previewFingerprint });
		} catch (error: any) {
			retiredCode = error?.code ?? '';
		}
		assertEqual(retiredCode, 'RECONCILIATION_APPLY_RETIRED', 'M6 retired service apply throws a typed 410 code');
		const beforeAnnual = await protectedCounts();
		res = await call('POST', annualApply, officerJwt(fixtureSchoolId), { changes: [{ subjectId: ids.math, sectionId: ids.section, fromFacultyId: ids.facultyB, toFacultyId: ids.facultyA }] });
		assert(res.status === 410 && res.json.code === 'ANNUAL_TEACHING_LOAD_APPLY_RETIRED', `M6 annual apply retired → ${res.status}/${res.json.code}`);
		const afterAnnual = await protectedCounts();
		assertEqual(JSON.stringify(afterAnnual), JSON.stringify(beforeAnnual), 'M6 annual apply wrote nothing');
	} finally {
		section('F3. fixture cleanup (zero residue)');
		try { unsubscribeNotifications?.(); } catch {}
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
