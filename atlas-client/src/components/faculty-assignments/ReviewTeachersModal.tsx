/**
 * ReviewTeachersModal — the desktop replacement for the permanent right-hand
 * inspector column (Fix 26).
 *
 * Root cause of the density complaint: `pages/TeachingLoad.tsx` rendered a
 * `hidden w-80 shrink-0 border-l ... lg:block` column that was present on EVERY
 * large viewport, permanently narrowing the assignment workspace by 320px even
 * when the operator never opened it. This modal keeps the identical content
 * (`WorkloadInspector` / `SectionInspector`, passed in as a node by the page)
 * and makes it on-demand.
 *
 * The mobile path is deliberately NOT touched: the floating `View profile`
 * button and its `Sheet` remain the small-screen affordance.
 */
import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/ui/dialog';

type ReviewTeachersModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** `WorkloadInspector` or `SectionInspector`, supplied by the page. */
	children: ReactNode;
	title: string;
	description: string;
};

export function ReviewTeachersModal({
	open,
	onOpenChange,
	children,
	title,
	description,
}: ReviewTeachersModalProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto p-0"
				data-testid="teaching-load-review-modal"
			>
				<DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40">
					<DialogTitle className="text-base font-bold uppercase tracking-tight" data-testid="teaching-load-review-modal-title">
						{title}
					</DialogTitle>
					<DialogDescription className="text-xs">{description}</DialogDescription>
				</DialogHeader>
				{/* `WorkloadInspector` carries its own `border-l`; suppress it inside
					the modal where there is no adjacent pane to divide. */}
				<div className="[&>div]:border-l-0">{children}</div>
			</DialogContent>
		</Dialog>
	);
}
