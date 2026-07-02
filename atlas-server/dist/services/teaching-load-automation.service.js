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
import { fetchSectionsForRuntimeControls } from './section.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { matchesSubjectOwnershipDepartment, normalizeDepartmentCode, resolveRotationTermMetadata, resolveSubjectAllowedOwnerDepartments, resolveSubjectRotationFamily, resolveSubjectOwnerDepartmentCode, } from './subject-ownership.service.js';
import { getActiveSubjectCoverageSummary, getAssignmentSummary, previewOrApplyRealFacultyRecovery, previewOrApplyTeachingLoadTruthReconcile, previewOrApplyStaleOwnershipReconcile, repairActiveSubjectCoverageWithPlaceholders, } from './faculty-assignment.service.js';
// DO 005 s.2024 weekly minute caps
const STANDARD_CAP_MIN = 1_800;
const HARD_CAP_MIN = 2_400;
const TRUE_LOAD_OUTLIER_OVERLOAD_HOURS = 24;
const TRUE_LOAD_OUTLIER_POLICY_MULTIPLIER = 2;
export const COVERAGE_MODES = [
    'REAL_FACULTY_STANDARD',
    'REAL_FACULTY_HARD_CAP',
    'REAL_FACULTY_THEN_TEACHER_X',
];
const DEFAULT_COVERAGE_MODE = 'REAL_FACULTY_STANDARD';
const REAL_ONLY_STANDARD_MODE = 'REAL_FACULTY_STANDARD';
const REAL_ONLY_HARD_CAP_MODE = 'REAL_FACULTY_HARD_CAP';
async function fetchSectionsForAutoFill(schoolId, schoolYearId, authToken) {
    return fetchSectionsForRuntimeControls(schoolId, schoolYearId, {
        authToken,
        preferLocalEvidenceFirst: true,
    });
}
/**
 * Convert maxHoursPerWeek to minutes/week for capacity calculations.
 * FacultyMirror.maxHoursPerWeek stores the limit in hours (default 30).
 */
