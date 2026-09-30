/**
 * A6 — Teaching Load placement-feasibility check (operator decision 14, 2026-09-30).
 *
 * "Teaching Load never saves a load the timetable cannot place." This module is
 * the ONE zero-write check used by the preview route, the single-assignment save
 * (`setAssignments`) and "Apply suggested" (`applyTeachingLoadSuggestionProposal`).
 *
 * REUSE, NOT A SECOND SCHEDULER (packet §1). Every scheduling decision delegates
 * to the existing generator-aligned primitives:
 *   - demand          -> `buildCanonicalTimetableDemand` / `readDayShapePolicy`
 *   - weekly shape    -> `buildWeeklyDayShape`
 *   - occupancy       -> `emptyOccupancy` / `addLockedSessionOccupancy`
 *   - slot search     -> `searchCandidateSlots` (bounded, `MAX_EVALUATED_SLOTS`)
 *   - conflict/rooms  -> reached through `searchCandidateSlots`
 *                        (`evaluateCandidateInvariants` via
 *                        `evaluateInsertionCandidateInvariants`,
 *                        `filterCompatibleRooms`)
 *   - reason wording  -> `InsertionReason` / `guidanceFor` (no new codes)
 *   - term scope      -> `entryTermScope` / `effectiveTermsOverlap` (shared)
 *   - qualification   -> `qualification-evaluator.service.ts`
 *
 * OCCUPANCY BASIS. The two sources the generator's own read paths use:
 *   1. DRAFT `locked_session` rows for the school/year (`room-schedule.service`,
 *      `timetable-insertion.service`);
 *   2. the latest COMPLETED `generationRun.draftEntries` placement set — the
 *      Makabansa case is only reproducible when the other sections' placed
 *      sessions count as teacher occupation.
 * Term scoping is applied with the SHARED `entryTermScope` / `effectiveTermsOverlap`
 * primitives before the shared `addLockedSessionOccupancy` is asked for the
 * per-line occupancy. No third occupancy model and no local overlap/time/term
 * arithmetic is introduced (pinned by `a6-tl-placement.reuse.test.ts`).
 *
 * ZERO WRITES. The preview is read-only; the write gates only refuse.
 */
import { getDataContext } from '../lib/data-context.js';
import {
  addLockedSessionOccupancy,
  buildWeeklyDayShape,
  emptyOccupancy,
  filterCompatibleRooms,
  guidanceFor,
  searchCandidateSlots,
  type CandidateRoom,
  type InsertionReason,
  type OccupancyState,
  type WeeklySlot,
} from './timetable-insertion.service.js';
import {
  buildCanonicalTimetableDemand,
  readDayShapePolicy,
  type TimetableDemandLine,
} from './timetable-demand.service.js';
import { entryTermScope, effectiveTermsOverlap } from './effective-scheduled-resources.js';
import {
  buildQualificationPolicySnapshot,
  evaluateQualificationWithPolicy,
  resolveSubjectAllowedOwnerDepartments,
  type QualificationPolicy,
} from './qualification-evaluator.service.js';
import type { ProgramType } from '@prisma/client';

const db = () => getDataContext();

const MAX_ALTERNATIVE_CANDIDATES = 60;
const MAX_ALTERNATIVES = 3;

// ─── Public contract ────────────────────────────────────────────────────────

/** One requested line: assign `facultyId` to `subjectId` for `sectionId` (external id). */
export interface PlacementCheckLineRequest {
  sectionId: number;
  subjectId: number;
  facultyId: number;
}

/** One occupancy reservation from a DRAFT lock row or an active draft-run entry. */
export interface PlacementOccupancyLock {
  sectionId: number;
  subjectId?: number;
  facultyId: number | null;
  roomId: number | null;
  day: string;
  startTime: string;
  endTime: string;
  termIndex?: number | null;
}

export interface PlacementAlternative {
  facultyId: number;
  facultyName: string;
  day: string;
  startTime: string;
  endTime: string;
}

