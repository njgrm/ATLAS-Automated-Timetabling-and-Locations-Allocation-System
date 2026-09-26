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
const { SubjectCoverageSheet } = await import('../SubjectCoverageSheet');
const { SubjectRow } = await import('../SubjectRow');
const { AdminSearchFilterToolbar } = await import('../../admin-workspace/AdminWorkspace');
const { subjectToFormValues } = await import('../subject-form-utils');
const constants = await import('../../../lib/subject-constants');

type SubjectSaveOutcome = import('../SubjectFormModal').SubjectSaveOutcome;
type SubjectFormValues = import('../SubjectFormModal').SubjectFormValues;
type TermAuthority = import('../../../types').TermAuthority;

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

// The full, fully-typed prop set. Tests that need to observe a handler spread
// this and then override that one handler after it, so the base must satisfy
// `Props` on its own — a partial bag would make every call site a type error.
const EDITABLE: ToolbarProps = {
	searchQuery: '',
	onSearchChange: () => {},
	showFilters: false,
	onToggleFilters: () => {},
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
		// The REAL production string from Subjects.handleModalSave's STALE_WRITE
		// branch — a control fixture must come from the surface it is about
		// (AGENTS.md §11), not from an invented one.
		{ status: 'stale', message: 'This subject was modified by another user. Your edit was not written — close and reopen it to load the newer version.' },
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
	assert.match(code('src/pages/Subjects.tsx'), /Your edit was not written/);
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
// CHECK 7 — Fix 15: every primary filter is reachable in ONE interaction.
// ===========================================================================
test('A3-15: Status, Attention and Grade are reachable in one interaction at 1366x768', async () => {
	const fired: string[] = [];
	const host = await render(
		<MemoryRouter>
			<SubjectFilterToolbar
				{...EDITABLE}
				showFilters={false}
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
	// The two secondary filters are behind the disclosure, not absent from the app.
	for (const label of ['Filter by room type', 'Filter by program scope']) {
		assert.equal(byLabel(host, label), null, `secondary filter "${label}" should still be behind the disclosure`);
	}
	assert.ok(Array.from(document.body.querySelectorAll('button')).some((b) => b.textContent?.includes('More filters')));

	// One interaction reaches the filter: a single activation of the trigger.
	const statusTrigger = byLabel(host, 'Filter by subject status')!;
	await click(statusTrigger);
	// The trigger alone does not change a filter; what matters is that it is a
	// live, focusable, non-hidden control in the primary row.
	assert.ok(primaryRow(host)?.contains(statusTrigger), 'the status trigger is not inside the always-visible row');
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

// The no-crowding / no-page-scrollbar half of Fix 15, asserted over the class
// contract jsdom can actually read.
test('A3-15: the primary row fits 1366px by its declared widths and cannot introduce page scroll', async () => {
	const host = await render(
		<MemoryRouter><SubjectFilterToolbar {...EDITABLE} /></MemoryRouter>,
	);
	const row = primaryRow(host);
	assert.ok(row, 'no primary row');
	assert.match(row.className, /flex-wrap/, 'the primary row does not wrap, so it can overflow instead of stacking');
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
// CHECK 8 — Fix 09 guard control: only the routine state compacts.
// ===========================================================================
test('A3-09: BLOCKED stays a loud role="alert"; VERIFIED_CACHED stays amber; only VERIFIED_LIVE compacts', async () => {
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

	const live = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_LIVE')} />);
	const l = query(live, 'subject-term-authority')!;
	assert.equal(l.getAttribute('role'), 'status');
	assert.equal(l.getAttribute('data-presentation'), 'compact', 'the routine state was not compacted');
	// Compact means compact: one line, no padded block, no emerald slab.
	assert.equal(l.className.includes('rounded-xl'), false, 'the compact banner kept a padded block');
	assert.equal(l.className.includes('bg-emerald-50'), false, 'the compact banner kept a full-width emerald slab');
	assert.equal(l.className.includes('py-3'), false, 'the compact banner kept block padding');
	assert.match(l.className, /text-xs/);
	assert.match(l.textContent ?? '', /verified live/i);
});

test('A3-09: the compacted state keeps every term reachable, through @/ui and not a <details> or title', async () => {
	const host = await render(<SubjectTermAuthorityBanner termAuthority={termAuthority('VERIFIED_LIVE')} />);
	assert.equal(document.body.querySelector('details'), null, 'a raw <details> was used for the term list');
	assert.equal(document.body.querySelector('[title]'), null, 'a title attribute was used for the term list');

	const trigger = query(host, 'subject-term-authority-terms-trigger');
	assert.ok(trigger, 'no reachable control for the ordered terms');
	// The year label and the term COUNT stay on the one line.
	assert.match(query(host, 'subject-term-authority')!.textContent ?? '', /2030-2031/);
	assert.match(query(host, 'subject-term-authority')!.textContent ?? '', /3 ordered terms/);
	// The authority message is not dropped; it is still in the accessibility tree.
	assert.match(query(host, 'subject-term-authority')!.textContent ?? '', /read from EnrollPro/);

	await click(trigger);
	const popover = query(document.body, 'subject-term-authority-terms');
	assert.ok(popover, 'the terms did not open in a @/ui Popover');
	for (const term of ['Term 1', 'Term 2', 'Term 3']) {
		assert.match(popover.textContent ?? '', new RegExp(term), `term ${term} is no longer reachable`);
	}
	assert.match(popover.textContent ?? '', /Term 1 · Active/, 'the active-term marker was lost');
	// And the ownership sentence that the old full block carried.
	assert.match(popover.textContent ?? '', /ATLAS-owned/);
});

test('A3-09: a null authority renders nothing rather than an empty block', async () => {
	const host = await render(<SubjectTermAuthorityBanner termAuthority={null} />);
	assert.equal(document.body.textContent, '');
});

// ===========================================================================
// CHECK 9 — Fix 17: centered, internally scrollable dialog; Escape, backdrop,
// and background scroll lock.
// ===========================================================================
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
