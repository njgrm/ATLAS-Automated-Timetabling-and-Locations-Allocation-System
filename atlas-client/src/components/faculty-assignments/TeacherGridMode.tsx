import { useMemo, useState, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import {
	ChevronDown,
	ChevronRight,
	AlertTriangle,
	Eye,
	Search,
	Users,
	MoreHorizontal,
	Pencil,
	RotateCcw,
	Star
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
	resolveTeachingActualHours,
	teachingUtilizationPercentFor,
	remainingCapacityMinutesForLoadProfile,
	type FacultyOwnershipState,
	type TeachingLoadStatusFilter,
	type TeachingLoadLoadFilter,
	type TeachingLoadFacet,
} from '@/lib/faculty-assignment-helpers';
import type { FacultySummary, FacultyAssignmentDraft, Subject, ExternalSection, LoadProfile } from '@/types';
import { SubjectRow } from './SubjectRow';
import { TeacherLoadReadout } from './TeacherLoadReadout';
import { TeachingLoadFilterBar } from './TeachingLoadFilterBar';
import { formatFacultyDisplayName } from '@/components/faculty/teacherNameDisplay';
import { formatFacultyInitials } from '@/components/faculty/teacherNameDisplay';
import { countDistinctSections } from '@/lib/teaching-load-counts';
import {
	buildTeacherWorkloadAuditSnapshot,
	clearTeacherWorkloadAudit,
	publishTeacherWorkloadAudit,
} from './teacherWorkloadAudit';

type TeacherGridModeProps = {
	loading: boolean;
	faculty: FacultySummary[];
	filteredFaculty: FacultySummary[];
	groupedFaculty: [string, FacultySummary[]][];
	selectedId: number | null;
	onSelectTeacher: (id: number) => void;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	effectiveDraftAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	subjects: Subject[];
	sectionsBySubject: Record<number, ExternalSection[]>;
	saving: boolean;
	isReadOnlyMode: boolean;
	effectiveOwnershipMap: Record<string, FacultyOwnershipState & { isPending: boolean }>;
	savedConflictMap: Record<string, FacultyOwnershipState[]>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	onSwapSectionOwnership: (subjectId: number, sectionId: number, fromFacultyId: number) => void;
	departmentQualifiedSubjects: Subject[];
	outsideDepartmentSubjects: Subject[];
	homeroomHint: { advisedSectionId: number | null } | null;
	/**
	 * Canonical workload profile for the selected teacher. Null until the
	 * selected teacher's load resolves (and when no teacher is selected), which
	 * is why every dereference below is nullable. Typed as `LoadProfile | null`
	 * instead of `any` after the live null-dereference crash
	 * (`remainingHours`) — see CLIENT-QUALITY-C01.
	 */
	loadProfile: LoadProfile | null;
	onHoverLoadMinutes: (minutes: number) => void;
	onClearHoverLoad: () => void;
	activeFacultyIds: Set<number>;
	resolveSectionHoverDeltaMinutes: (subject: Subject, sectionId: number) => number;
	onResetAssignments: () => void;
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	filterStatus: TeachingLoadStatusFilter;
	onFilterStatusChange: (s: TeachingLoadStatusFilter) => void;
	statusFacetCounts: Record<TeachingLoadFacet, number>;
	loadFilter: TeachingLoadLoadFilter;
	loadFacetCounts: Record<'below-standard' | 'at-standard' | 'excess', number>;
	onLoadFilterChange: (s: TeachingLoadLoadFilter) => void;
	departmentFilter: string;
	onDepartmentFilterChange: (d: string) => void;
	departmentOptions: { value: string; label: string; count: number }[];
	filterAnnouncement: string;
	onClearTeachingLoadFilters: () => void;
	effectiveActualHours: Map<number, number>;
	/** Explicit effective teaching standard (hours). Null when UNCONFIGURED. */
	teachingStandardHours: number | null;
	policyReady: boolean;
	sortOrder: string;
	onSortOrderChange: (o: any) => void;
	showFilters: boolean;
	onToggleFilters: () => void;
	showOutsideDept: boolean;
	onToggleOutsideDept: (s: boolean) => void;
	showUnmappedSpecialization: boolean;
	onShowUnmappedSpecializationChange: (s: boolean) => void;
	completedSectionIds: Set<number>;
	workspaceStateLabel: string;
	workspaceStateNextAction: string;
	writeBlockedReason: string | null;
	/**
	 * FIX 16.1 — open the centred `Teacher Workload` review modal for ONE named
	 * teacher.
	 *
	 * This replaces the page's detached bottom-right `Review teachers` button,
	 * which opened whichever teacher happened to be selected. The caller selects
	 * the row's teacher and opens the same modal, so the two entry points cannot
	 * disagree about what "review" means.
	 */
	onReviewLoad: (facultyId: number) => void;
	/**
	 * FIX 40 — the page's Undo / Redo / Discard / Save group, rendered inside the
	 * single filter row instead of a bottom sticky footer.
	 */
	draftControls?: ReactNode;
};

export function TeacherGridMode({
	loading,
	faculty,
	filteredFaculty,
	groupedFaculty,
	selectedId,
	onSelectTeacher,
	effectiveAssignmentsByFaculty,
	effectiveDraftAssignmentsByFaculty,
	subjects,
	sectionsBySubject,
	saving,
	isReadOnlyMode,
	effectiveOwnershipMap,
	savedConflictMap,
	onSetSections,
	onSwapSectionOwnership,
	departmentQualifiedSubjects,
	outsideDepartmentSubjects,
	homeroomHint,
	loadProfile,
	onHoverLoadMinutes,
	onClearHoverLoad,
	activeFacultyIds,
	resolveSectionHoverDeltaMinutes,
	onResetAssignments,
	searchQuery,
	onSearchQueryChange,
	filterStatus,
	onFilterStatusChange,
	statusFacetCounts,
	loadFilter,
	loadFacetCounts,
	onLoadFilterChange,
	departmentFilter,
	onDepartmentFilterChange,
	departmentOptions,
	filterAnnouncement,
	onClearTeachingLoadFilters,
	effectiveActualHours,
	teachingStandardHours,
	policyReady,
	sortOrder,
	onSortOrderChange,
	showFilters,
	onToggleFilters,
	showOutsideDept,
	onToggleOutsideDept,
	showUnmappedSpecialization,
	onShowUnmappedSpecializationChange,
	completedSectionIds,
	workspaceStateLabel,
	workspaceStateNextAction,
	writeBlockedReason,
	onReviewLoad,
	draftControls,
}: TeacherGridModeProps) {
	const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

	/*
	 * Fix 26 — the `Teacher Workload Audit Summary` data feed.
	 *
	 * The summary modal is rendered by `TeachingLoadModals`, a SIBLING of this
	 * component, and `pages/TeachingLoad.tsx` passes it only the already-selected
	 * teacher's inspector node. So the census it needs is published from here —
	 * the one place in the client that already holds the whole roster, the
	 * draft-aware effective hours map, and the explicit standard, and that already
	 * derives every row's hours with `resolveTeachingActualHours`.
	 *
	 * Consequences worth stating: the summary's counts are the SAME numbers the
	 * roster rows are showing at that instant (same function, same input map, so
	 * unsaved draft changes are included in both), and the modal fetches nothing.
	 * The census is the unfiltered `faculty` prop, because an audit is a census —
	 * the summary says so on screen.
	 *
	 * `onSelectTeacher` is published alongside it so a click-through row selects
	 * the teacher through the page's own selection setter. That is selection
	 * state only: it never saves, discards, or applies a draft.
	 */
	const auditSnapshot = useMemo(
		() => buildTeacherWorkloadAuditSnapshot({
			faculty,
			effectiveActualHours,
			teachingStandardHours,
			policyReady,
			loading,
		}),
		[faculty, effectiveActualHours, teachingStandardHours, policyReady, loading],
	);

	useEffect(() => {
		publishTeacherWorkloadAudit(auditSnapshot, onSelectTeacher);
	}, [auditSnapshot, onSelectTeacher]);

	// Unpublish on unmount. `pages/TeachingLoad.tsx` hides this grid behind
	// "Advanced", and a retained census would be a roster from a screen that is
	// no longer showing one; the summary's honest `unavailable` state is the
	// truthful answer there.
	useEffect(() => clearTeacherWorkloadAudit, []);

	/*
	 * A6 C2 (Slice 3, Major 4) — the row opens a READ-ONLY PROFILE, and only an
	 * explicit control opens the assignment editor.
	 *
	 * THE DEFECT, MEASURED BY LANE C: a compact ~58px `VALDEZ, GABRIELA LUZ` card
	 * expanded INLINE into a long assignment editor containing `Unassign all`,
	 * `Assign GR8`, per-section checkboxes and Swap controls. It pushed the whole
	 * roster away and put destructive-looking controls among ordinary inspection
	 * content, so an older scheduler could lose their place or mistake review for
	 * editing. There was no review-only profile and no edit boundary.
	 *
	 * TWO INDEPENDENT THINGS, NOW SEPARATE:
	 *
	 *   INSPECT  the row's own click (or its `Review load` button) opens the
	 *           existing read-only profile — the SAME `onReviewLoad` the accepted
	 *           per-row control already used, so the page's ONE
	 *           `openTeacherReview` -> `ReviewTeachersModal` -> `activeInspector`
	 *           path is reused rather than re-authored. No new authority.
	 *   EDIT     `data-testid="teaching-load-edit-assignments"` is the only thing
	 *           that mounts the inline editor, and it is labelled as an edit.
	 *
	 * `editorId` replaces the old `expandedId`, and the pre-existing effect that
	 * expanded a row whenever `selectedId` changed is GONE: that effect is what
	 * made selecting a teacher — including selecting it to INSPECT it — mount the
	 * destructive controls. `a3-teaching-load-review-c2` C2-5 pinned that effect;
	 * it is superseded there, and the replacement is strictly stronger: no
	 * selection path may open the editor, and inspection must expose none of its
	 * controls.
	 */
	const [editorId, setEditorId] = useState<number | null>(null);

	/** Inspect: select, then open the read-only profile. Never edits. */
	const handleTeacherClick = (id: number) => {
		onSelectTeacher(id);
		setEditorId((current) => (current === id ? null : id));
		onReviewLoad(id);
	};

	/** Edit: the ONLY path that mounts the inline assignment editor. */
	const handleToggleEditor = (event: ReactMouseEvent, id: number) => {
		event.stopPropagation();
		onSelectTeacher(id);
		setEditorId((current) => (current === id ? null : id));
	};

	if (loading) {
		return (
			<div className="flex-1 p-6 space-y-4">
				<div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
					<p className="text-sm font-semibold text-blue-900">Checking teacher assignments.</p>
					<p className="mt-1 text-xs font-medium text-blue-700">ATLAS is loading the roster, subjects, and current section ownership before edits appear.</p>
				</div>
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} className="h-16 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-muted/5">
			{/* Familiar Discovery Controls */}
			<div className="shrink-0 border-b border-border/40 bg-background/50 p-2.5 space-y-2 backdrop-blur-sm lg:px-4">
				{isReadOnlyMode && writeBlockedReason && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2 text-amber-900">
						<div className="flex items-start gap-3">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
							<div>
								<p className="text-sm font-semibold">{workspaceStateLabel}</p>
								<p className="text-xs font-medium text-amber-800/80">{writeBlockedReason}</p>
							</div>
						</div>
						<p className="text-xs font-semibold text-amber-800">{workspaceStateNextAction}</p>
					</div>
				)}

				{/* Fix 14/16: extracted to its own file. Every discovery control
					now sits on ONE always-visible row (fix 39) and this block adds
					no scroll container. Fix 40 hands it the page's draft controls so
					the bottom sticky footer could be deleted. */}
				<TeachingLoadFilterBar
					searchQuery={searchQuery}
					onSearchQueryChange={onSearchQueryChange}
					filterStatus={filterStatus}
					onFilterStatusChange={onFilterStatusChange}
					statusFacetCounts={statusFacetCounts}
					loadFilter={loadFilter}
					loadFacetCounts={loadFacetCounts}
					onLoadFilterChange={onLoadFilterChange}
					departmentFilter={departmentFilter}
					onDepartmentFilterChange={onDepartmentFilterChange}
					departmentOptions={departmentOptions}
					filterAnnouncement={filterAnnouncement}
					onClearTeachingLoadFilters={onClearTeachingLoadFilters}
					sortOrder={sortOrder}
					onSortOrderChange={onSortOrderChange}
					showFilters={showFilters}
					onToggleFilters={onToggleFilters}
					showOutsideDept={showOutsideDept}
					onToggleOutsideDept={onToggleOutsideDept}
					showUnmappedSpecialization={showUnmappedSpecialization}
					onShowUnmappedSpecializationChange={onShowUnmappedSpecializationChange}
					policyReady={policyReady}
					draftControls={draftControls}
				/>
			</div>

			<div className="flex-1 overflow-auto p-3 space-y-3 no-scrollbar lg:p-4">
				{faculty.length === 0 ? (
					<div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background p-10 text-center">
						<Users className="mb-4 size-10 text-muted-foreground/40" />
						<h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">No teacher roster loaded</h3>
						<p className="mt-2 max-w-md text-sm font-medium text-muted-foreground">Refresh the source from the top bar before assigning subjects and sections.</p>
					</div>
				) : groupedFaculty.length === 0 ? (
					<div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background p-10 text-center">
						<Search className="mb-4 size-10 text-muted-foreground/40" />
						<h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">No teachers match these filters</h3>
						<p className="mt-2 max-w-md text-sm font-medium text-muted-foreground">Clear the search or filters to inspect teacher load.</p>
					</div>
				) : groupedFaculty.map(([dept, members]) => {
					const isCollapsed = collapsedDepts[dept] ?? false;
					return (
						<div key={dept} className="space-y-2">
							{/* Phase 4.6: department collapse is keyboard-operable. */}
							<div
								role="button"
								tabIndex={0}
								aria-expanded={!isCollapsed}
								onKeyDown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }));
									}
								}}
								className="flex items-center justify-between gap-3 px-2 py-1.5 cursor-pointer select-none hover:bg-muted/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
								onClick={() => setCollapsedDepts(prev => ({ ...prev, [dept]: !prev[dept] }))}
							>
								<div className="flex items-center gap-2">
									{isCollapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
									<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{dept}</h3>
								</div>
								<div className="flex-1 h-px bg-border/30" />
								<Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground shadow-none">{members.length}</Badge>
							</div>
							
							{!isCollapsed && (
								<div className="space-y-2">
									{members.map((member) => {
										const isSelected = selectedId === member.id;
										/** A6 C2: only the explicit `Edit assignments` control sets this. */
										const isEditing = editorId === member.id;
										const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
										// Canonical row signal: actual teaching hours + teaching utilization
										// against the explicit effective standard. Advisory/ancillary credit
										// never inflates it. Unknown standard shows hours without a percent.
										const displayHours = resolveTeachingActualHours(member, effectiveActualHours);
										const utilization = member.isPlaceholder || teachingStandardHours == null
											? null
											: teachingUtilizationPercentFor(member, teachingStandardHours, effectiveActualHours);
										
										const subjectsCount = effectiveAssignmentsByFaculty[member.id]?.length || 0;
										// LANE-C C02 (audit A1): distinct sections, not the per-subject sum.
										const sectionsCount = countDistinctSections(effectiveAssignmentsByFaculty[member.id]);

										return (
											<div 
												key={member.id} 
												className={cn(
													"rounded-xl border transition-all duration-200",
													isSelected ? "bg-background border-primary/30 shadow-md ring-1 ring-primary/5" : "bg-background border-border/40 hover:border-primary/20 hover:shadow-sm"
												)}
											>
											{/*
											 * A6 C2: this row is the READ-ONLY PROFILE entry, not a
											 * disclosure. `aria-expanded` is GONE from it, because it no
											 * longer expands anything — a control that advertises an
											 * expansion it does not perform is a worse lie than the
											 * inline editor was. The keyboard path opens the same
											 * profile the click does, and `aria-label` says which, so
											 * a screen-reader user is told they are opening a profile and
											 * not an editor.
											 */}
											<div
												role="button"
												tabIndex={0}
												aria-label={`Workload profile for ${member.lastName}, ${member.firstName}`}
												onKeyDown={(event) => {
													if (event.key === 'Enter' || event.key === ' ') {
														event.preventDefault();
														handleTeacherClick(member.id);
													}
												}}
												className="flex items-center gap-3 p-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
												onClick={() => handleTeacherClick(member.id)}
											>
													<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/10">
														{/* The ONE canonical helper, `formatFacultyInitials` in
								    `@/components/faculty/teacherNameDisplay` — the same one
								    `WorkloadInspector`, the audit rows and the Teachers roster
								    use. The inline `[0]` indexing this replaces read as empty
								    text for a blank given name; the helper is total. A local
								    stand-in briefly lived here with a DELETE-ON-MERGE note and
								    was discharged on merge: two conventions for one avatar is
								    the defect Fix 22's audit row exists to prevent. */}
												{formatFacultyInitials(member)}
													</div>
													
													{/* Name + department: always visible, never collapsed behind initials */}
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															{/* Fix 22: canonical `Last, First`; the CSS `uppercase` shout on a
																Filipino given name is removed. Stored value unchanged. */}
															<h4 className="text-sm font-semibold tracking-tight truncate">
																{formatFacultyDisplayName(member)}
															</h4>
															{member.isClassAdviser && (
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Star className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />
																	</TooltipTrigger>
																	<TooltipContent side="top" className="text-xs font-semibold uppercase">Class Adviser</TooltipContent>
																</Tooltip>
															)}
															{hasDraft && <Badge variant="secondary" className="h-4 px-1.5 text-xs font-semibold uppercase bg-sky-100 text-sky-700 animate-pulse">Draft</Badge>}
														</div>
														<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">
															{member.departmentLabel || member.department || 'Unmapped'}
														</p>
													</div>

													{/* FIX 16.1 — the inline per-teacher review control.
												 *
												 * It sits in the row's own empty gap, right of the
												 * name/department block and left of the load signals,
												 * so opening a workload is one click on the teacher the
												 * scheduler is already reading instead of a scroll to
												 * a detached bottom-right button.
												 *
												 * `event.stopPropagation()` is LOAD-BEARING, not
												 * defensive. The whole row above is a `div
												 * role="button"` whose click toggles expansion; without
												 * the stop, one click both opens the modal and expands
												 * the row, and the expanded body is scrolled out of
												 * sight behind the dialog.
												 *
												 * WCAG 2.5.3 Label in Name: the accessible name
												 * (`Review load for DELA CRUZ, MARIA`) CONTAINS the
												 * visible label (`Review load`), so a voice-control
												 * user saying the visible text still reaches it. The
												 * row stays keyboard-operable and this is a real
												 * button, so it is in the Tab order after the row. */}
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium"
													data-testid="teaching-load-row-review"
													aria-label={`Review load for ${formatFacultyDisplayName(member)}`}
													onClick={(event) => {
														event.stopPropagation();
														onReviewLoad(member.id);
													}}
												>
												<Eye className="size-3.5" />
												Review load
											</Button>

											{/*
											 * A6 C2 (Slice 3) — the explicit EDIT entry point, and the
											 * only thing on this roster that mounts the assignment editor.
											 *
											 * `event.stopPropagation()` is still load-bearing: without it the
											 * click also bubbles to the row, which opens the read-only
											 * profile, and the operator gets a profile dialog stacked over
											 * the editor they just asked for.
											 *
											 * It carries `aria-expanded` + `aria-controls` because it IS the
											 * disclosure, and the row above no longer claims to be one.
											 */}
											<Button
												type="button"
												variant="outline"
												size="sm"
												aria-expanded={isEditing}
												aria-controls={`teaching-load-assignment-editor-${member.id}`}
												aria-label={`${isEditing ? 'Close the assignment editor for' : 'Edit assignments for'} ${formatFacultyDisplayName(member)}`}
												className="h-8 shrink-0 gap-1.5 px-3 text-xs font-medium"
												data-testid="teaching-load-edit-assignments"
												onClick={(event) => handleToggleEditor(event, member.id)}
											>
												{isEditing ? <ChevronDown className="size-3.5" /> : <Pencil className="size-3.5" />}
												{isEditing ? 'Done editing' : 'Edit assignments'}
											</Button>


												{/* Load Signals: compact on mobile, full on desktop */}
													<div className="flex items-center gap-3 shrink-0 sm:gap-6 sm:px-4">
														<div className="text-right">
															{/* A3 A1: the percentage now carries a visible label beside
															 * it, and the withheld-percentage case has its own honest
															 * state. The bar/colour treatment and the long-form tooltip
															 * are unchanged. See TeacherLoadReadout. */}
															<TeacherLoadReadout
																displayHours={displayHours}
																utilization={utilization}
																isPlaceholder={member.isPlaceholder}
																standardHours={teachingStandardHours}
																policyReady={policyReady}
																maxHoursPerWeek={member.maxHoursPerWeek}
															/>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tight hidden sm:block">Hours / week</p>
														</div>
														<div className="text-right min-w-10 hidden sm:block">
															<p className="text-xs font-semibold tabular-nums">{subjectsCount}</p>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Subjects</p>
														</div>
														<div className="text-right min-w-10 hidden sm:block">
															<p className="text-xs font-semibold tabular-nums">{sectionsCount}</p>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Sections</p>
														</div>
													</div>

												<div className="flex items-center gap-2 shrink-0" aria-hidden="true" />
											</div>

											{/*
											 * A6 C2: the inline assignment editor. It renders ONLY under
											 * `isEditing`, which only `Edit assignments` sets — selecting a
											 * teacher to inspect it can no longer produce `Unassign all`,
											 * `Assign GR8`, section checkboxes or Swap controls.
											 */}
											{isEditing && (
												<div className="p-3 bg-muted/5 space-y-4" id={`teaching-load-assignment-editor-${member.id}`} data-testid="teaching-load-assignment-editor">
														{/* Actions Bar (Sticky) */}
														<div className="sticky top-[calc(0px-1.5rem)] z-20 flex items-center justify-between gap-0 bg-background/95 backdrop-blur-sm px-2 py-1 border-b border-border/40 shadow-sm">
															<p className="text-xs font-semibold text-muted-foreground truncate">
																{member.firstName} {member.lastName} assignments
															</p>
															<DropdownMenu>
																<DropdownMenuTrigger asChild>
																	<Button size="icon-xs" variant="ghost" className="h-7 w-7" aria-label="Row tools">
																		<MoreHorizontal className="size-4" />
																	</Button>
																</DropdownMenuTrigger>
																<DropdownMenuContent align="end" className="w-44">
																	<DropdownMenuItem
																		onClick={onResetAssignments}
																		disabled={saving || isReadOnlyMode}
																	>
																		<RotateCcw className="size-4 mr-2" />
																		Reset assignments
																	</DropdownMenuItem>
																</DropdownMenuContent>
															</DropdownMenu>
														</div>

														{/* Subjects Section */}
														<div className="space-y-4">
															{departmentQualifiedSubjects.length > 0 && (
																<div className="space-y-3">
																	<div className="flex items-center gap-3">
																		<span className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70">Qualified Subjects</span>
																		<div className="flex-1 h-px bg-emerald-500/10" />
																	</div>
																	<div className="grid gap-3">
												{departmentQualifiedSubjects.map((subject) => (
													/* FIX-29: targetFacultyName below is the DISPLAY name of the
													   teacher receiving a swap, formatted with the one shared
													   helper so the confirmation and the roster card print the
													   identical string. It cannot live as a comment between
													   attributes: JSX attribute position accepts only pairs and
													   spread expressions, so a brace-comment there is a parse
													   error (TS1005). */
													<SubjectRow
														key={subject.id}
														subject={subject}
														assignment={effectiveAssignmentsByFaculty[member.id]?.find((a) => a.subjectId === subject.id)}
														sections={sectionsBySubject[subject.id] ?? []}
														disabled={saving || !member.isActiveForScheduling || isReadOnlyMode}
														selectedFacultyId={member.id}
																				effectiveOwnershipMap={effectiveOwnershipMap}
																				savedConflictMap={savedConflictMap}
																				onSetSections={onSetSections}
																				advisedSectionId={homeroomHint?.advisedSectionId}
																				remainingCapacityMinutes={remainingCapacityMinutesForLoadProfile(loadProfile)}
																				onHoverLoadMinutes={onHoverLoadMinutes}
																				onClearHoverLoad={onClearHoverLoad}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={onSwapSectionOwnership}
																				selectedFacultySpecialization={member.specialization}
																				targetFacultyName={formatFacultyDisplayName(member)}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				completedSectionIds={completedSectionIds}
																			/>
																		))}
																	</div>
																</div>
															)}

															{showOutsideDept && outsideDepartmentSubjects.length > 0 && (
																<div className="space-y-3">
																	<div className="flex items-center gap-3">
																		<span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/50">Cross-Department</span>
																		<div className="flex-1 h-px bg-border/40" />
																	</div>
																	<div className="grid gap-3">
												{outsideDepartmentSubjects.map((subject) => (
													/* Same FIX-29 contract as the qualified-subjects list above:
													   targetFacultyName is the shared display name of the teacher
													   receiving the swap. */
													<SubjectRow
														key={subject.id}
														subject={subject}
														assignment={effectiveAssignmentsByFaculty[member.id]?.find((a) => a.subjectId === subject.id)}
														sections={sectionsBySubject[subject.id] ?? []}
														disabled={saving || !member.isActiveForScheduling || isReadOnlyMode}
														selectedFacultyId={member.id}
																				effectiveOwnershipMap={effectiveOwnershipMap}
																				savedConflictMap={savedConflictMap}
																				onSetSections={onSetSections}
																				isOutsideDepartment
																				advisedSectionId={homeroomHint?.advisedSectionId}
																				remainingCapacityMinutes={remainingCapacityMinutesForLoadProfile(loadProfile)}
																				onHoverLoadMinutes={onHoverLoadMinutes}
																				onClearHoverLoad={onClearHoverLoad}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={onSwapSectionOwnership}
																				selectedFacultySpecialization={member.specialization}
																				targetFacultyName={formatFacultyDisplayName(member)}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				completedSectionIds={completedSectionIds}
																			/>
																		))}
																	</div>
																</div>
															)}
														</div>
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
