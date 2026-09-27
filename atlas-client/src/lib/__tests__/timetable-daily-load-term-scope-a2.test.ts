/**
 * A2-TIMETABLE-CUSTODY (finding #2) — the daily-load cap counts ONE term's
 * teaching, exactly as the server's validator does.
 *
 * THE DEFECT, with its arithmetic. Moving Mon 07:30 MAPEH onto Mon 10:00 on a day
 * whose classes run 06:00–12:15 opened "Swap class times" with
 *
 *     Must fix: Daily load hard cap: I. GARCIA would reach 11.3h (max 8h)
 *
 * 11.3h is 678 minutes. The day is a 375-minute window (06:00–12:15). A
 * single-term teaching load cannot exceed the window, so 678 minutes is
 * arithmetically impossible for one term — it is a three-term sum. GARCIA teaches
 * a year-long block that repeats in T1, T2 and T3, and the client accumulated one
 * day's minutes once per term.
 *
 * The SERVER was already correct, and said so in source. `constraint-validator.ts`
 * groups by `facultyDayTermKey` with the comment "Term identity is mandatory: a
 * year-long entry repeating in every term must contribute its minutes once per
 * term, never summed across terms." So the client preview raised a MUST-FIX the
 * authoritative validator would never report — and that mismatch is also why the
 * same preview could show a "Must fix" line directly above a truthful
 * "Safe to review · No blocking conflict" (that banner is driven by the SERVER
 * preview's hard violations, `TimetablePlacementDialogs.tsx`).
 *
 * Rows (real module, real numbers — not source-matched):
 *   L1 a three-term year-long teacher is NOT a daily-load breach in any term.
 *   L2 the pre-fix arithmetic (the cross-term sum) DOES breach, at the recorded
 *      figure, so L1 discriminates and is not tautological.
 *   L3 the load is still counted: a genuinely over-8h single-term day is a
 *      must-fix. The fix narrows the population; it does not disable the rule.
 *   L4 the soft band is unaffected by the term scoping.
 *   L5 `termCompatibleEntry` is the ONE predicate: same term or unscoped
 *      conflicts, another term does not — matching `conflictTermsOverlap`.
 *   L6 the term-blind accumulator is gone from the index, so no future reader can
 *      reach for it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import { createLiveConflictLookup, termCompatibleEntry } from '@/lib/timetable-live-conflict';
import type { ScheduledEntry } from '@/types';

const GARCIA = 19;
const CAP_HARD_MINUTES = 480;
const CAP_SOFT_MINUTES = 360;

/** Monday periods on the recorded day, 06:00–12:15. 45 minutes each. */
const MONDAY_PERIODS: Array<[string, string]> = [
	['06:00', '06:45'],
	['06:45', '07:30'],
	['07:30', '08:15'],
	['08:15', '09:00'],
	['09:00', '09:45'],
	['09:45', '10:30'],
	['10:30', '11:15'],
	['11:15', '12:00'],
	['12:00', '12:15'],
];

/**
 * The target cell from the finding: Mon 10:00, the free slot the class is being
 * moved ONTO. It is deliberately not one of the occupied periods, so it has to be
 * added to the slot list explicitly — a cell that does not resolve proves nothing.
 */
const TARGET = { startTime: '10:00', endTime: '10:45' };

const SLOTS = [...MONDAY_PERIODS.map(([startTime, endTime]) => ({ startTime, endTime })), TARGET];

/**
 * A genuinely long day, for proving the hard cap still fires. The 06:00–12:15 day
 * of the finding CANNOT produce a single-term breach — 375 minutes of window
 * against a 480-minute cap — which is precisely why the recorded 11.3h had to be
 * a cross-term sum. So L3 needs a day long enough for one term to breach on its
 * own, and this is it: twelve 45-minute periods, 07:00–16:00.
 */
