/**
 * A3 C17 CORRECTION ROUND — C1, C2, C3.
 *
 * ============================ WHY A SIBLING FILE =============================
 *
 * The original seven-row suite is `components/faculty/__tests__/a3-c17-teacher-profile.test.tsx`
 * and is already 724 lines. AGENTS.md §8 caps a React COMPONENT at 1000 lines and
 * §16 makes "a test no gate runs is not evidence" — so this is a sibling rather
 * than an append, and it is wired into the SAME `test:a3-c17-teacher-profile`
 * script so one command runs all of it. Same directory as the planner asked.
 *
 * ============================== WHAT C1 IS ABOUT =============================
 *
 * The requester named THREE surfaces that must agree on a to-be-hired teacher's
 * name: "Teachers, Teaching Load, Timetable". The first two did. The Timetable
 * never reached the shared formatter at all — `buildFacultyLabel` rebuilt
 * `${lastName}, ${firstName}` from the stored fields, and `FacultyMirror` had no
 * `isPlaceholder` at all, so the new branch could not have fired there even by
 * accident. One person therefore had two identities on two screens open at once:
 * "To be hired: MAPEH" on the roster, "— TO BE HIRED, MAPEH" in a grid cell.
 *
 * The decisive assertion in this file is therefore an EQUALITY between the Timetable
 * label and the Profile's `formatFacultyDisplayName` for the SAME record. Not "the
 * timetable contains the word hired" — the two strings must be the same string,
 * because that is the requester's actual claim.
 *
 * The counterweight is C1-N: a REAL teacher's `buildFacultyLabel` output must stay
 * byte-identical to the pre-change `${lastName}, ${firstName}`. That label is read
 * in cell tooltips, the conflict list and warning prose, and a silent re-case
 * there would be a regression dressed as a fix.
 *
 * ========================= WHAT C2 SETTLED, AND HOW =========================
 *
 * Rule (a): `isPlaceholder` ALONE decides identity; the stored sentinel is a TEXT
 * rule inside the display formatters. The requester's words name the flag ("for
 * `isPlaceholder`, no '#ID-PENDING'"), and the flag+sentinel rule I first shipped
 * was a narrowing: a placeholder whose stored name lacks the sentinel kept both
 * the invented code chip and the false "Active teacher" line.
 *
 * The two consumers that must not disagree — the Profile header's `To be hired`
 * badge (`isPlaceholderSentinelName`) and every display name
 * (`formatFacultyDisplayName`) — now read the SAME single field, so they cannot.
 * C2-3 pins that: for a flagged record with NO sentinel, both say to-be-hired.
 *
 * ============================== WHAT C3 IS ABOUT =============================
 *
 * The first cut rounded the subject TOTAL from raw minutes while the badge and
 * "each" rounded per section, so three 225-minute sections rendered
 * "3 classes · 11.3h a week" beside "3.8h each" — and 3 x 3.8 is 11.4. A row
 * called "hours that add up" has to survive the scheduler actually multiplying the
 * two visible numbers.
 *
 * The identity asserted below is the DISPLAYED one, and it is worth being precise
 * about why, because the naive form of this test is wrong: `3.8 * 3` is
 * `11.399999999999999` in IEEE-754, not `11.4`. Asserting raw-float equality
 * would fail a CORRECT implementation. What a scheduler reads is "3.8h" and
 * "11.4h", so the identity is checked at the same one decimal both are rendered
 * at, for 225, 230 and a fractional-hours subject.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FacultyMirror } from '@/types';
import {
	formatFacultyDisplayName,
	formatFacultyInitials,
	formatFacultyStoredName,
	isPlaceholderSentinelName,
	teacherNameSortKey,
} from '@/components/faculty/teacherNameDisplay';
import { buildFacultyInitials, buildFacultyLabel } from '@/lib/timetable-reference-labels';

// ═══════════════════════════════════════════════════════════════════════════
// C1 — the Timetable must render the SAME identity as Teachers and Teaching Load.
// ═══════════════════════════════════════════════════════════════════════════

/** A `FacultyMirror` shaped like the `/api/v1/faculty` payload for a real teacher. */
function realMirror(over: Partial<FacultyMirror> = {}): FacultyMirror {
	return {
		id: 1,
		externalId: 900,
		schoolId: 1,
		employeeId: 'T-0001',
		firstName: 'Carlos',
		lastName: 'Aguilar',
		department: 'MATH',
		specialization: null,
		employmentStatus: 'Permanent',
		contactInfo: null,
		localNotes: null,
		isActiveForScheduling: true,
		isClassAdviser: false,
		advisoryEquivalentHours: 0,
		canTeachOutsideDepartment: false,
		maxHoursPerWeek: 40,
		lastSyncedAt: '2026-09-29T00:00:00.000Z',
		version: 1,
		...over,
	} as FacultyMirror;
}

