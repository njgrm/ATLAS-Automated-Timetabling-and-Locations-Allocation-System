/**
 * SHIFT-COHERENCE-C01 (decision D11) — server proof.
 *
 * Covers the frozen contract through the real production paths:
 *  1. the two additive policy switches (default ON/SOFT, HARD switchable, dead
 *     hard gate coerced off) mirror the D9 teacher-lunch switches;
 *  2. the deterministic span rule (G7+G9 spans, G7+G8 does not);
 *  3. `autoFill` guard-off is byte-identical to base (failing-first control);
 *  4. SOFT emits a bounded advisory naming who spans and why and never rejects;
 *  5. HARD filters a spanning candidate while a non-spanning candidate remains,
 *     and leaves the row unresolved with the typed `SHIFT_COHERENCE_CONFLICT`
 *     when none exists — never a thrown/blocking error;
 *  6. existing ownership seeds the teacher's window set;
 *  7. a section with no `grade_shift_windows` authority is excluded, never given
 *     a fabricated window;
 *  8. the migration is additive and never applied by this candidate.
 *
 * Hermetic: an in-memory Prisma-shaped read model drives `autoFill`; no database
 * is used and every write path throws. Run with `tsx --test <this-file>`.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import {
	autoFill,
	evaluateShiftCoherenceSpan,
	resolveSectionShiftWindow,
	type AutoFillResult,
	type ShiftCoherenceWindow,
} from '../services/teaching-load-automation.service.js';
import {
	POLICY_DEFAULTS,
	upsertPolicy,
	validatePolicyInput,
} from '../services/scheduling-policy.service.js';

const here = dirname(fileURLToPath(import.meta.url));
const SCHOOL = 1;
const YEAR = 9;

// ─── A. Policy switches (mirror D9) ─────────────────────────────────────────

test('A1: shift-coherence defaults are enabled and SOFT', () => {
	assert.equal(POLICY_DEFAULTS.enableShiftCoherenceGuard, true, 'guard enabled by default');
	assert.equal(POLICY_DEFAULTS.enforceShiftCoherenceGuard, false, 'guard SOFT by default');

	const { data, errors } = validatePolicyInput({});
	assert.deepEqual(errors, []);
	assert.equal(data.enableShiftCoherenceGuard, true);
	assert.equal(data.enforceShiftCoherenceGuard, false);
});

test('A2: validation accepts the two booleans and coerces a dead hard gate off', () => {
	const enabledHard = validatePolicyInput({ enableShiftCoherenceGuard: true, enforceShiftCoherenceGuard: true });
	assert.deepEqual(enabledHard.errors, []);
	assert.equal(enabledHard.data.enableShiftCoherenceGuard, true);
	assert.equal(enabledHard.data.enforceShiftCoherenceGuard, true);

	// Enforcement without the guard is inert; it must never persist as a dead gate.
	const disabled = validatePolicyInput({ enableShiftCoherenceGuard: false, enforceShiftCoherenceGuard: true });
	assert.deepEqual(disabled.errors, []);
	assert.equal(disabled.data.enableShiftCoherenceGuard, false);
	assert.equal(disabled.data.enforceShiftCoherenceGuard, false);
});

test('A3: validation rejects non-boolean shift-coherence switches with typed errors', () => {
	const badEnable = validatePolicyInput({ enableShiftCoherenceGuard: 'yes' });
	assert.ok(
		badEnable.errors.some((message) => message.includes('enableShiftCoherenceGuard must be a boolean')),
		badEnable.errors.join(' '),
	);
	const badEnforce = validatePolicyInput({ enforceShiftCoherenceGuard: 1 });
	assert.ok(
		badEnforce.errors.some((message) => message.includes('enforceShiftCoherenceGuard must be a boolean')),
		badEnforce.errors.join(' '),
	);
});

test('A4: the PUT surface persists both switches', async () => {
	const captured: { create?: Record<string, unknown>; update?: Record<string, unknown> } = {};
	const client = {
		$executeRawUnsafe: async () => undefined,
		gradeShiftWindow: { findMany: async () => [] },
		schedulingPolicy: {
			upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
				captured.create = args.create;
				captured.update = args.update;
				return { id: 1, ...args.create };
			},
		},
	};
	await withDataContext(client, () => upsertPolicy(SCHOOL, YEAR, {
		enableShiftCoherenceGuard: true,
		enforceShiftCoherenceGuard: true,
	}));
	assert.ok(captured.create, 'upsert create payload captured');
	assert.equal(captured.create?.enableShiftCoherenceGuard, true);
	assert.equal(captured.create?.enforceShiftCoherenceGuard, true);
	assert.equal(captured.update?.enableShiftCoherenceGuard, true);
	assert.equal(captured.update?.enforceShiftCoherenceGuard, true);
});

// ─── B. Deterministic span rule ─────────────────────────────────────────────

function window(gradeLevel: number, startTime: string, endTime: string, programType: string | null = null): ShiftCoherenceWindow {
	return { gradeLevel, programType, startTime, endTime };
}

test('B1: zero or one window never spans', () => {
	assert.equal(evaluateShiftCoherenceSpan([]).spans, false);
	assert.equal(evaluateShiftCoherenceSpan([window(7, '06:00', '15:30')]).spans, false);
});

test('B2: identical G7+G8 windows do not span (mutant: a naive two-window rule would flag)', () => {
	const result = evaluateShiftCoherenceSpan([
		window(7, '06:00', '15:30'),
		window(8, '06:00', '15:30'),
	]);
	assert.equal(result.spans, false, 'identical windows are one distinct window');
	assert.equal(result.windows.length, 1, 'deduped to one distinct window');
});

test('B3: morning + afternoon windows span (06:00-15:30 + 09:45-18:30)', () => {
	const result = evaluateShiftCoherenceSpan([
		window(7, '06:00', '15:30'),
		window(9, '09:45', '18:30'),
	]);
	assert.equal(result.spans, true, 'the union 06:00-18:30 is not itself a window');
	assert.equal(result.windows.length, 2);
});

test('B4: a single window covering the union does not span', () => {
	// A has both the minimum start (06:00) and the maximum end (15:30).
	const result = evaluateShiftCoherenceSpan([
		window(7, '06:00', '15:30'),
		window(7, '06:00', '12:00'),
	]);
	assert.equal(result.spans, false);
});

test('B5: window resolution prefers exact programType, falls back to null, and never fabricates', () => {
	const windows = [
		window(7, '06:00', '15:30', null),
		window(7, '07:00', '16:30', 'STE'),
	];
	assert.equal(resolveSectionShiftWindow({ gradeLevel: 7, programType: 'STE', windows })?.startTime, '07:00');
	assert.equal(resolveSectionShiftWindow({ gradeLevel: 7, programType: 'REGULAR', windows })?.startTime, '06:00');
	assert.equal(resolveSectionShiftWindow({ gradeLevel: 9, programType: 'REGULAR', windows }), null, 'no row -> no fabricated window');
	assert.equal(resolveSectionShiftWindow({ gradeLevel: null, programType: 'REGULAR', windows }), null, 'non-numeric grade -> excluded');
});

// ─── Hermetic Prisma-shaped read model ──────────────────────────────────────

const now = new Date('2026-09-25T00:00:00.000Z');

type Row = Record<string, any>;
type ReadState = { reads: string[]; writes: string[]; transactions: number };

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

function buildReadModel(name: string, rows: Row[], state: ReadState): any {
	const model: any = {
		findMany: async (args: any = {}) => {
			state.reads.push(`${name}.findMany`);
			return rows.filter((row) => matchesWhere(row, args.where)).map((row) => ({ ...row }));
		},
		findFirst: async (args: any = {}) => {
			state.reads.push(`${name}.findFirst`);
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? { ...found } : null;
		},
		findUnique: async (args: any = {}) => {
			state.reads.push(`${name}.findUnique`);
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? { ...found } : null;
		},
		count: async (args: any = {}) => {
			state.reads.push(`${name}.count`);
			return rows.filter((row) => matchesWhere(row, args.where)).length;
		},
	};
	for (const operation of WRITE_OPS) {
		model[operation] = async () => {
			state.writes.push(`${name}.${operation}`);
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

function yearMirror(): Row {
	return {
		schoolId: SCHOOL,
		enrollProSchoolYearId: YEAR,
		yearLabel: '2030-2031',
		isActive: true,
		isArchived: false,
		termContractCache: termCache(),
		termContractCachedAt: now,
	};
}

/** EnrollPro internal grade key: 17 -> Grade 7, 19 -> Grade 9. */
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

