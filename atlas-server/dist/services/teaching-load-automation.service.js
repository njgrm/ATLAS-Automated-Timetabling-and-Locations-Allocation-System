/**
 * Teaching Load Automation Service
 *
 * Implements the state-preserving Auto-Fill algorithm per DO 005 s.2024.
 *
 * Algorithm Overview:
 *  1. Build a resolved-pair set and capacity map from existing SubjectSectionOwnership rows.
 *  2. Verify HG records for all active advisers (warn if missing).
 *  3. Build a work queue: all active subject × section pairs not already resolved.
 *  4. For each unresolved pair, find the best-qualified, lowest-loaded candidate.
 *  5. Respect DO 005 caps (standard = 1,800 min/week, hard = 2,400 min/week).
 *  6. Modular bundles: attempt entire group; persist partial if cap is hit mid-bundle.
 *  7. Persist FacultySubject + SubjectSectionOwnership in a single transaction.
 *  8. Return { preserved, created, unresolved, warnings, staffingReport }.
 *
 * Design invariants:
 * - NEVER overwrites an existing SubjectSectionOwnership row.
 * - HG advisory records are not touched (already written by hg-advisory.service).
 * - Business logic is entirely in this service; controllers are transport-only.
 */
import { prisma } from '../lib/prisma.js';
import { sectionAdapter } from './section-adapter.js';
import { matchesSubjectOwnershipDepartment, resolveSubjectRotationFamily, resolveSubjectOwnerDepartmentCode, } from './subject-ownership.service.js';
// DO 005 s.2024 weekly minute caps
const STANDARD_CAP_MIN = 1_800;
const HARD_CAP_MIN = 2_400;
/**
 * Convert maxHoursPerWeek to minutes/week for capacity calculations.
 * FacultyMirror.maxHoursPerWeek stores the limit in hours (default 30).
 */
