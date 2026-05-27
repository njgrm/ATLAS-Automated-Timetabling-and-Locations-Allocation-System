import { useMemo, useState, memo, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Clock, Lock, Star, RotateCcw, CheckCircle, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import {
	type FacultyAssignmentDraft,
	type FacultyOwnershipState,
	getAssignmentOwnershipKey as getOwnershipKey,
} from '@/lib/faculty-assignment-helpers';
import { gradeLabel, GRADE_COLORS } from '@/lib/grade-labels';
import type { ExternalSection, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
	activeFacultyIds?: Set<number>;
	selectedFacultySpecialization?: string | null;
	resolveSectionHoverDeltaMinutes?: (subject: Subject, sectionId: number) => number;
	quarantined?: boolean;
	quarantineLabel?: string | null;
};

const PROGRAM_BADGE: Record<string, string> = {
	SPA:   'bg-blue-50 text-blue-700 border-blue-200',
	SPS:   'bg-emerald-50 text-emerald-700 border-emerald-200',
	STE:   'bg-violet-50 text-violet-700 border-violet-200',
	SPTVE: 'bg-amber-50 text-amber-700 border-amber-200',
	OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

const GRADE_TINTS: Record<string, string> = {
	'7': 'bg-green-500/5 border-green-200/50',
	'8': 'bg-yellow-500/5 border-yellow-200/50',
	'9': 'bg-red-500/5 border-red-200/50',
	'10': 'bg-blue-500/5 border-blue-200/50',
};

function resolveRotationTermRank(subject: Pick<Subject, 'rotationTermRank' | 'modularOrder'>): number {
	if (typeof subject.rotationTermRank === 'number' && Number.isInteger(subject.rotationTermRank) && subject.rotationTermRank > 0) {
		return subject.rotationTermRank;
	}
	if (typeof subject.modularOrder === 'number' && Number.isInteger(subject.modularOrder) && subject.modularOrder > 0) {
		return subject.modularOrder;
	}
	return 0;
}

function resolveRotationTermLabel(subject: Pick<Subject, 'rotationTermLabel' | 'rotationTermRank' | 'modularOrder'>): string | null {
	const explicitLabel = (subject.rotationTermLabel ?? '').trim();
	if (explicitLabel.length > 0) {
		const rankMatch = explicitLabel.match(/(\d+)/);
		if (rankMatch) {
			const parsed = Number(rankMatch[1]);
			if (Number.isInteger(parsed) && parsed > 0) {
				return `Term ${parsed}`;
			}
		}
		return explicitLabel;
	}
	const termRank = resolveRotationTermRank(subject);
	return termRank > 0 ? `Term ${termRank}` : null;
}

function resolveRotationLaneKey(subject: Pick<Subject, 'rotationFamily' | 'rotationTermRank' | 'modularOrder'>): string | null {
	const family = (subject.rotationFamily ?? '').trim().toUpperCase();
	if (family.length === 0) {
		return null;
	}
	return `${family}:term:${resolveRotationTermRank(subject)}`;
}

export const SubjectRow = memo(({
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
	activeFacultyIds = new Set(),
	selectedFacultySpecialization = null,
	resolveSectionHoverDeltaMinutes,
	quarantined = false,
	quarantineLabel = null,
}: SubjectRowProps) => {
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
						sec.displayOrder.toString().includes(term) ||
						(sec.assignmentSpecializationLabel || '').toLowerCase().includes(term),
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

	const subjectCode = subject.code.toUpperCase();
	const isSpecializationSlot = subjectCode === 'SPA_SPEC' || subjectCode === 'SPS_SPEC' || subjectCode.startsWith('SPA_') || subjectCode.startsWith('SPS_');

	const selectableSections = useMemo(() => {
		return sections.filter((section) => {
			const programType = section.programType ?? 'REGULAR';
			const programCompatible =
				subject.programScopes.length === 0 || subject.programScopes.includes(programType);
			if (!programCompatible) return false;
			if (selectedSectionIds.has(section.id)) return true;
			const key = getOwnershipKey(subject.id, section.id);
			const pendingOwner = pendingOwnershipMap[key];
			if (pendingOwner && pendingOwner.facultyId !== selectedFacultyId) return false;
			const savedOwner = savedOwnershipMap[key];
			if (savedOwner && savedOwner.facultyId !== selectedFacultyId && activeFacultyIds.has(savedOwner.facultyId)) return false;
			return true;
		});
	}, [sections, subject.programScopes, selectedSectionIds, pendingOwnershipMap, selectedFacultyId, savedOwnershipMap, activeFacultyIds]);

	const selectableSectionIds = selectableSections.map((s) => s.id);

	const handleToggleGrade = useCallback((gradeLevel: number, gradeSections: ExternalSection[]) => {
		const gradeSectionIds = gradeSections.map((s) => s.id);
		const currentSelectedInGrade = gradeSectionIds.filter((id) => selectedSectionIds.has(id));
		
		if (currentSelectedInGrade.length > 0) {
			// Deselect all in this grade
			onSetSections(
				subject.id,
				Array.from(selectedSectionIds).filter((id) => !gradeSectionIds.includes(id)),
			);
			return;
		}

		// Select all eligible in this grade
		const eligibleInGrade = gradeSections.filter((s) => selectableSectionIds.includes(s.id)).map((s) => s.id);
		if (eligibleInGrade.length === 0) {
			toast.error(`No eligible sections to assign in ${gradeLabel(gradeLevel)}.`);
			return;
		}

		const nextSelection = Array.from(new Set([...Array.from(selectedSectionIds), ...eligibleInGrade]));
		onSetSections(subject.id, nextSelection);
	}, [selectedSectionIds, subject.id, onSetSections, selectableSectionIds]);

	const handleToggleAll = useCallback(() => {
		if (quarantined) {
			toast.error(quarantineLabel ?? 'Assignments temporarily locked while data review finishes');
			return;
		}
		if (selectedCount > 0) {
			onSetSections(subject.id, []);
			return;
		}
		if (selectableSectionIds.length === 0) {
			toast.error('All eligible sections for this subject are already owned by active teachers.');
			return;
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

		onSetSections(subject.id, selectedWithinCap);
	}, [quarantined, quarantineLabel, selectedCount, subject.id, subject.minMinutesPerWeek, onSetSections, selectableSectionIds, remainingCapacityMinutes]);

	const toggleSection = useCallback((sectionId: number) => {
		if (quarantined) {
			toast.error(quarantineLabel ?? 'Assignments temporarily locked while data review finishes');
			return;
		}
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
			toast.error(`Pending conflict: ${pendingOwner.facultyName} already selected this.`);
			return;
		}
		const savedOwner = savedOwnershipMap[key];
		if (savedOwner && savedOwner.facultyId !== selectedFacultyId && activeFacultyIds.has(savedOwner.facultyId)) {
			toast.error(`Ownership conflict: ${savedOwner.facultyName} already owns this class.`);
			return;
		}
		onSetSections(subject.id, [...selectedSectionIds, sectionId]);
	}, [quarantined, quarantineLabel, selectedSectionIds, subject.id, onSetSections, pendingOwnershipMap, selectedFacultyId, savedOwnershipMap, activeFacultyIds]);

	const rotationLaneKey = resolveRotationLaneKey(subject);
	const rotationTermLabel = resolveRotationTermLabel(subject);
	const isRotationFamily = Boolean(rotationLaneKey);

	// HG system-assignment detection
	const isHgSubject = subject.code === 'HG' || subject.name.toLowerCase().includes('homeroom');
	const isSystemAssignedSubject = isHgSubject && advisedSectionId != null;

	if (groupedSections.length === 0 && (searchTerm || sectionFilter !== 'all' || gradeLevelFilter !== 'all')) {
		return null;
	}

	return (
		<div id={`subject-${subject.id}`} className={`rounded-xl border shadow-sm transition-all duration-200 overflow-hidden ${
			selectedCount > 0 ? 'bg-background border-border/80 ring-1 ring-primary/5' : 'bg-muted/5 border-dashed border-muted-foreground/30'
		}`}>
			<div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border/40">
				<div className="flex items-center gap-4 flex-1 min-w-0">
					<div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-sm ${selectedCount > 0 ? 'bg-primary/5 text-primary border-primary/10' : 'bg-muted text-muted-foreground border-muted-foreground/10'}`}>
						<BookOpen className="size-5" />
					</div>
					<div className="min-w-0">
						<div className="flex items-center gap-2">
							<span className="font-bold text-foreground truncate">{subject.name}</span>
							{isOutsideDepartment && (
								<Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200 uppercase tracking-tight h-4 px-1.5 shadow-none">Outside Dept</Badge>
							)}
							{isRotationFamily && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Badge variant="outline" className="text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200 uppercase tracking-tight h-4 px-1.5 shadow-none cursor-help">
											Rotating Term Lane
										</Badge>
									</TooltipTrigger>
											<TooltipContent side="top" className="text-xs font-bold max-w-[280px] p-3">
												<p className="mb-1">Rotational Weekly Lane</p>
												<p className="text-muted-foreground leading-relaxed font-medium italic">
													Year-round classes stay every week. Rotational Science/TLE contributes only from the busiest term.
													<br/><br/>
													<span className="text-foreground">Credited load = year-round classes + peak rotational term.</span>
												</p>
											</TooltipContent>
								</Tooltip>
							)}
							{isRotationFamily && rotationTermLabel && (
								<Badge variant="outline" className="text-[10px] font-bold bg-violet-100 text-violet-900 border-violet-300 uppercase tracking-tight h-4 px-1.5 shadow-none">
									{rotationTermLabel}
								</Badge>
							)}
							{isSpecializationSlot && (
								<Badge variant="outline" className="text-[10px] font-bold bg-sky-50 text-sky-700 border-sky-200 uppercase tracking-tight h-4 px-1.5 shadow-none">Requires Specialization</Badge>
							)}
							{quarantined && (
								<Badge variant="outline" className="text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-200 uppercase tracking-tight h-4 px-1.5 shadow-none">Quarantined</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 mt-1">
							<code className="text-xs font-mono text-muted-foreground/80 font-bold uppercase tracking-tight">{subject.code}</code>
							<span className="text-muted-foreground/30 text-[10px]">*</span>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 uppercase tracking-tight cursor-help">
										<Clock className="size-3" />
										{subject.minMinutesPerWeek}m / week
									</span>
								</TooltipTrigger>
								<TooltipContent side="top" className="text-xs font-bold">
									{isRotationFamily ? 'Total Combined Minutes' : 'Actual Weekly Load'}
								</TooltipContent>
							</Tooltip>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/30 border border-border/50 shadow-inner">
						<div className="flex flex-col items-center">
							<span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider leading-none mb-1">Assigned</span>
							<span className={`text-sm font-black tabular-nums leading-none ${selectedCount > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{selectedCount}</span>
						</div>
						<div className="w-px h-6 bg-border/60 mx-1" />
						<div className="flex flex-col items-center">
							<span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider leading-none mb-1">Total</span>
							<span className="text-sm font-black tabular-nums leading-none text-muted-foreground">{sections.length}</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleToggleAll}
							disabled={disabled || sections.length === 0 || quarantined}
							className="h-8 px-4 text-xs font-bold uppercase tracking-tight shadow-sm"
						>
							{selectedCount > 0 ? 'Unassign All' : 'Assign Available'}
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
					<p className="p-8 text-center text-sm text-muted-foreground italic font-medium">
						No active sections in the current school year for {subject.code}.
					</p>
				) : (
					<div className="divide-y divide-border/30">
						{groupedSections.map(({ gradeLevel, sections: gradeSections }) => {
							const isOpen = openGrades[gradeLevel] ?? Boolean(searchTerm);
							const selectedInGrade = gradeSections.filter((section) => selectedSectionIds.has(section.id)).length;
							const gradeColorClass = GRADE_COLORS[gradeLevel.toString()]?.split(' ')[1] || 'text-muted-foreground';
							const gradeTint = GRADE_TINTS[gradeLevel.toString()] || 'bg-muted/10';

							return (
								<div key={gradeLevel} className="group/grade">
									<div 
										className={`flex items-center justify-between px-5 py-2.5 transition-colors cursor-pointer select-none ${isOpen ? 'bg-muted/20 border-b border-border/30' : 'hover:bg-muted/10'}`}
										onClick={() =>
											setOpenGrades((current) => ({
												...current,
												[gradeLevel]: !isOpen,
											}))
										}
									>
										<div className="flex items-center gap-3">
											{isOpen ? <ChevronDown className="size-4 text-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
											<span className={cn("text-xs font-bold uppercase tracking-widest", isOpen ? "text-foreground" : "text-muted-foreground")}>
												<span className={gradeColorClass}>
													{gradeLabel(gradeLevel)}
												</span>
											</span>
										</div>
										
										<div className="flex items-center gap-4">
											<Badge variant="secondary" className="text-xs font-black h-6 px-2 bg-muted/60 text-muted-foreground shadow-none tabular-nums">
												{selectedInGrade} / {gradeSections.length}
											</Badge>
											<Button
												type="button"
												variant="ghost"
												size="xs"
												disabled={disabled || quarantined}
												onClick={(e) => {
													e.stopPropagation();
													handleToggleGrade(gradeLevel, gradeSections);
												}}
												className="h-7 px-3 text-[11px] font-bold uppercase text-primary hover:bg-primary/5 border border-primary/20"
											>
												{selectedInGrade > 0 ? 'Unassign Grade' : 'Assign Grade'}
											</Button>
										</div>
									</div>
									<AnimatePresence initial={false}>
										{isOpen && (
											<motion.div
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: 'auto', opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.2 }}
												className="overflow-hidden"
											>
												<div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-5 border-l-4 ${gradeTint}`}>
													{gradeSections.map((section) => {
														const key = getOwnershipKey(subject.id, section.id);
														const savedOwner = savedOwnershipMap[key];
														const pendingOwner = pendingOwnershipMap[key];
														const conflictOwners = savedConflictMap[key];
														const isHardConflict = (conflictOwners?.length ?? 0) > 1;
														const isSelected = selectedSectionIds.has(section.id);
														const isPendingOther = Boolean(pendingOwner && pendingOwner.facultyId !== selectedFacultyId);
														const isSavedOther = Boolean(savedOwner && savedOwner.facultyId !== selectedFacultyId);
														const isStaleOwner = isSavedOther && !activeFacultyIds.has(savedOwner.facultyId);
														const programType = section.programType ?? 'REGULAR';
														const programCompatible =
															subject.programScopes.length === 0 || subject.programScopes.includes(programType);
														const blocked = !isSelected && (!programCompatible || isPendingOther || (isSavedOther && !isStaleOwner) || isHardConflict || quarantined);
														const isSystemAssignedSection = isSystemAssignedSubject && section.id === advisedSectionId;
														const conflictLabel = isHardConflict
															? 'DB Conflict'
															: isPendingOther
															? pendingOwner?.facultyName
															: isSavedOther
															? (isStaleOwner ? `Stale: ${savedOwner.facultyName}` : savedOwner.facultyName)
															: null;
																	const hoverDeltaMinutes =
																		!isSelected && isRotationFamily && !blocked
																			? Math.max(0, resolveSectionHoverDeltaMinutes?.(subject, section.id) ?? subject.minMinutesPerWeek)
																			: 0;

														const requiredSpec = section.assignmentSpecializationCode;
														const facultySpec = selectedFacultySpecialization;
														const isPerfectMatch = Boolean(requiredSpec && facultySpec && requiredSpec === facultySpec);
														const isApprovedCompatibility = Boolean(isSpecializationSlot && !isPerfectMatch && !blocked);

														return (
															<div
																key={section.id}
																onClick={() => !disabled && !blocked && !isSystemAssignedSection && toggleSection(section.id)}
																onMouseEnter={() => {
																	if (!isSelected && !blocked) {
																		const delta = isRotationFamily ? hoverDeltaMinutes : subject.minMinutesPerWeek;
																		if (delta > 0) {
																			onHoverLoadMinutes?.(delta);
																		}
																	}
																}}
																onMouseLeave={() => onClearHoverLoad?.()}
																className={cn(
																	"group/section relative flex flex-col items-start gap-2 rounded-xl border px-3.5 py-3 transition-all duration-200 shadow-sm select-none",
																	!disabled && !blocked && !isSystemAssignedSection && "cursor-pointer",
																	isSystemAssignedSection
																		? 'border-amber-300 bg-amber-50/50 shadow-inner'
																		: isHardConflict
																		? 'border-rose-400 bg-rose-50 shadow-rose-100/50'
																		: isStaleOwner
																		? 'border-amber-400/60 bg-amber-50/40'
																		: blocked
																		? 'border-muted bg-muted/40 opacity-70 cursor-not-allowed'
																		: isSelected
																		? 'border-primary/50 bg-primary/5 ring-1 ring-primary/10 shadow-primary/5'
																		: isPerfectMatch
																		? 'border-emerald-300 bg-emerald-50/30 hover:border-primary/40 hover:shadow-md'
																		: isRotationFamily 
																		? 'bg-card border-violet-200 hover:border-violet-400 hover:shadow-md'
																		: 'bg-card border-border/80 hover:border-primary/40 hover:shadow-md'
																)}
															>
																<div className="flex items-center justify-between w-full mb-1">
																	<div className="flex items-center gap-2.5 min-w-0">
																		<Checkbox
																			checked={isSelected}
																			onCheckedChange={() => toggleSection(section.id)}
																			disabled={disabled || blocked || isSystemAssignedSection}
																			className={cn(
																				"size-4 rounded transition-opacity shadow-none border-border/60 pointer-events-none",
																				isSystemAssignedSection ? 'opacity-0' : 'opacity-100'
																			)}
																		/>
																		<span className={`text-[0.75rem] font-black leading-tight truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
																			{section.name}
																		</span>
																	</div>
																	
																	<div className="flex items-center gap-1.5 shrink-0 ml-2">
																		{isSystemAssignedSection && (
																			<Lock className="size-3 text-amber-600" />
																		)}
																	</div>
																</div>

																<div className="w-full space-y-1.5">
																	<div className="flex flex-wrap items-center gap-1.5">
																		{section.isSpecialProgram && section.programCode && PROGRAM_BADGE[section.programCode] && (
																			<Badge variant="outline" className={`h-3.5 px-1 text-[9px] font-black uppercase border-none shadow-none ${PROGRAM_BADGE[section.programCode]}`}>
																				{section.programCode}
																			</Badge>
																		)}
																		{isRotationFamily && rotationTermLabel && (
																			<Badge variant="outline" className="h-3.5 px-1 text-[9px] font-black uppercase bg-violet-100 text-violet-900 border-violet-300 shadow-none">
																				{rotationTermLabel}
																			</Badge>
																		)}
																	</div>

																	<div className="flex items-center justify-between w-full mt-1">
																		<div className="min-w-0">
																			{section.assignmentSpecializationLabel && (
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<span className={`text-[10px] font-bold uppercase tracking-tight truncate block cursor-help ${isPerfectMatch ? 'text-emerald-700' : isApprovedCompatibility ? 'text-sky-700' : 'text-muted-foreground/60'}`}>
																							{section.assignmentSpecializationLabel}
																						</span>
																					</TooltipTrigger>
																					<TooltipContent side="top" className="text-xs font-bold">
																						Required: {section.assignmentSpecializationLabel}
																						{isApprovedCompatibility && " (Approved Alternative)"}
																					</TooltipContent>
																				</Tooltip>
																			)}
																			{conflictLabel && (
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<div className="flex items-center gap-1 cursor-help">
																							<div className={`size-1.5 rounded-full shrink-0 ${isHardConflict ? 'bg-rose-500' : isStaleOwner ? 'bg-amber-400 opacity-50' : 'bg-amber-500'}`} />
																							<span className={`text-[10px] font-bold uppercase tracking-tight truncate max-w-[80px] ${isHardConflict ? 'text-rose-700' : isStaleOwner ? 'text-amber-700/70' : 'text-amber-700'}`}>
																								{conflictLabel}
																							</span>
																						</div>
																					</TooltipTrigger>
																					<TooltipContent side="top" className="text-xs font-bold">
																						{isHardConflict 
																							? 'Database-level conflict detected.' 
																							: isStaleOwner 
																							? `Stale historical owner: ${savedOwner.facultyName}. Selection will replace this record.`
																							: `Already owned by ${conflictLabel}`}
																					</TooltipContent>
																				</Tooltip>
																			)}
																		</div>

																		{isSavedOther && !disabled && (
																			<Button
																				type="button"
																				variant="outline"
																				size="icon-xs"
																				onClick={(e) => {
																					e.stopPropagation();
																					onSwapSectionOwnership?.(subject.id, section.id, savedOwner.facultyId);
																				}}
																				className="h-5 w-5 text-primary border-primary/30 hover:bg-primary hover:text-white"
																			>
																				{isStaleOwner ? <RotateCcw className="size-2.5" /> : <ArrowRight className="size-2.5" />}
																			</Button>
																		)}
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
});
