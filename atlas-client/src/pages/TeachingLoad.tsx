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
import { TooltipProvider } from '@/ui/tooltip';
import { createScopeEpoch, captureEpoch } from '@/lib/scope-request-epoch';
import { useTeachingLoadData } from '@/hooks/useTeachingLoadData';
import { useTeachingLoadUI } from '@/hooks/useTeachingLoadUI';
import { TeacherGridMode } from '@/components/faculty-assignments/TeacherGridMode';
import { SectionGridMode } from '@/components/faculty-assignments/SectionGridMode';
import { TeachingLoadInspectorPanel } from '@/components/faculty-assignments/TeachingLoadInspectorPanel';
import { WorkspaceToolbar, isTeachingLoadSourceDegraded } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadRepairQueue } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { openTeacherReview } from '@/components/faculty-assignments/teacherReviewEntry';
import { TeachingLoadDraftActionBar } from '@/components/faculty-assignments/TeachingLoadDraftActionBar';
import { TeachingLoadGuidedModePlaceholder } from '@/components/faculty-assignments/TeachingLoadGuidedModePlaceholder';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
import { TeachingLoadInspectorTriggers } from '@/components/faculty-assignments/TeachingLoadInspectorTriggers';
import { TeachingLoadSummarySurface } from '@/components/faculty-assignments/TeachingLoadSummarySurface';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import { buildTeachingLoadTruthModel } from '@/lib/teaching-load-authority-truth';
import {
	buildCoverageHeadline,
	countTeachersAboveWeeklyMax,
	previewLoadHoursFor,
	reviewModalCopy,
	sectionHoverDeltaMinutesFor,
} from '@/components/faculty-assignments/teachingLoadWorkspaceMetrics';
import { useTeachingLoadRepairQueue } from '@/hooks/useTeachingLoadRepairQueue';
import { useTeachingLoadRouteIntent } from '@/hooks/useTeachingLoadRouteIntent';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import type {
	AutoFillSummaryResult, 
	Subject,
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
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
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

	// Apply inbound route intent exactly once per navigation entry.
	// User actions (clicking tabs, selecting teachers/sections) immediately
	// supersede the URL intent. A reload or new external navigation re-applies it.
	useTeachingLoadRouteIntent(searchParams, {
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

	const completedSectionIds = useMemo(() => {
		const completed = new Set<number>();
		for (const section of data.allKnownSections) {
			const programType = (section.programType ?? 'REGULAR').toUpperCase();
			const displayOrder = section.displayOrder;
			const applicableSubjects = data.subjects.filter((subject) => {
				if (!subject.isActive || subject.code === 'HG') return false;
				const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(displayOrder);
				if (!gradeCompatible) return false;
				const subjectScopes = subject.programScopes || [];
				return subjectScopes.length === 0 || subjectScopes.some((scope) => scope.toUpperCase() === programType);
			});
			if (applicableSubjects.length === 0) continue;
			const allStaffed = applicableSubjects.every((subject) => {
				const key = `${subject.id}:${section.id}`;
				const owner = data.savedOwnershipMap[key] || data.pendingOwnershipMap[key];
				return Boolean(owner && data.activeFacultyIds.has(owner.facultyId));
			});
			if (allStaffed) {
				completed.add(section.id);
			}
		}
		return completed;
	}, [data.allKnownSections, data.subjects, data.savedOwnershipMap, data.pendingOwnershipMap, data.activeFacultyIds]);

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
			
			const unresolvedCount = result.preview.unresolved ?? 0;
			if (unresolvedCount > 0) {
				const message = 'Teaching Load suggestion is ready, but some classes still need scheduler review.';
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
			const message = unresolvedCount > 0
				? `Suggested Teaching Load applied with ${unresolvedCount} class row${unresolvedCount === 1 ? '' : 's'} still needing review.`
				: 'Suggested Teaching Load applied. Review the saved load before creating the timetable.';
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

	/*
	 * A6: the five derivations below moved to
	 * `teachingLoadWorkspaceMetrics.ts` to keep this page under the AGENTS.md §8
	 * 1000-physical-line cap after item 38. Each was already a pure function
	 * behind a `useMemo` / `useCallback` formality, so the extraction changes no
	 * behaviour and adds no authority: the page still decides WHEN to recompute.
	 */
	const resolveSectionHoverDeltaMinutes = useCallback((subject: Subject, sectionId: number) => {
		return sectionHoverDeltaMinutesFor(
			subject,
			sectionId,
			data.selected,
			data.selectedId,
			ui.policyReady,
			ui.workloadPolicy,
			data.effectiveAssignmentsByFaculty,
			data.subjects,
			data.sectionMap,
		);
	}, [data, ui.policyReady, ui.workloadPolicy]);

	const previewLoadHours = useMemo(() => {
		return previewLoadHoursFor(ui.loadProfile, ui.hoveredIncomingMinutes);
	}, [ui.loadProfile, ui.hoveredIncomingMinutes]);

	const coverageHeadline = useMemo(() => {
		return buildCoverageHeadline(data.coverageTotals);
	}, [data.coverageTotals]);

	const emptyActiveYearTeachingLoad = useMemo(
		() => !data.loading && coverageHeadline.total > 0 && coverageHeadline.assigned === 0 && data.activeDraftCount === 0,
		[data.activeDraftCount, data.loading, coverageHeadline.assigned, coverageHeadline.total],
	);

	useEffect(() => {
		if (!guidedDefaultApplied && emptyActiveYearTeachingLoad) {
			setAdvancedGridVisible(false);
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

	const showExcessTeachingLoad = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setLoadFilter('excess');
		ui.setFilterStatus('all');
	}, [ui]);

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

	// The "Temporary substitutes" readiness chip is a real control: it opens the
	// teacher grid filtered to unmapped temporary placeholder rows so the
	// operator can replace them before generating.
	const showTemporarySubstitutes = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setShowTemporaryRoles(true);
		ui.setSectionModeFilter('all');
		ui.setLoadFilter('all');
		ui.setFilterStatus('all');
		ui.setShowFilters(false);
		setAdvancedGridVisible(true);
	}, [ui]);

	const workspaceState = useMemo(() => {
		if (!data.isOnline) {
			return {
				label: 'Offline',
				description: 'ATLAS is showing the last saved teaching load. Changes stay off until the connection returns.',
				nextAction: 'Reconnect, then refresh before saving assignments.',
				writeBlockedReason: 'Saving is off until ATLAS reconnects. Your work is safe to review.',
			};
		}
		if (data.dataSource === 'refreshing') {
			return {
				label: 'Checking source',
				description: 'ATLAS is comparing the saved workspace with EnrollPro. The last saved snapshot remains visible while this finishes.',
				nextAction: 'Wait for verification before saving new changes.',
				writeBlockedReason: 'Saving is off while ATLAS verifies the roster with EnrollPro.',
			};
		}
		if (data.dataSource === 'live' && data.canPersistAssignments) {
			return {
				label: 'EnrollPro roster verified',
				description: 'ATLAS Teaching Load draft. Assignment data was checked against EnrollPro. Draft changes can be saved.',
				nextAction: data.activeDraftCount > 0 ? 'Save the draft changes before leaving this page.' : 'Inspect one teacher or fill section coverage gaps.',
				writeBlockedReason: null,
			};
		}
		if (data.dataSource === 'cached' && data.canPersistAssignments) {
			return {
				label: 'ATLAS Teaching Load draft',
				description: data.degradedNotice ?? 'ATLAS is using synced EnrollPro section data for Teaching Load. This is expected. Draft changes can be saved.',
				nextAction: data.activeDraftCount > 0 ? 'Save your changes. Refresh later to pick up any new EnrollPro changes.' : 'Check the classes below. Refresh later to pick up any new EnrollPro changes.',
				writeBlockedReason: null,
			};
		}
		if (data.dataSource === 'cached') {
			return {
				label: 'Read-only saved data',
				description: data.degradedNotice ?? 'ATLAS can show the saved assignments, but it cannot safely save changes yet.',
				nextAction: 'Refresh from EnrollPro before saving, suggesting, or resetting assignments.',
				writeBlockedReason: 'Saving is off until ATLAS reconnects to EnrollPro.',
			};
		}
		return {
			label: 'No assignment data',
			description: data.error ?? 'ATLAS could not load a live source or a saved teaching load.',
			nextAction: 'Retry the connection before assigning teachers.',
			writeBlockedReason: 'Saving is off because no teaching load data is available.',
		};
	}, [
		data.activeDraftCount,
		data.canPersistAssignments,
		data.dataSource,
		data.degradedNotice,
		data.error,
		data.isOnline,
	]);

	/**
	 * FIX 16.1 + A6 C2 — the ONE production opener for a staff-workload review,
	 * now also the roster's read-only teacher profile (Slice 3). The detached
	 * bottom-right `Review teachers` button is gone; a row's `Review load` button
	 * and the repair queue both land here, so the modal, its title and its view
	 * mode cannot disagree. The select runs BEFORE the open deliberately:
	 * `reviewModalTitle` is derived from `data.selected`, and a dialog that opened
	 * against the previous teacher and corrected itself one render later is the
	 * defect this indirection caused.
	 */
	const openTeacherReviewFor = useCallback((facultyId?: number | null) => {
		if (facultyId != null) data.setSelectedId(facultyId);
		openTeacherReview({ setViewMode: ui.setViewMode, setReviewModalOpen });
	}, [data.setSelectedId, ui.setViewMode]);

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
		writeBlockedReason: workspaceState.writeBlockedReason,
		onSelectFaculty: data.setSelectedId,
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
		onOpenReview: () => openTeacherReviewFor(null),
		setAdvancedGridVisible,
	});

	const sectionsBySubject = useMemo(() => {
		return buildSectionsBySubject(data.sectionAssignedClassesIndex, data.sectionMap, ui.gradeLevelFilter);
	}, [data.sectionAssignedClassesIndex, data.sectionMap, ui.gradeLevelFilter]);

	const selectedSectionContract = useMemo<SectionAssignedClassesResult | null>(() => {
		if (!ui.selectedSectionId) return null;
		return data.sectionAssignedClassesIndex?.sections.find((section) => section.sectionId === ui.selectedSectionId) ?? null;
	}, [data.sectionAssignedClassesIndex, ui.selectedSectionId]);

	const departmentOptions = ui.departmentFacetOptions;

	// Canonical truth surface. Every value is derived from the server contracts;
	// nothing here re-computes demand, policy, or qualification authority.
	const placeholderFacultyIds = useMemo(
		() => new Set(data.faculty.filter((member) => member.isPlaceholder).map((member) => member.id)),
		[data.faculty],
	);
	const truthModel = useMemo(
		() => buildTeachingLoadTruthModel({
			diagnostics: data.authorityDiagnostics,
			placeholderFacultyIds,
			workloadPolicyStatus: data.workloadPolicyStatus,
		}),
		[data.authorityDiagnostics, data.workloadPolicyStatus, placeholderFacultyIds],
	);
	const truthUnresolvedReasons = useMemo(
		() => (data.authorityDiagnostics?.unresolvedReasons ?? []).map((reason) => ({ code: reason.code, message: reason.message })),
		[data.authorityDiagnostics],
	);

	// A6 C2: the ONE inspector node, now an extracted component so this page stays
	// UNDER the AGENTS.md §8 1000-line ceiling. Shared by the mobile Sheet, the
	// desktop review modal and the roster's read-only profile dialog.
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

	// A6: moved to `teachingLoadWorkspaceMetrics.ts` with the other derivations.
	// Returned as a PAIR so the title and the description can never come from
	// different branches — see that function's header.
	const { title: reviewModalTitle, description: reviewModalDescription } = reviewModalCopy(
		ui.viewMode,
		data.selected,
	);

	/* A3-C10-S3 — the compact state line.
	 *
	 * These three were `shrink-0` bands stacked under the command strip, between
	 * it and the roster: the canonical truth summary (42px), the "Next step"
	 * repair-queue banner (58px) and the archived-load control. At 1366x768 that
	 * put the first assignment row at ~430px of 768 (Lane C, live release
	 * a1db27d5) under five stacked header rows.
	 *
	 * They are now ONE horizontal line, rendered by the strip itself as row 2
	 * beside the `% staffed`, classes-without-a-teacher and alert chips. The
	 * declared height model lives on `TEACHING_LOAD_HEADER_MODEL` in
	 * `WorkspaceToolbar.tsx`; the committed control is
	 * `__tests__/a3-c10-tl-header-density.test.ts`.
	 *
	 * NOTHING IS HIDDEN. The truth panel keeps every one of its figures and
	 * testids — they moved into the `Load summary` dialog below, rendered from
	 * the same `truthModel`; the repair queue keeps its count, its live status,
	 * its safety `disabledReason` and its primary action; the archived-load
	 * control is still a link to `/teaching-load/history`. Only the repair
	 * queue's prose description moved behind a hover whose trigger already names
	 * the task, the count and the status. */
	const headerStateLine = (
		/* A6 C2 (Major 1): this is the ONE control on row 2, because row 2 is
		 * "one sentence of status + one primary action" and the repair queue's
		 * `h-7` button is that action. FIX 38 had already moved the truth panel
		 * into the `Load summary` dialog below (same `truthModel`); the
		 * `Archived load` control that sat beside the queue was navigation, not
		 * state, and moved into the header's More menu as `historyAction`. */
		<TeachingLoadRepairQueue
			items={repairQueueItems}
			activeItemId={activeRepairId ?? routedRepairId}
			isReadOnly={data.isReadOnlyMode}
			saving={data.saving}
			advancedGridVisible={advancedGridVisible}
			onPrimaryAction={handleRepairPrimaryAction}
		/>
	);

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
					once WorkspaceToolbar adopted the shared full-bleed strip, and
					keeping them would have nested one bordered bar inside another
					and re-added the 13px this stream must not add. The strip owns the
					inset and the hairline now; the sr-only workflow line below is
					position:absolute and contributes no height either way. */}
				<div className="shrink-0">
