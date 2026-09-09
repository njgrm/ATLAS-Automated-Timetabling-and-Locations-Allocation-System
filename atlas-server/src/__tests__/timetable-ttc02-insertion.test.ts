import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveOfferingTerms,
  expandOfferingAcrossSections,
  buildDemandLineKey,
  HG_SUBJECT_CODE,
  type TimetableDemandLine,
} from '../services/timetable-demand.service.js';
import {
  buildWeeklyDayShape,
  searchCandidateSlots,
  classifyInsertionLine,
  emptyOccupancy,
  addLockedSessionOccupancy,
  filterCompatibleRooms,
  buildInsertionFingerprint,
  guidanceFor,
  type CandidateRoom,
  type WeeklySlot,
} from '../services/timetable-insertion.service.js';
import type { SectionMirror } from '@prisma/client';

const TERM_CONFIG = {
  id: 1,
  termCount: 3,
  termIdentities: ['T1', 'T2', 'T3'],
  isActive: true,
  updatedAt: '2026-09-09T00:00:00.000Z',
};

function makeSection(overrides: Partial<SectionMirror> = {}): SectionMirror {
  return {
    id: 100,
    externalId: 9001,
    schoolId: 1,
    schoolYearId: 8,
    name: 'Grade 7 - Test',
    gradeLevelId: 7,
    gradeLevelName: 'Grade 7',
    displayOrder: 1,
    maxCapacity: 40,
    enrolledCount: 35,
    programType: 'REGULAR',
    programCode: 'REGULAR',
    programName: 'Regular',
    isSpecialProgram: false,
    tleProgramId: null,
    tleSpecialization: null,
    tleProgramCategory: null,
    isActiveForScheduling: true,
    preferredRoomId: null,
    homeRoomId: null,
    buildingZoneId: null,
    lastSyncedAt: new Date(),
    isStale: false,
    staleReason: null,
    staleAt: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeLine(overrides: Partial<TimetableDemandLine> = {}): TimetableDemandLine {
  return {
    demandKey: buildDemandLineKey({ subjectId: 1, sectionExternalId: 9001, termIdentity: 'T1' }),
    offeringId: 10,
    offeringVersion: 1,
    subjectId: 1,
    subjectCode: 'MATH',
    subjectName: 'Mathematics',
    classification: 'CORE',
    rotationFamily: null,
    rotationOrder: null,
    termMode: 'ALL',
    termIdentity: 'T1',
    termIndex: 1,
    applicableTermIdentities: ['T1', 'T2', 'T3'],
    sectionMirrorId: 100,
    sectionExternalId: 9001,
    sectionName: 'Grade 7 - Test',
    gradeLevel: 7,
    programType: 'REGULAR',
    homeRoomId: null,
    buildingZoneId: null,
    maxCapacity: 40,
    weeklyMinutes: 270,
    periodLengthMinutes: 45,
    sessionsPerWeek: 6,
    durationPerSessionMinutes: 45,
    ownerFacultyId: 500,
    ownerFacultyName: 'Probe Faculty',
    ownerState: 'VALID',
    ...overrides,
  };
}

function dayShapePolicy() {
  return {
    id: 1,
    periodLengthMinutes: 45,
    periodsPerDay: 8,
    earliestStartTime: '07:00',
    latestEndTime: '16:30',
    updatedAt: new Date(),
  };
}

function rooms(): CandidateRoom[] {
  return [
    {
      id: 1,
      name: 'Room 1',
      buildingId: 1,
      buildingZoneId: 'A',
      buildingGradeScope: [],
      type: 'CLASSROOM',
      capacity: 45,
      isTeachingSpace: true,
      isSharedFacility: false,
    },
    {
      id: 2,
      name: 'Lab 1',
      buildingId: 1,
      buildingZoneId: 'A',
      buildingGradeScope: [],
      type: 'LABORATORY',
      capacity: 40,
      isTeachingSpace: true,
      isSharedFacility: false,
    },
  ];
}

test('term resolution: ALL without assignments expands to every configured term in order', () => {
  const resolved = resolveOfferingTerms(
    { termMode: 'ALL', rotationFamily: null, rotationOrder: null, termAssignments: [] },
    TERM_CONFIG,
  );
  assert.deepEqual(
    resolved.map((term) => term.termIdentity),
    ['T1', 'T2', 'T3'],
  );
  assert.deepEqual(
    resolved.map((term) => term.termIndex),
    [1, 2, 3],
  );
});

test('term resolution: ROTATING_FAMILY_MEMBER resolves exactly its one assigned term', () => {
  const resolved = resolveOfferingTerms(
    {
      termMode: 'ROTATING_FAMILY_MEMBER',
      rotationFamily: 'SCIENCE',
      rotationOrder: 2,
      termAssignments: [{ termIdentity: 'T2' }],
    },
    TERM_CONFIG,
  );
  assert.deepEqual(resolved, [{ termIdentity: 'T2', termIndex: 2 }]);
});

test('term resolution: rotating member without an assigned term or family yields no demand', () => {
  assert.deepEqual(
    resolveOfferingTerms(
      { termMode: 'ROTATING_FAMILY_MEMBER', rotationFamily: null, rotationOrder: null, termAssignments: [] },
      TERM_CONFIG,
    ),
    [],
  );
  assert.deepEqual(
    resolveOfferingTerms(
      { termMode: 'ROTATING_FAMILY_MEMBER', rotationFamily: 'SCIENCE', rotationOrder: 1, termAssignments: [] },
      TERM_CONFIG,
    ),
    [],
  );
});

test('term resolution: EMPTY scope yields no demand', () => {
  assert.deepEqual(
    resolveOfferingTerms(
      { termMode: 'EMPTY', rotationFamily: null, rotationOrder: null, termAssignments: [] },
      TERM_CONFIG,
    ),
    [],
  );
});

test('curriculum-demand equivalence: ALL requirement expands across every matching active section', () => {
  const g7 = makeSection({ id: 100, externalId: 9001, gradeLevelId: 7 });
  const g8 = makeSection({ id: 101, externalId: 9002, gradeLevelId: 8 });
  const sections = [g7, g8];
  const expansion = expandOfferingAcrossSections(
    {
      id: 10,
      subjectId: 1,
      gradeLevel: 7,
      programType: 'REGULAR',
      sectionMirrorId: null,
      cohortId: null,
      classification: 'CORE',
      weeklyMinutes: 270,
      rotationFamily: null,
      rotationOrder: null,
      termMode: 'ALL',
      isActive: true,
      version: 1,
      updatedAt: new Date(),
      termAssignments: [],
    },
    TERM_CONFIG, sections, new Map(), 45);
  assert.equal(expansion.length, 1, 'Only the grade-7 REGULAR section matches the base scope.');
  assert.equal(expansion[0].section.externalId, 9001);
  assert.deepEqual(
    expansion[0].terms.map((term) => term.termIdentity),
    ['T1', 'T2', 'T3'],
  );
});

test('curriculum-demand equivalence: ROTATING requirement keeps term identity and rotation metadata', () => {
  const section = makeSection({ id: 100, externalId: 9001, gradeLevelId: 7 });
  const expansion = expandOfferingAcrossSections(
    {
      id: 11,
      subjectId: 2,
      gradeLevel: 7,
      programType: 'REGULAR',
      sectionMirrorId: section.id,
      cohortId: null,
      classification: 'EXPLORATORY',
      weeklyMinutes: 180,
      rotationFamily: 'TLE',
      rotationOrder: 1,
      termMode: 'ROTATING_FAMILY_MEMBER',
      isActive: true,
      version: 1,
      updatedAt: new Date(),
      termAssignments: [{ termIdentity: 'T1' }],
    },
    TERM_CONFIG,
    [section],
    new Map(),
    45,
  );
  assert.equal(expansion.length, 1);
  assert.deepEqual(expansion[0].terms, [{ termIdentity: 'T1', termIndex: 1 }]);
});

test('HG exclusion negative control: an HG line can never become a candidate and is always HG_FORBIDDEN', () => {
  const weeklySlots: WeeklySlot[] = [
    { day: 'MONDAY', startTime: '07:00', endTime: '07:45' },
    { day: 'MONDAY', startTime: '07:45', endTime: '08:30' },
  ];
  const line = makeLine({ subjectCode: HG_SUBJECT_CODE });
  const verdict = searchCandidateSlots(
    line,
    weeklySlots,
    rooms(),
    emptyOccupancy(),
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(verdict.reason, 'HG_FORBIDDEN');
  assert.equal(verdict.feasible, false);
  assert.equal(verdict.candidates.length, 0);

  const classification = classifyInsertionLine(line, verdict, { termConfigured: true });
  assert.equal(classification.state, 'HG_FORBIDDEN');
  assert.equal(classification.guidance.action, 'REVIEW_CURRICULUM');
});

test('classification decision table: owner-state reasons map truthfully', () => {
  const placeableVerdict = {
    reason: 'INDIVIDUALLY_PREVIEWABLE' as const,
    feasible: true,
    freeSlots: 6,
    neededSlots: 6,
    candidates: [],
    diagnostic: { compatibleRoomCount: 2, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 2 },
  };
  const cases: Array<[string, ReturnType<typeof makeLine>, string]> = [
    ['missing owner', makeLine({ ownerState: 'MISSING', ownerFacultyId: null }), 'MISSING_TEACHING_LOAD_OWNER'],
    ['inactive owner', makeLine({ ownerState: 'INACTIVE_OR_STALE' }), 'OWNER_INACTIVE_OR_STALE'],
    ['owner outside scope', makeLine({ ownerState: 'OUTSIDE_SCOPE' }), 'OWNER_OUTSIDE_SCOPE'],
    ['owner not qualified for section', makeLine({ ownerState: 'NO_QUALIFIED_SCOPE' }), 'NO_QUALIFIED_OWNER'],
  ];
  for (const [label, line, expected] of cases) {
    const result = classifyInsertionLine(line, placeableVerdict, { termConfigured: true });
    assert.equal(result.state, expected, label);
  }
});

test('classification: term mismatch surfaces when no term config is configured', () => {
  const line = makeLine({ ownerState: 'VALID' });
  const verdict = {
    reason: 'INDIVIDUALLY_PREVIEWABLE' as const,
    feasible: true,
    freeSlots: 6,
    neededSlots: 6,
    candidates: [],
    diagnostic: { compatibleRoomCount: 2, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 2 },
  };
  const result = classifyInsertionLine(line, verdict, { termConfigured: false });
  assert.equal(result.state, 'TERM_APPLICABILITY_MISMATCH');
});

test('classification: stale source revision rejects with SOURCE_STALE', () => {
  const line = makeLine({ ownerState: 'VALID' });
  const verdict = {
    reason: 'INDIVIDUALLY_PREVIEWABLE' as const,
    feasible: true,
    freeSlots: 6,
    neededSlots: 6,
    candidates: [],
    diagnostic: { compatibleRoomCount: 2, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 2 },
  };
  const result = classifyInsertionLine(line, verdict, {
    termConfigured: true,
    expectedSourceSha256: 'OLD',
    currentSourceSha256: 'NEW',
  });
  assert.equal(result.state, 'SOURCE_STALE');
});

test('no-slot / no-room / hard-conflict separation stays truthful', () => {
  const policy = dayShapePolicy();
  const weeklySlots = buildWeeklyDayShape(policy);
  assert.ok(weeklySlots.length >= 30, 'expected a multi-day grid');

  const line = makeLine({ sessionsPerWeek: 30, weeklyMinutes: 1350 });

  const noRooms = searchCandidateSlots(
    line,
    weeklySlots,
    [],
    emptyOccupancy(),
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(noRooms.reason, 'NO_COMPATIBLE_ROOM', 'zero compatible rooms => NO_COMPATIBLE_ROOM');
  assert.equal(noRooms.diagnostic.compatibleRoomCount, 0);

  const busyTeacher: Record<string, unknown> = {};
  void busyTeacher;
  const occupancyTeacherFull = emptyOccupancy();
  for (const slot of weeklySlots) {
    occupancyTeacherFull.teacher.push({ id: line.ownerFacultyId as number, day: slot.day, startTime: slot.startTime, endTime: slot.endTime });
  }
  const teacherFull = searchCandidateSlots(
    line,
    weeklySlots,
    rooms(),
    occupancyTeacherFull,
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(teacherFull.reason, 'NO_AVAILABLE_SLOT', 'teacher full on every slot => NO_AVAILABLE_SLOT');

  const occupancySectionBusy = emptyOccupancy();
  for (const slot of weeklySlots) {
    occupancySectionBusy.section.push({ id: line.sectionExternalId, day: slot.day, startTime: slot.startTime, endTime: slot.endTime });
  }
  const sectionBusy = searchCandidateSlots(
    line,
    weeklySlots,
    rooms(),
    occupancySectionBusy,
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(sectionBusy.reason, 'HARD_CONFLICT', 'section occupied on every candidate slot => HARD_CONFLICT');

  const free = searchCandidateSlots(
    line,
    weeklySlots,
    rooms(),
    emptyOccupancy(),
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(free.reason, 'INDIVIDUALLY_PREVIEWABLE');
  assert.equal(free.feasible, true);
  assert.ok(free.candidates.length >= 30);
});

test('deterministic bounded-search ordering with stable tie-breakers', () => {
  const policy = dayShapePolicy();
  const weeklySlots = buildWeeklyDayShape(policy);
  const line = makeLine({ sessionsPerWeek: 3 });
  const subject = { preferredRoomType: 'CLASSROOM', gradeLevel: 7 };
  const compatibleRooms = filterCompatibleRooms(rooms(), subject);

  const first = searchCandidateSlots(line, weeklySlots, compatibleRooms, emptyOccupancy(), subject);
  const second = searchCandidateSlots(line, weeklySlots, compatibleRooms, emptyOccupancy(), subject);
  assert.deepEqual(first, second, 'identical input must produce byte-identical output');
  const keys = first.candidates.map((candidate) => `${candidate.day}|${candidate.startTime}|${candidate.roomId}`);
  assert.deepEqual(keys, [...keys].sort(), 'candidates must be deterministically ordered');
  const distinct = new Set(first.candidates.map((candidate) => `${candidate.day}|${candidate.startTime}`));
  assert.equal(distinct.size, first.candidates.length, 'a session must not reuse the same weekly slot twice');
});

test('locked-session occupancy turns a free slot into a hard conflict', () => {
  const policy = dayShapePolicy();
  const weeklySlots = buildWeeklyDayShape(policy).slice(0, 5);
  const line = makeLine({ sessionsPerWeek: 1 });
  const occupied = addLockedSessionOccupancy(emptyOccupancy(), [
    {
      sectionId: 123456,
      subjectId: 999,
      facultyId: line.ownerFacultyId as number,
      roomId: 1,
      day: 'MONDAY',
      startTime: '06:55',
      endTime: '07:15',
    },
  ]);
  const verdict = searchCandidateSlots(
    line,
    weeklySlots,
    rooms(),
    occupied,
    { preferredRoomType: 'CLASSROOM', gradeLevel: 7 },
  );
  assert.equal(occupied.teacher.some((entry) => entry.id === line.ownerFacultyId && entry.startTime === '06:55'), true);
  assert.notEqual(verdict.candidates[0].startTime, '07:00', 'an intersecting lock with a different start time must block Monday 07:00');
});

test('preview fingerprint is canonical and binds authority and candidates', () => {
  const base = {
    scope: { schoolId: 1, schoolYearId: 8 },
    demandKey: '1:9001:T1',
    sourceRevisionSha256: 'A'.repeat(64),
    cycleVersion: 3,
    ownershipHash: 'B'.repeat(64),
    candidates: [{ day: 'MONDAY', startTime: '07:00', endTime: '07:45', roomId: 1, roomName: 'Room 1' }],
  };
  const fp1 = buildInsertionFingerprint(base);
  assert.match(fp1, /^TTI_[0-9A-F]{64}$/);
  const fp2 = buildInsertionFingerprint({ ...base });
  assert.equal(fp1, fp2, 'same authority + same candidates => same fingerprint');
  const fp3 = buildInsertionFingerprint({ ...base, cycleVersion: 4 });
  assert.notEqual(fp1, fp3, 'a Teaching Load cycle change must change the fingerprint');
  const fp4 = buildInsertionFingerprint({
    ...base,
    candidates: [{ day: 'MONDAY', startTime: '07:45', endTime: '08:30', roomId: 1, roomName: 'Room 1' }],
  });
  assert.notEqual(fp1, fp4, 'a different candidate slot must change the fingerprint');
});

test('every blocker reason exposes one truthful next action', () => {
  const expectedActions: Record<string, string> = {
    MISSING_TEACHING_LOAD_OWNER: 'FIX_TEACHING_LOAD',
    OWNER_INACTIVE_OR_STALE: 'FIX_TEACHING_LOAD',
    OWNER_OUTSIDE_SCOPE: 'REVIEW_OWNER_SCOPE',
    NO_QUALIFIED_OWNER: 'REVIEW_OWNER_SCOPE',
    NO_AVAILABLE_SLOT: 'REVIEW_TEACHER_AVAILABILITY',
    NO_COMPATIBLE_ROOM: 'REVIEW_ROOM_READINESS',
    HARD_CONFLICT: 'RESOLVE_CONFLICT',
    TERM_APPLICABILITY_MISMATCH: 'REVIEW_TERMS',
    SOURCE_STALE: 'REFRESH_SOURCE',
    HG_FORBIDDEN: 'REVIEW_CURRICULUM',
  };
  for (const [reason, action] of Object.entries(expectedActions)) {
    const guidance = guidanceFor(reason as keyof typeof expectedActions as never);
    assert.equal(guidance.action, action, reason);
    assert.ok(guidance.message.length > 0);
    assert.ok(guidance.prerequisite.length > 0);
    assert.ok(guidance.primaryAction.length > 0);
  }
});
