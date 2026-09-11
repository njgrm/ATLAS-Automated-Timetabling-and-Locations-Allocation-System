import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';

import express, { type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';

import facultyAssignmentRouter from '../routes/faculty-assignment.router.js';
import { withDataContext } from '../lib/data-context.js';
import {
	assertTeachingLoadWriteAuthority,
	setAssignments,
} from '../services/faculty-assignment.service.js';
import { autoFill, previewOrApplyOverCapRebalance, type AutoFillResult } from '../services/teaching-load-automation.service.js';
import {
	applyTeachingLoadSuggestionProposal,
	cancelTeachingLoadSuggestionProposal,
	createTeachingLoadSuggestionProposal,
} from '../services/teaching-load-suggestion-proposal.service.js';

type WriteProbe = { count: number };
type ProtectedWriteCounts = {
	facultySubject: number;
	subjectSectionOwnership: number;
	teachingLoadCycle: number;
	teachingLoadSuggestionProposal: number;
	auditLog: number;
};

type YearMirrorFixture = {
	schoolId: number;
	enrollProSchoolYearId: number;
	isActive: boolean;
	isArchived: boolean;
};

const now = new Date('2026-09-10T00:00:00.000Z');

function serviceCode(error: unknown): string | undefined {
	return (error as { code?: string })?.code;
}

function yearClient(mode: 'active' | 'archived' | 'inactive', writes: WriteProbe) {
	const write = async () => {
		writes.count += 1;
		throw new Error('unexpected write');
	};
	return {
		enrollProSchoolYearMirror: {
			findMany: async () => mode === 'active'
				? [{ enrollProSchoolYearId: 9, isActive: true, isArchived: false }]
				: mode === 'archived'
					? [{ enrollProSchoolYearId: 9, isActive: false, isArchived: true }]
					: [{ enrollProSchoolYearId: 9, isActive: false, isArchived: false }],
		},
		sectionMirror: { findMany: async () => [] },
		sectionSnapshot: {
			findUnique: async () => ({ payload: [], fetchedAt: now }),
		},
		facultyMirror: {
			findUnique: async () => ({
				id: 11,
				schoolId: 1,
				isActiveForScheduling: true,
				version: 1,
				isClassAdviser: false,
				advisedSectionId: null,
				specialization: null,
				department: null,
				canTeachOutsideDepartment: false,
			}),
			update: write,
			updateMany: write,
			create: write,
		},
		facultySubject: { create: write, update: write, delete: write, deleteMany: write },
		subjectSectionOwnership: { createMany: write, deleteMany: write },
		teachingLoadCycle: { upsert: write },
		auditLog: { create: write },
		teachingLoadSuggestionProposal: { create: write, update: write, updateMany: write },
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(yearClient(mode, writes)),
	};
}

function ambiguousAuthorityFixture(mirrors: YearMirrorFixture[]) {
	const writes: ProtectedWriteCounts = {
		facultySubject: 0,
		subjectSectionOwnership: 0,
		teachingLoadCycle: 0,
		teachingLoadSuggestionProposal: 0,
		auditLog: 0,
	};
	const recordWrite = (model: keyof ProtectedWriteCounts) => async () => {
		writes[model] += 1;
		throw new Error(`unexpected ${model} write`);
	};
	const findMirrors = async (args?: { where?: Record<string, unknown> }) => {
		const where = args?.where ?? {};
		return mirrors.filter((mirror) => {
			if (where.schoolId !== undefined && mirror.schoolId !== where.schoolId) return false;
			if (where.enrollProSchoolYearId !== undefined && mirror.enrollProSchoolYearId !== where.enrollProSchoolYearId) return false;
			if (where.isActive !== undefined && mirror.isActive !== where.isActive) return false;
			if (where.isArchived !== undefined && mirror.isArchived !== where.isArchived) return false;
			return true;
		}).map((mirror) => ({ ...mirror }));
	};
	const client: any = {
		enrollProSchoolYearMirror: { findMany: findMirrors },
		sectionMirror: { findMany: async () => [] },
		sectionSnapshot: { findUnique: async () => ({ payload: [], fetchedAt: now }) },
		facultyMirror: {
			findUnique: async () => ({
				id: 11, schoolId: 1, isActiveForScheduling: true, version: 1,
				isClassAdviser: false, advisedSectionId: null, specialization: null,
				department: null, canTeachOutsideDepartment: false,
			}),
		},
		facultySubject: {
			create: recordWrite('facultySubject'), update: recordWrite('facultySubject'),
			delete: recordWrite('facultySubject'), deleteMany: recordWrite('facultySubject'),
			createManyAndReturn: recordWrite('facultySubject'),
		},
		subjectSectionOwnership: {
			createMany: recordWrite('subjectSectionOwnership'), deleteMany: recordWrite('subjectSectionOwnership'),
		},
		teachingLoadCycle: {
			create: recordWrite('teachingLoadCycle'), update: recordWrite('teachingLoadCycle'), upsert: recordWrite('teachingLoadCycle'),
		},
		teachingLoadSuggestionProposal: {
			findUnique: async () => structuredClone(proposalRow),
			create: recordWrite('teachingLoadSuggestionProposal'), update: recordWrite('teachingLoadSuggestionProposal'),
			updateMany: recordWrite('teachingLoadSuggestionProposal'),
		},
		auditLog: { create: recordWrite('auditLog') },
		$transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(client),
	};
	return { client, writes: () => structuredClone(writes), findMirrors };
}

async function withMountedRouter<T>(client: unknown, run: (baseUrl: string, token: string) => Promise<T>): Promise<T> {
	const previousSecret = process.env.JWT_SECRET;
	process.env.JWT_SECRET = 'gen-zw01-hermetic-secret';
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
			assert(address && typeof address !== 'string');
			const token = jwt.sign({ userId: 77, role: 'officer', authSource: 'local', schoolId: 1 }, process.env.JWT_SECRET!);
			return run(`http://127.0.0.1:${address.port}`, token);
		});
	} finally {
		if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
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

async function put(baseUrl: string, token: string, path: string, body: unknown) {
	return fetch(`${baseUrl}${path}`, {
		method: 'PUT',
		headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});
}

type ManualState = { version: number; cycleVersion: number; audits: Array<Record<string, unknown>> };

function manualClient(initial: ManualState, failAudit = false) {
	let state = structuredClone(initial);
	const client: any = {
		facultyMirror: {
			findUnique: async () => ({
				id: 11, schoolId: 1, isActiveForScheduling: true, version: state.version,
				isClassAdviser: false, advisedSectionId: null, specialization: null,
				department: null, canTeachOutsideDepartment: false,
			}),
		},
		$transaction: async (callback: (tx: any) => Promise<unknown>) => {
			const draft = structuredClone(state);
			const tx: any = {
				enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 9, isActive: true, isArchived: false }] },
				facultyMirror: {
					findUnique: async () => ({ id: 11, schoolId: 1, isActiveForScheduling: true, version: draft.version }),
					updateMany: async () => { draft.version += 1; return { count: 1 }; },
				},
				facultySubject: { deleteMany: async () => ({ count: 0 }) },
				subjectSectionOwnership: { count: async () => 0 },
				teachingLoadCycle: {
					upsert: async () => { draft.cycleVersion += 1; return { version: draft.cycleVersion }; },
				},
				auditLog: {
					create: async ({ data }: { data: Record<string, unknown> }) => {
						if (failAudit) throw new Error('injected audit failure');
						draft.audits.push(data);
						return data;
					},
				},
			};
			const result = await callback(tx);
			state = draft;
			return result;
		},
	};
	return { client, snapshot: () => structuredClone(state) };
}

