/**
 * LANE-C C2-a — the generation-blocker disclosure.
 *
 * Finding 1 of `docs/reviews/timetable-ux-audit-20260926/audit.md`: a scheduler
 * who hit a blocked generation could never start. The header said "Review the
 * item shown" and showed no item, because `diagnostic.blockers[]` was never
 * rendered anywhere in the client. This is the surface that renders it.
 *
 * Two accepted contracts constrain the placement:
 *
 * - The Simple header shows at most six visible controls and exactly one solid
 *   primary (`draft-ux-c01.test.tsx`, `timetable-header-collapse-c01.test.tsx`).
 *   A per-row list of actions inside the header would be a seventh control, so
 *   this lives in a `Sheet`: the rows render in a portal, outside the header
 *   element, and the entry point is the header's EXISTING merged warnings
 *   control, which is otherwise disabled in this state. No control is added.
 * - `audit.md` "Protect this" #1: exactly one solid primary. Every action below
 *   is `variant="outline"`; nothing here competes with the header's primary.
 *
 * Every row is a real action: a `retry` repair re-runs the readiness check, and
 * a `navigate` repair is a `Link` to the route the shared resolver chose. There
 * are no no-op rows.
 *
 * The body is exported separately from the Radix portal, following
 * `SimplePublishReadinessSheet`, so the real rendered surface is directly
 * testable. The sheet renders exactly this component; there is no second
 * rendering path.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import { SimpleGenerationBlockerGroups } from './SimpleGenerationBlockerGroups';
import type {
	TimetableGenerationBlockerGroupPresentation,
	TimetableGenerationBlockerPresentation,
	TimetableGenerationReadinessDiagnostic,
} from '@/lib/timetable-generation-readiness';
import { presentGenerationBlockerGroups, presentGenerationBlockers } from '@/lib/timetable-generation-readiness';

export type SimpleGenerationBlockerSheetProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Null renders nothing; the caller only opens this for a blocked state. */
	diagnostic: TimetableGenerationReadinessDiagnostic | null;
	/** Re-runs the readiness check in place. Never a no-op. */
	onRetry: () => void;
	/** The workspace reference-name resolvers, so a row can name a real class. */
	labelForSection?: (id: number) => string;
	labelForSubject?: (id: number) => string;
};

export type SimpleGenerationBlockerSheetBodyProps = {
	/** Null renders nothing; the caller only opens this for a blocked state. */
	diagnostic?: TimetableGenerationReadinessDiagnostic | null;
	/**
	 * A8 C3 — the complete row list, kept behind the disclosure. It is optional
	 * so the accepted `rows`-only call shape keeps working unchanged.
	 */
	rows?: TimetableGenerationBlockerPresentation[];
	groups?: TimetableGenerationBlockerGroupPresentation[];
	/** The real blocking count; the disclosure names the row count it folds. */
	blockingCount?: number;
	gapClassCount?: number;
	/** Re-runs the readiness check in place. The ONE panel-level control calls this. */
	onRetry: () => void;
	onRequestClose: () => void;
};

/**
 * The blocker list. Every row states the problem in plain words and offers the
 * one real repair for it. A `retry` closes the sheet and re-runs the check; a
 * `navigate` row is a `Link` that closes the sheet and follows a real mounted
 * route, so it needs no separate navigate callback.
 */
