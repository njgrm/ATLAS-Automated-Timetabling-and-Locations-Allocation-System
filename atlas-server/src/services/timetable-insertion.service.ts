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
 * is never silently changed). The preview is zero-write; apply is privileged,
 * fingerprint-bound, runs in a Serializable transaction, touches ONLY
 * timetable draft state (pre-generation LockedSession rows), never Teaching
 * Load/curriculum/subjects/sections/publication, and is idempotent by
 * fingerprint. Run-bound unassigned placement deliberately delegates to the
 * existing generated-run manual-edit PLACE_UNASSIGNED flows.
 */

import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
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

export type LinePlacementState = InsertionReason | 'PLACEABLE';

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
  reason: InsertionReason | 'PLACEABLE';
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
  reason: 'PLACEABLE',
  action: 'OPEN_DRAFT',
  message: 'Ownership, rooms, and free weekly slots exist for this meeting.',
  prerequisite: 'None.',
  primaryAction: 'Preview a candidate placement.',
};

export function guidanceFor(reason: InsertionReason | 'PLACEABLE'): ReasonGuidance {
  return reason === 'PLACEABLE' ? PLACEABLE_GUIDANCE : REASON_GUIDANCE[reason];
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
  subject: { preferredRoomType: string; gradeLevel: number },
): boolean {
  if (!room.isTeachingSpace || room.isSharedFacility) return false;
  if (room.buildingGradeScope.length > 0 && !room.buildingGradeScope.includes(subject.gradeLevel)) return false;
  if (room.capacity !== null && room.capacity < 1) return false;
  return room.type === subject.preferredRoomType || room.type === 'CLASSROOM';
}

export function filterCompatibleRooms(
  rooms: CandidateRoom[],
  subject: { preferredRoomType: string; gradeLevel: number },
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
  teacher: Set<string>;
  section: Set<string>;
  room: Set<string>;
}

export function emptyOccupancy(): OccupancyState {
  return { teacher: new Set(), section: new Set(), room: new Set() };
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
    teacher: new Set(state.teacher),
    section: new Set(state.section),
    room: new Set(state.room),
  };
  for (const lock of locks) {
    if (lock.facultyId !== null) next.teacher.add(`${lock.facultyId}|${lock.day}|${lock.startTime}`);
    next.section.add(`${lock.sectionId}|${lock.day}|${lock.startTime}`);
    if (lock.roomId !== null) next.room.add(`${lock.roomId}|${lock.day}|${lock.startTime}`);
  }
  return next;
}

export interface CandidateSlot extends WeeklySlot {
  roomId: number;
  roomName: string;
}

