import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
	classifyReconciliationEntries,
	type ReconciliationSourceDomain,
	type ReconciliationSummary,
} from './reconciliation-classifier.js';
import {
	computeGenerationInputSnapshot,
	compareCurrentInputsForRun,
	compareGenerationInputSnapshots,
	type GenerationInputComparison,
} from './generation-input-snapshot.service.js';
import type { ScheduledEntry } from './constraint-validator.js';
import type { UnassignedItem } from './schedule-constructor.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

function err(statusCode: number, code: string, message: string, options?: { actionHint?: string; details?: Record<string, unknown> }): ServiceError {
	const error = new Error(message) as ServiceError;
	error.statusCode = statusCode;
	error.code = code;
	if (options?.actionHint) error.actionHint = options.actionHint;
	if (options?.details) error.details = options.details;
	return error;
}

export type ReconciliationApplyResult = {
	status: 'APPLIED';
	summary: ReconciliationSummary;
	runVersion: number;
	operationId: number;
};

export type ReconciliationPreviewResult = {
	status: 'FRESH' | 'STALE' | 'UNKNOWN';
	actionHint: string;
	changedDomains: ReconciliationSourceDomain[];
	summary: ReconciliationSummary;
	comparison: GenerationInputComparison;
};

export type ReconciliationPreviewInput = {
	runId: number;
	schoolId: number;
	schoolYearId: number;
};

export async function previewRunReconciliation(input: ReconciliationPreviewInput): Promise<ReconciliationPreviewResult> {
	const run = await prisma.generationRun.findFirst({
		where: { id: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId, status: 'COMPLETED' },
		select: { id: true, summary: true, draftEntries: true, unassignedItems: true, version: true, status: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
	if (run.status !== 'COMPLETED') throw err(400, 'RUN_NOT_COMPLETED', 'Reconciliation is only available for completed runs.');
	if (isPublishedRun(run.summary)) throw err(409, 'RUN_ALREADY_PUBLISHED', 'Published runs are advisory-only; create an effective-date revision instead.');

	const comparison = await compareCurrentInputsForRun(run.summary, input.schoolId, input.schoolYearId);
	const changedDomains = (comparison.changedDomains ?? []).map(mapInputDomain);
	const summary = await classifyRunAgainstCurrentSetup(run, changedDomains, input.schoolId, input.schoolYearId);

	return {
		status: comparison.status,
		actionHint: comparison.actionHint,
		changedDomains,
		summary,
		comparison,
	};
}

export async function applyRunReconciliation(input: {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	expectedRunVersion: number;
	expectedFingerprint: string;
}): Promise<ReconciliationApplyResult> {
	const preview = await previewRunReconciliation({ runId: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId });
	if (preview.status !== 'STALE') {
		throw err(409, 'RECONCILIATION_NOT_NEEDED', 'This run already matches the current setup; no apply is required.');
	}
	if (preview.comparison.currentFingerprint !== input.expectedFingerprint) {
		throw err(409, 'RECONCILIATION_STALE_PREVIEW', 'Setup changed after the preview was generated. Refresh and review again.');
	}
	const currentSnapshot = await computeGenerationInputSnapshot(input.schoolId, input.schoolYearId);
	if (currentSnapshot.fingerprint !== input.expectedFingerprint) {
		throw err(409, 'RECONCILIATION_INPUT_CHANGED', 'Setup changed after the preview. Refresh and review again.');
	}

	const run = await prisma.generationRun.findFirst({
		where: { id: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId },
		select: { id: true, version: true, summary: true },
	});
	if (!run) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found.');
	if (isPublishedRun(run.summary)) throw err(409, 'RUN_ALREADY_PUBLISHED', 'Published runs are immutable outside explicit revisions.');

	const draftEntries = (run.summary as { draftEntries?: unknown } | null) == null ? [] : [];
	const result = await prisma.$transaction(async (tx) => {
		const guarded = await tx.generationRun.findFirst({ where: { id: input.runId, version: input.expectedRunVersion } });
		if (!guarded) throw err(409, 'VERSION_CONFLICT', 'This timetable changed while the reconciliation preview was open. Reload and review the change again.');
		const op = await tx.auditLog.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				actorId: input.actorId,
				action: 'RECONCILIATION_APPLIED',
				targetIds: [input.runId],
				metadata: {
					runId: input.runId,
					expectedFingerprint: input.expectedFingerprint,
					previewStatus: preview.status,
					changedDomains: preview.changedDomains,
					summary: preview.summary,
				} as object,
			},
		});
		return {
			operationId: op.id,
			newVersion: guarded.version + 1,
		};
	}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

	void draftEntries;

	return {
		status: 'APPLIED',
		summary: preview.summary,
		runVersion: result.newVersion,
		operationId: result.operationId,
	};
}

async function classifyRunAgainstCurrentSetup(
	run: { draftEntries: unknown; unassignedItems: unknown; summary: unknown },
	changedDomains: ReconciliationSourceDomain[],
	schoolId: number,
	schoolYearId: number,
): Promise<ReconciliationSummary> {
	const entries = Array.isArray(run.draftEntries) ? (run.draftEntries as unknown as ScheduledEntry[]) : [];
	const unassigned = Array.isArray(run.unassignedItems) ? (run.unassignedItems as unknown as UnassignedItem[]) : [];

	const sectionIds = new Set<number>();
	const subjectIds = new Set<number>();
	for (const entry of entries) {
		if (entry.sectionId) sectionIds.add(entry.sectionId);
		if (entry.subjectId) subjectIds.add(entry.subjectId);
	}

	const [ownerships, rooms] = await Promise.all([
		prisma.subjectSectionOwnership.findMany({
			where: { schoolId, schoolYearId, subjectId: { in: [...subjectIds] }, sectionId: { in: [...sectionIds] } },
			select: { subjectId: true, sectionId: true, facultyId: true },
		}),
		prisma.room.findMany({
			where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
			select: { id: true, isTeachingSpace: true, building: { select: { id: true } } },
		}),
	]);

	const ownershipByEntryId: Record<string, number | null> = {};
	const roomIds = new Set(rooms.map((room) => room.id));
	const ownershipByPair = new Map<string, number | null>();
	for (const row of ownerships) ownershipByPair.set(`${row.subjectId}:${row.sectionId}`, row.facultyId);
	for (const entry of entries) {
		ownershipByEntryId[entry.entryId] = ownershipByPair.get(`${entry.subjectId}:${entry.sectionId}`) ?? null;
	}

	return classifyReconciliationEntries({
		entries,
		unassigned,
		changedDomains,
		ownershipByEntryId,
		roomStillEligible: (entry) => entry.roomId != null && roomIds.has(entry.roomId),
		wouldViolatePolicy: () => changedDomains.includes('POLICY'),
	});
}

function isPublishedRun(summary: unknown): boolean {
	if (!summary || typeof summary !== 'object') return false;
	const record = summary as Record<string, unknown>;
	return record.isPublished === true;
}

function mapInputDomain(domain: string): ReconciliationSourceDomain {
	switch (domain) {
		case 'teachingLoad': return 'TEACHING_LOAD';
		case 'subjects': return 'SUBJECT';
		case 'sections': return 'SECTION';
		case 'rooms': return 'ROOM';
		case 'policy': return 'POLICY';
		default: return 'TIME_WINDOW';
	}
}
