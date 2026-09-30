/**
 * A6 — Teaching Load placement feasibility check, hermetic (no DB).
 *
 * Operator decision 14 (2026-09-30): Teaching Load never saves a load the
 * timetable cannot place. This suite reproduces the live Makabansa shape
 * (Lane C -> A8, 2026-09-30 09:40 +08, run 355, year 5) against the PURE
 * evaluator so the verdict, the truthful reason vocabulary, the teacher-blocked
 * distinction and the "teacher who fits" alternative are proven before any
 * database is involved.
 *
 * Live case: section 87 Grade 8 Makabansa, subject TLE Exploratory – ICT,
 * owner teacher 25 Francis Miguel Navarro; only 11:30 was free for the section
 * and every rotation teacher was booked there, so the class could not fit;
 * EDUARDO VILLAREAL was free at 11:30 in every term.
 *
 * FAILING-FIRST: this file imports
 * `../services/teaching-load-placement-check.service.js`, which does not exist
 * on the base commit, so the base run is RED (module resolution error). On the
 * candidate every control below is GREEN.
 *
 * Run: `npm run test:a6-tl-placement` (wired in atlas-server/package.json in the
 * same commit).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluatePlacementVerdicts,
  type PlacementCheckLineRequest,
  type PlacementEvaluatorInput,
  type PlacementOccupancyLock,
} from '../services/teaching-load-placement-check.service.js';
import type { TimetableDemandLine } from '../services/timetable-demand.service.js';
import type { CandidateRoom, WeeklySlot } from '../services/timetable-insertion.service.js';

// ─── Fixture primitives ─────────────────────────────────────────────────────

const SLOTS: WeeklySlot[] = [
  { day: 'MONDAY', startTime: '09:00', endTime: '09:45' },
  { day: 'MONDAY', startTime: '10:00', endTime: '10:45' },
  { day: 'MONDAY', startTime: '11:30', endTime: '12:15' },
];

const ROOMS: CandidateRoom[] = [
  {
    id: 1,
    name: 'Room 101',
    buildingId: 1,
    buildingZoneId: null,
    buildingGradeScope: [],
    type: 'CLASSROOM',
    capacity: 45,
    isTeachingSpace: true,
    isSharedFacility: false,
  },
];

function slot(day: string, startTime: string, endTime: string): { day: string; startTime: string; endTime: string } {
  return { day, startTime, endTime };
}

function lock(
  resource: 'section' | 'teacher' | 'room',
  id: number,
  at: { day: string; startTime: string; endTime: string },
  termIndex: number | null = null,
): PlacementOccupancyLock {
  return {
    sectionId: resource === 'section' ? id : -1,
    facultyId: resource === 'teacher' ? id : null,
    roomId: resource === 'room' ? id : null,
    day: at.day,
    startTime: at.startTime,
    endTime: at.endTime,
    termIndex,
  };
}

function demandLine(input: {
  sectionExternalId: number;
  sectionName: string;
  gradeLevel: number;
  enrolledCount: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  termIdentity: string;
  termIndex: number;
  sessionsPerWeek: number;
  ownerFacultyId: number;
}): TimetableDemandLine {
  return {
    demandKey: `${input.subjectId}:${input.sectionExternalId}:${input.termIdentity}`,
    offeringId: 0,
    offeringVersion: 0,
    subjectId: input.subjectId,
    subjectCode: input.subjectCode,
    subjectName: input.subjectName,
    classification: 'CORE',
    rotationFamily: null,
    rotationOrder: null,
    termMode: 'ALL',
    termIdentity: input.termIdentity,
    termIndex: input.termIndex,
    applicableTermIdentities: ['T1', 'T2', 'T3'],
    sectionMirrorId: input.sectionExternalId,
    sectionExternalId: input.sectionExternalId,
    sectionName: input.sectionName,
    gradeLevel: input.gradeLevel,
    programType: 'REGULAR',
    homeRoomId: null,
    buildingZoneId: null,
    maxCapacity: 50,
    enrolledCount: input.enrolledCount,
    weeklyMinutes: 60,
    periodLengthMinutes: 45,
    sessionsPerWeek: input.sessionsPerWeek,
    durationPerSessionMinutes: 45,
    ownerFacultyId: input.ownerFacultyId,
    ownerFacultyName: null,
    ownerState: 'VALID',
  };
}

const SUBJECT_TLE = 11;
const SECTION_MAKABANSA = 87;
const SECTION_MABINI = 90;
const TEACHER_NAVARRO = 25;

const SUBJECT_META = new Map([
  [SUBJECT_TLE, { preferredRoomType: 'CLASSROOM', code: 'TLE_ICT', name: 'TLE Exploratory – ICT' }],
]);

const SECTION_META = new Map([
  [SECTION_MAKABANSA, { name: 'Grade 8 Makabansa', gradeLevel: 8, enrolledCount: 35, programType: 'REGULAR' }],
  [SECTION_MABINI, { name: 'Grade 8 Mabini', gradeLevel: 8, enrolledCount: 35, programType: 'REGULAR' }],
]);

const FACULTY_META = new Map<number, string>([
  [TEACHER_NAVARRO, 'Francis Miguel Navarro'],
  [77, 'Unqualified Teacher'],
  [88, 'Busy Teacher'],
  [99, 'EDUARDO VILLAREAL'],
  [501, 'Free Qualified Teacher'],
]);

function makabansa(termIdentity: string, termIndex: number) {
  return {
    sectionExternalId: SECTION_MAKABANSA,
    sectionName: 'Grade 8 Makabansa',
    gradeLevel: 8,
    enrolledCount: 35,
    subjectId: SUBJECT_TLE,
    subjectCode: 'TLE_ICT',
    subjectName: 'TLE Exploratory – ICT',
    termIdentity,
    termIndex,
    sessionsPerWeek: 1,
    ownerFacultyId: TEACHER_NAVARRO,
  };
}

const DEMAND: TimetableDemandLine[] = [
  demandLine(makabansa('T1', 1)),
  demandLine(makabansa('T2', 2)),
  demandLine(makabansa('T3', 3)),
  demandLine({
    sectionExternalId: SECTION_MABINI,
    sectionName: 'Grade 8 Mabini',
    gradeLevel: 8,
    enrolledCount: 35,
    subjectId: SUBJECT_TLE,
    subjectCode: 'TLE_ICT',
    subjectName: 'TLE Exploratory – ICT',
    termIdentity: 'T1',
    termIndex: 1,
    sessionsPerWeek: 1,
    ownerFacultyId: 501,
  }),
];

/**
 * Occupancy: Makabansa's own other sessions take 09:00 and 10:00; teacher 25 is
 * booked at every slot (the 11:30 booking by another section is the live case);
 * candidate 88 is qualified but booked at 11:30; 99 is free.
 */
