/**
 * A7-C1 — the plain-language Year Setup status card.
 *
 * EXTRACTED from `RolloverGuidanceCard.tsx` (which stood at 851 physical lines,
 * against the AGENTS.md §8 limit of 1000) so the card could take the plain
 * treatment without growing past the limit. It is PRESENTATION ONLY: every
 * handler, gate, endpoint and `data-testid` is passed in from the card, so no
 * behaviour moved into this file.
 *
 * Reachable ONLY through the card's opt-in `plainLanguageNextStep` prop, which
 * only `/admin/year-setup` passes. The five other mounts of the card render the
 * card's original JSX unchanged.
 *
 * Layout rules honoured here (AGENTS.md §8): one primary action per card, the
 * rest outline/ghost; `min-h-11` on every interactive control; `@/ui` primitives
 * only; no raw `<details>`, `<select>`, or `title=`; counts as an inline stat
 * line, never a metric card.
 *
 * A3-C14 (2026-09-29) — the DEFAULT VIEW is one sentence and one button. The
 * drift badges, the counts line, the server conflict messages, the field-level
 * EnrollPro changes and the standalone read-only preview moved into `detail`,
 * which renders inline for every other mount of this card and inside the page's
 * one quiet "Details for IT" fold on `/admin/year-setup`. Nothing was deleted;
 * the raw database ids in the reconfigured-sections list are the one thing that
 * was reworded, because the packet bans raw codes where a scheduler can see.
 */
