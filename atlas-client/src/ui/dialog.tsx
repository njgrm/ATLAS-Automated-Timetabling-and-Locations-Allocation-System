import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Overlay>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Overlay
		ref={ref}
		className={cn(
			'fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
			className,
		)}
		{...props}
	/>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

// ---------------------------------------------------------------------------
// A5 item 23.2 (operator, 2026-09-29) — UNIVERSAL RESIZABLE DATA/FORM DIALOGS.
//
// THE ONE CONTRACT, ON THE ONE PRIMITIVE.
//
// Before this, "make this dialog resizable" was answered per page: a page-local
// `style={{ resize: 'both' }}`, a page-local `resize` class, a page-local grip
// icon, and four different width bounds. Four dialogs were resizable, none of
// them the same way, and the next dialog started from nothing.
//
// The rules, in one place:
//
//   DATA / FORM dialogs  -> `resizable` defaults to TRUE. Width is draggable
//     between DIALOG_RESIZE_MIN_WIDTH_PX and 95vw, and the box is capped at
//     85vh so it can never grow into a page scrollbar.
//
//   CONFIRM / ALERT dialogs -> `resizable={false}`, forced compact at
//     DIALOG_CONFIRM_MAX_WIDTH_CLASS. A confirmation is a question with two
//     answers; a 95vw draggable panel for one is a worse dialog, not a better
//     one. Confirm dialogs pass `resizable={false}` EXPLICITLY rather than
//     relying on a caller remembering, so an audit can read the intent off the
//     call site.
//
// CENTERING IS A FLEX PARENT, NOT A TRANSLATE.
//
// The primitive used to be `fixed left-[50%] top-[50%]` with the
// `animate-modal-in` keyframes holding `transform: translate(-50%,-50%)`
// `forwards`. That works — but only while the box is the size CSS thinks it is,
// and it makes WIDTH RESIZE UNUSABLE: a dragged box is re-anchored by a transform
// that was computed for a different size, so the box slides out from under the
// cursor. The fix is structural, not arithmetic: a `fixed inset-0 flex
// items-center justify-center` wrapper owns the centring, so the browser
// re-centres the box at whatever width it currently is, every frame, with no
// transform and no JS. That is why the `modal-center-*` keyframes below drop the
// translate; keeping the old ones here would shift the box up and left by half
// its own size.
//
// THE MINIMUM WIDTH IS VIEWPORT-GUARDED, AND THAT IS THE SAME FLOOR.
//
// The operator's bound is `min-w-[480px]`. Authored literally, CSS resolves
// `min-width` ABOVE `max-width`, so a 390px phone would get a 480px dialog and a
// 90px horizontal scrollbar — a direct AGENTS.md §8 no-scroll violation. The
// class is therefore `min-w-[min(480px,95vw)]`: 480px wherever it fits, the
// viewport everywhere else. `FacultyProfileSheet` already used exactly this form
// for the same reason, and the shared primitive now holds that one answer for
// every dialog instead of each page re-deriving it.
//
// THE HANDLES ARE AN AFFORDANCE, SO THEY LOOK LIKE ONE (AGENTS.md §8).
//
// Clickable must look clickable. A bare 2px invisible line is a behaviour the
// operator cannot discover, so each handle is a visible, rounded, hoverable grip
// pinned to the edge. It is `aria-hidden` and `tabIndex={-1}`: a pointer drag has
// no keyboard equivalent that would mean anything, and a focusable "handle" that
// does nothing on Enter is worse than no handle. The dialog is still fully
// operable by keyboard — Escape, the close button, and the focus trap are
// untouched, and the close button keeps its place because the handles are inset
// from the top corner it occupies.
// ---------------------------------------------------------------------------

/** Narrowest a resizable data dialog may be dragged, in CSS pixels. */
export const DIALOG_RESIZE_MIN_WIDTH_PX = 480;

/** Widest a resizable data dialog may be dragged, as a percentage of the viewport. */
export const DIALOG_RESIZE_MAX_WIDTH_VW = 95;

/** Tallest a resizable data dialog may be, as a percentage of the viewport. */
export const DIALOG_RESIZE_MAX_HEIGHT_VH = 85;

/** The compact width a confirm/alert dialog is held to. */
export const DIALOG_CONFIRM_MAX_WIDTH_CLASS = 'max-w-md';

