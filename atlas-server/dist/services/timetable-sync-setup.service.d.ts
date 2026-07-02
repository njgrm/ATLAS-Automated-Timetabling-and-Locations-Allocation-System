export declare function syncTimetableSetup(schoolId: number, schoolYearId: number, runId: number, actorId: number): Promise<{
    runId: number;
    version: number;
    updatedFacultyCount: number;
    displacedEntriesCount: number;
    addedUnassignedCount: number;
    hardViolationCount: number;
    softViolationCount: number;
    summary: import(".prisma/client/runtime/library").JsonValue;
}>;
