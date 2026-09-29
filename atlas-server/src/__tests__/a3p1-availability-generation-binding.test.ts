/**
 * A3 p1 — READ-ONLY SERVER EVIDENCE. Generation consumes REVIEWED availability.
 *
 * WHY THIS FILE EXISTS
 * ====================
 * Teacher Preferences tells a scheduler that saving will change the next
 * timetable, and the client's save receipt now says so in words. That claim is
 * only true because of two server facts, and on 2026-09-29 nothing proved
 * either one end to end:
 *
 *   1. `loadReviewedAvailabilityForTerm` reads ONLY `status: 'REVIEWED'` rows
 *      (faculty-availability.service.ts:346). A DRAFT or SUBMITTED record — what
 *      a teacher has if the bind half of Save failed — contributes nothing.
 *   2. An `UNAVAILABLE` slot on such a row is normalised into the scheduler's
 *      `preference` vocabulary and carried into the real constructor input, so
 *      the HARD exclusion reaches the scheduler (generation-preflight.service.ts
 *      :1399).
 *
 * The existing `generation-authority-realism-c07-availability.test.ts` row
 * proves only that a REVIEWED+UNAVAILABLE row CHANGES THE FINGERPRINT, which
 * shows the row was read into the input snapshot but not that the exclusion is
 * what the scheduler is given. This file closes that gap.
 *
 * READ-ONLY BY CONSTRUCTION
 * =========================
 * No production server file is edited. Both seams are exported and injectable:
 *   · `loadReviewedAvailabilityForTerm(schoolId, yearId, termIndex, client)`
 *     takes the Prisma client as an argument, so a FAKE client is used. The fake
 *     HONOURS the `where` clause it is handed, which is what makes row 1
 *     discriminating: drop `status: 'REVIEWED'` from production and the seeded
 *     DRAFT and SUBMITTED rows start coming back, and the assertion fails.
 *   · `buildPreflightConstructorInput(assembly)` is a pure exported mapper.
 *
 * No database, no network, no runtime, no migration, no generation run.
 *
 * Run: `npm --prefix atlas-server run test:faculty-availability`
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadReviewedAvailabilityForTerm } from '../services/faculty-availability.service.js';
import { buildPreflightConstructorInput } from '../services/generation-preflight.service.js';
import type { GenerationPreflightAssembly } from '../services/generation-preflight.service.js';

const SCHOOL_ID = 1;
const SCHOOL_YEAR_ID = 2;
const TERM_INDEX = 1;

/** A stored availability row exactly as the Prisma `include` returns it. */
type StoredRow = {
	schoolId: number;
	schoolYearId: number;
	termIndex: number;
	facultyId: number;
	status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
	slots: Array<{ day: string; startTime: string; endTime: string; state: string }>;
};

const ROWS: StoredRow[] = [
	// The teacher's real record: reviewed, with one hard exclusion and one soft
	// preference. This is the row generation must consume.
	{
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		termIndex: TERM_INDEX,
		facultyId: 7,
		status: 'REVIEWED',
		slots: [
			{ day: 'MONDAY', startTime: '07:00', endTime: '08:00', state: 'UNAVAILABLE' },
			{ day: 'TUESDAY', startTime: '09:00', endTime: '10:00', state: 'PREFERRED' },
		],
	},
	// The same teacher mid-save, and a neighbour who was returned for correction.
	// None of these may influence the timetable.
	{
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, termIndex: TERM_INDEX, facultyId: 7, status: 'DRAFT',
		slots: [{ day: 'WEDNESDAY', startTime: '10:00', endTime: '11:00', state: 'UNAVAILABLE' }],
	},
	{
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, termIndex: TERM_INDEX, facultyId: 7, status: 'SUBMITTED',
		slots: [{ day: 'THURSDAY', startTime: '11:00', endTime: '12:00', state: 'UNAVAILABLE' }],
	},
	{
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, termIndex: TERM_INDEX, facultyId: 8, status: 'REJECTED',
		slots: [{ day: 'FRIDAY', startTime: '13:00', endTime: '14:00', state: 'UNAVAILABLE' }],
	},
	// Another term entirely, and another year. Neither may leak in either.
	{
		schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, termIndex: 2, facultyId: 7, status: 'REVIEWED',
		slots: [{ day: 'FRIDAY', startTime: '15:00', endTime: '16:00', state: 'UNAVAILABLE' }],
	},
	{
		schoolId: SCHOOL_ID, schoolYearId: 99, termIndex: TERM_INDEX, facultyId: 7, status: 'REVIEWED',
		slots: [{ day: 'FRIDAY', startTime: '15:30', endTime: '16:30', state: 'UNAVAILABLE' }],
	},
];

type RecordedQuery = { where: Record<string, unknown> };
const queries: RecordedQuery[] = [];

/**
 * A fake Prisma client that HONOURS the `where` clause, which is what makes
 * these rows discriminating rather than a tautology: if production stopped
 * filtering on `status`, the DRAFT/SUBMITTED/REJECTED rows would be returned and
 * the assertions below would fail.
 */
