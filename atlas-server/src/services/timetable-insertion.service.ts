/**
 * TT-C02 unassigned insertion service.
 *
 * Classifies curriculum-demanded meetings that cannot initially be placed and
 * offers bounded, deterministic candidate placements WITHOUT mutating state.
 *
 * The ten truthful reasons are kept distinct so each leads to one next action
 * instead of collapsing every problem into "no available slot":
 *
 *   MISSING_TEACHING_LOAD_OWNER | OWNER_INACTIVE_OR_STALE |
 *   OWNER_OUTSIDE_SCOPE | NO_QUALIFIED_OWNER | NO_AVAILABLE_SLOT |
 *   NO_COMPATIBLE_ROOM | HARD_CONFLICT | TERM_APPLICABILITY_MISMATCH |
 *   SOURCE_STALE | HG_FORBIDDEN
 *
 * Ownership is read-only here (the Teaching Load owner is authoritative and
 * is never silently changed). Summary and preview are the only operations;
 * this service contains no timetable write path.
 */

import { createHash } from 'node:crypto';
import { getDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import {
  evaluateCandidateInvariants,
  intervalsOverlap,
  isRoomInTeachingScope,
  roomCanFitEnrollment,
  type TimetableCandidateInvariantInput,
} from './timetable-candidate-domain.js';
import {
  buildCanonicalTimetableDemand,
  HG_SUBJECT_CODE,
  readDayShapePolicy,
  type TimetableDemandLine,
  type DayShapePolicy,
} from './timetable-demand.service.js';

const db = () => getDataContext();

// ─── Reason vocabulary ───

export type InsertionReason =
  | 'MISSING_TEACHING_LOAD_OWNER'
  | 'OWNER_INACTIVE_OR_STALE'
  | 'OWNER_OUTSIDE_SCOPE'
  | 'NO_QUALIFIED_OWNER'
  | 'NO_AVAILABLE_SLOT'
  | 'NO_COMPATIBLE_ROOM'
  | 'HARD_CONFLICT'
  | 'TERM_APPLICABILITY_MISMATCH'
  | 'SOURCE_STALE'
  | 'HG_FORBIDDEN';

export type LinePlacementState = InsertionReason | 'INDIVIDUALLY_PREVIEWABLE';

export const INSERTION_REASONS: InsertionReason[] = [
  'MISSING_TEACHING_LOAD_OWNER',
  'OWNER_INACTIVE_OR_STALE',
  'OWNER_OUTSIDE_SCOPE',
  'NO_QUALIFIED_OWNER',
  'NO_AVAILABLE_SLOT',
  'NO_COMPATIBLE_ROOM',
  'HARD_CONFLICT',
  'TERM_APPLICABILITY_MISMATCH',
  'SOURCE_STALE',
  'HG_FORBIDDEN',
];

export interface ReasonGuidance {
  reason: InsertionReason | 'INDIVIDUALLY_PREVIEWABLE';
  action:
    | 'FIX_TEACHING_LOAD'
    | 'REVIEW_OWNER_SCOPE'
    | 'REVIEW_TEACHER_AVAILABILITY'
    | 'REVIEW_ROOM_READINESS'
    | 'RESOLVE_CONFLICT'
    | 'REVIEW_TERMS'
    | 'REFRESH_SOURCE'
    | 'REVIEW_CURRICULUM'
    | 'OPEN_DRAFT'
    | 'NONE';
  message: string;
  prerequisite: string;
  primaryAction: string;
}

const REASON_GUIDANCE: Record<InsertionReason, ReasonGuidance> = {
  MISSING_TEACHING_LOAD_OWNER: {
    reason: 'MISSING_TEACHING_LOAD_OWNER',
    action: 'FIX_TEACHING_LOAD',
    message: 'No faculty member is assigned to teach this subject for this section this year.',
    prerequisite: 'Assign a qualified faculty owner in Teaching Load.',
    primaryAction: 'Fix Teaching Load ownership first.',
  },
  OWNER_INACTIVE_OR_STALE: {
    reason: 'OWNER_INACTIVE_OR_STALE',
    action: 'FIX_TEACHING_LOAD',
    message: 'The assigned faculty member is inactive or marked stale for scheduling.',
    prerequisite: 'Refresh the faculty record and confirm the owner is active.',
    primaryAction: 'Repair the faculty owner before placing.',
  },
  OWNER_OUTSIDE_SCOPE: {
    reason: 'OWNER_OUTSIDE_SCOPE',
    action: 'REVIEW_OWNER_SCOPE',
    message: 'The owner has no annual Teaching Load scope entry for this subject.',
    prerequisite: 'Add the subject to the owner\u2019s Teaching Load scope.',
    primaryAction: 'Review the owner\u2019s Teaching Load scope.',
  },
  NO_QUALIFIED_OWNER: {
    reason: 'NO_QUALIFIED_OWNER',
    action: 'REVIEW_OWNER_SCOPE',
    message: 'The owner\u2019s Teaching Load scope does not cover this section or grade.',
    prerequisite: 'Extend or correct the owner\u2019s section scope in Teaching Load.',
    primaryAction: 'Correct the owner\u2019s section scope.',
  },
  NO_AVAILABLE_SLOT: {
    reason: 'NO_AVAILABLE_SLOT',
    action: 'REVIEW_TEACHER_AVAILABILITY',
    message: 'No day/time slot is free for this owner across the week.',
    prerequisite: 'Free up teacher time or widen the policy day shape.',
    primaryAction: 'Review the teacher\u2019s weekly availability.',
  },
  NO_COMPATIBLE_ROOM: {
    reason: 'NO_COMPATIBLE_ROOM',
    action: 'REVIEW_ROOM_READINESS',
    message: 'No room in the campus is ready and compatible for this section and subject.',
    prerequisite: 'Add or ready a compatible teaching room.',
    primaryAction: 'Review room readiness.',
  },
  HARD_CONFLICT: {
    reason: 'HARD_CONFLICT',
    action: 'RESOLVE_CONFLICT',
    message: 'Every candidate slot overlaps an existing scheduled class (section, room, or owner).',
    prerequisite: 'Resolve the overlapping class or choose another slot.',
    primaryAction: 'Resolve the existing overlap first.',
  },
  TERM_APPLICABILITY_MISMATCH: {
    reason: 'TERM_APPLICABILITY_MISMATCH',
    action: 'REVIEW_TERMS',
    message: 'This meeting\u2019s term does not match the configured curriculum term rules.',
    prerequisite: 'Fix the term configuration or the curriculum requirement.',
    primaryAction: 'Review term configuration.',
  },
  SOURCE_STALE: {
    reason: 'SOURCE_STALE',
    action: 'REFRESH_SOURCE',
    message: 'The curriculum, Teaching Load, or policy changed after this view was computed.',
    prerequisite: 'Refresh the insertion preview against current authority.',
    primaryAction: 'Refresh and re-preview.',
  },
  HG_FORBIDDEN: {
    reason: 'HG_FORBIDDEN',
    action: 'REVIEW_CURRICULUM',
    message: 'Homeroom Guidance is not timetable demand and can never be scheduled as a class.',
    prerequisite: 'Remove any HG-derived timetable demand.',
    primaryAction: 'Do not place Homeroom Guidance.',
  },
};

export const PLACEABLE_GUIDANCE: ReasonGuidance = {
  reason: 'INDIVIDUALLY_PREVIEWABLE',
  action: 'OPEN_DRAFT',
  message: 'A bounded individual preview found candidate slots without interval conflicts against persisted draft locks.',
  prerequisite: 'This is not canonical generator validation or proof that all demand can coexist.',
  primaryAction: 'Inspect the read-only candidate preview.',
};

export function guidanceFor(reason: InsertionReason | 'INDIVIDUALLY_PREVIEWABLE'): ReasonGuidance {
  return reason === 'INDIVIDUALLY_PREVIEWABLE' ? PLACEABLE_GUIDANCE : REASON_GUIDANCE[reason];
}

// ─── Deterministic helpers ───

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const MAX_EVALUATED_SLOTS = 240;

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase();
}

