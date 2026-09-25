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
import { AlertTriangle, ExternalLink, RotateCw } from 'lucide-react';

import { Button } from '@/ui/button';
import { ScrollArea } from '@/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/ui/sheet';
import type {
	TimetableGenerationBlockerPresentation,
	TimetableGenerationReadinessDiagnostic,
} from '@/lib/timetable-generation-readiness';
import { presentGenerationBlockers } from '@/lib/timetable-generation-readiness';

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
	rows: TimetableGenerationBlockerPresentation[];
	/** Re-runs the readiness check in place. A `retry` row calls this. */
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
	rows,
	onRetry,
	onRequestClose,
}: SimpleGenerationBlockerSheetBodyProps) {
	return (
		<>
			<ScrollArea className="min-h-0 flex-1">
				<div className="space-y-2 p-4" data-testid="timetable-generation-blocker-list">
					<p className="text-xs text-muted-foreground" data-testid="timetable-generation-blocker-count">
						{rows.length} setup {rows.length === 1 ? 'item' : 'items'} must be fixed before a timetable can be made.
					</p>
					<ul className="space-y-2">
						{rows.map((row) => (
							<li
								key={row.key}
								className="rounded-xl border border-border bg-muted/30 p-3"
								data-testid="timetable-generation-blocker-item"
							>
								<div className="flex items-start gap-2">
									<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
									<p className="min-w-0 flex-1 text-sm font-medium text-foreground">
										{row.sentence}
									</p>
								</div>
								<div className="mt-2 flex justify-start">
									{row.repair.kind === 'retry' ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="h-9 gap-1.5 text-xs"
											data-testid="timetable-generation-blocker-retry"
											onClick={() => { onRequestClose(); onRetry(); }}
										>
											<RotateCw className="size-3.5" aria-hidden="true" />
											{row.repair.label}
										</Button>
									) : (
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
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
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
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full max-w-md flex-col p-0 sm:max-w-lg"
				data-testid="timetable-generation-blocker-sheet"
			>
				<SheetHeader className="border-b px-4 py-3">
					<SheetTitle className="text-base">What is stopping a timetable</SheetTitle>
					<SheetDescription className="text-xs">
						Fix these setup items, then check again.
					</SheetDescription>
				</SheetHeader>
				<SimpleGenerationBlockerSheetBody
					rows={rows}
					onRetry={onRetry}
					onRequestClose={() => onOpenChange(false)}
				/>
			</SheetContent>
		</Sheet>
	);
}

export const SimpleGenerationBlockerSheet = memo(SimpleGenerationBlockerSheetImpl);
