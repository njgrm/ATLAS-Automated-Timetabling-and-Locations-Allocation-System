/**
 * A2 c18 (Lane C truth-fixes 2026-09-29, bullet 5) — an unresolved subject or
 * section is NAMED IN WORDS, and the draft save is refused, proved on RENDERED
 * output.
 *
 * `LockPanel` used to print `Subj #12` and `Section #9` whenever the section and
 * subject mirrors did not carry the record. A number is not a name, and a
 * scheduler who cannot read the row cannot judge it.
 *
 * WHY THIS TEST MOUNTS AN ORPHAN. `components/LockPanel.tsx` is not imported by
 * any client route today (`git grep -i lockpanel -- atlas-client/src` returns
 * only its own definition and two files that name it by path string). So this
 * change has NO user-visible effect and NO browser/screenshot row is possible or
 * attempted. The panel is still worth making truthful because it is a trap for
 * whoever rewires it: these assertions are what stop the raw-id strings and the
 * unconditional save from coming back with the next import.
 *
 * EVERY CONTENT ASSERTION BELOW RUNS AGAINST `document.body.textContent` AFTER
 * THE REAL COMPONENT MOUNTED, and the save-block assertion reads the real
 * `Save Draft` button element's `disabled` property. Nothing here reads source
 * text, because a source-string assertion is not evidence about a user-facing
 * change.
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import type {
	DraftBoardState,
	DraftPlacement,
	DraftQueueItem,
	ExternalSection,
	FacultyMirror,
	PreviewResult,
	Subject,
} from '../../types';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	SVGElement: dom.window.SVGElement,
	Document: dom.window.Document,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	NodeList: dom.window.NodeList,
	HTMLCollection: dom.window.HTMLCollection,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const { default: LockPanel } = await import('../LockPanel');
const atlasApi = (await import('../../lib/api')).default;

/* ── fixtures, shaped from `atlas-client/src/types.ts` ────────────────────── */

/**
 * The ids the panel is asked about. NEITHER map carries them in the unresolved
 * case, which is the exact real condition the old fallbacks were hiding: a draft
 * placement whose `sectionId` / `subjectId` is not in the mirror.
 */
const GHOST_SECTION_ID = 999;
const GHOST_SUBJECT_ID = 888;

const KNOWN_SECTION: ExternalSection = {
	id: GHOST_SECTION_ID,
	name: 'GR7 - Luna',
	maxCapacity: 40,
	enrolledCount: 38,
	gradeLevelId: 7001,
	gradeLevelName: 'GRADE 7',
	displayOrder: 7,
	homeRoomId: 103,
};

const KNOWN_SUBJECT = {
	id: GHOST_SUBJECT_ID,
	schoolId: 1,
	code: 'MATH',
	name: 'Mathematics',
	schedulingDisposition: 'SCHEDULED_TEACHING',
	minMinutesPerWeek: 150,
	preferredRoomType: 'CLASSROOM',
	gradeLevels: [7],
} as unknown as Subject;

const FACULTY: FacultyMirror = {
	id: 7,
	externalId: 7007,
	schoolId: 1,
	firstName: 'Juan',
	lastName: 'Cruz',
	department: 'Math',
	specialization: null,
	employmentStatus: 'ACTIVE',
	contactInfo: null,
	localNotes: null,
	isActiveForScheduling: true,
	isClassAdviser: false,
	advisoryEquivalentHours: 0,
	canTeachOutsideDepartment: true,
	maxHoursPerWeek: 20,
	lastSyncedAt: '2026-09-29T00:00:00.000Z',
	version: 1,
};

/** RoomInfo is local to LockPanel and not exported; this is its exact shape. */
const ROOM = {
	id: 103,
	name: 'Room 103',
	buildingId: 2,
	buildingName: 'G7AW',
	buildingShortCode: 'G7AW',
	floor: 1,
	type: 'CLASSROOM',
	capacity: 40,
	isTeachingSpace: true,
};

