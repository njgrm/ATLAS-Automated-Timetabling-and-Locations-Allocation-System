/**
 * A5 C3 (2026-09-29) — the `/subjects` calm surface, and the shared picker's own contract.
 *
 * WHAT THIS DECIDES. The operator screenshotted `/subjects` on 2026-09-29 and `AGENTS.md` §11's
 * preamble names this screen as one of the four live defects the Design judgement gate was
 * written about: *"Subjects filters as pills beside rectangular pickers, two reading `All...`,
 * spelled-out program names, raw `OWNER_DEPT:` strings. Each passed its tests, its QA and a
 * screenshot."*
 *
 * So this suite is NOT a locator. Every row below is an assertion the OLD surface would have
 * failed, which is the only kind that changes behaviour. `AGENTS.md` §11: a user-facing fix is
 * done when it is SEEN rendered, and this suite supports that proof — it never replaces it. The
 * planner owns the rendered rows; the assertions here are shaped so the committed tests and the
 * browser rows read the SAME fixture.
 *
 * THE FIXTURE IS THE REAL SURFACE (§11: "a control's fixture must come from the real surface —
 * the real `Subject.programScopes`, `requiredFeatures`, `gradeLevels`, `preferredRoomType`").
 * It is the same field set `a3-c4-subjects-copy.test.tsx` renders, so a failure here is a
 * difference in presentation, not in shape.
 *
 * ONE HARNESS RULE WORTH KNOWING, because it cost a cycle to find. Every test goes through
 * `snapshot()`, which renders, reads what it needs into PLAIN DATA, and UNMOUNTS before any
 * assertion runs. A test that throws while a React tree is still mounted leaves this runner
 * unable to reach an idle event loop: the child exits `-1` ~15s later and the harness reports a
 * bare `test failed` with no message, which looks like a crash and hides the real assertion.
 * Observing first and asserting after makes every failure legible, whether it passes or not.
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
const { SubjectRow } = await import('../SubjectRow');
const { SubjectMobileCard } = await import('../SubjectMobileCard');
const { SubjectFilterToolbar } = await import('../SubjectFilterToolbar');
const { subjectFeatureHelp, splitSubjectFeatures } = await import('../subject-feature-presentation');

/** Render, read into plain data, unmount. See the harness note at the top of this file. */
async function snapshot<T>(node: React.ReactNode, read: (host: HTMLElement) => T): Promise<T> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => { root.render(node); });
	let value: T;
	try {
		value = read(host);
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
	return value;
}

/** What a scheduler READS, with assistive-only nodes removed. */
function operatorText(host: HTMLElement): string {
	const clone = host.cloneNode(true) as HTMLElement;
	const noise = clone.querySelectorAll('[aria-hidden="true"],.sr-only,[data-radix-popper-content-wrapper]');
	for (let i = 0; i < noise.length; i += 1) noise[i].remove();
	return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The triggers inside ONE host element. Superseded by `allTriggers()` for the A1
 * rows in A5 C4: a filter behind the `More filters` disclosure is portalled to
 * `document.body`, so a host-scoped query can no longer see all five. Kept, not
 * deleted, because it is the honest expression of "the triggers this host owns" and
 * the superseded assertion is quoted in the A1b comment.
 */
function comboboxes(host: HTMLElement): HTMLElement[] {
	return Array.from(host.querySelectorAll('[role="combobox"]')) as HTMLElement[];
}

/** The real `Subject` surface, matching the field set the Subjects row actually receives. */
function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 41,
		code: 'SCI10',
		name: 'Earth Science',
		displayCode: 'SCI10',
		outputLabel: null,
		ownerDepartment: 'AP',
		allowedOwnerDepartments: ['AP'],
		qualificationPriority: 'DEPARTMENT_FIRST' as const,
		rotationFamily: null,
		minMinutesPerWeek: 225,
		preferredRoomType: 'LAB' as never,
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [9],
		interSectionEnabled: false,
		interSectionGradeLevels: [] as number[],
		modularGroupId: null,
		modularOrder: null,
		/* TWO scopes, not one: the single-scope case renders one chip and would pass
		 * while the `"{n} programs"` count was still there. Two proves the count is
		 * gone and that a second chip appears. */
		programScopes: ['REGULAR', 'STE'],
		allowedSpecializations: [] as string[],
		/* A real mixed `requiredFeatures`: one ownership marker the glossary can
		 * expand, one it cannot, and one genuine room feature. */
		requiredFeatures: ['OWNER_DEPT:AP', 'OWNER_DEPT:MAPEH', 'LAB_BENCH'] as string[],
		rotationTermLabel: null,
		rotationTermRank: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		updatedAt: '2026-09-28T00:00:00.000Z',
		...overrides,
	} as never;
}

