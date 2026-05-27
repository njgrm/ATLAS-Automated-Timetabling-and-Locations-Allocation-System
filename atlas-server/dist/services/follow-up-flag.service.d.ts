/** List all follow-up flags for a generation run (scope-verified). */
export declare function listByRun(runId: number, schoolId: number, schoolYearId: number): Promise<{
    id: number;
    createdAt: Date;
    createdBy: number;
    note: string | null;
    runId: number;
    entryId: string;
}[]>;
/** Toggle a follow-up flag: create if absent, delete if present. Returns the new state. */
export declare function toggleFlag(runId: number, entryId: string, createdBy: number, schoolId: number, schoolYearId: number): Promise<{
    flagged: boolean;
}>;
/** Remove a specific follow-up flag (scope-verified). */
export declare function removeFlag(runId: number, entryId: string, schoolId: number, schoolYearId: number): Promise<import("@prisma/client").Prisma.BatchPayload>;
