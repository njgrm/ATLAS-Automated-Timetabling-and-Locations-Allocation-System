/**
 * Faculty service — Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation (upsert + stale detection)
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */
import { prisma } from '../lib/prisma.js';
import { createFacultyAdapter } from './faculty-adapter.js';
import crypto from 'crypto';
const adapter = createFacultyAdapter();
// ─── Cache helpers ───
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
// ─── Sync with reconciliation ───
export async function syncFacultyFromExternal(schoolId, schoolYearId, authToken) {
    let fetchResult;
    let isStale = false;
    let staleReason;
    let sourceLabel;
    try {
        fetchResult = await adapter.fetchFacultyBySchoolYear(schoolId, schoolYearId, authToken);
        sourceLabel = fetchResult.source === 'stub' ? 'stub' : 'enrollpro';
        // Save snapshot on successful fetch
        await saveSnapshot(schoolId, schoolYearId, fetchResult);
    }
    catch (err) {
        // Upstream failed — try cached snapshot
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
            // No cache — explicit error
            return {
                synced: false,
                error: 'UPSTREAM_UNAVAILABLE: Faculty source unreachable and no cached snapshot exists.',
                source: 'enrollpro',
                fetchedAt: new Date(),
                activeCount: 0,
                staleCount: 0,
                deactivatedCount: 0,
                isStale: true,
                staleReason: 'No upstream and no cache',
            };
        }
    }
    const external = fetchResult.teachers;
    const externalIds = new Set(external.map((f) => f.id));
    // 1. Upsert current teachers
    for (const f of external) {
        await prisma.facultyMirror.upsert({
            where: { schoolId_externalId: { schoolId, externalId: f.id } },
            update: {
                firstName: f.firstName,
                lastName: f.lastName,
                department: f.department,
                employmentStatus: f.employmentStatus ?? 'PERMANENT',
                isClassAdviser: f.isClassAdviser ?? false,
                advisoryEquivalentHours: f.advisoryEquivalentHours ?? (f.isClassAdviser ? 5 : 0),
                canTeachOutsideDepartment: f.canTeachOutsideDepartment ?? false,
                contactInfo: f.contactInfo,
                advisedSectionId: f.advisedSectionId ?? null,
                advisedSectionName: f.advisedSectionName ?? null,
                lastSyncedAt: new Date(),
                // Clear stale flag on successful upstream appearance
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
    // 2. Detect and mark stale teachers (locally present but missing from upstream)
    const localTeachers = await prisma.facultyMirror.findMany({
        where: { schoolId },
        select: { id: true, externalId: true, isStale: true },
    });
    let deactivatedCount = 0;
    for (const local of localTeachers) {
        if (!externalIds.has(local.externalId) && !local.isStale) {
            // Mark as stale (soft-deactivate)
            await prisma.facultyMirror.update({
                where: { id: local.id },
                data: {
                    isStale: true,
                    staleReason: 'Missing from upstream during reconciliation',
                    staleAt: new Date(),
                },
            });
            deactivatedCount++;
        }
    }
    // Count results
    const [activeCount, staleCount] = await Promise.all([
        prisma.facultyMirror.count({ where: { schoolId, isStale: false } }),
        prisma.facultyMirror.count({ where: { schoolId, isStale: true } }),
    ]);
    return {
        synced: true,
        source: sourceLabel,
        fetchedAt: fetchResult.fetchedAt,
        activeCount,
        staleCount,
        deactivatedCount,
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
                    include: { subject: { select: { id: true, name: true, code: true } } },
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
        source: 'enrollpro', // Source of the mirror data
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
// ─── Adviser helpers ───
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
//# sourceMappingURL=faculty.service.js.map