/**
 * A5 C5 PROOF FIXES (2026-09-29) — the THREE defects a real browser render found on `main`.
 *
 * WHY THIS FILE EXISTS AT ALL. The A5 c5 Room Schedules rewrite passed two QA rounds and is on
 * `main`, because every gate it had was a SOURCE gate: a rendered h1 never left this repo. It was
 * then opened in a real browser at 1366x768 against real staging data, and that render found three
 * things no source assertion could have found, all on the surface the operator is judging. This
 * file is the source-side regression guard for exactly those three, and for nothing else.
 *
 *   D1  the one status chip was FALSE and DUPLICATED. It read `Choose a name` while the picker
 *       directly below it read `Choose a room`, on a page where a room WAS chosen. It was wired to
 *       `state.status` — `'empty'`, because staging has no finished timetable — and it duplicated
 *       the picker's instruction and reported the NAME LIST (`Loading names`).
 *   D2  the `no-runs` empty state rendered the SERVER's message verbatim as its body:
 *       `No completed generation runs found for this school/year.` It is the first thing a user
 *       reads on the one page whose purpose is plain words.
 *   D3  the page hardcoded a third name for one destination: its own `<h1>` said `Schedules` while
 *       the sidebar and the chrome title both said `Look up & print schedules`.
 *
 * WHY THESE ROWS RENDER THE REAL PAGE. Two of the three defects are not in a string. D1 is a
 * WIRING fault (which state drives the chip, and does the chip exist at all in the empty state);
 * D3 is a NAME that three surfaces must agree on. A grep could count characters; only a mount can
 * tell what a scheduler actually sees, so every row below mounts `pages/RoomSchedules.tsx` itself
 * and reads the DOM. The D2 unit row uses the real resolver, because that is where the copy is
 * decided and the packet's rule is that one resolver owns the body.
 *
 * HOW TO READ A FAILING-FIRST ROW. Each control row states in its assertion message what the page
 * does at base `daefedc3`, so a reviewer can confirm the row discriminates without re-running the
 * base. Rows 2, 5 and 7 are PRESERVATION rows: they pass before and after by design, and they are
 * what stops a fix from over-correcting (deleting the chip when it is truthful, putting a `Help`
 * popover on client-authored copy, or inventing a fourth name).
 *
 * NOT CLAIMED HERE: anything about how the page LOOKS at 1366x768, the click counts, the absence
 * of horizontal scroll, or the two calm header rows. Those are browser rows, browser custody is
 * the planner's this cycle, and this lane ran none. The h2 rows below assert the header's CONTENT
 * and testids, not its geometry.
 */
import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/room-schedules?roomId=1' });
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

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────

/** Verbatim from the rendered staging capture in the A5 c5 proof render. */
const NO_RUNS_SERVER_MESSAGE = 'No completed generation runs found for this school/year.';

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

/** The one switch every row sets: what the room-schedule read does. */
const serverState = { mode: 'no-runs' as 'no-runs' | 'ok' | 'hold', termVerified: true };

