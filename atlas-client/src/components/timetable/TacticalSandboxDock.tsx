import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import atlasApi from '@/lib/api';
import {
	MAX_WEEKLY_TEACHING_HOURS,
	deriveWorkloadCapacity,
	matchesOwnershipDepartment,
} from '@/lib/faculty-assignment-helpers';
import { formatTime } from '@/lib/utils';
import type { CommitResult, FacultyMirror, ManualEditBatchPreviewResult, ManualEditProposal, ScheduledEntry, Subject, TeachingLoadRepairPreviewResult } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/ui/dialog';
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
import { Textarea } from '@/ui/textarea';

type TacticalSandboxDockProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedEntry: ScheduledEntry | null;
	draftEntries: ScheduledEntry[];
	schoolId: number;
	runId: number | null;
	facultyMap: Map<number, FacultyMirror>;
	subjectMap: Map<number, Subject>;
	schoolYearId: number | null;
	sandboxFacultyByEntryId: Map<string, number>;
	onApplyFaculty: (entryIds: string[], facultyId: number) => void;
	onPreviewFacultyBatch: (proposals: ManualEditProposal[]) => Promise<TeachingLoadRepairPreviewResult | null>;
	onCommitFacultyBatch: (proposals: ManualEditProposal[], allowSoftOverride?: boolean) => Promise<CommitResult | null>;
	onRevisionCreated: () => void | Promise<void>;
	onResetSandbox: () => void;
	onDismissSelectedEntry: (entryId: string) => void;
	isPublished: boolean;
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

type RevisionChange = {
	entry: ScheduledEntry;
	targetFacultyId: number;
	targetCapacity: ReturnType<typeof deriveWorkloadCapacity> | null;
};

type PublishedRevisionResponse = {
	revision: {
		id: number;
		effectiveDate: string;
		status: string;
	};
	auditId: number;
};

