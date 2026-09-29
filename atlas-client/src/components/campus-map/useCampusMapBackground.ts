import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import {
	type CampusMapPlacement,
	type CampusMapWorld,
	clampPlacement,
	defaultPlacement,
	fillPlacement,
	movePlacement,
	scalePlacement,
} from '@/components/campus-map/campusMapBackground';
import { saveCampusBackground } from '@/lib/campus-background-api';

/**
 * A9 m1 — the Background step's STATE and its seven edits, as one hook.
 *
 * Extracted from `CampusMapEditor.tsx` for the AGENTS.md §8 1000-line cap, and
 * because these edits are a cohesive unit: they all read the SAME placement and
 * write it back through the SAME pure function, so keeping them together is what
 * makes it obvious that there is no second copy of the arithmetic to drift.
 *
 * EVERY EDIT IS A PURE FUNCTION APPLIED TO THE CURRENT PLACEMENT. There is no
 * "drag state" that can disagree with what is drawn, and pressing "Bigger" twice
 * applies the same factor twice rather than accumulating rounding — which is what
 * a naive `setWidth(w * 1.15)` against a stale closure would do.
 *
 * THE SAVE IS AUTHORITATIVE. It stores what the server stored, not what was sent,
 * so a server-side clamp or rounding is reflected in the editor instead of being
 * overwritten on the next render by the optimistic value. It also LOCKS on save,
 * which is the packet's rule: "Locked by default after the first save".
 */

/** The packet's receipt sentence, plus what was not done and the next step. */
export const BACKGROUND_SAVED_RECEIPT =
	'Background saved and locked. Buildings stay where you placed them. ' +
	'Nothing else changed: no building moved and no room was edited. ' +
	'Next: place your buildings on the photo, then choose Save changes.';

/** How much one press of Bigger / Smaller changes the photo. */
export const BACKGROUND_SIZE_STEP = 1.15;

export function useCampusMapBackground(input: {
	schoolId: number;
	/** The placement currently drawn: the stored one repaired, or the local edit. */
	placement: CampusMapPlacement | null;
	/** The world the photo is drawn in — the clamp bound for every edit. */
	world: CampusMapWorld;
	/** The decoded photo, so Fit / Fill can measure against the real file. */
	image: HTMLImageElement | null;
	onSaved: () => void;
}) {
	const { schoolId, placement, world, image, onSaved } = input;
	// `undefined` means "no local edit yet", which is distinct from an edit that
	// happens to equal the stored value.
	const [edited, setEdited] = useState<CampusMapPlacement | null>(null);
	const [moving, setMoving] = useState(false);
	const [saving, setSaving] = useState(false);
	const [receipt, setReceipt] = useState<string | null>(null);

	/**
	 * Apply one pure edit.
	 *
	 * DELIBERATELY NOT CLAMPED TO THE WORLD. "Bigger" and "Fill the area" are
	 * supposed to be able to make the photo LARGER than the world — that is what
	 * filling the area means — and the world then grows to hold it (see
	 * `backgroundWorld`), so the view refits and nothing is ever cropped. Clamping
	 * here would silently turn "Fill the area" into a no-op, because a fit-whole
	 * photo is by definition smaller than the world.
	 *
	 * Only MOVES are clamped, and only against the base world, because "never
	 * dragged fully out of the world" is a property of a position.
	 */
	const edit = useCallback(
		(next: (current: CampusMapPlacement) => CampusMapPlacement) => {
			if (!placement) return;
			setEdited(next(placement));
		},
		[placement],
	);

	/** Called after an upload or a removal: the stored framing described a
	 *  different file, so the local edit is dropped and the stored value refits. */
	const reset = useCallback(() => {
		setEdited(null);
		setMoving(false);
	}, []);

	const bigger = useCallback(() => edit((c) => scalePlacement(c, BACKGROUND_SIZE_STEP)), [edit]);
	const smaller = useCallback(() => edit((c) => scalePlacement(c, 1 / BACKGROUND_SIZE_STEP)), [edit]);
	const fitWholeImage = useCallback(() => edit(() => defaultPlacement(image, world)), [edit, image, world]);
	const fillTheArea = useCallback(() => edit(() => fillPlacement(image, world)), [edit, image, world]);
	// RESET is the packet's word and it means "back to where ATLAS would put it":
	// fit whole image, centred, LOCKED — not "unlock". An operator who hit Reset
	// expecting to be able to drag again would be surprised.
	const resetBackground = useCallback(() => edit(() => defaultPlacement(image, world)), [edit, image, world]);
	const toggleLock = useCallback(() => edit((c) => ({ ...c, locked: !c.locked })), [edit]);

	const moveBy = useCallback(
		(delta: { x: number; y: number }) => {
			if (!placement) return;
			setEdited(clampPlacement(movePlacement(placement, delta), world));
		},
		[placement, world],
	);

	/** Move to an absolute position — the Konva drag's reported node position. */
	const moveTo = useCallback(
		(position: { x: number; y: number }) => {
			if (!placement) return;
			setEdited(clampPlacement({ ...movePlacement(placement, { x: 0, y: 0 }), x: position.x, y: position.y }, world));
		},
		[placement, world],
	);

	const toggleMoving = useCallback(() => {
		setMoving((current) => {
			// Turning Move ON while the photo is LOCKED would be a control that
			// silently does nothing — the node is not draggable — so turning it on
			// unlocks the photo in the same render and the lock chip updates with it.
			if (!current && placement?.locked !== false) edit((c) => ({ ...c, locked: false }));
			return !current;
		});
	}, [placement?.locked, edit]);

	const save = useCallback(async () => {
		if (!placement) return;
		setSaving(true);
		try {
			const saved = await saveCampusBackground(schoolId, { ...placement, locked: true });
			setEdited(clampPlacement(saved, world));
			setMoving(false);
			setReceipt(BACKGROUND_SAVED_RECEIPT);
			onSaved();
		} catch (err: any) {
			toast.error(err?.response?.data?.message || 'Failed to save the background.');
			console.error('Background save failed:', err);
		} finally {
			setSaving(false);
		}
	}, [placement, schoolId, world, onSaved]);

	return {
		edited,
		moving,
		saving,
		receipt,
		reset,
		bigger,
		smaller,
		fitWholeImage,
		fillTheArea,
		resetBackground,
		toggleLock,
		moveBy,
		moveTo,
		toggleMoving,
		save,
	};
}
