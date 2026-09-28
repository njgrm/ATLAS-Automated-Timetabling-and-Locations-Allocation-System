import { fetchAtlasRuntimeContext, fetchPublicSettings } from './settings';

const ACTIVE_SCHOOL_YEAR_CACHE_PREFIX = 'atlas:active-school-year-context:v3';
const ACTIVE_SCHOOL_YEAR_MAX_AGE_MS = 10 * 60 * 1000;

type ActiveTermPayload = {
	source: string;
	reachable: boolean;
	verified: boolean;
	activeTerm: string | null;
	termIndex: number | null;
	schoolYearId: number | null;
	matchedSchoolYear: boolean | null;
	code: string | null;
	message: string;
	orderedTerms?: Array<{ identity: string; displayLabel: string; order: number }>;
	termFormat?: 'TRIMESTER' | 'QUARTERS' | null;
	termCount?: number | null;
	/**
	 * A5-C2A — the server resolver's degradation truth. `degraded` means the
	 * active term came from the saved verified ordered-term snapshot, and
	 * `cachedAt` is the REAL capture time of that snapshot. The client must
	 * render both: saved data is never presented as live, and it never
	 * degrades silently.
	 */
	degraded?: boolean;
	cachedAt?: string | null;
	cachedBeyondTtl?: boolean;
	semanticRevisionMatched?: boolean | null;
};

type ActiveSchoolYearCacheRecord = {
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	activeTerm: ActiveTermPayload | null;
	cachedAt: string;
};

export type ActiveSchoolYearContextSource = 'atlas-persisted' | 'enrollpro-verified' | 'enrollpro' | 'cache';

export type ActiveSchoolYearContext = {
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	schoolId: number;
	source: ActiveSchoolYearContextSource;
	stale: boolean;
	cachedAt: string;
	activeTerm: ActiveTermPayload | null;
};

export type ResolveActiveSchoolYearContextOptions = {
	/**
	 * The authenticated actor school. REQUIRED — there is deliberately no
	 * school-1 default. Actor/tenant-sensitive callers must obtain this from
	 * `resolveActorSchoolId()`, never a client constant or a downstream response.
	 */
	schoolId: number;
	forceRefresh?: boolean;
	/** Return cached data immediately without waiting for upstream, even if stale. */
	preferCache?: boolean;
	/** Fire background re-verification and update the cache without blocking the caller. */
	backgroundRefresh?: boolean;
	/** Force ATLAS runtime context to verify live EnrollPro upstream before resolving. */
	verifyUpstream?: boolean;
	allowStaleOnError?: boolean;
	maxAgeMs?: number;
	allowEnrollProFallback?: boolean;
};

type PromotionOptions = {
	schoolId: number;
	allowStaleOnError?: boolean;
	allowEnrollProFallback?: boolean;
	verifyUpstream?: boolean;
};

/** Actor/tenant scope must be a strict positive integer; never defaulted. */
function assertExplicitSchoolId(schoolId: unknown): number {
	if (typeof schoolId !== 'number' || !Number.isInteger(schoolId) || schoolId <= 0) {
		throw new Error('An explicit authenticated actor school (positive integer) is required.');
	}
	return schoolId;
}

export function isUpstreamBackedSchoolYearSource(source: ActiveSchoolYearContextSource): boolean {
	return source === 'enrollpro' || source === 'enrollpro-verified';
}

/**
 * Returns true when the school-year context is current enough to be presented as live to the user.
 * Live = any non-cache source AND not flagged stale. Cache-only or stale records are not "live".
 */
export function isLiveSchoolYearContext(context: Pick<ActiveSchoolYearContext, 'source' | 'stale'>): boolean {
	if (context.stale) return false;
	return context.source !== 'cache';
}

/**
 * Compute the user-facing source-of-truth notice for faculty surfaces.
 * Returns null when the page is operating on live, healthy upstream data (no banner needed).
 * Returns honest degraded wording when the context is cache-only or stale.
 */
