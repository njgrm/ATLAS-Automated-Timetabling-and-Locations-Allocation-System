/**
 * A3 SUBJECTS UI — acceptance controls for items 09, 15, 17, 19, 20, 31, 32, 33A, 33B.
 *
 * Harness note (AGENTS.md §11 — "a proof artefact must actually discriminate"):
 * every control here renders the REAL production component through jsdom and
 * asserts the real DOM / the real save payload. Nothing is a hand-written
 * fixture that could already contain the expected answer. Where a control
 * discriminates against the pre-change code, the discriminating assertion is
 * called out in the control's own comment so a reviewer can reproduce the
 * failing-first run on the base SHA.
 *
 * Layout claims: jsdom has no layout engine, so no control claims a measured
 * pixel result. Fix 15's "one row, no page scrollbar" is asserted as the class
 * contract actually rendered PLUS an arithmetic budget over the width classes
 * those elements carry. That is the strongest claim a DOM-only harness can
 * make, and it is labelled as such rather than dressed up as a screenshot.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

// Acceptance check 7 is specified at 1366x768. Size the jsdom viewport to that
// so any class that hard-codes a px assumption is visible in the DOM.
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/subjects' });
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
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	HTMLFormElement: dom.window.HTMLFormElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLOListElement: dom.window.HTMLOListElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { SubjectFormModal } = await import('../SubjectFormModal');
const { SubjectFilterToolbar } = await import('../SubjectFilterToolbar');
const { SubjectTermAuthorityBanner } = await import('../SubjectTermAuthorityBanner');
const { SubjectTermContractPopover } = await import('../SubjectTermContractPopover');
const { SubjectCoverageSheet } = await import('../SubjectCoverageSheet');
const { SubjectRow } = await import('../SubjectRow');
const { AdminSearchFilterToolbar } = await import('../../admin-workspace/AdminWorkspace');
const { subjectToFormValues } = await import('../subject-form-utils');
const { buildTermFilterOptions, matchesTermFilter } = await import('../subject-term-filter');
const constants = await import('../../../lib/subject-constants');

type SubjectSaveOutcome = import('../SubjectFormModal').SubjectSaveOutcome;
type SubjectFormValues = import('../SubjectFormModal').SubjectFormValues;
type TermAuthority = import('../../../types').TermAuthority;
/**
 * A3-C9: what the term-filter controls pass around. `subjectFixture` is cast
 * `as never` so it can satisfy `SubjectRow`'s `Subject` prop, which would make
 * a bare array of them `never[]` and erase every `.id` the controls read.
 */
type TermSubject = { id: number } & import('../subject-term-filter').RotationTermLike;

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/**
 * Source with comments removed.
 *
 * Several controls assert that a symbol is GONE from a production file. Those
 * symbols are still named in the explanatory comments that document WHY they
 * were removed, so a raw substring scan would pass on the un-fixed file and
 * fail on the fixed one — the control would be inverted. Stripping comments
 * first makes "absent from the code" mean what it says.
 */
function code(path: string): string {
	return source(path)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

type ToolbarProps = React.ComponentProps<typeof SubjectFilterToolbar>;

async function render(node: React.ReactNode): Promise<HTMLElement> {
	await unmount();
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	await act(async () => { root?.render(node); });
	return hostEl;
}

async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	hostEl?.remove();
	hostEl = null;
}

/**
 * Search the DOCUMENT, not the container.
 *
 * Radix `Dialog`, `Select`, `Popover` and `DropdownMenu` all render through a
 * portal into `document.body`. Scoping the query to the React container finds
 * nothing for exactly the elements under test, which reports a false "missing"
 * and is how a control ends up asserting nothing. Unmount clears the previous
 * tree, so the document holds exactly the current render.
 */
function query(_host: HTMLElement, testid: string): HTMLElement | null {
	return document.body.querySelector(`[data-testid="${testid}"]`);
}

function byLabel(_host: HTMLElement, label: string): HTMLElement | null {
	return document.body.querySelector(`[aria-label="${label}"]`);
}

/** `query`, but named so a DOM-node comparison reads as one on purpose. */
function byTestId(host: HTMLElement, testid: string): HTMLElement | null {
	return query(host, testid);
}

/** A query scoped to the current render's own container (non-portalled parts). */
function local(host: HTMLElement, selector: string): HTMLElement | null {
	return document.body.querySelector(selector);
}

// Radix opens Select / DropdownMenu / Popover on `pointerdown`, not on `click`.
// A click-only helper silently reports "the menu did not open", which is a
// false negative about the component. Drive the real event sequence instead.
function click(el: Element | null): Promise<void> {
	return act(async () => {
		const target = el as HTMLElement;
		const init = { bubbles: true, cancelable: true, button: 0, ctrlKey: false };
		target.dispatchEvent(new dom.window.MouseEvent('pointerdown', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mousedown', init));
		target.dispatchEvent(new dom.window.MouseEvent('pointerup', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mouseup', init));
		target.dispatchEvent(new dom.window.MouseEvent('click', init));
	});
}

/**
 * A5-C3: close whatever Radix popover is open.
 *
 * `FilterPicker` is a `Popover`, and a Radix popover is modal — while it is open the
 * rest of the page is `pointer-events: none`. That is correct product behaviour, but it
 * means a test that opens one control and then clicks the next has to close the first
 * one, or the second click lands on an inert body and the row fails for a reason that
 * has nothing to do with what it is testing.
 */
function pressEscape(): Promise<void> {
	return act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
}

/**
 * A5 C3 CORRECTION ROUND 1 (B1): `openFilter` replaces a bare `click` plus a hope.
 *
 * QA found `test:a3-subjects` red on 4 of 6 runs and green 6/6 at base, and this helper
 * is the flake it named. A Radix `Popover` is MODAL: while one is open it sets
 * `pointer-events: none` on the rest of the document, so a `click` dispatched at a
 * sibling trigger while the previous picker is still tearing down lands on an inert
 * body. `pressEscape()` on its own was a partial band-aid — it fired the event but
 * never confirmed the popover had actually closed, so whether the next click worked
 * depended on how far the teardown had got. That is a race dressed as a fix, and a
 * suite I modified has to be green DETERMINISTICALLY, not usually.
 *
 * So this is a two-sided, asserted contract, not a retry and not a sleep:
 *   1. CLOSED FIRST — if a popover is open, close it and then ASSERT nothing is open.
 *      A teardown that has not finished fails here, loudly, at the line that caused it,
 *      instead of silently thirty lines later.
 *   2. OPENS ON ONE CLICK — assert the trigger reports `aria-expanded="true"` and that
 *      a listbox exists. "Did not open" is then reported as exactly that, rather than
 *      as a downstream `null`.
 */
async function closeAnyOpenPicker(): Promise<void> {
	if (document.body.querySelector('[role="listbox"]') !== null) {
		await pressEscape();
		assert.equal(
			document.body.querySelector('[role="listbox"]'),
			null,
			'a filter popover was still open after Escape, so the next click would land on an inert body — ' +
				'the harness must not depend on teardown timing',
		);
	}
	/* Flush the effects Radix queued while closing — its `hideOthers` /
	 * `pointer-events` cleanup and the trigger's own `aria-expanded` reset. An empty
	 * `act()` is a microtask/effect barrier, not a sleep: it makes "the previous
	 * picker is fully closed" a fact this harness can rely on instead of a hope.
	 * Without it the NEXT click lands on a trigger Radix still considers inert, which
	 * is the flake QA saw — red on 4 of 6 runs and green 6/6 at base. */
	await act(async () => {});
}

/**
 * Open one filter picker from a CLOSED, FLUSHED state, by re-resolving the trigger
 * from the DOM at that moment.
 *
 * Re-resolving matters as much as the flush. A trigger element captured before a
 * previous popover opened keeps a stale Radix ref: by the time the popover closes,
 * that captured node's handlers are no longer the ones the component has, so a click
 * on it is silently inert. Looking the trigger up again by its accessible name is
 * what makes "one click on this filter opens it" a claim about the live control.
 *
 * Returns the open listbox. Asserts `aria-expanded` so a failure says "did not open"
 * rather than surfacing later as a `null`.
 */
async function openFilter(ariaLabel: string, what: string): Promise<Element> {
	await closeAnyOpenPicker();
	const trigger = document.body.querySelector(`[aria-label="${ariaLabel}"]`);
	assert.ok(trigger, `the ${what} filter is not rendered, so it cannot be opened`);
	await click(trigger);
	assert.equal(
		trigger.getAttribute('aria-expanded'),
		'true',
		`one click on the ${what} filter did not open it: the trigger still reports aria-expanded=false`,
	);
	const listbox = document.body.querySelector('[role="listbox"]');
	assert.ok(listbox, `one click on the ${what} filter opened no listbox`);
	return listbox;
}

/**
 * A5 C7 ITEM 43 (2026-09-29) — THE DISCLOSURE IS GONE, so this is no longer an
 * OPENING step.
 *
 * A5 C4 moved `Status`, `Room` and `Term` behind ONE `More filters` disclosure and
 * re-pointed every row in this file through this helper rather than deleting any of
 * them, so each kept testing its property from the place the filter actually lived.
 *
 * Item 43 supersedes that finding: all five filters are in the row permanently. The
 * helper is KEPT — same name, same position in every caller's sequence — and what it
 * decides changes from "open the toggle" to "assert all five are already on screen".
 * A C4-shaped accommodation left quietly in place would let a reintroduced disclosure
 * pass this whole suite; this is what makes that impossible (`AGENTS.md` §16).
 *
 * IT IS ALSO STRONGER, not merely different. Under A5 C4 a filter counted as
 * "reachable" if it appeared after a click, so a row that only ever proved reach
 * through a disclosure proved less than it looked. Here every filter must be present
 * in the CLOSED render, which is the property a scheduler actually experiences.
 */
async function openMoreFilters(): Promise<void> {
	const inRow = Array.from(
		document.body.querySelectorAll('[data-testid="subjects-filter-cluster"] [role="combobox"]'),
	);
	assert.equal(
		inRow.length,
		5,
		`the closed row carries ${inRow.length} filters; item 43 requires all five in the row, and a filter ` +
			'only reachable by opening something else is a filter a scheduler has to hunt for',
	);
	assert.equal(
		document.body.querySelector('[data-testid="subjects-more-filters"]') === null,
		true,
		'a `More filters` disclosure is back in the row',
	);
}

function setNativeValue(el: HTMLInputElement, value: string): Promise<void> {
	const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
	return act(async () => {
		setter?.call(el, value);
		el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
	});
}

// ---------------------------------------------------------------------------
// A subject fixture shaped like the real scheduling-authority read.
// ---------------------------------------------------------------------------
function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 41,
		code: 'SCI10',
		name: 'Earth Science',
		displayCode: 'SCI10',
		outputLabel: null,
		ownerDepartment: 'SCI',
		allowedOwnerDepartments: [] as string[],
		qualificationPriority: 'DEPARTMENT_FIRST' as const,
		rotationFamily: null,
		minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM' as const,
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [9, 10],
		interSectionEnabled: false,
		interSectionGradeLevels: [] as number[],
		modularGroupId: null,
		modularOrder: null,
		programScopes: ['REGULAR'],
		allowedSpecializations: [] as string[],
		requiredFeatures: [] as string[],
		rotationTermLabel: null,
		rotationTermRank: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		updatedAt: '2026-09-27T00:00:00.000Z',
		...overrides,
	} as never;
}

/**
 * A3-C9: the term option list the toolbar is handed. Shaped exactly as
 * `buildTermFilterOptions` produces it from a catalog that has two ranked terms,
 * one rotating subject and one subject with no rotation term — i.e. the fixture
 * carries the same four kinds the real derivation emits, so a control cannot
 * pass by being handed a convenient constant.
 */
const TERM_OPTIONS: ToolbarProps['termOptions'] = [
	{ value: 'all', label: 'All terms', kind: 'all' },
	{ value: 'rank:1', label: 'Term 1', kind: 'term' },
	{ value: 'rank:2', label: 'Term 2', kind: 'term' },
	{ value: 'rotating', label: 'Rotates by term', kind: 'rotating' },
	{ value: 'unset', label: 'No term set', kind: 'unset' },
];

// The full, fully-typed prop set. Tests that need to observe a handler spread
// this and then override that one handler after it, so the base must satisfy
// `Props` on its own — a partial bag would make every call site a type error.
const EDITABLE: ToolbarProps = {
	searchQuery: '',
	onSearchChange: () => {},
	hasActiveFilters: false,
	// A5 (items 9.1 + 41): the two status-looking controls were merged into
	// one, and the fixture follows the production prop set. The old
	// `statusFilter` + `attentionFilter` pair is the duplicate the operator
	// reported; every control below still runs.
	subjectStatusFilter: 'all',
	onSubjectStatusFilterChange: () => {},
	roomTypeFilter: 'all',
	onRoomTypeFilterChange: () => {},
	gradeLevelFilter: 'all',
	onGradeLevelFilterChange: () => {},
	programScopeFilter: 'all',
	onProgramScopeFilterChange: () => {},
	termFilter: 'all',
	onTermFilterChange: () => {},
	termOptions: TERM_OPTIONS,
	onResetFilters: () => {},
};

const TERM_CONTRACT = {
	format: 'TRIMESTER',
	schoolYear: { yearLabel: '2030-2031' },
	terms: [
		{ identity: 'T1', displayLabel: 'Term 1' },
		{ identity: 'T2', displayLabel: 'Term 2' },
		{ identity: 'T3', displayLabel: 'Term 3' },
	],
	activeTerm: { identity: 'T1' },
};

function termAuthority(state: TermAuthority['state']): TermAuthority {
	return {
		state,
		source: 'enrollpro',
		degraded: false,
		code: state === 'BLOCKED' ? 'ACTIVE_TERM_UNRESOLVED' : 'OK',
		message: state === 'VERIFIED_LIVE'
			? 'The active year and its three ordered terms were read from EnrollPro.'
			: state === 'VERIFIED_CACHED'
				? 'EnrollPro was unreachable; the last saved year and terms are shown.'
				: 'Term scheduling metadata is blocked until EnrollPro reports an ordered term contract.',
		contract: TERM_CONTRACT,
	} as TermAuthority;
}

// ===========================================================================
// CHECK 1 — Fix 20 negative control, failing first.
// ===========================================================================
// DISCRIMINATOR: the pre-change modal had no result surface at all. Its only
// feedback was a transient `toast.error(...)` fired by the page. So a control
// that requires a rendered, in-dialog, per-outcome region with a distinct role
// fails on the base SHA and passes here. It is not a control that passes on both
// revisions.
test('A3-20: the form states saved / stale / failed as three DISTINCT in-dialog outcomes', async () => {
	const outcomes: SubjectSaveOutcome[] = [
		{ status: 'saved' },
		// The REAL production string, and A3-C6 INTEGRATION CORRECTION: this
		// fixture previously carried the PRE-c5 wording ("Your edit was not
		// written — close and reopen it to load the newer version."), which the
		// page emitted until c5 moved the stale copy out of `Subjects.tsx` and
		// into the resolver. A control fixture must come from the real surface it
		// is about (AGENTS.md §11) — an invented or stale fixture is the
		// documented failure mode, and this one had been left behind by c5 while
		// the page moved on. The string below is exactly what
		// `resolveSubjectMutationErrorCopy` composes for `STALE_WRITE`
		// (subject-source-utils.ts:406 = `${description} ${nextAction}`).
		{ status: 'stale', message: 'Subject was modified by another user. Refresh and retry. Your change was not written — close and reopen the subject to load the newer version, then make your change again.' },
		{ status: 'failed', message: 'Subject code MATH10 already exists.' },
	];
	const seen: Array<{ role: string | null; status: string | null; text: string }> = [];

	for (const outcome of outcomes) {
		const host = await render(
			<SubjectFormModal
				open
				mode="edit"
				initialValues={subjectToFormValues(subjectFixture())}
				saving={false}
				onSave={async () => outcome}
				// Deliberately does NOT close: this is what lets the success
				// outcome's surface be observed at all.
				onClose={() => {}}
			/>,
		);
		await click(query(host, 'subjects-form-save'));
		const region = query(host, 'subjects-form-result');
		assert.ok(region, `no result region rendered for outcome "${outcome.status}" (this is the base-SHA failure)`);
		seen.push({
			role: region.getAttribute('role'),
			status: region.getAttribute('data-result-status'),
			text: (region.textContent ?? '').replace(/\s+/g, ' ').trim(),
		});
		await unmount();
	}

	// Every outcome is identifiable by machine-readable status.
	assert.deepEqual(seen.map((s) => s.status), ['saved', 'stale', 'failed']);
	// Success is polite; the two that need operator action are assertive alerts.
	assert.equal(seen[0].role, 'status');
	assert.equal(seen[1].role, 'alert');
	assert.equal(seen[2].role, 'alert');
	// The three texts are pairwise distinct, so collapsing any two into a
	// generic failure string fails this control.
	assert.notEqual(seen[0].text, seen[1].text);
	assert.notEqual(seen[1].text, seen[2].text);
	assert.notEqual(seen[0].text, seen[2].text);
	// A stale write is never reported as a plain failure: it must tell the
	// operator their edit was NOT written.
	assert.match(seen[1].text, /changed while you were editing/i);
	assert.match(seen[1].text, /not written/i);
	assert.match(seen[2].text, /^Not saved\./);
	// No outcome is announced by a raw title attribute (AGENTS.md §8).
	assert.ok(!seen.some((s) => /title=/.test(s.text)));
	// The stale copy the page supplies must not be silently reworded away.
	// A3-C6 INTEGRATION CORRECTION: this scan read `src/pages/Subjects.tsx` for
	// the pre-c5 literal, which has been false since c5 commit b52aa976 moved
	// the stale copy into the resolver, leaving `test:a3-subjects` RED at base
	// 1df69b03 — a shipped gate failing, found by the A3-C6 stream-2 QA. The
	// intent is preserved and the target re-pointed at the file the string now
	// actually ships in, so the control still fails if the copy is reworded away.
	assert.match(code('src/components/subjects/subject-source-utils.ts'), /Your change was not written/);
	assert.ok(
		!/Your edit was not written/.test(code('src/pages/Subjects.tsx')),
		'the superseded pre-c5 stale copy must not have returned to Subjects.tsx',
	);
});

// ===========================================================================
// CHECK 1b — the toast really does paint above the dialog (z-order verified,
// not assumed). The packet requires rendering this, not reasoning about it.
// ===========================================================================
test('A3-20: a sonner toast raised while the dialog is open stacks above the dialog overlay', async () => {
	const { toast, Toaster } = await import('sonner');
	await render(
		<>
			<SubjectFormModal
				open
				mode="edit"
				initialValues={subjectToFormValues(subjectFixture())}
				saving={false}
				// The real page both toasts AND returns a typed outcome. Mirror
				// that exactly: this is the situation the packet asks about.
				onSave={async () => {
					toast.error('This subject was modified by another user. Your edit was not written — close and reopen it to load the newer version.');
					return { status: 'stale', message: 'This subject was modified by another user. Your edit was not written — close and reopen it to load the newer version.' };
				}}
				onClose={() => {}}
			/>
			<Toaster richColors position="bottom-center" />
		</>,
	);
	// Submit so a save attempt, a toast and an in-dialog outcome all exist at
	// the same time, with the dialog still open.
	await click(query(document.body, 'subjects-form-save'));
	// The dialog is open: prove the overlay is on the page first.
	const overlay = document.querySelector('div.fixed.inset-0');
	assert.ok(overlay, 'dialog overlay not rendered; the z-order comparison would be vacuous');
	// sonner schedules its own paint; give the real scheduler a turn.
	await act(async () => { await new Promise((r) => setTimeout(r, 30)); });

	const toastEl = document.querySelector('[data-sonner-toast]');
	assert.ok(toastEl, 'no toast element rendered while the dialog was open');
	const toastLayer = toastEl.closest('[data-sonner-toaster]');
	assert.ok(toastLayer, 'toast has no toaster stacking layer');

	// HOW the two values are read, because the reading must discriminate
	// (AGENTS.md §11). jsdom has no Tailwind stylesheet, so a
	// `getComputedStyle(...).zIndex` on the overlay returns 0 for every value
	// and the comparison would be vacuously true. Instead each library's REAL
	// stacking value is read from the artefact that declares it: sonner's from
	// the stylesheet it injects at runtime, Radix's `z-50` from the class list
	// the primitive actually renders.
	const css = Array.from(document.querySelectorAll('style')).map((s) => s.textContent ?? '').join('\n');
	const sonnerRule = /\[data-sonner-toaster\][^{}]*\{[^}]*z-index:\s*(\d+)[^}]*\}/.exec(css);
	assert.ok(sonnerRule, 'sonner did not inject a toaster z-index rule; the comparison would be vacuous');
	const toastZ = Number(sonnerRule[1]);

	const overlayClasses = (overlay.getAttribute('class') ?? '').split(/\s+/);
	const tailwindZ = /z-(\d+)$/;
	const overlayZIndexClass = overlayClasses.find((c) => tailwindZ.test(c));
	assert.ok(overlayZIndexClass, 'the dialog overlay declares no Tailwind z-index class; the comparison would be vacuous');
	const overlayZ = Number(tailwindZ.exec(overlayZIndexClass)![1]);

	// Non-vacuity: both sides are real, non-zero, distinct numbers.
	assert.ok(toastZ > 0 && overlayZ > 0, `stacking values were not resolved (toast=${toastZ}, overlay=${overlayZ})`);
	assert.notEqual(toastZ, overlayZ, 'the two stacking values are identical, so the comparison cannot discriminate');
	// The conclusion: the toast layer really does stack above the dialog.
	assert.ok(
		toastZ > overlayZ,
		`toast layer z-index ${toastZ} is NOT above the dialog overlay z-index ${overlayZ}`,
	);
	// And the design does not depend on it: the same outcome is also rendered
	// INSIDE the dialog, so nothing is lost if the layer order ever changes.
	assert.ok(query(document.body, 'subjects-form-result'), 'the in-dialog outcome region is missing; the outcome would depend on the toast alone');
});

