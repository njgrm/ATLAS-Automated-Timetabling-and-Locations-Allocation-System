import type { Prisma, PrismaClient, PublishedScheduleRevision } from '@prisma/client';
import { createHash } from 'node:crypto';
import { getDataContext } from '../lib/data-context.js';
import { publishPublishedScheduleEvent } from './published-schedule-events.service.js';
import { runSerializablePublicationTransaction } from './serializable-transaction-retry.js';
import { loadVerifiedOrderedTermContract, MAX_ACADEMIC_TERM_INDEX, isTermIndexWithinContract } from './academic-term.service.js';
import { VIOLATION_COPY, validateHardConstraints, type ScheduledEntry, type Violation, type ViolationCode } from './constraint-validator.js';
import { isPromotableConstraintCode } from './scheduling-policy.service.js';
import { buildValidatorCtx, loadRunContext } from './manual-edit.service.js';
import { countBlockingHardViolations } from './publication-contract.service.js';
import {
	compareGenerationInputSnapshots,
	computeGenerationInputSnapshot,
	type GenerationInputSnapshot,
} from './generation-input-snapshot.service.js';
import {
	IDENTITY_OVERRIDES_KEY,
	applyIdentityOverrides,
	readIdentityOverrides,
	readPublishedIdentitySnapshot,
	resolveEffectiveIdentitySnapshot,
	selectEffectiveIdentityOverrideRevisions,
	type PublishedIdentitySnapshot,
	type SnapshotState,
} from './published-identity-snapshot.service.js';

const db = () => getDataContext();

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

export type PublishedRevisionValueSnapshot = {
	facultyId?: number | null;
	roomId?: number | null;
	day?: string | null;
	startTime?: string | null;
	endTime?: string | null;
	subjectId?: number | null;
	sectionId?: number | null;
	[key: string]: unknown;
};

export type PublishedRevisionEntryChange = {
	entryId: string;
	changeType?: string;
	previous: PublishedRevisionValueSnapshot;
	next: PublishedRevisionValueSnapshot;
};

export type CreatePublishedScheduleRevisionInput = {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	sourceRevisionId?: number | null;
	actorId?: number | null;
	effectiveDate?: string | Date | null;
	reason?: string | null;
	changes?: PublishedRevisionEntryChange[] | null;
	changeSummary?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
};

export type CreatePublishedScheduleRevisionResult = {
	revision: PublishedScheduleRevision;
	auditId: number;
	replayed: boolean;
	notificationDelivery: 'DELIVERED' | 'FAILED_AFTER_COMMIT';
	/**
	 * PUBLISHED-REVISION-AUTHORITY-C12 — the R1 hard-constraint decision for
	 * this commit. Soft/warning violations never block; they are preserved
	 * here (and counted in the audit record) instead of being dropped. A
	 * replayed idempotent retry replays the committed decision, so it carries
	 * no fresh validation summary (`null`).
	 */
	validation: PublishedRevisionValidationSummary | null;
};

export type PublishedRevisionValidationSummary = {
	/** Blocking HARD violations under the publication gate predicate (always 0 here — a nonzero count fails closed before any write). */
	blockingHardViolationCount: number;
	/** Every HARD-severity violation, including non-promotable informational codes. */
	hardViolationCount: number;
	/** Distinct HARD-severity violation codes observed on the merged set. */
	hardCodes: string[];
	softViolationCount: number;
	softViolations: Array<{ code: string; severity: 'SOFT'; message: string }>;
};

/** One schedule entry involved in a clash, with the identities a client needs to name it. */
export type PublishedRevisionClashEntry = {
	entryId: string;
	/** True when this revision changes the entry; false for an entry the change collides with. */
	changed: boolean;
	sectionId: number | null;
	subjectId: number | null;
	facultyId: number | null;
	roomId: number | null;
	day: string | null;
	startTime: string | null;
	endTime: string | null;
	termIndex: number | null;
};

/**
 * LANE-C POST-PUBLISH-C01 — one blocking clash in operator language. `title`,
 * `meaning` and `action` come from the canonical `VIOLATION_COPY`; the raw
 * validator message (which names faculty by numeric id) is never the headline.
 */
export type PublishedRevisionClash = {
	code: string;
	title: string;
	meaning: string;
	action: string;
	facultyId: number | null;
	roomId: number | null;
	sectionId: number | null;
	day: string | null;
	startTime: string | null;
	endTime: string | null;
	entries: PublishedRevisionClashEntry[];
};

/**
 * LANE-C POST-PUBLISH-C01 — the dry-run result: the exact merged-entry
 * validation the create path would run, returned instead of thrown, with zero
 * writes. `alreadyScheduled` is true when an identical revision already exists.
 */
export type PublishedRevisionPreview = {
	changeCount: number;
	blockingHardViolationCount: number;
	hardViolationCount: number;
	softViolationCount: number;
	softViolations: PublishedRevisionValidationSummary['softViolations'];
	clashes: PublishedRevisionClash[];
	alreadyScheduled: boolean;
};

export type PublishedRevisionServiceOptions = {
	now?: Date;
	publishEvent?: (event: Parameters<typeof publishPublishedScheduleEvent>[0]) => unknown;
	/**
	 * R2 interleave seam. Defaults to the canonical
	 * `computeGenerationInputSnapshot`, whose rooms / teachingLoad
	 * (faculty qualification + ownership) / policy (scheduling policy,
	 * grade-shift windows, special events, class-program slots) / sections /
	 * subjects / derivedDemand / availability domains cover every R2 input at
	 * minimum. Tests inject a scripted stub to prove the stale-source abort
	 * deterministically.
	 */
	computeInputSnapshot?: (
		schoolId: number,
		schoolYearId: number,
		client: Prisma.TransactionClient | PrismaClient,
	) => Promise<GenerationInputSnapshot>;
};

function err(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	e.actionHint = options?.actionHint;
	e.details = options?.details;
	return e;
}

function isPositiveInteger(value: unknown): value is number {
	return Number.isInteger(value) && Number(value) > 0;
}

function isPositiveInt32(value: unknown): value is number {
	return isPositiveInteger(value) && Number(value) <= 2_147_483_647;
}

/** Syntactic term-index shape only (positive integer within the supported family). */
function isSyntacticTermIndex(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_ACADEMIC_TERM_INDEX;
}

function asSummaryRecord(summary: unknown): Record<string, unknown> {
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return {};
	return summary as Record<string, unknown>;
}

function isPublishedSummary(summary: unknown): boolean {
	// A run is published only when the current summary explicitly says so.
	// Stale `publishedAt`/`publishedBy` markers alone must never establish publication.
	return asSummaryRecord(summary).isPublished === true;
}

function sameUtcDate(left: Date, right: Date): boolean {
	return left.getUTCFullYear() === right.getUTCFullYear()
		&& left.getUTCMonth() === right.getUTCMonth()
		&& left.getUTCDate() === right.getUTCDate();
}

