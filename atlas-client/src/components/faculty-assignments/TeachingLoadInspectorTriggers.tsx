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
 * The mobile `View profile` button and its `visible` prop stay, because on a
 * phone there is no room in a roster row for a third control and the row's
 * expand affordance is the only way to reach the profile at all.
 */
import { UserRound } from 'lucide-react';
import { Button } from '@/ui/button';

type TeachingLoadInspectorTriggersProps = {
	visible: boolean;
	onOpenMobile: () => void;
};

export function TeachingLoadInspectorTriggers({
	visible,
	onOpenMobile,
}: TeachingLoadInspectorTriggersProps) {
	if (!visible) return null;

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
