/**
 * TeacherAttentionFilters — the roster's attention-chip filter row.
 *
 * Extracted from `pages/Faculty.tsx` so that page does not grow past the
 * AGENTS.md §8 1000-line cap.
 *
 * Fix 21: this row used to live inside a "Next teacher" strip that also carried
 * a `Review load` link out to `/teaching-load`. The strip is gone and this chip
 * row is now the whole `leadingContent`, which reclaims the vertical space for
 * the roster. The repair-intent logic it used to host did not die with it — it
 * moved into the in-place `Review teachers` modal (`FacultyRosterReview`).
 */
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export type TeacherAttentionChip = {
	id: string;
	label: string;
	helper: string;
	count: number;
};

type TeacherAttentionFiltersProps = {
	chips: TeacherAttentionChip[];
	activeChipId: string;
	onApplyFilter: (id: string) => void;
};

export function TeacherAttentionFilters({
	chips,
	activeChipId,
	onApplyFilter,
}: TeacherAttentionFiltersProps) {
	return (
		<section
			data-testid="teacher-attention-filters"
			className="rounded-t-xl bg-primary/[0.03] px-2.5 py-1.5"
			aria-label="Filter teachers by attention state"
		>
			<div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
				{chips.map((chip) => (
					<TooltipProvider key={chip.id} delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									type="button"
									variant={activeChipId === chip.id ? 'default' : 'outline'}
									size="sm"
									aria-pressed={activeChipId === chip.id}
									// Fix 24: `whitespace-nowrap` + `shrink-0` keep the chip label on
									// one line; `overflow-x-auto` on the row is the honest escape when
									// the translated labels are genuinely wider than the column.
									//
									// A9 C6 (2026-09-29), fix 1.2 item 7.2 — `secondary` -> `default` for
									// the ACTIVE chip. Rendered on a loopback preview against real staging
									// data at 1366x768, the active chip measured `background rgb(243,244,246)`
									// with a TRANSPARENT border against an inactive `rgb(255,255,255)` with an
									// `rgb(229,231,235)` border: a 3% grey shift that left "All teachers"
									// reading as a read-only metric rather than a pressed filter, and made
									// it look LESS bordered than its neighbours. The operator asked for "an
									// obvious active state", and the standing rule is that a chip which
									// filters must look like something you press.
									//
									// `default` is the variant this codebase ALREADY uses for an active
									// segment of a filter group (`SchedulerPrintDialog.tsx:149`,
									// `TimetableTaskDrawer.tsx:581`: `variant={active ? 'default' : 'outline'}`),
									// so this copies the best existing pattern instead of inventing a local
									// one. It changed here AND in `RoomReadinessList.tsx` together, because
									// AGENTS.md §8 makes these two rows ONE control: fixing only one would
									// have left two filter rows on two pages looking different. Nothing else
									// in this file changes — the label, the count, the tooltip helper and
									// `aria-pressed` are all untouched, so fix 1.2 item 35.1's tooltip work
									// on this row is unaffected. The count below drops
									// `text-muted-foreground` for `opacity-80`, because a real check of
									// the ACTIVE chip found it rendering dark slate on the filled green
									// `default` background — low contrast on the one chip whose state the
									// operator most needs to see — and `opacity-80` tracks whatever
									// foreground the variant supplies, so the count is legible on the
									// outline chips AND on the active one. Applied to both rows together
									// for the same §8 reason as the variant change.
									className="h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-2.5 text-xs font-bold"
									onClick={() => onApplyFilter(chip.id)}
								>
									{chip.label}
									<span className="ml-1 tabular-nums opacity-80">{chip.count}</span>
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom" className="max-w-60 text-xs">{chip.helper}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				))}
			</div>
		</section>
	);
}
