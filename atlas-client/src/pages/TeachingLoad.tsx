import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, UserRound } from 'lucide-react';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/sheet';
import { cn } from '@/lib/utils';

import atlasApi from '@/lib/api';
import {
	computeSectionAssignmentDeltaMinutes,
	buildGuidedEmptyTeachingLoadMessage,
	resolveAdvisoryCreditHours,
} from '@/lib/faculty-assignment-helpers';
import { COVERAGE_MODE_CONFIG, formatTeachingLoadSaveError, buildSectionsBySubject, transferExactSectionPair, buildSaveCommitReceipt } from '@/lib/teaching-load-helpers';
import { TooltipProvider } from '@/ui/tooltip';
import { useTeachingLoadData } from '@/hooks/useTeachingLoadData';
import { useTeachingLoadUI } from '@/hooks/useTeachingLoadUI';
import { TeacherGridMode } from '@/components/faculty-assignments/TeacherGridMode';
import { SectionGridMode } from '@/components/faculty-assignments/SectionGridMode';
import { WorkloadInspector } from '@/components/faculty-assignments/WorkloadInspector';
import { SectionInspector } from '@/components/faculty-assignments/SectionInspector';
import { WorkspaceToolbar } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadRepairQueue } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { TeachingLoadDraftActionBar } from '@/components/faculty-assignments/TeachingLoadDraftActionBar';
import { TeachingLoadGuidedModePlaceholder } from '@/components/faculty-assignments/TeachingLoadGuidedModePlaceholder';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
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
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
	const [guidedDefaultApplied, setGuidedDefaultApplied] = useState(false);
	const [draftStatusMessage, setDraftStatusMessage] = useState('No draft changes yet. Start with the next step below.');

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
	const { resetForScope } = ui;
	useEffect(() => {
		resetForScope();
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
		ui.setAutoFillDialogOpen(false);
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
			const message = error?.response?.data?.message ?? 'ATLAS could not prepare a Teaching Load suggestion. Refresh the source and try again.';
			setDraftStatusMessage(message);
			toast.error(message, { id: toastId });
		} finally {
			setSuggestionLoading(false);
		}
	}, [data.activeSchoolYearId, ui]);

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
			ui.setSummaryModalOpen(false);
		} catch (error: any) {
			const message = error?.response?.data?.actionHint ?? error?.response?.data?.message ?? 'ATLAS could not apply the suggested Teaching Load. It is safe to retry after refreshing the source.';
			setDraftStatusMessage(message);
			toast.error(message, { id: toastId });
		} finally {
			setSuggestionApplying(false);
		}
	}, [data, suggestionApplyDisabledReason, suggestionProposalId, ui]);

	const handleCancelPendingSuggestionProposal = useCallback(async (options?: { silent?: boolean }) => {
		const proposalId = suggestionProposalId;
		if (!proposalId || suggestionApplying) return;
		try {
			await atlasApi.post(`/faculty-assignments/suggestion-proposals/${proposalId}/cancel`);
			setSuggestionProposalId(null);
			if (!options?.silent) {
				setDraftStatusMessage('Teaching Load suggestion cancelled. No Teaching Load rows were changed.');
			}
		} catch (error: any) {
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

	const resolveSectionHoverDeltaMinutes = useCallback((subject: Subject, sectionId: number) => {
		// Hover preview needs the effective policy; without it there is no honest preview.
		if (!ui.policyReady || ui.workloadPolicy == null || data.selected == null) return 0;
		return computeSectionAssignmentDeltaMinutes(
			subject,
			sectionId,
			data.effectiveAssignmentsByFaculty[data.selectedId ?? 0] ?? [],
			data.subjects,
			data.sectionMap,
			resolveAdvisoryCreditHours(data.selected, ui.workloadPolicy) + ((data.selected.ancillaryMinutesPerWeek || 0) / 60),
			ui.workloadPolicy,
			data.selected.maxHoursPerWeek,
		);
	}, [data, ui.policyReady, ui.workloadPolicy]);

	const previewLoadHours = useMemo(() => {
		return (ui.loadProfile?.creditedTotalHours ?? 0) + (ui.hoveredIncomingMinutes / 60);
	}, [ui.loadProfile, ui.hoveredIncomingMinutes]);

	const coverageHeadline = useMemo(() => {
		if (data.coverageTotals) {
			const assigned = Math.max(0, data.coverageTotals.assignedPairs);
			const realAssigned = Math.max(0, data.coverageTotals.realFacultyAssignedPairs);
			const syntheticAssigned = Math.max(0, data.coverageTotals.syntheticPlaceholderPairs);
			const total = Math.max(0, data.coverageTotals.totalPairs);
			return {
				assigned,
				realAssigned,
				syntheticAssigned,
				total,
				unassigned: Math.max(0, total - (realAssigned + syntheticAssigned)),
				rawUnassigned: data.coverageTotals.unassignedPairs,
			};
		}
		return { assigned: 0, realAssigned: 0, syntheticAssigned: 0, total: 0, unassigned: 0, rawUnassigned: 0 };
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
		() => data.faculty.filter((member) => member.isActiveForScheduling && (member.actualTeachingHours ?? member.sectionTeachingHours ?? 0) > member.maxHoursPerWeek).length,
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
				nextAction: data.activeDraftCount > 0 ? 'Save the draft, then refresh when live verification is available.' : 'Review coverage carefully, then refresh when live verification is available.',
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
		onOpenReview: () => ui.setViewMode('teacher'),
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

	if (data.error && data.dataSource === 'none') {
		return (
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
				<div className="shrink-0 border-b border-border/40 px-3 py-1.5 lg:px-5">
<WorkspaceToolbar
						realAssignedPairs={coverageHeadline.realAssigned}
						syntheticPlaceholderPairs={coverageHeadline.syntheticAssigned}
						unassignedPairs={coverageHeadline.unassigned}
						totalPairs={coverageHeadline.total}
						overCapCount={overCapCount}
						excessTeachingCount={excessTeachingCount}
						policyReady={ui.policyReady}
						onShowExcessTeachingLoad={showExcessTeachingLoad}
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

						{/* Phase 4.1: the standalone TeachingLoadTaskGuide is removed.
							Its "next step" prompt duplicated the repair queue, and its
							% staffed badge already lives in the readiness strip under
							the command header. The repair queue is now the single
							"next step" surface. */}
						<div className="shrink-0 [@media(max-height:640px)]:hidden">
							<TeachingLoadRepairQueue
								items={repairQueueItems}
								activeItemId={activeRepairId ?? routedRepairId}
								isReadOnly={data.isReadOnlyMode}
								saving={data.saving}
								advancedGridVisible={advancedGridVisible}
								onPrimaryAction={handleRepairPrimaryAction}
								onToggleAdvancedGrid={() => setAdvancedGridVisible(true)}
							/>
						</div>

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
							/>
						) : (
							<SectionGridMode
								loading={data.loading}
								subjects={data.subjects}
								sectionsBySubject={sectionsBySubject}
								faculty={data.faculty}
								savedOwnershipMap={data.savedOwnershipMap}
								pendingOwnershipMap={data.pendingOwnershipMap}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
								onSetSections={handleSetSections}
								onSelectTeacher={data.setSelectedId}
								onHoverTeacher={data.setSelectedId}
								onClearHover={() => {}}
								saving={data.saving}
								isReadOnlyMode={data.isReadOnlyMode}
								activeFacultyIds={data.activeFacultyIds}
								sectionModeFilter={ui.sectionModeFilter}
								onSectionModeFilterChange={ui.setSectionModeFilter}
								effectiveAssignmentsByFaculty={data.effectiveAssignmentsByFaculty}
								teachingStandardHours={ui.teachingStandardHours}
								selectedSectionId={ui.selectedSectionId}
								onSelectSection={ui.setSelectedSectionId}
								onSave={handleSave}
								hasDraft={data.activeDraftCount > 0}
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

					{/* Persistent Inspector Area */}
					<div className={cn("hidden w-80 shrink-0 border-l border-border/40 bg-background shadow-xl lg:block", !advancedGridVisible && "lg:hidden")}>
						{ui.viewMode === 'teacher' ? (
							<WorkloadInspector
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
							/>
						) : (
							<SectionInspector
								section={ui.selectedSectionId ? data.sectionMap.get(ui.selectedSectionId) ?? null : null}
								sectionContract={selectedSectionContract}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
								writeBlockedReason={workspaceState.writeBlockedReason}
							/>
						)}
					</div>
				</div>

				<TeachingLoadDraftActionBar
					activeDraftCount={data.activeDraftCount}
					canUndo={data.canUndo}
					isReadOnlyMode={data.isReadOnlyMode}
					saving={data.saving}
					statusMessage={draftStatusMessage}
					writeBlockedReason={workspaceState.writeBlockedReason}
					onUndo={data.handleUndo}
					onDiscard={() => setShowDiscardConfirm(true)}
					onSave={() => void handleSave()}
				/>
			</div>

			{/* Phase 4.8: mobile inspector access. The persistent inspector is
				hidden below lg; this floating button opens the same profile in a
				Sheet on small screens. Only visible in Teachers and Sections modes,
				not Subjects (which has no meaningful inspector). */}
			{advancedGridVisible && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="fixed bottom-16 right-4 z-40 h-10 gap-2 font-bold shadow-lg lg:hidden"
					data-testid="teaching-load-mobile-inspector-open"
					onClick={() => setMobileInspectorOpen(true)}
				>
					<UserRound className="size-4" />
					View profile
				</Button>
			)}

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
					<div className="py-4">
						{ui.viewMode === 'teacher' ? (
							<WorkloadInspector
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
							/>
						) : (
							<SectionInspector
								section={ui.selectedSectionId ? data.sectionMap.get(ui.selectedSectionId) ?? null : null}
								sectionContract={selectedSectionContract}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
								writeBlockedReason={workspaceState.writeBlockedReason}
							/>
						)}
					</div>
				</SheetContent>
			</Sheet>

			<TeachingLoadModals
				autoFillDialogOpen={ui.autoFillDialogOpen}
				onAutoFillDialogOpenChange={ui.setAutoFillDialogOpen}
				coverageModeConfig={COVERAGE_MODE_CONFIG[ui.coverageMode]}
				onAutoFillConfirm={handlePreviewSuggestedTeachingLoad}
				autoFillLoading={data.loading || suggestionLoading}
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
			/>
		</TooltipProvider>
	);
}
