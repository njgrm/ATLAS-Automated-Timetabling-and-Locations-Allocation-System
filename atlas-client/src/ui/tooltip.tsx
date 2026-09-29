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
 * THE FIX IS THE `TooltipPrimitive.Portal` BELOW: the bubble mounts directly on
 * `document.body`, so no ancestor's `overflow` can clip it. DO NOT "simplify" the
 * portal away — without it, item 34 comes straight back on all three tables.
 * Fixing it per-table instead would duplicate this in every header component and
 * fix none of the ones nobody remembered.
 *
 * The portal fixes WHERE the bubble mounts. The other half of item 35 — a long
 * sentence that mounts in the right place and is still too wide to read — is the
 * width/wrap contract further down this file. Both halves are on the primitive;
 * neither belongs at a call site.
 *
 * The dark palette is the same fix's second half: the previous
 * `bg-popover text-popover-foreground` + `border` rendered an empty white pill on
 * a white card, which is the operator's "blank / invisible content" report. The
 * class list below is the application standard dark tooltip style.
 *
 * A5 ITEM 35.1 (operator, 2026-09-29) — SHARED CONTENT WRAPS.
 *
 * The class list used to force `whitespace-nowrap`. That is correct for a short
 * label ("Sort by Section") and wrong for every sentence-length helper in the
 * app: a nowrap bubble has no width cap of its own, so it grows until it leaves
 * the viewport and the tail of the sentence is simply never painted. On
 * `/teachers` that clipped the five quick-filter helpers (`No subjects
 * assigned`, `Above weekly max`, `No sections assigned`, `Temporary teachers`,
 * `All teachers` — `pages/Faculty.tsx`), which is a whole sentence the operator
 * cannot read.
 *
 * The wrap contract is now on the PRIMITIVE, not per call site:
 *   - `w-max`   the bubble still hugs its content rather than stretching.
 *   - `max-w-xs` / `md:max-w-sm`  the hard cap that forces a long sentence onto
 *     a second line instead of running off-screen.
 *   - `whitespace-normal break-words leading-normal`  the sentence WRAPS at the
 *     cap, and a single unbroken token cannot force a horizontal scrollbar.
 *   - `sideOffset` 4 -> 8, the packet's collision padding, so a two-line bubble
 *     does not sit on top of the control it describes.
 *
 * A caller that genuinely needs a single line (a table cell, a status chip) asks
 * for it with its own `whitespace-nowrap` in `className`; `cn` lets the call site
 * win. The default is wrapping because the shared tooltip's job is to EXPLAIN,
 * and an explanation that is cut off explains nothing.
 */
const TooltipContent = React.forwardRef<
	React.ComponentRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
	<TooltipPrimitive.Portal>
		<TooltipPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				'z-50 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md pointer-events-none animate-in w-max max-w-xs md:max-w-sm whitespace-normal break-words leading-normal',
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
