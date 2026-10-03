/**
 * A8 c4 correction (F2) — the INSERT-side receiver guard on the reviewed
 * suggestion-apply path.
 *
 * THE DEFECT THIS CLOSES. A8 c4 made the `ANYONE` tier reachable inside the real
 * auto-fill pass, so a `REAL_TEACHER` row could name a teacher the canonical
 * persisted-only resolver scores `tier: null`. `buildTeachingLoadDistributionPlan`
 * turns such a row into an `INSERT`, and apply writes `plan.inserts` as
 * `SubjectSectionOwnership` rows. The ONLY receiver re-validation in that apply
 * covered `proposedMoves` — inserts were unvalidated, so a reviewed apply could
 * persist a class owned by somebody who does not hold the subject. That is a
 * write-authority defect on a HIGH write path.
 *
 * TWO independent halves, both proved here:
 *  1. THE DEFAULT. `allowUnqualifiedRealFaculty` now defaults to `false` on the
 *     bulk suggestion path, so the default preview cannot produce such an insert.
 *     Proved in `a8-c4-cover-candidates.test.ts` (4b/4f/4g), because it is an
 *     `autoFill` option question.
 *  2. THE GUARD. Even when a caller opts in and such a plan is reviewed and
 *     applied, `applyTeachingLoadSuggestionProposal` re-evaluates every insert
 *     receiver inside its Serializable transaction — mirroring the existing
 *     move-side guard — and refuses the whole apply with a typed reason and ZERO
 *     writes. This file proves (2).
 *
 * Hermetic: a stateful in-memory Prisma-shaped client, no database, no network.
 * The `preview` dependency is injected so the reviewed plan and the refreshed
 * plan are byte-identical — exactly the "nothing changed" case.
 *
 * Controls:
 *   F2a NEGATIVE — an insert whose receiver re-evaluates to `tier: null` is a
 *                  typed `409 TEACHING_LOAD_INSERT_RECEIVER_UNQUALIFIED` that
 *                  names the pair, with ZERO ownership, permission, FacultySubject
 *                  and audit writes.
 *   F2b POSITIVE — the SAME plan with a qualified receiver still applies, writes
 *                  the ownership + FacultySubject rows, and is audited.
 *   F2c BOUNDED  — a plan mixing a qualified and an unqualified receiver refuses
 *                  and names only the offending pair.
 *
 * Mutants that MUST turn F2a/F2c red:
 *   - delete the `if (qualification.tier == null)` push inside the insert guard;
 *   - delete the whole insert-side guard block;
 *   - run the guard only over `plan.moves` instead of `grouped`.
 *   In every case F2a returns `error === null` and the ownership rows exist, so
 *   the refusal assertions and the zero-write assertions both fail.
 *
 * Run: npx tsx --test src/__tests__/a8-c4-insert-receiver-guard.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { applyTeachingLoadSuggestionProposal } from '../services/teaching-load-suggestion-proposal.service.js';

// ─── In-memory Prisma-shaped client (stateful, rollback-aware) ────────────────

type Row = Record<string, any>;

const WRITE_OPS = new Set([
	'create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert',
	'delete', 'deleteMany', 'executeRaw', 'executeRawUnsafe', 'queryRaw', 'queryRawUnsafe',
]);

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

type Write = { model: string; op: string };

function createApplyClient(initial: ApplyState): { client: any; state: ApplyState; writes: Write[] } {
	const state: ApplyState = structuredClone(initial);
	const writes: Write[] = [];
	const record = (model: string, op: string) => { writes.push({ model, op }); };

	let nextId = 9000;
	const readModel = (rows: Row[]): Row => ({
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

	const models: Record<string, any> = {
		enrollProSchoolYearMirror: readModel(state.yearMirrors),
		schedulingPolicy: readModel(state.policies),
		departmentAlias: readModel(state.departmentAliases),
		departmentLabel: readModel(state.departmentLabels),
		subjectOwnerPrefix: readModel(state.subjectOwnerPrefixes),
		crossDepartmentPermission: readModel(state.crossDepartmentPermissions),
		specializationAlias: readModel(state.specializationAliases),
		subject: readModel(state.subjects),
		sectionMirror: readModel(state.sections),
		teachingLoadSuggestionProposal: {
			...readModel(state.proposals),
			updateMany: async (args: any = {}) => {
				const rows = state.proposals.filter((row) => matchesWhere(row, args.where));
				for (const row of rows) Object.assign(row, structuredClone(args.data));
				record('teachingLoadSuggestionProposal', 'updateMany');
				return { count: rows.length };
			},
		},
		facultyMirror: {
			...readModel(state.faculty),
			updateMany: async (args: any = {}) => {
				for (const row of state.faculty.filter((candidate) => matchesWhere(candidate, args.where))) {
					for (const [field, value] of Object.entries(args.data ?? {})) {
						if (value && typeof value === 'object' && 'increment' in (value as Row)) {
							row[field] = (row[field] ?? 0) + (value as Row).increment;
						} else {
							row[field] = structuredClone(value);
						}
					}
				}
				record('facultyMirror', 'updateMany');
				return { count: 1 };
			},
		},
		subjectSectionOwnership: {
			findMany: async (args: any = {}) => state.ownerships
				.filter((row) => matchesWhere(row, args.where))
				.map((row) => structuredClone(row)),
			findUnique: async (args: any = {}) => {
				const found = state.ownerships.find((row) => matchesWhere(row, args.where));
				return found ? structuredClone(found) : null;
			},
			count: async (args: any = {}) => state.ownerships.filter((row) => matchesWhere(row, args.where)).length,
			createMany: async (args: any = {}) => {
				for (const data of (args.data ?? []) as Row[]) {
					state.ownerships.push({ id: nextId++, ...structuredClone(data) });
				}
				record('subjectSectionOwnership', 'createMany');
				return { count: (args.data as Row[]).length };
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
		},
		teachingLoadCycle: {
			upsert: async (args: any = {}) => {
				const compound = args.where?.schoolId_schoolYearId ?? {};
				const existing = state.cycles.find(
					(row) => row.schoolId === compound.schoolId && row.schoolYearId === compound.schoolYearId,
				);
				record('teachingLoadCycle', 'upsert');
				if (existing) return structuredClone(existing);
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

	// Any write the production path performs that this fixture does not model is a
	// hard failure, not a silent success: the zero-write assertions depend on it.
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
const FILI = 22;
const SECTION_A = 7001;
const SECTION_B = 7002;
const ALICE = 101;

const POLICY_REVISION = 'std:1800;adv:300;cap:2400';
const DERIVED_REVISION = 'D'.repeat(64);

const derivedAuthority = async () => ({
	ok: true as const,
	scope: { schoolId: SCHOOL, schoolYearId: YEAR },
	yearLabel: '2030-2031',
	revision: DERIVED_REVISION,
	termStructure: { format: 'TRIMESTER' as const, semanticRevision: 'A'.repeat(64), terms: [] },
	periodLengthMinutes: 45,
	timetableLines: [],
	teachingLoadPairs: [],
	totalsByTerm: {},
	totalLines: 0,
	totalPairs: 0,
});

function faculty(id: number, firstName: string, department: string): Row {
	return {
		id, schoolId: SCHOOL, firstName, lastName: 'Test', department,
		specialization: null, canTeachOutsideDepartment: false, maxHoursPerWeek: 30,
		isActiveForScheduling: true, isStale: false, isPlaceholder: false, version: 1,
	};
}

function subject(id: number, code: string, ownerDepartment: string): Row {
	return {
		id, schoolId: SCHOOL, code, name: code, isActive: true, minMinutesPerWeek: 240,
		ownerDepartment, requiredFeatures: [], allowedSpecializations: [], programScopes: ['REGULAR'],
	};
}

function buildState(): ApplyState {
	return {
		proposals: [{
			id: 1, schoolId: SCHOOL, schoolYearId: YEAR, coverageMode: 'REAL_FACULTY_STANDARD',
			status: 'PENDING', previewPayload: null, refreshedPreviewPayload: null, applyPayload: null,
			sectionSource: 'atlas-mirror', sectionFallbackReason: null, suggestedAssignmentCount: 0,
			unresolvedCount: 0, warningCount: 0, createdBy: ACTOR, appliedBy: null,
			createdAt: new Date('2026-09-29T00:00:00Z'), updatedAt: new Date('2026-09-29T00:00:00Z'),
			appliedAt: null, cancelledAt: null,
		}],
		yearMirrors: [{ schoolId: SCHOOL, enrollProSchoolYearId: YEAR, isActive: true, isArchived: false }],
		policies: [{ schoolId: SCHOOL, schoolYearId: YEAR, teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }],
		subjects: [subject(MATH, 'MATH', 'MATH'), subject(FILI, 'FILI', 'FILI')],
		sections: [
			{ externalId: SECTION_A, schoolId: SCHOOL, schoolYearId: YEAR, name: 'G7-A', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			{ externalId: SECTION_B, schoolId: SCHOOL, schoolYearId: YEAR, name: 'G7-B', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		],
		// ALICE is in MATH: she is QUALIFIED for MATH and scores `tier: null` for
		// FILI, which is owned by the FILI department. No permission row exists,
		// so nothing rescues the FILI insert.
		faculty: [faculty(ALICE, 'Alice', 'MATH')],
		facultySubjects: [],
		ownerships: [],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [],
		crossDepartmentPermissions: [],
		specializationAliases: [],
		cycles: [],
		audits: [],
	};
}

function buildPlan(inserts: Row[]): Row {
	return {
		retains: [],
		inserts: inserts.map((insert) => ({ action: 'INSERT', ...insert })),
		moves: [],
		policy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, revision: POLICY_REVISION },
		summary: {
			coveredRows: 0, uncoveredRows: 0, proposedMoves: 0, unresolvedImbalance: 0,
			aboveStandardFaculty: 0, hardCapBreaches: 0, distributionEvaluated: true, balanced: false,
		},
	};
}

function buildPreview(plan: Row): Row {
	return {
		preserved: 0, created: plan.inserts.length, assignmentsCreated: plan.inserts.length,
		uniqueTeachersAffected: 1, unresolved: 0, coverageMode: 'REAL_FACULTY_STANDARD',
		warnings: [], sectionSource: 'atlas-mirror', sectionFallbackReason: null,
		staffingReport: {}, staffingTruth: {}, suggestedRows: [],
		distribution: plan, derivedDemandRevision: DERIVED_REVISION,
		canonicalDemandPairCount: 2, outsideDemandOwnershipCount: 0,
	};
}

type ApplyOutcome = { error: any; result: any; state: ApplyState; writes: Write[] };

/**
 * The plan is injected as BOTH the reviewed preview and the refreshed preview,
 * which is what an opted-in `allowUnqualifiedRealFaculty` preview produces: a
 * plan that asserts the ANYONE insert. The apply is the only place that can stop
 * it, and stopping it is what these controls prove.
 */