/** The one plain sentence + one-click alternative the client renders. */
export interface PlacementBlocker {
  sectionId: number;
  subjectId: number;
  facultyId: number;
  sectionName: string;
  subjectName: string;
  facultyName: string;
  sentence: string;
  alternatives: PlacementAlternative[];
}

export interface PlacementLineVerdict {
  sectionId: number;
  subjectId: number;
  facultyId: number;
  sectionName: string;
  subjectName: string;
  facultyName: string;
  placeable: boolean;
  reason: InsertionReason | 'INDIVIDUALLY_PREVIEWABLE';
  sentence: string | null;
  alternatives: PlacementAlternative[];
  /** Sum of teacher-blocked slots across the pair's terms (>0 means teacher-blocked). */
  teacherBusySlots: number;
}

export interface PlacementSubjectMeta {
  preferredRoomType: string;
  code: string;
  name: string;
}

export interface PlacementSectionMeta {
  name: string;
  gradeLevel: number;
  enrolledCount: number;
  programType: string;
}

export interface PlacementEvaluatorInput {
  request: PlacementCheckLineRequest[];
  demandLines: TimetableDemandLine[];
  weeklySlots: WeeklySlot[];
  usableRooms: CandidateRoom[];
  occupancyLocks: PlacementOccupancyLock[];
  subjectMeta: Map<number, PlacementSubjectMeta>;
  sectionMeta: Map<number, PlacementSectionMeta>;
  facultyMeta: Map<number, string>;
  /** Qualified replacement teachers, keyed `${subjectId}:${programType}`. */
  qualifiedAlternatives?: Map<string, Array<{ facultyId: number; facultyName: string }>>;
}

export interface PlacementCheckResult {
  schoolId: number;
  schoolYearId: number;
  zeroWrite: true;
  /** True when the canonical demand authority resolved. */
  demandReady: boolean;
  /** True when the check could actually evaluate slots (demand + day shape + rooms). */
  evaluated: boolean;
  lines: PlacementLineVerdict[];
}

export interface PlacementWriteGateResult {
  placeable: boolean;
  demandReady: boolean;
  blockers: PlacementBlocker[];
}

export type PlacementServiceError = Error & {
  statusCode: number;
  code: string;
  details?: Record<string, unknown>;
};

function placementError(statusCode: number, code: string, message: string, details?: Record<string, unknown>): PlacementServiceError {
  const error = new Error(message) as PlacementServiceError;
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
}

// ─── Pure evaluator (DB-free) ───────────────────────────────────────────────

function occupancyForTerm(locks: PlacementOccupancyLock[], termIndex: number | null | undefined): OccupancyState {
  const term = entryTermScope({ termIndex: termIndex ?? undefined });
  const applicable = locks
    .filter((lock) => effectiveTermsOverlap(entryTermScope(lock), term))
    .map((lock) => ({
      sectionId: lock.sectionId,
      subjectId: lock.subjectId ?? 0,
      facultyId: lock.facultyId,
      roomId: lock.roomId,
      day: lock.day,
      startTime: lock.startTime,
      endTime: lock.endTime,
    }));
  return addLockedSessionOccupancy(emptyOccupancy(), applicable);
}

const REASON_PRIORITY: Array<InsertionReason | 'INDIVIDUALLY_PREVIEWABLE'> = [
  'HG_FORBIDDEN',
  'NO_COMPATIBLE_ROOM',
  'NO_AVAILABLE_SLOT',
  'HARD_CONFLICT',
  'MISSING_TEACHING_LOAD_OWNER',
  'OWNER_INACTIVE_OR_STALE',
  'OWNER_OUTSIDE_SCOPE',
  'NO_QUALIFIED_OWNER',
  'TERM_APPLICABILITY_MISMATCH',
  'SOURCE_STALE',
];

function chooseReason(reasons: Set<InsertionReason | 'INDIVIDUALLY_PREVIEWABLE'>): InsertionReason | 'INDIVIDUALLY_PREVIEWABLE' {
  for (const candidate of REASON_PRIORITY) {
    if (reasons.has(candidate)) return candidate;
  }
  return 'HARD_CONFLICT';
}

