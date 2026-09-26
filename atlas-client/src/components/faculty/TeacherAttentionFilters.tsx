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
									variant={activeChipId === chip.id ? 'secondary' : 'outline'}
									size="sm"
									aria-pressed={activeChipId === chip.id}
									// Fix 24: `whitespace-nowrap` + `shrink-0` keep the chip label on
									// one line; `overflow-x-auto` on the row is the honest escape when
									// the translated labels are genuinely wider than the column.
									className="h-8 shrink-0 whitespace-nowrap rounded-full px-2.5 text-xs font-bold"
									onClick={() => onApplyFilter(chip.id)}
								>
									{chip.label}
									<span className="ml-1 tabular-nums text-muted-foreground">{chip.count}</span>
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
