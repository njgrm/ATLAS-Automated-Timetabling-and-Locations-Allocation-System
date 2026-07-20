export type LocalAuthUser = {
    userId: number;
    role: string;
    mustChangePassword: boolean;
    authSource: 'local';
    schoolId: number;
    accountId: number;
    facultyId?: number | null;
    email: string;
    employeeId?: string | null;
    accountName?: string | null;
};
export type LocalLoginResult = {
    ok: true;
    token: string;
    user: LocalAuthUser;
} | {
    ok: false;
    status: number;
    code: string;
    message: string;
    retryAfterSeconds?: number;
};
type EnrollProFacultyFeedRow = {
    teacherId: number;
    employeeId?: string | null;
    firstName: string;
    lastName: string;
    email?: string | null;
    contactNumber?: string | null;
    department?: string | null;
    departmentCode?: string | null;
    departmentName?: string | null;
    specialization?: string | null;
    isActive?: boolean;
};
export declare function selectExactEnrollProFacultyMatch(rows: EnrollProFacultyFeedRow[], identity: {
    employeeId: string | null;
    email: string;
}): EnrollProFacultyFeedRow | null;
export declare function login(params: {
    identifier: string;
    password: string;
    ipAddress: string;
    userAgent?: string;
}): Promise<LocalLoginResult>;
export declare function loginWithEmailPassword(params: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent?: string;
}): Promise<LocalLoginResult>;
export declare function seedLocalAuthAccounts(params: {
    schoolId: number;
}): Promise<{
    created: number;
    updated: number;
}>;
export type FacultySeedIdentity = {
    id: number;
    externalId: number;
    firstName: string;
    lastName: string;
    contactInfo?: string | null;
};
export declare function buildFacultySeedAccounts(facultyRows: FacultySeedIdentity[]): Array<{
    email: string;
    role: 'faculty';
    facultyId: number;
    mustChangePassword: true;
}>;
export {};
