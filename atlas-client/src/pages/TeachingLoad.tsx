import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';

import atlasApi from '@/lib/api';
import {
	buildMultiOwnerSavedMap,
	buildOwnershipMap,
	buildOwnershipMapFromIndex,
	getAssignmentOwnershipKey,
	STANDARD_WEEKLY_TEACHING_HOURS,
	computeSectionAssignmentDeltaMinutes,
} from '@/lib/faculty-assignment-helpers';
import { TooltipProvider } from '@/ui/tooltip';
import { useTeachingLoadData } from '@/hooks/useTeachingLoadData';
import { useTeachingLoadUI } from '@/hooks/useTeachingLoadUI';
import { TeacherGridMode } from '@/components/faculty-assignments/TeacherGridMode';
import { SectionGridMode } from '@/components/faculty-assignments/SectionGridMode';
import { WorkloadInspector } from '@/components/faculty-assignments/WorkloadInspector';
import { SectionInspector } from '@/components/faculty-assignments/SectionInspector';
import { WorkspaceToolbar } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadModals } from '@/components/faculty-assignments/TeachingLoadModals';
import { StaffingAuditSheet } from '@/components/faculty-assignments/StaffingAuditSheet';
import type { 
	AutoFillSummaryResult, 
	CoverageMode, 
	SpecialProgramRebalancePreviewResult 
} from '@/types';

const DEFAULT_SCHOOL_ID = 1;

