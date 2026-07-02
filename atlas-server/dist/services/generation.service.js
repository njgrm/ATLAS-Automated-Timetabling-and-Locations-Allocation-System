const ENABLE_LEGACY_TIME_PREFERENCES = process.env.ATLAS_ENABLE_LEGACY_TIME_PREFERENCES === 'true';
/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { computeDemand, buildTimetableShapeContract, } from './schedule-constructor.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import { getSectionSummary, syncSectionsFromExternal } from './section.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getTemplatePeriodProfiles, ensureDefaultTemplates, ensureTemplatesForProgramTypes } from './class-template.service.js';
import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import { reconcileSubjectContractFromUpstream } from './subject.service.js';
import { ensurePhase3GradeWindows } from './grade-window.service.js';
import { syncCohorts } from './cohort.service.js';
import { repairActiveSubjectCoverageWithPlaceholders, getActiveSubjectCoverageSummary } from './faculty-assignment.service.js';
import { compareCurrentInputsForRun, computeGenerationInputSnapshot, } from './generation-input-snapshot.service.js';
function err(statusCode, code, message, options) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    e.actionHint = options?.actionHint;
    e.details = options?.details;
    return e;
}
function asSummaryRecord(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
        return {};
    }
    return summary;
}
function hasPublishedMarkers(summary) {
    const candidate = asSummaryRecord(summary);
    if (candidate.isPublished === true)
        return true;
    if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0)
        return true;
    return typeof candidate.publishedBy === 'number';
}
function buildUnpublishedSummary(summary, context) {
    const candidate = asSummaryRecord(summary);
    const existingIntegrity = asSummaryRecord(candidate.publicationIntegrity);
    return {
        ...candidate,
        isPublished: false,
        publishedAt: null,
        publishedBy: null,
        publicationIntegrity: {
            ...existingIntegrity,
            reconciledAt: context.reconciledAtIso,
            reason: context.reason,
            previousStatus: context.previousStatus,
        },
    };
}
function countViolationsBySeverity(violations, severity) {
    if (!Array.isArray(violations))
        return 0;
    return violations.reduce((count, violation) => {
        if (typeof violation !== 'object' || violation == null)
            return count;
        return violation.severity === severity ? count + 1 : count;
    }, 0);
}
export async function reconcileInvalidPublishedRunStates(schoolId, options) {
    const reason = options?.reason ?? 'PUBLISHED_STATE_CONTRACT_RECONCILIATION';
    const candidates = await prisma.generationRun.findMany({
        where: {
            schoolId,
            ...(options?.schoolYearId ? { schoolYearId: options.schoolYearId } : {}),
            NOT: { status: 'COMPLETED' },
        },
        select: {
            id: true,
            schoolYearId: true,
            status: true,
            summary: true,
        },
    });
    const invalidPublishedRuns = candidates.filter((run) => hasPublishedMarkers(run.summary));
    if (invalidPublishedRuns.length === 0) {
        return { reconciledCount: 0, reconciledRunIds: [] };
    }
    const reconciledAtIso = new Date().toISOString();
    await prisma.$transaction(async (tx) => {
        for (const run of invalidPublishedRuns) {
            const nextSummary = buildUnpublishedSummary(run.summary, {
                reason,
                previousStatus: run.status,
                reconciledAtIso,
            });
            await tx.generationRun.update({
                where: { id: run.id },
                data: { summary: nextSummary },
            });
            if (typeof options?.actorId === 'number' && Number.isInteger(options.actorId) && options.actorId > 0) {
                await tx.auditLog.create({
                    data: {
                        schoolId,
                        schoolYearId: run.schoolYearId,
                        action: 'GENERATION_RUN_PUBLICATION_RECONCILED',
                        actorId: options.actorId,
                        targetIds: [run.id],
                        metadata: {
                            runId: run.id,
                            reason,
                            reconciledAt: reconciledAtIso,
                            previousStatus: run.status,
                        },
                    },
                });
            }
        }
    });
    return {
        reconciledCount: invalidPublishedRuns.length,
        reconciledRunIds: invalidPublishedRuns.map((run) => run.id),
    };
}
function extractDraftFacultyIds(draftEntries) {
    if (!Array.isArray(draftEntries))
        return [];
    const facultyIds = draftEntries
        .map((entry) => (typeof entry === 'object' && entry && 'facultyId' in entry ? entry.facultyId : undefined))
        .filter((facultyId) => typeof facultyId === 'number' && Number.isInteger(facultyId) && facultyId > 0);
    return [...new Set(facultyIds)];
}
function extractNoQualifiedSubjectIds(unassignedItems) {
    if (!Array.isArray(unassignedItems))
        return [];
    const subjectIds = new Set();
    for (const item of unassignedItems) {
        if (typeof item !== 'object' || item == null)
            continue;
        const row = item;
        if (row.reason !== 'NO_QUALIFIED_FACULTY')
            continue;
        if (typeof row.subjectId !== 'number' || !Number.isInteger(row.subjectId) || row.subjectId <= 0)
            continue;
        subjectIds.add(row.subjectId);
    }
    return [...subjectIds].sort((left, right) => left - right);
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
function normalizeProgramType(programType) {
    return (programType ?? 'REGULAR').toUpperCase();
}
function normalizeGradeLevel(value) {
    if (!Number.isFinite(value))
        return value;
    if (value >= 100) {
        const normalized = value % 100;
        if (normalized >= 1 && normalized <= 12)
            return normalized;
    }
    return value;
}
function buildRunTimetableShapeContracts(input) {
    const templateByProgram = new Map(input.templateProfiles.map((profile) => [normalizeProgramType(profile.programType), profile]));
    const regularTemplate = templateByProgram.get('REGULAR') ?? { programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 10 };
    const policyPeriodLengthMinutes = input.policy && 'periodLengthMinutes' in input.policy
        ? input.policy.periodLengthMinutes
        : undefined;
    const policyPeriodsPerDay = input.policy && 'periodsPerDay' in input.policy
        ? input.policy.periodsPerDay
        : undefined;
    const effectivePeriodLengthMinutes = policyPeriodLengthMinutes && policyPeriodLengthMinutes > 0
        ? policyPeriodLengthMinutes
        : 45;
    const effectivePeriodsPerDay = policyPeriodsPerDay && policyPeriodsPerDay > 0
        ? policyPeriodsPerDay
        : 10;
    const contracts = [];
    for (const grade of input.sectionsByGrade) {
        const normalizedGradeLevel = normalizeGradeLevel(grade.gradeLevelId);
        const programTypes = new Set(['REGULAR']);
        for (const section of grade.sections) {
            programTypes.add(normalizeProgramType(section.programType));
        }
        for (const programType of programTypes) {
            const window = input.gradeWindows.find((row) => normalizeGradeLevel(row.gradeLevel) === normalizedGradeLevel && normalizeProgramType(row.programType) === programType)
                ?? input.gradeWindows.find((row) => normalizeGradeLevel(row.gradeLevel) === normalizedGradeLevel && normalizeProgramType(row.programType) === 'ALL');
            const template = templateByProgram.get(programType) ?? regularTemplate;
            const periodLengthMinutes = effectivePeriodLengthMinutes || template.periodLengthMinutes;
            const periodsPerDay = effectivePeriodsPerDay || template.periodsPerDay;
            contracts.push(buildTimetableShapeContract({
                gradeLevel: normalizedGradeLevel,
                programType,
                startTime: window?.startTime ?? input.policy?.earliestStartTime ?? '07:00',
                endTime: window?.endTime ?? input.policy?.latestEndTime ?? '17:00',
                periodLengthMinutes,
                periodsPerDay,
                basePolicy: input.policy,
            }));
        }
    }
    return contracts;
}
function selectPrimaryTimetableShapeContract(contracts) {
    if (contracts.length === 0)
        return null;
    return contracts.find((contract) => contract.programType === 'REGULAR') ?? contracts[0] ?? null;
}
function buildRoomAssignmentReasonCounts(entries, unassignedItems) {
    const counts = {};
    for (const entry of entries) {
        const reason = entry.metadata?.roomAssignmentReason;
        if (!reason)
            continue;
        counts[reason] = (counts[reason] ?? 0) + 1;
    }
    for (const unassigned of unassignedItems) {
        const reason = (unassigned.roomAssignmentReason ?? 'FALLBACK_UNRESOLVED');
        counts[reason] = (counts[reason] ?? 0) + 1;
    }
    return counts;
}
export function buildHomeRoomStats(entries, unassignedItems) {
    let assigned = 0;
    let unavailable = 0;
    let unresolved = 0;
    for (const entry of entries) {
        const reason = entry.metadata?.roomAssignmentReason;
        if (reason === 'HOME_ROOM_ASSIGNED')
            assigned += 1;
        else if (reason === 'HOME_ROOM_UNAVAILABLE')
            unavailable += 1;
    }
    for (const item of unassignedItems) {
        if (item.homeRoomId != null) {
            unresolved += 1;
        }
    }
    const attempted = assigned + unavailable + unresolved;
    return {
        attempted,
        assigned,
        successRate: attempted > 0 ? Math.round((assigned / attempted) * 10000) / 100 : 0,
    };
}
export function buildHomeRoomFallbackDiagnostics(entries, unassignedItems) {
    const diagnostics = {
        homeRoomOccupied: 0,
        noSameZoneStandardRoom: 0,
        crossBuildingStandardRoomExhausted: 0,
        onlySpecializedRoomsAvailable: 0,
        facultyDailyLimitExceeded: 0,
        facultyConsecutiveLimitExceeded: 0,
        noValidPeriodInPolicyWindow: 0,
    };
    const applyCause = (cause) => {
        if (cause === 'NO_SAME_ZONE_STANDARD_ROOM')
            diagnostics.noSameZoneStandardRoom += 1;
        else if (cause === 'CROSS_BUILDING_STANDARD_ROOM_EXHAUSTED')
            diagnostics.crossBuildingStandardRoomExhausted += 1;
        else if (cause === 'ONLY_SPECIALIZED_ROOMS_AVAILABLE')
            diagnostics.onlySpecializedRoomsAvailable += 1;
        else if (cause === 'FACULTY_DAILY_LIMIT_EXCEEDED')
            diagnostics.facultyDailyLimitExceeded += 1;
        else if (cause === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED')
            diagnostics.facultyConsecutiveLimitExceeded += 1;
        else if (cause === 'NO_VALID_PERIOD_IN_POLICY_WINDOW')
            diagnostics.noValidPeriodInPolicyWindow += 1;
        else
            diagnostics.homeRoomOccupied += 1;
    };
    for (const entry of entries) {
        if (entry.metadata?.roomAssignmentReason !== 'HOME_ROOM_UNAVAILABLE')
            continue;
        applyCause(entry.metadata?.homeRoomFallbackCause);
    }
    for (const item of unassignedItems) {
        if (item.homeRoomId == null)
            continue;
        applyCause(item.homeRoomFallbackCause);
    }
    return diagnostics;
}
function buildZoneDistributionByTerm(entries, roomZoneByRoomId) {
    const termAgg = new Map();
    for (const entry of entries) {
        const termIndex = normalizeTermIndex(entry.termIndex);
        const zone = roomZoneByRoomId.get(entry.roomId) ?? 'UNSPECIFIED';
        const zoneMap = termAgg.get(termIndex) ?? new Map();
        zoneMap.set(zone, (zoneMap.get(zone) ?? 0) + 1);
        termAgg.set(termIndex, zoneMap);
    }
    const terms = [1, 2, 3];
    return terms.map((termIndex) => {
        const zoneMap = termAgg.get(termIndex) ?? new Map();
        const total = [...zoneMap.values()].reduce((sum, count) => sum + count, 0);
        const byZone = {};
        for (const [zone, count] of zoneMap.entries()) {
            byZone[zone] = {
                count,
                percent: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
            };
        }
        return { termIndex, total, byZone };
    });
}
function normalizeTermIndex(value) {
    const parsed = Number(value);
    if (parsed === 2)
        return 2;
    if (parsed === 3)
        return 3;
    return 1;
}
function deriveTermIndexFromMetadata(entry) {
    const firstTermIndex = entry.metadata?.modularAssignments?.[0]?.termIndex;
    if (firstTermIndex === 2 || firstTermIndex === 3)
        return firstTermIndex;
    return 1;
}
function resolveEntryTermIndex(entry) {
    return normalizeTermIndex(entry.termIndex ?? deriveTermIndexFromMetadata(entry));
}
function ensureEntriesHaveTermIndex(entries) {
    for (const entry of entries) {
        entry.termIndex = resolveEntryTermIndex(entry);
    }
    return entries;
}
function buildTermCounts(entries) {
    return entries.reduce((acc, entry) => {
        const termIndex = normalizeTermIndex(entry.termIndex);
        if (termIndex === 2)
            acc.term2 += 1;
        else if (termIndex === 3)
            acc.term3 += 1;
        else
            acc.term1 += 1;
        return acc;
    }, { term1: 0, term2: 0, term3: 0 });
}
export function buildQualifiedCoverageBySubject(demand, facultySubjects) {
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
export function buildSlotSaturation(entries, roomCapacity) {
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
export function buildUnassignedBySubjectGrade(unassignedItems, subjectCodeById) {
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
        const enforceShiftWindows = options?.enforceShiftWindows === true;
        stage = 'pre-generation-drafts';
        const preGenerationDrafts = await preGenerationDraftService.consumeDraftPlacementsForRun(run.id, schoolId, schoolYearId, options?.authToken);
        // ── G.17: Diagnostic output for pre-gen consume phase ──
        console.log(`[generation][run=${run.id}] pre-gen consume: accepted=${preGenerationDrafts.prePlacedCount}, skipped=${preGenerationDrafts.invalidPrePlacedCount}, lockedEntries=${preGenerationDrafts.lockedEntries?.length ?? 0}`);
        if ((preGenerationDrafts.skippedPrePlacedReasons?.length ?? 0) > 0) {
            console.log(`[generation][run=${run.id}] skipped reasons:`, preGenerationDrafts.skippedPrePlacedReasons.slice(0, 10));
        }
        // ── Fetch all input data for construction ──
        stage = 'subject-contract-sync';
        await reconcileSubjectContractFromUpstream(schoolId, schoolYearId, options?.authToken);
        await ensureDefaultTemplates(schoolId);
        await syncSectionsFromExternal(schoolId, schoolYearId, options?.authToken);
        await ensurePhase3GradeWindows(schoolId, schoolYearId);
        const sectionResult = await getSectionSummary(schoolYearId, schoolId, options?.authToken);
        const cohortSyncResult = await syncCohorts(schoolId, schoolYearId, options?.authToken);
        const cohortSyncWarnings = [];
        if (cohortSyncResult.synced) {
            cohortSyncWarnings.push(...(cohortSyncResult.warnings ?? []));
            if (cohortSyncResult.count === 0) {
                cohortSyncWarnings.push('No instructional cohorts are currently active for this run; inter-section breakout lanes will fall back to section-scoped demand where needed.');
            }
        }
        else {
            cohortSyncWarnings.push(`Instructional cohort sync failed for this run: ${cohortSyncResult.error ?? 'unknown error'}. Existing cached cohorts (if any) were used.`);
        }
        stage = 'coverage-repair';
        const latestCompletedRun = await prisma.generationRun.findFirst({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { id: 'desc' },
            select: { id: true, unassignedItems: true },
        });
        const dynamicTleSubjects = await prisma.subject.findMany({
            where: {
                schoolId,
                isActive: true,
                code: { startsWith: 'TLE_SPEC_' },
            },
            select: { code: true },
        });
        const noQualifiedSubjectIds = extractNoQualifiedSubjectIds(latestCompletedRun?.unassignedItems);
        const noQualifiedSubjects = noQualifiedSubjectIds.length > 0
            ? await prisma.subject.findMany({
                where: { schoolId, isActive: true, id: { in: noQualifiedSubjectIds } },
                select: { code: true },
            })
            : [];
        const coverageSummary = await getActiveSubjectCoverageSummary(schoolId, schoolYearId, options?.authToken);
        const uncoveredNoRealFacultyCodes = coverageSummary.rows
            .filter((row) => row.uncoveredSectionCount > 0 && row.ownedByRealFacultyCount === 0 && row.subjectCode !== 'HG')
            .map((row) => row.subjectCode);
        const targetedCoverageSubjectCodes = [
            ...new Set([
                ...dynamicTleSubjects.map((subject) => subject.code),
                ...noQualifiedSubjects.map((subject) => subject.code),
                ...uncoveredNoRealFacultyCodes,
            ]),
        ].filter((subjectCode) => subjectCode !== 'HG');
        if (targetedCoverageSubjectCodes.length > 0) {
            await repairActiveSubjectCoverageWithPlaceholders({
                schoolId,
                schoolYearId,
                assignedBy: actorId,
                apply: true,
                subjectCodes: targetedCoverageSubjectCodes,
                authToken: options?.authToken,
            });
        }
        stage = 'sections-fetch';
        const [faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows] = await Promise.all([
            prisma.facultyMirror.findMany({
                where: { schoolId, isActiveForScheduling: true, isStale: false },
                select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, department: true },
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
                select: { id: true, type: true, isTeachingSpace: true, isSharedFacility: true, capacity: true, buildingId: true, buildingZoneId: true },
            }),
            prisma.subject.findMany({
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
            }),
            prisma.facultyPreference.findMany({
                where: { schoolId, schoolYearId },
                select: {
                    facultyId: true,
                    status: true,
                    timeSlots: ENABLE_LEGACY_TIME_PREFERENCES
                        ? { select: { day: true, startTime: true, endTime: true, preference: true } }
                        : false,
                },
            }),
            getOrCreatePolicy(schoolId, schoolYearId),
            prisma.building.findMany({
                where: { schoolId },
                select: { id: true, name: true, x: true, y: true },
            }),
            enforceShiftWindows
                ? prisma.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } })
                : Promise.resolve([]),
        ]);
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
        const rosterIndex = buildSectionRosterIndex(sectionResult.gradeLevels);
        const activeFacultyIdSet = new Set(faculty.map((member) => member.id));
        const facultySubjects = facultySubjectRows
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
        const timetableShapeContracts = buildRunTimetableShapeContracts({
            sectionsByGrade,
            gradeWindows: gradeWindows.map((gw) => ({
                gradeLevel: gw.gradeLevel,
                programType: gw.programType ?? null,
                startTime: gw.startTime,
                endTime: gw.endTime,
            })),
            templateProfiles,
            policy: {
                periodLengthMinutes: policyRecord.periodLengthMinutes,
                periodsPerDay: policyRecord.periodsPerDay,
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
        });
        const schedulableSubjects = subjects.filter((subject) => subject.code !== 'HG');
        const demand = computeDemand(sectionsByGrade, schedulableSubjects, cohorts, classTemplatePeriods);
        const policyMaxDailyMinutes = policyRecord.maxTeachingMinutesPerDay;
        const constructorInput = {
            schoolId,
            schoolYearId,
            roomingStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
            sectionsByGrade,
            subjects: schedulableSubjects,
            cohorts,
            faculty: faculty.map((member) => ({
                id: member.id,
                maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
                department: member.department,
            })),
            facultySubjects,
            rooms,
            preferences: preferences.map((p) => ({
                facultyId: p.facultyId,
                status: p.status,
                timeSlots: ENABLE_LEGACY_TIME_PREFERENCES && 'timeSlots' in p && Array.isArray(p.timeSlots) ? p.timeSlots.map((ts) => ({
                    day: ts.day,
                    startTime: ts.startTime,
                    endTime: ts.endTime,
                    preference: ts.preference,
                })) : [],
            })),
            policy: {
                periodLengthMinutes: policyRecord.periodLengthMinutes,
                periodsPerDay: policyRecord.periodsPerDay,
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
                programType: gw.programType ?? null,
                startTime: gw.startTime,
                endTime: gw.endTime,
            })),
            buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
            classTemplatePeriods,
            timetableShapes: timetableShapeContracts,
        };
        const result = runHybridScheduler(constructorInput);
        const entriesWithTerms = ensureEntriesHaveTermIndex(result.entries);
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
            entries: entriesWithTerms, faculty: constructorInput.faculty, facultySubjects, rooms, subjects,
            sectionEnrollment: new Map(sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount]))),
            policy: {
                ...constructorInput.policy,
                maxTeachingMinutesPerDay: policyMaxDailyMinutes,
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
        const modularWarnings = result.modularWarnings ?? [];
        const modularWarningViolations = modularWarnings.map((warning) => ({
            code: warning.code,
            severity: 'SOFT',
            message: warning.message,
            schoolId,
            schoolYearId,
            runId: run.id,
            entities: {
                sectionId: warning.sectionId,
                subjectId: warning.subjectId,
            },
            meta: warning.meta,
        }));
        const unassignedViolations = result.unassignedItems.map((item) => {
            const isSpecializedUnavailable = item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE';
            return {
                code: isSpecializedUnavailable ? 'SPECIALIZED_ROOM_UNAVAILABLE' : 'UNASSIGNED_SECTION',
                severity: isSpecializedUnavailable ? 'SOFT' : 'HARD',
                message: isSpecializedUnavailable
                    ? `Section ${item.sectionId} subject ${item.subjectId} could not be assigned to a specialized room in session ${item.session}.`
                    : `Section ${item.sectionId} subject ${item.subjectId} remained unassigned in session ${item.session}.`,
                schoolId,
                schoolYearId,
                runId: run.id,
                entities: {
                    sectionId: item.sectionId,
                    subjectId: item.subjectId,
                },
                meta: {
                    reason: item.reason,
                    roomAssignmentReason: item.roomAssignmentReason,
                    homeRoomFallbackCause: item.homeRoomFallbackCause,
                    session: item.session,
                    gradeLevel: item.gradeLevel,
                },
            };
        });
        const roomZoneByRoomId = new Map(rooms.map((room) => [room.id, room.buildingZoneId ?? 'UNSPECIFIED']));
        const zoneDistributionByTerm = buildZoneDistributionByTerm(entriesWithTerms, roomZoneByRoomId);
        const zoneWarningViolations = zoneDistributionByTerm.flatMap((termZone) => {
            const zoneRows = Object.entries(termZone.byZone);
            if (zoneRows.length === 0 || termZone.total === 0)
                return [];
            const [zone, data] = zoneRows.reduce((max, current) => (current[1].percent > max[1].percent ? current : max));
            if (data.percent <= 50)
                return [];
            return [{
                    code: 'ZONE_IMBALANCE_WARNING',
                    severity: 'SOFT',
                    message: `Term ${termZone.termIndex} zone ${zone} has ${data.percent}% of scheduled entries, exceeding the 50% balancing threshold.`,
                    schoolId,
                    schoolYearId,
                    runId: run.id,
                    entities: {},
                    meta: {
                        termIndex: termZone.termIndex,
                        zone,
                        percent: data.percent,
                        total: termZone.total,
                    },
                }];
        });
        const mergedViolationCounts = { ...validationResult.counts.byCode };
        for (const warning of [...modularWarningViolations, ...unassignedViolations, ...zoneWarningViolations]) {
            mergedViolationCounts[warning.code] = (mergedViolationCounts[warning.code] ?? 0) + 1;
        }
        const mergedValidationResult = {
            violations: [
                ...validationResult.violations,
                ...modularWarningViolations,
                ...unassignedViolations,
                ...zoneWarningViolations,
            ],
            counts: {
                total: validationResult.counts.total + modularWarningViolations.length + unassignedViolations.length + zoneWarningViolations.length,
                byCode: mergedViolationCounts,
            },
        };
        const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
        const resourceDiagnostics = {
            qualifiedFacultyCoverageBySubject: buildQualifiedCoverageBySubject(demand, facultySubjects),
            slotSaturationByInterval: buildSlotSaturation(entriesWithTerms, Math.max(rooms.length, 1)).slice(0, 20),
            unassignedBySubjectGrade: buildUnassignedBySubjectGrade(result.unassignedItems, subjectCodeById).slice(0, 20),
            roomAssignmentReasonCounts: buildRoomAssignmentReasonCounts(entriesWithTerms, result.unassignedItems),
            homeRoomFallbackDiagnostics: buildHomeRoomFallbackDiagnostics(entriesWithTerms, result.unassignedItems),
            zoneDistributionByTerm,
        };
        const termCounts = buildTermCounts(entriesWithTerms);
        const homeRoomStats = buildHomeRoomStats(entriesWithTerms, result.unassignedItems);
        const timetableDisplaySlots = selectPrimaryTimetableShapeContract(timetableShapeContracts)?.displaySlots ?? [];
        const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);
        const summary = {
            classesProcessed: result.classesProcessed,
            assignedCount: result.assignedCount,
            unassignedCount: result.unassignedCount,
            roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
            homeRoomAttemptedCount: homeRoomStats.attempted,
            homeRoomAssignedCount: homeRoomStats.assigned,
            homeRoomSuccessRate: homeRoomStats.successRate,
            policyBlockedCount: result.policyBlockedCount,
            hardViolationCount: mergedValidationResult.violations.filter((v) => v.severity === 'HARD').length,
            prePlacedCount: preGenerationDrafts.prePlacedCount,
            invalidPrePlacedCount: preGenerationDrafts.invalidPrePlacedCount,
            skippedPrePlacedReasons: preGenerationDrafts.skippedPrePlacedReasons.length > 0 ? preGenerationDrafts.skippedPrePlacedReasons : undefined,
            violationCounts: mergedValidationResult.counts.byCode,
            lockWarnings: result.lockWarnings.length > 0 ? result.lockWarnings : undefined,
            modularWarnings: modularWarnings.length > 0 ? modularWarnings.map((warning) => warning.message) : undefined,
            cohortCount: cohorts.length,
            termCounts,
            contractWarnings: [
                ...(sectionResult.contractWarnings ?? []),
                ...cohortSyncWarnings,
            ].length > 0 ? [
                ...(sectionResult.contractWarnings ?? []),
                ...cohortSyncWarnings,
            ] : undefined,
            // H-ALG-5: Hybrid scheduler diagnostics
            hybridEnabled: result.hybridEnabled,
            selectedSeedProfile: result.selectedProfileId,
            seedQuality: result.seedQuality?.length > 0 ? result.seedQuality : undefined,
            repairImpact: result.repairImpact,
            resourceDiagnostics,
            shiftWindowPolicy: enforceShiftWindows ? 'ENFORCED' : 'DISABLED',
            configuredShiftWindowCount: gradeWindows.length,
            timetableShapeContracts,
            timetableDisplaySlots,
            inputSnapshot,
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
                violations: mergedValidationResult.violations,
                draftEntries: entriesWithTerms,
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
                    roomerStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
                    shiftWindowPolicy: enforceShiftWindows ? 'ENFORCED' : 'DISABLED',
                    gradeWindowCount: gradeWindows.length,
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
        // Stale draft also means no valid draft to gate against — allow a fresh generation
        if (code === 'NO_ACTIVE_DRAFT' || code === 'STALE_RUN_DATA')
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
    const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
    return getRunById(runId, schoolId, schoolYearId);
}
async function resolveLatestValidRunId(schoolId, schoolYearId) {
    const [runCandidates, activeFacultyIds] = await Promise.all([
        prisma.generationRun.findMany({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                schoolYearId: true,
                status: true,
                createdAt: true,
                summary: true,
            },
        }),
        getActiveFacultyMirrorIdSet(schoolId),
    ]);
    if (runCandidates.length === 0) {
        throw err(404, 'NO_RUNS', 'No completed generation runs found for this school/year.');
    }
    for (const candidate of runCandidates) {
        const runDraft = await prisma.generationRun.findUnique({
            where: { id: candidate.id },
            select: { id: true, draftEntries: true },
        });
        if (runDraft && getStaleFacultyIdsForRun(runDraft, activeFacultyIds).length === 0) {
            return candidate.id;
        }
    }
    const latestRun = await prisma.generationRun.findUnique({
        where: { id: runCandidates[0].id },
        select: { id: true, draftEntries: true },
    });
    const staleFacultyIds = latestRun ? getStaleFacultyIdsForRun(latestRun, activeFacultyIds) : [];
    throw err(409, 'STALE_RUN_DATA', 'Latest completed timetable run references stale faculty assignments. Generate a fresh run after faculty sync before using room preferences.', {
        actionHint: 'Trigger a new timetable generation run after mirror reseed or faculty sync so draft entries bind to current faculty_mirrors IDs.',
        details: { latestRunId: runCandidates[0].id, staleFacultyIds },
    });
}
export async function assertLatestRunIsCurrent(schoolId, schoolYearId) {
    const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
    return getRunById(runId, schoolId, schoolYearId);
}
export async function listRuns(schoolId, schoolYearId, limit = 20) {
    return prisma.generationRun.findMany({
        where: { schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
export async function publishRun(schoolId, schoolYearId, runId, actorId, options) {
    await reconcileInvalidPublishedRunStates(schoolId, {
        schoolYearId,
        reason: 'PRE_PUBLISH_RECONCILIATION',
        actorId,
    });
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
    const softViolationCount = countViolationsBySeverity(run.violations, 'SOFT');
    const acknowledgeSoftViolations = options?.acknowledgeSoftViolations === true;
    if (softViolationCount > 0 && !acknowledgeSoftViolations) {
        throw err(422, 'PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS', 'Soft warnings require explicit acknowledgment before publish.', {
            details: { runId, softViolationCount },
            actionHint: 'Acknowledge soft warnings in the publish dialog and retry publish.',
        });
    }
    const publishedAtIso = new Date().toISOString();
    const nextSummary = {
        ...summary,
        isPublished: true,
        publishedAt: publishedAtIso,
        publishedBy: actorId,
        publishedSoftViolationCount: softViolationCount,
        softViolationsAcknowledged: softViolationCount > 0 ? acknowledgeSoftViolations : false,
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
            metadata: {
                runId: run.id,
                publishedAt: publishedAtIso,
                hardViolationCount,
                softViolationCount,
                acknowledgeSoftViolations,
            },
        },
    });
    return updated;
}
function filterViolationsByTerm(violations, entries, termIndex) {
    if (termIndex !== 1 && termIndex !== 2 && termIndex !== 3) {
        return violations;
    }
    const entryTermById = new Map(entries.map((entry) => [entry.entryId, resolveEntryTermIndex(entry)]));
    return violations.filter((violation) => {
        const explicit = violation.meta?.termIndex;
        if (typeof explicit === 'number') {
            return explicit === termIndex;
        }
        const entryIds = violation.entities?.entryIds ?? [];
        if (Array.isArray(entryIds) && entryIds.length > 0) {
            return entryIds.some((entryId) => entryTermById.get(entryId) === termIndex);
        }
        return true;
    });
}
export async function getRunViolations(runId, schoolId, schoolYearId, termIndex) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    const entries = ensureEntriesHaveTermIndex((run.draftEntries ?? []));
    const violations = filterViolationsByTerm((run.violations ?? []), entries, termIndex);
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
export async function getLatestRunViolations(schoolId, schoolYearId, termIndex) {
    const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, violations: true, summary: true, draftEntries: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    const entries = ensureEntriesHaveTermIndex((run.draftEntries ?? []));
    const violations = filterViolationsByTerm((run.violations ?? []), entries, termIndex);
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
async function buildDraftReport(run, schoolId, schoolYearId) {
    const inputState = await compareCurrentInputsForRun(run.summary, schoolId, schoolYearId);
    return {
        runId: run.id,
        status: run.status,
        entries: ensureEntriesHaveTermIndex((run.draftEntries ?? [])),
        unassignedItems: (run.unassignedItems ?? []),
        summary: (run.summary ?? null),
        inputState,
        version: run.version,
        finishedAt: run.finishedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
    };
}
export async function getRunDraft(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return buildDraftReport(run, schoolId, schoolYearId);
}
export async function getLatestRunDraft(schoolId, schoolYearId) {
    const runId = await resolveLatestValidRunId(schoolId, schoolYearId);
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true, status: true, draftEntries: true, unassignedItems: true, summary: true, version: true, finishedAt: true, createdAt: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return buildDraftReport(run, schoolId, schoolYearId);
}
export async function invalidateStaleCompletedRuns(schoolId, schoolYearId) {
    const [runs, activeFacultyIds] = await Promise.all([
        prisma.generationRun.findMany({
            where: { schoolId, schoolYearId, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, schoolYearId: true, status: true, draftEntries: true, summary: true },
        }),
        getActiveFacultyMirrorIdSet(schoolId),
    ]);
    const staleRuns = runs.filter((run) => getStaleFacultyIdsForRun(run, activeFacultyIds).length > 0);
    const staleRunIds = staleRuns.map((run) => run.id);
    if (staleRunIds.length === 0) {
        return { invalidatedCount: 0, staleRunIds: [], unpublishedRunIds: [] };
    }
    const reconciledAtIso = new Date().toISOString();
    const unpublishedRunIds = [];
    await prisma.$transaction(async (tx) => {
        for (const run of staleRuns) {
            const wasPublished = hasPublishedMarkers(run.summary);
            const data = {
                status: 'FAILED',
                error: 'INVALIDATED_BY_MIRROR_RESET',
            };
            if (wasPublished) {
                data.summary = buildUnpublishedSummary(run.summary, {
                    reason: 'INVALIDATED_BY_MIRROR_RESET',
                    previousStatus: run.status,
                    reconciledAtIso,
                });
                unpublishedRunIds.push(run.id);
            }
            await tx.generationRun.update({
                where: { id: run.id },
                data,
            });
        }
    });
    return { invalidatedCount: staleRunIds.length, staleRunIds, unpublishedRunIds };
}
//# sourceMappingURL=generation.service.js.map