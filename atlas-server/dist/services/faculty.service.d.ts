/**
 * Faculty service — Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation (upsert + stale detection)
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */
import { prisma } from '../lib/prisma.js';
export type FacultySourceLabel = 'enrollpro' | 'cached-enrollpro' | 'stub';
export interface FacultySyncResult {
    synced: boolean;
    error?: string;
    source: FacultySourceLabel;
    fetchedAt: Date;
    activeCount: number;
    staleCount: number;
    deactivatedCount: number;
    isStale?: boolean;
    staleReason?: string;
}
export interface FacultyListResult {
    faculty: Awaited<ReturnType<typeof prisma.facultyMirror.findMany>>;
    source: FacultySourceLabel;
    fetchedAt: Date | null;
    isStale: boolean;
    staleReason?: string;
    activeCount: number;
    staleCount: number;
}
export declare function syncFacultyFromExternal(schoolId: number, schoolYearId: number, authToken?: string): Promise<FacultySyncResult>;
export interface GetFacultyOptions {
    includeStale?: boolean;
}
export declare function getFacultyBySchool(schoolId: number, options?: GetFacultyOptions): Promise<FacultyListResult>;
export declare function getFacultyById(id: number): Promise<({
    facultySubjects: ({
        subject: {
            schoolId: number;
            createdAt: Date;
            id: number;
            name: string;
            code: string;
            isActive: boolean;
            updatedAt: Date;
            minMinutesPerWeek: number;
            preferredRoomType: import("@prisma/client").$Enums.RoomType;
            sessionPattern: import("@prisma/client").$Enums.SessionPattern;
            gradeLevels: number[];
            isSeedable: boolean;
            interSectionEnabled: boolean;
            interSectionGradeLevels: number[];
        };
    } & {
        schoolId: number;
        createdAt: Date;
        id: number;
        facultyId: number;
        updatedAt: Date;
        version: number;
        gradeLevels: number[];
        subjectId: number;
        sectionIds: number[];
        assignedBy: number;
        assignedAt: Date;
    })[];
} & {
    schoolId: number;
    createdAt: Date;
    id: number;
    updatedAt: Date;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    employmentStatus: string;
    contactInfo: string | null;
    avatarUrl: string | null;
    localNotes: string | null;
    isActiveForScheduling: boolean;
    isClassAdviser: boolean;
    advisoryEquivalentHours: number;
    canTeachOutsideDepartment: boolean;
    maxHoursPerWeek: number;
    lastSyncedAt: Date;
    isStale: boolean;
    staleReason: string | null;
    staleAt: Date | null;
    advisedSectionId: number | null;
    advisedSectionName: string | null;
    version: number;
}) | null>;
export declare function updateFacultyMirror(id: number, data: Partial<{
    localNotes: string;
    isActiveForScheduling: boolean;
    maxHoursPerWeek: number;
    employmentStatus: string;
    isClassAdviser: boolean;
    advisoryEquivalentHours: number;
    canTeachOutsideDepartment: boolean;
}>, expectedVersion: number): Promise<{
    success: false;
    error: string;
    faculty?: undefined;
} | {
    success: true;
    faculty: {
        schoolId: number;
        createdAt: Date;
        id: number;
        updatedAt: Date;
        externalId: number;
        firstName: string;
        lastName: string;
        department: string | null;
        employmentStatus: string;
        contactInfo: string | null;
        avatarUrl: string | null;
        localNotes: string | null;
        isActiveForScheduling: boolean;
        isClassAdviser: boolean;
        advisoryEquivalentHours: number;
        canTeachOutsideDepartment: boolean;
        maxHoursPerWeek: number;
        lastSyncedAt: Date;
        isStale: boolean;
        staleReason: string | null;
        staleAt: Date | null;
        advisedSectionId: number | null;
        advisedSectionName: string | null;
        version: number;
    };
    error?: undefined;
}>;
export declare function getFacultyCountBySchool(schoolId: number): Promise<number>;
export declare function getLastSyncTime(schoolId: number): Promise<Date | null>;
export declare function getFacultyWithAdviserInfo(schoolId: number): Promise<{
    id: number;
    firstName: string;
    lastName: string;
    advisedSectionId: number | null;
    advisedSectionName: string | null;
}[]>;
export declare function getHomeroomRecommendation(facultyId: number): Promise<{
    hasAdviserMapping: boolean;
    advisedSectionId: number;
    advisedSectionName: string | null;
    homeroomHint: string;
} | null>;
