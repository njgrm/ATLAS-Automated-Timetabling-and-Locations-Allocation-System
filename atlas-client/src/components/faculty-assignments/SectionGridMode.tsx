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
	X,
	Check,
	UserCheck,
	LayoutGrid,
} from 'lucide-react';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input } from '@/ui/input';
import { Skeleton } from '@/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { FilterPicker } from '@/ui/filter-picker';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/ui/popover';
import { cn } from '@/lib/utils';
import { getAssignmentOwnershipKey, ownershipDepartmentEligibility, selectEligibleOwnerCandidates, teachingUtilizationPercentFor, resolveTeachingActualHours, type FacultyOwnershipState } from '@/lib/faculty-assignment-helpers';
import { PLACEHOLDER_TRUTH_LABEL } from '@/components/faculty-assignments/teachingLoadOutage';
import type { Subject, ExternalSection, FacultySummary, FacultyAssignmentDraft } from '@/types';

export type SectionGridModeProps = {
	loading: boolean;
	subjects: Subject[];
	sectionsBySubject: Record<number, ExternalSection[]>;
	faculty: FacultySummary[];
	effectiveOwnershipMap: Record<string, FacultyOwnershipState & { isPending: boolean }>;
	/**
	 * A6 c7 §1.3 — the SAVED ownership index, so a draft assignment can be put
	 * back exactly where it was. The page already holds this map; the grid had no
	 * copy of it, and it needs no new ownership state of its own.
	 */
	savedOwnershipMap?: Record<string, FacultyOwnershipState>;
	onSetSections: (subjectId: number, sectionIds: number[], facultyId?: number) => void;
	saving: boolean;
	isReadOnlyMode: boolean;
	activeFacultyIds: Set<number>;
	sectionModeFilter: string;
	onSectionModeFilterChange: (v: 'all' | 'unassigned' | 'constrained') => void;
	effectiveAssignmentsByFaculty: Record<number, FacultyAssignmentDraft[]>;
	selectedSectionId: number | null;
	onSelectSection: (id: number | null) => void;
	onSwapSectionOwnership?: (subjectId: number, sectionId: number, fromFacultyId: number, toFacultyId?: number) => void;
	workspaceStateLabel: string;
	workspaceStateNextAction: string;
	writeBlockedReason: string | null;
	completedSectionIds?: Set<number>;
	/** Explicit effective teaching standard (hours). Null when UNCONFIGURED. */
	teachingStandardHours: number | null;
};