function buildSentence(sectionName: string, subjectName: string, facultyName: string, reason: InsertionReason): string {
  switch (reason) {
    case 'NO_AVAILABLE_SLOT':
      return `${sectionName} cannot fit ${subjectName}: ${facultyName} is already booked at the only free time.`;
    case 'NO_COMPATIBLE_ROOM':
      return `${sectionName} cannot fit ${subjectName}: no compatible room is free.`;
    case 'HARD_CONFLICT':
      return `${sectionName} cannot fit ${subjectName}: every open time overlaps another class.`;
    case 'HG_FORBIDDEN':
      return `${sectionName} cannot be scheduled for ${subjectName}: Homeroom Guidance is never walked as a class.`;
    default:
      return `${sectionName} cannot be scheduled for ${subjectName}: ${guidanceFor(reason).message}`;
  }
}

function subjectInput(subject: PlacementSubjectMeta, section: PlacementSectionMeta) {
  return {
    preferredRoomType: subject.preferredRoomType,
    gradeLevel: section.gradeLevel,
    enrolledCount: section.enrolledCount,
  };
}

/**
 * Pure, DB-free per-line verdicts. Demand lines + weekly slots + compatible
 * rooms + occupancy in; verdicts out. Every slot decision is delegated to
 * `searchCandidateSlots`.
 */
export function evaluatePlacementVerdicts(input: PlacementEvaluatorInput): PlacementLineVerdict[] {
  const verdicts: PlacementLineVerdict[] = [];
  for (const request of input.request) {
    verdicts.push(evaluateOnePlacementLine(input, request));
  }
  return verdicts;
}

function evaluateOnePlacementLine(input: PlacementEvaluatorInput, request: PlacementCheckLineRequest): PlacementLineVerdict {
  const section = input.sectionMeta.get(request.sectionId) ?? null;
  const subject = input.subjectMeta.get(request.subjectId) ?? null;
  const sectionName = section?.name ?? `Section ${request.sectionId}`;
  const subjectName = subject?.name ?? `Subject ${request.subjectId}`;
  const facultyName = input.facultyMeta.get(request.facultyId) ?? `Teacher ${request.facultyId}`;

  const demandLines = input.demandLines.filter(
    (line) => line.sectionExternalId === request.sectionId && line.subjectId === request.subjectId,
  );
  // No canonical demand for this pair: there is nothing for the timetable to place.
  if (demandLines.length === 0 || !section || !subject) {
    return {
      sectionId: request.sectionId,
      subjectId: request.subjectId,
      facultyId: request.facultyId,
      sectionName,
      subjectName,
      facultyName,
      placeable: true,
      reason: 'INDIVIDUALLY_PREVIEWABLE',
      sentence: null,
      alternatives: [],
      teacherBusySlots: 0,
    };
  }

  const subjectSpec = subjectInput(subject, section);
  const compatibleRooms = filterCompatibleRooms(input.usableRooms, subjectSpec);

  const reasons = new Set<InsertionReason | 'INDIVIDUALLY_PREVIEWABLE'>();
  let teacherBusySlots = 0;
  for (const line of demandLines) {
    const occupancy = occupancyForTerm(input.occupancyLocks, line.termIndex);
    const search = searchCandidateSlots(
      { ...line, ownerFacultyId: request.facultyId },
      input.weeklySlots,
      compatibleRooms,
      occupancy,
      subjectSpec,
    );
    teacherBusySlots += search.diagnostic.teacherBusySlots;
    if (!search.feasible) reasons.add(search.reason);
  }

  if (reasons.size === 0) {
    return {
      sectionId: request.sectionId,
      subjectId: request.subjectId,
      facultyId: request.facultyId,
      sectionName,
      subjectName,
      facultyName,
      placeable: true,
      reason: 'INDIVIDUALLY_PREVIEWABLE',
      sentence: null,
      alternatives: [],
      teacherBusySlots,
    };
  }

  const reason = chooseReason(reasons);
  return {
    sectionId: request.sectionId,
    subjectId: request.subjectId,
    facultyId: request.facultyId,
    sectionName,
    subjectName,
    facultyName,
    placeable: false,
    reason,
    sentence: buildSentence(sectionName, subjectName, facultyName, reason === 'INDIVIDUALLY_PREVIEWABLE' ? 'HARD_CONFLICT' : reason),
    alternatives: findAlternatives(input, request, section, subject, demandLines, compatibleRooms, subjectSpec),
    teacherBusySlots,
  };
}