function subject(id: number, code: string, gradeLevels: number[], minutes = 240): Row {
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
		ownerDepartment: 'MATH',
		requiredFeatures: [],
		allowedSpecializations: [],
		isActive: true,
	};
}

function faculty(id: number, options: { adviser?: boolean; advisedSectionId?: number | null; maxHours?: number } = {}): Row {
	return {
		id,
		schoolId: SCHOOL,
		externalId: 9000 + id,
		employeeId: `E${id}`,
		firstName: 'F',
		lastName: `Teacher${id}`,
		department: 'MATH',
		specialization: null,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: options.maxHours ?? 30,
		isPlaceholder: false,
		isClassAdviser: options.adviser ?? false,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: null,
		advisedSectionId: options.advisedSectionId ?? null,
		isActiveForScheduling: true,
		isStale: false,
		version: 1,
	};
}

function ownership(id: number, subjectRow: Row, sectionId: number, facultyId: number): Row {
	return {
		id,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		subjectId: subjectRow.id,
		sectionId,
		facultyId,
		facultySubjectId: id,
		facultySubject: {
			assignedBy: 77,
			subject: {
				id: subjectRow.id,
				code: subjectRow.code,
				modularGroupId: null,
				modularOrder: null,
				termGroupId: null,
				termCount: null,
				rotationFamily: null,
				minMinutesPerWeek: subjectRow.minMinutesPerWeek,
			},
		},
	};
}

