/**
 * A8 c4 — "Cover a class" server contract.
 *
 * Hermetic: a STATEFUL in-memory Prisma-shaped client injected through
 * `withDataContext`, so these tests exercise the exact production service path
 * (`teaching-load-cover.service.ts`) with no database and no network. Writes are
 * real and recorded; `$transaction` takes a snapshot and ROLLS BACK on a throw,
 * which is what makes the "one transaction" claim testable rather than asserted.
 *
 * What each block proves, and why it is load-bearing:
 *  1. the three tiers + a DIFFERENTIAL control per tier boundary (same teacher,
 *     only the distinguishing input flipped) so no tier can be quietly inverted;
 *  2. cap maths, including the rotation-family concurrent-peak rule, cross-checked
 *     against the SAME auto-fill capacity ledger the automation service uses;
 *  3. the 409 NEEDS_PERMISSION body, then `grantPermission: true` writing the
 *     permission AND the ownership together or not at all;
 *  4. a placeholder is never a candidate, in either surface;
 *  5. `cover-open-classes`: unowned + placeholderOwned === total, and a
 *     placeholder-owned class is OPEN;
 *  6. permission idempotency: re-grant `created:false`, delete-absent
 *     `removed:false`;
 *  7. scope: another school's teacher / subject / year fails closed;
 *  8. `allowPlaceholders: false` makes the saved-placeholder pool unreachable.
 *
 * Run: npx tsx --test src/__tests__/a8-c4-cover-candidates.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import {
	createCoverAssignment,
	createSubjectPermission,
	deleteSubjectPermission,
	listCoverCandidates,
	listCoverOpenClasses,
	listSubjectPermissions,
	CoverContractError,
} from '../services/teaching-load-cover.service.js';
import { autoFill } from '../services/teaching-load-automation.service.js';
import { evaluateWeeklyLoad } from '../services/teaching-load-capacity.service.js';

// ─── In-memory Prisma-shaped world ───────────────────────────────────────────

type Row = Record<string, any>;

const now = new Date('2026-09-29T00:00:00.000Z');
const SCHOOL = 1;
const OTHER_SCHOOL = 2;
const YEAR = 9;
const OTHER_YEAR = 10;
const ACTOR = 77;

const MATH = 21;
const FILI = 22;
const MAPEH = 23;
/** A rotation family: its same-term sections run CONCURRENTLY and must add up. */
const TLE = 24;

const SECTION_FILI_A = 7001;
const SECTION_TLE_A = 7011;
const SECTION_TLE_B = 7012;
const SECTION_TLE_C = 7013;
const SECTION_OPEN_UNOWNED = 7021;
const SECTION_OPEN_PLACEHOLDER = 7022;
const SECTION_OPEN_OWNED = 7023;

type World = {
	subjects: Row[];
	sections: Row[];
	faculty: Row[];
	facultySubjects: Row[];
	ownerships: Row[];
	permissions: Row[];
	auditLog: Row[];
	otherYears: Row[];
};

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
	for (const [key, expected] of Object.entries(expandCompound(where))) {
		if (!matchesValue(row[key], expected)) return false;
	}
	return true;
}

function subject(id: number, code: string, department: string, gradeLevels: number[], options: {
	minutes?: number;
	rotationFamily?: string | null;
	modularGroupId?: string | null;
	modularOrder?: number | null;
	termGroupId?: string | null;
	termCount?: number | null;
	schoolId?: number;
} = {}): Row {
	return {
		id,
		schoolId: options.schoolId ?? SCHOOL,
		code,
		name: `${code} subject`,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		rotationFamily: options.rotationFamily ?? null,
		gradeLevels,
		programScopes: ['REGULAR'],
		minMinutesPerWeek: options.minutes ?? 240,
		modularGroupId: options.modularGroupId ?? null,
		modularOrder: options.modularOrder ?? null,
		termGroupId: options.termGroupId ?? null,
		termCount: options.termCount ?? null,
		ownerDepartment: department,
		requiredFeatures: [],
		allowedSpecializations: [],
		isActive: true,
	};
}

function section(externalId: number, grade = 7, options: { programType?: string; schoolYearId?: number } = {}): Row {
	const schoolYearId = options.schoolYearId ?? YEAR;
	return {
		id: externalId,
		schoolId: SCHOOL,
		schoolYearId,
		externalId,
		name: `G${grade}-${externalId}`,
		gradeLevelId: grade === 8 ? 18 : grade === 9 ? 19 : 17,
		gradeLevelName: `Grade ${grade}`,
		displayOrder: grade,
		programType: options.programType ?? 'REGULAR',
		maxCapacity: 50,
		enrolledCount: 50,
		isActiveForScheduling: true,
		isStale: false,
		lastSyncedAt: now,
	};
}

function faculty(id: number, department: string, options: {
	maxHours?: number;
	placeholder?: boolean;
	canTeachOutsideDepartment?: boolean;
	firstName?: string;
	lastName?: string;
	schoolId?: number;
} = {}): Row {
	return {
		id,
		schoolId: options.schoolId ?? SCHOOL,
		externalId: 9000 + id,
		employeeId: `E${id}`,
		firstName: options.firstName ?? `First${id}`,
		lastName: options.lastName ?? `Last${id}`,
		department,
		specialization: null,
		canTeachOutsideDepartment: options.canTeachOutsideDepartment ?? false,
		maxHoursPerWeek: options.maxHours ?? 30,
		isPlaceholder: options.placeholder ?? false,
		employmentStatus: options.placeholder ? 'PLACEHOLDER' : 'REGULAR',
		isClassAdviser: false,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: null,
		advisedSectionId: null,
		isActiveForScheduling: true,
		isStale: false,
		version: 1,
	};
}

function facultySubjectRow(id: number, facultyId: number, subjectId: number, sectionIds: number[] = [], version = 1): Row {
	return {
		id,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		facultyId,
		subjectId,
		sectionIds,
		gradeLevels: [],
		assignedBy: ACTOR,
		version,
	};
}

