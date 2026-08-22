import { useMemo, useState, useEffect } from 'react';
import { 
	ChevronDown, 
	ChevronRight, 
	AlertTriangle, 
	Search, 
	Filter,
	Users,
	MoreHorizontal,
	RotateCcw,
	Star,
	LayoutGrid,
	ListFilter
} from 'lucide-react';
import { Button } from '@/ui/button';
import { departmentLabel } from '@/lib/deped-glossary';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { cn } from '@/lib/utils';
import { getFacultyComparableLoadHours, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import type { FacultySummary, FacultyAssignmentDraft, Subject, ExternalSection } from '@/types';
import { SubjectRow } from './SubjectRow';

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
	loadProfile: any;
	onHoverLoadMinutes: (minutes: number) => void;
	onClearHoverLoad: () => void;
	activeFacultyIds: Set<number>;
	resolveSectionHoverDeltaMinutes: (subject: Subject, sectionId: number) => number;
	splitBrainQuarantineRequired: boolean;
	splitBrainReasonLabel: string;
	onResetAssignments: () => void;
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	filterStatus: string;
	onFilterStatusChange: (s: any) => void;
	loadFilter: string;
	onLoadFilterChange: (s: any) => void;
	departmentFilter: string;
	onDepartmentFilterChange: (d: string) => void;
	departmentOptions: string[];
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
	splitBrainQuarantineRequired,
	splitBrainReasonLabel,
	onResetAssignments,
	searchQuery,
	onSearchQueryChange,
	filterStatus,
	onFilterStatusChange,
	loadFilter,
	onLoadFilterChange,
	departmentFilter,
	onDepartmentFilterChange,
	departmentOptions,
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
}: TeacherGridModeProps) {
	const [expandedId, setExpandedId] = useState<number | null>(selectedId);
	const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

	useEffect(() => {
		if (selectedId !== null) {
			setExpandedId(selectedId);
		}
	}, [selectedId]);

	const handleTeacherClick = (id: number) => {
		onSelectTeacher(id);
		setExpandedId(expandedId === id ? null : id);
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
			<div className="shrink-0 border-b border-border/40 bg-background/50 p-3 space-y-3 backdrop-blur-sm lg:p-4">
				{isReadOnlyMode && writeBlockedReason && (
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-amber-900">
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
				<div className="flex flex-wrap items-center gap-2">
					<div className="relative flex-1 min-w-50 max-w-sm">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input 
							placeholder="Search teachers..." 
							value={searchQuery}
							onChange={(e) => onSearchQueryChange(e.target.value)}
							className="pl-10 h-10 bg-background shadow-sm border-border/60"
						/>
					</div>

					<Select value={filterStatus} onValueChange={onFilterStatusChange}>
						<SelectTrigger className="w-40 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
							<div className="flex items-center gap-2">
								<ListFilter className="size-3.5 opacity-50" />
								<SelectValue placeholder="Status" />
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All Status</SelectItem>
							<SelectItem value="assigned" className="text-xs font-bold uppercase tracking-tight">Has Assignments</SelectItem>
							<SelectItem value="unassigned" className="text-xs font-bold uppercase tracking-tight">No Assignments</SelectItem>
						</SelectContent>
					</Select>

					<Button
						type="button"
						variant={showFilters ? 'secondary' : 'outline'}
						size="sm"
						className="h-10 shrink-0 gap-2 font-bold"
						onClick={onToggleFilters}
						aria-expanded={showFilters}
					>
						<Filter className="size-4" />
						More filters
					</Button>
				</div>

				{showFilters && (
					<div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/80 p-2 shadow-sm">
						<Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
							<SelectTrigger className="w-45 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
								<div className="flex items-center gap-2">
									<LayoutGrid className="size-3.5 opacity-50" />
									<SelectValue placeholder="Department" />
								</div>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All Departments</SelectItem>
								{departmentOptions.map(dept => (
									<SelectItem key={dept} value={dept} className="text-xs font-bold uppercase tracking-tight">{departmentLabel(dept)}</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Select value={loadFilter} onValueChange={onLoadFilterChange}>
							<SelectTrigger className="w-40 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
								<div className="flex items-center gap-2">
									<Star className="size-3.5 opacity-50" />
									<SelectValue placeholder="Load" />
								</div>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All Loads</SelectItem>
								<SelectItem value="overloaded" className="text-xs font-bold uppercase tracking-tight text-amber-700">Overload ({">"}30h)</SelectItem>
								<SelectItem value="optimal" className="text-xs font-bold uppercase tracking-tight text-emerald-700">Optimal (25-30h)</SelectItem>
								<SelectItem value="underloaded" className="text-xs font-bold uppercase tracking-tight text-sky-700">Underload ({"<"}25h)</SelectItem>
							</SelectContent>
						</Select>

						<Select value={sortOrder} onValueChange={onSortOrderChange}>
							<SelectTrigger className="w-44 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
								<SelectValue placeholder="Sort teachers" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="load-desc" className="text-xs font-bold uppercase tracking-tight">Highest load</SelectItem>
								<SelectItem value="load-asc" className="text-xs font-bold uppercase tracking-tight">Lowest load</SelectItem>
							</SelectContent>
						</Select>

						<div className="flex flex-wrap items-center gap-4 border-l border-border/40 pl-4 h-10">
						<div className="flex items-center gap-2">
							<Switch 
								id="show-outside-dept" 
								checked={showOutsideDept} 
								onCheckedChange={onToggleOutsideDept} 
							/>
							<Label htmlFor="show-outside-dept" className="text-xs font-semibold uppercase tracking-widest cursor-pointer text-muted-foreground whitespace-nowrap">
								Cross-Dept
							</Label>
						</div>
						
						<div className="flex items-center gap-2 border-l border-border/40 pl-4 h-10">
							<Switch 
								id="show-unmapped-specialization" 
								checked={showUnmappedSpecialization} 
								onCheckedChange={onShowUnmappedSpecializationChange} 
							/>
							<Label htmlFor="show-unmapped-specialization" className="text-xs font-semibold uppercase tracking-widest cursor-pointer text-muted-foreground whitespace-nowrap">
								Unmapped Specialization
							</Label>
						</div>
					</div>
					</div>
				)}
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
									<h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{dept === 'UNSTAFFED TEMPORARY ROLES' || dept === 'UNASSIGNED DEPARTMENT' ? dept : departmentLabel(dept)}</h3>
								</div>
								<div className="flex-1 h-px bg-border/30" />
								<Badge variant="outline" className="text-[10px] font-bold bg-muted/30 text-muted-foreground shadow-none">{members.length}</Badge>
							</div>
							
							{!isCollapsed && (
								<div className="space-y-2">
									{members.map((member) => {
										const isSelected = selectedId === member.id;
										const isExpanded = expandedId === member.id;
										const hasDraft = Boolean(effectiveDraftAssignmentsByFaculty[member.id]);
										const displayHours = getFacultyComparableLoadHours(member);
										const loadPercentage = member.isPlaceholder ? 0 : Math.round(member.policyLoadPercentage ?? 0);
										
										const subjectsCount = effectiveAssignmentsByFaculty[member.id]?.length || 0;
										const sectionsCount = effectiveAssignmentsByFaculty[member.id]?.reduce((acc, a) => acc + a.sectionIds.length, 0) || 0;

										return (
											<div 
												key={member.id} 
												className={cn(
													"rounded-xl border transition-all duration-200",
													isSelected ? "bg-background border-primary/30 shadow-md ring-1 ring-primary/5" : "bg-background border-border/40 hover:border-primary/20 hover:shadow-sm"
												)}
											>
												{/* Phase 4.6: teacher row expand is keyboard-operable. */}
												<div
													role="button"
													tabIndex={0}
													aria-expanded={isExpanded}
													aria-label={`${member.lastName}, ${member.firstName}${isExpanded ? ' - expanded' : ' - collapsed'}`}
													onKeyDown={(event) => {
														if (event.key === 'Enter' || event.key === ' ') {
															event.preventDefault();
															handleTeacherClick(member.id);
														}
													}}
													className={cn(
														"flex items-center gap-4 p-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
														isExpanded && "border-b border-border/40"
													)}
													onClick={() => handleTeacherClick(member.id)}
												>
													<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/10">
														{member.firstName?.[0] ?? ''}{member.lastName?.[0] ?? ''}
													</div>
													
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<h4 className="text-sm font-semibold uppercase tracking-tight truncate">
																{member.lastName}, {member.firstName}
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
															{departmentLabel(member.department)}
														</p>
													</div>

													{/* Load Signals */}
													<div className="flex items-center gap-6 px-4">
														<div className="text-right">
															<p className={cn(
																"text-xs font-semibold tabular-nums",
																displayHours > 40 ? "text-rose-600" : displayHours > 30 ? "text-amber-600" : "text-emerald-600"
															)}>
																{member.isPlaceholder ? `${displayHours.toFixed(1)}h` : `${loadPercentage}%`}
															</p>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Load Status</p>
														</div>
														<div className="text-right min-w-14">
															<p className="text-xs font-semibold tabular-nums">{subjectsCount}</p>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Subjects</p>
														</div>
														<div className="text-right min-w-14">
															<p className="text-xs font-semibold tabular-nums">{sectionsCount}</p>
															<p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Sections</p>
														</div>
													</div>

													<div className="flex items-center gap-2 border-l border-border/40 pl-4">
														{isExpanded ? <ChevronDown className="size-5 text-muted-foreground" /> : <ChevronRight className="size-5 text-muted-foreground" />}
													</div>
												</div>

												{/* Expanded Content */}
												{isExpanded && (
													<div className="p-3 bg-muted/5 space-y-4">
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
																				remainingCapacityMinutes={loadProfile.remainingHours * 60}
																				onHoverLoadMinutes={onHoverLoadMinutes}
																				onClearHoverLoad={onClearHoverLoad}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={onSwapSectionOwnership}
																				selectedFacultySpecialization={member.specialization}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				quarantined={splitBrainQuarantineRequired}
																				quarantineLabel={splitBrainReasonLabel}
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
																				remainingCapacityMinutes={loadProfile.remainingHours * 60}
																				onHoverLoadMinutes={onHoverLoadMinutes}
																				onClearHoverLoad={onClearHoverLoad}
																				activeFacultyIds={activeFacultyIds}
																				onSwapSectionOwnership={onSwapSectionOwnership}
																				selectedFacultySpecialization={member.specialization}
																				resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
																				quarantined={splitBrainQuarantineRequired}
																				quarantineLabel={splitBrainReasonLabel}
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