type ProposalState = {
	proposal: any;
	facultyVersion: number;
	facultySubjects: any[];
	ownerships: any[];
	cycleVersion: number;
	audits: any[];
};

function proposalClient(initial: ProposalState, failAudit = false) {
	let state = structuredClone(initial);
	let transactionCount = 0;
	let nextFacultySubjectId = 100;
	const client: any = {
		enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 9, isActive: true, isArchived: false }] },
		teachingLoadSuggestionProposal: { findUnique: async () => structuredClone(state.proposal) },
		$transaction: async (callback: (tx: any) => Promise<unknown>) => {
			transactionCount += 1;
			const draft = structuredClone(state);
			const tx: any = {
				enrollProSchoolYearMirror: { findMany: async () => [{ enrollProSchoolYearId: 9, isActive: true, isArchived: false }] },
				schedulingPolicy: {
					findUnique: async () => ({ teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400 }),
				},
				specializationAlias: { findMany: async () => [] },
				teachingLoadSuggestionProposal: {
					findUnique: async () => structuredClone(draft.proposal),
					updateMany: async ({ where, data }: any) => {
						if (draft.proposal.id !== where.id || draft.proposal.status !== where.status) return { count: 0 };
						Object.assign(draft.proposal, data);
						return { count: 1 };
					},
				},
				facultyMirror: {
					findMany: async () => [{ id: 11 }],
					updateMany: async () => { draft.facultyVersion += 1; return { count: 1 }; },
				},
				subject: { findMany: async () => [{ id: 21 }] },
				sectionMirror: { findMany: async () => [{ externalId: 31, displayOrder: 7 }] },
				facultySubject: {
					findUnique: async () => null,
					create: async ({ data }: any) => {
						const row = { id: nextFacultySubjectId++, ...data };
						draft.facultySubjects.push(row);
						return row;
					},
					update: async ({ where, data }: any) => {
						const row = draft.facultySubjects.find((candidate) => candidate.id === where.id);
						Object.assign(row, data);
						return row;
					},
				},
				subjectSectionOwnership: {
					findMany: async () => [],
					createMany: async ({ data }: any) => { draft.ownerships.push(...data); return { count: data.length }; },
					count: async () => draft.ownerships.length,
				},
				teachingLoadCycle: {
					upsert: async () => { draft.cycleVersion += 1; return { version: draft.cycleVersion }; },
				},
				auditLog: {
					create: async ({ data }: any) => {
						if (failAudit) throw new Error('injected audit failure');
						draft.audits.push(data);
						return data;
					},
				},
			};
			const result = await callback(tx);
			state = draft;
			return result;
		},
	};
	return { client, snapshot: () => structuredClone(state), transactionCount: () => transactionCount };
}