/** An existing ownership carrying the nested subject shape the capacity builder reads. */
function ownershipRow(id: number, facultyId: number, subjectRow: Row, sectionId: number, facultySubjectId = 1000 + id): Row {
	return {
		id,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		facultyId,
		subjectId: subjectRow.id,
		sectionId,
		facultySubjectId,
		facultySubject: {
			id: facultySubjectId,
			subject: {
				id: subjectRow.id,
				code: subjectRow.code,
				minMinutesPerWeek: subjectRow.minMinutesPerWeek,
				rotationFamily: subjectRow.rotationFamily,
				modularGroupId: subjectRow.modularGroupId,
				modularOrder: subjectRow.modularOrder,
				termGroupId: subjectRow.termGroupId,
				termCount: subjectRow.termCount,
			},
		},
	};
}

function policyRow(): Row {
	return {
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		teachingStandardMinutes: 1800,
		advisoryCreditMinutes: 300,
		hardCapMinutes: 2400,
		periodLengthMinutes: 45,
		earliestStartTime: '06:00',
		latestEndTime: '18:30',
		enableShiftCoherenceGuard: false,
		enforceShiftCoherenceGuard: false,
	};
}

function termCache() {
	return {
		schoolId: SCHOOL,
		schoolYear: { id: YEAR, yearLabel: '2030-2031' },
		format: 'TRIMESTER',
		terms: [
			{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
			{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
			{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
		],
	};
}

function buildWorld(overrides: Partial<World> = {}): World {
	return {
		subjects: [
			subject(FILI, 'FILI', 'FILI', [7]),
			// Plain (non-rotating) TLE. The ROTATION family fixture lives only in
			// test 2b, where both ordered terms of the family exist — a rotation
			// family with a missing term is a fail-closed derived-demand blocker.
			subject(TLE, 'TLE', 'TLE', [7]),
			subject(MAPEH, 'MAPEH', 'MAPEH', [7]),
		],
		sections: [
			section(SECTION_FILI_A),
			section(SECTION_TLE_A), section(SECTION_TLE_B), section(SECTION_TLE_C),
		],
		faculty: [],
		facultySubjects: [],
		ownerships: [],
		permissions: [],
		auditLog: [],
		otherYears: [],
		...overrides,
	};
}

type Write = { model: string; op: string; data: Row };

function modelFor(world: World, name: keyof World, state: { nextId: number; writes: Write[] }) {
	const rows = world[name] as Row[];
	const table: any = {
		findMany: async (args: any = {}) => rows.filter((row) => matchesWhere(row, args.where)).map((row) => ({ ...row })),
		findFirst: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? { ...found } : null;
		},
		findUnique: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? { ...found } : null;
		},
		count: async (args: any = {}) => rows.filter((row) => matchesWhere(row, args.where)).length,
	};
	table.create = async (args: any) => {
		state.writes.push({ model: name, op: 'create', data: args.data });
		const row = { id: state.nextId++, schoolId: SCHOOL, createdAt: now, ...args.data };
		rows.push(row);
		return { ...row };
	};
	table.createMany = async (args: any) => {
		for (const data of (args.data as Row[])) {
			state.writes.push({ model: name, op: 'createMany', data });
			rows.push({ id: state.nextId++, schoolId: SCHOOL, createdAt: now, ...data });
		}
		return { count: (args.data as Row[]).length };
	};
	table.update = async (args: any) => {
		state.writes.push({ model: name, op: 'update', data: args.data });
		const row = rows.find((entry) => matchesWhere(entry, args.where));
		if (!row) throw new Error(`${name}.update: no row`);
		Object.assign(row, args.data);
		return { ...row };
	};
	table.updateMany = async (args: any) => {
		state.writes.push({ model: name, op: 'updateMany', data: args.data });
		let count = 0;
		for (const row of rows) {
			if (matchesWhere(row, args.where)) {
				count += 1;
				Object.assign(row, args.data);
			}
		}
		return { count };
	};
	table.delete = async (args: any) => {
		state.writes.push({ model: name, op: 'delete', data: args.where });
		const index = rows.findIndex((entry) => matchesWhere(entry, args.where));
		if (index < 0) throw new Error(`${name}.delete: no row`);
		const [removed] = rows.splice(index, 1);
		return { ...removed };
	};
	table.deleteMany = async (args: any) => {
		state.writes.push({ model: name, op: 'deleteMany', data: args.where });
		let count = 0;
		for (let index = rows.length - 1; index >= 0; index -= 1) {
			if (matchesWhere(rows[index], args.where)) { rows.splice(index, 1); count += 1; }
		}
		return { count };
	};
	return table;
}

function buildClient(world: World) {
	const state = { nextId: 9000, writes: [] as Write[], transactions: [] as Row[] };
	const empty: Row[] = [];
	const client: any = {
		subject: modelFor(world, 'subjects', state),
		sectionMirror: modelFor(world, 'sections', state),
		facultyMirror: modelFor(world, 'faculty', state),
		facultySubject: modelFor(world, 'facultySubjects', state),
		subjectSectionOwnership: modelFor(world, 'ownerships', state),
		crossDepartmentPermission: modelFor(world, 'permissions', state),
		auditLog: modelFor(world, 'auditLog', state),
		departmentAlias: modelFor({ ...world, departmentAlias: empty } as never, 'departmentAlias' as never, state),
		departmentLabel: modelFor({ ...world, departmentLabel: empty } as never, 'departmentLabel' as never, state),
		subjectOwnerPrefix: modelFor({ ...world, subjectOwnerPrefix: empty } as never, 'subjectOwnerPrefix' as never, state),
		specializationAlias: modelFor({ ...world, specializationAlias: empty } as never, 'specializationAlias' as never, state),
		facultyGradePreference: modelFor({ ...world, facultyGradePreference: empty } as never, 'facultyGradePreference' as never, state),
		gradeShiftWindow: modelFor({ ...world, gradeShiftWindow: empty } as never, 'gradeShiftWindow' as never, state),
		instructionalCohort: modelFor({ ...world, instructionalCohort: empty } as never, 'instructionalCohort' as never, state),
		sectionSnapshot: { findUnique: async () => null },
		teachingLoadCycle: { findFirst: async () => null, findMany: async () => [], upsert: async () => ({}) },
		enrollProSchoolYearMirror: {
			findMany: async (args: any = {}) => [{
				schoolId: SCHOOL,
				enrollProSchoolYearId: YEAR,
				yearLabel: '2030-2031',
				isActive: true,
				isArchived: false,
				termContractCache: termCache(),
				termContractCachedAt: now,
			}].filter((row: Row) => matchesWhere(row, args.where)),
			findFirst: async (args: any = {}) => {
				const row: Row = {
					schoolId: SCHOOL,
					enrollProSchoolYearId: YEAR,
					yearLabel: '2030-2031',
					isActive: true,
					isArchived: false,
					termContractCache: termCache(),
					termContractCachedAt: now,
				};
				return matchesWhere(row, args.where) ? row : null;
			},
			findUnique: async (args: any = {}) => {
				const row: Row = {
					schoolId: SCHOOL,
					enrollProSchoolYearId: YEAR,
					yearLabel: '2030-2031',
					isActive: true,
					isArchived: false,
					termContractCache: termCache(),
					termContractCachedAt: now,
				};
				return matchesWhere(row, expandCompound(args.where)) ? row : null;
			},
		},
		schedulingPolicy: {
			findFirst: async () => policyRow(),
			findMany: async () => [policyRow()],
			findUnique: async () => policyRow(),
		},
	};

	client.$transaction = async (fn: (tx: any) => Promise<any>, options?: Row) => {
		state.transactions.push(options ?? {});
		// Snapshot so a throw mid-transaction rolls back: the "both rows or
		// neither" claim is then observable, not assumed.
		const snapshot = new Map<string, Row[]>();
		for (const key of ['permissions', 'facultySubjects', 'ownerships', 'auditLog']) {
			snapshot.set(key, [...(world[key as keyof World] as Row[])]);
		}
		try {
			return await fn(client);
		} catch (error) {
			for (const [key, rows] of snapshot.entries()) {
				const target = world[key as keyof World] as Row[];
				target.length = 0;
				target.push(...rows);
			}
			throw error;
		}
	};

	return { client, state };
}

async function withWorld<T>(world: World, fn: (state: { writes: Write[]; transactions: Row[] }) => Promise<T>): Promise<T> {
	const { client, state } = buildClient(world);
	return withDataContext(client, () => fn(state));
}

async function catchError(fn: () => Promise<unknown>): Promise<CoverContractError> {
	try {
		await fn();
	} catch (error) {
		assert.ok(error instanceof CoverContractError, `expected a CoverContractError, got ${String(error)}`);
		return error;
	}
	throw new Error('expected the call to reject');
}

// ─── 1. The three tiers + a differential control per boundary ────────────────

/** One FILI class, one qualified teacher, one blanket-permission teacher, one stranger. */
function tierWorld(permissionFor?: number): World {
	return buildWorld({
		faculty: [
			faculty(101, 'FILI', { firstName: 'Ana', lastName: 'Dela Cruz', maxHours: 30 }),
			faculty(102, 'SCI', { firstName: 'Maria', lastName: 'Reyes', canTeachOutsideDepartment: true }),
			faculty(103, 'MATH', { firstName: 'Ben', lastName: 'Santos' }),
			faculty(900, 'FILI', { placeholder: true, firstName: 'To', lastName: 'Be Hired' }),
		],
		permissions: permissionFor === undefined
			? []
			: [{ id: 1, schoolId: SCHOOL, facultyId: permissionFor, subjectId: FILI, createdAt: now }],
	});
}

test('1a. cover-candidates ranks QUALIFIED, OTHER_DEPARTMENT, ANYONE in tier order', async () => {
	const world = tierWorld();
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));

	assert.deepEqual(response.candidates.map((row) => row.tier), ['QUALIFIED', 'OTHER_DEPARTMENT', 'ANYONE']);
	assert.deepEqual(response.counts, { QUALIFIED: 1, OTHER_DEPARTMENT: 1, ANYONE: 1, total: 3 });
	// A placeholder is never a candidate, at any tier.
	assert.equal(response.candidates.some((row) => row.facultyId === 900), false, 'no placeholder may appear');
	assert.equal(response.candidates.every((row) => row.isPlaceholder === false), true);
	assert.equal(response.weeklyMinutes, 240);
	assert.equal(response.subject.code, 'FILI');
	assert.equal(response.section.id, SECTION_FILI_A);
});

