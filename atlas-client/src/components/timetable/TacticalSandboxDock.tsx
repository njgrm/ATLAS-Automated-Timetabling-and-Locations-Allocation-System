import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Search, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import atlasApi from '@/lib/api';
import { buildUnassignedKey } from '@/lib/timetable-utils';
import {
	MAX_WEEKLY_TEACHING_HOURS,
	deriveWorkloadCapacity,
} from '@/lib/faculty-assignment-helpers';
import { formatTime } from '@/lib/utils';
import type { CommitResult, FacultyMirror, ManualEditProposal, ScheduledEntry, Subject, TeachingLoadRepairChange, TeachingLoadRepairPreviewResult, UnassignedItem } from '@/types';
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
import {
	ancillaryCreditHours,
	buildEntryRepairChanges,
	buildFacultyChangeProposals,
	buildRevisionPayloadChange,
	buildTeachingLoadRepairProposals,
	compactLoadStatus,
	facultyDisplayName,
	findCanonicalOwner,
	formatHours,
	isEligibleFaculty,
	previewErrorCopy,
	projectEntryFaculty,
	revisionDateError,
	reviewStatusCopy,
	teachingHoursForFaculty,
} from './TacticalSandboxDock.helpers';
import { PublishedRevisionDialog } from './PublishedRevisionDialog';

type TacticalSandboxDockProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedEntry: ScheduledEntry | null;
	selectedUnassigned: UnassignedItem | null;
	draftEntries: ScheduledEntry[];
	schoolId: number;
	runId: number | null;
	facultyMap: Map<number, FacultyMirror>;
	subjectMap: Map<number, Subject>;
	roomMap?: Map<number, any>;
	schoolYearId: number | null;
	sandboxFacultyByEntryId: Map<string, number>;
	onApplyFaculty: (entryIds: string[], facultyId: number) => void;
	onPreviewTeachingLoadRepair: (changes: TeachingLoadRepairChange[], placementProposal?: ManualEditProposal) => Promise<TeachingLoadRepairPreviewResult | null>;
	onCommitTeachingLoadRepair: (changes: TeachingLoadRepairChange[], allowSoftOverride?: boolean, placementProposal?: ManualEditProposal) => Promise<CommitResult | null>;
	onRevisionCreated: () => void | Promise<void>;
	onResetSandbox: () => void;
	onDismissSelectedEntry: (entryId: string) => void;
	onDismissSelectedUnassigned: () => void;
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

