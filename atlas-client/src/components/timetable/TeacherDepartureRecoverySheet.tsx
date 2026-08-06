import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LocateFixed, Loader2, UserRoundX } from 'lucide-react';

import atlasApi from '@/lib/api';
import { buildUnassignedKey } from '@/lib/timetable-utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { ScrollArea } from '@/ui/scroll-area';
import { SearchableSelect } from '@/ui/searchable-select';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from '@/ui/sheet';
import { PublishedRevisionDialog } from './PublishedRevisionDialog';
import { buildRevisionPayloadChange, revisionDateError } from './TacticalSandboxDock.helpers';
import type {
	CommitResult,
	DraftReport,
	FacultyMirror,
	ScheduledEntry,
	TeachingLoadRepairChange,
	TeachingLoadRepairPreviewResult,
	UnassignedItem,
} from '@/types';

type AffectedGroup = {
	key: string;
	subjectId: number;
	sectionId: number;
	entryKind: 'SECTION' | 'COHORT';
	cohortCode?: string | null;
	entries: ScheduledEntry[];
	unassignedItems: UnassignedItem[];
};

type TeacherDepartureRecoverySheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	initialFacultyId: number | null;
	draft: DraftReport | null;
	facultyMap: Map<number, FacultyMirror>;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
	previewTeachingLoadRepair: (changes: TeachingLoadRepairChange[]) => Promise<TeachingLoadRepairPreviewResult | null>;
	commitTeachingLoadRepair: (changes: TeachingLoadRepairChange[], allowSoftOverride?: boolean) => Promise<CommitResult | null>;
	onSaved: () => void;
	isPublished: boolean;
	schoolId: number;
	schoolYearId: number | null;
	runId: number | null;
	onHighlightEntries?: (entryIds: Set<string> | undefined) => void;
	onJumpToEntry?: (entryId: string) => void;
};

type PublishedRevisionResponse = {
	revision: {
		id: number;
		effectiveDate: string;
		status: string;
	};
	auditId: number;
};

function groupKeyFor(subjectId: number, sectionId: number, entryKind?: 'SECTION' | 'COHORT', cohortCode?: string | null) {
	return `${subjectId}:${sectionId}:${entryKind ?? 'SECTION'}:${cohortCode ?? ''}`;
}

function isActiveFaculty(faculty: FacultyMirror) {
	return faculty.isActiveForScheduling;
}

function formatWorkloadDelta(minutesBefore: number, minutesAfter: number) {
	const before = Math.round(minutesBefore / 60 * 10) / 10;
	const after = Math.round(minutesAfter / 60 * 10) / 10;
	const delta = Math.round((after - before) / 60 * 10) / 10;
	return `${before}h → ${after}h (${delta >= 0 ? '+' : ''}${delta}h)`;
}

const TEACHER_DEPARTURE_STEPS = [
	'Choose leaving teacher',
	'Review affected classes',
	'Choose replacement',
	'Preview changes',
	'Save',
] as const;

type TeacherDepartureStep = 0 | 1 | 2 | 3 | 4;

function buildAffectedGroups(draft: DraftReport | null, departingFacultyId: number | null): AffectedGroup[] {
	if (!draft || departingFacultyId == null) return [];
	const groups = new Map<string, AffectedGroup>();
	const ensureGroup = (subjectId: number, sectionId: number, entryKind?: 'SECTION' | 'COHORT', cohortCode?: string | null) => {
		const key = groupKeyFor(subjectId, sectionId, entryKind, cohortCode);
		const existing = groups.get(key);
		if (existing) return existing;
		const next: AffectedGroup = {
			key,
			subjectId,
			sectionId,
			entryKind: entryKind ?? 'SECTION',
			cohortCode,
			entries: [],
			unassignedItems: [],
		};
		groups.set(key, next);
		return next;
	};

	for (const entry of draft.entries) {
		if (entry.facultyId !== departingFacultyId) continue;
		ensureGroup(entry.subjectId, entry.sectionId, entry.entryKind, entry.cohortCode).entries.push(entry);
	}
	for (const item of draft.unassignedItems) {
		if (item.facultyId !== departingFacultyId) continue;
		ensureGroup(item.subjectId, item.sectionId, item.entryKind, item.cohortCode).unassignedItems.push(item);
	}
	return Array.from(groups.values()).sort((a, b) => {
		if (a.sectionId !== b.sectionId) return a.sectionId - b.sectionId;
		return a.subjectId - b.subjectId;
	});
}

