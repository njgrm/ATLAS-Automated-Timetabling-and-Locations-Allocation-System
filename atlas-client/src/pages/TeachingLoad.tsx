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
	ExternalSection,
	Subject,
	SectionAssignedClassesResult,
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

	const handleSave = useCallback(async () => {
		if (!data.activeSchoolYearId) return;
		const draftEntries = Object.entries(data.effectiveDraftAssignmentsByFaculty);
		if (draftEntries.length === 0) return;
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
					? `Assignments for ${data.selected.lastName} have been successfully updated.`
					: `Saved ${draftEntries.length} teaching-load draft ${draftEntries.length === 1 ? 'change' : 'changes'}.`,
			);
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			if (error?.response?.data?.code === 'VERSION_CONFLICT') {
				await data.fetchData({ forceRefresh: true });
				toast.error(`${error?.response?.data?.message ?? 'Failed to save assignments.'} Latest saved data was reloaded; your local draft remains visible.`);
			} else {
				toast.error(error?.response?.data?.message ?? 'Failed to save assignments.');
			}
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

	const handleSwapRequest = useCallback((subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => {
		ui.setSwapCandidate({ subjectId, sectionId, fromFacultyId, toFacultyId: toFacultyId ?? null });
	}, [ui]);

	const executeSwap = useCallback(async () => {
		if (!ui.swapCandidate) return;
		const { subjectId, sectionId, fromFacultyId, toFacultyId } = ui.swapCandidate;
		const destinationFacultyId = toFacultyId ?? data.selectedId;
		if (!destinationFacultyId) return;

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
			toast.success('Auto-fill completed successfully.', { id: toastId });
			await data.fetchData({ forceRefresh: true });
		} catch (error: any) {
			toast.error(error?.response?.data?.message ?? 'Auto-fill failed.', { id: toastId });
		}
	}, [applySplitBrainReconcile, data, splitBrainNeedsReconcile, ui]);

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
					/>
				</div>

				{splitBrainNeedsAttention && data.splitBrainIncident && (
					<div className="shrink-0 px-6 py-2 border-b border-border/30 bg-amber-50/60">
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 shadow-sm">
							<div className="flex items-center gap-3">
								<AlertTriangle className="size-4 text-amber-600" />
								<div>
									<span className="text-xs font-semibold uppercase tracking-widest text-amber-800">
										{data.splitBrainQuarantineRequired ? 'Lock Active' : 'Review Required'}
									</span>
									<span className="text-sm font-semibold ml-2 text-amber-900">{data.splitBrainIncident.quarantine.message}</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								{splitBrainNeedsReconcile && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											void applySplitBrainReconcile();
										}}
										disabled={data.splitBrainApplyLoading || !data.canPersistAssignments}
										className="h-8 shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
									>
										{data.splitBrainApplyLoading ? 'Reconciling...' : 'Repair Saved Scope Drift'}
									</Button>
								)}
								{!data.splitBrainQuarantineRequired && (
									<Button 
										variant="ghost" 
										size="icon-xs" 
										onClick={() => ui.setReviewDismissed(true)} 
										className="h-8 w-8 hover:bg-amber-200 text-amber-800"
										title="Dismiss Review Warning"
									>
										<span className="sr-only">Dismiss</span>
										<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x size-4"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
									</Button>
								)}
							</div>
						</div>
					</div>
				)}

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
							/>
						)}
					</div>

					{/* Persistent Inspector Area */}
					<div className="w-80 shrink-0 border-l border-border/40 shadow-xl z-10 bg-background">
						{ui.viewMode === 'teacher' ? (
							<WorkloadInspector
								selected={data.selected}
								loadProfile={ui.loadProfile}
								rotationTermBreakdown={data.selected?.rotationTermBreakdown ?? []}
								hoveredIncomingMinutes={ui.hoveredIncomingMinutes}
								previewLoadHours={previewLoadHours}
								isReadOnlyMode={data.isReadOnlyMode}
							/>
						) : (
							<SectionInspector
								section={ui.selectedSectionId ? data.sectionMap.get(ui.selectedSectionId) ?? null : null}
								sectionContract={selectedSectionContract}
								effectiveOwnershipMap={data.effectiveOwnershipMap}
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
