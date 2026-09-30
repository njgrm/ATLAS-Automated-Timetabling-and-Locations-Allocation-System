/**
 * A6 — the placement blocker notice (operator decision 14).
 *
 * ONE plain sentence naming the section, the subject and why, plus ONE one-click
 * replacement teacher who fits. The sentence is the server's own wording
 * (`blocker.sentence`) so the preview route, the save 409 and the apply 409 all
 * read identically — there is no second copy on the client.
 *
 * Used by both the save path (a dedicated dialog) and "Apply suggested" (inline
 * in the summary modal), so a refusal is never a bare toast.
 */
import { Button } from '@/ui/button';
import {
	describeAlternativeSlot,
	firstAlternative,
	type PlacementAlternative,
	type PlacementBlocker,
} from '@/lib/teaching-load-placement';

type TeachingLoadPlacementNoticeProps = {
	blockers: PlacementBlocker[];
	onUseAlternative?: (blocker: PlacementBlocker, alternative: PlacementAlternative) => void;
	busy?: boolean;
};

export function TeachingLoadPlacementNotice({ blockers, onUseAlternative, busy }: TeachingLoadPlacementNoticeProps) {
	if (!blockers || blockers.length === 0) return null;
	return (
		<div data-testid="teaching-load-placement-notice" className="space-y-2">
			{blockers.map((blocker, index) => {
				const alternative = firstAlternative(blocker);
				return (
					<div
						key={`${blocker.subjectId}:${blocker.sectionId}:${index}`}
						className="rounded-lg border border-warning-border bg-warning-muted px-3 py-2"
						role="status"
						aria-live="polite"
					>
						<p data-testid="teaching-load-placement-sentence" className="text-sm font-semibold text-warning-foreground">
							{blocker.sentence}
						</p>
						{alternative && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className="mt-2 h-8 rounded-lg font-semibold"
								data-testid="teaching-load-placement-alternative"
								disabled={!onUseAlternative || busy}
								onClick={() => onUseAlternative?.(blocker, alternative)}
							>
								Use {alternative.facultyName} ({describeAlternativeSlot(alternative)})
							</Button>
						)}
					</div>
				);
			})}
		</div>
	);
}
