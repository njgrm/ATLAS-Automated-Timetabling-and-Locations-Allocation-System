import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, History, UserRound } from 'lucide-react';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/sheet';
import { cn } from '@/lib/utils';

import atlasApi from '@/lib/api';
import {
	computeSectionAssignmentDeltaMinutes,
	buildGuidedEmptyTeachingLoadMessage,
	resolveEffectiveLoadBaselineHours,
} from '@/lib/faculty-assignment-helpers';
import { COVERAGE_MODE_CONFIG, formatTeachingLoadSaveError, buildSectionsBySubject, transferExactSectionPair, buildSaveCommitReceipt } from '@/lib/teaching-load-helpers';
import { appliedSuggestionMessage, teachingLoadShortageNote } from '@/lib/teaching-load-suggestion-presentation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { createScopeEpoch, captureEpoch } from '@/lib/scope-request-epoch';
import { useTeachingLoadData } from '@/hooks/useTeachingLoadData';
import { useTeachingLoadUI } from '@/hooks/useTeachingLoadUI';
import { useTeachingLoadOutage } from '@/hooks/useTeachingLoadOutage';
import { useTeachingLoadHeaderClaims } from '@/components/faculty-assignments/useTeachingLoadHeaderClaims';
import { TeacherGridMode } from '@/components/faculty-assignments/TeacherGridMode';
import { SectionGridMode } from '@/components/faculty-assignments/SectionGridMode';
import { TeachingLoadInspectorPanel } from '@/components/faculty-assignments/TeachingLoadInspectorPanel';
import { WorkspaceToolbar, isTeachingLoadSourceDegraded } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadRepairQueue } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { TeachingLoadDraftActionBar } from '@/components/faculty-assignments/TeachingLoadDraftActionBar';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
import { TeachingLoadInspectorTriggers } from '@/components/faculty-assignments/TeachingLoadInspectorTriggers';
import { TeachingLoadSummarySurface } from '@/components/faculty-assignments/TeachingLoadSummarySurface';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import {
	buildCompletedSectionIds,
	buildTeachingLoadWorkspaceState,
	countTeachersAboveWeeklyMax,
} from '@/components/faculty-assignments/teachingLoadWorkspaceMetrics';
// A6-TL-DEMAND-SOURCE-C01 correction: the page's unpinned pure view-model and
// its sr-only workflow steps, extracted so the page keeps headroom under the
// AGENTS.md §8 cap after merging `origin/main`.
import { useTeachingLoadWorkspaceModel } from '@/components/faculty-assignments/useTeachingLoadWorkspaceModel';
import { TeachingLoadWorkflowSteps } from '@/components/faculty-assignments/TeachingLoadWorkflowSteps';
import { useTeachingLoadRepairQueue } from '@/hooks/useTeachingLoadRepairQueue';
import { useTeachingLoadLanding } from '@/hooks/useTeachingLoadLanding';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import type {
	AutoFillSummaryResult, 
	SectionAssignedClassesResult,
} from '@/types';

