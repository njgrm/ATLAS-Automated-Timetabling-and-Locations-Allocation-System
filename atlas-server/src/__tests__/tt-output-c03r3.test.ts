/**
 * TT-OUTPUT-C03R3 — complete per-term schedule resolution.
 *
 * Run: `npx tsx src/__tests__/tt-output-c03r3.test.ts`
 *
 * Failing-first production-path proof. It builds REAL canonical derived demand
 * with three ordered terms (MATH applicable to T1/T2/T3 and a Science rotation
 * BIO/CHEM/ES), runs the REAL scheduler over the derived projection, and then
 * resolves explicit per-term entries. Against the base behavior the pipeline
 * collapsed every year-long session into Term 1 and distributed the rotating
 * lane's weekly sessions as 2/2/1, so every per-term assertion below fails.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	deriveCanonicalDemand,
	toSchedulerDemandOverride,
	type DerivedDemandInput,
	type DerivedDemandSuccess,
	type DerivedSubjectInput,
} from '../services/derived-demand.service.js';
import {
	constructBaseline,
	type ConstructorInput,
	type SubjectInput,
} from '../services/schedule-constructor.js';
import type { SectionsByGrade } from '../services/section-adapter.js';
import {
	assertNoImplicitTermDefault,
	assertResolvedPerTermParity,
	resolvePerTermScheduleEntries,
	resolvePerTermUnassignedItems,
	type CanonicalTermSessionLine,
	type OrderedTermRef,
	type ResolvedPerTermEntry,
} from '../services/per-term-schedule-resolution.service.js';
import { validateHardConstraints, type ValidatorContext } from '../services/constraint-validator.js';
import { loadExportContext } from '../services/workbook-export.service.js';

const SCHOOL_ID = 41;
const SCHOOL_YEAR_ID = 8;
const PERIOD_LENGTH = 45;
const SECTION_ID = 9001;

const TERMS: OrderedTermRef[] = [
	{ identity: 'T1', order: 1, displayLabel: 'First Term' },
	{ identity: 'T2', order: 2, displayLabel: 'Second Term' },
	{ identity: 'T3', order: 3, displayLabel: 'Third Term' },
];

const MATH_ID = 11;
const BIO_ID = 13;
const CHEM_ID = 14;
const ES_ID = 15;
const MATH_TEACHER = 70;
const BIO_TEACHER = 71;
const CHEM_TEACHER = 72;
const ES_TEACHER = 73;

function derivedSubjects(): DerivedSubjectInput[] {
	const base = (overrides: Partial<DerivedSubjectInput> & Pick<DerivedSubjectInput, 'id' | 'code'>): DerivedSubjectInput => ({
		name: overrides.code,
		schedulingDisposition: 'SCHEDULED_TEACHING',
		gradeLevels: [7],
		programScopes: ['REGULAR'],
		rotationFamily: null,
		modularOrder: null,
		minMinutesPerWeek: 225,
		isActive: true,
		preferredRoomType: 'CLASSROOM',
		requiredFeatures: [],
		...overrides,
	});
	return [
		base({ id: MATH_ID, code: 'MATH', minMinutesPerWeek: 225, preferredRoomType: 'CLASSROOM', requiredFeatures: [] }),
		base({ id: BIO_ID, code: 'SCI_BIO', rotationFamily: 'SCIENCE', modularOrder: 1, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] }),
		base({ id: CHEM_ID, code: 'SCI_CHEM', rotationFamily: 'SCIENCE', modularOrder: 2, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] }),
		base({ id: ES_ID, code: 'SCI_ES', rotationFamily: 'SCIENCE', modularOrder: 3, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] }),
	];
}

function derivedInput(): DerivedDemandInput {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		yearLabel: '2029-2030',
		termFormat: 'TRIMESTER',
		termStructureRevision: 'A'.repeat(64),
		terms: TERMS.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel ?? term.identity, order: term.order })),
		sections: [{ sectionMirrorId: 501, externalId: SECTION_ID, gradeLevel: 7, programType: 'REGULAR', isActiveForScheduling: true, isStale: false }],
		subjects: derivedSubjects(),
		periodLengthMinutes: PERIOD_LENGTH,
	};
}

function sectionsByGrade(): SectionsByGrade[] {
	return [{
		gradeLevelId: 17,
		gradeLevelName: 'Grade 7',
		displayOrder: 7,
		sections: [{ mirrorId: 501, id: SECTION_ID, name: '7-A', maxCapacity: 50, enrolledCount: 40, gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, programType: 'REGULAR' }],
	}];
}

function subjectInputs(): SubjectInput[] {
	return derivedSubjects().map((subject) => ({
		id: subject.id,
		code: subject.code,
		name: subject.name,
		minMinutesPerWeek: subject.minMinutesPerWeek,
		preferredRoomType: subject.preferredRoomType as SubjectInput['preferredRoomType'],
		gradeLevels: subject.gradeLevels,
		programScopes: subject.programScopes,
		rotationFamily: subject.rotationFamily,
		modularOrder: subject.modularOrder,
		requiredFeatures: subject.requiredFeatures,
		modularGroupId: subject.rotationFamily,
	} as SubjectInput));
}

function constructorInput(derived: DerivedDemandSuccess): ConstructorInput {
	const subjects = subjectInputs();
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		sectionsByGrade: sectionsByGrade(),
		subjects,
		faculty: [
			{ id: MATH_TEACHER, maxHoursPerWeek: 40 },
			{ id: BIO_TEACHER, maxHoursPerWeek: 40 },
			{ id: CHEM_TEACHER, maxHoursPerWeek: 40 },
			{ id: ES_TEACHER, maxHoursPerWeek: 40 },
		],
		facultySubjects: [
			{ facultyId: MATH_TEACHER, subjectId: MATH_ID, gradeLevels: [7], sectionIds: [SECTION_ID] },
			{ facultyId: BIO_TEACHER, subjectId: BIO_ID, gradeLevels: [7], sectionIds: [SECTION_ID] },
			{ facultyId: CHEM_TEACHER, subjectId: CHEM_ID, gradeLevels: [7], sectionIds: [SECTION_ID] },
			{ facultyId: ES_TEACHER, subjectId: ES_ID, gradeLevels: [7], sectionIds: [SECTION_ID] },
		],
		rooms: [
			{ id: 601, type: 'CLASSROOM', isTeachingSpace: true, capacity: 50 },
			{ id: 701, type: 'LABORATORY', isTeachingSpace: true, capacity: 50, features: ['SINK'] },
		],
		preferences: [],
		policy: {
			periodLengthMinutes: PERIOD_LENGTH,
			earliestStartTime: '06:00',
			latestEndTime: '18:30',
			maxConsecutiveTeachingMinutesBeforeBreak: 200,
			minBreakMinutesAfterConsecutiveBlock: 15,
			maxTeachingMinutesPerDay: 480,
			specialEvents: [],
		},
		classTemplatePeriods: { REGULAR: PERIOD_LENGTH },
		demandOverride: toSchedulerDemandOverride(derived, sectionsByGrade(), subjects),
		pairOwners: {
			[`${MATH_ID}:${SECTION_ID}`]: MATH_TEACHER,
			[`${BIO_ID}:${SECTION_ID}`]: BIO_TEACHER,
			[`${CHEM_ID}:${SECTION_ID}`]: CHEM_TEACHER,
			[`${ES_ID}:${SECTION_ID}`]: ES_TEACHER,
		},
	};
}

/** Run the real derived-demand projection and the real scheduler. */
function runRealPipeline() {
	const derived = deriveCanonicalDemand(derivedInput());
	assert.equal(derived.ok, true, 'canonical derived demand must be available');
	if (!derived.ok) throw new Error('unreachable');
	const schedulerResult = constructBaseline(constructorInput(derived));
	const subjectIdByCode = new Map(subjectInputs().map((subject) => [subject.code, subject.id]));
	const resolved = resolvePerTermScheduleEntries(schedulerResult.entries, TERMS, { subjectIdByCode });
	return { derived, schedulerResult, resolved, subjectIdByCode };
}

