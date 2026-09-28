import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, SearchCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { SetupImpactDialog } from '@/components/timetable/ScheduleReviewWorkspaceDialogs';
import { describeRunInputDrift, type RunInputDrift } from '@/components/timetable/timetableDriftRouting';
import {
	CHANGE_NOTICE_UNVERIFIED_SENTENCE,
	changeNoticeSentence,
	SimpleChangeNotice,
} from '@/components/timetable/simple/SimpleChangeNotice';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';
import type { RolloverStatus } from '@/lib/settings';
import type { DraftReport } from '@/types';

/**
 * R6 — Simple must surface run input freshness, ordered-term authority, and
 * rollover drift before applying changes (findings A-11/B-06/B-14). This is the
 * same canonical information Advanced already renders, with the same authority
 * authority and zero duplication of the setup readers.
 *
 * The per-domain chips are informational; each changed domain also renders a
 * real, mounted repair action (`primaryHref`/domain href) so the routing data is
 * live, not dead.
 *
 * S4-client / D5 — the banner also renders the explicit, operator-triggered
 * "Regenerate to apply" action plus a read-only impact preview. Generation is
 * never automatic: `onRegenerate` fires only from the operator's click, and a
 * published run never exposes the action at all (state the guard rather than
 * silently hiding it).
 */
type SimpleDriftBannerProps = {
	schoolId: number;
	schoolYearId: number | null;
	activeGeneratedRunId: number | null;
	draft: DraftReport | null;
	isPreGenerationWorkspace: boolean;
	loading: boolean;
	onRefresh: () => void;
	onRolloverStatus?: (status: RolloverStatus) => void;
	/** The shared capability model; the setup-input gate guards the repair actions. */
	capabilities: TimetableCapabilities;
	/**
	 * F4: the strict published predicate. A published run must never expose the
	 * draft-only changes; it routes to revision/review guidance instead.
	 */
	isPublished: boolean;
	/**
	 * C01R C3 — `strip` keeps the standalone full-width amber strip (used by
	 * the `/timetable/setup` pane); `inline` renders the same message line and
	 * the same repair actions without the strip chrome, as the message line of
	 * the Simple header's single status region.
	 */
	layout?: 'strip' | 'inline';
	/**
	 * A3 — when false the banner renders only its plain-language message line.
	 * The header uses this so the setup-input repairs (Fix rooms / Preview
	 * impact actions) live only on `/timetable/setup`, one click away,
	 * instead of competing with the single primary action.
	 */
	showActions?: boolean;
	/**
	 * A3 — when false the rollover guidance card is not mounted here (it moves to
	 * `/timetable/setup`). The caller then owns the rollover-status subscription.
	 */
	showRolloverGuidance?: boolean;
	/**
	 * D5 — the explicit operator-triggered regeneration. When provided (and the
	 * run is not published) the banner renders "Regenerate to apply" with a
	 * read-only impact preview. When absent the affordance is not mounted, so a
	 * caller that cannot regenerate never shows a dead control.
	 */
	onRegenerate?: () => void;
	/** The shared generation capability. False disables the action with its gate reason. */
	regenerationEnabled?: boolean;
	regenerating?: boolean;
	onStartRevision?: () => void;
};

