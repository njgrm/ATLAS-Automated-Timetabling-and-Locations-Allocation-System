import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import {
  buildSectionRosterIndex,
  deriveGradeLevelsFromSectionIds,
  normalizeIncomingAssignmentScope,
  normalizeStoredAssignmentScope,
  type AssignmentScopeInput,
  type NormalizedAssignmentScope,
} from './faculty-assignment-scope.service.js';

export type AssignmentMutationResult =
| {
success: true;
version: number;
  }
| {
success: false;
code:
| 'FACULTY_NOT_FOUND'
| 'FACULTY_INACTIVE'
| 'VERSION_CONFLICT'
| 'SCHOOL_SCOPE_MISMATCH'
| 'INVALID_SUBJECTS'
| 'INVALID_ASSIGNMENT_SCOPE'
| 'DUPLICATE_SECTION_OWNERSHIP'
| 'HG_ADVISORY_IMMUTABLE';
error: string;
details?: Record<string, unknown>;
  };

type AssignmentMutationErrorCode = Exclude<AssignmentMutationResult, { success: true }>['code'];

type AssignmentLoadShape = {
  subject: { minMinutesPerWeek: number };
  sectionIds: number[];
  gradeLevels: number[];
};

export type TeachingLoadFormula = 'section' | 'grade';

export type DuplicateOwnershipInput = {
  facultyId: number;
  facultyName: string;
  subjectId: number;
  sectionIds: number[];
};

export type DuplicateOwnershipTuple = {
  subjectId: number;
  sectionId: number;
  owners: Array<{ facultyId: number; facultyName: string }>;
};

export type OwnershipConflictCandidate = {
  subjectId: number;
  sectionId: number;
  facultyId: number;
};

export type OwnershipConflictDetail = {
  subjectId: number;
  sectionId: number;
  ownerFacultyId: number;
  ownerFacultyName: string;
};

export type SubjectSectionOwnershipIndexEntry = {
  subjectId: number;
  sectionId: number;
  facultyId: number;
  facultyName: string;
};

export type TeachingLoadAssignmentKind = 'REAL_OWNERSHIP' | 'BASELINE_ONLY' | 'MISSING_OWNERSHIP';

export interface TeachingLoadCoverageTotals {
  assignedPairs: number;
  totalPairs: number;
  unassignedPairs: number;
}

export interface TeachingLoadIntegrityDiagnosticRow {
  facultyId: number;
  facultyName: string;
  subjectId: number;
  subjectCode: string;
  sectionCount: number;
}

export interface TeachingLoadIntegrityDiagnostics {
  emptySectionRows: number;
  currentYearRowsMissingOwnership: number;
  currentYearOwnershipWithoutMatchingScope: number;
  currentYearMissingOwnershipPairs: number;
  currentYearOwnershipWithoutMatchingScopePairs: number;
  emptySectionSamples: TeachingLoadIntegrityDiagnosticRow[];
  missingOwnershipSamples: TeachingLoadIntegrityDiagnosticRow[];
  ownershipWithoutScopeSamples: TeachingLoadIntegrityDiagnosticRow[];
}

export interface TeachingLoadTruthReconcileInput {
  schoolId: number;
  schoolYearId: number;
  actorId: number;
  authToken?: string;
  previewOnly?: boolean;
}

export interface TeachingLoadTruthReconcileResult {
  applied: boolean;
  schoolId: number;
  schoolYearId: number;
  facultySubjectRowsScanned: number;
  rowsWithEmptySectionIds: number;
  rowsWithMissingOwnership: number;
  rowsWithOwnershipWithoutScope: number;
  rowsToUpdate: number;
  updatedRows: number;
  sampleUpdates: Array<{
    facultySubjectId: number;
    facultyId: number;
    subjectId: number;
    previousCurrentYearSectionCount: number;
    nextCurrentYearSectionCount: number;
  }>;
}

export function computeTeachingLoadMinutes(
  assignments: AssignmentLoadShape[],
  formula: TeachingLoadFormula,
): number {
  return assignments.reduce((sum, assignment) => {
    const units = formula === 'section' ? assignment.sectionIds.length : assignment.gradeLevels.length;
    return sum + assignment.subject.minMinutesPerWeek * units;
  }, 0);
}

export function detectDuplicateOwnershipTuples(
  assignments: DuplicateOwnershipInput[],
): DuplicateOwnershipTuple[] {
  const ownership = new Map<
    string,
    {
      subjectId: number;
      sectionId: number;
      owners: Map<number, string>;
    }
  >();

  for (const assignment of assignments) {
    for (const sectionId of assignment.sectionIds) {
      const key = `${assignment.subjectId}:${sectionId}`;
      const existing =
        ownership.get(key) ??
        {
          subjectId: assignment.subjectId,
          sectionId,
          owners: new Map<number, string>(),
        };
      existing.owners.set(assignment.facultyId, assignment.facultyName);
      ownership.set(key, existing);
    }
  }

  return Array.from(ownership.values())
    .filter((entry) => entry.owners.size > 1)
    .map((entry) => ({
      subjectId: entry.subjectId,
      sectionId: entry.sectionId,
      owners: Array.from(entry.owners.entries())
        .map(([facultyId, facultyName]) => ({ facultyId, facultyName }))
        .sort((a, b) => a.facultyId - b.facultyId),
    }))
    .sort((a, b) => {
      if (a.subjectId !== b.subjectId) {
        return a.subjectId - b.subjectId;
      }
      return a.sectionId - b.sectionId;
    });
}

export function buildOwnershipConflictDetails(
  conflicts: OwnershipConflictCandidate[],
  ownerNamesByFacultyId: Map<number, string>,
): OwnershipConflictDetail[] {
  return conflicts.map((conflict) => ({
    subjectId: conflict.subjectId,
    sectionId: conflict.sectionId,
    ownerFacultyId: conflict.facultyId,
    ownerFacultyName: ownerNamesByFacultyId.get(conflict.facultyId) ?? `Faculty #${conflict.facultyId}`,
  }));
}

export function buildDuplicateOwnershipBlockingResult(
  conflicts: OwnershipConflictCandidate[],
  ownerNamesByFacultyId: Map<number, string>,
): AssignmentMutationResult | null {
  if (conflicts.length === 0) {
    return null;
  }

  const details = buildOwnershipConflictDetails(conflicts, ownerNamesByFacultyId);
  return buildServiceError(
    'DUPLICATE_SECTION_OWNERSHIP',
    `One or more subject-section pairs are already assigned to another faculty member. ${details
      .slice(0, 3)
      .map(
        (conflict) =>
          `${conflict.ownerFacultyName} already owns subject ${conflict.subjectId} / section ${conflict.sectionId}`,
      )
      .join('; ')}${details.length > 3 ? ` (+${details.length - 3} more)` : ''}`,
    { conflicts: details },
  );
}

function formatFacultyName(firstName: string, lastName: string): string {
return `${lastName}, ${firstName}`;
}

function normalizeProgramType(value: string | null | undefined): string {
  return (value ?? 'REGULAR').trim().toUpperCase();
}

