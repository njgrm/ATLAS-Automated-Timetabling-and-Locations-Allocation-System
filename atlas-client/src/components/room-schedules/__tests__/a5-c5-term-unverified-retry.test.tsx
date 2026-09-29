/**
 * A5 C5 R2 (2026-09-29) B1 — the `term-unverified` retry must DO what its own body says.
 *
 * THE DEFECT THIS PROVES ABSENT. `UNVERIFIED_TERM_BODY` tells a scheduler to "Retry once the term
 * is confirmed, or ask an administrator to re-sync the school year." The `Try again` button it
 * renders called `fetchSchedule()` — and for this reason that call PROVABLY cannot change the
 * outcome, on three independent counts:
 *
 *   1. `viewTerm` is null, so `fetchSchedule` returns the same `term-unverified` state BEFORE it
 *      makes any request (`RoomSchedules.tsx`, the `viewTerm == null` guard);
 *   2. `viewTermOptions` is `[]` while authority is unresolved, so there is no term to select;
 *   3. `resolveActiveSchoolYearContext` is called once, inside `useEffect(..., [actorSchoolId])`,
 *      and `More > Refresh` is the same `fetchSchedule`.
 *
 * So the button was a control that could not recover anything. QA round 2, on the second review
 * round: "an inert button is not a right next step, which is the exact dimension F1 was raised
 * about."
 *
 * WHY THIS RENDERS THE REAL PAGE AND NOT A SNIPPET. The defect is not in a string and not in a
 * helper: it is in the WIRING between an authority read that happens once and a control that
 * claims to re-ask. A source grep could only have counted the characters `onClick` and
 * `fetchSchedule`; it could not have told whether pressing the button re-reads the authority. So
 * the rows below mount `pages/RoomSchedules.tsx` itself and count the resolver's real calls.
 *
 * THE FAILING-FIRST CONTROL, and how to read it. Row 1 is the load-bearing one. Against base
 * `4f01fccc` the resolver is called EXACTLY ONCE for the whole session — the button renders, is
 * clickable, and changes nothing — so `yearContextState.calls` stays 1 and the row fails. After
 * the fix the retry is a SECOND read, the term resolves, and the page proceeds to the schedule.
 * The assertion is the call count, not the presence of a button: a test that only proved the
 * button exists is exactly the test that passed while the defect shipped.
 *
 * Row 2 is the negative control that keeps the fix honest. If the term is STILL unresolved after
 * a retry, the retry must re-read and then stay refused, and must never have requested a
 * schedule — a recovery that could manufacture a term would be worse than an inert button.
 *
 * WHAT IS NOT CLAIMED HERE: nothing about how this LOOKS, how many clicks the three questions
 * cost, or the 1366x768 grid. Those are the browser rows, they are Lane C's, and this lane has
 * no seeded session (`NEEDS_SESSION(lane-a5/playwright-mcp)`).
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/schedules?roomId=1' });
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
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};

// ── Fixtures ───────────────────────────────────────────────────────────────────────────────

const VERIFIED_TERM = {
	verified: true,
	termIndex: 1,
	orderedTerms: [
		{ order: 1, label: 'Term 1' },
		{ order: 2, label: 'Term 2' },
		{ order: 3, label: 'Term 3' },
	],
};

const BUILDINGS = {
	buildings: [{
		id: 5,
		name: 'Academic Wing',
		rooms: [
			{ id: 1, name: 'Room 101', type: 'CLASSROOM', isTeachingSpace: true, floor: 1, capacity: 40 },
			{ id: 2, name: 'Room 102', type: 'CLASSROOM', isTeachingSpace: true, floor: 1, capacity: 40 },
		],
	}],
};

const SCHEDULE_VIEW = {
	room: { id: 1, name: 'Room 101', type: 'CLASSROOM', buildingId: 5, buildingName: 'Academic Wing', floor: 1 },
	source: { mode: 'LATEST', runId: null, status: 'PUBLISHED', generatedAt: '2026-09-29T08:00:00.000Z' },
	timeSlots: [{ startTime: '07:00', endTime: '08:00' }],
	days: ['MONDAY'],
	grid: [{
		timeSlot: { startTime: '07:00', endTime: '08:00' },
		cells: [{
			day: 'MONDAY', occupied: true, conflict: false,
			entries: [{
				entryId: 'e-1', subjectId: 41, sectionId: 7, facultyId: 3, roomId: 1,
				startTime: '07:00', endTime: '08:00', durationMinutes: 60, termIndex: 1,
			}],
		}],
	}],
	summary: { occupiedMinutes: 60, availableMinutes: 300, utilizationPercent: 20, entryCount: 1, conflictCount: 0 },
};

/**
 * The one authority read, counted. `resolveFromCall` is what makes row 2 possible: with
 * `Number.POSITIVE_INFINITY` the term is NEVER verified, so a retry can only re-read and re-refuse.
 */
