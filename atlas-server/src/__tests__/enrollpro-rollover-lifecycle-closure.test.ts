/**
 * RR-15: Rollover recovery lifecycle closure.
 *
 * Hermetic proofs (disposable sandbox schools + fake EnrollPro only   the
 * live Tailnet school is never mutated):
 *  1. Test-data recovery is service-complete: cleanup + sync + Teaching Load
 *     cycle + superseded-year archive all commit before the service returns;
 *     no route-level repair exists and no post-sync cycle deletion happens.
 *  2. Superseded-year archival is part of recovery; partial success surfaces
 *     when archival fails and a retry completes it without re-running the
 *     destructive cleanup or the sync.
 *  3. Mark-test-data is truthful (404 without a mirror; idempotent re-mark);
 *     recovery scaffolding is a separate privileged, idempotent operation.
 *  4. Actor attribution flows through every user-triggered audit; automation
 *     audits use actor 0 / initiatedBy system.
 *  5. The clean `atlas-stale` automation branch is proven through the real
 *     automation tick against a hermetic fixture (ATLAS 100 -> EnrollPro 101).
 *  6. Interruption points: cleanup failure, sync failure, archive failure,
 *     and post-return durability all behave transactionally.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { prisma } from '../lib/prisma.js';
import {
	applyTestYearRecovery,
	previewRolloverSync,
	previewTestYearRecovery,
	scaffoldTestYearRecoveryMirror,
} from '../services/enrollpro-rollover.service.js';
import {
	markSchoolYearAsTestData,
	resetAutomationState,
	tickRolloverAutomation,
} from '../services/rollover-automation.service.js';
import {
	subscribeNotificationEvents,
	type NotificationEvent,
} from '../services/notification-events.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n  ${name}  `);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`    ${label}`);
		return;
	}
	failCount += 1;
	console.error(`    ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	assert(actual === expected, `${label}   expected ${String(expected)}, got ${String(actual)}`);
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
	const body = JSON.stringify(payload);
	res.writeHead(statusCode, {
		'content-type': 'application/json',
		'content-length': Buffer.byteLength(body),
	});
	res.end(body);
}

async function startAndGetUrl(server: Server): Promise<string> {
	await new Promise<void>((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => resolve());
	});
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No TCP port');
	return `http://127.0.0.1:${address.port}/api`;
}

async function stopServer(server: Server) {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => error ? reject(error) : resolve());
	});
}

//   Fake EnrollPro with write tracking and phase-failure levers

type FakeOptions = {
	activeYearId: number;
	activeYearLabel: string;
	sectionRows: Array<{ id: number; name: string }>;
	facultyRow?: { teacherId: number; employeeId: string; fullName: string };
	/** Fail /school-year after this many successful calls (0 = never). */
	schoolYearFailAfter?: number;
	/** Fail /health after this many successful calls (0 = never). */
	healthFailAfter?: number;
};

function startFakeEnrollPro(options: FakeOptions): { server: Server; methods: string[]; paths: string[] } {
	const methods: string[] = [];
	const paths: string[] = [];
	let schoolYearCalls = 0;
	let healthCalls = 0;
	const server = createServer((req: IncomingMessage, res: ServerResponse) => {
		methods.push(req.method ?? '');
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		paths.push(url.pathname);
		if (url.pathname === '/api/integration/v1/health') {
			healthCalls += 1;
			if (options.healthFailAfter != null && options.healthFailAfter > 0 && healthCalls > options.healthFailAfter) {
				sendJson(res, 503, { error: 'simulated archive-phase failure' });
				return;
			}
			sendJson(res, 200, { status: 'ok', service: 'enrollpro' });
			return;
		}
		if (url.pathname === '/api/integration/v1/school-year') {
			schoolYearCalls += 1;
			if (options.schoolYearFailAfter != null && options.schoolYearFailAfter > 0 && schoolYearCalls > options.schoolYearFailAfter) {
				sendJson(res, 500, { error: 'simulated sync-phase failure' });
				return;
			}
			sendJson(res, 200, { data: { id: options.activeYearId, yearLabel: options.activeYearLabel } });
			return;
		}
		if (url.pathname === '/api/integration/v1/sections') {
			sendJson(res, 200, {
				data: options.sectionRows.map((row) => ({
					id: row.id,
					name: row.name,
					maxCapacity: 45,
					enrolledCount: 30,
					programType: 'REGULAR',
					gradeLevel: { id: 7, name: 'Grade 7', displayOrder: 7 },
				})),
				meta: { page: 1, limit: 200, totalPages: 1 },
			});
			return;
		}
		if (url.pathname === '/api/integration/v1/faculty' || url.pathname === '/api/integration/v1/default/faculty') {
			const faculty = options.facultyRow ?? { teacherId: 424001, employeeId: '4240001', fullName: 'Fixture Teacher' };
			sendJson(res, 200, {
				data: [{
					teacherId: faculty.teacherId,
					employeeId: faculty.employeeId,
					firstName: 'Fixture',
					lastName: 'Teacher',
					fullName: faculty.fullName,
					departmentCode: 'MATH',
					departmentName: 'Mathematics',
					specialization: 'Mathematics',
					isActive: true,
					isTeachingExempt: false,
				}],
				meta: { page: 1, limit: 200, totalPages: 1 },
			});
			return;
		}
		if (url.pathname === '/api/settings/public') {
			sendJson(res, 200, { schoolName: 'RR15 Sandbox', activeSchoolYearId: options.activeYearId, activeSchoolYearLabel: options.activeYearLabel });
			return;
		}
		sendJson(res, 404, { error: 'not found' });
	});
	return { server, methods, paths };
}

async function withFakeEnrollPro<T>(
	options: FakeOptions,
	fn: (ctx: { methods: () => string[]; paths: () => string[] }) => Promise<T>,
): Promise<T> {
	const { server, methods, paths } = startFakeEnrollPro(options);
	const baseUrl = await startAndGetUrl(server);
	const origApi = process.env.ENROLLPRO_API;
	try {
		process.env.ENROLLPRO_API = baseUrl;
		return await fn({ methods: () => methods.slice(), paths: () => paths.slice() });
	} finally {
		if (origApi === undefined) delete process.env.ENROLLPRO_API;
		else process.env.ENROLLPRO_API = origApi;
		await stopServer(server);
	}
}

function countPath(entries: string[], pathname: string): number {
	return entries.filter((entry) => entry === pathname).length;
}

async function expectServiceError(action: () => Promise<unknown>, expectedCode: string, label: string): Promise<number> {
	try {
		await action();
		assert(false, `${label}   expected ${expectedCode}, got success`);
		return 0;
	} catch (error) {
		const err = error as { code?: string; statusCode?: number };
		assertEqual(err.code, expectedCode, `${label} (code)`);
		return err.statusCode ?? 0;
	}
}

//   Sandbox school helpers

const SANDBOX_SCHOOL_NAMES = [
	'RR15 Lifecycle Closure Sandbox',
	'RR15 Interruption Sandbox',
	'RR15 Archive Failure Sandbox',
	'RR15 Clean Automation Sandbox',
	'RR15 State Mismatch Sandbox',
	'RR15 Audit Control Sandbox',
];

