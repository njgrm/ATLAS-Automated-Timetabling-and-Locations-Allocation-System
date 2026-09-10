import { createHash } from 'node:crypto';

import { getDataContext } from '../lib/data-context.js';

export type EnrollProTermFormat = 'TRIMESTER' | 'QUARTERS';

export type VerifiedTerm = {
	identity: string;
	displayLabel: string;
	order: number;
	startDate: string | null;
	endDate: string | null;
};

export type VerifiedTermContract = {
	schoolId: number;
	schoolYear: { id: number; yearLabel: string };
	format: EnrollProTermFormat;
	terms: VerifiedTerm[];
	activeTerm: { identity: string; displayLabel: string; order: number };
	semanticRevision: string;
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

type FetchInput = {
	baseUrl?: string;
	authToken?: string;
	schoolId: number;
	schoolYearId: number;
};

type ResolutionDependencies = {
	fetchLive: () => Promise<TermContractFetchResult>;
	loadCache: () => Promise<CachedTermContractRecord | null>;
	saveCache: (record: CachedTermContractRecord) => Promise<void>;
	now?: () => Date;
};

const FORMAT_TERM_COUNT: Record<EnrollProTermFormat, number> = {
	TRIMESTER: 3,
	QUARTERS: 4,
};

function fail(code: string, message: string): TermContractFetchResult {
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

function normalizedIdentity(value: unknown): string | null {
	const text = nonEmptyString(value);
	return text ? text.toUpperCase() : null;
}

function normalizeDate(value: unknown): { ok: true; value: string | null } | { ok: false } {
	if (value === undefined || value === null || value === '') return { ok: true, value: null };
	if (typeof value !== 'string' && !(value instanceof Date)) return { ok: false };
	const parsed = value instanceof Date ? value : new Date(value);
	if (!Number.isFinite(parsed.getTime())) return { ok: false };
	return { ok: true, value: parsed.toISOString().slice(0, 10) };
}

function semanticRevisionFor(contract: Omit<VerifiedTermContract, 'semanticRevision'>): string {
	return createHash('sha256').update(JSON.stringify(contract)).digest('hex');
}

function buildFlatTerms(data: Record<string, unknown>, format: EnrollProTermFormat): TermContractFetchResult | VerifiedTerm[] {
	const count = FORMAT_TERM_COUNT[format];
	const terms: VerifiedTerm[] = [];
	for (let index = 1; index <= count; index += 1) {
		const identity = normalizedIdentity(data[`term${index}Identity`]);
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

function buildExplicitTerms(rawTerms: unknown[], format: EnrollProTermFormat): TermContractFetchResult | VerifiedTerm[] {
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
		const identity = normalizedIdentity(item.identity ?? item.id);
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

export function normalizeEnrollProTermContract(input: {
	schoolId: number;
	schoolYearId: number;
	schoolYearPayload: unknown;
	activeTermPayload: unknown;
}): TermContractFetchResult {
	const schoolYearEnvelope = input.schoolYearPayload as { data?: unknown } | null;
	const activeTermEnvelope = input.activeTermPayload as { data?: unknown } | null;
	if (!schoolYearEnvelope?.data || typeof schoolYearEnvelope.data !== 'object' || Array.isArray(schoolYearEnvelope.data)) {
		return fail('SCHOOL_YEAR_CONTRACT_INVALID', 'EnrollPro school-year response is missing its data object.');
	}
	if (!activeTermEnvelope?.data || typeof activeTermEnvelope.data !== 'object' || Array.isArray(activeTermEnvelope.data)) {
		return fail('ACTIVE_TERM_CONTRACT_INVALID', 'EnrollPro active-term response is missing its data object.');
	}
	const schoolYear = schoolYearEnvelope.data as Record<string, unknown>;
	const activeTerm = activeTermEnvelope.data as Record<string, unknown>;
	const upstreamYearId = positiveInteger(schoolYear.id ?? schoolYear.schoolYearId);
	const yearLabel = nonEmptyString(schoolYear.yearLabel);
	if (!upstreamYearId || !yearLabel) {
		return fail('SCHOOL_YEAR_CONTRACT_INVALID', 'EnrollPro school-year response must include a positive id and yearLabel.');
	}
	if (upstreamYearId !== input.schoolYearId) {
		return fail('SCHOOL_YEAR_MISMATCH', `EnrollPro returned school year ${upstreamYearId}; ATLAS requested ${input.schoolYearId}.`);
	}
	for (const payload of [schoolYear, activeTerm]) {
		if (payload.schoolId !== undefined && positiveInteger(payload.schoolId) !== input.schoolId) {
			return fail('SCHOOL_ID_MISMATCH', `EnrollPro returned a school identity that does not match ATLAS school ${input.schoolId}.`);
		}
	}
	const activeYearId = positiveInteger(activeTerm.schoolYearId);
	if (!activeYearId || activeYearId !== upstreamYearId) {
		return fail('ACTIVE_TERM_YEAR_MISMATCH', `EnrollPro active-term year ${String(activeTerm.schoolYearId ?? 'missing')} does not match school year ${upstreamYearId}.`);
	}
	const normalizedFormat = normalizedIdentity(schoolYear.termFormat);
	if (normalizedFormat !== 'TRIMESTER' && normalizedFormat !== 'QUARTERS') {
		return fail('TERM_FORMAT_UNSUPPORTED', `EnrollPro returned unsupported term format ${String(schoolYear.termFormat ?? 'missing')}.`);
	}
	const builtTerms = Array.isArray(schoolYear.terms)
		? buildExplicitTerms(schoolYear.terms, normalizedFormat)
		: buildFlatTerms(schoolYear, normalizedFormat);
	if (!Array.isArray(builtTerms)) return builtTerms;
	const identities = builtTerms.map((term) => term.identity);
	if (new Set(identities).size !== identities.length) {
		return fail('TERM_IDENTITIES_DUPLICATE', 'EnrollPro returned duplicate term identities.');
	}
	const activeIdentity = normalizedIdentity(activeTerm.activeTerm ?? activeTerm.termIdentity);
	const resolvedActive = activeIdentity ? builtTerms.find((term) => term.identity === activeIdentity) : null;
	if (!resolvedActive) {
		return fail('ACTIVE_TERM_OUTSIDE_CONTRACT', `EnrollPro active term ${String(activeTerm.activeTerm ?? activeTerm.termIdentity ?? 'missing')} is outside the ordered term contract.`);
	}
	const semantic: Omit<VerifiedTermContract, 'semanticRevision'> = {
		schoolId: input.schoolId,
		schoolYear: { id: upstreamYearId, yearLabel },
		format: normalizedFormat,
		terms: builtTerms,
		activeTerm: { identity: resolvedActive.identity, displayLabel: resolvedActive.displayLabel, order: resolvedActive.order },
	};
	return { ok: true, contract: { ...semantic, semanticRevision: semanticRevisionFor(semantic) } };
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<{ ok: true; body: unknown } | { ok: false; status: number | null }> {
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(4000), headers });
		if (!response.ok) return { ok: false, status: response.status };
		return { ok: true, body: await response.json() };
	} catch {
		return { ok: false, status: null };
	}
}

export async function fetchEnrollProTermContract(input: FetchInput): Promise<TermContractFetchResult> {
	const baseUrl = (input.baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\/$/, '');
	const token = input.authToken ?? process.env.ENROLLPRO_SERVICE_TOKEN;
	if (!token) return fail('ENROLLPRO_UNREACHABLE', 'No EnrollPro integration credential is configured.');
	const [schoolYear, activeTerm] = await Promise.all([
		fetchJson(`${baseUrl}/integration/v1/school-year`, { Authorization: `Bearer ${token}` }),
		fetchJson(`${baseUrl}/integration/v1/active-term`, { 'X-Integration-Key': token }),
	]);
	if (!schoolYear.ok || !activeTerm.ok) {
		return fail(
			'ENROLLPRO_UNREACHABLE',
			`EnrollPro term authority is unavailable (school-year ${schoolYear.ok ? 200 : schoolYear.status ?? 'network'}, active-term ${activeTerm.ok ? 200 : activeTerm.status ?? 'network'}).`,
		);
	}
	return normalizeEnrollProTermContract({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		schoolYearPayload: schoolYear.body,
		activeTermPayload: activeTerm.body,
	});
}

function validateCachedContract(contract: VerifiedTermContract, schoolId: number, schoolYearId: number): TermContractError | null {
	if (contract.schoolId !== schoolId) return { code: 'TERM_CACHE_SCHOOL_MISMATCH', message: 'Saved term contract belongs to another school.' };
	if (contract.schoolYear?.id !== schoolYearId) return { code: 'TERM_CACHE_YEAR_MISMATCH', message: 'Saved term contract belongs to another school year.' };
	if (contract.format !== 'TRIMESTER' && contract.format !== 'QUARTERS') return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an unsupported format.' };
	if (!Array.isArray(contract.terms) || contract.terms.length !== FORMAT_TERM_COUNT[contract.format]) return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract has an invalid term count.' };
	const { semanticRevision, ...semantic } = contract;
	if (semanticRevisionFor(semantic) !== semanticRevision) return { code: 'TERM_CACHE_INVALID', message: 'Saved term contract failed its semantic revision check.' };
	return null;
}

export async function resolveTermContractWithDependencies(
	input: { schoolId: number; schoolYearId: number; authToken?: string },
	dependencies: ResolutionDependencies,
): Promise<TermContractResolution> {
	const now = dependencies.now?.() ?? new Date();
	const live = await dependencies.fetchLive();
	if (live.ok) {
		const record = { contract: live.contract, cachedAt: now.toISOString() };
		try {
			await dependencies.saveCache(record);
		} catch {
			return {
				state: 'VERIFIED_LIVE', source: 'enrollpro', degraded: false, code: 'TERM_CACHE_WRITE_FAILED',
				message: 'Term structure is verified live, but ATLAS could not refresh its saved fallback.',
				contract: live.contract, verifiedAt: record.cachedAt,
			};
		}
		return {
			state: 'VERIFIED_LIVE', source: 'enrollpro', degraded: false, code: null,
			message: 'Term structure verified live from EnrollPro.', contract: live.contract, verifiedAt: record.cachedAt,
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
		state: 'VERIFIED_CACHED', source: 'atlas-cache', degraded: true, code: live.error.code,
		message: `Using saved term contract from ${cached.cachedAt}; EnrollPro verification is unavailable.`,
		contract: cached.contract, verifiedAt: cached.cachedAt,
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
		saveCache: async (record) => {
			await client.enrollProSchoolYearMirror.update({
				where: { id: mirror.id },
				data: { termContractCache: record.contract, termContractCachedAt: new Date(record.cachedAt) },
			});
		},
	});
}
