import { useMemo, useState } from 'react';
import { 
	ChevronDown, 
	ChevronRight, 
	AlertTriangle, 
	CheckCircle2, 
	Search, 
	Filter,
	BookOpen,
	Clock,
	Users,
	UserPlus,
	RotateCcw,
	Save,
	X,
	Check,
	UserCheck,
	LayoutGrid,
	ListFilter
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/ui/popover';
import { cn } from '@/lib/utils';
import { getAssignmentOwnershipKey, matchesOwnershipDepartment, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import type { Subject, ExternalSection, FacultySummary, FacultyAssignmentDraft } from '@/types';

export type SectionGridModeProps = {
	loading: boolean;
	subjects: Subject[];
	sectionsBySubject: Record<number, ExternalSection[]>;
	faculty: FacultySummary[];
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	effectiveOwnershipMap: Record<string, FacultyOwnershipState & { isPending: boolean }>;
	onSetSections: (subjectId: number, sectionIds: number[], facultyId?: number) => void;
	onSelectTeacher: (id: number) => void;
	onHoverTeacher: (id: number | null) => void;
	onClearHover: () => void;
	saving: boolean;
	isReadOnlyMode: boolean;
	activeFacultyIds: Set<number>;
	sectionModeFilter: string;
	onSectionModeFilterChange: (v: 'all' | 'unassigned' | 'constrained') => void;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	selectedSectionId: number | null;
	onSelectSection: (id: number | null) => void;
	onSave: () => void;
	hasDraft: boolean;
	onSwapSectionOwnership?: (subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => void;
	workspaceStateLabel: string;
	workspaceStateNextAction: string;
	writeBlockedReason: string | null;
	completedSectionIds?: Set<number>;
};


export function SectionGridMode({
	loading,
	subjects,
	sectionsBySubject,
	faculty,
	savedOwnershipMap,
	pendingOwnershipMap,
	effectiveOwnershipMap,
	onSetSections,
	onSelectTeacher,
	onHoverTeacher,
	onClearHover,
	saving,
	isReadOnlyMode,
	activeFacultyIds,
	sectionModeFilter,
	onSectionModeFilterChange,
	effectiveAssignmentsByFaculty,
	selectedSectionId,
	onSelectSection,
	onSave,
	hasDraft,
	onSwapSectionOwnership,
	workspaceStateLabel,
	workspaceStateNextAction,
	writeBlockedReason,
	completedSectionIds = new Set(),
}: SectionGridModeProps) {
	const [searchQuery, setSearchQuery] = useState('');

	const sectionRows = useMemo(() => {
		// Identify unique sections from sectionsBySubject
		const uniqueSections = Array.from(new Map(Object.values(sectionsBySubject).flat().map((section) => [section.id, section])).values());

		const rows: Array<{ 
			section: ExternalSection; 
			subjects: Subject[]; 
			unassignedCount: number; 
			totalCount: number;
			isCompleted: boolean;
		}> = [];

		for (const section of uniqueSections) {
			const sectionSubjects = subjects.filter((subject) =>
				(sectionsBySubject[subject.id] ?? []).some((candidateSection) => candidateSection.id === section.id),
			);

			if (sectionSubjects.length === 0) continue;

			let unassigned = 0;
			for (const sub of sectionSubjects) {
				const key = getAssignmentOwnershipKey(sub.id, section.id);
				const owner = effectiveOwnershipMap[key];
				const isStaffed = owner && activeFacultyIds.has(owner.facultyId);
				if (!isStaffed) unassigned++;
			}

			const matchesSearch = !searchQuery || (section.name.toLowerCase().includes(searchQuery.toLowerCase()) || section.programCode?.toLowerCase().includes(searchQuery.toLowerCase()));
			
			let shouldInclude = false;
			if (sectionModeFilter === 'all') shouldInclude = true;
			else if (sectionModeFilter === 'unassigned') shouldInclude = unassigned > 0;
			else if (sectionModeFilter === 'constrained') shouldInclude = section.isSpecialProgram === true;

			if (shouldInclude && matchesSearch) {
				rows.push({
					section,
					subjects: sectionSubjects,
					unassignedCount: unassigned,
					totalCount: sectionSubjects.length,
					isCompleted: unassigned === 0
				});
			}
		}

		return rows.sort((a, b) => {
			if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
			return a.section.displayOrder - b.section.displayOrder || a.section.name.localeCompare(b.section.name);
		});
	}, [subjects, sectionsBySubject, effectiveOwnershipMap, activeFacultyIds, searchQuery, sectionModeFilter]);

	const handleRowClick = (id: number) => {
		onSelectSection?.(selectedSectionId === id ? null : id);
	};

	const handleAssign = (subjectId: number, sectionId: number, facultyId: number, currentOwnerId?: number) => {
		if (isReadOnlyMode || saving) return;
		
		if (currentOwnerId && currentOwnerId !== facultyId) {
			onSwapSectionOwnership?.(subjectId, sectionId, currentOwnerId, facultyId);
			return;
		}

		const teacherAssignments = effectiveAssignmentsByFaculty[facultyId] ?? [];
		const existingSubjectAssignment = teacherAssignments.find(a => a.subjectId === subjectId);
		
		let newSectionIds: number[] = [];
		if (existingSubjectAssignment) {
			newSectionIds = Array.from(new Set([...existingSubjectAssignment.sectionIds, sectionId]));
		} else {
			newSectionIds = [sectionId];
		}
		
		// Intentionally do NOT call onSelectTeacher here — doing so bleeds into Teacher Grid mode selection
		onSetSections(subjectId, newSectionIds, facultyId);
	};

	if (loading) {
		return (
			<div className="flex-1 p-6 space-y-4">
				<div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
					<p className="text-sm font-semibold text-blue-900">Checking section coverage.</p>
					<p className="mt-1 text-xs font-medium text-blue-700">ATLAS is loading subject-section needs and saved teacher ownership.</p>
				</div>
				{Array.from({ length: 10 }).map((_, i) => (
					<Skeleton key={i} className="h-14 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-muted/5">
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
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<div className="relative flex-1 min-w-50 max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input 
								placeholder="Search sections..." 
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10 h-10 bg-background shadow-sm border-border/60"
							/>
						</div>

						<Select value={sectionModeFilter} onValueChange={onSectionModeFilterChange}>
							<SelectTrigger className="w-45 h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
								<div className="flex items-center gap-2">
									<ListFilter className="size-3.5 opacity-50" />
									<SelectValue placeholder="Filter View" />
								</div>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="text-xs font-bold uppercase tracking-tight">All Sections</SelectItem>
								<SelectItem value="unassigned" className="text-xs font-bold uppercase tracking-tight">Needs Staffing</SelectItem>
								<SelectItem value="constrained" className="text-xs font-bold uppercase tracking-tight">Special Programs</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{hasDraft && (
						<div className="flex items-center gap-2 bg-sky-50 border border-sky-200 px-3 py-1 rounded-xl shadow-sm animate-in fade-in slide-in-from-right-2">
							<span className="text-[0.65rem] font-semibold uppercase text-sky-700 tracking-widest mr-2">Pending Changes</span>
							<Button 
								size="sm" 
								onClick={onSave} 
								disabled={saving || isReadOnlyMode}
								className="h-8 px-4 text-xs font-semibold uppercase tracking-widest gap-2 bg-sky-600 hover:bg-sky-700 shadow-md ring-2 ring-sky-600/20"
							>
								<Save className="size-3.5" />
								{saving ? 'Saving...' : 'Save All'}
							</Button>
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-auto p-3 space-y-2 no-scrollbar lg:p-4">
				{Object.keys(sectionsBySubject).length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center bg-background border border-dashed border-border/60 rounded-2xl">
						<BookOpen className="size-10 text-muted-foreground/40 mb-4" />
						<h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/70">No section assignment needs loaded</h3>
						<p className="text-sm text-muted-foreground mt-2 max-w-md">Refresh the source after sections and subjects are available. Coverage cannot be counted until ATLAS has subject-section pairs.</p>
					</div>
				) : sectionRows.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center bg-background border border-dashed border-border/60 rounded-2xl">
						<CheckCircle2 className="size-10 text-emerald-500/40 mb-4" />
						<h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">No sections require attention</h3>
						<p className="text-xs text-muted-foreground/40 mt-1">All visible sections match this filter. Switch to all sections if you need to review completed coverage.</p>
					</div>
				) : sectionRows.map((row) => {
					const isExpanded = selectedSectionId === row.section.id;
					
					return (
						<div 
							key={row.section.id}
							data-section-id={row.section.id}
							data-testid="teaching-load-section-row"
							className={cn(
								"rounded-xl border transition-all duration-200 overflow-hidden",
								isExpanded ? "bg-background border-primary/30 shadow-md ring-1 ring-primary/5" : "bg-background border-border/40 hover:border-primary/20 hover:shadow-sm",
								row.isCompleted && !isExpanded && "opacity-75"
							)}
						>
							<div 
								className="flex items-center gap-4 p-3 cursor-pointer select-none"
								onClick={() => handleRowClick(row.section.id)}
							>
								<div className={cn(
									"flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm",
									row.isCompleted ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
								)}>
									{row.isCompleted ? <CheckCircle2 className="size-6" /> : <Users className="size-6" />}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className={cn("size-2 rounded-full shrink-0", completedSectionIds.has(row.section.id) ? "bg-emerald-500" : "bg-amber-400")} />
										<h4 className="text-sm font-semibold uppercase tracking-tight truncate">
											{row.section.name}
										</h4>
										{row.section.isSpecialProgram && (
											<Badge variant="outline" className="h-4 px-1.5 text-[0.6rem] font-semibold uppercase bg-violet-50 text-violet-700 border-violet-100">
												{row.section.programCode}
											</Badge>
										)}
									</div>
									<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest truncate">
										Grade {row.section.displayOrder} • {row.totalCount} Subjects
									</p>
								</div>

								<div className="flex items-center gap-6 px-4">
									<div className="text-right min-w-24">
										<p className={cn(
											"text-xs font-semibold tabular-nums",
											row.isCompleted ? "text-emerald-600" : "text-amber-600"
										)}>
											{row.totalCount - row.unassignedCount} / {row.totalCount}
										</p>
										<p className="text-[0.55rem] font-bold text-muted-foreground uppercase tracking-tighter">Staffed</p>
									</div>
								</div>

								<div className="flex items-center gap-2 border-l border-border/40 pl-4">
									{isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
								</div>
							</div>

							{isExpanded && (
								<div className="p-4 bg-muted/5 border-t border-border/40">
									<div className="space-y-4">
										{row.subjects.map(subject => {
											const key = getAssignmentOwnershipKey(subject.id, row.section.id);
											const owner = effectiveOwnershipMap[key];
											const isStaffed = owner && activeFacultyIds.has(owner.facultyId);
											
											const candidates = faculty
												.filter(f => matchesOwnershipDepartment(f.department, subject))
												.sort((a, b) => a.lastName.localeCompare(b.lastName));

											return (
												<div
													key={subject.id}
													data-section-id={row.section.id}
													data-subject-id={subject.id}
													data-testid="teaching-load-section-subject-row"
													className="space-y-3 p-4 rounded-xl border border-border/40 bg-background/50"
												>
													<div className="flex items-center justify-between gap-3">
														<div className="flex items-center gap-3 min-w-0">
															<Badge variant="outline" className="h-6 px-2 text-xs font-semibold uppercase border-primary/20 bg-primary/5 text-primary shrink-0">
																{subject.code}
															</Badge>
															<span className="text-sm font-semibold uppercase truncate">{subject.name}</span>
														</div>
														<div className="flex items-center gap-3 shrink-0">
															{isStaffed ? (
																<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm animate-in fade-in duration-300">
																	<UserCheck className="size-4 text-emerald-600" />
																	<div className="flex flex-col">
																		<span className="text-xs font-semibold text-emerald-900 uppercase leading-none mb-0.5">{owner.facultyName}</span>
																		<span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter leading-none">{owner.isPending ? 'Pending Assignment' : 'Current Owner'}</span>
																	</div>
																</div>
															) : (
																<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 shadow-sm animate-in fade-in duration-300">
																	<AlertTriangle className="size-4 text-amber-600" />
																	<span className="text-xs font-semibold text-amber-700 uppercase">Unassigned</span>
																</div>
															)}

															<Popover>
																<PopoverTrigger asChild>
																	<Button 
																		variant="outline" 
																		size="sm" 
																		className="h-9 gap-2 font-semibold uppercase tracking-widest text-xs border-primary/30 hover:border-primary hover:bg-primary/5 shadow-sm"
																		disabled={saving || isReadOnlyMode}
																		data-testid="teaching-load-owner-picker-trigger"
																	>
																		{isStaffed ? 'Change owner' : 'Set owner'}
																		<ChevronDown className="size-4 opacity-50" />
																	</Button>
																</PopoverTrigger>
																<PopoverContent align="end" className="w-80 p-0 overflow-hidden rounded-xl shadow-2xl border-primary/20">
																	<div className="p-3 border-b border-border/40 bg-muted/20">
																		<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Eligible Teaching Load owners</p>
																		<p className="text-xs font-bold text-foreground truncate">{subject.name}</p>
																	</div>
																	<div className="max-h-75 overflow-auto no-scrollbar p-1">
																		{candidates.length === 0 ? (
																			<p className="p-4 text-center text-xs font-bold text-muted-foreground italic uppercase">No qualified owners found</p>
																		) : candidates.map(f => {
																			const isCurrentOwner = owner?.facultyId === f.id;
																			const loadPct = Math.round(f.policyLoadPercentage ?? 0);
																			const hasDraftChanges = (effectiveAssignmentsByFaculty[f.id]?.length ?? 0) > 0;
																			return (
																				<PopoverClose asChild key={f.id}>
																					<Button
																						variant="ghost"
																						disabled={isCurrentOwner}
																						data-faculty-id={f.id}
																						data-testid="teaching-load-owner-option"
																						onClick={() => handleAssign(subject.id, row.section.id, f.id, owner?.facultyId)}
																						className={cn(
																							"w-full flex items-center justify-between p-3 h-auto hover:bg-primary/5 transition-all text-left border-b border-border/10 last:border-0",
																							isCurrentOwner && "bg-emerald-50/50"
																						)}
																					>
																						<div className="min-w-0">
																							<p className={cn("text-xs font-semibold uppercase truncate", isCurrentOwner ? "text-emerald-900" : "text-foreground")}>
																								{f.lastName}, {f.firstName}
																							</p>
																							<div className="flex items-center gap-2 mt-0.5">
																								<span className={cn(
																									"text-[10px] font-bold uppercase tracking-tighter",
																									loadPct > 100 ? "text-rose-600" : loadPct > 80 ? "text-amber-600" : "text-emerald-600"
																								)}>
																									{loadPct}% Load{hasDraftChanges ? ' *' : ''}
																								</span>
																								<span className="text-muted-foreground/30">•</span>
																								<span className="text-[10px] font-bold text-muted-foreground uppercase truncate">
																									{f.department || 'No Dept'}
																								</span>
																							</div>
																						</div>
																						{isCurrentOwner ? <UserCheck className="size-4 text-emerald-600" /> : <UserPlus className="size-4 text-primary/40 group-hover:text-primary transition-colors" />}
																					</Button>
																				</PopoverClose>
																			);
																		})}
																	{candidates.some(f => (effectiveAssignmentsByFaculty[f.id]?.length ?? 0) > 0) && (
																		<p className="px-3 py-1.5 text-[10px] font-semibold text-amber-700 italic border-t border-border/20">* Load% may be higher — draft changes are pending save.</p>
																	)}
																	</div>
																</PopoverContent>
															</Popover>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