function parseEffectiveDate(value: string | Date | null | undefined, now: Date): Date {
	if (value == null || value === '') {
		throw err(400, 'EFFECTIVE_DATE_REQUIRED', 'Published revisions require an effective date.', {
			actionHint: 'Choose the first school day when this published revision should take effect.',
		});
	}

	const effectiveDate = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(effectiveDate.getTime())) {
		throw err(400, 'EFFECTIVE_DATE_INVALID', 'Effective date must be a valid date or ISO date string.');
	}

	if (effectiveDate.getTime() <= now.getTime()) {
		throw err(422, 'EFFECTIVE_DATE_NOT_FUTURE', 'Effective date must be later than the revision creation time.');
	}

	if (sameUtcDate(effectiveDate, now)) {
		throw err(422, 'EFFECTIVE_DATE_SAME_DAY', 'Same-day published revisions are not allowed in this workflow.', {
			actionHint: 'Choose the next school day or a later effective date.',
		});
	}

	return effectiveDate;
}

function normalizeReason(reason: string | null | undefined): string {
	const normalized = typeof reason === 'string' ? reason.trim() : '';
	if (!normalized) {
		throw err(400, 'REVISION_REASON_REQUIRED', 'Published revisions require a reason.');
	}
	if (normalized.length > 500) {
		throw err(400, 'REVISION_REASON_TOO_LONG', 'Revision reason must be 500 characters or fewer.');
	}
	return normalized;
}

