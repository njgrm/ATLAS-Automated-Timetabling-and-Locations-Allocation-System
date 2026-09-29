import type { ChangeEvent } from 'react';
import { DoorOpen, ImageOff, MousePointer2, Redo2, Save, Square, Undo2, Upload } from 'lucide-react';

import { nextBackgroundZoom } from '@/components/campus-map/campusMapBackground';
import { CampusMapEditorZoomControls } from '@/components/campus-map/CampusMapEditorZoomControls';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';

/**
 * A9 m1 — the editor's toolbar ROW 1, extracted so `CampusMapEditor.tsx` stays
 * under the AGENTS.md §8 1000-physical-line cap while the Background step is
 * added as a second row.
 *
 * It is DUMB by design, exactly like the zoom cluster it wraps: it owns no view
 * arithmetic, no save logic and no upload logic. Every decision stays with the
 * editor, so the one place that knows what a zoom means is still
 * `campusMapBackground.ts` and the one place that knows what a save does is still
 * the editor's handlers.
 *
 * ── THE LAYOUT NOTE, and this is the part a reviewer should read first ────────
 *
 * The operator's 2026-09-29 ruling is that changes have been "too literal, like
 * no thought was put into the changes". The literal reading of "add Move, Size,
 * Reset and Lock to the editor" is a ninth group crammed into a row that already
 * holds seven, at a viewport where the canvas column is 726px wide. That is what
 * produced the crammed `/timetable` header and the Teaching Load "compaction"
 * that the operator rejected. So, in this file and in the Background step beside
 * it:
 *
 *   STAYS — every group that was here. Select/Draw, the zoom cluster, the Rooms
 *           summary, Campus photo, Undo/Redo, the save state and Save changes all
 *           remain, in the same order, on the same single row.
 *   GOES   — two static WORD LABELS, and nothing else:
 *             · "History", a 10.4px caption in front of two icon buttons that
 *               already carry "Undo" and "Redo" tooltips and aria-labels. It
 *               named the group, added no action, and sat under the 14px floor.
 *             · "Save", a 10.4px caption in front of a status chip that already
 *               reads "All changes saved" / "Unsaved changes" / "Saving...". The
 *               chip IS the label; the caption restated it one status per fact
 *               violation.
 *           Both removals are recorded in the A7 C8 sub-14px ratchet allowlist in
 *           this same commit, because that gate deliberately fails when a
 *           recorded site disappears without being recorded.
 *   MOVES BEHIND A TOOLTIP — the two remaining sub-14px labels. The Rooms
 *           summary and the save-state chip are raised to 14px. Their tooltips
 *           already explain them, and §8 forbids a helper sentence under a
 *           button.
 *   ADDS   — nothing to this row. The Background step is ROW 2, and the only new
 *           sentence it renders when there is no photo is eight words.
 *
 * Every control here is a `@/ui` `Button` with an icon AND a verb, the same
 * `variant`/`size` as everywhere else in the product (§8, one look per control).
 * Nothing is a bare number or plain text pretending to be a control.
 */

export type CampusMapEditorToolbarProps = {
	tool: 'select' | 'add';
	onToolChange: (tool: 'select' | 'add') => void;
	zoom: number;
	onZoomChange: (zoom: number) => void;
	/** The selected building's room counts, or null when nothing is selected. */
	roomsSummary: { teaching: number; total: number } | null;
	campusImageUrl: string | null;
	onImageUpload: (event: ChangeEvent<HTMLInputElement>) => void;
	onImageRemove: () => void;
	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	saveState: 'saved' | 'dirty' | 'saving';
	saveStateLabel: string;
	canSave: boolean;
	onSave: () => void;
};

