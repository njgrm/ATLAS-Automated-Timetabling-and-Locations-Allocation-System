import { type AssignmentScopeInput } from './faculty-assignment-scope.service.js';
export type AssignmentMutationResult = {
    success: true;
    version: number;
} | {
    success: false;
    code: 'FACULTY_NOT_FOUND' | 'FACULTY_INACTIVE' | 'VERSION_CONFLICT' | 'SCHOOL_SCOPE_MISMATCH' | 'INVALID_SUBJECTS' | 'INVALID_ASSIGNMENT_SCOPE' | 'DUPLICATE_SECTION_OWNERSHIP' | 'HG_ADVISORY_IMMUTABLE';
    error: string;
    details?: Record<string, unknown>;
};
type AssignmentLoadShape = {
    subject: {
        id?: number;
        code?: string | null;
        rotationFamily?: string | null;
        modularGroupId?: string | null;
        modularOrder?: number | null;
        termGroupId?: string | null;
        termCount?: number | null;
        minMinutesPerWeek: number;
    };
    sectionIds: number[];
    gradeLevels: number[];
};
export type RotationFamilyLoadDetail = {
    family: string;
    rawHours: number;
    creditedHours: number;
    overcountHours: number;
    unitCount: number;
    subjectCodes: string[];
    subjectIds: number[];
    dominantTermRank?: number | null;
    dominantTermLabel?: string | null;
    termGroupId?: string | null;
    termCount?: number | null;
    termBuckets?: Array<{
        termRank: number | null;
        termLabel: string | null;
        termGroupId: string | null;
        termCount: number | null;
        creditedHours: number;
        unitCount: number;
        subjectCodes: string[];
        subjectIds: number[];
    }>;
};
export type RotationTermBucketBreakdown = {
    termRank: number | null;
    termLabel: string | null;
    termGroupId: string | null;
    termCount: number | null;
    rawMinutesPerWeek: number;
    creditedMinutesPerWeek: number;
    isPeakTerm: boolean;
    sectionIds: number[];
    sectionNames: string[];
    subjectCodes: string[];
    subjectIds: number[];
};
export type RotationFamilyTermBreakdown = {
    family: string;
    rawMinutesPerWeek: number;
    peakTermMinutesPerWeek: number;
    peakTermRank: number | null;
    peakTermLabel: string | null;
    termGroupId: string | null;
    termCount: number | null;
    termBuckets: RotationTermBucketBreakdown[];
};
export type TeachingLoadFormula = 'section' | 'grade';
export type DuplicateOwnershipInput = {
    facultyId: number;
    facultyName: string;
    subjectId: number;
    sectionIds: number[];
};
export type DuplicateOwnershipTuple = {
    subjectId: number;
    sectionId: number;
    owners: Array<{
        facultyId: number;
        facultyName: string;
    }>;
};
export type OwnershipConflictCandidate = {
    subjectId: number;
    sectionId: number;
    facultyId: number;
    subjectName?: string;
    sectionName?: string;
};
export type OwnershipConflictDetail = {
    subjectId: number;
    sectionId: number;
    ownerFacultyId: number;
    ownerFacultyName: string;
    subjectName?: string;
    sectionName?: string;
};
export type SubjectSectionOwnershipIndexEntry = {
    subjectId: number;
    sectionId: number;
    facultyId: number;
    facultyName: string;
    specializationCode?: string | null;
    specializationLabel?: string | null;
};
export type AssignmentSpecializationIdentity = {
    specializationCode: string | null;
    specializationLabel: string | null;
};
export type TeachingLoadAssignmentKind = 'REAL_OWNERSHIP' | 'BASELINE_ONLY' | 'MISSING_OWNERSHIP';
type AssignmentOwnedSectionScopeResolution = {
    storedRelevantCurrentYearSectionIds: number[];
    ownedCurrentYearSectionIds: number[];
    storedOutOfSubjectScopeSectionIds: number[];
    ownedOutOfSubjectScopeSectionIds: number[];
    outOfSubjectScopeSectionIds: number[];
    missingOwnershipSectionCount: number;
    ownershipWithoutScopeSectionCount: number;
    outOfSubjectScopeSectionCount: number;
};
export interface TeachingLoadCoverageTotals {
    assignedPairs: number;
    activeAssignedPairs: number;
    realFacultyAssignedPairs: number;
    syntheticPlaceholderPairs: number;
    rawAssignedPairs: number;
    totalPairs: number;
    unassignedPairs: number;
    rawUnassignedPairs: number;
}
export interface TeachingLoadIntegrityDiagnosticRow {
    facultyId: number;
    facultyName: string;
    subjectId: number;
    subjectCode: string;
    sectionCount: number;
}
export interface TeachingLoadStaleOwnershipSample {
    facultyId: number;
    facultyName: string;
    isPlaceholder: boolean;
    subjectId: number;
    subjectCode: string;
    sectionId: number;
}
export interface TeachingLoadIntegrityDiagnostics {
    emptySectionRows: number;
    currentYearRowsMissingOwnership: number;
    currentYearOwnershipWithoutMatchingScope: number;
    currentYearMissingOwnershipPairs: number;
    currentYearOwnershipWithoutMatchingScopePairs: number;
    currentYearOutOfSubjectScopeRows: number;
    currentYearOutOfSubjectScopePairs: number;
    staleOwnershipRowCount: number;
    staleOwnedCurrentYearPairCount: number;
    stalePlaceholderPairCount: number;
    staleNonPlaceholderPairCount: number;
    emptySectionSamples: TeachingLoadIntegrityDiagnosticRow[];
    missingOwnershipSamples: TeachingLoadIntegrityDiagnosticRow[];
    ownershipWithoutScopeSamples: TeachingLoadIntegrityDiagnosticRow[];
    outOfSubjectScopeSamples: TeachingLoadIntegrityDiagnosticRow[];
    staleOwnershipSamples: TeachingLoadStaleOwnershipSample[];
    quarantinedZombieCount: number;
    quarantinedZombieSamples: TeachingLoadIntegrityDiagnosticRow[];
    staleAdvisoryCount: number;
    staleAdvisorySamples: TeachingLoadIntegrityDiagnosticRow[];
}
export interface SpecialProgramDistributionOwnerRow {
    facultyId: number;
    facultyName: string;
    sectionCount: number;
    movableSectionCount: number;
    department: string | null;
    isPlaceholder: boolean;
}
export interface SpecialProgramDistributionRow {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    ownerDepartment: string | null;
    relevantSectionCount: number;
    ownedSectionCount: number;
    unownedSectionCount: number;
    maxSectionsOwnedBySingleFaculty: number;
    concentrationPercent: number;
    ownerRows: SpecialProgramDistributionOwnerRow[];
}
export interface SpecialProgramRebalanceMove {
    subjectId: number;
    subjectCode: string;
    sectionId: number;
    fromFacultyId: number;
    fromFacultyName: string;
    toFacultyId: number;
    toFacultyName: string;
    preservedSpecializationCode: string | null;
    preservedSpecializationLabel: string | null;
}
export interface SpecialProgramRebalanceInput {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    subjectCodes?: string[];
    apply?: boolean;
}
export interface SpecialProgramRebalanceResult {
    applied: boolean;
    schoolId: number;
    schoolYearId: number;
    subjectCodes: string[];
    before: SpecialProgramDistributionRow[];
    after: SpecialProgramDistributionRow[];
    redistributionInsights: SpecialProgramRedistributionInsight[];
    proposedMoves: SpecialProgramRebalanceMove[];
    appliedMoves: number;
    blockedSubjects: Array<{
        subjectCode: string;
        reason: string;
    }>;
}
export interface SpecialProgramCandidateSignal {
    facultyId: number;
    facultyName: string;
    department: string | null;
    specialization: string | null;
    currentSubjectSectionCount: number;
    currentTotalAssignedPairs: number;
    specializationExactMatchSectionCount: number;
    specializationSupportedSectionCount: number;
    canCoverConstrainedSection: boolean;
    isUnderutilizedMapeh: boolean;
}
export interface SpecialProgramApprovalRequiredCandidate {
    facultyId: number;
    facultyName: string;
    department: string | null;
    specialization: string | null;
    currentTotalAssignedPairs: number;
    requiredSpecializationCodes: string[];
    reason: string;
}
export interface SpecialProgramConstrainedSection {
    sectionId: number;
    sectionName: string;
    requiredSpecializationCode: string;
    qualifiedCandidateCount: number;
}
export interface SpecialProgramRedistributionInsight {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    ownershipConcentrationPercent: number;
    maxSectionsOwnedBySingleFaculty: number;
    underutilizedMapehCandidates: SpecialProgramCandidateSignal[];
    candidateSignals: SpecialProgramCandidateSignal[];
    constrainedSections: SpecialProgramConstrainedSection[];
    approvalRequiredCandidates: SpecialProgramApprovalRequiredCandidate[];
}
export interface TeachingLoadCapabilityOverride {
    facultyId: number;
    subjectCode: string | null;
    specializationCode: string | null;
    specializationLabel: string | null;
    approvedBy: number;
    approvedAt: string;
    note: string | null;
}
export interface TeachingLoadCapabilityOverrideMutationInput {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
    subjectCode?: string | null;
    specializationCode?: string | null;
    specializationLabel?: string | null;
    approvedBy: number;
    note?: string | null;
}
export interface TeachingLoadCapabilityOverrideDeleteInput {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
    subjectCode?: string | null;
    specializationCode?: string | null;
}
export interface TeachingLoadTruthReconcileInput {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    previewOnly?: boolean;
}
export interface StaleOwnershipReconcileInput {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    previewOnly?: boolean;
}
export interface StaleOwnershipReconcileResult {
    applied: boolean;
    schoolId: number;
    schoolYearId: number;
    staleOwnershipRowCount: number;
    staleOwnedCurrentYearPairCount: number;
    stalePlaceholderPairCount: number;
    staleNonPlaceholderPairCount: number;
    affectedFacultySubjectRows: number;
    deletedOwnershipRows: number;
    deletedFacultySubjectRows: number;
    updatedFacultySubjectRows: number;
    affectedSubjects: Array<{
        subjectId: number;
        subjectCode: string;
        staleRowCount: number;
        stalePairCount: number;
    }>;
    sampleRows: TeachingLoadStaleOwnershipSample[];
}
export interface TeachingLoadTruthReconcileResult {
    applied: boolean;
    schoolId: number;
    schoolYearId: number;
    facultySubjectRowsScanned: number;
    rowsWithEmptySectionIds: number;
    rowsWithMissingOwnership: number;
    rowsWithOwnershipWithoutScope: number;
    rowsWithOutOfSubjectScope: number;
    outOfSubjectScopePairCount: number;
    rowsToUpdate: number;
    updatedRows: number;
    sampleUpdates: Array<{
        facultySubjectId: number;
        facultyId: number;
        subjectId: number;
        previousCurrentYearSectionCount: number;
        nextCurrentYearSectionCount: number;
        outOfSubjectScopeSectionCount: number;
    }>;
}
export declare function computeTeachingLoadMinutes(assignments: AssignmentLoadShape[], formula: TeachingLoadFormula): number;
type AssignmentRotationBreakdownInput = {
    subjectId: number;
    subject: {
        id?: number;
        name?: string | null;
        code?: string | null;
        rotationFamily?: string | null;
        modularGroupId?: string | null;
        modularOrder?: number | null;
        termGroupId?: string | null;
        termCount?: number | null;
        minMinutesPerWeek: number;
    };
    sections: Array<{
        id: number;
        name: string;
    }>;
};
export declare function buildRotationTermBreakdown(assignments: AssignmentRotationBreakdownInput[]): RotationFamilyTermBreakdown[];
export declare function detectDuplicateOwnershipTuples(assignments: DuplicateOwnershipInput[]): DuplicateOwnershipTuple[];
export declare function buildOwnershipConflictDetails(conflicts: OwnershipConflictCandidate[], ownerNamesByFacultyId: Map<number, string>): OwnershipConflictDetail[];
export declare function buildDuplicateOwnershipBlockingResult(conflicts: OwnershipConflictCandidate[], ownerNamesByFacultyId: Map<number, string>): AssignmentMutationResult | null;
export interface ActiveSubjectCoverageRow {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    isActive: boolean;
    relevantSectionCount: number;
    ownedSectionCount: number;
    ownedByPlaceholderCount: number;
    ownedByRealFacultyCount: number;
    uncoveredSectionCount: number;
    coveragePercent: number;
    status: 'FULL' | 'PARTIAL' | 'ZERO';
    placeholderFacultyIds: number[];
}
export interface ActiveSubjectCoverageSummary {
    rows: ActiveSubjectCoverageRow[];
    zeroCoverageSubjectCodes: string[];
    partiallyCoveredSubjectCodes: string[];
    fullyCoveredSubjectCodes: string[];
}
export interface SectionAssignedClassRow {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    subjectDisplayLabel: string;
    minMinutesPerWeek: number;
    rotationFamily: string | null;
    rotationTermRank: number | null;
    rotationTermLabel: string | null;
    rotationTermGroupId: string | null;
    rotationTermCount: number | null;
    facultyId: number;
    facultyName: string;
    facultyDepartment: string | null;
    facultySpecialization: string | null;
    assignmentKind: 'REAL_OWNERSHIP';
    specializationCode: string | null;
    specializationLabel: string | null;
}
export interface SectionStaleOwnershipDiagnosticRow {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    sectionId: number;
    facultyId: number;
    facultyName: string;
    reason: 'STALE_OWNERSHIP' | 'INACTIVE_OWNERSHIP';
}
export interface SectionUnassignedExpectedClassRow {
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    subjectDisplayLabel: string;
    minMinutesPerWeek: number;
    rotationFamily: string | null;
    rotationTermRank: number | null;
    rotationTermLabel: string | null;
    rotationTermGroupId: string | null;
    rotationTermCount: number | null;
}
export interface SectionAssignedClassesTotals {
    assignedClassCount: number;
    rotationFamilyClassCount: number;
    unassignedClassCount: number;
}
export interface SectionAssignedClassesResult {
    sectionId: number;
    sectionName: string;
    gradeLevel: number;
    programType: string;
    schoolYearId: number;
    classes: SectionAssignedClassRow[];
    totals: SectionAssignedClassesTotals;
    staleOwnership?: SectionStaleOwnershipDiagnosticRow[];
    unassignedExpectedClasses?: SectionUnassignedExpectedClassRow[];
}
export interface SectionAssignedClassesIndexResult {
    schoolId: number;
    schoolYearId: number;
    sections: SectionAssignedClassesResult[];
    fetchedAt: string;
}
export interface SectionAssignedClassesQueryOptions {
    includeDiagnostics?: boolean;
    sectionIds?: number[];
}
export interface PlaceholderCoverageRepairInput {
    schoolId: number;
    schoolYearId: number;
    assignedBy: number;
    authToken?: string;
    subjectCodes?: string[];
    apply?: boolean;
}
export interface PlaceholderCoverageRepairResult {
    applied: boolean;
    before: ActiveSubjectCoverageSummary;
    after: ActiveSubjectCoverageSummary;
    createdPlaceholders: Array<{
        facultyId: number;
        subjectCode: string;
    }>;
    reusedPlaceholders: Array<{
        facultyId: number;
        subjectCode: string;
    }>;
    sectionsCoveredByPlaceholder: number;
    placeholderAssignmentsUpserted: number;
    resolvedSubjectCodes: string[];
    stillUncoveredSubjectCodes: string[];
}
export type AssignmentSummarySortField = 'name' | 'specialization' | 'subjects' | 'weeklyLoad' | 'status';
export type AssignmentSummarySortDir = 'asc' | 'desc';
export type AssignmentSummarySchedulingFilter = 'all' | 'active' | 'excluded';
export type AssignmentSummaryAssignmentFilter = 'all' | 'assigned' | 'unassigned';
export interface AssignmentSummaryListOptions {
    page?: number;
    pageSize?: number;
    query?: string;
    scheduling?: AssignmentSummarySchedulingFilter;
    assignment?: AssignmentSummaryAssignmentFilter;
    department?: string | null;
    sortField?: AssignmentSummarySortField;
    sortDir?: AssignmentSummarySortDir;
}
export interface AssignmentSummaryRosterStats {
    totalCount: number;
    activeCount: number;
    assignedCount: number;
    unassignedCount: number;
    reviewCount: number;
    overCapCount: number;
}
export interface AssignmentSummaryPageResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    query: string;
    filters: {
        scheduling: AssignmentSummarySchedulingFilter;
        assignment: AssignmentSummaryAssignmentFilter;
        department: string | null;
    };
    sort: {
        field: AssignmentSummarySortField;
        dir: AssignmentSummarySortDir;
    };
    departments: string[];
    rosterStats: AssignmentSummaryRosterStats;
}
export interface RealFacultyRecoveryInput {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    subjectCodes?: string[];
    apply?: boolean;
}
export interface RealFacultyRecoveryMove {
    mode: 'MOVE_PLACEHOLDER' | 'ASSIGN_UNCOVERED';
    ownershipId: number | null;
    subjectId: number;
    subjectCode: string;
    sectionId: number;
    fromFacultyId: number;
    fromFacultyName: string;
    toFacultyId: number;
    toFacultyName: string;
    estimatedDeltaMinutes: number;
}
export interface RealFacultyRecoveryBlocker {
    subjectCode: string;
    sectionId: number;
    category: 'TRUE_DEPARTMENT_SHORTAGE' | 'SKEWED_ASSIGNMENT_TOPOLOGY' | 'UNRESOLVED_AUTOMATION_SEED_BIAS' | 'ROTATION_FAMILY_MODELING_GAP' | 'SUBJECT_CONTRACT_GAP';
    reason: string;
}
export interface RealFacultyRecoverySubjectDelta {
    subjectCode: string;
    beforeOwnedByRealFacultyCount: number;
    beforeOwnedByPlaceholderCount: number;
    afterOwnedByRealFacultyCount: number;
    afterOwnedByPlaceholderCount: number;
}
export interface RotationGateVerdict {
    family: 'SCIENCE' | 'TLE_ROTATION';
    verdict: 'WORKING' | 'NOT_WORKING';
    teacherCountWithFamilyLoad: number;
    teacherCountWithOvercountSignal: number;
    sampleSubjectCodes: string[];
    reason: string;
}
export interface RealFacultyRecoveryResult {
    applied: boolean;
    schoolId: number;
    schoolYearId: number;
    targetSubjects: string[];
    beforeCoverage: ActiveSubjectCoverageSummary;
    afterCoverage: ActiveSubjectCoverageSummary;
    placeholderMovesPlanned: number;
    placeholderMovesApplied: number;
    moves: RealFacultyRecoveryMove[];
    subjectDeltas: RealFacultyRecoverySubjectDelta[];
    blockerCounts: {
        trueDepartmentShortage: number;
        skewedAssignmentTopology: number;
        unresolvedAutomationSeedBias: number;
        rotationFamilyModelingGap: number;
        subjectContractGap: number;
    };
    blockers: RealFacultyRecoveryBlocker[];
    lowLoadRecovery: {
        thresholdHours: number;
        zeroLoadRealFacultyBefore: number;
        zeroLoadRealFacultyAfter: number;
        lowLoadRealFacultyBefore: number;
        lowLoadRealFacultyAfter: number;
        recoveredFromZeroLoad: number;
    };
    rotationGate: {
        science: RotationGateVerdict;
        tle: RotationGateVerdict;
    };
}
export declare function getActiveSubjectCoverageSummary(schoolId: number, schoolYearId: number, authToken?: string): Promise<ActiveSubjectCoverageSummary>;
export declare function getSectionAssignedClassesIndex(schoolId: number, schoolYearId: number, authToken?: string, options?: SectionAssignedClassesQueryOptions): Promise<SectionAssignedClassesIndexResult>;
export declare function getSectionAssignedClasses(sectionId: number, schoolYearId: number, authToken?: string, options?: {
    schoolId?: number;
    includeDiagnostics?: boolean;
}): Promise<SectionAssignedClassesResult | null>;
export declare function repairActiveSubjectCoverageWithPlaceholders(input: PlaceholderCoverageRepairInput): Promise<PlaceholderCoverageRepairResult>;
export declare function previewOrApplyRealFacultyRecovery(input: RealFacultyRecoveryInput): Promise<RealFacultyRecoveryResult>;
export declare function listTeachingLoadCapabilityOverrides(schoolId: number, schoolYearId: number): Promise<TeachingLoadCapabilityOverride[]>;
export declare function upsertTeachingLoadCapabilityOverride(input: TeachingLoadCapabilityOverrideMutationInput): Promise<TeachingLoadCapabilityOverride[]>;
export declare function deleteTeachingLoadCapabilityOverride(input: TeachingLoadCapabilityOverrideDeleteInput): Promise<TeachingLoadCapabilityOverride[]>;
export declare function previewOrApplySpecialProgramRedistribution(input: SpecialProgramRebalanceInput): Promise<SpecialProgramRebalanceResult>;
export declare function resolveAssignmentSpecializationIdentity(input: {
    subjectCode: string | null | undefined;
    allowedSpecializations?: string[] | null | undefined;
    facultySpecialization?: string | null | undefined;
}): AssignmentSpecializationIdentity;
export declare function __testResolveOwnedCurrentYearSectionScope(storedCurrentYearSectionIds: number[], ownedCurrentYearSectionIdsRaw: number[], relevantSectionIds: number[]): AssignmentOwnedSectionScopeResolution;
export declare function getAssignmentsByFaculty(facultyId: number, schoolYearId: number, authToken?: string): Promise<{
    facultyId: number;
    version: number;
    assignments: {
        gradeLevels: number[];
        sectionIds: number[];
        sections: (import("./faculty-assignment-scope.service.js").ScopedSection & {
            assignmentSpecializationCode: string | null;
            assignmentSpecializationLabel: string | null;
            assignmentRotationFamily: string | null;
            assignmentRotationLaneId: string | null;
            assignmentRotationTermRank: number | null;
            assignmentRotationTermLabel: string | null;
            assignmentRotationTermGroupId: string | null;
            assignmentRotationTermCount: number | null;
            assignmentRawMinutesPerWeek: number | null;
            assignmentConcurrentDeltaMinutesPerWeek: number | null;
            assignmentExpandsConcurrentDemand: boolean | null;
        })[];
        assignmentKind: TeachingLoadAssignmentKind;
        storedCurrentYearSectionCount: number;
        ownedCurrentYearSectionCount: number;
        missingOwnershipSectionCount: number;
        ownershipWithoutScopeSectionCount: number;
        outOfSubjectScopeSectionCount: number;
        id: number;
        facultyId: number;
        subjectId: number;
        schoolId: number;
        assignedBy: number;
        assignedAt: Date;
        version: number;
        createdAt: Date;
        updatedAt: Date;
        subject: {
            id: number;
            name: string;
            code: string;
            modularGroupId?: string | null;
            modularOrder?: number | null;
            termGroupId?: string | null;
            termCount?: number | null;
            minMinutesPerWeek: number;
            rotationFamily?: string | null;
        };
    }[];
    rotationTermBreakdown: RotationFamilyTermBreakdown[];
} | null>;
export declare function setAssignments(facultyId: number, schoolId: number, schoolYearId: number, assignedBy: number, expectedVersion: number, assignments: AssignmentScopeInput[], authToken?: string): Promise<AssignmentMutationResult>;
export declare function getAssignmentSummary(schoolId: number, schoolYearId: number, authToken?: string, listOptions?: AssignmentSummaryListOptions): Promise<{
    faculty: {
        id: number;
        externalId: number;
        isPlaceholder: boolean;
        employeeId: string | null;
        firstName: string;
        lastName: string;
        department: string | null;
        specialization: string | null;
        employmentStatus: string;
        isClassAdviser: boolean;
        advisedSectionId: number | null;
        advisedSectionName: string | null;
        advisoryEquivalentHours: number;
        ancillaryMinutesPerWeek: number | null;
        canTeachOutsideDepartment: boolean;
        isActiveForScheduling: boolean;
        maxHoursPerWeek: number;
        version: number;
        subjectCount: number;
        sectionCount: number;
        baselineSubjectCount: number;
        missingOwnershipSubjectCount: number;
        ownershipWithoutScopeSubjectCount: number;
        subjectHours: number;
        loadPercentage: number;
        sectionTeachingHours: number;
        sectionTeachingHoursRaw: number;
        rotationFamilyOvercountHours: number;
        rotationFamilyLoadDetails: RotationFamilyLoadDetail[];
        rotationTermBreakdown: RotationFamilyTermBreakdown[];
        gradeTeachingHours: number;
        advisoryHours: number;
        ancillaryHours: number;
        policyCreditedHours: number;
        policyLoadPercentage: number;
        syntheticCoverageHours: number;
        loadSignalMode: string;
        assignments: {
            gradeLevels: number[];
            sectionIds: number[];
            sections: (import("./faculty-assignment-scope.service.js").ScopedSection & {
                assignmentSpecializationCode: string | null;
                assignmentSpecializationLabel: string | null;
                assignmentRotationFamily: string | null;
                assignmentRotationLaneId: string | null;
                assignmentRotationTermRank: number | null;
                assignmentRotationTermLabel: string | null;
                assignmentRotationTermGroupId: string | null;
                assignmentRotationTermCount: number | null;
                assignmentRawMinutesPerWeek: number | null;
                assignmentConcurrentDeltaMinutesPerWeek: number | null;
                assignmentExpandsConcurrentDemand: boolean | null;
            })[];
            assignmentKind: TeachingLoadAssignmentKind;
            storedCurrentYearSectionCount: number;
            ownedCurrentYearSectionCount: number;
            missingOwnershipSectionCount: number;
            ownershipWithoutScopeSectionCount: number;
            outOfSubjectScopeSectionCount: number;
            id: number;
            facultyId: number;
            subjectId: number;
            schoolId: number;
            assignedBy: number;
            assignedAt: Date;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            subject: {
                id: number;
                name: string;
                code: string;
                modularGroupId?: string | null;
                modularOrder?: number | null;
                termGroupId?: string | null;
                termCount?: number | null;
                minMinutesPerWeek: number;
                rotationFamily?: string | null;
            };
        }[];
    }[];
    listPage: AssignmentSummaryPageResult<{
        id: number;
        externalId: number;
        isPlaceholder: boolean;
        employeeId: string | null;
        firstName: string;
        lastName: string;
        department: string | null;
        specialization: string | null;
        employmentStatus: string;
        isClassAdviser: boolean;
        advisedSectionId: number | null;
        advisedSectionName: string | null;
        advisoryEquivalentHours: number;
        ancillaryMinutesPerWeek: number | null;
        canTeachOutsideDepartment: boolean;
        isActiveForScheduling: boolean;
        maxHoursPerWeek: number;
        version: number;
        subjectCount: number;
        sectionCount: number;
        baselineSubjectCount: number;
        missingOwnershipSubjectCount: number;
        ownershipWithoutScopeSubjectCount: number;
        subjectHours: number;
        loadPercentage: number;
        sectionTeachingHours: number;
        sectionTeachingHoursRaw: number;
        rotationFamilyOvercountHours: number;
        rotationFamilyLoadDetails: RotationFamilyLoadDetail[];
        rotationTermBreakdown: RotationFamilyTermBreakdown[];
        gradeTeachingHours: number;
        advisoryHours: number;
        ancillaryHours: number;
        policyCreditedHours: number;
        policyLoadPercentage: number;
        syntheticCoverageHours: number;
        loadSignalMode: string;
        assignments: {
            gradeLevels: number[];
            sectionIds: number[];
            sections: (import("./faculty-assignment-scope.service.js").ScopedSection & {
                assignmentSpecializationCode: string | null;
                assignmentSpecializationLabel: string | null;
                assignmentRotationFamily: string | null;
                assignmentRotationLaneId: string | null;
                assignmentRotationTermRank: number | null;
                assignmentRotationTermLabel: string | null;
                assignmentRotationTermGroupId: string | null;
                assignmentRotationTermCount: number | null;
                assignmentRawMinutesPerWeek: number | null;
                assignmentConcurrentDeltaMinutesPerWeek: number | null;
                assignmentExpandsConcurrentDemand: boolean | null;
            })[];
            assignmentKind: TeachingLoadAssignmentKind;
            storedCurrentYearSectionCount: number;
            ownedCurrentYearSectionCount: number;
            missingOwnershipSectionCount: number;
            ownershipWithoutScopeSectionCount: number;
            outOfSubjectScopeSectionCount: number;
            id: number;
            facultyId: number;
            subjectId: number;
            schoolId: number;
            assignedBy: number;
            assignedAt: Date;
            version: number;
            createdAt: Date;
            updatedAt: Date;
            subject: {
                id: number;
                name: string;
                code: string;
                modularGroupId?: string | null;
                modularOrder?: number | null;
                termGroupId?: string | null;
                termCount?: number | null;
                minMinutesPerWeek: number;
                rotationFamily?: string | null;
            };
        }[];
    }>;
    ownershipIndex: SubjectSectionOwnershipIndexEntry[];
    coverageTotals: TeachingLoadCoverageTotals;
    integrityDiagnostics: TeachingLoadIntegrityDiagnostics;
}>;
export declare function previewOrApplyTeachingLoadTruthReconcile(input: TeachingLoadTruthReconcileInput): Promise<TeachingLoadTruthReconcileResult>;
export declare function previewOrApplyStaleOwnershipReconcile(input: StaleOwnershipReconcileInput): Promise<StaleOwnershipReconcileResult>;
export interface TeachingLoadResetInput {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    subjectId?: number;
    previewOnly?: boolean;
}
export declare function getFacultyAssignmentIdentitySummary(facultyId: number, schoolYearId: number, authToken?: string): Promise<Array<{
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    subjectDisplayLabel: string;
    sectionId: number;
    sectionName: string;
    gradeLevel: number;
    specializationCode: string | null;
    specializationLabel: string | null;
    rotationFamily: string | null;
    rotationLaneId: string | null;
    rotationTermRank: number | null;
    rotationTermLabel: string | null;
    rotationTermGroupId: string | null;
    rotationTermCount: number | null;
    rawMinutesPerWeek: number | null;
    concurrentDeltaMinutesPerWeek: number | null;
    expandsConcurrentDemand: boolean | null;
}>>;
export interface TeachingLoadResetResult {
    applied: boolean;
    scope: 'GLOBAL' | 'SUBJECT';
    schoolId: number;
    schoolYearId: number;
    subjectId: number | null;
    ownershipRowsToRemove: number;
    facultySubjectRowsAffected: number;
    facultySubjectRowsDeleted: number;
    facultySubjectRowsUpdated: number;
    affectedFacultyCount: number;
    affectedSubjectCount: number;
    subjectCodes: string[];
}
export declare function previewOrApplyTeachingLoadReset(input: TeachingLoadResetInput): Promise<TeachingLoadResetResult>;
export {};
