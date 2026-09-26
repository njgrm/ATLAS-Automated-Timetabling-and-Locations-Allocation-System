/**
 * TeachingLoadInspectorTriggers — the two floating entry points to the load
 * profile, split out of `pages/TeachingLoad.tsx` so that page does not grow.
 *
 * Fix 26 removed the permanent `lg:block` inspector column; the desktop
 * equivalent is `Review teachers`, which opens `ReviewTeachersModal`. The mobile
 * `View profile` affordance and its `Sheet` are PRESERVED unchanged — that is a
 * legitimate small-screen control, not a leftover of the removed column.
 */
import { UserRound } from 'lucide-react';
import { Button } from '@/ui/button';

type TeachingLoadInspectorTriggersProps = {
	visible: boolean;
	onOpenMobile: () => void;
	onOpenReview: () => void;
};

export function TeachingLoadInspectorTriggers({
	visible,
	onOpenMobile,
	onOpenReview,
}: TeachingLoadInspectorTriggersProps) {
	if (!visible) return null;

	return (
		<>
			{/* Mobile: `lg:hidden`. Preserved. */}
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

			{/* Desktop: `lg:inline-flex`, replaces the removed column. */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="fixed bottom-16 right-4 z-40 hidden h-10 gap-2 font-bold shadow-lg lg:inline-flex"
				data-testid="teaching-load-review-open"
				onClick={onOpenReview}
			>
				<UserRound className="size-4" />
				Review teachers
			</Button>
		</>
	);
}