function canonicalSessionLines(derived: DerivedDemandSuccess): CanonicalTermSessionLine[] {
	return derived.timetableLines.map((line) => ({
		subjectId: line.subjectId,
		sectionId: line.sectionExternalId,
		termIndex: line.termIndex,
		sessionsPerWeek: line.sessionsPerWeek,
	}));
}

function countBy(resolved: readonly ResolvedPerTermEntry[], predicate: (entry: ResolvedPerTermEntry) => boolean): number {
	return resolved.filter(predicate).length;
}

// ─── Core acceptance ─────────────────────────────────────────────────────────

test('C03R3: each ordered term carries the full MATH weekly schedule, not a fraction', () => {
	const { resolved } = runRealPipeline();
	for (const term of TERMS) {
		assert.equal(
			countBy(resolved, (entry) => entry.subjectId === MATH_ID && entry.termIndex === term.order),
			5,
			`MATH must contribute 5 weekly sessions in ${term.identity}`,
		);
	}
});

test('C03R3: the Science rotation contributes its full weekly schedule in every term (no 2/2/1 split)', () => {
	const { resolved } = runRealPipeline();
	const expectedMemberByTerm: Record<number, number> = { 1: BIO_ID, 2: CHEM_ID, 3: ES_ID };
	for (const term of TERMS) {
		assert.equal(
			countBy(resolved, (entry) => entry.subjectId === expectedMemberByTerm[term.order] && entry.termIndex === term.order),
			5,
			`${term.identity} must carry 5 sessions of its own rotation member`,
		);
	}
});

