/**
 * HOME-ROOM-AUTO-ASSIGN-C01 — deterministic, grade-scope-authoritative
 * home-room auto-assignment.
 *
 * Proven live defect (2026-09-18, zero-write preview): every section of every
 * grade was offered a Grade 10 Academic Wing room because all four wings had
 * `gradeScope = []` and the old tiebreak fell back to a lexicographic building
 * name, where `"Grade 10 Academic Wing"` sorts before `"Grade 7 Academic Wing"`.
 *
 * This file is fully hermetic: no database is contacted. Service-level proofs
 * inject a fake Prisma client through `AutoAssignOptions.prisma`; the mounted
 * route proof injects the same fake through the production data-context
 * (`withDataContext`), which `computeAutoAssign` resolves via `getDataContext()`.
 * `DATABASE_URL` is forced to an unreachable placeholder so any accidental real
 * dispatch would fail closed rather than touch a configured database.
 *
 * Run (server workspace): `npm run test:home-room-auto-assign`
 *                          (`tsx src/__tests__/home-room-auto-assign.test.ts`)
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import express from 'express';

const JWT_SECRET = 'home-room-auto-assign-c01-test-secret';

process.env.JWT_SECRET = JWT_SECRET;
// Fail closed: every data access below is injected. Point the singleton at an
// unreachable host so an accidental dispatch can never touch the real database.
process.env.DATABASE_URL = 'postgresql://placeholder:placeholder@127.0.0.1:1/never_used';

// ── Fixtures ────────────────────────────────────────────────────────────────

const WING_GRADES = [7, 8, 9, 10] as const;
type WingGrade = (typeof WING_GRADES)[number];

function wingName(grade: number): string {
	return `Grade ${grade} Academic Wing`;
}

/** 20 general classrooms per wing (5 per floor × 4 floors), matching the live seed. */
function wingRooms(grade: WingGrade, gradeScope: number[]): any[] {
	const buildingId = grade - 6; // 7 -> 1, 8 -> 2, 9 -> 3, 10 -> 4
	const rooms: any[] = [];
	let roomId = buildingId * 1000;
	for (let floor = 1; floor <= 4; floor += 1) {
		for (let position = 0; position < 5; position += 1) {
			roomId += 1;
			rooms.push({
				id: roomId,
				name: `G${grade} Room ${floor}${String(position + 1).padStart(2, '0')}`,
				type: 'CLASSROOM',
				capacity: 45,
				buildingId,
				floor,
				floorPosition: position,
				building: { name: wingName(grade), gradeScope },
			});
		}
	}
	return rooms;
}

const SECTION_SUFFIXES = ['Amethyst', 'Beryl', 'Citrine', 'Diamond', 'Emerald'];

function gradeSections(grade: number, count = 5): any[] {
	const sections: any[] = [];
	for (let index = 0; index < count; index += 1) {
		const externalId = grade * 100 + index + 1;
		sections.push({
			id: externalId,
			externalId,
			name: `Grade ${grade} - ${SECTION_SUFFIXES[index] ?? `Section ${index + 1}`}`,
			gradeLevelId: grade,
			gradeLevelName: `Grade ${grade}`,
			homeRoomId: null,
			enrolledCount: 40,
		});
	}
	return sections;
}

function liveShapedSections(): any[] {
	return WING_GRADES.flatMap((grade) => gradeSections(grade));
}

function allWings(scopeByGrade: Record<number, number[]>): any[] {
	return WING_GRADES.flatMap((grade) => wingRooms(grade, scopeByGrade[grade] ?? []));
}

const SPECIALIST_ROOMS = [
	{
		id: 5001,
		name: 'Chemistry Lab',
		type: 'LABORATORY',
		capacity: 40,
		buildingId: 5,
		floor: 1,
		floorPosition: 0,
		building: { name: 'Science and Innovation Center', gradeScope: [] },
	},
	{
		id: 5002,
		name: 'Covered Court',
		type: 'GYMNASIUM',
		capacity: 160,
		buildingId: 6,
		floor: 1,
		floorPosition: 0,
		building: { name: 'MAPEH and Wellness Hub', gradeScope: [] },
	},
	{
		id: 5003,
		name: 'Industrial Arts Shop',
		type: 'TLE_WORKSHOP',
		capacity: 35,
		buildingId: 7,
		floor: 1,
		floorPosition: 0,
		building: { name: 'TLE and Livelihood Center', gradeScope: [] },
	},
];

