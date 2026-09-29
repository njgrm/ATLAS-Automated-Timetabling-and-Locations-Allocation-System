/**
 * A6 c8 (2026-09-29) — fix-doc item 17.1: the `/subjects` coverage COUNT opens the
 * subject's read-only coverage window.
 *
 * THE DEFECT, reproduced on real staging data by the planner, subject `ESP/GMRC`:
 *
 *   cell [data-testid="subject-coverage-cell-5"] text: "18/20 covered2 sections still
 *     need a teacher."
 *     -> <div slot="badge" aria-label="ESP/GMRC has partial section coverage">18/20 covered</div>
 *     -> <button> … the AccessibleInfo info icon …
 *   click that button  -> [data-testid="subject-coverage-dialog"] count 0   (opens NOTHING)
 *   click the row's "Review teacher coverage for ESP/GMRC" -> count 1      (works)
 *
 * So the cell's only affordance was a DEAD info icon: the control looked like data,
 * was focusable, was clickable, and did nothing. The `Review` action one cell over
 * did work, which is what makes this a defect rather than a missing feature — the
 * window was always reachable, just not from the control the cell was built around.
 *
 * WHY EVERY ROW HERE RENDERS AND CLICKS. `AGENTS.md` §11: "A test that only asserts
 * source text is not acceptance evidence for a user-facing change," and this is
 * precisely a source-text-shaped fix — a wrapper element and a deleted icon. A row
 * that read the `.tsx` and matched `/<button/` would have passed on the base. So
 * every row below mounts the REAL `SubjectRow`, finds the coverage control BY ITS
 * RENDERED TEXT (`18/20 covered`), CLICKS it, and reads the resulting DOM.
 *
 * THE FIXTURE IS THE REAL SURFACE, taken from the row the planner photographed:
 * `ESP/GMRC`, 18 owned of 20 relevant sections, 2 uncovered. A fixture of
 * `18/20`/`2` is what the operator actually saw, so a control cannot pass against a
 * convenient constant.
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

/** The control whose VISIBLE TEXT is exactly this — never found by test id. */
function buttonByText(scope: ParentNode, text: string): HTMLButtonElement | null {
	return buttonsIn(scope).find((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim() === text) ?? null;
}

const textOf = (node: Element | Document | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/* ═══════════════════════ the control, and the click that opens the window ══ */

test('A6C8-17.1-1 clicking the rendered coverage COUNT opens that subject\'s coverage window', async () => {
	// THE ROW. On the base this fails at the very first assertion: there is no
	// button whose visible text is `18/20 covered`. The badge was a `div`, and the
	// only button in the cell was the dead `AccessibleInfo` icon.
	const opened: unknown[] = [];
	const control = await snapshot(
		rowFor(PARTIAL, (s) => { opened.push(s); }),
		(host) => {
			const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]');
			assert.ok(cell, 'the coverage cell must render, and keep its own test id');
			const button = buttonByText(cell!, '18/20 covered');
			assert.ok(
				button,
				'the coverage COUNT itself must be the control that opens the window — a badge that looks like data and does nothing is the defect',
			);
			// It is a REAL button: keyboard-operable, in the Tab order, submitting
			// nothing. A `div` with an onClick would satisfy the click and fail this.
			assert.equal(button!.tagName, 'BUTTON', 'the coverage control must be a real `<button>`, not a clickable div');
			assert.equal(button!.type, 'button', 'and it must not submit anything');
			assert.equal(button!.getAttribute('title'), null, 'never a raw `title` attribute (AGENTS.md §8)');
			// THE SENTENCE MOVED OFF THE DEAD ICON AND ONTO THE CONTROL. It was the
			// icon's `shortHelp`; it is now the button's accessible name, and it ends
			// in "Click to see which." because the control is now clickable.
			assert.equal(
				button!.getAttribute('aria-label'),
				'2 sections still need a teacher. Click to see which.',
				'the explanatory sentence must be the control\'s accessible name, and it must say the control can be clicked',
			);
			// The STATUS is still stated on the badge element itself, so the colour
			// band and its meaning did not lose their own accessible name.
			const badge = button!.querySelector('[data-slot="badge"]');
			assert.ok(badge, 'the status badge must still be inside the control');
			assert.equal(
				badge!.getAttribute('aria-label'),
				'Edukasyon sa Pagkakaisa has partial section coverage',
				'the badge must keep its own status `aria-label`',
			);
			// THE BADGE KEEPS ITS STATUS COLOUR. The defect was "looks like data,
			// does nothing", NOT "looks like data": the amber / green / red band is
			// the meaning of the column, so the button wears the same classes.
			const badgeClass = badge!.getAttribute('class') ?? '';
			assert.match(badgeClass, /bg-amber-50/, 'the partial badge must keep its amber status band');
			assert.match(badgeClass, /text-amber-700/, 'and its amber text');
			assert.match(badgeClass, /border-amber-200/, 'and its amber border');
			// …and the control itself is discoverably clickable.
			assert.match(button!.getAttribute('class') ?? '', /hover:underline/, 'the control must read as clickable on hover');
			assert.match(button!.getAttribute('class') ?? '', /focus-visible:ring/, 'and must be discoverable by keyboard focus');
			// THE DEAD ICON IS GONE. The cell used to render a second, focusable
			// button that opened nothing; a cell with two buttons where one is inert
			// is worse than a cell with one.
			assert.equal(
				buttonsIn(cell!).length,
				1,
				'the coverage cell must render exactly ONE control — the dead info icon is deleted, not kept beside the new one',
			);
			// No raw `<details>` was introduced as a substitute affordance (§8).
			assert.equal(cell!.querySelectorAll('details').length, 0, 'no raw `<details>` may stand in for the control');
			buttonByText(cell!, '18/20 covered')!.dispatchEvent(
				new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
			);
			return button!;
		},
	);
	// The CLICK reached the real prop, with THAT subject — not a row id, not the
	// first subject in a list. This is the whole claim of item 17.1.
	assert.deepEqual(
		opened,
		[SUBJECT],
		`clicking the rendered coverage count must call \`onShowCoverage\` with THAT subject; saw ${JSON.stringify(opened.map((s) => (s as { id?: number })?.id))}`,
	);
	assert.ok(control, 'precondition: the control was read off the rendered row');
});

test('A6C8-17.1-2 the OTHER two coverage badges are equally clickable — a status cell is not clickable only when something is wrong', async () => {
	// THE NEGATIVE CONTROL, and it matters for a scheduler: a control that is
	// clickable only in the alarming state teaches people that the calm state is
	// decoration. Each state is found by its OWN rendered text and clicked.
	for (const [face, coverageRow, help] of [
		['Full coverage', FULL, 'All required sections have a teacher assigned.'],
		['No coverage', NONE, '20 sections still need a teacher. Click to see which.'],
	] as Array<[string, unknown, string]>) {
		const opened: unknown[] = [];
		await snapshot(
			rowFor(coverageRow, (s) => { opened.push(s); }),
			(host) => {
				const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]')!;
				assert.ok(cell, `${face}: the coverage cell must render`);
				const button = buttonByText(cell, face);
				assert.ok(button, `${face}: this badge must be the same clickable control, not a dead one`);
				assert.equal(
					button!.getAttribute('aria-label'),
					help,
					`${face}: the sentence must follow the coverage state, in the control's own words`,
				);
				buttonByText(cell, face)!.dispatchEvent(
					new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }),
				);
			},
		);
		assert.deepEqual(
			opened,
			[SUBJECT],
			`${face}: clicking the rendered badge must open that subject's coverage window`,
		);
	}
});

