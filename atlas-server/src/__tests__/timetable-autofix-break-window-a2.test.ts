/**
 * A2-C7 item 3(c) — the auto-fix may never park a class in a break or lunch slot.
 *
 * The measured defect, from `manual_schedule_edits` id 12 on live draft run 321
 * (2026-09-27 12:50:29Z, actor 46, `SWAP_ENTRIES` / `AUTO_FIX_MOVE_SOURCE`):
 *
 *   before: entry-1::t2   MONDAY 06:00-06:45
 *   after:  entry-1::t2   MONDAY 12:15-13:00
 *
 * 12:15-13:00 is grade 7 REGULAR's own `Lunch Break` BREAK row in the canonical
 * class-program grid. The operator's control said "swap these two"; the schedule
 * lost a class into recess, the grid hid it behind the band, and no surface named
 * the move. `timetable-swap-custody-a2` D1b could not have caught this: its
 * fixture's shift window for grade 7 is 06:00-12:15, so 12:15 was already
 * outside the shift bound there. Production's persisted Shift Settings span the
 * break, so the shift bound admits it and only boundary (c) rejects it. **The
 * existing suite therefore passes with or without this fix, which is exactly why
 * a dedicated row is required.**
 *
 * What this file proves, and how:
 *
 *   1. The rule is SCOPE-SPECIFIC, driven by the real canonical catalog from
 *      `getExpectedCanonicalSlots`, not an invented fixture: 12:15-13:00 is a
 *      break for grade 7 REGULAR and an ordinary first class for grade 9
 *      REGULAR, and the two must disagree.
 *   2. It is LOAD-BEARING against the shift bound: the authority under test is
 *      built with a persisted shift window that deliberately SPANS lunch, so
 *      `isInsideShiftBounds` admits the slot and boundary (c) is the only thing
 *      left that can reject it. Remove boundary (c) from the pool and this row's
 *      sibling (the mounted one) flips; remove the shift bound and nothing here
 *      would notice, which is the point.
 *   3. It uses OVERLAP, not containment: a 09:00-09:45 session straddling
 *      grade 7's 09:00-09:15 `Health Break` must collide.
 *   4. It FAILS OPEN where the authority is absent, which is the pre-existing
 *      behaviour: an unknown section resolves no scope, so no window matches and
 *      nothing is excluded. The fix must not turn a missing scope into a blanket
 *      rejection of every auto-fix.
 *
 * No database, no mocks of the code under test: `buildWarningWindowAuthority`
 * and `getExpectedCanonicalSlots` are the production functions.
 *
 * Run: `npm run test:timetable-autofix-break-window-a2` (wired in
 * `atlas-server/package.json`). The mounted pool row lives in
 * `timetable-swap-custody-a2` as D1-BREAK and needs a disposable database.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { autoFixBreakWindowCollision } from '../services/manual-edit.service.js';
import { getExpectedCanonicalSlots } from '../services/class-program-slot.service.js';
import {
	buildWarningWindowAuthority,
	type CanonicalSlotWindowSource,
	type WarningWindowAuthority,
} from '../services/warning-window-authority.service.js';

const G7_REGULAR_SECTION = 701;
const G9_REGULAR_SECTION = 901;

/** The REAL catalog rows for both scopes, straight from the source of truth. */
const CATALOG: CanonicalSlotWindowSource[] = [
	...getExpectedCanonicalSlots(7, 'REGULAR'),
	...getExpectedCanonicalSlots(9, 'REGULAR'),
] as unknown as CanonicalSlotWindowSource[];

/**
 * The authority production has and the custody fixture does not: a persisted
 * grade-7 shift window that SPANS the 12:15 lunch break. This is the whole point
 * of the row — under the fixture's 06:00-12:15 window the defect is invisible.
 */
