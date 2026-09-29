/**
 * A8 TL-SHORTAGE-C02 item 4 — the ownership-drift check must judge the REVIEWED
 * PLAN's asserted surface, not the read query's cross product.
 *
 * LIVE SYMPTOM THIS CLOSES: `POST /teaching-load/suggestions/:id/apply` returned
 * `409 TEACHING_LOAD_PROPOSAL_STALE` twice, immediately, with no intervening
 * change. Root cause, reproduced here:
 *
 *   `candidateRows` is built from `refreshedPlan.inserts` only, while
 *   `ownershipRows` was fetched over the CROSS PRODUCT
 *   `insertSubjects x insertSections`. Every row in that cross product that the
 *   plan did not assert as an insert — a RETAIN pair, a MOVE pair, or a foreign
 *   subject/section combination — had no key in `proposedPairs`, so
 *   `undefined !== facultyId` compared TRUE and a fresh, unmutated preview
 *   reported drift.
 *
 * Hermetic: a stateful in-memory Prisma-shaped client, no database. The
 * `preview` dependency is injected so the reviewed plan and the refreshed plan
 * are byte-identical — i.e. exactly the "nothing changed" case that failed live.
 *
 * Controls:
 *   4a POSITIVE   — retained + moved + foreign pairs inside the same
 *                   subject/section scope apply cleanly (the live defect).
 *   4b NEGATIVE   — a genuinely mutated INSERT pair still yields a typed 409
 *                   naming that pair's subject and section, bounded, with the
 *                   actionHint preserved, and ZERO writes.
 *   4c NEGATIVE   — a KEPT_EXISTING -> INSERT flip at apply time re-previews
 *                   explicitly (driftScope RETAIN) instead of a false conflict,
 *                   with ZERO writes.
 *   4d BOUNDED    — a large drift names at most 10 pairs and reports the
 *                   remainder count.
 *
 * Run: npx tsx --test src/__tests__/tl-shortage-ownership-drift-c02.test.ts
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import { applyTeachingLoadSuggestionProposal } from '../services/teaching-load-suggestion-proposal.service.js';

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
	const readModel = (name: string, rows: Row[]): Row => ({
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
				for (const data of args.data ?? []) state.ownerships.push({ id: nextId++, ...structuredClone(data) });
				record('subjectSectionOwnership', 'createMany');
				return { count: (args.data ?? []).length };
			},
			deleteMany: async (args: any = {}) => {
				const kept = state.ownerships.filter((row) => !matchesWhere(row, args.where));
				const removed = state.ownerships.length - kept.length;
				state.ownerships.length = 0;
				state.ownerships.push(...kept);
				return { count: removed };
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
const ESP = 23;
const SECTION_A = 7001;
const SECTION_B = 7002;
const ALICE = 101;
const BEN = 102;
const CAIRO = 103;
const INTAKE = 104;

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

function buildState(overrides: Partial<ApplyState> = {}): ApplyState {
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
		subjects: [subject(MATH, 'MATH', 'MATH'), subject(FILI, 'FILI', 'FILI'), subject(ESP, 'ESP', 'ESP')],
		sections: [
			{ externalId: SECTION_A, schoolId: SCHOOL, schoolYearId: YEAR, name: 'G7-A', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
			{ externalId: SECTION_B, schoolId: SCHOOL, schoolYearId: YEAR, name: 'G7-B', displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		],
		faculty: [faculty(ALICE, 'Alice', 'MATH'), faculty(BEN, 'Ben', 'SCI'), faculty(CAIRO, 'Cairo', 'MATH'), faculty(INTAKE, 'Intake', 'SCI')],
		facultySubjects: [
			{ id: 901, facultyId: CAIRO, subjectId: FILI, schoolId: SCHOOL, schoolYearId: YEAR, sectionIds: [SECTION_A], gradeLevels: [7], assignedBy: ACTOR },
			{ id: 902, facultyId: CAIRO, subjectId: MATH, schoolId: SCHOOL, schoolYearId: YEAR, sectionIds: [SECTION_B], gradeLevels: [7], assignedBy: ACTOR },
			{ id: 903, facultyId: CAIRO, subjectId: ESP, schoolId: SCHOOL, schoolYearId: YEAR, sectionIds: [SECTION_B], gradeLevels: [7], assignedBy: ACTOR },
		],
		// Every one of these three rows sits INSIDE the pre-fix cross product
		// `insertSubjects x insertSections` = {MATH, FILI, ESP} x {7001, 7002},
		// while the plan asserts only three of those six pairs as inserts:
		//   (FILI, 7001)  id 501  -> covered by a MOVE,  not an insert
		//   (MATH, 7002)  id 502  -> covered by a RETAIN, not an insert
		//   (ESP,  7002)  id 503  -> a FOREIGN combination no plan action asserts
		// All three compared `undefined !== facultyId` and reported drift on a
		// fresh, unmutated preview — the live Codex symptom.
		ownerships: [
			{ id: 501, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: FILI, sectionId: SECTION_A, facultyId: CAIRO, facultySubjectId: 901 },
			{ id: 502, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: MATH, sectionId: SECTION_B, facultyId: CAIRO, facultySubjectId: 902 },
			{ id: 503, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: ESP, sectionId: SECTION_B, facultyId: CAIRO, facultySubjectId: 903 },
		],
		departmentAliases: [],
		departmentLabels: [],
		subjectOwnerPrefixes: [],
		// A8 c4 F2: every INSERT receiver must be qualification-valid, because
		// apply now re-validates inserts exactly as it re-validates moves. ALICE is
		// in MATH and ESP is ESP-owned, so she needs the same persisted permission
		// BEN already holds for FILI. Additive: the drift logic reads ownership
		// rows, not permissions.
		crossDepartmentPermissions: [
			{ schoolId: SCHOOL, facultyId: BEN, subjectId: FILI },
			{ schoolId: SCHOOL, facultyId: ALICE, subjectId: ESP },
		],
		specializationAliases: [],
		cycles: [],
		audits: [],
		...overrides,
	};
}

function buildPlan(overrides: { retains?: Row[]; inserts?: Row[]; moves?: Row[] } = {}): Row {
	return {
		retains: overrides.retains ?? [{ action: 'RETAIN', subjectId: MATH, sectionId: SECTION_B, facultyId: CAIRO }],
		inserts: overrides.inserts ?? [
			{ action: 'INSERT', subjectId: MATH, sectionId: SECTION_A, facultyId: ALICE },
			{ action: 'INSERT', subjectId: FILI, sectionId: SECTION_B, facultyId: BEN },
			{ action: 'INSERT', subjectId: ESP, sectionId: SECTION_A, facultyId: ALICE },
		],
		moves: overrides.moves ?? [{
			action: 'MOVE', ownershipId: 501, facultySubjectId: 901, subjectId: FILI, subjectCode: 'FILI',
			subjectName: 'FILI', sectionId: SECTION_A, sectionName: 'G7-A', fromFacultyId: CAIRO,
			fromFacultyName: 'Test, Cairo', toFacultyId: BEN, toFacultyName: 'Test, Ben', minutes: 240,
			toQualificationTier: 3, toQualificationAuthority: 'CROSS_DEPARTMENT_PERMISSION',
		}],
		policy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, revision: POLICY_REVISION },
		summary: {
			coveredRows: 2, uncoveredRows: 3, proposedMoves: 1, unresolvedImbalance: 0,
			aboveStandardFaculty: 0, hardCapBreaches: 0, distributionEvaluated: true, balanced: false,
		},
	};
}

function buildPreview(plan: Row): Row {
	return {
		preserved: 2, created: 3, assignmentsCreated: 3, uniqueTeachersAffected: 3, unresolved: 0,
		coverageMode: 'REAL_FACULTY_STANDARD', warnings: [], sectionSource: 'atlas-mirror',
		sectionFallbackReason: null, staffingReport: {}, staffingTruth: {}, suggestedRows: [],
		distribution: plan, derivedDemandRevision: DERIVED_REVISION,
		canonicalDemandPairCount: 6, outsideDemandOwnershipCount: 0,
	};
}

type ApplyOutcome = { error: any; result: any; state: ApplyState; writes: Write[] };

/**
 * `mutate` receives the LIVE state and lands inside the TOCTOU window between the
 * refreshed-preview read and the transaction read. It edits the fixture directly
 * rather than through a model method so the concurrent writer's own operation is
 * never counted as a production write of the apply under test.
 */