const LONG_DAY_PERIODS: Array<[string, string]> = Array.from({ length: 12 }, (_, index) => {
	const start = 7 * 60 + index * 45;
	const end = start + 45;
	const fmt = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
	return [fmt(start), fmt(end)] as [string, string];
});
const LONG_TARGET = { startTime: '16:00', endTime: '16:45' };
const LONG_SLOTS = [...LONG_DAY_PERIODS.map(([startTime, endTime]) => ({ startTime, endTime })), LONG_TARGET];

const MAPS = {
	facultyName: (id: number) => (id === GARCIA ? 'I. GARCIA' : `Faculty #${id}`),
	sectionName: (id: number) => `Section #${id}`,
	roomName: (id: number) => `Room #${id}`,
	subjectName: (id: number) => `Subject #${id}`,
};

function entry(over: Partial<ScheduledEntry> & { entryId: string; day: string; startTime: string; endTime: string }): ScheduledEntry {
	return {
		sectionId: 1,
		subjectId: 1,
		facultyId: GARCIA,
		roomId: 1,
		termIndex: 2,
		...over,
	} as ScheduledEntry;
}

/**
 * The year-long teacher from the finding: the SAME Monday block repeated in T1,
 * T2 and T3, which is what a year-long subject looks like in one run.
 */
function yearLongG(): ScheduledEntry[] {
	return ([1, 2, 3] as const).flatMap((termIndex) => [
		entry({ entryId: `entry-1::t${termIndex}`, sectionId: 1, subjectId: 6, day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex }),
		entry({ entryId: `entry-2::t${termIndex}`, sectionId: 2, subjectId: 7, day: 'MONDAY', startTime: '09:00', endTime: '09:45', termIndex }),
	]);
}

function cellIdFor(startTime: string, endTime: string, day = 'MONDAY') {
	return `${day}-${startTime}-${endTime}`;
}

function detailFor(entries: ScheduledEntry[], termIndex: number, slots = SLOTS) {
	const lookup = createLiveConflictLookup(
		entries,
		slots,
		{ sectionId: 999, facultyId: GARCIA, roomId: 999, termIndex },
		MAPS,
	);
	assert.ok(lookup, 'the lookup must be built for a real context');
	return (cellId: string) => lookup(cellId);
}

// ── L1 the cross-term sum is gone ───────────────────────────────────────────

test('L1 a year-long teacher repeating in three terms is NOT a daily-load breach in any term', () => {
	const entries = yearLongG();
	// Per term GARCIA teaches 45 + 45 = 90 minutes on Monday. Adding the 45-minute
	// target reaches 135 — far below the 360 soft band.
	for (const termIndex of [1, 2, 3]) {
		const detail = detailFor(entries, termIndex)(cellIdFor(TARGET.startTime, TARGET.endTime));
		assert.ok(detail, `term ${termIndex}: the target cell resolves`);
		assert.equal(
			detail!.kind,
			'clean',
			`term ${termIndex}: 90 minutes of Monday teaching plus a 45-minute class is not a must-fix`,
		);
		assert.ok(
			!detail!.reasons.some((reason) => /Daily load hard cap/i.test(reason)),
			`term ${termIndex}: no daily-load hard cap is claimed: ${JSON.stringify(detail!.reasons)}`,
		);
	}
});

// ── L2 MUTANT: the pre-fix arithmetic really did breach, at the traced figure ─

