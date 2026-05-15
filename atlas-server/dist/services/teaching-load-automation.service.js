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
        .map(([department, unassignedSections]) => ({ department, unassignedSections }))
        .sort((left, right) => {
        if (right.unassignedSections !== left.unassignedSections) {
            return right.unassignedSections - left.unassignedSections;
        }
        return left.department.localeCompare(right.department);
    });
    const primaryShortage = shortageBuckets[0] ?? {
        department: 'GENERAL',
        unassignedSections: 0,
    };
    const missingMinutesPerWeek = primaryShortage.unassignedSections * 30;
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
        sections: (shortageSections.get(bucket.department) ?? []).slice(0, 50),
    }));
    return {
        department: primaryShortage.department,
        unassignedSections: primaryShortage.unassignedSections,
        missingHoursPerWeek,
        recommendedNewHires,
        internalCrossTrainees,
        missingMinutesPerWeek,
        shortages,
    };
}
function resolveQualificationTier(faculty, subject, aliasMap) {
    const normalizedSubjectCode = normalizeKey(subject.code);
    const normalizedSpec = normalizeKey(faculty.specialization);
    if (normalizedSpec) {
        const mappedSubjects = aliasMap.get(normalizedSpec);
        if (mappedSubjects?.has(normalizedSubjectCode)) {
            return 1;
        }
    }
    return null;
}
export async function autoFill(schoolId, schoolYearId, authToken, options) {
    const warnings = [];
    const previewOnly = options?.previewOnly ?? false;
    // ─── Step 1: Build resolved-pair set + capacity used per faculty ───────────
    const existingOwnerships = await prisma.subjectSectionOwnership.findMany({
        where: { schoolId },
        select: {
            subjectId: true,
            sectionId: true,
            facultyId: true,
            facultySubject: {
                select: {
                    subject: { select: { minMinutesPerWeek: true } },
                },
            },
        },
    });
    const resolvedPairs = new Set(existingOwnerships.map((o) => `${o.subjectId}:${o.sectionId}`));
    const preserved = resolvedPairs.size;
    const capacityUsed = new Map(); // facultyId → minutes used
    for (const o of existingOwnerships) {
        const mins = o.facultySubject.subject.minMinutesPerWeek;
        capacityUsed.set(o.facultyId, (capacityUsed.get(o.facultyId) ?? 0) + mins);
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
            gradeLevels: true,
            programScopes: true,
            minMinutesPerWeek: true,
            allowedSpecializations: true,
            modularGroupId: true,
            modularOrder: true,
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
            specialization: true,
            department: true,
            canTeachOutsideDepartment: true,
            maxHoursPerWeek: true,
        },
    });
    const aliasEntries = await prisma.specializationAlias.findMany({
        where: { schoolId },
        select: { alias: true, canonical: true },
    });
    const aliasMap = new Map();
    for (const entry of aliasEntries) {
        const aliasKey = normalizeKey(entry.alias);
        const canonicalKey = normalizeKey(entry.canonical);
        if (!aliasKey || !canonicalKey)
            continue;
        const subjectSet = aliasMap.get(aliasKey) ?? new Set();
        subjectSet.add(canonicalKey);
        aliasMap.set(aliasKey, subjectSet);
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
        // Update capacity
        const subj = subjectMap.get(subjectId);
        capacityUsed.set(facultyId, (capacityUsed.get(facultyId) ?? 0) + subj.minMinutesPerWeek);
    }
    function findBestCandidate(subjectRow, _sectionId) {
        const candidates = [];
        for (const f of faculty) {
            // Cap check
            const used = capacityUsed.get(f.id) ?? 0;
            const limit = maxMinutes(f);
            if (used + subjectRow.minMinutesPerWeek > limit)
                continue;
            const tier = resolveQualificationTier(f, subjectRow, aliasMap);
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
                warnings.push(`Lacking Faculty: no Tier 1 qualified teacher for ${subjectRow.name} (${pair.sectionName}).`);
                const fallbackDepartment = subjectRow.allowedSpecializations?.[0] ?? subjectRow.modularGroupId ?? 'GENERAL';
                const shortageKey = formatDepartmentLabel(fallbackDepartment);
                unresolvedByDepartment.set(shortageKey, (unresolvedByDepartment.get(shortageKey) ?? 0) + 1);
                const existing = shortageSections.get(shortageKey) ?? [];
                existing.push({
                    subjectId: subjectRow.id,
                    subjectCode: subjectRow.code,
                    subjectName: subjectRow.name,
                    sectionId: pair.sectionId,
                    sectionName: pair.sectionName,
                    programType: pair.sectionProgramType,
                });
                shortageSections.set(shortageKey, existing);
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
                    let newSections;
                    if (existingFs) {
                        // Merge new sections into existing record
                        newSections = Array.from(new Set([...existingFs.sectionIds, ...sectionIdsArr]));
                        const newGradeLevels = Array.from(new Set([...existingFs.gradeLevels, ...gradeLevels]));
                        await tx.facultySubject.update({
                            where: { id: existingFs.id },
                            data: { sectionIds: newSections, gradeLevels: newGradeLevels },
                        });
                        facultySubjectId = existingFs.id;
                        // Only the truly new sections need ownership rows
                        newSections = sectionIdsArr.filter((sid) => !existingFs.sectionIds.includes(sid));
                    }
                    else {
                        const fs = await tx.facultySubject.create({
                            data: {
                                facultyId,
                                subjectId,
                                schoolId,
                                gradeLevels,
                                sectionIds: sectionIdsArr,
                                assignedBy: 0, // system
                            },
                            select: { id: true },
                        });
                        facultySubjectId = fs.id;
                        newSections = sectionIdsArr;
                    }
                    // Create SubjectSectionOwnership rows for new sections only
                    // skipDuplicates handles any race conditions
                    if (newSections.length > 0) {
                        await tx.subjectSectionOwnership.createMany({
                            data: newSections.map((sectionId) => ({
                                schoolId,
                                facultySubjectId,
                                facultyId,
                                subjectId,
                                sectionId,
                                assignedAt: new Date(),
                            })),
                            skipDuplicates: true,
                        });
                        created += newSections.length;
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