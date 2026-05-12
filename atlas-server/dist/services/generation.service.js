/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { computeDemand } from './schedule-constructor.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import { getSectionSummary } from './section.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getTemplatePeriodProfiles, ensureTemplatesForProgramTypes } from './class-template.service.js';
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
function buildQualifiedCoverageBySubject(demand, facultySubjects) {
    const qualifiedKey = new Set();
    for (const assignment of facultySubjects) {
        for (const sectionId of assignment.sectionIds) {
            qualifiedKey.add(`${sectionId}:${assignment.subjectId}`);
        }
    }
    const agg = new Map();
    for (const item of demand) {
        const stat = agg.get(item.subjectId) ?? { subjectCode: item.subjectCode, requiredAssignments: 0, qualifiedAssignments: 0 };
        const sectionIds = item.entryKind === 'COHORT' && item.cohortMemberSectionIds?.length ? item.cohortMemberSectionIds : [item.sectionId];
        const qualified = sectionIds.every((sectionId) => qualifiedKey.has(`${sectionId}:${item.subjectId}`));
        stat.requiredAssignments += item.sessionsPerWeek;
        if (qualified)
            stat.qualifiedAssignments += item.sessionsPerWeek;
        agg.set(item.subjectId, stat);
    }
    return [...agg.entries()].map(([subjectId, stat]) => ({
        subjectId,
        subjectCode: stat.subjectCode,
        requiredAssignments: stat.requiredAssignments,
        qualifiedAssignments: stat.qualifiedAssignments,
        coveragePercent: stat.requiredAssignments > 0
            ? Math.round((stat.qualifiedAssignments / stat.requiredAssignments) * 10000) / 100
            : 0,
    })).sort((left, right) => left.coveragePercent - right.coveragePercent || left.subjectCode.localeCompare(right.subjectCode));
}
function buildSlotSaturation(entries, roomCapacity) {
    const slotCounts = new Map();
    for (const entry of entries) {
        const key = `${entry.day}:${entry.startTime}:${entry.endTime}`;
        const slot = slotCounts.get(key) ?? { day: entry.day, startTime: entry.startTime, endTime: entry.endTime, assigned: 0 };
        slot.assigned += 1;
        slotCounts.set(key, slot);
    }
    return [...slotCounts.values()]
        .map((slot) => ({
        ...slot,
        capacity: roomCapacity,
        saturationPercent: roomCapacity > 0 ? Math.round((slot.assigned / roomCapacity) * 10000) / 100 : 0,
    }))
        .sort((left, right) => right.saturationPercent - left.saturationPercent || left.day.localeCompare(right.day) || left.startTime.localeCompare(right.startTime));
}
function buildUnassignedBySubjectGrade(unassignedItems, subjectCodeById) {
    const agg = new Map();
    for (const item of unassignedItems) {
        const key = `${item.subjectId}:${item.gradeLevel}`;
        const row = agg.get(key) ?? {
            subjectId: item.subjectId,
            subjectCode: subjectCodeById.get(item.subjectId) ?? `SUBJECT_${item.subjectId}`,
            gradeLevel: item.gradeLevel,
            count: 0,
            reasons: {},
        };
        row.count += 1;
        row.reasons[item.reason] = (row.reasons[item.reason] ?? 0) + 1;
        agg.set(key, row);
    }
    return [...agg.values()].sort((left, right) => right.count - left.count || left.gradeLevel - right.gradeLevel || left.subjectCode.localeCompare(right.subjectCode));
}
// ─── Trigger ───
export async function triggerGenerationRun(schoolId, schoolYearId, actorId, options) {
    const gateStatus = await getGenerationRoomRequestGateStatus(schoolId, schoolYearId);
    if (gateStatus.blocked && !options?.ignoreRoomRequestGate) {
        throw err(409, 'OPEN_ROOM_REQUESTS_BLOCK_GENERATION', `Generation is blocked until all submitted faculty requests are decided. ${gateStatus.openCount} request(s) remain pending.`, {
            actionHint: 'Resolve all pending requests in the room-request panel, or use Generate Anyway to override this gate for a fresh draft.',
            details: { runId: gateStatus.runId, openRequestCount: gateStatus.openCount },
        });
    }
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
        const preGenerationDrafts = await preGenerationDraftService.consumeDraftPlacementsForRun(run.id, schoolId, schoolYearId, options?.authToken);
        // ── G.17: Diagnostic output for pre-gen consume phase ──
        console.log(`[generation][run=${run.id}] pre-gen consume: accepted=${preGenerationDrafts.prePlacedCount}, skipped=${preGenerationDrafts.invalidPrePlacedCount}, lockedEntries=${preGenerationDrafts.lockedEntries?.length ?? 0}`);
        if ((preGenerationDrafts.skippedPrePlacedReasons?.length ?? 0) > 0) {
            console.log(`[generation][run=${run.id}] skipped reasons:`, preGenerationDrafts.skippedPrePlacedReasons.slice(0, 10));
        }
        // ── Fetch all input data for construction ──
        stage = 'sections-fetch';
        const [sectionResult, faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows, cohorts, specializationAliases] = await Promise.all([
            getSectionSummary(schoolYearId, schoolId, options?.authToken),
            prisma.facultyMirror.findMany({
                where: { schoolId, isActiveForScheduling: true },
                select: { id: true, maxHoursPerWeek: true, specialization: true, department: true },
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
                    name: true,
                    minMinutesPerWeek: true,
                    preferredRoomType: true,
                    sessionPattern: true,
                    gradeLevels: true,
                    interSectionEnabled: true,
                    interSectionGradeLevels: true,
                    programScopes: true,
                    allowedSpecializations: true,
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
                select: { id: true, name: true, x: true, y: true },
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
            prisma.specializationAlias.findMany({
                where: { schoolId },
                select: { canonical: true, alias: true },
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
        // ── Run hybrid multi-seed constructor (H-ALG-1 through H-ALG-3) ──
        stage = 'constructor';
        const sectionsByGrade = sectionResult.gradeLevels;
        // Auto-seed class templates for any program types found in the fetched sections
        // so that schedule generation uses the correct period lengths for special programs.
        const detectedProgramTypes = [
            ...new Set(sectionsByGrade
                .flatMap((g) => g.sections)
                .map((s) => s.programType)
                .filter((pt) => pt != null)),
        ];
        if (detectedProgramTypes.length > 0) {
            await ensureTemplatesForProgramTypes(schoolId, detectedProgramTypes);
        }
        // Build classTemplatePeriods map: programType -> periodLengthMinutes
        const templateProfiles = await getTemplatePeriodProfiles(schoolId);
        const classTemplatePeriods = {};
        for (const tp of templateProfiles) {
            classTemplatePeriods[tp.programType] = tp.periodLengthMinutes;
        }
        const demand = computeDemand(sectionsByGrade, subjects, cohorts, classTemplatePeriods);
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
                enableLunchWindow: policyRecord.enableLunchWindow ?? undefined,
                enforceLunchWindow: policyRecord.enforceLunchWindow ?? undefined,
                showSpecialEventsInGrid: policyRecord.showSpecialEventsInGrid ?? undefined,
                enableFlagCeremony: policyRecord.enableFlagCeremony ?? undefined,
                flagCeremonyStartTime: policyRecord.flagCeremonyStartTime ?? undefined,
                flagCeremonyEndTime: policyRecord.flagCeremonyEndTime ?? undefined,
                enableRecess: policyRecord.enableRecess ?? undefined,
                recessStartTime: policyRecord.recessStartTime ?? undefined,
                recessEndTime: policyRecord.recessEndTime ?? undefined,
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
            buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
            specializationAliases,
            classTemplatePeriods,
        };
        const result = runHybridScheduler(constructorInput);
        // ── G.17: Diagnostic output for constructor result ──
        console.log(`[generation][run=${run.id}] constructor: assigned=${result.assignedCount}, unassigned=${result.unassignedCount}, policyBlocked=${result.policyBlockedCount}, entries=${result.entries.length}, hybrid=${result.hybridEnabled}, selectedProfile=${result.selectedProfileId}`);
        if (result.lockWarnings.length > 0) {
            console.log(`[generation][run=${run.id}] lock warnings:`, result.lockWarnings.slice(0, 5));
        }
        if (result.unassignedItems.length > 0) {
            const reasonCounts = {};
            for (const item of result.unassignedItems) {
                reasonCounts[item.reason] = (reasonCounts[item.reason] ?? 0) + 1;
            }
            console.log(`[generation][run=${run.id}] top unassigned reasons:`, reasonCounts);
        }
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
        const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
        const resourceDiagnostics = {
            qualifiedFacultyCoverageBySubject: buildQualifiedCoverageBySubject(demand, facultySubjects),
            slotSaturationByInterval: buildSlotSaturation(result.entries, Math.max(rooms.length, 1)).slice(0, 20),
            unassignedBySubjectGrade: buildUnassignedBySubjectGrade(result.unassignedItems, subjectCodeById).slice(0, 20),
        };
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
            // H-ALG-5: Hybrid scheduler diagnostics
            hybridEnabled: result.hybridEnabled,
            selectedSeedProfile: result.selectedProfileId,
            seedQuality: result.seedQuality?.length > 0 ? result.seedQuality : undefined,
            repairImpact: result.repairImpact,
            resourceDiagnostics,
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
                metadata: {
                    durationMs,
                    summary,
                    gateOverrideUsed: Boolean(options?.ignoreRoomRequestGate),
                    gateOpenRequestCountAtTrigger: gateStatus.openCount,
                },
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
export async function assertGenerationRoomRequestGate(schoolId, schoolYearId) {
    const status = await getGenerationRoomRequestGateStatus(schoolId, schoolYearId);
    if (!status.blocked)
        return status;
    throw err(409, 'OPEN_ROOM_REQUESTS_BLOCK_GENERATION', `Generation is blocked until all submitted faculty requests are decided. ${status.openCount} request(s) remain pending.`, {
        actionHint: 'Resolve all pending requests in the room-request panel, then retry generation.',
        details: { runId: status.runId, openRequestCount: status.openCount },
    });
}
export async function getGenerationRoomRequestGateStatus(schoolId, schoolYearId) {
    let activeRunId = null;
    try {
        const activeRun = await resolveActiveDraftRun(schoolId, schoolYearId);
        activeRunId = activeRun.id;
    }
    catch (error) {
        const code = error.code;
        if (code === 'NO_ACTIVE_DRAFT')
            return { blocked: false, openCount: 0, runId: null };
        throw error;
    }
    if (!activeRunId)
        return { blocked: false, openCount: 0, runId: null };
    const openCount = await prisma.facultyRoomPreference.count({
        where: {
            schoolId,
            schoolYearId,
            runId: activeRunId,
            status: 'SUBMITTED',
            decisionStatus: 'PENDING',
        },
    });
    return { blocked: openCount > 0, openCount, runId: activeRunId };
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
export async function publishRun(schoolId, schoolYearId, runId, actorId) {
    const run = await getRunById(runId, schoolId, schoolYearId);
    if (run.status !== 'COMPLETED') {
        throw err(422, 'RUN_NOT_COMPLETED', 'Only completed generation runs can be published.');
    }
    const summary = (run.summary ?? {});
    const hardViolationCount = Number(summary.hardViolationCount ?? 0);
    if (hardViolationCount > 0) {
        throw err(422, 'PUBLISH_BLOCKED_HARD_VIOLATIONS', 'Cannot publish while hard violations exist.', {
            details: { runId, hardViolationCount },
            actionHint: 'Resolve hard violations in Review and try publish again.',
        });
    }
    const publishedAtIso = new Date().toISOString();
    const nextSummary = {
        ...summary,
        isPublished: true,
        publishedAt: publishedAtIso,
        publishedBy: actorId,
    };
    const updated = await prisma.generationRun.update({
        where: { id: run.id },
        data: {
            summary: nextSummary,
        },
    });
    await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'GENERATION_RUN_PUBLISHED',
            actorId,
            targetIds: [run.id],
            metadata: { runId: run.id, publishedAt: publishedAtIso },
        },
    });
    return updated;
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