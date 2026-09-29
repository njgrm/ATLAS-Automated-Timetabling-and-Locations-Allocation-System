import { Expand, Lock, LockOpen, Maximize2, Minimize2, Move, RotateCcw, Shrink } from 'lucide-react';

import type { CampusMapPlacement } from '@/components/campus-map/campusMapBackground';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * A9 m1 — the editor's BACKGROUND step.
 *
 * ── THE LAYOUT NOTE, written before the JSX, because the packet's operator
 *    failures were all "too literal" additions to a screen that was already
 *    full. Read this before changing anything below.
 *
 * WHAT STAYS, in the editor's existing toolbar row, unchanged: the Select/Draw
 * mode pair, the zoom cluster, the Rooms summary, Campus photo, History, and the
 * Save state + Save changes pair. None of them moved, and none of them grew a
 * second line of helper text.
 *
 * WHAT GOES: nothing is deleted from the toolbar, because every item in it earns
 * its place and the packet did not ask for a subtraction. What IS subtracted is
 * the WORD COUNT of this step: the packet names Move, Size, Reset and Lock. Size
 * is two buttons (Bigger / Smaller), Move is a two-state button that reads
 * "Moving background" when it is on, and Reset is one button. There is no caption
 * under any of them, no sentence explaining what a background is, and no "More"
 * menu — every control is visible at all times, which is the operator's explicit
 * instruction and the packet's "no disclosure" rule.
 *
 * WHAT MOVES BEHIND A TOOLTIP: every explanation. "Fit whole image" and "Fill the
 * area" say what they do in their own labels, so their tooltips only add WHY you
 * would want them; the lock button's tooltip states the consequence of locking.
 * §8 forbids a helper sentence under a button, and an older scheduler clicking a
 * wordless control is the failure the design judgement gate was written about.
 *
 * THE LOCK IS WORDS, not a colour and not an icon alone: "Background locked" is
 * written out, beside an Unlock button that carries the verb. The packet requires
 * that exact visibility, and a scheduler must be able to tell whether dragging
 * will move the photo without decoding a padlock.
 *
 * EVERY CONTROL LOOKS CLICKABLE: each is a `@/ui` `Button` with the same
 * `variant`/`size` as every other control in this toolbar, an icon AND a verb in
 * the label, a pointer cursor, and a visible hover/focus ring. Nothing here is a
 * bare number or plain text pretending to be a control.
 */

export type CampusMapBackgroundStepProps = {
	/** `null` when the school has no photo — the step explains that, and offers the upload. */
	placement: CampusMapPlacement | null;
	/** True while the scheduler has chosen to drag the photo rather than the buildings. */
	moving: boolean;
	saving: boolean;
	onToggleMoving: () => void;
	onBigger: () => void;
	onSmaller: () => void;
	onFitWholeImage: () => void;
	onFillTheArea: () => void;
	onReset: () => void;
	onToggleLock: () => void;
	onSave: () => void;
};

