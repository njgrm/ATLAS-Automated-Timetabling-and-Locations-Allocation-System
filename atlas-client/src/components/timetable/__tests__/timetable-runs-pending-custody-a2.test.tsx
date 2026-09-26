/**
 * A2-RUNS-PENDING-CUSTODY (item 6) — the runs centre must never claim "none"
 * while the read is in flight, must say the empty thing exactly once, and must
 * not report a failed read as an empty year.
 *
 * Why a deferred promise and not a `setTimeout`: the recorded defect was a pane
 * with no pending input at all, so an unfetched `runs = []` announced "No
 * generation runs yet for this school year." and rendered "No runs to review",
 * then silently became five real runs. A fake delay would only re-test the fake
 * delay. Each deferred request below is a real promise the test resolves or
 * rejects by hand, and the harness drives the pane with the same contract the
 * data layer uses (`loading` raised before dispatch, lowered when the promise
 * settles; a rejection becomes `error`, never an empty list).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/timetable/runs' });
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
const { MemoryRouter } = await import('react-router-dom');
const { TimetableRunsPane, resolveTimetableRunsViewState } = await import('../TimetableRunsPane');
type PaneRun = import('../TimetableRunsPane').TimetableRunsPaneRun;

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

let root: Root | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

/** A real pending promise. Nothing resolves it until the test says so. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

const COMPLETED_RUN: PaneRun = {
	id: 318,
	status: 'COMPLETED',
	triggeredBy: 46,
	startedAt: '2030-09-01T00:05:00.000Z',
	finishedAt: '2030-09-01T00:06:00.000Z',
	durationMs: 61_000,
	error: null,
	createdAt: '2030-09-01T00:05:00.000Z',
	runType: 'FULL',
	version: 3,
};

/**
 * The production contract, reproduced: `loading` is true while the request is
 * outstanding and the list is whatever the workspace already holds (nothing on
 * a first load); a fulfilment installs the rows; a rejection installs a reason
 * and still no rows. This is `useTimetableData.loadAll`'s shape, not a delay.
 */
function RunsFromRequest({ request }: { request: () => Promise<PaneRun[]> }): ReactElement {
	const [state, setState] = useState<{ pending: boolean; reason: string | null; runs: PaneRun[] }>({
		pending: true,
		reason: null,
		runs: [],
	});
	useEffect(() => {
		let live = true;
		setState({ pending: true, reason: null, runs: [] });
		request().then(
			(runs) => { if (live) setState({ pending: false, reason: null, runs }); },
			(error: unknown) => {
				if (!live) return;
				const detail = error instanceof Error ? error.message : String(error);
				setState({ pending: false, reason: `ATLAS could not load the generation runs: ${detail}`, runs: [] });
			},
		);
		return () => { live = false; };
	}, [request]);
	return createElement(TimetableRunsPane, {
		runs: state.runs,
		runsPending: state.pending,
		runsUnavailableReason: state.reason,
		selectedRunId: 'latest',
		onSelectRun: () => {},
		formatTimestamp: (value: string | null) => value ?? '—',
		formatDuration: (value: number | null) => (value == null ? '—' : `${Math.round(value / 1000)}s`),
	});
}

async function mount(element: ReactElement): Promise<HTMLElement> {
	const container = document.getElementById('root');
	assert.ok(container);
	if (!root) root = createRoot(container);
	await act(async () => { root?.render(element); });
	return container;
}

function text(): string {
	return document.getElementById('root')?.textContent ?? '';
}

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

const EMPTY_CLAIM = 'No generation runs yet for this school year.';
const OLD_DUPLICATE_CLAIM = 'No runs to review';

