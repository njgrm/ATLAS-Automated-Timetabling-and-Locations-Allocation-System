/**
 * A9 C3 (2026-09-29) — RENDERED: the guided home-room step on `/sections`.
 *
 * THE DEFECT THIS FILE IS EVIDENCE AGAINST. The older-user audit rejected the page because
 * "20 need rooms" sat beside twenty identical "Choose home room" selectors, and because the
 * dialog behind the `Auto-assign rooms` button opened on two switches, led with four count
 * badges, and labelled every row with a translated enum. `AGENTS.md` §11: a user-facing fix is
 * done when it is SEEN, and a test that only asserts source text is not acceptance evidence —
 * so the rows below read the RENDERED dialog and the recorded transport calls, and the
 * planner's browser rows are the other half of the same proof.
 *
 * THE FIXTURE IS THE REAL SERVER SHAPE. `AutoAssignResult` is copied field-for-field from
 * `home-room-auto-assign.service.ts:31` (`assignments[]` with `sectionName`/`gradeLevel`/
 * `roomName`/`buildingName`/`reason`, `skipped[]` with `reason`, `counts`), and the room list
 * is the real `RoomOption`. A fixture invented for the test is how the a5-c3 picker contract
 * caught a control validating against text the real surface never produced, so this one is
 * taken from the service, not from what would be convenient.
 *
 * WRITES ARE COUNTED, NOT MERELY ABSENT, and the stub can fail on demand: the packet requires
 * that a failure must not silently half-apply and must say what did and did not save, and that
 * is a claim about behaviour under a REJECTED transport, so the rejection has to be reachable.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mock, test } from 'node:test';

import { JSDOM } from 'jsdom';
import { installCanvasShim } from '../../__tests__/konva-dom-render-harness';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	SVGElement: dom.window.SVGElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	// `clearTimeout` takes ONE argument. A9-C3 first wrote `clearTimeout(id, id)`, copied
	// from a Node-flavored shim, which is TS2554 in this DOM-typed harness.
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
dom.window.HTMLElement.prototype.releasePointerCapture = () => {};
dom.window.HTMLElement.prototype.setPointerCapture = () => {};
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

/** The real `RoomOption` the page's picker is fed, and a building for the row's "room · building". */
const ROOM_OPTIONS = [
	{ id: 201, name: 'Room 201', buildingName: 'Building A', type: 'CLASSROOM' },
	{ id: 202, name: 'Room 202', buildingName: 'Building A', type: 'CLASSROOM' },
	{ id: 203, name: 'Room 203', buildingName: 'Building B', type: 'CLASSROOM' },
];

/** Copied field-for-field from `home-room-auto-assign.service.ts` (mode 'preview'). */
const PREVIEW = {
	schoolId: 1,
	schoolYearId: 9,
	mode: 'preview',
	overwriteExisting: false,
	allowCrossGradeFallback: false,
	assignments: [
		{ sectionId: 1001, sectionName: 'Grade 7 - Aguinaldo', gradeLevel: 7, homeRoomId: 201, roomName: 'Room 201', buildingId: 1, buildingName: 'Building A', reason: 'GRADE_SCOPE_MATCH' },
		{ sectionId: 1002, sectionName: 'Grade 7 - Bonifacio', gradeLevel: 7, homeRoomId: 202, roomName: 'Room 202', buildingId: 1, buildingName: 'Building A', reason: 'ANY_GRADE_FALLBACK' },
	],
	skipped: [
		{ sectionId: 1003, sectionName: 'Grade 7 - del Pilar', gradeLevel: 7, reason: 'ROOM_CAPACITY_TOO_SMALL' },
	],
	counts: { sectionsConsidered: 3, assigned: 2, skipped: 1, existingPreserved: 0, applied: 0 },
};

