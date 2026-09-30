/**
 * A5 — the Unassigned sessions panel on Class Schedule (2026-09-30).
 *
 * Operator acceptance (verbatim): the panel title says `N classes need a time
 * slot`; ONE list grouped by section, each row one line: subject, section,
 * teacher, why it could not be placed in plain words, and one button `Place`
 * that opens the free slots for that class highlighted in the grid; no raw
 * codes, no counts that disagree with the header, no nested scroll traps; it
 * closes with Esc.
 *
 * Every row here renders the REAL `SimpleUnassignedSessionsPanel` /
 * `TimetableTaskDrawer`, and the one-click row decides the REAL
 * `decideAutoSavePlacement` and the REAL receipt builder.
 *
 * Run: `npm run test:a5-unassigned-panel`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { SimpleUnassignedSessionsPanel } from '../GeneratedUnassignedPanel';
import { decideAutoSavePlacement } from '@/lib/simple-timetable-state';
import { buildEditReceipt, receiptClassLabel } from '@/lib/timetable-edit-receipt';
import { classesNeedingTime } from '@/lib/timetable-plain-language';
import type { LeftRailContentContext } from '../timetableContexts.types';
import type { UnassignedItem } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/* ── the real surface fixture: two unplaced classes across two sections ─────── */

const REASONS: Record<string, { label: string; className: string }> = {
	NO_AVAILABLE_SLOT: { label: 'No Available Slot', className: 'border-orange-300' },
	NO_QUALIFIED_FACULTY: { label: 'No Qualified Teacher', className: 'border-red-300' },
};

function unplaced(overrides: Partial<UnassignedItem>): UnassignedItem {
	return { sectionId: 701, subjectId: 31, gradeLevel: 7, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 9, ...overrides } as UnassignedItem;
}

const ITEM_A = unplaced({ sectionId: 701, subjectId: 31, session: 1, reason: 'NO_AVAILABLE_SLOT', facultyId: 9 });
const ITEM_B = unplaced({ sectionId: 702, subjectId: 32, session: 2, reason: 'NO_QUALIFIED_FACULTY', facultyId: null });