/** A replacement teacher is offered only when every applicable term still fits. */
function findAlternatives(
  input: PlacementEvaluatorInput,
  request: PlacementCheckLineRequest,
  section: PlacementSectionMeta,
  subject: PlacementSubjectMeta,
  demandLines: TimetableDemandLine[],
  compatibleRooms: CandidateRoom[],
  subjectSpec: { preferredRoomType: string; gradeLevel: number; enrolledCount: number },
): PlacementAlternative[] {
  const key = `${request.subjectId}:${(section.programType ?? 'REGULAR').toUpperCase()}`;
  const candidates = input.qualifiedAlternatives?.get(key) ?? [];
  const alternatives: PlacementAlternative[] = [];
  for (const candidate of candidates.slice(0, MAX_ALTERNATIVE_CANDIDATES)) {
    if (candidate.facultyId === request.facultyId) continue;
    let fits = true;
    let firstSlot: WeeklySlot | null = null;
    for (const line of demandLines) {
      const occupancy = occupancyForTerm(input.occupancyLocks, line.termIndex);
      const search = searchCandidateSlots(
        { ...line, ownerFacultyId: candidate.facultyId },
        input.weeklySlots,
        compatibleRooms,
        occupancy,
        subjectSpec,
      );
      if (!search.feasible) {
        fits = false;
        break;
      }
      if (!firstSlot && search.candidates.length > 0) firstSlot = search.candidates[0]!;
    }
    if (fits && firstSlot) {
      alternatives.push({
        facultyId: candidate.facultyId,
        facultyName: candidate.facultyName,
        day: firstSlot.day,
        startTime: firstSlot.startTime,
        endTime: firstSlot.endTime,
      });
    }
    if (alternatives.length >= MAX_ALTERNATIVES) break;
  }
  return alternatives;
}

export function placementBlockersFromVerdicts(lines: PlacementLineVerdict[]): PlacementBlocker[] {
  return lines
    .filter((line) => !line.placeable)
    .map((line) => ({
      sectionId: line.sectionId,
      subjectId: line.subjectId,
      facultyId: line.facultyId,
      sectionName: line.sectionName,
      subjectName: line.subjectName,
      facultyName: line.facultyName,
      sentence: line.sentence ?? buildSentence(line.sectionName, line.subjectName, line.facultyName, line.reason === 'INDIVIDUALLY_PREVIEWABLE' ? 'HARD_CONFLICT' : line.reason),
      alternatives: line.alternatives,
    }));
}

// ─── Loader (bounded, read-only) ────────────────────────────────────────────

interface PlacementSubjectRow {
  id: number;
  code: string;
  name: string;
  ownerDepartment: string | null;
  allowedSpecializations: string[];
  requiredFeatures: string[];
  programScopes: string[];
}

interface PreparedPlacementInput {
  demandReady: boolean;
  input: Omit<PlacementEvaluatorInput, 'request' | 'qualifiedAlternatives'>;
  subjectsById: Map<number, PlacementSubjectRow>;
  programTypeBySection: Map<number, string>;
}

function facultyDisplayName(row: { firstName?: string | null; lastName?: string | null }): string {
  return `${(row.firstName ?? '').trim()} ${(row.lastName ?? '').trim()}`.trim() || 'Unnamed teacher';
}

