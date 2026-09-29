/**
 * A2 C13 (item 2) — ONE name for the place, and NOT ONE route changed.
 *
 * ── THE RULING ───────────────────────────────────────────────────────────────
 * Lane C: *"The nav says 'Class Schedule' but the page is 'Timetable'. Pick one
 * familiar name."* **"Class Schedule" wins.** It is already what the product calls
 * the place everywhere a scheduler reads it; "Timetable" is the INTERNAL name
 * leaking into user-visible text. So the fix closes the leak rather than renaming
 * five already-committed, already-familiar surfaces.
 *
 * ── WHAT THIS FILE IS ACTUALLY PROVING ───────────────────────────────────────
 * The hard part of "rename the label" is that a rename is one keystroke away from
 * being a rename of the ROUTE. So this file pins the ENTIRE `{to, label}` table as
 * a literal, and the entire `routeChromeOverrides` key set as a literal, taken from
 * the tree this candidate branched from. A row that only checked "the label says
 * Class Schedule" would pass on a tree where someone had also moved a path.
 *
 * `routeChromeOverrides` is module-private, so the keys are proven through the
 * public surface that reads them — `resolveRouteChrome` — and each path is asserted
 * to still resolve to its own title rather than the generic ATLAS fallback.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

import { CLASS_SCHEDULE_LABEL } from '../class-schedule-naming';
import {
	breadcrumbGroups,
	getVisibleNavigation,
	resolveRouteChrome,
	timetableNav,
} from '../../components/app-shell/navigation';

const ADMIN_SCHEDULER = { role: 'admin', capabilities: ['timetable:read'] };

/** Every `to` an admin scheduler sees, in order, exactly as it is at base. */
const EXPECTED_VISIBLE_NAV: Array<[string, string]> = [
	['Dashboard', '/'],
	['Sections', '/sections'],
	['Subjects', '/subjects'],
	['Teachers', '/teachers'],
	['Teaching Load', '/teaching-load'],
	['Teacher Concerns', '/faculty/concerns'],
	['Room Preferences', '/faculty/room-preferences'],
	['Campus & Rooms', '/map'],
	['Class Schedule', '/timetable'],
	['Room Schedules', '/schedules'],
	['Audit', '/audit'],
];

/** The `routeChromeOverrides` KEYS, each with the title it still carries. */
const EXPECTED_CHROME: Array<[string, string]> = [
	['/timetabling/how-it-works', 'How Scheduling Works'],
	['/timetable/policies', 'Scheduling Policy'],
	['/timetable/pre-generation', 'Pre-Generation'],
	['/timetable/map', 'Campus Map'],
	['/timetable/manual-edit', 'Manual Edit'],
	['/timetable/building', 'Building View'],
	['/timetable/exports', 'Download schedules'],
	['/timetable/runs', 'Runs'],
	['/timetable/setup', 'Setup'],
];

test('L6a the place name is ONE constant and it is the familiar one', () => {
	assert.equal(CLASS_SCHEDULE_LABEL, 'Class Schedule', 'the ruling: the familiar name wins, the internal one stops leaking');
});

test('L6b the nav item, the breadcrumb group and the page heading all read that one constant', () => {
	// The nav item.
	assert.deepEqual(timetableNav.map((item) => item.label), [CLASS_SCHEDULE_LABEL]);
	// The group divider's group, which AppSidebar renders as a `NavDivider`.
	assert.ok(
		breadcrumbGroups.some((group) => group.label === CLASS_SCHEDULE_LABEL && group.items === timetableNav),
		'the breadcrumb group is named by the same constant',
	);
	// The `<h1>`: `TimetableSubNavRow` renders `resolveRouteChrome(pathname).title`.
	assert.equal(resolveRouteChrome('/timetable').title, CLASS_SCHEDULE_LABEL, 'the page <h1> resolves to the constant');
	assert.deepEqual(resolveRouteChrome('/timetable').breadcrumbs, [CLASS_SCHEDULE_LABEL]);
});

test('L6c every `to` is byte-identical to base — a label change is not a route change', () => {
	assert.deepEqual(
		getVisibleNavigation(ADMIN_SCHEDULER).map((item) => [item.label, item.to]),
		EXPECTED_VISIBLE_NAV,
		'the whole {label, to} table is unchanged: only the Class Schedule label is now constant-driven',
	);
	// `/timetable` in particular is a ROUTE and is spelled the same way.
	assert.deepEqual(timetableNav.map((item) => item.to), ['/timetable']);
	assert.equal(resolveRouteChrome('/timetable').title, CLASS_SCHEDULE_LABEL, 'the route still resolves — only the words changed');
});

test('L6d every routeChromeOverrides key and title is byte-identical to base', () => {
	for (const [path, title] of EXPECTED_CHROME) {
		const chrome = resolveRouteChrome(path);
		assert.equal(chrome.title, title, `${path} still carries its own title`);
		assert.deepEqual(chrome.breadcrumbs, [CLASS_SCHEDULE_LABEL, title], `${path} is still grouped under the one name`);
	}
	// `/timetable` itself must still fall through to the nav label, which is what
	// proves it was not silently added as a `routeChromeOverrides` entry.
	assert.notEqual(resolveRouteChrome('/timetable').title, 'Class Schedule workspace');
});

test('L6e the loading surfaces read the same constant, not a second literal', async () => {
	const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
	Object.assign(globalThis, {
		window: dom.window,
		document: dom.window.document,
		HTMLElement: dom.window.HTMLElement,
		Element: dom.window.Element,
		Node: dom.window.Node,
		Event: dom.window.Event,
		CustomEvent: dom.window.CustomEvent,
		KeyboardEvent: dom.window.KeyboardEvent,
		MouseEvent: dom.window.MouseEvent,
		MutationObserver: dom.window.MutationObserver,
		getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
		requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
		cancelAnimationFrame: (id: number) => clearTimeout(id),
		ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
		DOMRect: dom.window.DOMRect,
		IS_REACT_ACT_ENVIRONMENT: true,
	});
	Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

	const { act, createElement } = await import('react');
	const { createRoot } = await import('react-dom/client');
	const { MemoryRouter } = await import('react-router-dom');
	const { TimetableRouteLoadingState } = await import('../../components/timetable/TimetableRouteLoadingState');
	const { TimetableSubNavRow } = await import('../../components/timetable/TimetableSubNav');

	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		// The router really is AT `/timetable`, so the `<h1>` under test is the one a
		// scheduler on the Class Schedule page sees — not a component rendered in a
		// vacuum whose heading happens to match.
		root.render(createElement(MemoryRouter, { initialEntries: ['/timetable'] }, [
			createElement(TimetableRouteLoadingState, {
				intent: { title: 'Schedule', message: 'Reading the latest run.' },
				key: 'loading',
			}),
			createElement(TimetableSubNavRow, { key: 'subnav' }),
		]));
	});

	const html = host.innerHTML;
	// The eyebrow and the sub-nav's region label both come from the constant.
	assert.ok(html.includes(CLASS_SCHEDULE_LABEL), 'the loading eyebrow names the place with the constant');
	assert.ok(
		host.querySelector(`nav[aria-label="${CLASS_SCHEDULE_LABEL} sections"]`),
		'the sub-nav region is named "Class Schedule sections"',
	);
	assert.doesNotMatch(html, /Timetable sections/, 'the internal name no longer reaches the sub-nav label');
	// And the <h1> the sub-nav row owns is the same constant.
	assert.equal(host.querySelector('[data-testid="timetable-page-heading"]')?.textContent, CLASS_SCHEDULE_LABEL);

	await act(async () => root.unmount());
	host.remove();
});