export function describeSchoolYearSource(context: ActiveSchoolYearContext): string | null {
	if (isLiveSchoolYearContext(context)) {
		return null;
	}
	if (context.activeSchoolYearLabel) {
		return `Working from saved data (${context.activeSchoolYearLabel}).`;
	}
	return 'Working from saved data.';
}

/**
 * A5-C2A — the ONE wording for "this answer came from saved data".
 *
 * Every surface that consumes the canonical active-term resolver must describe
 * a degraded answer with this helper, so no page invents its own phrase and no
 * page can present saved data as if it were live. Returns `null` for a live
 * answer, which callers render as no notice at all.
 */
export function describeSavedTermSource(activeTerm: ActiveTermPayload | null | undefined): string | null {
	if (!activeTerm || activeTerm.degraded !== true) return null;
	const captured = formatCapturedTime(activeTerm.cachedAt);
	if (!captured) {
		return 'Using saved term data.';
	}
	return activeTerm.cachedBeyondTtl === true
		? `Using saved term data from ${captured} (older than the usual refresh window).`
		: `Using saved term data from ${captured}.`;
}

/**
 * Render a snapshot capture time for a human. The REAL value is shown; an
 * unparseable or absent stamp degrades to `null` so the caller can say it is
 * saved data without inventing a time.
 */
