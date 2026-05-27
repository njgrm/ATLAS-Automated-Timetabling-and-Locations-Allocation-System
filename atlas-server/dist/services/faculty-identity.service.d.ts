import type { Prisma } from '@prisma/client';
import type { AuthPayload } from '../middleware/authenticate.js';
declare const FACULTY_IDENTITY_SELECT: {
    id: true;
    externalId: true;
    employeeId: true;
    schoolId: true;
    firstName: true;
    lastName: true;
    contactInfo: true;
    isActiveForScheduling: true;
    isStale: true;
    lastSyncedAt: true;
};
type FacultyIdentityMirror = Prisma.FacultyMirrorGetPayload<{
    select: typeof FACULTY_IDENTITY_SELECT;
}>;
type IdentitySignal = 'SOURCE_EXTERNAL_ID' | 'EMPLOYEE_ID' | 'ASSIGNMENT_BEARING' | 'AUTH_LINK' | 'TOKEN_EXTERNAL_ID' | 'CONTACT_EMAIL';
export type CanonicalFacultyResolution = {
    faculty: FacultyIdentityMirror;
    rule: IdentitySignal;
    duplicateCandidateIds: number[];
    assignmentBearingCandidateIds: number[];
    candidates: Array<{
        id: number;
        externalId: number;
        employeeId: string | null;
        signals: IdentitySignal[];
        assignmentCount: number;
        subjectRowCount: number;
        isStale: boolean;
        isActiveForScheduling: boolean;
    }>;
};
export type CanonicalFacultyResolutionInput = {
    schoolId: number;
    schoolYearId?: number;
    accountId?: number | null;
    linkedFacultyId?: number | null;
    sourceExternalId?: number | null;
    tokenUserId?: number | null;
    employeeId?: string | null;
    email?: string | null;
    accountName?: string | null;
};
export declare function resolveCanonicalFacultyMirror(input: CanonicalFacultyResolutionInput): Promise<CanonicalFacultyResolution | null>;
export declare function resolveCanonicalFacultyFromAuthPayload(user: AuthPayload | undefined, params: {
    schoolId: number;
    schoolYearId?: number;
}): Promise<CanonicalFacultyResolution | null>;
export {};