/** `data-testid` on each width drag handle, so a rendered check can find them. */
export const DIALOG_RESIZE_HANDLE_TESTID = 'dialog-resize-handle';

/**
 * The class contract for a resizable data dialog, in one exported string.
 *
 * Exported so a class-contract control can assert the PRIMITIVE's promise rather
 * than a copy of it. This is a class contract, NOT acceptance evidence that the
 * user-facing change works — that is a rendered measurement by the planner.
 */
export const DIALOG_RESIZABLE_CLASSES =
	'min-w-[min(480px,95vw)] max-w-[95vw] max-h-[85vh]';

/** The class contract a forced-compact confirm/alert dialog is held to. */
export const DIALOG_COMPACT_CLASSES = `${DIALOG_CONFIRM_MAX_WIDTH_CLASS} max-h-[85vh]`;

/**
 * The narrowest width a resizable dialog may take at this viewport.
 *
 * Guarded: on a viewport narrower than 480px the floor degrades to 95vw rather
 * than forcing a horizontal scrollbar. Same rule as `DIALOG_RESIZABLE_CLASSES`,
 * expressed as the number the drag handler needs. Rounded, for the same reason
 * `clampDialogResizeWidthPx` rounds.
 */
export function dialogResizeMinWidthPx(viewportWidthPx: number): number {
	if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) {
		return DIALOG_RESIZE_MIN_WIDTH_PX;
	}
	return Math.round(
		Math.min(DIALOG_RESIZE_MIN_WIDTH_PX, (viewportWidthPx * DIALOG_RESIZE_MAX_WIDTH_VW) / 100),
	);
}

/**
 * Clamp a requested width to the two bounds. Pure: the drag handler's whole
 * decision, and the half a test can drive without a layout engine.
 *
 * The result is ROUNDED to a whole CSS pixel. A fractional width written to
 * `style.width` is legal CSS but is dropped by the browser's sub-pixel layout
 * on some engines, which shows up as a drag that sticks a pixel short of where
 * the operator let go. Rounding here keeps the reported width and the painted
 * width the same number.
 *
 * A non-finite request is treated as "no width known yet" and returns the floor
 * rather than `NaN` — an unclamped `NaN` width silently collapses the dialog.
 */
export function clampDialogResizeWidthPx(requestedPx: number, viewportWidthPx: number): number {
	const min = dialogResizeMinWidthPx(viewportWidthPx);
	const max = (viewportWidthPx * DIALOG_RESIZE_MAX_WIDTH_VW) / 100;
	if (!Number.isFinite(requestedPx)) return Math.round(min);
	return Math.round(Math.min(Math.max(requestedPx, min), Math.max(min, max)));
}

type DialogResizeSide = 'left' | 'right';

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
	hideClose?: boolean;
	/**
	 * A5 item 23.2. Defaults to TRUE — a data/form dialog a scheduler has to read
	 * across is a dialog they need to be able to widen. Confirm/alert dialogs pass
	 * `false` explicitly and stay compact.
	 */
	resizable?: boolean;
};

const DialogContent = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Content>,
	DialogContentProps