function normalizeChanges(changes: PublishedRevisionEntryChange[] | null | undefined): PublishedRevisionEntryChange[] {
	if (!Array.isArray(changes) || changes.length === 0) {
		throw err(400, 'REVISION_CHANGES_REQUIRED', 'Published revisions require at least one changed entry.');
	}

	const normalized = changes.map((change, index) => {
		const entryId = typeof change?.entryId === 'string' ? change.entryId.trim() : '';
		if (!entryId) {
			throw err(400, 'REVISION_CHANGE_ENTRY_REQUIRED', `Revision change ${index + 1} must include an entryId.`);
		}
		if (!change.previous || typeof change.previous !== 'object' || Array.isArray(change.previous)) {
			throw err(400, 'REVISION_PREVIOUS_VALUES_REQUIRED', `Revision change ${entryId} must include previous values.`);
		}
		if (!change.next || typeof change.next !== 'object' || Array.isArray(change.next)) {
			throw err(400, 'REVISION_NEW_VALUES_REQUIRED', `Revision change ${entryId} must include new values.`);
		}
		const allowedFields = new Set(['facultyId', 'roomId', 'day', 'startTime', 'endTime', 'subjectId', 'sectionId', 'termIndex']);
		const unknownFields = [...Object.keys(change.previous), ...Object.keys(change.next)].filter((field) => !allowedFields.has(field));
		if (unknownFields.length > 0) {
			throw err(400, 'REVISION_CHANGE_FIELD_INVALID', `Revision change ${entryId} contains unsupported fields.`, { details: { entryId, unknownFields } });
		}
		if (change.next.termIndex !== undefined && !isSyntacticTermIndex(change.next.termIndex)) {
			throw err(400, 'REVISION_TERM_INDEX_INVALID', `Revision change ${entryId} must use a supported integer termIndex 1..${MAX_ACADEMIC_TERM_INDEX}.`);
		}
		const nextFields = Object.keys(change.next);
		if (nextFields.length === 0 || nextFields.some((field) => !Object.prototype.hasOwnProperty.call(change.previous, field))) {
			throw err(400, 'REVISION_PREVIOUS_VALUES_INCOMPLETE', `Revision change ${entryId} must include the current previous value for every changed field.`);
		}
		for (const [field, value] of [...Object.entries(change.previous), ...Object.entries(change.next)]) {
			if (['facultyId', 'roomId'].includes(field) && value !== null && (!Number.isInteger(value) || Number(value) < 1)) throw err(400, 'REVISION_CHANGE_VALUE_INVALID', `${field} must be a positive integer or null.`);
			if (['subjectId', 'sectionId'].includes(field) && (!Number.isInteger(value) || Number(value) < 1)) throw err(400, 'REVISION_CHANGE_VALUE_INVALID', `${field} must be a positive integer.`);
			if (field === 'day' && (typeof value !== 'string' || !['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(value))) throw err(400, 'REVISION_CHANGE_VALUE_INVALID', 'day must be a school weekday.');
			if (['startTime', 'endTime'].includes(field) && (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))) throw err(400, 'REVISION_CHANGE_VALUE_INVALID', `${field} must use HH:mm.`);
			// Syntactic only here; the exact-contract range is enforced inside the
			// serializable transaction against the verified ordered-term authority.
			if (field === 'termIndex' && !isSyntacticTermIndex(value)) throw err(400, 'REVISION_TERM_INDEX_INVALID', `Revision change ${entryId} must use a supported integer termIndex 1..${MAX_ACADEMIC_TERM_INDEX}.`);
		}

		return {
			entryId,
			changeType: typeof change.changeType === 'string' && change.changeType.trim()
				? change.changeType.trim()
				: 'PUBLISHED_REPAIR',
			previous: change.previous,
			next: change.next,
		};
	});
	const entryIds = normalized.map((change) => change.entryId);
	if (new Set(entryIds).size !== entryIds.length) {
		throw err(400, 'REVISION_CHANGE_DUPLICATE_ENTRY', 'Each entryId may appear only once in a published revision.');
	}
	return normalized;
}

function buildValueSnapshot(changes: PublishedRevisionEntryChange[], side: 'previous' | 'next') {
	return changes.map((change) => ({
		entryId: change.entryId,
		values: change[side],
	}));
}

function minutesBetweenTimes(start: string, end: string): number | null {
	if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end)) return null;
	const [startHour, startMinute] = start.split(':').map(Number);
	const [endHour, endMinute] = end.split(':').map(Number);
	return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

/**
 * PUBLISHED-REVISION-AUTHORITY-C12 (R1) — apply one revision `next` snapshot
 * onto a stored entry. `durationMinutes` is recomputed from the merged
 * interval (the same derivation the manual-swap path uses) so the validator
 * sees the true merged duration rather than a stale stored value.
 */
function applyRevisionNextToEntry(
	base: Record<string, unknown>,
	next: PublishedRevisionValueSnapshot,
): Record<string, unknown> {
	const merged = { ...base, ...next };
	if (typeof merged.startTime === 'string' && typeof merged.endTime === 'string') {
		const minutes = minutesBetweenTimes(merged.startTime, merged.endTime);
		if (minutes !== null && minutes > 0) merged.durationMinutes = minutes;
	}
	return merged;
}

function toValidationSummary(
	violations: Array<{ code: string; severity: 'HARD' | 'SOFT'; message: string }>,
	blockingHardViolationCount: number,
): PublishedRevisionValidationSummary {
	const hard = violations.filter((violation) => violation.severity === 'HARD');
	return {
		blockingHardViolationCount,
		hardViolationCount: hard.length,
		hardCodes: [...new Set(hard.map((violation) => violation.code))].sort(),
		softViolationCount: violations.filter((violation) => violation.severity === 'SOFT').length,
		softViolations: violations
			.filter((violation) => violation.severity === 'SOFT')
			.map((violation) => ({ code: violation.code, severity: 'SOFT' as const, message: violation.message })),
	};
}

const MAX_REPORTED_CLASHES = 50;

function numberOrNull(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * LANE-C POST-PUBLISH-C01 — the blocking HARD violations (the publication-gate
 * predicate: HARD severity AND promotable code) as operator-language clashes,
 * each naming the merged entries it involves so a client can say which
 * teacher, section, room and time collide.
 */
function buildRevisionClashes(
	violations: Violation[],
	mergedEntriesById: Map<string, Record<string, unknown>>,
	changedEntryIds: Set<string>,
): PublishedRevisionClash[] {
	return violations
		.filter((violation) => violation.severity === 'HARD' && isPromotableConstraintCode(violation.code))
		.slice(0, MAX_REPORTED_CLASHES)
		.map((violation) => {
			const copy = VIOLATION_COPY[violation.code as ViolationCode];
			const entities = violation.entities ?? {};
			const entryIds = Array.isArray(entities.entryIds) ? entities.entryIds : [];
			return {
				code: violation.code,
				title: copy?.title ?? 'Schedule conflict',
				meaning: copy?.meaning ?? '',
				action: copy?.action ?? '',
				facultyId: numberOrNull(entities.facultyId),
				roomId: numberOrNull(entities.roomId),
				sectionId: numberOrNull(entities.sectionId),
				day: stringOrNull(entities.day),
				startTime: stringOrNull(entities.startTime),
				endTime: stringOrNull(entities.endTime),
				entries: entryIds.map((entryId) => {
					const entry = mergedEntriesById.get(entryId) ?? {};
					return {
						entryId,
						changed: changedEntryIds.has(entryId),
						sectionId: numberOrNull(entry.sectionId),
						subjectId: numberOrNull(entry.subjectId),
						facultyId: numberOrNull(entry.facultyId),
						roomId: numberOrNull(entry.roomId),
						day: stringOrNull(entry.day),
						startTime: stringOrNull(entry.startTime),
						endTime: stringOrNull(entry.endTime),
						termIndex: numberOrNull(entry.termIndex),
					};
				}),
			};
		});
}

/** The first moment of the next UTC day: the earliest date the create path accepts. */
function nextUtcDay(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

type AuthoritativeLatestRevision = {
	baseRevisionId: number;
	latestRevisionId: number;
	sourceRunVersion: number;
	publishedAt: string | null;
	baseRevision: {
		id: number;
		effectiveDate: Date;
		sourceRevisionId: number | null;
		reason: string;
		metadata: unknown;
	};
	latestRevision: { id: number; effectiveDate: Date; changeSet: unknown } | null;
	revisionChain: Array<{ id: number; effectiveDate: Date; changeSet: unknown; status: string; metadata: unknown }>;
};

/**
 * The single authoritative resolution of the latest published revision for a
 * source run. Both the create path (inside its serializable advisory-locked
 * transaction) and the read contract use this so the exposed latest revision
 * token can never diverge from the token the write contract enforces.
 */
async function resolveAuthoritativeLatestRevision(
	client: Prisma.TransactionClient | PrismaClient,
	params: { schoolId: number; schoolYearId: number; sourceRunId: number },
): Promise<AuthoritativeLatestRevision> {
	const sourceRun = await client.generationRun.findFirst({
		where: { id: params.sourceRunId, schoolId: params.schoolId, schoolYearId: params.schoolYearId },
		select: { id: true, status: true, runType: true, summary: true, version: true },
	});
	if (!sourceRun) throw err(404, 'SOURCE_RUN_NOT_FOUND', 'Source generation run was not found in this school/year scope.');
	const publication = asSummaryRecord(asSummaryRecord(sourceRun.summary).publication);
	if (sourceRun.status !== 'COMPLETED' || sourceRun.runType !== 'FULL' || !isPublishedSummary(sourceRun.summary)
		|| Number(publication.sourceRunVersion) !== sourceRun.version) {
		throw err(422, 'PUBLISHED_SOURCE_REQUIRED', 'Published revisions require the exact current official published source run.', {
			details: { sourceRunId: params.sourceRunId, status: sourceRun.status, runType: sourceRun.runType },
		});
	}
	const baseRevisionId = Number(publication.revisionId);
	if (!Number.isInteger(baseRevisionId) || baseRevisionId < 1) {
		throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The published source has no valid immutable base revision pointer.');
	}
	const baseRevision = await client.publishedScheduleRevision.findFirst({
		where: { id: baseRevisionId, schoolId: params.schoolId, schoolYearId: params.schoolYearId, sourceRunId: params.sourceRunId },
		select: { id: true, effectiveDate: true, sourceRevisionId: true, reason: true, metadata: true },
	});
	const baseMetadata = asSummaryRecord(baseRevision?.metadata);
	if (!baseRevision || baseRevision.sourceRevisionId !== null || baseRevision.reason !== 'INITIAL_PUBLICATION'
		|| baseMetadata.publicationBase !== true || Number(baseMetadata.sourceRunVersion) !== sourceRun.version) {
		throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The published source base revision is missing or invalid.');
	}
	const revisionChain = await client.publishedScheduleRevision.findMany({
		where: { schoolId: params.schoolId, schoolYearId: params.schoolYearId, sourceRunId: params.sourceRunId, status: { in: ['SCHEDULED', 'SUPERSEDED'] } },
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
		select: { id: true, effectiveDate: true, changeSet: true, status: true, metadata: true },
	});
	const publishedMarker = asSummaryRecord(sourceRun.summary).publishedAt;
	return {
		baseRevisionId,
		latestRevisionId: revisionChain.at(-1)?.id ?? baseRevisionId,
		sourceRunVersion: sourceRun.version,
		publishedAt: typeof publishedMarker === 'string' ? publishedMarker : null,
		baseRevision,
		latestRevision: revisionChain.at(-1) ?? null,
		revisionChain,
	};
}

type RevisionRunOutcome =
	| { kind: 'committed'; result: CreatePublishedScheduleRevisionResult }
	| { kind: 'preview'; preview: PublishedRevisionPreview };

export async function createPublishedScheduleRevision(
	input: CreatePublishedScheduleRevisionInput,
	options?: PublishedRevisionServiceOptions,
): Promise<CreatePublishedScheduleRevisionResult> {
	const outcome = await runPublishedScheduleRevision(input, options, 'commit');
	if (outcome.kind !== 'committed') throw err(500, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision write returned a preview.');
	return outcome.result;
}

/**
 * LANE-C POST-PUBLISH-C01 — dry run of `createPublishedScheduleRevision`. It
 * runs the identical scope, term-contract, source-token, previous-value and
 * merged hard-constraint checks inside the same advisory-locked transaction,
 * then returns the clashes instead of throwing and before the first write, so
 * the preview can never disagree with the commit. A missing effective date
 * defaults to the next UTC day and a missing reason to "Preview", so a client
 * can check a change before the user has chosen either.
 */
export async function previewPublishedScheduleRevision(
	input: CreatePublishedScheduleRevisionInput,
	options?: PublishedRevisionServiceOptions,
): Promise<PublishedRevisionPreview> {
	const outcome = await runPublishedScheduleRevision(input, options, 'preview');
	if (outcome.kind !== 'preview') throw err(500, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision preview attempted a write.');
	return outcome.preview;
}

async function runPublishedScheduleRevision(
	input: CreatePublishedScheduleRevisionInput,
	options: PublishedRevisionServiceOptions | undefined,
	mode: 'commit' | 'preview',
): Promise<RevisionRunOutcome> {
	const previewOnly = mode === 'preview';
	if (!isPositiveInt32(input.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive Int32 integer.');
	if (!isPositiveInt32(input.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive Int32 integer.');
	if (!isPositiveInteger(input.sourceRunId)) throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');
	if (input.sourceRevisionId != null && !isPositiveInteger(input.sourceRevisionId)) {
		throw err(400, 'INVALID_SOURCE_REVISION_ID', 'sourceRevisionId must be a positive integer when provided.');
	}

	const now = options?.now ?? new Date();
	const hasEffectiveDate = input.effectiveDate != null && input.effectiveDate !== '';
	let effectiveDate = previewOnly && !hasEffectiveDate ? nextUtcDay(now) : parseEffectiveDate(input.effectiveDate, now);
	const hasReason = typeof input.reason === 'string' && input.reason.trim().length > 0;
	const reason = previewOnly && !hasReason ? 'Preview' : normalizeReason(input.reason);
	const changes = normalizeChanges(input.changes);
	const actorId = input.actorId != null && isPositiveInteger(input.actorId) ? input.actorId : null;

	const changedEntryIds = changes.map((change) => change.entryId);
	const changeSummary = input.changeSummary ?? {
		changeCount: changes.length,
		entryIds: changedEntryIds,
	};
	const idempotencyKey = revisionIdempotencyKey({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		sourceRunId: input.sourceRunId,
		sourceRevisionId: input.sourceRevisionId ?? null,
		effectiveDate: effectiveDate.toISOString(),
		reason,
		changes,
		identityOverrides: asSummaryRecord(input.metadata)[IDENTITY_OVERRIDES_KEY] ?? null,
	});
	type TxOutcome =
		| { kind: 'committed'; revision: PublishedScheduleRevision; auditId: number; replayed: boolean; validation: PublishedRevisionValidationSummary | null }
		| { kind: 'preview'; preview: PublishedRevisionPreview };
	const result = await runSerializablePublicationTransaction(db(), async (tx): Promise<TxOutcome> => {
		await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', input.schoolId, input.schoolYearId);

		const computeSnapshot = options?.computeInputSnapshot ?? computeGenerationInputSnapshot;

		const activeYears = await tx.enrollProSchoolYearMirror.findMany({
			where: { schoolId: input.schoolId, isActive: true, isArchived: false },
			select: { enrollProSchoolYearId: true },
			take: 2,
		});
		if (activeYears.length !== 1 || activeYears[0].enrollProSchoolYearId !== input.schoolYearId) {
			throw err(409, 'PUBLISHED_REVISION_ACTIVE_YEAR_REQUIRED', 'Published revisions require the single runtime-active school year.');
		}
		// DEMAND-C01R2: the exact ordered-term authority is the persisted verified
		// EnrollPro contract, read through the transaction client. A QUARTERS
		// (four-term) contract is valid; legacy SchoolYearTermConfig is not
		// authoritative.
		const termContract = await loadVerifiedOrderedTermContract(input.schoolId, input.schoolYearId, tx as never);
		if (!termContract) {
			throw err(409, 'PUBLISHED_REVISION_TERM_CONTRACT_INVALID', 'Published revisions require a verified ordered EnrollPro term contract for the active school year.');
		}
		const termCount = termContract.terms.length;
		for (const change of changes) {
			for (const [side, values] of [['previous', change.previous], ['next', change.next]] as const) {
				const termIndex = (values as Record<string, unknown>).termIndex;
				if (termIndex !== undefined && !isTermIndexWithinContract(Number(termIndex), termContract.terms)) {
					throw err(409, 'REVISION_TERM_INDEX_OUTSIDE_CONTRACT', `Revision change ${change.entryId} ${side} termIndex ${String(termIndex)} is outside the verified ${termCount}-term ${termContract.format} contract.`);
				}
			}
		}

		const resolved = await resolveAuthoritativeLatestRevision(tx, {
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			sourceRunId: input.sourceRunId,
		});

		// Idempotent replay is detected before source-token or previous-value
		// staleness checks so an identical retry of an already committed request
		// returns the committed record instead of failing as stale. Scope (school,
		// year, source run), actor, official-source, and audit integrity are still
		// verified on the replay path.
		const replay = await tx.publishedScheduleRevision.findFirst({
			where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, sourceRunId: input.sourceRunId, metadata: { path: ['idempotencyKey'], equals: idempotencyKey } },
		});
		if (replay && previewOnly) {
			return {
				kind: 'preview',
				preview: { changeCount: changes.length, blockingHardViolationCount: 0, hardViolationCount: 0, softViolationCount: 0, softViolations: [], clashes: [], alreadyScheduled: true },
			};
		}
		if (replay) {
			if ((replay.actorId ?? null) !== (actorId ?? null)) {
				throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision replay does not match the requesting actor.');
			}
			const replayAudit = await tx.auditLog.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, action: 'PUBLISHED_SCHEDULE_REVISION_CREATED', targetIds: { has: replay.id } },
				select: { id: true },
			});
			if (!replayAudit) throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision replay has no matching audit record.');
			return { kind: 'committed', revision: replay, auditId: replayAudit.id, replayed: true, validation: null };
		}

		// D4 — effective-dated identity overrides carried on this revision's
		// metadata are validated against the SAME consistency rule the base
		// freeze uses, applied on top of every already-effective scheduled
		// override, before any write reads or writes. An invalid or inconsistent
		// override fails closed typed with zero writes.
		const identityOverrides = readIdentityOverrides(asSummaryRecord(input.metadata)[IDENTITY_OVERRIDES_KEY]);
		if (identityOverrides) {
			const baseSnapshot = readPublishedIdentitySnapshot(resolved.baseRevision.metadata);
			if (!baseSnapshot) {
				throw err(409, 'PUBLISHED_REVISION_IDENTITY_BASE_UNAVAILABLE', 'Published identity overrides require the base revision to carry a frozen identity snapshot.');
			}
			const priorEffective = resolveEffectiveIdentitySnapshot({
				baseMetadata: resolved.baseRevision.metadata,
				revisions: resolved.revisionChain,
				asOf: effectiveDate,
			});
			if (!priorEffective) {
				throw err(409, 'PUBLISHED_REVISION_IDENTITY_BASE_UNAVAILABLE', 'Published identity overrides require the base revision to carry a frozen identity snapshot.');
			}
			applyIdentityOverrides(priorEffective, identityOverrides);
		}

		if (input.sourceRevisionId !== resolved.latestRevisionId) {
			throw err(409, 'SOURCE_REVISION_STALE', 'The revision must be based on the latest published revision.', { details: { expectedSourceRevisionId: resolved.latestRevisionId } });
		}
		const sourceEffectiveDate = resolved.latestRevision?.effectiveDate ?? resolved.baseRevision.effectiveDate;
		// A preview without a chosen date checks the earliest date the change
		// could take effect: the later of tomorrow and the source revision's date.
		if (previewOnly && !hasEffectiveDate && effectiveDate.getTime() < sourceEffectiveDate.getTime()) {
			effectiveDate = sourceEffectiveDate;
		}
		if (effectiveDate.getTime() < sourceEffectiveDate.getTime()) {
			throw err(409, 'REVISION_EFFECTIVE_DATE_BEFORE_SOURCE', 'A revision that claims a later source revision must take effect on or after that source revision\'s effective date.', {
				details: { sourceRevisionId: input.sourceRevisionId, sourceEffectiveDate: sourceEffectiveDate.toISOString(), requestedEffectiveDate: effectiveDate.toISOString() },
			});
		}
		const existingEntries = await tx.$queryRawUnsafe<Array<{ entryId: string; entry: Record<string, unknown> }>>(
			`SELECT elem->>'entryId' AS "entryId", elem AS "entry"
			 FROM "generation_runs" r,
			 jsonb_array_elements(r."draft_entries") WITH ORDINALITY AS entry(elem, ord)
			 WHERE r.id = $1 AND elem->>'entryId' = ANY($2::text[])
			 ORDER BY entry.ord ASC`,
			input.sourceRunId,
			changedEntryIds,
		);
		const existingEntryIds = new Set(existingEntries.map((entry) => entry.entryId));
		if (existingEntries.length !== changedEntryIds.length || changedEntryIds.some((entryId) => !existingEntryIds.has(entryId))) {
			throw err(422, 'REVISION_ENTRY_NOT_FOUND', 'Every revision change must target one valid entry in the published source run.');
		}
		if (existingEntries.some((entry) => !isTermIndexWithinContract(Number(entry.entry.termIndex), termContract.terms))) {
			throw err(422, 'REVISION_ENTRY_TERM_OUTSIDE_CONTRACT', `Every revised source entry must carry a termIndex within the verified ${termCount}-term ${termContract.format} contract.`);
		}
		const effectiveEntries = new Map(existingEntries.map((entry) => [entry.entryId, { ...entry.entry }]));
		for (const revision of resolved.revisionChain) {
			if (!Array.isArray(revision.changeSet)) continue;
			for (const raw of revision.changeSet) {
				const prior = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
				const entryId = typeof prior?.entryId === 'string' ? prior.entryId : '';
				const next = prior?.next && typeof prior.next === 'object' && !Array.isArray(prior.next) ? prior.next as Record<string, unknown> : null;
				if (next && effectiveEntries.has(entryId)) Object.assign(effectiveEntries.get(entryId)!, next);
			}
		}
		for (const change of changes) {
			const current = effectiveEntries.get(change.entryId)!;
			for (const [field, expected] of Object.entries(change.previous)) {
				if (!Object.is(current[field], expected)) throw err(409, 'REVISION_PREVIOUS_VALUES_STALE', `Revision change ${change.entryId} no longer matches current published values.`, { details: { entryId: change.entryId, field } });
			}
		}

		// PUBLISHED-REVISION-AUTHORITY-C12 (R2) — bind the revision to the
		// covered-input snapshot that produced it. `preValidationSnapshot` is
		// read through the transaction client before validation; the
		// pre-commit re-read below must match it exactly or the write aborts
		// with zero writes. The canonical snapshot domains (rooms,
		// teachingLoad incl. faculty qualification/ownership, policy incl.
		// scheduling policy + grade-shift windows + special events +
		// class-program slots, sections, subjects, derivedDemand,
		// availability) cover every R2 input at minimum.
		const preValidationSnapshot = await computeSnapshot(input.schoolId, input.schoolYearId, tx);

		// PUBLISHED-REVISION-AUTHORITY-C12 (R1) — validate the MERGED entry
		// set (the full published draft with the revision chain and the
		// requested changes applied) through the same canonical authority the
		// publication gate consumes: `validateHardConstraints` produces the
		// violations and `countBlockingHardViolations` (the exact publication
		// predicate: HARD severity AND promotable constraint code) decides.
		// Reference data is loaded through the transaction client, so the
		// decision is bound to the transaction snapshot. A soft/warning
		// violation never blocks; only a blocking HARD fails closed with
		// PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS and zero writes.
		const refData = await loadRunContext(input.sourceRunId, input.schoolId, input.schoolYearId, tx, { allowPublished: true });
		const mergedEntriesById = new Map<string, Record<string, unknown>>();
		for (const entry of refData.entries) {
			mergedEntriesById.set(entry.entryId, { ...(entry as unknown as Record<string, unknown>) });
		}
		for (const revision of resolved.revisionChain) {
			if (!Array.isArray(revision.changeSet)) continue;
			for (const raw of revision.changeSet) {
				const prior = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
				const entryId = typeof prior?.entryId === 'string' ? prior.entryId : '';
				const next = prior?.next && typeof prior.next === 'object' && !Array.isArray(prior.next) ? prior.next as Record<string, unknown> : null;
				const base = entryId ? mergedEntriesById.get(entryId) : undefined;
				if (next && base) mergedEntriesById.set(entryId, applyRevisionNextToEntry(base, next as PublishedRevisionValueSnapshot));
			}
		}
		for (const change of changes) {
			const base = mergedEntriesById.get(change.entryId);
			if (base) mergedEntriesById.set(change.entryId, applyRevisionNextToEntry(base, change.next));
		}
		const mergedEntries = [...mergedEntriesById.values()] as unknown as ScheduledEntry[];
		const mergedValidation = validateHardConstraints(buildValidatorCtx(input.schoolId, input.schoolYearId, input.sourceRunId, mergedEntries, refData));
		const blockingHardViolationCount = countBlockingHardViolations(mergedValidation.violations);
		const validation = toValidationSummary(mergedValidation.violations, blockingHardViolationCount);
		const clashes = buildRevisionClashes(mergedValidation.violations, mergedEntriesById, new Set(changedEntryIds));
		if (previewOnly) {
			// Dry run: report the decision the commit would make, before any write.
			return {
				kind: 'preview',
				preview: {
					changeCount: changes.length,
					blockingHardViolationCount,
					hardViolationCount: validation.hardViolationCount,
					softViolationCount: validation.softViolationCount,
					softViolations: validation.softViolations,
					clashes,
					alreadyScheduled: false,
				},
			};
		}
		if (blockingHardViolationCount !== 0) {
			throw err(422, 'PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS', 'Cannot revise a published schedule while the merged entries contain hard violations.', {
				actionHint: 'Change the classes named in the conflicts, or choose a different teacher, room or time, then try again.',
				details: {
					sourceRunId: input.sourceRunId,
					blockingHardViolationCount,
					hardViolationCount: validation.hardViolationCount,
					softViolationCount: validation.softViolationCount,
					violations: mergedValidation.violations.slice(0, 25).map((violation) => ({
						code: violation.code,
						severity: violation.severity,
						message: violation.message,
					})),
					clashes,
				},
			});
		}

		// PUBLISHED-REVISION-AUTHORITY-C12 (R2) — pre-commit re-read. Any
		// covered-input change between validation and commit fails closed with
		// a typed stale-source error before the first write.
		const preCommitSnapshot = await computeSnapshot(input.schoolId, input.schoolYearId, tx);
		const snapshotComparison = compareGenerationInputSnapshots(preValidationSnapshot, preCommitSnapshot, now.toISOString());
		if (snapshotComparison.status !== 'FRESH') {
			throw err(409, 'PUBLISHED_REVISION_INPUTS_STALE', 'Published revision inputs changed between validation and commit. Reload the latest revision token and retry.', {
				details: { changedDomains: snapshotComparison.changedDomains, status: snapshotComparison.status },
			});
		}

		const revision = await tx.publishedScheduleRevision.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				sourceRunId: input.sourceRunId,
				sourceRevisionId: input.sourceRevisionId ?? null,
				status: 'SCHEDULED',
				effectiveDate,
				actorId,
				reason,
				changeSet: changes as unknown as Prisma.InputJsonValue,
				changeSummary: changeSummary as Prisma.InputJsonValue,
				previousValues: buildValueSnapshot(changes, 'previous') as Prisma.InputJsonValue,
				newValues: buildValueSnapshot(changes, 'next') as Prisma.InputJsonValue,
				metadata: {
					...(input.metadata ?? {}),
					idempotencyKey,
					sourceRunVersion: resolved.sourceRunVersion,
					publishedAt: resolved.publishedAt,
				} as Prisma.InputJsonValue,
			},
		});

		const audit = await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'PUBLISHED_SCHEDULE_REVISION_CREATED',
				actorId: actorId ?? 0,
				targetIds: [input.sourceRunId, revision.id],
				metadata: {
					revisionId: revision.id,
					sourceRunId: input.sourceRunId,
					sourceRevisionId: input.sourceRevisionId ?? null,
					effectiveDate: revision.effectiveDate.toISOString(),
					reason,
					changeCount: changes.length,
					changedEntryIds,
					status: revision.status,
					publishedTruthPreserved: true,
					blockingHardViolationCount: validation.blockingHardViolationCount,
					softViolationCount: validation.softViolationCount,
				} as Prisma.InputJsonValue,
			},
		});

		return { kind: 'committed', revision, auditId: audit.id, replayed: false, validation };
	});
	if (result.kind === 'preview') return result;

	// Fire notification event after successful commit
	const affectedFacultyIdsSet = new Set<number>();
	const affectedTerms = new Set<number>();
	for (const change of changes) {
		if (typeof change.previous.facultyId === 'number') {
			affectedFacultyIdsSet.add(change.previous.facultyId);
		}
		if (typeof change.next.facultyId === 'number') {
			affectedFacultyIdsSet.add(change.next.facultyId);
		}
		// Collect affected terms from entry metadata
		if (typeof change.previous.termIndex === 'number') affectedTerms.add(change.previous.termIndex);
		if (typeof change.next.termIndex === 'number') affectedTerms.add(change.next.termIndex);
	}
	const affectedFacultyIds = [...affectedFacultyIdsSet];
	const affectedTermIndices = [...affectedTerms].sort();

	let notificationDelivery: CreatePublishedScheduleRevisionResult['notificationDelivery'] = 'DELIVERED';
	if (!result.replayed) {
		try {
			(options?.publishEvent ?? publishPublishedScheduleEvent)({
				type: 'SCHEDULE_REVISED',
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				message: `Published schedule has been revised (effective date: ${effectiveDate.toISOString().slice(0, 10)}). Reason: ${reason}`,
				metadata: {
					revisionId: result.revision.id,
					sourceRunId: input.sourceRunId,
					effectiveDate: effectiveDate.toISOString(),
					reason,
					affectedFacultyIds,
					changeCount: changes.length,
					affectedTermIndices: affectedTermIndices.length > 0 ? affectedTermIndices : null,
				},
			});
		} catch {
			notificationDelivery = 'FAILED_AFTER_COMMIT';
		}
	}

	const { kind: _kind, ...committed } = result;
	return { kind: 'committed', result: { ...committed, notificationDelivery } };
}

