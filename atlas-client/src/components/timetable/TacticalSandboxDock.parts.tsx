import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { StackedWorkloadBar } from '@/components/faculty-assignments/StackedWorkloadBar';
import { MAX_WEEKLY_TEACHING_HOURS } from '@/lib/faculty-assignment-helpers';
import type { FacultyMirror, ScheduledEntry, TeachingLoadRepairPreviewResult } from '@/types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Input } from '@/ui/input';
import { ScrollArea } from '@/ui/scroll-area';
import { Textarea } from '@/ui/textarea';

import {
	AVAILABILITY_MODULE_DEFERRED_COPY,
	capabilityOverrideApplyEnabled,
	compactLoadStatus,
	describeCapabilityOverrideEffect,
	describeRedistributionStatus,
	facultyDisplayName,
	formatHours,
	qualificationApplyEnabled,
	REDISTRIBUTION_HOME_HREF,
	reviewStatusCopy,
	type CapabilityOverrideDraft,
	type CapabilityOverridePreviewState,
	type QualificationPreviewState,
	type ReadinessSummary,
	type RedistributionSummary,
} from './TacticalSandboxDock.helpers';

export type Candidate = {
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

export type ReviewStep = {
	label: string;
	state: 'done' | 'active' | 'waiting' | 'blocked';
};

export function ReviewStepPill({ step }: { step: ReviewStep }) {
	const tone = step.state === 'done'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: step.state === 'active'
			? 'border-primary/25 bg-primary/10 text-primary'
			: step.state === 'blocked'
				? 'border-red-200 bg-red-50 text-red-700'
				: 'border-border bg-muted/30 text-muted-foreground';

	return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>{step.label}</span>;
}

export type RedistributionSummaryResponse = { summary: RedistributionSummary | null; readiness: ReadinessSummary | null };

type RedistributionSummaryCardProps = {
	data: RedistributionSummaryResponse;
	loading: boolean;
	error: string | null;
	candidate: boolean;
	onPreview: () => void;
};

/**
 * SS3 / R3 — read-only overload/underload redistribution summary.
 *
 * It consumes ONLY the canonical read-only authorities and never dispatches an
 * apply: the card renders counts from the canonical response and routes the
 * operator to `/teaching-load`, which stays the canonical home for any actual
 * rebalance. It is disabled until the authenticated school/year is resolved.
 */
export function RedistributionSummaryCard({ data, loading, error, candidate, onPreview }: RedistributionSummaryCardProps) {
	const status = describeRedistributionStatus(data.summary, data.readiness);
	return (
		<section className="rounded-lg border border-border bg-background p-3 text-xs" data-testid="timetable-redistribution-summary">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">Overload / underload redistribution</p>
					<p className="text-xs text-muted-foreground">Read-only summary from the canonical Teaching Load authority. The Teaching Load page stays the home for any actual rebalance.</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant="outline"
					className="h-8 shrink-0 text-xs"
					onClick={onPreview}
					disabled={!candidate || loading}
					data-testid="timetable-redistribution-preview"
				>
					{loading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : null}
					Check redistribution
				</Button>
			</div>
			{!candidate ? (
				<p className="mt-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-muted-foreground" data-testid="timetable-redistribution-scope-unresolved">
					Select an active school year before ATLAS can compare this school's Teaching Load distribution. No request is sent while the scope is unresolved.
				</p>
			) : error ? (
				<p className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-700" data-testid="timetable-redistribution-error">
					<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
					{error}
				</p>
			) : data.summary || data.readiness ? (
				<div className="mt-2 space-y-1.5">
					<p className="font-medium text-foreground" data-testid="timetable-redistribution-status">{status}</p>
					{data.readiness && data.readiness.blockerCodes.length > 0 ? (
						<p className="text-muted-foreground" data-testid="timetable-redistribution-blockers">
							Canonical blockers: {data.readiness.blockerCodes.join(', ')}
						</p>
					) : null}
					{data.summary && !data.summary.evaluated ? (
						<p className="text-amber-800">No persisted effective workload policy is available, so ATLAS did not compute redistribution moves.</p>
					) : null}
				</div>
			) : (
				<p className="mt-2 text-muted-foreground" data-testid="timetable-redistribution-idle">
					No redistribution summary has been requested for this school year yet.
				</p>
			)}
			<Button asChild size="sm" variant="ghost" className="mt-2 h-7 gap-1 px-1.5 text-xs text-primary">
				<Link to={REDISTRIBUTION_HOME_HREF} data-testid="timetable-redistribution-open-home">
					Open Teaching Load
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</Button>
		</section>
	);
}

type QualificationAuthorityModuleProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	contextLabel: string;
	subjectLabel: string;
	aliasRows: Array<{ key: string; value: string }>;
	labelRows: Array<{ key: string; value: string }>;
	onAliasChange: (rows: Array<{ key: string; value: string }>) => void;
	onLabelChange: (rows: Array<{ key: string; value: string }>) => void;
	preview: QualificationPreviewState | null;
	previewing: boolean;
	applying: boolean;
	confirmationText: string;
	onConfirmationChange: (value: string) => void;
	status: string | null;
	error: string | null;
	onPreview: () => void;
	onApply: () => void;
};