export function toMinutes(time: string): number {
  const parts = time.split(':').map((part) => Number(part));
  const h = parts[0];
  const m = parts[1];
  if (!Number.isInteger(h) || !Number.isInteger(m)) return 0;
  return h * 60 + m;
}

export function minutesToHhmm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface WeeklySlot {
  day: string;
  startTime: string;
  endTime: string;
}

export function buildWeeklyDayShape(policy: DayShapePolicy): WeeklySlot[] {
  const start = toMinutes(policy.earliestStartTime);
  const latest = toMinutes(policy.latestEndTime);
  const length = Math.max(1, policy.periodLengthMinutes);
  const slots: WeeklySlot[] = [];
  for (const day of DAY_ORDER) {
    for (let index = 0; index < Math.min(policy.periodsPerDay, 24); index += 1) {
      const slotStart = start + index * length;
      const slotEnd = slotStart + length;
      if (slotEnd > latest) break;
      slots.push({ day, startTime: minutesToHhmm(slotStart), endTime: minutesToHhmm(slotEnd) });
    }
  }
  return slots;
}

// ─── Room candidates ───

export interface CandidateRoom {
  id: number;
  name: string;
  buildingId: number;
  buildingZoneId: string | null;
  buildingGradeScope: number[];
  type: string;
  capacity: number | null;
  isTeachingSpace: boolean;
  isSharedFacility: boolean;
}

