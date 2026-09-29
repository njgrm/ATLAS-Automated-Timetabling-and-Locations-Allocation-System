/**
 * A5 C4 ITEM 3 (2026-09-29) — never an empty table under "Checking source".
 *
 * THE FINDING, VERBATIM (Lane C, Codex staging walk, train 6):
 *   "Never show an empty table under 'Checking source'. Show one progress panel
 *    until rows are ready."
 * Codex run 2 scored it MAJOR and named the harm: *"an empty table under 'Checking
 * source' invites guessing"*.
 *
 * WHAT WAS ACTUALLY WRONG. The source chip is `checking-source` whenever
 * `!actorScopeResolved || loading`. The body underneath it rendered the table shell
 * UNCONDITIONALLY: eight skeleton rows while `loading`, and an "empty state" panel
 * whenever `paged.length === 0`. So a scheduler could read "Checking source" above
 * a grid of grey bars — or above "No subjects found." — and neither screen says
 * which of the two things is happening. That is the guessing.
 *
 * AGENTS.md §11, and the panel is a SUBTRACTION: the eight skeleton rows are GONE,
 * not supplemented by a panel. The screen has fewer things in it than before.
 *
 * WHY THIS RENDERS THE EXTRACTED BODY AND NOT THE WHOLE PAGE. `SubjectCatalogBody`
 * was created as a PURE MOVE of the page's catalog block before any behaviour
 * changed, so that the failing-first run could execute against real production code
 * that still carried the defect. Rendering `pages/Subjects.tsx` itself would need
 * the whole authenticated page graph — api client, actor-scope session, the
 * EnrollPro school-year context, toasts, the router — mocked, and a test that mocks
 * the page's own data layer proves less about this row than rendering the real
 * component that makes the decision. The component IS the production path: the page
 * composes it and nothing else decides this branch.
 *
 * THE ROWS, AND WHICH OF THEM IS RED BEFORE THE FIX
 *   3a  exactly ONE progress panel, and NO `<table>` and no skeleton row   <- RED
 *   3b  the panel's sentence names the wait and the page                  <- RED
 *   3c  a resolved response REPLACES the panel with the real table        (passes)
 *   3d  a resolved-EMPTY response leaves the panel and shows the honest
 *       empty state — the chip/body disagreement cannot recur             (passes)
 *   3e  the empty-state copy is unchanged by this fix                     (preservation)
 *
 * 3c and 3d passing BEFORE the fix is the point: they are the controls that make
 * 3a's red attributable to the loading branch rather than to a component that
 * simply never renders anything.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
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
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
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
const { SubjectCatalogBody } = await import('../SubjectCatalogBody');

/** The real `Subject` field set the row receives — the same shape `Subjects.tsx` holds. */
function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 41, code: 'SCI10', name: 'Earth Science', displayCode: 'SCI10', outputLabel: null,
		ownerDepartment: 'AP', allowedOwnerDepartments: ['AP'], qualificationPriority: 'DEPARTMENT_FIRST',
		rotationFamily: null, minMinutesPerWeek: 225, preferredRoomType: 'LAB', isActive: true,
		isSeedable: false, isSystemManaged: false, gradeLevels: [9], interSectionEnabled: false,
		interSectionGradeLevels: [], modularGroupId: null, modularOrder: null, programScopes: ['REGULAR'],
		allowedSpecializations: [], requiredFeatures: [], rotationTermLabel: null, rotationTermRank: null,
		rotationTermGroupId: null, rotationTermCount: null, updatedAt: '2026-09-28T00:00:00.000Z',
		...overrides,
	} as never;
}

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

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
	root = null; hostEl?.remove(); hostEl = null;
}

const noop = () => {};

function bodyFor(overrides: Record<string, unknown> = {}) {
	return (
		<MemoryRouter>
			<SubjectCatalogBody
				loading={false}
				paged={[]}
				subjects={[]}
				coverageBySubjectId={null}
				termAuthority={null}
				sortField="name"
				sortDir="asc"
				onToggleSort={noop}
				page={1}
				pageSize={20}
				totalFiltered={0}
				totalPages={0}
				onPageChange={noop}
				onPageSizeChange={noop}
				onReviewCoverage={noop}
				onEdit={noop}
				onArchive={noop}
				onDelete={noop}
				onReactivate={noop}
				{...overrides}
			/>
		</MemoryRouter>
	);
}

