import { TimetableStatusLegend } from '@/components/timetable/TimetableStatusLegend';

/**
 * B2 — the Advanced header's plain-language placement guidance.
 *
 * The same good copy already visible in Simple, kept to one short line so
 * sighted operators see it without opening the 7-step tutorial. It is
 * deliberately NOT `sr-only`: the `#timetable-foolproof-help` id stays on the
 * visible element so every task button's `aria-describedby` still resolves.
 *
 * A2-TIMETABLE-CUSTODY (Lane C finding #63): this bar used to carry its own
 * `Undo last change` button. It was a duplicate of the workspace toolbar's Undo —
 * the same `timetable-visible-undo` test hook and the same `Undo last manual
 * timetable change` accessible name — so a screen reader heard one name twice
 * and an operator could not tell the two apart. The toolbar control
 * (`TimetableUndoRedoControl`) is the one that was kept: it sits beside `Redo`
 * and `History`, it is the surface the shared Undo decision
 * (`decideHeaderUndo`) documents, and it renders the blocked reason VISIBLY in a
 * `role="status"` element rather than only in a hover, so removing this copy lost
 * no information. The undo-only props this component used to take are gone with
 * the control — no orphan handler, selector, test hook or `aria-label` is left
 * behind.
 */
export type AdvancedHeaderHelpMode = 'schedule' | 'draft';

const GUIDANCE: Record<AdvancedHeaderHelpMode, string> = {
	// One sentence each: the action, the object, and the preview-before-save promise.
	schedule: 'Place or switch: choose a session, then click a slot. ATLAS previews the result before anything is saved.',
	draft: 'Draft: choose a queue item, then click a slot. The draft review opens before anything is saved.',
};

export function resolveAdvancedHeaderGuidance(mode: AdvancedHeaderHelpMode): string {
	return GUIDANCE[mode];
}

export type TimetableAdvancedHeaderHelpProps = {
	mode: AdvancedHeaderHelpMode;
	/** The currently active task's helper line, shown on small screens. */
	activeTaskHelper: string;
};

export function TimetableAdvancedHeaderHelp({
	mode,
	activeTaskHelper,
}: TimetableAdvancedHeaderHelpProps) {
	const guidance = resolveAdvancedHeaderGuidance(mode);
	return (
		<div
			id="timetable-foolproof-help"
			data-testid="timetable-foolproof-help"
			className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 bg-background px-4 pb-1.5 text-xs text-muted-foreground"
		>
			<p className="min-w-0 line-clamp-1" data-testid="timetable-foolproof-help-text">
				<span className="font-semibold text-foreground">No precision dragging required.</span>{' '}
				<span className="hidden md:inline">{guidance}</span>
				<span className="md:hidden">{activeTaskHelper}</span>
			</p>
			{/* `shrink-0` keeps the legend from being squeezed by the long guidance
			 * sentence; the row itself is unchanged apart from losing the Undo. */}
			<div className="flex shrink-0 items-center gap-2">
				<TimetableStatusLegend />
			</div>
		</div>
	);
}