async function applyPlan(inserts: Row[]): Promise<ApplyOutcome> {
	const preview = buildPreview(buildPlan(inserts));
	const state = buildState();
	state.proposals[0].previewPayload = structuredClone(preview);
	const { client, state: live, writes } = createApplyClient(state);
	const refreshedPreview = async () => structuredClone(preview);
	try {
		const result = await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{
				preview: refreshedPreview as any,
				resolveDerivedDemand: derivedAuthority as any,
				evaluatePlacement: async () => ({ placeable: true, demandReady: true, evaluated: true, blockers: [] }),
			},
		));
		return { error: null, result, state: live, writes };
	} catch (error) {
		return { error, result: null, state: live, writes };
	}
}

function writeCount(writes: Write[], model: string, op: string): number {
	return writes.filter((entry) => entry.model === model && entry.op === op).length;
}

// ─── Controls ────────────────────────────────────────────────────────────────

test('F2a: an insert whose receiver scores tier null is refused with a typed reason and ZERO writes', async () => {
	const outcome = await applyPlan([{ subjectId: FILI, sectionId: SECTION_A, facultyId: ALICE }]);

	assert.notEqual(outcome.error, null, 'the apply must be refused');
	assert.equal(outcome.error.statusCode, 409);
	assert.equal(outcome.error.code, 'TEACHING_LOAD_INSERT_RECEIVER_UNQUALIFIED');
	assert.equal(outcome.error.actionHint, 'Preview a fresh Teaching Load suggestion, review it, then apply it.');
	assert.deepEqual(outcome.error.details, {
		reason: 'RECEIVER_NOT_QUALIFIED',
		changedPairCount: 1,
		changedPairs: [{ subjectId: FILI, sectionId: SECTION_A, facultyId: ALICE }],
		remainingChangedPairCount: 0,
	}, 'the offending pair is named in the same bounded shape as an ownership drift');

	// ZERO writes — asserted on the recorded write log AND on the live rows.
	assert.deepEqual(outcome.writes, [], 'the refusal happens BEFORE the first write, not by rollback');
	assert.deepEqual(outcome.state.ownerships, [], 'no ownership row');
	assert.deepEqual(outcome.state.facultySubjects, [], 'no FacultySubject row');
	assert.deepEqual(outcome.state.audits, [], 'no audit row');
	assert.equal(outcome.state.proposals[0].status, 'PENDING', 'the proposal is still pending');
});