function gradeWindow(gradeLevel: number, startTime: string, endTime: string, programType: string | null = null): Row {
	return { id: gradeLevel * 10 + (programType ? 1 : 0), schoolId: SCHOOL, schoolYearId: YEAR, gradeLevel, programType, startTime, endTime };
}

type PolicyOverrides = { enable?: boolean; enforce?: boolean };

function policyRow(options: PolicyOverrides = {}): Row {
	return {
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		teachingStandardMinutes: 1800,
		advisoryCreditMinutes: 300,
		hardCapMinutes: 2400,
		periodLengthMinutes: 45,
		earliestStartTime: '06:00',
		latestEndTime: '18:30',
		enableShiftCoherenceGuard: options.enable ?? true,
		enforceShiftCoherenceGuard: options.enforce ?? false,
	};
}

type FixtureOverrides = {
	policy?: Row;
	yearMirrors?: Row[];
	sections?: Row[];
	subjects?: Row[];
	faculty?: Row[];
	ownerships?: Row[];
	gradeWindows?: Row[];
	departmentAliases?: Row[];
	departmentLabels?: Row[];
	subjectOwnerPrefixes?: Row[];
	crossDepartmentPermissions?: Row[];
	specializationAliases?: Row[];
};

function baseState(overrides: FixtureOverrides = {}): Row {
	const { policy, ...rest } = overrides;
	return {
		yearMirrors: [yearMirror()],
		policies: [policy ?? policyRow()],
		sections: [],
		subjects: [],
		faculty: [],
		ownerships: [],
		gradeWindows: [],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [],
		crossDepartmentPermissions: [],
		specializationAliases: [],
		...rest,
	};
}

