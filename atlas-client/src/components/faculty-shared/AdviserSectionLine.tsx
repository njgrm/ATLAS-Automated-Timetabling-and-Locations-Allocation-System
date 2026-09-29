import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * A6 a6-tl-advisory — THE ONE ADVISER LINE, for every surface that shows a
 * class-adviser star.
 *
 * The defect this exists to close: the Teaching Load teacher card drew the
 * amber star with NO section identity, so an older, mouse-first scheduler could
 * not tell WHICH section a teacher advises from the card. The Teachers roster
 * already solved this — its identity cell prints the star followed by
 * `Adviser: <section>` (or exactly `Adviser` when no section label exists). The
 * two surfaces now render THIS component, so one look and one wording reach
 * both, and they cannot drift apart.
 *
 * The star carries no `aria-hidden`: the hard-muted words beside it are the
 * meaning, and a bare-svg attribute was never part of the authoritative markup
 * this was extracted from (`FacultyRow`'s identity cell). Extracting a shared
 * component that silently changed the existing surface would be the same defect
 * in the other direction.
 *
 * The visible text is the ONLY thing this adds to a region. `className` lets a
 * caller place the line (its own row on the roster; inline with the name on the
 * Teaching Load card) without forking the look.
 */
export function AdviserSectionLine({
	isClassAdviser,
	advisedSectionName,
	className,
}: {
	isClassAdviser: boolean;
	advisedSectionName: string | null;
	className?: string;
}) {
	if (!isClassAdviser) return null;
	return (
		<span
			data-testid="adviser-section-line"
			className={cn('flex items-center gap-1 truncate text-xs text-muted-foreground', className)}
		>
			<Star className="size-2.5 shrink-0 fill-amber-400 text-amber-500" />
			<span className="truncate">{advisedSectionName ? `Adviser: ${advisedSectionName}` : 'Adviser'}</span>
		</span>
	);
}
