import type { ViolationCode } from '@/types';

export type ViolationPresentation = {
	title: string;
	meaning: string;
	action: string;
};

export const VIOLATION_PRESENTATION: Record<ViolationCode, ViolationPresentation> = {
	FACULTY_TIME_CONFLICT: { title: 'Teacher double-booked', meaning: 'One teacher is assigned to overlapping classes.', action: 'Move one class or assign another qualified teacher.' },
	ROOM_TIME_CONFLICT: { title: 'Room double-booked', meaning: 'Two classes use the same room at the same time.', action: 'Move one class to a free room or time.' },
	SECTION_TIME_CONFLICT: { title: 'Section double-booked', meaning: 'Students in one section have overlapping classes.', action: 'Move one of the section’s classes to another time.' },
	FACULTY_OVERLOAD: { title: 'Teacher above weekly load', meaning: 'The teacher’s scheduled hours exceed the saved weekly maximum.', action: 'Redistribute classes to another qualified teacher or review the saved load limit.' },
	ROOM_TYPE_MISMATCH: { title: 'Room type does not fit', meaning: 'The assigned room type does not match the subject’s room requirement.', action: 'Choose a compatible room or correct the subject’s room requirement.' },
	ROOM_FEATURE_MISMATCH: { title: 'Room Feature Mismatch', meaning: 'The assigned room lacks equipment or features required by the subject.', action: 'Choose a room with the required features or correct the room inventory.' },
	ROOM_CAPACITY_EXCEEDED: { title: 'Room may be too small', meaning: 'The section’s learner count is above the room’s recorded capacity.', action: 'Choose a larger room or verify the room capacity and learner count.' },
	FACULTY_SUBJECT_NOT_QUALIFIED: { title: 'Teaching assignment needs review', meaning: 'The saved teaching load does not authorize this teacher for the subject and section.', action: 'Review Teaching Load and assign an authorized teacher.' },
	FACULTY_CONSECUTIVE_LIMIT_EXCEEDED: { title: 'Long teaching block', meaning: 'The teacher has more consecutive class periods than the scheduling policy allows.', action: 'Insert a break or move one period to shorten the consecutive block.' },
	FACULTY_BREAK_REQUIREMENT_VIOLATED: { title: 'Break is too short', meaning: 'The gap after a long teaching block is shorter than the required break.', action: 'Extend the break or move an adjacent class.' },
	FACULTY_DAILY_STANDARD_EXCEEDED: { title: 'Daily teaching target exceeded', meaning: 'The teacher is above the preferred daily teaching target but below the hard cap.', action: 'Move a class to another day when a more balanced placement is available.' },
	FACULTY_DAILY_MAX_EXCEEDED: { title: 'Daily teaching maximum exceeded', meaning: 'The teacher’s classes exceed the maximum teaching minutes allowed for one day.', action: 'Move or reassign at least one class on that day.' },
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: { title: 'Excessive Travel Distance', meaning: 'An older run recorded a distance-based warning that current ATLAS no longer calculates.', action: 'Regenerate with the current policy before acting on this historical warning.' },
	FACULTY_FLOOR_TRANSITION: { title: 'Cross-Floor Transition', meaning: 'The teacher finishes on one floor and starts on another without enough time to move.', action: 'Add a gap or place one of the classes on the same floor.' },
	FACULTY_EXCESSIVE_BUILDING_TRANSITIONS: { title: 'Too many building changes', meaning: 'The teacher changes buildings more often in one day than the policy recommends.', action: 'Cluster the teacher’s classes in fewer buildings.' },
	FACULTY_INSUFFICIENT_TRANSITION_BUFFER: { title: 'Not enough time between buildings', meaning: 'Back-to-back classes leave too little time for the teacher to change buildings.', action: 'Add a free period or place the classes in the same building.' },
	FACULTY_EXCESSIVE_IDLE_GAP: { title: 'Long idle gap', meaning: 'The teacher has a long unscheduled gap between classes.', action: 'Move classes closer together when this does not create a harder conflict.' },
	FACULTY_EARLY_START_PREFERENCE: { title: 'Starts earlier than preferred', meaning: 'The teacher’s first class begins earlier than their recorded preference.', action: 'Move the first class later when another valid slot is available.' },
	FACULTY_LATE_END_PREFERENCE: { title: 'Ends later than preferred', meaning: 'The teacher’s last class ends later than their recorded preference.', action: 'Move the last class earlier when another valid slot is available.' },
	FACULTY_INSUFFICIENT_DAILY_VACANT: { title: 'Too little preparation time', meaning: 'The teacher has fewer free periods than the daily preparation target.', action: 'Redistribute a class or move it to another day.' },
	SPECIALIZED_ROOM_UNAVAILABLE: { title: 'Specialized room unavailable', meaning: 'No compatible specialized room was available for this session.', action: 'Free a compatible room, change the time, or review whether specialization is required.' },
	UNASSIGNED_SECTION: { title: 'Section session unassigned', meaning: 'A required section session could not be placed in the timetable.', action: 'Open the unassigned queue and resolve its teacher, room, or time blocker.' },
	ZONE_IMBALANCE_WARNING: { title: 'Campus zone concentration', meaning: 'Too many selected-term classes are concentrated in one configured campus zone.', action: 'Rebalance rooms across configured zones or explicitly accept the concentration.' },
	SECTION_OVERCOMPRESSED: { title: 'Section day is too compressed', meaning: 'The section has too many consecutive class periods without a sufficient break.', action: 'Spread the section’s classes or add a break.' },
	LACKING_FACULTY: { title: 'No teacher available', meaning: 'A required session has no qualified teacher available.', action: 'Assign a qualified teacher in Teaching Load or free an authorized teacher’s schedule.' },
	INCOMPLETE_MODULAR_GROUP: { title: 'Rotating subject group incomplete', meaning: 'A rotating subject family is missing a required term-specific member or assignment.', action: 'Complete the rotating subject, teacher, and room assignments for every ordered term.' },
};