function buildReadClient(fixture: Row): { client: any; state: ReadState } {
	const state: ReadState = { reads: [], writes: [], transactions: 0 };
	const client: any = {
		enrollProSchoolYearMirror: buildReadModel('enrollProSchoolYearMirror', fixture.yearMirrors ?? [], state),
		sectionMirror: buildReadModel('sectionMirror', fixture.sections ?? [], state),
		sectionSnapshot: {
			findUnique: async () => {
				state.reads.push('sectionSnapshot.findUnique');
				return null;
			},
		},
		facultyMirror: buildReadModel('facultyMirror', fixture.faculty ?? [], state),
		subject: buildReadModel('subject', fixture.subjects ?? [], state),
		subjectSectionOwnership: buildReadModel('subjectSectionOwnership', fixture.ownerships ?? [], state),
		departmentAlias: buildReadModel('departmentAlias', fixture.departmentAliases ?? [], state),
		departmentLabel: buildReadModel('departmentLabel', fixture.departmentLabels ?? [], state),
		subjectOwnerPrefix: buildReadModel('subjectOwnerPrefix', fixture.subjectOwnerPrefixes ?? [], state),
		crossDepartmentPermission: buildReadModel('crossDepartmentPermission', fixture.crossDepartmentPermissions ?? [], state),
		specializationAlias: buildReadModel('specializationAlias', fixture.specializationAliases ?? [], state),
		schedulingPolicy: buildReadModel('schedulingPolicy', fixture.policies ?? [], state),
		facultyGradePreference: buildReadModel('facultyGradePreference', [], state),
		gradeShiftWindow: buildReadModel('gradeShiftWindow', fixture.gradeWindows ?? [], state),
		facultySubject: buildReadModel('facultySubject', [], state),
		teachingLoadCycle: buildReadModel('teachingLoadCycle', [], state),
		auditLog: buildReadModel('auditLog', [], state),
		$transaction: async () => {
			state.transactions += 1;
			state.writes.push('$transaction');
			throw new Error('unexpected $transaction');
		},
	};
	return { client, state };
}

