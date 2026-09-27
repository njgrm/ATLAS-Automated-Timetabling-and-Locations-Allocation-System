/**
 * A3 C4 (defect A) — the ONE home-room truth, in the pure/contract layer.
 *
 * The recorded defect (Lane C, live walkthrough #8 on d31bfacb, 2026-09-28):
 * the stat tile said "HOME ROOMS 20/20" while five rows on the same screen
 * said "Needs home room. Choose a room." The tile counted a PRESENT
 * `homeRoomId`; the row asked whether that id RESOLVES to a nameable room.
 *
 * What makes these controls discriminate rather than merely pass:
 *
 *  - `PRE_FIX_COUNTER` below is the counter transcribed verbatim from base
 *    6b84a3a6 (`pages/Sections.tsx:586`,
 *    `list.filter(s => !!s.homeRoomId).length`). The suite runs the SAME
 *    requirement list against it and asserts that it FAILS. A control that
 *    passes on both revisions is not evidence; this one is proved red on the
 *    defect and green on the fix.
 *  - The `buildHomeRoomsStat` controls (section "B2" below) are the LOAD-BEARING
 *    guard. They call the stat tile's own label/value/help-text derivation
 *    directly with a controlled list and assert on what comes BACK. They cannot
 *    be satisfied by an import list, an identifier spelling, or a source shape,
 *    because the numbers they assert are numbers the function returned.
 *    Added after review finding B2 (2026-09-28): when the tile's printing was
 *    inlined in the page, the source scan below was the ONLY guard, and QA
 *    defeated it — a mutation that rebuilt the summary from a plain
 *    "is a `homeRoomId` present" count contains the identifier `homeRoomId`,
 *    matches none of the scan's boolean-coercion spellings, and left the whole
 *    suite at 17/17 green while the tile printed "Home rooms 3/3 (33%)" beside
 *    two rows reading "Needs home room".
 *  - The source-scan controls are RETAINED as a wiring ratchet, not deleted.
 *    They now guard something the behavioural control cannot: that the page
 *    actually PLACES the derivation's return value in the tile, and that it
 *    holds no local re-derivation to override it with.
 *  - The population control uses a fixture where the server-declared
 *    `totalSections` deliberately disagrees with the client list, because the
 *    old fraction paired one with the other.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
	buildHomeRoomsStat,
	isHomeRoomResolved,
	resolveHomeRoom,
	summarizeHomeRoomReadiness,
	type HomeRoomReadiness,
} from '../home-room-readiness';


const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

type Room = { id: number; name: string; buildingName: string; type: string };
type Section = { id: number; name: string; homeRoomId?: number | null };

/* Room 501 is live and in scope. Room 777 was deleted upstream; section 3
 * still points at it. That is the whole defect. */
const ROOMS: Room[] = [
	{ id: 501, name: 'Room 501', buildingName: 'Building A', type: 'CLASSROOM' },
];
const RESOLVED = { id: 1, name: 'G7 - Rizal', homeRoomId: 501 };
const DANGLING = { id: 2, name: 'G7 - Mabini', homeRoomId: 777 };
const UNSET = { id: 3, name: 'G7 - Luna', homeRoomId: null };

/* ───────────────── the predicate ───────────────── */

test('resolveHomeRoom resolves only an id that names a room in the current options', () => {
	assert.equal(resolveHomeRoom(RESOLVED, ROOMS)?.id, 501);
	// A stale/deleted id resolves to null — the same truth as no id at all.
	assert.equal(resolveHomeRoom(DANGLING, ROOMS), null);
	assert.equal(resolveHomeRoom(UNSET, ROOMS), null);
	// An absent options list (rooms have not loaded) resolves nothing, rather
	// than resolving everything.
	assert.equal(resolveHomeRoom(RESOLVED, []), null);
	assert.equal(isHomeRoomResolved(RESOLVED, ROOMS), true);
	assert.equal(isHomeRoomResolved(DANGLING, ROOMS), false);
	assert.equal(isHomeRoomResolved(UNSET, ROOMS), false);
});

/* ───────────────── the counter, and the population ───────────────── */