export function isRoomCompatibleForSubject(
  room: CandidateRoom,
  subject: { preferredRoomType: string; gradeLevel: number; enrolledCount: number },
): boolean {
  if (!isRoomInTeachingScope(room, subject.gradeLevel)) return false;
  if (!roomCanFitEnrollment(room.capacity, subject.enrolledCount)) return false;
  return room.type === subject.preferredRoomType || room.type === 'CLASSROOM';
}

export function evaluateInsertionCandidateInvariants(input: TimetableCandidateInvariantInput) {
  return evaluateCandidateInvariants(input);
}

export function filterCompatibleRooms(
  rooms: CandidateRoom[],
  subject: { preferredRoomType: string; gradeLevel: number; enrolledCount: number },
): CandidateRoom[] {
  return rooms
    .filter((room) => isRoomCompatibleForSubject(room, subject))
    .sort((a, b) => {
      const keyA = `${roomSortPrefix(a)}`;
      const keyB = `${roomSortPrefix(b)}`;
      return keyA.localeCompare(keyB);
    });
}

function roomSortPrefix(room: CandidateRoom): string {
  return `${String(room.buildingId).padStart(6, '0')}:${room.buildingZoneId ?? ''}:${String(room.capacity ?? 9999).padStart(4, '0')}:${String(room.id).padStart(6, '0')}`;
}

// ─── Occupancy state ───

export interface OccupancyState {
  teacher: Array<{ id: number; day: string; startTime: string; endTime: string }>;
  section: Array<{ id: number; day: string; startTime: string; endTime: string }>;
  room: Array<{ id: number; day: string; startTime: string; endTime: string }>;
}

export function emptyOccupancy(): OccupancyState {
  return { teacher: [], section: [], room: [] };
}

export function addLockedSessionOccupancy(
  state: OccupancyState,
  locks: Array<{
    sectionId: number;
    subjectId: number;
    facultyId: number | null;
    roomId: number | null;
    day: string;
    startTime: string;
    endTime: string;
  }>,
): OccupancyState {
  const next: OccupancyState = {
    teacher: [...state.teacher],
    section: [...state.section],
    room: [...state.room],
  };
  for (const lock of locks) {
    if (lock.facultyId !== null) next.teacher.push({ id: lock.facultyId, day: lock.day, startTime: lock.startTime, endTime: lock.endTime });
    next.section.push({ id: lock.sectionId, day: lock.day, startTime: lock.startTime, endTime: lock.endTime });
    if (lock.roomId !== null) next.room.push({ id: lock.roomId, day: lock.day, startTime: lock.startTime, endTime: lock.endTime });
  }
  return next;
}

export interface CandidateSlot extends WeeklySlot {
  roomId: number;
  roomName: string;
}

export interface InsertionSearchResult {
  reason: InsertionReason | 'INDIVIDUALLY_PREVIEWABLE';
  feasible: boolean;
  freeSlots: number;
  neededSlots: number;
  candidates: CandidateSlot[];
  diagnostic: {
    compatibleRoomCount: number;
    teacherBusySlots: number;
    sectionBusySlots: number;
    roomBusySlots: number;
    evaluatedSlots: number;
  };
}