function normalizeGradeLevel(value: number): number {
  if (!Number.isFinite(value)) return value;
  if (value >= 100) {
    const normalized = value % 100;
    if (normalized >= 1 && normalized <= 12) return normalized;
  }
  return value;
}

function gradeLevelMatches(gradeLevels: number[], sectionGradeLevel: number): boolean {
  if (!Array.isArray(gradeLevels) || gradeLevels.length === 0) return true;
  const normalizedSectionGrade = normalizeGradeLevel(sectionGradeLevel);
  return gradeLevels.some((gradeLevel) => gradeLevel === sectionGradeLevel || normalizeGradeLevel(gradeLevel) === normalizedSectionGrade);
}

function isProgramScopeCompatible(scopes: string[] | undefined, sectionProgramType: string): boolean {
  if (!scopes || scopes.length === 0) return true;
  const normalizedProgramType = normalizeProgramType(sectionProgramType);
  return scopes.some((scope) => normalizeProgramType(scope) === normalizedProgramType);
}

function getRelevantSectionIdsForSubject(
  subject: { gradeLevels: number[]; programScopes: string[] },
  sections: Array<{ id: number; gradeLevel: number; programType: string }>,
): number[] {
  return sections
    .filter((section) => {
      const gradeAllowed = gradeLevelMatches(subject.gradeLevels, section.gradeLevel);
      if (!gradeAllowed) return false;
      return isProgramScopeCompatible(subject.programScopes, section.programType);
    })
    .map((section) => section.id);
}

export interface ActiveSubjectCoverageRow {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  isActive: boolean;
  relevantSectionCount: number;
  ownedSectionCount: number;
  ownedByPlaceholderCount: number;
  ownedByRealFacultyCount: number;
  uncoveredSectionCount: number;
  coveragePercent: number;
  status: 'FULL' | 'PARTIAL' | 'ZERO';
  placeholderFacultyIds: number[];
}

export interface ActiveSubjectCoverageSummary {
  rows: ActiveSubjectCoverageRow[];
  zeroCoverageSubjectCodes: string[];
  partiallyCoveredSubjectCodes: string[];
  fullyCoveredSubjectCodes: string[];
}

export interface PlaceholderCoverageRepairInput {
  schoolId: number;
  schoolYearId: number;
  assignedBy: number;
  authToken?: string;
  subjectCodes?: string[];
  apply?: boolean;
}

export interface PlaceholderCoverageRepairResult {
  applied: boolean;
  before: ActiveSubjectCoverageSummary;
  after: ActiveSubjectCoverageSummary;
  createdPlaceholders: Array<{ facultyId: number; subjectCode: string }>;
  reusedPlaceholders: Array<{ facultyId: number; subjectCode: string }>;
  sectionsCoveredByPlaceholder: number;
  placeholderAssignmentsUpserted: number;
  resolvedSubjectCodes: string[];
  stillUncoveredSubjectCodes: string[];
}

async function loadCoverageContext(schoolId: number, schoolYearId: number, authToken?: string) {
  const [sectionResult, subjects, ownerships, facultyIndex] = await Promise.all([
    sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken),
    prisma.subject.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, code: true, name: true, isActive: true, gradeLevels: true, programScopes: true },
      orderBy: { code: 'asc' },
    }),
    prisma.subjectSectionOwnership.findMany({
      where: { schoolId },
      select: { subjectId: true, sectionId: true, facultyId: true },
    }),
    prisma.facultyMirror.findMany({
      where: { schoolId, isStale: false, isActiveForScheduling: true },
      select: { id: true, isPlaceholder: true },
    }),
  ]);

  const sections: Array<{ id: number; gradeLevel: number; programType: string }> = [];
  for (const grade of sectionResult.gradeLevels) {
    for (const section of grade.sections) {
      if (!section.id || section.id <= 0) continue;
      sections.push({
        id: section.id,
        gradeLevel: grade.displayOrder,
        programType: section.programType ?? 'REGULAR',
      });
    }
  }

  const activeFacultyIdSet = new Set(facultyIndex.map((entry) => entry.id));
  const placeholderByFacultyId = new Map(facultyIndex.map((entry) => [entry.id, entry.isPlaceholder]));
  const activeOwnerships = ownerships.filter((entry) => activeFacultyIdSet.has(entry.facultyId));

  return {
    subjects,
    sections,
    ownerships: activeOwnerships,
    placeholderByFacultyId,
  };
}

export async function getActiveSubjectCoverageSummary(
  schoolId: number,
  schoolYearId: number,
  authToken?: string,
): Promise<ActiveSubjectCoverageSummary> {
  const context = await loadCoverageContext(schoolId, schoolYearId, authToken);

  const rows: ActiveSubjectCoverageRow[] = context.subjects.map((subject) => {
    const relevantSectionIds = getRelevantSectionIdsForSubject(subject, context.sections);
    const relevantSectionSet = new Set(relevantSectionIds);
    const subjectOwnership = context.ownerships.filter((entry) => entry.subjectId === subject.id && relevantSectionSet.has(entry.sectionId));
    const ownedSectionIds = new Set(subjectOwnership.map((entry) => entry.sectionId));
    const placeholderOwnership = subjectOwnership.filter((entry) => context.placeholderByFacultyId.get(entry.facultyId) === true);
    const placeholderSectionIds = new Set(placeholderOwnership.map((entry) => entry.sectionId));
    const ownedByPlaceholderCount = placeholderSectionIds.size;
    const ownedByRealFacultyCount = Math.max(0, ownedSectionIds.size - ownedByPlaceholderCount);
    const uncoveredSectionCount = Math.max(0, relevantSectionIds.length - ownedSectionIds.size);
    const coveragePercent = relevantSectionIds.length > 0
      ? Math.round((ownedSectionIds.size / relevantSectionIds.length) * 10000) / 100
      : 100;
    const status: 'FULL' | 'PARTIAL' | 'ZERO' = coveredStatus(ownedSectionIds.size, relevantSectionIds.length);

    return {
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      isActive: subject.isActive,
      relevantSectionCount: relevantSectionIds.length,
      ownedSectionCount: ownedSectionIds.size,
      ownedByPlaceholderCount,
      ownedByRealFacultyCount,
      uncoveredSectionCount,
      coveragePercent,
      status,
      placeholderFacultyIds: [...new Set(placeholderOwnership.map((entry) => entry.facultyId))].sort((a, b) => a - b),
    };
  });

  const sortedRows = [...rows].sort((left, right) => {
    if (left.uncoveredSectionCount !== right.uncoveredSectionCount) {
      return right.uncoveredSectionCount - left.uncoveredSectionCount;
    }
    return left.subjectCode.localeCompare(right.subjectCode);
  });

  return {
    rows: sortedRows,
    zeroCoverageSubjectCodes: sortedRows.filter((row) => row.status === 'ZERO' && row.relevantSectionCount > 0).map((row) => row.subjectCode),
    partiallyCoveredSubjectCodes: sortedRows.filter((row) => row.status === 'PARTIAL').map((row) => row.subjectCode),
    fullyCoveredSubjectCodes: sortedRows.filter((row) => row.status === 'FULL').map((row) => row.subjectCode),
  };
}