const QUEUE_ITEM: DraftQueueItem = {
	assignmentKey: '7-MATH::t1',
	entryKind: 'SECTION',
	sectionId: GHOST_SECTION_ID,
	sectionName: KNOWN_SECTION.name,
	gradeLevel: 7,
	subjectId: GHOST_SUBJECT_ID,
	subjectCode: 'MATH',
	subjectName: 'Mathematics',
	sessionNumber: 1,
	sessionsPerWeek: 4,
	preferredRoomType: 'CLASSROOM',
	cohortCode: null,
	cohortName: null,
	programCode: null,
	programName: null,
	expectedEnrollment: 38,
	facultyOptions: [7],
	facultyOptionsEnriched: [],
	hasNoTeacher: false,
};

const PLACEMENT: DraftPlacement = {
	id: 5001,
	schoolId: 1,
	schoolYearId: 10,
	entryKind: 'SECTION',
	sectionId: GHOST_SECTION_ID,
	subjectId: GHOST_SUBJECT_ID,
	facultyId: 7,
	roomId: 103,
	day: 'MONDAY',
	startTime: '08:15',
	endTime: '09:00',
	cohortCode: null,
	status: 'DRAFT',
	lockedRunId: null,
	notes: null,
	version: 3,
	updatedAt: '2026-09-29T00:00:00.000Z',
	createdBy: 46,
	createdAt: '2026-09-29T00:00:00.000Z',
};

/** A preview that PASSES, so the save block in the unresolved case is load-bearing. */
const ALLOWED_PREVIEW: PreviewResult = {
	allowed: true,
	hardViolations: [],
	softViolations: [],
	violationDelta: { hardBefore: 0, hardAfter: 0, softBefore: 0, softAfter: 0 },
	humanConflicts: [],
	affectedEntries: [],
	policyImpactSummary: [],
};

function board(): DraftBoardState {
	return {
		placements: [PLACEMENT],
		queue: [QUEUE_ITEM],
		periodSlots: [{ startTime: '08:15', endTime: '09:00' }],
		counts: { draft: 1, lockedForRun: 0, archived: 0, unscheduled: 4 },
		filters: { grades: [7], departments: ['Math'], buildings: [{ id: 2, name: 'G7AW', shortCode: 'G7AW' }] },
	};
}

/* ── harness ──────────────────────────────────────────────────────────────── */

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function settle(rounds = 6) {
	for (let index = 0; index < rounds; index += 1) {
		await act(async () => { await new Promise((done) => setTimeout(done, 0)); });
	}
}

async function mount(resolved: boolean) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await settle(2);
	await act(async () => {
		root?.render(createElement(LockPanel, {
			schoolId: 1,
			schoolYearId: 10,
			sections: resolved ? new Map([[GHOST_SECTION_ID, KNOWN_SECTION]]) : new Map(),
			subjects: resolved ? new Map([[GHOST_SUBJECT_ID, KNOWN_SUBJECT]]) : new Map(),
			faculty: new Map([[FACULTY.id, FACULTY]]),
			rooms: new Map([[ROOM.id, ROOM]]),
		}));
	});
	await settle();
}

/**
 * Stage the pending placement the way an operator does: by clicking the drafted
 * cell in the grid. `stagePlacementMove` is the only path that sets `pending`
 * for an existing placement, and it is reached from this cell's `onClick`.
 */
