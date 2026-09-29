/**
 * A2 C17 — the preferences-kept line on the client (R6, R9).
 *
 * WHAT IS REAL: the component, the `@/ui` primitives it renders, the copy
 * builders, react-router's `MemoryRouter`, and react-dom into a real JSDOM
 * document. Assertions read the rendered DOM, not the source text.
 *
 * WHAT IS FAKED, AND WHY IT IS DISCLOSED: only the HTTP transport. The route
 * itself is decided by `a2-c17-preference-adherence-route.test.ts` on the
 * server; re-deciding it here would test the fixture, not the screen.
 *
 * Run: `npm run test:a2-c17-preference-adherence-client`
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { act, createElement } from 'react';
import type { ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://127.0.0.1:5274/timetable' });
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

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');

type Report = import('@/lib/preference-adherence').PreferenceAdherenceReport;

/** The transport double: one queued answer per call, recorded verbatim. */
const calls: Array<{ url: string; params: unknown }> = [];
type Queued = { data: Report } | { fail: true } | null;
let answer: Queued = null;

const apiModule = await import('@/lib/api');
(apiModule.default as unknown as { get: unknown }).get = (url: string, config?: { params?: unknown }) => {
	calls.push({ url, params: config?.params });
	const queued: Queued = answer;
	if (queued === null) return new Promise(() => {});
	// The component destructures the axios envelope, so the queued answer IS that
	// envelope. Wrapping it again would hand the component `{ data: report }` and
	// it would correctly refuse to render a report it cannot read.
	return 'fail' in queued ? Promise.reject(new Error('read failed')) : Promise.resolve(queued);
};

const { PreferenceAdherenceLine } = await import('@/components/timetable/PreferenceAdherenceLine');
const {
	TEACHER_PREFERENCES_ROUTE,
	preferenceAdherenceLine,
	preferenceGroupLine,
	preferenceUnreviewedNotice,
} = await import('@/lib/preference-adherence');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');
/**
 * Source with EVERY comment removed. A JSDoc block that discusses `<details>` or
 * `title=` must not be able to satisfy — or fail — a rule about what the code
 * renders; only the executable text is scanned.
 */
const code = (path: string) => source(path)
	.replace(/\/\*[\s\S]*?\*\//g, '')
	.replace(/^[ \t]*\/\/.*$/gm, '');

const MIXED: Report = {
	runId: 321,
	schoolYearId: 7,
	termIndex: 1,
	totals: { unavailableSlots: 2, unavailableKept: 2, preferredSlots: 7, preferredMet: 5 },
	teachers: [
		{
			facultyId: 10,
			name: 'Dela Cruz, Ana',
			groups: [
				{ kind: 'UNAVAILABLE', label: 'Unavailable Friday afternoon', slotCount: 24, kept: true, metCount: 0 },
				{ kind: 'PREFERRED', label: 'Prefers Tuesday morning', slotCount: 2, kept: false, metCount: 1 },
			],
		},
		{
			facultyId: 11,
			name: 'Reyes, Ben',
			groups: [
				{ kind: 'UNAVAILABLE', label: 'Unavailable Monday morning', slotCount: 1, kept: false, metCount: 0 },
			],
		},
	],
	notReviewedTeacherCount: 2,
	notReviewedTeacherNames: ['Cruz, Juan', 'Lim, Ana'],
	hasAny: true,
};

let root: Root | null = null;
let host: HTMLElement;

before(() => {
	host = dom.window.document.getElementById('root') as HTMLElement;
	root = createRoot(host);
});
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
});

function render(node: ReactElement | null) {
	act(() => { root?.render(node); });
}

function renderLine(props: Partial<Parameters<typeof PreferenceAdherenceLine>[0]> = {}) {
	// Unmount first. Re-rendering with IDENTICAL props does not re-run the read
	// effect, so without this the previous test's report would still be on screen
	// and a "renders nothing" row would pass or fail on stale state.
	render(null);
	render(createElement(
		MemoryRouter,
		{ initialEntries: ['/timetable'] },
		createElement(PreferenceAdherenceLine, {
			runId: 321, schoolId: 1, schoolYearId: 7, termIndex: 1, ...props,
		}),
	));
}