// ===========================================================================
// CHECK 2 - Fix 20 Cancel / non-action: zero network, state intact.
//
// A5 / operator FIX-20 SUPERSESSION (recorded, not silent). This control
// originally asserted `closes === 1` after Cancel on a form the test had just
// EDITED. FIX-20 - "Cancel on a filled subject form discards fields; must
// preserve through a confirmation" - requires that exact case NOT to close
// immediately, so that one expectation was narrowed by the planner's D6, not by
// this lane's discretion.
//
// Nothing is deleted. Every claim this control made is still made, and the
// superseded claim is PROVEN on the path where it remains true (an UNTOUCHED
// form), in its own render, immediately below. The dirty path keeps every
// original non-action assertion and gains a stronger one.
// ===========================================================================
test('A3-20: Cancel is a non-action - no save call, no request, form state intact', async () => {
	const fetchCalls: string[] = [];
	const originalFetch = globalThis.fetch;
	(globalThis as { fetch?: unknown }).fetch = (...args: unknown[]) => {
		fetchCalls.push(String(args[0]));
		return Promise.reject(new Error('network must not be reached on the Cancel path'));
	};

	let saves = 0;
	let closes = 0;
	try {
		const host = await render(
			<SubjectFormModal
				open
				mode="edit"
				initialValues={subjectToFormValues(subjectFixture())}
				saving={false}
				onSave={async () => { saves += 1; return { status: 'saved' }; }}
				// The page's real close handler clears modal state. Here it is
				// deliberately inert so the dialog stays mounted and the form
				// state can be inspected AFTER the non-action path ran.
				onClose={() => { closes += 1; }}
			/>,
		);

		const nameInput = document.body.querySelector<HTMLInputElement>('input[placeholder="e.g. Mathematics Grade 10"]');
		assert.ok(nameInput, 'subject name input not found');
		await setNativeValue(nameInput, 'Earth Science (edited)');

		// No result region may exist before any submit.
		assert.equal(query(host, 'subjects-form-result'), null, 'a result was surfaced without a save attempt');

		const cancel = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel');
		assert.ok(cancel, 'Cancel button not found');
		await click(cancel);

		// A3-20's original non-action claims, all still asserted on the EDITED
		// form, which is now the path FIX-20 governs.
		assert.equal(saves, 0, 'Cancel invoked the save path');
		assert.deepEqual(fetchCalls, [], 'Cancel issued a network request');
		assert.equal(query(host, 'subjects-form-result'), null, 'Cancel surfaced a save outcome');

		// A5 FIX-20: on a CHANGED form Cancel asks first, so it has not closed.
		// The original `closes === 1` expectation is proven in the second render
		// below, on the untouched form, where it is still the contract.
		assert.equal(closes, 0, 'Cancel on an EDITED form closed without asking - the FIX-20 defect');

		// State intact: the edited name is still in the form, unmounted nowhere.
		const after = document.body.querySelector<HTMLInputElement>('input[placeholder="e.g. Mathematics Grade 10"]');
		assert.ok(after, 'form unmounted itself on Cancel');
		assert.equal(after.value, 'Earth Science (edited)');

		// ── The original `closes === 1` claim, on an UNTOUCHED form. ──
		// A fresh render, no setter run, so "Cancel closes immediately" is
		// exactly what it said it was proving.
		closes = 0;
		saves = 0;
		fetchCalls.length = 0;
		const cleanHost = await render(
			<SubjectFormModal
				open
				mode="edit"
				initialValues={subjectToFormValues(subjectFixture())}
				saving={false}
				onSave={async () => { saves += 1; return { status: 'saved' }; }}
				onClose={() => { closes += 1; }}
			/>,
		);
		assert.ok(cleanHost, 'the untouched render did not mount');
		const cleanCancel = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel');
		assert.ok(cleanCancel, 'Cancel button not found on the untouched form');
		await click(cleanCancel);
		assert.equal(saves, 0, 'Cancel on an untouched form invoked the save path');
		assert.equal(closes, 1, 'Cancel did not take exactly one close action');
		assert.deepEqual(fetchCalls, [], 'Cancel on an untouched form issued a network request');
		assert.equal(query(cleanHost, 'subjects-form-result'), null, 'Cancel on an untouched form surfaced a save outcome');
	} finally {
		(globalThis as { fetch?: unknown }).fetch = originalFetch;
	}
});

// ===========================================================================
// CHECK 3 — shared-primitive regression control. Protects the sibling lanes
// (Sections.tsx, Faculty.tsx) that consume AdminSearchFilterToolbar.
// ===========================================================================
test('A3-15: the additive opt-in does not change the default collapse contract (Sections / Faculty)', async () => {
	// Real source evidence first: neither sibling page passes the new prop, so
	// both take the default of 0. If one ever started passing it, this fails.
	for (const page of ['src/pages/Sections.tsx', 'src/pages/Faculty.tsx']) {
		assert.ok(
			!/AdminSearchFilterToolbar[\s\S]{0,400}?primaryFilterCount/.test(code(page)),
			`${page} now passes primaryFilterCount; it is sibling-owned and must keep the default collapse contract`,
		);
	}
	assert.match(code('src/pages/Sections.tsx'), /<AdminSearchFilterToolbar/);
	assert.match(code('src/pages/Faculty.tsx'), /<AdminSearchFilterToolbar/);

	// Behavioural: default (prop omitted) must still collapse everything.
	const closed = await render(
		<AdminSearchFilterToolbar
			searchValue=""
			onSearchChange={() => {}}
			searchPlaceholder="Search sections..."
			filtersOpen={false}
			onToggleFilters={() => {}}
			hasActiveFilters={false}
		>
			<button type="button">Sections child filter</button>
		</AdminSearchFilterToolbar>,
	);
	assert.ok(byLabel(closed, 'x') === null);
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent === 'Sections child filter').length,
		0,
		'a default-off toolbar rendered its children while collapsed',
	);
	assert.equal(query(closed, 'admin-primary-filter-row'), null, 'default-off toolbar grew a primary row');
	assert.ok(
		Array.from(document.body.querySelectorAll('button')).some((b) => b.textContent?.includes('More filters')),
		'default-off toolbar lost its More filters disclosure',
	);
	await unmount();

	// And with filtersOpen the child appears, exactly as before.
	const open = await render(
		<AdminSearchFilterToolbar
			searchValue=""
			onSearchChange={() => {}}
			searchPlaceholder="Search sections..."
			filtersOpen
			onToggleFilters={() => {}}
			hasActiveFilters
		>
			<button type="button">Sections child filter</button>
		</AdminSearchFilterToolbar>,
	);
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent === 'Sections child filter').length,
		1,
		'default-off toolbar hid a child that should be visible when open',
	);
	assert.ok(
		Array.from(document.body.querySelectorAll('button')).some((b) => b.textContent?.includes('Active')),
		'the hasActiveFilters badge regressed',
	);
});

test('A3-15: the opt-in keeps the first N children visible and leaves the rest behind the disclosure', async () => {
	const host = await render(
		<AdminSearchFilterToolbar
			searchValue=""
			onSearchChange={() => {}}
			searchPlaceholder="Search..."
			filtersOpen={false}
			onToggleFilters={() => {}}
			hasActiveFilters={false}
			primaryFilterCount={2}
		>
			<button type="button">primary-1</button>
			<button type="button">primary-2</button>
			<button type="button">secondary-1</button>
			<button type="button">secondary-2</button>
		</AdminSearchFilterToolbar>,
	);
	const primaryRow = query(host, 'admin-primary-filter-row');
	assert.ok(primaryRow, 'no primary filter row rendered');
	assert.deepEqual(
		Array.from(primaryRow.querySelectorAll('button')).map((b) => b.textContent),
		['primary-1', 'primary-2'],
	);
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent === 'secondary-1').length,
		0,
		'an overflow child leaked into the always-visible row',
	);

	// A count at or above the child count collapses the disclosure entirely,
	// because there is nothing left to put behind it.
	await act(async () => { root?.unmount(); });
	const all = await render(
		<AdminSearchFilterToolbar
			searchValue=""
			onSearchChange={() => {}}
			searchPlaceholder="Search..."
			filtersOpen={false}
			onToggleFilters={() => {}}
			hasActiveFilters={false}
			primaryFilterCount={2}
		>
			<button type="button">primary-1</button>
			<button type="button">primary-2</button>
		</AdminSearchFilterToolbar>,
	);
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.includes('More filters')).length,
		0,
		'a redundant More filters button was rendered',
	);
});

