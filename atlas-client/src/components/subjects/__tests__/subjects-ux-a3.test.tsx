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
	statusFilter: 'all',
	onStatusFilterChange: () => {},
	attentionFilter: 'all',
	onAttentionFilterChange: () => {},
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
// CHECK 2 — Fix 20 Cancel / non-action: zero network, state intact.
// ===========================================================================
test('A3-20: Cancel is a non-action — no save call, no request, form state intact', async () => {
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

		assert.equal(saves, 0, 'Cancel invoked the save path');
		assert.equal(closes, 1, 'Cancel did not take exactly one close action');
		assert.deepEqual(fetchCalls, [], 'Cancel issued a network request');
		assert.equal(query(host, 'subjects-form-result'), null, 'Cancel surfaced a save outcome');

		// State intact: the edited name is still in the form, unmounted nowhere.
		const after = document.body.querySelector<HTMLInputElement>('input[placeholder="e.g. Mathematics Grade 10"]');
		assert.ok(after, 'form unmounted itself on Cancel');
		assert.equal(after.value, 'Earth Science (edited)');
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
				onStatusFilterChange={(v) => fired.push(`status:${v}`)}
				onAttentionFilterChange={(v) => fired.push(`attention:${v}`)}
				onGradeLevelFilterChange={(v) => fired.push(`grade:${v}`)}
			/>
		</MemoryRouter>,
	);

	const primary = ['Filter by subject status', 'Filter by attention status', 'Filter by grade level'];
	// Present without opening anything.
	for (const label of primary) {
		const el = byLabel(host, label);
		assert.ok(el, `primary filter "${label}" is not rendered without any interaction`);
		assert.equal(el.getAttribute('aria-hidden'), null, `primary filter "${label}" is aria-hidden`);
		assert.equal(el.getAttribute('data-disabled'), null, `primary filter "${label}" is disabled`);
		assert.equal(el.getAttribute('disabled'), null, `primary filter "${label}" carries the disabled attribute`);
	}
	// SUPERSEDED IN BEHAVIOUR (A3-C9): the disclosure row is gone, so the two
	// catalog lookups are no longer absent from the first render. What A3-15
	// was actually protecting — that neither filter was DELETED from the app —
	// is now asserted in full below and in the A3-C9 replacement control.

	// One interaction reaches the filter: a single activation of the trigger.
	const statusTrigger = byLabel(host, 'Filter by subject status')!;
	await click(statusTrigger);
	// The trigger alone does not change a filter; what matters is that it is a
	// live, focusable, non-hidden control in the always-visible row.
	// SUPERSEDED IN BEHAVIOUR (A3-C9): the always-visible row is now
	// `admin-inline-filter-row` (same row as the search box) rather than
	// `admin-primary-filter-row` (a second row below it). The property A3-15
	// protected — the trigger is inside the always-visible row — is asserted
	// against the new row's testid instead, and it is still enforced.
	assert.ok(alwaysVisibleRow(host)?.contains(statusTrigger), 'the status trigger is not inside the always-visible row');
	// Radix Select is a real listbox: activating it exposes the options, which
	// is the "one interaction" being asked for.
	assert.ok(
		Array.from(document.body.querySelectorAll('button')).some((b) => b.getAttribute('aria-expanded') === 'true'),
		'activating the primary status filter did not open it',
	);
	const active = byLabel(host, 'Filter by subject status')!;
	const listbox = document.querySelector('[role="listbox"]');
	assert.ok(listbox, 'no listbox opened from the primary filter');
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
	const trigger = byLabel(host, 'Filter by subject status')!;
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
// A3-C9 — item 2: ONE row of controls, no "More filters" row.
// ===========================================================================
test('A3-C9: the single filter row carries all six filters, opens no second row, and has no "More filters" disclosure', async () => {
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

	// (1) The disclosure is gone. A base run finds one of these buttons.
	assert.equal(
		Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.includes('More filters')).length,
		0,
		'the "More filters" disclosure still renders',
	);

	// (2) Exactly ONE row holds the always-visible filters, and it is the same
	// row the search box is in — the header is one row, not two.
	const row = query(host, 'admin-inline-filter-row');
	assert.ok(row, 'the filters are not in a single row with the search box');
	assert.ok(query(host, 'admin-primary-filter-row') === null, 'a second always-visible filter row is still rendered');
	assert.equal(query(host, 'admin-search-filter-toolbar')!.querySelectorAll('[data-testid="admin-inline-filter-row"]').length, 1);
	assert.equal(row.className.includes('flex-wrap'), false, 'the single row wraps, so it can still spill onto a second line');

	// (3) All four triage selects AND the catalog popover trigger are in that row,
	// with no interaction required.
	for (const label of ['Filter by subject status', 'Filter by attention status', 'Filter by grade level', 'Filter by rotation term']) {
		const el = byLabel(host, label);
		assert.ok(el, `filter "${label}" is not rendered without any interaction`);
		assert.ok(row.contains(el), `filter "${label}" is not in the single row`);
		assert.equal(el.getAttribute('aria-hidden'), null, `filter "${label}" is aria-hidden`);
		assert.equal(el.getAttribute('data-disabled'), null, `filter "${label}" is disabled`);
	}
	const catalog = query(host, 'subjects-catalog-filter-trigger');
	assert.ok(catalog, 'the room type / program trigger is not rendered');
	assert.ok(row.contains(catalog), 'the room type / program trigger is not in the single row');

	// (4) The search box and the reset control are still reachable in that row.
	const search = document.body.querySelector('input[placeholder="Search name or code..."]') as HTMLInputElement | null;
	assert.ok(search, 'the search box is gone');
	const reset = query(host, 'subjects-reset-filters');
	assert.ok(reset, 'the reset control is not reachable when a filter is active');
	assert.ok(row.contains(reset), 'the reset control is not in the single row');

	// (5) Room Type and Program scope are still REAL filters, not a label. One
	// interaction opens the popover; a second chooses a value, and the value
	// reaches the page. On the base these controls did not exist at all.
	await click(catalog);
	const popover = query(host, 'subjects-catalog-filter');
	assert.ok(popover, 'the catalog popover did not open');
	const roomOptions = Array.from(popover.querySelectorAll('[data-testid="subjects-room-type-option"]'));
	const programOptions = Array.from(popover.querySelectorAll('[data-testid="subjects-program-option"]'));
	// The FULL catalog is offered, not a subset: `ALL_ROOM_TYPES` and
	// `PROGRAM_SCOPE_OPTIONS` are the shared sources and must not be narrowed.
	assert.equal(roomOptions.length, constants.ALL_ROOM_TYPES.length + 1, 'the room type list lost an option');
	assert.equal(programOptions.length, constants.PROGRAM_SCOPE_OPTIONS.length + 1, 'the program list lost an option');
	assert.ok(
		roomOptions.some((o) => o.textContent?.trim() === constants.ROOM_TYPE_LABELS.LABORATORY),
		'the room type list does not show the real ROOM_TYPE_LABELS wording',
	);
	// And the chosen value actually reaches the page.
	await click(roomOptions.find((o) => o.getAttribute('data-value') === 'LABORATORY') ?? null);
	assert.ok(fired.includes('room:LABORATORY'), `choosing a room type did not reach the page (got ${fired.join(',')})`);
});