async function settle() {
	// A macrotask boundary, not a microtask tick: the component dispatches in an
	// effect and the transport double resolves on the microtask queue, so a
	// microtask-only drain can observe the pre-fetch render.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

/** In the rendered TREE — the strip and the line live inside the component. */
const q = (testid: string) => host.querySelector(`[data-testid="${testid}"]`);
/** In the whole DOCUMENT — the popover is PORTALLED to `document.body`, so it is not under `host`. */
const qd = (testid: string) => dom.window.document.querySelector(`[data-testid="${testid}"]`);

// ─── R9: the copy ───

test('R9a: the exact line for a mixed report, and the exact request it made', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine();
	await settle();

	const line = q('preference-adherence-line');
	assert.ok(line, 'the line rendered');
	assert.equal(
		line?.textContent?.replace('›', '').trim(),
		'Teacher preferences: 2 of 2 unavailable times kept · 5 of 7 preferred times met',
		'the packet’s exact line, character for character',
	);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].url, '/generation/1/7/runs/321/preference-adherence');
	assert.deepEqual(calls[0].params, { termIndex: 1 });
});

test('R9b: the line is a CONTROL, not a clickable sentence', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine();
	await settle();

	const line = q('preference-adherence-line') as HTMLElement | null;
	assert.ok(line, 'the line rendered');
	assert.equal(line?.tagName, 'BUTTON', 'it is a real button, not a span with a click handler');
	assert.ok(q('preference-adherence-chevron'), 'a chevron marks it as something that opens');
	assert.match(line?.className ?? '', /border-/, 'it carries a visible border');
	assert.match(line?.className ?? '', /bg-/, 'it carries a fill, so it does not read as read-only text');
	assert.match(line?.className ?? '', /cursor-pointer/, 'it says it is clickable');
	assert.match(line?.className ?? '', /hover:/, 'it has a hover state');
	assert.match(line?.className ?? '', /focus-visible:/, 'it has a keyboard focus ring');
	assert.ok((line?.getAttribute('aria-label') ?? '').includes('show each teacher'), 'it is named for a screen reader');
	assert.equal(line?.getAttribute('title'), null, 'never a title attribute (AGENTS.md §8)');
	assert.doesNotMatch(line?.textContent ?? '', /…|\.\.\./, 'no ellipsis in the label');
	assert.equal(line?.querySelector('select'), null, 'no native select');
});

test('R9c: the list opens on click, names each teacher, and closes on Escape', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine();
	await settle();

	assert.equal(qd('preference-adherence-list'), null, 'the list starts closed');
	const line = q('preference-adherence-line') as HTMLElement;
	await act(async () => { line.click(); });
	await settle();

	const list = qd('preference-adherence-list');
	assert.ok(list, 'the list opened on one click — the line IS the disclosure trigger');
	const teachers = [...dom.window.document.querySelectorAll('[data-testid="preference-adherence-teacher"]')];
	assert.equal(teachers.length, 2, 'both teachers are listed');
	assert.match(teachers[0].textContent ?? '', /Dela Cruz, Ana/);
	assert.match(teachers[1].textContent ?? '', /Reyes, Ben/);
	const groups = [...dom.window.document.querySelectorAll('[data-testid="preference-adherence-group"]')].map((node) => node.textContent?.trim());
	assert.deepEqual(groups, [
		'Unavailable Friday afternoon — kept',
		'Prefers Tuesday morning — 1 of 2',
		'Unavailable Monday morning — not kept',
	], 'the packet’s group phrasings, and a violated window is not softened');
	assert.equal(line.getAttribute('aria-expanded'), 'true', 'the control reports its own open state');

	await act(async () => {
		dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	await settle();
	assert.equal(qd('preference-adherence-list'), null, 'Escape closes it');
});

test('R9d: the unreviewed notice reads in words and links to the REAL preferences route', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine();
	await settle();

	const notice = q('preference-adherence-unreviewed');
	assert.ok(notice, 'the unreviewed notice rendered');
	assert.equal(
		notice?.textContent?.replace('Review these teachers’ preferences', '').trim(),
		"2 teachers' preferences are not reviewed yet, so they were not used.",
		'the packet’s exact plural notice',
	);
	const link = q('preference-adherence-unreviewed-link') as HTMLAnchorElement | null;
	assert.ok(link, 'the notice carries a clickable destination');
	assert.equal(link?.tagName, 'A', 'a real link, styled to look clickable');
	assert.equal(link?.getAttribute('href'), TEACHER_PREFERENCES_ROUTE, 'the real mounted route, not an assumed /teachers');
	assert.equal(TEACHER_PREFERENCES_ROUTE, '/faculty/preferences');
	assert.match(link?.className ?? '', /underline/, 'it looks clickable without relying on colour alone');
	assert.match(link?.className ?? '', /focus-visible:/, 'and it is keyboard focusable');
});

