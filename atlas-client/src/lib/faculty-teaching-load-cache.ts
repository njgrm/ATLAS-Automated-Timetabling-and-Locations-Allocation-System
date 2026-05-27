import type {
	SubjectSectionOwnershipIndexEntry,
	FacultySummary,
	RotationFamilyLoadDetail,
	SectionSummaryResponse,
	Subject,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
} from '@/types';

const FACULTY_SUMMARY_CACHE_PREFIX = 'atlas:faculty-summary:v3';
const SUBJECTS_CACHE_PREFIX = 'atlas:subjects:v1';
const SECTION_SUMMARY_CACHE_PREFIX = 'atlas:section-summary:v1';
const SECTION_HOME_ROOMS_CACHE_PREFIX = 'atlas:section-home-rooms:v1';

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

function toNumber(value: unknown, fallback = 0): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : [];
}

function isRotationFamilyLoadDetail(value: unknown): value is RotationFamilyLoadDetail {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Partial<RotationFamilyLoadDetail>;
	return (
		typeof candidate.family === 'string'
		&& typeof candidate.rawHours === 'number'
		&& typeof candidate.creditedHours === 'number'
		&& typeof candidate.overcountHours === 'number'
		&& typeof candidate.unitCount === 'number'
		&& Array.isArray(candidate.subjectCodes)
		&& Array.isArray(candidate.subjectIds)
	);
}

function normalizeCoverageTotals(value: unknown): TeachingLoadCoverageTotals | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const candidate = value as Partial<TeachingLoadCoverageTotals>;
	const totalPairs = toNumber(candidate.totalPairs);
	const realFacultyAssignedPairs = toNumber(candidate.realFacultyAssignedPairs, toNumber(candidate.assignedPairs));
	const syntheticPlaceholderPairs = toNumber(candidate.syntheticPlaceholderPairs);
	const activeAssignedPairs = toNumber(candidate.activeAssignedPairs, toNumber(candidate.assignedPairs, realFacultyAssignedPairs + syntheticPlaceholderPairs));
	const assignedPairs = activeAssignedPairs;
	const rawAssignedPairs = toNumber(candidate.rawAssignedPairs, assignedPairs);
	const unassignedPairs = toNumber(candidate.unassignedPairs, Math.max(0, totalPairs - assignedPairs));
	const rawUnassignedPairs = toNumber(candidate.rawUnassignedPairs, Math.max(0, totalPairs - rawAssignedPairs));
	return {
		assignedPairs,
		activeAssignedPairs,
		realFacultyAssignedPairs,
		syntheticPlaceholderPairs,
		rawAssignedPairs,
		totalPairs,
		unassignedPairs,
		rawUnassignedPairs,
	};
}

function normalizeIntegrityDiagnostics(value: unknown): TeachingLoadIntegrityDiagnostics | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const candidate = value as Partial<TeachingLoadIntegrityDiagnostics>;
	return {
		emptySectionRows: toNumber(candidate.emptySectionRows),
		currentYearRowsMissingOwnership: toNumber(candidate.currentYearRowsMissingOwnership),
		currentYearOwnershipWithoutMatchingScope: toNumber(candidate.currentYearOwnershipWithoutMatchingScope),
		currentYearMissingOwnershipPairs: toNumber(candidate.currentYearMissingOwnershipPairs),
		currentYearOwnershipWithoutMatchingScopePairs: toNumber(candidate.currentYearOwnershipWithoutMatchingScopePairs),
		staleOwnershipRowCount: toNumber(candidate.staleOwnershipRowCount),
		staleOwnedCurrentYearPairCount: toNumber(candidate.staleOwnedCurrentYearPairCount),
		stalePlaceholderPairCount: toNumber(candidate.stalePlaceholderPairCount),
		staleNonPlaceholderPairCount: toNumber(candidate.staleNonPlaceholderPairCount),
		emptySectionSamples: toArray(candidate.emptySectionSamples),
		missingOwnershipSamples: toArray(candidate.missingOwnershipSamples),
		ownershipWithoutScopeSamples: toArray(candidate.ownershipWithoutScopeSamples),
		staleOwnershipSamples: toArray(candidate.staleOwnershipSamples),
		quarantinedZombieCount: toNumber(candidate.quarantinedZombieCount),
		quarantinedZombieSamples: toArray(candidate.quarantinedZombieSamples),
		staleAdvisoryCount: toNumber(candidate.staleAdvisoryCount),
		staleAdvisorySamples: toArray(candidate.staleAdvisorySamples),
	};
}

