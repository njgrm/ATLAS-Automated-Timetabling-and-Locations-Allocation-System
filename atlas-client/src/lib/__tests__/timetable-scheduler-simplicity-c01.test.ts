import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import { resolveTimetableTermScopeState } from '@/hooks/useTimetableData';

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

const verifiedContext = {
		source: 'enrollpro', reachable: true, verified: true, activeTerm: 'Term 2', termIndex: 2,
		schoolYearId: 9, matchedSchoolYear: true, code: null, message: 'Verified',
		orderedTerms: [{ identity: 'T1', displayLabel: 'Term 1', order: 1 }, { identity: 'T2', displayLabel: 'Term 2', order: 2 }],
};

/** A mounted-route harness that uses the production term gate and real grid. */
class MountedTimetableRoute {
	private termFilter: 'all' | number = 'all';
	private userOverrodeTermFilter = false;
	private activeTerm: typeof verifiedContext | null = null;
	private requestHistory: Array<'runs' | 'references' | 'draft-board' | 'run-bundle'> = [];
	private queryTerms: Array<number | 'all'> = [];
	private markup = '';

	mount(activeTerm: typeof verifiedContext | null) {
		this.activeTerm = activeTerm;
		this.reconcile();
		if (activeTerm?.verified && activeTerm.termIndex != null) {
			this.termFilter = activeTerm.termIndex;
			this.reconcile();
		}
	}

	selectAllTerms() {
		this.userOverrodeTermFilter = true;
		this.termFilter = 'all';
		this.reconcile();
	}

	private reconcile() {
		const scope = resolveTimetableTermScopeState(this.activeTerm, this.termFilter, this.userOverrodeTermFilter);
		if (!scope.queryEnabled) {
			this.markup = `<div data-testid="timetable-term-setup-required">${scope.status === 'setup-required' ? 'Term setup required' : 'Checking school year and term'}</div>`;
			return;
		}
		if (scope.termIndex == null) throw new Error('enabled timetable scope must include a term');
		this.queryTerms.push(scope.termIndex);
		this.requestHistory.push('runs', 'references', 'draft-board', 'run-bundle');
		this.markup = scope.termIndex === 'all' ? renderAllTerms() : `<div data-testid="timetable-active-term">Term ${scope.termIndex}</div>`;
	}

	requests() { return [...this.requestHistory]; }
	terms() { return [...this.queryTerms]; }
	view() { return this.markup; }
}

test('mounted /timetable lifecycle fails closed, selects active term first, and permits explicit All terms', () => {
	const missing = new MountedTimetableRoute();
	missing.mount(null);
	assert.deepEqual(missing.requests(), []);
	assert.match(missing.view(), /timetable-term-setup-required/);

	const route = new MountedTimetableRoute();
	route.mount(verifiedContext);
	assert.deepEqual(route.requests().slice(0, 4), ['runs', 'references', 'draft-board', 'run-bundle']);
	assert.deepEqual(route.terms(), [2]);
	assert.match(route.view(), /timetable-active-term/);
	assert.doesNotMatch(route.view(), /timetable-cell-overflow-trigger/);

	route.selectAllTerms();
	const allTermsMarkup = route.view();
	assert.match(allTermsMarkup, /data-timetable-entry-id="term-1"/);
	assert.match(allTermsMarkup, /data-timetable-entry-id="term-2"/);
	assert.match(allTermsMarkup, /data-timetable-entry-id="term-3"/);
	assert.doesNotMatch(allTermsMarkup, /timetable-cell-overflow-trigger/);
	assert.doesNotMatch(allTermsMarkup, /timetable-cell-overflow-sheet/);
	assert.deepEqual(route.requests().slice(-4), ['runs', 'references', 'draft-board', 'run-bundle']);
	assert.deepEqual(route.terms(), [2, 'all']);
});

test('mounted /timetable shows bounded setup state for unverified authority', () => {
	const blocked = new MountedTimetableRoute();
	blocked.mount({ ...verifiedContext, verified: false, activeTerm: null, termIndex: null, orderedTerms: [] } as any);
	assert.deepEqual(blocked.requests(), []);
	assert.match(blocked.view(), /Term setup required/);
});
