/**
 * A8 C3 — one line per ROOT CAUSE, and ONE "Check again" for the whole panel.
 *
 * WHAT THIS FIXES, in the operator's own terms. On live S.Y. 2023-2024 the
 * "See what to fix" panel rendered 651 rows, each an identical sentence with its
 * own "Recheck generation readiness" button: 570 session rows and 50 pair rows
 * describing the SAME 50 classes with no teacher, plus 31 rows of three further
 * root causes. A scheduler could not start, and could not tell a fixable class
 * from a session.
 *
 * THE RULE THIS RENDERS. One line per root cause, counted in classes. Nothing is
 * hidden to achieve it: the complete row list stays in the panel behind the
 * disclosure, and it is rendered by the same `SimpleGenerationBlockerSheetBody`
 * that rendered it before, so no evidence row was deleted to make the panel
 * look calm.
 *
 * §8. This is a SUBTRACTION. Before: 651 lines and 651 buttons. After: one line
 * per cause and one button. Nothing was added to a region — the grouped lines
 * REPLACE the row list, which moves behind the disclosure. No `title`
 * attributes, no native `<details>`, no raw `<select>`; the disclosure is the
 * shared `@/ui` Accordion and every action is the shared `@/ui` Button.
 */

import { memo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink, RotateCw } from 'lucide-react';

import { Button } from '@/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import type { TimetableGenerationBlockerGroupPresentation } from '@/lib/timetable-generation-readiness';

export type SimpleGenerationBlockerGroupsProps = {
	groups: TimetableGenerationBlockerGroupPresentation[];
	/** The one in-place recheck for the WHOLE panel. Never a no-op. */
	onCheckAgain: () => void;
	/** The complete row list, kept behind the disclosure. */
	detail: React.ReactNode;
	/** The disclosure's honest count sentence ("620 setup items"). */
	detailSummary: string;
};

/**
 * The grouped panel. Extracted from the sheet so the real rendered surface is
 * directly testable, following `SimpleGenerationBlockerSheetBody`.
 */
export function SimpleGenerationBlockerGroups({
	groups,
	onCheckAgain,
	detail,
	detailSummary,
}: SimpleGenerationBlockerGroupsProps) {
	return (
		<div className="space-y-2 p-4" data-testid="timetable-generation-blocker-groups">
			<ul className="space-y-2">
				{groups.map((group) => (
					<li
						key={group.key}
						className="rounded-xl border border-border bg-muted/30 p-3"
						data-testid="timetable-generation-blocker-group"
					>
						<div className="flex items-start gap-2">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-foreground" data-testid="timetable-generation-blocker-group-headline">
									{group.headline}
								</p>
								{group.detail ? (
									<p className="mt-0.5 text-xs text-muted-foreground" data-testid="timetable-generation-blocker-group-detail">
										{group.detail}
									</p>
								) : null}
							</div>
						</div>
						{/*
						 * A8 C3 ITEM 8: every group's action is a real navigation to
						 * the surface that fixes that cause, so there is no `retry`
						 * branch. The one in-place recheck for the panel is the single
						 * "Check again" below, which is the same control the removed
						 * per-row buttons all called. A dead branch here would have been
						 * an unreachable control path, and §8 allows no control that
						 * cannot be reached.
						 */}
						<div className="mt-2 flex justify-start">
							<Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
								<Link to={group.action.href} data-testid="timetable-generation-blocker-group-action">
									<ExternalLink className="size-3.5" aria-hidden="true" />
									{group.action.label}
								</Link>
							</Button>
						</div>
					</li>
				))}
			</ul>
			<div className="flex justify-start border-t border-border pt-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-9 gap-1.5 text-xs"
					data-testid="timetable-generation-blocker-check-again"
					onClick={onCheckAgain}
				>
					<RotateCw className="size-3.5" aria-hidden="true" />
					Check again
				</Button>
			</div>
			<Accordion type="single" collapsible className="border-t border-border pt-2">
				<AccordionItem value="detail">
					{/*
					 * The shared `@/ui` Accordion primitive does not forward extra
					 * props to its trigger, so the test id lives on a child of the
					 * trigger rather than on the primitive. Clicking it bubbles to
					 * the primitive's own button, so the control under test is still
					 * the real one.
					 */}
					<AccordionTrigger className="h-8 text-xs">
						<span data-testid="timetable-generation-blocker-detail-trigger">{detailSummary}</span>
					</AccordionTrigger>
					<AccordionContent>
						<div data-testid="timetable-generation-blocker-detail">{detail}</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
		</div>
	);
}

export const SimpleGenerationBlockerGroupsPanel = memo(SimpleGenerationBlockerGroups);