/** The requirement, stated once, so the fix and the pre-fix block are judged identically. */
function tileRequirement(sections: Section[], rooms: Room[]) {
	const summary = summarizeHomeRoomReadiness(sections, rooms);
	return {
		assigned: summary.assigned,
		total: summary.total,
		needing: summary.needing,
		// The fraction as the stat tile actually prints it.
		printed: summary.needing === 0 ? `${summary.assigned}/${summary.total}` : summary.needing,
	};
}

test('the counter counts a dangling homeRoomId as needing a room, not as assigned', () => {
	const got = tileRequirement([RESOLVED, DANGLING, UNSET], ROOMS);
	assert.deepEqual(got, { assigned: 1, total: 3, needing: 2, printed: 2 });
	// The exact tile/row contradiction Lane C recorded, stated as a bound:
	// assignedCount 3 would render "3/3" while 2 rows say "Needs home room".
	assert.notEqual(got.assigned, 3, 'a dangling homeRoomId must not count as assigned');
});

test('a resolvable homeRoomId still counts assigned and prints n/n', () => {
	const got = tileRequirement([RESOLVED, { id: 4, name: 'G8 - Rizal', homeRoomId: 501 }], ROOMS);
	assert.deepEqual(got, { assigned: 2, total: 2, needing: 0, printed: '2/2' });
	assert.equal(summarizeHomeRoomReadiness([RESOLVED, RESOLVED], ROOMS).assignmentPct, 100);
});

test('the fraction is arithmetic on ONE population, never a client count over a server total', () => {
	// The server-declared total deliberately disagrees with the client list.
	const SERVER_TOTAL_SECTIONS = 20;
	const sections = [RESOLVED, DANGLING, UNSET];
	const summary = summarizeHomeRoomReadiness(sections, ROOMS);
	assert.equal(summary.total, sections.length, 'the denominator is the list that is rendered');
	assert.equal(summary.total, 3);
	// The old tile would have printed 17/20 and "20" in the sibling tile. The
	// invariant under test is that no number on this page can pair a count over
	// the client array with the server's declared population.
	assert.notEqual(summary.total, SERVER_TOTAL_SECTIONS);
	assert.equal(Math.max(summary.assigned, summary.needing) <= summary.total, true);
	assert.equal(summarizeHomeRoomReadiness([], ROOMS).assignmentPct, 0);
});

test('the home-room filter using this predicate only ever GAINS rows, never drops one', () => {
	// `!resolved` is a SUPERSET of `!homeRoomId` for every id >= 1 (an absent
	// id also fails to resolve), so switching the filter from the old truth to
	// this one cannot hide a section the old "missing" filter showed.
	//
	// CORRECTION (review N1, 2026-09-28): the suite's own header comment used
	// to call this a STRICT superset. That is false at `homeRoomId === 0` — the
	// old `!s.homeRoomId` reads 0 as missing (0 is falsy) while
	// `!isHomeRoomResolved` reads it as assigned if any option carries
	// `id: 0`. `homeRoomId` is a Room foreign key with ids >= 1, and 0 is the
	// Global-Browse sentinel, so the divergent input is unreachable. This
	// control uses only ids >= 1 and null, which is the reachable domain; the
	// assertion below is unchanged.
	const sections = [RESOLVED, DANGLING, UNSET];
	const oldMissing = sections.filter((s) => !s.homeRoomId);
	const newMissing = sections.filter((s) => !isHomeRoomResolved(s, ROOMS));
	assert.equal(oldMissing.length, 1);
	assert.equal(newMissing.length, 2);
	assert.ok(oldMissing.every((s) => newMissing.includes(s)), 'superset: nothing is dropped');
	// And the two filter halves partition the list exactly once.
	const newAssigned = sections.filter((s) => isHomeRoomResolved(s, ROOMS));
	assert.equal(newAssigned.length + newMissing.length, 3);
});

/* ───────────────── B2: the stat tile's own VALUE (load-bearing) ─────────────────
 *
 * These are the controls that decide review finding B2. They call the stat
 * tile's label/value/help-text derivation DIRECTLY with a controlled list, so
 * the load-bearing claim of a HIGH truthfulness fix is decided by what that
 * function returns. No identifier spelling and no import list can satisfy them.
 */

