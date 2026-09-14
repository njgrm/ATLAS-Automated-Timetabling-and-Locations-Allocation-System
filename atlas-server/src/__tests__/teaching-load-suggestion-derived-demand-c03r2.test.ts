/**
 * TL-SUGGESTION-C03R2 — bind suggestions to canonical derived demand (hermetic).
 *
 * Failing-first production-path controls for the eight C03R2 defects:
 *  1. suggestion demand is the canonical `buildDerivedDemand` pair set;
 *  2. only SCHEDULED_TEACHING subjects create demand (REFERENCE_ONLY excluded);
 *  3. grade/program scope and ordered-term rotation are respected;
 *  4. the exact derived-demand revision is carried into preview and re-resolved
 *     inside the real Serializable apply transaction through the tx client;
 *  5. missing/changed term, disposition, scope, or revision authority fails
 *     closed with zero ownership/FacultySubject/cycle/audit writes;
 *  6. ownership outside canonical demand is diagnosed and excluded;
 *  7. reads are bound to the supplied client/transaction (no global read inside
 *     the apply transaction) and preview remains zero-write;
 *  8. deterministic ordering, persisted-only qualification, caps, adviser
 *     behavior, cross-department permission, and qualified zero-load Filipino /
 *     ESP visibility are preserved.
 *
 * Run with `npx tsx <this-file>`. No database is used.
 */

import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import facultyAssignmentRouter from '../routes/faculty-assignment.router.js';
import { withDataContext } from '../lib/data-context.js';
import {
	autoFill,
	previewOrApplyOverCapRebalance,
	type AutoFillResult,
	type OverCapRebalanceResult,
} from '../services/teaching-load-automation.service.js';
import {
	applyTeachingLoadSuggestionProposal,
	createTeachingLoadSuggestionProposal,
} from '../services/teaching-load-suggestion-proposal.service.js';
import { buildDerivedDemand } from '../services/derived-demand.service.js';

const now = new Date('2026-09-13T00:00:00.000Z');
const SCHOOL = 1;
const YEAR = 9;
const ACTOR = 77;

let passCount = 0;
let failCount = 0;

function heading(title: string) {
	console.log(`\n=== ${title} ===`);
}

