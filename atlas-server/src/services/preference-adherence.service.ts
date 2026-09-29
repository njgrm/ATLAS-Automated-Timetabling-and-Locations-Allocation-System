/**
 * A2 C17 — "were teacher preferences kept?", computed ON READ.
 *
 * WHY THIS IS NOT PART OF THE RUN SUMMARY. Generation honours REVIEWED teacher
 * availability (`UNAVAILABLE` is a HARD exclusion, `PREFERRED` is a ranked SOFT
 * signal), but nothing tells the scheduler whether it did. The obvious place to
 * put the answer — a field snapshotted into `RunSummary` at generation time — is
 * wrong twice over: it would be stale the moment a scheduler drags a class, and
 * it would need a rewrite when the run is re-published. So the answer is derived
 * from the run's CURRENT placed entries every time it is read. This module is the
 * ONE derivation; the route reads it, the client renders it, and neither may
 * compute a second version.
 *
 * THE OVERLAP RULE IS NOT INVENTED HERE. It is `intervalsOverlap` from
 * `timetable-candidate-domain.js` — the exact helper `schedule-constructor.ts`
 * imports for its `UNAVAILABLE` exclusion — so "kept" means the same thing here as
 * "excluded" does there. A looser rule in this file would let a 15-minute
 * preference read as honoured while the constructor treated it as a violation.
 *
 * WHAT COUNTS AS A "TIME". The availability picker paints at 15-minute
 * granularity (`AvailabilityPicker.tsx` `STEP_MINUTES`), so one thing a scheduler
 * asked for — "not Friday afternoon" — is stored as ~24 slot rows. Counting raw
 * rows would render "16 of 16 unavailable times kept", which is noise, not an
 * answer. Contiguous/overlapping slots on one day therefore collapse into one
 * window, and ONE WINDOW IS THE ONLY UNIT ANYWHERE.
 *
 * ── ONE UNIT, OR NO RATIO ──────────────────────────────────────────────────────
 * The first cut got this half right and the other half wrong: `preferredSlots`
 * counted collapsed windows while `preferredMet` counted 15-minute slots, so the
 * drill's own fixture — preferred mornings across five weekdays, which the picker
 * stores as 80 rows in 5 windows — reported `preferredSlots: 5,
 * preferredMet: 20` and printed "20 of 5 preferred times met". A ratio whose
 * numerator exceeds its denominator is a falsehood on the exact line the scheduler
 * is asked to trust, so the rule is now absolute and mechanical:
 *
 *   A REPORTED RATIO'S NUMERATOR CAN NEVER EXCEED ITS DENOMINATOR, AND BOTH
 *   SIDES OF A RATIO ARE COUNTS OF DAY-WINDOWS.
 *
 * `slotCount` still reports the underlying stored rows for anyone who needs the raw
 * number, and it is deliberately absent from every rendered ratio. The unit-test
 * that guards this is `a2-c17-preference-adherence-ratio-invariant`, which walks a
 * set of computed reports and fails on any ratio above 1 — so the next person to
 * split the units again does not need a human to read two lines side by side.
 *
 * PURE. No database, no clock, no environment. Every unit row drives
 * `computePreferenceAdherence` directly.
 */

import { intervalsOverlap } from './timetable-candidate-domain.js';
import { getDataContext } from '../lib/data-context.js';
import { loadVerifiedOrderedTermContract } from './academic-term.service.js';

// ─── Shape ───

export type PreferenceAdherenceKind = 'UNAVAILABLE' | 'PREFERRED';

export type PreferenceAdherenceDay = {
	/** The day in plain words, e.g. `Friday`. Never a raw enum. */
	day: string;
	/** True when at least one of this teacher's classes fell in that day's window. */
	met: boolean;
	/** How many of this teacher's classes fell in that day's window. */
	classCount: number;
};

export type PreferenceAdherencePreference = {
	kind: PreferenceAdherenceKind;
	/**
	 * The ROLLED-UP phrase, in the app's own day/period vocabulary: one day reads
	 * `Unavailable Friday afternoon`, and the same window across several weekdays
	 * reads `Prefers mornings`. A teacher who preferred five weekday mornings gets
	 * ONE line, not five lines of equal weight.
	 */
	label: string;
	/** Day-windows this line covers. The denominator of the packet's "N of M". */
	totalCount: number;
	/** How many of those day-windows were honoured. NEVER greater than `totalCount`. */
	metCount: number;
	/** The underlying stored 15-minute rows, for anyone who needs the raw number. NEVER in a ratio. */
	slotCount: number;
	/**
	 * `UNAVAILABLE`: true when no placed class of that teacher overlaps ANY slot of
	 * ANY of its day-windows. For `PREFERRED` this is `metCount === totalCount` —
	 * the same statement read as "fully honoured" — so the field is never a guess
	 * about a value the other fields already decide.
	 */
	kept: boolean;
	/** One short row per day. Carries NO ratio, so it cannot disagree with the line above it. */
	days: PreferenceAdherenceDay[];
};