/**
 * Deterministic bounded search for one demanded meeting line. Pure and
 * DB-free: occupancy and room inventory are passed in so hard conflicts,
 * no-room, and no-slot cases can be proven hermetically.
 */
export function searchCandidateSlots(
  line: Pick<
    TimetableDemandLine,
    'sessionsPerWeek' | 'sectionExternalId' | 'ownerFacultyId' | 'gradeLevel' | 'subjectCode'
  >,
  weeklySlots: WeeklySlot[],
  compatibleRooms: CandidateRoom[],
  occupancy: OccupancyState,
  subject: { preferredRoomType: string; gradeLevel: number; enrolledCount: number },
  options?: { maxEvaluatedSlots?: number },
): InsertionSearchResult {
  const needed = Math.max(1, line.sessionsPerWeek);
  const missingOwnerResult = (): InsertionSearchResult => ({
    reason: 'MISSING_TEACHING_LOAD_OWNER',
    feasible: false,
    freeSlots: 0,
    neededSlots: needed,
    candidates: [],
    diagnostic: { compatibleRoomCount: 0, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 0 },
  });
  if (line.subjectCode.trim().toUpperCase() === HG_SUBJECT_CODE) {
    return {
      reason: 'HG_FORBIDDEN',
      feasible: false,
      freeSlots: 0,
      neededSlots: needed,
      candidates: [],
      diagnostic: { compatibleRoomCount: 0, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 0 },
    };
  }
  if (line.ownerFacultyId === null) return missingOwnerResult();

  const teacher = line.ownerFacultyId;
  const section = line.sectionExternalId;
  const maxEvaluated = Math.min(MAX_EVALUATED_SLOTS, options?.maxEvaluatedSlots ?? MAX_EVALUATED_SLOTS);

  const candidates: CandidateSlot[] = [];
  let teacherBusySlots = 0;
  let sectionBusySlots = 0;
  let roomBusySlots = 0;
  let evaluated = 0;

  for (const slot of weeklySlots) {
    if (evaluated >= maxEvaluated) break;
    evaluated += 1;
    const overlaps = (entry: { id: number; day: string; startTime: string; endTime: string }, id: number) =>
      entry.id === id && intervalsOverlap(slot, entry);
    const teacherFree = !occupancy.teacher.some((entry) => overlaps(entry, teacher));
    const sectionFree = !occupancy.section.some((entry) => overlaps(entry, section));
    if (!teacherFree) {
      teacherBusySlots += 1;
      continue;
    }
    if (!sectionFree) {
      sectionBusySlots += 1;
      continue;
    }
    const room = compatibleRooms.find((candidate) => {
      if (occupancy.room.some((entry) => overlaps(entry, candidate.id))) return false;
      return evaluateInsertionCandidateInvariants({
        facultyId: teacher,
        sectionId: section,
        roomId: candidate.id,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subjectCode: line.subjectCode,
        enrolledCount: subject.enrolledCount,
        room: candidate,
        gradeLevel: subject.gradeLevel,
        // Preview deliberately preserves the established classroom fallback.
        allowedRoomTypes: [...new Set([subject.preferredRoomType, 'CLASSROOM'])],
      }).accepted;
    });
    if (!room) {
      roomBusySlots += 1;
      continue;
    }
    void subject;
    candidates.push({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime, roomId: room.id, roomName: room.name });
  }

  const freeSlots = candidates.length;
  if (freeSlots >= needed) {
    return {
      reason: 'INDIVIDUALLY_PREVIEWABLE',
      feasible: true,
      freeSlots,
      neededSlots: needed,
      candidates: candidates.slice(0, needed),
      diagnostic: {
        compatibleRoomCount: compatibleRooms.length,
        teacherBusySlots,
        sectionBusySlots,
        roomBusySlots,
        evaluatedSlots: evaluated,
      },
    };
  }

  let reason: InsertionReason;
  if (compatibleRooms.length === 0) {
    reason = 'NO_COMPATIBLE_ROOM';
  } else if (teacherBusySlots > 0 && teacherBusySlots >= sectionBusySlots && teacherBusySlots >= roomBusySlots) {
    reason = 'NO_AVAILABLE_SLOT';
  } else {
    reason = 'HARD_CONFLICT';
  }

  return {
    reason,
    feasible: false,
    freeSlots,
    neededSlots: needed,
    candidates: candidates.slice(0, needed),
    diagnostic: {
      compatibleRoomCount: compatibleRooms.length,
      teacherBusySlots,
      sectionBusySlots,
      roomBusySlots,
      evaluatedSlots: evaluated,
    },
  };
}