export type CreatePublishedSwapRevisionInput = {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	sourceRevisionId?: number | null;
	actorId?: number | null;
	effectiveDate?: string | Date | null;
	reason?: string | null;
	entryIdA: string;
	entryIdB: string;
	changeSummary?: Record<string, unknown> | null;
	metadata?: Record<string, unknown> | null;
};

/**
 * PUBLISHED-REVISION-AUTHORITY-C12 (R3) — the supported path for a swap on a
 * published run. A direct swap (`swapManualEntries`) stays fail-closed with
 * 409 `RUN_ALREADY_PUBLISHED`: a published run's draft must never be silently
 * mutated. This helper expresses the same timeslot exchange (A takes B's
 * day/startTime/endTime and B takes A's, mirroring `applySwapWithTarget`
 * semantics) as a two-change `PUBLISHED_SWAP` revision and delegates to the
 * full `createPublishedScheduleRevision` write contract, inheriting shape
 * validation, R1 hard-constraint validation, R2 snapshot binding, the latest-
 * token concurrency check, idempotent replay, and the audit row.
 *
 * The current slot values are read outside the write transaction; any drift
 * between this read and the commit fails closed inside the write transaction
 * as `REVISION_PREVIOUS_VALUES_STALE` (or `SOURCE_REVISION_STALE`) with zero
 * writes — the same read-token-then-post composition the client already uses.
 */