/** Read everything the rows need into plain data, so no assertion runs while mounted. */
async function read(overrides: Record<string, unknown> = {}) {
	const host = await render(bodyFor(overrides));
	try {
		const table = host.querySelector('table');
		return {
			progressPanels: host.querySelectorAll('[data-testid="subjects-catalog-progress"]').length,
			tables: host.querySelectorAll('table').length,
			bodyRows: host.querySelectorAll('tbody tr').length,
			/* The skeleton is identified by its SHAPE, not by a source string: a row
			 * whose every cell is a single non-text block is a grey bar. Counting
			 * `tbody tr` alone cannot tell a skeleton from a real row, because both
			 * are rows. */
			skeletonRows: Array.from(host.querySelectorAll('tbody tr')).filter(
				(tr) => tr.querySelectorAll('td').length > 0 && (tr.textContent ?? '').trim() === '',
			).length,
			text: (host.textContent ?? '').replace(/\s+/g, ' ').trim(),
			footer: host.querySelectorAll('[data-testid="subjects-pagination"]').length,
		};
	} finally {
		await unmount();
	}
}

// ─────────────────────────────────────────────────────────────────────────────

test('A5-C4-3a: while the first catalog response is outstanding there is ONE progress panel and NO table', async () => {
	// RED ON BASE at all three assertions: the base renders the table shell during
	// loading, with eight skeleton rows, and no progress panel at all.
	const seen = await read({ loading: true });
	assert.equal(seen.progressPanels, 1, `expected exactly one progress panel, found ${seen.progressPanels}`);
	assert.equal(seen.tables, 0, `a <table> rendered while the catalog was still loading (${seen.bodyRows} rows): "${seen.text}"`);
	assert.equal(seen.skeletonRows, 0, `${seen.skeletonRows} skeleton rows rendered alongside the panel; the panel REPLACES the grid, it does not join it`);
	assert.equal(seen.bodyRows, 0, 'body rows rendered while the catalog was still loading');
});

test('A5-C4-3b: the panel says ONE calm thing, naming the wait and the page', async () => {
	// RED ON BASE: there is no panel to read.
	const seen = await read({ loading: true });
	assert.match(seen.text, /Loading subjects/, `the panel does not name what is loading: "${seen.text}"`);
	// A scheduler must not have to decode a second sentence. The panel carries the
	// wait and nothing else that competes for attention.
	assert.equal(
		/Checking source|TERM_|VERIFIED_|PENDING_/.test(seen.text),
		false,
		`the loading panel repeats a code or a chip instead of one plain sentence: "${seen.text}"`,
	);
});

test('A5-C4-3c: when the response RESOLVES with rows, the table replaces the panel', async () => {
	// A slow load that eventually resolves must show the ROWS, not the panel for
	// ever — the panel is bounded by the first response, not by a timer.
	const seen = await read({ loading: false, paged: [subjectFixture()], subjects: [subjectFixture()] });
	assert.equal(seen.progressPanels, 0, 'the progress panel is still on screen after the catalog resolved');
	assert.equal(seen.tables, 1, 'the real table did not replace the panel');
	assert.match(seen.text, /Earth Science/, `the resolved rows are not on screen: "${seen.text}"`);
});

test('A5-C4-3d: a RESOLVED-EMPTY response leaves the panel and shows the honest empty state', async () => {
	// This is the control that makes 3a attributable. A component that simply never
	// rendered anything would also pass 3a; it must not be able to pass 3d too.
	const seen = await read({ loading: false, paged: [], subjects: [] });
	assert.equal(seen.progressPanels, 0, 'the progress panel is still on screen after an EMPTY response resolved');
	assert.equal(seen.tables, 1, 'the table shell is gone after the response resolved');
	assert.match(seen.text, /No subjects found\./, `the honest empty state is missing: "${seen.text}"`);
	assert.doesNotMatch(seen.text, /Loading subjects/, 'a resolved response still reads as loading');
});

test('A5-C4-3e: "No matches found." is still what a FILTERED page says, and the skeleton count is eight no more', async () => {
	// PRESERVATION: the post-resolution empty copy distinguishes an empty CATALOG
	// from a page whose filters match nothing. Unchanged by this fix, and asserted
	// so a future edit cannot collapse the two.
	const filtered = await read({ loading: false, paged: [], subjects: [subjectFixture()] });
	assert.match(filtered.text, /No matches found\./, `the filtered empty state changed: "${filtered.text}"`);

	// And the eight-row skeleton is gone from this component, not merely hidden
	// behind the panel. If a later edit reintroduced it behind the panel, the panel
	// row would still pass and the screen would be carrying both.
	const { readFileSync } = await import('node:fs');
	const source = readFileSync(new URL('../SubjectCatalogBody.tsx', import.meta.url), 'utf8');
	assert.doesNotMatch(
		source,
		/Array\.from\(\{\s*length:\s*8\s*\}\)/,
		'the eight-row skeleton is back in the catalog body; the panel is a subtraction, not an addition',
	);
});
