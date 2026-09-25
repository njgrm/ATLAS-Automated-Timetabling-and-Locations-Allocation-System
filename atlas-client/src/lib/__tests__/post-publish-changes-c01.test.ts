/**
 * LANE-C POST-PUBLISH-C01 — changing a published schedule.
 *
 * The 2026-09-25 live audit (docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md)
 * found: B1 a published swap calling the direct-edit route and printing the API
 * path; B2 the teacher-leaving check skipped, then a clash refused at the last
 * click with "Check the effective date and reason"; B5 four jargon warnings;
 * B6 rotating classes indistinguishable; B7 "Class A selected…" surviving Cancel.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import {
	describeRevisionClash,
	extractRevisionClashes,
	formatClockTime,
	revisionFailureHint,
	type PublishedRevisionClash,
} from '../published-revision-clashes';
import { describeDepartureRepairTruth } from '../../components/timetable/TacticalSandboxDock.helpers';
import { PublishedRevisionClashList } from '../../components/timetable/PublishedRevisionClashList';
import { PublishedSwapRevisionPanel } from '../../components/timetable/modals/PublishedSwapRevisionPanel';
import { TeacherDepartureRecoverySheetBody } from '../../components/timetable/TeacherDepartureRecoverySheet';
import { SWAP_MODE_STATUS_MESSAGES } from '../../hooks/useScheduleReviewWorkspaceState';
import { Sheet } from '../../ui/sheet';
import type { DraftReport, FacultyMirror, ScheduledEntry, TeachingLoadRepairPreviewResult } from '../../types';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const labels = {
	facultyLabel: (id: number) => (id === 7 ? 'Villanueva, Jonathan' : `Teacher ${id}`),
	sectionLabel: (id: number) => (id === 91 ? 'GR9 - Orchid' : id === 92 ? 'GR9 - Tulip' : `Section ${id}`),
	subjectLabel: (id: number) => (id === 5 ? 'SCIENCE' : `Subject ${id}`),
	roomLabel: (id: number) => `Room ${id}`,
};

const facultyClash: PublishedRevisionClash = {
	code: 'FACULTY_TIME_CONFLICT',
	title: 'Teacher double-booked',
	meaning: 'One teacher is assigned to two classes that meet at the same time.',
	action: 'Move one class or assign another qualified teacher.',
	facultyId: 7,
	roomId: null,
	sectionId: null,
	day: 'MONDAY',
	startTime: '13:45',
	endTime: '14:30',
	entries: [
		{ entryId: 'orchid', changed: false, sectionId: 91, subjectId: 5, facultyId: 7, roomId: 204, day: 'MONDAY', startTime: '13:45', endTime: '14:30', termIndex: 2 },
		{ entryId: 'tulip', changed: true, sectionId: 92, subjectId: 5, facultyId: 7, roomId: 63, day: 'MONDAY', startTime: '13:45', endTime: '14:30', termIndex: 2 },
	],
};

test('B2 a teacher clash names the teacher, both classes, the term, and the time in plain words', () => {
	const described = describeRevisionClash(facultyClash, labels);
	assert.equal(described.title, 'Teacher double-booked');
	assert.equal(
		described.sentence,
		'Villanueva, Jonathan would teach GR9 - Tulip (SCIENCE, Term 2) and GR9 - Orchid (SCIENCE, Term 2) at the same time, Monday 1:45 PM–2:30 PM.',
	);
	assert.match(described.action, /another qualified teacher/);
	assert.deepEqual(described.entryIds.sort(), ['orchid', 'tulip']);
	assert.doesNotMatch(described.sentence, /Faculty \d|FACULTY_|hard violation|merged/i, 'no ids, codes or jargon');
});

test('B2 room and section clashes read naturally; unknown codes fall back to the server copy', () => {
	const room = describeRevisionClash({ ...facultyClash, code: 'ROOM_TIME_CONFLICT', title: 'Room double-booked', facultyId: null, roomId: 63 }, labels);
	assert.match(room.sentence, /^Room 63 would hold GR9 - Tulip .* and GR9 - Orchid .* at the same time/);
	const section = describeRevisionClash({ ...facultyClash, code: 'SECTION_TIME_CONFLICT', title: 'Section double-booked', facultyId: null, sectionId: 92 }, labels);
	assert.match(section.sentence, /^GR9 - Tulip would have SCIENCE and SCIENCE at the same time/);
	const other = describeRevisionClash({ ...facultyClash, code: 'SOMETHING_NEW', title: 'Schedule conflict', meaning: 'A rule would be broken.' }, labels);
	assert.match(other.sentence, /^A rule would be broken\. Involves GR9 - Tulip/);
	assert.equal(formatClockTime('07:05'), '7:05 AM');
	assert.equal(formatClockTime('12:00'), '12:00 PM');
});

test('B2 a refused revision yields its clashes and a hint that does not blame date or reason', () => {
	const refusal = { response: { data: { code: 'PUBLISHED_REVISION_BLOCKED_HARD_VIOLATIONS', details: { clashes: [facultyClash] } } } };
	assert.equal(extractRevisionClashes(refusal).length, 1);
	assert.doesNotMatch(revisionFailureHint(refusal), /date|reason/i);
	assert.equal(revisionFailureHint({ response: { data: { actionHint: 'Server hint.' } } }), 'Server hint.');
	assert.match(revisionFailureHint({ response: { data: { code: 'EFFECTIVE_DATE_SAME_DAY' } } }), /tomorrow/i);
	assert.match(revisionFailureHint({ response: { data: { code: 'REVISION_REASON_REQUIRED' } } }), /reason/i);
	assert.deepEqual(extractRevisionClashes(new Error('network')), []);
});

test('B5 the published departure truth keeps its contract in plain words', () => {
	const copy = describeDepartureRepairTruth(true, 3);
	assert.match(copy, /published/i);
	assert.match(copy, /start date you choose/i, 'the chosen date is the only moment the change starts');
	assert.match(copy, /does not switch back/i, 'no end-date reversion is implied');
	assert.doesNotMatch(copy, /temporal authority|effective-dated revision|published run/i, 'no jargon');
});

function renderPublishedSheet() {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(Sheet, { open: true, onOpenChange: () => {} },
				createElement(TeacherDepartureRecoverySheetBody, {
					open: true,
					onOpenChange: () => {},
					initialFacultyId: null,
					draft: { entries: [], unassignedItems: [] } as unknown as DraftReport,
					facultyMap: new Map<number, FacultyMirror>(),
					subjectLabel: (id: number) => `Subject ${id}`,
					sectionLabel: (id: number) => `Section ${id}`,
					facultyLabel: (id: number) => `Faculty ${id}`,
					previewTeachingLoadRepair: async () => ({} as TeachingLoadRepairPreviewResult),
					commitTeachingLoadRepair: async () => null,
					onSaved: () => {},
					isPublished: true,
					schoolId: 1,
					schoolYearId: 9,
					runId: 42,
				}),
			),
		),
	);
}

test('B5 the published teacher-leaving sheet shows one plain note, not four warnings', () => {
	const markup = renderPublishedSheet();
	assert.equal((markup.match(/data-testid="teacher-departure-published-note"/g) ?? []).length, 1, 'exactly one published note');
	assert.match(markup, /starts on a date you choose/);
	assert.doesNotMatch(markup, /effective-date revision|sole temporal authority|Published run selected|Do not rewrite the published run/i);
});

test('B2 published mode checks for clashes at Step 4 instead of skipping it', () => {
	const sheet = source('../../components/timetable/TeacherDepartureRecoverySheet.tsx');
	assert.doesNotMatch(sheet, /isPublished && visibleStep === 2 \? 4/, 'the published skip past the check step is gone');
	assert.match(sheet, /previewPublishedRevision\(/, 'the server dry run is called');
	assert.match(sheet, /isPublished \? publishedPreviewClean : preview/, 'Step 5 is reachable only after a clean check');
	assert.match(sheet, /disabled=\{[^}]*!publishedPreviewClean\}/, 'the start-date button waits for a clean check');
	assert.match(sheet, /teacher-departure-choose-different/, 'a clash offers going back to choose another teacher');
	assert.match(sheet, /\}, \[publishedRevisionChanges\]\);/, 'changing a replacement clears the last check');
});

test('B6 rotating classes carry their term in the affected list', () => {
	const sheet = source('../../components/timetable/TeacherDepartureRecoverySheet.tsx');
	assert.match(sheet, /groupTermLabel\(group\)/);
	assert.doesNotMatch(sheet, /grid block/, '"grid block" jargon is gone');
});

test('B1 a published swap never calls the direct-edit swap route', () => {
	const mutations = source('../../hooks/useTimetableMutations.ts');
	const prompt = mutations.slice(mutations.indexOf('const openRegularSwapPrompt'), mutations.indexOf('/swap/preview`'));
	assert.match(prompt, /if \(draft && isDraftPublishedStrict\(draft\)\) \{[\s\S]*?return;/, 'published runs return before the direct preview');
	const dialogs = source('../../components/timetable/modals/TimetablePlacementDialogs.tsx');
	assert.match(dialogs, /publishedSwapScope && regularSwapPending \? \(\s*\/\/[^\n]*\n\s*<PublishedSwapRevisionPanel/, 'the dialog switches to the revision panel');
	const panel = source('../../components/timetable/modals/PublishedSwapRevisionPanel.tsx');
	assert.match(panel, /previewPublishedSwap\(/);
	assert.match(panel, /createPublishedSwapRevision\(/);
	assert.doesNotMatch(panel, /apiBase|\/swap`/, 'no direct-edit route in the panel');
});

test('B1 the published swap panel explains itself and waits for the check before asking for a date', () => {
	const entry = (entryId: string, startTime: string): ScheduledEntry => ({
		entryId, subjectId: 5, sectionId: 92, facultyId: 7, roomId: 63, day: 'MONDAY', startTime, endTime: startTime === '06:00' ? '06:45' : '07:30', durationMinutes: 45,
	} as unknown as ScheduledEntry);
	// Rendered without the Dialog portal, which static rendering cannot emit.
	const markup = renderToStaticMarkup(
		createElement(PublishedSwapRevisionPanel, {
			entryA: entry('a', '06:00'),
			entryB: entry('b', '06:45'),
			scope: { schoolId: 1, schoolYearId: 9, runId: 42 },
			...labels,
			onClose: () => {},
			onScheduled: () => {},
		}),
	);
	assert.match(markup, /starts on a date you choose/);
	assert.match(markup, /Checking both teachers, rooms and classes for clashes/);
	assert.match(markup, /Now: Monday/);
	assert.doesNotMatch(markup, /published-swap-date/, 'no date field until the check is clean');
	assert.doesNotMatch(markup, /api\/v1|published-revisions/, 'no API paths shown');
});

test('B2 the clash list renders each clash with what to do', () => {
	const markup = renderToStaticMarkup(createElement(PublishedRevisionClashList, {
		clashes: [describeRevisionClash(facultyClash, labels)],
	}));
	assert.match(markup, /1 clash found\. Nothing was saved\./);
	assert.match(markup, /Teacher double-booked/);
	assert.match(markup, /What to do: Move one class or assign another qualified teacher\./);
});

test('B2 the revision dialog no longer blames the date and reason by default', () => {
	const dialog = source('../../components/timetable/PublishedRevisionDialog.tsx');
	assert.doesNotMatch(dialog, /Check the date and reason/);
	for (const file of ['../../components/timetable/TeacherDepartureRecoverySheet.tsx', '../../components/timetable/TacticalSandboxDock.tsx']) {
		assert.doesNotMatch(source(file), /Check the effective date and reason/, `${file} fallback removed`);
		assert.match(source(file), /revisionFailureHint\(/);
	}
});

test('B7 swap-mode prompts are cleared when swap mode ends', () => {
	assert.ok(SWAP_MODE_STATUS_MESSAGES.has('Class A selected. Choose the second class to swap times with.'));
	assert.ok(SWAP_MODE_STATUS_MESSAGES.has('Choose a different occupied class than Class A.'));
	const state = source('../../hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(state, /if \(swapClassTimesMode != null\) return;\s*setInlineActionStatus\(\(current\) => \(current && SWAP_MODE_STATUS_MESSAGES\.has\(current\.message\) \? null : current\)\);/);
});
