/**
 * GENERATION-AUTHORITY-REALISM-C07 (C07-S12) — the single client room-authority
 * copy authority.
 *
 * Run: `npx tsx --test src/lib/__tests__/room-authority-copy.test.ts` from
 * `atlas-client`.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	CLASSROOM_AUTHORITY_SEMANTICS,
	LABORATORY_AUTHORITY_SEMANTICS,
	ROOM_AUTHORITY_COPY,
	roomAuthorityCopyOf,
	roomAuthorityReservesSpecialistRoom,
	roomAuthoritySemantics,
} from '../room-authority-copy.js';
import { ROOM_TYPE_LABELS } from '../room-type-labels.js';

test('C07-S12a. CLASSROOM authority keeps the exact "handled outside this timetable" semantics and never reserves a specialist room', () => {
	assert.equal(roomAuthoritySemantics('CLASSROOM'), 'regular classroom; special-room use handled outside this timetable');
	assert.equal(roomAuthoritySemantics('CLASSROOM'), CLASSROOM_AUTHORITY_SEMANTICS);
	assert.equal(roomAuthorityReservesSpecialistRoom('CLASSROOM'), false);
	assert.equal(roomAuthorityCopyOf('CLASSROOM').reservesSpecialistRoomInTimetable, false);
});

test('C07-S12b. LABORATORY authority keeps the exact "reserve a laboratory through this timetable" semantics', () => {
	assert.equal(roomAuthoritySemantics('LABORATORY'), 'reserve a laboratory through this timetable');
	assert.equal(roomAuthoritySemantics('LABORATORY'), LABORATORY_AUTHORITY_SEMANTICS);
	assert.equal(roomAuthorityReservesSpecialistRoom('LABORATORY'), true);
});

test('C07-S12c. every room type resolves through the single copy authority with a non-empty label and semantics', () => {
	for (const roomType of Object.keys(ROOM_TYPE_LABELS) as Array<keyof typeof ROOM_TYPE_LABELS>) {
		const copy = roomAuthorityCopyOf(roomType);
		assert.equal(copy.roomType, roomType, `${roomType} must resolve to its own copy`);
		assert.ok(copy.label.length > 0, `${roomType} must carry a label`);
		assert.ok(copy.semantics.length > 0, `${roomType} must carry semantics`);
	}
});

test('C07-S12d. mutant: CLASSROOM is never framed as an unconditional specialist-room requirement', () => {
	// The old Subjects.tsx copy labelled every non-CLASSROOM authority as
	// "Requires <X> facilities" and said nothing truthful about CLASSROOM. The
	// shared authority must make the CLASSROOM contract explicit instead.
	const classroom = roomAuthorityCopyOf('CLASSROOM');
	assert.equal(classroom.reservesSpecialistRoomInTimetable, false);
	assert.match(classroom.semantics, /outside this timetable/);
	assert.doesNotMatch(classroom.semantics, /^requires/i);
});
