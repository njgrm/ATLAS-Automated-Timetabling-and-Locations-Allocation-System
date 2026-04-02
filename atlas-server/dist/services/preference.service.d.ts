/**
 * Preference service — faculty preference CRUD and officer monitoring.
 * Business logic only; no transport concerns.
 */
import type { DayOfWeek, TimeSlotPreference, ReviewStatus } from '@prisma/client';
export interface TimeSlotInput {
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    preference: TimeSlotPreference;
}
export interface SaveDraftInput {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
    notes?: string | null;
    timeSlots: TimeSlotInput[];
    version?: number;
}
export interface SubmitInput extends SaveDraftInput {
    version: number;
}
interface ServiceError {
    statusCode: number;
    code: string;
    message: string;
}
/**
 * Check whether the preference window is currently active.
 * In v1 this checks the lifecycle phase constant; in future it will read
 * persisted phase state per school+year.
 *
 * Returns null if window is open, or a ServiceError if blocked.
 */
export declare function checkPreferenceWindow(currentPhase: string): ServiceError | null;
export declare function getPreference(schoolId: number, schoolYearId: number, facultyId: number): Promise<any>;
export declare function saveDraft(input: SaveDraftInput): Promise<any>;
export declare function submitPreference(input: SubmitInput): Promise<any>;
export declare function getOfficerSummary(schoolId: number, schoolYearId: number, statusFilter?: 'SUBMITTED' | 'DRAFT' | 'MISSING'): Promise<{
    counts: {
        total: any;
        submitted: number;
        draft: number;
        missing: number;
    };
    faculty: {
        facultyId: number;
        firstName: string;
        lastName: string;
        department: string | null;
        preferenceStatus: "SUBMITTED" | "DRAFT" | "MISSING";
        submittedAt: Date | null;
    }[];
}>;
export declare function triggerReminder(schoolId: number, schoolYearId: number, facultyIds: number[], triggeredBy: number): Promise<{
    reminded: number;
    auditId: any;
    timestamp: string;
    note: string;
}>;
export declare function seedPreferencesForSchoolYear(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    totalFaculty: any;
    alreadySeeded: number;
    created: any;
    schoolId: number;
    schoolYearId: number;
    auditId: any;
}>;
export declare function getOfficerSummaryWithReviews(schoolId: number, schoolYearId: number, statusFilter?: 'SUBMITTED' | 'DRAFT' | 'MISSING'): Promise<{
    counts: {
        total: any;
        submitted: number;
        draft: number;
        missing: number;
    };
    faculty: {
        facultyId: number;
        firstName: string;
        lastName: string;
        department: string | null;
        preferenceStatus: "SUBMITTED" | "DRAFT" | "MISSING";
        submittedAt: Date | null;
        reviewStatus: ReviewStatus | null;
        reviewedAt: Date | null;
    }[];
}>;
export declare function getPreferenceDetail(schoolId: number, schoolYearId: number, facultyId: number): Promise<any>;
export interface UpdateReviewInput {
    schoolId: number;
    schoolYearId: number;
    preferenceId: number;
    reviewerId: number;
    reviewStatus: 'REVIEWED' | 'NEEDS_FOLLOW_UP';
    reviewerNotes?: string | null;
}
export declare function updateReview(input: UpdateReviewInput): Promise<any>;
export declare function isDevToolsEnabled(): boolean;
export declare function devBulkSubmitSeeded(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    converted: any;
    auditId: any;
}>;
export {};