test('1b. QUALIFIED boundary: the same teacher is QUALIFIED only while their department owns the subject', async () => {
	const qualified = await withWorld(tierWorld(), () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const moved = tierWorld();
	// Flip ONE input: Ana moves out of the owning department and loses the blanket
	// flag she never had. Same teacher, same subject, one changed fact.
	const ana = moved.faculty.find((row) => row.id === 101)!;
	ana.department = 'SCI';
	const demoted = await withWorld(moved, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));

	assert.equal(qualified.candidates.find((row) => row.facultyId === 101)!.tier, 'QUALIFIED');
	assert.equal(demoted.candidates.find((row) => row.facultyId === 101)!.tier, 'ANYONE');
	assert.equal(demoted.candidates.find((row) => row.facultyId === 101)!.needsPermission, true);
	// A QUALIFIED teacher never needs a permission.
	assert.equal(qualified.candidates.find((row) => row.facultyId === 101)!.needsPermission, false);
});

test('1c. OTHER_DEPARTMENT boundary: the blanket flag is what promotes ANYONE to OTHER_DEPARTMENT', async () => {
	const withoutFlag = await withWorld(tierWorld(), () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const withFlag = tierWorld();
	withFlag.faculty.find((row) => row.id === 103)!.canTeachOutsideDepartment = true;
	const promoted = await withWorld(withFlag, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));

	assert.equal(withoutFlag.candidates.find((row) => row.facultyId === 103)!.tier, 'ANYONE');
	assert.equal(withoutFlag.candidates.find((row) => row.facultyId === 103)!.qualificationAuthority, null);
	assert.equal(promoted.candidates.find((row) => row.facultyId === 103)!.tier, 'OTHER_DEPARTMENT');
	assert.equal(promoted.candidates.find((row) => row.facultyId === 103)!.qualificationAuthority, 'OUTSIDE_DEPARTMENT_OVERRIDE');
	// And a permission row promotes them the same way, through its OWN authority.
	const viaPermission = await withWorld(tierWorld(103), () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const permitted = viaPermission.candidates.find((row) => row.facultyId === 103)!;
	assert.equal(permitted.tier, 'OTHER_DEPARTMENT');
	assert.equal(permitted.permissionGranted, true);
	assert.equal(permitted.needsPermission, false, 'an existing permission removes the prompt');
	assert.equal(permitted.qualificationAuthority, 'CROSS_DEPARTMENT_PERMISSION');
});

test('1d. EVERY candidate row carries the nine packet keys the client requires', async () => {
	const response = await withWorld(tierWorld(), () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const required = [
		'facultyId', 'name', 'department', 'tier', 'hoursNow',
		'hoursAfter', 'cap', 'overCapAfter', 'reason',
		'specialization', 'isPlaceholder', 'hasRoom', 'needsPermission',
		'permissionGranted', 'canTeachOutsideDepartment', 'qualificationAuthority', 'version',
	];
	for (const row of response.candidates) {
		for (const key of required) {
			assert.ok(key in row, `missing ${key}`);
		}
		assert.equal(typeof row.name, 'string');
		assert.ok(row.name.length > 0, 'name is already assembled');
		assert.ok(typeof row.reason === 'string' && row.reason.length > 0, 'reason names the situation');
	}
	// Over-cap rows stay in the list with `overCapAfter: true` (contract §0.1).
	const loaded = tierWorld();
	// A 3 h contract cannot hold a 4 h class, so the row is over cap after.
	loaded.faculty.find((row) => row.id === 101)!.maxHoursPerWeek = 3;
	const overCap = await withWorld(loaded, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	assert.equal(overCap.candidates.length, 3, 'an over-cap row is shown, not hidden');
	assert.equal(overCap.candidates.find((row) => row.facultyId === 101)!.overCapAfter, true);
	assert.equal(overCap.candidates.find((row) => row.facultyId === 101)!.hasRoom, false);
});

test('1e. ranking is tier, then hasRoom, then hoursAfter, then name', async () => {
	const world = buildWorld({
		faculty: [
			faculty(101, 'FILI', { firstName: 'Zoe', lastName: 'A', maxHours: 30 }),
			faculty(102, 'FILI', { firstName: 'Amy', lastName: 'B', maxHours: 30 }),
			faculty(103, 'SCI', { firstName: 'Bea', lastName: 'C', canTeachOutsideDepartment: true }),
		],
		ownerships: [],
	});
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	// Both QUALIFIED rows have identical hours, so name ascending decides.
	assert.deepEqual(
		response.candidates.map((row) => row.name),
		['Amy B', 'Zoe A', 'Bea C'],
	);
});

test('1f. subjectId and sectionId are both required and must be numeric', async () => {
	const world = tierWorld();
	for (const bad of [
		{ subjectId: undefined, sectionId: SECTION_FILI_A },
		{ subjectId: FILI, sectionId: undefined },
		{ subjectId: 'abc', sectionId: SECTION_FILI_A },
		{ subjectId: FILI, sectionId: 'xyz' },
	]) {
		const error = await withWorld(world, () => catchError(() => listCoverCandidates({
			schoolId: SCHOOL, schoolYearId: YEAR, ...bad,
		})));
		assert.equal(error.statusCode, 400);
		assert.equal(error.code, 'INVALID_PARAM');
	}
});

// ─── 2. Cap maths, proved against the shared capacity service ────────────────

test('2a. hoursNow/hoursAfter/cap/overCapAfter agree with the ONE capacity contract', async () => {
	const world = tierWorld();
	const ana = world.faculty.find((row) => row.id === 101)!;
	ana.maxHoursPerWeek = 30;
	ana.ancillaryMinutesPerWeek = 60;

	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const row = response.candidates.find((entry) => entry.facultyId === 101)!;
	const expected = evaluateWeeklyLoad(0, { maxHoursPerWeek: 30, ancillaryMinutesPerWeek: 60 });

	assert.equal(row.hoursNow, 0);
	assert.equal(row.hoursAfter, 4, '240 min / 60 = 4 h');
	assert.equal(row.cap, expected.capMinutes / 60);
	assert.equal(row.overCapAfter, false);
	assert.equal(row.hasRoom, true);
});

test('2b. hoursNow is the CANONICAL rollup, not a raw sum (rotation family concurrent peak)', async () => {
	// TLE is a two-term rotation family. Its THREE same-term (modularOrder 1)
	// sections run CONCURRENTLY, so 3 x 240 min must bill 720 min (12 h), NOT the
	// family peak of 240 min (4 h). This is the 2026-09-02 PAOLO/FRANCIS 114h rule.
	const TLE_TERM_1 = TLE;
	const TLE_TERM_2 = 25;
	const TLE_TERM_3 = 26;
	// The ordered-term contract has THREE terms, so a rotation family must supply
	// all three ordered subjects or derived demand fails closed
	// (ROTATION_INCOMPLETE). The teacher below only holds TERM 1 sections.
	const tleTerm1 = subject(TLE_TERM_1, 'TLE', 'TLE', [7], {
		rotationFamily: 'TLE', modularGroupId: 'TLE', modularOrder: 1, termGroupId: 'TLE-AB', termCount: 3,
	});
	const tleTerm2 = subject(TLE_TERM_2, 'TLE', 'TLE', [7], {
		rotationFamily: 'TLE', modularGroupId: 'TLE', modularOrder: 2, termGroupId: 'TLE-AB', termCount: 3,
	});
	const tleTerm3 = subject(TLE_TERM_3, 'TLE', 'TLE', [7], {
		rotationFamily: 'TLE', modularGroupId: 'TLE', modularOrder: 3, termGroupId: 'TLE-AB', termCount: 3,
	});
	const world = buildWorld({
		subjects: [
			subject(FILI, 'FILI', 'FILI', [7]),
			tleTerm1, tleTerm2, tleTerm3,
			subject(MAPEH, 'MAPEH', 'MAPEH', [7]),
		],
		sections: [
			section(SECTION_TLE_A), section(SECTION_TLE_B), section(SECTION_TLE_C),
			section(7025, 7),
		],
		faculty: [faculty(101, 'TLE', { maxHours: 30 })],
		facultySubjects: [facultySubjectRow(700, 101, TLE_TERM_1)],
		ownerships: [
			ownershipRow(1, 101, tleTerm1, SECTION_TLE_A),
			ownershipRow(2, 101, tleTerm1, SECTION_TLE_B),
			ownershipRow(3, 101, tleTerm1, SECTION_TLE_C),
		],
	});
	// MAPEH in grade 7 is the class being covered; the TLE teacher is its candidate
	// and the three held TLE sections are her current load.
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: MAPEH, sectionId: 7025,
	}));
	const row = response.candidates.find((entry) => entry.facultyId === 101)!;

	assert.equal(row.hoursNow, 12, 'three same-term rotation sections ADD UP: 720 min = 12 h');
	assert.notEqual(row.hoursNow, 4, 'the family peak (4 h) would under-bill the concurrent load');
	assert.equal(row.hoursAfter, 16, 'one further 240-min class');
	assert.equal(row.cap, 30);
	assert.equal(row.overCapAfter, false);

	// Cross-check against the ONE auto-fill ledger: same input, same number.
	const { __testComputeCreditedCapacityMinutes } = await import('../services/teaching-load-automation.service.js');
	const lanes = new Map([
		['family:TLE:term:1:7011', 240],
		['family:TLE:term:1:7012', 240],
		['family:TLE:term:1:7013', 240],
	]);
	assert.equal(__testComputeCreditedCapacityMinutes(lanes), 720, 'the shared ledger agrees');
});