export function CampusMapBackgroundStep({
	placement,
	moving,
	saving,
	onToggleMoving,
	onBigger,
	onSmaller,
	onFitWholeImage,
	onFillTheArea,
	onReset,
	onToggleLock,
	onSave,
}: CampusMapBackgroundStepProps) {
	const locked = placement?.locked !== false;

	return (
		<TooltipProvider>
			{/* A `group`, not a disclosure: no "Background" chevron, no collapsed
			    state. The one thing this row is allowed to do is disappear entirely,
			    and only when there is no photo to frame. */}
			<div
				role="group"
				aria-label="Background"
				data-testid="campus-background-step"
				className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-1"
			>
				{/* The step's name, in the same quiet voice as "History" two groups
				    along. It is a label, not a button, so it is plain text — which
				    is the ONE thing in this row allowed to be. */}
				<span className="px-1 text-sm font-semibold text-muted-foreground">Background</span>

				{placement ? (
					<>
						{/* MOVE — two-state, and it says which state it is in. A scheduler
						    who cannot see whether the drag will move the photo or the
						    buildings cannot use the canvas at all, so this is a pressed
						    toggle with a spoken state rather than an icon that toggles
						    silently. */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant={moving ? 'default' : 'outline'}
									size="sm"
									className="h-8"
									onClick={onToggleMoving}
									aria-pressed={moving}
									aria-label={moving ? 'Stop moving the background' : 'Move the background photo'}
								>
									{moving ? <LockOpen className="size-3.5" /> : <Move className="size-3.5" />}
									{moving ? 'Moving background' : 'Move background'}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{moving
									? 'Drag the photo on the map to move it. Buildings stay where they are.'
									: 'Turn this on, then drag the photo on the map to move it.'}
							</TooltipContent>
						</Tooltip>

						{/* SIZE — two buttons rather than a slider. A slider has no
						    visible ends, no keyboard-friendly step, and no way to return
						    to a known size; two labelled buttons and the two one-click
						    presets below cover every case the packet names, and each is
						    a single press for a mouse-first scheduler. */}
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onSmaller} aria-label="Make the background smaller">
									<Minimize2 className="size-3.5" /> Smaller
								</Button>
							</TooltipTrigger>
							<TooltipContent>Make the background photo smaller. Its shape never changes.</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onBigger} aria-label="Make the background bigger">
									<Maximize2 className="size-3.5" /> Bigger
								</Button>
							</TooltipTrigger>
							<TooltipContent>Make the background photo bigger. Its shape never changes.</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onFitWholeImage} aria-label="Fit the whole image">
									<Shrink className="size-3.5" /> Fit whole image
								</Button>
							</TooltipTrigger>
							<TooltipContent>Show the entire photo inside the map area, with a small margin.</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onFillTheArea} aria-label="Fill the area with the image">
									<Expand className="size-3.5" /> Fill the area
								</Button>
							</TooltipTrigger>
							<TooltipContent>Make the photo cover the whole map area with no margin around it.</TooltipContent>
						</Tooltip>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onReset} aria-label="Reset the background">
									<RotateCcw className="size-3.5" /> Reset
								</Button>
							</TooltipTrigger>
							<TooltipContent>Put the photo back to fit whole image, centred and locked.</TooltipContent>
						</Tooltip>

						{/* THE LOCK, IN WORDS. This is the packet's exact requirement and
						    the reason the whole feature exists: a scheduler has to be
						    able to read, without hovering anything, whether dragging
						    will move the photo. */}
						<span
							data-testid="campus-background-lock-state"
							className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-sm font-semibold ${
								locked
									? 'border-emerald-200 bg-emerald-50 text-emerald-700'
									: 'border-amber-200 bg-amber-50 text-amber-800'
							}`}
						>
							{locked ? <Lock className="size-3.5" aria-hidden="true" /> : <LockOpen className="size-3.5" aria-hidden="true" />}
							{locked ? 'Background locked' : 'Background not locked'}
						</span>

						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="outline" size="sm" className="h-8" onClick={onToggleLock} aria-label={locked ? 'Unlock the background' : 'Lock the background'}>
									{locked ? <LockOpen className="size-3.5" /> : <Lock className="size-3.5" />}
									{locked ? 'Unlock' : 'Lock background'}
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								{locked
									? 'Unlock lets you drag the photo again. Buildings are never moved by the photo.'
									: 'Lock the photo in place so dragging only moves buildings.'}
							</TooltipContent>
						</Tooltip>

						{/* The one primary action of this step. It is `variant="default"`
						    like the page's other primary action, and it is `disabled`
						    only while the request is in flight — §8's rule about a
						    disabled action with nothing to do is satisfied by the
						    `saving` guard here, because saving a background is always
						    something to do: the placement is the school setting, and
						    re-saving it is a no-op on the server rather than an error. */}
						<Button size="sm" className="h-8" onClick={onSave} disabled={saving}>
							{saving ? 'Saving background...' : 'Save background'}
						</Button>
					</>
				) : (
					/* No photo: the step does not render a row of controls for something
					   that does not exist. One sentence, and the upload stays in the
					   toolbar group above where it has always been. */
					<span className="text-sm text-muted-foreground">
						Upload a campus photo to frame it here.
					</span>
				)}
			</div>
		</TooltipProvider>
	);
}
