type LifecyclePhase = 'SETUP' | 'PREFERENCE_COLLECTION' | 'GENERATION' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export declare function getFacultyPortalDashboard(params: {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
}): Promise<{
    phase: LifecyclePhase;
    phaseMessage: string;
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
        entries: never[];
        counts: {
            total: number;
            pending: number;
            approved: number;
            rejected: number;
            unchanged: number;
        };
    };
    statuses: {
        requestStatusLabel: string;
        reviewStatusLabel: string;
    };
} | {
    phase: LifecyclePhase;
    phaseMessage: string;
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
        entries: import("./room-preference.service.js").FacultyRoomPreferenceEntry[];
        counts: {
            total: number;
            pending: number;
            approved: number;
            rejected: number;
            unchanged: number;
        };
    };
    statuses: {
        requestStatusLabel: string;
        reviewStatusLabel: string;
    };
}>;
export {};