test('2c. overCapAfter flips exactly when the class would exceed the cap', async () => {
	const world = tierWorld();
	// 30 h cap; give Ana 4 h of existing load in another subject so +4 h lands at 8 h.
	world.facultySubjects.push(facultySubjectRow(700, 101, MAPEH));
	world.ownerships.push(ownershipRow(1, 101, world.subjects.find((row) => row.id === MAPEH)!, 7099));
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const ana = response.candidates.find((row) => row.facultyId === 101)!;
	// The unrelated MATH subject holds 240 min, so hoursNow is 4 and hoursAfter 8.
	assert.equal(ana.hoursNow, 4);
	assert.equal(ana.hoursAfter, 8);
	assert.equal(ana.cap, 30);
	assert.equal(ana.overCapAfter, false);

	const tight = tierWorld();
	tight.faculty.find((row) => row.id === 101)!.maxHoursPerWeek = 6;
	tight.facultySubjects.push(facultySubjectRow(700, 101, MAPEH));
	tight.ownerships.push(ownershipRow(1, 101, tight.subjects.find((row) => row.id === MAPEH)!, 7099));
	const tightResponse = await withWorld(tight, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const capped = tightResponse.candidates.find((row) => row.facultyId === 101)!;
	assert.equal(capped.hoursAfter, 8);
	assert.equal(capped.cap, 6, 'a 6 h contract floors to a 6 h cap');
	assert.equal(capped.overCapAfter, true, '8 h of work against a 6 h cap is over');
	assert.equal(capped.hasRoom, false);
});

test('2d. an over-cap QUALIFIED teacher is still ranked first inside its tier', async () => {
	// Contract §0.1: over-cap rows are shown and ranked last INSIDE their tier, not
	// filtered out. Ana is QUALIFIED but at a 0 h budget; Ben (ANYONE) has room.
	const world = tierWorld();
	world.faculty.find((row) => row.id === 101)!.maxHoursPerWeek = 0;
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	assert.equal(response.candidates[0].facultyId, 101, 'the QUALIFIED tier still leads');
	assert.equal(response.candidates[0].overCapAfter, true);
});

// ─── 3. 409 NEEDS_PERMISSION, then the one-transaction grant ─────────────────

function assignWorld(grantPermission = false): World {
	return buildWorld({
		faculty: [
			faculty(102, 'SCI', { firstName: 'Maria', lastName: 'Reyes' }),
			faculty(101, 'FILI', { firstName: 'Ana', lastName: 'Dela Cruz' }),
		],
	});
}

test('3a. assigning an out-of-department teacher without a permission is 409 NEEDS_PERMISSION with the exact body', async () => {
	const world = assignWorld();
	const error = await withWorld(world, () => catchError(() => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: false, actorId: ACTOR,
	})));

	assert.equal(error.statusCode, 409);
	assert.equal(error.code, 'NEEDS_PERMISSION');
	assert.deepEqual(error.payload, {
		code: 'NEEDS_PERMISSION',
		facultyId: 102,
		facultyName: 'Maria Reyes',
		department: 'SCI',
		subjectId: FILI,
		subjectCode: 'FILI',
		subjectName: 'FILI subject',
		canTeachOutsideDepartment: false,
	}, 'every field the client prompt needs is present, and the code is inside the body');
	// Zero writes: a 409 is a question, not a half-finished assignment.
	assert.deepEqual(world.permissions, []);
	assert.deepEqual(world.ownerships, []);
	assert.deepEqual(world.facultySubjects, []);
});