function coveredStatus(ownedCount: number, relevantCount: number): 'FULL' | 'PARTIAL' | 'ZERO' {
  if (relevantCount === 0 || ownedCount >= relevantCount) return 'FULL';
  if (ownedCount <= 0) return 'ZERO';
  return 'PARTIAL';
}

async function ensureSubjectPlaceholderFaculty(
  tx: any,
  schoolId: number,
  subjectCode: string,
): Promise<{ facultyId: number; created: boolean }> {
  const firstName = 'Teacher X';
  const lastName = subjectCode;

  const existing = await tx.facultyMirror.findFirst({
    where: {
      schoolId,
      isPlaceholder: true,
      firstName,
      lastName,
      isStale: false,
    },
    select: { id: true },
  });

  if (existing) {
    return { facultyId: existing.id, created: false };
  }

  const minExternal = await tx.facultyMirror.aggregate({
    where: { schoolId },
    _min: { externalId: true },
  });
  const nextExternalId = minExternal._min.externalId != null
    ? Math.min(minExternal._min.externalId - 1, -1)
    : -1;

  const created = await tx.facultyMirror.create({
    data: {
      schoolId,
      externalId: nextExternalId,
      firstName,
      lastName,
      department: 'PLACEHOLDER',
      specialization: subjectCode,
      employmentStatus: 'PLACEHOLDER',
      isPlaceholder: true,
      isActiveForScheduling: true,
      canTeachOutsideDepartment: true,
      maxHoursPerWeek: 30,
      ancillaryLoadSource: 'NONE',
      localNotes: `Auto-created coverage placeholder for ${subjectCode}`,
      isStale: false,
    },
    select: { id: true },
  });

  return { facultyId: created.id, created: true };
}

export async function repairActiveSubjectCoverageWithPlaceholders(
  input: PlaceholderCoverageRepairInput,
): Promise<PlaceholderCoverageRepairResult> {
  const apply = input.apply === true;
  const before = await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken);
  const requested = input.subjectCodes?.length
    ? new Set(input.subjectCodes.map((code) => code.trim().toUpperCase()))
    : null;

  const context = await loadCoverageContext(input.schoolId, input.schoolYearId, input.authToken);
  const subjectsToRepair = context.subjects.filter((subject) => {
    if (requested && !requested.has(subject.code.toUpperCase())) return false;
    const beforeRow = before.rows.find((row) => row.subjectId === subject.id);
    return Boolean(beforeRow && beforeRow.uncoveredSectionCount > 0);
  });

  const createdPlaceholders: Array<{ facultyId: number; subjectCode: string }> = [];
  const reusedPlaceholders: Array<{ facultyId: number; subjectCode: string }> = [];
  let sectionsCoveredByPlaceholder = 0;
  let placeholderAssignmentsUpserted = 0;

  if (apply && subjectsToRepair.length > 0) {
    for (const subject of subjectsToRepair) {
      await prisma.$transaction(async (tx) => {
        const relevantSectionIds = getRelevantSectionIdsForSubject(subject, context.sections);
        if (relevantSectionIds.length === 0) return;

        const existingOwnership = await tx.subjectSectionOwnership.findMany({
          where: {
            schoolId: input.schoolId,
            subjectId: subject.id,
            sectionId: { in: relevantSectionIds },
          },
          select: { sectionId: true },
        });
        const ownedSet = new Set(existingOwnership.map((row: { sectionId: number }) => row.sectionId));
        const uncoveredSectionIds = relevantSectionIds.filter((sectionId) => !ownedSet.has(sectionId));
        if (uncoveredSectionIds.length === 0) return;

        const placeholder = await ensureSubjectPlaceholderFaculty(tx, input.schoolId, subject.code);
        if (placeholder.created) {
          createdPlaceholders.push({ facultyId: placeholder.facultyId, subjectCode: subject.code });
        } else {
          reusedPlaceholders.push({ facultyId: placeholder.facultyId, subjectCode: subject.code });
        }

        const existingAssignment = await tx.facultySubject.findUnique({
          where: { facultyId_subjectId: { facultyId: placeholder.facultyId, subjectId: subject.id } },
          select: { id: true, sectionIds: true, gradeLevels: true },
        });

        const mergedSectionIds = existingAssignment
          ? [...new Set([...existingAssignment.sectionIds, ...uncoveredSectionIds])].sort((a, b) => a - b)
          : [...new Set(uncoveredSectionIds)].sort((a, b) => a - b);

        const gradeBySectionId = new Map(context.sections.map((section) => [section.id, section.gradeLevel]));
        const mergedGradeLevels = [...new Set(mergedSectionIds.map((sectionId) => gradeBySectionId.get(sectionId)).filter((value): value is number => Number.isInteger(value)))].sort((a, b) => a - b);

        let facultySubjectId: number;
        if (!existingAssignment) {
          const created = await tx.facultySubject.create({
            data: {
              facultyId: placeholder.facultyId,
              subjectId: subject.id,
              schoolId: input.schoolId,
              gradeLevels: mergedGradeLevels,
              sectionIds: mergedSectionIds,
              assignedBy: input.assignedBy,
            },
            select: { id: true },
          });
          facultySubjectId = created.id;
          placeholderAssignmentsUpserted += 1;
        } else {
          await tx.facultySubject.update({
            where: { id: existingAssignment.id },
            data: {
              sectionIds: mergedSectionIds,
              gradeLevels: mergedGradeLevels,
              assignedBy: input.assignedBy,
            },
          });
          facultySubjectId = existingAssignment.id;
        }

        if (uncoveredSectionIds.length > 0) {
          await tx.subjectSectionOwnership.createMany({
            data: uncoveredSectionIds.map((sectionId) => ({
              schoolId: input.schoolId,
              facultySubjectId,
              facultyId: placeholder.facultyId,
              subjectId: subject.id,
              sectionId,
              assignedAt: new Date(),
            })),
          });
          sectionsCoveredByPlaceholder += uncoveredSectionIds.length;
        }
      });
    }
  }

  const after = apply
    ? await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken)
    : before;

  const resolvedSubjectCodes = before.rows
    .filter((row) => row.uncoveredSectionCount > 0)
    .filter((row) => {
      const afterRow = after.rows.find((candidate) => candidate.subjectId === row.subjectId);
      return (afterRow?.uncoveredSectionCount ?? row.uncoveredSectionCount) === 0;
    })
    .map((row) => row.subjectCode);

  const stillUncoveredSubjectCodes = after.rows
    .filter((row) => row.uncoveredSectionCount > 0)
    .map((row) => row.subjectCode);

  return {
    applied: apply,
    before,
    after,
    createdPlaceholders,
    reusedPlaceholders,
    sectionsCoveredByPlaceholder,
    placeholderAssignmentsUpserted,
    resolvedSubjectCodes,
    stillUncoveredSubjectCodes,
  };
}

function buildServiceError(
code: AssignmentMutationErrorCode,
error: string,
details?: Record<string, unknown>,
): AssignmentMutationResult {
return { success: false, code, error, details };
}

