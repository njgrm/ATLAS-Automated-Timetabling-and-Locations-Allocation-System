import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { prisma } from '../lib/prisma.js';
import {
	canAutoRecoverMarkedTestCollision,
	isArchiveResolvableStatus,
	tickRolloverAutomation,
	getAutomationStatus,
	withSchoolLock,
	resetAutomationState,
	markSchoolYearAsTestData,
} from '../services/rollover-automation.service.js';
import {
	previewRolloverSync,
	scaffoldTestYearRecoveryMirror,
	findPendingArchiveRecoveryMarker,
	type RolloverStatusResult,
} from '../services/enrollpro-rollover.service.js';
import { subscribeNotificationEvents, type NotificationEvent } from '../services/notification-events.service.js';

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

const SCHOOL_ID = 1;

function createFakeServer(handlers: Record<string, (req: IncomingMessage, res: ServerResponse) => void>): Server {
	const server = createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://127.0.0.1');
		const handler = handlers[url.pathname];
		if (handler) {
			handler(req, res);
		} else {
			sendJson(res, 404, { error: 'not found' });
		}
	});
	return server;
}

async function getLiveActiveYearId(): Promise<number> {
	const preview = await previewRolloverSync(SCHOOL_ID);
	return preview.enrollProActiveYear?.id ?? 0;
}

/**
 * Live-mirror-derived fake-feed label. The fake EnrollPro servers below must
 * not introduce a YEAR_LABEL_MISMATCH of their own: after RR-09B the
 * automation tick self-heals label-mismatch conflicts, so an accidental fake
 * label drift would make the tick apply a rollover against fake feeds and
 * contaminate the live school. Always serve the label the live mirror
 * actually carries.
 */
async function getLiveActiveMirrorLabel(): Promise<string> {
	const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
		where: { schoolId: SCHOOL_ID, isActive: true },
		orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
		select: { yearLabel: true },
	});
	return activeMirror?.yearLabel ?? '2026-2027';
}

//   RR-15A: instrumented fake EnrollPro + sandbox helpers

type Rr15aFakeOptions = {
	activeYearId: number;
	activeYearLabel: string;
	sectionRows: Array<{ id: number; name: string }>;
	/** Fail /school-year after this many successful calls (0 = never). */
	schoolYearFailAfter?: number;
	/** Fail /health after this many successful calls (0 = never). */
	healthFailAfter?: number;
};

function startInstrumentedFake(options: Rr15aFakeOptions): { server: Server; methods: string[]; paths: string[] } {
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
				sendJson(res, 503, { error: 'simulated health failure' });
				return;
			}
			sendJson(res, 200, { status: 'ok', service: 'enrollpro' });
			return;
		}
		if (url.pathname === '/api/integration/v1/school-year') {
			schoolYearCalls += 1;
			if (options.schoolYearFailAfter != null && options.schoolYearFailAfter > 0 && schoolYearCalls > options.schoolYearFailAfter) {
				sendJson(res, 500, { error: 'simulated school-year failure' });
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
			sendJson(res, 200, {
				data: [{ teacherId: 991501, employeeId: '9915010', firstName: 'Rr15a', lastName: 'Teacher', fullName: 'Rr15a Teacher', departmentCode: 'MATH', departmentName: 'Mathematics', specialization: 'Mathematics', isActive: true, isTeachingExempt: false }],
				meta: { page: 1, limit: 200, totalPages: 1 },
			});
			return;
		}
		if (url.pathname === '/api/settings/public') {
			sendJson(res, 200, { schoolName: 'RR15A Sandbox', activeSchoolYearId: options.activeYearId, activeSchoolYearLabel: options.activeYearLabel });
			return;
		}
		sendJson(res, 404, { error: 'not found' });
	});
	return { server, methods, paths };
}

async function withInstrumentedFake<T>(
	options: Rr15aFakeOptions,
	fn: () => Promise<T>,
): Promise<T> {
	const { server, methods, paths } = startInstrumentedFake(options);
	const baseUrl = await startAndGetUrl(server);
	const origApi = process.env.ENROLLPRO_API;
	try {
		process.env.ENROLLPRO_API = baseUrl;
		const result = await fn();
		const writes = methods.filter((method) => method !== 'GET');
		if (writes.length > 0) {
			throw new Error(`Fake EnrollPro received write request(s): ${JSON.stringify(writes)}`);
		}
		return result;
	} finally {
		if (origApi === undefined) delete process.env.ENROLLPRO_API;
		else process.env.ENROLLPRO_API = origApi;
		await stopServer(server);
	}
}

async function cleanupRr15aSandbox(schoolId: number) {
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

async function setupRr15aFixture(sandboxName: string, oldYearId: number, newYearId: number): Promise<{ schoolId: number; oldYearId: number; newYearId: number }> {
	const existing = await prisma.school.findFirst({ where: { name: sandboxName }, select: { id: true } });
	if (existing) await cleanupRr15aSandbox(existing.id);
	const school = await prisma.school.create({
		data: { name: sandboxName, shortName: 'RR15A Sandbox' },
		select: { id: true },
	});
	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId: school.id,
			enrollProSchoolYearId: oldYearId,
			yearLabel: '2098-2099',
			isActive: true,
			syncStatus: 'setup-review-required',
			lastSyncedAt: new Date(),
		},
	});
	await prisma.sectionMirror.createMany({
		data: [
			{ schoolId: school.id, schoolYearId: oldYearId, externalId: oldYearId * 10 + 1, name: `RR15A Old ${oldYearId * 10 + 1}`, gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 30 },
			{ schoolId: school.id, schoolYearId: oldYearId, externalId: oldYearId * 10 + 2, name: `RR15A Old ${oldYearId * 10 + 2}`, gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 28 },
		],
	});
	await prisma.schedulingPolicy.create({ data: { schoolId: school.id, schoolYearId: oldYearId } });
	await prisma.generationRun.create({
		data: {
			schoolId: school.id,
			schoolYearId: oldYearId,
			status: 'COMPLETED',
			triggeredBy: 0,
			summary: { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: 1, assignedCount: 12 },
			draftEntries: [{ entryId: 'e1', day: 'MON', startTime: '07:30', endTime: '08:30', sectionId: oldYearId * 10 + 1, subjectId: 1, roomId: 1 }],
		},
	});
	// New (EnrollPro active) year: legacy fixture artifacts WITHOUT a mirror.
	await prisma.sectionMirror.createMany({
		data: [
			{ schoolId: school.id, schoolYearId: newYearId, externalId: 888101, name: 'RR15A Legacy 1', gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 30 },
			{ schoolId: school.id, schoolYearId: newYearId, externalId: 888102, name: 'RR15A Legacy 2', gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 28 },
		],
	});
	await prisma.schedulingPolicy.create({ data: { schoolId: school.id, schoolYearId: newYearId } });
	return { schoolId: school.id, oldYearId, newYearId };
}

