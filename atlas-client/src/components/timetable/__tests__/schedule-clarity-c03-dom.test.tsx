/**
 * LANE-C SCHEDULE-CLARITY-C03 — the interactions, in a DOM.
 *
 * B11: typing a teacher's name in the picker and pressing Enter selects it (the
 * audit found the option had to be clicked). B3: moving one class on a
 * published schedule checks the change, names a clash, and only then offers
 * the start date; scheduling posts one dated revision with the class's current
 * values.
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement, useState } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
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
const { SearchableSelect } = await import('../../../ui/searchable-select');
const { PublishedEntryChangePanel } = await import('../modals/PublishedEntryChangePanel');
const { Dialog, DialogContent, DialogTitle, DialogDescription } = await import('../../../ui/dialog');
const atlasApi = (await import('../../../lib/api')).default;

const PointerEventCtor = (dom.window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? dom.window.MouseEvent;
let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReturnType<typeof createElement>) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
}

async function flush() {
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
	const proto = input instanceof dom.window.HTMLTextAreaElement ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
	Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(input, value);
	input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	mock.restoreAll();
	dom.window.close();
});

test('B11 typing a name and pressing Enter selects the match', async () => {
	const chosen: string[] = [];
	function Harness() {
		const [value, setValue] = useState('');
		return createElement(SearchableSelect, {
			items: [
				{ value: '7', label: 'Villanueva, Jonathan' },
				{ value: '8', label: 'Tolentino, Maria' },
			],
			value,
			onValueChange: (next: string) => { chosen.push(next); setValue(next); },
			placeholder: 'Select departing teacher',
			ariaLabel: 'Teacher who is leaving',
			triggerId: 'departing',
		});
	}
	await mount(createElement(Harness));
	const trigger = document.getElementById('departing') as HTMLButtonElement;
	assert.equal(trigger.getAttribute('aria-label'), 'Teacher who is leaving: Select departing teacher');
	await act(async () => {
		trigger.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
		trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	await flush();
	const search = document.querySelector('input[aria-label="Search teacher who is leaving"]') as HTMLInputElement | null;
	assert.ok(search, 'the search box opens with its own name');
	await act(async () => { setInputValue(search!, 'tolen'); });
	const options = [...document.querySelectorAll('[role="option"]')];
	assert.equal(options.length, 1);
	assert.equal(search!.getAttribute('aria-activedescendant'), options[0].id);
	await act(async () => {
		search!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	});
	await flush();
	assert.deepEqual(chosen, ['8']);
	assert.match(trigger.textContent ?? '', /Tolentino, Maria/);

	// Arrow keys move the highlight; Enter picks the highlighted one.
	await act(async () => {
		trigger.dispatchEvent(new PointerEventCtor('pointerdown', { bubbles: true, button: 0 }));
		trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	await flush();
	const reopened = document.querySelector('input[aria-label="Search teacher who is leaving"]') as HTMLInputElement;
	await act(async () => {
		reopened.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	});
	await act(async () => {
		reopened.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
	});
	await flush();
	assert.deepEqual(chosen, ['8', '8']);
});

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
};

function panel(onScheduled: () => void) {
	return createElement(Dialog, { open: true }, createElement(DialogContent, null,
		createElement(DialogTitle, null, 'Move this class from a date'),
		createElement(DialogDescription, null, 'Checked first.'),
		createElement(PublishedEntryChangePanel, {
			request: { entry: entry as never, target: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' }, mode: 'move' },
			scope: { schoolId: 1, schoolYearId: 10, runId: 317 },
			roomOptions: [{ value: '103', label: 'Room 103 - G7AW' }, { value: '204', label: 'Room 204 - G9' }],
			subjectLabel: () => 'ESP',
			sectionLabel: (id: number) => (id === 91 ? 'GR7 - Luna' : 'GR7 - Mabini'),
			facultyLabel: () => 'Cruz, Juan',
			roomLabel: (id: number | null) => (id == null ? 'No room' : `Room ${id}`),
			onClose: () => {},
			onScheduled,
		}),
	));
}

test('B3 a published move with a clash names it and offers no start date', async () => {
	const posts: Array<{ url: string; body: unknown }> = [];
	mock.method(atlasApi, 'get', async () => ({ data: { revisions: [], count: 1, latestRevisionId: 41 } }));
	mock.method(atlasApi, 'post', async (url: string, body: unknown) => {
		posts.push({ url, body });
		return { data: {
			changeCount: 1, blockingHardViolationCount: 1, hardViolationCount: 1, softViolationCount: 0, softViolations: [], alreadyScheduled: false,
			clashes: [{
				code: 'FACULTY_TIME_CONFLICT', title: 'Teacher double-booked', meaning: 'x', action: 'Move one class or assign another qualified teacher.',
				facultyId: 7, roomId: null, sectionId: null, day: 'TUESDAY', startTime: '10:00', endTime: '10:45',
				entries: [
					{ entryId: 'entry-4::t2', changed: true, sectionId: 91, subjectId: 5, facultyId: 7, roomId: 103, day: 'TUESDAY', startTime: '10:00', endTime: '10:45', termIndex: 2 },
					{ entryId: 'entry-9::t2', changed: false, sectionId: 92, subjectId: 5, facultyId: 7, roomId: 204, day: 'TUESDAY', startTime: '10:00', endTime: '10:45', termIndex: 2 },
				],
			}],
		} };
	});
	await mount(panel(() => {}));
	await flush();
	assert.equal(posts.length, 1);
	assert.equal(posts[0].url, '/generation/1/10/runs/317/published-revisions/preview');
	assert.deepEqual(posts[0].body, {
		sourceRevisionId: 41,
		changes: [{
			entryId: 'entry-4::t2',
			changeType: 'PUBLISHED_MOVE',
			previous: { day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
			next: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' },
		}],
	});
	const text = document.body.textContent ?? '';
	assert.match(text, /Now: Monday 8:15 AM–9:00 AM · Room 103/);
	assert.match(text, /Tuesday 10:00 AM–10:45 AM · Room 103/);
	assert.match(text, /This change would cause clashes/);
	assert.match(text, /Cruz, Juan/);
	assert.match(text, /GR7 - Mabini/);
	assert.equal(document.getElementById('published-entry-change-date'), null, 'no start date until the check is clean');
	const schedule = document.querySelector('[data-testid="published-entry-change-schedule"]') as HTMLButtonElement;
	assert.equal(schedule.disabled, true);
	mock.restoreAll();
});

test('B3 a clean published move schedules one dated revision with the reason', async () => {
	const posts: Array<{ url: string; body: unknown }> = [];
	let scheduled = 0;
	mock.method(atlasApi, 'get', async () => ({ data: { revisions: [], count: 1, latestRevisionId: 41 } }));
	mock.method(atlasApi, 'post', async (url: string, body: unknown) => {
		posts.push({ url, body });
		if (url.endsWith('/preview')) {
			return { data: { changeCount: 1, blockingHardViolationCount: 0, hardViolationCount: 0, softViolationCount: 0, softViolations: [], clashes: [], alreadyScheduled: false } };
		}
		return { data: { revision: { id: 42, effectiveDate: '2099-06-01' }, auditId: 9, replayed: false } };
	});
	await mount(panel(() => { scheduled += 1; }));
	await flush();
	assert.match(document.body.textContent ?? '', /No clashes\. This change can be scheduled\./);
	const date = document.getElementById('published-entry-change-date') as HTMLInputElement;
	const reason = document.getElementById('published-entry-change-reason') as HTMLTextAreaElement;
	assert.ok(date && reason);
	await act(async () => { setInputValue(date, '2099-06-01'); });
	await act(async () => { setInputValue(reason, 'Lab only free on Tuesday'); });
	const schedule = document.querySelector('[data-testid="published-entry-change-schedule"]') as HTMLButtonElement;
	assert.equal(schedule.disabled, false);
	await act(async () => { schedule.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	await flush();
	const create = posts.find((post) => post.url === '/generation/1/10/runs/317/published-revisions');
	assert.ok(create, 'the dated revision was posted to the create route');
	assert.deepEqual(create!.body, {
		effectiveDate: '2099-06-01',
		reason: 'Lab only free on Tuesday',
		sourceRevisionId: 41,
		changes: [{
			entryId: 'entry-4::t2',
			changeType: 'PUBLISHED_MOVE',
			previous: { day: 'MONDAY', startTime: '08:15', endTime: '09:00' },
			next: { day: 'TUESDAY', startTime: '10:00', endTime: '10:45' },
		}],
		changeSummary: null,
		metadata: null,
	});
	assert.equal(posts.some((post) => /manual-edits|\/edits|\/commit/.test(post.url)), false, 'never the direct-edit route');
	assert.equal(scheduled, 1);
	assert.match(document.body.textContent ?? '', /Change scheduled from 2099-06-01/);
	mock.restoreAll();
});