function toAssignmentResponse(
assignment: {
id: number;
facultyId: number;
subjectId: number;
schoolId: number;
gradeLevels: number[];
sectionIds: number[];
assignedBy: number;
assignedAt: Date;
version: number;
createdAt: Date;
updatedAt: Date;
subject: { id: number; name: string; code: string; minMinutesPerWeek: number };
},
normalized: NormalizedAssignmentScope,
metadata?: {
  assignmentKind?: TeachingLoadAssignmentKind;
  storedCurrentYearSectionCount?: number;
  ownedCurrentYearSectionCount?: number;
  missingOwnershipSectionCount?: number;
  ownershipWithoutScopeSectionCount?: number;
},
) {
return {
...assignment,
gradeLevels: normalized.gradeLevels,
sectionIds: normalized.sectionIds,
sections: normalized.sections,
assignmentKind:
  metadata?.assignmentKind ?? (normalized.sectionIds.length > 0 ? 'REAL_OWNERSHIP' : 'BASELINE_ONLY'),
storedCurrentYearSectionCount: metadata?.storedCurrentYearSectionCount ?? normalized.sectionIds.length,
ownedCurrentYearSectionCount: metadata?.ownedCurrentYearSectionCount ?? normalized.sectionIds.length,
missingOwnershipSectionCount: metadata?.missingOwnershipSectionCount ?? 0,
ownershipWithoutScopeSectionCount: metadata?.ownershipWithoutScopeSectionCount ?? 0,
};
}

async function buildRosterIndex(schoolId: number, schoolYearId: number, authToken?: string) {
const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
return buildSectionRosterIndex(sectionResult.gradeLevels);
}

export async function getAssignmentsByFaculty(facultyId: number, schoolYearId: number, authToken?: string) {
const faculty = await prisma.facultyMirror.findUnique({
where: { id: facultyId },
select: { id: true, schoolId: true, version: true },
});
if (!faculty) {
return null;
}

const rosterIndex = await buildRosterIndex(faculty.schoolId, schoolYearId, authToken);
const currentYearSectionIds = Array.from(rosterIndex.sectionMap.keys());
const currentYearSectionIdSet = new Set(currentYearSectionIds);

const assignments = await prisma.facultySubject.findMany({
where: { facultyId },
include: {
subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true } },
},
orderBy: { subject: { name: 'asc' } },
});

const ownershipRows = currentYearSectionIds.length > 0
  ? await prisma.subjectSectionOwnership.findMany({
    where: {
      schoolId: faculty.schoolId,
      facultyId,
      sectionId: { in: currentYearSectionIds },
    },
    select: {
      facultySubjectId: true,
      sectionId: true,
    },
  })
  : [];

const ownershipByFacultySubjectId = new Map<number, Set<number>>();
for (const row of ownershipRows) {
  const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set<number>();
  existing.add(row.sectionId);
  ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
}

const sectionDisplayOrderMap = new Map<number, number>(
  Array.from(rosterIndex.sectionMap.values()).map((section) => [section.id, section.displayOrder]),
);

return {
facultyId: faculty.id,
version: faculty.version,
assignments: assignments.map((assignment) => {
const storedCurrentYearSectionIds = assignment.sectionIds
  .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
  .sort((left, right) => left - right);
const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(assignment.id) ?? [])
  .sort((left, right) => left - right);
const ownedSectionIdSet = new Set(ownedCurrentYearSectionIds);
const storedSectionIdSet = new Set(storedCurrentYearSectionIds);
const missingOwnershipSectionCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSectionIdSet.has(sectionId)).length;
const ownershipWithoutScopeSectionCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSectionIdSet.has(sectionId)).length;

const normalized = normalizeStoredAssignmentScope(
  {
    subjectId: assignment.subjectId,
    gradeLevels: deriveGradeLevelsFromSectionIds(ownedCurrentYearSectionIds, sectionDisplayOrderMap),
    sectionIds: ownedCurrentYearSectionIds,
  },
  rosterIndex,
);

const assignmentKind: TeachingLoadAssignmentKind = normalized.sectionIds.length > 0
  ? 'REAL_OWNERSHIP'
  : storedCurrentYearSectionIds.length > 0
    ? 'MISSING_OWNERSHIP'
    : 'BASELINE_ONLY';

return toAssignmentResponse(assignment, normalized, {
  assignmentKind,
  storedCurrentYearSectionCount: storedCurrentYearSectionIds.length,
  ownedCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
  missingOwnershipSectionCount,
  ownershipWithoutScopeSectionCount,
});
}),
};
}

