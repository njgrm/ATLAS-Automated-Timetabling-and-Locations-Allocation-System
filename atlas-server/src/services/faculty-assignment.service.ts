import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
import {
  buildSectionRosterIndex,
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
| 'DUPLICATE_SECTION_OWNERSHIP';
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
) {
return {
...assignment,
gradeLevels: normalized.gradeLevels,
sectionIds: normalized.sectionIds,
sections: normalized.sections,
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
const assignments = await prisma.facultySubject.findMany({
where: { facultyId },
include: {
subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true } },
},
orderBy: { subject: { name: 'asc' } },
});

return {
facultyId: faculty.id,
version: faculty.version,
assignments: assignments.map((assignment) => {
const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
return toAssignmentResponse(assignment, normalized);
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
      if (normalizedAssignments.length > 0) {
        const incomingSubjectIds = normalizedAssignments.map((a) => a.subjectId);
        const incomingSectionIds = [...new Set(normalizedAssignments.flatMap((a) => a.sectionIds))];

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
            normalizedAssignments.flatMap((a) => a.sectionIds.map((sid) => `${a.subjectId}:${sid}`)),
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

      // deleteMany cascade-deletes SubjectSectionOwnership rows via the FK on faculty_subjects
      await tx.facultySubject.deleteMany({ where: { facultyId } });

      if (normalizedAssignments.length > 0) {
        // createManyAndReturn gives us IDs needed to populate the normalized ownership index
        const createdSubjects = await tx.facultySubject.createManyAndReturn({
          data: normalizedAssignments.map((assignment) => ({
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
const [rosterIndex, faculty] = await Promise.all([
buildRosterIndex(schoolId, schoolYearId, authToken),
prisma.facultyMirror.findMany({
where: { schoolId, isStale: false },
include: {
facultySubjects: {
include: { subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true } } },
},
},
orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
}),
]);

return faculty.map((member) => {
const assignments = member.facultySubjects.map((assignment) => {
const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
return toAssignmentResponse(assignment, normalized);
});
const sectionCount = assignments.reduce((sum, assignment) => sum + assignment.sectionIds.length, 0);
const subjectMinutes = computeTeachingLoadMinutes(assignments, 'section');
const teachingHours = subjectMinutes / 60;
const totalHours = teachingHours + (member.advisoryEquivalentHours || 0);
const subjectHours = Math.round(totalHours * 10) / 10;
const loadPercentage = member.maxHoursPerWeek > 0 ? Math.round((totalHours / member.maxHoursPerWeek) * 100) : 0;

return {
id: member.id,
externalId: member.externalId,
firstName: member.firstName,
lastName: member.lastName,
department: member.department,
specialization: member.specialization,
employmentStatus: member.employmentStatus,
isClassAdviser: member.isClassAdviser,
advisoryEquivalentHours: member.advisoryEquivalentHours,
canTeachOutsideDepartment: member.canTeachOutsideDepartment,
isActiveForScheduling: member.isActiveForScheduling,
maxHoursPerWeek: member.maxHoursPerWeek,
version: member.version,
subjectCount: assignments.length,
sectionCount,
subjectHours,
loadPercentage,
assignments,
};
});
}
