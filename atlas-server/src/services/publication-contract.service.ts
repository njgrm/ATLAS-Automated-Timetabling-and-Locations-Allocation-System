import type { Prisma, PrismaClient } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import { publishPublishedScheduleEvent } from './published-schedule-events.service.js';
import { runSerializablePublicationTransaction } from './serializable-transaction-retry.js';
import {
	compareGenerationInputSnapshots,
	computeGenerationInputSnapshot,
	extractGenerationInputSnapshot,
	type GenerationInputSnapshot,
} from './generation-input-snapshot.service.js';
import { buildDerivedDemand } from './derived-demand.service.js';
import { resolvePreResolvedActiveTermAuthority, type ActiveOrderedTermProvider } from './academic-term.service.js';
import { isPromotableConstraintCode } from './scheduling-policy.service.js';
import {
	PUBLISHED_IDENTITY_SNAPSHOT_KEY,
	buildPublishedIdentitySnapshot,
	type PublishedIdentitySnapshot,
} from './published-identity-snapshot.service.js';
import { assertPublicationApprovalAllowed, hashPublicationRunSnapshot, publicationApprovalError } from './publication-approval-contract.service.js';
import { schoolLocalDayStartUtc } from '../lib/school-operating-time-zone.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

type PublishEvent = Parameters<typeof publishPublishedScheduleEvent>[0];

export type PublishScheduleInput = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	actorId: number;
	actorSchoolId: number;
	acknowledgeSoftViolations?: boolean;
	approvalRequestId?: number;
};

export type PublishScheduleResult = {
	run: Record<string, unknown>;
	revisionId: number;
	auditId: number;
	replayed: boolean;
	notificationDelivery: 'DELIVERED' | 'FAILED_AFTER_COMMIT';
};

type PublicationDependencies = {
	client?: PrismaClient;
	now?: () => Date;
	publishEvent?: (event: PublishEvent) => unknown;
	computeInputSnapshot?: (
		schoolId: number,
		schoolYearId: number,
		client: Prisma.TransactionClient | PrismaClient,
		options?: { availabilityTermIndex?: number | null },
	) => Promise<GenerationInputSnapshot>;
	buildIdentitySnapshot?: typeof buildPublishedIdentitySnapshot;
	/**
	 * ACTIVE-TERM-LIVE-RESOLUTION-C02: injectable live-contract provider seam for the
	 * pre-transaction active-term pre-resolution. Production callers omit it.
	 */
	activeTermProvider?: ActiveOrderedTermProvider;
	/** ACTIVE-TERM-LIVE-RESOLUTION-C02: clock for the date-derived fallback seam. */
	activeTermNow?: Date;
};

function fail(
	statusCode: number,
	code: string,
	message: string,
	options?: { actionHint?: string; details?: Record<string, unknown> },
): ServiceError {
	const error = new Error(message) as ServiceError;
	error.statusCode = statusCode;
	error.code = code;
	error.actionHint = options?.actionHint;
	error.details = options?.details;
	return error;
}

function isPositiveInteger(value: unknown): value is number {
	return Number.isInteger(value) && Number(value) > 0;
}

function isPositiveInt32(value: unknown): value is number {
	return isPositiveInteger(value) && Number(value) <= 2_147_483_647;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? value as Record<string, unknown>
		: null;
}

function isPublished(summary: unknown): boolean {
	return asRecord(summary)?.isPublished === true;
}

function countViolations(violations: unknown, severity: 'HARD' | 'SOFT'): number {
	if (!Array.isArray(violations)) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run has no valid violation snapshot.');
	}
	if (violations.some((violation) => !asRecord(violation) || !['HARD', 'SOFT'].includes(String(asRecord(violation)?.severity)))) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run contains a malformed violation record.');
	}
	return violations.filter((violation) => asRecord(violation)?.severity === severity).length;
}

/**
 * R4 — publication derives hard-blocking only from the server-owned promotable
 * allowlist. A persisted HARD severity for a non-allowlisted (unreliable or
 * retired) code is informational and can never block publication.
 */
export function countBlockingHardViolations(violations: unknown): number {
	if (!Array.isArray(violations)) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run has no valid violation snapshot.');
	}
	if (violations.some((violation) => !asRecord(violation) || !['HARD', 'SOFT'].includes(String(asRecord(violation)?.severity)))) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run contains a malformed violation record.');
	}
	return violations.filter((violation) => {
		const record = asRecord(violation);
		return record?.severity === 'HARD' && isPromotableConstraintCode(String(record.code));
	}).length;
}

