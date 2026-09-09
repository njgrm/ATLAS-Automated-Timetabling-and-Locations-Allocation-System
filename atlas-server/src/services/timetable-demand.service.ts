/**
 * Timetable canonical-demand service (TT-C02).
 *
 * Builds the curriculum-derived timetable demand used by the unassigned
 * insertion workflow WITHOUT recreating curriculum or Teaching Load
 * authority:
 *
 *  - curriculum authority  -> persisted SchoolYearTermConfig +
 *                             SchoolYearOffering + OfferingTermAssignment
 *                             (read-only consumers of the SCA stream rows)
 *  - ownership authority    -> annual SubjectSectionOwnership scoped to
 *                             (schoolId, schoolYearId), matching the
 *                             effective consumer contract v2 semantics
 *                             (active, non-stale owner mirrors only;
 *                             unscoped legacy rows excluded)
 *  - HG exclusion           -> subject code `HG` never produces timetable
 *                             demand, never consumes slots/rooms, and is not
 *                             carried into any insertion candidate
 *
 * This module never writes, never edits curriculum/Teaching Load rows, and
 * never falls back to catalog suggestions, old templates, fixed subject
 * counts, school 1, year 8, or EnrollPro offering feeds.
 */

import { createHash } from 'node:crypto';
import { getDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import { normalizeGradeLevelSync } from './class-program-slot.service.js';
import { getTermConfig, type TermConfigData } from './term-config.service.js';
import type {
  OfferingClassification,
  ProgramType,
  TermMode,
  SubjectSectionOwnership,
  FacultySubject,
  FacultyMirror,
  SectionMirror,
  Subject,
} from '@prisma/client';

const db = () => getDataContext();

export const HG_SUBJECT_CODE = 'HG';
export const VALID_GRADE_LEVELS = new Set([7, 8, 9, 10]);

export function isHomeroomGuidanceCode(code: string | null | undefined): boolean {
  return (code ?? '').trim().toUpperCase() === HG_SUBJECT_CODE;
}

export interface TermReference {
  id: number;
  termCount: number;
  termIdentities: string[];
  isActive: boolean;
  updatedAt: string;
}

export interface DemandSourceRevision {
  sha256: string;
  termConfig: TermReference | null;
  offeringRevision: {
    activeOfferingCount: number;
    hash: string;
  };
  teachingLoad: {
    cycleVersion: number;
    ownershipCount: number;
    hash: string;
  };
  policyRevision: { id: number; updatedAt: string } | null;
  sectionsRevision: { activeSectionCount: number; hash: string };
}

export interface TimetableDemandLine {
  /** Stable identity of one demanded subject×section×term line. */
  demandKey: string;
  offeringId: number;
  offeringVersion: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  classification: OfferingClassification;
  rotationFamily: string | null;
  rotationOrder: number | null;
  termMode: Exclude<TermMode, 'EMPTY'>;
  termIdentity: string;
  termIndex: number;
  /** Terms this meeting line actually runs in (ordered). */
  applicableTermIdentities: string[];
  sectionMirrorId: number;
  sectionExternalId: number;
  sectionName: string;
  gradeLevel: number;
  programType: string;
  homeRoomId: number | null;
  buildingZoneId: string | null;
  maxCapacity: number;
  enrolledCount: number;
  weeklyMinutes: number;
  periodLengthMinutes: number;
  sessionsPerWeek: number;
  durationPerSessionMinutes: number;
  ownerFacultyId: number | null;
  ownerFacultyName: string | null;
  ownerState:
    | 'VALID'
    | 'MISSING'
    | 'INACTIVE_OR_STALE'
    | 'OUTSIDE_SCOPE'
    | 'NO_QUALIFIED_SCOPE';
}

export interface TimetableDemandResult {
  scope: { schoolId: number; schoolYearId: number };
  termConfig: TermReference | null;
  periodLengthMinutes: number;
  demandLines: TimetableDemandLine[];
  totalsByTerm: Record<string, number>;
  totalLines: number;
  totalSessions: number;
  /** Subjects/offerings skipped because they represent HG advisory demand. */
  hgExcluded: {
    offeringIds: number[];
    subjectCodes: string[];
    ownershipRows: number;
  };
  /** Per owner-state tallies (diagnostic, not a reason classification). */
  ownerStateTotals: Record<TimetableDemandLine['ownerState'], number>;
  sourceRevision: DemandSourceRevision;
}

interface RawOffering {
  id: number;
  subjectId: number | null;
  gradeLevel: number;
  programType: ProgramType;
  sectionMirrorId: number | null;
  cohortId: number | null;
  classification: OfferingClassification;
  weeklyMinutes: number;
  rotationFamily: string | null;
  rotationOrder: number | null;
  termMode: TermMode;
  isActive: boolean;
  version: number;
  updatedAt: Date;
  termAssignments: { termIdentity: string }[];
}

export interface DayShapePolicy {
  id: number;
  periodLengthMinutes: number;
  periodsPerDay: number;
  earliestStartTime: string;
  latestEndTime: string;
  updatedAt: Date;
}

const PROGRAM_ORDER = ['REGULAR', 'STE', 'SPA', 'SPS', 'OTHER'];

export function expectedProgramForSection(rawProgramType: string | null): string {
  const normalized = (rawProgramType ?? '').trim().toUpperCase();
  return PROGRAM_ORDER.includes(normalized) ? normalized : 'OTHER';
}

function sortTermIdentities(termIdentities: string[]): string[] {
  return [...termIdentities].sort((a, b) => a.localeCompare(b));
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').toUpperCase();
}

export function buildDemandLineKey(input: {
  subjectId: number;
  sectionExternalId: number;
  termIdentity: string;
}): string {
  return `${input.subjectId}:${input.sectionExternalId}:${input.termIdentity}`;
}

/**
 * Pure term-resolution of one persisted offering against a term config.
 * Returns `null` when the offering is not applicable to any configured term.
 * This is the canonical per-term projection used by demand expansion and is
 * intentionally free of DB access so it can be proven hermetically.
 */
export function resolveOfferingTerms(
  offering: {
    termMode: TermMode;
    rotationFamily: string | null;
    rotationOrder: number | null;
    termAssignments: { termIdentity: string }[];
  },
  termConfig: TermReference,
): { termIdentity: string; termIndex: number }[] {
  if (offering.termMode === 'EMPTY') return [];
  const configured = termConfig.termIdentities;
  if (!termConfig.isActive || configured.length === 0) return [];

  const resolved: { termIdentity: string; termIndex: number }[] = [];
  if (offering.termMode === 'ALL') {
    if (offering.termAssignments.length === 0) {
      // ALL = every configured term in order.
      for (const [index, term] of configured.entries()) {
        resolved.push({ termIdentity: term, termIndex: index + 1 });
      }
      return resolved;
    }
    // ALL with explicit assignments = exactly the assigned terms.
    for (const assignment of offering.termAssignments) {
      const index = configured.indexOf(assignment.termIdentity);
      if (index === -1) continue;
      resolved.push({ termIdentity: assignment.termIdentity, termIndex: index + 1 });
    }
    return sortTermIdentitiesByConfig(resolved, configured);
  }

  // ROTATING_FAMILY_MEMBER: exactly one assigned term; otherwise no truth.
  if (offering.termMode === 'ROTATING_FAMILY_MEMBER') {
    if (!offering.rotationFamily || offering.termAssignments.length !== 1) return [];
    const assignment = offering.termAssignments[0];
    const index = configured.indexOf(assignment.termIdentity);
    if (index === -1) return [];
    return [{ termIdentity: assignment.termIdentity, termIndex: index + 1 }];
  }

  return [];
}

function sortTermIdentitiesByConfig(
  resolved: { termIdentity: string; termIndex: number }[],
  configured: string[],
): { termIdentity: string; termIndex: number }[] {
  const order = new Map(configured.map((term, index) => [term, index]));
  return [...resolved].sort((a, b) => {
    const ao = order.get(a.termIdentity) ?? 0;
    const bo = order.get(b.termIdentity) ?? 0;
    return ao - bo;
  });
}

/**
 * Expand one persisted offering across matching active sections. Returns
 * section×term lines ready for ownership resolution. Sections match by:
 *  - sectionMirrorId  -> the exact active SectionMirror
 *  - cohortId         -> active sections whose externalId is a cohort member
 *  - base scope       -> active sections whose grade + program match
 */
export function expandOfferingAcrossSections(
  offering: RawOffering,
  termConfig: TermReference,
  activeSections: SectionMirror[],
  cohortMemberExternalIds: Map<number, Set<number>>,
  periodLengthMinutes: number,
): Array<{
  section: SectionMirror;
  terms: { termIdentity: string; termIndex: number }[];
}> {
  const applicableTerms = resolveOfferingTerms(offering, termConfig);
  if (applicableTerms.length === 0) return [];

  const candidates: SectionMirror[] = [];
  if (offering.sectionMirrorId !== null && offering.cohortId === null) {
    const exact = activeSections.find((section) => section.id === offering.sectionMirrorId);
    if (exact) candidates.push(exact);
  } else if (offering.cohortId !== null && offering.sectionMirrorId === null) {
    const memberExternalIds = cohortMemberExternalIds.get(offering.cohortId) ?? new Set<number>();
    for (const section of activeSections) {
      if (memberExternalIds.has(section.externalId)) candidates.push(section);
    }
  } else {
    const grade = offering.gradeLevel;
    const program = expectedProgramForSection(offering.programType);
    for (const section of activeSections) {
      const sectionGrade = normalizeGradeLevelSync(section.gradeLevelId);
      const sectionProgram = expectedProgramForSection(section.programType);
      if (
        sectionGrade === grade &&
        sectionProgram === program &&
        offering.gradeLevel === grade &&
        VALID_GRADE_LEVELS.has(grade)
      ) {
        candidates.push(section);
      }
    }
  }

  if (candidates.length === 0) return [];
  return candidates.map((section) => ({ section, terms: applicableTerms }));
}

export async function readDayShapePolicy(
  schoolId: number,
  schoolYearId: number,
): Promise<DayShapePolicy | null> {
  const policy = await db().schedulingPolicy.findUnique({
    where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    select: {
      id: true,
      periodLengthMinutes: true,
      periodsPerDay: true,
      earliestStartTime: true,
      latestEndTime: true,
      updatedAt: true,
    },
  });
  return policy;
}

interface OwnershipRowForDemand {
  subjectId: number;
  sectionId: number;
  facultyId: number;
  facultySubjectId: number;
}

interface OwnedFacultyView {
  isActiveForScheduling: boolean;
  isStale: boolean;
  name: string;
}

/**
 * Canonical curriculum -> timetable demand for one school year.
 * Zero writes. Read-only across curriculum, sections, Teaching Load, policy.
 */
export async function buildCanonicalTimetableDemand(
  schoolId: number,
  schoolYearId: number,
): Promise<TimetableDemandResult> {
  const termConfigRow = await getTermConfig(schoolId, schoolYearId);
  const termConfig: TermReference | null = termConfigRow
    ? {
        id: termConfigRow.id,
        termCount: termConfigRow.termCount,
        termIdentities: termConfigRow.termIdentities,
        isActive: termConfigRow.isActive,
        updatedAt: termConfigRow.updatedAt.toISOString(),
      }
    : null;

  const policy = await readDayShapePolicy(schoolId, schoolYearId);
  const periodLengthMinutes = policy?.periodLengthMinutes ?? 45;

  const [offerings, activeSections, cohorts, subjects, scopedOwnership, facultyRows, facultySubjects, cycle] =
    await Promise.all([
      db().schoolYearOffering.findMany({
        where: { schoolId, schoolYearId },
        include: { termAssignments: { select: { termIdentity: true } } },
      }),
      db().sectionMirror.findMany({
        where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false },
      }),
      db().instructionalCohort.findMany({
        where: { schoolId, schoolYearId, isActive: true },
        select: { id: true, cohortCode: true, memberSectionIds: true },
      }),
      db().subject.findMany({
        where: { schoolId },
      }),
      db().subjectSectionOwnership.findMany({
        where: { schoolId, schoolYearId },
      }),
      db().facultyMirror.findMany({
        where: { schoolId },
        select: {
          id: true,
          externalId: true,
          firstName: true,
          lastName: true,
          isActiveForScheduling: true,
          isStale: true,
          version: true,
        },
      }),
      db().facultySubject.findMany({
        where: { schoolId, schoolYearId },
      }),
      db().teachingLoadCycle.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
      }),
    ]);

  const subjectByCode = new Map<string, Subject>();
  const subjectById = new Map<number, Subject>();
  for (const subject of subjects) {
    subjectByCode.set(subject.code, subject);
    subjectById.set(subject.id, subject);
  }

  const cohortMemberExternalIds = new Map<number, Set<number>>();
  for (const cohort of cohorts) {
    cohortMemberExternalIds.set(cohort.id, new Set(cohort.memberSectionIds));
  }

  // Set-based ownership index: (subjectId:sectionExternalId) -> owner rows.
  const ownershipBySubjectSection = new Map<string, OwnershipRowForDemand[]>();
  let hgOwnershipRows = 0;
  for (const row of scopedOwnership) {
    const subject = subjectById.get(row.subjectId);
    if (subject && isHomeroomGuidanceCode(subject.code)) {
      hgOwnershipRows += 1;
      continue; // HG ownership is advisory evidence only, never timetable demand.
    }
    const key = `${row.subjectId}:${row.sectionId}`;
    const list = ownershipBySubjectSection.get(key);
    if (list) list.push(row);
    else ownershipBySubjectSection.set(key, [row]);
  }

  const facultyById = new Map<number, OwnedFacultyView & { externalId: number; version: number }>();
  for (const faculty of facultyRows) {
    facultyById.set(faculty.id, {
      externalId: faculty.externalId,
      name: `${faculty.firstName} ${faculty.lastName}`.trim(),
      isActiveForScheduling: faculty.isActiveForScheduling,
      isStale: faculty.isStale,
      version: faculty.version,
    });
  }

  // FacultySubject scope index: facultyId -> subjectId -> scope row.
  const scopeByFacultySubject = new Map<string, FacultySubject>();
  for (const fs of facultySubjects) {
    scopeByFacultySubject.set(`${fs.facultyId}:${fs.subjectId}`, fs);
  }

  const activeOfferings = offerings
    .filter((offering) => offering.isActive && offering.retiredAt === null)
    .filter((offering) => {
      if (offering.subjectId === null) return true; // explicit EMPTY marker row
      const subject = subjectById.get(offering.subjectId);
      if (!subject) return false;
      if (isHomeroomGuidanceCode(subject.code)) return false; // HG never timetable demand
      return subject.isActive;
    });

  const hgExcludedOfferingIds: number[] = [];
  const hgExcludedSubjectCodes: string[] = [];
  for (const offering of offerings) {
    if (!offering.isActive) continue;
    const subject = offering.subjectId === null ? undefined : subjectById.get(offering.subjectId);
    if (subject && isHomeroomGuidanceCode(subject.code)) {
      hgExcludedOfferingIds.push(offering.id);
      hgExcludedSubjectCodes.push(subject.code);
    }
  }

  const demandLines: TimetableDemandLine[] = [];
  const totalsByTerm: Record<string, number> = {};
  const ownerStateTotals = {
    VALID: 0,
    MISSING: 0,
    INACTIVE_OR_STALE: 0,
    OUTSIDE_SCOPE: 0,
    NO_QUALIFIED_SCOPE: 0,
  } as Record<TimetableDemandLine['ownerState'], number>;
  let totalSessions = 0;

  for (const offering of activeOfferings) {
    if (offering.subjectId === null || offering.termMode === 'EMPTY') continue;
    const subject = subjectById.get(offering.subjectId);
    if (!subject || isHomeroomGuidanceCode(subject.code)) continue;
    if (!termConfig) continue;

    const applicableTerms = resolveOfferingTerms(offering, termConfig);
    if (applicableTerms.length === 0) continue;

    const expansion = expandOfferingAcrossSections(
      offering as RawOffering,
      termConfig,
      activeSections,
      cohortMemberExternalIds,
      periodLengthMinutes,
    );

    for (const { section } of expansion) {
      for (const term of applicableTerms) {
        const key = buildDemandLineKey({
          subjectId: offering.subjectId,
          sectionExternalId: section.externalId,
          termIdentity: term.termIdentity,
        });
        const ownerRows = ownershipBySubjectSection.get(`${offering.subjectId}:${section.externalId}`) ?? [];

        let ownerFacultyId: number | null = null;
        let ownerFacultyName: string | null = null;
        let ownerState: TimetableDemandLine['ownerState'] = 'MISSING';
        if (ownerRows.length > 0) {
          const owner = ownerRows[0];
          const faculty = facultyById.get(owner.facultyId);
          ownerFacultyId = owner.facultyId;
          if (!faculty || faculty.isStale || !faculty.isActiveForScheduling) {
            ownerState = 'INACTIVE_OR_STALE';
            ownerFacultyName = faculty?.name ?? null;
          } else {
            ownerFacultyName = faculty.name;
            const scope = scopeByFacultySubject.get(`${owner.facultyId}:${offering.subjectId}`);
            if (!scope) {
              ownerState = 'OUTSIDE_SCOPE';
            } else {
              const sectionGrade = normalizeGradeLevelSync(section.gradeLevelId);
              const inGradeLevels = (scope.gradeLevels ?? []).includes(sectionGrade);
              const inSectionIds = (scope.sectionIds ?? []).includes(section.externalId);
              if (!inGradeLevels && !inSectionIds) {
                ownerState = 'NO_QUALIFIED_SCOPE';
              } else {
                ownerState = 'VALID';
              }
            }
          }
        }

        const sessions = Math.max(1, Math.ceil(offering.weeklyMinutes / Math.max(1, periodLengthMinutes)));
        const line: TimetableDemandLine = {
          demandKey: key,
          offeringId: offering.id,
          offeringVersion: offering.version,
          subjectId: offering.subjectId,
          subjectCode: subject.code,
          subjectName: subject.name,
          classification: offering.classification,
          rotationFamily: offering.rotationFamily,
          rotationOrder: offering.rotationOrder,
          termMode: offering.termMode === 'ALL' ? 'ALL' : 'ROTATING_FAMILY_MEMBER',
          termIdentity: term.termIdentity,
          termIndex: term.termIndex,
          applicableTermIdentities: applicableTerms.map((t) => t.termIdentity),
          sectionMirrorId: section.id,
          sectionExternalId: section.externalId,
          sectionName: section.name,
          gradeLevel: normalizeGradeLevelSync(section.gradeLevelId),
          programType: expectedProgramForSection(section.programType),
          homeRoomId: section.homeRoomId,
          buildingZoneId: section.buildingZoneId,
          maxCapacity: section.maxCapacity,
          enrolledCount: section.enrolledCount,
          weeklyMinutes: offering.weeklyMinutes,
          periodLengthMinutes,
          sessionsPerWeek: sessions,
          durationPerSessionMinutes: periodLengthMinutes,
          ownerFacultyId,
          ownerFacultyName,
          ownerState,
        };
        demandLines.push(line);
        totalsByTerm[term.termIdentity] = (totalsByTerm[term.termIdentity] ?? 0) + sessions;
        totalSessions += sessions;
        ownerStateTotals[ownerState] += 1;
      }
    }
  }

  demandLines.sort((a, b) =>
    `${a.gradeLevel}:${a.programType}:${a.sectionExternalId}:${a.subjectId}:${a.termIndex}`.localeCompare(
      `${b.gradeLevel}:${b.programType}:${b.sectionExternalId}:${b.subjectId}:${b.termIndex}`,
    ),
  );

  const sourceRevision = computeDemandSourceRevision({
    termConfig: termConfigRow
      ? {
          id: termConfigRow.id,
          termCount: termConfigRow.termCount,
          termIdentities: sortTermIdentities(termConfigRow.termIdentities),
          isActive: termConfigRow.isActive,
          updatedAt: termConfigRow.updatedAt.toISOString(),
        }
      : null,
    offerings: activeOfferings.map((offering) => ({
      id: offering.id,
      subjectId: offering.subjectId,
      gradeLevel: offering.gradeLevel,
      programType: offering.programType,
      sectionMirrorId: offering.sectionMirrorId,
      cohortId: offering.cohortId,
      classification: offering.classification,
      weeklyMinutes: offering.weeklyMinutes,
      rotationFamily: offering.rotationFamily,
      rotationOrder: offering.rotationOrder,
      termMode: offering.termMode,
      version: offering.version,
      termIdentities: sortTermIdentities(offering.termAssignments.map((t) => t.termIdentity)),
    })),
    ownershipRows: scopedOwnership
      .filter((row) => {
        const subject = subjectById.get(row.subjectId);
        return !subject || !isHomeroomGuidanceCode(subject.code);
      })
      .map((row) => ({
        id: row.id,
        subjectId: row.subjectId,
        sectionId: row.sectionId,
        facultyId: row.facultyId,
        facultySubjectId: row.facultySubjectId,
      })),
    cycleVersion: cycle?.version ?? 0,
    policyRevision: policy ? { id: policy.id, updatedAt: policy.updatedAt.toISOString() } : null,
    activeSections: activeSections
      .map((section) => ({
        id: section.id,
        externalId: section.externalId,
        name: section.name,
        gradeLevelId: section.gradeLevelId,
        programType: section.programType,
      }))
      .sort((a, b) => a.id - b.id),
  });

  return {
    scope: { schoolId, schoolYearId },
    termConfig,
    periodLengthMinutes,
    demandLines,
    totalsByTerm,
    totalLines: demandLines.length,
    totalSessions,
    hgExcluded: {
      offeringIds: [...new Set(hgExcludedOfferingIds)].sort((a, b) => a - b),
      subjectCodes: [...new Set(hgExcludedSubjectCodes)].sort(),
      ownershipRows: hgOwnershipRows,
    },
    ownerStateTotals,
    sourceRevision,
  };
}

