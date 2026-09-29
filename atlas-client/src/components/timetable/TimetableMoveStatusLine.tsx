/**
 * C11 M3 — the move status line and its ONE Cancel.
 *
 * ── WHY THIS IS ITS OWN COMPONENT ────────────────────────────────────────────
 *
 * Two reasons, and the second is QA finding F3.
 *
 * 1. `ScheduleReviewWorkspace.tsx` was at 876 physical lines and this block plus
 *    its copy is the M3 slice's whole operator-facing surface; keeping it inline
 *    put the next increment straight into the AGENTS.md §8 cap.
 *
 * 2. F3: `timetable-move-no-target-cancel` was RENDERED BY NO TEST. It is
 *    reachable only through the fully composed workspace (a data hook, a context
 *    builder and three sibling panels), so a control the walk recorded as
 *    "the operator is left in an armed move with no exit" shipped unexercised.
 *    Extracting the line makes the exact production surface renderable, so the
 *    acceptance row clicks the real control.
 *
 * ── A2 mc, S3: THE SWAP OFFERS ───────────────────────────────────────────────
 *
 * The recorded defect: when every period in view was occupied the operator got
 * one dead-end sentence and a Cancel. The one derivation
 * (`timetableMoveTargets.ts`) now also returns the SWAP OFFERS for those
 * occupied slots, and this line renders them.
 *
 * THE DEAD-CONTROL RULE. A control that cannot do anything must not look like one
 * (AGENTS.md §11 "Clickable must look clickable"). So the offers render as real
 * `Button`s ONLY when the caller passed `onSelectSwap`; otherwise they render as
 * plain words stating which swaps are allowed and which are not. There is no
 * third state in which a button appears and does nothing.
 *
 * `timetable-move-status-message` still renders EXACTLY the `message` prop, and
 * the Cancel is still reachable in every state that arms a move.
 */
import { ArrowLeftRight } from 'lucide-react';

import { Button } from '@/ui/button';

import type { MoveSwapOffer, MoveTargetNotice } from '@/components/timetable/timetableMoveTargets';

export function TimetableMoveStatusLine({
	tone,
	message,
	moveTargetNotice,
	onDisarm,
	onSelectSwap,
}: {
	tone: 'error' | 'warning' | 'success' | 'loading';
	message: string;
	/** The one `describeMoveTargets` derivation for the current view. */
	moveTargetNotice: MoveTargetNotice;
	/** Clears the armed move source AND the status, so no exit path can strand it. */
	onDisarm: () => void;
	/**
	 * A2 mc S3 — arms the real swap for one offer. OPTIONAL: without it the offers
	 * are stated in words rather than pressed, so no control ever lies.
	 */
	onSelectSwap?: (offer: MoveSwapOffer) => void;
}) {
	const offers = moveTargetNotice.kind === 'none' ? (moveTargetNotice.swapOffers ?? []) : [];
	const allowed = offers.filter((offer) => offer.allowed);
	const blocked = offers.filter((offer) => !offer.allowed);

	return (
		<div className="relative z-30 h-0" data-testid="timetable-inline-status-anchor">
			<div
				role="status"
				aria-live="polite"
				data-testid="timetable-inline-status"
				className={`absolute inset-x-3 top-1 rounded-md border px-3 py-1.5 text-sm shadow-sm ${
					tone === 'error'
						? 'border-red-300 bg-red-50 text-red-800'
						: tone === 'warning'
							? 'border-amber-300 bg-amber-50 text-amber-800'
							: tone === 'success'
								? 'border-emerald-300 bg-emerald-50 text-emerald-800'
								: 'border-border bg-background text-foreground'
				}`}
			>
				<div className="flex items-center gap-2">
					<span className="min-w-0" data-testid="timetable-move-status-message">{message}</span>
					{/* C11 M3 — ONE Cancel for the move. It clears the armed source and the
					    status together, so the operator is never left in an armed move with
					    no exit — the defect the walk recorded. */}
					{moveTargetNotice.kind === 'none' ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-7 shrink-0 px-2 text-xs"
							data-testid="timetable-move-no-target-cancel"
							onClick={onDisarm}
						>
							Cancel
						</Button>
					) : null}
				</div>

				{/* A2 mc S3 — the swap offers. One row per offer, in slot order, stating
				    plainly WHICH swaps are allowed and which are not. */}
				{offers.length > 0 && (
					<div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-testid="timetable-move-swap-offers">
						{allowed.map((offer) => (
							onSelectSwap ? (
								<Button
									key={`${offer.slotKey}-${offer.occupantEntryId}`}
									type="button"
									variant="outline"
									size="sm"
									className="h-11 cursor-pointer gap-1 px-2 text-xs"
									data-testid="timetable-move-swap-offer"
									data-swap-allowed="true"
									data-swap-occupant={offer.occupantEntryId}
									onClick={() => onSelectSwap(offer)}
								>
									<ArrowLeftRight className="size-3" aria-hidden="true" />
									{offer.label}
								</Button>
							) : (
								<span
									key={`${offer.slotKey}-${offer.occupantEntryId}`}
									className="text-xs"
									data-testid="timetable-move-swap-offer-text"
									data-swap-allowed="true"
								>
									{offer.label}
								</span>
							)
						))}
						{blocked.map((offer) => (
							/* A2 mc R2 polish — the row LED with the reason. It used to read
							 * `Swap with FIL (Mr Luna) — not allowed: …`, which states an
							 * action and then refuses it in the same breath. */
							<span
								key={`${offer.slotKey}-${offer.occupantEntryId}`}
								className="text-xs"
								data-testid="timetable-move-swap-blocked"
								data-swap-allowed="false"
							>
								{`Cannot swap with ${offer.label.replace(/^Swap with /, '')}: ${offer.blockedReason}`}
							</span>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