export function SimpleDriftBanner({
	schoolId,
	// schoolYearId remains part of the shared banner contract for its callers.
	activeGeneratedRunId,
	draft,
	isPreGenerationWorkspace,
	loading,
	onRefresh,
	onRolloverStatus,
	capabilities,
	isPublished,
	layout = 'strip',
	showActions = true,
	showRolloverGuidance = true,
	onRegenerate,
	regenerationEnabled = true,
	regenerating = false,
	onStartRevision,
}: SimpleDriftBannerProps) {
	const inputState = draft?.inputState ?? null;
	/* #59 / #17 — the comparison is timed against the run ON SCREEN, not read on
	 * its own. A comparison written before this run finished describes an older
	 * schedule, so its STALE verdict is not a claim about this one. */
	const drift = useMemo(
		() => describeRunInputDrift(inputState, draft ? { finishedAt: draft.finishedAt, createdAt: draft.createdAt } : null),
		[inputState, draft?.finishedAt, draft?.createdAt, draft],
	);
	const [showImpactPreview, setShowImpactPreview] = useState(false);
	const [showRegenerateImpact, setShowRegenerateImpact] = useState(false);

	const repairGate = capabilities.gates.setupInputStatus;
	const domainHrefs = new Set(drift.domains.map((domain) => domain.href));
	// When the umbrella primary href has no per-domain control (unmapped/unknown
	// domain), render one explicit primary action so `primaryHref` is never dead.
	const needsPrimaryFallback = showPrimaryFallback(drift.primaryHref, domainHrefs);

	const handleRegenerate = () => {
		// D5 guard: a published run is never auto-regenerated and never exposes the
		// action. This is the second, code-level guard behind the render guard.
		if (isPublished) return;
		if (!regenerationEnabled) return;
		if (activeGeneratedRunId == null) return;
		setShowRegenerateImpact(false);
		onRegenerate?.();
	};

	const showRunDrift = !isPreGenerationWorkspace && draft != null && drift.status !== 'FRESH';
	/* The alarm sentence, and it is shown ONLY when the comparison is
	 * trustworthy about this run. `driftClaim` is null otherwise, and
	 * `freshnessNote` carries the one thing that may honestly be said instead —
	 * never both, so the band cannot claim drift it cannot prove. Drift itself is
	 * NOT hidden: the changed domains, their repair links and the neutral notice
	 * all still render, because an untimed or pre-run comparison is "not proven",
	 * not "nothing is wrong". */
	const driftClaimed = drift.driftClaim !== null;
	/* Amber is reserved for a claim ATLAS can back. A STALE comparison that
	 * predates this run is not an alarm about this run, so it wears the same calm
	 * neutral styling the existing `UNKNOWN` case already wears (J4.3/J4.4: two
	 * different confidences must not share one alarm). */
	const alarming = drift.status === 'STALE' && driftClaimed;
	/* The unverified note replaces the STALE claim ONLY. On the `UNKNOWN` path the
	 * server already said it could not check, and this component's own calm copy
	 * ("nothing is known to have changed") is the honest sentence for that; the
	 * unverified note would restate the same fact in a second wording. */
	const unverifiedNote = drift.status === 'STALE' && !driftClaimed ? drift.freshnessNote : null;
	/* "Update schedule" applies a drift. With no trustworthy drift there is
	 * nothing to apply, so the affordance is not mounted — the pre-existing
	 * published/regenerating guards are unchanged. */
	const showRegenerateAction = Boolean(onRegenerate) && !isPublished && showRunDrift && driftClaimed;
	const regenerateDisabled = regenerating || loading || !regenerationEnabled || activeGeneratedRunId == null;
	/* A2 C11 S2 (item 1) — the ONE sentence, derived once. A trustworthy, claimed
	 * comparison NAMES the changed areas; an unproven one may not, so it keeps the
	 * server's own honest note. `checkedAt` is deliberately NOT read here: a
	 * relative age is not a fact about a schedule. */
	const domainLabels = drift.domains.map((domain) => domain.label);
	const changeSentence = driftClaimed
		? changeNoticeSentence(domainLabels)
		: unverifiedNote ?? CHANGE_NOTICE_UNVERIFIED_SENTENCE;

	return (
		<>
			{showRunDrift ? (
				<>
			{/* A2 C11 S2 (item 1, Lane C's spec) — the row itself lives in
				 * `SimpleChangeNotice`, so the Simple header, the Expert header and
				 * the `/timetable/setup` strip cannot drift onto two different
				 * banners. What stays HERE is what only this component knows: the
				 * drift predicate, the published-run guard, and the per-domain repair
				 * controls that belong to the setup strip.
				 *
				 * WHAT CHANGED, and why each part had to go:
				 *  - the bold `Schedule information changed` TITLE is gone. It said
				 *    the same thing as the sentence beside it, so the row read as two
				 *    titles; the sentence now names WHAT changed instead.
				 *  - the ` · checked 10s ago` tail is gone. A relative age is not a
				 *    fact about the schedule and it moved every ten seconds.
				 *  - the amber/red alarm styling is gone. Nothing is wrong yet: the
				 *    run on screen is unchanged, and the change is a notice. The two
				 *    surviving confidences still differ — by SENTENCE, which survives
				 *    a monochrome read — so the #17/#59 distinction is intact.
				 *  - the visible per-domain CHIPS are gone. They are the names, and
				 *    the names are in the sentence now; at 390 px they were what
				 *    squeezed the sentence into a one-word column. They remain in the
				 *    DOM as `sr-only` text and in the detail dialog.
				 *  - `Preview impact` + `Regenerate to apply` became ONE secondary
				 *    (`See what changed`) and ONE primary (`Update schedule`), the
				 *    primary being `variant="outline"` so DRAFT-UX-C01's single solid
				 *    primary (`Publish schedule`) is not joined by a second. */}
			<SimpleChangeNotice
				sentence={changeSentence}
				changedAreas={domainLabels}
				layout={layout}
				status={drift.status}
				claimable={driftClaimed}
				tone={alarming ? 'neutral' : 'calm-note'}
				onShowDetail={() => setShowImpactPreview(true)}
				onApply={showRegenerateAction ? () => setShowRegenerateImpact(true) : undefined}
				applyDisabled={regenerateDisabled}
				applyDisabledReason={regenerationEnabled ? null : 'Generation is not available'}
			/>
			{/* The per-domain REPAIRS stay exactly where they were — on the setup
				 * strip, one click from the area they repair. They are deliberately
				 * NOT on the header row: the header gets one sentence and one pair
				 * of actions, and the setup pane is where the per-area repairs live. */}
			{showActions ? (
				<div
					data-testid="timetable-simple-drift-repairs"
					className="flex min-h-8 flex-wrap items-center gap-1.5 border-b px-3 py-1 text-xs"
				>
				{isPublished ? (
					<>
						<span
							className="shrink-0 rounded border border-amber-300 bg-white/70 px-2 py-0.5 font-semibold text-amber-900"
							data-testid="timetable-simple-published-drift-guidance"
						>Published schedule is safe to view. Changes are made in a separate revision.</span>
						<Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs" data-testid="timetable-simple-review-published-changes">
							<Link to={drift.primaryHref}>Review changes</Link>
						</Button>
						<Button type="button" variant="default" size="sm" className="h-8 shrink-0 text-xs" onClick={onStartRevision} disabled={!onStartRevision} data-testid="timetable-simple-start-revision">
							Start a revision
						</Button>
						</>
					) : (
					<>
					<Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-xs" data-testid="timetable-simple-review-draft-changes">
						<Link to={drift.primaryHref}>Review changes</Link>
					</Button>
					{/* Per-domain routed repairs. Disabled (never dead) when the shared
					    setup-input capability gate denies the action. */}
					{repairGate.enabled ? (
						drift.domains.map((domain) => (
							<Button
								key={domain.domain}
								asChild
								variant="outline"
								size="sm"
								className="h-7 shrink-0 gap-1 border-amber-300 px-2 text-xs font-semibold text-amber-900"
							>
								<Link
									to={domain.href}
									data-testid={`timetable-simple-repair-${domain.domain}`}
									data-primary-repair={domain.href === drift.primaryHref ? 'true' : undefined}
								>
									<ExternalLink className="size-3" aria-hidden="true" />
									Fix {domain.label}
								</Link>
							</Button>
						))
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled
							aria-label={repairGate.reason ? `Repair setup — ${repairGate.reason}` : 'Repair setup'}
							className="h-7 shrink-0 gap-1 border-amber-300 px-2 text-xs font-semibold text-amber-900"
							data-testid="timetable-simple-repair-disabled"
						>
							Repair setup
						</Button>
					)}
					{repairGate.enabled && needsPrimaryFallback ? (
						<Button
							asChild
							variant="outline"
							size="sm"
							className="h-7 shrink-0 gap-1 border-amber-300 px-2 text-xs font-semibold text-amber-900"
						>
							<Link to={drift.primaryHref} data-testid="timetable-simple-repair-primary" data-primary-repair="true">
								<ExternalLink className="size-3" aria-hidden="true" />
								Open Year Setup
							</Link>
						</Button>
					) : null}
					<Button type="button" variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => setShowImpactPreview(true)} data-testid="timetable-simple-repair-preview-impact">
						<SearchCheck className="size-3" />
						Preview impact
					</Button>
					</>
					)}
				</div>
			) : null}
				</>
			) : null}
			{showRolloverGuidance ? (
				<RolloverGuidanceCard compact schoolId={schoolId} onApplied={() => onRefresh()} onStatus={onRolloverStatus} />
			) : null}
			<SetupImpactDialog
				open={showImpactPreview && !isPublished}
				onOpenChange={setShowImpactPreview}
				inputState={inputState}
				changedDomainLabels={drift.domains.map((domain) => domain.label)}
			/>
			<RegenerateImpactDialog
				open={showRegenerateImpact && !isPublished}
				onOpenChange={setShowRegenerateImpact}
				status={drift.status}
				changedDomainLabels={drift.domains.map((domain) => domain.label)}
				requiresRegeneration={drift.requiresRegeneration}
				generationEnabled={regenerationEnabled}
				onConfirm={handleRegenerate}
			/>
		</>
	);
}

