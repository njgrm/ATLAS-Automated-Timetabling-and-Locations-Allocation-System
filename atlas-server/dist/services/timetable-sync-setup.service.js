import { prisma } from '../lib/prisma.js';
import { loadRunContext, isPublishedSummary } from './manual-edit.service.js';
import { validateHardConstraints } from './constraint-validator.js';
import { computeDemand } from './schedule-constructor.js';
import { getTemplatePeriodProfiles } from './class-template.service.js';
import { computeGenerationInputSnapshot } from './generation-input-snapshot.service.js';
import { getSectionSummary } from './section.service.js';
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
export async function syncTimetableSetup(schoolId, schoolYearId, runId, actorId) {
    // 1. Fetch live run context
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { run } = refData;
    if (isPublishedSummary(run.summary)) {
        throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published.');
    }
    // 2. Fetch live reference databases
    const activeSubjects = await prisma.subject.findMany({
        where: { schoolId, isActive: true },
        select: {
            id: true,
            code: true,
            name: true,
            ownerDepartment: true,
            qualificationPriority: true,
            minMinutesPerWeek: true,
            preferredRoomType: true,
            gradeLevels: true,
            interSectionEnabled: true,
            interSectionGradeLevels: true,
            programScopes: true,
            allowedSpecializations: true,
            requiredFeatures: true,
            modularGroupId: true,
            modularOrder: true,
        },
    });
    const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
    const activeSubjectCodeById = new Map(activeSubjects.map((s) => [s.id, s.code]));
    const sectionSummary = await getSectionSummary(schoolYearId, schoolId);
    const activeSections = sectionSummary.sections;
    const sectionsByGrade = sectionSummary.gradeLevels;
    const activeSectionIds = new Set(activeSections.map((s) => s.id));
    // Rebuild section enrollment map from live mirrors
    const liveSectionEnrollment = new Map();
    for (const s of activeSections) {
        liveSectionEnrollment.set(s.id, s.enrolledCount);
    }
    refData.sectionEnrollment = liveSectionEnrollment;
    // Load live teaching load ownerships
    const ownerships = await prisma.subjectSectionOwnership.findMany({
        where: { schoolId },
    });
    const ownershipMap = new Map();
    for (const o of ownerships) {
        ownershipMap.set(`${o.subjectId}:${o.sectionId}`, o.facultyId);
    }
    // 3. Update existing draftEntries
    const oldEntries = (run.draftEntries ?? []);
    const newEntries = [];
    let updatedFacultyCount = 0;
    let displacedEntriesCount = 0;
    for (const entry of oldEntries) {
        // Filter out deleted/inactive subjects and sections
        if (!activeSubjectIds.has(entry.subjectId) || !activeSectionIds.has(entry.sectionId)) {
            displacedEntriesCount++;
            continue;
        }
        const subjectCode = (activeSubjectCodeById.get(entry.subjectId) ?? '').toUpperCase();
        if (subjectCode === 'HG' || subjectCode === 'HOMEROOM' || subjectCode.startsWith('HOMEROOM_GUIDANCE')) {
            // Homeroom Guidance adviser assignment is immutable from teaching load sync, preserve it.
            newEntries.push(entry);
            continue;
        }
        const key = `${entry.subjectId}:${entry.sectionId}`;
        const liveFacultyId = ownershipMap.has(key) ? ownershipMap.get(key) : null;
        if (entry.facultyId !== liveFacultyId) {
            updatedFacultyCount++;
        }
        newEntries.push({
            ...entry,
            facultyId: liveFacultyId ?? null,
        });
    }
    // 4. Track displaced and new curriculum sessions (rebuild unassigned list)
    const cohorts = await prisma.instructionalCohort.findMany({
        where: { schoolId, schoolYearId, isActive: true },
        orderBy: [{ gradeLevel: 'asc' }, { cohortCode: 'asc' }],
        select: {
            cohortCode: true,
            specializationCode: true,
            specializationName: true,
            gradeLevel: true,
            memberSectionIds: true,
            expectedEnrollment: true,
            preferredRoomType: true,
        },
    });
    const templateProfiles = await getTemplatePeriodProfiles(schoolId);
    const classTemplatePeriods = {};
    for (const profile of templateProfiles) {
        classTemplatePeriods[profile.programType.toUpperCase()] = profile.periodsPerDay;
    }
    // Compute target curriculum demand
    const demand = computeDemand(sectionsByGrade, activeSubjects, cohorts, classTemplatePeriods);
    const entryMatchesDemand = (entry, item) => {
        if (item.entryKind === 'COHORT' && item.cohortCode) {
            return entry.entryKind === 'COHORT' && entry.cohortCode === item.cohortCode && entry.subjectId === item.subjectId;
        }
        return entry.entryKind === 'SECTION' && entry.sectionId === item.sectionId && entry.subjectId === item.subjectId;
    };
    const newUnassignedItems = [];
    let addedUnassignedCount = 0;
    for (const demandItem of demand) {
        // Count matching scheduled entries in our updated newEntries list
        const matches = newEntries.filter((entry) => entryMatchesDemand(entry, demandItem));
        const sessionsNeeded = demandItem.sessionsPerWeek;
        if (matches.length < sessionsNeeded) {
            const missingCount = sessionsNeeded - matches.length;
            addedUnassignedCount += missingCount;
            for (let s = matches.length + 1; s <= sessionsNeeded; s++) {
                const key = `${demandItem.subjectId}:${demandItem.sectionId}`;
                const liveFacultyId = ownershipMap.has(key) ? ownershipMap.get(key) : null;
                let reason = 'NO_AVAILABLE_SLOT';
                if (!liveFacultyId) {
                    reason = 'NO_QUALIFIED_FACULTY';
                }
                newUnassignedItems.push({
                    sectionId: demandItem.sectionId,
                    subjectId: demandItem.subjectId,
                    gradeLevel: demandItem.gradeLevel,
                    session: s,
                    reason,
                    roomAssignmentReason: 'FALLBACK_UNRESOLVED',
                    entryKind: demandItem.entryKind,
                    programType: demandItem.programType ?? null,
                    programCode: demandItem.programCode ?? null,
                    programName: demandItem.programName ?? null,
                    cohortCode: demandItem.cohortCode ?? null,
                    cohortName: demandItem.cohortName ?? null,
                    cohortMemberSectionIds: demandItem.cohortMemberSectionIds,
                    cohortExpectedEnrollment: demandItem.entryKind === 'COHORT' ? demandItem.enrolledCount : null,
                    adviserId: demandItem.adviserId ?? null,
                    adviserName: demandItem.adviserName ?? null,
                    homeRoomId: demandItem.homeRoomId ?? null,
                });
            }
        }
    }
    // 5. Recompute constraint validation
    refData.subjects = activeSubjects;
    const { buildValidatorCtx } = await import('./manual-edit.service.js');
    const validatorCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const validationResult = validateHardConstraints(validatorCtx);
    const violations = validationResult.violations;
    // Calculate counts
    const hardViolationCount = violations.filter((v) => v.severity === 'HARD').length;
    const softViolationCount = violations.filter((v) => v.severity === 'SOFT').length;
    // 6. Update summary metrics and version
    const currentSummary = (run.summary ?? {});
    const nextVersion = (run.version ?? 1) + 1;
    const classesProcessed = demand.reduce((sum, item) => sum + item.sessionsPerWeek, 0);
    const assignedCount = newEntries.length;
    const unassignedCount = newUnassignedItems.length;
    // Compile resource diagnostics
    const { buildQualifiedCoverageBySubject, buildSlotSaturation, buildUnassignedBySubjectGrade, buildHomeRoomStats, buildHomeRoomFallbackDiagnostics } = await import('./generation.service.js');
    const facultySubjectRows = await prisma.facultySubject.findMany({
        where: { schoolId },
        select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
    });
    const activeFacultyIdSet = new Set(refData.faculty.map((member) => member.id));
    const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
    const normalizedFacultySubjects = facultySubjectRows
        .filter((assignment) => activeFacultyIdSet.has(assignment.facultyId))
        .map((assignment) => {
        const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
        return {
            facultyId: assignment.facultyId,
            subjectId: assignment.subjectId,
            gradeLevels: normalized.gradeLevels,
            sectionIds: normalized.sectionIds,
        };
    });
    const qualifiedFacultyCoverageBySubject = buildQualifiedCoverageBySubject(demand, normalizedFacultySubjects);
    const slotSaturationByInterval = buildSlotSaturation(newEntries, refData.rooms.length);
    const unassignedBySubjectGrade = buildUnassignedBySubjectGrade(newUnassignedItems, activeSubjectCodeById);
    const homeRoomStats = buildHomeRoomStats(newEntries, newUnassignedItems);
    const homeRoomFallbackDiagnostics = buildHomeRoomFallbackDiagnostics(newEntries, newUnassignedItems);
    // Compute updated input snapshot status
    const nextInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);
    const updatedSummary = {
        ...currentSummary,
        classesProcessed,
        assignedCount,
        unassignedCount,
        hardViolationCount,
        softViolationCount,
        homeRoomAttemptedCount: homeRoomStats.attempted,
        homeRoomAssignedCount: homeRoomStats.assigned,
        homeRoomSuccessRate: homeRoomStats.successRate,
        resourceDiagnostics: {
            ...currentSummary.resourceDiagnostics,
            qualifiedFacultyCoverageBySubject,
            slotSaturationByInterval,
            unassignedBySubjectGrade,
            homeRoomFallbackDiagnostics,
        },
        inputSnapshot: nextInputSnapshot,
    };
    // 7. Save updated run in a database transaction
    const updatedRun = await prisma.$transaction(async (tx) => {
        const updated = await tx.generationRun.update({
            where: { id: runId },
            data: {
                draftEntries: newEntries,
                unassignedItems: newUnassignedItems,
                violations: violations,
                summary: updatedSummary,
                version: nextVersion,
            },
        });
        await tx.auditLog.create({
            data: {
                schoolId,
                schoolYearId,
                action: 'GENERATION_RUN_SYNCED_WITH_SETUP',
                actorId,
                targetIds: [runId],
                metadata: {
                    runId,
                    previousVersion: run.version,
                    nextVersion,
                    updatedFacultyCount,
                    displacedEntriesCount,
                    addedUnassignedCount,
                    hardViolationCount,
                    softViolationCount,
                    timestamp: new Date().toISOString(),
                },
            },
        });
        return updated;
    });
    return {
        runId: updatedRun.id,
        version: updatedRun.version,
        updatedFacultyCount,
        displacedEntriesCount,
        addedUnassignedCount,
        hardViolationCount,
        softViolationCount,
        summary: updatedRun.summary,
    };
}
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
//# sourceMappingURL=timetable-sync-setup.service.js.map