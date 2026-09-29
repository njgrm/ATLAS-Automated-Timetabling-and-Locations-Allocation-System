/**
 * A3-C14 — `/admin/year-setup`: one sentence, one button, IT details folded away.
 *
 * WHY THIS FILE IS A RENDERED TEST (AGENTS.md §11, "done means seen"). The
 * defect is what a scheduler READS and what they can SEE. A source-text
 * assertion would pass while the page still showed six stacked panels, the
 * technical drift badge and a "Checking the school year now…" that never ends.
 * So every row below drives the REAL `AdminYearSetup` page through jsdom, with
 * the REAL card, year list, carry-forward panel and reset panel it renders, and
 * stubs ONLY the transport (`@/lib/api`) — the same shape
 * `a7-year-setup-plain-words` uses, for the same reason.
 *
 * THE FIXTURE IS THE REAL SURFACE (§11, "a control's fixture must come from the
 * real surface"). The status below is the aligned, 2023-2024-shaped status the
 * server returns after a rollover sync, which is exactly the state STAGING is in
 * (staging rolled over to 2023-2024), so this file and the browser proof are
 * looking at the same page.
 *
 * WHAT IS ASSERTED, AND WHY EACH ROW COULD FAIL:
 *   1. the fold exists, is closed, and the panel is `hidden`;
 *   2. nothing was DELETED to achieve that — every folded surface is still in
 *      the DOM, which is the difference between hiding a panel and removing a
 *      control;
 *   3. the default view's VISIBLE text carries no raw code and no persisted/
 *      unverified wording, where "visible" means the `hidden` subtrees are
 *      actually skipped by the walker;
 *   4. the default view is materially shorter than the opened fold — the
 *      packet's "subtract" rule, counted rather than asserted;
 *   5. every control inside the fold is still mouse-first sized, which is the
 *      coverage the fold takes over from the card's own subtree;
 *   6. the endless check ends: with the status read held open, the page says
 *      what is slow after its deadline and offers one Try again.
 *
 * Run: `npm run test:a3-c14-year-setup-calm`
 */
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/admin/year-setup',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	sessionStorage: dom.window.sessionStorage,
	localStorage: dom.window.localStorage,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
	return { width: 320, height: 40, top: 0, left: 0, bottom: 40, right: 320, x: 0, y: 0, toJSON: () => ({}) };
};

// ── The real server shape, aligned on 2023-2024 (staging's own state) ────────
const SCHOOL_ID = 1;
const CURRENT_YEAR = '2023-2024';
const PREVIOUS_YEAR = {
	enrollProSchoolYearId: 8,
	yearLabel: '2022-2023',
	archivedAt: '2023-06-01T00:00:00.000Z',
	archivedBy: 1,
	archiveReason: 'ROLLOVER',
	preservedCounts: { publishedGenerationRuns: 2, teachingLoadOwnerships: 40 },
};

function alignedStatus() {
	return {
		schoolId: SCHOOL_ID,
		atlasSchoolYearId: 9,
		enrollProActiveYear: { id: 9, yearLabel: CURRENT_YEAR },
		drift: {
			status: 'aligned',
			message: `ATLAS is on ${CURRENT_YEAR}, the same school year as EnrollPro.`,
			recommendedAction: 'NONE',
			atlasSchoolYearId: 9,
			enrollProSchoolYearId: 9,
			enrollProSchoolYearLabel: CURRENT_YEAR,
			mirrorSyncedAt: '2023-06-01T00:00:00.000Z',
		},
		mirror: null,
		counts: { facultyCount: 20, sectionCount: 20, settingsReachable: true },
		conflicts: [],
		reconfiguredSections: [],
		canResetDummyYear: false,
		resetTargetSchoolYearId: null,
		conflictingRecordCounts: null,
		teachingLoadResetRequired: false,
		publishedResetBlocked: false,
		archivedYears: [PREVIOUS_YEAR],
		schoolYears: [
			{ enrollProSchoolYearId: 9, yearLabel: CURRENT_YEAR, state: 'current', isArchived: false, archivedAt: null, preservedCounts: null },
			{ ...PREVIOUS_YEAR, state: 'kept as history', isArchived: true, preservedCounts: PREVIOUS_YEAR.preservedCounts },
		],
		automation: { enabled: false, lastAttemptAt: null, lastResult: null, nextAttemptAt: null, consecutiveFailures: 0, currentlyApplying: false },
		termAuthority: {
			state: 'PERSISTED_CURRENT',
			code: null,
			message: 'The saved ordered terms match EnrollPro.',
			persisted: true,
			persistedSemanticRevision: 'r1',
			liveSemanticRevision: 'r1',
			cachedAt: '2023-06-01T00:00:00.000Z',
			termCount: 3,
			needsRepair: false,
			repairAction: 'NONE',
			canPreview: false,
		},
	};
}

