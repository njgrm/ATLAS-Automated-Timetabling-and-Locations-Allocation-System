import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';

import { withDataContext } from '../lib/data-context.js';
import { buildViolationReport } from '../services/generation.service.js';
import { VIOLATION_CODES, VIOLATION_COPY, validateHardConstraints, type ScheduledEntry, type Violation, type ViolationCopy } from '../services/constraint-validator.js';

function assertCopyComplete(codes: readonly string[], copy: Record<string, ViolationCopy>): void {
	const jargon = ['treatAsHard', 'entryId', 'termIndex', 'blockEntryIds', 'UNSPECIFIED', 'CAS', 'DTO'];
	for (const code of codes) {
		const entry = copy[code];
		assert.ok(entry, `${code} needs operator copy`);
		assert.ok(entry.title.trim().length > 0, `${code} needs a title`);
		assert.ok(entry.meaning.trim().length > 0, `${code} needs a meaning`);
		assert.ok(entry.action.trim().length > 0, `${code} needs a next action`);
		assert.doesNotMatch(entry.meaning, /\n/, `${code} meaning must be one sentence on one line`);
		for (const token of jargon) {
			assert.doesNotMatch(`${entry.title} ${entry.meaning} ${entry.action}`, new RegExp(token), `${code} copy must not leak internal jargon (${token})`);
		}
		assert.doesNotMatch(`${entry.title} ${entry.meaning} ${entry.action}`, new RegExp(code, 'i'), `${code} copy must not repeat the raw code`);
	}
}

test('R1: every canonical VIOLATION_CODES entry has plain title, meaning, and next action', () => {
	assert.ok(VIOLATION_CODES.length >= 20, 'the test must enumerate the production canonical set');
	assertCopyComplete(VIOLATION_CODES, VIOLATION_COPY as Record<string, ViolationCopy>);
});

test('R1/mutant: the coverage check fails when one code loses its copy', () => {
	const gapped = { ...(VIOLATION_COPY as Record<string, ViolationCopy>) };
	delete gapped[VIOLATION_CODES[0]];
	assert.throws(() => assertCopyComplete(VIOLATION_CODES, gapped), new RegExp(VIOLATION_CODES[0]));
});

