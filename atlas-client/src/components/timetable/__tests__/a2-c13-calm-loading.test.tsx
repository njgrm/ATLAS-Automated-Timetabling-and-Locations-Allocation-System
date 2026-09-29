/**
 * A2 C13 (item 1) — rendered evidence for the CALM loading surface.
 *
 * ── EVIDENCE CLASS ────────────────────────────────────────────────────────────
 * Every row here RENDERS the real `TimetableSkeleton` into a real JSDOM document
 * and reads the resulting DOM. Nothing asserts that a string appears in a source
 * file: per AGENTS.md, "a test that only asserts source text is not acceptance
 * evidence for a user-facing change", and the source of this work is a sentence
 * a scheduler reads.
 *
 * ── THE DEFECT BEING CLOSED ───────────────────────────────────────────────────
 * Lane C's staging walk graded the old band MAJOR: *"Loading timetable: navigation
 * is ready now; the grid fills as soon as the latest run resolves."* Both clauses
 * name the MECHANISM, tell the operator nothing about what to do, and read as an
 * engineering note rather than a page. The fix SUBTRACTS them and, after a stated
 * time limit, offers the two real ways out — and offers the second one ONLY when a
 * published run is already derivable from state the app holds.
 *
 * ── THE TIMER ────────────────────────────────────────────────────────────────
 * The 8-second wait is driven by a hand-rolled clock installed on
 * `window.setTimeout`, not by `mock.timers`. Two reasons: the component calls
 * `window.setTimeout` (JSDOM's own, which `mock.timers` does not reach), and a
 * hand-rolled clock advances by EXACT amounts, so "before 8 s" and "at 8 s" are
 * two distinct, reproducible instants rather than a race.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
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
	PointerEvent: dom.window.MouseEvent,
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const {
	TimetableSkeleton,
	LOADING_RETRY_AFTER_MS,
	LOADING_SENTENCE,
	LOADING_RETRY_LABEL,
	LAST_PUBLISHED_SCHEDULE_LABEL,
	PUBLIC_SCHEDULES_HREF,
} = await import('@/components/timetable/TimetableSkeleton');

/* ── the clock ──────────────────────────────────────────────────────────────── */

type Timer = { at: number; fn: () => void };

class FakeClock {
	private now = 0;
	private seq = 0;
	private timers = new Map<number, Timer>();
	private realSetTimeout: typeof dom.window.setTimeout;
	private realClearTimeout: typeof dom.window.clearTimeout;

	constructor() {
		this.realSetTimeout = dom.window.setTimeout;
		this.realClearTimeout = dom.window.clearTimeout;
	}

	install() {
		dom.window.setTimeout = ((fn: () => void, ms: number) => {
			const id = ++this.seq;
			this.timers.set(id, { at: this.now + (Number(ms) || 0), fn });
			return id as unknown as ReturnType<typeof setTimeout>;
		}) as unknown as typeof dom.window.setTimeout;
		dom.window.clearTimeout = ((id: unknown) => {
			this.timers.delete(id as number);
		}) as unknown as typeof dom.window.clearTimeout;
	}

	restore() {
		dom.window.setTimeout = this.realSetTimeout;
		dom.window.clearTimeout = this.realClearTimeout;
	}

	/** Fire every timer due at or before `now + ms`, in due order. */
	advance(ms: number) {
		const target = this.now + ms;
		for (;;) {
			const due = [...this.timers.entries()]
				.filter(([, timer]) => timer.at <= target)
				.sort((left, right) => left[1].at - right[1].at)[0];
			if (!due) break;
			this.timers.delete(due[0]);
			this.now = due[1].at;
			due[1].fn();
		}
		this.now = target;
	}
}

const clock = new FakeClock();
const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLElement }> = [];

after(() => {
	for (const { root, host } of mounted) {
		act(() => root.unmount());
		host.remove();
	}
	clock.restore();
});

function renderSkeleton(props: { onRetry?: () => void; hasPublishedRun?: boolean }) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	act(() => {
		root.render(createElement(MemoryRouter, null, createElement(TimetableSkeleton, props)));
	});
	mounted.push({ root, host });
	return host;
}

const byTestId = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const count = (host: HTMLElement, id: string) => host.querySelectorAll(`[data-testid="${id}"]`).length;