async function cleanupSandboxSchool(schoolId: number) {
	const runIds = (await prisma.generationRun.findMany({ where: { schoolId }, select: { id: true } })).map((run) => run.id);
	if (runIds.length > 0) {
		await prisma.manualScheduleEdit.deleteMany({ where: { runId: { in: runIds } } });
		await prisma.followUpFlag.deleteMany({ where: { runId: { in: runIds } } });
	}
	await prisma.generationRun.deleteMany({ where: { schoolId } });
	await prisma.facultySnapshot.deleteMany({ where: { schoolId } });
	await prisma.sectionSnapshot.deleteMany({ where: { schoolId } });
	await prisma.schedulingPolicy.deleteMany({ where: { schoolId } });
	await prisma.teachingLoadCycle.deleteMany({ where: { schoolId } });
	await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } });
	await prisma.facultySubject.deleteMany({ where: { schoolId } });
	await prisma.classProgramSlot.deleteMany({ where: { schoolId } });
	await prisma.auditLog.deleteMany({ where: { schoolId } });
	await prisma.sectionMirror.deleteMany({ where: { schoolId } });
	await prisma.facultyMirror.deleteMany({ where: { schoolId } });
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } });
	await prisma.school.deleteMany({ where: { id: schoolId } });
}

async function cleanupAllSandboxes() {
	for (const name of SANDBOX_SCHOOL_NAMES) {
		const existing = await prisma.school.findFirst({ where: { name }, select: { id: true } });
		if (existing) await cleanupSandboxSchool(existing.id);
	}
}

type FixtureSetup = {
	schoolId: number;
	oldYearId: number;
	oldYearLabel: string;
	newYearId: number;
	newYearLabel: string;
	oldSectionExternalIds: number[];
	legacySectionExternalIds: number[];
	feedSectionExternalIds: number[];
};

/**
 * Legacy-fixture shape: the OLD year is the active ATLAS year with preserved
 * history; the NEW (EnrollPro active) year has ATLAS artifacts but NO year
 * mirror (the shape that made the old marking operation silently no-op).
 */
async function setupRecoveryFixture(
	sandboxName: string,
	oldYearId: number,
	oldYearLabel: string,
	newYearId: number,
	newYearLabel: string,
	actorId: number,
): Promise<FixtureSetup> {
	const existing = await prisma.school.findFirst({ where: { name: sandboxName }, select: { id: true } });
	if (existing) await cleanupSandboxSchool(existing.id);
	const school = await prisma.school.create({
		data: { name: sandboxName, shortName: 'RR15 Sandbox' },
		select: { id: true },
	});
	const oldSections = [oldYearId * 100 + 1, oldYearId * 100 + 2];
	const legacySections = [newYearId * 1000 + 1, newYearId * 1000 + 2];
	const feedSections = [newYearId * 100 + 1, newYearId * 100 + 2];

	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId: school.id,
			enrollProSchoolYearId: oldYearId,
			yearLabel: oldYearLabel,
			isActive: true,
			syncStatus: 'setup-review-required',
			lastSyncedAt: new Date(),
		},
	});
	await prisma.sectionMirror.createMany({
		data: oldSections.map((externalId) => ({
			schoolId: school.id, schoolYearId: oldYearId, externalId, name: `RR15 Old ${externalId}`,
			gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 30,
		})),
	});
	await prisma.schedulingPolicy.create({ data: { schoolId: school.id, schoolYearId: oldYearId } });
	await prisma.generationRun.create({
		data: {
			schoolId: school.id,
			schoolYearId: oldYearId,
			status: 'COMPLETED',
			triggeredBy: actorId,
			summary: { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: actorId, assignedCount: 12 },
			draftEntries: [{ entryId: 'e1', day: 'MON', startTime: '07:30', endTime: '08:30', sectionId: oldSections[0], subjectId: 1, roomId: 1 }],
		},
	});

	// New year: legacy fixture artifacts, NO mirror.
	await prisma.sectionMirror.createMany({
		data: legacySections.map((externalId) => ({
			schoolId: school.id, schoolYearId: newYearId, externalId, name: `RR15 Legacy ${externalId}`,
			gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 30,
		})),
	});
	await prisma.schedulingPolicy.create({ data: { schoolId: school.id, schoolYearId: newYearId } });
	await prisma.sectionSnapshot.create({
		data: {
			schoolId: school.id,
			schoolYearId: newYearId,
			payload: { count: legacySections.length, fixture: true },
			source: 'enrollpro',
		},
	});

	return {
		schoolId: school.id,
		oldYearId,
		oldYearLabel,
		newYearId,
		newYearLabel,
		oldSectionExternalIds: oldSections,
		legacySectionExternalIds: legacySections,
		feedSectionExternalIds: feedSections,
	};
}

function fixtureFakeOptions(fixture: FixtureSetup, extra?: Partial<FakeOptions>): FakeOptions {
	const teacherId = fixture.newYearId * 10 + 1;
	return {
		activeYearId: fixture.newYearId,
		activeYearLabel: fixture.newYearLabel,
		sectionRows: fixture.feedSectionExternalIds.map((id) => ({ id, name: `RR15 Feed ${id}` })),
		facultyRow: { teacherId, employeeId: String(teacherId), fullName: 'RR15 Teacher' },
		...extra,
	};
}

async function yearArtifactState(schoolId: number, schoolYearId: number) {
	return {
		sections: await prisma.sectionMirror.count({ where: { schoolId, schoolYearId } }),
		runs: await prisma.generationRun.count({ where: { schoolId, schoolYearId } }),
		policies: await prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId } }),
		cycles: await prisma.teachingLoadCycle.count({ where: { schoolId, schoolYearId } }),
		ownerships: await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId } }),
		facultySubjects: await prisma.facultySubject.count({ where: { schoolId, schoolYearId } }),
	};
}

async function findMirror(schoolId: number, schoolYearId: number) {
	return prisma.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
	});
}

async function subscribeToEvents(schoolId: number, yearIds: number[], events: Array<Record<string, unknown>>): Promise<() => void> {
	const unsubscribers = yearIds.map((schoolYearId) => subscribeNotificationEvents({
		schoolId,
		schoolYearId,
		facultyId: null,
		send: (event: NotificationEvent) => { events.push(event as unknown as Record<string, unknown>); },
	}));
	return () => { for (const unsub of unsubscribers) unsub(); };
}

//   Tests

