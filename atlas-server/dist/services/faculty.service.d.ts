/**
 * Faculty service - Wave 3.5 Source-of-Truth Hardening
 *
 * Features:
 * - Full reconciliation with optional prune mode
 * - Durable cache with auto-save and auto-fallback
 * - Stale teachers hidden by default
 * - Adviser mapping support
 */
import { prisma } from '../lib/prisma.js';
import { type ExternalFaculty } from './faculty-adapter.js';
export type FacultySourceLabel = 'enrollpro' | 'cached-enrollpro' | 'stub';
export type FacultySyncMode = 'reconcile' | 'prune';
export interface FacultyReconciliationSummary {
    inserted: number;
    updated: number;
    removed: number;
    skipped: number;
    deactivated: number;
}
export interface AssignmentScopePruneSummary {
    updated: number;
    removed: number;
    unchanged: number;
}
export interface FacultySyncOptions {
    mode?: FacultySyncMode;
    pruneSectionAssignments?: boolean;
    invalidateRuns?: boolean;
}
export interface FacultySyncResult {
    synced: boolean;
    error?: string;
    source: FacultySourceLabel;
    fetchedAt: Date;
    activeCount: number;
    staleCount: number;
    deactivatedCount: number;
    mode: FacultySyncMode;
    reconciliation: FacultyReconciliationSummary;
    assignmentPrune: AssignmentScopePruneSummary;
    invalidatedRuns: {
        invalidatedCount: number;
        staleRunIds: number[];
    };
    seededAssignments: {
        created: number;
        skipped: number;
    };
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
interface LocalMirrorComparable {
    id: number;
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    specialization: string | null;
    employmentStatus: string;
    isClassAdviser: boolean;
    advisoryEquivalentHours: number;
    canTeachOutsideDepartment: boolean;
    contactInfo: string | null;
    advisedSectionId: number | null;
    advisedSectionName: string | null;
    isStale: boolean;
}
export interface AssignmentScopeSnapshot {
    id: number;
    sectionIds: number[];
    gradeLevels: number[];
}
export interface AssignmentScopeReconcileDecision {
    id: number;
    action: 'skip' | 'update' | 'remove';
    sectionIds: number[];
    gradeLevels: number[];
}
export declare function buildFacultyReconciliationSummary(external: ExternalFaculty[], localMirrors: LocalMirrorComparable[], mode: FacultySyncMode): FacultyReconciliationSummary;
export declare function reconcileAssignmentScopesToSections(assignments: AssignmentScopeSnapshot[], sectionDisplayOrderById: Map<number, number>): AssignmentScopeReconcileDecision[];
export declare function syncFacultyFromExternal(schoolId: number, schoolYearId: number, authToken?: string, options?: FacultySyncOptions): Promise<FacultySyncResult>;
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
            updatedAt: Date;
            isActive: boolean;
            code: string;
            minMinutesPerWeek: number;
            preferredRoomType: import("@prisma/client").$Enums.RoomType;
            sessionPattern: import("@prisma/client").$Enums.SessionPattern;
            gradeLevels: number[];
            isSeedable: boolean;
            interSectionEnabled: boolean;
            interSectionGradeLevels: number[];
            programScopes: import("@prisma/client").$Enums.ProgramType[];
            allowedSpecializations: string[];
        };
    } & {
        schoolId: number;
        createdAt: Date;
        id: number;
        version: number;
        updatedAt: Date;
        facultyId: number;
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
    externalId: number;
    firstName: string;
    lastName: string;
    department: string | null;
    specialization: string | null;
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
    updatedAt: Date;
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
        externalId: number;
        firstName: string;
        lastName: string;
        department: string | null;
        specialization: string | null;
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
        updatedAt: Date;
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
export {};
