import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

import { Button } from '@/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * `AccessibleInfo` -- hybrid help affordance (Decision 6 in
 * `docs/phases/setup-content-area-improvement-plan-2026-08-08.md`).
 *
 * - Shows a `<Tooltip>` on hover AND on keyboard focus.
 * - When `longHelp` is provided, opens a `<Popover>` on Enter/Space/click for
 *   longer help text (tap-friendly for mobile users who have no hover).
 * - When `longHelp` is omitted, click/Enter still shows the tooltip via
 *   `aria-describedby`.
 *
 * The trigger is keyboard-focusable in both render modes:
 *
 * - Standalone (default): renders an `Info` Button as the trigger so the help
 *   affordance is always reachable.
 * - Wrap (when `children` is provided): wraps the caller's element as the
 *   trigger via `asChild`. The caller MUST ensure the child is itself
 *   keyboard-focusable (e.g. a real `<button>`). A `<span>` Badge is not
 *   focusable and will violate WCAG 1.4.13 if used as a wrap child.
 */
export type AccessibleInfoProps = {
	/** Accessible name for the trigger. Should be plain language. */
	label: string;
	/** Short help text shown in the tooltip (hover/focus) and as fallback in the popover. */
	shortHelp: ReactNode;
	/** Optional longer help text shown in the popover. When omitted, click toggles the tooltip description only. */
	longHelp?: ReactNode;
	/**
	 * When provided, AccessibleInfo wraps this element as the focusable
	 * trigger via asChild instead of rendering its own Info button. The
	 * child must itself be a focusable interactive element (e.g. a real
	 * `<button type="button">` or a focusable Badge with `tabIndex={0}`).
	 */
	children?: ReactNode;
	/** Optional icon override for the standalone trigger. Defaults to an `Info` glyph. */
	icon?: ReactNode;
	/** Visual size of the standalone trigger button. Ignored when `children` is provided. */
	size?: 'icon-sm' | 'icon-xs';
	/** Optional className passthrough for layout alignment. */
	className?: string;
	/** Tooltip placement. */
	side?: 'top' | 'bottom' | 'left' | 'right';
	/** Optional test id. */
	testId?: string;
};

export function AccessibleInfo({
	label,
	shortHelp,
	longHelp,
	children,
	icon,
	size = 'icon-sm',
	className,
	side = 'top',
	testId,
}: AccessibleInfoProps) {
	const [popoverOpen, setPopoverOpen] = useState(false);
	const triggerIcon = icon ?? <Info className="size-4" />;
	const isWrap = children !== undefined;

	const trigger = isWrap ? (
		children
	) : (
		<Button
			type="button"
			variant="ghost"
			size={size}
			aria-label={label}
			aria-describedby={longHelp ? undefined : `accessible-info-${slug(label)}`}
			data-testid={testId}
			className={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}
			onClick={() => longHelp && setPopoverOpen((open) => !open)}
		>
			{triggerIcon}
		</Button>
	);

	// When longHelp is provided, the Popover wraps the trigger; the Tooltip
	// sits inside so hover/focus still previews the short help.
	if (longHelp) {
		return (
			<TooltipProvider delayDuration={200}>
				<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
					<Tooltip>
						<TooltipTrigger asChild>
							<PopoverTrigger asChild>{trigger}</PopoverTrigger>
						</TooltipTrigger>
						<TooltipContent side={side} className="max-w-64 text-xs leading-relaxed">
							{shortHelp}
						</TooltipContent>
					</Tooltip>
					<PopoverContent side={side} align="center" className="w-80 max-w-[90vw] rounded-xl p-3 text-sm leading-relaxed">
						<p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
						{longHelp}
						<p className="mt-2 border-t border-slate-100 pt-2 text-xs text-muted-foreground">{shortHelp}</p>
					</PopoverContent>
				</Popover>
			</TooltipProvider>
		);
	}

	// Tooltip-only path: short help is the whole explanation. The
	// caller-provided trigger (or our standalone button) must be keyboard
	// focusable; we add a Tooltip + an sr-only mirror so screen readers
	// always have the description even when the portaled tooltip is not
	// reliably reachable by aria-describedby.
	const descriptionId = `accessible-info-${slug(label)}`;
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>{trigger}</TooltipTrigger>
				<TooltipContent side={side} className="max-w-64 text-xs leading-relaxed">
					{shortHelp}
				</TooltipContent>
			</Tooltip>
			<span className="sr-only" id={descriptionId}>
				{shortHelp}
			</span>
		</TooltipProvider>
	);
}

/** Compute a stable DOM-safe slug from a label so each trigger gets a unique description id. */
function slug(label: string): string {
	return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'help';
}