test('3b. a QUALIFIED teacher needs no permission at all', async () => {
	const world = assignWorld();
	const result = await withWorld(world, () => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 101, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: false, actorId: ACTOR,
	}));
	assert.equal(result.facultyId, 101);
	assert.equal(result.permissionCreated, false);
	assert.equal(result.weeklyMinutes, 240);
});

test('3c. the grantPermission retry writes BOTH rows in ONE Serializable transaction', async () => {
	const world = assignWorld();
	let state!: { writes: Write[]; transactions: Row[] };
	const result = await withWorld(world, (inner) => {
		state = inner;
		return createCoverAssignment({
			schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
			grantPermission: true, actorId: ACTOR,
		});
	});

	assert.equal(result.permissionCreated, true);
	assert.equal(result.facultyId, 102);
	assert.equal(result.subjectId, FILI);
	assert.equal(result.sectionId, SECTION_FILI_A);
	assert.equal(typeof result.assignmentVersion, 'number');

	assert.equal(state.transactions.length, 1, 'exactly one transaction');
	assert.equal(state.transactions[0].isolationLevel, 'Serializable', 'and it is Serializable');
	assert.equal(world.permissions.length, 1, 'the permission row exists');
	assert.equal(world.permissions[0].facultyId, 102);
	assert.equal(world.ownerships.length, 1, 'the ownership row exists');
	assert.equal(world.ownerships[0].facultyId, 102);
	assert.equal(world.ownerships[0].sectionId, SECTION_FILI_A);
	assert.equal(world.facultySubjects.length, 1);
	assert.equal(world.auditLog.length, 1, 'the assignment is audited');
	assert.equal(world.auditLog[0].action, 'TEACHING_LOAD_COVER_ASSIGNMENT');
});

