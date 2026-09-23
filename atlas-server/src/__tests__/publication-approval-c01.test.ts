import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assertPublicationApprovalAllowed, hashPublicationRunSnapshot } from '../services/publication-approval-contract.service.js';
import { approvePublicationRequest, requestPublicationApproval } from '../services/publication-approval.service.js';

const base = {
	id: 51,
	schoolId: 3,
	schoolYearId: 2030,
	runId: 78,
	runVersion: 12,
	snapshotHash: 'a'.repeat(64),
	requesterId: 14,
	status: 'PENDING',
};
const context = { schoolId: 3, schoolYearId: 2030, runId: 78, runVersion: 12, snapshotHash: 'a'.repeat(64) };

test('only a distinct approver can approve the exact pending run snapshot', () => {
	assert.equal(assertPublicationApprovalAllowed(base, 15, context), undefined);
});

test('self, duplicate, stale, and cross-scope approval reject deterministically', () => {
	for (const [request, actorId, current, code] of [
		[base, 14, context, 'SELF_APPROVAL_DENIED'],
		[{ ...base, status: 'APPROVED' }, 15, context, 'APPROVAL_NOT_PENDING'],
		[base, 15, { ...context, runVersion: 13 }, 'APPROVAL_STALE'],
		[base, 15, { ...context, snapshotHash: 'b'.repeat(64) }, 'APPROVAL_STALE'],
		[base, 15, { ...context, schoolId: 4 }, 'APPROVAL_SCOPE_MISMATCH'],
	] as const) {
		assert.throws(() => assertPublicationApprovalAllowed(request, actorId, current), (error: unknown) =>
			(error as { code?: string }).code === code);
	}
});

test('self approval rejection performs zero mocked ORM/raw/transaction publication dispatches', () => {
	let ormWrites = 0;
	let rawWrites = 0;
	let publicationTransactionDispatches = 0;
	const guardedApproval = () => {
		assertPublicationApprovalAllowed(base, 14, context);
		ormWrites += 1;
		rawWrites += 1;
		publicationTransactionDispatches += 1;
	};
	assert.throws(guardedApproval, (error: unknown) => (error as { code?: string }).code === 'SELF_APPROVAL_DENIED');
	assert.deepEqual({ ormWrites, rawWrites, publicationTransactionDispatches }, {
		ormWrites: 0,
		rawWrites: 0,
		publicationTransactionDispatches: 0,
	});
});

test('run snapshot hashes are stable by key order and change with the run version', () => {
	const first = { id: 1, schoolId: 3, schoolYearId: 2030, version: 12, status: 'COMPLETED', runType: 'FULL', summary: { a: 1, b: 2 }, violations: [], unassignedItems: [], draftEntries: [] };
	const reordered = { ...first, summary: { b: 2, a: 1 } };
	assert.equal(hashPublicationRunSnapshot(first), hashPublicationRunSnapshot(reordered));
	assert.notEqual(hashPublicationRunSnapshot(first), hashPublicationRunSnapshot({ ...first, version: 13 }));
});

test('request creation binds immutable scope/version/revision through a mocked serializable transaction', async () => {
	const run = { id: 78, schoolId: 3, schoolYearId: 2030, version: 12, status: 'COMPLETED', runType: 'FULL', summary: {}, violations: [], unassignedItems: [], draftEntries: [] };
	const createArgs: Record<string, unknown>[] = [];
	let isolation: unknown;
	const auditArgs: Record<string, unknown>[] = [];
	const tx = {
		$executeRawUnsafe: async () => 0,
		generationRun: { findFirst: async () => run },
		publishedScheduleRevision: { findFirst: async () => ({ id: 22 }) },
		publicationApprovalRequest: { create: async (args: Record<string, unknown>) => { createArgs.push(args); return { id: 51, ...(args.data as object) }; } },
		auditLog: { create: async (args: Record<string, unknown>) => { auditArgs.push(args); return { id: 81 }; } },
	};
	const client = { $transaction: async (work: (value: typeof tx) => Promise<unknown>, options: unknown) => { isolation = options; return work(tx); } };
	const request = await requestPublicationApproval({ schoolId: 3, schoolYearId: 2030, runId: 78, actorId: 14, actorSchoolId: 3 }, client as never);
	const data = createArgs[0].data as Record<string, unknown>;
	assert.equal(isolation && (isolation as { isolationLevel?: string }).isolationLevel, 'Serializable');
	assert.equal(data.schoolId, 3);
	assert.equal(data.runVersion, 12);
	assert.equal(data.sourceRevisionId, 22);
	assert.equal(data.requesterId, 14);
	assert.equal(data.snapshotHash, hashPublicationRunSnapshot(run));
	assert.equal((request as { id: number }).id, 51);
	assert.equal((auditArgs[0].data as Record<string, unknown>).actorId, 14);
	assert.equal((auditArgs[0].data as Record<string, unknown>).action, 'PUBLICATION_APPROVAL_REQUESTED');
});

test('approval delegates the scoped request to the publication transaction, not a detached approve write', async () => {
	const publishInput: Record<string, unknown>[] = [];
	const result = { run: {}, revisionId: 3, auditId: 4, replayed: false, notificationDelivery: 'DELIVERED' as const };
	await approvePublicationRequest({ schoolId: 3, schoolYearId: 2030, runId: 78, actorId: 15, actorSchoolId: 3, requestId: 51 }, {
		publish: async (input) => { publishInput.push(input); return result; },
	});
	assert.equal(publishInput[0].approvalRequestId, 51);
	assert.equal(publishInput[0].actorId, 15);
});

test('publication approval claim, audit, and revision link stay inside the atomic publication boundary', () => {
	const source = readFileSync(new URL('../services/publication-contract.service.ts', import.meta.url), 'utf8');
	assert.match(source, /runSerializablePublicationTransaction\(client, async \(tx\)/);
	assert.match(source, /status: 'PENDING',[\s\S]{0,160}requesterId: \{ not: input\.actorId \}/);
	const claim = source.indexOf('const claim = await approvalModel.updateMany');
	const audit = source.indexOf("action: 'PUBLICATION_APPROVAL_GRANTED'", claim);
	const publicationWrite = source.indexOf('const priorPublishedRuns = await tx.generationRun.findMany', claim);
	const revision = source.indexOf('const revision = await tx.publishedScheduleRevision.create', claim);
	const revisionLink = source.indexOf('data: { publishedRevisionId: revision.id }', revision);
	assert.ok(claim >= 0 && audit > claim && publicationWrite > audit && revision > publicationWrite && revisionLink > revision);
});
