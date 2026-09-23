import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableGrid } from '../../components/timetable/TimetableGrid';
import {
	buildFacultyInitials,
	buildFacultyLabel,
	buildRoomLabel,
	buildRoomLabelShort,
	buildSectionLabel,
	buildSubjectLabel,
} from '../timetable-reference-labels';
import { resolveCellTeacherText, resolveTermFacultyId } from '../timetable-cell-teacher';
import type { ExternalSection, FacultyMirror, ScheduledEntry, Subject } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/* ── Reference-label resolution (Defect 1) ─────────────────────────────── */

const SUBJECT_ONE = { id: 1, code: 'FIL', displayCode: 'FIL' } as unknown as Subject;
const SUBJECT_ELEVEN = { id: 11, code: 'TLE', displayCode: 'TLE' } as unknown as Subject;
const SUBJECT_MAP = new Map<number, Subject>([[1, SUBJECT_ONE], [11, SUBJECT_ELEVEN]]);

const FACULTY_ONE = { id: 1, firstName: 'Carlos', lastName: 'Aguilar' } as unknown as FacultyMirror;
const FACULTY_NINE = { id: 9, firstName: 'Carlos', lastName: 'Aguilar' } as unknown as FacultyMirror;
const FACULTY_TWELVE = { id: 12, firstName: 'Josefa', lastName: 'Dela Cruz' } as unknown as FacultyMirror;
const FACULTY_MAP = new Map<number, FacultyMirror>([
	[1, FACULTY_ONE],
	[9, FACULTY_NINE],
	[12, FACULTY_TWELVE],
]);

const SECTION_ONE = { id: 1, name: 'G7AW', displayOrder: 7 } as unknown as ExternalSection;
const SECTION_MAP = new Map<number, ExternalSection>([[1, SECTION_ONE]]);

const ROOM_ONE = { id: 1, name: 'G7 Room 101', buildingShortCode: 'G7', floor: 1 };
const ROOM_MAP = new Map<number, typeof ROOM_ONE>([[1, ROOM_ONE]]);

test('reference ids resolve by numeric primary key, including id 1 (no falsy/default branch)', () => {
	// This is the negative control: a `map.get(id) || fallback`, an off-by-one
	// index, or a `0`-indexed assumption fails exactly on id 1.
	assert.equal(buildSubjectLabel(SUBJECT_MAP)(1), 'FIL');
	assert.equal(buildSubjectLabel(SUBJECT_MAP)(11), 'TLE');
	assert.equal(buildFacultyLabel(FACULTY_MAP)(1), 'Aguilar, Carlos');
	assert.equal(buildFacultyInitials(FACULTY_MAP)(9), 'C. Aguilar');
	assert.equal(buildSectionLabel(SECTION_MAP, () => 'Regular')(1), 'GR7 - G7AW');
	assert.equal(buildRoomLabel(ROOM_MAP)(1), 'G7 Room 101 · G7 (Floor 1)');
	assert.equal(buildRoomLabelShort(ROOM_MAP)(1), 'G7 Room 101 · G7');
});

test('unknown ids fall back to a stable id label and never to a permanent loading placeholder', () => {
	const emptySubjects = buildSubjectLabel(new Map<number, Subject>());
	const emptyFaculty = buildFacultyLabel(new Map<number, FacultyMirror>());
	const emptyFacultyInitials = buildFacultyInitials(new Map<number, FacultyMirror>());
	const emptySections = buildSectionLabel(new Map<number, ExternalSection>(), () => 'Regular');
	const emptyRooms = buildRoomLabelShort(new Map<number, typeof ROOM_ONE>());

	assert.equal(emptySubjects(1), 'Subject #1');
	assert.equal(emptyFaculty(9), 'Faculty #9');
	assert.equal(emptyFacultyInitials(9), 'Faculty #9');
	assert.equal(emptySections(1), 'Section #1');
	assert.equal(emptyRooms(9), 'Room #9');
	for (const label of [emptySubjects(1), emptyFaculty(9), emptyFacultyInitials(9), emptySections(1), emptyRooms(9)]) {
		assert.doesNotMatch(label, /Loading/i, 'no cell may be stuck on a loading placeholder');
	}
	// An unknown id with a populated map is an honest id label, not a load state.
	assert.equal(buildRoomLabelShort(ROOM_MAP)(999), 'Room #999');
});

/* ── Per-term teacher resolution (Defect 2) ────────────────────────────── */

const COMPACT_ROTATING_ENTRY = {
	entryId: 'compact-rotating',
	facultyId: 9,
	roomId: 9,
	subjectId: 1,
	sectionId: 701,
	day: 'MONDAY',
	startTime: '11:30',
	endTime: '12:15',
	durationMinutes: 45,
	metadata: {
		modularAssignments: [
			{ termIndex: 1, facultyId: 9, subjectCode: 'FIL' },
			{ termIndex: 2, facultyId: 12, subjectCode: 'TLE' },
		],
	},
} as unknown as Pick<ScheduledEntry, 'facultyId' | 'metadata'>;

