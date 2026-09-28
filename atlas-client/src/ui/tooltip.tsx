import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * A5 items 34 + 35 — clipped / illegible column-header tooltips.
 *
 * ROOT CAUSE (measured, not guessed): every sortable column header in the app
 * sits inside `AdminTableShell`, whose body is `div.flex-1.min-h-0.overflow-auto`
 * inside a `Card ... overflow-hidden` (`components/admin-workspace/AdminWorkspace.tsx`).
 * The bubble used to render INSIDE that scroll box, so the container's top edge
 * cut it in half — the operator saw "a hover tooltip whose top boundary is cut
 * off" on `/subjects`, `/sections` and `/teachers`.
 *
 * THE FIX IS THE `TooltipPrimitive.Portal` BELOW, and it is the whole fix for
 * all three tables: the bubble mounts directly on `document.body`, so no
 * ancestor's `overflow` can clip it. DO NOT "simplify" the portal away — without
 * it, items 34 and 35 come straight back. Fixing it per-table instead would
 * duplicate this in every header component and fix none of the ones nobody
 * remembered.
 *
 * The dark palette is the same fix's second half: the previous
 * `bg-popover text-popover-foreground` + `border` rendered an empty white pill on
 * a white card, which is the operator's "blank / invisible content" report. The
 * class list below is the application standard dark tooltip style.
 */
const TooltipContent = React.forwardRef<
	React.ComponentRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-50 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md whitespace-nowrap pointer-events-none animate-in',
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
