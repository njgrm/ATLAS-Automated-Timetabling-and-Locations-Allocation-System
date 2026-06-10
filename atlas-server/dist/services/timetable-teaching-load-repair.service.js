import { prisma } from '../lib/prisma.js';
import { buildHumanConflicts, buildPolicyImpacts, buildValidatorCtx, computeSummary, isPublishedSummary, loadRunContext, mergePreservedSummaryFields, } from './manual-edit.service.js';
import { validateHardConstraints } from './constraint-validator.js';
import { buildSectionRosterIndex, deriveGradeLevelsFromSectionIds } from './faculty-assignment-scope.service.js';
import { resolveAssignmentSpecializationIdentity } from './faculty-assignment.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
function positiveInt(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}
function normalizeChanges(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw err(400, 'EMPTY_REPAIR_BATCH', 'At least one Teaching Load repair is required.');
    }
    return raw.map((item, index) => {
        const candidate = item;
        const subjectId = positiveInt(candidate.subjectId);
        const sectionId = positiveInt(candidate.sectionId);
        const toFacultyId = positiveInt(candidate.toFacultyId);
        if (!candidate.entryId || typeof candidate.entryId !== 'string' || !subjectId || !sectionId || !toFacultyId) {
            throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} must include entryId, subjectId, sectionId, and toFacultyId.`);
        }
        const fromFacultyId = candidate.fromFacultyId == null ? null : positiveInt(candidate.fromFacultyId);
        if (candidate.fromFacultyId != null && !fromFacultyId) {
            throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} has an invalid fromFacultyId.`);
        }
        return {
            entryId: candidate.entryId,
            subjectId,
            sectionId,
            fromFacultyId,
            toFacultyId,
        };
    });
}
function teachingHoursByFaculty(entries, facultyIds) {
    const minutesByFaculty = new Map();
    for (const entry of entries) {
        if (entry.facultyId == null || !facultyIds.has(entry.facultyId))
            continue;
        minutesByFaculty.set(entry.facultyId, (minutesByFaculty.get(entry.facultyId) ?? 0) + Math.max(0, entry.durationMinutes));
    }
    return new Map([...facultyIds].map((facultyId) => [facultyId, Math.round(((minutesByFaculty.get(facultyId) ?? 0) / 60) * 10) / 10]));
}
function projectFacultySubjects(facultySubjects, changes) {
    const rows = new Map();
    for (const row of facultySubjects) {
        rows.set(`${row.facultyId}:${row.subjectId}`, {
            facultyId: row.facultyId,
            subjectId: row.subjectId,
            gradeLevels: [...row.gradeLevels],
            sectionIds: new Set(row.sectionIds),
        });
    }
    for (const change of changes) {
        for (const row of rows.values()) {
            if (row.subjectId === change.subjectId && row.facultyId !== change.toFacultyId) {
                row.sectionIds.delete(change.sectionId);
            }
        }
        const key = `${change.toFacultyId}:${change.subjectId}`;
        const target = rows.get(key) ?? {
            facultyId: change.toFacultyId,
            subjectId: change.subjectId,
            gradeLevels: [],
            sectionIds: new Set(),
        };
        target.sectionIds.add(change.sectionId);
        rows.set(key, target);
    }
    return [...rows.values()]
        .filter((row) => row.sectionIds.size > 0)
        .map((row) => ({
        facultyId: row.facultyId,
        subjectId: row.subjectId,
        gradeLevels: row.gradeLevels,
        sectionIds: [...row.sectionIds].sort((left, right) => left - right),
    }));
}
function buildDraftReport(run, entries, unassignedItems, summary, version) {
    return {
        runId: run.id,
        status: run.status,
        entries,
        unassignedItems,
        summary,
        version,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
async function validateExpectedFacultyVersions(schoolId, facultyIds, expectedFacultyVersions) {
    const uniqueFacultyIds = [...new Set(facultyIds)];
    const rows = uniqueFacultyIds.length === 0
        ? []
        : await prisma.facultyMirror.findMany({
            where: { schoolId, id: { in: uniqueFacultyIds } },
            select: { id: true, version: true, isActiveForScheduling: true },
        });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const facultyId of uniqueFacultyIds) {
        const row = byId.get(facultyId);
        if (!row)
            throw err(404, 'FACULTY_NOT_FOUND', `Faculty #${facultyId} was not found in this school.`);
        if (!row.isActiveForScheduling)
            throw err(409, 'FACULTY_INACTIVE', 'The selected teacher is no longer active for scheduling.');
        const expected = expectedFacultyVersions?.[String(facultyId)];
        if (typeof expected === 'number' && expected !== row.version) {
            throw err(409, 'FACULTY_VERSION_CONFLICT', 'Teaching Load changed while this panel was open. Reload the timetable and try again.');
        }
    }
    return new Map(rows.map((row) => [row.id, row.version]));
}
async function prepareRepair(runId, schoolId, schoolYearId, request) {
    const changes = normalizeChanges(request.changes);
    let refData;
    try {
        refData = await loadRunContext(runId, schoolId, schoolYearId);
    }
    catch (error) {
        const serviceError = error;
        if (serviceError.code === 'RUN_ALREADY_PUBLISHED') {
            throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
        }
        throw error;
    }
    const { run, entries } = refData;
    if (typeof request.expectedRunVersion === 'number' && run.version !== request.expectedRunVersion) {
        throw err(409, 'VERSION_CONFLICT', 'This timetable changed while the Teaching Load panel was open. Reload and review the change again.');
    }
    const entryById = new Map(entries.map((entry) => [entry.entryId, entry]));
    const subjectIds = [...new Set(changes.map((change) => change.subjectId))];
    const facultyIds = changes.flatMap((change) => [change.fromFacultyId, change.toFacultyId]).filter((id) => id != null);
    const [owners, subjects, facultyVersions] = await Promise.all([
        prisma.subjectSectionOwnership.findMany({
            where: {
                schoolId,
                OR: changes.map((change) => ({ subjectId: change.subjectId, sectionId: change.sectionId })),
            },
            select: { facultyId: true, subjectId: true, sectionId: true },
        }),
        prisma.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true, code: true },
        }),
        validateExpectedFacultyVersions(schoolId, facultyIds, request.expectedFacultyVersions),
    ]);
    const ownerByPair = new Map(owners.map((owner) => [`${owner.subjectId}:${owner.sectionId}`, owner.facultyId]));
    const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
    const newEntries = entries.map((entry) => ({ ...entry }));
    const proposals = [];
    const ownershipDeltas = [];
    const seenEntries = new Set();
    const seenScopes = new Set();
    const affectedFacultyIds = new Set();
    for (const [index, change] of changes.entries()) {
        if (seenEntries.has(change.entryId))
            throw err(400, 'DUPLICATE_REPAIR_ENTRY', `Entry ${change.entryId} appears more than once.`);
        seenEntries.add(change.entryId);
        const scopeKey = `${change.subjectId}:${change.sectionId}`;
        if (seenScopes.has(scopeKey))
            throw err(400, 'DUPLICATE_REPAIR_SCOPE', `Subject ${change.subjectId} section ${change.sectionId} appears more than once.`);
        seenScopes.add(scopeKey);
        const entry = entryById.get(change.entryId);
        if (!entry)
            throw err(400, 'ENTRY_NOT_FOUND', `Entry ${change.entryId} was not found in this generation run.`);
        if (entry.subjectId !== change.subjectId || entry.sectionId !== change.sectionId) {
            throw err(409, 'ENTRY_CONTEXT_CHANGED', 'The selected class no longer matches the Teaching Load repair context. Reload and try again.');
        }
        if (change.fromFacultyId != null && entry.facultyId !== change.fromFacultyId) {
            throw err(409, 'ENTRY_TEACHER_CHANGED', 'The timetable teacher changed while this panel was open. Reload and try again.');
        }
        if ((subjectCodeById.get(change.subjectId) ?? '').toUpperCase() === HG_SUBJECT_CODE) {
            throw err(409, 'HG_ADVISORY_IMMUTABLE', 'Homeroom Guidance ownership follows adviser records and cannot be changed from the timetable.');
        }
        if (entry.entryKind === 'COHORT') {
            throw err(409, 'COHORT_REPAIR_UNSUPPORTED', 'Cohort classes need a section coverage repair before Teaching Load can be changed from the timetable.');
        }
        const currentOwnerId = ownerByPair.get(`${change.subjectId}:${change.sectionId}`) ?? null;
        const matchingEntryIndexes = newEntries
            .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
            .filter(({ candidate }) => candidate.subjectId === change.subjectId && candidate.sectionId === change.sectionId)
            .map(({ candidateIndex }) => candidateIndex);
        if (matchingEntryIndexes.length === 0) {
            throw err(400, 'ENTRY_SCOPE_EMPTY', `No timetable entries were found for subject ${change.subjectId} section ${change.sectionId}.`);
        }
        let changedTimetableEntry = false;
        for (const entryIndex of matchingEntryIndexes) {
            const beforeEntry = newEntries[entryIndex];
            const afterEntry = beforeEntry.facultyId === change.toFacultyId ? beforeEntry : { ...beforeEntry, facultyId: change.toFacultyId };
            newEntries[entryIndex] = afterEntry;
            if (beforeEntry.facultyId !== change.toFacultyId)
                changedTimetableEntry = true;
            if (beforeEntry.facultyId != null)
                affectedFacultyIds.add(beforeEntry.facultyId);
            proposals.push({
                index: proposals.length,
                proposal: { editType: 'CHANGE_FACULTY', entryId: beforeEntry.entryId, targetFacultyId: change.toFacultyId },
                status: 'READY',
                entryId: beforeEntry.entryId,
                subjectId: change.subjectId,
                sectionId: change.sectionId,
                currentFacultyId: beforeEntry.facultyId,
                targetFacultyId: change.toFacultyId,
            });
        }
        affectedFacultyIds.add(change.toFacultyId);
        if (currentOwnerId != null)
            affectedFacultyIds.add(currentOwnerId);
        ownershipDeltas.push({
            entryId: change.entryId,
            subjectId: change.subjectId,
            sectionId: change.sectionId,
            fromFacultyId: change.fromFacultyId,
            toFacultyId: change.toFacultyId,
            currentOwnerId,
            timetableAction: changedTimetableEntry ? 'CHANGE_FACULTY' : 'NO_CHANGE',
            ownershipAction: currentOwnerId === change.toFacultyId ? 'NO_CHANGE' : 'TRANSFER',
        });
    }
    const currentValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData));
    const projectedRefData = {
        ...refData,
        facultySubjects: projectFacultySubjects(refData.facultySubjects, changes),
    };
    const newValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, projectedRefData));
    const beforeHours = teachingHoursByFaculty(entries, affectedFacultyIds);
    const afterHours = teachingHoursByFaculty(newEntries, affectedFacultyIds);
    const affectedTeachers = [...affectedFacultyIds].sort((left, right) => left - right).map((facultyId) => ({
        facultyId,
        beforeTeachingHours: beforeHours.get(facultyId) ?? 0,
        afterTeachingHours: afterHours.get(facultyId) ?? 0,
        version: facultyVersions.get(facultyId) ?? null,
    }));
    return {
        refData,
        changes,
        newEntries,
        ownershipDeltas,
        affectedTeachers,
        proposals,
        currentValidation,
        newValidation,
    };
}
function buildPreview(prepared) {
    const { currentValidation, newValidation, newEntries, refData, proposals, ownershipDeltas, affectedTeachers } = prepared;
    const hardBefore = currentValidation.violations.filter((violation) => violation.severity === 'HARD').length;
    const hardViolations = newValidation.violations.filter((violation) => violation.severity === 'HARD');
    const softBefore = currentValidation.violations.filter((violation) => violation.severity === 'SOFT').length;
    const softViolations = newValidation.violations.filter((violation) => violation.severity === 'SOFT');
    const allViolations = [...hardViolations, ...softViolations];
    return {
        allowed: hardViolations.length === 0,
        hardViolations,
        softViolations,
        violationDelta: {
            hardBefore,
            hardAfter: hardViolations.length,
            softBefore,
            softAfter: softViolations.length,
        },
        humanConflicts: buildHumanConflicts(allViolations, newEntries, refData),
        affectedEntries: [...new Set(proposals.map((proposal) => proposal.entryId).filter((entryId) => typeof entryId === 'string'))].flatMap((entryId) => {
            const before = prepared.refData.entries.find((entry) => entry.entryId === entryId);
            const after = prepared.newEntries.find((entry) => entry.entryId === entryId);
            return [before ? { ...before, phase: 'before' } : null, after ? { ...after, phase: 'after' } : null].filter((entry) => entry != null);
        }),
        policyImpactSummary: buildPolicyImpacts(allViolations, refData),
        proposalCount: proposals.length,
        errorCount: 0,
        proposals,
        ownershipDeltas,
        affectedTeachers,
    };
}
async function loadSectionGradeMap(tx, schoolId, schoolYearId) {
    const snapshot = await tx.sectionSnapshot.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        select: { payload: true },
    });
    const payload = Array.isArray(snapshot?.payload) ? snapshot.payload : [];
    const rosterIndex = buildSectionRosterIndex(payload);
    return new Map([...rosterIndex.sectionMap.entries()].map(([sectionId, section]) => [sectionId, section.displayOrder]));
}
async function syncFacultySubjectScopes(tx, schoolId, facultySubjectKeys, sectionGradeMap) {
    for (const key of facultySubjectKeys) {
        const facultySubject = await tx.facultySubject.findUnique({
            where: { facultyId_subjectId: { facultyId: key.facultyId, subjectId: key.subjectId } },
            select: { id: true },
        });
        if (!facultySubject)
            continue;
        const rows = await tx.subjectSectionOwnership.findMany({
            where: { schoolId, facultyId: key.facultyId, subjectId: key.subjectId },
            select: { sectionId: true },
        });
        const sectionIds = [...new Set(rows.map((row) => row.sectionId))].sort((left, right) => left - right);
        if (sectionIds.length === 0) {
            await tx.facultySubject.delete({ where: { id: facultySubject.id } });
            continue;
        }
        await tx.facultySubject.update({
            where: { id: facultySubject.id },
            data: {
                sectionIds,
                gradeLevels: deriveGradeLevelsFromSectionIds(sectionIds, sectionGradeMap),
            },
        });
    }
}
async function applyCanonicalOwnership(tx, schoolId, schoolYearId, actorId, changes) {
    const sectionGradeMap = await loadSectionGradeMap(tx, schoolId, schoolYearId);
    const touchedKeys = new Map();
    const subjectIds = [...new Set(changes.map((change) => change.subjectId))];
    const facultyIds = [...new Set(changes.map((change) => change.toFacultyId))];
    const [subjects, faculty] = await Promise.all([
        tx.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true, code: true, allowedSpecializations: true },
        }),
        tx.facultyMirror.findMany({
            where: { schoolId, id: { in: facultyIds } },
            select: { id: true, specialization: true },
        }),
    ]);
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const facultyById = new Map(faculty.map((row) => [row.id, row]));
    for (const change of changes) {
        const existingOwner = await tx.subjectSectionOwnership.findUnique({
            where: {
                schoolId_subjectId_sectionId: {
                    schoolId,
                    subjectId: change.subjectId,
                    sectionId: change.sectionId,
                },
            },
            select: { facultyId: true },
        });
        if (existingOwner) {
            touchedKeys.set(`${existingOwner.facultyId}:${change.subjectId}`, { facultyId: existingOwner.facultyId, subjectId: change.subjectId });
        }
        let facultySubject = await tx.facultySubject.findUnique({
            where: { facultyId_subjectId: { facultyId: change.toFacultyId, subjectId: change.subjectId } },
            select: { id: true },
        });
        if (!facultySubject) {
            facultySubject = await tx.facultySubject.create({
                data: {
                    facultyId: change.toFacultyId,
                    subjectId: change.subjectId,
                    schoolId,
                    gradeLevels: [],
                    sectionIds: [],
                    assignedBy: actorId,
                },
                select: { id: true },
            });
        }
        const subject = subjectById.get(change.subjectId);
        const destinationFaculty = facultyById.get(change.toFacultyId);
        const specializationIdentity = resolveAssignmentSpecializationIdentity({
            subjectCode: subject?.code,
            allowedSpecializations: subject?.allowedSpecializations,
            facultySpecialization: destinationFaculty?.specialization,
        });
        await tx.subjectSectionOwnership.upsert({
            where: {
                schoolId_subjectId_sectionId: {
                    schoolId,
                    subjectId: change.subjectId,
                    sectionId: change.sectionId,
                },
            },
            update: {
                facultySubjectId: facultySubject.id,
                facultyId: change.toFacultyId,
                specializationCode: specializationIdentity.specializationCode,
                specializationLabel: specializationIdentity.specializationLabel,
                assignedAt: new Date(),
            },
            create: {
                schoolId,
                facultySubjectId: facultySubject.id,
                facultyId: change.toFacultyId,
                subjectId: change.subjectId,
                sectionId: change.sectionId,
                specializationCode: specializationIdentity.specializationCode,
                specializationLabel: specializationIdentity.specializationLabel,
                assignedAt: new Date(),
            },
        });
        touchedKeys.set(`${change.toFacultyId}:${change.subjectId}`, { facultyId: change.toFacultyId, subjectId: change.subjectId });
        if (change.fromFacultyId != null) {
            touchedKeys.set(`${change.fromFacultyId}:${change.subjectId}`, { facultyId: change.fromFacultyId, subjectId: change.subjectId });
        }
    }
    await syncFacultySubjectScopes(tx, schoolId, [...touchedKeys.values()], sectionGradeMap);
    const affectedFacultyIds = [...new Set(changes.flatMap((change) => [change.fromFacultyId, change.toFacultyId]).filter((id) => id != null))];
    if (affectedFacultyIds.length > 0) {
        await tx.facultyMirror.updateMany({
            where: { schoolId, id: { in: affectedFacultyIds } },
            data: { version: { increment: 1 } },
        });
    }
}
export async function previewTeachingLoadRepair(runId, schoolId, schoolYearId, request) {
    const prepared = await prepareRepair(runId, schoolId, schoolYearId, request);
    return buildPreview(prepared);
}
export async function applyTeachingLoadRepair(runId, schoolId, schoolYearId, actorId, request) {
    const prepared = await prepareRepair(runId, schoolId, schoolYearId, request);
    const preview = buildPreview(prepared);
    if (!preview.allowed || preview.hardViolations.length > 0) {
        throw err(422, 'HARD_VIOLATION_BLOCK', `Cannot save Teaching Load repair: ${preview.hardViolations.length} blocking conflict(s).`);
    }
    if (preview.softViolations.length > 0 && !request.allowSoftOverride) {
        throw err(422, 'SOFT_OVERRIDE_REQUIRED', `Repair has ${preview.softViolations.length} warning(s). Review and confirm before saving.`);
    }
    const { refData, newEntries } = prepared;
    const { run, unassignedItems } = refData;
    if (isPublishedSummary(run.summary)) {
        throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
    }
    const expectedVersion = request.expectedRunVersion;
    if (typeof expectedVersion !== 'number') {
        throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when applying a Teaching Load repair.');
    }
    const newSummary = computeSummary(newEntries, unassignedItems, prepared.newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    const { updatedRun, editRecords } = await prisma.$transaction(async (tx) => {
        const currentRun = await tx.generationRun.findFirst({
            where: { id: runId, schoolId, schoolYearId },
            select: { version: true, summary: true, status: true },
        });
        if (!currentRun)
            throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
        if (currentRun.status !== 'COMPLETED')
            throw err(400, 'RUN_NOT_COMPLETED', 'Teaching Load repairs can only be applied to completed runs.');
        if (isPublishedSummary(currentRun.summary)) {
            throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
        }
        if (currentRun.version !== expectedVersion) {
            throw err(409, 'VERSION_CONFLICT', 'This timetable changed while the Teaching Load panel was open. Reload and review the change again.');
        }
        await applyCanonicalOwnership(tx, schoolId, schoolYearId, actorId, prepared.changes);
        const updated = await tx.generationRun.update({
            where: { id: runId, version: expectedVersion },
            data: {
                draftEntries: newEntries,
                unassignedItems: unassignedItems,
                violations: prepared.newValidation.violations,
                summary: preservedSummary,
                version: newVersion,
            },
        });
        const created = [];
        for (const proposal of prepared.proposals) {
            if (!proposal.entryId)
                continue;
            const beforeEntry = prepared.refData.entries.find((entry) => entry.entryId === proposal.entryId) ?? null;
            const afterEntry = newEntries.find((entry) => entry.entryId === proposal.entryId) ?? null;
            created.push(await tx.manualScheduleEdit.create({
                data: {
                    runId,
                    schoolId,
                    schoolYearId,
                    actorId,
                    editType: 'CHANGE_FACULTY',
                    beforePayload: (beforeEntry ?? {}),
                    afterPayload: (afterEntry ?? {}),
                    validationSummary: {
                        source: 'TEACHING_LOAD_REPAIR',
                        subjectId: proposal.subjectId,
                        sectionId: proposal.sectionId,
                        fromFacultyId: proposal.currentFacultyId,
                        toFacultyId: proposal.targetFacultyId,
                        hardCount: preview.hardViolations.length,
                        softCount: preview.softViolations.length,
                        delta: preview.violationDelta,
                    },
                },
            }));
        }
        await tx.auditLog.create({
            data: {
                schoolId,
                schoolYearId,
                action: 'TIMETABLE_TEACHING_LOAD_REPAIR',
                actorId,
                targetIds: [runId],
                metadata: {
                    editIds: created.map((edit) => edit.id),
                    entryIds: prepared.proposals.map((proposal) => proposal.entryId).filter((entryId) => typeof entryId === 'string'),
                    changeCount: prepared.changes.length,
                    newVersion,
                },
            },
        });
        return { updatedRun: updated, editRecords: created };
    });
    return {
        editId: editRecords[0]?.id ?? 0,
        editIds: editRecords.map((edit) => edit.id),
        draft: buildDraftReport(updatedRun, newEntries, unassignedItems, newSummary, updatedRun.version),
        violationDelta: preview.violationDelta,
        warnings: preview.softViolations,
        newVersion: updatedRun.version,
        ownershipDeltas: preview.ownershipDeltas,
        affectedTeachers: preview.affectedTeachers,
    };
}
//# sourceMappingURL=timetable-teaching-load-repair.service.js.map