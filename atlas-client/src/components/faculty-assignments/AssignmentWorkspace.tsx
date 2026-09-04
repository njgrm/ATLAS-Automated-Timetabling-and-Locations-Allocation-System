import { useMemo } from 'react';
import { Card, CardContent } from '@/ui/card';
import { Search, Activity, AlertTriangle, CheckCircle2, Users, Layers } from 'lucide-react';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { AnimatePresence, motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { SubjectRow } from '@/components/faculty-assignments/SubjectRow';
import type { 
	Subject, 
	ExternalSection, 
	FacultySummary, 
	FacultyAssignmentDraft, 
	FacultyOwnershipState 
} from '@/types';

type AssignmentWorkspaceProps = {
	viewMode: string;
	selected: FacultySummary;
	subjects: Subject[];
	currentAssignments: FacultyAssignmentDraft[];
	sectionsBySubject: Record<number, ExternalSection[]>;
	saving: boolean;
	isReadOnlyMode: boolean;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	savedConflictMap: Record<string, FacultyOwnershipState[]>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	onSwapSectionOwnership: (subjectId: number, sectionId: number, fromFacultyId: number) => void;
	subjectSearch: string;
	onSubjectSearchChange: (value: string) => void;
	sectionFilter: 'all' | 'unassigned' | 'assigned';
	onSectionFilterChange: (value: 'all' | 'unassigned' | 'assigned') => void;
	gradeLevelFilter: string;
	onGradeLevelFilterChange: (value: string) => void;
	showJumpList: boolean;
	onToggleJumpList: () => void;
	jumpListItems: { id: number; code: string; type: string }[];
	departmentQualifiedSubjects: Subject[];
	outsideDepartmentSubjects: Subject[];
	homeroomHint: { advisedSectionId: number | null } | null;
	remainingCapacityMinutes: number;
	onHoverLoadMinutes: (minutes: number) => void;
	onClearHoverLoad: () => void;
	activeFacultyIds: Set<number>;
	resolveSectionHoverDeltaMinutes: (subject: Subject, sectionId: number) => number;
	faculty: FacultySummary[];
	onSelectTeacher: (id: number) => void;
	onSetViewMode: (mode: string) => void;
	getAssignmentOwnershipKey: (subjectId: number, sectionId: number) => string;
};

export function AssignmentWorkspace({
	viewMode,
	selected,
	subjects,
	currentAssignments,
	sectionsBySubject,
	saving,
	isReadOnlyMode,
	savedOwnershipMap,
	pendingOwnershipMap,
	savedConflictMap,
	onSetSections,
	onSwapSectionOwnership,
	subjectSearch,
	onSubjectSearchChange,
	sectionFilter,
	onSectionFilterChange,
	gradeLevelFilter,
	onGradeLevelFilterChange,
	showJumpList,
	onToggleJumpList,
	jumpListItems,
	departmentQualifiedSubjects,
	outsideDepartmentSubjects,
	homeroomHint,
	remainingCapacityMinutes,
	onHoverLoadMinutes,
	onClearHoverLoad,
	activeFacultyIds,
	resolveSectionHoverDeltaMinutes,
	faculty,
	onSelectTeacher,
	onSetViewMode,
	getAssignmentOwnershipKey,
}: AssignmentWorkspaceProps) {
	const effectiveOwnershipMap = useMemo(() => {
		const map: Record<string, FacultyOwnershipState & { isPending: boolean }> = {};
		for (const [key, val] of Object.entries(savedOwnershipMap || {})) {
			map[key] = { ...val, isPending: false };
		}
		for (const [key, val] of Object.entries(pendingOwnershipMap || {})) {
			map[key] = { ...val, isPending: true };
		}
		return map;
	}, [savedOwnershipMap, pendingOwnershipMap]);

	return (
		<div className="flex-1 flex min-h-0 gap-3">
			<AnimatePresence mode="popLayout">
				{showJumpList && (
					<motion.div
						initial={{ width: 0, opacity: 0, x: -10 }}
						animate={{ width: 64, opacity: 1, x: 0 }}
						exit={{ width: 0, opacity: 0, x: -10 }}
						transition={{ type: 'spring', damping: 25, stiffness: 200 }}
						className="shrink-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden py-2"
					>
						<h5 className="text-xs font-bold text-center uppercase tracking-tighter text-muted-foreground opacity-60">Jump</h5>
						<div className="flex-1 overflow-auto no-scrollbar space-y-1 px-2 mt-2">
							{jumpListItems.map((item) => (
								<Tooltip key={item.id}>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="xs"
											className={`w-full h-8 font-bold text-xs ${item.type === 'qualified' ? 'text-emerald-700 hover:bg-emerald-50' : 'text-muted-foreground hover:bg-muted'}`}
											onClick={() => {
												document.getElementById(`subject-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
											}}
										>
											{item.code}
										</Button>
									</TooltipTrigger>
									<TooltipContent side="right" className="text-xs font-bold">
										{item.code} {item.type === 'qualified' ? '(Qualified)' : '(Outside Dept)'}
									</TooltipContent>
								</Tooltip>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<Card className="flex min-h-0 flex-1 flex-col overflow-hidden shadow-sm border-border/40">
				<div className="flex items-center gap-4 border-b border-border bg-muted/5 px-5 py-2.5">
					<div className="relative w-60 shrink-0">
						<Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Filter subjects..."
							value={subjectSearch}
							onChange={(event) => onSubjectSearchChange(event.target.value)}
							className="h-8 pl-9 text-xs bg-background shadow-sm"
						/>
					</div>
					<Select value={sectionFilter} onValueChange={(v) => onSectionFilterChange(v as 'all' | 'unassigned' | 'assigned')}>
						<SelectTrigger className="h-8 w-36 text-xs font-bold bg-background shadow-sm uppercase tracking-tight">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs font-bold uppercase">All Sections</SelectItem>
							<SelectItem value="unassigned" className="text-xs font-bold uppercase">Unassigned</SelectItem>
							<SelectItem value="assigned" className="text-xs font-bold uppercase">Assigned</SelectItem>
						</SelectContent>
					</Select>
					<Select value={gradeLevelFilter} onValueChange={onGradeLevelFilterChange}>
						<SelectTrigger className="h-8 w-32 text-xs font-bold bg-background shadow-sm uppercase tracking-tight">
							<SelectValue placeholder="Grade" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all" className="text-xs font-bold uppercase">All Grades</SelectItem>
							<SelectItem value="7" className="text-xs font-bold uppercase">GR7</SelectItem>
							<SelectItem value="8" className="text-xs font-bold uppercase">GR8</SelectItem>
							<SelectItem value="9" className="text-xs font-bold uppercase">GR9</SelectItem>
							<SelectItem value="10" className="text-xs font-bold uppercase">GR10</SelectItem>
						</SelectContent>
					</Select>

					<div className="flex-1" />

					<Button
						variant={showJumpList ? 'secondary' : 'outline'}
						size="icon-sm"
						className="h-8 w-8 shadow-sm"
						onClick={onToggleJumpList}
					>
						<Activity className="size-3.5" />
					</Button>
				</div>

				<CardContent className="flex-1 overflow-auto pt-4 space-y-4 scroll-smooth no-scrollbar">
					{(() => {
						if (viewMode === 'assignments') {
							return (
								<>
									{departmentQualifiedSubjects.length > 0 && (
										<section className="space-y-3">
											<div className="flex items-center gap-3">
												<h4 className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600/70">Qualified</h4>
												<div className="flex-1 h-px bg-emerald-500/10" />
											</div>
											<div className="space-y-3">
												{departmentQualifiedSubjects.map((subject) => {
													const prefix = `${subject.id}:`;
													const subjectEffectiveOwnership = Object.fromEntries(
														Object.entries(effectiveOwnershipMap).filter(([k]) => k.startsWith(prefix))
													);
													const subjectConflicts = Object.fromEntries(
														Object.entries(savedConflictMap || {}).filter(([k]) => k.startsWith(prefix))
													);

													return (
														<SubjectRow
															key={subject.id}
															subject={subject}
															assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
															sections={sectionsBySubject[subject.id] ?? []}
															disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
															selectedFacultyId={selected.id}
															effectiveOwnershipMap={subjectEffectiveOwnership}
															savedConflictMap={subjectConflicts}
															onSetSections={onSetSections}
															searchTerm={subjectSearch}
															gradeLevelFilter={gradeLevelFilter}
															sectionFilter={sectionFilter}
															advisedSectionId={homeroomHint?.advisedSectionId ?? null}
															remainingCapacityMinutes={remainingCapacityMinutes}
															onHoverLoadMinutes={onHoverLoadMinutes}
															onClearHoverLoad={onClearHoverLoad}
															activeFacultyIds={activeFacultyIds}
															onSwapSectionOwnership={onSwapSectionOwnership}
															selectedFacultySpecialization={selected.specialization}
															resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
														/>
													);
												})}
											</div>
										</section>
									)}

									{outsideDepartmentSubjects.length > 0 && (
										<section className="space-y-3 pt-2">
											<div className="flex items-center gap-3">
												<h4 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Cross-Dept</h4>
												<div className="flex-1 h-px bg-border/40" />
											</div>
											<div className="space-y-3">
												{outsideDepartmentSubjects.map((subject) => {
													const prefix = `${subject.id}:`;
													const subjectEffectiveOwnership = Object.fromEntries(
														Object.entries(effectiveOwnershipMap).filter(([k]) => k.startsWith(prefix))
													);
													const subjectConflicts = Object.fromEntries(
														Object.entries(savedConflictMap || {}).filter(([k]) => k.startsWith(prefix))
													);

													return (
														<SubjectRow
															key={subject.id}
															subject={subject}
															assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
															sections={sectionsBySubject[subject.id] ?? []}
															disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
															selectedFacultyId={selected.id}
															effectiveOwnershipMap={subjectEffectiveOwnership}
															savedConflictMap={subjectConflicts}
															onSetSections={onSetSections}
															isOutsideDepartment
															searchTerm={subjectSearch}
															gradeLevelFilter={gradeLevelFilter}
															sectionFilter={sectionFilter}
															advisedSectionId={homeroomHint?.advisedSectionId ?? null}
															remainingCapacityMinutes={remainingCapacityMinutes}
															onHoverLoadMinutes={onHoverLoadMinutes}
															onClearHoverLoad={onClearHoverLoad}
															activeFacultyIds={activeFacultyIds}
															onSwapSectionOwnership={onSwapSectionOwnership}
															selectedFacultySpecialization={selected.specialization}
															resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
														/>
													);
												})}
											</div>
										</section>
									)}
								</>
							);
						}

						if (viewMode === 'shortage') {
							const shortageSubjects = subjects.filter((s: Subject) => {
								const sections = sectionsBySubject[s.id] ?? [];
								return sections.some((sec: ExternalSection) => {
									const key = getAssignmentOwnershipKey(s.id, sec.id);
									const owner = savedOwnershipMap[key] || pendingOwnershipMap[key];
									return !owner || !activeFacultyIds.has(owner.facultyId);
								});
							}).sort((a: Subject, b: Subject) => {
								const aCount = (sectionsBySubject[a.id] ?? []).filter((sec: ExternalSection) => !(savedOwnershipMap[getAssignmentOwnershipKey(a.id, sec.id)] || pendingOwnershipMap[getAssignmentOwnershipKey(a.id, sec.id)])).length;
								const bCount = (sectionsBySubject[b.id] ?? []).filter((sec: ExternalSection) => !(savedOwnershipMap[getAssignmentOwnershipKey(b.id, sec.id)] || pendingOwnershipMap[getAssignmentOwnershipKey(b.id, sec.id)])).length;
								return bCount - aCount;
							});

							if (shortageSubjects.length === 0) {
								return (
									<div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
										<div className="size-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
											<CheckCircle2 className="size-8" />
										</div>
										<div className="space-y-1">
											<p className="text-sm font-bold uppercase tracking-tight">Full Coverage Achieved</p>
											<p className="text-xs text-muted-foreground font-medium">All active subject-sections have been assigned to teachers.</p>
										</div>
									</div>
								);
							}

							return (
								<div className="space-y-3">
									<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
										<AlertTriangle className="size-4 text-amber-600 shrink-0" />
										<p className="text-xs text-amber-900/80 font-bold leading-relaxed">
											Showing <span className="text-amber-900 font-bold">{shortageSubjects.length} subjects</span> with unassigned sections. Prioritize these to complete staffing.
										</p>
									</div>
									{shortageSubjects.map((subject) => (
										<SubjectRow
											key={subject.id}
											subject={subject}
											assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
											sections={sectionsBySubject[subject.id] ?? []}
											disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
											selectedFacultyId={selected.id}
											effectiveOwnershipMap={effectiveOwnershipMap}
											savedConflictMap={savedConflictMap}
											onSetSections={onSetSections}
											searchTerm={subjectSearch}
											gradeLevelFilter={gradeLevelFilter}
											sectionFilter="unassigned"
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
											remainingCapacityMinutes={remainingCapacityMinutes}
											onHoverLoadMinutes={onHoverLoadMinutes}
											onClearHoverLoad={onClearHoverLoad}
											activeFacultyIds={activeFacultyIds}
											onSwapSectionOwnership={onSwapSectionOwnership}
											selectedFacultySpecialization={selected.specialization}
											resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
										/>
									))}
								</div>
							);
						}

						if (viewMode === 'utilization') {
							const underloadedFaculty = faculty.filter(f => !f.isPlaceholder && (f.policyLoadPercentage ?? 0) < 80).sort((a, b) => (a.policyLoadPercentage ?? 0) - (b.policyLoadPercentage ?? 0));

							return (
								<div className="space-y-3">
									<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
										<Users className="size-4 text-blue-600 shrink-0" />
										<p className="text-xs text-blue-900/80 font-bold leading-relaxed">
											Showing <span className="text-blue-900 font-bold">{underloadedFaculty.length} teachers</span> with spare capacity (less than 80% load). These can cover the remaining unassigned rows.
										</p>
									</div>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{underloadedFaculty.map(f => (
											<Card 
												key={f.id} 
												className="p-3 border-border/60 shadow-none hover:border-primary/30 transition-all cursor-pointer group" 
												onClick={() => {
													onSelectTeacher(f.id);
													onSetViewMode('assignments');
												}}
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
															{f.firstName[0]}{f.lastName[0]}
														</div>
														<div className="min-w-0">
															<p className="text-xs font-bold truncate group-hover:text-primary transition-colors uppercase tracking-tight">{f.lastName}, {f.firstName}</p>
															<p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{f.department || 'No Dept'}</p>
														</div>
													</div>
													<div className="text-right">
														<p className="text-xs font-bold text-blue-600">{f.policyLoadPercentage}%</p>
														<p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{f.policyCreditedHours}h / {f.maxHoursPerWeek}h</p>
													</div>
												</div>
											</Card>
										))}
									</div>
								</div>
							);
						}

						if (viewMode === 'redistribution') {
							const specialSubjects = subjects.filter(s => 
								['SPA', 'SPS', 'STE', 'SPECIAL'].some(term => s.name.toUpperCase().includes(term) || s.code.toUpperCase().includes(term))
							);

							return (
								<div className="space-y-3">
									<div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-violet-50 border border-violet-100">
										<Layers className="size-4 text-violet-600 shrink-0" />
										<p className="text-xs text-violet-900/80 font-bold leading-relaxed">
											Showing <span className="text-violet-900 font-bold">{specialSubjects.length} Special Programs</span>. Audit concentrated ownership here to redistribute load for SPA, SPS, or STE sections.
										</p>
									</div>
									{specialSubjects.map((subject) => (
										<SubjectRow
											key={subject.id}
											subject={subject}
											assignment={currentAssignments.find((a) => a.subjectId === subject.id)}
											sections={sectionsBySubject[subject.id] ?? []}
											disabled={saving || !selected.isActiveForScheduling || isReadOnlyMode}
											selectedFacultyId={selected.id}
											effectiveOwnershipMap={effectiveOwnershipMap}
											savedConflictMap={savedConflictMap}
											onSetSections={onSetSections}
											searchTerm={subjectSearch}
											gradeLevelFilter={gradeLevelFilter}
											advisedSectionId={homeroomHint?.advisedSectionId ?? null}
											remainingCapacityMinutes={remainingCapacityMinutes}
											onHoverLoadMinutes={onHoverLoadMinutes}
											onClearHoverLoad={onClearHoverLoad}
											activeFacultyIds={activeFacultyIds}
											onSwapSectionOwnership={onSwapSectionOwnership}
											selectedFacultySpecialization={selected.specialization}
											resolveSectionHoverDeltaMinutes={resolveSectionHoverDeltaMinutes}
										/>
									))}
								</div>
							);
						}
						return null;
					})()}
				</CardContent>
			</Card>
		</div>
	);
}
