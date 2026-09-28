/**
 * A5 C3 (2026-09-29) — program scope, as chips a scheduler can read at a glance.
 *
 * THE DEFECT THIS REPLACES. `SubjectRow` derived one string from `subject.programScopes`:
 * `programFullLabel(code)` for a single scope and `"{n} programs"` for more. So a row read
 * either `Science, Technology, and Engineering` — five words, the widest cell content on the
 * screen, for a fact the DepEd term names in three letters — or `3 programs`, which tells a
 * scheduler nothing about *which* programs. R1 A3, from the operator's own screenshot:
 * "spelled-out program names".
 *
 * WHAT IS THE CHIP, AND WHY THAT ABBREVIATION. The visible label is the operator's own
 * abbreviation from `PROGRAM_SCOPE_OPTIONS` (`subject-constants.ts`) — `REGULAR → BEC`, `STE`,
 * `SPA`, `SPS`, `OTHER → Other`. That list is the repository's existing display mapping (A3-31);
 * this component reads it rather than restating it, so a change to the operator's vocabulary
 * lands in one place. A scope code the list does not carry (`SPJ`, `SPFL`, `SPTVE` all exist in
 * `PROGRAM_LABELS`) falls back to `programShortLabel`, so an unmapped program is named rather
 * than hidden or numbered.
 *
 * COLOUR IS THE REPOSITORY'S, NOT A NEW PALETTE. `PROGRAM_SCOPE_BADGE` is the existing program
 * colour map; a code it does not carry gets the same neutral token the grade chips use for a
 * grade outside 7-10. Inventing a colour here would be the second-palette defect the subject
 * row was rebuilt to delete.
 *
 * THE FULL NAME IS NOT LOST, IT IS ONE HOVER AWAY. `programFullLabel` is the chip's `@/ui`
 * `Tooltip` — never a raw `title=` (`AGENTS.md` §8). J4/R2-5: `Tooltip`, not `HoverCard`,
 * because `@radix-ui/react-hover-card` is not a dependency and adding one is a lockfile change
 * outside this slice's authority.
 *
 * GEOMETRY IS THE GRADE CHIPS' GEOMETRY. Col 2 of the row already carries `GRADE_COLORS` chips;
 * reusing one chip shape for both facts makes the column one visual language instead of chips
 * above a line of prose. The grade chips themselves are untouched.
 */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { PROGRAM_SCOPE_BADGE, PROGRAM_SCOPE_OPTIONS } from '@/lib/subject-constants';
import { programFullLabel, programShortLabel } from '@/lib/deped-glossary';
import { cn } from '@/lib/utils';

/** The same neutral token `SubjectRow` uses for a grade outside 7-10. */
const NEUTRAL_CHIP = 'bg-muted text-muted-foreground';

/** The operator's own abbreviation, then the glossary's short label, then the code itself. */
export function programScopeChipLabel(code: string): string {
	const fromOptions = PROGRAM_SCOPE_OPTIONS.find((o) => o.value === code);
	if (fromOptions) return fromOptions.label;
	return programShortLabel(code);
}

export function ProgramScopeChips({ scopes }: { scopes: string[] }) {
	if (scopes.length === 0) return null;
	return (
		<TooltipProvider delayDuration={200}>
			<span className="flex flex-wrap items-center gap-1" data-testid="subject-program-chips">
				{scopes.map((code) => (
					<Tooltip key={code}>
						<TooltipTrigger asChild>
							{/* `tabIndex` keeps the full name reachable by keyboard, which a
							    hover-only chip would not be (WCAG 2.1.1). */}
							<span
								tabIndex={0}
								aria-label={`${programScopeChipLabel(code)} — ${programFullLabel(code)}`}
								className={cn(
									'inline-flex h-4 min-w-4 items-center justify-center rounded border px-1 text-[0.6rem] font-bold leading-none',
									PROGRAM_SCOPE_BADGE[code] ?? NEUTRAL_CHIP,
								)}
							>
								{programScopeChipLabel(code)}
							</span>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-64 text-xs">
							{programFullLabel(code)}
						</TooltipContent>
					</Tooltip>
				))}
			</span>
		</TooltipProvider>
	);
}
