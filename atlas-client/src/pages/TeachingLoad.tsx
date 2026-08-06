import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';

import atlasApi from '@/lib/api';
import { ConfirmationModal } from '@/ui/confirmation-modal';
import {
	buildMultiOwnerSavedMap,
	buildOwnershipMap,
	buildOwnershipMapFromIndex,
	getAssignmentOwnershipKey,
	STANDARD_WEEKLY_TEACHING_HOURS,
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
import { TeachingLoadTaskGuide } from '@/components/faculty-assignments/TeachingLoadTaskGuide';
import { TeachingLoadRepairQueue } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { TeachingLoadDraftActionBar } from '@/components/faculty-assignments/TeachingLoadDraftActionBar';
import { TeachingLoadGuidedModePlaceholder } from '@/components/faculty-assignments/TeachingLoadGuidedModePlaceholder';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
import { StaffingAuditSheet } from '@/components/faculty-assignments/StaffingAuditSheet';
import { useTeachingLoadRepairQueue } from '@/hooks/useTeachingLoadRepairQueue';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import type { 
	AutoFillSummaryResult, 
	CoverageMode, 
	ExternalSection,
	Subject,
	SectionAssignedClassesResult,
	SpecialProgramRebalancePreviewResult 
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

const COVERAGE_MODE_CONFIG: Record<CoverageMode, { label: string; description: string }> = {
	REAL_FACULTY_STANDARD: {
		label: 'Standard Teacher Load (30h)',
		description: 'Fills qualified real teachers up to 30h. Some sections may remain unassigned.',
	},
	REAL_FACULTY_HARD_CAP: {
		label: 'Hard Cap Utilization (40h)',
		description: 'Maximizes real teacher load up to the 40h legal limit.',
	},
	REAL_FACULTY_THEN_TEACHER_X: {
		label: 'Hybrid Staffing (Real + Temp)',
		description: 'Prioritizes real teachers, then uses Teacher X for remaining sections.',
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
			return 'This teacher is already over the weekly cap. Choose another teacher or move one class first.';
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
	const [resetLoading, setResetLoading] = useState(false);
	const [hasGeneratedRuns, setHasGeneratedRuns] = useState(false);
	const [showSaveWarning, setShowSaveWarning] = useState(false);
	const [advancedGridVisible, setAdvancedGridVisible] = useState(true);
	const [draftStatusMessage, setDraftStatusMessage] = useState('No draft changes yet. Use a repair action first.');

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
		if (data.sectionFocusId) {
			ui.setViewMode('allocation');
			ui.setSelectedSectionId(data.sectionFocusId);
			ui.setSectionModeFilter('all');
		}
		if (data.subjectFocusId) {
			ui.setSelectedSubjectId(data.subjectFocusId);
			ui.setSubjectSearch('');
		}
	}, [data.sectionFocusId, data.subjectFocusId, ui]);

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
	const splitBrainNeedsReconcile = Boolean(
		data.splitBrainIncident
		&& (
			(data.splitBrainIncident.counters.truthRowsToUpdate ?? 0) > 0
			|| (data.splitBrainIncident.counters.integrityOutOfSubjectScopePairs ?? 0) > 0
		)
	);
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
				toast.error('Saved-truth reconcile requires writable runtime evidence. Refresh and try again.');
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
				toast.success('Saved coverage reconcile applied. Reloading current Teaching Load truth.');
			}
			await data.fetchData({ forceRefresh: true });
			return true;
		} catch (error: any) {
			if (!options?.silent) {
				toast.error(error?.response?.data?.message ?? 'Saved coverage reconcile failed.');
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
		const subject = data.subjects.find((s) => s.id === subjectId);
		const section = data.sectionMap.get(sectionId);
		const fromFaculty = data.faculty.find((f) => f.id === fromFacultyId);
		const toFaculty = toFacultyId != null
			? data.faculty.find((f) => f.id === toFacultyId)
			: data.selected;
		ui.setSwapCandidate({
			subjectId,
			sectionId,
			fromFacultyId,
			toFacultyId: toFacultyId ?? null,
			subjectName: subject?.name,
			subjectCode: subject?.code,
			sectionName: section?.name,
			fromFacultyName: fromFaculty ? `${fromFaculty.lastName}, ${fromFaculty.firstName}` : undefined,
			toFacultyName: toFaculty ? `${toFaculty.lastName}, ${toFaculty.firstName}` : undefined,
		});
	}, [data, ui]);

	const executeSwap = useCallback(async () => {
		if (!ui.swapCandidate) return;
		const { subjectId, sectionId, fromFacultyId, toFacultyId } = ui.swapCandidate;
		const destinationFacultyId = toFacultyId ?? data.selectedId;
		if (!destinationFacultyId) {
			toast.error('Cannot transfer: no destination teacher is selected. Select a teacher first, then retry the swap.');
			ui.setSwapCandidate(null);
			return;
		}

		try {
			data.pushHistory();
			data.setDraftAssignmentsByFaculty((prev) => {
				const getBase = (id: number) => prev[id] ?? data.savedAssignmentsByFaculty[id] ?? [];
				
				// 1. Update donor faculty (remove section)
				let fromCurrent = [...getBase(fromFacultyId)];
				const fromIndex = fromCurrent.findIndex((a) => a.subjectId === subjectId);
				if (fromIndex >= 0) {
					const nextSectionIds = fromCurrent[fromIndex].sectionIds.filter((id: number) => id !== sectionId);
					if (nextSectionIds.length === 0) {
						fromCurrent.splice(fromIndex, 1);
					} else {
						fromCurrent[fromIndex] = { ...fromCurrent[fromIndex], sectionIds: nextSectionIds };
					}
				}

				// 2. Update recipient faculty (add section)
				let toCurrent = [...getBase(destinationFacultyId)];
				const toIndex = toCurrent.findIndex((a) => a.subjectId === subjectId);
				if (toIndex >= 0) {
					toCurrent[toIndex] = {
						...toCurrent[toIndex],
						sectionIds: Array.from(new Set([...toCurrent[toIndex].sectionIds, sectionId])),
					};
				} else {
					toCurrent.push({ subjectId, sectionIds: [sectionId], gradeLevels: [] });
				}

				return { 
					...prev, 
					[fromFacultyId]: fromCurrent, 
					[destinationFacultyId]: toCurrent 
				};
			});
			toast.success('Ownership swapped in draft mode.');
			setDraftStatusMessage('Ownership swap prepared in draft mode. Save the draft when the review looks correct.');
		} catch (err: any) {
			const readableError = formatTeachingLoadSaveError(err);
			toast.error(readableError);
			setDraftStatusMessage(readableError);
		} finally {
			ui.setSwapCandidate(null);
		}
	}, [data, ui]);

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

	const handleAutoFill = useCallback(async () => {
		if (!data.activeSchoolYearId) return;
		ui.setAutoFillDialogOpen(false);
		if (splitBrainNeedsReconcile) {
			const reconciled = await applySplitBrainReconcile({ silent: true });
			if (!reconciled) {
				toast.error('Auto-fill could not start because saved coverage reconcile failed.');
				return;
			}
		}
		const toastId = toast.loading(`Running auto-fill (${COVERAGE_MODE_CONFIG[ui.coverageMode].label})...`);
		try {
			const { data: result } = await atlasApi.post<AutoFillSummaryResult>(
				'/faculty-assignments/auto-fill',
				{
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId: data.activeSchoolYearId,
					coverageMode: ui.coverageMode,
				},
			);
			setAutoFillResult(result);
			ui.setSummaryModalOpen(true);
			
			const unresolvedCount = result.unresolved ?? 0;
			if (unresolvedCount > 0) {
				toast.warning('Auto-fill finished with gaps. Review the summary for detailed staffing recommendations.', { id: toastId });
			} else {
				toast.success('Auto-fill completed successfully.', { id: toastId });
			}
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Auto-fill failed.', { id: toastId });
		}
	}, [applySplitBrainReconcile, data, splitBrainNeedsReconcile, ui]);

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

	const overCapCount = useMemo(
		() => data.faculty.filter((member) => member.isActiveForScheduling && (member.policyCreditedHours ?? 0) > member.maxHoursPerWeek).length,
		[data.faculty],
	);

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
				label: 'Offline saved data',
				description: 'ATLAS is showing the last saved teaching load snapshot. Write actions stay off until the connection returns.',
				nextAction: 'Reconnect, then refresh the source before saving assignments.',
				writeBlockedReason: 'Saving is disabled while ATLAS is offline.',
			};
		}
		if (data.splitBrainQuarantineRequired) {
			return {
				label: 'Review lock active',
				description: data.splitBrainReasonLabel,
				nextAction: 'Repair saved scope drift before changing assignments.',
				writeBlockedReason: data.splitBrainReasonLabel,
			};
		}
		if (data.dataSource === 'refreshing') {
			return {
				label: 'Checking source',
				description: 'ATLAS is comparing the saved workspace with the live source. The last saved snapshot remains visible while this finishes.',
				nextAction: 'Wait for verification before saving new changes.',
				writeBlockedReason: 'Saving is disabled while source verification is still running.',
			};
		}
		if (data.dataSource === 'live' && data.canPersistAssignments) {
			return {
				label: 'Verified live',
				description: 'Assignment data was checked against the live source. Draft changes can be saved.',
				nextAction: data.activeDraftCount > 0 ? 'Save the draft changes before leaving this page.' : 'Inspect one teacher or fill section coverage gaps.',
				writeBlockedReason: null,
			};
		}
		if (data.dataSource === 'cached' && data.canPersistAssignments) {
			return {
				label: 'Using saved data',
				description: data.degradedNotice ?? 'ATLAS is using a saved workspace snapshot with enough school-year evidence to allow edits.',
				nextAction: data.activeDraftCount > 0 ? 'Save the draft, then refresh when live verification is available.' : 'Review coverage carefully, then refresh when live verification is available.',
				writeBlockedReason: null,
			};
		}
		if (data.dataSource === 'cached') {
			return {
				label: 'Read-only saved data',
				description: data.degradedNotice ?? 'ATLAS can show the saved snapshot, but it cannot safely write assignment changes yet.',
				nextAction: 'Refresh the source before saving, auto-fill, reset, or transferring assignments.',
				writeBlockedReason: 'Saving is disabled until ATLAS verifies the live source.',
			};
		}
		return {
			label: 'No assignment data',
			description: data.error ?? 'ATLAS could not load a live source or a saved teaching load snapshot.',
			nextAction: 'Retry the source connection before assigning teachers.',
			writeBlockedReason: 'Saving is disabled because no teaching load data is available.',
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
				description: `${coverageHeadline.realAssigned} pairs are staffed by real teachers and ${coverageHeadline.syntheticAssigned} use Teacher X placeholders.`,
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
						autoFillLoading={data.loading}
						staffingNeedsLoading={data.loading}
						autoFillEnabled={Boolean(data.activeSchoolYearId) && data.canPersistAssignments && !data.splitBrainQuarantineRequired}
						onAutoFillClick={() => ui.setAutoFillDialogOpen(true)}
						onViewStaffingNeedsClick={handleViewStaffingNeeds}
						viewMode={ui.viewMode}
						onViewModeChange={(value) => ui.setViewMode(value as 'teacher' | 'allocation')}
						dataSource={data.dataSource}
						degradedWriteEnabled={data.degradedWriteEnabled}
						isWorkspaceWritable={data.canPersistAssignments}
						isOnline={data.isOnline}
						dataSourceNotice={data.degradedNotice}
						splitBrainIncident={data.splitBrainIncident}
						showJumpList={ui.showJumpList}
						onToggleJumpList={() => ui.setShowJumpList(!ui.showJumpList)}
						coverageMode={ui.coverageMode}
						onCoverageModeChange={ui.setCoverageMode}
						coverageModeConfig={COVERAGE_MODE_CONFIG}
						onGlobalResetClick={() => ui.setResetDialogOpen(true)}
						canRunGlobalReset={data.canRunGlobalReset}
						onReconcileClick={() => {
							void applySplitBrainReconcile();
						}}
						reconcileLoading={data.splitBrainApplyLoading}
						showReconcileAction={splitBrainNeedsReconcile}
						reconcileEnabled={data.canPersistAssignments}
						reviewDismissed={ui.reviewDismissed}
						workspaceStateLabel={workspaceState.label}
						workspaceStateDescription={workspaceState.description}
						workspaceStateNextAction={workspaceState.nextAction}
						coverageStateLabel={coverageState.label}
						coverageStateDescription={coverageState.description}
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
						<div className="shrink-0 px-3 pt-2 lg:px-5">
							<RolloverGuidanceCard compact />
						</div>

						<TeachingLoadTaskGuide
							unassignedPairs={coverageHeadline.unassigned}
							overCapCount={overCapCount}
							activeDraftCount={data.activeDraftCount}
							totalPairs={coverageHeadline.total}
							assignedPairs={coverageHeadline.assigned}
							isReadOnly={data.isReadOnlyMode}
							saving={data.saving}
							onShowUnassigned={showUnassignedTeachingLoad}
							onShowOverloaded={showOverloadedTeachers}
							onShowUnloadedTeachers={showTeachersWithoutLoad}
							onSaveDraft={() => void handleSave()}
						/>

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
							onToggleAdvancedGrid={() => setAdvancedGridVisible((visible) => !visible)}
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
								onSave={handleSave}
								onResetAssignments={data.handleResetAssignments}
								onDiscardDraft={discardSelectedDraft}
								canUndo={data.canUndo}
								canRedo={data.canRedo}
								onUndo={data.handleUndo}
								onRedo={data.handleRedo}
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

						<TeachingLoadDraftActionBar
							activeDraftCount={data.activeDraftCount}
							canUndo={data.canUndo}
							isReadOnlyMode={data.isReadOnlyMode}
							saving={data.saving}
							statusMessage={draftStatusMessage}
							writeBlockedReason={workspaceState.writeBlockedReason}
							onUndo={data.handleUndo}
							onDiscard={discardAllDrafts}
							onSave={() => void handleSave()}
						/>
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
			</div>

			<TeachingLoadModals
				autoFillDialogOpen={ui.autoFillDialogOpen}
				onAutoFillDialogOpenChange={ui.setAutoFillDialogOpen}
				coverageModeConfig={COVERAGE_MODE_CONFIG[ui.coverageMode]}
				onAutoFillConfirm={handleAutoFill}
				autoFillLoading={data.loading}
				swapCandidate={ui.swapCandidate}
				onSwapCandidateChange={ui.setSwapCandidate}
				onSwapConfirm={executeSwap}
				summaryModalOpen={ui.summaryModalOpen}
				onSummaryModalOpenChange={ui.setSummaryModalOpen}
				autoFillResult={autoFillResult}
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
				title="Save Teaching Load & Timetable Sync Warning"
				description="Saving these changes will make the current active draft timetable stale. Any sessions whose teachers or subject allocations were modified will be displaced to the unassigned list once the timetable is synced. Do you want to proceed?"
				onConfirm={() => handleSave(true)}
				confirmText="Confirm and Save"
				variant="warning"
			/>
		</TooltipProvider>
	);
}
