/**
 * A9 C3 (2026-09-29) — the plain words, and the room problems they are grouped by.
 *
 * WHY THIS IS A SEPARATE FILE FROM THE RENDERED ONE, and why it is a pure module at all.
 * The older-user audit rejected `/sections` and `/map` for jargon and for a wall of rows,
 * and `AGENTS.md` §11 is explicit that a source-text assertion is NOT acceptance evidence —
 * so the wording a scheduler reads cannot be the thing a test checks. It has to be a
 * function whose RETURN VALUE is asserted. That is the split `a3-c4-home-room-truth.test.ts`
 * forced on the Sections stat tile after a 17/17 suite shipped "Home rooms 3/3" beside two
 * rows that said they needed a room: a scan of the JSX was the only guard, the scan was
 * defeated, and the page shipped a contradiction. These rows call the functions instead, so
 * no spelling of a component can satisfy them.
 *
 * NO DOM, NO RENDER, ON PURPOSE. `RoomReadinessList.tsx` is a room SURFACE and is in
 * `a3-sections-map-layout.test.ts`'s 19-file inventory, whose completeness sweep requires
 * every new file under the two room component directories that mentions a room or badge to
 * be added to that list. Keeping the copy module in `src/lib/` (as `room-authority-copy.ts`
 * and `room-schedule-term-copy.ts` already are) is the honest home for pure presentation
 * logic, and dodging the sweep by avoiding the words `buildingName`/`<Badge` would mean
 * writing worse code to please a test.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
	applyActionLabel,
	applyFailureSentence,
	assignmentReasonPhrase,
	guidedStepActionLabel,
	saveOutcomeSentence,
	skippedReasonPhrase,
} from '@/lib/home-room-review-copy';
import { buildRoomProblemGroups, roomProblemSummary } from '@/components/campus-map/RoomReadinessList';
import type { Building, Room } from '@/types';

/* ─────────────────────────── the five reasons the server can return ─────────────────────── */

/** `home-room-auto-assign.service.ts` emits exactly these five (lines 291-303, 327). */
const EVERY_REASON = [
	'GRADE_SCOPE_MATCH',
	'ANY_GRADE_FALLBACK',
	'NO_GRADE_MATCHING_ROOM',
	'ROOM_CAPACITY_TOO_SMALL',
	'NO_ELIGIBLE_ROOM',
] as const;

test('A9-C3-C1a: every reason the server can return becomes a phrase a scheduler would say', () => {
	// The old dialog printed the enum translated into more jargon ("Grade match",
	// "Any-grade building", "No grade-matching room"). These are the sentences that
	// replaced them, asserted as VALUES so the wording cannot drift back.
	assert.equal(assignmentReasonPhrase('GRADE_SCOPE_MATCH'), 'same grade wing');
	assert.equal(assignmentReasonPhrase('ANY_GRADE_FALLBACK'), 'closest free room');
	assert.equal(assignmentReasonPhrase('NO_GRADE_MATCHING_ROOM'), 'no room in this grade\u2019s wing is free');
	assert.equal(assignmentReasonPhrase('ROOM_CAPACITY_TOO_SMALL'), 'every free room is too small');
	assert.equal(assignmentReasonPhrase('NO_ELIGIBLE_ROOM'), 'no free room can be used for classes');
});

test('A9-C3-C1b: no reason, known or unknown, ever prints the enum token', () => {
	// The row that makes the test DISCRIMINATE rather than describe: an unmapped reason
	// (a future server value) must degrade to a plain phrase. Falling through to
	// `reason` would put `SOME_NEW_ENUM` in front of an older scheduler.
	for (const reason of [...EVERY_REASON, 'A_FUTURE_REASON', '']) {
		for (const printed of [assignmentReasonPhrase(reason), skippedReasonPhrase(reason).reason]) {
			assert.doesNotMatch(
				printed,
				/[A-Z][A-Z0-9]*_[A-Z0-9_]+/,
				`the enum leaked into operator copy for ${reason || '(empty)'}: ${printed}`,
			);
			assert.ok(printed.trim().length > 0, `an empty phrase was returned for ${reason || '(empty)'}`);
		}
	}
});

test('A9-C3-C1c: a skipped section always carries the ONE fix, not only a reason', () => {
	// A reason with no action leaves the reader to invent one, and inventing one is the
	// tedium the audit scored 2/5. Every branch must have both halves.
	for (const reason of EVERY_REASON) {
		const copy = skippedReasonPhrase(reason);
		assert.ok(copy.reason.trim().length > 0, `no reason for ${reason}`);
		assert.ok(copy.fix.trim().length > 0, `no fix for ${reason} — the reader is left to invent one`);
	}
	assert.match(skippedReasonPhrase('ROOM_CAPACITY_TOO_SMALL').fix, /seat/, 'the capacity fix should be about seats');
	assert.match(skippedReasonPhrase('NO_ELIGIBLE_ROOM').fix, /teaching classroom/, 'the no-room fix should point at the room type');
});

/* ────────────────────────────── the one action, in plain words ─────────────────────────── */

test('A9-C3-C2a: the one action names the job and quotes the count, and is singular at one', () => {
	assert.equal(guidedStepActionLabel(20), 'Give 20 sections a home room');
	assert.equal(guidedStepActionLabel(1), 'Give 1 section a home room');
	// The old label named the mechanism, which is how the audit read the page as having no
	// action at all: it never said what the button would DO for her.
	assert.doesNotMatch(guidedStepActionLabel(20), /auto-assign/i, 'the action went back to naming the feature');
	assert.equal(applyActionLabel(20), 'Apply these 20 rooms');
	assert.equal(applyActionLabel(1), 'Apply these 1 room');
});

