import { History, RotateCcw } from 'lucide-react';

import type { ScheduleReviewDialogsContext } from '@/components/timetable/timetableContexts.types';
import type { ManualEditRecord } from '@/types';
import { manualEditActionLabel } from '@/lib/timetable-plain-language';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * A2-TIMETABLE-CUSTODY-R1 (D1): what a `REVERT` row actually undid.
 *
 * The ledger already records it. `revertLastEdit` writes `revertedEditId` and
 * `revertedEditType` onto the row it creates (`manual-edit.service.ts:1866`),
 * `listManualEdits` returns `validationSummary` verbatim with no limit
 * (`:1941-1950`), so the undone edit is present in the very list this dialog
 * renders. The row therefore names it, resolving the id to the target row so two
 * edits of the same kind stay distinguishable.
 *
 * `validationSummary` is typed `unknown` on the client, so both fields are
 * PROBED rather than cast, and a value of the wrong shape is treated as absent.
 *
 * WHY THERE IS NO "Redo" HERE: a real redo is a NEW server operation that
 * re-applies the reverted edit's `afterPayload`. Nothing in the contract does
 * that today, and `revertLastEdit` cannot be bent into one: it selects its
 * target with `editType: { not: 'REVERT' }` (`:1675`), so a `REVERT` row is
 * `null` there, and `assertUndoHead` then compares a real `requestingActorId`
 * against `operationActorId: null` and throws `UNDO_CONFLICT`
 * (`timetable-undo-contract.ts:24`). Renaming the button "Redo" would have
 * labelled a guaranteed 409 as a working feature, so the honest subset ships
 * instead: name the edit, and remove the affordance.
 *
 * Returns `null` when the record identifies nothing, and the caller then says
 * so. A row must never claim to name an edit it cannot resolve.
 */
function undoneEditLabel(edit: ManualEditRecord, editHistory: ManualEditRecord[]): string | null {
	const summary = (edit.validationSummary ?? {}) as Record<string, unknown>;
	const revertedEditId = summary.revertedEditId;
	const revertedEditType = summary.revertedEditType;

	const target = typeof revertedEditId === 'number'
		? editHistory.find((candidate) => candidate.id === revertedEditId)
		: undefined;
	if (target) {
		return `${manualEditActionLabel(target.editType)} · ${new Date(target.createdAt).toLocaleString()}`;
	}
	// The id did not resolve, but the ledger still recorded WHAT was undone. That
	// is the truthful claim, and it deliberately carries no timestamp, because a
	// timestamp would attach this claim to a row the dialog is not showing.
	if (typeof revertedEditType === 'string') return manualEditActionLabel(revertedEditType);
	return null;
}

/**
 * R4 — edit history with actor, time and type per entry plus a per-row revert
 * affordance. The server revert is an operation-bound CAS: only the latest edit
 * can be reverted, so non-head rows are disabled with an explicit reason
 * instead of dispatching a request that would fail stale.
 *
 * A2-TIMETABLE-CUSTODY-R1 changed two things here, both about not claiming more
 * than the ledger holds:
 *
 *   D1 — a `REVERT` row now names the edit it undid (see `undoneEditLabel`) and
 *   no longer offers a "Revert this edit" that the server can only refuse.
 *   D2 — a row no longer renders the counts. `validationSummary.hardCount` is
 *   `hardAfter.length` at COMMIT time (`manual-edit.service.ts:2470`) — every
 *   HARD the run held then, whole-year, not the selected-term figure the header
 *   shows and not the publication-blocking subset. A row therefore read 241
 *   while the header read 69, and the `?? 0` default fabricated "warnings: 0"
 *   on every `REVERT` row, which the server writes no count for at all. QA read
 *   that as the undo having cleared every warning. The counts are REMOVED
 *   rather than re-labelled: no reconciliation between the two figures exists to
 *   state, and substituting the header's current number on every historical row
 *   would be a second falsehood (implying each edit produced it). The traced
 *   fact is kept here so the line is not re-added.
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
						const isHead = index === 0;
						// D1: a `REVERT` row is never a revert target, so it carries
						// no affordance at all rather than a disabled one. A greyed
						// "Revert this edit" on an undo is the affordance QA named as
						// a redo wearing the wrong label.
						const isRevert = edit.editType === 'REVERT';
						const undone = isRevert ? undoneEditLabel(edit, editHistory) : null;
						const canRevert = !isRevert && isHead && currentRunVersion != null && !revertLoading;
						const revertReason = isHead ? 'Revert this edit' : 'Only the latest edit can be reverted';
						return (
							<div key={edit.id} className="rounded-md border p-3 text-xs" data-testid="timetable-edit-history-row">
								<div className="flex items-center justify-between gap-2">
									{/* J2 (P4): the raw `editType` enum was de-snake-cased into
									 * "PLACE UNASSIGNED". It now reads as what the edit did. */}
									<Badge variant="outline" className="text-xs">{manualEditActionLabel(edit.editType)}</Badge>
									<span className="text-muted-foreground">{new Date(edit.createdAt).toLocaleString()}</span>
								</div>
								{/* D2 (J2 P4 follow-up). The fact that an actor EXISTS was
								 * never in doubt, so a row that renders no attribution at all
								 * is "silence where a fact exists" — and for an unexpected
								 * change to my own schedule, who made it is the first
								 * question. The original P4 fix solved the bare-id problem by
								 * DELETING the fact, which cured the token and lost the
								 * capability. The sentence below is the additive middle: it
								 * states the presence of an actor and the absence of a name,
								 * and prints no identifier.
								 *
								 * WHY IT CANNOT NAME THE PERSON HERE: `ManualEditRecord`
								 * carries only `actorId`, which the route fills from
								 * `req.user.userId` — a User id, NOT a faculty-mirror id — so
								 * no map this dialog holds can resolve it, and resolving it
								 * through `facultyMap` would attribute the change to the WRONG
								 * person.
								 *
								 * OWED, NOT WAIVED (server follow-up; out of scope for this
								 * cycle): `listManualEdits` (`manual-edit.service.ts`) returns
								 * only `actorId`, whereas `RoomRequestAppealHistory`
								 * (`room-preference.service.ts`) already returns `actorName`
								 * beside its id — that is the precedent to follow. Its
								 * fallback, which prints a bare numeric teacher id, is
								 * deliberately NOT copied here, because P4 forbids a bare id.
								 * When the server returns a name, render it and drop this
								 * sentence; the guard below stays either way. */}
								<p className="mt-1 text-muted-foreground" data-testid="timetable-edit-history-actor">
									Changed by a signed-in account. This record does not show which person.
								</p>
								{isRevert && (
									/* D1. The naming is additive beside the actor sentence, never in
									 * place of the badge, so the row still says what KIND of
									 * record it is. When the ledger identifies nothing, the row
									 * says exactly that instead of borrowing a neighbour. */
									<p className="mt-1 text-muted-foreground" data-testid="timetable-edit-history-undid">
										{undone === null ? 'Undid: an earlier change this record does not identify' : `Undid: ${undone}`}
									</p>
								)}
								{isRevert && (
									/* D1. A button that silently disappears on one row type reads
									 * as a broken dialog, so the absence is stated. The claim is
									 * traced to `editType: { not: 'REVERT' }` at
									 * `manual-edit.service.ts:1675` — see `undoneEditLabel`. */
									<p className="mt-1 text-muted-foreground" data-testid="timetable-edit-history-no-redo">
										This undo cannot be undone.
									</p>
								)}
								{!isRevert && (
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
								)}
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