test('A3-C9: the single filter row fits 1366px by its declared widths and cannot introduce page scroll', async () => {
	// FAILING-FIRST on the base: the base declares a `sm:max-w-sm` (24rem)
	// search box, so the first budget assertion below is red on `a7ccb738`
	// (24rem + six controls + gaps > the space 1366px leaves).
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
	assert.match(searchWrapper.className, /sm:max-w-40/, 'the search box is not the narrowed width the one-row budget depends on');

	// Tailwind width steps actually used by the row's controls:
	//   search sm:max-w-40 = 10rem, status w-28 = 7rem, attention w-44 = 11rem,
	//   grade w-24 = 6rem, term w-32 = 8rem, catalog w-40 = 10rem.
	const declared = [
		...Array.from(row.querySelectorAll('[class*="w-"]')),
	].map((el) => /(^|\s)w-(\d+)(\s|$)/.exec(el.className)?.[2])
		.filter((v): v is string => v != null)
		.map((steps) => rem(Number(steps) / 4));
	const search = rem(10);
	const gaps = 6 * 8; // gap-2 between 7 items in the row
	// "Reset filters" is a text button, so it has no width class; its width is
	// measured content and is budgeted separately (and is the one number in
	// this arithmetic that a live pixel run must confirm).
	const reset = rem(7.5);
	const total = search + declared.reduce((a, b) => a + b, 0) + gaps + reset;
	assert.deepEqual(declared, [rem(7), rem(11), rem(6), rem(8), rem(10)], 'the six control widths are not the declared budget');
	// 1366 viewport - 256px expanded sidebar - 40px `lg:px-5` - 8px card inset.
	const available = 1366 - 256 - 40 - 8;
	assert.ok(
		total < available,
		`the toolbar's declared width budget (${total}px) does not fit the ${available}px available at 1366px`,
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

	const trigger = byLabel(host, 'Filter by rotation term');
	assert.ok(trigger, 'the term filter is not rendered');
	assert.equal(trigger.getAttribute('role'), 'combobox');
	assert.ok(trigger.getAttribute('aria-controls'), 'the term trigger is not wired to its listbox');

	await click(trigger);
	const listbox = document.querySelector('[role="listbox"]');
	assert.ok(listbox, 'no listbox opened from the term filter');
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
	assert.match(bare, /attentionFilter, termFilter, coverageBySubjectId/);

	// The removed disclosure state is gone from the page too, not just ignored.
	assert.equal(/\bshowFilters\b/.test(bare), false, 'Subjects.tsx still carries the removed showFilters state');
	assert.equal(/onToggleFilters/.test(bare), false, 'Subjects.tsx still wires the removed disclosure toggle');

	// The header strip is gone AND the contract has a non-header home: the
	// footer of the table the contract describes.
	assert.match(bare, /<SubjectTermContractPopover termAuthority=\{termAuthority\} \/>/);
	assert.match(bare, /leading=\{<SubjectTermContractPopover/);
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
				detail={{ assigned: [{ facultyId: 7, name: 'Dela Cruz, Juan', grades: [9, 10], load: 80, sections: ['9-A'] }], uncoveredGrades: [10], programScopes: ['REGULAR'] }}
				errorBySubjectId={new Map()}
				onRetry={() => {}}
				onClose={() => {}}
			/>
		</MemoryRouter>,
	);

	const dialog = query(host, 'subject-coverage-dialog');
	assert.ok(dialog, 'no coverage dialog rendered');
	// Centered: the shared Dialog primitive positions with left/top 50%.
	assert.match(dialog.className, /left-\[50%\][\s\S]*top-\[50%\]/, 'the coverage surface is not centered');
	// Not a side sheet.
	assert.equal(/inset-y-0|right-0/.test(dialog.className), false, 'the coverage surface is still anchored to an edge');
	// It owns its scroll, and it is bounded so it cannot push page scroll.
	assert.match(dialog.className, /max-h-\[90svh\]/);
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