<WorkspaceToolbar
						realAssignedPairs={coverageHeadline.realAssigned}
						syntheticPlaceholderPairs={coverageHeadline.syntheticAssigned}
						unassignedPairs={coverageHeadline.unassigned}
						totalPairs={coverageHeadline.total}
						overCapCount={overCapCount}
						excessTeachingCount={excessTeachingCount}
						policyReady={ui.policyReady}
						onShowExcessTeachingLoad={showExcessTeachingLoad}
						onShowTemporarySubstitutes={showTemporarySubstitutes}
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
					// FIX 38: the toolbar owns this control's POSITION, the surface owns its
					// open state and the dialog, and the page still BUILDS the body, so
					// `truthModel` has exactly one producer.
					//
					// The panel's tag below is deliberately NOT mentioned in backticks
					// in this comment: two committed controls locate it with a plain
					// `indexOf` on that tag, and a prose mention would be the first
					// match, so both would measure a comment and pass vacuously.
					loadSummaryAction={(
						<TeachingLoadSummarySurface>
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
					// A6 C2 (Major 1): the `Archived load` link, built HERE and
					// positioned by the toolbar's More menu. `client-quality-c01` reads
					// both the test id and the `to` in this file, so keeping the node
					// here keeps one place to read the reachability claim.
					historyAction={(
						<Link to="/teaching-load/history" data-testid="teaching-load-history-link">
							<History className="size-3.5" aria-hidden="true" />
							Archived load
						</Link>
					)}
					// A6 C2 (Major 2): the only timestamp the client holds for this
					// snapshot; null while live, so no unproven time is ever printed.
					savedAtLabel={data.dataSource === 'live' ? null : data.sectionSummary?.fetchedAt ?? null}
				/>
					<p className="sr-only" aria-label="Teaching load workflow">
						<span className="text-foreground">1. Choose a teacher or section</span>
						<span aria-hidden="true" className="mx-2">→</span>
						<span className="text-foreground">2. Review the load and coverage</span>
						<span aria-hidden="true" className="mx-2">→</span>
						<span className="text-foreground">3. Save your changes</span>
					</p>
				</div>

				<div className="flex-1 flex min-h-0" data-testid="teaching-load-content-shell">
					{/* Main Grid Area */}
					<div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
						{data.schoolId != null && (
							<div className="shrink-0 px-3 pt-1 lg:px-5 [@media(max-height:640px)]:hidden">
								<RolloverGuidanceCard compact schoolId={data.schoolId} />
							</div>
						)}

					{/* A3-C10-S3: the canonical truth strip, the "Next step" repair queue
						and the archived-load control were three `shrink-0` bands here
						and are now one compact state line inside the command strip
						(`headerStateLine` above). FIX 38 then took the truth panel
						out of that line entirely and into the `Load summary` dialog,
						so the roster starts under a header whose second row is two
						summary chips and two actions.

						Phase 4.1 note, still true: the standalone TeachingLoadTaskGuide
						remains removed, and the repair queue is still the single
						"next step" surface. Its % staffed figure is still the one in
						the readiness strip, now on the same line as everything else. */}

					<div className="flex min-h-[140px] flex-1 flex-col" data-testid="teaching-load-workspace">

						{advancedGridVisible ? (ui.viewMode === 'teacher' ? (
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
								onSwapSectionOwnership={handleSwapRequest}
								completedSectionIds={completedSectionIds}
								workspaceStateLabel={workspaceState.label}
								workspaceStateNextAction={workspaceState.nextAction}
								writeBlockedReason={workspaceState.writeBlockedReason}
							/>
						)) : (
							<TeachingLoadGuidedModePlaceholder onOpenAdvancedGrid={() => setAdvancedGridVisible(true)} />
					)}
						</div>
					</div>

				{/* Fix 26: the permanent `hidden w-80 ... lg:block` inspector column
					was removed here. It narrowed the workspace by 320px on every
					large viewport. The identical content is now reachable on demand
					from EVERY teacher row's `Review load` button, and on small
					screens by the preserved `View profile` control below. */}
			</div>
			</div>

			{/* Phase 4.8: mobile inspector access. This is the legitimate
				small-screen affordance and is PRESERVED. The desktop equivalent
				is now the per-row `Review load` button. */}
			<TeachingLoadInspectorTriggers
				visible={advancedGridVisible}
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