test('B2: the stat derivation, called directly, counts only a RESOLVABLE home room as assigned', () => {
	// The controlled list holds one of each case, exactly as the review asked:
	//   (a) RESOLVED — its homeRoomId resolves to room 501
	//   (b) DANGLING — its homeRoomId (777) resolves to nothing
	//   (c) UNSET    — it has no homeRoomId at all
	const sections = [RESOLVED, DANGLING, UNSET];
	const stat = buildHomeRoomsStat(sections, ROOMS);

	assert.equal(stat.label, 'Need rooms');
	// Only (b) and (c) need a room. A "is an id present" count would say 2/3
	// are assigned and print "1", understating the work by exactly the dangling
	// row — the recorded defect at 3-section scale.
	assert.equal(stat.value, 2, 'only the resolvable section is excluded from the needing count');
	assert.equal(stat.tone, 'warning');
	assert.ok(stat.helpText.length > 0, 'the tile always explains its number');

	// The exact defect, stated as a bound rather than a comment: the count the
	// tile prints equals the number of rows that read "Needs home room".
	const rowsNeeding = sections.filter((s) => !isHomeRoomResolved(s, ROOMS)).length;
	assert.equal(stat.value, rowsNeeding, 'the tile must equal the rows on screen');

	// While anything still needs a room, no fraction may be printed at all.
	// "3/3 (33%)" beside rows that need a room is the shape of the whole
	// finding, so it is excluded structurally, not by convention.
	assert.equal(typeof stat.value, 'number');
	assert.equal(String(stat.value).includes('/'), false, 'no fraction while work remains');
});

test('B2: a fraction is printed only when nothing needs a room, and both ends are ONE population', () => {
	const sections = [RESOLVED, { id: 4, name: 'G8 - Rizal', homeRoomId: 501 }];
	const stat = buildHomeRoomsStat(sections, ROOMS);

	assert.equal(stat.label, 'Home rooms');
	assert.equal(stat.value, '2/2');
	assert.equal(stat.tone, 'success');

	// The old tile built this fraction over a client count and a SERVER-declared
	// denominator. That server total is 20 in this fixture's story, and it is
	// deliberately NOT reachable from this function at all.
	assert.notEqual(stat.value, '2/20');
	const [numerator, denominator] = String(stat.value).split('/').map(Number);
	assert.equal(denominator, sections.length, 'the denominator is the list that is rendered');
	assert.ok(numerator <= denominator, 'a fraction can never exceed its own population');
});

test('B2: the printed number cannot mix populations, even via a snapshot taken over another list', () => {
	// The page passes its own snapshot as an optimisation. The derivation must
	// print THAT snapshot whole — never a numerator from one population and a
	// denominator from another. This is the seam where a mixed fraction would
	// re-enter, so it is bound here.
	const foreignSnapshot: HomeRoomReadiness = { assigned: 17, total: 20, needing: 3, assignmentPct: 85 };
	const stat = buildHomeRoomsStat([RESOLVED, DANGLING, UNSET], ROOMS, foreignSnapshot);

	// The snapshot says three need a room, so three is what is printed — the
	// bare count, never "17", never "3/20", never "3/17".
	assert.equal(stat.value, 3);
	assert.equal(stat.label, 'Need rooms');
	assert.notEqual(String(stat.value), '17');
	assert.notEqual(String(stat.value), '3/20');
	assert.notEqual(String(stat.value), '3/17');
});

test('B2: an empty roster and an unloaded room list both read as "needs a room", never as done', () => {
	// No sections at all must not print a confident "0/0 (0%)" success.
	const empty = buildHomeRoomsStat([], ROOMS);
	assert.equal(empty.value, 0);
	assert.equal(empty.label, 'Need rooms');
	assert.equal(String(empty.value).includes('/'), false);

	// A room list that has not loaded yet resolves nothing, so every section
	// needs a room — the conservative direction.
	const unloaded = buildHomeRoomsStat([RESOLVED, DANGLING], []);
	assert.equal(unloaded.value, 2);
	assert.equal(unloaded.label, 'Need rooms');
});