const COVERAGE_MODE_CONFIG: Record<CoverageMode, { label: string; description: string }> = {
	REAL_FACULTY_STANDARD: {
		label: 'Standard Faculty Load (30h)',
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

export default function TeachingLoad() {
	const data = useTeachingLoadData();
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

	const dirty = Boolean(data.effectiveDraftAssignmentsByFaculty[data.selectedId ?? 0]);

	const handleSave = useCallback(async () => {
		if (!data.selectedId || !data.activeSchoolYearId) return;
		data.setSaving(true);
		try {
			await atlasApi.post('/faculty-assignments/batch', {
				schoolId: DEFAULT_SCHOOL_ID,
				schoolYearId: data.activeSchoolYearId,
				facultyId: data.selectedId,
				assignments: data.effectiveDraftAssignmentsByFaculty[data.selectedId],
			});
			toast.success(`Assignments for ${data.selected?.lastName} have been successfully updated.`);
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Failed to save assignments.');
		} finally {
			data.setSaving(false);
		}
	}, [data]);

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
	}, [data]);

	const handleSwapRequest = useCallback((subjectId: number, sectionId: number, fromFacultyId: number) => {
		ui.setSwapCandidate({ subjectId, sectionId, fromFacultyId });
	}, [ui]);

	const executeSwap = useCallback(async () => {
		if (!ui.swapCandidate || !data.selectedId) return;
		const { subjectId, sectionId, fromFacultyId } = ui.swapCandidate;
		try {
			data.pushHistory();
			data.setDraftAssignmentsByFaculty((prev) => {
				const fromCurrent = [...(data.effectiveAssignmentsByFaculty[fromFacultyId] ?? [])];
				const fromIndex = fromCurrent.findIndex((a) => a.subjectId === subjectId);
				if (fromIndex >= 0) {
					fromCurrent[fromIndex] = {
						...fromCurrent[fromIndex],
						sectionIds: fromCurrent[fromIndex].sectionIds.filter((id) => id !== sectionId),
					};
				}

				const toCurrent = [...(data.effectiveAssignmentsByFaculty[data.selectedId!] ?? [])];
				const toIndex = toCurrent.findIndex((a) => a.subjectId === subjectId);
				if (toIndex >= 0) {
					toCurrent[toIndex] = {
						...toCurrent[toIndex],
						sectionIds: Array.from(new Set([...toCurrent[toIndex].sectionIds, sectionId])),
					};
				} else {
					toCurrent.push({ subjectId, sectionIds: [sectionId], gradeLevels: [] });
				}

				return { ...prev, [fromFacultyId]: fromCurrent, [data.selectedId!]: toCurrent };
			});
			toast.success('Ownership swapped in draft mode.');
		} catch (err: any) {
			toast.error(err?.response?.data?.message ?? 'Failed to prepare swap.');
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
			toast.success('All assignments for the current school year have been cleared.');
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
		const toastId = toast.loading(`Running auto-fill (${COVERAGE_MODE_CONFIG[ui.coverageMode].label})...`);
		try {
			const { data: result } = await atlasApi.post<AutoFillSummaryResult>(
				'/faculty-assignments/autofill',
				{
					schoolId: DEFAULT_SCHOOL_ID,
					schoolYearId: data.activeSchoolYearId,
					mode: ui.coverageMode,
				},
			);
			setAutoFillResult(result);
			ui.setSummaryModalOpen(true);
			toast.success('Auto-fill completed successfully.', { id: toastId });
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Auto-fill failed.', { id: toastId });
		}
	}, [data, ui]);

	const handleViewStaffingNeeds = useCallback(() => {
		ui.setStaffingAuditOpen(true);
	}, [ui]);

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
		toast.info('Draft changes discarded.');
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

	const sectionsBySubject = useMemo(() => {
		const grouped: Record<number, ExternalSection[]> = {};
		for (const section of data.allKnownSections) {
			const gradeMatch = ui.gradeLevelFilter === 'all' || section.displayOrder === Number(ui.gradeLevelFilter);
			if (!gradeMatch) continue;
			data.subjects.forEach((subject) => {
				const gradeCompatible = subject.gradeLevels.length === 0 || subject.gradeLevels.includes(section.displayOrder);
				const programType = (section.programType ?? 'REGULAR').toUpperCase();
				const programCompatible = subject.programScopes.length === 0 || subject.programScopes.some(s => s.toUpperCase() === programType);
				
				if (gradeCompatible && programCompatible) {
					if (!grouped[subject.id]) grouped[subject.id] = [];
					grouped[subject.id].push(section);
				}
			});
		}
		return grouped;
	}, [data.allKnownSections, data.subjects, ui.gradeLevelFilter]);

	const departmentOptions = useMemo(() => {
		const depts = new Set(data.faculty.map((f) => f.department).filter(Boolean) as string[]);
		return Array.from(depts).sort();
	}, [data.faculty]);

	if (data.error && data.dataSource === 'none') {
		return (
			<div className="flex h-[calc(100svh-3.5rem)] items-center justify-center p-6">
				<Card className="max-w-md border-red-200 bg-red-50 p-8 text-center shadow-lg">
					<AlertTriangle className="mx-auto size-12 text-red-600 mb-4" />
					<h3 className="text-lg font-black text-red-900 uppercase tracking-tight mb-2">Workspace Unavailable</h3>
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
				<div className="shrink-0 px-6 py-2 border-b border-border/40">
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
						onViewModeChange={ui.setViewMode}
						dataSource={data.dataSource}
						degradedWriteEnabled={data.degradedWriteEnabled}
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
					/>
				</div>

				<div className="flex-1 flex min-h-0">
					{/* Main Grid Area */}
					<div className="flex-1 flex flex-col min-w-0">
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
								savedOwnershipMap={data.savedOwnershipMap}
								pendingOwnershipMap={data.pendingOwnershipMap}
								savedConflictMap={data.savedConflictMap}
								onSetSections={handleSetSections}
								onSwapSectionOwnership={handleSwapRequest}
								departmentQualifiedSubjects={ui.departmentQualifiedSubjects}
								outsideDepartmentSubjects={ui.outsideDepartmentSubjects}
								homeroomHint={data.homeroomHint}
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
								departmentFilter={ui.departmentFilter}
								onDepartmentFilterChange={ui.setDepartmentFilter}
								departmentOptions={departmentOptions}
								sortOrder={ui.sortOrder}
								onSortOrderChange={ui.setSortOrder}
								showFilters={ui.showFilters}
								onToggleFilters={() => ui.setShowFilters(!ui.showFilters)}
								showOutsideDept={ui.showOutsideDept}
								onToggleOutsideDept={ui.setShowOutsideDept}
							/>
						) : (
							<SectionGridMode
								loading={data.loading}
								subjects={data.subjects}
								sectionsBySubject={sectionsBySubject}
								faculty={data.faculty}
								savedOwnershipMap={data.savedOwnershipMap}
								pendingOwnershipMap={data.pendingOwnershipMap}
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
							/>
						)}
					</div>

					{/* Persistent Inspector Area */}
					<div className="w-80 shrink-0 border-l border-border/40 shadow-xl z-10 bg-background">
						{ui.viewMode === 'teacher' ? (
							<WorkloadInspector
								selected={data.selected}
								loadProfile={ui.loadProfile}
								rotationTermBreakdown={ui.loadProfile.rotationFamilies.map(f => ({
									family: f.family,
									peakTermMinutesPerWeek: f.creditedHours * 60,
									peakTermRank: f.dominantTermRank ?? 1,
									peakTermLabel: f.dominantTermLabel ?? '',
									termGroupId: f.termGroupId ?? '',
									termCount: f.termCount ?? 3,
									termBuckets: f.termBuckets.map(b => ({
										termRank: b.termRank,
										termLabel: b.termLabel,
										termGroupId: b.termGroupId,
										termCount: b.termCount,
										creditedMinutesPerWeek: b.creditedMinutes,
										unitCount: b.unitCount,
										subjectCodes: b.subjectCodes,
									})),
									isPeakTerm: false // added for type compatibility if needed
								}))}
								hoveredIncomingMinutes={ui.hoveredIncomingMinutes}
								previewLoadHours={previewLoadHours}
								isReadOnlyMode={data.isReadOnlyMode}
							/>
						) : (
							<SectionInspector
								section={ui.selectedSectionId ? data.sectionMap.get(ui.selectedSectionId) ?? null : null}
								subjects={data.subjects}
								assignmentsByFaculty={data.effectiveAssignmentsByFaculty}
								savedOwnershipMap={data.savedOwnershipMap}
								pendingOwnershipMap={data.pendingOwnershipMap}
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
				onNavigateToAllocation={handleNavigateToAllocation}
			/>
		</TooltipProvider>
	);
}
