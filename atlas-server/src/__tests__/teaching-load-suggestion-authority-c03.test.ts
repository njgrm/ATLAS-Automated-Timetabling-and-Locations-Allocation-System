/**
 * TL-SUGGESTION-C03R — suggestion authority correction (hermetic).
 *
 * This suite is fully HERMETIC and performs ZERO database access:
 *  - `withDataContext` injects an in-memory Prisma-shaped client that records
 *    every read and throws on every write;
 *  - the REAL production services (`autoFill`, `previewOrApplyOverCapRebalance`)
 *    and the REAL mounted Express router are exercised through that client.
 *
 * Coverage:
 *  1. coverage + over-cap receiver selection use the persisted-only qualification
 *     snapshot (persisted owner prefix / department alias / owner department /
 *     explicit cross-department permission), not legacy prefix/name inference;
 *  2. zero-load active faculty are ranked and accepted; zero load is not a
 *     rejection reason;
 *  3. program-scope incompatibility, hard-cap exhaustion, current-owner, and
 *     placeholder-faculty diagnostics are bounded, stable, and school-scoped;
 *  4. HG and ARAL never generate ordinary demand or teaching minutes;
 *  5. the direct auto-fill preview, staffing-needs report, and over-cap preview
 *     routes reject cross-school / historical / zero-active / ambiguous-year
 *     requests before any suggestion service work.
 *
 * Section D adds the REAL mounted-route row on the disposable PostgreSQL harness
 * (`test:server-db`): the same route runs against the REAL migrated schema with
 * persisted `grade_shift_windows`, proving the D11 shift-coherence contract
 * (SOFT named notice; HARD typed `SHIFT_COHERENCE_CONFLICT`; zero preview write).
 * It is guarded by the repository `atlas_restore_drill_*` disposable-name
 * pattern, so a direct `npx tsx` run with no disposable harness skips it and
 * never writes to a shared database.
 *
 * Run with `npx tsx <this-file>`. No DATABASE_URL is required for sections A–C.
 */

import { createServer, type Server } from 'node:http';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import facultyAssignmentRouter from '../routes/faculty-assignment.router.js';
import { prisma } from '../lib/prisma.js';
import { withDataContext } from '../lib/data-context.js';
import {
	autoFill,
	previewOrApplyOverCapRebalance,
	type AutoFillResult,
	type OverCapRebalanceResult,
	type TeachingLoadCandidateRejection,
} from '../services/teaching-load-automation.service.js';

const now = new Date('2026-09-12T00:00:00.000Z');
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

// ─── In-memory Prisma-shaped client ─────────────────────────────────────────

type Row = Record<string, any>;

const WRITE_OPS = [
	'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert',
	'delete', 'deleteMany', 'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
] as const;

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

function matchesWhere(row: Row, where: Row | undefined): boolean {
	const expanded = expandCompound(where);
	for (const [key, expected] of Object.entries(expanded)) {
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
			const leftValue = left[field];
			const rightValue = right[field];
			if (leftValue === rightValue) continue;
			const comparison = leftValue < rightValue ? -1 : 1;
			return direction === 'desc' ? -comparison : comparison;
		}
		return 0;
	});
}

type ClientState = {
	reads: string[];
	writes: string[];
	transactions: number;
};

function buildClient(fixture: Row): { client: any; state: ClientState } {
	const state: ClientState = { reads: [], writes: [], transactions: 0 };

	const readModel = (name: string, rows: Row[]): any => {
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
	};

	const client: any = {
		enrollProSchoolYearMirror: readModel('enrollProSchoolYearMirror', fixture.yearMirrors ?? []),
		sectionMirror: readModel('sectionMirror', fixture.sections ?? []),
		sectionSnapshot: {
			findUnique: async () => {
				state.reads.push('sectionSnapshot.findUnique');
				return { payload: [], fetchedAt: now };
			},
		},
		facultyMirror: readModel('facultyMirror', fixture.faculty ?? []),
		subject: readModel('subject', fixture.subjects ?? []),
		subjectSectionOwnership: readModel('subjectSectionOwnership', fixture.ownerships ?? []),
		departmentAlias: readModel('departmentAlias', fixture.departmentAliases ?? []),
		departmentLabel: readModel('departmentLabel', fixture.departmentLabels ?? []),
		subjectOwnerPrefix: readModel('subjectOwnerPrefix', fixture.subjectOwnerPrefixes ?? []),
		crossDepartmentPermission: readModel('crossDepartmentPermission', fixture.crossDepartmentPermissions ?? []),
		specializationAlias: readModel('specializationAlias', fixture.specializationAliases ?? []),
		schedulingPolicy: readModel('schedulingPolicy', fixture.policies ?? []),
		facultyGradePreference: readModel('facultyGradePreference', fixture.gradePreferences ?? []),
		gradeShiftWindow: readModel('gradeShiftWindow', fixture.gradeWindows ?? []),
		facultySubject: readModel('facultySubject', []),
		teachingLoadCycle: readModel('teachingLoadCycle', []),
		auditLog: readModel('auditLog', []),
		$transaction: async () => {
			state.transactions += 1;
			state.writes.push('$transaction');
			throw new Error('unexpected $transaction');
		},
	};

	return { client, state };
}

