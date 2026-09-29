/**
 * A8-C5 S2.3 / S2.4 — ONE shape for "one plain line per cause, with a count and
 * ONE button that opens the exact place".
 *
 * WHY THIS EXISTS AND WHY IT IS NOT A SECOND SHAPE. The packet's rule 1 is a
 * shape, and until now the shape lived inside
 * `SimpleGenerationBlockerGroups` — a component whose name and props tie it to
 * the *generation blocker* panel. S2.3 needs the same shape in the Generate
 * dialog (for the capability-level stoppers, which have no blocker codes) and
 * S2.4 needs it in the publish refusal (for the placeholder-owned and open
 * classes). Copying that markup three times is how the wording and the routes
 * would drift, which is the exact defect S2.1's single table exists to remove.
 *
 * So this is deliberately NOT a new visual language: every class below is copied
 * from `SimpleGenerationBlockerGroups` — the same card, the same
 * `AlertTriangle` cue, the same `text-sm font-medium` headline, the same
 * outline Button wrapping a react-router `Link` with the `ExternalLink` glyph.
 * A scheduler sees one cause-list look across the panel, the Generate dialog and
 * the publish refusal, which is §8's "one look per control" applied to a list.
 *
 * WHAT IS THE SAME SOURCE OF WORDS. The `line` is composed by the caller, and
 * every caller composes it from `blockerSentence` in
 * `@/lib/timetable-blocker-code-copy` (or from a capability stopper's own
 * authored sentence). This component never writes a sentence: it renders one. So
 * adding a cause can never introduce a second way of saying an existing one.
 *
 * THE COUNT IS CARRIED, NEVER INVENTED. `count` is `null` when nothing was
 * measured, and a null count prints no number at all — the "651 setup items"
 * defect this lane exists to remove. It is exposed as `data-cause-count` so a
 * rendered control can assert the number on screen is the number the server
 * measured.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, RotateCw } from 'lucide-react';

import { Button } from '@/ui/button';

export type PlainCauseLine = {
	/** Stable key. Carries no engine text into the DOM. */
	key: string;
	/**
	 * The whole sentence, count included where one was measured. Authored by the
	 * caller from the shared table or from a capability stopper — never here.
	 */
	line: string;
	/**
	 * The count the server measured, or `null` when nothing was measured. A cause
	 * with no measurement says no number.
	 */
	count: number | null;
	/** ONE real fix route. Always a mounted app path. */
	href: string;
	/** The ONE button label for that route. */
	actionLabel: string;
};

export type PlainCauseLinesProps = {
	causes: PlainCauseLine[];
	/** The lead line above the list, or null for none. */
	heading?: string | null;
	/**
	 * The ONE recheck for the whole list. `null` when a host that owns its own
	 * single recheck renders this list, so the action never appears twice.
	 */
	onCheckAgain?: (() => void) | null;
	/** Test-id prefix, so two hosts can both render this without colliding. */
	testId: string;
};

export function PlainCauseLines({ causes, heading, onCheckAgain, testId }: PlainCauseLinesProps) {
	if (causes.length === 0) return null;
	return (
		<div className="space-y-2" data-testid={testId}>
			{heading ? (
				<p className="text-sm text-muted-foreground" data-testid={`${testId}-heading`}>{heading}</p>
			) : null}
			<ul className="space-y-2">
				{causes.map((cause) => (
					<li
						key={cause.key}
						className="rounded-xl border border-border bg-muted/30 p-3"
						data-testid={`${testId}-cause`}
						data-cause-count={cause.count === null ? 'none' : String(cause.count)}
					>
						<div className="flex items-start gap-2">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
							{/*
							 * `text-sm` (15px) for the sentence, matching the headline step of
							 * `SimpleGenerationBlockerGroups`; `text-xs` (14px — the floor is
							 * 14px and this theme's `text-xs` IS 14px, `index.css:49`) for the
							 * supporting line and for the outline buttons, whose shared `sm`
							 * size is 12.8px and would otherwise drop below the floor.
							 */}
							<p className="min-w-0 flex-1 text-sm font-medium text-foreground" data-testid={`${testId}-line`}>
								{cause.line}
							</p>
						</div>
						<div className="mt-2 flex justify-start">
							<Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
								<Link to={cause.href} data-testid={`${testId}-action`}>
									<ExternalLink className="size-3.5" aria-hidden="true" />
									{cause.actionLabel}
								</Link>
							</Button>
						</div>
					</li>
				))}
			</ul>
			{onCheckAgain ? (
				<div className="flex justify-start border-t border-border pt-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-9 gap-1.5 text-xs"
						data-testid={`${testId}-check-again`}
						onClick={onCheckAgain}
					>
						<RotateCw className="size-3.5" aria-hidden="true" />
						Check again
					</Button>
				</div>
			) : null}
		</div>
	);
}

export const PlainCauseLinesPanel = memo(PlainCauseLines);
