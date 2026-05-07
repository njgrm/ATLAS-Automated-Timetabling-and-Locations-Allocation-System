export type LocalAuthUser = {
    userId: number;
    role: string;
    mustChangePassword: boolean;
    authSource: 'local';
    schoolId: number;
    accountId: number;
    email: string;
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
export declare function loginWithEmailPassword(params: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent?: string;
}): Promise<LocalLoginResult>;
export declare function seedLocalAuthAccounts(params: {
    schoolId: number;
    facultyId: number | null;
}): Promise<{
    created: number;
    updated: number;
}>;