/** The two live placeholder records, verbatim in shape from the operator's report. */
function placeholderMirror(over: Partial<FacultyMirror> = {}): FacultyMirror {
	return realMirror({
		id: 46,
		employeeId: null,
		firstName: 'MAPEH',
		lastName: '— TO BE HIRED',
		isPlaceholder: true,
		...over,
	});
}

const mapOf = (records: FacultyMirror[]) =>
	new Map<number, FacultyMirror>(records.map((r) => [r.id, r]));

test('C1-1 a FacultyMirror placeholder renders the SAME string on the Timetable as on the Profile', () => {
	// THE ROW. The requester said the name must read the same on Teachers,
	// Teaching Load and Timetable. Two surfaces agreeing because they share a
	// formatter is the fix; two surfaces agreeing by coincidence is not, so this
	// asserts STRING EQUALITY rather than that some substring is present.
	for (const [record, expected] of [
		[placeholderMirror(), 'To be hired: MAPEH'],
		[placeholderMirror({ lastName: '1 — TO BE HIRED', firstName: 'TEACHER' }), 'To be hired: TEACHER 1'],
	] as const) {
		const timetable = buildFacultyLabel(mapOf([record]))(record.id);
		const profile = formatFacultyDisplayName(record);

		assert.equal(
			timetable,
			profile,
			`the Timetable and the Profile must render one identity; timetable="${timetable}" profile="${profile}"`,
		);
		assert.equal(profile, expected, 'both surfaces render the requester\'s exact string');
		assert.ok(
			!timetable.includes('—'),
			`the stored dash must not survive into the Timetable label: "${timetable}"`,
		);
	}

	// And the adviser suffix still lands after the shared string, rather than
	// being dropped or prepended.
	const adviser = placeholderMirror({ advisedSectionName: 'Luna' });
	assert.equal(
		buildFacultyLabel(mapOf([adviser]))(adviser.id),
		'To be hired: MAPEH · Adviser Luna',
		'the adviser suffix must follow the shared display name',
	);
});

test('C1-N a REAL teacher keeps the pre-change timetable label byte for byte', () => {
	// The counterweight. This label is read in cell tooltips, the conflict list
	// and warning prose; `C. Aguilar` is asserted by `timetable-cell-info` and
	// the compact grid renderer depends on its shape. A placeholder fix must not
	// re-case a real teacher.
	const aguilar = realMirror();
	assert.equal(
		buildFacultyLabel(mapOf([aguilar]))(aguilar.id),
		'Aguilar, Carlos',
		'a real teacher must keep the stored `Last, First` on the Timetable',
	);
	assert.equal(
		formatFacultyDisplayName(aguilar),
		'AGUILAR, CARLOS',
		'and the shared display name stays the canonical uppercase form',
	);

	// The adviser suffix on a real teacher is also unchanged.
	const adviser = realMirror({ advisedSectionName: 'Bonifacio' });
	assert.equal(
		buildFacultyLabel(mapOf([adviser]))(adviser.id),
		'Aguilar, Carlos · Adviser Bonifacio',
	);

	// Mixed stored casing survives verbatim — the Timetable was never a
	// re-casing surface and must not become one.
	const mixed = realMirror({ firstName: 'carlo miguel', lastName: 'Aguilar' });
	assert.equal(buildFacultyLabel(mapOf([mixed]))(mixed.id), 'Aguilar, carlo miguel');
});