test('3d. a failure after the permission write rolls BOTH rows back (one transaction, not two)', async () => {
	const world = assignWorld();
	// The ownership insert fails mid-transaction. The permission row was already
	// written by then, so only a real rollback can leave the world clean — an
	// orphaned permission would silently authorise a class nobody owns.
	const { client } = buildClient(world);
	const realCreate = client.subjectSectionOwnership.create;
	let injected = false;
	client.subjectSectionOwnership.create = async (args: any) => {
		if (!injected) {
			injected = true;
			throw new Error('injected ownership failure');
		}
		return realCreate(args);
	};
	await withDataContext(client, async () => {
		try {
			await createCoverAssignment({
				schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
				grantPermission: true, actorId: ACTOR,
			});
		} catch {
			// the injected failure
		}
	});

	assert.equal(injected, true, 'the failure really was injected');
	assert.deepEqual(world.permissions, [], 'no orphan permission survives the rollback');
	assert.deepEqual(world.ownerships, [], 'and no orphan ownership either');
	assert.deepEqual(world.auditLog, [], 'the audit row is written after the transaction, so none');
});

test('3e. a section already owned by somebody else is 409 SECTION_ALREADY_OWNED', async () => {
	const world = assignWorld();
	await withWorld(world, () => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 101, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: false, actorId: ACTOR,
	}));
	const error = await withWorld(world, () => catchError(() => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: true, actorId: ACTOR,
	})));
	assert.equal(error.statusCode, 409);
	assert.equal(error.code, 'SECTION_ALREADY_OWNED');
});

test('3f. a pair outside canonical demand is 400 OUTSIDE_CANONICAL_DEMAND', async () => {
	const world = assignWorld();
	// FILI is offered in grade 8 only, so (FILI, grade-7 section) is a real
	// subject and a real section that simply is NOT canonical demand.
	world.subjects.find((row) => row.id === FILI)!.gradeLevels = [8];
	const error = await withWorld(world, () => catchError(() => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 101, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: false, actorId: ACTOR,
	})));
	assert.equal(error.statusCode, 400);
	assert.equal(error.code, 'OUTSIDE_CANONICAL_DEMAND');
	assert.deepEqual(world.ownerships, [], 'and nothing was written');

	// The candidate read refuses the same pair, so it is never offered either.
	const readError = await withWorld(world, () => catchError(() => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	})));
	assert.equal(readError.code, 'OUTSIDE_CANONICAL_DEMAND');
});

test('3g. a placeholder can never be assigned the class', async () => {
	const world = buildWorld({
		faculty: [faculty(900, 'FILI', { placeholder: true }), faculty(101, 'FILI')],
	});
	const error = await withWorld(world, () => catchError(() => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 900, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: true, actorId: ACTOR,
	})));
	assert.equal(error.statusCode, 400);
	assert.equal(error.code, 'PLACEHOLDER_NOT_ASSIGNABLE');
	assert.deepEqual(world.ownerships, []);
});

test('3h. an existing permission makes the plain retry succeed with permissionCreated false', async () => {
	const world = assignWorld();
	world.permissions.push({ id: 1, schoolId: SCHOOL, facultyId: 102, subjectId: FILI, createdAt: now });
	const result = await withWorld(world, () => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: true, actorId: ACTOR,
	}));
	assert.equal(result.permissionCreated, false, 'the row already existed');
	assert.equal(world.permissions.length, 1, 'and no duplicate was written');
	assert.equal(world.ownerships.length, 1);
});

// ─── 4. No placeholder while a real teacher has room ────────────────────────

/**
 * A world with EXACTLY ONE canonical pair (MAPEH in the three named grade-7
 * sections), so an auto-fill / open-class assertion is about that pair and not
 * about the rest of the catalogue.
 */
function isolatedWorld(overrides: Partial<World> = {}): World {
	return buildWorld({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [
			section(SECTION_OPEN_UNOWNED),
			section(SECTION_OPEN_PLACEHOLDER),
			section(SECTION_OPEN_OWNED),
		],
		...overrides,
	});
}

test('4a. a qualified placeholder with free hours never appears in cover-candidates', async () => {
	const world = buildWorld({
		faculty: [
			faculty(101, 'FILI', { maxHours: 30 }),
			faculty(900, 'FILI', { placeholder: true, maxHours: 30 }),
		],
	});
	const response = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	assert.equal(response.candidates.length, 1);
	assert.equal(response.candidates[0].facultyId, 101);
	assert.equal(response.counts.total, 1, 'the placeholder is not counted either');
});

