import { fetchAtlasRuntimeContext, fetchPublicSettings } from './settings';

const ACTIVE_SCHOOL_YEAR_CACHE_KEY = 'atlas:active-school-year-context:v2';
const ACTIVE_SCHOOL_YEAR_MAX_AGE_MS = 10 * 60 * 1000;

type ActiveSchoolYearCacheRecord = {
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	activeTerm: {
		source: string;
		reachable: boolean;
		verified: boolean;
		activeTerm: string | null;
		termIndex: number | null;
		schoolYearId: number | null;
		matchedSchoolYear: boolean | null;
		code: string | null;
		message: string;
	} | null;
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
	activeTerm: {
		source: string;
		reachable: boolean;
		verified: boolean;
		activeTerm: string | null;
		termIndex: number | null;
		schoolYearId: number | null;
		matchedSchoolYear: boolean | null;
		code: string | null;
		message: string;
	} | null;
};

type PromotionOptions = {
	allowStaleOnError?: boolean;
	allowEnrollProFallback?: boolean;
};

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

let activeSchoolYearMemory: ActiveSchoolYearCacheRecord | null = null;

function readCachedActiveSchoolYear(): ActiveSchoolYearCacheRecord | null {
	if (activeSchoolYearMemory) {
		return activeSchoolYearMemory;
	}

	try {
		const raw = localStorage.getItem(ACTIVE_SCHOOL_YEAR_CACHE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ActiveSchoolYearCacheRecord;
		if (!parsed || typeof parsed.activeSchoolYearId !== 'number' || !parsed.cachedAt) {
			return null;
		}
		activeSchoolYearMemory = parsed;
		return parsed;
	} catch {
		return null;
	}
}

export function cacheActiveSchoolYearContext(
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
	activeSchoolYearMemory = payload;

	try {
		localStorage.setItem(ACTIVE_SCHOOL_YEAR_CACHE_KEY, JSON.stringify(payload));
	} catch {
		// Ignore storage restrictions.
	}
}

function isFresh(cachedAtIso: string, maxAgeMs: number): boolean {
	const cachedAtMs = new Date(cachedAtIso).getTime();
	if (!Number.isFinite(cachedAtMs)) return false;
	return Date.now() - cachedAtMs <= maxAgeMs;
}

// Deduplicate in-flight verification calls so rapid navigations don't spawn
// parallel requests for the same school.
let _inflight: Promise<ActiveSchoolYearContext> | null = null;

export async function resolveActiveSchoolYearContext(options?: {
	forceRefresh?: boolean;
	/** Return cached data immediately without waiting for upstream, even if stale. */
	preferCache?: boolean;
	/** Fire background re-verification and update the cache without blocking the caller. */
	backgroundRefresh?: boolean;
	allowStaleOnError?: boolean;
	maxAgeMs?: number;
	allowEnrollProFallback?: boolean;
}): Promise<ActiveSchoolYearContext> {
	const forceRefresh = options?.forceRefresh === true;
	const preferCache = options?.preferCache === true;
	const backgroundRefresh = options?.backgroundRefresh === true;
	const allowStaleOnError = options?.allowStaleOnError !== false;
	const maxAgeMs = options?.maxAgeMs ?? ACTIVE_SCHOOL_YEAR_MAX_AGE_MS;
	const allowEnrollProFallback = options?.allowEnrollProFallback !== false;

	const cached = readCachedActiveSchoolYear();
	const hasFreshCache = cached ? isFresh(cached.cachedAt, maxAgeMs) : false;

	// preferCache: return cached immediately (even if stale) and optionally
	// kick off a background re-verification so the next caller gets fresher data.
	if (preferCache && cached) {
		if (backgroundRefresh) {
			// Fire-and-forget — deduplicate so rapid mounts don't stack requests.
			if (!_inflight) {
				_inflight = _fetchRuntimeContext(allowEnrollProFallback, allowStaleOnError, cached)
					.finally(() => { _inflight = null; });
				void _inflight;
			}
		}
		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			schoolId: 1, // Default from cache; runtime context will correct on refresh
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
			schoolId: 1, // Default from cache; runtime context will correct on refresh
			source: 'cache',
			stale: false,
			cachedAt: cached.cachedAt,
			activeTerm: cached.activeTerm ?? null,
		};
	}

	// Deduplicate concurrent calls so a single page mount doesn't spawn
	// multiple overlapping verification requests.
	if (_inflight && !forceRefresh) {
		return _inflight;
	}
	const promise = _fetchRuntimeContext(allowEnrollProFallback, allowStaleOnError, cached);
	if (!forceRefresh) {
		_inflight = promise.finally(() => { _inflight = null; });
		return _inflight;
	}
	return promise;
}

async function _fetchRuntimeContext(
	allowEnrollProFallback: boolean,
	allowStaleOnError: boolean,
	cachedFallback: ActiveSchoolYearCacheRecord | null,
): Promise<ActiveSchoolYearContext> {

	let runtimeContextError: unknown = null;

	try {
		const runtimeContext = await fetchAtlasRuntimeContext();
		if (runtimeContext?.activeSchoolYearId) {
			cacheActiveSchoolYearContext(
				runtimeContext.activeSchoolYearId,
				runtimeContext.activeSchoolYearLabel ?? null,
				runtimeContext.activeTerm ?? null,
			);
			const updated = readCachedActiveSchoolYear();

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
			schoolId: 1, // Default for cache fallback; runtime context will correct on next refresh
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

		cacheActiveSchoolYearContext(settings.activeSchoolYearId, settings.activeSchoolYearLabel ?? null);
		const updated = readCachedActiveSchoolYear();

		return {
			activeSchoolYearId: settings.activeSchoolYearId,
			activeSchoolYearLabel: settings.activeSchoolYearLabel ?? null,
			schoolId: 1, // Default for EnrollPro fallback; runtime context will correct on next refresh
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
			schoolId: 1, // Default for stale fallback; runtime context will correct on next refresh
			source: 'cache',
			stale: true,
			cachedAt: cachedFallback.cachedAt,
			activeTerm: cachedFallback.activeTerm ?? null,
		};
	}
}

export function promoteActiveSchoolYearContext(options?: PromotionOptions): Promise<ActiveSchoolYearContext> {
	const allowStaleOnError = options?.allowStaleOnError !== false;
	const allowEnrollProFallback = options?.allowEnrollProFallback !== false;
	const cached = readCachedActiveSchoolYear();

	if (_inflight) {
		return _inflight;
	}

	_inflight = _fetchRuntimeContext(allowEnrollProFallback, allowStaleOnError, cached)
		.finally(() => { _inflight = null; });

	return _inflight;
}
