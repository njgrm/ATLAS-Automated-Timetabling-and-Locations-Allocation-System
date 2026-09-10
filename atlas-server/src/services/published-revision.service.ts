import type { Prisma, PrismaClient, PublishedScheduleRevision } from '@prisma/client';
import { createHash } from 'node:crypto';
import { getDataContext } from '../lib/data-context.js';
import { publishPublishedScheduleEvent } from './published-schedule-events.service.js';
import { runSerializablePublicationTransaction } from './serializable-transaction-retry.js';

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
		if (change.next.termIndex !== undefined && (typeof change.next.termIndex !== 'number' || ![1, 2, 3].includes(change.next.termIndex))) {
			throw err(400, 'REVISION_TERM_INDEX_INVALID', `Revision change ${entryId} must use termIndex 1, 2, or 3.`);
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
			if (field === 'termIndex' && (typeof value !== 'number' || ![1, 2, 3].includes(value))) throw err(400, 'REVISION_TERM_INDEX_INVALID', `Revision change ${entryId} must use termIndex 1, 2, or 3.`);
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
	revisionChain: Array<{ id: number; effectiveDate: Date; changeSet: unknown }>;
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
		select: { id: true, effectiveDate: true, changeSet: true },
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

export async function createPublishedScheduleRevision(
	input: CreatePublishedScheduleRevisionInput,
	options?: { now?: Date; publishEvent?: (event: Parameters<typeof publishPublishedScheduleEvent>[0]) => unknown },
): Promise<CreatePublishedScheduleRevisionResult> {
	if (!isPositiveInt32(input.schoolId)) throw err(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive Int32 integer.');
	if (!isPositiveInt32(input.schoolYearId)) throw err(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive Int32 integer.');
	if (!isPositiveInteger(input.sourceRunId)) throw err(400, 'INVALID_SOURCE_RUN_ID', 'sourceRunId must be a positive integer.');
	if (input.sourceRevisionId != null && !isPositiveInteger(input.sourceRevisionId)) {
		throw err(400, 'INVALID_SOURCE_REVISION_ID', 'sourceRevisionId must be a positive integer when provided.');
	}

	const now = options?.now ?? new Date();
	const effectiveDate = parseEffectiveDate(input.effectiveDate, now);
	const reason = normalizeReason(input.reason);
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
	});
	const result = await runSerializablePublicationTransaction(db(), async (tx) => {
		await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', input.schoolId, input.schoolYearId);

		const activeYears = await tx.enrollProSchoolYearMirror.findMany({
			where: { schoolId: input.schoolId, isActive: true, isArchived: false },
			select: { enrollProSchoolYearId: true },
			take: 2,
		});
		if (activeYears.length !== 1 || activeYears[0].enrollProSchoolYearId !== input.schoolYearId) {
			throw err(409, 'PUBLISHED_REVISION_ACTIVE_YEAR_REQUIRED', 'Published revisions require the single runtime-active school year.');
		}
		const termConfig = await tx.schoolYearTermConfig.findUnique({
			where: { schoolId_schoolYearId: { schoolId: input.schoolId, schoolYearId: input.schoolYearId } },
			select: { termCount: true, termIdentities: true, isActive: true },
		});
		const termIdentities = Array.isArray(termConfig?.termIdentities) ? termConfig.termIdentities : [];
		const normalizedTerms = termIdentities.map((identity) => typeof identity === 'string' ? identity.trim() : '');
		if (!termConfig?.isActive || termConfig.termCount !== 3 || normalizedTerms.length !== 3
			|| normalizedTerms.some((identity) => identity.length === 0) || new Set(normalizedTerms).size !== 3) {
			throw err(409, 'PUBLISHED_REVISION_TERM_CONTRACT_INVALID', 'Published revisions require the current ordered three-term configuration.');
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
		if (replay) {
			if ((replay.actorId ?? null) !== (actorId ?? null)) {
				throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision replay does not match the requesting actor.');
			}
			const replayAudit = await tx.auditLog.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, action: 'PUBLISHED_SCHEDULE_REVISION_CREATED', targetIds: { has: replay.id } },
				select: { id: true },
			});
			if (!replayAudit) throw err(409, 'PUBLISHED_REVISION_STATE_AMBIGUOUS', 'The revision replay has no matching audit record.');
			return { revision: replay, auditId: replayAudit.id, replayed: true };
		}

		if (input.sourceRevisionId !== resolved.latestRevisionId) {
			throw err(409, 'SOURCE_REVISION_STALE', 'The revision must be based on the latest published revision.', { details: { expectedSourceRevisionId: resolved.latestRevisionId } });
		}
		const sourceEffectiveDate = resolved.latestRevision?.effectiveDate ?? resolved.baseRevision.effectiveDate;
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
		if (existingEntries.length !== changedEntryIds.length || changedEntryIds.some((entryId) => !existingEntryIds.has(entryId))
			|| existingEntries.some((entry) => ![1, 2, 3].includes(Number(entry.entry.termIndex)))) {
			throw err(422, 'REVISION_ENTRY_NOT_FOUND', 'Every revision change must target one valid entry in the published source run.');
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
				} as Prisma.InputJsonValue,
			},
		});

		return { revision, auditId: audit.id, replayed: false };
	});

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

	return { ...result, notificationDelivery };
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

function revisionIdempotencyKey(input: {
	schoolId: number;
	schoolYearId: number;
	sourceRunId: number;
	sourceRevisionId: number | null;
	effectiveDate: string;
	reason: string;
	changes: PublishedRevisionEntryChange[];
}): string {
	return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}
