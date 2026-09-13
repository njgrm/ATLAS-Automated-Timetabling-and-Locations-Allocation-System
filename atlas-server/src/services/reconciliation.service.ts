import { prisma } from '../lib/prisma.js';
import {
	classifyReconciliationEntries,
	type ReconciliationSourceDomain,
	type ReconciliationSummary,
} from './reconciliation-classifier.js';
import {
	compareCurrentInputsForRun,
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
	/**
	 * B-02 / D3: the run-reconciliation apply mutation is retired. This preview
	 * is advisory-only and cannot authorize a write. Callers must use the
	 * canonical Teaching Load reconciliation apply for real ownership changes.
	 */
	nonAuthorizing: true;
	applyRetired: true;
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
		nonAuthorizing: true,
		applyRetired: true,
	};
}

/**
 * B-02 / D3 retirement. The previous implementation returned `APPLIED` with a
 * fabricated `runVersion + 1` while only writing an audit row, so a caller
 * could believe a reconciliation had been persisted when nothing changed.
 *
 * There is no production client caller and no real reconciliation engine on
 * this path, so the mutation is retired: a bounded, typed 410 that never
 * writes. Callers are routed to the canonical Teaching Load reconciliation
 * apply, which has a real fingerprinted preview/apply contract. Keep this
 * exported so any stale importer fails closed instead of resurrecting the
 * phantom success.
 */
export const RECONCILIATION_APPLY_RETIRED_CODE = 'RECONCILIATION_APPLY_RETIRED';

export async function applyRunReconciliation(input: {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	expectedRunVersion: number;
	expectedFingerprint: string;
}): Promise<ReconciliationApplyResult> {
	void input;
	throw err(
		410,
		RECONCILIATION_APPLY_RETIRED_CODE,
		'Run reconciliation is preview-only; the apply mutation is retired because it never persisted a reconciled schedule. Use the canonical Teaching Load reconciliation apply instead.',
	);
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

/**
 * Canonical strict publication predicate (B-11 / CP-2). Only an explicit
 * `isPublished === true` marks a run as published. Legacy `publishedAt` /
 * `publishedBy` markers left on a superseded or unpublished run are
 * informational and must never redirect it into revision behavior.
 */
export function isStrictlyPublishedSummary(summary: unknown): boolean {
	if (!summary || typeof summary !== 'object' || Array.isArray(summary)) return false;
	return (summary as Record<string, unknown>).isPublished === true;
}

function isPublishedRun(summary: unknown): boolean {
	return isStrictlyPublishedSummary(summary);
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