export interface InsertionSearchResult {
  reason: InsertionReason | 'PLACEABLE';
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
  subject: { preferredRoomType: string; gradeLevel: number },
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
  if (line.subjectCode === HG_SUBJECT_CODE) {
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
    const slotId = `${slot.day}|${slot.startTime}`;
    const teacherFree = !occupancy.teacher.has(`${teacher}|${slotId}`);
    const sectionFree = !occupancy.section.has(`${section}|${slotId}`);
    if (!teacherFree) {
      teacherBusySlots += 1;
      continue;
    }
    if (!sectionFree) {
      sectionBusySlots += 1;
      continue;
    }
    const room = compatibleRooms.find((candidate) => !occupancy.room.has(`${candidate.id}|${slotId}`));
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
      reason: 'PLACEABLE',
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
  if (line.subjectCode === HG_SUBJECT_CODE) {
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
  if (slotVerdict.reason !== 'PLACEABLE') {
    return { state: slotVerdict.reason, guidance: guidanceFor(slotVerdict.reason) };
  }
  return { state: 'PLACEABLE', guidance: guidanceFor('PLACEABLE') };
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
        ? filterCompatibleRooms(candidateRooms, { preferredRoomType: subject.preferredRoomType, gradeLevel: line.gradeLevel })
        : [];
    const slotVerdict =
      subject && policy
        ? searchCandidateSlots(
            line,
            weeklySlots,
            compatibleRooms,
            occupancy,
            { preferredRoomType: subject.preferredRoomType, gradeLevel: line.gradeLevel },
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
    if (line.state === 'PLACEABLE') insertionReadyLines += 1;
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
    throw err(404, 'DEMAND_LINE_NOT_FOUND', `No demanded meeting line matches ${demandKey}.`);
  }
  if (line.state !== 'PLACEABLE' || line.candidates.length === 0) {
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
    state: 'PLACEABLE',
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

// ─── Apply (privileged, fingerprint-bound, pre-generation draft only) ───

export interface InsertionApplyInput {
  schoolId: number;
  schoolYearId: number;
  actorId: number;
  actorSchoolId: number;
  previewFingerprint: string;
  confirm: boolean;
  demandKey: string;
  candidateIndex: number;
}

export interface InsertionApplyResult {
  applied: boolean;
  alreadyApplied: boolean;
  lockedSessionId: number | null;
  auditLogId: number | null;
  action: string;
}

function err(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

/**
 * Privileged, fingerprint-bound apply. Writes ONLY a pre-generation draft
 * LockedSession row (authorized timetable draft state) plus its
 * LockedSessionAction and one audit log. It never updates Teaching Load,
 * curriculum, subjects, sections, generation runs, or publication. All
 * authority is revalidated inside a Serializable transaction; stale or
 * conflicting source state fails with a typed 409; a repeated fingerprint is
 * idempotent (no duplicate row, no duplicate audit).
 *
 * Insertion semantics: each apply places exactly ONE weekly session of a
 * demanded line (one LockedSession row at one day/time/room), matching the
 * per-session manual PLACE_UNASSIGNED contract used for generated runs. A
 * line with `sessionsPerWeek > 1` requires one apply per session; because the
 * first insert changes draft occupancy, each additional session is placed
 * through a fresh preview whose fingerprint binds the updated candidate list.
 * A repeated apply of the same fingerprint + candidate index is a no-op.
 */
export async function applyUnassignedInsertion(input: InsertionApplyInput): Promise<InsertionApplyResult> {
  if (input.actorSchoolId !== input.schoolId) {
    throw err(403, 'CROSS_SCHOOL_DENIED', 'Cannot insert timetable meetings for another school.');
  }
  if (input.confirm !== true) {
    throw err(400, 'CONFIRM_REQUIRED', 'Insertion apply requires confirm=true.');
  }
  if (typeof input.previewFingerprint !== 'string' || !input.previewFingerprint.startsWith('TTI_')) {
    throw err(400, 'FINGERPRINT_REQUIRED', 'A valid previewFingerprint is required to apply.');
  }
  if (!Number.isInteger(input.candidateIndex) || input.candidateIndex < 0) {
    throw err(400, 'INVALID_CANDIDATE_INDEX', 'candidateIndex must be a non-negative integer.');
  }

  const client = db();

  // 1. Idempotency guard FIRST: the exact preview fingerprint already applied
  //    is a no-op. This must precede fingerprint recomputation because a prior
  //    apply legitimately changed the draft occupancy the fingerprint covers.
  const priorAudit = await client.auditLog.findFirst({
    where: {
      schoolId: input.schoolId,
      schoolYearId: input.schoolYearId,
      action: 'TIMETABLE_INSERTION_APPLIED',
      metadata: { path: ['previewFingerprint'], equals: input.previewFingerprint },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (priorAudit) {
    return {
      applied: false,
      alreadyApplied: true,
      lockedSessionId: null,
      auditLogId: priorAudit.id,
      action: 'TIMETABLE_INSERTION_ALREADY_APPLIED',
    };
  }

  // 2. Recompute the canonical fingerprint against CURRENT COMMITTED authority
  //    before opening the write transaction. Any drift from the previewed
  //    fingerprint rejects with a typed 409 (stale or conflicting source).
  const demand = await buildCanonicalTimetableDemand(input.schoolId, input.schoolYearId);
  const line = demand.demandLines.find((candidate) => candidate.demandKey === input.demandKey);
  if (!line) {
    throw err(404, 'DEMAND_LINE_NOT_FOUND', `No demanded meeting line matches ${input.demandKey}.`);
  }
  if (line.subjectCode === HG_SUBJECT_CODE) {
    throw err(409, 'HG_FORBIDDEN', 'Homeroom Guidance can never become a timetable meeting.');
  }
  const summary = await summarizeUnassignedInsertionReadiness(input.schoolId, input.schoolYearId);
  const targetLine = summary.lineStates.find((candidate) => candidate.demandKey === input.demandKey);
  if (!targetLine || targetLine.state !== 'PLACEABLE') {
    throw err(409, 'INSERTION_NOT_PLACEABLE', `Meeting is not placeable (${targetLine?.state ?? 'unknown'}).`);
  }
  const candidate = targetLine.candidates[input.candidateIndex];
  if (!candidate) {
    throw err(409, 'INSERTION_CANDIDATE_CHANGED', 'The chosen candidate no longer exists. Re-preview.');
  }

  // searchCandidateSlots is deterministic, so re-searching under the same
  // committed authority reproduces the exact previewed candidate list.
  const expected = buildInsertionFingerprint({
    scope: { schoolId: input.schoolId, schoolYearId: input.schoolYearId },
    demandKey: input.demandKey,
    sourceRevisionSha256: demand.sourceRevision.sha256,
    cycleVersion: demand.sourceRevision.teachingLoad.cycleVersion,
    ownershipHash: demand.sourceRevision.teachingLoad.hash,
    candidates: targetLine.candidates,
  });
  if (expected !== input.previewFingerprint) {
    const details = {
      previewFingerprint: input.previewFingerprint,
      recomputedFingerprint: expected,
      recomputedCandidates: targetLine.candidates.map((c) => `${c.day}|${c.startTime}|${c.roomId}`).join(','),
      slotDiagnostic: targetLine.slotDiagnostic,
      sourceRevisionSha256: demand.sourceRevision.sha256,
      ownershipHash: demand.sourceRevision.teachingLoad.hash,
      cycleVersion: demand.sourceRevision.teachingLoad.cycleVersion,
    };
    const error = err(
      409,
      'INSERTION_STALE_AUTHORITY',
      'Curriculum, Teaching Load, policy, or rooms changed since the preview. Refresh and re-preview before applying.',
    ) as Error & { statusCode: number; code: string; details?: unknown };
    error.details = details;
    throw error;
  }

  // 2. Serializable write transaction: idempotency guard, occupancy recheck
  //    for the exact candidate, then commit ONLY the draft row + its action +
  //    one audit log atomically. Concurrent duplicates are also blocked by the
  //    locked_session unique key.
  return client.$transaction(
    async (tx) => {
      const priorAudit = await tx.auditLog.findFirst({
        where: {
          schoolId: input.schoolId,
          schoolYearId: input.schoolYearId,
          action: 'TIMETABLE_INSERTION_APPLIED',
          metadata: { path: ['previewFingerprint'], equals: input.previewFingerprint },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (priorAudit) {
        return {
          applied: false,
          alreadyApplied: true,
          lockedSessionId: null,
          auditLogId: priorAudit.id,
          action: 'TIMETABLE_INSERTION_ALREADY_APPLIED',
        };
      }

      const slotScope = {
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        status: 'DRAFT' as const,
        day: candidate.day as never,
        startTime: candidate.startTime,
      };
      const [sectionBusy, teacherBusy, roomBusy] = await Promise.all([
        tx.lockedSession.findFirst({
          where: { ...slotScope, entryKind: 'SECTION', sectionId: line.sectionExternalId },
          select: { id: true },
        }),
        line.ownerFacultyId === null
          ? Promise.resolve(null)
          : tx.lockedSession.findFirst({
              where: { ...slotScope, facultyId: line.ownerFacultyId },
              select: { id: true },
            }),
        tx.lockedSession.findFirst({ where: { ...slotScope, roomId: candidate.roomId }, select: { id: true } }),
      ]);
      if (sectionBusy || teacherBusy || roomBusy) {
        throw err(409, 'HARD_CONFLICT', 'That weekly slot is already occupied for this section, owner, or room.');
      }

      try {
        const lock = await tx.lockedSession.create({
          data: {
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            entryKind: 'SECTION',
            sectionId: line.sectionExternalId,
            subjectId: line.subjectId,
            facultyId: line.ownerFacultyId,
            roomId: candidate.roomId,
            cohortCode: null,
            status: 'DRAFT',
            notes: 'TT-C02 unassigned insertion',
            day: candidate.day as never,
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            termIndex: line.termIndex,
            createdBy: input.actorId,
          },
        });

        await tx.lockedSessionAction.create({
          data: {
            lockId: lock.id,
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            actorId: input.actorId,
            actionType: 'INSERT_UNASSIGNED_MEETING',
            beforePayload: Prisma.JsonNull,
            afterPayload: {
              demandKey: input.demandKey,
              day: candidate.day,
              startTime: candidate.startTime,
              endTime: candidate.endTime,
              roomId: candidate.roomId,
              subjectId: line.subjectId,
              sectionId: line.sectionExternalId,
              facultyId: line.ownerFacultyId,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        const audit = await tx.auditLog.create({
          data: {
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            action: 'TIMETABLE_INSERTION_APPLIED',
            actorId: input.actorId,
            targetIds: [lock.id],
            metadata: {
              previewFingerprint: input.previewFingerprint,
              demandKey: input.demandKey,
              day: candidate.day,
              startTime: candidate.startTime,
              endTime: candidate.endTime,
              roomId: candidate.roomId,
              lockedSessionId: lock.id,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        return {
          applied: true,
          alreadyApplied: false,
          lockedSessionId: lock.id,
          auditLogId: audit.id,
          action: 'TIMETABLE_INSERTION_APPLIED',
        };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw err(409, 'HARD_CONFLICT', 'That weekly slot already exists for this section and subject.');
        }
        throw error;
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 },
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: string };
    return candidate.code === 'P2002';
  }
  return false;
}