function countRequiredUnassigned(unassignedItems: unknown): number {
	if (!Array.isArray(unassignedItems)) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run has no valid unassigned-session snapshot.');
	}
	if (unassignedItems.some((item) => !asRecord(item))) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run contains a malformed unassigned-session record.');
	}
	return unassignedItems.length;
}

function validateScheduleEntries(entries: unknown, termCount: number): asserts entries is Array<Record<string, unknown>> {
	if (!Array.isArray(entries) || entries.some((entry) => {
		const record = asRecord(entry);
		return !record || typeof record.entryId !== 'string' || !Number.isInteger(Number(record.termIndex)) || Number(record.termIndex) < 1;
	})) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'Every published entry must have an identity and a positive integer termIndex.');
	}
	if (entries.some((entry) => Number((entry as Record<string, unknown>).termIndex) > termCount)) {
		throw fail(422, 'PUBLICATION_TERM_INDEX_OUTSIDE_CONTRACT', `Every published entry termIndex must be within the verified ${termCount}-term contract for the active school year.`);
	}
	const entryIds = entries.map((entry) => String((entry as Record<string, unknown>).entryId));
	if (new Set(entryIds).size !== entryIds.length) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'Published schedule entry identities must be unique.');
	}
}

function validateInput(input: PublishScheduleInput): void {
	if (!isPositiveInt32(input.schoolId)) throw fail(400, 'INVALID_SCHOOL_ID', 'schoolId must be a positive Int32 integer.');
	if (!isPositiveInt32(input.schoolYearId)) throw fail(400, 'INVALID_SCHOOL_YEAR_ID', 'schoolYearId must be a positive Int32 integer.');
	if (!isPositiveInteger(input.runId)) throw fail(400, 'INVALID_RUN_ID', 'runId must be a positive integer.');
	if (!isPositiveInteger(input.actorId)) throw fail(401, 'NO_USER', 'Authenticated user required.');
	if (!isPositiveInteger(input.actorSchoolId)) throw fail(403, 'ACTOR_SCHOOL_UNRESOLVED', 'Publication requires an authenticated school scope.');
	if (input.actorSchoolId !== input.schoolId) {
		throw fail(403, 'CROSS_SCHOOL_DENIED', 'The authenticated actor cannot publish another school\'s schedule.');
	}
}

function publicationMetadata(summary: unknown): Record<string, unknown> | null {
	const metadata = asRecord(asRecord(summary)?.publication);
	return metadata?.contractVersion === 1 ? metadata : null;
}

/**
 * The sole server-owned publication decision and write contract.
 * All authority checks and persisted effects are revalidated in one serializable transaction.
 * The in-process SSE notification is necessarily post-commit; its failure is reported but never
 * rolls back or duplicates the database publication record.
 */