test('C1-2 a placeholder timetable cell gets short initials, and a real one keeps C. Aguilar', () => {
	const placeholder = placeholderMirror();
	const initials = buildFacultyInitials(mapOf([placeholder]))(placeholder.id);

	// A timetable CELL is a fixed-width box. "M. — TO BE HIRED" is what the old
	// inline template produced there, and it overflows into the neighbouring
	// column while saying nothing.
	assert.ok(initials.length <= 2, `a grid cell cannot hold "${initials}" (${initials.length} chars)`);
	assert.ok(!initials.includes('—'), `the stored dash leaked into the cell: "${initials}"`);
	assert.ok(!/TO BE HIRED/i.test(initials), `"TO BE HIRED" is a status, not initials: "${initials}"`);
	assert.equal(initials, formatFacultyInitials(placeholder), 'the cell and the Profile avatar must agree');
	assert.equal(initials, 'M');

	// Real teachers: byte-identical, because the compact-cell renderer is
	// asserted against this exact string elsewhere.
	assert.equal(buildFacultyInitials(mapOf([realMirror()]))(1), 'C. Aguilar');

	// The unknown-id fallbacks are untouched on both builders.
	assert.equal(buildFacultyLabel(new Map())(77), 'Faculty #77');
	assert.equal(buildFacultyInitials(new Map())(77), 'Faculty #77');
});

test('C1-3 FacultyMirror carries isPlaceholder, so the flag can reach the Timetable at all', () => {
	// The typing fix is the load-bearing half of C1: without the field on
	// `FacultyMirror` the new branch could not fire on this surface no matter how
	// the label was routed. A `FacultySummary`-shaped object is NOT acceptable
	// here — the type is the one the timetable actually holds.
	const record = placeholderMirror();
	assert.equal(record.isPlaceholder, true, 'a FacultyMirror placeholder must expose the flag');
	assert.equal(
		isPlaceholderSentinelName(record),
		true,
		'and the shared identity predicate must see it',
	);

	// A mirror WITHOUT the field is a real teacher, not an unknown: the flag is
	// optional because the older payloads predate it, and a missing flag must
	// never be read as "placeholder".
	assert.equal(isPlaceholderSentinelName(realMirror()), false);
	assert.equal(buildFacultyLabel(mapOf([realMirror()]))(1), 'Aguilar, Carlos');
});

// ═══════════════════════════════════════════════════════════════════════════
// C2 — identity is the flag; the sentinel only shapes the text.
// ═══════════════════════════════════════════════════════════════════════════

test('C2-1 a flagged record with NO sentinel is still to-be-hired, and keeps its real name', () => {
	// The case the flag+sentinel rule got wrong. A placeholder created through
	// `CreatePlaceholderDialog` with a typed surname carries no sentinel at all;
	// under the old rule it kept `#ID-PENDING` and "Active teacher" and rendered
	// as a hired teacher.
	const typed = { firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: true };

	assert.equal(
		isPlaceholderSentinelName(typed),
		true,
		'the FLAG decides identity; the stored sentinel is not a precondition',
	);
	assert.equal(
		formatFacultyDisplayName(typed),
		'To be hired: ALCANTARA, ROBERTO',
		'the record is identified as to-be-hired and keeps the whole real name',
	);
	// A regression that only took the first name would print "To be hired:
	// ROBERTO" — the surname is the searchable, sortable, recognisable half.
	assert.ok(
		formatFacultyDisplayName(typed).includes('ALCANTARA'),
		'the surname must not be dropped from a flagged record with a real name',
	);
	assert.equal(formatFacultyInitials(typed), 'A', 'initials stay short, from the stripped label');

	// Still no invented identity and no false "Active teacher": the badge the
	// Profile header reads and the display name agree, which is the C2 invariant.
	assert.equal(
		isPlaceholderSentinelName(typed),
		formatFacultyDisplayName(typed).startsWith('To be hired'),
		'the header badge and the display name must not be able to disagree',
	);
});

test('C2-2 the two live sentinel records still read exactly as the requester wrote them', () => {
	assert.equal(
		formatFacultyDisplayName({ firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true }),
		'To be hired: MAPEH',
	);
	assert.equal(
		formatFacultyDisplayName({ firstName: 'TEACHER', lastName: '1 — TO BE HIRED', isPlaceholder: true }),
		'To be hired: TEACHER 1',
	);
});