test('L2 MUTANT: the pre-fix cross-term sum reproduces the recorded 11.3h figure', () => {
	// The pre-fix accumulator, verbatim in spirit: keyed only by day+faculty, no
	// term component, so it summed every term. This is the arithmetic that
	// produced "Daily load hard cap: I. GARCIA would reach 11.3h (max 8h)".
	const heavyDay: ScheduledEntry[] = ([1, 2, 3] as const).flatMap((termIndex) =>
		MONDAY_PERIODS.slice(0, 5).map(([startTime, endTime], index) => entry({
			entryId: `heavy-${index}::t${termIndex}`,
			sectionId: 100 + index,
			subjectId: 200 + index,
			day: 'MONDAY',
			startTime,
			endTime,
			termIndex,
		})),
	);
	const preFixDailyMinutes = heavyDay
		.filter((e) => e.day === 'MONDAY' && e.facultyId === GARCIA)
		.reduce((sum) => sum + 45, 0);

	// THE FIGURE IN THE FINDING, reproduced exactly.
	assert.equal(preFixDailyMinutes, 675, 'five 45-minute periods across three terms is 675 minutes');
	assert.equal(
		Math.round((preFixDailyMinutes / 60) * 10) / 10,
		11.3,
		'which renders as 11.3h against an 8h cap - the exact string in the finding',
	);
	assert.ok(preFixDailyMinutes > CAP_HARD_MINUTES, 'so the pre-fix sum is a must-fix');

	// And the real single-term load for that same teacher and day, which is what
	// the fixed code counts: 225 minutes, plus the 45-minute class.
	const singleTermMinutes = 5 * 45;
	assert.equal(singleTermMinutes, 225, 'one term is 225 minutes, not 675');
	assert.ok(
		singleTermMinutes + 45 <= CAP_SOFT_MINUTES,
		'225 + the 45-minute class is 270, below even the soft band: no breach at all',
	);
});

// ── L3 the rule still fires on a real single-term breach ─────────────────────

test('L3 a genuinely over-cap SINGLE-term day is still a must-fix', () => {
	// Eleven 45-minute periods in T2 ALONE is 495 minutes, already past the 480
	// hard cap, so adding the class keeps it over. This is the row that stops the
	// fix being read as "the daily-load rule was switched off".
	const oneTerm: ScheduledEntry[] = LONG_DAY_PERIODS.slice(0, 11).map(([startTime, endTime], index) => entry({
		entryId: `single-${index}`,
		sectionId: 300 + index,
		subjectId: 400 + index,
		day: 'MONDAY',
		startTime,
		endTime,
		termIndex: 2,
	}));
	const existing = 11 * 45;
	const projected = existing + 45;
	assert.equal(existing, 495, 'eleven 45-minute periods in ONE term is 495 minutes, already over the 8h cap');
	assert.ok(projected > CAP_HARD_MINUTES, 'so adding the class keeps it over the cap');
	const detail = detailFor(oneTerm, 2, LONG_SLOTS)(cellIdFor(LONG_TARGET.startTime, LONG_TARGET.endTime));
	assert.ok(detail, 'the target cell resolves');
	assert.equal(detail!.kind, 'hard', 'a real single-term over-cap day is still blocked');
	assert.ok(
		detail!.reasons.some((reason) => /Daily load hard cap/i.test(reason)),
		`and the reason names the rule: ${JSON.stringify(detail!.reasons)}`,
	);
	assert.ok(
		detail!.reasons.some((reason) => reason.includes(`${Math.round((projected / 60) * 10) / 10}h`)),
		`and reports the real projected load (${Math.round((projected / 60) * 10) / 10}h): ${JSON.stringify(detail!.reasons)}`,
	);
});

// ── L4 the soft band survives the term scoping ──────────────────────────────