const TERM_ONE_ENTRY: ScheduledEntry = {
	entryId: 'term1-entry',
	sectionId: 701,
	facultyId: 9,
	roomId: 9,
	subjectId: 1,
	day: 'MONDAY',
	startTime: '11:30',
	endTime: '12:15',
	durationMinutes: 45,
	termIndex: 1,
};

const TERM_TWO_ENTRY: ScheduledEntry = {
	...TERM_ONE_ENTRY,
	entryId: 'term2-entry',
	subjectId: 11,
	facultyId: 12,
	termIndex: 2,
};

test('a compact rotating lane resolves the teacher of the selected term', () => {
	assert.equal(resolveTermFacultyId(COMPACT_ROTATING_ENTRY, 1), 9);
	assert.equal(resolveTermFacultyId(COMPACT_ROTATING_ENTRY, 2), 12);
	// A term the lane does not name never reuses another term's teacher.
	assert.equal(resolveTermFacultyId(COMPACT_ROTATING_ENTRY, 3), null);
	// All-term review reads the entry-level owner; entries are never merged.
	assert.equal(resolveTermFacultyId(COMPACT_ROTATING_ENTRY, 'all'), 9);
	assert.equal(resolveCellTeacherText(COMPACT_ROTATING_ENTRY, 1, buildFacultyInitials(FACULTY_MAP)), 'C. Aguilar');
	assert.equal(resolveCellTeacherText(COMPACT_ROTATING_ENTRY, 2, buildFacultyInitials(FACULTY_MAP)), 'J. Dela Cruz');
	assert.equal(resolveCellTeacherText(COMPACT_ROTATING_ENTRY, 3, buildFacultyInitials(FACULTY_MAP)), 'No teacher');
});

/* ── Rendered cell content (Defect 1 + Defect 2) ───────────────────────── */

function renderGrid(entries: ScheduledEntry[], termFilter: 'all' | number): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries,
		timeSlots: [{ startTime: '11:30', endTime: '12:15' }],
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: (id: number) => (id === 1 ? 'FIL' : id === 11 ? 'TLE' : `Subject ${id}`),
		sectionLabel: () => 'G7AW',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7AW',
		formatFacultyInitials: (id: number) => (id === 9 ? 'C. AGUILAR' : id === 12 ? 'J. DELA CRUZ' : `Faculty #${id}`),
		facultyLabel: (id: number) => `Faculty ${id}`,
		viewMode: 'section',
		termFilter,
		pivotLabel: () => '',
		roomLabelShort: () => 'G7 Room 101 · G7',
		kbSelectedSource: null,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	}));
}

test('a populated section cell renders the assigned teacher with the subject and room', () => {
	const markup = renderGrid([TERM_ONE_ENTRY], 1);
	assert.ok(markup.includes('FIL'), 'subject label renders');
	assert.ok(markup.includes('C. AGUILAR'), 'assigned teacher name renders in section view');
	// C01R C2: the visible cell drops the room's repeated building grade once
	// (`G7 Room 101 · G7` renders as `Room 101 · G7`); the full label stays
	// behind the cell Tooltip.
	assert.ok(markup.includes('Room 101 · G7'), 'room label renders without its repeated grade prefix');
	assert.match(markup, /data-testid="timetable-cell-detail"[^>]*data-cell-term="1"[^>]*data-cell-teacher="C\. AGUILAR"/);
});

test('changing the selected term changes the teacher rendered on the cell', () => {
	const termOneMarkup = renderGrid([TERM_ONE_ENTRY], 1);
	const termTwoMarkup = renderGrid([TERM_TWO_ENTRY], 2);
	assert.ok(termOneMarkup.includes('C. AGUILAR'));
	assert.ok(!termOneMarkup.includes('J. DELA CRUZ'));
	assert.ok(termTwoMarkup.includes('J. DELA CRUZ'));
	assert.ok(!termTwoMarkup.includes('C. AGUILAR'));
});

test('all-term review renders each term on its own entry instead of merging the teacher', () => {
	const markup = renderGrid([TERM_ONE_ENTRY, TERM_TWO_ENTRY], 'all');
	assert.equal((markup.match(/data-timetable-entry="true"/g) ?? []).length, 2, 'both term entries render separately');
	assert.ok(markup.includes('C. AGUILAR'), 'term 1 teacher renders');
	assert.ok(markup.includes('J. DELA CRUZ'), 'term 2 teacher renders');
});

/* ── Source binding: the cell uses the shared resolvers, no raw title ──── */

test('the grid cell binds to the shared per-term resolver and uses no raw title attribute', () => {
	const grid = source('src/components/timetable/TimetableGrid.tsx');
	assert.match(grid, /resolveCellTeacherText\(entry, termFilter, formatFacultyInitials\)/);
	assert.doesNotMatch(grid, /title=/, 'hover detail must use a @/ui primitive, not a raw title attribute');
});

test('the section-view cell no longer hides the teacher and the hook no longer emits loading placeholders', () => {
	const hook = source('src/hooks/useTimetableData.ts');
	assert.doesNotMatch(hook, /Loading subject name|Loading teacher name|Loading room name|Loading section name/);
	assert.match(hook, /buildSubjectLabel\(subjectMap\)/);
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /showTeacherDetails\s*\n?\s*pivotLabel/);
});