// ── Fake clients ────────────────────────────────────────────────────────────

type ClientConfig = {
	sections: any[];
	rooms: any[];
};

/** Records every operation and every write the service performs. */
function makeRecordingClient(config: ClientConfig) {
	const ops: string[] = [];
	const writes: Array<{ where: any; data: any }> = [];
	const client: any = {
		sectionMirror: {
			findMany: async (_args: any) => {
				ops.push('sectionMirror.findMany');
				return config.sections;
			},
			findFirst: async (args: any) => {
				ops.push('sectionMirror.findFirst');
				return config.sections.find((section) => section.externalId === args?.where?.externalId) ?? null;
			},
			update: async (args: any) => {
				ops.push('sectionMirror.update');
				writes.push(args);
				return args.data;
			},
		},
		room: {
			findMany: async (_args: any) => {
				ops.push('room.findMany');
				return config.rooms;
			},
			findUnique: async (args: any) => {
				ops.push('room.findUnique');
				return config.rooms.find((room) => room.id === args?.where?.id) ?? null;
			},
		},
		$transaction: async (fn: any) => {
			ops.push('$transaction');
			return fn(client);
		},
	};
	return { client, ops, writes };
}

async function compute(options: any, config: ClientConfig) {
	const { computeAutoAssign } = await import('../services/home-room-auto-assign.service.js');
	const recording = makeRecordingClient(config);
	const result = await computeAutoAssign({ ...options, prisma: recording.client });
	return { result, recording };
}

function assignmentsBySection(result: any): Map<number, any> {
	const map = new Map<number, any>();
	for (const assignment of result.assignments) {
		map.set(assignment.sectionId, assignment);
	}
	return map;
}

// ── Service-level proofs ────────────────────────────────────────────────────

test('R5: scoped wings reproduce the persisted per-grade assignment exactly', async () => {
	const sections = liveShapedSections();
	const rooms = allWings({ 7: [7], 8: [8], 9: [9], 10: [10] });

	const { result } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	assert.equal(result.counts.assigned, 20, 'every section receives a home room');
	assert.equal(result.counts.skipped, 0, 'no section is skipped');

	for (const grade of WING_GRADES) {
		const expectedBuildingId = grade - 6;
		const gradeAssignments = result.assignments.filter((assignment: any) => assignment.gradeLevel === grade);
		assert.equal(gradeAssignments.length, 5, `grade ${grade} has exactly 5 assignments`);
		for (const assignment of gradeAssignments) {
			assert.equal(assignment.buildingId, expectedBuildingId, `grade ${grade} section lands in ${wingName(grade)}`);
			assert.equal(assignment.buildingName, wingName(grade), `grade ${grade} section building name matches`);
			assert.equal(assignment.reason, 'GRADE_SCOPE_MATCH', `grade ${grade} assignment is an exact grade-scope match`);
		}
	}

	// No cross-grade leakage: each wing only ever serves its own grade.
	const homeRoomIdToGrade = new Map<number, number>();
	for (const grade of WING_GRADES) {
		for (const room of wingRooms(grade, [grade])) homeRoomIdToGrade.set(room.id, grade);
	}
	for (const assignment of result.assignments) {
		assert.equal(homeRoomIdToGrade.get(assignment.homeRoomId), assignment.gradeLevel, 'assigned room belongs to the section grade wing');
	}
});

test('R1 failing-first control: unscoped any-grade wings must not collapse every section into the Grade 10 wing', async () => {
	// This mirrors the proven live state: all four wings have `gradeScope = []`,
	// so every building scores the same any-grade match. The old lexicographic
	// name tiebreak offered the Grade 10 wing first and captured all 20 sections.
	const sections = liveShapedSections();
	const rooms = allWings({});

	const { result } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	assert.equal(result.counts.assigned, 20, 'every section receives a home room');

	const gradeSeven = result.assignments.filter((assignment: any) => assignment.gradeLevel === 7);
	assert.equal(gradeSeven.length, 5, 'grade 7 has five sections');
	for (const assignment of gradeSeven) {
		assert.equal(
			assignment.buildingId,
			1,
			`grade 7 section must take the Grade 7 Academic Wing (natural ordering), got building ${assignment.buildingId} (${assignment.buildingName})`,
		);
	}

	// The exact regression asserted by the packet: the Grade 10 wing must not
	// capture every section when numerically lower any-grade wings are available.
	assert.ok(
		result.assignments.every((assignment: any) => assignment.buildingId !== 4),
		'no section collapses into the Grade 10 Academic Wing under the fixed tiebreak',
	);
});

