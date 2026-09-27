/**
 * A2-TIMETABLE-CUSTODY (Lane C finding #61) — the concurrent-commit notice.
 *
 * The notice has to survive a re-render, be dismissible, and be announced rather
 * than merely shown, so it is state owned by the workspace (not a toast that
 * vanishes on its own timer) and it is a live region.
 *
 * Placement is a single banner row, not a floating overlay: the defect this fixes
 * is a change the operator could not see. It must not cover the grid, and it must
 * not introduce a scroll surface, so it takes one `shrink-0` row — matching the
 * sibling strips in the same flex column — and the grid below keeps its own
 * `flex-1 min-h-0 overflow-auto` region untouched (AGENTS.md §8). `shrink-0` is
 * load-bearing: without it the flex column can compress this row and clip the very
 * sentence the operator needs to read.
 *
 * §8: the only affordance is the dismiss control, routed through `@/ui` `Button`.
 * No raw `<button>`, no `<details>`, no HTML `title=`, no native `<select>`, and
 * the message is fully in the DOM text, so no information is hover-only.
 */

import { Button } from '@/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import type { ConcurrentCommitNotice } from '@/lib/timetable-concurrent-commit';

export type ConcurrentCommitNoticeBarProps = {
	notice: ConcurrentCommitNotice | null;
	onDismiss: () => void;
};

export default function ConcurrentCommitNoticeBar({ notice, onDismiss }: ConcurrentCommitNoticeBarProps) {
	// A null notice renders NOTHING — not an empty region. The normal single-user
	// path is silent, and an always-present empty alert box would announce itself.
	if (!notice) return null;

	return (
		<div
			role="alert"
			aria-live="assertive"
			aria-atomic="true"
			data-testid="concurrent-commit-notice"
			className="flex shrink-0 items-start gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
		>
			<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<p className="font-semibold">{notice.headline}</p>
				<p className="mt-0.5">{notice.detail}</p>
				{notice.notes.length > 0 ? (
					<ul className="mt-1 list-disc pl-4">
						{notice.notes.map((note) => <li key={note}>{note}</li>)}
					</ul>
				) : null}
			</div>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-11 shrink-0 px-2"
				data-testid="concurrent-commit-dismiss"
				aria-label="Dismiss the notice that the schedule changed"
				onClick={onDismiss}
			>
				<X className="size-4" aria-hidden="true" />
			</Button>
		</div>
	);
}