export async function publishSchedule(
	input: PublishScheduleInput,
	dependencies: PublicationDependencies = {},
): Promise<PublishScheduleResult> {
	validateInput(input);
	const client = dependencies.client ?? getDataContext<PrismaClient>();
	const now = dependencies.now ?? (() => new Date());
	const computeSnapshot = dependencies.computeInputSnapshot ?? computeGenerationInputSnapshot;
	const buildIdentitySnapshot = dependencies.buildIdentitySnapshot ?? buildPublishedIdentitySnapshot;
	const publishEvent = dependencies.publishEvent ?? publishPublishedScheduleEvent;

	// ACTIVE-TERM-LIVE-RESOLUTION-C02: pre-resolve the authoritative active ordered
	// term BEFORE `runSerializablePublicationTransaction` and before the publication
	// advisory lock, so the network-aware resolver never runs under the lock. The
	// bound term structure and term index are threaded through the existing
	// `computeInputSnapshot` and `buildPublishedIdentitySnapshot` seams below; the
	// transaction itself performs no network read at all.
	const preResolvedActiveTerm = await resolvePreResolvedActiveTermAuthority(input.schoolId, input.schoolYearId, {
		provider: dependencies.activeTermProvider,
		now: dependencies.activeTermNow,
		client,
	});
	const preResolvedTermContract = preResolvedActiveTerm.contract ?? undefined;

	const committed = await runSerializablePublicationTransaction(client, async (tx) => {
		// One publisher per school/year enters the decision boundary at a time. This closes the
		// no-schema-change concurrency gap and makes duplicate request replay deterministic.
		await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', input.schoolId, input.schoolYearId);

		const activeYears = await tx.enrollProSchoolYearMirror.findMany({
			where: { schoolId: input.schoolId, isActive: true, isArchived: false },
			select: { enrollProSchoolYearId: true },
			orderBy: [{ lastSyncedAt: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
			take: 2,
		});
		if (activeYears.length === 0) {
			throw fail(409, 'ACTIVE_SCHOOL_YEAR_UNAVAILABLE', 'Publication requires one runtime-active school year.');
		}
		if (activeYears.length > 1) {
			throw fail(409, 'ACTIVE_SCHOOL_YEAR_AMBIGUOUS', 'Publication is blocked because multiple active school years exist.');
		}
		if (activeYears[0].enrollProSchoolYearId !== input.schoolYearId) {
			throw fail(409, 'HISTORICAL_YEAR_PUBLICATION_DENIED', 'Only the runtime-active school year may be published.', {
				details: { requestedSchoolYearId: input.schoolYearId, activeSchoolYearId: activeYears[0].enrollProSchoolYearId },
			});
		}
		// DEMAND-C01R: current-year term authority is the persisted derived-demand
		// contract (verified ordered EnrollPro terms + active sections + Subject
		// scheduling/room semantics + period length), read through the transaction
		// client. Legacy SchoolYearTermConfig is no longer authoritative and a
		// QUARTERS (four-term) contract is valid.
		const derivedAuthority = await buildDerivedDemand(input.schoolId, input.schoolYearId, { client: tx as never });
		if (!derivedAuthority.ok) {
			throw fail(409, 'PUBLICATION_TERM_CONTRACT_INVALID', 'Publication requires a verified derived-demand term authority for the active year.', {
				details: { blockers: derivedAuthority.blockers },
			});
		}

		const run = await tx.generationRun.findFirst({
			where: { id: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId },
			select: {
				id: true,
				schoolId: true,
				schoolYearId: true,
				status: true,
				runType: true,
				version: true,
				summary: true,
				violations: true,
				unassignedItems: true,
				draftEntries: true,
				finishedAt: true,
				createdAt: true,
			},
		});
		if (!run) throw fail(404, 'RUN_NOT_FOUND', 'Generation run not found in the authenticated school/year scope.');
		if (run.status !== 'COMPLETED') throw fail(422, 'RUN_NOT_COMPLETED', 'Only completed generation runs can be published.');
		if (run.runType !== 'FULL') throw fail(422, 'RUN_NOT_OFFICIAL', 'Preview, diagnostic, and performance-fixture runs cannot be published.');

		let approvalRequest: { id: number; requesterId: number; sourceRevisionId: number | null } | null = null;
		if (input.approvalRequestId !== undefined) {
			if (!Number.isSafeInteger(input.approvalRequestId) || input.approvalRequestId < 1) {
				throw publicationApprovalError('APPROVAL_SCOPE_MISMATCH', 'A valid approval request id is required.');
			}
			const request = await (tx as unknown as { publicationApprovalRequest: { findFirst(args: unknown): Promise<Record<string, unknown> | null> } }).publicationApprovalRequest.findFirst({
				where: { id: input.approvalRequestId, schoolId: input.schoolId, schoolYearId: input.schoolYearId, runId: run.id },
				select: { id: true, schoolId: true, schoolYearId: true, runId: true, runVersion: true, snapshotHash: true, sourceRevisionId: true, requesterId: true, status: true },
			});
			if (!request) throw publicationApprovalError('APPROVAL_NOT_FOUND', 'Publication approval request was not found in this scope.');
			assertPublicationApprovalAllowed(request as never, input.actorId, {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				runId: run.id,
				runVersion: run.version,
				snapshotHash: hashPublicationRunSnapshot(run as unknown as Record<string, unknown>),
			});
			const priorRevision = await tx.publishedScheduleRevision.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId },
				orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
				select: { id: true },
			});
			if ((request.sourceRevisionId ?? null) !== (priorRevision?.id ?? null)) {
				throw publicationApprovalError('APPROVAL_STALE', 'The published revision changed after this request was submitted. Submit a new request.');
			}
			approvalRequest = { id: Number(request.id), requesterId: Number(request.requesterId), sourceRevisionId: request.sourceRevisionId as number | null };
		}

		const existingPublication = publicationMetadata(run.summary);
		if (!isPublished(run.summary) && existingPublication) {
			throw fail(409, 'RUN_PUBLICATION_SUPERSEDED', 'This run has a superseded publication record and cannot be replayed as current.');
		}
		if (isPublished(run.summary) && existingPublication) {
			const revisionId = Number(existingPublication.revisionId);
			const auditId = Number(existingPublication.auditId);
			if (!Number.isInteger(revisionId) || revisionId < 1 || !Number.isInteger(auditId) || auditId < 1
				|| Number(existingPublication.sourceRunVersion) !== run.version) {
				throw fail(409, 'PUBLICATION_STATE_AMBIGUOUS', 'The run publication pointers are malformed or version-stale.');
			}
			const [revision, audit] = await Promise.all([
				tx.publishedScheduleRevision.findFirst({
					where: { id: revisionId, schoolId: input.schoolId, schoolYearId: input.schoolYearId, sourceRunId: run.id },
					select: { id: true, sourceRevisionId: true, reason: true, metadata: true },
				}),
				tx.auditLog.findFirst({
					where: { id: auditId, schoolId: input.schoolId, schoolYearId: input.schoolYearId, action: 'GENERATION_RUN_PUBLISHED', targetIds: { has: run.id } },
					select: { id: true, targetIds: true, metadata: true },
				}),
			]);
			const revisionMetadata = asRecord(revision?.metadata);
			const auditMetadata = asRecord(audit?.metadata);
			if (!revision || revision.sourceRevisionId !== null || revision.reason !== 'INITIAL_PUBLICATION'
				|| revisionMetadata?.publicationBase !== true || Number(revisionMetadata.sourceRunVersion) !== run.version
				|| !audit || !audit.targetIds.includes(revisionId) || Number(auditMetadata?.revisionId) !== revisionId) {
				throw fail(409, 'PUBLICATION_STATE_AMBIGUOUS', 'The run publication records are missing, cross-scoped, or not mutually bound base records.');
			}
			return {
				run: run as unknown as Record<string, unknown>,
				revisionId,
				auditId,
				replayed: true,
			};
		}
		if (isPublished(run.summary)) {
			throw fail(409, 'PUBLICATION_STATE_AMBIGUOUS', 'The run has legacy publish markers without an immutable publication record.');
		}

		const summary = asRecord(run.summary);
		if (!summary) {
			throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run has no valid schedule snapshot.');
		}
		validateScheduleEntries(run.draftEntries, derivedAuthority.termStructure.terms.length);
		const hardViolationCount = countBlockingHardViolations(run.violations);
		if (hardViolationCount !== 0) {
			throw fail(422, 'PUBLISH_BLOCKED_HARD_VIOLATIONS', 'Cannot publish while hard violations exist.', {
				details: { runId: run.id, hardViolationCount },
			});
		}
		const requiredUnassignedCount = countRequiredUnassigned(run.unassignedItems);
		if (requiredUnassignedCount !== 0) {
			throw fail(422, 'PUBLISH_BLOCKED_UNASSIGNED_REQUIRED', 'Cannot publish while required sessions remain unassigned.', {
				details: { runId: run.id, requiredUnassignedCount },
			});
		}

		const runSnapshot = extractGenerationInputSnapshot(summary);
		if (!runSnapshot) {
			throw fail(422, 'PUBLICATION_INPUT_SNAPSHOT_REQUIRED', 'The selected run has no valid authoritative input snapshot.');
		}
		const currentSnapshot = await computeSnapshot(
			input.schoolId,
			input.schoolYearId,
			tx,
			{ availabilityTermIndex: preResolvedActiveTerm.termIndex },
		);
		const comparison = compareGenerationInputSnapshots(runSnapshot, currentSnapshot, now().toISOString());
		if (comparison.status !== 'FRESH') {
			throw fail(409, 'PUBLICATION_INPUTS_STALE', 'The selected run no longer matches current authoritative inputs.', {
				details: { changedDomains: comparison.changedDomains, status: comparison.status },
			});
		}

		const softViolationCount = countViolations(run.violations, 'SOFT');
		if (softViolationCount > 0 && input.acknowledgeSoftViolations !== true) {
			throw fail(422, 'PUBLISH_ACK_REQUIRED_SOFT_VIOLATIONS', 'Soft warnings require explicit acknowledgment before publish.', {
				details: { runId: run.id, softViolationCount },
			});
		}

		const publishedAt = now();

		// PUBLISHED-IMMUTABILITY-C08 — freeze the published artifact's identity
		// from the SAME transaction and the SAME fresh read that the publication
		// decision above already validated. The existing freshness comparison
		// (`PUBLICATION_INPUTS_STALE`) bound this read to the run's input snapshot;
		// the snapshot is therefore never derived from older data. Any inconsistency
		// between frozen special events and frozen display slots fails closed with
		// `PUBLICATION_SNAPSHOT_INCONSISTENT` and zero writes.
		const summaryRecord = asRecord(run.summary) ?? {};
		const publishedIdentitySnapshot: PublishedIdentitySnapshot = await buildIdentitySnapshot({
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			client: tx,
			entries: (run.draftEntries ?? []) as Array<Record<string, unknown>>,
			inputFingerprint: currentSnapshot.fingerprint,
			capturedAt: publishedAt.toISOString(),
			// ACTIVE-TERM-LIVE-RESOLUTION-C02: the frozen identity snapshot binds the
			// term structure resolved BEFORE the advisory lock, through the existing
			// seam, instead of re-reading it inside the transaction.
			termContract: preResolvedTermContract,
			summaryDisplaySlots: Array.isArray(summaryRecord.timetableDisplaySlots)
				? summaryRecord.timetableDisplaySlots as Array<{ startTime: string; endTime: string; eventName?: string; isSpecialEvent?: boolean; dayOfWeek?: string | null }>
				: undefined,
		});

		// Claim the approval before publication writes. Both the claim/audit and
		// publication records share this serializable transaction, so any later
		// failure rolls the approval back to PENDING.
		if (approvalRequest) {
			const approvalModel = (tx as unknown as { publicationApprovalRequest: { updateMany(args: unknown): Promise<{ count: number }> } }).publicationApprovalRequest;
			const claim = await approvalModel.updateMany({
				where: { id: approvalRequest.id, schoolId: input.schoolId, schoolYearId: input.schoolYearId, runId: run.id, runVersion: run.version, status: 'PENDING', requesterId: { not: input.actorId }, sourceRevisionId: approvalRequest.sourceRevisionId },
				data: { status: 'APPROVED', approverId: input.actorId, approvedAt: publishedAt },
			});
			if (claim.count !== 1) throw publicationApprovalError('APPROVAL_NOT_PENDING', 'Publication approval request was already handled or changed.');
			await tx.auditLog.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					action: 'PUBLICATION_APPROVAL_GRANTED',
					actorId: input.actorId,
					targetIds: [approvalRequest.id, run.id],
					metadata: { requestId: approvalRequest.id, requesterId: approvalRequest.requesterId, approverId: input.actorId, approvedAt: publishedAt.toISOString(), runVersion: run.version },
				},
			});
		}

		const priorPublishedRuns = await tx.generationRun.findMany({
			where: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				status: 'COMPLETED',
				id: { not: run.id },
				summary: { path: ['isPublished'], equals: true },
			},
			select: { id: true, version: true, summary: true },
		});
		for (const prior of priorPublishedRuns) {
			const priorSummary = asRecord(prior.summary);
			if (!priorSummary) throw fail(409, 'PUBLICATION_STATE_AMBIGUOUS', 'A prior published run has malformed metadata.');
			const retired = await tx.generationRun.updateMany({
				where: { id: prior.id, schoolId: input.schoolId, schoolYearId: input.schoolYearId, version: prior.version },
				data: {
					summary: {
						...priorSummary,
						isPublished: false,
						publicationSupersededAt: publishedAt.toISOString(),
						publicationSupersededByRunId: run.id,
					} as Prisma.InputJsonValue,
					version: { increment: 1 },
				},
			});
			if (retired.count !== 1) throw fail(409, 'PUBLICATION_CONCURRENT_CHANGE', 'A prior publication changed during replacement.');
		}
		const revision = await tx.publishedScheduleRevision.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				sourceRunId: run.id,
				sourceRevisionId: null,
				status: 'SCHEDULED',
				// PUBLISHED-DAY-BOUNDARY-A2 (Defect B) — the base revision is a
				// DAY-GRANULAR artifact, so it is stamped with the START of the
				// school's local calendar day containing the publish instant, not
				// with the raw instant.
				//
				// Stamping the instant was self-rejecting: a publish at
				// 2026-09-27T00:38+08 is 2026-09-26T16:38Z, and the read anchor for
				// `?date=2026-09-26` is 2026-09-26T12:00Z — so the base revision was
				// not yet in force for the very date it named, and every
				// 00:00-08:00 local publish became unreachable for its own day.
				//
				// The exact publish instant is NOT lost: `publishedAt` on the run
				// summary and in the GENERATION_RUN_PUBLISHED audit metadata still
				// carry it. `effectiveDate` now means "the local calendar day this
				// publication governs", which is what a date-addressed read needs.
				effectiveDate: schoolLocalDayStartUtc(publishedAt),
				actorId: input.actorId,
				reason: 'INITIAL_PUBLICATION',
				changeSet: [] as Prisma.InputJsonValue,
				changeSummary: { changeCount: 0, publicationBase: true } as Prisma.InputJsonValue,
				previousValues: [] as Prisma.InputJsonValue,
				newValues: [] as Prisma.InputJsonValue,
				metadata: {
					publicationBase: true,
					sourceRunVersion: run.version + 1,
					inputFingerprint: currentSnapshot.fingerprint,
					[PUBLISHED_IDENTITY_SNAPSHOT_KEY]: publishedIdentitySnapshot,
				} as Prisma.InputJsonValue,
			},
		});
		if (approvalRequest) {
			const linked = await (tx as unknown as { publicationApprovalRequest: { updateMany(args: unknown): Promise<{ count: number }> } }).publicationApprovalRequest.updateMany({
				where: { id: approvalRequest.id, status: 'APPROVED', approverId: input.actorId },
				data: { publishedRevisionId: revision.id },
			});
			if (linked.count !== 1) throw publicationApprovalError('APPROVAL_NOT_PENDING', 'Approved publication request could not be linked to its revision.');
		}

		const audit = await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				action: 'GENERATION_RUN_PUBLISHED',
				actorId: input.actorId,
				targetIds: [run.id, revision.id],
				metadata: {
					runId: run.id,
					revisionId: revision.id,
					publishedAt: publishedAt.toISOString(),
					sourceRunVersion: run.version + 1,
					inputFingerprint: currentSnapshot.fingerprint,
					hardViolationCount,
					requiredUnassignedCount,
					softViolationCount,
					softViolationsAcknowledged: softViolationCount > 0,
				} as Prisma.InputJsonValue,
			},
		});

		// TIMETABLE-TRUTHFULNESS-C01 (D3) — the stored count is the RAW persisted
		// SOFT row count the operator acknowledged (`countViolations(run.violations,
		// 'SOFT')`, the publication gate's own count). It is NOT the canonical
		// operator-facing count (`buildViolationReport(...).counts.runWide.soft`,
		// which projects exact per-term duplicates and retired rows; run 317 stores
		// 334 raw vs 289 canonical). Stored under an explicitly raw name so no
		// consumer can read it as the canonical count. The legacy
		// `publishedSoftViolationCount` key is deliberately no longer written;
		// already-persisted historical values are left untouched (no migration).
		const nextSummary = {
			...summary,
			isPublished: true,
			publishedAt: publishedAt.toISOString(),
			publishedBy: input.actorId,
			publishedRawSoftViolationCount: softViolationCount,
			softViolationsAcknowledged: softViolationCount > 0,
			publication: {
				contractVersion: 1,
				revisionId: revision.id,
				auditId: audit.id,
				sourceRunVersion: run.version + 1,
				inputFingerprint: currentSnapshot.fingerprint,
			},
		};
		const updated = await tx.generationRun.updateMany({
			where: { id: run.id, schoolId: input.schoolId, schoolYearId: input.schoolYearId, status: 'COMPLETED', version: run.version },
			data: { summary: nextSummary as Prisma.InputJsonValue, version: { increment: 1 } },
		});
		if (updated.count !== 1) throw fail(409, 'PUBLICATION_CONCURRENT_CHANGE', 'The run changed during publication. Retry with current run state.');

		const publishedRun = await tx.generationRun.findUnique({ where: { id: run.id } });
		if (!publishedRun) throw fail(409, 'PUBLICATION_WRITE_INCOMPLETE', 'Publication could not reload its committed run.');
		return {
			run: publishedRun as unknown as Record<string, unknown>,
			revisionId: revision.id,
			auditId: audit.id,
			replayed: false,
		};
	});

	if (committed.replayed) return { ...committed, notificationDelivery: 'DELIVERED' };

	let notificationDelivery: PublishScheduleResult['notificationDelivery'] = 'DELIVERED';
	try {
		publishEvent({
			type: 'SCHEDULE_PUBLISHED',
			schoolId: input.schoolId,
			schoolYearId: input.schoolYearId,
			message: 'Official schedule has been published.',
			metadata: {
				runId: input.runId,
				revisionId: committed.revisionId,
				auditId: committed.auditId,
			},
		});
	} catch {
		notificationDelivery = 'FAILED_AFTER_COMMIT';
	}

	return { ...committed, notificationDelivery };
}
