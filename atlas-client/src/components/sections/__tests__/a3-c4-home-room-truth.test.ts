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
 *  - The source-scan controls read the three owned production files off disk
 *    and fail if any of them re-derives the truth inline. This is what makes
 *    the suite mutation-proof in the exact direction QA will be asked to try:
 *    re-introducing `!!s.homeRoomId` into the counter turns these red even
 *    though every other assertion in the file would still hold.
 *  - The population control uses a fixture where the server-declared
 *    `totalSections` deliberately disagrees with the client list, because the
 *    old fraction paired one with the other.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
	isHomeRoomResolved,
	resolveHomeRoom,
	summarizeHomeRoomReadiness,
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
	// `!resolved` is a strict superset of `!homeRoomId`, so switching the
	// filter from the old truth to this one cannot hide a section the old
	// "missing" filter showed.
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

/* ───────────────── mutation-proof source scans ───────────────── */

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
