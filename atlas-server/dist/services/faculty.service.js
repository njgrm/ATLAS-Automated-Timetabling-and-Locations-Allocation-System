/**
 * Faculty service - Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation with optional prune mode
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter } from './faculty-adapter.js';
import { invalidateStaleCompletedRuns } from './generation.service.js';
import { seedQualifiedAssignments } from './assignment-seed.service.js';
import { sectionAdapter } from './section-adapter.js';
const adapter = createFacultyAdapter();
function computeChecksum(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
async function saveSnapshot(schoolId, schoolYearId, data) {
    const checksum = computeChecksum(data.teachers);
    await prisma.facultySnapshot.upsert({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
        update: {
            payload: data.teachers,
            source: data.source,
            fetchedAt: data.fetchedAt,
            checksum,
        },
        create: {
            schoolId,
            schoolYearId,
            payload: data.teachers,
            source: data.source,
            fetchedAt: data.fetchedAt,
            checksum,
        },
    });
}
async function loadSnapshot(schoolId, schoolYearId) {
    const snapshot = await prisma.facultySnapshot.findUnique({
        where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
    });
    if (!snapshot)
        return null;
    return {
        teachers: snapshot.payload,
        fetchedAt: snapshot.fetchedAt,
    };
}
function toExternalComparable(faculty) {
    return {
        employeeId: faculty.employeeId ?? null,
        firstName: faculty.firstName,
        lastName: faculty.lastName,
        department: faculty.department ?? null,
        specialization: faculty.specialization ?? null,
        employmentStatus: faculty.employmentStatus ?? 'PERMANENT',
        isClassAdviser: faculty.isClassAdviser ?? false,
        advisoryEquivalentHours: faculty.advisoryEquivalentHours ?? (faculty.isClassAdviser ? 5 : 0),
        canTeachOutsideDepartment: faculty.canTeachOutsideDepartment ?? false,
        contactInfo: faculty.contactInfo ?? null,
        advisedSectionId: faculty.advisedSectionId ?? null,
        advisedSectionName: faculty.advisedSectionName ?? null,
    };
}
function isMirrorEquivalent(local, external) {
    const normalized = toExternalComparable(external);
    return (local.employeeId === normalized.employeeId
        && local.firstName === normalized.firstName
        && local.lastName === normalized.lastName
        && local.department === normalized.department
        && local.specialization === normalized.specialization
        && local.employmentStatus === normalized.employmentStatus
        && local.isClassAdviser === normalized.isClassAdviser
        && local.advisoryEquivalentHours === normalized.advisoryEquivalentHours
        && local.canTeachOutsideDepartment === normalized.canTeachOutsideDepartment
        && local.contactInfo === normalized.contactInfo
        && local.advisedSectionId === normalized.advisedSectionId
        && local.advisedSectionName === normalized.advisedSectionName
        && local.isStale === false);
}
export function buildFacultyReconciliationSummary(external, localMirrors, mode) {
    const localByExternalId = new Map(localMirrors.map((mirror) => [mirror.externalId, mirror]));
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const faculty of external) {
        const local = localByExternalId.get(faculty.id);
        if (!local) {
            inserted += 1;
            continue;
        }
        if (isMirrorEquivalent(local, faculty)) {
            skipped += 1;
        }
        else {
            updated += 1;
        }
    }
    const externalIds = new Set(external.map((faculty) => faculty.id));
    const missingCount = localMirrors.filter((mirror) => !externalIds.has(mirror.externalId)).length;
    return {
        inserted,
        updated,
        removed: mode === 'prune' ? missingCount : 0,
        skipped,
        deactivated: mode === 'reconcile' ? missingCount : 0,
    };
}
export function reconcileAssignmentScopesToSections(assignments, sectionDisplayOrderById) {
    return assignments.map((assignment) => {
        const nextSectionIds = Array.from(new Set((assignment.sectionIds ?? []).filter((sectionId) => sectionDisplayOrderById.has(sectionId)))).sort((left, right) => left - right);
        if (nextSectionIds.length === 0) {
            return {
                id: assignment.id,
                action: 'remove',
                sectionIds: [],
                gradeLevels: [],
            };
        }
        const nextGradeLevels = Array.from(new Set(nextSectionIds
            .map((sectionId) => sectionDisplayOrderById.get(sectionId) ?? 0)
            .filter((value) => value > 0))).sort((left, right) => left - right);
        const currentSectionIds = [...(assignment.sectionIds ?? [])].sort((left, right) => left - right);
        const currentGradeLevels = [...(assignment.gradeLevels ?? [])].sort((left, right) => left - right);
        const sameSections = JSON.stringify(nextSectionIds) === JSON.stringify(currentSectionIds);
        const sameGrades = JSON.stringify(nextGradeLevels) === JSON.stringify(currentGradeLevels);
        return {
            id: assignment.id,
            action: sameSections && sameGrades ? 'skip' : 'update',
            sectionIds: nextSectionIds,
            gradeLevels: nextGradeLevels,
        };
    });
}
async function pruneFacultyAssignmentScopes(schoolId, schoolYearId, authToken) {
    const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
    const sectionDisplayOrderById = new Map();
    for (const gradeLevel of sectionResult.gradeLevels) {
        for (const section of gradeLevel.sections) {
            sectionDisplayOrderById.set(section.id, gradeLevel.displayOrder);
        }
    }
    const assignments = await prisma.facultySubject.findMany({
        where: { schoolId },
        select: { id: true, sectionIds: true, gradeLevels: true },
    });
    const decisions = reconcileAssignmentScopesToSections(assignments, sectionDisplayOrderById);
    const updates = decisions.filter((decision) => decision.action === 'update');
    const removals = decisions.filter((decision) => decision.action === 'remove').map((decision) => decision.id);
    await prisma.$transaction(async (tx) => {
        if (removals.length > 0) {
            await tx.facultySubject.deleteMany({ where: { id: { in: removals } } });
        }
        for (const decision of updates) {
            await tx.facultySubject.update({
                where: { id: decision.id },
                data: {
                    sectionIds: decision.sectionIds,
                    gradeLevels: decision.gradeLevels,
                },
            });
        }
    });
    return {
        updated: updates.length,
        removed: removals.length,
        unchanged: decisions.filter((decision) => decision.action === 'skip').length,
    };
}
export async function syncFacultyFromExternal(schoolId, schoolYearId, authToken, options = {}) {
    const mode = options.mode ?? 'reconcile';
    let fetchResult;
    let isStale = false;
    let staleReason;
    let sourceLabel;
    try {
        fetchResult = await adapter.fetchFacultyBySchoolYear(schoolId, schoolYearId, authToken);
        sourceLabel = fetchResult.source === 'stub' ? 'stub' : 'enrollpro';
        await saveSnapshot(schoolId, schoolYearId, fetchResult);
    }
    catch (err) {
        const cached = await loadSnapshot(schoolId, schoolYearId);
        if (cached) {
            fetchResult = {
                teachers: cached.teachers,
                source: 'enrollpro',
                fetchedAt: cached.fetchedAt,
            };
            sourceLabel = 'cached-enrollpro';
            isStale = true;
            staleReason = err instanceof Error ? err.message : 'Upstream unavailable';
        }
        else {
            return {
                synced: false,
                error: 'UPSTREAM_UNAVAILABLE: Faculty source unreachable and no cached snapshot exists.',
                source: 'enrollpro',
                fetchedAt: new Date(),
                activeCount: 0,
                staleCount: 0,
                deactivatedCount: 0,
                mode,
                reconciliation: { inserted: 0, updated: 0, removed: 0, skipped: 0, deactivated: 0 },
                assignmentPrune: { updated: 0, removed: 0, unchanged: 0 },
                invalidatedRuns: { invalidatedCount: 0, staleRunIds: [] },
                seededAssignments: { created: 0, skipped: 0 },
                isStale: true,
                staleReason: 'No upstream and no cache',
            };
        }
    }
    const external = fetchResult.teachers;
    const externalIds = new Set(external.map((f) => f.id));
    const localTeachers = await prisma.facultyMirror.findMany({
        where: { schoolId },
        select: {
            id: true,
            externalId: true,
            firstName: true,
            lastName: true,
            department: true,
            specialization: true,
            employmentStatus: true,
            isClassAdviser: true,
            advisoryEquivalentHours: true,
            canTeachOutsideDepartment: true,
            contactInfo: true,
            advisedSectionId: true,
            advisedSectionName: true,
            isStale: true,
        },
    });
    const reconciliation = buildFacultyReconciliationSummary(external, localTeachers, mode);
    for (const f of external) {
        await prisma.facultyMirror.upsert({
            where: { schoolId_externalId: { schoolId, externalId: f.id } },
            update: {
                firstName: f.firstName,
                lastName: f.lastName,
                department: f.department,
                specialization: f.specialization ?? null,
                employmentStatus: f.employmentStatus ?? 'PERMANENT',
                isClassAdviser: f.isClassAdviser ?? false,
                advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
                canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
                contactInfo: f.contactInfo,
                advisedSectionId: f.advisedSectionId ?? null,
                advisedSectionName: f.advisedSectionName ?? null,
                lastSyncedAt: new Date(),
                isStale: false,
                staleReason: null,
                staleAt: null,
            },
            create: {
                externalId: f.id,
                schoolId,
                firstName: f.firstName,
                lastName: f.lastName,
                department: f.department,
                specialization: f.specialization ?? null,
                employmentStatus: f.employmentStatus ?? 'PERMANENT',
                isClassAdviser: f.isClassAdviser ?? false,
                advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
                canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
                contactInfo: f.contactInfo,
                advisedSectionId: f.advisedSectionId ?? null,
                advisedSectionName: f.advisedSectionName ?? null,
                isActiveForScheduling: true,
                maxHoursPerWeek: 30,
                lastSyncedAt: new Date(),
                isStale: false,
            },
        });
    }
    const missingLocal = localTeachers.filter((local) => !externalIds.has(local.externalId));
    let deactivatedCount = 0;
    if (mode === 'prune' && missingLocal.length > 0) {
        const removedFacultyIds = missingLocal.map((local) => local.id);
        await prisma.$transaction(async (tx) => {
            await tx.atlasAuthAccount.deleteMany({ where: { facultyId: { in: removedFacultyIds } } });
            await tx.facultyMirror.deleteMany({ where: { id: { in: removedFacultyIds } } });
        });
    }
    else {
        for (const local of missingLocal) {
            if (local.isStale) {
                continue;
            }
            await prisma.facultyMirror.update({
                where: { id: local.id },
                data: {
                    isStale: true,
                    staleReason: 'Missing from upstream during reconciliation',
                    staleAt: new Date(),
                },
            });
            deactivatedCount += 1;
        }
    }
    const assignmentPrune = options.pruneSectionAssignments === false
        ? { updated: 0, removed: 0, unchanged: 0 }
        : await pruneFacultyAssignmentScopes(schoolId, schoolYearId, authToken);
    const shouldInvalidateRuns = options.invalidateRuns !== false
        && ((mode === 'prune' && missingLocal.length > 0)
            || deactivatedCount > 0
            || assignmentPrune.updated > 0
            || assignmentPrune.removed > 0);
    const invalidatedRuns = shouldInvalidateRuns
        ? await invalidateStaleCompletedRuns(schoolId, schoolYearId)
        : { invalidatedCount: 0, staleRunIds: [] };
    const [activeCount, staleCount] = await Promise.all([
        prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
        prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
    ]);
    // Auto-seed qualified assignments for faculty whose dept matches a subject's allowedSpecializations
    const seededAssignments = await seedQualifiedAssignments(schoolId, schoolYearId);
    return {
        synced: true,
        source: sourceLabel,
        fetchedAt: fetchResult.fetchedAt,
        activeCount,
        staleCount,
        deactivatedCount,
        mode,
        reconciliation: {
            ...reconciliation,
            deactivated: mode === 'reconcile' ? deactivatedCount : 0,
            removed: mode === 'prune' ? missingLocal.length : 0,
        },
        assignmentPrune,
        invalidatedRuns,
        seededAssignments,
        isStale,
        staleReason,
    };
}
export async function getFacultyBySchool(schoolId, options = {}) {
    const { includeStale = false } = options;
    const whereClause = { schoolId };
    if (!includeStale) {
        whereClause.isStale = false;
    }
    const [faculty, lastSyncRecord, activeCount, staleCount] = await Promise.all([
        prisma.facultyMirror.findMany({
            where: whereClause,
            include: {
                facultySubjects: {
                    include: { subject: { select: { id: true, name: true, code: true, minMinutesPerWeek: true, programScopes: true } } },
                },
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
        prisma.facultyMirror.findFirst({
            where: { schoolId },
            orderBy: { lastSyncedAt: 'desc' },
            select: { lastSyncedAt: true },
        }),
        prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
        prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
    ]);
    return {
        faculty,
        source: 'enrollpro',
        fetchedAt: lastSyncRecord?.lastSyncedAt ?? null,
        isStale: false,
        activeCount,
        staleCount,
    };
}
export async function getFacultyById(id) {
    return prisma.facultyMirror.findUnique({
        where: { id },
        include: {
            facultySubjects: {
                include: { subject: true },
            },
        },
    });
}
export async function updateFacultyMirror(id, data, expectedVersion) {
    const existing = await prisma.facultyMirror.findUnique({ where: { id } });
    if (!existing)
        return { success: false, error: 'Faculty not found.' };
    if (existing.version !== expectedVersion) {
        return { success: false, error: 'Version conflict. Please reload.' };
    }
    const updated = await prisma.facultyMirror.update({
        where: { id },
        data: {
            ...data,
            version: { increment: 1 },
        },
    });
    return { success: true, faculty: updated };
}
export async function getFacultyCountBySchool(schoolId) {
    return prisma.facultyMirror.count({
        where: { schoolId, isActiveForScheduling: true, isStale: false },
    });
}
export async function getLastSyncTime(schoolId) {
    const latest = await prisma.facultyMirror.findFirst({
        where: { schoolId },
        orderBy: { lastSyncedAt: 'desc' },
        select: { lastSyncedAt: true },
    });
    return latest?.lastSyncedAt ?? null;
}
export async function getFacultyWithAdviserInfo(schoolId) {
    return prisma.facultyMirror.findMany({
        where: { schoolId, isStale: false, isClassAdviser: true },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            advisedSectionId: true,
            advisedSectionName: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
}
export async function getHomeroomRecommendation(facultyId) {
    const faculty = await prisma.facultyMirror.findUnique({
        where: { id: facultyId },
        select: {
            isClassAdviser: true,
            advisedSectionId: true,
            advisedSectionName: true,
        },
    });
    if (!faculty || !faculty.isClassAdviser || !faculty.advisedSectionId) {
        return null;
    }
    return {
        hasAdviserMapping: true,
        advisedSectionId: faculty.advisedSectionId,
        advisedSectionName: faculty.advisedSectionName,
        homeroomHint: `Configure homeroom for ${faculty.advisedSectionName}`,
    };
}
export async function listSpecializationTermsBySchool(schoolId) {
    const [specRows, deptRows] = await Promise.all([
        prisma.facultyMirror.findMany({
            where: { schoolId, isStale: false, specialization: { not: null } },
            select: { specialization: true },
            distinct: ['specialization'],
        }),
        prisma.facultyMirror.findMany({
            where: { schoolId, isStale: false, department: { not: null } },
            select: { department: true },
            distinct: ['department'],
        }),
    ]);
    const specializations = specRows
        .map((row) => row.specialization?.trim())
        .filter((value) => Boolean(value))
        .sort((left, right) => left.localeCompare(right));
    const departments = deptRows
        .map((row) => row.department?.trim())
        .filter((value) => Boolean(value))
        .sort((left, right) => left.localeCompare(right));
    return {
        specializations,
        departments,
    };
}
export async function getSpecializationCatalogBySchool(schoolId) {
    const [facultyRows, aliases, subjects] = await Promise.all([
        prisma.facultyMirror.findMany({
            where: {
                schoolId,
                isStale: false,
                specialization: { not: null },
            },
            select: {
                specialization: true,
                department: true,
            },
        }),
        prisma.specializationAlias.findMany({
            where: { schoolId },
            select: { alias: true, canonical: true },
        }),
        prisma.subject.findMany({
            where: { schoolId, isActive: true },
            select: { code: true, name: true },
        }),
    ]);
    const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject.name]));
    const aliasToCanonical = new Map();
    for (const alias of aliases) {
        const canonicalList = aliasToCanonical.get(alias.alias) ?? [];
        if (!canonicalList.includes(alias.canonical)) {
            canonicalList.push(alias.canonical);
        }
        aliasToCanonical.set(alias.alias, canonicalList);
    }
    const specializationByKey = new Map();
    for (const row of facultyRows) {
        const specialization = row.specialization?.trim();
        if (!specialization) {
            continue;
        }
        const department = row.department?.trim() || null;
        const key = `${department ?? 'UNASSIGNED'}::${specialization}`;
        if (!specializationByKey.has(key)) {
            specializationByKey.set(key, { specialization, department });
        }
    }
    const departmentBuckets = new Map();
    const orphanSet = new Set();
    for (const entry of specializationByKey.values()) {
        const mappedFromAlias = aliasToCanonical.get(entry.specialization) ?? [];
        const directCanonical = subjectByCode.has(entry.specialization) ? [entry.specialization] : [];
        const mappedSubjectCodes = Array.from(new Set([...directCanonical, ...mappedFromAlias]));
        const mappedSubjects = mappedSubjectCodes
            .filter((code) => subjectByCode.has(code))
            .map((code) => ({ code, name: subjectByCode.get(code) }));
        let status;
        if (mappedSubjectCodes.length === 0) {
            status = 'unmapped';
            orphanSet.add(entry.specialization);
        }
        else if (mappedSubjects.length < mappedSubjectCodes.length) {
            status = 'partially_mapped';
        }
        else {
            status = 'mapped';
        }
        const departmentKey = entry.department ?? 'UNASSIGNED';
        const departmentName = entry.department ?? 'Unassigned Department';
        const bucket = departmentBuckets.get(departmentKey) ?? {
            departmentCode: entry.department,
            departmentName,
            specializationCount: 0,
            items: [],
        };
        bucket.items.push({
            specialization: entry.specialization,
            departmentCode: entry.department,
            departmentName,
            mappedSubjectCodes,
            mappedSubjects,
            status,
        });
        bucket.specializationCount += 1;
        departmentBuckets.set(departmentKey, bucket);
    }
    const departments = Array.from(departmentBuckets.values())
        .map((department) => ({
        ...department,
        items: department.items.sort((left, right) => left.specialization.localeCompare(right.specialization)),
    }))
        .sort((left, right) => left.departmentName.localeCompare(right.departmentName));
    return {
        departments,
        orphans: Array.from(orphanSet).sort((left, right) => left.localeCompare(right)),
        totalSpecializations: specializationByKey.size,
        totalDepartments: departments.length,
    };
}
//# sourceMappingURL=faculty.service.js.map