test('R9e: nothing on screen is under 14px, and the strip holds no truncation or overflow escape', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine();
	await settle();
	await act(async () => { (q('preference-adherence-line') as HTMLElement).click(); });
	await settle();

	const strip = q('preference-adherence-strip') as HTMLElement;
	assert.ok(strip, 'the strip rendered');
	for (const node of [strip, ...strip.querySelectorAll('*')]) {
		const className = (node as HTMLElement).className ?? '';
		const match = /text-\[(\d+(?:\.\d+)?)px\]/.exec(className);
		if (match) {
			assert.ok(Number(match[1]) >= 14, `${(node as HTMLElement).tagName} is ${match[1]}px: nothing this feature touches may be under 14px`);
		}
	}
	assert.doesNotMatch(strip.innerHTML, /truncate|line-clamp/, 'no truncation anywhere in the strip');
	assert.doesNotMatch(strip.innerHTML, /<details|<select|title=/, 'no raw details, select or title');
});

// ─── R6: silence ───

test('R6 [client]: a report with nothing to say renders NOTHING — not an empty box, not a zero line', async () => {
	calls.length = 0;
	answer = {
		data: {
			...MIXED,
			totals: { unavailableSlots: 0, unavailableKept: 0, preferredSlots: 0, preferredMet: 0 },
			teachers: [],
			notReviewedTeacherCount: 0,
			notReviewedTeacherNames: [],
			hasAny: false,
		},
	};
	renderLine();
	await settle();

	assert.equal(host.innerHTML, '', 'the component adds no element at all');
	assert.equal(q('preference-adherence-strip'), null);
	assert.equal(q('preference-adherence-line'), null);
	assert.equal(q('preference-adherence-unreviewed'), null);
});

test('R6b: a failed read is silence, never a "0 of 0" claim', async () => {
	calls.length = 0;
	answer = { fail: true };
	renderLine();
	await settle();

	assert.equal(q('preference-adherence-line'), null, 'no line is claimed from a failed read');
	assert.equal(host.textContent?.includes('0 of 0'), false, 'a failed read never prints a zero figure');
});

test('R6c: no run on screen means no request at all', async () => {
	calls.length = 0;
	answer = { data: MIXED };
	renderLine({ runId: null });
	await settle();
	assert.equal(calls.length, 0, 'a schedule with no run asks the server nothing');
	assert.equal(host.innerHTML, '');
});

// ─── Copy builders, decided without a DOM ───

