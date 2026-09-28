/**
 * C11 M4 — the blocked-review VERDICT for a draft session switch.
 *
 * ── WHAT WAS MISSING ─────────────────────────────────────────────────────────
 *
 * M4 is "Swap states the outcome in one sentence". The candidate delivered half of
 * it: the banner Cancel and the single reset (both already proven by rendered
 * rows), but the BLOCKED review still rendered only a count —
 * `draft-swap-preview-status` read "2 blocking conflicts" and the confirm control
 * was `disabled` with nothing beside it saying why. A disabled control with a
 * hover-only or absent reason is the defect class this cycle exists to remove
 * (AGENTS.md §8: a blocked reason must be visible, not hover-only), and a count is
 * not a sentence that names an outcome.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 *
 * ONE derivation of the verdict, and ONE component that renders it. The sentence
 * names what will happen, the confirm control is disabled exactly when the verdict
 * is blocked, and the reason is rendered as visible text on the same row — never in
 * a `title` or a tooltip. The dialog and the acceptance row render the same
 * component, so the row cannot pass on a surface the operator never sees.
 */
import { Button } from '@/ui/button';

export type DraftSwapVerdict =
	| { readonly tone: 'checking' | 'error' | 'blocked' | 'clear'; readonly sentence: string; readonly confirmBlocked: boolean };

/**
 * The one sentence. Never a bare count: it names the OUTCOME — what will or will
 * not happen if the operator proceeds — and the way out.
 */
export function describeDraftSwapVerdict(input: {
	loading: boolean;
	error: string | null;
	hardCount: number;
	softCount: number;
	saving: boolean;
}): DraftSwapVerdict {
	if (input.loading) return { tone: 'checking', sentence: 'Checking this switch now.', confirmBlocked: true };
	if (input.saving) return { tone: 'checking', sentence: 'Saving this switch now.', confirmBlocked: true };
	if (input.error !== null) {
		return {
			tone: 'error',
			sentence: `This switch could not be checked: ${input.error} Choose another class pair or cancel without saving.`,
			confirmBlocked: true,
		};
	}
	if (input.hardCount > 0) {
		return {
			tone: 'blocked',
			sentence: `This switch is blocked by ${input.hardCount} blocking conflict${input.hardCount === 1 ? '' : 's'}, so nothing is saved. Resolve them, or cancel and choose another class pair.`,
			confirmBlocked: true,
		};
	}
	if (input.softCount > 0) {
		return {
			tone: 'clear',
			sentence: `This switch can be saved now; ${input.softCount} warning${input.softCount === 1 ? '' : 's'} stay unchanged.`,
			confirmBlocked: false,
		};
	}
	return { tone: 'clear', sentence: 'This switch can be saved now: no blocking conflict and no warnings.', confirmBlocked: false };
}

const TONE_CLASS: Record<DraftSwapVerdict['tone'], string> = {
	checking: 'border-border bg-background text-muted-foreground',
	error: 'border-red-200 bg-red-50 text-red-800',
	blocked: 'border-red-200 bg-red-50 text-red-800',
	clear: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

/**
 * The blocked-review footer, exactly as the draft-swap inline preview renders it:
 * the one-sentence verdict, its visible reason, ONE Cancel, and the confirm
 * control — which is disabled precisely when `confirmBlocked` is true, so the
 * sentence and the control can never disagree.
 */
export function DraftSwapReviewVerdict({
	loading,
	error,
	hardCount,
	softCount,
	saving,
	onCancel,
	onConfirm,
}: {
	loading: boolean;
	error: string | null;
	hardCount: number;
	softCount: number;
	saving: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const verdict = describeDraftSwapVerdict({ loading, error, hardCount, softCount, saving });
	return (
		<footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-3 py-2" data-testid="draft-swap-verdict-footer">
			<p
				className={`min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs ${TONE_CLASS[verdict.tone]}`}
				data-testid="draft-swap-verdict"
				data-verdict-tone={verdict.tone}
				role="status"
				aria-live="polite"
			>
				{verdict.sentence}
			</p>
			<Button variant="outline" onClick={onCancel} data-testid="draft-swap-cancel">Cancel</Button>
			<Button
				disabled={verdict.confirmBlocked}
				onClick={onConfirm}
				data-testid="draft-swap-commit"
				aria-label={verdict.confirmBlocked ? `Confirm switch. ${verdict.sentence}` : 'Confirm switch'}
			>
				{saving ? 'Saving…' : 'Confirm switch'}
			</Button>
		</footer>
	);
}
