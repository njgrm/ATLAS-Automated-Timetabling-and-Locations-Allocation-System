import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { buildSectionRosterIndex, normalizeIncomingAssignmentScope, normalizeStoredAssignmentScope, } from './faculty-assignment-scope.service.js';
export function computeTeachingLoadMinutes(assignments, formula) {
    return assignments.reduce((sum, assignment) => {
        const units = formula === 'section' ? assignment.sectionIds.length : assignment.gradeLevels.length;
        return sum + assignment.subject.minMinutesPerWeek * units;
    }, 0);
}
export function detectDuplicateOwnershipTuples(assignments) {
    const ownership = new Map();
    for (const assignment of assignments) {
        for (const sectionId of assignment.sectionIds) {
            const key = `${assignment.subjectId}:${sectionId}`;
            const existing = ownership.get(key) ??
                {
                    subjectId: assignment.subjectId,
                    sectionId,
                    owners: new Map(),
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
export function buildOwnershipConflictDetails(conflicts, ownerNamesByFacultyId) {
    return conflicts.map((conflict) => ({
        subjectId: conflict.subjectId,
        sectionId: conflict.sectionId,
        ownerFacultyId: conflict.facultyId,
        ownerFacultyName: ownerNamesByFacultyId.get(conflict.facultyId) ?? `Faculty #${conflict.facultyId}`,
    }));
}
export function buildDuplicateOwnershipBlockingResult(conflicts, ownerNamesByFacultyId) {
    if (conflicts.length === 0) {
        return null;
    }
    const details = buildOwnershipConflictDetails(conflicts, ownerNamesByFacultyId);
    return buildServiceError('DUPLICATE_SECTION_OWNERSHIP', `One or more subject-section pairs are already assigned to another faculty member. ${details
        .slice(0, 3)
        .map((conflict) => `${conflict.ownerFacultyName} already owns subject ${conflict.subjectId} / section ${conflict.sectionId}`)
        .join('; ')}${details.length > 3 ? ` (+${details.length - 3} more)` : ''}`, { conflicts: details });
}
function formatFacultyName(firstName, lastName) {
    return `${lastName}, ${firstName}`;
}
function normalizeProgramType(value) {
    return (value ?? 'REGULAR').trim().toUpperCase();
}
function isProgramScopeCompatible(scopes, sectionProgramType) {
    if (!scopes || scopes.length === 0)
        return true;
    const normalizedProgramType = normalizeProgramType(sectionProgramType);
    return scopes.some((scope) => normalizeProgramType(scope) === normalizedProgramType);
}
function getRelevantSectionIdsForSubject(subject, sections) {
    return sections
        .filter((section) => {
        const gradeAllowed = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.gradeLevel);
        if (!gradeAllowed)
            return false;
        return isProgramScopeCompatible(subject.programScopes, section.programType);
    })
        .map((section) => section.id);
}
async function loadCoverageContext(schoolId, schoolYearId, authToken) {
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
    const sections = [];
    for (const grade of sectionResult.gradeLevels) {
        for (const section of grade.sections) {
            if (!section.id || section.id <= 0)
                continue;
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
export async function getActiveSubjectCoverageSummary(schoolId, schoolYearId, authToken) {
    const context = await loadCoverageContext(schoolId, schoolYearId, authToken);
    const rows = context.subjects.map((subject) => {
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
        const status = coveredStatus(ownedSectionIds.size, relevantSectionIds.length);
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
function coveredStatus(ownedCount, relevantCount) {
    if (relevantCount === 0 || ownedCount >= relevantCount)
        return 'FULL';
    if (ownedCount <= 0)
        return 'ZERO';
    return 'PARTIAL';
}
async function ensureSubjectPlaceholderFaculty(tx, schoolId, subjectCode) {
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
export async function repairActiveSubjectCoverageWithPlaceholders(input) {
    const apply = input.apply === true;
    const before = await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken);
    const requested = input.subjectCodes?.length
        ? new Set(input.subjectCodes.map((code) => code.trim().toUpperCase()))
        : null;
    const context = await loadCoverageContext(input.schoolId, input.schoolYearId, input.authToken);
    const subjectsToRepair = context.subjects.filter((subject) => {
        if (requested && !requested.has(subject.code.toUpperCase()))
            return false;
        const beforeRow = before.rows.find((row) => row.subjectId === subject.id);
        return Boolean(beforeRow && beforeRow.uncoveredSectionCount > 0);
    });
    const createdPlaceholders = [];
    const reusedPlaceholders = [];
    let sectionsCoveredByPlaceholder = 0;
    let placeholderAssignmentsUpserted = 0;
    if (apply && subjectsToRepair.length > 0) {
        for (const subject of subjectsToRepair) {
            await prisma.$transaction(async (tx) => {
                const relevantSectionIds = getRelevantSectionIdsForSubject(subject, context.sections);
                if (relevantSectionIds.length === 0)
                    return;
                const existingOwnership = await tx.subjectSectionOwnership.findMany({
                    where: {
                        schoolId: input.schoolId,
                        subjectId: subject.id,
                        sectionId: { in: relevantSectionIds },
                    },
                    select: { sectionId: true },
                });
                const ownedSet = new Set(existingOwnership.map((row) => row.sectionId));
                const uncoveredSectionIds = relevantSectionIds.filter((sectionId) => !ownedSet.has(sectionId));
                if (uncoveredSectionIds.length === 0)
                    return;
                const placeholder = await ensureSubjectPlaceholderFaculty(tx, input.schoolId, subject.code);
                if (placeholder.created) {
                    createdPlaceholders.push({ facultyId: placeholder.facultyId, subjectCode: subject.code });
                }
                else {
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
                const mergedGradeLevels = [...new Set(mergedSectionIds.map((sectionId) => gradeBySectionId.get(sectionId)).filter((value) => Number.isInteger(value)))].sort((a, b) => a - b);
                let facultySubjectId;
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
                }
                else {
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
function buildServiceError(code, error, details) {
    return { success: false, code, error, details };
}
function toAssignmentResponse(assignment, normalized) {
    return {
        ...assignment,
        gradeLevels: normalized.gradeLevels,
        sectionIds: normalized.sectionIds,
        sections: normalized.sections,
    };
}
async function buildRosterIndex(schoolId, schoolYearId, authToken) {
    const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
    return buildSectionRosterIndex(sectionResult.gradeLevels);
}
export async function getAssignmentsByFaculty(facultyId, schoolYearId, authToken) {
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
export async function setAssignments(facultyId, schoolId, schoolYearId, assignedBy, expectedVersion, assignments, authToken) {
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
    let normalizedAssignments = [];
    let rosterIndex = null;
    if (assignments.length > 0) {
        rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
        const validSubjects = await prisma.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true },
        });
        const validSubjectIds = new Set(validSubjects.map((subject) => subject.id));
        const invalidSubjectIds = subjectIds.filter((subjectId) => !validSubjectIds.has(subjectId));
        if (invalidSubjectIds.length > 0) {
            return buildServiceError('INVALID_SUBJECTS', 'One or more subjects are not valid for the selected school.', { invalidSubjectIds });
        }
        for (const assignment of assignments) {
            const normalized = normalizeIncomingAssignmentScope(assignment, rosterIndex);
            if (!normalized.ok) {
                return buildServiceError('INVALID_ASSIGNMENT_SCOPE', normalized.error.message, { subjectId: assignment.subjectId, ...normalized.error });
            }
            normalizedAssignments.push(normalized.value);
        }
    }
    // ── HG Advisory Guard ──────────────────────────────────────────────────────
    // If this faculty is a class adviser, their HG section is immutable.
    // Reject any payload that would remove the advised section from HG.
    // Gather adviser info before entering the transaction.
    let advisedHgInfo = null;
    if (faculty.isClassAdviser && faculty.advisedSectionId) {
        const hgSubject = await prisma.subject.findFirst({
            where: { schoolId, code: HG_SUBJECT_CODE },
            select: { id: true },
        });
        if (hgSubject) {
            const hgInPayload = normalizedAssignments.find((a) => a.subjectId === hgSubject.id);
            if (hgInPayload && !hgInPayload.sectionIds.includes(faculty.advisedSectionId)) {
                return buildServiceError('HG_ADVISORY_IMMUTABLE', 'Cannot remove Homeroom Guidance assignment for an active class adviser.');
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
        ? normalizedAssignments.filter((a) => a.subjectId !== advisedHgInfo.hgSubjectId)
        : normalizedAssignments;
    try {
        await prisma.$transaction(async (tx) => {
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
                    const incomingPairs = new Set(assignmentsToCreate.flatMap((a) => a.sectionIds.map((sid) => `${a.subjectId}:${sid}`)));
                    const realConflicts = blockingOwners.filter((o) => incomingPairs.has(`${o.subjectId}:${o.sectionId}`));
                    if (realConflicts.length > 0) {
                        const conflictFacultyIds = [...new Set(realConflicts.map((c) => c.facultyId))];
                        const conflictFaculty = await tx.facultyMirror.findMany({
                            where: { id: { in: conflictFacultyIds } },
                            select: { id: true, firstName: true, lastName: true },
                        });
                        const nameMap = new Map(conflictFaculty.map((f) => [f.id, formatFacultyName(f.firstName, f.lastName)]));
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
                const ownershipData = createdSubjects.flatMap((fs) => fs.sectionIds.map((sectionId) => ({
                    schoolId,
                    facultySubjectId: fs.id,
                    facultyId,
                    subjectId: fs.subjectId,
                    sectionId,
                    assignedAt: new Date(),
                })));
                if (ownershipData.length > 0) {
                    await tx.subjectSectionOwnership.createMany({ data: ownershipData });
                }
            }
        }, { isolationLevel: 'Serializable' });
    }
    catch (error) {
        if (error?.success === false) {
            return error;
        }
        if (error?.code === 'P2034') {
            return buildServiceError('VERSION_CONFLICT', 'A concurrent assignment update occurred. Please reload and try again.');
        }
        // DB unique constraint uq_subject_section_owner fired (race slipped past the pre-flight check)
        if (error?.code === 'P2002' && error?.meta?.modelName === 'SubjectSectionOwnership') {
            return buildServiceError('DUPLICATE_SECTION_OWNERSHIP', 'A concurrent save created an ownership conflict on the same subject-section. Please reload and try again.');
        }
        throw error;
    }
    return { success: true, version: expectedVersion + 1 };
}
export async function getAssignmentSummary(schoolId, schoolYearId, authToken) {
    const [rosterIndex, faculty, ownershipRows] = await Promise.all([
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
        prisma.subjectSectionOwnership.findMany({
            where: { schoolId },
            select: {
                subjectId: true,
                sectionId: true,
                facultyId: true,
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
    const ownershipNameByFacultyId = new Map(ownershipFaculty.map((member) => [member.id, formatFacultyName(member.firstName, member.lastName)]));
    const ownershipIndex = ownershipRows.map((row) => ({
        subjectId: row.subjectId,
        sectionId: row.sectionId,
        facultyId: row.facultyId,
        facultyName: ownershipNameByFacultyId.get(row.facultyId) ?? `Faculty #${row.facultyId}`,
    }));
    const facultySummary = faculty.map((member) => {
        const assignments = member.facultySubjects.map((assignment) => {
            const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
            return toAssignmentResponse(assignment, normalized);
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
            advisoryEquivalentHours: member.advisoryEquivalentHours,
            ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
            canTeachOutsideDepartment: member.canTeachOutsideDepartment,
            isActiveForScheduling: member.isActiveForScheduling,
            maxHoursPerWeek: member.maxHoursPerWeek,
            version: member.version,
            subjectCount: assignments.length,
            sectionCount,
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
    return {
        faculty: facultySummary,
        ownershipIndex,
    };
}
//# sourceMappingURL=faculty-assignment.service.js.map