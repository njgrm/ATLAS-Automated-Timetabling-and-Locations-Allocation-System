/**
 * Cohort service — TLE inter-section cohort ingestion and management.
 * Wave 3.5: Supports specialized TLE groups (IA, HE, etc.) that span multiple sections.
 *
 * Cohorts are fetched from EnrollPro's SCP config endpoint and persisted locally
 * for scheduling reference.
 */
import type { RoomType } from '@prisma/client';
import { type SectionsByGrade } from './section-adapter.js';
export interface ExternalCohort {
    cohortCode: string;
    specializationCode: string;
    specializationName: string;
    gradeLevel: number;
    memberSectionIds: number[];
    expectedEnrollment: number;
    preferredRoomType?: RoomType | null;
    sourceRef?: string | null;
}
export interface CohortFetchResult {
    cohorts: ExternalCohort[];
    source: 'enrollpro' | 'stub' | 'derived-sections' | 'derived-special-program' | 'cached-enrollpro';
    fetchedAt: Date;
    contractWarnings?: string[];
}
export interface CohortAdapter {
    fetchCohorts(schoolYearId: number, schoolId: number, authToken?: string, context?: {
        sectionsByGrade?: SectionsByGrade[];
    }): Promise<CohortFetchResult>;
}
export declare function deriveFallbackTleCohorts(gradeLevels: SectionsByGrade[]): ExternalCohort[];
export declare function normalizeEnrollProCohortResponse(body: unknown, sectionsByGrade?: SectionsByGrade[]): {
    cohorts: ExternalCohort[];
    source: CohortFetchResult['source'];
    warnings: string[];
};
export interface CohortSyncResult {
    synced: boolean;
    source: 'enrollpro' | 'stub' | 'derived-sections' | 'derived-special-program' | 'cached-enrollpro' | 'preserved-existing';
    fetchedAt: Date;
    count: number;
    error?: string;
    warnings?: string[];
}
/**
 * Sync cohorts from external source and persist to InstructionalCohort table.
 */
export declare function syncCohorts(schoolId: number, schoolYearId: number, authToken?: string): Promise<CohortSyncResult>;
/**
 * Get all cohorts for a school/year from local persistence.
 */
export declare function getCohortsBySchoolYear(schoolId: number, schoolYearId: number): Promise<{
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    updatedAt: Date;
    isActive: boolean;
    specializationCode: string;
    preferredRoomType: import("@prisma/client").$Enums.RoomType | null;
    cohortCode: string;
    gradeLevel: number;
    specializationName: string;
    memberSectionIds: number[];
    expectedEnrollment: number;
    sourceRef: string | null;
}[]>;
/**
 * Get cohorts by grade level.
 */
export declare function getCohortsByGrade(schoolId: number, schoolYearId: number, gradeLevel: number): Promise<{
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    updatedAt: Date;
    isActive: boolean;
    specializationCode: string;
    preferredRoomType: import("@prisma/client").$Enums.RoomType | null;
    cohortCode: string;
    gradeLevel: number;
    specializationName: string;
    memberSectionIds: number[];
    expectedEnrollment: number;
    sourceRef: string | null;
}[]>;
/**
 * Get a single cohort by code.
 */
export declare function getCohortByCode(schoolId: number, schoolYearId: number, cohortCode: string): Promise<{
    schoolId: number;
    schoolYearId: number;
    createdAt: Date;
    id: number;
    updatedAt: Date;
    isActive: boolean;
    specializationCode: string;
    preferredRoomType: import("@prisma/client").$Enums.RoomType | null;
    cohortCode: string;
    gradeLevel: number;
    specializationName: string;
    memberSectionIds: number[];
    expectedEnrollment: number;
    sourceRef: string | null;
} | null>;
