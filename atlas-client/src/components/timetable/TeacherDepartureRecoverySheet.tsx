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
import {
	buildRevisionPayloadChange,
	canonicalRefusalFromError,
	describeDepartureRepairTruth,
	revisionDateError,
} from './TacticalSandboxDock.helpers';
import {
	buildRevisionCreatePayload,
	fetchLatestRevisionToken,
	isSourceRevisionStaleError,
	previewPublishedRevision,
} from '@/lib/published-revision-client';
import {
	describeRevisionClashes,
	extractRevisionClashes,
	revisionFailureHint,
	type PublishedRevisionClash,
	type PublishedRevisionPreview,
} from '@/lib/published-revision-clashes';
import { PublishedRevisionClashList } from './PublishedRevisionClashList';
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

/**
 * LANE-C POST-PUBLISH-C01 — the single published-mode note. It replaces four
 * repeated warnings ("effective-date revision", "published run", "sole
 * temporal authority") that the 2026-09-25 audit found on one sheet.
 */
const PUBLISHED_CHANGE_NOTE = 'This schedule is published. Your change starts on a date you choose; before that date everyone keeps seeing the current schedule.';

/** "Term 2" when every class in the group meets in one term; empty otherwise. */
function groupTermLabel(group: AffectedGroup): string {
	const terms = new Set(group.entries.map((entry) => entry.termIndex).filter((term): term is number => typeof term === 'number' && term > 0));
	return terms.size === 1 ? `Term ${[...terms][0]}` : '';
}

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

/**
 * TT-TL-MODULES-C04R1 (F1) — portal-free sheet interior.
 *
 * The sheet body is exported separately from the Radix `Sheet`/`SheetContent`
 * portal wrapper so the rendered-component harness can exercise the real
 * production content (the truthful departure copy, the preview result, and the
 * absence-window-free controls) without a DOM portal. Behavior is unchanged:
 * the mounted `TeacherDepartureRecoverySheet` renders this body inside the
 * portal exactly as before.
 */