function makabansaOccupancy(): PlacementOccupancyLock[] {
  return [
    lock('section', SECTION_MAKABANSA, slot('MONDAY', '09:00', '09:45')),
    lock('section', SECTION_MAKABANSA, slot('MONDAY', '10:00', '10:45')),
    lock('teacher', TEACHER_NAVARRO, slot('MONDAY', '09:00', '09:45')),
    lock('teacher', TEACHER_NAVARRO, slot('MONDAY', '10:00', '10:45')),
    lock('teacher', TEACHER_NAVARRO, slot('MONDAY', '11:30', '12:15')),
    lock('teacher', 88, slot('MONDAY', '11:30', '12:15')),
    // Mabini's own other sessions (positive control section): 09:00 and 10:00.
    lock('section', SECTION_MABINI, slot('MONDAY', '09:00', '09:45')),
    lock('section', SECTION_MABINI, slot('MONDAY', '10:00', '10:45')),
  ];
}

const MAKABANSA_REQUEST: PlacementCheckLineRequest = { sectionId: SECTION_MAKABANSA, subjectId: SUBJECT_TLE, facultyId: TEACHER_NAVARRO };
const MABINI_REQUEST: PlacementCheckLineRequest = { sectionId: SECTION_MABINI, subjectId: SUBJECT_TLE, facultyId: 501 };

/**
 * Replacement teachers are INJECTED already-qualified by the loader (the
 * qualification filter is proven by the route/DB suite). The pure evaluator's
 * job is to offer only those who actually FIT. 88 is qualified but booked at
 * 11:30, so it must be excluded; 77 is not in the qualified set at all.
 */
const QUALIFIED_ALTERNATIVES = new Map<string, Array<{ facultyId: number; facultyName: string }>>([
  [`${SUBJECT_TLE}:REGULAR`, [
    { facultyId: 88, facultyName: 'Busy Teacher' },
    { facultyId: 99, facultyName: 'EDUARDO VILLAREAL' },
  ]],
]);