test('A2-6 item 6: an outstanding run request announces no empty state', async () => {
	const request = deferred<PaneRun[]>();
	await mount(createElement(MemoryRouter, null, createElement(RunsFromRequest, { request: () => request.promise })));

	const rendered = text();
	assert.match(rendered, /Loading generation runs/, 'the pending state must say the read is happening');
	assert.ok(document.querySelector('[data-testid="timetable-runs-pending-state"]'), 'the pending state must render its own testid');
	assert.equal(occurrences(rendered, EMPTY_CLAIM), 0, 'the empty claim must not be announced while the request is in flight');
	assert.equal(occurrences(rendered, OLD_DUPLICATE_CLAIM), 0, 'the old duplicate empty claim must not be announced while the request is in flight');
	assert.equal(occurrences(rendered, 'ATLAS is checking the generation runs'), 1, 'the pending copy is announced once');
});

test('A2-6 item 6: the settled empty response is announced exactly once', async () => {
	const request = deferred<PaneRun[]>();
	await mount(createElement(MemoryRouter, null, createElement(RunsFromRequest, { request: () => request.promise })));
	await act(async () => { request.resolve([]); });

	const rendered = text();
	assert.equal(occurrences(rendered, EMPTY_CLAIM), 1, 'the empty state is announced exactly once');
	assert.equal(occurrences(rendered, OLD_DUPLICATE_CLAIM), 0, 'the second, duplicate empty sentence is gone');
	assert.ok(document.querySelector('[data-testid="timetable-runs-empty-state"]'), 'the empty state keeps its testid');
	assert.equal(document.querySelector('[data-testid="timetable-runs-pending-state"]'), null, 'the pending state is gone once the read settled');
});

test('A2-6 item 6: a rejected run request reports unavailable, never empty', async () => {
	const request = deferred<PaneRun[]>();
	await mount(createElement(MemoryRouter, null, createElement(RunsFromRequest, { request: () => request.promise })));
	await act(async () => { request.reject(new Error('ATLAS_UNREACHABLE')); });

	const rendered = text();
	assert.ok(document.querySelector('[data-testid="timetable-runs-unavailable-state"]'), 'a rejected read renders the unavailable state');
	assert.match(rendered, /Generation runs could not be loaded/, 'the failure is named');
	assert.match(rendered, /ATLAS could not load the generation runs: ATLAS_UNREACHABLE/, 'the real reason is shown, not swallowed');
	assert.match(rendered, /nothing is known about whether there are any/, 'the pane says the answer is unknown rather than empty');
	assert.equal(occurrences(rendered, EMPTY_CLAIM), 0, 'a failed read must never claim the year has no runs');
	assert.equal(occurrences(rendered, OLD_DUPLICATE_CLAIM), 0, 'a failed read must never render the empty state');
});

test('A2-6 item 6: a fulfilled populated response renders the rows and the count', async () => {
	const request = deferred<PaneRun[]>();
	await mount(createElement(MemoryRouter, null, createElement(RunsFromRequest, { request: () => request.promise })));
	await act(async () => { request.resolve([COMPLETED_RUN]); });

	assert.ok(document.querySelector('[data-testid="timetable-runs-row-318"]'), 'the settled row renders');
	assert.match(text(), /1 run · newest first · read-only history/, 'the header states the real count once loaded');
	assert.equal(document.querySelector('[data-testid="timetable-runs-empty-state"]'), null, 'a populated read never renders the empty state');
});

test('A2-6 item 6: the four states are decided by one exported rule', () => {
	// Pending wins over everything: a retry in flight must not re-announce an
	// earlier failure, and rows already on screen are never a pending claim.
	assert.equal(resolveTimetableRunsViewState({ runsPending: true, runsUnavailableReason: 'boom', runCount: 0 }), 'pending');
	assert.equal(resolveTimetableRunsViewState({ runsPending: true, runsUnavailableReason: null, runCount: 3 }), 'pending');
	// Real rows beat a failure reason: data on screen is not a claim of emptiness.
	assert.equal(resolveTimetableRunsViewState({ runsPending: false, runsUnavailableReason: 'boom', runCount: 3 }), 'populated');
	// A settled failure is unavailable, never empty.
	assert.equal(resolveTimetableRunsViewState({ runsPending: false, runsUnavailableReason: 'boom', runCount: 0 }), 'unavailable');
	// Only a settled, successful, empty read may claim emptiness.
	assert.equal(resolveTimetableRunsViewState({ runsPending: false, runsUnavailableReason: null, runCount: 0 }), 'empty');
	assert.equal(resolveTimetableRunsViewState({ runsPending: false, runsUnavailableReason: null, runCount: 1 }), 'populated');
});