// ─── Classification decision table (pure) ───

export interface ClassificationContext {
  termConfigured: boolean;
  expectedSourceSha256?: string;
  currentSourceSha256?: string;
}

export function classifyInsertionLine(
  line: TimetableDemandLine,
  slotVerdict: InsertionSearchResult,
  context: ClassificationContext,
): { state: LinePlacementState; guidance: ReasonGuidance } {
  if (line.subjectCode.trim().toUpperCase() === HG_SUBJECT_CODE) {
    return { state: 'HG_FORBIDDEN', guidance: guidanceFor('HG_FORBIDDEN') };
  }
  if (
    context.expectedSourceSha256 &&
    context.currentSourceSha256 &&
    context.expectedSourceSha256 !== context.currentSourceSha256
  ) {
    return { state: 'SOURCE_STALE', guidance: guidanceFor('SOURCE_STALE') };
  }
  if (!context.termConfigured) {
    return { state: 'TERM_APPLICABILITY_MISMATCH', guidance: guidanceFor('TERM_APPLICABILITY_MISMATCH') };
  }
  switch (line.ownerState) {
    case 'MISSING':
      return { state: 'MISSING_TEACHING_LOAD_OWNER', guidance: guidanceFor('MISSING_TEACHING_LOAD_OWNER') };
    case 'INACTIVE_OR_STALE':
      return { state: 'OWNER_INACTIVE_OR_STALE', guidance: guidanceFor('OWNER_INACTIVE_OR_STALE') };
    case 'OUTSIDE_SCOPE':
      return { state: 'OWNER_OUTSIDE_SCOPE', guidance: guidanceFor('OWNER_OUTSIDE_SCOPE') };
    case 'NO_QUALIFIED_SCOPE':
      return { state: 'NO_QUALIFIED_OWNER', guidance: guidanceFor('NO_QUALIFIED_OWNER') };
    case 'VALID':
      break;
  }
  if (slotVerdict.reason !== 'INDIVIDUALLY_PREVIEWABLE') {
    return { state: slotVerdict.reason, guidance: guidanceFor(slotVerdict.reason) };
  }
  return { state: 'INDIVIDUALLY_PREVIEWABLE', guidance: guidanceFor('INDIVIDUALLY_PREVIEWABLE') };
}

// ─── Readiness summary (read-only) ───

export interface UnassignedReadinessLine extends TimetableDemandLine {
  state: LinePlacementState;
  guidance: ReasonGuidance;
  candidates: CandidateSlot[];
  slotDiagnostic: InsertionSearchResult['diagnostic'] | null;
}