export function SectionGridMode({
	loading,
	subjects,
	sectionsBySubject,
	faculty,
	effectiveOwnershipMap,
	savedOwnershipMap = {},
	onSetSections,
	saving,
	isReadOnlyMode,
	activeFacultyIds,
	sectionModeFilter,
	onSectionModeFilterChange,
	effectiveAssignmentsByFaculty,
	selectedSectionId,
	onSelectSection,
	onSwapSectionOwnership,
	workspaceStateLabel,
	workspaceStateNextAction,
	writeBlockedReason,
	completedSectionIds = new Set(),
	teachingStandardHours,
}: SectionGridModeProps) {
	const [searchQuery, setSearchQuery] = useState('');

	/*
	 * A6 C2 (Slice 4, Major 5) — the filter's own name, in ONE place.
	 *
	 * The `Select` options and the empty-state message below read the SAME map,
	 * so "Needs staffing is active" and the message that says which filter is
	 * active cannot drift into two vocabularies. Sentence case throughout: the
	 * operator's complaint was a message that shouted `NO SECTIONS REQUIRE
	 * ATTENTION` while diagnosing the wrong thing.
	 */
	const SECTION_MODE_FILTER_LABELS: Record<string, string> = {
		all: 'All sections',
		unassigned: 'Needs staffing',
		constrained: 'Special programs',
	};
	const activeFilterLabels = SECTION_MODE_FILTER_LABELS;	const activeFilterLabel = SECTION_MODE_FILTER_LABELS[sectionModeFilter] ?? 'this filter';
	const trimmedQuery = searchQuery.trim();

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
		
		// Intentionally does not select the teacher in the grid — doing so would
		// bleed a section-mode assignment into Teacher Grid mode selection.
		onSetSections(subjectId, newSectionIds, facultyId);
	};

	/**
	 * A6 c7 §1.3 — PUT ONE DRAFT ASSIGNMENT BACK WHERE IT WAS.
	 *
	 * Lane C's walk (report.md MINOR line 25) assigned MAPEH in Aguinaldo, watched
	 * the row read `Draft - not saved` and the section leave the filtered list,
	 * and found no way back short of leaving the page. So the draft, not the saved
	 * value, is what this restores — which is also the only honest reading of the
	 * word: a SAVED change is CHANGED, not undone, and the control is therefore
	 * only offered while the change is still a draft.
	 *
	 * It reuses the two paths the grid already has and invents no ownership state:
	 * a class that HAD an owner goes back through `onSwapSectionOwnership`, the
	 * exact-pair transfer the assign itself used; a class that had NONE is
	 * released through `onSetSections` with an empty list, the same detach the
	 * grid uses everywhere else. Nothing here reads a teacher list, computes an
	 * eligibility, or owns a draft of its own.
	 */
	const handleUndoDraftOwner = (subjectId: number, sectionId: number, draftOwnerId: number) => {
		const savedOwnerId = savedOwnershipMap[getAssignmentOwnershipKey(subjectId, sectionId)]?.facultyId;
		if (savedOwnerId != null && savedOwnerId !== draftOwnerId) {
			onSwapSectionOwnership?.(subjectId, sectionId, draftOwnerId, savedOwnerId);
			return;
		}
		if (savedOwnerId == null) {
			onSetSections(subjectId, [], draftOwnerId);
			return;
		}
		// The draft names the teacher the saved map already names: there is nothing
		// to move, and inventing a change here would be the control lying twice.
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

					{/* A5 C3 slice B / B2 + B4: this was `w-45 h-10 … uppercase
					    tracking-tight` with a `` glyph inside the trigger — the one
					    control on this screen that looked like nothing else in the product.
					    It is now the shared `@/ui` picker, with `activeFilterLabels` verbatim
					    and the page's own words intact. The glyph goes because the shared
					    trigger carries its own chevron; three different icons in sibling
					    triggers is how a row stops reading as one instrument. */}
					<FilterPicker
						name="Filter"
						ariaLabel="Filter section view"
						value={sectionModeFilter}
						onValueChange={(v) => onSectionModeFilterChange(v as 'all' | 'unassigned' | 'constrained')}
						options={[
							{ value: 'all', label: activeFilterLabels.all },
							{ value: 'unassigned', label: activeFilterLabels.unassigned },
							{ value: 'constrained', label: activeFilterLabels.constrained },
						]}
					/>
					</div>

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
					/*
					 * A6 C2 (Slice 4) — THREE causes, three messages.
					 *
					 * Lane C searched `zzzzzz` and was told `NO SECTIONS REQUIRE
					 * ATTENTION` / `All visible sections match this filter`: a
					 * STAFFING diagnosis for a SEARCH result, which sends a
					 * scheduler down the wrong troubleshooting path. Collapsing
					 * these into one message is the defect, so they stay apart:
					 *
					 *   no data at all        (handled above) — "no section
					 *                          assignment needs loaded": the count
					 *                          cannot be computed yet.
					 *   a search with no match this one — the QUERIED term, plus a
					 *                          working `Clear search`.
					 *   a filter with no match this one — the ACTIVE FILTER's own
					 *                          name, plus a way back to All
					 *                          sections.
					 */
					<div className="flex flex-col items-center justify-center p-12 text-center bg-background border border-dashed border-border/60 rounded-2xl" data-testid="teaching-load-section-empty">
						{trimmedQuery ? <Search className="size-10 text-muted-foreground/40 mb-4" /> : <Filter className="size-10 text-muted-foreground/40 mb-4" />}
						{trimmedQuery ? (
							<>
								<h3 className="text-sm font-semibold text-muted-foreground" data-testid="teaching-load-section-empty-title">
									{`No sections match '${trimmedQuery}'`}
								</h3>
								<p className="text-xs text-muted-foreground/80 mt-1 max-w-md">
									{sectionModeFilter === 'all'
										? 'The search text does not appear in any section name or program code.'
										: `The search text does not appear in any section under ${activeFilterLabel}.`}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-4 gap-1.5 text-xs"
									data-testid="teaching-load-section-clear-search"
									onClick={() => setSearchQuery('')}
								>
									<X className="size-3.5" aria-hidden="true" />
									Clear search
								</Button>
							</>
						) : (
							<>
								<h3 className="text-sm font-semibold text-muted-foreground" data-testid="teaching-load-section-empty-title">
									{`No sections match ${activeFilterLabel}`}
								</h3>
								<p className="text-xs text-muted-foreground/80 mt-1 max-w-md">
									{sectionModeFilter === 'all'
										? 'There is nothing to show in this view yet.'
										: `No section currently matches ${activeFilterLabel}. Switch to ${activeFilterLabels.all} to review every section.`}
								</p>
								{sectionModeFilter !== 'all' && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="mt-4 gap-1.5 text-xs"
										data-testid="teaching-load-section-clear-filter"
										onClick={() => onSectionModeFilterChange('all')}
									>
										Show all sections
									</Button>
								)}
							</>
						)}
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
							role="button"
							tabIndex={0}
							aria-expanded={isExpanded}
							className="flex items-center gap-4 p-3 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
							onClick={() => handleRowClick(row.section.id)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleRowClick(row.section.id);
								}
							}}
						>
								<div className={cn(
									"flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm",
									row.isCompleted ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
								)}>
									{row.isCompleted ? <CheckCircle2 className="size-6" /> : <Users className="size-6" />}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										{/* Phase 0C.1: completion dot carries a text alternative so it is not color-only. */}
										<span
											className={cn("size-2 rounded-full shrink-0", completedSectionIds.has(row.section.id) ? "bg-emerald-500" : "bg-amber-400")}
											role="img"
											aria-label={completedSectionIds.has(row.section.id) ? 'Assigned' : 'Pending'}
										/>
										<h4 className="text-sm font-semibold uppercase tracking-tight truncate">
											{row.section.name}
										</h4>
										{row.section.isSpecialProgram && (
											<Badge variant="outline" className="h-4 px-1.5 text-xs font-semibold uppercase bg-violet-50 text-violet-700 border-violet-100">
												{row.section.programCode}
											</Badge>
										)}
									</div>
									<p className="text-xs font-bold text-muted-foreground uppercase tracking-widest truncate">
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
										<p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter">Staffed</p>
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
											
											const candidates = selectEligibleOwnerCandidates(faculty, subject, activeFacultyIds);

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
													<div
														data-testid="teaching-load-section-assignment-state"
														className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 shadow-sm animate-in fade-in duration-300"
													>
																<UserCheck className="size-4 text-emerald-600" />
																<div className="flex flex-col">
																	<span className="text-xs font-semibold text-emerald-900 uppercase leading-none mb-0.5">{owner.facultyName}</span>
																	<span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter leading-none">{owner.isPending ? 'Pending Assignment' : 'Current Owner'}</span>
																</div>
																{/* A6 c7 §1.3: ONE `Undo`, INSIDE the confirmation it describes, and
																    only while the change is still a draft. A saved owner is CHANGED,
																    not undone, and `Change teacher` beside it is the control for
																    that. One `@/ui` Button at the SAME chrome as the trigger beside
																    it (§8 one look per control), and the same `saving` /
																    read-only gates — it is a write. */}
																{owner.isPending && (
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		className="h-9 gap-1.5 font-semibold uppercase tracking-widest text-xs border-emerald-200 bg-background hover:bg-emerald-50 hover:text-emerald-900 shadow-sm"
																		disabled={saving || isReadOnlyMode}
																		data-testid="teaching-load-section-assign-undo"
																		aria-label={`Undo the teacher assignment for ${row.section.name}`}
																		onClick={() => handleUndoDraftOwner(subject.id, row.section.id, owner.facultyId)}
																	>
																		<RotateCcw className="size-3.5" aria-hidden="true" />
																		Undo
																	</Button>
																)}
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
																		{/* A6 c7 §1.2: `owner` is a data-model word, not a school word. The
																	    trigger's CHROME is untouched — the complaint was the word, and
																	    repainting one button in a view whose other controls are uppercase
																	    would create the §8 "one look per control" mismatch. The all-caps
																	    sweep belongs to a separate whole-view slice.
																	    `data-testid`, props and the `...owner...` helper names are stable
																	    DOM/API hooks and are deliberately NOT renamed. */}
																		{isStaffed ? 'Change teacher' : 'Assign teacher'}
																		<ChevronDown className="size-4 opacity-50" />
																	</Button>
																</PopoverTrigger>
																<PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0 overflow-hidden rounded-xl shadow-2xl border-primary/20">
																	<div className="p-3 border-b border-border/40 bg-muted/20">
																		<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1">Eligible Teaching Load owners</p>
																		<p className="text-xs font-bold text-foreground truncate">{subject.name}</p>
																	</div>
																	<div className="max-h-[min(60vh,26rem)] overflow-auto no-scrollbar p-1">
																		{candidates.length === 0 ? (
																			<p className="p-4 text-center text-xs font-bold text-muted-foreground italic uppercase">No qualified owners found</p>
																		) : candidates.map(f => {
																		const isCurrentOwner = owner?.facultyId === f.id;
																		// Canonical candidate signal: teaching utilization against the
																		// explicit effective standard. Unknown standard shows hours only.
																				const candidateHours = resolveTeachingActualHours(f);
																				const loadPct = f.isPlaceholder || teachingStandardHours == null ? null : Math.round(teachingUtilizationPercentFor(f, teachingStandardHours));
																			const authority = ownershipDepartmentEligibility(f.department, subject);
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
																{/* A6 c5 §3, surface 2 of 3. The sections grid used to
																    suppress the percentage for a placeholder and print
																    nothing in its place, so the only signal was the
																    absence of a number — which reads as a rendering
																    quirk, not as "this person does not exist yet". The
																    label is the packet's own sentence and it is the
																    same constant the roster row and the suggestion
																    preview row use. */}
																{f.isPlaceholder && (
																	<span
																		data-testid="teaching-load-owner-option-placeholder"
																		className="block text-[10px] font-bold leading-tight text-muted-foreground"
																	>
																		{PLACEHOLDER_TRUTH_LABEL}
																	</span>
																)}
																<div className="flex items-center gap-2 mt-0.5">
																								<span className={cn(
																									"text-[11px] font-bold uppercase tracking-tighter",
																									loadPct == null ? "text-muted-foreground" : loadPct > 100 ? "text-rose-600" : loadPct > 80 ? "text-amber-600" : "text-emerald-600"
																								)}>
																									{loadPct == null ? `${candidateHours.toFixed(1)}h teaching` : `${loadPct}% Load`}
																								</span>
																								<span className="text-muted-foreground/30">•</span>
																								<span className="text-[10px] font-bold text-muted-foreground uppercase truncate">
																									{f.department || 'No Dept'}
																								</span>
																								{/* An unmapped/blank department is shown as unverified, never as
																								    a hard exclusion. The server authority decides on apply. */}
																								{authority === 'unknown' && (
																									<span
																										className="text-[10px] font-bold uppercase tracking-tighter text-amber-600"
																										data-testid="teaching-load-owner-option-unverified"
																									>
																										Verify dept
																									</span>
																								)}
																							</div>
																						</div>
																						{isCurrentOwner ? <UserCheck className="size-4 text-emerald-600" /> : <UserPlus className="size-4 text-primary/40 group-hover:text-primary transition-colors" />}
																					</Button>
																				</PopoverClose>
																			);
																		})}
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