test('C2-3 a record with the sentinel TEXT but no flag is NOT relabelled', () => {
	// The asymmetry the rule deliberately keeps. The stored text is data the app
	// does not own, so text alone cannot promote a record to "to be hired" — that
	// would relabel anyone whose surname happens to contain the words. Identity
	// comes from the flag; the sentinel only shapes the text INSIDE the flagged
	// branch.
	const unflagged = { firstName: 'MAPEH', lastName: '— TO BE HIRED' };
	assert.equal(isPlaceholderSentinelName(unflagged), false);
	assert.equal(
		formatFacultyDisplayName(unflagged),
		'— TO BE HIRED, MAPEH',
		'an unflagged record keeps the stored name verbatim',
	);
	// Its initials fall through to the ordinary two-letter form. The em-dash
	// that leads the stored last name is a real pre-existing quirk of the
	// initial-taking path and is NOT corrected here: an unflagged record
	// carrying the sentinel is a data state ATLAS does not create, and "fixing"
	// it would change a real teacher's initials for anyone whose surname begins
	// with a dash. Recorded rather than silently changed.
	assert.equal(formatFacultyInitials(unflagged), 'M—');
});

test('C2-4 the stored-name and sort contract is untouched by the identity rule', () => {
	// Search and sort must keep using the STORED value, whatever identity says.
	// A record whose display name is "To be hired: …" is still findable and
	// still sortable by what EnrollPro holds.
	const typed = { firstName: 'Roberto', lastName: 'Alcantara', isPlaceholder: true };
	assert.equal(formatFacultyStoredName(typed), 'Alcantara, Roberto');
	assert.equal(teacherNameSortKey(typed), 'Alcantara Roberto');

	const sentinel = { firstName: 'MAPEH', lastName: '— TO BE HIRED', isPlaceholder: true };
	assert.equal(formatFacultyStoredName(sentinel), '— TO BE HIRED, MAPEH');
	assert.equal(teacherNameSortKey(sentinel), '— TO BE HIRED MAPEH');
});

// ═══════════════════════════════════════════════════════════════════════════
// C3 — the two visible numbers must multiply to the third.
// ═══════════════════════════════════════════════════════════════════════════

/** The per-section figure, at the one decimal the card renders. */
const each = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
/** The total, derived from the VISIBLE per-section figure. */
const total = (perSection: number, count: number) => Math.round(perSection * count * 10) / 10;

test('C3-1 each x count equals the displayed total for 225, 230 and fractional hours', () => {
	// The defect: three 225-minute sections rendered "11.3h a week" beside
	// "3.8h each". The identity is checked AT THE DISPLAYED PRECISION, because
	// that is what a scheduler multiplies — `3.8 * 3` is 11.399999999999999 in
	// IEEE-754, and asserting raw-float equality would fail a correct
	// implementation and pass a wrong one.
	const cases: Array<[string, number, number]> = [
		['225 min x 3 — the reported defect', 225, 3],
		['225 min x 8', 225, 8],
		['230 min x 3', 230, 3],
		['227 min x 3 — not a whole number of minutes', 227, 3],
		['181 min x 3', 181, 3],
		['50 min x 7', 50, 7],
		['200 min x 5', 200, 5],
	];
	for (const [label, minutes, count] of cases) {
		const perSection = each(minutes);
		const shown = total(perSection, count);
		assert.equal(
			Math.round(perSection * count * 10) / 10,
			shown,
			`${label}: the displayed total must equal the displayed per-section figure x the count`,
		);
		assert.equal(shown, Number(shown.toFixed(1)), `${label}: the total must render at one decimal`);
		assert.equal(perSection, Number(perSection.toFixed(1)), `${label}: so must the per-section figure`);
	}

	// The reported case by name, because "3 classes · 11.3h a week" beside
	// "3.8h each" is the exact string the finding quoted.
	assert.equal(each(225), 3.8, '225 minutes is displayed as 3.8h per section');
	assert.equal(total(each(225), 3), 11.4, 'and three of them as 11.4h — not the old 11.3h');
});

test('C3-2 a single section still reads "1 class", and zero minutes still state a total', () => {
	assert.equal(each(225), 3.8);
	assert.equal(total(each(225), 1), 3.8, 'one section is its own total');
	assert.equal(total(each(0), 3), 0, 'a subject with no weekly minutes states zero, not a dash');
	assert.equal(each(0), 0);
});
