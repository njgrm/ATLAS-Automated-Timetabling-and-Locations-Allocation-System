import type {
	DraftPlacement,
	DraftQueueItem,
	ScheduledEntry,
	UnassignedItem,
	ViolationCode,
} from '@/types';
import { VIOLATION_TITLES } from '@/lib/violation-presentation';


export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
export const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

/**
 * The rail's violation labels are the ONE plain title per code, owned by
 * `lib/violation-presentation.ts` and reused verbatim here.
 *
 * PLAIN-LANGUAGE-J2J3-C01 (J2) — this used to be a SECOND, hand-written
 * `Record<ViolationCode, string>` of terser engine nouns ("Teacher Time
 * Conflict", "Lacking Teacher", "Consecutive Limit"). The same code therefore
 * had two operator names depending on which surface resolved it: the rail said
 * "Lacking Teacher" where the grid badge and the explainability drawer said "No
 * teacher available". Two maps over one union is exactly the drift J1 exists to
 * remove, and the duplicate was free to fall behind the canonical set.
 *
 * The typed union is preserved: `VIOLATION_TITLES` is itself
 * `Record<ViolationCode, string>`, so this annotation still makes the map
 * TOTAL — a new `ViolationCode` member is a compile error here, exactly as
 * before. Totality is therefore not weakened by the collapse.
 *
 * The retired zone warning keeps its neutral historical label. `ZONE-WARNING-
 * REMOVAL-C01` requires the complete rail record to keep a neutral historical
 * noun (not an action) so stored rows still render, and the canonical
 * presentation title is "Campus zone imbalance (retired)" — the same neutral
 * historical noun, plus the fact that it is retired. The committed row
 * `warning-readability-c01.test.ts` asserts /campus zone/i on this map.
 */
export const VIOLATION_LABELS: Record<ViolationCode, string> = VIOLATION_TITLES;

export const CONFLICT_CODES: Set<ViolationCode> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
	'SECTION_TIME_CONFLICT',
]);

export const WELLBEING_CODES: Set<ViolationCode> = new Set([
	'FACULTY_FLOOR_TRANSITION',
	'FACULTY_EXCESSIVE_BUILDING_TRANSITIONS',
	'FACULTY_INSUFFICIENT_TRANSITION_BUFFER',
	'FACULTY_EXCESSIVE_IDLE_GAP',
	'FACULTY_EARLY_START_PREFERENCE',
	'FACULTY_LATE_END_PREFERENCE',
]);

export const GRADE_BADGE: Record<number, string> = {
	7: 'bg-green-100 text-green-700 border-green-300',
	8: 'bg-yellow-100 text-yellow-700 border-yellow-300',
	9: 'bg-red-100 text-red-700 border-red-300',
	10: 'bg-blue-100 text-blue-700 border-blue-300',
};
export const GRADE_CARD_BG: Record<number, string> = {
	7: 'bg-green-50/60 border-green-200/80',
	8: 'bg-yellow-50/60 border-yellow-200/80',
	9: 'bg-red-50/60 border-red-200/80',
	10: 'bg-blue-50/60 border-blue-200/80',
};

export type SeverityFilter = 'all' | 'hard' | 'soft' | 'conflicts' | 'wellbeing';
export type ViewMode = 'section' | 'faculty' | 'room';
export type CenterViewMode = 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building' | 'runs' | 'setup';
export type PreGenDragSource =
	| { type: 'draftQueue'; item: DraftQueueItem }
	| { type: 'draftPlacement'; placement: DraftPlacement };

export function isDraftPlacementSource(source: PreGenDragSource): source is { type: 'draftPlacement'; placement: DraftPlacement } {
	return source.type === 'draftPlacement';
}

export type DragSource =
	| { type: 'entry'; entry: ScheduledEntry }
	| { type: 'unassigned'; item: UnassignedItem }
	| PreGenDragSource
	| null;

export type PreGenPendingPlacement = {
	placementId?: number;
	entryKind: 'SECTION' | 'COHORT';
	sectionId: number;
	subjectId: number;
	facultyId: number;
	roomId: number;
	day: string;
	startTime: string;
	endTime: string;
	cohortCode?: string | null;
	notes?: string | null;
	expectedVersion?: number;
	sourceLabel: string;
};