/**
 * R4 — bounded Qualification / Department authority module.
 *
 * Preview is read-only and issues the server fingerprint. Apply stays disabled
 * until that fingerprint exists and the operator types the server's exact
 * confirmation phrase. The module never becomes a second Teaching Load editor:
 * it only manages department alias/label authority for the selected context.
 */
export function QualificationAuthorityModule({
	open,
	onOpenChange,
	contextLabel,
	subjectLabel,
	aliasRows,
	labelRows,
	onAliasChange,
	onLabelChange,
	preview,
	previewing,
	applying,
	confirmationText,
	onConfirmationChange,
	status,
	error,
	onPreview,
	onApply,
}: QualificationAuthorityModuleProps) {
	// F3: the required phrase is the server-issued value from the preview.
	const applyReady = qualificationApplyEnabled(preview)
		&& Boolean(preview?.confirmationText)
		&& confirmationText === preview?.confirmationText;
	const updateRow = (rows: Array<{ key: string; value: string }>, index: number, patch: Partial<{ key: string; value: string }>, onChange: (next: Array<{ key: string; value: string }>) => void) => {
		onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
	};
	return (
		<section className="rounded-lg border border-border bg-background p-3 text-xs" data-testid="timetable-qualification-module">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">Qualification / department authority</p>
					<p className="text-muted-foreground">Context: {contextLabel} · {subjectLabel}</p>
				</div>
				<Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpenChange(!open)} data-testid="timetable-qualification-toggle">
					{open ? 'Hide' : 'Open'}
				</Button>
			</div>
			{!open ? (
				<p className="mt-2 text-muted-foreground">Open this module to preview a department alias or label change before applying it.</p>
			) : (
				<div className="mt-2 space-y-2">
					<div className="space-y-1">
						{(aliasRows.length === 0 ? [{ key: '', value: '' }] : aliasRows).map((row, index) => (
							<div key={`alias-${index}`} className="grid gap-1.5 sm:grid-cols-[1fr_1fr]">
								<Input
									value={row.key}
									onChange={(event) => updateRow(aliasRows.length === 0 ? [{ key: '', value: '' }] : aliasRows, index, { key: event.target.value }, onAliasChange)}
									placeholder="Department alias (e.g. MATH)"
									className="h-8 text-xs"
									data-testid={`timetable-qualification-alias-key-${index}`}
								/>
								<Input
									value={row.value}
									onChange={(event) => updateRow(aliasRows.length === 0 ? [{ key: '', value: '' }] : aliasRows, index, { value: event.target.value }, onAliasChange)}
									placeholder="Mapped department (e.g. Mathematics)"
									className="h-8 text-xs"
									data-testid={`timetable-qualification-alias-value-${index}`}
								/>
							</div>
						))}
						<Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAliasChange([...aliasRows, { key: '', value: '' }])} data-testid="timetable-qualification-add-alias">
							Add alias
						</Button>
					</div>
					<div className="space-y-1">
						{(labelRows.length === 0 ? [{ key: '', value: '' }] : labelRows).map((row, index) => (
							<div key={`label-${index}`} className="grid gap-1.5 sm:grid-cols-[1fr_1fr]">
								<Input
									value={row.key}
									onChange={(event) => updateRow(labelRows.length === 0 ? [{ key: '', value: '' }] : labelRows, index, { key: event.target.value }, onLabelChange)}
									placeholder="Department code (e.g. FIL)"
									className="h-8 text-xs"
									data-testid={`timetable-qualification-label-key-${index}`}
								/>
								<Input
									value={row.value}
									onChange={(event) => updateRow(labelRows.length === 0 ? [{ key: '', value: '' }] : labelRows, index, { value: event.target.value }, onLabelChange)}
									placeholder="Display label (e.g. Filipino)"
									className="h-8 text-xs"
									data-testid={`timetable-qualification-label-value-${index}`}
								/>
							</div>
						))}
						<Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onLabelChange([...labelRows, { key: '', value: '' }])} data-testid="timetable-qualification-add-label">
							Add label
						</Button>
					</div>
					{preview?.confirmationText ? (
						<p className="rounded-md border border-border bg-muted/20 px-2 py-1.5 text-muted-foreground" data-testid="timetable-qualification-issued-confirmation">
							Server-issued confirmation. Type it exactly to apply: <span className="font-mono font-semibold text-foreground">{preview.confirmationText}</span>
						</p>
					) : null}
					<Textarea
						value={confirmationText}
						onChange={(event) => onConfirmationChange(event.target.value)}
						placeholder={preview?.confirmationText
							? `Type exactly: ${preview.confirmationText}`
							: 'Preview first to receive the server confirmation text.'}
						className="min-h-16 text-xs"
						data-testid="timetable-qualification-confirmation"
						aria-label="Department authority confirmation text"
					/>
					{preview ? (
						<p className="text-muted-foreground" data-testid="timetable-qualification-fingerprint">
							Server fingerprint issued: {preview.creates} create · {preview.conflicts} conflict. Apply is authorized by this preview only.
						</p>
					) : (
						<p className="text-amber-800" data-testid="timetable-qualification-preview-required">
							Preview is read-only and issues the fingerprint that apply requires. Nothing is written by preview.
						</p>
					)}
					{error ? (
						<p className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-700" data-testid="timetable-qualification-error">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
							{error}
						</p>
					) : null}
					{status ? (
						<p className={`text-muted-foreground`} data-testid="timetable-qualification-status">{status}</p>
					) : null}
					<div className="flex flex-wrap gap-1.5">
						<Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onPreview} disabled={previewing || applying} data-testid="timetable-qualification-preview">
							{previewing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-1.5 size-3.5" aria-hidden="true" />}
							Preview authority
						</Button>
						<Button type="button" size="sm" className="h-8 text-xs" onClick={onApply} disabled={!applyReady || previewing || applying} data-testid="timetable-qualification-apply">
							{applying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-1.5 size-3.5" aria-hidden="true" />}
							Apply authority
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}

/** R7 / D1 — availability moves are deferred, rendered truthfully, never faked. */
export function AvailabilityDeferredNotice() {
	return (
		<p className="rounded-lg border border-dashed border-border bg-muted/20 p-2.5 text-xs text-muted-foreground" data-testid="timetable-availability-deferred">
			{AVAILABILITY_MODULE_DEFERRED_COPY}
		</p>
	);
}

type OwnerSourceMismatchNoticeProps = {
	isPublished: boolean;
	selectedEntryFacultyId: number | null;
	canonicalOwnerId: number | null;
	onUseTimetableOwner: () => void;
	onUseCanonicalOwner: (facultyId: number) => void;
};

/**
 * TT-TL-MODULES-C04 — extracted unchanged from `TacticalSandboxDock.tsx` so the
 * dock stays under the 1000-line component limit. Resolves a Timetable/Teaching
 * Load owner mismatch; published runs route to revisions only.
 */
export function OwnerSourceMismatchNotice({
	isPublished,
	selectedEntryFacultyId,
	canonicalOwnerId,
	onUseTimetableOwner,
	onUseCanonicalOwner,
}: OwnerSourceMismatchNoticeProps) {
	return (
		<div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
			<div className="flex items-start gap-2">
				<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
				<div className="min-w-0">
					<p className="font-semibold">Timetable and Teaching Load do not match</p>
					<p className="mt-0.5 text-xs">Choose which source should drive this class before saving.</p>
					<div className="mt-2 flex flex-wrap gap-1.5">
						<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={onUseTimetableOwner} disabled={isPublished || !selectedEntryFacultyId}>
							Use timetable owner
						</Button>
						<Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => canonicalOwnerId ? onUseCanonicalOwner(canonicalOwnerId) : undefined} disabled={!canonicalOwnerId}>
							Use Teaching Load owner
						</Button>
					</div>
					{isPublished ? <p className="mt-1 text-xs">Published repairs use revisions only.</p> : null}
				</div>
			</div>
		</div>
	);
}

