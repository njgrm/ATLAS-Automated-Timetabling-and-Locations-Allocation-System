import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';

/**
 * TERM-CONSUME-C02: the ordered term structure and the current active-term
 * resolution are SEPARATE authority results.
 *
 * - The ordered structure (school, year, format, exact ordered terms) is the
 *   required authority. It is verified from `/integration/v1/school-year`.
 * - The current active term is a separate result that may be `RESOLVED`,
 *   `UNRESOLVED` (reachable 409 `ACTIVE_TERM_UNRESOLVED`), `UNAVAILABLE`
 *   (non-200 / network), or `CONTRACT_INVALID` (a typed 409 conflict).
 *
 * A reachable "no current term" state must never invalidate the ordered
 * structure. Passive reads never persist; only the explicit rollover/sync
 * write path calls {@link syncActiveTermContractAuthority}.
 */

export type EnrollProTermFormat = 'TRIMESTER' | 'QUARTERS';

export type VerifiedTerm = {
	identity: string;
	displayLabel: string;
	order: number;
	startDate: string | null;
	endDate: string | null;
};

export type VerifiedTermStructure = {
	schoolId: number;
	schoolYear: { id: number; yearLabel: string };
	format: EnrollProTermFormat;
	terms: VerifiedTerm[];
	semanticRevision: string;
};

export type ResolvedActiveTerm = {
	identity: string;
	displayLabel: string;
	order: number;
};

export type ActiveTermAvailability = 'RESOLVED' | 'UNRESOLVED' | 'UNAVAILABLE' | 'CONTRACT_INVALID';

export type ActiveTermState = {
	availability: ActiveTermAvailability;
	code: string | null;
	message: string;
	reachable: boolean;
	identity: string | null;
};

export type VerifiedTermContract = VerifiedTermStructure & {
	activeTerm: ResolvedActiveTerm | null;
	activeTermState: ActiveTermState;
};

export type TermContractError = { code: string; message: string };
export type TermContractFetchResult =
	| { ok: true; contract: VerifiedTermContract }
	| { ok: false; error: TermContractError };

export type CachedTermContractRecord = {
	contract: VerifiedTermContract;
	cachedAt: string;
};

export type TermContractResolution = {
	state: 'VERIFIED_LIVE' | 'VERIFIED_CACHED' | 'BLOCKED';
	source: 'enrollpro' | 'atlas-cache' | 'none';
	degraded: boolean;
	code: string | null;
	message: string;
	contract: VerifiedTermContract | null;
	verifiedAt?: string;
};

export type TermContractSyncResult = {
	state: 'VERIFIED_LIVE' | 'BLOCKED';
	code: string | null;
	message: string;
	written: boolean;
	idempotent: boolean;
	semanticRevision: string | null;
	contract: VerifiedTermContract | null;
	verifiedAt?: string;
};

type FetchInput = {
	baseUrl?: string;
	authToken?: string;
	schoolId: number;
	schoolYearId: number;
	/**
	 * Optional already-fetched `/integration/v1/school-year` payload. When
	 * supplied, the caller reuses one upstream read instead of refetching the
	 * same school-year document (keeps rollover-status call volume stable).
	 */
	schoolYearPayload?: unknown;
};

type ResolutionDependencies = {
	fetchLive: () => Promise<TermContractFetchResult>;
	loadCache: () => Promise<CachedTermContractRecord | null>;
	now?: () => Date;
};

type SyncInput = {
	schoolId: number;
	schoolYearId: number;
	authToken?: string;
	fetchLive?: () => Promise<TermContractFetchResult>;
	now?: () => Date;
};

type JsonFetchOutcome =
	| { kind: 'body'; status: number; body: unknown }
	| { kind: 'http-error'; status: number; body: unknown }
	| { kind: 'unreachable' };

const FORMAT_TERM_COUNT: Record<EnrollProTermFormat, number> = {
	TRIMESTER: 3,
	QUARTERS: 4,
};

function fail(code: string, message: string): { ok: false; error: TermContractError } {
	return { ok: false, error: { code, message } };
}