export async function createPublishedSwapRevision(
	input: CreatePublishedSwapRevisionInput,
	options?: PublishedRevisionServiceOptions,
): Promise<CreatePublishedScheduleRevisionResult> {
	return createPublishedScheduleRevision(await buildPublishedSwapRevisionInput(input), options);
}

/**
 * LANE-C POST-PUBLISH-C01 — dry run of `createPublishedSwapRevision`: the same
 * two-change timeslot exchange checked through `previewPublishedScheduleRevision`,
 * with zero writes.
 */
export async function previewPublishedSwapRevision(
	input: CreatePublishedSwapRevisionInput,
	options?: PublishedRevisionServiceOptions,
): Promise<PublishedRevisionPreview> {
	return previewPublishedScheduleRevision(await buildPublishedSwapRevisionInput(input), options);
}

async function buildPublishedSwapRevisionInput(input: CreatePublishedSwapRevisionInput): Promise<CreatePublishedScheduleRevisionInput> {
	const entryIdA = typeof input.entryIdA === 'string' ? input.entryIdA.trim() : '';
	const entryIdB = typeof input.entryIdB === 'string' ? input.entryIdB.trim() : '';
	if (!entryIdA || !entryIdB) throw err(400, 'SWAP_ENTRY_REQUIRED', 'A published swap requires two entryIds.');
	if (entryIdA === entryIdB) throw err(400, 'SWAP_SAME_ENTRY', 'A published swap requires two distinct entries.');

	const client = db();
	const run = await client.generationRun.findFirst({
		where: { id: input.sourceRunId, schoolId: input.schoolId, schoolYearId: input.schoolYearId },
	});
	if (!run) throw err(404, 'SOURCE_RUN_NOT_FOUND', 'Source generation run was not found in this school/year scope.');
	const draftEntries = Array.isArray((run as unknown as Record<string, unknown>).draftEntries)
		? (run as unknown as { draftEntries: Array<Record<string, unknown>> }).draftEntries
		: [];
	const chain = await client.publishedScheduleRevision.findMany({
		where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, sourceRunId: input.sourceRunId, status: { in: ['SCHEDULED', 'SUPERSEDED'] } },
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
	});
	const effectiveById = new Map<string, Record<string, unknown>>();
	for (const entry of draftEntries) {
		if (entry && typeof entry.entryId === 'string') effectiveById.set(entry.entryId, { ...entry });
	}
	for (const revision of chain) {
		const changeSet = (revision as unknown as { changeSet: unknown }).changeSet;
		if (!Array.isArray(changeSet)) continue;
		for (const raw of changeSet) {
			const prior = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
			const entryId = typeof prior?.entryId === 'string' ? prior.entryId : '';
			const next = prior?.next && typeof prior.next === 'object' && !Array.isArray(prior.next) ? prior.next as Record<string, unknown> : null;
			const base = entryId ? effectiveById.get(entryId) : undefined;
			if (next && base) effectiveById.set(entryId, { ...base, ...next });
		}
	}
	const slotOf = (entryId: string): { day: string; startTime: string; endTime: string } => {
		const entry = effectiveById.get(entryId);
		if (!entry) throw err(422, 'REVISION_ENTRY_NOT_FOUND', 'Every revision change must target one valid entry in the published source run.');
		const { day, startTime, endTime } = entry;
		if (typeof day !== 'string' || typeof startTime !== 'string' || typeof endTime !== 'string') {
			throw err(422, 'SWAP_ENTRY_NOT_SWAPPABLE', `Published swap requires both entries to carry a concrete day/startTime/endTime slot: ${entryId}.`);
		}
		return { day, startTime, endTime };
	};
	const slotA = slotOf(entryIdA);
	const slotB = slotOf(entryIdB);

	return {
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		sourceRunId: input.sourceRunId,
		sourceRevisionId: input.sourceRevisionId ?? null,
		actorId: input.actorId,
		effectiveDate: input.effectiveDate,
		reason: input.reason ?? `Swap ${entryIdA} with ${entryIdB} on the published schedule`,
		changes: [
			{ entryId: entryIdA, changeType: 'PUBLISHED_SWAP', previous: slotA, next: slotB },
			{ entryId: entryIdB, changeType: 'PUBLISHED_SWAP', previous: slotB, next: slotA },
		],
		changeSummary: input.changeSummary ?? null,
		metadata: input.metadata ?? null,
	};
}

