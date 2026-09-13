/**
 * TL-SUGGESTION-C03R — AM1: move-bearing suggestion-proposal apply re-validation.
 *
 * Hermetic end-to-end control for the REAL `applyTeachingLoadSuggestionProposal`
 * move loop through a stateful in-memory Prisma-shaped client. No database is
 * used. The test injects the `preview` dependency (the reviewed/refreshed plan)
 * so the transaction-bound move re-validation is the behavior under test:
 *
 *  - POSITIVE: a move whose receiver is eligible ONLY through a persisted
 *    cross-department permission applies, persists the reassignment through the
 *    transaction client, and performs exactly the expected writes.
 *  - NEGATIVE (TOCTOU): the cross-department permission row disappears between
 *    the preview snapshot and the transaction read -> typed
 *    TEACHING_LOAD_PROPOSAL_STALE with zero writes.
 *  - NEGATIVE (program scope): the section program type changes between preview
 *    and apply -> typed stale with zero writes.
 *
 * Run with `npx tsx <this-file>`.
 */

import assert from 'node:assert/strict';

import { withDataContext } from '../lib/data-context.js';
import { applyTeachingLoadSuggestionProposal } from '../services/teaching-load-suggestion-proposal.service.js';

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

// ─── In-memory Prisma-shaped client (stateful, mutable, rollback-aware) ──────

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

type Model = {
	findMany(args?: any): Promise<any[]>;
	findFirst(args?: any): Promise<any>;
	findUnique(args?: any): Promise<any>;
	count(args?: any): Promise<number>;
	create(args?: any): Promise<any>;
	createMany(args?: any): Promise<any>;
	update(args?: any): Promise<any>;
	updateMany(args?: any): Promise<any>;
	upsert(args?: any): Promise<any>;
	delete(args?: any): Promise<any>;
	deleteMany(args?: any): Promise<any>;
};

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
};