export async function setAssignments(
facultyId: number,
schoolId: number,
schoolYearId: number,
assignedBy: number,
expectedVersion: number,
assignments: AssignmentScopeInput[],
authToken?: string,
): Promise<AssignmentMutationResult> {
const faculty = await prisma.facultyMirror.findUnique({
where: { id: facultyId },
select: {
id: true,
schoolId: true,
isActiveForScheduling: true,
version: true,
isClassAdviser: true,
advisedSectionId: true,
},
});

if (!faculty) {
return buildServiceError('FACULTY_NOT_FOUND', 'Faculty not found.');
}

if (faculty.schoolId !== schoolId) {
return buildServiceError('SCHOOL_SCOPE_MISMATCH', 'Faculty does not belong to the provided school scope.');
}

if (!faculty.isActiveForScheduling) {
return buildServiceError('FACULTY_INACTIVE', 'Faculty is not active for scheduling.');
}

if (faculty.version !== expectedVersion) {
return buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
}

const subjectIds = Array.from(new Set(assignments.map((assignment) => assignment.subjectId)));
if (subjectIds.length !== assignments.length) {
return buildServiceError('INVALID_ASSIGNMENT_SCOPE', 'Each subject can only appear once in a faculty assignment payload.');
}

let normalizedAssignments: NormalizedAssignmentScope[] = [];
let rosterIndex: Awaited<ReturnType<typeof buildRosterIndex>> | null = null;

if (assignments.length > 0) {
rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
const validSubjects = await prisma.subject.findMany({
where: { schoolId, id: { in: subjectIds } },
select: { id: true },
});
const validSubjectIds = new Set(validSubjects.map((subject) => subject.id));
const invalidSubjectIds = subjectIds.filter((subjectId) => !validSubjectIds.has(subjectId));
if (invalidSubjectIds.length > 0) {
return buildServiceError(
'INVALID_SUBJECTS',
'One or more subjects are not valid for the selected school.',
{ invalidSubjectIds },
);
}

for (const assignment of assignments) {
const normalized = normalizeIncomingAssignmentScope(assignment, rosterIndex);
if (!normalized.ok) {
return buildServiceError(
'INVALID_ASSIGNMENT_SCOPE',
normalized.error.message,
{ subjectId: assignment.subjectId, ...normalized.error },
);
}
normalizedAssignments.push(normalized.value);
}
}

	// ── HG Advisory Guard ──────────────────────────────────────────────────────
	// If this faculty is a class adviser, their HG section is immutable.
	// Reject any payload that would remove the advised section from HG.
	// Gather adviser info before entering the transaction.
	let advisedHgInfo: {
		hgSubjectId: number;
		advisedSectionId: number;
		hgFacultySubjectId: number | null;
	} | null = null;

	if (faculty.isClassAdviser && faculty.advisedSectionId) {
		const hgSubject = await prisma.subject.findFirst({
			where: { schoolId, code: HG_SUBJECT_CODE },
			select: { id: true },
		});
		if (hgSubject) {
			const hgInPayload = normalizedAssignments.find((a) => a.subjectId === hgSubject.id);
			if (hgInPayload && !hgInPayload.sectionIds.includes(faculty.advisedSectionId)) {
				return buildServiceError(
					'HG_ADVISORY_IMMUTABLE',
					'Cannot remove Homeroom Guidance assignment for an active class adviser.',
				);
			}
			const existingHgFs = await prisma.facultySubject.findUnique({
				where: { facultyId_subjectId: { facultyId, subjectId: hgSubject.id } },
				select: { id: true },
			});
			advisedHgInfo = {
				hgSubjectId: hgSubject.id,
				advisedSectionId: faculty.advisedSectionId,
				hgFacultySubjectId: existingHgFs?.id ?? null,
			};
		}
	}

	// Filter out the adviser's HG subject from normalizedAssignments — the preserved
	// FacultySubject record is kept intact; we do not re-create it.
	const assignmentsToCreate = advisedHgInfo
		? normalizedAssignments.filter((a) => a.subjectId !== advisedHgInfo!.hgSubjectId)
		: normalizedAssignments;

	try {
		await prisma.$transaction(
async (tx) => {
const concurrentFaculty = await tx.facultyMirror.findUnique({
where: { id: facultyId },
select: { version: true, isActiveForScheduling: true, schoolId: true },
});
if (!concurrentFaculty) {
throw buildServiceError('FACULTY_NOT_FOUND', 'Faculty not found.');
}
if (concurrentFaculty.schoolId !== schoolId) {
throw buildServiceError('SCHOOL_SCOPE_MISMATCH', 'Faculty does not belong to the provided school scope.');
}
if (!concurrentFaculty.isActiveForScheduling) {
throw buildServiceError('FACULTY_INACTIVE', 'Faculty is not active for scheduling.');
}
if (concurrentFaculty.version !== expectedVersion) {
throw buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
}

      // Conflict check against normalized ownership table — authoritative DB-level source.
      // Avoids scanning FacultySubject.sectionIds arrays across all faculty.
      if (assignmentsToCreate.length > 0) {
        const incomingSubjectIds = assignmentsToCreate.map((a) => a.subjectId);
        const incomingSectionIds = [...new Set(assignmentsToCreate.flatMap((a) => a.sectionIds))];

        if (incomingSectionIds.length > 0) {
          const blockingOwners = await tx.subjectSectionOwnership.findMany({
            where: {
              schoolId,
              subjectId: { in: incomingSubjectIds },
              sectionId: { in: incomingSectionIds },
              facultyId: { not: facultyId },
            },
            select: { subjectId: true, sectionId: true, facultyId: true },
          });

          // Query is a cross-product (subjectId × sectionId); filter to exact claimed pairs
          const incomingPairs = new Set(
            assignmentsToCreate.flatMap((a) => a.sectionIds.map((sid) => `${a.subjectId}:${sid}`)),
          );
          const realConflicts = blockingOwners.filter((o) =>
            incomingPairs.has(`${o.subjectId}:${o.sectionId}`),
          );

          if (realConflicts.length > 0) {
            const conflictFacultyIds = [...new Set(realConflicts.map((c) => c.facultyId))];
            const conflictFaculty = await tx.facultyMirror.findMany({
              where: { id: { in: conflictFacultyIds } },
              select: { id: true, firstName: true, lastName: true },
            });
            const nameMap = new Map(
              conflictFaculty.map((f) => [f.id, formatFacultyName(f.firstName, f.lastName)]),
            );
            const blockingResult = buildDuplicateOwnershipBlockingResult(realConflicts, nameMap);
            if (blockingResult) {
              throw blockingResult;
            }
          }
        }
      }

      const versionUpdate = await tx.facultyMirror.updateMany({
        where: { id: facultyId, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (versionUpdate.count !== 1) {
        throw buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
      }

      // deleteMany cascade-deletes SubjectSectionOwnership rows via the FK on faculty_subjects.
      // Preserve the HG FacultySubject for active class advisers (immutable by design).
      const preservedIds = advisedHgInfo?.hgFacultySubjectId
        ? [advisedHgInfo.hgFacultySubjectId]
        : [];
      await tx.facultySubject.deleteMany({
        where: { facultyId, id: { notIn: preservedIds } },
      });

      if (assignmentsToCreate.length > 0) {
        // createManyAndReturn gives us IDs needed to populate the normalized ownership index
        const createdSubjects = await tx.facultySubject.createManyAndReturn({
          data: assignmentsToCreate.map((assignment) => ({
            facultyId,
            subjectId: assignment.subjectId,
            schoolId,
            gradeLevels: assignment.gradeLevels,
            sectionIds: assignment.sectionIds,
            assignedBy,
          })),
          select: { id: true, subjectId: true, sectionIds: true },
        });

        // Write normalized ownership rows — unique constraint is the final DB guardrail
        const ownershipData = createdSubjects.flatMap((fs) =>
          fs.sectionIds.map((sectionId) => ({
            schoolId,
            facultySubjectId: fs.id,
            facultyId,
            subjectId: fs.subjectId,
            sectionId,
            assignedAt: new Date(),
          })),
        );
        if (ownershipData.length > 0) {
          await tx.subjectSectionOwnership.createMany({ data: ownershipData });
        }
      }
},
{ isolationLevel: 'Serializable' },
);
} catch (error: any) {
if (error?.success === false) {
return error as AssignmentMutationResult;
}
if (error?.code === 'P2034') {
    return buildServiceError('VERSION_CONFLICT', 'A concurrent assignment update occurred. Please reload and try again.');
  }
  // DB unique constraint uq_subject_section_owner fired (race slipped past the pre-flight check)
  if (error?.code === 'P2002' && error?.meta?.modelName === 'SubjectSectionOwnership') {
    return buildServiceError(
      'DUPLICATE_SECTION_OWNERSHIP',
      'A concurrent save created an ownership conflict on the same subject-section. Please reload and try again.',
    );
  }
  throw error;
}

return { success: true, version: expectedVersion + 1 };
}

export async function getAssignmentSummary(schoolId: number, schoolYearId: number, authToken?: string) {
  const rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
  const currentYearSectionScope = Array.from(rosterIndex.sectionMap.values()).map((section) => ({
    id: section.id,
    gradeLevel: section.displayOrder,
    programType: section.programType ?? 'REGULAR',
  }));
  const currentYearSectionIds = currentYearSectionScope.map((section) => section.id);
  const currentYearSectionIdSet = new Set(currentYearSectionIds);
  const sectionDisplayOrderMap = new Map(currentYearSectionScope.map((section) => [section.id, section.gradeLevel]));

  const [faculty, ownershipRows, activeSubjects] = await Promise.all([
    prisma.facultyMirror.findMany({
      where: { schoolId, isStale: false },
      include: {
        facultySubjects: {
          include: {
            subject: {
              select: {
                id: true,
                name: true,
                code: true,
                minMinutesPerWeek: true,
              },
            },
          },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
    currentYearSectionIds.length > 0
      ? prisma.subjectSectionOwnership.findMany({
        where: {
          schoolId,
          sectionId: { in: currentYearSectionIds },
        },
        select: {
          facultySubjectId: true,
          subjectId: true,
          sectionId: true,
          facultyId: true,
        },
      })
      : Promise.resolve([]),
    prisma.subject.findMany({
      where: {
        schoolId,
        isActive: true,
        code: { not: HG_SUBJECT_CODE },
      },
      select: {
        id: true,
        gradeLevels: true,
        programScopes: true,
      },
    }),
  ]);

  const ownershipFacultyIds = Array.from(new Set(ownershipRows.map((row) => row.facultyId)));
  const ownershipFaculty = ownershipFacultyIds.length
    ? await prisma.facultyMirror.findMany({
      where: { id: { in: ownershipFacultyIds } },
      select: { id: true, firstName: true, lastName: true },
    })
    : [];
  const ownershipNameByFacultyId = new Map(
    ownershipFaculty.map((member) => [member.id, formatFacultyName(member.firstName, member.lastName)]),
  );

  const ownershipIndex: SubjectSectionOwnershipIndexEntry[] = ownershipRows.map((row) => ({
    subjectId: row.subjectId,
    sectionId: row.sectionId,
    facultyId: row.facultyId,
    facultyName: ownershipNameByFacultyId.get(row.facultyId) ?? `Faculty #${row.facultyId}`,
  }));

  const ownershipByFacultySubjectId = new Map<number, Set<number>>();
  for (const row of ownershipRows) {
    const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set<number>();
    existing.add(row.sectionId);
    ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
  }

  const teachablePairSet = new Set<string>();
  for (const subject of activeSubjects) {
    for (const section of currentYearSectionScope) {
      if (!gradeLevelMatches(subject.gradeLevels, section.gradeLevel)) {
        continue;
      }
      if (!isProgramScopeCompatible(subject.programScopes, section.programType)) {
        continue;
      }
      teachablePairSet.add(`${subject.id}:${section.id}`);
    }
  }

  const assignedPairSet = new Set<string>();
  for (const row of ownershipRows) {
    const key = `${row.subjectId}:${row.sectionId}`;
    if (teachablePairSet.has(key)) {
      assignedPairSet.add(key);
    }
  }

  let emptySectionRows = 0;
  let currentYearRowsMissingOwnership = 0;
  let currentYearOwnershipWithoutMatchingScope = 0;
  let currentYearMissingOwnershipPairs = 0;
  let currentYearOwnershipWithoutMatchingScopePairs = 0;

  const emptySectionSamples: TeachingLoadIntegrityDiagnosticRow[] = [];
  const missingOwnershipSamples: TeachingLoadIntegrityDiagnosticRow[] = [];
  const ownershipWithoutScopeSamples: TeachingLoadIntegrityDiagnosticRow[] = [];

  const maxDiagnosticSamples = 20;

  const facultySummary = faculty.map((member) => {
    const facultyName = formatFacultyName(member.firstName, member.lastName);

    let realAssignmentRowCount = 0;
    let baselineSubjectCount = 0;
    let missingOwnershipSubjectCount = 0;
    let ownershipWithoutScopeSubjectCount = 0;

    const assignments = member.facultySubjects.map((assignment) => {
      const storedCurrentYearSectionIds = assignment.sectionIds
        .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
        .sort((left, right) => left - right);
      const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(assignment.id) ?? [])
        .sort((left, right) => left - right);

      const ownedSectionIdSet = new Set(ownedCurrentYearSectionIds);
      const storedSectionIdSet = new Set(storedCurrentYearSectionIds);

      const missingOwnershipSectionCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSectionIdSet.has(sectionId)).length;
      const ownershipWithoutScopeSectionCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSectionIdSet.has(sectionId)).length;

      const normalized = normalizeStoredAssignmentScope(
        {
          subjectId: assignment.subjectId,
          gradeLevels: deriveGradeLevelsFromSectionIds(ownedCurrentYearSectionIds, sectionDisplayOrderMap),
          sectionIds: ownedCurrentYearSectionIds,
        },
        rosterIndex,
      );

      const assignmentKind: TeachingLoadAssignmentKind = normalized.sectionIds.length > 0
        ? 'REAL_OWNERSHIP'
        : storedCurrentYearSectionIds.length > 0
          ? 'MISSING_OWNERSHIP'
          : 'BASELINE_ONLY';

      if (assignmentKind === 'REAL_OWNERSHIP') {
        realAssignmentRowCount += 1;
      }

      if (assignmentKind === 'BASELINE_ONLY') {
        baselineSubjectCount += 1;
      }

      if (assignment.sectionIds.length === 0) {
        emptySectionRows += 1;
        if (emptySectionSamples.length < maxDiagnosticSamples) {
          emptySectionSamples.push({
            facultyId: member.id,
            facultyName,
            subjectId: assignment.subjectId,
            subjectCode: assignment.subject.code,
            sectionCount: 0,
          });
        }
      }

      if (missingOwnershipSectionCount > 0) {
        currentYearRowsMissingOwnership += 1;
        currentYearMissingOwnershipPairs += missingOwnershipSectionCount;
        missingOwnershipSubjectCount += 1;
        if (missingOwnershipSamples.length < maxDiagnosticSamples) {
          missingOwnershipSamples.push({
            facultyId: member.id,
            facultyName,
            subjectId: assignment.subjectId,
            subjectCode: assignment.subject.code,
            sectionCount: missingOwnershipSectionCount,
          });
        }
      }

      if (ownershipWithoutScopeSectionCount > 0) {
        currentYearOwnershipWithoutMatchingScope += 1;
        currentYearOwnershipWithoutMatchingScopePairs += ownershipWithoutScopeSectionCount;
        ownershipWithoutScopeSubjectCount += 1;
        if (ownershipWithoutScopeSamples.length < maxDiagnosticSamples) {
          ownershipWithoutScopeSamples.push({
            facultyId: member.id,
            facultyName,
            subjectId: assignment.subjectId,
            subjectCode: assignment.subject.code,
            sectionCount: ownershipWithoutScopeSectionCount,
          });
        }
      }

      return toAssignmentResponse(assignment, normalized, {
        assignmentKind,
        storedCurrentYearSectionCount: storedCurrentYearSectionIds.length,
        ownedCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
        missingOwnershipSectionCount,
        ownershipWithoutScopeSectionCount,
      });
    });

    const sectionCount = assignments.reduce((sum, assignment) => sum + assignment.sectionIds.length, 0);
    const sectionMinutes = computeTeachingLoadMinutes(assignments, 'section');
    const gradeMinutes = computeTeachingLoadMinutes(assignments, 'grade');
    const sectionTeachingHours = Math.round((sectionMinutes / 60) * 10) / 10;
    const gradeTeachingHours = Math.round((gradeMinutes / 60) * 10) / 10;
    const advisoryHours = Math.round(Math.max(0, Number(member.advisoryEquivalentHours || 0)) * 10) / 10;
    const ancillaryHours = Math.round((Math.max(0, Number(member.ancillaryMinutesPerWeek || 0)) / 60) * 10) / 10;
    const policyCreditedHours = Math.round((sectionTeachingHours + advisoryHours + ancillaryHours) * 10) / 10;
    const policyLoadPercentage = member.maxHoursPerWeek > 0
      ? Math.round((policyCreditedHours / member.maxHoursPerWeek) * 100)
      : 0;
    const loadSignalMode = member.isPlaceholder ? 'SYNTHETIC_PLACEHOLDER' : 'STANDARD';
    const syntheticCoverageHours = member.isPlaceholder ? sectionTeachingHours : 0;

    return {
      id: member.id,
      externalId: member.externalId,
      isPlaceholder: member.isPlaceholder,
      employeeId: member.employeeId,
      firstName: member.firstName,
      lastName: member.lastName,
      department: member.department,
      specialization: member.specialization,
      employmentStatus: member.employmentStatus,
      isClassAdviser: member.isClassAdviser,
      advisedSectionId: member.advisedSectionId,
      advisedSectionName: member.advisedSectionName,
      advisoryEquivalentHours: member.advisoryEquivalentHours,
      ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
      canTeachOutsideDepartment: member.canTeachOutsideDepartment,
      isActiveForScheduling: member.isActiveForScheduling,
      maxHoursPerWeek: member.maxHoursPerWeek,
      version: member.version,
      subjectCount: realAssignmentRowCount,
      sectionCount,
      baselineSubjectCount,
      missingOwnershipSubjectCount,
      ownershipWithoutScopeSubjectCount,
      subjectHours: policyCreditedHours,
      loadPercentage: policyLoadPercentage,
      sectionTeachingHours,
      gradeTeachingHours,
      advisoryHours,
      ancillaryHours,
      policyCreditedHours,
      policyLoadPercentage,
      syntheticCoverageHours,
      loadSignalMode,
      assignments,
    };
  });

  const coverageTotals: TeachingLoadCoverageTotals = {
    assignedPairs: assignedPairSet.size,
    totalPairs: teachablePairSet.size,
    unassignedPairs: Math.max(0, teachablePairSet.size - assignedPairSet.size),
  };

  const integrityDiagnostics: TeachingLoadIntegrityDiagnostics = {
    emptySectionRows,
    currentYearRowsMissingOwnership,
    currentYearOwnershipWithoutMatchingScope,
    currentYearMissingOwnershipPairs,
    currentYearOwnershipWithoutMatchingScopePairs,
    emptySectionSamples,
    missingOwnershipSamples,
    ownershipWithoutScopeSamples,
  };

  return {
    faculty: facultySummary,
    ownershipIndex,
    coverageTotals,
    integrityDiagnostics,
  };
}

export async function previewOrApplyTeachingLoadTruthReconcile(
  input: TeachingLoadTruthReconcileInput,
): Promise<TeachingLoadTruthReconcileResult> {
  const rosterIndex = await buildRosterIndex(input.schoolId, input.schoolYearId, input.authToken);
  const currentYearSectionIds = Array.from(rosterIndex.sectionMap.keys());
  const currentYearSectionIdSet = new Set(currentYearSectionIds);

  const sectionDisplayOrderMap = new Map<number, number>(
    Array.from(rosterIndex.sectionMap.values()).map((section) => [section.id, section.displayOrder]),
  );

  const [facultySubjects, ownershipRows] = await Promise.all([
    prisma.facultySubject.findMany({
      where: { schoolId: input.schoolId },
      select: {
        id: true,
        facultyId: true,
        subjectId: true,
        sectionIds: true,
        gradeLevels: true,
      },
      orderBy: { id: 'asc' },
    }),
    currentYearSectionIds.length > 0
      ? prisma.subjectSectionOwnership.findMany({
        where: {
          schoolId: input.schoolId,
          sectionId: { in: currentYearSectionIds },
        },
        select: {
          facultySubjectId: true,
          sectionId: true,
        },
      })
      : Promise.resolve([]),
  ]);

  const ownershipByFacultySubjectId = new Map<number, Set<number>>();
  for (const row of ownershipRows) {
    const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set<number>();
    existing.add(row.sectionId);
    ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
  }

  let rowsWithEmptySectionIds = 0;
  let rowsWithMissingOwnership = 0;
  let rowsWithOwnershipWithoutScope = 0;
  let rowsToUpdate = 0;
  let updatedRows = 0;

  const updates: Array<{
    facultySubjectId: number;
    facultyId: number;
    subjectId: number;
    previousCurrentYearSectionCount: number;
    nextCurrentYearSectionCount: number;
    nextSectionIds: number[];
    nextGradeLevels: number[];
  }> = [];

  for (const row of facultySubjects) {
    const storedCurrentYearSectionIds = row.sectionIds
      .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
      .sort((left, right) => left - right);
    const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(row.id) ?? [])
      .sort((left, right) => left - right);

    if (row.sectionIds.length === 0) {
      rowsWithEmptySectionIds += 1;
    }

    const storedSet = new Set(storedCurrentYearSectionIds);
    const ownedSet = new Set(ownedCurrentYearSectionIds);
    const missingOwnershipCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSet.has(sectionId)).length;
    const ownershipWithoutScopeCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSet.has(sectionId)).length;

    if (missingOwnershipCount > 0) {
      rowsWithMissingOwnership += 1;
    }
    if (ownershipWithoutScopeCount > 0) {
      rowsWithOwnershipWithoutScope += 1;
    }

    if (missingOwnershipCount === 0 && ownershipWithoutScopeCount === 0) {
      continue;
    }

    const nonCurrentYearSectionIds = row.sectionIds.filter((sectionId) => !currentYearSectionIdSet.has(sectionId));
    const nextSectionIds = Array.from(new Set([...nonCurrentYearSectionIds, ...ownedCurrentYearSectionIds]))
      .sort((left, right) => left - right);
    const nextGradeLevels = deriveGradeLevelsFromSectionIds(nextSectionIds, sectionDisplayOrderMap);

    rowsToUpdate += 1;
    updates.push({
      facultySubjectId: row.id,
      facultyId: row.facultyId,
      subjectId: row.subjectId,
      previousCurrentYearSectionCount: storedCurrentYearSectionIds.length,
      nextCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
      nextSectionIds,
      nextGradeLevels,
    });
  }

  if (input.previewOnly === false && updates.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.facultySubject.update({
          where: { id: update.facultySubjectId },
          data: {
            sectionIds: update.nextSectionIds,
            gradeLevels: update.nextGradeLevels,
          },
        });
      }
    });
    updatedRows = updates.length;
  }

  const sampleUpdates = updates
    .slice(0, 25)
    .map((update) => ({
      facultySubjectId: update.facultySubjectId,
      facultyId: update.facultyId,
      subjectId: update.subjectId,
      previousCurrentYearSectionCount: update.previousCurrentYearSectionCount,
      nextCurrentYearSectionCount: update.nextCurrentYearSectionCount,
    }));

  return {
    applied: input.previewOnly === false,
    schoolId: input.schoolId,
    schoolYearId: input.schoolYearId,
    facultySubjectRowsScanned: facultySubjects.length,
    rowsWithEmptySectionIds,
    rowsWithMissingOwnership,
    rowsWithOwnershipWithoutScope,
    rowsToUpdate,
    updatedRows,
    sampleUpdates,
  };
}