async function preparePlacementInput(schoolId: number, schoolYearId: number): Promise<PreparedPlacementInput> {
  const demand = await buildCanonicalTimetableDemand(schoolId, schoolYearId);
  const demandReady = demand.derivedDemandBlockers.length === 0;
  const policy = await readDayShapePolicy(schoolId, schoolYearId);
  const weeklySlots = policy ? buildWeeklyDayShape(policy) : [];

  const [roomRows, buildingRows, lockRows, subjectRows, draftRun] = await Promise.all([
    db().room.findMany({ where: { building: { schoolId } } }),
    db().building.findMany({ where: { schoolId } }),
    db().lockedSession.findMany({
      where: { schoolId, schoolYearId, status: 'DRAFT' },
      select: { sectionId: true, subjectId: true, facultyId: true, roomId: true, day: true, startTime: true, endTime: true, termIndex: true },
    }),
    db().subject.findMany({
      where: { schoolId },
      select: { id: true, code: true, name: true, ownerDepartment: true, allowedSpecializations: true, requiredFeatures: true, programScopes: true, preferredRoomType: true },
    }),
    db().generationRun.findFirst({
      where: { schoolId, schoolYearId, status: 'COMPLETED' },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, draftEntries: true },
    }),
  ]);

  const buildingById = new Map(buildingRows.map((building: any) => [building.id, building]));
  const usableRooms: CandidateRoom[] = roomRows
    .filter((room: any) => {
      const building = buildingById.get(room.buildingId);
      return Boolean(building && building.schoolId === schoolId && room.isTeachingSpace);
    })
    .map((room: any) => {
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

  const runEntries: any[] = Array.isArray(draftRun?.draftEntries) ? (draftRun!.draftEntries as any[]) : [];
  const occupancyLocks: PlacementOccupancyLock[] = [
    ...lockRows.map((lock: any) => ({
      sectionId: lock.sectionId,
      subjectId: lock.subjectId,
      facultyId: lock.facultyId ?? null,
      roomId: lock.roomId ?? null,
      day: lock.day,
      startTime: lock.startTime,
      endTime: lock.endTime,
      termIndex: lock.termIndex ?? null,
    })),
    ...runEntries.map((entry: any) => ({
      sectionId: entry?.sectionId,
      subjectId: entry?.subjectId,
      facultyId: typeof entry?.facultyId === 'number' ? entry.facultyId : null,
      roomId: typeof entry?.roomId === 'number' ? entry.roomId : null,
      day: entry?.day,
      startTime: entry?.startTime,
      endTime: entry?.endTime,
      termIndex: typeof entry?.termIndex === 'number' ? entry.termIndex : null,
    })).filter((entry: PlacementOccupancyLock) => Number.isInteger(entry.sectionId) && typeof entry.day === 'string' && typeof entry.startTime === 'string' && typeof entry.endTime === 'string'),
  ];

  const subjectMeta = new Map<number, PlacementSubjectMeta>();
  const subjectsById = new Map<number, PlacementSubjectRow>();
  for (const subject of subjectRows as any[]) {
    subjectsById.set(subject.id, {
      id: subject.id,
      code: subject.code,
      name: subject.name,
      ownerDepartment: subject.ownerDepartment ?? null,
      allowedSpecializations: Array.isArray(subject.allowedSpecializations) ? subject.allowedSpecializations : [],
      requiredFeatures: Array.isArray(subject.requiredFeatures) ? subject.requiredFeatures : [],
      programScopes: Array.isArray(subject.programScopes) ? subject.programScopes : [],
    });
    subjectMeta.set(subject.id, { preferredRoomType: subject.preferredRoomType ?? 'CLASSROOM', code: subject.code, name: subject.name });
  }

  const sectionMeta = new Map<number, PlacementSectionMeta>();
  const programTypeBySection = new Map<number, string>();
  for (const line of demand.demandLines) {
    if (!sectionMeta.has(line.sectionExternalId)) {
      sectionMeta.set(line.sectionExternalId, {
        name: line.sectionName,
        gradeLevel: line.gradeLevel,
        enrolledCount: line.enrolledCount,
        programType: line.programType ?? 'REGULAR',
      });
      programTypeBySection.set(line.sectionExternalId, line.programType ?? 'REGULAR');
    }
  }

  return {
    demandReady,
    input: { demandLines: demand.demandLines, weeklySlots, usableRooms, occupancyLocks, subjectMeta, sectionMeta, facultyMeta: new Map() },
    subjectsById,
    programTypeBySection,
  };
}

async function loadQualificationPolicy(schoolId: number): Promise<QualificationPolicy> {
  const [aliasRows, labelRows, prefixRows, permRows] = await Promise.all([
    db().departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
    db().departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
    db().subjectOwnerPrefix.findMany({ where: { schoolId }, select: { prefix: true, department: true } }),
    db().crossDepartmentPermission.findMany({ where: { schoolId }, select: { facultyId: true, subjectId: true } }),
  ]);
  return buildQualificationPolicySnapshot(schoolId, {
    departmentAliases: aliasRows as any,
    departmentLabels: labelRows as any,
    subjectOwnerPrefixes: prefixRows as any,
    crossDepartmentPermissions: permRows as any,
    // Match `getPolicy` in the canonical evaluator: legacy name/prefix fallbacks
    // stay available for qualification, exactly as the manual/cover paths see them.
    legacyCrossLanguageException: true,
    persistedOnly: false,
  });
}

async function resolveQualifiedAlternatives(
  schoolId: number,
  request: PlacementCheckLineRequest[],
  prepared: PreparedPlacementInput,
): Promise<Map<string, Array<{ facultyId: number; facultyName: string }>>> {
  const result = new Map<string, Array<{ facultyId: number; facultyName: string }>>();
  const subjectIds = [...new Set(request.map((line) => line.subjectId))];
  if (subjectIds.length === 0) return result;

  const policy = await loadQualificationPolicy(schoolId);
  const facultyRows = await db().facultyMirror.findMany({
    where: { schoolId, isActiveForScheduling: true, isStale: false, isPlaceholder: false },
    select: { id: true, firstName: true, lastName: true, department: true, specialization: true, canTeachOutsideDepartment: true },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  const neededPairs = new Set<string>();
  for (const line of request) {
    const programType = prepared.programTypeBySection.get(line.sectionId) ?? 'REGULAR';
    neededPairs.add(`${line.subjectId}:${programType.toUpperCase()}`);
  }

  for (const pair of neededPairs) {
    const [subjectIdRaw, programType] = pair.split(':');
    const subjectId = Number(subjectIdRaw);
    const subject = prepared.subjectsById.get(subjectId);
    if (!subject) continue;
    const allowedDepartments = resolveSubjectAllowedOwnerDepartments(
      subject.ownerDepartment,
      subject.code,
      subject.name,
      subject.requiredFeatures,
      policy,
    );
    const candidates: Array<{ facultyId: number; facultyName: string }> = [];
    for (const faculty of facultyRows as any[]) {
      const evaluation = evaluateQualificationWithPolicy(
        {
          facultyId: faculty.id,
          facultyDepartment: faculty.department ?? null,
          facultySpecialization: faculty.specialization ?? null,
          canTeachOutsideDepartment: faculty.canTeachOutsideDepartment === true,
          subjectId,
          subjectCode: subject.code,
          subjectName: subject.name,
          subjectOwnerDepartment: subject.ownerDepartment,
          subjectAllowedDepartments: allowedDepartments,
          subjectAllowedSpecializations: subject.allowedSpecializations,
          subjectProgramScopes: subject.programScopes as ProgramType[],
          sectionProgramType: programType as ProgramType,
        },
        policy,
      );
      if (evaluation.eligible) {
        candidates.push({ facultyId: faculty.id, facultyName: facultyDisplayName(faculty) });
      }
    }
    result.set(pair, candidates);
  }
  return result;
}

/**
 * Bounded, zero-write placement check for a small set of requested lines.
 * `demandReady:false` means the canonical demand authority is unavailable: the
 * check then reports every line placeable (it cannot know) rather than locking
 * the operator out of Teaching Load during an unrelated demand outage.
 */
export async function checkTeachingLoadPlacement(
  schoolId: number,
  schoolYearId: number,
  request: PlacementCheckLineRequest[],
): Promise<PlacementCheckResult> {
  const prepared = await preparePlacementInput(schoolId, schoolYearId);
  // Not evaluable: without the canonical demand, a configured day shape, or any
  // teaching room the check cannot know a slot, so it must not claim a block.
  // This keeps an unrelated demand/policy/room-setup gap from locking the
  // operator out of Teaching Load.
  if (!prepared.demandReady || prepared.input.weeklySlots.length === 0 || prepared.input.usableRooms.length === 0) {
    return {
      schoolId,
      schoolYearId,
      zeroWrite: true,
      demandReady: prepared.demandReady,
      evaluated: false,
      lines: request.map((line) => buildPermissiveVerdict(line, prepared)),
    };
  }

  const facultyIds = [...new Set(request.map((line) => line.facultyId))];
  const facultyMeta = new Map<number, string>();
  if (facultyIds.length > 0) {
    const rows = await db().facultyMirror.findMany({
      where: { id: { in: facultyIds }, schoolId },
      select: { id: true, firstName: true, lastName: true },
    });
    for (const row of rows as any[]) facultyMeta.set(row.id, facultyDisplayName(row));
  }

  const qualifiedAlternatives = await resolveQualifiedAlternatives(schoolId, request, prepared);

  const lines = evaluatePlacementVerdicts({
    ...prepared.input,
    facultyMeta,
    request,
    qualifiedAlternatives,
  });

  return { schoolId, schoolYearId, zeroWrite: true, demandReady: true, evaluated: true, lines };
}

function buildPermissiveVerdict(line: PlacementCheckLineRequest, prepared: PreparedPlacementInput): PlacementLineVerdict {
  const section = prepared.input.sectionMeta.get(line.sectionId) ?? null;
  const subject = prepared.input.subjectMeta.get(line.subjectId) ?? null;
  return {
    sectionId: line.sectionId,
    subjectId: line.subjectId,
    facultyId: line.facultyId,
    sectionName: section?.name ?? `Section ${line.sectionId}`,
    subjectName: subject?.name ?? `Subject ${line.subjectId}`,
    facultyName: `Teacher ${line.facultyId}`,
    placeable: true,
    reason: 'INDIVIDUALLY_PREVIEWABLE',
    sentence: null,
    alternatives: [],
    teacherBusySlots: 0,
  };
}

/**
 * The write gate used by `setAssignments` and `applyTeachingLoadSuggestionProposal`.
 * Read-only; the caller refuses with a typed 409 and writes nothing when
 * `placeable` is false.
 */
export async function evaluatePlacementWriteGate(
  schoolId: number,
  schoolYearId: number,
  lines: PlacementCheckLineRequest[],
): Promise<PlacementWriteGateResult> {
  if (lines.length === 0) return { placeable: true, demandReady: true, blockers: [] };
  try {
    const result = await checkTeachingLoadPlacement(schoolId, schoolYearId, lines);
    const blockers = placementBlockersFromVerdicts(result.lines);
    return { placeable: blockers.length === 0, demandReady: result.demandReady, blockers };
  } catch (error) {
    // This gate is an advisory guard, not the authority that makes a save
    // correct: the DB-level ownership/version guards remain authoritative. If
    // the check itself cannot run (e.g. a data-access context that does not
    // expose the timetable models), it must not turn a legitimate save into a
    // server error. The failure is logged, and the operator-facing preview
    // route still fails loudly.
    console.warn('[ATLAS] placement check unavailable; save proceeds unchecked:', String((error as Error)?.message ?? error));
    return { placeable: true, demandReady: false, blockers: [] };
  }
}

export { placementError };