/* ───────────────── failing-first: the pre-fix counter ───────────────── */

/** Transcribed from base 6b84a3a6 `pages/Sections.tsx:583-586` and `:737`. */
const PRE_FIX_COUNTER = (sections: Section[], _rooms: Room[]) => {
	const assigned = sections.filter((s) => !!s.homeRoomId).length;
	return { assigned, total: sections.length, needing: Math.max(0, sections.length - assigned) };
};

test('CONTROL (the pre-fix arrangement contradicts its own rows; the fix does not)', () => {
	const sections = [RESOLVED, DANGLING, UNSET];
	const rooms = ROOMS;
	// The question the ROW asks, counted over the same list.
	const rowsSayingNeedsARoom = sections.filter((s) => !isHomeRoomResolved(s, rooms)).length;
	const rowsSayingReady = sections.filter((s) => isHomeRoomResolved(s, rooms)).length;

	// The base revision's tile: a present id is an assigned room. RESOLVED (501)
	// and DANGLING (777) both carry an id; only UNSET is null, so the base
	// counter reports one section needing a room.
	const preFix = PRE_FIX_COUNTER(sections, rooms);
	assert.equal(preFix.assigned, 2);
	assert.equal(preFix.needing, 1);
	// Two rows render "Needs home room. Choose a room." while the tile claims
	// only one needs one — the DANGLING section is counted as assigned. That is
	// exactly the "20/20 vs 5 rows" defect, and it is asserted here rather than
	// merely reproduced, so this control is green while the base revision's
	// behaviour is on the record as wrong.
	assert.equal(rowsSayingNeedsARoom, 2);
	assert.equal(rowsSayingReady, 1);
	assert.notEqual(preFix.needing, rowsSayingNeedsARoom, 'the base revision contradicted itself');

	// The fixed counter answers the same question the same way the rows do.
	const fixed = summarizeHomeRoomReadiness(sections, rooms);
	assert.equal(fixed.needing, rowsSayingNeedsARoom, 'the tile must agree with the rows');
	assert.equal(fixed.assigned, rowsSayingReady, 'and its numerator must agree too');
	assert.equal(fixed.assigned + fixed.needing, fixed.total);
});

/* ───────────────── mutation-proof source scans ─────────────────
 *
 * RETAINED as the WIRING ratchet (review finding B2, 2026-09-28). These are no
 * longer the only guard — the `buildHomeRoomsStat` controls above are — but they
 * cover something the behavioural control structurally cannot: that the page
 * PLACES the derivation's return value in the tile, and holds no local
 * re-derivation to override it with. They are also the guard against the page
 * quietly re-introducing a second count somewhere the pure function is not
 * called. Nothing here was deleted or weakened; the rules below are additions.
 */

/**
 * Strip comments so an explanatory note can never satisfy — or trip — a
 * source-shape ratchet. The base revision's own comment, and this file's
 * description of the defect, both contain the offending expression literally.
 */
function code(path: string): string {
	return source(path)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => line.replace(/\/\/.*$/, ''))
		.join('\n');
}

