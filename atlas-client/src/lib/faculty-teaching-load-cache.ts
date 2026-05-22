import type {
	FacultySummary,
	SectionSummaryResponse,
	Subject,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
} from '@/types';
import type { SubjectSectionOwnershipIndexEntry } from '@/lib/faculty-assignment-helpers';

const FACULTY_SUMMARY_CACHE_PREFIX = 'atlas:faculty-summary:v2';
const SUBJECTS_CACHE_PREFIX = 'atlas:subjects:v1';
const SECTION_SUMMARY_CACHE_PREFIX = 'atlas:section-summary:v1';

type CacheEnvelope<T> = {
	cachedAt: string;
	data: T;
};

export type CachedResult<T> = {
	cachedAt: string;
	data: T;
	stale: boolean;
};

export type FacultySummarySnapshot = {
	faculty: FacultySummary[];
	ownershipIndex: SubjectSectionOwnershipIndexEntry[];
	coverageTotals?: TeachingLoadCoverageTotals;
	integrityDiagnostics?: TeachingLoadIntegrityDiagnostics;
	fetchedAt: string | null;
	schoolYearId: number;
};

function readCached<T>(key: string): CacheEnvelope<T> | null {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CacheEnvelope<T>;
		if (!parsed || !parsed.cachedAt || !('data' in parsed)) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function writeCached<T>(key: string, data: T): void {
	try {
		const envelope: CacheEnvelope<T> = {
			cachedAt: new Date().toISOString(),
			data,
		};
		localStorage.setItem(key, JSON.stringify(envelope));
	} catch {
		// Ignore storage restrictions.
	}
}

function isStale(cachedAtIso: string, maxAgeMs: number | null): boolean {
	if (maxAgeMs === null) return false;
	const cachedAtMs = new Date(cachedAtIso).getTime();
	if (!Number.isFinite(cachedAtMs)) return true;
	return Date.now() - cachedAtMs > maxAgeMs;
}

function summaryCacheKey(schoolId: number, schoolYearId: number): string {
	return `${FACULTY_SUMMARY_CACHE_PREFIX}:${schoolId}:${schoolYearId}`;
}

function subjectsCacheKey(schoolId: number): string {
	return `${SUBJECTS_CACHE_PREFIX}:${schoolId}`;
}

function sectionSummaryCacheKey(schoolId: number, schoolYearId: number): string {
	return `${SECTION_SUMMARY_CACHE_PREFIX}:${schoolId}:${schoolYearId}`;
}

export function getCachedFacultyAssignmentsSummary(
	schoolId: number,
	schoolYearId: number,
	options?: { maxAgeMs?: number | null },
): CachedResult<FacultySummarySnapshot> | null {
	const maxAgeMs = options?.maxAgeMs ?? null;
	const cached = readCached<FacultySummarySnapshot>(summaryCacheKey(schoolId, schoolYearId));
	if (!cached) return null;
	return {
		cachedAt: cached.cachedAt,
		data: cached.data,
		stale: isStale(cached.cachedAt, maxAgeMs),
	};
}

export function setCachedFacultyAssignmentsSummary(schoolId: number, schoolYearId: number, data: FacultySummarySnapshot): void {
	writeCached(summaryCacheKey(schoolId, schoolYearId), data);
}

export function getCachedSubjects(schoolId: number, options?: { maxAgeMs?: number | null }): CachedResult<Subject[]> | null {
	const maxAgeMs = options?.maxAgeMs ?? null;
	const cached = readCached<Subject[]>(subjectsCacheKey(schoolId));
	if (!cached) return null;
	return {
		cachedAt: cached.cachedAt,
		data: cached.data,
		stale: isStale(cached.cachedAt, maxAgeMs),
	};
}

export function setCachedSubjects(schoolId: number, subjects: Subject[]): void {
	writeCached(subjectsCacheKey(schoolId), subjects);
}

export function getCachedSectionSummary(
	schoolId: number,
	schoolYearId: number,
	options?: { maxAgeMs?: number | null },
): CachedResult<SectionSummaryResponse> | null {
	const maxAgeMs = options?.maxAgeMs ?? null;
	const cached = readCached<SectionSummaryResponse>(sectionSummaryCacheKey(schoolId, schoolYearId));
	if (!cached) return null;
	return {
		cachedAt: cached.cachedAt,
		data: cached.data,
		stale: isStale(cached.cachedAt, maxAgeMs),
	};
}

export function setCachedSectionSummary(schoolId: number, schoolYearId: number, summary: SectionSummaryResponse): void {
	writeCached(sectionSummaryCacheKey(schoolId, schoolYearId), summary);
}

export async function requestWithRetry<T>(
	operation: () => Promise<T>,
	options?: { attempts?: number; delayMs?: number },
): Promise<T> {
	const attempts = Math.max(1, options?.attempts ?? 2);
	const baseDelayMs = Math.max(0, options?.delayMs ?? 350);

	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			if (attempt >= attempts) break;
			await new Promise((resolve) => window.setTimeout(resolve, baseDelayMs * attempt));
		}
	}

	throw lastError;
}
