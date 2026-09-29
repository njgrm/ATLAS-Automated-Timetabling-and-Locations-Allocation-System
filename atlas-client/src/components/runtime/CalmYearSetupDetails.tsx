/**
 * A3-C14 — the ONE quiet fold on School Year Setup.
 *
 * The operator's own words: the page was "too technical and overwhelming", and
 * the default view must be "one sentence and one button, with IT details folded
 * away". This file is that fold. It is deliberately tiny and deliberately
 * presentation-only: no request, no gate, no status of its own.
 *
 * Four decisions worth stating, because all four are load-bearing.
 *
 * 1. CLOSED BY DEFAULT, and the panel carries the HTML `hidden` attribute
 *    rather than a Tailwind class. `hidden` is what a browser already does with
 *    `display:none`: the content is out of the page, out of the accessibility
 *    tree, and unreachable by Tab. The panel is still RENDERED, so every
 *    existing assertion that reaches a surface inside the fold (the year list,
 *    the carry-forward review, the reset disclosure, the card's own detail
 *    blocks) still finds its node in the same place in the tree. Hiding must
 *    never be implemented by unmounting someone else's surface: a fold that
 *    deletes a control is a behaviour change wearing a costume.
 *
 * 2. THE FOLD IS A PROVIDER AND A PORTAL TARGET, not a wrapper. The plain
 *    status card owns detail of its own (the drift badges, the counts line, the
 *    conflict lists, the read-only preview), and that detail has to land in the
 *    SAME fold as the page's panels — the packet allows one fold, not two. The
 *    page therefore mounts one provider and renders the fold, and the card
 *    portals its detail into the fold's panel.
 *
 * 3. NO PROVIDER MEANS INLINE, WHICH IS WHY THIS FILE CANNOT LEAK. The plain
 *    card is rendered by other lanes too (and by their tests). When no provider
 *    is mounted the hook reports "no fold" and the card renders that same
 *    content inline exactly as it did before, so every other mount of the card
 *    is unaffected. When a provider IS mounted but its panel has not attached
 *    yet, the card renders NOTHING for one commit — it must not fall back to
 *    inline, because that would flash the whole technical surface above the
 *    calm card for a frame.
 *
 * 4. `@/ui` PRIMITIVES ONLY (AGENTS.md §8): no raw `<details>`, no `title=`, no
 *    unstyled `<button>`. The trigger is a ghost `Button` carrying
 *    `aria-expanded` and `aria-controls`, which is the accessible name for a
 *    disclosure.
 */
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/ui/button';

/** The trigger's own words. "Details for IT" is the operator's phrase. */
export const CALM_DETAILS_LABEL = 'Details for IT';
/**
 * A3-C14 SUBTRACTION: the trigger used to carry a hint beside it ("Terms, status
 * codes and recovery tools."). It is gone. The packet asks for ONE quiet fold,
 * and a hint is a second line of prose on a screen whose whole complaint was
 * that it was overwhelming; the label already says what is behind it. The label
 * is kept as an exported constant so a test can assert the exact words.
 */

type CalmYearSetupDetailsValue = {
	/** False until the operator has asked for the detail. */
	open: boolean;
	panel: HTMLElement | null;
	toggle: () => void;
	/** Ref callback for the panel; a `useState` setter, so it is stable. */
	setPanel: (element: HTMLElement | null) => void;
};

const CalmYearSetupDetailsContext = createContext<CalmYearSetupDetailsValue | null>(null);

/**
 * `null` when no fold is mounted — the caller renders its detail inline, which
 * is the pre-c14 behaviour. Otherwise the panel to render into, or `null` for
 * the one commit before it attaches, when the caller must render nothing.
 */
export function useCalmYearSetupDetails(): { panel: HTMLElement | null } | null {
	return useContext(CalmYearSetupDetailsContext);
}

export function CalmYearSetupDetailsProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState(false);
	const [panel, setPanel] = useState<HTMLElement | null>(null);
	const value = useMemo<CalmYearSetupDetailsValue>(
		() => ({ open, panel, toggle: () => setOpen((current) => !current), setPanel }),
		[open, panel],
	);
	return <CalmYearSetupDetailsContext.Provider value={value}>{children}</CalmYearSetupDetailsContext.Provider>;
}

/**
 * The fold: one quiet ghost trigger, `aria-expanded`, `aria-controls`, and a
 * `hidden` panel that becomes visible only when asked for.
 */
export function CalmYearSetupDetails({ children }: { children: ReactNode }) {
	const value = useContext(CalmYearSetupDetailsContext);
	// Unconditional, and BEFORE the early return: the panel's own id is generated
	// once so `aria-controls` can name it on the very first render, before the
	// ref has attached. A hook below the early return would be a conditional
	// hook call, and the two paths render different trees.
	const panelId = useId();
	if (!value) {
		// A trigger with no provider behind it cannot open, so it would be a
		// control that does nothing. Show the content plainly instead.
		return <div data-testid="year-setup-it-details-unmounted">{children}</div>;
	}
	const { open, panel, toggle, setPanel } = value;

	return (
		<div className="rounded-xl border border-slate-200 bg-slate-50/60" data-testid="year-setup-it-details">
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="min-h-11 w-full justify-start gap-2 px-3 text-slate-600"
				aria-expanded={open}
				aria-controls={panelId}
				onClick={toggle}
				data-testid="year-setup-it-details-trigger"
			>
				<ChevronRight
					className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
					aria-hidden='true'
				/>
				<span className="text-sm font-medium">{CALM_DETAILS_LABEL}</span>
			</Button>
			<div
				id={panelId}
				ref={setPanel}
				hidden={!open}
				className='space-y-4 border-t border-slate-200 p-3'
				data-testid='year-setup-it-details-panel'
				data-open={open ? 'true' : 'false'}
			>
				{/* Six words, said once: this region is reference material and opening
				    it changes nothing. The longer "Read-only reference." prefix said
				    the same thing in a phrase nobody needed. */}
				<p className='text-xs text-muted-foreground'>Opening this changes nothing.</p>
				{children}
			</div>
		</div>
	);
}