async function runAutoFill(fixture: Row): Promise<{ result: AutoFillResult; state: ReadState }> {
	const { client, state } = buildReadClient(fixture);
	const result = await withDataContext(client, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	return { result, state };
}

function assignedSectionIdsFor(result: AutoFillResult, facultyId: number): number[] {
	return (result.suggestedRows ?? [])
		.filter((row) => row.assignmentType === 'REAL_TEACHER' && row.facultyId === facultyId)
		.map((row) => row.sectionId);
}

function shiftRejections(result: AutoFillResult) {
	return (result.candidateRejections ?? []).filter((row) => row.reason === 'SHIFT_COHERENCE_CONFLICT');
}

// Shared fixture: one MATH subject offered in G7-G9, morning + afternoon windows.
const MATH = subject(21, 'MATH', [7, 8, 9]);
const G7 = section(7001, 7, 'REGULAR');
const G9 = section(7003, 9, 'REGULAR');
const WINDOWS = [gradeWindow(7, '06:00', '15:30'), gradeWindow(9, '09:45', '18:30')];

function spanningFixture(policy: PolicyOverrides, facultyRows: Row[]): Row {
	return baseState({
		policy: policyRow(policy),
		sections: [G7, G9],
		subjects: [MATH],
		faculty: facultyRows,
		gradeWindows: WINDOWS,
	});
}

// ─── C. autoFill real-path controls ─────────────────────────────────────────

test('C1: guard OFF accepts a G7+G9 teacher with no notice (base behaviour / failing-first)', async () => {
	const t1 = faculty(101);
	const { result, state } = await runAutoFill(spanningFixture({ enable: false, enforce: false }, [t1]));

	assert.deepEqual(assignedSectionIdsFor(result, 101).sort((a, b) => a - b), [7001, 7003], 'the teacher is assigned both sections');
	assert.equal(result.unresolved, 0);
	assert.deepEqual(result.shiftCoherenceNotices ?? [], [], 'zero notices when the guard is off');
	assert.deepEqual(shiftRejections(result), [], 'zero shift-coherence rejections when the guard is off');
	assert.equal(state.writes.length, 0, `preview is zero-write (${state.writes.join(', ')})`);
	assert.equal(state.transactions, 0, 'preview opens zero transactions');
});

test('C2: SOFT (default) accepts the assignment and emits a bounded notice naming who spans and why', async () => {
	const t1 = faculty(101);
	const { result } = await runAutoFill(spanningFixture({ enable: true, enforce: false }, [t1]));

	assert.deepEqual(assignedSectionIdsFor(result, 101).sort((a, b) => a - b), [7001, 7003], 'coverage unchanged');
	assert.equal(result.unresolved, 0, 'no coverage change under SOFT');
	assert.deepEqual(shiftRejections(result), [], 'SOFT never rejects a candidate');
	assert.equal((result.shiftCoherenceNotices ?? []).length, 1, 'exactly one bounded notice');
	const notice = result.shiftCoherenceNotices![0];
	assert.equal(notice.reason, 'SHIFT_COHERENCE_CONFLICT');
	assert.equal(notice.facultyId, 101);
	assert.equal(notice.facultyName, 'Teacher101, F');
	assert.deepEqual(
		notice.spanningWindows.map((entry) => `${entry.startTime}-${entry.endTime}`).sort(),
		['06:00-15:30', '09:45-18:30'],
		'the notice names both spanning windows',
	);
	assert.deepEqual(
		notice.sections.map((entry) => entry.id).sort((a, b) => a - b),
		[7001, 7003],
		'the notice names the responsible sections',
	);
	assert.ok(result.warnings.some((line) => line.includes('Shift coherence (SOFT)') && line.includes('Teacher101, F')), 'a human warning names who and why');
});

test('C3: HARD leaves the row unresolved with the typed rejection when no non-spanning candidate exists', async () => {
	const t1 = faculty(101);
	const { result } = await runAutoFill(spanningFixture({ enable: true, enforce: true }, [t1]));

	assert.equal(assignedSectionIdsFor(result, 101).length, 1, 'a spanning teacher is never assigned both sections');
	assert.equal(result.unresolved, 1, 'the row is left unresolved, not thrown');
	const rejections = shiftRejections(result);
	assert.equal(rejections.length, 1, 'one typed rejection names the rejected candidate');
	const rejection = rejections[0];
	assert.equal(rejection.facultyId, 101);
	assert.equal(rejection.facultyName, 'Teacher101, F');
	assert.deepEqual(
		rejection.spanningWindows?.map((entry) => `${entry.startTime}-${entry.endTime}`).sort(),
		['06:00-15:30', '09:45-18:30'],
		'the rejection carries the spanning windows',
	);
	assert.deepEqual(
		rejection.sections?.map((entry) => entry.id).sort((a, b) => a - b),
		[7001, 7003],
		'the rejection carries the responsible sections',
	);
	assert.deepEqual(result.shiftCoherenceNotices ?? [], [], 'HARD surfaces the rejection, not the SOFT advisory');
	assert.ok(result.warnings.some((line) => line.includes('Shift coherence (HARD)')), 'a human warning names the HARD outcome');
});

test('C3b: HARD rejects the spanning candidate and resolves the row with a non-spanning teacher', async () => {
	const t1 = faculty(101, { adviser: true, advisedSectionId: 7003 });
	const t2 = faculty(102);
	const { result } = await runAutoFill(spanningFixture({ enable: true, enforce: true }, [t1, t2]));

	assert.equal(result.unresolved, 0, 'a non-spanning candidate keeps the row resolved');
	assert.equal(shiftRejections(result).length, 1, 'the spanning candidate is rejected with the typed reason');
	assert.equal(shiftRejections(result)[0].facultyId, 101, 'the adviser is the rejected spanning candidate');
	assert.equal(assignedSectionIdsFor(result, 101).length, 1, 'the spanning teacher is assigned at most one section');
	assert.equal(assignedSectionIdsFor(result, 102).length, 1, 'the non-spanning teacher closes the remaining section');
	assert.equal(new Set([...assignedSectionIdsFor(result, 101), ...assignedSectionIdsFor(result, 102)]).size, 2, 'both sections remain covered');
});

test('C4: a section with no shift-window authority is excluded, never fabricated', async () => {
	const t1 = faculty(101);
	const fixture = spanningFixture({ enable: true, enforce: true }, [t1]);
	fixture.gradeWindows = []; // no grade_shift_windows authority at all
	const { result } = await runAutoFill(fixture);

	assert.deepEqual(assignedSectionIdsFor(result, 101).sort((a, b) => a - b), [7001, 7003], 'no window means no span');
	assert.deepEqual(shiftRejections(result), []);
	assert.deepEqual(result.shiftCoherenceNotices ?? [], []);
});

test('C5: HARD does not flag G7+G8 (identical windows) — the span rule is load-bearing', async () => {
	const g8 = section(7002, 8, 'REGULAR');
	const t1 = faculty(101);
	const fixture = baseState({
		policy: policyRow({ enable: true, enforce: true }),
		sections: [G7, g8],
		subjects: [MATH],
		faculty: [t1],
		gradeWindows: [gradeWindow(7, '06:00', '15:30'), gradeWindow(8, '06:00', '15:30')],
	});
	const { result } = await runAutoFill(fixture);

	assert.deepEqual(assignedSectionIdsFor(result, 101).sort((a, b) => a - b), [7001, 7002], 'identical windows do not span');
	assert.deepEqual(shiftRejections(result), [], 'a blanket two-section rule would wrongly reject here');
	assert.deepEqual(result.shiftCoherenceNotices ?? [], []);
});

test('C6: an existing ownership seeds the teacher window set (HARD rejects the second shift)', async () => {
	const t1 = faculty(101);
	// T1 already owns the canonical MATH/G7 pair; the G9 pair is the only candidate row.
	const fixture = baseState({
		policy: policyRow({ enable: true, enforce: true }),
		sections: [G7, G9],
		subjects: [MATH],
		faculty: [t1],
		ownerships: [ownership(1, MATH, 7001, 101)],
		gradeWindows: WINDOWS,
	});
	const { result } = await runAutoFill(fixture);

	assert.equal(result.preserved, 1, 'the existing ownership is preserved');
	assert.equal(assignedSectionIdsFor(result, 101).length, 0, 'the seeded G7 window makes the G9 candidate span');
	assert.equal(shiftRejections(result).length, 1);
	assert.deepEqual(
		shiftRejections(result)[0].sections?.map((entry) => entry.id).sort((a, b) => a - b),
		[7001, 7003],
		'the rejection names the seeded section and the candidate section',
	);
	assert.equal(result.unresolved, 1);

	// Guard OFF reproduces base: the same teacher closes the G9 row.
	const off = await runAutoFill({ ...fixture, policies: [policyRow({ enable: false, enforce: false })] });
	assert.equal(assignedSectionIdsFor(off.result, 101).length, 1, 'guard off assigns the second shift');
	assert.equal(off.result.unresolved, 0);
});

test('C7: the guard is policy-switched through the persisted read projection (SOFT default)', async () => {
	// A policy row with no guard fields at all must behave as the SOFT default.
	const t1 = faculty(101);
	const fixture = spanningFixture({ enable: true, enforce: false }, [t1]);
	fixture.policies = [{ schoolId: SCHOOL, schoolYearId: YEAR, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }];
	const { result } = await runAutoFill(fixture);

	assert.equal(result.unresolved, 0, 'missing guard columns fall back to the SOFT default');
	assert.equal((result.shiftCoherenceNotices ?? []).length, 1);
	assert.deepEqual(shiftRejections(result), []);
});

// ─── D. Schema + migration (additive only) ──────────────────────────────────

test('D1: the two SchedulingPolicy columns exist with safe defaults', () => {
	const schema = readFileSync(resolve(here, '..', '..', '..', 'prisma', 'schema.prisma'), 'utf8');
	const start = schema.indexOf('model SchedulingPolicy {');
	assert.notEqual(start, -1, 'model present');
	const end = schema.indexOf('\n}', start);
	const block = schema.slice(start, end + 2);
	assert.match(block, /enableShiftCoherenceGuard\s+Boolean\s+@default\(true\)\s+@map\("enable_shift_coherence_guard"\)/);
	assert.match(block, /enforceShiftCoherenceGuard\s+Boolean\s+@default\(false\)\s+@map\("enforce_shift_coherence_guard"\)/);
});

test('D2: the migration is additive and never applied by this candidate', () => {
	const sql = readFileSync(
		resolve(here, '..', '..', '..', 'prisma', 'migrations', '20260925000001_shift_coherence', 'migration.sql'),
		'utf8',
	);
	assert.match(sql, /ADD COLUMN "enable_shift_coherence_guard" BOOLEAN NOT NULL DEFAULT true/);
	assert.match(sql, /ADD COLUMN "enforce_shift_coherence_guard" BOOLEAN NOT NULL DEFAULT false/);
	assert.equal(/\bDROP\b/i.test(sql), false, 'no destructive statement');
	assert.equal(/\bDELETE\b/i.test(sql), false, 'no data deletion');
	assert.equal(/UPDATE\s+"/i.test(sql), false, 'no data update');
});