function createApplyClient(initial: ApplyState) {
	const state: ApplyState = structuredClone(initial);
	const writes: Array<{ model: string; op: string }> = [];
	const record = (model: string, op: string) => { writes.push({ model, op }); };

	let nextId = 5000;
	const readModel = (name: string, rows: Row[]): Partial<Model> => ({
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
	});

	const hydrateOwnership = (row: Row): Row => {
		const facultySubject = state.facultySubjects.find((fs) => fs.id === row.facultySubjectId);
		const subject = facultySubject ? state.subjects.find((s) => s.id === facultySubject.subjectId) : undefined;
		return {
			...structuredClone(row),
			facultySubject: facultySubject
				? {
					...structuredClone(facultySubject),
					subject: subject ? { id: subject.id, minMinutesPerWeek: subject.minMinutesPerWeek } : null,
				}
				: null,
		};
	};

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
		teachingLoadSuggestionProposal: {
			...readModel('teachingLoadSuggestionProposal', state.proposals),
			updateMany: async (args: any = {}) => {
				const rows = state.proposals.filter((row) => matchesWhere(row, args.where));
				for (const row of rows) Object.assign(row, structuredClone(args.data));
				record('teachingLoadSuggestionProposal', 'updateMany');
				return { count: rows.length };
			},
		},
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
		subjectSectionOwnership: {
			findMany: async (args: any = {}) => state.ownerships
				.filter((row) => matchesWhere(row, args.where))
				.map(hydrateOwnership),
			findUnique: async (args: any = {}) => {
				const found = state.ownerships.find((row) => matchesWhere(row, args.where));
				return found ? hydrateOwnership(found) : null;
			},
			count: async (args: any = {}) => state.ownerships.filter((row) => matchesWhere(row, args.where)).length,
			update: async (args: any = {}) => {
				const row = state.ownerships.find((candidate) => matchesWhere(candidate, args.where));
				if (!row) throw new Error('ownership not found');
				Object.assign(row, structuredClone(args.data));
				record('subjectSectionOwnership', 'update');
				return hydrateOwnership(row);
			},
			createMany: async (args: any = {}) => {
				for (const data of args.data ?? []) {
					state.ownerships.push({ id: nextId++, ...structuredClone(data) });
				}
				record('subjectSectionOwnership', 'createMany');
				return { count: (args.data ?? []).length };
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
				const existing = state.cycles.find(
					(row) => row.schoolId === compound.schoolId && row.schoolYearId === compound.schoolYearId,
				);
				record('teachingLoadCycle', 'upsert');
				if (existing) {
					for (const [field, value] of Object.entries(args.update ?? {})) {
						if (value && typeof value === 'object' && 'increment' in (value as Row)) {
							existing[field] = (existing[field] ?? 0) + (value as Row).increment;
						} else {
							existing[field] = structuredClone(value);
						}
					}
					return structuredClone(existing);
				}
				const created = { id: nextId++, version: 1, ...structuredClone(args.create) };
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

	// Any unmodelled write op must be an explicit failure, not a silent success.
	// Modelled write methods record exactly once per call (inside their body).
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
		const backup = structuredClone(state);
		try {
			return await callback(client);
		} catch (error) {
			for (const key of Object.keys(state)) delete (state as any)[key];
			Object.assign(state, backup);
			throw error;
		}
	};

	return { client, state, writes };
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SCHOOL = 1;
const YEAR = 9;
const ACTOR = 77;
const MATH = 21;
const DONOR = 101;
const RECEIVER = 106;
const SECTION = 7001;
const OWNERSHIP = 501;
const DONOR_FS = 901;

const POLICY_REVISION = 'std:1800;adv:300;cap:2400';

function buildState(overrides: Partial<ApplyState> = {}): ApplyState {
	return {
		proposals: [{
			id: 1,
			schoolId: SCHOOL,
			schoolYearId: YEAR,
			coverageMode: 'REAL_FACULTY_STANDARD',
			status: 'PENDING',
			previewPayload: null,
			refreshedPreviewPayload: null,
			applyPayload: null,
			sectionSource: 'atlas-mirror',
			sectionFallbackReason: null,
			suggestedAssignmentCount: 0,
			unresolvedCount: 0,
			warningCount: 0,
			createdBy: ACTOR,
			appliedBy: null,
			createdAt: new Date('2026-09-12T00:00:00Z'),
			updatedAt: new Date('2026-09-12T00:00:00Z'),
			appliedAt: null,
			cancelledAt: null,
		}],
		yearMirrors: [{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: true, isArchived: false }],
		policies: [{ schoolId: SCHOOL, schoolYearId: YEAR, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
		subjects: [{
			id: MATH, schoolId: SCHOOL, code: 'MATH', name: 'Mathematics', isActive: true,
			minMinutesPerWeek: 240, ownerDepartment: 'MATH', requiredFeatures: [],
			allowedSpecializations: [], programScopes: ['REGULAR'],
		}],
		sections: [{
			externalId: SECTION, schoolId: SCHOOL, schoolYearId: YEAR, name: 'G7-7001',
			displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false,
		}],
		faculty: [
			{
				id: DONOR, schoolId: SCHOOL, firstName: 'Dana', lastName: 'Donor', department: 'MATH',
				specialization: null, canTeachOutsideDepartment: false, maxHoursPerWeek: 30,
				isActiveForScheduling: true, isStale: false, isPlaceholder: false, version: 1,
			},
			{
				id: RECEIVER, schoolId: SCHOOL, firstName: 'Percy', lastName: 'Perm', department: 'SCI',
				specialization: null, canTeachOutsideDepartment: false, maxHoursPerWeek: 30,
				isActiveForScheduling: true, isStale: false, isPlaceholder: false, version: 1,
			},
		],
		facultySubjects: [{
			id: DONOR_FS, facultyId: DONOR, subjectId: MATH, schoolId: SCHOOL, schoolYearId: YEAR,
			sectionIds: [SECTION], gradeLevels: [7], assignedBy: ACTOR,
		}],
		ownerships: [{
			id: OWNERSHIP, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: MATH,
			sectionId: SECTION, facultyId: DONOR, facultySubjectId: DONOR_FS,
		}],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [],
		crossDepartmentPermissions: [{ schoolId: SCHOOL, facultyId: RECEIVER, subjectId: MATH }],
		specializationAliases: [],
		cycles: [],
		audits: [],
		...overrides,
	};
}

function buildMove() {
	return {
		action: 'MOVE' as const,
		ownershipId: OWNERSHIP,
		facultySubjectId: DONOR_FS,
		subjectId: MATH,
		subjectCode: 'MATH',
		subjectName: 'Mathematics',
		sectionId: SECTION,
		sectionName: 'G7-7001',
		fromFacultyId: DONOR,
		fromFacultyName: 'Donor, Dana',
		toFacultyId: RECEIVER,
		toFacultyName: 'Perm, Percy',
		minutes: 240,
		toQualificationTier: 3,
		toQualificationAuthority: 'CROSS_DEPARTMENT_PERMISSION' as const,
	};
}

function buildPreview(plan: any): any {
	return {
		preserved: 1,
		created: 0,
		assignmentsCreated: 0,
		uniqueTeachersAffected: 0,
		unresolved: 0,
		coverageMode: 'REAL_FACULTY_STANDARD',
		warnings: [],
		sectionSource: 'atlas-mirror',
		sectionFallbackReason: null,
		staffingReport: {},
		staffingTruth: {},
		suggestedRows: [],
		distribution: plan,
	};
}

function buildPlan() {
	return {
		retains: [],
		inserts: [],
		moves: [buildMove()],
		policy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, revision: POLICY_REVISION },
		summary: {
			coveredRows: 1, uncoveredRows: 0, proposedMoves: 1, unresolvedImbalance: 0,
			aboveStandardFaculty: 0, hardCapBreaches: 0, distributionEvaluated: true, balanced: false,
		},
	};
}

function writesBy(state: { writes: Array<{ model: string; op: string }> }, model: string, op: string): number {
	return state.writes.filter((entry) => entry.model === model && entry.op === op).length;
}

async function expectStale(state: ApplyState, mutateBeforeTransaction: (client: any) => void) {
	const plan = buildPlan();
	const preview = buildPreview(plan);
	state.proposals[0].previewPayload = structuredClone(preview);
	const { client, state: live, writes } = createApplyClient(state);
	const previewWithRace = async () => {
		mutateBeforeTransaction(client);
		return structuredClone(preview);
	};
	let code: string | undefined;
	try {
		await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{ preview: previewWithRace as any },
		));
	} catch (error) {
		code = (error as { code?: string })?.code;
	}
	return { code, live, writes };
}

async function run(): Promise<void> {
	heading('AM1-a. Positive: cross-department permission move applies through the transaction');

	{
		const plan = buildPlan();
		const preview = buildPreview(plan);
		const state = buildState();
		state.proposals[0].previewPayload = structuredClone(preview);
		const { client, state: live, writes } = createApplyClient(state);
		const freshPreview = async () => structuredClone(preview);

		const result = await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{ preview: freshPreview as any },
		));

		check(result.applyResult?.movesApplied === 1, `positive apply persisted one move (got ${result.applyResult?.movesApplied})`);
		check(result.proposal.status === 'APPLIED', 'positive apply marks the proposal APPLIED');

		const ownership = live.ownerships.find((row) => row.id === OWNERSHIP);
		check(ownership?.facultyId === RECEIVER, 'ownership reassigned to the cross-department receiver');
		check(typeof ownership?.facultySubjectId === 'number' && ownership.facultySubjectId !== DONOR_FS, 'ownership points at the receiver faculty-subject row');

		const receiverFs = live.facultySubjects.find((row) => row.id === ownership?.facultySubjectId);
		check(receiverFs?.facultyId === RECEIVER && receiverFs?.subjectId === MATH, 'receiver faculty-subject created for MATH');
		check(JSON.stringify(receiverFs?.sectionIds) === JSON.stringify([SECTION]), 'receiver faculty-subject lists the moved section');
		check(JSON.stringify(receiverFs?.gradeLevels) === JSON.stringify([7]), 'receiver faculty-subject grade levels resolved through the transaction');
		check(!live.facultySubjects.some((row) => row.id === DONOR_FS), 'empty donor faculty-subject row deleted');

		check(live.audits.length === 1, `exactly one audit written (got ${live.audits.length})`);
		check(live.audits[0]?.action === 'TEACHING_LOAD_SUGGESTION_PROPOSAL_APPLIED', 'audit action is the proposal-applied event');
		check(live.audits[0]?.actorId === ACTOR, 'audit carries the authenticated actor');

		const donor = live.faculty.find((row) => row.id === DONOR);
		const receiver = live.faculty.find((row) => row.id === RECEIVER);
		check(donor?.version === 2 && receiver?.version === 2, 'both affected faculty versions bumped once');
		check(live.cycles.length === 1 && live.cycles[0].state === 'POPULATED', 'teaching-load cycle refreshed through the transaction');

		const expected: Array<[string, string, number]> = [
			['subjectSectionOwnership', 'update', 1],
			['facultySubject', 'create', 1],
			['facultySubject', 'delete', 1],
			['facultySubject', 'update', 0],
			['subjectSectionOwnership', 'createMany', 0],
			['facultyMirror', 'updateMany', 1],
			['teachingLoadCycle', 'upsert', 1],
			['teachingLoadSuggestionProposal', 'updateMany', 1],
			['auditLog', 'create', 1],
		];
		for (const [model, op, count] of expected) {
			check(writesBy({ writes }, model, op) === count, `expected ${count}x ${model}.${op} (got ${writesBy({ writes }, model, op)})`);
		}
		const allowedModels = new Set(['subjectSectionOwnership', 'facultySubject', 'facultyMirror', 'teachingLoadCycle', 'teachingLoadSuggestionProposal', 'auditLog']);
		check(writes.every((entry) => allowedModels.has(entry.model)), `no unexpected write model (${JSON.stringify([...new Set(writes.map((entry) => entry.model))])})`);

		heading('AM1-b. Replay is idempotent (best-effort through the same fake)');
		const replayWritesBefore = writes.length;
		const replay = await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{ preview: (async () => { throw new Error('replay must not preview'); }) as any },
		));
		check(replay.proposal.status === 'APPLIED', 'replay reports APPLIED');
		check(writes.length === replayWritesBefore, 'replay performed zero additional writes');
	}

	heading('AM1-c. Negative (TOCTOU): permission disappears between preview and transaction');

	{
		const { code, live, writes } = await expectStale(buildState(), (client) => {
			// Concurrent authority change lands after the pre-transaction preview read.
			client.crossDepartmentPermission.findMany = async () => [];
		});
		check(code === 'TEACHING_LOAD_PROPOSAL_STALE', `typed stale on lost cross-department permission (got ${code})`);
		check(writes.length === 0, `zero write attempts on lost permission (got ${writes.length})`);
		check(live.ownerships.find((row) => row.id === OWNERSHIP)?.facultyId === DONOR, 'ownership unchanged after stale rejection');
		check(live.proposals[0].status === 'PENDING', 'proposal remains PENDING after stale rejection');
		check(live.audits.length === 0, 'no audit written after stale rejection');
	}

	heading('AM1-d. Negative: section program type changes between preview and apply');

	{
		const state = buildState();
		const plan = buildPlan();
		const preview = buildPreview(plan);
		state.proposals[0].previewPayload = structuredClone(preview);
		const { client, state: live, writes } = createApplyClient(state);
		const previewWithRace = async () => {
			const section = live.sections.find((row) => row.externalId === SECTION);
			if (section) section.programType = 'SPA';
			return structuredClone(preview);
		};
		let code: string | undefined;
		try {
			await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
				{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
				{ preview: previewWithRace as any },
			));
		} catch (error) {
			code = (error as { code?: string })?.code;
		}
		check(code === 'TEACHING_LOAD_PROPOSAL_STALE', `typed stale on program-scope mismatch (got ${code})`);
		check(writes.length === 0, `zero write attempts on program-scope mismatch (got ${writes.length})`);
		check(live.ownerships.find((row) => row.id === OWNERSHIP)?.facultyId === DONOR, 'ownership unchanged after program-scope rejection');
		check(live.audits.length === 0, 'no audit written after program-scope rejection');
	}

	console.log(`\n=== TL-SUGGESTION-C03R apply parity ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((error) => {
	console.error('[FATAL]', error);
	process.exitCode = 2;
});