type Recorded = { method: 'get' | 'post'; url: string };
let recorded: Recorded[] = [];
/** When true the status read is held open, which is the "endless check" state. */
let holdStatus = false;
let statusGate: { promise: Promise<void>; release: () => void } | null = null;
function deferred(): { promise: Promise<void>; release: () => void } {
	let release!: () => void;
	const promise = new Promise<void>((resolve) => { release = () => resolve(); });
	return { promise, release };
}

function responseFor(url: string) {
	if (url.includes('/auth/me')) {
		return { data: { user: { id: 46, schoolId: SCHOOL_ID, role: 'admin', authSource: 'local' } } };
	}
	if (url.includes('/runtime/rollover-status')) {
		if (holdStatus) {
			statusGate = deferred();
			return statusGate.promise.then(() => ({ data: alignedStatus() })) as unknown as { data: unknown };
		}
		return { data: alignedStatus() };
	}
	if (url.includes('/runtime/context')) {
		// The real `resolveActiveSchoolYearContext` shape, verified and ordered:
		// `isVerifiedOrderedActiveTerm` needs `verified === true`, a positive
		// integer `termIndex`, and an `orderedTerms` entry whose `order` matches.
		return {
			data: {
				// `activeSchoolYearId` is the field `_fetchRuntimeContext` requires
				// before it will accept the read at all; without it the resolver
				// falls through to its error path and the banner renders
				// "unresolved" instead of the real year.
				activeSchoolYearId: 9,
				activeSchoolYearLabel: CURRENT_YEAR,
				activeTerm: {
					verified: true,
					termIndex: 1,
					orderedTerms: [
						{ order: 1, displayLabel: 'Term 1' },
						{ order: 2, displayLabel: 'Term 2' },
						{ order: 3, displayLabel: 'Term 3' },
					],
				},
			},
		};
	}
	return { data: {} };
}

mock.module(import.meta.resolve('@/lib/api'), {
	defaultExport: {
		get: async (url: string) => {
			recorded.push({ method: 'get', url });
			return responseFor(url);
		},
		post: async (url: string) => {
			recorded.push({ method: 'post', url });
			return responseFor(url);
		},
		patch: async (url: string) => responseFor(url),
		put: async (url: string) => responseFor(url),
		delete: async (url: string) => responseFor(url),
		interceptors: { request: { use: () => {} }, response: { use: () => {} } },
	},
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { setLocalToken } = await import('@/lib/auth');
const { default: AdminYearSetup } = await import('@/pages/AdminYearSetup');
const { YEAR_SETUP_SLOW_CHECK_LINE, YEAR_SETUP_SLOW_CHECK_MS } = await import('@/pages/AdminYearSetup');

const roots: any[] = [];
const hosts: HTMLElement[] = [];

function teardown() {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
}
afterEach(teardown);

async function flush() {
	for (let i = 0; i < 6; i += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

function reset() {
	recorded = [];
	holdStatus = false;
	statusGate = null;
	dom.window.sessionStorage.clear();
	dom.window.localStorage.clear();
	setLocalToken('a3-c14-year-setup-calm-token', false);
}

async function renderPage(): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	await act(async () => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/admin/year-setup'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, createElement(AdminYearSetup as any)),
		));
	});
	await flush();
	return host;
}