export async function listPublishedScheduleRevisions(params: {
	schoolId: number;
	schoolYearId: number;
	sourceRunId?: number;
}): Promise<PublishedScheduleRevision[]> {
	if (!isPositiveInteger(params.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive integer.');
	if (!isPositiveInteger(params.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive integer.');
	if (params.sourceRunId != null && !isPositiveInteger(params.sourceRunId)) {
		throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer when provided.');
	}

	return db().publishedScheduleRevision.findMany({
		where: {
			schoolId: params.schoolId,
			schoolYearId: params.schoolYearId,
			...(params.sourceRunId ? { sourceRunId: params.sourceRunId } : {}),
		},
		orderBy: [{ effectiveDate: 'asc' }, { createdAt: 'asc' }],
	});
}

/**
 * Read-contract resolver exposing the authoritative latest revision token the
 * create contract requires. Clients must read this token immediately before
 * posting a revision so their `sourceRevisionId` is the current concurrency
 * token. A stale or concurrent token fails closed as `SOURCE_REVISION_STALE`
 * on the write path.
 */
export async function resolveLatestPublishedSourceRevision(params: {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
}): Promise<{ baseRevisionId: number; latestRevisionId: number }> {
	if (!isPositiveInteger(params.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive integer.');
	if (!isPositiveInteger(params.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive integer.');
	if (!isPositiveInteger(params.sourceRunId)) throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');

	const resolved = await resolveAuthoritativeLatestRevision(db(), {
		schoolId: params.schoolId,
		schoolYearId: params.schoolYearId,
		sourceRunId: params.sourceRunId,
	});
	return { baseRevisionId: resolved.baseRevisionId, latestRevisionId: resolved.latestRevisionId };
}

export type EffectivePublishedIdentitySnapshot = {
	/** The effective identity at `asOf`; `null` for a legacy publication. */
	snapshot: PublishedIdentitySnapshot | null;
	state: SnapshotState;
	asOf: string;
	baseRevisionId: number;
	/** The revision ids whose effective-dated overrides contributed to the result. */
	appliedRevisionIds: number[];
};

/**
 * D4 read path (DB orchestration). Resolves the frozen base publication snapshot
 * and then applies every already-effective `SCHEDULED` revision override in
 * effective-date order at `asOf`. The base revision and its persisted snapshot
 * are never mutated; a later read of the base still returns the base bytes.
 */
export async function resolveEffectivePublishedIdentitySnapshot(params: {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	asOf?: string | Date | null;
}): Promise<EffectivePublishedIdentitySnapshot> {
	if (!isPositiveInteger(params.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive integer.');
	if (!isPositiveInteger(params.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive integer.');
	if (!isPositiveInteger(params.sourceRunId)) throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');
	const asOfDate = params.asOf == null || params.asOf === ''
		? new Date()
		: params.asOf instanceof Date
			? params.asOf
			: new Date(params.asOf);
	if (Number.isNaN(asOfDate.getTime())) {
		throw err(400, 'PUBLISHED_IDENTITY_AS_OF_INVALID', 'asOf must be a valid date or ISO date string.');
	}

	const resolved = await resolveAuthoritativeLatestRevision(db(), {
		schoolId: params.schoolId,
		schoolYearId: params.schoolYearId,
		sourceRunId: params.sourceRunId,
	});
	const baseSnapshot = readPublishedIdentitySnapshot(resolved.baseRevision.metadata);
	if (!baseSnapshot) {
		return { snapshot: null, state: 'LEGACY_LIVE_PROJECTION', asOf: asOfDate.toISOString(), baseRevisionId: resolved.baseRevisionId, appliedRevisionIds: [] };
	}
	const applied = selectEffectiveIdentityOverrideRevisions(resolved.revisionChain, asOfDate);
	const snapshot = resolveEffectiveIdentitySnapshot({
		baseMetadata: resolved.baseRevision.metadata,
		revisions: resolved.revisionChain,
		asOf: asOfDate,
	});
	return {
		snapshot,
		state: 'FROZEN',
		asOf: asOfDate.toISOString(),
		baseRevisionId: resolved.baseRevisionId,
		appliedRevisionIds: applied.map((revision) => revision.id).filter((id): id is number => typeof id === 'number'),
	};
}

export type WithdrawPublishedScheduleRevisionInput = {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	revisionId: number;
	actorId?: number | null;
	reason?: string | null;
};

export type WithdrawPublishedScheduleRevisionResult = {
	revision: Pick<PublishedScheduleRevision, 'id' | 'schoolId' | 'schoolYearId' | 'sourceRunId' | 'status' | 'effectiveDate' | 'reason' | 'metadata'>;
	auditId: number;
	replayed: boolean;
};

/**
 * D4 — bounded, audited, reason-required withdraw/supersede of a scheduled
 * published revision.
 *
 * The immutable base publication revision is never a valid target and is never
 * mutated. A valid withdraw flips exactly one SCHEDULED revision to SUPERSEDED,
 * records the withdrawal on that revision's metadata, and writes exactly one
 * audit row. A missing/blank/overlong reason, an unknown revision, the base
 * revision, or a revision that is not currently SCHEDULED all fail closed with a
 * typed 4xx and zero writes. An already-withdrawn revision replays idempotently
 * with no second audit row. Actor-school scope and capability are enforced by the
 * router.
 */
export async function withdrawPublishedScheduleRevision(
	input: WithdrawPublishedScheduleRevisionInput,
	options?: { now?: Date },
): Promise<WithdrawPublishedScheduleRevisionResult> {
	if (!isPositiveInt32(input.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive Int32 integer.');
	if (!isPositiveInt32(input.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive Int32 integer.');
	if (!isPositiveInteger(input.sourceRunId)) throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');
	if (!isPositiveInteger(input.revisionId)) throw err(400, 'INVALID_REVISION_ID', 'revisionId must be a positive integer.');
	const reason = normalizeReason(input.reason);
	const actorId = input.actorId != null && isPositiveInteger(input.actorId) ? input.actorId : null;
	const now = options?.now ?? new Date();

	return runSerializablePublicationTransaction(db(), async (tx) => {
		await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', input.schoolId, input.schoolYearId);

		const resolved = await resolveAuthoritativeLatestRevision(tx, {
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			sourceRunId: input.sourceRunId,
		});
		const revision = await tx.publishedScheduleRevision.findFirst({
			where: { id: input.revisionId, schoolId: input.schoolId, schoolYearId: input.schoolYearId, sourceRunId: input.sourceRunId },
			select: {
				id: true, schoolId: true, schoolYearId: true, sourceRunId: true,
				status: true, sourceRevisionId: true, reason: true, effectiveDate: true, metadata: true,
			},
		});
		if (!revision) throw err(404, 'PUBLISHED_REVISION_NOT_FOUND', 'The published revision was not found in this school/year/run scope.');
		if (revision.id === resolved.baseRevisionId || revision.sourceRevisionId === null || revision.reason === 'INITIAL_PUBLICATION') {
			throw err(409, 'PUBLISHED_REVISION_BASE_IMMUTABLE', 'The immutable base publication revision cannot be withdrawn or superseded.');
		}
		if (revision.status === 'SUPERSEDED') {
			const existingAudit = await tx.auditLog.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, action: 'PUBLISHED_SCHEDULE_REVISION_WITHDRAWN', targetIds: { has: revision.id } },
				select: { id: true },
			});
			if (!existingAudit) throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision is superseded but has no matching withdrawal audit record.');
			return { revision, auditId: existingAudit.id, replayed: true };
		}
		if (revision.status !== 'SCHEDULED') {
			throw err(409, 'PUBLISHED_REVISION_NOT_WITHDRAWABLE', 'Only a SCHEDULED published revision can be withdrawn or superseded.');
		}

		const withdrawnAt = now.toISOString();
		const updated = await tx.publishedScheduleRevision.update({
			where: { id: revision.id },
			data: {
				status: 'SUPERSEDED',
				metadata: {
					...asSummaryRecord(revision.metadata),
					withdrawn: true,
					withdrawnAt,
					withdrawnBy: actorId,
					withdrawReason: reason,
				} as Prisma.InputJsonValue,
			},
		});
		const audit = await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'PUBLISHED_SCHEDULE_REVISION_WITHDRAWN',
				actorId: actorId ?? 0,
				targetIds: [input.sourceRunId, revision.id],
				metadata: {
					revisionId: revision.id,
					sourceRunId: input.sourceRunId,
					baseRevisionId: resolved.baseRevisionId,
					previousStatus: revision.status,
					status: 'SUPERSEDED',
					reason,
					withdrawnAt,
					publishedTruthPreserved: true,
				} as Prisma.InputJsonValue,
			},
		});
		return { revision: updated, auditId: audit.id, replayed: false };
	});
}

function revisionIdempotencyKey(input: {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	sourceRevisionId: number | null;
	effectiveDate: string;
	reason: string;
	changes: PublishedRevisionEntryChange[];
	identityOverrides: unknown;
}): string {
	return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
