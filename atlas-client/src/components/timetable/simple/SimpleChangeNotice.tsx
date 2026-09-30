/**
 * A2 C11 S2 (item 1, Lane C's spec accepted verbatim) — the change banner is ONE
 * sentence, ONE primary action, one secondary.
 *
 * WHAT THE OPERATOR SAW (Lane C's live walk, release `4c35cc8f`): one row reading
 *
 *   "Schedule information changed"   (a title)
 *   "School information changed after this schedule was made. The current
 *    schedule stays unchanged while you review school information. · checked 10s
 *    ago"                                            (a second, 21-word sentence)
 *   "Preview impact"      "Regenerate to apply"      (in dark red)
 *
 * Two titles saying the same thing, ~30 words, a timestamp nobody needs, and a
 * destructive-looking button for something that is not wrong yet.
 *
 * WHAT IT IS NOW: one sentence that NAMES what changed when it is known, one
 * secondary action that shows the detail, and one primary action that applies
 * it. No title. No `checked Ns ago`. No red.
 *
 * ── WHY IT IS ITS OWN MODULE ───────────────────────────────────────────────
 * The banner is rendered by BOTH headers (Simple and Expert) and by the
 * `/timetable/setup` strip. One module, one sentence, one pair of actions: the
 * two layouts cannot drift onto two different banners, because there is only
 * one place the sentence is derived. `SimpleDriftBanner` owns the drift
 * PREDICATE and the per-domain repair controls; it renders this row.
 *
 * ── ONE FACT, ONE PLACE (`DescribeRunInputDrift` is the only input) ────────
 * The names come from `drift.domains`, which is the server's own
 * `GenerationInputComparison.changedDomains` mapped through the one
 * `DOMAIN_META` table. No second list, no invented nouns. When the comparison
 * names no domain — the UNKNOWN path, or a comparison ATLAS could not check —
 * the generic sentence is used, because a specific claim is not available.
 */

/**
 * A7 c13 — LAYOUT NOTE (who reads this, what the clipped string means).
 *
 * The reader is an older, mouse-first scheduler glancing at the top of the
 * Class Schedule. "Teaching Load and Teacher availability changed" is the one
 * sentence that tells them WHY the notice is here and what their next action
 * will affect. A trailing `…` turns that instruction into `Teaching Load and
 * Te…`, which is a defect: the two areas are the load-bearing words. So the
 * sentence WRAPS (two calm lines inside its own row) rather than shortening or
 * dropping a name; the row's other children keep their intrinsic width and the
 * header still stacks at most two flex rows (AGENTS.md §8, §11 "seen").
 */