mock.module(import.meta.resolve('@/lib/enrollpro-public-settings'), {
	namedExports: {
		resolveActiveSchoolYearContext: async () => ({
			activeSchoolYearId: 1,
			activeSchoolYearLabel: '2026-2027',
			activeTerm: serverState.termVerified ? VERIFIED_TERM : null,
		}),
	},
});

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			if (url.includes('/buildings')) return { data: BUILDINGS };
			if (url.startsWith('/subjects')) return { data: { subjects: [{ id: 41, code: 'SCI10', displayCode: 'SCI10', name: 'Earth Science' }] } };
			if (url.startsWith('/faculty')) return { data: { faculty: [{ id: 3, firstName: 'Ana', lastName: 'Reyes', isActiveForScheduling: true }] } };
			if (url.includes('/runs?limit=')) return { data: { runs: [] } };
			if (url.includes('/sections/summary/')) return { data: { sections: [] } };
			if (url.includes('/room-schedules/')) {
				if (serverState.mode === 'ok') return { data: SCHEDULE_VIEW };
				if (serverState.mode === 'hold') {
					// A read that never settles, so the page is provably mid-flight.
					return new Promise(() => { /* deliberately unresolved */ });
				}
				// The real staging refusal, verbatim, exactly as the page receives it.
				const err = new Error('Request failed with status code 404') as Error & {
					response?: { status: number; data: { code: string; message: string } };
				};
				err.response = { status: 404, data: { code: 'NO_RUNS', message: NO_RUNS_SERVER_MESSAGE } };
				throw err;
			}
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
const { UNVERIFIED_TERM_BODY } = await import('@/lib/room-schedule-term-copy');
const { LOOKUP_PRINT_LABEL, resolveRouteChrome } = await import('@/components/app-shell/navigation');
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
		root!.render(<MemoryRouter initialEntries={['/room-schedules?roomId=1']}><RoomSchedules /></MemoryRouter>);
	});
	await flush();
	return host;
}

