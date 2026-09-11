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
};

export type PublishScheduleResult = {
	run: Record<string, unknown>;
	revisionId: number;
	auditId: number;
	replayed: boolean;
	notificationDelivery: 'DELIVERED' | 'FAILED_AFTER_COMMIT';
};

type PublicationDependencies = {
	now?: () => Date;
	publishEvent?: (event: PublishEvent) => unknown;
	computeInputSnapshot?: (
		schoolId: number,
		schoolYearId: number,
		client: Prisma.TransactionClient | PrismaClient,
	) => Promise<GenerationInputSnapshot>;
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

function countRequiredUnassigned(unassignedItems: unknown): number {
	if (!Array.isArray(unassignedItems)) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run has no valid unassigned-session snapshot.');
	}
	if (unassignedItems.some((item) => !asRecord(item))) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'The selected run contains a malformed unassigned-session record.');
	}
	return unassignedItems.length;
}

function validateScheduleEntries(entries: unknown): asserts entries is Array<Record<string, unknown>> {
	if (!Array.isArray(entries) || entries.some((entry) => {
		const record = asRecord(entry);
		return !record || typeof record.entryId !== 'string' || ![1, 2, 3].includes(Number(record.termIndex));
	})) {
		throw fail(422, 'PUBLICATION_RUN_MALFORMED', 'Every published entry must have an identity and termIndex 1, 2, or 3.');
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
	const client = getDataContext<PrismaClient>();
	const now = dependencies.now ?? (() => new Date());
	const computeSnapshot = dependencies.computeInputSnapshot ?? computeGenerationInputSnapshot;
	const publishEvent = dependencies.publishEvent ?? publishPublishedScheduleEvent;

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
		validateScheduleEntries(run.draftEntries);
		const hardViolationCount = countViolations(run.violations, 'HARD');
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
		const currentSnapshot = await computeSnapshot(input.schoolId, input.schoolYearId, tx);
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
				effectiveDate: publishedAt,
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
				} as Prisma.InputJsonValue,
			},
		});

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

		const nextSummary = {
			...summary,
			isPublished: true,
			publishedAt: publishedAt.toISOString(),
			publishedBy: input.actorId,
			publishedSoftViolationCount: softViolationCount,
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
