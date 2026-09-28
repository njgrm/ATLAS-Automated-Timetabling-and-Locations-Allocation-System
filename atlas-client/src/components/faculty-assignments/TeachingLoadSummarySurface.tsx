/**
 * TeachingLoadSummarySurface — the header's `Load summary` button plus the
 * centred dialog it opens.
 *
 * FIX 38 (operator, 2026-09-28). The complete load breakdown used to be an
 * INLINE collapsible `TEACHING LOAD SUMMARY` band in the page body, costing
 * ~42px of permanent header on every session for figures almost nobody opened.
 * It now lives behind one header button.
 *
 * WHY THIS IS A SEPARATE FILE, AND WHY THE PAGE STILL OWNS THE PANEL.
 *
 * This extraction exists for a second reason: item 38 pushed
 * `pages/TeachingLoad.tsx` back over the AGENTS.md §8 1000-physical-line cap,
 * and the brief's fallback is to extract the item-38 wiring. The panel NODE is
 * deliberately NOT built here. It is passed in as `children`, built by the page
 * with the page's own `truthModel`. Two reasons, and the first is a committed
 * test rather than a preference:
 *
 *  1. `src/lib/__tests__/tl-operator-workspace-c05-r3-truth.test.ts` asserts
 *     `assert.match(page, /<TeachingLoadTruthPanel/)` on the PAGE SOURCE and
 *     then inspects the 400 characters before that index to prove the collapsed
 *     truth strip is not hidden on short viewports. A surface that constructed
 *     the panel itself would delete the literal that control reads, and the
 *     control would fail on the absence of a string rather than on a behaviour.
 *  2. The dialog must not be able to disagree with the page about a figure.
 *     Building the panel here from anything other than the page's `truthModel`
 *     would be a second authority for the same number — the exact failure the
 *     truth panel was built to prevent. Owning only the `open` state and the
 *     button leaves exactly one source of the model.
 *
 * So this component owns two things and nothing else: the open flag, and the
 * control that flips it.
 */
import { useState, type ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/ui/button';
import { TeachingLoadSummaryDialog } from '@/components/faculty-assignments/TeachingLoadSummaryDialog';

type TeachingLoadSummarySurfaceProps = {
	/** The page's real `TeachingLoadTruthPanel` node, passed `expanded`. */
	children: ReactNode;
};

export function TeachingLoadSummarySurface({ children }: TeachingLoadSummarySurfaceProps) {
	// Owned HERE, not in the page. The page no longer needs to know the dialog
	// exists, which is what removes the dialog JSX from it.
	const [open, setOpen] = useState(false);

	return (
		<>
			{/* `h-7` matches every other control on header row 1, so this does not
			    change `TEACHING_LOAD_HEADER_MODEL.ROW_1_COMMAND_PX` and the
			    committed header-height control stays green. The page renders this
			    component in the header action area, beside `Help` and before the
			    primary suggestion action. */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 shrink-0 gap-1.5 px-2 text-xs"
				data-testid="teaching-load-summary-open"
				onClick={() => setOpen(true)}
			>
				<ClipboardList className="size-3.5" aria-hidden="true" />
				Load summary
			</Button>

			{/* A SIBLING of the button, not a child: the dialog portals, so nesting
			    it would only add a wrapper to reason about. */}
			<TeachingLoadSummaryDialog open={open} onOpenChange={setOpen}>
				{children}
			</TeachingLoadSummaryDialog>
		</>
	);
}