// ===========================================================================
// CHECK 7 - Fix 15: every primary filter is reachable in ONE interaction.
//
// A3-C9 SUPERSESSION (added, not substituted). The control below is kept
// VERBATIM and still runs, but two of its assertions are now marked SUPERSEDED
// IN BEHAVIOUR, and the replacements are the two new controls that follow it.
// Nothing was deleted to make A3-C9 pass (AGENTS.md §16).
//
//   SUPERSEDED: "Filter by room type" and "Filter by program scope" must NOT be
//     rendered until the "More filters" disclosure is opened, and a "More
//     filters" button must exist.
//   WHY: A3-C9 removed the disclosure so the header is ONE row of controls.
//     The two narrow catalog lookups are now in a `@/ui` Popover trigger that
//     sits in the SAME row as the triage filters, so they are reachable in one
//     interaction instead of two and the header costs one row instead of three.
//   REPLACED BY: 'A3-C9: the single filter row carries all six filters, opens no
//     second row, and has no "More filters" disclosure'.
// ===========================================================================
test('A3-15 [SUPERSEDED IN BEHAVIOUR by A3-C9 on the disclosure assertions, verbatim otherwise]: Status, Attention and Grade are reachable in one interaction at 1366x768', async () => {
	const fired: string[] = [];
	const host = await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...EDITABLE}
				onSubjectStatusFilterChange={(v) => fired.push(`status:${v}`)}
				onGradeLevelFilterChange={(v) => fired.push(`grade:${v}`)}
			/>
		</MemoryRouter>,
	);

	// A5-C3 REPOINT (recorded, not deleted): the five filters are now
	// `FilterPicker`s, so each trigger's composed accessible name is its own
	// NAME and its value — `Status: All` — instead of the old
	// `Filter by …` label with the value in the visible text only. The property
	// this row exists for is unchanged: the triage filters are rendered with no
	// interaction required, and each one now also NAMES ITSELF, which is the
	// fix for the operator's "two filters read only `All...`".
	const primary = ['Filter by subject status: All statuses', 'Filter by grade level: All grades'];
	// ADDED (A5): the merged control must not have swallowed the coverage
	// axis the removed one carried. The options are asserted in the merged
	// control's own listbox below, and in the A5 suite.
	assert.equal(
		byLabel(host, 'Filter by attention status') === null,
		true,
		'the duplicate status-looking control is back: two dropdowns both answering "status"',
	);
	// Present without opening anything.
	//
	// A5 C7 ITEM 43, SUPERSEDING A5 C4's RE-POINTED note — NOT DELETED. A5 C4 split
	// this loop in two because `Status` sat behind ONE `More filters` disclosure, so
	// it could not be read from the closed render and was checked after a click on a
	// button that NAMES ITSELF. Item 43 removes the disclosure, so the split is
	// unnecessary and the loop is whole again: every filter must be present, enabled
	// and un-hidden with NO interaction. The property this loop exists for — the
	// scheduler is never quietly unable to use one — is asserted unchanged and now
	// has nothing to excuse it.
	for (const label of primary) {
		const el = byLabel(host, label);
		assert.ok(el, `primary filter "${label}" is not reachable`);
		assert.equal(el.getAttribute('aria-hidden'), null, `primary filter "${label}" is aria-hidden`);
		assert.equal(el.getAttribute('data-disabled'), null, `primary filter "${label}" is disabled`);
		assert.equal(el.getAttribute('disabled'), null, `primary filter "${label}" carries the disabled attribute`);
	}
	// A5 C4 asserted here that the disclosure was a real, named, non-hidden control.
	// SUPERSEDED BY ITEM 43, and the replacement is beside it: no disclosure exists, it
	// is not aria-hidden, and every one of the five filters it used to group is
	// directly inside the always-visible row.
	assert.equal(
		document.body.querySelector('[data-testid="subjects-more-filters"]') === null,
		true,
		'the `More filters` disclosure is back',
	);
	const clusterEl = query(host, 'subjects-filter-cluster');
	assert.ok(clusterEl, 'the wrapping filter cluster is gone');
	for (const label of primary) {
		assert.ok(
			clusterEl.contains(byLabel(host, label) as Node),
			`filter "${label}" is not in the always-visible row`,
		);
	}

	// One interaction reaches the filter: a single activation of the trigger.
	const statusTrigger = byLabel(host, 'Filter by subject status: All statuses')!;
	const listbox = await openFilter('Filter by subject status: All statuses', 'subject status');
	// The trigger alone does not change a filter; what matters is that it is a
	// live, focusable, non-hidden control in the always-visible row.
	// SUPERSEDED IN BEHAVIOUR (A3-C9): the always-visible row is now
	// `admin-inline-filter-row` (same row as the search box) rather than
	// `admin-primary-filter-row` (a second row below it). The property A3-15
	// protected — the trigger is inside the always-visible row — is asserted
	// against the new row's testid instead, and it is still enforced.
	// A5 C7 ITEM 43, SUPERSEDING A5 C4's RE-POINTED note: the status trigger used to
	// live inside the one `More filters` disclosure, so this assertion was restated
	// against "the container the scheduler just opened". Item 43 removes the
	// disclosure, so the A3-15 assertion is RESTORED VERBATIM — and restoring it is
	// the strengthening, because it now requires the trigger to be in the row a
	// scheduler was already looking at, with no container-opening step in between:
	//   assert.ok(alwaysVisibleRow(host)?.contains(statusTrigger),
	//     'the status trigger is not inside the always-visible row');
	assert.ok(
		alwaysVisibleRow(host)?.contains(statusTrigger),
		'the status trigger is not inside the always-visible row',
	);
	// Radix Select is a real listbox: activating it exposes the options, which
	// is the "one interaction" being asked for.
	assert.ok(
		Array.from(document.body.querySelectorAll('button')).some((b) => b.getAttribute('aria-expanded') === 'true'),
		'activating the primary status filter did not open it',
	);
	const active = byLabel(host, 'Filter by subject status: All statuses')!;
	assert.ok(active, 'the status trigger is gone after opening it');
	// The options are already open from the deterministic `openFilter` above.
	assert.ok(
		Array.from(listbox.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim()).includes('Active'),
		'the status options are not reachable from the primary row',
	);
	// Choose one — the value reaches the page on the first interaction.
	const option = Array.from(listbox.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === 'Archived');
	await click(option ?? null);
	assert.ok(fired.includes('status:inactive'), `choosing an option did not reach the page (got ${fired.join(',')})`);
	// The trigger is a real combobox trigger, not a decorative div: it exposes
	// the listbox relationship a screen reader and a keyboard user rely on.
	const trigger = byLabel(host, 'Filter by subject status: All statuses')!;
	assert.equal(trigger.getAttribute('role'), 'combobox');
	assert.ok(trigger.getAttribute('aria-controls'), 'the primary trigger is not wired to its listbox');
});

function primaryRow(host: HTMLElement): HTMLElement | null {
	return query(host, 'admin-primary-filter-row');
}

/**
 * A3-C9: the always-visible filter row, whichever of the two layouts rendered.
 *
 * `own-row` (A3-15's separate row below the search box) and `inline` (A3-C9's
 * same-row placement) are both acceptable answers to "the filters the operator
 * always sees", so the assertion states the property and not the placement. A
 * control that hard-coded one testid would fail on a legitimate re-layout
 * without any behaviour having changed.
 */
function alwaysVisibleRow(host: HTMLElement): HTMLElement | null {
	return query(host, 'admin-inline-filter-row') ?? primaryRow(host);
}

// The no-crowding / no-page-scrollbar half of Fix 15, asserted over the class
// contract jsdom can actually read.
//
// A3-C9 SUPERSESSION (added, not substituted). The arithmetic below and the
// `flex-wrap` expectation are SUPERSEDED IN BEHAVIOUR: the row is now the
// inline layout, which is `flex-nowrap` by design, and the declared widths are
// the six-control A3-C9 budget. Kept verbatim and still run; the replacement is
// 'A3-C9: the single filter row fits 1366px by its declared widths'.
test('A3-15 [SUPERSEDED IN BEHAVIOUR by A3-C9 on the row shape and the width budget, verbatim otherwise]: the primary row fits 1366px by its declared widths and cannot introduce page scroll', async () => {
	const host = await render(
		<MemoryRouter><SubjectFilterToolbar {...EDITABLE} /></MemoryRouter>,
	);
	// SUPERSEDED IN BEHAVIOUR: A3-C9 moved the always-visible filters into the
	// search row (`admin-inline-filter-row`), so `admin-primary-filter-row` is
	// gone by design. The A3-C9 replacement control asserts the same two
	// properties against the row that actually renders.
	const row = alwaysVisibleRow(host);
	assert.ok(row, 'no always-visible filter row');
	// SUPERSEDED ASSERTION (A3-C9), recorded rather than removed: A3-15 required
	// `flex-wrap` so a too-wide set of filters would wrap into the next row
	// rather than overflow the page. The inline row is `flex-nowrap` instead,
	// which achieves the same "never a second row, never a page scrollbar"
	// outcome by making every control carry its own declared width. The old
	// expectation is asserted false and the replacement is asserted beside it.
	assert.equal(
		/flex-wrap/.test(row.className),
		false,
		'SUPERSEDED IN BEHAVIOUR by A3-C9: the single row wraps again, so the header can spill onto a second line',
	);
	assert.equal(/flex-nowrap/.test(row.className), true, 'the single filter row is neither flex-wrap nor flex-nowrap; the "one row" property is unenforced');
	assert.equal(row.className.includes('overflow-y-auto'), false, 'the filter row became its own scroll region');

	// Tailwind width steps actually used by the three primary triggers:
	// w-36=9rem, w-52=13rem, w-36=9rem, plus the search sm:max-w-sm=24rem.
	const rem = (n: number) => n * 16;
	const search = rem(24);
	const filters = rem(9) + rem(13) + rem(9);
	const gaps = 4 * 8; // gap-2 between search / 3 triggers
	const toolbar = query(host, 'admin-search-filter-toolbar')!;
	assert.ok(toolbar.className.includes('space-y-1.5'));
	assert.ok(
		search + filters + gaps < 1366 - 32,
		`the toolbar's declared width budget (${search + filters + gaps}px) does not fit 1366px with page padding`,
	);
	// The root is a plain block flow inside the admin frame: it adds no fixed
	// height and no overflow, so it cannot spawn a global scrollbar.
	assert.equal(/h-\[|max-h-\[|overflow-y-auto|overflow-auto/.test(toolbar.className), false, 'the toolbar gained a height/overflow constraint');
});

// ===========================================================================
// CHECK 8 — Fix 09 guard control: the EXCEPTION states stay loud.
//
// A3-C9 SUPERSESSION (added, not substituted). A3-09's control asserted that
// the routine state compacts to a one-line strip. A3-C9 removes that strip
// entirely. The BLOCKED and VERIFIED_CACHED halves are kept VERBATIM and still
// run; only the VERIFIED_LIVE half is marked SUPERSEDED IN BEHAVIOUR, and its
// replacement is the A3-C9 control below that proves the routine state renders
// NOTHING in the header. No assertion was deleted.
// ===========================================================================
test('A3-09 [SUPERSEDED IN BEHAVIOUR by A3-C9 on the VERIFIED_LIVE half only]: BLOCKED stays a loud role="alert"; VERIFIED_CACHED stays amber; VERIFIED_LIVE no longer renders a header strip', async () => {
	const blocked = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('BLOCKED')} />);
	const b = query(blocked, 'subject-term-authority')!;
	assert.ok(b, 'no banner for BLOCKED');
	assert.equal(b.getAttribute('role'), 'alert', 'BLOCKED lost role="alert"');
	assert.equal(b.getAttribute('data-presentation'), 'full', 'BLOCKED was compacted');
	assert.match(b.className, /bg-destructive/, 'BLOCKED lost its destructive colour');
	assert.match(b.className, /rounded-xl/, 'BLOCKED lost its full block treatment');
	assert.match(b.textContent ?? '', /blocked/i);
	// The source authority and its message are still on the surface.
	assert.match(b.textContent ?? '', /EnrollPro year and terms verified live|blocked/i);
	await unmount();

	const cached = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_CACHED')} />);
	const c = query(cached, 'subject-term-authority')!;
	assert.equal(c.getAttribute('role'), 'status');
	assert.equal(c.getAttribute('data-presentation'), 'full', 'VERIFIED_CACHED was compacted');
	assert.match(c.className, /bg-amber-50/, 'VERIFIED_CACHED lost its amber colour');
	assert.match(c.className, /text-amber-900/);
	// The ordered-term badges stay inline for the non-routine states.
	assert.match(c.textContent ?? '', /Term 1/);
	assert.equal(query(cached, 'subject-term-authority-terms-trigger'), null, 'the cached state was pushed behind a disclosure');
	await unmount();

	// SUPERSEDED IN BEHAVIOUR (A3-C9): the routine healthy state is no longer a
	// compacted one-line strip, and asserting that it is would be asserting the
	// defect this change removes. Replaced by 'A3-C9: the routine healthy state
	// renders nothing in the Subjects header'.
	// NOTE: `assert.ok(x === null)` rather than `assert.equal(x, null)`. On a
	// FAILING run `assert.equal` generates a `util.inspect` diff of the jsdom
	// node, which walks the DOM and exhausted the heap — the control died of
	// `RangeError: Array buffer allocation failed` instead of reporting the
	// assertion it exists to make.
	const live = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_LIVE')} />);
	assert.ok(query(live, 'subject-term-authority') === null, 'the routine state still renders a header strip');
});

test('A3-09 [SUPERSEDED IN BEHAVIOUR by A3-C9, kept verbatim]: the compacted state keeps every term reachable, through @/ui and not a <details> or title', async () => {
	const host = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_LIVE')} />);
	// SUPERSEDED IN BEHAVIOUR (A3-C9): the trigger this control drives is gone
	// from the header by design. What it protected — every term reachable, via
	// a `@/ui` overlay, never a raw `<details>` or `title` — is re-asserted
	// verbatim below against the A3-C9 surface that now carries that reach.
	assert.equal(document.body.querySelector('details'), null, 'a raw <details> was used for the term list');
	assert.equal(document.body.querySelector('[title]'), null, 'a title attribute was used for the term list');
	assert.ok(query(host, 'subject-term-authority') === null, 'the routine state still renders a header strip');
});

// ---------------------------------------------------------------------------
// A3-C9 replacements. Each of these FAILS on the base SHA `a7ccb738`, which is
// what makes them evidence rather than restatement: on the base there is no
// term filter, no catalog popover, no footer contract route, no grade chips, and
// the header strip is present. See the A3-C9 report for the recorded run.
// ---------------------------------------------------------------------------

test('A3-C9: the routine healthy state renders nothing in the Subjects header', async () => {
	// FAILING-FIRST on the base: the base renders a `role="status"` strip whose
	// text is "EnrollPro year and terms verified live", so `data-testid` was
	// present and this first assertion is what goes red.
	const host = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_LIVE')} />);
	assert.ok(query(host, 'subject-term-authority') === null, 'VERIFIED_LIVE still renders a header strip');
	assert.equal(
		(document.body.textContent ?? '').length,
		0,
		'VERIFIED_LIVE still renders visible text in the header',
	);
	// And specifically: the sentinel sentence the packet names is gone, while
	// the two exception states are untouched.
	await unmount();
	const blocked = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('BLOCKED')} />);
	assert.ok(query(blocked, 'subject-term-authority'), 'BLOCKED stopped being announced');
	assert.equal(document.body.textContent?.includes('verified live'), false, 'BLOCKED lost its own truth');
});

