import { prisma } from '../lib/prisma.js';
import { fetchSectionsForRuntimeControls } from './section.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { matchesSubjectOwnershipDepartment, resolveRotationTermMetadata, normalizeDepartmentCode, resolveSubjectAllowedOwnerDepartments, resolveSubjectOutputLabel, resolveSubjectRotationFamily, } from './subject-ownership.service.js';
import { buildSectionRosterIndex, deriveGradeLevelsFromSectionIds, normalizeIncomingAssignmentScope, normalizeStoredAssignmentScope, } from './faculty-assignment-scope.service.js';
import { getOrCreatePolicy } from './scheduling-policy.service.js';
function roundHours(minutes) {
    return Math.round((minutes / 60) * 10) / 10;
}
function normalizeRotationFamily(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
}
function resolveLoadRotationFamily(subject) {
    const explicitFamily = normalizeRotationFamily(subject.rotationFamily);
    if (explicitFamily) {
        return explicitFamily;
    }
    return normalizeRotationFamily(resolveSubjectRotationFamily(subject.code, null));
}
function resolveLoadRotationTermMetadata(subject) {
    const rotationFamily = resolveLoadRotationFamily(subject);
    return resolveRotationTermMetadata({
        subjectCode: subject.code,
        rotationFamily,
        modularGroupId: subject.modularGroupId ?? null,
        modularOrder: subject.modularOrder ?? null,
        termGroupId: subject.termGroupId ?? null,
        termCount: subject.termCount ?? null,
    });
}
function normalizeRotationTermLaneKey(termRank) {
    return Number.isInteger(termRank) && Number(termRank) > 0 ? Number(termRank) : 0;
}
function buildRotationConcurrentLaneId(rotationFamily, termRank, unit) {
    return `family:${rotationFamily}:term:${normalizeRotationTermLaneKey(termRank)}:${unit}`;
}
function resolveDominantRotationBucket(termBuckets) {
    if (termBuckets.length === 0) {
        return null;
    }
    return [...termBuckets].sort((left, right) => {
        if (right.creditedMinutes !== left.creditedMinutes) {
            return right.creditedMinutes - left.creditedMinutes;
        }
        const leftRank = normalizeRotationTermLaneKey(left.termRank);
        const rightRank = normalizeRotationTermLaneKey(right.termRank);
        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }
        return (left.termLabel ?? '').localeCompare(right.termLabel ?? '');
    })[0] ?? null;
}
function uniquePositiveUnits(values) {
    return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((left, right) => left - right);
}
function computeTeachingLoadMinuteComputation(assignments, formula) {
    let rawMinutes = 0;
    const laneMinutes = new Map();
    const rotationFamilyStats = new Map();
    for (const assignment of assignments) {
        const units = uniquePositiveUnits(formula === 'section' ? assignment.sectionIds : assignment.gradeLevels);
        if (units.length === 0)
            continue;
        const perUnitMinutes = Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0);
        if (perUnitMinutes <= 0)
            continue;
        const subjectId = Number(assignment.subject.id);
        const normalizedSubjectId = Number.isInteger(subjectId) && subjectId > 0 ? subjectId : null;
        const subjectCode = (assignment.subject.code ?? '').trim().toUpperCase();
        const rotationFamily = resolveLoadRotationFamily(assignment.subject);
        const rotationTermMetadata = resolveLoadRotationTermMetadata(assignment.subject);
        for (const unit of units) {
            rawMinutes += perUnitMinutes;
            const subjectLaneIdentity = normalizedSubjectId ?? (subjectCode.length > 0 ? subjectCode : 'unknown');
            const laneKey = rotationFamily
                ? buildRotationConcurrentLaneId(rotationFamily, rotationTermMetadata.termRank, unit)
                : `subject:${subjectLaneIdentity}:${unit}`;
            const currentLaneMinutes = laneMinutes.get(laneKey) ?? 0;
            if (perUnitMinutes > currentLaneMinutes) {
                laneMinutes.set(laneKey, perUnitMinutes);
            }
            if (rotationFamily) {
                const familyEntry = rotationFamilyStats.get(rotationFamily) ?? {
                    rawMinutes: 0,
                    termBuckets: new Map(),
                };
                familyEntry.rawMinutes += perUnitMinutes;
                const termKey = normalizeRotationTermLaneKey(rotationTermMetadata.termRank);
                const termBucket = familyEntry.termBuckets.get(termKey) ?? {
                    termRank: rotationTermMetadata.termRank,
                    termLabel: rotationTermMetadata.termLabel,
                    termGroupId: rotationTermMetadata.termGroupId,
                    termCount: rotationTermMetadata.termCount,
                    laneMinutesByUnit: new Map(),
                    subjectCodes: new Set(),
                    subjectIds: new Set(),
                };
                if (termBucket.termLabel === null && rotationTermMetadata.termLabel) {
                    termBucket.termLabel = rotationTermMetadata.termLabel;
                }
                if (termBucket.termGroupId === null && rotationTermMetadata.termGroupId) {
                    termBucket.termGroupId = rotationTermMetadata.termGroupId;
                }
                if (termBucket.termCount === null && rotationTermMetadata.termCount) {
                    termBucket.termCount = rotationTermMetadata.termCount;
                }
                if (termBucket.termRank === null && rotationTermMetadata.termRank !== null) {
                    termBucket.termRank = rotationTermMetadata.termRank;
                }
                const termLaneMinutes = termBucket.laneMinutesByUnit.get(unit) ?? 0;
                if (perUnitMinutes > termLaneMinutes) {
                    termBucket.laneMinutesByUnit.set(unit, perUnitMinutes);
                }
                if (subjectCode.length > 0) {
                    termBucket.subjectCodes.add(subjectCode);
                }
                if (normalizedSubjectId) {
                    termBucket.subjectIds.add(normalizedSubjectId);
                }
                familyEntry.termBuckets.set(termKey, termBucket);
                rotationFamilyStats.set(rotationFamily, familyEntry);
            }
        }
    }
    const creditedMinutes = Array.from(laneMinutes.values()).reduce((sum, value) => sum + value, 0);
    const rotationFamilies = Array.from(rotationFamilyStats.entries())
        .map(([family, value]) => {
        const termBuckets = Array.from(value.termBuckets.values())
            .map((bucket) => ({
            termRank: bucket.termRank,
            termLabel: bucket.termLabel,
            termGroupId: bucket.termGroupId,
            termCount: bucket.termCount,
            creditedMinutes: Array.from(bucket.laneMinutesByUnit.values()).reduce((sum, laneValue) => sum + laneValue, 0),
            unitCount: bucket.laneMinutesByUnit.size,
            subjectCodes: Array.from(bucket.subjectCodes).sort((left, right) => left.localeCompare(right)),
            subjectIds: Array.from(bucket.subjectIds).sort((left, right) => left - right),
        }))
            .sort((left, right) => {
            const leftRank = normalizeRotationTermLaneKey(left.termRank);
            const rightRank = normalizeRotationTermLaneKey(right.termRank);
            if (leftRank !== rightRank) {
                return leftRank - rightRank;
            }
            if (right.creditedMinutes !== left.creditedMinutes) {
                return right.creditedMinutes - left.creditedMinutes;
            }
            return (left.termLabel ?? '').localeCompare(right.termLabel ?? '');
        });
        const credited = termBuckets.reduce((sum, bucket) => sum + bucket.creditedMinutes, 0);
        const dominantTermBucket = resolveDominantRotationBucket(termBuckets);
        const allSubjectCodes = new Set();
        const allSubjectIds = new Set();
        for (const bucket of termBuckets) {
            for (const code of bucket.subjectCodes) {
                allSubjectCodes.add(code);
            }
            for (const id of bucket.subjectIds) {
                allSubjectIds.add(id);
            }
        }
        return {
            family,
            rawMinutes: value.rawMinutes,
            creditedMinutes: credited,
            overcountMinutes: Math.max(0, value.rawMinutes - credited),
            unitCount: termBuckets.reduce((sum, bucket) => sum + bucket.unitCount, 0),
            dominantTermRank: dominantTermBucket?.termRank ?? null,
            dominantTermLabel: dominantTermBucket?.termLabel ?? null,
            termGroupId: dominantTermBucket?.termGroupId ?? null,
            termCount: dominantTermBucket?.termCount ?? null,
            termBuckets,
            subjectCodes: Array.from(allSubjectCodes).sort((left, right) => left.localeCompare(right)),
            subjectIds: Array.from(allSubjectIds).sort((left, right) => left - right),
        };
    })
        .sort((left, right) => {
        if (right.overcountMinutes !== left.overcountMinutes) {
            return right.overcountMinutes - left.overcountMinutes;
        }
        return left.family.localeCompare(right.family);
    });
    return {
        rawMinutes,
        creditedMinutes,
        rotationFamilies,
    };
}
export function computeTeachingLoadMinutes(assignments, formula) {
    return computeTeachingLoadMinuteComputation(assignments, formula).creditedMinutes;
}
export function detectDuplicateOwnershipTuples(assignments) {
    const ownership = new Map();
    for (const assignment of assignments) {
        for (const sectionId of assignment.sectionIds) {
            const key = `${assignment.subjectId}:${sectionId}`;
            const existing = ownership.get(key) ??
                {
                    subjectId: assignment.subjectId,
                    sectionId,
                    owners: new Map(),
                };
            existing.owners.set(assignment.facultyId, assignment.facultyName);
            ownership.set(key, existing);
        }
    }
    return Array.from(ownership.values())
        .filter((entry) => entry.owners.size > 1)
        .map((entry) => ({
        subjectId: entry.subjectId,
        sectionId: entry.sectionId,
        owners: Array.from(entry.owners.entries())
            .map(([facultyId, facultyName]) => ({ facultyId, facultyName }))
            .sort((a, b) => a.facultyId - b.facultyId),
    }))
        .sort((a, b) => {
        if (a.subjectId !== b.subjectId) {
            return a.subjectId - b.subjectId;
        }
        return a.sectionId - b.sectionId;
    });
}
export function buildOwnershipConflictDetails(conflicts, ownerNamesByFacultyId) {
    return conflicts.map((conflict) => ({
        subjectId: conflict.subjectId,
        sectionId: conflict.sectionId,
        ownerFacultyId: conflict.facultyId,
        ownerFacultyName: ownerNamesByFacultyId.get(conflict.facultyId) ?? `Faculty #${conflict.facultyId}`,
        subjectName: conflict.subjectName,
        sectionName: conflict.sectionName,
    }));
}
export function buildDuplicateOwnershipBlockingResult(conflicts, ownerNamesByFacultyId) {
    if (conflicts.length === 0) {
        return null;
    }
    const details = buildOwnershipConflictDetails(conflicts, ownerNamesByFacultyId);
    return buildServiceError('DUPLICATE_SECTION_OWNERSHIP', `One or more subject-section pairs are already assigned to another faculty member. ${details
        .slice(0, 3)
        .map((conflict) => `${conflict.ownerFacultyName} already owns ${conflict.subjectName || `subject ${conflict.subjectId}`} / ${conflict.sectionName || `section ${conflict.sectionId}`}`)
        .join('; ')}${details.length > 3 ? ` (+${details.length - 3} more)` : ''}`, { conflicts: details });
}
function formatFacultyName(firstName, lastName) {
    return `${lastName}, ${firstName}`;
}
function normalizeProgramType(value) {
    return (value ?? 'REGULAR').trim().toUpperCase();
}
function normalizeGradeLevel(value) {
    if (!Number.isFinite(value))
        return value;
    if (value >= 100) {
        const normalized = value % 100;
        if (normalized >= 1 && normalized <= 12)
            return normalized;
    }
    return value;
}
function gradeLevelMatches(gradeLevels, sectionGradeLevel) {
    if (!Array.isArray(gradeLevels) || gradeLevels.length === 0)
        return true;
    const normalizedSectionGrade = normalizeGradeLevel(sectionGradeLevel);
    return gradeLevels.some((gradeLevel) => gradeLevel === sectionGradeLevel || normalizeGradeLevel(gradeLevel) === normalizedSectionGrade);
}
function isProgramScopeCompatible(scopes, sectionProgramType) {
    if (!scopes || scopes.length === 0)
        return true;
    const normalizedProgramType = normalizeProgramType(sectionProgramType);
    return scopes.some((scope) => normalizeProgramType(scope) === normalizedProgramType);
}
function getRelevantSectionIdsForSubject(subject, sections) {
    return sections
        .filter((section) => {
        const gradeAllowed = gradeLevelMatches(subject.gradeLevels, section.gradeLevel);
        if (!gradeAllowed)
            return false;
        return isProgramScopeCompatible(subject.programScopes, section.programType);
    })
        .map((section) => section.id);
}
async function fetchSectionsForCoverage(schoolId, schoolYearId, authToken) {
    return fetchSectionsForRuntimeControls(schoolId, schoolYearId, {
        authToken,
        preferLocalEvidenceFirst: true,
    });
}
async function loadCoverageContext(schoolId, schoolYearId, authToken) {
    const [sectionResult, subjects, ownerships, facultyIndex] = await Promise.all([
        fetchSectionsForCoverage(schoolId, schoolYearId, authToken),
        prisma.subject.findMany({
            where: { schoolId, isActive: true },
            select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                ownerDepartment: true,
                requiredFeatures: true,
                gradeLevels: true,
                programScopes: true,
            },
            orderBy: { code: 'asc' },
        }),
        prisma.subjectSectionOwnership.findMany({
            where: { schoolId },
            select: { subjectId: true, sectionId: true, facultyId: true },
        }),
        prisma.facultyMirror.findMany({
            where: { schoolId, isStale: false, isActiveForScheduling: true },
            select: { id: true, isPlaceholder: true },
        }),
    ]);
    const sections = [];
    for (const grade of sectionResult.gradeLevels) {
        for (const section of grade.sections) {
            if (!section.id || section.id <= 0)
                continue;
            sections.push({
                id: section.id,
                name: section.name,
                gradeLevel: grade.displayOrder,
                programType: section.programType ?? 'REGULAR',
            });
        }
    }
    const activeFacultyIdSet = new Set(facultyIndex.map((entry) => entry.id));
    const placeholderByFacultyId = new Map(facultyIndex.map((entry) => [entry.id, entry.isPlaceholder]));
    const activeOwnerships = ownerships.filter((entry) => activeFacultyIdSet.has(entry.facultyId));
    return {
        subjects,
        sections,
        ownerships: activeOwnerships,
        placeholderByFacultyId,
    };
}
export async function getActiveSubjectCoverageSummary(schoolId, schoolYearId, authToken) {
    const context = await loadCoverageContext(schoolId, schoolYearId, authToken);
    const rows = context.subjects.map((subject) => {
        const relevantSectionIds = getRelevantSectionIdsForSubject(subject, context.sections);
        const relevantSectionSet = new Set(relevantSectionIds);
        const subjectOwnership = context.ownerships.filter((entry) => entry.subjectId === subject.id && relevantSectionSet.has(entry.sectionId));
        const ownedSectionIds = new Set(subjectOwnership.map((entry) => entry.sectionId));
        const placeholderOwnership = subjectOwnership.filter((entry) => context.placeholderByFacultyId.get(entry.facultyId) === true);
        const placeholderSectionIds = new Set(placeholderOwnership.map((entry) => entry.sectionId));
        const ownedByPlaceholderCount = placeholderSectionIds.size;
        const ownedByRealFacultyCount = Math.max(0, ownedSectionIds.size - ownedByPlaceholderCount);
        const uncoveredSectionCount = Math.max(0, relevantSectionIds.length - ownedSectionIds.size);
        const coveragePercent = relevantSectionIds.length > 0
            ? Math.round((ownedSectionIds.size / relevantSectionIds.length) * 10000) / 100
            : 100;
        const status = coveredStatus(ownedSectionIds.size, relevantSectionIds.length);
        return {
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            isActive: subject.isActive,
            relevantSectionCount: relevantSectionIds.length,
            ownedSectionCount: ownedSectionIds.size,
            ownedByPlaceholderCount,
            ownedByRealFacultyCount,
            uncoveredSectionCount,
            coveragePercent,
            status,
            placeholderFacultyIds: [...new Set(placeholderOwnership.map((entry) => entry.facultyId))].sort((a, b) => a - b),
        };
    });
    const sortedRows = [...rows].sort((left, right) => {
        if (left.uncoveredSectionCount !== right.uncoveredSectionCount) {
            return right.uncoveredSectionCount - left.uncoveredSectionCount;
        }
        return left.subjectCode.localeCompare(right.subjectCode);
    });
    return {
        rows: sortedRows,
        zeroCoverageSubjectCodes: sortedRows.filter((row) => row.status === 'ZERO' && row.relevantSectionCount > 0).map((row) => row.subjectCode),
        partiallyCoveredSubjectCodes: sortedRows.filter((row) => row.status === 'PARTIAL').map((row) => row.subjectCode),
        fullyCoveredSubjectCodes: sortedRows.filter((row) => row.status === 'FULL').map((row) => row.subjectCode),
    };
}
export async function getSectionAssignedClassesIndex(schoolId, schoolYearId, authToken, options) {
    const includeDiagnostics = options?.includeDiagnostics === true;
    const sectionFilter = options?.sectionIds && options.sectionIds.length > 0
        ? new Set(options.sectionIds.filter((value) => Number.isInteger(value) && value > 0))
        : null;
    const rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
    const sectionScope = Array.from(rosterIndex.sectionMap.values())
        .filter((section) => (sectionFilter ? sectionFilter.has(section.id) : true))
        .map((section) => ({
        id: section.id,
        name: section.name,
        gradeLevel: section.displayOrder,
        programType: section.programType ?? 'REGULAR',
    }))
        .sort((left, right) => {
        if (left.gradeLevel !== right.gradeLevel)
            return left.gradeLevel - right.gradeLevel;
        return left.name.localeCompare(right.name) || left.id - right.id;
    });
    if (sectionScope.length === 0) {
        return {
            schoolId,
            schoolYearId,
            sections: [],
            fetchedAt: new Date().toISOString(),
        };
    }
    const sectionIds = sectionScope.map((section) => section.id);
    const sectionById = new Map(sectionScope.map((section) => [section.id, section]));
    const subjects = await prisma.subject.findMany({
        where: {
            schoolId,
            isActive: true,
            code: { not: HG_SUBJECT_CODE },
        },
        select: {
            id: true,
            code: true,
            name: true,
            outputLabel: true,
            modularGroupId: true,
            modularOrder: true,
            termGroupId: true,
            termCount: true,
            minMinutesPerWeek: true,
            rotationFamily: true,
            gradeLevels: true,
            programScopes: true,
        },
        orderBy: { code: 'asc' },
    });
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const subjectIds = subjects.map((subject) => subject.id);
    if (subjectIds.length === 0) {
        return {
            schoolId,
            schoolYearId,
            sections: sectionScope.map((section) => ({
                sectionId: section.id,
                sectionName: section.name,
                gradeLevel: section.gradeLevel,
                programType: section.programType,
                schoolYearId,
                classes: [],
                totals: {
                    assignedClassCount: 0,
                    rotationFamilyClassCount: 0,
                    unassignedClassCount: 0,
                },
                ...(includeDiagnostics
                    ? { staleOwnership: [], unassignedExpectedClasses: [] }
                    : {}),
            })),
            fetchedAt: new Date().toISOString(),
        };
    }
    const expectedSubjectIdsBySection = new Map();
    for (const section of sectionScope) {
        expectedSubjectIdsBySection.set(section.id, new Set());
    }
    for (const subject of subjects) {
        const relevantSectionIds = getRelevantSectionIdsForSubject(subject, sectionScope);
        for (const sectionId of relevantSectionIds) {
            expectedSubjectIdsBySection.get(sectionId)?.add(subject.id);
        }
    }
    const ownershipRows = await prisma.subjectSectionOwnership.findMany({
        where: {
            schoolId,
            sectionId: { in: sectionIds },
            subjectId: { in: subjectIds },
        },
        select: {
            subjectId: true,
            sectionId: true,
            facultyId: true,
            specializationCode: true,
            specializationLabel: true,
        },
    });
    const ownershipFacultyIds = Array.from(new Set(ownershipRows.map((row) => row.facultyId)));
    const facultyById = ownershipFacultyIds.length > 0
        ? await prisma.facultyMirror.findMany({
            where: { id: { in: ownershipFacultyIds } },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                department: true,
                specialization: true,
                isPlaceholder: true,
                isStale: true,
                isActiveForScheduling: true,
            },
        })
        : [];
    const facultyIndex = new Map(facultyById.map((row) => [row.id, row]));
    const classesBySection = new Map();
    const staleOwnershipBySection = new Map();
    const assignedSubjectIdsBySection = new Map();
    for (const section of sectionScope) {
        classesBySection.set(section.id, []);
        staleOwnershipBySection.set(section.id, []);
        assignedSubjectIdsBySection.set(section.id, new Set());
    }
    for (const row of ownershipRows) {
        const section = sectionById.get(row.sectionId);
        const subject = subjectById.get(row.subjectId);
        const faculty = facultyIndex.get(row.facultyId);
        if (!section || !subject || !faculty) {
            continue;
        }
        const isEligibleActiveOwner = faculty.isActiveForScheduling === true && faculty.isStale !== true;
        const isSyntheticOwner = faculty.isPlaceholder === true;
        if (includeDiagnostics && (!isEligibleActiveOwner || faculty.isStale === true)) {
            staleOwnershipBySection.get(section.id)?.push({
                subjectId: subject.id,
                subjectCode: subject.code,
                subjectName: subject.name,
                sectionId: section.id,
                facultyId: faculty.id,
                facultyName: formatFacultyName(faculty.firstName, faculty.lastName),
                reason: faculty.isStale === true ? 'STALE_OWNERSHIP' : 'INACTIVE_OWNERSHIP',
            });
        }
        if (!isEligibleActiveOwner || isSyntheticOwner) {
            continue;
        }
        const classes = classesBySection.get(section.id);
        if (!classes) {
            continue;
        }
        const rotationFamily = normalizeRotationFamily(subject.rotationFamily) ??
            normalizeRotationFamily(resolveSubjectRotationFamily(subject.code, subject.modularGroupId ?? null));
        const rotationTermMetadata = resolveRotationTermMetadata({
            subjectCode: subject.code,
            rotationFamily,
            modularGroupId: subject.modularGroupId ?? null,
            modularOrder: subject.modularOrder ?? null,
            termGroupId: subject.termGroupId ?? null,
            termCount: subject.termCount ?? null,
        });
        classes.push({
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            subjectDisplayLabel: subject.outputLabel?.trim() ||
                resolveSubjectOutputLabel(subject.code, subject.name, subject.modularGroupId ?? null),
            minMinutesPerWeek: subject.minMinutesPerWeek,
            rotationFamily,
            rotationTermRank: rotationTermMetadata.termRank,
            rotationTermLabel: rotationTermMetadata.termLabel,
            rotationTermGroupId: rotationTermMetadata.termGroupId,
            rotationTermCount: rotationTermMetadata.termCount,
            facultyId: faculty.id,
            facultyName: formatFacultyName(faculty.firstName, faculty.lastName),
            facultyDepartment: faculty.department,
            facultySpecialization: faculty.specialization,
            assignmentKind: 'REAL_OWNERSHIP',
            specializationCode: row.specializationCode ?? null,
            specializationLabel: row.specializationLabel ?? null,
        });
        assignedSubjectIdsBySection.get(section.id)?.add(subject.id);
    }
    const sections = sectionScope.map((section) => {
        const sectionClasses = classesBySection.get(section.id) ?? [];
        const sortedClasses = sectionClasses.sort((left, right) => {
            if (left.subjectCode !== right.subjectCode)
                return left.subjectCode.localeCompare(right.subjectCode);
            return left.facultyName.localeCompare(right.facultyName);
        });
        const expectedSubjectIds = expectedSubjectIdsBySection.get(section.id) ?? new Set();
        const assignedSubjectIds = assignedSubjectIdsBySection.get(section.id) ?? new Set();
        const unassignedExpectedSubjects = Array.from(expectedSubjectIds)
            .filter((subjectId) => !assignedSubjectIds.has(subjectId))
            .map((subjectId) => subjectById.get(subjectId))
            .filter((subject) => subject != null)
            .map((subject) => ({
            ...(function resolveUnassignedMetadata() {
                const rotationFamily = normalizeRotationFamily(subject.rotationFamily) ??
                    normalizeRotationFamily(resolveSubjectRotationFamily(subject.code, subject.modularGroupId ?? null));
                const termMetadata = resolveRotationTermMetadata({
                    subjectCode: subject.code,
                    rotationFamily,
                    modularGroupId: subject.modularGroupId ?? null,
                    modularOrder: subject.modularOrder ?? null,
                    termGroupId: subject.termGroupId ?? null,
                    termCount: subject.termCount ?? null,
                });
                return {
                    rotationFamily,
                    rotationTermRank: termMetadata.termRank,
                    rotationTermLabel: termMetadata.termLabel,
                    rotationTermGroupId: termMetadata.termGroupId,
                    rotationTermCount: termMetadata.termCount,
                };
            })(),
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            subjectDisplayLabel: subject.outputLabel?.trim() ||
                resolveSubjectOutputLabel(subject.code, subject.name, subject.modularGroupId ?? null),
            minMinutesPerWeek: subject.minMinutesPerWeek,
        }))
            .sort((left, right) => left.subjectCode.localeCompare(right.subjectCode));
        const totals = {
            assignedClassCount: sortedClasses.length,
            rotationFamilyClassCount: sortedClasses.filter((entry) => Boolean(entry.rotationFamily)).length,
            unassignedClassCount: unassignedExpectedSubjects.length,
        };
        const sectionResult = {
            sectionId: section.id,
            sectionName: section.name,
            gradeLevel: section.gradeLevel,
            programType: section.programType,
            schoolYearId,
            classes: sortedClasses,
            totals,
        };
        if (includeDiagnostics) {
            sectionResult.staleOwnership = (staleOwnershipBySection.get(section.id) ?? []).sort((left, right) => {
                if (left.subjectCode !== right.subjectCode)
                    return left.subjectCode.localeCompare(right.subjectCode);
                return left.facultyName.localeCompare(right.facultyName);
            });
            sectionResult.unassignedExpectedClasses = unassignedExpectedSubjects;
        }
        return sectionResult;
    });
    return {
        schoolId,
        schoolYearId,
        sections,
        fetchedAt: new Date().toISOString(),
    };
}
export async function getSectionAssignedClasses(sectionId, schoolYearId, authToken, options) {
    const resolvedSchoolId = options?.schoolId ?? (await prisma.sectionMirror.findFirst({
        where: {
            externalId: sectionId,
            schoolYearId,
            isActiveForScheduling: true,
        },
        select: { schoolId: true },
    }))?.schoolId;
    if (!resolvedSchoolId) {
        return null;
    }
    const result = await getSectionAssignedClassesIndex(resolvedSchoolId, schoolYearId, authToken, {
        includeDiagnostics: options?.includeDiagnostics,
        sectionIds: [sectionId],
    });
    return result.sections[0] ?? null;
}
function coveredStatus(ownedCount, relevantCount) {
    if (relevantCount === 0 || ownedCount >= relevantCount)
        return 'FULL';
    if (ownedCount <= 0)
        return 'ZERO';
    return 'PARTIAL';
}
async function ensureSubjectPlaceholderFaculty(tx, schoolId, subjectCode) {
    const firstName = 'Teacher X';
    const lastName = subjectCode;
    const existing = await tx.facultyMirror.findFirst({
        where: {
            schoolId,
            isPlaceholder: true,
            firstName,
            lastName,
            isStale: false,
        },
        select: { id: true },
    });
    if (existing) {
        return { facultyId: existing.id, created: false };
    }
    const minExternal = await tx.facultyMirror.aggregate({
        where: { schoolId },
        _min: { externalId: true },
    });
    const nextExternalId = minExternal._min.externalId != null
        ? Math.min(minExternal._min.externalId - 1, -1)
        : -1;
    const created = await tx.facultyMirror.create({
        data: {
            schoolId,
            externalId: nextExternalId,
            firstName,
            lastName,
            department: 'PLACEHOLDER',
            specialization: subjectCode,
            employmentStatus: 'PLACEHOLDER',
            isPlaceholder: true,
            isActiveForScheduling: true,
            canTeachOutsideDepartment: true,
            maxHoursPerWeek: 30,
            ancillaryLoadSource: 'NONE',
            localNotes: `Auto-created coverage placeholder for ${subjectCode}`,
            isStale: false,
        },
        select: { id: true },
    });
    return { facultyId: created.id, created: true };
}
export async function repairActiveSubjectCoverageWithPlaceholders(input) {
    const apply = input.apply === true;
    const before = await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken);
    const requested = input.subjectCodes?.length
        ? new Set(input.subjectCodes.map((code) => code.trim().toUpperCase()))
        : null;
    const context = await loadCoverageContext(input.schoolId, input.schoolYearId, input.authToken);
    const subjectsToRepair = context.subjects.filter((subject) => {
        if (requested && !requested.has(subject.code.toUpperCase()))
            return false;
        const beforeRow = before.rows.find((row) => row.subjectId === subject.id);
        return Boolean(beforeRow && beforeRow.uncoveredSectionCount > 0);
    });
    const createdPlaceholders = [];
    const reusedPlaceholders = [];
    let sectionsCoveredByPlaceholder = 0;
    let placeholderAssignmentsUpserted = 0;
    if (apply && subjectsToRepair.length > 0) {
        for (const subject of subjectsToRepair) {
            await prisma.$transaction(async (tx) => {
                const relevantSectionIds = getRelevantSectionIdsForSubject(subject, context.sections);
                if (relevantSectionIds.length === 0)
                    return;
                const existingOwnership = await tx.subjectSectionOwnership.findMany({
                    where: {
                        schoolId: input.schoolId,
                        subjectId: subject.id,
                        sectionId: { in: relevantSectionIds },
                    },
                    select: { sectionId: true },
                });
                const ownedSet = new Set(existingOwnership.map((row) => row.sectionId));
                const uncoveredSectionIds = relevantSectionIds.filter((sectionId) => !ownedSet.has(sectionId));
                if (uncoveredSectionIds.length === 0)
                    return;
                const placeholder = await ensureSubjectPlaceholderFaculty(tx, input.schoolId, subject.code);
                if (placeholder.created) {
                    createdPlaceholders.push({ facultyId: placeholder.facultyId, subjectCode: subject.code });
                }
                else {
                    reusedPlaceholders.push({ facultyId: placeholder.facultyId, subjectCode: subject.code });
                }
                const existingAssignment = await tx.facultySubject.findUnique({
                    where: { facultyId_subjectId: { facultyId: placeholder.facultyId, subjectId: subject.id } },
                    select: { id: true, sectionIds: true, gradeLevels: true },
                });
                const mergedSectionIds = existingAssignment
                    ? [...new Set([...existingAssignment.sectionIds, ...uncoveredSectionIds])].sort((a, b) => a - b)
                    : [...new Set(uncoveredSectionIds)].sort((a, b) => a - b);
                const gradeBySectionId = new Map(context.sections.map((section) => [section.id, section.gradeLevel]));
                const mergedGradeLevels = [...new Set(mergedSectionIds.map((sectionId) => gradeBySectionId.get(sectionId)).filter((value) => Number.isInteger(value)))].sort((a, b) => a - b);
                let facultySubjectId;
                if (!existingAssignment) {
                    const created = await tx.facultySubject.create({
                        data: {
                            facultyId: placeholder.facultyId,
                            subjectId: subject.id,
                            schoolId: input.schoolId,
                            gradeLevels: mergedGradeLevels,
                            sectionIds: mergedSectionIds,
                            assignedBy: input.assignedBy,
                        },
                        select: { id: true },
                    });
                    facultySubjectId = created.id;
                    placeholderAssignmentsUpserted += 1;
                }
                else {
                    await tx.facultySubject.update({
                        where: { id: existingAssignment.id },
                        data: {
                            sectionIds: mergedSectionIds,
                            gradeLevels: mergedGradeLevels,
                            assignedBy: input.assignedBy,
                        },
                    });
                    facultySubjectId = existingAssignment.id;
                }
                if (uncoveredSectionIds.length > 0) {
                    await tx.subjectSectionOwnership.createMany({
                        data: uncoveredSectionIds.map((sectionId) => ({
                            schoolId: input.schoolId,
                            facultySubjectId,
                            facultyId: placeholder.facultyId,
                            subjectId: subject.id,
                            sectionId,
                            assignedAt: new Date(),
                        })),
                    });
                    sectionsCoveredByPlaceholder += uncoveredSectionIds.length;
                }
            });
        }
    }
    const after = apply
        ? await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken)
        : before;
    const resolvedSubjectCodes = before.rows
        .filter((row) => row.uncoveredSectionCount > 0)
        .filter((row) => {
        const afterRow = after.rows.find((candidate) => candidate.subjectId === row.subjectId);
        return (afterRow?.uncoveredSectionCount ?? row.uncoveredSectionCount) === 0;
    })
        .map((row) => row.subjectCode);
    const stillUncoveredSubjectCodes = after.rows
        .filter((row) => row.uncoveredSectionCount > 0)
        .map((row) => row.subjectCode);
    return {
        applied: apply,
        before,
        after,
        createdPlaceholders,
        reusedPlaceholders,
        sectionsCoveredByPlaceholder,
        placeholderAssignmentsUpserted,
        resolvedSubjectCodes,
        stillUncoveredSubjectCodes,
    };
}
const DEFAULT_REAL_RECOVERY_SUBJECT_CODES = ['SCI_ES', 'TLE_FCS_EXP', 'SCI_CHEM', 'HG'];
const REAL_FACULTY_LOW_LOAD_THRESHOLD_HOURS = 3;
function normalizeRecoverySubjectCodes(subjectCodes) {
    if (!subjectCodes || subjectCodes.length === 0) {
        return DEFAULT_REAL_RECOVERY_SUBJECT_CODES;
    }
    return [...new Set(subjectCodes.map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0))];
}
function getRotationGateVerdict(family, facultyRows) {
    const matchingDetails = facultyRows
        .filter((row) => !row.isPlaceholder)
        .flatMap((row) => row.rotationFamilyLoadDetails ?? [])
        .filter((detail) => detail.family === family);
    const teacherCountWithFamilyLoad = matchingDetails.filter((detail) => detail.unitCount > 0).length;
    const teacherCountWithOvercountSignal = matchingDetails.filter((detail) => detail.overcountHours > 0).length;
    const sampleSubjectCodes = [...new Set(matchingDetails.flatMap((detail) => detail.subjectCodes))]
        .sort((left, right) => left.localeCompare(right))
        .slice(0, 12);
    const working = teacherCountWithFamilyLoad > 0
        && teacherCountWithOvercountSignal > 0
        && sampleSubjectCodes.length > 0;
    return {
        family,
        verdict: working ? 'WORKING' : 'NOT_WORKING',
        teacherCountWithFamilyLoad,
        teacherCountWithOvercountSignal,
        sampleSubjectCodes,
        reason: working
            ? 'Runtime load output shows lane-collapsed family overcount signals with real-teacher ownership.'
            : 'Runtime load output does not yet show sufficient family-level overcount/ownership evidence.',
    };
}
export async function previewOrApplyRealFacultyRecovery(input) {
    const apply = input.apply === true;
    const targetSubjectCodes = normalizeRecoverySubjectCodes(input.subjectCodes);
    const beforeCoverage = await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken);
    const beforeSummary = await getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken);
    const rosterIndex = await buildRosterIndex(input.schoolId, input.schoolYearId, input.authToken);
    const currentYearSectionIds = Array.from(rosterIndex.sectionMap.keys());
    const currentYearSectionIdSet = new Set(currentYearSectionIds);
    const sectionGradeMap = new Map(Array.from(rosterIndex.sectionMap.values()).map((section) => [section.id, section.displayOrder]));
    const [subjects, facultyRows, ownershipRows] = await Promise.all([
        prisma.subject.findMany({
            where: {
                schoolId: input.schoolId,
                isActive: true,
                code: { in: targetSubjectCodes },
            },
            select: {
                id: true,
                code: true,
                name: true,
                ownerDepartment: true,
                requiredFeatures: true,
                modularGroupId: true,
                modularOrder: true,
                termGroupId: true,
                termCount: true,
                rotationFamily: true,
                minMinutesPerWeek: true,
                allowedSpecializations: true,
                gradeLevels: true,
                programScopes: true,
            },
        }),
        prisma.facultyMirror.findMany({
            where: {
                schoolId: input.schoolId,
                isStale: false,
                isActiveForScheduling: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                department: true,
                specialization: true,
                canTeachOutsideDepartment: true,
                isPlaceholder: true,
                maxHoursPerWeek: true,
            },
        }),
        currentYearSectionIds.length > 0
            ? prisma.subjectSectionOwnership.findMany({
                where: {
                    schoolId: input.schoolId,
                    sectionId: { in: currentYearSectionIds },
                },
                select: {
                    id: true,
                    subjectId: true,
                    sectionId: true,
                    facultyId: true,
                    facultySubjectId: true,
                    facultySubject: {
                        select: {
                            assignedBy: true,
                            subject: {
                                select: {
                                    id: true,
                                    code: true,
                                    modularGroupId: true,
                                    modularOrder: true,
                                    termGroupId: true,
                                    termCount: true,
                                    rotationFamily: true,
                                    minMinutesPerWeek: true,
                                },
                            },
                        },
                    },
                },
            })
            : Promise.resolve([]),
    ]);
    const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
    const facultyById = new Map(facultyRows.map((member) => [member.id, member]));
    const targetSubjectIds = new Set(subjects.map((subject) => subject.id));
    const lanesByFaculty = new Map();
    const creditedMinutesByFaculty = new Map();
    for (const row of ownershipRows) {
        const perUnitMinutes = Math.max(0, Number(row.facultySubject.subject.minMinutesPerWeek) || 0);
        if (perUnitMinutes <= 0)
            continue;
        const family = resolveLoadRotationFamily({
            id: row.facultySubject.subject.id,
            code: row.facultySubject.subject.code,
            modularGroupId: row.facultySubject.subject.modularGroupId,
            modularOrder: row.facultySubject.subject.modularOrder,
            termGroupId: row.facultySubject.subject.termGroupId,
            termCount: row.facultySubject.subject.termCount,
            rotationFamily: row.facultySubject.subject.rotationFamily,
            minMinutesPerWeek: perUnitMinutes,
        });
        const termMetadata = resolveRotationTermMetadata({
            subjectCode: row.facultySubject.subject.code,
            rotationFamily: family,
            modularGroupId: row.facultySubject.subject.modularGroupId,
            modularOrder: row.facultySubject.subject.modularOrder,
            termGroupId: row.facultySubject.subject.termGroupId,
            termCount: row.facultySubject.subject.termCount,
        });
        const laneKey = family
            ? buildRotationConcurrentLaneId(family, termMetadata.termRank, row.sectionId)
            : `subject:${row.facultySubject.subject.id}:${row.sectionId}`;
        const lanes = lanesByFaculty.get(row.facultyId) ?? new Map();
        const currentLaneMinutes = lanes.get(laneKey) ?? 0;
        if (perUnitMinutes > currentLaneMinutes) {
            lanes.set(laneKey, perUnitMinutes);
            lanesByFaculty.set(row.facultyId, lanes);
        }
    }
    for (const [facultyId, lanes] of lanesByFaculty.entries()) {
        const minutes = Array.from(lanes.values()).reduce((sum, value) => sum + value, 0);
        creditedMinutesByFaculty.set(facultyId, minutes);
    }
    const plannedMoves = [];
    const blockers = [];
    const targetRows = ownershipRows
        .filter((row) => targetSubjectIds.has(row.subjectId))
        .filter((row) => currentYearSectionIdSet.has(row.sectionId));
    const ownedSectionBySubject = new Map();
    for (const row of targetRows) {
        const owned = ownedSectionBySubject.get(row.subjectId) ?? new Set();
        owned.add(row.sectionId);
        ownedSectionBySubject.set(row.subjectId, owned);
    }
    const pendingPairs = [];
    for (const row of targetRows) {
        if (facultyById.get(row.facultyId)?.isPlaceholder === true) {
            pendingPairs.push({
                mode: 'MOVE_PLACEHOLDER',
                ownershipId: row.id,
                subjectId: row.subjectId,
                sectionId: row.sectionId,
                fromFacultyId: row.facultyId,
            });
        }
    }
    for (const subject of subjects) {
        const relevantSectionIds = getRelevantSectionIdsForSubject(subject, Array.from(rosterIndex.sectionMap.values()).map((section) => ({
            id: section.id,
            gradeLevel: section.displayOrder,
            programType: section.programType ?? 'REGULAR',
        })));
        const owned = ownedSectionBySubject.get(subject.id) ?? new Set();
        const uncoveredSectionIds = relevantSectionIds.filter((sectionId) => !owned.has(sectionId));
        for (const sectionId of uncoveredSectionIds) {
            pendingPairs.push({
                mode: 'ASSIGN_UNCOVERED',
                ownershipId: null,
                subjectId: subject.id,
                sectionId,
                fromFacultyId: 0,
            });
        }
    }
    pendingPairs.sort((left, right) => {
        if (left.subjectId !== right.subjectId)
            return left.subjectId - right.subjectId;
        return left.sectionId - right.sectionId;
    });
    for (const pair of pendingPairs) {
        const subject = subjectById.get(pair.subjectId);
        if (!subject) {
            blockers.push({
                subjectCode: `SUBJECT_${pair.subjectId}`,
                sectionId: pair.sectionId,
                category: 'SUBJECT_CONTRACT_GAP',
                reason: 'Subject metadata is missing from active contract scope.',
            });
            continue;
        }
        const ownerDepartments = resolveSubjectAllowedOwnerDepartments(subject.ownerDepartment, subject.code, subject.name, subject.requiredFeatures);
        if (ownerDepartments.length === 0) {
            blockers.push({
                subjectCode: subject.code,
                sectionId: pair.sectionId,
                category: 'SUBJECT_CONTRACT_GAP',
                reason: `${subject.code} has no owner department contract configured for qualification matching.`,
            });
            continue;
        }
        const candidates = facultyRows
            .filter((member) => !member.isPlaceholder)
            .filter((member) => matchesSubjectOwnershipDepartment(member.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures)
            || member.canTeachOutsideDepartment)
            .sort((left, right) => {
            const leftMinutes = creditedMinutesByFaculty.get(left.id) ?? 0;
            const rightMinutes = creditedMinutesByFaculty.get(right.id) ?? 0;
            if (leftMinutes !== rightMinutes)
                return leftMinutes - rightMinutes;
            return left.id - right.id;
        });
        if (candidates.length === 0) {
            blockers.push({
                subjectCode: subject.code,
                sectionId: pair.sectionId,
                category: 'TRUE_DEPARTMENT_SHORTAGE',
                reason: `No active qualified real faculty found for ${subject.code}.`,
            });
            continue;
        }
        const family = resolveLoadRotationFamily({
            id: subject.id,
            code: subject.code,
            modularGroupId: subject.modularGroupId,
            modularOrder: subject.modularOrder,
            termGroupId: subject.termGroupId,
            termCount: subject.termCount,
            rotationFamily: subject.rotationFamily,
            minMinutesPerWeek: subject.minMinutesPerWeek,
        });
        const termMetadata = resolveRotationTermMetadata({
            subjectCode: subject.code,
            rotationFamily: family,
            modularGroupId: subject.modularGroupId,
            modularOrder: subject.modularOrder,
            termGroupId: subject.termGroupId,
            termCount: subject.termCount,
        });
        const laneKey = family
            ? buildRotationConcurrentLaneId(family, termMetadata.termRank, pair.sectionId)
            : `subject:${subject.id}:${pair.sectionId}`;
        const perUnitMinutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
        let selectedCandidate = null;
        let selectedDeltaMinutes = 0;
        for (const candidate of candidates) {
            const maxMinutes = Math.min(Math.max(0, Number(candidate.maxHoursPerWeek) || 0) * 60, 2400);
            const lanes = lanesByFaculty.get(candidate.id) ?? new Map();
            const currentLaneMinutes = lanes.get(laneKey) ?? 0;
            const deltaMinutes = Math.max(0, perUnitMinutes - currentLaneMinutes);
            const nextMinutes = (creditedMinutesByFaculty.get(candidate.id) ?? 0) + deltaMinutes;
            if (nextMinutes <= maxMinutes) {
                selectedCandidate = candidate;
                selectedDeltaMinutes = deltaMinutes;
                break;
            }
        }
        if (!selectedCandidate) {
            blockers.push({
                subjectCode: subject.code,
                sectionId: pair.sectionId,
                category: 'SKEWED_ASSIGNMENT_TOPOLOGY',
                reason: `Qualified faculty exist for ${subject.code}, but all are currently load-capped for this lane.`,
            });
            continue;
        }
        const selectedLanes = lanesByFaculty.get(selectedCandidate.id) ?? new Map();
        const currentLaneMinutes = selectedLanes.get(laneKey) ?? 0;
        if (perUnitMinutes > currentLaneMinutes) {
            selectedLanes.set(laneKey, perUnitMinutes);
        }
        lanesByFaculty.set(selectedCandidate.id, selectedLanes);
        creditedMinutesByFaculty.set(selectedCandidate.id, (creditedMinutesByFaculty.get(selectedCandidate.id) ?? 0) + selectedDeltaMinutes);
        plannedMoves.push({
            mode: pair.mode,
            ownershipId: pair.ownershipId,
            subjectId: pair.subjectId,
            subjectCode: subject.code,
            sectionId: pair.sectionId,
            fromFacultyId: pair.fromFacultyId,
            fromFacultyName: pair.fromFacultyId > 0
                ? formatFacultyName(facultyById.get(pair.fromFacultyId)?.firstName ?? 'Teacher', facultyById.get(pair.fromFacultyId)?.lastName ?? 'X')
                : 'UNASSIGNED',
            toFacultyId: selectedCandidate.id,
            toFacultyName: formatFacultyName(selectedCandidate.firstName, selectedCandidate.lastName),
            estimatedDeltaMinutes: selectedDeltaMinutes,
        });
    }
    let appliedMoves = 0;
    if (apply && plannedMoves.length > 0) {
        await prisma.$transaction(async (tx) => {
            const destinationFsByKey = new Map();
            const touchedPairs = new Set();
            for (const move of plannedMoves) {
                const destinationKey = `${move.toFacultyId}:${move.subjectId}`;
                let destinationFacultySubjectId = destinationFsByKey.get(destinationKey);
                if (!destinationFacultySubjectId) {
                    const existing = await tx.facultySubject.findUnique({
                        where: {
                            facultyId_subjectId: {
                                facultyId: move.toFacultyId,
                                subjectId: move.subjectId,
                            },
                        },
                        select: { id: true },
                    });
                    if (existing) {
                        destinationFacultySubjectId = existing.id;
                    }
                    else {
                        const created = await tx.facultySubject.create({
                            data: {
                                facultyId: move.toFacultyId,
                                subjectId: move.subjectId,
                                schoolId: input.schoolId,
                                gradeLevels: [],
                                sectionIds: [],
                                assignedBy: input.actorId,
                            },
                            select: { id: true },
                        });
                        destinationFacultySubjectId = created.id;
                    }
                    destinationFsByKey.set(destinationKey, destinationFacultySubjectId);
                }
                const subject = subjectById.get(move.subjectId);
                const destinationFaculty = facultyById.get(move.toFacultyId);
                const specializationIdentity = resolveAssignmentSpecializationIdentity({
                    subjectCode: subject?.code,
                    allowedSpecializations: subject?.allowedSpecializations,
                    facultySpecialization: destinationFaculty?.specialization,
                });
                if (move.ownershipId) {
                    await tx.subjectSectionOwnership.update({
                        where: { id: move.ownershipId },
                        data: {
                            facultyId: move.toFacultyId,
                            facultySubjectId: destinationFacultySubjectId,
                            specializationCode: specializationIdentity.specializationCode,
                            specializationLabel: specializationIdentity.specializationLabel,
                            assignedAt: new Date(),
                        },
                    });
                }
                else {
                    await tx.subjectSectionOwnership.create({
                        data: {
                            schoolId: input.schoolId,
                            facultySubjectId: destinationFacultySubjectId,
                            facultyId: move.toFacultyId,
                            subjectId: move.subjectId,
                            sectionId: move.sectionId,
                            specializationCode: specializationIdentity.specializationCode,
                            specializationLabel: specializationIdentity.specializationLabel,
                            assignedAt: new Date(),
                        },
                    });
                }
                touchedPairs.add(`${move.fromFacultyId}:${move.subjectId}`);
                touchedPairs.add(`${move.toFacultyId}:${move.subjectId}`);
                appliedMoves += 1;
            }
            for (const key of touchedPairs) {
                const [facultyIdRaw, subjectIdRaw] = key.split(':');
                const facultyId = Number(facultyIdRaw);
                const subjectId = Number(subjectIdRaw);
                if (!Number.isFinite(facultyId) || !Number.isFinite(subjectId))
                    continue;
                const facultySubject = await tx.facultySubject.findUnique({
                    where: { facultyId_subjectId: { facultyId, subjectId } },
                    select: { id: true, assignedBy: true },
                });
                if (!facultySubject)
                    continue;
                const ownedRows = await tx.subjectSectionOwnership.findMany({
                    where: {
                        schoolId: input.schoolId,
                        facultyId,
                        subjectId,
                    },
                    select: { sectionId: true },
                });
                const nextSectionIds = [...new Set(ownedRows.map((row) => row.sectionId))].sort((left, right) => left - right);
                if (nextSectionIds.length === 0) {
                    if (facultySubject.assignedBy === 0) {
                        await tx.facultySubject.delete({ where: { id: facultySubject.id } });
                    }
                    continue;
                }
                const nextGradeLevels = deriveGradeLevelsFromSectionIds(nextSectionIds, sectionGradeMap);
                await tx.facultySubject.update({
                    where: { id: facultySubject.id },
                    data: {
                        sectionIds: nextSectionIds,
                        gradeLevels: nextGradeLevels,
                    },
                });
            }
        });
    }
    const afterCoverage = apply
        ? await getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken)
        : beforeCoverage;
    const afterSummary = apply
        ? await getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken)
        : beforeSummary;
    const beforeRowsByCode = new Map(beforeCoverage.rows.map((row) => [row.subjectCode, row]));
    const afterRowsByCode = new Map(afterCoverage.rows.map((row) => [row.subjectCode, row]));
    const subjectDeltas = targetSubjectCodes.map((code) => {
        const beforeRow = beforeRowsByCode.get(code);
        const afterRow = afterRowsByCode.get(code);
        return {
            subjectCode: code,
            beforeOwnedByRealFacultyCount: beforeRow?.ownedByRealFacultyCount ?? 0,
            beforeOwnedByPlaceholderCount: beforeRow?.ownedByPlaceholderCount ?? 0,
            afterOwnedByRealFacultyCount: afterRow?.ownedByRealFacultyCount ?? 0,
            afterOwnedByPlaceholderCount: afterRow?.ownedByPlaceholderCount ?? 0,
        };
    });
    const realBefore = beforeSummary.faculty.filter((row) => row.loadSignalMode === 'STANDARD');
    const realAfter = afterSummary.faculty.filter((row) => row.loadSignalMode === 'STANDARD');
    const zeroLoadRealFacultyBefore = realBefore.filter((row) => row.sectionTeachingHours <= 0).length;
    const zeroLoadRealFacultyAfter = realAfter.filter((row) => row.sectionTeachingHours <= 0).length;
    const lowLoadRealFacultyBefore = realBefore.filter((row) => row.sectionTeachingHours <= REAL_FACULTY_LOW_LOAD_THRESHOLD_HOURS).length;
    const lowLoadRealFacultyAfter = realAfter.filter((row) => row.sectionTeachingHours <= REAL_FACULTY_LOW_LOAD_THRESHOLD_HOURS).length;
    const scienceVerdict = getRotationGateVerdict('SCIENCE', afterSummary.faculty);
    const tleVerdict = getRotationGateVerdict('TLE_ROTATION', afterSummary.faculty);
    if (scienceVerdict.verdict !== 'WORKING') {
        blockers.push({
            subjectCode: 'SCIENCE',
            sectionId: 0,
            category: 'ROTATION_FAMILY_MODELING_GAP',
            reason: 'Science family runtime output lacks sufficient overcount/ownership evidence.',
        });
    }
    if (tleVerdict.verdict !== 'WORKING') {
        blockers.push({
            subjectCode: 'TLE_ROTATION',
            sectionId: 0,
            category: 'ROTATION_FAMILY_MODELING_GAP',
            reason: 'TLE family runtime output lacks sufficient overcount/ownership evidence.',
        });
    }
    if ((afterSummary.integrityDiagnostics.currentYearMissingOwnershipPairs ?? 0) > 0) {
        blockers.push({
            subjectCode: 'INTEGRITY',
            sectionId: 0,
            category: 'UNRESOLVED_AUTOMATION_SEED_BIAS',
            reason: `Found ${afterSummary.integrityDiagnostics.currentYearMissingOwnershipPairs} current-year missing ownership pairs.`,
        });
    }
    if ((afterSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs ?? 0) > 0) {
        blockers.push({
            subjectCode: 'INTEGRITY',
            sectionId: 0,
            category: 'UNRESOLVED_AUTOMATION_SEED_BIAS',
            reason: `Found ${afterSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs} ownership-without-scope pairs.`,
        });
    }
    const blockerCounts = {
        trueDepartmentShortage: blockers.filter((entry) => entry.category === 'TRUE_DEPARTMENT_SHORTAGE').length,
        skewedAssignmentTopology: blockers.filter((entry) => entry.category === 'SKEWED_ASSIGNMENT_TOPOLOGY').length,
        unresolvedAutomationSeedBias: blockers.filter((entry) => entry.category === 'UNRESOLVED_AUTOMATION_SEED_BIAS').length,
        rotationFamilyModelingGap: blockers.filter((entry) => entry.category === 'ROTATION_FAMILY_MODELING_GAP').length,
        subjectContractGap: blockers.filter((entry) => entry.category === 'SUBJECT_CONTRACT_GAP').length,
    };
    return {
        applied: apply,
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        targetSubjects: targetSubjectCodes,
        beforeCoverage,
        afterCoverage,
        placeholderMovesPlanned: plannedMoves.length,
        placeholderMovesApplied: apply ? appliedMoves : 0,
        moves: plannedMoves,
        subjectDeltas,
        blockerCounts,
        blockers,
        lowLoadRecovery: {
            thresholdHours: REAL_FACULTY_LOW_LOAD_THRESHOLD_HOURS,
            zeroLoadRealFacultyBefore,
            zeroLoadRealFacultyAfter,
            lowLoadRealFacultyBefore,
            lowLoadRealFacultyAfter,
            recoveredFromZeroLoad: Math.max(0, zeroLoadRealFacultyBefore - zeroLoadRealFacultyAfter),
        },
        rotationGate: {
            science: scienceVerdict,
            tle: tleVerdict,
        },
    };
}
const DEFAULT_SPECIAL_PROGRAM_SUBJECT_CODES = ['SPA_SPEC', 'SPS_SPEC'];
function resolveRowRequiredSpecializationCode(row, facultyById) {
    if (row.specializationCode) {
        return normalizeSpecializationCode(row.specializationCode);
    }
    if (row.specializationLabel) {
        return normalizeSpecializationCode(row.specializationLabel);
    }
    const currentOwner = facultyById.get(row.facultyId);
    return normalizeSpecializationCode(currentOwner?.specialization);
}
function buildSpecialProgramRedistributionInsights(subjects, beforeRows, ownershipRows, facultyById, totalLoadByFacultyId, sectionNameById, overridesByFacultyId) {
    return subjects.map((subject) => {
        const subjectBefore = beforeRows.find((entry) => entry.subjectId === subject.id);
        const relevantSectionSet = new Set(subject.relevantSectionIds);
        const subjectRows = ownershipRows.filter((entry) => entry.subjectId === subject.id && relevantSectionSet.has(entry.sectionId));
        const currentCountByFaculty = new Map();
        for (const row of subjectRows) {
            currentCountByFaculty.set(row.facultyId, (currentCountByFaculty.get(row.facultyId) ?? 0) + 1);
        }
        const requiredSpecializationBySection = new Map();
        for (const row of subjectRows) {
            const requiredCode = resolveRowRequiredSpecializationCode(row, facultyById);
            if (!requiredCode)
                continue;
            if (!requiredSpecializationBySection.has(row.sectionId)) {
                requiredSpecializationBySection.set(row.sectionId, requiredCode);
            }
        }
        const requiredSpecializationCodes = new Set(requiredSpecializationBySection.values());
        const qualifiedCandidates = [...facultyById.values()]
            .filter((member) => member.isActiveForScheduling && !member.isPlaceholder)
            .filter((member) => {
            const departmentQualified = matchesSubjectOwnershipDepartment(member.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures);
            if (departmentQualified || member.canTeachOutsideDepartment) {
                return true;
            }
            const specialProgramBaseline = isSpecialProgramSpecializationSubject(subject.code)
                && isSpecialProgramBaselineDepartment(member.department);
            if (specialProgramBaseline) {
                return true;
            }
            if (requiredSpecializationCodes.size === 0) {
                return hasApprovedCapabilityOverride(overridesByFacultyId, member.id, subject.code, null);
            }
            return Array.from(requiredSpecializationCodes).some((requiredCode) => hasApprovedCapabilityOverride(overridesByFacultyId, member.id, subject.code, requiredCode));
        });
        const candidateSignals = qualifiedCandidates
            .map((candidate) => {
            const candidateSpecializationCode = normalizeSpecializationCode(candidate.specialization);
            let specializationExactMatchSectionCount = 0;
            let specializationSupportedSectionCount = 0;
            for (const sectionId of subject.relevantSectionIds) {
                const requiredCode = requiredSpecializationBySection.get(sectionId);
                if (!requiredCode) {
                    specializationSupportedSectionCount += 1;
                    continue;
                }
                const overrideSupports = hasApprovedCapabilityOverride(overridesByFacultyId, candidate.id, subject.code, requiredCode);
                if (candidateSpecializationCode && candidateSpecializationCode === requiredCode) {
                    specializationExactMatchSectionCount += 1;
                    specializationSupportedSectionCount += 1;
                }
                else if (overrideSupports) {
                    specializationSupportedSectionCount += 1;
                }
            }
            const currentSubjectSectionCount = currentCountByFaculty.get(candidate.id) ?? 0;
            const currentTotalAssignedPairs = totalLoadByFacultyId.get(candidate.id) ?? 0;
            const isMapeh = normalizeDepartmentCode(candidate.department) === 'MAPEH';
            const isUnderutilizedMapeh = isMapeh && currentSubjectSectionCount === 0 && currentTotalAssignedPairs <= 2;
            return {
                facultyId: candidate.id,
                facultyName: formatFacultyName(candidate.firstName, candidate.lastName),
                department: candidate.department,
                specialization: candidate.specialization,
                currentSubjectSectionCount,
                currentTotalAssignedPairs,
                specializationExactMatchSectionCount,
                specializationSupportedSectionCount,
                canCoverConstrainedSection: specializationExactMatchSectionCount > 0
                    || Array.from(requiredSpecializationCodes).some((requiredCode) => hasApprovedCapabilityOverride(overridesByFacultyId, candidate.id, subject.code, requiredCode)),
                isUnderutilizedMapeh,
            };
        })
            .sort((left, right) => {
            if (right.specializationExactMatchSectionCount !== left.specializationExactMatchSectionCount) {
                return right.specializationExactMatchSectionCount - left.specializationExactMatchSectionCount;
            }
            if (left.currentSubjectSectionCount !== right.currentSubjectSectionCount) {
                return left.currentSubjectSectionCount - right.currentSubjectSectionCount;
            }
            if (left.currentTotalAssignedPairs !== right.currentTotalAssignedPairs) {
                return left.currentTotalAssignedPairs - right.currentTotalAssignedPairs;
            }
            return left.facultyName.localeCompare(right.facultyName);
        });
        const constrainedSections = [];
        for (const sectionId of subject.relevantSectionIds) {
            const requiredCode = requiredSpecializationBySection.get(sectionId);
            if (!requiredCode)
                continue;
            const qualifiedCandidateCount = candidateSignals.filter((entry) => {
                const candidateCode = normalizeSpecializationCode(entry.specialization);
                return candidateCode === requiredCode
                    || hasApprovedCapabilityOverride(overridesByFacultyId, entry.facultyId, subject.code, requiredCode);
            }).length;
            if (qualifiedCandidateCount <= 1) {
                constrainedSections.push({
                    sectionId,
                    sectionName: sectionNameById.get(sectionId) ?? `Section ${sectionId}`,
                    requiredSpecializationCode: requiredCode,
                    qualifiedCandidateCount,
                });
            }
        }
        return {
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            ownershipConcentrationPercent: subjectBefore?.concentrationPercent ?? 0,
            maxSectionsOwnedBySingleFaculty: subjectBefore?.maxSectionsOwnedBySingleFaculty ?? 0,
            underutilizedMapehCandidates: candidateSignals.filter((entry) => entry.isUnderutilizedMapeh),
            candidateSignals,
            constrainedSections,
        };
    });
}
function buildSpecialProgramDistributionRows(subjects, ownershipRows, facultyById) {
    return subjects.map((subject) => {
        const relevantSet = new Set(subject.relevantSectionIds);
        const rows = ownershipRows.filter((entry) => entry.subjectId === subject.id && relevantSet.has(entry.sectionId));
        const ownedSectionSet = new Set(rows.map((entry) => entry.sectionId));
        const ownerMap = new Map();
        for (const row of rows) {
            const current = ownerMap.get(row.facultyId) ?? { sectionIds: new Set(), movableSectionIds: new Set() };
            current.sectionIds.add(row.sectionId);
            if (row.facultySubjectAssignedBy === 0) {
                current.movableSectionIds.add(row.sectionId);
            }
            ownerMap.set(row.facultyId, current);
        }
        const ownerRows = Array.from(ownerMap.entries())
            .map(([facultyId, value]) => {
            const faculty = facultyById.get(facultyId);
            return {
                facultyId,
                facultyName: faculty ? formatFacultyName(faculty.firstName, faculty.lastName) : `Faculty #${facultyId}`,
                sectionCount: value.sectionIds.size,
                movableSectionCount: value.movableSectionIds.size,
                department: faculty?.department ?? null,
                isPlaceholder: faculty?.isPlaceholder ?? false,
            };
        })
            .sort((left, right) => {
            if (right.sectionCount !== left.sectionCount) {
                return right.sectionCount - left.sectionCount;
            }
            return left.facultyName.localeCompare(right.facultyName);
        });
        const maxOwned = ownerRows[0]?.sectionCount ?? 0;
        const concentrationPercent = ownedSectionSet.size > 0
            ? Math.round((maxOwned / ownedSectionSet.size) * 10000) / 100
            : 0;
        return {
            subjectId: subject.id,
            subjectCode: subject.code,
            subjectName: subject.name,
            ownerDepartment: subject.ownerDepartment,
            relevantSectionCount: subject.relevantSectionIds.length,
            ownedSectionCount: ownedSectionSet.size,
            unownedSectionCount: Math.max(0, subject.relevantSectionIds.length - ownedSectionSet.size),
            maxSectionsOwnedBySingleFaculty: maxOwned,
            concentrationPercent,
            ownerRows,
        };
    });
}
export async function listTeachingLoadCapabilityOverrides(schoolId, schoolYearId) {
    const policy = await getOrCreatePolicy(schoolId, schoolYearId);
    const overrides = getTeachingLoadCapabilityOverridesFromConfig(policy.constraintConfig);
    return [...overrides].sort((left, right) => {
        if (left.facultyId !== right.facultyId) {
            return left.facultyId - right.facultyId;
        }
        const leftSubject = left.subjectCode ?? '';
        const rightSubject = right.subjectCode ?? '';
        if (leftSubject !== rightSubject) {
            return leftSubject.localeCompare(rightSubject);
        }
        const leftSpecialization = left.specializationCode ?? '';
        const rightSpecialization = right.specializationCode ?? '';
        return leftSpecialization.localeCompare(rightSpecialization);
    });
}
export async function upsertTeachingLoadCapabilityOverride(input) {
    const policy = await getOrCreatePolicy(input.schoolId, input.schoolYearId);
    const current = getTeachingLoadCapabilityOverridesFromConfig(policy.constraintConfig);
    const subjectCode = normalizeOverrideSubjectCode(input.subjectCode);
    const specializationCode = normalizeSpecializationCode(input.specializationCode);
    const specializationLabel = normalizeSpecializationLabel(input.specializationLabel);
    const note = normalizeSpecializationLabel(input.note);
    const nextEntry = {
        facultyId: input.facultyId,
        subjectCode,
        specializationCode,
        specializationLabel,
        approvedBy: input.approvedBy,
        approvedAt: new Date().toISOString(),
        note,
    };
    const nextOverrides = [
        ...current.filter((entry) => !(entry.facultyId === nextEntry.facultyId
            && (entry.subjectCode ?? null) === (nextEntry.subjectCode ?? null)
            && (entry.specializationCode ?? null) === (nextEntry.specializationCode ?? null))),
        nextEntry,
    ];
    await prisma.schedulingPolicy.update({
        where: { schoolId_schoolYearId: { schoolId: input.schoolId, schoolYearId: input.schoolYearId } },
        data: {
            constraintConfig: buildConstraintConfigWithTeachingLoadOverrides(policy.constraintConfig, nextOverrides),
        },
    });
    return listTeachingLoadCapabilityOverrides(input.schoolId, input.schoolYearId);
}
export async function deleteTeachingLoadCapabilityOverride(input) {
    const policy = await getOrCreatePolicy(input.schoolId, input.schoolYearId);
    const current = getTeachingLoadCapabilityOverridesFromConfig(policy.constraintConfig);
    const subjectCode = normalizeOverrideSubjectCode(input.subjectCode);
    const specializationCode = normalizeSpecializationCode(input.specializationCode);
    const nextOverrides = current.filter((entry) => !(entry.facultyId === input.facultyId
        && (entry.subjectCode ?? null) === (subjectCode ?? null)
        && (entry.specializationCode ?? null) === (specializationCode ?? null)));
    await prisma.schedulingPolicy.update({
        where: { schoolId_schoolYearId: { schoolId: input.schoolId, schoolYearId: input.schoolYearId } },
        data: {
            constraintConfig: buildConstraintConfigWithTeachingLoadOverrides(policy.constraintConfig, nextOverrides),
        },
    });
    return listTeachingLoadCapabilityOverrides(input.schoolId, input.schoolYearId);
}
export async function previewOrApplySpecialProgramRedistribution(input) {
    const apply = input.apply === true;
    const requestedCodes = input.subjectCodes?.length
        ? [...new Set(input.subjectCodes.map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0))]
        : DEFAULT_SPECIAL_PROGRAM_SUBJECT_CODES;
    const context = await loadCoverageContext(input.schoolId, input.schoolYearId, input.authToken);
    const targetedSubjects = context.subjects
        .filter((subject) => requestedCodes.includes(subject.code.toUpperCase()))
        .map((subject) => ({
        ...subject,
        relevantSectionIds: getRelevantSectionIdsForSubject(subject, context.sections),
    }))
        .filter((subject) => subject.relevantSectionIds.length > 0)
        .sort((left, right) => left.code.localeCompare(right.code));
    const relevantSectionIds = [...new Set(targetedSubjects.flatMap((subject) => subject.relevantSectionIds))];
    const [ownershipRows, allFaculty, capabilityOverrides] = await Promise.all([
        targetedSubjects.length > 0 && relevantSectionIds.length > 0
            ? prisma.subjectSectionOwnership.findMany({
                where: {
                    schoolId: input.schoolId,
                    subjectId: { in: targetedSubjects.map((subject) => subject.id) },
                    sectionId: { in: relevantSectionIds },
                },
                select: {
                    id: true,
                    subjectId: true,
                    sectionId: true,
                    facultyId: true,
                    specializationCode: true,
                    specializationLabel: true,
                    facultySubjectId: true,
                    facultySubject: { select: { assignedBy: true } },
                },
            })
            : Promise.resolve([]),
        prisma.facultyMirror.findMany({
            where: {
                schoolId: input.schoolId,
                isStale: false,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                department: true,
                specialization: true,
                isPlaceholder: true,
                isActiveForScheduling: true,
                canTeachOutsideDepartment: true,
            },
        }),
        listTeachingLoadCapabilityOverrides(input.schoolId, input.schoolYearId),
    ]);
    const totalLoadRows = allFaculty.length > 0 && context.sections.length > 0
        ? await prisma.subjectSectionOwnership.groupBy({
            by: ['facultyId'],
            where: {
                schoolId: input.schoolId,
                facultyId: { in: allFaculty.map((member) => member.id) },
                sectionId: { in: context.sections.map((section) => section.id) },
            },
            _count: { _all: true },
        })
        : [];
    const totalLoadByFacultyId = new Map(totalLoadRows.map((row) => [row.facultyId, row._count._all]));
    const sectionNameById = new Map(context.sections.map((section) => [section.id, section.name]));
    const normalizedOwnershipRows = ownershipRows.map((row) => ({
        id: row.id,
        subjectId: row.subjectId,
        sectionId: row.sectionId,
        facultyId: row.facultyId,
        facultySubjectId: row.facultySubjectId,
        facultySubjectAssignedBy: row.facultySubject.assignedBy,
        specializationCode: row.specializationCode ?? null,
        specializationLabel: row.specializationLabel ?? null,
    }));
    const facultyById = new Map(allFaculty.map((member) => [member.id, member]));
    const overridesByFacultyId = new Map();
    for (const override of capabilityOverrides) {
        const entries = overridesByFacultyId.get(override.facultyId) ?? [];
        entries.push(override);
        overridesByFacultyId.set(override.facultyId, entries);
    }
    const before = buildSpecialProgramDistributionRows(targetedSubjects, normalizedOwnershipRows, facultyById);
    const redistributionInsights = buildSpecialProgramRedistributionInsights(targetedSubjects, before, normalizedOwnershipRows, facultyById, totalLoadByFacultyId, sectionNameById, overridesByFacultyId);
    const proposedMoves = [];
    const blockedSubjects = [];
    for (const subject of targetedSubjects) {
        const subjectRows = normalizedOwnershipRows.filter((row) => row.subjectId === subject.id);
        if (subjectRows.length <= 1) {
            continue;
        }
        const currentCountByFaculty = new Map();
        for (const row of subjectRows) {
            currentCountByFaculty.set(row.facultyId, (currentCountByFaculty.get(row.facultyId) ?? 0) + 1);
        }
        const sectionSpecializationCodeBySectionId = new Map();
        for (const row of subjectRows) {
            const requiredCode = resolveRowRequiredSpecializationCode(row, facultyById);
            if (requiredCode && !sectionSpecializationCodeBySectionId.has(row.sectionId)) {
                sectionSpecializationCodeBySectionId.set(row.sectionId, requiredCode);
            }
        }
        const requiredSpecializationCodes = new Set(sectionSpecializationCodeBySectionId.values());
        const qualifiedCandidates = allFaculty
            .filter((member) => member.isActiveForScheduling && !member.isPlaceholder)
            .filter((member) => {
            const departmentQualified = matchesSubjectOwnershipDepartment(member.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures);
            if (departmentQualified || member.canTeachOutsideDepartment) {
                return true;
            }
            const specialProgramBaseline = isSpecialProgramSpecializationSubject(subject.code)
                && isSpecialProgramBaselineDepartment(member.department);
            if (specialProgramBaseline) {
                return true;
            }
            if (requiredSpecializationCodes.size === 0) {
                return hasApprovedCapabilityOverride(overridesByFacultyId, member.id, subject.code, null);
            }
            return Array.from(requiredSpecializationCodes).some((requiredCode) => hasApprovedCapabilityOverride(overridesByFacultyId, member.id, subject.code, requiredCode));
        });
        const candidateFaculty = qualifiedCandidates.length > 0
            ? qualifiedCandidates
            : allFaculty.filter((member) => currentCountByFaculty.has(member.id));
        if (candidateFaculty.length <= 1) {
            blockedSubjects.push({
                subjectCode: subject.code,
                reason: 'Only one qualified teacher available for redistribution.',
            });
            continue;
        }
        const totalOwned = subjectRows.length;
        const baseTarget = Math.floor(totalOwned / candidateFaculty.length);
        let extra = totalOwned % candidateFaculty.length;
        const candidateSpecializationSupportById = new Map();
        for (const candidate of candidateFaculty) {
            const candidateSpecializationCode = normalizeSpecializationCode(candidate.specialization);
            let matchCount = 0;
            for (const sectionId of subject.relevantSectionIds) {
                const requiredCode = sectionSpecializationCodeBySectionId.get(sectionId);
                if (!requiredCode)
                    continue;
                if ((candidateSpecializationCode && candidateSpecializationCode === requiredCode)
                    || hasApprovedCapabilityOverride(overridesByFacultyId, candidate.id, subject.code, requiredCode)) {
                    matchCount += 1;
                }
            }
            candidateSpecializationSupportById.set(candidate.id, matchCount);
        }
        const sortedCandidates = [...candidateFaculty].sort((left, right) => {
            const leftCount = currentCountByFaculty.get(left.id) ?? 0;
            const rightCount = currentCountByFaculty.get(right.id) ?? 0;
            if (leftCount !== rightCount) {
                return leftCount - rightCount;
            }
            const leftSupport = candidateSpecializationSupportById.get(left.id) ?? 0;
            const rightSupport = candidateSpecializationSupportById.get(right.id) ?? 0;
            if (leftSupport !== rightSupport) {
                return rightSupport - leftSupport;
            }
            const leftTotalLoad = totalLoadByFacultyId.get(left.id) ?? 0;
            const rightTotalLoad = totalLoadByFacultyId.get(right.id) ?? 0;
            if (leftTotalLoad !== rightTotalLoad) {
                return leftTotalLoad - rightTotalLoad;
            }
            return left.id - right.id;
        });
        const targetByFaculty = new Map();
        for (const candidate of sortedCandidates) {
            const target = baseTarget + (extra > 0 ? 1 : 0);
            targetByFaculty.set(candidate.id, target);
            if (extra > 0) {
                extra -= 1;
            }
        }
        const movableRowsByFaculty = new Map();
        for (const row of subjectRows) {
            if (row.facultySubjectAssignedBy !== 0)
                continue;
            const existing = movableRowsByFaculty.get(row.facultyId) ?? [];
            existing.push(row);
            movableRowsByFaculty.set(row.facultyId, existing);
        }
        for (const rows of movableRowsByFaculty.values()) {
            rows.sort((left, right) => left.sectionId - right.sectionId);
        }
        const deficitQueue = sortedCandidates
            .map((candidate) => {
            const current = currentCountByFaculty.get(candidate.id) ?? 0;
            const target = targetByFaculty.get(candidate.id) ?? 0;
            return { candidate, deficit: Math.max(0, target - current) };
        })
            .filter((entry) => entry.deficit > 0)
            .sort((left, right) => right.deficit - left.deficit);
        for (const deficitEntry of deficitQueue) {
            while (deficitEntry.deficit > 0) {
                const donors = sortedCandidates
                    .map((candidate) => {
                    const current = currentCountByFaculty.get(candidate.id) ?? 0;
                    const target = targetByFaculty.get(candidate.id) ?? 0;
                    const surplus = Math.max(0, current - target);
                    return { candidate, surplus };
                })
                    .filter((entry) => entry.surplus > 0)
                    .sort((left, right) => {
                    if (right.surplus !== left.surplus) {
                        return right.surplus - left.surplus;
                    }
                    return left.candidate.id - right.candidate.id;
                });
                const donor = donors.find((entry) => (movableRowsByFaculty.get(entry.candidate.id)?.length ?? 0) > 0);
                if (!donor) {
                    blockedSubjects.push({
                        subjectCode: subject.code,
                        reason: 'No system-owned sections available to move without overriding manual placements.',
                    });
                    break;
                }
                const donorRows = movableRowsByFaculty.get(donor.candidate.id) ?? [];
                const compatibleRowIndex = donorRows.findIndex((candidateRow) => {
                    const requiredCode = sectionSpecializationCodeBySectionId.get(candidateRow.sectionId) ?? null;
                    if (!requiredCode) {
                        return true;
                    }
                    const candidateSpecializationCode = normalizeSpecializationCode(deficitEntry.candidate.specialization);
                    if (candidateSpecializationCode && candidateSpecializationCode === requiredCode) {
                        return true;
                    }
                    return hasApprovedCapabilityOverride(overridesByFacultyId, deficitEntry.candidate.id, subject.code, requiredCode);
                });
                const rowToMove = compatibleRowIndex >= 0
                    ? donorRows.splice(compatibleRowIndex, 1)[0]
                    : undefined;
                movableRowsByFaculty.set(donor.candidate.id, donorRows);
                if (!rowToMove) {
                    blockedSubjects.push({
                        subjectCode: subject.code,
                        reason: 'No specialization-compatible movable section is available for the target candidate.',
                    });
                    break;
                }
                currentCountByFaculty.set(donor.candidate.id, (currentCountByFaculty.get(donor.candidate.id) ?? 0) - 1);
                currentCountByFaculty.set(deficitEntry.candidate.id, (currentCountByFaculty.get(deficitEntry.candidate.id) ?? 0) + 1);
                deficitEntry.deficit -= 1;
                proposedMoves.push({
                    subjectId: subject.id,
                    subjectCode: subject.code,
                    sectionId: rowToMove.sectionId,
                    fromFacultyId: donor.candidate.id,
                    fromFacultyName: formatFacultyName(donor.candidate.firstName, donor.candidate.lastName),
                    toFacultyId: deficitEntry.candidate.id,
                    toFacultyName: formatFacultyName(deficitEntry.candidate.firstName, deficitEntry.candidate.lastName),
                });
            }
        }
    }
    let appliedMoves = 0;
    if (apply && proposedMoves.length > 0) {
        const sectionGradeMap = new Map(context.sections.map((section) => [section.id, section.gradeLevel]));
        await prisma.$transaction(async (tx) => {
            const destinationFsByKey = new Map();
            for (const move of proposedMoves) {
                const destinationKey = `${move.toFacultyId}:${move.subjectId}`;
                let destinationFacultySubjectId = destinationFsByKey.get(destinationKey);
                if (!destinationFacultySubjectId) {
                    const existing = await tx.facultySubject.findUnique({
                        where: {
                            facultyId_subjectId: {
                                facultyId: move.toFacultyId,
                                subjectId: move.subjectId,
                            },
                        },
                        select: { id: true },
                    });
                    if (existing) {
                        destinationFacultySubjectId = existing.id;
                    }
                    else {
                        const created = await tx.facultySubject.create({
                            data: {
                                facultyId: move.toFacultyId,
                                subjectId: move.subjectId,
                                schoolId: input.schoolId,
                                gradeLevels: [],
                                sectionIds: [],
                                assignedBy: input.actorId,
                            },
                            select: { id: true },
                        });
                        destinationFacultySubjectId = created.id;
                    }
                    destinationFsByKey.set(destinationKey, destinationFacultySubjectId);
                }
                const sourceOwnership = await tx.subjectSectionOwnership.findFirst({
                    where: {
                        schoolId: input.schoolId,
                        subjectId: move.subjectId,
                        sectionId: move.sectionId,
                        facultyId: move.fromFacultyId,
                    },
                    select: { id: true },
                });
                if (!sourceOwnership) {
                    continue;
                }
                const subject = targetedSubjects.find((entry) => entry.id === move.subjectId);
                const destinationFaculty = facultyById.get(move.toFacultyId);
                const specializationIdentity = resolveAssignmentSpecializationIdentity({
                    subjectCode: subject?.code,
                    facultySpecialization: destinationFaculty?.specialization,
                });
                await tx.subjectSectionOwnership.update({
                    where: { id: sourceOwnership.id },
                    data: {
                        facultyId: move.toFacultyId,
                        facultySubjectId: destinationFacultySubjectId,
                        specializationCode: specializationIdentity.specializationCode,
                        specializationLabel: specializationIdentity.specializationLabel,
                        assignedAt: new Date(),
                    },
                });
                appliedMoves += 1;
            }
            const affectedFacultySubjectPairs = new Set();
            for (const move of proposedMoves) {
                affectedFacultySubjectPairs.add(`${move.fromFacultyId}:${move.subjectId}`);
                affectedFacultySubjectPairs.add(`${move.toFacultyId}:${move.subjectId}`);
            }
            for (const key of affectedFacultySubjectPairs) {
                const [facultyIdRaw, subjectIdRaw] = key.split(':');
                const facultyId = Number(facultyIdRaw);
                const subjectId = Number(subjectIdRaw);
                if (!Number.isFinite(facultyId) || !Number.isFinite(subjectId))
                    continue;
                const facultySubject = await tx.facultySubject.findUnique({
                    where: {
                        facultyId_subjectId: { facultyId, subjectId },
                    },
                    select: { id: true, assignedBy: true },
                });
                if (!facultySubject)
                    continue;
                const ownership = await tx.subjectSectionOwnership.findMany({
                    where: {
                        schoolId: input.schoolId,
                        facultyId,
                        subjectId,
                    },
                    select: { sectionId: true },
                });
                const sectionIds = [...new Set(ownership.map((row) => row.sectionId))].sort((left, right) => left - right);
                if (sectionIds.length === 0) {
                    if (facultySubject.assignedBy === 0) {
                        await tx.facultySubject.delete({ where: { id: facultySubject.id } });
                    }
                    continue;
                }
                const gradeLevels = deriveGradeLevelsFromSectionIds(sectionIds, sectionGradeMap);
                await tx.facultySubject.update({
                    where: { id: facultySubject.id },
                    data: { sectionIds, gradeLevels },
                });
            }
        });
    }
    const refreshedOwnershipRows = apply && targetedSubjects.length > 0 && relevantSectionIds.length > 0
        ? await prisma.subjectSectionOwnership.findMany({
            where: {
                schoolId: input.schoolId,
                subjectId: { in: targetedSubjects.map((subject) => subject.id) },
                sectionId: { in: relevantSectionIds },
            },
            select: {
                id: true,
                subjectId: true,
                sectionId: true,
                facultyId: true,
                facultySubjectId: true,
                facultySubject: { select: { assignedBy: true } },
            },
        })
        : ownershipRows;
    const normalizedAfterOwnershipRows = refreshedOwnershipRows.map((row) => ({
        id: row.id,
        subjectId: row.subjectId,
        sectionId: row.sectionId,
        facultyId: row.facultyId,
        facultySubjectId: row.facultySubjectId,
        facultySubjectAssignedBy: row.facultySubject.assignedBy,
    }));
    const after = buildSpecialProgramDistributionRows(targetedSubjects, normalizedAfterOwnershipRows, facultyById);
    return {
        applied: apply,
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        subjectCodes: targetedSubjects.map((subject) => subject.code),
        before,
        after,
        redistributionInsights,
        proposedMoves,
        appliedMoves,
        blockedSubjects,
    };
}
function buildServiceError(code, error, details) {
    return { success: false, code, error, details };
}
function normalizeSpecializationCode(value) {
    const trimmed = (value ?? '').trim();
    if (trimmed.length === 0)
        return null;
    const normalized = trimmed.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
    return normalized.length > 0 ? normalized : null;
}
function normalizeSpecializationLabel(value) {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
}
function normalizeOverrideSubjectCode(value) {
    const normalized = (value ?? '').trim().toUpperCase();
    return normalized.length > 0 ? normalized : null;
}
function getTeachingLoadCapabilityOverridesFromConfig(constraintConfig) {
    if (!constraintConfig || typeof constraintConfig !== 'object' || Array.isArray(constraintConfig)) {
        return [];
    }
    const rawOverrides = constraintConfig.teachingLoadCapabilityOverrides;
    if (!Array.isArray(rawOverrides)) {
        return [];
    }
    const parsed = [];
    for (const entry of rawOverrides) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            continue;
        const row = entry;
        const facultyId = Number(row.facultyId);
        if (!Number.isInteger(facultyId) || facultyId <= 0)
            continue;
        const subjectCode = normalizeOverrideSubjectCode(typeof row.subjectCode === 'string' ? row.subjectCode : null);
        const specializationCode = normalizeSpecializationCode(typeof row.specializationCode === 'string' ? row.specializationCode : null);
        const specializationLabel = normalizeSpecializationLabel(typeof row.specializationLabel === 'string' ? row.specializationLabel : null);
        const approvedBy = Number(row.approvedBy);
        const approvedAtRaw = typeof row.approvedAt === 'string' ? row.approvedAt : new Date().toISOString();
        const approvedAt = Number.isNaN(Date.parse(approvedAtRaw)) ? new Date().toISOString() : approvedAtRaw;
        const note = normalizeSpecializationLabel(typeof row.note === 'string' ? row.note : null);
        parsed.push({
            facultyId,
            subjectCode,
            specializationCode,
            specializationLabel,
            approvedBy: Number.isFinite(approvedBy) ? approvedBy : 0,
            approvedAt,
            note,
        });
    }
    return parsed;
}
function buildConstraintConfigWithTeachingLoadOverrides(constraintConfig, overrides) {
    const base = constraintConfig && typeof constraintConfig === 'object' && !Array.isArray(constraintConfig)
        ? { ...constraintConfig }
        : {};
    base.teachingLoadCapabilityOverrides = overrides.map((entry) => ({
        facultyId: entry.facultyId,
        subjectCode: entry.subjectCode,
        specializationCode: entry.specializationCode,
        specializationLabel: entry.specializationLabel,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
        note: entry.note,
    }));
    return base;
}
function capabilityOverrideMatches(override, subjectCode, requiredSpecializationCode) {
    const normalizedSubjectCode = normalizeOverrideSubjectCode(subjectCode);
    if (!normalizedSubjectCode)
        return false;
    if (override.subjectCode && override.subjectCode !== normalizedSubjectCode) {
        return false;
    }
    if (override.specializationCode) {
        return override.specializationCode === requiredSpecializationCode;
    }
    return true;
}
function isSpecialProgramSpecializationSubject(subjectCode) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    return code === 'SPA_SPEC' || code === 'SPS_SPEC';
}
function isSpecialProgramBaselineDepartment(department) {
    const normalized = normalizeDepartmentCode(department);
    return normalized === 'MAPEH' || normalized === 'SPA' || normalized === 'SPS';
}
function hasApprovedCapabilityOverride(overridesByFacultyId, facultyId, subjectCode, requiredSpecializationCode) {
    const overrides = overridesByFacultyId.get(facultyId) ?? [];
    return overrides.some((override) => capabilityOverrideMatches(override, subjectCode, requiredSpecializationCode));
}
function canonicalizeAllowedSpecialization(allowedSpecializations, candidate) {
    const candidateCode = normalizeSpecializationCode(candidate);
    if (!candidateCode)
        return null;
    const match = (allowedSpecializations ?? []).find((entry) => normalizeSpecializationCode(entry) === candidateCode);
    return match ?? candidateCode;
}
function isAssignmentSpecializationSubject(subjectCode) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    return code === 'SPA_SPEC' || code === 'SPS_SPEC' || code.startsWith('TLE_SPEC_');
}
export function resolveAssignmentSpecializationIdentity(input) {
    if (!isAssignmentSpecializationSubject(input.subjectCode)) {
        return { specializationCode: null, specializationLabel: null };
    }
    const specializationLabel = normalizeSpecializationLabel(input.facultySpecialization);
    if (!specializationLabel) {
        return { specializationCode: null, specializationLabel: null };
    }
    return {
        specializationCode: canonicalizeAllowedSpecialization(input.allowedSpecializations, specializationLabel),
        specializationLabel,
    };
}
function buildAssignmentLaneImpactByPair(assignments) {
    const impactByPair = new Map();
    const laneCredits = new Map();
    const orderedAssignments = [...assignments].sort((left, right) => left.subjectId - right.subjectId);
    for (const assignment of orderedAssignments) {
        const minutes = Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0);
        const family = resolveLoadRotationFamily(assignment.subject);
        const termMetadata = resolveRotationTermMetadata({
            subjectCode: assignment.subject.code,
            rotationFamily: family,
            modularGroupId: assignment.subject.modularGroupId ?? null,
            modularOrder: assignment.subject.modularOrder ?? null,
            termGroupId: assignment.subject.termGroupId ?? null,
            termCount: assignment.subject.termCount ?? null,
        });
        for (const sectionId of [...assignment.sectionIds].sort((left, right) => left - right)) {
            const laneId = family
                ? buildRotationConcurrentLaneId(family, termMetadata.termRank, sectionId)
                : `subject:${assignment.subjectId}:${sectionId}`;
            const creditedSoFar = laneCredits.get(laneId) ?? 0;
            const concurrentDeltaMinutesPerWeek = Math.max(0, minutes - creditedSoFar);
            if (minutes > creditedSoFar) {
                laneCredits.set(laneId, minutes);
            }
            impactByPair.set(`${assignment.subjectId}:${sectionId}`, {
                rotationFamily: family,
                rotationLaneId: laneId,
                rotationTermRank: termMetadata.termRank,
                rotationTermLabel: termMetadata.termLabel,
                rotationTermGroupId: termMetadata.termGroupId,
                rotationTermCount: termMetadata.termCount,
                rawMinutesPerWeek: minutes,
                concurrentDeltaMinutesPerWeek,
                expandsConcurrentDemand: concurrentDeltaMinutesPerWeek > 0,
            });
        }
    }
    return impactByPair;
}
function attachSectionSpecializationMetadata(sections, specializationBySectionId, laneImpactBySectionId) {
    return sections.map((section) => {
        const specialization = specializationBySectionId?.get(section.id);
        const laneImpact = laneImpactBySectionId?.get(section.id);
        return {
            ...section,
            assignmentSpecializationCode: specialization?.specializationCode ?? null,
            assignmentSpecializationLabel: specialization?.specializationLabel ?? null,
            assignmentRotationFamily: laneImpact?.rotationFamily ?? null,
            assignmentRotationLaneId: laneImpact?.rotationLaneId ?? null,
            assignmentRotationTermRank: laneImpact?.rotationTermRank ?? null,
            assignmentRotationTermLabel: laneImpact?.rotationTermLabel ?? null,
            assignmentRotationTermGroupId: laneImpact?.rotationTermGroupId ?? null,
            assignmentRotationTermCount: laneImpact?.rotationTermCount ?? null,
            assignmentRawMinutesPerWeek: laneImpact?.rawMinutesPerWeek ?? null,
            assignmentConcurrentDeltaMinutesPerWeek: laneImpact?.concurrentDeltaMinutesPerWeek ?? null,
            assignmentExpandsConcurrentDemand: laneImpact?.expandsConcurrentDemand ?? null,
        };
    });
}
function toAssignmentResponse(assignment, normalized, metadata) {
    return {
        ...assignment,
        gradeLevels: normalized.gradeLevels,
        sectionIds: normalized.sectionIds,
        sections: attachSectionSpecializationMetadata(normalized.sections, metadata?.specializationBySectionId, metadata?.laneImpactBySectionId),
        assignmentKind: metadata?.assignmentKind ?? (normalized.sectionIds.length > 0 ? 'REAL_OWNERSHIP' : 'BASELINE_ONLY'),
        storedCurrentYearSectionCount: metadata?.storedCurrentYearSectionCount ?? normalized.sectionIds.length,
        ownedCurrentYearSectionCount: metadata?.ownedCurrentYearSectionCount ?? normalized.sectionIds.length,
        missingOwnershipSectionCount: metadata?.missingOwnershipSectionCount ?? 0,
        ownershipWithoutScopeSectionCount: metadata?.ownershipWithoutScopeSectionCount ?? 0,
    };
}
async function buildRosterIndex(schoolId, schoolYearId, authToken) {
    const mirrorRows = await prisma.sectionMirror.findMany({
        where: { schoolId, schoolYearId, isStale: false },
        select: {
            externalId: true,
            name: true,
            maxCapacity: true,
            enrolledCount: true,
            gradeLevelId: true,
            gradeLevelName: true,
            displayOrder: true,
            programType: true,
            programCode: true,
            programName: true,
            isSpecialProgram: true,
            tleProgramId: true,
            tleSpecialization: true,
            tleProgramCategory: true,
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    if (mirrorRows.length > 0) {
        const gradeMap = new Map();
        for (const row of mirrorRows) {
            if (!gradeMap.has(row.gradeLevelId)) {
                gradeMap.set(row.gradeLevelId, {
                    gradeLevelId: row.gradeLevelId,
                    gradeLevelName: row.gradeLevelName,
                    displayOrder: row.displayOrder,
                    sections: [],
                });
            }
            gradeMap.get(row.gradeLevelId).sections.push({
                id: row.externalId,
                name: row.name,
                maxCapacity: row.maxCapacity,
                enrolledCount: row.enrolledCount,
                gradeLevelId: row.gradeLevelId,
                gradeLevelName: row.gradeLevelName,
                displayOrder: row.displayOrder,
                programType: (row.programType ?? 'REGULAR'),
                programCode: row.programCode ?? row.programType ?? 'REGULAR',
                programName: row.programName ?? row.programCode ?? 'Regular',
                isSpecialProgram: row.isSpecialProgram,
                tleProgramId: row.tleProgramId,
                tleSpecialization: row.tleSpecialization,
                tleProgramCategory: row.tleProgramCategory,
            });
        }
        return buildSectionRosterIndex(Array.from(gradeMap.values()).sort((left, right) => left.displayOrder - right.displayOrder));
    }
    const sectionResult = await fetchSectionsForRuntimeControls(schoolId, schoolYearId, {
        authToken,
        preferLocalEvidenceFirst: true,
    });
    return buildSectionRosterIndex(sectionResult.gradeLevels);
}
export async function getAssignmentsByFaculty(facultyId, schoolYearId, authToken) {
    const faculty = await prisma.facultyMirror.findUnique({
        where: { id: facultyId },
        select: { id: true, schoolId: true, version: true },
    });
    if (!faculty) {
        return null;
    }
    const rosterIndex = await buildRosterIndex(faculty.schoolId, schoolYearId, authToken);
    const currentYearSectionIds = Array.from(rosterIndex.sectionMap.keys());
    const currentYearSectionIdSet = new Set(currentYearSectionIds);
    const assignments = await prisma.facultySubject.findMany({
        where: { facultyId },
        include: {
            subject: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                    modularGroupId: true,
                    modularOrder: true,
                    termGroupId: true,
                    termCount: true,
                    minMinutesPerWeek: true,
                    rotationFamily: true,
                },
            },
        },
        orderBy: { subject: { name: 'asc' } },
    });
    const ownershipRows = currentYearSectionIds.length > 0
        ? await prisma.subjectSectionOwnership.findMany({
            where: {
                schoolId: faculty.schoolId,
                facultyId,
                sectionId: { in: currentYearSectionIds },
            },
            select: {
                facultySubjectId: true,
                sectionId: true,
                specializationCode: true,
                specializationLabel: true,
            },
        })
        : [];
    const ownershipByFacultySubjectId = new Map();
    const specializationByFacultySubjectId = new Map();
    for (const row of ownershipRows) {
        const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set();
        existing.add(row.sectionId);
        ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
        const specializationMap = specializationByFacultySubjectId.get(row.facultySubjectId) ?? new Map();
        specializationMap.set(row.sectionId, {
            specializationCode: row.specializationCode ?? null,
            specializationLabel: row.specializationLabel ?? null,
        });
        specializationByFacultySubjectId.set(row.facultySubjectId, specializationMap);
    }
    const sectionDisplayOrderMap = new Map(Array.from(rosterIndex.sectionMap.values()).map((section) => [section.id, section.displayOrder]));
    const laneImpactByPair = buildAssignmentLaneImpactByPair(assignments.map((assignment) => ({
        subjectId: assignment.subjectId,
        sectionIds: assignment.sectionIds,
        subject: assignment.subject,
    })));
    return {
        facultyId: faculty.id,
        version: faculty.version,
        assignments: assignments.map((assignment) => {
            const storedCurrentYearSectionIds = assignment.sectionIds
                .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
                .sort((left, right) => left - right);
            const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(assignment.id) ?? [])
                .sort((left, right) => left - right);
            const ownedSectionIdSet = new Set(ownedCurrentYearSectionIds);
            const storedSectionIdSet = new Set(storedCurrentYearSectionIds);
            const missingOwnershipSectionCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSectionIdSet.has(sectionId)).length;
            const ownershipWithoutScopeSectionCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSectionIdSet.has(sectionId)).length;
            const normalized = normalizeStoredAssignmentScope({
                subjectId: assignment.subjectId,
                gradeLevels: deriveGradeLevelsFromSectionIds(ownedCurrentYearSectionIds, sectionDisplayOrderMap),
                sectionIds: ownedCurrentYearSectionIds,
            }, rosterIndex);
            const assignmentKind = normalized.sectionIds.length > 0
                ? 'REAL_OWNERSHIP'
                : storedCurrentYearSectionIds.length > 0
                    ? 'MISSING_OWNERSHIP'
                    : 'BASELINE_ONLY';
            return toAssignmentResponse(assignment, normalized, {
                assignmentKind,
                storedCurrentYearSectionCount: storedCurrentYearSectionIds.length,
                ownedCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
                missingOwnershipSectionCount,
                ownershipWithoutScopeSectionCount,
                specializationBySectionId: specializationByFacultySubjectId.get(assignment.id),
                laneImpactBySectionId: new Map(ownedCurrentYearSectionIds.map((sectionId) => [
                    sectionId,
                    laneImpactByPair.get(`${assignment.subjectId}:${sectionId}`) ?? (() => {
                        const fallbackFamily = resolveLoadRotationFamily(assignment.subject);
                        const fallbackTermMetadata = resolveRotationTermMetadata({
                            subjectCode: assignment.subject.code,
                            rotationFamily: fallbackFamily,
                            modularGroupId: assignment.subject.modularGroupId,
                            modularOrder: assignment.subject.modularOrder,
                            termGroupId: assignment.subject.termGroupId,
                            termCount: assignment.subject.termCount,
                        });
                        return {
                            rotationFamily: fallbackFamily,
                            rotationLaneId: fallbackFamily
                                ? buildRotationConcurrentLaneId(fallbackFamily, fallbackTermMetadata.termRank, sectionId)
                                : `subject:${assignment.subjectId}:${sectionId}`,
                            rotationTermRank: fallbackTermMetadata.termRank,
                            rotationTermLabel: fallbackTermMetadata.termLabel,
                            rotationTermGroupId: fallbackTermMetadata.termGroupId,
                            rotationTermCount: fallbackTermMetadata.termCount,
                            rawMinutesPerWeek: Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0),
                            concurrentDeltaMinutesPerWeek: Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0),
                            expandsConcurrentDemand: true,
                        };
                    })(),
                ])),
            });
        }),
    };
}
export async function setAssignments(facultyId, schoolId, schoolYearId, assignedBy, expectedVersion, assignments, authToken) {
    const faculty = await prisma.facultyMirror.findUnique({
        where: { id: facultyId },
        select: {
            id: true,
            schoolId: true,
            isActiveForScheduling: true,
            version: true,
            isClassAdviser: true,
            advisedSectionId: true,
            specialization: true,
        },
    });
    if (!faculty) {
        return buildServiceError('FACULTY_NOT_FOUND', 'Faculty not found.');
    }
    if (faculty.schoolId !== schoolId) {
        return buildServiceError('SCHOOL_SCOPE_MISMATCH', 'Faculty does not belong to the provided school scope.');
    }
    if (!faculty.isActiveForScheduling) {
        return buildServiceError('FACULTY_INACTIVE', 'Faculty is not active for scheduling.');
    }
    if (faculty.version !== expectedVersion) {
        return buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
    }
    const subjectIds = Array.from(new Set(assignments.map((assignment) => assignment.subjectId)));
    if (subjectIds.length !== assignments.length) {
        return buildServiceError('INVALID_ASSIGNMENT_SCOPE', 'Each subject can only appear once in a faculty assignment payload.');
    }
    let normalizedAssignments = [];
    let rosterIndex = null;
    let validSubjectsById = new Map();
    if (assignments.length > 0) {
        rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
        const validSubjects = await prisma.subject.findMany({
            where: { schoolId, id: { in: subjectIds } },
            select: { id: true, code: true, allowedSpecializations: true },
        });
        const validSubjectIds = new Set(validSubjects.map((subject) => subject.id));
        validSubjectsById = new Map(validSubjects.map((subject) => [subject.id, subject]));
        const invalidSubjectIds = subjectIds.filter((subjectId) => !validSubjectIds.has(subjectId));
        if (invalidSubjectIds.length > 0) {
            return buildServiceError('INVALID_SUBJECTS', 'One or more subjects are not valid for the selected school.', { invalidSubjectIds });
        }
        for (const assignment of assignments) {
            const normalized = normalizeIncomingAssignmentScope(assignment, rosterIndex);
            if (!normalized.ok) {
                return buildServiceError('INVALID_ASSIGNMENT_SCOPE', normalized.error.message, { subjectId: assignment.subjectId, ...normalized.error });
            }
            normalizedAssignments.push(normalized.value);
        }
    }
    // ── HG Advisory Guard ──────────────────────────────────────────────────────
    // If this faculty is a class adviser, their HG section is immutable.
    // Reject any payload that would remove the advised section from HG.
    // Gather adviser info before entering the transaction.
    let advisedHgInfo = null;
    if (faculty.isClassAdviser && faculty.advisedSectionId) {
        const hgSubject = await prisma.subject.findFirst({
            where: { schoolId, code: HG_SUBJECT_CODE },
            select: { id: true },
        });
        if (hgSubject) {
            const hgInPayload = normalizedAssignments.find((a) => a.subjectId === hgSubject.id);
            if (hgInPayload && !hgInPayload.sectionIds.includes(faculty.advisedSectionId)) {
                return buildServiceError('HG_ADVISORY_IMMUTABLE', 'Cannot remove Homeroom Guidance assignment for an active class adviser.');
            }
            const existingHgFs = await prisma.facultySubject.findUnique({
                where: { facultyId_subjectId: { facultyId, subjectId: hgSubject.id } },
                select: { id: true },
            });
            advisedHgInfo = {
                hgSubjectId: hgSubject.id,
                advisedSectionId: faculty.advisedSectionId,
                hgFacultySubjectId: existingHgFs?.id ?? null,
            };
        }
    }
    // Filter out the adviser's HG subject from normalizedAssignments — the preserved
    // FacultySubject record is kept intact; we do not re-create it.
    const assignmentsToCreate = advisedHgInfo
        ? normalizedAssignments.filter((a) => a.subjectId !== advisedHgInfo.hgSubjectId)
        : normalizedAssignments;
    try {
        await prisma.$transaction(async (tx) => {
            const concurrentFaculty = await tx.facultyMirror.findUnique({
                where: { id: facultyId },
                select: { version: true, isActiveForScheduling: true, schoolId: true },
            });
            if (!concurrentFaculty) {
                throw buildServiceError('FACULTY_NOT_FOUND', 'Faculty not found.');
            }
            if (concurrentFaculty.schoolId !== schoolId) {
                throw buildServiceError('SCHOOL_SCOPE_MISMATCH', 'Faculty does not belong to the provided school scope.');
            }
            if (!concurrentFaculty.isActiveForScheduling) {
                throw buildServiceError('FACULTY_INACTIVE', 'Faculty is not active for scheduling.');
            }
            if (concurrentFaculty.version !== expectedVersion) {
                throw buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
            }
            // Conflict check against normalized ownership table — authoritative DB-level source.
            // Avoids scanning FacultySubject.sectionIds arrays across all faculty.
            if (assignmentsToCreate.length > 0) {
                const incomingSubjectIds = assignmentsToCreate.map((a) => a.subjectId);
                const incomingSectionIds = [...new Set(assignmentsToCreate.flatMap((a) => a.sectionIds))];
                if (incomingSectionIds.length > 0) {
                    const blockingOwners = await tx.subjectSectionOwnership.findMany({
                        where: {
                            schoolId,
                            subjectId: { in: incomingSubjectIds },
                            sectionId: { in: incomingSectionIds },
                            facultyId: { not: facultyId },
                        },
                        select: { subjectId: true, sectionId: true, facultyId: true },
                    });
                    // Query is a cross-product (subjectId × sectionId); filter to exact claimed pairs
                    const incomingPairs = new Set(assignmentsToCreate.flatMap((a) => a.sectionIds.map((sid) => `${a.subjectId}:${sid}`)));
                    const realConflicts = blockingOwners.filter((o) => incomingPairs.has(`${o.subjectId}:${o.sectionId}`));
                    if (realConflicts.length > 0) {
                        const conflictFacultyIds = [...new Set(realConflicts.map((c) => c.facultyId))];
                        const conflictFaculty = await tx.facultyMirror.findMany({
                            where: { id: { in: conflictFacultyIds } },
                            select: { id: true, firstName: true, lastName: true },
                        });
                        const nameMap = new Map(conflictFaculty.map((f) => [f.id, formatFacultyName(f.firstName, f.lastName)]));
                        // AUTHORITATIVE STEAL LOGIC: Remove conflicting sections from old owners
                        // This ensures "Take" functionality works by repairing the old owner's record
                        for (const conflict of realConflicts) {
                            const oldOwnerFs = await tx.facultySubject.findFirst({
                                where: {
                                    facultyId: conflict.facultyId,
                                    subjectId: conflict.subjectId,
                                    schoolId,
                                },
                                select: { id: true, sectionIds: true },
                            });
                            if (oldOwnerFs) {
                                const nextSectionIds = oldOwnerFs.sectionIds.filter((sid) => sid !== conflict.sectionId);
                                if (nextSectionIds.length === 0) {
                                    // If no sections left for this subject, delete the record
                                    await tx.facultySubject.delete({
                                        where: { id: oldOwnerFs.id },
                                    });
                                }
                                else {
                                    // Otherwise update the array
                                    await tx.facultySubject.update({
                                        where: { id: oldOwnerFs.id },
                                        data: { sectionIds: nextSectionIds },
                                    });
                                }
                            }
                            // Explicitly delete conflicting ownership row to clear the unique constraint path
                            await tx.subjectSectionOwnership.deleteMany({
                                where: {
                                    schoolId,
                                    subjectId: conflict.subjectId,
                                    sectionId: conflict.sectionId,
                                    facultyId: conflict.facultyId,
                                },
                            });
                        }
                        // Note: We no longer throw the blockingResult here because we've performed the repair.
                    }
                }
            }
            const versionUpdate = await tx.facultyMirror.updateMany({
                where: { id: facultyId, version: expectedVersion },
                data: { version: { increment: 1 } },
            });
            if (versionUpdate.count !== 1) {
                throw buildServiceError('VERSION_CONFLICT', 'Version conflict. Please reload.');
            }
            // deleteMany cascade-deletes SubjectSectionOwnership rows via the FK on faculty_subjects.
            // Preserve the HG FacultySubject for active class advisers (immutable by design).
            const preservedIds = advisedHgInfo?.hgFacultySubjectId
                ? [advisedHgInfo.hgFacultySubjectId]
                : [];
            await tx.facultySubject.deleteMany({
                where: { facultyId, id: { notIn: preservedIds } },
            });
            if (assignmentsToCreate.length > 0) {
                // createManyAndReturn gives us IDs needed to populate the normalized ownership index
                const createdSubjects = await tx.facultySubject.createManyAndReturn({
                    data: assignmentsToCreate.map((assignment) => ({
                        facultyId,
                        subjectId: assignment.subjectId,
                        schoolId,
                        gradeLevels: assignment.gradeLevels,
                        sectionIds: assignment.sectionIds,
                        assignedBy,
                    })),
                    select: { id: true, subjectId: true, sectionIds: true },
                });
                // Write normalized ownership rows — unique constraint is the final DB guardrail
                const ownershipData = createdSubjects.flatMap((fs) => fs.sectionIds.map((sectionId) => {
                    const subject = validSubjectsById.get(fs.subjectId);
                    const specializationIdentity = resolveAssignmentSpecializationIdentity({
                        subjectCode: subject?.code,
                        allowedSpecializations: subject?.allowedSpecializations,
                        facultySpecialization: faculty.specialization,
                    });
                    return {
                        schoolId,
                        facultySubjectId: fs.id,
                        facultyId,
                        subjectId: fs.subjectId,
                        sectionId,
                        specializationCode: specializationIdentity.specializationCode,
                        specializationLabel: specializationIdentity.specializationLabel,
                        assignedAt: new Date(),
                    };
                }));
                if (ownershipData.length > 0) {
                    await tx.subjectSectionOwnership.createMany({ data: ownershipData });
                }
            }
        }, { isolationLevel: 'Serializable' });
    }
    catch (error) {
        if (error?.success === false) {
            return error;
        }
        if (error?.code === 'P2034') {
            return buildServiceError('VERSION_CONFLICT', 'A concurrent assignment update occurred. Please reload and try again.');
        }
        // DB unique constraint uq_subject_section_owner fired (race slipped past the pre-flight check)
        if (error?.code === 'P2002' && error?.meta?.modelName === 'SubjectSectionOwnership') {
            return buildServiceError('DUPLICATE_SECTION_OWNERSHIP', 'A concurrent save created an ownership conflict on the same subject-section. Please reload and try again.');
        }
        throw error;
    }
    return { success: true, version: expectedVersion + 1 };
}
export async function getAssignmentSummary(schoolId, schoolYearId, authToken) {
    const rosterIndex = await buildRosterIndex(schoolId, schoolYearId, authToken);
    const currentYearSectionScope = Array.from(rosterIndex.sectionMap.values()).map((section) => ({
        id: section.id,
        gradeLevel: section.displayOrder,
        programType: section.programType ?? 'REGULAR',
    }));
    const currentYearSectionIds = currentYearSectionScope.map((section) => section.id);
    const currentYearSectionIdSet = new Set(currentYearSectionIds);
    const sectionDisplayOrderMap = new Map(currentYearSectionScope.map((section) => [section.id, section.gradeLevel]));
    const [faculty, ownershipRows, activeSubjects] = await Promise.all([
        prisma.facultyMirror.findMany({
            where: { schoolId, isStale: false },
            include: {
                facultySubjects: {
                    include: {
                        subject: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                modularGroupId: true,
                                modularOrder: true,
                                termGroupId: true,
                                termCount: true,
                                minMinutesPerWeek: true,
                                rotationFamily: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        }),
        currentYearSectionIds.length > 0
            ? prisma.subjectSectionOwnership.findMany({
                where: {
                    schoolId,
                    sectionId: { in: currentYearSectionIds },
                },
                select: {
                    facultySubjectId: true,
                    subjectId: true,
                    sectionId: true,
                    facultyId: true,
                    specializationCode: true,
                    specializationLabel: true,
                },
            })
            : Promise.resolve([]),
        prisma.subject.findMany({
            where: {
                schoolId,
                isActive: true,
                code: { not: HG_SUBJECT_CODE },
            },
            select: {
                id: true,
                code: true,
                gradeLevels: true,
                programScopes: true,
            },
        }),
    ]);
    const ownershipFacultyIds = Array.from(new Set(ownershipRows.map((row) => row.facultyId)));
    const ownershipFaculty = ownershipFacultyIds.length
        ? await prisma.facultyMirror.findMany({
            where: { id: { in: ownershipFacultyIds } },
            select: { id: true, firstName: true, lastName: true, isStale: true, isPlaceholder: true },
        })
        : [];
    const ownershipFacultyById = new Map(ownershipFaculty.map((member) => [member.id, member]));
    const ownershipByFacultySubjectId = new Map();
    const specializationByFacultySubjectId = new Map();
    for (const row of ownershipRows) {
        const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set();
        existing.add(row.sectionId);
        ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
        const specializationMap = specializationByFacultySubjectId.get(row.facultySubjectId) ?? new Map();
        specializationMap.set(row.sectionId, {
            specializationCode: row.specializationCode ?? null,
            specializationLabel: row.specializationLabel ?? null,
        });
        specializationByFacultySubjectId.set(row.facultySubjectId, specializationMap);
    }
    const teachablePairSet = new Set();
    for (const subject of activeSubjects) {
        for (const section of currentYearSectionScope) {
            if (!gradeLevelMatches(subject.gradeLevels, section.gradeLevel)) {
                continue;
            }
            if (!isProgramScopeCompatible(subject.programScopes, section.programType)) {
                continue;
            }
            teachablePairSet.add(`${subject.id}:${section.id}`);
        }
    }
    const activeSchedulingFacultyIdSet = new Set(faculty.filter((member) => member.isActiveForScheduling).map((member) => member.id));
    const activePlaceholderFacultyIdSet = new Set(faculty
        .filter((member) => member.isActiveForScheduling && member.isPlaceholder)
        .map((member) => member.id));
    const activeOwnershipRows = ownershipRows.filter((row) => activeSchedulingFacultyIdSet.has(row.facultyId));
    const ownershipIndex = activeOwnershipRows.map((row) => {
        const owner = ownershipFacultyById.get(row.facultyId);
        return {
            subjectId: row.subjectId,
            sectionId: row.sectionId,
            facultyId: row.facultyId,
            facultyName: owner ? formatFacultyName(owner.firstName, owner.lastName) : `Faculty #${row.facultyId}`,
            specializationCode: row.specializationCode ?? null,
            specializationLabel: row.specializationLabel ?? null,
        };
    });
    const rawAssignedPairSet = new Set();
    for (const row of ownershipRows) {
        const key = `${row.subjectId}:${row.sectionId}`;
        if (teachablePairSet.has(key)) {
            rawAssignedPairSet.add(key);
        }
    }
    const realAssignedPairSet = new Set();
    const syntheticAssignedPairSet = new Set();
    for (const row of activeOwnershipRows) {
        const key = `${row.subjectId}:${row.sectionId}`;
        if (teachablePairSet.has(key)) {
            if (activePlaceholderFacultyIdSet.has(row.facultyId)) {
                syntheticAssignedPairSet.add(key);
            }
            else {
                realAssignedPairSet.add(key);
            }
        }
    }
    const syntheticOnlyPairCount = Array.from(syntheticAssignedPairSet).filter((key) => !realAssignedPairSet.has(key)).length;
    const realPairCount = realAssignedPairSet.size;
    const assignedPairCount = realPairCount + syntheticOnlyPairCount;
    const rawAssignedPairCount = rawAssignedPairSet.size;
    let emptySectionRows = 0;
    let currentYearRowsMissingOwnership = 0;
    let currentYearOwnershipWithoutMatchingScope = 0;
    let currentYearMissingOwnershipPairs = 0;
    let currentYearOwnershipWithoutMatchingScopePairs = 0;
    let staleOwnershipRowCount = 0;
    let quarantinedZombieCount = 0;
    let staleAdvisoryCount = 0;
    const emptySectionSamples = [];
    const missingOwnershipSamples = [];
    const ownershipWithoutScopeSamples = [];
    const staleOwnershipSamples = [];
    const quarantinedZombieSamples = [];
    const staleAdvisorySamples = [];
    const maxDiagnosticSamples = 20;
    const subjectCodeById = new Map(activeSubjects.map((subject) => [subject.id, subject.code]));
    const staleOwnedPairSet = new Set();
    const stalePlaceholderPairSet = new Set();
    const staleNonPlaceholderPairSet = new Set();
    for (const row of ownershipRows) {
        const owner = ownershipFacultyById.get(row.facultyId);
        if (!owner || owner.isStale !== true) {
            continue;
        }
        staleOwnershipRowCount += 1;
        const key = `${row.subjectId}:${row.sectionId}`;
        if (teachablePairSet.has(key)) {
            staleOwnedPairSet.add(key);
            if (owner.isPlaceholder) {
                stalePlaceholderPairSet.add(key);
            }
            else {
                staleNonPlaceholderPairSet.add(key);
            }
        }
        if (staleOwnershipSamples.length < maxDiagnosticSamples && teachablePairSet.has(key)) {
            const subject = subjectCodeById.get(row.subjectId);
            staleOwnershipSamples.push({
                facultyId: row.facultyId,
                facultyName: formatFacultyName(owner.firstName, owner.lastName),
                isPlaceholder: owner.isPlaceholder,
                subjectId: row.subjectId,
                subjectCode: subject ?? `SUBJECT_${row.subjectId}`,
                sectionId: row.sectionId,
            });
        }
    }
    const facultySummary = faculty
        .filter((member) => {
        const isValidAdviser = member.isClassAdviser &&
            member.advisedSectionId != null &&
            currentYearSectionIdSet.has(member.advisedSectionId);
        if (member.isClassAdviser && !isValidAdviser) {
            staleAdvisoryCount += 1;
            if (staleAdvisorySamples.length < maxDiagnosticSamples) {
                staleAdvisorySamples.push({
                    facultyId: member.id,
                    facultyName: formatFacultyName(member.firstName, member.lastName),
                    subjectId: 0,
                    subjectCode: 'ADVISORY_STALE',
                    sectionCount: 1,
                });
            }
        }
        // QUARANTINE: Narrow filter for zombie legacy mirror rows
        // shape: active, non-placeholder, blank department, zero current teaching-load footprint
        // footprint includes: validated current-year advisory, ancillary load, and facultySubject records
        const isZombie = !member.isPlaceholder &&
            member.isActiveForScheduling &&
            (!member.department || member.department.trim() === '') &&
            member.facultySubjects.length === 0 &&
            (member.ancillaryMinutesPerWeek ?? 0) <= 0 &&
            !isValidAdviser;
        if (isZombie) {
            quarantinedZombieCount += 1;
            if (quarantinedZombieSamples.length < maxDiagnosticSamples) {
                quarantinedZombieSamples.push({
                    facultyId: member.id,
                    facultyName: formatFacultyName(member.firstName, member.lastName),
                    subjectId: 0,
                    subjectCode: 'N/A',
                    sectionCount: 0,
                });
            }
            return false;
        }
        return true;
    })
        .map((member) => {
        const facultyName = formatFacultyName(member.firstName, member.lastName);
        const laneImpactByPair = buildAssignmentLaneImpactByPair(member.facultySubjects.map((assignment) => ({
            subjectId: assignment.subjectId,
            sectionIds: assignment.sectionIds,
            subject: assignment.subject,
        })));
        let realAssignmentRowCount = 0;
        let baselineSubjectCount = 0;
        let missingOwnershipSubjectCount = 0;
        let ownershipWithoutScopeSubjectCount = 0;
        const assignments = member.facultySubjects.map((assignment) => {
            const storedCurrentYearSectionIds = assignment.sectionIds
                .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
                .sort((left, right) => left - right);
            const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(assignment.id) ?? [])
                .sort((left, right) => left - right);
            const ownedSectionIdSet = new Set(ownedCurrentYearSectionIds);
            const storedSectionIdSet = new Set(storedCurrentYearSectionIds);
            const missingOwnershipSectionCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSectionIdSet.has(sectionId)).length;
            const ownershipWithoutScopeSectionCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSectionIdSet.has(sectionId)).length;
            const normalized = normalizeStoredAssignmentScope({
                subjectId: assignment.subjectId,
                gradeLevels: deriveGradeLevelsFromSectionIds(ownedCurrentYearSectionIds, sectionDisplayOrderMap),
                sectionIds: ownedCurrentYearSectionIds,
            }, rosterIndex);
            const assignmentKind = normalized.sectionIds.length > 0
                ? 'REAL_OWNERSHIP'
                : storedCurrentYearSectionIds.length > 0
                    ? 'MISSING_OWNERSHIP'
                    : 'BASELINE_ONLY';
            if (assignmentKind === 'REAL_OWNERSHIP') {
                realAssignmentRowCount += 1;
            }
            if (assignmentKind === 'BASELINE_ONLY') {
                baselineSubjectCount += 1;
            }
            if (assignment.sectionIds.length === 0) {
                emptySectionRows += 1;
                if (emptySectionSamples.length < maxDiagnosticSamples) {
                    emptySectionSamples.push({
                        facultyId: member.id,
                        facultyName,
                        subjectId: assignment.subjectId,
                        subjectCode: assignment.subject.code,
                        sectionCount: 0,
                    });
                }
            }
            if (missingOwnershipSectionCount > 0) {
                currentYearRowsMissingOwnership += 1;
                currentYearMissingOwnershipPairs += missingOwnershipSectionCount;
                missingOwnershipSubjectCount += 1;
                if (missingOwnershipSamples.length < maxDiagnosticSamples) {
                    missingOwnershipSamples.push({
                        facultyId: member.id,
                        facultyName,
                        subjectId: assignment.subjectId,
                        subjectCode: assignment.subject.code,
                        sectionCount: missingOwnershipSectionCount,
                    });
                }
            }
            if (ownershipWithoutScopeSectionCount > 0) {
                currentYearOwnershipWithoutMatchingScope += 1;
                currentYearOwnershipWithoutMatchingScopePairs += ownershipWithoutScopeSectionCount;
                ownershipWithoutScopeSubjectCount += 1;
                if (ownershipWithoutScopeSamples.length < maxDiagnosticSamples) {
                    ownershipWithoutScopeSamples.push({
                        facultyId: member.id,
                        facultyName,
                        subjectId: assignment.subjectId,
                        subjectCode: assignment.subject.code,
                        sectionCount: ownershipWithoutScopeSectionCount,
                    });
                }
            }
            return toAssignmentResponse(assignment, normalized, {
                assignmentKind,
                storedCurrentYearSectionCount: storedCurrentYearSectionIds.length,
                ownedCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
                missingOwnershipSectionCount,
                ownershipWithoutScopeSectionCount,
                specializationBySectionId: specializationByFacultySubjectId.get(assignment.id),
                laneImpactBySectionId: new Map(ownedCurrentYearSectionIds.map((sectionId) => [
                    sectionId,
                    laneImpactByPair.get(`${assignment.subjectId}:${sectionId}`) ?? (() => {
                        const fallbackFamily = resolveLoadRotationFamily(assignment.subject);
                        const fallbackTermMetadata = resolveRotationTermMetadata({
                            subjectCode: assignment.subject.code,
                            rotationFamily: fallbackFamily,
                            modularGroupId: assignment.subject.modularGroupId,
                            modularOrder: assignment.subject.modularOrder,
                            termGroupId: assignment.subject.termGroupId,
                            termCount: assignment.subject.termCount,
                        });
                        return {
                            rotationFamily: fallbackFamily,
                            rotationLaneId: fallbackFamily
                                ? buildRotationConcurrentLaneId(fallbackFamily, fallbackTermMetadata.termRank, sectionId)
                                : `subject:${assignment.subjectId}:${sectionId}`,
                            rotationTermRank: fallbackTermMetadata.termRank,
                            rotationTermLabel: fallbackTermMetadata.termLabel,
                            rotationTermGroupId: fallbackTermMetadata.termGroupId,
                            rotationTermCount: fallbackTermMetadata.termCount,
                            rawMinutesPerWeek: Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0),
                            concurrentDeltaMinutesPerWeek: Math.max(0, Number(assignment.subject.minMinutesPerWeek) || 0),
                            expandsConcurrentDemand: true,
                        };
                    })(),
                ])),
            });
        });
        const isValidAdviser = member.isClassAdviser &&
            member.advisedSectionId != null &&
            currentYearSectionIdSet.has(member.advisedSectionId);
        const sectionCount = assignments.reduce((sum, assignment) => sum + assignment.sectionIds.length, 0);
        const sectionLoadComputation = computeTeachingLoadMinuteComputation(assignments, 'section');
        const gradeLoadComputation = computeTeachingLoadMinuteComputation(assignments, 'grade');
        const sectionMinutes = sectionLoadComputation.creditedMinutes;
        const gradeMinutes = gradeLoadComputation.creditedMinutes;
        const sectionTeachingHours = roundHours(sectionMinutes);
        const sectionTeachingHoursRaw = roundHours(sectionLoadComputation.rawMinutes);
        const rotationFamilyOvercountHours = roundHours(Math.max(0, sectionLoadComputation.rawMinutes - sectionLoadComputation.creditedMinutes));
        const gradeTeachingHours = roundHours(gradeMinutes);
        const advisoryHours = isValidAdviser ? Math.round(Math.max(0, Number(member.advisoryEquivalentHours || 0)) * 10) / 10 : 0;
        const ancillaryHours = Math.round((Math.max(0, Number(member.ancillaryMinutesPerWeek || 0)) / 60) * 10) / 10;
        const policyCreditedHours = Math.round((sectionTeachingHours + advisoryHours + ancillaryHours) * 10) / 10;
        const policyLoadPercentage = member.maxHoursPerWeek > 0
            ? Math.round((policyCreditedHours / member.maxHoursPerWeek) * 100)
            : 0;
        const loadSignalMode = member.isPlaceholder ? 'SYNTHETIC_PLACEHOLDER' : 'STANDARD';
        const syntheticCoverageHours = member.isPlaceholder ? sectionTeachingHours : 0;
        return {
            id: member.id,
            externalId: member.externalId,
            isPlaceholder: member.isPlaceholder,
            employeeId: member.employeeId,
            firstName: member.firstName,
            lastName: member.lastName,
            department: member.department,
            specialization: member.specialization,
            employmentStatus: member.employmentStatus,
            isClassAdviser: isValidAdviser,
            advisedSectionId: isValidAdviser ? member.advisedSectionId : null,
            advisedSectionName: isValidAdviser ? member.advisedSectionName : null,
            advisoryEquivalentHours: isValidAdviser ? member.advisoryEquivalentHours : 0,
            ancillaryMinutesPerWeek: member.ancillaryMinutesPerWeek,
            canTeachOutsideDepartment: member.canTeachOutsideDepartment,
            isActiveForScheduling: member.isActiveForScheduling,
            maxHoursPerWeek: member.maxHoursPerWeek,
            version: member.version,
            subjectCount: realAssignmentRowCount,
            sectionCount,
            baselineSubjectCount,
            missingOwnershipSubjectCount,
            ownershipWithoutScopeSubjectCount,
            subjectHours: policyCreditedHours,
            loadPercentage: policyLoadPercentage,
            sectionTeachingHours,
            sectionTeachingHoursRaw,
            rotationFamilyOvercountHours,
            rotationFamilyLoadDetails: sectionLoadComputation.rotationFamilies.map((family) => ({
                family: family.family,
                rawHours: roundHours(family.rawMinutes),
                creditedHours: roundHours(family.creditedMinutes),
                overcountHours: roundHours(family.overcountMinutes),
                unitCount: family.unitCount,
                dominantTermRank: family.dominantTermRank,
                dominantTermLabel: family.dominantTermLabel,
                termGroupId: family.termGroupId,
                termCount: family.termCount,
                termBuckets: family.termBuckets.map((bucket) => ({
                    termRank: bucket.termRank,
                    termLabel: bucket.termLabel,
                    termGroupId: bucket.termGroupId,
                    termCount: bucket.termCount,
                    creditedHours: roundHours(bucket.creditedMinutes),
                    unitCount: bucket.unitCount,
                    subjectCodes: bucket.subjectCodes,
                    subjectIds: bucket.subjectIds,
                })),
                subjectCodes: family.subjectCodes,
                subjectIds: family.subjectIds,
            })),
            gradeTeachingHours,
            advisoryHours,
            ancillaryHours,
            policyCreditedHours,
            policyLoadPercentage,
            syntheticCoverageHours,
            loadSignalMode,
            assignments,
        };
    });
    const coverageTotals = {
        assignedPairs: assignedPairCount,
        activeAssignedPairs: assignedPairCount,
        realFacultyAssignedPairs: realPairCount,
        syntheticPlaceholderPairs: syntheticOnlyPairCount,
        rawAssignedPairs: rawAssignedPairCount,
        totalPairs: teachablePairSet.size,
        unassignedPairs: Math.max(0, teachablePairSet.size - assignedPairCount),
        rawUnassignedPairs: Math.max(0, teachablePairSet.size - rawAssignedPairCount),
    };
    const integrityDiagnostics = {
        emptySectionRows,
        currentYearRowsMissingOwnership,
        currentYearOwnershipWithoutMatchingScope,
        currentYearMissingOwnershipPairs,
        currentYearOwnershipWithoutMatchingScopePairs,
        staleOwnershipRowCount,
        staleOwnedCurrentYearPairCount: staleOwnedPairSet.size,
        stalePlaceholderPairCount: stalePlaceholderPairSet.size,
        staleNonPlaceholderPairCount: staleNonPlaceholderPairSet.size,
        emptySectionSamples,
        missingOwnershipSamples,
        ownershipWithoutScopeSamples,
        staleOwnershipSamples,
        quarantinedZombieCount,
        quarantinedZombieSamples,
        staleAdvisoryCount,
        staleAdvisorySamples,
    };
    return {
        faculty: facultySummary,
        ownershipIndex,
        coverageTotals,
        integrityDiagnostics,
    };
}
export async function previewOrApplyTeachingLoadTruthReconcile(input) {
    const rosterIndex = await buildRosterIndex(input.schoolId, input.schoolYearId, input.authToken);
    const currentYearSectionIds = Array.from(rosterIndex.sectionMap.keys());
    const currentYearSectionIdSet = new Set(currentYearSectionIds);
    const sectionDisplayOrderMap = new Map(Array.from(rosterIndex.sectionMap.values()).map((section) => [section.id, section.displayOrder]));
    const [facultySubjects, ownershipRows] = await Promise.all([
        prisma.facultySubject.findMany({
            where: { schoolId: input.schoolId },
            select: {
                id: true,
                facultyId: true,
                subjectId: true,
                sectionIds: true,
                gradeLevels: true,
            },
            orderBy: { id: 'asc' },
        }),
        currentYearSectionIds.length > 0
            ? prisma.subjectSectionOwnership.findMany({
                where: {
                    schoolId: input.schoolId,
                    sectionId: { in: currentYearSectionIds },
                },
                select: {
                    facultySubjectId: true,
                    sectionId: true,
                },
            })
            : Promise.resolve([]),
    ]);
    const ownershipByFacultySubjectId = new Map();
    for (const row of ownershipRows) {
        const existing = ownershipByFacultySubjectId.get(row.facultySubjectId) ?? new Set();
        existing.add(row.sectionId);
        ownershipByFacultySubjectId.set(row.facultySubjectId, existing);
    }
    let rowsWithEmptySectionIds = 0;
    let rowsWithMissingOwnership = 0;
    let rowsWithOwnershipWithoutScope = 0;
    let rowsToUpdate = 0;
    let updatedRows = 0;
    const updates = [];
    for (const row of facultySubjects) {
        const storedCurrentYearSectionIds = row.sectionIds
            .filter((sectionId) => currentYearSectionIdSet.has(sectionId))
            .sort((left, right) => left - right);
        const ownedCurrentYearSectionIds = Array.from(ownershipByFacultySubjectId.get(row.id) ?? [])
            .sort((left, right) => left - right);
        if (row.sectionIds.length === 0) {
            rowsWithEmptySectionIds += 1;
        }
        const storedSet = new Set(storedCurrentYearSectionIds);
        const ownedSet = new Set(ownedCurrentYearSectionIds);
        const missingOwnershipCount = storedCurrentYearSectionIds.filter((sectionId) => !ownedSet.has(sectionId)).length;
        const ownershipWithoutScopeCount = ownedCurrentYearSectionIds.filter((sectionId) => !storedSet.has(sectionId)).length;
        if (missingOwnershipCount > 0) {
            rowsWithMissingOwnership += 1;
        }
        if (ownershipWithoutScopeCount > 0) {
            rowsWithOwnershipWithoutScope += 1;
        }
        if (missingOwnershipCount === 0 && ownershipWithoutScopeCount === 0) {
            continue;
        }
        const nonCurrentYearSectionIds = row.sectionIds.filter((sectionId) => !currentYearSectionIdSet.has(sectionId));
        const nextSectionIds = Array.from(new Set([...nonCurrentYearSectionIds, ...ownedCurrentYearSectionIds]))
            .sort((left, right) => left - right);
        const nextGradeLevels = deriveGradeLevelsFromSectionIds(nextSectionIds, sectionDisplayOrderMap);
        rowsToUpdate += 1;
        updates.push({
            facultySubjectId: row.id,
            facultyId: row.facultyId,
            subjectId: row.subjectId,
            previousCurrentYearSectionCount: storedCurrentYearSectionIds.length,
            nextCurrentYearSectionCount: ownedCurrentYearSectionIds.length,
            nextSectionIds,
            nextGradeLevels,
        });
    }
    if (input.previewOnly === false && updates.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const update of updates) {
                await tx.facultySubject.update({
                    where: { id: update.facultySubjectId },
                    data: {
                        sectionIds: update.nextSectionIds,
                        gradeLevels: update.nextGradeLevels,
                    },
                });
            }
        });
        updatedRows = updates.length;
    }
    const sampleUpdates = updates
        .slice(0, 25)
        .map((update) => ({
        facultySubjectId: update.facultySubjectId,
        facultyId: update.facultyId,
        subjectId: update.subjectId,
        previousCurrentYearSectionCount: update.previousCurrentYearSectionCount,
        nextCurrentYearSectionCount: update.nextCurrentYearSectionCount,
    }));
    return {
        applied: input.previewOnly === false,
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        facultySubjectRowsScanned: facultySubjects.length,
        rowsWithEmptySectionIds,
        rowsWithMissingOwnership,
        rowsWithOwnershipWithoutScope,
        rowsToUpdate,
        updatedRows,
        sampleUpdates,
    };
}
export async function previewOrApplyStaleOwnershipReconcile(input) {
    const sectionIds = await resolveSchoolYearSectionIds(input.schoolId, input.schoolYearId, input.authToken);
    if (sectionIds.length === 0) {
        return {
            applied: false,
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            staleOwnershipRowCount: 0,
            staleOwnedCurrentYearPairCount: 0,
            stalePlaceholderPairCount: 0,
            staleNonPlaceholderPairCount: 0,
            affectedFacultySubjectRows: 0,
            deletedOwnershipRows: 0,
            deletedFacultySubjectRows: 0,
            updatedFacultySubjectRows: 0,
            affectedSubjects: [],
            sampleRows: [],
        };
    }
    const currentYearSectionIdSet = new Set(sectionIds);
    const ownershipRows = await prisma.subjectSectionOwnership.findMany({
        where: {
            schoolId: input.schoolId,
            sectionId: { in: sectionIds },
        },
        select: {
            id: true,
            facultySubjectId: true,
            facultyId: true,
            subjectId: true,
            sectionId: true,
        },
    });
    const ownershipFacultyIds = [...new Set(ownershipRows.map((row) => row.facultyId))];
    const staleFacultyRows = ownershipFacultyIds.length
        ? await prisma.facultyMirror.findMany({
            where: {
                id: { in: ownershipFacultyIds },
                isStale: true,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                isPlaceholder: true,
            },
        })
        : [];
    const staleFacultyById = new Map(staleFacultyRows.map((row) => [row.id, row]));
    const staleOwnershipRows = ownershipRows.filter((row) => staleFacultyById.has(row.facultyId));
    const staleOwnedPairSet = new Set();
    const stalePlaceholderPairSet = new Set();
    const staleNonPlaceholderPairSet = new Set();
    const subjectStats = new Map();
    const sampleRows = [];
    for (const row of staleOwnershipRows) {
        const staleOwner = staleFacultyById.get(row.facultyId);
        if (!staleOwner)
            continue;
        const pairKey = `${row.subjectId}:${row.sectionId}`;
        staleOwnedPairSet.add(pairKey);
        if (staleOwner.isPlaceholder) {
            stalePlaceholderPairSet.add(pairKey);
        }
        else {
            staleNonPlaceholderPairSet.add(pairKey);
        }
        const stat = subjectStats.get(row.subjectId) ?? { staleRowCount: 0, stalePairs: new Set() };
        stat.staleRowCount += 1;
        stat.stalePairs.add(pairKey);
        subjectStats.set(row.subjectId, stat);
        if (sampleRows.length < 30) {
            sampleRows.push({
                facultyId: row.facultyId,
                facultyName: formatFacultyName(staleOwner.firstName, staleOwner.lastName),
                isPlaceholder: staleOwner.isPlaceholder,
                subjectId: row.subjectId,
                subjectCode: `SUBJECT_${row.subjectId}`,
                sectionId: row.sectionId,
            });
        }
    }
    const subjectIds = [...new Set(staleOwnershipRows.map((row) => row.subjectId))];
    const subjectRows = subjectIds.length
        ? await prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, code: true },
        })
        : [];
    const subjectCodeById = new Map(subjectRows.map((subject) => [subject.id, subject.code]));
    for (const sample of sampleRows) {
        sample.subjectCode = subjectCodeById.get(sample.subjectId) ?? sample.subjectCode;
    }
    const affectedSubjects = [...subjectStats.entries()]
        .map(([subjectId, stat]) => ({
        subjectId,
        subjectCode: subjectCodeById.get(subjectId) ?? `SUBJECT_${subjectId}`,
        staleRowCount: stat.staleRowCount,
        stalePairCount: stat.stalePairs.size,
    }))
        .sort((left, right) => right.stalePairCount - left.stalePairCount || left.subjectCode.localeCompare(right.subjectCode));
    const affectedFacultySubjectIds = [...new Set(staleOwnershipRows.map((row) => row.facultySubjectId))];
    if (input.previewOnly !== false || staleOwnershipRows.length === 0) {
        return {
            applied: false,
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            staleOwnershipRowCount: staleOwnershipRows.length,
            staleOwnedCurrentYearPairCount: staleOwnedPairSet.size,
            stalePlaceholderPairCount: stalePlaceholderPairSet.size,
            staleNonPlaceholderPairCount: staleNonPlaceholderPairSet.size,
            affectedFacultySubjectRows: affectedFacultySubjectIds.length,
            deletedOwnershipRows: 0,
            deletedFacultySubjectRows: 0,
            updatedFacultySubjectRows: 0,
            affectedSubjects,
            sampleRows,
        };
    }
    let deletedFacultySubjectRows = 0;
    let updatedFacultySubjectRows = 0;
    await prisma.$transaction(async (tx) => {
        await tx.subjectSectionOwnership.deleteMany({
            where: { id: { in: staleOwnershipRows.map((row) => row.id) } },
        });
        if (affectedFacultySubjectIds.length === 0) {
            return;
        }
        const [affectedFacultySubjects, remainingOwnershipRows] = await Promise.all([
            tx.facultySubject.findMany({
                where: { id: { in: affectedFacultySubjectIds } },
                select: { id: true, sectionIds: true },
            }),
            tx.subjectSectionOwnership.findMany({
                where: { facultySubjectId: { in: affectedFacultySubjectIds } },
                select: { facultySubjectId: true, sectionId: true },
            }),
        ]);
        const remainingSectionsByFacultySubject = new Map();
        for (const row of remainingOwnershipRows) {
            const existing = remainingSectionsByFacultySubject.get(row.facultySubjectId) ?? new Set();
            existing.add(row.sectionId);
            remainingSectionsByFacultySubject.set(row.facultySubjectId, existing);
        }
        const staleSectionsByFacultySubject = new Map();
        for (const row of staleOwnershipRows) {
            const existing = staleSectionsByFacultySubject.get(row.facultySubjectId) ?? new Set();
            existing.add(row.sectionId);
            staleSectionsByFacultySubject.set(row.facultySubjectId, existing);
        }
        for (const row of affectedFacultySubjects) {
            const staleSections = staleSectionsByFacultySubject.get(row.id) ?? new Set();
            const nonCurrentOrUntouchedSections = row.sectionIds.filter((sectionId) => {
                if (!currentYearSectionIdSet.has(sectionId)) {
                    return true;
                }
                return !staleSections.has(sectionId);
            });
            const remainingSections = [...(remainingSectionsByFacultySubject.get(row.id) ?? new Set())];
            const nextSectionIds = [...new Set([...nonCurrentOrUntouchedSections, ...remainingSections])].sort((left, right) => left - right);
            if (nextSectionIds.length === 0) {
                await tx.facultySubject.delete({ where: { id: row.id } });
                deletedFacultySubjectRows += 1;
            }
            else {
                await tx.facultySubject.update({
                    where: { id: row.id },
                    data: { sectionIds: nextSectionIds },
                });
                updatedFacultySubjectRows += 1;
            }
        }
    });
    console.info('[TEACHING_LOAD_STALE_OWNERSHIP_RECONCILE_APPLY]', JSON.stringify({
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        actorId: input.actorId,
        staleOwnershipRowsRemoved: staleOwnershipRows.length,
        staleOwnedCurrentYearPairCount: staleOwnedPairSet.size,
        deletedFacultySubjectRows,
        updatedFacultySubjectRows,
        occurredAt: new Date().toISOString(),
    }));
    return {
        applied: true,
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        staleOwnershipRowCount: staleOwnershipRows.length,
        staleOwnedCurrentYearPairCount: staleOwnedPairSet.size,
        stalePlaceholderPairCount: stalePlaceholderPairSet.size,
        staleNonPlaceholderPairCount: staleNonPlaceholderPairSet.size,
        affectedFacultySubjectRows: affectedFacultySubjectIds.length,
        deletedOwnershipRows: staleOwnershipRows.length,
        deletedFacultySubjectRows,
        updatedFacultySubjectRows,
        affectedSubjects,
        sampleRows,
    };
}
export async function getFacultyAssignmentIdentitySummary(facultyId, schoolYearId, authToken) {
    const assignmentState = await getAssignmentsByFaculty(facultyId, schoolYearId, authToken);
    if (!assignmentState) {
        return [];
    }
    return assignmentState.assignments
        .flatMap((assignment) => assignment.sections.map((section) => ({
        subjectId: assignment.subject.id,
        subjectCode: assignment.subject.code,
        subjectName: assignment.subject.name,
        subjectDisplayLabel: assignment.subject.code === 'SPA_SPEC' || assignment.subject.code === 'SPS_SPEC'
            ? 'SPECIALIZATION'
            : assignment.subject.code,
        sectionId: section.id,
        sectionName: section.name,
        gradeLevel: section.displayOrder,
        specializationCode: section.assignmentSpecializationCode ?? null,
        specializationLabel: section.assignmentSpecializationLabel ?? null,
    })))
        .sort((left, right) => left.gradeLevel - right.gradeLevel || left.sectionName.localeCompare(right.sectionName) || left.subjectCode.localeCompare(right.subjectCode));
}
async function resolveSchoolYearSectionIds(schoolId, schoolYearId, authToken) {
    const sectionResult = await fetchSectionsForRuntimeControls(schoolId, schoolYearId, {
        authToken,
        preferLocalEvidenceFirst: true,
    });
    const ids = [];
    for (const grade of sectionResult.gradeLevels) {
        for (const section of grade.sections) {
            if (section.id > 0) {
                ids.push(section.id);
            }
        }
    }
    return [...new Set(ids)];
}
function buildResetPreview(input, ownershipRows, facultySubjects, subjectCodesById) {
    const removableSectionIdsByFacultySubject = new Map();
    const affectedFacultyIds = new Set();
    const affectedSubjectIds = new Set();
    for (const row of ownershipRows) {
        affectedFacultyIds.add(row.facultyId);
        affectedSubjectIds.add(row.subjectId);
        const existing = removableSectionIdsByFacultySubject.get(row.facultySubjectId) ?? new Set();
        existing.add(row.sectionId);
        removableSectionIdsByFacultySubject.set(row.facultySubjectId, existing);
    }
    let facultySubjectRowsDeleted = 0;
    let facultySubjectRowsUpdated = 0;
    for (const row of facultySubjects) {
        const removable = removableSectionIdsByFacultySubject.get(row.id);
        if (!removable || removable.size === 0)
            continue;
        const remaining = row.sectionIds.filter((sectionId) => !removable.has(sectionId));
        if (remaining.length === 0) {
            facultySubjectRowsDeleted += 1;
        }
        else {
            facultySubjectRowsUpdated += 1;
        }
    }
    const subjectCodes = [...affectedSubjectIds]
        .map((id) => subjectCodesById.get(id) ?? `SUBJECT_${id}`)
        .sort((left, right) => left.localeCompare(right));
    return {
        applied: false,
        scope: typeof input.subjectId === 'number' ? 'SUBJECT' : 'GLOBAL',
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        subjectId: typeof input.subjectId === 'number' ? input.subjectId : null,
        ownershipRowsToRemove: ownershipRows.length,
        facultySubjectRowsAffected: facultySubjects.length,
        facultySubjectRowsDeleted,
        facultySubjectRowsUpdated,
        affectedFacultyCount: affectedFacultyIds.size,
        affectedSubjectCount: affectedSubjectIds.size,
        subjectCodes,
    };
}
export async function previewOrApplyTeachingLoadReset(input) {
    const sectionIds = await resolveSchoolYearSectionIds(input.schoolId, input.schoolYearId, input.authToken);
    if (sectionIds.length === 0) {
        return {
            applied: false,
            scope: typeof input.subjectId === 'number' ? 'SUBJECT' : 'GLOBAL',
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            subjectId: typeof input.subjectId === 'number' ? input.subjectId : null,
            ownershipRowsToRemove: 0,
            facultySubjectRowsAffected: 0,
            facultySubjectRowsDeleted: 0,
            facultySubjectRowsUpdated: 0,
            affectedFacultyCount: 0,
            affectedSubjectCount: 0,
            subjectCodes: [],
        };
    }
    const ownershipFilter = {
        schoolId: input.schoolId,
        sectionId: { in: sectionIds },
        ...(typeof input.subjectId === 'number' ? { subjectId: input.subjectId } : {}),
    };
    const ownershipRows = await prisma.subjectSectionOwnership.findMany({
        where: ownershipFilter,
        select: {
            id: true,
            facultySubjectId: true,
            facultyId: true,
            subjectId: true,
            sectionId: true,
        },
    });
    const facultySubjectIds = [...new Set(ownershipRows.map((row) => row.facultySubjectId))];
    const subjectIds = [...new Set(ownershipRows.map((row) => row.subjectId))];
    const [facultySubjects, subjects] = await Promise.all([
        facultySubjectIds.length > 0
            ? prisma.facultySubject.findMany({
                where: { id: { in: facultySubjectIds } },
                select: { id: true, facultyId: true, subjectId: true, sectionIds: true },
            })
            : Promise.resolve([]),
        subjectIds.length > 0
            ? prisma.subject.findMany({
                where: { id: { in: subjectIds } },
                select: { id: true, code: true },
            })
            : Promise.resolve([]),
    ]);
    const subjectCodesById = new Map(subjects.map((subject) => [subject.id, subject.code]));
    const preview = buildResetPreview(input, ownershipRows, facultySubjects, subjectCodesById);
    if (input.previewOnly !== false) {
        return preview;
    }
    const removableSectionsByFacultySubject = new Map();
    for (const row of ownershipRows) {
        const existing = removableSectionsByFacultySubject.get(row.facultySubjectId) ?? new Set();
        existing.add(row.sectionId);
        removableSectionsByFacultySubject.set(row.facultySubjectId, existing);
    }
    await prisma.$transaction(async (tx) => {
        if (ownershipRows.length > 0) {
            await tx.subjectSectionOwnership.deleteMany({
                where: { id: { in: ownershipRows.map((row) => row.id) } },
            });
        }
        for (const row of facultySubjects) {
            const removable = removableSectionsByFacultySubject.get(row.id);
            if (!removable || removable.size === 0)
                continue;
            const nextSectionIds = row.sectionIds.filter((sectionId) => !removable.has(sectionId));
            if (nextSectionIds.length === 0) {
                const remainingOwnershipRows = await tx.subjectSectionOwnership.count({ where: { facultySubjectId: row.id } });
                if (remainingOwnershipRows === 0) {
                    await tx.facultySubject.delete({ where: { id: row.id } });
                }
                continue;
            }
            await tx.facultySubject.update({
                where: { id: row.id },
                data: { sectionIds: [...new Set(nextSectionIds)].sort((left, right) => left - right) },
            });
        }
    });
    const appliedResult = {
        ...preview,
        applied: true,
    };
    console.info('[TEACHING_LOAD_RESET_APPLY]', JSON.stringify({
        ...appliedResult,
        actorId: input.actorId,
        occurredAt: new Date().toISOString(),
    }));
    return appliedResult;
}
//# sourceMappingURL=faculty-assignment.service.js.map