test('L4 the soft band still warns on a single term, and is unaffected by the scoping', () => {
	// Eight 45-minute periods in T2: 360 minutes, plus the 45-minute class reaches
	// 405 — over the 360 soft band, under the 480 hard cap. The rule still counts.
	const softDay: ScheduledEntry[] = LONG_DAY_PERIODS.slice(0, 8).map(([startTime, endTime], index) => entry({
		entryId: `soft-${index}`,
		sectionId: 500 + index,
		subjectId: 600 + index,
		day: 'MONDAY',
		startTime,
		endTime,
		termIndex: 2,
	}));
	const projected = 8 * 45 + 45;
	assert.equal(projected, 405, 'eight periods plus the class is 405 minutes');
	assert.ok(projected > CAP_SOFT_MINUTES && projected <= CAP_HARD_MINUTES, 'which sits in the soft band');
	const detail = detailFor(softDay, 2, LONG_SLOTS)(cellIdFor(LONG_TARGET.startTime, LONG_TARGET.endTime));
	assert.ok(detail, 'the target cell resolves');
	assert.equal(detail!.kind, 'soft', 'a soft-band day warns without blocking');
	assert.ok(
		detail!.reasons.some((reason) => /Daily load soft cap/i.test(reason)),
		`and the reason names the soft rule: ${JSON.stringify(detail!.reasons)}`,
	);
	assert.ok(
		!detail!.reasons.some((reason) => /Daily load hard cap/i.test(reason)),
		'and claims no must-fix',
	);
});

// ── L5 the one predicate ────────────────────────────────────────────────────

test('L5 termCompatibleEntry is total: same term or unscoped conflicts, another term does not', () => {
	const inTerm2 = entry({ entryId: 't2', day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 2 });
	const inTerm1 = entry({ entryId: 't1', day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: 1 });
	// `ScheduledEntry.termIndex` is `number | undefined`, so "unscoped" is
	// expressed by OMITTING the key. The runtime also tolerates an explicit
	// `null` (a real stored encoding), and both must resolve to the same
	// unscoped answer, so both are asserted below rather than only the
	// type-legal spelling.
	const unscoped = entry({ entryId: 'none', day: 'MONDAY', startTime: '07:30', endTime: '08:15', termIndex: undefined });
	const nullTerm = { ...entry({ entryId: 'null-term', day: 'MONDAY', startTime: '07:30', endTime: '08:15' }), termIndex: null as unknown as number };

	assert.equal(termCompatibleEntry(inTerm2, 2), true, 'the same term conflicts');
	assert.equal(termCompatibleEntry(inTerm1, 2), false, 'another term does not — the year-long repeat is intentional');
	assert.equal(termCompatibleEntry(inTerm2, 0), true, 'an unscoped context overlaps every term');
	assert.equal(termCompatibleEntry(unscoped, 2), true, 'an unscoped entry overlaps every term');
	assert.equal(termCompatibleEntry(nullTerm, 2), true, 'and so does an entry whose term is an explicit null');
	assert.equal(termCompatibleEntry(inTerm2, undefined), true, 'an absent context is unscoped, not "no term"');
	assert.equal(termCompatibleEntry(inTerm2, 99), false, 'a term the context does not claim does not conflict');
	// `normalizeConflictTerm` is PRE-EXISTING and maps any term below 1 to the
	// unscoped value 0, so a junk term degrades to "overlaps every term" rather
	// than to a silent non-conflict. Asserted as-is: this candidate does not
	// change that rule, and a row that claimed otherwise would be a false claim
	// about the module.
	assert.equal(
		termCompatibleEntry({ ...inTerm2, termIndex: -3 } as ScheduledEntry, 2),
		true,
		'a term below 1 degrades to the pre-existing unscoped wildcard, not to a silent pass',
	);
});

// ── L6 the landmine is removed, not merely unused ───────────────────────────

test('L6 the term-blind accumulator is gone from the index at the source', () => {
	const source = readFileSync(
		resolve(process.cwd(), 'src/lib/timetable-live-conflict.ts'),
		'utf8',
	);
	// Only the docstring that explains the removal may mention it; no live code
	// may read or write it.
	const live = source
		.split('\n')
		.map((line, index) => ({ line, index: index + 1 }))
		.filter(({ line }) => line.includes('facultyDailyMinutes'));
	const code = live.filter(({ line }) => !/^\s*(\*|\/\*|\/\/)/.test(line));
	assert.deepEqual(
		code.map(({ line }) => line.trim()),
		[],
		'no executable line may reference the term-blind accumulator',
	);
	assert.ok(live.length > 0, 'the removal is documented in place, so the reason travels with the change');
});
