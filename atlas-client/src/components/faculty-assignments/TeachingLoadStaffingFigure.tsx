/**
 * A6 c9 — THE STAFFING FIGURE, and the window it opens.
 *
 * WHAT THIS REPLACES, and why it is a REWIRING rather than a rebuild. The
 * percentage already existed (`buildStaffingTruthFigures`), the per-subject
 * shortage already existed (`buildSubjectShortage`, extended here with the class
 * NAMES it already walked past), the cover/preview/apply flow already existed
 * (`useCoverShortage` + `CoverShortageDialog`, with the server's drift re-check
 * at apply time), and `TeachingLoadShortageLine` already existed. What the
 * operator overruled is the SHAPE: a read-only percentage plus a separate line
 * plus a separate cover button is three readings of one fact, and the figure
 * itself looked like a metric, so it was passed over — verbatim, "some buttons
 * are not obvious as clickable and can just be passed on as a read-only metric".
 *
 * SO THE FIGURE IS A CONTROL, AND IT LOOKS LIKE ONE. It is the `@/ui` `Button`
 * `outline` variant — the same control as `Cover these classes` and `Review load`
 * beside it — so it carries a border, a fill on hover, the shared
 * `focus-visible` ring, a `cursor-pointer`, a VERB in its label and a chevron.
 * No local colour or border vocabulary is introduced, and no emphasis variant is
 * added to `@/ui` because `outline` already IS the pressable look every other
 * row-2 control uses; a new variant would have made this one control look like
 * no other.
 *
 * ONE CLAIM PER FACT, AND THE SUBTRACTION. Row 2 printed the c7 shortage line
 * when there was a shortage, an amber pill when the roster was the saved one,
 * and a grey `N classes still need a real teacher.` line in the workspace body.
 * That is three surfaces. This component is ONE: the figure, its window, and —
 * only when the roster genuinely cannot be confirmed — a single small grey line
 * under the figure carrying the date of the snapshot on screen. The amber pill's
 * cause and the longer explanation live where the operator said they belong: the
 * cover control's existing tooltip and the header's `Help` step.
 *
 * NOTHING HERE IS A SECOND AUTHORITY. The percentage, the shortage count, the
 * subject order and the class names all come from `useTeachingLoadOutage`, and
 * the action opens the EXISTING `CoverShortageDialog` through the EXISTING
 * `cover.openFor(entry)`. There is no second apply path in this file, and no
 * figure is recomputed here.
 */
import { useState } from 'react';
import { ChevronRight, UserRoundPlus } from 'lucide-react';

import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

import { CoverShortageDialog } from '@/components/faculty-assignments/CoverShortageDialog';
import { COVER_CLASSES_LABEL, COVER_SAVED_ROSTER_NOTE } from '@/components/faculty-assignments/TeachingLoadShortageLine';
import {
	buildStaffingFigureLabel,
	formatSavedRosterNote,
	type SubjectShortageEntry,
} from '@/components/faculty-assignments/teachingLoadOutage';
import type { useTeachingLoadOutage } from '@/hooks/useTeachingLoadOutage';

type Outage = ReturnType<typeof useTeachingLoadOutage>;

/** The single-class form of the one action. Not reworded: one verb, two counts. */
export const ASSIGN_TEACHER_LABEL = 'Assign teacher';

export type TeachingLoadStaffingFigureProps = {
	outage: Outage;
	/** The page's own write gate, so a read-only workspace never offers a write. */
	writeBlockedReason: string | null;
	/** The existing coverage detail, for the window's own secondary control. */
	onShowCoverageDetail: () => void;
	/** The page's real `sectionSummary.fetchedAt`, or `null`. Never synthesised. */
	fetchedAt: string | null | undefined;
};

