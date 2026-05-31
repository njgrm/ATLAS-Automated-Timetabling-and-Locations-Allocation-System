import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const record = value;
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`;
}
function hashPayload(value) {
    return createHash('sha256').update(stableStringify(value)).digest('hex');
}
function iso(value) {
    return value?.toISOString() ?? null;
}
function buildDomainSnapshot(signals) {
    return {
        fingerprint: hashPayload(signals),
        signals,
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function extractGenerationInputSnapshot(summary) {
    if (!isRecord(summary))
        return null;
    const candidate = summary.inputSnapshot;
    if (!isRecord(candidate))
        return null;
    if (candidate.schemaVersion !== 1)
        return null;
    if (typeof candidate.fingerprint !== 'string')
        return null;
    if (!isRecord(candidate.domains))
        return null;
    return candidate;
}
export function compareGenerationInputSnapshots(runSnapshot, currentSnapshot, checkedAt = new Date().toISOString()) {
    if (!runSnapshot) {
        return {
            status: 'UNKNOWN',
            message: 'ATLAS cannot compare this run with current inputs because it was generated before input snapshots were recorded.',
            actionHint: 'Keep reviewing the current draft, or regenerate when you need a draft that is checked against today\'s setup data.',
            changedDomains: [],
            checkedAt,
            currentFingerprint: currentSnapshot.fingerprint,
            missingReason: 'MISSING_RUN_SNAPSHOT',
        };
    }
    if (runSnapshot.schemaVersion !== currentSnapshot.schemaVersion) {
        return {
            status: 'UNKNOWN',
            message: 'ATLAS cannot compare this run because the input snapshot format changed after it was generated.',
            actionHint: 'Keep reviewing the current draft, or regenerate when you need a draft checked with the current setup contract.',
            changedDomains: [],
            checkedAt,
            runFingerprint: runSnapshot.fingerprint,
            currentFingerprint: currentSnapshot.fingerprint,
            missingReason: 'SNAPSHOT_VERSION_MISMATCH',
        };
    }
    const changedDomains = Object.keys(currentSnapshot.domains)
        .filter((domain) => runSnapshot.domains[domain]?.fingerprint !== currentSnapshot.domains[domain].fingerprint);
    if (changedDomains.length === 0 && runSnapshot.fingerprint === currentSnapshot.fingerprint) {
        return {
            status: 'FRESH',
            message: 'This draft still matches the current Teaching Load, policy, room, section, and subject setup.',
            actionHint: 'Continue review or manual repair without regenerating unless you want a new draft.',
            changedDomains: [],
            checkedAt,
            runFingerprint: runSnapshot.fingerprint,
            currentFingerprint: currentSnapshot.fingerprint,
        };
    }
    return {
        status: 'STALE',
        message: 'Teaching load, policy, rooms, sections, or subjects changed after this draft was generated.',
        actionHint: 'Preview the changed inputs, make a manual repair, or regenerate a new draft when you are ready.',
        changedDomains,
        checkedAt,
        runFingerprint: runSnapshot.fingerprint,
        currentFingerprint: currentSnapshot.fingerprint,
    };
}
export async function computeGenerationInputSnapshot(schoolId, schoolYearId) {
    const [facultyMirrorAggregate, facultySubjectAggregate, ownershipAggregate, policy, gradeWindowAggregate, roomAggregate, buildingAggregate, sectionAggregate, subjectAggregate, classTemplateAggregate, classTemplateSubjectAggregate,] = await Promise.all([
        prisma.facultyMirror.aggregate({
            where: { schoolId, isStale: false },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.facultySubject.aggregate({
            where: { schoolId },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.subjectSectionOwnership.aggregate({
            where: { schoolId },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.schedulingPolicy.findUnique({
            where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
            select: { id: true, updatedAt: true },
        }),
        prisma.gradeShiftWindow.aggregate({
            where: { schoolId, schoolYearId },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.room.aggregate({
            where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.building.aggregate({
            where: { schoolId, isTeachingBuilding: true },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.sectionMirror.aggregate({
            where: { schoolId, schoolYearId, isActiveForScheduling: true },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.subject.aggregate({
            where: { schoolId, isActive: true },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.classTemplate.aggregate({
            where: { schoolId, isActive: true },
            _count: { _all: true },
            _max: { id: true, updatedAt: true },
        }),
        prisma.classTemplateSubject.aggregate({
            where: { template: { schoolId } },
            _count: { _all: true },
            _max: { id: true, createdAt: true },
        }),
    ]);
    const domains = {
        teachingLoad: buildDomainSnapshot({
            facultyCount: facultyMirrorAggregate._count._all,
            facultyMaxId: facultyMirrorAggregate._max.id,
            facultyMaxUpdatedAt: iso(facultyMirrorAggregate._max.updatedAt),
            facultySubjectCount: facultySubjectAggregate._count._all,
            facultySubjectMaxId: facultySubjectAggregate._max.id,
            facultySubjectMaxUpdatedAt: iso(facultySubjectAggregate._max.updatedAt),
            sectionOwnershipCount: ownershipAggregate._count._all,
            sectionOwnershipMaxId: ownershipAggregate._max.id,
            sectionOwnershipMaxUpdatedAt: iso(ownershipAggregate._max.updatedAt),
        }),
        policy: buildDomainSnapshot({
            policyId: policy?.id ?? null,
            policyUpdatedAt: iso(policy?.updatedAt),
            gradeWindowCount: gradeWindowAggregate._count._all,
            gradeWindowMaxId: gradeWindowAggregate._max.id,
            gradeWindowMaxUpdatedAt: iso(gradeWindowAggregate._max.updatedAt),
        }),
        rooms: buildDomainSnapshot({
            teachingRoomCount: roomAggregate._count._all,
            teachingRoomMaxId: roomAggregate._max.id,
            teachingRoomMaxUpdatedAt: iso(roomAggregate._max.updatedAt),
            teachingBuildingCount: buildingAggregate._count._all,
            teachingBuildingMaxId: buildingAggregate._max.id,
            teachingBuildingMaxUpdatedAt: iso(buildingAggregate._max.updatedAt),
        }),
        sections: buildDomainSnapshot({
            activeSectionCount: sectionAggregate._count._all,
            sectionMaxId: sectionAggregate._max.id,
            sectionMaxUpdatedAt: iso(sectionAggregate._max.updatedAt),
        }),
        subjects: buildDomainSnapshot({
            activeSubjectCount: subjectAggregate._count._all,
            subjectMaxId: subjectAggregate._max.id,
            subjectMaxUpdatedAt: iso(subjectAggregate._max.updatedAt),
            activeTemplateCount: classTemplateAggregate._count._all,
            classTemplateMaxId: classTemplateAggregate._max.id,
            classTemplateMaxUpdatedAt: iso(classTemplateAggregate._max.updatedAt),
            classTemplateSubjectCount: classTemplateSubjectAggregate._count._all,
            classTemplateSubjectMaxId: classTemplateSubjectAggregate._max.id,
            classTemplateSubjectMaxCreatedAt: iso(classTemplateSubjectAggregate._max.createdAt),
        }),
    };
    return {
        schemaVersion: 1,
        schoolId,
        schoolYearId,
        computedAt: new Date().toISOString(),
        fingerprint: hashPayload(domains),
        domains,
    };
}
export async function compareCurrentInputsForRun(summary, schoolId, schoolYearId) {
    try {
        const currentSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);
        const runSnapshot = extractGenerationInputSnapshot(summary);
        return compareGenerationInputSnapshots(runSnapshot, currentSnapshot);
    }
    catch {
        return {
            status: 'UNKNOWN',
            message: 'ATLAS could not check whether this draft still matches the latest setup data.',
            actionHint: 'Keep reviewing the current draft, then refresh or regenerate if you need a fully checked schedule.',
            changedDomains: [],
            checkedAt: new Date().toISOString(),
            missingReason: 'COMPARISON_FAILED',
        };
    }
}
//# sourceMappingURL=generation-input-snapshot.service.js.map