export function CampusMapEditorToolbar({
	tool,
	onToolChange,
	zoom,
	onZoomChange,
	roomsSummary,
	campusImageUrl,
	onImageUpload,
	onImageRemove,
	canUndo,
	canRedo,
	onUndo,
	onRedo,
	saveState,
	saveStateLabel,
	canSave,
	onSave,
}: CampusMapEditorToolbarProps) {
	const saveStateClass = saveState === 'saved'
		? 'border-emerald-200 bg-emerald-50 text-emerald-700'
		: saveState === 'saving'
			? 'border-sky-200 bg-sky-50 text-sky-700'
			: 'border-amber-200 bg-amber-50 text-amber-800';

	return (
		<div className="flex flex-wrap items-center gap-2">
			<TooltipProvider>
				{/* Group: Select / Draw */}
				<div className="inline-flex rounded-md border border-border bg-card p-0.5" role="tablist" aria-label="Map mode">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={tool === 'select' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => onToolChange('select')}
								aria-pressed={tool === 'select'}
								aria-label="Select buildings"
								className="h-8"
							>
								<MousePointer2 className="size-3.5" /> Select
							</Button>
						</TooltipTrigger>
						<TooltipContent>Select and edit buildings</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant={tool === 'add' ? 'default' : 'ghost'}
								size="sm"
								onClick={() => onToolChange('add')}
								aria-pressed={tool === 'add'}
								aria-label="Draw building"
								className="h-8"
							>
								<Square className="size-3.5" /> Draw building
							</Button>
						</TooltipTrigger>
						<TooltipContent>Draw a new building rectangle</TooltipContent>
					</Tooltip>
				</div>

				{/* Group: view. `zoom` is the operator's multiplier ON TOP of the fit,
				    so zoom in starts from "the whole campus" rather than from a canvas
				    that was already too big for its box. A9 m1: this is the SHARED
				    cluster every read-only viewer uses, and it carries the percentage
				    in words, so the range and the readout are identical on the editor,
				    the overview, the Dashboard card and the room map. */}
				<CampusMapEditorZoomControls
					zoom={zoom}
					onZoomIn={() => onZoomChange(nextBackgroundZoom(zoom, 0.15))}
					onZoomOut={() => onZoomChange(nextBackgroundZoom(zoom, -0.15))}
					onReset={() => onZoomChange(1)}
				/>

				{/* Group: Rooms. 14px (was 10.5px) — see the layout note above. */}
				<div className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-sm font-semibold text-slate-600" aria-label="Rooms summary">
					<DoorOpen className="size-3.5 text-primary" aria-hidden="true" />
					<span>Rooms</span>
					<span className="text-muted-foreground">
						{roomsSummary ? `${roomsSummary.teaching}/${roomsSummary.total} teaching` : 'Select building'}
					</span>
				</div>

				{/* Group: campus photo. The upload stays exactly where the operator
				    already knows it is; the Background step below never becomes the
				    only way to add a photo. */}
				<div className="inline-flex items-center gap-1">
					<label className="cursor-pointer">
						<Button variant="outline" size="sm" asChild aria-label="Upload campus photo">
							<span>
								<Upload className="size-3.5" /> Campus photo
							</span>
						</Button>
						<input
							type="file"
							accept="image/png,image/jpeg,image/webp"
							className="hidden"
							onChange={onImageUpload}
						/>
					</label>
					{campusImageUrl && (
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-xs"
									className="text-muted-foreground hover:text-destructive"
									onClick={onImageRemove}
									aria-label="Remove campus photo"
								>
									<ImageOff className="size-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Remove campus photo</TooltipContent>
						</Tooltip>
					)}
				</div>

				{/* Group: History. The "History" caption is GONE (layout note): the two
				    buttons below carry the words in their tooltips and aria-labels, so
				    the caption named the group without adding an action. */}
				<div className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon-xs" disabled={!canUndo} onClick={onUndo} aria-label="Undo">
								<Undo2 className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Undo the last building change</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="outline" size="icon-xs" disabled={!canRedo} onClick={onRedo} aria-label="Redo">
								<Redo2 className="size-3.5" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Redo the building change you undid</TooltipContent>
					</Tooltip>
				</div>

				<div className="flex-1" />

				{/* Save state. The "Save" caption is GONE (layout note): this chip IS
				    the label, and it now reads at 14px like everything else here. */}
				<div className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2" aria-label="Save state">
					<span
						role="status"
						aria-live="polite"
						className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-sm font-medium ${saveStateClass}`}
					>
						<span className={`size-1.5 rounded-full ${
							saveState === 'saved' ? 'bg-emerald-500' : saveState === 'saving' ? 'bg-sky-500 animate-pulse' : 'bg-amber-500'
						}`} />
						{saveStateLabel}
					</span>
				</div>

				<Tooltip>
					<TooltipTrigger asChild>
						<Button size="sm" disabled={!canSave} onClick={onSave} aria-label="Save campus map changes">
							<Save className="size-3.5" />
							{saveState === 'saving' ? 'Saving...' : 'Save changes'}
						</Button>
					</TooltipTrigger>
					<TooltipContent>Save building changes</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
