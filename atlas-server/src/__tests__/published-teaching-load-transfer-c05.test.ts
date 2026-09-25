/**
 * LANE-C DEPARTURE-LOAD-C05 — a teacher change on the published timetable
 * carries its Teaching Load ownership.
 *
 * Live QA on 2026-09-25: every replacement for a leaving teacher was refused
 * with FACULTY_SUBJECT_NOT_QUALIFIED because only the leaving teacher held the
 * subject+section Teaching Load rows, so the published flow forced a detour
 * through Teaching Load. These rows drive the real service through a hermetic
 * fake transaction (DATABASE_URL unset):
 *   L1 preview validates against the Teaching Load the change implies (clean)
 *      and writes nothing
 *   L2 commit moves ownership to the new teacher in the same transaction as the
 *      revision and records the transfer in the audit row
 *   L3 a receiver outside the subject's department is refused with zero writes
 *   L4 a time-only change (swap) transfers nothing
 *   L5 the derivation skips cohort entries and unchanged teachers
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { withDataContext } from '../lib/data-context.js';
import {
	createPublishedScheduleRevision,
	derivePublishedTeachingLoadTransfers,
	previewPublishedScheduleRevision,
} from '../services/published-revision.service.js';
import { POLICY_DEFAULTS } from '../services/scheduling-policy.service.js';
import type { GenerationInputSnapshot } from '../services/generation-input-snapshot.service.js';

const SCHOOL_ID = 51;
const SCHOOL_YEAR_ID = 81;
const RUN_ID = 91;
const BASE_REVISION_ID = 700;
const ACTOR_ID = 41;
const FIXED_NOW = new Date('2030-01-02T03:04:05.000Z');

process.env.JWT_SECRET = 'published-teaching-load-transfer-c05-secret';

type Entry = Record<string, any>;

function slotEntry(entryId: string, overrides: Record<string, any> = {}): Entry {
	return {
		entryId, facultyId: 20, roomId: 30, subjectId: 40, sectionId: 10, day: 'MONDAY',
		startTime: '07:30', endTime: '08:15', durationMinutes: 45, termIndex: 1, ...overrides,
	};
}

const snapshot: GenerationInputSnapshot = (() => {
	const domain = (fp: string) => ({ fingerprint: fp, signals: {} });
	return {
		schemaVersion: 3, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, computedAt: FIXED_NOW.toISOString(), fingerprint: 'fp',
		domains: {
			teachingLoad: domain('t'), policy: domain('p'), rooms: domain('r'), sections: domain('s'),
			subjects: domain('sb'), derivedDemand: domain('d'), availability: domain('a'),
		},
	} as GenerationInputSnapshot;
})();

function makeFixture() {
	const entries: Entry[] = [
		slotEntry('e-1'),
		slotEntry('e-2', { facultyId: 21, roomId: 31, subjectId: 41, sectionId: 11, startTime: '08:15', endTime: '09:00' }),
	];
	const facultyRows = [
		{ id: 20, firstName: 'Leaving', lastName: 'Teacher', department: 'SCIENCE', specialization: null, canTeachOutsideDepartment: false, isActiveForScheduling: true, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 },
		{ id: 21, firstName: 'Other', lastName: 'Teacher', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isActiveForScheduling: true, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 },
		{ id: 22, firstName: 'Science', lastName: 'Replacement', department: 'SCIENCE', specialization: null, canTeachOutsideDepartment: false, isActiveForScheduling: true, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 },
		{ id: 23, firstName: 'Math', lastName: 'Outsider', department: 'MATH', specialization: null, canTeachOutsideDepartment: false, isActiveForScheduling: true, maxHoursPerWeek: 40, ancillaryMinutesPerWeek: 0 },
	];
	const subjectRows = [
		{ id: 40, code: 'SCI_BIO', name: 'Science - Biology', ownerDepartment: 'SCIENCE', allowedSpecializations: [], requiredFeatures: [], programScopes: ['REGULAR'], minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
		{ id: 41, code: 'MATH7', name: 'Mathematics', ownerDepartment: 'MATH', allowedSpecializations: [], requiredFeatures: [], programScopes: ['REGULAR'], minMinutesPerWeek: 45, preferredRoomType: 'CLASSROOM', gradeLevels: [7] },
	];
	const state = {
		revisions: [] as any[],
		audits: [] as any[],
		facultySubjects: [
			{ id: 1, facultyId: 20, subjectId: 40, schoolYearId: SCHOOL_YEAR_ID, sectionIds: [10], gradeLevels: [7] },
			{ id: 2, facultyId: 21, subjectId: 41, schoolYearId: SCHOOL_YEAR_ID, sectionIds: [11], gradeLevels: [7] },
		] as any[],
		ownerships: [
			{ facultySubjectId: 1, facultyId: 20, subjectId: 40, sectionId: 10 },
			{ facultySubjectId: 2, facultyId: 21, subjectId: 41, sectionId: 11 },
		] as any[],
		versionBumps: [] as number[][],
		cycleRefreshes: 0,
		nextId: 900,
	};
	const zeroAggregate = () => async () => ({ _count: { _all: 0 }, _max: { id: null, updatedAt: null, createdAt: null } });
	const baseEffectiveDate = new Date('2030-01-01T00:00:00.000Z');
	const tx: any = {
		$executeRawUnsafe: async () => 1,
		$queryRawUnsafe: async (_query: string, ...params: unknown[]) => {
			const ids = (params[1] ?? entries.map((entry) => entry.entryId)) as string[];
			return entries.filter((entry) => ids.includes(entry.entryId)).map((entry) => ({ entryId: entry.entryId, entry }));
		},
		enrollProSchoolYearMirror: {
			findMany: async () => [{ enrollProSchoolYearId: SCHOOL_YEAR_ID }],
			findUnique: async ({ where }: any) => {
				const key = where?.schoolId_enrollProSchoolYearId ?? {};
				return {
					isActive: true, isArchived: false, termContractCachedAt: new Date(),
					termContractCache: {
						schoolId: key.schoolId, schoolYear: { id: key.enrollProSchoolYearId, yearLabel: '2030-2031' }, format: 'TRIMESTER',
						terms: [{ identity: 'T1', displayLabel: 'T1', order: 1 }, { identity: 'T2', displayLabel: 'T2', order: 2 }, { identity: 'T3', displayLabel: 'T3', order: 3 }],
						activeTerm: { order: 1 },
					},
				};
			},
		},
		schoolYearTermConfig: { findUnique: async () => ({ termCount: 3, termIdentities: ['T1', 'T2', 'T3'], isActive: true }) },
		generationRun: {
			findFirst: async () => ({
				id: RUN_ID, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, status: 'COMPLETED', runType: 'FULL', version: 5,
				summary: { isPublished: true, publishedAt: FIXED_NOW.toISOString(), publication: { revisionId: BASE_REVISION_ID, sourceRunVersion: 5 } },
				draftEntries: entries,
			}),
		},
		publishedScheduleRevision: {
			findFirst: async ({ where }: any) => {
				if (where.id === BASE_REVISION_ID) {
					return { id: BASE_REVISION_ID, effectiveDate: baseEffectiveDate, sourceRevisionId: null, reason: 'INITIAL_PUBLICATION', metadata: { publicationBase: true, sourceRunVersion: 5 } };
				}
				return state.revisions.find((row) => (where.id ? row.id === where.id : row.metadata?.idempotencyKey === where.metadata?.equals)) ?? null;
			},
			findMany: async () => [{ id: BASE_REVISION_ID, effectiveDate: baseEffectiveDate, changeSet: [] }],
			create: async ({ data }: any) => { const row = { id: state.nextId++, ...data }; state.revisions.push(row); return row; },
		},
		auditLog: {
			findFirst: async () => null,
			create: async ({ data }: any) => { const row = { id: state.nextId++, ...data }; state.audits.push(row); return row; },
		},
		facultyMirror: {
			findMany: async ({ where }: any = {}) => (where?.id?.in ? facultyRows.filter((row) => where.id.in.includes(row.id)) : facultyRows),
			updateMany: async ({ where }: any) => { state.versionBumps.push([...where.id.in]); return { count: where.id.in.length }; },
			aggregate: zeroAggregate(),
		},
		facultySubject: {
			findMany: async () => state.facultySubjects.map((row) => ({ ...row })),
			findUnique: async ({ where }: any) => {
				const key = where.facultyId_subjectId_schoolYearId;
				return state.facultySubjects.find((row) => row.facultyId === key.facultyId && row.subjectId === key.subjectId) ?? null;
			},
			create: async ({ data }: any) => { const row = { id: state.nextId++, ...data }; state.facultySubjects.push(row); return row; },
			update: async ({ where, data }: any) => { const row = state.facultySubjects.find((r) => r.id === where.id); Object.assign(row, data); return row; },
			delete: async ({ where }: any) => { state.facultySubjects = state.facultySubjects.filter((r) => r.id !== where.id); return {}; },
			aggregate: zeroAggregate(),
		},
		subjectSectionOwnership: {
			findUnique: async ({ where }: any) => {
				const key = where.schoolId_schoolYearId_subjectId_sectionId;
				return state.ownerships.find((row) => row.subjectId === key.subjectId && row.sectionId === key.sectionId) ?? null;
			},
			findMany: async ({ where }: any) => state.ownerships.filter((row) => row.facultyId === where.facultyId && row.subjectId === where.subjectId),
			upsert: async ({ where, update, create }: any) => {
				const key = where.schoolId_schoolYearId_subjectId_sectionId;
				const row = state.ownerships.find((r) => r.subjectId === key.subjectId && r.sectionId === key.sectionId);
				if (row) Object.assign(row, update); else state.ownerships.push({ ...create });
				return {};
			},
			count: async () => state.ownerships.length,
			aggregate: zeroAggregate(),
		},
		teachingLoadCycle: {
			findUnique: async () => null,
			upsert: async () => { state.cycleRefreshes += 1; return {}; },
		},
		departmentAlias: { findMany: async () => [] },
		departmentLabel: { findMany: async () => [] },
		subjectOwnerPrefix: { findMany: async () => [] },
		crossDepartmentPermission: { findMany: async () => [] },
		specializationAlias: { findMany: async () => [] },
		room: { findMany: async () => [30, 31].map((id) => ({ id, type: 'CLASSROOM', capacity: 40, isTeachingSpace: true, isSharedFacility: false, features: [], floor: 1, buildingId: 1, name: `Room ${id}`, building: { gradeScope: null, name: 'Main', shortCode: 'M' } })), aggregate: zeroAggregate() },
		subject: { findMany: async ({ where }: any = {}) => (where?.id?.in ? subjectRows.filter((row) => where.id.in.includes(row.id)) : subjectRows), aggregate: zeroAggregate() },
		schedulingPolicy: { findUnique: async () => ({ id: 1, schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, ...POLICY_DEFAULTS, createdAt: FIXED_NOW, updatedAt: FIXED_NOW }) },
		building: { findMany: async () => [{ id: 1, x: 0, y: 0 }], aggregate: zeroAggregate() },
		sectionSnapshot: {
			findUnique: async () => ({ payload: [{ gradeLevelId: 7, gradeLevelName: 'Grade 7', displayOrder: 7, sections: [{ id: 10, name: 'S10', enrolledCount: 30 }, { id: 11, name: 'S11', enrolledCount: 30 }] }] }),
		},
		sectionMirror: { findMany: async () => [], aggregate: zeroAggregate() },
		policySpecialEvent: { findMany: async () => [] },
		gradeShiftWindow: { findMany: async () => [] },
		classProgramSlot: { findMany: async () => [] },
	};
	const client: any = {
		...tx,
		$transaction: async (work: any) => {
			const backup = structuredClone({ revisions: state.revisions, audits: state.audits, facultySubjects: state.facultySubjects, ownerships: state.ownerships });
			try {
				return await work(tx);
			} catch (error) {
				Object.assign(state, backup);
				throw error;
			}
		},
	};
	return { client, state, options: { now: FIXED_NOW, computeInputSnapshot: async () => snapshot } };
}

const baseInput = {
	schoolId: SCHOOL_ID,
	schoolYearId: SCHOOL_YEAR_ID,
	sourceRunId: RUN_ID,
	sourceRevisionId: BASE_REVISION_ID,
	actorId: ACTOR_ID,
	effectiveDate: '2030-01-03T00:00:00.000Z',
	reason: 'Teacher leaving',
};
const reassignToScience = { entryId: 'e-1', previous: { facultyId: 20 }, next: { facultyId: 22 } };

test('L1: preview validates against the Teaching Load the change implies and writes nothing', async () => {
	const fixture = makeFixture();
	const preview = await withDataContext(fixture.client, () => previewPublishedScheduleRevision({ ...baseInput, changes: [reassignToScience] }, fixture.options));
	assert.equal(preview.blockingHardViolationCount, 0, 'no FACULTY_SUBJECT_NOT_QUALIFIED for the replacement');
	assert.deepEqual(preview.clashes, []);
	assert.equal(fixture.state.revisions.length + fixture.state.audits.length, 0);
	assert.equal(fixture.state.ownerships.find((row) => row.subjectId === 40)?.facultyId, 20, 'preview moves no ownership');
});

test('L2: commit moves ownership with the revision and records the transfer', async () => {
	const fixture = makeFixture();
	const result = await withDataContext(fixture.client, () => createPublishedScheduleRevision({ ...baseInput, changes: [reassignToScience] }, fixture.options));
	assert.equal(result.replayed, false);
	assert.equal(fixture.state.revisions.length, 1);
	assert.equal(fixture.state.ownerships.find((row) => row.subjectId === 40 && row.sectionId === 10)?.facultyId, 22, 'section 10 subject 40 is owned by the replacement');
	const replacementRow = fixture.state.facultySubjects.find((row) => row.facultyId === 22 && row.subjectId === 40);
	assert.deepEqual(replacementRow?.sectionIds, [10], 'replacement Teaching Load row carries the section');
	assert.equal(fixture.state.facultySubjects.some((row) => row.facultyId === 20 && row.subjectId === 40), false, 'the leaving teacher no longer holds the empty row');
	assert.deepEqual(fixture.state.audits[0]?.metadata?.teachingLoadTransfers, [{ subjectId: 40, sectionId: 10, fromFacultyId: 20, toFacultyId: 22 }]);
	assert.deepEqual(fixture.state.versionBumps, [[20, 22]], 'both teachers\' versions advance');
	assert.equal(fixture.state.cycleRefreshes, 1, 'Teaching Load cycle refreshed after commit');
});

test('L3: a receiver outside the subject department is refused with zero writes', async () => {
	const fixture = makeFixture();
	await assert.rejects(
		() => withDataContext(fixture.client, () => createPublishedScheduleRevision({ ...baseInput, changes: [{ entryId: 'e-1', previous: { facultyId: 20 }, next: { facultyId: 23 } }] }, fixture.options)),
		(error: any) => error?.code === 'TEACHING_LOAD_QUALIFICATION_MISSING' && /not set up to teach/.test(error.message),
	);
	assert.equal(fixture.state.revisions.length + fixture.state.audits.length, 0);
	assert.equal(fixture.state.ownerships.find((row) => row.subjectId === 40)?.facultyId, 20);
});

test('L4: a time-only change transfers nothing', async () => {
	const fixture = makeFixture();
	await withDataContext(fixture.client, () => createPublishedScheduleRevision(
		{ ...baseInput, changes: [{ entryId: 'e-1', previous: { day: 'MONDAY' }, next: { day: 'TUESDAY' } }] },
		fixture.options,
	));
	assert.deepEqual(fixture.state.audits[0]?.metadata?.teachingLoadTransfers, []);
	assert.equal(fixture.state.ownerships.find((row) => row.subjectId === 40)?.facultyId, 20);
	assert.deepEqual(fixture.state.versionBumps, []);
});

test('L5: derivation skips cohort entries and unchanged teachers, and de-duplicates terms', () => {
	const effective = new Map<string, Record<string, unknown>>([
		['a::t2', { facultyId: 20, subjectId: 40, sectionId: 10 }],
		['a::t3', { facultyId: 20, subjectId: 40, sectionId: 10 }],
		['c', { facultyId: 20, subjectId: 40, sectionId: 12, entryKind: 'COHORT' }],
		['same', { facultyId: 22, subjectId: 40, sectionId: 13 }],
	]);
	const transfers = derivePublishedTeachingLoadTransfers([
		{ entryId: 'a::t2', previous: { facultyId: 20 }, next: { facultyId: 22 } },
		{ entryId: 'a::t3', previous: { facultyId: 20 }, next: { facultyId: 22 } },
		{ entryId: 'c', previous: { facultyId: 20 }, next: { facultyId: 22 } },
		{ entryId: 'same', previous: { facultyId: 22 }, next: { facultyId: 22 } },
	], effective);
	assert.deepEqual(transfers, [{ subjectId: 40, sectionId: 10, fromFacultyId: 20, toFacultyId: 22 }]);
});
