/**
 * DEMAND-C01R2 — One authoritative ordered-term model.
 *
 * The verified EnrollPro ordered term contract is the single academic-term
 * authority. This module centralizes the syntactic parsing and semantic
 * validation policy that was previously duplicated (and truncated to three
 * terms) across generation, publication, revision, export, and public reads.
 *
 * Policy:
 *  - Syntactic parsing accepts any positive supported index (1..4) so a
 *    `QUARTERS` term 4 reaches semantic validation.
 *  - Semantic validation rejects an index absent from the exact school/year
 *    contract: a trimester rejects 4; a quarter accepts 4.
 *  - `loadVerifiedOrderedTermContract` stays network-free and reads only the
 *    persisted verified contract; it is safe inside Serializable transactions
 *    and is the generation/publication term authority.
 *  - `resolveActiveOrderedTermIndexLive` is the separate, network-aware active
 *    term resolver for NON-transaction entry points (ACTIVE-TERM-LIVE-RESOLUTION-C01).
 *  - Either way no term is ever clamped, cycled, defaulted, relabelled, or
 *    silently dropped; an unresolved term is `null`, never Term 1.
 */

import { getDataContext } from '../lib/data-context.js';
import { normalizePersistedTermStructure } from './derived-demand.service.js';
import { fetchEnrollProTermContract, type TermContractFetchResult } from './enrollpro-term-contract.service.js';

export type AcademicTermFormat = 'TRIMESTER' | 'QUARTERS';

export const SEMESTER_TERM_COUNT = 3;
export const QUARTER_TERM_COUNT = 4;
/** Highest index the current supported contract family (`TRIMESTER`/`QUARTERS`) can name. */
export const MAX_ACADEMIC_TERM_INDEX = QUARTER_TERM_COUNT;

export type OrderedAcademicTerm = {
	identity: string;
	displayLabel: string;
	order: number;
};

export function termCountForFormat(format: AcademicTermFormat): number {
	return format === 'QUARTERS' ? QUARTER_TERM_COUNT : SEMESTER_TERM_COUNT;
}

/**
 * Syntactic parse: a positive integer within the supported contract family.
 * Returns `null` for anything else (including `'active'`, which the caller must
 * resolve separately through verified authority).
 */
export function parseSupportedTermIndex(raw: unknown): number | null {
	if (raw === null || raw === undefined || raw === '') return null;
	const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
	if (!Number.isInteger(value) || value < 1 || value > MAX_ACADEMIC_TERM_INDEX) return null;
	return value;
}

export function isTermIndexWithinContract(index: number, terms: readonly { order: number }[]): boolean {
	return Number.isInteger(index) && index >= 1 && index <= terms.length;
}

/** `T1`/`T2`/... is the explicit fail-closed fallback when no authoritative label exists. */
export function academicTermFallbackLabel(index: number): string {
	return `T${index}`;
}

export function academicTermDisplayLabel(terms: readonly OrderedAcademicTerm[], index: number): string {
	const term = terms.find((entry) => entry.order === index);
	const label = term?.displayLabel?.trim();
	return label && label.length > 0 ? label : academicTermFallbackLabel(index);
}

export type LoadedAcademicTermContract = {
	schoolId: number;
	schoolYearId: number;
	format: AcademicTermFormat;
	terms: OrderedAcademicTerm[];
	/** Active term order from the persisted verified EnrollPro contract, or null. */
	activeTermOrder: number | null;
};

type TermAuthorityClient = {
	enrollProSchoolYearMirror: {
		findUnique: (args: unknown) => Promise<{
			isActive: boolean;
			isArchived: boolean;
			termContractCache: unknown;
			termContractCachedAt: Date | null;
		} | null>;
	};
};

/**
 * Read the persisted, verified ordered term contract for one (school, year).
 * Read-only; never calls the network and never persists. Returns `null` when no
 * verified snapshot exists or the snapshot is malformed.
 */
