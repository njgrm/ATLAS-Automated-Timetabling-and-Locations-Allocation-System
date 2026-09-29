/**
 * A2 HEADER-BUDGET (operator, 2026-09-29) — the one gated-control wrapper, in a
 * NEUTRAL module.
 *
 * ── WHY IT MOVED ─────────────────────────────────────────────────────────────
 * §8's new "Header budget" rule says a disabled action states its reason in a
 * `@/ui` Tooltip and NOT as a sentence printed under the button, and §8's "One
 * look per control" rule says the same control looks the same everywhere. Both
 * need the same wrapper. It lived in `simple/SimpleHeaderHelpers.tsx`, and the
 * surface that now needs it — `DraftActionButton` in
 * `TimetableDraftStateStrip.tsx` — must not import from `SimpleHeaderHelpers`:
 * that module is deep in the header's import graph and pulling it in from the
 * strip risks an import CYCLE, which is the failure mode a "just reuse it"
 * shortcut produces here.
 *
 * So the wrapper moves to its own module with no dependency but `@/ui/tooltip` and
 * `react`, and `SimpleHeaderHelpers.tsx` RE-EXPORTS it unchanged. Every existing
 * importer keeps its exact import path and its exact behaviour; the bytes on
 * screen are the same `TooltipProvider > Tooltip > focusable span > children`
 * they were before the move. This is a move, not a second implementation.
 *
 * ── WHY A FOCUSABLE WRAPPER SPAN ──────────────────────────────────────────────
 * A disabled `<button>` receives no pointer events and cannot be focused, so a
 * Radix tooltip placed on it never fires and the reason is unreachable. The span
 * carries `tabIndex={0}` and the tooltip trigger, which is what makes the reason
 * available to pointer, keyboard and screen-reader users. The control's own
 * `aria-label` ALSO carries the reason, so nothing depends on a hover being
 * available at all (AGENTS.md §8: no raw `title`, never hover-only).
 */
import type { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

export function GatedAction({ disabled, reason, children }: { disabled: boolean; reason: string | null; children: ReactNode }) {
	if (!disabled || !reason) return <>{children}</>;
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="inline-flex" tabIndex={0}>
						{children}
					</span>
				</TooltipTrigger>
				<TooltipContent side="bottom" className="max-w-xs leading-relaxed">
					{reason}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
