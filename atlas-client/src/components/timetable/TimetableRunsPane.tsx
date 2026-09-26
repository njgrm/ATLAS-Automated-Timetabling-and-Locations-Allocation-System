/**
 * UX-R03e (runs) — the `/timetable/runs` center view.
 *
 * A read-only run history rendered from the rows the workspace already holds
 * from the existing endpoint `GET /api/v1/generation/:schoolId/:schoolYearId/runs`
 * (`generation.router.ts`, `genService.listRuns` → `{ runs, count }`). Only the
 * fields that endpoint returns are shown (`id`, `status`, `runType`, `triggeredBy`,
 * `startedAt`, `finishedAt`, `durationMs`, `version`, `error`, `createdAt`); the
 * list endpoint never returns the run `summary`, so nothing here claims
 * published/blocker state.
 *
 * Selecting a run calls the workspace's existing run-selection
 * (`selectedRunId` / `handleRunChange`) — the same mechanism the schedule
 * header Select uses — then lands back on the schedule surface. There is no
 * second selection path, and no generation, publication or delete action.
 * This component dispatches no data requests: it renders the threaded `runs`.
 *
 * A2-RUNS-PENDING-CUSTODY — an unfetched `runs = []` is not an empty year.
 * `runsPending` and `runsUnavailableReason` are the workspace's own in-flight
 * and failure signals (the same `loading` / `error` the data layer writes in
 * `useTimetableData.loadAll`), threaded in rather than simulated here, so the
 * four states stay distinguishable: still loading, settled and genuinely empty,
 * failed to load, and populated. Only the settled-empty case may claim there is
 * nothing to review, and it says so exactly once.
 */

import { Link } from 'react-router-dom';
import { ChevronLeft, History } from 'lucide-react';
import { generationRunKindLabel, generationRunStateLabel, runAnchorLabel } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import type { GenerationRun } from '@/types';

/**
 * The exact fields `listRuns` selects. `runType` and `version` are returned by
 * the endpoint but absent from the shared client `GenerationRun` interface, so
 * they stay optional here rather than invented.
 */
export type TimetableRunsPaneRun = Pick<
	GenerationRun,
	'id' | 'status' | 'triggeredBy' | 'startedAt' | 'finishedAt' | 'durationMs' | 'error' | 'createdAt'
> & {
	runType?: string | null;
	version?: number | null;
};

type TimetableRunsPaneProps = {
	runs: TimetableRunsPaneRun[];
	/**
	 * A2-RUNS-PENDING-CUSTODY — the workspace's own in-flight signal for the run
	 * read (`useTimetableData`'s `loading`, which `loadAll` raises before it
	 * dispatches `fetchRuns` and lowers in its `finally`). Required, not
	 * defaulted: a caller that cannot say whether the read is in flight must not
	 * be able to render this pane at all, because the default would be the false
	 * claim this change removes.
	 */
	runsPending: boolean;
	/**
	 * The workspace's own failure reason for the load (`useTimetableData`'s
	 * `error`), or null when the read has not failed. Required for the same
	 * fail-closed reason: "the request failed" must never read as "there is
	 * nothing here".
	 */
	runsUnavailableReason: string | null;
	/** The workspace's current run selection (`'latest'` or a run id). */
	selectedRunId: string;
	/** The workspace's existing run-selection handler (same as the header Select). */
	onSelectRun: (value: string) => void;
	formatTimestamp: (value: string | null) => string;
	formatDuration: (value: number | null) => string;
};

/**
 * A2-RUNS-PENDING-CUSTODY — the one place that decides which of the four
 * states the pane is in, so the rule is testable without a DOM and no copy
 * path can drift from it.
 *
 * Precedence is deliberate:
 *   - `pending` wins over everything, because a refresh in flight means the
 *     answer is not known yet (a previous failure must not be re-announced
 *     while a retry is running);
 *   - real rows win over a failure reason, because data already on screen is
 *     not a claim about emptiness;
 *   - only then does a failure reason mean "unavailable" rather than "empty",
 *     and with no reason and no rows the empty claim is finally earned.
 */