export async function loadVerifiedOrderedTermContract(
	schoolId: number,
	schoolYearId: number,
	client: TermAuthorityClient = getDataContext<TermAuthorityClient>(),
): Promise<LoadedAcademicTermContract | null> {
	const mirror = await client.enrollProSchoolYearMirror.findUnique({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
		select: { isActive: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
	});
	if (!mirror || !mirror.isActive || mirror.isArchived || !mirror.termContractCache || !mirror.termContractCachedAt) {
		return null;
	}
	const normalized = normalizePersistedTermStructure(mirror.termContractCache, schoolId, schoolYearId);
	if (!normalized.ok) return null;
	const rawActive = (mirror.termContractCache as { activeTerm?: { order?: unknown } }).activeTerm;
	const activeOrder = rawActive && Number.isInteger(rawActive.order) ? Number(rawActive.order) : null;
	return {
		schoolId,
		schoolYearId,
		format: normalized.structure.format,
		terms: normalized.structure.terms,
		activeTermOrder: activeOrder != null && isTermIndexWithinContract(activeOrder, normalized.structure.terms) ? activeOrder : null,
	};
}

/**
 * Normalize a persisted term boundary (an ISO-ish date string) or a `Date` to a
 * `YYYY-MM-DD` stamp so term ranges can be compared lexicographically. A `Date`
 * uses its local calendar date; a string is normalized through `Date.parse` and
 * falls back to its first 10 characters when unparseable.
 *
 * Extracted from `runtime-context.service.ts` (single implementation shared by
 * the client runtime context and the live availability resolver).
 */
function dayStamp(value: string | Date): string {
	if (value instanceof Date) {
		return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
	}
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : value.slice(0, 10);
}

export type PersistedTermBoundary = {
	identity: string;
	order: number;
	startDate?: string | null;
	endDate?: string | null;
};

/**
 * RR-TERM-CACHE offline resilience: choose the persisted contract's active term
 * when the live EnrollPro active-term endpoint is unreachable. The persisted
 * `activeTerm` snapshot can be stale — it is only rewritten when the contract's
 * semantic revision changes — so after a term rollover it can still name the
 * previous term. When every persisted term carries verified date boundaries,
 * prefer the term whose range contains `now`, then the latest term that has
 * already started (covers a gap between two terms), and only then the snapshot.
 * A term missing either boundary falls back to the snapshot.
 */
export function derivePersistedActiveTerm(
	terms: readonly PersistedTermBoundary[],
	snapshotOrder: number | null,
	now: Date,
): { identity: string; termIndex: number } | null {
	const snapshotEntry = snapshotOrder != null ? terms.find((term) => term.order === snapshotOrder) : undefined;
	const today = dayStamp(now);
	const dated = terms.length > 0 && terms.every((term) => term.startDate && term.endDate);
	const dateEntry = dated
		? (terms.find((term) => dayStamp(term.startDate!) <= today && today <= dayStamp(term.endDate!))
			?? terms.filter((term) => dayStamp(term.startDate!) <= today).pop())
		: undefined;
	const chosen = dateEntry ?? snapshotEntry;
	return chosen ? { identity: chosen.identity, termIndex: chosen.order } : null;
}

// ─── ACTIVE-TERM-LIVE-RESOLUTION-C01: live-first active term ───
//
// The persisted `activeTerm` is frozen by design (it is excluded from the
// semantic revision), so it can be stale at T1 while EnrollPro's live active
// term is T2. `resolveActiveOrderedTermIndexLive` reads the live verified
// contract for NON-transaction entry points and falls back to the SAME
// date-derived persisted active term the client runtime context uses.

/**
 * Injectable live-contract seam. The default implementation reuses the
 * canonical `fetchEnrollProTermContract` verifier; tests inject a deterministic
 * provider.
 */
export type ActiveOrderedTermProvider = (input: {
	schoolId: number;
	schoolYearId: number;
}) => Promise<TermContractFetchResult>;

const ACTIVE_ORDERED_TERM_LIVE_TTL_MS = 30_000;
const ACTIVE_ORDERED_TERM_LIVE_MAX_ENTRIES = 64;

type ActiveOrderedTermLiveBucket = {
	ttl: Map<string, { expiresAt: number; result: TermContractFetchResult }>;
	inFlight: Map<string, Promise<TermContractFetchResult>>;
};

const activeOrderedTermBuckets = new WeakMap<ActiveOrderedTermProvider, ActiveOrderedTermLiveBucket>();

function bucketFor(provider: ActiveOrderedTermProvider): ActiveOrderedTermLiveBucket {
	const existing = activeOrderedTermBuckets.get(provider);
	if (existing) return existing;
	const created: ActiveOrderedTermLiveBucket = { ttl: new Map(), inFlight: new Map() };
	activeOrderedTermBuckets.set(provider, created);
	return created;
}

const defaultActiveOrderedTermProvider: ActiveOrderedTermProvider = ({ schoolId, schoolYearId }) =>
	fetchEnrollProTermContract({ schoolId, schoolYearId });

/**
 * Bounded single-flight + short TTL memo, per provider + (school, year). At most
 * one live request is in flight for a key; a completed result is reused for
 * {@link ACTIVE_ORDERED_TERM_LIVE_TTL_MS}. The memo is bounded to
 * {@link ACTIVE_ORDERED_TERM_LIVE_MAX_ENTRIES} keys (oldest insertion evicted).
 */
async function fetchActiveOrderedTermLive(
	provider: ActiveOrderedTermProvider,
	schoolId: number,
	schoolYearId: number,
): Promise<TermContractFetchResult> {
	const bucket = bucketFor(provider);
	const key = `${schoolId}:${schoolYearId}`;
	const memo = bucket.ttl.get(key);
	if (memo && memo.expiresAt > Date.now()) return memo.result;
	const inFlight = bucket.inFlight.get(key);
	if (inFlight) return inFlight;
	const request = (async () => {
		try {
			const result = await provider({ schoolId, schoolYearId });
			if (bucket.ttl.size >= ACTIVE_ORDERED_TERM_LIVE_MAX_ENTRIES) {
				const oldest = bucket.ttl.keys().next().value;
				if (oldest !== undefined) bucket.ttl.delete(oldest);
			}
			bucket.ttl.set(key, { expiresAt: Date.now() + ACTIVE_ORDERED_TERM_LIVE_TTL_MS, result });
			return result;
		} finally {
			bucket.inFlight.delete(key);
		}
	})();
	bucket.inFlight.set(key, request);
	return request;
}

type LiveActiveOrderInterpretation =
	| { kind: 'resolved'; order: number }
	| { kind: 'authoritative-null' }
	| { kind: 'unreachable' };

/**
 * Mirror `runtime-context.service.ts` semantics exactly:
 *  - a live verified active term → its order;
 *  - a reachable typed result with no active term (`ACTIVE_TERM_UNRESOLVED`,
 *    `CONTRACT_INVALID`, or a reachable source failure) is authoritative and
 *    resolves to `null` — never a fallback and never Term 1;
 *  - only an `enrollpro-unreachable` result (network failure or missing
 *    credential) triggers the date-derived persisted fallback.
 */
function interpretLiveActiveOrder(result: TermContractFetchResult | null): LiveActiveOrderInterpretation {
	if (!result) return { kind: 'unreachable' };
	if (!result.ok) {
		return result.error.code === 'ENROLLPRO_UNREACHABLE' ? { kind: 'unreachable' } : { kind: 'authoritative-null' };
	}
	const { contract } = result;
	if (contract.activeTerm && Number.isInteger(contract.activeTerm.order)) {
		return { kind: 'resolved', order: contract.activeTerm.order };
	}
	return contract.activeTermState.reachable ? { kind: 'authoritative-null' } : { kind: 'unreachable' };
}

/**
 * Date-derived persisted active term — the same derivation the client runtime
 * context uses. Reads one persisted verified snapshot and never calls the
 * network.
 */
async function loadPersistedActiveOrderedTermIndex(
	schoolId: number,
	schoolYearId: number,
	client: unknown,
	now: Date,
): Promise<number | null> {
	const dataClient = (client ?? getDataContext()) as TermAuthorityClient;
	let mirror: Awaited<ReturnType<TermAuthorityClient['enrollProSchoolYearMirror']['findUnique']>>;
	try {
		mirror = await dataClient.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
			select: { isActive: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
		});
	} catch {
		return null;
	}
	if (!mirror || !mirror.isActive || mirror.isArchived || !mirror.termContractCache || !mirror.termContractCachedAt) return null;
	const normalized = normalizePersistedTermStructure(mirror.termContractCache, schoolId, schoolYearId);
	if (!normalized.ok) return null;
	const rawActive = (mirror.termContractCache as { activeTerm?: { order?: unknown } }).activeTerm;
	const snapshotOrder = rawActive && Number.isInteger(rawActive.order) ? Number(rawActive.order) : null;
	return derivePersistedActiveTerm(normalized.structure.terms, snapshotOrder, now)?.termIndex ?? null;
}

