import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
import {
buildSectionRosterIndex,
detectSectionOwnershipConflicts,
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

if (rosterIndex && subjectIds.length > 0) {
const existingAssignments = await tx.facultySubject.findMany({
where: {
schoolId,
facultyId: { not: facultyId },
subjectId: { in: subjectIds },
},
select: {
facultyId: true,
subjectId: true,
gradeLevels: true,
sectionIds: true,
faculty: { select: { firstName: true, lastName: true } },
},
});

const normalizedExisting = existingAssignments.map((assignment) => {
const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex!);
return {
facultyId: assignment.facultyId,
facultyName: formatFacultyName(assignment.faculty.firstName, assignment.faculty.lastName),
subjectId: assignment.subjectId,
sectionIds: normalized.sectionIds,
};
});

const conflicts = detectSectionOwnershipConflicts(facultyId, normalizedAssignments, normalizedExisting);
if (conflicts.length > 0) {
throw buildServiceError(
'DUPLICATE_SECTION_OWNERSHIP',
`One or more subject-section pairs are already assigned to another faculty member. ${conflicts
.slice(0, 3)
.map((conflict) => `${conflict.ownerFacultyName} already owns subject ${conflict.subjectId} / section ${conflict.sectionId}`)
.join('; ')}${conflicts.length > 3 ? ` (+${conflicts.length - 3} more)` : ''}`,
{ conflicts },
);
}
}

const versionUpdate = await tx.facultyMirror.updateMany({
where: { id: facultyId, version: expectedVersion },
data: { version: { increment: 1 } },
});
if (versionUpdate.count !== 1) {
throw buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
}

await tx.facultySubject.deleteMany({ where: { facultyId } });

if (normalizedAssignments.length > 0) {
await tx.facultySubject.createMany({
data: normalizedAssignments.map((assignment) => ({
facultyId,
subjectId: assignment.subjectId,
schoolId,
gradeLevels: assignment.gradeLevels,
sectionIds: assignment.sectionIds,
assignedBy,
})),
});
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
throw error;
}

return { success: true, version: expectedVersion + 1 };
}

export async function getAssignmentSummary(schoolId: number, schoolYearId: number, authToken?: string) {
const [rosterIndex, faculty] = await Promise.all([
buildRosterIndex(schoolId, schoolYearId, authToken),
prisma.facultyMirror.findMany({
where: { schoolId },
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
const subjectMinutes = assignments.reduce(
(sum, assignment) => sum + assignment.subject.minMinutesPerWeek * assignment.sectionIds.length,
0,
);
const subjectHours = Math.round((subjectMinutes / 60) * 10) / 10;

return {
id: member.id,
externalId: member.externalId,
firstName: member.firstName,
lastName: member.lastName,
department: member.department,
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
assignments,
};
});
}
