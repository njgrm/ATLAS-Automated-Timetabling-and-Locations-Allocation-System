/**
 * Active term adapter service.
 * Fetches the active term from EnrollPro's integration endpoint.
 * Resolves the active identity against an ordered term contract without a
 * hardcoded three-term ceiling.
 */

export type ActiveTermSource = 'enrollpro-verified' | 'enrollpro-unresolved' | 'enrollpro-unreachable' | 'enrollpro-contract-drift' | 'atlas-unverified';

/**
 * Extract a typed EnrollPro error code from a JSON error envelope without
 * changing the caller-facing contract vocabulary.
 */
function extractActiveTermErrorCode(body: unknown): string | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const record = body as Record<string, unknown>;
	const direct = typeof record.code === 'string' && record.code.trim().length > 0 ? record.code.trim() : null;
	if (direct) return direct.toUpperCase();
	const errorField = record.error;
	if (typeof errorField === 'string' && errorField.trim().length > 0) return errorField.trim().toUpperCase();
	if (errorField && typeof errorField === 'object' && !Array.isArray(errorField)) {
		const nested = (errorField as Record<string, unknown>).code;
		if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim().toUpperCase();
	}
	return null;
}

function extractActiveTermErrorMessage(body: unknown): string | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const record = body as Record<string, unknown>;
	if (typeof record.message === 'string' && record.message.trim().length > 0) return record.message.trim();
	const errorField = record.error;
	if (errorField && typeof errorField === 'object' && !Array.isArray(errorField)) {
		const nested = (errorField as Record<string, unknown>).message;
		if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim();
	}
	return null;
}

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
	/** Exact ordered labels from the persisted verified EnrollPro contract (DEMAND-C01R2). */
	orderedTerms?: Array<{ identity: string; displayLabel: string; order: number }>;
	termFormat?: 'TRIMESTER' | 'QUARTERS' | null;
	termCount?: number | null;
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
			let body: unknown = null;
			try {
				body = await res.json();
			} catch {
				body = null;
			}
			const code = extractActiveTermErrorCode(body);
			const upstreamMessage = extractActiveTermErrorMessage(body);

			// DASH-RESILIENCE-C01 — a reachable, typed non-2xx is a contract
			// result, not a network outage. HTTP 409 `ACTIVE_TERM_UNRESOLVED` is
			// the valid "no term contains today" state and must stay reachable.
			if (res.status === 409) {
				if (code === 'ACTIVE_TERM_UNRESOLVED') {
					return {
						source: 'enrollpro-unresolved',
						reachable: true,
						verified: false,
						activeTerm: null,
						termIndex: null,
						schoolYearId: null,
						matchedSchoolYear: null,
						code: 'ACTIVE_TERM_UNRESOLVED',
						message: upstreamMessage ?? 'EnrollPro has no term containing the current date.',
					};
				}
				return {
					source: 'enrollpro-contract-drift',
					reachable: true,
					verified: false,
					activeTerm: null,
					termIndex: null,
					schoolYearId: null,
					matchedSchoolYear: null,
					code: code ?? 'ACTIVE_TERM_CONFLICT',
					message: upstreamMessage ?? `EnrollPro active-term endpoint returned HTTP 409${code ? ` (${code})` : ''}.`,
				};
			}

			// Other non-2xx statuses are source failures; preserve the typed
			// upstream code when one is supplied.
			return {
				source: 'enrollpro-unreachable',
				reachable: false,
				verified: false,
				activeTerm: null,
				termIndex: null,
				schoolYearId: null,
				matchedSchoolYear: null,
				code,
				message: `EnrollPro active-term endpoint returned ${res.status}${code ? ` (${code})` : ''}.`,
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