const transport = {
	posts: [] as Array<{ url: string; body: Record<string, unknown> }>,
	puts: [] as Array<{ url: string; body: Record<string, unknown> }>,
	putResult: { updated: 2 } as { updated: number },
	putError: null as { response: { data: { message: string } } } | null,
};

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => { throw new Error(`unexpected GET in the guided step: ${url}`); },
		post: async (url: string, body: Record<string, unknown>) => {
			transport.posts.push({ url, body });
			return { data: PREVIEW };
		},
		put: async (url: string, body: Record<string, unknown>) => {
			transport.puts.push({ url, body });
			if (transport.putError) throw transport.putError;
			return { data: transport.putResult };
		},
		patch: async () => ({ data: {} }),
		delete: async () => ({ data: {} }),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

installCanvasShim(dom.window as unknown as { HTMLCanvasElement: { prototype: Record<string, unknown> } });

const { act, createElement } = await import('react');
const { createRoot } = await import('react-dom/client');
type Root = import('react-dom/client').Root;
const { MemoryRouter } = await import('react-router-dom');
const { HomeRoomAutoAssignDialog } = await import('../HomeRoomAutoAssignDialog');

/**
 * The rendered document, typed as the `Document` it actually is.
 *
 * A9-C3 first wrote this as `dom.window.document as unknown as HTMLElement`, and the cast
 * was the defect: it silenced the compiler on the two helper lines below that DO work on a
 * `Document` (`querySelector`/`querySelectorAll`, via `ParentNode`) while making the three
 * call sites that need `createElement`/`body` fail to typecheck. Reading the value as what
 * it is fixes all five errors without an `any` or a suppression.
 */
