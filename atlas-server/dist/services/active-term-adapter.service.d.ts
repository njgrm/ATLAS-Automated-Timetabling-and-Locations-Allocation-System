/**
 * Active term adapter service.
 * Fetches the active term from EnrollPro's integration endpoint.
 * Normalizes T1/T2/T3 to termIndex 1/2/3.
 */
export type ActiveTermSource = 'enrollpro-verified' | 'enrollpro-unreachable' | 'enrollpro-contract-drift' | 'atlas-unverified';
export type ActiveTermResult = {
    source: ActiveTermSource;
    reachable: boolean;
    verified: boolean;
    activeTerm: string | null;
    termIndex: number | null;
    schoolYearId: number | null;
    matchedSchoolYear: boolean | null;
    code: string | null;
    message: string;
};
/**
 * Fetch the active term from EnrollPro's integration endpoint.
 * Returns normalized term data, or null if the call fails.
 */
export declare function fetchEnrollProActiveTerm(authToken?: string, schoolYearId?: number): Promise<ActiveTermResult>;
