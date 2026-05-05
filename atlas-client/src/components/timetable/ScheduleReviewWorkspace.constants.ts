import type {
	DraftPlacement,
	DraftQueueItem,
	ScheduledEntry,
	UnassignedItem,
	ViolationCode,
} from '@/types';

export const DEFAULT_SCHOOL_ID = 1;

export const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
export const DAY_SHORT: Record<string, string> = {
	MONDAY: 'Mon',
	TUESDAY: 'Tue',
	WEDNESDAY: 'Wed',
	THURSDAY: 'Thu',
	FRIDAY: 'Fri',
};

export const VIOLATION_LABELS: Record<ViolationCode, string> = {
	FACULTY_TIME_CONFLICT: 'Faculty Time Conflict',
	ROOM_TIME_CONFLICT: 'Room Time Conflict',
	FACULTY_OVERLOAD: 'Faculty Overload',
	ROOM_TYPE_MISMATCH: 'Room Type Mismatch',
	FACULTY_SUBJECT_NOT_QUALIFIED: 'Not Qualified',
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: 'Consecutive Limit',
	FACULTY_BREAK_REQUIREMENT_VIOLATED: 'Break Requirement',
	FACULTY_DAILY_MAX_EXCEEDED: 'Daily Max Exceeded',
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: 'Excessive Building Transitions',
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: 'Insufficient Transition Buffer',
	FACULTY_EXCESSIVE_IDLE_GAP: 'Excessive Idle Gap',
	FACULTY_EARLY_START_PREFERENCE: 'Early Start Preference',
	FACULTY_LATE_END_PREFERENCE: 'Late End Preference',
	FACULTY_INSUFFICIENT_DAILY_VACANT: 'Insufficient Daily Vacant',
	SECTION_OVERCOMPRESSED: 'Section Overcompressed',
	ROOM_CAPACITY_EXCEEDED: 'Room Capacity Exceeded',
	SESSION_PATTERN_VIOLATED: 'Session Pattern Violated',
};

export const CONFLICT_CODES: Set<ViolationCode> = new Set([
	'FACULTY_TIME_CONFLICT',
	'ROOM_TIME_CONFLICT',
]);

export const WELLBEING_CODES: Set<ViolationCode> = new Set([
	'FACULTY_EXCESSIVE_TRAVEL_DISTANCE',
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
export type CenterViewMode = 'schedule' | 'pre-generation' | 'policy' | 'manual-edit' | 'map' | 'building';
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
	displacementMode: 'to-queue';
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
		content: 'Two panels here: Violations shows constraint issues, Unassigned shows sessions that couldn\'t be placed. Both need attention before you can publish.',
	},
	{
		target: '[data-tutorial="grid-controls"]',
		title: 'Grid Controls & Filters',
		content: 'Switch between Section, Faculty, or Room views. Use severity filters to focus on what matters most.',
	},
	{
		target: '[data-tutorial="center-grid"]',
		title: 'Timetable Grid',
		content: 'Click any entry in the grid to see its details. Drag entries or unassigned items to different slots. The system will preview the impact before applying.',
	},
	{
		target: '[data-tutorial="manual-edit-actions"]',
		title: 'Manual Edit Actions',
		content: 'Select an entry, then use these buttons to move its timeslot, change room, or reassign faculty. Every edit shows a preview first.',
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
	faculty: 'Faculty',
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
	NO_QUALIFIED_FACULTY: { label: 'No Qualified Faculty', className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 dark:border-red-800' },
	FACULTY_OVERLOADED: { label: 'Faculty Overloaded', className: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
	NO_AVAILABLE_SLOT: { label: 'No Available Slot', className: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' },
	NO_COMPATIBLE_ROOM: { label: 'No Compatible Room', className: 'border-purple-300 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' },
};
