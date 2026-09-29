/**
 * OPERATOR (30 Sep 2026, docx1 S2) REVERSED A6 c8 / fix 2.17.1 — read this first.
 *
 * 2.17.1 (2026-09-29) made the `/subjects` coverage COUNT itself a `<button>` that
 * opened the subject's read-only coverage window, because the cell's only
 * affordance had been a DEAD `AccessibleInfo` info icon (looked like data, was
 * focusable, opened nothing). The operator has now reversed that contract: the
 * coverage badge is PLAIN, NON-clickable status text again, and only the row's
 * `Review` action opens coverage.
 *
 * This file was `A6C8-17.1-*`; its three controls are rewritten below as
 * `A5DOCX1-S2-*` against the NEW contract. The reversal is a deliberate operator
 * contract change, not a deletion: the harness and the adversarial style are kept,
 * the fixture is still the real staging row (`ESP/GMRC`, 18 owned of 20, 2
 * uncovered), and every row still mounts the REAL `SubjectRow`.
 *
 * WHY EVERY ROW HERE RENDERS AND CLICKS. `AGENTS.md` §11: "A test that only asserts
 * source text is not acceptance evidence for a user-facing change." A row that read
 * the `.tsx` and matched `/<button/` would have passed on the base. So each row
 * mounts the real component, finds things BY THEIR RENDERED TEXT, dispatches a real
 * click, and reads the resulting DOM.
 *
 * THE HARNESS IS COPIED VERBATIM from the accepted sibling
 * `a5-c3-subjects-calm-surface.test.tsx` (JSDOM bootstrap, the render/read/unmount
 * discipline), because that file documents a real cost: a test that throws while a
 * React tree is still mounted leaves this runner unable to reach an idle event loop
 * and the harness reports a bare `test failed` with no message. So every row reads
 * into PLAIN DATA and unmounts BEFORE it asserts.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

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
	PointerEvent: dom.window.MouseEvent,
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
const { TooltipProvider } = await import('@/ui/tooltip');
const { SubjectRow } = await import('../SubjectRow');

/**
 * A subject shaped like the real scheduling-authority read, carrying the SAME
 * field set the sibling subjects suites render, so a failure here is a difference in
 * presentation and not in shape. `ESP/GMRC` and its 18/20/2 figures are the ones
 * the planner photographed on staging.
 */
const SUBJECT = {
	id: 5,
	code: 'ESP/GMRC',
	name: 'Edukasyon sa Pagkakaisa',
	displayCode: 'ESP/GMRC',
	outputLabel: null,
	ownerDepartment: 'AP',
	allowedOwnerDepartments: [] as string[],
	qualificationPriority: 'DEPARTMENT_FIRST' as const,
	rotationFamily: null,
	minMinutesPerWeek: 150,
	preferredRoomType: 'CLASSROOM' as const,
	isActive: true,
	isSeedable: false,
	isSystemManaged: false,
	gradeLevels: [7, 8, 9, 10],
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
	updatedAt: '2026-09-29T00:00:00.000Z',
} as never;

/** The three coverage states the cell renders, on the staging subject's own shape. */
const PARTIAL = { status: 'PARTIAL', ownedSectionCount: 18, relevantSectionCount: 20, uncoveredSectionCount: 2 } as never;
const FULL = { status: 'FULL', ownedSectionCount: 20, relevantSectionCount: 20, uncoveredSectionCount: 0 } as never;
const NONE = { status: 'ZERO', ownedSectionCount: 0, relevantSectionCount: 20, uncoveredSectionCount: 20 } as never;

/** The page renders `SubjectRow` inside a `TooltipProvider`; mirror that. */
function rowFor(coverageRow: unknown, onShowCoverage: (s: unknown) => void) {
	return (
		<MemoryRouter>
			<TooltipProvider delayDuration={200}>
				<table><tbody>
					<SubjectRow
						subject={SUBJECT}
						timeMode="hours"
						coverageRow={coverageRow as never}
						onEdit={() => {}}
						onDelete={() => {}}
						onArchive={() => {}}
						onReactivate={() => {}}
						onShowCoverage={onShowCoverage}
					/>
				</tbody></table>
			</TooltipProvider>
		</MemoryRouter>
	);
}

/**
 * Render, read into PLAIN DATA, unmount. See the harness note at the top of this
 * file: a test that throws with a tree still mounted takes the whole runner down
 * and reports a bare `test failed`.
 */