function positiveInteger(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function suppliedDisplayLabel(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function suppliedIdentity(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function canonicalComparisonKey(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

function normalizeDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
	if (value === undefined || value === null || value === '') return { ok: true, value: null };
	if (typeof value !== 'string' && !(value instanceof Date)) return { ok: false };
	const parsed = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(parsed.getTime())) return { ok: false };
	return { ok: true, value: parsed.toISOString().slice(0, 10) };
}

/**
 * The semantic revision binds ONLY the ordered structure (school, year, format,
 * exact ordered terms). Active-term resolution is intentionally excluded: a
 * reachable `ACTIVE_TERM_UNRESOLVED` state shares the revision of a resolved
 * structure over the same terms, so cache identity stays stable and replay is
 * idempotent.
 */
function semanticRevisionFor(structure: Omit<VerifiedTermStructure, 'semanticRevision'>): string {
	return createHash('sha256').update(JSON.stringify(structure)).digest('hex');
}

function buildFlatTerms(data: Record<string, unknown>, format: EnrollProTermFormat): { ok: false; error: TermContractError } | VerifiedTerm[] {
	const count = FORMAT_TERM_COUNT[format];
	const terms: VerifiedTerm[] = [];
	for (let index = 1; index <= count; index += 1) {
		const identity = suppliedIdentity(data[`term${index}Identity`]);
		const displayLabel = suppliedDisplayLabel(data[`term${index}Label`]);
		if (!identity || !displayLabel) {
			return fail('TERM_ENTRY_INVALID', `EnrollPro term ${index} must supply an identity and display label.`);
		}
		const startDate = normalizeDate(data[`term${index}Start`]);
		const endDate = normalizeDate(data[`term${index}End`]);
		if (!startDate.ok || !endDate.ok) {
			return fail('TERM_DATE_INVALID', `EnrollPro returned an invalid date for ${identity}.`);
		}
		if (startDate.value && endDate.value && startDate.value > endDate.value) {
			return fail('TERM_DATE_RANGE_INVALID', `EnrollPro returned an end date before the start date for ${identity}.`);
		}
		terms.push({ identity, displayLabel, order: index, startDate: startDate.value, endDate: endDate.value });
	}
	return terms;
}

function buildExplicitTerms(rawTerms: unknown[], format: EnrollProTermFormat): { ok: false; error: TermContractError } | VerifiedTerm[] {
	const expectedCount = FORMAT_TERM_COUNT[format];
	if (rawTerms.length !== expectedCount) {
		return fail('TERM_COUNT_MISMATCH', `EnrollPro ${format} must provide exactly ${expectedCount} ordered terms.`);
	}
	const terms: VerifiedTerm[] = [];
	for (let index = 0; index < rawTerms.length; index += 1) {
		const raw = rawTerms[index];
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return fail('TERM_ENTRY_INVALID', `EnrollPro term ${index + 1} is not an object.`);
		}
		const item = raw as Record<string, unknown>;
		const identity = suppliedIdentity(item.identity ?? item.id);
		const displayLabel = suppliedDisplayLabel(item.displayLabel ?? item.label);
		const suppliedOrder = item.order === undefined ? index + 1 : positiveInteger(item.order);
		if (!identity || !displayLabel || suppliedOrder !== index + 1) {
			return fail('TERM_ENTRY_INVALID', `EnrollPro term ${index + 1} must have an identity, display label, and matching order.`);
		}
		const startDate = normalizeDate(item.startDate);
		const endDate = normalizeDate(item.endDate);
		if (!startDate.ok || !endDate.ok) return fail('TERM_DATE_INVALID', `EnrollPro returned an invalid date for ${identity}.`);
		if (startDate.value && endDate.value && startDate.value > endDate.value) {
			return fail('TERM_DATE_RANGE_INVALID', `EnrollPro returned an end date before the start date for ${identity}.`);
		}
		terms.push({ identity, displayLabel, order: index + 1, startDate: startDate.value, endDate: endDate.value });
	}
	return terms;
}

/**
 * Verify the authoritative ordered term structure from EnrollPro's
 * `/integration/v1/school-year` payload. This does NOT consult the active-term
 * endpoint and therefore never fails merely because no term contains today.
 */
export function normalizeEnrollProTermStructure(input: {
	schoolId: number;
	schoolYearId: number;
	schoolYearPayload: unknown;
}): { ok: true; structure: VerifiedTermStructure } | { ok: false; error: TermContractError } {
	const schoolYearEnvelope = input.schoolYearPayload as { data?: unknown } | null;
	if (!schoolYearEnvelope?.data || typeof schoolYearEnvelope.data !== 'object' || Array.isArray(schoolYearEnvelope.data)) {
		return fail('SCHOOL_YEAR_CONTRACT_INVALID', 'EnrollPro school-year response is missing its data object.');
	}
	const schoolYear = schoolYearEnvelope.data as Record<string, unknown>;
	const upstreamYearId = positiveInteger(schoolYear.id ?? schoolYear.schoolYearId);
	const yearLabel = nonEmptyString(schoolYear.yearLabel);
	if (!upstreamYearId || !yearLabel) {
		return fail('SCHOOL_YEAR_CONTRACT_INVALID', 'EnrollPro school-year response must include a positive id and yearLabel.');
	}
	if (upstreamYearId !== input.schoolYearId) {
		return fail('SCHOOL_YEAR_MISMATCH', `EnrollPro returned school year ${upstreamYearId}; ATLAS requested ${input.schoolYearId}.`);
	}
	if (schoolYear.schoolId !== undefined && positiveInteger(schoolYear.schoolId) !== input.schoolId) {
		return fail('SCHOOL_ID_MISMATCH', `EnrollPro returned a school identity that does not match ATLAS school ${input.schoolId}.`);
	}
	const normalizedFormat = canonicalComparisonKey(schoolYear.termFormat);
	if (normalizedFormat !== 'TRIMESTER' && normalizedFormat !== 'QUARTERS') {
		return fail('TERM_FORMAT_UNSUPPORTED', `EnrollPro returned unsupported term format ${String(schoolYear.termFormat ?? 'missing')}.`);
	}
	const builtTerms = Array.isArray(schoolYear.terms)
		? buildExplicitTerms(schoolYear.terms, normalizedFormat)
		: buildFlatTerms(schoolYear, normalizedFormat);
	if (!Array.isArray(builtTerms)) return builtTerms;
	const identityKeys = builtTerms.map((term) => canonicalComparisonKey(term.identity));
	if (new Set(identityKeys).size !== identityKeys.length) {
		return fail('TERM_IDENTITIES_DUPLICATE', 'EnrollPro returned duplicate term identities.');
	}
	const semantic: Omit<VerifiedTermStructure, 'semanticRevision'> = {
		schoolId: input.schoolId,
		schoolYear: { id: upstreamYearId, yearLabel },
		format: normalizedFormat,
		terms: builtTerms,
	};
	return { ok: true, structure: { ...semantic, semanticRevision: semanticRevisionFor(semantic) } };
}

function extractActiveTermCode(body: unknown): string | null {
	if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
	const record = body as Record<string, unknown>;
	const direct = nonEmptyString(record.code);
	if (direct) return direct.toUpperCase();
	const errorField = record.error;
	if (typeof errorField === 'string' && errorField.trim().length > 0) return errorField.trim().toUpperCase();
	if (errorField && typeof errorField === 'object' && !Array.isArray(errorField)) {
		const nested = nonEmptyString((errorField as Record<string, unknown>).code);
		if (nested) return nested.toUpperCase();
	}
	return null;
}

function resolveActiveTermState(
	structure: VerifiedTermStructure,
	response: JsonFetchOutcome,
): { ok: true; activeTerm: ResolvedActiveTerm | null; state: ActiveTermState } | { ok: false; error: TermContractError } {
	if (response.kind === 'body') {
		const activeTermEnvelope = response.body as { data?: unknown } | null;
		if (!activeTermEnvelope?.data || typeof activeTermEnvelope.data !== 'object' || Array.isArray(activeTermEnvelope.data)) {
			return fail('ACTIVE_TERM_CONTRACT_INVALID', 'EnrollPro active-term response is missing its data object.');
		}
		const payload = activeTermEnvelope.data as Record<string, unknown>;
		if (payload.schoolId !== undefined && positiveInteger(payload.schoolId) !== structure.schoolId) {
			return fail('SCHOOL_ID_MISMATCH', `EnrollPro active-term school identity does not match ATLAS school ${structure.schoolId}.`);
		}
		const activeYearId = positiveInteger(payload.schoolYearId);
		if (!activeYearId || activeYearId !== structure.schoolYear.id) {
			return fail('ACTIVE_TERM_YEAR_MISMATCH', `EnrollPro active-term year ${String(payload.schoolYearId ?? 'missing')} does not match school year ${structure.schoolYear.id}.`);
		}
		const suppliedIdentity = payload.activeTerm ?? payload.termIdentity;
		const activeIdentityKey = canonicalComparisonKey(suppliedIdentity);
		const structureKeys = structure.terms.map((term) => canonicalComparisonKey(term.identity));
		const activeTermIndex = activeIdentityKey ? structureKeys.indexOf(activeIdentityKey) : -1;
		if (activeTermIndex < 0) {
			return fail('ACTIVE_TERM_OUTSIDE_CONTRACT', `EnrollPro active term ${String(suppliedIdentity ?? 'missing')} is outside the ordered term contract.`);
		}
		const resolved = structure.terms[activeTermIndex];
		return {
			ok: true,
			activeTerm: { identity: resolved.identity, displayLabel: resolved.displayLabel, order: resolved.order },
			state: {
				availability: 'RESOLVED',
				code: null,
				message: `EnrollPro active term ${resolved.identity} resolved within the verified ordered structure.`,
				reachable: true,
				identity: resolved.identity,
			},
		};
	}
	if (response.kind === 'http-error' && response.status === 409) {
		const code = extractActiveTermCode(response.body);
		if (code === 'ACTIVE_TERM_UNRESOLVED') {
			return {
				ok: true,
				activeTerm: null,
				state: {
					availability: 'UNRESOLVED',
					code: 'ACTIVE_TERM_UNRESOLVED',
					message: 'EnrollPro has no term containing the current date; the ordered term structure was verified independently.',
					reachable: true,
					identity: null,
				},
			};
		}
		return {
			ok: true,
			activeTerm: null,
			state: {
				availability: 'CONTRACT_INVALID',
				code: code ?? 'ACTIVE_TERM_CONFLICT',
				message: `EnrollPro active-term authority returned HTTP 409${code ? ` (${code})` : ''} outside the ordered contract.`,
				reachable: true,
				identity: null,
			},
		};
	}
	if (response.kind === 'http-error') {
		return {
			ok: true,
			activeTerm: null,
			state: {
				availability: 'UNAVAILABLE',
				code: 'ENROLLPRO_ACTIVE_TERM_UNAVAILABLE',
				message: `EnrollPro active-term authority returned ${response.status}; the ordered term structure was verified independently.`,
				reachable: true,
				identity: null,
			},
		};
	}
	return {
		ok: true,
		activeTerm: null,
		state: {
			availability: 'UNAVAILABLE',
			code: 'ENROLLPRO_ACTIVE_TERM_UNREACHABLE',
			message: 'EnrollPro active-term authority is unreachable; the ordered term structure was verified independently.',
			reachable: false,
			identity: null,
		},
	};
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<JsonFetchOutcome> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(4000), headers });
		let body: unknown = null;
		try {
			body = await response.json();
		} catch {
			body = null;
		}
		if (response.ok) return { kind: 'body', status: response.status, body };
		return { kind: 'http-error', status: response.status, body };
	} catch {
		return { kind: 'unreachable' };
	}
}

