export type ActiveDraftRun = {
    id: number;
    schoolId: number;
    schoolYearId: number;
    status: 'COMPLETED';
    version: number;
    finishedAt: Date | null;
    createdAt: Date;
    draftEntries: unknown;
};
export declare function resolveActiveDraftRun(schoolId: number, schoolYearId: number): Promise<ActiveDraftRun>;
