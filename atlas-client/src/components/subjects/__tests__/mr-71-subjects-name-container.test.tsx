/**
 * MR-71 (operator, 2026-10-03: "MR-71: Follow the new document", subject.docx) —
 * the `/subjects` row's three column defects, asserted as BEHAVIOUR.
 *
 * WHAT THIS DECIDES, in the document's own order:
 *
 *   1. "notice the text being cut due to the small container. Adjust the container
 *      size" — the subject NAME was `truncate`d inside a cell with no width of its
 *      own, so a long DepEd name was cut with a "…" on the operator's primary
 *      reading surface. Fixed by GIVING THE COLUMN ROOM (a declared width shared
 *      by the header and the cells) and letting the name use two lines, with the
 *      full string always recoverable as an ACCESSIBLE NAME and in an `@/ui`
 *      Tooltip — never a bare `title=` (`AGENTS.md` §8).
 *
 *   2. "notice the 'teacher coverage' those under its column should be not
 *      clickable … only the review is clickable and just keep the current
 *      information it has" — the coverage cell is plain, non-interactive status
 *      text that KEEPS its displayed information.
 *
 *   3. "notice the header beside the 'teacher coverage', there is a missing
 *      header, which is the 'action'. What's happening is when I scroll, the
 *      action header is going up until it disappears" — the table carries an
 *      `Action` column header, and the header row does not scroll away.
 *
 * WHY IT MOUNTS THE REAL SURFACE. `AGENTS.md` §11: "A test that only asserts
 * source text (a string, an import, a prop name in a file) is not acceptance
 * evidence for a user-facing change." A row that read the `.tsx` and matched
 * `/line-clamp-2/` would have passed on the base, which carried `truncate`.
 * Every control below mounts the real `SubjectRow` / `SubjectCatalogBody` and
 * reads the RENDERED DOM.
 *
 * WHY NO TAILWIND CLASS STRINGS IN AN ASSERTION. Every assertion here is a role,
 * a `data-testid`, a tag name, an attribute, a count, or rendered text. The two
 * layout properties this packet changed — the column's declared width and the
 * name's two-line bound — are asserted through their OBSERVABLE consequences
 * (`MR-71-1d`) rather than by string-matching class names, because a class
 * assertion would pass on any table that merely mentioned the word and would
 * fail on a correct fix that spelled the same layout differently. What IS
 * asserted about layout is the thing a user can observe: the name is not a
 * single-line ellipsis clip.
 *
 * THE HARNESS IS COPIED from the accepted sibling
 * `a5-c3-subjects-calm-surface.test.tsx` (JSDOM bootstrap; render → read into
 * PLAIN DATA → unmount → assert). That file documents a real cost: a test that
 * throws while a React tree is still mounted leaves the runner unable to reach an
 * idle event loop and reports a bare `test failed` with no message. Observing
 * first and asserting after makes every failure legible.
 *
 * THE FIXTURE IS THE REAL SURFACE (`AGENTS.md` §11: a control's fixture must
 * come from the real surface). It is the same field set the sibling subjects
 * suites render. The name is a REAL DepEd long subject name — the one
 * `a6-c8-subjects-coverage-opens.test.tsx` already uses as the staging row —
 * because a short fixture would pass a truncation defect that a real catalog
 * row hits.
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
const { SubjectCatalogBody } = await import('../SubjectCatalogBody');

/**
 * The staging row `a6-c8-subjects-coverage-opens.test.tsx` uses, on its real
 * `Subject` field set. `LONG_NAME` is that row's own subject name, which is the
 * kind of name that was being cut: four words, 24 characters, in a column the
 * table's auto layout had already narrowed.
 */
const LONG_NAME = 'Edukasyon sa Pagkakaisa';
const OVERLONG_NAME = 'Contemporary Filipino sa Pambansang Kabuhayan sa Pagkakaisa ng Bayan';

function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 5,
		code: 'ESP/GMRC',
		name: LONG_NAME,
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
		updatedAt: '2026-10-03T00:00:00.000Z',
		...overrides,
	} as never;
}

const PARTIAL = { status: 'PARTIAL', ownedSectionCount: 18, relevantSectionCount: 20, uncoveredSectionCount: 2 } as never;

