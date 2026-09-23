import { createHash } from 'node:crypto';

export type PublicationApprovalRequestSnapshot = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	runId: number;
	runVersion: number;
	snapshotHash: string;
	requesterId: number;
	status: string;
};

export type PublicationApprovalContext = {
	schoolId: number;
	schoolYearId: number;
	runId: number;
	runVersion: number;
	snapshotHash: string;
};

export function publicationApprovalError(code: string, message: string): Error & { statusCode: number; code: string } {
	return Object.assign(new Error(message), { statusCode: 409, code });
}

export function assertPublicationApprovalAllowed(
	request: PublicationApprovalRequestSnapshot,
	approverId: number,
	current: PublicationApprovalContext,
): void {
	if (request.status !== 'PENDING') throw publicationApprovalError('APPROVAL_NOT_PENDING', 'Publication approval request is not pending.');
	if (request.requesterId === approverId) throw publicationApprovalError('SELF_APPROVAL_DENIED', 'A requester cannot approve their own publication request.');
	if (request.schoolId !== current.schoolId || request.schoolYearId !== current.schoolYearId || request.runId !== current.runId) {
		throw publicationApprovalError('APPROVAL_SCOPE_MISMATCH', 'Publication approval request does not match the authenticated school/run scope.');
	}
	if (request.runVersion !== current.runVersion || request.snapshotHash !== current.snapshotHash) {
		throw publicationApprovalError('APPROVAL_STALE', 'The run changed after this publication request was submitted. Submit a new request.');
	}
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const object = value as Record<string, unknown>;
	return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

export function hashPublicationRunSnapshot(run: Record<string, unknown>): string {
	const snapshot = {
		id: run.id,
		schoolId: run.schoolId,
		schoolYearId: run.schoolYearId,
		version: run.version,
		status: run.status,
		runType: run.runType,
		summary: run.summary,
		violations: run.violations,
		unassignedItems: run.unassignedItems,
		draftEntries: run.draftEntries,
	};
	return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}
