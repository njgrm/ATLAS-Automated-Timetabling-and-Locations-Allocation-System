import { prisma } from '../lib/prisma.js';
import { buildHumanConflicts, buildPolicyImpacts, buildValidatorCtx, computeSummary, isPublishedSummary, applyProposalBatch, loadRunContext, mergePreservedSummaryFields, } from './manual-edit.service.js';
import { validateHardConstraints } from './constraint-validator.js';
import { buildSectionRosterIndex, deriveGradeLevelsFromSectionIds } from './faculty-assignment-scope.service.js';
import { resolveAssignmentSpecializationIdentity } from './faculty-assignment.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { computeGenerationInputSnapshot } from './generation-input-snapshot.service.js';
function introducedViolations(before, after) {
    const baselineCounts = new Map();
    for (const violation of before) {
        const identity = violationIdentity(violation);
        baselineCounts.set(identity, (baselineCounts.get(identity) ?? 0) + 1);
    }
    return after.filter((violation) => {
        const identity = violationIdentity(violation);
        const remaining = baselineCounts.get(identity) ?? 0;
        if (remaining === 0)
            return true;
        baselineCounts.set(identity, remaining - 1);
        return false;
    });
}
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
function buildUnassignedKey(item) {
    return [
        item.cohortCode ?? item.sectionId,
        item.subjectId,
        item.session,
        item.entryKind ?? 'SECTION',
    ].join(':');
}
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}
function minutesBetween(start, end) {
    return timeToMinutes(end) - timeToMinutes(start);
}
function violationIdentity(violation) {
    const entities = violation.entities ?? {};
    return JSON.stringify({
        code: violation.code,
        facultyId: entities.facultyId ?? null,
        roomId: entities.roomId ?? null,
        sectionId: entities.sectionId ?? null,
        subjectId: entities.subjectId ?? null,
        day: entities.day ?? null,
        startTime: entities.startTime ?? null,
        endTime: entities.endTime ?? null,
        entryIds: [...(entities.entryIds ?? [])].sort(),
    });
}
function findSuggestedPlacements(change, refData, projectedEntries, activeTimeSlots, schoolId, schoolYearId, runId) {
    const item = change.sourceUnassignedItem;
    if (!item)
        return { canPlaceNow: false, suggestedPlacements: [], blocker: 'Unassigned session info missing.' };
    const baselineHardViolations = new Set(validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, projectedEntries, refData))
        .violations
        .filter((violation) => violation.severity === 'HARD')
        .map(violationIdentity));
    const facultyId = change.toFacultyId;
    const subjectDetails = refData.subjects.find(s => s.id === item.subjectId);
    const preferredRoomType = subjectDetails?.preferredRoomType || 'CLASSROOM';
    const homeRoomId = item.homeRoomId || null;
    const candidateRooms = [...refData.rooms].sort((a, b) => {
        const aHome = a.id === homeRoomId;
        const bHome = b.id === homeRoomId;
        if (aHome !== bHome)
            return aHome ? -1 : 1;
        const aType = a.type === preferredRoomType;
        const bType = b.type === preferredRoomType;
        if (aType !== bType)
            return aType ? -1 : 1;
        return a.id - b.id;
    });
    const validSlots = [];
    const roomsToSearch = candidateRooms.filter(r => r.id === homeRoomId || r.type === preferredRoomType).slice(0, 10);
    if (roomsToSearch.length === 0) {
        roomsToSearch.push(...candidateRooms.slice(0, 3));
    }
    for (const day of DAYS) {
        if (validSlots.length >= 3)
            break;
        for (const slot of activeTimeSlots) {
            if (validSlots.length >= 3)
                break;
            const isSectionBusy = projectedEntries.some(e => e.sectionId === item.sectionId && e.day === day && e.startTime === slot.startTime);
            if (isSectionBusy)
                continue;
            const isTeacherBusy = projectedEntries.some(e => e.facultyId === facultyId && e.day === day && e.startTime === slot.startTime);
            if (isTeacherBusy)
                continue;
            for (const room of roomsToSearch) {
                if (validSlots.length >= 3)
                    break;
                const isRoomBusy = projectedEntries.some(e => e.roomId === room.id && e.day === day && e.startTime === slot.startTime);
                if (isRoomBusy)
                    continue;
                const tempEntry = {
                    entryId: `temp-qp-check`,
                    facultyId,
                    roomId: room.id,
                    subjectId: item.subjectId,
                    sectionId: item.sectionId,
                    day,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    durationMinutes: minutesBetween(slot.startTime, slot.endTime),
                    entryKind: item.entryKind || 'SECTION',
                    programType: item.programType,
                    programCode: item.programCode,
                    programName: item.programName,
                    cohortCode: item.cohortCode,
                    cohortName: item.cohortName,
                    cohortMemberSectionIds: item.cohortMemberSectionIds,
                    cohortExpectedEnrollment: item.cohortExpectedEnrollment,
                    adviserId: item.adviserId,
                    adviserName: item.adviserName,
                    metadata: {
                        deferredRoomTypePreference: room.type !== preferredRoomType,
                    },
                };
                const testEntries = [...projectedEntries, tempEntry];
                const validatorCtx = buildValidatorCtx(schoolId, schoolYearId, runId, testEntries, refData);
                const validation = validateHardConstraints(validatorCtx);
                const hardViolations = validation.violations.filter((violation) => violation.severity === 'HARD' && !baselineHardViolations.has(violationIdentity(violation)));
                if (hardViolations.length === 0) {
                    const softCount = validation.violations.filter(v => v.severity === 'SOFT').length;
                    let score = 100 - softCount;
                    if (room.id === homeRoomId) {
                        score += 20;
                    }
                    validSlots.push({
                        day,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        roomId: room.id,
                        score,
                    });
                }
            }
        }
    }
    if (validSlots.length === 0) {
        return {
            canPlaceNow: false,
            suggestedPlacements: [],
            blocker: 'No conflict-free slots found for the proposed teacher in available rooms.',
        };
    }
    validSlots.sort((a, b) => b.score - a.score);
    const top3 = validSlots.slice(0, 3);
    const suggestedPlacements = top3.map((s) => ({
        editType: 'PLACE_UNASSIGNED',
        sectionId: item.sectionId,
        subjectId: item.subjectId,
        session: item.session,
        targetDay: s.day,
        targetStartTime: s.startTime,
        targetEndTime: s.endTime,
        targetRoomId: s.roomId,
        targetFacultyId: facultyId,
        unassignedKey: change.unassignedKey,
        entryKind: change.entryKind,
        cohortCode: change.cohortCode ?? null,
    }));
    return {
        canPlaceNow: true,
        suggestedPlacements,
        blocker: null,
    };
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
        const fromFacultyId = candidate.fromFacultyId == null ? null : positiveInt(candidate.fromFacultyId);
        if (candidate.fromFacultyId != null && !fromFacultyId) {
            throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} has an invalid fromFacultyId.`);
        }
        if (candidate.kind === 'UNASSIGNED') {
            const session = positiveInt(candidate.session);
            const entryKind = candidate.entryKind === 'COHORT' ? 'COHORT' : 'SECTION';
            if (!candidate.unassignedKey || typeof candidate.unassignedKey !== 'string' || !subjectId || !sectionId || !session || !toFacultyId) {
                throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} must include unassignedKey, subjectId, sectionId, session, and toFacultyId.`);
            }
            return {
                kind: 'UNASSIGNED',
                unassignedKey: candidate.unassignedKey,
                subjectId,
                sectionId,
                session,
                entryKind,
                cohortCode: typeof candidate.cohortCode === 'string' ? candidate.cohortCode : null,
                fromFacultyId,
                toFacultyId,
            };
        }
        if (!('entryId' in candidate) || !candidate.entryId || typeof candidate.entryId !== 'string' || !subjectId || !sectionId || !toFacultyId) {
            throw err(400, 'INVALID_REPAIR_CHANGE', `Repair ${index + 1} must include entryId, subjectId, sectionId, and toFacultyId.`);
        }
        return {
            kind: 'ENTRY',
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
                for (const sectionId of change.ownershipSectionIds)
                    row.sectionIds.delete(sectionId);
            }
        }
        const key = `${change.toFacultyId}:${change.subjectId}`;
        const target = rows.get(key) ?? {
            facultyId: change.toFacultyId,
            subjectId: change.subjectId,
            gradeLevels: [],
            sectionIds: new Set(),
        };
        for (const sectionId of change.ownershipSectionIds)
            target.sectionIds.add(sectionId);
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
async function validateExpectedFacultyVersions(schoolId, facultyIds, expectedFacultyVersions, options = {}, client = prisma) {
    const uniqueFacultyIds = [...new Set(facultyIds)];
    const targetFacultyIds = options.targetFacultyIds ?? new Set(uniqueFacultyIds);
    const rows = uniqueFacultyIds.length === 0
        ? []
        : await client.facultyMirror.findMany({
            where: { schoolId, id: { in: uniqueFacultyIds } },
            select: { id: true, version: true, isActiveForScheduling: true },
        });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const facultyId of uniqueFacultyIds) {
        const row = byId.get(facultyId);
        if (!row) {
            throw err(404, 'FACULTY_NOT_FOUND', `Faculty #${facultyId} was not found in this school.`);
        }
        if (targetFacultyIds.has(facultyId) && !row.isActiveForScheduling) {
            throw err(409, 'FACULTY_INACTIVE', 'The replacement teacher is no longer active for scheduling. Choose another active teacher.');
        }
        const expected = expectedFacultyVersions?.[String(facultyId)];
        if (typeof expected === 'number' && expected !== row.version) {
            throw err(409, 'FACULTY_VERSION_CONFLICT', 'Teaching Load changed while this panel was open. Reload the timetable and try again.');
        }
    }
    return new Map(rows.map((row) => [row.id, row.version]));
}
function bindPlacementToUnassignedChange(proposal, changes) {
    if (proposal.editType !== 'PLACE_UNASSIGNED') {
        throw err(400, 'INVALID_PLACEMENT_PROPOSAL', 'Teaching Load repair placementProposal must place an unassigned session.');
    }
    const matches = changes.filter((change) => change.kind === 'UNASSIGNED'
        && change.subjectId === proposal.subjectId
        && change.sectionId === proposal.sectionId
        && change.session === proposal.session
        && change.toFacultyId === proposal.targetFacultyId
        && (proposal.unassignedKey == null || proposal.unassignedKey === change.unassignedKey)
        && (proposal.entryKind == null || proposal.entryKind === change.entryKind)
        && (proposal.cohortCode === undefined || proposal.cohortCode === (change.cohortCode ?? null)));
    if (matches.length !== 1) {
        throw err(409, 'PLACEMENT_REPAIR_SCOPE_MISMATCH', 'The selected placement no longer matches this Teaching Load repair. Refresh and choose the session again.');
    }
    const match = matches[0];
    return {
        ...proposal,
        unassignedKey: match.unassignedKey,
        entryKind: match.entryKind,
        cohortCode: match.cohortCode ?? null,
    };
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
    const unassignedByKey = new Map(refData.unassignedItems.map((item) => [buildUnassignedKey(item), item]));
    const subjectIds = [...new Set(changes.map((change) => change.subjectId))];
    const facultyIds = changes.flatMap((change) => [change.fromFacultyId, change.toFacultyId]).filter((id) => id != null);
    const targetFacultyIds = new Set(changes.map((change) => change.toFacultyId).filter((id) => id != null));
    const [subjects, facultyVersions] = await Promise.all([
        prisma.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true, code: true },
        }),
        validateExpectedFacultyVersions(schoolId, facultyIds, request.expectedFacultyVersions, { targetFacultyIds }),
    ]);
    const subjectCodeById = new Map(subjects.map((subject) => [subject.id, subject.code]));
    const normalizedChanges = [];
    const seenScopes = new Set();
    const seenEntries = new Set();
    for (const [index, rawChange] of changes.entries()) {
        const change = rawChange.kind === 'UNASSIGNED'
            ? rawChange
            : { ...rawChange, kind: 'ENTRY' };
        if ((subjectCodeById.get(change.subjectId) ?? '').toUpperCase() === HG_SUBJECT_CODE) {
            throw err(409, 'HG_ADVISORY_IMMUTABLE', 'Homeroom Guidance ownership follows adviser records and cannot be changed from the timetable.');
        }
        if (change.kind === 'ENTRY') {
            if (seenEntries.has(change.entryId))
                throw err(400, 'DUPLICATE_REPAIR_ENTRY', `Entry ${change.entryId} appears more than once.`);
            seenEntries.add(change.entryId);
            const scopeKey = `${change.subjectId}:${change.sectionId}:ENTRY`;
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
            if (entry.entryKind === 'COHORT') {
                throw err(409, 'COHORT_REPAIR_UNSUPPORTED', 'Cohort classes need a section coverage repair before Teaching Load can be changed from the timetable.');
            }
            normalizedChanges.push({ ...change, kind: 'ENTRY', ownershipSectionIds: [change.sectionId] });
            continue;
        }
        const item = unassignedByKey.get(change.unassignedKey);
        if (!item) {
            throw err(400, 'UNASSIGNED_NOT_FOUND', `Unassigned session ${change.unassignedKey} was not found in this generation run.`);
        }
        if (item.subjectId !== change.subjectId || item.sectionId !== change.sectionId || item.session !== change.session) {
            throw err(409, 'UNASSIGNED_CONTEXT_CHANGED', 'The unassigned session changed while the Teaching Load panel was open. Refresh and try again.');
        }
        if ((item.entryKind ?? 'SECTION') !== change.entryKind || (item.cohortCode ?? null) !== (change.cohortCode ?? null)) {
            throw err(409, 'UNASSIGNED_CONTEXT_CHANGED', 'The unassigned session scope changed while the Teaching Load panel was open. Refresh and try again.');
        }
        const ownershipSectionIds = change.entryKind === 'COHORT'
            ? [...new Set(item.cohortMemberSectionIds?.length ? item.cohortMemberSectionIds : [change.sectionId])]
            : [change.sectionId];
        const scopeKey = `${change.subjectId}:${ownershipSectionIds.join(',')}:${change.unassignedKey}`;
        if (seenScopes.has(scopeKey))
            throw err(400, 'DUPLICATE_REPAIR_SCOPE', `Unassigned session ${index + 1} appears more than once.`);
        seenScopes.add(scopeKey);
        normalizedChanges.push({ ...change, ownershipSectionIds, sourceUnassignedItem: item });
    }
    const ownershipFilters = normalizedChanges.flatMap((change) => change.ownershipSectionIds.map((sectionId) => ({ subjectId: change.subjectId, sectionId })));
    const owners = ownershipFilters.length === 0
        ? []
        : await prisma.subjectSectionOwnership.findMany({
            where: { schoolId, OR: ownershipFilters },
            select: { facultyId: true, subjectId: true, sectionId: true },
        });
    const ownerByPair = new Map(owners.map((owner) => [`${owner.subjectId}:${owner.sectionId}`, owner.facultyId]));
    const newEntries = entries.map((entry) => ({ ...entry }));
    let newUnassignedItems = [...refData.unassignedItems];
    const proposals = [];
    const ownershipDeltas = [];
    const affectedFacultyIds = new Set();
    for (const change of normalizedChanges) {
        const currentOwnerId = ownerByPair.get(`${change.subjectId}:${change.sectionId}`) ?? null;
        const ownershipSectionSet = new Set(change.ownershipSectionIds);
        const matchingEntryIndexes = newEntries
            .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
            .filter(({ candidate }) => candidate.subjectId === change.subjectId && ownershipSectionSet.has(candidate.sectionId))
            .map(({ candidateIndex }) => candidateIndex);
        if (change.kind === 'ENTRY' && matchingEntryIndexes.length === 0) {
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
            kind: change.kind,
            entryId: change.kind === 'ENTRY' ? change.entryId : undefined,
            unassignedKey: change.kind === 'UNASSIGNED' ? change.unassignedKey : undefined,
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
        facultySubjects: projectFacultySubjects(refData.facultySubjects, normalizedChanges),
    };
    let appliedPlacementEdits = [];
    if (request.placementProposal) {
        const placementProposal = bindPlacementToUnassignedChange(request.placementProposal, normalizedChanges);
        const placementResult = applyProposalBatch(newEntries, newUnassignedItems, [placementProposal]);
        const failedPlacement = placementResult.items.find((item) => item.status === 'FAILED');
        if (failedPlacement) {
            throw err(400, failedPlacement.errorCode ?? 'INVALID_PLACEMENT_PROPOSAL', failedPlacement.errorMessage ?? 'The selected session could not be placed.');
        }
        newEntries.splice(0, newEntries.length, ...placementResult.newEntries);
        newUnassignedItems = placementResult.newUnassigned;
        appliedPlacementEdits = placementResult.applied;
        proposals.push(...placementResult.items);
    }
    const newValidation = validateHardConstraints(buildValidatorCtx(schoolId, schoolYearId, runId, newEntries, projectedRefData));
    const timeSlots = (run.summary?.timetableDisplaySlots || []);
    const activeTimeSlots = timeSlots.filter(s => !s.isSpecialEvent).map(s => ({ startTime: s.startTime, endTime: s.endTime }));
    if (activeTimeSlots.length === 0) {
        const uniqueSlots = new Set();
        for (const e of entries) {
            const key = `${e.startTime}-${e.endTime}`;
            if (!uniqueSlots.has(key)) {
                uniqueSlots.add(key);
                activeTimeSlots.push({ startTime: e.startTime, endTime: e.endTime });
            }
        }
    }
    activeTimeSlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    const beforeHours = teachingHoursByFaculty(entries, affectedFacultyIds);
    const afterHours = teachingHoursByFaculty(newEntries, affectedFacultyIds);
    const affectedTeachers = [...affectedFacultyIds].sort((left, right) => left - right).map((facultyId) => ({
        facultyId,
        beforeTeachingHours: beforeHours.get(facultyId) ?? 0,
        afterTeachingHours: afterHours.get(facultyId) ?? 0,
        version: facultyVersions.get(facultyId) ?? null,
    }));
    const hardViolations = introducedViolations(currentValidation.violations.filter((violation) => violation.severity === 'HARD'), newValidation.violations.filter((violation) => violation.severity === 'HARD'));
    const unassignedReadiness = normalizedChanges
        .filter((change) => change.kind === 'UNASSIGNED')
        .map((change) => {
        const placed = appliedPlacementEdits.some((edit) => edit.proposal.editType === 'PLACE_UNASSIGNED'
            && edit.proposal.sectionId === change.sectionId
            && edit.proposal.subjectId === change.subjectId
            && edit.proposal.session === change.session);
        if (request.placementProposal && placed) {
            const placementBlockers = hardViolations.slice(0, 3).map((violation) => violation.message);
            return {
                unassignedKey: change.unassignedKey,
                subjectId: change.subjectId,
                sectionId: change.sectionId,
                session: change.session,
                currentOwnerId: ownerByPair.get(`${change.subjectId}:${change.sectionId}`) ?? null,
                proposedOwnerId: change.toFacultyId,
                canPlaceNow: placementBlockers.length === 0,
                placementBlockers,
                topBlockerCopy: placementBlockers[0] ?? null,
                suggestedPlacements: [request.placementProposal],
            };
        }
        const searchRes = findSuggestedPlacements(change, projectedRefData, newEntries, activeTimeSlots, schoolId, schoolYearId, runId);
        return {
            unassignedKey: change.unassignedKey,
            subjectId: change.subjectId,
            sectionId: change.sectionId,
            session: change.session,
            currentOwnerId: ownerByPair.get(`${change.subjectId}:${change.sectionId}`) ?? null,
            proposedOwnerId: change.toFacultyId,
            canPlaceNow: searchRes.canPlaceNow,
            placementBlockers: searchRes.blocker ? [searchRes.blocker] : [],
            topBlockerCopy: searchRes.blocker ?? 'Teaching Load can be saved. Choose a slot before this session leaves the unassigned list.',
            suggestedPlacements: searchRes.suggestedPlacements,
        };
    });
    return {
        refData,
        changes: normalizedChanges,
        newEntries,
        newUnassignedItems,
        ownershipDeltas,
        affectedTeachers,
        proposals,
        appliedPlacementEdits,
        unassignedReadiness,
        currentValidation,
        newValidation,
    };
}
function buildPreview(prepared) {
    const { currentValidation, newValidation, newEntries, refData, proposals, ownershipDeltas, affectedTeachers, unassignedReadiness } = prepared;
    const hardBefore = currentValidation.violations.filter((violation) => violation.severity === 'HARD').length;
    const hardViolations = introducedViolations(currentValidation.violations.filter((violation) => violation.severity === 'HARD'), newValidation.violations.filter((violation) => violation.severity === 'HARD'));
    const softBefore = currentValidation.violations.filter((violation) => violation.severity === 'SOFT').length;
    const softViolations = introducedViolations(currentValidation.violations.filter((violation) => violation.severity === 'SOFT'), newValidation.violations.filter((violation) => violation.severity === 'SOFT'));
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
        unassignedReadiness,
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
        for (const sectionId of change.ownershipSectionIds) {
            const existingOwner = await tx.subjectSectionOwnership.findUnique({
                where: {
                    schoolId_subjectId_sectionId: {
                        schoolId,
                        subjectId: change.subjectId,
                        sectionId,
                    },
                },
                select: { facultyId: true },
            });
            if (existingOwner) {
                touchedKeys.set(`${existingOwner.facultyId}:${change.subjectId}`, { facultyId: existingOwner.facultyId, subjectId: change.subjectId });
            }
            await tx.subjectSectionOwnership.upsert({
                where: {
                    schoolId_subjectId_sectionId: {
                        schoolId,
                        subjectId: change.subjectId,
                        sectionId,
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
                    sectionId,
                    specializationCode: specializationIdentity.specializationCode,
                    specializationLabel: specializationIdentity.specializationLabel,
                    assignedAt: new Date(),
                },
            });
        }
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
    const { refData, newEntries, newUnassignedItems } = prepared;
    const { run } = refData;
    if (isPublishedSummary(run.summary)) {
        throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.');
    }
    const expectedVersion = request.expectedRunVersion;
    if (typeof expectedVersion !== 'number') {
        throw err(400, 'INVALID_BODY', 'expectedRunVersion is required when applying a Teaching Load repair.');
    }
    const newSummary = computeSummary(newEntries, newUnassignedItems, prepared.newValidation);
    const preservedSummary = mergePreservedSummaryFields(run.summary, newSummary);
    const newVersion = run.version + 1;
    const { updatedRun, editRecords, finalSummary } = await prisma.$transaction(async (tx) => {
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
        const affectedFacultyIds = prepared.changes
            .flatMap((change) => [change.fromFacultyId, change.toFacultyId])
            .filter((facultyId) => facultyId != null);
        const targetFacultyIds = new Set(prepared.changes.map((change) => change.toFacultyId));
        await validateExpectedFacultyVersions(schoolId, affectedFacultyIds, request.expectedFacultyVersions, { targetFacultyIds }, tx);
        await applyCanonicalOwnership(tx, schoolId, schoolYearId, actorId, prepared.changes);
        const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, tx);
        const transactionSummary = { ...preservedSummary, inputSnapshot };
        const updated = await tx.generationRun.update({
            where: { id: runId, version: expectedVersion },
            data: {
                draftEntries: newEntries,
                unassignedItems: newUnassignedItems,
                violations: prepared.newValidation.violations,
                summary: transactionSummary,
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
        for (const edit of prepared.appliedPlacementEdits) {
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
                        source: 'TEACHING_LOAD_REPAIR_PLACEMENT',
                        subjectId: edit.proposal.subjectId,
                        sectionId: edit.proposal.sectionId,
                        targetFacultyId: edit.proposal.targetFacultyId,
                        targetRoomId: edit.proposal.targetRoomId,
                        hardCount: preview.hardViolations.length,
                        softCount: preview.softViolations.length,
                        delta: preview.violationDelta,
                        removedUnassignedItem: edit.removedUnassigned ? { ...edit.removedUnassigned } : null,
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
                    unassignedChangeCount: prepared.changes.filter((change) => change.kind === 'UNASSIGNED').length,
                    placedUnassignedCount: prepared.appliedPlacementEdits.length,
                    newVersion,
                },
            },
        });
        return { updatedRun: updated, editRecords: created, finalSummary: transactionSummary };
    });
    return {
        editId: editRecords[0]?.id ?? 0,
        editIds: editRecords.map((edit) => edit.id),
        draft: buildDraftReport(updatedRun, newEntries, newUnassignedItems, finalSummary, updatedRun.version),
        violationDelta: preview.violationDelta,
        warnings: preview.softViolations,
        newVersion: updatedRun.version,
        ownershipDeltas: preview.ownershipDeltas,
        affectedTeachers: preview.affectedTeachers,
        unassignedReadiness: preview.unassignedReadiness,
    };
}
//# sourceMappingURL=timetable-teaching-load-repair.service.js.map