/**
 * A6C8-17.1-3 — THE PRODUCTION PATH, not the cell on its own.
 *
 * The rows above mount `SubjectRow`. This row mounts the composition
 * `SubjectCatalogBody` builds and asserts that the coverage count and the `Review`
 * action open the SAME window, which is the claim a scheduler actually has: two
 * affordances, one window, no duplicate *status*. The `Review` action is a
 * committed surface and is deliberately NOT deleted; this row proves it still works
 * rather than assuming it.
 */
test('A6C8-17.1-3 the `Review` action and the coverage count both reach the SAME `onShowCoverage`, and neither is a duplicate status', async () => {
	const opened: unknown[] = [];
	await snapshot(
		rowFor(PARTIAL, (s) => { opened.push(s); }),
		(host) => {
			const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]')!;
			// The `Review` action lives in the row's ACTION cell, not the coverage
			// cell, so it is found by its own committed accessible name.
			const review = buttonsIn(cell!.ownerDocument.body)
				.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Review teacher coverage for')) as HTMLButtonElement | undefined;
			assert.ok(review, 'the row\'s labelled `Review` action must still render — it is a committed surface, not a duplicate to delete');
			assert.equal(textOf(review), 'Review', 'and it must still read exactly `Review`');
			assert.equal(
				review!.getAttribute('aria-label'),
				'Review teacher coverage for Edukasyon sa Pagkakaisa',
				'with the full accessible name it has always had',
			);

			// EXACTLY TWO controls on the row open coverage: the count and `Review`.
			// The count is asserted, not assumed, and the count is a COUNT — two
			// buttons in one cell would be a new defect, and the cell is asserted at
			// one by row 1. What this row adds is that the two are the SAME action on
			// the SAME subject, not a second status competing with the first.
			const openers = buttonsIn(cell!.ownerDocument.body).filter(
				(b) => b === buttonByText(cell, '18/20 covered') || b === review!,
			);
			assert.equal(openers.length, 2, 'the row offers exactly two affordances for one window');

			// CLICK the count, then CLICK `Review`; both must reach the same prop with
			// the same subject.
			click(buttonByText(cell, '18/20 covered')!);
			click(review!);
		},
	);
	assert.deepEqual(
		opened,
		[SUBJECT, SUBJECT],
		`both affordances must reach the SAME handler with the SAME subject; saw ${JSON.stringify(opened.map((s) => (s as { id?: number })?.id))}`,
	);
});