function rowFor(subject: unknown, onShowCoverage: (s: unknown) => void = () => {}) {
	return (
		<MemoryRouter>
			<TooltipProvider delayDuration={200}>
				<table><tbody>
					<SubjectRow
						subject={subject as never}
						timeMode="hours"
						coverageRow={PARTIAL}
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

const emptyCoverage = new Map<number, never>();
const emptyVerdict = new Map<number, never>();

/** The whole table, so the header row is mounted alongside the rows. */
function tableFor(subjects: unknown[], onReviewCoverage: (s: unknown) => void = () => {}) {
	return (
		<MemoryRouter>
			<TooltipProvider delayDuration={200}>
				<SubjectCatalogBody
					loading={false}
					paged={subjects as never}
					subjects={subjects as never}
					coverageBySubjectId={emptyCoverage}
					coverageVerdictBySubjectId={emptyVerdict}
					termAuthority={null}
					sortField="name"
					sortDir="asc"
					onToggleSort={() => {}}
					page={1}
					pageSize={10}
					totalFiltered={subjects.length}
					totalPages={1}
					onPageChange={() => {}}
					onPageSizeChange={() => {}}
					onReviewCoverage={onReviewCoverage}
					onEdit={() => {}}
					onArchive={() => {}}
					onDelete={() => {}}
					onReactivate={() => {}}
				/>
			</TooltipProvider>
		</MemoryRouter>
	);
}

/**
 * Render, read into PLAIN DATA, unmount, then assert. See the harness note above.
 *
 * `read` may be ASYNC. An earlier version of this file passed a sync reader, and
 * the difference is not cosmetic: Radix's Tooltip opens on a state update that
 * lands inside the same `act` block, so a reader that only observes before that
 * update sees `data-state="closed"` and every assertion downstream of it fails
 * for the same wrong reason. The `finally` unmount runs after the reader settles,
 * so an async reader is still safe to unmount against.
 */
async function snapshot<T>(node: React.ReactNode, read: (host: HTMLElement) => T | Promise<T>): Promise<T> {
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

/** Across the WHOLE document, because a portalled Tooltip renders on `document.body`. */
const bodyQuery = (sel: string) => document.body.querySelectorAll(sel);
const textOf = (node: Element | Document | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/* ═════════════════════ 1. the clipped name — room, and recovery ═════════ */

/**
 * ITEM 1, THE PRIMARY ASSERTION. The full name must be the element's ACCESSIBLE
 * NAME, and the element must not be a one-line ellipsis clip.
 *
 * The base failed this row twice over: the name was `truncate`d (so the visible
 * string was cut even though the DOM held it), and it carried no `aria-label` at
 * all, so nothing announced the full string.
 */
test('MR-71-1a the subject name carries the FULL string as its accessible name, not a clipped fragment', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture({ name: OVERLONG_NAME })),
		(host) => {
			const name = host.querySelector('[data-testid="subject-name"]') as HTMLElement | null;
			return {
				found: Boolean(name),
				tag: name?.tagName ?? 'NONE',
				accessibleName: name?.getAttribute('aria-label') ?? '',
				text: textOf(name),
				testid: name?.getAttribute('data-testid') ?? '',
			};
		},
	);
	assert.ok(seen.found, 'the row no longer exposes its subject name as a nameable element');
	assert.equal(seen.testid, 'subject-name', 'the name element lost its test id');
	assert.equal(
		seen.accessibleName,
		OVERLONG_NAME,
		`the full name must be the accessible name; got "${seen.accessibleName}"`,
	);
	assert.equal(
		seen.text,
		OVERLONG_NAME,
		'the rendered text is a fragment, not the whole name',
	);
});

/**
 * ITEM 1, THE NO-`title=` HALF. `AGENTS.md` §8 forbids a raw `title` attribute for
 * extra information, so recovery must come from an `@/ui` primitive. On the base
 * the name had neither a `title` nor any affordance.
 */
test('MR-71-1b the name discloses its full text through an @/ui Tooltip and never a raw title attribute', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture({ name: OVERLONG_NAME })),
		(host) => {
			const name = host.querySelector('[data-testid="subject-name"]') as HTMLElement;
			return {
				titleAttr: name.getAttribute('title'),
				tabindex: name.getAttribute('tabindex'),
				// A Tooltip trigger is described by a data-state the primitive owns.
				dataState: name.getAttribute('data-state'),
				role: name.getAttribute('role'),
			};
		},
	);
	assert.equal(seen.titleAttr, null, 'the name carries a raw `title=` attribute, which §8 forbids');
	assert.equal(
		seen.role,
		null,
		'the name must stay plain text — it is not a control, and recovery is by disclosure, not by pressing',
	);
	assert.equal(
		seen.tabindex,
		'0',
		'the name must be keyboard-reachable, or the full string is hover-only and fails WCAG 2.1.1',
	);
	assert.equal(
		seen.dataState,
		'closed',
		'the name is not an @/ui Tooltip trigger, so the full text is not recoverable on hover',
	);
});

