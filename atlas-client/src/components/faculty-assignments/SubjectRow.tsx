import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Clock, Lock, Star } from 'lucide-react';
import { toast } from 'sonner';

import {
	type FacultyAssignmentDraft,
	type FacultyOwnershipState,
} from '@/lib/faculty-assignment-helpers';
import { gradeLabel } from '@/lib/grade-labels';
import type { ExternalSection, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

export function getOwnershipKey(subjectId: number, sectionId: number): string {
	return `${subjectId}:${sectionId}`;
}

export type SubjectRowProps = {
	subject: Subject;
	assignment?: FacultyAssignmentDraft;
	sections: ExternalSection[];
	disabled: boolean;
	selectedFacultyId: number;
	savedOwnershipMap: Record<string, FacultyOwnershipState>;
	pendingOwnershipMap: Record<string, FacultyOwnershipState>;
	/** Multi-owner map for detecting database-level duplicate ownership conflicts. */
	savedConflictMap?: Record<string, FacultyOwnershipState[]>;
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	onSwapSectionOwnership?: (subjectId: number, sectionId: number, fromFacultyId: number) => void;
	isOutsideDepartment?: boolean;
	searchTerm?: string;
	sectionFilter?: 'all' | 'unassigned' | 'assigned';
	gradeLevelFilter?: string;
	advisedSectionId?: number | null;
	remainingCapacityMinutes?: number;
	onHoverLoadMinutes?: (minutes: number) => void;
	onClearHoverLoad?: () => void;
};

export function SubjectRow({
	subject,
	assignment,
	sections,
	disabled,
	selectedFacultyId,
	savedOwnershipMap,
	pendingOwnershipMap,
	savedConflictMap = {},
	onSetSections,
	onSwapSectionOwnership,
	isOutsideDepartment,
	searchTerm = '',
	sectionFilter = 'all',
	gradeLevelFilter = 'all',
	advisedSectionId = null,
	remainingCapacityMinutes = Number.POSITIVE_INFINITY,
	onHoverLoadMinutes,
	onClearHoverLoad,
}: SubjectRowProps) {
	const [openGrades, setOpenGrades] = useState<Record<number, boolean>>({});

	// Compute filtered sections locally based on global searchTerm and sectionFilter
	const displaySections = useMemo(() => {
		let result = sections;

		if (gradeLevelFilter !== 'all') {
			result = result.filter((sec) => sec.displayOrder === Number(gradeLevelFilter));
		}

		if (sectionFilter !== 'all') {
			result = result.filter((sec) => {
				const key = getOwnershipKey(subject.id, sec.id);
				const isAssigned = Boolean(savedOwnershipMap[key]) || Boolean(pendingOwnershipMap[key]);
				return sectionFilter === 'assigned' ? isAssigned : !isAssigned;
			});
		}

		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			if (subject.name.toLowerCase().includes(term) || subject.code.toLowerCase().includes(term)) {
				// subject matches — show all
			} else {
				result = result.filter(
					(sec) =>
						sec.name.toLowerCase().includes(term) ||
						`g${sec.displayOrder}`.toLowerCase().includes(term) ||
						sec.displayOrder.toString().includes(term),
				);
			}
		}

		return result;
	}, [sections, sectionFilter, gradeLevelFilter, searchTerm, subject, savedOwnershipMap, pendingOwnershipMap]);

	const groupedSections = useMemo(() => {
		const sectionGroups = new Map<number, ExternalSection[]>();
		for (const section of displaySections) {
			const nextSections = sectionGroups.get(section.displayOrder) ?? [];
			nextSections.push(section);
			sectionGroups.set(section.displayOrder, nextSections);
		}
		return Array.from(sectionGroups.entries())
			.sort(([leftGrade], [rightGrade]) => leftGrade - rightGrade)
			.map(([gradeLevel, gradeSections]) => ({
				gradeLevel,
				sections: [...gradeSections].sort(
					(left, right) => left.name.localeCompare(right.name) || left.id - right.id,
				),
			}));
	}, [displaySections]);

	const selectedSectionIds = new Set(assignment?.sectionIds ?? []);
	const selectedCount = selectedSectionIds.size;

	// Count hard DB-level conflicts for sections belonging to this subject
	const conflictedSectionCount = sections.filter((sec) => {
		const key = getOwnershipKey(subject.id, sec.id);
		return (savedConflictMap[key]?.length ?? 0) > 1;
	}).length;

	const selectableSectionIds = sections
		.filter((section) => {
			const programType = section.programType ?? 'REGULAR';
			const programCompatible =
				subject.programScopes.length === 0 || subject.programScopes.includes(programType);
			if (!programCompatible) return false;
			if (selectedSectionIds.has(section.id)) return true;
			const key = getOwnershipKey(subject.id, section.id);
			const pendingOwner = pendingOwnershipMap[key];
			if (pendingOwner && pendingOwner.facultyId !== selectedFacultyId) return false;
			const savedOwner = savedOwnershipMap[key];
			if (savedOwner && savedOwner.facultyId !== selectedFacultyId) return false;
			return true;
		})
		.map((section) => section.id);

	const blockedCount = sections.length - selectableSectionIds.length;

	if (groupedSections.length === 0 && (searchTerm || sectionFilter !== 'all' || gradeLevelFilter !== 'all')) {
		return null;
	}

	const getGradeColors = (grade: number) => {
		switch (grade) {
			case 7:
				return { container: 'border-green-200 bg-green-50/30', card: 'border-green-200 bg-green-50 hover:bg-green-100/50', text: 'text-green-700' };
			case 8:
				return { container: 'border-yellow-200 bg-yellow-50/30', card: 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100/50', text: 'text-yellow-700' };
			case 9:
				return { container: 'border-red-200 bg-red-50/30', card: 'border-red-200 bg-red-50 hover:bg-red-100/50', text: 'text-red-700' };
			case 10:
				return { container: 'border-blue-200 bg-blue-50/30', card: 'border-blue-200 bg-blue-50 hover:bg-blue-100/50', text: 'text-blue-700' };
			default:
				return { container: 'border-border/70 bg-background', card: 'border-border/60 hover:bg-muted/30', text: 'text-muted-foreground' };
		}
	};

	const handleToggleAll = () => {
		if (selectedCount > 0) {
			onSetSections(subject.id, []);
			return;
		}
		if (selectableSectionIds.length === 0) {
			toast.error('All eligible sections for this subject are already owned by another teacher.');
			return;
		}
		if (selectableSectionIds.length < sections.length) {
			toast.warning('Sections already owned by another teacher were skipped.');
		}

		const selectedWithinCap: number[] = [];
		let remainingMinutes = remainingCapacityMinutes;
		for (const sectionId of selectableSectionIds) {
			if (remainingMinutes < subject.minMinutesPerWeek) {
				break;
			}
			selectedWithinCap.push(sectionId);
			remainingMinutes -= subject.minMinutesPerWeek;
		}

		if (selectedWithinCap.length === 0) {
			toast.error('Not enough remaining capacity for additional sections.');
			return;
		}

		onSetSections(subject.id, selectedWithinCap);
	};

	const toggleSection = (sectionId: number) => {
		if (selectedSectionIds.has(sectionId)) {
			onSetSections(
				subject.id,
				Array.from(selectedSectionIds).filter((value) => value !== sectionId),
			);
			return;
		}
		const key = getOwnershipKey(subject.id, sectionId);
		const pendingOwner = pendingOwnershipMap[key];
		if (pendingOwner && pendingOwner.facultyId !== selectedFacultyId) {
			toast.error(`Pending session conflict: ${pendingOwner.facultyName} already selected this subject-section pair.`);
			return;
		}
		const savedOwner = savedOwnershipMap[key];
		if (savedOwner && savedOwner.facultyId !== selectedFacultyId) {
			toast.error(`Saved ownership conflict: ${savedOwner.facultyName} already owns this subject-section pair.`);
			return;
		}
		onSetSections(subject.id, [...selectedSectionIds, sectionId]);
	};

	// HG system-assignment detection
	const isHgSubject = subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom');
	const isSystemAssignedSubject = isHgSubject && advisedSectionId != null;

	return (
		<div className={`rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${
			selectedCount > 0 ? 'bg-background border-border/80 ring-1 ring-primary/5' : 'bg-muted/5 border-dashed border-muted-foreground/30'
		}`}>
			{/* Row Header - Identity & Global Status */}
			<div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border/40">
				<div className="flex items-center gap-4 flex-1 min-w-0">
					<div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ${selectedCount > 0 ? 'bg-primary/5 text-primary border-primary/10' : 'bg-muted text-muted-foreground border-muted-foreground/10'}`}>
						<BookOpen className="size-5" />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-semibold text-foreground truncate">{subject.name}</span>
							{isOutsideDepartment && (
								<Badge variant="outline" className="text-[0.6rem] font-bold bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-tight h-4 px-1.5 shadow-none">Outside Dept</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 mt-0.5">
							<code className="text-[0.7rem] font-mono text-muted-foreground uppercase tracking-tight">{subject.code}</code>
							<span className="text-muted-foreground/30 text-[0.6rem]">•</span>
							<span className="text-[0.65rem] text-muted-foreground font-medium flex items-center gap-1 uppercase tracking-wide">
								<Clock className="size-3" />
								{subject.minMinutesPerWeek}m / week
							</span>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/50 shadow-inner">
						<div className="flex flex-col items-center">
							<span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Owned</span>
							<span className={`text-sm font-bold tabular-nums leading-none ${selectedCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{selectedCount}</span>
						</div>
						<div className="w-px h-5 bg-border/60 mx-1" />
						<div className="flex flex-col items-center">
							<span className="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Pool</span>
							<span className="text-sm font-bold tabular-nums leading-none text-muted-foreground">{sections.length}</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleToggleAll}
							disabled={disabled || sections.length === 0}
							className="h-8 px-3 text-[0.7rem] font-bold uppercase tracking-tight shadow-sm"
						>
							{selectedCount > 0 ? 'Deselect All' : 'Select All Eligible'}
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							className={`h-8 w-8 rounded-full transition-transform ${Object.values(openGrades).some(v => v) ? 'bg-muted' : ''}`}
							onClick={() => {
								const anyOpen = Object.values(openGrades).some(v => v);
								const next: Record<number, boolean> = {};
								groupedSections.forEach(g => { next[g.gradeLevel] = !anyOpen; });
								setOpenGrades(next);
							}}
						>
							<ChevronDown className={`size-4 transition-transform ${Object.values(openGrades).some(v => v) ? 'rotate-180' : ''}`} />
						</Button>
					</div>
				</div>
			</div>

			<div className="bg-muted/5">
				{sections.length === 0 ? (
					<p className="p-8 text-center text-xs text-muted-foreground italic">
						No active sections in the current school year for {subject.code}.
					</p>
				) : (
					<div className="divide-y divide-border/30">
						{groupedSections.map(({ gradeLevel, sections: gradeSections }) => {
						const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);
						const selectedInGrade = gradeSections.filter((section) => selectedSectionIds.has(section.id)).length;
						const gradeStyle = getGradeColors(gradeLevel);
						return (
							<div key={gradeLevel} className="group/grade">
								<Button
									type="button"
									variant="ghost"
									onClick={() =>
										setOpenGrades((current) => ({
											...current,
											[gradeLevel]: !(current[gradeLevel] ?? true),
										}))
									}
									className={`h-auto w-full justify-between rounded-none px-4 py-2.5 hover:bg-muted/40 transition-colors ${isOpen ? 'bg-muted/20 border-b border-border/30' : ''}`}
								>
									<span className="flex items-center gap-2.5 text-[0.75rem] font-bold uppercase tracking-widest text-muted-foreground group-hover/grade:text-foreground transition-colors">
										{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
										{gradeLabel(gradeLevel)}
									</span>
									<Badge variant="secondary" className="text-[0.65rem] font-bold h-5 bg-muted/60 text-muted-foreground shadow-none">
										{selectedInGrade} / {gradeSections.length}
									</Badge>
								</Button>
								{isOpen && (
									<div className="flex flex-wrap gap-2 p-4 animate-in slide-in-from-top-2 duration-300">
										{gradeSections.map((section) => {
											const key = getOwnershipKey(subject.id, section.id);
											const savedOwner = savedOwnershipMap[key];
											const pendingOwner = pendingOwnershipMap[key];
											const conflictOwners = savedConflictMap[key];
											const isHardConflict = (conflictOwners?.length ?? 0) > 1;
											const isSelected = selectedSectionIds.has(section.id);
											const isPendingOther = Boolean(pendingOwner && pendingOwner.facultyId !== selectedFacultyId);
											const isSavedOther = Boolean(savedOwner && savedOwner.facultyId !== selectedFacultyId);
											const programType = section.programType ?? 'REGULAR';
											const programCompatible =
												subject.programScopes.length === 0 || subject.programScopes.includes(programType);
											const blocked = !isSelected && (!programCompatible || isPendingOther || isSavedOther || isHardConflict);
											const isSystemAssignedSection =
												isSystemAssignedSubject && section.id === advisedSectionId;
											
											const conflictLabel = isHardConflict
												? 'DB Conflict'
												: isPendingOther
												? pendingOwner?.facultyName
												: isSavedOther
												? savedOwner?.facultyName
												: null;

											return (
												<div
													key={section.id}
													className={`group/section relative flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-all duration-200 ${
														isSystemAssignedSection
															? 'border-amber-200 bg-amber-50/50'
															: isHardConflict
															? 'border-rose-300 bg-rose-50'
															: blocked
															? 'border-muted bg-muted/30 opacity-60'
															: isSelected
															? 'border-primary/40 bg-primary/5 ring-1 ring-primary/10'
															: 'bg-background border-border/60 hover:border-border'
													}`}
												>
													<Checkbox
														checked={isSelected}
														onCheckedChange={() => toggleSection(section.id)}
														disabled={disabled || blocked || isSystemAssignedSection}
														onMouseEnter={() => {
															if (!isSelected && !blocked) onHoverLoadMinutes?.(subject.minMinutesPerWeek);
														}}
														onMouseLeave={() => onClearHoverLoad?.()}
														className={`size-3.5 rounded-sm transition-opacity ${isSystemAssignedSection ? 'opacity-0' : 'opacity-100'}`}
													/>
													
													<div className="flex flex-col min-w-0">
														<div className="flex items-center gap-2">
															<span className={`text-[0.75rem] font-bold leading-none truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
																{section.name}
															</span>
															{isSystemAssignedSection && (
																<Lock className="size-2.5 text-amber-600 shrink-0" />
															)}
														</div>
														
														{(section.assignmentSpecializationLabel || conflictLabel) && (
															<div className="mt-1 flex items-center gap-1.5">
																{section.assignmentSpecializationLabel && (
																	<span className="text-[0.6rem] font-bold text-sky-700/70 uppercase tracking-tighter truncate max-w-[80px]">
																		{section.assignmentSpecializationLabel}
																	</span>
																)}
																{conflictLabel && (
																	<Tooltip>
																		<TooltipTrigger asChild>
																			<div className="flex items-center gap-1 cursor-help">
																				<div className={`size-1.5 rounded-full shrink-0 ${isHardConflict ? 'bg-rose-500' : 'bg-amber-500'}`} />
																				<span className={`text-[0.6rem] font-bold uppercase tracking-tighter truncate max-w-[60px] ${isHardConflict ? 'text-rose-700' : 'text-amber-700'}`}>
																					{conflictLabel}
																				</span>
																			</div>
																		</TooltipTrigger>
																		<TooltipContent side="top" className="text-[0.7rem] font-medium">
																			{isHardConflict ? 'Database-level conflict detected.' : `Already owned by ${conflictLabel}`}
																		</TooltipContent>
																	</Tooltip>
																)}
															</div>
														)}
													</div>

													{isSavedOther && !disabled && (
														<Button
															type="button"
															variant="ghost"
															size="xs"
															onClick={() => onSwapSectionOwnership?.(subject.id, section.id, savedOwner.facultyId)}
															className="ml-1 h-5 w-8 p-0 text-[0.6rem] font-bold text-primary opacity-0 group-hover/section:opacity-100 hover:bg-primary/10 transition-opacity uppercase"
														>
															Take
														</Button>
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
				)}
			</div>
		</div>
	);
}