export type TimetableRunsViewState = 'pending' | 'unavailable' | 'empty' | 'populated';

export function resolveTimetableRunsViewState(input: {
	runsPending: boolean;
	runsUnavailableReason: string | null;
	runCount: number;
}): TimetableRunsViewState {
	if (input.runsPending) return 'pending';
	if (input.runCount > 0) return 'populated';
	if (input.runsUnavailableReason != null) return 'unavailable';
	return 'empty';
}

function statusVariant(status: TimetableRunsPaneRun['status']): 'secondary' | 'destructive' | 'outline' {
	if (status === 'COMPLETED') return 'secondary';
	if (status === 'FAILED') return 'destructive';
	return 'outline';
}

function isSelectedRun(run: TimetableRunsPaneRun, index: number, selectedRunId: string): boolean {
	if (selectedRunId === String(run.id)) return true;
	return selectedRunId === 'latest' && index === 0;
}

export function TimetableRunsPane({
	runs,
	runsPending,
	runsUnavailableReason,
	selectedRunId,
	onSelectRun,
	formatTimestamp,
	formatDuration,
}: TimetableRunsPaneProps) {
	const viewState = resolveTimetableRunsViewState({
		runsPending,
		runsUnavailableReason,
		runCount: runs.length,
	});

	// The header line describes the surface or the read, never the emptiness.
	// The empty claim is made once, in the body, and only when it is earned.
	const headerLine = viewState === 'pending'
		? 'Checking the generation runs for this school year…'
		: viewState === 'unavailable'
			? 'The generation runs for this school year could not be loaded.'
			: viewState === 'empty'
				? 'Runs · read-only history'
				: `${runs.length} run${runs.length === 1 ? '' : 's'} · newest first · read-only history`;

	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="timetable-runs-pane">
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
				<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Runs</Badge>
				<p className="text-xs text-muted-foreground">{headerLine}</p>
			</div>
			{viewState === 'pending' ? (
				/* Still in flight: say the read is happening. Announcing "no runs"
				 * here is the exact false claim this state exists to prevent. */
				<div className="flex min-h-0 flex-1 items-center justify-center p-4">
					<div
						className="max-w-md space-y-3 text-center"
						data-testid="timetable-runs-pending-state"
						role="status"
						aria-busy="true"
					>
						<History className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm font-medium">Loading generation runs…</p>
						<p className="text-xs text-muted-foreground">
							ATLAS is checking the generation runs for this school year. The list appears as soon as the read finishes.
						</p>
					</div>
				</div>
			) : viewState === 'unavailable' ? (
				/* A failed read is not an empty year. Name the failure instead. */
				<div className="flex min-h-0 flex-1 items-center justify-center p-4">
					<div className="max-w-md space-y-3 text-center" data-testid="timetable-runs-unavailable-state" role="alert">
						<History className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm font-medium">Generation runs could not be loaded</p>
						<p className="text-xs text-muted-foreground">
							ATLAS could not read the generation runs for this school year, so nothing is known about whether there are any. Nothing has changed in your schedule.
						</p>
						{runsUnavailableReason ? (
							<p className="text-xs text-muted-foreground" data-testid="timetable-runs-unavailable-reason">
								{runsUnavailableReason}
							</p>
						) : null}
					</div>
				</div>
			) : viewState === 'empty' ? (
				<div className="flex min-h-0 flex-1 items-center justify-center p-4">
					<div className="max-w-md space-y-3 text-center" data-testid="timetable-runs-empty-state">
						<History className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
						{/* The single authoritative empty announcement for this pane. */}
						<p className="text-sm font-medium">No generation runs yet for this school year.</p>
						<p className="text-xs text-muted-foreground">
							Generate a timetable from the schedule surface first — each generation run will appear here for review.
						</p>
						<Button asChild variant="outline" size="sm" className="h-7 text-xs">
							<Link to="/timetable">
								<ChevronLeft className="size-3.5" />
								Back to Schedule
							</Link>
						</Button>
					</div>
				</div>
			) : (
				<ScrollArea className="min-h-0 flex-1">
					<ul className="mx-auto w-full max-w-2xl space-y-2 p-4">
						{runs.map((run, index) => {
							const selected = isSelectedRun(run, index, selectedRunId);
							return (
								<li
									key={run.id}
									className="rounded-lg border border-border bg-card p-3"
									data-testid={`timetable-runs-row-${run.id}`}
									data-selected={selected ? 'true' : undefined}
								>
									<div className="flex min-w-0 flex-wrap items-center gap-2">
									<Badge variant={statusVariant(run.status)} className="h-5 px-1.5 text-xs">
										{/* J2 (P1/P2): the run's own state enum and its kind were
										 * printed verbatim in this row. They are enums, so they
										 * are mapped to plain words like every other status on
										 * this surface. */}
										{generationRunStateLabel(run.status)}
									</Badge>
										{/* J2 (P3): the heading is now a human anchor — the date the
										 * run was generated — with the run number kept as a quiet
										 * suffix, because it is the one internal id a scheduler can
										 * legitimately quote back. */}
										<p className="text-sm font-semibold">{runAnchorLabel(run.id, formatTimestamp(run.createdAt))}</p>
										{index === 0 ? (
											<Badge variant="outline" className="h-5 px-1.5 text-xs">Latest</Badge>
										) : null}
										{selected ? (
											<Badge variant="secondary" className="h-5 px-1.5 text-xs">Reviewing</Badge>
										) : null}
										<span className="min-w-0 flex-1" />
										{selected ? null : (
											<Button asChild variant="outline" size="sm" className="h-7 text-xs">
												<Link
													to="/timetable"
													data-testid={`timetable-runs-review-${run.id}`}
													onClick={() => onSelectRun(String(run.id))}
												>
													Review this run
												</Link>
											</Button>
										)}
									</div>
									<dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
										<div className="min-w-0">
											<dt className="font-semibold uppercase tracking-wide">Created</dt>
											<dd className="truncate">{formatTimestamp(run.createdAt)}</dd>
										</div>
										<div className="min-w-0">
											<dt className="font-semibold uppercase tracking-wide">Duration</dt>
											<dd className="truncate">{formatDuration(run.durationMs)}</dd>
										</div>
									{run.version != null ? (
										<div className="min-w-0">
											{/* J2 (P3): the term above already says "Version", so the
											 * `v3` abbreviation added nothing and read as a token. */}
											<dt className="font-semibold uppercase tracking-wide">Version</dt>
											<dd className="truncate">{run.version}</dd>
										</div>
									) : null}
										{run.runType ? (
											<div className="min-w-0">
												<dt className="font-semibold uppercase tracking-wide">Kind</dt>
												<dd className="truncate">{generationRunKindLabel(run.runType)}</dd>
											</div>
										) : null}
										<div className="min-w-0">
											<dt className="font-semibold uppercase tracking-wide">Started</dt>
											<dd className="truncate">{run.startedAt ? formatTimestamp(run.startedAt) : '—'}</dd>
										</div>
										<div className="min-w-0">
											<dt className="font-semibold uppercase tracking-wide">Finished</dt>
											<dd className="truncate">{run.finishedAt ? formatTimestamp(run.finishedAt) : '—'}</dd>
										</div>
									</dl>
									{run.error ? (
										<p className="mt-2 truncate text-xs text-destructive" data-testid={`timetable-runs-error-${run.id}`}>
											{run.error}
										</p>
									) : null}
								</li>
							);
						})}
					</ul>
				</ScrollArea>
			)}
		</div>
	);
}