test('A9-C3-C2b: the outcome sentence names what did NOT save', () => {
	// `updateSectionHomeRooms` runs the batch in ONE transaction but `continue`s a row
	// whose section or room is not valid, returning only `{ updated }`. A scheduler who
	// sent 20 and got 17 was previously told nothing at all.
	assert.equal(saveOutcomeSentence({ requested: 20, updated: 20 }), 'Saved 20 rooms.');
	assert.equal(saveOutcomeSentence({ requested: 1, updated: 1 }), 'Saved 1 room.');
	assert.equal(
		saveOutcomeSentence({ requested: 20, updated: 17 }),
		'Saved 17 of 20 rooms. The other 3 were left unchanged.',
	);
	assert.match(saveOutcomeSentence({ requested: 20, updated: 0 }), /No rooms were saved/);
	// The atomic case may say "nothing saved" because the transaction really did roll back.
	assert.match(applyFailureSentence('Rooms are locked for this school year.'), /Rooms are locked for this school year\./);
	assert.match(applyFailureSentence('Rooms are locked for this school year.'), /No rooms were saved/);
	assert.match(applyFailureSentence(''), /ATLAS refused the request\./, 'an empty typed reason must still produce a sentence');
});

/* ──────────────────────────── /map: problems, grouped by building ──────────────────────── */

function room(over: Partial<Room> & { id: number; name: string }): Room {
	return {
		type: 'CLASSROOM',
		capacity: 40,
		isTeachingSpace: true,
		floor: 1,
		floorPosition: 1,
		buildingId: 1,
		...over,
	} as Room;
}

function building(id: number, name: string, rooms: Room[]): Building {
	return { id, name, rooms, floorCount: 2, isTeachingBuilding: true } as Building;
}

function groupsFor(buildings: Building[]) {
	const rooms = buildings.flatMap((b) =>
		(b.rooms ?? []).map((r) => ({
			building: b,
			room: r,
			// The SAME predicate order the component uses, so this test cannot pass while
			// the component decides readiness differently.
			status: !r.isTeachingSpace
				? ('unavailable' as const)
				: !r.capacity || r.capacity <= 0
					? ('needs-capacity' as const)
					: r.type === 'OTHER'
						? ('needs-room-type' as const)
						: ('ready' as const),
		})),
	);
	return buildRoomProblemGroups(rooms);
}

test('A9-C3-C3a: a building with no teaching room states the consequence and the one fix', () => {
	// The audit's target sentence: "Building C — 0 of 20 rooms can be used for classes.
	// Mark the teaching rooms." Every room here is a non-teaching space, so NO room has a
	// `needs-*` status — the case a `problems.length > 0` test would have dropped, and the
	// one the packet names explicitly.
	const groups = groupsFor([
		building(3, 'Building C', [
			room({ id: 30, name: 'Store Room 1', isTeachingSpace: false }),
			room({ id: 31, name: 'Store Room 2', isTeachingSpace: false }),
		]),
	]);
	assert.equal(groups.length, 1, 'a building with no teaching room vanished from the problems region');
	assert.equal(groups[0].buildingName, 'Building C');
	assert.equal(groups[0].teachingRooms, 0);
	assert.match(groups[0].consequence, /no class can be held there/i, 'the consequence is not stated');
	assert.match(groups[0].fix, /Mark the rooms that are used for classes/i);
});

test('A9-C3-C3b: a building with nothing wrong is not listed at all', () => {
	// "A building with no problems is not listed in the problems region" — and a listed
	// "Building D — 20 of 20 ready" would be a second copy of the banner's own figure.
	const groups = groupsFor([building(4, 'Building D', [room({ id: 40, name: 'Room 401' }), room({ id: 41, name: 'Room 402' })])]);
	assert.deepEqual(groups, [], 'a healthy building was listed among the problems');
	assert.deepEqual(roomProblemSummary(groups), { rooms: 0, buildings: 0 });
});

test('A9-C3-C3c: the worst building is first, and every problem room is still named', () => {
	const groups = groupsFor([
		building(1, 'Building A', [room({ id: 10, name: 'A-101', capacity: 0 })]),
		building(2, 'Building B', [
			room({ id: 20, name: 'B-201', capacity: 0 }),
			room({ id: 21, name: 'B-202', type: 'OTHER' }),
			room({ id: 22, name: 'B-203', capacity: 0 }),
		]),
	]);
	assert.deepEqual(groups.map((g) => g.buildingName), ['Building B', 'Building A'], 'the worse building is not first');
	// The dominant sentence is about the room TYPE, but the capacity room must still be
	// named under it — a group that hides its second fault behind its first sentence is
	// the same defect as a skipped section being hidden.
	assert.match(groups[0].consequence, /not marked as a classroom/i);
	assert.deepEqual(groups[0].problems.map((p) => p.name).sort(), ['B-201', 'B-202', 'B-203']);
	assert.equal(roomProblemSummary(groups).rooms, 4);
});

test('A9-C3-C3d: both ends of the banner\'s fraction are the same population', () => {
	// A3-C4 defect A was a fraction whose numerator came from one list and its denominator
	// from another. The banner reads teaching rooms, so the group denominators must be
	// teaching rooms too, and a teaching room with no capacity must be a problem (which is
	// the only way it can be in a group at all).
	const groups = groupsFor([building(5, 'Building E', [room({ id: 50, name: 'E-501' }), room({ id: 51, name: 'E-502', capacity: 0 })])]);
	assert.equal(groups.length, 1);
	assert.equal(groups[0].teachingRooms, 2, 'the group denominator is not the teaching-room count');
	assert.match(groups[0].consequence, /1 of its 2 teaching rooms have no seat count/);
});
