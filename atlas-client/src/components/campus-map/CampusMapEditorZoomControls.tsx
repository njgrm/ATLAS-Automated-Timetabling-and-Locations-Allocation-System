import { Minus, Plus, RotateCcw } from 'lucide-react';

import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * A9 c4 — the campus-map editor's VIEW cluster: zoom in, zoom out, and reset.
 *
 * Extracted from `CampusMapEditor.tsx` because that file reached the AGENTS.md §8
 * 1000-physical-line cap while the fit view was being added, and this block is a
 * self-contained control — the same shape as its neighbour
 * `BuildingGradeScopeControl.tsx` in this folder.
 *
 * It is deliberately DUMB: it owns no zoom arithmetic and no view state, so the
 * one place that decides what a zoom means stays `campusEditorCanvas.ts` and the
 * one place that owns the operator's zoom and pan stays the editor. Three
 * callbacks, three buttons, and the same `variant`/`size` as every other icon
 * control in the editor toolbar (AGENTS.md §8, one look per control).
 *
 * RESET is the control worth reading: A9 c4 item 36 changed what it means. It
 * used to return the canvas to 100%, and at the 1366px default 100% is the view
 * that painted a building under the inspector. It now returns to the FIT — the
 * whole campus inside the free area — which is what "reset the view" means to an
 * operator who cannot see the whole campus.
 */
export function CampusMapEditorZoomControls({
	onZoomIn,
	onZoomOut,
	onReset,
}: {
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
}) {
	return (
		<TooltipProvider>
			<div className="inline-flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon-xs" onClick={onZoomIn} aria-label="Zoom in">
							<Plus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom in</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon-xs" onClick={onZoomOut} aria-label="Zoom out">
							<Minus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Zoom out</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon-xs" onClick={onReset} aria-label="Reset view">
							<RotateCcw className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Reset view</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}