export function getViolationPresentation(code: ViolationCode): ViolationPresentation {
	return VIOLATION_PRESENTATION[code];
}

const WEEKDAY_TITLE: Record<string, string> = {
	MONDAY: 'Monday',
	TUESDAY: 'Tuesday',
	WEDNESDAY: 'Wednesday',
	THURSDAY: 'Thursday',
	FRIDAY: 'Friday',
	SATURDAY: 'Saturday',
	SUNDAY: 'Sunday',
};

/**
 * WARNING-READABILITY-C01 (R2): normalize a raw validator message for the
 * operator surface without touching the underlying math. Bare minute
 * abbreviations become "minutes" and shouted weekday names become title
 * case. Teacher/room/section id resolution stays in the lookup helpers,
 * which own the reference maps.
 */
export function formatWarningMessageText(message: string): string {
	return message
		.replace(/(\d+)\s*min\b/g, '$1 minutes')
		.replace(/(\d+)\s*h\b/g, '$1 hours')
		.replace(/\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\b/g, (day) => WEEKDAY_TITLE[day] ?? day);
}

/**
 * WARNING-READABILITY-C01-R1 (F1): map-less identity fallback for operator
 * surfaces that render a raw validator message without reference maps (the
 * explainability drawer default, the manual-edit panel). Where lookup maps
 * exist, callers resolve known ids to names FIRST (see
 * useTimetableLookupHelpers.formatConstraintMessage and the rail formatter);
 * this only guarantees that no `Faculty 16`-style raw id ever reaches
 * operator-visible text. It must stay separate from
 * formatWarningMessageText so the map-backed paths keep resolving real
 * names instead of degrading to the fallback.
 */
export function formatIdentityFallbackText(message: string): string {
	return message
		.replace(/\bfaculty\s+#?\d+\b/gi, 'this teacher')
		.replace(/\bsubject\s+#?\d+\b/gi, 'this subject')
		.replace(/\bsection\s+#?\d+\b/gi, 'this section')
		.replace(/\broom\s+#?\d+\b/gi, 'this room');
}

/**
 * WARNING-READABILITY-C01 (R7): order warning groups so HARD blockers lead
 * and soft comfort metrics never visually compete with them. Stable: groups
 * of equal severity keep their incoming order.
 */
export function sortViolationGroupsHardFirst<T extends { severity?: string }>(
	groups: Array<[ViolationCode, T[]]>,
): Array<[ViolationCode, T[]]> {
	return [...groups]
		.map((entry, index) => ({ entry, index }))
		.sort((left, right) => {
			const leftHard = left.entry[1].some((item) => item.severity === 'HARD') ? 0 : 1;
			const rightHard = right.entry[1].some((item) => item.severity === 'HARD') ? 0 : 1;
			if (leftHard !== rightHard) return leftHard - rightHard;
			return left.index - right.index;
		})
		.map(({ entry }) => entry);
}

export const VIOLATION_TITLES: Record<ViolationCode, string> = Object.fromEntries(
	Object.entries(VIOLATION_PRESENTATION).map(([code, copy]) => [code, copy.title]),
) as Record<ViolationCode, string>;
