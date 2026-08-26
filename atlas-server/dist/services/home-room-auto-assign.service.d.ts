export type AutoAssignMode = 'preview' | 'apply';
export type AutoAssignOptions = {
    schoolId: number;
    schoolYearId: number;
    mode: AutoAssignMode;
    overwriteExisting?: boolean;
    allowCrossGradeFallback?: boolean;
};
export type AutoAssignResult = {
    schoolId: number;
    schoolYearId: number;
    mode: AutoAssignMode;
    overwriteExisting: boolean;
    allowCrossGradeFallback: boolean;
    assignments: Array<{
        sectionId: number;
        sectionName: string;
        gradeLevel: number;
        homeRoomId: number;
        roomName: string;
        buildingId: number;
        buildingName: string;
        reason: string;
    }>;
    skipped: Array<{
        sectionId: number;
        sectionName: string;
        gradeLevel: number;
        reason: string;
    }>;
    counts: {
        sectionsConsidered: number;
        assigned: number;
        skipped: number;
        existingPreserved: number;
        applied: number;
    };
};
export declare function computeAutoAssign(options: AutoAssignOptions): Promise<AutoAssignResult>;
