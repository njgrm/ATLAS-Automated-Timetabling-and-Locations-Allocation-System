/**
 * Manual schedule edit service — preview, commit, revert, and history
 * for manual drag-and-drop adjustments during the Review phase.
 * Business logic only; no transport concerns.
 */
import { prisma } from '../lib/prisma.js';
import { validateHardConstraints, } from './constraint-validator.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy, DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';
// ─── Helpers ───
function err(statusCode, code, message) {
    const e = new Error(message);
    e.statusCode = statusCode;
    e.code = code;
    return e;
}
// ─── Internal: load run + reference data for validation ───
async function loadRunContext(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    if (run.status !== 'COMPLETED')
        throw err(400, 'RUN_NOT_COMPLETED', 'Manual edits can only be applied to COMPLETED runs.');
    assertRunIsEditable(run.summary);
    const entries = (run.draftEntries ?? []);
    const unassignedItems = (run.unassignedItems ?? []);
    const [faculty, facultySubjectRows, rooms, subjects, policyRecord, buildings, facultyNames, roomNames, subjectNames, sectionSnapshot] = await Promise.all([
        prisma.facultyMirror.findMany({
            where: { schoolId, isActiveForScheduling: true },
            select: { id: true, maxHoursPerWeek: true },
        }),
        prisma.facultySubject.findMany({
            where: { schoolId },
            select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
        }),
        prisma.room.findMany({
            where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
            select: { id: true, type: true, isTeachingSpace: true, capacity: true, buildingId: true },
        }),
        prisma.subject.findMany({
            where: { schoolId, isActive: true },
            select: { id: true, minMinutesPerWeek: true, preferredRoomType: true, gradeLevels: true },
        }),
        getOrCreatePolicy(schoolId, schoolYearId),
        prisma.building.findMany({
            where: { schoolId },
            select: { id: true, x: true, y: true },
        }),
        // Name data for human-readable conflict messages
        prisma.facultyMirror.findMany({
            where: { schoolId },
            select: { id: true, firstName: true, lastName: true, maxHoursPerWeek: true },
        }),
        prisma.room.findMany({
            where: { building: { schoolId } },
            select: { id: true, name: true, buildingId: true, type: true, capacity: true, features: true, building: { select: { name: true, shortCode: true } } },
        }),
        prisma.subject.findMany({
            where: { schoolId },
            select: { id: true, code: true, name: true, requiredFeatures: true },
        }),
        prisma.sectionSnapshot.findUnique({
            where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
            select: { payload: true },
        }),
    ]);
    // Build name lookup maps
    const facultyNameMap = new Map(facultyNames.map((f) => [f.id, `${f.lastName}, ${f.firstName}`]));
    const roomNameMap = new Map(roomNames.map((r) => [r.id, `${r.name} · ${r.building.shortCode || r.building.name}`]));
    const subjectNameMap = new Map(subjectNames.map((s) => [s.id, s.code]));
    const snapshotPayload = Array.isArray(sectionSnapshot?.payload)
        ? sectionSnapshot.payload
        : [];
    const rosterIndex = buildSectionRosterIndex(snapshotPayload);
    const facultySubjects = facultySubjectRows.map((assignment) => {
        const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
        return {
            facultyId: assignment.facultyId,
            subjectId: assignment.subjectId,
            gradeLevels: normalized.gradeLevels,
            sectionIds: normalized.sectionIds,
        };
    });
    const sectionEnrollment = new Map(snapshotPayload.flatMap((grade) => grade.sections.map((section) => [section.id, section.enrolledCount])));
    return {
        run,
        entries,
        unassignedItems,
        faculty,
        facultySubjects,
        rooms,
        subjects,
        policyRecord,
        buildings,
        facultyNameMap,
        roomNameMap,
        subjectNameMap,
        sectionEnrollment,
    };
}
function isPublishedSummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary))
        return false;
    const candidate = summary;
    if (candidate.isPublished === true)
        return true;
    if (typeof candidate.publishedAt === 'string' && candidate.publishedAt.length > 0)
        return true;
    return typeof candidate.publishedBy === 'number';
}
function assertRunIsEditable(summary) {
    if (!isPublishedSummary(summary))
        return;
    throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Published repairs require the Prompt 6 revision workflow before changes can take effect.');
}
function buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData) {
    const { faculty, facultySubjects, rooms, subjects, policyRecord, buildings, sectionEnrollment } = refData;
    return {
        schoolId,
        schoolYearId,
        runId,
        entries,
        faculty,
        facultySubjects,
        rooms,
        subjects,
        sectionEnrollment,
        policy: {
            maxConsecutiveTeachingMinutesBeforeBreak: policyRecord.maxConsecutiveTeachingMinutesBeforeBreak,
            minBreakMinutesAfterConsecutiveBlock: policyRecord.minBreakMinutesAfterConsecutiveBlock,
            maxTeachingMinutesPerDay: policyRecord.maxTeachingMinutesPerDay,
            earliestStartTime: policyRecord.earliestStartTime,
            latestEndTime: policyRecord.latestEndTime,
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
}
/** Apply a proposal to a draft entries array, returning the new entries + the before/after entry payloads */
function applyProposal(entries, unassigned, proposal) {
    const newEntries = [...entries];
    let newUnassigned = [...unassigned];
    let beforeEntry = null;
    let afterEntry = null;
    let removedUnassigned = null;
    if (proposal.editType === 'PLACE_UNASSIGNED') {
        // Find matching unassigned item
        const uIdx = newUnassigned.findIndex((u) => u.sectionId === proposal.sectionId &&
            u.subjectId === proposal.subjectId &&
            (proposal.session == null || u.session === proposal.session));
        if (uIdx === -1)
            throw err(400, 'UNASSIGNED_NOT_FOUND', 'Specified unassigned item not found.');
        const uItem = newUnassigned[uIdx];
        removedUnassigned = uItem;
        if (!proposal.targetDay || !proposal.targetStartTime || !proposal.targetEndTime || !proposal.targetRoomId || !proposal.targetFacultyId) {
            throw err(400, 'MISSING_TARGET', 'PLACE_UNASSIGNED requires targetDay, targetStartTime, targetEndTime, targetRoomId, targetFacultyId.');
        }
        const durationMinutes = timeToMinutes(proposal.targetEndTime) - timeToMinutes(proposal.targetStartTime);
        const newEntry = {
            entryId: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            facultyId: proposal.targetFacultyId,
            roomId: proposal.targetRoomId,
            subjectId: uItem.subjectId,
            sectionId: uItem.sectionId,
            day: proposal.targetDay,
            startTime: proposal.targetStartTime,
            endTime: proposal.targetEndTime,
            durationMinutes,
            entryKind: uItem.entryKind,
            programType: uItem.programType ?? null,
            programCode: uItem.programCode ?? null,
            programName: uItem.programName ?? null,
            cohortCode: uItem.cohortCode ?? null,
            cohortName: uItem.cohortName ?? null,
            cohortMemberSectionIds: uItem.cohortMemberSectionIds,
            cohortExpectedEnrollment: uItem.cohortExpectedEnrollment ?? null,
            adviserId: uItem.adviserId ?? null,
            adviserName: uItem.adviserName ?? null,
        };
        afterEntry = newEntry;
        newEntries.push(newEntry);
        newUnassigned = newUnassigned.filter((_, i) => i !== uIdx);
    }
    else if (proposal.editType === 'MOVE_ENTRY' || proposal.editType === 'CHANGE_ROOM' || proposal.editType === 'CHANGE_FACULTY' || proposal.editType === 'CHANGE_TIMESLOT') {
        if (!proposal.entryId)
            throw err(400, 'MISSING_ENTRY_ID', 'entryId is required for move/change edits.');
        const idx = newEntries.findIndex((e) => e.entryId === proposal.entryId);
        if (idx === -1)
            throw err(400, 'ENTRY_NOT_FOUND', `Entry ${proposal.entryId} not found in draft.`);
        beforeEntry = { ...newEntries[idx] };
        const updated = { ...newEntries[idx] };
        if (proposal.targetDay != null)
            updated.day = proposal.targetDay;
        if (proposal.targetStartTime != null)
            updated.startTime = proposal.targetStartTime;
        if (proposal.targetEndTime != null) {
            updated.endTime = proposal.targetEndTime;
            updated.durationMinutes = timeToMinutes(updated.endTime) - timeToMinutes(updated.startTime);
        }
        if (proposal.targetRoomId != null)
            updated.roomId = proposal.targetRoomId;
        if (proposal.targetFacultyId != null)
            updated.facultyId = proposal.targetFacultyId;
        afterEntry = updated;
        newEntries[idx] = updated;
    }
    else {
        throw err(400, 'INVALID_EDIT_TYPE', `Unsupported edit type: ${proposal.editType}`);
    }
    return { newEntries, newUnassigned, beforeEntry, afterEntry, removedUnassigned };
}
function buildBatchPreviewItem(index, proposal, beforeEntry, afterEntry) {
    return {
        index,
        proposal,
        status: 'READY',
        entryId: proposal.entryId ?? afterEntry?.entryId,
        subjectId: afterEntry?.subjectId ?? beforeEntry?.subjectId ?? proposal.subjectId,
        sectionId: afterEntry?.sectionId ?? beforeEntry?.sectionId ?? proposal.sectionId,
        currentFacultyId: beforeEntry?.facultyId ?? null,
        targetFacultyId: afterEntry?.facultyId ?? proposal.targetFacultyId ?? null,
    };
}
function applyProposalBatch(entries, unassigned, proposals) {
    let currentEntries = [...entries];
    let currentUnassigned = [...unassigned];
    const applied = [];
    const items = [];
    proposals.forEach((proposal, index) => {
        try {
            const result = applyProposal(currentEntries, currentUnassigned, proposal);
            currentEntries = result.newEntries;
            currentUnassigned = result.newUnassigned;
            applied.push({
                index,
                proposal,
                beforeEntry: result.beforeEntry,
                afterEntry: result.afterEntry,
                removedUnassigned: result.removedUnassigned,
            });
            items.push(buildBatchPreviewItem(index, proposal, result.beforeEntry, result.afterEntry));
        }
        catch (e) {
            const error = e;
            items.push({
                index,
                proposal,
                status: 'FAILED',
                entryId: proposal.entryId,
                subjectId: proposal.subjectId,
                sectionId: proposal.sectionId,
                targetFacultyId: proposal.targetFacultyId ?? null,
                errorCode: error.code ?? 'BATCH_PROPOSAL_INVALID',
                errorMessage: error.message ?? 'This change could not be prepared.',
            });
        }
    });
    return { newEntries: currentEntries, newUnassigned: currentUnassigned, applied, items };
}
function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function computeSummary(entries, unassigned, validation) {
    const assignedCount = entries.length;
    const unassignedCount = Array.isArray(unassigned) ? unassigned.length : 0;
    const hardViolationCount = validation.violations.filter((v) => v.severity === 'HARD').length;
    return {
        classesProcessed: assignedCount + unassignedCount,
        assignedCount,
        unassignedCount,
        policyBlockedCount: 0,
        hardViolationCount,
        violationCounts: validation.counts.byCode,
    };
}
/**
 * Preserve publication state and display-slot metadata when a manual edit recomputes
 * a run's summary. Manual edits to a published run must not silently unpublish it;
 * unpublish must be an explicit action with its own audit trail.
 */
function mergePreservedSummaryFields(existingSummary, newSummary) {
    const merged = { ...newSummary };
    if (!existingSummary || typeof existingSummary !== 'object' || Array.isArray(existingSummary)) {
        return merged;
    }
    const prev = existingSummary;
    const preserveKeys = [
        'isPublished',
        'publishedAt',
        'publishedBy',
        'publishedSoftViolationCount',
        'softViolationsAcknowledged',
        'publicationIntegrity',
        'timetableDisplaySlots',
        'timetableShapeContracts',
    ];
    for (const key of preserveKeys) {
        if (prev[key] !== undefined) {
            merged[key] = prev[key];
        }
    }
    return merged;
}
// ─── Human-readable conflict builder ───
const VIOLATION_TITLES = {
    FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
    ROOM_TIME_CONFLICT: 'Room Time Conflict',
    FACULTY_OVERLOAD: 'Faculty Overload',
    ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
    ROOM_FEATURE_MISMATCH: 'Room Feature Mismatch',
    FACULTY_SUBJECT_NOT_QUALIFIED: 'Faculty Not Qualified',
    FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Teaching Limit',
    FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement Violated',
    FACULTY_DAILY_STANDARD_EXCEEDED: 'Daily Load Warning',
    FACULTY_DAILY_MAX_EXCEEDED: 'Daily Max Exceeded',
    FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
    FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Excessive Building Transitions',
    FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient Transition Buffer',
    FACULTY_EXCESSIVE_IDLE_GAP: 'Excessive Idle Gap',
    FACULTY_EARLY_START_PREFERENCE: 'Early Start Preference',
    FACULTY_LATE_END_PREFERENCE: 'Late End Preference',
    FACULTY_INSUFFICIENT_DAILY_VACANT: 'Insufficient Daily Vacant Time',
    SECTION_OVERCOMPRESSED: 'Section Overcompressed',
};
const DAY_LABELS = {
    MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};
function formatTimeAmPm(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}
function buildHumanConflicts(violations, entries, refData) {
    const { facultyNameMap, roomNameMap, subjectNameMap } = refData;
    const entryMap = new Map(entries.map((e) => [e.entryId, e]));
    return violations.map((v) => {
        const title = VIOLATION_TITLES[v.code] ?? v.code;
        let detail = v.message; // fallback
        let delta;
        const fName = v.entities.facultyId ? facultyNameMap.get(v.entities.facultyId) ?? `Faculty #${v.entities.facultyId}` : undefined;
        const rName = v.entities.roomId ? roomNameMap.get(v.entities.roomId) ?? `Room #${v.entities.roomId}` : undefined;
        const dayLabel = v.entities.day ? (DAY_LABELS[v.entities.day] ?? v.entities.day) : undefined;
        const timeRange = v.entities.startTime && v.entities.endTime
            ? `${formatTimeAmPm(v.entities.startTime)}–${formatTimeAmPm(v.entities.endTime)}`
            : undefined;
        // Find conflicting entries for context
        const conflictEntries = (v.entities.entryIds ?? []).map((id) => entryMap.get(id)).filter(Boolean);
        switch (v.code) {
            case 'FACULTY_TIME_CONFLICT': {
                const otherEntries = conflictEntries.filter((e) => e.facultyId === v.entities.facultyId);
                const sectionNames = otherEntries.map((e) => subjectNameMap.get(e.subjectId) ?? `Subject #${e.subjectId}`).join(', ');
                detail = `${fName} is already teaching ${sectionNames}${dayLabel && timeRange ? ` on ${dayLabel} ${timeRange}` : ''}`;
                break;
            }
            case 'ROOM_TIME_CONFLICT': {
                const otherEntries = conflictEntries.filter((e) => e.roomId === v.entities.roomId);
                const classes = otherEntries.map((e) => subjectNameMap.get(e.subjectId) ?? `Subject #${e.subjectId}`).join(', ');
                detail = `${rName} is already occupied by ${classes}${dayLabel && timeRange ? ` on ${dayLabel} ${timeRange}` : ''}`;
                break;
            }
            case 'FACULTY_OVERLOAD': {
                const m = v.meta;
                if (m?.totalMinutes != null && m?.maxMinutes != null) {
                    detail = `${fName} total teaching: ${m.totalMinutes} min/week exceeds max ${m.maxMinutes} min/week`;
                    delta = `Limit: ${m.maxMinutes} min · Observed: ${m.totalMinutes} min · Δ +${Number(m.totalMinutes) - Number(m.maxMinutes)} min`;
                }
                else {
                    detail = `${fName} exceeds weekly teaching hour limit`;
                }
                break;
            }
            case 'ROOM_TYPE_MISMATCH': {
                detail = `${rName} type does not match preferred room type for subject`;
                break;
            }
            case 'ROOM_FEATURE_MISMATCH': {
                const m = v.meta;
                if (Array.isArray(m?.missing) && m.missing.length > 0) {
                    detail = `${rName} lacks required feature(s): ${m.missing.join(', ')}`;
                }
                else {
                    detail = `${rName} does not meet specialized feature requirements for this subject`;
                }
                break;
            }
            case 'FACULTY_SUBJECT_NOT_QUALIFIED': {
                const sName = v.entities.subjectId ? subjectNameMap.get(v.entities.subjectId) ?? `Subject #${v.entities.subjectId}` : 'unknown subject';
                detail = `${fName} is not qualified to teach ${sName}`;
                break;
            }
            case 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED': {
                const m = v.meta;
                if (m?.consecutiveMinutes != null && m?.maxConsecutive != null) {
                    detail = `${fName} teaches ${m.consecutiveMinutes} consecutive minutes${dayLabel ? ` on ${dayLabel}` : ''}`;
                    delta = `Limit: ${m.maxConsecutive} min · Observed: ${m.consecutiveMinutes} min · Δ +${Number(m.consecutiveMinutes) - Number(m.maxConsecutive)} min`;
                }
                else {
                    detail = `${fName} exceeds consecutive teaching limit${dayLabel ? ` on ${dayLabel}` : ''}`;
                }
                break;
            }
            case 'FACULTY_BREAK_REQUIREMENT_VIOLATED': {
                const m = v.meta;
                if (m?.actualGapMinutes != null && m?.requiredBreakMinutes != null) {
                    detail = `${fName} has only ${m.actualGapMinutes} min break${dayLabel ? ` on ${dayLabel}` : ''}, needs ${m.requiredBreakMinutes} min`;
                    delta = `Required: ${m.requiredBreakMinutes} min · Actual: ${m.actualGapMinutes} min · Short by ${Number(m.requiredBreakMinutes) - Number(m.actualGapMinutes)} min`;
                }
                else {
                    detail = `${fName} does not have required break${dayLabel ? ` on ${dayLabel}` : ''}`;
                }
                break;
            }
            case 'FACULTY_DAILY_MAX_EXCEEDED': {
                const m = v.meta;
                if (m?.dailyMinutes != null && m?.maxTeachingMinutesPerDay != null) {
                    detail = `${fName} teaches ${m.dailyMinutes} min${dayLabel ? ` on ${dayLabel}` : ''}, exceeds daily max`;
                    delta = `Limit: ${m.maxTeachingMinutesPerDay} min · Observed: ${m.dailyMinutes} min · Δ +${Number(m.dailyMinutes) - Number(m.maxTeachingMinutesPerDay)} min`;
                }
                else {
                    detail = `${fName} exceeds daily max teaching minutes`;
                }
                break;
            }
            case 'FACULTY_DAILY_STANDARD_EXCEEDED': {
                const m = v.meta;
                if (m?.dailyMinutes != null && m?.standardDailyMinutes != null) {
                    detail = `${fName} teaches ${m.dailyMinutes} min${dayLabel ? ` on ${dayLabel}` : ''}, exceeds the 6 hour daily target`;
                    delta = `Target: ${m.standardDailyMinutes} min · Observed: ${m.dailyMinutes} min · Δ +${Number(m.dailyMinutes) - Number(m.standardDailyMinutes)} min`;
                }
                else {
                    detail = `${fName} exceeds the standard daily teaching target`;
                }
                break;
            }
            case 'FACULTY_EXCESSIVE_TRAVEL_DISTANCE': {
                const m = v.meta;
                if (m?.estimatedDistanceMeters != null) {
                    const limit = m?.configuredThresholds ? m.configuredThresholds.maxWalkingDistanceMetersPerTransition : undefined;
                    detail = `${fName} travels ~${m.estimatedDistanceMeters}m between classes${dayLabel ? ` on ${dayLabel}` : ''}`;
                    if (limit != null)
                        delta = `Limit: ${limit}m · Observed: ~${m.estimatedDistanceMeters}m · Δ +${Number(m.estimatedDistanceMeters) - Number(limit)}m`;
                }
                break;
            }
            case 'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS': {
                const m = v.meta;
                if (m?.buildingTransitions != null) {
                    const limit = m?.configuredThresholds ? m.configuredThresholds.maxBuildingTransitionsPerDay : undefined;
                    detail = `${fName} has ${m.buildingTransitions} building transitions${dayLabel ? ` on ${dayLabel}` : ''}`;
                    if (limit != null)
                        delta = `Limit: ${limit} · Observed: ${m.buildingTransitions} · Δ +${Number(m.buildingTransitions) - Number(limit)}`;
                }
                break;
            }
            case 'FACULTY_INSUFFICIENT_TRANSITION_BUFFER': {
                const m = v.meta;
                if (m?.backToBackTransitions != null) {
                    detail = `${fName} has ${m.backToBackTransitions} back-to-back cross-building transitions${dayLabel ? ` on ${dayLabel}` : ''}`;
                }
                break;
            }
            case 'FACULTY_EXCESSIVE_IDLE_GAP': {
                const m = v.meta;
                if (m?.totalIdleMinutes != null) {
                    const limit = m?.configuredThresholds ? m.configuredThresholds.maxIdleGapMinutesPerDay : undefined;
                    detail = `${fName} has ${m.totalIdleMinutes} min idle gap${dayLabel ? ` on ${dayLabel}` : ''}`;
                    if (limit != null)
                        delta = `Limit: ${limit} min · Observed: ${m.totalIdleMinutes} min · Δ +${Number(m.totalIdleMinutes) - Number(limit)} min`;
                }
                break;
            }
            case 'FACULTY_INSUFFICIENT_DAILY_VACANT': {
                const m = v.meta;
                if (m?.vacantMinutes != null && m?.targetVacantMinutes != null) {
                    detail = `${fName} has ${m.vacantMinutes} min vacant time${dayLabel ? ` on ${dayLabel}` : ''}, target is ${m.targetVacantMinutes} min`;
                    delta = `Target: ${m.targetVacantMinutes} min · Observed: ${m.vacantMinutes} min · Short by ${Number(m.targetVacantMinutes) - Number(m.vacantMinutes)} min`;
                }
                else {
                    detail = `${fName} has insufficient vacant time${dayLabel ? ` on ${dayLabel}` : ''}`;
                }
                break;
            }
            case 'SECTION_OVERCOMPRESSED': {
                const m = v.meta;
                const sectionId = v.entities.sectionId;
                if (m?.vacantPeriods != null && m?.targetVacantPeriods != null) {
                    detail = `Section ${sectionId} has ${m.vacantPeriods} vacant period(s)${dayLabel ? ` on ${dayLabel}` : ''}, target is ${m.targetVacantPeriods}`;
                    delta = `Target: ${m.targetVacantPeriods} period(s) · Observed: ${m.vacantPeriods} period(s)`;
                }
                else if (m?.sectionDailyMinutes != null && m?.maxCompressedMinutes != null) {
                    detail = `Section ${sectionId} has ${m.sectionDailyMinutes} teaching min${dayLabel ? ` on ${dayLabel}` : ''}, exceeds ${m.maxCompressedMinutes} min limit`;
                    delta = `Limit: ${m.maxCompressedMinutes} min · Observed: ${m.sectionDailyMinutes} min · Δ +${Number(m.sectionDailyMinutes) - Number(m.maxCompressedMinutes)} min`;
                }
                else {
                    detail = `Section ${sectionId} schedule is overcompressed${dayLabel ? ` on ${dayLabel}` : ''}`;
                }
                break;
            }
            default:
                break;
        }
        return { code: v.code, severity: v.severity, humanTitle: title, humanDetail: detail, delta };
    });
}
function buildPolicyImpacts(violations, refData) {
    const { facultyNameMap } = refData;
    const impacts = [];
    const seen = new Set();
    for (const v of violations) {
        const m = v.meta;
        if (!m)
            continue;
        const fName = v.entities.facultyId ? facultyNameMap.get(v.entities.facultyId) ?? `Faculty #${v.entities.facultyId}` : 'Unknown';
        const key = `${v.code}-${v.entities.facultyId ?? ''}-${v.entities.day ?? ''}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        let summary = '';
        if (v.code === 'FACULTY_OVERLOAD' && m.totalMinutes != null && m.maxMinutes != null) {
            summary = `${fName}: ${m.totalMinutes} min/wk (max ${m.maxMinutes})`;
        }
        else if (v.code === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED' && m.consecutiveMinutes != null && m.maxConsecutive != null) {
            summary = `${fName}: ${m.consecutiveMinutes} min consecutive (max ${m.maxConsecutive})`;
        }
        else if (v.code === 'FACULTY_DAILY_MAX_EXCEEDED' && m.dailyMinutes != null && m.maxTeachingMinutesPerDay != null) {
            summary = `${fName}: ${m.dailyMinutes} min/day (max ${m.maxTeachingMinutesPerDay})`;
        }
        else if (v.code === 'FACULTY_BREAK_REQUIREMENT_VIOLATED' && m.actualGapMinutes != null && m.requiredBreakMinutes != null) {
            summary = `${fName}: ${m.actualGapMinutes} min break (needs ${m.requiredBreakMinutes})`;
        }
        else if (v.code === 'FACULTY_INSUFFICIENT_DAILY_VACANT' && m.vacantMinutes != null && m.targetVacantMinutes != null) {
            summary = `${fName}: ${m.vacantMinutes} min vacant (target ${m.targetVacantMinutes})`;
        }
        else if (v.code === 'SECTION_OVERCOMPRESSED') {
            if (m.sectionDailyMinutes != null && m.maxCompressedMinutes != null) {
                summary = `Section ${v.entities.sectionId}: ${m.sectionDailyMinutes} min/day (max ${m.maxCompressedMinutes})`;
            }
            else if (m.vacantPeriods != null && m.targetVacantPeriods != null) {
                summary = `Section ${v.entities.sectionId}: ${m.vacantPeriods} vacant period(s) (target ${m.targetVacantPeriods})`;
            }
            else {
                continue;
            }
        }
        else {
            continue; // Only include policy threshold violations
        }
        impacts.push({ code: v.code, label: VIOLATION_TITLES[v.code] ?? v.code, summary, severity: v.severity });
    }
    return impacts;
}
// ─── Preview (no persistence) ───
export async function previewManualEdit(runId, schoolId, schoolYearId, proposal) {
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { entries, unassignedItems } = refData;
    // Validate current state
    const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
    const currentValidation = validateHardConstraints(currentCtx);
    // Apply proposal and validate new state
    const { newEntries, beforeEntry, afterEntry } = applyProposal(entries, unassignedItems, proposal);
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const newHardViolations = newValidation.violations.filter((v) => v.severity === 'HARD');
    const newSoftViolations = newValidation.violations.filter((v) => v.severity === 'SOFT');
    const allNewViolations = [...newHardViolations, ...newSoftViolations];
    const humanConflicts = buildHumanConflicts(allNewViolations, newEntries, refData);
    const policyImpactSummary = buildPolicyImpacts(allNewViolations, refData);
    const affectedEntries = [];
    if (beforeEntry) {
        affectedEntries.push({
            entryId: beforeEntry.entryId, subjectId: beforeEntry.subjectId, sectionId: beforeEntry.sectionId,
            facultyId: beforeEntry.facultyId, roomId: beforeEntry.roomId,
            day: beforeEntry.day, startTime: beforeEntry.startTime, endTime: beforeEntry.endTime, phase: 'before',
            entryKind: beforeEntry.entryKind,
            cohortCode: beforeEntry.cohortCode ?? null,
            cohortName: beforeEntry.cohortName ?? null,
            programType: beforeEntry.programType ?? null,
            programCode: beforeEntry.programCode ?? null,
            programName: beforeEntry.programName ?? null,
        });
    }
    if (afterEntry) {
        affectedEntries.push({
            entryId: afterEntry.entryId, subjectId: afterEntry.subjectId, sectionId: afterEntry.sectionId,
            facultyId: afterEntry.facultyId, roomId: afterEntry.roomId,
            day: afterEntry.day, startTime: afterEntry.startTime, endTime: afterEntry.endTime, phase: 'after',
            entryKind: afterEntry.entryKind,
            cohortCode: afterEntry.cohortCode ?? null,
            cohortName: afterEntry.cohortName ?? null,
            programType: afterEntry.programType ?? null,
            programCode: afterEntry.programCode ?? null,
            programName: afterEntry.programName ?? null,
        });
    }
    return {
        allowed: newHardViolations.length === 0,
        hardViolations: newHardViolations,
        softViolations: newSoftViolations,
        violationDelta: { hardBefore, hardAfter, softBefore, softAfter },
        humanConflicts,
        affectedEntries,
        policyImpactSummary,
    };
}
export async function previewManualEditBatch(runId, schoolId, schoolYearId, proposals) {
    if (!Array.isArray(proposals) || proposals.length === 0) {
        throw err(400, 'EMPTY_BATCH', 'At least one manual edit proposal is required.');
    }
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { entries, unassignedItems } = refData;
    const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
    const currentValidation = validateHardConstraints(currentCtx);
    const { newEntries, items, applied } = applyProposalBatch(entries, unassignedItems, proposals);
    const errorCount = items.filter((item) => item.status === 'FAILED').length;
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const newHardViolations = newValidation.violations.filter((v) => v.severity === 'HARD');
    const newSoftViolations = newValidation.violations.filter((v) => v.severity === 'SOFT');
    const allNewViolations = [...newHardViolations, ...newSoftViolations];
    const affectedEntries = [];
    for (const edit of applied) {
        if (edit.beforeEntry) {
            affectedEntries.push({
                entryId: edit.beforeEntry.entryId, subjectId: edit.beforeEntry.subjectId, sectionId: edit.beforeEntry.sectionId,
                facultyId: edit.beforeEntry.facultyId, roomId: edit.beforeEntry.roomId,
                day: edit.beforeEntry.day, startTime: edit.beforeEntry.startTime, endTime: edit.beforeEntry.endTime, phase: 'before',
                entryKind: edit.beforeEntry.entryKind,
                cohortCode: edit.beforeEntry.cohortCode ?? null,
                cohortName: edit.beforeEntry.cohortName ?? null,
                programType: edit.beforeEntry.programType ?? null,
                programCode: edit.beforeEntry.programCode ?? null,
                programName: edit.beforeEntry.programName ?? null,
            });
        }
        if (edit.afterEntry) {
            affectedEntries.push({
                entryId: edit.afterEntry.entryId, subjectId: edit.afterEntry.subjectId, sectionId: edit.afterEntry.sectionId,
                facultyId: edit.afterEntry.facultyId, roomId: edit.afterEntry.roomId,
                day: edit.afterEntry.day, startTime: edit.afterEntry.startTime, endTime: edit.afterEntry.endTime, phase: 'after',
                entryKind: edit.afterEntry.entryKind,
                cohortCode: edit.afterEntry.cohortCode ?? null,
                cohortName: edit.afterEntry.cohortName ?? null,
                programType: edit.afterEntry.programType ?? null,
                programCode: edit.afterEntry.programCode ?? null,
                programName: edit.afterEntry.programName ?? null,
            });
        }
    }
    return {
        allowed: errorCount === 0 && newHardViolations.length === 0,
        hardViolations: newHardViolations,
        softViolations: newSoftViolations,
        violationDelta: { hardBefore, hardAfter, softBefore, softAfter },
        humanConflicts: buildHumanConflicts(allNewViolations, newEntries, refData),
        affectedEntries,
        policyImpactSummary: buildPolicyImpacts(allNewViolations, refData),
        proposalCount: proposals.length,
        errorCount,
        proposals: items,
    };
}
// ─── Commit (persist) ───
export async function commitManualEdit(runId, schoolId, schoolYearId, actorId, proposal, expectedVersion, allowSoftOverride = false) {
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { run, entries, unassignedItems } = refData;
    // Optimistic concurrency check
    if (run.version !== expectedVersion) {
        throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${run.version}. Please reload and retry.`);
    }
    // Validate current state for delta
    const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
    const currentValidation = validateHardConstraints(currentCtx);
    // Apply proposal
    const { newEntries, newUnassigned, beforeEntry, afterEntry, removedUnassigned } = applyProposal(entries, unassignedItems, proposal);
    // Validate new state
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD');
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT');
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    // Block commit if hard violations exist
    if (hardAfter.length > 0) {
        throw err(422, 'HARD_VIOLATION_BLOCK', `Cannot commit: ${hardAfter.length} hard violation(s). ${hardAfter.map((v) => v.message).join('; ')}`);
    }
    // Block soft-only commit unless client explicitly acknowledges
    if (softAfter.length > 0 && !allowSoftOverride) {
        throw err(422, 'SOFT_OVERRIDE_REQUIRED', `Edit produces ${softAfter.length} soft warning(s). Client must set allowSoftOverride=true to proceed.`);
    }
    const newSummary = computeSummary(newEntries, newUnassigned, newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    // Persist atomically: update run + create edit record
    const [updatedRun, editRecord] = await prisma.$transaction([
        prisma.generationRun.update({
            where: { id: runId, version: expectedVersion },
            data: {
                draftEntries: newEntries,
                unassignedItems: newUnassigned,
                violations: newValidation.violations,
                summary: preservedSummary,
                version: newVersion,
            },
        }),
        prisma.manualScheduleEdit.create({
            data: {
                runId,
                schoolId,
                schoolYearId,
                actorId,
                editType: proposal.editType,
                beforePayload: (beforeEntry ?? {}),
                afterPayload: (afterEntry ?? {}),
                validationSummary: {
                    hardCount: hardAfter.length,
                    softCount: softAfter.length,
                    delta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
                    removedUnassignedItem: removedUnassigned ? { ...removedUnassigned } : null,
                },
            },
        }),
    ]);
    // Audit log
    await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'MANUAL_SCHEDULE_EDIT',
            actorId,
            targetIds: [runId],
            metadata: {
                editId: editRecord.id,
                editType: proposal.editType,
                entryId: proposal.entryId ?? afterEntry?.entryId,
            },
        },
    });
    const draftReport = {
        runId: updatedRun.id,
        status: updatedRun.status,
        entries: newEntries,
        unassignedItems: newUnassigned,
        summary: newSummary,
        finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
        createdAt: updatedRun.createdAt.toISOString(),
        version: updatedRun.version,
    };
    return {
        editId: editRecord.id,
        draft: draftReport,
        violationDelta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
        warnings: softAfter,
        newVersion,
    };
}
export async function commitManualEditBatch(runId, schoolId, schoolYearId, actorId, proposals, expectedVersion, allowSoftOverride = false) {
    if (!Array.isArray(proposals) || proposals.length === 0) {
        throw err(400, 'EMPTY_BATCH', 'At least one manual edit proposal is required.');
    }
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { run, entries, unassignedItems } = refData;
    if (run.version !== expectedVersion) {
        throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${run.version}. Please reload and retry.`);
    }
    const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
    const currentValidation = validateHardConstraints(currentCtx);
    const { newEntries, newUnassigned, applied, items } = applyProposalBatch(entries, unassignedItems, proposals);
    const failedItems = items.filter((item) => item.status === 'FAILED');
    if (failedItems.length > 0) {
        throw err(400, 'BATCH_PROPOSAL_INVALID', `Cannot commit: ${failedItems.length} proposed change(s) could not be prepared.`);
    }
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD');
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT');
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    if (hardAfter.length > 0) {
        throw err(422, 'HARD_VIOLATION_BLOCK', `Cannot commit: ${hardAfter.length} hard violation(s). ${hardAfter.map((v) => v.message).join('; ')}`);
    }
    if (softAfter.length > 0 && !allowSoftOverride) {
        throw err(422, 'SOFT_OVERRIDE_REQUIRED', `Batch produces ${softAfter.length} soft warning(s). Client must set allowSoftOverride=true to proceed.`);
    }
    const newSummary = computeSummary(newEntries, newUnassigned, newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    const { updatedRun, editRecords } = await prisma.$transaction(async (tx) => {
        const updated = await tx.generationRun.update({
            where: { id: runId, version: expectedVersion },
            data: {
                draftEntries: newEntries,
                unassignedItems: newUnassigned,
                violations: newValidation.violations,
                summary: preservedSummary,
                version: newVersion,
            },
        });
        const created = [];
        for (const edit of applied) {
            created.push(await tx.manualScheduleEdit.create({
                data: {
                    runId,
                    schoolId,
                    schoolYearId,
                    actorId,
                    editType: edit.proposal.editType,
                    beforePayload: (edit.beforeEntry ?? {}),
                    afterPayload: (edit.afterEntry ?? {}),
                    validationSummary: {
                        batchSize: proposals.length,
                        batchIndex: edit.index,
                        hardCount: hardAfter.length,
                        softCount: softAfter.length,
                        delta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
                        removedUnassignedItem: edit.removedUnassigned ? { ...edit.removedUnassigned } : null,
                    },
                },
            }));
        }
        await tx.auditLog.create({
            data: {
                schoolId,
                schoolYearId,
                action: 'MANUAL_SCHEDULE_EDIT_BATCH',
                actorId,
                targetIds: [runId],
                metadata: {
                    editIds: created.map((edit) => edit.id),
                    batchSize: proposals.length,
                    entryIds: proposals.map((proposal) => proposal.entryId).filter(Boolean),
                },
            },
        });
        return { updatedRun: updated, editRecords: created };
    });
    const draftReport = {
        runId: updatedRun.id,
        status: updatedRun.status,
        entries: newEntries,
        unassignedItems: newUnassigned,
        summary: newSummary,
        finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
        createdAt: updatedRun.createdAt.toISOString(),
        version: updatedRun.version,
    };
    return {
        editId: editRecords[0]?.id ?? 0,
        editIds: editRecords.map((edit) => edit.id),
        draft: draftReport,
        violationDelta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter: softAfter.length },
        warnings: softAfter,
        newVersion,
    };
}
// ─── Revert ───
export async function revertLastEdit(runId, schoolId, schoolYearId, actorId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    // Find the last non-REVERT edit for this run
    const lastEdit = await prisma.manualScheduleEdit.findFirst({
        where: { runId, schoolId, schoolYearId, editType: { not: 'REVERT' } },
        orderBy: { createdAt: 'desc' },
    });
    if (!lastEdit)
        throw err(400, 'NOTHING_TO_REVERT', 'No manual edits to revert.');
    const entries = (run.draftEntries ?? []);
    const unassigned = (run.unassignedItems ?? []);
    const beforePayload = lastEdit.beforePayload;
    const afterPayload = lastEdit.afterPayload;
    const validationSummary = (lastEdit.validationSummary ?? {});
    let newEntries = [...entries];
    let newUnassigned = [...unassigned];
    if (lastEdit.editType === 'PLACE_UNASSIGNED') {
        // Remove the placed entry, put item back into unassigned
        if (afterPayload) {
            newEntries = newEntries.filter((e) => e.entryId !== afterPayload.entryId);
            const restoredUnassigned = validationSummary.removedUnassignedItem ?? {
                sectionId: afterPayload.sectionId,
                subjectId: afterPayload.subjectId,
                gradeLevel: 0,
                session: 1,
                reason: 'NO_AVAILABLE_SLOT',
                entryKind: afterPayload.entryKind,
                programType: afterPayload.programType ?? null,
                programCode: afterPayload.programCode ?? null,
                programName: afterPayload.programName ?? null,
                cohortCode: afterPayload.cohortCode ?? null,
                cohortName: afterPayload.cohortName ?? null,
                cohortMemberSectionIds: afterPayload.cohortMemberSectionIds,
                cohortExpectedEnrollment: afterPayload.cohortExpectedEnrollment ?? null,
                adviserId: afterPayload.adviserId ?? null,
                adviserName: afterPayload.adviserName ?? null,
            };
            newUnassigned.push(restoredUnassigned);
        }
    }
    else {
        // Restore before state
        if (beforePayload && afterPayload) {
            const idx = newEntries.findIndex((e) => e.entryId === afterPayload.entryId);
            if (idx !== -1) {
                newEntries[idx] = beforePayload;
            }
        }
    }
    // Re-validate
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const newSummary = computeSummary(newEntries, newUnassigned, newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    const [updatedRun, editRecord] = await prisma.$transaction([
        prisma.generationRun.update({
            where: { id: runId },
            data: {
                draftEntries: newEntries,
                unassignedItems: newUnassigned,
                violations: newValidation.violations,
                summary: preservedSummary,
                version: newVersion,
            },
        }),
        prisma.manualScheduleEdit.create({
            data: {
                runId,
                schoolId,
                schoolYearId,
                actorId,
                editType: 'REVERT',
                beforePayload: (afterPayload ?? {}),
                afterPayload: (beforePayload ?? {}),
                validationSummary: {
                    revertedEditId: lastEdit.id,
                    revertedEditType: lastEdit.editType,
                },
            },
        }),
    ]);
    await prisma.auditLog.create({
        data: {
            schoolId,
            schoolYearId,
            action: 'MANUAL_SCHEDULE_EDIT_REVERT',
            actorId,
            targetIds: [runId],
            metadata: { revertedEditId: lastEdit.id, newEditId: editRecord.id },
        },
    });
    const draftReport = {
        runId: updatedRun.id,
        status: updatedRun.status,
        entries: newEntries,
        unassignedItems: newUnassigned,
        summary: newSummary,
        finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
        createdAt: updatedRun.createdAt.toISOString(),
        version: updatedRun.version,
    };
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;
    return {
        editId: editRecord.id,
        draft: draftReport,
        violationDelta: { hardBefore: 0, hardAfter, softBefore: 0, softAfter },
        warnings: newValidation.violations.filter((v) => v.severity === 'SOFT'),
        newVersion,
    };
}
// ─── Edit History ───
export async function listManualEdits(runId, schoolId, schoolYearId) {
    // Verify run exists in scope
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { id: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    const edits = await prisma.manualScheduleEdit.findMany({
        where: { runId, schoolId, schoolYearId },
        orderBy: { createdAt: 'desc' },
    });
    return edits.map((e) => ({
        id: e.id,
        runId: e.runId,
        actorId: e.actorId,
        editType: e.editType,
        beforePayload: e.beforePayload,
        afterPayload: e.afterPayload,
        validationSummary: e.validationSummary,
        createdAt: e.createdAt.toISOString(),
    }));
}
function applySwapWithTarget(entries, entryA, entryB, targets) {
    const targetForA = targets?.entryATarget ?? {
        day: entryB.day,
        startTime: entryB.startTime,
        endTime: entryB.endTime,
    };
    const targetForB = targets?.entryBTarget ?? {
        day: entryA.day,
        startTime: entryA.startTime,
        endTime: entryA.endTime,
    };
    return entries.map((entry) => {
        if (entry.entryId === entryA.entryId) {
            return {
                ...entry,
                day: targetForA.day,
                startTime: targetForA.startTime,
                endTime: targetForA.endTime,
                durationMinutes: timeToMinutes(targetForA.endTime) - timeToMinutes(targetForA.startTime),
            };
        }
        if (entry.entryId === entryB.entryId) {
            return {
                ...entry,
                day: targetForB.day,
                startTime: targetForB.startTime,
                endTime: targetForB.endTime,
                durationMinutes: timeToMinutes(targetForB.endTime) - timeToMinutes(targetForB.startTime),
            };
        }
        return entry;
    });
}
function applyMoveOnly(entries, entryToMove, target) {
    return entries.map((entry) => {
        if (entry.entryId !== entryToMove.entryId)
            return entry;
        return {
            ...entry,
            day: target.day,
            startTime: target.startTime,
            endTime: target.endTime,
            durationMinutes: timeToMinutes(target.endTime) - timeToMinutes(target.startTime),
        };
    });
}
function buildSwapPreviewFromValidation(currentValidation, nextValidation, nextEntries, refData, entryA, entryB, afterEntryB) {
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const hardViolations = nextValidation.violations.filter((v) => v.severity === 'HARD');
    const softViolations = nextValidation.violations.filter((v) => v.severity === 'SOFT');
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
        humanConflicts: buildHumanConflicts([...hardViolations, ...softViolations], nextEntries, refData),
        affectedEntries: [
            {
                entryId: entryA.entryId,
                subjectId: entryA.subjectId,
                sectionId: entryA.sectionId,
                facultyId: entryA.facultyId,
                roomId: entryA.roomId,
                day: entryA.day,
                startTime: entryA.startTime,
                endTime: entryA.endTime,
                phase: 'before',
                entryKind: entryA.entryKind,
                cohortCode: entryA.cohortCode ?? null,
                cohortName: entryA.cohortName ?? null,
                programType: entryA.programType ?? null,
                programCode: entryA.programCode ?? null,
                programName: entryA.programName ?? null,
            },
            {
                entryId: entryB.entryId,
                subjectId: entryB.subjectId,
                sectionId: entryB.sectionId,
                facultyId: entryB.facultyId,
                roomId: entryB.roomId,
                day: entryB.day,
                startTime: entryB.startTime,
                endTime: entryB.endTime,
                phase: 'before',
                entryKind: entryB.entryKind,
                cohortCode: entryB.cohortCode ?? null,
                cohortName: entryB.cohortName ?? null,
                programType: entryB.programType ?? null,
                programCode: entryB.programCode ?? null,
                programName: entryB.programName ?? null,
            },
            {
                entryId: entryA.entryId,
                subjectId: entryA.subjectId,
                sectionId: entryA.sectionId,
                facultyId: entryA.facultyId,
                roomId: entryA.roomId,
                day: entryB.day,
                startTime: entryB.startTime,
                endTime: entryB.endTime,
                phase: 'after',
                entryKind: entryA.entryKind,
                cohortCode: entryA.cohortCode ?? null,
                cohortName: entryA.cohortName ?? null,
                programType: entryA.programType ?? null,
                programCode: entryA.programCode ?? null,
                programName: entryA.programName ?? null,
            },
            {
                entryId: entryB.entryId,
                subjectId: entryB.subjectId,
                sectionId: entryB.sectionId,
                facultyId: entryB.facultyId,
                roomId: entryB.roomId,
                day: afterEntryB.day,
                startTime: afterEntryB.startTime,
                endTime: afterEntryB.endTime,
                phase: 'after',
                entryKind: entryB.entryKind,
                cohortCode: entryB.cohortCode ?? null,
                cohortName: entryB.cohortName ?? null,
                programType: entryB.programType ?? null,
                programCode: entryB.programCode ?? null,
                programName: entryB.programName ?? null,
            },
        ],
        policyImpactSummary: buildPolicyImpacts([...hardViolations, ...softViolations], refData),
    };
}
function findAutoFixTarget(entries, entryA, entryB, refData, currentValidation, schoolId, schoolYearId, runId) {
    const slotSet = new Set(entries.map((entry) => `${entry.day}|${entry.startTime}|${entry.endTime}`));
    const candidates = Array.from(slotSet)
        .map((value) => {
        const [day, startTime, endTime] = value.split('|');
        return { day, startTime, endTime };
    })
        .filter((slot) => !(slot.day === entryB.day && slot.startTime === entryB.startTime && slot.endTime === entryB.endTime));
    let bestBlocking = null;
    let bestSource = null;
    for (const target of candidates) {
        if ((timeToMinutes(target.endTime) - timeToMinutes(target.startTime)) === entryB.durationMinutes) {
            const blockingEntries = applySwapWithTarget(entries, entryA, entryB, {
                entryATarget: { day: entryB.day, startTime: entryB.startTime, endTime: entryB.endTime },
                entryBTarget: target,
            });
            const blockingValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, blockingEntries, refData));
            const blockingPreview = buildSwapPreviewFromValidation(currentValidation, blockingValidation, blockingEntries, refData, entryA, entryB, target);
            if (blockingPreview.hardViolations.length === 0) {
                const softCount = blockingPreview.softViolations.length;
                if (!bestBlocking || softCount < bestBlocking.softCount) {
                    bestBlocking = { target, preview: blockingPreview, softCount };
                }
            }
        }
        if ((timeToMinutes(target.endTime) - timeToMinutes(target.startTime)) === entryA.durationMinutes) {
            const sourceEntries = applyMoveOnly(entries, entryA, target);
            const sourceValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, sourceEntries, refData));
            const sourcePreview = buildSwapPreviewFromValidation(currentValidation, sourceValidation, sourceEntries, refData, entryA, entryB, {
                day: entryB.day,
                startTime: entryB.startTime,
                endTime: entryB.endTime,
            });
            if (sourcePreview.hardViolations.length === 0) {
                const softCount = sourcePreview.softViolations.length;
                if (!bestSource || softCount < bestSource.softCount) {
                    bestSource = { target, preview: sourcePreview, softCount };
                }
            }
        }
    }
    return {
        blocking: bestBlocking ? { target: bestBlocking.target, preview: bestBlocking.preview } : null,
        source: bestSource ? { target: bestSource.target, preview: bestSource.preview } : null,
    };
}
export async function previewManualSwapEntries(runId, schoolId, schoolYearId, entryIdA, entryIdB) {
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { entries } = refData;
    const entryA = entries.find((entry) => entry.entryId === entryIdA);
    const entryB = entries.find((entry) => entry.entryId === entryIdB);
    if (!entryA)
        throw err(400, 'ENTRY_NOT_FOUND', `Entry ${entryIdA} not found.`);
    if (!entryB)
        throw err(400, 'ENTRY_NOT_FOUND', `Entry ${entryIdB} not found.`);
    const currentValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData));
    const directEntries = applySwapWithTarget(entries, entryA, entryB);
    const directValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, directEntries, refData));
    const directPreview = buildSwapPreviewFromValidation(currentValidation, directValidation, directEntries, refData, entryA, entryB, { day: entryA.day, startTime: entryA.startTime, endTime: entryA.endTime });
    if (directPreview.hardViolations.length === 0) {
        return {
            entryIdA,
            entryIdB,
            direct: directPreview,
            recommendedStrategy: 'DIRECT_SWAP',
            autoFixBlockingTarget: null,
            autoFixBlockingPreview: null,
            autoFixSourceTarget: null,
            autoFixSourcePreview: null,
        };
    }
    const autoFix = findAutoFixTarget(entries, entryA, entryB, refData, currentValidation, schoolId, schoolYearId, runId);
    const blocking = autoFix.blocking;
    const source = autoFix.source;
    const recommendedStrategy = (() => {
        if (blocking && source)
            return blocking.preview.softViolations.length <= source.preview.softViolations.length ? 'AUTO_FIX_MOVE_BLOCKING' : 'AUTO_FIX_MOVE_SOURCE';
        if (blocking)
            return 'AUTO_FIX_MOVE_BLOCKING';
        if (source)
            return 'AUTO_FIX_MOVE_SOURCE';
        return 'BLOCKED';
    })();
    return {
        entryIdA,
        entryIdB,
        direct: directPreview,
        recommendedStrategy,
        autoFixBlockingTarget: blocking?.target ?? null,
        autoFixBlockingPreview: blocking?.preview ?? null,
        autoFixSourceTarget: source?.target ?? null,
        autoFixSourcePreview: source?.preview ?? null,
    };
}
// ─── Swap two entries' timeslot (atomic, no intermediate conflict) ───
export async function swapManualEntries(runId, schoolId, schoolYearId, actorId, entryIdA, entryIdB, expectedVersion, strategy = 'DIRECT_SWAP', autoFixTarget) {
    const refData = await loadRunContext(runId, schoolId, schoolYearId);
    const { run, entries, unassignedItems } = refData;
    if (run.version !== expectedVersion) {
        throw err(409, 'VERSION_CONFLICT', `Run version conflict: expected ${expectedVersion}, actual ${run.version}. Please reload and retry.`);
    }
    const entryA = entries.find((e) => e.entryId === entryIdA);
    const entryB = entries.find((e) => e.entryId === entryIdB);
    if (!entryA)
        throw err(400, 'ENTRY_NOT_FOUND', `Entry ${entryIdA} not found.`);
    if (!entryB)
        throw err(400, 'ENTRY_NOT_FOUND', `Entry ${entryIdB} not found.`);
    let newEntries;
    if (strategy === 'AUTO_FIX_MOVE_SOURCE') {
        if (!autoFixTarget) {
            throw err(400, 'INVALID_BODY', 'autoFixTarget is required when strategy=AUTO_FIX_MOVE_SOURCE.');
        }
        newEntries = applyMoveOnly(entries, entryA, autoFixTarget);
    }
    else {
        const targetForB = strategy === 'AUTO_FIX_MOVE_BLOCKING'
            ? (autoFixTarget ?? null)
            : { day: entryA.day, startTime: entryA.startTime, endTime: entryA.endTime };
        if (strategy === 'AUTO_FIX_MOVE_BLOCKING' && !targetForB) {
            throw err(400, 'INVALID_BODY', 'autoFixTarget is required when strategy=AUTO_FIX_MOVE_BLOCKING.');
        }
        newEntries = applySwapWithTarget(entries, entryA, entryB, {
            entryATarget: { day: entryB.day, startTime: entryB.startTime, endTime: entryB.endTime },
            entryBTarget: targetForB ?? undefined,
        });
    }
    const currentCtx = buildValidatorCtx(schoolId, schoolYearId, runId, entries, refData);
    const currentValidation = validateHardConstraints(currentCtx);
    const newCtx = buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, refData);
    const newValidation = validateHardConstraints(newCtx);
    const hardAfter = newValidation.violations.filter((v) => v.severity === 'HARD');
    if (hardAfter.length > 0) {
        throw err(422, 'HARD_VIOLATION_BLOCK', `Swap creates ${hardAfter.length} hard violation(s): ${hardAfter.map((v) => v.message).join('; ')}`);
    }
    const hardBefore = currentValidation.violations.filter((v) => v.severity === 'HARD').length;
    const softBefore = currentValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const softAfter = newValidation.violations.filter((v) => v.severity === 'SOFT').length;
    const newSummary = computeSummary(newEntries, unassignedItems, newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    const [updatedRun, editRecord] = await prisma.$transaction([
        prisma.generationRun.update({
            where: { id: runId, version: expectedVersion },
            data: {
                draftEntries: newEntries,
                violations: newValidation.violations,
                summary: preservedSummary,
                version: newVersion,
            },
        }),
        prisma.manualScheduleEdit.create({
            data: {
                runId,
                schoolId,
                schoolYearId,
                actorId,
                editType: 'SWAP_ENTRIES',
                beforePayload: {
                    entryIdA,
                    entryIdB,
                    entryA: { day: entryA.day, startTime: entryA.startTime, endTime: entryA.endTime },
                    entryB: { day: entryB.day, startTime: entryB.startTime, endTime: entryB.endTime },
                },
                afterPayload: {
                    strategy,
                    entryIdA,
                    entryIdB,
                    entryA: newEntries.find((entry) => entry.entryId === entryA.entryId)
                        ? {
                            day: newEntries.find((entry) => entry.entryId === entryA.entryId).day,
                            startTime: newEntries.find((entry) => entry.entryId === entryA.entryId).startTime,
                            endTime: newEntries.find((entry) => entry.entryId === entryA.entryId).endTime,
                        }
                        : null,
                    entryB: newEntries.find((entry) => entry.entryId === entryB.entryId)
                        ? {
                            day: newEntries.find((entry) => entry.entryId === entryB.entryId).day,
                            startTime: newEntries.find((entry) => entry.entryId === entryB.entryId).startTime,
                            endTime: newEntries.find((entry) => entry.entryId === entryB.entryId).endTime,
                        }
                        : null,
                },
                validationSummary: { hardCount: hardAfter.length, softCount: softAfter, delta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter } },
            },
        }),
    ]);
    const draftReport = {
        runId: updatedRun.id,
        status: updatedRun.status,
        entries: newEntries,
        unassignedItems: unassignedItems,
        summary: newSummary,
        finishedAt: updatedRun.finishedAt?.toISOString() ?? null,
        createdAt: updatedRun.createdAt.toISOString(),
        version: updatedRun.version,
    };
    return {
        editId: editRecord.id,
        draft: draftReport,
        violationDelta: { hardBefore, hardAfter: hardAfter.length, softBefore, softAfter },
        warnings: newValidation.violations.filter((v) => v.severity === 'SOFT'),
        newVersion,
    };
}
// ─── Get run version (for frontend optimistic locking) ───
export async function getRunVersion(runId, schoolId, schoolYearId) {
    const run = await prisma.generationRun.findFirst({
        where: { id: runId, schoolId, schoolYearId },
        select: { version: true },
    });
    if (!run)
        throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
    return run.version;
}
//# sourceMappingURL=manual-edit.service.js.map