function formatCapturedTime(cachedAt: string | null | undefined): string | null {
	if (!cachedAt) return null;
	const parsed = Date.parse(cachedAt);
	if (!Number.isFinite(parsed)) return null;
	return new Date(parsed).toLocaleString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

/**
 * A5-C2A — a one-line, human reason for a genuinely unknown active term, taken
 * from the server's typed answer so the page never dead-ends without saying
 * why. Falls back to a generic sentence only when the server sent no code.
 */
export function describeUnresolvedTermReason(activeTerm: ActiveTermPayload | null | undefined): string {
	const message = activeTerm?.message?.trim();
	if (message) return message;
	if (activeTerm?.code) return `EnrollPro reported ${activeTerm.code} and ATLAS has no saved ordered term to fall back to.`;
	return 'ATLAS could not resolve an active ordered term from EnrollPro or from saved data.';
}

const activeSchoolYearMemory = new Map<number, ActiveSchoolYearCacheRecord>();

export function activeSchoolYearCacheKey(schoolId: number): string {
	return `${ACTIVE_SCHOOL_YEAR_CACHE_PREFIX}:${schoolId}`;
}

function readCachedActiveSchoolYear(schoolId: number): ActiveSchoolYearCacheRecord | null {
	const memory = activeSchoolYearMemory.get(schoolId);
	if (memory) return memory;

	try {
		const raw = localStorage.getItem(activeSchoolYearCacheKey(schoolId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ActiveSchoolYearCacheRecord;
		if (!parsed || typeof parsed.activeSchoolYearId !== 'number' || !parsed.cachedAt) {
			return null;
		}
		activeSchoolYearMemory.set(schoolId, parsed);
		return parsed;
	} catch {
		return null;
	}
}

export function cacheActiveSchoolYearContext(
	schoolId: number,
	activeSchoolYearId: number | null | undefined,
	activeSchoolYearLabel?: string | null,
	activeTerm?: ActiveSchoolYearContext['activeTerm'],
): void {
	if (!activeSchoolYearId || Number.isNaN(activeSchoolYearId)) {
		return;
	}

	const payload: ActiveSchoolYearCacheRecord = {
		activeSchoolYearId,
		activeSchoolYearLabel: activeSchoolYearLabel ?? null,
		activeTerm: activeTerm ?? null,
		cachedAt: new Date().toISOString(),
	};
	activeSchoolYearMemory.set(schoolId, payload);

	try {
		localStorage.setItem(activeSchoolYearCacheKey(schoolId), JSON.stringify(payload));
	} catch {
		// Ignore storage restrictions.
	}
}

export function invalidateActiveSchoolYearContext(schoolId: number): void {
	activeSchoolYearMemory.delete(schoolId);
	try {
		localStorage.removeItem(activeSchoolYearCacheKey(schoolId));
	} catch {
		// Ignore storage restrictions; the in-memory cache is already invalidated.
	}
}

function isFresh(cachedAtIso: string, maxAgeMs: number): boolean {
	const cachedAtMs = new Date(cachedAtIso).getTime();
	if (!Number.isFinite(cachedAtMs)) return false;
	return Date.now() - cachedAtMs <= maxAgeMs;
}

// DUP-READ-CALLERS-C01 (A2) — the in-flight registry is keyed by the FULL
// request profile, not just the school, so no caller can join an in-flight
// request whose load-bearing options differ. `verifyUpstream` is load-bearing
// (without it the result is `aligned`/`NONE` instead of
// `enrollpro-unreachable`/`RETRY_ENROLLPRO`), and `allowStaleOnError` selects
// throw versus a stale-cache fallback. Absent options are normalized to their
// effective defaults so two callers that differ only by an omitted default
// still dedupe.
function schoolYearContextProfileKey(
	schoolId: number,
	verifyUpstream: boolean,
	allowEnrollProFallback: boolean,
	allowStaleOnError: boolean,
): string {
	return `${schoolId}:${verifyUpstream ? 1 : 0}:${allowEnrollProFallback ? 1 : 0}:${allowStaleOnError ? 1 : 0}`;
}

// Deduplicate in-flight verification calls so rapid navigations don't spawn
// parallel requests for the same request profile.
const inflightBySchool = new Map<string, Promise<ActiveSchoolYearContext>>();

export async function resolveActiveSchoolYearContext(options: ResolveActiveSchoolYearContextOptions): Promise<ActiveSchoolYearContext> {
	const schoolId = assertExplicitSchoolId(options.schoolId);
	const forceRefresh = options.forceRefresh === true;
	const preferCache = options?.preferCache === true;
	const backgroundRefresh = options?.backgroundRefresh === true;
	const verifyUpstream = options?.verifyUpstream === true;
	const allowStaleOnError = options?.allowStaleOnError !== false;
	const maxAgeMs = options?.maxAgeMs ?? ACTIVE_SCHOOL_YEAR_MAX_AGE_MS;
	const allowEnrollProFallback = options?.allowEnrollProFallback !== false;

	const inflightKey = schoolYearContextProfileKey(schoolId, verifyUpstream, allowEnrollProFallback, allowStaleOnError);
	const cached = readCachedActiveSchoolYear(schoolId);
	const hasFreshCache = cached ? isFresh(cached.cachedAt, maxAgeMs) : false;

	// preferCache: return cached immediately (even if stale) and optionally
	// kick off a background re-verification so the next caller gets fresher data.
	if (preferCache && cached) {
		if (backgroundRefresh) {
			// Fire-and-forget — deduplicate so rapid mounts don't stack requests.
			if (!inflightBySchool.has(inflightKey)) {
				const inflight = _fetchRuntimeContext(schoolId, allowEnrollProFallback, allowStaleOnError, cached, verifyUpstream)
					.finally(() => { inflightBySchool.delete(inflightKey); });
				inflightBySchool.set(inflightKey, inflight);
				void inflight;
			}
		}
		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			schoolId,
			source: 'cache',
			stale: !hasFreshCache,
			cachedAt: cached.cachedAt,
			activeTerm: cached.activeTerm ?? null,
		};
	}

	if (!forceRefresh && cached && hasFreshCache) {
		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			schoolId,
			source: 'cache',
			stale: false,
			cachedAt: cached.cachedAt,
			activeTerm: cached.activeTerm ?? null,
		};
	}

	// Deduplicate concurrent calls so a single page mount doesn't spawn
	// multiple overlapping verification requests. A forceRefresh caller joins
	// here too: the key carries every load-bearing option, so it can only share
	// a request with the same verifyUpstream/allowStaleOnError/allowEnrollProFallback
	// axes, and the joined request performs a live fetch rather than returning cache.
	const existingInflight = inflightBySchool.get(inflightKey);
	if (existingInflight) {
		return existingInflight;
	}
	const inflight = _fetchRuntimeContext(schoolId, allowEnrollProFallback, allowStaleOnError, cached, verifyUpstream)
		.finally(() => { inflightBySchool.delete(inflightKey); });
	inflightBySchool.set(inflightKey, inflight);
	return inflight;
}

async function _fetchRuntimeContext(
	schoolId: number,
	allowEnrollProFallback: boolean,
	allowStaleOnError: boolean,
	cachedFallback: ActiveSchoolYearCacheRecord | null,
	verifyUpstream: boolean,
): Promise<ActiveSchoolYearContext> {

	let runtimeContextError: unknown = null;

	try {
		const runtimeContext = await fetchAtlasRuntimeContext(schoolId, verifyUpstream);
		if (runtimeContext?.activeSchoolYearId) {
			cacheActiveSchoolYearContext(
				schoolId,
				runtimeContext.activeSchoolYearId,
				runtimeContext.activeSchoolYearLabel ?? null,
				runtimeContext.activeTerm ?? null,
			);
			const updated = readCachedActiveSchoolYear(schoolId);

			return {
				activeSchoolYearId: runtimeContext.activeSchoolYearId,
				activeSchoolYearLabel: runtimeContext.activeSchoolYearLabel ?? null,
				schoolId: runtimeContext.schoolId,
				source: runtimeContext.source ?? 'atlas-persisted',
				stale: runtimeContext.stale,
				cachedAt: updated?.cachedAt ?? new Date().toISOString(),
				activeTerm: runtimeContext.activeTerm ?? null,
			};
		}
	} catch (error) {
		runtimeContextError = error;
		// Fall through to optional EnrollPro settings fallback.
	}

	if (!allowEnrollProFallback) {
		if (!allowStaleOnError || !cachedFallback) {
			throw runtimeContextError ?? new Error('Active school-year context is unavailable from ATLAS runtime data.');
		}

		return {
			activeSchoolYearId: cachedFallback.activeSchoolYearId,
			activeSchoolYearLabel: cachedFallback.activeSchoolYearLabel,
			schoolId,
			source: 'cache',
			stale: true,
			cachedAt: cachedFallback.cachedAt,
			activeTerm: cachedFallback.activeTerm ?? null,
		};
	}

	try {
		const settings = await fetchPublicSettings();
		if (!settings.activeSchoolYearId) {
			throw new Error('Active school year is not configured.');
		}

		cacheActiveSchoolYearContext(schoolId, settings.activeSchoolYearId, settings.activeSchoolYearLabel ?? null);
		const updated = readCachedActiveSchoolYear(schoolId);

		return {
			activeSchoolYearId: settings.activeSchoolYearId,
			activeSchoolYearLabel: settings.activeSchoolYearLabel ?? null,
			schoolId,
			source: 'enrollpro',
			stale: false,
			cachedAt: updated?.cachedAt ?? new Date().toISOString(),
			activeTerm: null,
		};
	} catch (error) {
		if (!allowStaleOnError || !cachedFallback) {
			throw error;
		}

		return {
			activeSchoolYearId: cachedFallback.activeSchoolYearId,
			activeSchoolYearLabel: cachedFallback.activeSchoolYearLabel,
			schoolId,
			source: 'cache',
			stale: true,
			cachedAt: cachedFallback.cachedAt,
			activeTerm: cachedFallback.activeTerm ?? null,
		};
	}
}

export function promoteActiveSchoolYearContext(options: PromotionOptions): Promise<ActiveSchoolYearContext> {
	const schoolId = assertExplicitSchoolId(options.schoolId);
	const allowStaleOnError = options?.allowStaleOnError !== false;
	const allowEnrollProFallback = options?.allowEnrollProFallback !== false;
	const verifyUpstream = options?.verifyUpstream === true;
	const cached = readCachedActiveSchoolYear(schoolId);
	const inflightKey = schoolYearContextProfileKey(schoolId, verifyUpstream, allowEnrollProFallback, allowStaleOnError);

	const existingInflight = inflightBySchool.get(inflightKey);
	if (existingInflight) {
		return existingInflight;
	}

	const inflight = _fetchRuntimeContext(schoolId, allowEnrollProFallback, allowStaleOnError, cached, verifyUpstream)
		.finally(() => { inflightBySchool.delete(inflightKey); });
	inflightBySchool.set(inflightKey, inflight);

	return inflight;
}
