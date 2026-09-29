import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { TimetableToolbar } from '@/components/timetable/TimetableToolbar';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { SimpleActiveFilterChips } from '@/components/timetable/simple/SimpleFilterControls';

test('native timetable grid, desktop toolbar, and simple filter-chip scrollers use the thin scrollbar utility', () => {
	const entry = {
		entryId: 'scrollbar-entry', sectionId: 701, facultyId: 9, roomId: 9, subjectId: 1,
		day: 'MONDAY', startTime: '08:00', endTime: '08:45', durationMinutes: 45, termIndex: 1,
	} as any;
	const grid = renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entry], timeSlots: [{ startTime: '08:00', endTime: '08:45' }],
		violationIndex: new Map(), highlightedEntryIds: new Set<string>(), selectedEntry: null, followUps: new Set<string>(),
		onEntryClick: () => {}, subjectLabel: () => 'Math', sectionLabel: () => '7-A', gradeForSection: () => 7,
		entryContextLabel: () => '7-A', formatFacultyInitials: () => 'AB', facultyLabel: () => 'Teacher A',
		viewMode: 'section', pivotLabel: () => '7-A', roomLabelShort: () => 'Room 1', kbSelectedSource: null,
		onKbPlace: () => {}, getCellConflict: () => null, getLiveCellConflict: () => null,
		onNavToFaculty: () => {}, onNavToSection: () => {}, onNavToRoom: () => {},
	}));
	assert.match(grid, /class="overflow-auto scrollbar-thin"/, 'grid drop container keeps native scrolling with the thin utility');

	const toolbar = renderToStaticMarkup(createElement(TimetableToolbar, {
		viewMode: 'section', viewModeLabels: { section: 'Section' }, onViewModeChange: () => {},
		entityFilter: '701', onEntityFilterChange: () => {}, groupedPivotEntities: [{ label: 'Sections', ids: [701] }],
		pivotLabel: () => '7-A', programFilter: 'all', onProgramFilterChange: () => {}, programFilterOptions: [{ value: 'all', label: 'All programs' }],
		entryKindFilter: 'all', onEntryKindFilterChange: () => {}, entryKindFilterOptions: [{ value: 'all', label: 'All entries' }],
		termFilter: 1, onTermFilterChange: () => {}, termOptions: [{ value: '1', label: 'Term 1' }], activeTermIndex: 1,
	}));
	/* A5 c8 (2026-09-29) — RE-POINTED, RETAINED (`AGENTS.md` §16). This row used to read:
	 *
	 *   assert.match(toolbar, /class="[^"]*overflow-x-auto[^"]*scrollbar-thin[^"]*" data-tutorial="grid-controls"/,
	 *     'desktop toolbar control scroller is styled');
	 *
	 * i.e. it asserted that the `/timetable` schedule controls were a HORIZONTAL SCROLL
	 * CONTAINER, and that the guided walk's target was on it. The Codex sweep filed
	 * that strip as its own control language, and `AGENTS.md` §8's no-global-scrollbar
	 * rule says a filter row must WRAP rather than scroll: a sideways-scrolling bar
	 * hides controls with no cue. The controls are now `@/ui/filter-bar`'s one
	 * `flex flex-wrap items-center gap-2` row.
	 *
	 * The row's real claim is preserved and is now the stronger one: the schedule
	 * controls are NOT a scroller, and the walk's `[data-tutorial="grid-controls"]`
	 * target still lands on them. Both halves are asserted below; nothing was dropped.
	 */
	assert.doesNotMatch(toolbar, /overflow-x-auto/, 'the schedule controls scroll sideways again instead of wrapping onto a second line');
	assert.match(toolbar, /flex-wrap/, 'the schedule controls no longer wrap');
	assert.match(toolbar, /data-tutorial="grid-controls"/, 'the guided walk lost its target on the schedule controls');

	const context = {
		programFilter: 'special', entryKindFilter: 'subject', severityFilter: 'all',
		PROGRAM_FILTER_OPTIONS: [{ value: 'all', label: 'All programs' }, { value: 'special', label: 'Special program' }],
		ENTRY_KIND_FILTER_OPTIONS: [{ value: 'all', label: 'All entries' }, { value: 'subject', label: 'Subjects only' }],
		setProgramFilter: () => {}, setEntryKindFilter: () => {}, setSeverityFilter: () => {},
	} as unknown as ScheduleReviewWorkspaceHeaderContext;
	const chips = renderToStaticMarkup(createElement(SimpleActiveFilterChips, { context }));
	assert.match(chips, /class="[^"]*overflow-x-auto[^\"]*scrollbar-thin[^"]*" data-testid="timetable-active-filters"/, 'simple active-filter chips are styled');
});