async function runMarkAndScaffoldTruthfulness() {
	section('RR-15C: marking without a mirror returns 404 and writes no audit');
	{
		const ACTOR = 424242;
		const fixture = await setupRecoveryFixture('RR15 Lifecycle Closure Sandbox', 899001, '2098-2099', 899002, '2099-2100', ACTOR);
		try {
			// 1) Mark before scaffold: no mirror exists -> typed 404, no audit.
			const status = await expectServiceError(
				() => markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR),
				'SCHOOL_YEAR_MIRROR_NOT_FOUND',
				'Marking a year without a mirror throws SCHOOL_YEAR_MIRROR_NOT_FOUND',
			);
			assertEqual(status, 404, 'Missing-mirror marking is a typed 404');
			const markAudits = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_DATA_MARKED' },
			});
			assertEqual(markAudits, 0, 'No TEST_DATA_MARKED audit is written on failure');

			// 2) Scaffold against a non-active EnrollPro year is rejected.
			const mismatchStatus = await expectServiceError(
				() => withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({
					schoolId: fixture.schoolId,
					schoolYearId: 899999,
					actorId: ACTOR,
				})),
				'ACTIVE_YEAR_MISMATCH',
				'Scaffolding a non-active year is rejected',
			);
			assertEqual(mismatchStatus, 409, 'Non-active scaffold is a typed 409');
			const mirrorAfterMismatch = await findMirror(fixture.schoolId, fixture.newYearId);
			assert(mirrorAfterMismatch === null, 'No mirror created by the rejected scaffold');
			const scaffoldAudits = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
			});
			assertEqual(scaffoldAudits, 0, 'No scaffold audit is written on rejection');

			// 3) Scaffold the ACTIVE year.
			const scaffolded = await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({
				schoolId: fixture.schoolId,
				actorId: ACTOR,
			}));
			assertEqual(scaffolded.alreadyScaffolded, false, 'First scaffold creates the mirror');
			const mirror = await findMirror(fixture.schoolId, fixture.newYearId);
			assert(mirror !== null, 'Mirror row exists after scaffold');
			assertEqual(mirror?.isActive, false, 'Scaffold mirror is inactive');
			assertEqual(mirror?.isArchived, false, 'Scaffold mirror is not archived');
			assertEqual(mirror?.yearLabel, fixture.newYearLabel, 'Scaffold mirror carries the upstream label');
			assertEqual(mirror?.syncStatus, 'recovery-pending', 'Scaffold mirror uses the recovery-specific pending status');
			const scaffoldMetadata = mirror?.lastSyncMetadata as Record<string, unknown> | null;
			assertEqual(scaffoldMetadata?.scaffoldedForTestDataRecovery, true, 'Scaffold metadata is recorded');
			const scaffoldAuditCount = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
			});
			assertEqual(scaffoldAuditCount, 1, 'Exactly one scaffold audit written');
			const scaffoldAudit = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
				select: { actorId: true },
			});
			assertEqual(scaffoldAudit?.actorId, ACTOR, 'Scaffold audit records the authenticated actor');

			// 4) Idempotent second scaffold: no duplicate mirror or audit.
			const rescaffolded = await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({
				schoolId: fixture.schoolId,
				actorId: ACTOR,
			}));
			assertEqual(rescaffolded.alreadyScaffolded, true, 'Repeat scaffold reports alreadyScaffolded');
			const scaffoldAuditCountAfter = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
			});
			assertEqual(scaffoldAuditCountAfter, 1, 'Repeat scaffold does not duplicate the audit');

			// 5) Mark now succeeds with actor attribution; re-mark is idempotent.
			const marked = await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);
			assertEqual(marked.marked, true, 'Mark succeeds once the mirror exists');
			assertEqual(marked.alreadyMarked, false, 'First mark is not an idempotent repeat');
			const markedMirror = await findMirror(fixture.schoolId, fixture.newYearId);
			const markedMetadata = markedMirror?.lastSyncMetadata as Record<string, unknown> | null;
			assertEqual(markedMetadata?.testDataMarked, true, 'Mirror metadata carries testDataMarked');
			assertEqual(markedMetadata?.testDataMarkedBy, ACTOR, 'Mirror metadata records the marking actor');
			const markedAudit = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_DATA_MARKED' },
				select: { actorId: true },
			});
			assertEqual(markedAudit?.actorId, ACTOR, 'TEST_DATA_MARKED audit records the authenticated actor');

			const remark = await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);
			assertEqual(remark.alreadyMarked, true, 'Repeated marking is idempotent');
			const markAuditCount = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'TEST_DATA_MARKED' },
			});
			assertEqual(markAuditCount, 1, 'Repeated marking does not produce duplicate audits');

			// 6) Classification now offers recovery.
			const preview = await withFakeEnrollPro(fixtureFakeOptions(fixture), () => previewTestYearRecovery(fixture.schoolId));
			assertEqual(preview.classification, 'TEST_DATA_RECOVERY_AVAILABLE', 'Marked fixture classifies as TEST_DATA_RECOVERY_AVAILABLE');
			assertEqual(preview.confirmationText, `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`, 'Confirmation phrase targets year 899002');
		} finally {
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Lifecycle Closure Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function runFullRecoveryLifecycle() {
	section('RR-15 recovery is service-complete: cycle exists, year archived, actor attributed, no route repair');
	{
		const ACTOR = 424242;
		const fixture = await setupRecoveryFixture('RR15 Lifecycle Closure Sandbox', 899001, '2098-2099', 899002, '2099-2100', ACTOR);
		const events: Array<Record<string, unknown>> = [];
		let unsubscribe = () => {};
		try {
			// Subscribe BEFORE scaffold/mark so the marked + scaffolded events
			// are part of the notification-sequence proof.
			unsubscribe = await subscribeToEvents(fixture.schoolId, [fixture.oldYearId, fixture.newYearId], events);
			await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: ACTOR }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);

			const oldStateBefore = await yearArtifactState(fixture.schoolId, fixture.oldYearId);
			const oldPublishedRunBefore = await prisma.generationRun.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.oldYearId },
				select: { id: true, summary: true },
			});

			// RR-15A audit-preservation pre-captures: scaffold + marking chain,
			// plus a control audit on an unrelated school that must stay intact.
			const scaffoldAuditBefore = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
				select: { id: true, actorId: true, createdAt: true },
			});
			const markAuditBefore = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_DATA_MARKED' },
				select: { id: true, actorId: true, createdAt: true },
			});
			const controlSchool = await prisma.school.create({
				data: { name: 'RR15 Audit Control Sandbox', shortName: 'RR15 Ctrl' },
				select: { id: true },
			});
			const controlAudit = await prisma.auditLog.create({
				data: {
					schoolId: controlSchool.id,
					schoolYearId: 99,
					action: 'CONTROL_AUDIT',
					actorId: 7,
					targetIds: [99],
					metadata: { marker: 'unrelated-control' },
				},
				select: { id: true, actorId: true },
			});

			const result = await withFakeEnrollPro(fixtureFakeOptions(fixture), () => applyTestYearRecovery({
				schoolId: fixture.schoolId,
				actorId: ACTOR,
				confirmClear: true,
				confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
				acknowledgePublished: false,
			}));

			assertEqual(result.cleared, true, 'Recovery cleared the target-year artifacts');
			assertEqual(result.partialSuccess, false, 'Full lifecycle completes without partial success');
			assertEqual(result.resumePath, 'fresh', 'First run executes the fresh path');
			assertEqual(result.sync?.drift.status, 'aligned', 'Drift is aligned after recovery');
			assertEqual(result.sync?.enrollProActiveYear?.id, fixture.newYearId, 'Sync resolves the EnrollPro active year');
			assertEqual(result.sync?.sync?.sections?.count, 2, 'Sync reports the upstream section count');
			assertEqual(result.previousActiveSchoolYearId, fixture.oldYearId, 'Result identifies the previously active year');

			// Teaching Load cycle: exactly one EMPTY cycle, present BEFORE the service returns.
			assert(result.teachingLoadCycle !== null, 'Service returns the Teaching Load cycle');
			assertEqual(result.teachingLoadCycle?.state, 'EMPTY', 'Cycle state is EMPTY');
			assertEqual(result.teachingLoadCycle?.version, 1, 'Cycle version is 1');
			const cycles = await prisma.teachingLoadCycle.findMany({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(cycles.length, 1, 'Exactly one target-year TeachingLoadCycle exists after the service returns');
			assertEqual(cycles[0]?.state, 'EMPTY', 'Persisted cycle state is EMPTY');
			assertEqual(cycles[0]?.version, 1, 'Persisted cycle version is 1');
			assert(cycles[0]?.initializedAt != null, 'Cycle carries its initialization timestamp');
			const ownershipCount = await prisma.subjectSectionOwnership.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(ownershipCount, 0, 'No Teaching Load assignments are copied');

			// Superseded-year archive.
			assertEqual(result.archivedYears.length, 1, 'Recovery archives exactly one superseded year');
			assertEqual(result.archivedYears[0]?.schoolYearId, fixture.oldYearId, 'The superseded year is the previously active year');
			const oldMirror = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirror?.isArchived, true, 'Superseded year is archived');
			assertEqual(oldMirror?.isActive, false, 'Superseded year is deactivated');
			assertEqual(oldMirror?.archivedBy, ACTOR, 'Archive audit records the authenticated actor');
			assert(oldMirror?.archivedAt != null, 'Archive timestamp recorded');
			assert(String(oldMirror?.archiveReason ?? '').includes('test-data recovery rollover'), 'Archive reason is explicit');
			const newMirror = await findMirror(fixture.schoolId, fixture.newYearId);
			assertEqual(newMirror?.isActive, true, 'EnrollPro active year is the sole active mirror');
			assertEqual(newMirror?.isArchived, false, 'The EnrollPro active year is never archived');

			// Old-year history preserved.
			const oldStateAfter = await yearArtifactState(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldStateAfter.sections, oldStateBefore.sections, 'Old-year sections preserved');
			assertEqual(oldStateAfter.runs, oldStateBefore.runs, 'Old-year generation runs preserved');
			assertEqual(oldStateAfter.policies, oldStateBefore.policies, 'Old-year policies preserved');
			const oldPublishedRunAfter = await prisma.generationRun.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.oldYearId },
				select: { id: true, summary: true },
			});
			assertEqual(oldPublishedRunAfter?.id, oldPublishedRunBefore?.id, 'Old-year published run row preserved');
			assertEqual(
				JSON.stringify(oldPublishedRunAfter?.summary),
				JSON.stringify(oldPublishedRunBefore?.summary),
				'Old-year published run summary unchanged',
			);

			// Target-year artifacts now match the upstream set.
			const newSections = await prisma.sectionMirror.findMany({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId },
				orderBy: { externalId: 'asc' },
				select: { externalId: true },
			});
			assertEqual(newSections.length, 2, 'Target year holds exactly the upstream section set');
			assertEqual(
				JSON.stringify(newSections.map((s) => s.externalId)),
				JSON.stringify(fixture.feedSectionExternalIds),
				'Target-year section external IDs match the feed',
			);
			const newPolicyCount = await prisma.schedulingPolicy.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(newPolicyCount, 1, 'Policy initialized for the target year');

			// Actor attribution on every user-triggered audit.
			const cleanupAudit = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { actorId: true, metadata: true },
			});
			assertEqual(cleanupAudit?.actorId, ACTOR, 'Cleanup audit records the authenticated actor');
			const syncAudit = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'ROLLOVER_SYNC_APPLIED' },
				select: { actorId: true, metadata: true },
			});
			assertEqual(syncAudit?.actorId, ACTOR, 'Rollover sync audit records the authenticated actor');
			const syncMetadata = syncAudit?.metadata as Record<string, unknown> | null;
			assertEqual(syncMetadata?.initiatedBy, 'user', 'Sync audit initiatedBy is user');
			const phases = (cleanupAudit?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phases?.cleared, true, 'Phase marker cleared=true');
			assertEqual(phases?.syncApplied, true, 'Phase marker syncApplied=true');
			assertEqual(phases?.archivesApplied, true, 'Phase marker archivesApplied=true');

			// Notification sequence: marked -> scaffolded -> TL changed -> archived -> completed.
			const types = events.map((event) => String(event.type));
			assert(types.includes('TEST_DATA_YEAR_MARKED'), 'TEST_DATA_YEAR_MARKED notification published');
			assert(types.includes('TEST_YEAR_RECOVERY_MIRROR_SCAFFOLDED'), 'TEST_YEAR_RECOVERY_MIRROR_SCAFFOLDED notification published');
			assert(types.includes('SCHOOL_YEAR_ARCHIVED'), 'SCHOOL_YEAR_ARCHIVED notification published');
			assert(types.includes('TEACHING_LOAD_CHANGED'), 'TEACHING_LOAD_CHANGED notification published');
			const completed = events.find((event) => event.type === 'TEST_YEAR_RECOVERY_COMPLETED') as Record<string, unknown> | undefined;
			assert(completed != null, 'TEST_YEAR_RECOVERY_COMPLETED notification published');
			const completedMetadata = completed?.metadata as Record<string, unknown> | undefined;
			assertEqual((completedMetadata?.archivedYears as Array<{ schoolYearId: number }> | undefined)?.[0]?.schoolYearId, fixture.oldYearId, 'Completion event names the archived year');
			assertEqual(completedMetadata?.previousActiveSchoolYearId, fixture.oldYearId, 'Completion event carries the previous year ID');
			const tlChanged = events.find((event) => event.type === 'TEACHING_LOAD_CHANGED') as Record<string, unknown> | undefined;
			const tlMetadata = tlChanged?.metadata as Record<string, unknown> | undefined;
			assertEqual(tlMetadata?.state, 'EMPTY', 'TEACHING_LOAD_CHANGED reports state EMPTY');
			assertEqual(tlMetadata?.version, 1, 'TEACHING_LOAD_CHANGED reports version 1');
			assertEqual(tlMetadata?.actorId, ACTOR, 'TEACHING_LOAD_CHANGED metadata carries the actor');
			assertEqual(types.filter((type) => type === 'TEACHING_LOAD_CHANGED').length, 1, 'Exactly one TEACHING_LOAD_CHANGED (no route-level duplicate)');

			// RR-15A: cleanup preserves the authorization and provenance chain.
			const scaffoldAuditAfter = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'RECOVERY_YEAR_MIRROR_SCAFFOLDED' },
				select: { id: true, actorId: true, createdAt: true },
			});
			assert(scaffoldAuditAfter !== null, 'Scaffold audit still exists after cleanup');
			assertEqual(scaffoldAuditAfter?.id, scaffoldAuditBefore?.id, 'Scaffold audit row id unchanged');
			assertEqual(scaffoldAuditAfter?.actorId, scaffoldAuditBefore?.actorId, 'Scaffold audit actor unchanged');
			assertEqual(scaffoldAuditAfter?.createdAt?.toISOString(), scaffoldAuditBefore?.createdAt?.toISOString(), 'Scaffold audit timestamp unchanged');
			const markAuditAfter = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_DATA_MARKED' },
				select: { id: true, actorId: true, createdAt: true },
			});
			assert(markAuditAfter !== null, 'Test-data marking audit still exists after cleanup');
			assertEqual(markAuditAfter?.id, markAuditBefore?.id, 'Marking audit row id unchanged');
			assertEqual(markAuditAfter?.actorId, markAuditBefore?.actorId, 'Marking audit actor unchanged');
			assertEqual(markAuditAfter?.createdAt?.toISOString(), markAuditBefore?.createdAt?.toISOString(), 'Marking audit timestamp unchanged');
			const cleanupAuditPreserved = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
			});
			assert(cleanupAuditPreserved >= 1, 'Cleanup marker audit exists');
			const cleanupMarker = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { metadata: true },
			});
			const preservation = (cleanupMarker?.metadata as Record<string, unknown> | null)?.auditPreservation as Record<string, unknown> | undefined;
			assertEqual(preservation?.preserved, true, 'Cleanup marker records audit preservation');
			assert(Number(preservation?.preservedAuditLogCount) >= 2, `Cleanup marker records preserved audit count (got ${Number(preservation?.preservedAuditLogCount)})`);
			assert(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'ROLLOVER_SYNC_APPLIED' } }) >= 1, 'Sync audit exists');
			assert(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.oldYearId, action: 'ARCHIVE_SCHOOL_YEAR' } }) >= 1, 'Archive audit exists');
			const controlAuditAfter = await prisma.auditLog.findUnique({
				where: { id: controlAudit.id },
				select: { id: true, actorId: true, schoolId: true },
			});
			assertEqual(controlAuditAfter?.id, controlAudit.id, 'Unrelated school audit unchanged (id)');
			assertEqual(controlAuditAfter?.actorId, 7, 'Unrelated school audit unchanged (actor)');
			assertEqual(controlAuditAfter?.schoolId, controlSchool.id, 'Unrelated school audit unchanged (school)');
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: controlSchool.id } }),
				1,
				'Unrelated school audit count unchanged',
			);
		} finally {
			const controlSchool = await prisma.school.findFirst({ where: { name: 'RR15 Audit Control Sandbox' }, select: { id: true } });
			if (controlSchool) {
				await prisma.auditLog.deleteMany({ where: { schoolId: controlSchool.id } });
				await prisma.school.deleteMany({ where: { id: controlSchool.id } });
			}
			unsubscribe();
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Lifecycle Closure Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function runResumedSyncStateMismatch() {
	section('RR-15A: resumed-after-sync state mismatch returns typed errors and never reruns sync');
	{
		const ACTOR = 424245;
		const fixture = await setupRecoveryFixture('RR15 State Mismatch Sandbox', 899301, '2098-2099', 899302, '2099-2100', ACTOR);
		try {
			await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: ACTOR }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);

			// Run 1: partial success   sync commits, archive fails (health #4).
			const result1 = await withFakeEnrollPro(
				fixtureFakeOptions(fixture, { healthFailAfter: 3 }),
				() => applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
				}),
			);
			assertEqual(result1.partialSuccess, true, 'Run 1 is partial (archive failed)');
			const markerId1 = (await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true },
			}))?.id;
			const syncAuditsBefore = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			assertEqual(syncAuditsBefore, 1, 'One sync executed in run 1');

			const resumeAttempt = <T,>(action: () => Promise<T>): Promise<T> => withFakeEnrollPro(fixtureFakeOptions(fixture), action);

			// Tamper 1: the active target mirror disappears. The resume must
			// fail with a typed RECOVERY_STATE_MISMATCH and NOT re-sync.
			await prisma.enrollProSchoolYearMirror.update({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.newYearId } },
				data: { isActive: false },
			});
			await expectServiceError(
				() => resumeAttempt(() => applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
				})),
				'RECOVERY_STATE_MISMATCH',
				'Missing active target mirror surfaces RECOVERY_STATE_MISMATCH',
			);
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' } }),
				syncAuditsBefore,
				'Missing active target mirror does not trigger a re-sync',
			);
			const oldMirrorTamper1 = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirrorTamper1?.isArchived, false, 'Missing-mirror mismatch does not trigger archive');
			await prisma.enrollProSchoolYearMirror.update({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.newYearId } },
				data: { isActive: true },
			});

			// Tamper 2: the Teaching Load cycle disappears.
			await prisma.teachingLoadCycle.deleteMany({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			await expectServiceError(
				() => resumeAttempt(() => applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
				})),
				'RECOVERY_STATE_MISMATCH',
				'Missing TeachingLoadCycle surfaces RECOVERY_STATE_MISMATCH',
			);
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' } }),
				syncAuditsBefore,
				'Missing cycle does not trigger a re-sync',
			);
			await prisma.teachingLoadCycle.create({
				data: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, state: 'EMPTY' },
			});

			// Healthy resume completes archival only.
			const result2 = await resumeAttempt(() => applyTestYearRecovery({
				schoolId: fixture.schoolId,
				actorId: ACTOR,
				confirmClear: true,
				confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
				acknowledgePublished: false,
			}));
			assertEqual(result2.resumePath, 'resumed-after-sync', 'Healthy resume reports resumed-after-sync');
			assertEqual(result2.syncExecuted, false, 'Healthy resume executes no synchronization');
			assertEqual(result2.archiveFailed, false, 'Healthy resume completes archival');
			const oldMirrorFinal = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirrorFinal?.isArchived, true, 'Superseded year archived by the healthy resume');
			const markerFinal = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true, metadata: true },
			});
			assertEqual(markerFinal?.id, markerId1, 'Marker id unchanged through mismatch attempts and resume');
			const phasesFinal = (markerFinal?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phasesFinal?.archivesApplied, true, 'Marker archivesApplied=true after the healthy resume');
		} finally {
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 State Mismatch Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function runCleanupAndSyncInterruptions() {
	section('RR-15 interruption: cleanup failure rolls back atomically');
	{
		const ACTOR = 424243;
		const fixture = await setupRecoveryFixture('RR15 Interruption Sandbox', 899101, '2098-2099', 899102, '2099-2100', ACTOR);
		const events: Array<Record<string, unknown>> = [];
		let unsubscribe = () => {};
		try {
			await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: ACTOR }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);
			unsubscribe = await subscribeToEvents(fixture.schoolId, [fixture.oldYearId, fixture.newYearId], events);

			const before = await yearArtifactState(fixture.schoolId, fixture.newYearId);
			await expectServiceError(
				() => withFakeEnrollPro(fixtureFakeOptions(fixture), () => applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
					failCleanupTxForTest: true,
				})),
				'TEST_YEAR_CLEANUP_SIMULATED',
				'Cleanup failure surfaces as a typed service error',
			);

			const after = await yearArtifactState(fixture.schoolId, fixture.newYearId);
			assertEqual(after.sections, before.sections, 'No partial target-year deletion (sections)');
			assertEqual(after.policies, before.policies, 'No partial target-year deletion (policies)');
			const mirror = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(mirror?.isActive, true, 'Previous active year remains active');
			assertEqual(mirror?.isArchived, false, 'Previous active year is not archived');
			const cleanupAudits = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
			});
			assertEqual(cleanupAudits, 0, 'No recovery marker committed on cleanup failure');
			const syncAppliedAudits = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			assertEqual(syncAppliedAudits, 0, 'No synchronization ran after the failed cleanup');
			const eventTypes = events.map((event) => String(event.type));
			assert(!eventTypes.includes('TEST_YEAR_RECOVERY_COMPLETED'), 'No success notification on cleanup failure');
			assert(eventTypes.includes('TEST_YEAR_RECOVERY_FAILED'), 'Failure notification published on cleanup failure');
		} finally {
			unsubscribe();
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Interruption Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}

	section('RR-15 interruption: sync failure after cleanup leaves durable failure state; retry resumes after clear');
	{
		const ACTOR = 424243;
		const fixture = await setupRecoveryFixture('RR15 Interruption Sandbox', 899101, '2098-2099', 899102, '2099-2100', ACTOR);
		const events: Array<Record<string, unknown>> = [];
		let unsubscribe = () => {};
		try {
			await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: ACTOR }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);
			unsubscribe = await subscribeToEvents(fixture.schoolId, [fixture.oldYearId, fixture.newYearId], events);

			// Run 1: the cheap active-year gate (call 1) and the recovery
			// preview (call 2) succeed; the sync's internal preview (call 3+)
			// fails   cleanup has already committed by then.
			const run1Status = await withFakeEnrollPro(
				fixtureFakeOptions(fixture, { schoolYearFailAfter: 2 }),
				() => expectServiceError(
					() => applyTestYearRecovery({
						schoolId: fixture.schoolId,
						actorId: ACTOR,
						confirmClear: true,
						confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
						acknowledgePublished: false,
					}),
					'ENROLLPRO_UNAVAILABLE',
					'Sync-phase failure surfaces as ENROLLPRO_UNAVAILABLE',
				),
			);
			assert(run1Status >= 500, `Sync failure is 5xx-able for the route (got ${run1Status})`);

			const marker1 = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				orderBy: { id: 'desc' },
				select: { id: true, metadata: true, actorId: true },
			});
			assert(marker1 !== null, 'Durable cleanup marker exists after the sync failure');
			assertEqual(marker1?.actorId, ACTOR, 'Marker audit records the actor');
			const phases1 = (marker1?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phases1?.cleared, true, 'Marker records cleared=true');
			assertEqual(phases1?.syncApplied, false, 'Marker records syncApplied=false');
			const syncFailedAudit = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_SYNC_FAILED' },
			});
			assert(syncFailedAudit >= 1, 'Durable sync-failure audit remains');
			const oldMirror1 = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirror1?.isActive, true, 'Previous active year remains active after the failed sync');
			const newMirror1 = await findMirror(fixture.schoolId, fixture.newYearId);
			assertEqual(newMirror1?.isActive, false, 'Target year is NOT falsely reported active/aligned');
			const targetSections1 = await prisma.sectionMirror.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(targetSections1, 0, 'Cleanup committed before the sync failure');
			const eventTypes1 = events.map((event) => String(event.type));
			assert(!eventTypes1.includes('TEST_YEAR_RECOVERY_COMPLETED'), 'No success notification after the failed sync');
			assert(eventTypes1.includes('TEST_YEAR_RECOVERY_FAILED'), 'Failure notification published after the failed sync');

			// Run 2: healthy feed; must resume AFTER the clear (same marker
			// row), complete sync + archive.
			const result2 = await withFakeEnrollPro(fixtureFakeOptions(fixture), () => applyTestYearRecovery({
				schoolId: fixture.schoolId,
				actorId: ACTOR,
				confirmClear: true,
				confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
				acknowledgePublished: false,
			}));
			assertEqual(result2.cleared, true, 'Retry completes the recovery');
			assertEqual(result2.resumePath, 'resumed-after-clear', 'Retry resumes after the prior clear');
			assertEqual(result2.sync?.drift.status, 'aligned', 'Drift aligned after the retry');
			const marker2 = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				orderBy: { id: 'desc' },
				select: { id: true, metadata: true },
			});
			assertEqual(marker2?.id, marker1?.id, 'Retry did not rerun the destructive transaction (marker id unchanged)');
			const phases2 = (marker2?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phases2?.syncApplied, true, 'Marker updated to syncApplied=true');
			assertEqual(phases2?.archivesApplied, true, 'Marker updated to archivesApplied=true');
			const oldMirror2 = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirror2?.isArchived, true, 'Superseded year archived by the retry');
			const newMirror2 = await findMirror(fixture.schoolId, fixture.newYearId);
			assertEqual(newMirror2?.isActive, true, 'Target year active after the retry');
			const cycles = await prisma.teachingLoadCycle.findMany({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(cycles.length, 1, 'Exactly one TeachingLoadCycle after the retry');
			assertEqual(cycles[0]?.state, 'EMPTY', 'Cycle EMPTY after the retry');
		} finally {
			unsubscribe();
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Interruption Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function runArchiveFailureInterruption() {
	section('RR-15A: sync succeeds but archive fails -> partial success; resumed-after-sync retry executes ZERO sync calls');
	{
		const ACTOR = 424244;
		const fixture = await setupRecoveryFixture('RR15 Archive Failure Sandbox', 899201, '2098-2099', 899202, '2099-2100', ACTOR);
		const events: Array<Record<string, unknown>> = [];
		let unsubscribe = () => {};
		try {
			await withFakeEnrollPro(fixtureFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: ACTOR }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, ACTOR);
			unsubscribe = await subscribeToEvents(fixture.schoolId, [fixture.oldYearId, fixture.newYearId], events);

			// One fake server for the whole scenario so request counters span
			// both runs. Run 1: health calls 1-3 succeed (recovery preview,
			// sync preview, sync tail); call 4 (archive health check) fails.
			const fakeOptions = fixtureFakeOptions(fixture, { healthFailAfter: 3 });
			const result1 = await withFakeEnrollPro(fakeOptions, async () => {
				return applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
				});
			});

			assertEqual(result1.cleared, true, 'Cleanup and sync completed in run 1');
			assertEqual(result1.syncExecuted, true, 'Run 1 executed the synchronization');
			assert(result1.sync !== null, 'Run 1 returns the RolloverApplyResult');
			assertEqual(result1.archiveFailed, true, 'Archive failure is surfaced');
			assertEqual(result1.partialSuccess, true, 'Result reports partial success');
			assert(result1.archiveError !== undefined, 'Archive error message is surfaced');
			const newMirror1 = await findMirror(fixture.schoolId, fixture.newYearId);
			assertEqual(newMirror1?.isActive, true, 'New year remains active after the archive failure');
			const oldMirror1 = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirror1?.isActive, false, 'Old year is inactive (superseded by sync)');
			assertEqual(oldMirror1?.isArchived, false, 'Old year is NOT archived (archive failed)');
			const oldState1 = await yearArtifactState(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldState1.sections, 2, 'Old-year sections preserved during partial success');
			assertEqual(oldState1.runs, 1, 'Old-year runs preserved during partial success');
			const cycles1 = await prisma.teachingLoadCycle.findMany({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(cycles1.length, 1, 'TeachingLoadCycle exists after the sync (before archive completes)');
			assertEqual(cycles1[0]?.state, 'EMPTY', 'Cycle EMPTY during partial success');
			const marker1 = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true, metadata: true },
			});
			const phases1 = (marker1?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phases1?.syncApplied, true, 'Marker records syncApplied=true');
			assertEqual(phases1?.archivesApplied, false, 'Marker records archivesApplied=false (retryable)');
			const eventTypes1 = events.map((event) => String(event.type));
			assert(eventTypes1.includes('TEST_YEAR_RECOVERY_PARTIAL_SUCCESS'), 'Partial-success notification published');
			assert(!eventTypes1.includes('TEST_YEAR_RECOVERY_COMPLETED'), 'No full-success notification while archive is pending');

			// Run 2 on the SAME fake server: heal the feed and capture every
			// no-resync signal BEFORE and AFTER the resumed-after-sync retry.
			const markerId1 = marker1?.id;
			const syncAuditCountBefore2 = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			const targetSectionsBefore2 = await prisma.sectionMirror.findMany({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId },
				orderBy: { id: 'asc' },
				select: { externalId: true, updatedAt: true },
			});
			const cycleRowBefore2 = await prisma.teachingLoadCycle.findUnique({
				where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } },
				select: { id: true, version: true, initializedAt: true, updatedAt: true },
			});
			const mirrorSyncStampBefore2 = newMirror1?.lastSyncedAt?.toISOString() ?? null;

			const result2 = await withFakeEnrollPro(fakeOptions, async (ctx) => {
				// Heal the upstream BEFORE the resume.
				fakeOptions.healthFailAfter = 0;
				const pathsBefore = ctx.paths();
				const sectionsFetchesBefore = countPath(pathsBefore, '/api/integration/v1/sections');
				const facultyFetchesBefore = countPath(pathsBefore, '/api/integration/v1/faculty') + countPath(pathsBefore, '/api/integration/v1/default/faculty');
				const res = await applyTestYearRecovery({
					schoolId: fixture.schoolId,
					actorId: ACTOR,
					confirmClear: true,
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${fixture.newYearId}`,
					acknowledgePublished: false,
				});
				const pathsAfter = ctx.paths();
				const sectionsFetchesAfter = countPath(pathsAfter, '/api/integration/v1/sections');
				const facultyFetchesAfter = countPath(pathsAfter, '/api/integration/v1/faculty') + countPath(pathsAfter, '/api/integration/v1/default/faculty');
				assertEqual(res.resumePath, 'resumed-after-sync', 'Retry reports resumed-after-sync');
				assertEqual(res.syncExecuted, false, 'Retry reports syncExecuted=false');
				assertEqual(res.sync, null, 'Retry returns sync=null (no fabricated apply result)');
				assertEqual(sectionsFetchesAfter, sectionsFetchesBefore, 'Section adapter call count does not increase on the retry');
				assertEqual(facultyFetchesAfter, facultyFetchesBefore, 'Faculty adapter call count does not increase on the retry');
				return res;
			});
			assertEqual(result2.partialSuccess, false, 'Retry completes the lifecycle');
			assertEqual(result2.archiveFailed, false, 'Retry archive succeeds');
			assertEqual(result2.archivedYears.length, 1, 'Retry archives the superseded year');

			const syncAuditCountAfter2 = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			assertEqual(syncAuditCountAfter2, syncAuditCountBefore2, 'ROLLOVER_SYNC_APPLIED audit count does not increase on the retry');
			const targetSectionsAfter2 = await prisma.sectionMirror.findMany({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId },
				orderBy: { id: 'asc' },
				select: { externalId: true, updatedAt: true },
			});
			assertEqual(
				JSON.stringify(targetSectionsAfter2.map((s) => ({ id: s.externalId, at: s.updatedAt.toISOString() }))),
				JSON.stringify(targetSectionsBefore2.map((s) => ({ id: s.externalId, at: s.updatedAt.toISOString() }))),
				'Target section timestamps do not change on the retry',
			);
			const cycleRowAfter2 = await prisma.teachingLoadCycle.findUnique({
				where: { schoolId_schoolYearId: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } },
				select: { id: true, version: true, initializedAt: true, updatedAt: true },
			});
			assertEqual(cycleRowAfter2?.id, cycleRowBefore2?.id, 'Teaching Load cycle ID does not change on the retry');
			assertEqual(cycleRowAfter2?.version, cycleRowBefore2?.version, 'Teaching Load cycle version does not change on the retry');
			assertEqual(cycleRowAfter2?.initializedAt?.toISOString(), cycleRowBefore2?.initializedAt?.toISOString(), 'Teaching Load cycle initialization timestamp does not change on the retry');
			const newMirror2 = await findMirror(fixture.schoolId, fixture.newYearId);
			assertEqual(newMirror2?.lastSyncedAt?.toISOString(), mirrorSyncStampBefore2, 'Mirror sync timestamp does not change on the retry');
			const marker2 = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true, metadata: true },
			});
			assertEqual(marker2?.id, markerId1, 'Retry did not rerun the destructive transaction (marker id unchanged)');
			const phases2 = (marker2?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phases2?.archivesApplied, true, 'Marker records archivesApplied=true after the retry');
			const oldMirror2 = await findMirror(fixture.schoolId, fixture.oldYearId);
			assertEqual(oldMirror2?.isArchived, true, 'Superseded year archived by the retry');
			const syncAuditTotal = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			assertEqual(syncAuditTotal, 1, 'Initial recovery sync ran exactly once across both runs');
			const eventTypes2 = events.map((event) => String(event.type));
			assert(eventTypes2.includes('TEST_YEAR_RECOVERY_COMPLETED'), 'Completion notification published after the retry');
			assertEqual(eventTypes2.filter((t) => t === 'TEACHING_LOAD_CHANGED').length, 1, 'No duplicate TEACHING_LOAD_CHANGED on the archive-only retry');
		} finally {
			unsubscribe();
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Archive Failure Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function runCleanAutomationFixture() {
	section('RR-15F: clean atlas-stale automation branch (ATLAS 100 -> EnrollPro 101)');
	{
		const ACTOR = 0;
		const oldYearId = 100;
		const newYearId = 101;
		const fixture = await setupRecoveryFixture('RR15 Clean Automation Sandbox', oldYearId, '2099-2100', newYearId, '2100-2101', ACTOR);
		const events: Array<Record<string, unknown>> = [];
		try {
			// No year-101 ATLAS artifacts are allowed for this fixture: strip
			// the legacy year-101 rows the shared setup created so the drift is
			// clean atlas-stale, matching the real clean-rollover premise.
			await prisma.sectionMirror.deleteMany({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
			await prisma.schedulingPolicy.deleteMany({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
			await prisma.sectionSnapshot.deleteMany({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
			const year101Mirror = await findMirror(fixture.schoolId, newYearId);
			assert(year101Mirror === null, 'No year-101 ATLAS mirror exists at the start');
			const year101Sections = await prisma.sectionMirror.count({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
			assertEqual(year101Sections, 0, 'No year-101 ATLAS sections exist at the start');

			resetAutomationState();

			await withFakeEnrollPro(fixtureFakeOptions(fixture, {
				activeYearId: newYearId,
				activeYearLabel: '2100-2101',
				sectionRows: [{ id: 101101, name: 'RR15 New A' }, { id: 101102, name: 'RR15 New B' }],
			}), async (ctx) => {
				// 1) Initial drift is atlas-stale.
				const status = await previewRolloverSync(fixture.schoolId);
				assertEqual(status.drift.status, 'atlas-stale', 'Initial drift is atlas-stale');

				// 2) The REAL automation tick applies the rollover.
				const result = await tickRolloverAutomation(fixture.schoolId, {
					publishNotification: ((event: Record<string, unknown>) => { events.push(event); }) as never,
				});
				assertEqual(result.action, 'applied', 'Tick applies the clean rollover');

				// 3) Year 101 becomes active.
				const newMirror = await findMirror(fixture.schoolId, newYearId);
				assertEqual(newMirror?.isActive, true, 'Year 101 becomes active');
				assertEqual(newMirror?.yearLabel, '2100-2101', 'Year 101 carries the upstream label');

				// 4) Year 100 becomes inactive and archived.
				const oldMirror = await findMirror(fixture.schoolId, oldYearId);
				assertEqual(oldMirror?.isActive, false, 'Year 100 is deactivated');
				assertEqual(oldMirror?.isArchived, true, 'Year 100 is archived');

				// 5) Year-100 data remains unchanged.
				const oldState = await yearArtifactState(fixture.schoolId, oldYearId);
				assertEqual(oldState.sections, 2, 'Year-100 sections preserved');
				assertEqual(oldState.runs, 1, 'Year-100 generation runs preserved');
				assertEqual(oldState.policies, 1, 'Year-100 policy preserved');

				// 6) Year 101 receives the upstream section set.
				const newSections = await prisma.sectionMirror.findMany({
					where: { schoolId: fixture.schoolId, schoolYearId: newYearId },
					orderBy: { externalId: 'asc' },
					select: { externalId: true },
				});
				assertEqual(JSON.stringify(newSections.map((s) => s.externalId)), JSON.stringify([101101, 101102]), 'Year 101 holds the upstream section set');

				// 7) Year 101 has exactly one EMPTY Teaching Load cycle.
				const cycles = await prisma.teachingLoadCycle.findMany({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
				assertEqual(cycles.length, 1, 'Year 101 has exactly one TeachingLoadCycle');
				assertEqual(cycles[0]?.state, 'EMPTY', 'Year 101 cycle is EMPTY');

				// 8) No Teaching Load assignments are copied.
				const newState = await yearArtifactState(fixture.schoolId, newYearId);
				assertEqual(newState.ownerships, 0, 'No ownership rows copied to year 101');
				assertEqual(newState.facultySubjects, 0, 'No faculty-subject rows copied to year 101');

				// 9) Required policy and canonical templates are initialized.
				assertEqual(newState.policies, 1, 'Year-101 policy initialized');
				const canonicalSlots = await prisma.classProgramSlot.count({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
				assert(canonicalSlots > 0, `Year-101 canonical class-program slots seeded (got ${canonicalSlots})`);

				// 10) Audits identify initiatedBy system and actor 0.
				const syncAudit = await prisma.auditLog.findFirst({
					where: { schoolId: fixture.schoolId, schoolYearId: newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
					select: { actorId: true, metadata: true },
				});
				assertEqual(syncAudit?.actorId, 0, 'Rollover sync audit actor is 0');
				const syncMetadata = syncAudit?.metadata as Record<string, unknown> | null;
				assertEqual(syncMetadata?.initiatedBy, 'system', 'Rollover sync audit initiatedBy is system');
				const archiveAudit = await prisma.auditLog.findFirst({
					where: { schoolId: fixture.schoolId, schoolYearId: oldYearId, action: 'ARCHIVE_SCHOOL_YEAR' },
					select: { actorId: true, metadata: true },
				});
				assertEqual(archiveAudit?.actorId, 0, 'Archive audit actor is 0');
				const archiveMetadata = archiveAudit?.metadata as Record<string, unknown> | null;
				assertEqual(archiveMetadata?.initiatedBy, 'system', 'Archive audit initiatedBy is system');
				const oldMirrorRow = await findMirror(fixture.schoolId, oldYearId);
				assertEqual(oldMirrorRow?.archivedBy, 0, 'Archived-year mirror records archivedBy 0');

				// 11) Completion notification identifies the new and archived years.
				const completionEvents = events.filter((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED');
				assertEqual(completionEvents.length, 1, 'One ROLLOVER_AUTO_SYNC_COMPLETED notification');
				const completion = completionEvents[0] as Record<string, unknown> | undefined;
				assertEqual(completion?.schoolYearId, newYearId, 'Completion notification targets year 101');
				const completionMetadata = completion?.metadata as Record<string, unknown> | undefined;
				const archivedMeta = (completionMetadata?.archivedYears as Array<{ schoolYearId: number }> | undefined) ?? [];
				assertEqual(archivedMeta.length, 1, 'Completion notification carries the archived year');
				assertEqual(archivedMeta[0]?.schoolYearId, oldYearId, 'Completion notification names year 100');

				// 12-13) A second tick skips and duplicates nothing.
				const sectionsBeforeSecond = await prisma.sectionMirror.count({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
				const second = await tickRolloverAutomation(fixture.schoolId, {
					publishNotification: ((event: Record<string, unknown>) => { events.push(event); }) as never,
				});
				assertEqual(second.action, 'skipped', 'Second tick skips because the state is aligned');
				const sectionsAfterSecond = await prisma.sectionMirror.count({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
				assertEqual(sectionsAfterSecond, sectionsBeforeSecond, 'Second tick creates no duplicate sections');
				const cyclesAfterSecond = await prisma.teachingLoadCycle.count({ where: { schoolId: fixture.schoolId, schoolYearId: newYearId } });
				assertEqual(cyclesAfterSecond, 1, 'Second tick creates no duplicate cycles');
				const mirrors101 = await prisma.enrollProSchoolYearMirror.count({ where: { schoolId: fixture.schoolId, enrollProSchoolYearId: newYearId } });
				assertEqual(mirrors101, 1, 'Second tick creates no duplicate mirrors');
				const archiveAuditsAfterSecond = await prisma.auditLog.count({
					where: { schoolId: fixture.schoolId, schoolYearId: oldYearId, action: 'ARCHIVE_SCHOOL_YEAR' },
				});
				assertEqual(archiveAuditsAfterSecond, 1, 'Second tick does not re-archive');
				const completionsAfterSecond = events.filter((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED');
				assertEqual(completionsAfterSecond.length, 1, 'Second tick emits no duplicate completion notification');

				// 14) No EnrollPro write request occurs.
				const methods = ctx.methods();
				const writes = methods.filter((method) => method !== 'GET');
				assertEqual(writes.length, 0, `No EnrollPro write request occurs (writes: ${JSON.stringify(writes)})`);
			});
		} finally {
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15 Clean Automation Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupSandboxSchool(sandbox.id);
		}
	}
}

async function run() {
	await runMarkAndScaffoldTruthfulness();
	await runFullRecoveryLifecycle();
	await runCleanupAndSyncInterruptions();
	await runArchiveFailureInterruption();
	await runResumedSyncStateMismatch();
	await runCleanAutomationFixture();

	console.log(`\nRollover lifecycle closure test complete: ${passCount} passed, ${failCount} failed.`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await cleanupAllSandboxes();
		await prisma.$disconnect();
	});