function authoritySpanningTheBreak(): WarningWindowAuthority {
	return buildWarningWindowAuthority({
		sections: [
			{ id: G7_REGULAR_SECTION, gradeLevel: 7, programType: 'REGULAR' },
			{ id: G9_REGULAR_SECTION, gradeLevel: 9, programType: 'REGULAR' },
		],
		policyRow: null,
		specialEvents: [],
		shiftWindows: [
			{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' },
			{ gradeLevel: 9, programType: 'REGULAR', startTime: '12:15', endTime: '18:30' },
		],
		classProgramSlots: CATALOG,
	});
}

const AUTHORITY = authoritySpanningTheBreak();

const MON_1215 = { day: 'MONDAY', startTime: '12:15', endTime: '13:00' };
const MON_1130 = { day: 'MONDAY', startTime: '11:30', endTime: '12:15' };
const MON_0900_STRADDLE = { day: 'MONDAY', startTime: '09:00', endTime: '09:45' };
const MON_1200_STRADDLE = { day: 'MONDAY', startTime: '12:00', endTime: '12:45' };

test('precondition: the shift bound alone ADMITS the live target, so only boundary (c) can reject it', () => {
	const g7Shift = AUTHORITY.shiftWindows.filter((w) => w.gradeLevel === 7);
	assert.equal(g7Shift.length, 1, 'grade 7 has exactly one resolved shift window');
	const start = (value: string) => {
		const [h, m] = value.split(':').map(Number);
		return h * 60 + m;
	};
	assert.ok(
		start(MON_1215.startTime) >= start(g7Shift[0].startTime) && start(MON_1215.endTime) <= start(g7Shift[0].endTime),
		`the 12:15-13:00 slot lies INSIDE grade 7's resolved shift window ${g7Shift[0].startTime}-${g7Shift[0].endTime}, so the shift boundary cannot reject it (this is the production shape the custody fixture does not have)`,
	);
	assert.ok(
		AUTHORITY.breakWindows.some((w) => w.startTime === '12:15' && w.endTime === '13:00' && w.gradeLevel === 7),
		'the resolved authority carries grade 7\'s own 12:15-13:00 break window',
	);
});

test('3(c): a class may not be auto-fixed into its own grade+program lunch break', () => {
	const collision = autoFixBreakWindowCollision(MON_1215, { sectionId: G7_REGULAR_SECTION }, AUTHORITY);
	assert.equal(collision, 'Lunch Break',
		'the live target of manual_schedule_edits id 12 is rejected, and the rejection names the window');
});

test('3(c) NON-VACUITY: the same slot is a legal target for the grade that has no break there', () => {
	assert.equal(
		autoFixBreakWindowCollision(MON_1215, { sectionId: G9_REGULAR_SECTION }, AUTHORITY),
		null,
		'12:15-13:00 is grade 9 REGULAR\'s first CLASS row, so the rule is scope-specific and not a blanket time ban',
	);
});

test('3(c) NON-VACUITY: an ordinary in-scope class slot is untouched', () => {
	assert.equal(
		autoFixBreakWindowCollision(MON_1130, { sectionId: G7_REGULAR_SECTION }, AUTHORITY),
		null,
		'11:30-12:15 is grade 7 REGULAR\'s last CLASS row and remains a legal auto-fix target',
	);
});

test('3(c): overlap, not containment — a session straddling a break is rejected too', () => {
	assert.equal(
		autoFixBreakWindowCollision(MON_1200_STRADDLE, { sectionId: G7_REGULAR_SECTION }, AUTHORITY),
		'Lunch Break',
		'a 12:00-12:45 session is half in lunch and is rejected rather than admitted because it does not start at 12:15',
	);
	assert.equal(
		autoFixBreakWindowCollision(MON_0900_STRADDLE, { sectionId: G7_REGULAR_SECTION }, AUTHORITY),
		'Health Break',
		'the rule covers every break row, not only lunch: 09:00-09:15 is grade 7 REGULAR\'s Health Break',
	);
});

test('3(c) FAIL-OPEN: an unknown section scope excludes nothing, as before', () => {
	assert.equal(
		autoFixBreakWindowCollision(MON_1215, { sectionId: -1 }, AUTHORITY),
		null,
		'no resolved scope means no applicable window, so the pre-existing behaviour is preserved and the fix cannot become a blanket rejection',
	);
});

test('3(c) DRIFT GUARD: the auto-fix pool actually consults the predicate, and the commit path is already closed', () => {
	// Labelled honestly: this row is a DRIFT GUARD on wiring, NOT the evidence
	// that the pool rejects a break slot. The evidence for that is the mounted
	// `timetable-swap-custody-a2` D1-BREAK row, which drives the real service
	// against a disposable database. Per AGENTS.md §11 a source-text assertion
	// is not acceptance evidence on its own; this row only stops the predicate
	// from being orphaned while the mounted row keeps proving the outcome.
	const source = readFileSync(new URL('../services/manual-edit.service.ts', import.meta.url), 'utf8');
	const pool = source.slice(source.indexOf('const poolFor ='), source.indexOf('const excludeOwn ='));
	assert.match(pool, /autoFixBreakWindowCollision\(slot, moved, authority\)/,
		'the candidate pool filters through the exported predicate, not a private copy of the rule');
	assert.ok(!/overlapsAnyWindow/.test(pool),
		'the pool cannot have re-grown an inline copy of the overlap test that would drift from the predicate');
	// The commit path needs no second boundary: it re-derives the authoritative
	// target and refuses any other with 409 AUTO_FIX_TARGET_DRIFT, so a client
	// cannot hand it a break slot. Asserted so the boundary is not re-opened by
	// a future "trust the client" change.
	assert.match(source, /AUTO_FIX_TARGET_DRIFT/,
		'the commit path still refuses a target the preview did not show, which is what keeps a client-supplied break slot unreachable');
});
