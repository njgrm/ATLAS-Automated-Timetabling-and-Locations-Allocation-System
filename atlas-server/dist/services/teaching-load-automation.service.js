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
import { matchesSubjectOwnershipDepartment, normalizeDepartmentCode, resolveSubjectAllowedOwnerDepartments, resolveSubjectRotationFamily, resolveSubjectOwnerDepartmentCode, } from './subject-ownership.service.js';
// DO 005 s.2024 weekly minute caps
const STANDARD_CAP_MIN = 1_800;
const HARD_CAP_MIN = 2_400;
async function fetchSectionsForAutoFill(schoolId, schoolYearId, authToken) {
    try {
        return await sectionAdapter.fetchSectionsBySchoolYear(schoolYearId, schoolId, authToken);
    }
    catch {
        const mirroredSections = await prisma.sectionMirror.findMany({
            where: {
                schoolId,
                schoolYearId,
                isActiveForScheduling: true,
            },
            select: {
                externalId: true,
                name: true,
                gradeLevelId: true,
                gradeLevelName: true,
                displayOrder: true,
                maxCapacity: true,
                enrolledCount: true,
                programType: true,
                programCode: true,
                programName: true,
                isSpecialProgram: true,
            },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        });
        const groupedByGrade = new Map();
        for (const section of mirroredSections) {
            const entry = groupedByGrade.get(section.displayOrder) ?? {
                gradeLevelId: section.gradeLevelId,
                gradeLevelName: section.gradeLevelName,
                displayOrder: section.displayOrder,
                sections: [],
            };
            entry.sections.push({
                id: section.externalId,
                name: section.name,
                maxCapacity: section.maxCapacity,
                enrolledCount: section.enrolledCount,
                gradeLevelId: section.gradeLevelId,
                gradeLevelName: section.gradeLevelName,
                displayOrder: section.displayOrder,
                programType: section.programType ?? 'REGULAR',
                programCode: section.programCode ?? null,
                programName: section.programName ?? null,
                isSpecialProgram: section.isSpecialProgram,
            });
            groupedByGrade.set(section.displayOrder, entry);
        }
        return {
            gradeLevels: Array.from(groupedByGrade.values()).sort((left, right) => left.displayOrder - right.displayOrder),
            source: 'cached-enrollpro',
            fetchedAt: new Date(),
            fallbackReason: 'section-adapter-fetch-failed',
        };
    }
}
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
function buildStaffingReport(unresolvedPairs, faculty, capacityUsed) {
    const rawByDepartment = new Map();
    const concurrentLanes = new Map();
    const shortageSections = new Map();
    for (const pair of unresolvedPairs) {
        const fallbackDepartment = pair.subject.ownerDepartment
            ?? resolveSubjectOwnerDepartmentCode(pair.subject.code, pair.subject.name)
            ?? pair.subject.modularGroupId
            ?? 'GENERAL';
        const department = formatDepartmentLabel(fallbackDepartment);
        const subjectMinutes = Math.max(0, Number(pair.subject.minMinutesPerWeek) || 0);
        const rawBucket = rawByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
        rawBucket.count += 1;
        rawBucket.missingMinutesPerWeek += subjectMinutes;
        rawByDepartment.set(department, rawBucket);
        const family = resolveCapacityRotationFamily(pair.subject.code, pair.subject.rotationFamily);
        const laneKey = family
            ? `family:${family}:${pair.sectionId}`
            : `subject:${pair.subjectId}:${pair.sectionId}`;
        const allowedOwnerDepartments = resolveSubjectAllowedOwnerDepartments(pair.subject.ownerDepartment, pair.subject.code, pair.subject.name, pair.subject.requiredFeatures);
        const existingLane = concurrentLanes.get(laneKey);
        if (!existingLane || subjectMinutes > existingLane.minutes) {
            concurrentLanes.set(laneKey, {
                department,
                minutes: subjectMinutes,
                allowedOwnerDepartments,
            });
        }
        const sections = shortageSections.get(department) ?? [];
        sections.push({
            subjectId: pair.subject.id,
            subjectCode: pair.subject.code,
            subjectName: pair.subject.name,
            sectionId: pair.sectionId,
            sectionName: pair.sectionName,
            programType: pair.sectionProgramType,
        });
        shortageSections.set(department, sections);
    }
    const concurrentByDepartment = new Map();
    for (const lane of concurrentLanes.values()) {
        const bucket = concurrentByDepartment.get(lane.department) ?? { count: 0, missingMinutesPerWeek: 0 };
        bucket.count += 1;
        bucket.missingMinutesPerWeek += lane.minutes;
        concurrentByDepartment.set(lane.department, bucket);
    }
    const facultySpareMinutes = new Map();
    const facultyDepartmentCode = new Map();
    const facultyDepartmentLabel = new Map();
    for (const member of faculty) {
        const spareMinutes = Math.max(0, maxMinutes(member) - (capacityUsed.get(member.id) ?? 0));
        facultySpareMinutes.set(member.id, spareMinutes);
        facultyDepartmentCode.set(member.id, normalizeDepartmentCode(member.department));
        facultyDepartmentLabel.set(member.id, formatDepartmentLabel(member.department));
    }
    const sortedConcurrentLanes = Array.from(concurrentLanes.values()).sort((left, right) => right.minutes - left.minutes);
    const recoverabilityByDepartment = new Map();
    const crossTraineeTeacherIdsByDepartment = new Map();
    for (const lane of sortedConcurrentLanes) {
        const normalizedAllowedDepartments = new Set(lane.allowedOwnerDepartments
            .map((department) => normalizeDepartmentCode(department))
            .filter((department) => Boolean(department)));
        let bestFacultyId = null;
        let bestSpareMinutes = 0;
        for (const member of faculty) {
            const spareMinutes = facultySpareMinutes.get(member.id) ?? 0;
            if (spareMinutes <= 0)
                continue;
            const memberDepartmentCode = facultyDepartmentCode.get(member.id);
            if (!memberDepartmentCode || !normalizedAllowedDepartments.has(memberDepartmentCode))
                continue;
            if (spareMinutes > bestSpareMinutes) {
                bestSpareMinutes = spareMinutes;
                bestFacultyId = member.id;
            }
        }
        const recoverabilityBucket = recoverabilityByDepartment.get(lane.department) ?? {
            recoverableCount: 0,
            recoverableMinutes: 0,
            constrainedCount: 0,
            constrainedMinutes: 0,
        };
        if (bestFacultyId != null && bestSpareMinutes >= lane.minutes) {
            recoverabilityBucket.recoverableCount += 1;
            recoverabilityBucket.recoverableMinutes += lane.minutes;
            facultySpareMinutes.set(bestFacultyId, bestSpareMinutes - lane.minutes);
            const teacherDepartment = facultyDepartmentLabel.get(bestFacultyId) ?? 'GENERAL';
            if (teacherDepartment !== lane.department) {
                const teachers = crossTraineeTeacherIdsByDepartment.get(teacherDepartment) ?? new Set();
                teachers.add(bestFacultyId);
                crossTraineeTeacherIdsByDepartment.set(teacherDepartment, teachers);
            }
        }
        else {
            recoverabilityBucket.constrainedCount += 1;
            recoverabilityBucket.constrainedMinutes += lane.minutes;
        }
        recoverabilityByDepartment.set(lane.department, recoverabilityBucket);
    }
    const allDepartments = new Set([
        ...rawByDepartment.keys(),
        ...concurrentByDepartment.keys(),
    ]);
    const shortageBuckets = Array.from(allDepartments)
        .map((department) => {
        const raw = rawByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
        const concurrent = concurrentByDepartment.get(department) ?? { count: 0, missingMinutesPerWeek: 0 };
        const recoverability = recoverabilityByDepartment.get(department) ?? {
            recoverableCount: 0,
            recoverableMinutes: 0,
            constrainedCount: 0,
            constrainedMinutes: 0,
        };
        return {
            department,
            rawUnassignedSections: raw.count,
            rawMissingMinutesPerWeek: raw.missingMinutesPerWeek,
            concurrentUnassignedSections: concurrent.count,
            concurrentMissingMinutesPerWeek: concurrent.missingMinutesPerWeek,
            recoverableConcurrentCount: recoverability.recoverableCount,
            recoverableConcurrentMissingMinutesPerWeek: recoverability.recoverableMinutes,
            constrainedConcurrentCount: recoverability.constrainedCount,
            constrainedConcurrentMissingMinutesPerWeek: recoverability.constrainedMinutes,
            rotationAdjustedMinutesPerWeek: Math.max(0, raw.missingMinutesPerWeek - concurrent.missingMinutesPerWeek),
        };
    })
        .sort((left, right) => {
        if (right.concurrentMissingMinutesPerWeek !== left.concurrentMissingMinutesPerWeek) {
            return right.concurrentMissingMinutesPerWeek - left.concurrentMissingMinutesPerWeek;
        }
        if (right.rawMissingMinutesPerWeek !== left.rawMissingMinutesPerWeek) {
            return right.rawMissingMinutesPerWeek - left.rawMissingMinutesPerWeek;
        }
        return left.department.localeCompare(right.department);
    });
    const primaryShortage = shortageBuckets[0] ?? {
        department: 'GENERAL',
        rawUnassignedSections: 0,
        rawMissingMinutesPerWeek: 0,
        concurrentUnassignedSections: 0,
        concurrentMissingMinutesPerWeek: 0,
        rotationAdjustedMinutesPerWeek: 0,
    };
    const totalRawUnassignedSections = shortageBuckets.reduce((sum, bucket) => sum + bucket.rawUnassignedSections, 0);
    const totalConcurrentUnassignedSections = shortageBuckets.reduce((sum, bucket) => sum + bucket.concurrentUnassignedSections, 0);
    const rawMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.rawMissingMinutesPerWeek, 0);
    const concurrentMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.concurrentMissingMinutesPerWeek, 0);
    const rawMissingHoursPerWeek = Math.round((rawMissingMinutesPerWeek / 60) * 10) / 10;
    const concurrentMissingHoursPerWeek = Math.round((concurrentMissingMinutesPerWeek / 60) * 10) / 10;
    const rotationAdjustedMinutesPerWeek = Math.max(0, rawMissingMinutesPerWeek - concurrentMissingMinutesPerWeek);
    const recoverableConcurrentRows = shortageBuckets.reduce((sum, bucket) => sum + bucket.recoverableConcurrentCount, 0);
    const recoverableConcurrentMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.recoverableConcurrentMissingMinutesPerWeek, 0);
    const constrainedConcurrentRows = shortageBuckets.reduce((sum, bucket) => sum + bucket.constrainedConcurrentCount, 0);
    const constrainedConcurrentMissingMinutesPerWeek = shortageBuckets.reduce((sum, bucket) => sum + bucket.constrainedConcurrentMissingMinutesPerWeek, 0);
    const recoverableConcurrentMissingHoursPerWeek = Math.round((recoverableConcurrentMissingMinutesPerWeek / 60) * 10) / 10;
    const constrainedConcurrentMissingHoursPerWeek = Math.round((constrainedConcurrentMissingMinutesPerWeek / 60) * 10) / 10;
    const recommendedNewHires = Math.round((concurrentMissingHoursPerWeek / 30) * 10) / 10;
    const initialSpareByFaculty = new Map();
    for (const member of faculty) {
        initialSpareByFaculty.set(member.id, Math.max(0, maxMinutes(member) - (capacityUsed.get(member.id) ?? 0)));
    }
    const internalCrossTrainees = Array.from(crossTraineeTeacherIdsByDepartment.entries())
        .map(([department, teacherIds]) => {
        const teacherList = Array.from(teacherIds);
        const totalSpareMinutes = teacherList.reduce((sum, facultyId) => sum + (initialSpareByFaculty.get(facultyId) ?? 0), 0);
        const qualifiedRecoveryMinutes = teacherList.reduce((sum, facultyId) => {
            const initial = initialSpareByFaculty.get(facultyId) ?? 0;
            const remaining = facultySpareMinutes.get(facultyId) ?? 0;
            return sum + Math.max(0, initial - remaining);
        }, 0);
        return {
            department,
            availableTeachers: teacherList.length,
            totalSpareHours: Math.round((totalSpareMinutes / 60) * 10) / 10,
            qualifiedRecoveryHoursPerWeek: Math.round((qualifiedRecoveryMinutes / 60) * 10) / 10,
        };
    })
        .sort((left, right) => {
        if ((right.qualifiedRecoveryHoursPerWeek ?? 0) !== (left.qualifiedRecoveryHoursPerWeek ?? 0)) {
            return (right.qualifiedRecoveryHoursPerWeek ?? 0) - (left.qualifiedRecoveryHoursPerWeek ?? 0);
        }
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
        count: bucket.rawUnassignedSections,
        missingMinutesPerWeek: bucket.rawMissingMinutesPerWeek,
        concurrentCount: bucket.concurrentUnassignedSections,
        concurrentMissingMinutesPerWeek: bucket.concurrentMissingMinutesPerWeek,
        recoverableConcurrentCount: bucket.recoverableConcurrentCount,
        recoverableConcurrentMissingMinutesPerWeek: bucket.recoverableConcurrentMissingMinutesPerWeek,
        constrainedConcurrentCount: bucket.constrainedConcurrentCount,
        constrainedConcurrentMissingMinutesPerWeek: bucket.constrainedConcurrentMissingMinutesPerWeek,
        rotationAdjustedMinutesPerWeek: bucket.rotationAdjustedMinutesPerWeek,
        sections: (shortageSections.get(bucket.department) ?? []).slice(0, 50),
    }));
    return {
        department: primaryShortage.department,
        dominantShortageDepartment: primaryShortage.department,
        unassignedSections: totalRawUnassignedSections,
        missingHoursPerWeek: rawMissingHoursPerWeek,
        concurrentUnassignedSections: totalConcurrentUnassignedSections,
        concurrentMissingHoursPerWeek,
        recoverableConcurrentRows,
        recoverableConcurrentMissingHoursPerWeek,
        recoverableConcurrentMissingMinutesPerWeek,
        constrainedConcurrentRows,
        constrainedConcurrentMissingHoursPerWeek,
        constrainedConcurrentMissingMinutesPerWeek,
        recommendedNewHires,
        internalCrossTrainees,
        missingMinutesPerWeek: rawMissingMinutesPerWeek,
        concurrentMissingMinutesPerWeek,
        rotationAdjustedMinutesPerWeek,
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
    const sectionResult = await fetchSectionsForAutoFill(schoolId, schoolYearId, authToken);
    if (sectionResult.source !== 'enrollpro') {
        warnings.push(sectionResult.source === 'cached-enrollpro'
            ? 'Staffing report is running on ATLAS-cached section data because EnrollPro is currently unavailable.'
            : 'Staffing report is running on stubbed section data.');
    }
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
            preserved: 0,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: 0,
            warnings,
            sectionSource: sectionResult.source,
            sectionFallbackReason: sectionResult.fallbackReason ?? null,
            staffingReport: {
                department: 'GENERAL',
                dominantShortageDepartment: 'GENERAL',
                unassignedSections: 0,
                missingHoursPerWeek: 0,
                concurrentUnassignedSections: 0,
                concurrentMissingHoursPerWeek: 0,
                recoverableConcurrentRows: 0,
                recoverableConcurrentMissingHoursPerWeek: 0,
                recoverableConcurrentMissingMinutesPerWeek: 0,
                constrainedConcurrentRows: 0,
                constrainedConcurrentMissingHoursPerWeek: 0,
                constrainedConcurrentMissingMinutesPerWeek: 0,
                recommendedNewHires: 0,
                internalCrossTrainees: [],
                missingMinutesPerWeek: 0,
                concurrentMissingMinutesPerWeek: 0,
                rotationAdjustedMinutesPerWeek: 0,
                shortages: [],
            },
        };
    }
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
    const activeFacultyIds = faculty.map((member) => member.id);
    // ─── Step 1: Build resolved-pair set + capacity used per faculty ───────────
    const existingOwnerships = await prisma.subjectSectionOwnership.findMany({
        where: {
            schoolId,
            sectionId: { in: allSectionIds },
            facultyId: { in: activeFacultyIds },
        },
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
    const workQueue = [];
    const unresolvedPairs = [];
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
    if (staffingOnly) {
        for (const pair of workQueue) {
            unresolvedPairs.push(pair);
        }
        return {
            preserved,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: workQueue.length,
            warnings,
            sectionSource: sectionResult.source,
            sectionFallbackReason: sectionResult.fallbackReason ?? null,
            staffingReport: buildStaffingReport(unresolvedPairs, faculty, capacityUsed),
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
                unresolvedPairs.push(pair);
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
                    const insertResult = await tx.subjectSectionOwnership.createMany({
                        data: sectionIdsArr.map((sectionId) => ({
                            schoolId,
                            facultySubjectId,
                            facultyId,
                            subjectId,
                            sectionId,
                            assignedAt: new Date(),
                        })),
                        skipDuplicates: true,
                    });
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
                    if (insertResult.count > 0) {
                        created += insertResult.count;
                        affectedTeacherIds.add(facultyId);
                    }
                }
            }
        });
    }
    const staffingReport = buildStaffingReport(unresolvedPairs, faculty, capacityUsed);
    return {
        preserved,
        created,
        assignmentsCreated: created,
        uniqueTeachersAffected: affectedTeacherIds.size,
        unresolved: unresolvedCount,
        warnings,
        sectionSource: sectionResult.source,
        sectionFallbackReason: sectionResult.fallbackReason ?? null,
        staffingReport,
    };
}
//# sourceMappingURL=teaching-load-automation.service.js.map