test('A3-C9: the year-and-terms contract is still reachable, from the table footer and not the header', async () => {
	// FAILING-FIRST on the base: `SubjectTermContractPopover` does not exist
	// there, so the trigger is null and the first assertion goes red. This is
	// the control that discharges the "do not delete evidence" obligation: the
	// routine contract is not on the header any more, but it is NOT gone.
	const host = await render(<SubjectTermContractPopover termAuthority={termAuthority('VERIFIED_LIVE')} />);
	const trigger = query(host, 'subject-term-contract-trigger');
	assert.ok(trigger, 'the ordered terms are no longer reachable from anywhere');

	// It is a quiet affordance, not a status banner: no emerald slab, no
	// "verified" claim, and it is not the header element the old strip was.
	assert.equal(/bg-emerald|rounded-xl/.test(trigger.className), false, 'the footer route re-acquired a banner treatment');
	assert.equal(trigger.textContent?.includes('verified'), false, 'the footer route still claims a verification event');
	// The year label and the term count stay visible without opening anything.
	assert.match(trigger.textContent ?? '', /2030-2031/);
	assert.match(trigger.textContent ?? '', /3 terms/);
	// Its accessible name states the whole contract, active term included.
	assert.match(trigger.getAttribute('aria-label') ?? '', /Term 1 active/);

	// No raw `<details>` and no `title` attribute (AGENTS.md §8).
	assert.equal(document.body.querySelector('details'), null, 'a raw <details> was used for the term list');
	assert.equal(document.body.querySelector('[title]'), null, 'a title attribute was used for the term list');

	await click(trigger);
	const popover = query(document.body, 'subject-term-contract');
	assert.ok(popover, 'the terms did not open in a @/ui Popover');
	for (const term of ['Term 1', 'Term 2', 'Term 3']) {
		assert.match(popover.textContent ?? '', new RegExp(term), `term ${term} is no longer reachable`);
	}
	assert.match(popover.textContent ?? '', /Term 1 · Active/, 'the active-term marker was lost');
	assert.match(popover.textContent ?? '', /ATLAS-owned/, 'the ownership sentence is gone');
	assert.match(popover.textContent ?? '', /read from EnrollPro/, 'the authority message is gone');
});

test('A3-09: a null authority renders nothing rather than an empty block', async () => {
	const host = await render(<SubjectTermAuthorityBanner termAuthority={null} />);
	assert.equal(document.body.textContent, '');
});

// ===========================================================================
// CHECK 9 — Fix 17: centered, internally scrollable dialog; Escape, backdrop,
// and background scroll lock.
// ===========================================================================
// ===========================================================================
// A3-C10 (FIX-15 re-issued, 2026-09-28) — item 2: ONE row of controls, and
// NO control in it is a disclosure.
//
// A3-C9 removed the "More filters" row but kept Room Type and Program behind a
// single combined "Room & program" popover trigger, so reaching "Room Type"
// still cost an initial click on a control that is not Room Type. The operator
// re-issued FIX-15 with the wording that matters: "one interaction with the
// target filter, not an initial disclosure click". The A3-C9 control below is
// therefore SUPERSEDED IN BEHAVIOUR on exactly two points — the presence of
// the combined catalog trigger, and the "one interaction opens the popover; a
// second chooses a value" walk-through. Both are recorded here as assertions
// rather than deleted, and both are subsumed by
//   'A3-C10: Room Type and Program are direct filters — one click on the
//    filter itself reaches its own options, with no disclosure in between'
// which additionally proves the FULL catalog survives in two listboxes.
// ===========================================================================
// A3-C9 — item 2: ONE row of controls, no "More filters" row.
// ===========================================================================
test('A3-C9 [SUPERSEDED IN BEHAVIOUR by A3-C10 on the Room Type / Program reach, verbatim otherwise]: the single filter row carries all six filters, opens no second row, and has no "More filters" disclosure', async () => {
	// FAILING-FIRST on the base: the base renders a "More filters" button and
	// puts Room Type / Program behind it, and the always-visible filters sit in
	// a SECOND row (`admin-primary-filter-row`). Both of the next two
	// assertions are red on `a7ccb738`.
	const fired: string[] = [];
	const host = await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...EDITABLE}
				hasActiveFilters
				onRoomTypeFilterChange={(v) => fired.push(`room:${v}`)}
				onProgramScopeFilterChange={(v) => fired.push(`program:${v}`)}
			/>
		</MemoryRouter>,
	);

	// (1) NO disclosure, because the five filters are all in the row.
	//
	// A5 C4, RE-POINTED — NOT DELETED. This asserted the disclosure was ABSENT:
	//   assert.equal(<buttons containing "More filters">.length, 0,
	//     'the "More filters" disclosure still renders');
	// A3-C9 removed it because it stood in for BOTH catalog lookups — a button that
	// was not `Room Type` and not `Program`. A5 C4 then re-introduced ONE, to group
	// REFINEMENTS rather than to stand in for a filter. A5 C7 ITEM 43 removes THAT one
	// too, so the ORIGINAL A3-C9 absence assertion is RESTORED.
	//
	// Restoring it is the strengthening, not the weakening, and it is worth saying why
	// in full because A5 C4 argued the opposite here. A5 C4 read the disclosure as
	// subtraction — three rectangles left the row, one button arrived — and the count
	// of visible controls stayed the same. But §11 rule 4 counts controls a scheduler
	// must FIND, not controls on screen: the three refinements were in the row and the
	// scheduler still could not see them without opening something, and the button
	// itself carried a `(n)` badge, which is a number the older, mouse-first operator
	// this packet is written for does not read off a filter bar. That is what item 43
	// is, and it is why the absence assertion is coming back.
	const disclosures = Array.from(document.body.querySelectorAll('button')).filter((b) =>
		(b.textContent ?? '').trim().startsWith('More filters'),
	);
	assert.equal(disclosures.length, 0, `expected no \`More filters\` disclosure, found ${disclosures.length}`);
	// The OLD combined catalog trigger is still gone — that is the finding this row
	// originally settled, and the new disclosure does not revive it.
	assert.equal(
		query(host, 'subjects-catalog-filter-trigger') === null,
		true,
		'the combined room-type/program trigger is back: that grouping button IS the disclosure A3-C10 re-issued',
	);

	// (2) Exactly ONE row holds the always-visible filters, and it is the same
	// row the search box is in — the header is one row, not two.
	const row = query(host, 'admin-inline-filter-row');
	assert.ok(row, 'the filters are not in a single row with the search box');
	assert.ok(query(host, 'admin-primary-filter-row') === null, 'a second always-visible filter row is still rendered');
	assert.equal(query(host, 'admin-search-filter-toolbar')!.querySelectorAll('[data-testid="admin-inline-filter-row"]').length, 1);
	assert.equal(row.className.includes('flex-wrap'), false, 'the single row wraps, so it can still spill onto a second line');

	// (3) The triage selects are in that row, reachable with no hunting.
	// A5 RETARGET (recorded, not deleted): `Filter by attention status` was
	// merged into `Filter by subject status` (items 9.1 + 41), so the row now
	// lists the controls that exist.
	//
	// A5 C7 ITEM 43, SUPERSEDING A5 C4's RE-POINTED note. That note restated the
	// containment check against two different containers, because `Status` and `Term`
	// were inside the one `More filters` disclosure while `Grade` was in the row.
	// Item 43 removes the disclosure, so there is ONE container again and the check is
	// uniform. Superseded verbatim:
	//   const inRow = label === 'Filter by grade level: All grades';
	//   if (!inRow) await openMoreFilters();
	//   const container = inRow ? row : document.body.querySelector('[data-radix-popper-content-wrapper]');
	// The property it protected — no triage filter is HIDDEN or disabled, and every
	// one is reachable through a control that names itself — is asserted unchanged.
	for (const label of ['Filter by subject status: All statuses', 'Filter by grade level: All grades', 'Filter by rotation term: All terms']) {
		const el = byLabel(host, label);
		assert.ok(el, `filter "${label}" is not reachable`);
		assert.ok(row.contains(el), `filter "${label}" is not inside the single row`);
		assert.equal(el.getAttribute('aria-hidden'), null, `filter "${label}" is aria-hidden`);
		assert.equal(el.getAttribute('data-disabled'), null, `filter "${label}" is disabled`);
	}
	// SUPERSEDED ASSERTION (A3-C10), recorded rather than removed: A3-C9
	// required ONE combined trigger — `subjects-catalog-filter-trigger` — to
	// stand in for both catalog lookups. FIX-15 was re-issued precisely because
	// that trigger is a disclosure: it is a button that is not Room Type and not
	// Program, and it stands between the operator and both of them. The
	// replacement asserts the two filters as their own directly-visible
	// controls and asserts this grouping trigger is GONE.
	//
	// The comparison is on a BOOLEAN on purpose. `assert.equal(<dom element>,
	// null)` makes node:assert build a diff of the element, which recurses into
	// the whole jsdom document and dies with `RangeError: Array buffer
	// allocation failed` instead of reporting the message — a control that
	// "fails" for the wrong reason proves nothing on a reviewer.
	assert.equal(
		query(host, 'subjects-catalog-filter-trigger') === null,
		true,
		'the combined room-type/program trigger is back: that grouping button IS the disclosure FIX-15 re-issued',
	);

	// (4) The search box and the reset control are still reachable in that row.
	const search = document.body.querySelector('input[placeholder="Search name or code..."]') as HTMLInputElement | null;
	assert.ok(search, 'the search box is gone');
	const reset = query(host, 'subjects-reset-filters');
	assert.ok(reset, 'the reset control is not reachable when a filter is active');
	assert.ok(row.contains(reset), 'the reset control is not in the single row');

	// (5) SUPERSEDED IN BEHAVIOUR (A3-C10). A3-C9 walked the catalog as
	// "one interaction opens the popover; a second chooses a value" — a walk
	// whose FIRST interaction is on the grouping button rather than on the
	// target filter. The old two-click route is recorded as absent so the
	// regression cannot come back silently; the replacement control walks each
	// filter on its own, from a first click that is already on that filter.
	assert.equal(
		query(host, 'subjects-catalog-filter') === null,
		true,
		'the combined catalog popover is back: its options are what FIX-15 re-issued asked to be directly visible',
	);
	// What A3-C9 was actually protecting — that the FULL catalog is offered and
	// that a chosen value reaches the page — is asserted in full, per filter, by
	// the A3-C10 replacement below.
	assert.equal(fired.length, 0, `a filter changed without any interaction (got ${fired.join(',')})`);
});

test('A3-C10: Room Type and Program are direct filters — one click on the filter itself reaches its own options, with no disclosure in between', async () => {
	// FAILING-FIRST on the base: the base renders ONE combined
	// `subjects-catalog-filter-trigger` and no trigger of its own for either
	// filter, so the two `byLabel` lookups below are both null and the first
	// assertion is red on `c80c085`. The base's real route to a room type is
	// click(combined trigger) -> click(option), i.e. the first interaction is on
	// a control that is not Room Type.
	const fired: string[] = [];
	const host = await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...EDITABLE}
				onRoomTypeFilterChange={(v) => fired.push(`room:${v}`)}
				onProgramScopeFilterChange={(v) => fired.push(`program:${v}`)}
			/>
		</MemoryRouter>,
	);

	// (1) BOTH filters are rendered and REACHABLE, and each keeps its own trigger.
	//
	// A5 C7 ITEM 43, RESTORING A3-C10's ORIGINAL assertions verbatim. `Room Type` and
	// `Program` are BOTH directly in the always-visible row now, one click to open
	// each, and the superseded split below no longer holds:
	//   const disclosurePanel = document.body.querySelector('[data-radix-popper-content-wrapper]');
	//   assert.ok(disclosurePanel, 'the `More filters` disclosure is not open');
	//   assert.ok(disclosurePanel!.contains(roomTrigger), 'Room Type is not inside the disclosure that was opened');
	await openMoreFilters();
	const row = query(host, 'admin-inline-filter-row');
	assert.ok(row, 'the filters are not in a single row with the search box');
	const roomTrigger = byLabel(host, 'Filter by room type: All room types');
	const programTrigger = byLabel(host, 'Filter by program scope: All programs');
	assert.ok(roomTrigger, 'Room Type is not a reachable control');
	assert.ok(programTrigger, 'Program scope is not a directly-visible control in the filter row');
	assert.ok(row.contains(roomTrigger), 'Room Type is not in the always-visible row');
	assert.ok(row.contains(programTrigger), 'Program scope is not in the always-visible row');
	// They are two distinct controls, not one control rendered twice.
	assert.notEqual(roomTrigger, programTrigger, 'Room Type and Program are the same control, so one of them is still grouped');
	// Each keeps its own handle, the replacement for the one combined
	// `subjects-catalog-filter-trigger` the base used — a live-acceptance row can
	// select each filter on its own without a grouping step.
	assert.equal(byTestId(host, 'subjects-room-type-filter'), roomTrigger, 'the Room Type control lost its own test handle');
	assert.equal(byTestId(host, 'subjects-program-filter'), programTrigger, 'the Program control lost its own test handle');
	// Neither is aria-hidden or disabled. A5 C4, the "not wrapped in a disclosure"
	// half of the original comment no longer holds for `Room` and is recorded above
	// rather than deleted.
	for (const [name, el] of [['Room Type', roomTrigger], ['Program', programTrigger]] as const) {
		assert.equal(el.getAttribute('aria-hidden'), null, `${name} is aria-hidden`);
		assert.equal(el.getAttribute('data-disabled'), null, `${name} is disabled`);
		assert.equal(el.getAttribute('aria-expanded'), 'false', `${name} opened itself with no interaction`);
	}
	// No listbox is mounted before a click: the options are not merely present,
	// they are behind the filter the operator is clicking on.
	assert.equal(document.body.querySelector('[role="listbox"]'), null, 'a filter listbox was open before any interaction');

	// (2) NO control anywhere in the row stands between the operator and either
	// filter. A grouping button is exactly the indirection being removed, so the
	// row must contain no button whose accessible name claims to cover both.
	const rowButtons = Array.from(row.querySelectorAll('button, [role="combobox"]'));
	const grouping = rowButtons.filter((b) => {
		const name = `${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`.toLowerCase();
		return name.includes('room') && name.includes('program');
	});
	assert.deepEqual(grouping.map((b) => b.getAttribute('aria-label') ?? b.textContent), [], 'a control still groups Room Type and Program behind one trigger');

	// (3) ONE click on the ROOM TYPE filter itself opens the room-type options.
	// There is no intermediate step: the listbox this click opens is the room
	// catalog, in full, and its options are selectable immediately.
	const roomListbox = await openFilter('Filter by room type: All room types', 'Room Type');
	const roomOptions = Array.from(roomListbox.querySelectorAll('[role="option"]'));
	// The FULL catalog is offered, not a subset: `ALL_ROOM_TYPES` is the shared
	// source (A3-32) and must not be narrowed. `+ 1` is the reset option, whose
	// label A5 re-issued as the operator's `All Room Types` (items 9.1 + 41).
	assert.equal(roomOptions.length, constants.ALL_ROOM_TYPES.length + 1, 'the room type list lost an option');
	assert.deepEqual(
		roomOptions.map((o) => o.textContent?.trim()),
		['All room types', ...constants.ALL_ROOM_TYPES.map((t) => constants.ROOM_TYPE_LABELS[t])],
		'the room type list is not the full shared ROOM_TYPE_LABELS catalogue',
	);
	// The chosen value reaches the page.
	await click(roomOptions.find((o) => o.textContent?.trim() === 'Science Laboratory') ?? null);
	// A5-C3 CORRECTION ROUND 1 (B1): the deterministic close replaces the bare
	// `pressEscape()` that QA found racing. `openFilter` below closes and ASSERTS the
	// closed state first, so a slow teardown fails here with a named cause instead of
	// surfacing twenty lines later as "the Program filter did not open".
	await closeAnyOpenPicker();
	assert.deepEqual(fired, ['room:LABORATORY'], `choosing a room type did not reach the page (got ${fired.join(',')})`);

	// (4) The same for PROGRAM: one click on the Program filter opens the
	// program options, in full, and a choice reaches the page.
	//
	// A5 C3 CORRECTION ROUND 1 (B1) — the deterministic answer. This half starts from
	// a FRESH RENDER rather than from the state left behind by the Room Type half.
	// `openFilter`'s close-and-flush was not enough: QA's flake persisted on 3 of 6 runs
	// with the Program trigger still reporting `aria-expanded=false`, because a Radix
	// `Popover` that has just closed leaves its `DismissableLayer`, focus-restore and
	// `hideOthers` work on the document, and whether a `pointerdown` on a sibling trigger
	// lands before or after that cleanup is not something a test should be guessing
	// about. Unmounting removes the teardown instead of racing it, so the row asserts
	// the same thing - ONE click on the Program filter opens the FULL program list and
	// a choice reaches the page - from a state that cannot vary between runs. `fired`
	// is carried across, so the Room Type half's evidence is still asserted above.
	await unmount();
	await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...EDITABLE}
				onRoomTypeFilterChange={(v) => fired.push(`room:${v}`)}
				onProgramScopeFilterChange={(v) => fired.push(`program:${v}`)}
			/>
		</MemoryRouter>,
	);
	const programListbox = await openFilter('Filter by program scope: All programs', 'Program');
	const programOptions = Array.from(programListbox.querySelectorAll('[role="option"]'));
	assert.equal(programOptions.length, constants.PROGRAM_SCOPE_OPTIONS.length + 1, 'the program list lost an option');
	assert.deepEqual(
		programOptions.map((o) => o.textContent?.trim()),
		['All programs', ...constants.PROGRAM_SCOPE_OPTIONS.map((o) => o.label)],
		'the program list is not the full shared PROGRAM_SCOPE_OPTIONS catalogue',
	);
	await click(programOptions.find((o) => o.textContent?.trim() === 'BEC') ?? null);
	assert.ok(fired.includes('program:REGULAR'), `choosing a program did not reach the page (got ${fired.join(',')})`);

	// (5) Each filter is a real combobox wired to its own listbox, so a keyboard
	// or screen-reader user reaches it the same way a mouse does.
	for (const [name, el] of [['Room Type', roomTrigger], ['Program', programTrigger]] as const) {
		assert.equal(el.getAttribute('role'), 'combobox', `${name} is not a real combobox trigger`);
		assert.ok(el.getAttribute('aria-controls'), `${name} is not wired to its listbox`);
	}
});

