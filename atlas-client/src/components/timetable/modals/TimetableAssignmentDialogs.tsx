import { History, RotateCcw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import { ALL_SERIOUS_PROBLEMS_LABEL, manualEditActionLabel } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

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
						const revertReason = isHead ? 'Revert this edit' : 'Only the latest edit can be reverted';
						return (
							<div key={edit.id} className="rounded-md border p-3 text-xs" data-testid="timetable-edit-history-row">
								<div className="flex items-center justify-between gap-2">
									{/* J2 (P4): the raw `editType` enum was de-snake-cased into
									 * "PLACE UNASSIGNED". It now reads as what the edit did. */}
									<Badge variant="outline" className="text-xs">{manualEditActionLabel(edit.editType)}</Badge>
									<span className="text-muted-foreground">{new Date(edit.createdAt).toLocaleString()}</span>
								</div>
								{/* J2 (P4): `ManualEditRecord` carries only `actorId`, which
								 * is `req.user.userId` on the server — a User id, NOT a
								 * faculty-mirror id, so it cannot be resolved to a name from
								 * any map the dialog holds. The attribution is therefore
								 * omitted rather than printing a bare number. The server is
								 * out of scope for this cycle; when it returns an actor name
								 * this line can say who made the change. */}
								{summary && (
									/* J2 (P4), surfaced by the edit above and traced to its
									 * value: `validationSummary.hardCount` is `hardAfter.length`
									 * — every HARD the run recorded, NOT the publication-blocking
									 * subset (`manual-edit.service.ts` line 1381/1574). It
									 * therefore must not wear the blocking word, which is the
									 * falsehood LANE-C-PLAIN-LANGUAGE-C03 was raised to remove.
									 * Reuses that lane's one name for the total; no new word. */
									<p className="mt-1 text-muted-foreground">{ALL_SERIOUS_PROBLEMS_LABEL}: {summary.hardCount ?? 0}, warnings: {summary.softCount ?? 0}</p>
								)}
								<div className="mt-2 flex items-center justify-end">
									{/* J2 (P4) + AGENTS.md section 8: the native `title`
									 * attribute is forbidden for extra information. The
									 * explanation moves to the @/ui Tooltip primitive and
									 * stays available on the disabled button. */}
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="inline-flex">
													<Button
														type="button"
														variant="outline"
														size="sm"
														className="h-7 gap-1 px-2 text-xs"
														disabled={!canRevert}
														onClick={() => {
															if (currentRunVersion == null) return;
															void revertEditById(edit.id, currentRunVersion);
														}}
														data-testid="timetable-edit-history-revert"
													>
														<RotateCcw className="size-3" aria-hidden="true" />
														Revert this edit
													</Button>
												</span>
											</TooltipTrigger>
											<TooltipContent>{revertReason}</TooltipContent>
										</Tooltip>
									</TooltipProvider>
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