/** What the page shows, read from the DOM rather than from the source. */
function readScreen(el: HTMLElement) {
	const chip = el.querySelector('[data-testid="schedules-readiness-chip"]');
	const emptyBody = el.querySelector('[data-testid="schedules-empty-title"]')?.parentElement
		?.querySelector('p.mt-2');
	return {
		chipPresent: chip != null,
		chip: (chip?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		h1: (el.querySelector('h1')?.textContent ?? '').trim(),
		emptyVisible: el.querySelector('[data-testid="schedules-empty-title"]') != null,
		emptyTitle: (el.querySelector('[data-testid="schedules-empty-title"]')?.textContent ?? '').trim(),
		emptyBody: (emptyBody?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		helpTrigger: el.querySelector('[data-testid="schedules-empty-detail"]') as HTMLButtonElement | null,
		pickerText: (el.querySelector('[data-testid="schedules-entity-picker"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		headerText: (el.querySelector('h1')?.closest('div')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
		visibleText: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
	};
}

async function click(el: Element): Promise<void> {
	await act(async () => {
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
	});
	await flush();
}

// ── D1: the status chip ─────────────────────────────────────────────────────────────────────

test('D1 CONTROL: with a room chosen and no finished timetable, the page says nothing false and shows no chip', async () => {
	// THE FAILING-FIRST ROW. At base `daefedc3` the chip is present and reads `Choose a name`
	// while the picker below it reads `Room 101 (F1)` — the exact contradiction the render caught.
	// A fix that only reworded the label would still fail here: the chip must be GONE, because the
	// empty state below already states the reason in a heading and offers the next step.
	serverState.mode = 'no-runs';
	serverState.termVerified = true;

	const screen = readScreen(await mount());

	assert.equal(serverState.mode, 'no-runs', 'precondition: staging has no finished timetable');
	assert.equal(screen.emptyVisible, true, 'precondition: the page is refusing for the no-runs reason');
	assert.match(screen.pickerText, /Room 101/, 'precondition: a room IS chosen, so any "choose a name" is a lie');
	assert.equal(
		screen.chipPresent,
		false,
		`the chip must not render when nothing is loaded; at base it reads "${screen.chip}" above a chosen room`,
	);
	assert.doesNotMatch(
		screen.headerText,
		/Choose a name/,
		'the header must not instruct the user to use the picker it already used',
	);
	assert.doesNotMatch(screen.visibleText, /Loading names/, 'the chip must not report the NAME LIST either');
});

test('D1 PRESERVATION: the chip is still there, and truthful, when a schedule IS on screen', async () => {
	// The row that stops an over-correction. A "delete the chip" fix would pass D1 and lose the
	// one status the operator is owed, so the truthful case is asserted explicitly. This also keeps
	// the accepted `a5-c5-term-unverified-retry` row (`chip === 'Ready'`) true.
	serverState.mode = 'ok';
	serverState.termVerified = true;

	const screen = readScreen(await mount());

	assert.equal(screen.chipPresent, true, 'a loaded schedule is a status the operator is entitled to');
	assert.equal(screen.chip, 'Ready', 'and it is reported in plain words');
	assert.equal(screen.emptyVisible, false, 'nothing is being refused, so no refusal chrome');
});

test('D1 CONTROL: while the schedule is loading, the chip is about the SCHEDULE, not the names', async () => {
	// THE SECOND FAILING-FIRST ROW. At base the in-flight label is chosen from `roomsLoading`, so
	// once the name list has loaded it falls through to `Choose a name` — during a load. The fix
	// says a label about the schedule loading, in the same `checking` tone.
	serverState.mode = 'hold';
	serverState.termVerified = true;

	const screen = readScreen(await mount());

	assert.equal(screen.chipPresent, true, 'a read is genuinely in flight, so the chip has something to report');
	assert.equal(
		screen.chip,
		'Loading schedule',
		`the chip must describe the schedule, not the name list; at base it read "${screen.chip}"`,
	);
	assert.doesNotMatch(screen.chip, /names/i, '"Loading names" is the pickers business, not the schedules');
});

// ── D2: the empty-state bodies ──────────────────────────────────────────────────────────────

test('D2 CONTROL: the no-runs body is plain words and the server string is moved, not deleted', async () => {
	// THE THIRD FAILING-FIRST ROW. At base the rendered body IS the server string, verbatim.
	// Asserted on the RENDERED body, not on the source, because the defect was what a user reads.
	serverState.mode = 'no-runs';
	serverState.termVerified = true;

	const el = await mount();
	const screen = readScreen(el);

	assert.equal(screen.emptyTitle, 'No timetable has been made yet', 'the heading was already good and is unchanged');
	assert.equal(
		screen.emptyBody,
		'This school year has no finished timetable yet, so there is no week to show here.',
		`the body must be a plain sentence; at base it read "${screen.emptyBody}"`,
	);
	assert.doesNotMatch(
		screen.emptyBody,
		/generation runs|school\/year/i,
		'the servers grammar must not be the sentence a scheduler reads',
	);
	assert.equal(
		screen.emptyBody.includes(NO_RUNS_SERVER_MESSAGE),
		false,
		'the raw server sentence is not the body any more',
	);

	// AND IT IS NOT DELETED. It stays reachable behind Help, which is §8s rule: move the evidence,
	// never destroy it. The trigger reads the plain word `Help`, never the code (§11 rule 3).
	assert.ok(screen.helpTrigger, 'the raw server reason must still be reachable behind a Help affordance');
	assert.equal(
		(screen.helpTrigger.textContent ?? '').replace(/\s+/g, ' ').trim(),
		'Help',
		'the visible label is the word Help, not a code or a sentence',
	);
	assert.equal(
		screen.helpTrigger.getAttribute('title'),
		null,
		'§8 forbids a raw title attribute as an affordance',
	);

	await click(screen.helpTrigger!);
	const popover = dom.window.document.body.textContent ?? '';
	assert.equal(
		popover.includes(NO_RUNS_SERVER_MESSAGE),
		true,
		'opening Help must reveal the server sentence verbatim, so support can still read the reason ATLAS was given',
	);
});

test('D2 PRESERVATION: the other three refusals keep their reviewed client copy and gain no Help', async () => {
	// The packet asks for every body's wording, and asks that a `Help` popover not be sprinkled on
	// copy ATLAS wrote itself. Only `no-runs` is server-authored; the other three set their own
	// message in `fetchSchedule`, so `rawDetail` must be absent and no affordance may appear.
	const term = resolveScheduleEmptyState('term-unverified', 'ignored');
	assert.equal(term.body, UNVERIFIED_TERM_BODY, 'the unverified-term body is the REVIEWED shared copy, unchanged');
	assert.equal(term.rawDetail, undefined, 'client-authored copy is not hidden behind Help');

	const scope = resolveScheduleEmptyState('scope-unverified', 'Your school scope could not be verified. Sign in again, then retry.');
	assert.equal(scope.body, 'Your school scope could not be verified. Sign in again, then retry.');
	assert.equal(scope.rawDetail, undefined);

	const untermable = resolveScheduleEmptyState('draft-untermable', 'Some sessions in this draft have no verified term, so they cannot be shown for one term. Regenerate the draft, then retry.');
	assert.equal(untermable.body, 'Some sessions in this draft have no verified term, so they cannot be shown for one term. Regenerate the draft, then retry.');
	assert.equal(untermable.rawDetail, undefined);

	// And a server that says nothing must produce NO affordance rather than a dead one.
	const silent = resolveScheduleEmptyState('no-runs', '   ');
	assert.equal(silent.rawDetail, undefined, 'a blank server message opens no empty popover');
	assert.match(silent.body, /no finished timetable yet/, 'but the plain reason still stands on its own');
});

test('D2 PRESERVATION: the unverified-term refusal still renders without a Help affordance', async () => {
	serverState.mode = 'ok';
	serverState.termVerified = false;

	const screen = readScreen(await mount());

	assert.equal(screen.emptyTitle, 'Term not verified', 'the pre-existing refusal heading is unchanged');
	assert.equal(screen.emptyBody, UNVERIFIED_TERM_BODY.replace(/\s+/g, ' ').trim());
	assert.equal(screen.helpTrigger, null, 'a client-authored refusal gets no raw-code affordance');
	assert.equal(screen.chipPresent, false, 'and the chip stays gone, because nothing is loaded here either');
});

// ── D3: one name ───────────────────────────────────────────────────────────────────────────

test('D3 CONTROL: the page heading IS the canonical name, and the registry already agreed', async () => {
	// THE FOURTH FAILING-FIRST ROW. At base the rendered h1 is `Schedules`, a third name for one
	// destination, while both the sidebar and the chrome title resolved to `LOOKUP_PRINT_LABEL`.
	// Asserted on the RENDERED heading, and separately against the registry, so the row proves the
	// page is not merely agreeing with itself.
	serverState.mode = 'no-runs';
	serverState.termVerified = true;

	const screen = readScreen(await mount());

	assert.equal(
		screen.h1,
		LOOKUP_PRINT_LABEL,
		`the page must render the canonical name; at base it hardcoded "${screen.h1}"`,
	);
	assert.equal(
		resolveRouteChrome('/room-schedules').title,
		LOOKUP_PRINT_LABEL,
		'the registry this route already resolves to is the same constant the page must render',
	);
	assert.notEqual(screen.h1, 'Schedules', 'the old third name is gone');
});

test('D3 PRESERVATION: the h1 holds on every path, and the header keeps its shape', async () => {
	// The name must not depend on which state the page is in, and making the chip conditional must
	// not have cost the header anything: the title, the ONE primary action and `More` are all still
	// row 1, with the second row's picker below.
	for (const mode of ['no-runs', 'ok'] as const) {
		serverState.mode = mode;
		serverState.termVerified = true;
		const el = await mount();
		const screen = readScreen(el);

		assert.equal(screen.h1, LOOKUP_PRINT_LABEL, `the name must not depend on the fetch state (${mode})`);
		assert.ok(
			el.querySelector('[data-testid="schedules-print-current"]'),
			'the one primary action survives the conditional chip',
		);
		assert.ok(el.querySelector('[data-testid="schedules-more-trigger"]'), 'and More survives it');
		assert.ok(el.querySelector('[data-testid="schedule-browser-selector"]'), 'row 2 is still the picker row');
		// The header is one strip; the picker lives in the row beneath it, never inside the title row.
		assert.equal(
			screen.headerText.includes('Rooms'),
			false,
			'the mode buttons belong to row 2 and have not moved up into the title row',
		);
	}
});
