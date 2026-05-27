import { useMemo, useState, useEffect } from 'react';
import { 
	ChevronDown, 
	ChevronRight, 
	AlertTriangle, 
	CheckCircle2, 
	Search, 
	Filter,
	Users,
	UserPlus,
	Save,
	RotateCcw,
	Undo2,
	Redo2,
	LayoutGrid,
	ListFilter
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { Label } from '@/ui/label';
import { cn } from '@/lib/utils';
import { getFacultyComparableLoadHours } from '@/lib/faculty-assignment-helpers';
import type { FacultySummary, FacultyAssignmentDraft, Subject, ExternalSection, FacultyOwnershipState } from '@/types';
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
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
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
	onSave: () => void;
	onResetAssignments: () => void;
	onDiscardDraft: () => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	filterStatus: string;
	onFilterStatusChange: (s: any) => void;
	departmentFilter: string;
	onDepartmentFilterChange: (d: string) => void;
	departmentOptions: string[];
	sortOrder: string;
	onSortOrderChange: (o: any) => void;
	showFilters: boolean;
	onToggleFilters: () => void;
	showOutsideDept: boolean;
	onToggleOutsideDept: (s: boolean) => void;
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
	savedOwnershipMap,
	pendingOwnershipMap,
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
	onSave,
	onResetAssignments,
	onDiscardDraft,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	searchQuery,
	onSearchQueryChange,
	filterStatus,
	onFilterStatusChange,
	departmentFilter,
	onDepartmentFilterChange,
	departmentOptions,
	sortOrder,
	onSortOrderChange,
	showFilters,
	onToggleFilters,
	showOutsideDept,
	onToggleOutsideDept,
}: TeacherGridModeProps) {
	const [expandedId, setExpandedId] = useState<number | null>(selectedId);

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
				{Array.from({ length: 8 }).map((_, i) => (
					<Skeleton key={i} className="h-16 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-muted/5">
			{/* Familiar Discovery Controls */}
			<div className="shrink-0 p-6 border-b border-border/40 bg-background/50 backdrop-blur-sm space-y-4">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative flex-1 min-w-[200px] max-w-sm">
						<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input 
							placeholder="Search teachers..." 
							value={searchQuery}
							onChange={(e) => onSearchQueryChange(e.target.value)}
							className="pl-10 h-10 bg-background shadow-sm border-border/60"
						/>
					</div>
					
					<Select value={departmentFilter} onValueChange={onDepartmentFilterChange}>
						<SelectTrigger className="w-[180px] h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
							<div className="flex items-center gap-2">
								<LayoutGrid className="size-3.5 opacity-50" />
								<SelectValue placeholder="Department" />
							</div>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All Departments</SelectItem>
							{departmentOptions.map(dept => (
								<SelectItem key={dept} value={dept} className="text-xs font-bold uppercase tracking-tight">{dept}</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={filterStatus} onValueChange={onFilterStatusChange}>
						<SelectTrigger className="w-[160px] h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
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

					<div className="flex items-center gap-4 border-l border-border/40 pl-4 h-10">
						<div className="flex items-center gap-2">
							<Switch 
								id="show-outside-dept" 
								checked={showOutsideDept} 
								onCheckedChange={onToggleOutsideDept} 
							/>
							<Label htmlFor="show-outside-dept" className="text-[0.65rem] font-black uppercase tracking-widest cursor-pointer text-muted-foreground">
								Cross-Dept
							</Label>
						</div>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto p-6 space-y-4 no-scrollbar">
				{groupedFaculty.map(([dept, members]) => (
					<div key={dept} className="space-y-2">
						<div className="flex items-center gap-3 px-2">
							<h3 className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{dept}</h3>
							<div className="flex-1 h-px bg-border/40" />
						</div>
						
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
										{/* Row Header */}
										<div 
											className={cn(
												"flex items-center gap-4 p-3 cursor-pointer select-none",
												isExpanded && "border-b border-border/40"
											)}
											onClick={() => handleTeacherClick(member.id)}
										>
											<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary border border-primary/10">
												{member.firstName[0]}{member.lastName[0]}
											</div>
											
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<h4 className="text-sm font-black uppercase tracking-tight truncate">
														{member.lastName}, {member.firstName}
													</h4>
													{hasDraft && <Badge variant="secondary" className="h-4 px-1.5 text-[0.6rem] font-black uppercase bg-sky-100 text-sky-700 animate-pulse">Draft</Badge>}
												</div>
												<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest truncate">
													{member.specialization || 'General'}
												</p>
											</div>

											{/* Load Signals */}
											<div className="flex items-center gap-6 px-4">
												<div className="text-right">
													<p className={cn(
														"text-xs font-black tabular-nums",
														displayHours > 40 ? "text-rose-600" : displayHours > 30 ? "text-amber-600" : "text-emerald-600"
													)}>
														{member.isPlaceholder ? `${displayHours.toFixed(1)}h` : `${loadPercentage}%`}
													</p>
													<p className="text-[0.55rem] font-bold text-muted-foreground uppercase tracking-tighter">Load Status</p>
												</div>
												<div className="text-right min-w-[3rem]">
													<p className="text-xs font-black tabular-nums">{subjectsCount}</p>
													<p className="text-[0.55rem] font-bold text-muted-foreground uppercase tracking-tighter">Subjects</p>
												</div>
												<div className="text-right min-w-[3rem]">
													<p className="text-xs font-black tabular-nums">{sectionsCount}</p>
													<p className="text-[0.55rem] font-bold text-muted-foreground uppercase tracking-tighter">Sections</p>
												</div>
											</div>

											<div className="flex items-center gap-2 border-l border-border/40 pl-4">
												{isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
											</div>
										</div>

										{/* Expanded Content */}
										{isExpanded && (
											<div className="p-3 bg-muted/5 space-y-4">
												{/* Actions Bar (Sticky) */}
												<div className="sticky top-0 z-20 flex items-center justify-between gap-0 bg-background/95 backdrop-blur-sm p-2 rounded-lg border border-border/40 shadow-sm mb-2">
													<div className="flex items-center gap-2">
														<div className="flex items-center bg-muted/20 rounded-md p-0.5 border border-border/40">
															<Button size="icon-xs" variant="ghost" className="h-6 w-7" onClick={onUndo} disabled={!canUndo || saving || isReadOnlyMode}><Undo2 className="size-3" /></Button>
															<Button size="icon-xs" variant="ghost" className="h-6 w-7" onClick={onRedo} disabled={!canRedo || saving || isReadOnlyMode}><Redo2 className="size-3" /></Button>
														</div>
														<Button 
															size="xs" 
															variant="outline" 
															className="h-6 text-[0.6rem] font-black uppercase tracking-widest gap-1.5"
															onClick={onResetAssignments}
															disabled={saving || isReadOnlyMode}
														>
															<RotateCcw className="size-3" />
															Reset
														</Button>
													</div>

													<div className="flex items-center gap-2">
														{hasDraft && (
															<Button 
																size="xs" 
																variant="ghost" 
																className="h-6 text-[0.6rem] font-black uppercase tracking-widest text-amber-600 hover:text-amber-700 hover:bg-amber-50"
																onClick={onDiscardDraft}
															>
																Discard
															</Button>
														)}
														<Button 
															size="xs" 
															className="h-6 text-[0.6rem] font-black uppercase tracking-widest gap-1.5 px-3"
															onClick={onSave}
															disabled={!hasDraft || saving || isReadOnlyMode}
														>
															<Save className="size-3" />
															{saving ? 'Saving...' : 'Save Draft'}
														</Button>
													</div>
												</div>

												{/* Subjects Section */}
												<div className="space-y-4">
													{departmentQualifiedSubjects.length > 0 && (
														<div className="space-y-3">
															<div className="flex items-center gap-3">
																<span className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-emerald-600/70">Qualified Subjects</span>
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
																		savedOwnershipMap={savedOwnershipMap}
																		pendingOwnershipMap={pendingOwnershipMap}
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
																	/>
																))}
															</div>
														</div>
													)}

													{showOutsideDept && outsideDepartmentSubjects.length > 0 && (
														<div className="space-y-3">
															<div className="flex items-center gap-3">
																<span className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Cross-Department</span>
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
																		savedOwnershipMap={savedOwnershipMap}
																		pendingOwnershipMap={pendingOwnershipMap}
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
					</div>
				))}
			</div>
		</div>
	);
}
