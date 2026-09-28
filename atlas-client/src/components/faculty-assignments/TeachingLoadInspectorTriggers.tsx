/**
 * TeachingLoadInspectorTriggers — the floating small-screen entry point to the
 * load profile, split out of `pages/TeachingLoad.tsx` so that page does not
 * grow.
 *
 * Fix 26 removed the permanent `lg:block` inspector column; its desktop
 * equivalent was a `Review teachers` button, and the mobile `View profile`
 * affordance and its `Sheet` were PRESERVED unchanged — a legitimate
 * small-screen control, not a leftover of the removed column.
 *
 * FIX 16.1 (operator, 2026-09-28) — the DESKTOP button is DELETED, not
 * restyled. The requested Teaching Load surface carries a `Review load` button
 * on EVERY teacher row, in the row's own gap, so opening a workload is one
 * click from the teacher the scheduler is already looking at. The floating
 * bottom-right `Review teachers` button had no teacher attached to it — it
 * opened whichever teacher happened to be selected — which is precisely the
 * indirection the operator asked to remove.
 *
 * Deleting it also removes the SELECTION-DEPENDENT DETACHMENT: the button was
 * the only reason a selection had to be made before a review could be opened,
 * and `pages/TeachingLoad.tsx` now selects the row's teacher as part of the row
 * button's own handler instead of requiring the scheduler to find them first.
 *
 * The mobile `View profile` button stays, because on a phone there is no room in
 * a roster row for a third control and the row's expand affordance is the only
 * way to reach the profile at all.
 *
 * A6 c4 (G1) — `visible` is now OPTIONAL and is no longer the page's
 * `advancedGridVisible`. Guided mode is removed and the grid is always rendered,
 * so "is the grid up?" is a constant and the page must not re-introduce a state
 * to answer it. The prop is kept (and kept optional) so the four committed
 * controls that mount this component with an explicit `visible` still compile
 * and still exercise the hidden branch, but the production page no longer sends
 * it: the only value that would reach this component is "the grid is shown".
 * `visible === false` is honoured rather than defaulted away, so a future caller
 * that has a genuine reason to hide the mobile entry point is not silently
 * overridden.
 */
import { UserRound } from 'lucide-react';
import { Button } from '@/ui/button';

type TeachingLoadInspectorTriggersProps = {
	visible?: boolean;
	onOpenMobile: () => void;
};

export function TeachingLoadInspectorTriggers({
	visible,
	onOpenMobile,
}: TeachingLoadInspectorTriggersProps) {
	if (visible === false) return null;

	return (
		/* Mobile: `lg:hidden`. Preserved. */
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="fixed bottom-16 right-4 z-40 h-10 gap-2 font-bold shadow-lg lg:hidden"
			data-testid="teaching-load-mobile-inspector-open"
			onClick={onOpenMobile}
		>
			<UserRound className="size-4" />
			View profile
		</Button>
	);
}