const doc = () => dom.window.document;
const byTestId = (id: string) => doc().querySelector<HTMLElement>(`[data-testid="${id}"]`);
const allByTestId = (id: string) => Array.from(doc().querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
const dialogText = () => doc().querySelector('[role="dialog"]')?.textContent ?? '';

let root: Root | null = null;
let host: HTMLElement | null = null;

function reset() {
	transport.posts.length = 0;
	transport.puts.length = 0;
	transport.putResult = { updated: 2 };
	transport.putError = null;
}

async function open(props: Partial<Parameters<typeof HomeRoomAutoAssignDialog>[0]> = {}) {
	// The transport is a MODULE-level counter, so it must be cleared per case. Without this
	// the "exactly once" and "nothing was written" rows are decided by the previous test's
	// calls — which is how a suite that looks behavioural can quietly stop being one.
	reset();
	await act(async () => {
		// A local `const`, because `host` is a nullable module-level binding: reading it back
		// for `createRoot` would be `HTMLElement | null` and not assignable to `Container`.
		const container = doc().createElement('div');
		host = container;
		doc().body.appendChild(container);
		root = createRoot(container);
		root.render(
			createElement(
				MemoryRouter,
				null,
				createElement(HomeRoomAutoAssignDialog, {
					open: true,
					onOpenChange: () => {},
					schoolId: 1,
					schoolYearId: 9,
					homeRoomOptions: ROOM_OPTIONS as never,
					roomOccupancy: new Map<number, string>(),
					canWrite: true,
					onApplied: () => {},
					...props,
				} as never),
			),
		);
	});
	// The preview is a promise; let it settle inside act.
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

async function close() {
	await act(async () => { root?.unmount(); });
	host?.remove();
	host = null;
	root = null;
}

function clickText(text: string) {
	const target = Array.from(doc().querySelectorAll<HTMLElement>('button')).find((b) => (b.textContent ?? '').includes(text));
	assert.ok(target, `no button reading "${text}" was rendered`);
	act(() => { target!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** A click that DISPATCHES, so a disabled control's handler is still reached. */
function forceClick(target: HTMLElement | null, label: string) {
	assert.ok(target, `control tried to force-click a missing control: ${label}`);
	act(() => { target!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

test.afterEach(async () => { await close(); });

test('A9-C3-R1a: the review list reads in plain words, names the room and the building, and shows the skip', async () => {
	await open();
	const rows = allByTestId('guided-step-row');
	assert.equal(rows.length, 2, 'the review list did not render one line per suggested section');
	const text = dialogText();
	// The packet's target line, in its own words.
	assert.match(text, /Aguinaldo/, 'the section is not named');
	assert.match(text, /Room 201/, 'the suggested room is not named');
	// The reason is a phrase, and the enum is nowhere on the screen.
	assert.match(text, /same grade wing/, 'the plain reason phrase is missing');
	assert.doesNotMatch(text, /GRADE_SCOPE_MATCH|ANY_GRADE_FALLBACK|considered|existingPreserved/, 'server vocabulary reached the screen');
	// The skipped section is NOT hidden, and it carries its fix.
	assert.equal(allByTestId('guided-step-skipped-row').length, 1, 'a skipped section was hidden');
	assert.match(text, /del Pilar/);
	assert.match(text, /every free room is too small for the class/);
	assert.match(text, /Add a room that seats this many students/, 'the skip has no one fix');
	// The old four count badges are gone, replaced by one sentence.
	assert.doesNotMatch(text, /\bconsidered\b|\bpreserved\b/, 'the count badges came back');
	await close();
});

test('A9-C3-R1b: ONE apply action, carrying the reviewed count, and the preview is overwrite-free', async () => {
	await open();
	assert.equal(transport.posts.length, 1, 'the step did not read the free rooms exactly once');
	assert.match(String(transport.posts[0].url), /\/sections\/home-rooms\/9\/auto-assign$/, 'the preview used the wrong route');
	// The two switches are gone, so these are the only options it can have asked for.
	assert.equal(transport.posts[0].body.mode, 'preview');
	assert.equal(transport.posts[0].body.overwriteExisting, false);
	const apply = byTestId('guided-step-apply');
	assert.ok(apply, 'there is no apply action');
	assert.equal((apply!.textContent ?? '').trim(), 'Apply these 2 rooms');
	assert.equal(byTestId('guided-step-apply')?.hasAttribute('disabled'), false);
	await close();
});

test('A9-C3-R1c: applying persists the WHOLE reviewed set in ONE write, and says what saved', async () => {
	await open();
	clickText('Apply these 2 rooms');
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });

	assert.equal(transport.puts.length, 1, 'the batch was not applied in a single write');
	assert.match(String(transport.puts[0].url), /\/sections\/home-rooms\/9$/, 'the apply used the wrong route');
	// The reviewed set, in the server's own id space (`externalId` on both sides).
	assert.deepEqual(transport.puts[0].body.assignments, [
		{ sectionId: 1001, homeRoomId: 201 },
		{ sectionId: 1002, homeRoomId: 202 },
	]);
	assert.equal(transport.puts[0].body.schoolId, 1);
	assert.match(byTestId('guided-step-outcome')?.textContent ?? '', /Saved 2 rooms\./);
	await close();
});

test('A9-C3-R1d: a PARTIAL save names the rooms that were left unchanged', async () => {
	await open();
	// Set AFTER `open`, which resets the transport: a fixture configured before the mount
	// is silently discarded, and the row then passes on the default's behaviour instead of
	// the one it claims to decide.
	transport.putResult = { updated: 1 };
	clickText('Apply these 2 rooms');
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
	assert.match(
		byTestId('guided-step-outcome')?.textContent ?? '',
		/Saved 1 of 2 rooms\. The other 1 was left unchanged\./,
		'a partial save was reported as a whole one',
	);
	await close();
});

test('A9-C3-R1e: a REJECTED write says the typed reason and that nothing saved', async () => {
	await open();
	// After `open` — see R1d. A rejection is the only way to reach the "nothing saved"
	// sentence, so the transport has to be armed and still be armed at the click.
	transport.putError = { response: { data: { message: 'CROSS_SCHOOL_DENIED' } } };
	clickText('Apply these 2 rooms');
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
	const failure = byTestId('guided-step-apply-error');
	assert.ok(failure, 'a rejected write produced no visible failure');
	assert.match(failure!.textContent ?? '', /CROSS_SCHOOL_DENIED/, 'the typed server reason was swallowed');
	assert.match(failure!.textContent ?? '', /No rooms were saved/, 'a rejected batch did not say that nothing saved');
	assert.equal(byTestId('guided-step-outcome'), null, 'a rejected write also claimed a save');
	await close();
});

test('A9-C3-R1f: read-only is enforced IN CODE, not only by the disabled attribute', async () => {
	await open({ canWrite: false, notSavedNotice: 'Rooms cannot be saved while ATLAS checks the roster.' });
	const apply = byTestId('guided-step-apply');
	assert.equal(apply?.hasAttribute('disabled'), true, 'the apply action is enabled while writes are blocked');
	// The reason travels with the disabled control — a disabled primary action is never inert.
	assert.match(byTestId('guided-step-readonly')?.textContent ?? '', /cannot be saved while ATLAS checks/);
	// And dispatching the click anyway writes nothing: this is the difference between a
	// guard in the handler and a guard in the markup.
	forceClick(apply, 'guided-step-apply');
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
	assert.equal(transport.puts.length, 0, 'a read-only step wrote to the server anyway');
	await close();
});

test('A9-C3-R1g: a changed row is a MANUAL choice, and it is the one that is sent', async () => {
	await open();
	// Drive the shared picker the way the operator would: open the row's popover, choose
	// the third room. This is the `SectionRoomPicker` primitive itself — the same control
	// the table rows used, which is what §8 "one look per control" requires.
	const trigger = allByTestId('guided-step-row')[1]?.querySelector<HTMLElement>('[role="combobox"]');
	assert.ok(trigger, 'the review row does not carry the shared room picker');
	await act(async () => { trigger!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
	const option = Array.from(doc().querySelectorAll<HTMLElement>('[role="option"]')).find((o) => (o.textContent ?? '').includes('Room 203'));
	assert.ok(option, 'the picker did not offer the third room');
	await act(async () => { option!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
	await act(async () => { await Promise.resolve(); });

	const row = allByTestId('guided-step-row')[1];
	assert.equal(row?.getAttribute('data-manual'), 'true', 'a changed row does not declare itself a manual choice');
	// Scoped to THAT row: a document-wide query returns row 1's reason, which would make
	// this row pass on the wrong element's text.
	const reason = row?.querySelector<HTMLElement>('[data-testid="guided-step-row-reason"]')?.textContent ?? '';
	assert.match(reason, /your choice/, `the changed row still claims the server chose it: ${reason}`);
	assert.match(dialogText(), /1 changed by you/, 'the operator is not told how many rows they changed');

	clickText('Apply these 2 rooms');
	await act(async () => { await Promise.resolve(); await Promise.resolve(); });
	// The manual choice is what is persisted — the whole reason the apply is the per-row
	// PUT and not `mode: 'apply'`, which would overwrite it with the server's own set.
	assert.deepEqual(transport.puts[0].body.assignments, [
		{ sectionId: 1001, homeRoomId: 201 },
		{ sectionId: 1002, homeRoomId: 203 },
	]);
	await close();
});

test('A9-C3-R1h: the page routes the step\'s save-state question to exactly ONE line', async () => {
	// The jargon the audit named lived in three places. Two are gone with their controls
	// (the edit-status banner and the "N needs rooms" badge); what remains must be a single
	// line that answers "does a click save now, or is it waiting?".
	const page = readFileSync(resolve(import.meta.dirname, '../../../pages/Sections.tsx'), 'utf8');
	assert.doesNotMatch(page, /home-room edits can be queued|will be queued on this device/i, 'the old jargon sentence is back in the page');
	assert.match(page, /editStatus=\{homeRoomEditStatus\}/, 'the save-state line is no longer wired');
	// Counted as JSX, not as a substring: the file's own comments name this component six
	// times while rendering it once, and a count that a comment can move is not a gate.
	assert.equal((page.match(/<SectionsStatusBanners/g) ?? []).length, 1, 'the page renders a second status surface');
	assert.doesNotMatch(page, /<SectionsStatusBanners[\s\S]{0,400}editStatus=/, 'the page still feeds the removed banner');
	// The band is the ONE place the action and its qualifier live.
	assert.equal((page.match(/<SectionsHomeRoomActions/g) ?? []).length, 1);
});