/**
 * Fetch and verify the EnrollPro term authority. The ordered structure is
 * required; a reachable 409 `ACTIVE_TERM_UNRESOLVED` is a valid structure with
 * `activeTerm: null`. Only a contradictory active-term identity (HTTP 200 that
 * names an identity outside the structure, or a mismatched school/year) is
 * rejected as a full contract failure.
 */
export async function fetchEnrollProTermContract(input: FetchInput): Promise<TermContractFetchResult> {
	const baseUrl = (input.baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
	const token = input.authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
	if (!token) return fail('ENROLLPRO_UNREACHABLE', 'No EnrollPro integration credential is configured.');
	const schoolYear: JsonFetchOutcome = input.schoolYearPayload !== undefined
		? { kind: 'body', status: 200, body: input.schoolYearPayload }
		: await fetchJson(`${baseUrl}/integration/v1/school-year`, { Authorization: `Bearer ${token}` });
	const activeTerm = await fetchJson(`${baseUrl}/integration/v1/active-term`, { 'X-Integration-Key': token });
	if (schoolYear.kind === 'unreachable') {
		return fail('ENROLLPRO_UNREACHABLE', 'EnrollPro school-year authority is unreachable.');
	}
	if (schoolYear.kind !== 'body') {
		return fail('ENROLLPRO_SCHOOL_YEAR_UNAVAILABLE', `EnrollPro school-year authority returned ${schoolYear.status}.`);
	}
	const structureResult = normalizeEnrollProTermStructure({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		schoolYearPayload: schoolYear.body,
	});
	if (!structureResult.ok) return structureResult;
	const activeResult = resolveActiveTermState(structureResult.structure, activeTerm);
	if (!activeResult.ok) return activeResult;
	return {
		ok: true,
		contract: {
			...structureResult.structure,
			activeTerm: activeResult.activeTerm,
			activeTermState: activeResult.state,
		},
	};
}

/**
 * Structural validation for a persisted (JSONB round-tripped) contract. The
 * order-sensitive `semanticRevisionFor` hash intentionally cannot round-trip
 * through PostgreSQL JSONB (see derived-demand `normalizePersistedTermStructure`),
 * so a persisted cache read trusts the stored `semanticRevision` as an opaque
 * revision token and compares it against a freshly fetched live revision.
 * Structural shape is still enforced fail-closed.
 */
export function validatePersistedContractStructure(contract: VerifiedTermContract, schoolId: number, schoolYearId: number): TermContractError | null {
	if (!contract || typeof contract !== 'object') {
		return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract is not a valid object.' };
	}
	if (contract.schoolId !== schoolId) return { code: 'TERM_CACHE_SCHOOL_MISMATCH', message: 'Saved term contract belongs to another school.' };
	if (contract.schoolYear?.id !== schoolYearId) return { code: 'TERM_CACHE_YEAR_MISMATCH', message: 'Saved term contract belongs to another school year.' };
	if (contract.format !== 'TRIMESTER' && contract.format !== 'QUARTERS') return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an unsupported format.' };
	if (!Array.isArray(contract.terms) || contract.terms.length !== FORMAT_TERM_COUNT[contract.format]) return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an invalid term count.' };
	if (typeof contract.semanticRevision !== 'string' || contract.semanticRevision.length === 0) return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract is missing its semantic revision.' };
	const seen = new Set<string>();
	for (let index = 0; index < contract.terms.length; index += 1) {
		const term = contract.terms[index];
		const identityKey = canonicalComparisonKey(term?.identity);
		if (!term || !identityKey || term.order !== index + 1 || seen.has(identityKey)) {
			return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has malformed, duplicate, or out-of-order terms.' };
		}
		seen.add(identityKey);
	}
	return null;
}

export function validateCachedContract(contract: VerifiedTermContract, schoolId: number, schoolYearId: number): TermContractError | null {
	if (!contract || typeof contract !== 'object') {
		return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract is not a valid object.' };
	}
	if (contract.schoolId !== schoolId) return { code: 'TERM_CACHE_SCHOOL_MISMATCH', message: 'Saved term contract belongs to another school.' };
	if (contract.schoolYear?.id !== schoolYearId) return { code: 'TERM_CACHE_YEAR_MISMATCH', message: 'Saved term contract belongs to another school year.' };
	if (contract.format !== 'TRIMESTER' && contract.format !== 'QUARTERS') return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an unsupported format.' };
	if (!Array.isArray(contract.terms) || contract.terms.length !== FORMAT_TERM_COUNT[contract.format]) return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an invalid term count.' };
	const seen = new Set<string>();
	for (let index = 0; index < contract.terms.length; index += 1) {
		const term = contract.terms[index];
		const identityKey = canonicalComparisonKey(term?.identity);
		if (!term || !identityKey || term.order !== index + 1 || seen.has(identityKey)) {
			return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has malformed, duplicate, or out-of-order terms.' };
		}
		seen.add(identityKey);
	}
	const structure: Omit<VerifiedTermStructure, 'semanticRevision'> = {
		schoolId: contract.schoolId,
		schoolYear: contract.schoolYear,
		format: contract.format,
		terms: contract.terms,
	};
	if (semanticRevisionFor(structure) !== contract.semanticRevision) {
		return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract failed its semantic revision check.' };
	}
	return null;
}

/**
 * Passive resolution. It performs NO persistence: a verified live structure is
 * returned as-is, and a valid exact-school/year cache is used only as a
 * degraded read when EnrollPro is unreachable. Cache writes belong exclusively
 * to {@link syncActiveTermContractAuthority}.
 */
export async function resolveTermContractWithDependencies(
	input: { schoolId: number; schoolYearId: number; authToken?: string },
	dependencies: ResolutionDependencies,
): Promise<TermContractResolution> {
	const verifiedAt = (dependencies.now?.() ?? new Date()).toISOString();
	const live = await dependencies.fetchLive();
	if (live.ok) {
		return {
			state: 'VERIFIED_LIVE',
			source: 'enrollpro',
			degraded: false,
			code: live.contract.activeTermState.code,
			message: 'Term structure verified live from EnrollPro.',
			contract: live.contract,
			verifiedAt,
		};
	}
	let cached: CachedTermContractRecord | null = null;
	try {
		cached = await dependencies.loadCache();
	} catch {
		return { state: 'BLOCKED', source: 'none', degraded: false, code: 'TERM_CACHE_READ_FAILED', message: 'ATLAS could not read the saved term contract.', contract: null };
	}
	if (!cached) {
		return { state: 'BLOCKED', source: 'none', degraded: false, code: live.error.code, message: `${live.error.message} No matching saved term contract exists.`, contract: null };
	}
	const cacheError = validateCachedContract(cached.contract, input.schoolId, input.schoolYearId);
	if (cacheError) return { state: 'BLOCKED', source: 'none', degraded: false, code: cacheError.code, message: cacheError.message, contract: null };
	return {
		state: 'VERIFIED_CACHED',
		source: 'atlas-cache',
		degraded: true,
		code: live.error.code,
		message: `Using saved term contract from ${cached.cachedAt}; EnrollPro verification is unavailable.`,
		contract: {
			...cached.contract,
			activeTerm: null,
			activeTermState: {
				availability: 'UNAVAILABLE',
				code: live.error.code,
				message: 'The current active term could not be verified; only the exact saved ordered structure is shown.',
				reachable: false,
				identity: null,
			},
		},
		verifiedAt: cached.cachedAt,
	};
}

export async function resolveEnrollProTermContract(input: { schoolId: number; schoolYearId: number; authToken?: string }): Promise<TermContractResolution> {
	const client = getDataContext<any>();
	const mirror = await client.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId: input.schoolId, enrollProSchoolYearId: input.schoolYearId } },
		select: { id: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
	});
	if (!mirror || mirror.isArchived) {
		return {
			state: 'BLOCKED', source: 'none', degraded: false, code: 'TERM_YEAR_NOT_MIRRORED',
			message: 'The requested school year is not an active ATLAS EnrollPro mirror.', contract: null,
		};
	}
	return resolveTermContractWithDependencies(input, {
		fetchLive: () => fetchEnrollProTermContract(input),
		loadCache: async () => mirror.termContractCache && mirror.termContractCachedAt
			? { contract: mirror.termContractCache as VerifiedTermContract, cachedAt: new Date(mirror.termContractCachedAt).toISOString() }
			: null,
	});
}

