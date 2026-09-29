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
import { resolveSectionGradeNumber } from '@/lib/schedule-review-helpers';
import {
	formatFacultyDisplayName,
	formatFacultyInitials,
	isPlaceholderSentinelName,
} from '@/components/faculty/teacherNameDisplay';

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
		if (subject.displayCode) return subject.displayCode;
		// Lane C train 12: a code with an underscore (DEVL_READING, STE_APPLIED_PHYS) is an
		// internal token, not a short label; the scheduler reads the subject's name instead.
		if (subject.code.includes('_') && subject.name) return subject.name;
		return subject.code;
	};
}

export function buildFacultyLabel(
	facultyMap: ReadonlyMap<number, FacultyMirror>,
): (id: number) => string {
	return (id) => {
		const faculty = facultyMap.get(id);
		if (!faculty) return `Faculty #${id}`;
		const adviserSuffix = faculty.advisedSectionName ? ` · Adviser ${faculty.advisedSectionName}` : '';
		// A3 C17 C1. The requester named THREE surfaces that must agree — Teachers,
		// Teaching Load, Timetable — and the Timetable was the one that did not:
		// this rebuilt `${lastName}, ${firstName}` from the stored fields, so the
		// SAME to-be-hired record read "To be hired: MAPEH" on the roster and
		// "— TO BE HIRED, MAPEH" in a timetable cell. Two identities for one
		// person, on two screens open at once.
		//
		// It is routed through the shared display contract ONLY for a placeholder.
		// A real teacher's output must stay byte-identical to the template above:
		// this label is read in cell tooltips, the conflict list and the warning
		// text, and a silent re-case there would be a regression, not a fix. The
		// stored form is what those surfaces have always shown, so it is what they
		// keep.
		if (isPlaceholderSentinelName(faculty)) {
			return `${formatFacultyDisplayName(faculty)}${adviserSuffix}`;
		}
		return `${faculty.lastName}, ${faculty.firstName}${adviserSuffix}`;
	};
}

export function buildFacultyInitials(
	facultyMap: ReadonlyMap<number, FacultyMirror>,
): (id: number) => string {
	return (id) => {
		const faculty = facultyMap.get(id);
		if (!faculty) return `Faculty #${id}`;
		// A3 C17 C1. This builder's own template — `${initial} ${lastName}` —
		// turned a placeholder into "M. — TO BE HIRED" inside a timetable CELL, a
		// fixed-width box that can hold a couple of characters. A placeholder gets
		// the same short initials the Profile avatar uses; a real teacher keeps
		// "C. Aguilar" exactly, which the compact-cell renderer depends on.
		if (isPlaceholderSentinelName(faculty)) {
			const initials = formatFacultyInitials(faculty);
			return initials.length > 0 ? initials : `Faculty #${id}`;
		}
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
		const grade = resolveSectionGradeNumber(section);
		const gradeLabel = grade != null ? `GR${grade} - ` : '';
		return `${gradeLabel}${section.name}${programLabel}`;
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