export function computeDemandSourceRevision(input: {
  termConfig: TermReference | null;
  offerings: unknown[];
  ownershipRows: unknown[];
  cycleVersion: number;
  policyRevision: { id: number; updatedAt: string } | null;
  activeSections: unknown[];
}): DemandSourceRevision {
  const offeringHash = sha256Hex(canonicalStringify(input.offerings));
  const ownershipHash = sha256Hex(canonicalStringify(input.ownershipRows));
  const sectionsHash = sha256Hex(canonicalStringify(input.activeSections));

  const payload = {
    kind: 'TIMETABLE_DEMAND_SOURCE_V1',
    termConfig: input.termConfig
      ? {
          id: input.termConfig.id,
          termIdentities: sortTermIdentities(input.termConfig.termIdentities),
          isActive: input.termConfig.isActive,
          updatedAt: input.termConfig.updatedAt,
        }
      : null,
    offeringRevisionHash: offeringHash,
    teachingLoad: {
      cycleVersion: input.cycleVersion,
      ownershipHash,
    },
    policyRevision: input.policyRevision,
    sectionsRevisionHash: sectionsHash,
  };

  const sha256 = sha256Hex(canonicalStringify(payload));
  return {
    sha256,
    termConfig: input.termConfig
      ? {
          id: input.termConfig.id,
          termCount: input.termConfig.termCount,
          termIdentities: sortTermIdentities(input.termConfig.termIdentities),
          isActive: input.termConfig.isActive,
          updatedAt: input.termConfig.updatedAt,
        }
      : null,
    offeringRevision: { activeOfferingCount: (input.offerings as unknown[]).length, hash: offeringHash },
    teachingLoad: {
      cycleVersion: input.cycleVersion,
      ownershipCount: (input.ownershipRows as unknown[]).length,
      hash: ownershipHash,
    },
    policyRevision: input.policyRevision,
    sectionsRevision: { activeSectionCount: (input.activeSections as unknown[]).length, hash: sectionsHash },
  };
}

export function serializeOwnershipRows(rows: SubjectSectionOwnership[]): unknown {
  return rows
    .map((row) => ({
      id: row.id,
      subjectId: row.subjectId,
      sectionId: row.sectionId,
      facultyId: row.facultyId,
      facultySubjectId: row.facultySubjectId,
    }))
    .sort((a, b) => a.id - b.id);
}

export function summarizeFacultyView(faculty: FacultyMirror): unknown {
  return {
    id: faculty.id,
    externalId: faculty.externalId,
    firstName: faculty.firstName,
    lastName: faculty.lastName,
    isActiveForScheduling: faculty.isActiveForScheduling,
    isStale: faculty.isStale,
    version: faculty.version,
  };
}

export function summarizeFacultySubjectScope(fs: FacultySubject): unknown {
  return {
    id: fs.id,
    facultyId: fs.facultyId,
    subjectId: fs.subjectId,
    gradeLevels: [...(fs.gradeLevels ?? [])].sort((a, b) => a - b),
    sectionIds: [...(fs.sectionIds ?? [])].sort((a, b) => a - b),
    version: fs.version,
  };
}