/**
 * The ONE explicit writer of the verified term-structure cache. Called only by
 * the actor-scoped rollover/synchronization path after the exact active mirror
 * is established. It is idempotent for a stable semantic revision: a replay
 * that resolves the same ordered structure performs zero writes.
 */
export async function syncActiveTermContractAuthority(input: SyncInput): Promise<TermContractSyncResult> {
	const client = getDataContext<any>();
	const mirror = await client.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId: input.schoolId, enrollProSchoolYearId: input.schoolYearId } },
		select: { id: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
	});
	if (!mirror || mirror.isArchived) {
		return { state: 'BLOCKED', code: 'TERM_YEAR_NOT_MIRRORED', message: 'The requested school year is not an active ATLAS EnrollPro mirror.', written: false, idempotent: false, semanticRevision: null, contract: null };
	}
	const now = input.now?.() ?? new Date();
	const live = await (input.fetchLive ?? (() => fetchEnrollProTermContract(input)))();
	if (!live.ok) {
		return { state: 'BLOCKED', code: live.error.code, message: live.error.message, written: false, idempotent: false, semanticRevision: null, contract: null };
	}
	const contract = live.contract;
	const existing = mirror.termContractCache as VerifiedTermContract | null;
	if (existing && mirror.termContractCachedAt && existing.semanticRevision === contract.semanticRevision) {
		return {
			state: 'VERIFIED_LIVE', code: contract.activeTermState.code,
			message: 'Term structure cache already matches the verified semantic revision.',
			written: false, idempotent: true, semanticRevision: contract.semanticRevision, contract,
			verifiedAt: new Date(mirror.termContractCachedAt).toISOString(),
		};
	}
	await client.enrollProSchoolYearMirror.update({
		where: { id: mirror.id },
		data: { termContractCache: contract, termContractCachedAt: now },
	});
	return {
		state: 'VERIFIED_LIVE', code: contract.activeTermState.code,
		message: 'Term structure cache refreshed from verified EnrollPro authority.',
		written: true, idempotent: false, semanticRevision: contract.semanticRevision, contract,
		verifiedAt: now.toISOString(),
	};
}