function check(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function checkEqual(actual: unknown, expected: unknown, label: string) {
	check(
		JSON.stringify(actual) === JSON.stringify(expected),
		`${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
	);
}

type Row = Record<string, any>;

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

function yearMirror(overrides: Row = {}): Row {
	return {
		schoolId: SCHOOL,
		enrollProSchoolYearId: YEAR,
		yearLabel: '2030-2031',
		isActive: true,
		isArchived: false,
		termContractCache: termCache(),
		termContractCachedAt: now,
		...overrides,
	};
}

/** EnrollPro internal grade key: 17 -> Grade 7, 18 -> Grade 8. */
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

type SubjectOptions = {
	name?: string;
	owner?: string | null;
	minutes?: number;
	programScopes?: string[];
	gradeLevels?: number[];
	rotationFamily?: string | null;
	modularOrder?: number | null;
	disposition?: 'SCHEDULED_TEACHING' | 'REFERENCE_ONLY';
};

function subject(id: number, code: string, options: SubjectOptions = {}): Row {
	return {
		id,
		schoolId: SCHOOL,
		code,
		name: options.name ?? code,
		schedulingDisposition: options.disposition ?? 'SCHEDULED_TEACHING',
		rotationFamily: options.rotationFamily ?? null,
		gradeLevels: options.gradeLevels ?? [7],
		programScopes: options.programScopes ?? ['REGULAR'],
		minMinutesPerWeek: options.minutes ?? 240,
		modularGroupId: null,
		modularOrder: options.modularOrder ?? null,
		termGroupId: null,
		termCount: null,
		ownerDepartment: options.owner ?? null,
		requiredFeatures: [],
		allowedSpecializations: [],
		isActive: true,
	};
}

type FacultyOptions = {
	firstName?: string;
	lastName?: string;
	department?: string | null;
	specialization?: string | null;
	maxHours?: number;
	placeholder?: boolean;
	adviser?: boolean;
	advisedSectionId?: number | null;
	schoolId?: number;
};

function faculty(id: number, options: FacultyOptions = {}): Row {
	return {
		id,
		schoolId: options.schoolId ?? SCHOOL,
		externalId: 9000 + id,
		employeeId: `E${id}`,
		firstName: options.firstName ?? 'F',
		lastName: options.lastName ?? `Teacher${id}`,
		department: options.department ?? null,
		specialization: options.specialization ?? null,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: options.maxHours ?? 30,
		isPlaceholder: options.placeholder ?? false,
		isClassAdviser: options.adviser ?? false,
		advisoryEquivalentHours: 0,
		ancillaryMinutesPerWeek: null,
		advisedSectionId: options.advisedSectionId ?? null,
		isActiveForScheduling: true,
		isStale: false,
		version: 1,
	};
}

function ownership(id: number, subjectRow: Row, sectionId: number, facultyId: number, facultySubjectId: number): Row {
	return {
		id,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		subjectId: subjectRow.id,
		sectionId,
		facultyId,
		facultySubjectId,
		facultySubject: {
			assignedBy: ACTOR,
			subject: {
				id: subjectRow.id,
				code: subjectRow.code,
				modularGroupId: null,
				modularOrder: subjectRow.modularOrder ?? null,
				termGroupId: null,
				termCount: null,
				rotationFamily: subjectRow.rotationFamily ?? null,
				minMinutesPerWeek: subjectRow.minMinutesPerWeek,
			},
		},
	};
}

function baseState(overrides: Partial<Record<string, Row[]>> = {}): Row {
	return {
		yearMirrors: [yearMirror()],
		policies: [{ schoolId: SCHOOL, schoolYearId: YEAR, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
		sections: [],
		subjects: [],
		faculty: [],
		ownerships: [],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [],
		crossDepartmentPermissions: [],
		specializationAliases: [],
		...overrides,
	};
}

// ─── Shared in-memory Prisma-shaped read model ──────────────────────────────

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

function applyOrderBy(rows: Row[], orderBy: any): Row[] {
	if (!orderBy) return rows;
	const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
	return [...rows].sort((left, right) => {
		for (const clause of clauses) {
			const [field, direction] = Object.entries(clause)[0] as [string, string];
			if (left[field] === right[field]) continue;
			const comparison = left[field] < right[field] ? -1 : 1;
			return direction === 'desc' ? -comparison : comparison;
		}
		return 0;
	});
}

type ReadState = { reads: string[]; writes: string[]; transactions: number };

function buildReadModel(name: string, rows: Row[], state: ReadState): any {
	const model: any = {
		findMany: async (args: any = {}) => {
			state.reads.push(`${name}.findMany`);
			return applyOrderBy(rows.filter((row) => matchesWhere(row, args.where)), args.orderBy).map((row) => ({ ...row }));
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

async function runAutoFillExpectError(fixture: Row): Promise<{ code?: string; state: ReadState }> {
	const { client, state } = buildReadClient(fixture);
	let code: string | undefined;
	try {
		await withDataContext(client, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	} catch (error) {
		code = (error as { code?: string })?.code;
	}
	return { code, state };
}

// ─── Part 1: canonical demand binding, disposition, scope, rotation ─────────

async function testCanonicalPairFilter() {
	heading('A. Canonical derived demand is the sole pair authority');
	const math = subject(21, 'MATH', { owner: 'MATH' });
	const elective = subject(40, 'ROBOTICS', { name: 'Robotics Elective', owner: 'TLE', disposition: 'REFERENCE_ONLY' });
	const hg = subject(29, 'HG', { name: 'Homeroom Guidance', owner: 'ESP', minutes: 60, disposition: 'REFERENCE_ONLY' });
	const sections = [section(7001), section(7002)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
	// A legacy ownership for the reference-only subject that the old Cartesian
	// construction would have treated as demand.
	const ownerships = [ownership(1, elective, 7001, donor.id, 1)];

	const fixture = baseState({
		sections,
		subjects: [math, elective, hg],
		faculty: [donor, mathZero],
		ownerships,
	});

	const { result, state } = await runAutoFill(fixture);

	checkEqual(result.canonicalDemandPairCount, 2, 'only the two MATH pairs are canonical demand');
	check(
		result.derivedDemandRevision.length === 64,
		`the canonical DERIVED_DEMAND_V2 revision is carried (got ${result.derivedDemandRevision?.length})`,
	);
	check(
		(result.suggestedRows ?? []).every((row) => row.subjectCode !== 'ROBOTICS' && row.subjectCode !== 'HG'),
		'reference-only subjects create zero suggested ownership',
	);
	check(
		(result.candidateRejections ?? []).every((row) => row.subjectCode !== 'ROBOTICS' && row.subjectCode !== 'HG'),
		'reference-only subjects create zero staffing/rejection need',
	);
	checkEqual(result.outsideDemandOwnershipCount, 1, 'the reference-only ownership is diagnosed as outside demand');
	check(state.writes.length === 0, `auto-fill preview performs zero writes (${state.writes.join(', ')})`);
	check(state.transactions === 0, 'auto-fill preview opens zero transactions');

	// Mutant proof: flipping the elective to SCHEDULED_TEACHING makes the
	// canonical pair filter load-bearing; the hidden pair reappears.
	const mutantFixture = baseState({
		sections,
		subjects: [math, subject(40, 'ROBOTICS', { name: 'Robotics Elective', owner: 'TLE' }), hg],
		faculty: [donor, mathZero],
		ownerships,
	});
	const mutant = await runAutoFill(mutantFixture);
	check(
		mutant.result.canonicalDemandPairCount === 4,
		`canonical pair filter mutant exposes the hidden pairs (got ${mutant.result.canonicalDemandPairCount})`,
	);
	check(
		(mutant.result.suggestedRows ?? []).some((row) => row.subjectCode === 'ROBOTICS'),
		'canonical pair filter mutant would suggest the reference-only subject (control is load-bearing)',
	);
}

async function testGradeProgramScope() {
	heading('B. Canonical grade/program scope replaces the Cartesian product');
	const math = subject(21, 'MATH', { owner: 'MATH', gradeLevels: [8] });
	const sections = [section(7001, 7), section(8001, 8)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });

	const { result } = await runAutoFill(baseState({ sections, subjects: [math], faculty: [donor, mathZero] }));
	checkEqual(result.canonicalDemandPairCount, 1, 'a grade-8-scoped subject forms pairs only with grade-8 sections');
	check(
		(result.suggestedRows ?? []).every((row) => row.sectionId === 8001),
		'no suggestion is created for the out-of-scope grade-7 section',
	);

	// Mutant proof: widening the scope to both grades reintroduces the Cartesian
	// grade-7 pair.
	const mutant = await runAutoFill(baseState({
		sections,
		subjects: [subject(21, 'MATH', { owner: 'MATH', gradeLevels: [7, 8] })],
		faculty: [donor, mathZero],
	}));
	checkEqual(mutant.result.canonicalDemandPairCount, 2, 'scope mutant exposes the out-of-scope grade-7 pair');
}

async function testOrderedTermRotation() {
	heading('C. Ordered-term rotation does not multiply or split annual demand');
	const math = subject(21, 'MATH', { owner: 'MATH', minutes: 240 });
	const rot1 = subject(41, 'ROT_1', { owner: 'TLE', rotationFamily: 'ROT', modularOrder: 1, minutes: 240 });
	const rot2 = subject(42, 'ROT_2', { owner: 'TLE', rotationFamily: 'ROT', modularOrder: 2, minutes: 240 });
	const rot3 = subject(43, 'ROT_3', { owner: 'TLE', rotationFamily: 'ROT', modularOrder: 3, minutes: 240 });
	const sections = [section(7001)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const tle = faculty(103, { firstName: 'Tess', lastName: 'Tle', department: 'TLE' });

	const fixture = baseState({ sections, subjects: [math, rot1, rot2, rot3], faculty: [donor, tle] });
	const { client } = buildReadClient(fixture);
	const derived = await withDataContext(client, () => buildDerivedDemand(SCHOOL, YEAR));

	check(derived.ok === true, 'derived demand resolves for the ordered-term contract');
	if (!derived.ok) return;

	checkEqual(derived.totalPairs, 4, 'one ALL subject + three rotation members form four annual ownership pairs');
	checkEqual(derived.timetableLines.length, 6, 'the ALL subject runs in all three terms; each rotation member once');
	const allPair = derived.teachingLoadPairs.find((pair) => pair.subjectCode === 'MATH');
	checkEqual(allPair?.termIdentities?.length, 3, 'the year-long subject keeps all three ordered terms');
	const rotationPairs = derived.teachingLoadPairs.filter((pair) => pair.rotationFamily === 'ROT');
	check(
		rotationPairs.length === 3 && rotationPairs.every((pair) => pair.termIdentities.length === 1),
		'each rotating family member owns exactly one ordered term (no annual tripling)',
	);
	check(
		rotationPairs.every((pair) => pair.weeklyMinutes === 240 && pair.sessionsPerWeek === Math.max(1, Math.ceil(240 / derived.periodLengthMinutes))),
		'rotation members keep their own weekly load (no split across terms)',
	);

	const auto = await runAutoFill(fixture);
	checkEqual(auto.result.canonicalDemandPairCount, 4, 'suggestions consume the four canonical pairs, not twelve term lines');
}

async function testQualifiedZeroLoadVisibility() {
	heading('D. Qualified zero-load Filipino and ESP faculty remain visible');
	const fil = subject(22, 'FIL_7', { name: 'Filipino 7', owner: null });
	const esp = subject(23, 'ESP_7', { name: 'Edukasyon sa Pagpapakatao 7', owner: 'ESP' });
	const sections = [section(7001)];
	const filZero = faculty(103, { firstName: 'Fely', lastName: 'Filipino', department: 'FILIPINO' });
	const espZero = faculty(104, { firstName: 'Ernesto', lastName: 'Esp', department: 'ESP' });

	const { result } = await runAutoFill(baseState({
		sections,
		subjects: [fil, esp],
		faculty: [filZero, espZero],
		subjectOwnerPrefixes: [{ schoolId: SCHOOL, prefix: 'FIL', department: 'FIL' }],
		departmentAliases: [{ schoolId: SCHOOL, alias: 'FILIPINO', department: 'FIL' }],
	}));

	check(
		result.suggestedRows?.some((row) => row.subjectCode === 'FIL_7' && row.facultyId === filZero.id) === true,
		'zero-load Filipino candidate is visible and eligible',
	);
	check(
		result.suggestedRows?.some((row) => row.subjectCode === 'ESP_7' && row.facultyId === espZero.id) === true,
		'zero-load ESP candidate is visible and eligible',
	);
	checkEqual(result.unresolved, 0, 'both canonical pairs are covered');
}

async function testFailClosedAuthority() {
	heading('E. Missing/ambiguous term authority fails the preview closed');

	const math = subject(21, 'MATH', { owner: 'MATH' });
	const sections = [section(7001)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });

	const noTerm = await runAutoFillExpectError(baseState({
		yearMirrors: [{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: true, isArchived: false, termContractCache: null, termContractCachedAt: null }],
		sections,
		subjects: [math],
		faculty: [donor],
	}));
	checkEqual(noTerm.code, 'DERIVED_DEMAND_UNAVAILABLE', 'missing ordered-term authority fails closed with a typed blocker');
	checkEqual(noTerm.state.writes, [], 'missing term authority performs zero writes');

	const ambiguous = await runAutoFillExpectError(baseState({
		yearMirrors: [yearMirror(), yearMirror({ enrollProSchoolYearId: 10 })],
		sections,
		subjects: [math],
		faculty: [donor],
	}));
	checkEqual(ambiguous.code, 'ACTIVE_YEAR_AMBIGUOUS', 'ambiguous active year fails closed');
	checkEqual(ambiguous.state.writes, [], 'ambiguous active year performs zero writes');
}

// ─── Part 2: stateful apply path with transaction-client revalidation ───────

type ApplyState = {
	proposals: Row[];
	ownerships: Row[];
	facultySubjects: Row[];
	faculty: Row[];
	subjects: Row[];
	sections: Row[];
	policies: Row[];
	yearMirrors: Row[];
	departmentAliases: Row[];
	departmentLabels: Row[];
	subjectOwnerPrefixes: Row[];
	crossDepartmentPermissions: Row[];
	specializationAliases: Row[];
	cycles: Row[];
	audits: Row[];
	nextId: number;
};

function createApplyClient(initial: ApplyState, overrides: { txSubjectDisposition?: (row: Row) => 'SCHEDULED_TEACHING' | 'REFERENCE_ONLY' } = {}) {
	const state: ApplyState = structuredClone(initial);
	const writes: Array<{ model: string; op: string }> = [];
	/** Options every caller passed to `$transaction` (e.g. isolation level). */
	const transactionOptions: Array<Record<string, unknown> | undefined> = [];
	const record = (model: string, op: string) => { writes.push({ model, op }); };
	let nextId = 9000;
	let txOverrideActive = false;

	const hydrateOwnership = (row: Row): Row => {
		const facultySubject = state.facultySubjects.find((fs) => fs.id === row.facultySubjectId);
		const subject = facultySubject ? state.subjects.find((s) => s.id === facultySubject.subjectId) : undefined;
		return {
			...structuredClone(row),
			facultySubject: facultySubject
				? { ...structuredClone(facultySubject), subject: subject ? { id: subject.id, minMinutesPerWeek: subject.minMinutesPerWeek } : null }
				: null,
		};
	};

	const readModel = (name: string, rows: Row[]): any => ({
		findMany: async (args: any = {}) => {
			let matched = rows.filter((row) => matchesWhere(row, args.where));
			if (txOverrideActive && overrides.txSubjectDisposition && name === 'subject') {
				matched = matched.map((row) => ({ ...row, schedulingDisposition: overrides.txSubjectDisposition!(row) }));
			}
			return applyOrderBy(matched, args.orderBy).map((row) => structuredClone(row));
		},
		findFirst: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? structuredClone(found) : null;
		},
		findUnique: async (args: any = {}) => {
			const found = rows.find((row) => matchesWhere(row, args.where));
			return found ? structuredClone(found) : null;
		},
		count: async (args: any = {}) => rows.filter((row) => matchesWhere(row, args.where)).length,
	});

	const models: Record<string, any> = {
		enrollProSchoolYearMirror: readModel('enrollProSchoolYearMirror', state.yearMirrors),
		schedulingPolicy: readModel('schedulingPolicy', state.policies),
		departmentAlias: readModel('departmentAlias', state.departmentAliases),
		departmentLabel: readModel('departmentLabel', state.departmentLabels),
		subjectOwnerPrefix: readModel('subjectOwnerPrefix', state.subjectOwnerPrefixes),
		crossDepartmentPermission: readModel('crossDepartmentPermission', state.crossDepartmentPermissions),
		specializationAlias: readModel('specializationAlias', state.specializationAliases),
		subject: readModel('subject', state.subjects),
		sectionMirror: readModel('sectionMirror', state.sections),
		facultyMirror: {
			...readModel('facultyMirror', state.faculty),
			updateMany: async (args: any = {}) => {
				const rows = state.faculty.filter((row) => matchesWhere(row, args.where));
				for (const row of rows) {
					for (const [field, value] of Object.entries(args.data ?? {})) {
						if (value && typeof value === 'object' && 'increment' in (value as Row)) {
							row[field] = (row[field] ?? 0) + (value as Row).increment;
						} else {
							row[field] = structuredClone(value);
						}
					}
				}
				record('facultyMirror', 'updateMany');
				return { count: rows.length };
			},
		},
		teachingLoadSuggestionProposal: {
			...readModel('teachingLoadSuggestionProposal', state.proposals),
			create: async (args: any = {}) => {
				const row = { id: nextId++, ...structuredClone(args.data) };
				state.proposals.push(row);
				record('teachingLoadSuggestionProposal', 'create');
				return structuredClone(row);
			},
			updateMany: async (args: any = {}) => {
				const rows = state.proposals.filter((row) => matchesWhere(row, args.where));
				for (const row of rows) Object.assign(row, structuredClone(args.data));
				record('teachingLoadSuggestionProposal', 'updateMany');
				return { count: rows.length };
			},
			update: async (args: any = {}) => {
				const row = state.proposals.find((candidate) => matchesWhere(candidate, args.where));
				if (!row) throw new Error('proposal not found');
				Object.assign(row, structuredClone(args.data));
				record('teachingLoadSuggestionProposal', 'update');
				return structuredClone(row);
			},
		},
		subjectSectionOwnership: {
			findMany: async (args: any = {}) => state.ownerships.filter((row) => matchesWhere(row, args.where)).map(hydrateOwnership),
			findUnique: async (args: any = {}) => {
				const found = state.ownerships.find((row) => matchesWhere(row, args.where));
				return found ? hydrateOwnership(found) : null;
			},
			count: async (args: any = {}) => state.ownerships.filter((row) => matchesWhere(row, args.where)).length,
			createMany: async (args: any = {}) => {
				for (const data of args.data ?? []) state.ownerships.push({ id: nextId++, ...structuredClone(data) });
				record('subjectSectionOwnership', 'createMany');
				return { count: (args.data ?? []).length };
			},
			update: async (args: any = {}) => {
				const row = state.ownerships.find((candidate) => matchesWhere(candidate, args.where));
				if (!row) throw new Error('ownership not found');
				Object.assign(row, structuredClone(args.data));
				record('subjectSectionOwnership', 'update');
				return hydrateOwnership(row);
			},
		},
		facultySubject: {
			findUnique: async (args: any = {}) => {
				const found = state.facultySubjects.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			create: async (args: any = {}) => {
				const row = { id: nextId++, ...structuredClone(args.data) };
				state.facultySubjects.push(row);
				record('facultySubject', 'create');
				return structuredClone(row);
			},
			update: async (args: any = {}) => {
				const row = state.facultySubjects.find((candidate) => matchesWhere(candidate, args.where));
				if (!row) throw new Error('facultySubject not found');
				Object.assign(row, structuredClone(args.data));
				record('facultySubject', 'update');
				return structuredClone(row);
			},
			delete: async (args: any = {}) => {
				const index = state.facultySubjects.findIndex((row) => matchesWhere(row, args.where));
				if (index < 0) throw new Error('facultySubject not found');
				const [removed] = state.facultySubjects.splice(index, 1);
				record('facultySubject', 'delete');
				return structuredClone(removed);
			},
		},
		teachingLoadCycle: {
			upsert: async (args: any = {}) => {
				const compound = args.where?.schoolId_schoolYearId ?? {};
				const existing = state.cycles.find((row) => row.schoolId === compound.schoolId && row.schoolYearId === compound.schoolYearId);
				record('teachingLoadCycle', 'upsert');
				if (existing) {
					Object.assign(existing, structuredClone(args.update ?? {}));
					return structuredClone(existing);
				}
				const created = { id: nextId++, ...structuredClone(args.create) };
				state.cycles.push(created);
				return structuredClone(created);
			},
		},
		auditLog: {
			create: async (args: any = {}) => {
				const row = { id: nextId++, ...structuredClone(args.data) };
				state.audits.push(row);
				record('auditLog', 'create');
				return structuredClone(row);
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
	client.$transaction = async (callback: (tx: any) => Promise<unknown>, options?: Record<string, unknown>) => {
		transactionOptions.push(options);
		const backup = structuredClone(state);
		txOverrideActive = true;
		try {
			return await callback(client);
		} catch (error) {
			for (const key of Object.keys(state)) delete (state as any)[key];
			Object.assign(state, backup);
			throw error;
		} finally {
			txOverrideActive = false;
		}
	};
	return { client, state, writes, transactionOptions };
}

function buildApplyState(overrides: Partial<ApplyState> = {}): ApplyState {
	return {
		proposals: [],
		yearMirrors: [yearMirror()],
		policies: [{ schoolId: SCHOOL, schoolYearId: YEAR, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
		subjects: [subject(21, 'MATH', { owner: 'MATH' })],
		sections: [section(7001)],
		faculty: [
			faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' }),
			faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' }),
		],
		ownerships: [],
		facultySubjects: [],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [{ schoolId: SCHOOL, prefix: 'MATH', department: 'MATH' }],
		crossDepartmentPermissions: [],
		specializationAliases: [],
		cycles: [],
		audits: [],
		nextId: 9000,
		...overrides,
	};
}

async function testProposalApplyRealPath() {
	heading('F. Real proposal preview/apply carries and revalidates the canonical revision');

	const state = buildApplyState();
	const { client, state: live, writes } = createApplyClient(state);

	const created = await withDataContext(client, () => createTeachingLoadSuggestionProposal({
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	check(typeof created.preview.derivedDemandRevision === 'string', 'persisted preview carries the canonical revision');
	const proposalId = created.proposal.id;

	const applied = await withDataContext(client, () => applyTeachingLoadSuggestionProposal({
		proposalId,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	checkEqual(applied.proposal.status, 'APPLIED', 'a matching canonical revision applies');
	check(live.ownerships.length >= 1, 'apply persisted the canonical ownership');
	checkEqual(
		live.audits.filter((row) => row.action === 'TEACHING_LOAD_SUGGESTION_PROPOSAL_APPLIED').length,
		1,
		'exactly one durable apply audit is written',
	);
	const writesBeforeReplay = writes.length;
	const replay = await withDataContext(client, () => applyTeachingLoadSuggestionProposal({
		proposalId,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	check(replay.proposal.status === 'APPLIED' && writes.length === writesBeforeReplay, 'replay is idempotent and write-free');
}

async function testTransactionClientRevalidation() {
	heading('G. Apply re-resolves derived demand inside the tx client and fails closed');

	const state = buildApplyState();
	// The transaction view flips MATH to REFERENCE_ONLY. If apply resolved the
	// authority from the global client instead of the transaction client, the
	// revision would still match and the apply would wrongly proceed.
	const { client, state: live, writes } = createApplyClient(state, {
		txSubjectDisposition: (row) => (row.code === 'MATH' ? 'REFERENCE_ONLY' : (row.schedulingDisposition ?? 'SCHEDULED_TEACHING')),
	});

	const created = await withDataContext(client, () => createTeachingLoadSuggestionProposal({
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	const proposalId = created.proposal.id;
	const auditsBefore = live.audits.length;
	const ownershipsBefore = live.ownerships.length;
	const writesBeforeApply = writes.length;

	let code: string | undefined;
	try {
		await withDataContext(client, () => applyTeachingLoadSuggestionProposal({
			proposalId,
			actorId: ACTOR,
			actorSchoolId: SCHOOL,
		}));
	} catch (error) {
		code = (error as { code?: string })?.code;
	}

	checkEqual(code, 'TEACHING_LOAD_PROPOSAL_STALE', 'a transaction-client disposition change is rejected as stale');
	checkEqual(live.ownerships.length, ownershipsBefore, 'zero ownership writes on stale revision');
	checkEqual(live.audits.length, auditsBefore, 'zero audit writes on stale revision');
	checkEqual(live.proposals.find((row) => row.id === proposalId)?.status, 'PENDING', 'proposal remains PENDING after stale rejection');
	check(
		writes.slice(writesBeforeApply).every((entry) => entry.model !== 'facultySubject' && entry.model !== 'teachingLoadCycle' && entry.model !== 'auditLog'),
		'no FacultySubject/cycle/audit write is attempted on stale revision',
	);

	// Negative control: without the transaction override the same proposal applies,
	// proving the stale rejection is caused by the transaction-client revalidation
	// and not by an unrelated fixture defect.
	const control = createApplyClient(buildApplyState());
	const controlCreated = await withDataContext(control.client, () => createTeachingLoadSuggestionProposal({
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	const controlApplied = await withDataContext(control.client, () => applyTeachingLoadSuggestionProposal({
		proposalId: controlCreated.proposal.id,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
	}));
	checkEqual(controlApplied.proposal.status, 'APPLIED', 'positive control applies when the tx revision matches');
}

// ─── Part 2b: over-cap redistribution canonical binding ─────────────────────

async function runOverCap(fixture: Row): Promise<{ result: OverCapRebalanceResult; state: ReadState }> {
	const { client, state } = buildReadClient(fixture);
	const result = await withDataContext(client, () => previewOrApplyOverCapRebalance({
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
		previewOnly: true,
	}));
	return { result, state };
}

/**
 * A MATH teacher owns eight canonical REGULAR/grade-7 pairs plus one legacy pair
 * whose subject declares grade 8 while its SPA section is grade 7. The legacy
 * pair is out of canonical demand by grade scope, yet its section program (SPA)
 * still matches the subject scope (SPA), so the receiver remains qualified and
 * the pair would be proposed first (lowest ownership id) if unbound.
 */
function overCapFixture(outOfScopeGrades: number[]): Row {
	const math = subject(21, 'MATH', { owner: 'MATH', minutes: 240 });
	const spaMath = subject(22, 'SPA_MATH', {
		name: 'SPA Mathematics',
		owner: 'MATH',
		minutes: 240,
		programScopes: ['SPA'],
		gradeLevels: outOfScopeGrades,
	});
	const canonicalSections = Array.from({ length: 8 }, (_, index) => section(9100 + index, 7));
	const outOfScopeSection = section(9001, 7, 'SPA');
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
	const ownerships = [
		// Lowest row id so the legacy out-of-scope target would sort first if bound.
		ownership(1, spaMath, 9001, donor.id, 1),
		...canonicalSections.map((s, index) => ownership(2 + index, math, s.externalId, donor.id, 2 + index)),
	];
	return baseState({
		sections: [...canonicalSections, outOfScopeSection],
		subjects: [math, spaMath],
		faculty: [donor, mathZero],
		ownerships,
	});
}

async function testOverCapCanonicalBinding() {
	heading('E2. Over-cap redistribution is bound to canonical derived demand');
	const { result, state } = await runOverCap(overCapFixture([8]));

	checkEqual(result.derivedDemandRevision?.length, 64, 'over-cap result carries the canonical revision');
	checkEqual(result.canonicalDemandPairCount, 8, 'only the eight canonical MATH pairs are demand');
	checkEqual(result.outsideDemandOwnershipCount, 1, 'the grade-mismatched ownership is diagnosed as outside demand');
	const donorDetail = result.overCapFaculty.find((row) => row.facultyId === 101);
	check(!!donorDetail, 'the donor is over the teaching standard on canonical minutes');
	checkEqual(donorDetail?.teachingMinutes, 8 * 240, 'over-cap minutes exclude the out-of-scope ownership (1920, not 2160)');
	check(
		result.proposedMoves.every((move) => move.sectionId !== 9001),
		'the out-of-scope ownership is never a proposed move target',
	);
	checkEqual(state.writes, [], 'over-cap preview performs zero writes');

	// Mutant: making the legacy pair canonical (grade-7 scope) lets it count as
	// ordinary minutes and sort first among equal-minute move targets.
	const mutant = await runOverCap(overCapFixture([7]));
	checkEqual(mutant.result.canonicalDemandPairCount, 9, 'scope mutant exposes the ninth canonical pair');
	checkEqual(mutant.result.outsideDemandOwnershipCount, 0, 'scope mutant leaves no outside-demand ownership');
	const mutantDonor = mutant.result.overCapFaculty.find((row) => row.facultyId === 101);
	checkEqual(mutantDonor?.teachingMinutes, 9 * 240, 'scope mutant counts the formerly out-of-scope minutes');
	check(
		mutant.result.proposedMoves.some((move) => move.sectionId === 9001),
		'the canonical filter is load-bearing: without it the pair would be proposed as a move',
	);
}

async function testOverCapAbsentAuthorityMounted() {
	heading('E3. Over-cap mounted preview fails closed without canonical term authority');
	const fixture = baseState({
		yearMirrors: [{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: true, isArchived: false, termContractCache: null, termContractCachedAt: null }],
		sections: [section(9100, 7)],
		subjects: [subject(21, 'MATH', { owner: 'MATH' })],
		faculty: [faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' })],
	});
	await withMountedRouter(fixture, async (ctx) => {
		ctx.state.reads.length = 0;
		const response = await fetch(`${ctx.baseUrl}/api/v1/faculty-assignments/coverage/rebalance-over-cap`, {
			method: 'POST',
			headers: { authorization: `Bearer ${ctx.token}`, 'content-type': 'application/json' },
			body: JSON.stringify({ schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true }),
		});
		checkEqual(response.status, 409, 'missing term authority returns 409 through the mounted route');
		const body = await response.json() as { code?: string };
		checkEqual(body.code, 'DERIVED_DEMAND_UNAVAILABLE', 'mounted over-cap fails closed with the typed contract');
		checkEqual(ctx.state.writes, [], 'mounted over-cap missing authority performs zero writes');
	});
}

function buildOverCapApplyState(): ApplyState {
	const sections = Array.from({ length: 8 }, (_, index) => section(9100 + index, 7));
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const receiver = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
	return buildApplyState({
		sections,
		subjects: [subject(21, 'MATH', { owner: 'MATH' })],
		faculty: [donor, receiver],
		facultySubjects: [{
			id: 5001, facultyId: 101, subjectId: 21, schoolId: SCHOOL, schoolYearId: YEAR,
			sectionIds: sections.map((s) => s.externalId), gradeLevels: [7], assignedBy: ACTOR,
		}],
		ownerships: sections.map((s, index) => ({
			id: 100 + index, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: 21,
			sectionId: s.externalId, facultyId: 101, facultySubjectId: 5001,
		})),
	});
}

async function testOverCapApplyRevalidation() {
	heading('E4. Over-cap apply re-resolves canonical demand inside the tx client');
	const positive = createApplyClient(buildOverCapApplyState());
	const positiveResult = await withDataContext(positive.client, () => previewOrApplyOverCapRebalance({
		schoolId: SCHOOL, schoolYearId: YEAR, actorId: ACTOR, actorSchoolId: SCHOOL, previewOnly: false,
	}));
	checkEqual(positiveResult.applied, true, 'unchanged over-cap apply still applies');
	check(positiveResult.movesApplied >= 1, 'unchanged over-cap apply persisted at least one move');
	checkEqual(positive.state.audits.length, 1, 'unchanged over-cap apply writes exactly one audit');
	check(
		positive.state.ownerships.filter((row) => row.facultyId === 102).length === positiveResult.movesApplied,
		'unchanged over-cap apply reassigns exactly the proposed moves to the qualified receiver',
	);
	check(
		positive.transactionOptions.some((options) => options?.isolationLevel === 'Serializable'),
		'over-cap apply opens its transaction with isolationLevel: Serializable',
	);

	// The transaction view flips MATH to REFERENCE_ONLY. If the apply resolved the
	// authority from the global client instead of the transaction client, the
	// revision would still match and it would wrongly proceed.
	const stale = createApplyClient(buildOverCapApplyState(), {
		txSubjectDisposition: (row) => (row.code === 'MATH' ? 'REFERENCE_ONLY' : (row.schedulingDisposition ?? 'SCHEDULED_TEACHING')),
	});
	const ownershipsBefore = structuredClone(stale.state.ownerships);
	let code: string | undefined;
	try {
		await withDataContext(stale.client, () => previewOrApplyOverCapRebalance({
			schoolId: SCHOOL, schoolYearId: YEAR, actorId: ACTOR, actorSchoolId: SCHOOL, previewOnly: false,
		}));
	} catch (error) {
		code = (error as { code?: string })?.code;
	}
	checkEqual(code, 'TEACHING_LOAD_REBALANCE_STALE', 'a transaction-client canonical change is rejected as stale');
	checkEqual(JSON.stringify(stale.state.ownerships), JSON.stringify(ownershipsBefore), 'stale over-cap apply wrote zero ownership rows');
	checkEqual(stale.state.audits.length, 0, 'stale over-cap apply wrote zero audits');
	checkEqual(stale.state.cycles.length, 0, 'stale over-cap apply wrote zero cycle rows');
	check(
		stale.transactionOptions.some((options) => options?.isolationLevel === 'Serializable'),
		'stale over-cap apply transaction is also Serializable',
	);
}

// ─── Part 3: mounted routes ─────────────────────────────────────────────────

async function withMountedRouter<T>(
	fixture: Row,
	run: (ctx: { baseUrl: string; token: string; state: ReadState }) => Promise<T>,
): Promise<T> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = 'tl-suggestion-c03r2-hermetic-secret';
	const { client, state } = buildReadClient(fixture);
	let server: Server | undefined;
	try {
		return await withDataContext(client, async () => {
			const app = express();
			app.use(express.json());
			app.use('/api/v1/faculty-assignments', facultyAssignmentRouter);
			app.use((error: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
				res.status(error.statusCode ?? 500).json({ code: error.code ?? 'SERVER_ERROR', message: error.message });
			});
			server = createServer(app);
			await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
			const address = server.address();
			if (!address || typeof address === 'string') throw new Error('failed to bind ephemeral test port');
			const token = jwt.sign({ userId: ACTOR, role: 'officer', authSource: 'local', schoolId: SCHOOL }, process.env.JWT_SECRET!);
			return run({ baseUrl: `http://127.0.0.1:${address.port}`, token, state });
		});
	} finally {
		if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

async function testMountedPreviewRoute() {
	heading('H. Mounted preview route consumes canonical demand');
	const math = subject(21, 'MATH', { owner: 'MATH' });
	const elective = subject(40, 'ROBOTICS', { name: 'Robotics Elective', owner: 'TLE', disposition: 'REFERENCE_ONLY' });
	const sections = [section(7001)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });

	await withMountedRouter(baseState({ sections, subjects: [math, elective], faculty: [donor, mathZero] }), async (ctx) => {
		const response = await fetch(`${ctx.baseUrl}/api/v1/faculty-assignments/auto-fill`, {
			method: 'POST',
			headers: { authorization: `Bearer ${ctx.token}`, 'content-type': 'application/json' },
			body: JSON.stringify({ schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true }),
		});
		checkEqual(response.status, 200, 'mounted auto-fill preview returns 200');
		const body = await response.json() as AutoFillResult;
		checkEqual(body.canonicalDemandPairCount, 1, 'mounted preview reports one canonical pair');
		check(
			(body.suggestedRows ?? []).every((row) => row.subjectCode !== 'ROBOTICS'),
			'mounted preview excludes the reference-only subject',
		);
		checkEqual(ctx.state.writes, [], 'mounted preview performs zero writes');
	});

	const overCap = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const overCapSections = Array.from({ length: 8 }, (_, index) => section(9100 + index));
	const overCapState = baseState({
		sections: overCapSections,
		subjects: [math],
		faculty: [overCap, mathZero],
		ownerships: overCapSections.map((s, index) => ownership(1 + index, math, s.externalId, overCap.id, 1 + index)),
	});
	await withMountedRouter(overCapState, async (ctx) => {
		const response = await fetch(`${ctx.baseUrl}/api/v1/faculty-assignments/coverage/rebalance-over-cap`, {
			method: 'POST',
			headers: { authorization: `Bearer ${ctx.token}`, 'content-type': 'application/json' },
			body: JSON.stringify({ schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true }),
		});
		checkEqual(response.status, 200, 'mounted over-cap preview returns 200');
		const body = await response.json() as { candidateRejections?: unknown };
		check(Array.isArray(body.candidateRejections), 'mounted over-cap preview returns bounded diagnostics');
	});
}

