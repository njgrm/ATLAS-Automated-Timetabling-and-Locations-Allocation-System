import { prisma } from '../lib/prisma.js';
import { autoFill } from './teaching-load-automation.service.js';
function err(statusCode, code, message, options) {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.actionHint = options?.actionHint;
    error.details = options?.details;
    return error;
}
function suggestedAssignmentCount(result) {
    if ((result.assignmentsCreated ?? 0) > 0)
        return result.assignmentsCreated;
    const truth = result.staffingTruth;
    if (!truth)
        return 0;
    if (result.coverageMode === 'REAL_FACULTY_STANDARD') {
        return Math.max(0, truth.realOnly.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
    }
    if (result.coverageMode === 'REAL_FACULTY_HARD_CAP') {
        return Math.max(0, truth.hardCap.rowsClosedByRealFaculty - truth.baseline.realCoveredRows);
    }
    return Math.max(0, truth.teacherX.rowsClosedByRealFaculty
        + truth.teacherX.rowsClosedByTeacherX
        - truth.baseline.realCoveredRows
        - truth.baseline.syntheticCoveredRows);
}
function toJsonValue(result) {
    return JSON.parse(JSON.stringify(result));
}
function summarizeProposal(row) {
    return row;
}
export async function createTeachingLoadSuggestionProposal(input) {
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
export async function applyTeachingLoadSuggestionProposal(input) {
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
        coverageMode: existing.coverageMode,
    });
    const applyResult = await autoFill(existing.schoolId, existing.schoolYearId, input.authToken, {
        previewOnly: false,
        coverageMode: existing.coverageMode,
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
        preview: existing.previewPayload,
        refreshedPreview,
        applyResult,
    };
}
export async function cancelTeachingLoadSuggestionProposal(input) {
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
//# sourceMappingURL=teaching-load-suggestion-proposal.service.js.map