export interface TeachingLoadResetInput {
  schoolId: number;
  schoolYearId: number;
  actorId: number;
  authToken?: string;
  subjectId?: number;
  previewOnly?: boolean;
}

export interface TeachingLoadResetResult {
  applied: boolean;
  scope: 'GLOBAL' | 'SUBJECT';
  schoolId: number;
  schoolYearId: number;
  subjectId: number | null;
  ownershipRowsToRemove: number;
  facultySubjectRowsAffected: number;
  facultySubjectRowsDeleted: number;
  facultySubjectRowsUpdated: number;
  affectedFacultyCount: number;
  affectedSubjectCount: number;
  subjectCodes: string[];
}

type ResetOwnershipRow = {
  id: number;
  facultySubjectId: number;
  facultyId: number;
  subjectId: number;
  sectionId: number;
};

async function resolveSchoolYearSectionIds(
  schoolId: number,
  schoolYearId: number,
  authToken?: string,
): Promise<number[]> {
  const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
  const ids: number[] = [];
  for (const grade of sectionResult.gradeLevels) {
    for (const section of grade.sections) {
      if (section.id > 0) {
        ids.push(section.id);
      }
    }
  }
  return [...new Set(ids)];
}

function buildResetPreview(
  input: TeachingLoadResetInput,
  ownershipRows: ResetOwnershipRow[],
  facultySubjects: Array<{ id: number; facultyId: number; subjectId: number; sectionIds: number[] }>,
  subjectCodesById: Map<number, string>,
): TeachingLoadResetResult {
  const removableSectionIdsByFacultySubject = new Map<number, Set<number>>();
  const affectedFacultyIds = new Set<number>();
  const affectedSubjectIds = new Set<number>();

  for (const row of ownershipRows) {
    affectedFacultyIds.add(row.facultyId);
    affectedSubjectIds.add(row.subjectId);
    const existing = removableSectionIdsByFacultySubject.get(row.facultySubjectId) ?? new Set<number>();
    existing.add(row.sectionId);
    removableSectionIdsByFacultySubject.set(row.facultySubjectId, existing);
  }

  let facultySubjectRowsDeleted = 0;
  let facultySubjectRowsUpdated = 0;
  for (const row of facultySubjects) {
    const removable = removableSectionIdsByFacultySubject.get(row.id);
    if (!removable || removable.size === 0) continue;
    const remaining = row.sectionIds.filter((sectionId) => !removable.has(sectionId));
    if (remaining.length === 0) {
      facultySubjectRowsDeleted += 1;
    } else {
      facultySubjectRowsUpdated += 1;
    }
  }

  const subjectCodes = [...affectedSubjectIds]
    .map((id) => subjectCodesById.get(id) ?? `SUBJECT_${id}`)
    .sort((left, right) => left.localeCompare(right));

  return {
    applied: false,
    scope: typeof input.subjectId === 'number' ? 'SUBJECT' : 'GLOBAL',
    schoolId: input.schoolId,
    schoolYearId: input.schoolYearId,
    subjectId: typeof input.subjectId === 'number' ? input.subjectId : null,
    ownershipRowsToRemove: ownershipRows.length,
    facultySubjectRowsAffected: facultySubjects.length,
    facultySubjectRowsDeleted,
    facultySubjectRowsUpdated,
    affectedFacultyCount: affectedFacultyIds.size,
    affectedSubjectCount: affectedSubjectIds.size,
    subjectCodes,
  };
}

