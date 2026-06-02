const FACULTY_CACHE_PREFIX = 'atlas:faculty-offline:v1';

type CacheEnvelope<T> = {
	cachedAt: string;
	data: T;
};

export type CachedSnapshot<T> = {
	cachedAt: string;
	data: T;
	stale: boolean;
};

export function buildFacultyCacheKey(scope: string, ...parts: Array<string | number | null | undefined>): string {
	const normalizedParts = parts
		.filter((part) => part !== null && part !== undefined)
		.map((part) => String(part).trim())
		.filter((part) => part.length > 0);
	return `${FACULTY_CACHE_PREFIX}:${scope}${normalizedParts.length ? `:${normalizedParts.join(':')}` : ''}`;
}

function isStale(cachedAtIso: string, maxAgeMs: number | null | undefined): boolean {
	if (maxAgeMs === null || maxAgeMs === undefined) return false;
	const cachedAtMs = new Date(cachedAtIso).getTime();
	if (!Number.isFinite(cachedAtMs)) return true;
	return Date.now() - cachedAtMs > maxAgeMs;
}

export function readFacultySnapshot<T>(
	key: string,
	options?: {
		maxAgeMs?: number | null;
		validate?: (value: unknown) => value is T;
	},
): CachedSnapshot<T> | null {
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

export function readLatestFacultySnapshotByPrefix<T>(
	prefix: string,
	options?: {
		maxAgeMs?: number | null;
		validate?: (value: unknown) => value is T;
	},
): CachedSnapshot<T> | null {
	try {
		const normalizedPrefix = prefix.endsWith(':') ? prefix : `${prefix}:`;
		let latest: CachedSnapshot<T> | null = null;
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (key !== prefix && !key?.startsWith(normalizedPrefix)) continue;
			const snapshot = readFacultySnapshot<T>(key, options);
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

export function removeFacultySnapshotsByPrefix(prefix: string): number {
	try {
		const normalizedPrefix = prefix.endsWith(':') ? prefix : `${prefix}:`;
		const keysToRemove: string[] = [];
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index);
			if (key === prefix || key?.startsWith(normalizedPrefix)) {
				keysToRemove.push(key);
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
		return keysToRemove.length;
	} catch {
		return 0;
	}
}

export function writeFacultySnapshot<T>(key: string, data: T): void {
	try {
		const payload: CacheEnvelope<T> = {
			cachedAt: new Date().toISOString(),
			data,
		};
		localStorage.setItem(key, JSON.stringify(payload));
	} catch {
		// Ignore storage failures.
	}
}

export function isLikelyOfflineError(error: unknown): boolean {
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
