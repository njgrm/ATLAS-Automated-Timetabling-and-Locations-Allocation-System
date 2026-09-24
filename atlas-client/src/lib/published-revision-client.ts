import atlasApi from '@/lib/api';
import type { PublishedEffectiveIdentityReadResponse, PublishedRevisionIdentityOverrides } from '@/types';
import type { PublishedRevisionPreview } from '@/lib/published-revision-clashes';

/**
 * Client contract for the published-revision read + create pair.
 *
 * The server read contract exposes the authoritative latest revision token
 * (`latestRevisionId`). Every real revision-creation flow must read that token
 * immediately before posting and bind it as `sourceRevisionId`. A stale or
 * concurrent token fails closed with `SOURCE_REVISION_STALE`; the client never
 * silently retries, substitutes a token, or fabricates a revision.
 *
 * S4-client / D4 — the same contract now carries the optional effective-dated
 * `identityOverrides` (transported under `metadata.identityOverrides`), the
 * bounded reason-required withdraw action, and the effective-identity read. The
 * server owns validation; the client never invents or repairs an override.
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

export type RevisionCreateResult = {
	revision: { id: number; effectiveDate: string; status?: string };
	auditId: number;
	replayed: boolean;
};

export type RevisionWithdrawResult = {
	revision: { id: number; status: string; effectiveDate: string };
	auditId: number;
	replayed: boolean;
};

export const SOURCE_REVISION_STALE = 'SOURCE_REVISION_STALE';
export const IDENTITY_OVERRIDES_METADATA_KEY = 'identityOverrides';

/** The typed server failures the revision UX must surface honestly. */
export type PublishedRevisionErrorCode =
	| 'SOURCE_REVISION_STALE'
	| 'PUBLISHED_IDENTITY_OVERRIDE_INVALID'
	| 'PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT'
	| 'PUBLISHED_REVISION_IDENTITY_BASE_UNAVAILABLE'
	| 'REVISION_REASON_REQUIRED'
	| 'REVISION_REASON_TOO_LONG'
	| 'REVISION_CHANGES_REQUIRED'
	| 'CROSS_SCHOOL_DENIED'
	| 'FORBIDDEN'
	| 'PUBLISHED_REVISION_BASE_IMMUTABLE'
	| 'PUBLISHED_REVISION_NOT_WITHDRAWABLE'
	| 'PUBLISHED_REVISION_NOT_FOUND'
	| 'PUBLISHED_REVISION_STATE_AMBIGUOUS';

export class SourceRevisionStaleError extends Error {
	code = SOURCE_REVISION_STALE;

	constructor(message = 'The published schedule changed while this revision was being prepared. Refresh the timetable and try again.') {
		super(message);
		this.name = 'SourceRevisionStaleError';
	}
}

export class RevisionWithdrawReasonRequiredError extends Error {
	code = 'REVISION_REASON_REQUIRED';

	constructor(message = 'A withdrawal reason is required and must be 500 characters or fewer.') {
		super(message);
		this.name = 'RevisionWithdrawReasonRequiredError';
	}
}

export function isSourceRevisionStaleError(error: unknown): boolean {
	return isPublishedRevisionErrorCode(error, SOURCE_REVISION_STALE);
}

/** Reads the server error `code` from a service throw or an axios transport error. */
export function extractServerErrorCode(error: unknown): string | null {
	if (!error || typeof error !== 'object') return null;
	const direct = (error as { code?: unknown }).code;
	if (typeof direct === 'string' && direct.length > 0) return direct;
	const responseData = (error as { response?: { data?: { code?: unknown } } }).response?.data;
	return typeof responseData?.code === 'string' && responseData.code.length > 0 ? responseData.code : null;
}

export function isPublishedRevisionErrorCode(error: unknown, code: PublishedRevisionErrorCode): boolean {
	return extractServerErrorCode(error) === code;
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

/**
 * Normalises an optional identity-override payload for `metadata`. Returns `null`
 * when no override was supplied. The server validates the exact shape; an empty
 * object is treated as "no override" so the client never attaches a no-op delta.
 */
export function normalizeIdentityOverrides(
	overrides: PublishedRevisionIdentityOverrides | null | undefined,
): Record<string, unknown> | null {
	if (!overrides || typeof overrides !== 'object') return null;
	const entries = Object.entries(overrides).filter(([, value]) => value !== undefined && value !== null);
	if (entries.length === 0) return null;
	return Object.fromEntries(entries);
}

/** Builds the revision-creation body bound to the supplied latest revision token. */
export function buildRevisionCreatePayload(input: {
	effectiveDate: string;
	reason: string;
	sourceRevisionId: number;
	changes: RevisionPayloadChange[];
	changeSummary?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
	/** Optional effective-dated identity delta attached under `metadata.identityOverrides`. */
	identityOverrides?: PublishedRevisionIdentityOverrides | null;
}): RevisionCreatePayload {
	const identityOverrides = normalizeIdentityOverrides(input.identityOverrides);
	const metadata = identityOverrides
		? { ...(input.metadata ?? {}), [IDENTITY_OVERRIDES_METADATA_KEY]: identityOverrides }
		: (input.metadata ?? null);
	return {
		effectiveDate: input.effectiveDate,
		reason: input.reason,
		sourceRevisionId: input.sourceRevisionId,
		changes: input.changes,
		changeSummary: input.changeSummary ?? null,
		metadata,
	};
}

/**
 * Validates a withdrawal reason locally so an operator never dispatches a request
 * the server will reject for a missing reason. The server re-enforces the same
 * rule (typed 400 `REVISION_REASON_REQUIRED`).
 */
export function buildWithdrawPayload(input: { reason: string | null | undefined }): { reason: string } {
	const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
	if (!reason || reason.length > 500) {
		throw new RevisionWithdrawReasonRequiredError();
	}
	return { reason };
}

/**
 * Bounded, reason-required withdraw/supersede through the integrated S4-server
 * route. The immutable base revision can never be withdrawn; the server returns a
 * typed 409 `PUBLISHED_REVISION_BASE_IMMUTABLE` for that attempt.
 */
export async function withdrawPublishedRevision(input: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	revisionId: number;
	reason: string | null | undefined;
}): Promise<RevisionWithdrawResult> {
	const body = buildWithdrawPayload({ reason: input.reason });
	const { data } = await atlasApi.post<RevisionWithdrawResult>(
		`/generation/${input.schoolId}/${input.schoolYearId}/runs/${input.runId}/published-revisions/${input.revisionId}/withdraw`,
		body,
	);
	return data;
}