// ─── Fixture builders ────────────────────────────────────────────────────────

function section(externalId: number, programType = 'REGULAR', displayOrder = 7): Row {
	return {
		id: externalId,
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		externalId,
		name: `G7-${externalId}`,
		// EnrollPro internal grade key for Grade 7. The canonical derived-demand
		// authority normalizes `gradeLevelId`; `displayOrder` is presentation only.
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder,
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
	requiredFeatures?: string[];
	allowedSpecializations?: string[];
};

function subject(id: number, code: string, options: SubjectOptions = {}): Row {
	return {
		id,
		schoolId: SCHOOL,
		code,
		name: options.name ?? code,
		rotationFamily: null,
		gradeLevels: [7],
		programScopes: options.programScopes ?? ['REGULAR'],
		minMinutesPerWeek: options.minutes ?? 240,
		modularGroupId: null,
		modularOrder: null,
		termGroupId: null,
		termCount: null,
		ownerDepartment: options.owner ?? null,
		requiredFeatures: options.requiredFeatures ?? [],
		allowedSpecializations: options.allowedSpecializations ?? [],
		isActive: true,
	};
}

type FacultyOptions = {
	firstName?: string;
	lastName?: string;
	department?: string | null;
	specialization?: string | null;
	canTeachOutside?: boolean;
	maxHours?: number;
	placeholder?: boolean;
	adviser?: boolean;
	advisoryHours?: number;
	ancillary?: number | null;
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
		canTeachOutsideDepartment: options.canTeachOutside ?? false,
		maxHoursPerWeek: options.maxHours ?? 30,
		isPlaceholder: options.placeholder ?? false,
		isClassAdviser: options.adviser ?? false,
		advisoryEquivalentHours: options.advisoryHours ?? 0,
		ancillaryMinutesPerWeek: options.ancillary ?? null,
		advisedSectionId: options.advisedSectionId ?? null,
		isActiveForScheduling: true,
		isStale: false,
	};
}

function ownership(
	id: number,
	subjectRow: Row,
	sectionId: number,
	facultyId: number,
	facultySubjectId: number,
): Row {
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
				modularOrder: null,
				termGroupId: null,
				termCount: null,
				rotationFamily: null,
				minMinutesPerWeek: subjectRow.minMinutesPerWeek,
			},
		},
	};
}

