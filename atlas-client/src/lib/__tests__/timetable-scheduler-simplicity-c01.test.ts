import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { resolveTimetableTermScopeState } from '@/hooks/useTimetableData';

const clientRoot = resolve(import.meta.dirname, '../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

function entry(entryId: string, termIndex: number) {
	return {
		entryId,
		facultyId: 10 + termIndex,
		roomId: 20 + termIndex,
		subjectId: 30 + termIndex,
		sectionId: 40,
		day: 'MONDAY',
		startTime: '08:00',
		endTime: '08:45',
		durationMinutes: 45,
		termIndex,
		entryKind: 'SUBJECT',
	} as any;
}

function renderAllTerms() {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [entry('term-1', 1), entry('term-2', 2), entry('term-3', 3)],
		timeSlots: [{ startTime: '08:00', endTime: '08:45' }],
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => undefined,
		subjectLabel: (id: number) => `Subject ${id}`,
		sectionLabel: () => 'G7-A',
		gradeForSection: () => 7,
		entryContextLabel: () => 'G7-A',
		formatFacultyInitials: (id: number) => `F${id}`,
		facultyLabel: (id: number) => `Faculty ${id}`,
		viewMode: 'section',
		termFilter: 'all',
		pivotLabel: () => 'Section',
		roomLabelShort: (id: number) => `Room ${id}`,
		kbSelectedSource: null,
		onKbPlace: () => undefined,
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => undefined,
		onNavToSection: () => undefined,
		onNavToRoom: () => undefined,
	} as any));
}

test('all-terms renders every session directly and has no overflow reveal control', () => {
	const markup = renderAllTerms();
	assert.match(markup, /data-timetable-entry-id="term-1"/);
	assert.match(markup, /data-timetable-entry-id="term-2"/);
	assert.match(markup, /data-timetable-entry-id="term-3"/);
	assert.doesNotMatch(markup, /timetable-cell-overflow-trigger/);
	assert.doesNotMatch(markup, /timetable-cell-overflow-sheet/);
});

test('term selection is fail-closed when the verified ordered contract is absent', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /activeTermContext\?\.verified === true/);
	assert.match(hook, /orderedTerms\?\.some\(\(term\) => term\.order === activeTermContext\.termIndex\)/);
	assert.match(hook, /\: \[\{ value: 'all', label: 'All terms' \}\]/);
	assert.match(hook, /: 'all'\);/);
	assert.doesNotMatch(hook, /activeTermIndex >= 1/);
});

test('mounted timetable lifecycle gate waits for active term, then preserves deliberate all-terms override', () => {
	const missing = resolveTimetableTermScopeState(null, 'all', false);
	assert.equal(missing.queryEnabled, false);
	assert.equal(missing.termIndex, null);
	assert.equal(missing.status, 'checking');

	const blocked = resolveTimetableTermScopeState({
		source: 'none', reachable: false, verified: false, activeTerm: null, termIndex: null,
		schoolYearId: 9, matchedSchoolYear: false, code: 'TERM_UNRESOLVED', message: 'Set up terms',
		orderedTerms: [],
	}, 'all', false);
	assert.equal(blocked.queryEnabled, false);
	assert.equal(blocked.status, 'setup-required');

	const verifiedContext = {
		source: 'enrollpro', reachable: true, verified: true, activeTerm: 'Term 2', termIndex: 2,
		schoolYearId: 9, matchedSchoolYear: true, code: null, message: 'Verified',
		orderedTerms: [{ identity: 'T1', displayLabel: 'Term 1', order: 1 }, { identity: 'T2', displayLabel: 'Term 2', order: 2 }],
	};
	const active = resolveTimetableTermScopeState(verifiedContext, 2, false);
	assert.deepEqual(active, { authorityReady: true, queryEnabled: true, termIndex: 2, status: 'active' });

	const allTerms = resolveTimetableTermScopeState(verifiedContext, 'all', true);
	assert.deepEqual(allTerms, { authorityReady: true, queryEnabled: true, termIndex: 'all', status: 'active' });
});

test('scheduler orientation exposes school year, term authority, scope, and one safe next action', () => {
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /data-testid="timetable-scheduler-orientation"/);
	assert.match(header, /School year:/);
	assert.match(header, /Term setup required/);
	assert.match(header, /Scope:/);
	assert.match(header, /Next:/);
});