function panelContext(overrides: Record<string, unknown> = {}): LeftRailContentContext {
	const items = (overrides.filteredUnassignedItems as UnassignedItem[] | undefined) ?? [ITEM_A, ITEM_B];
	const base: Record<string, unknown> = {
		leftTab: 'unassigned',
		isPreGenerationWorkspace: false,
		summary: { classesProcessed: 4, assignedCount: 2, unassignedCount: items.length },
		filteredUnassignedItems: items,
		programKindFilteredUnassignedItems: items,
		UNASSIGNED_REASON_LABELS: REASONS,
		unassignedReasonFilter: 'all',
		setUnassignedReasonFilter: () => {},
		sectionLabel: (id: number) => `Grade 7 - Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		// The ONE selected-term count the More-menu item also reads.
		unassignedCountForSelectedTerm: items.length,
		buildUnassignedKey: (item: UnassignedItem) => `${item.sectionId}-${item.subjectId}-${item.session}`,
		setKbSelectedSource: () => {},
		setSelectedEntry: () => {},
		setSelectedViolation: () => {},
		setSelectedUnassignedForRepair: () => {},
		openTacticalSandbox: () => {},
		toast: { info: () => {}, error: () => {} },
		...overrides,
	};
	return new Proxy(base, { get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => {}) }) as unknown as LeftRailContentContext;
}

function renderPanel(context: LeftRailContentContext): string {
	return renderToStaticMarkup(createElement(SimpleUnassignedSessionsPanel, { context }));
}

/* ── #1 the panel is one calm list, grouped by section, one line per class ─── */

test('#1 RENDERED: the title is the decision-8 count and the list groups by section', () => {
	const markup = renderPanel(panelContext());
	assert.ok(markup.includes(classesNeedingTime(2)), 'the title is `2 classes need a time slot`');
	assert.ok(markup.includes('Grade 7 - Section 701'), 'section 701 has a group heading');
	assert.ok(markup.includes('Grade 7 - Section 702'), 'section 702 has a group heading');
	// The group order follows the section label.
	assert.ok(markup.indexOf('Grade 7 - Section 701') < markup.indexOf('Grade 7 - Section 702'), 'groups are ordered by section label');
});

test('#1 RENDERED: each row names subject, section, teacher, a plain reason, and exactly one Place button', () => {
	const markup = renderPanel(panelContext());
	assert.ok(markup.includes('Subject 31'), 'the subject name renders');
	assert.ok(markup.includes('Subject 32'), 'the second subject name renders');
	assert.ok(markup.includes('Teacher 9'), 'the teacher NAME renders (not an initial)');
	assert.ok(markup.includes('No teacher yet'), 'a class with no owner says so in plain words');
	assert.ok(markup.includes('No Available Slot'), 'the first reason is a plain label');
	assert.ok(markup.includes('No Qualified Teacher'), 'the second reason is a plain label');
	// Exactly one Place button per row — two rows, two buttons, no other control.
	assert.equal((markup.match(/>Place</g) ?? []).length, 2, 'exactly one Place button per row');
	assert.equal((markup.match(/<button/g) ?? []).length, 2, 'the Place button is the ONLY control on a row');
});

test('#1 RENDERED: no raw reason code, no search, no filter chips, no Showing line, no diagnostics', () => {
	const markup = renderPanel(panelContext());
	for (const code of ['NO_AVAILABLE_SLOT', 'NO_QUALIFIED_FACULTY']) {
		assert.equal(markup.includes(code), false, `the raw reason code ${code} must never render`);
	}
	assert.equal(/<input/i.test(markup), false, 'no search box renders');
	assert.equal(markup.includes('Showing'), false, 'no `Showing X of Y` line renders');
	assert.equal(markup.includes('Show diagnostics'), false, 'no diagnostics toggle renders');
	assert.equal(markup.includes('Any reason'), false, 'no reason filter chips render');
	assert.equal(markup.includes('All grades'), false, 'no grade filter chips render');
	// No clipping of the strings an operator must read (AGENTS.md §8).
	assert.equal(/\btruncate\b/.test(markup), false, 'the row strings must not be clipped with `truncate`');
	assert.equal(/line-clamp/.test(markup), false, 'the row strings must not be clamped');
	assert.equal(/text-ellipsis/.test(markup), false, 'the row strings must not be ellipsised');
});

/* ── #2 count parity: the panel and the More-menu item read ONE source ─────── */

test('#2 SOURCE + RENDERED: the panel title and the More-menu item read the same selected-term count', () => {
	const context = panelContext({ unassignedCountForSelectedTerm: 3 });
	const markup = renderPanel(context);
	assert.ok(markup.includes(classesNeedingTime(3)), 'the panel title renders the shared count');

	// One source: the panel reads `unassignedCountForSelectedTerm`, and the header
	// hands the SAME context field to the More-menu item.
	assert.match(source('src/components/timetable/GeneratedUnassignedPanel.tsx'), /unassignedCountForSelectedTerm/, 'the panel reads the shared field');
	assert.match(source('src/components/timetable/TimetableSimpleHeader.tsx'), /count=\{context\.unassignedCountForSelectedTerm/, 'the More-menu item is handed the same field');
	// And the selected-term derivation is computed once, in the workspace hook.
	assert.match(source('src/hooks/useScheduleReviewWorkspaceState.ts'), /countUnassignedForSelectedTerm\(/, 'the one derivation lives in the hook');
});

test('#2 RENDERED: a zero count renders the shared "all placed" state, never a second count', () => {
	const markup = renderPanel(panelContext({
		filteredUnassignedItems: [],
		programKindFilteredUnassignedItems: [],
		unassignedCountForSelectedTerm: 0,
	}));
	assert.ok(markup.includes(classesNeedingTime(0)), 'the title still reads the decision-8 wording at zero');
	assert.ok(markup.includes('All classes placed'), 'the canonical empty-state label renders');
	assert.equal(markup.includes('unresolved'), false, 'the retired `N unresolved` count is gone');
});

/* ── #3 Esc closes the drawer, but never while a dialog is open ─────────────── */

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	SVGElement: dom.window.SVGElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.PointerEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TimetableTaskDrawer } = await import('../TimetableTaskDrawer');

let mountedRoot: { unmount: () => void } | null = null;
let mountedHost: HTMLElement | null = null;
afterEach(() => {
	if (mountedRoot) { act(() => mountedRoot!.unmount()); mountedRoot = null; }
	if (mountedHost) { mountedHost.remove(); mountedHost = null; }
	for (const stray of [...dom.window.document.body.children]) stray.remove();
});

async function mountDrawer(task: string, onTaskChange: (value: string | null) => void) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	mountedHost = host;
	const root = createRoot(host);
	mountedRoot = root;
	act(() => {
		root.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, createElement(TimetableTaskDrawer as never, {
			task,
			onTaskChange,
			leftRailContentContext: panelContext(),
			hardCount: 0,
			blockingHardCount: 0,
			softCount: 0,
			unassignedCount: 2,
			assignedCount: 2,
			runId: 318,
			isPreGenerationWorkspace: false,
			onPublish: () => {},
		} as never)));
	});
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

test('#3 RENDERED: pressing Escape on the drawer closes it', async () => {
	const calls: Array<string | null> = [];
	await mountDrawer('unassigned-sessions', (value) => calls.push(value));
	act(() => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
	assert.deepEqual(calls, [null], 'Escape asks the drawer to close exactly once');
});

test('#3 RENDERED: Escape does NOT close the drawer while a dialog is open', async () => {
	const calls: Array<string | null> = [];
	await mountDrawer('unassigned-sessions', (value) => calls.push(value));
	const overlay = dom.window.document.createElement('div');
	overlay.setAttribute('role', 'dialog');
	dom.window.document.body.appendChild(overlay);
	act(() => { dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
	assert.deepEqual(calls, [], 'Escape is scoped out while a dialog owns the key');
	overlay.remove();
});

/* ── #4 one click on a clean/soft-warned slot commits with a receipt and Undo ─ */

test('#4 RESOLVER: a clean or soft-warned slot returns the auto-commit decision', () => {
	const clean = { allowed: true, hardViolations: [], softViolations: [] };
	assert.deepEqual(
		decideAutoSavePlacement({ hasFacultyOwner: true, resolvedRoomId: 103, targetSlotOccupied: false, preview: clean }),
		{ kind: 'auto-commit', softCount: 0 },
		'a clean slot commits on the single click',
	);
	assert.deepEqual(
		decideAutoSavePlacement({ hasFacultyOwner: true, resolvedRoomId: 103, targetSlotOccupied: false, preview: { allowed: true, hardViolations: [], softViolations: [{}, {}] } }),
		{ kind: 'auto-commit', softCount: 2 },
		'a soft-warned slot commits on the single click and carries the warning count',
	);
});

test('#4 RESOLVER: the fail-closed preconditions are unchanged', () => {
	const base = { hasFacultyOwner: true, resolvedRoomId: 103, targetSlotOccupied: false, preview: { allowed: true, hardViolations: [], softViolations: [] } };
	assert.deepEqual(decideAutoSavePlacement({ ...base, hasFacultyOwner: false }), { kind: 'review-no-owner' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, targetSlotOccupied: true }), { kind: 'review-occupied' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, resolvedRoomId: null }), { kind: 'review-no-room' });
	assert.deepEqual(decideAutoSavePlacement({ ...base, preview: null }), { kind: 'review-no-preview' });
	assert.deepEqual(
		decideAutoSavePlacement({ ...base, preview: { allowed: false, hardViolations: [{}], softViolations: [] } }),
		{ kind: 'review-blocked', hardTitle: null },
	);
});

test('#4 RECEIPT: the auto-commit receipt names the class and its new slot', () => {
	const receipt = buildEditReceipt({
		editType: 'PLACE_UNASSIGNED',
		classLabel: receiptClassLabel({ subjectLabel: 'TLE', sectionLabel: 'G7AW' }),
		from: null,
		to: { day: 'MONDAY', startTime: '11:30' },
		problems: { now: 0, before: 0 },
	});
	assert.ok(receipt.sentence.includes('TLE'), 'the receipt names the class');
	assert.ok(receipt.sentence.includes('G7AW'), 'and its section');
	assert.ok(receipt.sentence.includes('MONDAY'), 'and the destination');
});

test('#4 SOURCE: the hook auto-commits the clean/warned decision with Undo', () => {
	const hook = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(hook, /decision\.kind === 'auto-commit'/, 'the clean/warned branch is the auto-commit');
	assert.doesNotMatch(hook, /decision\.kind === 'preview-confirm' \|\| decision\.kind === 'review-soft'/, 'the retired inline-confirm routing is gone');
	const block = hook.match(/decision\.kind === 'auto-commit'[\s\S]*?\n\t\t\}/)?.[0] ?? '';
	assert.ok(block.length > 0, 'the auto-commit branch is present');
	assert.match(block, /commitEditWithMeta\(/, 'the auto-commit commits');
	assert.match(block, /setLastAutoSaveUndo\(/, 'and registers the contextual Undo');
	assert.match(block, /buildEditReceipt\(/, 'and builds the plain receipt');
});

/* ── #5 no nested scroll: exactly one scroll region, no virtualised rail ───── */

test('#5 STRUCTURAL: the panel has exactly one scroll region and no VirtualizedRailList', () => {
	const markup = renderPanel(panelContext());
	assert.equal(markup.includes('data-virtualized-rail'), false, 'the panel no longer uses the virtualised rail');
	assert.equal((markup.match(/overflow-auto/g) ?? []).length, 1, 'exactly one scroll region (the list)');
	const panel = source('src/components/timetable/GeneratedUnassignedPanel.tsx');
	assert.doesNotMatch(panel, /VirtualizedRailList/, 'the virtualised rail import is gone');
	// The drawer wrapper clips; it must not add a second scroll region.
	assert.match(source('src/components/timetable/TimetableTaskDrawer.tsx'), /unassigned-sessions' \? \(\s*<div className="flex min-h-0 flex-1 flex-col overflow-hidden">/, 'the drawer clips instead of scrolling');
});
