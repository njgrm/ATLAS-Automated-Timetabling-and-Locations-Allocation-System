import { Badge } from '@/ui/badge';

/**
 * A7 c12b R1-C1 — the app-shell `Active year:` badge, extracted from `AppShell.tsx`
 * so the SAME rendered surface can be pinned in a test, and so its label can only
 * come from the one shared active-year authority (`resolveActiveYearLabel` over
 * `resolveActiveSchoolYearContext`'s `activeSchoolYearLabel`).
 *
 * This is a MOVE, not a rewrite: the words, the placement (the shell header's
 * right-hand cluster) and the `Badge variant='outline'` role are byte-identical to
 * the inline element it replaces. The reason it is its own component is that a
 * two-line inline JSX element is not renderable in isolation, and the copy test must
 * compare the badge the scheduler sees with the timetable chip from ONE context.
 */
export function ActiveYearBadge({ label }: { label: string }) {
	return (
		<Badge variant='outline' className='min-h-7 px-2 text-xs'>
			Active year: {label}
		</Badge>
	);
}