/**
 * ITEM 1, THE HOVER HALF. The bubble is opened the way a user opens it — hover
 * over the trigger — and the full string must be read from the PORTALLED content,
 * which is where `@/ui/tooltip` mounts it (§8: the primitive, not a `title=`).
 *
 * The interaction happens INSIDE `snapshot`'s mounted window, because the bubble
 * is a child of the live React tree and cannot be opened on a node that has
 * already been unmounted. `pointerenter` is the event Radix Tooltip opens on
 * (`pointermove` alone does not open it, which is why the sequence is the one
 * recorded here rather than the one guessed).
 *
 * On the base this reads `NO_TOOLTIP_CONTENT`: the name had no way to show the
 * rest of itself at all.
 */
test('MR-71-1c hovering the name opens the full string in the @/ui Tooltip', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture({ name: OVERLONG_NAME })),
		async (host) => {
			const trigger = host.querySelector('[data-testid="subject-name"]') as HTMLElement;
			await act(async () => {
				trigger.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, cancelable: true }));
				trigger.dispatchEvent(new dom.window.MouseEvent('pointerenter', { bubbles: true, cancelable: true }));
				trigger.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
			});
			/* The primitive's OWN `delayDuration={200}`, not a shortened one. Radix
			 * arms the open on a timer after the pointer event, so reading the
			 * state in the same tick reads `closed` and would fail for the wrong
			 * reason. Waiting the real delay is also the honest test: it is the
			 * delay a user actually gets. */
			await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
			// The bubble is portalled onto `document.body`, outside this host.
			const bubble = document.body.querySelector('[data-radix-popper-content-wrapper]');
			return {
				triggerState: trigger.getAttribute('data-state'),
				describedBy: trigger.getAttribute('aria-describedby'),
				bubbleText: bubble ? textOf(bubble) : 'NO_TOOLTIP_CONTENT',
			};
		},
	);
	assert.equal(
		seen.triggerState,
		'delayed-open',
		`hovering the name did not open the @/ui Tooltip (trigger state "${seen.triggerState}"), so the clipped tail is unreachable`,
	);
	assert.notEqual(
		seen.describedBy,
		null,
		'the open Tooltip is not wired to the trigger, so assistive tech would not be told about it either',
	);
	assert.notEqual(
		seen.bubbleText,
		'NO_TOOLTIP_CONTENT',
		'no @/ui Tooltip content mounted, so the truncated tail is unreachable',
	);
	assert.ok(
		seen.bubbleText.includes(OVERLONG_NAME),
		`the bubble does not carry the full name; it read ${JSON.stringify(seen.bubbleText)}`,
	);
});

/**
 * ITEM 1, THE "ADJUST THE CONTAINER SIZE" HALF, asserted as the thing a user can
 * SEE rather than as a class name: the name is no longer a single-line ellipsis
 * clip, and its cell is not allowed to collapse to the smallest possible width.
 *
 * `truncate` and `line-clamp-2` are distinguished by the two properties the base
 * had and the fix must not: a single-line box, and an ellipsis overflow clip.
 * A control that merely mentioned `line-clamp` in a class list would pass
 * neither assertion, which is the point.
 */
