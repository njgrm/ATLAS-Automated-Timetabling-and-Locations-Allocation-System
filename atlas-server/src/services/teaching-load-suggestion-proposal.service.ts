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
	suggestedAssignmentBreakdown?: {
		existingRows: number;
		realTeacherRows: number;
		substituteRows: number;
		totalSuggestedRows: number;
		unresolvedRows: number;
	};
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
	const breakdown = suggestedAssignmentBreakdown(result);
	return breakdown.realTeacherRows + breakdown.substituteRows;
}

function suggestedAssignmentBreakdown(result: AutoFillResult): { existingRows: number; realTeacherRows: number; substituteRows: number; totalSuggestedRows: number; unresolvedRows: number } {
	const truth = result.staffingTruth;
	const existingRows = result.preserved ?? 0;
	const unresolvedRows = result.unresolved ?? 0;

	let realTeacherRows = 0;
	let substituteRows = 0;

	if (truth) {
		if (result.coverageMode === 'REAL_FACULTY_STANDARD') {
			realTeacherRows = Math.max(0, truth.realOnly.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
		} else if (result.coverageMode === 'REAL_FACULTY_HARD_CAP') {
			realTeacherRows = Math.max(0, truth.hardCap.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
		} else {
			// REAL_FACULTY_THEN_TEACHER_X
			realTeacherRows = Math.max(0, truth.teacherX.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
			substituteRows = Math.max(0, truth.teacherX.rowsClosedByTeacherX - truth.baseline.syntheticCoveredRows);
		}
	} else {
		realTeacherRows = result.assignmentsCreated ?? 0;
	}

	const totalSuggestedRows = realTeacherRows + substituteRows;
	return { existingRows, realTeacherRows, substituteRows, totalSuggestedRows, unresolvedRows };
}

function toJsonValue(result: AutoFillResult): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
}

type SuggestedRowPreview = {
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionId: number;
	sectionName: string;
	facultyId: number | null;
	facultyName: string;
	assignmentType: 'KEPT_EXISTING' | 'REAL_TEACHER' | 'TEMPORARY_SUBSTITUTE';
	warning?: string | null;
};

function buildSuggestedRowsPreview(
	result: AutoFillResult,
	breakdown: { existingRows: number; realTeacherRows: number; substituteRows: number; totalSuggestedRows: number; unresolvedRows: number },
): SuggestedRowPreview[] {
	const rows: SuggestedRowPreview[] = [];
	const report = result.staffingReport;

	// Build rows from the shortage sections in the staffing report
	let realCount = 0;
	let subCount = 0;
	for (const shortage of report.shortages) {
		for (const section of shortage.sections) {
			if (realCount < breakdown.realTeacherRows) {
				rows.push({
					subjectId: section.subjectId,
					subjectCode: section.subjectCode,
					subjectName: section.subjectName,
					sectionId: section.sectionId,
					sectionName: section.sectionName,
					facultyId: null,
					facultyName: 'Suggested (real teacher)',
					assignmentType: 'REAL_TEACHER',
					warning: null,
				});
				realCount++;
			} else if (subCount < breakdown.substituteRows) {
				rows.push({
					subjectId: section.subjectId,
					subjectCode: section.subjectCode,
					subjectName: section.subjectName,
					sectionId: section.sectionId,
					sectionName: section.sectionName,
					facultyId: null,
					facultyName: 'Temporary substitute',
					assignmentType: 'TEMPORARY_SUBSTITUTE',
					warning: null,
				});
				subCount++;
			}
			if (realCount + subCount >= breakdown.totalSuggestedRows) break;
		}
		if (realCount + subCount >= breakdown.totalSuggestedRows) break;
	}

	return rows;
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
	const breakdown = suggestedAssignmentBreakdown(preview);

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
				suggestedAssignmentCount: breakdown.totalSuggestedRows,
				unresolvedCount: preview.unresolved ?? 0,
				warningCount: preview.warnings.length,
				createdBy: input.actorId || null,
			},
		});
	});

	const suggestedRows = buildSuggestedRowsPreview(preview, breakdown);

	return {
		proposal: { ...summarizeProposal(proposal), suggestedAssignmentBreakdown: breakdown },
		preview: { ...preview, suggestedRows },
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

	const breakdown = suggestedAssignmentBreakdown(refreshedPreview);
	const suggestedRows = buildSuggestedRowsPreview(refreshedPreview, breakdown);

	const updated = await prisma.teachingLoadSuggestionProposal.update({
		where: { id: existing.id },
		data: {
			status: 'APPLIED',
			refreshedPreviewPayload: toJsonValue(refreshedPreview),
			applyPayload: toJsonValue(applyResult),
			suggestedAssignmentCount: breakdown.totalSuggestedRows,
			unresolvedCount: applyResult.unresolved ?? refreshedPreview.unresolved ?? 0,
			warningCount: applyResult.warnings.length,
			appliedBy: input.actorId || null,
			appliedAt: new Date(),
		},
	});

	return {
		proposal: { ...summarizeProposal(updated), suggestedAssignmentBreakdown: breakdown },
		preview: existing.previewPayload as unknown as AutoFillResult,
		refreshedPreview: { ...refreshedPreview, suggestedRows },
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