export function SimpleGenerationBlockerSheetBody({
	diagnostic = null,
	rows,
	groups,
	blockingCount,
	gapClassCount,
	onRetry,
	onRequestClose,
}: SimpleGenerationBlockerSheetBodyProps) {
	// A8 C3 — the ROW list is preserved exactly as it was: same sentences, same
	// per-row repairs, same test ids. It is no longer the default view; it is the
	// disclosed detail, so the accepted evidence for "every blocker is
	// presented" is not lost to a cosmetic change.
	const rowList = rows ?? (diagnostic ? presentGenerationBlockers({ diagnostic }) : []);
	const groupList = groups ?? (diagnostic ? presentGenerationBlockerGroups({ diagnostic }) : []);
	const blocking = blockingCount ?? diagnostic?.blockerCount ?? rowList.length;
	const gapClasses = gapClassCount ?? diagnostic?.gapClassCount ?? 0;
	const detail = (
		<div className="space-y-2" data-testid="timetable-generation-blocker-list">
			<p className="text-xs text-muted-foreground" data-testid="timetable-generation-blocker-count">
				{rowList.length} setup {rowList.length === 1 ? 'item' : 'items'} in full.
			</p>
			<ul className="space-y-2">
				{rowList.map((row) => (
					<li
						key={row.key}
						className="rounded-xl border border-border bg-muted/30 p-3"
						data-testid="timetable-generation-blocker-item"
					>
						<div className="flex items-start gap-2">
							<ExternalLink className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
							<p className="min-w-0 flex-1 text-sm font-medium text-foreground">
								{row.sentence}
							</p>
						</div>
						<div className="mt-2 flex justify-start">
							{/*
							 * A8 C3 — the per-row "Recheck generation readiness" control is
							 * REMOVED (packet item 2). It was one of 651 identical buttons
							 * and it was never row-specific: the readiness check re-reads the
							 * whole year, so the single panel-level "Check again" directly above
							 * does exactly what it did. Row-SPECIFIC repairs (a real `navigate`
							 * to Teaching Load, the room map or Year Setup) are kept, because
							 * those genuinely differ per row and the accepted C2-a.5 row pins
							 * them.
							 */}
							{row.repair.kind === 'navigate' ? (
								<Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
									<Link
										to={row.repair.href}
										data-testid="timetable-generation-blocker-navigate"
										onClick={onRequestClose}
									>
										<ExternalLink className="size-3.5" aria-hidden="true" />
										{row.repair.label}
									</Link>
								</Button>
							) : null}
						</div>
					</li>
				))}
			</ul>
		</div>
	);

	// A8 C3 — the DEFAULT view is one line per root cause plus ONE "Check again".
	// The per-row "Recheck generation readiness" control is gone from the default
	// view because 620 identical buttons was the defect; the full list behind the
	// disclosure keeps the same actions, and the panel-level control does the same
	// in-place recheck the per-row button used to.
	const groupLead = blocking > 0
		? `${blocking} ${blocking === 1 ? 'thing' : 'things'} must be fixed before a timetable can be made.`
		: gapClasses > 0
			? `${gapClasses} ${gapClasses === 1 ? 'class' : 'classes'} need a teacher. The schedule can still be made.`
			: 'Check the schedule information again.';
	// The disclosure ALWAYS names the real row count, even when it happens to
	// equal the number of lines: a control that silently changed what it counts
	// would be the same "651 identical rows" defect in a different place.
	const detailSummary = `Show all ${rowList.length} setup ${rowList.length === 1 ? 'item' : 'items'}`;

	return (
		<>
			<p className="px-4 pt-3 text-xs text-muted-foreground" data-testid="timetable-generation-blocker-summary">
				{groupLead}
			</p>
			<ScrollArea className="min-h-0 flex-1">
				<SimpleGenerationBlockerGroups
					groups={groupList}
					onCheckAgain={() => { onRequestClose(); onRetry(); }}
					detail={detail}
					detailSummary={detailSummary}
				/>
			</ScrollArea>
		</>
	);
}

function SimpleGenerationBlockerSheetImpl({
	open,
	onOpenChange,
	diagnostic,
	onRetry,
	labelForSection,
	labelForSubject,
}: SimpleGenerationBlockerSheetProps) {
	// The presentation is derived once here, so the header and this sheet can
	// never disagree about what an operator is told.
	const rows = diagnostic
		? presentGenerationBlockers({ diagnostic, labelForSection, labelForSubject })
		: [];
	const groups = diagnostic
		? presentGenerationBlockerGroups({ diagnostic, labelForSection })
		: [];
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full max-w-md flex-col p-0 sm:max-w-lg"
				data-testid="timetable-generation-blocker-sheet"
			>
				<SheetHeader className="border-b px-4 py-3">
					<SheetTitle className="text-base">What is stopping a schedule</SheetTitle>
					<SheetDescription className="text-xs">
						One line per cause. Fix these, then check again.
					</SheetDescription>
				</SheetHeader>
				<SimpleGenerationBlockerSheetBody
					diagnostic={diagnostic}
					rows={rows}
					groups={groups}
					blockingCount={diagnostic?.blockerCount}
					gapClassCount={diagnostic?.gapClassCount}
					onRetry={onRetry}
					onRequestClose={() => onOpenChange(false)}
				/>
			</SheetContent>
		</Sheet>
	);
}

export const SimpleGenerationBlockerSheet = memo(SimpleGenerationBlockerSheetImpl);