export interface UnassignedReadinessSummary {
  scope: { schoolId: number; schoolYearId: number };
  termConfigPresent: boolean;
  dayShapePresent: boolean;
  periodLengthMinutes: number;
  demand: {
    totalLines: number;
    totalSessions: number;
    totalsByTerm: Record<string, number>;
  };
  ownership: { cycleVersion: number; ownershipCount: number; hash: string };
  curriculum: { activeOfferingCount: number; hash: string };
  sections: { activeSectionCount: number; hash: string };
  hgExcluded: { offeringIds: number[]; subjectCodes: string[]; ownershipRows: number };
  breakdown: Record<string, number>;
  insertionReadyLines: number;
  unresolvedLines: number;
  lineStates: UnassignedReadinessLine[];
  sourceRevisionSha256: string;
  rooms: { teachingRoomCount: number; compatibleRoomCount: number };
  lockedSessionCount: number;
  zeroWrite: true;
  liveGenerationRunCount: number;
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const k = key(value);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/**
 * Read-only readiness summary. Zero writes. Filters are pushed into SQL:
 * active sections, scoped ownership, DRAFT locked sessions and teaching-space
 * rooms are all set-based reads; there is no per-line database access.
 */
export async function summarizeUnassignedInsertionReadiness(
  schoolId: number,
  schoolYearId: number,
): Promise<UnassignedReadinessSummary> {
  const demand = await buildCanonicalTimetableDemand(schoolId, schoolYearId);
  const policy = await readDayShapePolicy(schoolId, schoolYearId);
  const weeklySlots = policy ? buildWeeklyDayShape(policy) : [];

  const [roomRows, buildingRows, lockedRows, runCount, activeSubjects, teachingRoomCount] = await Promise.all([
    db().room.findMany({ where: { building: { schoolId } } }),
    db().building.findMany({ where: { schoolId } }),
    db().lockedSession.findMany({
      where: { schoolId, schoolYearId, status: 'DRAFT' },
      select: { sectionId: true, subjectId: true, facultyId: true, roomId: true, day: true, startTime: true, endTime: true },
    }),
    db().generationRun.count({ where: { schoolId, schoolYearId, status: 'COMPLETED' } }),
    db().subject.findMany({ where: { schoolId } }),
    db().room.count({ where: { building: { schoolId }, isTeachingSpace: true } }),
  ]);

  const buildingById = new Map(buildingRows.map((building) => [building.id, building]));
  const subjectById = new Map(
    activeSubjects.map((subject) => [
      subject.id,
      { preferredRoomType: subject.preferredRoomType },
    ]),
  );

  const candidateRooms: CandidateRoom[] = roomRows
    .filter((room) => {
      const building = buildingById.get(room.buildingId);
      return Boolean(building && building.schoolId === schoolId && room.isTeachingSpace);
    })
    .map((room) => {
      const building = buildingById.get(room.buildingId);
      return {
        id: room.id,
        name: room.name,
        buildingId: room.buildingId,
        buildingZoneId: room.buildingZoneId ?? null,
        buildingGradeScope: [...(building?.gradeScope ?? [])],
        type: room.type,
        capacity: room.capacity ?? null,
        isTeachingSpace: room.isTeachingSpace,
        isSharedFacility: room.isSharedFacility,
      };
    });

  const occupancy = addLockedSessionOccupancy(emptyOccupancy(), lockedRows);

  const lineStates: UnassignedReadinessLine[] = demand.demandLines.map((line) => {
    const subject = subjectById.get(line.subjectId);
    const compatibleRooms =
      subject && policy
        ? filterCompatibleRooms(candidateRooms, { preferredRoomType: subject.preferredRoomType, gradeLevel: line.gradeLevel, enrolledCount: line.enrolledCount })
        : [];
    const slotVerdict =
      subject && policy
        ? searchCandidateSlots(
            line,
            weeklySlots,
            compatibleRooms,
            occupancy,
            { preferredRoomType: subject.preferredRoomType, gradeLevel: line.gradeLevel, enrolledCount: line.enrolledCount },
          )
        : {
            reason: 'NO_AVAILABLE_SLOT' as InsertionReason,
            feasible: false,
            freeSlots: 0,
            neededSlots: line.sessionsPerWeek,
            candidates: [],
            diagnostic: { compatibleRoomCount: 0, teacherBusySlots: 0, sectionBusySlots: 0, roomBusySlots: 0, evaluatedSlots: 0 },
          };
    const classification = classifyInsertionLine(line, slotVerdict, {
      termConfigured: Boolean(demand.termConfig && demand.termConfig.termIdentities.length > 0),
      currentSourceSha256: demand.sourceRevision.sha256,
    });
    return {
      ...line,
      state: classification.state,
      guidance: classification.guidance,
      candidates: slotVerdict.candidates,
      slotDiagnostic: slotVerdict.diagnostic,
    };
  });

  const breakdown = countBy(lineStates, (line) => line.state);
  let insertionReadyLines = 0;
  let unresolvedLines = 0;
  for (const line of lineStates) {
    if (line.state === 'INDIVIDUALLY_PREVIEWABLE') insertionReadyLines += 1;
    else unresolvedLines += 1;
  }

  return {
    scope: { schoolId, schoolYearId },
    termConfigPresent: demand.termConfig !== null,
    dayShapePresent: policy !== null && weeklySlots.length > 0,
    periodLengthMinutes: demand.periodLengthMinutes,
    demand: {
      totalLines: demand.totalLines,
      totalSessions: demand.totalSessions,
      totalsByTerm: demand.totalsByTerm,
    },
    ownership: demand.sourceRevision.teachingLoad,
    curriculum: demand.sourceRevision.offeringRevision,
    sections: demand.sourceRevision.sectionsRevision,
    hgExcluded: demand.hgExcluded,
    breakdown,
    insertionReadyLines,
    unresolvedLines,
    lineStates,
    sourceRevisionSha256: demand.sourceRevision.sha256,
    rooms: { teachingRoomCount, compatibleRoomCount: candidateRooms.length },
    lockedSessionCount: lockedRows.length,
    zeroWrite: true,
    liveGenerationRunCount: runCount,
  };
}

// ─── Preview (zero-write) ───

export interface InsertionPreviewResult {
  scope: { schoolId: number; schoolYearId: number };
  demandKey: string;
  line: UnassignedReadinessLine;
  candidates: CandidateSlot[];
  state: LinePlacementState;
  bound: {
    sourceRevisionSha256: string;
    cycleVersion: number;
    ownershipHash: string;
    runBinding: null;
  };
  fingerprint: string;
  zeroWrite: true;
}

function previewError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function buildInsertionFingerprint(input: {
  scope: { schoolId: number; schoolYearId: number };
  demandKey: string;
  sourceRevisionSha256: string;
  cycleVersion: number;
  ownershipHash: string;
  candidates: CandidateSlot[];
}): string {
  return `TTI_${sha256Hex(
    canonicalStringify({
      kind: 'TT_C02_INSERTION_V1',
      scope: input.scope,
      demandKey: input.demandKey,
      sourceRevisionSha256: input.sourceRevisionSha256,
      cycleVersion: input.cycleVersion,
      ownershipHash: input.ownershipHash,
      candidates: input.candidates.map((candidate) => ({
        day: candidate.day as any,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        roomId: candidate.roomId,
      })),
    }),
  )}`;
}

/**
 * Zero-write preview for one demanded meeting line. Binds the actor school,
 * active year, curriculum source revision, Teaching Load cycle/version,
 * ownership identity hash, term configuration, section/subject identity and
 * the candidate slot+room under one canonical SHA-256 fingerprint. Never
 * writes.
 */
export async function previewUnassignedInsertion(
  schoolId: number,
  schoolYearId: number,
  demandKey: string,
): Promise<InsertionPreviewResult> {
  const summary = await summarizeUnassignedInsertionReadiness(schoolId, schoolYearId);
  const line = summary.lineStates.find((candidate) => candidate.demandKey === demandKey);
  if (!line) {
    throw previewError(404, 'DEMAND_LINE_NOT_FOUND', `No demanded meeting line matches ${demandKey}.`);
  }
  if (line.state !== 'INDIVIDUALLY_PREVIEWABLE' || line.candidates.length === 0) {
    const candidates: CandidateSlot[] = [];
    return {
      scope: { schoolId, schoolYearId },
      demandKey,
      line,
      candidates,
      state: line.state,
      bound: {
        sourceRevisionSha256: summary.sourceRevisionSha256,
        cycleVersion: summary.ownership.cycleVersion,
        ownershipHash: summary.ownership.hash,
        runBinding: null,
      },
      fingerprint: buildInsertionFingerprint({
        scope: { schoolId, schoolYearId },
        demandKey,
        sourceRevisionSha256: summary.sourceRevisionSha256,
        cycleVersion: summary.ownership.cycleVersion,
        ownershipHash: summary.ownership.hash,
        candidates,
      }),
      zeroWrite: true,
    };
  }

  const candidates = line.candidates.slice(0, line.sessionsPerWeek);
  const fingerprint = buildInsertionFingerprint({
    scope: { schoolId, schoolYearId },
    demandKey,
    sourceRevisionSha256: summary.sourceRevisionSha256,
    cycleVersion: summary.ownership.cycleVersion,
    ownershipHash: summary.ownership.hash,
    candidates,
  });

  return {
    scope: { schoolId, schoolYearId },
    demandKey,
    line,
    candidates,
    state: 'INDIVIDUALLY_PREVIEWABLE',
    bound: {
      sourceRevisionSha256: summary.sourceRevisionSha256,
      cycleVersion: summary.ownership.cycleVersion,
      ownershipHash: summary.ownership.hash,
      runBinding: null,
    },
    fingerprint,
    zeroWrite: true,
  };
}
