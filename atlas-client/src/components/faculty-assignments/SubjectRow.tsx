import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';
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
	onSetSections: (subjectId: number, sectionIds: number[]) => void;
	isOutsideDepartment?: boolean;
	facultyDepartment?: string | null;
	searchTerm?: string;
	sectionFilter?: 'all' | 'unassigned' | 'assigned';
	gradeLevelFilter?: string;
	advisedSectionId?: number | null;
};

export function SubjectRow({
	subject,
	assignment,
	sections,
	disabled,
	selectedFacultyId,
	savedOwnershipMap,
	pendingOwnershipMap,
	onSetSections,
	isOutsideDepartment,
	facultyDepartment,
	searchTerm = '',
	sectionFilter = 'all',
	gradeLevelFilter = 'all',
	advisedSectionId = null,
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

	const selectableSectionIds = sections
		.filter((section) => {
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
		onSetSections(subject.id, selectableSectionIds);
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

	// Soft advisory: specialization mismatch
	const isSpecMismatch =
		Boolean(facultyDepartment) &&
		Array.isArray((subject as any).allowedSpecializations) &&
		(subject as any).allowedSpecializations.length > 0 &&
		!(subject as any).allowedSpecializations.includes(facultyDepartment);

	return (
		<div
			className={`rounded-lg border p-3 transition-colors ${
				selectedCount > 0
					? isOutsideDepartment
						? 'border-amber-300/60 bg-amber-50/30'
						: 'border-primary/30 bg-primary/5'
					: 'border-border'
			}`}
		>
			<div className="flex items-start gap-3">
				<Checkbox
					checked={selectedCount > 0}
					onCheckedChange={handleToggleAll}
					disabled={disabled || sections.length === 0}
				/>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium">{subject.name}</span>
						<code className="rounded bg-muted px-1 py-0.5 text-[0.6rem] font-mono">{subject.code}</code>
						{isOutsideDepartment && (
							<Badge variant="outline" className="border-amber-300 text-[0.5625rem] text-amber-700">
								Outside Dept.
							</Badge>
						)}
						{isSpecMismatch && (
							<Badge variant="outline" className="border-orange-300 text-[0.5625rem] text-orange-700">
								Spec. Mismatch
							</Badge>
						)}
						<Badge variant="secondary" className="text-[0.5625rem]">
							{selectedCount} / {sections.length || 0} sections
						</Badge>
						{blockedCount > 0 && (
							<Badge variant="outline" className="border-red-200 text-[0.5625rem] text-red-700">
								{blockedCount} blocked
							</Badge>
						)}
					</div>
					<p className="mt-1 text-[0.6875rem] text-muted-foreground">
						{Math.round((subject.minMinutesPerWeek / 60) * 10) / 10} hrs/week per section
					</p>
				</div>
			</div>

			{sections.length === 0 ? (
				<p className="ml-7 mt-3 text-[0.6875rem] text-muted-foreground">
					No active sections in the current school year for {subject.code}.
				</p>
			) : (
				<div className="ml-7 mt-3 space-y-2">
					{groupedSections.map(({ gradeLevel, sections: gradeSections }) => {
						const isOpen = openGrades[gradeLevel] ?? (searchTerm ? true : false);
						const selectedInGrade = gradeSections.filter((section) => selectedSectionIds.has(section.id)).length;
						const gradeStyle = getGradeColors(gradeLevel);
						return (
							<div key={gradeLevel} className={`overflow-hidden rounded-md border ${gradeStyle.container}`}>
								<Button
									type="button"
									variant="ghost"
									onClick={() =>
										setOpenGrades((current) => ({
											...current,
											[gradeLevel]: !(current[gradeLevel] ?? true),
										}))
									}
									className="h-auto w-full justify-between rounded-none px-3 py-2"
								>
									<span className="flex items-center gap-2 text-sm font-medium">
										{isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
										{gradeLabel(gradeLevel)}
									</span>
									<Badge variant="secondary" className="text-[0.5625rem]">
										{selectedInGrade} / {gradeSections.length}
									</Badge>
								</Button>
								{isOpen && (
									<div className="grid grid-cols-2 gap-1.5 border-t border-border/70 p-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
										{gradeSections.map((section) => {
											const key = getOwnershipKey(subject.id, section.id);
											const savedOwner = savedOwnershipMap[key];
											const pendingOwner = pendingOwnershipMap[key];
											const isSelected = selectedSectionIds.has(section.id);
											const isPendingCurrent = pendingOwner?.facultyId === selectedFacultyId;
											const isSavedCurrent = savedOwner?.facultyId === selectedFacultyId;
											const isPendingOther = Boolean(pendingOwner && pendingOwner.facultyId !== selectedFacultyId);
											const isSavedOther = Boolean(savedOwner && savedOwner.facultyId !== selectedFacultyId);
											const blocked = !isSelected && (isPendingOther || isSavedOther);
											const badgeLabel = isPendingOther
												? `Pending: ${pendingOwner?.facultyName}`
												: isSavedOther
												? `Saved: ${savedOwner?.facultyName}`
												: isPendingCurrent
												? 'Pending'
												: isSavedCurrent
												? 'Saved'
												: null;
											return (
												<div
													key={section.id}
													className={`flex flex-col gap-1.5 rounded-md border p-2 transition-colors ${
														blocked
															? 'cursor-not-allowed border-red-300 bg-red-50/50 opacity-70'
															: isSelected
															? 'border-primary/40 bg-primary/5 ring-1 ring-primary/20'
															: gradeStyle.card
													}`}
												>
													<div className="flex items-start gap-1.5">
														<Checkbox
															checked={isSelected}
															onCheckedChange={() => toggleSection(section.id)}
															disabled={disabled || blocked}
															className="mt-0.5 shrink-0"
														/>
														<div className="min-w-0 flex-1">
															<div className="flex items-center gap-1">
																<p className="truncate text-xs font-semibold leading-tight">{section.name}</p>
																{advisedSectionId && section.id === advisedSectionId && (
																	<Badge className="shrink-0 gap-0.5 border-amber-300 bg-amber-50 px-1 py-0 text-[0.5rem] text-amber-700 flex items-center">
																		<Star className="size-2.5 fill-amber-500 text-amber-500" />
																		Advisory
																	</Badge>
																)}
															</div>
															{section.programCode && section.programCode !== 'REGULAR' && (
																<p className="truncate text-[0.6rem] text-muted-foreground">{section.programCode}</p>
															)}
														</div>
													</div>
													<div className="flex items-center gap-1.5 pl-5">
														{badgeLabel && (
															<Tooltip>
																<TooltipTrigger asChild>
																	<Badge
																		variant="outline"
																		className={`text-[0.5625rem] ${
																			isPendingOther
																				? 'border-red-200 text-red-700'
																				: isSavedOther
																				? 'border-amber-200 text-amber-700'
																				: isPendingCurrent
																				? 'border-sky-200 text-sky-700'
																				: 'border-emerald-200 text-emerald-700'
																		}`}
																	>
																		{badgeLabel}
																	</Badge>
																</TooltipTrigger>
																<TooltipContent side="top" className="max-w-xs text-xs">
																	{isPendingOther && (
																		<p>{pendingOwner?.facultyName} has this subject-section pair in an unsaved session draft.</p>
																	)}
																	{isSavedOther && (
																		<p>{savedOwner?.facultyName} already owns this subject-section pair in saved data.</p>
																	)}
																	{isPendingCurrent && (
																		<p>This selection is pending in the current session and has not been saved yet.</p>
																	)}
																	{isSavedCurrent && !isPendingCurrent && (
																		<p>This subject-section pair is already saved for the selected teacher.</p>
																	)}
																</TooltipContent>
															</Tooltip>
														)}
													</div>
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
	);
}