test('4b. autoFill: the saved-placeholder pool is unreachable while ANY real teacher has room', async () => {
	// Ana (SCI) is unqualified for MAPEH — tier null — but she HAS room. A8 c4
	// makes the ANYONE tier reachable, so the placeholder pool must never open.
	const world = isolatedWorld({
		faculty: [
			faculty(101, 'SCI', { maxHours: 30 }),
			faculty(900, 'MAPEH', { placeholder: true, maxHours: 30 }),
		],
		facultySubjects: [facultySubjectRow(700, 900, MAPEH)],
	});
	const result = await withWorld(world, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	const rows = result.suggestedRows ?? [];

	assert.equal(rows.some((row) => row.assignmentType === 'PLACEHOLDER_TEACHER'), false,
		'a placeholder must not be proposed while a real teacher has room');
	assert.equal(rows.some((row) => row.assignmentType === 'REAL_TEACHER' && row.facultyId === 101), true,
		'the ANYONE-tier real teacher takes it instead');
	assert.equal(result.stillNeedRealTeacher, 0);
});

test('4c. autoFill: the placeholder pool opens only when NO real teacher has room', async () => {
	const world = isolatedWorld({
		faculty: [
			faculty(101, 'SCI', { maxHours: 1 }),
			faculty(900, 'MAPEH', { placeholder: true, maxHours: 30 }),
		],
		facultySubjects: [facultySubjectRow(700, 900, MAPEH)],
	});
	const result = await withWorld(world, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	assert.equal((result.suggestedRows ?? []).some((row) => row.assignmentType === 'PLACEHOLDER_TEACHER'), true,
		'with no real teacher able to hold the class, the placeholder is the last resort');
});

test('4d. allowPlaceholders:false makes the pool unreachable even when nobody else can help', async () => {
	const world = isolatedWorld({
		faculty: [
			faculty(101, 'SCI', { maxHours: 1 }),
			faculty(900, 'MAPEH', { placeholder: true, maxHours: 30 }),
		],
		facultySubjects: [facultySubjectRow(700, 900, MAPEH)],
	});
	const result = await withWorld(world, () => autoFill(SCHOOL, YEAR, undefined, {
		previewOnly: true,
		allowPlaceholders: false,
	}));
	assert.equal((result.suggestedRows ?? []).some((row) => row.assignmentType === 'PLACEHOLDER_TEACHER'), false,
		'a caller that requires real teachers only never gets a placeholder');
	assert.ok((result.stillNeedRealTeacher ?? 0) > 0, 'the pairs are honestly left uncovered instead');
});

test('4e. autoFill still proposes NO placeholder when a real QUALIFIED teacher has room (preserved)', async () => {
	const world = isolatedWorld({
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 30 }),
			faculty(900, 'MAPEH', { placeholder: true, maxHours: 30 }),
		],
		facultySubjects: [facultySubjectRow(700, 900, MAPEH)],
	});
	const result = await withWorld(world, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	assert.equal((result.suggestedRows ?? []).some((row) => row.assignmentType === 'PLACEHOLDER_TEACHER'), false);
	assert.equal((result.suggestedRows ?? []).some((row) => row.assignmentType === 'REAL_TEACHER'), true);
});

// ─── 5. cover-open-classes: the honest count ────────────────────────────────

test('5a. unowned + placeholderOwned === total, and a placeholder-owned class is OPEN', async () => {
	const mapeh = subject(MAPEH, 'MAPEH', 'MAPEH', [7]);
	const world = isolatedWorld({
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 30 }),
			faculty(900, 'MAPEH', { placeholder: true, firstName: 'To', lastName: 'Be Hired' }),
		],
		facultySubjects: [
			facultySubjectRow(700, 101, MAPEH),
			facultySubjectRow(701, 900, MAPEH),
		],
		ownerships: [
			ownershipRow(1, 900, mapeh, SECTION_OPEN_PLACEHOLDER),
			ownershipRow(2, 101, mapeh, SECTION_OPEN_OWNED),
		],
	});

	const response = await withWorld(world, () => listCoverOpenClasses({ schoolId: SCHOOL, schoolYearId: YEAR }));

	assert.equal(response.counts.total, 2, 'only the two OPEN classes are listed');
	assert.equal(response.counts.unowned, 1);
	assert.equal(response.counts.placeholderOwned, 1);
	assert.equal(
		response.counts.unowned + response.counts.placeholderOwned,
		response.counts.total,
		'the counting rule the client relies on',
	);

	const bySection = new Map(response.classes.map((row) => [row.sectionId, row]));
	assert.equal(bySection.get(SECTION_OPEN_UNOWNED)!.heldByFacultyId, null);
	assert.equal(bySection.get(SECTION_OPEN_UNOWNED)!.heldByName, null);
	assert.equal(bySection.get(SECTION_OPEN_PLACEHOLDER)!.heldByIsPlaceholder, true,
		'a placeholder-owned class is reported OPEN, never staffed');
	assert.equal(bySection.get(SECTION_OPEN_PLACEHOLDER)!.heldByFacultyId, 900);
	assert.equal(bySection.get(SECTION_OPEN_PLACEHOLDER)!.heldByName, 'To Be Hired');
	assert.equal(bySection.has(SECTION_OPEN_OWNED), false,
		'a class owned by a REAL teacher is not open, so it is not listed');
	assert.equal(bySection.get(SECTION_OPEN_UNOWNED)!.weeklyHoursPerWeek, 4);
	assert.equal(bySection.get(SECTION_OPEN_UNOWNED)!.subjectCode, 'MAPEH');
	assert.equal(bySection.get(SECTION_OPEN_UNOWNED)!.gradeLevel, 7);
});

test('5b. the subjectId and gradeLevel filters narrow the open set', async () => {
	const mapeh = subject(MAPEH, 'MAPEH', 'MAPEH', [7]);
	const world = buildWorld({
		faculty: [faculty(101, 'MAPEH')],
		sections: [section(7031, 7), section(7032, 8)],
	});
	world.subjects.push(mapeh);
	world.subjects.find((row) => row.id === FILI)!.gradeLevels = [7, 8];

	const all = await withWorld(world, () => listCoverOpenClasses({ schoolId: SCHOOL, schoolYearId: YEAR }));
	assert.ok(all.counts.total > 2, 'the unfiltered set spans both subjects and both grades');

	const byGrade = await withWorld(world, () => listCoverOpenClasses({ schoolId: SCHOOL, schoolYearId: YEAR, gradeLevel: 8 }));
	assert.equal(byGrade.classes.every((row) => row.gradeLevel === 8), true);

	const bySubject = await withWorld(world, () => listCoverOpenClasses({ schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI }));
	assert.equal(bySubject.classes.every((row) => row.subjectId === FILI), true);
	assert.equal(bySubject.counts.total, bySubject.classes.length);
});