// ─── RR-TERM-CACHE-C01: truthful persisted term authority + narrow catch-up ───
//
// Year alignment and persisted ordered-term authority are SEPARATE states. An
// aligned active year with no `termContractCache` is still missing the authority
// canonical `buildDerivedDemand()` needs; the rollover card must offer one
// narrow repair path (preview → fingerprinted apply) that writes ONLY the active
// mirror's cache columns plus one scoped audit row. It never reruns faculty,
// section, Teaching Load, generation, or publication flows.

export type TermAuthorityState =
	| 'PERSISTED_CURRENT'
	| 'MISSING'
	| 'PERSISTED_STALE'
	| 'UPSTREAM_UNAVAILABLE'
	| 'INVALID_UPSTREAM_CONTRACT'
	| 'YEAR_NOT_MIRRORED'
	| 'CACHE_INVALID'
	| 'PERSISTED_UNVERIFIED';

export type TermAuthorityRepairAction = 'NONE' | 'PREVIEW_TERM_CACHE_SYNC' | 'RETRY_ENROLLPRO';

export type TermAuthorityStatus = {
	state: TermAuthorityState;
	code: string | null;
	message: string;
	persisted: boolean;
	persistedSemanticRevision: string | null;
	liveSemanticRevision: string | null;
	cachedAt: string | null;
	termCount: number | null;
	needsRepair: boolean;
	repairAction: TermAuthorityRepairAction;
	canPreview: boolean;
};

type TermAuthorityMirrorRow = {
	id: number;
	isArchived: boolean;
	termContractCache: unknown;
	termContractCachedAt: Date | null;
};

export type TermAuthorityResolutionDependencies = {
	loadMirror: () => Promise<TermAuthorityMirrorRow | null>;
	fetchLive: () => Promise<TermContractFetchResult>;
};

function termAuthorityError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

function isUnreachableTermError(code: string): boolean {
	return code === 'ENROLLPRO_UNREACHABLE' || code === 'ENROLLPRO_SCHOOL_YEAR_UNAVAILABLE';
}

function readValidCache(
	row: TermAuthorityMirrorRow | null,
	schoolId: number,
	schoolYearId: number,
): { valid: boolean; contract: VerifiedTermContract | null; cachedAt: string | null } {
	if (!row?.termContractCache || !row.termContractCachedAt) return { valid: false, contract: null, cachedAt: null };
	const contract = row.termContractCache as VerifiedTermContract;
	const cachedAt = new Date(row.termContractCachedAt).toISOString();
	if (validatePersistedContractStructure(contract, schoolId, schoolYearId)) return { valid: false, contract, cachedAt };
	return { valid: true, contract, cachedAt };
}

async function readMirrorRow(schoolId: number, schoolYearId: number): Promise<TermAuthorityMirrorRow | null> {
	const client = getDataContext<any>();
	return client.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: { id: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
	});
}

function yearNotMirrored(message: string): TermAuthorityStatus {
	return {
		state: 'YEAR_NOT_MIRRORED',
		code: 'TERM_YEAR_NOT_MIRRORED',
		message,
		persisted: false,
		persistedSemanticRevision: null,
		liveSemanticRevision: null,
		cachedAt: null,
		termCount: null,
		needsRepair: false,
		repairAction: 'NONE',
		canPreview: false,
	};
}

/**
 * Resolve the persisted ordered-term authority for the ATLAS active year,
 * independently from year drift. `aligned`/`upstreamReachable` describe the
 * already-computed year comparison; this function never modifies year drift and
 * never overloads `recommendedAction`.
 */
