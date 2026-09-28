import { CalendarRange, ChevronDown } from 'lucide-react';

import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import type { TermAuthority } from '@/types';

/**
 * A3-C9: where the EnrollPro year-and-terms contract stays REACHABLE now that
 * the routine `VERIFIED_LIVE` strip is gone from the Subjects header.
 *
 * A3-09 put that strip in the header as a routine one-line status, and A3-C9
 * removes it: a scheduler opens /subjects to work the catalog, and a permanent
 * "the upstream answered" line is noise that pushes the filters down. But the
 * term contract itself is not decoration. It is the frame the whole catalog is
 * read in — which school year, which ordered terms, which of them is active —
 * and a filter that says "Term 1" means nothing unless the operator can see
 * that Term 1 is Term 1 of S.Y. 2030-2031 and is the active one.
 *
 * So the evidence MOVES rather than disappears: this is a quiet affordance
 * pinned to the table's own footer, under the rows it describes. It is not a
 * banner, it carries no emerald "verified" slab, and it makes no freshness
 * claim at all. It answers one question — "which year and terms is this table
 * showing?" — in the place where the answer is relevant.
 *
 * This file must not contain the literal walkthrough sentence owned by
 * `subject-source-utils.ts`; `components/__tests__/a3-c4-subjects-copy.test.ts`
 * positively asserts which files carry it, and adding a fourth would fail that
 * control for a reason unrelated to the defect it guards.
 */

/** The ordered-term badges, shared with the exception block so there is one renderer. */
export function SubjectTermContractBadges({ contract }: { contract: NonNullable<TermAuthority['contract']> }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{contract.terms.map((term) => (
				<Badge key={term.identity} variant="outline" className="bg-background/70">
					{term.displayLabel}{term.identity === contract.activeTerm?.identity ? ' · Active' : ''}
				</Badge>
			))}
		</div>
	);
}

type Props = {
	termAuthority: TermAuthority | null;
};

/**
 * The quiet, non-header route to the term contract. Renders nothing when there
 * is no contract to show (a blocked authority with no saved contract is already
 * announced by the loud block, so this must not duplicate it).
 */
export function SubjectTermContractPopover({ termAuthority }: Props) {
	const contract = termAuthority?.contract ?? null;
	if (!contract) return null;

	const termCount = contract.terms.length;
	// Resolved from the ordered term list rather than read off `activeTerm`
	// directly, so a contract that carries the active term's IDENTITY but not its
	// display label still names the active term in the trigger's accessible
	// description. Falling back to "no active term" there would understate what
	// the operator is looking at.
	const activeLabel = contract.activeTerm
		? contract.terms.find((term) => term.identity === contract.activeTerm?.identity)?.displayLabel
			?? contract.activeTerm.displayLabel
		: null;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					data-testid="subject-term-contract-trigger"
					aria-label={`School year and ordered terms for this table: S.Y. ${contract.schoolYear.yearLabel}, ${termCount} term${termCount === 1 ? '' : 's'}${activeLabel ? `, ${activeLabel} active` : ''}. Open the term list.`}
					className="h-7 shrink-0 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
				>
					<CalendarRange className="size-3.5 shrink-0" />
					<span className="font-mono">S.Y. {contract.schoolYear.yearLabel}</span>
					<span aria-hidden="true">·</span>
					<span>{termCount} term{termCount === 1 ? '' : 's'}</span>
					<ChevronDown className="size-3 shrink-0" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 space-y-2 p-3" data-testid="subject-term-contract">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					S.Y. {contract.schoolYear.yearLabel} · ordered terms from EnrollPro
				</p>
				<SubjectTermContractBadges contract={contract} />
				<p className="text-xs leading-relaxed text-muted-foreground">
					{termAuthority?.message?.trim() || 'ATLAS is showing the school year and its ordered terms, last read from EnrollPro.'}
				</p>
				<p className="text-xs font-medium text-muted-foreground">
					Participation, grade and program scope, weekly minutes, rotation, and room needs are ATLAS-owned and edited above.
				</p>
			</PopoverContent>
		</Popover>
	);
}
