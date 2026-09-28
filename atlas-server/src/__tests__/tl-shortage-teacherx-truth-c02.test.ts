import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { autoFill, type AutoFillResult } from '../services/teaching-load-automation.service.js';

/**
 * A8 TL-SHORTAGE-C02 items 2 and 3 — the real `autoFill` production path, over a
 * hermetic Prisma-shaped READ client. No database is used and every write
 * operation is an explicit failure, so a preview that tries to persist proves
 * the preview-only contract still holds.
 *
 * item 2: Teacher-X mode must report `stillNeedRealTeacher > 0` when it cannot
 * resolve every pair, and 0 when it fully resolves. Its substitute rows are
 * counted as UNSAVED.
 *
 * item 3: a SAVED placeholder (a real `FacultyMirror` row with
 * `isPlaceholder: true` and a persisted `facultySubject` qualification) is
 * assignable — but only after every real, qualified teacher for that subject is
 * at cap, only for subjects it actually holds a qualification row for, and
 * never beyond its own `maxHoursPerWeek` budget.
 */

type Row = Record<string, any>;

const now = new Date('2026-09-29T00:00:00.000Z');
const SCHOOL = 1;
const YEAR = 9;
const ACTOR = 77;

const MATH = 21;
const FILI = 22;
const MAPEH = 23;

const SECTION_MATH_A = 7001;
const SECTION_MATH_B = 7002;
const SECTION_FILI_A = 7003;
const SECTION_MAPEH_A = 7004;
const SECTION_MAPEH_B = 7005;
const SECTION_MAPEH_C = 7006;

const WRITE_OPS = [
	'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert',
	'delete', 'deleteMany', 'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
] as const;

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

type Fixture = {
	subjects?: Row[];
	sections?: Row[];
	faculty?: Row[];
	facultySubjects?: Row[];
	policies?: Row[];
};