test('C03R3: BIO/CHEM/ES and their teachers appear ONLY in their assigned term', () => {
	const { resolved } = runRealPipeline();
	const expectations: Array<{ subjectId: number; teacherId: number; term: number }> = [
		{ subjectId: BIO_ID, teacherId: BIO_TEACHER, term: 1 },
		{ subjectId: CHEM_ID, teacherId: CHEM_TEACHER, term: 2 },
		{ subjectId: ES_ID, teacherId: ES_TEACHER, term: 3 },
	];
	for (const expectation of expectations) {
		for (const entry of resolved) {
			if (entry.subjectId !== expectation.subjectId) continue;
			assert.equal(entry.termIndex, expectation.term, `subject ${expectation.subjectId} must only run in its own term`);
			assert.equal(entry.facultyId, expectation.teacherId, `subject ${expectation.subjectId} must keep its own teacher`);
			assert.equal(entry.roomId, 701, `subject ${expectation.subjectId} must keep its laboratory room`);
		}
	}
});

test('C03R3: total resolved session count equals the canonical derived-demand session total', () => {
	const { derived, resolved } = runRealPipeline();
	const canonical = canonicalSessionLines(derived);
	const canonicalTotal = canonical.reduce((total, line) => total + line.sessionsPerWeek, 0);
	assert.equal(canonicalTotal, 30, 'MATH 5×3 + Science 5×3');
	assert.equal(resolved.length, canonicalTotal, 'every canonical session must resolve exactly once');
	assertResolvedPerTermParity(resolved, canonical);
});

test('C03R3: a base slot keeps a stable source identity while every term entry has a unique id', () => {
	const { resolved } = runRealPipeline();
	const ids = new Set(resolved.map((entry) => entry.entryId));
	assert.equal(ids.size, resolved.length, 'every resolved entry id is unique');
	const sources = new Set(resolved.map((entry) => entry.sourceEntryId));
	assert.ok(sources.size > 0);
	for (const source of sources) {
		const group = resolved.filter((entry) => entry.sourceEntryId === source);
		assert.equal(group.length, 3, `source slot ${source} must link exactly one entry per ordered term`);
		assert.deepEqual([...new Set(group.map((entry) => entry.termIndex))].sort(), [1, 2, 3]);
	}
});

test('C03R3: no missing term identity is coerced to Term 1', () => {
	const { resolved } = runRealPipeline();
	for (const entry of resolved) {
		assert.ok([1, 2, 3].includes(entry.termIndex), `resolved entry ${entry.entryId} must carry an explicit term`);
	}
	const baseWithoutTerm = [{ entryId: 'b1', termIndex: undefined }];
	assertNoImplicitTermDefault(baseWithoutTerm, resolved, TERMS);
});

// ─── Conflict identity ───────────────────────────────────────────────────────