async function applyPlan(plan: Row, mutate: (live: ApplyState) => void = () => undefined): Promise<ApplyOutcome> {
	const preview = buildPreview(plan);
	const state = buildState();
	state.proposals[0].previewPayload = structuredClone(preview);
	const { client, state: live, writes } = createApplyClient(state);
	// The refreshed preview is byte-identical to the reviewed one: this is the
	// "nothing changed" case that failed live.
	const refreshedPreview = async () => {
		mutate(live);
		return structuredClone(preview);
	};
	try {
		const result = await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{ preview: refreshedPreview as any, resolveDerivedDemand: derivedAuthority as any },
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

test('item 4a: retained, moved and foreign pairs in the same scope do NOT report drift', async () => {
	const outcome = await applyPlan(buildPlan());

	assert.equal(outcome.error, null, `a fresh unmutated preview must apply (got ${(outcome.error as any)?.code}: ${(outcome.error as any)?.message})`);
	assert.equal(outcome.result.proposal.status, 'APPLIED');

	// The plan did exactly what the reviewer approved: three inserts and one
	// move, while the retained pair and the foreign pair were left alone.
	assert.equal(writeCount(outcome.writes, 'subjectSectionOwnership', 'createMany'), 3, 'one createMany per (faculty, subject) group: ALICE+MATH, BEN+FILI, ALICE+ESP');
	assert.equal(writeCount(outcome.writes, 'subjectSectionOwnership', 'update'), 1, 'exactly one move was applied');

	assert.equal(outcome.state.ownerships.find((row) => row.id === 501)?.facultyId, BEN, 'the move reassigned only its own pair');
	assert.equal(outcome.state.ownerships.find((row) => row.id === 502)?.facultyId, CAIRO, 'the retained pair is untouched');
	assert.equal(outcome.state.ownerships.find((row) => row.id === 503)?.facultyId, CAIRO, 'the foreign pair is untouched');

	const inserted = outcome.state.ownerships.filter(
		(row) => row.subjectId === MATH && row.sectionId === SECTION_A
			|| row.subjectId === FILI && row.sectionId === SECTION_B
			|| row.subjectId === ESP && row.sectionId === SECTION_A,
	);
	assert.equal(inserted.length, 3, 'the three reviewed inserts were persisted');
	assert.equal(inserted.filter((row) => row.facultyId === ALICE).length, 2);
	assert.equal(inserted.filter((row) => row.facultyId === BEN).length, 1);
});

test('item 4b: a genuinely mutated INSERT pair is a typed 409 naming its subject and section', async () => {
	// A concurrent operator inserts an owner for the pair the reviewed plan would
	// have created, after the refreshed preview was read.
	const outcome = await applyPlan(buildPlan(), (live) => {
		live.ownerships.push({
			id: 599, schoolId: SCHOOL, schoolYearId: YEAR, facultySubjectId: 902,
			facultyId: INTAKE, subjectId: MATH, sectionId: SECTION_A, assignedAt: new Date(),
		});
	});

	assert.ok(outcome.error, 'the mutated insert pair is rejected');
	assert.equal((outcome.error as any).code, 'TEACHING_LOAD_PROPOSAL_STALE');
	assert.equal((outcome.error as any).statusCode, 409);
	assert.equal((outcome.error as any).actionHint, 'Preview a fresh Teaching Load suggestion, review it, then apply it.');
	const details = (outcome.error as any).details;
	assert.equal(details.driftScope, 'INSERT');
	assert.equal(details.changedPairCount, 1);
	assert.deepEqual(details.changedPairs, [{ subjectId: MATH, sectionId: SECTION_A, currentFacultyId: INTAKE }]);
	assert.equal(details.remainingChangedPairCount, 0);

	// Zero writes: the rejection happens before any insert, move, cycle refresh
	// or audit. The concurrent row itself is the caller's own write, not ours.
	assert.deepEqual(outcome.writes, [], `no production write was attempted (got ${JSON.stringify(outcome.writes)})`);
	assert.equal(outcome.state.audits.length, 0, 'no audit written');
	assert.equal(outcome.state.proposals[0].status, 'PENDING', 'the proposal stays PENDING');
	assert.equal(outcome.state.facultySubjects.filter((row) => row.facultyId === ALICE).length, 0, 'no faculty-subject was created');
	assert.equal(outcome.state.ownerships.filter((row) => row.subjectId === MATH && row.sectionId === SECTION_A).length, 1, 'only the concurrent row exists');
	assert.equal(outcome.state.cycles.length, 0, 'the teaching-load cycle was not refreshed');
});

test('item 4c: a KEPT_EXISTING -> INSERT flip re-previews explicitly, not as a false conflict', async () => {
	// The reviewed plan keeps (MATH, SECTION_B) owned by CAIRO. Someone else
	// claims that pair inside the transaction window.
	const outcome = await applyPlan(buildPlan(), (live) => {
		const row = live.ownerships.find((candidate) => candidate.id === 502);
		if (row) row.facultyId = INTAKE;
	});

	assert.ok(outcome.error, 'the flipped retain pair is rejected');
	assert.equal((outcome.error as any).code, 'TEACHING_LOAD_PROPOSAL_STALE');
	assert.equal((outcome.error as any).actionHint, 'Preview a fresh Teaching Load suggestion, review it, then apply it.');
	const details = (outcome.error as any).details;
	assert.equal(details.driftScope, 'RETAIN', 'the operator is told WHICH part of the plan stopped being true');
	assert.deepEqual(details.changedPairs, [{ subjectId: MATH, sectionId: SECTION_B, currentFacultyId: INTAKE }]);
	assert.equal(details.changedPairCount, 1);
	assert.equal(details.remainingChangedPairCount, 0);

	assert.equal(outcome.state.audits.length, 0, 'no audit written');
	assert.equal(outcome.state.proposals[0].status, 'PENDING');
	assert.equal(outcome.state.ownerships.find((row) => row.id === 501)?.facultyId, CAIRO, 'the move was not applied');
	assert.equal(outcome.state.ownerships.filter((row) => row.subjectId === FILI && row.sectionId === SECTION_B).length, 0, 'the insert was not applied');
});

test('item 4c-bis: a retain pair whose owner row disappeared entirely also re-previews', async () => {
	const outcome = await applyPlan(buildPlan(), (live) => {
		live.ownerships = live.ownerships.filter((row) => row.id !== 502);
	});

	assert.ok(outcome.error, 'a deleted retain row is drift');
	assert.equal((outcome.error as any).code, 'TEACHING_LOAD_PROPOSAL_STALE');
	assert.deepEqual(
		(outcome.error as any).details.changedPairs,
		[{ subjectId: MATH, sectionId: SECTION_B, currentFacultyId: null }],
		'a missing owner is reported as a null current owner, not silently ignored',
	);
	assert.equal((outcome.error as any).details.driftScope, 'RETAIN');
	assert.equal(outcome.state.audits.length, 0, 'zero writes');
});

test('item 4d: a large drift names at most 10 pairs and reports the remainder count', async () => {
	const inserts = Array.from({ length: 12 }, (_, index) => ({
		action: 'INSERT' as const, subjectId: MATH, sectionId: 7100 + index, facultyId: ALICE,
	}));
	const plan = buildPlan({ inserts, moves: [] });
	const sections = Array.from({ length: 12 }, (_, index) => ({
		externalId: 7100 + index, schoolId: SCHOOL, schoolYearId: YEAR, name: `G7-${7100 + index}`,
		displayOrder: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false,
	}));
	const state = buildState({
		sections: [...buildState().sections, ...sections],
		ownerships: [
			...buildState().ownerships,
			...inserts.map((insert, index) => ({
				id: 700 + index, schoolId: SCHOOL, schoolYearId: YEAR, subjectId: MATH,
				sectionId: insert.sectionId, facultyId: INTAKE, facultySubjectId: 902,
			})),
		],
	});
	state.proposals[0].previewPayload = buildPreview(plan);
	const { client, state: live, writes } = createApplyClient(state);
	const refreshedPreview = async () => structuredClone(buildPreview(plan));

	let error: any = null;
	try {
		await withDataContext(client, () => applyTeachingLoadSuggestionProposal(
			{ proposalId: 1, actorId: ACTOR, actorSchoolId: SCHOOL },
			{ preview: refreshedPreview as any, resolveDerivedDemand: derivedAuthority as any },
		));
	} catch (caught) {
		error = caught;
	}

	assert.ok(error, 'a 12-pair drift is rejected');
	assert.equal(error.code, 'TEACHING_LOAD_PROPOSAL_STALE');
	assert.equal(error.details.changedPairCount, 12, 'the true count is reported');
	assert.equal(error.details.changedPairs.length, 10, 'the named list is bounded at 10');
	assert.equal(error.details.remainingChangedPairCount, 2, 'the remainder is reported as a count');
	assert.equal(live.audits.length, 0, 'zero writes');
	assert.equal(writes.length, 0, 'no write was even attempted');
});
