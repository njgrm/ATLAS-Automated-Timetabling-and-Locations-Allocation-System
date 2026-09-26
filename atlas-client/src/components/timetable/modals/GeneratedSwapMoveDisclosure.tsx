/**
 * A2-TIMETABLE-CUSTODY (D2) — the swap panel must name the move it will commit.
 *
 * The recorded defect (browser run 318): the "Before -> After" panel hard-coded
 * the DIRECT swap, so under an auto-fix strategy a green "Safe to review" banner
 * sat directly above a move description that was not the move. The operator
 * committed a relocation of a session to another time — on the live run, to a slot
 * after the section's own day ended — that the panel never named.
 *
 * Contract: `a commit applies exactly what its preview showed, or refuses.` The
 * preview either shows the exact move, or there is no auto-fix. This component is
 * the disclosure: it derives the move from the SELECTED strategy and refuses to
 * describe a move it cannot name, rather than falling back to the direct swap.
 *
 * `AUTO_FIX_MOVE_BLOCKING` parks Class A on Class B's slot and relocates Class B
 * to `autoFixBlockingTarget`. `AUTO_FIX_MOVE_SOURCE` relocates Class A to
 * `autoFixSourceTarget` and leaves Class B where it is.
 *
 * Presentation only — no `@/ui` primitive is needed because the surrounding panel
 * already styles these lines, and the existing markup is plain text elements.
 */

export type SwapSlot = { day: string; startTime: string; endTime: string };
export type SwapStrategy = 'DIRECT_SWAP' | 'AUTO_FIX_MOVE_BLOCKING' | 'AUTO_FIX_MOVE_SOURCE';

export type SwapMove = {
	/** Where Class A will sit after the commit. */
	moveA: SwapSlot;
	/** Where Class B will sit after the commit. */
	moveB: SwapSlot;
	/** Which class the auto-fix relocates beyond the two classes' current times. */
	relocated: 'A' | 'B' | null;
};

export type SwapMoveFormat = (hhmm: string) => string;

/**
 * The exact move the selected strategy will commit, or `null` when that move
 * cannot be named. `null` is the fail-closed answer: the caller must then refuse
 * to offer the commit rather than describe a different move.
 */
export function getCommittedMoves(
	autoFixBlockingTarget: SwapSlot | null,
	autoFixSourceTarget: SwapSlot | null,
	strategy: SwapStrategy | null,
	entryA: SwapSlot,
	entryB: SwapSlot,
): SwapMove | null {
	if (strategy === 'DIRECT_SWAP') return { moveA: entryB, moveB: entryA, relocated: null };
	if (strategy === 'AUTO_FIX_MOVE_BLOCKING') {
		if (!autoFixBlockingTarget) return null;
		return { moveA: entryB, moveB: autoFixBlockingTarget, relocated: 'B' };
	}
	if (strategy === 'AUTO_FIX_MOVE_SOURCE') {
		if (!autoFixSourceTarget) return null;
		return { moveA: autoFixSourceTarget, moveB: entryB, relocated: 'A' };
	}
	return null;
}

export function describeSwapSlot(slot: SwapSlot, formatTime: SwapMoveFormat): string {
	return `${slot.day} ${formatTime(slot.startTime)}–${formatTime(slot.endTime)}`;
}

export type GeneratedSwapMoveDisclosureProps = {
	autoFixBlockingTarget: SwapSlot | null;
	autoFixSourceTarget: SwapSlot | null;
	strategy: SwapStrategy | null;
	entryA: SwapSlot;
	entryB: SwapSlot;
	formatTime: SwapMoveFormat;
	className?: string;
};

/**
 * The "Before -> After" body of the swap review panel. Exported as its own
 * component with a five-slot prop surface so the disclosure is renderable and
 * testable on its own, rather than only reachable through the full review
 * workspace context.
 */
export default function GeneratedSwapMoveDisclosure({
	autoFixBlockingTarget,
	autoFixSourceTarget,
	strategy,
	entryA,
	entryB,
	formatTime,
	className = 'mt-3 rounded-md border border-border bg-muted/30 p-2',
}: GeneratedSwapMoveDisclosureProps) {
	const moves = getCommittedMoves(autoFixBlockingTarget, autoFixSourceTarget, strategy, entryA, entryB);

	if (!moves) {
		return (
			<div className={className} data-testid="generated-swap-before-after">
				<p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Before → After</p>
				<p className="text-xs text-amber-900" data-testid="generated-swap-move-unknown">
					This option&apos;s exact move is not known yet. Do not save until it is shown here.
				</p>
			</div>
		);
	}

	return (
		<div className={className} data-testid="generated-swap-before-after">
			<p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Before → After</p>
			<div className="grid grid-cols-2 gap-2 text-xs">
				<div className="space-y-0.5">
					<p className="font-semibold text-blue-800">Class A moves to</p>
					<p className="text-muted-foreground" data-testid="generated-swap-move-a">{describeSwapSlot(moves.moveA, formatTime)}</p>
				</div>
				<div className="space-y-0.5">
					<p className="font-semibold text-amber-800">Class B moves to</p>
					<p className="text-muted-foreground" data-testid="generated-swap-move-b">{describeSwapSlot(moves.moveB, formatTime)}</p>
				</div>
			</div>
			{moves.relocated ? (
				<p
					className="mt-1.5 border-t border-border pt-1.5 text-xs font-medium text-amber-900"
					data-testid="generated-swap-autofix-disclosure"
				>
					Committing also relocates Class {moves.relocated} beyond the two classes&apos; current times:{' '}
					{moves.relocated === 'A'
						? `Class A leaves ${describeSwapSlot(entryA, formatTime)} and goes to ${describeSwapSlot(moves.moveA, formatTime)}.`
						: `Class B leaves ${describeSwapSlot(entryB, formatTime)} and goes to ${describeSwapSlot(moves.moveB, formatTime)}.`}{' '}
					{moves.relocated === 'A'
						? `Class B stays at ${describeSwapSlot(entryB, formatTime)}.`
						: `Class A then takes Class B's original time, ${describeSwapSlot(entryB, formatTime)}.`}
				</p>
			) : null}
		</div>
	);
}
