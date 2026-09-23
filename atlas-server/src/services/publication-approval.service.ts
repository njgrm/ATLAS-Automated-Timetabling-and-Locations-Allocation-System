import type { Prisma, PrismaClient } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import { runSerializablePublicationTransaction } from './serializable-transaction-retry.js';
import { hashPublicationRunSnapshot, publicationApprovalError } from './publication-approval-contract.service.js';
import { publishSchedule, type PublishScheduleResult } from './publication-contract.service.js';

export type PublicationApprovalScope = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	actorId: number;
	actorSchoolId: number;
	acknowledgeSoftViolations?: boolean;
};

function validIds(input: PublicationApprovalScope): boolean {
	return [input.schoolId, input.schoolYearId, input.runId, input.actorId, input.actorSchoolId]
		.every((value) => Number.isSafeInteger(value) && value > 0)
		&& input.schoolId === input.actorSchoolId;
}

function normalizeError(error: unknown): never {
	if ((error as { code?: unknown } | null)?.code === 'P2002') {
		throw publicationApprovalError('APPROVAL_REQUEST_EXISTS', 'A publication approval request already exists for this run version.');
	}
	throw error;
}

export async function requestPublicationApproval(
	input: PublicationApprovalScope,
	client: PrismaClient = getDataContext<PrismaClient>(),
): Promise<Record<string, unknown>> {
	if (!validIds(input)) throw Object.assign(new Error('A valid same-school publication request scope is required.'), { statusCode: 403, code: 'APPROVAL_SCOPE_MISMATCH' });
	try {
		return await runSerializablePublicationTransaction(client, async (tx) => {
			await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1::integer, $2::integer)', input.schoolId, input.schoolYearId);
			const run = await tx.generationRun.findFirst({
				where: { id: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId },
				select: { id: true, schoolId: true, schoolYearId: true, version: true, status: true, runType: true, summary: true, violations: true, unassignedItems: true, draftEntries: true },
			});
			if (!run) throw Object.assign(new Error('Generation run was not found in this school/year scope.'), { statusCode: 404, code: 'RUN_NOT_FOUND' });
			if (run.status !== 'COMPLETED' || run.runType !== 'FULL' || (run.summary as Record<string, unknown> | null)?.isPublished === true) {
				throw Object.assign(new Error('Only an unpublished completed full run may be submitted for approval.'), { statusCode: 409, code: 'APPROVAL_RUN_NOT_ELIGIBLE' });
			}
			const latestRevision = await tx.publishedScheduleRevision.findFirst({
				where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId },
				orderBy: [{ effectiveDate: 'desc' }, { id: 'desc' }],
				select: { id: true },
			});
			const request = await (tx as unknown as { publicationApprovalRequest: { create(args: unknown): Promise<unknown> } }).publicationApprovalRequest.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					runId: run.id,
					runVersion: run.version,
					snapshotHash: hashPublicationRunSnapshot(run as unknown as Record<string, unknown>),
					sourceRevisionId: latestRevision?.id ?? null,
					requesterId: input.actorId,
					requesterAcknowledgedSoftViolations: input.acknowledgeSoftViolations === true,
					status: 'PENDING',
				},
			});
			const requestId = Number((request as { id?: unknown } | null)?.id);
			if (!Number.isSafeInteger(requestId) || requestId < 1) throw new Error('Publication approval request did not return a durable identity.');
			await tx.auditLog.create({
				data: {
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					action: 'PUBLICATION_APPROVAL_REQUESTED',
					actorId: input.actorId,
					targetIds: [requestId, run.id],
					metadata: { requestId, requesterId: input.actorId, requestedAt: new Date().toISOString(), runVersion: run.version, sourceRevisionId: latestRevision?.id ?? null },
				},
			});
			return request as Record<string, unknown>;
		});
	} catch (error) {
		return normalizeError(error);
	}
}

export async function approvePublicationRequest(
	input: PublicationApprovalScope & { requestId: number; acknowledgeSoftViolations?: boolean },
	dependencies: { publish?: typeof publishSchedule } = {},
): Promise<PublishScheduleResult> {
	if (!validIds(input) || !Number.isSafeInteger(input.requestId) || input.requestId < 1) {
		throw Object.assign(new Error('A valid same-school approval scope and request id are required.'), { statusCode: 403, code: 'APPROVAL_SCOPE_MISMATCH' });
	}
	const publish = dependencies.publish ?? publishSchedule;
	return publish({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		runId: input.runId,
		actorId: input.actorId,
		actorSchoolId: input.actorSchoolId,
		acknowledgeSoftViolations: input.acknowledgeSoftViolations,
		approvalRequestId: input.requestId,
	});
}

export async function listPendingPublicationApprovals(
	input: Pick<PublicationApprovalScope, 'schoolId' | 'schoolYearId' | 'actorSchoolId'>,
	client: PrismaClient = getDataContext<PrismaClient>(),
): Promise<Array<Record<string, unknown>>> {
	if (![input.schoolId, input.schoolYearId, input.actorSchoolId].every((value) => Number.isSafeInteger(value) && value > 0)
		|| input.schoolId !== input.actorSchoolId) {
		throw Object.assign(new Error('Pending approvals must be read within the authenticated school scope.'), { statusCode: 403, code: 'APPROVAL_SCOPE_MISMATCH' });
	}
	const model = (client as unknown as { publicationApprovalRequest: { findMany(args: unknown): Promise<Array<Record<string, unknown>>> } }).publicationApprovalRequest;
	const requests = await model.findMany({
		where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId, status: 'PENDING' },
		select: { id: true, schoolId: true, schoolYearId: true, runId: true, runVersion: true, requesterId: true, requestedAt: true, requesterAcknowledgedSoftViolations: true, run: { select: { violations: true } } },
		orderBy: { requestedAt: 'asc' },
	});
	return requests.map((request) => {
		const run = request.run as { violations?: unknown } | undefined;
		const softViolationCount = Array.isArray(run?.violations)
			? run.violations.filter((violation) => violation && typeof violation === 'object' && (violation as { severity?: unknown }).severity === 'SOFT').length
			: 0;
		return { ...request, run: undefined, softViolationCount };
	});
}

export type PublicationApprovalTransaction = Prisma.TransactionClient;