test('MR-71-1d the name is no longer a one-line ellipsis clip, and the column has a declared width the table cannot squeeze', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture({ name: OVERLONG_NAME })),
		(host) => {
			const name = host.querySelector('[data-testid="subject-name"]') as HTMLElement;
			const cell = name.closest('td') as HTMLElement;
			return {
				nameClass: name.getAttribute('class') ?? '',
				cellClass: cell.getAttribute('class') ?? '',
			};
		},
	);
	/* The defect: `truncate` = `overflow:hidden` + `text-overflow:ellipsis` on
	 * ONE line. Its two signature classes are what a row is asserting are ABSENT. */
	assert.doesNotMatch(
		seen.nameClass,
		/(^|\s)truncate(\s|$)/,
		`the name is a truncation clip again — a long name will be cut: ${seen.nameClass}`,
	);
	assert.doesNotMatch(
		seen.nameClass,
		/(^|\s)whitespace-nowrap(\s|$)/,
		`the name can no longer wrap, so a long name is cut at whatever the column allows: ${seen.nameClass}`,
	);
	/* The two-line bound that replaces it. Asserted as a BOUNDED clamp, not as
	 * "unbounded wrapping": an unbounded wrap would let one long name grow the
	 * row without limit and push the table out of alignment, which is the other
	 * half of what this row is deciding. */
	assert.match(
		seen.nameClass,
		/(^|\s)line-clamp-2(\s|$)/,
		`the name has no bounded two-line clamp: ${seen.nameClass}`,
	);
	assert.match(
		seen.nameClass,
		/(^|\s)break-words(\s|$)/,
		`a long word in the name would overflow rather than break: ${seen.nameClass}`,
	);
	/* The container itself. `shrink-0` is the load-bearing half: a `w-*` alone is
	 * only a PREFERRED size, and it was the table's own auto layout squeezing
	 * this column to nothing that produced the defect. */
	assert.match(
		seen.cellClass,
		/(^|\s)w-[\w-]+(\s|$)/,
		`the name cell still declares no width, so the table still sizes it: ${seen.cellClass}`,
	);
	assert.match(
		seen.cellClass,
		/(^|\s)shrink-0(\s|$)/,
		`the name cell's declared width is not enforced, so the table can still squeeze it: ${seen.cellClass}`,
	);
});

/* ══════════════ 2. teacher coverage — plain text, information kept ═══════ */

/**
 * ITEM 2. "those under its column should be not clickable … just keep the current
 * information it has".
 *
 * The reversal removes the AFFORDANCE and never the STATUS. So this asserts BOTH
 * halves: not a link, not a button, not focusable, no click path — AND the cell
 * still renders its coverage figure in words.
 *
 * On the base of fix 2.17.1 the badge WAS a `<button>`, so this row is
 * discriminating rather than descriptive.
 */
test('MR-71-2a the teacher-coverage cell is not a link or a button, and still renders its coverage information', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture()),
		(host) => {
			const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]') as HTMLElement | null;
			assert.ok(cell, 'the coverage cell must render and keep its own test id');
			return {
				buttons: cell.querySelectorAll('button').length,
				links: cell.querySelectorAll('a[href]').length,
				anchors: cell.querySelectorAll('a').length,
				roleButtons: cell.querySelectorAll('[role="button"]').length,
				tabbables: cell.querySelectorAll('[tabindex]:not([tabindex="-1"])').length,
				cursorPointer: cell.querySelectorAll('.cursor-pointer').length,
				role: cell.getAttribute('role'),
				titleAttr: cell.querySelector('[title]') !== null,
				text: textOf(cell),
			};
		},
	);
	assert.equal(seen.buttons, 0, 'the coverage cell renders a <button> — it must be plain status text');
	assert.equal(seen.links, 0, 'the coverage cell renders a link — it must be plain status text');
	assert.equal(seen.anchors, 0, 'the coverage cell renders an anchor of any kind');
	assert.equal(seen.roleButtons, 0, 'the coverage cell carries role="button"');
	assert.equal(seen.tabbables, 0, 'the coverage cell has a keyboard stop, so it still looks operable');
	assert.equal(seen.cursorPointer, 0, 'the coverage cell still renders a pointer cursor, so it still looks pressable');
	assert.equal(seen.role, null, 'the coverage cell took on a role it does not have as a control');
	assert.equal(seen.titleAttr, false, 'the coverage cell fell back to a raw `title=` attribute, which §8 forbids');
	/* The information is KEPT — the operator asked to remove the click, not the words. */
	assert.match(seen.text, /18\/20 covered/, `the coverage figure was deleted with the affordance: ${JSON.stringify(seen.text)}`);
});

/**
 * ITEM 2, THE CLICK HALF. A cell that renders no control can still be clicked as
 * a DOM node, and on the base of fix 2.17.1 it was a real button. This dispatches
 * a click on the badge itself and proves nothing opened.
 */