function resolveRealFacultyCapMinutes(faculty, mode) {
    if (mode === REAL_ONLY_STANDARD_MODE) {
        return Math.min(Math.max(0, faculty.maxHoursPerWeek * 60), STANDARD_CAP_MIN);
    }
    // Hard-cap modes explicitly allow up to 40h/week policy-credited load.
    return HARD_CAP_MIN;
}
function resolveRealCoverageMode(coverageMode) {
    return coverageMode === REAL_ONLY_STANDARD_MODE ? REAL_ONLY_STANDARD_MODE : REAL_ONLY_HARD_CAP_MODE;
}
function cloneCapacityLedgers(source) {
    const cloned = new Map();
    for (const [facultyId, ledger] of source.entries()) {
        cloned.set(facultyId, {
            lanes: new Map(ledger.lanes),
            nonRotationMinutes: ledger.nonRotationMinutes,
            rotationFamilyTermTotals: new Map(Array.from(ledger.rotationFamilyTermTotals.entries()).map(([family, totals]) => [family, new Map(totals)])),
            creditedMinutes: ledger.creditedMinutes,
        });
    }
    return cloned;
}
function parseCapacityLaneDescriptor(laneKey) {
    const rotationMatch = /^family:([^:]+):term:(\d+):\d+$/.exec(laneKey);
    if (rotationMatch) {
        return {
            kind: 'rotation',
            family: rotationMatch[1],
            termKey: Number(rotationMatch[2]),
        };
    }
    return { kind: 'non-rotation' };
}
function getFamilyPeakMinutes(termTotals) {
    let peak = 0;
    for (const value of termTotals.values()) {
        if (value > peak) {
            peak = value;
        }
    }
    return peak;
}
function createEmptyCapacityLedger() {
    return {
        lanes: new Map(),
        nonRotationMinutes: 0,
        rotationFamilyTermTotals: new Map(),
        creditedMinutes: 0,
    };
}
function estimateCapacityLaneDeltaMinutes(ledger, laneKey, nextLaneMinutes) {
    const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
    if (normalizedMinutes <= 0) {
        return 0;
    }
    const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
    if (normalizedMinutes <= currentLaneMinutes) {
        return 0;
    }
    const laneIncrease = normalizedMinutes - currentLaneMinutes;
    const descriptor = parseCapacityLaneDescriptor(laneKey);
    if (descriptor.kind === 'non-rotation') {
        return laneIncrease;
    }
    const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map();
    const termTotalBefore = termTotals.get(descriptor.termKey) ?? 0;
    const peakBefore = getFamilyPeakMinutes(termTotals);
    const termTotalAfter = termTotalBefore + laneIncrease;
    const peakAfter = Math.max(peakBefore, termTotalAfter);
    return Math.max(0, peakAfter - peakBefore);
}
function estimateProjectedRotationFamilyPeakMinutes(ledger, laneKey, nextLaneMinutes) {
    const descriptor = parseCapacityLaneDescriptor(laneKey);
    if (descriptor.kind === 'non-rotation') {
        return 0;
    }
    const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
    const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
    const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map();
    const termTotalBefore = termTotals.get(descriptor.termKey) ?? 0;
    const peakBefore = getFamilyPeakMinutes(termTotals);
    const laneIncrease = Math.max(0, normalizedMinutes - currentLaneMinutes);
    const termTotalAfter = termTotalBefore + laneIncrease;
    return Math.max(peakBefore, termTotalAfter);
}
function applyCapacityLaneMinutesToLedger(ledger, laneKey, nextLaneMinutes) {
    const deltaMinutes = estimateCapacityLaneDeltaMinutes(ledger, laneKey, nextLaneMinutes);
    if (deltaMinutes <= 0) {
        return 0;
    }
    const normalizedMinutes = Math.max(0, Number(nextLaneMinutes) || 0);
    const currentLaneMinutes = ledger.lanes.get(laneKey) ?? 0;
    const laneIncrease = normalizedMinutes - currentLaneMinutes;
    ledger.lanes.set(laneKey, normalizedMinutes);
    const descriptor = parseCapacityLaneDescriptor(laneKey);
    if (descriptor.kind === 'non-rotation') {
        ledger.nonRotationMinutes += laneIncrease;
    }
    else {
        const termTotals = ledger.rotationFamilyTermTotals.get(descriptor.family) ?? new Map();
        const termTotalBefore = termTotals.get(descriptor.termKey) ?? 0;
        termTotals.set(descriptor.termKey, termTotalBefore + laneIncrease);
        ledger.rotationFamilyTermTotals.set(descriptor.family, termTotals);
    }
    ledger.creditedMinutes += deltaMinutes;
    return deltaMinutes;
}
function createCapacityLedgerFromLanes(lanes) {
    const ledger = createEmptyCapacityLedger();
    for (const [laneKey, laneMinutes] of lanes.entries()) {
        const normalized = Math.max(0, Number(laneMinutes) || 0);
        if (normalized <= 0) {
            continue;
        }
        applyCapacityLaneMinutesToLedger(ledger, laneKey, normalized);
    }
    return ledger;
}
export function __testComputeCreditedCapacityMinutes(lanes) {
    return createCapacityLedgerFromLanes(lanes).creditedMinutes;
}
export function __testEstimateCapacityLaneDeltaMinutes(lanes, laneKey, nextLaneMinutes) {
    const ledger = createCapacityLedgerFromLanes(lanes);
    return estimateCapacityLaneDeltaMinutes(ledger, laneKey, nextLaneMinutes);
}
function resolveCapacityRotationFamily(subjectCode, explicitRotationFamily, modularGroupId) {
    const explicit = (explicitRotationFamily ?? '').trim().toUpperCase();
    if (explicit.length > 0) {
        return explicit;
    }
    const fallback = resolveSubjectRotationFamily(subjectCode, modularGroupId ?? null);
    const normalizedFallback = (fallback ?? '').trim().toUpperCase();
    return normalizedFallback.length > 0 ? normalizedFallback : null;
}
function normalizeRotationTermLaneKey(termRank) {
    return Number.isInteger(termRank) && Number(termRank) > 0 ? Number(termRank) : 0;
}
function buildCapacityLaneKey(input) {
    const rotationFamily = resolveCapacityRotationFamily(input.subjectCode, input.rotationFamily, input.modularGroupId ?? null);
    if (!rotationFamily) {
        return `subject:${input.subjectId}:${input.sectionId}`;
    }
    const termMetadata = resolveRotationTermMetadata({
        subjectCode: input.subjectCode,
        rotationFamily,
        modularGroupId: input.modularGroupId ?? null,
        modularOrder: input.modularOrder ?? null,
        termGroupId: input.termGroupId ?? null,
        termCount: input.termCount ?? null,
    });
    return `family:${rotationFamily}:term:${normalizeRotationTermLaneKey(termMetadata.termRank)}:${input.sectionId}`;
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
function buildStaffingReport(unresolvedPairs, faculty, capacityUsed, coverageMode = REAL_ONLY_STANDARD_MODE) {
    const effectiveCoverageMode = resolveRealCoverageMode(coverageMode);
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
        const laneKey = buildCapacityLaneKey({
            subjectId: pair.subjectId,
            subjectCode: pair.subject.code,
            rotationFamily: pair.subject.rotationFamily,
            modularGroupId: pair.subject.modularGroupId,
            modularOrder: pair.subject.modularOrder,
            termGroupId: pair.subject.termGroupId,
            termCount: pair.subject.termCount,
            sectionId: pair.sectionId,
        });
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
        const spareMinutes = Math.max(0, resolveRealFacultyCapMinutes(member, effectiveCoverageMode) - (capacityUsed.get(member.id) ?? 0));
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
        initialSpareByFaculty.set(member.id, Math.max(0, resolveRealFacultyCapMinutes(member, effectiveCoverageMode) - (capacityUsed.get(member.id) ?? 0)));
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
function normalizeSpecializationCode(val) {
    if (!val)
        return null;
    return val.trim().toUpperCase().replace(/\s+/g, '_');
}
function isSpecialProgramSpecializationSubject(subjectCode) {
    const code = (subjectCode ?? '').trim().toUpperCase();
    return code === 'SPA_SPEC' || code === 'SPS_SPEC' || code.startsWith('SPA_') || code.startsWith('SPS_');
}
function isSpecialProgramBaselineDepartment(department) {
    const normalized = normalizeDepartmentCode(department);
    return normalized === 'MAPEH';
}
function isSpecialProgramGeneralistSpecialization(specialization) {
    const normalized = normalizeSpecializationCode(specialization);
    return normalized === 'MAJOR_IN_MAPEH' || normalized === 'MAPEH';
}
function resolveQualificationTier(faculty, subject, aliasesByCanonical) {
    const code = subject.code.toUpperCase();
    if (code === 'HG' || subject.name.toLowerCase().includes('homeroom')) {
        return 1;
    }
    // Tier 1: SpecializationAlias match
    if (faculty.specialization) {
        const normalizedSpecialization = faculty.specialization.trim().toLowerCase();
        const canonKey = subject.code.trim().toLowerCase();
        const aliasSet = aliasesByCanonical.get(canonKey);
        if (aliasSet && aliasSet.has(normalizedSpecialization)) {
            return 1;
        }
    }
    // Tier 2: allowedSpecializations match
    const allowed = (subject.allowedSpecializations ?? []).map((entry) => entry.trim().toLowerCase());
    const normalizedSpecialization = faculty.specialization?.trim().toLowerCase() ?? null;
    const normalizedDepartment = faculty.department?.trim().toLowerCase() ?? null;
    if (normalizedSpecialization && allowed.includes(normalizedSpecialization)) {
        return 2;
    }
    if (normalizedDepartment && allowed.includes(normalizedDepartment)) {
        return 2;
    }
    // Department match
    const isDepartmentOwner = matchesSubjectOwnershipDepartment(faculty.department, subject.code, subject.name, subject.ownerDepartment, subject.requiredFeatures);
    if (isDepartmentOwner) {
        return 2;
    }
    // Special program baseline MAPEH rule
    if (isSpecialProgramSpecializationSubject(subject.code)
        && isSpecialProgramBaselineDepartment(faculty.department)
        && isSpecialProgramGeneralistSpecialization(faculty.specialization)) {
        return 2;
    }
    // Override fallback
    if (faculty.canTeachOutsideDepartment) {
        return 3;
    }
    return null;
}
function compareSubjectsDeterministically(sa, sb) {
    // 1. Constrained / Specialization-bound / Special Program first
    const aConstrained = (sa.allowedSpecializations?.length ?? 0) > 0 || isSpecialProgramSpecializationSubject(sa.code);
    const bConstrained = (sb.allowedSpecializations?.length ?? 0) > 0 || isSpecialProgramSpecializationSubject(sb.code);
    if (aConstrained !== bConstrained) {
        return aConstrained ? -1 : 1;
    }
    // 2. Non-modular vs Modular (non-modular first)
    const aModular = Boolean(sa.modularGroupId);
    const bModular = Boolean(sb.modularGroupId);
    if (aModular !== bModular) {
        return aModular ? 1 : -1;
    }
    if (sa.modularGroupId && sb.modularGroupId) {
        if (sa.modularGroupId !== sb.modularGroupId) {
            return sa.modularGroupId.localeCompare(sb.modularGroupId);
        }
        if ((sa.modularOrder ?? 0) !== (sb.modularOrder ?? 0)) {
            return (sa.modularOrder ?? 0) - (sb.modularOrder ?? 0);
        }
    }
    // 3. Final tie-breaker: alphabetical by code
    return sa.code.localeCompare(sb.code);
}
function buildInitialCapacityTracking(existingOwnerships) {
    const capacityLanesByFaculty = new Map();
    for (const ownership of existingOwnerships) {
        const subject = ownership.facultySubject.subject;
        const mins = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
        if (mins <= 0)
            continue;
        const laneKey = buildCapacityLaneKey({
            subjectId: subject.id,
            subjectCode: subject.code,
            rotationFamily: subject.rotationFamily,
            modularGroupId: subject.modularGroupId,
            modularOrder: subject.modularOrder,
            termGroupId: subject.termGroupId,
            termCount: subject.termCount,
            sectionId: ownership.sectionId,
        });
        const lanes = capacityLanesByFaculty.get(ownership.facultyId) ?? new Map();
        const currentLaneMinutes = lanes.get(laneKey) ?? 0;
        if (mins > currentLaneMinutes) {
            lanes.set(laneKey, mins);
        }
        capacityLanesByFaculty.set(ownership.facultyId, lanes);
    }
    const capacityLedgersByFaculty = new Map();
    const capacityUsed = new Map();
    for (const [facultyId, lanes] of capacityLanesByFaculty.entries()) {
        const ledger = createCapacityLedgerFromLanes(lanes);
        capacityLedgersByFaculty.set(facultyId, ledger);
        capacityUsed.set(facultyId, ledger.creditedMinutes);
    }
    return { capacityLedgersByFaculty, capacityUsed };
}
function compareCoverageCandidateRank(left, right) {
    if (left.tier !== right.tier)
        return left.tier - right.tier;
    if (left.subjectAssignedCount !== right.subjectAssignedCount) {
        return left.subjectAssignedCount - right.subjectAssignedCount;
    }
    const leftFamilyAssignedCount = left.rotationFamilyAssignedCount ?? 0;
    const rightFamilyAssignedCount = right.rotationFamilyAssignedCount ?? 0;
    if (leftFamilyAssignedCount !== rightFamilyAssignedCount) {
        return leftFamilyAssignedCount - rightFamilyAssignedCount;
    }
    const leftProjectedFamilyPeak = left.projectedRotationFamilyPeakMinutes ?? 0;
    const rightProjectedFamilyPeak = right.projectedRotationFamilyPeakMinutes ?? 0;
    if (leftProjectedFamilyPeak !== rightProjectedFamilyPeak) {
        return leftProjectedFamilyPeak - rightProjectedFamilyPeak;
    }
    const leftLaneAssignedCount = left.rotationLaneAssignedCount ?? 0;
    const rightLaneAssignedCount = right.rotationLaneAssignedCount ?? 0;
    if (leftLaneAssignedCount !== rightLaneAssignedCount) {
        return leftLaneAssignedCount - rightLaneAssignedCount;
    }
    if (left.projectedUsedMinutes !== right.projectedUsedMinutes) {
        return left.projectedUsedMinutes - right.projectedUsedMinutes;
    }
    return left.facultyId - right.facultyId;
}
export function __testRankCoverageCandidates(candidates) {
    return [...candidates]
        .sort((left, right) => compareCoverageCandidateRank(left, right))
        .map((entry) => entry.facultyId);
}
function findBestCandidateForMode(subjectRow, sectionId, faculty, coverageMode, capacityLedgersByFaculty, capacityUsed, aliasesByCanonical, subjectAssignmentCountByFacultyId, rotationLaneAssignmentCountByFacultyId, rotationFamilyAssignmentCountByFacultyId) {
    const candidates = [];
    const realCoverageMode = resolveRealCoverageMode(coverageMode);
    const subjectMinutes = Math.max(0, Number(subjectRow.minMinutesPerWeek) || 0);
    const laneKey = buildCapacityLaneKey({
        subjectId: subjectRow.id,
        subjectCode: subjectRow.code,
        rotationFamily: subjectRow.rotationFamily,
        modularGroupId: subjectRow.modularGroupId,
        modularOrder: subjectRow.modularOrder,
        termGroupId: subjectRow.termGroupId,
        termCount: subjectRow.termCount,
        sectionId,
    });
    for (const member of faculty) {
        const ledger = capacityLedgersByFaculty.get(member.id) ?? createEmptyCapacityLedger();
        const used = capacityUsed.get(member.id) ?? 0;
        const deltaMinutes = estimateCapacityLaneDeltaMinutes(ledger, laneKey, subjectMinutes);
        const limit = resolveRealFacultyCapMinutes(member, realCoverageMode);
        if (used + deltaMinutes > limit)
            continue;
        const tier = resolveQualificationTier(member, subjectRow, aliasesByCanonical);
        if (tier != null) {
            candidates.push({
                faculty: member,
                tier,
                projectedUsedMinutes: used + deltaMinutes,
                subjectAssignedCount: subjectAssignmentCountByFacultyId?.get(member.id) ?? 0,
                rotationLaneAssignedCount: rotationLaneAssignmentCountByFacultyId?.get(member.id) ?? 0,
                rotationFamilyAssignedCount: rotationFamilyAssignmentCountByFacultyId?.get(member.id) ?? 0,
                projectedRotationFamilyPeakMinutes: estimateProjectedRotationFamilyPeakMinutes(ledger, laneKey, subjectMinutes),
            });
        }
    }
    if (candidates.length === 0)
        return null;
    candidates.sort((a, b) => compareCoverageCandidateRank({
        facultyId: a.faculty.id,
        tier: a.tier,
        subjectAssignedCount: a.subjectAssignedCount,
        rotationLaneAssignedCount: a.rotationLaneAssignedCount,
        rotationFamilyAssignedCount: a.rotationFamilyAssignedCount,
        projectedRotationFamilyPeakMinutes: a.projectedRotationFamilyPeakMinutes,
        projectedUsedMinutes: a.projectedUsedMinutes,
    }, {
        facultyId: b.faculty.id,
        tier: b.tier,
        subjectAssignedCount: b.subjectAssignedCount,
        rotationLaneAssignedCount: b.rotationLaneAssignedCount,
        rotationFamilyAssignedCount: b.rotationFamilyAssignedCount,
        projectedRotationFamilyPeakMinutes: b.projectedRotationFamilyPeakMinutes,
        projectedUsedMinutes: b.projectedUsedMinutes,
    }));
    return candidates[0].faculty;
}
function simulateRealFacultyCoverage(input) {
    const capacityLedgersByFaculty = cloneCapacityLedgers(input.baseCapacityLedgersByFaculty);
    const capacityUsed = new Map();
    for (const [facultyId, ledger] of capacityLedgersByFaculty.entries()) {
        capacityUsed.set(facultyId, ledger.creditedMinutes);
    }
    const bySubjectId = new Map();
    for (const pair of input.candidatePairs) {
        const bucket = bySubjectId.get(pair.subjectId) ?? [];
        bucket.push(pair);
        bySubjectId.set(pair.subjectId, bucket);
    }
    const subjectMap = new Map(input.candidatePairs.map((pair) => [pair.subjectId, pair.subject]));
    const orderedSubjectIds = Array.from(bySubjectId.keys()).sort((a, b) => {
        const sa = subjectMap.get(a);
        const sb = subjectMap.get(b);
        if (!sa || !sb)
            return a - b;
        return compareSubjectsDeterministically(sa, sb);
    });
    const unresolvedPairs = [];
    let rowsClosedByRealFaculty = 0;
    const rotationFamilyAssignmentCountsByFamily = new Map();
    const applyCapacityLane = (facultyId, subject, sectionId) => {
        const minutes = Math.max(0, Number(subject.minMinutesPerWeek) || 0);
        if (minutes <= 0)
            return;
        const laneKey = buildCapacityLaneKey({
            subjectId: subject.id,
            subjectCode: subject.code,
            rotationFamily: subject.rotationFamily,
            modularGroupId: subject.modularGroupId,
            modularOrder: subject.modularOrder,
            termGroupId: subject.termGroupId,
            termCount: subject.termCount,
            sectionId,
        });
        const ledger = capacityLedgersByFaculty.get(facultyId) ?? createEmptyCapacityLedger();
        applyCapacityLaneMinutesToLedger(ledger, laneKey, minutes);
        capacityLedgersByFaculty.set(facultyId, ledger);
        capacityUsed.set(facultyId, ledger.creditedMinutes);
    };
    for (const subjectId of orderedSubjectIds) {
        const pairs = bySubjectId.get(subjectId) ?? [];
        const subjectRow = subjectMap.get(subjectId);
        if (!subjectRow)
            continue;
        const subjectAssignmentCountByFacultyId = new Map();
        const rotationLaneAssignmentCountByFacultyId = new Map();
        const rotationFamily = resolveCapacityRotationFamily(subjectRow.code, subjectRow.rotationFamily, subjectRow.modularGroupId);
        const rotationTermMetadata = resolveRotationTermMetadata({
            subjectCode: subjectRow.code,
            rotationFamily,
            modularGroupId: subjectRow.modularGroupId,
            modularOrder: subjectRow.modularOrder,
            termGroupId: subjectRow.termGroupId,
            termCount: subjectRow.termCount,
        });
        const rotationLaneDistributionKey = rotationFamily
            ? `${rotationFamily}:term:${normalizeRotationTermLaneKey(rotationTermMetadata.termRank)}`
            : null;
        const rotationFamilyAssignmentCountByFacultyId = rotationFamily
            ? (rotationFamilyAssignmentCountsByFamily.get(rotationFamily) ?? new Map())
            : undefined;
        for (const pair of pairs) {
            const candidate = findBestCandidateForMode(subjectRow, pair.sectionId, input.realFaculty, input.coverageMode, capacityLedgersByFaculty, capacityUsed, input.aliasesByCanonical, subjectAssignmentCountByFacultyId, rotationLaneAssignmentCountByFacultyId, rotationFamilyAssignmentCountByFacultyId);
            if (!candidate) {
                unresolvedPairs.push(pair);
                continue;
            }
            rowsClosedByRealFaculty += 1;
            applyCapacityLane(candidate.id, subjectRow, pair.sectionId);
            subjectAssignmentCountByFacultyId.set(candidate.id, (subjectAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
            if (rotationLaneDistributionKey) {
                rotationLaneAssignmentCountByFacultyId.set(candidate.id, (rotationLaneAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
            }
            if (rotationFamily && rotationFamilyAssignmentCountByFacultyId) {
                rotationFamilyAssignmentCountByFacultyId.set(candidate.id, (rotationFamilyAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
                rotationFamilyAssignmentCountsByFamily.set(rotationFamily, rotationFamilyAssignmentCountByFacultyId);
            }
        }
    }
    return {
        rowsClosedByRealFaculty,
        unresolvedPairs,
        capacityUsed,
        staffingReport: buildStaffingReport(unresolvedPairs, input.realFaculty, capacityUsed, input.coverageMode),
    };
}
function buildStaffingTruthComparison(input) {
    const toBucket = (simulation, rowsClosedByTeacherX, forceZeroShortage = false) => ({
        shortageRows: forceZeroShortage ? 0 : simulation.unresolvedPairs.length,
        shortageConcurrentHoursPerWeek: forceZeroShortage
            ? 0
            : simulation.staffingReport.concurrentMissingHoursPerWeek,
        shortageConcurrentMinutesPerWeek: forceZeroShortage
            ? 0
            : simulation.staffingReport.concurrentMissingMinutesPerWeek,
        rowsClosedByRealFaculty: simulation.rowsClosedByRealFaculty,
        rowsClosedByTeacherX,
    });
    const teacherXRowsClosed = input.hardCapSimulation.unresolvedPairs.length;
    return {
        baseline: {
            totalTeachableRows: input.totalTeachableRows,
            realCoveredRows: input.realCoveredRows,
            syntheticCoveredRows: input.syntheticCoveredRows,
            unassignedRows: input.unassignedRows,
        },
        realOnly: toBucket(input.standardSimulation, 0),
        hardCap: toBucket(input.hardCapSimulation, 0),
        teacherX: toBucket(input.hardCapSimulation, teacherXRowsClosed, true),
    };
}
function buildSectionSourceWarning(sectionResult) {
    if (sectionResult.source === 'enrollpro') {
        return null;
    }
    if (sectionResult.source === 'stub') {
        return 'Staffing report is running on stubbed section data.';
    }
    if (sectionResult.source === 'atlas-mirror') {
        return 'Staffing report is running on ATLAS mirror-backed section data.';
    }
    const fallbackReason = (sectionResult.fallbackReason ?? '').trim();
    if (fallbackReason === 'atlas-mirror-preferred-runtime-control') {
        return 'Staffing report is running on ATLAS mirror-backed section data by runtime policy (not due to an upstream outage).';
    }
    if (fallbackReason === 'atlas-snapshot-preferred-runtime-control') {
        return 'Staffing report is running on ATLAS snapshot-backed section data by runtime policy.';
    }
    if (fallbackReason.length > 0) {
        return `Staffing report is running on ATLAS-cached section data (${fallbackReason}).`;
    }
    return 'Staffing report is running on ATLAS-cached section data.';
}
export async function autoFill(schoolId, schoolYearId, authToken, options) {
    const warnings = [];
    const previewOnly = options?.previewOnly ?? false;
    const staffingOnly = options?.staffingOnly === true;
    const coverageMode = options?.coverageMode ?? DEFAULT_COVERAGE_MODE;
    const realCoverageMode = resolveRealCoverageMode(coverageMode);
    const sectionResult = await fetchSectionsForAutoFill(schoolId, schoolYearId, authToken);
    const sectionSourceWarning = buildSectionSourceWarning(sectionResult);
    if (sectionSourceWarning) {
        warnings.push(sectionSourceWarning);
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
        const emptyReport = buildStaffingReport([], [], new Map(), realCoverageMode);
        const emptyTruth = {
            baseline: {
                totalTeachableRows: 0,
                realCoveredRows: 0,
                syntheticCoveredRows: 0,
                unassignedRows: 0,
            },
            realOnly: {
                shortageRows: 0,
                shortageConcurrentHoursPerWeek: 0,
                shortageConcurrentMinutesPerWeek: 0,
                rowsClosedByRealFaculty: 0,
                rowsClosedByTeacherX: 0,
            },
            hardCap: {
                shortageRows: 0,
                shortageConcurrentHoursPerWeek: 0,
                shortageConcurrentMinutesPerWeek: 0,
                rowsClosedByRealFaculty: 0,
                rowsClosedByTeacherX: 0,
            },
            teacherX: {
                shortageRows: 0,
                shortageConcurrentHoursPerWeek: 0,
                shortageConcurrentMinutesPerWeek: 0,
                rowsClosedByRealFaculty: 0,
                rowsClosedByTeacherX: 0,
            },
        };
        return {
            preserved: 0,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: 0,
            coverageMode,
            warnings,
            sectionSource: sectionResult.source,
            sectionFallbackReason: sectionResult.fallbackReason ?? null,
            staffingReport: emptyReport,
            staffingTruth: emptyTruth,
        };
    }
    const shouldApplyStaleReconcile = !previewOnly && !staffingOnly;
    const staleReconcile = await previewOrApplyStaleOwnershipReconcile({
        schoolId,
        schoolYearId,
        actorId: 0,
        authToken,
        previewOnly: !shouldApplyStaleReconcile,
    });
    if (staleReconcile.staleOwnedCurrentYearPairCount > 0) {
        if (staleReconcile.applied) {
            warnings.push(`Removed ${staleReconcile.deletedOwnershipRows} stale ownership row${staleReconcile.deletedOwnershipRows === 1 ? '' : 's'} before coverage simulation so saved coverage truth can persist.`);
        }
        else {
            warnings.push(`Detected ${staleReconcile.staleOwnedCurrentYearPairCount} stale owned pair${staleReconcile.staleOwnedCurrentYearPairCount === 1 ? '' : 's'}. Simulated recoverability may exceed saved coverage until stale ownership reconciliation is applied.`);
        }
    }
    const faculty = await prisma.facultyMirror.findMany({
        where: { schoolId, isStale: false, isActiveForScheduling: true },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            specialization: true,
            canTeachOutsideDepartment: true,
            maxHoursPerWeek: true,
            isPlaceholder: true,
        },
    });
    const activeFacultyIds = faculty.map((member) => member.id);
    const realFaculty = faculty.filter((member) => !member.isPlaceholder);
    const realFacultyIds = realFaculty.map((member) => member.id);
    const placeholderFacultyIds = new Set(faculty.filter((member) => member.isPlaceholder).map((member) => member.id));
    // Pre-fetch specialization aliases for strict qualification checks
    const aliases = await prisma.specializationAlias.findMany({
        where: { schoolId },
        select: { canonical: true, alias: true },
    });
    const aliasesByCanonical = new Map();
    for (const alias of aliases) {
        const canonKey = alias.canonical.trim().toLowerCase();
        const aliasSet = aliasesByCanonical.get(canonKey) ?? new Set();
        aliasSet.add(alias.alias.trim().toLowerCase());
        aliasesByCanonical.set(canonKey, aliasSet);
    }
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
    });
    const resolvedPairs = new Set(existingOwnerships.map((o) => `${o.subjectId}:${o.sectionId}`));
    const preserved = resolvedPairs.size;
    const realOwnershipRows = existingOwnerships.filter((ownership) => realFacultyIds.includes(ownership.facultyId));
    const { capacityLedgersByFaculty: baseRealCapacityLedgersByFaculty, capacityUsed: baseRealCapacityUsed, } = buildInitialCapacityTracking(realOwnershipRows);
    const capacityLedgersByFaculty = cloneCapacityLedgers(baseRealCapacityLedgersByFaculty);
    const capacityUsed = new Map(baseRealCapacityUsed);
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
            termGroupId: true,
            termCount: true,
            ownerDepartment: true,
            requiredFeatures: true,
            allowedSpecializations: true,
        },
    });
    const workQueue = [];
    const unresolvedPairs = [];
    const allTeachablePairs = [];
    const teachablePairKeySet = new Set();
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
            const sectionInfo = sectionMeta.get(sectionId);
            const pair = {
                subjectId: subject.id,
                sectionId,
                subject,
                sectionName: sectionInfo?.sectionName ?? `Section ${sectionId}`,
                sectionProgramType: sectionInfo?.programType ?? 'REGULAR',
            };
            allTeachablePairs.push(pair);
            teachablePairKeySet.add(key);
            if (!resolvedPairs.has(key)) {
                workQueue.push(pair);
            }
        }
    }
    const realAssignedPairSet = new Set();
    const syntheticAssignedPairSet = new Set();
    for (const ownership of existingOwnerships) {
        const pairKey = `${ownership.subjectId}:${ownership.sectionId}`;
        if (!teachablePairKeySet.has(pairKey)) {
            continue;
        }
        if (placeholderFacultyIds.has(ownership.facultyId)) {
            syntheticAssignedPairSet.add(pairKey);
        }
        else {
            realAssignedPairSet.add(pairKey);
        }
    }
    const syntheticOnlyPairSet = new Set(Array.from(syntheticAssignedPairSet).filter((pairKey) => !realAssignedPairSet.has(pairKey)));
    const anyAssignedPairSet = new Set([
        ...Array.from(realAssignedPairSet),
        ...Array.from(syntheticAssignedPairSet),
    ]);
    const realCoverageQueue = allTeachablePairs.filter((pair) => !realAssignedPairSet.has(`${pair.subjectId}:${pair.sectionId}`));
    const standardSimulation = simulateRealFacultyCoverage({
        coverageMode: REAL_ONLY_STANDARD_MODE,
        realFaculty,
        candidatePairs: realCoverageQueue,
        baseCapacityLedgersByFaculty: baseRealCapacityLedgersByFaculty,
        aliasesByCanonical,
    });
    const hardCapSimulation = simulateRealFacultyCoverage({
        coverageMode: REAL_ONLY_HARD_CAP_MODE,
        realFaculty,
        candidatePairs: realCoverageQueue,
        baseCapacityLedgersByFaculty: baseRealCapacityLedgersByFaculty,
        aliasesByCanonical,
    });
    const staffingTruth = buildStaffingTruthComparison({
        totalTeachableRows: allTeachablePairs.length,
        realCoveredRows: realAssignedPairSet.size,
        syntheticCoveredRows: syntheticOnlyPairSet.size,
        unassignedRows: Math.max(0, allTeachablePairs.length - anyAssignedPairSet.size),
        standardSimulation,
        hardCapSimulation,
    });
    const selectedSimulation = coverageMode === REAL_ONLY_STANDARD_MODE
        ? standardSimulation
        : hardCapSimulation;
    const selectedStaffingReport = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
        ? buildStaffingReport([], realFaculty, hardCapSimulation.capacityUsed, REAL_ONLY_HARD_CAP_MODE)
        : selectedSimulation.staffingReport;
    const selectedUnresolvedForMode = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
        ? 0
        : selectedSimulation.unresolvedPairs.length;
    if (staffingOnly) {
        return {
            preserved,
            created: 0,
            assignmentsCreated: 0,
            uniqueTeachersAffected: 0,
            unresolved: selectedUnresolvedForMode,
            coverageMode,
            warnings,
            sectionSource: sectionResult.source,
            sectionFallbackReason: sectionResult.fallbackReason ?? null,
            staffingReport: selectedStaffingReport,
            staffingTruth,
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
        return compareSubjectsDeterministically(sa, sb);
    });
    // Track new assignments to persist: facultyId → { subjectId → Set<sectionId> }
    const pendingAssignments = new Map();
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
        const laneKey = buildCapacityLaneKey({
            subjectId,
            subjectCode: subject.code,
            rotationFamily: subject.rotationFamily,
            modularGroupId: subject.modularGroupId,
            modularOrder: subject.modularOrder,
            termGroupId: subject.termGroupId,
            termCount: subject.termCount,
            sectionId,
        });
        const ledger = capacityLedgersByFaculty.get(facultyId) ?? createEmptyCapacityLedger();
        applyCapacityLaneMinutesToLedger(ledger, laneKey, minutes);
        capacityLedgersByFaculty.set(facultyId, ledger);
        capacityUsed.set(facultyId, ledger.creditedMinutes);
    }
    for (const subjectId of orderedSubjectIds) {
        const pairs = bySubjectId.get(subjectId);
        const subjectRow = subjectMap.get(subjectId);
        const subjectAssignmentCountByFacultyId = new Map();
        const rotationLaneAssignmentCountByFacultyId = new Map();
        const rotationFamily = resolveCapacityRotationFamily(subjectRow.code, subjectRow.rotationFamily, subjectRow.modularGroupId);
        const rotationTermMetadata = resolveRotationTermMetadata({
            subjectCode: subjectRow.code,
            rotationFamily,
            modularGroupId: subjectRow.modularGroupId,
            modularOrder: subjectRow.modularOrder,
            termGroupId: subjectRow.termGroupId,
            termCount: subjectRow.termCount,
        });
        const rotationLaneDistributionKey = rotationFamily
            ? `${rotationFamily}:term:${normalizeRotationTermLaneKey(rotationTermMetadata.termRank)}`
            : null;
        for (const pair of pairs) {
            const candidate = findBestCandidateForMode(subjectRow, pair.sectionId, realFaculty, realCoverageMode, capacityLedgersByFaculty, capacityUsed, aliasesByCanonical, subjectAssignmentCountByFacultyId, rotationLaneAssignmentCountByFacultyId);
            if (!candidate) {
                warnings.push(`Lacking Faculty: no department-qualified teacher for ${subjectRow.name} (${pair.sectionName}).`);
                unresolvedPairs.push(pair);
            }
            else {
                addPending(candidate.id, pair.subjectId, pair.sectionId);
                subjectAssignmentCountByFacultyId.set(candidate.id, (subjectAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
                if (rotationLaneDistributionKey) {
                    rotationLaneAssignmentCountByFacultyId.set(candidate.id, (rotationLaneAssignmentCountByFacultyId.get(candidate.id) ?? 0) + 1);
                }
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
    let teacherXResolution;
    let teacherXRowsClosed = 0;
    let teacherXPlaceholderTeacherCount = 0;
    if (coverageMode === 'REAL_FACULTY_THEN_TEACHER_X') {
        const unresolvedSubjectCodes = [...new Set(unresolvedPairs.map((pair) => pair.subject.code.trim().toUpperCase()))];
        if (!previewOnly && unresolvedSubjectCodes.length > 0) {
            const repairResult = await repairActiveSubjectCoverageWithPlaceholders({
                schoolId,
                schoolYearId,
                assignedBy: 0,
                authToken,
                subjectCodes: unresolvedSubjectCodes,
                apply: true,
            });
            teacherXRowsClosed = repairResult.sectionsCoveredByPlaceholder;
            teacherXPlaceholderTeacherCount = new Set([
                ...repairResult.createdPlaceholders.map((entry) => entry.facultyId),
                ...repairResult.reusedPlaceholders.map((entry) => entry.facultyId),
            ]).size;
            teacherXResolution = {
                applied: true,
                rowsClosedByTeacherX: repairResult.sectionsCoveredByPlaceholder,
                createdPlaceholders: repairResult.createdPlaceholders.length,
                reusedPlaceholders: repairResult.reusedPlaceholders.length,
                placeholderAssignmentsUpserted: repairResult.placeholderAssignmentsUpserted,
                resolvedSubjectCodes: repairResult.resolvedSubjectCodes,
                stillUncoveredSubjectCodes: repairResult.stillUncoveredSubjectCodes,
            };
        }
        else {
            teacherXRowsClosed = staffingTruth.teacherX.rowsClosedByTeacherX;
            teacherXResolution = {
                applied: false,
                rowsClosedByTeacherX: teacherXRowsClosed,
                createdPlaceholders: 0,
                reusedPlaceholders: 0,
                placeholderAssignmentsUpserted: 0,
                resolvedSubjectCodes: [],
                stillUncoveredSubjectCodes: [],
            };
        }
    }
    const totalCreated = created + teacherXRowsClosed;
    const uniqueTeachersAffected = affectedTeacherIds.size + teacherXPlaceholderTeacherCount;
    const finalUnresolved = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X' ? 0 : selectedUnresolvedForMode;
    const staffingReport = coverageMode === 'REAL_FACULTY_THEN_TEACHER_X'
        ? buildStaffingReport([], realFaculty, capacityUsed, REAL_ONLY_HARD_CAP_MODE)
        : selectedStaffingReport;
    return {
        preserved,
        created: totalCreated,
        assignmentsCreated: totalCreated,
        uniqueTeachersAffected,
        unresolved: finalUnresolved,
        coverageMode,
        warnings,
        sectionSource: sectionResult.source,
        sectionFallbackReason: sectionResult.fallbackReason ?? null,
        staffingReport,
        staffingTruth,
        teacherXResolution,
    };
}
function aggregateCoverageRows(rows) {
    return rows.reduce((accumulator, row) => ({
        totalPairs: accumulator.totalPairs + Math.max(0, row.relevantSectionCount),
        assignedPairs: accumulator.assignedPairs + Math.max(0, row.ownedSectionCount),
        unassignedPairs: accumulator.unassignedPairs + Math.max(0, row.uncoveredSectionCount),
    }), { totalPairs: 0, assignedPairs: 0, unassignedPairs: 0 });
}
function filterCoverageRowsForSplitBrain(rows) {
    return rows.filter((row) => row.subjectCode !== HG_SUBJECT_CODE);
}
const BLOCKING_SPLIT_BRAIN_REASON_CODES = new Set([
    'ASSIGNED_PAIR_MISMATCH',
    'UNASSIGNED_PAIR_MISMATCH',
    'TOTAL_PAIR_MISMATCH',
    'FACULTY_LOAD_OUTLIER',
    'INTEGRITY_MISSING_OWNERSHIP',
    'INTEGRITY_OWNERSHIP_WITHOUT_SCOPE',
    'STALE_OWNERSHIP_PRESENT',
]);
function resolveSplitBrainQuarantine(reasonCodes) {
    const hasBlockingReason = reasonCodes.some((code) => BLOCKING_SPLIT_BRAIN_REASON_CODES.has(code));
    if (hasBlockingReason) {
        return {
            required: true,
            severity: 'BLOCKING',
        };
    }
    if (reasonCodes.length > 0) {
        return {
            required: false,
            severity: 'WARNING',
        };
    }
    return {
        required: false,
        severity: 'NONE',
    };
}
export function __testAggregateSplitBrainCoverageTotals(rows) {
    return aggregateCoverageRows(filterCoverageRowsForSplitBrain(rows));
}
export function __testResolveSplitBrainQuarantine(reasonCodes) {
    return resolveSplitBrainQuarantine(reasonCodes);
}
export async function previewOrApplyTeachingLoadSplitBrainReconcile(input) {
    const apply = input.previewOnly === false;
    const [beforeSummary, beforeCoverage] = await Promise.all([
        getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken),
        getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken),
    ]);
    const [truthReconcile, staleReconcile, realFacultyRecovery] = await Promise.all([
        previewOrApplyTeachingLoadTruthReconcile({
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            actorId: input.actorId,
            authToken: input.authToken,
            previewOnly: !apply,
        }),
        previewOrApplyStaleOwnershipReconcile({
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            actorId: input.actorId,
            authToken: input.authToken,
            previewOnly: !apply,
        }),
        previewOrApplyRealFacultyRecovery({
            schoolId: input.schoolId,
            schoolYearId: input.schoolYearId,
            actorId: input.actorId,
            authToken: input.authToken,
            apply,
        }),
    ]);
    const [finalSummary, finalCoverage] = apply
        ? await Promise.all([
            getAssignmentSummary(input.schoolId, input.schoolYearId, input.authToken),
            getActiveSubjectCoverageSummary(input.schoolId, input.schoolYearId, input.authToken),
        ])
        : [beforeSummary, beforeCoverage];
    const summaryTotals = finalSummary.coverageTotals;
    const coverageRowsForComparison = filterCoverageRowsForSplitBrain(finalCoverage.rows);
    const coverageTotals = aggregateCoverageRows(coverageRowsForComparison);
    const assignmentPairDelta = summaryTotals.assignedPairs - coverageTotals.assignedPairs;
    const unassignedPairDelta = summaryTotals.unassignedPairs - coverageTotals.unassignedPairs;
    const totalPairDelta = summaryTotals.totalPairs - coverageTotals.totalPairs;
    const specialProgramApprovalQueue = [];
    const truthRowsPending = finalSummary.faculty.reduce((total, facultyRow) => total
        + facultyRow.assignments.filter((assignment) => (assignment.missingOwnershipSectionCount ?? 0) > 0
            || (assignment.ownershipWithoutScopeSectionCount ?? 0) > 0
            || (assignment.outOfSubjectScopeSectionCount ?? 0) > 0).length, 0);
    const truthRowsWithOutOfSubjectScopePending = finalSummary.faculty.reduce((total, facultyRow) => total
        + facultyRow.assignments.filter((assignment) => (assignment.outOfSubjectScopeSectionCount ?? 0) > 0).length, 0);
    const truthOutOfSubjectScopePairCountPending = finalSummary.faculty.reduce((total, facultyRow) => total
        + facultyRow.assignments.reduce((assignmentTotal, assignment) => assignmentTotal + (assignment.outOfSubjectScopeSectionCount ?? 0), 0), 0);
    const pendingRealFacultyMoves = apply
        ? Math.max(0, realFacultyRecovery.placeholderMovesPlanned - realFacultyRecovery.placeholderMovesApplied)
        : realFacultyRecovery.placeholderMovesPlanned;
    const approvalFacultyIdSet = new Set(specialProgramApprovalQueue.map((candidate) => candidate.facultyId));
    const overloadedFacultyRows = finalSummary.faculty
        .filter((facultyRow) => !facultyRow.isPlaceholder)
        .filter((facultyRow) => (Number(facultyRow.maxHoursPerWeek) || 0) > 0)
        .filter((facultyRow) => (Number(facultyRow.policyCreditedHours) || 0) > (Number(facultyRow.maxHoursPerWeek) || 0) + 0.1);
    const approvalLinkedLoadRows = overloadedFacultyRows.filter((facultyRow) => approvalFacultyIdSet.has(facultyRow.id));
    const nonApprovalOverloadRows = overloadedFacultyRows.filter((facultyRow) => !approvalFacultyIdSet.has(facultyRow.id));
    const trueLoadOutlierRows = nonApprovalOverloadRows.filter((facultyRow) => {
        const maxHours = Number(facultyRow.maxHoursPerWeek) || 0;
        const policyHours = Number(facultyRow.policyCreditedHours) || 0;
        const overloadHours = Math.max(0, (Number(facultyRow.policyCreditedHours) || 0) - maxHours);
        const isMultiplierOutlier = maxHours > 0 && policyHours >= maxHours * TRUE_LOAD_OUTLIER_POLICY_MULTIPLIER;
        return overloadHours >= TRUE_LOAD_OUTLIER_OVERLOAD_HOURS || isMultiplierOutlier;
    });
    const trueLoadOutlierFacultyIdSet = new Set(trueLoadOutlierRows.map((facultyRow) => facultyRow.id));
    const loadReviewRows = nonApprovalOverloadRows.filter((facultyRow) => !trueLoadOutlierFacultyIdSet.has(facultyRow.id));
    const overloadedFacultyDiagnostics = trueLoadOutlierRows
        .map((facultyRow) => ({
        facultyId: facultyRow.id,
        facultyName: `${facultyRow.firstName ?? ''} ${facultyRow.lastName ?? ''}`.trim() || `Faculty #${facultyRow.id}`,
        policyCreditedHours: Number(facultyRow.policyCreditedHours) || 0,
        maxHoursPerWeek: Number(facultyRow.maxHoursPerWeek) || 0,
        overloadHours: Math.max(0, (Number(facultyRow.policyCreditedHours) || 0) - (Number(facultyRow.maxHoursPerWeek) || 0)),
        subjectCodes: facultyRow.assignments.map((assignment) => assignment.subject.code),
    }))
        .sort((left, right) => right.overloadHours - left.overloadHours || left.facultyName.localeCompare(right.facultyName))
        .slice(0, 25);
    const reasonCodes = [];
    if (assignmentPairDelta !== 0)
        reasonCodes.push('ASSIGNED_PAIR_MISMATCH');
    if (unassignedPairDelta !== 0)
        reasonCodes.push('UNASSIGNED_PAIR_MISMATCH');
    if (totalPairDelta !== 0)
        reasonCodes.push('TOTAL_PAIR_MISMATCH');
    if ((finalSummary.integrityDiagnostics.currentYearMissingOwnershipPairs ?? 0) > 0)
        reasonCodes.push('INTEGRITY_MISSING_OWNERSHIP');
    if ((finalSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs ?? 0) > 0) {
        reasonCodes.push('INTEGRITY_OWNERSHIP_WITHOUT_SCOPE');
    }
    if ((finalSummary.integrityDiagnostics.currentYearOutOfSubjectScopePairs ?? 0) > 0) {
        reasonCodes.push('INTEGRITY_OUT_OF_SUBJECT_SCOPE');
    }
    if ((finalSummary.integrityDiagnostics.staleOwnedCurrentYearPairCount ?? 0) > 0)
        reasonCodes.push('STALE_OWNERSHIP_PRESENT');
    if (trueLoadOutlierRows.length > 0)
        reasonCodes.push('FACULTY_LOAD_OUTLIER');
    if (loadReviewRows.length > 0)
        reasonCodes.push('FACULTY_LOAD_REVIEW_REQUIRED');
    if (truthRowsPending > 0)
        reasonCodes.push('TRUTH_RECONCILE_PENDING');
    if (pendingRealFacultyMoves > 0)
        reasonCodes.push('REAL_FACULTY_RECOVERY_PENDING');
    if (realFacultyRecovery.blockers.length > 0)
        reasonCodes.push('REAL_FACULTY_RECOVERY_BLOCKERS');
    const dedupedReasonCodes = [...new Set(reasonCodes)];
    const quarantine = resolveSplitBrainQuarantine(dedupedReasonCodes);
    return {
        applied: apply,
        schoolId: input.schoolId,
        schoolYearId: input.schoolYearId,
        quarantine: {
            required: quarantine.required,
            severity: quarantine.severity,
            reasonCodes: dedupedReasonCodes,
            message: quarantine.required
                ? 'Teaching Load data truth is inconsistent. Quarantine assignment edits until reconcile actions are applied.'
                : dedupedReasonCodes.length > 0
                    ? 'Teaching Load has warnings that require scheduler review before final publish.'
                    : 'Teaching Load data paths are currently consistent.',
        },
        counters: {
            summaryAssignedPairs: summaryTotals.assignedPairs,
            summaryUnassignedPairs: summaryTotals.unassignedPairs,
            summaryTotalPairs: summaryTotals.totalPairs,
            coverageAssignedPairs: coverageTotals.assignedPairs,
            coverageUnassignedPairs: coverageTotals.unassignedPairs,
            coverageTotalPairs: coverageTotals.totalPairs,
            assignmentPairDelta,
            unassignedPairDelta,
            totalPairDelta,
            integrityMissingOwnershipPairs: finalSummary.integrityDiagnostics.currentYearMissingOwnershipPairs ?? 0,
            integrityOwnershipWithoutScopePairs: finalSummary.integrityDiagnostics.currentYearOwnershipWithoutMatchingScopePairs ?? 0,
            integrityOutOfSubjectScopePairs: finalSummary.integrityDiagnostics.currentYearOutOfSubjectScopePairs ?? 0,
            staleOwnedCurrentYearPairs: finalSummary.integrityDiagnostics.staleOwnedCurrentYearPairCount ?? 0,
            overloadedFacultyRows: trueLoadOutlierRows.length,
            trueLoadOutlierRows: trueLoadOutlierRows.length,
            loadReviewRows: loadReviewRows.length,
            approvalLinkedLoadRows: approvalLinkedLoadRows.length,
            truthRowsToUpdate: truthRowsPending,
            realFacultyMovesPlanned: pendingRealFacultyMoves,
            realFacultyBlockers: realFacultyRecovery.blockers.length,
            specialProgramApprovalCandidates: specialProgramApprovalQueue.length,
        },
        repairPreview: {
            truthReconcile: {
                rowsToUpdate: truthRowsPending,
                updatedRows: truthReconcile.updatedRows,
                rowsWithOutOfSubjectScope: truthRowsWithOutOfSubjectScopePending,
                outOfSubjectScopePairCount: truthOutOfSubjectScopePairCountPending,
            },
            staleReconcile: {
                staleOwnedCurrentYearPairCount: staleReconcile.staleOwnedCurrentYearPairCount,
                deletedOwnershipRows: staleReconcile.deletedOwnershipRows,
            },
            realFacultyRecovery: {
                placeholderMovesPlanned: realFacultyRecovery.placeholderMovesPlanned,
                placeholderMovesApplied: realFacultyRecovery.placeholderMovesApplied,
                blockerCount: realFacultyRecovery.blockers.length,
                blockers: realFacultyRecovery.blockers.slice(0, 25).map((blocker) => ({
                    subjectCode: blocker.subjectCode,
                    sectionId: blocker.sectionId,
                    category: blocker.category,
                    reason: blocker.reason,
                })),
            },
            integrity: {
                missingOwnershipSamples: finalSummary.integrityDiagnostics.missingOwnershipSamples,
                ownershipWithoutScopeSamples: finalSummary.integrityDiagnostics.ownershipWithoutScopeSamples,
                outOfSubjectScopeSamples: finalSummary.integrityDiagnostics.outOfSubjectScopeSamples,
            },
            loadOutliers: {
                rows: overloadedFacultyDiagnostics,
            },
        },
        specialProgramApprovalQueue,
    };
}
//# sourceMappingURL=teaching-load-automation.service.js.map