import { Prisma, type TeachingLoadSuggestionStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { autoFill, type AutoFillResult, type CoverageMode } from './teaching-load-automation.service.js';

type ServiceError = Error & {
	statusCode: number;
	code: string;
	actionHint?: string;
	details?: Record<string, unknown>;
};

type ProposalSummary = {
	id: number;
	schoolId: number;
	schoolYearId: number;
	coverageMode: string;
	status: TeachingLoadSuggestionStatus;
	sectionSource: string | null;
	sectionFallbackReason: string | null;
	suggestedAssignmentCount: number;
	unresolvedCount: number;
	warningCount: number;
	createdBy: number | null;
	appliedBy: number | null;
	createdAt: Date;
	updatedAt: Date;
	appliedAt: Date | null;
	cancelledAt: Date | null;
};

export type TeachingLoadSuggestionProposalResult = {
	proposal: ProposalSummary;
	preview: AutoFillResult;
	refreshedPreview?: AutoFillResult;
	applyResult?: AutoFillResult;
};

export type TeachingLoadSuggestionProposalStatusResult = {
	proposal: ProposalSummary;
};

function err(
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

function suggestedAssignmentCount(result: AutoFillResult): number {
	if ((result.assignmentsCreated ?? 0) > 0) return result.assignmentsCreated;
	const truth = result.staffingTruth;
	if (!truth) return 0;
	if (result.coverageMode === 'REAL_FACULTY_STANDARD') {
		return Math.max(0, truth.realOnly.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
	}
	if (result.coverageMode === 'REAL_FACULTY_HARD_CAP') {
		return Math.max(0, truth.hardCap.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
	}
	return Math.max(
		0,
		truth.teacherX.rowsClosedByRealFaculty
			+ truth.teacherX.rowsClosedByTeacherX
			- truth.baseline.realCoveredRows
			- truth.baseline.syntheticCoveredRows,
	);
}

function toJsonValue(result: AutoFillResult): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}

function summarizeProposal(row: ProposalSummary): ProposalSummary {
	return row;
}

export async function createTeachingLoadSuggestionProposal(input: {
	schoolId: number;
	schoolYearId: number;
	actorId: number;
	authToken?: string;
	coverageMode?: CoverageMode;
}): Promise<TeachingLoadSuggestionProposalResult> {
	const preview = await autoFill(input.schoolId, input.schoolYearId, input.authToken, {
		previewOnly: true,
		coverageMode: input.coverageMode,
	});
	const suggestedCount = suggestedAssignmentCount(preview);

	const proposal = await prisma.$transaction(async (tx) => {
		await tx.teachingLoadSuggestionProposal.updateMany({
			where: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				status: 'PENDING',
			},
			data: {
				status: 'SUPERSEDED',
				cancelledAt: new Date(),
			},
		});

		return tx.teachingLoadSuggestionProposal.create({
			data: {
				schoolId: input.schoolId,
				schoolYearId: input.schoolYearId,
				coverageMode: preview.coverageMode,
				status: 'PENDING',
				previewPayload: toJsonValue(preview),
				sectionSource: preview.sectionSource,
				sectionFallbackReason: preview.sectionFallbackReason,
				suggestedAssignmentCount: suggestedCount,
				unresolvedCount: preview.unresolved ?? 0,
				warningCount: preview.warnings.length,
				createdBy: input.actorId || null,
			},
		});
	});

	return {
		proposal: summarizeProposal(proposal),
		preview,
	};
}

export async function applyTeachingLoadSuggestionProposal(input: {
	proposalId: number;
	actorId: number;
	authToken?: string;
}): Promise<TeachingLoadSuggestionProposalResult> {
	const existing = await prisma.teachingLoadSuggestionProposal.findUnique({
		where: { id: input.proposalId },
	});

	if (!existing) {
		throw err(404, 'TEACHING_LOAD_PROPOSAL_NOT_FOUND', 'This Teaching Load suggestion no longer exists.', {
			actionHint: 'Preview a new Teaching Load suggestion, then apply it after review.',
		});
	}

	if (existing.status !== 'PENDING') {
		throw err(409, 'TEACHING_LOAD_PROPOSAL_NOT_PENDING', 'This Teaching Load suggestion has already been used or replaced.', {
			actionHint: 'Preview a fresh Teaching Load suggestion before applying changes.',
			details: { status: existing.status },
		});
	}

	const refreshedPreview = await autoFill(existing.schoolId, existing.schoolYearId, input.authToken, {
		previewOnly: true,
		coverageMode: existing.coverageMode as CoverageMode,
	});

	const applyResult = await autoFill(existing.schoolId, existing.schoolYearId, input.authToken, {
		previewOnly: false,
		coverageMode: existing.coverageMode as CoverageMode,
	});

	const updated = await prisma.teachingLoadSuggestionProposal.update({
		where: { id: existing.id },
		data: {
			status: 'APPLIED',
			refreshedPreviewPayload: toJsonValue(refreshedPreview),
			applyPayload: toJsonValue(applyResult),
			suggestedAssignmentCount: suggestedAssignmentCount(refreshedPreview),
			unresolvedCount: applyResult.unresolved ?? refreshedPreview.unresolved ?? 0,
			warningCount: applyResult.warnings.length,
			appliedBy: input.actorId || null,
			appliedAt: new Date(),
		},
	});

	return {
		proposal: summarizeProposal(updated),
		preview: existing.previewPayload as unknown as AutoFillResult,
		refreshedPreview,
		applyResult,
	};
}

export async function cancelTeachingLoadSuggestionProposal(input: {
	proposalId: number;
}): Promise<TeachingLoadSuggestionProposalStatusResult> {
	const existing = await prisma.teachingLoadSuggestionProposal.findUnique({
		where: { id: input.proposalId },
	});

	if (!existing) {
		throw err(404, 'TEACHING_LOAD_PROPOSAL_NOT_FOUND', 'This Teaching Load suggestion no longer exists.', {
			actionHint: 'Preview a new Teaching Load suggestion if you still want ATLAS to prepare one.',
		});
	}

	if (existing.status === 'APPLIED') {
		throw err(409, 'TEACHING_LOAD_PROPOSAL_ALREADY_APPLIED', 'This Teaching Load suggestion was already applied.', {
			actionHint: 'Use the Teaching Load draft controls to undo or revise the saved draft.',
			details: { status: existing.status },
		});
	}

	if (existing.status !== 'PENDING') {
		return { proposal: summarizeProposal(existing) };
	}

	const updated = await prisma.teachingLoadSuggestionProposal.update({
		where: { id: existing.id },
		data: {
			status: 'CANCELLED',
			cancelledAt: new Date(),
		},
	});

	return { proposal: summarizeProposal(updated) };
}