import { ListTree, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

/** Used when the comparison names no area. Never a specific claim. */
export const CHANGE_NOTICE_GENERIC_SENTENCE = 'School information changed.';

/**
 * The unverified branch. It is a DIFFERENT fact from the changed branch, so it
 * stays a different sentence — ATLAS could not check, which is not the same as
 * ATLAS having found something. It is still ONE sentence, with no title and no
 * timestamp, so the band cannot claim a check that never ran.
 */
export const CHANGE_NOTICE_UNVERIFIED_SENTENCE = 'Could not check school information. This schedule is unchanged.';

/**
 * The one sentence, derived from the changed areas.
 *
 * Words, not a chip list. The old row printed one chip per changed area beside a
 * 21-word sentence; at 390 px those chips were what pushed the sentence into a
 * near one-word column. The names now live in the sentence, and the detail is
 * one click away on the secondary action.
 *
 * `changedAreas` is the operator-facing label list (`drift.domains.map(…)`).
 *   0        → the generic sentence; nothing specific is known.
 *   1        → "Teaching Load changed."
 *   2        → "Teaching Load and Rooms changed."
 *   3 or more→ "Teaching Load and 2 other areas changed since this schedule was
 *               made." The count is spoken, so the reader learns there are more
 *               without the row growing another chip.
 */
export function changeNoticeSentence(changedAreas: readonly string[]): string {
	const names = changedAreas.filter((label) => label.trim().length > 0);
	if (names.length === 0) return CHANGE_NOTICE_GENERIC_SENTENCE;
	if (names.length === 1) return `${names[0]} changed.`;
	if (names.length === 2) return `${names[0]} and ${names[1]} changed.`;
	return `${names[0]} and ${names.length - 1} other areas changed.`;
}

export type SimpleChangeNoticeProps = {
	/** The ONE sentence. Supplied by the caller so the drift predicate stays in one place. */
	sentence: string;
	/** The changed-area labels, for the secondary detail surface. */
	changedAreas: readonly string[];
	/**
	 * C11 S2 — `inline` is the header row (no strip chrome, shares the single
	 * control row); `strip` is the standalone `/timetable/setup` band.
	 */
	layout?: 'strip' | 'inline';
	/** The secondary action: show what changed. Omit when there is nothing to show. */
	onShowDetail?: () => void;
	/** The primary action: apply the change to this schedule. Omit when the caller cannot. */
	onApply?: () => void;
	/** The primary action is unavailable; `applyDisabledReason` is rendered VISIBLY. */
	applyDisabled?: boolean;
	applyDisabledReason?: string | null;
	/**
	 * A11y/diagnostic passthrough. `SimpleDriftBanner` owns the drift status and
	 * keeps exposing its existing `data-drift-status` / `data-drift-claimable`
	 * hooks so the freshness contract rows keep deciding on this element.
	 */
	status?: string;
	claimable?: boolean;
	/** Not red. Nothing is wrong yet; the row is a notice, not an error. */
	tone?: 'neutral' | 'calm-note';
};

/**
 * The one row. Deliberately NOT a heading and not an alert: one `role="status"`
 * region, one `span` of copy, and at most two `@/ui` `Button`s. The primary is
 * `variant="outline"`, NOT `variant="default"`, because DRAFT-UX-C01 (operator,
 * 2026-09-25) allows exactly ONE solid primary in the header and it is
 * `Publish schedule` once a run exists. A second `bg-primary` here would be a
 * second solid primary; the row's hierarchy is carried by ORDER, WEIGHT and the
 * verb, which survive greyscale.
 */
export function SimpleChangeNotice({
	sentence,
	changedAreas,
	layout = 'inline',
	onShowDetail,
	onApply,
	applyDisabled = false,
	applyDisabledReason = null,
	status,
	claimable,
	tone = 'neutral',
}: SimpleChangeNoticeProps) {
	return (
		<div
			role="status"
			data-testid="timetable-simple-input-drift"
			data-drift-status={status}
			data-drift-claimable={claimable === undefined ? undefined : String(claimable)}
			className={cn(
				layout === 'inline'
					/* A2 C12 / ITEM 1 — the notice's OWN row stops wrapping at `lg`.
					 * It is a flex item of the Simple header's control row, and with the
					 * row `lg:flex-nowrap` the notice's own children stay on one line, so
					 * the sentence cannot push an action out of the row. Below `lg` it
					 * still wraps, which is what keeps the 390 px behaviour the
					 * `ITEM 1 RESPONSIVE` row pins.
					 *
					 * A7 c13 / ITEM 1 — `lg:flex-nowrap` stays, but the SENTENCE inside
					 * it is now allowed to take a second line within its own (elastic)
					 * box. The row's height budget is untouched: the notice's siblings are
					 * `shrink-0`, so no sibling is displaced by the wrapped sentence. */
					? 'flex min-w-0 flex-wrap items-center gap-1.5 text-xs lg:flex-nowrap'
					: 'flex min-h-8 flex-wrap items-center gap-1.5 border-b px-3 py-1 text-xs',
				/* Not red, and not amber: an unapplied change is neither an error
				 * nor an alarm. The two surviving states are the neutral notice
				 * (a trustworthy comparison) and the calm note (ATLAS could not
				 * check), and the difference is in the SENTENCE, so it survives a
				 * monochrome read rather than depending on colour. */
				tone === 'calm-note' ? 'border-border bg-muted/40 text-muted-foreground' : 'border-border bg-background text-foreground',
			)}
		>
			<span
				data-testid="timetable-simple-drift-message"
				className={cn(
					/* C11 S2 — the 390 px wrap is unchanged in mechanism: the sentence
					 * takes its own line below `sm` (`w-full basis-full`) and shares
					 * the line from `sm` up, so no label is ever squeezed into a
					 * one-word column. `break-words` keeps a long area name from
					 * overflowing. No overflow container is added, so the no-scroll
					 * architecture (§8) is untouched.
					 *
					 * A7 c13 / ITEM 1 — the sentence WRAPS instead of truncating. It
					 * used to carry `lg:truncate lg:whitespace-nowrap` so the widest
					 * child absorbed the row's width pressure with an ellipsis, which
					 * is exactly the `Teaching Load and Te…` the operator saw. It is
					 * still the notice's ELASTIC part (`min-w-0`, `sm:flex-1`) and
					 * still shares the line from `sm` up; it simply takes a second
					 * line inside its own row rather than cutting the words. The
					 * header's ≤2-row budget is preserved by the fixed-width siblings
					 * (`shrink-0`), not by an ellipsis. */
					'min-w-0 w-full basis-full break-words whitespace-normal sm:w-auto sm:flex-1',
					tone === 'calm-note' ? 'text-muted-foreground' : 'font-medium text-foreground',
				)}
			>
				{sentence}
			</span>
			{/* The secondary: the detail. It renders only when there IS a detail —
			 * a control with nothing behind it is a dead control. */}
			{onShowDetail ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 shrink-0 gap-1 px-2 text-xs"
					onClick={onShowDetail}
					data-testid="timetable-simple-impact-preview"
				>
					<ListTree className="size-3" aria-hidden="true" />
					See what changed
				</Button>
			) : null}
			{/* The primary of THIS row. `outline` keeps DRAFT-UX-C01's single solid
			 * primary intact; the verb and the weight carry the hierarchy. A
			 * disabled action states its reason in VISIBLE text (§8), never only
			 * in a `title` or a hover. */}
			{onApply ? (
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 shrink-0 gap-1 px-2 text-xs font-semibold"
					onClick={onApply}
					disabled={applyDisabled}
					data-testid="timetable-simple-regenerate-to-apply"
				>
					<RefreshCw className="size-3" aria-hidden="true" />
					Update schedule
					{applyDisabled && applyDisabledReason ? (
						<span className="font-normal text-muted-foreground" data-testid="timetable-simple-apply-reason">
							{applyDisabledReason}
						</span>
					) : null}
				</Button>
			) : null}
			{/* The changed-area labels stay available to assistive tech and to any
			 * caller that needs them, WITHOUT becoming visible chips: the names
			 * are already in the sentence, and a second visible rendering of the
			 * same fact is what made the old row two titles. */}
			<span className="sr-only" data-testid="timetable-simple-change-areas">
				{changedAreas.join(', ')}
			</span>
		</div>
	);
}
