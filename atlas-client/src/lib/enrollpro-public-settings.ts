import { fetchAtlasRuntimeContext, fetchPublicSettings } from './settings';

const ACTIVE_SCHOOL_YEAR_CACHE_KEY = 'atlas:active-school-year-context:v1';
const ACTIVE_SCHOOL_YEAR_MAX_AGE_MS = 10 * 60 * 1000;

type ActiveSchoolYearCacheRecord = {
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	cachedAt: string;
};

export type ActiveSchoolYearContext = {
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	source: 'atlas' | 'enrollpro' | 'cache';
	stale: boolean;
	cachedAt: string;
};

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

export function cacheActiveSchoolYearContext(activeSchoolYearId: number | null | undefined, activeSchoolYearLabel?: string | null): void {
	if (!activeSchoolYearId || Number.isNaN(activeSchoolYearId)) {
		return;
	}

	const payload: ActiveSchoolYearCacheRecord = {
		activeSchoolYearId,
		activeSchoolYearLabel: activeSchoolYearLabel ?? null,
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

export async function resolveActiveSchoolYearContext(options?: {
	forceRefresh?: boolean;
	allowStaleOnError?: boolean;
	maxAgeMs?: number;
	allowEnrollProFallback?: boolean;
}): Promise<ActiveSchoolYearContext> {
	const forceRefresh = options?.forceRefresh === true;
	const allowStaleOnError = options?.allowStaleOnError !== false;
	const maxAgeMs = options?.maxAgeMs ?? ACTIVE_SCHOOL_YEAR_MAX_AGE_MS;
	const allowEnrollProFallback = options?.allowEnrollProFallback !== false;

	const cached = readCachedActiveSchoolYear();
	const hasFreshCache = cached ? isFresh(cached.cachedAt, maxAgeMs) : false;

	if (!forceRefresh && cached && hasFreshCache) {
		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			source: 'cache',
			stale: false,
			cachedAt: cached.cachedAt,
		};
	}

	let runtimeContextError: unknown = null;

	try {
		const runtimeContext = await fetchAtlasRuntimeContext();
		if (runtimeContext?.activeSchoolYearId) {
			cacheActiveSchoolYearContext(runtimeContext.activeSchoolYearId, runtimeContext.activeSchoolYearLabel ?? null);
			const updated = readCachedActiveSchoolYear();

			return {
				activeSchoolYearId: runtimeContext.activeSchoolYearId,
				activeSchoolYearLabel: runtimeContext.activeSchoolYearLabel ?? null,
				source: runtimeContext.source ?? 'atlas-persisted',
				stale: runtimeContext.stale,
				cachedAt: updated?.cachedAt ?? new Date().toISOString(),
			};
		}
	} catch (error) {
		runtimeContextError = error;
		// Fall through to optional EnrollPro settings fallback.
	}

	if (!allowEnrollProFallback) {
		if (!allowStaleOnError || !cached) {
			throw runtimeContextError ?? new Error('Active school-year context is unavailable from ATLAS runtime data.');
		}

		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			source: 'cache',
			stale: true,
			cachedAt: cached.cachedAt,
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
			source: 'enrollpro',
			stale: false,
			cachedAt: updated?.cachedAt ?? new Date().toISOString(),
		};
	} catch (error) {
		if (!allowStaleOnError || !cached) {
			throw error;
		}

		return {
			activeSchoolYearId: cached.activeSchoolYearId,
			activeSchoolYearLabel: cached.activeSchoolYearLabel,
			source: 'cache',
			stale: true,
			cachedAt: cached.cachedAt,
		};
	}
}