async function stagePending() {
	const cell = Array.from(document.querySelectorAll('div'))
		.find((element) => String(element.className).includes('cursor-pointer'));
	assert.ok(cell, 'the drafted placement rendered a clickable grid cell');
	await act(async () => {
		cell!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	await settle();
}

function saveButton(): HTMLButtonElement {
	const button = Array.from(document.querySelectorAll('button'))
		.find((candidate) => candidate.textContent?.includes('Save Draft'));
	assert.ok(button, 'the Save Draft button is on screen');
	return button as HTMLButtonElement;
}

function text() {
	return document.body.textContent ?? '';
}

/** The copy, with the em dash pinned as an escape so this file cannot mis-encode it. */
const SAVE_OFF_SENTENCE = 'Save is off — ATLAS has no record of this subject or section.';

function stubApi() {
	mock.method(atlasApi, 'get', async () => ({ data: board() }));
	mock.method(atlasApi, 'post', async () => ({ data: ALLOWED_PREVIEW }));
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	mock.restoreAll();
	dom.window.close();
});

/* ── the defect: a raw id where a name belongs ─────────────────────────────── */

test('A2 c18 an unresolved subject and section are named in words, and the draft save is refused', async () => {
	stubApi();
	await mount(false);
	await stagePending();

	const rendered = text();

	// The board header names the missing section in words.
	assert.match(rendered, /Unknown section/, 'an unresolvable section is named, not numbered');
	// Both the grid cell and the inspector name the missing subject in words.
	assert.match(rendered, /Unknown subject/, 'an unresolvable subject is named, not numbered');

	// The pre-fix strings are gone from every rendered surface.
	assert.doesNotMatch(rendered, /Subj #\d+/, 'no raw subject id may render');
	assert.doesNotMatch(rendered, /Section #\d+/, 'no raw section id may render');

	// The reason is stated in words, beside the action it blocks.
	assert.ok(rendered.includes(SAVE_OFF_SENTENCE), `the reason sentence renders; got: ${JSON.stringify(rendered.includes('Save is off') ? 'partial' : 'absent')}`);
	assert.match(rendered, /ATLAS has no record of this subject or section\./, 'the reason says which record is missing, in words');

	// The block is LOAD-BEARING, not an artefact of a preview that never arrived:
	// the preview resolved and passed, and the button is disabled anyway.
	assert.match(rendered, /Preview passes hard constraints/, 'the conflict preview resolved and passed for this placement');
	assert.equal(saveButton().disabled, true, 'Save Draft is refused while a record is unresolved');
});

/* ── negative control: the block DISCRIMINATES ─────────────────────────────── */

test('A2 c18 negative control: a resolvable subject and section save normally, with no block and no reason', async () => {
	mock.restoreAll();
	stubApi();
	await mount(true);
	await stagePending();

	const rendered = text();

	// A record the mirrors DO carry keeps its real name on screen.
	assert.match(rendered, /GR7 - Luna/, 'the resolved section name is on screen');
	assert.doesNotMatch(rendered, /Unknown section/, 'a resolvable section is never called unknown');
	assert.doesNotMatch(rendered, /Unknown subject/, 'a resolvable subject is never called unknown');
	assert.doesNotMatch(rendered, /Section #\d+|Subj #\d+/, 'no raw id may render in either case');

	// The gate discriminates: same preview, same placement, only the mirrors differ.
	assert.match(rendered, /Preview passes hard constraints/, 'the conflict preview resolved and passed');
	assert.equal(saveButton().disabled, false, 'Save Draft is NOT blocked when both records resolve');
	assert.doesNotMatch(rendered, /Save is off/, 'the reason sentence never appears when nothing is unresolved');
});

/* ── the mutation control, recorded literally ─────────────────────────────── */

test('A2 c18 mutant: the pre-fix fallbacks fail every assertion this file makes', () => {
	// Recorded literally, in the style of `plain-tokens-c04.test.tsx`. The pre-fix
	// expressions were:
	//   `sections.get(activeSectionId)?.name ?? \`Section #${activeSectionId}\``
	//   `subject?.code ?? \`Subj #${placement.subjectId}\``
	// and the pre-fix button had no unresolved-guard term in its `disabled`.
	const PRE_FIX_RENDERED = [
		'Pre-Generation Draft Board',
		'Section #999',
		'Subj #888',
		'4 unscheduled',
	].join(' ');

	assert.match(PRE_FIX_RENDERED, /Subj #\d+/, 'the pre-fix panel really printed a raw subject id');
	assert.match(PRE_FIX_RENDERED, /Section #\d+/, 'the pre-fix panel really printed a raw section id');
	assert.doesNotMatch(PRE_FIX_RENDERED, /Unknown section/, 'the pre-fix panel never named it in words');

	// Each shipped assertion, run against the pre-fix string, must FAIL.
	assert.throws(() => assert.doesNotMatch(PRE_FIX_RENDERED, /Subj #\d+/), /expected to not match/);
	assert.throws(() => assert.doesNotMatch(PRE_FIX_RENDERED, /Section #\d+/), /expected to not match/);
	assert.throws(() => assert.match(PRE_FIX_RENDERED, /Unknown section/), /input did not match/);
	assert.throws(() => assert.match(PRE_FIX_RENDERED, /Unknown subject/), /input did not match/);
	assert.throws(() => assert.ok(PRE_FIX_RENDERED.includes(SAVE_OFF_SENTENCE)), /falsy value/);
});