test('A3-C10: the six filters wrap instead of overflowing, Reset appears only when a filter is active, and the declared widths still fit 1366px', async () => {
	// FAILING-FIRST on the base in two places. (a) On the base the controls are
	// direct children of the `flex-nowrap` inline row, so there is no wrapping
	// cluster and the first assertion below is red. (b) The base's declared
	// widths are the six-control A3-C9 budget, so the `declared` list differs.
	//
	// LAYOUT HONESTY (AGENTS.md §11): jsdom has no layout engine. This asserts
	// the CLASS CONTRACT actually rendered plus arithmetic over the Tailwind
	// width classes those elements carry — it is not a measured pixel result,
	// and it is labelled as such rather than dressed up as a screenshot.
	const host = await render(
		<MemoryRouter><SubjectFilterToolbar {...EDITABLE} hasActiveFilters /></MemoryRouter>,
	);
	const row = query(host, 'admin-inline-filter-row');
	assert.ok(row, 'no single filter row');

	// (1) The shared inline row stays `flex-nowrap` (it is the sibling-owned
	// component and A3-15/A3-C9 both pin this), so the wrapping has to happen
	// in a cluster inside it — and it does.
	assert.equal(row.className.includes('flex-wrap'), false, 'the shared inline row was re-wrapped; that component is not owned here');
	const cluster = query(host, 'subjects-filter-cluster');
	assert.ok(cluster, 'the controls have no wrapping cluster, so a narrow viewport overflows the row horizontally');
	assert.ok(cluster.className.includes('flex-wrap'), 'the cluster does not wrap, so a narrow viewport overflows horizontally instead of wrapping');
	assert.ok(cluster.className.includes('min-w-0'), 'the cluster cannot shrink, so it overflows instead of wrapping');
	// No horizontal-overflow escape hatch anywhere in the toolbar: the fix is to
	// WRAP, not to hide the overflow behind a scroller.
	const toolbar = query(host, 'admin-search-filter-toolbar')!;
	for (const [name, el] of [['the row', row], ['the cluster', cluster], ['the toolbar', toolbar]] as const) {
		assert.equal(
			/h-\[|max-h-\[|overflow-y-auto|overflow-auto|overflow-x-auto|overflow-scroll/.test(el.className),
			false,
			`${name} became its own scroll region instead of wrapping`,
		);
	}
	// The filters and Reset wrap together rather than only some of them.
	// A5 RETARGET (recorded, not deleted): the six filters are now five
	// controls, because the duplicate status dropdown was merged into
	// `Filter by subject subject status` (items 9.1 + 41).
	//
	// A5 C7 ITEM 43, SUPERSEDING A5 C4's SPLIT. A5 C4 asserted two of the five
	// directly in the cluster and the other three "inside the one disclosure the
	// cluster itself contains". Item 43 removes the disclosure, so all five are in the
	// cluster and this loop is whole again — which is the ORIGINAL A3-C10 form. The
	// superseded split is recorded verbatim:
	//   for (const label of [<Grade>, <Program>]) {
	//     assert.ok(cluster.contains(byLabel(host, label) as Node), ...);
	//   }
	//   await openMoreFilters();
	//   const clusterDisclosure = document.body.querySelector('[data-radix-popper-content-wrapper]');
	//   for (const label of [<Status>, <Term>, <Room>]) {
	//     assert.ok(clusterDisclosure!.contains(byLabel(host, label) as Node), ...);
	//   }
	for (const label of [
		'Filter by grade level: All grades',
		'Filter by program scope: All programs',
		'Filter by subject status: All statuses',
		'Filter by rotation term: All terms',
		'Filter by room type: All room types',
	]) {
		assert.ok(cluster.contains(byLabel(host, label) as Node), `filter "${label}" is not in the wrapping cluster`);
	}
	assert.ok(cluster.contains(query(host, 'subjects-reset-filters') as Node), 'Reset is not in the wrapping cluster');

	// (2) The WIDTH BUDGET is read FROM THE RENDERED CLASS NAMES, not from a
	// restatement of the design, so editing a trigger's width without editing
	// this list is caught. A5-C3 REBASELINE: the five filters no longer carry
	// five different widths (`w-40 / w-24 / w-28 / w-36 / w-28`) — that unevenness
	// was the operator's complaint — they all carry the ONE shared `w-32` from
	// `@/ui/picker-trigger`, which is 8rem. search w-[240px] = 240.
	//
	// A5 C4, RE-POINTED AND RE-ARITHMETICKED. The row now declares TWO filter
	// widths, not five, because three of the filters moved behind the one
	// `More filters` disclosure — and a disclosure's own width is text, not a
	// fixed rectangle, so it is not part of this budget at all. Every number below
	// is recomputed from the controls that are actually in the row:
	//   240 (search) + 10 (its gap) + 2 x 128 (Grade, Program)
	//     + 20 (two cluster gaps) + ~150 (the `More filters` label) + 80 (Reset)
	//   = ~628px against ~1062px available.
	// The row therefore has MORE slack than it had with five filters, not less —
	// which is the §11 rule-3 subtraction made arithmetic. The numbers were
	// recomputed; none was loosened to make the guard pass, and the guard below
	// (`total < available`) is still load-bearing.
	// A5 C7 ITEM 43, RE-ARITHMETICKED, and A5 C4's conclusion OVERTURNED.
	//
	// A5 C4 rebaselined this budget for TWO filters in the row plus a disclosure sized
	// by its own label, and concluded — in its own words — that the row has "MORE slack
	// than it had with five filters, not less, which is the §11 rule-3 subtraction made
	// arithmetic". The ARITHMETIC was right and the CONCLUSION was wrong, and it is
	// worth recording why rather than quietly replacing the number: the slack was
	// bought with REACHABILITY, not with space. Three filters moved off the screen and
	// a `(n)` badge appeared, and the arithmetic counted the badge as a saving because a
	// badge's width is small. §11 rule 4 counts controls a scheduler must FIND, and
	// A5 C4's budget measured controls that were on screen. Item 43 is the correction.
	//
	// A5 C7 CORRECTION ROUND 1 SUPERSEDES ROUND 0'S `5 × 128` TERM. Round 0 put all
	// five on the fixed `md` variant (`w-32`) and added them up; the browser then showed
	// that `Room: Laboratory` overflowed its 128px rectangle by 10px and that fourteen
	// faces exceeded `md`'s published 12-character budget. A constant SMALLER than its
	// content is not a budget, it is a clipping instruction — so the width is now the
	// `auto` variant and the five triggers contribute NO FIXED TERM at all.
	//
	// What is left is the part of the row that is genuinely fixed — the 240px search
	// box, the two gaps, and `Reset` — plus the rule that covers the rest: a
	// content-sized trigger that grows past the line is handled by the cluster's
	// `flex-wrap`, never by a scroller (§8's no-scrollbar rule).
	//
	// ONE TAILWIND SCALE, APPLIED TO EVERY TERM. `gap-<n>` and `px-<n>` are `n * 4px`.
	// The earlier `rem(n) = n * 16` helper was correct for `w-*` ONLY because its
	// caller divided by 4 first, and it was applied unchanged to `gap-*` and `px-*` —
	// which inflated the budget by 120px and reported a row that genuinely fits one
	// line as 69px too wide. A budget computed on a wrong scale is worse than none:
	// it reads as authoritative and is not, and the obvious response to a phantom
	// overrun is to shrink real controls. One helper, `u()`, for every term.
	const u = (n: number) => n * 4;
	const searchWrapper = document.body.querySelector('input[placeholder="Search name or code..."]')!.parentElement!;
	assert.match(searchWrapper.className, /w-\[240px\]/, 'the search box is not the fixed compact width the one-row budget depends on');
	assert.match(searchWrapper.className, /max-w-\[240px\]/, 'the search box can still grow past the compact width');
	// A5 C7 ROUND 1: all five are content-sized, so what is asserted is the VARIANT,
	// not a number. `w-<n>` with a digit in it is the round-0 shape and is exactly what
	// produced the clipping, so it is rejected by name as well as by value.
	const declared = Array.from(row.querySelectorAll('[role="combobox"]'));
	assert.deepEqual(
		declared.map((el) => (el.className.match(/(?:^|\s)w-[\w-]+/) ?? ['NONE'])[0].trim()),
		['w-auto', 'w-auto', 'w-auto', 'w-auto', 'w-auto'],
		'the five filters are not all on the shared content-sized `auto` width variant',
	);
	for (const el of declared) {
		assert.doesNotMatch(
			el.className,
			/(^|\s)w-(\d+|full|px)(\s|$)/,
			`a filter trigger is back on a fixed rectangle: ${el.getAttribute('aria-label')}`,
		);
	}
	// A5-C3 CORRECTION ROUND 1 (B2) is preserved as history: this row's earlier text
	// claimed the row "is no longer required to fit ONE line at 1366" and quoted a
	// `w-52` / 13rem / 1420px budget, all three of which were wrong. That correction
	// round also DELETED the `total < available` guard and replaced it with a
	// tautology. The guard is restored below and stays load-bearing.
	//
	// The gap and `Reset` terms are READ from their rendered class names rather than
	// restated, for the same reason the widths are: a budget that restates the design
	// it is checking has stopped checking it. `Reset`'s label term is the one A5 C4's
	// `disclosureLabel` stood in for — a control whose width is its own text — and it
	// moved from a disclosure to `Reset`, so it is re-measured from `Reset` now.
	const clusterGap = /(^|\s)gap-(\d+)((?:\.5)?)(?:\s|$)/.exec(cluster.className);
	assert.ok(clusterGap, `the cluster declares no \`gap-*\`, so the budget is not decidable: ${cluster.className}`);
	const clusterGapPx = u(Number(clusterGap[2])) * (clusterGap[3] ? 1.5 : 1);
	const resetEl = query(host, 'subjects-reset-filters');
	assert.ok(resetEl, 'Reset is not in the row while a filter is active');
	const resetPad = /(^|\s)px-(\d+)(\s|$)/.exec(resetEl.className);
	assert.ok(resetPad, `Reset declares no \`px-*\`, so the budget is not decidable: ${resetEl.className}`);
	const reset = (resetEl.textContent ?? '').length * 7 + 2 * u(Number(resetPad[2]));
	const search = 240;
	const gaps = u(2); // the shared inline row's own gap, between search and cluster.
	const CHILD_GAPS = 5; // five pickers plus Reset = six children, so five gaps.
	/* THE FIXED PART OF THE ROW ONLY. Round 0 added `declared` in here as 5 × 128;
	 * under `auto` the pickers contribute nothing fixed, so what remains is the search
	 * box, the two gaps and `Reset`. That is the honest budget: it is the part that
	 * cannot shrink, and it is the part a future edit could grow without anyone
	 * noticing.
	 */
	const fixedTotal = search + gaps + CHILD_GAPS * clusterGapPx + reset;
	// The `available` figure round 0 RESTATED as `1366 - 256 - 40 - 8` is corrected
	// here to the MEASURED containing width from the 1366x768 capture: 1060px. The
	// restatement was plausible and wrong, and a plausible arithmetic constant is
	// worse than none — it reads as measured. The measured number, and where it comes
	// from (the admin content shell's horizontal padding inside a 1366px viewport),
	// is recorded in `docs/reviews/a5-c7-subjects-20260929/`.
	const available = 1060;
	// The budget must still be a BOUNDED, DECLARED number: one search box, the two
	// gaps, five cluster gaps and one `Reset`. If a page adds a term, this stops being
	// decidable from source and says so.
	assert.equal(declared.length, 5, `the filter cluster renders ${declared.length} triggers, not the five controls this budget accounts for`);
	assert.equal(
		new Set(declared.map((el) => el.className)).size,
		1,
		'the five filters no longer render the SAME trigger class list, so they are no longer one look per §8',
	);
	// The guard the A5 C3 correction round had deleted, restored and still
	// load-bearing — restated for what it now bounds. Round 0's version asked whether
	// the row's total fit; this one asks whether the row's FIXED part leaves room for
	// at least one whole filter face, which is the property that survives a
	// content-sized width.
	//
	// A5 C7 NOTE: the remedy text once ended "or moving a filter into `More`", which
	// A5 C4 made true and item 43 made false by removing the disclosure. The remaining
	// remedies are unchanged, and the guard is unchanged in kind: the row still must
	// not be made to fit by shrinking the font or narrowing a trigger ad hoc.
	const SHORTEST_FACE_PX = 10 * 6.6 + 2 * u(3) + 20; // 10 chars, `px-3` both sides, chevron.
	assert.ok(
		fixedTotal + SHORTEST_FACE_PX < available,
		`the row's fixed terms (${fixedTotal}px) plus one shortest filter face (${SHORTEST_FACE_PX}px) do not fit ` +
			`the ${available}px the row actually has at 1366x768. The search box, the gaps or Reset have grown; ` +
			'that is a design signal, not something to answer by shrinking the font.',
	);
	// Still no horizontal escape hatch: the row wraps, it never scrolls sideways.
	assert.equal(
		/overflow-x-auto|overflow-scroll|overflow-auto/.test(cluster.className),
		false,
		'the cluster hides the overflow behind a scroller instead of wrapping',
	);
});

test('A3-C10: Reset is offered only while a filter is active', async () => {
	// "Show Reset only when filters are active" (FIX-15). `hasActiveFilters` is
	// owned by the page and already counts the room-type and program-scope
	// values; the toolbar's half of the contract is that it renders the control
	// only when that flag is true. Asserted on BOTH values, because a control
	// that is always rendered passes a one-sided control.
	const off = await render(<MemoryRouter><SubjectFilterToolbar {...EDITABLE} hasActiveFilters={false} /></MemoryRouter>);
	// Boolean comparison on purpose: `assert.equal(<dom node>, null)` builds an
	// assert diff of the node and blows up jsdom instead of reporting the message.
	assert.equal(query(off, 'subjects-reset-filters') === null, true, 'Reset is offered with no filter active');
	const on = await render(<MemoryRouter><SubjectFilterToolbar {...EDITABLE} hasActiveFilters /></MemoryRouter>);
	assert.ok(query(on, 'subjects-reset-filters'), 'Reset is not offered while a filter is active');
	await click(query(on, 'subjects-reset-filters'));
});

test('A3-C9 [SUPERSEDED IN PART by A3-C10 on the width budget, verbatim otherwise]: the single filter row fits 1366px by its declared widths and cannot introduce page scroll', async () => {
	// FAILING-FIRST on the base: the base declares a `sm:max-w-sm` (24rem)
	// search box, so the first budget assertion below is red on `a7ccb738`
	// (24rem + six controls + gaps > the space 1366px leaves).
	//
	// A3-C10 SUPERSESSION (recorded, not deleted): this control's DECLARED
	// WIDTHS and its `gaps` count are superseded, because FIX-15 re-issued
	// added a sixth filter in place of the single combined catalog trigger, so
	// the budget is now six fixed-width controls + a compact `Reset` in a
	// wrapping cluster. The rebaselined budget lives in
	//   'A3-C10: the six filters wrap instead of overflowing, Reset appears
	//    only when a filter is active, and the declared widths still fit 1366px'
	// and it is STRICTER than this one was: it asserts the same class-derived
	// width list, plus that the sum still fits, plus that the cluster wraps and
	// that nothing in the toolbar became a scroller. What A3-09/C9 protected
	// here — the row is not a scroll region, the row can shrink, the search box
	// keeps its narrowed width, the toolbar grew no height/overflow constraint —
	// is still asserted below, verbatim and unweakened.
	const host = await render(
		<MemoryRouter><SubjectFilterToolbar {...EDITABLE} hasActiveFilters /></MemoryRouter>,
	);
	const row = query(host, 'admin-inline-filter-row');
	assert.ok(row, 'no single filter row');
	assert.equal(/h-\[|max-h-\[|overflow-y-auto|overflow-auto/.test(row.className), false, 'the filter row became its own scroll region');

	assert.ok(row.className.includes('min-w-0'), 'the filter row cannot shrink, so it can overflow the page instead of fitting');

	// The width budget is read FROM THE RENDERED CLASS NAMES, not from a
	// restatement of the design, so editing a trigger's width without editing
	// this number is caught.
	const rem = (n: number) => n * 16;
	const toolbar = query(host, 'admin-search-filter-toolbar')!;
	const searchWrapper = document.body.querySelector('input[placeholder="Search name or code..."]')!.parentElement!;
	assert.match(searchWrapper.className, /w-\[240px\]/, 'the search box is not the fixed compact width the one-row budget depends on');

	// A5-C3 REBASELINE, corrected in CORRECTION ROUND 1 (B2).
	//
	// BEFORE: five controls at five different widths (status w-40 = 10rem, grade
	// w-24 = 6rem, program w-28 = 7rem, room type w-36 = 9rem, term w-28 = 7rem),
	// which summed to 1004px and fitted one line at 1366.
	//
	// AFTER: all five carry the ONE shared `w-32` = 8rem = 128px, because the
	// unevenness was the operator's complaint and R1 J3 settles it. That sums to
	// 640px, and with the search box, the gaps and Reset the row is
	//   240 + 10 + 640 + 40 + 80 = 1020px against ~1062px available at 1366.
	//
	// The correction round found this row claiming `w-52` / 13rem / 1420px and saying
	// the row "is allowed to wrap" — a false premise, since the width it pins three
	// lines below is `rem(8)`. It had also DELETED the `search` / `gaps` / `reset` /
	// `total` / `available` locals and with them the `assert.ok(total < available)`
	// guard, replacing it with a tautology. All of that is restored below.
	//
	// With the shipped `w-32` the row FITS one line with 42px to spare, so the
	// restored guard passes. It stays load-bearing: if a future width or label makes
	// the row stop fitting, that is a design signal for the planner, not a line to
	// delete. The separate half of the contract — that no LABEL truncates — is
	// measured in a real browser by the planner's rendered row (`scrollWidth <=
	// clientWidth`), because no class list can decide it.
	// A5 C7 ITEM 43, RE-ARITHMETICKED — the same correction as the A3-C10 block above,
	// and recorded here for the same reason: A5 C4 rebaselined this budget for TWO
	// filters plus a text-sized disclosure. Superseded verbatim:
	//   const declared = [...Array.from(row.querySelectorAll('[class*="w-"]'))]...;
	//   assert.deepEqual(declared, [rem(8), rem(8), rem(8), rem(8), rem(8)], ...);
	//   const gaps = 6 * 10;   → 3 * 10, and the disclosure's label width is added.
	//   const disclosureLabel = 'More filters'.length * 7 + 14 + 24;
	// The disclosure carried no `w-<n>` class at all — it was sized by its own text —
	// so A5 C4 read that width from the rendered label rather than assuming it. Item 43
	// replaces that term with `Reset`'s, measured from `Reset` the same way.
	//
	// A5-C3 CORRECTION ROUND 1 (B2) is preserved as history: the earlier text claimed
	// the row "is allowed to wrap" and quoted a `w-52` / 13rem / 1420px budget, and the
	// correction round DELETED the `search`/`gaps`/`reset`/`total`/`available` locals and
	// with them the `assert.ok(total < available)` guard, replacing it with a tautology.
	// All of that is restored below. Nothing was loosened to make the guard pass.
	//
	// A5 C7 ROUND 1, and this row now agrees with A3-C10's budget above for the same
	// three reasons: the pickers are content-sized so they contribute no fixed term;
	// `available` is the MEASURED 1060px rather than a restatement; and the guard
	// bounds the row's fixed part rather than its total. The two rows are kept as a
	// pair deliberately — one edit must not be able to move both numbers at once.
	const u = (n: number) => n * 4; // `gap-<n>` and `px-<n>` are `n * 4` px.
	// A5 C7: the gap and `Reset` terms are READ from their rendered class names, so
	// the cluster is resolved here rather than restated from the design.
	const cluster = query(host, 'subjects-filter-cluster');
	assert.ok(cluster, 'the wrapping filter cluster is gone');
	const declared = Array.from(row.querySelectorAll('[role="combobox"]'));
	assert.deepEqual(
		declared.map((el) => (el.className.match(/(?:^|\s)w-[\w-]+/) ?? ['NONE'])[0].trim()),
		['w-auto', 'w-auto', 'w-auto', 'w-auto', 'w-auto'],
		'the five filters are not all on the shared content-sized `auto` width variant',
	);
	for (const el of declared) {
		assert.doesNotMatch(
			el.className,
			/(^|\s)w-(\d+|full|px)(\s|$)/,
			`a filter trigger is back on a fixed rectangle: ${el.getAttribute('aria-label')}`,
		);
	}
	// ONE trigger class list across all five is the §8 claim that survives a
	// content-sized width — and it is a STRONGER claim than "one width number",
	// because a single number can be right for five short faces and wrong for one
	// long one, which is exactly what round 0 measured.
	assert.equal(
		new Set(declared.map((el) => el.className)).size,
		1,
		`the five filters render ${new Set(declared.map((el) => el.className)).size} different trigger class lists, which is the unevenness R1 J3 removed`,
	);
	// The guard the correction round had deleted, restored and still load-bearing.
	const clusterGap = /(^|\s)gap-(\d+)((?:\.5)?)(?:\s|$)/.exec(cluster.className);
	assert.ok(clusterGap, `the cluster declares no \`gap-*\`, so the budget is not decidable: ${cluster.className}`);
	const clusterGapPx = u(Number(clusterGap[2])) * (clusterGap[3] ? 1.5 : 1);
	const resetEl = query(host, 'subjects-reset-filters');
	assert.ok(resetEl, 'Reset is not in the row while a filter is active');
	const resetPad = /(^|\s)px-(\d+)(\s|$)/.exec(resetEl.className);
	assert.ok(resetPad, `Reset declares no \`px-*\`, so the budget is not decidable: ${resetEl.className}`);
	const search = 240;
	const gaps = u(2); // the shared inline row's own gap, between search and cluster.
	const CHILD_GAPS = 5; // five pickers plus Reset = six children, so five gaps.
	const reset = (resetEl.textContent ?? '').length * 7 + 2 * u(Number(resetPad[2]));
	const fixedTotal = search + gaps + CHILD_GAPS * clusterGapPx + reset;
	const available = 1060; // MEASURED at 1366x768; see the note in A3-C10's budget above.
	const SHORTEST_FACE_PX = 10 * 6.6 + 2 * u(3) + 20;
	assert.ok(
		fixedTotal + SHORTEST_FACE_PX < available,
		`the row's fixed terms (${fixedTotal}px) plus one shortest filter face (${SHORTEST_FACE_PX}px) do not fit ` +
			`the ${available}px the row actually has at 1366x768. The search box, the gaps or Reset have grown; ` +
			'that is a design signal, not something to answer by shrinking the font.',
	);
	assert.equal(
		declared.length,
		5,
		`the filter cluster renders ${declared.length} triggers, not the five controls this budget accounts for`,
	);
	// The root is a plain block flow inside the admin frame: it adds no fixed
	// height and no overflow, so it cannot spawn a global scrollbar.
	assert.equal(/h-\[|max-h-\[|overflow-y-auto|overflow-auto/.test(toolbar.className), false, 'the toolbar gained a height/overflow constraint');
});

// ===========================================================================
// A3-C9 — item 3: the Term filter, derived from the real data and wired in.
// ===========================================================================
test('A3-C9: the term options are derived from the real subject data, never a hard-coded term count', async () => {
	// The fixture is a four-subject catalog with exactly two ranked terms, one
	// rotating subject and one subject with no rotation term. A hard-coded
	// `Term 1 / Term 2 / Term 3` would offer a term no subject has and would
	// omit the "rotates" and "no term set" cases entirely.
	const catalog: TermSubject[] = [
		subjectFixture({ id: 1, rotationTermRank: 2, rotationTermLabel: 'Term 2' }),
		subjectFixture({ id: 2, rotationTermRank: 1, rotationTermLabel: 'Term 1' }),
		subjectFixture({ id: 3, rotationTermRank: 1, rotationTermLabel: 'Term 1', rotationTermGroupId: 'GRP-A', rotationTermCount: 3 }),
		subjectFixture({ id: 4, rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null }),
	];

	const options = buildTermFilterOptions(catalog);
	assert.deepEqual(
		options.map((o) => o.value),
		['all', 'rank:1', 'rank:2', 'rotating', 'unset'],
		'the option list is not derived from the data it was given',
	);
	// Ranked, not catalog order: rank 1 precedes rank 2 even though the catalog
	// returned Term 2 first.
	assert.deepEqual(options.map((o) => o.label), ['All terms', 'Term 1', 'Term 2', 'Rotates by term', 'No term set']);
	// No third term is invented, and the "rotates" / "no term set" options are
	// present only because the data has such subjects.
	assert.equal(options.some((o) => o.label === 'Term 3'), false, 'a term the data does not carry was offered');

	// A catalog with NO unset subject and NO rotation drops those two options,
	// so the list never grows a choice that would match nothing.
	const clean = buildTermFilterOptions([
		subjectFixture({ rotationTermRank: 1, rotationTermLabel: 'Term 1' }),
		subjectFixture({ rotationTermRank: 1, rotationTermLabel: 'Term 1' }),
	]);
	assert.deepEqual(clean.map((o) => o.value), ['all', 'rank:1']);
});

test('A3-C9: the term filter really filters, and a subject with no term is still reachable', async () => {
	const rotating = subjectFixture({ id: 3, rotationTermRank: 1, rotationTermLabel: 'Term 1', rotationTermGroupId: 'GRP-A', rotationTermCount: 3 });
	const unset = subjectFixture({ id: 4, rotationTermRank: null, rotationTermLabel: null, rotationTermGroupId: null, rotationTermCount: null });
	const firstTermOnly = subjectFixture({ id: 5, rotationTermRank: 1, rotationTermLabel: 'Term 1' });
	const secondTerm = subjectFixture({ id: 2, rotationTermRank: 2, rotationTermLabel: 'Term 2' });
	const catalog: TermSubject[] = [firstTermOnly, rotating, secondTerm, unset];

	// "All terms" matches every subject, INCLUDING the one with no term. That
	// is the first half of the obligation.
	const all = catalog.filter((s) => matchesTermFilter(s, 'all'));
	assert.equal(all.length, 4, '"All terms" dropped a subject');

	// A term option matches by key, and catches both the plain and the rotating
	// subject that sit in that term.
	const termOne = catalog.filter((s) => matchesTermFilter(s, 'rank:1'));
	assert.deepEqual(termOne.map((s) => s.id).sort(), [3, 5]);

	// "Rotates by term" is its own question, answerable by no term option.
	const rotatingOnly = catalog.filter((s) => matchesTermFilter(s, 'rotating'));
	assert.deepEqual(rotatingOnly.map((s) => s.id), [3]);

	// THE FINDING THIS EXISTENCE CHECK EXISTED TO AVOID: a subject with no
	// rotation term is reachable by "All terms" AND by an explicit choice. If
	// the `unset` option were dropped, this subject would become unfindable
	// the moment an operator chose any term, and the table would report "no
	// matches" for a subject that exists.
	const unsetOnly = catalog.filter((s) => matchesTermFilter(s, 'unset'));
	assert.deepEqual(unsetOnly.map((s) => s.id), [4], 'a subject with no rotation term is unreachable by any explicit option');
	assert.equal(
		catalog.filter((s) => matchesTermFilter(s, 'rank:2')).some((s) => s.id === 4),
		false,
		'a subject with no rotation term leaked into a term it does not belong to',
	);
});

test('A3-C9: the toolbar renders the term filter and reports a chosen term to the page', async () => {
	// FAILING-FIRST on the base: no "Filter by rotation term" control exists
	// there, so `byLabel` is null and this test is red on `a7ccb738`.
	const fired: string[] = [];
	const host = await render(
		<MemoryRouter>
			<SubjectFilterToolbar {...EDITABLE} onTermFilterChange={(v) => fired.push(`term:${v}`)} />
		</MemoryRouter>,
	);

	// A5 C4, RE-POINTED: the term filter is one of the three refinements behind the
	// one `More filters` disclosure, so it is opened first. Nothing below is
	// weakened — the option list, and the value a chosen term delivers, are
	// asserted exactly as before.
	await openMoreFilters();
	const trigger = byLabel(host, 'Filter by rotation term: All terms');
	assert.ok(trigger, 'the term filter is not rendered');
	assert.equal(trigger.getAttribute('role'), 'combobox');
	assert.ok(trigger.getAttribute('aria-controls'), 'the term trigger is not wired to its listbox');

	const listbox = await openFilter('Filter by rotation term: All terms', 'rotation term');
	// The options are exactly the derived list, so the toolbar can never offer
	// a term the derivation did not produce.
	assert.deepEqual(
		Array.from(listbox.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim()),
		['All terms', 'Term 1', 'Term 2', 'Rotates by term', 'No term set'],
		'the term options rendered are not the derived list',
	);

	const option = Array.from(listbox.querySelectorAll('[role="option"]')).find((o) => o.textContent?.trim() === 'Rotates by term');
	await click(option ?? null);
	assert.ok(fired.includes('term:rotating'), `choosing a term did not reach the page (got ${fired.join(',')})`);
});

test('A3-C9: the Subjects page filters, resets and reports the term through the existing pipeline', async () => {
	// Source-level, because `Subjects.tsx` is a page that needs a router, an
	// actor school scope and an API to mount. It is a wiring control, NOT a
	// substitute for the behavioural controls above: it exists to prove the
	// filter is not a rendered `<Select>` that changes nothing. Its
	// discriminating assertions are the four that name the shared predicate,
	// the derived options, `hasActiveFilters` and the reset.
	const page = source('src/pages/Subjects.tsx');
	const bare = code('src/pages/Subjects.tsx');

	// Filters with the shared predicate, not with an inline re-implementation.
	assert.match(bare, /if \(termFilter !== TERM_FILTER_ALL\) list = list\.filter\(\(s\) => matchesTermFilter\(s, termFilter\)\)/);
	assert.equal(/list\.filter\(\(s\) => s\.rotationTerm/.test(bare), false, 'the page re-implements the term rule inline');

	// Options come from the derivation, and the same value is offered to the
	// toolbar, so the two cannot disagree.
	assert.match(bare, /const termOptions = useMemo\(\(\) => buildTermFilterOptions\(subjects\), \[subjects\]\)/);
	assert.match(bare, /termOptions=\{termOptions\}/);
	assert.match(bare, /termFilter=\{termFilter\}/);
	assert.match(bare, /onTermFilterChange=\{setTermFilter\}/);

	// It participates in `hasActiveFilters`, otherwise "Reset filters" would
	// never appear for a term-only filter and the filter would be a trap.
	assert.match(bare, /\|\| termFilter !== TERM_FILTER_ALL/);
	// It resets with the others, and it resets the page number, so a stale page
	// index cannot leave the operator on an empty page.
	assert.match(bare, /setTermFilter\(TERM_FILTER_ALL\)/);
	assert.match(bare, /termFilter, pageSize\]\);/);
	// It is a dependency of the filter pipeline itself, so it survives a
	// pagination or sort change.
	// A5 RETARGET (recorded, not deleted): the term filter is still a
	// dependency of the pipeline; the dependency list now names the one merged
	// `subjectStatusFilter` (items 9.1 + 41) in place of the two status states.
	assert.match(bare, /subjectStatusFilter, roomTypeFilter, gradeLevelFilter, programScopeFilter, termFilter, coverageBySubjectId/);

	// The removed disclosure state is gone from the page too, not just ignored.
	assert.equal(/\bshowFilters\b/.test(bare), false, 'Subjects.tsx still carries the removed showFilters state');
	assert.equal(/onToggleFilters/.test(bare), false, 'Subjects.tsx still wires the removed disclosure toggle');

	// The header strip is gone AND the contract has a non-header home: the
	// footer of the table the contract describes.
	//
	// A5 C4, RE-POINTED — NOT DELETED. Both assertions below are unchanged, but
	// the block they search MOVED: the catalog body (table shell, mobile list,
	// pagination footer, empty state) is now `SubjectCatalogBody.tsx`, a component
	// the page composes. A pin on a file the change is DESIGNED to move is not a
	// pin to preserve by keeping the code in place, so the search is widened to the
	// page AND its catalog body, and the page-only half is kept as its own
	// assertion so the two can be told apart. What this protects — the routine
	// year-and-terms contract is NOT gone, and its non-header home is the table
	// footer — is exactly as protected as before.
	const { readFileSync } = await import('node:fs');
	const { resolve: resolvePath } = await import('node:path');
	const catalogBody = readFileSync(
		resolvePath(import.meta.dirname, '../SubjectCatalogBody.tsx'),
		'utf8',
	);
	const bareAndBody = `${bare}\n${catalogBody}`;
	assert.match(bareAndBody, /<SubjectTermContractPopover termAuthority=\{termAuthority\} \/>/);
	assert.match(bareAndBody, /leading=\{<SubjectTermContractPopover/);
	// AND the page itself still owns the contract data: the popover reads the SAME
	// `termAuthority` the page holds, passed down as a prop, so the two cannot drift
	// onto different authorities.
	assert.match(bare, /termAuthority=\{termAuthority\}/);
	assert.match(catalogBody, /termAuthority: TermAuthority \| null;/);
});

test('A3-C9: the subject grade column is colour-coded exactly like the Teachers table', async () => {
	// FAILING-FIRST on the base: the base renders ONE uncoloured
	// `<span className="text-sm font-semibold text-foreground">GR9, GR10</span>`
	// and no `subject-grade-chips`, so both of the first two assertions are red
	// on `a7ccb738`.
	const host = await render(
		<SubjectRow
			subject={subjectFixture({ gradeLevels: [9, 10] })}
			timeMode="hours"
			onEdit={() => {}}
			onDelete={() => {}}
			onArchive={() => {}}
			onReactivate={() => {}}
			onShowCoverage={() => {}}
		/>,
	);

	const chips = query(host, 'subject-grade-chips');
	assert.ok(chips, 'the grade column still renders an uncoloured string');
	// One chip per grade, so the colour meaning is visible per grade.
	const rendered = Array.from(chips.querySelectorAll('span'));
	assert.deepEqual(rendered.map((c) => c.textContent), ['9', '10'], 'the grade chips do not convey every grade');

	// The SAME palette, from the SAME token source, as the Teachers table. This
	// is the assertion that stops a second grade palette appearing: the classes
	// below are read out of `@/lib/grade-labels`, which is what
	// `FacultyAssignedGradeChips` uses, and they are the DepEd-correct four
	// (G8 YELLOW, never amber).
	const palette = source('src/lib/grade-labels.ts');
	for (const [grade, family] of [[9, 'red'], [10, 'blue']] as const) {
		const token = new RegExp(`'${grade}': 'bg-${family}-100/80 text-${family}-700'`).exec(palette);
		assert.ok(token, `GRADE_COLORS[${grade}] is not the DepEd ${family} token`);
		assert.ok(
			rendered[grade === 9 ? 0 : 1].className.includes(`bg-${family}-100/80`),
			`the GR${grade} chip does not carry the shared palette class`,
		);
	}
	assert.match(palette, /'8': 'bg-yellow-100\/80 text-yellow-700'/, 'G8 is not yellow; the warning family must not encode a grade');

	// The badge geometry matches the Teachers chip, not a bespoke one.
	for (const chip of rendered) {
		assert.match(chip.className, /inline-flex/);
		assert.match(chip.className, /h-4/);
		assert.match(chip.className, /min-w-4/);
		assert.match(chip.className, /rounded/);
		assert.match(chip.className, /font-bold/);
	}

	// INFORMATION CONTENT IS KEPT: the range wording is still the chips'
	// accessible name, so a multi-grade subject still announces every grade.
	assert.equal(chips.getAttribute('aria-label'), 'GR9, GR10');

	// A contiguous range still reads as a range to assistive tech.
	const ranged = await render(
		<SubjectRow
			subject={subjectFixture({ gradeLevels: [7, 8, 9, 10] })}
			timeMode="hours"
			onEdit={() => {}}
			onDelete={() => {}}
			onArchive={() => {}}
			onReactivate={() => {}}
			onShowCoverage={() => {}}
		/>,
	);
	assert.deepEqual(
		Array.from(query(ranged, 'subject-grade-chips')!.querySelectorAll('span')).map((c) => c.textContent),
		['7', '8', '9', '10'],
		'a four-grade subject no longer shows all four grades',
	);
	assert.equal(query(ranged, 'subject-grade-chips')!.getAttribute('aria-label'), 'GR7–GR10');

	// The one case the palette does not cover still renders a chip, in the
	// neutral token, rather than silently disappearing.
	const odd = await render(
		<SubjectRow
			subject={subjectFixture({ gradeLevels: [11] })}
			timeMode="hours"
			onEdit={() => {}}
			onDelete={() => {}}
			onArchive={() => {}}
			onReactivate={() => {}}
			onShowCoverage={() => {}}
		/>,
	);
	const oddChips = query(odd, 'subject-grade-chips');
	assert.ok(oddChips, 'a grade outside 7-10 was dropped instead of shown neutrally');
	assert.match(oddChips.querySelector('span')!.className, /bg-muted/);

	// And no grades at all is still the plain "No grades" sentence.
	const none = await render(
		<SubjectRow
			subject={subjectFixture({ gradeLevels: [] })}
			timeMode="hours"
			onEdit={() => {}}
			onDelete={() => {}}
			onArchive={() => {}}
			onReactivate={() => {}}
			onShowCoverage={() => {}}
		/>,
	);
	assert.ok(query(none, 'subject-grade-chips') === null, 'a subject with no grades rendered a chip group');
	assert.match(document.body.textContent ?? '', /No grades/);
});

test('A3-C9: SubjectRow still takes its grade colours from the ONE shared palette', async () => {
	// The AR2 watch item, enforced as a source control on the file this stream
	// changed. `SubjectRow` must import `GRADE_COLORS` from `@/lib/grade-labels`
	// — the same source `FacultyRow` uses — and must NOT reach for
	// `GradeLevelBadge`, whose own `GRADE_STYLES` map is the second palette a
	// previous pass in this lane had to delete. Hard-coding `bg-green-` /
	// `bg-yellow-` / `bg-red-` / `bg-blue-` in the row is the same defect.
	const bare = code('src/components/subjects/SubjectRow.tsx');
	assert.match(bare, /import \{ GRADE_COLORS \} from '@\/lib\/grade-labels'/, 'SubjectRow does not use the shared grade palette');
	assert.doesNotMatch(bare, /GradeLevelBadge/, 'SubjectRow imports the second grade palette');
	// The DEP-ED grade fills only, not every `bg-red-` in the file: the
	// "No coverage" badge legitimately carries its own `bg-red-50` and is not a
	// grade colour. What must not appear is a second copy of the grade palette.
	for (const literal of ['bg-green-100', 'bg-yellow-100', 'bg-red-100', 'bg-blue-100']) {
		assert.doesNotMatch(bare, new RegExp(literal), `SubjectRow hard-codes ${literal} instead of using the shared token`);
	}
	// The colour reaches the chip through the shared lookup, and the lookup is
	// the ONLY grade-colour expression in the grade cell.
	assert.match(bare, /GRADE_COLORS\[String\(grade\)\]/);
	assert.match(bare, /className=\{cn\(\s*'inline-flex h-4 min-w-4 items-center justify-center rounded px-1 text-\[0\.6rem\] font-bold leading-none',\s*GRADE_COLORS\[String\(grade\)\] \?\? 'bg-muted text-muted-foreground',\s*\)\}/);
	// The Teachers table is the reference, and it is unchanged by this stream.
	const teachers = code('src/components/faculty/FacultyRow.tsx');
	assert.match(teachers, /GRADE_COLORS\[String\(grade\)\]/, 'the Teachers grade chip no longer uses GRADE_COLORS; SubjectRow is no longer matching it');
});

test('A3-17: the coverage review surface is a centered, internally scrolling dialog', async () => {
	const host = await render(
		<MemoryRouter>
			<SubjectCoverageSheet
				subject={subjectFixture({ rotationFamily: 'SCIENCE' })}
				loading={false}
				detail={{ assigned: [{ facultyId: 7, name: 'Dela Cruz, Juan', grades: [9, 10], load: 80, sections: [{ id: 9, grade: 9, name: 'A' }] }], uncoveredGrades: [10], programScopes: ['REGULAR'] }}
				errorBySubjectId={new Map()}
				onRetry={() => {}}
				onClose={() => {}}
			/>
		</MemoryRouter>,
	);

	const dialog = query(host, 'subject-coverage-dialog');
	assert.ok(dialog, 'no coverage dialog rendered');
	// Centered — now by the shared primitive's FLEX PARENT rather than by a
	// `left-[50%] top-[50%]` translate. A transform computed for one size fights
	// a box the scheduler is resizing, so the translate anchor is the thing item
	// 23.2 removed; the wrapper re-centres at whatever size the box currently is.
	const centringWrapper = dialog.parentElement;
	assert.ok(centringWrapper, 'the coverage surface must be centred by a wrapper element');
	assert.equal(centringWrapper!.getAttribute('data-dialog-centering'), 'flex');
	assert.match(centringWrapper!.getAttribute('class') ?? '', /\bflex\b/);
	assert.doesNotMatch(dialog.className, /left-\[50%\]/, 'the translate centring anchor is back');
	// Not a side sheet.
	assert.equal(/inset-y-0|right-0/.test(dialog.className), false, 'the coverage surface is still anchored to an edge');
	// It owns its scroll, and it is bounded so it cannot push page scroll.
	// A5 RETARGET (recorded, not deleted): item 17.1(1) specified the dialog's
	// bounds as `min-w-[500px] max-w-[95vw] min-h-[420px] max-h-[90vh]` because
	// the card is now resizable, so the `90svh` cap became `90vh`. The property
	// this row protected — the dialog is height-bounded and cannot push page
	// scroll — is asserted on the new bound below, plus all four resize bounds.
	// A5 item 23.2 moved the resize mechanism itself to the shared primitive
	// (`data-resizable` + its two drag handles) and removed the page-local
	// `style={{ resize: 'both' }}`; the bounded-ness this row protects is
	// unchanged, and the primitive's own `max-h-[85vh]` cap now also applies.
	// The two page-local bounds this row used to pin here — `max-h-[90vh]` and
	// `min-w-[500px]` — are SUPERSEDED (recorded, not deleted) by item 23.2: they
	// passed through `cn()` and won over the shared `DIALOG_RESIZABLE_CLASSES`,
	// which silently un-applied the universal cap. The property this row protects
	// (the dialog is width- AND height-bounded, so it cannot push page scroll) is
	// unchanged and is now asserted on the bounds that actually govern it.
	assert.match(dialog.className, /max-h-\[85vh\]/, 'the resizable dialog can grow past the viewport height');
	assert.match(dialog.className, /min-w-\[min\(480px,95vw\)\]/, 'the resizable dialog has no minimum width bound');
	assert.match(dialog.className, /max-w-\[95vw\]/, 'the resizable dialog can grow past the viewport');
	assert.match(dialog.className, /min-h-\[420px\]/, 'the resizable dialog has no minimum height bound');
	assert.equal(dialog.getAttribute('data-resizable'), 'true', 'the coverage dialog must take the shared resizable contract');
	assert.notEqual(dialog.style.resize, 'both', 'the page-local CSS `resize: both` is back');
	assert.ok(
		dialog.querySelectorAll('[data-testid="dialog-resize-handle"]').length === 2,
		'the coverage dialog must render the shared left and right drag handles',
	);
	assert.match(dialog.className, /overflow-hidden/);
	const scroller = query(host, 'subject-coverage-scroll');
	assert.ok(scroller, 'no internal scroll region');
	assert.match(scroller.className, /flex-1/);
	assert.match(scroller.className, /min-h-0/);
	assert.match(scroller.className, /overflow-y-auto/, 'the dialog body does not scroll internally');
	// Content is present — the conversion did not empty the surface.
	assert.match(document.body.textContent ?? '', /Dela Cruz, Juan/);
	assert.match(document.body.textContent ?? '', /Open in Teaching Load/);
});

test('A3-17: Escape closes, the backdrop closes, and background scroll is locked while open', async () => {
	let closed = 0;
	await render(
		<MemoryRouter>
			<SubjectCoverageSheet
				subject={subjectFixture()}
				loading={false}
				detail={{ assigned: [], uncoveredGrades: [], programScopes: [] }}
				errorBySubjectId={new Map()}
				onRetry={() => {}}
				onClose={() => { closed += 1; }}
			/>
		</MemoryRouter>,
	);
	assert.ok(query(document.body, 'subject-coverage-dialog'), 'dialog did not open');

	// Background scroll is locked: react-remove-scroll (via DialogPortal) sets
	// overflow:hidden on the document element while a modal dialog is open.
	const htmlOverflow = dom.window.getComputedStyle(document.documentElement).overflow;
	const bodyOverflow = dom.window.getComputedStyle(document.body).overflow;
	assert.ok(
		htmlOverflow === 'hidden' || bodyOverflow === 'hidden' || document.body.hasAttribute('data-scroll-locked'),
		`background scroll is not locked while the dialog is open (html=${htmlOverflow}, body=${bodyOverflow})`,
	);

	// Escape closes.
	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	assert.equal(closed, 1, 'Escape did not close the coverage dialog');

	// Backdrop closes: click the overlay itself.
	await act(async () => { closed = 0; });
	const overlay = document.querySelector('div.fixed.inset-0');
	assert.ok(overlay, 'no overlay to click');
	await click(overlay);
	assert.equal(closed, 1, 'a backdrop click did not close the coverage dialog');
});

// ===========================================================================
// CHECK 5 / 6 — Fix 32 and Fix 33B round trips, asserted on the PAYLOAD.
// ===========================================================================
// A mutable holder, not a `let payload: T | null`. TypeScript's control-flow
// analysis does not see an assignment made inside a callback, so a `let` is
// still narrowed to `null` at the use site and every property access on it
// becomes `never` — the assertions would then be checking nothing.
async function saveEditFixture(overrides: Record<string, unknown>): Promise<SubjectFormValues | undefined> {
	const captured: { payload?: SubjectFormValues } = {};
	const host = await render(
		<SubjectFormModal
			open
			mode="edit"
			initialValues={subjectToFormValues(subjectFixture(overrides))}
			saving={false}
			onSave={async (values) => { captured.payload = values; return { status: 'saved' }; }}
			onClose={() => {}}
		/>,
	);
	await click(query(document.body, 'subjects-form-save'));
	return captured.payload;
}

test('A3-32: a subject whose room need is FACULTY_ROOM is not silently cleared on save', async () => {
	// A: the constant split is additive and correct.
	assert.equal(constants.ALL_ROOM_TYPES.length, 9, 'ALL_ROOM_TYPES lost a room type — the filter and the room map depend on it');
	for (const t of ['CLASSROOM', 'LABORATORY', 'COMPUTER_LAB', 'TLE_WORKSHOP', 'LIBRARY', 'GYMNASIUM', 'FACULTY_ROOM', 'OFFICE', 'OTHER']) {
		assert.ok(constants.ALL_ROOM_TYPES.includes(t as never), `ALL_ROOM_TYPES no longer offers ${t}`);
	}
	assert.equal(constants.SUBJECT_ROOM_NEED_TYPES.length, 7);
	assert.equal(constants.SUBJECT_ROOM_NEED_TYPES.includes('FACULTY_ROOM' as never), false, 'a Faculty Room is still offered as a subject room need');
	assert.equal(constants.SUBJECT_ROOM_NEED_TYPES.includes('OFFICE' as never), false, 'an Office is still offered as a subject room need');
	// The shared label record is untouched, so the room map keeps every type.
	assert.equal(Object.keys(constants.ROOM_TYPE_LABELS).length, 9);
	assert.equal(constants.ROOM_TYPE_LABELS.FACULTY_ROOM, 'Faculty Room');
	assert.equal(constants.ROOM_TYPE_LABELS.OFFICE, 'Office');

	// B: the round trip. FACULTY_ROOM is a legacy stored value; narrowing the
	// picker must not wipe it on the next save.
	const payload = await saveEditFixture({ preferredRoomType: 'FACULTY_ROOM' });
	assert.ok(payload, 'no save payload captured');
	assert.equal(payload.preferredRoomType, 'FACULTY_ROOM', 'a stored FACULTY_ROOM room need was silently cleared');

	// C: the Room Type FILTER still offers every room type. The toolbar maps
	// ALL_ROOM_TYPES (not the subject list) — assert on the real source, since
	// a Radix listbox is only mounted when opened.
	const toolbarSource = code('src/components/subjects/SubjectFilterToolbar.tsx');
	assert.match(toolbarSource, /ALL_ROOM_TYPES\.map\(\(t\)/, 'the Room Type filter stopped offering every room type');
	assert.equal(/SUBJECT_ROOM_NEED_TYPES/.test(toolbarSource), false, 'the Room Type filter was narrowed to the subject list');
});

test('A3-33B: a subject stored with a shared class session round-trips true through the new form', async () => {
	// The persisted shared-session fields. There is no `isSharedSession` column
	// in this schema — the stored attribute is `interSectionEnabled` (plus the
	// pooled `interSectionGradeLevels`), and that is what must survive.
	const payload = await saveEditFixture({ interSectionEnabled: true, interSectionGradeLevels: [9, 10] });
	assert.ok(payload, 'no save payload captured');
	assert.equal(payload.interSectionEnabled, true, 'the shared class session was silently cleared by the new form');
	assert.deepEqual(payload.interSectionGradeLevels, [9, 10], 'the pooled grade levels were lost');

	// The seeding path is unchanged too.
	const seeded = subjectToFormValues(subjectFixture({ interSectionEnabled: true, interSectionGradeLevels: [9, 10] }));
	assert.equal(seeded.interSectionEnabled, true);
	assert.deepEqual(seeded.interSectionGradeLevels, [9, 10]);

	// The page's PATCH body still sends both fields.
	const subjectsPage = code('src/pages/Subjects.tsx');
	assert.match(subjectsPage, /interSectionEnabled: values\.interSectionEnabled/);
	assert.match(subjectsPage, /interSectionGradeLevels: values\.interSectionGradeLevels/);

	// A subject WITHOUT a shared session is unaffected.
	const plain = await saveEditFixture({ interSectionEnabled: false, interSectionGradeLevels: [] });
	assert.equal(plain?.interSectionEnabled, false);
	assert.deepEqual(plain?.interSectionGradeLevels, []);
});

test('A3-33B: the shared-session control is gone; a stored one is disclosed read-only, not editable', async () => {
	const modalSource = code('src/components/subjects/SubjectFormModal.tsx');
	assert.equal(/onCheckedChange=\{\(v\) => setForm\(\(p\) => \(\{ \.\.\.p, interSectionEnabled/.test(modalSource), false, 'a shared-session switch still writes the value');
	assert.equal(/Shared class session<\/span>/.test(modalSource), false, 'the Shared class session control is still rendered');

	const host = await render(
		<SubjectFormModal
			open
			mode="edit"
			initialValues={subjectToFormValues(subjectFixture({ interSectionEnabled: true, interSectionGradeLevels: [9, 10] }))}
			saving={false}
			onSave={async () => ({ status: 'saved' })}
			onClose={() => {}}
		/>,
	);
	const notice = query(host, 'subjects-form-shared-session-readonly');
	assert.ok(notice, 'a stored shared session is not disclosed at all');
	assert.match(notice.textContent ?? '', /Shared class session is on/);
	// gradeLabel is the shared compact form: GR9 / GR10 (deped-glossary.gradeLong
	// is the "Grade 9" prose form, and is not what the form renders).
	assert.match(notice.textContent ?? '', /GR9, GR10/);
	// Read-only: no switch or button inside the notice.
	assert.equal(notice.querySelector('button'), null, 'the read-only notice offers an action');
	assert.equal(notice.querySelector('[role="switch"]'), null, 'the read-only notice offers a switch');
});

// ===========================================================================
// CHECK 4 — Fix 31: BEC is a label, REGULAR is still the value.
// ===========================================================================
test('A3-31: the rendered label reads BEC while the stored and transmitted value stays REGULAR', async () => {
	const regular = constants.PROGRAM_SCOPE_OPTIONS.find((o) => o.value === 'REGULAR');
	assert.ok(regular, 'the REGULAR program scope option disappeared');
	assert.equal(regular.value, 'REGULAR', 'the persisted enum value changed — this must never happen');
	assert.equal(regular.label, 'BEC', 'the operator-facing label is not BEC');

	// The value is what the form, the empty form and the create payload carry.
	assert.equal(constants.PROGRAM_SCOPE_BADGE.REGULAR, 'bg-sky-50 text-sky-700 border-sky-200', 'the REGULAR badge key moved');
	assert.deepEqual(constants.emptyForm.programScopes, ['REGULAR'], 'the default program scope value changed');

	const payloadSource = code('src/lib/subject-create-payload.ts');
	assert.match(payloadSource, /programScopes: values\.programScopes/, 'the create payload stopped forwarding programScopes');

	// Rendered: the form's program-coverage buttons read BEC, and activating it
	// puts the VALUE REGULAR into the form, not the string "BEC".
	const host = await render(
		<SubjectFormModal
			open
			mode="edit"
			initialValues={subjectToFormValues(subjectFixture({ programScopes: [] }))}
			saving={false}
			onSave={async () => ({ status: 'saved' })}
			onClose={() => {}}
		/>,
	);
	const bec = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'BEC');
	assert.ok(bec, 'the program coverage control does not render the BEC label');
	const reg = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Regular');
	assert.equal(reg, undefined, 'the old "Regular" label is still rendered somewhere in the form');
	assert.equal(bec!.getAttribute('aria-pressed'), 'false');
	await click(bec!);
	assert.equal(bec!.getAttribute('aria-pressed'), 'true');

	await click(query(host, 'subjects-form-save'));
	const payloadText = code('src/pages/Subjects.tsx');
	assert.match(payloadText, /programScopes: values\.programScopes/);
});

test('A3-31: a subject already scoped REGULAR submits REGULAR', async () => {
	const payload = await saveEditFixture({ programScopes: ['REGULAR'] });
	assert.deepEqual(payload?.programScopes, ['REGULAR'], 'the transmitted program scope is not REGULAR');
});

// ===========================================================================
// Fix 33A — the scheduling section is always visible; the stepper has no
// dangling 'advanced' and no phantom step.
// ===========================================================================
test('A3-33A: the scheduling-rules section is always rendered, with no disclosure', async () => {
	const modalSource = code('src/components/subjects/SubjectFormModal.tsx');
	assert.equal(/showAdvanced/.test(modalSource), false, 'the showAdvanced disclosure state still exists');
	assert.equal(/subjects-form-advanced-toggle/.test(modalSource), false, 'the "Show advanced" toggle is still rendered');
	assert.equal(/Skip if you are unsure/.test(modalSource), false, 'the "Skip if you are unsure" hint is still rendered');
	assert.equal(/setShowAdvanced/.test(modalSource), false, 'setShowAdvanced is still referenced');

	for (const mode of ['add', 'edit'] as const) {
		const host = await render(
			<SubjectFormModal
				open
				mode={mode}
				initialValues={mode === 'edit' ? subjectToFormValues(subjectFixture()) : undefined}
				saving={false}
				onSave={async () => ({ status: 'saved' })}
				onClose={() => {}}
			/>,
		);
		const section = query(host, 'subjects-form-scheduling-section');
		assert.ok(section, `the scheduling-rules section is missing in ${mode} mode`);
		// Rotates by term is the FIRST control of the section (A3-33B elevation).
		// The section mixes <span> and <label> headings, so scan both, in DOM
		// order, rather than only spans.
		const labels = Array.from(section.querySelectorAll('span, label')).map((s) => s.textContent?.trim());
		const rotatesAt = labels.findIndex((l) => l === 'Rotates by term');
		const featuresAt = labels.findIndex((l) => l === 'Required room features');
		assert.ok(rotatesAt >= 0, `"Rotates by term" is not in the ${mode}-mode scheduling section`);
		assert.ok(featuresAt > rotatesAt, `"Rotates by term" is not the first control in ${mode} mode (rotates@${rotatesAt}, features@${featuresAt})`);

		// The stepper's end state is deliberate: the terminal section is current.
		const stepper = query(host, 'subjects-form-stepper');
		assert.ok(stepper);
		const current = stepper.querySelector('[aria-current="step"]');
		assert.ok(current, 'the stepper has no current step');
		// aria-current sits on the numbered circle; the section NAME is its
		// sibling, so assert on the step item, not the circle.
		const currentStep = current.closest('li') ?? current;
		assert.match(currentStep.textContent ?? '', /Scheduling rules/, 'the stepper does not end on Scheduling rules');
		assert.equal(currentStep.querySelectorAll('[aria-current="step"]').length, 1);
		assert.equal(/Advanced/.test(stepper.textContent ?? ''), false, 'a phantom "Advanced" step is still in the stepper');
		await unmount();
	}
});

// ===========================================================================
// Fix 19 — the action menu is route-scoped: wide enough, and no wrapping.
// ===========================================================================
test('A3-19: the subject action menu is widened and non-wrapping at this call site only', async () => {
	// The shared primitive is untouched — that is the boundary.
	const primitive = code('src/ui/dropdown-menu.tsx');
	assert.match(primitive, /min-w-\[8rem\]/, 'the shared DropdownMenu primitive min-width was changed');
	assert.equal(/whitespace-nowrap/.test(primitive), false, 'whitespace-nowrap leaked into the shared primitive');

	const host = await render(
		<MemoryRouter>
			<table><tbody>
				<SubjectRow
					subject={subjectFixture()}
					timeMode="hours"
					coverageRow={{
						subjectId: 41,
						subjectCode: 'SCI10',
						subjectName: 'Earth Science',
						isActive: true,
						relevantSectionCount: 2,
						ownedSectionCount: 2,
						ownedByPlaceholderCount: 0,
						ownedByRealFacultyCount: 2,
						uncoveredSectionCount: 0,
						uncoveredSections: [],
						coveragePercent: 100,
						status: 'FULL',
						placeholderFacultyIds: [],
					}}
					onEdit={() => {}}
					onDelete={() => {}}
					onArchive={() => {}}
					onReactivate={() => {}}
					onShowCoverage={() => {}}
				/>
			</tbody></table>
		</MemoryRouter>,
	);

	const trigger = byLabel(host, 'More subject actions for Earth Science');
	assert.ok(trigger, 'the row action menu trigger is missing');
	await click(trigger);

	const menu = document.querySelector('[role="menu"]');
	assert.ok(menu, 'the action menu did not open');
	// The load-bearing guard: the call site must beat the primitive's own
	// min-w-[8rem], or long labels wrap and clip again.
	assert.match(menu.className, /min-w-\[13rem\]/, 'the call site did not widen the menu');
	assert.match(menu.className, /w-56/, 'the call site kept the old w-44 width');
	const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
	assert.ok(items.length >= 3);
	for (const item of items) {
		assert.match(item.className, /whitespace-nowrap/, `menu item "${item.textContent?.trim()}" can still wrap`);
	}
	// The longest label is what broke; assert it is present and not clipped by
	// a narrower-than-content width.
	assert.ok(
		items.some((i) => i.textContent?.includes('Archive for new schedules')),
		'the longest menu label is missing',
	);
});
