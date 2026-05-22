type LifecyclePhase = 'SETUP' | 'PREFERENCE_COLLECTION' | 'GENERATION' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export declare function getFacultyPortalDashboard(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
    authToken?: string;
}): Promise<{
    phase: LifecyclePhase;
    phaseMessage: string;
    runContext: {
        state: "NO_ACTIVE_DRAFT";
        runId: null;
        runVersion: null;
        generatedAt: null;
        reason: string;
        recoveryHint: string;
    };
    fallbackBanner: {
        show: boolean;
        title: string;
        message: string;
        runId?: undefined;
        generatedAt?: undefined;
    };
    schedulePreview: {
        runId: null;
        runVersion: null;
        generatedAt: null;
        entries: never[];
        counts: {
            total: number;
            pending: number;
            approved: number;
            rejected: number;
            unchanged: number;
        };
    };
    teachingAssignments: never[];
    statuses: {
        requestStatusLabel: string;
        reviewStatusLabel: string;
    };
} | {
    phase: LifecyclePhase;
    phaseMessage: string;
    runContext: {
        state: "ACTIVE_DRAFT";
        runId: number;
        runVersion: number;
        generatedAt: string | null;
        reason: null;
        recoveryHint: null;
    };
    fallbackBanner: {
        show: boolean;
        title: string;
        message: string;
        runId: number;
        generatedAt: string | null;
    };
    schedulePreview: {
        runId: number;
        runVersion: number;
        generatedAt: string | null;
        entries: import("./room-preference.service.js").FacultyRoomPreferenceEntry[];
        counts: {
            total: number;
            pending: number;
            approved: number;
            rejected: number;
            unchanged: number;
        };
    };
    teachingAssignments: {
        subjectId: number;
        subjectCode: string;
        subjectName: string;
        subjectDisplayLabel: string;
        sectionId: number;
        sectionName: string;
        gradeLevel: number;
        specializationCode: string | null;
        specializationLabel: string | null;
    }[];
    statuses: {
        requestStatusLabel: string;
        reviewStatusLabel: string;
    };
}>;
export {};