// ─── 6. Subject permissions: list, idempotent grant, idempotent revoke ───────

test('6a. GET subject-permissions returns the granted subjects sorted by code', async () => {
	const world = buildWorld({
		faculty: [faculty(102, 'SCI', { canTeachOutsideDepartment: true })],
		permissions: [
			{ id: 2, schoolId: SCHOOL, facultyId: 102, subjectId: MATH, createdAt: new Date('2026-09-20T00:00:00.000Z'), subject: { code: 'MATH', name: 'Mathematics', ownerDepartment: 'MATH' } },
			{ id: 1, schoolId: SCHOOL, facultyId: 102, subjectId: FILI, createdAt: new Date('2026-09-29T00:00:00.000Z'), subject: { code: 'FILI', name: 'Filipino', ownerDepartment: 'FILI' } },
		],
	});
	const response = await withWorld(world, () => listSubjectPermissions({ schoolId: SCHOOL, facultyId: 102 }));

	assert.equal(response.schoolId, SCHOOL);
	assert.equal(response.facultyId, 102);
	assert.equal(response.canTeachOutsideDepartment, true);
	assert.deepEqual(response.subjects.map((row) => row.code), ['FILI', 'MATH'], 'sorted by subject code');
	assert.equal(response.subjects[0].grantedAt, '2026-09-29T00:00:00.000Z');
});

test('6b. POST is idempotent: first grant created:true, re-grant created:false', async () => {
	const world = buildWorld({ faculty: [faculty(102, 'SCI')] });
	const first = await withWorld(world, () => createSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));
	assert.deepEqual(first, { facultyId: 102, subjectId: FILI, created: true });
	assert.equal(world.permissions.length, 1);
	assert.equal(world.auditLog.length, 1);
	assert.equal(world.auditLog[0].action, 'CROSS_DEPARTMENT_PERMISSION_GRANTED');

	const again = await withWorld(world, () => createSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));
	assert.deepEqual(again, { facultyId: 102, subjectId: FILI, created: false },
		'`created:false` is success, not an error');
	assert.equal(world.permissions.length, 1, 'no duplicate row');
});

test('6c. DELETE is idempotent: removed:true then removed:false (never 404)', async () => {
	const world = buildWorld({ faculty: [faculty(102, 'SCI')] });
	await withWorld(world, () => createSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));
	const first = await withWorld(world, () => deleteSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));
	assert.deepEqual(first, { removed: true });
	assert.equal(world.permissions.length, 0);
	assert.equal(world.auditLog.at(-1)!.action, 'CROSS_DEPARTMENT_PERMISSION_REVOKED');

	const absent = await withWorld(world, () => deleteSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));
	assert.deepEqual(absent, { removed: false }, 'deleting an absent permission is a success, not a 404');
});

test('6d. a granted permission is effective on the very next cover-candidates read', async () => {
	const world = assignWorld();
	const before = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	assert.equal(before.candidates.find((row) => row.facultyId === 102)!.needsPermission, true);

	await withWorld(world, () => createSubjectPermission({
		schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR,
	}));

	// A NEW policy cache would be required for the tier to change, so this also
	// proves the write invalidated it.
	const after = await withWorld(world, () => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_FILI_A,
	}));
	const row = after.candidates.find((entry) => entry.facultyId === 102)!;
	assert.equal(row.permissionGranted, true);
	assert.equal(row.needsPermission, false);
	assert.equal(row.tier, 'OTHER_DEPARTMENT');
});

// ─── 7. Scope: another school / another year fails closed ───────────────────

test('7a. a teacher, subject or section from another school is refused', async () => {
	const world = buildWorld({
		faculty: [
			faculty(102, 'SCI', { schoolId: OTHER_SCHOOL }),
			faculty(101, 'FILI'),
		],
		subjects: [
			subject(FILI, 'FILI', 'FILI', [7]),
			subject(MATH, 'MATH', 'MATH', [7], { schoolId: OTHER_SCHOOL }),
		],
	});

	const foreignSubject = await withWorld(world, () => catchError(() => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: MATH, sectionId: SECTION_FILI_A,
	})));
	assert.equal(foreignSubject.statusCode, 400);
	assert.equal(foreignSubject.code, 'SUBJECT_NOT_FOUND');

	const foreignFaculty = await withWorld(world, () => catchError(() => createCoverAssignment({
		schoolId: SCHOOL, schoolYearId: YEAR, facultyId: 102, subjectId: FILI, sectionId: SECTION_FILI_A,
		grantPermission: true, actorId: ACTOR,
	})));
	assert.equal(foreignFaculty.statusCode, 400);
	assert.equal(foreignFaculty.code, 'FACULTY_NOT_FOUND');
	assert.deepEqual(world.permissions, [], 'and nothing was written for another school');
});

test('7b. a section belonging to another year is refused', async () => {
	const world = buildWorld({
		sections: [section(SECTION_FILI_A), section(SECTION_OPEN_OWNED, 7, { schoolYearId: OTHER_YEAR })],
		faculty: [faculty(101, 'FILI')],
	});
	const error = await withWorld(world, () => catchError(() => listCoverCandidates({
		schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_OPEN_OWNED,
	})));
	assert.equal(error.statusCode, 400);
	assert.equal(error.code, 'SECTION_NOT_FOUND');
});

test('7c. a permission request for another school\'s teacher is SCHOOL_SCOPE_MISMATCH', async () => {
	const world = buildWorld({ faculty: [faculty(102, 'SCI', { schoolId: OTHER_SCHOOL })] });
	for (const call of [
		() => listSubjectPermissions({ schoolId: SCHOOL, facultyId: 102 }),
		() => createSubjectPermission({ schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR }),
		() => deleteSubjectPermission({ schoolId: SCHOOL, facultyId: 102, subjectId: FILI, actorId: ACTOR, schoolYearId: YEAR }),
	]) {
		const error = await withWorld(world, () => catchError(call));
		assert.equal(error.statusCode, 400);
		assert.equal(error.code, 'SCHOOL_SCOPE_MISMATCH');
	}
	assert.deepEqual(world.permissions, []);
});