export type PreferenceAdherenceTeacher = {
	facultyId: number;
	name: string;
	preferences: PreferenceAdherencePreference[];
};

export type PreferenceAdherenceReport = {
	runId: number;
	schoolYearId: number;
	termIndex: number;
	totals: {
		unavailableSlots: number;
		unavailableKept: number;
		preferredSlots: number;
		preferredMet: number;
	};
	teachers: PreferenceAdherenceTeacher[];
	notReviewedTeacherCount: number;
	notReviewedTeacherNames: string[];
	/** False => the client renders NOTHING. Not an empty box, not a zero line. */
	hasAny: boolean;
};

export type PreferenceAdherenceAvailabilityRow = {
	schoolId: number;
	schoolYearId: number;
	termIndex: number;
	facultyId: number;
	status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'REJECTED';
	slots: Array<{ day: string; startTime: string; endTime: string; state: string }>;
};

export type PreferenceAdherencePlacedEntry = {
	facultyId: number | null;
	day: string;
	startTime: string;
	endTime: string;
	termIndex?: number | null;
};

export type PreferenceAdherenceInput = {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	termIndex: number;
	availability: PreferenceAdherenceAvailabilityRow[];
	/** Entries to consider, already read from the run. Scoped to the term here. */
	placedEntries: PreferenceAdherencePlacedEntry[];
	/** Every faculty named by the report, so the list never shows a bare id. */
	facultyNames: ReadonlyMap<number, string>;
};

// ─── Vocabulary (the app's own, not a second set) ───

/** The picker's day columns (`AvailabilityPicker.tsx` `DAYS`). */
const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/**
 * The painted day is 07:00–19:00 and the picker's own Quick Fill templates cut
 * it at 12:00 into "Mornings (7 AM - 12 PM)" and "Afternoons (1 PM - 7 PM)"
 * (`AvailabilityPicker.tsx:163-167`). The half-open boundaries below are those
 * two templates widened to meet, so every minute of the painted day is covered by
 * exactly one word and no preference can fall through to a bare clock range that
 * the scheduler would have to decode.
 */
const DAY_START_MINUTES = 7 * 60;
const MORNING_END_MINUTES = 12 * 60;
const DAY_END_MINUTES = 19 * 60;

/** Matches `formatTime` in `atlas-client/src/lib/utils.ts`, so a clock range in a group label reads like every other time on screen. */
function formatClock(hhmm: string): string {
	const [hStr, mStr] = hhmm.split(':');
	let h = Number(hStr);
	const suffix = h >= 12 ? 'PM' : 'AM';
	if (h === 0) h = 12;
	else if (h > 12) h -= 12;
	return `${h}:${mStr} ${suffix}`;
}

function toMinutes(hhmm: string): number {
	const [h, m] = String(hhmm).split(':').map(Number);
	if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
	return h * 60 + m;
}

function dayWord(day: string): string {
	const index = DAY_ORDER.indexOf(day as (typeof DAY_ORDER)[number]);
	if (index < 0) return '';
	const full = day.charAt(0) + day.slice(1).toLowerCase();
	return full;
}

/** ONE vocabulary for the parts of a day, reused by both kinds of group. */
function dayPartWord(start: number, end: number): string {
	if (start <= DAY_START_MINUTES && end >= DAY_END_MINUTES) return 'all day';
	if (start >= DAY_START_MINUTES && end <= MORNING_END_MINUTES) return 'morning';
	if (start >= MORNING_END_MINUTES && end <= DAY_END_MINUTES) return 'afternoon';
	return '';
}

// ─── Grouping ───

type Slot = { day: string; start: number; end: number; startTime: string; endTime: string };

/** Merge overlapping or touching slots on one day into contiguous windows. */
function collapseSlots(slots: Slot[]): Slot[] {
	const sorted = [...slots].sort((left, right) => left.start - right.start || left.end - right.end);
	const merged: Slot[] = [];
	for (const slot of sorted) {
		const last = merged[merged.length - 1];
		if (last && slot.start <= last.end) {
			if (slot.end > last.end) {
				last.end = slot.end;
				last.endTime = slot.endTime;
			}
			continue;
		}
		merged.push({ ...slot });
	}
	return merged;
}

