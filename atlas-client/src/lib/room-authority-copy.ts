/**
 * GENERATION-AUTHORITY-REALISM-C07 (R8) — single shared room-authority copy
 * authority.
 *
 * Every operator-facing surface (subject form, subject/coverage panel, room
 * views) must read the CLASSROOM / LABORATORY semantics from this one module so
 * the wording can never diverge:
 *
 *   - `CLASSROOM`   → "regular classroom; special-room use handled outside this timetable"
 *   - `LABORATORY`  → "reserve a laboratory through this timetable"
 *
 * The copy is descriptive only. It never encodes which room a subject is
 * scheduled into — that authority is the persisted `Subject.preferredRoomType`
 * and is resolved server-side.
 */

import type { RoomType } from '@/types';

export interface RoomAuthorityCopy {
	/** The persisted room-authority value this copy describes. */
	roomType: RoomType;
	/** Short operator-facing label. */
	label: string;
	/** Exact operator-facing meaning of the authority. */
	semantics: string;
	/**
	 * True when this authority reserves a specialist room INSIDE this timetable.
	 * `CLASSROOM` is false: special-room use is coordinated outside the weekly
	 * class timetable.
	 */
	reservesSpecialistRoomInTimetable: boolean;
}

/** Exact CLASSROOM semantics required by the beneficiary contract. */
export const CLASSROOM_AUTHORITY_SEMANTICS = 'regular classroom; special-room use handled outside this timetable';

/** Exact LABORATORY semantics required by the beneficiary contract. */
export const LABORATORY_AUTHORITY_SEMANTICS = 'reserve a laboratory through this timetable';

export const ROOM_AUTHORITY_COPY: Record<RoomType, RoomAuthorityCopy> = {
	CLASSROOM: {
		roomType: 'CLASSROOM',
		label: 'Classroom',
		semantics: CLASSROOM_AUTHORITY_SEMANTICS,
		reservesSpecialistRoomInTimetable: false,
	},
	LABORATORY: {
		roomType: 'LABORATORY',
		label: 'Laboratory',
		semantics: LABORATORY_AUTHORITY_SEMANTICS,
		reservesSpecialistRoomInTimetable: true,
	},
	COMPUTER_LAB: {
		roomType: 'COMPUTER_LAB',
		label: 'ICT Lab',
		semantics: 'reserve an ICT laboratory through this timetable',
		reservesSpecialistRoomInTimetable: true,
	},
	TLE_WORKSHOP: {
		roomType: 'TLE_WORKSHOP',
		label: 'TLE Workshop',
		semantics: 'reserve a TLE workshop through this timetable',
		reservesSpecialistRoomInTimetable: true,
	},
	LIBRARY: {
		roomType: 'LIBRARY',
		label: 'Library',
		semantics: 'reserve the library through this timetable',
		reservesSpecialistRoomInTimetable: true,
	},
	GYMNASIUM: {
		roomType: 'GYMNASIUM',
		label: 'Gymnasium',
		semantics: 'reserve the gymnasium through this timetable',
		reservesSpecialistRoomInTimetable: true,
	},
	FACULTY_ROOM: {
		roomType: 'FACULTY_ROOM',
		label: 'Teacher Room',
		semantics: 'teacher workroom; not a learner teaching space',
		reservesSpecialistRoomInTimetable: false,
	},
	OFFICE: {
		roomType: 'OFFICE',
		label: 'Office',
		semantics: 'administrative office; not a learner teaching space',
		reservesSpecialistRoomInTimetable: false,
	},
	OTHER: {
		roomType: 'OTHER',
		label: 'Other',
		semantics: 'other facility; use is coordinated outside this timetable',
		reservesSpecialistRoomInTimetable: false,
	},
};

/** The shared copy authority for one persisted room-authority value. */
export function roomAuthorityCopyOf(roomType: RoomType): RoomAuthorityCopy {
	return ROOM_AUTHORITY_COPY[roomType] ?? {
		roomType,
		label: String(roomType),
		semantics: 'other facility; use is coordinated outside this timetable',
		reservesSpecialistRoomInTimetable: false,
	};
}

/** The exact semantics sentence for one persisted room-authority value. */
export function roomAuthoritySemantics(roomType: RoomType): string {
	return roomAuthorityCopyOf(roomType).semantics;
}

/**
 * R8: `preferredRoomType` is NEVER an unconditional requirement for a
 * `CLASSROOM` authority. Only authorities that reserve a specialist room inside
 * this timetable may be framed that way.
 */
export function roomAuthorityReservesSpecialistRoom(roomType: RoomType): boolean {
	return roomAuthorityCopyOf(roomType).reservesSpecialistRoomInTimetable;
}
