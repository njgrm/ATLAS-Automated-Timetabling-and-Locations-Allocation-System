import { useMemo, useState } from 'react';
import { AlertTriangle, RotateCcw, ShieldCheck, X } from 'lucide-react';

import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import {
	MAX_WEEKLY_TEACHING_HOURS,
	deriveWorkloadCapacity,
	matchesOwnershipDepartment,
} from '@/lib/faculty-assignment-helpers';
import { formatTime } from '@/lib/utils';
import type { FacultyMirror, ScheduledEntry, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { ScrollArea } from '@/ui/scroll-area';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';

type TacticalSandboxDockProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedEntry: ScheduledEntry | null;
	draftEntries: ScheduledEntry[];
	facultyMap: Map<number, FacultyMirror>;
	subjectMap: Map<number, Subject>;
	schoolYearId: number | null;
	sandboxFacultyByEntryId: Map<string, number>;
	onApplyFaculty: (entryIds: string[], facultyId: number) => void;
	onResetSandbox: () => void;
	onDismissSelectedEntry: (entryId: string) => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
};

type Candidate = {
	faculty: FacultyMirror;
	teachingHours: number;
	creditHours: number;
	creditedTotalHours: number;
	statusLabel: string;
	toCapHours: number;
	overCapHours: number;
	isCurrent: boolean;
	isSelected: boolean;
};

function facultyDisplayName(faculty: FacultyMirror): string {
	return `${faculty.lastName}, ${faculty.firstName}`;
}

function ancillaryCreditHours(faculty: FacultyMirror): number {
	const rawMinutes = (faculty as FacultyMirror & { ancillaryMinutesPerWeek?: number | null }).ancillaryMinutesPerWeek;
	return typeof rawMinutes === 'number' && Number.isFinite(rawMinutes) ? rawMinutes / 60 : 0;
}

function getFacultySubjectIds(faculty: FacultyMirror): Set<number> {
	return new Set((faculty.facultySubjects ?? []).map((assignment) => assignment.subjectId));
}

function isEligibleFaculty(faculty: FacultyMirror, subject: Subject | undefined, selectedEntry: ScheduledEntry): boolean {
	if (!faculty.isActiveForScheduling) return false;
	if (faculty.id === selectedEntry.facultyId) return true;
	if (!subject) return false;
	if (getFacultySubjectIds(faculty).has(subject.id)) return true;
	if (matchesOwnershipDepartment(faculty.department, subject)) return true;
	return Boolean(faculty.canTeachOutsideDepartment && subject.allowedSpecializations?.includes(faculty.specialization ?? ''));
}

function projectEntryFaculty(
	entry: ScheduledEntry,
	sandboxFacultyByEntryId: Map<string, number>,
	selectedEntryId: string | null,
	previewFacultyId: number | null,
	bulkEntryIds: Set<string>,
): ScheduledEntry {
	const committedOverride = sandboxFacultyByEntryId.get(entry.entryId);
	if (committedOverride != null) return { ...entry, facultyId: committedOverride };
	if (previewFacultyId != null && selectedEntryId && (entry.entryId === selectedEntryId || bulkEntryIds.has(entry.entryId))) {
		return { ...entry, facultyId: previewFacultyId };
	}
	return entry;
}

function teachingHoursForFaculty(entries: ScheduledEntry[], facultyId: number): number {
	const minutes = entries.reduce((total, entry) => entry.facultyId === facultyId ? total + entry.durationMinutes : total, 0);
	return Math.round((minutes / 60) * 10) / 10;
}

function formatHours(value: number): string {
	return `${Math.round(value * 10) / 10}h`;
}