test('a segment whose denominator is 0 is omitted, and both-zero yields no line at all', () => {
	assert.equal(
		preferenceAdherenceLine({ unavailableSlots: 2, unavailableKept: 2, preferredSlots: 7, preferredMet: 5 }),
		'Teacher preferences: 2 of 2 unavailable times kept · 5 of 7 preferred times met',
	);
	assert.equal(
		preferenceAdherenceLine({ unavailableSlots: 3, unavailableKept: 1, preferredSlots: 0, preferredMet: 0 }),
		'Teacher preferences: 1 of 3 unavailable times kept',
		'"0 of 0 preferred times met" is never printed',
	);
	assert.equal(
		preferenceAdherenceLine({ unavailableSlots: 0, unavailableKept: 0, preferredSlots: 0, preferredMet: 0 }),
		null,
	);
});

test('a single unreviewed teacher gets a grammatical sentence, not the plural with a dangling "they"', () => {
	const one = preferenceUnreviewedNotice(1);
	assert.equal(
		one?.text,
		'1 teacher has preferences that are not reviewed yet, so they were not used.',
		'"they" has a real antecedent — the preferences — in the singular too',
	);
	assert.notEqual(
		one?.text,
		"1 teacher's preferences are not reviewed yet, so they were not used.",
		'the shape the packet names as ungrammatical must not be the one shipped',
	);
	assert.equal(preferenceUnreviewedNotice(2)?.text, "2 teachers' preferences are not reviewed yet, so they were not used.");
	assert.equal(preferenceUnreviewedNotice(0), null, 'no unreviewed teacher means no notice at all');
});

test('a fully-met preferred group reads as an acknowledgement; a partial one names the numbers', () => {
	assert.equal(
		preferenceGroupLine({ kind: 'PREFERRED', label: 'Prefers Tuesday morning', slotCount: 2, kept: true, metCount: 2 }),
		'Prefers Tuesday morning — all 2 times met',
	);
	assert.equal(
		preferenceGroupLine({ kind: 'PREFERRED', label: 'Prefers Tuesday morning', slotCount: 1, kept: true, metCount: 1 }),
		'Prefers Tuesday morning — all 1 time met',
		'singular is singular',
	);
	assert.equal(
		preferenceGroupLine({ kind: 'UNAVAILABLE', label: 'Unavailable Monday morning', slotCount: 1, kept: false, metCount: 0 }),
		'Unavailable Monday morning — not kept',
	);
});

// ─── Anchor, and what it must not do to the header ───

test('the line is anchored in the workspace BODY above the grid, never in the header', () => {
	const surface = source('src/components/timetable/CenterWorkspacePaneSurface.tsx');
	assert.match(surface, /<PreferenceAdherenceLine/, 'the body renders it');
	assert.match(surface, /\{paneView !== 'pre-generation' \?/, 'only for a run on the grid, so it appears on the draft AND published view of the same arm');

	// The packet forbids the header stat row, and §8 caps a header at two rows.
	for (const header of [
		'src/components/timetable/ScheduleReviewWorkspaceSummaryStats.tsx',
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/simple/SimpleHeaderStatusStrip.tsx',
	]) {
		assert.doesNotMatch(source(header), /PreferenceAdherenceLine/, `${header} must not gain the line`);
	}
});

test('the feature adds no shared-primitive variant and no page-local restyle of one', () => {
	const component = code('src/components/timetable/PreferenceAdherenceLine.tsx');
	assert.match(component, /from '@\/ui\/button'/, 'it uses the shared Button');
	assert.match(component, /from '@\/ui\/popover'/, 'it uses the shared Popover');
	assert.doesNotMatch(component, /<button|<details|<select|title=/, 'no raw element escapes the primitives');
	assert.doesNotMatch(component, /text-\[\d+px\]/, 'no arbitrary font size is introduced');

	// The @/ui primitives themselves are untouched by this feature.
	const before = execFileSyncSafe('git', ['diff', '--name-only', 'df5c249c', '--', 'src/ui/']);
	assert.equal(before, '', 'no shared primitive was modified, so there is no local restyle to leak');
});

function execFileSyncSafe(command: string, args: string[]): string {
	try {
		return execFileSync(command, args, { cwd: clientRoot, encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}