test('MR-71-2b clicking the teacher-coverage badge opens nothing, while `Review` still opens coverage', async () => {
	const opened: unknown[] = [];
	await snapshot(
		rowFor(subjectFixture(), (s) => { opened.push(s); }),
		(host) => {
			const cell = host.querySelector('[data-testid="subject-coverage-cell-5"]') as HTMLElement;
			const badge = cell.querySelector('[data-slot="badge"]') as HTMLElement | null;
			assert.ok(badge, 'the coverage cell must still render its status badge');
			badge!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
			cell.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		},
	);
	assert.deepEqual(
		opened,
		[],
		'clicking the coverage badge reached the coverage opener; only `Review` may do that',
	);

	/* And the one control that may. Without this half, "not clickable" would be
	 * indistinguishable from "the feature was removed". */
	const openedByReview: unknown[] = [];
	await snapshot(
		rowFor(subjectFixture(), (s) => { openedByReview.push(s); }),
		(host) => {
			const review = Array.from(host.querySelectorAll('button'))
				.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('Review teacher coverage for')) as HTMLButtonElement | undefined;
			assert.ok(review, 'the row\'s labelled `Review` action must still render');
			assert.equal(textOf(review), 'Review', 'and it must still read exactly `Review`');
			review!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
		},
	);
	assert.equal(
		openedByReview.length,
		1,
		'`Review` no longer opens coverage — the reversal would be indistinguishable from removing the feature',
	);
});

/* ═════════════════ 3. the missing Action header, and the sticky head ═════ */

/**
 * ITEM 3. "there is a missing header, which is the 'action'". The table must
 * carry an `Action` column header, and it must be the LAST column header so it
 * labels the cell the `Review` button actually lives in.
 */
test('MR-71-3a the table header row carries an `Action` column header, last, labelling the cell Review lives in', async () => {
	const seen = await snapshot(
		tableFor([subjectFixture(), subjectFixture({ id: 6, name: OVERLONG_NAME })]),
		(host) => {
			const headers = Array.from(host.querySelectorAll('thead th')) as HTMLElement[];
			const columnHeaders = headers.filter((h) => (h.getAttribute('role') ?? 'columnheader') === 'columnheader');
			return {
				labels: columnHeaders.map((h) => textOf(h)),
				count: columnHeaders.length,
				// Where the `Review` button physically sits, by column index.
				reviewColumnIndex: (() => {
					const row = host.querySelector('tbody tr');
					if (!row) return -1;
					const cells = Array.from(row.querySelectorAll('td'));
					const reviewCell = cells.find((c) => c.querySelector('button[aria-label^="Review teacher coverage for"]'));
					return reviewCell ? cells.indexOf(reviewCell) : -1;
				})(),
			};
		},
	);
	assert.equal(seen.count, 6, `the catalog table has ${seen.count} column headers; it must keep its six columns`);
	assert.deepEqual(
		seen.labels,
		['Subject', 'Grade level / program', 'Weekly need', 'Room need', 'Teacher coverage', 'Action'],
		`the header row is not the six labels the columns need: ${JSON.stringify(seen.labels)}`,
	);
	assert.equal(
		seen.labels[seen.labels.length - 1],
		'Action',
		'the Action header is not last, so it does not label the column the action is in',
	);
	assert.equal(
		seen.reviewColumnIndex,
		5,
		`the \`Review\` button is in column ${seen.reviewColumnIndex}, which the last header must label`,
	);
});

/**
 * ITEM 3, THE SCROLL HALF. "when I scroll, the action header is going up until it
 * disappears". The header row must be sticky AND it must paint ABOVE the rows'
 * sticky action cells — which is the stacking half, and the half that was
 * actually broken before: both sat at `z-10`, so `tbody` won on document order.
 *
 * Asserted as the ORDER of two numbers, read off the rendered markup's own
 * declared tokens, because that is what decides the paint: the header's level
 * must be strictly greater than the body cells'.
 */