type CapabilityOverrideModuleProps = {
	targetLabel: string;
	candidate: boolean;
	draft: CapabilityOverrideDraft;
	onDraftChange: (draft: CapabilityOverrideDraft) => void;
	preview: CapabilityOverridePreviewState | null;
	previewing: boolean;
	applying: boolean;
	confirmationText: string;
	onConfirmationChange: (value: string) => void;
	status: string | null;
	error: string | null;
	onPreview: () => void;
	onApply: () => void;
};

/**
 * F2 — bounded capability-override module for the Timetable qualification entry.
 *
 * Scope is the selected teacher/subject repair only; the Teaching Load page stays
 * the canonical home for broad capability editing. Preview is read-only and
 * issues the fingerprint + confirmation text; apply requires both. There is no
 * blind PUT/DELETE control anywhere in this surface.
 */
export function CapabilityOverrideModule({
	targetLabel,
	candidate,
	draft,
	onDraftChange,
	preview,
	previewing,
	applying,
	confirmationText,
	onConfirmationChange,
	status,
	error,
	onPreview,
	onApply,
}: CapabilityOverrideModuleProps) {
	const applyReady = capabilityOverrideApplyEnabled(preview)
		&& Boolean(preview?.confirmationText)
		&& confirmationText === preview?.confirmationText;
	return (
		<section className="rounded-lg border border-border bg-background p-3 text-xs" data-testid="timetable-capability-override-module">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">Capability override (selected teacher)</p>
					<p className="text-muted-foreground">Target: {targetLabel}. The Teaching Load page stays the home for broad capability editing.</p>
				</div>
				<Badge variant="outline" className="h-5 px-2 text-[0.65rem]">{draft.action}</Badge>
			</div>
			{!candidate ? (
				<p className="mt-2 rounded-md border border-border bg-muted/20 px-2 py-1.5 text-muted-foreground" data-testid="timetable-capability-scope-unresolved">
					Select a scheduled class with an owner and an active school year first. No request is sent while the target is unresolved.
				</p>
			) : (
				<div className="mt-2 space-y-2">
					<div className="grid gap-1.5 sm:grid-cols-2">
						<Input
							value={draft.subjectCode}
							onChange={(event) => onDraftChange({ ...draft, subjectCode: event.target.value })}
							placeholder="Subject code (e.g. MATH)"
							className="h-8 text-xs"
							data-testid="timetable-capability-subject"
						/>
						<Input
							value={draft.specializationCode}
							onChange={(event) => onDraftChange({ ...draft, specializationCode: event.target.value })}
							placeholder="Specialization code (optional)"
							className="h-8 text-xs"
							data-testid="timetable-capability-specialization"
						/>
					</div>
					<div className="flex flex-wrap gap-1.5">
						<Button
							type="button"
							size="sm"
							variant={draft.action === 'SET' ? 'secondary' : 'outline'}
							className="h-7 text-xs"
							onClick={() => onDraftChange({ ...draft, action: 'SET' })}
							data-testid="timetable-capability-action-set"
						>
							Grant / update
						</Button>
						<Button
							type="button"
							size="sm"
							variant={draft.action === 'REMOVE' ? 'secondary' : 'outline'}
							className="h-7 text-xs"
							onClick={() => onDraftChange({ ...draft, action: 'REMOVE' })}
							data-testid="timetable-capability-action-remove"
						>
							Remove
						</Button>
					</div>
					<p className="text-muted-foreground" data-testid="timetable-capability-effect">{describeCapabilityOverrideEffect(preview)}</p>
					{preview?.confirmationText ? (
						<p className="rounded-md border border-border bg-muted/20 px-2 py-1.5 text-muted-foreground" data-testid="timetable-capability-issued-confirmation">
							Server-issued confirmation. Type it exactly to apply: <span className="font-mono font-semibold text-foreground">{preview.confirmationText}</span>
						</p>
					) : null}
					<Textarea
						value={confirmationText}
						onChange={(event) => onConfirmationChange(event.target.value)}
						placeholder={preview?.confirmationText ? `Type exactly: ${preview.confirmationText}` : 'Preview first to receive the server confirmation text.'}
						className="min-h-16 text-xs"
						data-testid="timetable-capability-confirmation"
						aria-label="Capability override confirmation text"
					/>
					{error ? (
						<p className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-red-700" data-testid="timetable-capability-error">
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
							{error}
						</p>
					) : null}
					{status ? <p className="text-muted-foreground" data-testid="timetable-capability-status">{status}</p> : null}
					<div className="flex flex-wrap gap-1.5">
						<Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onPreview} disabled={previewing || applying} data-testid="timetable-capability-preview">
							{previewing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-1.5 size-3.5" aria-hidden="true" />}
							Preview override
						</Button>
						<Button type="button" size="sm" className="h-8 text-xs" onClick={onApply} disabled={!applyReady || previewing || applying} data-testid="timetable-capability-apply">
							{applying ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="mr-1.5 size-3.5" aria-hidden="true" />}
							Apply override
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}

type StagedRepairReviewProps = {
	isPublished: boolean;
	stagedCount: number;
	selectedUnassigned: boolean;
	unassignedOwnerChanged: boolean;
	hasSelectedPlacement: boolean;
	reviewSteps: ReviewStep[];
	batchPreview: TeachingLoadRepairPreviewResult | null;
	canCommitPreview: boolean;
	batchPreviewError: string | null;
	requiresSoftWarningAcknowledgement: boolean;
	softWarningAcknowledgement: boolean;
	onSoftWarningAcknowledgeChange: (value: boolean) => void;
	softWarningCount: number;
	stagedEntryIds: Set<string>;
	draftEntries: ScheduledEntry[];
	sandboxFacultyByEntryId: Map<string, number>;
	canonicalOnlyTargets: Map<string, number>;
	sectionLabel: (id: number) => string;
	facultyLabel: (id: number) => string;
};

/**
 * TT-TL-MODULES-C04 — the staged Teaching Load repair review panel.
 *
 * Extracted unchanged from `TacticalSandboxDock.tsx` so the dock stays under
 * the 1000-line component limit after the focused mini-modules were added. The
 * behavior is identical: impact preview before commit, truthful refusal copy,
 * and explicit soft-warning acknowledgement.
 */
export function StagedRepairReview({
	isPublished,
	stagedCount,
	selectedUnassigned,
	unassignedOwnerChanged,
	hasSelectedPlacement,
	reviewSteps,
	batchPreview,
	canCommitPreview,
	batchPreviewError,
	requiresSoftWarningAcknowledgement,
	softWarningAcknowledgement,
	onSoftWarningAcknowledgeChange,
	softWarningCount,
	stagedEntryIds,
	draftEntries,
	sandboxFacultyByEntryId,
	canonicalOnlyTargets,
	sectionLabel,
	facultyLabel,
}: StagedRepairReviewProps) {
	return (
		<div className="rounded-lg border border-border bg-background px-3 py-3 text-xs">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-sm font-semibold text-foreground">{isPublished ? 'Create timetable revision' : 'Preview and save'}</p>
					<p className="text-xs text-muted-foreground">
						{selectedUnassigned
							? `${unassignedOwnerChanged ? 'Ownership and placement changes' : 'Session placement'} waiting for review.`
							: `${stagedCount} ownership change${stagedCount === 1 ? '' : 's'} waiting for ${isPublished ? 'an effective date' : 'impact preview'}.`}
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
				{selectedUnassigned ? (
					<div className="rounded border border-border/80 bg-muted/20 px-2 py-1.5">
						<div className="flex items-center justify-between gap-2">
							<span className="truncate font-medium text-foreground">Unassigned session</span>
							<Badge variant="outline" className="h-4 px-1.5 text-xs">Unassigned</Badge>
						</div>
						<p className="mt-0.5 text-xs text-amber-700">
							{hasSelectedPlacement ? 'The selected slot will be applied when you save.' : 'Session stays in Needs attention until a valid slot is chosen.'}
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
							<p className="truncate text-xs text-muted-foreground">{entry.facultyId ? facultyLabel(entry.facultyId) : 'No owner'} -&gt; {targetFacultyId ? facultyLabel(targetFacultyId) : 'No owner'}</p>
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
						checked={softWarningAcknowledgement}
						onCheckedChange={(checked) => onSoftWarningAcknowledgeChange(checked === true)}
						aria-label="Acknowledge soft warnings before saving sandbox changes"
					/>
					<span>
						<span className="block font-medium">Acknowledge {softWarningCount} soft warning{softWarningCount === 1 ? '' : 's'} before saving</span>
						<span className="block text-xs">The warnings will remain after save. Check this box only if you want to save the batch anyway and review those warnings before publish.</span>
					</span>
				</label>
			) : null}
		</div>
	);
}

type TeacherCandidateListProps = {
	filteredCount: number;
	maxRendered: number;
	visibleCandidates: Candidate[];
	showWorkloadDetails: boolean;
	onApply: (facultyId: number) => void;
};

/**
 * TT-TL-MODULES-C04 — extracted unchanged from `TacticalSandboxDock.tsx` to keep
 * the dock under the 1000-line component limit. Renders the bounded, searchable
 * eligible-owner list via `TeacherCandidateCard`.
 */
export function TeacherCandidateList({ filteredCount, maxRendered, visibleCandidates, showWorkloadDetails, onApply }: TeacherCandidateListProps) {
	return (
		<ScrollArea className="h-52 min-h-0 md:h-full md:flex-1">
			<div className="space-y-2 p-3">
				{filteredCount === 0 ? (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
						No eligible owner matches this search. Clear the search or pick another block.
					</div>
				) : (
					<>
					{filteredCount > maxRendered ? (
						<div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
							Showing the first {maxRendered} of {filteredCount} eligible owners. Use search to narrow the list.
						</div>
					) : null}
					{visibleCandidates.map((candidate) => (
						<TeacherCandidateCard
							key={candidate.faculty.id}
							candidate={candidate}
							showWorkloadDetails={showWorkloadDetails}
							onApply={onApply}
						/>
					))}
					</>
				)}
			</div>
		</ScrollArea>
	);
}

type TeacherCandidateCardProps = {
	candidate: Candidate;
	showWorkloadDetails: boolean;
	onApply: (facultyId: number) => void;
};

export function TeacherCandidateCard({ candidate, showWorkloadDetails, onApply }: TeacherCandidateCardProps) {
	return (
		<div key={candidate.faculty.id} className="min-w-0 rounded-md border border-border/80 bg-card p-3 shadow-sm" data-teacher-candidate-row="true">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						<p className="truncate text-sm font-semibold text-foreground">{facultyDisplayName(candidate.faculty)}</p>
						{candidate.isCurrent ? <Badge variant="outline" className="h-5 px-1.5 text-xs">Current</Badge> : null}
						{candidate.isSelected ? <Badge className="h-5 px-1.5 text-xs">Previewed</Badge> : null}
					</div>
					<p className="text-xs text-muted-foreground">
						{candidate.faculty.department ?? 'Unassigned'}
						{candidate.faculty.specialization ? ` - ${candidate.faculty.specialization}` : ''}
					</p>
				</div>
				<Button
					type="button"
					size="sm"
					variant={candidate.isSelected ? 'secondary' : 'outline'}
					className="h-8 text-xs"
					onClick={() => onApply(candidate.faculty.id)}
					aria-label={`Use ${facultyDisplayName(candidate.faculty)} for this sandbox repair`}
				>
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
	);
}