function baseInput(overrides: Partial<PlacementEvaluatorInput> = {}): PlacementEvaluatorInput {
  return {
    request: [MAKABANSA_REQUEST],
    demandLines: DEMAND,
    weeklySlots: SLOTS,
    usableRooms: ROOMS,
    occupancyLocks: makabansaOccupancy(),
    subjectMeta: SUBJECT_META,
    sectionMeta: SECTION_META,
    facultyMeta: FACULTY_META,
    qualifiedAlternatives: QUALIFIED_ALTERNATIVES,
    ...overrides,
  };
}

// ─── The live Makabansa case ────────────────────────────────────────────────

test('Makabansa TLE cannot fit: NO_AVAILABLE_SLOT with teacherBusySlots > 0 and a named reason', () => {
  const [verdict] = evaluatePlacementVerdicts(baseInput());
  assert.equal(verdict.placeable, false);
  assert.equal(verdict.reason, 'NO_AVAILABLE_SLOT');
  assert.ok(verdict.teacherBusySlots > 0, `teacherBusySlots should be > 0 (got ${verdict.teacherBusySlots})`);
  assert.equal(verdict.sectionName, 'Grade 8 Makabansa');
  assert.equal(verdict.subjectName, 'TLE Exploratory – ICT');
  assert.ok(verdict.sentence, 'a plain sentence must be produced');
  assert.ok(verdict.sentence!.includes('Grade 8 Makabansa'), 'the sentence names the section');
  assert.ok(verdict.sentence!.includes('TLE Exploratory – ICT'), 'the sentence names the subject');
  assert.ok(verdict.sentence!.includes('Francis Miguel Navarro'), 'the sentence names the teacher');
});

test('EDUARDO VILLAREAL is returned as a teacher who fits; the busy candidate is not', () => {
  const [verdict] = evaluatePlacementVerdicts(baseInput());
  const ids = verdict.alternatives.map((alternative) => alternative.facultyId);
  assert.ok(ids.includes(99), `the free qualified teacher is offered (got ${JSON.stringify(ids)})`);
  assert.ok(!ids.includes(88), 'a qualified but booked-at-11:30 teacher is NOT offered (negative control)');
  assert.ok(!ids.includes(77), 'a teacher outside the injected qualified set is never returned');
  const eduardo = verdict.alternatives.find((alternative) => alternative.facultyId === 99);
  assert.ok(eduardo, 'the alternative carries the teacher identity');
  assert.equal(eduardo!.facultyName, 'EDUARDO VILLAREAL');
  assert.equal(eduardo!.day, 'MONDAY');
  assert.equal(eduardo!.startTime, '11:30');
  assert.equal(eduardo!.endTime, '12:15');
});

test('positive control: a section with a free slot and a free qualified teacher IS placeable', () => {
  const [verdict] = evaluatePlacementVerdicts(baseInput({ request: [MABINI_REQUEST] }));
  assert.equal(verdict.placeable, true, 'the check must not block everything');
  assert.equal(verdict.alternatives.length, 0);
  assert.equal(verdict.sentence, null);
});

test('empty occupancy: everything is placeable', () => {
  const [makabansa, mabini] = evaluatePlacementVerdicts(baseInput({
    request: [MAKABANSA_REQUEST, MABINI_REQUEST],
    occupancyLocks: [],
  }));
  assert.equal(makabansa.placeable, true);
  assert.equal(mabini.placeable, true);
});

test('a requested pair outside canonical demand is placeable (nothing to place)', () => {
  const [verdict] = evaluatePlacementVerdicts(baseInput({
    request: [{ sectionId: 999, subjectId: SUBJECT_TLE, facultyId: TEACHER_NAVARRO }],
  }));
  assert.equal(verdict.placeable, true);
  assert.equal(verdict.alternatives.length, 0);
});

test('the check is deterministic and reads the in-memory input only (no DB)', () => {
  const first = evaluatePlacementVerdicts(baseInput());
  const second = evaluatePlacementVerdicts(baseInput());
  assert.deepEqual(first.map((v) => v.reason), second.map((v) => v.reason));
  assert.deepEqual(first[0]!.alternatives, second[0]!.alternatives);
});