/**
 * ONE day-window. This is the unit every count in this module is denominated in:
 * one painted block, on one day. `slotCount` is the raw stored-row count and is
 * reported for reference only — it never appears in a ratio.
 */
type Window = {
	day: string;
	start: number;
	end: number;
	startTime: string;
	endTime: string;
	slotCount: number;
	/** The part-of-day word, or '' for a window the day-part templates do not cover. */
	part: string;
};

function windowsOf(slots: Slot[]): Window[] {
	const byDay = new Map<string, Slot[]>();
	for (const slot of slots) {
		const list = byDay.get(slot.day) ?? [];
		list.push(slot);
		byDay.set(slot.day, list);
	}
	const windows: Window[] = [];
	for (const [day, daySlots] of byDay) {
		for (const merged of collapseSlots(daySlots)) {
			const slotCount = daySlots.filter((slot) => slot.start >= merged.start && slot.end <= merged.end).length || 1;
			windows.push({ ...merged, slotCount, part: dayPartWord(merged.start, merged.end) });
		}
	}
	windows.sort((left, right) => DAY_ORDER.indexOf(left.day as (typeof DAY_ORDER)[number]) - DAY_ORDER.indexOf(right.day as (typeof DAY_ORDER)[number]) || left.start - right.start);
	return windows;
}

/**
 * The window's own phrase, e.g. "Friday afternoon" or "Wednesday 11:15 AM to 1:00 PM".
 * This is what the per-day detail rows show.
 */
function windowPhrase(window: Window): string {
	const day = dayWord(window.day);
	return window.part
		? `${day} ${window.part}`
		: `${day} ${formatClock(window.startTime)} to ${formatClock(window.endTime)}`;
}

/**
 * The ROLLED-UP label for the windows of one part, in the packet's own words:
 *
 *   - a window on its own reads `Unavailable Friday afternoon` (the packet's shape),
 *   - the same window across weekdays reads `Prefers mornings` (the packet's other
 *     shape), because naming all five days would be longer and say less.
 *
 * A window the day-part templates do not cover keeps its clock range in both
 * cases, so an unusual window is never dressed up as a named part of day.
 */
function rolledUpLabel(kind: PreferenceAdherenceKind, part: string, windows: Window[]): string {
	const lead = kind === 'UNAVAILABLE' ? 'Unavailable' : 'Prefers';
	if (part === '' || windows.length === 1) {
		return `${lead} ${windowPhrase(windows[0])}`;
	}
	// "mornings", "afternoons" — the packet's plural. "all day" is already plural in
	// the only sense that matters here and reads correctly unchanged.
	const plural = part === 'morning' ? 'mornings' : part === 'afternoon' ? 'afternoons' : part;
	return `${lead} ${plural}`;
}

// ─── The one derivation ───

/**
 * PURE. Everything the report says is decided here from two facts: the
 * availability rows and the placed entries.
 *
 * Scope is applied INSIDE the function, not only by the query, so the scoping
 * rule is a tested property of the derivation rather than an assumption about a
 * WHERE clause.
 */
