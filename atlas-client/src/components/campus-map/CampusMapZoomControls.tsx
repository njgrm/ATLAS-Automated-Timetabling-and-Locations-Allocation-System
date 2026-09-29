import { Minus, Move, Plus, RotateCcw } from 'lucide-react';

import { MAX_VIEW_ZOOM, MIN_VIEW_ZOOM, zoomLabel } from '@/components/campus-map/campusMapBackground';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * A9 m1 — the ONE view cluster, used by the editor AND every read-only viewer.
 *
 * BEFORE THIS, the editor had `CampusMapEditorZoomControls` (clamped 0.25–4) and
 * the read-only preview had its own three buttons with its own 0.8–3 bounds, and
 * `MapView` and `CampusMap` each had a fourth and fifth copy. Two screens named
 * "Zoom In" with two different limits is exactly the §8 "one look per control"
 * failure, so this replaces all of them and the old component is re-exported from
 * here so no caller has to change its import in the same commit.
 *
 * THE PERCENTAGE IS WORDS, and it is a live `role="status"`: "75%", not "0.75",
 * and not a bare number that looks like a control. The packet asks for the
 * percentage in words, and a reader who cannot see the number at all would
 * otherwise have to infer the zoom from the size of the map.
 *
 * The bounds come from `nextBackgroundZoom`, so the BUTTONS and the WHEEL stop at
 * the same two places — the wheel is not a second, differently-clamped control.
 */
export function CampusMapZoomControls({
	zoom,
	onZoomIn,
	onZoomOut,
	onReset,
	label = 'campus map',
	className,
}: {
	zoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
	label?: string;
	className?: string;
}) {
	// The two ends of the range are computed through the SAME clamp the buttons
	// and the wheel use, so "am I at the stop" can never disagree with the
	// control that would move me. At a stop the button is disabled (§8: a
	// disabled action with nothing to do is hidden or explained, and here the
	// explanation is on the tooltip) and the tooltip says WHY.
	const current = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	const atMin = current <= MIN_VIEW_ZOOM + 0.001;
	const atMax = current >= MAX_VIEW_ZOOM - 0.001;

	return (
		<TooltipProvider>
			<div className={`inline-flex items-center gap-1 ${className ?? ''}`}>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon-xs"
							onClick={onZoomOut}
							disabled={atMin}
							aria-label={`Zoom out of the ${label}`}
						>
							<Minus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{atMin ? 'Zoomed out as far as it goes — the whole image is visible' : 'Zoom out'}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="outline"
							size="icon-xs"
							onClick={onZoomIn}
							disabled={atMax}
							aria-label={`Zoom in on the ${label}`}
						>
							<Plus className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>{atMax ? 'Zoomed in as far as it goes — buildings can be placed precisely' : 'Zoom in'}</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline" size="icon-xs" onClick={onReset} aria-label={`Reset the ${label} view`}>
							<RotateCcw className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Reset the view to show everything</TooltipContent>
				</Tooltip>

				{/* The percentage: a readout, not a control. It has a status role so
				    a screen reader announces a zoom change, and it is visually
				    separated from the buttons by a rule rather than given a border,
				    because a bordered box here would read as a fourth button. */}
				<span
					role="status"
					aria-live="polite"
					aria-label={`Zoom ${zoomLabel(zoom)}`}
					className="inline-flex h-8 items-center gap-1 border-l border-border pl-2 pr-1 text-sm font-semibold text-muted-foreground"
				>
					<Move className="size-3.5" aria-hidden="true" />
					<span className="tabular-nums">{zoomLabel(zoom)}</span>
				</span>
			</div>
		</TooltipProvider>
	);
}
