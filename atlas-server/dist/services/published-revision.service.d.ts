import type { PublishedScheduleRevision } from '@prisma/client';
export type PublishedRevisionValueSnapshot = {
    facultyId?: number | null;
    roomId?: number | null;
    day?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    subjectId?: number | null;
    sectionId?: number | null;
    [key: string]: unknown;
};
export type PublishedRevisionEntryChange = {
    entryId: string;
    changeType?: string;
    previous: PublishedRevisionValueSnapshot;
    next: PublishedRevisionValueSnapshot;
};
export type CreatePublishedScheduleRevisionInput = {
    schoolId: number;
    schoolYearId: number;
    sourceRunId: number;
    sourceRevisionId?: number | null;
    actorId?: number | null;
    effectiveDate?: string | Date | null;
    reason?: string | null;
    changes?: PublishedRevisionEntryChange[] | null;
    changeSummary?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
};
export type CreatePublishedScheduleRevisionResult = {
    revision: PublishedScheduleRevision;
    auditId: number;
};
export declare function createPublishedScheduleRevision(input: CreatePublishedScheduleRevisionInput, options?: {
    now?: Date;
}): Promise<CreatePublishedScheduleRevisionResult>;
export declare function listPublishedScheduleRevisions(params: {
    schoolId: number;
    schoolYearId: number;
    sourceRunId?: number;
}): Promise<PublishedScheduleRevision[]>;
