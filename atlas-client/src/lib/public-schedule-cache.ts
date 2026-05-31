const PUBLIC_SCHEDULE_CACHE_PREFIX = 'atlas:public-schedule:v1';

type CacheEnvelope<T> = {
	cachedAt: string;
	data: T;
};

export type CachedPublicScheduleSnapshot<T> = {
	cachedAt: string;
	data: T;
	stale: boolean;
};

function isStale(cachedAtIso: string, maxAgeMs: number | null | undefined): boolean {
	if (maxAgeMs === null || maxAgeMs === undefined) return false;
	const cachedAtMs = new Date(cachedAtIso).getTime();
	if (!Number.isFinite(cachedAtMs)) return true;
	return Date.now() - cachedAtMs > maxAgeMs;
}

function cachePart(value: string | number | null | undefined): string {
	const normalized = String(value ?? 'current')
		.trim()
		.replace(/[^A-Za-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized || 'current';
}

export function buildPublicScheduleCacheKey(schoolId: number, requestedDate?: string | null, marker?: string): string {
	const base = `${PUBLIC_SCHEDULE_CACHE_PREFIX}:school:${schoolId}:date:${cachePart(requestedDate)}`;
	return marker ? `${base}:${cachePart(marker)}` : base;
}

export function readPublicScheduleSnapshot<T>(
	key: string,
	options?: {
		maxAgeMs?: number | null;
		validate?: (value: unknown) => value is T;
	},
): CachedPublicScheduleSnapshot<T> | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;

		const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
		if (!parsed || typeof parsed.cachedAt !== 'string' || !('data' in parsed)) {
			return null;
		}

		if (options?.validate && !options.validate(parsed.data)) {
			return null;
		}

		return {
			cachedAt: parsed.cachedAt,
			data: parsed.data as T,
			stale: isStale(parsed.cachedAt, options?.maxAgeMs ?? null),
		};
	} catch {
		return null;
	}
}

export function readLatestPublicScheduleSnapshotByPrefix<T>(
	prefix: string,
	options?: {
		maxAgeMs?: number | null;
		validate?: (value: unknown) => value is T;
	},
): CachedPublicScheduleSnapshot<T> | null {
	try {
		const normalizedPrefix = prefix.endsWith(':') ? prefix : `${prefix}:`;
		let latest: CachedPublicScheduleSnapshot<T> | null = null;
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (!key?.startsWith(normalizedPrefix)) continue;
			const snapshot = readPublicScheduleSnapshot<T>(key, options);
			if (!snapshot) continue;
			if (!latest || new Date(snapshot.cachedAt).getTime() > new Date(latest.cachedAt).getTime()) {
				latest = snapshot;
			}
		}
		return latest;
	} catch {
		return null;
	}
}

export function writePublicScheduleSnapshot<T>(key: string, data: T): void {
	try {
		const payload: CacheEnvelope<T> = {
			cachedAt: new Date().toISOString(),
			data,
		};
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {
		// Ignore storage restrictions.
	}
}

export function isLikelyOfflinePublicError(error: unknown): boolean {
	if (!navigator.onLine) return true;
	if (!error || typeof error !== 'object') return false;
	const candidate = error as {
		response?: unknown;
		code?: string;
		message?: string;
	};
	if (candidate.response) return false;
	if (candidate.code === 'ERR_NETWORK') return true;
	if (typeof candidate.message === 'string') {
		return /network|failed to fetch|timeout/i.test(candidate.message);
	}
	return false;
}
