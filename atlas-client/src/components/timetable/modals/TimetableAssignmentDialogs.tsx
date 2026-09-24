import { History, RotateCcw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';

/**
 * R4 — edit history with actor, time, type, and counts per entry plus a per-row
 * revert affordance. The server revert is an operation-bound CAS: only the
 * latest edit can be reverted, so non-head rows are disabled with an explicit
 * reason instead of dispatching a request that would fail stale.
 */
export function TimetableAssignmentDialogs({ context }: { context: ScheduleReviewDialogsContext }) {
	const {
		showEditHistory, setShowEditHistory, editHistory,
		revertEditById, revertLoading, currentRunVersion,
	} = context;

	return (
		<Dialog open={showEditHistory} onOpenChange={setShowEditHistory}>
			<DialogContent className="max-w-lg" data-testid="timetable-edit-history-dialog">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<History className="size-4" />
						Manual edit history
					</DialogTitle>
					<DialogDescription>
						{editHistory.length === 0
							? 'No manual edits have been made on this run.'
							: `${editHistory.length} edit${editHistory.length === 1 ? '' : 's'} recorded. Only the latest edit can be reverted; newer edits would make an older revert stale.`}
					</DialogDescription>
				</DialogHeader>
				<div className="max-h-64 space-y-2 overflow-auto scrollbar-thin py-2">
					{editHistory.map((edit, index) => {
						const summary = edit.validationSummary as Record<string, number> | null;
						const isHead = index === 0;
						const canRevert = isHead && currentRunVersion != null && !revertLoading;
						return (
							<div key={edit.id} className="rounded-md border p-3 text-xs" data-testid="timetable-edit-history-row">
								<div className="flex items-center justify-between gap-2">
									<Badge variant="outline" className="text-xs">{edit.editType.replaceAll('_', ' ')}</Badge>
									<span className="text-muted-foreground">{new Date(edit.createdAt).toLocaleString()}</span>
								</div>
								<p className="mt-1 text-muted-foreground">
									Edit #{edit.id} · by user #{edit.actorId}
								</p>
								{summary && (
									<p className="mt-1 text-muted-foreground">Blocking: {summary.hardCount ?? 0}, warnings: {summary.softCount ?? 0}</p>
								)}
								<div className="mt-2 flex items-center justify-end">
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 gap-1 px-2 text-xs"
										disabled={!canRevert}
										title={isHead ? 'Revert this edit' : 'Only the latest edit can be reverted'}
										onClick={() => {
											if (currentRunVersion == null) return;
											void revertEditById(edit.id, currentRunVersion);
										}}
										data-testid="timetable-edit-history-revert"
									>
										<RotateCcw className="size-3" aria-hidden="true" />
										Revert this edit
									</Button>
								</div>
							</div>
						);
					})}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => setShowEditHistory(false)}>Close</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