const preview: AutoFillResult = {
	preserved: 0,
	created: 0,
	assignmentsCreated: 0,
	uniqueTeachersAffected: 0,
	unresolved: 0,
	coverageMode: 'REAL_FACULTY_STANDARD',
	warnings: [],
	sectionSource: 'atlas-mirror',
	sectionFallbackReason: null,
	staffingReport: {
		department: 'NONE', dominantShortageDepartment: 'NONE', unassignedSections: 0,
		missingHoursPerWeek: 0, concurrentUnassignedSections: 0, concurrentMissingHoursPerWeek: 0,
		recoverableConcurrentRows: 0, recoverableConcurrentMissingHoursPerWeek: 0,
		recoverableConcurrentMissingMinutesPerWeek: 0, constrainedConcurrentRows: 0,
		constrainedConcurrentMissingHoursPerWeek: 0, constrainedConcurrentMissingMinutesPerWeek: 0,
		recommendedNewHires: 0, internalCrossTrainees: [], missingMinutesPerWeek: 0,
		concurrentMissingMinutesPerWeek: 0, rotationAdjustedMinutesPerWeek: 0, shortages: [],
	},
	staffingTruth: {
		baseline: { totalTeachableRows: 1, realCoveredRows: 0, syntheticCoveredRows: 0, unassignedRows: 1 },
		realOnly: { shortageRows: 0, shortageConcurrentHoursPerWeek: 0, shortageConcurrentMinutesPerWeek: 0, rowsClosedByRealFaculty: 1, rowsClosedByTeacherX: 0 },
		hardCap: { shortageRows: 0, shortageConcurrentHoursPerWeek: 0, shortageConcurrentMinutesPerWeek: 0, rowsClosedByRealFaculty: 1, rowsClosedByTeacherX: 0 },
		teacherX: { shortageRows: 0, shortageConcurrentHoursPerWeek: 0, shortageConcurrentMinutesPerWeek: 0, rowsClosedByRealFaculty: 1, rowsClosedByTeacherX: 0 },
	},
	suggestedRows: [{ subjectId: 21, subjectCode: 'MATH', subjectName: 'Mathematics', sectionId: 31, sectionName: '7-A', facultyId: 11, facultyName: 'Teacher One', assignmentType: 'REAL_TEACHER' }],
	distribution: {
		retains: [],
		inserts: [{ action: 'INSERT', subjectId: 21, sectionId: 31, facultyId: 11 }],
		moves: [],
		policy: { teachingStandardMinutes: 1800, advisoryCreditMinutes: 300, hardCapMinutes: 2400, revision: 'std:1800;adv:300;cap:2400' },
		summary: {
			coveredRows: 0,
			uncoveredRows: 0,
			proposedMoves: 0,
			unresolvedImbalance: 0,
			aboveStandardFaculty: 0,
			hardCapBreaches: 0,
			distributionEvaluated: true,
			balanced: true,
		},
	},
};