// ─── Part 4: real apply against a disposable PostgreSQL fixture ─────────────

const WORKDIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';

function readSourceDatabaseUrl(): string | null {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	try {
		const line = readFileSync(`${WORKDIR}/.env`, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
		return line ? line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '') : null;
	} catch {
		return null;
	}
}

function psql(argumentsList: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, argumentsList, { env, stdio: 'pipe' }).toString().trim();
}

async function testDisposablePostgresApply(): Promise<void> {
	heading('I. Real apply revalidation against a disposable PostgreSQL fixture');
	const sourceUrl = readSourceDatabaseUrl();
	if (!sourceUrl || !sourceUrl.startsWith('postgres')) {
		check(true, 'disposable PostgreSQL control skipped: DATABASE_URL is not configured');
		return;
	}
	const source = new URL(sourceUrl);
	const disposableName = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_c03r2${randomBytes(4).toString('hex')}`;
	check(/^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/.test(disposableName), 'disposable database name satisfies the repository guard');
	check(source.pathname.replace(/^\//, '') !== disposableName, 'the configured database is never the target');

	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	let prisma: any = null;
	let disposableCreated = false;
	const fixtureYearId = 9_000_301;
	const actorId = 9_902_001;
	try {
		try {
			psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv);
		} catch { /* not present */ }
		psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `CREATE DATABASE ${disposableName}`], adminEnv);
		disposableCreated = true;
		execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
			env: { ...process.env, DATABASE_URL: targetUrl },
			cwd: WORKDIR,
			stdio: 'pipe',
			shell: true,
		});

		// Env MUST be set before ../lib/prisma.js captures DATABASE_URL.
		process.env.DATABASE_URL = targetUrl;
		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: targetUrl });
		await prisma.$connect();
		// The production modules capture `dbUrl` at import time (before this test
		// sets the target), so the transaction context must be the target-bound
		// client itself rather than `createTestPrismaClient()`.
		const instrumented = prisma.$extends({
			query: { $allModels: { async $allOperations({ args, query }: any) { return query(args); } } },
		});

		// Failing-first / freshness proof on the real engine. The pre-fix over-cap
		// apply passed no options, so it inherited the read-committed default; the
		// fixed path passes Serializable, which is what makes the canonical re-read
		// a true freshness boundary.
		const defaultIsolation = await prisma.$transaction(async (tx: any) => tx.$queryRawUnsafe('SHOW transaction_isolation'));
		checkEqual((defaultIsolation as any[])[0]?.transaction_isolation, 'read committed', 'default transaction isolation is read committed (pre-fix fact)');
		const serializableIsolation = await prisma.$transaction(
			async (tx: any) => tx.$queryRawUnsafe('SHOW transaction_isolation'),
			{ isolationLevel: 'Serializable' },
		);
		checkEqual((serializableIsolation as any[])[0]?.transaction_isolation, 'serializable', 'over-cap-style Serializable transaction reports serializable');

		const school = await prisma.school.create({ data: { name: 'C03R2 Disposable Fixture — SAFE TO DELETE', shortName: 'C03R2' } });
		const schoolId = school.id as number;
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId,
				enrollProSchoolYearId: fixtureYearId,
				yearLabel: '2030-2031',
				isActive: true,
				isArchived: false,
				syncStatus: 'synced',
				termContractCache: {
					schoolId,
					schoolYear: { id: fixtureYearId, yearLabel: '2030-2031' },
					format: 'TRIMESTER',
					terms: [
						{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
						{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
						{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
					],
				},
				termContractCachedAt: now,
			},
		});
		await prisma.schedulingPolicy.create({
			data: { schoolId, schoolYearId: fixtureYearId, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 },
		});
		await prisma.sectionMirror.create({
			data: {
				schoolId, schoolYearId: fixtureYearId, externalId: 9_000_301_01, name: 'C03R2 G7', gradeLevelId: 17,
				gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
				isActiveForScheduling: true, isStale: false,
			},
		});
		const math = await prisma.subject.create({
			data: {
				schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, programScopes: ['REGULAR'],
				gradeLevels: [7], ownerDepartment: 'MATH', isActive: true, schedulingDisposition: 'SCHEDULED_TEACHING',
			},
		});
		await prisma.facultyMirror.create({
			data: {
				schoolId, externalId: 9_902_001, employeeId: '9902001', firstName: 'Dana', lastName: 'Donor',
				department: 'MATH', specialization: null, canTeachOutsideDepartment: false, maxHoursPerWeek: 30,
				isPlaceholder: false, isClassAdviser: false, advisoryEquivalentHours: 0, isActiveForScheduling: true, isStale: false, version: 1,
			},
		});

		const created = await withDataContext(instrumented, () => createTeachingLoadSuggestionProposal({
			schoolId, schoolYearId: fixtureYearId, actorId, actorSchoolId: schoolId,
		}));
		check(typeof created.preview.derivedDemandRevision === 'string', 'disposable preview carries a canonical revision');
		check(created.preview.canonicalDemandPairCount === 1, `disposable canonical pair count is one (got ${created.preview.canonicalDemandPairCount})`);

		const applied = await withDataContext(instrumented, () => applyTeachingLoadSuggestionProposal({
			proposalId: created.proposal.id, actorId, actorSchoolId: schoolId,
		}));
		checkEqual(applied.proposal.status, 'APPLIED', 'disposable real apply succeeds with a matching canonical revision');
		checkEqual(await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId: fixtureYearId } }), 1, 'disposable apply persisted one ownership');

		// Stale matrix: review a proposal, then change one canonical input before
		// apply. Each case must return the typed stale contract with byte-identical
		// protected tables and zero notification/audit/ownership/FacultySubject
		// writes. The transaction re-resolution through the tx client is the gate.
		const seededTermCache = {
			schoolId,
			schoolYear: { id: fixtureYearId, yearLabel: '2030-2031' },
			format: 'TRIMESTER',
			terms: [
				{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
				{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
				{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
			],
		};
		const staleCases: Array<{ label: string; mutate: () => Promise<unknown>; revert: () => Promise<unknown> }> = [
			{
				label: 'schedulingDisposition',
				mutate: () => prisma.subject.update({ where: { id: math.id }, data: { schedulingDisposition: 'REFERENCE_ONLY' } }),
				revert: () => prisma.subject.update({ where: { id: math.id }, data: { schedulingDisposition: 'SCHEDULED_TEACHING' } }),
			},
			{
				label: 'program scope',
				mutate: () => prisma.subject.update({ where: { id: math.id }, data: { programScopes: ['SPA'] } }),
				revert: () => prisma.subject.update({ where: { id: math.id }, data: { programScopes: ['REGULAR'] } }),
			},
			{
				label: 'weekly minutes',
				mutate: () => prisma.subject.update({ where: { id: math.id }, data: { minMinutesPerWeek: 300 } }),
				revert: () => prisma.subject.update({ where: { id: math.id }, data: { minMinutesPerWeek: 240 } }),
			},
			{
				label: 'grade scope',
				mutate: () => prisma.subject.update({ where: { id: math.id }, data: { gradeLevels: [8] } }),
				revert: () => prisma.subject.update({ where: { id: math.id }, data: { gradeLevels: [7] } }),
			},
			{
				label: 'section scope',
				mutate: () => prisma.sectionMirror.create({
					data: {
						schoolId, schoolYearId: fixtureYearId, externalId: 9_000_301_02, name: 'C03R2 G7 extra', gradeLevelId: 17,
						gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR', maxCapacity: 50, enrolledCount: 50,
						isActiveForScheduling: true, isStale: false,
					},
				}),
				revert: () => prisma.sectionMirror.deleteMany({ where: { schoolId, schoolYearId: fixtureYearId, externalId: 9_000_301_02 } }),
			},
			{
				label: 'ordered term structure',
				mutate: () => prisma.enrollProSchoolYearMirror.update({
					where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: fixtureYearId } },
					data: { termContractCache: { ...seededTermCache, terms: [{ identity: 'T1', displayLabel: 'Term 1', order: 1 }, { identity: 'T2R', displayLabel: 'Term 2 renamed', order: 2 }, { identity: 'T3', displayLabel: 'Term 3', order: 3 }] } },
				}),
				revert: () => prisma.enrollProSchoolYearMirror.update({
					where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: fixtureYearId } },
					data: { termContractCache: seededTermCache },
				}),
			},
		];

		for (const staleCase of staleCases) {
			const reviewed = await withDataContext(instrumented, () => createTeachingLoadSuggestionProposal({
				schoolId, schoolYearId: fixtureYearId, actorId, actorSchoolId: schoolId,
			}));
			await staleCase.mutate();
			const before = {
				ownerships: await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId: fixtureYearId } }),
				facultySubjects: await prisma.facultySubject.count({ where: { schoolId, schoolYearId: fixtureYearId } }),
				audits: await prisma.auditLog.count({ where: { schoolId } }),
			};
			let staleCode: string | undefined;
			try {
				await withDataContext(instrumented, () => applyTeachingLoadSuggestionProposal({
					proposalId: reviewed.proposal.id, actorId, actorSchoolId: schoolId,
				}));
			} catch (error) {
				staleCode = (error as { code?: string })?.code;
			}
			checkEqual(staleCode, 'TEACHING_LOAD_PROPOSAL_STALE', `disposable ${staleCase.label} change between preview and apply is stale`);
			checkEqual(await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId: fixtureYearId } }), before.ownerships, `${staleCase.label}: zero ownership writes`);
			checkEqual(await prisma.facultySubject.count({ where: { schoolId, schoolYearId: fixtureYearId } }), before.facultySubjects, `${staleCase.label}: zero FacultySubject writes`);
			checkEqual(await prisma.auditLog.count({ where: { schoolId } }), before.audits, `${staleCase.label}: zero audit writes`);
			await staleCase.revert();
		}
	} finally {
		if (prisma) { try { await prisma.$disconnect(); } catch { /* ignore */ } }
		if (disposableCreated) {
			try {
				psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv);
				check(true, 'disposable database dropped with zero residue');
			} catch (error) {
				check(false, `disposable database cleanup failed: ${String(error)}`);
			}
		}
	}
}

async function main() {
	await testCanonicalPairFilter();
	await testGradeProgramScope();
	await testOrderedTermRotation();
	await testQualifiedZeroLoadVisibility();
	await testFailClosedAuthority();
	await testProposalApplyRealPath();
	await testTransactionClientRevalidation();
	await testOverCapCanonicalBinding();
	await testOverCapAbsentAuthorityMounted();
	await testOverCapApplyRevalidation();
	await testMountedPreviewRoute();
	await testDisposablePostgresApply();
	console.log(`\n=== TL-SUGGESTION-C03R2 canonical derived-demand binding ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exitCode = 1;
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exitCode = 2;
});