export function normalizeFacultySummarySnapshot(value: unknown): FacultySummarySnapshot | null {
	if (!value || typeof value !== 'object') return null;
	const candidate = value as Partial<FacultySummarySnapshot>;
	const schoolYearId = Number(candidate.schoolYearId);
	if (!Number.isFinite(schoolYearId)) return null;

	const faculty = toArray<FacultySummary>(candidate.faculty).map((row) => {
		const normalizedAssignments = toArray((row as any)?.assignments).map((assignment: any) => ({
			...assignment,
			sectionIds: toArray<number>(assignment?.sectionIds),
			gradeLevels: toArray<number>(assignment?.gradeLevels),
			sections: toArray(assignment?.sections),
		}));
		const normalizedRotationDetails = toArray((row as any)?.rotationFamilyLoadDetails).filter(isRotationFamilyLoadDetail);
		return {
			...row,
			assignments: normalizedAssignments,
			rotationFamilyLoadDetails: normalizedRotationDetails,
		};
	});

	return {
		faculty,
		ownershipIndex: toArray<SubjectSectionOwnershipIndexEntry>(candidate.ownershipIndex),
		coverageTotals: normalizeCoverageTotals(candidate.coverageTotals),
		integrityDiagnostics: normalizeIntegrityDiagnostics(candidate.integrityDiagnostics),
		fetchedAt: typeof candidate.fetchedAt === 'string' || candidate.fetchedAt === null ? candidate.fetchedAt : null,
		schoolYearId,
	};
}

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

function sectionHomeRoomsCacheKey(schoolId: number, schoolYearId: number): string {
	return `${SECTION_HOME_ROOMS_CACHE_PREFIX}:${schoolId}:${schoolYearId}`;
}

export function getCachedFacultyAssignmentsSummary(
	schoolId: number,
	schoolYearId: number,
	options?: { maxAgeMs?: number | null },
): CachedResult<FacultySummarySnapshot> | null {
	const maxAgeMs = options?.maxAgeMs ?? null;
	const cached = readCached<FacultySummarySnapshot>(summaryCacheKey(schoolId, schoolYearId));
	if (!cached) return null;
	const normalized = normalizeFacultySummarySnapshot(cached.data);
	if (!normalized) return null;
	return {
		cachedAt: cached.cachedAt,
		data: normalized,
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
	if (!Array.isArray(cached.data)) return null;
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
	if (!cached.data || typeof cached.data !== 'object' || !Array.isArray((cached.data as any).sections)) return null;
	return {
		cachedAt: cached.cachedAt,
		data: {
			...cached.data,
			sections: toArray((cached.data as any).sections),
			gradeLevels: toArray((cached.data as any).gradeLevels),
			contractWarnings: toArray((cached.data as any).contractWarnings),
		},
		stale: isStale(cached.cachedAt, maxAgeMs),
	};
}

export function setCachedSectionSummary(schoolId: number, schoolYearId: number, summary: SectionSummaryResponse): void {
	writeCached(sectionSummaryCacheKey(schoolId, schoolYearId), summary);
}

export function getCachedSectionHomeRooms<T>(
	schoolId: number,
	schoolYearId: number,
	options?: { maxAgeMs?: number | null },
): CachedResult<T[]> | null {
	const maxAgeMs = options?.maxAgeMs ?? null;
	const cached = readCached<T[]>(sectionHomeRoomsCacheKey(schoolId, schoolYearId));
	if (!cached) return null;
	if (!Array.isArray(cached.data)) return null;
	return {
		cachedAt: cached.cachedAt,
		data: cached.data,
		stale: isStale(cached.cachedAt, maxAgeMs),
	};
}

export function setCachedSectionHomeRooms<T>(schoolId: number, schoolYearId: number, rooms: T[]): void {
	writeCached(sectionHomeRoomsCacheKey(schoolId, schoolYearId), rooms);
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