const yearContextState = { calls: 0, resolveFromCall: Number.POSITIVE_INFINITY };

/** Every URL the page requested, so a row can prove a request was NOT made. */
const requestedUrls: string[] = [];

mock.module(import.meta.resolve('@/lib/enrollpro-public-settings'), {
	namedExports: {
		resolveActiveSchoolYearContext: async () => {
			yearContextState.calls += 1;
			return {
				activeSchoolYearId: 1,
				activeSchoolYearLabel: '2026-2027',
				activeTerm: yearContextState.calls >= yearContextState.resolveFromCall ? VERIFIED_TERM : null,
			};
		},
	},
});

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			requestedUrls.push(url);
			if (url.includes('/buildings')) return { data: BUILDINGS };
			if (url.startsWith('/subjects')) return { data: { subjects: [{ id: 41, code: 'SCI10', displayCode: 'SCI10', name: 'Earth Science' }] } };
			if (url.startsWith('/faculty')) return { data: { faculty: [{ id: 3, firstName: 'Ana', lastName: 'Reyes', isActiveForScheduling: true }] } };
			if (url.includes('/runs?limit=')) return { data: { runs: [] } };
			if (url.includes('/sections/summary/')) return { data: { sections: [] } };
			if (url.includes('/room-schedules/')) return { data: SCHEDULE_VIEW };
			throw new Error(`unstubbed request: ${url}`);
		},
		post: async () => ({ data: {} }),
		patch: async () => ({ data: {} }),
		put: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

mock.module(import.meta.resolve('@/lib/actor-scope-session'), {
	namedExports: {
		useActorSchoolScope: () => ({
			actorSchoolId: 1, resolved: true, epochVersion: 0, token: 'test-token', retry: () => {},
		}),
	},
});

// react-dom must load after the DOM globals, or it disables input events.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { resolveScheduleEmptyState } = await import('@/lib/schedule-empty-state');
const RoomSchedules = (await import('@/pages/RoomSchedules')).default;

let root: Root | null = null;
let host: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	host?.remove();
	dom.window.close();
});