export async function resolveTermAuthorityStatus(
	input: { schoolId: number; schoolYearId: number | null; authToken?: string; upstreamReachable: boolean; aligned: boolean },
	dependencies?: Partial<TermAuthorityResolutionDependencies>,
): Promise<TermAuthorityStatus> {
	const yearId = input.schoolYearId;
	if (!Number.isInteger(yearId) || (yearId as number) <= 0) {
		return yearNotMirrored('The school has no active school-year mirror, so its ordered terms cannot be verified yet.');
	}
	const resolvedYearId = yearId as number;
	const mirror = dependencies?.loadMirror
		? await dependencies.loadMirror()
		: await readMirrorRow(input.schoolId, resolvedYearId);
	if (!mirror || mirror.isArchived) {
		return yearNotMirrored('This school year is not an active ATLAS mirror, so it cannot persist ordered term authority.');
	}
	const cache = readValidCache(mirror, input.schoolId, resolvedYearId);
	const cachePresent = mirror.termContractCache != null || mirror.termContractCachedAt != null;
	const persistedRevision = cache.valid ? cache.contract!.semanticRevision : null;
	const termCount = cache.valid ? cache.contract!.terms.length : null;

	if (!input.upstreamReachable) {
		return cache.valid
			? {
				state: 'UPSTREAM_UNAVAILABLE',
				code: 'ENROLLPRO_UNREACHABLE',
				message: 'EnrollPro is unreachable; the saved ordered terms could not be re-verified right now.',
				persisted: true,
				persistedSemanticRevision: persistedRevision,
				liveSemanticRevision: null,
				cachedAt: cache.cachedAt,
				termCount,
				needsRepair: false,
				repairAction: 'NONE',
				canPreview: false,
			}
			: {
				state: 'UPSTREAM_UNAVAILABLE',
				code: 'ENROLLPRO_UNREACHABLE',
				message: 'EnrollPro is unreachable and no ordered terms are saved for this school year yet.',
				persisted: false,
				persistedSemanticRevision: null,
				liveSemanticRevision: null,
				cachedAt: null,
				termCount: null,
				needsRepair: true,
				repairAction: 'RETRY_ENROLLPRO',
				canPreview: false,
			};
	}

	if (!input.aligned) {
		// Year drift is the operative blocker; report persisted truth without
		// claiming a live verification and without overloading the year action.
		return {
			state: 'PERSISTED_UNVERIFIED',
			code: cache.valid ? null : 'TERM_AUTHORITY_MISSING',
			message: cache.valid
				? 'Ordered terms are saved for the currently active ATLAS year; they will be verified once the school year matches EnrollPro.'
				: 'Ordered terms are not saved for the currently active ATLAS year. Resolve the school-year drift first, then save them.',
			persisted: cache.valid,
			persistedSemanticRevision: persistedRevision,
			liveSemanticRevision: null,
			cachedAt: cache.cachedAt,
			termCount,
			needsRepair: false,
			repairAction: 'NONE',
			canPreview: false,
		};
	}

	const live = await (dependencies?.fetchLive
		? dependencies.fetchLive()
		: fetchEnrollProTermContract({ schoolId: input.schoolId, schoolYearId: resolvedYearId, authToken: input.authToken }));
	if (!live.ok) {
		const unreachable = isUnreachableTermError(live.error.code);
		return {
			state: unreachable ? 'UPSTREAM_UNAVAILABLE' : 'INVALID_UPSTREAM_CONTRACT',
			code: live.error.code,
			message: live.error.message,
			persisted: cache.valid,
			persistedSemanticRevision: persistedRevision,
			liveSemanticRevision: null,
			cachedAt: cache.cachedAt,
			termCount,
			needsRepair: !cache.valid,
			repairAction: unreachable ? (cache.valid ? 'NONE' : 'RETRY_ENROLLPRO') : (cache.valid ? 'NONE' : 'PREVIEW_TERM_CACHE_SYNC'),
			canPreview: !unreachable,
		};
	}
	const liveRevision = live.contract.semanticRevision;
	if (cachePresent && !cache.valid) {
		return {
			state: 'CACHE_INVALID',
			code: 'TERM_CACHE_INVALID',
			message: 'The ordered terms saved in ATLAS are malformed and must be saved again from EnrollPro.',
			persisted: false,
			persistedSemanticRevision: cache.contract?.semanticRevision ?? null,
			liveSemanticRevision: liveRevision,
			cachedAt: cache.cachedAt,
			termCount: live.contract.terms.length,
			needsRepair: true,
			repairAction: 'PREVIEW_TERM_CACHE_SYNC',
			canPreview: true,
		};
	}
	if (!cache.valid) {
		return {
			state: 'MISSING',
			code: 'TERM_AUTHORITY_MISSING',
			message: 'The school year is current, but its ordered terms have not been saved in ATLAS yet.',
			persisted: false,
			persistedSemanticRevision: null,
			liveSemanticRevision: liveRevision,
			cachedAt: null,
			termCount: live.contract.terms.length,
			needsRepair: true,
			repairAction: 'PREVIEW_TERM_CACHE_SYNC',
			canPreview: true,
		};
	}
	if (cache.contract!.semanticRevision === liveRevision) {
		return {
			state: 'PERSISTED_CURRENT',
			code: live.contract.activeTermState.code,
			message: 'The saved ordered terms match EnrollPro.',
			persisted: true,
			persistedSemanticRevision: persistedRevision,
			liveSemanticRevision: liveRevision,
			cachedAt: cache.cachedAt,
			termCount,
			needsRepair: false,
			repairAction: 'NONE',
			canPreview: false,
		};
	}
	return {
		state: 'PERSISTED_STALE',
		code: 'TERM_AUTHORITY_STALE',
		message: 'The ordered terms saved in ATLAS no longer match EnrollPro. Save them again before generating.',
		persisted: true,
		persistedSemanticRevision: persistedRevision,
		liveSemanticRevision: liveRevision,
		cachedAt: cache.cachedAt,
		termCount,
		needsRepair: true,
		repairAction: 'PREVIEW_TERM_CACHE_SYNC',
		canPreview: true,
	};
}

const TERM_CACHE_FINGERPRINT_VERSION = 'RR-TERM-CACHE-C01.1';

export function getTermCacheConfirmationText(schoolId: number, schoolYearId: number): string {
	return `SAVE_TERM_AUTHORITY_${schoolId}_${schoolYearId}`;
}

function termCacheFingerprint(input: {
	schoolId: number;
	schoolYearId: number;
	mirrorId: number;
	format: EnrollProTermFormat;
	liveSemanticRevision: string;
	persistedSemanticRevision: string | null;
}): string {
	return createHash('sha256')
		.update(JSON.stringify({ schemaVersion: TERM_CACHE_FINGERPRINT_VERSION, ...input }))
		.digest('hex');
}