/**
 * Read-only D4 effective-identity read. The server applies the base freeze then
 * every already-effective scheduled `identityOverrides` in effective-date order
 * at `asOf`; the base revision bytes are never mutated.
 */
export async function fetchEffectivePublishedIdentitySnapshot(input: {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	asOf?: string | null;
}): Promise<PublishedEffectiveIdentityReadResponse> {
	const { data } = await atlasApi.get<PublishedEffectiveIdentityReadResponse>(
		`/generation/${input.schoolId}/${input.schoolYearId}/runs/${input.runId}/published-revisions/effective-identity`,
		{ params: input.asOf ? { asOf: input.asOf } : undefined },
	);
	return data;
}

/** Truthful display label for an identity-override field, or the raw key. */
export function identityOverrideFieldLabel(field: string): string {
	switch (field) {
		case 'orderedTermContract': return 'Ordered term authority';
		case 'specialEvents': return 'Special events';
		case 'displaySlots': return 'Display slots';
		case 'policy': return 'Scheduling policy';
		case 'classProgramSlots': return 'Class-program template';
		default: return field;
	}
}

/**
 * The operator sentence for a typed revision/w withdraw failure. Unknown failures
 * return a generic honest sentence rather than a fabricated cause.
 */
export function describePublishedRevisionFailure(error: unknown): string {
	switch (extractServerErrorCode(error)) {
		case 'SOURCE_REVISION_STALE':
			return 'The published schedule changed while you were preparing this. Refresh the timetable and try again.';
		case 'PUBLISHED_IDENTITY_OVERRIDE_INVALID':
			return 'The identity change is not in a supported shape. Review it and try again.';
		case 'PUBLISHED_IDENTITY_OVERRIDE_INCONSISTENT':
			return 'The identity change contradicts the frozen published schedule (special events do not match the display slots). Correct it and try again.';
		case 'PUBLISHED_REVISION_IDENTITY_BASE_UNAVAILABLE':
			return 'This published run has no frozen identity snapshot, so an identity change cannot be attached.';
		case 'REVISION_REASON_REQUIRED':
			return 'A withdrawal reason is required.';
		case 'REVISION_REASON_TOO_LONG':
			return 'The withdrawal reason must be 500 characters or fewer.';
		case 'CROSS_SCHOOL_DENIED':
			return 'You can only change your own school\'s published schedule.';
		case 'FORBIDDEN':
			return 'Your role cannot change published schedules.';
		case 'PUBLISHED_REVISION_BASE_IMMUTABLE':
			return 'The original publication cannot be withdrawn or superseded.';
		case 'PUBLISHED_REVISION_NOT_WITHDRAWABLE':
			return 'Only a scheduled revision can be withdrawn.';
		default:
			return 'The revision was not saved. Check the values and try again.';
	}
}

type RevisionScope = { schoolId: number; schoolYearId: number; runId: number };

function revisionsPath(scope: RevisionScope): string {
	return `/generation/${scope.schoolId}/${scope.schoolYearId}/runs/${scope.runId}/published-revisions`;
}

/**
 * LANE-C POST-PUBLISH-C01 — dry run of a published revision. The server runs the
 * exact checks the create path runs and returns the blocking clashes with zero
 * writes; effective date and reason are optional so the check can run before the
 * user picks them.
 */
export async function previewPublishedRevision(
	scope: RevisionScope,
	input: { sourceRevisionId: number; changes: RevisionPayloadChange[]; effectiveDate?: string; reason?: string },
): Promise<PublishedRevisionPreview> {
	const { data } = await atlasApi.post<PublishedRevisionPreview>(`${revisionsPath(scope)}/preview`, input);
	return data;
}

/** Dry run of a published swap: the same two-class time exchange, zero writes. */
export async function previewPublishedSwap(
	scope: RevisionScope,
	input: { sourceRevisionId: number; entryIdA: string; entryIdB: string; effectiveDate?: string },
): Promise<PublishedRevisionPreview> {
	const { data } = await atlasApi.post<PublishedRevisionPreview>(`${revisionsPath(scope)}/swap/preview`, input);
	return data;
}

/** Schedules a published swap as an effective-dated revision (the supported swap path for published runs). */
export async function createPublishedSwapRevision(
	scope: RevisionScope,
	input: { sourceRevisionId: number; entryIdA: string; entryIdB: string; effectiveDate: string; reason: string },
): Promise<RevisionCreateResult> {
	const { data } = await atlasApi.post<RevisionCreateResult>(`${revisionsPath(scope)}/swap`, input);
	return data;
}