import { Archive, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { Label } from '@/ui/label';
import { Switch } from '@/ui/switch';
import { cn } from '@/lib/utils';
import { useCalmYearSetupDetails } from './CalmYearSetupDetails';
import type { ArchiveAndSyncPreviewResult, RecoveryClassifierResult, RolloverStatus } from '@/lib/settings';
import {
	PLAIN_KEEP_GRADE_WINDOWS_LABEL,	PLAIN_KEEP_GRADE_WINDOWS_LINE,
	PLAIN_KEEP_SCHEDULING_RULES_LABEL,
	PLAIN_KEEP_SCHEDULING_RULES_LINE,
	PLAIN_KEEP_SWITCH_OFF_LINE,
	PLAIN_SECONDARY_LABEL,
	plainClearableCopy,
	plainKeptForReferenceCopy,
	plainKeptYearLine,
	plainYearSetupCopy,
	type PlainYearSetupCopy,
} from './rollover-plain-copy';

/** Drift status -> plain badge treatment. Same four statuses as the card's map. */
const PLAIN_DRIFT_BADGE: Record<string, string> = {
	aligned: 'border-emerald-200 bg-emerald-50 text-emerald-700',
	'atlas-stale': 'border-warning-border bg-warning-muted text-warning',
	'enrollpro-unreachable': 'border-border bg-muted text-muted-foreground',
	'mapping-conflict': 'border-destructive/40 bg-destructive/10 text-destructive',
};

function plainDriftBadgeLabel(copy: PlainYearSetupCopy): string {
	if (copy.whatHappened.startsWith('Checking')) return 'Checking school year';
	if (copy.primarySavesTerms) return 'Terms not saved';
	return 'School year status';
}

export type PlainYearSetupCardProps = {
	loading: boolean;
	status: RolloverStatus | null;
	copy: PlainYearSetupCopy;
	archivePreview: ArchiveAndSyncPreviewResult | null;
	archivePreviewLoading: boolean;
	/** Live flag from `describeTermAuthority`, kept so the badge stays truthful. */
	termBadgeLabel: string | null;
	recoveryClassification: RecoveryClassifierResult | null;
	canOfferTestDataMarking: boolean;
	error: string | null;
	// Handlers — the card's own, unchanged.
	previewing: boolean;
	applying: boolean;
	archiving: boolean;
	termPreviewLoading: boolean;
	termApplying: boolean;
	markingTestData: boolean;
	onPreview: () => void;
	onStartYear: () => void;
	onSaveTerms: () => void;
	onOpenRecoveryConfirm: () => void;
	onOpenMarkTestDataConfirm: () => void;
	// ── A7-C4: the two year-setup carry switches. State is HELD BY THE CARD
	// (`RolloverGuidanceCard`), which owns the request; this file only renders
	// them and reports a change. Both arrive already ON.
	keepSchedulingRules: boolean;
	keepGradeTimeWindows: boolean;
	onKeepSchedulingRulesChange: (next: boolean) => void;
	onKeepGradeTimeWindowsChange: (next: boolean) => void;
};

/**
 * A7-C4 — ONE switch row: a `@/ui/switch` with the operator's own label beside
 * it and the ONE short line that says what it keeps, swapped for the off-state
 * sentence when the switch is off. No chip, no header row, no second status for
 * the same fact, no ellipsis (packet R2).
 */
function CarrySwitchRow(props: {
	id: string;
	testId: string;
	label: string;
	line: string;
	checked: boolean;
	disabled: boolean;
	onCheckedChange: (next: boolean) => void;
}) {
	const { id, testId, label, line, checked, disabled, onCheckedChange } = props;
	return (
		<div className="flex items-start gap-3" data-testid={testId}>
			<div className="min-w-0 flex-1">
				<Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-5">
					{label}
				</Label>
				<p className="text-xs text-muted-foreground" data-testid={`${testId}-line`}>
					{checked ? line : PLAIN_KEEP_SWITCH_OFF_LINE}
				</p>
			</div>
			<Switch
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
				// `h-8` is the smallest size the project's own mouse-first guard
				// accepts (`a7-year-setup-plain-words` row 3 requires `min-h-11`,
				// `h-10` or `h-8` on every interactive control in this card). A 44px
				// pill would be a visually wrong control for a switch, so the larger
				// hit area is carried by the row instead: the `Label htmlFor` above
				// makes the whole label line a second target for the same control.
				className="mt-0.5 h-8 w-11"
				aria-label={label}
			/>
		</div>
	);
}

export function PlainYearSetupCard(props: PlainYearSetupCardProps) {
	const {
		status, copy, archivePreview, archivePreviewLoading, termBadgeLabel,
		recoveryClassification, canOfferTestDataMarking, error,
		previewing, applying, archiving, termPreviewLoading, termApplying,
		onPreview, onStartYear, onSaveTerms, onOpenRecoveryConfirm, onOpenMarkTestDataConfirm,
		keepSchedulingRules, keepGradeTimeWindows,
		onKeepSchedulingRulesChange, onKeepGradeTimeWindowsChange,
	} = props;

	const driftStatus = status?.drift.status ?? 'enrollpro-unreachable';
	const busy = previewing || applying || archiving || termApplying;
	const counts = status?.counts ?? null;

	/**
	 * A3-C14 — ONE SENTENCE. The operator's words: the default view is "one
	 * sentence and one button", and "nothing else competes". The aligned
	 * sentence already names the year, so the second line's "Nothing to do.
	 * 2023-2024 is ready." says the same fact again in a longer form; when
	 * ATLAS is aligned there is genuinely nothing to say, so it is not said.
	 * Every state that needs something keeps its second line — the block
	 * decisions below are unchanged, and a state with no primary action (a
	 * leftover-data conflict, an unreachable EnrollPro) still explains itself.
	 */
	const showWhatToDo = copy.whatToDo != null && driftStatus !== 'aligned';

	// A7-C5: the switches appear above BOTH primaries whose request carries
	// `yearSetupCarry` — the rollover-sync start and the archive-shaped start.
	// The archive path really did carry over on the server all along
	// (`archiveAndSyncActiveYear` -> `applyRolloverSync` ->
	// `resolveYearSetupCarryOptions`), so excluding it here hid a control that
	// was already governing a real decision: ATLAS was keeping last year's setup
	// with no way to turn it off and no way to see it.
	// The ordered-terms save is still excluded, and still correctly: that request
	// genuinely carries nothing, and a switch above an action that ignores it
	// silently does nothing.
	const showCarrySwitches = copy.primaryLabel != null
		&& !copy.primarySavesTerms;

	const canClearTestData = recoveryClassification?.classification === 'TEST_DATA_RECOVERY_AVAILABLE';

	/**
	 * A3-C14 — the IT DETAIL BLOCK. Everything the packet names as "too
	 * technical": the drift badges, the persisted/unverified counts line, the
	 * server's conflict messages, the EnrollPro field-by-field changes, and the
	 * standalone read-only preview. It is not deleted — it moves behind the
	 * page's one quiet fold, so a scheduler never meets it and a person
	 * diagnosing a year can still open it.
	 *
	 * IT renders INLINE when no fold is mounted (every other consumer of this
	 * card), and into the fold's panel when `/admin/year-setup` mounts one.
	 */
	const detail = (
		<>
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="outline" className={cn('gap-1', PLAIN_DRIFT_BADGE[driftStatus])} data-testid="rollover-banner-status">
					{props.loading ? <Loader2 className="size-3.5 animate-spin" /> : copy.primarySavesTerms ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
					{termBadgeLabel ?? plainDriftBadgeLabel(copy)}
				</Badge>
				{status?.enrollProActiveYear ? (
					<Badge variant="outline" className="border-border bg-muted text-muted-foreground">
						EnrollPro {status.enrollProActiveYear.yearLabel}
					</Badge>
				) : null}
			</div>

			{/* Brought-in counts as an inline stat line, never a metric card. */}
			{counts ? (
				<p className="text-xs text-muted-foreground" data-testid="admin-year-setup-counts">
					In ATLAS right now: {counts.sectionCount} sections and {counts.facultyCount} teachers.
				</p>
			) : null}

			{status?.conflicts?.length ? (
				<ul className="space-y-1 text-xs text-destructive">
					{status.conflicts.slice(0, 3).map((conflict) => (
						<li key={conflict.code}>{conflict.message}</li>
					))}
				</ul>
			) : null}

			{status?.reconfiguredSections?.length ? (
				<div className="space-y-1 text-xs text-warning">
					<p className="font-medium">{status.reconfiguredSections.length} section(s) changed name, grade, or program in EnrollPro:</p>
					<ul className="ml-3 list-disc space-y-0.5">
						{status.reconfiguredSections.slice(0, 5).map((section) => {
							// A3-C14: the raw grade-level and program ids are GONE.
							// They were database identifiers printed to a scheduler,
							// which the packet bans outright, and naming the FIELD
							// that moved is enough to act on — the exact values are
							// one EnrollPro click away and the section name is here.
							const changedFields: string[] = [];
							if (section.previousName !== section.newName) changedFields.push('name');
							if (section.previousGradeLevelId !== section.newGradeLevelId) changedFields.push('grade');
							if (section.previousProgramType !== section.newProgramType) changedFields.push('program');
							return (
								<li key={section.externalId} data-testid="rollover-reconfigured-section">
									{section.sectionName}: {changedFields.join(', ')} updated in EnrollPro
								</li>
							);
						})}
					</ul>
				</div>
			) : null}

			{/* The standalone read-only preview. It stays exactly as it was — a
			    calm, non-destructive read — and it simply is not the default
			    view's one button any more, so it lives with the other detail. */}
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onPreview} disabled={busy} data-testid="rollover-banner-preview">
					{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
					{PLAIN_SECONDARY_LABEL}
				</Button>
			</div>
		</>
	);

	/**
	 * A3-C14 — where the detail goes. `null` means "this card is not inside the
	 * calm fold", and then the detail renders inline exactly where it always
	 * has. A panel that has not attached yet renders NOTHING for one commit
	 * rather than falling back inline, which would flash the technical surface
	 * above the calm card for a frame.
	 */
	const calm = useCalmYearSetupDetails();

	return (
		<>
			<Card
				className="border-slate-200 bg-white/80 shadow-none"
				data-testid="rollover-guidance-card"
			>
				<CardContent className="flex flex-col gap-3 p-4">
					{/* What happened / what to do. The operator's own sentence names
					    EnrollPro, so naming it here is plain, not leakage. */}
					<div className="space-y-1" data-testid="admin-year-setup-next-step">
						<p className="text-sm font-semibold text-foreground">{copy.whatHappened}</p>
						{showWhatToDo ? <p className="text-sm text-muted-foreground">{copy.whatToDo}</p> : null}
					</div>

					{/* The kept-for-reference explanation, built from the preview the card
					    already holds. The server's technical summary/syncPlan strings are
					    deliberately not quoted here (A7-C1 handoff, W5).

					    It stays in the DEFAULT view, and that is a considered choice:
					    it is the preview of what the one button is about to do, and the
					    operator's direction is that the button "previews first". A
					    preview the operator cannot see is not a preview. */}
					{copy.primaryStartsArchivedYear ? (
						<div className="space-y-2 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900" data-testid="rollover-archive-flow">
							<div className="flex items-center gap-1.5 font-medium">
								<Archive className="size-3.5 shrink-0" />
								<span>Keep the old school year, then start the new one</span>
							</div>
							<p>{plainKeptForReferenceCopy(archivePreview)}</p>
							{archivePreviewLoading ? <p className="text-sky-700">Loading what will be kept...</p> : null}
							{archivePreview?.yearsToArchive.length ? (
								<ul className="ml-3 list-disc space-y-0.5 text-sky-800">
									{archivePreview.yearsToArchive.map((year) => (
										<li key={year.schoolYearId} data-testid="rollover-archive-year">{plainKeptYearLine(year.yearLabel)}</li>
									))}
								</ul>
							) : null}
						</div>
					) : null}

					{/* Leftover data must be dealt with by hand, so it keeps its own blocks
					    and never becomes the one primary action. A3-C14: these stay in the
					    DEFAULT view even though they are the only thing left when the year
					    cannot simply be started — a scheduler must be able to fix this
					    without opening anything. */}
					{canClearTestData ? (
						<div className="space-y-2 rounded-md border border-warning-border bg-warning-muted p-3 text-xs text-warning-foreground">
							<p className="font-medium">{recoveryClassification?.message}</p>
							<p>{plainClearableCopy(recoveryClassification?.artifactCounts ?? null)}</p>
							{recoveryClassification?.blockers.length ? (
								<ul className="ml-3 list-disc space-y-0.5 text-warning">
									{recoveryClassification.blockers.map((blocker) => (
										<li key={blocker.code}>{blocker.message}</li>
									))}
								</ul>
							) : null}
							<Button type="button" size="sm" className="min-h-11" onClick={onOpenRecoveryConfirm} data-testid="rollover-banner-clear-test-data">
								Clear leftover test data and start the new year
							</Button>
						</div>
					) : null}

					{canOfferTestDataMarking ? (
						<div className="space-y-2 rounded-md border border-warning-border bg-warning-muted p-3 text-xs text-warning-foreground">
							<p className="font-medium">{recoveryClassification?.message}</p>
							<p>Mark this school year as test data. Nothing is cleared until you review it.</p>
							<Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onOpenMarkTestDataConfirm} data-testid="rollover-banner-mark-test-data">
								Mark as test data
							</Button>
						</div>
					) : null}

					{/*
					 * A3-C4 SUBTRACTION. The `rollover-automation-line` paragraph used to
					 * live here ("Nothing changes in ATLAS until you press the button"). The
					 * two switches now make the pre-press state VISIBLE, so the reassurance
					 * line says the same thing a second time in a different place — and the
					 * design gate (AGENTS.md §11) does not allow a region to gain words
					 * without giving as much back. It is removed from THIS mount only; the
					 * other five `RolloverGuidanceCard` mounts still render their own
					 * automation line, untouched.
					 */}

					{error ? <p className="text-xs font-medium text-destructive" data-testid="rollover-plain-error">{error}</p> : null}

					{/* A7-C5 — the two switches, immediately above the ONE primary action:
					    that is the moment the choice is made, so it belongs there, not on a
					    settings page. The operator's own requirement is that they read as
					    "plain sentences, on by default", which is what they already are.

					    THEY APPEAR ONLY ABOVE AN ACTION WHOSE REQUEST CARRIES THEM. The
					    plain card has three primaries and two of them post
					    `yearSetupCarry` (the rollover-sync start and the archive-shaped
					    start); the ordered-terms save does not, so no switch is rendered
					    above it. */}
					{showCarrySwitches ? (
						<div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3" data-testid="year-setup-keep-switches">
							<CarrySwitchRow
								id="year-setup-keep-scheduling-rules"
								testId="year-setup-keep-scheduling-rules-row"
								label={PLAIN_KEEP_SCHEDULING_RULES_LABEL}
								line={PLAIN_KEEP_SCHEDULING_RULES_LINE}
								checked={keepSchedulingRules}
								disabled={busy}
								onCheckedChange={onKeepSchedulingRulesChange}
							/>
							<CarrySwitchRow
								id="year-setup-keep-grade-windows"
								testId="year-setup-keep-grade-windows-row"
								label={PLAIN_KEEP_GRADE_WINDOWS_LABEL}
								line={PLAIN_KEEP_GRADE_WINDOWS_LINE}
								checked={keepGradeTimeWindows}
								disabled={busy}
								onCheckedChange={onKeepGradeTimeWindowsChange}
							/>
						</div>
					) : null}

					{/* A3-C14 — THE ONE BUTTON. The secondary read-only preview is not
					    here any more; it is in the detail block. One card, one action,
					    which is what the operator asked to see first. */}
					{copy.primaryLabel ? (
						<div className="flex flex-wrap items-center gap-2">
							<Button
								type="button"
								size="sm"
								className="min-h-11"
								disabled={busy}
								data-testid={copy.primarySavesTerms
									? 'rollover-term-repair-action'
									: copy.primaryStartsArchivedYear
										? 'rollover-archive-and-sync'
										: 'rollover-banner-sync'}
								onClick={copy.primarySavesTerms ? onSaveTerms : onStartYear}
							>
								{applying || archiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : termPreviewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
								{copy.primaryLabel}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>

			{/* The detail, inline for every other mount, or inside the page's one
			    quiet fold. Nothing is deleted either way. */}
			{calm === null ? detail : calm.panel ? createPortal(detail, calm.panel) : null}
		</>
	);
}