function validatorContext(entries: ResolvedPerTermEntry[]): ValidatorContext {
	return {
		schoolId: SCHOOL_ID,
		schoolYearId: SCHOOL_YEAR_ID,
		runId: 1,
		entries,
		faculty: [
			{ id: MATH_TEACHER, maxHoursPerWeek: 40 },
			{ id: BIO_TEACHER, maxHoursPerWeek: 40 },
			{ id: CHEM_TEACHER, maxHoursPerWeek: 40 },
			{ id: ES_TEACHER, maxHoursPerWeek: 40 },
		],
		facultySubjects: [
			{ facultyId: MATH_TEACHER, subjectId: MATH_ID, sectionIds: [SECTION_ID] },
			{ facultyId: BIO_TEACHER, subjectId: BIO_ID, sectionIds: [SECTION_ID] },
			{ facultyId: CHEM_TEACHER, subjectId: CHEM_ID, sectionIds: [SECTION_ID] },
			{ facultyId: ES_TEACHER, subjectId: ES_ID, sectionIds: [SECTION_ID] },
		],
		rooms: [
			{ id: 601, type: 'CLASSROOM', capacity: 50 },
			{ id: 701, type: 'LABORATORY', capacity: 50, features: ['SINK'] },
		],
		subjects: [
			{ id: MATH_ID, preferredRoomType: 'CLASSROOM' },
			{ id: BIO_ID, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] },
			{ id: CHEM_ID, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] },
			{ id: ES_ID, preferredRoomType: 'LABORATORY', requiredFeatures: ['SINK'] },
		],
	} as unknown as ValidatorContext;
}

test('C03R3: cross-term overlaps are allowed but a same-term overlap is rejected', () => {
	const { resolved } = runRealPipeline();
	const clean = validateHardConstraints(validatorContext(resolved));
	assert.deepEqual(
		clean.violations.filter((violation) => violation.code === 'ROOM_TIME_CONFLICT' || violation.code === 'SECTION_TIME_CONFLICT'),
		[],
		'the same physical slot repeated across terms must not be a room/section conflict',
	);

	// Inject a genuine same-term double-booking: duplicate a T2 classroom entry
	// into T2 with a new source identity.
	const anchor = resolved.find((entry) => entry.termIndex === 2 && entry.subjectId === MATH_ID)!;
	const intruder: ResolvedPerTermEntry = { ...anchor, entryId: `${anchor.entryId}::mutant`, sourceEntryId: 'mutant-source' };
	const conflicted = validateHardConstraints(validatorContext([...resolved, intruder]));
	const roomConflicts = conflicted.violations.filter((violation) => violation.code === 'ROOM_TIME_CONFLICT');
	const sectionConflicts = conflicted.violations.filter((violation) => violation.code === 'SECTION_TIME_CONFLICT');
	assert.ok(roomConflicts.length >= 1, 'a same-term room overlap must still be rejected');
	assert.ok(sectionConflicts.length >= 1, 'a same-term section overlap must still be rejected');
});

// ─── Unassigned / unresolved rail identity ───────────────────────────────────

test('C03R3: unassigned refusals carry an explicit term for every ordered term', () => {
	const items = [{ sectionId: SECTION_ID, subjectId: MATH_ID, gradeLevel: 7, session: 1, reason: 'NO_AVAILABLE_SLOT' }];
	const resolved = resolvePerTermUnassignedItems(items, TERMS);
	assert.equal(resolved.length, 3, 'a year-long refusal must be actionable in every term');
	assert.deepEqual(resolved.map((item) => item.termIndex).sort(), [1, 2, 3]);
	// A refusal that already carries its own rotation term stays in that term.
	const termScoped = resolvePerTermUnassignedItems([{ ...items[0], termIndex: 2 }], TERMS);
	assert.deepEqual(termScoped.map((item) => item.termIndex), [2]);
});

// ─── Export context parity ───────────────────────────────────────────────────

function exportClient(entries: ResolvedPerTermEntry[]) {
	const client: any = {
		generationRun: {
			findFirst: async (args: any) => (args?.where?.id === 42
				? { id: 42, status: 'COMPLETED', summary: { timetableDisplaySlots: [] }, draftEntries: entries }
				: null),
		},
		school: { findUnique: async () => ({ name: 'ATLAS School' }) },
		enrollProSchoolYearMirror: { findFirst: async () => ({ yearLabel: '2029-2030' }) },
		sectionMirror: { findMany: async () => [{ id: SECTION_ID, externalId: SECTION_ID, name: '7-A', gradeLevelId: 17 }] },
		facultyMirror: {
			findMany: async () => [
				{ id: MATH_TEACHER, lastName: 'Math', firstName: 'M', advisedSectionId: null },
				{ id: BIO_TEACHER, lastName: 'Bio', firstName: 'B', advisedSectionId: null },
				{ id: CHEM_TEACHER, lastName: 'Chem', firstName: 'C', advisedSectionId: null },
				{ id: ES_TEACHER, lastName: 'Es', firstName: 'E', advisedSectionId: null },
			],
		},
		subject: {
			findMany: async () => [
				{ id: MATH_ID, name: 'Mathematics', code: 'MATH' },
				{ id: BIO_ID, name: 'Science Biology', code: 'SCI_BIO' },
				{ id: CHEM_ID, name: 'Science Chemistry', code: 'SCI_CHEM' },
				{ id: ES_ID, name: 'Science Earth Science', code: 'SCI_ES' },
			],
		},
		room: {
			findMany: async () => [
				{ id: 601, name: 'Room 101', type: 'CLASSROOM', floor: 1, building: { id: 1, name: 'Building A' } },
				{ id: 701, name: 'Lab 1', type: 'LABORATORY', floor: 1, building: { id: 1, name: 'Building A' } },
			],
		},
	};
	return client;
}

