export const STANDARD_WEEKLY_TEACHING_HOURS = 30;
export const MAX_WEEKLY_TEACHING_HOURS = 40;
export const CLASS_ADVISER_EQUIVALENT_HOURS = 5;
function uniqueSortedPositiveInts(values) {
    return Array.from(new Set((values ?? []).filter((value) => Number.isInteger(value) && value > 0))).sort((left, right) => left - right);
}
export function deriveLoadStatus(actualTeachingHours) {
    if (actualTeachingHours > MAX_WEEKLY_TEACHING_HOURS) {
        return { status: 'over-cap', label: 'Over Cap' };
    }
    if (actualTeachingHours >= STANDARD_WEEKLY_TEACHING_HOURS) {
        return {
            status: 'overload-allowed',
            label: actualTeachingHours > STANDARD_WEEKLY_TEACHING_HOURS ? 'Overload Allowed' : 'Compliant',
        };
    }
    return { status: 'below-standard', label: 'Below Standard' };
}
export function buildSectionMap(sections) {
    return new Map(sections.map((section) => [section.id, section]));
}
export function deriveGradeLevelsForSections(sectionIds, sectionMap) {
    return Array.from(new Set(uniqueSortedPositiveInts(sectionIds)
        .map((sectionId) => sectionMap.get(sectionId)?.displayOrder)
        .filter((displayOrder) => typeof displayOrder === 'number' && Number.isInteger(displayOrder) && displayOrder > 0))).sort((left, right) => left - right);
}
export function normalizeDraftAssignments(assignments, sectionMap) {
    return assignments
        .map((assignment) => {
        const sectionIds = uniqueSortedPositiveInts(assignment.sectionIds).filter((sectionId) => sectionMap.has(sectionId));
        return {
            subjectId: assignment.subjectId,
            sectionIds,
            gradeLevels: deriveGradeLevelsForSections(sectionIds, sectionMap),
        };
    })
        .filter((assignment) => assignment.sectionIds.length > 0)
        .sort((left, right) => left.subjectId - right.subjectId);
}
export function buildAssignmentSignature(assignments) {
    return assignments
        .map((assignment) => `${assignment.subjectId}:${uniqueSortedPositiveInts(assignment.sectionIds).join(',')}`)
        .sort()
        .join('|');
}
export function getAssignmentOwnershipKey(subjectId, sectionId) {
    return `${subjectId}:${sectionId}`;
}
export function buildOwnershipMap(assignmentsByFaculty, facultyNames, source) {
    const ownershipMap = {};
    for (const [facultyIdRaw, assignments] of Object.entries(assignmentsByFaculty)) {
        const facultyId = Number(facultyIdRaw);
        const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
        for (const assignment of assignments) {
            for (const sectionId of assignment.sectionIds) {
                ownershipMap[getAssignmentOwnershipKey(assignment.subjectId, sectionId)] = {
                    facultyId,
                    facultyName,
                    source,
                };
            }
        }
    }
    return ownershipMap;
}
export function buildOwnershipMapFromIndex(ownershipIndex) {
    const ownershipMap = {};
    for (const entry of ownershipIndex) {
        ownershipMap[getAssignmentOwnershipKey(entry.subjectId, entry.sectionId)] = {
            facultyId: entry.facultyId,
            facultyName: entry.facultyName,
            source: 'saved',
        };
    }
    return ownershipMap;
}
/**
 * Like buildOwnershipMap but accumulates ALL owners per key instead of last-write-wins.
 * Use this to detect database-level duplicate ownership conflicts that bypass the
 * transaction guardrails (e.g. via seeding scripts).
 */
export function buildMultiOwnerSavedMap(savedAssignmentsByFaculty, facultyNames) {
    const multiMap = {};
    for (const [facultyIdRaw, assignments] of Object.entries(savedAssignmentsByFaculty)) {
        const facultyId = Number(facultyIdRaw);
        const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
        for (const assignment of assignments) {
            for (const sectionId of assignment.sectionIds) {
                const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
                const existing = multiMap[key];
                if (existing) {
                    existing.push({ facultyId, facultyName, source: 'saved' });
                }
                else {
                    multiMap[key] = [{ facultyId, facultyName, source: 'saved' }];
                }
            }
        }
    }
    return multiMap;
}
/**
 * Returns the set of ownership keys (subjectId:sectionId) that are owned by more
 * than one faculty in saved data — these are hard database-level conflicts.
 */
export function detectSavedConflictKeys(multiOwnerMap) {
    const conflicted = new Set();
    for (const [key, owners] of Object.entries(multiOwnerMap)) {
        if (owners.length > 1) {
            conflicted.add(key);
        }
    }
    return conflicted;
}
export function buildPendingOwnershipMap(savedAssignmentsByFaculty, draftAssignmentsByFaculty, facultyNames) {
    const savedOwnershipMap = buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved');
    const pendingOwnershipMap = {};
    for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
        const facultyId = Number(facultyIdRaw);
        const facultyName = facultyNames[facultyId] ?? `Faculty ${facultyId}`;
        const savedSignature = new Set((savedAssignmentsByFaculty[facultyId] ?? []).flatMap((assignment) => assignment.sectionIds.map((sectionId) => getAssignmentOwnershipKey(assignment.subjectId, sectionId))));
        for (const assignment of assignments) {
            for (const sectionId of assignment.sectionIds) {
                const key = getAssignmentOwnershipKey(assignment.subjectId, sectionId);
                const savedOwner = savedOwnershipMap[key];
                if (savedSignature.has(key) && savedOwner?.facultyId === facultyId) {
                    continue;
                }
                pendingOwnershipMap[key] = {
                    facultyId,
                    facultyName,
                    source: 'pending',
                };
            }
        }
    }
    return pendingOwnershipMap;
}
export function buildTeachingLoadProfile(assignments, subjects, sectionMap, equivalentHours = 0) {
    const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]));
    const breakdown = [];
    let totalMinutes = 0;
    for (const assignment of assignments) {
        const subject = subjectMap.get(assignment.subjectId);
        if (!subject)
            continue;
        for (const sectionId of assignment.sectionIds) {
            const section = sectionMap.get(sectionId);
            if (!section)
                continue;
            breakdown.push({
                subjectId: subject.id,
                subjectName: subject.name,
                subjectCode: subject.code,
                sectionId,
                sectionName: section.name,
                gradeLevel: section.displayOrder,
                minutesPerWeek: subject.minMinutesPerWeek,
                totalMinutes: subject.minMinutesPerWeek,
            });
            totalMinutes += subject.minMinutesPerWeek;
        }
    }
    const actualTeachingHours = Math.round((totalMinutes / 60) * 10) / 10;
    const normalizedEquivalentHours = Math.round(equivalentHours * 10) / 10;
    const creditedTotalHours = Math.round((actualTeachingHours + normalizedEquivalentHours) * 10) / 10;
    const overloadHours = Math.round(Math.max(actualTeachingHours - STANDARD_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
    const overCapHours = Math.round(Math.max(actualTeachingHours - MAX_WEEKLY_TEACHING_HOURS, 0) * 10) / 10;
    const { status, label } = deriveLoadStatus(actualTeachingHours);
    return {
        actualTeachingHours,
        equivalentHours: normalizedEquivalentHours,
        creditedTotalHours,
        overloadHours,
        overCapHours,
        status,
        statusLabel: label,
        breakdown: breakdown.sort((left, right) => left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode)),
    };
}
//# sourceMappingURL=faculty-assignment-helpers.js.map