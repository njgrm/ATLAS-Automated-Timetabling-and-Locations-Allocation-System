/**
 * A7 c14 (operator, 2026-09-30 08:15) — the ONE status line under the ONE control
 * row of the Simple Class Schedule header.
 *
 * ── WHY IT EXISTS, AND WHAT IT REPLACED ─────────────────────────────────────
 * The operator's target: "above the grid only ONE row … plus ONE plain status line
 * under the row, in plain words. The grid starts right under that row." Before
 * this slice the header area above the grid was several bands: a title/tabs row, a
 * picker row, a change row, and a sibling trailing band
 * (`timetable-simple-status-band`) that carried the run identity, the term notice
 * and the capped messages. This component folds that trailing band's job into the
 * header's own second band, and its `data-testid` is the contract's
 * `timetable-simple-status-line`.
 *
 * ── ONE FACT, ONE PLACE ─────────────────────────────────────────────────────
 * Nothing here decides a fact. The run sentence arrives already derived from the
 * ONE `describeRunState` call, the warnings control is the SAME `SimpleWarningsControl`
 * element the header always owned, the change notice is the SAME `SimpleDriftBanner`
 * node `useRunChangeNotice` produces, and the capped messages come from the header's
 * `buildSimpleHeaderMessages`. This component only lays them on one wrapping line.
 *
 * ── NO ELLIPSIS, EVER ──────────────────────────────────────────────────────
 * AGENTS.md §8 forbids a sentence cut off with an ellipsis, so nothing here carries
 * `truncate` / `text-ellipsis`: long text WRAPS. The line is `flex-wrap`, which is
 * what lets the run sentence, the warnings chip, the change sentence and the
 * messages stack calmly at 1366 px instead of competing for one physical line.
 */
import type { ReactNode } from 'react';

import { SIMPLE_HEADER_MESSAGE_LIMIT, SimpleHeaderMessageRow, type SimpleHeaderMessage } from '@/components/timetable/simple/SimpleHeaderMessages';

export type SimpleHeaderStatusLineProps = {
	/**
	 * The ONE `describeRunState` result. `sentence` names which run is on screen
	 * and what Draft/Published means; `null` for the states where there is no run
	 * to name, and then `stateFallback` carries the plain state word instead.
	 */
	runState: { sentence: string | null; visibility: string | null };
	/**
	 * The plain state word used when `runState.sentence` is `null` (a pre-generation
	 * workspace, or no draft yet). Without it the status line would be empty in the
	 * very states whose plain next step ("Ready to build a schedule") most needs
	 * saying.
	 */
	stateFallback: string;
	/** The ONE warnings/readiness control (its `timetable-simple-warnings-control` testid is unchanged). */
	warningsControl: ReactNode;
	/** The change notice node, or `null`. Rendered inside this line, not on its own row. */
	changeNotice?: ReactNode;
	/** The exceptional notices, in their existing priority order. */
	messages?: readonly SimpleHeaderMessage[];
	/** The unverified-term-authority sentence, or `null`. */
	termAuthorityNotice?: string | null;
};

export function SimpleHeaderStatusLine({
	runState,
	stateFallback,
	warningsControl,
	changeNotice = null,
	messages = [],
	termAuthorityNotice = null,
}: SimpleHeaderStatusLineProps) {
	const shown = messages.slice(0, SIMPLE_HEADER_MESSAGE_LIMIT);
	const hidden = messages.length - shown.length;
	const stateText = runState.sentence ?? stateFallback;
	return (
		<div
			role="status"
			aria-live="polite"
			data-testid="timetable-simple-status-line"
			className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 bg-muted/20 px-3 py-1 text-xs"
		>
			<span data-testid="timetable-run-identity" className="min-w-0 text-muted-foreground">
				<span className="font-semibold text-foreground">State:</span> {stateText}
			</span>
			{/* ONE separator, after the run clause, before any second fact (the amber
			    term notice and/or the change notice). `aria-hidden`, so assistive
			    technology reads the facts and never a bullet (§80 band-separator row). */}
			{termAuthorityNotice || changeNotice ? (
				<span aria-hidden="true" data-testid="timetable-status-band-separator" className="select-none px-1 text-muted-foreground/60">
					·
				</span>
			) : null}
			{warningsControl}
			{changeNotice}
			{termAuthorityNotice ? (
				<span data-testid="timetable-term-authority-unverified" className="text-amber-800">
					{termAuthorityNotice}
				</span>
			) : null}
			{shown.map((message) => <SimpleHeaderMessageRow key={message.id} message={message} />)}
			{hidden > 0 ? (
				<span data-testid="timetable-status-messages-more" className="text-muted-foreground">
					and {hidden} more
				</span>
			) : null}
		</div>
	);
}