const fakeClient = {
	facultyAvailability: {
		findMany: async (args: { where: Record<string, unknown> }) => {
			queries.push({ where: args.where });
			return ROWS.filter(
				(row) =>
					row.facultyId !== undefined
					&& Object.entries(args.where).every(([key, value]) => {
						if (key === 'slots') return true;
						return (row as unknown as Record<string, unknown>)[key] === value;
					}),
			);
		},
	},
};

// ═══ 1 — the generation read is REVIEWED-only ═══════════════════════════════

test('A3P1-S1 the generation read asks for status REVIEWED and nothing else', async () => {
	queries.length = 0;
	await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, TERM_INDEX, fakeClient);

	assert.equal(queries.length, 1, 'exactly one availability read is issued');
	assert.equal(queries[0]?.where.status, 'REVIEWED', 'the read filters on status REVIEWED');
	assert.equal(queries[0]?.where.schoolId, SCHOOL_ID, 'the read is school-scoped');
	assert.equal(queries[0]?.where.schoolYearId, SCHOOL_YEAR_ID, 'the read is year-scoped');
	assert.equal(queries[0]?.where.termIndex, TERM_INDEX, 'the read is term-scoped');
});

test('A3P1-S2 only the REVIEWED row for THIS school, year and term is returned', async () => {
	const read = await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, TERM_INDEX, fakeClient);

	assert.equal(read.ok, true, 'the term is resolved, so the read succeeds');
	assert.equal(read.termIndex, TERM_INDEX, 'the read is for the resolved term');
	assert.deepEqual(
		read.preferences.map((p) => p.facultyId),
		[7],
		'exactly the one REVIEWED faculty in this school/year/term is carried; DRAFT, SUBMITTED, REJECTED, another term and another year are all excluded',
	);
});

test('A3P1-S3 the REVIEWED Unavailable slot is normalised into the scheduler preference vocabulary', async () => {
	const read = await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, TERM_INDEX, fakeClient);
	const slots = read.preferences[0]?.timeSlots ?? [];

	assert.deepEqual(
		slots.map((slot) => slot.preference).sort(),
		['PREFERRED', 'UNAVAILABLE'],
		'the hard UNAVAILABLE exclusion and the soft PREFERRED signal are both carried verbatim',
	);
	assert.equal(
		slots.find((slot) => slot.preference === 'UNAVAILABLE')?.day,
		'MONDAY',
		'the hard exclusion is the real Monday 07:00-08:00 slot the teacher marked',
	);
	// And the excluded statuses contributed nothing at all.
	assert.equal(
		slots.some((slot) => slot.day === 'WEDNESDAY' || slot.day === 'THURSDAY' || slot.day === 'FRIDAY'),
		false,
		'no slot from a DRAFT, SUBMITTED or REJECTED record reaches generation',
	);
});

test('A3P1-S4 an unresolved term returns zero rows and fails closed rather than defaulting to Term 1', async () => {
	const read = await loadReviewedAvailabilityForTerm(SCHOOL_ID, SCHOOL_YEAR_ID, null, fakeClient);
	assert.equal(read.ok, false, 'an unresolved term is not a usable read');
	assert.equal(read.code, 'TERM_AUTHORITY_UNRESOLVED', 'the typed code is preserved');
	assert.deepEqual(read.preferences, [], 'zero rows — generation must not assume Term 1');
});

// ═══ 2 — the exclusion reaches the real constructor input ════════════════════

test('A3P1-S5 the reviewed exclusion is carried into the scheduler constructor input verbatim', () => {
	// The exact shape `loadReviewedAvailabilityForTerm` produced in S3, put on
	// the assembly the preflight binds, so this row proves the mapping rather
	// than re-deriving the read.
	const read = {
		ok: true,
		code: 'READY' as const,
		termIndex: TERM_INDEX,
		preferences: [
			{
				facultyId: 7,
				status: 'SUBMITTED' as const,
				timeSlots: [
					{ day: 'MONDAY', startTime: '07:00', endTime: '08:00', preference: 'UNAVAILABLE' },
					{ day: 'TUESDAY', startTime: '09:00', endTime: '10:00', preference: 'PREFERRED' },
				],
			},
		],
	};

	const input = buildPreflightConstructorInput({
		derived: { sections: [] },
		scope: { schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID },
		preferences: read.preferences,
		faculty: [],
		facultySubjects: [],
		roomsWithGradeScope: [],
		schedulableSubjects: [],
		cohorts: [],
		sectionsByGrade: [],
		policy: { periodLengthMinutes: 45, periodsPerDay: 8 },
		policyRow: {},
		retained: { lockedEntries: [] },
		specialEvents: [],
		gradeWindows: [],
		buildings: [],
		classTemplatePeriods: [],
		timetableShapeContracts: [],
		demand: [],
		pairOwners: [],
	} as unknown as GenerationPreflightAssembly);

	const faculty7 = input.preferences.find((p) => p.facultyId === 7);
	assert.notEqual(faculty7, undefined, 'the reviewed faculty reaches the scheduler input');
	assert.deepEqual(
		faculty7?.timeSlots,
		read.preferences[0]?.timeSlots,
		'the HARD UNAVAILABLE exclusion and the PREFERRED soft signal reach the scheduler unchanged',
	);
	assert.equal(
		faculty7?.timeSlots.some((slot) => slot.preference === 'UNAVAILABLE'),
		true,
		'the scheduler is given the teacher\'s real hard exclusion',
	);
});
