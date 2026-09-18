/**
 * QF-CELL-INFO — Graceful reference-label resolution.
 *
 * `useTimetableData` intentionally keeps the timetable usable when the
 * reference-data read fails or is still in flight (`fetchReferenceData(...).catch(() => {})`).
 * The former label callbacks returned a `Loading …` placeholder whenever their
 * lookup map was empty, so a failed or absent reference load left cells stuck on
 * "Loading subject name…"/"Loading room name…" forever instead of the ID
 * fallback the swallow-on-failure design already assumed.
 *
 * These builders implement that ID fallback: a missing/unknown id resolves to a
 * stable id-based label (e.g. `Subject #1`) and never to a permanent loading
 * placeholder. Lookups always use the real numeric primary key, so id `1` is a
 * first-class key and is never treated as falsy.
 */

import type { ExternalSection, FacultyMirror, Subject } from '@/types';

export type RoomLabelSource = {
	id: number;
	name: string;
	buildingShortCode?: string | null;
	buildingName?: string | null;
	floor?: number | null;
};

export function buildSubjectLabel(
	subjectMap: ReadonlyMap<number, Subject>,
): (id: number) => string {
	return (id) => {
		const subject = subjectMap.get(id);
		if (!subject) return `Subject #${id}`;
		return subject.displayCode ?? subject.code;
	};
}

export function buildFacultyLabel(
	facultyMap: ReadonlyMap<number, FacultyMirror>,
): (id: number) => string {
	return (id) => {
		const faculty = facultyMap.get(id);
		if (!faculty) return `Faculty #${id}`;
		const adviserSuffix = faculty.advisedSectionName ? ` · Adviser ${faculty.advisedSectionName}` : '';
		return `${faculty.lastName}, ${faculty.firstName}${adviserSuffix}`;
	};
}

export function buildFacultyInitials(
	facultyMap: ReadonlyMap<number, FacultyMirror>,
): (id: number) => string {
	return (id) => {
		const faculty = facultyMap.get(id);
		if (!faculty) return `Faculty #${id}`;
		const initial = faculty.firstName ? `${faculty.firstName.charAt(0).toUpperCase()}.` : '';
		const label = `${initial} ${faculty.lastName}`.trim();
		return label.length > 0 ? label : `Faculty #${id}`;
	};
}

export function buildSectionLabel(
	sectionMap: ReadonlyMap<number, ExternalSection>,
	programBadgeLabel: (programType?: string | null, programCode?: string | null) => string,
): (id: number) => string {
	return (id) => {
		const section = sectionMap.get(id);
		if (!section) return `Section #${id}`;
		const programLabel = section.programType && section.programType !== 'REGULAR'
			? ` · ${programBadgeLabel(section.programType, section.programCode)}`
			: '';
		return `${section.name}${programLabel}`;
	};
}

export function buildRoomLabel(
	roomMap: ReadonlyMap<number, RoomLabelSource>,
): (id: number) => string {
	return (id) => {
		const room = roomMap.get(id);
		if (!room) return `Room #${id}`;
		const building = room.buildingShortCode || room.buildingName;
		return `${room.name} · ${building} (Floor ${room.floor})`;
	};
}

export function buildRoomLabelShort(
	roomMap: ReadonlyMap<number, RoomLabelSource>,
): (id: number) => string {
	return (id) => {
		const room = roomMap.get(id);
		if (!room) return `Room #${id}`;
		const building = room.buildingShortCode || room.buildingName;
		return building ? `${room.name} · ${building}` : room.name;
	};
}
