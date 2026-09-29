/**
 * A7 c13 — DOM rows for the surfaces that clip: the class/program matrix, the
 * per-slot overflow sheet, and the Review-warnings severity filter.
 *
 * The matrix is plain DOM; the overflow sheet is a Radix `Sheet` (a portal), so
 * it needs a real client root. jsdom has no layout engine, so "wraps" is decided
 * by the declared class contract (`break-words` / `whitespace-normal`, and no
 * `truncate` / `text-ellipsis`), never by measuring a line.
 *
 * Run: `npm run test:a7-c13-clip` (this file is named beside the static rows).
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable' });
function matchMediaStub(query: string) {
	return {
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	};
}
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	SVGElement: dom.window.SVGElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
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
	matchMedia: matchMediaStub,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};

// react-dom must load after the DOM globals.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const atlasApi = (await import('../../../lib/api')).default;
// The surfaces subscribe to data; keep it offline and inert.
mock.method(atlasApi, 'get', async () => { throw new Error('offline in test'); });

import type { ScheduledEntry } from '@/types';

const LONG_SUBJECT = 'Mathematics 7 — Advanced Algebra';
const LONG_CONTEXT = 'Grade 7 - Luna · Adviser J. VILLANUEVA';

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function mount(element: ReactElement) {
	if (root) await act(async () => { root?.unmount(); });
	root = createRoot(container());
	await act(async () => { root?.render(element); });
	for (let index = 0; index < 4; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function click(el: HTMLElement) {
	await act(async () => { el.click(); });
	for (let index = 0; index < 3; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

function entry(): ScheduledEntry {
	return {
		entryId: 'e-1',
		sectionId: 701,
		facultyId: 9,
		roomId: 104,
		subjectId: 1,
		day: 'MONDAY',
		startTime: '09:00',
		endTime: '10:00',
		durationMinutes: 60,
		termIndex: 1,
	} as unknown as ScheduledEntry;
}

const CLIP = ['truncate', 'lg:truncate', 'text-ellipsis'];
function clipOffenders(rootEl: HTMLElement): string[] {
	const offenders: string[] = [];
	for (const el of [rootEl, ...rootEl.querySelectorAll<HTMLElement>('*')]) {
		const tokens = (el.getAttribute('class') ?? '').split(/\s+/);
		const hit = tokens.filter((token) => CLIP.includes(token));
		if (hit.length > 0) offenders.push(`${el.tagName.toLowerCase()}:${hit.join('.')}`);
	}
	return offenders;
}

function declaredWrap(el: HTMLElement): boolean {
	const tokens = (el.getAttribute('class') ?? '').split(/\s+/);
	return tokens.includes('break-words') || tokens.includes('whitespace-normal');
}

/* ── ITEM 3 — matrix + overflow-sheet class lines wrap ────────────────────── */

test('ITEM 3: the class/program matrix lines wrap instead of clipping', async () => {
	const { ClassProgramMatrixView } = await import('../ClassProgramMatrixView');
	await mount(createElement(ClassProgramMatrixView, {
		entries: [entry()],
		sectionLabel: () => 'GR7 - Luna',
		gradeForSection: () => 7,
		subjectLabel: () => LONG_SUBJECT,
		roomLabelShort: () => 'Room 104',
		formatFacultyInitials: () => 'J. VILLANUEVA',
		entryContextLabel: () => LONG_CONTEXT,
		onEntryClick: () => {},
		selectedEntryId: null,
	}));
	const card = container().querySelector<HTMLElement>('[data-entry-id="e-1"]');
	assert.ok(card, 'the matrix entry renders');
	assert.deepEqual(clipOffenders(card), [], 'no matrix line clips with an ellipsis');
	const subject = [...card.querySelectorAll<HTMLElement>('span')].find((el) => el.textContent?.trim() === LONG_SUBJECT);
	assert.ok(subject, 'the matrix subject line renders the full name');
	assert.ok(declaredWrap(subject), 'the subject line declares a wrap');
	assert.ok(card.textContent?.includes(LONG_CONTEXT), 'the adviser/context line renders in full');
});