export type PendingSwapAction = {
	source: PreGenDragSource;
	target: {
		day: string;
		startTime: string;
		endTime: string;
		facultyId: number;
		roomId: number;
	};
	displaced: DraftPlacement;
	/**
	 * 'to-source-slot': source is a draftPlacement → true two-way swap (displaced moves to source's original slot).
	 * 'to-queue': source is a draftQueue item → displaced is unassigned/returned to queue.
	 */
	displacementMode: 'to-queue' | 'to-source-slot';
	sourceLabel: string;
};

/** Enriched room info for display (includes parent building context) */
export type RoomInfo = {
	id: number;
	name: string;
	buildingId: number;
	buildingName: string;
	buildingShortCode: string | null;
	floor: number;
	type: string;
	isTeachingSpace: boolean;
	// A2-CUSTODY: this copy is the declared type of the workspace `roomMap`
	// state, which `useTimetableData` fills and `useTimetableMutations` reads.
	// It declared nine fields while the producer copied nine, so both sides
	// agreed — and neither mentioned `features`, which the server sends on
	// every room. `useTimetableData`'s copy now declares the field, and this
	// state type has to carry it too or the two stop being interchangeable.
	features: string[];
};

export const TUTORIAL_STEPS = [
	{
		target: '[data-tutorial="run-selector"]',
		title: 'Run Selector',
		content: 'Pick which generation run to review. "Latest Run" is selected by default. Each run is a separate scheduling attempt.',
	},
	{
		target: '[data-tutorial="left-tabs"]',
		title: 'Violations & Unassigned',
		content: 'Violations shows constraint issues. Unassigned is a residual diagnostics queue; use recovery tools only when you need to clear blocked sessions.',
	},
	{
		target: '[data-tutorial="grid-controls"]',
		title: 'Grid Controls & Filters',
		content: 'Switch between Section, Teacher, or Room views. Use severity filters to focus on what matters most.',
	},
	{
		target: '[data-tutorial="center-grid"]',
		title: 'Timetable Grid',
		content: 'Click any entry in the grid to see its details. Drag entries to repair placements; treat unassigned items as exceptions that need review, not as the normal finishing step.',
	},
	{
		target: '[data-tutorial="manual-edit-actions"]',
		title: 'Manual Edit Actions',
		content: 'Select an entry, then use these buttons to move its timeslot, change room context, or repair Teaching Load ownership. Every edit shows a preview first.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
	{
		target: '[data-tutorial="policy-btn"]',
		title: 'Scheduling Policy',
		content: 'Open the policy pane to adjust constraint weights, teaching limits, break requirements, and more. Changes affect the next generation run.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
	{
		target: '[data-tutorial="undo-btn"]',
		title: 'History & Undo',
		content: 'Every manual edit is tracked. Use Undo to revert the last change, or view the full edit history.',
		roles: ['admin', 'officer', 'SYSTEM_ADMIN'],
	},
];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
	section: 'Section',
	faculty: 'Teacher',
	room: 'Room',
};

export const PROGRAM_FILTER_OPTIONS = [
	{ value: 'all', label: 'All Programs' },
	{ value: 'REGULAR', label: 'Regular' },
	{ value: 'SPECIAL', label: 'Any Special Program' },
	{ value: 'STE', label: 'STE' },
	{ value: 'SPA', label: 'SPA' },
	{ value: 'SPS', label: 'SPS' },
	{ value: 'SPJ', label: 'SPJ' },
	{ value: 'SPFL', label: 'SPFL' },
	{ value: 'SPTVE', label: 'SPTVE' },
	{ value: 'OTHER', label: 'Other' },
] as const;

export const ENTRY_KIND_FILTER_OPTIONS = [
	{ value: 'all', label: 'All Entries' },
	{ value: 'section', label: 'Section Entries' },
	{ value: 'cohort', label: 'Cohort Entries' },
] as const;

export const UNASSIGNED_REASON_LABELS: Record<string, { label: string; className: string }> = {
	NO_QUALIFIED_FACULTY: { label: 'No Qualified Teacher', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
	FACULTY_OVERLOADED: { label: 'Teacher Overloaded', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
	NO_AVAILABLE_SLOT: { label: 'No Available Slot', className: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
	ROOM_CAPACITY_EXCEEDED: { label: 'Room Capacity Exceeded', className: 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
	NO_COMPATIBLE_ROOM: { label: 'No Compatible Room', className: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
};