/**
 * D5 read-only impact preview. It states what will change, that nothing changes
 * until the operator confirms, and that valid draft placements are preserved.
 * It dispatches no request of its own.
 */
function RegenerateImpactDialog({
	open,
	onOpenChange,
	status,
	changedDomainLabels,
	requiresRegeneration,
	generationEnabled,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	status: RunInputDrift['status'];
	changedDomainLabels: string[];
	requiresRegeneration: boolean;
	generationEnabled: boolean;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="timetable-simple-regenerate-impact-dialog">
				<DialogHeader>
					<DialogTitle>Update this schedule</DialogTitle>
					<DialogDescription>
						{status === 'STALE'
							? 'Nothing has changed yet. ATLAS rebuilds this draft only when you choose Update schedule.'
							: 'ATLAS could not prove this draft matches current setup. Regenerate to rebuild it against the latest data.'}
					</DialogDescription>
				</DialogHeader>
				<div className="rounded-lg border border-border bg-muted/30 p-3">
					<p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Changed setup areas</p>
					<div className="flex flex-wrap gap-2">
						{changedDomainLabels.map((label) => (
							<Badge key={label} variant="outline" className="bg-background text-xs font-semibold">
								{label}
							</Badge>
						))}
					</div>
				</div>
				<p className="text-xs leading-relaxed text-muted-foreground">
					{requiresRegeneration
						? 'At least one changed area needs a fresh generation; regeneration is the explicit way to apply it.'
						: 'Regeneration is the complete, explicit way to apply every changed area.'}
				</p>
				<p className="text-xs leading-relaxed text-muted-foreground" data-testid="timetable-simple-regenerate-preservation-note">
					Valid draft placements are preserved: reviewed placements locked as draft anchors are carried into the new run, and only the classes affected by the changed setup are recomputed.
				</p>
				<p className="text-xs leading-relaxed text-muted-foreground">
					A published schedule is never regenerated automatically; published changes go through a dated revision instead.
				</p>
				<DialogFooter>
					<Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Not now</Button>
					<Button
						variant="default"
						size="sm"
						onClick={onConfirm}
						disabled={!generationEnabled}
						data-testid="timetable-simple-regenerate-confirm"
					>
						Update schedule
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function showPrimaryFallback(primaryHref: string, domainHrefs: Set<string>): boolean {
	return !domainHrefs.has(primaryHref);
}
