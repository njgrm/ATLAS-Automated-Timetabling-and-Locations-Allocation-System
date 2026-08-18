import { type TeachingLoadSuggestionStatus } from '@prisma/client';
import { type AutoFillResult, type CoverageMode } from './teaching-load-automation.service.js';
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
        newSuggestedRows: number;
        previewRowCount: number;
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
export declare function createTeachingLoadSuggestionProposal(input: {
    schoolId: number;
    schoolYearId: number;
    actorId: number;
    authToken?: string;
    coverageMode?: CoverageMode;
}): Promise<TeachingLoadSuggestionProposalResult>;
export declare function applyTeachingLoadSuggestionProposal(input: {
    proposalId: number;
    actorId: number;
    authToken?: string;
}): Promise<TeachingLoadSuggestionProposalResult>;
export declare function cancelTeachingLoadSuggestionProposal(input: {
    proposalId: number;
}): Promise<TeachingLoadSuggestionProposalStatusResult>;
export {};