test('R1 determinism: shuffled section/room input order produces identical output', async () => {
	const sections = liveShapedSections();
	const rooms = allWings({});
	const base = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	const shuffledSections = [...sections].reverse();
	const shuffledRooms = [...rooms].reverse();
	const shuffled = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, {
		sections: shuffledSections,
		rooms: shuffledRooms,
	});

	const baseBySection = assignmentsBySection(base.result);
	const shuffledBySection = assignmentsBySection(shuffled.result);
	assert.equal(shuffled.result.assignments.length, base.result.assignments.length, 'same assignment count');
	for (const [sectionId, assignment] of baseBySection) {
		const other = shuffledBySection.get(sectionId);
		assert.ok(other, `section ${sectionId} is assigned in the shuffled run`);
		assert.equal(other.homeRoomId, assignment.homeRoomId, `section ${sectionId} gets the same room regardless of input order`);
		assert.equal(other.buildingId, assignment.buildingId, `section ${sectionId} gets the same building regardless of input order`);
	}
});

test('R2/R3: an any-grade building never outranks a declared exact grade scope', async () => {
	// The exact-scope wing is deliberately named to sort AFTER the any-grade
	// building under natural ordering; matchScore 2 must still win.
	const sections = gradeSections(7, 1);
	const rooms = [
		{
			id: 8001,
			name: 'Annex Room 1',
			type: 'CLASSROOM',
			capacity: 45,
			buildingId: 9,
			floor: 1,
			floorPosition: 0,
			building: { name: 'Apex Any-Grade Annex', gradeScope: [] },
		},
		{
			id: 8002,
			name: 'Scope Room 1',
			type: 'CLASSROOM',
			capacity: 45,
			buildingId: 8,
			floor: 1,
			floorPosition: 0,
			building: { name: 'Zeta Grade 7 Wing', gradeScope: [7] },
		},
	];

	const { result } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	assert.equal(result.assignments.length, 1, 'the section is assigned');
	assert.equal(result.assignments[0].buildingId, 8, 'the exact grade-scope building wins');
	assert.equal(result.assignments[0].reason, 'GRADE_SCOPE_MATCH', 'the match is reported as an exact scope match');
});

test('R4: specialist non-classroom spaces are never eligible home rooms', async () => {
	const sections = gradeSections(7, 1);
	const rooms = [
		// Both are any-grade; the specialist building sorts first by name, so a
		// name/score-only ordering would wrongly take the laboratory.
		{
			id: 7100,
			name: 'Apex Science Laboratory',
			type: 'LABORATORY',
			capacity: 45,
			buildingId: 5,
			floor: 1,
			floorPosition: 0,
			building: { name: 'Apex Science Labs', gradeScope: [] },
		},
		{
			id: 7200,
			name: 'Zeta Classroom',
			type: 'CLASSROOM',
			capacity: 45,
			buildingId: 8,
			floor: 1,
			floorPosition: 0,
			building: { name: 'Zeta Classroom Annex', gradeScope: [] },
		},
	];

	const { result } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	assert.equal(result.assignments.length, 1, 'the section is assigned a classroom');
	assert.equal(result.assignments[0].homeRoomId, 7200, 'the general classroom is chosen, not the laboratory');
	assert.equal(result.assignments[0].buildingId, 8, 'the specialist laboratory building is excluded by persisted room type');
});

test('R4: live-shaped specialist rooms are excluded while the four wings remain eligible', async () => {
	const sections = liveShapedSections();
	const rooms = [...allWings({ 7: [7], 8: [8], 9: [9], 10: [10] }), ...SPECIALIST_ROOMS];

	const { result } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	assert.equal(result.counts.assigned, 20, 'all sections assigned');
	const specialistIds = new Set(SPECIALIST_ROOMS.map((room) => room.id));
	for (const assignment of result.assignments) {
		assert.ok(!specialistIds.has(assignment.homeRoomId), `specialist room ${assignment.homeRoomId} must never be a home room`);
	}
});

