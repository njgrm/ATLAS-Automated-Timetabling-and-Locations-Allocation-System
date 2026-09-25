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
	/** The workspace's current run selection (`'latest'` or a run id). */
	selectedRunId: string;
	/** The workspace's existing run-selection handler (same as the header Select). */
	onSelectRun: (value: string) => void;
	formatTimestamp: (value: string | null) => string;
	formatDuration: (value: number | null) => string;
};

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
	selectedRunId,
	onSelectRun,
	formatTimestamp,
	formatDuration,
}: TimetableRunsPaneProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col" data-testid="timetable-runs-pane">
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
				<Badge variant="outline" className="h-5 px-1.5 text-xs uppercase">Runs</Badge>
				<p className="text-xs text-muted-foreground">
					{runs.length === 0
						? 'No generation runs yet for this school year.'
						: `${runs.length} run${runs.length === 1 ? '' : 's'} · newest first · read-only history`}
				</p>
			</div>
			{runs.length === 0 ? (
				<div className="flex min-h-0 flex-1 items-center justify-center p-4">
					<div className="max-w-md space-y-3 text-center" data-testid="timetable-runs-empty-state">
						<History className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-sm font-medium">No runs to review</p>
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
