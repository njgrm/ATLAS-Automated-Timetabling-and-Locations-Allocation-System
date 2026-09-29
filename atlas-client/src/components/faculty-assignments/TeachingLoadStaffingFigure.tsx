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

import { CoverClassDialog } from '@/components/faculty-assignments/CoverClassDialog';
import { CoverShortageDialog } from '@/components/faculty-assignments/CoverShortageDialog';
import { COVER_CLASSES_LABEL, COVER_SAVED_ROSTER_NOTE } from '@/components/faculty-assignments/TeachingLoadShortageLine';
import {
	buildStaffingFigureLabel,
	formatSavedRosterNote,
	type SubjectShortageEntry,
} from '@/components/faculty-assignments/teachingLoadOutage';
import type { useTeachingLoadOutage } from '@/hooks/useTeachingLoadOutage';

type Outage = ReturnType<typeof useTeachingLoadOutage>;

/**
 * A6 c10 — the single-class action, in the packet's own words. Not reworded:
 * `Cover this class` and `Cover these classes` are two different acts on two
 * different nouns, and merging them was the "one label, two meanings" defect.
 */
export const COVER_THIS_CLASS_LABEL = 'Cover this class';

export { COVER_CLASSES_LABEL };

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
	 * Which subject the to-be-hired dialog opens on. The window's last-resort
	 * link hands over the class in front of the scheduler, and the existing
	 * dialog is subject-shaped — so the class's own subject entry is what it
	 * needs, and it is read from the SAME shortage list this window rendered, so
	 * the two dialogs can never describe different subjects.
	 */
	const [openedEntry, setOpenedEntry] = useState<SubjectShortageEntry | null>(null);
	const coverClassSubjectEntry = outage.coverClass.target
		? outage.shortage.entries.find((entry) => entry.subjectId === outage.coverClass.target?.subjectId) ?? null
		: null;
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
										data-testid={`teaching-load-shortage-subject-${entry.subjectId}`}
									>
										{/*
										 * A6 c10 — THE SUBJECT IS A HEADING NOW, NOT A ROW.
										 *
										 * c9 rendered one row per subject with its classes joined
										 * into a sentence and ONE action for all of them, which
										 * meant the scheduler could see WHICH classes were open
										 * and could not cover any of them one at a time. The Codex
										 * audit's `clicks-to-cover-with-real-teacher: 0` is that
										 * sentence. So the subject name is now a quiet group
										 * heading and every CLASS below it is a row with its own
										 * `Cover this class` — the action the packet names, on the
										 * thing the packet names.
										 */}
										<h3 className="pt-2 text-xs font-bold uppercase text-muted-foreground">
											{entry.subjectName}
											<span className="ml-1.5 font-semibold normal-case text-muted-foreground">
												{entry.shortClassCount} {entry.shortClassCount === 1 ? 'class' : 'classes'}
											</span>
										</h3>
										<ul className="mt-0.5">
											{entry.classes.map((openClass) => (
												<li
													key={`${entry.subjectId}-${openClass.sectionId}`}
													className="flex items-center justify-between gap-3 py-1.5"
													data-testid={`teaching-load-shortage-class-${openClass.sectionId}`}
												>
													<p className="min-w-0 truncate text-sm text-foreground">
														<span className="font-medium">{openClass.name}</span>
														<span className="text-muted-foreground"> · Grade {openClass.gradeLevel}</span>
													</p>
													<CoverClassAction
														figuresVerified={outage.figuresVerified}
														writeBlockedReason={writeBlockedReason}
														onCover={() => {
															setWindowOpen(false);
															outage.openCoverClassFor(entry, openClass);
														}}
													/>
												</li>
											))}
										</ul>
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
			{/*
			 * A6 c10 — THE PER-CLASS WINDOW, on the page's own `outage` handle.
			 * It is mounted HERE rather than in `TeachingLoadOutageSurface` because
			 * its opener is this window's rows: the same reason the class list
			 * lives in this file. The last-resort control hands the subject to the
			 * EXISTING to-be-hired dialog above — this window creates nobody.
			 */}
			<CoverClassDialog
				cover={outage.coverClass}
				writeBlockedReason={writeBlockedReason}
				onAddToBeHired={() => {
					const entry = coverClassSubjectEntry ?? outage.primarySubject;
					if (!entry) return;
					outage.coverClass.close();
					setOpenedEntry(entry);
					outage.cover.openFor(entry);
				}}
			/>
		</div>
	);
}

/**
 * ONE action per class, and the exact words the packet names.
 *
 * `Cover this class` is a VERB plus its object, which is what makes a control
 * look pressable; the old `Assign teacher` was chosen because "cover" reads as a
 * word about load, and the operator's own sentence about this flow is about
 * covering a CLASS. It is the same `@/ui/button` `outline` at `h-8 … text-xs` as
 * every other row-2 and row-3 control on the page, so it is the same control
 * (AGENTS.md §8 "one look per control") and no local chrome is introduced.
 *
 * The saved-roster explanation stays in the Tooltip, which is the one place a
 * scheduler reads before pressing a control that changes somebody's load. A
 * DISABLED control is wrapped in a span, because Radix cannot open a tooltip
 * from a control that cannot take focus.
 */
function CoverClassAction({
	figuresVerified,
	writeBlockedReason,
	onCover,
}: {
	figuresVerified: boolean;
	writeBlockedReason: string | null;
	onCover: () => void;
}) {
	const helper = writeBlockedReason
		? writeBlockedReason
		: figuresVerified
			? 'Open the list of teachers who can take this class.'
			: `${COVER_SAVED_ROSTER_NOTE} Open the list of teachers who can take this class.`;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="shrink-0">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 shrink-0 cursor-pointer gap-1.5 px-3 text-xs"
						disabled={Boolean(writeBlockedReason)}
						data-testid="teaching-load-cover-this-class"
						onClick={onCover}
					>
						<UserRoundPlus className="size-3.5" aria-hidden="true" />
						{COVER_THIS_CLASS_LABEL}
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent side="bottom" className="max-w-80 text-xs font-semibold">
				{helper}
			</TooltipContent>
		</Tooltip>
	);
}
