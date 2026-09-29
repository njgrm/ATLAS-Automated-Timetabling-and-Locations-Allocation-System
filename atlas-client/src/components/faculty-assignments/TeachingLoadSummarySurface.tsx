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
import { createContext, useContext, useState, type ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/ui/button';
import { DropdownMenuItem } from '@/ui/dropdown-menu';
import { TeachingLoadSummaryDialog } from '@/components/faculty-assignments/TeachingLoadSummaryDialog';

type TeachingLoadSummarySurfaceProps = {
	/** The page's real `TeachingLoadTruthPanel` node, passed `expanded`. */
	children: ReactNode;
	/**
	 * A6 c9 (38.1) — the page's per-teacher workload node, rendered when the
	 * dialog is drilled into one teacher.
	 *
	 * It is the SAME node the page already builds for the review/profile dialog
	 * (`TeachingLoadInspectorPanel` bound to the selected teacher), so the
	 * drill-in imports and reuses the per-teacher metrics instead of restating
	 * them, exactly as `ReviewTeachersModal` does. Omitted, the roster has
	 * nowhere to drill into and the dialog degrades honestly to the roster plus
	 * the `More detail` breakdown.
	 */
	teacherDetail?: ReactNode;
};

/**
 * A6 c6 item 2 — the ONE place the host says "this control belongs in a menu".
 *
 * WHY A CONTEXT AND NOT A PROP. The page builds this surface and hands it to the
 * header through the `loadSummaryAction` SLOT, and that slot contract is
 * deliberately unchanged: the page still writes `loadSummaryAction={<TeachingLoad
 * SummarySurface>…}` and knows nothing about menus. So the HOST decides the shape
 * and the surface reads it. A prop would have meant the page passing
 * `as="menu-item"`, which is the page learning about a menu it does not own.
 *
 * WHY THE STATE IS THE HOST'S, AND WHY THAT IS NOT OPTIONAL. The first attempt at
 * this kept the surface itself INSIDE `DropdownMenuContent` and toggled its own
 * `open` state. That renders correctly and then fails the moment a scheduler uses
 * it: Radix unmounts a menu's content on close, and the surface is a child of that
 * content, so the DIALOG is unmounted in the same commit that opens it and never
 * appears. (A rendered control caught this; the assertion that a menu item opens a
 * dialog is not a thing a source reading can see.) So the open flag is owned by the
 * host, the menu ITEM is a sibling of the surface rather than its child, and the
 * two are joined by this one context. The surface still owns the dialog, the panel
 * node and the `truthModel` authority — the host owns only the flag.
 */
const TeachingLoadSummaryMenuContext = createContext<{
	open: boolean;
	setOpen: (open: boolean) => void;
	/**
	 * A6 c9 (38.1) ΓÇö open ALREADY DRILLED INTO one teacher.
	 *
	 * The per-card `Review load` control has to open the staff workload audit
	 * straight into that teacher's detail, with the `< All teachers` control that
	 * returns to the roster, and the open flag lives in the HOST because Radix
	 * unmounts a menu's content on close. This is the third door into the one
	 * dialog, and it is why the faculty id travels with the flag rather than
	 * being read from a second piece of state.
	 */
	openFor: (facultyId: number | null) => void;
	/** The teacher the flag was opened for, or `null` for the roster. */
	facultyId: number | null;
} | null>(null);
export const TeachingLoadSummaryMenuSlot = TeachingLoadSummaryMenuContext.Provider;

/**
 * The `Load summary` MENU ITEM, rendered by the host inside its `More` menu.
 *
 * The item IS the control: a real `DropdownMenuItem`, with the packet's testid and
 * the packet's accessible name, and NO `<button>` nested inside it — two focusable
 * controls wearing one name is the nesting the packet forbids. It opens the dialog
 * on `onSelect`, which is the menu's own activation, not a click handler bolted on
 * beside it.
 */
export function TeachingLoadSummaryMenuItem() {
	const host = useContext(TeachingLoadSummaryMenuContext);
	if (!host) return null;
	return (
		<DropdownMenuItem
			onSelect={() => (host.openFor ? host.openFor(null) : host.setOpen(true))}
			data-testid="teaching-load-summary-open"
			className="cursor-pointer gap-2 text-xs font-semibold"
		>
			<ClipboardList className="size-3.5" aria-hidden="true" />
			Load summary
		</DropdownMenuItem>
	);
}

export function TeachingLoadSummarySurface({ children, teacherDetail }: TeachingLoadSummarySurfaceProps) {
	// Owned HERE when this component is its own trigger, and by the HOST when the
	// host renders `TeachingLoadSummaryMenuItem` beside it. Either way there is one
	// flag, and the page never learns which.
	const [localOpen, setLocalOpen] = useState(false);
	const [localFacultyId, setLocalFacultyId] = useState<number | null>(null);
	const host = useContext(TeachingLoadSummaryMenuContext);
	const open = host ? host.open : localOpen;
	const setOpen = host ? host.setOpen : setLocalOpen;
	// A6 c9 (38.1): whichever side owns the flag also owns WHICH teacher the
	// dialog opens on, so there is one source and no second piece of state that
	// could disagree with it.
	const openFor = host?.openFor
		?? ((facultyId: number | null) => { setLocalFacultyId(facultyId); setLocalOpen(true); });

	if (host) {
		/*
		 * A MENU-TRIGGERED surface draws NO trigger of its own: its trigger is the
		 * host's menu item, and a second control with the same name would be the
		 * duplicate this slice exists to remove. It renders the dialog alone — which
		 * is also why the host must keep it OUTSIDE the menu content, so closing the
		 * menu cannot unmount a dialog it is in the middle of opening.
		 */
		return (
			<TeachingLoadSummaryDialog
				open={open}
				onOpenChange={setOpen}
				initialFacultyId={host.facultyId}
				openFor={openFor}
				teacherDetail={teacherDetail}
			>
				{children}
			</TeachingLoadSummaryDialog>
		);
	}

	return (
		<>
			{/*
			 * `h-7` matches every other control on header row 1. A6 c6 item 2 moved
			 * the header's own copy into the `More` menu, so this branch is the shape
			 * the control takes for any other host — and it is kept, not deleted, so
			 * `A6C6-9`'s preservation row can still render it.
			 */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 shrink-0 gap-1.5 px-2 text-xs"
				data-testid="teaching-load-summary-open"
				onClick={() => openFor(null)}
			>
				<ClipboardList className="size-3.5" aria-hidden="true" />
				Load summary
			</Button>

			{/* A SIBLING of the button, not a child: the dialog portals, so nesting
			    it would only add a wrapper to reason about. */}
			<TeachingLoadSummaryDialog
				open={open}
				onOpenChange={setOpen}
				initialFacultyId={localFacultyId}
				openFor={openFor}
				teacherDetail={teacherDetail}
			>
				{children}
			</TeachingLoadSummaryDialog>
		</>
	);
}
