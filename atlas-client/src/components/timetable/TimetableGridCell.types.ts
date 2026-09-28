/**
 * A2-C7 item 3(a) — the grid cell's prop contract, extracted from
 * `TimetableGrid.tsx`.
 *
 * `TimetableGrid.tsx` was at exactly 995 physical lines, so the blocked-window fix
 * pushed it to 1011 and the repository's own cap guard (`timetable-relaxed-main`
 * B5, "no non-test component anywhere under src exceeds the 1000-physical-line
 * cap") failed. The 1000-line cap exists because `TimetableGrid.tsx` had to be
 * extracted rather than inlined once already (AGENTS.md §8), and it is not
 * negotiable.
 *
 * This is a TYPE with no behaviour, so the move is invisible at runtime: erased
 * at compile time, no bundle change, no render change. It was chosen over
 * extracting logic because a type move cannot introduce a behavioural regression
 * into the most safety-critical rendering path in the product on the day a
 * truthfulness fix is being made.
 *
 * `TimetableGrid.tsx` re-exports `GridCellProps`, so no importer has to change.
 */
import type { CellConflictInfo, ScheduledEntry, Violation } from '@/types';

export interface GridCellProps {
	cellId: string;
	day: string;
	startTime: string;
	endTime: string;
	cellEntries: ScheduledEntry[];
	isSpecialEvent: boolean;
	eventName?: string;
	/** When present, the event blocks only this weekday. */
	eventDayOfWeek?: string;
	hasKbSource: boolean;
	violationIndex: Map<string, Violation[]>;
	highlightedEntryIds: Set<string>;
	swapClassAEntryId?: string | null;
	swapClassBEntryId?: string | null;
	teacherDepartureEntryIds?: Set<string>;
	localSandboxChangedEntryIds?: Set<string>;
	localSandboxConflictEntryIds?: Set<string>;
	selectedEntry: ScheduledEntry | null;
	followUps: Set<string>;
	onEntryClick: (entry: ScheduledEntry) => void;
	subjectLabel: (id: number) => string;
	sectionLabel: (id: number) => string;
	gradeForSection: (sectionId: number) => number | null;
	entryContextLabel: (entry: ScheduledEntry) => string;
	formatFacultyInitials: (id: number) => string;
	facultyLabel: (id: number) => string;
	viewMode: 'section' | 'faculty' | 'room';
	/** Selected ordered-term scope. Resolves the teacher from the entry in that term. */
	termFilter?: 'all' | number;
	/**
	 * A2 — resolves the visible ordered-term label for an entry. Only consulted
	 * under the `All terms` comparison scope, where stacked entries from
	 * different terms must be distinguishable.
	 */
	termLabelFor?: (termIndex: number | null | undefined) => string | null;
	/** A8 — the active review set annotates, but never hides, selected-term warnings. */
	reviewEntryIds?: ReadonlySet<string>;
	formatWarningMessage?: (message: string, violation?: Violation) => string;
	showTeacherDetails?: boolean;
	pivotLabel: (id: number) => string;
	roomLabelShort: (roomId: number) => string;
	onKbPlace: (day: string, startTime: string, endTime: string) => void;
	onKbPlaceStart?: () => void;
	getCellConflict: ((cellId: string) => CellConflictInfo | null) | null;
	fullPreviewInfo: CellConflictInfo | null;
	onNavToFaculty: (id: number) => void;
	onNavToSection: (id: number) => void;
	onNavToRoom: (id: number) => void;
	onReassignTeacher?: (entry: ScheduledEntry) => void;
	simpleMode?: boolean;
	readOnly?: boolean;
}
