import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle, UserRound } from 'lucide-react';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/ui/sheet';
import { cn } from '@/lib/utils';

import atlasApi from '@/lib/api';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import {
	computeSectionAssignmentDeltaMinutes,
} from '@/lib/faculty-assignment-helpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
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
import { SubjectCoverageMode } from '@/components/faculty-assignments/SubjectCoverageMode';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
import { TeachingLoadLockRecoveryDialog } from '@/components/faculty-assignments/TeachingLoadLockRecoveryDialog';
import { StaffingAuditSheet } from '@/components/faculty-assignments/StaffingAuditSheet';
import { useTeachingLoadRepairQueue } from '@/hooks/useTeachingLoadRepairQueue';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { hasTeachingLoadLockRecoveryAction } from '@/lib/teaching-load-lock-helpers';
import type {
	AutoFillSummaryResult, 
	CoverageMode, 
	ExternalSection,
	Subject,
	SectionAssignedClassesResult
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

const COVERAGE_MODE_CONFIG: Record<CoverageMode, { label: string; description: string }> = {
	// Phase 4.5: plain DepEd language. "Teacher X" / "Hard Cap" / "Hybrid
	// Staffing" are ATLAS-internal terms; the 40h limit is the Magna Carta
	// weekly maximum for DepEd teachers.
	REAL_FACULTY_STANDARD: {
		label: 'Real teachers first, up to 30h/week',
		description: 'Fills qualified real teachers up to the 30h standard. Some sections may stay unassigned.',
	},
	REAL_FACULTY_HARD_CAP: {
		label: 'Maximum allowed hours (40h)',
		description: 'Fills real teachers up to the 40h DepEd Magna Carta maximum before leaving any section unassigned.',
	},
	REAL_FACULTY_THEN_TEACHER_X: {
		label: 'Real teachers first, then substitutes',
		description: 'Prioritizes real teachers, then uses temporary substitutes for the remaining sections.',
	},
};

function formatTeachingLoadSaveError(error: any) {
	const code = error?.response?.data?.code;
	const message = error?.response?.data?.message;
	if (code === 'VERSION_CONFLICT') {
		return `${message ?? 'The Teaching Load changed in another session.'} ATLAS reloaded the latest saved data. Review your draft before saving again.`;
	}
	if (typeof message === 'string' && message.trim()) {
		if (/over.*cap|cap/i.test(message)) {
			return 'This teacher is already above the weekly maximum. Choose another teacher or move one class first.';
		}
		if (/owner|ownership|already assigned/i.test(message)) {
			return 'This section already has an owner for this subject. Review the current owner before saving.';
		}
		return message;
	}
	return 'ATLAS could not save Teaching Load. Check the highlighted repair reason, then try again.';
}

export default function TeachingLoad() {
	const data = useTeachingLoadData();
	const [searchParams, setSearchParams] = useSearchParams();
	const ui = useTeachingLoadUI({
		faculty: data.faculty,
		subjects: data.subjects,
		allKnownSections: data.allKnownSections,
		selected: data.selected,
		currentAssignments: data.effectiveAssignmentsByFaculty[data.selectedId ?? 0] ?? [],
		effectiveAssignmentsByFaculty: data.effectiveAssignmentsByFaculty,
		savedOwnershipMap: data.savedOwnershipMap,
		pendingOwnershipMap: data.pendingOwnershipMap,
		activeFacultyIds: data.activeFacultyIds,
		sectionMap: data.sectionMap,
	});

	const [autoFillResult, setAutoFillResult] = useState<AutoFillSummaryResult | null>(null);
	const [suggestionProposalId, setSuggestionProposalId] = useState<number | null>(null);
	const [suggestionLoading, setSuggestionLoading] = useState(false);
	const [suggestionApplying, setSuggestionApplying] = useState(false);
	const [summaryModalReviewOnly, setSummaryModalReviewOnly] = useState(false);
	const [resetLoading, setResetLoading] = useState(false);
	const [hasGeneratedRuns, setHasGeneratedRuns] = useState(false);
	const [showSaveWarning, setShowSaveWarning] = useState(false);
	const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
	// Phase 4.8: the inspector is hard-cut below lg. A mobile Sheet restores
	// access to the teacher/section load profile on small screens.
	const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
	const [guidedDefaultApplied, setGuidedDefaultApplied] = useState(false);
	const [draftStatusMessage, setDraftStatusMessage] = useState('No draft changes yet. Start with the next step below.');
	const [lockRecoveryOpen, setLockRecoveryOpen] = useState(false);
	const [lockRecoveryError, setLockRecoveryError] = useState<string | null>(null);

	useEffect(() => {
		if (data.activeSchoolYearId) {
			atlasApi.get(`/generation/${DEFAULT_SCHOOL_ID}/${data.activeSchoolYearId}/runs`, { params: { limit: 1 } })
				.then(({ data: res }) => {
					setHasGeneratedRuns(res.runs && res.runs.length > 0);
				})
				.catch(() => {
					setHasGeneratedRuns(false);
				});
		}
	}, [data.activeSchoolYearId]);

	useEffect(() => {
		const viewParam = searchParams.get('view');
		const taskParam = searchParams.get('task');
		if (viewParam === 'subjects' || taskParam === 'missing-load') {
			ui.setViewMode('subjects');
		}
		if (data.sectionFocusId) {
			ui.setViewMode('allocation');
			ui.setSelectedSectionId(data.sectionFocusId);
			ui.setSectionModeFilter('all');
		}
		if (data.subjectFocusId) {
			ui.setSelectedSubjectId(data.subjectFocusId);
			ui.setSubjectSearch('');
		}
	}, [data.sectionFocusId, data.subjectFocusId, ui, searchParams]);

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

	const dirty = Boolean(data.effectiveDraftAssignmentsByFaculty[data.selectedId ?? 0]);
	const splitBrainNeedsReconcile = hasTeachingLoadLockRecoveryAction(data.splitBrainIncident);
	const splitBrainNeedsAttention = Boolean(
		data.splitBrainIncident
		&& data.splitBrainIncident.quarantine.severity !== 'NONE'
		&& (!ui.reviewDismissed || data.splitBrainQuarantineRequired)
	);

	const applySplitBrainReconcile = useCallback(async (options?: { silent?: boolean }) => {
		if (!data.activeSchoolYearId) {
			return false;
		}
		if (!data.canPersistAssignments) {
			if (!options?.silent) {
				toast.error('Reconcile needs a live connection. Refresh and try again.');
			}
			return false;
		}

		data.setSplitBrainApplyLoading(true);
		try {
			await atlasApi.post('/faculty-assignments/integrity/reconcile-split-brain', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId: data.activeSchoolYearId,
				previewOnly: false,
				confirmApply: true,
			});
			if (!options?.silent) {
				toast.success('Reloaded the saved assignments. You can continue editing.');
			}
			await data.fetchData({ forceRefresh: true });
			return true;
		} catch (error: any) {
			if (!options?.silent) {
				toast.error(error?.response?.data?.message ?? 'ATLAS could not reconcile the saved assignments.');
			}
			return false;
		} finally {
			data.setSplitBrainApplyLoading(false);
		}
	}, [data]);

	const handleSave = useCallback(async (force?: boolean) => {
		if (!data.activeSchoolYearId) return;
		const draftEntries = Object.entries(data.effectiveDraftAssignmentsByFaculty);
		if (draftEntries.length === 0) return;

		if (hasGeneratedRuns && !force) {
			setDraftStatusMessage('Review the timetable sync warning before saving these Teaching Load changes.');
			setShowSaveWarning(true);
			return;
		}

		data.setSaving(true);
		try {
			for (const [facultyIdRaw, assignments] of draftEntries) {
				const facultyId = Number(facultyIdRaw);
				if (!Number.isFinite(facultyId)) continue;
				const facultyRow = data.faculty.find((member) => member.id === facultyId);
				if (!facultyRow) continue;
				await atlasApi.put(`/faculty-assignments/${facultyId}`, {
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId: data.activeSchoolYearId,
					version: facultyRow.version,
					facultyId,
					assignments,
				});
			}
			toast.success(
				draftEntries.length === 1 && data.selected
					? `Teaching load for ${data.selected.lastName} has been successfully updated.`
					: `Saved ${draftEntries.length} teaching-load draft ${draftEntries.length === 1 ? 'change' : 'changes'}.`,
			);
			setDraftStatusMessage(
				draftEntries.length === 1 && data.selected
					? `Saved Teaching Load for ${data.selected.lastName}.`
					: `Saved ${draftEntries.length} Teaching Load draft ${draftEntries.length === 1 ? 'change' : 'changes'}.`,
			);
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			const readableError = formatTeachingLoadSaveError(error);
			if (error?.response?.data?.code === 'VERSION_CONFLICT') {
				await data.fetchData({ forceRefresh: true });
				toast.error(readableError);
			} else {
				toast.error(readableError);
			}
			setDraftStatusMessage(readableError);
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
		const destinationFacultyId = toFacultyId ?? data.selectedId;
		if (!destinationFacultyId) {
			toast.error('Cannot swap: no destination teacher is selected. Select a teacher first, then retry the swap.');
			return;
		}

		// Check if recipient already owns any sections in this subject
		const toAssignments = data.effectiveAssignmentsByFaculty[destinationFacultyId] ?? data.savedAssignmentsByFaculty[destinationFacultyId] ?? [];
		const toSubjectAssignment = toAssignments.find((a) => a.subjectId === subjectId);
		const sectionToGiveBack = toSubjectAssignment?.sectionIds[0];

		try {
			data.pushHistory();
			data.setDraftAssignmentsByFaculty((prev) => {
				const getBase = (id: number) => prev[id] ?? data.savedAssignmentsByFaculty[id] ?? [];

				// Clone both faculty assignments
				let fromCurrent = [...getBase(fromFacultyId)];
				let toCurrent = [...getBase(destinationFacultyId)];

				// Remove sectionId from donor
				const fromIndex = fromCurrent.findIndex((a) => a.subjectId === subjectId);
				if (fromIndex >= 0) {
					const nextSectionIds = fromCurrent[fromIndex].sectionIds.filter((id: number) => id !== sectionId);
					if (nextSectionIds.length === 0) {
						fromCurrent.splice(fromIndex, 1);
					} else {
						fromCurrent[fromIndex] = { ...fromCurrent[fromIndex], sectionIds: nextSectionIds };
					}
				}

				// Add sectionId to recipient
				const toIndex = toCurrent.findIndex((a) => a.subjectId === subjectId);
				if (toIndex >= 0) {
					toCurrent[toIndex] = {
						...toCurrent[toIndex],
						sectionIds: Array.from(new Set([...toCurrent[toIndex].sectionIds, sectionId])),
					};
				} else {
					toCurrent.push({ subjectId, sectionIds: [sectionId], gradeLevels: [] });
				}

				// Two-way swap: if recipient had a section, give it back to donor
				if (sectionToGiveBack != null) {
					// Remove sectionToGiveBack from recipient
					const updatedToIndex = toCurrent.findIndex((a) => a.subjectId === subjectId);
					if (updatedToIndex >= 0) {
						const remainingSections = toCurrent[updatedToIndex].sectionIds.filter((id: number) => id !== sectionToGiveBack);
						if (remainingSections.length === 0) {
							toCurrent.splice(updatedToIndex, 1);
						} else {
							toCurrent[updatedToIndex] = { ...toCurrent[updatedToIndex], sectionIds: remainingSections };
						}
					}

					// Add sectionToGiveBack to donor
					const updatedFromIndex = fromCurrent.findIndex((a) => a.subjectId === subjectId);
					if (updatedFromIndex >= 0) {
						fromCurrent[updatedFromIndex] = {
							...fromCurrent[updatedFromIndex],
							sectionIds: Array.from(new Set([...fromCurrent[updatedFromIndex].sectionIds, sectionToGiveBack])),
						};
					} else {
						fromCurrent.push({ subjectId, sectionIds: [sectionToGiveBack], gradeLevels: [] });
					}
				}

				return {
					...prev,
					[fromFacultyId]: fromCurrent,
					[destinationFacultyId]: toCurrent,
				};
			});

			if (sectionToGiveBack != null) {
				toast.success('Sections swapped in draft mode.');
				setDraftStatusMessage('Sections swapped in draft mode. Save the draft when the review looks correct.');
			} else {
				toast.success('Section transferred in draft mode.');
				setDraftStatusMessage('Section transferred in draft mode. Save the draft when the review looks correct.');
			}
		} catch (err: any) {
			const readableError = formatTeachingLoadSaveError(err);
			toast.error(readableError);
			setDraftStatusMessage(readableError);
		}
	}, [data]);

	const applyGlobalReset = useCallback(async () => {
		if (!data.activeSchoolYearId) return;
		setResetLoading(true);
		try {
			await atlasApi.post('/faculty-assignments/reset', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId: data.activeSchoolYearId,
				confirmText: ui.resetConfirmText,
			});
			toast.success('All teaching loads for the current school year have been cleared.');
			ui.setResetDialogOpen(false);
			ui.setResetConfirmText('');
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Reset failed.');
		} finally {
			setResetLoading(false);
		}
	}, [data, ui]);

	const handlePreviewSuggestedTeachingLoad = useCallback(async () => {
		if (!data.activeSchoolYearId) return;
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
					schoolId: DEFAULT_SCHOOL_ID,
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
		if (!data.canPersistAssignments) {
			if (!data.isOnline) return 'Saving is disabled while ATLAS is offline.';
			if (data.dataSource === 'refreshing') return 'Wait for source verification before applying a Teaching Load suggestion.';
			return 'ATLAS must verify writable Teaching Load data before applying a suggestion.';
		}
		if (data.splitBrainQuarantineRequired) return 'Editing is locked. Open the lock recovery dialog to review and unlock.';
		if (suggestionApplying) return 'ATLAS is applying the suggested Teaching Load now.';
		return null;
	}, [autoFillResult, data.activeSchoolYearId, data.canPersistAssignments, data.dataSource, data.isOnline, data.splitBrainQuarantineRequired, suggestionApplying, suggestionProposalId]);

	const suggestionReviewWarning = useMemo(() => {
		if (!splitBrainNeedsReconcile || data.splitBrainQuarantineRequired) return null;
		return 'ATLAS found Teaching Load warnings. You may apply this draft, but review the warnings before generating or publishing.';
	}, [splitBrainNeedsReconcile, data.splitBrainQuarantineRequired]);

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
			setSummaryModalReviewOnly(false);
			void handleCancelPendingSuggestionProposal();
		}
	}, [handleCancelPendingSuggestionProposal, ui]);

	const handleViewStaffingNeeds = useCallback(async () => {
		if (!data.activeSchoolYearId) return;
		const toastId = toast.loading('Generating detailed staffing needs report...');
		try {
			const { data: result } = await atlasApi.post<AutoFillSummaryResult>(
				'/faculty-assignments/report/staffing-needs',
				{
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId: data.activeSchoolYearId,
					coverageMode: ui.coverageMode,
				},
			);
			setAutoFillResult(result);
			setSummaryModalReviewOnly(true);
			ui.setSummaryModalOpen(true);
			toast.success('Staffing needs report generated.', { id: toastId });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Failed to generate staffing needs report.', { id: toastId });
		}
	}, [data.activeSchoolYearId, ui.coverageMode, ui.setSummaryModalOpen]);

	const handleToggleCanTeachOutsideDepartment = useCallback(async (checked: boolean) => {
		if (!data.selected) return;
		try {
			await atlasApi.patch(`/faculty/${data.selected.id}`, {
				version: data.selected.version,
				canTeachOutsideDepartment: checked,
			});
			toast.success(`Cross-department teaching updated for ${data.selected.lastName}.`);
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Failed to update cross-department teaching permission.');
		}
	}, [data]);

	const handleNavigateToAllocation = useCallback(() => {
		ui.setViewMode('allocation');
		toast.info('Workflow switched to Section Allocation mode.');
	}, [ui]);

	const discardSelectedDraft = useCallback(() => {
		if (!data.selectedId) return;
		data.setDraftAssignmentsByFaculty((prev) => {
			const next = { ...prev };
			delete next[data.selectedId!];
			return next;
		});
		setDraftStatusMessage('Draft changes for the selected teacher were discarded.');
		toast.info('Draft changes discarded.');
	}, [data]);

	const discardAllDrafts = useCallback(() => {
		if (data.activeDraftCount === 0) return;
		data.pushHistory();
		data.setDraftAssignmentsByFaculty({});
		setDraftStatusMessage('All Teaching Load draft changes were discarded.');
		toast.info('All Teaching Load draft changes discarded.');
	}, [data]);

	const resolveSectionHoverDeltaMinutes = useCallback((subject: Subject, sectionId: number) => {
		return computeSectionAssignmentDeltaMinutes(
			subject,
			sectionId,
			data.effectiveAssignmentsByFaculty[data.selectedId ?? 0] ?? [],
			data.subjects,
			data.sectionMap,
			(data.selected?.isClassAdviser ? data.selected.advisoryEquivalentHours || 5 : 0) + ((data.selected?.ancillaryMinutesPerWeek || 0) / 60),
		);
	}, [data]);

	const previewLoadHours = useMemo(() => {
		return ui.loadProfile.creditedTotalHours + (ui.hoveredIncomingMinutes / 60);
	}, [ui.loadProfile.creditedTotalHours, ui.hoveredIncomingMinutes]);

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
			setDraftStatusMessage('Build 2026-2027 Teaching Load first. Start with the suggested draft or use the guided repair queue.');
		}
	}, [emptyActiveYearTeachingLoad, guidedDefaultApplied]);

	const overCapCount = useMemo(
		() => data.faculty.filter((member) => member.isActiveForScheduling && (member.policyCreditedHours ?? 0) > member.maxHoursPerWeek).length,
		[data.faculty],
	);

	const showSubjectCoverageView = useCallback(() => {
		ui.setViewMode('subjects');
	}, [ui]);

	const handleFocusSectionFromSubject = useCallback((sectionId: number, _subjectId: number) => {
		ui.setViewMode('allocation');
		ui.setSelectedSectionId(sectionId);
		ui.setSectionModeFilter('all');
		setAdvancedGridVisible(true);
	}, [ui]);

	const showUnassignedTeachingLoad = useCallback(() => {
		ui.setViewMode('allocation');
		ui.setSectionModeFilter('unassigned');
	}, [ui]);

	const showOverloadedTeachers = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setLoadFilter('overloaded');
		ui.setFilterStatus('all');
		ui.setShowFilters(false);
	}, [ui]);

	const showTeachersWithoutLoad = useCallback(() => {
		ui.setViewMode('teacher');
		ui.setFilterStatus('unassigned');
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
		if (data.splitBrainQuarantineRequired) {
			return {
				label: 'Review lock active',
				description: 'Editing is locked while ATLAS checks saved Teaching Load links that no longer match the current roster.',
				nextAction: 'Unlock editing to continue.',
				writeBlockedReason: 'Editing is temporarily locked. Open the lock recovery dialog to review and unlock.',
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
		data.splitBrainQuarantineRequired,
		data.splitBrainReasonLabel,
	]);

	const {
		activeRepairId,
		routedRepairId,
		skippedRepairIds,
		repairQueueItems,
		handleRepairPrimaryAction,
		handleSelectRepairItem,
		handleSkipRepairItem,
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
		onShowUnassigned: showUnassignedTeachingLoad,
		onShowSubjectCoverage: showSubjectCoverageView,
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
		setDraftStatusMessage,
	});

	const sectionsBySubject = useMemo(() => {
		const grouped: Record<number, ExternalSection[]> = {};
		for (const sectionResult of data.sectionAssignedClassesIndex?.sections ?? []) {
			const section = data.sectionMap.get(sectionResult.sectionId);
			if (!section) continue;
			const gradeMatch = ui.gradeLevelFilter === 'all' || section.displayOrder === Number(ui.gradeLevelFilter);
			if (!gradeMatch) continue;

			const contractRows = [
				...sectionResult.classes.map((entry) => ({
					subjectId: entry.subjectId,
					specializationCode: entry.specializationCode,
					specializationLabel: entry.specializationLabel,
					rotationFamily: entry.rotationFamily,
					rotationTermRank: entry.rotationTermRank,
					rotationTermLabel: entry.rotationTermLabel,
					rotationTermGroupId: entry.rotationTermGroupId,
					rotationTermCount: entry.rotationTermCount,
					minMinutesPerWeek: entry.minMinutesPerWeek,
				})),
				...((sectionResult.unassignedExpectedClasses ?? []).map((entry) => ({
					subjectId: entry.subjectId,
					specializationCode: null,
					specializationLabel: null,
					rotationFamily: entry.rotationFamily,
					rotationTermRank: entry.rotationTermRank,
					rotationTermLabel: entry.rotationTermLabel,
					rotationTermGroupId: entry.rotationTermGroupId,
					rotationTermCount: entry.rotationTermCount,
					minMinutesPerWeek: entry.minMinutesPerWeek,
				}))),
			];

			for (const contractRow of contractRows) {
				if (!grouped[contractRow.subjectId]) grouped[contractRow.subjectId] = [];
				grouped[contractRow.subjectId].push({
					...section,
					assignmentSpecializationCode: contractRow.specializationCode,
					assignmentSpecializationLabel: contractRow.specializationLabel,
					assignmentRotationFamily: contractRow.rotationFamily,
					assignmentRotationTermRank: contractRow.rotationTermRank,
					assignmentRotationTermLabel: contractRow.rotationTermLabel,
					assignmentRotationTermGroupId: contractRow.rotationTermGroupId,
					assignmentRotationTermCount: contractRow.rotationTermCount,
					assignmentRawMinutesPerWeek: contractRow.minMinutesPerWeek,
				});
			}
		}
		return grouped;
	}, [data.sectionAssignedClassesIndex, data.sectionMap, ui.gradeLevelFilter]);

	const selectedSectionContract = useMemo<SectionAssignedClassesResult | null>(() => {
		if (!ui.selectedSectionId) return null;
		return data.sectionAssignedClassesIndex?.sections.find((section) => section.sectionId === ui.selectedSectionId) ?? null;
	}, [data.sectionAssignedClassesIndex, ui.selectedSectionId]);

	const departmentOptions = useMemo(() => {
		const depts = new Set(data.faculty.map((f) => f.department).filter(Boolean) as string[]);
		return Array.from(depts).sort();
	}, [data.faculty]);

	const coverageState = useMemo(() => {
		if (data.loading && !data.coverageTotals) {
			return {
				label: 'Checking assignment needs',
				description: 'Coverage totals are loading. Zeroes shown now are placeholders, not final staffing counts.',
			};
		}
		if (!data.activeSchoolYearId) {
			return {
				label: 'No active school year',
				description: 'ATLAS needs an active school year before it can count teacher-section assignment needs.',
			};
		}
		if (!data.coverageTotals || coverageHeadline.total === 0) {
			return {
				label: 'No assignment universe',
				description: 'Coverage is 0 / 0 because ATLAS has no schedulable subject-section pairs for the current source state.',
			};
		}
		if (coverageHeadline.syntheticAssigned > 0) {
			return {
				label: 'Mixed coverage',
				description: `${coverageHeadline.realAssigned} pairs are staffed by real teachers and ${coverageHeadline.syntheticAssigned} use temporary substitutes.`,
			};
		}
		return {
			label: 'Real-teacher coverage',
			description: 'Coverage counts are based on real teacher assignments for the current school year.',
		};
	}, [
		coverageHeadline.realAssigned,
		coverageHeadline.syntheticAssigned,
		coverageHeadline.total,
		data.activeSchoolYearId,
		data.coverageTotals,
		data.loading,
	]);

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
						autoFillLoading={data.loading || suggestionLoading}
						staffingNeedsLoading={data.loading}
						autoFillEnabled={Boolean(data.activeSchoolYearId) && data.canPersistAssignments && !data.splitBrainQuarantineRequired}
						onAutoFillClick={handlePreviewSuggestedTeachingLoad}
						onViewStaffingNeedsClick={handleViewStaffingNeeds}
						viewMode={ui.viewMode}
						onViewModeChange={(value) => ui.setViewMode(value as 'teacher' | 'allocation' | 'subjects')}
						dataSource={data.dataSource}
						degradedWriteEnabled={data.degradedWriteEnabled}
						isWorkspaceWritable={data.canPersistAssignments}
						isOnline={data.isOnline}
						dataSourceNotice={data.degradedNotice}
						splitBrainIncident={data.splitBrainIncident}
						splitBrainQuarantineRequired={data.splitBrainQuarantineRequired}
						showJumpList={ui.showJumpList}
						onToggleJumpList={() => ui.setShowJumpList(!ui.showJumpList)}
						coverageMode={ui.coverageMode}
						onCoverageModeChange={ui.setCoverageMode}
						coverageModeConfig={COVERAGE_MODE_CONFIG}
						onGlobalResetClick={() => ui.setResetDialogOpen(true)}
						canRunGlobalReset={data.canRunGlobalReset}
						onReconcileClick={() => {
							setLockRecoveryError(null);
							setLockRecoveryOpen(true);
						}}
						reconcileLoading={data.splitBrainApplyLoading}
						showReconcileAction={splitBrainNeedsReconcile}
						reconcileEnabled={data.canPersistAssignments}
						reviewDismissed={ui.reviewDismissed}
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
					<div className="flex-1 flex flex-col min-w-0">
						<div className="shrink-0 px-3 pt-1 lg:px-5">
							<RolloverGuidanceCard compact />
						</div>

						{/* Phase 4.1: the standalone TeachingLoadTaskGuide is removed.
							Its "next step" prompt duplicated the repair queue, and its
							% staffed badge already lives in the readiness strip under
							the command header. The repair queue is now the single
							"next step" surface. */}
						<TeachingLoadRepairQueue
							items={repairQueueItems}
							activeItemId={activeRepairId ?? routedRepairId}
							skippedItemIds={skippedRepairIds}
							isReadOnly={data.isReadOnlyMode}
							canUndo={data.canUndo}
							saving={data.saving}
							advancedGridVisible={advancedGridVisible}
							onPrimaryAction={handleRepairPrimaryAction}
							onSelectItem={handleSelectRepairItem}
							onSkipItem={handleSkipRepairItem}
							onUndo={data.handleUndo}
							onToggleAdvancedGrid={() => setAdvancedGridVisible(true)}
						/>

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
							splitBrainQuarantineRequired={data.splitBrainQuarantineRequired}
							splitBrainReasonLabel={data.splitBrainReasonLabel}
							onResetAssignments={data.handleResetAssignments}
							searchQuery={ui.searchQuery}
								onSearchQueryChange={ui.setSearchQuery}
								filterStatus={ui.filterStatus}
								onFilterStatusChange={ui.setFilterStatus}
								loadFilter={ui.loadFilter}
								onLoadFilterChange={ui.setLoadFilter}
								departmentFilter={ui.departmentFilter}
								onDepartmentFilterChange={ui.setDepartmentFilter}
								departmentOptions={departmentOptions}
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
						) : ui.viewMode === 'subjects' ? (
							<SubjectCoverageMode
								activeSchoolYearId={data.activeSchoolYearId}
								onFocusSection={handleFocusSectionFromSubject}
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

					{/* Persistent Inspector Area */}
					<div className={cn("hidden w-80 shrink-0 border-l border-border/40 bg-background shadow-xl lg:block", (!advancedGridVisible || ui.viewMode === 'subjects') && "lg:hidden")}>
						{ui.viewMode === 'teacher' ? (
							<WorkloadInspector
								selected={data.selected}
								loadProfile={ui.loadProfile}
								rotationTermBreakdown={data.selected?.rotationTermBreakdown ?? []}
								hoveredIncomingMinutes={ui.hoveredIncomingMinutes}
								previewLoadHours={previewLoadHours}
								isReadOnlyMode={data.isReadOnlyMode}
								onToggleCanTeachOutsideDepartment={handleToggleCanTeachOutsideDepartment}
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
				Sheet on small screens. */}
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
								onToggleCanTeachOutsideDepartment={handleToggleCanTeachOutsideDepartment}
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

			<TeachingLoadLockRecoveryDialog
				open={lockRecoveryOpen}
				onOpenChange={setLockRecoveryOpen}
				splitBrainIncident={data.splitBrainIncident}
				loading={data.splitBrainApplyLoading}
				enabled={data.canPersistAssignments}
				error={lockRecoveryError}
				disabledReason={
					!data.activeSchoolYearId
						? 'ATLAS needs the active school year before it can unlock Teaching Load editing.'
						: !data.isOnline
						? 'Reconnect before unlocking Teaching Load editing.'
						: data.dataSource === 'refreshing'
						? 'Wait for ATLAS to finish checking EnrollPro, then try again.'
						: !data.canPersistAssignments
						? 'ATLAS needs writable saved setup data before it can unlock Teaching Load editing. Refresh source data first.'
						: null
				}
				onConfirm={async () => {
					setLockRecoveryError(null);
					const success = await applySplitBrainReconcile();
					if (success) {
						setLockRecoveryOpen(false);
						setLockRecoveryError(null);
						// Check if still locked after refresh.
						const stillLocked = data.splitBrainIncident?.quarantine.required === true;
						setDraftStatusMessage(
							stillLocked
								? 'ATLAS cleaned what it could, but editing is still locked. Review the remaining blocker below.'
								: 'Teaching Load editing is unlocked. Review the remaining open classes before generating.'
						);
					} else {
						setLockRecoveryError('ATLAS could not reconcile the saved assignments. The dialog will remain open so you can try again or close and continue reviewing.');
					}
				}}
			/>

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
				onReviewSuggestionManually={() => {
					void handleCancelPendingSuggestionProposal({ silent: true });
					ui.setSummaryModalOpen(false);
					setAdvancedGridVisible(true);
					setDraftStatusMessage('Manual review opened. Use the grid to adjust teachers or sections before generating.');
				}}
				suggestionApplying={suggestionApplying}
				suggestionApplyDisabledReason={suggestionApplyDisabledReason}
				suggestionReviewWarning={suggestionReviewWarning}
				summaryModalReviewOnly={summaryModalReviewOnly}
				resetDialogOpen={ui.resetDialogOpen}
				onResetDialogOpenChange={ui.setResetDialogOpen}
				canRunGlobalReset={data.canRunGlobalReset}
				resetLoading={resetLoading}
				resetConfirmText={ui.resetConfirmText}
				onResetConfirmTextChange={ui.setResetConfirmText}
				onResetConfirm={applyGlobalReset}
			/>

			<StaffingAuditSheet
				open={ui.staffingAuditOpen}
				onOpenChange={ui.setStaffingAuditOpen}
				coverageTotals={data.coverageTotals}
				faculty={data.faculty}
				subjects={data.subjects}
				coverageStateLabel={coverageState.label}
				coverageStateDescription={coverageState.description}
				workspaceStateLabel={workspaceState.label}
				workspaceStateNextAction={workspaceState.nextAction}
				onNavigateToAllocation={handleNavigateToAllocation}
			/>

			<ConfirmationModal
				open={showSaveWarning}
				onOpenChange={setShowSaveWarning}
				title="Save teaching load changes?"
				description="Saving now will update the timetable's unassigned list when ATLAS next syncs. Any class whose teacher you changed will be moved back to the unassigned list. Do you want to continue?"
				onConfirm={() => handleSave(true)}
				confirmText="Save changes"
				variant="warning"
			/>

			{/* Phase 4.3: Discard requires confirmation. The cancel action is the
				safe default; the destructive confirm is explicit. */}
			<ConfirmationModal
				open={showDiscardConfirm}
				onOpenChange={setShowDiscardConfirm}
				title={`Discard ${data.activeDraftCount} draft ${data.activeDraftCount === 1 ? 'change' : 'changes'}?`}
				description="This will discard every unsaved Teaching Load change. This cannot be undone."
				onConfirm={() => {
					discardAllDrafts();
					setShowDiscardConfirm(false);
				}}
				confirmText="Discard all"
				variant="danger"
			/>
		</TooltipProvider>
	);
}