export function TacticalSandboxDock({
	open,
	onOpenChange,
	selectedEntry,
	selectedUnassigned,
	draftEntries,
	schoolId,
	runId,
	facultyMap,
	subjectMap,
	roomMap,
	schoolYearId,
	sandboxFacultyByEntryId,
	onApplyFaculty,
	onPreviewTeachingLoadRepair,
	onCommitTeachingLoadRepair,
	onRevisionCreated,
	onResetSandbox,
	onDismissSelectedEntry,
	onDismissSelectedUnassigned,
	isPublished,
	subjectLabel,
	sectionLabel,
	facultyLabel,
}: TacticalSandboxDockProps) {
	const [bulkEntryIds, setBulkEntryIds] = useState<Set<string>>(new Set());
	const [canonicalOnlyTargets, setCanonicalOnlyTargets] = useState<Map<string, number>>(new Map());
	const [batchPreview, setBatchPreview] = useState<TeachingLoadRepairPreviewResult | null>(null);
	const [batchPreviewError, setBatchPreviewError] = useState<string | null>(null);
	const [batchPreviewLoading, setBatchPreviewLoading] = useState(false);
	const [batchCommitLoading, setBatchCommitLoading] = useState(false);
	const [softWarningAcknowledged, setSoftWarningAcknowledged] = useState(false);
	const [candidateQuery, setCandidateQuery] = useState('');
	const [showWorkloadDetails, setShowWorkloadDetails] = useState(false);
	const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
	const [revisionEffectiveDate, setRevisionEffectiveDate] = useState('');
	const [revisionReason, setRevisionReason] = useState('');
	const [revisionSubmitting, setRevisionSubmitting] = useState(false);
	const [revisionError, setRevisionError] = useState<string | null>(null);
	const [revisionActionHint, setRevisionActionHint] = useState<string | null>(null);
	const [revisionSuccess, setRevisionSuccess] = useState<RevisionSuccess | null>(null);
	const [unassignedTargetFacultyId, setUnassignedTargetFacultyId] = useState<number | null>(null);
	const [selectedPlacementProposal, setSelectedPlacementProposal] = useState<ManualEditProposal | null>(null);
	const activeSubjectId = selectedEntry?.subjectId ?? selectedUnassigned?.subjectId ?? null;
	const activeSectionId = selectedEntry?.sectionId ?? selectedUnassigned?.sectionId ?? null;
	const subject = activeSubjectId ? subjectMap.get(activeSubjectId) : undefined;
	const canonicalOwner = useMemo(() => findCanonicalOwner(activeSubjectId, activeSectionId, facultyMap), [activeSectionId, activeSubjectId, facultyMap]);
	const unassignedKey = selectedUnassigned ? buildUnassignedKey(selectedUnassigned) : null;
	const activeContextEntry = useMemo<ScheduledEntry | null>(() => {
		if (selectedEntry) return selectedEntry;
		if (!selectedUnassigned || !unassignedKey) return null;
		return {
			entryId: `unassigned-${unassignedKey}`,
			facultyId: canonicalOwner?.id ?? null,
			roomId: selectedUnassigned.homeRoomId ?? 0,
			subjectId: selectedUnassigned.subjectId,
			sectionId: selectedUnassigned.sectionId,
			day: 'UNASSIGNED',
			startTime: '00:00',
			endTime: '00:00',
			durationMinutes: 0,
			entryKind: selectedUnassigned.entryKind ?? 'SECTION',
			programType: selectedUnassigned.programType ?? null,
			programCode: selectedUnassigned.programCode ?? null,
			programName: selectedUnassigned.programName ?? null,
			cohortCode: selectedUnassigned.cohortCode ?? null,
			cohortName: selectedUnassigned.cohortName ?? null,
			cohortMemberSectionIds: selectedUnassigned.cohortMemberSectionIds,
			cohortExpectedEnrollment: selectedUnassigned.cohortExpectedEnrollment ?? null,
			adviserId: selectedUnassigned.adviserId ?? null,
			adviserName: selectedUnassigned.adviserName ?? null,
		};
	}, [canonicalOwner?.id, selectedEntry, selectedUnassigned, unassignedKey]);
	const previewFacultyId = selectedEntry ? sandboxFacultyByEntryId.get(selectedEntry.entryId) ?? selectedEntry.facultyId : unassignedTargetFacultyId ?? canonicalOwner?.id ?? null;
	const canonicalOwnerMismatch = Boolean(selectedEntry && canonicalOwner && canonicalOwner.id !== selectedEntry.facultyId);
	const stagedProposals = useMemo(() => buildFacultyChangeProposals(draftEntries, sandboxFacultyByEntryId), [draftEntries, sandboxFacultyByEntryId]);
	const teachingLoadRepairProposals = useMemo(() => buildTeachingLoadRepairProposals(draftEntries, stagedProposals, canonicalOnlyTargets), [canonicalOnlyTargets, draftEntries, stagedProposals]);
	const unassignedRepairChange = useMemo<TeachingLoadRepairChange | null>(() => {
		if (!selectedUnassigned || !unassignedKey) return null;
		const targetFacultyId = unassignedTargetFacultyId ?? canonicalOwner?.id ?? null;
		if (!targetFacultyId) return null;
		return {
			kind: 'UNASSIGNED',
			unassignedKey,
			subjectId: selectedUnassigned.subjectId,
			sectionId: selectedUnassigned.sectionId,
			session: selectedUnassigned.session,
			entryKind: selectedUnassigned.entryKind ?? 'SECTION',
			cohortCode: selectedUnassigned.cohortCode ?? null,
			fromFacultyId: canonicalOwner?.id ?? null,
			toFacultyId: targetFacultyId,
		};
	}, [canonicalOwner?.id, selectedUnassigned, unassignedKey, unassignedTargetFacultyId]);
	const repairChanges = useMemo(
		() => selectedUnassigned && unassignedRepairChange
			? [unassignedRepairChange]
			: buildEntryRepairChanges(draftEntries, stagedProposals, canonicalOnlyTargets),
		[canonicalOnlyTargets, draftEntries, selectedUnassigned, stagedProposals, unassignedRepairChange],
	);
	const stagedProposalKey = useMemo(() => JSON.stringify({ stagedProposals, teachingLoadRepairProposals, repairChanges }), [stagedProposals, teachingLoadRepairProposals, repairChanges]);
	const stagedEntryIds = useMemo(() => new Set([
		...(isPublished ? stagedProposals : teachingLoadRepairProposals).map((proposal) => proposal.entryId).filter((entryId): entryId is string => Boolean(entryId)),
	]), [isPublished, stagedProposals, teachingLoadRepairProposals]);
	const stagedCount = selectedUnassigned ? repairChanges.length : isPublished ? stagedProposals.length : teachingLoadRepairProposals.length;
	const unassignedOwnerChanged = Boolean(
		selectedUnassigned
		&& unassignedRepairChange
		&& canonicalOwner?.id !== unassignedRepairChange.toFacultyId,
	);
	const canCommitPreview = Boolean(batchPreview?.allowed && batchPreview.errorCount === 0 && batchPreview.hardViolations.length === 0);
	const softWarningCount = batchPreview?.softViolations.length ?? 0;
	const requiresSoftWarningAcknowledgement = canCommitPreview && softWarningCount > 0;
	const canSaveReviewedBatch = canCommitPreview && (!requiresSoftWarningAcknowledgement || softWarningAcknowledged);
	const hasStagedChanges = selectedUnassigned
		? (repairChanges.length > 0 || selectedPlacementProposal !== null)
		: stagedCount > 0;
	const reviewSteps: ReviewStep[] = useMemo(() => ([
		{ label: '1 Current teacher', state: activeContextEntry ? 'done' : 'active' },
		{ label: '2 Choose teacher', state: hasStagedChanges ? 'done' : activeContextEntry ? 'active' : 'waiting' },
		{ label: isPublished ? '3 Create revision' : '3 Preview and save', state: batchPreview ? (canSaveReviewedBatch ? 'active' : canCommitPreview ? 'waiting' : 'blocked') : hasStagedChanges ? 'active' : 'waiting' },
	]), [activeContextEntry, batchPreview, canCommitPreview, canSaveReviewedBatch, isPublished, hasStagedChanges]);

	useEffect(() => {
		setBatchPreview(null);
		setBatchPreviewError(null);
		setSoftWarningAcknowledged(false);
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
	}, [stagedProposalKey]);

	useEffect(() => {
		setCandidateQuery('');
		setCanonicalOnlyTargets(new Map());
		setUnassignedTargetFacultyId(null);
		setSelectedPlacementProposal(null);
	}, [selectedEntry?.entryId, unassignedKey]);

	useEffect(() => {
		if (selectedUnassigned && previewFacultyId) {
			void reviewBatch();
		}
	}, [previewFacultyId, unassignedKey]);

	const scopedSameSubjectEntries = useMemo(() => {
		if (!selectedEntry || selectedUnassigned) return [];
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
	}, [draftEntries, selectedEntry, selectedUnassigned, sectionLabel]);

	const candidates = useMemo<Candidate[]>(() => {
		if (!activeContextEntry) return [];
		return Array.from(facultyMap.values())
			.filter((faculty) => isEligibleFaculty(faculty, subject, activeContextEntry))
			.map((faculty) => {
				const candidateProjectedEntries = selectedUnassigned
					? draftEntries
					: draftEntries.map((entry) => projectEntryFaculty(
						entry,
						sandboxFacultyByEntryId,
						activeContextEntry.entryId,
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
					isCurrent: faculty.id === activeContextEntry.facultyId,
					isSelected: faculty.id === previewFacultyId,
				};
			})
			.sort((left, right) => {
				if (left.overCapHours !== right.overCapHours) return left.overCapHours - right.overCapHours;
				if (left.creditedTotalHours !== right.creditedTotalHours) return left.creditedTotalHours - right.creditedTotalHours;
				return facultyDisplayName(left.faculty).localeCompare(facultyDisplayName(right.faculty));
			});
	}, [activeContextEntry, bulkEntryIds, draftEntries, facultyMap, previewFacultyId, sandboxFacultyByEntryId, selectedUnassigned, subject]);

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
		if (!selectedEntry || selectedUnassigned) return [];
		return [selectedEntry.entryId, ...Array.from(bulkEntryIds)];
	}, [bulkEntryIds, selectedEntry, selectedUnassigned]);

	const getPrimaryButtonLabel = () => {
		if (isPublished) {
			return 'Create timetable revision';
		}
		if (selectedUnassigned) {
			const isTeacherChanged = unassignedOwnerChanged;
			const hasPlacement = selectedPlacementProposal !== null;

			if (batchPreview && canCommitPreview) {
				if (isTeacherChanged && hasPlacement) {
					return 'Save Teaching Load and place session';
				}
				if (isTeacherChanged) {
					return 'Save Teaching Load';
				}
				if (hasPlacement) {
					return 'Place session';
				}
				return 'Save Teaching Load';
			}
			return 'Preview impact';
		}
		if (batchPreview && canCommitPreview) {
			return 'Save Teaching Load and update timetable';
		}
		return 'Preview impact';
	};

	function toggleBulkEntry(entryId: string) {
		setBulkEntryIds((previous) => {
			const next = new Set(previous);
			if (next.has(entryId)) next.delete(entryId);
			else next.add(entryId);
			return next;
		});
	}

	function applyCandidate(facultyId: number) {
		if (selectedUnassigned) {
			setUnassignedTargetFacultyId(facultyId);
			return;
		}
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

	async function reviewBatch(customProposal?: ManualEditProposal) {
		if (isPublished || repairChanges.length === 0) return null;
		setBatchPreviewLoading(true);
		setBatchPreviewError(null);
		try {
			const proposalToUse = customProposal !== undefined ? customProposal : selectedPlacementProposal;
			const result = await onPreviewTeachingLoadRepair(repairChanges, proposalToUse ?? undefined);
			setBatchPreview(result);
			setSoftWarningAcknowledged(false);
			return result;
		} catch (error) {
			setBatchPreview(null);
			setBatchPreviewError(previewErrorCopy(error));
			return null;
		} finally {
			setBatchPreviewLoading(false);
		}
	}

	async function commitBatch() {
		if (isPublished || repairChanges.length === 0) return;
		const reviewed = batchPreview ?? await reviewBatch();
		if (!reviewed || !reviewed.allowed || reviewed.errorCount > 0 || reviewed.hardViolations.length > 0) return;
		if (reviewed.softViolations.length > 0 && !softWarningAcknowledged) return;
		setBatchCommitLoading(true);
		try {
			const result = await onCommitTeachingLoadRepair(
				repairChanges,
				reviewed.softViolations.length > 0 && softWarningAcknowledged,
				selectedPlacementProposal ?? undefined
			);
			if (result) {
				onResetSandbox();
				if (selectedUnassigned) {
					onDismissSelectedUnassigned();
					onOpenChange(false);
				}
				setCanonicalOnlyTargets(new Map());
				setUnassignedTargetFacultyId(null);
				setSelectedPlacementProposal(null);
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
						<Badge variant="secondary" className="h-5 px-2 text-xs uppercase">Teaching Load</Badge>
						<Badge variant="outline" className="h-5 px-2 text-xs">{isPublished ? 'Create revision' : 'Preview and save'}</Badge>
					</div>
					<SheetTitle>Fix Teacher Assignment</SheetTitle>
					<SheetDescription>
						{activeContextEntry
							? isPublished
								? `${subjectLabel(activeContextEntry.subjectId)} for ${sectionLabel(activeContextEntry.sectionId)} is published. Create an effective-date revision for the timetable; Teaching Load will not be rewritten from this published repair.`
								: selectedUnassigned
									? `${subjectLabel(activeContextEntry.subjectId)} for ${sectionLabel(activeContextEntry.sectionId)} is unassigned. Save Teaching Load first, then place this session in a valid slot.`
									: `${subjectLabel(activeContextEntry.subjectId)} for ${sectionLabel(activeContextEntry.sectionId)} in SY ${schoolYearId ?? 'current'} can be saved to Teaching Load and reflected in this timetable.`
							: 'Select a class or unassigned session to choose a teacher, preview, and save.'}
					</SheetDescription>
				</SheetHeader>

				{activeContextEntry ? (
					<div className="grid min-h-0 flex-1 gap-3 overflow-y-auto pr-1 md:h-full md:grid-cols-3 md:overflow-hidden md:pr-0">
						<section className="min-w-0 min-h-0 overflow-hidden rounded-lg border border-border bg-muted/20 p-3">
							<div className="space-y-3 text-xs">
								<div>
									<p className="text-xs font-semibold text-muted-foreground">{selectedUnassigned ? 'Unassigned session' : 'Selected block'}</p>
									<p className="mt-1 text-base font-semibold text-foreground">{subjectLabel(activeContextEntry.subjectId)}</p>
									<p className="text-xs text-muted-foreground">
										{sectionLabel(activeContextEntry.sectionId)}
										{selectedUnassigned ? ` · Session ${selectedUnassigned.session}` : ` · ${activeContextEntry.day} ${formatTime(activeContextEntry.startTime)}-${formatTime(activeContextEntry.endTime)}`}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-background p-2">
									<div>
										<p className="text-xs uppercase text-muted-foreground">Section</p>
										<p className="font-medium">{sectionLabel(activeContextEntry.sectionId)}</p>
									</div>
									<div>
										<p className="text-xs uppercase text-muted-foreground">Term</p>
										<p className="font-medium">{activeContextEntry.termIndex ? `Term ${activeContextEntry.termIndex}` : 'Run scope'}</p>
									</div>
								</div>
								<div>
									<p className="text-xs uppercase text-muted-foreground">{selectedUnassigned ? 'Current schedule state' : 'Current teacher'}</p>
									<p className="font-medium text-foreground">{selectedUnassigned ? 'Not placed yet' : activeContextEntry.facultyId ? facultyLabel(activeContextEntry.facultyId) : 'No teacher assigned'}</p>
								</div>
								<div>
									<p className="text-xs uppercase text-muted-foreground">Teaching Load owner</p>
									<p className="font-medium text-foreground">{canonicalOwner ? facultyDisplayName(canonicalOwner) : 'No saved owner'}</p>
								</div>
								{canonicalOwnerMismatch ? (
									<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
										<div className="flex items-start gap-2">
											<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
											<div className="min-w-0">
												<p className="font-semibold">Timetable and Teaching Load do not match</p>
												<p className="mt-0.5 text-xs">Choose which source should drive this class before saving.</p>
												<div className="mt-2 flex flex-wrap gap-1.5">
													<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={useTimetableTeacherAsTeachingLoadOwner} disabled={isPublished || !selectedEntry?.facultyId}>
														Use timetable teacher
													</Button>
													<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => canonicalOwner ? applyCandidate(canonicalOwner.id) : undefined} disabled={!canonicalOwner}>
														Use Teaching Load owner
													</Button>
												</div>
												{isPublished ? <p className="mt-1 text-xs">Published repairs use revisions only.</p> : null}
											</div>
										</div>
									</div>
								) : null}
								{subject ? (
									<div className="rounded border border-border/70 bg-background px-2 py-1.5 text-xs text-muted-foreground">
										Owner: {subject.ownerDepartment ?? subject.allowedOwnerDepartments?.join(', ') ?? 'not set'}
									</div>
								) : null}
							</div>
						</section>

						<section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background md:h-full">
							<div className="space-y-2 border-b border-border/70 px-3 py-2">
								<div className="flex items-start justify-between gap-2">
									<div>
									<p className="text-sm font-semibold text-foreground">Choose a teacher</p>
									<p className="text-xs text-muted-foreground">Search, choose, then preview before saving.</p>
									</div>
									<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowWorkloadDetails((value) => !value)}>
										{showWorkloadDetails ? 'Hide details' : 'Details'}
									</Button>
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
														{candidate.isCurrent ? <Badge variant="outline" className="h-5 px-1.5 text-xs">Current</Badge> : null}
														{candidate.isSelected ? <Badge className="h-5 px-1.5 text-xs">Previewed</Badge> : null}
													</div>
													<p className="text-xs text-muted-foreground">{candidate.faculty.department ?? 'Unassigned'}{candidate.faculty.specialization ? ` - ${candidate.faculty.specialization}` : ''}</p>
												</div>
												<Button type="button" size="sm" variant={candidate.isSelected ? 'secondary' : 'outline'} className="h-8 text-xs" onClick={() => applyCandidate(candidate.faculty.id)} aria-label={`Use ${facultyDisplayName(candidate.faculty)} for this sandbox repair`}>
													{candidate.isSelected ? 'Selected' : 'Use teacher'}
												</Button>
											</div>
											<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
												<Badge variant={candidate.overCapHours > 0 ? 'destructive' : candidate.toCapHours <= 2 ? 'outline' : 'secondary'} className="h-5 px-2 text-xs">
													{compactLoadStatus(candidate)}
												</Badge>
												<p className="text-xs font-medium text-muted-foreground">{candidate.statusLabel}</p>
											</div>
											{showWorkloadDetails ? (
												<div className="mt-2 grid gap-2 sm:grid-cols-[1fr_11rem] sm:items-center">
													<StackedWorkloadBar
														teachingHours={candidate.teachingHours}
														creditHours={candidate.creditHours}
														maxHours={candidate.faculty.maxHoursPerWeek || MAX_WEEKLY_TEACHING_HOURS}
														compact
													/>
													<div className="text-xs text-muted-foreground sm:text-right">
														<p className="font-medium text-foreground">{formatHours(candidate.creditedTotalHours)} credited</p>
														<p>{formatHours(candidate.teachingHours)} teaching + {formatHours(candidate.creditHours)} credit</p>
														<p>{candidate.overCapHours > 0 ? `${formatHours(candidate.overCapHours)} over cap` : `${formatHours(candidate.toCapHours)} to cap`}</p>
													</div>
												</div>
											) : null}
										</div>
									))}
								</div>
							</ScrollArea>
						</section>

						{selectedUnassigned ? (
							<section className="flex min-w-0 min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background md:h-full">
								<div className="border-b border-border/70 px-3 py-2">
									<p className="text-sm font-semibold text-foreground">Choose a timetable slot</p>
									<p className="text-xs text-muted-foreground">Select an available slot to place this session.</p>
								</div>
								<ScrollArea className="h-44 min-h-0 md:h-full md:flex-1">
									<div className="space-y-2 p-3">
										{batchPreviewLoading ? (
											<div className="flex justify-center py-6">
												<Loader2 className="size-5 animate-spin text-muted-foreground/60" />
											</div>
										) : (() => {
											const readiness = batchPreview?.unassignedReadiness?.find(r => r.unassignedKey === unassignedKey);
											if (!readiness) {
												return (
													<p className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground italic">
														Preview the impact to load available timetable slots.
													</p>
												);
											}

											if (!readiness.canPlaceNow && (!readiness.suggestedPlacements || readiness.suggestedPlacements.length === 0)) {
												return (
													<div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800 space-y-1">
														<div className="font-semibold flex items-center gap-1">
															<AlertTriangle className="size-3 text-red-600" />
															Still blocked
														</div>
														<p>{readiness.topBlockerCopy || 'No available slots. Teacher or rooms are fully booked.'}</p>
													</div>
												);
											}

											const suggestions = readiness.suggestedPlacements || [];
											if (suggestions.length === 0) {
												return (
													<p className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground italic">
														No suggested slots available.
													</p>
												);
											}

											return (
												<div className="space-y-1.5">
													{suggestions.map((suggestion, index) => {
														const isSelected = selectedPlacementProposal
															&& selectedPlacementProposal.targetDay === suggestion.targetDay
															&& selectedPlacementProposal.targetStartTime === suggestion.targetStartTime
															&& selectedPlacementProposal.targetRoomId === suggestion.targetRoomId;
														const roomName = typeof suggestion.targetRoomId === 'number'
															? roomMap?.get(suggestion.targetRoomId)?.name || 'Suggested room'
															: 'Suggested room';
														return (
															<label
																key={`${suggestion.targetDay}-${suggestion.targetStartTime}-${index}`}
																className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs transition-all ${
																	isSelected
																		? 'border-green-500 bg-green-50/50 text-green-900 shadow-sm'
																		: 'border-border/80 bg-card hover:bg-muted/30 text-muted-foreground'
																}`}
															>
																<Checkbox
																	checked={Boolean(isSelected)}
																	onCheckedChange={async (checked) => {
																		if (checked) {
																			setSelectedPlacementProposal(suggestion);
																			await reviewBatch(suggestion);
																		} else {
																			setSelectedPlacementProposal(null);
																			await reviewBatch(null as any);
																		}
																	}}
																	aria-label={`Select slot ${suggestion.targetDay} ${suggestion.targetStartTime} in ${roomName}`}
																/>
																<span className="min-w-0 flex-1">
																	<span className={`block font-semibold ${isSelected ? 'text-green-900' : 'text-foreground'}`}>
																		Option {index + 1}: {suggestion.targetDay}
																	</span>
																	<span className="block text-xs mt-0.5">
																		{formatTime(suggestion.targetStartTime!)} - {formatTime(suggestion.targetEndTime!)}
																	</span>
																	<span className="block text-xs italic mt-0.5">
																		{roomName}
																	</span>
																</span>
															</label>
														);
													})}
												</div>
											);
										})()}
									</div>
								</ScrollArea>
							</section>
						) : (
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
														<span className="block text-xs text-muted-foreground">{entry.day} {formatTime(entry.startTime)}-{formatTime(entry.endTime)}</span>
														<span className="block truncate text-xs text-muted-foreground">{facultyId ? facultyLabel(facultyId) : 'No teacher'}</span>
													</span>
												</label>
											);
										})}
									</div>
								</ScrollArea>
							</section>
						)}
					</div>
				) : (
					<div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
						Select a timetable block or an unassigned session to open the Teaching Load repair panel.
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
								<p className="text-sm font-semibold text-foreground">{isPublished ? 'Create timetable revision' : 'Preview and save'}</p>
								<p className="text-xs text-muted-foreground">
									{selectedUnassigned
										? `${unassignedOwnerChanged ? 'Teacher and placement changes' : 'Session placement'} waiting for review.`
										: `${stagedCount} teacher change${stagedCount === 1 ? '' : 's'} waiting for ${isPublished ? 'an effective date' : 'impact preview'}.`}
								</p>
							</div>
							<div className="flex flex-wrap gap-1.5">
								{reviewSteps.map((step) => <ReviewStepPill key={step.label} step={step} />)}
							</div>
							{batchPreview ? (
								<Badge variant={canCommitPreview ? 'secondary' : 'destructive'} className="h-5 px-2 text-xs">
									{canCommitPreview ? 'Ready to save' : 'Needs changes'}
								</Badge>
							) : null}
						</div>
						{batchPreviewError ? (
							<div className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-red-700">
								<div className="flex items-start gap-1.5">
									<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
									<div>
										<p className="font-medium">Preview blocked</p>
										<p className="mt-0.5 text-xs">{batchPreviewError}</p>
									</div>
								</div>
							</div>
						) : null}
						<div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
							{selectedUnassigned && unassignedRepairChange ? (
								<div className="rounded border border-border/80 bg-muted/20 px-2 py-1.5">
									<div className="flex items-center justify-between gap-2">
										<span className="truncate font-medium text-foreground">{sectionLabel(selectedUnassigned.sectionId)}</span>
										<Badge variant="outline" className="h-4 px-1.5 text-xs">Unassigned</Badge>
									</div>
									<p className="truncate text-xs text-muted-foreground">
										{canonicalOwner ? facultyDisplayName(canonicalOwner) : 'No saved owner'} -&gt; {facultyLabel(unassignedRepairChange.toFacultyId)}
									</p>
									<p className="mt-0.5 text-xs text-amber-700">
										{selectedPlacementProposal ? 'The selected slot will be applied when you save.' : 'Session stays in Needs attention until a valid slot is chosen.'}
									</p>
								</div>
							) : null}
							{draftEntries.filter((entry) => stagedEntryIds.has(entry.entryId)).slice(0, 6).map((entry) => {
								const targetFacultyId = sandboxFacultyByEntryId.get(entry.entryId) ?? canonicalOnlyTargets.get(entry.entryId);
								const rowPreview = batchPreview?.proposals.find((item) => item.entryId === entry.entryId);
								return (
									<div key={entry.entryId} className="rounded border border-border/80 bg-muted/20 px-2 py-1.5">
										<div className="flex items-center justify-between gap-2">
											<span className="truncate font-medium text-foreground">{sectionLabel(entry.sectionId)}</span>
											{rowPreview?.status === 'FAILED' ? <Badge variant="destructive" className="h-4 px-1.5 text-xs">Failed</Badge> : null}
										</div>
										<p className="truncate text-xs text-muted-foreground">{entry.facultyId ? facultyLabel(entry.facultyId) : 'No teacher'} -&gt; {targetFacultyId ? facultyLabel(targetFacultyId) : 'No teacher'}</p>
										{canonicalOnlyTargets.has(entry.entryId) ? <p className="mt-0.5 text-xs text-amber-700">Teaching Load owner will be updated.</p> : null}
										{rowPreview?.errorMessage ? <p className="mt-1 text-xs text-destructive">{rowPreview.errorMessage}</p> : null}
									</div>
								);
							})}
						</div>
						{stagedCount > 6 ? <p className="mt-1.5 text-xs text-muted-foreground">{stagedCount - 6} more staged change{stagedCount - 6 === 1 ? '' : 's'} included in the batch.</p> : null}
						{batchPreview ? (
							<div className={`mt-2 rounded-md border px-2.5 py-2 ${canCommitPreview ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
								<div className="flex items-start gap-1.5">
									{canCommitPreview ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
									<div>
										<p className="font-medium">{reviewStatusCopy(batchPreview, canCommitPreview)}</p>
										<p className="mt-0.5 text-xs opacity-90">Blocking conflicts: {batchPreview.violationDelta.hardAfter}. Warnings to review before publish: {batchPreview.violationDelta.softAfter}.</p>
										<p className="mt-0.5 text-xs opacity-90">Teaching Load transfers: {batchPreview.ownershipDeltas.filter((delta) => delta.ownershipAction === 'TRANSFER').length}.</p>
									</div>
								</div>
								{batchPreview.humanConflicts.slice(0, 2).map((conflict, conflictIndex) => (
									<p key={`${conflict.code}-${conflict.humanDetail}-${conflictIndex}`} className="mt-1 text-xs">{conflict.humanTitle}: {conflict.humanDetail}</p>
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
										<span className="block text-xs">The warnings will remain after save. Check this box only if you want to save the batch anyway and review those warnings before publish.</span>
									</span>
							</label>
						) : null}
					</div>
				) : null}

				<SheetFooter className="shrink-0 gap-2 border-t border-border/70 pt-3 sm:space-x-0">
					<Button type="button" variant="outline" size="sm" onClick={() => { onResetSandbox(); setCanonicalOnlyTargets(new Map()); setUnassignedTargetFacultyId(null); setSelectedPlacementProposal(null); setBatchPreview(null); setBatchPreviewError(null); setBulkEntryIds(new Set()); }} disabled={!hasStagedChanges} className="gap-1.5">
						<RotateCcw className="size-3.5" />
						Reset
					</Button>
					<Button type="button" variant="outline" size="sm" onClick={() => selectedUnassigned ? onDismissSelectedUnassigned() : activeContextEntry ? onDismissSelectedEntry(activeContextEntry.entryId) : onOpenChange(false)} className="gap-1.5">
						<X className="size-3.5" />
						Close
					</Button>
					<Button type="button" variant={(isPublished || (batchPreview && canCommitPreview)) ? 'default' : 'outline'} size="sm" disabled={!hasStagedChanges || batchPreviewLoading || batchCommitLoading || (batchPreview != null && canCommitPreview && !canSaveReviewedBatch)} onClick={() => isPublished ? openRevisionReview() : batchPreview && canCommitPreview ? void commitBatch() : void reviewBatch()} className="gap-1.5">
						{batchPreviewLoading || batchCommitLoading ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
						{getPrimaryButtonLabel()}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
		<PublishedRevisionDialog
			open={revisionDialogOpen}
			onOpenChange={setRevisionDialogOpen}
			revisionChanges={revisionChanges}
			revisionSuccess={revisionSuccess}
			aboveStandardWarningCount={aboveStandardWarnings.length}
			overCapWarningCount={overCapWarnings.length}
			effectiveDate={revisionEffectiveDate}
			onEffectiveDateChange={setRevisionEffectiveDate}
			reason={revisionReason}
			onReasonChange={setRevisionReason}
			error={revisionError}
			actionHint={revisionActionHint}
			submitting={revisionSubmitting}
			onSubmit={() => void submitRevision()}
			subjectLabel={subjectLabel}
			sectionLabel={sectionLabel}
			facultyLabel={facultyLabel}
		/>
		</>
	);
}
