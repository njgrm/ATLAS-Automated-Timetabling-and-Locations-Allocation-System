import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPublicationApprovalAllowed } from '../services/publication-approval-contract.service.js';

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