function maxMinutes(faculty) {
    return Math.min(faculty.maxHoursPerWeek * 60, HARD_CAP_MIN);
}
function resolveCapacityRotationFamily(subjectCode, explicitRotationFamily) {
    const explicit = (explicitRotationFamily ?? '').trim().toUpperCase();
    if (explicit.length > 0) {
        return explicit;
    }
    const fallback = resolveSubjectRotationFamily(subjectCode, null);
    const normalizedFallback = (fallback ?? '').trim().toUpperCase();
    return normalizedFallback.length > 0 ? normalizedFallback : null;
}
function normalizeKey(value) {
    return (value ?? '').trim().toLowerCase();
}
function formatDepartmentLabel(value) {
    const normalized = normalizeKey(value);
    const labels = {
        sci: 'SCIENCE',
        science: 'SCIENCE',
        tle: 'TLE',
        eng: 'ENGLISH',
        languages: 'LANGUAGES',
        ap: 'SOCIAL STUDIES',
        'esp': 'VALUES',
        values: 'VALUES',
        math: 'MATHEMATICS',
        mathematics: 'MATHEMATICS',
        fil: 'FILIPINO',
        mapeh: 'MAPEH',
        guidance: 'GUIDANCE',
    };
    return labels[normalized] ?? (value?.trim().toUpperCase() || 'GENERAL');
}
function isProgramScopeCompatible(scopes, sectionProgramType) {
    if (!scopes || scopes.length === 0)
        return true;
    const normalizedProgramType = sectionProgramType.trim().toUpperCase();
    return scopes.some((scope) => scope.trim().toUpperCase() === normalizedProgramType);
}
function buildStaffingReport(unresolvedByDepartment, shortageSections, faculty, capacityUsed) {
    const shortageBuckets = Array.from(unresolvedByDepartment.entries())
        .map(([department, bucket]) => ({
        department,
        unassignedSections: bucket.count,
        missingMinutesPerWeek: bucket.missingMinutesPerWeek,
    }))
        .sort((left, right) => {
        if (right.missingMinutesPerWeek !== left.missingMinutesPerWeek) {
            return right.missingMinutesPerWeek - left.missingMinutesPerWeek;
        }
        if (right.unassignedSections !== left.unassignedSections) {
            return right.unassignedSections - left.unassignedSections;
        }
        return left.department.localeCompare(right.department);
    });
    const primaryShortage = shortageBuckets[0] ?? {
        department: 'GENERAL',
        unassignedSections: 0,
        missingMinutesPerWeek: 0,
    };
    const totalUnassignedSections = shortageBuckets.reduce((sum, bucket) => sum + bucket.unassignedSections, 0);
    const missingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.missingMinutesPerWeek, 0);
    const missingHoursPerWeek = Math.round((missingMinutesPerWeek / 60) * 10) / 10;
    const recommendedNewHires = Math.round((missingHoursPerWeek / 30) * 10) / 10;
    const crossTraineesByDepartment = new Map();
    for (const member of faculty) {
        const spareMinutes = Math.max(0, maxMinutes(member) - (capacityUsed.get(member.id) ?? 0));
        if (spareMinutes <= 0) {
            continue;
        }
        const department = formatDepartmentLabel(member.department);
        if (department === primaryShortage.department) {
            continue;
        }
        const bucket = crossTraineesByDepartment.get(department) ?? {
            availableTeachers: 0,
            totalSpareMinutes: 0,
        };
        bucket.availableTeachers += 1;
        bucket.totalSpareMinutes += spareMinutes;
        crossTraineesByDepartment.set(department, bucket);
    }
    const internalCrossTrainees = Array.from(crossTraineesByDepartment.entries())
        .map(([department, value]) => ({
        department,
        availableTeachers: value.availableTeachers,
        totalSpareHours: Math.round((value.totalSpareMinutes / 60) * 10) / 10,
    }))
        .sort((left, right) => {
        if (right.totalSpareHours !== left.totalSpareHours) {
            return right.totalSpareHours - left.totalSpareHours;
        }
        if (right.availableTeachers !== left.availableTeachers) {
            return right.availableTeachers - left.availableTeachers;
        }
        return left.department.localeCompare(right.department);
    });
    const shortages = shortageBuckets.map((bucket) => ({
        department: bucket.department,
        count: bucket.unassignedSections,
        missingMinutesPerWeek: bucket.missingMinutesPerWeek,
        sections: (shortageSections.get(bucket.department) ?? []).slice(0, 50),
    }));
    return {
        department: primaryShortage.department,
        unassignedSections: totalUnassignedSections,
        missingHoursPerWeek,
        recommendedNewHires,
        internalCrossTrainees,
        missingMinutesPerWeek,
        shortages,
    };
}
function resolveQualificationTier(faculty, subject) {
    const departmentMatch = matchesSubjectOwnershipDepartment(faculty.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures);
    if (departmentMatch)
        return 1;
    if (faculty.canTeachOutsideDepartment) {
        return 2;
    }
    return null;
}
export async function autoFill(schoolId, schoolYearId, authToken, options) {
    const warnings = [];
    const previewOnly = options?.previewOnly ?? false;
    const staffingOnly = options?.staffingOnly === true;
    // ─── Step 1: Build resolved-pair set + capacity used per faculty ───────────
    const existingOwnerships = await prisma.subjectSectionOwnership.findMany({
        where: { schoolId },
        select: {
            subjectId: true,
            sectionId: true,
            facultyId: true,
            facultySubject: {
                select: {
                    subject: { select: { id: true, code: true, rotationFamily: true, minMinutesPerWeek: true } },
                },
            },
        },
    });
    const resolvedPairs = new Set(existingOwnerships.map((o) => `${o.subjectId}:${o.sectionId}`));
    const preserved = resolvedPairs.size;
    const capacityUsed = new Map(); // facultyId → credited minutes used
    const capacityLanesByFaculty = new Map();
    for (const ownership of existingOwnerships) {
        const subject = ownership.facultySubject.subject;
        const mins = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
        if (mins <= 0)
            continue;
        const family = resolveCapacityRotationFamily(subject.code, subject.rotationFamily);
        const laneKey = family
            ? `family:${family}:${ownership.sectionId}`
            : `subject:${subject.id}:${ownership.sectionId}`;
        const lanes = capacityLanesByFaculty.get(ownership.facultyId) ?? new Map();
        const currentLaneMinutes = lanes.get(laneKey) ?? 0;
        if (mins > currentLaneMinutes) {
            lanes.set(laneKey, mins);
        }
        capacityLanesByFaculty.set(ownership.facultyId, lanes);
    }
    for (const [facultyId, lanes] of capacityLanesByFaculty.entries()) {
        const creditedMinutes = Array.from(lanes.values()).reduce((sum, value) => sum + value, 0);
        capacityUsed.set(facultyId, creditedMinutes);
    }
    // ─── Step 2: Verify HG records for advisers (warn if missing) ─────────────
    const advisersWithoutHg = await prisma.facultyMirror.findMany({
        where: {
            schoolId,
            isStale: false,
            isClassAdviser: true,
            advisedSectionId: { not: null },
        },
        select: { id: true, firstName: true, lastName: true, advisedSectionId: true },
    });
    const hgSubject = await prisma.subject.findFirst({
        where: { schoolId, code: 'HG' },
        select: { id: true },
    });
    if (hgSubject) {
        for (const adviser of advisersWithoutHg) {
            const hasHg = resolvedPairs.has(`${hgSubject.id}:${adviser.advisedSectionId}`);
            if (!hasHg) {
                warnings.push(`HG advisory missing for ${adviser.firstName} ${adviser.lastName} (section ${adviser.advisedSectionId}). Run faculty sync to repair.`);
            }
        }
    }
    // ─── Step 3: Build work queue ─────────────────────────────────────────────
    // Active subjects (not HG — HG is managed by hg-advisory.service)
    const subjects = await prisma.subject.findMany({
        where: {
            schoolId,
            isActive: true,
            code: { not: 'HG' },
        },
        select: {
            id: true,
            code: true,
            name: true,
            rotationFamily: true,
            gradeLevels: true,
            programScopes: true,
            minMinutesPerWeek: true,
            modularGroupId: true,
            modularOrder: true,
            ownerDepartment: true,
            requiredFeatures: true,
        },
    });
    const sectionResult = await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
    const sectionGradeLevel = new Map();
    const sectionMeta = new Map();
    for (const grade of sectionResult.gradeLevels) {
        for (const section of grade.sections) {
            if (section.id > 0) {
                sectionGradeLevel.set(section.id, section.displayOrder);
                sectionMeta.set(section.id, {
                    sectionName: section.name,
                    programType: section.programType ?? 'REGULAR',
                });
            }
        }
    }
    const allSectionIds = Array.from(sectionGradeLevel.keys());
    if (allSectionIds.length === 0) {
        warnings.push('No active sections were resolved for the selected school year. Auto-fill cannot continue.');
        return {
            preserved,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: 0,
            warnings,
            staffingReport: {
                department: 'GENERAL',
                unassignedSections: 0,
                missingHoursPerWeek: 0,
                recommendedNewHires: 0,
                internalCrossTrainees: [],
                missingMinutesPerWeek: 0,
                shortages: [],
            },
        };
    }
    const workQueue = [];
    const unresolvedByDepartment = new Map();
    const shortageSections = new Map();
    const recordShortage = (pair) => {
        const fallbackDepartment = pair.subject.ownerDepartment
            ?? resolveSubjectOwnerDepartmentCode(pair.subject.code, pair.subject.name)
            ?? pair.subject.modularGroupId
            ?? 'GENERAL';
        const shortageKey = formatDepartmentLabel(fallbackDepartment);
        const subjectMinutes = Math.max(0, Number(pair.subject.minMinutesPerWeek) || 0);
        const currentBucket = unresolvedByDepartment.get(shortageKey) ?? { count: 0, missingMinutesPerWeek: 0 };
        currentBucket.count += 1;
        currentBucket.missingMinutesPerWeek += subjectMinutes;
        unresolvedByDepartment.set(shortageKey, currentBucket);
        const existingSections = shortageSections.get(shortageKey) ?? [];
        existingSections.push({
            subjectId: pair.subject.id,
            subjectCode: pair.subject.code,
            subjectName: pair.subject.name,
            sectionId: pair.sectionId,
            sectionName: pair.sectionName,
            programType: pair.sectionProgramType,
        });
        shortageSections.set(shortageKey, existingSections);
    };
    for (const subject of subjects) {
        const relevantSections = subject.gradeLevels.length > 0
            ? allSectionIds.filter((sid) => {
                const gl = sectionGradeLevel.get(sid) ?? 0;
                if (!subject.gradeLevels.includes(gl))
                    return false;
                const programType = sectionMeta.get(sid)?.programType ?? 'REGULAR';
                return isProgramScopeCompatible(subject.programScopes, programType);
            })
            : allSectionIds.filter((sid) => {
                const programType = sectionMeta.get(sid)?.programType ?? 'REGULAR';
                return isProgramScopeCompatible(subject.programScopes, programType);
            });
        for (const sectionId of relevantSections) {
            const key = `${subject.id}:${sectionId}`;
            if (!resolvedPairs.has(key)) {
                const sectionInfo = sectionMeta.get(sectionId);
                workQueue.push({
                    subjectId: subject.id,
                    sectionId,
                    subject,
                    sectionName: sectionInfo?.sectionName ?? `Section ${sectionId}`,
                    sectionProgramType: sectionInfo?.programType ?? 'REGULAR',
                });
            }
        }
    }
    // ─── Step 4: Load active faculty ──────────────────────────────────────────
    const faculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isStale: false, isActiveForScheduling: true },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            canTeachOutsideDepartment: true,
            maxHoursPerWeek: true,
        },
    });
    if (staffingOnly) {
        for (const pair of workQueue) {
            recordShortage(pair);
        }
        return {
            preserved,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: workQueue.length,
            warnings,
            staffingReport: buildStaffingReport(unresolvedByDepartment, shortageSections, faculty, capacityUsed),
        };
    }
    // ─── Step 5 & 6: Assign pairs, respecting caps and modular bundles ─────────
    // Group work queue by subjectId for modular bundle processing
    const bySubjectId = new Map();
    for (const pair of workQueue) {
        const bucket = bySubjectId.get(pair.subjectId) ?? [];
        bucket.push(pair);
        bySubjectId.set(pair.subjectId, bucket);
    }
    // Sort subjects: non-modular first, then modular groups in order
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    const orderedSubjectIds = Array.from(bySubjectId.keys()).sort((a, b) => {
        const sa = subjectMap.get(a);
        const sb = subjectMap.get(b);
        if (!sa.modularGroupId && !sb.modularGroupId)
            return 0;
        if (!sa.modularGroupId)
            return -1;
        if (!sb.modularGroupId)
            return 1;
        if (sa.modularGroupId !== sb.modularGroupId)
            return sa.modularGroupId.localeCompare(sb.modularGroupId);
        return (sa.modularOrder ?? 0) - (sb.modularOrder ?? 0);
    });
    // Track new assignments to persist: facultyId → { subjectId → Set<sectionId> }
    const pendingAssignments = new Map();
    let unresolvedCount = 0;
    function addPending(facultyId, subjectId, sectionId) {
        if (!pendingAssignments.has(facultyId)) {
            pendingAssignments.set(facultyId, new Map());
        }
        const bySubject = pendingAssignments.get(facultyId);
        if (!bySubject.has(subjectId)) {
            bySubject.set(subjectId, new Set());
        }
        bySubject.get(subjectId).add(sectionId);
        // Update credited capacity with rotation-family lane collapsing.
        const subject = subjectMap.get(subjectId);
        const minutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
        if (minutes <= 0) {
            return;
        }
        const family = resolveCapacityRotationFamily(subject.code, subject.rotationFamily);
        const laneKey = family
            ? `family:${family}:${sectionId}`
            : `subject:${subjectId}:${sectionId}`;
        const lanes = capacityLanesByFaculty.get(facultyId) ?? new Map();
        const currentLaneMinutes = lanes.get(laneKey) ?? 0;
        if (minutes > currentLaneMinutes) {
            lanes.set(laneKey, minutes);
        }
        capacityLanesByFaculty.set(facultyId, lanes);
        const creditedMinutes = Array.from(lanes.values()).reduce((sum, value) => sum + value, 0);
        capacityUsed.set(facultyId, creditedMinutes);
    }
    function findBestCandidate(subjectRow, _sectionId) {
        const candidates = [];
        for (const f of faculty) {
            // Cap check
            const used = capacityUsed.get(f.id) ?? 0;
            const limit = maxMinutes(f);
            if (used + subjectRow.minMinutesPerWeek > limit)
                continue;
            const tier = resolveQualificationTier(f, subjectRow);
            if (tier != null) {
                candidates.push({ faculty: f, tier });
            }
        }
        if (candidates.length === 0)
            return null;
        // Sort: best tier first (1 > 2 > 3), then lowest current load
        candidates.sort((a, b) => {
            if (a.tier !== b.tier)
                return a.tier - b.tier;
            return (capacityUsed.get(a.faculty.id) ?? 0) - (capacityUsed.get(b.faculty.id) ?? 0);
        });
        return candidates[0].faculty;
    }
    for (const subjectId of orderedSubjectIds) {
        const pairs = bySubjectId.get(subjectId);
        const subjectRow = subjectMap.get(subjectId);
        for (const pair of pairs) {
            const candidate = findBestCandidate(subjectRow, pair.sectionId);
            if (!candidate) {
                unresolvedCount += 1;
                warnings.push(`Lacking Faculty: no department-qualified teacher for ${subjectRow.name} (${pair.sectionName}).`);
                recordShortage(pair);
            }
            else {
                addPending(candidate.id, pair.subjectId, pair.sectionId);
            }
        }
    }
    // ─── Step 7: Persist new assignments ──────────────────────────────────────
    let created = 0;
    const affectedTeacherIds = new Set();
    if (!previewOnly && pendingAssignments.size > 0) {
        await prisma.$transaction(async (tx) => {
            for (const [facultyId, subjectMap_] of pendingAssignments) {
                for (const [subjectId, sectionIds] of subjectMap_) {
                    const sectionIdsArr = Array.from(sectionIds);
                    // Derive grade levels from sectionGradeLevel map
                    const gradeLevels = Array.from(new Set(sectionIdsArr.map((sid) => sectionGradeLevel.get(sid)).filter(Boolean)));
                    // Upsert FacultySubject — merge with existing if present (non-HG, so no advisory concern)
                    const existingFs = await tx.facultySubject.findUnique({
                        where: { facultyId_subjectId: { facultyId, subjectId } },
                        select: { id: true, sectionIds: true, gradeLevels: true },
                    });
                    let facultySubjectId;
                    if (existingFs) {
                        facultySubjectId = existingFs.id;
                    }
                    else {
                        const fs = await tx.facultySubject.create({
                            data: {
                                facultyId,
                                subjectId,
                                schoolId,
                                gradeLevels: [],
                                sectionIds: [],
                                assignedBy: 0, // system
                            },
                            select: { id: true },
                        });
                        facultySubjectId = fs.id;
                    }
                    const insertedSectionIds = [];
                    for (const sectionId of sectionIdsArr) {
                        try {
                            await tx.subjectSectionOwnership.create({
                                data: {
                                    schoolId,
                                    facultySubjectId,
                                    facultyId,
                                    subjectId,
                                    sectionId,
                                    assignedAt: new Date(),
                                },
                            });
                            insertedSectionIds.push(sectionId);
                        }
                        catch (error) {
                            if (error?.code !== 'P2002') {
                                throw error;
                            }
                        }
                    }
                    const finalOwnedSections = await tx.subjectSectionOwnership.findMany({
                        where: { schoolId, facultyId, subjectId },
                        select: { sectionId: true },
                    });
                    const finalSectionIds = finalOwnedSections.map((row) => row.sectionId).sort((left, right) => left - right);
                    const finalGradeLevels = Array.from(new Set(finalSectionIds.map((sid) => sectionGradeLevel.get(sid)).filter(Boolean))).sort((left, right) => left - right);
                    if (finalSectionIds.length === 0) {
                        await tx.facultySubject.delete({ where: { id: facultySubjectId } });
                    }
                    else {
                        await tx.facultySubject.update({
                            where: { id: facultySubjectId },
                            data: {
                                sectionIds: finalSectionIds,
                                gradeLevels: finalGradeLevels,
                            },
                        });
                    }
                    if (insertedSectionIds.length > 0) {
                        created += insertedSectionIds.length;
                        affectedTeacherIds.add(facultyId);
                    }
                }
            }
        });
    }
    const staffingReport = buildStaffingReport(unresolvedByDepartment, shortageSections, faculty, capacityUsed);
    return {
        preserved,
        created,
        assignmentsCreated: created,
        uniqueTeachersAffected: affectedTeacherIds.size,
        unresolved: unresolvedCount,
        warnings,
        staffingReport,
    };
}
//# sourceMappingURL=teaching-load-automation.service.js.map