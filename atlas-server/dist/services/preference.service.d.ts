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
export interface WellbeingInput {
    pregnancySupport?: boolean;
    physicalAilmentSupport?: boolean;
    minimizeTravelTime?: boolean;
    avoidUpperFloors?: boolean;
}
export interface SaveDraftInput {
    schoolId: number;
    schoolYearId: number;
    facultyId: number;
    notes?: string | null;
    timeSlots: TimeSlotInput[];
    version?: number;
    wellbeing?: WellbeingInput;
}
export interface SubmitInput extends SaveDraftInput {
    version: number;
}
interface ServiceError {
    statusCode: number;
    code: string;
    message: string;
}
export declare function checkPreferenceWindow(currentPhase: string): ServiceError | null;
export declare function getPreference(schoolId: number, schoolYearId: number, facultyId: number): Promise<({
    timeSlots: {
        day: import("@prisma/client").$Enums.DayOfWeek;
        createdAt: Date;
        id: number;
        preferenceId: number;
        startTime: string;
        endTime: string;
        preference: import("@prisma/client").$Enums.TimeSlotPreference;
    }[];
} & {
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    status: import("@prisma/client").$Enums.PreferenceStatus;
    facultyId: number;
    updatedAt: Date;
    version: number;
    notes: string | null;
    submittedAt: Date | null;
    pregnancySupport: boolean;
    physicalAilmentSupport: boolean;
    minimizeTravelTime: boolean;
    avoidUpperFloors: boolean;
}) | null>;
export declare function saveDraft(input: SaveDraftInput): Promise<{
    timeSlots: {
        day: import("@prisma/client").$Enums.DayOfWeek;
        createdAt: Date;
        id: number;
        preferenceId: number;
        startTime: string;
        endTime: string;
        preference: import("@prisma/client").$Enums.TimeSlotPreference;
    }[];
} & {
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    status: import("@prisma/client").$Enums.PreferenceStatus;
    facultyId: number;
    updatedAt: Date;
    version: number;
    notes: string | null;
    submittedAt: Date | null;
    pregnancySupport: boolean;
    physicalAilmentSupport: boolean;
    minimizeTravelTime: boolean;
    avoidUpperFloors: boolean;
}>;
export declare function submitPreference(input: SubmitInput): Promise<{
    timeSlots: {
        day: import("@prisma/client").$Enums.DayOfWeek;
        createdAt: Date;
        id: number;
        preferenceId: number;
        startTime: string;
        endTime: string;
        preference: import("@prisma/client").$Enums.TimeSlotPreference;
    }[];
} & {
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    status: import("@prisma/client").$Enums.PreferenceStatus;
    facultyId: number;
    updatedAt: Date;
    version: number;
    notes: string | null;
    submittedAt: Date | null;
    pregnancySupport: boolean;
    physicalAilmentSupport: boolean;
    minimizeTravelTime: boolean;
    avoidUpperFloors: boolean;
}>;
export declare function getOfficerSummary(schoolId: number, schoolYearId: number, statusFilter?: 'SUBMITTED' | 'DRAFT' | 'MISSING'): Promise<{
    counts: {
        total: number;
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
    auditId: number;
    timestamp: string;
    note: string;
}>;
export declare function seedPreferencesForSchoolYear(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    totalFaculty: number;
    alreadySeeded: number;
    created: number;
    schoolId: number;
    schoolYearId: number;
    auditId: number;
}>;
export declare function getOfficerSummaryWithReviews(schoolId: number, schoolYearId: number, statusFilter?: 'SUBMITTED' | 'DRAFT' | 'MISSING'): Promise<{
    counts: {
        total: number;
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
        wellbeing: {
            pregnancySupport: boolean;
            physicalAilmentSupport: boolean;
            minimizeTravelTime: boolean;
            avoidUpperFloors: boolean;
        } | null;
    }[];
}>;
export declare function getPreferenceDetail(schoolId: number, schoolYearId: number, facultyId: number): Promise<{
    faculty: {
        firstName: string;
        lastName: string;
        department: string | null;
    };
    timeSlots: {
        day: import("@prisma/client").$Enums.DayOfWeek;
        createdAt: Date;
        id: number;
        preferenceId: number;
        startTime: string;
        endTime: string;
        preference: import("@prisma/client").$Enums.TimeSlotPreference;
    }[];
    review: {
        createdAt: Date;
        id: number;
        updatedAt: Date;
        preferenceId: number;
        reviewerId: number;
        reviewStatus: import("@prisma/client").$Enums.ReviewStatus;
        reviewerNotes: string | null;
        reviewedAt: Date | null;
    } | null;
} & {
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    status: import("@prisma/client").$Enums.PreferenceStatus;
    facultyId: number;
    updatedAt: Date;
    version: number;
    notes: string | null;
    submittedAt: Date | null;
    pregnancySupport: boolean;
    physicalAilmentSupport: boolean;
    minimizeTravelTime: boolean;
    avoidUpperFloors: boolean;
}>;
export interface UpdateReviewInput {
    schoolId: number;
    schoolYearId: number;
    preferenceId: number;
    reviewerId: number;
    reviewStatus: 'REVIEWED' | 'NEEDS_FOLLOW_UP';
    reviewerNotes?: string | null;
}
export declare function updateReview(input: UpdateReviewInput): Promise<{
    createdAt: Date;
    id: number;
    updatedAt: Date;
    preferenceId: number;
    reviewerId: number;
    reviewStatus: import("@prisma/client").$Enums.ReviewStatus;
    reviewerNotes: string | null;
    reviewedAt: Date | null;
}>;
export declare function isDevToolsEnabled(): boolean;
export declare function devBulkSubmitSeeded(schoolId: number, schoolYearId: number, actorId: number): Promise<{
    converted: number;
    auditId: null;
} | {
    converted: number;
    auditId: number;
}>;
export {};
