/**
 * A2 C12 / ITEM S2 — the READ-ONLY body of a past school year.
 *
 * ## What it is
 * The same read-only published grid the school already publishes for families —
 * `PublishedTimetableMatrix`, the component `PublicPublishedSchedule` renders —
 * plus a term selector over the PAST YEAR'S OWN ordered terms. One grid, one
 * filter bar: this is not a second timetable, and it introduces no grid of its
 * own.
 *
 * ## Why it is read-only BY CONSTRUCTION, not by convention
 * This component imports no mutation surface. There is no placement, no
 * quick-place, no swap, no generate, no publish, no discard, no undo/redo, no
 * manual-edit and no term MUTATION here — only a term SELECTOR that changes which
 * published classes are displayed. `ScheduleReviewWorkspace` does not mount this
 * alongside the editing workspace; it mounts this INSTEAD of it.
 *
 * The visible consequence is that there is no disabled control here at all, so
 * §8's "a disabled control's reason must be visible text" cannot be violated by a
 * hover-only explanation.
 *
 * ## Why the term axis is the PAST YEAR'S (C5 / §7)
 * `orderedTerms` arrives from the past year's own published run — the FROZEN
 * ordered-term contract captured when that year was published. The current year's
 * terms are never substituted, and a year with no resolvable terms never defaults
 * to Term 1: the gate upstream refuses such a read and renders a notice instead,
 * so a missing term identity never becomes Term 1 (§7).
 */
import { PublishedTimetableMatrix, type DayKey, type PublishedScheduleMatrixEntry } from '@/components/published-schedule/PublishedTimetableMatrix';
import { Badge } from '@/ui/badge';
import { Label } from '@/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';

export type PastYearOrderedTerm = { identity: string; displayLabel: string; order: number };

export type PastYearViewMode = 'section' | 'faculty' | 'room';

const VIEW_MODE_LABELS: Record<PastYearViewMode, string> = {
	section: 'By section',
	faculty: 'By teacher',
	room: 'By room',
};

const VIEW_MODES: PastYearViewMode[] = ['section', 'faculty', 'room'];

const VIEW_MODE_DIMENSION: Record<PastYearViewMode, keyof PublishedScheduleMatrixEntry> = {
	section: 'section',
	faculty: 'faculty',
	room: 'room',
};

/** Class counts per view mode, so the operator can see the year is populated. */
function countBy(entries: PublishedScheduleMatrixEntry[], dimension: keyof PublishedScheduleMatrixEntry): number {
	const names = new Set<string>();
	for (const entry of entries) {
		const value = entry[dimension];
		if (value && typeof value === 'object' && 'name' in value && value.name) names.add(value.name);
	}
	return names.size;
}

export function SimplePastYearReadOnlySurface({
	yearLabel,
	entries,
	orderedTerms,
	termIndex,
	onTermIndexChange,
	viewMode,
	onViewModeChange,
	dayFilter = 'all',
}: {
	yearLabel: string;
	entries: PublishedScheduleMatrixEntry[];
	/** The PAST YEAR'S OWN ordered terms, from its frozen published contract. */
	orderedTerms: readonly PastYearOrderedTerm[];
	termIndex: number;
	onTermIndexChange: (order: number) => void;
	viewMode: PastYearViewMode;
	onViewModeChange: (mode: PastYearViewMode) => void;
	dayFilter?: DayKey | 'all';
}) {
	// §7 — a year whose terms did not resolve has no term axis. It is NOT Term 1.
	const hasTerms = orderedTerms.length > 0;
	const selectedTerm = orderedTerms.find((term) => term.order === termIndex) ?? null;

	return (
		<div
			className="flex min-h-0 flex-1 flex-col overflow-auto"
			data-testid="timetable-past-year-readonly-surface"
			// Declared, not implied: the term axis came from the PAST YEAR.
			data-term-source="past-year-own-terms"
			data-school-year-label={yearLabel}
		>
			{/* The year is stated in VISIBLE TEXT here, not only on a data attribute.
			    The banner is the first thing on screen, but an operator who has
			    scrolled into the grid must still be able to say which year they are
			    looking at without scrolling back up. */}
			<div className="flex flex-wrap items-baseline gap-2 px-4 pt-3">
				<h2 className="text-sm font-semibold text-foreground" data-testid="timetable-past-year-surface-heading">
					{yearLabel} timetable
				</h2>
				<p className="text-xs text-muted-foreground">Read-only · published schedule</p>
			</div>

			{/* One filter bar: the term axis and the view axis. Nothing here writes. */}
			<div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-2.5">
				<div className="flex flex-col gap-1">
					<Label htmlFor="past-year-term" className="text-xs text-muted-foreground">Term</Label>
					<Select
						value={hasTerms ? String(termIndex) : undefined}
						// No silent Term 1: with no resolvable terms the control is empty
						// and says so, rather than defaulting to a term nobody verified.
						disabled={!hasTerms}
						onValueChange={(value) => onTermIndexChange(Number(value))}
					>
						<SelectTrigger id="past-year-term" className="h-9 w-40" data-testid="timetable-past-year-term-filter" aria-label={`Term in ${yearLabel}`}>
							<SelectValue placeholder={hasTerms ? undefined : 'No terms available'} />
						</SelectTrigger>
						<SelectContent>
							{orderedTerms.map((term) => (
								<SelectItem key={term.identity} value={String(term.order)}>
									{term.displayLabel}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-1">
					<Label htmlFor="past-year-view-mode" className="text-xs text-muted-foreground">Show</Label>
					<Select value={viewMode} onValueChange={(value) => onViewModeChange(value as PastYearViewMode)}>
						<SelectTrigger id="past-year-view-mode" className="h-9 w-44" data-testid="timetable-past-year-view-mode" aria-label="How to group the past year timetable">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{VIEW_MODES.map((mode) => (
								<SelectItem key={mode} value={mode}>
									{VIEW_MODE_LABELS[mode]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-wrap items-center gap-2 pb-1">
					<Badge variant="secondary" data-testid="timetable-past-year-class-count">
						{entries.length} {entries.length === 1 ? 'class' : 'classes'}
					</Badge>
					<Badge variant="secondary">{countBy(entries, VIEW_MODE_DIMENSION[viewMode])} {VIEW_MODE_LABELS[viewMode].toLowerCase()}</Badge>
					{selectedTerm ? <Badge variant="outline" data-testid="timetable-past-year-term-label">{selectedTerm.displayLabel}</Badge> : null}
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-auto p-4">
				<PublishedTimetableMatrix
					entries={entries}
					dayFilter={dayFilter}
					emptyMessage={`No published classes in ${yearLabel}${selectedTerm ? ` · ${selectedTerm.displayLabel}` : ''} for this view.`}
					// Read-only detail: the published identities, and nothing that acts.
					renderEntryDetails={(entry) => (
						<div className="space-y-0.5 text-xs">
							<p className="font-medium">{entry.subject.name} ({entry.subject.code})</p>
							{entry.section ? <p className="text-muted-foreground">Section: {entry.section.name}</p> : null}
							{entry.faculty ? <p className="text-muted-foreground">Teacher: {entry.faculty.name}</p> : null}
							{entry.room ? <p className="text-muted-foreground">Room: {entry.room.name}</p> : null}
						</div>
					)}
				/>
			</div>
		</div>
	);
}