function baseFixture(overrides: Partial<Row> = {}): Row {
	return {
		yearMirrors: [{
			schoolId: SCHOOL,
			enrollProSchoolYearId: YEAR,
			isActive: true,
			isArchived: false,
			// Canonical derived demand requires a persisted verified ordered-term
			// snapshot. The suggestion paths fail closed without it.
			termContractCache: {
				schoolId: SCHOOL,
				schoolYear: { id: YEAR, yearLabel: '2030-2031' },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
					{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
					{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
				],
			},
			termContractCachedAt: now,
		}],
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

function rejectionKey(row: TeachingLoadCandidateRejection): string {
	return `${row.subjectId}:${row.sectionId}:${row.facultyId}:${row.reason}`;
}

async function runAutoFill(fixture: Row): Promise<{ result: AutoFillResult; state: ClientState }> {
	const { client, state } = buildClient(fixture);
	const result = await withDataContext(client, () => autoFill(SCHOOL, YEAR, undefined, { previewOnly: true }));
	return { result, state };
}

async function runOverCap(fixture: Row): Promise<{ result: OverCapRebalanceResult; state: ClientState }> {
	const { client, state } = buildClient(fixture);
	const result = await withDataContext(client, () => previewOrApplyOverCapRebalance({
		schoolId: SCHOOL,
		schoolYearId: YEAR,
		actorId: ACTOR,
		actorSchoolId: SCHOOL,
		previewOnly: true,
	}));
	return { result, state };
}

// ─── Mounted router harness ─────────────────────────────────────────────────

async function withMountedRouter<T>(
	fixture: Row,
	run: (ctx: { baseUrl: string; token: string; state: ClientState }) => Promise<T>,
	tokenSchoolId = SCHOOL,
): Promise<T> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = 'tl-suggestion-c03-hermetic-secret';
	const { client, state } = buildClient(fixture);
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
			const token = jwt.sign(
				{ userId: ACTOR, role: 'officer', authSource: 'local', schoolId: tokenSchoolId },
				process.env.JWT_SECRET!,
			);
			return run({ baseUrl: `http://127.0.0.1:${address.port}`, token, state });
		});
	} finally {
		if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

async function post(baseUrl: string, token: string, path: string, body: unknown) {
	return fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function suggestionModelReads(state: ClientState): string[] {
	return state.reads.filter((entry) =>
		entry.startsWith('facultyMirror.')
		|| entry.startsWith('subject.')
		|| entry.startsWith('subjectSectionOwnership.')
		|| entry.startsWith('departmentAlias.')
		|| entry.startsWith('subjectOwnerPrefix.')
		|| entry.startsWith('crossDepartmentPermission.')
		|| entry.startsWith('specializationAlias.')
		|| entry.startsWith('schedulingPolicy.'),
	);
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

async function testCoveragePersistedAuthority() {
	heading('A. Coverage uses persisted-only authority and ranks zero-load faculty');
	const math = subject(21, 'MATH', { owner: 'MATH' });
	const fil = subject(22, 'FIL_7', { name: 'Filipino 7', owner: null });
	const esp = subject(23, 'ESP_7', { name: 'Edukasyon sa Pagpapakatao 7', owner: 'ESP' });
	const engLegacy = subject(24, 'ENG_LEGACY', { name: 'English Legacy', owner: null });
	const reading = subject(25, 'DEVL_READING', { name: 'Developmental Reading', owner: null });
	const hg = subject(29, 'HG', { name: 'Homeroom Guidance', owner: 'ESP', minutes: 0 });
	const aral = subject(30, 'ARAL', { name: 'ARAL Program', owner: 'AP' });

	const sections = [section(7001), section(7002), section(7003), section(7004), section(7200), section(7201)];
	const donor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
	const receivers = [
		faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' }),
		faculty(103, { firstName: 'Fely', lastName: 'Filipino', department: 'FILIPINO' }),
		faculty(104, { firstName: 'Ernesto', lastName: 'Esp', department: 'ESP' }),
		faculty(105, { firstName: 'Elena', lastName: 'English', department: 'ENG' }),
	];
	const otherSchool = faculty(201, { firstName: 'Other', lastName: 'School', department: 'MATH', schoolId: 2 });

	const ownerships = [
		ownership(1, hg, 7200, donor.id, 1),
		ownership(2, aral, 7201, donor.id, 2),
	];

	const fixture = baseFixture({
		sections,
		subjects: [math, fil, esp, engLegacy, reading, hg, aral],
		faculty: [donor, ...receivers, otherSchool],
		ownerships,
		subjectOwnerPrefixes: [{ schoolId: SCHOOL, prefix: 'FIL', department: 'FIL' }],
		departmentAliases: [{ schoolId: SCHOOL, alias: 'FILIPINO', department: 'FIL' }],
	});

	const { result, state } = await runAutoFill(fixture);

	check(
		result.suggestedRows?.some((row) => row.subjectCode === 'FIL_7' && row.facultyId === 103) === true,
		'zero-load Filipino candidate accepted through persisted alias + owner prefix',
	);
	check(
		result.suggestedRows?.some((row) => row.subjectCode === 'ESP_7' && row.facultyId === 104) === true,
		'zero-load ESP candidate accepted through persisted owner department',
	);
	check(
		result.candidateRejections?.some(
			(row) => row.subjectCode === 'ENG_LEGACY' && row.facultyId === 105 && row.reason === 'NOT_QUALIFIED',
		) === true,
		'legacy-prefix mutant rejected when no persisted authority grants eligibility',
	);
	check(
		result.candidateRejections?.some(
			(row) => row.subjectCode === 'DEVL_READING' && row.facultyId === 105 && row.reason === 'NOT_QUALIFIED',
		) === true,
		'legacy reading/glossary inference rejected under persisted-only authority',
	);
	check(
		result.candidateRejections?.some(
			(row) => row.subjectCode === 'FIL_7' && row.facultyId === 105 && row.reason === 'NOT_QUALIFIED',
		) === true,
		'legacy cross-language exception is disabled under persisted-only authority',
	);
	check(
		(result.candidateRejections ?? []).every((row) => !(row.subjectCode === 'FIL_7' && row.facultyId === 103))
		&& (result.candidateRejections ?? []).every((row) => !(row.subjectCode === 'ESP_7' && row.facultyId === 104)),
		'accepted zero-load faculty are not reported as rejections for the subject they cover',
	);
	check(result.unresolved === 12, `only the ENG_LEGACY and DEVL_READING pairs remain unresolved (got ${result.unresolved})`);
	check(
		(result.suggestedRows ?? []).every((row) => row.subjectCode !== 'HG' && row.subjectCode !== 'ARAL')
		&& (result.candidateRejections ?? []).every((row) => row.subjectCode !== 'HG' && row.subjectCode !== 'ARAL'),
		'HG and ARAL contribute no ordinary demand or rejections',
	);
	check(
		(result.candidateRejections ?? []).every((row) => row.facultyId !== 201)
		&& (result.suggestedRows ?? []).every((row) => row.facultyId !== 201),
		'other-school faculty never leak into diagnostics or assignments',
	);
	check(Array.isArray(result.distribution?.candidateRejections), 'distribution plan carries bounded candidate diagnostics');
	check(state.writes.length === 0, `auto-fill preview performed zero writes (${state.writes.join(', ')})`);
	check(state.transactions === 0, 'auto-fill preview opened zero transactions');

	// Determinism: identical inputs produce identical bounded diagnostics.
	const second = await runAutoFill(fixture);
	check(
		JSON.stringify((result.candidateRejections ?? []).map(rejectionKey).sort())
			=== JSON.stringify((second.result.candidateRejections ?? []).map(rejectionKey).sort()),
		'coverage diagnostics are deterministic across identical previews',
	);
	check(
		JSON.stringify((result.distribution?.candidateRejections ?? []).map(rejectionKey).sort())
			=== JSON.stringify((second.result.distribution?.candidateRejections ?? []).map(rejectionKey).sort()),
		'over-cap diagnostics embedded in the plan are deterministic',
	);

	// Positive control: granting persisted ENG owner prefix authority accepts the
	// same candidate the legacy mutant rejected.
	const grantedFixture = baseFixture({
		sections,
		subjects: [math, fil, esp, engLegacy, reading, hg, aral],
		faculty: [donor, ...receivers, otherSchool],
		ownerships,
		subjectOwnerPrefixes: [
			{ schoolId: SCHOOL, prefix: 'FIL', department: 'FIL' },
			{ schoolId: SCHOOL, prefix: 'ENG', department: 'ENG' },
		],
		departmentAliases: [{ schoolId: SCHOOL, alias: 'FILIPINO', department: 'FIL' }],
	});
	const granted = await runAutoFill(grantedFixture);
	check(
		granted.result.suggestedRows?.some((row) => row.subjectCode === 'ENG_LEGACY' && row.facultyId === 105) === true,
		'persisted ENG owner prefix authority accepts the candidate (positive control)',
	);
}

async function testOverCapDiagnostics() {
	heading('B. Over-cap receiver diagnostics use persisted authority and classify every rejection');

	// B1. Program-scope incompatibility even when the department matches.
	{
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const spa = subject(40, 'SPA_SPEC', { owner: 'MAPEH', programScopes: ['SPA'], minutes: 240 });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
		const spaTeacher = faculty(108, { firstName: 'Sofia', lastName: 'Spa', department: 'MAPEH' });
		const sections = [section(9001), ...Array.from({ length: 8 }, (_, index) => section(9100 + index))];
		const ownerships = [
			ownership(1, spa, 9001, doctor.id, 1),
			...Array.from({ length: 8 }, (_, index) => ownership(10 + index, math, 9100 + index, doctor.id, 10 + index)),
		];
		const { result } = await runOverCap(baseFixture({
			sections, subjects: [math, spa], faculty: [doctor, mathZero, spaTeacher], ownerships,
		}));
		check(
			(result.candidateRejections ?? []).some((row) => row.sectionId === 9001 && row.reason === 'PROGRAM_SCOPE_INCOMPATIBLE') === true,
			'program-scope incompatibility is reported even when the department matches',
		);
	}

	// B2. Hard-cap exhaustion: the only qualified receiver has no spare minutes.
	{
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const mathNear = faculty(102, { firstName: 'Near', lastName: 'Cap', department: 'MATH' });
		const sections = Array.from({ length: 8 }, (_, index) => section(9200 + index));
		const ownerships = [
			...Array.from({ length: 8 }, (_, index) => ownership(1 + index, math, 9200 + index, doctor.id, 1 + index)),
			...Array.from({ length: 7 }, (_, index) => ownership(20 + index, math, 9300 + index, mathNear.id, 20 + index)),
		];
		sections.push(...Array.from({ length: 7 }, (_, index) => section(9300 + index)));
		const { result } = await runOverCap(baseFixture({
			sections, subjects: [math], faculty: [doctor, mathNear], ownerships,
		}));
		check(
			(result.candidateRejections ?? []).some((row) => row.facultyId === mathNear.id && row.reason === 'HARD_CAP_EXCEEDED') === true,
			'receiver exceeding the effective teaching cap is rejected as HARD_CAP_EXCEEDED',
		);
	}

	// B3. Cross-department permission: absence rejects, grant accepts.
	{
		const noCross = subject(41, 'MATHSCI', { owner: 'MATH' });
		const withCross = subject(42, 'MATHSCI2', { owner: 'MATH' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const sciNoPerm = faculty(106, { firstName: 'Nestor', lastName: 'NoPerm', department: 'SCI' });
		const sciPerm = faculty(107, { firstName: 'Percy', lastName: 'Perm', department: 'SCI' });
		const sections = Array.from({ length: 8 }, (_, index) => section(9400 + index));
		const absentOwnerships = Array.from({ length: 8 }, (_, index) => ownership(1 + index, noCross, 9400 + index, doctor.id, 1 + index));
		const absent = await runOverCap(baseFixture({
			sections, subjects: [noCross], faculty: [doctor, sciNoPerm], ownerships: absentOwnerships,
		}));
		check(
			(absent.result.candidateRejections ?? []).some(
				(row) => row.facultyId === sciNoPerm.id && row.reason === 'NOT_QUALIFIED',
			) === true,
			'cross-department absence is rejected as NOT_QUALIFIED',
		);

		const grantedOwnerships = Array.from({ length: 8 }, (_, index) => ownership(1 + index, withCross, 9400 + index, doctor.id, 1 + index));
		const granted = await runOverCap(baseFixture({
			sections,
			subjects: [withCross],
			faculty: [doctor, sciPerm],
			ownerships: grantedOwnerships,
			crossDepartmentPermissions: [{ schoolId: SCHOOL, facultyId: sciPerm.id, subjectId: withCross.id }],
		}));
		check(
			granted.result.proposedMoves.length > 0
			&& granted.result.proposedMoves.every((move) => move.toFacultyId === sciPerm.id && move.toQualificationAuthority === 'CROSS_DEPARTMENT_PERMISSION'),
			'explicit cross-department permission accepts the receiver with CROSS_DEPARTMENT_PERMISSION authority',
		);
	}

	// B4. Adviser-own-section preference within the same qualification tier.
	{
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const noReceiver = subject(50, 'ZZZ_ONLY', { owner: 'ZZZ' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const adviser = faculty(107, { firstName: 'Ada', lastName: 'Adviser', department: 'MATH', adviser: true, advisedSectionId: 9500 });
		const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
		const sections = [section(9500), ...Array.from({ length: 8 }, (_, index) => section(9501 + index))];
		const ownerships = [
			ownership(1, math, 9500, doctor.id, 1),
			...Array.from({ length: 8 }, (_, index) => ownership(10 + index, noReceiver, 9501 + index, doctor.id, 10 + index)),
		];
		const { result } = await runOverCap(baseFixture({
			sections, subjects: [math, noReceiver], faculty: [doctor, adviser, mathZero], ownerships,
		}));
		const move = result.proposedMoves.find((candidate) => candidate.sectionId === 9500);
		check(
			move?.toFacultyId === adviser.id,
			`adviser with no real subject for the advised section wins the tie (got ${move?.toFacultyId})`,
		);
	}

	// B5. Deterministic ordering for equal candidates.
	{
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const low = faculty(102, { firstName: 'Low', lastName: 'Id', department: 'MATH' });
		const high = faculty(110, { firstName: 'High', lastName: 'Id', department: 'MATH' });
		const sections = Array.from({ length: 8 }, (_, index) => section(9600 + index));
		const ownerships = Array.from({ length: 8 }, (_, index) => ownership(1 + index, math, 9600 + index, doctor.id, 1 + index));
		const fixture = baseFixture({ sections, subjects: [math], faculty: [doctor, high, low], ownerships });
		const first = await runOverCap(fixture);
		const second = await runOverCap(fixture);
		check(
			first.result.proposedMoves.every((move) => move.toFacultyId === low.id),
			'equal candidates resolve deterministically to the lower faculty id',
		);
		checkEqual(
			first.result.proposedMoves.map((move) => `${move.ownershipId}:${move.toFacultyId}`),
			second.result.proposedMoves.map((move) => `${move.ownershipId}:${move.toFacultyId}`),
			'over-cap moves are stable across identical previews',
		);
	}

	// B6. Current-owner and placeholder diagnostics; advisory credit is neutral.
	{
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH', ancillary: 600 });
		const placeholder = faculty(109, { firstName: 'Temp', lastName: 'Placeholder', department: 'MATH', placeholder: true });
		const otherSchool = faculty(201, { firstName: 'Other', lastName: 'School', department: 'MATH', schoolId: 2 });
		const sections = Array.from({ length: 8 }, (_, index) => section(9700 + index));
		const ownerships = Array.from({ length: 8 }, (_, index) => ownership(1 + index, math, 9700 + index, doctor.id, 1 + index));
		const { result } = await runOverCap(baseFixture({
			sections, subjects: [math], faculty: [doctor, placeholder, otherSchool], ownerships,
		}));
		check(
			(result.candidateRejections ?? []).some((row) => row.facultyId === doctor.id && row.reason === 'CURRENT_OWNER') === true,
			'current owner is reported as CURRENT_OWNER (not a receiver)',
		);
		check(
			(result.candidateRejections ?? []).some((row) => row.facultyId === placeholder.id && row.reason === 'PLACEHOLDER_FACULTY') === true,
			'placeholder faculty is reported as PLACEHOLDER_FACULTY',
		);
		check(
			(result.candidateRejections ?? []).every((row) => row.facultyId !== otherSchool.id),
			'other-school faculty never leak into diagnostics',
		);
		check(
			(result.candidateRejections ?? []).length <= 100,
			`candidate diagnostics are bounded (got ${(result.candidateRejections ?? []).length})`,
		);
	}
}

async function testMountedRouteAuthority() {
	heading('C. Mounted routes reject unauthorized scope before suggestion service work');

	const validFixture = () => {
		const math = subject(21, 'MATH', { owner: 'MATH' });
		const doctor = faculty(101, { firstName: 'Dana', lastName: 'Donor', department: 'MATH' });
		const mathZero = faculty(102, { firstName: 'Mila', lastName: 'Math', department: 'MATH' });
		const sections = Array.from({ length: 8 }, (_, index) => section(9800 + index));
		const ownerships = Array.from({ length: 8 }, (_, index) => ownership(1 + index, math, 9800 + index, doctor.id, 1 + index));
		return baseFixture({ sections, subjects: [math], faculty: [doctor, mathZero], ownerships });
	};

	const expectEarlyRejection = async (
		label: string,
		path: string,
		body: Record<string, unknown>,
		expectedCode: string,
		tokenSchoolId = SCHOOL,
	) => {
		await withMountedRouter(validFixture(), async (ctx) => {
			ctx.state.reads.length = 0;
			const response = await post(ctx.baseUrl, ctx.token, path, body);
			const payload = await response.json() as { code?: string };
			check(response.status === 409 || response.status === 403 || response.status === 404, `${label}: typed rejection status (got ${response.status})`);
			checkEqual(payload.code, expectedCode, `${label}: typed error code`);
			checkEqual(suggestionModelReads(ctx.state), [], `${label}: zero suggestion-service dispatch`);
			check(ctx.state.writes.length === 0, `${label}: zero writes`);
		}, tokenSchoolId);
	};

	await expectEarlyRejection('cross-school auto-fill', '/api/v1/faculty-assignments/auto-fill', { schoolId: 2, schoolYearId: YEAR }, 'SCHOOL_MISMATCH');
	await expectEarlyRejection('cross-school staffing report', '/api/v1/faculty-assignments/report/staffing-needs', { schoolId: 2, schoolYearId: YEAR }, 'SCHOOL_MISMATCH');
	await expectEarlyRejection('cross-school over-cap preview', '/api/v1/faculty-assignments/coverage/rebalance-over-cap', { schoolId: 2, schoolYearId: YEAR, previewOnly: true }, 'SCHOOL_MISMATCH');

	const historicalFixture = () => baseFixture({
		yearMirrors: [
			{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: false, isArchived: false },
			{ schoolId: SCHOOL, enrollProSchoolYearId: 10, isActive: true, isArchived: false },
		],
	});
	const unavailableFixture = () => baseFixture({
		yearMirrors: [{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: false, isArchived: false }],
	});
	const ambiguousFixture = () => baseFixture({
		yearMirrors: [
			{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: true, isArchived: false },
			{ schoolId: SCHOOL, enrollProSchoolYearId: 10, isActive: true, isArchived: false },
		],
	});

	const expectFixtureRejection = async (
		label: string,
		fixture: Row,
		path: string,
		body: Record<string, unknown>,
		expectedCode: string,
	) => {
		await withMountedRouter(fixture, async (ctx) => {
			ctx.state.reads.length = 0;
			const response = await post(ctx.baseUrl, ctx.token, path, body);
			const payload = await response.json() as { code?: string };
			checkEqual(payload.code, expectedCode, `${label}: typed error code`);
			checkEqual(suggestionModelReads(ctx.state), [], `${label}: zero suggestion-service dispatch`);
			checkEqual(ctx.state.writes, [], `${label}: zero writes`);
		});
	};

	await expectFixtureRejection('historical auto-fill', historicalFixture(), '/api/v1/faculty-assignments/auto-fill', { schoolId: SCHOOL, schoolYearId: YEAR }, 'INACTIVE_HISTORICAL_YEAR');
	await expectFixtureRejection('zero-active auto-fill', unavailableFixture(), '/api/v1/faculty-assignments/auto-fill', { schoolId: SCHOOL, schoolYearId: YEAR }, 'ACTIVE_YEAR_UNAVAILABLE');
	await expectFixtureRejection('ambiguous auto-fill', ambiguousFixture(), '/api/v1/faculty-assignments/auto-fill', { schoolId: SCHOOL, schoolYearId: YEAR }, 'ACTIVE_YEAR_AMBIGUOUS');
	await expectFixtureRejection('historical over-cap preview', historicalFixture(), '/api/v1/faculty-assignments/coverage/rebalance-over-cap', { schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true }, 'INACTIVE_HISTORICAL_YEAR');
	await expectFixtureRejection('ambiguous staffing report', ambiguousFixture(), '/api/v1/faculty-assignments/report/staffing-needs', { schoolId: SCHOOL, schoolYearId: YEAR }, 'ACTIVE_YEAR_AMBIGUOUS');

	// Direct non-preview auto-fill stays retired after authority checks.
	await withMountedRouter(validFixture(), async (ctx) => {
		ctx.state.reads.length = 0;
		const response = await post(ctx.baseUrl, ctx.token, '/api/v1/faculty-assignments/auto-fill', { schoolId: SCHOOL, schoolYearId: YEAR });
		const payload = await response.json() as { code?: string };
		checkEqual(response.status, 409, 'direct non-preview auto-fill returns 409');
		checkEqual(payload.code, 'TEACHING_LOAD_PROPOSAL_REQUIRED', 'direct non-preview auto-fill is retired');
		checkEqual(suggestionModelReads(ctx.state), [], 'retired apply does not dispatch suggestion service reads');
		checkEqual(ctx.state.writes, [], 'retired apply performs zero writes');
	});

	// Positive: the same authority admits a same-school, active-year preview and
	// returns the bounded diagnostics contract through the mounted route.
	await withMountedRouter(validFixture(), async (ctx) => {
		const autoFillResponse = await post(ctx.baseUrl, ctx.token, '/api/v1/faculty-assignments/auto-fill', { schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true });
		checkEqual(autoFillResponse.status, 200, 'same-school auto-fill preview returns 200');
		const autoFillBody = await autoFillResponse.json() as { candidateRejections?: unknown; distribution?: { candidateRejections?: unknown } };
		check(Array.isArray(autoFillBody.candidateRejections), 'mounted auto-fill returns candidateRejections');
		check(Array.isArray(autoFillBody.distribution?.candidateRejections), 'mounted auto-fill distribution carries candidateRejections');

		const overCapResponse = await post(ctx.baseUrl, ctx.token, '/api/v1/faculty-assignments/coverage/rebalance-over-cap', { schoolId: SCHOOL, schoolYearId: YEAR, previewOnly: true });
		checkEqual(overCapResponse.status, 200, 'same-school over-cap preview returns 200');
		const overCapBody = await overCapResponse.json() as { candidateRejections?: unknown };
		check(Array.isArray(overCapBody.candidateRejections), 'mounted over-cap preview returns candidateRejections');

		const staffingResponse = await post(ctx.baseUrl, ctx.token, '/api/v1/faculty-assignments/report/staffing-needs', { schoolId: SCHOOL, schoolYearId: YEAR });
		checkEqual(staffingResponse.status, 200, 'same-school staffing report returns 200');
		const staffingBody = await staffingResponse.json() as { candidateRejections?: unknown };
		check(Array.isArray(staffingBody.candidateRejections), 'mounted staffing report returns candidateRejections');
	});
}

// ─── D. Real mounted route on disposable PostgreSQL (D11) ───────────────────
//
// Sections A–C inject an in-memory client. This row proves the same contract
// through the REAL Express route against the REAL migrated PostgreSQL schema
// (the runner's per-file disposable database). It is guarded by the repository
// disposable-name pattern, so a direct `npx tsx` run with no disposable harness
// skips it and never writes to a shared database.

function disposableDatabaseName(): string | null {
	const url = process.env.DATABASE_URL;
	if (!url) return null;
	try {
		const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
		return /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/.test(name) ? name : null;
	} catch {
		return null;
	}
}

async function mountRealRouter<T>(
	schoolId: number,
	run: (ctx: { baseUrl: string; token: string }) => Promise<T>,
): Promise<T> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = 'tl-suggestion-c03-postgres-secret';
	let server: Server | undefined;
	try {
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
		const token = jwt.sign(
			{ userId: ACTOR, role: 'officer', authSource: 'local', schoolId },
			process.env.JWT_SECRET!,
		);
		return await run({ baseUrl: `http://127.0.0.1:${address.port}`, token });
	} finally {
		if (server) await new Promise<void>((resolve, reject) => server!.close((error) => (error ? reject(error) : resolve())));
		if (previousSecret === undefined) delete process.env.JWT_SECRET;
		else process.env.JWT_SECRET = previousSecret;
	}
}

async function testMountedRouteShiftCoherencePostgres() {
	heading('D. Mounted auto-fill on disposable PostgreSQL — D11 shift coherence');
	const database = disposableDatabaseName();
	if (!database) {
		console.log('[SKIP] EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE) — no atlas_restore_drill_* DATABASE_URL');
		return;
	}

	const schoolYearId = 9_800_001;
	const school = await prisma.school.create({
		data: { name: 'S8-SHIFT-COHERENCE-DISPOSABLE — SAFE TO DELETE', shortName: 'S8SHIFT' },
		select: { id: true },
	});
	const schoolId = school.id as number;

	try {
		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId,
				enrollProSchoolYearId: schoolYearId,
				yearLabel: '2030-2031',
				isActive: true,
				isArchived: false,
				termContractCache: {
					schoolId,
					schoolYear: { id: schoolYearId, yearLabel: '2030-2031' },
					format: 'TRIMESTER',
					terms: [
						{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
						{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
						{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
					],
				},
				termContractCachedAt: new Date(),
			},
		});
		await prisma.schedulingPolicy.create({
			data: {
				schoolId,
				schoolYearId,
				periodLengthMinutes: 45,
				periodsPerDay: 10,
				earliestStartTime: '06:00',
				latestEndTime: '18:30',
				teachingStandardMinutes: 1800,
				advisoryCreditMinutes: 300,
				hardCapMinutes: 2400,
				enableShiftCoherenceGuard: true,
				enforceShiftCoherenceGuard: false,
			},
		});
		await prisma.subject.create({
			data: {
				schoolId,
				code: 'MATH',
				name: 'Mathematics',
				ownerDepartment: 'MATH',
				minMinutesPerWeek: 240,
				gradeLevels: [7, 9],
				programScopes: ['REGULAR'],
				isActive: true,
			},
		});
		await prisma.sectionMirror.createMany({
			data: [
				{ externalId: 7001, schoolId, schoolYearId, name: 'G7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 45, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
				{ externalId: 7003, schoolId, schoolYearId, name: 'G9-A', gradeLevelId: 19, gradeLevelName: 'Grade 9', displayOrder: 9, maxCapacity: 50, enrolledCount: 45, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			],
		});
		const teacher = await prisma.facultyMirror.create({
			data: {
				externalId: 8001,
				schoolId,
				firstName: 'S8',
				lastName: 'Span',
				department: 'MATH',
				maxHoursPerWeek: 30,
				isActiveForScheduling: true,
				isStale: false,
			},
			select: { id: true },
		});
		await prisma.gradeShiftWindow.createMany({
			data: [
				{ schoolId, schoolYearId, gradeLevel: 7, programType: null, startTime: '06:00', endTime: '15:30' },
				{ schoolId, schoolYearId, gradeLevel: 8, programType: null, startTime: '06:00', endTime: '15:30' },
				{ schoolId, schoolYearId, gradeLevel: 9, programType: null, startTime: '09:45', endTime: '18:30' },
				{ schoolId, schoolYearId, gradeLevel: 10, programType: null, startTime: '09:45', endTime: '18:30' },
			],
		});

		const writeCounts = async () => ({
			ownerships: await prisma.subjectSectionOwnership.count({ where: { schoolId } }),
			facultySubjects: await prisma.facultySubject.count({ where: { schoolId } }),
			cycles: await prisma.teachingLoadCycle.count({ where: { schoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId } }),
		});

		await mountRealRouter(schoolId, async ({ baseUrl, token }) => {
			// SOFT (default): the assignment proceeds and a named notice is emitted.
			const beforeSoft = await writeCounts();
			const softResponse = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId, schoolYearId, previewOnly: true });
			checkEqual(softResponse.status, 200, 'PostgreSQL SOFT preview returns 200');
			const softBody = await softResponse.json() as {
				shiftCoherenceNotices?: Array<{ facultyId: number; spanningWindows?: unknown[]; sections?: unknown[] }>;
				warnings?: string[];
				suggestedRows?: Array<{ facultyId: number | null; sectionId: number; assignmentType: string }>;
				unresolved?: number;
			};
			check(Array.isArray(softBody.shiftCoherenceNotices) && softBody.shiftCoherenceNotices.length === 1, 'PostgreSQL SOFT preview emits exactly one named shiftCoherenceNotice');
			checkEqual(softBody.shiftCoherenceNotices?.[0]?.facultyId, teacher.id, 'the SOFT notice names the spanning teacher');
			checkEqual(softBody.shiftCoherenceNotices?.[0]?.spanningWindows?.length, 2, 'the SOFT notice names both spanning windows');
			checkEqual(softBody.shiftCoherenceNotices?.[0]?.sections?.length, 2, 'the SOFT notice names both responsible sections');
			check((softBody.warnings ?? []).some((line) => line.includes('Shift coherence (SOFT)')), 'the SOFT preview emits a human warnings line');
			check(
				(softBody.suggestedRows ?? []).filter((row) => row.assignmentType === 'REAL_TEACHER' && row.facultyId === teacher.id).map((row) => row.sectionId).sort().join(',') === '7001,7003',
				'the SOFT preview still assigns the teacher to both shift windows',
			);
			checkEqual(softBody.unresolved, 0, 'SOFT coverage is unchanged');
			checkEqual(await writeCounts(), beforeSoft, 'the SOFT preview performs zero writes');

			// HARD: the spanning assignment is prevented with the typed reason.
			await prisma.schedulingPolicy.update({
				where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
				data: { enforceShiftCoherenceGuard: true },
			});
			const beforeHard = await writeCounts();
			const hardResponse = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId, schoolYearId, previewOnly: true });
			checkEqual(hardResponse.status, 200, 'PostgreSQL HARD preview returns 200 (no thrown error)');
			const hardBody = await hardResponse.json() as {
				candidateRejections?: Array<{ facultyId: number; reason: string; spanningWindows?: unknown[]; sections?: unknown[] }>;
				suggestedRows?: Array<{ facultyId: number | null; sectionId: number; assignmentType: string }>;
				unresolved?: number;
			};
			const shiftRejections = (hardBody.candidateRejections ?? []).filter((row) => row.reason === 'SHIFT_COHERENCE_CONFLICT');
			checkEqual(shiftRejections.length, 1, 'the HARD preview reports exactly one typed SHIFT_COHERENCE_CONFLICT');
			checkEqual(shiftRejections[0]?.facultyId, teacher.id, 'the typed rejection names the spanning teacher');
			checkEqual(shiftRejections[0]?.spanningWindows?.length, 2, 'the typed rejection carries both spanning windows');
			checkEqual(shiftRejections[0]?.sections?.length, 2, 'the typed rejection carries both responsible sections');
			checkEqual(hardBody.unresolved, 1, 'the spanning row is left unresolved, never thrown');
			check(
				(hardBody.suggestedRows ?? []).filter((row) => row.assignmentType === 'REAL_TEACHER' && row.facultyId === teacher.id).length === 1,
				'the HARD preview prevents assigning the teacher into both shift windows',
			);
			checkEqual(await writeCounts(), beforeHard, 'the HARD preview performs zero writes');
		});
	} finally {
		await prisma.gradeShiftWindow.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.facultySubject.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.facultyMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.sectionMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.schedulingPolicy.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
		await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => undefined);
		await prisma.$disconnect().catch(() => undefined);
	}
}

async function main() {
	await testCoveragePersistedAuthority();
	await testOverCapDiagnostics();
	await testMountedRouteAuthority();
	await testMountedRouteShiftCoherencePostgres();
	console.log(`\n=== TL-SUGGESTION-C03R hermetic suggestion authority ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exitCode = 1;
}

main().catch((error) => {
	console.error('[FATAL]', error);
	process.exitCode = 2;
});
