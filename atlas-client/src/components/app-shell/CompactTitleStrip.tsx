/**
 * A3-TITLE-STRIP-C3 — the one compact title-strip contract.
 *
 * A3-C1 recorded three page-title densities on the non-timetable routes: the
 * `PageHeader` card (grade B, unchanged by this stream) and TWO compact strips
 * that disagreed with each other on container, padding, row layout, status
 * affordance and per-page title scale:
 *
 *   strip A  `/sections` `/subjects` `/teachers`  — AdminWorkspaceFrame
 *   strip B  `/teaching-load`                      — WorkspaceToolbar
 *
 * This file is the single owner of the strip shell those two now share. It does
 * NOT own the title: each call site still writes its own `<h1>` with its own
 * scale class (A `text-lg lg:text-xl`, B `text-sm sm:text-base`), because
 * unifying that scale is a product trade this stream cannot measure — see
 * OPEN DECISION in the a3-title-strip-c3 suite header. It does not own the
 * status control either: A keeps `AdminSourceStateChip` and B keeps its
 * `Badge`; this file owns the hover explanation they share.
 *
 * The contract, verbatim:
 *   - one outer treatment, full-bleed, hairline bottom border, `py-1`;
 *   - one row: title + status on the left, actions flush right;
 *   - a status that explains ITSELF ON HOVER: description + next action.
 *
 * HEIGHT. The container vertical box is 9px (8px padding + 1px hairline) and
 * the row's own height-driving classes are untouched at either call site, so
 * neither header can have grown. Before this change, strip A's container box
 * was 13px and strip B's was 23px (a 10px card inside a 13px page band). The
 * suite pins both numbers, so a future `py-1` -> `py-2`, a reintroduced card
 * inset, or a restored page band goes red.
 *
 * A note on why the strip is full-bleed rather than a card: strip A's frame
 * owns a viewport column with NO padding around the header, so giving A a
 * card treatment could only ever ADD vertical space. Height-neutrality
 * therefore FORCES the full-bleed direction, and strip B had to follow it
 * (its padded page band was redundant with the strip's own padding).
 */
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * The four layout classes both strips now share. Exported so the committed
 * suite can assert that neither call site re-declares one of them locally:
 * a class literal reintroduced in a consumer is exactly how this unification
 * silently decayed the first time.
 */
export const COMPACT_TITLE_STRIP_CLASS = {
	/** Full-bleed bar, hairline bottom border, 4px vertical padding. */
	outer: 'shrink-0 border-b bg-background/85 px-4 py-1 backdrop-blur-md lg:px-5',
	/** One wrapping row; `justify-between` is what puts actions flush right. */
	row: 'flex min-w-0 flex-wrap items-center justify-between gap-2',
	/** Title + status. `shrink-0` keeps the pair from being squeezed narrow. */
	leading: 'flex min-w-0 shrink-0 items-center gap-2',
	/** Primary action, help, and the More/overflow. Never wraps internally. */
	trailing: 'flex shrink-0 flex-nowrap items-center gap-2',
	/**
	 * The hover target wrapper around the caller's status control. It carries NO
	 * padding, margin or fixed height: it exists because Radix needs a real
	 * element to measure for tooltip positioning, and it must be a real box
	 * (`display: contents` measures as zero). Its height is therefore exactly
	 * its content's height, so it cannot contribute to the row height.
	 */
	status: 'flex shrink-0 items-center',
} as const;

export function CompactTitleStrip({
	stripTestId,
	rowTestId,
	title,
	status,
	statusDescription,
	statusNextAction,
	actions,
	children,
}: {
	stripTestId: string;
	rowTestId: string;
	/**
	 * The call site's own `<h1>` element, scale classes and all. It is passed in
	 * as a node rather than as text on purpose: the per-page title scale is a
	 * preserved decision, not a parameter this component may normalize.
	 */
	title: ReactNode;
	/** The caller's own status control (chip, badge, ...), unmodified. */
	status: ReactNode;
	/** First line of the hover explanation. */
	statusDescription: string;
	/** Second line of the hover explanation: what the operator can do next. */
	statusNextAction: string;
	/** Primary action, help trigger, More/overflow. */
	actions: ReactNode;
	/** Optional rows below the strip row (e.g. Teaching Load tabs and readiness). */
	children?: ReactNode;
}) {
	return (
		<div className={COMPACT_TITLE_STRIP_CLASS.outer} data-testid={stripTestId}>
			{/* The provider wraps the trailing rows too, not just the status row, so
				every strip is self-sufficient: it renders without an ambient
				TooltipProvider. Strip B's alert chip is a Tooltip below the row. */}
			<TooltipProvider>
				<div className={COMPACT_TITLE_STRIP_CLASS.row} data-testid={rowTestId}>
					<div className={COMPACT_TITLE_STRIP_CLASS.leading}>
						{title}
						<Tooltip>
							<TooltipTrigger asChild>
								<span className={COMPACT_TITLE_STRIP_CLASS.status} data-testid="compact-title-strip-status">
									{status}
								</span>
							</TooltipTrigger>
							<TooltipContent
								side="bottom"
								className="max-w-72 p-3 text-xs font-medium leading-relaxed"
								data-testid="compact-title-strip-status-tooltip"
							>
								<p className="font-semibold text-foreground">{statusDescription}</p>
								<p className="mt-1 text-muted-foreground">{statusNextAction}</p>
							</TooltipContent>
						</Tooltip>
					</div>
					<div className={COMPACT_TITLE_STRIP_CLASS.trailing}>{actions}</div>
				</div>
				{children}
			</TooltipProvider>
		</div>
	);
}