export type ResolveActiveOrderedTermIndexLiveOptions = {
	/** Live-contract provider seam; defaults to `fetchEnrollProTermContract`. */
	provider?: ActiveOrderedTermProvider;
	/** Clock for the date-derived fallback; defaults to `new Date()`. */
	now?: Date;
	/** Persisted-contract read seam; defaults to the active data context. */
	client?: unknown;
};

/**
 * ACTIVE-TERM-LIVE-RESOLUTION-C01 — resolve the active ordered term for
 * NON-transaction entry points, live-first:
 *  1. the live verified EnrollPro contract's `activeTerm.order`;
 *  2. otherwise, when EnrollPro is unreachable, the date-derived persisted
 *     active term;
 *  3. otherwise `null` (the caller keeps `TERM_AUTHORITY_UNRESOLVED`, never
 *     Term 1).
 *
 * Do NOT call this inside a Serializable/advisory-locked transaction; use the
 * network-free `loadVerifiedOrderedTermContract` there.
 */
export async function resolveActiveOrderedTermIndexLive(
	schoolId: number,
	schoolYearId: number,
	options: ResolveActiveOrderedTermIndexLiveOptions = {},
): Promise<number | null> {
	const provider = options.provider ?? defaultActiveOrderedTermProvider;
	const now = options.now ?? new Date();
	let live: TermContractFetchResult | null = null;
	try {
		live = await fetchActiveOrderedTermLive(provider, schoolId, schoolYearId);
	} catch {
		live = null;
	}
	const interpreted = interpretLiveActiveOrder(live);
	if (interpreted.kind === 'resolved') return interpreted.order;
	if (interpreted.kind === 'authoritative-null') return null;
	return loadPersistedActiveOrderedTermIndex(schoolId, schoolYearId, options.client, now);
}