const proposalRow = {
	id: 41, schoolId: 1, schoolYearId: 9, coverageMode: 'REAL_FACULTY_STANDARD', status: 'PENDING',
	previewPayload: preview, refreshedPreviewPayload: null, applyPayload: null,
	sectionSource: 'atlas-mirror', sectionFallbackReason: null, suggestedAssignmentCount: 1,
	unresolvedCount: 0, warningCount: 0, createdBy: 70, appliedBy: null,
	createdAt: now, updatedAt: now, appliedAt: null, cancelledAt: null,
};

async function run(): Promise<void> {
	const authorityWrites = { count: 0 };
	await assert.rejects(
		assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 }, yearClient('archived', authorityWrites) as any),
		(error) => serviceCode(error) === 'ARCHIVED_YEAR_READ_ONLY',
	);
	assert.equal(authorityWrites.count, 0);

	const targetYear: YearMirrorFixture = { schoolId: 1, enrollProSchoolYearId: 9, isActive: true, isArchived: false };
	const competingActiveYear: YearMirrorFixture = { schoolId: 1, enrollProSchoolYearId: 10, isActive: true, isArchived: false };
	const ambiguous = ambiguousAuthorityFixture([targetYear, competingActiveYear]);
	const requestedRowsOnly = await ambiguous.findMirrors({ where: { schoolId: 1, enrollProSchoolYearId: 9 } });
	assert.equal(
		requestedRowsOnly.length === 1 && requestedRowsOnly[0].isActive && !requestedRowsOnly[0].isArchived,
		true,
		'sensitivity: the old requested-row-only predicate accepts the ambiguous fixture',
	);
	const noProtectedWrites = (): ProtectedWriteCounts => ({
		facultySubject: 0,
		subjectSectionOwnership: 0,
		teachingLoadCycle: 0,
		teachingLoadSuggestionProposal: 0,
		auditLog: 0,
	});
	const expectAmbiguousZeroWrite = async (label: string, operation: () => Promise<unknown>) => {
		const before = ambiguous.writes();
		await assert.rejects(operation, (error) => serviceCode(error) === 'ACTIVE_YEAR_AMBIGUOUS', label);
		assert.deepEqual(ambiguous.writes(), before, `${label}: protected writes remain zero`);
	};

	await expectAmbiguousZeroWrite('shared authority rejects two active years', () => withDataContext(
		ambiguous.client,
		() => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 }),
	));
	await withMountedRouter(ambiguous.client, async (baseUrl, token) => {
		const before = ambiguous.writes();
		const autoFillResponse = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId: 1, schoolYearId: 9 });
		assert.equal(autoFillResponse.status, 409);
		assert.equal((await autoFillResponse.json() as { code: string }).code, 'ACTIVE_YEAR_AMBIGUOUS');
		assert.deepEqual(ambiguous.writes(), before, 'mounted auto-fill ambiguity rejection writes nothing');

		const manualResponse = await put(baseUrl, token, '/api/v1/faculty-assignments/11', { schoolId: 1, schoolYearId: 9, version: 1, assignments: [] });
		assert.equal(manualResponse.status, 409);
		assert.equal((await manualResponse.json() as { code: string }).code, 'ACTIVE_YEAR_AMBIGUOUS');
		assert.deepEqual(ambiguous.writes(), before, 'mounted manual-save ambiguity rejection writes nothing');

		const proposalResponse = await post(baseUrl, token, '/api/v1/faculty-assignments/suggestion-proposals/41/apply', {});
		assert.equal(proposalResponse.status, 409);
		assert.equal((await proposalResponse.json() as { code: string }).code, 'ACTIVE_YEAR_AMBIGUOUS');
		assert.deepEqual(ambiguous.writes(), before, 'mounted proposal-apply ambiguity rejection writes nothing');
	});
	await expectAmbiguousZeroWrite('proposal creation rejects two active years', () => withDataContext(
		ambiguous.client,
		() => createTeachingLoadSuggestionProposal({ schoolId: 1, schoolYearId: 9, actorId: 77, actorSchoolId: 1 }),
	));
	await expectAmbiguousZeroWrite('proposal apply rejects two active years', () => withDataContext(
		ambiguous.client,
		() => applyTeachingLoadSuggestionProposal({ proposalId: 41, actorId: 77, actorSchoolId: 1 }),
	));
	await expectAmbiguousZeroWrite('proposal cancel rejects two active years', () => withDataContext(
		ambiguous.client,
		() => cancelTeachingLoadSuggestionProposal({ proposalId: 41, actorId: 77, actorSchoolId: 1 }),
	));
	await expectAmbiguousZeroWrite('over-cap apply rejects two active years', () => withDataContext(
		ambiguous.client,
		() => previewOrApplyOverCapRebalance({ schoolId: 1, schoolYearId: 9, actorId: 77, actorSchoolId: 1, previewOnly: false }),
	));
	assert.deepEqual(ambiguous.writes(), noProtectedWrites());

	for (const competingYear of [
		{ ...competingActiveYear, isActive: false },
		{ ...competingActiveYear, isActive: false, isArchived: true },
	]) {
		const resolved = ambiguousAuthorityFixture([targetYear, competingYear]);
		await withDataContext(resolved.client, () => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 }));
		await withMountedRouter(resolved.client, async (baseUrl, token) => {
			const response = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId: 1, schoolYearId: 9 });
			assert.equal(response.status, 409);
			assert.equal((await response.json() as { code: string }).code, 'TEACHING_LOAD_PROPOSAL_REQUIRED');
		});
		assert.deepEqual(resolved.writes(), noProtectedWrites(), 'inactive or archived competing mirror restores sole-active authority');
	}

	const requestedArchived = ambiguousAuthorityFixture([
		{ ...targetYear, isActive: false, isArchived: true },
		competingActiveYear,
	]);
	await assert.rejects(
		withDataContext(requestedArchived.client, () => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 })),
		(error) => serviceCode(error) === 'ARCHIVED_YEAR_READ_ONLY',
		'requested archived mirror takes precedence over the other active year',
	);

	const historical = ambiguousAuthorityFixture([{ ...targetYear, isActive: false }, competingActiveYear]);
	await assert.rejects(
		withDataContext(historical.client, () => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 })),
		(error) => serviceCode(error) === 'INACTIVE_HISTORICAL_YEAR',
	);
	const unavailable = ambiguousAuthorityFixture([{ ...targetYear, isActive: false }]);
	await assert.rejects(
		withDataContext(unavailable.client, () => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 })),
		(error) => serviceCode(error) === 'ACTIVE_YEAR_UNAVAILABLE',
	);
	const missing = ambiguousAuthorityFixture([competingActiveYear]);
	await assert.rejects(
		withDataContext(missing.client, () => assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 })),
		(error) => serviceCode(error) === 'YEAR_MIRROR_NOT_FOUND',
	);
	await assert.rejects(
		assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 2 }, yearClient('active', authorityWrites) as any),
		(error) => serviceCode(error) === 'SCHOOL_MISMATCH',
	);
	await assert.rejects(
		assertTeachingLoadWriteAuthority({ schoolId: 1, schoolYearId: 9, actorSchoolId: 1 }, yearClient('inactive', authorityWrites) as any),
		(error) => serviceCode(error) === 'ACTIVE_YEAR_UNAVAILABLE',
	);
	assert.equal(authorityWrites.count, 0);

	const noAccess = new Proxy({}, { get: () => { throw new Error('auto-fill touched data before rejecting'); } });
	await assert.rejects(autoFill(1, 9, undefined, {}), (error) => serviceCode(error) === 'TEACHING_LOAD_PROPOSAL_REQUIRED');
	await withDataContext(noAccess, async () => {
		await assert.rejects(autoFill(1, 9), (error) => serviceCode(error) === 'TEACHING_LOAD_PROPOSAL_REQUIRED');
	});

	for (const mode of ['active', 'archived'] as const) {
		const writes = { count: 0 };
		await withMountedRouter(yearClient(mode, writes), async (baseUrl, token) => {
			const response = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId: 1, schoolYearId: 9 });
			assert.equal(response.status, 409);
			const body = await response.json() as { code: string };
			assert.equal(body.code, mode === 'active' ? 'TEACHING_LOAD_PROPOSAL_REQUIRED' : 'ARCHIVED_YEAR_READ_ONLY');
		});
		assert.equal(writes.count, 0);
	}

	const previewWrites = { count: 0 };
	await withMountedRouter(yearClient('active', previewWrites), async (baseUrl, token) => {
		const response = await post(baseUrl, token, '/api/v1/faculty-assignments/auto-fill', { schoolId: 1, schoolYearId: 9, previewOnly: true });
		assert.equal(response.status, 200);
		const body = await response.json() as { created: number; warnings: string[] };
		assert.equal(body.created, 0);
		assert(body.warnings.some((warning) => warning.includes('No active sections')));
	});
	assert.equal(previewWrites.count, 0);

	const archivedWrites = { count: 0 };
	await withMountedRouter(yearClient('archived', archivedWrites), async (baseUrl, token) => {
		const response = await put(baseUrl, token, '/api/v1/faculty-assignments/11', { schoolId: 1, schoolYearId: 9, version: 1, assignments: [] });
		assert.equal(response.status, 409);
		assert.equal((await response.json() as { code: string }).code, 'ARCHIVED_YEAR_READ_ONLY');
	});
	assert.equal(archivedWrites.count, 0);

	const manualSuccess = manualClient({ version: 1, cycleVersion: 1, audits: [] });
	const manualResult = await withDataContext(manualSuccess.client, () => setAssignments(11, 1, 9, 77, 1, [], undefined, { actorSchoolId: 1 }));
	assert.deepEqual(manualResult, { success: true, version: 2 });
	assert.equal(manualSuccess.snapshot().version, 2);
	assert.equal(manualSuccess.snapshot().cycleVersion, 2);
	assert.equal(manualSuccess.snapshot().audits.length, 1);
	assert.equal(manualSuccess.snapshot().audits[0].actorId, 77);

	const manualFailure = manualClient({ version: 1, cycleVersion: 1, audits: [] }, true);
	await withDataContext(manualFailure.client, () => assert.rejects(
		setAssignments(11, 1, 9, 77, 1, [], undefined, { actorSchoolId: 1 }),
		/injected audit failure/,
	));
	assert.deepEqual(manualFailure.snapshot(), { version: 1, cycleVersion: 1, audits: [] });

	const initialProposalState: ProposalState = {
		proposal: proposalRow, facultyVersion: 1, facultySubjects: [], ownerships: [], cycleVersion: 1, audits: [],
	};
	const proposalSuccess = proposalClient(initialProposalState);
	const applied = await withDataContext(proposalSuccess.client, () => applyTeachingLoadSuggestionProposal(
		{ proposalId: 41, actorId: 77, actorSchoolId: 1 },
		{ preview: async () => structuredClone(preview) },
	));
	assert.equal(applied.proposal.status, 'APPLIED');
	let appliedState = proposalSuccess.snapshot();
	assert.equal(appliedState.facultySubjects.length, 1);
	assert.equal(appliedState.facultySubjects[0].assignedBy, 77);
	assert.equal(appliedState.ownerships.length, 1);
	assert.equal(appliedState.facultyVersion, 2);
	assert.equal(appliedState.cycleVersion, 2);
	assert.equal(appliedState.audits.length, 1);
	assert.equal(appliedState.audits[0].actorId, 77);
	const transactionCountAfterApply = proposalSuccess.transactionCount();
	await withDataContext(proposalSuccess.client, () => applyTeachingLoadSuggestionProposal(
		{ proposalId: 41, actorId: 77, actorSchoolId: 1 },
		{ preview: async () => { throw new Error('replay must not preview'); } },
	));
	assert.equal(proposalSuccess.transactionCount(), transactionCountAfterApply);
	assert.deepEqual(proposalSuccess.snapshot(), appliedState);

	const proposalFailure = proposalClient(initialProposalState, true);
	await withDataContext(proposalFailure.client, () => assert.rejects(
		applyTeachingLoadSuggestionProposal(
			{ proposalId: 41, actorId: 77, actorSchoolId: 1 },
			{ preview: async () => structuredClone(preview) },
		),
		/injected audit failure/,
	));
	assert.deepEqual(proposalFailure.snapshot(), initialProposalState);

	console.log('GEN-ZW01 Teaching Load authority, mounted-route, audit, and rollback tests: PASS');
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