export function TeacherDepartureRecoverySheetBody({
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
	const [revisionClashes, setRevisionClashes] = useState<PublishedRevisionClash[]>([]);
	// LANE-C POST-PUBLISH-C01: the published-mode Step 4 check (server dry run).
	const [publishedPreview, setPublishedPreview] = useState<PublishedRevisionPreview | null>(null);
	const [publishedPreviewLoading, setPublishedPreviewLoading] = useState(false);
	const [publishedPreviewError, setPublishedPreviewError] = useState<string | null>(null);
	const [currentStep, setCurrentStep] = useState<TeacherDepartureStep>(0);
	// F1: there is no absence window. Decision D1 defers persisted faculty
	// availability, so this sheet records no absence period and schedules no
	// future reversion; an unpublished run reassigns the affected classes of the
	// current generated run, and a published run changes only through an
	// effective-dated revision.

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
		setRevisionClashes([]);
		setPublishedPreview(null);
		setPublishedPreviewError(null);
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
	const clashLabels = useMemo(() => ({ facultyLabel, sectionLabel, subjectLabel }), [facultyLabel, sectionLabel, subjectLabel]);
	const publishedPreviewClashes = useMemo(
		() => describeRevisionClashes(publishedPreview?.clashes ?? [], clashLabels),
		[clashLabels, publishedPreview],
	);
	const publishedPreviewClean = publishedPreview != null
		&& publishedPreview.blockingHardViolationCount === 0
		&& publishedPreview.clashes.length === 0;
	// F1: the only temporal authority is the published revision effective date.
	const departureTruth = describeDepartureRepairTruth(isPublished, affectedGroups.length);
	const saveDisabledReason = isPublished
		? PUBLISHED_CHANGE_NOTE
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
				: (isPublished ? publishedPreviewClean : preview)
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
					? isPublished
						? 'ATLAS checks that each replacement teacher is free at these class times.'
						: 'Preview the effect before ATLAS saves anything.'
					: isPublished
						? 'Choose the date the new teachers take over. The published schedule stays as it is before then.'
						: 'Save only after the preview says the reassignment is ready.';

	const goBack = () => setCurrentStep((step) => Math.max(0, step - 1) as TeacherDepartureStep);
	const goNext = () => {
		// LANE-C POST-PUBLISH-C01: published mode no longer skips the check step.
		setCurrentStep(Math.min(4, Math.min(maxReachableStep, visibleStep + 1)) as TeacherDepartureStep);
	};

	const runPublishedPreview = async () => {
		if (!schoolYearId || !runId || publishedRevisionChanges.length === 0) return;
		setPublishedPreviewLoading(true);
		setPublishedPreviewError(null);
		setPublishedPreview(null);
		try {
			const sourceRevisionId = await fetchLatestRevisionToken(schoolId, schoolYearId, runId);
			const result = await previewPublishedRevision(
				{ schoolId, schoolYearId, runId },
				{ sourceRevisionId, changes: publishedRevisionChanges.map(buildRevisionPayloadChange) },
			);
			setPublishedPreview(result);
		} catch (error) {
			setPublishedPreviewError(isSourceRevisionStaleError(error)
				? 'The published schedule changed while you were preparing this. Refresh the timetable, then try again.'
				: 'ATLAS could not check this change. Try again in a moment.');
		} finally {
			setPublishedPreviewLoading(false);
		}
	};

	// Any change to the replacements invalidates the last check.
	useEffect(() => {
		setPublishedPreview(null);
		setPublishedPreviewError(null);
	}, [publishedRevisionChanges]);

	// Published Step 4 runs the check as soon as it is reached.
	useEffect(() => {
		if (!open || !isPublished || visibleStep !== 3 || !replacementComplete) return;
		if (publishedPreview || publishedPreviewLoading || publishedPreviewError) return;
		void runPublishedPreview();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, isPublished, visibleStep, replacementComplete, publishedPreview, publishedPreviewLoading, publishedPreviewError]);

	const applyBulkReplacement = () => {
		if (!bulkReplacementId) return;
		setReplacementByGroup((previous) => {
			const next = { ...previous };
			for (const group of affectedGroups) next[group.key] = bulkReplacementId;
			return next;
		});
		setPreview(null);
		setPublishedPreview(null);
		setPublishedPreviewError(null);
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
			else setStatus(`Preview passed. ${departureTruth}`);
			if (result) setCurrentStep(4);
		} catch (error) {
			// R2: a canonical typed refusal is rendered truthfully inline; the
			// failure is never silently retried and never reported as success.
			const refusal = canonicalRefusalFromError(error);
			setStatus(refusal.message);
		} finally {
			setPreviewing(false);
		}
	};

	const handleSave = async () => {
		if (saveDisabledReason) {
			setStatus(saveDisabledReason);
			return;
		}
		setSaving(true);
		setStatus(null);
		try {
			const result = await commitTeachingLoadRepair(changes, allowSoftWarnings);
			if (!result) {
				setStatus('ATLAS could not save the reassignment. No changes were applied.');
				return;
			}
			setStatus(`Reassignment saved for the current generated run. ${departureTruth} ATLAS refreshed the timetable and Teaching Load ownership.`);
			onSaved();
			onOpenChange(false);
		} catch (error) {
			const refusal = canonicalRefusalFromError(error);
			setStatus(refusal.message);
		} finally {
			setSaving(false);
		}
	};

	const openPublishedRevisionReview = () => {
		setRevisionError(null);
		setRevisionActionHint(null);
		setRevisionSuccess(null);
		setRevisionClashes([]);
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
		// F1: in Published mode the revision effective date is the sole temporal
		// authority. No absence window exists and no direct Teaching Load write is
		// attempted on this path.
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
		setRevisionClashes([]);
		try {
			const sourceRevisionId = await fetchLatestRevisionToken(schoolId, schoolYearId, runId);
			const payload = buildRevisionCreatePayload({
				effectiveDate: revisionEffectiveDate,
				reason,
				sourceRevisionId,
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
			const { data } = await atlasApi.post<PublishedRevisionResponse>(`/generation/${schoolId}/${schoolYearId}/runs/${runId}/published-revisions`, payload);
			setRevisionSuccess({
				revisionId: data.revision.id,
				effectiveDate: data.revision.effectiveDate,
				changeCount: publishedRevisionChanges.length,
			});
			setStatus(`Revision scheduled for ${revisionEffectiveDate}. Published history is preserved.`);
			onSaved();
		} catch (error: unknown) {
			const response = (error as { response?: { data?: { message?: string; actionHint?: string } } })?.response?.data;
			if (isSourceRevisionStaleError(error)) {
				setRevisionError('The published schedule changed while you were preparing this revision. Review the current schedule, then try again.');
				setRevisionActionHint('Another officer may have just published or revised the schedule. Refresh the timetable before creating this revision again.');
				return;
			}
			// LANE-C POST-PUBLISH-C01: a clash refusal names the colliding classes;
			// the date and reason are only blamed when the error is about them.
			const clashes = extractRevisionClashes(error);
			setRevisionClashes(clashes);
			setRevisionError(clashes.length > 0
				? 'This change would double-book a teacher, room or class, so nothing was saved.'
				: response?.message ?? (error instanceof Error ? error.message : 'Revision creation failed.'));
			setRevisionActionHint(revisionFailureHint(error));
		} finally {
			setRevisionSubmitting(false);
		}
	};

	return (
		<>
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
						<p className="mt-1 text-xs font-medium text-amber-800" data-testid="teacher-departure-published-note">
							{PUBLISHED_CHANGE_NOTE}
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
					<div className="mt-1 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-xs text-muted-foreground" data-testid="teacher-departure-truth">
						{departureTruth}
					</div>
				</div>
				) : null}

				{visibleStep === 1 ? (
				<div className="grid gap-2 rounded-lg border border-border bg-background p-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p className="text-sm font-semibold text-foreground">Affected sessions</p>
							<p className="text-xs text-muted-foreground">
								{affectedGroups.length} class{affectedGroups.length === 1 ? '' : 'es'} · {affectedEntryIds.size} weekly meeting{affectedEntryIds.size === 1 ? '' : 's'}{unresolvedAffectedCount > 0 ? ` · ${unresolvedAffectedCount} not yet on the timetable` : ''} · {groupsNeedingReplacement} still need a teacher
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
										<p className="truncate text-sm font-semibold text-foreground" data-testid="teacher-departure-group-label">
											{subjectLabel(group.subjectId)}{groupTermLabel(group) ? ` · ${groupTermLabel(group)}` : ''} · {sectionLabel(group.sectionId)}
										</p>
										<p className="text-xs text-muted-foreground">
											{sessionCount} class meeting{sessionCount === 1 ? '' : 's'} a week
											{group.unassignedItems.length > 0 ? ` · ${group.unassignedItems.length} not yet on the timetable` : ''}
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

				{isPublished && (visibleStep === 3 || visibleStep === 4) ? (
				<div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" role="status" aria-live="polite" data-testid="teacher-departure-published-check">
					<p className="text-sm font-semibold text-foreground">Check for clashes</p>
					{publishedPreviewLoading ? (
						<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
							Checking that each replacement teacher is free at these class times…
						</p>
					) : publishedPreviewError ? (
						<div className="space-y-1">
							<p className="text-xs text-destructive">{publishedPreviewError}</p>
							<Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void runPublishedPreview()}>
								Check again
							</Button>
						</div>
					) : publishedPreviewClean ? (
						<p className="flex items-center gap-1.5 text-xs text-emerald-700" data-testid="teacher-departure-published-check-clean">
							<CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
							No clashes. Every replacement teacher is free at these class times.
						</p>
					) : publishedPreview ? (
						<div className="space-y-2">
							<PublishedRevisionClashList
								clashes={publishedPreviewClashes}
								heading={`${publishedPreviewClashes.length} clash${publishedPreviewClashes.length === 1 ? '' : 'es'} found. Nothing has been saved.`}
								onShowOnTimetable={(entryIds) => {
									onHighlightEntries?.(new Set(entryIds));
									onJumpToEntry?.(entryIds[0]);
								}}
							/>
							<Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setCurrentStep(2)} data-testid="teacher-departure-choose-different">
								Choose a different teacher
							</Button>
						</div>
					) : null}
				</div>
				) : null}

				{!isPublished && (visibleStep === 3 || visibleStep === 4) ? (
				<div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3" role="status" aria-live="polite">
					<div className="flex items-center justify-between gap-2">
						<div className="min-w-0">
							<p className="text-sm font-semibold text-foreground">Preview result</p>
							<p className="text-xs text-muted-foreground" data-testid="teacher-departure-window-confirmation">{departureTruth}</p>
						</div>
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

				{visibleStep < 3 && !isPublished ? (
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
							disabled={!replacementComplete || publishedRevisionChanges.length === 0 || !publishedPreviewClean}
							data-testid="teacher-departure-review-revision-button"
						>
							Choose start date
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
					clashes={describeRevisionClashes(revisionClashes, clashLabels)}
					submitting={revisionSubmitting}
					onSubmit={() => void submitPublishedRevision()}
					subjectLabel={subjectLabel}
					sectionLabel={sectionLabel}
					facultyLabel={facultyLabel}
				/>
		</>
	);
}

/**
 * The mounted sheet wrapper: the Radix portal plus the real interior body.
 */
export function TeacherDepartureRecoverySheet(props: TeacherDepartureRecoverySheetProps) {
	return (
		<Sheet open={props.open} onOpenChange={props.onOpenChange}>
			<SheetContent
				side="right"
				className="isolate flex h-full w-[92vw] max-w-none flex-col gap-3 overflow-hidden bg-background p-4 text-foreground shadow-2xl sm:w-[34rem] sm:max-w-[34rem]"
				data-testid="teacher-departure-recovery-sheet"
			>
				<TeacherDepartureRecoverySheetBody {...props} />
			</SheetContent>
		</Sheet>
	);
}
