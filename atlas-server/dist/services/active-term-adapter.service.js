/**
 * Active term adapter service.
 * Fetches the active term from EnrollPro's integration endpoint.
 * Normalizes T1/T2/T3 to termIndex 1/2/3.
 */
const TERM_MAP = {
    T1: 1,
    T2: 2,
    T3: 3,
};
function normalizeTermIndex(rawTerm) {
    if (!rawTerm || typeof rawTerm !== 'string') {
        return { termIndex: null, normalizedTerm: null };
    }
    const trimmed = rawTerm.trim().toUpperCase();
    const mapped = TERM_MAP[trimmed];
    if (mapped !== undefined) {
        return { termIndex: mapped, normalizedTerm: trimmed };
    }
    return { termIndex: null, normalizedTerm: trimmed };
}
/**
 * Fetch the active term from EnrollPro's integration endpoint.
 * Returns normalized term data, or null if the call fails.
 */
export async function fetchEnrollProActiveTerm(authToken, schoolYearId) {
    const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';
    const token = authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
    if (!token) {
        return {
            source: 'enrollpro-unreachable',
            reachable: false,
            verified: false,
            activeTerm: null,
            termIndex: null,
            schoolYearId: null,
            matchedSchoolYear: null,
            code: null,
            message: 'No integration key available for EnrollPro active-term verification.',
        };
    }
    try {
        const res = await fetch(`${baseUrl}/integration/v1/active-term`, {
            signal: AbortSignal.timeout(4000),
            headers: {
                'X-Integration-Key': token,
            },
        });
        if (!res.ok) {
            return {
                source: 'enrollpro-unreachable',
                reachable: false,
                verified: false,
                activeTerm: null,
                termIndex: null,
                schoolYearId: null,
                matchedSchoolYear: null,
                code: null,
                message: `EnrollPro active-term endpoint returned ${res.status}.`,
            };
        }
        const body = await res.json();
        const activeTermRaw = body.data?.activeTerm;
        const upstreamSchoolYearId = body.data?.schoolYearId;
        const { termIndex, normalizedTerm } = normalizeTermIndex(activeTermRaw);
        // Contract drift: invalid activeTerm value
        if (!normalizedTerm || termIndex === null) {
            return {
                source: 'enrollpro-contract-drift',
                reachable: true,
                verified: false,
                activeTerm: activeTermRaw ?? null,
                termIndex: null,
                schoolYearId: upstreamSchoolYearId ?? null,
                matchedSchoolYear: null,
                code: 'ACTIVE_TERM_CONTRACT_DRIFT',
                message: `EnrollPro returned invalid activeTerm ${activeTermRaw ?? 'null'}. Expected T1, T2, or T3.`,
            };
        }
        // Contract drift: missing or non-numeric schoolYearId
        if (upstreamSchoolYearId === undefined || upstreamSchoolYearId === null || typeof upstreamSchoolYearId !== 'number') {
            return {
                source: 'enrollpro-contract-drift',
                reachable: true,
                verified: false,
                activeTerm: normalizedTerm,
                termIndex,
                schoolYearId: null,
                matchedSchoolYear: null,
                code: 'ACTIVE_TERM_CONTRACT_DRIFT',
                message: `EnrollPro active term ${normalizedTerm} returned without a valid schoolYearId.`,
            };
        }
        const matchedSchoolYear = schoolYearId !== undefined
            ? schoolYearId === upstreamSchoolYearId
            : null;
        return {
            source: 'enrollpro-verified',
            reachable: true,
            verified: true,
            activeTerm: normalizedTerm,
            termIndex,
            schoolYearId: upstreamSchoolYearId,
            matchedSchoolYear,
            code: null,
            message: matchedSchoolYear === true
                ? `ATLAS is aligned with EnrollPro active term ${normalizedTerm}.`
                : matchedSchoolYear === false
                    ? `EnrollPro active term ${normalizedTerm} is from a different school year (expected ${schoolYearId}, got ${upstreamSchoolYearId}).`
                    : `EnrollPro active term ${normalizedTerm} verified.`,
        };
    }
    catch {
        return {
            source: 'enrollpro-unreachable',
            reachable: false,
            verified: false,
            activeTerm: null,
            termIndex: null,
            schoolYearId: null,
            matchedSchoolYear: null,
            code: null,
            message: 'EnrollPro active-term endpoint is unreachable.',
        };
    }
}
//# sourceMappingURL=active-term-adapter.service.js.map