export async function previewOrApplyTeachingLoadReset(input: TeachingLoadResetInput): Promise<TeachingLoadResetResult> {
  const sectionIds = await resolveSchoolYearSectionIds(input.schoolId, input.schoolYearId, input.authToken);
  if (sectionIds.length === 0) {
    return {
      applied: false,
      scope: typeof input.subjectId === 'number' ? 'SUBJECT' : 'GLOBAL',
      schoolId: input.schoolId,
      schoolYearId: input.schoolYearId,
      subjectId: typeof input.subjectId === 'number' ? input.subjectId : null,
      ownershipRowsToRemove: 0,
      facultySubjectRowsAffected: 0,
      facultySubjectRowsDeleted: 0,
      facultySubjectRowsUpdated: 0,
      affectedFacultyCount: 0,
      affectedSubjectCount: 0,
      subjectCodes: [],
    };
  }

  const ownershipFilter = {
    schoolId: input.schoolId,
    sectionId: { in: sectionIds },
    ...(typeof input.subjectId === 'number' ? { subjectId: input.subjectId } : {}),
  };

  const ownershipRows = await prisma.subjectSectionOwnership.findMany({
    where: ownershipFilter,
    select: {
      id: true,
      facultySubjectId: true,
      facultyId: true,
      subjectId: true,
      sectionId: true,
    },
  });

  const facultySubjectIds = [...new Set(ownershipRows.map((row) => row.facultySubjectId))];
  const subjectIds = [...new Set(ownershipRows.map((row) => row.subjectId))];

  const [facultySubjects, subjects] = await Promise.all([
    facultySubjectIds.length > 0
      ? prisma.facultySubject.findMany({
        where: { id: { in: facultySubjectIds } },
        select: { id: true, facultyId: true, subjectId: true, sectionIds: true },
      })
      : Promise.resolve([]),
    subjectIds.length > 0
      ? prisma.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, code: true },
      })
      : Promise.resolve([]),
  ]);

  const subjectCodesById = new Map(subjects.map((subject) => [subject.id, subject.code]));
  const preview = buildResetPreview(input, ownershipRows, facultySubjects, subjectCodesById);

  if (input.previewOnly !== false) {
    return preview;
  }

  const removableSectionsByFacultySubject = new Map<number, Set<number>>();
  for (const row of ownershipRows) {
    const existing = removableSectionsByFacultySubject.get(row.facultySubjectId) ?? new Set<number>();
    existing.add(row.sectionId);
    removableSectionsByFacultySubject.set(row.facultySubjectId, existing);
  }

  await prisma.$transaction(async (tx) => {
    if (ownershipRows.length > 0) {
      await tx.subjectSectionOwnership.deleteMany({
        where: { id: { in: ownershipRows.map((row) => row.id) } },
      });
    }

    for (const row of facultySubjects) {
      const removable = removableSectionsByFacultySubject.get(row.id);
      if (!removable || removable.size === 0) continue;

      const nextSectionIds = row.sectionIds.filter((sectionId) => !removable.has(sectionId));
      if (nextSectionIds.length === 0) {
        const remainingOwnershipRows = await tx.subjectSectionOwnership.count({ where: { facultySubjectId: row.id } });
        if (remainingOwnershipRows === 0) {
          await tx.facultySubject.delete({ where: { id: row.id } });
        }
        continue;
      }

      await tx.facultySubject.update({
        where: { id: row.id },
        data: { sectionIds: [...new Set(nextSectionIds)].sort((left, right) => left - right) },
      });
    }
  });

  const appliedResult: TeachingLoadResetResult = {
    ...preview,
    applied: true,
  };

  console.info(
    '[TEACHING_LOAD_RESET_APPLY]',
    JSON.stringify({
      ...appliedResult,
      actorId: input.actorId,
      occurredAt: new Date().toISOString(),
    }),
  );

  return appliedResult;
}