type RevisionSuccess = {
	revisionId: number;
	effectiveDate: string;
	changeCount: number;
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
	if (!preview) return 'Preview checks teacher conflicts and Teaching Load impact before save.';
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

function findCanonicalOwner(entry: ScheduledEntry | null, facultyMap: Map<number, FacultyMirror>): FacultyMirror | null {
	if (!entry) return null;
	for (const faculty of facultyMap.values()) {
		const ownsEntry = (faculty.facultySubjects ?? []).some((assignment) =>
			assignment.subjectId === entry.subjectId && (assignment.sectionIds ?? []).includes(entry.sectionId),
		);
		if (ownsEntry) return faculty;
	}
	return null;
}

function buildTeachingLoadRepairProposals(
	entries: ScheduledEntry[],
	proposals: ManualEditProposal[],
	canonicalOnlyTargets: Map<string, number>,
): ManualEditProposal[] {
	const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
	const stagedEntryIds = new Set<string>();
	const changes: ManualEditProposal[] = [...proposals];

	for (const proposal of proposals) {
		if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') continue;
		stagedEntryIds.add(proposal.entryId);
	}

	for (const [entryId, targetFacultyId] of canonicalOnlyTargets.entries()) {
		if (stagedEntryIds.has(entryId)) continue;
		const entry = entriesById.get(entryId);
		if (!entry || entry.facultyId == null || entry.facultyId !== targetFacultyId) continue;
		changes.push({
			editType: 'CHANGE_FACULTY',
			entryId,
			targetFacultyId,
		});
	}

	return changes;
}

function formatSlot(entry: ScheduledEntry): string {
	return `${entry.day} ${formatTime(entry.startTime)}-${formatTime(entry.endTime)}`;
}

function revisionDateError(value: string): string | null {
	if (!value.trim()) return 'Choose the first school day when this revision should take effect.';
	const parsed = new Date(`${value}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return 'Enter a valid effective date.';

	const now = new Date();
	const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const selectedUtc = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
	if (selectedUtc <= todayUtc) return 'Choose tomorrow or a later school day. Same-day published revisions are not allowed.';
	return null;
}

function buildRevisionPayloadChange(change: RevisionChange) {
	const previous = {
		facultyId: change.entry.facultyId,
		roomId: change.entry.roomId,
		day: change.entry.day,
		startTime: change.entry.startTime,
		endTime: change.entry.endTime,
		subjectId: change.entry.subjectId,
		sectionId: change.entry.sectionId,
	};
	return {
		entryId: change.entry.entryId,
		changeType: 'CHANGE_FACULTY',
		previous,
		next: {
			...previous,
			facultyId: change.targetFacultyId,
		},
	};
}

export function TacticalSandboxDock({
	open,
	onOpenChange,
	selectedEntry,
	draftEntries,
	schoolId,
	runId,
	facultyMap,
	subjectMap,
	schoolYearId,
	sandboxFacultyByEntryId,
	onApplyFaculty,
	onPreviewFacultyBatch,
	onCommitFacultyBatch,
	onRevisionCreated,
	onResetSandbox,
	onDismissSelectedEntry,
	isPublished,
	subjectLabel,
	sectionLabel,
	facultyLabel,
}: TacticalSandboxDockProps) {
	const [bulkEntryIds, setBulkEntryIds] = useState<Set<string>>(new Set());
	const [canonicalOnlyTargets, setCanonicalOnlyTargets] = useState<Map<string, number>>(new Map());
	const [batchPreview, setBatchPreview] = useState<TeachingLoadRepairPreviewResult | null>(null);
	const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
	const [batchCommitLoading, setBatchCommitLoading] = useState(false);
	const [softWarningAcknowledged, setSoftWarningAcknowledged] = useState(false);
	const [candidateQuery, setCandidateQuery] = useState('');
	const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
	const [revisionEffectiveDate, setRevisionEffectiveDate] = useState('');
	const [revisionReason, setRevisionReason] = useState('');
	const [revisionSubmitting, setRevisionSubmitting] = useState(false);
	const [revisionError, setRevisionError] = useState<string | null>(null);
	const [revisionActionHint, setRevisionActionHint] = useState<string | null>(null);
	const [revisionSuccess, setRevisionSuccess] = useState<RevisionSuccess | null>(null);
	const subject = selectedEntry ? subjectMap.get(selectedEntry.subjectId) : undefined;
	const previewFacultyId = selectedEntry ? sandboxFacultyByEntryId.get(selectedEntry.entryId) ?? selectedEntry.facultyId : null;
	const canonicalOwner = useMemo(() => findCanonicalOwner(selectedEntry, facultyMap), [facultyMap, selectedEntry]);
	const canonicalOwnerMismatch = Boolean(selectedEntry && canonicalOwner && canonicalOwner.id !== selectedEntry.facultyId);
	const stagedProposals = useMemo(() => buildFacultyChangeProposals(draftEntries, sandboxFacultyByEntryId), [draftEntries, sandboxFacultyByEntryId]);
	const teachingLoadRepairProposals = useMemo(() => buildTeachingLoadRepairProposals(draftEntries, stagedProposals, canonicalOnlyTargets), [canonicalOnlyTargets, draftEntries, stagedProposals]);
	const stagedProposalKey = useMemo(() => JSON.stringify({ stagedProposals, teachingLoadRepairProposals }), [stagedProposals, teachingLoadRepairProposals]);
	const stagedEntryIds = useMemo(() => new Set([
		...(isPublished ? stagedProposals : teachingLoadRepairProposals).map((proposal) => proposal.entryId).filter((entryId): entryId is string => Boolean(entryId)),
	]), [isPublished, stagedProposals, teachingLoadRepairProposals]);
	const stagedCount = isPublished ? stagedProposals.length : teachingLoadRepairProposals.length;
	const canCommitPreview = Boolean(batchPreview?.allowed && batchPreview.errorCount === 0 && batchPreview.hardViolations.length === 0);
	const softWarningCount = batchPreview?.softViolations.length ?? 0;
	const requiresSoftWarningAcknowledgement = canCommitPreview && softWarningCount > 0;
	const canSaveReviewedBatch = canCommitPreview && (!requiresSoftWarningAcknowledgement || softWarningAcknowledged);
	const reviewSteps: ReviewStep[] = useMemo(() => ([
		{ label: '1 Select teacher', state: stagedCount > 0 ? 'done' : 'active' },
		{ label: '2 Review changes', state: batchPreview ? (canCommitPreview ? 'done' : 'blocked') : stagedCount > 0 ? 'active' : 'waiting' },
		{ label: isPublished ? '3 Create revision' : '3 Save Teaching Load', state: batchPreview ? (canSaveReviewedBatch ? 'active' : canCommitPreview ? 'waiting' : 'blocked') : 'waiting' },
	]), [batchPreview, canCommitPreview, canSaveReviewedBatch, isPublished, stagedCount]);

	useEffect(() => {
		setBatchPreview(null);
		setSoftWarningAcknowledged(false);
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
	}, [stagedProposalKey]);

	useEffect(() => {
		setCandidateQuery('');
		setCanonicalOnlyTargets(new Map());
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
	const revisionChanges = useMemo<RevisionChange[]>(() => {
		const entriesById = new Map(draftEntries.map((entry) => [entry.entryId, entry]));
		const projectedEntries = draftEntries.map((entry) => {
			const facultyId = sandboxFacultyByEntryId.get(entry.entryId);
			return facultyId == null ? entry : { ...entry, facultyId };
		});
		const targetIds = new Set(stagedProposals.map((proposal) => proposal.targetFacultyId).filter((id): id is number => typeof id === 'number'));
		const capacityByFaculty = new Map<number, ReturnType<typeof deriveWorkloadCapacity>>();

		for (const facultyId of targetIds) {
			const faculty = facultyMap.get(facultyId);
			if (!faculty) continue;
			const teachingHours = teachingHoursForFaculty(projectedEntries, facultyId);
			const creditHours = Math.max(faculty.advisoryEquivalentHours ?? 0, 0) + ancillaryCreditHours(faculty);
			capacityByFaculty.set(facultyId, deriveWorkloadCapacity(teachingHours, creditHours, faculty.maxHoursPerWeek || MAX_WEEKLY_TEACHING_HOURS));
		}

		return stagedProposals.flatMap((proposal) => {
			if (proposal.editType !== 'CHANGE_FACULTY' || !proposal.entryId || typeof proposal.targetFacultyId !== 'number') return [];
			const entry = entriesById.get(proposal.entryId);
			if (!entry) return [];
			return [{ entry, targetFacultyId: proposal.targetFacultyId, targetCapacity: capacityByFaculty.get(proposal.targetFacultyId) ?? null }];
		});
	}, [draftEntries, facultyMap, sandboxFacultyByEntryId, stagedProposals]);
	const aboveStandardWarnings = useMemo(() => revisionChanges.filter((change) => change.targetCapacity?.status === 'overload-allowed'), [revisionChanges]);
	const overCapWarnings = useMemo(() => revisionChanges.filter((change) => change.targetCapacity?.status === 'over-cap'), [revisionChanges]);
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
		setCanonicalOnlyTargets((previous) => {
			const next = new Map(previous);
			for (const entryId of selectedEntryIds) next.delete(entryId);
			return next;
		});
		onApplyFaculty(selectedEntryIds, facultyId);
	}

	function useTimetableTeacherAsTeachingLoadOwner() {
		if (!selectedEntry?.facultyId) return;
		setCanonicalOnlyTargets((previous) => {
			const next = new Map(previous);
			next.set(selectedEntry.entryId, selectedEntry.facultyId as number);
			return next;
		});
	}

	async function reviewBatch() {
		if (isPublished || teachingLoadRepairProposals.length === 0) return null;
		setBatchPreviewLoading(true);
		try {
			const result = await onPreviewFacultyBatch(teachingLoadRepairProposals);
			setBatchPreview(result);
			setSoftWarningAcknowledged(false);
			return result;
		} finally {
			setBatchPreviewLoading(false);
		}
	}

	async function commitBatch() {
		if (isPublished || teachingLoadRepairProposals.length === 0) return;
		const reviewed = batchPreview ?? await reviewBatch();
		if (!reviewed || !reviewed.allowed || reviewed.errorCount > 0 || reviewed.hardViolations.length > 0) return;
		if (reviewed.softViolations.length > 0 && !softWarningAcknowledged) return;
		setBatchCommitLoading(true);
		try {
			const result = await onCommitFacultyBatch(teachingLoadRepairProposals, reviewed.softViolations.length > 0 && softWarningAcknowledged);
			if (result) {
				onResetSandbox();
				setCanonicalOnlyTargets(new Map());
				setBatchPreview(null);
				setSoftWarningAcknowledged(false);
				setBulkEntryIds(new Set());
			}
		} finally {
			setBatchCommitLoading(false);
		}
	}

	function openRevisionReview() {
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
		setRevisionDialogOpen(true);
	}

	async function submitRevision() {
		if (!schoolYearId || !runId) {
			setRevisionError('This published schedule is missing a school year or run reference. Refresh the timetable, then try again.');
			setRevisionActionHint('If the run still has no reference after refresh, ask an administrator to verify the published run.');
			return;
		}
		if (revisionChanges.length === 0) {
			setRevisionError('No staged teacher changes are ready for revision. Choose a teacher first, then review again.');
			setRevisionActionHint(null);
			return;
		}
		const dateError = revisionDateError(revisionEffectiveDate);
		if (dateError) {
			setRevisionError(dateError);
			setRevisionActionHint('The current published schedule stays active until the future effective date you choose.');
			return;
		}
		const reason = revisionReason.trim();
		if (!reason) {
			setRevisionError('Add a reason so the audit trail explains why this published schedule changed.');
			setRevisionActionHint('Use a short note such as teacher reassignment, room availability, or corrected staffing record.');
			return;
		}

		setRevisionSubmitting(true);
		setRevisionError(null);
		setRevisionActionHint(null);
		try {
			const { data } = await atlasApi.post<PublishedRevisionResponse>(`/generation/${schoolId}/${schoolYearId}/runs/${runId}/published-revisions`, {
				effectiveDate: revisionEffectiveDate,
				reason,
				changes: revisionChanges.map(buildRevisionPayloadChange),
				changeSummary: {
					changeCount: revisionChanges.length,
					entryIds: revisionChanges.map((change) => change.entry.entryId),
					changeTypes: ['CHANGE_FACULTY'],
				},
				metadata: {
					source: 'TACTICAL_SANDBOX_DOCK',
					schoolYearId,
					sourceRunId: runId,
					publishedTruthPreserved: true,
				},
			});
			setRevisionSuccess({
				revisionId: data.revision.id,
				effectiveDate: data.revision.effectiveDate,
				changeCount: revisionChanges.length,
			});
			toast.success(`Revision scheduled for ${revisionEffectiveDate}. Published history is preserved.`);
			onResetSandbox();
			setBatchPreview(null);
			setSoftWarningAcknowledged(false);
			setBulkEntryIds(new Set());
			await onRevisionCreated();
		} catch (e: unknown) {
			const response = (e as { response?: { data?: { message?: string; actionHint?: string; code?: string } } })?.response?.data;
			setRevisionError(response?.message ?? (e instanceof Error ? e.message : 'Revision creation failed.'));
			setRevisionActionHint(response?.actionHint ?? 'Check the effective date and reason, then try creating the revision again.');
		} finally {
			setRevisionSubmitting(false);
		}
	}

	return (
		<>
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="bottom" className="flex max-h-[82svh] flex-col gap-3 overflow-hidden p-4 sm:p-5">
				<SheetHeader className="pr-8">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="secondary" className="h-5 px-2 text-[0.625rem] uppercase">Local Sandbox</Badge>
						<Badge variant="outline" className="h-5 px-2 text-[0.625rem]">{isPublished ? 'Published revision' : 'Review before saving'}</Badge>
					</div>
					<SheetTitle>Repair Teacher Assignment</SheetTitle>
					<SheetDescription>
						{selectedEntry
							? isPublished
								? `${subjectLabel(selectedEntry.subjectId)} for ${sectionLabel(selectedEntry.sectionId)} is published. Create an effective-date revision for the timetable; Teaching Load will not be rewritten from this published repair.`
								: `${subjectLabel(selectedEntry.subjectId)} for ${sectionLabel(selectedEntry.sectionId)} in SY ${schoolYearId ?? 'current'} can be reviewed, saved to Teaching Load, and reflected in this timetable.`
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
								<div>
									<p className="text-[0.625rem] uppercase text-muted-foreground">Teaching Load owner</p>
									<p className="font-medium text-foreground">{canonicalOwner ? facultyDisplayName(canonicalOwner) : 'No saved owner'}</p>
								</div>
								{canonicalOwnerMismatch ? (
									<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
										<div className="flex items-start gap-2">
											<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
											<div className="min-w-0">
												<p className="font-semibold">Timetable and Teaching Load do not match</p>
												<p className="mt-0.5 text-[0.6875rem]">Choose which source should drive this class before saving.</p>
												<div className="mt-2 flex flex-wrap gap-1.5">
													<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-[0.6875rem]" onClick={useTimetableTeacherAsTeachingLoadOwner} disabled={isPublished || !selectedEntry.facultyId}>
														Use timetable teacher
													</Button>
													<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-[0.6875rem]" onClick={() => canonicalOwner ? applyCandidate(canonicalOwner.id) : undefined} disabled={!canonicalOwner}>
														Use Teaching Load owner
													</Button>
												</div>
												{isPublished ? <p className="mt-1 text-[0.625rem]">Published repairs use revisions only.</p> : null}
											</div>
										</div>
									</div>
								) : null}
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
												<Button type="button" size="sm" variant={candidate.isSelected ? 'secondary' : 'outline'} className="h-8 text-xs" onClick={() => applyCandidate(candidate.faculty.id)} aria-label={`Use ${facultyDisplayName(candidate.faculty)} for this sandbox repair`}>
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

				<div className={`rounded-lg border px-3 py-2 text-xs ${isPublished ? 'border-primary/20 bg-primary/5 text-primary' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
					<div className="flex items-start gap-2">
						{isPublished ? <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
						<p>{isPublished ? 'This schedule is already published. Create an effective-date revision for the timetable. Teaching Load will not be rewritten from this published repair.' : 'Staged changes stay local until you preview impact. Saving updates Teaching Load ownership and this generated timetable together.'}</p>
					</div>
				</div>

				{stagedCount > 0 ? (
					<div className="rounded-lg border border-border bg-background px-3 py-3 text-xs">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div>
								<p className="text-sm font-semibold text-foreground">{isPublished ? 'Review and create revision' : 'Review and save Teaching Load'}</p>
								<p className="text-xs text-muted-foreground">{stagedCount} teacher change{stagedCount === 1 ? '' : 's'} waiting for {isPublished ? 'an effective date' : 'impact preview'}.</p>
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
								const targetFacultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? canonicalOnlyTargets.get(entry.entryId);
								const rowPreview = batchPreview?.proposals.find((item) => item.entryId === entry.entryId);
								return (
									<div key={entry.entryId} className="rounded border border-border/80 bg-muted/20 px-2 py-1.5">
										<div className="flex items-center justify-between gap-2">
											<span className="truncate font-medium text-foreground">{sectionLabel(entry.sectionId)}</span>
											{rowPreview?.status === 'FAILED' ? <Badge variant="destructive" className="h-4 px-1.5 text-[0.5625rem]">Failed</Badge> : null}
										</div>
										<p className="truncate text-[0.6875rem] text-muted-foreground">{entry.facultyId ? facultyLabel(entry.facultyId) : 'No teacher'} -&gt; {targetFacultyId ? facultyLabel(targetFacultyId) : 'No teacher'}</p>
										{canonicalOnlyTargets.has(entry.entryId) ? <p className="mt-0.5 text-[0.625rem] text-amber-700">Teaching Load owner will be updated.</p> : null}
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
										<p className="mt-0.5 text-[0.6875rem] opacity-90">Teaching Load transfers: {batchPreview.ownershipDeltas.filter((delta) => delta.ownershipAction === 'TRANSFER').length}.</p>
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
					<Button type="button" variant="outline" size="sm" onClick={() => { onResetSandbox(); setCanonicalOnlyTargets(new Map()); setBatchPreview(null); setBulkEntryIds(new Set()); }} disabled={stagedCount === 0} className="gap-1.5">
						<RotateCcw className="size-3.5" />
						Reset Sandbox
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => selectedEntry ? onDismissSelectedEntry(selectedEntry.entryId) : onOpenChange(false)} className="gap-1.5">
						<X className="size-3.5" />
						Close Dock
					</Button>
					<Button type="button" variant={(isPublished || (batchPreview && canCommitPreview)) ? 'default' : 'outline'} size="sm" disabled={stagedCount === 0 || batchPreviewLoading || batchCommitLoading || (batchPreview != null && canCommitPreview && !canSaveReviewedBatch)} onClick={() => isPublished ? openRevisionReview() : batchPreview && canCommitPreview ? void commitBatch() : void reviewBatch()} className="gap-1.5">
						{batchPreviewLoading || batchCommitLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
						{isPublished ? 'Create Revision' : batchPreview && canCommitPreview ? 'Save Teaching Load and update timetable' : 'Preview impact'}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
		<Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
			<DialogContent className="max-w-3xl gap-0 p-0">
				<DialogHeader className="border-b border-border px-5 py-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge className="h-5 px-2 text-[0.625rem]">Published Revision</Badge>
						<Badge variant="outline" className="h-5 px-2 text-[0.625rem]">History preserved</Badge>
					</div>
					<DialogTitle>Schedule a published repair</DialogTitle>
					<DialogDescription>
						Choose when these teacher changes take effect. Earlier dates will still show the original published schedule.
					</DialogDescription>
				</DialogHeader>
				<div className="grid max-h-[70vh] gap-4 overflow-y-auto px-5 py-4">
					{revisionSuccess ? (
						<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
							<div className="flex items-start gap-2">
								<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="font-semibold">Revision #{revisionSuccess.revisionId} is scheduled.</p>
									<p className="mt-0.5 text-xs">{revisionSuccess.changeCount} change{revisionSuccess.changeCount === 1 ? '' : 's'} take effect on {new Date(revisionSuccess.effectiveDate).toLocaleDateString()}. The timetable is refreshed, and historical reads before that date still use the original published run.</p>
								</div>
							</div>
						</div>
					) : null}
					<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
						<div className="flex items-start gap-2">
							<ShieldCheck className="mt-0.5 size-4 shrink-0" />
							<p>This creates a future-dated revision record. It does not overwrite the published run that families and teachers may already have viewed.</p>
						</div>
					</div>
					<div className="grid gap-2">
						<div>
							<p className="text-sm font-semibold text-foreground">Changed classes</p>
							<p className="text-xs text-muted-foreground">Review the before and after teacher, room, and time before choosing an effective date.</p>
						</div>
						<div className="grid gap-2">
							{revisionChanges.map((change) => (
								<div key={change.entry.entryId} className="rounded-lg border border-border bg-card p-3 text-xs">
									<div className="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p className="text-sm font-semibold text-foreground">{subjectLabel(change.entry.subjectId)}</p>
											<p className="text-muted-foreground">{sectionLabel(change.entry.sectionId)} · {formatSlot(change.entry)}</p>
										</div>
										{change.targetCapacity ? <Badge variant="outline" className="h-5 px-2 text-[0.625rem]">{change.targetCapacity.statusLabel}</Badge> : null}
									</div>
									<div className="mt-3 grid gap-2 sm:grid-cols-2">
										<div className="rounded-md border border-border/70 bg-muted/20 p-2">
											<p className="text-[0.625rem] uppercase text-muted-foreground">Current published</p>
											<p className="font-medium text-foreground">{change.entry.facultyId ? facultyLabel(change.entry.facultyId) : 'No teacher assigned'}</p>
											<p className="text-muted-foreground">Room {change.entry.roomId} · {formatSlot(change.entry)}</p>
										</div>
										<div className="rounded-md border border-primary/20 bg-primary/5 p-2">
											<p className="text-[0.625rem] uppercase text-primary/80">Revision after effective date</p>
											<p className="font-medium text-foreground">{facultyLabel(change.targetFacultyId)}</p>
											<p className="text-muted-foreground">Room {change.entry.roomId} · {formatSlot(change.entry)}</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
					{aboveStandardWarnings.length > 0 || overCapWarnings.length > 0 ? (
						<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="font-semibold">Above-standard load warning</p>
									<p className="mt-0.5">{aboveStandardWarnings.length} change{aboveStandardWarnings.length === 1 ? '' : 's'} will place a teacher at Above standard - approval needed. This records the revision only; it does not create an approval workflow.</p>
									{overCapWarnings.length > 0 ? <p className="mt-1 text-red-700">{overCapWarnings.length} change{overCapWarnings.length === 1 ? '' : 's'} may be over cap. Review staffing before choosing this effective date.</p> : null}
								</div>
							</div>
						</div>
					) : null}
					<div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
						<div className="space-y-1.5">
							<label htmlFor="published-revision-effective-date" className="text-sm font-medium text-foreground">Effective date</label>
							<Input
								id="published-revision-effective-date"
								type="date"
								value={revisionEffectiveDate}
								onChange={(event) => setRevisionEffectiveDate(event.target.value)}
								aria-describedby="published-revision-effective-date-help"
							/>
							<p id="published-revision-effective-date-help" className="text-xs text-muted-foreground">Choose tomorrow or a later school day.</p>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="published-revision-reason" className="text-sm font-medium text-foreground">Reason</label>
							<Textarea
								id="published-revision-reason"
								value={revisionReason}
								onChange={(event) => setRevisionReason(event.target.value)}
								placeholder="Example: teacher reassignment for the next school week"
								maxLength={500}
								aria-describedby="published-revision-reason-help"
							/>
							<p id="published-revision-reason-help" className="text-xs text-muted-foreground">This note appears in the revision audit trail.</p>
						</div>
					</div>
					{revisionError ? (
						<div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
							<div className="flex items-start gap-2">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<div>
									<p className="font-semibold">Revision was not created.</p>
									<p className="mt-0.5 text-xs">{revisionError}</p>
									{revisionActionHint ? <p className="mt-1 text-xs">{revisionActionHint}</p> : null}
								</div>
							</div>
						</div>
					) : null}
				</div>
				<DialogFooter className="border-t border-border px-5 py-4">
					<Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)} disabled={revisionSubmitting}>Close</Button>
					<Button type="button" onClick={() => void submitRevision()} disabled={revisionSubmitting || revisionChanges.length === 0 || Boolean(revisionSuccess)} className="gap-2">
						{revisionSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
						Create Published Revision
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
		</>
	);
}
