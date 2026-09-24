import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ExternalLink, RefreshCw, RotateCw, SearchCheck } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { RolloverGuidanceCard } from '@/components/runtime/RolloverGuidanceCard';
import { SetupImpactDialog, SyncTimetableConfirmDialog } from '@/components/timetable/ScheduleReviewWorkspaceDialogs';
import { createSyncSetupInFlightGuard, runSyncSetup } from '@/lib/timetable-sync-setup';
import { describeRunInputDrift, type RunInputDrift } from '@/components/timetable/timetableDriftRouting';
import { formatCheckedAtAge } from '@/components/timetable/timetableWorkspaceTruth';
import type { TimetableCapabilities } from '@/lib/timetable-capabilities';
import type { RolloverStatus } from '@/lib/settings';
import type { DraftReport } from '@/types';

/**
 * R6 — Simple must surface run input freshness, ordered-term authority, and
 * rollover drift before publish or sync (findings A-11/B-06/B-14). This is the
 * same canonical information Advanced already renders, with the same sync
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
	 * direct setup-sync action; it routes to revision/review guidance instead.
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
	 * impact / Sync with setup) live only on `/timetable/setup`, one click away,
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
};

export function SimpleDriftBanner({
	schoolId,
	schoolYearId,
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
}: SimpleDriftBannerProps) {
	const inputState = draft?.inputState ?? null;
	const drift = useMemo(() => describeRunInputDrift(inputState), [inputState]);
	const [showImpactPreview, setShowImpactPreview] = useState(false);
	const [showRegenerateImpact, setShowRegenerateImpact] = useState(false);
	const [showSyncConfirm, setShowSyncConfirm] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const syncGuardRef = useRef(createSyncSetupInFlightGuard());

	const repairGate = capabilities.gates.setupInputStatus;
	const domainHrefs = new Set(drift.domains.map((domain) => domain.href));
	// When the umbrella primary href has no per-domain control (unmapped/unknown
	// domain), render one explicit primary action so `primaryHref` is never dead.
	const needsPrimaryFallback = showPrimaryFallback(drift.primaryHref, domainHrefs);

	const handleSyncSetup = async () => {
		// F4 defense in depth: a published run never dispatches the direct sync.
		if (isPublished) return;
		if (!schoolYearId || activeGeneratedRunId == null) return;
		setSyncing(true);
		try {
			const outcome = await runSyncSetup({
				schoolId,
				schoolYearId,
				runId: activeGeneratedRunId,
				draftVersion: draft?.version,
				guard: syncGuardRef.current,
			});
			if (outcome.status === 'COMMITTED') {
				const retainedReviewedCount = outcome.data.retainedFacultyPinCount ?? 0;
				toast.success(
					retainedReviewedCount > 0
						? `Timetable synced with setup; retained ${retainedReviewedCount} reviewed teacher assignment(s).`
						: 'Timetable synced with setup.'
				);
				onRefresh();
			} else if (outcome.status === 'REPLAYED') {
				toast.success('Timetable setup already matches the current run. Nothing to change.');
				onRefresh();
			} else if (outcome.status === 'FAILED') {
				toast.error(outcome.error.message);
			}
		} finally {
			setSyncing(false);
			setShowSyncConfirm(false);
		}
	};

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
	const showRegenerateAction = Boolean(onRegenerate) && !isPublished && showRunDrift;
	const regenerateDisabled = regenerating || loading || !regenerationEnabled || activeGeneratedRunId == null;

	return (
		<>
			{showRunDrift ? (
				<div
					role="status"
					data-testid="timetable-simple-input-drift"
					className={layout === 'inline'
						? 'flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-amber-900'
						: 'flex min-h-8 flex-wrap items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-900'}
				>
					<span className="shrink-0 font-semibold">
						{drift.status === 'STALE' ? 'Schedule information changed' : 'Schedule information could not be checked'}
					</span>
					{/* Informational domain chips stay next to the actionable repair control. */}
					{showActions ? drift.domains.map((domain) => (
						<Badge key={domain.domain} variant="outline" className="h-5 border-amber-300 bg-white/70 px-1.5 text-xs font-bold text-amber-800">
							{domain.label}
						</Badge>
					)) : null}
					<span className="min-w-0 flex-1 break-words whitespace-normal text-amber-800">
						{drift.status === 'STALE'
							? 'This schedule no longer matches the latest school information. Refresh before publishing.'
							: 'ATLAS could not check whether this schedule matches current school information. Refresh before publishing.'}
						{formatCheckedAtAge(drift.checkedAt) ? ` · ${formatCheckedAtAge(drift.checkedAt)}` : ''}
					</span>
					{showActions ? (isPublished ? (
						<span
							className="shrink-0 rounded border border-amber-300 bg-white/70 px-2 py-0.5 font-semibold text-amber-900"
							data-testid="timetable-simple-published-drift-guidance"
						>Published schedule: changes go through a new effective-dated revision. Direct sync is not available.</span>
					) : (
					<>
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
					<Button type="button" variant="outline" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={() => setShowImpactPreview(true)} data-testid="timetable-simple-impact-preview">
						<SearchCheck className="size-3" />
						Preview impact
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-7 shrink-0 gap-1 border-amber-300 px-2 text-xs font-semibold text-amber-900"
						onClick={() => setShowSyncConfirm(true)}
						disabled={loading || syncing || activeGeneratedRunId == null}
						data-testid="timetable-simple-sync-setup"
					>
						<RefreshCw className="size-3" />
						Sync with setup
					</Button>
					</>
					)) : null}
					{/* D5 — the explicit regeneration affordance. It is mounted whenever a
					    caller can regenerate and the run is not published, so the operator
					    has one honest way to apply policy / availability / derived-demand
					    changes without a silent automatic rebuild. */}
					{showRegenerateAction ? (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="h-7 shrink-0 gap-1 px-2 text-xs"
								onClick={() => setShowRegenerateImpact(true)}
								data-testid="timetable-simple-regenerate-impact"
							>
								<SearchCheck className="size-3" />
								Preview impact
							</Button>
							<Button
								type="button"
								variant="default"
								size="sm"
								className="h-7 shrink-0 gap-1 px-2 text-xs font-semibold"
								onClick={handleRegenerate}
								disabled={regenerateDisabled}
								aria-label={!regenerationEnabled ? 'Regenerate to apply — generation is not available' : 'Regenerate to apply'}
								data-testid="timetable-simple-regenerate-to-apply"
							>
								<RotateCw className="size-3" />
								Regenerate to apply
							</Button>
						</>
					) : null}
				</div>
			) : null}
			{showRolloverGuidance ? (
				<RolloverGuidanceCard compact schoolId={schoolId} onApplied={() => onRefresh()} onStatus={onRolloverStatus} />
			) : null}
			<SyncTimetableConfirmDialog
				open={showSyncConfirm && !isPublished}
				onOpenChange={setShowSyncConfirm}
				syncing={syncing}
				onSyncNow={() => void handleSyncSetup()}
			/>
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
					<DialogTitle>Regenerate to apply setup changes</DialogTitle>
					<DialogDescription>
						{status === 'STALE'
							? 'Nothing has changed yet. ATLAS rebuilds this draft only when you choose Regenerate to apply.'
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
						? 'At least one changed area only takes effect through a fresh generation; syncing setup alone cannot apply it.'
						: 'The draft can be synced with setup for assignment changes, but regeneration is the complete, explicit way to apply every changed area.'}
				</p>
				<p className="text-xs leading-relaxed text-muted-foreground" data-testid="timetable-simple-regenerate-preservation-note">
					Valid draft placements are preserved: reviewed placements locked as draft anchors are carried into the new run, and only sessions affected by the changed setup are recomputed.
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
						Regenerate to apply
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function showPrimaryFallback(primaryHref: string, domainHrefs: Set<string>): boolean {
	return !domainHrefs.has(primaryHref);
}
