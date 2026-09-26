import type { ViolationCode } from '@/types';
import { degradeUnnamedRuleValue } from '@/lib/plain-rule-degradation';

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
	/**
	 * LANE-A-VIOLATION-LABEL-GUARD. The server has emitted this code for a
	 * while and already ships operator copy for it
	 * (`constraint-validator.ts` `VIOLATION_COPY.FACULTY_LUNCH_WINDOW_VIOLATION`).
	 * The client did not, so the same rule rendered as the raw engine code on the
	 * Review-issues rail and as `UNLABELLED_RULE_SENTENCE` on Publish Readiness —
	 * one code, two incompatible texts, and a scheduler's reason to distrust the
	 * other 94 warnings beside it.
	 *
	 * THE WORDING IS THE SERVER'S, COPIED VERBATIM, NOT INVENTED HERE. The server
	 * already answered the question this label has to answer ("what does the rule
	 * mean?") in the operator's own words, and ATLAS's stated rule is one plain
	 * word for one idea, stated once. Reusing it is what makes the two surfaces
	 * agree instead of diverging a second time; a second phrasing for one rule
	 * would recreate the defect this entry closes. `warning-readability-c01` now
	 * reads the server's `VIOLATION_CODES` at test time, so every canonical code
	 * — this one and any 27th — is proved to have a client label.
	 */
	FACULTY_LUNCH_WINDOW_VIOLATION: { title: 'Teacher has no free lunch window', meaning: 'The teacher is assigned a class across the lunch window of the grade band they teach, so no free block covers it.', action: 'Move the class out of the lunch window or assign another qualified teacher.' },
	SPECIALIZED_ROOM_UNAVAILABLE: { title: 'Specialized room unavailable', meaning: 'No compatible specialized room was available for this session.', action: 'Free a compatible room, change the time, or review whether specialization is required.' },
	UNASSIGNED_SECTION: { title: 'Section session unassigned', meaning: 'A required section session could not be placed in the timetable.', action: 'Open the unassigned queue and resolve its teacher, room, or time blocker.' },
	ZONE_IMBALANCE_WARNING: { title: 'Campus zone imbalance (retired)', meaning: 'An older run recorded a campus-zone concentration warning that current ATLAS no longer calculates.', action: 'Regenerate with the current policy before acting on this historical warning.' },
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
 * operator surface without touching the underlying math. Bare minute/hour
 * abbreviations become "minutes"/"hours" and shouted weekday names become
 * title case. Teacher/room/section id resolution stays in the lookup
 * helpers, which own the reference maps.
 *
 * Unit tokens expand regardless of what precedes them: legacy stored runs
 * keep wording with words between the number and the unit (e.g. "180
 * consecutive teaching min"), which a digit-adjacent-only pattern misses.
 * The standalone patterns are hyphen-guarded (no word char or hyphen on
 * either side) so Tailwind class tokens such as `min-h-0`, words like
 * `minimum`/`minWidth`, and hyphenated compounds like `135-minute` pass
 * through untouched.
 */
export function formatWarningMessageText(message: string): string {
	return message
		.replace(/(\d+)\s*min(?![\w-])/g, '$1 minutes')
		.replace(/(\d+)\s*h(?![\w-])/g, '$1 hours')
		.replace(/(?<![\w-])min(?![\w-])/g, 'minutes')
		.replace(/(?<![\w-])h(?![\w-])/g, 'hours')
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

/**
 * LANE-C-PLAIN-TOKENS-C04 (J2, P1): the HARD blocker dialog's `delta` line.
 *
 * TRACED FIRST. `HumanConflict.delta` is built on the server in
 * `manual-edit.service.ts` `buildHumanConflicts` and is NOT an id, hash or
 * index — it is a policy-threshold comparison in six fixed shapes, all built
 * from the same three parts joined by " · ":
 *
 *   `Limit: 200 min · Observed: 320 min · Δ +120 min`   (over a limit)
 *   `Target: 360 min · Observed: 400 min · Δ +40 min`    (over a target)
 *   `Required: 10 min · Actual: 4 min · Short by 6 min`  (under a requirement)
 *   `Limit: 3 · Observed: 5 · Δ +2`                      (a count, no unit)
 *   `Target: 2 period(s) · Observed: 0 period(s)`        (periods, no difference)
 *
 * So it already means something without the code and must NOT be dropped. What
 * it cannot keep is the three tokens an older scheduler cannot act on: the `Δ`
 * glyph, the bare `min` abbreviation, and the `period(s)` construct. This
 * rewrites only those and the " · " separator into "; ", and it keeps the
 * server's own labels (`Limit` / `Target` / `Required` / `Observed` /
 * `Actual`) untouched, because relabelling "Observed" as "Scheduled" would be
 * FALSE for the idle-gap and over-compressed shapes, where the observed value is
 * idle time or teaching minutes rather than anything scheduled.
 *
 * `Δ +N` becomes "N over" rather than "N over the limit", because one of the
 * five shapes is measured against a target, not a limit.
 */
export function formatPolicyDeltaText(delta: string): string {
	return delta
		.split(' · ')
		.map((part) => {
			const overage = part.match(/^Δ \+(-?\d+)(?: (min|period\(s\)))?$/);
			if (overage) {
				const amount = Number(overage[1]);
				const unit = overage[2] ? plainUnit(overage[2] as 'min' | 'period(s)', Math.abs(amount)) : '';
				return `${Math.abs(amount)}${unit ? ` ${unit}` : ''} over`;
			}
			return part
				.replace(/(\d+) min\b/g, '$1 minutes')
				.replace(/(\d+) period\(s\)/g, (_whole, count: string) => `${count} ${plainUnit('period(s)', Number(count))}`)
				.replace(/\bperiod\(s\)/g, 'periods');
		})
		.join('; ');
}

function plainUnit(unit: 'min' | 'period(s)', count: number): string {
	if (unit === 'min') return 'minutes';
	return count === 1 ? 'period' : 'periods';
}

/**
 * Historical persisted runs can still carry the retired travel metric code. It
 * has no producer in the canonical set, so it is not in `VIOLATION_TITLES` (and
 * must not be: adding a key the server does not emit would make the "total"
 * map lie about the canonical set). Keep this wire fallback visible here until
 * every such run has aged out — it is the only place a retired code is named.
 */
const LEGACY_VIOLATION_TITLES: Record<string, string> = {
	FACULTY_EXCESSIVE_TRAVEL_DISTANCE: 'Excessive Travel Distance',
};

/**
 * PLAIN-LANGUAGE-J2J3-C01 R1 (B1) — the ONE resolver for a violation title, so
 * no operator surface can fall back to a raw `SCREAMING_SNAKE` enum, and so the
 * same code cannot get two different sentences on two surfaces.
 *
 * Before this, three different fallbacks existed and two of them were visible
 * defects: `RightPanel` rendered `violationLabels[v.code] ?? v.code` (the raw
 * enum) and its tooltip heading rendered `violationLabels[v.code]` with NO
 * fallback at all, so any code missing from the map produced an empty `<p>`
 * heading. The rail's unassigned-reason filters had the same shape.
 *
 * The rule is the shared three-step one in `lib/plain-rule-degradation.ts`: a
 * known code gets its plain title, a retired wire code gets its historical label,
 * an ABSENT code gets the em-dash marker, and anything else — unmapped or
 * out-of-union — gets `UNLABELLED_RULE_SENTENCE`.
 *
 * R1 SUPERSEDES this resolver's previous de-snake-cased fallback
 * (`humaniseEngineToken(code)`). That string was a FALSE degradation for a
 * canonical code space: `"Excessive Travel Distance"` and the shared sentence
 * then described the same retired travel code on two surfaces, and the shipped
 * `timetable-plain-language.ts` prose asserted the opposite rule 200 lines above
 * the code doing it. See `plain-rule-degradation.ts` for the full argument.
 *
 * TOTAL is unchanged and must not regress: it never returns an empty string for
 * a non-empty code, which is precisely what the empty tooltip heading needed. The
 * honest sentence is non-empty, so totality is preserved by the correction rather
 * than traded away for it.
 */
export function resolveViolationTitle(code: string): string {
	const known = VIOLATION_TITLES[code as ViolationCode];
	if (known) return known;
	const legacy = LEGACY_VIOLATION_TITLES[code];
	if (legacy) return legacy;
	return degradeUnnamedRuleValue(code);
}

/**
 * `humaniseEngineToken` — underscores become spaces and the token reads as an
 * ordinary phrase.
 *
 * It is a FREE-FORM TEXT helper, and it is kept exported and unit-covered for
 * that use: a value an operator or a server can genuinely type at will (a
 * `GenerationRun.runType`, which is a free-form `String` column).
 *
 * It is NOT, and must not become, the degradation for a value drawn from a
 * canonical code space. R1 removed exactly that use: a de-snake-cased canonical
 * code is indistinguishable on screen from a real label and contradicts the
 * shared sentence the other surfaces print for the same code. Every canonical
 * resolver goes through `plainRuleValue` / `degradeUnnamedRuleValue` in
 * `lib/plain-rule-degradation.ts` instead.
 */
export function humaniseEngineToken(token: string): string {
	return token.replace(/_/g, ' ').toLowerCase();
}