async function flush(times = 8): Promise<void> {
	for (let i = 0; i < times; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function mount(): Promise<HTMLElement> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	host?.remove();
	host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	root = createRoot(host as unknown as HTMLElement);
	await act(async () => {
		root!.render(<MemoryRouter initialEntries={['/schedules?roomId=1']}><RoomSchedules /></MemoryRouter>);
	});
	await flush();
	return host;
}

/** What the page is showing, read from the DOM rather than from the source. */
function readScreen(el: HTMLElement) {
	const empty = el.querySelector('[data-testid="schedules-empty-term-unverified"]');
	return {
		refusalVisible: empty != null,
		refusalButton: empty as HTMLButtonElement | null,
		chip: (el.querySelector('[data-testid="schedules-readiness-chip"]')?.textContent ?? '').trim(),
		text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
		roomScheduleRequests: requestedUrls.filter((u) => u.includes('/room-schedules/')),
	};
}

// ── Rows ─────────────────────────────────────────────────────────────────────────────────────

test('B1 CONTROL: the term-unverified retry RE-READS the term authority and then proceeds', async () => {
	// The failing-first shape. Unresolved on the first read, verified from the second — which is
	// exactly the real world this button claims to serve: an administrator re-syncs the school
	// year, and the scheduler presses the button that says to press it again.
	yearContextState.calls = 0;
	yearContextState.resolveFromCall = 2;
	requestedUrls.length = 0;

	const el = await mount();
	const before = readScreen(el);

	// Precondition: the page really is refusing for the right reason, before anything is pressed.
	assert.equal(yearContextState.calls, 1, 'the year context is read exactly once on mount');
	assert.ok(before.refusalVisible, `the term-unverified refusal must be on screen; saw "${before.chip}"`);
	assert.equal(before.roomScheduleRequests.length, 0, 'the refusal happens BEFORE any schedule request');

	// Press the button the body told this scheduler to press.
	await act(async () => {
		before.refusalButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await flush();

	const after = readScreen(el);

	// THE DECISIVE ASSERTION. On base `4f01fccc` this number stays 1: the button renders, is
	// clickable, and re-reads nothing, which is the defect in one integer.
	assert.ok(
		yearContextState.calls >= 2,
		`"Try again" must re-read the term authority, not refetch a schedule it may not request; resolver calls = ${yearContextState.calls}`,
	);
	assert.equal(
		before.roomScheduleRequests.length + 0,
		0,
		'no schedule was requested before the retry, so the recovery cannot be a refetch in disguise',
	);
	assert.equal(
		after.roomScheduleRequests.length,
		1,
		`after the retry resolved the term, the page must request the schedule exactly once; got ${JSON.stringify(after.roomScheduleRequests)}`,
	);
	assert.match(
		after.roomScheduleRequests[0] ?? '',
		/termIndex=1/,
		'the request must carry the term the retry obtained',
	);
	assert.equal(after.refusalVisible, false, 'the refusal must be gone once a term is proven');
	assert.equal(after.chip, 'Ready', 'the readiness chip must report the loaded view');
	assert.match(after.text, /Utilization: 20%/, 'the loaded schedule, not a skeleton, is on screen');
});

test('B1 NEGATIVE CONTROL: a retry that cannot resolve the term stays refused, and requests nothing', async () => {
	// The term is never verified. A recovery that could manufacture a term would be far worse
	// than an inert button, so this row pins the other half of the contract.
	yearContextState.calls = 0;
	yearContextState.resolveFromCall = Number.POSITIVE_INFINITY;
	requestedUrls.length = 0;

	const el = await mount();
	const before = readScreen(el);
	assert.ok(before.refusalVisible, 'precondition: the refusal is on screen');

	await act(async () => {
		before.refusalButton!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await flush();

	const after = readScreen(el);
	assert.ok(
		yearContextState.calls >= 2,
		`the retry must still re-read the authority, not do nothing; resolver calls = ${yearContextState.calls}`,
	);
	assert.equal(after.refusalVisible, true, 'an unresolvable term must stay refused, truthfully');
	assert.equal(
		after.roomScheduleRequests.length,
		0,
		'a retry must never request a schedule without a verified term — that is the fail-closed rule this page exists for',
	);
});

test('B1 CONTRACT: a retry names the authority it re-reads, so an inert retry cannot be added silently', async () => {
	const nextStep = resolveScheduleEmptyState('term-unverified', 'ignored').nextStep;
	assert.equal(nextStep.kind, 'retry', 'the unresolved term is a verification state, not something to build');
	assert.equal(
		nextStep.kind === 'retry' ? nextStep.recheck : null,
		'term-authority',
		'the retry must DECLARE that it re-reads the term authority; an undeclared retry is how the inert button came back',
	);
});