export function computePreferenceAdherence(input: PreferenceAdherenceInput): PreferenceAdherenceReport {
	const inScope = (row: PreferenceAdherenceAvailabilityRow) =>
		row.schoolId === input.schoolId
		&& row.schoolYearId === input.schoolYearId
		&& row.termIndex === input.termIndex;

	/**
	 * An entry with no recorded term is IN scope. Generation persists a term on
	 * every entry it places, so a missing one is legacy data; excluding it would
	 * hide a real class and could report an `UNAVAILABLE` slot as kept when it was
	 * not. Failing toward "not kept" is the safe direction for this sentence.
	 */
	const entriesInTerm = input.placedEntries.filter(
		(entry) => entry.termIndex == null || entry.termIndex === input.termIndex,
	);
	const entriesByFaculty = new Map<number, PreferenceAdherencePlacedEntry[]>();
	for (const entry of entriesInTerm) {
		if (entry.facultyId == null) continue;
		const list = entriesByFaculty.get(entry.facultyId) ?? [];
		list.push(entry);
		entriesByFaculty.set(entry.facultyId, list);
	}

	const nameOf = (facultyId: number) => input.facultyNames.get(facultyId) ?? `Teacher #${facultyId}`;

	const teachers: PreferenceAdherenceTeacher[] = [];
	const notReviewedFacultyIds = new Set<number>();
	let reviewedWindowCount = 0;
	let unavailableWindows = 0;
	let unavailableKept = 0;
	let preferredWindows = 0;
	let preferredMet = 0;

	const reviewedRows = input.availability.filter((row) => inScope(row) && row.status === 'REVIEWED')
		.sort((left, right) => left.facultyId - right.facultyId);

	for (const row of reviewedRows) {
		const entries = entriesByFaculty.get(row.facultyId) ?? [];
		const preferences: PreferenceAdherencePreference[] = [];

		for (const kind of ['UNAVAILABLE', 'PREFERRED'] as const) {
			const slots: Slot[] = [];
			for (const slot of row.slots) {
				if (slot.state !== kind) continue;
				const start = toMinutes(slot.startTime);
				const end = toMinutes(slot.endTime);
				if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) continue;
				slots.push({ day: slot.day, start, end, startTime: slot.startTime, endTime: slot.endTime });
			}
			if (slots.length === 0) continue;

			/**
			 * Per day-window, and ONLY per day-window. `met` is a NEUTRAL fact about
			 * one window — "a class of this teacher landed here" — and never a count
			 * of the 15-minute rows inside it. That is the whole of F1: the first cut
			 * incremented the denominator once per window and the numerator once per
			 * met row, so five painted mornings read "20 of 5".
			 *
			 * `met` is deliberately NOT the same as "kept". For PREFERRED, a class
			 * landing in the window is the preference being met. For UNAVAILABLE it
			 * is the preference being VIOLATED, so the two readings are opposite and
			 * the polarity is applied once, below, where the kind is known.
			 */
			const windows = windowsOf(slots).map((window) => {
				const windowSlots = slots.filter((slot) => slot.day === window.day && slot.start >= window.start && slot.end <= window.end);
				const classCount = entries.filter((entry) => windowSlots.some((slot) => intervalsOverlap(
					{ day: slot.day, startTime: slot.startTime, endTime: slot.endTime },
					{ day: entry.day, startTime: entry.startTime, endTime: entry.endTime },
				))).length;
				return {
					window,
					met: classCount > 0,
					classCount,
				};
			});
			if (windows.length === 0) continue;
			reviewedWindowCount += windows.length;

			// ONE line per part of day, carrying the count in the packet's shape, with
			// the per-day detail underneath. A teacher who preferred five weekday
			// mornings gets one line, not five.
			const byPart = new Map<string, typeof windows>();
			for (const entry of windows) {
				const list = byPart.get(entry.window.part) ?? [];
				list.push(entry);
				byPart.set(entry.window.part, list);
			}

			for (const [part, group] of byPart) {
				// Both sides of this ratio count DAY-WINDOWS. That is the invariant.
				const totalCount = group.length;
				// THE POLARITY, IN ONE PLACE. PREFERRED is honoured when a class landed
				// there; UNAVAILABLE is kept when NOTHING landed there. Reading the
				// same boolean both ways is how a "kept" count turned into a "violated"
				// count, so the inversion is explicit rather than implied.
				const honouredCount = kind === 'UNAVAILABLE'
					? group.filter((entry) => !entry.met).length
					: group.filter((entry) => entry.met).length;

				if (kind === 'UNAVAILABLE') {
					unavailableWindows += totalCount;
					unavailableKept += honouredCount;
				} else {
					preferredWindows += totalCount;
					preferredMet += honouredCount;
				}

				preferences.push({
					kind,
					label: rolledUpLabel(kind, part, group.map((entry) => entry.window)),
					totalCount,
					metCount: honouredCount,
					slotCount: group.reduce((sum, entry) => sum + entry.window.slotCount, 0),
					kept: honouredCount === totalCount,
					days: group.map((entry) => ({ day: dayWord(entry.window.day), met: entry.met, classCount: entry.classCount })),
				});
			}
		}

		if (preferences.length > 0) teachers.push({ facultyId: row.facultyId, name: nameOf(row.facultyId), preferences });
	}

	/**
	 * A teacher whose availability for this year/term exists but is not REVIEWED
	 * is counted ONLY when it carries at least one slot. A DRAFT row with zero
	 * slots is indistinguishable from "never started", and telling the scheduler
	 * that teacher's preferences "were not used" would be a claim about nothing.
	 * `REJECTED` is treated the same way: it is not in use, which is the sentence
	 * the notice already makes.
	 *
	 * A faculty who ALSO has a REVIEWED row is never "not reviewed" — the schema
	 * allows one row per (school, year, faculty, term), so this only arises from
	 * malformed input, and counting them anyway would print "1 teacher's
	 * preferences are not reviewed yet" beside their own, reviewed, counted groups.
	 */
	const reviewedFacultyIds = new Set(reviewedRows.map((row) => row.facultyId));
	for (const row of input.availability) {
		if (!inScope(row) || row.status === 'REVIEWED') continue;
		if (reviewedFacultyIds.has(row.facultyId)) continue;
		if (!row.slots.some((slot) => slot.state === 'UNAVAILABLE' || slot.state === 'PREFERRED')) continue;
		notReviewedFacultyIds.add(row.facultyId);
	}

	const notReviewedTeacherNames = [...notReviewedFacultyIds]
		.sort((left, right) => nameOf(left).localeCompare(nameOf(right)))
		.map((facultyId) => nameOf(facultyId));

	return {
		runId: input.runId,
		schoolYearId: input.schoolYearId,
		termIndex: input.termIndex,
		/**
		 * Every field is a count of DAY-WINDOWS. The names are the packet's; the
		 * unit is one thing, on both sides of every ratio. `unavailableKept` and
		 * `preferredMet` are each built by counting windows, never by counting the
		 * 15-minute rows inside them, which is what made "20 of 5" possible.
		 */
		totals: {
			unavailableSlots: unavailableWindows,
			unavailableKept,
			preferredSlots: preferredWindows,
			preferredMet,
		},
		teachers,
		notReviewedTeacherCount: notReviewedTeacherNames.length,
		notReviewedTeacherNames,
		hasAny: reviewedWindowCount > 0 || notReviewedTeacherNames.length > 0,
	};
}