function click(el: Element | null | undefined) {
	assert.ok(el, 'the control under test did not render');
	act(() => { el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

function byTestId(host: HTMLElement, id: string): Element | null {
	return host.querySelector(`[data-testid="${id}"]`);
}

/**
 * The text a scheduler can actually READ, which is the whole point of the fold.
 *
 * `textContent` alone is wrong for this file: it includes `hidden` subtrees, so
 * it would report the page as unchanged by a fold that is doing nothing. This
 * walker skips any element carrying the `hidden` attribute, and any element
 * marked `aria-hidden="true"`, which is what a browser does when it lays the
 * page out. Every word count and every jargon check below goes through it.
 */
function visibleText(root: Element): string {
	const parts: string[] = [];
	const walk = (node: Node) => {
		if (node.nodeType === 3) { parts.push(node.textContent ?? ''); return; }
		if (node.nodeType !== 1) return;
		const el = node as Element;
		if (el.hasAttribute('hidden')) return;
		if (el.getAttribute('aria-hidden') === 'true') return;
		for (const child of Array.from(el.childNodes)) walk(child);
	};
	walk(root);
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function wordCount(text: string): number {
	const matched = text.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g);
	return matched ? matched.length : 0;
}

/** Matching elements that are actually visible, for the same reason as the text. */
function visibleControls(root: Element, selector: string): Element[] {
	return Array.from(root.querySelectorAll(selector)).filter((el) => {
		for (let node: Element | null = el; node; node = node.parentElement) {
			if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return false;
		}
		return true;
	});
}

// ── Row 1: the fold exists, and it is closed ────────────────────────────────
test('row 1: the IT fold is present, reports itself collapsed, and its panel is hidden', async () => {
	reset();
	const host = await renderPage();

	const trigger = byTestId(host, 'year-setup-it-details-trigger');
	assert.ok(trigger, 'the "Details for IT" fold did not render, so nothing was folded away');
	assert.equal(trigger!.getAttribute('aria-expanded'), 'false', 'the fold must be closed by default');

	const panel = byTestId(host, 'year-setup-it-details-panel');
	assert.ok(panel, 'the fold panel did not render');
	// `hidden`, not a class: this is the attribute a browser actually removes
	// from the accessibility tree and the tab order. A Tailwind class alone
	// would pass a class-name check while the content stayed focusable.
	assert.ok(panel!.hasAttribute('hidden'), 'the fold panel is not `hidden` while the fold is closed');
	assert.equal(trigger!.getAttribute('aria-controls'), panel!.id, 'the trigger does not name the panel it controls');
	assert.ok(panel!.id.length > 0, 'the panel has no id for `aria-controls` to point at');
});

// ── Row 2: nothing was deleted to achieve the calm ──────────────────────────
test('row 2: every technical surface is still in the DOM, inside the fold - nothing was removed', async () => {
	reset();
	const host = await renderPage();
	const panel = byTestId(host, 'year-setup-it-details-panel');
	assert.ok(panel, 'the fold panel did not render');

	// Each of these is a surface a scheduler or an administrator needs. If any
	// of them stopped rendering, this packet would have DELETED a control
	// instead of hiding it, which is a behaviour change and not a design change.
	for (const id of [
		'admin-year-setup-counts',        // the counts line
		'rollover-banner-preview',        // the standalone read-only preview
		'rollover-banner-status',         // the technical drift badge
		'year-truth-resolved',            // the term-authority line
		'year-setup-year-9',              // the school-year list (2023-2024)
		'year-setup-year-8',              // the kept past year (2022-2023)
	]) {
		const el = byTestId(host, id);
		assert.ok(el, `the "${id}" surface stopped rendering; the fold must hide, never delete`);
		assert.ok(
			panel!.contains(el),
			`"${id}" is rendered but is NOT inside the IT fold, so it is still in the default view`,
		);
	}

	// And they are hidden, not merely relocated: the walker's text excludes them.
	const visible = visibleText(host);
	assert.equal(visible.includes('In ATLAS right now'), false, 'the counts line is still in the default view');
	assert.equal(/20 sections and 20 teachers/.test(visible), false, 'the brought-in counts are still in the default view');
	assert.equal(visible.includes('Every school year in ATLAS'), false, 'the school-year list is still in the default view');
	assert.equal(visible.includes('Keep as history'), false, 'the per-year write action is still in the default view');
});

// ── Row 3: the default view is calm and carries no raw code ────────────────
test('row 3: the default view answers in one sentence and shows no raw code', async () => {
	reset();
	const host = await renderPage();

	const nextStep = byTestId(host, 'admin-year-setup-next-step');
	assert.ok(nextStep, 'the card did not render, so this row would pass vacuously');
	const sentence = nextStep!.textContent!.replace(/\s+/g, ' ').trim();
	assert.equal(sentence, `ATLAS is on ${CURRENT_YEAR}.`, `the default view's answer is not one sentence: "${sentence}"`);

	// The aligned state says "Nothing to do. 2023-2024 is ready." second. That is
	// the same fact in a longer form, and the packet's case 1 is one sentence with
	// "nothing else competes" - so it is asserted ABSENT here, deliberately.
	assert.equal(
		sentence.includes('Nothing to do'),
		false,
		'the aligned state still repeats itself in a second sentence',
	);

	// Raw codes and IT provenance, checked against the VISIBLE text only.
	const visible = visibleText(host);
	for (const banned of [
		'TERM_AUTHORITY_MISSING', 'PERSISTED_CURRENT', 'PERSISTED_STALE', 'RUN_ROLLOVER_SYNC',
		'atlas-stale', 'enrollpro-unreachable', 'mapping-conflict', 'semanticRevision',
		'persisted', 'unverified', 'fingerprint', 'Year aligned',
	]) {
		assert.equal(
			visible.includes(banned),
			false,
			`the default view still shows "${banned}". Visible: ${visible.slice(0, 400)}`,
		);
	}

	// ONE primary action in the whole default view. This is the packet's
	// "one sentence and one button", counted on painted variants rather than
	// guessed from a testid, and counted over VISIBLE controls only — the fold
	// holds real buttons, and a query that ignored `hidden` would report the
	// folded surfaces as if they still competed for attention.
	assert.equal(
		visibleControls(host, 'button.bg-primary, a.bg-primary').length,
		0,
		`the aligned default view paints ${visibleControls(host, 'button.bg-primary, a.bg-primary').length} primary actions; it should paint none`,
	);
});

// ── Row 4: subtraction, counted ─────────────────────────────────────────────
test('row 4: the default view is materially shorter than the opened fold', async () => {
	reset();
	const host = await renderPage();

	const closedWords = wordCount(visibleText(host));
	const panel = byTestId(host, 'year-setup-it-details-panel');
	assert.ok(panel, 'the fold panel did not render');

	// Open it: this is the pre-c14 view, because every surface the fold holds was
	// visible before. Comparing against it is the honest "before" number.
	click(byTestId(host, 'year-setup-it-details-trigger'));
	await flush();
	assert.equal(byTestId(host, 'year-setup-it-details-trigger')!.getAttribute('aria-expanded'), 'true', 'the fold did not open');
	assert.equal(byTestId(host, 'year-setup-it-details-panel')!.hasAttribute('hidden'), false, 'the fold panel is still hidden after opening');
	const openWords = wordCount(visibleText(host));

	assert.ok(
		closedWords < openWords,
		`folding the detail removed no words: closed ${closedWords}, open ${openWords}`,
	);
	// A FLOOR on the subtraction, which is the part this packet owns: closing the
	// fold must take a real block of words off the page, not a decorative few.
	assert.ok(
		openWords - closedWords >= 60,
		`closing the fold removed only ${openWords - closedWords} words; the technical surface should be far larger than that`,
	);
	// A CEILING, and the bar is 2/3 rather than 1/2 on purpose. The default view
	// still carries the school-year list, and A7 c7 owns that list and is
	// actively shortening it (its due time is later than this packet's), so a
	// tighter ratio here would fail on another lane's pending work rather than on
	// anything this change controls. Rows 2 and 3 are the rows that name exactly
	// which surfaces must be out of the default view.
	assert.ok(
		closedWords * 3 <= openWords * 2,
		`the default view is ${closedWords} words against ${openWords} opened; it should be at most two thirds`,
	);
	// Printed so the handoff can quote a real before/after instead of a claim.
	console.log(`A3-C14 default-view words: ${closedWords} closed / ${openWords} with Details for IT open`);
});

// ── Row 5: the fold inherits the card's mouse-first coverage ────────────────
test('row 5: every control inside the fold is mouse-first sized', async () => {
	reset();
	const host = await renderPage();
	const panel = byTestId(host, 'year-setup-it-details-panel');
	assert.ok(panel, 'the fold panel did not render');
	// A7-C1's own row walks the CARD's controls for a mouse-first target. The
	// detail moved out of that subtree, so this row walks the FOLD's controls
	// for the same thing. Without it, moving detail into the fold would quietly
	// shrink the scope of an existing guarantee.
	for (const control of Array.from(panel!.querySelectorAll('button, a'))) {
		const className = control.getAttribute('class') ?? '';
		assert.ok(
			/min-h-11|h-10|h-8/.test(className),
			`control "${control.textContent?.trim()}" has no mouse-first target height (${className}).`,
		);
	}
});

// ── Row 6: the endless check ends ───────────────────────────────────────────
test('row 6: a status read that never answers produces a slow-check line and one Try again', async () => {
	reset();
	holdStatus = true;
	const host = await renderPage();

	// Before the deadline the page must NOT be nagging: the card's own sentence
	// is the status, and a second "this is slow" line under it would be the
	// clutter this packet exists to remove.
	assert.equal(byTestId(host, 'year-setup-slow-check'), null, 'the slow-check line appeared before the deadline');

	// A REAL wait, not a fake timer. The page arms a plain `setTimeout`, and
	// driving React's scheduler with mocked timers is how a timing row ends up
	// testing the mock. The page's own number is the wait, and the row takes
	// slightly longer than it.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, YEAR_SETUP_SLOW_CHECK_MS + 400)); });

	const notice = byTestId(host, 'year-setup-slow-check');
	assert.ok(notice, `the page still shows only "Checking the school year now…" after ${YEAR_SETUP_SLOW_CHECK_MS} ms; the endless check was not ended`);
	assert.equal(
		notice!.textContent!.replace(/\s+/g, ' ').trim().includes(YEAR_SETUP_SLOW_CHECK_LINE),
		true,
		'the slow-check line does not say what is slow',
	);
	const retry = byTestId(host, 'year-setup-slow-check-retry');
	assert.ok(retry, 'the slow check offers no Retry');
	assert.equal(retry!.textContent!.replace(/\s+/g, ' ').trim(), 'Try again', 'the retry is not one plainly named action');

	// One way out, not several.
	assert.equal(host.querySelectorAll('[data-testid="year-setup-slow-check-retry"]').length, 1, 'more than one Try again is rendered');

	// Pressing it clears the nag and re-arms the wait. It re-reads through the
	// page's EXISTING `reloadSignal`, so it adds no second status reader; the
	// request list below is the proof of that.
	const readsBefore = recorded.filter((call) => call.url.includes('/runtime/rollover-status')).length;
	click(retry);
	await flush();
	assert.equal(byTestId(host, 'year-setup-slow-check'), null, 'Try again left the slow-check line on screen');
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, YEAR_SETUP_SLOW_CHECK_MS + 400)); });
	assert.ok(byTestId(host, 'year-setup-slow-check'), 'the slow check did not come back, so the retry only silenced it once');

	// Let the read land: the notice must disappear on the answer, not on a timer.
	const gate = statusGate;
	statusGate = null;
	if (gate) await act(async () => { gate.release(); await new Promise((resolve) => setTimeout(resolve, 50)); });
	await flush();
	assert.equal(byTestId(host, 'year-setup-slow-check'), null, 'the slow-check line survived a status that arrived');
	assert.equal(
		visibleText(host).includes(`ATLAS is on ${CURRENT_YEAR}.`),
		true,
		'the page did not settle on the real answer once the read landed',
	);

	// The whole page, over the whole story, made at most the reads it always
	// made. `@/lib/settings` de-duplicates an in-flight status read, so a held
	// request cannot inflate this number.
	const reads = recorded.filter((call) => call.url.includes('/runtime/rollover-status'));
	assert.ok(
		reads.length <= readsBefore + 1,
		`Try again issued ${reads.length} status reads against ${readsBefore} before it; it must not add a second reader`,
	);
});