export function TeachingLoadStaffingFigure({
	outage,
	writeBlockedReason,
	onShowCoverageDetail,
	fetchedAt,
}: TeachingLoadStaffingFigureProps) {
	const [windowOpen, setWindowOpen] = useState(false);
	/*
	 * Which subject the cover dialog is open on. The hook keeps only the id (it
	 * owns the request), so the row that pressed the control keeps the COUNT
	 * beside it — otherwise the dialog would describe whichever subject happened
	 * to be worst, which is not the one the scheduler pressed.
	 */
	const [openedEntry, setOpenedEntry] = useState<SubjectShortageEntry | null>(null);
	const label = buildStaffingFigureLabel(outage.staffingFigures);
	// A subject with no named class is not a row a scheduler can act on, so it
	// does not appear at all. `buildSubjectShortage` only creates an entry when
	// its count is above zero, so this filter is the guard against a future entry
	// whose classes could not be named — not a second count.
	const entries = outage.shortage.entries.filter((entry) => entry.classNames.length > 0);
	const total = outage.staffingFigures.withoutRealTeacherCount;

	return (
		<div className="flex min-w-0 shrink-0 flex-col items-start" data-testid="teaching-load-staffing-figure-slot">
			{/*
			 * THE PRIMARY CLAIM, AS A CONTROL. `aria-haspopup="dialog"` says what
			 * pressing it does, and the visible label already contains a VERB and
			 * its destination, so no `aria-label` is added over the top of it —
			 * an accessible name that merely restates a metric is the same defect
			 * as a metric that looks like a label.
			 */}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="h-7 shrink-0 cursor-pointer gap-1.5 px-2.5 text-xs"
				data-testid="teaching-load-staffing-figure"
				aria-haspopup="dialog"
				aria-expanded={windowOpen}
				onClick={() => setWindowOpen(true)}
			>
				<span className="font-bold">{label.figure}</span>
				<span className="font-semibold">— {label.clause}</span>
				<ChevronRight className="size-3.5" aria-hidden="true" />
			</Button>

			{/*
			 * THE ONE QUIET LINE, AND ONLY WHEN THE ROSTER IS NOT THE CURRENT ONE.
			 *
			 * It is grey, it carries no icon, no `Next step`, no product name and
			 * no second sentence, and its date is the page's real `fetchedAt` or
			 * nothing at all. When the roster IS current this renders nothing —
			 * the packet is explicit that the healthy state is silent.
			 */}
			{!outage.figuresVerified && (
				<p
					data-testid="teaching-load-saved-roster-note"
					className="mt-0.5 text-xs text-muted-foreground"
				>
					{formatSavedRosterNote(fetchedAt)}
				</p>
			)}

			<Dialog open={windowOpen} onOpenChange={setWindowOpen}>
				<DialogContent
					className="flex min-w-[540px] max-w-[95vw] max-h-[85vh] flex-col overflow-hidden"
					data-testid="teaching-load-shortage-window"
				>
					<DialogHeader className="shrink-0">
						<DialogTitle className="text-base font-bold" data-testid="teaching-load-shortage-window-title">
							Who still needs a teacher
						</DialogTitle>
						<DialogDescription className="text-xs">
							{entries.length === 0
								? `${label.figure}. Every class has a teacher.`
								: `${label.figure}. ${total} ${total === 1 ? 'class needs' : 'classes need'} one.`}
						</DialogDescription>
					</DialogHeader>

					{/* THE WINDOW'S ONE SCROLL REGION (AGENTS.md §8). */}
					<div className="min-h-0 flex-1 overflow-y-auto">
						{entries.length === 0 ? (
							<p className="px-1 py-6 text-sm text-muted-foreground" data-testid="teaching-load-shortage-window-empty">
								Nothing is waiting for a teacher.
							</p>
						) : (
							<ul className="divide-y divide-border/40" data-testid="teaching-load-shortage-window-list">
								{entries.map((entry) => (
									<li
										key={entry.subjectId}
										className="flex items-center justify-between gap-3 py-2"
										data-testid={`teaching-load-shortage-subject-${entry.subjectId}`}
									>
										{/* `MAPEH — 7-A, 7-B, 8-C`: the subject, then the classes
										    BY NAME. The count is carried by the list itself, so no
										    third copy of the same number is printed. */}
										<p className="min-w-0 text-sm text-foreground">
											<span className="font-semibold">{entry.subjectName}</span>
											<span className="text-muted-foreground"> — {entry.classNames.join(', ')}</span>
										</p>
										<ShortageAction
											entry={entry}
											writeBlockedReason={writeBlockedReason}
											figuresVerified={outage.figuresVerified}
											totalShortClasses={total}
											onCover={outage.cover.openFor}
											onCovering={() => { setOpenedEntry(entry); setWindowOpen(false); }}
										/>
									</li>
								))}
							</ul>
						)}
					</div>

					<DialogFooter className="shrink-0">
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 cursor-pointer px-3 text-xs"
							data-testid="teaching-load-shortage-window-coverage"
							onClick={() => { setWindowOpen(false); onShowCoverageDetail(); }}
						>
							See every section
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/*
			 * The EXISTING cover/preview/apply dialog, on the EXISTING hook. This is
			 * the only apply path on the page: the server re-checks the plan
			 * against the live snapshot when it is applied, which is the safety
			 * c5's removed `isLive` gate used to be asked for.
			 */}
			<CoverShortageDialog
				open={outage.cover.open}
				onOpenChange={(next) => { if (!next) outage.cover.close(); }}
				subjectName={outage.cover.subjectName}
				shortClassCount={openedEntry?.shortClassCount ?? outage.primarySubject?.shortClassCount ?? 0}
				selectedOptionId={outage.cover.selectedOptionId}
				onSelectOption={outage.cover.onSelectOption}
				previews={outage.cover.previews}
				previewClassNames={outage.cover.previewClassNames}
				previewPending={outage.cover.previewPending}
				previewError={outage.cover.previewError}
				drift={outage.cover.drift}
				outcome={outage.cover.outcome}
				applying={outage.cover.applying}
				applyError={outage.cover.applyError}
				writeBlockedReason={writeBlockedReason}
				onPreview={outage.cover.onPreview}
				onApply={outage.cover.onApply}
			/>
		</div>
	);
}

