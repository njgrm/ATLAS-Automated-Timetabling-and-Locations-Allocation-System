/**
 * A8 TL-SHORTAGE-C02 items 3.2 and 3.3 — a hand-made "to-be-hired" teacher is
 * created QUALIFIED, and one endpoint hires and covers in a single call.
 *
 * LIVE DEFECTS THESE CLOSE:
 *  - 3.2 `createPlaceholderFaculty` stored department, specialization and hours
 *       but no `FacultySubject`, so a placeholder an operator created by hand
 *       could never be auto-assigned by the shortage workflow.
 *  - 3.3 `POST /faculty-assignments/coverage/repair` took `schoolId` from the
 *       body with no actor-school check, accepted a machine system token as a
 *       writer, and answered only with counts — the client could not show the
 *       operator which (section, subject) pairs were actually covered.
 *
 * Hermetic: a stateful in-memory Prisma-shaped client through `withDataContext`.
 * No database.
 *
 * Run: npx tsx --test src/__tests__/tl-shortage-hire-and-cover-c02.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { createPlaceholderFaculty } from '../services/faculty.service.js';
import { repairActiveSubjectCoverageWithPlaceholders } from '../services/faculty-assignment.service.js';

// ─── In-memory Prisma-shaped client ─────────────────────────────────────────

const WRITE_OPS = new Set([
	'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert',
	'delete', 'deleteMany', 'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
]);

type Row = Record<string, any>;

function expandCompound(where: Row | undefined): Row {
	const out: Row = {};
	for (const [key, value] of Object.entries(where ?? {})) {
		if (key.includes('_') && value && typeof value === 'object' && !Array.isArray(value)) {
			for (const [subKey, subValue] of Object.entries(value as Row)) out[subKey] = subValue;
		} else {
			out[key] = value;
		}
	}
	return out;
}

function matchesValue(actual: any, expected: any): boolean {
	if (expected === undefined) return true;
	if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
		if ('in' in expected) return (expected.in as any[]).includes(actual);
		if ('notIn' in expected) return !(expected.notIn as any[]).includes(actual);
		if ('not' in expected) {
			if (expected.not === null) return actual !== null && actual !== undefined;
			return actual !== expected.not;
		}
	}
	return actual === expected;
}

function matchesWhere(row: Row, where: Row | undefined): boolean {
	const expanded = expandCompound(where);
	for (const [key, expected] of Object.entries(expanded)) {
		if (!matchesValue(row[key], expected)) return false;
	}
	return true;
}

type Write = { model: string; op: string };

type World = {
	faculty: Row[];
	facultySubjects: Row[];
	subjects: Row[];
	ownerships: Row[];
	yearMirrors: Row[];
	sections: Row[];
	cycles: Row[];
};

function buildWorld(): World {
	return {
		faculty: [],
		facultySubjects: [],
		subjects: [{
			id: 21, schoolId: 1, code: 'FILI', name: 'Filipino', isActive: true,
			ownerDepartment: 'FILI', requiredFeatures: [], gradeLevels: [7, 8],
			programScopes: ['REGULAR'], minMinutesPerWeek: 240,
		}],
		ownerships: [],
		yearMirrors: [{ schoolId: 1, enrollProSchoolYearId: 9, isActive: true, isArchived: false }],
		sections: [
			{ externalId: 7001, sectionMirrorId: 1, schoolId: 1, schoolYearId: 9, name: 'G7-1', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			{ externalId: 7002, sectionMirrorId: 2, schoolId: 1, schoolYearId: 9, name: 'G7-2', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			{ externalId: 7003, sectionMirrorId: 3, schoolId: 1, schoolYearId: 9, name: 'G8-1', displayOrder: 8, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			{ externalId: 7004, sectionMirrorId: 4, schoolId: 1, schoolYearId: 9, name: 'G8-2', displayOrder: 8, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		],
		cycles: [],
	};
}

function createClient(world: World): { client: any; live: World; writes: Write[] } {
	const live: World = structuredClone(world);
	const writes: Write[] = [];
	const record = (model: string, op: string) => { writes.push({ model, op }); };
	let nextId = 500;

	const readModel = (rows: Row[], model: string): Row => ({
		findMany: async (args: any = {}) => rows.filter((row) => matchesWhere(row, args.where)).map((row) => structuredClone(row)),
		findFirst: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? structuredClone(found) : null;
		},
		findUnique: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? structuredClone(found) : null;
		},
		count: async (args: any = {}) => rows.filter((row) => matchesWhere(row, args.where)).length,
		aggregate: async (args: any = {}) => {
			const rows2 = rows.filter((row) => matchesWhere(row, args.where));
			const min = rows2.length > 0 ? Math.min(...rows2.map((row) => row[Object.keys(args._min ?? { externalId: true })[0]])) : null;
			return { _min: { externalId: min } };
		},
		[model]: undefined,
	});

	const models: Record<string, any> = {
		enrollProSchoolYearMirror: readModel(live.yearMirrors, 'enrollProSchoolYearMirror'),
		subject: readModel(live.subjects, 'subject'),
		sectionMirror: readModel(live.sections, 'sectionMirror'),
		facultyMirror: {
			findMany: async (args: any = {}) => live.faculty.filter((row) => matchesWhere(row, args.where)).map((row) => structuredClone(row)),
			findFirst: async (args: any = {}) => {
				const found = live.faculty.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			findUnique: async (args: any = {}) => {
				const found = live.faculty.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			aggregate: async (args: any = {}) => {
				const field = Object.keys(args._min ?? { externalId: true })[0];
				const rows = live.faculty.filter((row) => matchesWhere(row, args.where));
				return { _min: { [field]: rows.length > 0 ? Math.min(...rows.map((row) => row[field])) : null } };
			},
			create: async (args: any = {}) => {
				const row = { id: nextId++, ...structuredClone(args.data) };
				live.faculty.push(row);
				record('facultyMirror', 'create');
				return structuredClone(row);
			},
		},
		facultySubject: {
			findMany: async (args: any = {}) => live.facultySubjects.filter((row) => matchesWhere(row, args.where)).map((row) => structuredClone(row)),
			findUnique: async (args: any = {}) => {
				const found = live.facultySubjects.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			create: async (args: any = {}) => {
				const row = { id: nextId++, ...structuredClone(args.data) };
				live.facultySubjects.push(row);
				record('facultySubject', 'create');
				return structuredClone(row);
			},
			createMany: async (args: any = {}) => {
				for (const data of args.data ?? []) live.facultySubjects.push({ id: nextId++, ...structuredClone(data) });
				record('facultySubject', 'createMany');
				return { count: (args.data ?? []).length };
			},
			update: async (args: any = {}) => {
				const row = live.facultySubjects.find((candidate) => matchesWhere(candidate, args.where));
				if (!row) throw new Error('facultySubject not found');
				Object.assign(row, structuredClone(args.data));
				record('facultySubject', 'update');
				return structuredClone(row);
			},
		},
		subjectSectionOwnership: {
			findMany: async (args: any = {}) => live.ownerships.filter((row) => matchesWhere(row, args.where)).map((row) => structuredClone(row)),
			findUnique: async (args: any = {}) => {
				const found = live.ownerships.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			count: async (args: any = {}) => live.ownerships.filter((row) => matchesWhere(row, args.where)).length,
			createMany: async (args: any = {}) => {
				for (const data of args.data ?? []) live.ownerships.push({ id: nextId++, ...structuredClone(data) });
				record('subjectSectionOwnership', 'createMany');
				return { count: (args.data ?? []).length };
			},
		},
		teachingLoadCycle: {
			upsert: async (args: any = {}) => {
				const compound = args.where?.schoolId_schoolYearId ?? {};
				const existing = live.cycles.find(
					(row) => row.schoolId === compound.schoolId && row.schoolYearId === compound.schoolYearId,
				);
				record('teachingLoadCycle', 'upsert');
				if (existing) {
					Object.assign(existing, structuredClone(args.update ?? {}));
					return structuredClone(existing);
				}
				const created = { id: nextId++, version: 1, ...structuredClone(args.create) };
				live.cycles.push(created);
				return structuredClone(created);
			},
		},
	};

	for (const model of Object.keys(models)) {
		for (const op of WRITE_OPS) {
			if (models[model][op] === undefined) {
				models[model][op] = async () => {
					record(model, op);
					throw new Error(`unexpected unmodelled write ${model}.${op}`);
				};
			}
		}
	}

	const client: any = { ...models };
	client.$transaction = async (callback: (tx: any) => Promise<unknown>) => {
		const backup = structuredClone(live);
		const writesBefore = writes.length;
		try {
			return await callback(client);
		} catch (error) {
			for (const key of Object.keys(live)) delete (live as any)[key];
			Object.assign(live, backup);
			writes.length = writesBefore;
			throw error;
		}
	};
	return { client, live, writes };
}

// ─── Item 3.2 — placeholder creation writes FacultySubject ──────────────────

test('item 3.2: a placeholder created for a subject carries the facultySubject row', async () => {
	const { client, live, writes } = createClient(buildWorld());
	const created = await withDataContext(client, () => createPlaceholderFaculty({
		schoolId: 1,
		firstName: 'Hired',
		lastName: 'Filipino',
		maxHoursPerWeek: 20,
		subjectIds: [21],
		schoolYearId: 9,
		assignedBy: 77,
	}));

	assert.equal(live.faculty.length, 1);
	assert.equal(created.id, live.faculty[0].id);
	assert.equal(created.maxHoursPerWeek, 20);
	assert.equal(live.facultySubjects.length, 1, 'the placeholder is persisted WITH its qualification');
	assert.equal(live.facultySubjects[0].facultyId, created.id);
	assert.equal(live.facultySubjects[0].subjectId, 21);
	assert.equal(live.facultySubjects[0].schoolId, 1);
	assert.equal(live.facultySubjects[0].schoolYearId, 9, 'the qualification is year-scoped like every other Teaching Load row');
	assert.equal(live.facultySubjects[0].assignedBy, 77);
	// The sectionIds/gradeLevels parity invariant holds at zero sections.
	assert.deepEqual(live.facultySubjects[0].sectionIds, []);
	assert.deepEqual(live.facultySubjects[0].gradeLevels, []);
	assert.deepEqual(created.facultySubjects.map((row: Row) => row.subjectId), [21], 'the caller can read the qualification back');
	assert.ok(writes.some((entry) => entry.model === 'facultySubject' && entry.op === 'createMany'));
});

test('item 3.2: creating a placeholder without subjects is unchanged and unqualified', async () => {
	const { client, live } = createClient(buildWorld());
	const created = await withDataContext(client, () => createPlaceholderFaculty({
		schoolId: 1, firstName: 'Teacher', lastName: 'X',
	}));

	assert.equal(created.maxHoursPerWeek, 30, 'the default contract is unchanged');
	assert.equal(live.facultySubjects.length, 0, 'no subject requested means no qualification row');
});

test('item 3.2: an unknown or cross-school subject fails closed with no teacher written', async () => {
	const { client, live } = createClient(buildWorld());
	await assert.rejects(
		() => withDataContext(client, () => createPlaceholderFaculty({
			schoolId: 1, firstName: 'Hired', lastName: 'Nope', subjectIds: [999], schoolYearId: 9, assignedBy: 77,
		})),
		(error: any) => error.code === 'FACULTY_SUBJECT_NOT_QUALIFIABLE' && error.statusCode === 400,
	);
	assert.equal(live.faculty.length, 0, 'the whole transaction rolled back');

	await assert.rejects(
		() => withDataContext(client, () => createPlaceholderFaculty({
			schoolId: 1, firstName: 'Hired', lastName: 'Nope', subjectIds: [21],
		})),
		(error: any) => error.code === 'INVALID_PARAM',
		'a qualification without a school year is rejected',
	);
	await assert.rejects(
		() => withDataContext(client, () => createPlaceholderFaculty({
			schoolId: 1, firstName: 'Hired', lastName: 'Nope', subjectIds: [21], schoolYearId: 9,
		})),
		(error: any) => error.code === 'ACTOR_REQUIRED' && error.statusCode === 403,
		'a qualification without an authenticated actor is rejected',
	);
	assert.equal(live.faculty.length, 0, 'still no teacher written');
});

// ─── Item 3.3 — one endpoint hires and covers ───────────────────────────────

const REPAIR_INPUT = {
	schoolId: 1,
	schoolYearId: 9,
	assignedBy: 77,
	actorSchoolId: 1,
} as const;

test('item 3.3: apply:false writes nothing and returns exactly the plan it would execute', async () => {
	const world = buildWorld();
	const preview = createClient(world);
	const result = await withDataContext(preview.client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: false, maxHoursPerWeek: 20,
	}));

	assert.equal(result.applied, false);
	assert.equal(preview.writes.length, 0, `apply:false performed ${JSON.stringify(preview.writes)}`);
	assert.equal(preview.live.faculty.length, 0, 'no teacher was created');
	assert.equal(preview.live.ownerships.length, 0, 'no pair was assigned');
	assert.equal(result.assignedPairs.length, 0, 'a preview assigns nothing');

	assert.equal(result.plannedAssignments.length, 1);
	const plan = result.plannedAssignments[0];
	assert.equal(plan.subjectId, 21);
	assert.equal(plan.subjectCode, 'FILI');
	assert.equal(plan.minMinutesPerWeek, 240);
	assert.deepEqual(plan.uncoveredSectionIds, [7001, 7002, 7003, 7004]);
	// 20h * 60 = 1200 minutes; 240 per section -> exactly five sections fit, so
	// all four are assignable and none deferred.
	assert.deepEqual(plan.assignableSectionIds, [7001, 7002, 7003, 7004]);
	assert.deepEqual(plan.deferredSectionIds, []);
	assert.equal(plan.maxHoursPerWeek, 20);
});

test('item 3.3: the plan is bounded by the hired teacher contract and the remainder is reported', async () => {
	// 4h * 60 = 240 minutes -> exactly one 240-minute section fits.
	const { client, live } = createClient(buildWorld());
	const result = await withDataContext(client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: false, maxHoursPerWeek: 4,
	}));

	assert.deepEqual(result.plannedAssignments[0].assignableSectionIds, [7001]);
	assert.deepEqual(result.plannedAssignments[0].deferredSectionIds, [7002, 7003, 7004]);
	assert.equal(result.stillUncoveredPairs.length, 4, 'a preview still reports every uncovered pair');
	assert.equal(live.faculty.length, 0);
});

test('item 3.3: apply:true assigns exactly the uncovered pairs of S and reports the remainder', async () => {
	const { client, live } = createClient(buildWorld());
	const result = await withDataContext(client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: true, maxHoursPerWeek: 4, teacherName: 'Ana Santos',
	}));

	assert.equal(result.applied, true);
	assert.equal(live.faculty.length, 1, 'exactly one to-be-hired teacher was created');
	const teacher = live.faculty[0];
	assert.equal(teacher.firstName, 'Ana');
	assert.equal(teacher.lastName, 'Santos');
	assert.equal(teacher.isPlaceholder, true);
	assert.equal(teacher.maxHoursPerWeek, 4);

	assert.equal(result.assignedPairs.length, 1, 'exactly the assignable pair, not the deferred three');
	assert.deepEqual(result.assignedPairs, [{ subjectId: 21, subjectCode: 'FILI', sectionId: 7001, facultyId: teacher.id }]);
	assert.equal(result.assignedPairs[0].facultyId, teacher.id, 'the pair is assigned to the teacher this call created');

	assert.equal(result.teachers.length, 1);
	assert.equal(result.teachers[0].created, true);
	assert.equal(result.teachers[0].maxHoursPerWeek, 4, 'the created teacher has the requested contract');
	assert.equal(result.teachers[0].subjectCode, 'FILI');

	// The three deferred pairs are still uncovered, reported honestly.
	const deferred = result.stillUncoveredPairs.map((pair) => pair.sectionId).sort((a: number, b: number) => a - b);
	assert.deepEqual(deferred, [7002, 7003, 7004]);
	assert.deepEqual(result.stillUncoveredSubjectCodes, ['FILI']);

	// The persisted qualification row and ownership rows agree with the report.
	const qualification = live.facultySubjects.find((row) => row.facultyId === teacher.id);
	assert.ok(qualification, 'the hired teacher carries its qualification row');
	assert.equal(qualification!.subjectId, 21);
	assert.deepEqual(qualification!.sectionIds, [7001], 'the qualification lists exactly the assigned sections');
	assert.deepEqual(qualification!.gradeLevels, [7], 'grade levels resolve from the section display order');
	assert.equal(live.ownerships.length, 1);
	assert.equal(live.ownerships[0].sectionId, 7001);
	assert.equal(live.ownerships[0].facultySubjectId, qualification!.id);
});

test('item 3.3: the preview plan equals the executed plan pair for pair', async () => {
	const preview = createClient(buildWorld());
	const previewResult = await withDataContext(preview.client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: false, maxHoursPerWeek: 20, teacherName: 'Ana Santos',
	}));

	const applied = createClient(buildWorld());
	const appliedResult = await withDataContext(applied.client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: true, maxHoursPerWeek: 20, teacherName: 'Ana Santos',
	}));

	assert.deepEqual(
		appliedResult.plannedAssignments,
		previewResult.plannedAssignments,
		'apply:true plans exactly what apply:false promised',
	);
	assert.deepEqual(
		appliedResult.assignedPairs.map((pair) => ({ subjectId: pair.subjectId, sectionId: pair.sectionId })),
		previewResult.plannedAssignments[0].assignableSectionIds.map((sectionId) => ({ subjectId: 21, sectionId })),
		'every planned assignable pair is assigned, and nothing else is',
	);
	assert.deepEqual(previewResult.assignedPairs, [], 'the preview assigned nothing');
});

test('item 3.3: a subject with no shortage is not hired for, and an unknown ref is reported', async () => {
	const { client, live } = createClient(buildWorld());
	const result = await withDataContext(client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectCodes: ['NOPE', 'FILI'], apply: true,
	}));

	assert.deepEqual(result.unresolvedSubjectRefs, ['NOPE'], 'a requested code that matched nothing is reported');
	assert.equal(live.faculty.length, 1, 'only the real shortage produced a teacher');
	assert.equal(result.assignedPairs.length, 4, 'FILI was fully covered at the default 30h contract');
	assert.deepEqual(result.stillUncoveredSubjectCodes, [], 'nothing remains uncovered');
});

test('item 3.3: an existing placeholder is reused and keeps its OWN contract', async () => {
	const world = buildWorld();
	world.faculty.push({
		id: 900, schoolId: 1, externalId: -1, firstName: 'Ana', lastName: 'Santos',
		department: 'PLACEHOLDER', isPlaceholder: true, isActiveForScheduling: true, isStale: false, maxHoursPerWeek: 30,
	});
	const { client, live } = createClient(world);
	const result = await withDataContext(client, () => repairActiveSubjectCoverageWithPlaceholders({
		...REPAIR_INPUT, subjectIds: [21], apply: true, maxHoursPerWeek: 4, teacherName: 'Ana Santos',
	}));

	assert.equal(live.faculty.length, 1, 'no duplicate teacher was created');
	assert.equal(result.teachers[0].created, false);
	assert.equal(result.teachers[0].facultyId, 900);
	assert.equal(result.teachers[0].maxHoursPerWeek, 30, 'the reused teacher keeps the contract nobody reviewed');
	assert.equal(live.faculty[0].maxHoursPerWeek, 30, 'and the persisted contract is not silently rewritten');
	assert.equal(result.assignedPairs.length, 4, 'the 30h teacher covers all four sections');
});

// ─── Item 3.3 — actor-school authority, no school-1 default ────────────────

test('item 3.3: the write fails closed without an actor school and on a cross-school request', async () => {
	const noActor = createClient(buildWorld());
	await assert.rejects(
		() => withDataContext(noActor.client, () => repairActiveSubjectCoverageWithPlaceholders({
			...REPAIR_INPUT, actorSchoolId: null, subjectIds: [21], apply: true,
		})),
		(error: any) => error.code === 'ACTOR_SCHOOL_REQUIRED' && error.statusCode === 403,
	);
	assert.equal(noActor.writes.length, 0, 'no write without an actor school');

	const crossSchool = createClient(buildWorld());
	await assert.rejects(
		() => withDataContext(crossSchool.client, () => repairActiveSubjectCoverageWithPlaceholders({
			...REPAIR_INPUT, actorSchoolId: 2, subjectIds: [21], apply: true,
		})),
		(error: any) => error.code === 'SCHOOL_MISMATCH' && error.statusCode === 403,
	);
	assert.equal(crossSchool.writes.length, 0, 'no write across schools');
	assert.equal(crossSchool.live.faculty.length, 0);
});

test('item 3.3: an archived school year is read-only', async () => {
	const world = buildWorld();
	world.yearMirrors[0].isArchived = true;
	const { client, writes } = createClient(world);
	await assert.rejects(
		() => withDataContext(client, () => repairActiveSubjectCoverageWithPlaceholders({
			...REPAIR_INPUT, subjectIds: [21], apply: true,
		})),
		(error: any) => error.code === 'ARCHIVED_YEAR_READ_ONLY' && error.statusCode === 409,
	);
	assert.equal(writes.length, 0);
});
