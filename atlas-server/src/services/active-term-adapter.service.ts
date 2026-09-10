/**
 * Active term adapter service.
 * Fetches the active term from EnrollPro's integration endpoint.
 * Resolves the active identity against an ordered term contract without a
 * hardcoded three-term ceiling.
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

export function normalizeTermIndex(rawTerm: string | null | undefined, orderedTermIdentities?: string[]): { termIndex: number | null; normalizedTerm: string | null } {
	if (!rawTerm || typeof rawTerm !== 'string') {
		return { termIndex: null, normalizedTerm: null };
	}
	const trimmed = rawTerm.trim().toUpperCase();
	const ordered = orderedTermIdentities?.map((identity) => identity.trim().toUpperCase()) ?? [];
	if (ordered.length > 0) {
		const orderedIndex = ordered.indexOf(trimmed);
		return { termIndex: orderedIndex >= 0 ? orderedIndex + 1 : null, normalizedTerm: trimmed };
	}
	const match = trimmed.match(/^T([1-9]\d*)$/);
	if (match) return { termIndex: Number(match[1]), normalizedTerm: trimmed };
	return { termIndex: null, normalizedTerm: trimmed };
}

/**
 * Fetch the active term from EnrollPro's integration endpoint.
 * Returns normalized term data, or null if the call fails.
 */
export async function fetchEnrollProActiveTerm(
	authToken?: string,
	schoolYearId?: number,
	orderedTermIdentities?: string[],
): Promise<ActiveTermResult> {
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

		const body = await res.json() as {
			data?: {
				activeTerm?: string;
				schoolYearId?: number;
			};
		};

		const activeTermRaw = body.data?.activeTerm;
		const upstreamSchoolYearId = body.data?.schoolYearId;

		const { termIndex, normalizedTerm } = normalizeTermIndex(activeTermRaw, orderedTermIdentities);

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
				message: `EnrollPro returned activeTerm ${activeTermRaw ?? 'null'} outside the ordered term contract.`,
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

		if (matchedSchoolYear === false) {
			return {
				source: 'enrollpro-contract-drift', reachable: true, verified: false,
				activeTerm: normalizedTerm, termIndex: null, schoolYearId: upstreamSchoolYearId,
				matchedSchoolYear: false, code: 'ACTIVE_TERM_YEAR_MISMATCH',
				message: `EnrollPro active term ${normalizedTerm} is from a different school year (expected ${schoolYearId}, got ${upstreamSchoolYearId}).`,
			};
		}

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
	} catch {
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