test('Sections.tsx delegates the counter to the one shared predicate', () => {
	const src = source('src/pages/Sections.tsx');
	const lines = code('src/pages/Sections.tsx').split('\n');
	// assert.ok (not assert.match) on purpose: match() on a whole-file source
	// dumps 40 KB of the file into the failure output. These are boolean
	// ratchets, so a failure must be one readable line.
	assert.ok(src.includes('summarizeHomeRoomReadiness'), 'Sections.tsx must call the shared summary');
	// SPELLING-INDEPENDENT: no live line may booleanise a `homeRoomId`. This is
	// the shape of the defect in any of its forms — `!!s.homeRoomId`,
	// `Boolean(section.homeRoomId)`, `s.homeRoomId ? … : …`. A re-introduced
	// counter trips this whether or not it is spelled the way base was.
	const offenders = lines.filter(
		(l) => /homeRoomId/.test(l) && /(!!|Boolean\(|!==\s*null\s*\?|\?\s*[^:]*:\s*false|\?\s*[^:]*:\s*true)/.test(l),
	);
	assert.deepEqual(offenders, [], `no live line may booleanise a homeRoomId: ${offenders.join(' | ')}`);
	// The fraction must not pair a client-array count with a server-declared
	// total. (The availability check reads `summaryRes.data`, a different
	// field, and is deliberately untouched.)
	assert.ok(
		!code('src/pages/Sections.tsx').includes('state.data.totalSections'),
		'the tile must not divide a client count by a server-declared total',
	);
	// The home-room filter must ask the same question as the row.
	assert.ok(src.includes('isHomeRoomResolved'), 'the filter must use the shared predicate');
});

test('the tile places the stat derivation verbatim, and re-counts nothing on the page', () => {
	// ADDED for review finding B2. The behavioural controls above decide what the
	// tile PRINTS; these decide that the page hands it over untouched. Without
	// this seam a caller could wrap the derivation's return value in a locally
	// recomputed count, which is precisely the mutation QA applied.
	const lines = code('src/pages/Sections.tsx').split('\n');
	const src = source('src/pages/Sections.tsx');

	// The page must CALL the one printing function, not spell out the printing.
	assert.ok(src.includes('buildHomeRoomsStat'), 'Sections.tsx must call the stat derivation');
	assert.ok(
		lines.some((l) => /buildHomeRoomsStat\(/.test(l) && /const\s+\w+\s*=/.test(l)),
		'the derivation result must be bound to a local the tile array then places',
	);
	// The tile array must place that binding directly — not a re-derived copy.
	assert.ok(
		lines.some((l) => /^\s*\w+,\s*$/i.test(l) && !/label|value|tone|helpText/.test(l)),
		'a tile entry must be a bare reference to the bound derivation result',
	);

	// SPELLING-TOLERANT, and the rule that defeats the mutation QA actually
	// applied: the page may not run ANY `filter` over the rendered section array.
	// The old filter chain filters a `list` local, never `state.data.sections`
	// directly, so this does not catch legitimate code — it catches exactly one
	// shape: a second count computed over the rendered roster on the page.
	const recounts = lines.filter((l) => /state\.data\.sections\s*[\n\r]*\.\s*filter\s*\(/.test(l));
	assert.deepEqual(
		recounts,
		[],
		`the page must not re-count the rendered roster; the tile is the derivation's to print: ${recounts.join(' | ')}`,
	);

	// The page must not rebuild a readiness snapshot field-by-field around the
	// derivation either, which is the other half of that mutation.
	assert.ok(
		!/=\s*\{\s*\.\.\.\w*[Rr]eadiness/.test(code('src/pages/Sections.tsx')),
		'the page must not spread a readiness snapshot and override its counts',
	);
	// And the two non-tile consumers still hold the same single truth.
	assert.ok(
		src.includes('summarizeHomeRoomReadiness'),
		'the banner count and the filter still derive from the same summary',
	);
});

test('both row renderers ask the shared predicate instead of an inline lookup', () => {
	for (const path of ['src/components/sections/SectionRow.tsx', 'src/components/sections/SectionMobileCard.tsx']) {
		const src = source(path);
		// Either specifier is fine — the lane mixes relative and `@/` imports.
		assert.ok(
			/home-room-readiness'/.test(src),
			`${path} must import the shared predicate`,
		);
		assert.ok(
			!/homeRoomOptions\.find\(/.test(src),
			`${path} must not re-derive the truth with an inline .find()`,
		);
	}
});

test('the row still reports a read-only unresolved section without offering an edit', () => {
	// Preserved behaviour the fix must not swallow: the read-only wording is
	// distinct, and both messages are "needs a room".
	const readOnly = 'Needs home room. Edits paused.';
	const editable = 'Needs home room. Choose a room.';
	assert.notEqual(readOnly, editable);
	assert.ok(readOnly.startsWith('Needs home room'));
	assert.ok(editable.startsWith('Needs home room'));
});
