import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';

import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import {
	MAX_WEEKLY_TEACHING_HOURS,
	deriveWorkloadCapacity,
	matchesOwnershipDepartment,
} from '@/lib/faculty-assignment-helpers';
import { formatTime } from '@/lib/utils';
import type { CommitResult, FacultyMirror, ManualEditBatchPreviewResult, ManualEditProposal, ScheduledEntry, Subject } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
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
	onPreviewFacultyBatch: (proposals: ManualEditProposal[]) => Promise<ManualEditBatchPreviewResult | null>;
	onCommitFacultyBatch: (proposals: ManualEditProposal[], allowSoftOverride?: boolean) => Promise<CommitResult | null>;
	onResetSandbox: () => void;
	onDismissSelectedEntry: (entryId: string) => void;
	disabled: boolean;
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

type ReviewStep = {
	label: string;
	state: 'done' | 'active' | 'waiting' | 'blocked';
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

function reviewStatusCopy(preview: ManualEditBatchPreviewResult | null, canCommitPreview: boolean): string {
	if (!preview) return 'Review checks teacher conflicts and policy warnings before save.';
	if (canCommitPreview) return 'Ready to save. No blocking schedule conflict was found.';
	return 'Choose a different teacher or remove blocked rows, then review again.';
}

function ReviewStepPill({ step }: { step: ReviewStep }) {
	const tone = step.state === 'done'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: step.state === 'active'
			? 'border-primary/25 bg-primary/10 text-primary'
			: step.state === 'blocked'
				? 'border-red-200 bg-red-50 text-red-700'
				: 'border-border bg-muted/30 text-muted-foreground';

	return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{step.label}</span>;
}

function buildFacultyChangeProposals(entries: ScheduledEntry[], sandboxFacultyByEntryId: Map<string, number>): ManualEditProposal[] {
	const proposals: ManualEditProposal[] = [];
	for (const entry of entries) {
		const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
		if (facultyId == null || facultyId === entry.facultyId) continue;
		proposals.push({
			editType: 'CHANGE_FACULTY',
			entryId: entry.entryId,
			targetFacultyId: facultyId,
		});
	}
	return proposals;
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
	onPreviewFacultyBatch,
	onCommitFacultyBatch,
	onResetSandbox,
	onDismissSelectedEntry,
	disabled,
	subjectLabel,
	sectionLabel,
	facultyLabel,
}: TacticalSandboxDockProps) {
	const [bulkEntryIds, setBulkEntryIds] = useState<Set<string>>(new Set());
	const [batchPreview, setBatchPreview] = useState<ManualEditBatchPreviewResult | null>(null);
	const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
	const [batchCommitLoading, setBatchCommitLoading] = useState(false);
	const [softWarningAcknowledged, setSoftWarningAcknowledged] = useState(false);
	const [candidateQuery, setCandidateQuery] = useState('');
	const subject = selectedEntry ? subjectMap.get(selectedEntry.subjectId) : undefined;
	const previewFacultyId = selectedEntry ? sandboxFacultyByEntryId.get(selectedEntry.entryId) ?? selectedEntry.facultyId : null;
	const stagedProposals = useMemo(() => buildFacultyChangeProposals(draftEntries, sandboxFacultyByEntryId), [draftEntries, sandboxFacultyByEntryId]);
	const stagedProposalKey = useMemo(() => JSON.stringify(stagedProposals), [stagedProposals]);
	const stagedEntryIds = useMemo(() => new Set(stagedProposals.map((proposal) => proposal.entryId).filter((entryId): entryId is string => Boolean(entryId))), [stagedProposals]);
	const stagedCount = stagedProposals.length;
	const canCommitPreview = Boolean(batchPreview?.allowed && batchPreview.errorCount === 0 && batchPreview.hardViolations.length === 0);
	const softWarningCount = batchPreview?.softViolations.length ?? 0;
	const requiresSoftWarningAcknowledgement = canCommitPreview && softWarningCount > 0;
	const canSaveReviewedBatch = canCommitPreview && (!requiresSoftWarningAcknowledgement || softWarningAcknowledged);
	const reviewSteps: ReviewStep[] = useMemo(() => ([
		{ label: '1 Select teacher', state: stagedCount > 0 ? 'done' : 'active' },
		{ label: '2 Review changes', state: batchPreview ? (canCommitPreview ? 'done' : 'blocked') : stagedCount > 0 ? 'active' : 'waiting' },
		{ label: '3 Save draft', state: batchPreview ? (canSaveReviewedBatch ? 'active' : canCommitPreview ? 'waiting' : 'blocked') : 'waiting' },
	]), [batchPreview, canCommitPreview, canSaveReviewedBatch, stagedCount]);

	useEffect(() => {
		setBatchPreview(null);
		setSoftWarningAcknowledged(false);
	}, [stagedProposalKey]);

	useEffect(() => {
		setCandidateQuery('');
	}, [selectedEntry?.entryId]);

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

	const filteredCandidates = useMemo(() => {
		const query = candidateQuery.trim().toLowerCase();
		if (!query) return candidates;
		return candidates.filter((candidate) => {
			const haystack = [
				facultyDisplayName(candidate.faculty),
				candidate.faculty.department,
				candidate.faculty.specialization,
				candidate.statusLabel,
			].filter(Boolean).join(' ').toLowerCase();
			return haystack.includes(query);
		});
	}, [candidateQuery, candidates]);

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
		if (disabled) return;
		if (selectedEntryIds.length === 0) return;
		onApplyFaculty(selectedEntryIds, facultyId);
	}

	async function reviewBatch() {
		if (disabled || stagedProposals.length === 0) return null;
		setBatchPreviewLoading(true);
		try {
			const result = await onPreviewFacultyBatch(stagedProposals);
			setBatchPreview(result);
			setSoftWarningAcknowledged(false);
			return result;
		} finally {
			setBatchPreviewLoading(false);
		}
	}

	async function commitBatch() {
		if (disabled || stagedProposals.length === 0) return;
		const reviewed = batchPreview ?? await reviewBatch();
		if (!reviewed || !reviewed.allowed || reviewed.errorCount > 0 || reviewed.hardViolations.length > 0) return;
		if (reviewed.softViolations.length > 0 && !softWarningAcknowledged) return;
		setBatchCommitLoading(true);
		try {
			const result = await onCommitFacultyBatch(stagedProposals, reviewed.softViolations.length > 0 && softWarningAcknowledged);
			if (result) {
				onResetSandbox();
				setBatchPreview(null);
				setSoftWarningAcknowledged(false);
				setBulkEntryIds(new Set());
			}
		} finally {
			setBatchCommitLoading(false);
		}
	}

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="flex max-h-[82svh] flex-col gap-3 overflow-hidden p-4 sm:p-5">
				<SheetHeader className="pr-8">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="h-5 px-2 text-[0.625rem] uppercase">Local Sandbox</Badge>
						<Badge variant="outline" className="h-5 px-2 text-[0.625rem]">Review before saving</Badge>
					</div>
					<SheetTitle>Repair Teacher Assignment</SheetTitle>
					<SheetDescription>
						{selectedEntry
							? disabled
								? `${subjectLabel(selectedEntry.subjectId)} for ${sectionLabel(selectedEntry.sectionId)} is published. Published repairs need the Prompt 6 revision workflow before changes can take effect.`
								: `${subjectLabel(selectedEntry.subjectId)} for ${sectionLabel(selectedEntry.sectionId)} in SY ${schoolYearId ?? 'current'} can be staged, reviewed, and saved to the draft.`
							: 'Select a timetable block to preview local teacher reassignment options.'}
					</SheetDescription>
				</SheetHeader>

				{selectedEntry ? (
					<div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1 md:h-full md:grid-cols-3 md:overflow-hidden md:pr-0">
						<section className="min-w-0 min-h-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
							<div className="space-y-3 text-xs">
								<div>
									<p className="text-xs font-semibold text-muted-foreground">Selected block</p>
									<p className="mt-1 text-base font-semibold text-foreground">{subjectLabel(selectedEntry.subjectId)}</p>
									<p className="text-xs text-muted-foreground">{sectionLabel(selectedEntry.sectionId)} · {selectedEntry.day} {formatTime(selectedEntry.startTime)}-{formatTime(selectedEntry.endTime)}</p>
								</div>
								<div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-background p-2">
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
									<p className="text-[0.625rem] uppercase text-muted-foreground">Current teacher</p>
									<p className="font-medium text-foreground">{selectedEntry.facultyId ? facultyLabel(selectedEntry.facultyId) : 'No teacher assigned'}</p>
								</div>
								{subject ? (
									<div className="rounded border border-border/70 bg-background px-2 py-1.5 text-[0.6875rem] text-muted-foreground">
										Owner: {subject.ownerDepartment ?? subject.allowedOwnerDepartments?.join(', ') ?? 'not set'}
									</div>
								) : null}
							</div>
						</section>

						<section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background md:h-full">
							<div className="space-y-2 border-b border-border/70 px-3 py-2">
								<div>
									<p className="text-sm font-semibold text-foreground">Choose a teacher</p>
									<p className="text-xs text-muted-foreground">Only teachers eligible for this subject are listed. Use search to find a known candidate.</p>
								</div>
								<div className="relative">
									<Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
									<Input
										value={candidateQuery}
										onChange={(event) => setCandidateQuery(event.target.value)}
										placeholder="Search teacher, department, or status"
										className="h-8 pl-8 text-sm"
										aria-label="Search eligible teachers"
									/>
								</div>
							</div>
							<ScrollArea className="h-52 min-h-0 md:h-full md:flex-1">
								<div className="space-y-2 p-3">
									{filteredCandidates.length === 0 ? (
										<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
											No eligible teacher matches this search. Clear the search or pick another block.
										</div>
									) : filteredCandidates.map((candidate) => (
										<div key={candidate.faculty.id} className="min-w-0 rounded-md border border-border/80 bg-card p-3 shadow-sm">
											<div className="flex flex-wrap items-start justify-between gap-2">
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-1.5">
														<p className="truncate text-sm font-semibold text-foreground">{facultyDisplayName(candidate.faculty)}</p>
														{candidate.isCurrent ? <Badge variant="outline" className="h-5 px-1.5 text-[0.625rem]">Current</Badge> : null}
														{candidate.isSelected ? <Badge className="h-5 px-1.5 text-[0.625rem]">Previewed</Badge> : null}
													</div>
													<p className="text-[0.6875rem] text-muted-foreground">{candidate.faculty.department ?? 'Unassigned'}{candidate.faculty.specialization ? ` - ${candidate.faculty.specialization}` : ''}</p>
												</div>
												<Button type="button" size="sm" variant={candidate.isSelected ? 'secondary' : 'outline'} className="h-8 text-xs" disabled={disabled} onClick={() => applyCandidate(candidate.faculty.id)} aria-label={`Use ${facultyDisplayName(candidate.faculty)} for this sandbox repair`}>
													{candidate.isSelected ? 'Selected' : 'Use teacher'}
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

						<section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background md:h-full">
							<div className="border-b border-border/70 px-3 py-2">
								<p className="text-sm font-semibold text-foreground">Optional same-subject blocks</p>
								<p className="text-xs text-muted-foreground">Add only blocks for this same subject and term. {selectedBulkCount} extra block{selectedBulkCount === 1 ? '' : 's'} selected.</p>
							</div>
							<ScrollArea className="h-44 min-h-0 md:h-full md:flex-1">
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

				<div className={`rounded-lg border px-3 py-2 text-xs ${disabled ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
					<div className="flex items-start gap-2">
						{disabled ? <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
						<p>{disabled ? 'This published schedule is read-only here. Use the Prompt 6 revision workflow for effective-date repairs.' : 'Staged changes stay local until you review and save them. Changed blocks are highlighted in the grid; teacher-time conflicts are marked with red borders.'}</p>
					</div>
				</div>

				{stagedCount > 0 ? (
					<div className="rounded-lg border border-border bg-background px-3 py-3 text-xs">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div>
								<p className="text-sm font-semibold text-foreground">Review and save</p>
								<p className="text-xs text-muted-foreground">{stagedCount} teacher change{stagedCount === 1 ? '' : 's'} waiting for review.</p>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{reviewSteps.map((step) => <ReviewStepPill key={step.label} step={step} />)}
							</div>
							{batchPreview ? (
								<Badge variant={canCommitPreview ? 'secondary' : 'destructive'} className="h-5 px-2 text-[0.625rem]">
									{canCommitPreview ? 'Ready to save' : 'Needs changes'}
								</Badge>
							) : null}
						</div>
						<div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
							{draftEntries.filter((entry) => stagedEntryIds.has(entry.entryId)).slice(0, 6).map((entry) => {
								const targetFacultyId = sandboxFacultyByEntryId.get(entry.entryId);
								const rowPreview = batchPreview?.proposals.find((item) => item.entryId === entry.entryId);
								return (
									<div key={entry.entryId} className="rounded border border-border/80 bg-muted/20 px-2 py-1.5">
										<div className="flex items-center justify-between gap-2">
											<span className="truncate font-medium text-foreground">{sectionLabel(entry.sectionId)}</span>
											{rowPreview?.status === 'FAILED' ? <Badge variant="destructive" className="h-4 px-1.5 text-[0.5625rem]">Failed</Badge> : null}
										</div>
										<p className="truncate text-[0.6875rem] text-muted-foreground">{entry.facultyId ? facultyLabel(entry.facultyId) : 'No teacher'} → {targetFacultyId ? facultyLabel(targetFacultyId) : 'No teacher'}</p>
										{rowPreview?.errorMessage ? <p className="mt-1 text-[0.625rem] text-destructive">{rowPreview.errorMessage}</p> : null}
									</div>
								);
							})}
						</div>
						{stagedCount > 6 ? <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">{stagedCount - 6} more staged change{stagedCount - 6 === 1 ? '' : 's'} included in the batch.</p> : null}
						{batchPreview ? (
							<div className={`mt-2 rounded-md border px-2.5 py-2 ${canCommitPreview ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
								<div className="flex items-start gap-1.5">
									{canCommitPreview ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
									<div>
										<p className="font-medium">{reviewStatusCopy(batchPreview, canCommitPreview)}</p>
										<p className="mt-0.5 text-[0.6875rem] opacity-90">Blocking conflicts: {batchPreview.violationDelta.hardAfter}. Warnings to review before publish: {batchPreview.violationDelta.softAfter}.</p>
									</div>
								</div>
								{batchPreview.humanConflicts.slice(0, 2).map((conflict) => (
									<p key={`${conflict.code}-${conflict.humanDetail}`} className="mt-1 text-[0.625rem]">{conflict.humanTitle}: {conflict.humanDetail}</p>
								))}
							</div>
						) : null}
						{requiresSoftWarningAcknowledgement ? (
							<label className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-amber-800">
								<Checkbox
									checked={softWarningAcknowledged}
									onCheckedChange={(checked) => setSoftWarningAcknowledged(checked === true)}
									aria-label="Acknowledge soft warnings before saving sandbox changes"
								/>
									<span>
										<span className="block font-medium">Acknowledge {softWarningCount} soft warning{softWarningCount === 1 ? '' : 's'} before saving</span>
										<span className="block text-[0.6875rem]">The warnings will remain after save. Check this box only if you want to save the batch anyway and review those warnings before publish.</span>
									</span>
							</label>
						) : null}
					</div>
				) : null}

				<SheetFooter className="shrink-0 gap-2 border-t border-border/70 pt-3 sm:space-x-0">
					<Button type="button" variant="outline" size="sm" onClick={() => { onResetSandbox(); setBatchPreview(null); setBulkEntryIds(new Set()); }} disabled={stagedCount === 0} className="gap-1.5">
						<RotateCcw className="size-3.5" />
						Reset Sandbox
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => selectedEntry ? onDismissSelectedEntry(selectedEntry.entryId) : onOpenChange(false)} className="gap-1.5">
						<X className="size-3.5" />
						Close Dock
					</Button>
					<Button type="button" variant={batchPreview && canCommitPreview ? 'default' : 'outline'} size="sm" disabled={disabled || stagedCount === 0 || batchPreviewLoading || batchCommitLoading || (batchPreview != null && canCommitPreview && !canSaveReviewedBatch)} onClick={() => batchPreview && canCommitPreview ? void commitBatch() : void reviewBatch()} className="gap-1.5">
						{batchPreviewLoading || batchCommitLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
						{batchPreview && canCommitPreview ? 'Save Changes' : 'Review Changes'}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}