function readModel(name: string, rows: Row[], writes: string[]): any {
	const model: any = {
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
	for (const operation of WRITE_OPS) {
		model[operation] = async () => {
			writes.push(`${name}.${operation}`);
			throw new Error(`unexpected write ${name}.${operation}`);
		};
	}
	return model;
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

function gradeKey(grade: number): number {
	return grade === 8 ? 18 : grade === 9 ? 19 : grade === 10 ? 20 : 17;
}

function section(externalId: number, grade = 7, programType = 'REGULAR'): Row {
	return {
		id: externalId,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		externalId,
		name: `G${grade}-${externalId}`,
		gradeLevelId: gradeKey(grade),
		gradeLevelName: `Grade ${grade}`,
		displayOrder: grade,
		programType,
		maxCapacity: 50,
		enrolledCount: 50,
		isActiveForScheduling: true,
		isStale: false,
		lastSyncedAt: now,
	};
}

function subject(id: number, code: string, department: string, gradeLevels: number[], minutes = 240): Row {
	return {
		id,
		schoolId: SCHOOL,
		code,
		name: code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		rotationFamily: null,
		gradeLevels,
		programScopes: ['REGULAR'],
		minMinutesPerWeek: minutes,
		modularGroupId: null,
		modularOrder: null,
		termGroupId: null,
		termCount: null,
		ownerDepartment: department,
		requiredFeatures: [],
		allowedSpecializations: [],
		isActive: true,
	};
}

function faculty(id: number, department: string, options: {
	maxHours?: number;
	placeholder?: boolean;
	canTeachOutsideDepartment?: boolean;
} = {}): Row {
	return {
		id,
		schoolId: SCHOOL,
		externalId: 9000 + id,
		employeeId: `E${id}`,
		firstName: 'F',
		lastName: `Teacher${id}`,
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

function facultySubject(id: number, facultyId: number, subjectId: number, sectionIds: number[] = []): Row {
	return {
		id,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		facultyId,
		subjectId,
		sectionIds,
		gradeLevels: [],
		assignedBy: ACTOR,
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

async function runAutoFill(fixture: Fixture, coverageMode?: 'REAL_FACULTY_STANDARD' | 'REAL_FACULTY_HARD_CAP' | 'REAL_FACULTY_THEN_TEACHER_X') {
	const writes: string[] = [];
	const empty: Row[] = [];
	const client: any = {
		enrollProSchoolYearMirror: readModel('enrollProSchoolYearMirror', [{
			schoolId: SCHOOL,
			enrollProSchoolYearId: YEAR,
			yearLabel: '2030-2031',
			isActive: true,
			isArchived: false,
			termContractCache: termCache(),
			termContractCachedAt: now,
		}], writes),
		sectionMirror: readModel('sectionMirror', fixture.sections ?? [], writes),
		sectionSnapshot: { findUnique: async () => null },
		facultyMirror: readModel('facultyMirror', fixture.faculty ?? [], writes),
		subject: readModel('subject', fixture.subjects ?? [], writes),
		subjectSectionOwnership: readModel('subjectSectionOwnership', empty, writes),
		departmentAlias: readModel('departmentAlias', empty, writes),
		departmentLabel: readModel('departmentLabel', empty, writes),
		subjectOwnerPrefix: readModel('subjectOwnerPrefix', empty, writes),
		crossDepartmentPermission: readModel('crossDepartmentPermission', empty, writes),
		specializationAlias: readModel('specializationAlias', empty, writes),
		schedulingPolicy: readModel('schedulingPolicy', fixture.policies ?? [policyRow()], writes),
		facultyGradePreference: readModel('facultyGradePreference', empty, writes),
		gradeShiftWindow: readModel('gradeShiftWindow', empty, writes),
		facultySubject: readModel('facultySubject', fixture.facultySubjects ?? empty, writes),
		teachingLoadCycle: readModel('teachingLoadCycle', empty, writes),
		auditLog: readModel('auditLog', empty, writes),
		instructionalCohort: readModel('instructionalCohort', empty, writes),
		$transaction: async () => {
			writes.push('$transaction');
			throw new Error('unexpected $transaction');
		},
	};

	const result = await withDataContext(client, () => autoFill(SCHOOL, YEAR, undefined, {
		previewOnly: true,
		...(coverageMode ? { coverageMode } : {}),
	}));
	return { result, writes };
}

function rowsOfType(result: AutoFillResult, type: string) {
	return (result.suggestedRows ?? []).filter((row) => row.assignmentType === type);
}

// ─── item 2: Teacher-X must report the truth ───────────────────────────────────

test('item 2: Teacher-X reports stillNeedRealTeacher > 0 and counts substitutes as unsaved', async () => {
	// MAPEH has no qualified real teacher at all, so one pair stays uncovered.
	// Pre-fix this returned `unresolved: 0` because Teacher-X forced the zero.
	const { result, writes } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A)],
		faculty: [faculty(101, 'MATH')],
	}, 'REAL_FACULTY_THEN_TEACHER_X');

	assert.equal(result.stillNeedRealTeacher, 1, 'the still-uncovered MAPEH pair must be reported');
	assert.equal(result.unresolved, 1, '`unresolved` must carry the same truthful count');
	assert.equal(result.teacherXResolution?.unsavedSubstituteRows, 1, 'the substitute row is counted as UNSAVED');
	assert.equal(rowsOfType(result, 'TEMPORARY_SUBSTITUTE').length, 1, 'exactly one substitute row is previewed');
	assert.equal(rowsOfType(result, 'TEMPORARY_SUBSTITUTE')[0].facultyId, null, 'a substitute row is never a persisted faculty');
	assert.deepEqual(writes, [], 'a preview performs zero writes');
});

test('item 2: a Teacher-X run that fully resolves real teachers reports 0', async () => {
	const { result } = await runAutoFill({
		subjects: [subject(MATH, 'MATH', 'MATH', [7])],
		sections: [section(SECTION_MATH_A)],
		faculty: [faculty(101, 'MATH')],
	}, 'REAL_FACULTY_THEN_TEACHER_X');

	assert.equal(result.stillNeedRealTeacher, 0, 'a fully resolved run reports zero');
	assert.equal(result.unresolved, 0);
	assert.equal(result.teacherXResolution?.unsavedSubstituteRows, 0);
});

test('item 2: the still-need count matches the substitute rows and the uncovered summary', async () => {
	// One subject per grade so the canonical pair set is exactly one pair each:
	// a subject offered in grade 7 pairs with every grade-7 section.
	const { result } = await runAutoFill({
		subjects: [
			subject(MAPEH, 'MAPEH', 'MAPEH', [7]),
			subject(FILI, 'FILI', 'FILI', [8]),
		],
		sections: [section(SECTION_MAPEH_A, 7), section(SECTION_FILI_A, 8)],
		faculty: [faculty(101, 'MATH')],
	}, 'REAL_FACULTY_THEN_TEACHER_X');

	assert.equal(result.stillNeedRealTeacher, 2);
	assert.equal(rowsOfType(result, 'TEMPORARY_SUBSTITUTE').length, 2);
	// The distribution summary must agree — the page cannot read "complete"
	// from one field while the plan reports uncovered rows.
	assert.equal(result.distribution?.summary.uncoveredRows, 2);
	assert.deepEqual(result.teacherXResolution?.stillUncoveredSubjectCodes?.sort(), ['FILI', 'MAPEH']);
});

// ─── item 3: a SAVED placeholder is assignable, and only last ──────────────────

test('item 3: a qualified saved placeholder takes uncovered MAPEH pairs after real teachers are at cap', async () => {
	// One real MAPEH teacher can hold exactly one 240-minute pair under a 30h
	// contract only if... he is already at cap. Seed him at 1800 via 7.5 pairs is
	// impractical, so give the real teacher a 4h contract (one pair) and offer two
	// MAPEH pairs: the real teacher takes the first, the placeholder the second.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 4 }),
			faculty(900, 'MAPEH', { maxHours: 30, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	const real = rowsOfType(result, 'REAL_TEACHER').filter((row) => row.facultyId === 101);
	const placeholder = rowsOfType(result, 'PLACEHOLDER_TEACHER');

	assert.equal(real.length, 1, 'the real teacher is assigned first, up to his own 4h contract');
	assert.equal(placeholder.length, 1, 'the placeholder covers the remaining pair');
	assert.equal(placeholder[0].facultyId, 900);
	assert.equal(result.stillNeedRealTeacher, 0, 'a saved placeholder actually closes the gap');
});

test('item 3: the placeholder never takes a pair a real qualified teacher can still hold', async () => {
	// Two MAPEH pairs, one real MAPEH teacher with a 30h contract: he can hold
	// both, so the placeholder must receive nothing.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 30 }),
			faculty(900, 'MAPEH', { maxHours: 30, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	assert.equal(rowsOfType(result, 'PLACEHOLDER_TEACHER').length, 0, 'placeholders are consulted LAST, never first');
	assert.equal(rowsOfType(result, 'REAL_TEACHER').filter((row) => row.facultyId === 101).length, 2);
});

test('item 3: the placeholder is never assigned a subject it holds no qualification row for', async () => {
	// The placeholder holds a FILI qualification only, but the shortage is MAPEH
	// and the real MAPEH teacher is at cap. It must not be assigned MAPEH.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 4 }),
			faculty(900, 'FILI', { maxHours: 30, placeholder: true, canTeachOutsideDepartment: true }),
		],
		facultySubjects: [facultySubject(700, 900, FILI)],
	});

	assert.equal(
		rowsOfType(result, 'PLACEHOLDER_TEACHER').length,
		0,
		'an unqualified placeholder must not be assigned the subject',
	);
	assert.equal(result.stillNeedRealTeacher, 1, 'the pair stays honestly uncovered instead of being mis-assigned');
});

test('item 3: the placeholder is bounded by its OWN budget, never the school hard cap', async () => {
	// Three MAPEH pairs of 240 minutes each. The real teacher holds one under a
	// 4h contract; the placeholder contracts for 5h (300 min), so it may take
	// exactly one more pair (240) and never the third (480 > 300). A placeholder
	// must not inherit the 40h school hard cap and absorb the whole shortage.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B), section(SECTION_MAPEH_C)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 4 }),
			faculty(900, 'MAPEH', { maxHours: 5, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	assert.equal(rowsOfType(result, 'PLACEHOLDER_TEACHER').length, 1, 'a 5h placeholder budget covers exactly one 240-minute pair');
	assert.equal(rowsOfType(result, 'REAL_TEACHER').filter((row) => row.facultyId === 101).length, 1);
	assert.equal(result.stillNeedRealTeacher, 1, 'the third pair remains honestly uncovered');
});

test('item 3: a placeholder budget too small for even one pair takes nothing', async () => {
	// 2h = 120 minutes, smaller than one 240-minute MAPEH pair. Assigning it
	// would mean over-assigning beyond its own contracted budget.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 4 }),
			faculty(900, 'MAPEH', { maxHours: 2, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	assert.equal(rowsOfType(result, 'PLACEHOLDER_TEACHER').length, 0, 'a 2h budget cannot hold a 240-minute pair');
	assert.equal(result.stillNeedRealTeacher, 1);
});

test('item 3: a placeholder assignment is a PERSISTED insert, unlike a substitute', async () => {
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MAPEH', { maxHours: 4 }),
			faculty(900, 'MAPEH', { maxHours: 30, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	const inserts = result.distribution?.inserts ?? [];
	const placeholderInserts = inserts.filter((insert) => insert.facultyId === 900);
	assert.equal(placeholderInserts.length, 1, 'a placeholder assignment appears in the plan as an INSERT');
	assert.equal(
		inserts.filter((insert) => insert.facultyId === 101).length,
		1,
		'the real teacher assignment is also an insert',
	);
	// No substitute-style row (facultyId null) can ever become an insert.
	assert.equal(inserts.filter((insert) => insert.facultyId == null).length, 0);
});

test('item 3: with no qualified real teacher at all, a qualified placeholder closes the whole shortage', async () => {
	// The Codex scenario: a saved placeholder left at no load. It must now be
	// assignable so the shortage is actually closeable from Teaching Load.
	const { result } = await runAutoFill({
		subjects: [subject(MAPEH, 'MAPEH', 'MAPEH', [7])],
		sections: [section(SECTION_MAPEH_A), section(SECTION_MAPEH_B)],
		faculty: [
			faculty(101, 'MATH'),
			faculty(900, 'MAPEH', { maxHours: 30, placeholder: true }),
		],
		facultySubjects: [facultySubject(700, 900, MAPEH)],
	});

	assert.equal(rowsOfType(result, 'PLACEHOLDER_TEACHER').length, 2);
	assert.equal(result.stillNeedRealTeacher, 0);
});