test('F2b: the same plan with a QUALIFIED receiver still applies', async () => {
	const outcome = await applyPlan([{ subjectId: MATH, sectionId: SECTION_A, facultyId: ALICE }]);

	assert.equal(outcome.error, null, `a qualified insert must apply (got ${(outcome.error as any)?.code})`);
	assert.equal(outcome.result.proposal.status, 'APPLIED');

	assert.equal(writeCount(outcome.writes, 'subjectSectionOwnership', 'createMany'), 1);
	assert.equal(outcome.state.ownerships.length, 1, 'the ownership row exists');
	assert.deepEqual(
		{
			subjectId: outcome.state.ownerships[0].subjectId,
			sectionId: outcome.state.ownerships[0].sectionId,
			facultyId: outcome.state.ownerships[0].facultyId,
		},
		{ subjectId: MATH, sectionId: SECTION_A, facultyId: ALICE },
	);
	assert.equal(outcome.state.facultySubjects.length, 1, 'and its FacultySubject row');
	assert.equal(outcome.state.audits.length, 1, 'and the apply is audited');
	assert.equal(outcome.state.proposals[0].status, 'APPLIED');
});

test('F2c: one unqualified insert among qualified ones refuses the WHOLE apply and names only the bad pair', async () => {
	const outcome = await applyPlan([
		{ subjectId: MATH, sectionId: SECTION_A, facultyId: ALICE },
		{ subjectId: FILI, sectionId: SECTION_B, facultyId: ALICE },
	]);

	assert.notEqual(outcome.error, null);
	assert.equal(outcome.error.code, 'TEACHING_LOAD_INSERT_RECEIVER_UNQUALIFIED');
	assert.deepEqual(
		outcome.error.details.changedPairs,
		[{ subjectId: FILI, sectionId: SECTION_B, facultyId: ALICE }],
		'the qualified insert is not reported as a problem',
	);
	assert.equal(outcome.error.details.changedPairCount, 1);
	assert.deepEqual(outcome.writes, [], 'all-or-nothing: the qualified insert is rolled back with it');
	assert.deepEqual(outcome.state.ownerships, []);
});