test('R6: no violation template uses an ambiguous time arrow', () => {
	const source = readFileSync(new URL('../services/constraint-validator.ts', import.meta.url), 'utf8');
	const templates = Array.from(source.matchAll(/message:\s*`([^`]+)`/g)).map((match) => match[1]);
	assert.ok(templates.length >= 15, 'the scan must cover the production template set');
	for (const template of templates) {
		// Time movement is stated in words ("finishes ... at 14:30 and starts
		// ... at 14:30"), never as an arrow that can read as zero-length.
		assert.doesNotMatch(template, /->|→/, `template must state time movement in words: ${template}`);
	}
});

test('R2: the consecutive-limit message states minutes, periods, and the named limit', () => {
	const scheduled: ScheduledEntry[] = [0, 1, 2, 3].map((index) => ({
		entryId: `block-${index}`,
		termIndex: 1,
		facultyId: 16,
		roomId: 1,
		subjectId: 1,
		sectionId: 1,
		day: 'MONDAY',
		startTime: ['09:15', '10:00', '10:45', '11:30'][index],
		endTime: ['10:00', '10:45', '11:30', '12:15'][index],
		durationMinutes: 45,
	}));
	const result = validateHardConstraints({
		...base,
		entries: scheduled,
		faculty: [{ id: 16, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 16, subjectId: 1, sectionIds: [1] }],
		rooms: [{ id: 1, type: 'CLASSROOM', capacity: 50, features: [] }],
		subjects: [{ id: 1, preferredRoomType: 'CLASSROOM', requiredFeatures: [] }],
		policy: {
			periodLengthMinutes: 45,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			earliestStartTime: '06:00',
			latestEndTime: '14:30',
			enforceConsecutiveBreakAsHard: false,
		},
		breakWindows: [],
	});
	const consecutive = result.violations.find((item) => item.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.ok(consecutive, 'four contiguous 45-minute periods must trip the consecutive limit');
	assert.match(consecutive.message, /180 consecutive minutes \(4 periods\)/);
	assert.match(consecutive.message, /135-minute limit/);
	assert.doesNotMatch(consecutive.message, /\bmin\b/, 'no bare minute abbreviation remains');
});

const base = {
	schoolId: 1,
	schoolYearId: 10,
	runId: 316,
};

function warning(
	code: Violation['code'],
	termIndex: number,
	entryIds: string[],
	overrides: Partial<Violation> = {},
): Violation {
	return {
		...base,
		code,
		severity: 'SOFT',
		message: `${code} internal message`,
		entities: { facultyId: 16, day: 'MONDAY', entryIds },
		meta: { termIndex },
		...overrides,
	};
}

const entries = [1, 2].flatMap((termIndex) => [
	{ entryId: `entry-523::t${termIndex}`, termIndex, facultyId: 16, roomId: 1, subjectId: 1, sectionId: 1, day: 'MONDAY', startTime: '09:15', endTime: '10:00', durationMinutes: 45 },
	{ entryId: `entry-524::t${termIndex}`, termIndex, facultyId: 16, roomId: 2, subjectId: 2, sectionId: 1, day: 'MONDAY', startTime: '10:00', endTime: '10:45', durationMinutes: 45 },
]) as ScheduledEntry[];

test('R3/R4: route projection counts unique issues inside a term but preserves the same issue across terms', () => {
	const t1Ids = ['entry-523::t1', 'entry-524::t1'];
	const t2Ids = ['entry-523::t2', 'entry-524::t2'];
	const report = buildViolationReport({
		id: 316,
		status: 'COMPLETED',
		draftEntries: entries,
		summary: {},
		violations: [
			warning('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 1, t1Ids),
			warning('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 1, [...t1Ids]),
			warning('FACULTY_INSUFFICIENT_TRANSITION_BUFFER', 1, t1Ids),
			warning('FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 2, t2Ids),
		],
	}, undefined);

	assert.equal(report.violations.length, 2, 'one faculty/day situation remains independently visible in each term');
	assert.equal(report.counts.total, report.violations.length, 'API count and detail list share one projection');
	assert.equal(report.counts.runWide.total, report.violations.length, 'run-wide display count uses the same unique-issue semantics');
	assert.deepEqual(report.violations.map((item) => item.meta?.termIndex), [1, 2]);
	assert.deepEqual(
		report.violations[0].meta?.relatedCodes,
		['FACULTY_CONSECUTIVE_LIMIT_EXCEEDED', 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER'],
		'overlapping warning classes remain supporting detail on one issue',
	);
});

test('R3: selected-term counts are computed from the same projected detail array', () => {
	const report = buildViolationReport({
		id: 316,
		status: 'COMPLETED',
		draftEntries: entries,
		summary: {},
		violations: [
			warning('FACULTY_EXCESSIVE_IDLE_GAP', 1, ['entry-523::t1']),
			warning('FACULTY_EXCESSIVE_IDLE_GAP', 1, ['entry-523::t1']),
			warning('FACULTY_EXCESSIVE_IDLE_GAP', 2, ['entry-523::t2']),
		],
	}, 1);

	assert.equal(report.counts.scope, 'SELECTED_TERM');
	assert.equal(report.violations.length, 1);
	assert.equal(report.counts.total, 1);
	assert.equal(report.counts.byCode.FACULTY_EXCESSIVE_IDLE_GAP, 1);
});

test('R5: an UNSPECIFIED zone is omitted from the operator schedule-warning projection', () => {
	const report = buildViolationReport({
		id: 316,
		status: 'COMPLETED',
		draftEntries: entries,
		summary: {},
		violations: [
			warning('ZONE_IMBALANCE_WARNING', 1, ['entry-523::t1'], { meta: { termIndex: 1, zone: 'UNSPECIFIED', percent: 100 } }),
			warning('ZONE_IMBALANCE_WARNING', 2, ['entry-523::t2'], { meta: { termIndex: 2, zone: 'North', percent: 70 } }),
		],
	}, undefined);

	assert.deepEqual(report.violations.map((item) => item.meta?.zone), ['North']);
	assert.equal(report.counts.total, 1);
});

test('R6: floor-transition producer states both floors and timestamps instead of an ambiguous zero-length arrow', () => {
	const scheduled: ScheduledEntry[] = [
		{ entryId: 'a', termIndex: 1, facultyId: 16, roomId: 1, subjectId: 1, sectionId: 1, day: 'MONDAY', startTime: '13:45', endTime: '14:30', durationMinutes: 45 },
		{ entryId: 'b', termIndex: 1, facultyId: 16, roomId: 2, subjectId: 2, sectionId: 2, day: 'MONDAY', startTime: '14:30', endTime: '15:15', durationMinutes: 45 },
	];
	const result = validateHardConstraints({
		...base,
		entries: scheduled,
		faculty: [{ id: 16, maxHoursPerWeek: 40 }],
		facultySubjects: [{ facultyId: 16, subjectId: 1, sectionIds: [1] }, { facultyId: 16, subjectId: 2, sectionIds: [2] }],
		rooms: [
			{ id: 1, type: 'CLASSROOM', capacity: 50, features: [], floor: 1 },
			{ id: 2, type: 'CLASSROOM', capacity: 50, features: [], floor: 4 },
		],
		subjects: [
			{ id: 1, preferredRoomType: 'CLASSROOM', requiredFeatures: [] },
			{ id: 2, preferredRoomType: 'CLASSROOM', requiredFeatures: [] },
		],
		roomBuildings: [{ roomId: 1, buildingId: 8 }, { roomId: 2, buildingId: 8 }],
		travelPolicy: {
			maxBuildingTransitionsPerDay: 4,
			maxBackToBackTransitionsWithoutBuffer: 2,
			maxIdleGapMinutesPerDay: 120,
			avoidEarlyFirstPeriod: false,
			avoidLateLastPeriod: false,
			floorTransitionThreshold: 3,
			floorTransitionBufferMinutes: 5,
		},
	});
	const floor = result.violations.find((item) => item.code === 'FACULTY_FLOOR_TRANSITION');
	assert.ok(floor);
	assert.match(floor.message, /finishes on floor 1 at 14:30/i);
	assert.match(floor.message, /starts on floor 4 at 14:30/i);
	assert.doesNotMatch(floor.message, /14:30\s*(?:→|->)\s*14:30/);
});

test('R3/S1: mounted warning routes preserve count parity and reject unbound actor schools before dispatch', async () => {
	process.env.JWT_SECRET = 'warning-readability-c01-secret-value';
	const generationRouter = (await import('../routes/generation.router.js')).default;
	let dispatches = 0;
	const run = {
		id: 316,
		schoolYearId: 10,
		status: 'COMPLETED',
		createdAt: new Date('2030-01-01T00:00:00.000Z'),
		draftEntries: entries,
		summary: {},
		violations: [
			warning('FACULTY_EXCESSIVE_IDLE_GAP', 1, ['entry-523::t1']),
			warning('FACULTY_EXCESSIVE_IDLE_GAP', 1, ['entry-523::t1']),
		],
	};
	const client = {
		generationRun: {
			findFirst: async () => { dispatches += 1; return run; },
			findMany: async () => { dispatches += 1; return [run]; },
			findUnique: async () => { dispatches += 1; return run; },
		},
		facultyMirror: { findMany: async () => { dispatches += 1; return [{ id: 16 }]; } },
	};
	const app = express();
	app.use((_req, _res, next) => { void withDataContext(client as never, async () => next()); });
	app.use('/api/v1/generation', generationRouter);
	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	try {
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		const baseUrl = `http://127.0.0.1:${address.port}/api/v1/generation/1/10`;
		const request = (path: string, payload: Record<string, unknown>) => fetch(`${baseUrl}${path}`, {
			headers: { authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '5m' })}` },
		});
		const response = await request('/runs/316/violations', { userId: 46, role: 'officer', schoolId: 1 });
		const body = await response.json() as { violations: Violation[]; counts: { total: number } };
		assert.equal(response.status, 200);
		assert.equal(body.violations.length, 1);
		assert.equal(body.counts.total, body.violations.length);
		const afterSameSchool = dispatches;
		for (const path of ['/runs/316/violations', '/runs/latest/violations']) {
			const crossSchool = await request(path, { userId: 46, role: 'officer', schoolId: 2 });
			assert.equal(crossSchool.status, 403);
			assert.equal((await crossSchool.json() as { code: string }).code, 'CROSS_SCHOOL_DENIED');
			const missingSchool = await request(path, { userId: 46, role: 'officer' });
			assert.equal(missingSchool.status, 403);
			assert.equal((await missingSchool.json() as { code: string }).code, 'SCHOOL_SCOPE_REQUIRED');
			const unboundSystemAdmin = await request(path, { userId: 1, role: 'SYSTEM_ADMIN' });
			assert.equal(unboundSystemAdmin.status, 403, 'SYSTEM_ADMIN follows canonical bound-school semantics');
			assert.equal((await unboundSystemAdmin.json() as { code: string }).code, 'SCHOOL_SCOPE_REQUIRED');
		}
		assert.equal(dispatches, afterSameSchool, 'rejected actor scopes dispatch zero service/database reads');
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
