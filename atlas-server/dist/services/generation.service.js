/**
 * Generation run service — lifecycle management for timetable generation runs.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { computeDemand, buildTimetableShapeContract, } from './schedule-constructor.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import { getSectionSummary } from './section.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
import * as preGenerationDraftService from './pre-generation-draft.service.js';
import { resolveActiveDraftRun } from './active-draft-run-resolver.service.js';
import { getTemplatePeriodProfiles, ensureDefaultTemplates, ensureTemplatesForProgramTypes } from './class-template.service.js';
import { computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import { reconcileSubjectContractFromUpstream } from './subject.service.js';
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
function normalizeProgramType(programType) {
    return (programType ?? 'REGULAR').toUpperCase();
}
function buildRunTimetableShapeContracts(input) {
    const templateByProgram = new Map(input.templateProfiles.map((profile) => [normalizeProgramType(profile.programType), profile]));
    const regularTemplate = templateByProgram.get('REGULAR') ?? { programType: 'REGULAR', periodLengthMinutes: 50, periodsPerDay: 8 };
    const contracts = [];
    for (const grade of input.sectionsByGrade) {
        const programTypes = new Set(['REGULAR']);
        for (const section of grade.sections) {
            programTypes.add(normalizeProgramType(section.programType));
        }
        for (const programType of programTypes) {
            const window = input.gradeWindows.find((row) => row.gradeLevel === grade.gradeLevelId && normalizeProgramType(row.programType) === programType)
                ?? input.gradeWindows.find((row) => row.gradeLevel === grade.gradeLevelId && normalizeProgramType(row.programType) === 'ALL');
            const template = templateByProgram.get(programType) ?? regularTemplate;
            contracts.push(buildTimetableShapeContract({
                gradeLevel: grade.gradeLevelId,
                programType,
                startTime: window?.startTime ?? input.policy?.earliestStartTime ?? '07:00',
                endTime: window?.endTime ?? input.policy?.latestEndTime ?? '17:00',
                periodLengthMinutes: template.periodLengthMinutes,
                periodsPerDay: template.periodsPerDay,
                basePolicy: input.policy,
            }));
        }
    }
    return contracts;
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
function buildHomeRoomStats(entries, unassignedItems) {
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
function buildHomeRoomFallbackDiagnostics(entries, unassignedItems) {
    const diagnostics = {
        homeRoomOccupied: 0,
        noSameZoneStandardRoom: 0,
        onlySpecializedRoomsAvailable: 0,
        policyOrShiftWindowIncompatible: 0,
    };
    const applyCause = (cause) => {
        if (cause === 'NO_SAME_ZONE_STANDARD_ROOM')
            diagnostics.noSameZoneStandardRoom += 1;
        else if (cause === 'ONLY_SPECIALIZED_ROOMS_AVAILABLE')
            diagnostics.onlySpecializedRoomsAvailable += 1;
        else if (cause === 'POLICY_OR_SHIFT_WINDOW_INCOMPATIBLE')
            diagnostics.policyOrShiftWindowIncompatible += 1;
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
function withTermIndex(entries) {
    return entries.map((entry) => ({
        ...entry,
        termIndex: normalizeTermIndex(entry.termIndex ?? deriveTermIndexFromMetadata(entry)),
    }));
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
        stage = 'subject-contract-sync';
        await reconcileSubjectContractFromUpstream(schoolId, schoolYearId, options?.authToken);
        await ensureDefaultTemplates(schoolId);
        stage = 'sections-fetch';
        const [sectionResult, faculty, facultySubjectRows, rooms, subjects, preferences, policyRecord, buildings, gradeWindows, cohorts, specializationAliases] = await Promise.all([
            getSectionSummary(schoolYearId, schoolId, options?.authToken),
            prisma.facultyMirror.findMany({
                where: { schoolId, isActiveForScheduling: true, isStale: false },
                select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, specialization: true, department: true },
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
                    minMinutesPerWeek: true,
                    preferredRoomType: true,
                    sessionPattern: true,
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
                    timeSlots: { select: { day: true, startTime: true, endTime: true, preference: true } },
                },
            }),
            getOrCreatePolicy(schoolId, schoolYearId),
            prisma.building.findMany({
                where: { schoolId },
                select: { id: true, name: true, x: true, y: true },
            }),
            options?.enforceShiftWindows === false
                ? Promise.resolve([])
                : prisma.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } }),
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
        const demand = computeDemand(sectionsByGrade, subjects, cohorts, classTemplatePeriods);
        const policyMaxDailyMinutes = policyRecord.maxTeachingMinutesPerDay;
        const constructorInput = {
            schoolId,
            schoolYearId,
            roomingStrategy: options?.roomerStrategy ?? 'HOME_ROOM_FIRST',
            sectionsByGrade,
            subjects,
            cohorts,
            faculty: faculty.map((member) => ({
                id: member.id,
                maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
                specialization: member.specialization,
                department: member.department,
            })),
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
                programType: gw.programType ?? null,
                startTime: gw.startTime,
                endTime: gw.endTime,
            })),
            buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
            specializationAliases,
            classTemplatePeriods,
            timetableShapes: timetableShapeContracts,
        };
        const result = runHybridScheduler(constructorInput);
        const entriesWithTerms = withTermIndex(result.entries);
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
        const timetableDisplaySlots = timetableShapeContracts
            .flatMap((contract) => contract.displaySlots)
            .filter((slot, index, slots) => {
            const key = `${slot.startTime}-${slot.endTime}-${slot.eventName ?? ''}-${slot.isSpecialEvent ? '1' : '0'}`;
            return slots.findIndex((candidate) => `${candidate.startTime}-${candidate.endTime}-${candidate.eventName ?? ''}-${candidate.isSpecialEvent ? '1' : '0'}` === key) === index;
        })
            .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
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
            cohortizedClassCount: entriesWithTerms.filter((entry) => entry.entryKind === 'COHORT').length,
            termCounts,
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
            shiftWindowPolicy: options?.enforceShiftWindows === false ? 'DISABLED' : 'ENFORCED',
            configuredShiftWindowCount: gradeWindows.length,
            timetableShapeContracts,
            timetableDisplaySlots,
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
                    shiftWindowPolicy: options?.enforceShiftWindows === false ? 'DISABLED' : 'ENFORCED',
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
function filterViolationsByTerm(violations, entries, termIndex) {
    if (termIndex !== 1 && termIndex !== 2 && termIndex !== 3) {
        return violations;
    }
    const entryTermById = new Map(entries.map((entry) => [entry.entryId, entry.termIndex ?? 1]));
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
    const entries = withTermIndex((run.draftEntries ?? []));
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
    const run = await getLatestValidRun(schoolId, schoolYearId);
    const entries = withTermIndex((run.draftEntries ?? []));
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
        entries: withTermIndex((run.draftEntries ?? [])),
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
        entries: withTermIndex((run.draftEntries ?? [])),
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