function rr15aFakeOptions(fixture: { newYearId: number }, extra?: Partial<Rr15aFakeOptions>): Rr15aFakeOptions {
	return {
		activeYearId: fixture.newYearId,
		activeYearLabel: '2099-2100',
		sectionRows: [
			{ id: fixture.newYearId * 10 + 1, name: 'RR15A New A' },
			{ id: fixture.newYearId * 10 + 2, name: 'RR15A New B' },
		],
		...extra,
	};
}

async function craftRecoveryMarker(schoolId: number, schoolYearId: number, phases: { cleared: boolean; syncApplied: boolean; archivesApplied: boolean }, previousActiveSchoolYearId?: number | null) {
	return prisma.auditLog.create({
		data: {
			schoolId,
			schoolYearId,
			action: 'TEST_YEAR_RECOVERY_CLEANUP',
			actorId: 0,
			targetIds: [schoolYearId],
			metadata: {
				source: 'enrollpro-rollover',
				phases,
				...(previousActiveSchoolYearId ? { previousActiveSchoolYearId } : {}),
			},
		},
		select: { id: true },
	});
}

async function run() {
	let effectiveYearId = await getLiveActiveYearId();
	if (effectiveYearId === 0) {
		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: SCHOOL_ID, isActive: true },
			select: { enrollProSchoolYearId: true },
		});
		effectiveYearId = activeMirror?.enrollProSchoolYearId ?? 0;
	}
	assert(effectiveYearId > 0, `Resolved active year: ${effectiveYearId}`);

	section('Aligned drift skips apply (no DB writes)');
	{
		resetAutomationState();
		// Serve the live ACTIVE MIRROR's year id + label so this fake feed is
		// guaranteed to produce `aligned` drift regardless of environment
		// churn   an atlas-stale premise would make the tick auto-apply
		// against the fake feed and contaminate the live school.
		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: SCHOOL_ID, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			select: { enrollProSchoolYearId: true, yearLabel: true },
		});
		const alignedYearId = activeMirror?.enrollProSchoolYearId ?? effectiveYearId;
		const liveLabel = activeMirror?.yearLabel ?? '2026-2027';
		const server = createFakeServer({
			'/api/integration/v1/health': (_req, res) => sendJson(res, 200, { status: 'ok' }),
			'/api/integration/v1/school-year': (_req, res) => sendJson(res, 200, { data: { id: alignedYearId, yearLabel: liveLabel } }),
			'/api/integration/v1/sections': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/integration/v1/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/integration/v1/default/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/settings/public': (_req, res) => sendJson(res, 200, { activeSchoolYearId: alignedYearId }),
		});
		const baseUrl = await startAndGetUrl(server);
		const origApi = process.env.ENROLLPRO_API;
		const mirrorBefore = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: SCHOOL_ID, isActive: true },
			select: { enrollProSchoolYearId: true, isActive: true },
		});
		const facultyBefore = await prisma.facultyMirror.count({
			where: { schoolId: SCHOOL_ID, isActiveForScheduling: true, isStale: false },
		});
		try {
			process.env.ENROLLPRO_API = baseUrl;
			const result = await tickRolloverAutomation(SCHOOL_ID);
			assertEqual(result.action, 'skipped', 'Tick skips when drift is aligned');
			const mirrorAfter = await prisma.enrollProSchoolYearMirror.findFirst({
				where: { schoolId: SCHOOL_ID, isActive: true },
				select: { enrollProSchoolYearId: true, isActive: true },
			});
			assertEqual(mirrorAfter?.enrollProSchoolYearId, mirrorBefore?.enrollProSchoolYearId, 'Active mirror unchanged');
			assertEqual(mirrorAfter?.isActive, true, 'Active mirror still active');
			const facultyAfter = await prisma.facultyMirror.count({
				where: { schoolId: SCHOOL_ID, isActiveForScheduling: true, isStale: false },
			});
			assertEqual(facultyAfter, facultyBefore, 'Faculty mirror count unchanged');
		} finally {
			if (origApi === undefined) delete process.env.ENROLLPRO_API;
			else process.env.ENROLLPRO_API = origApi;
			await stopServer(server);
		}
	}

	section('Unreachable upstream advances backoff');
	{
		resetAutomationState();
		const server = createFakeServer({
			'/api/integration/v1/health': (_req, res) => sendJson(res, 503, { error: 'unavailable' }),
		});
		const baseUrl = await startAndGetUrl(server);
		const origApi = process.env.ENROLLPRO_API;
		try {
			process.env.ENROLLPRO_API = baseUrl;
			const result = await tickRolloverAutomation(SCHOOL_ID);
			assertEqual(result.action, 'unreachable', 'Tick returns unreachable');
			assert(result.state.consecutiveFailures >= 1, `consecutiveFailures incremented (got ${result.state.consecutiveFailures})`);
			assert(result.state.nextAttemptAt.getTime() > Date.now(), 'nextAttemptAt is in the future');
		} finally {
			if (origApi === undefined) delete process.env.ENROLLPRO_API;
			else process.env.ENROLLPRO_API = origApi;
			await stopServer(server);
		}
	}

	section('A realistic unmarked section collision stays manual');
	{
		resetAutomationState();
		// Premise guard (RR-07/RR-08 discipline): the collision scenario needs
		// the live active year to carry section mirrors that do not overlap the
		// fake feed. In the 2026-09-01 crashed-reset state the active year had
		// 0 section mirrors, which turned this scenario into a clean atlas-stale
		// drift   and the tick correctly auto-applied against the fake feed.
		// Skip instead of contaminating the live school in that state.
		const liveSectionCount = await prisma.sectionMirror.count({
			where: { schoolId: SCHOOL_ID, schoolYearId: effectiveYearId },
		});
		const liveLabel = await getLiveActiveMirrorLabel();
		if (liveSectionCount === 0) {
			console.log('  SKIP Active year has 0 section mirrors (crashed-reset state)   collision premise does not hold; tick would auto-apply against the fake feed.');
		} else {
		const server = createFakeServer({
			'/api/integration/v1/health': (_req, res) => sendJson(res, 200, { status: 'ok' }),
			'/api/integration/v1/school-year': (_req, res) => sendJson(res, 200, { data: { id: effectiveYearId, yearLabel: liveLabel } }),
			// This external ID intentionally does not overlap ATLAS's existing active-year
			// section mirrors, so previewRolloverSync produces mapping-conflict.
			'/api/integration/v1/sections': (_req, res) => sendJson(res, 200, { data: [{ id: 987654321 }], meta: { page: 1, limit: 200, totalPages: 1 } }),
			'/api/integration/v1/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/integration/v1/default/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/settings/public': (_req, res) => sendJson(res, 200, { activeSchoolYearId: effectiveYearId }),
		});
		const baseUrl = await startAndGetUrl(server);
		const origApi = process.env.ENROLLPRO_API;
		const sectionsBefore = await prisma.sectionMirror.count({ where: { schoolId: SCHOOL_ID, schoolYearId: effectiveYearId } });
		try {
			process.env.ENROLLPRO_API = baseUrl;
			const preview = await previewRolloverSync(SCHOOL_ID);
			assertEqual(preview.drift.status, 'mapping-conflict', 'Fake EnrollPro collision produces mapping-conflict');
			assert(preview.conflicts.some((conflict) => conflict.code === 'SECTION_ID_COLLISION'), 'Preview contains SECTION_ID_COLLISION');
		const result = await tickRolloverAutomation(SCHOOL_ID);
			assertEqual(result.action, 'conflict', 'Unmarked collision requires manual review');
			assertEqual(result.state.lastResult, 'conflict', 'Automation records a conflict state');
			const sectionsAfter = await prisma.sectionMirror.count({ where: { schoolId: SCHOOL_ID, schoolYearId: effectiveYearId } });
			assertEqual(sectionsAfter, sectionsBefore, 'Manual collision handling does not alter section mirrors');

			resetAutomationState();
			let recoveryApplyCalls = 0;
			const markedRecovery = await tickRolloverAutomation(SCHOOL_ID, {
				testModeEnabled: true,
				fetchIntegrationHealth: async () => ({ reachable: true } as never),
				previewRollover: async () => ({ ...preview, testDataMarked: true, publishedResetBlocked: false }),
				classifyRecovery: async () => ({
					classification: 'TEST_DATA_RECOVERY_AVAILABLE',
					confirmationText: `CLEAR_TEST_DATA_AND_SYNC_${effectiveYearId}`,
				} as never),
				applyTestRecovery: async () => {
					recoveryApplyCalls += 1;
					return undefined as never;
				},
				publishNotification: () => ({} as never),
			});
			assertEqual(markedRecovery.action, 'applied', 'Marked mapping-conflict enters the auto-recovery path in test mode');
			assertEqual(recoveryApplyCalls, 1, 'Marked mapping-conflict invokes recovery exactly once');
		} finally {
			if (origApi === undefined) delete process.env.ENROLLPRO_API;
			else process.env.ENROLLPRO_API = origApi;
			await stopServer(server);
		}
		}
	}

	section('getAutomationStatus returns enabled and school states');
	{
		const status = getAutomationStatus();
		assert(typeof status.enabled === 'boolean', 'enabled is boolean');
		assert(Array.isArray(status.schools), 'schools is array');
	}

	section('Test-mode recovery safety predicate');
	{
		const base = await previewRolloverSync(SCHOOL_ID);
		// `buildDriftState` emits `mapping-conflict` whenever an upstream section
		// collision exists. Do not construct the impossible atlas-stale + conflict state.
		const mappingConflict = {
			...base,
			drift: {
				...base.drift,
				status: 'mapping-conflict' as const,
				recommendedAction: 'RESET_DUMMY_YEAR' as const,
			},
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
			publishedResetBlocked: false,
		} as RolloverStatusResult;
		assertEqual(canAutoRecoverMarkedTestCollision(mappingConflict, true), false, 'Unmarked collision cannot auto-clear');
		assertEqual(canAutoRecoverMarkedTestCollision({ ...mappingConflict, testDataMarked: true }, true), true, 'Marked mapping-conflict collision can auto-clear in test mode');
		assertEqual(canAutoRecoverMarkedTestCollision({ ...mappingConflict, testDataMarked: true, publishedResetBlocked: true }, true), false, 'Published artifacts prevent auto-clear');
		assertEqual(canAutoRecoverMarkedTestCollision({ ...mappingConflict, testDataMarked: true }, false), false, 'Disabled test mode prevents auto-clear');
	}

	section('withSchoolLock prevents concurrent execution for same school');
	{
		let running = 0;
		let maxConcurrent = 0;
		const fn = async () => {
			running += 1;
			maxConcurrent = Math.max(maxConcurrent, running);
			await new Promise((r) => setTimeout(r, 50));
			running -= 1;
		};

		await Promise.all([
			withSchoolLock(SCHOOL_ID, fn),
			withSchoolLock(SCHOOL_ID, fn),
			withSchoolLock(SCHOOL_ID, fn),
		]);
		assertEqual(maxConcurrent, 1, 'Only one concurrent execution per school');
	}

	section('Automation never calls dummy-year reset path');
	{
		resetAutomationState();
		// Serve the live ACTIVE MIRROR's year id + label so this fake feed is
		// guaranteed to produce `aligned` drift   an atlas-stale premise would
		// make the tick (correctly) auto-apply against the fake feed.
		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: SCHOOL_ID, isActive: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }],
			select: { enrollProSchoolYearId: true, yearLabel: true },
		});
		const alignedYearId = activeMirror?.enrollProSchoolYearId ?? effectiveYearId;
		const liveLabel = activeMirror?.yearLabel ?? await getLiveActiveMirrorLabel();
		const beforeResetCount = await prisma.auditLog.count({
			where: { schoolId: SCHOOL_ID, action: 'DUMMY_YEAR_RESET' },
		});
		const server = createFakeServer({
			'/api/integration/v1/health': (_req, res) => sendJson(res, 200, { status: 'ok' }),
			'/api/integration/v1/school-year': (_req, res) => sendJson(res, 200, { data: { id: alignedYearId, yearLabel: liveLabel } }),
			'/api/integration/v1/sections': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/integration/v1/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/integration/v1/default/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/settings/public': (_req, res) => sendJson(res, 200, { activeSchoolYearId: effectiveYearId }),
		});
		const baseUrl = await startAndGetUrl(server);
		const origApi = process.env.ENROLLPRO_API;
		try {
			process.env.ENROLLPRO_API = baseUrl;
			const result = await tickRolloverAutomation(SCHOOL_ID);
			assertEqual(result.action, 'skipped', 'Tick skips (aligned drift, no apply triggered)');
			const afterResetCount = await prisma.auditLog.count({
				where: { schoolId: SCHOOL_ID, action: 'DUMMY_YEAR_RESET' },
			});
			assertEqual(afterResetCount, beforeResetCount, 'No new DUMMY_YEAR_RESET audit entries');
		} finally {
			if (origApi === undefined) delete process.env.ENROLLPRO_API;
			else process.env.ENROLLPRO_API = origApi;
			await stopServer(server);
		}
	}

	section('RR-09B archive-resolvable conflict self-heals with no attention noise');
	{
		resetAutomationState();
		const archiveResolvablePreview = {
			schoolId: SCHOOL_ID,
			atlasSchoolYearId: 5,
			enrollProActiveYear: { id: 6, yearLabel: '2027-2028' },
			drift: {
				status: 'mapping-conflict',
				message: 'EnrollPro moved to a new school year. Archive the old school year and sync the new one.',
				recommendedAction: 'RUN_ARCHIVE_AND_SYNC',
				atlasSchoolYearId: 5,
				enrollProSchoolYearId: 6,
				enrollProSchoolYearLabel: '2027-2028',
				mirrorSyncedAt: null,
			},
			mirror: null,
			conflicts: [{ code: 'YEAR_LABEL_MISMATCH', message: 'Label mismatch' }],
			reconfiguredSections: [],
			canResetDummyYear: false,
			resetTargetSchoolYearId: 6,
			conflictingRecordCounts: null,
			teachingLoadResetRequired: false,
			publishedResetBlocked: false,
			testDataMarked: false,
		} as RolloverStatusResult;

		assertEqual(isArchiveResolvableStatus(archiveResolvablePreview), true, 'isArchiveResolvableStatus recognizes the label-only wedge');

		const published: Array<{ type: string }> = [];
		let archiveApplyCalls = 0;
		let archiveApplyInitiatedBy = '';
		const result = await tickRolloverAutomation(SCHOOL_ID, {
			fetchIntegrationHealth: async () => ({ reachable: true } as never),
			previewRollover: async () => archiveResolvablePreview,
			applyArchiveAndSync: async (input: { initiatedBy?: string }) => {
				archiveApplyCalls += 1;
				archiveApplyInitiatedBy = input?.initiatedBy ?? '';
				return { archivedYears: [{ schoolYearId: 5 }], enrollProActiveYear: { id: 6, yearLabel: '2027-2028' } } as never;
			},
			publishNotification: ((event: { type: string }) => { published.push(event); }) as never,
		});
		assertEqual(result.action, 'applied', 'Archive-resolvable conflict self-heals (applied)');
		assertEqual(result.state.lastResult, 'success', 'Automation records success for the self-heal');
		assertEqual(archiveApplyCalls, 1, 'archiveAndSyncActiveYear invoked exactly once');
		assertEqual(archiveApplyInitiatedBy, 'system', 'Self-heal runs with initiatedBy system');
		assertEqual(published.filter((event) => event.type === 'ROLLOVER_ATTENTION_REQUIRED').length, 0, 'No attention publications on the injected publisher for archive-resolvable conflicts');
		assertEqual(result.state.lastNotifiedState, null, 'No standing attention state recorded for archive-resolvable conflicts');
	}

	section('RR-09B non-resolvable conflict still pauses manual with attention');
	{
		resetAutomationState();
		const collisionPreview = {
			schoolId: SCHOOL_ID,
			atlasSchoolYearId: 5,
			enrollProActiveYear: { id: 6, yearLabel: '2027-2028' },
			drift: {
				status: 'mapping-conflict',
				message: 'ATLAS has dummy data using the EnrollPro year ID. Reset dummy data and sync from EnrollPro.',
				recommendedAction: 'RESET_DUMMY_YEAR',
				atlasSchoolYearId: 5,
				enrollProSchoolYearId: 6,
				enrollProSchoolYearLabel: '2027-2028',
				mirrorSyncedAt: null,
			},
			mirror: null,
			conflicts: [{ code: 'SECTION_ID_COLLISION', message: 'Collision' }],
			reconfiguredSections: [],
			canResetDummyYear: false,
			resetTargetSchoolYearId: 6,
			conflictingRecordCounts: null,
			teachingLoadResetRequired: false,
			publishedResetBlocked: false,
			testDataMarked: false,
		} as RolloverStatusResult;

		assertEqual(isArchiveResolvableStatus(collisionPreview), false, 'Section collisions are not archive-resolvable');

		const published: Array<{ type: string }> = [];
		let archiveApplyCalls = 0;
		const result = await tickRolloverAutomation(SCHOOL_ID, {
			fetchIntegrationHealth: async () => ({ reachable: true } as never),
			previewRollover: async () => collisionPreview,
			applyArchiveAndSync: async () => {
				archiveApplyCalls += 1;
				return {} as never;
			},
			publishNotification: ((event: { type: string }) => { published.push(event); }) as never,
		});
		assertEqual(result.action, 'conflict', 'Non-resolvable conflict still pauses for manual review');
		assertEqual(result.state.lastResult, 'conflict', 'Automation records a conflict state');
		assertEqual(archiveApplyCalls, 0, 'archiveAndSyncActiveYear is NOT invoked for section collisions');
		// notifyOnce records the standing attention state on the school's
		// automation state; that marker is the observable attention signal.
		assertEqual(result.state.lastNotifiedState, 'ROLLOVER_ATTENTION_REQUIRED:conflict', 'Attention notification state recorded for manual conflicts');
	}

	section('RR-09B clean drift auto-applies AND archives the superseded year (sandbox)');
	{
		resetAutomationState();
		const SANDBOX_NAME = 'RR09B Automation Archive Sandbox';
		const OLD_YEAR = 991001;
		const NEW_YEAR = 991002;
		const cleanupSandbox = async (schoolId: number) => {
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
			await prisma.auditLog.deleteMany({ where: { schoolId } });
			await prisma.sectionMirror.deleteMany({ where: { schoolId } });
			await prisma.facultyMirror.deleteMany({ where: { schoolId } });
			await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } });
			await prisma.school.deleteMany({ where: { id: schoolId } });
		};
		const existingSandbox = await prisma.school.findFirst({ where: { name: SANDBOX_NAME }, select: { id: true } });
		if (existingSandbox) await cleanupSandbox(existingSandbox.id);
		const sandbox = await prisma.school.create({
			data: { name: SANDBOX_NAME, shortName: 'RR09B Sandbox' },
			select: { id: true },
		});

		// Old year: active mirror with real-shaped history that must survive.
		await prisma.enrollProSchoolYearMirror.create({
			data: { schoolId: sandbox.id, enrollProSchoolYearId: OLD_YEAR, yearLabel: '2094-2095', isActive: true, syncStatus: 'setup-review-required', lastSyncedAt: new Date() },
		});
		await prisma.sectionMirror.createMany({
			data: [
				{ schoolId: sandbox.id, schoolYearId: OLD_YEAR, externalId: 991101, name: 'RR09B 7-A', gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 30 },
				{ schoolId: sandbox.id, schoolYearId: OLD_YEAR, externalId: 991102, name: 'RR09B 7-B', gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 45, enrolledCount: 28 },
			],
		});
		await prisma.schedulingPolicy.create({ data: { schoolId: sandbox.id, schoolYearId: OLD_YEAR } });
		await prisma.generationRun.create({
			data: {
				schoolId: sandbox.id,
				schoolYearId: OLD_YEAR,
				status: 'COMPLETED',
				triggeredBy: 0,
				summary: { isPublished: true, publishedAt: new Date().toISOString(), publishedBy: 1, assignedCount: 12 },
				draftEntries: [{ entryId: 'e1', day: 'MON', startTime: '07:30', endTime: '08:30', sectionId: 991101, subjectId: 1, roomId: 1 }],
			},
		});

		const countsBefore = {
			sections: 2,
			runs: 1,
			policies: 1,
		};

		// Fake EnrollPro that has ROLLED to the new year.
		const server = createFakeServer({
			'/api/integration/v1/health': (_req, res) => sendJson(res, 200, { status: 'ok' }),
			'/api/integration/v1/school-year': (_req, res) => sendJson(res, 200, { data: { id: NEW_YEAR, yearLabel: '2095-2096' } }),
			'/api/integration/v1/sections': (_req, res) => sendJson(res, 200, {
				data: [
					{ id: 991201, name: 'RR09B New A', maxCapacity: 45, enrolledCount: 30, programType: 'REGULAR', gradeLevel: { id: 7, name: 'Grade 7', displayOrder: 7 } },
					{ id: 991202, name: 'RR09B New B', maxCapacity: 45, enrolledCount: 28, programType: 'REGULAR', gradeLevel: { id: 7, name: 'Grade 7', displayOrder: 7 } },
				],
				meta: { page: 1, limit: 200, totalPages: 1 },
			}),
			'/api/integration/v1/faculty': (_req, res) => sendJson(res, 200, {
				data: [
					{ teacherId: 93001, employeeId: '9300991', firstName: 'Rr09b', lastName: 'Teacher', fullName: 'Rr09b Teacher', departmentCode: 'MATH', departmentName: 'Mathematics', specialization: 'Mathematics', isActive: true, isTeachingExempt: false },
				],
				meta: { page: 1, limit: 200, totalPages: 1 },
			}),
			'/api/integration/v1/default/faculty': (_req, res) => sendJson(res, 200, { data: [], meta: { page: 1, limit: 200, totalPages: 0 } }),
			'/api/settings/public': (_req, res) => sendJson(res, 200, { activeSchoolYearId: NEW_YEAR, activeSchoolYearLabel: '2095-2096' }),
		});
		const baseUrl = await startAndGetUrl(server);
		const origApi = process.env.ENROLLPRO_API;
		const published: Array<{ type: string; message: string; metadata?: Record<string, unknown> }> = [];
		try {
			process.env.ENROLLPRO_API = baseUrl;
			const result = await tickRolloverAutomation(sandbox.id, {
				publishNotification: ((event: { type: string; message: string; metadata?: Record<string, unknown> }) => { published.push(event); }) as never,
			});
			assertEqual(result.action, 'applied', 'Clean atlas-stale drift auto-applies against the new year');
			assertEqual(result.state.lastResult, 'success', 'Automation records success');

			const oldMirror = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: sandbox.id, enrollProSchoolYearId: OLD_YEAR } },
				select: { isArchived: true, isActive: true },
			});
			assertEqual(oldMirror?.isArchived, true, 'Superseded year archived automatically after the sync');
			assertEqual(oldMirror?.isActive, false, 'Superseded year deactivated');

			const newMirror = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: sandbox.id, enrollProSchoolYearId: NEW_YEAR } },
				select: { isActive: true, yearLabel: true },
			});
			assertEqual(newMirror?.isActive, true, 'New-year mirror activated by the automated sync');
			assertEqual(newMirror?.yearLabel, '2095-2096', 'New-year mirror carries the upstream label');

			const sectionsAfter = await prisma.sectionMirror.count({ where: { schoolId: sandbox.id, schoolYearId: OLD_YEAR } });
			const runsAfter = await prisma.generationRun.count({ where: { schoolId: sandbox.id, schoolYearId: OLD_YEAR } });
			const policiesAfter = await prisma.schedulingPolicy.count({ where: { schoolId: sandbox.id, schoolYearId: OLD_YEAR } });
			assertEqual(sectionsAfter, countsBefore.sections, 'Old-year sections preserved (non-destruction)');
			assertEqual(runsAfter, countsBefore.runs, 'Old-year runs preserved (non-destruction)');
			assertEqual(policiesAfter, countsBefore.policies, 'Old-year policies preserved (non-destruction)');

			const archiveAudits = await prisma.auditLog.count({
				where: { schoolId: sandbox.id, schoolYearId: OLD_YEAR, action: 'ARCHIVE_SCHOOL_YEAR' },
			});
			assertEqual(archiveAudits, 1, 'ARCHIVE_SCHOOL_YEAR audit written with initiatedBy system');

			const completion = published.find((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED');
			assert(completion != null, 'ROLLOVER_AUTO_SYNC_COMPLETED notification published');
			const archivedMeta = (completion?.metadata?.archivedYears as Array<{ schoolYearId: number }> | undefined) ?? [];
			assertEqual(archivedMeta.length, 1, 'Completion notification carries archive metadata');
			assertEqual(archivedMeta[0]?.schoolYearId, OLD_YEAR, 'Archive metadata names the superseded year');
			assert(String(completion?.message ?? '').includes('archived 1 superseded'), 'Completion message mentions the archive');
		} finally {
			if (origApi === undefined) delete process.env.ENROLLPRO_API;
			else process.env.ENROLLPRO_API = origApi;
			await stopServer(server);
			await cleanupSandbox(sandbox.id);
		}
	}

	section('RR-15A: test-mode pending-archive recovery retries through the real automation tick');
	{
		const fixture = await setupRr15aFixture('RR15A Automation Archive Retry Sandbox', 991101, 991102);
		const busEvents: Array<Record<string, unknown>> = [];
		const tickEvents: Array<Record<string, unknown>> = [];
		let unsubscribe = () => {};
		try {
			// Scaffold + mark the mirror-less legacy fixture (real services).
			await withInstrumentedFake(rr15aFakeOptions(fixture), () => scaffoldTestYearRecoveryMirror({ schoolId: fixture.schoolId, actorId: 0 }));
			await markSchoolYearAsTestData(fixture.schoolId, fixture.newYearId, 0);
			const unsubscribers = [fixture.oldYearId, fixture.newYearId].map((schoolYearId) => subscribeNotificationEvents({
				schoolId: fixture.schoolId,
				schoolYearId,
				facultyId: null,
				send: (event: NotificationEvent) => { busEvents.push(event as unknown as Record<string, unknown>); },
			}));
			unsubscribe = () => { for (const unsub of unsubscribers) unsub(); };
			const injectPublisher = ((event: Record<string, unknown>) => { tickEvents.push(event); }) as never;

			//   Tick 1: marked collision enters recovery; sync succeeds;
			// archival fails (school-year call 6).
			const fakeOptions = rr15aFakeOptions(fixture, { schoolYearFailAfter: 5 });
			const tick1 = await withInstrumentedFake(fakeOptions, () => tickRolloverAutomation(fixture.schoolId, {
				testModeEnabled: true,
				publishNotification: injectPublisher,
			}));
			assertEqual(tick1.action, 'archive-pending', 'Tick 1 returns archive-pending');
			assertEqual(tick1.state.lastResult, 'partial-success', 'Tick 1 records partial-success (not success)');
			assert(tick1.state.consecutiveFailures >= 1, `Tick 1 advanced the failure counter (got ${tick1.state.consecutiveFailures})`);
			assert(tick1.state.nextAttemptAt.getTime() > Date.now(), 'Tick 1 set a future retry time via backoff');
			assert(!tickEvents.some((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED'), 'Tick 1 does NOT emit a complete rollover notification');
			assertEqual(
				busEvents.filter((event) => event.type === 'TEST_YEAR_RECOVERY_PARTIAL_SUCCESS').length,
				1,
				'Exactly one partial-success notification after tick 1',
			);
			assertEqual(
				busEvents.filter((event) => event.type === 'TEST_YEAR_RECOVERY_COMPLETED').length,
				0,
				'No completion notification while archival is pending',
			);

			const newMirror1 = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.newYearId } },
				select: { isActive: true, isArchived: true, yearLabel: true },
			});
			assertEqual(newMirror1?.isActive, true, 'Year becomes aligned (new year active)');
			assertEqual(newMirror1?.yearLabel, '2099-2100', 'New year carries the upstream label');
			assertEqual(newMirror1?.isArchived, false, 'The current EnrollPro active year is never archived');
			const oldMirror1 = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.oldYearId } },
				select: { isActive: true, isArchived: true },
			});
			assertEqual(oldMirror1?.isActive, false, 'Old year deactivated by the sync');
			assertEqual(oldMirror1?.isArchived, false, 'Old year NOT archived (archival pending)');
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' } }),
				1,
				'Sync executed exactly once in tick 1',
			);
			const cycleAfterTick1 = await prisma.teachingLoadCycle.findMany({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } });
			assertEqual(cycleAfterTick1.length, 1, 'TeachingLoadCycle created by tick 1');
			assertEqual(cycleAfterTick1[0]?.state, 'EMPTY', 'Cycle EMPTY after tick 1');

			//   Tick 2 (immediate, backoff not elapsed): skipped, no change.
			fakeOptions.schoolYearFailAfter = 0;
			const tick2 = await withInstrumentedFake(fakeOptions, () => tickRolloverAutomation(fixture.schoolId, {
				testModeEnabled: true,
				publishNotification: injectPublisher,
			}));
			assertEqual(tick2.action, 'skipped', 'Tick 2 skips while backoff has not elapsed');
			assert(String(tick2.detail ?? '').includes('Backoff'), 'Tick 2 detail names the backoff guard');

			//   Unreachable upstream between retries: marker stays pending.
			{
				resetAutomationState();
				const server = createFakeServer({
					'/api/integration/v1/health': (_req, res) => sendJson(res, 503, { error: 'unavailable' }),
				});
				const baseUrl = await startAndGetUrl(server);
				const origApi = process.env.ENROLLPRO_API;
				try {
					process.env.ENROLLPRO_API = baseUrl;
					const tickUnreachable = await tickRolloverAutomation(fixture.schoolId, {
						testModeEnabled: true,
						publishNotification: injectPublisher,
					});
					assertEqual(tickUnreachable.action, 'unreachable', 'Unreachable retry returns unreachable');
				} finally {
					if (origApi === undefined) delete process.env.ENROLLPRO_API;
					else process.env.ENROLLPRO_API = origApi;
					await stopServer(server);
				}
				const markerAfterUnreachable = await prisma.auditLog.findFirst({
					where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
					select: { metadata: true },
				});
				const phasesAfterUnreachable = (markerAfterUnreachable?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
				assertEqual(phasesAfterUnreachable?.archivesApplied, false, 'Unreachable retry leaves the marker pending');
			}

			//   Tick 3 (process restart, archival fails again): pending kept,
			// backoff advanced.
			resetAutomationState();
			const tick3 = await withInstrumentedFake(rr15aFakeOptions(fixture, { schoolYearFailAfter: 2 }), () => tickRolloverAutomation(fixture.schoolId, {
				testModeEnabled: true,
				publishNotification: injectPublisher,
			}));
			assertEqual(tick3.action, 'archive-pending', 'Tick 3 (retry failure) returns archive-pending');
			assertEqual(tick3.state.lastResult, 'partial-success', 'Tick 3 keeps partial-success while archival is pending');
			const markerBeforeHeal = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true, metadata: true },
			});
			const phasesBeforeHeal = (markerBeforeHeal?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phasesBeforeHeal?.archivesApplied, false, 'Archive retry failure preserves the marker (archivesApplied=false)');
			const oldMirrorBeforeHeal = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.oldYearId } },
				select: { isArchived: true },
			});
			assertEqual(oldMirrorBeforeHeal?.isArchived, false, 'Archive retry failure does not archive the old year');

			//   Tick 4 (process restart, healthy): pending marker detected
			// DESPITE aligned drift; archive-only completion.
			resetAutomationState();
			const markerId = markerBeforeHeal?.id;
			const syncAuditsBeforeHeal = await prisma.auditLog.count({
				where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' },
			});
			const tick4 = await withInstrumentedFake(rr15aFakeOptions(fixture), () => tickRolloverAutomation(fixture.schoolId, {
				testModeEnabled: true,
				publishNotification: injectPublisher,
			}));
			assertEqual(tick4.action, 'applied', 'Tick 4 completes the pending archival');
			assertEqual(tick4.state.lastResult, 'success', 'Tick 4 records success after archival completes');
			assertEqual(tick4.state.consecutiveFailures, 0, 'Tick 4 clears the failure/backoff state');
			const markerAfterHeal = await prisma.auditLog.findFirst({
				where: { schoolId: fixture.schoolId, action: 'TEST_YEAR_RECOVERY_CLEANUP' },
				select: { id: true, metadata: true },
			});
			assertEqual(markerAfterHeal?.id, markerId, 'Pending marker id unchanged through retries');
			const phasesAfterHeal = (markerAfterHeal?.metadata as Record<string, unknown> | null)?.phases as Record<string, boolean> | null;
			assertEqual(phasesAfterHeal?.cleared, true, 'Marker cleared=true after completion');
			assertEqual(phasesAfterHeal?.syncApplied, true, 'Marker syncApplied=true after completion');
			assertEqual(phasesAfterHeal?.archivesApplied, true, 'Marker archivesApplied=true after completion');
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'ROLLOVER_SYNC_APPLIED' } }),
				syncAuditsBeforeHeal,
				'Sync invocation count remains one across all ticks',
			);
			assertEqual(
				await prisma.auditLog.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId, action: 'TEST_YEAR_RECOVERY_CLEANUP' } }),
				1,
				'Destructive cleanup ran exactly once across all ticks',
			);
			const oldMirrorAfterHeal = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.oldYearId } },
				select: { isArchived: true },
			});
			assertEqual(oldMirrorAfterHeal?.isArchived, true, 'Superseded year archived by the retry completion');
			const newMirrorAfterHeal = await prisma.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: fixture.schoolId, enrollProSchoolYearId: fixture.newYearId } },
				select: { isArchived: true, isActive: true },
			});
			assertEqual(newMirrorAfterHeal?.isActive, true, 'New year still active after completion');
			assertEqual(newMirrorAfterHeal?.isArchived, false, 'Current active year never archived');
			assertEqual(
				await prisma.teachingLoadCycle.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.newYearId } }),
				1,
				'No duplicate TeachingLoadCycle across retries',
			);
			const completionTicks = tickEvents.filter((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED');
			assertEqual(completionTicks.length, 1, 'Exactly one complete-rollover notification (tick 4)');
			assertEqual(
				busEvents.filter((event) => event.type === 'TEST_YEAR_RECOVERY_COMPLETED').length,
				1,
				'Exactly one service completion notification',
			);
			assertEqual(
				busEvents.filter((event) => event.type === 'TEST_YEAR_RECOVERY_PARTIAL_SUCCESS').length,
				2,
				'Partial-success notification emitted per failing attempt only',
			);

			//   Tick 5: further ticks skip without duplicates.
			resetAutomationState();
			const auditsBeforeTick5 = await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } });
			const tick5 = await withInstrumentedFake(rr15aFakeOptions(fixture), () => tickRolloverAutomation(fixture.schoolId, {
				testModeEnabled: true,
				publishNotification: injectPublisher,
			}));
			assertEqual(tick5.action, 'skipped', 'Subsequent tick skips (aligned, no pending marker)');
			assertEqual(await prisma.auditLog.count({ where: { schoolId: fixture.schoolId } }), auditsBeforeTick5, 'Subsequent tick produces no duplicate audits');
			assertEqual(
				tickEvents.filter((event) => event.type === 'ROLLOVER_AUTO_SYNC_COMPLETED').length,
				1,
				'Subsequent tick emits no duplicate completion notification',
			);
			assertEqual(
				busEvents.filter((event) => event.type === 'TEST_YEAR_RECOVERY_COMPLETED').length,
				1,
				'Subsequent tick emits no duplicate service completion',
			);
		} finally {
			unsubscribe();
			const sandbox = await prisma.school.findFirst({ where: { name: 'RR15A Automation Archive Retry Sandbox' }, select: { id: true } });
			if (sandbox) await cleanupRr15aSandbox(sandbox.id);
		}
	}

	section('RR-15A: pending-marker guards (wrong school, wrong year, uncommitted sync, completed)');
	{
		const fixtureA = await setupRr15aFixture('RR15A Marker Guard School A', 991201, 991202);
		const fixtureB = await setupRr15aFixture('RR15A Marker Guard School B', 991301, 991302);
		try {
			// A pending marker on the RIGHT school/year is found...
			const pendingA = await craftRecoveryMarker(fixtureA.schoolId, fixtureA.newYearId, { cleared: true, syncApplied: true, archivesApplied: false }, fixtureA.oldYearId);
			const found = await findPendingArchiveRecoveryMarker(fixtureA.schoolId, fixtureA.newYearId);
			assert(found !== null, 'Pending marker found for its own school/year');
			assertEqual(found?.auditId, pendingA.id, 'Found marker is the crafted one');
			// ...but never for another year (wrong-year marker ignored)...
			const wrongYear = await findPendingArchiveRecoveryMarker(fixtureA.schoolId, fixtureA.newYearId + 1);
			assert(wrongYear === null, 'Wrong-year marker is ignored');
			// ...and never for another school (wrong-school marker ignored).
			const wrongSchool = await findPendingArchiveRecoveryMarker(fixtureB.schoolId, fixtureA.newYearId);
			assert(wrongSchool === null, 'Wrong-school marker is ignored');

			// A marker whose sync never committed is NOT archive-only.
			await craftRecoveryMarker(fixtureA.schoolId, fixtureA.oldYearId, { cleared: true, syncApplied: false, archivesApplied: false });
			const clearedOnly = await findPendingArchiveRecoveryMarker(fixtureA.schoolId, fixtureA.oldYearId);
			assert(clearedOnly === null, 'syncApplied=false marker is not treated as archive-only');

			// A completed marker is never retried.
			await craftRecoveryMarker(fixtureB.schoolId, fixtureB.newYearId, { cleared: true, syncApplied: true, archivesApplied: true });
			const completed = await findPendingArchiveRecoveryMarker(fixtureB.schoolId, fixtureB.newYearId);
			assert(completed === null, 'Completed marker is never retried');

			// Tick-level: aligned drift with a marker for a DIFFERENT year
			// must not trigger the archive-retry path (no apply call).
			let recoveryCalls = 0;
			const alignedDifferentYear = {
				schoolId: fixtureA.schoolId,
				atlasSchoolYearId: 999001,
				enrollProActiveYear: { id: 999001, yearLabel: '2199-2200' },
				drift: {
					status: 'aligned',
					message: 'ATLAS is aligned',
					recommendedAction: 'NONE',
					atlasSchoolYearId: 999001,
					enrollProSchoolYearId: 999001,
					enrollProSchoolYearLabel: '2199-2200',
					mirrorSyncedAt: null,
				},
				mirror: null,
				conflicts: [],
				reconfiguredSections: [],
				canResetDummyYear: false,
				resetTargetSchoolYearId: null,
				conflictingRecordCounts: null,
				teachingLoadResetRequired: false,
				publishedResetBlocked: false,
				testDataMarked: true,
			} as RolloverStatusResult;
			const result = await tickRolloverAutomation(fixtureA.schoolId, {
				testModeEnabled: true,
				fetchIntegrationHealth: async () => ({ reachable: true } as never),
				previewRollover: async () => alignedDifferentYear,
				applyTestRecovery: async () => {
					recoveryCalls += 1;
					return undefined as never;
				},
				publishNotification: () => ({} as never),
			});
			assertEqual(result.action, 'skipped', 'Aligned drift with a wrong-year marker skips (no archive retry)');
			assertEqual(recoveryCalls, 0, 'Wrong-year marker does not trigger the recovery apply');
			assertEqual(result.state.lastResult, 'skipped', 'No partial-success state recorded for a wrong-year marker');
		} finally {
			const schoolA = await prisma.school.findFirst({ where: { name: 'RR15A Marker Guard School A' }, select: { id: true } });
			if (schoolA) await cleanupRr15aSandbox(schoolA.id);
			const schoolB = await prisma.school.findFirst({ where: { name: 'RR15A Marker Guard School B' }, select: { id: true } });
			if (schoolB) await cleanupRr15aSandbox(schoolB.id);
		}
	}

	section('Live-state invariants after all tests');
	{
		const activeMirror = await prisma.enrollProSchoolYearMirror.findFirst({
			where: { schoolId: SCHOOL_ID, isActive: true },
			select: { enrollProSchoolYearId: true, yearLabel: true },
		});
		assert(activeMirror !== null, 'Active mirror exists');
		assertEqual(activeMirror?.enrollProSchoolYearId, effectiveYearId, `Active mirror year matches EnrollPro (${effectiveYearId})`);
		const activeFaculty = await prisma.facultyMirror.count({
			where: { schoolId: SCHOOL_ID, isActiveForScheduling: true, isStale: false },
		});
		assert(activeFaculty > 0, `At least 1 active faculty mirror (got ${activeFaculty})`);
		const fakeArtifacts = await prisma.sectionMirror.count({
			where: { schoolId: SCHOOL_ID, schoolYearId: { in: [888881, 999976, 999999] } },
		});
		assertEqual(fakeArtifacts, 0, 'No fake-year section mirror artifacts remain');
	}

	console.log(`\nRollover automation test complete: ${passCount} passed, ${failCount} failed.`);
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
		for (const name of ['RR15A Automation Archive Retry Sandbox', 'RR15A Marker Guard School A', 'RR15A Marker Guard School B']) {
			const sandbox = await prisma.school.findFirst({ where: { name }, select: { id: true } });
			if (sandbox) await cleanupRr15aSandbox(sandbox.id);
		}
		await prisma.$disconnect();
	});
