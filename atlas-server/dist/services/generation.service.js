/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { constructBaseline } from './schedule-constructor.js';
import { sectionAdapter } from './section-adapter.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
// ─── Helpers ───
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
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
    try {
        // ── Fetch all input data for construction ──
        const [sectionsByGrade, faculty, facultySubjects, rooms, subjects, preferences, policyRecord] = await Promise.all([
            sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId),
            prisma.facultyMirror.findMany({
                where: { schoolId, isActiveForScheduling: true },
                select: { id: true, maxHoursPerWeek: true },
            }),
            prisma.facultySubject.findMany({
                where: { schoolId },
                select: { facultyId: true, subjectId: true, gradeLevels: true },
            }),
            prisma.room.findMany({
                where: { building: { schoolId } },
                select: { id: true, type: true, isTeachingSpace: true },
            }),
            prisma.subject.findMany({
                where: { schoolId, isActive: true },
                select: { id: true, minMinutesPerWeek: true, preferredRoomType: true, gradeLevels: true },
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
        ]);
        // ── Run baseline constructor ──
        const constructorInput = {
            schoolId,
            schoolYearId,
            sectionsByGrade,
            subjects,
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
            },
        };
        const result = constructBaseline(constructorInput);
        // ── Validate constructed entries ──
        const validatorCtx = {
            schoolId, schoolYearId, runId: run.id,
            entries: result.entries, faculty, facultySubjects, rooms, subjects,
            policy: {
                ...constructorInput.policy,
                enforceConsecutiveBreakAsHard: policyRecord.enforceConsecutiveBreakAsHard,
            },
        };
        const validationResult = validateHardConstraints(validatorCtx);
        const summary = {
            classesProcessed: result.classesProcessed,
            assignedCount: result.assignedCount,
            unassignedCount: result.unassignedCount,
            policyBlockedCount: result.policyBlockedCount,
            hardViolationCount: validationResult.violations.filter((v) => v.severity === 'HARD').length,
            violationCounts: validationResult.counts.byCode,
        };
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        // Finalize as COMPLETED with draft entries
        const completed = await prisma.generationRun.update({
            where: { id: run.id },
            data: {
                status: 'COMPLETED',
                finishedAt,
                durationMs,
                summary: summary,
                violations: validationResult.violations,
                draftEntries: result.entries,
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
        return completed;
    }
    catch (error) {
        // Finalize as FAILED
        const finishedAt = new Date();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const errorMessage = error instanceof Error ? error.message : String(error);
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
                metadata: { durationMs, error: errorMessage },
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
    const run = await prisma.generationRun.findFirst({
        where: { schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
    });
    if (!run)
        throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');
    return run;
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
    const run = await prisma.generationRun.findFirst({
        where: { schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, violations: true, summary: true },
    });
    if (!run)
        throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');
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
        select: { id: true, status: true, draftEntries: true, summary: true, finishedAt: true, createdAt: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return {
        runId: run.id,
        status: run.status,
        entries: (run.draftEntries ?? []),
        summary: (run.summary ?? null),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
export async function getLatestRunDraft(schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, draftEntries: true, summary: true, finishedAt: true, createdAt: true },
    });
    if (!run)
        throw err(404, 'NO_RUNS', 'No generation runs found for this school/year.');
    return {
        runId: run.id,
        status: run.status,
        entries: (run.draftEntries ?? []),
        summary: (run.summary ?? null),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
//# sourceMappingURL=generation.service.js.map