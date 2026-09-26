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
 * Presentation only — no `@/ui` primitive is needed: the auto-move marker is a
 * decorative `aria-hidden` icon beside text that already names the relocation, so
 * the row carries no interactive affordance and no hover-only disclosure.
 */

import { Move } from 'lucide-react';

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

/**
 * How many classes the commit relocates BEYOND the two classes' exchange.
 *
 * Derived from the model's own `relocated` field rather than hard-coded, so the
 * count can never understate the move. Today `relocated` is `'A' | 'B' | null`,
 * so this is 0 or 1: an auto-fix parks one class on the other's slot and relocates
 * exactly one. A `null` move (the fail-closed state) relocates nothing that can be
 * claimed, and returns 0 for the same reason.
 */
export function getRelocatedClassCount(moves: SwapMove | null): number {
	return moves?.relocated ? 1 : 0;
}

/**
 * The move phrase, pluralised from the count. Only reached with a count of at
 * least 1 — `getSwapCommitLabel` returns the plain label for 0, so the
 * ungrammatical "+ move 0 classes" is unreachable from the shipped entry point.
 */
export function formatRelocatedClassLabel(count: number): string {
	return `+ move ${count} class${count === 1 ? '' : 'es'}`;
}

/**
 * The commit button's label, and the only place it may claim a relocation.
 *
 * It claims one in exactly one state: a move the panel could name AND that
 * relocates a class. A direct two-class exchange relocates nothing, and an
 * unnameable move describes nothing — both keep the plain swap label, so the
 * button never promises a move the panel did not show. The caller still gates the
 * button on `moves !== null` (see the review dialog), so a plain label here is
 * never an enabled promise of a hidden move.
 */
export function getSwapCommitLabel(moves: SwapMove | null): string {
	const count = getRelocatedClassCount(moves);
	return count === 0 ? 'Swap sessions' : `Swap ${formatRelocatedClassLabel(count)}`;
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
				<div
					className="mt-1.5 flex items-start gap-1.5 border-t border-border pt-1.5 text-xs font-medium text-amber-900"
					data-testid="generated-swap-autofix-disclosure"
				>
					{/* The payload carries NO reason string, so this marker deliberately
					    claims nothing. It is decorative and `aria-hidden`; the text beside
					    it names the relocation in words, so the row never relies on the
					    icon or its colour alone. `Move` is the same lucide primitive the
					    cell overflow sheet already uses for a relocation action. */}
					<Move
						className="mt-px size-3.5 shrink-0 text-amber-600"
						aria-hidden="true"
						data-testid="generated-swap-autofix-icon"
					/>
					<p>
						Committing also relocates Class {moves.relocated} beyond the two classes&apos; current times:{' '}
						{moves.relocated === 'A'
							? `Class A leaves ${describeSwapSlot(entryA, formatTime)} and goes to ${describeSwapSlot(moves.moveA, formatTime)}.`
							: `Class B leaves ${describeSwapSlot(entryB, formatTime)} and goes to ${describeSwapSlot(moves.moveB, formatTime)}.`}{' '}
						{moves.relocated === 'A'
							? `Class B stays at ${describeSwapSlot(entryB, formatTime)}.`
							: `Class A then takes Class B's original time, ${describeSwapSlot(entryB, formatTime)}.`}
					</p>
				</div>
			) : null}
		</div>
	);
}
