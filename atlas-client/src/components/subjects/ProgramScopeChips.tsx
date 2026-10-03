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
 * WHAT IS THE CHIP, AND WHY THE SHORT WORD. The visible label comes from the shared glossary's
 * `programChipLabel`: `REGULAR → Regular`, `STE → Science`, `SPA → Arts`, and `SPS → Sports`.
 * The words are plain and compact enough for the existing one-line chip row; a scope code the
 * map does not carry still falls back to `programShortLabel` rather than being hidden or numbered.
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
import { PROGRAM_SCOPE_BADGE } from '@/lib/subject-constants';
import { programChipLabel, programFullLabel } from '@/lib/deped-glossary';
import { cn } from '@/lib/utils';

/** The same neutral token `SubjectRow` uses for a grade outside 7-10. */
const NEUTRAL_CHIP = 'bg-muted text-muted-foreground';

/** The shared compact plain-language label, then the glossary fallback. */
export function programScopeChipLabel(code: string): string {
	return programChipLabel(code);
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
						<TooltipContent side="top" className="max-w-64">
							{programFullLabel(code)}
						</TooltipContent>
					</Tooltip>
				))}
			</span>
		</TooltipProvider>
	);
}