async function snapshot<T>(node: React.ReactNode, read: (host: HTMLElement) => T): Promise<T> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => { root.render(node); });
	let value: T;
	try {
		value = await read(host);
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
	return value;
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

/** The buttons inside a scope, in DOM order. */
function buttonsIn(scope: ParentNode): HTMLButtonElement[] {
	return Array.from(scope.querySelectorAll('button')) as HTMLButtonElement[];
}

/** The badge the cell renders — the one status element, whatever its state. */
function badgeIn(scope: ParentNode): HTMLElement | null {
	return scope.querySelector('[data-slot="badge"]') as HTMLElement | null;
}

const textOf = (node: Element | Document | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/* ═══════════════════════ the badge is plain text, and only Review opens ══ */

test('A5DOCX1-S2-1 the coverage cell is PLAIN status text — zero buttons, no focus, and clicking the badge opens nothing', async () => {
	// OPERATOR (30 Sep, S2): the coverage badge is non-clickable text again.
	const opened: unknown[] = [];
	const badge = await snapshot(
		rowFor(PARTIAL, (s) => { opened.push(s); }),
		(host) => {
			const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]');
			assert.ok(cell, 'the coverage cell must render, and keep its own test id');
			// (a) ZERO buttons, and the badge is not focusable. The base (fix
			// 2.17.1) rendered the badge as a real `<button>`; this is the
			// operator-reversed contract.
			assert.equal(
				buttonsIn(cell!).length,
				0,
				'the coverage cell must render NO control — the operator made the badge plain text and only `Review` opens coverage',
			);
			const found = badgeIn(cell!);
			assert.ok(found, 'the coverage cell must still render its status badge');
			assert.equal(found!.getAttribute('tabindex'), null, 'the badge must not be focusable — it is not a control');
			// No Tooltip wrapper survived beside it (§8 forbids a raw `title=`).
			assert.equal(found!.getAttribute('title'), null, 'the badge must not carry a raw `title` attribute');
			assert.equal(cell!.querySelectorAll('details').length, 0, 'no raw `<details>` may stand in for an affordance');
			// (b) THE BADGE KEEPS ITS WORDS, ITS COLOUR BAND AND ITS OWN STATUS
			// `aria-label`. The reversal removes the affordance, never the status.
			assert.equal(textOf(found!), '18/20 covered', 'the partial badge must keep its exact words');
			const badgeClass = found!.getAttribute('class') ?? '';
			assert.match(badgeClass, /bg-amber-50/, 'the partial badge must keep its amber status band');
			assert.match(badgeClass, /text-amber-700/, 'and its amber text');
			assert.match(badgeClass, /border-amber-200/, 'and its amber border');
			assert.equal(
				found!.getAttribute('aria-label'),
				'Edukasyon sa Pagkakaisa has partial section coverage',
				'the badge must keep its own status `aria-label`',
			);
			// (c) CLICK THE BADGE. It must open NOTHING — the one thing the
			// operator asked to stop.
			found!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
			return found;
		},
	);
	assert.deepEqual(
		opened,
		[],
		`clicking the coverage badge must NOT call \`onShowCoverage\`; saw ${JSON.stringify(opened.map((s) => (s as { id?: number })?.id))}`,
	);
	assert.ok(badge, 'precondition: the badge was read off the rendered row');
});

test('A5DOCX1-S2-2 the FULL and NONE badges are equally plain, and keep their exact words and colour band', async () => {
	// A control that is plain only in the amber state would teach people the calm
	// state is still a control. Each state is found by its OWN rendered text.
	for (const [face, coverageRow, ariaLabel, family] of [
		['Full coverage', FULL, 'Edukasyon sa Pagkakaisa has full section coverage', 'emerald'],
		['No coverage', NONE, 'Edukasyon sa Pagkakaisa has no section coverage', 'red'],
	] as Array<[string, unknown, string, string]>) {
		const opened: unknown[] = [];
		await snapshot(
			rowFor(coverageRow, (s) => { opened.push(s); }),
			(host) => {
				const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]')!;
				assert.ok(cell, `${face}: the coverage cell must render`);
				assert.equal(buttonsIn(cell).length, 0, `${face}: this badge must be plain text, not a control`);
				const badge = badgeIn(cell);
				assert.ok(badge, `${face}: the status badge must render`);
				assert.equal(textOf(badge!), face, `${face}: the badge words changed`);
				const badgeClass = badge!.getAttribute('class') ?? '';
				assert.match(badgeClass, new RegExp(`bg-${family}-50`), `${face}: the status band changed`);
				assert.match(badgeClass, new RegExp(`text-${family}-700`), `${face}: the status text colour changed`);
				assert.match(badgeClass, new RegExp(`border-${family}-200`), `${face}: the status border colour changed`);
				assert.equal(badge!.getAttribute('aria-label'), ariaLabel, `${face}: the badge lost its status \`aria-label\``);
				click(badge!);
			},
		);
		assert.deepEqual(opened, [], `${face}: clicking a plain status badge must open nothing`);
	}
});

/**
 * A5DOCX1-S2-3 — THE ROW'S ONE OPENER MUST STILL WORK.
 *
 * The reversal could be satisfied by deleting every affordance on the row. So this
 * row proves the `Review` action — now the ONLY control that opens coverage — still
 * calls `onShowCoverage` with THAT subject. Without this the reversal would be
 * indistinguishable from removing the feature.
 */
test('A5DOCX1-S2-3 the `Review` action is the ONE control that opens coverage, and it reaches `onShowCoverage` with that subject', async () => {
	const opened: unknown[] = [];
	await snapshot(
		rowFor(PARTIAL, (s) => { opened.push(s); }),
		(host) => {
			// The `Review` action lives in the row's ACTION cell, not the coverage
			// cell, so it is found by its own committed accessible name.
			const review = buttonsIn(host.ownerDocument.body)
				.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Review teacher coverage for')) as HTMLButtonElement | undefined;
			assert.ok(review, 'the row\'s labelled `Review` action must still render — it is now the only way to open coverage');
			assert.equal(textOf(review), 'Review', 'and it must still read exactly `Review`');
			assert.equal(
				review!.getAttribute('aria-label'),
				'Review teacher coverage for Edukasyon sa Pagkakaisa',
				'with the full accessible name it has always had',
			);
			click(review!);
		},
	);
	assert.deepEqual(
		opened,
		[SUBJECT],
		`the \`Review\` action must reach \`onShowCoverage\` with THAT subject; saw ${JSON.stringify(opened.map((s) => (s as { id?: number })?.id))}`,
	);
});