type ActiveYearMirrorRow = {
	id: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	termContractCache: unknown;
	termContractCachedAt: Date | null;
};

async function resolveActiveYearMirror(schoolId: number): Promise<ActiveYearMirrorRow> {
	const client = getDataContext<any>();
	const rows = await client.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		select: { id: true, enrollProSchoolYearId: true, yearLabel: true, termContractCache: true, termContractCachedAt: true },
		orderBy: [{ enrollProSchoolYearId: 'asc' }, { id: 'asc' }],
	});
	if (rows.length === 0) {
		throw termAuthorityError(409, 'ACTIVE_YEAR_UNAVAILABLE', 'No active, non-archived school-year mirror exists for this school.');
	}
	if (rows.length > 1) {
		throw termAuthorityError(409, 'ACTIVE_YEAR_AMBIGUOUS', 'More than one active, non-archived school-year mirror exists for this school.');
	}
	return rows[0] as ActiveYearMirrorRow;
}

export type TermCachePreviewResult = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	mirrorId: number;
	state: 'READY' | 'ALREADY_CURRENT';
	code: string | null;
	message: string;
	format: EnrollProTermFormat;
	terms: VerifiedTerm[];
	liveSemanticRevision: string;
	persistedSemanticRevision: string | null;
	cachedAt: string | null;
	activeTermAvailability: ActiveTermAvailability;
	fingerprint: string;
	confirmationText: string;
	zeroWrite: true;
};

/**
 * Zero-write preview of the narrow term-authority catch-up. Fetches and
 * validates the live EnrollPro ordered contract, binds the active mirror's
 * current cache state, and returns a stable fingerprint plus exact confirmation.
 */
export async function previewTermCacheSync(input: {
	schoolId: number;
	authToken?: string;
	fetchLive?: () => Promise<TermContractFetchResult>;
}): Promise<TermCachePreviewResult> {
	if (!Number.isInteger(input.schoolId) || input.schoolId <= 0) {
		throw termAuthorityError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}
	const mirror = await resolveActiveYearMirror(input.schoolId);
	const yearId = mirror.enrollProSchoolYearId;
	const live = await (input.fetchLive
		? input.fetchLive()
		: fetchEnrollProTermContract({ schoolId: input.schoolId, schoolYearId: yearId, authToken: input.authToken }));
	if (!live.ok) {
		throw termAuthorityError(
			isUnreachableTermError(live.error.code) ? 503 : 409,
			live.error.code,
			live.error.message,
		);
	}
	const contract = live.contract;
	const cache = readValidCache(
		{ id: mirror.id, isArchived: false, termContractCache: mirror.termContractCache, termContractCachedAt: mirror.termContractCachedAt },
		input.schoolId,
		yearId,
	);
	const persistedRevision = cache.valid ? cache.contract!.semanticRevision : null;
	const fingerprint = termCacheFingerprint({
		schoolId: input.schoolId,
		schoolYearId: yearId,
		mirrorId: mirror.id,
		format: contract.format,
		liveSemanticRevision: contract.semanticRevision,
		persistedSemanticRevision: persistedRevision,
	});
	const alreadyCurrent = persistedRevision === contract.semanticRevision;
	return {
		schoolId: input.schoolId,
		schoolYearId: yearId,
		yearLabel: mirror.yearLabel,
		mirrorId: mirror.id,
		state: alreadyCurrent ? 'ALREADY_CURRENT' : 'READY',
		code: contract.activeTermState.code,
		message: alreadyCurrent
			? 'The saved ordered terms already match EnrollPro; no write is required.'
			: 'Saving stores only this school year\u2019s ordered term authority. It does not sync faculty, sections, or Teaching Load.',
		format: contract.format,
		terms: contract.terms,
		liveSemanticRevision: contract.semanticRevision,
		persistedSemanticRevision: persistedRevision,
		cachedAt: cache.cachedAt,
		activeTermAvailability: contract.activeTermState.availability,
		fingerprint,
		confirmationText: getTermCacheConfirmationText(input.schoolId, yearId),
		zeroWrite: true,
	};
}

export type TermCacheApplyInput = {
	schoolId: number;
	actorId: number;
	authToken?: string;
	confirmationText?: unknown;
	fingerprint?: unknown;
	fetchLive?: () => Promise<TermContractFetchResult>;
};

export type TermCacheApplyResult = {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	mirrorId: number;
	applied: boolean;
	replayed: boolean;
	written: boolean;
	semanticRevision: string;
	previousSemanticRevision: string | null;
	activeTermAvailability: ActiveTermAvailability;
	auditId: number | null;
	cachedAt: string;
	terms: VerifiedTerm[];
};

function isTermTransactionConflict(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034';
}

/**
 * Fingerprinted, actor-scoped apply of the narrow term-authority catch-up.
 * Re-fetches and re-validates the live EnrollPro contract, revalidates the
 * active mirror/current cache state, then writes ONLY the active mirror's
 * `termContractCache`/`termContractCachedAt` plus one scoped audit row. Drift or
 * scope mismatch fails with a typed 4xx and zero writes. Identical replay is
 * idempotent with no second audit row.
 */