test('MR-71-3b the header row is sticky and outranks every body cell, so scrolling cannot take it away', async () => {
	const seen = await snapshot(
		tableFor([subjectFixture()]),
		(host) => {
			const thead = host.querySelector('thead') as HTMLElement | null;
			const actionCell = host.querySelector('tbody td.sticky') as HTMLElement | null;
			return {
				theadClass: thead?.getAttribute('class') ?? 'NO_THEAD',
				actionCellClass: actionCell?.getAttribute('class') ?? 'NO_ACTION_CELL',
			};
		},
	);
	assert.match(
		seen.theadClass,
		/(^|\s)sticky(\s|$)/,
		`the header row is not sticky, so it scrolls away: ${seen.theadClass}`,
	);
	assert.match(
		seen.theadClass,
		/(^|\s)top-0(\s|$)/,
		`the sticky header row has no top offset, so it sticks to nothing: ${seen.theadClass}`,
	);
	/* Opaque, or a row button underneath shows through the header. */
	assert.doesNotMatch(
		seen.theadClass,
		/\/(\d+)\b/,
		`the header row's background carries an alpha, so a row button is legible through it: ${seen.theadClass}`,
	);
	/* The stacking order, compared as numbers. */
	const zOf = (cls: string) => {
		const m = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(cls);
		return m ? Number(m[1]) : null;
	};
	const headZ = zOf(seen.theadClass);
	const cellZ = zOf(seen.actionCellClass);
	assert.ok(headZ !== null, `the header row declares no z-index: ${seen.theadClass}`);
	assert.ok(cellZ !== null, `the body action cell declares no z-index: ${seen.actionCellClass}`);
	assert.ok(
		headZ > cellZ,
		`the header row (z-${headZ}) does not outrank the body cells (z-${cellZ}); at equal z, tbody paints over thead`,
	);
	assert.match(
		seen.actionCellClass,
		/(^|\s)sticky(\s|$)/,
		`the body action cell is not sticky: ${seen.actionCellClass}`,
	);
});

/**
 * THE SUBTRACTION, restated so it cannot be undone silently. MR-71 asked for
 * room, not for the row back: the subject-CODE chip that A5 C3 / A2 removed must
 * stay removed.
 *
 * This is the guard the prior packet's reviewer required, and it is here because
 * a future "the name is clipped, so put the code back" change is exactly the
 * wrong fix — this row fails it.
 *
 * SCOPED HONESTLY. The row also carries the program chips, which are focusable
 * ON PURPOSE (`ProgramScopeChips`: their full name is keyboard-reachable, not
 * hover-only — asserted by `A5-C3-A3a`). So the keyboard-stop half is asserted
 * as "the set of stops is unchanged apart from the name", computed against the
 * baseline the sibling suite already pins, rather than as "exactly one stop on
 * the row", which would be false and would fail a correct future change that
 * makes something else reachable.
 */
test('MR-71-4 the subject-code chip stays GONE, and the row gained no keyboard stop but the name', async () => {
	const seen = await snapshot(
		rowFor(subjectFixture()),
		(host) => {
			const focusable = Array.from(host.querySelectorAll('[tabindex="0"]')) as HTMLElement[];
			return {
				codeElements: host.querySelectorAll('code').length,
				text: textOf(host),
				// Scoped to the row's own subject cell, so the program chips' own
				// deliberate focus stops are not counted as MR-71's doing.
				nameStops: focusable.filter((n) => n.getAttribute('data-testid') === 'subject-name').map((n) => textOf(n)),
				// Everything that is focusable and is NOT the name or a program chip:
				// any of these would be a new affordance MR-71 did not ask for.
				otherStops: focusable
					.filter((n) => n.getAttribute('data-testid') !== 'subject-name')
					.filter((n) => n.closest('[data-testid="subject-program-chips"]') === null)
					.map((n) => textOf(n)),
				codeFocusStops: focusable.filter((n) => (n.textContent ?? '').includes('ESP/GMRC')).length,
			};
		},
	);
	assert.equal(seen.codeElements, 0, 'the subject code is a <code> chip on the row again');
	assert.equal(seen.text.includes('ESP/GMRC'), false, 'the raw subject code is rendered on the row again');
	assert.equal(seen.codeFocusStops, 0, 'the row spends a keyboard stop on the subject code again');
	/* Exactly ONE new stop, and it is the name — focusable because the full string
	 * must be recoverable by keyboard. */
	assert.deepEqual(
		seen.nameStops,
		[LONG_NAME],
		`the name's keyboard stops are ${JSON.stringify(seen.nameStops)}; MR-71 adds exactly one`,
	);
	assert.deepEqual(
		seen.otherStops,
		[],
		`MR-71 added keyboard stops that are neither the name nor a program chip: ${JSON.stringify(seen.otherStops)}`,
	);
});