function click(el: Element) {
	act(() => {
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
}

/* ── the rows ───────────────────────────────────────────────────────────────── */

/**
 * L1 — the band says what is happening, and nothing else.
 *
 * The discriminating half is the NEGATIVE: at base this row fails because the
 * band still contains "navigation is ready now" and "the grid fills as soon as
 * the latest run resolves", both of which name the mechanism.
 */
test('L1 the loading band reads exactly "Your schedule is still loading." and names no mechanism', () => {
	clock.install();
	const host = renderSkeleton({});
	const sentence = byTestId(host, 'timetable-loading-sentence');
	assert.ok(sentence, 'the band carries a sentence');
	assert.equal(sentence.textContent, 'Your schedule is still loading.');
	assert.equal(sentence.textContent, LOADING_SENTENCE, 'the exported constant and the rendered text are one string');

	const band = sentence.parentElement;
	assert.ok(band, 'the sentence sits in the loading band');
	const bandText = band.textContent ?? '';
	assert.doesNotMatch(bandText, /latest run resolves/, 'the passive mechanism clause is REMOVED, not reworded');
	assert.doesNotMatch(bandText, /navigation is ready now/, 'the "navigation is ready" clause is REMOVED, not reworded');
	assert.doesNotMatch(bandText, /Loading timetable:/, 'the old bold prefix is removed with the sentence');
	clock.restore();
});

/**
 * L2 — before the limit the band offers nothing; at the limit it offers ONE Retry;
 * clicking it re-runs the real load and resets the timer.
 *
 * The discriminating half is the TIMER RESET: at base the band has no Retry at all,
 * so `count(host, 'timetable-loading-retry')` is 0 at 8 s and this row fails on
 * the first assert, not on the reset.
 */
test('L2 no Retry before the limit; exactly one at it; clicking re-runs the load and resets the timer', () => {
	clock.install();
	let retries = 0;
	const host = renderSkeleton({ onRetry: () => { retries += 1; } });

	assert.equal(count(host, 'timetable-loading-retry'), 0, 'before the limit the band offers no control at all');

	act(() => clock.advance(LOADING_RETRY_AFTER_MS - 1));
	assert.equal(count(host, 'timetable-loading-retry'), 0, 'still nothing one millisecond before the limit');

	act(() => clock.advance(1));
	assert.equal(count(host, 'timetable-loading-retry'), 1, 'exactly ONE Retry at the limit');
	assert.equal(
		byTestId(host, 'timetable-loading-retry')?.textContent,
		LOADING_RETRY_LABEL,
		'the primary control is one verb',
	);

	click(byTestId(host, 'timetable-loading-retry')!);
	assert.equal(retries, 1, 'Retry re-runs the REAL data load, not a location reload');
	assert.equal(count(host, 'timetable-loading-retry'), 0, 'the timer resets, so the control is not a dead one');

	act(() => clock.advance(LOADING_RETRY_AFTER_MS));
	assert.equal(count(host, 'timetable-loading-retry'), 1, 'a second failed retry offers itself again after another 8 s');
	clock.restore();
});

/**
 * L3 — the secondary way out exists ONLY when a published run is already derivable.
 *
 * The discriminating half is the ZERO case: at base the band renders neither
 * control in either case, so the "published" branch fails on the count of 1 and
 * the "no published run" branch passes vacuously — which is exactly why both
 * branches are asserted in the same row.
 */
test('L3 "Show the last published schedule" appears only with a published run, and links to /public/schedules', () => {
	clock.install();
	const withPublished = renderSkeleton({ hasPublishedRun: true });
	act(() => clock.advance(LOADING_RETRY_AFTER_MS));
	assert.equal(count(withPublished, 'timetable-loading-last-published'), 1, 'a published run offers the way out');
	const link = byTestId(withPublished, 'timetable-loading-last-published');
	assert.ok(link, 'the secondary control renders');
	assert.equal(link.textContent, LAST_PUBLISHED_SCHEDULE_LABEL);
	assert.equal(link.getAttribute('href'), PUBLIC_SCHEDULES_HREF, 'it links to the route that already exists');
	assert.equal(PUBLIC_SCHEDULES_HREF, '/public/schedules');
	// It is a SECONDARY control: the primary Retry is the solid one.
	assert.doesNotMatch(link.className, /\bbg-primary\b/, 'the secondary way out is not styled as the primary');

	const withoutPublished = renderSkeleton({ hasPublishedRun: false });
	act(() => clock.advance(LOADING_RETRY_AFTER_MS));
	assert.equal(count(withoutPublished, 'timetable-loading-last-published'), 0, 'NO published run means the control does not render AT ALL');
	assert.equal(count(withoutPublished, 'timetable-loading-retry'), 1, 'and the primary Retry is still offered');
	clock.restore();
});