function buildRepairChanges(groups: AffectedGroup[], replacementByGroup: Record<string, string>, departingFacultyId: number | null): TeachingLoadRepairChange[] {
	if (departingFacultyId == null) return [];
	const changes: TeachingLoadRepairChange[] = [];
	for (const group of groups) {
		const targetFacultyId = Number(replacementByGroup[group.key]);
		if (!Number.isFinite(targetFacultyId)) continue;
		const firstEntry = group.entries[0];
		if (firstEntry) {
			changes.push({
				kind: 'ENTRY',
				entryId: firstEntry.entryId,
				subjectId: group.subjectId,
				sectionId: group.sectionId,
				fromFacultyId: departingFacultyId,
				toFacultyId: targetFacultyId,
			});
		}
		for (const item of group.unassignedItems) {
			changes.push({
				kind: 'UNASSIGNED',
				unassignedKey: buildUnassignedKey(item),
				subjectId: item.subjectId,
				sectionId: item.sectionId,
				session: item.session,
				entryKind: item.entryKind ?? 'SECTION',
				cohortCode: item.cohortCode ?? null,
				fromFacultyId: departingFacultyId,
				toFacultyId: targetFacultyId,
			});
		}
	}
	return changes;
}

export function TeacherDepartureRecoverySheet({
	open,
	onOpenChange,
	initialFacultyId,
	draft,
	facultyMap,
	subjectLabel,
	sectionLabel,
	facultyLabel,
	previewTeachingLoadRepair,
	commitTeachingLoadRepair,
	onSaved,
	isPublished,
	schoolId,
	schoolYearId,
	runId,
	onHighlightEntries,
	onJumpToEntry,
}: TeacherDepartureRecoverySheetProps) {
	const [departingFacultyId, setDepartingFacultyId] = useState<number | null>(initialFacultyId);
	const [bulkReplacementId, setBulkReplacementId] = useState('');
	const [replacementByGroup, setReplacementByGroup] = useState<Record<string, string>>({});
	const [preview, setPreview] = useState<TeachingLoadRepairPreviewResult | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [previewing, setPreviewing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [allowSoftWarnings, setAllowSoftWarnings] = useState(false);
	const [showAffectedOnly, setShowAffectedOnly] = useState(false);
	const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
	const [revisionEffectiveDate, setRevisionEffectiveDate] = useState('');
	const [revisionReason, setRevisionReason] = useState('');
	const [revisionSubmitting, setRevisionSubmitting] = useState(false);
	const [revisionError, setRevisionError] = useState<string | null>(null);
	const [revisionActionHint, setRevisionActionHint] = useState<string | null>(null);
	const [revisionSuccess, setRevisionSuccess] = useState<{ revisionId: number; effectiveDate: string; changeCount: number } | null>(null);
	const [currentStep, setCurrentStep] = useState<TeacherDepartureStep>(0);

	useEffect(() => {
		if (!open) return;
		setDepartingFacultyId(initialFacultyId);
		setCurrentStep(initialFacultyId == null ? 0 : 1);
		setReplacementByGroup({});
		setBulkReplacementId('');
		setPreview(null);
		setStatus(null);
		setAllowSoftWarnings(false);
		setShowAffectedOnly(false);
		setRevisionDialogOpen(false);
		setRevisionEffectiveDate('');
		setRevisionReason('');
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
	}, [initialFacultyId, open]);

	const facultyOptions = useMemo(() => {
		return Array.from(facultyMap.values())
			.sort((a, b) => facultyLabel(a.id).localeCompare(facultyLabel(b.id)))
			.map((faculty) => ({
				value: String(faculty.id),
				label: `${facultyLabel(faculty.id)}${faculty.isActiveForScheduling ? '' : ' — inactive'}`,
			}));
	}, [facultyLabel, facultyMap]);

	const replacementOptions = useMemo(() => {
		return Array.from(facultyMap.values())
			.filter((faculty) => faculty.id !== departingFacultyId && isActiveFaculty(faculty))
			.sort((a, b) => facultyLabel(a.id).localeCompare(facultyLabel(b.id)))
			.map((faculty) => ({
				value: String(faculty.id),
				label: facultyLabel(faculty.id),
			}));
	}, [departingFacultyId, facultyLabel, facultyMap]);

	const affectedGroups = useMemo(
		() => buildAffectedGroups(draft, departingFacultyId),
		[departingFacultyId, draft],
	);
	const affectedEntryIds = useMemo(
		() => new Set(affectedGroups.flatMap((group) => group.entries.map((entry) => entry.entryId))),
		[affectedGroups],
	);
	const unresolvedAffectedCount = affectedGroups.reduce((sum, group) => sum + group.unassignedItems.length, 0);
	const groupsNeedingReplacement = affectedGroups.filter((group) => !Number.isFinite(Number(replacementByGroup[group.key]))).length;
	const replacementComplete = affectedGroups.length > 0 && affectedGroups.every((group) => Number.isFinite(Number(replacementByGroup[group.key])));
	const publishedRevisionChanges = useMemo(() => affectedGroups.flatMap((group) => {
		const targetFacultyId = Number(replacementByGroup[group.key]);
		if (!Number.isFinite(targetFacultyId)) return [];
		return group.entries.map((entry) => ({
			entry,
			targetFacultyId,
			targetCapacity: null,
		}));
	}), [affectedGroups, replacementByGroup]);
	const changes = useMemo(
		() => buildRepairChanges(affectedGroups, replacementByGroup, departingFacultyId),
		[affectedGroups, departingFacultyId, replacementByGroup],
	);
	const hasBlockingPreview = (preview?.hardViolations.length ?? 0) > 0 || (preview?.errorCount ?? 0) > 0;
	const hasSoftWarnings = (preview?.softViolations.length ?? 0) > 0;
	const saveDisabledReason = isPublished
		? 'Published schedules require an effective-date revision. Do not rewrite the published run directly.'
		: !draft
			? 'No generated run is loaded.'
			: departingFacultyId == null
				? 'Choose the teacher who is leaving.'
				: affectedGroups.length === 0
					? 'No affected timetable sessions were found for this teacher.'
					: !replacementComplete
						? 'Choose a replacement teacher for every affected group.'
						: !preview
							? 'Preview the reassignment before saving.'
							: hasBlockingPreview
								? 'Fix the blocking issues shown in the preview before saving.'
								: hasSoftWarnings && !allowSoftWarnings
									? 'Review and acknowledge the warnings before saving.'
									: null;
	const maxReachableStep: TeacherDepartureStep = departingFacultyId == null
		? 0
		: affectedGroups.length === 0
			? 1
			: !replacementComplete
				? 2
				: preview || isPublished
					? 4
					: 3;
	const visibleStep = Math.min(currentStep, maxReachableStep) as TeacherDepartureStep;
	const stepInstruction = visibleStep === 0
		? 'Select the teacher whose load must be moved.'
		: visibleStep === 1
			? 'Check which timetable blocks and unresolved sessions will be affected.'
			: visibleStep === 2
				? 'Choose the active replacement teacher for every affected group.'
				: visibleStep === 3
					? 'Preview the effect before ATLAS saves anything.'
					: isPublished
						? 'Create an effective-date revision. The published run will not be rewritten.'
						: 'Save only after the preview says the reassignment is ready.';

	const goBack = () => setCurrentStep((step) => Math.max(0, step - 1) as TeacherDepartureStep);
	const goNext = () => {
		const requested = isPublished && visibleStep === 2 ? 4 : visibleStep + 1;
		setCurrentStep(Math.min(4, Math.min(maxReachableStep, requested)) as TeacherDepartureStep);
	};

	const applyBulkReplacement = () => {
		if (!bulkReplacementId) return;
		setReplacementByGroup((previous) => {
			const next = { ...previous };
			for (const group of affectedGroups) next[group.key] = bulkReplacementId;
			return next;
		});
		setPreview(null);
		setStatus('Replacement applied to all affected groups. Preview before saving.');
	};

	useEffect(() => {
		if (!open) {
			onHighlightEntries?.(undefined);
			setShowAffectedOnly(false);
		}
	}, [onHighlightEntries, open]);

	useEffect(() => {
		if (!open) return;
		if (showAffectedOnly) onHighlightEntries?.(affectedEntryIds);
		else onHighlightEntries?.(undefined);
	}, [affectedEntryIds, onHighlightEntries, open, showAffectedOnly]);

	const jumpToEntry = (entryId: string | null | undefined) => {
		if (!entryId) return;
		onHighlightEntries?.(new Set([entryId]));
		onJumpToEntry?.(entryId);
		setStatus('Highlighted the affected session on the timetable. If it is behind a crowded slot, use the + more button in that cell.');
	};

	const handlePreview = async () => {
		setPreviewing(true);
		setStatus(null);
		setPreview(null);
		try {
			const result = await previewTeachingLoadRepair(changes);
			setPreview(result);
			if (!result) setStatus('ATLAS could not preview the reassignment. Try refreshing, then preview again.');
			else if (result.hardViolations.length > 0 || result.errorCount > 0) setStatus('Preview found blockers. Review the messages before saving.');
			else if (result.softViolations.length > 0) setStatus('Preview found warnings. You may save after acknowledging them.');
			else setStatus('Preview passed. This reassignment is ready to save.');
			if (result) setCurrentStep(4);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'ATLAS could not preview the reassignment.');
		} finally {
			setPreviewing(false);
		}
	};

	const handleSave = async () => {
		if (saveDisabledReason) return;
		setSaving(true);
		setStatus(null);
		try {
			const result = await commitTeachingLoadRepair(changes, allowSoftWarnings);
			if (!result) {
				setStatus('ATLAS could not save the reassignment. No changes were applied.');
				return;
			}
			setStatus('Reassignment saved. ATLAS refreshed the timetable and Teaching Load ownership.');
			onSaved();
			onOpenChange(false);
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'ATLAS could not save the reassignment.');
		} finally {
			setSaving(false);
		}
	};

	const openPublishedRevisionReview = () => {
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
		setRevisionDialogOpen(true);
	};

	const submitPublishedRevision = async () => {
		if (!schoolYearId || !runId) {
			setRevisionError('This published schedule is missing its school year or run reference. Refresh the timetable, then try again.');
			setRevisionActionHint('If the run still has no reference after refresh, ask an administrator to verify the published run.');
			return;
		}
		if (publishedRevisionChanges.length === 0) {
			setRevisionError('Choose a replacement teacher before creating a published revision.');
			setRevisionActionHint('Every affected group needs a replacement teacher.');
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
			setRevisionActionHint('Example: teacher departure effective next school week.');
			return;
		}
		setRevisionSubmitting(true);
		setRevisionError(null);
		setRevisionActionHint(null);
		try {
			const { data } = await atlasApi.post<PublishedRevisionResponse>(`/generation/${schoolId}/${schoolYearId}/runs/${runId}/published-revisions`, {
				effectiveDate: revisionEffectiveDate,
				reason,
				changes: publishedRevisionChanges.map(buildRevisionPayloadChange),
				changeSummary: {
					changeCount: publishedRevisionChanges.length,
					entryIds: publishedRevisionChanges.map((change) => change.entry.entryId),
					changeTypes: ['CHANGE_FACULTY'],
				},
				metadata: {
					source: 'TEACHER_DEPARTURE_RECOVERY',
					departingFacultyId,
					publishedTruthPreserved: true,
				},
			});
			setRevisionSuccess({
				revisionId: data.revision.id,
				effectiveDate: data.revision.effectiveDate,
				changeCount: publishedRevisionChanges.length,
			});
			setStatus(`Revision scheduled for ${revisionEffectiveDate}. Published history is preserved.`);
			onSaved();
		} catch (error: unknown) {
			const response = (error as { response?: { data?: { message?: string; actionHint?: string } } })?.response?.data;
			setRevisionError(response?.message ?? (error instanceof Error ? error.message : 'Revision creation failed.'));
			setRevisionActionHint(response?.actionHint ?? 'Check the effective date and reason, then try creating the revision again.');
		} finally {
			setRevisionSubmitting(false);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="isolate flex h-full w-[92vw] max-w-none flex-col gap-3 overflow-hidden bg-background p-4 text-foreground shadow-2xl sm:w-[34rem] sm:max-w-[34rem]"
				data-testid="teacher-departure-recovery-sheet"
			>
				<SheetHeader className="space-y-1 pr-8 text-left">
					<SheetTitle className="flex items-center gap-2 text-base">
						<UserRoundX className="size-4 text-primary" aria-hidden="true" />
						Teacher leaving
					</SheetTitle>
					<SheetDescription className="text-xs">
						Move this teacher’s timetable load to active teachers. ATLAS previews blockers before anything is saved.
					</SheetDescription>
				</SheetHeader>

				<div className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-muted/20 p-1" data-testid="teacher-departure-stepper" aria-label="Teacher departure progress">
					{TEACHER_DEPARTURE_STEPS.map((step, index) => (
						<div
							key={step}
							className={`rounded-md px-1.5 py-1 text-center text-[0.64rem] font-semibold leading-tight ${index === visibleStep ? 'bg-primary text-primary-foreground shadow-sm' : index < visibleStep ? 'bg-emerald-50 text-emerald-800' : 'bg-background text-muted-foreground'}`}
							aria-current={index === visibleStep ? 'step' : undefined}
						>
							<span className="block text-[0.6rem]">Step {index + 1}</span>
							<span className="hidden sm:block">{step}</span>
						</div>
					))}
				</div>

				<div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary" role="status" aria-live="polite" data-testid="teacher-departure-feedback">
					<p className="font-semibold">{TEACHER_DEPARTURE_STEPS[visibleStep]}</p>
					<p className="mt-1 text-xs">{stepInstruction}</p>
					{isPublished ? (
						<p className="mt-1 text-xs font-medium text-amber-800">
							Published run selected. Use an effective-date revision; ATLAS will not rewrite the published schedule.
						</p>
					) : null}
				</div>

				{visibleStep === 0 ? (
				<div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
					<label className="text-sm font-semibold text-foreground" htmlFor="teacher-departure-departing">
						Which teacher is leaving?
					</label>
					<div id="teacher-departure-departing" data-testid="teacher-departure-departing-select">
						<SearchableSelect
							items={facultyOptions}
							value={departingFacultyId == null ? '' : String(departingFacultyId)}
							onValueChange={(value) => {
								setDepartingFacultyId(Number(value));
								setCurrentStep(1);
								setReplacementByGroup({});
								setPreview(null);
								setStatus(null);
							}}
							placeholder="Select departing teacher"
							triggerClassName="h-10 w-full text-sm"
							className="w-[min(88vw,28rem)]"
						/>
					</div>
					{isPublished ? (
						<div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
							Published run selected. Use an effective-date revision for already-published schedules; this sheet will not rewrite the published record.
						</div>
					) : null}
				</div>
				) : null}

				{visibleStep === 1 ? (
				<div className="grid gap-2 rounded-lg border border-border bg-background p-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-sm font-semibold text-foreground">Affected sessions</p>
							<p className="text-xs text-muted-foreground">
								{affectedGroups.length} group{affectedGroups.length === 1 ? '' : 's'} · {affectedEntryIds.size} grid block{affectedEntryIds.size === 1 ? '' : 's'} · {unresolvedAffectedCount} unresolved · {groupsNeedingReplacement} need replacement
							</p>
						</div>
						<Badge variant={affectedGroups.length > 0 ? 'secondary' : 'outline'} className="text-xs">
							{affectedGroups.length > 0 ? 'Needs new teacher' : 'Nothing to repair'}
						</Badge>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<label className="flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-2 text-xs text-foreground">
							<Checkbox
								checked={showAffectedOnly}
								onCheckedChange={(value) => setShowAffectedOnly(value === true)}
								data-testid="teacher-departure-show-affected-only"
							/>
							Show affected only
						</label>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 gap-1.5 text-xs"
							onClick={() => jumpToEntry(affectedGroups[0]?.entries[0]?.entryId)}
							disabled={!affectedGroups[0]?.entries[0]}
							data-testid="teacher-departure-jump-first-affected"
						>
							<LocateFixed className="size-3.5" aria-hidden="true" />
							Jump to first affected
						</Button>
					</div>
				</div>
				) : null}

				{visibleStep === 1 || visibleStep === 2 ? (
				<ScrollArea className="min-h-0 flex-1 rounded-lg border border-border">
					<div className="divide-y divide-border">
						{affectedGroups.length === 0 ? (
							<div className="p-4 text-sm text-muted-foreground">
								Choose a teacher to see all generated entries, generated unresolved sessions, and draft-linked sessions that need reassignment.
							</div>
						) : affectedGroups.map((group) => {
							const sessionCount = group.entries.length + group.unassignedItems.length;
							return (
								<div key={group.key} className="grid min-h-16 gap-2 p-2 sm:grid-cols-[1fr_13rem]" data-testid="teacher-departure-affected-row">
									<div className="min-w-0">
										<p className="truncate text-sm font-semibold text-foreground">
											{subjectLabel(group.subjectId)} · {sectionLabel(group.sectionId)}
										</p>
										<p className="text-xs text-muted-foreground">
											{sessionCount} affected session{sessionCount === 1 ? '' : 's'}
											{group.entries.length > 0 ? ` · ${group.entries.length} on grid` : ''}
											{group.unassignedItems.length > 0 ? ` · ${group.unassignedItems.length} unresolved` : ''}
										</p>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="mt-1 h-8 px-1.5 text-xs text-primary"
											onClick={() => {
												onHighlightEntries?.(new Set(group.entries.map((entry) => entry.entryId)));
												jumpToEntry(group.entries[0]?.entryId);
											}}
											disabled={group.entries.length === 0}
											data-testid="teacher-departure-show-group-on-grid"
										>
											Show on timetable
										</Button>
									</div>
									{visibleStep === 2 ? (
										<SearchableSelect
											items={replacementOptions}
											value={replacementByGroup[group.key] ?? ''}
											onValueChange={(value) => {
												setReplacementByGroup((previous) => ({ ...previous, [group.key]: value }));
												setPreview(null);
												setStatus(null);
											}}
											placeholder="Replacement teacher"
											triggerClassName="h-9 w-full text-xs"
											className="w-[min(88vw,24rem)]"
										/>
									) : null}
								</div>
							);
						})}
					</div>
				</ScrollArea>
				) : null}

				{visibleStep === 2 ? (
				<div className="flex min-w-0 gap-2 rounded-lg border border-border bg-background p-3">
					<div className="min-w-0 flex-1" data-testid="teacher-departure-replacement-select">
						<SearchableSelect
							items={replacementOptions}
							value={bulkReplacementId}
							onValueChange={setBulkReplacementId}
							placeholder="Replacement teacher"
							triggerClassName="h-9 w-full text-xs"
							className="w-[min(88vw,28rem)]"
						/>
					</div>
					<Button type="button" variant="outline" size="sm" className="h-9 shrink-0 text-xs" onClick={applyBulkReplacement} disabled={!bulkReplacementId || affectedGroups.length === 0}>
						Use for all
					</Button>
				</div>
				) : null}

				{visibleStep === 3 || visibleStep === 4 ? (
				<div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" role="status" aria-live="polite">
					<div className="flex items-center justify-between gap-2">
						<p className="text-sm font-semibold text-foreground">Preview result</p>
						{preview ? (
							<Badge variant={hasBlockingPreview ? 'destructive' : hasSoftWarnings ? 'outline' : 'secondary'} className="text-xs">
								{hasBlockingPreview ? 'Blocked' : hasSoftWarnings ? 'Warnings' : 'Ready'}
							</Badge>
						) : null}
					</div>
					{preview ? (
						<div className="grid gap-1 text-xs text-muted-foreground">
							<p>{preview.proposalCount} change{preview.proposalCount === 1 ? '' : 's'} checked · {preview.ownershipDeltas.length} ownership update{preview.ownershipDeltas.length === 1 ? '' : 's'}</p>
							{preview.affectedTeachers.slice(0, 3).map((teacher) => (
								<p key={teacher.facultyId}>
									{facultyLabel(teacher.facultyId)} workload: {formatWorkloadDelta(teacher.beforeTeachingHours * 60, teacher.afterTeachingHours * 60)}
								</p>
							))}
							{preview.humanConflicts.slice(0, 2).map((conflict) => (
								<p key={`${conflict.code}-${conflict.humanDetail}`} className={conflict.severity === 'HARD' ? 'text-destructive' : 'text-amber-700'}>
									{conflict.humanTitle}: {conflict.humanDetail}
								</p>
							))}
						</div>
					) : (
						<p className="text-xs text-muted-foreground">Preview shows workload deltas, blockers, warnings, and affected session count before saving.</p>
					)}
					{hasSoftWarnings ? (
						<label className="flex items-start gap-2 text-xs text-foreground">
							<Checkbox checked={allowSoftWarnings} onCheckedChange={(value) => setAllowSoftWarnings(value === true)} className="mt-0.5" />
							I reviewed the warnings and want to continue.
						</label>
					) : null}
					{status ? (
						<p className={hasBlockingPreview ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
							{status}
						</p>
					) : null}
					{saveDisabledReason ? (
						<p className="flex items-start gap-1.5 text-xs text-amber-800" data-testid="teacher-departure-save-reason">
							<AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
							{saveDisabledReason}
						</p>
					) : (
						<p className="flex items-center gap-1.5 text-xs text-emerald-700" data-testid="teacher-departure-save-reason">
							<CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
							Ready to save.
						</p>
					)}
				</div>
				) : null}

				{visibleStep < 3 ? (
					<p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="teacher-departure-save-reason">
						<AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
						{saveDisabledReason ?? 'Continue through the steps before saving.'}
					</p>
				) : null}

				<SheetFooter className="gap-2">
					<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={previewing || saving}>
						Close
					</Button>
					{visibleStep > 0 ? (
						<Button type="button" variant="outline" onClick={goBack} disabled={previewing || saving} data-testid="teacher-departure-back-button">
							Back
						</Button>
					) : null}
					{visibleStep < 3 || (isPublished && visibleStep < 4) ? (
						<Button
							type="button"
							onClick={goNext}
							disabled={visibleStep >= maxReachableStep || previewing || saving}
							data-testid="teacher-departure-next-button"
						>
							Next
						</Button>
					) : isPublished ? (
						<Button
							type="button"
							onClick={openPublishedRevisionReview}
							disabled={!replacementComplete || publishedRevisionChanges.length === 0}
							data-testid="teacher-departure-review-revision-button"
						>
							Review revision
						</Button>
					) : (
						<>
							{visibleStep === 3 ? (
							<Button type="button" variant="outline" onClick={() => void handlePreview()} disabled={previewing || !replacementComplete || changes.length === 0} data-testid="teacher-departure-preview-button">
								{previewing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : null}
								Preview
							</Button>
							) : null}
							{visibleStep === 4 ? (
							<Button type="button" onClick={() => void handleSave()} disabled={saving || !!saveDisabledReason} data-testid="teacher-departure-save-button">
								{saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : null}
								Save reassignment
							</Button>
							) : null}
						</>
					)}
				</SheetFooter>
				<PublishedRevisionDialog
					open={revisionDialogOpen}
					onOpenChange={setRevisionDialogOpen}
					revisionChanges={publishedRevisionChanges}
					revisionSuccess={revisionSuccess}
					aboveStandardWarningCount={0}
					overCapWarningCount={0}
					effectiveDate={revisionEffectiveDate}
					onEffectiveDateChange={setRevisionEffectiveDate}
					reason={revisionReason}
					onReasonChange={setRevisionReason}
					error={revisionError}
					actionHint={revisionActionHint}
					submitting={revisionSubmitting}
					onSubmit={() => void submitPublishedRevision()}
					subjectLabel={subjectLabel}
					sectionLabel={sectionLabel}
					facultyLabel={facultyLabel}
				/>
			</SheetContent>
		</Sheet>
	);
}
