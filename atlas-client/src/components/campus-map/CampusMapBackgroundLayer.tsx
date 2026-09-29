import { useEffect, useState } from 'react';
import { Rect } from 'react-konva';

import {
	type CampusMapPlacement,
	clampPlacement,
	normalisePlacement,
	placementRect,
	safeWorld,
} from '@/components/campus-map/campusMapBackground';
import type { CampusMapWorld } from '@/components/campus-map/campusMapBackground';

/**
 * A9 m1 — the ONE background layer, painted identically by the editor and every
 * read-only viewer.
 *
 * WHY A SHARED COMPONENT AND NOT A SHARED FUNCTION. The stretch was arithmetic,
 * but it was arithmetic written FOUR times: `CampusMapEditor.tsx`,
 * `CampusMapCanvasPreview.tsx`, `MapView.tsx` and `CampusMap.tsx` each painted the
 * photo with their own `fillPatternScaleX` / `fillPatternScaleY` pair. A shared
 * pure function would still have left four chances to wire it wrongly; one
 * component leaves none.
 *
 * THE ASPECT CONTRACT, visibly. The two pattern scales are
 * `rect.width / image.width` and `rect.height / image.height`, and
 * {@link placementRect} derives `rect.height` from the file's own ratio — so the
 * two factors are equal BY CONSTRUCTION, not by two agreeing hand-written
 * divisions. The mutant control in `__tests__/a9-m1-campus-background.test.ts`
 * reverts `placementRect` to independent axis maths and proves this component's
 * output changes.
 *
 * TWO RECTS, not one, and the second is what an unlocked photo needs: the stone
 * backing fills the whole world so the canvas never shows through, and the photo
 * itself is a separate draggable node. That separation is what makes "while
 * locked, dragging moves buildings only and never the photo" a property of the
 * tree — `draggable` is literally false on the node — rather than a handler that
 * has to remember to undo a move.
 */

export type CampusMapBackgroundLayerProps = {
	/** The decoded photo, or null before it loads (or when there is none). */
	image: HTMLImageElement | null;
	/** The stored placement, repaired against the loaded image. */
	placement: CampusMapPlacement;
	/** The world this layer paints into. */
	world: CampusMapWorld;
	/** Konva node name — `bg` is the click-through-empty target the editor tests for. */
	name?: string;
	/** Whether the photo itself accepts a drag. False whenever the placement is locked. */
	draggable?: boolean;
	onDragEnd?: (next: { x: number; y: number }) => void;
	/** Extra opacity, for a viewer that shows the photo behind a scrim. */
	opacity?: number;
	cornerRadius?: number;
};

/** Load a URL into a decoded `HTMLImageElement`, with the failure path typed. */
export function useCampusImage(campusImageUrl: string | null | undefined): HTMLImageElement | null {
	const [image, setImage] = useState<HTMLImageElement | null>(null);

	useEffect(() => {
		if (!campusImageUrl) {
			setImage(null);
			return;
		}
		const element = new window.Image();
		element.crossOrigin = 'anonymous';
		element.src = campusImageUrl;
		element.onload = () => setImage(element);
		element.onerror = () => setImage(null);
		return () => {
			element.onload = null;
			element.onerror = null;
		};
	}, [campusImageUrl]);

	return image;
}

export function CampusMapBackgroundLayer({
	image,
	placement,
	world,
	name = 'bg',
	draggable = false,
	onDragEnd,
	opacity = 1,
	cornerRadius = 0,
}: CampusMapBackgroundLayerProps) {
	const box = safeWorld(world);
	const rect = placementRect(clampPlacement(placement, box));

	return (
		<>
			{/* The stone backing. Spans the whole world so a fitted photo never
			    leaves a hole, and stays put while the photo is dragged over it. */}
			<Rect
				name={`${name}-ground`}
				x={0}
				y={0}
				width={box.width}
				height={box.height}
				fill="hsl(40 30% 95%)"
				cornerRadius={cornerRadius}
				listening={false}
			/>
			{image && (
				<Rect
					name={name}
					x={rect.x}
					y={rect.y}
					width={rect.width}
					height={rect.height}
					fill="#f5f5f4"
					draggable={draggable}
					opacity={opacity}
					cornerRadius={cornerRadius}
					onDragEnd={(event) => {
						// Konva reports the node's own position in the LAYER's
						// coordinates, which is the world — the same space a
						// building's stored `x`/`y` lives in, so the value is
						// directly comparable and no division by the view scale
						// is needed or wanted.
						onDragEnd?.({ x: event.target.x(), y: event.target.y() });
					}}
					fillPatternImage={image}
					fillPatternScaleX={rect.width / image.width}
					fillPatternScaleY={rect.height / image.height}
				/>
			)}
		</>
	);
}

/**
 * The placement a viewer should draw: the stored one repaired against the photo
 * that ACTUALLY loaded, clamped into the world this viewer is painting.
 *
 * A thin, named seam so that no viewer re-implements the repair, and so a viewer
 * with no stored placement and no photo gets the same "fit whole, locked" default
 * the editor shows rather than a special case of its own.
 */
export function viewerPlacement(
	stored: unknown,
	image: HTMLImageElement | null,
	world: CampusMapWorld,
): CampusMapPlacement {
	const measured = image ? { width: image.width, height: image.height } : null;
	return clampPlacement(normalisePlacement(stored as never, measured, world), world);
}
