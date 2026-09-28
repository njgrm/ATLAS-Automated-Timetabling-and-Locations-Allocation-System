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
 * only; no raw `<select>`, `<details>`, or `title=`; counts as an inline stat
 * line, never a metric card.
 */
import { Archive, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card, CardContent } from '@/ui/card';
import { cn } from '@/lib/utils';
import type { ArchiveAndSyncPreviewResult, RecoveryClassifierResult, RolloverStatus } from '@/lib/settings';
import {
	PLAIN_SECONDARY_LABEL,
	plainAutomationLine,
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
};

export function PlainYearSetupCard(props: PlainYearSetupCardProps) {
	const {
		status, copy, archivePreview, archivePreviewLoading, termBadgeLabel,
		recoveryClassification, canOfferTestDataMarking, error,
		previewing, applying, archiving, termPreviewLoading, termApplying,
		onPreview, onStartYear, onSaveTerms, onOpenRecoveryConfirm, onOpenMarkTestDataConfirm,
	} = props;

	const driftStatus = status?.drift.status ?? 'enrollpro-unreachable';
	const automation = status?.automation;
	const busy = previewing || applying || archiving || termApplying;
	const counts = status?.counts ?? null;

	const canClearTestData = recoveryClassification?.classification === 'TEST_DATA_RECOVERY_AVAILABLE';

	return (
		<Card
			className="border-slate-200 bg-white/80 shadow-none"
			data-testid="rollover-guidance-card"
		>
			<CardContent className="flex flex-col gap-3 p-4">
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

				{/* What happened / what to do. The operator's own sentence names
				    EnrollPro, so naming it here is plain, not leakage. */}
				<div className="space-y-1" data-testid="admin-year-setup-next-step">
					<p className="text-sm font-semibold text-foreground">{copy.whatHappened}</p>
					{copy.whatToDo ? <p className="text-sm text-muted-foreground">{copy.whatToDo}</p> : null}
				</div>

				{/* Brought-in counts as an inline stat line, never a metric card. */}
				{counts ? (
					<p className="text-xs text-muted-foreground" data-testid="admin-year-setup-counts">
						In ATLAS right now: {counts.sectionCount} sections and {counts.facultyCount} teachers.
					</p>
				) : null}

				{/* The kept-for-reference explanation, built from the preview the card
				    already holds. The server's technical summary/syncPlan strings are
				    deliberately not quoted here (A7-C1 handoff, W5). */}
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
				    and never becomes the one primary action. */}
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
							{status.reconfiguredSections.slice(0, 5).map((section) => (
								<li key={section.externalId}>
									{section.sectionName}: {section.previousName !== section.newName ? `name "${section.previousName}" to "${section.newName}"` : ''}
									{section.previousGradeLevelId !== section.newGradeLevelId ? ` grade ${section.previousGradeLevelId} to ${section.newGradeLevelId}` : ''}
									{section.previousProgramType !== section.newProgramType ? ` program ${section.previousProgramType} to ${section.newProgramType}` : ''}
								</li>
							))}
						</ul>
					</div>
				) : null}

				{automation ? (
					<p className="text-xs text-muted-foreground" data-testid="rollover-automation-line">
						{plainAutomationLine({
							enabled: automation.enabled,
							healthy: automation.enabled && automation.lastResult === 'success' && (automation.consecutiveFailures ?? 0) === 0,
							backoff: automation.enabled && (automation.consecutiveFailures ?? 0) > 0,
							lastAttemptAt: automation.lastAttemptAt,
							nextAttemptAt: automation.nextAttemptAt,
							consecutiveFailures: automation.consecutiveFailures ?? 0,
						})}
					</p>
				) : null}

				{error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

				{/* ONE primary and ONE plain secondary. The secondary is the card's
				    existing preview handler, unchanged, and is calm by construction
				    because it only reads. */}
				<div className="flex flex-wrap items-center gap-2">
					{copy.primaryLabel ? (
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
					) : null}
					<Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onPreview} disabled={busy} data-testid="rollover-banner-preview">
						{previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						{PLAIN_SECONDARY_LABEL}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
