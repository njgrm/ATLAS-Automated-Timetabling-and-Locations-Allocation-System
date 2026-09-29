/**
 * A5 C5 (2026-09-29) — "which timetable am I looking at, and when was it made?".
 *
 * ONE unit with ONE owner. Three things that used to be three unrelated controls on
 * `pages/RoomSchedules.tsx` are one question, and a scheduler should be able to read the whole
 * answer in one glance at the tail of the page's second row:
 *
 *  - a term control, shown ONLY when the active school year really has terms that differ (the
 *    packet's "at most one term control"). It scopes the grid AND the official download, which is
 *    how the page's second, download-only term picker was deleted rather than moved.
 *  - the quiet line that names the timetable in words — `Showing the timetable made on 29 Sept`.
 *    Never a run id.
 *  - a DATED disclosure, `Show an older timetable`, listing dates. It is the packet's answer to
 *    "if an older timetable must stay reachable, put it behind a small link listing dates, not
 *    ids": the date is what a scheduler recognises, and the run id travels internally from the
 *    `onPinnedChange` callback to the fetch and the print request, never to the DOM.
 *
 * The term explainer lives in a `Tooltip` rather than the page's old `How to browse schedules`
 * panel: it is operator knowledge (ROOMS-SCHEDULES-TERM-C01 — a weekly grid merged across all three
 * terms shows the same class three times in one slot and invents conflicts), and it is needed
 * only by someone who is about to change the term.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SELECT_NO_VALUE } from '@/ui/select';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import { pickerTriggerClass } from '@/ui/picker-trigger';
import type { AcademicTermOption, OrderedAcademicTerm } from '@/lib/academic-term';

export type DatedTimetable = { id: number; madeOn: string | null };

/**
 * A2 c14 follow-up (item 3) — the ONE value that means "no term is chosen yet",
 * for THIS term picker.
 *
 * SCOPE, stated honestly: this fixes the term `Select` IN THIS COMPONENT. It does
 * not close the class. The same shape also existed at
 * `simple/SimplePastYearReadOnlySurface.tsx` on `/timetable` and is fixed there
 * too, with the shared `SELECT_NO_VALUE` from `@/ui/select`; the sweep behind that
 * is recorded on the primitive. Anything that reaches the same pattern later must
 * use the same sentinel — a second local copy of this idea would be a second place
 * to get it wrong.
 *
 * Lane C's train-8 walk saw React warn on route change: *"Select is changing from
 * uncontrolled to controlled"*, on `/room-schedules` and others. For this picker
 * the cause is here, and it is not the router and not the route change. This
 * component passed
 *
 *     value={viewTerm != null ? String(viewTerm) : undefined}
 *
 * and `undefined` is exactly how Radix is told to be UNCONTROLLED. On mount the
 * active term is not verified yet, so `viewTerm` is `null` and the control was
 * uncontrolled; a moment later the term resolved, `viewTerm` became a number and
 * the same mounted control became controlled. React is right to complain: a
 * control that changes mode mid-life is the defect, on every platform, not a
 * quirk of this one.
 *
 * `/room-schedules` is where it was visible because it is the one page whose term
 * genuinely starts unresolved — the walk recorded "Term not verified" and a
 * disabled picker — so it is the one page that takes the uncontrolled→controlled
 * path. A page that already had a verified term at mount never tripped it.
 *
 * The fix keeps the control CONTROLLED for its whole lifetime, using the defined
 * empty string as the "nothing chosen" value. That is not a suppression: it removes
 * the mode change, which is the actual defect, and it leaves every other
 * uncontrolled→controlled input free to warn. It is safe here because no
 * `SelectItem` can hold `''` — the options are `String(term.order)`, and a term
 * order is a number, so the smallest possible option value is `"0"`. Radix
 * rejects an empty-string ITEM, which is why the sentinel belongs on the
 * control and not in the list.
 */
export const NO_TERM_SELECTED = SELECT_NO_VALUE;

export function ScheduleSourceBand({
	termOptions,
	orderedTerms,
	viewTerm,
	termVerified,
	onTermChange,
	sentence,
	pastRuns,
	pinnedRunId,
	onPinnedChange,
}: {
	termOptions: AcademicTermOption[];
	orderedTerms: OrderedAcademicTerm[] | null;
	viewTerm: number | null;
	termVerified: boolean;
	onTermChange: (value: string) => void;
	sentence: string | null;
	pastRuns: DatedTimetable[];
	pinnedRunId: number | null;
	onPinnedChange: (runId: number | null) => void;
}) {
	// A year with one term gets NO control. A scheduler reading one term of one year is not being
	// asked a question, and a control with one option is a control that teaches nothing.
	const termControlWarranted = termOptions.length > 1;

	return (
		<div className="ml-auto flex shrink-0 items-center gap-2" data-testid="schedules-source-band">
			{termControlWarranted && (
				<Tooltip>
					<TooltipTrigger asChild>
						<div>
							<Select
								value={viewTerm != null ? String(viewTerm) : NO_TERM_SELECTED}
								onValueChange={onTermChange}
								disabled={!termVerified}
							>
								<SelectTrigger
									className={pickerTriggerClass('sm')}
									aria-label="Schedule term"
									data-testid="schedules-view-term"
								>
									<SelectValue placeholder="Term" />
								</SelectTrigger>
								<SelectContent>
									{termOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</TooltipTrigger>
					<TooltipContent side="bottom" className="max-w-xs text-xs">
						One term at a time. A week built from all three terms would show the same class
						three times in one slot and report conflicts that do not exist.
					</TooltipContent>
				</Tooltip>
			)}
			{sentence && (
				/* A5 C5 CORRECTION ROUND 1 (N4): `whitespace-nowrap` is GONE from this sentence.
				 * It sat inside a `flex-wrap` row at the tail of the header, so a long sentence
				 * could not shorten itself — it could only push the row onto a THIRD line, which is
				 * precisely the "crammed to hit a row count" failure `AGENTS.md` §8 names. Letting
				 * the text wrap keeps the band inside the two-row budget. A judgement call, not a
				 * measured one: the rendered header height is UNJUDGED and is Lane C's browser row. */
				<span
					className="min-w-0 text-xs text-muted-foreground"
					data-testid="schedules-source-line"
				>
					{sentence}
				</span>
			)}
			{pastRuns.length > 1 && (
				<Popover>
					<PopoverTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-9 gap-1 px-2 text-xs"
							data-testid="schedules-older-trigger"
						>
							Show an older timetable
						</Button>
					</PopoverTrigger>
					<PopoverContent align="end" className="w-72 p-1">
						{pastRuns.map((run) => (
							<Button
								key={run.id}
								type="button"
								variant={pinnedRunId === run.id ? 'secondary' : 'ghost'}
								className="h-auto w-full justify-start py-2 text-left text-xs"
								onClick={() => onPinnedChange(pinnedRunId === run.id ? null : run.id)}
								data-testid="schedules-older-option"
							>
								{run.madeOn ?? 'Date not recorded'}
							</Button>
						))}
					</PopoverContent>
				</Popover>
			)}
		</div>
	);
}
