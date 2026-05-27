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
import { cn } from '@/lib/utils';
import { getAssignmentOwnershipKey, matchesOwnershipDepartment, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import type { Subject, ExternalSection, FacultySummary, FacultyAssignmentDraft } from '@/types';

type SectionGridModeProps = {
	loading: boolean;
	subjects: Subject[];
	sectionsBySubject: Record<number, ExternalSection[]>;
	faculty: FacultySummary[];
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	onSetSections: (subjectId: number, sectionIds: number[], facultyId?: number) => void;
	onSelectTeacher: (id: number) => void;
	onHoverTeacher: (id: number) => void;
	onClearHover: () => void;
	saving: boolean;
	isReadOnlyMode: boolean;
	activeFacultyIds: Set<number>;
	sectionModeFilter: 'all' | 'unassigned' | 'constrained';
	onSectionModeFilterChange: (v: any) => void;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	selectedSectionId?: number | null;
	onSelectSection?: (id: number | null) => void;
	onSave?: () => void;
	hasDraft?: boolean;
	onSwapSectionOwnership?: (subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => void;
};

export function SectionGridMode({
	loading,
	subjects,
	sectionsBySubject,
	faculty,
	savedOwnershipMap,
	pendingOwnershipMap,
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
				const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
				const isStaffed = owner && activeFacultyIds.has(owner.facultyId);
				if (!isStaffed) unassigned++;
			}

			const matchesSearch = !searchQuery || (section.name.toLowerCase().includes(searchQuery.toLowerCase()) || section.programCode?.toLowerCase().includes(searchQuery.toLowerCase()));
			
			let shouldInclude = false;
			if (sectionModeFilter === 'all') shouldInclude = true;
			else if (sectionModeFilter === 'unassigned') shouldInclude = unassigned > 0;
			else if (sectionModeFilter === 'constrained') shouldInclude = section.isSpecialProgram;

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
	}, [subjects, sectionsBySubject, savedOwnershipMap, pendingOwnershipMap, activeFacultyIds, searchQuery, sectionModeFilter]);

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
		
		onSelectTeacher(facultyId);
		onSetSections(subjectId, newSectionIds, facultyId);
	};

	if (loading) {
		return (
			<div className="flex-1 p-6 space-y-4">
				{Array.from({ length: 10 }).map((_, i) => (
					<Skeleton key={i} className="h-14 w-full rounded-xl" />
				))}
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col min-h-0 bg-muted/5">
			<div className="shrink-0 p-6 border-b border-border/40 bg-background/50 backdrop-blur-sm space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-3 flex-1 min-w-0">
						<div className="relative flex-1 min-w-[200px] max-w-sm">
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input 
								placeholder="Search sections..." 
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10 h-10 bg-background shadow-sm border-border/60"
							/>
						</div>

						<Select value={sectionModeFilter} onValueChange={onSectionModeFilterChange}>
							<SelectTrigger className="w-[180px] h-10 bg-background shadow-sm border-border/60 text-xs font-bold uppercase tracking-tight">
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
							<span className="text-[0.65rem] font-black uppercase text-sky-700 tracking-widest mr-2">Pending Changes</span>
							<Button 
								size="sm" 
								onClick={onSave} 
								disabled={saving || isReadOnlyMode}
								className="h-8 px-4 text-xs font-black uppercase tracking-widest gap-2 bg-sky-600 hover:bg-sky-700 shadow-md ring-2 ring-sky-600/20"
							>
								<Save className="size-3.5" />
								{saving ? 'Saving...' : 'Save All'}
							</Button>
						</div>
					)}
				</div>
			</div>

			<div className="flex-1 overflow-auto p-6 space-y-2 no-scrollbar">
				{sectionRows.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-12 text-center bg-background border border-dashed border-border/60 rounded-2xl">
						<CheckCircle2 className="size-10 text-emerald-500/40 mb-4" />
						<h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/60">No sections require attention</h3>
						<p className="text-xs text-muted-foreground/40 mt-1">All sections match your current coverage contract.</p>
					</div>
				) : sectionRows.map((row) => {
					const isExpanded = selectedSectionId === row.section.id;
					
					return (
						<div 
							key={row.section.id}
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
										<h4 className="text-sm font-black uppercase tracking-tight truncate">
											{row.section.name}
										</h4>
										{row.section.isSpecialProgram && (
											<Badge variant="outline" className="h-4 px-1.5 text-[0.6rem] font-black uppercase bg-violet-50 text-violet-700 border-violet-100">
												{row.section.programCode}
											</Badge>
										)}
									</div>
									<p className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest truncate">
										Grade {row.section.displayOrder} • {row.totalCount} Subjects
									</p>
								</div>

								<div className="flex items-center gap-6 px-4">
									<div className="text-right min-w-[6rem]">
										<p className={cn(
											"text-xs font-black tabular-nums",
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
											const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
											const isStaffed = owner && activeFacultyIds.has(owner.facultyId);
											
											return (
												<div key={subject.id} className="space-y-3">
													<div className="flex items-center justify-between gap-3">
														<div className="flex items-center gap-2 min-w-0">
															<Badge variant="outline" className="h-5 px-1.5 text-[0.6rem] font-black uppercase border-border/60 text-muted-foreground shrink-0">
																{subject.code}
															</Badge>
															<span className="text-xs font-bold uppercase truncate">{subject.name}</span>
														</div>
														<div className="flex items-center gap-3 shrink-0">
															{isStaffed ? (
																<div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100">
																	<Check className="size-3 text-emerald-600" />
																	<span className="text-[0.65rem] font-black text-emerald-700 uppercase">{owner.facultyName}</span>
																</div>
															) : (
																<div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100">
																	<AlertTriangle className="size-3 text-amber-600" />
																	<span className="text-[0.65rem] font-black text-amber-700 uppercase">Unassigned</span>
																</div>
															)}
														</div>
													</div>

													<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
														{faculty
															.filter(f => !f.isPlaceholder && matchesOwnershipDepartment(f.department ?? null, subject))
															.map(f => {
																const isCurrentOwner = owner?.facultyId === f.id;
																const loadPct = Math.round(f.policyLoadPercentage ?? 0);
																return (
																	<button
																		key={f.id}
																		disabled={isCurrentOwner || saving || isReadOnlyMode}
																		onClick={() => handleAssign(subject.id, row.section.id, f.id, owner?.facultyId)}
																		onMouseEnter={() => onHoverTeacher(f.id)}
																		onMouseLeave={() => onClearHover()}
																		className={cn(
																			"flex items-center justify-between p-2 rounded-lg border transition-all text-left",
																			isCurrentOwner ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/10 shadow-sm" : "bg-background border-border/40 hover:border-primary/40 hover:shadow-sm"
																		)}
																	>
																		<div className="min-w-0">
																			<p className={cn("text-[0.65rem] font-black uppercase truncate", isCurrentOwner ? "text-emerald-900" : "text-foreground")}>
																				{f.lastName}, {f.firstName}
																			</p>
																			<p className={cn(
																				"text-[0.55rem] font-bold uppercase tracking-widest",
																				loadPct > 100 ? "text-rose-600" : loadPct > 80 ? "text-amber-600" : "text-emerald-600"
																			)}>
																				{loadPct}% Load
																			</p>
																		</div>
																		{isCurrentOwner ? <UserCheck className="size-3 text-emerald-600" /> : <UserPlus className="size-3 text-muted-foreground" />}
																	</button>
																);
															})}
													</div>
													<div className="h-px bg-border/20" />
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