/**
 * ONE action per subject row, and the same control as every other one on the
 * page: a `@/ui` `Button` at `h-8 … text-xs`. The label is the one verb with two
 * counts — a single class is `Assign teacher`, several are `Cover these classes`
 * — because "cover" is a word about load, and an older scheduler is being asked
 * to assign a TEACHER.
 *
 * The saved-roster explanation lives in the existing Tooltip, which is the one
 * place a scheduler reads before pressing a control that changes somebody's
 * load. A DISABLED control is wrapped in a span, because Radix cannot open a
 * tooltip from a control that cannot take focus.
 */
function ShortageAction({
	entry,
	writeBlockedReason,
	figuresVerified,
	totalShortClasses,
	onCover,
	onCovering,
}: {
	entry: SubjectShortageEntry;
	writeBlockedReason: string | null;
	figuresVerified: boolean;
	totalShortClasses: number;
	onCover: (entry: SubjectShortageEntry) => void;
	onCovering: () => void;
}) {
	const single = entry.classNames.length === 1;
	const label = single ? ASSIGN_TEACHER_LABEL : COVER_CLASSES_LABEL;
	const helper = writeBlockedReason
		? writeBlockedReason
		: figuresVerified
			? `${label} in ${entry.subjectName}. ${totalShortClasses} ${totalShortClasses === 1 ? 'class needs' : 'classes need'} a teacher in total.`
			: `${COVER_SAVED_ROSTER_NOTE} ${label} in ${entry.subjectName}. ${totalShortClasses} ${totalShortClasses === 1 ? 'class needs' : 'classes need'} a teacher in total.`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="shrink-0">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 cursor-pointer gap-1.5 px-3 text-xs"
						disabled={Boolean(writeBlockedReason)}
						data-testid={`teaching-load-shortage-assign-${entry.subjectId}`}
						data-subject-id={entry.subjectId}
						onClick={() => { onCovering(); onCover(entry); }}
					>
						<UserRoundPlus className="size-3.5" aria-hidden="true" />
						{label}
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="max-w-80 text-xs font-semibold">
				{helper}
			</TooltipContent>
		</Tooltip>
	);
}