test('ITEM 3: the per-slot overflow sheet class lines wrap instead of clipping', async () => {
	const { TimetableCellOverflowSheet } = await import('../TimetableCellOverflowSheet');
	await mount(createElement(TimetableCellOverflowSheet, {
		open: true,
		onOpenChange: () => {},
		entries: [entry()],
		day: 'MONDAY',
		startTime: '09:00',
		endTime: '10:00',
		violationIndex: new Map(),
		subjectLabel: () => LONG_SUBJECT,
		sectionLabel: () => 'GR7 - Luna',
		facultyLabel: () => 'J. VILLANUEVA',
		roomLabelShort: () => 'Room 104',
		onEntryClick: () => {},
	}));
	const row = document.querySelector<HTMLElement>('[data-testid="timetable-cell-overflow-entry"]');
	assert.ok(row, 'the overflow sheet row renders');
	assert.deepEqual(clipOffenders(row), [], 'no overflow-sheet line clips with an ellipsis');
	const lines = [...row.querySelectorAll<HTMLElement>('p')];
	const subject = lines.find((el) => el.textContent?.trim() === LONG_SUBJECT);
	assert.ok(subject, 'the subject line renders the full name');
	assert.ok(declaredWrap(subject), 'the subject line declares a wrap');
	const detail = lines.find((el) => (el.textContent ?? '').includes('J. VILLANUEVA') && (el.textContent ?? '').includes('Room 104'));
	assert.ok(detail, 'the section · teacher · room line renders');
	assert.ok(declaredWrap(detail), 'the section · teacher · room line declares a wrap');
});

/* ── ITEM 5a — Review warnings opens the rail on the Warning filter ────────── */

test('ITEM 5a: Review warnings opens the rail on the Warning filter; a blocker still opens must-fix', async () => {
	const { TimetableTaskDrawer } = await import('../TimetableTaskDrawer');
	const filters: string[] = [];
	const rail = new Proxy(
		{ setSeverityFilter: (value: string) => { filters.push(value); }, handleViolationSelect: () => {} },
		{ get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => {}) },
	);
	const hard = {
		code: 'FACULTY_TIME_CONFLICT',
		severity: 'HARD',
		message: 'Teacher double-booked',
		entities: { sectionId: 1, subjectId: 2, facultyId: 3 },
	} as unknown as import('@/types').Violation;
	const soft = [1, 2, 3].map((index) => ({
		code: 'FACULTY_EXCESSIVE_IDLE_GAP',
		severity: 'SOFT',
		message: `Idle gap ${index}`,
		entities: { facultyId: index },
	} as unknown as import('@/types').Violation));
	await mount(createElement(MemoryRouter, null,
		createElement(TimetableTaskDrawer, {
			task: 'publish',
			onTaskChange: () => {},
			leftRailContentContext: rail as never,
			hardCount: 1,
			blockingHardCount: 0,
			softCount: 3,
			unassignedCount: 0,
			assignedCount: 400,
			runId: 318,
			isPreGenerationWorkspace: false,
			onPublish: () => {},
			violations: [hard, ...soft],
			sectionLabel: (id: number) => `Section ${id}`,
			subjectLabel: (id: number) => `Subject ${id}`,
			facultyLabel: (id: number) => `Teacher ${id}`,
		} as never),
	));
	const reviewWarnings = [...document.querySelectorAll<HTMLButtonElement>('button')]
		.find((button) => (button.textContent ?? '').includes('Review warnings'));
	assert.ok(reviewWarnings, 'the Review warnings control renders');
	await click(reviewWarnings!);
	assert.equal(filters.at(-1), 'soft', 'Review warnings opens the Warning filter (chip says Warning (3))');
	assert.equal(filters.includes('hard'), false, 'and does not open the must-fix filter');

	const blockerAction = document.querySelector<HTMLElement>('[data-testid="timetable-publish-blocker-action"]');
	assert.ok(blockerAction, 'a blocker action still renders');
	await click(blockerAction!);
	assert.equal(filters.at(-1), 'hard', 'following a blocker still opens the must-fix filter');
});
