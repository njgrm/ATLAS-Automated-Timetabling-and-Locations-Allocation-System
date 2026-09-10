import atlasApi from '@/lib/api';

/**
 * Client contract for the published-revision read + create pair.
 *
 * The server read contract exposes the authoritative latest revision token
 * (`latestRevisionId`). Every real revision-creation flow must read that token
 * immediately before posting and bind it as `sourceRevisionId`. A stale or
 * concurrent token fails closed with `SOURCE_REVISION_STALE`; the client never
 * silently retries, substitutes a token, or fabricates a revision.
 */

export type PublishedRevisionListResponse = {
	revisions: Array<{ id: number }>;
	count: number;
	latestRevisionId?: number;
	baseRevisionId?: number;
};

export type RevisionPayloadChange = {
	entryId: string;
	changeType?: string;
	previous: Record<string, unknown>;
	next: Record<string, unknown>;
};

export type RevisionCreatePayload = {
	effectiveDate: string;
	reason: string;
	sourceRevisionId: number;
	changes: RevisionPayloadChange[];
	changeSummary: Record<string, unknown> | null;
	metadata: Record<string, unknown> | null;
};

export const SOURCE_REVISION_STALE = 'SOURCE_REVISION_STALE';

export class SourceRevisionStaleError extends Error {
	code = SOURCE_REVISION_STALE;

	constructor(message = 'The published schedule changed while this revision was being prepared. Refresh the timetable and try again.') {
		super(message);
		this.name = 'SourceRevisionStaleError';
	}
}

export function isSourceRevisionStaleError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	if ((error as { code?: unknown }).code === SOURCE_REVISION_STALE) return true;
	const responseData = (error as { response?: { data?: { code?: unknown } } }).response?.data;
	return responseData?.code === SOURCE_REVISION_STALE;
}

/** Validates the read-contract response and returns the authoritative latest revision token. */
export function parseLatestRevisionToken(data: PublishedRevisionListResponse | undefined | null): number {
	const latestRevisionId = data?.latestRevisionId;
	if (typeof latestRevisionId !== 'number' || !Number.isInteger(latestRevisionId) || latestRevisionId < 1) {
		throw new SourceRevisionStaleError();
	}
	return latestRevisionId;
}

/** Reads the authoritative latest revision token from the server read contract. */
export async function fetchLatestRevisionToken(schoolId: number, schoolYearId: number, runId: number): Promise<number> {
	const { data } = await atlasApi.get<PublishedRevisionListResponse>(
		`/generation/${schoolId}/${schoolYearId}/runs/${runId}/published-revisions`,
	);
	return parseLatestRevisionToken(data);
}

/** Builds the revision-creation body bound to the supplied latest revision token. */
export function buildRevisionCreatePayload(input: {
	effectiveDate: string;
	reason: string;
	sourceRevisionId: number;
	changes: RevisionPayloadChange[];
	changeSummary?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
}): RevisionCreatePayload {
	return {
		effectiveDate: input.effectiveDate,
		reason: input.reason,
		sourceRevisionId: input.sourceRevisionId,
		changes: input.changes,
		changeSummary: input.changeSummary ?? null,
		metadata: input.metadata ?? null,
	};
}