export async function applyTermCacheSync(input: TermCacheApplyInput): Promise<TermCacheApplyResult> {
	if (!Number.isInteger(input.schoolId) || input.schoolId <= 0) {
		throw termAuthorityError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	}
	const mirror = await resolveActiveYearMirror(input.schoolId);
	const yearId = mirror.enrollProSchoolYearId;
	const expectedConfirmation = getTermCacheConfirmationText(input.schoolId, yearId);
	if (input.confirmationText !== expectedConfirmation) {
		throw termAuthorityError(400, 'CONFIRMATION_REQUIRED', `confirmationText="${expectedConfirmation}" is required to save ordered term authority.`);
	}
	if (typeof input.fingerprint !== 'string' || input.fingerprint.length === 0) {
		throw termAuthorityError(400, 'FINGERPRINT_REQUIRED', 'fingerprint from the term-authority preview is required.');
	}
	const live = await (input.fetchLive
		? input.fetchLive()
		: fetchEnrollProTermContract({ schoolId: input.schoolId, schoolYearId: yearId, authToken: input.authToken }));
	if (!live.ok) {
		throw termAuthorityError(
			isUnreachableTermError(live.error.code) ? 503 : 409,
			live.error.code,
			live.error.message,
		);
	}
	const contract = live.contract;

	// Revalidate the preview against the freshly fetched live contract BEFORE any
	// write. A changed upstream revision (reorder/rename) yields a different
	// fingerprint and is rejected with zero writes.
	const preMirror = await readMirrorRow(input.schoolId, yearId);
	const preCache = readValidCache(preMirror, input.schoolId, yearId);
	const expectedFingerprint = termCacheFingerprint({
		schoolId: input.schoolId,
		schoolYearId: yearId,
		mirrorId: preMirror!.id,
		format: contract.format,
		liveSemanticRevision: contract.semanticRevision,
		persistedSemanticRevision: preCache.valid ? preCache.contract!.semanticRevision : null,
	});
	if (expectedFingerprint !== input.fingerprint) {
		throw termAuthorityError(409, 'FINGERPRINT_MISMATCH', 'The live ordered terms or saved cache changed since the preview. Re-run the preview before saving.');
	}

	const now = new Date();
	const mirrorLabel = mirror.yearLabel;
	try {
		return await (getDataContext<any>() as any).$transaction(async (tx: any) => {
			const txMirror = await tx.enrollProSchoolYearMirror.findUnique({
				where: { schoolId_enrollProSchoolYearId: { schoolId: input.schoolId, enrollProSchoolYearId: yearId } },
				select: { id: true, isActive: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
			});
			if (!txMirror || txMirror.isArchived || !txMirror.isActive) {
				throw termAuthorityError(409, 'ACTIVE_YEAR_CHANGED', 'The active school-year mirror changed since the preview. Re-run the preview before saving.');
			}
			const txCache = readValidCache(txMirror, input.schoolId, yearId);
			const txFingerprint = termCacheFingerprint({
				schoolId: input.schoolId,
				schoolYearId: yearId,
				mirrorId: txMirror.id,
				format: contract.format,
				liveSemanticRevision: contract.semanticRevision,
				persistedSemanticRevision: txCache.valid ? txCache.contract!.semanticRevision : null,
			});
			if (txFingerprint !== input.fingerprint) {
				throw termAuthorityError(409, 'FINGERPRINT_MISMATCH', 'The saved term authority changed since the preview. Re-run the preview before saving.');
			}
			if (txCache.valid && txCache.contract!.semanticRevision === contract.semanticRevision) {
				return {
					schoolId: input.schoolId,
					schoolYearId: yearId,
					yearLabel: mirrorLabel,
					mirrorId: txMirror.id,
					applied: false,
					replayed: true,
					written: false,
					semanticRevision: contract.semanticRevision,
					previousSemanticRevision: txCache.contract!.semanticRevision,
					activeTermAvailability: contract.activeTermState.availability,
					auditId: null,
					cachedAt: txCache.cachedAt ?? now.toISOString(),
					terms: contract.terms,
				} as TermCacheApplyResult;
			}
			// Guarded, compare-and-set update: concurrent writers holding the same
			// observed cached-at value cannot both persist or audit.
			const updated = await tx.enrollProSchoolYearMirror.updateMany({
				where: { id: txMirror.id, termContractCachedAt: txMirror.termContractCachedAt },
				data: { termContractCache: contract, termContractCachedAt: now },
			});
			if (updated.count === 0) {
				const afterRow = await tx.enrollProSchoolYearMirror.findUnique({
					where: { id: txMirror.id },
					select: { termContractCache: true, termContractCachedAt: true },
				});
				const afterCache = readValidCache(
					afterRow ? { id: txMirror.id, isArchived: false, termContractCache: afterRow.termContractCache, termContractCachedAt: afterRow.termContractCachedAt } : null,
					input.schoolId,
					yearId,
				);
				if (afterCache.valid && afterCache.contract!.semanticRevision === contract.semanticRevision) {
					return {
						schoolId: input.schoolId,
						schoolYearId: yearId,
						yearLabel: mirrorLabel,
						mirrorId: txMirror.id,
						applied: false,
						replayed: true,
						written: false,
						semanticRevision: contract.semanticRevision,
						previousSemanticRevision: afterCache.contract!.semanticRevision,
						activeTermAvailability: contract.activeTermState.availability,
						auditId: null,
						cachedAt: afterCache.cachedAt ?? now.toISOString(),
						terms: contract.terms,
					} as TermCacheApplyResult;
				}
				throw termAuthorityError(409, 'TERM_CACHE_CONCURRENT_UPDATE', 'Another term-authority save completed concurrently. Re-run the preview and retry.');
			}
			const audit = await tx.auditLog.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId: yearId,
					action: 'TERM_CACHE_SYNC_APPLIED',
					actorId: input.actorId,
					targetIds: [yearId],
					metadata: {
						source: 'enrollpro-term-cache-catchup',
						yearLabel: mirrorLabel,
						semanticRevision: contract.semanticRevision,
						previousSemanticRevision: txCache.valid ? txCache.contract!.semanticRevision : null,
						termCount: contract.terms.length,
						format: contract.format,
						activeTermAvailability: contract.activeTermState.availability,
						completedAt: now.toISOString(),
					},
				},
				select: { id: true },
			});
			return {
				schoolId: input.schoolId,
				schoolYearId: yearId,
				yearLabel: mirrorLabel,
				mirrorId: txMirror.id,
				applied: true,
				replayed: false,
				written: true,
				semanticRevision: contract.semanticRevision,
				previousSemanticRevision: txCache.valid ? txCache.contract!.semanticRevision : null,
				activeTermAvailability: contract.activeTermState.availability,
				auditId: audit.id,
				cachedAt: now.toISOString(),
				terms: contract.terms,
			} as TermCacheApplyResult;
		}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
	} catch (error: unknown) {
		if (isTermTransactionConflict(error)) {
			throw termAuthorityError(409, 'TRANSACTION_CONFLICT', 'Concurrent term-authority save conflict: no partial writes occurred. Re-run the preview and retry.');
		}
		throw error;
	}
}