export function TacticalSandboxDock({
	open,
	onOpenChange,
	selectedEntry,
	draftEntries,
	facultyMap,
	subjectMap,
	schoolYearId,
	sandboxFacultyByEntryId,
	onApplyFaculty,
	onResetSandbox,
	onDismissSelectedEntry,
	subjectLabel,
	sectionLabel,
	facultyLabel,
}: TacticalSandboxDockProps) {
	const [bulkEntryIds, setBulkEntryIds] = useState<Set<string>>(new Set());
	const subject = selectedEntry ? subjectMap.get(selectedEntry.subjectId) : undefined;
	const previewFacultyId = selectedEntry ? sandboxFacultyByEntryId.get(selectedEntry.entryId) ?? selectedEntry.facultyId : null;

	const scopedSameSubjectEntries = useMemo(() => {
		if (!selectedEntry) return [];
		return draftEntries
			.filter((entry) => {
				if (entry.entryId === selectedEntry.entryId) return false;
				if (entry.subjectId !== selectedEntry.subjectId) return false;
				if (selectedEntry.termIndex != null && entry.termIndex != null && entry.termIndex !== selectedEntry.termIndex) return false;
				return true;
			})
			.sort((left, right) => {
				const leftSection = sectionLabel(left.sectionId);
				const rightSection = sectionLabel(right.sectionId);
				if (leftSection !== rightSection) return leftSection.localeCompare(rightSection);
				return `${left.day}${left.startTime}`.localeCompare(`${right.day}${right.startTime}`);
			});
	}, [draftEntries, selectedEntry, sectionLabel]);

	const candidates = useMemo<Candidate[]>(() => {
		if (!selectedEntry) return [];
		return Array.from(facultyMap.values())
			.filter((faculty) => isEligibleFaculty(faculty, subject, selectedEntry))
			.map((faculty) => {
				const candidateProjectedEntries = draftEntries.map((entry) => projectEntryFaculty(
					entry,
					sandboxFacultyByEntryId,
					selectedEntry.entryId,
					faculty.id,
					bulkEntryIds,
				));
				const teachingHours = teachingHoursForFaculty(candidateProjectedEntries, faculty.id);
				const creditHours = Math.max(faculty.advisoryEquivalentHours ?? 0, 0) + ancillaryCreditHours(faculty);
				const capacity = deriveWorkloadCapacity(teachingHours, creditHours, faculty.maxHoursPerWeek || MAX_WEEKLY_TEACHING_HOURS);
				return {
					faculty,
					teachingHours: capacity.teachingHours,
					creditHours: capacity.creditHours,
					creditedTotalHours: capacity.creditedTotalHours,
					statusLabel: capacity.statusLabel,
					toCapHours: capacity.toCapHours,
					overCapHours: capacity.overCapHours,
					isCurrent: faculty.id === selectedEntry.facultyId,
					isSelected: faculty.id === previewFacultyId,
				};
			})
			.sort((left, right) => {
				if (left.overCapHours !== right.overCapHours) return left.overCapHours - right.overCapHours;
				if (left.creditedTotalHours !== right.creditedTotalHours) return left.creditedTotalHours - right.creditedTotalHours;
				return facultyDisplayName(left.faculty).localeCompare(facultyDisplayName(right.faculty));
			});
	}, [bulkEntryIds, draftEntries, facultyMap, previewFacultyId, sandboxFacultyByEntryId, selectedEntry, subject]);

	const selectedBulkCount = bulkEntryIds.size;
	const selectedEntryIds = useMemo(() => {
		if (!selectedEntry) return [];
		return [selectedEntry.entryId, ...Array.from(bulkEntryIds)];
	}, [bulkEntryIds, selectedEntry]);

	function toggleBulkEntry(entryId: string) {
		setBulkEntryIds((previous) => {
			const next = new Set(previous);
			if (next.has(entryId)) next.delete(entryId);
			else next.add(entryId);
			return next;
		});
	}

	function applyCandidate(facultyId: number) {
		if (selectedEntryIds.length === 0) return;
		onApplyFaculty(selectedEntryIds, facultyId);
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="flex max-h-[78svh] flex-col gap-3 overflow-hidden p-4 sm:p-5">
				<SheetHeader className="pr-8">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="h-5 px-2 text-[0.625rem] uppercase">Local Sandbox</Badge>
						<Badge variant="outline" className="h-5 px-2 text-[0.625rem]">Prompt 5 persists</Badge>
					</div>
					<SheetTitle>Tactical Teaching Load Dock</SheetTitle>
					<SheetDescription>
						{selectedEntry
							? `${subjectLabel(selectedEntry.subjectId)} for ${sectionLabel(selectedEntry.sectionId)} in SY ${schoolYearId ?? 'current'} stays local until commit support is added.`
							: 'Select a timetable block to preview local teacher reassignment options.'}
					</SheetDescription>
				</SheetHeader>

				{selectedEntry ? (
					<div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[0.9fr_1.4fr_1fr]">
						<section className="min-h-0 rounded-md border border-border bg-muted/20 p-3">
							<div className="space-y-2 text-xs">
								<div>
									<p className="text-[0.625rem] font-semibold uppercase text-muted-foreground">Selected Block</p>
									<p className="font-medium text-foreground">{subjectLabel(selectedEntry.subjectId)}</p>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<p className="text-[0.625rem] uppercase text-muted-foreground">Section</p>
										<p className="font-medium">{sectionLabel(selectedEntry.sectionId)}</p>
									</div>
									<div>
										<p className="text-[0.625rem] uppercase text-muted-foreground">Term</p>
										<p className="font-medium">{selectedEntry.termIndex ? `Term ${selectedEntry.termIndex}` : 'Run scope'}</p>
									</div>
								</div>
								<div>
									<p className="text-[0.625rem] uppercase text-muted-foreground">Current Teacher</p>
									<p className="font-medium">{selectedEntry.facultyId ? facultyLabel(selectedEntry.facultyId) : 'No teacher assigned'}</p>
								</div>
								<div>
									<p className="text-[0.625rem] uppercase text-muted-foreground">Time</p>
									<p className="font-medium">{selectedEntry.day} {formatTime(selectedEntry.startTime)}-{formatTime(selectedEntry.endTime)}</p>
								</div>
								{subject ? (
									<div className="rounded border border-border/70 bg-background px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
										Owner: {subject.ownerDepartment ?? subject.allowedOwnerDepartments?.join(', ') ?? 'not set'}
									</div>
								) : null}
							</div>
						</section>

						<section className="min-h-0 rounded-md border border-border bg-background">
							<div className="border-b border-border/70 px-3 py-2">
								<p className="text-xs font-semibold text-foreground">Eligible Teachers</p>
								<p className="text-[0.6875rem] text-muted-foreground">Teaching hours, advisory or ancillary credit, credited workload, and cap state are previewed locally.</p>
							</div>
							<ScrollArea className="h-72 lg:h-96">
								<div className="space-y-2 p-3">
									{candidates.length === 0 ? (
										<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
											No eligible active teacher was found for this subject scope.
										</div>
									) : candidates.map((candidate) => (
										<div key={candidate.faculty.id} className="rounded-md border border-border/80 bg-card p-3 shadow-sm">
											<div className="flex flex-wrap items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-1.5">
														<p className="truncate text-sm font-semibold text-foreground">{facultyDisplayName(candidate.faculty)}</p>
														{candidate.isCurrent ? <Badge variant="outline" className="h-5 px-1.5 text-[0.625rem]">Current</Badge> : null}
														{candidate.isSelected ? <Badge className="h-5 px-1.5 text-[0.625rem]">Previewed</Badge> : null}
													</div>
													<p className="text-[0.6875rem] text-muted-foreground">{candidate.faculty.department ?? 'Unassigned'}{candidate.faculty.specialization ? ` - ${candidate.faculty.specialization}` : ''}</p>
												</div>
												<Button type="button" size="sm" variant={candidate.isSelected ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => applyCandidate(candidate.faculty.id)}>
													Preview
												</Button>
											</div>
											<div className="mt-2 grid gap-2 sm:grid-cols-[1fr_11rem] sm:items-center">
												<StackedWorkloadBar
													teachingHours={candidate.teachingHours}
													creditHours={candidate.creditHours}
													maxHours={candidate.faculty.maxHoursPerWeek || MAX_WEEKLY_TEACHING_HOURS}
													compact
												/>
												<div className="text-[0.6875rem] text-muted-foreground sm:text-right">
													<p className="font-medium text-foreground">{formatHours(candidate.creditedTotalHours)} credited</p>
													<p>{formatHours(candidate.teachingHours)} teaching + {formatHours(candidate.creditHours)} credit</p>
													<p>{candidate.overCapHours > 0 ? `${formatHours(candidate.overCapHours)} over cap` : `${formatHours(candidate.toCapHours)} to cap`}</p>
												</div>
											</div>
											<p className="mt-1.5 text-[0.6875rem] font-medium text-muted-foreground">{candidate.statusLabel}</p>
										</div>
									))}
								</div>
							</ScrollArea>
						</section>

						<section className="min-h-0 rounded-md border border-border bg-background">
							<div className="border-b border-border/70 px-3 py-2">
								<p className="text-xs font-semibold text-foreground">Same-Subject Bulk Scope</p>
								<p className="text-[0.6875rem] text-muted-foreground">{selectedBulkCount} additional block{selectedBulkCount === 1 ? '' : 's'} selected.</p>
							</div>
							<ScrollArea className="h-72 lg:h-96">
								<div className="space-y-2 p-3">
									{scopedSameSubjectEntries.length === 0 ? (
										<p className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">No other generated blocks share this subject scope.</p>
									) : scopedSameSubjectEntries.map((entry) => {
										const checked = bulkEntryIds.has(entry.entryId);
										const facultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? entry.facultyId;
										return (
											<label key={entry.entryId} className="flex cursor-pointer items-start gap-2 rounded-md border border-border/80 bg-card p-2 text-xs">
												<Checkbox checked={checked} onCheckedChange={() => toggleBulkEntry(entry.entryId)} aria-label={`Include ${sectionLabel(entry.sectionId)} in sandbox preview`} />
												<span className="min-w-0 flex-1">
													<span className="block font-medium text-foreground">{sectionLabel(entry.sectionId)}</span>
													<span className="block text-[0.6875rem] text-muted-foreground">{entry.day} {formatTime(entry.startTime)}-{formatTime(entry.endTime)}</span>
													<span className="block truncate text-[0.6875rem] text-muted-foreground">{facultyId ? facultyLabel(facultyId) : 'No teacher'}</span>
												</span>
											</label>
										);
									})}
								</div>
							</ScrollArea>
						</section>
					</div>
				) : (
					<div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
						Select a timetable block to open the local sandbox.
					</div>
				)}

				<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
						<p>Sandbox previews do not call persistence endpoints. Changed blocks are highlighted in the grid; teacher-time conflicts are marked with red borders.</p>
					</div>
				</div>

				<SheetFooter className="gap-2 sm:space-x-0">
					<Button type="button" variant="outline" size="sm" onClick={onResetSandbox} className="gap-1.5">
						<RotateCcw className="size-3.5" />
						Reset Sandbox
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => selectedEntry ? onDismissSelectedEntry(selectedEntry.entryId) : onOpenChange(false)} className="gap-1.5">
						<X className="size-3.5" />
						Close without Saving
					</Button>
					<Button type="button" size="sm" disabled className="gap-1.5">
						<ShieldCheck className="size-3.5" />
						Commit in Prompt 5
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}