test('A2-6 item 6: mutant — the pre-fix runs.length-only pane fails this control', () => {
	// The recorded defect in one assertion: deriving the claim from the row
	// count alone is what announced "none" while the read was outstanding.
	const preFix = (pending: boolean, reason: string | null, runCount: number): string => (
		runCount === 0 ? EMPTY_CLAIM : `${runCount} runs`
	);
	assert.equal(preFix(true, null, 0), EMPTY_CLAIM, 'the pre-fix derivation claims emptiness while pending');
	assert.equal(preFix(false, 'boom', 0), EMPTY_CLAIM, 'the pre-fix derivation claims emptiness after a failure');
	// ...and the shipped rule refuses both.
	assert.notEqual(resolveTimetableRunsViewState({ runsPending: true, runsUnavailableReason: null, runCount: 0 }), 'empty');
	assert.notEqual(resolveTimetableRunsViewState({ runsPending: false, runsUnavailableReason: 'boom', runCount: 0 }), 'empty');
});

// --- the signal is the data layer's own, not a simulated one ---

test('A2-6 item 6: the pending signal is the workspace load state, not a local delay', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /runsPending=\{runsPending\}/, 'the centre threads the pending signal into the pane');
	assert.match(center, /runsUnavailableReason=\{runsUnavailableReason\}/, 'the centre threads the failure reason into the pane');
	assert.match(
		center,
		/runsPending: boolean;[\s\S]*runsUnavailableReason: string \| null;/,
		'the centre declares both signals as required, so a caller cannot forget them',
	);

	const state = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(
		state,
		/runsPending: loading, runsUnavailableReason: error/,
		'the hook binds the pane to the same loading/error state useTimetableData writes',
	);
	assert.match(state, /const \[loading, setLoading\] = useState\(true\)/, 'the load state starts pending, so a first render is never an empty claim');
	assert.match(state, /const \[error, setError\] = useState<string \| null>\(null\)/);

	const data = source('src/hooks/useTimetableData.ts');
	// `loading` is raised before the batch that dispatches the run read...
	assert.match(data, /setLoading\(true\);\s*\n\s*setError\(null\);/, 'a load raises pending and clears the previous failure');
	assert.match(data, /fetchRuns: \(id\) => fetchRuns\(id,/, 'the run read is dispatched inside that load');
	// ...and a rejected run read lands in `error` rather than an empty list.
	assert.match(data, /const msg = buildTimetableErrorMessage\(e, 'Failed to load data\.'\);\s*\n\s*setError\(msg\);/);
	assert.match(data, /\} finally \{\s*\n\s*if \(isCurrentLoad\(\)\) setLoading\(false\);/, 'pending is lowered only when the load settles');
});

test('A2-6 item 6: the pane simulates nothing', () => {
	const pane = source('src/components/timetable/TimetableRunsPane.tsx');
	for (const forbidden of [/setTimeout/, /setInterval/, /requestAnimationFrame/, /performance\.now/, /Math\.random/]) {
		assert.doesNotMatch(pane, forbidden, `the pane must not fake a delay (${forbidden.source})`);
	}
	// Still read-only: the pane dispatches nothing and owns no write path.
	assert.doesNotMatch(pane.replace(/\/\*[\s\S]*?\*\//g, ''), /fetch\(|atlasApi|axios|useQuery|useMutation|XMLHttpRequest/);
});