export function termIndexOutsideContractMessage(schoolId: number, schoolYearId: number, index: number, contract: LoadedAcademicTermContract): string {
	return `termIndex ${index} is outside the ${contract.terms.length}-term ${contract.format} contract for school ${schoolId} / year ${schoolYearId}.`;
}

export type AcademicTermServiceError = Error & { statusCode: number; code: string };

function termError(statusCode: number, code: string, message: string): AcademicTermServiceError {
	const error = new Error(message) as AcademicTermServiceError;
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

/**
 * Resolve a requested academic term filter through the verified ordered-term
 * authority.
 *
 * - `undefined` → all terms.
 * - `'active'` → the persisted verified active term order; fails closed with
 *   `TERM_FILTER_NOT_READY` when no verified active term exists.
 * - explicit numeric → the same index when it belongs to the exact verified
 *   structure, otherwise a typed `TERM_INDEX_OUTSIDE_CONTRACT`; this works even
 *   while active-term resolution is unavailable, provided the structure loads.
 */
export async function resolveRequestedTermIndex(
	schoolId: number,
	schoolYearId: number,
	requested: number | 'active' | undefined,
	client?: TermAuthorityClient,
): Promise<number | undefined> {
	if (requested === undefined) return undefined;
	const contract = await loadVerifiedOrderedTermContract(schoolId, schoolYearId, client);
	return resolveRequestedTermIndexFromContract(contract, schoolId, schoolYearId, requested);
}

/**
 * PUBLISHED-IMMUTABILITY-C08 — resolve a requested term filter against an
 * already-resolved contract (the frozen published snapshot's ordered-term
 * contract for published/archived consumers, or the live verified contract for
 * draft work). The frozen contract is the term authority for a published run, so
 * an archived year never depends on the live active/non-archived mirror cache.
 */
export function resolveRequestedTermIndexFromContract(
	contract: LoadedAcademicTermContract | null,
	schoolId: number,
	schoolYearId: number,
	requested: number | 'active',
): number | undefined {
	if (requested === 'active') {
		if (!contract || contract.activeTermOrder == null) {
			throw termError(501, 'TERM_FILTER_NOT_READY', 'The active term cannot be verified from the published/frozen term authority. Choose an explicit term or omit termIndex.');
		}
		return contract.activeTermOrder;
	}
	if (!Number.isInteger(requested) || requested < 1 || requested > MAX_ACADEMIC_TERM_INDEX) {
		throw termError(400, 'INVALID_TERM_INDEX', `termIndex must be 1..${MAX_ACADEMIC_TERM_INDEX} or "active".`);
	}
	if (!contract) {
		throw termError(409, 'TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term contract is available for this school year, so the requested term cannot be validated.');
	}
	if (!isTermIndexWithinContract(requested, contract.terms)) {
		throw termError(400, 'TERM_INDEX_OUTSIDE_CONTRACT', termIndexOutsideContractMessage(schoolId, schoolYearId, requested, contract));
	}
	return requested;
}