test('R5 negative control: preview writes nothing (Section.homeRoomId zero delta)', async () => {
	const sections = liveShapedSections();
	const rooms = allWings({ 7: [7], 8: [8], 9: [9], 10: [10] });
	const beforeSignature = JSON.stringify(sections.map((section) => [section.externalId, section.homeRoomId]));

	const { result, recording } = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });

	const afterSignature = JSON.stringify(sections.map((section) => [section.externalId, section.homeRoomId]));
	assert.equal(afterSignature, beforeSignature, 'preview leaves Section.homeRoomId unchanged');
	assert.equal(recording.writes.length, 0, 'preview performs zero writes');
	assert.equal(recording.ops.includes('$transaction'), false, 'preview opens no write transaction');
	assert.equal(result.counts.applied, 0, 'preview applies zero assignments');
});

test("R5: apply writes exactly the previewed set and no extra rows", async () => {
	const sections = liveShapedSections();
	const rooms = allWings({ 7: [7], 8: [8], 9: [9], 10: [10] });

	const preview = await compute({ schoolId: 1, schoolYearId: 10, mode: 'preview', overwriteExisting: true }, { sections, rooms });
	assert.equal(preview.recording.writes.length, 0, 'preview writes nothing');

	const apply = await compute({ schoolId: 1, schoolYearId: 10, mode: 'apply', overwriteExisting: true }, { sections, rooms });

	assert.equal(apply.result.counts.applied, preview.result.counts.assigned, 'apply writes exactly the previewed assignment count');
	assert.equal(apply.recording.writes.length, preview.result.assignments.length, 'exactly one write per previewed assignment');

	const previewedBySection = assignmentsBySection(preview.result);
	const writtenSectionIds = new Set<number>();
	for (const write of apply.recording.writes) {
		const sectionId = Number(write.where?.id);
		writtenSectionIds.add(sectionId);
		const expected = previewedBySection.get(sectionId);
		assert.ok(expected, `write targets a previewed section (mirror id ${sectionId})`);
		assert.equal(write.data?.homeRoomId, expected.homeRoomId, `section ${sectionId} is written the previewed room`);
	}
	assert.equal(writtenSectionIds.size, preview.result.assignments.length, 'no duplicate or extra section writes');
});

// ── Mounted-route authority + positive proof ─────────────────────────────────

