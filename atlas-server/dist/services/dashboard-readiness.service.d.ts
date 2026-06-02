export type DashboardReadinessSourceState = 'verified_live' | 'checking_source' | 'using_saved_data' | 'no_saved_data' | 'partial_degraded';
export type DashboardLifecyclePhase = 'SETUP' | 'PREFERENCES' | 'GENERATION' | 'REVIEW' | 'PUBLISHED';
export type DashboardLatestRunStatus = 'NONE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
type DomainSource = {
    state: DashboardReadinessSourceState;
    message: string;
    source: string;
    fetchedAt: string | null;
    error?: string;
};
type DashboardSummaryInput = {
    schoolId: number;
    schoolYearId?: number;
    authToken?: string;
};
type DashboardBuilding = {
    id: number;
    name: string;
    shortCode: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
    floorCount: number;
    isTeachingBuilding: boolean;
    rooms: Array<{
        id: number;
        name: string;
        floor: number;
        type: string;
        capacity: number | null;
        isTeachingSpace: boolean;
        floorPosition: number;
        buildingId: number;
        features: string[];
    }>;
};
type CampusReadinessData = {
    buildings: DashboardBuilding[];
    campusImageUrl: string | null;
    teachingRoomCount: number;
    totalRoomCount: number;
    buildingSetupStatus: {
        done: boolean;
        subMessage?: string;
    };
};
type SubjectReadinessData = {
    subjectCount: number;
    unassignedSubjectCount: number;
};
type FacultyReadinessData = {
    facultyCount: number;
    lastSyncedAt: string | null;
};
type SectionReadinessData = {
    sectionCount: number | null;
    lastSyncedAt: string | null;
};
type LatestRunReadinessData = {
    latestRunStatus: DashboardLatestRunStatus;
    latestRunId: number | null;
    violationCount: number | null;
    isPublished: boolean;
    createdAt: string | null;
    finishedAt: string | null;
};
export type DashboardReadinessSummary = {
    schoolId: number;
    activeSchoolYearId: number | null;
    activeSchoolYearLabel: string | null;
    resolvedAt: string;
    sourceState: DashboardReadinessSourceState;
    sourceMessage: string;
    campus: CampusReadinessData;
    subjects: SubjectReadinessData;
    faculty: FacultyReadinessData;
    sections: SectionReadinessData;
    generation: LatestRunReadinessData;
    lifecyclePhase: DashboardLifecyclePhase;
    sources: {
        runtimeContext: DomainSource;
        campus: DomainSource;
        subjects: DomainSource;
        faculty: DomainSource;
        sections: DomainSource;
        generation: DomainSource;
    };
};
export declare function getDashboardReadinessSummary(input: DashboardSummaryInput): Promise<DashboardReadinessSummary>;
export {};
