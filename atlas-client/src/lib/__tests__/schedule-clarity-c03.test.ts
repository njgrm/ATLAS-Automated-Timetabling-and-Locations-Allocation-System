/**
 * LANE-C SCHEDULE-CLARITY-C03 — class-schedule clarity after publishing.
 *
 * The 2026-09-25 live audit (docs/reviews/ux-audit-teaching-load-and-schedule-controls-2026-09-25.md)
 * found: B3 no way to move one class or change its room after publishing (the
 * tools call the direct edit a published run refuses, and show its API path);
 * B4 "Published schedule — view only" beside controls that change it; B8 the
 * grid jumping during a swap and Class A never highlighted; B9 the Draft view
 * inheriting the published chip and a live swap, and an empty draft grid with
 * no explanation; B10 "Schedule history" greyed out with no reason; B11 the
 * Teacher-leaving picker announced unnamed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
	buildPublishedEntryChange,
	isPublishedDirectEditRefusal,
	PUBLISHED_DIRECT_EDIT_MESSAGE,
	PUBLISHED_ENTRY_MOVE,
	PUBLISHED_ENTRY_ROOM_CHANGE,
} from '../published-entry-change';
import { revisionFailureHint } from '../published-revision-clashes';
import { deriveTimetableCapabilities } from '../timetable-capabilities';
import {
	PUBLISHED_CHANGE_HINT,
	PUBLISHED_GENERATE_LABEL,
	SimpleGenerateAction,
	SimplePublishedState,
} from '../../components/timetable/simple/SimpleHeaderHelpers';
import {
	createSwapArmHandler,
	SWAP_ARMED_FROM_SELECTION_MESSAGE,
	SWAP_ARMED_MESSAGE,
} from '../../components/timetable/timetableSwapArming';
import { TimetableGrid } from '../../components/timetable/TimetableGrid';
import { SWAP_MODE_STATUS_MESSAGES } from '../../hooks/useScheduleReviewWorkspaceState';
import { SearchableSelect } from '../../ui/searchable-select';
import type { ScheduledEntry } from '../../types';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const entry = {
	entryId: 'entry-4::t2',
	facultyId: 7,
	roomId: 103,
	subjectId: 5,
	sectionId: 91,
	day: 'MONDAY',
	startTime: '08:15',
	endTime: '09:00',
	durationMinutes: 45,
	termIndex: 2,
} as unknown as ScheduledEntry;

// ── B3 ────────────────────────────────────────────────────────────────────

test('B3 a published move carries only the time fields, each with its current value', () => {
	const change = buildPublishedEntryChange(entry, { target: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' }, roomId: 103 });
	assert.deepEqual(change, {
		entryId: 'entry-4::t2',
		changeType: PUBLISHED_ENTRY_MOVE,
		previous: { day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
		next: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' },
	});
});

test('B3 a published room change carries only the room; a move with a new room carries both', () => {
	assert.deepEqual(buildPublishedEntryChange(entry, { target: null, roomId: 204 }), {
		entryId: 'entry-4::t2',
		changeType: PUBLISHED_ENTRY_ROOM_CHANGE,
		previous: { roomId: 103 },
		next: { roomId: 204 },
	});
	const both = buildPublishedEntryChange(entry, { target: { day: 'FRIDAY', startTime: '08:15', endTime: '09:00' }, roomId: 204 });
	assert.equal(both?.changeType, PUBLISHED_ENTRY_MOVE);
	assert.deepEqual(both?.previous, { day: 'MONDAY', startTime: '08:15', endTime: '09:00', roomId: 103 });
	assert.deepEqual(both?.next, { day: 'FRIDAY', startTime: '08:15', endTime: '09:00', roomId: 204 });
});

test('B3 an unchanged class builds no change (nothing to check, nothing to schedule)', () => {
	assert.equal(buildPublishedEntryChange(entry, { target: null, roomId: 103 }), null);
	assert.equal(buildPublishedEntryChange(entry, { target: { day: 'MONDAY', startTime: '08:15', endTime: '09:00' }, roomId: 103 }), null);
});

test('B3 the published direct-edit refusal becomes a next step, never the API path', () => {
	const refusal = { response: { status: 409, data: { code: 'RUN_ALREADY_PUBLISHED', message: 'POST /api/v1/generation/:schoolId/…' } } };
	assert.equal(isPublishedDirectEditRefusal(refusal), true);
	assert.equal(isPublishedDirectEditRefusal({ response: { data: { code: 'VERSION_CONFLICT' } } }), false);
	assert.equal(isPublishedDirectEditRefusal(null), false);
	assert.doesNotMatch(PUBLISHED_DIRECT_EDIT_MESSAGE, /\/api|POST|revision|published-revisions/i);
	assert.match(PUBLISHED_DIRECT_EDIT_MESSAGE, /Choose a new time/);
	assert.match(PUBLISHED_DIRECT_EDIT_MESSAGE, /date you choose/);
	const mutations = source('../../hooks/useTimetableMutations.ts');
	// Both the preview and the commit of a direct edit map the refusal.
	assert.equal((mutations.match(/isPublishedDirectEditRefusal\(e\)/g) ?? []).length, 2);
});

test('B3 a stale previous value names the cause instead of blaming the form', () => {
	assert.match(revisionFailureHint({ response: { data: { code: 'REVISION_PREVIOUS_VALUES_STALE' } } }), /already has a scheduled change/);
});

test('B3 every published move path schedules a dated change instead of the refused direct edit', () => {
	const hook = source('../../hooks/useScheduleReviewWorkspaceState.ts');
	// Keyboard/click move (handleKbPlace) and drag-and-drop move both branch before building MOVE_ENTRY.
	const guards = hook.match(/if \(draftPublishedRef\.current\) \{[\s\S]{0,260}?setPublishedEntryChange\(\{ entry[^}]*target: \{ day, startTime, endTime \}, mode: 'move' \}\)/g) ?? [];
	assert.equal(guards.length, 2);
	for (const guard of guards) assert.doesNotMatch(guard, /previewEdit|commitEdit/);
	assert.match(hook, /publishedChangeScope: draft && isDraftPublishedStrict\(draft\) && schoolId && schoolYearId && runIdNumeric/);
	const workspace = source('../../components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /if \(state\.publishedChangeScope\) \{\s*state\.setPublishedEntryChange\(\{ entry: state\.selectedEntry, target: null, mode: 'room' \}\);\s*return;/);
	assert.match(workspace, /<PublishedEntryChangePanel/);
	assert.match(workspace, /Published schedule: a change starts on a date you choose\./);
	const center = source('../../components/timetable/CenterWorkspace.tsx');
	assert.match(center, /timetable-manual-edit-published-note/);
});

// ── B4 ────────────────────────────────────────────────────────────────────

test('B4 the published chip no longer claims "view only" and says how a change works', () => {
	const markup = renderToStaticMarkup(createElement(SimplePublishedState, { followUpCount: 0 }));
	assert.doesNotMatch(markup, /view only/i);
	assert.match(markup, />Published schedule</);
	assert.match(markup, new RegExp(PUBLISHED_CHANGE_HINT));
	assert.match(markup, /aria-label="Published schedule\. Changes start on a date you choose\."/);
	// Still a status surface, never an action.
	assert.doesNotMatch(markup, /<button/);
});

test('B4 the lifecycle label for a published schedule is honest too', () => {
	const capabilities = deriveTimetableCapabilities({
		scopeResolved: true,
		generating: false,
		curriculumState: 'ready',
		isPreGeneration: false,
		hasGeneratedRun: true,
		latestRunFailed: false,
		isPublished: true,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
	} as unknown as Parameters<typeof deriveTimetableCapabilities>[0]);
	assert.equal(capabilities.lifecycle, 'published');
	assert.doesNotMatch(capabilities.lifecycleLabel, /view only/i);
	assert.match(capabilities.lifecycleLabel, /changes start on a date you choose/);
});

test('B4 beside a published schedule, Generate says it builds a new version', () => {
	const published = renderToStaticMarkup(createElement(SimpleGenerateAction, { disabled: false, disabledReason: null, onClick: () => {}, published: true }));
	assert.match(published, new RegExp(`>${PUBLISHED_GENERATE_LABEL}<`));
	assert.match(published, /aria-label="Build a new version of the schedule\. Teachers keep seeing the published schedule until you publish the new one\."/);
	const ordinary = renderToStaticMarkup(createElement(SimpleGenerateAction, { disabled: false, disabledReason: null, onClick: () => {} }));
	assert.match(ordinary, />Generate</);
	assert.match(source('../../components/timetable/TimetableSimpleHeader.tsx'), /published=\{isRunPublished\}/);
});

// ── B8 ────────────────────────────────────────────────────────────────────

const gridProps = {
	timeSlots: [{ startTime: '08:15', endTime: '09:00' }],
	violationIndex: new Map(),
	highlightedEntryIds: new Set<string>(),
	selectedEntry: null,
	followUps: new Set<string>(),
	onEntryClick: () => {},
	subjectLabel: () => 'ESP',
	sectionLabel: () => 'GR7 - Luna',
	gradeForSection: () => 7,
	entryContextLabel: () => 'GR7 - Luna',
	formatFacultyInitials: () => 'J. Cruz',
	facultyLabel: () => 'Cruz, J',
	viewMode: 'section' as const,
	pivotLabel: () => 'GR7 - Luna',
	roomLabelShort: () => 'Room 103',
	kbSelectedSource: null,
	onKbPlace: () => {},
	getCellConflict: null,
	getLiveCellConflict: () => null,
	onNavToFaculty: () => {},
	onNavToSection: () => {},
	onNavToRoom: () => {},
	simpleMode: true,
};

function entryTag(markup: string, entryId: string): string {
	const match = new RegExp(`<[^>]*data-timetable-entry-id="${entryId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`).exec(markup);
	assert.ok(match, `entry ${entryId} rendered`);
	return match[0];
}

test('B8 the first class picked for a swap is highlighted on the grid (the grid now passes the pick to its cells)', () => {
	const other = { ...entry, entryId: 'entry-5::t2', day: 'TUESDAY' } as ScheduledEntry;
	const markup = renderToStaticMarkup(createElement(TimetableGrid, {
		...gridProps,
		entries: [entry, other],
		swapClassAEntryId: 'entry-4::t2',
		swapClassBEntryId: 'entry-5::t2',
	}));
	assert.match(entryTag(markup, 'entry-4::t2'), /ring-blue-600/);
	assert.match(entryTag(markup, 'entry-5::t2'), /ring-amber-500/);
	const without = renderToStaticMarkup(createElement(TimetableGrid, { ...gridProps, entries: [entry, other] }));
	assert.doesNotMatch(entryTag(without, 'entry-4::t2'), /ring-blue-600/);
});

test('B8 the inline status floats over the grid instead of pushing it down', () => {
	const workspace = source('../../components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /className="relative z-30 h-0" data-testid="timetable-inline-status-anchor"/);
	assert.match(workspace, /data-testid="timetable-inline-status"\s*className=\{`absolute inset-x-3 top-1/);
	// SUPERSEDED: the in-flow status row `border-b px-3 py-1 text-xs`.
	assert.doesNotMatch(workspace, /className=\{`border-b px-3 py-1 text-xs \$\{\s*state\.inlineActionStatus/);
});

test('B8 "Swap with another class" on a selected class makes it the first class', () => {
	const calls: Record<string, unknown[]> = { mode: [], a: [], b: [], status: [], cleared: [] };
	const arm = createSwapArmHandler({
		setTask: () => {},
		setMode: (mode) => calls.mode.push(mode),
		setEntryIdA: (id) => calls.a.push(id),
		setEntryIdB: (id) => calls.b.push(id),
		setStatus: (status) => calls.status.push(status.message),
		getSelectedEntryId: () => 'entry-4::t2',
		clearSelection: () => calls.cleared.push(true),
	});
	assert.deepEqual(arm(), { mode: 'select-second', entryIdA: 'entry-4::t2', entryIdB: null });
	assert.deepEqual(calls.mode, ['select-second']);
	assert.deepEqual(calls.a, ['entry-4::t2']);
	assert.deepEqual(calls.cleared, [true]);
	assert.deepEqual(calls.status, [SWAP_ARMED_FROM_SELECTION_MESSAGE]);

	const fresh = createSwapArmHandler({ setTask: () => {}, setMode: () => {}, setEntryIdA: () => {}, setEntryIdB: () => {}, setStatus: () => {}, getSelectedEntryId: () => null });
	assert.deepEqual(fresh(), { mode: 'select-first', entryIdA: null, entryIdB: null });
	assert.match(source('../../components/timetable/ScheduleReviewWorkspace.tsx'), /getSelectedEntryId: \(\) => state\.selectedEntry\?\.entryId \?\? null/);
});

test('B8 both swap-arming prompts clear when the swap is cancelled', () => {
	assert.equal(SWAP_MODE_STATUS_MESSAGES.has(SWAP_ARMED_MESSAGE), true);
	assert.equal(SWAP_MODE_STATUS_MESSAGES.has(SWAP_ARMED_FROM_SELECTION_MESSAGE), true);
});

// ── B9 ────────────────────────────────────────────────────────────────────

test('B9 the Draft view does not inherit the published chip or a live swap', () => {
	const header = source('../../components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /\{isRunPublished && context\.isPreGenerationWorkspace \? null : isRunPublished \? \(\s*<SimplePublishedState/);
	const workspace = source('../../components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /if \(currentCenterView == null \|\| currentCenterView === 'schedule'\) return;\s*state\.setSwapClassTimesMode\?\.\(null\);/);
	assert.match(workspace, /setActiveSimpleTask\(\(task\) => \(task === 'swap-sessions' \? null : task\)\)/);
});

test('B9 an empty or loading draft says what it is instead of looking like the schedule vanished', () => {
	const center = source('../../components/timetable/CenterWorkspace.tsx');
	assert.match(center, /centerView === 'pre-generation' && sandboxGridEntries\.length === 0 \? \(/);
	assert.match(center, /the published schedule is not shown here and does not change/);
	assert.match(center, /newDraftLoading\s*\/\/[^\n]*\n\s*\? 'Loading the draft…'/);
});

// ── B10 ───────────────────────────────────────────────────────────────────

test('B10 a disabled Schedule history says why, readably', () => {
	const menu = source('../../components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /data-testid="timetable-more-schedule-history-reason"/);
	assert.match(menu, /Nothing to show yet: no class has been moved, swapped or given a new room in this schedule\./);
	assert.match(menu, /data-\[disabled\]:opacity-100/);
	assert.match(menu, /Schedule history \(\{context\.editHistoryCount\}\)/);
});

// ── B11 ───────────────────────────────────────────────────────────────────

test('B11 the picker takes a name, and a visible label can point at it', () => {
	const markup = renderToStaticMarkup(createElement(SearchableSelect, {
		items: [{ value: '7', label: 'Villanueva, Jonathan' }],
		value: '',
		onValueChange: () => {},
		placeholder: 'Select departing teacher',
		ariaLabel: 'Teacher who is leaving',
		triggerId: 'teacher-departure-departing-trigger',
	}));
	assert.match(markup, /id="teacher-departure-departing-trigger"/);
	assert.match(markup, /aria-label="Teacher who is leaving: Select departing teacher"/);
	assert.match(markup, /aria-haspopup="listbox"/);
	const sheet = source('../../components/timetable/TeacherDepartureRecoverySheet.tsx');
	assert.match(sheet, /htmlFor="teacher-departure-departing-trigger"/);
	assert.match(sheet, /triggerId="teacher-departure-departing-trigger"/);
	assert.match(sheet, /ariaLabel=\{`Replacement teacher for \$\{subjectLabel\(group\.subjectId\)\}/);
	assert.match(sheet, /ariaLabel="Replacement teacher for every class"/);
});

test('B11 an unnamed picker keeps its previous markup (no accidental label)', () => {
	const markup = renderToStaticMarkup(createElement(SearchableSelect, { items: [], value: '', onValueChange: () => {} }));
	assert.doesNotMatch(markup, /aria-label=/);
});