test('R6: mounted route authority matrix dispatches zero DB work on every rejection', async () => {
	const { withDataContext } = await import('../lib/data-context.js');
	const sectionRouter = (await import('../routes/section.router.js')).default;

	const recording = makeRecordingClient({ sections: [], rooms: [] });

	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		void withDataContext(recording.client, async () => next());
	});
	app.use('/api/v1/sections', sectionRouter);
	app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		res.status(err?.statusCode ?? 500).json({ code: err?.code ?? 'UNHANDLED', message: err?.message ?? String(err) });
	});

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}`;

	const officer = (schoolId?: number) =>
		jwt.sign({ userId: 1, role: 'officer', authSource: 'local', ...(schoolId === undefined ? {} : { schoolId }) }, JWT_SECRET, { expiresIn: '10m' });
	const faculty = jwt.sign({ userId: 2, role: 'faculty', authSource: 'local', schoolId: 1 }, JWT_SECRET, { expiresIn: '10m' });

	const post = (body: unknown, token?: string) =>
		fetch(`${baseUrl}/api/v1/sections/home-rooms/10/auto-assign`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(token ? { authorization: `Bearer ${token}` } : {}),
			},
			body: JSON.stringify(body),
		});

	type Case = { label: string; body: unknown; token?: string; status: number; code?: string };
	const cases: Case[] = [
		{ label: 'missing JWT', body: { schoolId: 1, mode: 'preview' }, status: 401, code: 'NO_TOKEN' },
		{ label: 'invalid JWT', body: { schoolId: 1, mode: 'preview' }, token: 'not-a-jwt', status: 401, code: 'INVALID_TOKEN' },
		{ label: 'system token is not a JWT', body: { schoolId: 1, mode: 'preview' }, token: 'atlas-system-token-not-a-jwt', status: 401, code: 'INVALID_TOKEN' },
		{ label: 'non-privileged role', body: { schoolId: 1, mode: 'preview' }, token: faculty, status: 403, code: 'FORBIDDEN' },
		{ label: 'actor without school scope', body: { schoolId: 1, mode: 'preview' }, token: officer(), status: 403, code: 'SCHOOL_SCOPE_REQUIRED' },
		{ label: 'cross-school actor', body: { schoolId: 1, mode: 'preview' }, token: officer(99), status: 403, code: 'CROSS_SCHOOL_DENIED' },
		{ label: 'malformed body: missing schoolId', body: { mode: 'preview' }, token: officer(1), status: 400, code: 'INVALID_BODY' },
		{ label: 'malformed body: zero schoolId', body: { schoolId: 0, mode: 'preview' }, token: officer(1), status: 400, code: 'INVALID_BODY' },
		{ label: 'malformed body: non-numeric schoolId', body: { schoolId: 'abc', mode: 'preview' }, token: officer(1), status: 400, code: 'INVALID_BODY' },
		{ label: 'malformed body: invalid mode', body: { schoolId: 1, mode: 'destroy' }, token: officer(1), status: 400, code: 'INVALID_BODY' },
		{ label: 'malformed body: non-boolean overwrite', body: { schoolId: 1, mode: 'preview', overwriteExisting: 'yes' }, token: officer(1), status: 400, code: 'INVALID_BODY' },
	];

	try {
		for (const testCase of cases) {
			recording.ops.length = 0;
			recording.writes.length = 0;
			const response = await post(testCase.body, testCase.token);
			const json = (await response.json()) as any;
			assert.equal(response.status, testCase.status, `${testCase.label} -> ${testCase.status} (got ${response.status}/${json.code})`);
			if (testCase.code) assert.equal(json.code, testCase.code, `${testCase.label} -> ${testCase.code}`);
			assert.equal(recording.ops.length, 0, `${testCase.label} dispatches zero DB operations`);
			assert.equal(recording.writes.length, 0, `${testCase.label} performs zero writes`);
		}
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});

test('R6 positive: a same-school privileged preview reaches the service and returns the per-grade result', async () => {
	const { withDataContext } = await import('../lib/data-context.js');
	const sectionRouter = (await import('../routes/section.router.js')).default;

	const recording = makeRecordingClient({
		sections: liveShapedSections(),
		rooms: allWings({ 7: [7], 8: [8], 9: [9], 10: [10] }),
	});

	const app = express();
	app.use(express.json());
	app.use((_req, _res, next) => {
		void withDataContext(recording.client, async () => next());
	});
	app.use('/api/v1/sections', sectionRouter);

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	const port = typeof address === 'object' && address ? address.port : 0;
	const baseUrl = `http://127.0.0.1:${port}`;

	const token = jwt.sign({ userId: 1, role: 'officer', authSource: 'local', schoolId: 1 }, JWT_SECRET, { expiresIn: '10m' });

	try {
		const response = await fetch(`${baseUrl}/api/v1/sections/home-rooms/10/auto-assign`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
			body: JSON.stringify({ schoolId: 1, mode: 'preview', overwriteExisting: true }),
		});
		const json = (await response.json()) as any;
		assert.equal(response.status, 200, `same-school preview succeeds (got ${response.status})`);
		assert.equal(json.counts.assigned, 20, 'all sections are assigned');
		for (const grade of WING_GRADES) {
			const gradeAssignments = json.assignments.filter((assignment: any) => assignment.gradeLevel === grade);
			assert.equal(gradeAssignments.length, 5, `grade ${grade} has 5 assignments via the real route`);
			assert.ok(gradeAssignments.every((assignment: any) => assignment.buildingId === grade - 6), `grade ${grade} stays in its wing`);
		}
		assert.ok(recording.ops.includes('sectionMirror.findMany'), 'the service dispatched the section read');
		assert.ok(recording.ops.includes('room.findMany'), 'the service dispatched the room read');
		assert.equal(recording.ops.includes('$transaction'), false, 'preview opens no write transaction');
		assert.equal(recording.writes.length, 0, 'preview performs zero writes');
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