export default function TeachingLoad() {
	const data = useTeachingLoadData();
	const [searchParams, setSearchParams] = useSearchParams();
	const ui = useTeachingLoadUI({
		faculty: data.faculty,
		subjects: data.subjects,
		selected: data.selected,
		currentAssignments: data.effectiveAssignmentsByFaculty[data.selectedId ?? 0] ?? [],
		effectiveAssignmentsByFaculty: data.effectiveAssignmentsByFaculty,
		sectionMap: data.sectionMap,
		workloadPolicy: data.workloadPolicy,
		workloadPolicyStatus: data.workloadPolicyStatus,
	});

	const [autoFillResult, setAutoFillResult] = useState<AutoFillSummaryResult | null>(null);
	const [suggestionProposalId, setSuggestionProposalId] = useState<number | null>(null);
	const [suggestionLoading, setSuggestionLoading] = useState(false);
	const [suggestionApplying, setSuggestionApplying] = useState(false);
	const [hasGeneratedRuns, setHasGeneratedRuns] = useState(false);
	const [showSaveWarning, setShowSaveWarning] = useState(false);
	const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
	// Phase 4.8: the inspector is hard-cut below lg. A mobile Sheet restores
	// access to the teacher/section load profile on small screens.
	const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
	// Fix 26: the always-on desktop inspector column is gone. The same content is
	// now on demand behind `Review teachers`, which returns the full 320px to the
	// assignment workspace on every large viewport.
	const [reviewModalOpen, setReviewModalOpen] = useState(false);
	/*
	 * A6 c4 (G1) — `advancedGridVisible` is GONE, and `a2c4c135` is the docs-only
	 * fold the operator packet named as "Guided mode removed"; the gate it claimed
	 * to have removed was still live at `ce1257c8`, so the page could turn the
	 * grid OFF for an empty year and a scheduler met a placeholder instead of the
	 * roster. `guidedDefaultApplied` STAYS, and it is not the gate: it is the
	 * one-shot guard that keeps the empty-year status message from being
	 * re-announced on every later render.
	 */
	const [guidedDefaultApplied, setGuidedDefaultApplied] = useState(false);
	const [draftStatusMessage, setDraftStatusMessage] = useState('No draft changes yet. Start with the next step below.');
	// FIX 40: `Save changes` opens a confirmation rather than committing.
	const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

	useEffect(() => {
		if (data.schoolId && data.activeSchoolYearId) {
			atlasApi.get(`/generation/${data.schoolId}/${data.activeSchoolYearId}/runs`, { params: { limit: 1 } })
				.then(({ data: res }) => {
					setHasGeneratedRuns(res.runs && res.runs.length > 0);
				})
				.catch(() => {
					setHasGeneratedRuns(false);
				});
		}
	}, [data.schoolId, data.activeSchoolYearId]);

	// A6-TL-DEEPLINK: the URL intent is NOT applied here any more — at this point
	// the roster is empty and the scope unresolved, which is the load-order loss
	// the packet fixes; both entry paths queue a target via `useTeachingLoadLanding`.

	// A rollover or school switch must reset every mutable filter, dialog, and
	// selection before the new scope renders. Draft/history clearing lives in the
	// data and history hooks.
	const scopeEpochRef = useRef(createScopeEpoch());
	const { resetForScope } = ui;
	useEffect(() => {
		// Opening a new epoch invalidates every in-flight Teaching Load response so
		// a late reply from the previous school/year can never repopulate the
		// suggestion, proposal, or applying state of the new scope.
		scopeEpochRef.current.begin();
		resetForScope();
		setSuggestionProposalId(null);
		setAutoFillResult(null);
		setSuggestionLoading(false);
		setSuggestionApplying(false);
	}, [data.scopeKey, resetForScope]);

	// A6-TL-DEEPLINK: declared AFTER the scope-reset effect so the reset runs
	// first on the resolving commit; `ready` gates on scope AND loaded roster.
	const landingReady = data.scopeKey != null && !data.loading && data.faculty.length > 0;
	const { landed: landedTarget, landTarget } = useTeachingLoadLanding({
		searchParams,
		ready: landingReady,
		setViewMode: ui.setViewMode,
		setSelectedId: data.setSelectedId,
		setSelectedSectionId: ui.setSelectedSectionId,
		setSectionModeFilter: ui.setSectionModeFilter,
		setSelectedSubjectId: ui.setSelectedSubjectId,
		setSubjectSearch: ui.setSubjectSearch,
		setLoadFilter: ui.setLoadFilter,
		setFilterStatus: ui.setFilterStatus,
		setShowTemporaryRoles: ui.setShowTemporaryRoles,
	});
	const landingOpenEditorFacultyId = landedTarget?.openEditor ? landedTarget.facultyId : null;
	const missingCoverageSubjectId = landedTarget?.missingCoverageOnly ? landedTarget.subjectId : null;

	// A6 c5 — the derivations below moved to `teachingLoadWorkspaceMetrics.ts`
	// (which records the extraction and its reason); the page decides WHEN.
	const completedSectionIds = useMemo(
		() => buildCompletedSectionIds({
			sections: data.allKnownSections,
			subjects: data.subjects,
			savedOwnershipMap: data.savedOwnershipMap,
			pendingOwnershipMap: data.pendingOwnershipMap,
			activeFacultyIds: data.activeFacultyIds,
			// A6-TL-DEMAND-SOURCE-C01: the tick's pair universe is the server's
			// canonical demand set, the same one readiness reads.
			canonicalPairs: data.coverageTotals?.teachingLoadDemandPairs,
		}),
		[data.allKnownSections, data.subjects, data.savedOwnershipMap, data.pendingOwnershipMap, data.activeFacultyIds, data.coverageTotals?.teachingLoadDemandPairs],
	);

	const handleSave = useCallback(async (force?: boolean) => {
		if (!data.schoolId || !data.activeSchoolYearId) return;
		const schoolId = data.schoolId;
		const draftEntries = Object.entries(data.effectiveDraftAssignmentsByFaculty);
		if (draftEntries.length === 0) return;

		if (hasGeneratedRuns && !force) {
			setDraftStatusMessage('Review the timetable sync warning before saving these Teaching Load changes.');
			setShowSaveWarning(true);
			return;
		}

		data.setSaving(true);
		// Each PUT is one atomic, revision-checked, serializable transaction for a
		// single teacher. Because a multi-teacher draft cannot be committed as one
		// transaction through this contract, the save stops at the first failure
		// and reports the exact teacher records that committed so the operator is
		// never told a partial save succeeded.
		const committed: number[] = [];
		let failedFacultyId: number | null = null;
		let readableError = '';
		try {
			for (const [facultyIdRaw, assignments] of draftEntries) {
				const facultyId = Number(facultyIdRaw);
				if (!Number.isFinite(facultyId)) continue;
				const facultyRow = data.faculty.find((member) => member.id === facultyId);
				if (!facultyRow) continue;
				try {
					await atlasApi.put(`/faculty-assignments/${facultyId}`, {
						schoolId,
						schoolYearId: data.activeSchoolYearId,
						version: facultyRow.version,
						facultyId,
						assignments,
					});
					committed.push(facultyId);
				} catch (error: any) {
					failedFacultyId = facultyId;
					readableError = formatTeachingLoadSaveError(error);
					throw error;
				}
			}
			const message = draftEntries.length === 1 && data.selected
				? `Saved Teaching Load for ${data.selected.lastName}.`
				: `Saved ${committed.length} Teaching Load draft ${committed.length === 1 ? 'change' : 'changes'}.`;
			toast.success(message);
			setDraftStatusMessage(message);
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			const conflict = error?.response?.data?.code === 'VERSION_CONFLICT';
			if (conflict || committed.length > 0) {
				await data.fetchData({ forceRefresh: true });
			}
			const committedNames = committed
				.map((id) => data.faculty.find((member) => member.id === id))
				.filter((member): member is NonNullable<typeof member> => Boolean(member))
				.map((member) => member.lastName);
			const failedName = failedFacultyId != null
				? data.faculty.find((member) => member.id === failedFacultyId)?.lastName ?? `faculty ${failedFacultyId}`
				: null;
			const receipt = buildSaveCommitReceipt({
				committedLastNames: committedNames,
				failedLastName: failedName,
				error: readableError,
			});
			toast.error(receipt);
			setDraftStatusMessage(receipt);
		} finally {
			data.setSaving(false);
		}
	}, [data, hasGeneratedRuns]);

	const handleSetSections = useCallback((subjectId: number, sectionIds: number[], facultyId?: number) => {
		const targetId = facultyId ?? data.selectedId;
		if (!targetId) return;
		data.pushHistory();
		data.setDraftAssignmentsByFaculty((prev) => {
			const current = [...(prev[targetId] ?? data.savedAssignmentsByFaculty[targetId] ?? [])];
			const index = current.findIndex((a) => a.subjectId === subjectId);
			if (index >= 0) {
				if (sectionIds.length === 0) current.splice(index, 1);
				else current[index] = { ...current[index], sectionIds };
			} else if (sectionIds.length > 0) {
				current.push({ subjectId, sectionIds, gradeLevels: [] });
			}
			return { ...prev, [targetId]: current };
		});
		setDraftStatusMessage('Draft updated. Review the workload impact, then save when ready.');
	}, [data]);

	const handleSwapRequest = useCallback((subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => {
		// Exact-pair transfer only. The operator selected one subject-section pair;
		// only that pair moves. We never pick another section by array position or
		// display order, and we never silently convert this into a two-way exchange.
		const result = transferExactSectionPair({
			assignmentsByFaculty: data.effectiveAssignmentsByFaculty,
			savedAssignmentsByFaculty: data.savedAssignmentsByFaculty,
			subjectId,
			sectionId,
			fromFacultyId,
			toFacultyId: toFacultyId ?? data.selectedId,
		});
		if (!result.ok) {
			toast.error(result.message);
			return;
		}

		data.pushHistory();
		data.setDraftAssignmentsByFaculty((prev) => ({ ...prev, ...result.updates }));
		toast.success('Section transferred in draft mode.');
		setDraftStatusMessage('Section transferred in draft mode. Save the draft when the review looks correct.');
	}, [data]);

	const handlePreviewSuggestedTeachingLoad = useCallback(async () => {
		if (!data.schoolId || !data.activeSchoolYearId) return;
		// Anything that changes the scope after dispatch makes this reply obsolete.
		const stillCurrent = captureEpoch(scopeEpochRef.current);
		setSuggestionLoading(true);
		setAutoFillResult(null);
		setSuggestionProposalId(null);
		ui.setSummaryModalOpen(true);
		const toastId = toast.loading(`Preparing Teaching Load suggestion (${COVERAGE_MODE_CONFIG[ui.coverageMode].label})...`);
		try {
			const { data: result } = await atlasApi.post<{
				proposal: { id: number; status: string; suggestedAssignmentCount: number; unresolvedCount: number; suggestedAssignmentBreakdown?: import('@/types').SuggestedAssignmentBreakdown };
				preview: AutoFillSummaryResult;
			}>(
				'/faculty-assignments/suggestion-proposals',
				{
					schoolId: data.schoolId,
					schoolYearId: data.activeSchoolYearId,
					coverageMode: ui.coverageMode,
				},
			);
			if (!stillCurrent()) return;
			setSuggestionProposalId(result.proposal.id);
			setAutoFillResult({
				...result.preview,
				suggestedAssignmentBreakdown: result.proposal.suggestedAssignmentBreakdown,
			});
			
			/*
			 * A6 c5 S9 — the PRE-HOTFIX wording is gone. This branch used to say
			 * `… but some classes still need scheduler review.`, which names
			 * neither a number nor a subject. It now reads the same
			 * `N classes still need a real teacher` sentence the page and the
			 * modal share. `unresolved` on a PREVIEW counts temporary-substitute
			 * rows, which are never saved, so it is exactly that count.
			 */
			const unresolvedCount = result.preview.unresolved ?? 0;
			if (unresolvedCount > 0) {
				const message = teachingLoadShortageNote(unresolvedCount, 0);
				setDraftStatusMessage(message);
				toast.warning(message, { id: toastId });
			} else {
				const message = 'Teaching Load suggestion is ready. Review it before applying.';
				setDraftStatusMessage(message);
				toast.success(message, { id: toastId });
			}
		} catch (error: any) {
			if (!stillCurrent()) return;
			const message = error?.response?.data?.message ?? 'ATLAS could not prepare a Teaching Load suggestion. Refresh the source and try again.';
			setDraftStatusMessage(message);
			toast.error(message, { id: toastId });
		} finally {
			if (stillCurrent()) setSuggestionLoading(false);
		}
	}, [data.activeSchoolYearId, data.schoolId, ui]);

	const suggestionApplyDisabledReason = useMemo(() => {
		if (!autoFillResult) return 'Preview a Teaching Load suggestion before applying it.';
		if (!suggestionProposalId) return 'ATLAS needs to save this preview as a proposal before it can be applied.';
		if (!data.activeSchoolYearId) return 'ATLAS needs an active school year before applying a Teaching Load suggestion.';
		if (!data.isOnline) return 'Saving is disabled while ATLAS is offline.';
		if (data.dataSource === 'refreshing') return 'Wait for source verification before applying a Teaching Load suggestion.';
		if (!data.canPersistAssignments) return 'ATLAS must verify writable Teaching Load data before applying a suggestion.';
		if (suggestionApplying) return 'ATLAS is applying the suggested Teaching Load now.';
		return null;
	}, [autoFillResult, data.activeSchoolYearId, data.canPersistAssignments, data.dataSource, data.isOnline, suggestionApplying, suggestionProposalId]);

	const handleApplySuggestedTeachingLoad = useCallback(async () => {
		if (suggestionApplyDisabledReason || !data.activeSchoolYearId || !suggestionProposalId) {
			const message = suggestionApplyDisabledReason ?? 'Preview a Teaching Load suggestion before applying it.';
			setDraftStatusMessage(message);
			toast.error(message);
			return;
		}
		setSuggestionApplying(true);
		// The apply reply is bound to the scope that dispatched it. A stale reply
		// must not mutate the new scope's modal, status, or proposal state.
		const stillCurrent = captureEpoch(scopeEpochRef.current);
		const toastId = toast.loading('Applying suggested Teaching Load...');
		try {
			const { data: result } = await atlasApi.post<{
				proposal: { id: number; status: string; suggestedAssignmentCount: number; unresolvedCount: number; suggestedAssignmentBreakdown?: import('@/types').SuggestedAssignmentBreakdown };
				preview: AutoFillSummaryResult;
				refreshedPreview?: AutoFillSummaryResult;
				applyResult?: AutoFillSummaryResult;
			}>(`/faculty-assignments/suggestion-proposals/${suggestionProposalId}/apply`);
			// Use refreshedPreview for the modal display (it has suggestedRows and breakdown)
			// The applyResult is the actual apply result which may not have preview data
			if (!stillCurrent()) return;
			const displayResult = result.refreshedPreview ?? result.preview;
			setAutoFillResult({
				...displayResult,
				suggestedAssignmentBreakdown: result.proposal.suggestedAssignmentBreakdown,
			});
			const unresolvedCount = (result.applyResult ?? displayResult).unresolved ?? 0;
			// `unresolved` on the apply result counts temporary-substitute rows,
			// which are never saved: they are the classes still without a teacher.
			const message = appliedSuggestionMessage(unresolvedCount);
			setDraftStatusMessage(message);
			setSuggestionProposalId(null);
			toast.success(message, { id: toastId });
			await data.fetchData({ forceRefresh: true });
			if (stillCurrent()) ui.setSummaryModalOpen(false);
		} catch (error: any) {
			if (!stillCurrent()) return;
			const message = error?.response?.data?.actionHint ?? error?.response?.data?.message ?? 'ATLAS could not apply the suggested Teaching Load. It is safe to retry after refreshing the source.';
			setDraftStatusMessage(message);
			toast.error(message, { id: toastId });
		} finally {
			if (stillCurrent()) setSuggestionApplying(false);
		}
	}, [data, suggestionApplyDisabledReason, suggestionProposalId, ui]);

	const handleCancelPendingSuggestionProposal = useCallback(async (options?: { silent?: boolean }) => {
		const proposalId = suggestionProposalId;
		if (!proposalId || suggestionApplying) return;
		const stillCurrent = captureEpoch(scopeEpochRef.current);
		try {
			await atlasApi.post(`/faculty-assignments/suggestion-proposals/${proposalId}/cancel`);
			if (!stillCurrent()) return;
			setSuggestionProposalId(null);
			if (!options?.silent) {
				setDraftStatusMessage('Teaching Load suggestion cancelled. No Teaching Load rows were changed.');
			}
		} catch (error: any) {
			if (!stillCurrent()) return;
			const message = error?.response?.data?.actionHint ?? error?.response?.data?.message ?? 'ATLAS could not cancel this Teaching Load suggestion. Refresh the page before applying a new suggestion.';
			setDraftStatusMessage(message);
			if (!options?.silent) toast.error(message);
		}
	}, [suggestionApplying, suggestionProposalId]);

	const handleSummaryModalOpenChange = useCallback((open: boolean) => {
		ui.setSummaryModalOpen(open);
		if (!open) {
			void handleCancelPendingSuggestionProposal();
		}
	}, [handleCancelPendingSuggestionProposal, ui]);

	const discardAllDrafts = useCallback(() => {
		if (data.activeDraftCount === 0) return;
		data.pushHistory();
		data.setDraftAssignmentsByFaculty({});
		setDraftStatusMessage('All Teaching Load draft changes were discarded.');
		toast.info('All Teaching Load draft changes discarded.');
	}, [data]);

	// A6-TL-DEMAND-SOURCE-C01 correction: `resolveSectionHoverDeltaMinutes`,
	// `previewLoadHours`, `placeholderFacultyIds`, `coverageHeadline`,
	// `truthModel`, `truthUnresolvedReasons`, and the review-modal copy moved
	// VERBATIM into `useTeachingLoadWorkspaceModel` — the page's unpinned
	// view-model derivations. The page still decides WHEN to recompute; the hook
	// keeps each `useMemo` dependency list, and `placeholderFacultyIds` is still
	// resolved here, before the shortage hook below consumes it.
	const {
		resolveSectionHoverDeltaMinutes,
		previewLoadHours,
		placeholderFacultyIds,
		coverageHeadline,
		truthModel,
		truthUnresolvedReasons,
		reviewModalTitle,
		reviewModalDescription,
	} = useTeachingLoadWorkspaceModel({ data, ui });

	// A6 c5 §1/§2/§3 — the shortage, its two corrected figures and the cover
	// dialog's state, from ONE hook. It sits ABOVE the repair queue, which needs
	// `outage.hasShortageToShow` to know whether the line is claiming row 2.
	const outage = useTeachingLoadOutage({
		subjects: data.subjects,
		sections: data.allKnownSections,
		savedOwnershipMap: data.savedOwnershipMap,
		pendingOwnershipMap: data.pendingOwnershipMap,
		activeFacultyIds: data.activeFacultyIds,
		placeholderFacultyIds,
		coverageTotals: data.coverageTotals,
		fetchedAt: data.sectionSummary?.fetchedAt,
		schoolId: data.schoolId,
		activeSchoolYearId: data.activeSchoolYearId,
		scopeKey: data.scopeKey,
		dataSource: data.dataSource,
		isOnline: data.isOnline,
		degradedNotice: data.degradedNotice,
		sectionMap: data.sectionMap,
	});
	const { cover } = outage;

	// A6 c9 — the `stillNeedRealTeacherNote` memo is GONE from this page. Its
	// sentence now lives in the header's staffing-figure control, which is the
	// one claim per fact AGENTS.md §8 asks for, and the count is not lost: the
	// window that control opens names every short class by name. The
	// `teachingLoadShortageNote` import stays — the auto-fill toast at
	// `unresolvedCount` still carries the same shared sentence.

	const emptyActiveYearTeachingLoad = useMemo(
		() => !data.loading && coverageHeadline.total > 0 && coverageHeadline.assigned === 0 && data.activeDraftCount === 0,
		[data.activeDraftCount, data.loading, coverageHeadline.assigned, coverageHeadline.total],
	);

	useEffect(() => {
		// A6 c4 (G1): this used to call `setAdvancedGridVisible(false)` here, which
		// is what put a scheduler on the Guided placeholder for an empty year. The
		// grid is unconditional now, so the one-shot message is all that is left.
		if (!guidedDefaultApplied && emptyActiveYearTeachingLoad) {
			setGuidedDefaultApplied(true);
			setDraftStatusMessage(buildGuidedEmptyTeachingLoadMessage(data.activeSchoolYearLabel));
		}
	}, [emptyActiveYearTeachingLoad, guidedDefaultApplied, data.activeSchoolYearLabel]);

	const overCapCount = useMemo(
		() => countTeachersAboveWeeklyMax(data.faculty),
		[data.faculty],
	);

	// Canonical excess-teaching count (actual teaching above the standard) for the
	// summary strip. Under no active department/status/load filter this equals the
	// row-level excess count exactly; with filters active it follows the facet context.
	const excessTeachingCount = ui.statusFacetCounts['excess'] ?? 0;

	/*
	 * A6 c11 — `showExcessTeachingLoad` and `showTemporarySubstitutes` are GONE.
	 * They existed to be the alert chip's `onClick`, and the chip never wired it:
	 * `WorkspaceToolbar` rendered the chip as a `<span>`, so both callbacks were
	 * unreachable from every state of every screen. A page that holds a callback
	 * no control can call is the same "signature claims a capability the product
	 * does not have" defect A6 c4 corrected, so they are deleted rather than left
	 * dormant.
	 *
	 * THE FACTS SURVIVE WITHOUT THEM. Both were a shortcut to "show me the teachers
	 * above the maximum" and "show me the to-be-hired records", and the repair queue
	 * in row 2 already offers exactly that, one item per teacher, each with its own
	 * action — so the chip is a summary of work the scheduler can start one row
	 * below. `showOverloadedTeachers` stays: the repair queue's `over-cap` items
	 * route through it and it is therefore live.
	 */
	const showUnassignedTeachingLoad = useCallback(() => {
		ui.setViewMode('allocation');
		ui.setSectionModeFilter('unassigned');
	}, [ui]);

	const showOverloadedTeachers = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setLoadFilter('excess');
		ui.setFilterStatus('all');
		ui.setShowFilters(false);
	}, [ui]);

	const showTeachersWithoutLoad = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setFilterStatus('no-teaching');
		ui.setLoadFilter('all');
		ui.setShowFilters(false);
	}, [ui]);

	/* A6 C3 SLICE 1 — the header's four strings live in
	 * `buildTeachingLoadWorkspaceState`, which records that extraction and why
	 * every string travelled byte-for-byte. The page still decides WHEN. */
	const workspaceState = useMemo(() => buildTeachingLoadWorkspaceState({ isOnline: data.isOnline, dataSource: data.dataSource, canPersistAssignments: data.canPersistAssignments, activeDraftCount: data.activeDraftCount, degradedNotice: data.degradedNotice, error: data.error }), [data.isOnline, data.dataSource, data.canPersistAssignments, data.activeDraftCount, data.degradedNotice, data.error]);

	/*
	 * A6 c9 (fix-1.2 38.1) — the page OWNS the summary window's open flag, and
	 * the header's ONE claim is the staffing figure. Both live in
	 * `useTeachingLoadHeaderClaims`, which exists because adding them inline
	 * pushed this page over the AGENTS.md §8 1000-physical-line cap; the page
	 * still decides WHEN, and still owns the figures the figure is built from.
	 */
	const { staffingFigureSlot, summaryControl, openTeacherReviewFor } = useTeachingLoadHeaderClaims({
		outage,
		writeBlockedReason: workspaceState.writeBlockedReason,
		onShowCoverageDetail: showUnassignedTeachingLoad,
		fetchedAt: data.sectionSummary?.fetchedAt,
		onSelectTeacher: data.setSelectedId,
	});

	// A6 C2 CORRECTION: the SAME exported predicate the header's amber line uses, so the row cannot say "not reachable" and "looks ready" at once.
	const sourceDegraded = isTeachingLoadSourceDegraded({ dataSource: data.dataSource, isOnline: data.isOnline, dataSourceNotice: data.degradedNotice });

	const {
		activeRepairId,
		routedRepairId,
		repairQueueItems,
		handleRepairPrimaryAction,
		handleSelectRepairItem,
	} = useTeachingLoadRepairQueue({
		searchParams,
		setSearchParams,
		faculty: data.faculty,
		effectiveAssignmentsByFaculty: data.effectiveAssignmentsByFaculty,
		activeDraftCount: data.activeDraftCount,
		isReadOnlyMode: data.isReadOnlyMode,
		selectedId: data.selectedId,
		coverageAssigned: coverageHeadline.assigned,
		coverageTotal: coverageHeadline.total,
		coverageUnassigned: coverageHeadline.unassigned,
		sourceDegraded,
		// A6 c5 §1: the shortage line REPLACES the `missing-load` row, so the
		// queue must not also offer it, and its `review-ready` fallback must not
		// claim readiness underneath the line. Derived from the SAME
		// `hasShortageToShow` the line uses, so the two can never disagree about
		// whether a shortage is being claimed.
		hasShortage: outage.hasShortageToShow,
		// A6 C3 (N-1 / N-3): the hook derives its OWN unverified answer from the
		// same two fields through the same shared module, so the rule has exactly
		// one implementation. The page deliberately passes the STATE and not a
		// second boolean: a second boolean would be a second copy of the rule, which
		// is the defect A6 C2 already corrected once.
		sourceState: { dataSource: data.dataSource, isOnline: data.isOnline },
		writeBlockedReason: workspaceState.writeBlockedReason,
		onSelectFaculty: data.setSelectedId, onLandTarget: landTarget,
		onSave: () => {
			void handleSave();
		},
		// Coverage repair now routes to the single Sections coverage/navigation
		// surface; there is no separate Subjects editor.
		onShowSubjectCoverage: showUnassignedTeachingLoad,
		onShowTeachersWithoutLoad: showTeachersWithoutLoad,
		onShowOverloaded: showOverloadedTeachers,
		onShowPlaceholder: () => {
			ui.setViewMode('teacher');
			ui.setShowTemporaryRoles(true);
			ui.setFilterStatus('all');
			ui.setLoadFilter('all');
		},
		onOpenReview: () => openTeacherReviewFor(null),	});

	const sectionsBySubject = useMemo(() => {
		return buildSectionsBySubject(data.sectionAssignedClassesIndex, data.sectionMap, ui.gradeLevelFilter);
	}, [data.sectionAssignedClassesIndex, data.sectionMap, ui.gradeLevelFilter]);

	const selectedSectionContract = useMemo<SectionAssignedClassesResult | null>(() => {
		if (!ui.selectedSectionId) return null;
		return data.sectionAssignedClassesIndex?.sections.find((section) => section.sectionId === ui.selectedSectionId) ?? null;
	}, [data.sectionAssignedClassesIndex, ui.selectedSectionId]);

	const departmentOptions = ui.departmentFacetOptions;

	// A6 C2: the ONE inspector node, now an extracted component so this page stays
	// UNDER the AGENTS.md §8 1000-line ceiling. Shared by the mobile Sheet, the
	// desktop review modal and the roster's read-only profile dialog.
	// (`truthModel` / `truthUnresolvedReasons` now come from
	// `useTeachingLoadWorkspaceModel`.)
	const activeInspector = (
		<TeachingLoadInspectorPanel
			viewMode={ui.viewMode}
			selected={data.selected}
			loadProfile={ui.loadProfile}
			rotationTermBreakdown={data.selected?.rotationTermBreakdown ?? []}
			hoveredIncomingMinutes={ui.hoveredIncomingMinutes}
			previewLoadHours={previewLoadHours}
			isReadOnlyMode={data.isReadOnlyMode}
			activeTermIndex={data.activeTermIndex}
			teachingStandardHours={ui.teachingStandardHours}
			policyReady={ui.policyReady}
			writeBlockedReason={workspaceState.writeBlockedReason}
			selectedSectionId={ui.selectedSectionId}
			sectionMap={data.sectionMap}
			selectedSectionContract={selectedSectionContract}
			effectiveOwnershipMap={data.effectiveOwnershipMap}
		/>
	);

	// A6: `reviewModalCopy` moved to `teachingLoadWorkspaceMetrics.ts` and is now
	// applied inside `useTeachingLoadWorkspaceModel`; the title/description pair
	// still comes from one branch there.

	/*
	 * A3-C10-S3: the truth summary (42px), the "Next step" repair queue (58px) and
	 * the archived-load MENU item were three `shrink-0` bands here and are now ONE
	 * line inside the command strip. The full record lives on
	 * `TEACHING_LOAD_HEADER_MODEL` in `WorkspaceToolbar.tsx`, which owns row 2.
	 * A9 c5 added a VISIBLE `Past years` control in the rollover band below. */
	const headerStateLine = (
		/* A6 C2 (Major 1): row 2 is "one sentence of status + one primary
		 * action", and this is that action. A6 c5 adds the shortage line as a
		 * second slot; the queue keeps every OTHER next step. */
		<TeachingLoadRepairQueue
			items={repairQueueItems}
			activeItemId={activeRepairId ?? routedRepairId}
			isReadOnly={data.isReadOnlyMode}
			saving={data.saving}
			onPrimaryAction={handleRepairPrimaryAction}
			hasShortageLine={outage.hasShortageToShow}
		/>
	);

	/* A6 c9 §1 — the header's ONE claim, and it is a CONTROL.
	 *
	 * It REPLACES three surfaces at once: the c7 per-subject shortage line, the
	 * amber "last saved roster" pill, and the grey `N classes still need a real
	 * teacher.` note this page used to print in the workspace body. The operator's
	 * complaint was that the percentage was a read-only metric — "50 classes still
	 * need a teacher is barely noticeable — that's what the load summary should
	 * be" — and the fix is a control that says what it opens.
	 *
	 * It is supplied in EVERY state, which is what makes the amber pill
	 * unreachable from this page rather than merely hidden: `WorkspaceToolbar`
	 * still contains the pill for a host that supplies nothing, and no committed
	 * control changes, but the real route never reaches it. The page passes the
	 * node in UNCONDITIONALLY and never consults `hasShortageToShow`.
	 */
	const shortageLineSlot = staffingFigureSlot;

	if (data.error && data.dataSource === 'none') {		return (
			<div className="flex h-[calc(100svh-3.5rem)] items-center justify-center p-6">
				<Card className="max-w-md border-red-200 bg-red-50 p-8 text-center shadow-lg">
					<AlertTriangle className="mx-auto size-12 text-red-600 mb-4" />
					<h3 className="text-lg font-semibold text-red-900 uppercase tracking-tight mb-2">Workspace Unavailable</h3>
					<p className="text-sm text-red-700 font-medium mb-6 leading-relaxed">{data.error}</p>
					<Button onClick={() => data.fetchData()} variant="destructive" className="font-bold uppercase tracking-widest px-8">
						Retry Connection
					</Button>
				</Card>
			</div>
		);
	}

	return (
		<TooltipProvider delayDuration={200}>
			<div className="flex h-[calc(100svh-3.5rem)] flex-col bg-background overflow-hidden">
				{/* A3-TITLE-STRIP-C3: this band's padding + hairline were redundant
					once WorkspaceToolbar adopted the shared full-bleed strip. */}
				<div className="shrink-0">
<WorkspaceToolbar
						realAssignedPairs={coverageHeadline.realAssigned}
						syntheticPlaceholderPairs={coverageHeadline.syntheticAssigned}
						unassignedPairs={coverageHeadline.unassigned}
						totalPairs={coverageHeadline.total}
						overCapCount={overCapCount}
						excessTeachingCount={excessTeachingCount}
					policyReady={ui.policyReady}
					autoFillLoading={data.loading || suggestionLoading}
						autoFillEnabled={Boolean(data.schoolId && data.activeSchoolYearId) && data.canPersistAssignments}
						onAutoFillClick={handlePreviewSuggestedTeachingLoad}
						viewMode={ui.viewMode}
						onViewModeChange={(value) => ui.setViewMode(value as 'teacher' | 'allocation')}
						dataSource={data.dataSource}
						degradedWriteEnabled={data.degradedWriteEnabled}
						isWorkspaceWritable={data.canPersistAssignments}
						isOnline={data.isOnline}
						dataSourceNotice={data.degradedNotice}
						coverageMode={ui.coverageMode}
						onCoverageModeChange={ui.setCoverageMode}
						coverageModeConfig={COVERAGE_MODE_CONFIG}
						workspaceStateLabel={workspaceState.label}
						workspaceStateDescription={workspaceState.description}
						workspaceStateNextAction={workspaceState.nextAction}
						activeDraftCount={data.activeDraftCount}
						saving={data.saving}
						onSave={handleSave}
					onRetrySource={() => data.fetchData({ forceRefresh: true })}
					stateLineSlot={headerStateLine}
					shortageLineSlot={shortageLineSlot}
					summaryControl={summaryControl}
					// FIX 38: the toolbar owns this control's POSITION, the surface owns its
					// open state and the dialog, and the page still BUILDS the body, so
					// `truthModel` has exactly one producer.
					//
					// The panel's tag below is deliberately NOT mentioned in backticks
					// in this comment: two committed controls locate it with a plain
					// `indexOf` on that tag, and a prose mention would be the first
					// match, so both would measure a comment and pass vacuously.
					loadSummaryAction={(
						<TeachingLoadSummarySurface teacherDetail={activeInspector}>
							<TeachingLoadTruthPanel
								expanded
								vertical
								model={truthModel}
								loading={data.loading || data.authorityDiagnosticsLoading}
								sourceRevision={data.authorityDiagnostics?.sourceRevision ?? null}
								upstreamVerified={data.degradedNotice === null}
								unresolvedReasons={truthUnresolvedReasons}
							/>
						</TeachingLoadSummarySurface>
					)}
					// A6 C2 (Major 1): the `Archived load` link, built HERE and positioned by the toolbar's
					// More menu — `client-quality-c01` reads its test id and `to` in THIS file; do not move it.
					historyAction={(
						<Link to="/teaching-load/history" data-testid="teaching-load-history-link">
							<History className="size-3.5" aria-hidden="true" />
							Past years
						</Link>
					)}
					// A6 C2 (Major 2): the only timestamp the client holds for this
					// snapshot; null while live, so no unproven time is ever printed.
					savedAtLabel={data.dataSource === 'live' ? null : data.sectionSummary?.fetchedAt ?? null}
				/>
					<TeachingLoadWorkflowSteps />
				</div>

				<div className="flex-1 flex min-h-0" data-testid="teaching-load-content-shell">
					{/* Main Grid Area */}
					<div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
						{data.schoolId != null && (
							/* A9 c5 r1 (D4): left-aligned; the guidance column is content-sized because an EMPTY `flex-1` still claimed the row, and dropping `justify-between` alone changed nothing. */
							<div className="flex shrink-0 items-start gap-3 px-3 pt-1 lg:px-5 [@media(max-height:640px)]:hidden">
								<div className="min-w-0">
									<RolloverGuidanceCard compact schoolId={data.schoolId} />
								</div>
							</div>
						)}

					{/*
					 * A6 c9 — THE GREY `N classes still need a real teacher.` NOTE IS
					 * DELETED FROM THE WORKSPACE BODY, and this is the subtraction the
					 * operator asked for: "there are two banners that say saved data —
					 * it's overwhelming", and `50 classes still need a real teacher.`
					 * was a THIRD statement of the same shortage the header figure now
					 * carries and the window now lists by class name.
					 *
					 * `A6C5-S9-1` asserted that this note was on the PAGE. That
					 * assertion is retained and marked superseded in its own file,
					 * beside its replacement: the honest count is now stated in the
					 * header's own control, which is a stronger home for it than a
					 * static line under a filter bar.
					 */}


					<div className="flex min-h-[140px] flex-1 flex-col" data-testid="teaching-load-workspace">

						{/* A6 c4 (G1): the `advancedGridVisible` ternary that gated this
						 block is gone. The two view modes below are the only branches
						 the workspace has, and the roster renders on the first paint in
						 both of them. */}
					{ui.viewMode === 'teacher' ? (
							<TeacherGridMode
								loading={data.loading}
								faculty={data.faculty}
								filteredFaculty={ui.filteredFaculty}
								groupedFaculty={ui.groupedFaculty}
								selectedId={data.selectedId}
								onSelectTeacher={data.setSelectedId}
								effectiveAssignmentsByFaculty={data.effectiveAssignmentsByFaculty}
								effectiveDraftAssignmentsByFaculty={data.effectiveDraftAssignmentsByFaculty}
								subjects={data.subjects}
								sectionsBySubject={sectionsBySubject}
								saving={data.saving}
								isReadOnlyMode={data.isReadOnlyMode}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
								savedConflictMap={data.savedConflictMap}
								onSetSections={handleSetSections}
								onSwapSectionOwnership={handleSwapRequest}
								departmentQualifiedSubjects={ui.departmentQualifiedSubjects}
								outsideDepartmentSubjects={ui.outsideDepartmentSubjects}
								homeroomHint={data.homeroomHint ? { advisedSectionId: data.homeroomHint.advisedSectionId ?? null } : null}
								loadProfile={ui.loadProfile}
								onHoverLoadMinutes={ui.setHoveredIncomingMinutes}
								onClearHoverLoad={() => ui.setHoveredIncomingMinutes(0)}
								activeFacultyIds={data.activeFacultyIds}
								resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
							onResetAssignments={data.handleResetAssignments}
							searchQuery={ui.searchQuery}
							onSearchQueryChange={ui.setSearchQuery}
							filterStatus={ui.filterStatus}
							onFilterStatusChange={ui.setFilterStatus}
							statusFacetCounts={ui.statusFacetCounts}
							loadFilter={ui.loadFilter}
							loadFacetCounts={ui.loadFacetCounts}
							onLoadFilterChange={ui.setLoadFilter}
							departmentFilter={ui.departmentFilter}
							onDepartmentFilterChange={ui.setDepartmentFilter}
							departmentOptions={departmentOptions}
							filterAnnouncement={ui.filterAnnouncement}
							onClearTeachingLoadFilters={ui.clearTeachingLoadFilters}
							effectiveActualHours={ui.effectiveActualHours}
							teachingStandardHours={ui.teachingStandardHours}
							policyReady={ui.policyReady}
								sortOrder={ui.sortOrder}
								onSortOrderChange={ui.setSortOrder}
								showFilters={ui.showFilters}
								onToggleFilters={() => ui.setShowFilters(!ui.showFilters)}
								showOutsideDept={ui.showOutsideDept}
								onToggleOutsideDept={ui.setShowOutsideDept}
								showUnmappedSpecialization={ui.showUnmappedSpecialization}
							onShowUnmappedSpecializationChange={ui.setShowUnmappedSpecialization}
							completedSectionIds={completedSectionIds}
							workspaceStateLabel={workspaceState.label}
							workspaceStateNextAction={workspaceState.nextAction}
							writeBlockedReason={workspaceState.writeBlockedReason}
								onReviewLoad={openTeacherReviewFor}
								// A6-TL-DEEPLINK (R-d): an Assign entry opens this teacher's editor.
								landingOpenEditorFacultyId={landingOpenEditorFacultyId}
							draftControls={(
								/* FIX 40: the SAME element that used to be the bottom
								 * sticky footer, now handed to the filter row. The
								 * component did not change identity — only its
								 * position — so the draft gate, the undo stack and
								 * the discard confirmation are all the same code. */
								<TeachingLoadDraftActionBar
									activeDraftCount={data.activeDraftCount}
									canUndo={data.canUndo}
									canRedo={data.canRedo}
									isReadOnlyMode={data.isReadOnlyMode}
									saving={data.saving}
									onUndo={data.handleUndo}
									onRedo={data.handleRedo}
									onDiscard={() => setShowDiscardConfirm(true)}
									onSave={() => setSaveConfirmOpen(true)}
								/>
							)}
						/>
						) : (
							<SectionGridMode
								loading={data.loading}
								subjects={data.subjects}
								sectionsBySubject={sectionsBySubject}
								faculty={data.faculty}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
								/* A6 c7 §1.3: the SAVED map, so a draft can be put back. */
								savedOwnershipMap={data.savedOwnershipMap}
								onSetSections={handleSetSections}
								saving={data.saving}
								isReadOnlyMode={data.isReadOnlyMode}
								activeFacultyIds={data.activeFacultyIds}
								sectionModeFilter={ui.sectionModeFilter}
								onSectionModeFilterChange={ui.setSectionModeFilter}
								effectiveAssignmentsByFaculty={data.effectiveAssignmentsByFaculty}
								teachingStandardHours={ui.teachingStandardHours}
								selectedSectionId={ui.selectedSectionId}
								onSelectSection={ui.setSelectedSectionId}
								// A6-TL-DEEPLINK (E4/E5): subject focus + `filter=missing-coverage`.
								focusSubjectId={missingCoverageSubjectId}
								missingCoverageOnly={landedTarget?.missingCoverageOnly === true}
								onSwapSectionOwnership={handleSwapRequest}
								completedSectionIds={completedSectionIds}
								workspaceStateLabel={workspaceState.label}
								workspaceStateNextAction={workspaceState.nextAction}
								writeBlockedReason={workspaceState.writeBlockedReason}
						/>
					)}
						</div>
					</div>

				{/* Fix 26: the permanent 320px desktop inspector column is gone; the
					per-row `Review load` button and the mobile `View profile` control
					below reach the same content on demand. */}
			</div>
			</div>

			{/* Phase 4.8: the legitimate small-screen affordance, PRESERVED. */}
			<TeachingLoadInspectorTriggers
				onOpenMobile={() => setMobileInspectorOpen(true)}
			/>

			<Sheet open={mobileInspectorOpen} onOpenChange={setMobileInspectorOpen}>
				<SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto" data-testid="teaching-load-mobile-inspector-sheet">
					<SheetHeader className="pb-4 border-b border-border/40">
						<SheetTitle className="text-base font-bold">
							{ui.viewMode === 'teacher'
								? data.selected
									? `${data.selected.lastName}, ${data.selected.firstName}`
									: 'Teacher profile'
								: 'Section profile'}
						</SheetTitle>
					</SheetHeader>
					<div className="py-4">{activeInspector}</div>
				</SheetContent>
			</Sheet>

			<TeachingLoadModals
				summaryModalOpen={ui.summaryModalOpen}
				onSummaryModalOpenChange={handleSummaryModalOpenChange}
				autoFillResult={autoFillResult}
				onApplySuggestion={handleApplySuggestedTeachingLoad}
				suggestionApplying={suggestionApplying}
				suggestionApplyDisabledReason={suggestionApplyDisabledReason}
				saveWarningOpen={showSaveWarning}
				onSaveWarningOpenChange={setShowSaveWarning}
				onSaveConfirm={() => handleSave(true)}
				discardConfirmOpen={showDiscardConfirm}
				onDiscardConfirmOpenChange={setShowDiscardConfirm}
				onDiscardConfirm={() => {
					discardAllDrafts();
					setShowDiscardConfirm(false);
				}}
				activeDraftCount={data.activeDraftCount}
				reviewModalOpen={reviewModalOpen}
				onReviewModalOpenChange={setReviewModalOpen}
				reviewInspector={activeInspector}
				reviewTitle={reviewModalTitle}
				reviewDescription={reviewModalDescription}
				saveChangesConfirmOpen={saveConfirmOpen}
				onSaveChangesConfirmOpenChange={setSaveConfirmOpen}
				onSaveChangesConfirm={() => void handleSave()}
				pendingChangeCount={data.activeDraftAssignmentChangeCount}
				pendingChangeTeacherCount={data.activeDraftCount}
				pendingChangeScope=""
			/>
		</TooltipProvider>
	);
}
