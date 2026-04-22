/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { constructBaseline } from './schedule-constructor.js';
import { sectionAdapter } from './section-adapter.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
function extractDraftFacultyIds(draftEntries) {
    if (!Array.isArray(draftEntries))
        return [];
    const facultyIds = draftEntries
        .map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? entry.facultyId : undefined))
        .filter((facultyId) => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
    return [...new Set(facultyIds)];
}
async function getActiveFacultyMirrorIdSet(schoolId) {
    const faculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isActiveForScheduling: true, isStale: false },
        select: { id: true },
    });
    return new Set(faculty.map((member) => member.id));
}
function getStaleFacultyIdsForRun(run, activeFacultyIds) {
    return extractDraftFacultyIds(run.draftEntries).filter((facultyId) => !activeFacultyIds.has(facultyId));
}
// ─── Trigger ───
export async function triggerGenerationRun(schoolId, schoolYearId, actorId) {
    // Create run as QUEUED
    const run = await prisma.generationRun.create({
        data: {
            schoolId,
            schoolYearId,
            triggeredBy: actorId,
            status: 'QUEUED',
        },
    });
    // Transition to RUNNING
    const startedAt = new Date();
    await prisma.generationRun.update({
        where: { id: run.id },
        data: { status: 'RUNNING', startedAt },
    });
    let stage = 'init';
    try {
        stage = 'pre-generation-drafts';
        const preGenerationDrafts = await preGenerationDraftService.consumeDraftPlacementsForRun(run.id, schoolId, schoolYearId);
        // ── Fetch all input data for construction ──
        stage = 'sections-fetch';
        const [sectionResult, faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows, cohorts] = await Promise.all([
            sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId),
            prisma.facultyMirror.findMany({
                where: { schoolId, isActiveForScheduling: true },
                select: { id: true, maxHoursPerWeek: true },
            }),
            prisma.facultySubject.findMany({
                where: { schoolId },
                select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
            }),
            prisma.room.findMany({
                where: {
                    isTeachingSpace: true,
                    building: { schoolId, isTeachingBuilding: true },
                },
                select: { id: true, type: true, isTeachingSpace: true, capacity: true, buildingId: true },
            }),
            prisma.subject.findMany({
                where: { schoolId, isActive: true },
                select: {
                    id: true,
                    code: true,
                    minMinutesPerWeek: true,
                    preferredRoomType: true,
                    sessionPattern: true,
                    gradeLevels: true,
                    interSectionEnabled: true,
                    interSectionGradeLevels: true,
                },
            }),
            prisma.facultyPreference.findMany({
                where: { schoolId, schoolYearId },
                select: {
                    facultyId: true,
                    status: true,
                    timeSlots: { select: { day: true, startTime: true, endTime: true, preference: true } },
                },
            }),
            getOrCreatePolicy(schoolId, schoolYearId),
            prisma.building.findMany({
                where: { schoolId },
                select: { id: true, x: true, y: true },
            }),
            prisma.gradeShiftWindow.findMany({
                where: { schoolId, schoolYearId },
            }),
            prisma.instructionalCohort.findMany({
                where: { schoolId, schoolYearId },
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
            }),
        ]);
        const rosterIndex = buildSectionRosterIndex(sectionResult.gradeLevels);
        const facultySubjects = facultySubjectRows.map((assignment) => {
            const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
            return {
                facultyId: assignment.facultyId,
                subjectId: assignment.subjectId,
                gradeLevels: normalized.gradeLevels,
                sectionIds: normalized.sectionIds,
            };
        });
        // ── Run baseline constructor ──
        stage = 'constructor';
        const sectionsByGrade = sectionResult.gradeLevels;
        const constructorInput = {
            schoolId,
            schoolYearId,
            sectionsByGrade,
            subjects,
            cohorts,
            faculty,
            facultySubjects,
            rooms,
            preferences: preferences.map((p) => ({
                facultyId: p.facultyId,
                status: p.status,
                timeSlots: p.timeSlots.map((ts) => ({
                    day: ts.day,
                    startTime: ts.startTime,
                    endTime: ts.endTime,
                    preference: ts.preference,
                })),
            })),
            policy: {
                maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
                minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
                maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
                earliestStartTime: policyRecord.earliestStartTime,
                latestEndTime: policyRecord.latestEndTime,
                lunchStartTime: policyRecord.lunchStartTime ?? undefined,
                lunchEndTime: policyRecord.lunchEndTime ?? undefined,
                enforceLunchWindow: policyRecord.enforceLunchWindow ?? undefined,
                enableTleTwoPassPriority: policyRecord.enableTleTwoPassPriority ?? true,
                allowFlexibleSubjectAssignment: policyRecord.allowFlexibleSubjectAssignment ?? false,
                allowConsecutiveLabSessions: policyRecord.allowConsecutiveLabSessions ?? false,
            },
            lockedEntries: preGenerationDrafts.lockedEntries,
            gradeWindows: gradeWindows.map((gw) => ({
                gradeLevel: gw.gradeLevel,
                startTime: gw.startTime,
                endTime: gw.endTime,
            })),
        };
        const result = constructBaseline(constructorInput);
        // ── Validate constructed entries ──
        stage = 'validator';
        const validatorCtx = {
            schoolId, schoolYearId, runId: run.id,
            entries: result.entries, faculty, facultySubjects, rooms, subjects,
            sectionEnrollment: new Map(sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount]))),
            policy: {
                ...constructorInput.policy,
                enforceConsecutiveBreakAsHard: policyRecord.enforceConsecutiveBreakAsHard,
            },
            travelPolicy: {
                enableTravelWellbeingChecks: policyRecord.enableTravelWellbeingChecks,
                maxWalkingDistanceMetersPerTransition: policyRecord.maxWalkingDistanceMetersPerTransition,
                maxBuildingTransitionsPerDay: policyRecord.maxBuildingTransitionsPerDay,
                maxBackToBackTransitionsWithoutBuffer: policyRecord.maxBackToBackTransitionsWithoutBuffer,
                maxIdleGapMinutesPerDay: policyRecord.maxIdleGapMinutesPerDay,
                avoidEarlyFirstPeriod: policyRecord.avoidEarlyFirstPeriod,
                avoidLateLastPeriod: policyRecord.avoidLateLastPeriod,
            },
            vacantPolicy: {
                enableVacantAwareConstraints: policyRecord.enableVacantAwareConstraints,
                targetFacultyDailyVacantMinutes: policyRecord.targetFacultyDailyVacantMinutes,
                targetSectionDailyVacantPeriods: policyRecord.targetSectionDailyVacantPeriods,
                maxCompressedTeachingMinutesPerDay: policyRecord.maxCompressedTeachingMinutesPerDay,
            },
            buildings,
            roomBuildings: rooms.map((r) => ({ roomId: r.id, buildingId: r.buildingId })),
            constraintConfig: {
                ...DEFAULT_CONSTRAINT_CONFIG,
                ...(policyRecord.constraintConfig ?? {}),
            },
        };
        const validationResult = validateHardConstraints(validatorCtx);
        const summary = {
            classesProcessed: result.classesProcessed,
            assignedCount: result.assignedCount,
            unassignedCount: result.unassignedCount,
            policyBlockedCount: result.policyBlockedCount,
            hardViolationCount: validationResult.violations.filter((v) => v.severity === 'HARD').length,
            prePlacedCount: preGenerationDrafts.prePlacedCount,
            invalidPrePlacedCount: preGenerationDrafts.invalidPrePlacedCount,
            skippedPrePlacedReasons: preGenerationDrafts.skippedPrePlacedReasons.length > 0 ? preGenerationDrafts.skippedPrePlacedReasons : undefined,
            violationCounts: validationResult.counts.byCode,
            lockWarnings: result.lockWarnings.length > 0 ? result.lockWarnings : undefined,
            cohortCount: cohorts.length,
            cohortizedClassCount: result.entries.filter((entry) => entry.entryKind === 'COHORT').length,
            contractWarnings: [
                ...(sectionResult.contractWarnings ?? []),
            ].length > 0 ? [
                ...(sectionResult.contractWarnings ?? []),
            ] : undefined,
        };
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        // Finalize as COMPLETED with draft entries
        stage = 'persist';
        const completed = await prisma.generationRun.update({
            where: { id: run.id },
            data: {
                status: 'COMPLETED',
                finishedAt,
                durationMs,
                summary: summary,
                violations: validationResult.violations,
                draftEntries: result.entries,
                unassignedItems: result.unassignedItems,
            },
        });
        // Audit log
        await prisma.auditLog.create({
            data: {
                schoolId,
                schoolYearId,
                action: 'GENERATION_RUN_COMPLETED',
                actorId,
                targetIds: [run.id],
                metadata: { durationMs, summary },
            },
        });
        await preGenerationDraftService.markPlacementsLockedForRun(schoolId, schoolYearId, run.id, preGenerationDrafts.acceptedPlacementIds);
        return completed;
    }
    catch (error) {
        // Finalize as FAILED with stage-tagged diagnostics
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const rawMessage = error instanceof Error ? error.message : String(error);
        const errorMessage = `[${stage}] ${rawMessage}`;
        const failed = await prisma.generationRun.update({
            where: { id: run.id },
            data: {
                status: 'FAILED',
                finishedAt,
                durationMs,
                error: errorMessage,
            },
        });
        await prisma.auditLog.create({
            data: {
                schoolId,
                schoolYearId,
                action: 'GENERATION_RUN_FAILED',
                actorId,
                targetIds: [run.id],
                metadata: { durationMs, stage, error: rawMessage },
            },
        });
        return failed;
    }
}
// ─── Queries ───
export async function getRunById(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return run;
}
export async function getLatestRun(schoolId, schoolYearId) {
    return getLatestValidRun(schoolId, schoolYearId);
}
export async function getLatestValidRun(schoolId, schoolYearId) {
    const [runs, activeFacultyIds] = await Promise.all([
        prisma.generationRun.findMany({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
        }),
        getActiveFacultyMirrorIdSet(schoolId),
    ]);
    if (runs.length === 0) {
        throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
    }
    for (const run of runs) {
        if (getStaleFacultyIdsForRun(run, activeFacultyIds).length === 0) {
            return run;
        }
    }
    const latestRun = runs[0];
    const staleFacultyIds = getStaleFacultyIdsForRun(latestRun, activeFacultyIds);
    throw err(409, 'STALE_RUN_DATA', 'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.', {
        actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
        details: { latestRunId: latestRun.id, staleFacultyIds },
    });
}
export async function assertLatestRunIsCurrent(schoolId, schoolYearId) {
    const [latestRun, activeFacultyIds] = await Promise.all([
        prisma.generationRun.findFirst({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
        }),
        getActiveFacultyMirrorIdSet(schoolId),
    ]);
    if (!latestRun) {
        throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
    }
    const staleFacultyIds = getStaleFacultyIdsForRun(latestRun, activeFacultyIds);
    if (staleFacultyIds.length > 0) {
        throw err(409, 'STALE_RUN_DATA', 'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.', {
            actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
            details: { latestRunId: latestRun.id, staleFacultyIds },
        });
    }
    return latestRun;
}
export async function listRuns(schoolId, schoolYearId, limit = 20) {
    return prisma.generationRun.findMany({
        where: { schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
export async function getRunViolations(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, violations: true, summary: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    const violations = (run.violations ?? []);
    const summary = (run.summary ?? {});
    const violationCounts = (summary.violationCounts ?? {});
    return {
        runId: run.id,
        status: run.status,
        violations,
        counts: {
            total: violations.length,
            byCode: violationCounts,
        },
    };
}
export async function getLatestRunViolations(schoolId, schoolYearId) {
    const run = await getLatestValidRun(schoolId, schoolYearId);
    const violations = (run.violations ?? []);
    const summary = (run.summary ?? {});
    const violationCounts = (summary.violationCounts ?? {});
    return {
        runId: run.id,
        status: run.status,
        violations,
        counts: {
            total: violations.length,
            byCode: violationCounts,
        },
    };
}
export async function getRunDraft(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return {
        runId: run.id,
        status: run.status,
        entries: (run.draftEntries ?? []),
        unassignedItems: (run.unassignedItems ?? []),
        summary: (run.summary ?? null),
        version: run.version,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
export async function getLatestRunDraft(schoolId, schoolYearId) {
    const run = await getLatestValidRun(schoolId, schoolYearId);
    return {
        runId: run.id,
        status: run.status,
        entries: (run.draftEntries ?? []),
        unassignedItems: (run.unassignedItems ?? []),
        summary: (run.summary ?? null),
        version: run.version,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
export async function invalidateStaleCompletedRuns(schoolId, schoolYearId) {
    const [runs, activeFacultyIds] = await Promise.all([
        prisma.generationRun.findMany({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, draftEntries: true },
        }),
        getActiveFacultyMirrorIdSet(schoolId),
    ]);
    const staleRunIds = runs
        .filter((run) => getStaleFacultyIdsForRun(run, activeFacultyIds).length > 0)
        .map((run) => run.id);
    if (staleRunIds.length === 0) {
        return { invalidatedCount: 0, staleRunIds: [] };
    }
    await prisma.generationRun.updateMany({
        where: { id: { in: staleRunIds } },
        data: {
            status: 'FAILED',
            error: 'INVALIDATED_BY_MIRROR_RESET',
        },
    });
    return { invalidatedCount: staleRunIds.length, staleRunIds };
}
//# sourceMappingURL=generation.service.js.map