function rowFor(subject: unknown) {
	return (
		<MemoryRouter>
			<table><tbody>
				<SubjectRow
					subject={subject as never}
					timeMode="hours"
					onEdit={() => {}}
					onDelete={() => {}}
					onArchive={() => {}}
					onReactivate={() => {}}
					onShowCoverage={() => {}}
				/>
			</tbody></table>
		</MemoryRouter>
	);
}

function cardFor(subject: unknown) {
	return (
		<MemoryRouter>
			<SubjectMobileCard
				subject={subject as never}
				coverageRow={null}
				onReviewCoverage={() => {}}
				onEdit={() => {}}
				onArchive={() => {}}
				onReactivate={() => {}}
				onDelete={() => {}}
			/>
		</MemoryRouter>
	);
}

function toolbarFor(overrides: Record<string, unknown> = {}) {
	return (
		<SubjectFilterToolbar
			searchQuery=""
			onSearchChange={() => {}}
			hasActiveFilters={false}
			subjectStatusFilter="all"
			onSubjectStatusFilterChange={() => {}}
			roomTypeFilter="all"
			onRoomTypeFilterChange={() => {}}
			gradeLevelFilter={'all'}
			onGradeLevelFilterChange={() => {}}
			programScopeFilter="all"
			onProgramScopeFilterChange={() => {}}
			termFilter="all"
			onTermFilterChange={() => {}}
			termOptions={[
				{ value: 'all', label: 'All terms', kind: 'all' as const },
				{ value: '1', label: 'Term 1', kind: 'term' as const },
			]}
			onResetFilters={() => {}}
			{...overrides}
		/>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// A1 — the filters name themselves, in one even box, at the search height
//
// A5 C4, RE-POINTED (2026-09-29). Both A1 rows used to render the toolbar
// CLOSED and assert on all five triggers at once. Three of them — Status, Room and
// Term — now sit behind the ONE `More filters` disclosure on the packet's finding
// ("Keep Grade and Program visible and put the other filters under 'More
// filters'"), so a closed render can only ever see two.
//
// The properties these rows exist for are UNCHANGED and are now asserted over ALL
// FIVE, with the disclosure open, because §8's "one look per control" is decided by
// a control's LOOK and not by which row it happens to sit in:
//   - every trigger shows its own name and a short value, and keeps its long
//     accessible name (A1a);
//   - every trigger is ONE even width at the shared `h-9` height (A1b).
// That is a stronger gate than the two it replaces: the three hidden filters are now
// proven to look identical to the two visible ones, which the old closed render
// could not check. The two controls that stayed in the row are additionally
// asserted to be exactly two, so the subtraction cannot silently reverse.
// ─────────────────────────────────────────────────────────────────────────────

/** Real pointer sequence, the way a mouse opens a control. */
async function press(target: Element | null): Promise<void> {
	assert.ok(target, 'the element to press is not in the document');
	await act(async () => {
		const t = target as Element;
		const init = { bubbles: true, cancelable: true, button: 0 };
		t.dispatchEvent(new dom.window.MouseEvent('pointerdown', init));
		t.dispatchEvent(new dom.window.MouseEvent('pointerup', init));
		t.dispatchEvent(new dom.window.MouseEvent('click', init));
	});
	await act(async () => { await Promise.resolve(); });
}

/** Every `role=combobox` currently rendered, wherever the filter lives. */
function allTriggers(): HTMLElement[] {
	return Array.from(document.body.querySelectorAll('[role="combobox"]')) as HTMLElement[];
}

/**
 * Open the ONE `More filters` disclosure, idempotently — it is a toggle, so a bare
 * click in a sequence would close it again and the filters under test would vanish.
 */
async function openMoreFilters(): Promise<void> {
	if (document.body.querySelector('[data-testid="subjects-status-filter"]') !== null) return;
	await press(document.body.querySelector('[data-testid="subjects-more-filters"]'));
	assert.ok(
		document.body.querySelector('[data-testid="subjects-status-filter"]'),
		'clicking `More filters` did not reveal the refinement filters',
	);
}

/**
 * `snapshot`, plus an INTERACTION before the read.
 *
 * The harness rule at the top of this file is that every assertion runs AFTER the
 * tree is unmounted, because a throw while React is still mounted leaves the runner
 * unable to reach an idle event loop. Opening a disclosure has to happen while the
 * tree IS mounted, so the interaction lives here rather than in the caller's test
 * body, and `read` still only ever returns plain data.
 */
async function interactiveSnapshot<T>(
	node: React.ReactNode,
	interact: () => Promise<void>,
	read: (host: HTMLElement) => T,
): Promise<T> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	await act(async () => { root.render(node); });
	let value: T;
	try {
		await interact();
		value = read(host);
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
	return value;
}

test('A5-C3-A1a: every trigger shows its own name and a short value, and the accessible name stays long', async () => {
	// RED ON BASE at the disclosure step: there is no `subjects-more-filters` to
	// press, so the two visible and the three hidden cannot both be read.
	const seen = await interactiveSnapshot(toolbarFor(), openMoreFilters, () => allTriggers().map((t) => ({
		visible: (t.textContent ?? '').replace(/\s+/g, ' ').trim(),
		aria: t.getAttribute('aria-label'),
	})));
	/* The operator's own defect: "two filters read only `All...` … nobody can tell what they
	 * filter." A trigger whose visible text does not contain its own name is that defect. */
	/* A5 C3 R3 §1: the VISIBLE face is the operator's `{ShortName}: {ShortValue}` — the
	 * fixed rectangle holds one word, not a phrase. The full labels live in the popover and
	 * the accessible name, which a screen reader reads with no width limit. */
	const expected = [
		{ visible: 'Grade: All', aria: 'Filter by grade level: All grades' },
		{ visible: 'Program: All', aria: 'Filter by program scope: All programs' },
		{ visible: 'Status: All', aria: 'Filter by subject status: All statuses' },
		{ visible: 'Room: All', aria: 'Filter by room type: All room types' },
		{ visible: 'Term: All', aria: 'Filter by rotation term: All terms' },
	];
	assert.equal(seen.length, 5, 'the filter set lost or gained a control');
	for (const { visible, aria } of seen) {
		const want = expected.find((e) => e.aria === aria);
		assert.ok(want, `a trigger lost its long accessible name: ${aria}`);
		assert.equal(visible, want.visible, `${aria} does not show its own name and a short value`);
		assert.doesNotMatch(visible, /^All\b/, `${aria} still opens with a bare "All…"`);
		// A trigger with NO accessible name is the defect this row exists for, so
		// the null is rejected here rather than handed to `assert.match`.
		assert.ok(aria, 'a filter trigger has no accessible name at all');
		assert.match(aria as string, /^Filter by /, `${aria} lost its long accessible name`);
	}
	// AND the two the row keeps are exactly the two the packet kept there, so the
	// subtraction cannot silently reverse while this row still passes.
	const inRow = await snapshot(toolbarFor(), (host) =>
		host.querySelectorAll('[data-testid="subjects-filter-cluster"] [role="combobox"]').length,
	);
	assert.equal(inRow, 2, `expected 2 directly-visible filters, found ${inRow}`);
});

test('A5-C3-A1b: the five triggers are ONE even width, and the search input shares the height token (R1 J3)', async () => {
	// A5 C4, RE-POINTED: the three filters behind the disclosure are read too, so
	// the "one look per control" claim covers all five rather than the two the row
	// happens to show. Superseded verbatim:
	//   const triggers = comboboxes(host);   // the CLOSED toolbar's two triggers
	//   assert.equal(<classes carrying h-9>.length, 5, ...)
	const seen = await interactiveSnapshot(toolbarFor(), openMoreFilters, (host) => {
		const triggers = allTriggers();
		const search = host.querySelector('input[placeholder^="Search name"]') as HTMLElement | null;
		return {
			widths: triggers.map((t) => /(^|\s)(w-[\w-]+)/.exec(t.className)?.[2] ?? 'NONE'),
			heights: triggers.map((t) => /(^|\s)(h-[\w-]+)/.exec(t.className)?.[2] ?? 'NONE'),
			classes: triggers.map((t) => t.className),
			// RE-PINNED BY A7 C8 SLICE 1 (2026-09-29): the shared height token moved
			// h-9 -> h-10 (36px -> 40px). The CLAIM is unchanged: the search box and all
			// five triggers still share ONE height token.
			withSharedHeight: triggers.filter((t) => /(^|\s)h-10(?:\s|$)/.test(t.className)).length,
			searchClass: search?.className ?? 'NO_SEARCH_INPUT',
		};
	});
	assert.equal(seen.widths.length, 5, `expected 5 triggers, found ${seen.widths.length}`);
	assert.equal(new Set(seen.widths).size, 1, `the five filters carry ${new Set(seen.widths).size} different widths: ${seen.widths.join(' | ')}`);
	assert.match(seen.widths[0] ?? '', /^w-/, `a trigger has no real width class: ${seen.classes[0]}`);
	/* Exactly one width class each, so the old `w-40 / w-24 / w-28 / w-36 / w-28` cannot come
	 * back as a second, unmerged declaration. */
	assert.equal(
		seen.classes.filter((c) => (c.match(/(?:^|\s)w-[\w-]+/g) ?? []).length !== 1).length,
		0,
		'a trigger carries more than one width class, so its rendered width is ambiguous',
	);
	/* R1 J3: the search box and the triggers must share the height TOKEN, not two
	 * hand-matched literals. */
	// RE-PINNED BY A7 C8 SLICE 1: h-9 -> h-10, same claim, see the note above.
	assert.match(seen.searchClass, /(^|\s)h-10(\s|$)/, `the search input no longer uses the shared height token: ${seen.searchClass}`);
	seen.heights.forEach((height, index) => {
		assert.equal(height, 'h-10', `trigger ${index} does not use the shared height token: ${seen.classes[index]}`);
	});
	assert.equal(
		seen.withSharedHeight,
		5,
		'every trigger must carry the shared height, with no competing height left in the class list',
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// A2 — the subject code is gone from the row and the card
// ─────────────────────────────────────────────────────────────────────────────

test('A5-C3-A2a: the desktop row shows no subject-code chip, and nothing on it focuses the code', async () => {
	const seen = await snapshot(rowFor(subjectFixture()), (host) => {
		const focusable = Array.from(host.querySelectorAll('[tabindex="0"]')) as HTMLElement[];
		return {
			codeElements: host.querySelectorAll('code').length,
			codeFocusStops: focusable.filter((n) => (n.textContent ?? '').includes('SCI10')).length,
			text: operatorText(host),
		};
	});
	assert.equal(seen.codeElements, 0, 'the subject code is still a <code> chip on the row');
	/* The chip was `tabIndex={0}` with a 40-word aria-label: a keyboard stop on every row
	 * of the catalog that led nowhere the scheduler needed to go. */
	assert.equal(seen.codeFocusStops, 0, 'the subject code is still a focusable element on the row');
	assert.equal(seen.text.includes('SCI10'), false, 'the code still appears in the row text');
	/* The name is the title, and the status badge stays. */
	assert.match(seen.text, /Earth Science/);
	assert.match(seen.text, /Active/);
});

test('A5-C3-A2b: the mobile card shows no subject-code chip either', async () => {
	const seen = await snapshot(cardFor(subjectFixture()), (host) => ({
		codeElements: host.querySelectorAll('code').length,
		text: operatorText(host),
	}));
	assert.equal(seen.codeElements, 0, 'the subject code is still a chip on the mobile card');
	assert.equal(seen.text.includes('SCI10'), false, 'the code still appears in the mobile card text');
});

// ─────────────────────────────────────────────────────────────────────────────
// A3 — programs are chips, and never a count or a spelled-out name
// ─────────────────────────────────────────────────────────────────────────────

test('A5-C3-A3a: program coverage renders one abbreviated chip per scope, never "N programs"', async () => {
	const seen = await snapshot(rowFor(subjectFixture()), (host) => {
		const chips = Array.from(host.querySelectorAll('[data-testid="subject-program-chips"] span')) as HTMLElement[];
		return {
			labels: chips.map((c) => (c.textContent ?? '').trim()),
			described: chips.map((c) => c.getAttribute('aria-label') ?? ''),
			focusable: chips.length > 0 ? chips[0].getAttribute('tabindex') : null,
			text: operatorText(host),
		};
	});
	assert.deepEqual(seen.labels, ['BEC', 'STE'], 'program scopes are not one abbreviated chip each');
	assert.doesNotMatch(seen.text, /\d+ programs/, 'the "{n} programs" count is still rendered');
	assert.doesNotMatch(seen.text, /Science, Technology, and Engineering/, 'the spelled-out program name is still the visible label');
	/* The full name is preserved, one hover away in an @/ui Tooltip (J4), and each chip is
	 * keyboard-reachable so that name is not a hover-only extra. */
	assert.ok(
		seen.described.some((d) => d.includes('Science, Technology, and Engineering')),
		'the full program name is no longer reachable',
	);
	assert.equal(seen.focusable, '0', 'a program chip is not keyboard-focusable');
});

test('A5-C3-A3b: a scope code outside the operator\'s abbreviation list falls back to the glossary short label, and an unmapped code keeps a neutral colour', async () => {
	const seen = await snapshot(rowFor(subjectFixture({ programScopes: ['SPJ', 'SPZZ'] })), (host) => {
		const chips = Array.from(host.querySelectorAll('[data-testid="subject-program-chips"] span')) as HTMLElement[];
		return { labels: chips.map((c) => (c.textContent ?? '').trim()), classes: chips.map((c) => c.className) };
	});
	assert.deepEqual(seen.labels, ['SPJ', 'SPZZ'], 'an unmapped program scope is hidden or numbered instead of named');
	/* An unmapped code must not be dropped, and must not be given a colour we invented. */
	assert.doesNotMatch(
		seen.classes[1] ?? '',
		/bg-(red|green|yellow|blue|indigo|purple|orange|sky|emerald|amber)-/,
		'an unmapped program code was given an invented palette',
	);
});

test('A5-C3-A3c: the mobile card gives programs their own line instead of joining them onto the grade value', async () => {
	const seen = await snapshot(cardFor(subjectFixture()), (host) => {
		const gradeRow = Array.from(host.querySelectorAll('div')).find(
			(d) => d.textContent?.includes('Grade level') && !d.textContent?.includes('Coverage'),
		) as HTMLElement | undefined;
		return { gradeRowText: gradeRow?.textContent ?? 'NO_GRADE_ROW', text: operatorText(host) };
	});
	assert.notEqual(seen.gradeRowText, 'NO_GRADE_ROW', 'the Grade level row is gone');
	assert.doesNotMatch(seen.gradeRowText, /·/, 'the grade value still carries a second fact joined onto it');
	assert.match(seen.text, /BEC/, 'the mobile card lost the program chips');
});

// ─────────────────────────────────────────────────────────────────────────────
// J6 / J7 — the ownership read is a comma list, and the storage prefix is gone
// ─────────────────────────────────────────────────────────────────────────────

test('A5-C3-J7a: the ownership line is "Owned by AP, MAPEH" — a comma list, with no "department" noun', async () => {
	const mixed = await snapshot(rowFor(subjectFixture()), (host) => operatorText(host));
	assert.match(mixed, /Owned by AP, MAPEH/, 'the ownership line is not the comma list the operator asked for');
	assert.doesNotMatch(mixed, /department/i, 'the redundant "department" noun is still on the primary line');
	/* The named-department case must lose the noun too, without losing the name. */
	const named = await snapshot(rowFor(subjectFixture({ requiredFeatures: ['OWNER_DEPT:AP'] })), (host) => operatorText(host));
	assert.match(named, /Owned by Araling Panlipunan(?! department)/);
});

test('A5-C3-J6a: no OWNER_DEPT string is reachable anywhere on /subjects — row, card, or the detail affordance', async () => {
	const row = await snapshot(rowFor(subjectFixture()), (host) => ({ html: host.innerHTML, text: operatorText(host) }));
	/* The operator's words: "no raw `OWNER_DEPT:<code>` strings anywhere". */
	assert.doesNotMatch(row.html, /OWNER_DEPT/, 'the row still contains a raw OWNER_DEPT string');
	assert.doesNotMatch(row.text, /OWNER_DEPT/, 'the row text still contains a raw OWNER_DEPT string');

	const card = await snapshot(cardFor(subjectFixture()), (host) => host.innerHTML);
	assert.doesNotMatch(card, /OWNER_DEPT/, 'the mobile card still contains a raw OWNER_DEPT string');

	/* And the DETAIL, which is the surface the old code reached through. The owning codes
	 * are the diagnostic, so the sentence keeps them and loses the syntax. */
	const help = subjectFeatureHelp(splitSubjectFeatures(['OWNER_DEPT:AP', 'OWNER_DEPT:MAPEH', 'LAB_BENCH']));
	assert.doesNotMatch(help, /OWNER_DEPT/, `the detail sentence still prints the storage prefix: ${help}`);
	assert.match(help, /ATLAS records the owning codes as AP and MAPEH\./, `the detail sentence no longer names the owning codes: ${help}`);
	assert.match(help, /LAB_BENCH/, 'the real room feature dropped out of the detail');
});

test('A5-C3-A5/J7b: the primary ownership read A5-C2B already fixed is still correct — R2-4 says prove it, do not re-fix it', async () => {
	/* `ac8adf09` removed the marker from the PRIMARY line. This row exists so a later
	 * cycle cannot quietly "improve" a correct line, and so the planner's rendered row has
	 * a committed source-side counterpart to compare against. */
	const text = await snapshot(rowFor(subjectFixture({ requiredFeatures: ['OWNER_DEPT:MAPEH'] })), (host) => operatorText(host));
	assert.match(text, /Owned by MAPEH/);
	assert.doesNotMatch(text, /OWNER_DEPT|department/i);
});
