import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

/**
 * The one tooltip primitive for the whole app. A5 items 34 + 35 own the
 * geometry; A7 c10 (operator, 2026-09-29) owns the palette.
 *
 * ---------------------------------------------------------------------------
 * ITEM 34 — WHY THERE IS A PORTAL. DO NOT "SIMPLIFY" IT AWAY.
 * ---------------------------------------------------------------------------
 * ROOT CAUSE (measured, not guessed): every sortable column header in the app
 * sits inside `AdminTableShell`, whose body is `div.flex-1.min-h-0.overflow-auto`
 * inside a `Card ... overflow-hidden` (`components/admin-workspace/AdminWorkspace.tsx`).
 * A bubble that renders INSIDE that scroll box has its top edge cut in half —
 * the operator saw "a hover tooltip whose top boundary is cut off" on
 * `/subjects`, `/sections` and `/teachers`.
 *
 * THE FIX IS THE `TooltipPrimitive.Portal` BELOW: the bubble mounts directly on
 * `document.body`, so no ancestor's `overflow` can clip it. Fixing it per-table
 * instead would duplicate this in every header component and fix none of the ones
 * nobody remembered.
 *
 * ---------------------------------------------------------------------------
 * ITEM 35 / 35.1 — THE WIDTH + WRAP CONTRACT.
 * ---------------------------------------------------------------------------
 * The class list used to force `whitespace-nowrap`. That is correct for a short
 * label ("Sort by Section") and wrong for every sentence-length helper in the
 * app: a nowrap bubble has no width cap of its own, so it grows until it leaves
 * the viewport and the tail of the sentence is simply never painted. On
 * `/teachers` that clipped the five quick-filter helpers (`No subjects
 * assigned`, `Above weekly max`, `No sections assigned`, `Temporary teachers`,
 * `All teachers` — `pages/Faculty.tsx`).
 *
 *   - `w-max`   the bubble still hugs its content rather than stretching.
 *   - `max-w-[22rem]`  the hard cap (the operator's "about 22rem") that forces a
 *     long sentence onto a second line instead of running off-screen. It
 *     REPLACED `max-w-xs md:max-w-sm`, whose desktop value was 24rem — wider
 *     than the operator asked for.
 *   - `whitespace-normal break-words leading-normal`  the sentence WRAPS at the
 *     cap, and one unbroken token cannot force a horizontal scrollbar.
 *   - `sideOffset` 4 -> 8, so a two-line bubble does not sit on top of the
 *     control it describes.
 *
 * A caller that genuinely needs a single line asks for it with its own
 * `whitespace-nowrap` in `className`; `cn` (twMerge) lets the call site win for
 * width, padding and side. The default is wrapping because the shared tooltip's
 * job is to EXPLAIN, and an explanation that is cut off explains nothing.
 *
 * ---------------------------------------------------------------------------
 * A7 C10 — THE PALETTE IS WHITE, AND WHY IT WAS EVER DARK.
 * ---------------------------------------------------------------------------
 * Operator, 2026-09-29, on the live timetable: "Why on earth are the tooltips
 * black? Why is it not just white with a shadowed background?" White is correct
 * and this primitive is now white: `bg-popover` + `text-popover-foreground` +
 * `border-border` + the soft `shadow-md`, all existing app tokens
 * (`--popover: 0 0% 100%`, `--popover-foreground: 222 47% 11%`,
 * `--border: 220 13% 91%`). No new colour system.
 *
 * THE TRUE HISTORY, because the old comment on this file got it backwards. The
 * dark palette was NOT the application standard. It was a 2026-09-28 WORKAROUND
 * for an earlier report of a "blank / empty white pill" on a white card: the
 * list then in force was `bg-popover text-popover-foreground` + `border`, and on
 * a white surface a white bubble with dark text read to the reporter as a
 * featureless pill. Darkening the surface was a way to make the bubble's EDGE
 * undeniable.
 *
 * The edge is the actual defect, and the edge is what the current class list
 * fixes directly: `border-border` draws a hairline on EVERY surface and
 * `shadow-md` lifts the bubble off it. So white is safe here in a way the old
 * comment claimed it was not. Anyone tempted to re-darken this bubble to solve a
 * visibility report should first check that the border and shadow survived.
 *
 * SIZE. `text-sm`, not `text-xs`. In this design system `--text-xs` is
 * `0.875rem` (14px) and `--text-sm` is `0.9375rem` (15px) — see `index.css`
 * `@theme`. The operator's floor is "nothing under 14px", and 15px clears it
 * with room for an older reader. The size lives HERE and only here: call sites
 * that passed their own `text-xs` were removed in the A7 c10 sweep, because
 * `cn` would let them win and the app would end up with 14px bubbles on some
 * pages and 15px on others. A control that looks the same on every page.
 *
 * The bubble also has a floor on its own content: it explains, so it must not
 * render an empty white pill. `TooltipContent` renders whatever its children
 * are; a call site that passes no text is a call-site bug, and
 * `__tests__/a7-c10-white-tooltip.test.tsx` is the row that catches it.
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
				'z-50 rounded-md border border-border bg-popover px-2.5 py-1 text-sm font-medium text-popover-foreground shadow-md pointer-events-none animate-in w-max max-w-[22rem] whitespace-normal break-words leading-normal',
				className,
			)}
			{...props}
		/>
	</TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