// ─── The read (zero writes) ───

/**
 * READ-ONLY. Two indexed reads and nothing else: the run's own `draftEntries`
 * JSON, and this school's availability for the one year/term. No create, update
 * or delete is reachable from this path, which is what the route's instrumented
 * zero-write row asserts.
 *
 * The term is NOT defaulted. An unresolved term is a typed failure, never
 * "Term 1" (AGENTS.md §7, timetable invariants).
 */
export async function loadPreferenceAdherenceReport(input: {
	runId: number;
	schoolId: number;
	schoolYearId: number;
	termIndex: number;
}): Promise<PreferenceAdherenceReport> {
	/**
	 * `getDataContext`, not the `prisma` singleton directly, for the reason
	 * `lib/data-context.ts` documents: the route's zero-write row must observe the
	 * EXACT production data-access path, so the test injects an instrumented client
	 * here rather than asserting against a second, unrelated client.
	 */
	const db = getDataContext();

	const run = await db.generationRun.findFirst({
		where: { id: input.runId, schoolId: input.schoolId, schoolYearId: input.schoolYearId },
		select: { id: true, draftEntries: true },
	});
	if (!run) {
		throw Object.assign(new Error('RUN_NOT_FOUND'), {
			statusCode: 404,
			code: 'RUN_NOT_FOUND',
			message: 'Generation run not found in this school/year scope.',
		});
	}

	// The verified ordered-term contract is the authority for the term we are about
	// to read. A term outside it is refused rather than reported against.
	const contract = await loadVerifiedOrderedTermContract(input.schoolId, input.schoolYearId);
	if (!contract || !contract.terms.some((term) => term.order === input.termIndex)) {
		throw Object.assign(new Error('TERM_AUTHORITY_UNRESOLVED'), {
			statusCode: 409,
			code: 'TERM_AUTHORITY_UNRESOLVED',
			message: 'No verified ordered term covers the requested term for this school year.',
		});
	}

	const availability = await db.facultyAvailability.findMany({
		where: { schoolId: input.schoolId, schoolYearId: input.schoolYearId },
		select: {
			schoolId: true,
			schoolYearId: true,
			termIndex: true,
			facultyId: true,
			status: true,
			slots: { select: { day: true, startTime: true, endTime: true, state: true } },
		},
	});

	const placedEntries = (Array.isArray(run.draftEntries) ? run.draftEntries : []) as unknown as PreferenceAdherencePlacedEntry[];

	const facultyIds = new Set<number>();
	for (const row of availability) facultyIds.add(row.facultyId);
	for (const entry of placedEntries) if (typeof entry?.facultyId === 'number') facultyIds.add(entry.facultyId);

	const facultyRows = await db.facultyMirror.findMany({
		where: { id: { in: [...facultyIds] } },
		select: { id: true, firstName: true, lastName: true },
	});
	const facultyNames = new Map<number, string>(
		facultyRows.map((row) => [row.id, [row.lastName, row.firstName].filter(Boolean).join(', ') || `Teacher #${row.id}`]),
	);

	return computePreferenceAdherence({
		runId: run.id,
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		termIndex: input.termIndex,
		availability: availability as unknown as PreferenceAdherenceAvailabilityRow[],
		placedEntries,
		facultyNames,
	});
}