test('C03R3: the official export context consumes exactly one complete term of resolved entries', async () => {
	const { resolved } = runRealPipeline();
	const client = exportClient(resolved);
	const expectedMemberByTerm: Record<number, number> = { 1: BIO_ID, 2: CHEM_ID, 3: ES_ID };
	for (const term of TERMS) {
		const ctx = await loadExportContext({ schoolId: SCHOOL_ID, schoolYearId: SCHOOL_YEAR_ID, runId: 42, termIndex: term.order, client });
		const entries = ctx.entries as unknown as ResolvedPerTermEntry[];
		assert.equal(entries.length, 10, `${term.identity} export must contain MATH + its own rotation member for 5 sessions each`);
		assert.equal(entries.filter((entry) => entry.subjectId === MATH_ID).length, 5, `${term.identity} export must include the full MATH load`);
		assert.equal(entries.filter((entry) => entry.subjectId === expectedMemberByTerm[term.order]).length, 5, `${term.identity} export must include its own rotation member`);
		for (const entry of entries) {
			assert.ok(entry.subjectId === MATH_ID || entry.subjectId === expectedMemberByTerm[term.order], 'no other term member may leak into this export');
		}
	}
});

// ─── Mutants (must fail under the old behavior) ──────────────────────────────

test('C03R3 mutant (a): the former T1 default drops every later term', () => {
	const { resolved } = runRealPipeline();
	// Old behavior: collapse each year-long entry into Term 1 only.
	const t1Only = resolved.filter((entry) => entry.termIndex === 1 && !entry.fromRotatingFamily);
	assert.notEqual(t1Only.length, 10, 'mutant is distinguishable from a complete per-term schedule');
	assert.throws(
		() => assertResolvedPerTermParity(t1Only, canonicalSessionLines(deriveCanonicalDemand(derivedInput()) as DerivedDemandSuccess)),
		'parity must reject a T1-only schedule',
	);
});

test('C03R3 mutant (b): session cycling (2/2/1) fails the per-term totals', () => {
	const { derived, resolved } = runRealPipeline();
	// Simulate the former cycling: distribute the 5 weekly rotation sessions as
	// 2/2/1 across T1/T2/T3 instead of 5 in each term.
	const cycled: ResolvedPerTermEntry[] = [];
	const rotation = resolved.filter((entry) => entry.fromRotatingFamily);
	for (const entry of resolved.filter((candidate) => !candidate.fromRotatingFamily)) cycled.push(entry);
	const counts = [2, 2, 1];
	let index = 0;
	for (const entry of rotation) {
		const term = Math.min(3, index < 2 ? 1 : index < 4 ? 2 : 3);
		cycled.push({ ...entry, termIndex: term });
		index += 1;
	}
	void counts;
	const cyclingParityFails = (() => {
		try {
			assertResolvedPerTermParity(cycled, canonicalSessionLines(derived));
			return false;
		} catch {
			return true;
		}
	})();
	assert.equal(cyclingParityFails, true, 'the 2/2/1 cycling mutant must fail exact per-term parity');
});

test('C03R3 mutant (c): excluding every-term entries fails the totals', () => {
	const { derived, resolved } = runRealPipeline();
	const withoutEveryTerm = resolved.filter((entry) => entry.fromRotatingFamily);
	assert.throws(
		() => assertResolvedPerTermParity(withoutEveryTerm, canonicalSessionLines(derived)),
		'parity must reject a schedule that drops the year-long subject',
	);
});
