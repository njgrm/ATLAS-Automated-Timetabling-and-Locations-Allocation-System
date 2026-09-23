import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';
import { getViolationRepairOptions, parseViolationRepairLocator, type ViolationRepairLocator } from '../services/violation-repair-options.service.js';
import { getFixSuggestions } from '../services/fix-suggestions.service.js';
import { validateHardConstraints, type ScheduledEntry, type Violation, type ViolationCode } from '../services/constraint-validator.js';
import { buildValidatorCtx, previewManualEdit } from '../services/manual-edit.service.js';

const SECRET = 'timetable-scheduling-quality-c03-secret';
const RUN_PATH = '/api/v1/generation/1/10/runs/316/violation-repair-options';

async function withRepairServer<T>(fn: (request: (body: unknown, actor?: Record<string, unknown>) => Promise<Response>, dispatches: () => number, writes: () => number) => Promise<T>, runValue: unknown = null, path = RUN_PATH, referenceData?: Record<string, any>): Promise<T> {
	process.env.JWT_SECRET = SECRET;
	let dbDispatches = 0;
	let writeAttempts = 0;
	const read = async () => runValue;
	const write = async () => { writeAttempts += 1; throw new Error('read-only repair route attempted a write'); };
	const readMethods = new Set(['findFirst', 'findMany', 'findUnique', 'findUniqueOrThrow', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy']);
	const writeMethods = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
	const instrumentDelegate = (source: Record<string, unknown>) => new Proxy(source, {
		get(target, key: string) {
			if (writeMethods.has(key)) return write;
			const existing = Reflect.get(target, key);
			if (typeof existing === 'function') return async (...args: unknown[]) => { dbDispatches += 1; return existing(...args); };
			if (readMethods.has(key)) return async () => { dbDispatches += 1; return []; };
			return existing;
		},
	});
	const model = (overrides: Record<string, unknown> = {}) => instrumentDelegate(overrides);
	const client = new Proxy({
		generationRun: model({ findFirst: read, findMany: read, findUnique: read }),
		facultyMirror: model({ findMany: async () => (referenceData?.faculty ?? []).map((faculty: any) => ({ firstName: 'Teacher', lastName: 'Twelve', ...faculty })) }),
		facultySubject: model({ findMany: async () => referenceData?.facultySubjects ?? [] }),
		room: model({ findMany: async () => referenceData?.rooms ?? [] }),
		subject: model({ findMany: async () => referenceData?.subjects ?? [] }),
		building: model({ findMany: async () => referenceData?.buildings ?? [] }),
		sectionSnapshot: model({ findUnique: async () => ({ payload: [{ displayOrder: 7, sections: [{ id: 7, name: '7-Cedar', enrolledCount: 20 }, { id: 8, name: '8-Ash', enrolledCount: 20 }] }] }) }),
		policySpecialEvent: model({ findMany: async () => [] }),
		gradeShiftWindow: model({ findMany: async () => [] }),
		classProgramSlot: model({ findMany: async () => [] }),
		schedulingPolicy: model({ findUnique: async () => referenceData?.policyRecord ?? null }),
	}, {
		get(target, key: string) {
			if (key === '$transaction' || key === '$executeRaw' || key === '$executeRawUnsafe') return write;
			if (key === '$queryRaw' || key === '$queryRawUnsafe') return async () => { dbDispatches += 1; return []; };
			const existing = Reflect.get(target, key);
			return existing ?? model();
		},
	});
	const generationRouter = (await import('../routes/generation.router.js')).default;
	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => { void withDataContext(client as never, async () => next()); });
	app.use('/api/v1/generation', generationRouter);
	app.use((error: { statusCode?: number; code?: string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(error.statusCode ?? 400).json({ code: error.code ?? 'TEST_ERROR', message: error.message ?? 'Request failed.' });
	});
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		const baseUrl = `http://127.0.0.1:${address.port}${path}`;
		const request = (body: unknown, actor: Record<string, unknown> = { userId: 46, role: 'officer', schoolId: 1 }) => fetch(baseUrl, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${jwt.sign(actor, SECRET, { expiresIn: '5m' })}`,
				'content-type': 'application/json',
			},
			body: JSON.stringify(body),
		});
		return await fn(request, () => dbDispatches, () => writeAttempts);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
}

const locator = {
	code: 'FACULTY_TIME_CONFLICT',
	termIndex: 1,
	entryIds: ['entry-a', 'entry-b'],
	facultyId: 12,
	day: 'MONDAY',
	startTime: '08:00',
	endTime: '08:45',
};

function canonicalConflictFixture() {
	const entries: ScheduledEntry[] = [
		{ entryId: 'entry-a', facultyId: 12, roomId: 30, subjectId: 4, sectionId: 7, day: 'MONDAY', startTime: '08:00', endTime: '08:45', durationMinutes: 45, termIndex: 1 },
		{ entryId: 'entry-b', facultyId: 12, roomId: 31, subjectId: 5, sectionId: 8, day: 'MONDAY', startTime: '08:00', endTime: '08:45', durationMinutes: 45, termIndex: 1 },
	];
	const rooms = [30, 31].map((id) => ({ id, name: `Room ${id}`, type: 'CLASSROOM', isTeachingSpace: true, isSharedFacility: false, capacity: 40, features: [], floor: 0, buildingId: 1, buildingGradeScope: [7, 8], building: { gradeScope: [7, 8], name: 'Main', shortCode: 'M' } }));
	const subjects = [4, 5].map((id) => ({ id, code: `SUB${id}`, name: `Subject ${id}`, minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', requiredFeatures: [], gradeLevels: [7, 8] }));
	const policyRecord = {
		maxConsecutiveTeachingMinutesBeforeBreak: 135, periodLengthMinutes: 45, minBreakMinutesAfterConsecutiveBlock: 15,
		maxTeachingMinutesPerDay: 480, earliestStartTime: '07:00', latestEndTime: '17:00', enforceConsecutiveBreakAsHard: false,
		maxBuildingTransitionsPerDay: 10, maxBackToBackTransitionsWithoutBuffer: 10, maxIdleGapMinutesPerDay: 480,
		avoidEarlyFirstPeriod: false, avoidLateLastPeriod: false, enableVacantAwareConstraints: false,
		targetFacultyDailyVacantMinutes: 0, targetSectionDailyVacantPeriods: 0, maxCompressedTeachingMinutesPerDay: 480,
		constraintConfig: {},
	};
	const refData = {
		run: { id: 316, schoolId: 1, schoolYearId: 10, status: 'COMPLETED', summary: { isPublished: false }, draftEntries: entries, unassignedItems: [], violations: [] },
		entries, unassignedItems: [], faculty: [{ id: 12, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 }],
		facultySubjects: [4, 5].map((subjectId, index) => ({ facultyId: 12, subjectId, gradeLevels: [7, 8], sectionIds: [7 + index] })),
		rooms, subjects, policyRecord, buildings: [{ id: 1, x: 0, y: 0 }],
		facultyNameMap: new Map([[12, 'Teacher Twelve']]), roomNameMap: new Map([[30, 'Room 30 · Main'], [31, 'Room 31 · Main']]),
		subjectNameMap: new Map([[4, 'SUB4'], [5, 'SUB5']]), subjectNameDetailMap: new Map([[4, 'Subject 4'], [5, 'Subject 5']]),
		sectionEnrollment: new Map([[7, 20], [8, 20]]), sectionGradeLevel: new Map([[7, 7], [8, 8]]),
		windowAuthority: { breakWindows: [], shiftWindows: [], sectionScope: new Map() },
	};
	const violations = validateHardConstraints(buildValidatorCtx(1, 10, 316, entries, refData as never)).violations;
	const run = { ...refData.run, violations };
	return { refData: { ...refData, run }, run, violations };
}

test('C03 route rejects malformed/coerced locator identities and cross-school actors before dispatch', async () => {
	await withRepairServer(async (request, dispatches) => {
		for (const body of [null, [], 'locator', { ...locator, termIndex: '1' }, { ...locator, entryIds: [1, 2] }]) {
			const response = await request(body);
			assert.equal(response.status, 400, `rejected locator ${JSON.stringify(body)}`);
		}
		const crossSchool = await request(locator, { userId: 46, role: 'officer', schoolId: 2 });
		assert.equal(crossSchool.status, 403);
		const missingSchool = await request(locator, { userId: 46, role: 'officer' });
		assert.equal(missingSchool.status, 403);
		assert.equal(dispatches(), 0, 'invalid body and actor scope must dispatch no database work');
	}, null);
	await withRepairServer(async (request, dispatches, writes) => {
		assert.equal((await request(locator, { userId: 46, role: 'officer', schoolId: '1' })).status, 403);
		assert.equal(dispatches(), 0);
		assert.equal(writes(), 0);
	}, null);
	await withRepairServer(async (request, dispatches, writes) => {
		assert.equal((await request(locator)).status, 400);
		assert.equal(dispatches(), 0);
		assert.equal(writes(), 0);
	}, null, '/api/v1/generation/01/10/runs/316/violation-repair-options');
});

test('C03 route reloads canonical run state and rejects a missing run without writes', async () => {
	await withRepairServer(async (request, dispatches, writes) => {
		const response = await request(locator);
		assert.equal(response.status, 404);
		assert.ok(dispatches() > 0, 'a scoped canonical run lookup is required');
		assert.equal(writes(), 0);
	}, null);
});

test('C03 route returns canonical issue identity and does not trust client severity/message', async () => {
	const canonical: Violation = {
		code: 'ZONE_IMBALANCE_WARNING', severity: 'SOFT', message: 'Saved historical warning.', schoolId: 1, schoolYearId: 10, runId: 316,
		entities: { sectionId: 7, day: 'MONDAY', entryIds: [] }, meta: { termIndex: 1 },
	};
	const run = { id: 316, schoolYearId: 10, status: 'COMPLETED', violations: [canonical], draftEntries: [], summary: {} };
	await withRepairServer(async (request, dispatches, writes) => {
		const response = await request({ code: 'ZONE_IMBALANCE_WARNING', termIndex: 1, entryIds: [], sectionId: 7, severity: 'HARD', message: 'client supplied text' });
		assert.equal(response.status, 200);
		const body = await response.json() as { status: string; violation: Violation; options: unknown[]; blockers: string[] };
		assert.equal(body.status, 'NO_SAFE_REPAIR');
		assert.equal(body.violation.severity, 'SOFT');
		assert.equal(body.violation.message, canonical.message);
		assert.deepEqual(body.options, []);
		assert.ok(body.blockers.length > 0);
		assert.ok(dispatches() > 0);
		assert.equal(writes(), 0);
	}, run);
});

test('C03 locator parser accepts only a strict object and exact numeric/string identities', () => {
	assert.equal(parseViolationRepairLocator({ ...locator, severity: 'SOFT', message: 'client text' })?.code, 'FACULTY_TIME_CONFLICT');
	for (const value of [null, [], 'issue', { ...locator, termIndex: '1' }, { ...locator, facultyId: '12' }, { ...locator, entryIds: [12] }, { ...locator, entryIds: ['entry-a', 'entry-a'] }, { code: 'MADE_UP', termIndex: 1, entryIds: ['entry-a'] }]) {
		assert.equal(parseViolationRepairLocator(value), null, `invalid locator ${JSON.stringify(value)}`);
	}
});

test('C03 service rejects stale and ambiguous locators and returns no invented option for legacy issues', async () => {
	const baseIssue: Violation = {
		code: 'ZONE_IMBALANCE_WARNING', severity: 'SOFT', message: 'Older saved warning.', schoolId: 1, schoolYearId: 10, runId: 316,
		entities: { sectionId: 7, day: 'MONDAY', entryIds: [] }, meta: { termIndex: 1 },
	};
	const run = { id: 316, status: 'COMPLETED', violations: [baseIssue], draftEntries: [], summary: {} } as any;
	const dependencies = {
		loadRun: async () => run,
		preview: async () => { throw new Error('no entry-based proposal is expected'); },
		now: () => new Date('2030-01-02T03:04:05.000Z'),
	};
	const legacyLocator: ViolationRepairLocator = { code: 'ZONE_IMBALANCE_WARNING', termIndex: 1, entryIds: [], sectionId: 7 };
	const noSafe = await getViolationRepairOptions(1, 10, 316, legacyLocator, dependencies as never);
	assert.equal(noSafe.status, 'NO_SAFE_REPAIR');
	assert.equal(noSafe.options.length, 0);
	assert.equal(noSafe.verifiedAt, '2030-01-02T03:04:05.000Z');
	assert.ok(noSafe.blockers.length > 0);
	await assert.rejects(
		getViolationRepairOptions(1, 10, 316, { ...legacyLocator, sectionId: 9 }, dependencies as never),
		(error: unknown) => (error as { code?: string }).code === 'VIOLATION_NOT_FOUND',
	);
	await assert.rejects(
		getViolationRepairOptions(1, 10, 316, legacyLocator, {
			...dependencies,
			loadRun: async () => ({ ...run, violations: [baseIssue, baseIssue] }) as never,
		} as never),
		(error: unknown) => (error as { code?: string }).code === 'AMBIGUOUS_VIOLATION',
	);
});

test('C03 repairable previews remove the selected issue and reject any newly introduced hard violation', async () => {
	const conflict: Violation = {
		code: 'FACULTY_TIME_CONFLICT', severity: 'HARD', message: 'Teacher is double-booked.', schoolId: 1, schoolYearId: 10, runId: 316,
		entities: { facultyId: 12, day: 'MONDAY', startTime: '08:00', endTime: '08:45', entryIds: ['entry-a', 'entry-b'] }, meta: { termIndex: 1 },
	};
	const entry = { entryId: 'entry-a', sectionId: 7, subjectId: 4, facultyId: 12, roomId: 30, day: 'MONDAY', startTime: '08:00', endTime: '08:45', durationMinutes: 45, termIndex: 1 };
	const run = { id: 316, status: 'COMPLETED', violations: [conflict], draftEntries: [entry], summary: { timetableDisplaySlots: [{ startTime: '08:00', endTime: '08:45' }] } } as any;
	let previewCalls = 0;
	const preview = async () => {
		previewCalls += 1;
		return { allowed: true, hardViolations: [], softViolations: [], violationDelta: { hardBefore: 1, hardAfter: 0, softBefore: 0, softAfter: 0 }, humanConflicts: [], affectedEntries: [], policyImpactSummary: [] };
	};
	const repairLocator: ViolationRepairLocator = { code: 'FACULTY_TIME_CONFLICT', termIndex: 1, entryIds: ['entry-a', 'entry-b'], facultyId: 12, day: 'MONDAY', startTime: '08:00', endTime: '08:45' };
	const options = await getViolationRepairOptions(1, 10, 316, repairLocator, {
		loadRun: async () => run,
		preview: preview as never,
		now: () => new Date('2030-01-02T03:04:05.000Z'),
	} as never);
	assert.equal(options.status, 'REPAIRABLE');
	assert.ok(options.options.length > 0);
	assert.ok(previewCalls > 0);
	assert.equal(options.options.every((option) => option.projectedDelta.hardAfter <= option.projectedDelta.hardBefore && option.projectedDelta.targetIssuesAfter < option.projectedDelta.targetIssuesBefore), true);
	const unsafe = await getViolationRepairOptions(1, 10, 316, repairLocator, {
		loadRun: async () => run,
		preview: (async () => ({
			allowed: false,
			hardViolations: [{ ...conflict, code: 'SECTION_TIME_CONFLICT', entities: { sectionId: 7, day: 'TUESDAY', entryIds: ['entry-z'] } }],
			softViolations: [],
			violationDelta: { hardBefore: 1, hardAfter: 2, softBefore: 0, softAfter: 0 },
			humanConflicts: [], affectedEntries: [], policyImpactSummary: [],
		})) as never,
		now: () => new Date('2030-01-02T03:04:05.000Z'),
	} as never);
	assert.notEqual(unsafe.status, 'REPAIRABLE');
	assert.equal(unsafe.options.length, 0);
});

test('C03 real validator conflict reaches real manual-edit preview and the mounted repair route', async () => {
	const fixture = canonicalConflictFixture();
	const target = fixture.violations.find((violation) => violation.code === 'FACULTY_TIME_CONFLICT');
	assert.ok(target, 'the production constraint validator must create the canonical issue');
	const proposal = { editType: 'CHANGE_TIMESLOT' as const, entryId: 'entry-a', targetDay: 'TUESDAY', targetStartTime: '08:00', targetEndTime: '08:45' };
	const preview = await previewManualEdit(316, 1, 10, proposal, { loadRunContext: async () => fixture.refData as never });
	assert.equal(preview.violationDelta.hardAfter, 0);
	assert.ok(!preview.hardViolations.some((violation) => violation.code === 'FACULTY_TIME_CONFLICT'));
	assert.equal(preview.hardViolations.some((violation) => violation.code !== target.code), false);
	const requestBody = {
		code: target.code, termIndex: 1, entryIds: target.entities.entryIds,
		facultyId: target.entities.facultyId, day: target.entities.day,
		startTime: target.entities.startTime, endTime: target.entities.endTime,
	};
	await withRepairServer(async (request, dispatches, writes) => {
		const response = await request(requestBody);
		assert.equal(response.status, 200, 'route must match the actual validator issue and invoke its real preview path');
		const body = await response.json() as { status: string; options: Array<{ proposal: { editType: string }; projectedDelta: { hardAfter: number; hardBefore: number } }> };
		assert.equal(body.status, 'REPAIRABLE');
		assert.ok(body.options.length > 0);
		assert.ok(body.options.every((option) => option.proposal.editType === 'CHANGE_TIMESLOT' && option.projectedDelta.hardAfter <= option.projectedDelta.hardBefore));
		assert.ok(dispatches() > 0);
		assert.equal(writes(), 0, 'route, real loader, and real preview must use no model/raw/transaction writes');
	}, fixture.run, RUN_PATH, fixture.refData);
});

test('C03 every persisted violation family fails closed without an entry-backed verified preview', async () => {
	const codes: ViolationCode[] = [
		'FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'SECTION_TIME_CONFLICT', 'FACULTY_OVERLOAD',
		'ROOM_TYPE_MISMATCH', 'ROOM_FEATURE_MISMATCH', 'ROOM_CAPACITY_EXCEEDED', 'FACULTY_SUBJECT_NOT_QUALIFIED',
		'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'FACULTY_BREAK_REQUIREMENT_VIOLATED', 'FACULTY_DAILY_STANDARD_EXCEEDED',
		'FACULTY_DAILY_MAX_EXCEEDED', 'FACULTY_FLOOR_TRANSITION', 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
		'FACULTY_INSUFFICIENT_TRANSITION_BUFFER', 'FACULTY_EXCESSIVE_IDLE_GAP', 'FACULTY_EARLY_START_PREFERENCE',
		'FACULTY_LATE_END_PREFERENCE', 'FACULTY_INSUFFICIENT_DAILY_VACANT', 'SPECIALIZED_ROOM_UNAVAILABLE',
		'UNASSIGNED_SECTION', 'ZONE_IMBALANCE_WARNING', 'SECTION_OVERCOMPRESSED', 'LACKING_FACULTY', 'INCOMPLETE_MODULAR_GROUP',
	];
	for (const code of codes) {
		const violation: Violation = {
			code, severity: 'HARD', message: 'Saved canonical issue.', schoolId: 1, schoolYearId: 10, runId: 316,
			entities: { sectionId: 7, entryIds: [] }, meta: { termIndex: 1 },
		};
		const response = await getViolationRepairOptions(1, 10, 316, { code, termIndex: 1, entryIds: [], sectionId: 7 }, {
			loadRun: async () => ({ id: 316, status: 'COMPLETED', violations: [violation], draftEntries: [], summary: {} }) as never,
			preview: async () => { throw new Error('without affected canonical entries, no repair proposal is allowed'); },
			now: () => new Date('2030-01-02T03:04:05.000Z'),
		} as never);
		assert.notEqual(response.status, 'REPAIRABLE', `${code} must not produce an unverified option`);
		assert.deepEqual(response.options, [], `${code} has no affected entry for a valid preview`);
		assert.ok(response.blockers.length > 0, `${code} must explain its limitation`);
	}
});

test('C03 unassigned guidance is actor-school scoped and matches a canonical ordered-term item', async () => {
	const item = { sectionId: 7, subjectId: 4, gradeLevel: 7, session: 2, termIndex: 2, reason: 'ROOM_CAPACITY_EXCEEDED', entryKind: 'SECTION' };
	const run = { id: 316, status: 'COMPLETED', schoolYearId: 10, unassignedItems: [item], draftEntries: [], summary: {}, violations: [] };
	const path = '/api/v1/generation/1/10/runs/316/fix-suggestions';
	await withRepairServer(async (request, dispatches, writes) => {
		for (const body of [{ ...item, termIndex: '2' }, { ...item, sectionId: '7' }]) {
			assert.equal((await request(body)).status, 400);
		}
		assert.equal(dispatches(), 0, 'coerced request identities must not load the run');
		const stale = await request({ ...item, termIndex: 1 });
		assert.equal(stale.status, 404);
		const valid = await request(item);
		assert.equal(valid.status, 200);
		const body = await valid.json() as { item: typeof item; explanation: { suggestions: Array<{ feasibility?: string }> } };
		assert.equal(body.item.termIndex, 2);
		assert.ok(body.explanation.suggestions.every((suggestion) => suggestion.feasibility === 'GUIDANCE_ONLY'));
		assert.ok(dispatches() > 0);
		assert.equal(writes(), 0);
	}, run, path);
});

test('C03 unassigned options are marked feasible only after the canonical solver verifies ordered-term placement and room safety', async () => {
	const item = { sectionId: 7, subjectId: 4, gradeLevel: 7, session: 2, termIndex: 2 as const, reason: 'ROOM_CAPACITY_EXCEEDED' as const };
	const placed = { sectionId: 7, subjectId: 4, session: 2, termIndex: 2 as const, day: 'WEDNESDAY', startTime: '09:00', endTime: '09:45', roomId: 30, roomName: 'R30', facultyId: 12, facultyName: 'Teacher' };
	const safe = await getFixSuggestions(1, 10, 316, item, {
		solve: (async () => ({ placed: [placed], newEntries: [{ ...placed, entryId: 'verified-entry' }], violations: [] })) as never,
	});
	const verified = safe.explanation.suggestions.find((suggestion) => suggestion.feasibility === 'VERIFIED_FEASIBLE');
	assert.ok(verified);
	assert.equal(verified.proposal?.termIndex, 2);
	assert.equal(verified.proposal?.targetRoomId, 30);
	const unsafe = await getFixSuggestions(1, 10, 316, item, {
		solve: (async () => ({ placed: [placed], newEntries: [{ ...placed, entryId: 'verified-entry' }], violations: [{
			code: 'ROOM_CAPACITY_EXCEEDED', severity: 'HARD', message: 'Room is too small.', schoolId: 1, schoolYearId: 10, runId: 316,
			entities: { sectionId: 7, subjectId: 4, entryIds: ['verified-entry'] }, meta: { termIndex: 2 },
		}] })) as never,
	});
	assert.equal(unsafe.explanation.suggestions.some((suggestion) => suggestion.feasibility === 'VERIFIED_FEASIBLE'), false);
	assert.ok(unsafe.explanation.suggestions.every((suggestion) => suggestion.feasibility === 'GUIDANCE_ONLY'));
});