>(({ className, children, hideClose, resizable = true, style, ...props }, ref) => {
	const [dragWidthPx, setDragWidthPx] = React.useState<number | null>(null);
	const [isResizing, setIsResizing] = React.useState(false);
	const boxRef = React.useRef<HTMLDivElement | null>(null);
	const dragRef = React.useRef<{ side: DialogResizeSide; startX: number; startWidth: number } | null>(null);

	const setBoxRef = React.useCallback(
		(node: HTMLDivElement | null) => {
			boxRef.current = node;
			if (typeof ref === 'function') ref(node);
			else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node;
		},
		[ref],
	);

	const endDrag = React.useCallback(() => {
		dragRef.current = null;
		setIsResizing(false);
	}, []);

	React.useEffect(() => {
		if (!isResizing) return;
		const onMove = (event: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			const delta = drag.side === 'right' ? event.clientX - drag.startX : drag.startX - event.clientX;
			setDragWidthPx(clampDialogResizeWidthPx(drag.startWidth + delta, window.innerWidth));
		};
		const onUp = () => endDrag();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		return () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
	}, [isResizing, endDrag]);

	const startDrag = React.useCallback(
		(side: DialogResizeSide) => (event: React.PointerEvent<HTMLDivElement>) => {
			if (event.button !== 0 && event.pointerType === 'mouse') return;
			const box = boxRef.current;
			if (!box) return;
			event.preventDefault();
			// `getBoundingClientRect` is 0 under JSDOM; `offsetWidth` is too. The
			// floor is the honest fallback — a drag then starts from the narrowest
			// legal width rather than from 0, which would collapse the dialog.
			const measured = box.getBoundingClientRect().width || box.offsetWidth;
			dragRef.current = {
				side,
				startX: event.clientX,
				startWidth: measured > 0 ? measured : dialogResizeMinWidthPx(window.innerWidth),
			};
			setIsResizing(true);
		},
		[],
	);

	const handleClasses = (side: DialogResizeSide) =>
		cn(
			'absolute top-10 bottom-4 z-10 w-1.5 -translate-x-1/2 rounded-full cursor-ew-resize touch-none select-none',
			'bg-border transition-colors hover:bg-primary/70 focus-visible:outline-none',
			side === 'left' ? 'left-0' : 'right-0',
		);

	const resizeHandle = (side: DialogResizeSide) => (
		/*
		 * `aria-hidden` + `tabIndex={-1}`: a pointer-drag affordance is not a
		 * keyboard control, and exposing it as one gives a screen-reader user a
		 * focusable element that silently does nothing. The dialog remains fully
		 * keyboard-operable through Escape, the close button and the focus trap.
		 */
		<div
			key={side}
			role="presentation"
			aria-hidden="true"
			tabIndex={-1}
			data-testid={DIALOG_RESIZE_HANDLE_TESTID}
			data-resize-side={side}
			onPointerDown={startDrag(side)}
			className={handleClasses(side)}
		/>
	);

	return (
		<DialogPortal>
			<DialogOverlay />
			{/*
			 * THE FLEX PARENT. The overlay is `fixed inset-0`, so this wrapper is
			 * the full viewport; `items-center justify-center` centres the box at
			 * whatever size it currently is, which is what makes the width drag
			 * usable without any transform and without any re-centring JS.
			 */}
			<div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-dialog-centering="flex">
				<DialogPrimitive.Content
					ref={setBoxRef}
					data-resizable={resizable ? 'true' : 'false'}
					data-resizing={isResizing ? 'true' : undefined}
					style={{ ...style, ...(dragWidthPx != null ? { width: `${dragWidthPx}px` } : null) }}
					className={cn(
						'z-50 grid w-full max-w-lg h-fit gap-4 border border-border bg-background p-6 shadow-lg rounded-lg overflow-y-auto data-[state=open]:animate-modal-center-in data-[state=closed]:animate-modal-center-out',
						resizable ? DIALOG_RESIZABLE_CLASSES : DIALOG_COMPACT_CLASSES,
						/*
						 * `overflow-y-auto` is on the BASE, not on a branch.
						 *
						 * QA F1 (2026-09-29, BLOCKING): an earlier revision put it
						 * behind `!resizable`, so every RESIZABLE dialog lost its
						 * scrollbar while Radix locks the page behind it. A resizable
						 * dialog whose body is tall and has no internal scroller —
						 * `CoverShortageDialog.tsx` (no `overflow` token anywhere in
						 * the file, body is data-dependent up to ten class names) and
						 * `CreatePlaceholderDialog.tsx` (one of the packet's five
						 * targets) — then painted its overflow past the 85vh cap, past
						 * the viewport, with no way to reach the footer.
						 *
						 * A surface that DOES own its scroll region passes
						 * `overflow-hidden` as `className`, which is merged LAST and
						 * therefore wins in tailwind-merge. So the base default and the
						 * page-owned scroller cannot fight.
						 */
						isResizing && 'select-none',
						className,
					)}
					{...props}
				>
					{children}
					{resizable ? [resizeHandle('left'), resizeHandle('right')] : null}
					{!hideClose && (
						<DialogPrimitive.Close className="absolute right-4 top-4 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
							<X className="h-4 w-4" />
							<span className="sr-only">Close</span>
						</DialogPrimitive.Close>
					)}
				</DialogPrimitive.Content>
			</div>
		</DialogPortal>
	);
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />;
}
DialogHeader.displayName = 'DialogHeader';

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
	return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />;
}
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Title>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
	React.ComponentRef<typeof DialogPrimitive.Description>,
	React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
	<DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export { Dialog, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogTrigger, DialogClose };
