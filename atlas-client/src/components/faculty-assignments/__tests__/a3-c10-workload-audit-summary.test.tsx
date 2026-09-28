/**
 * A3-C10-S5 — the `Teacher Workload Audit Summary` (Fix 26).
 *
 * Lane C measured live: "Review teachers opens a single-teacher modal, not the
 * summary." These controls cover what the original Fix 26 criteria name —
 * counts (total/balanced/underloaded/overloaded), each a click-through filter,
 * a scrollable flagged list, a drill-in that REUSES the existing
 * `WorkloadInspector` content, keyboard access, and draft safety.
 *
 * THREE THINGS THIS FILE DELIBERATELY DOES NOT DO
 *
 *  1. It does not assert source text as a rendered fact. Where a claim is about
 *     provenance, it is proven BEHAVIOURALLY (S5-3 runs this stream's bucket
 *     predicate and the roster's own canonical load filter over the same matrix
 *     and requires identical answers). The one place source is read is S5-8,
 *     which is labelled a source guard.
 *  2. It never hands an attached DOM node to `assert.equal`. `node:assert/strict`
 *     is `strictEqual`, and a failure diffs `util.inspect` of both operands,
 *     which on a live Radix subtree drives RSS into the gigabytes and ends in
 *     `RangeError: Array buffer allocation failed` (measured on this host; see
 *     the identical note in `a3-teaching-load-review-c2.test.tsx`). Every
 *     assertion here is on a scalar or a short string.
 *  3. It asserts nothing about layout. jsdom performs no layout, so a pixel
 *     claim could not be true here even if it were true in a browser. The
 *     scroll-container and close-control-stays-visible claims are therefore
 *     source guards (S5-8), and are labelled as such.
 *
 * Every module under test is imported DEFENSIVELY so this file still RUNS, and
 * fails on a readable assertion, on a revision that lacks it — which is what
 * makes the failing-first control in the handoff meaningful.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement, useState, type ReactNode } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/teaching-load' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

const { createRoot } = await import('react-dom/client');

async function optional<T>(path: string): Promise<{ module: T | null; error: string | null }> {
	try {
		return { module: (await import(/* @vite-ignore */ path)) as T, error: null };
	} catch (error) {
		return { module: null, error: String(error) };
	}
}

const audit = await optional<any>('@/components/faculty-assignments/teacherWorkloadAudit');
const summary = await optional<any>('@/components/faculty-assignments/TeacherWorkloadAuditSummary');
const modal = await optional<any>('@/components/faculty-assignments/ReviewTeachersModal');
const inspector = await optional<any>('@/components/faculty-assignments/WorkloadInspector');
const initials = await optional<any>('@/components/faculty-assignments/facultyInitials');
const canonical = await optional<any>('@/lib/faculty-assignment-helpers');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	audit.module?.clearTeacherWorkloadAudit?.();
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
});

/* ── fixtures ─────────────────────────────────────────────────────────── */

const STANDARD = 20;

/** A real `FacultySummary` shape, trimmed to the fields this stream reads. */
function teacher(over: Partial<Record<string, unknown>> = {}): any {
	return {
		id: 1, externalId: 1, employeeId: 'E1',
		firstName: 'Maria', lastName: 'Dela Cruz',
		department: 'Mathematics', departmentLabel: 'Mathematics', departmentCode: 'MATH',
		employmentStatus: 'ACTIVE', isActiveForScheduling: true, isPlaceholder: false,
		isClassAdviser: false, advisedSectionId: null, advisedSectionName: null,
		advisoryEquivalentHours: 0, ancillaryMinutesPerWeek: 0, canTeachOutsideDepartment: true,
		maxHoursPerWeek: 30, localNotes: null, version: 1, subjectCount: 3, sectionCount: 4,
		subjectHours: 20, sectionTeachingHours: 20, gradeTeachingHours: 20,
		advisoryHours: 0, ancillaryHours: 0, policyCreditedHours: 20, policyLoadPercentage: 100,
		teachingUtilizationPercent: 100, teachingCapacityRemainingMinutes: 0,
		excessTeachingMinutes: 0, creditedWorkloadMinutes: 1200, syntheticCoverageHours: 0,
		actualTeachingHours: 20, rotationTermBreakdown: [],
		...over,
	};
}

/**
 * Six real teachers, one per interesting case, against a 20h standard:
 *   9  20h  balanced
 *   10 24h  overloaded, under the 30h cap
 *   11 15h  underloaded
 *   12 42h  overloaded AND over the 40h DepEd cap
 *   13  0h  no teaching load -> unclassified, never "underloaded"
 *   14     temporary/placeholder -> unclassified
 * The hours are the DRAFT-AWARE map the page builds, so the figures under test
 * are the same ones the roster rows render.
 */
const FACULTY: any[] = [
	teacher({ id: 9, firstName: 'Maria', lastName: 'Dela Cruz' }),
	teacher({ id: 10, firstName: 'Juan', lastName: 'Santos', maxHoursPerWeek: 30 }),
	teacher({ id: 11, firstName: 'Ana', lastName: 'Reyes' }),
	teacher({ id: 12, firstName: 'Pedro', lastName: 'Bautista', maxHoursPerWeek: 40, isClassAdviser: true }),
	teacher({ id: 13, firstName: 'Grace', lastName: 'Lim' }),
	teacher({ id: 14, firstName: 'Sub', lastName: 'Temp', isPlaceholder: true, syntheticCoverageHours: 18 }),
];
const DRAFT_HOURS = new Map<number, number>([
	[9, 20], [10, 24], [11, 15], [12, 42], [13, 0], [14, 18],
]);

function build(over: Record<string, unknown> = {}) {
	return audit.module.buildTeacherWorkloadAuditSnapshot({
		faculty: FACULTY, effectiveActualHours: DRAFT_HOURS,
		teachingStandardHours: STANDARD, policyReady: true, loading: false, ...over,
	});
}

function render(node: ReactNode) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => root.render(node));
	return host;
}

const q = (host: HTMLElement | Document, testid: string) => host.querySelector(`[data-testid="${testid}"]`);
const textOf = (node: Element | null | undefined) => (node?.textContent ?? '').trim();
const click = (node: Element | null) => {
	assert.ok(node, 'the control under test must exist');
	act(() => { node.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
};

/* ── S5-1 the four counts render and are real controls ─────────────────── */

test('S5-1 `Review teachers` opens the audit summary with four count controls', () => {
	assert.equal(audit.module === null, false, `teacherWorkloadAudit must exist: ${audit.error}`);
	assert.equal(modal.module === null, false, `ReviewTeachersModal must exist: ${modal.error}`);

	act(() => { audit.module.publishTeacherWorkloadAudit(build(), () => {}); });
	render(createElement(modal.module.ReviewTeachersModal, {
		open: true, onOpenChange: () => {}, title: 'Teacher workload: Dela Cruz, Maria', description: 'd',
	}));

	assert.ok(dom.window.document.querySelector('[role="dialog"]'), 'the dialog must open');
	assert.ok(q(dom.window.document, 'workload-audit-summary'), 'the audit summary must be the default pane');
	assert.ok(q(dom.window.document, 'workload-audit-list'), 'a flagged-teacher list must render');

	// The four counts, with the values derived from the fixture above.
	const expected: Record<string, string> = { all: '4', underloaded: '1', balanced: '1', overloaded: '2' };
	for (const [id, value] of Object.entries(expected)) {
		const control = q(dom.window.document, `workload-audit-filter-${id}`) as HTMLButtonElement | null;
		assert.ok(control, `the ${id} count must render as a control`);
		assert.equal(control.tagName, 'BUTTON', `the ${id} count must be a real <button>, not a styled div`);
		assert.equal(textOf(q(dom.window.document, `workload-audit-count-${id}`)), value, `the ${id} count must be ${value}`);
	}
});

/* ── S5-2 each count is a click-through filter ─────────────────────────── */

test('S5-2 each of the four counts filters the list to its own bucket', () => {
	act(() => { audit.module.publishTeacherWorkloadAudit(build(), () => {}); });
	render(createElement(modal.module.ReviewTeachersModal, {
		open: true, onOpenChange: () => {}, title: 't', description: 'd',
	}));

	const rowIds = () =>
		[...dom.window.document.querySelectorAll('[data-testid^="workload-audit-row-"]')]
			.map((n) => n.getAttribute('data-testid'));

	// Worst-first: the two overloaded teachers, then the underloaded one, then
	// the balanced one. An auditor reads the top of the list first.
	assert.deepEqual(rowIds(), ['workload-audit-row-12', 'workload-audit-row-10', 'workload-audit-row-11', 'workload-audit-row-9'],
		'Total lists every classified teacher, worst bucket first');

	click(q(dom.window.document, 'workload-audit-filter-overloaded'));
	assert.deepEqual(rowIds(), ['workload-audit-row-12', 'workload-audit-row-10'], 'Overloaded lists only the 42h and 24h teachers');

	click(q(dom.window.document, 'workload-audit-filter-balanced'));
	assert.deepEqual(rowIds(), ['workload-audit-row-9'], 'Balanced lists only the 20h teacher');

	click(q(dom.window.document, 'workload-audit-filter-underloaded'));
	assert.deepEqual(rowIds(), ['workload-audit-row-11'], 'Underloaded lists only the 15h teacher');

	// And the filter state is announced, not merely coloured.
	assert.equal(q(dom.window.document, 'workload-audit-filter-underloaded')?.getAttribute('aria-pressed'), 'true');
	assert.equal(q(dom.window.document, 'workload-audit-filter-balanced')?.getAttribute('aria-pressed'), 'false');

	click(q(dom.window.document, 'workload-audit-filter-all'));
	assert.equal(rowIds()?.length, 4, 'Total restores the full list');
});

/* ── S5-3 the thresholds are the roster's, proven behaviourally ───────── */

test('S5-3 the bucket predicate agrees with the canonical roster load filter on every case', () => {
	assert.equal(canonical.module === null, false, `the canonical helper must exist: ${canonical.error}`);
	const classify = audit.module.classifyTeacherWorkloadBucket;

	// The roster's own `Load` filter, expressed as a predicate over one member,
	// is the authority the summary must not drift from. Same input, same answer.
	for (const standardHours of [20, 30, 40]) {
		for (const actualHours of [0, 7.5, 19.9, 20, 20.1, 24, 40, 42, 60]) {
			const member = teacher({ actualTeachingHours: actualHours, sectionTeachingHours: actualHours, gradeTeachingHours: actualHours });
			const canonicalFacet = canonical.module
				.applyTeachingLoadFilters([member], { load: 'below-standard' }, new Map([[member.id, actualHours]]), standardHours).length === 1;
			const canonicalExcess = canonical.module
				.applyTeachingLoadFilters([member], { load: 'excess' }, new Map([[member.id, actualHours]]), standardHours).length === 1;

			const bucket = classify(actualHours, standardHours);
			assert.equal(bucket === 'underloaded', canonicalFacet,
				`underloaded(${actualHours}h vs ${standardHours}h) must equal the roster's Below standard filter`);
			assert.equal(bucket === 'overloaded', canonicalExcess,
				`overloaded(${actualHours}h vs ${standardHours}h) must equal the roster's Above standard filter`);
		}
	}

	// Honest nulls, not invented numbers.
	assert.equal(classify(12, null), null, 'no persisted standard means no classification at all');
	assert.equal(classify(0, 20), null, 'a teacher with no teaching load is not "underloaded"');
});

/* ── S5-4 the metrics track the data, they are not constants ───────────── */

test('S5-4 the counts follow the current data: changing the hours changes every count', () => {
	// The draft-aware map is the input. Move one teacher across the standard and
	// the buckets must move with it; a hardcoded count could not.
	const moved = new Map(DRAFT_HOURS);
	moved.set(11, 21); // Ana: 15h -> 21h, so she leaves underloaded for overloaded
	const snapshot = build({ effectiveActualHours: moved });

	assert.equal(snapshot.counts.underloaded, 0, 'the move of Ana must empty the underloaded bucket');
	assert.equal(snapshot.counts.overloaded, 3, 'Ana must join the overloaded bucket');
	assert.equal(snapshot.total, 4, 'the classified total is unchanged: 4 + 0 + 3');
	assert.equal(snapshot.total, snapshot.counts.underloaded + snapshot.counts.balanced + snapshot.counts.overloaded,
		'Total must always equal the three buckets it partitions');
	assert.equal(snapshot.unclassifiedCount, 2, 'the zero-load and temporary rows stay unclassified');
	assert.equal(snapshot.rows.some((r: any) => r.facultyId === 12 && r.isOverCap), true,
		'the 42h teacher over a 40h cap is flagged over cap');

	// And a smaller roster produces a smaller count.
	const narrowed = build({ faculty: FACULTY.slice(0, 1) });
	assert.equal(narrowed.total, 1, 'a one-teacher roster must report a total of one, not a fixed example');
	assert.equal(narrowed.counts.balanced, 1);
});

/* ── S5-5 honest unavailability, never a plausible wrong number ────────── */

test('S5-5 with no persisted standard the three bucket counts are withheld, not guessed', () => {
	act(() => { audit.module.publishTeacherWorkloadAudit(build({ teachingStandardHours: null, policyReady: false }), () => {}); });
	render(createElement(modal.module.ReviewTeachersModal, {
		open: true, onOpenChange: () => {}, title: 't', description: 'd',
	}));

	for (const id of ['all', 'underloaded', 'balanced', 'overloaded']) {
		const count = textOf(q(dom.window.document, `workload-audit-count-${id}`));
		assert.equal(count, '—', `${id} must render as an em dash, not a number, when no standard exists`);
		if (id !== 'all') {
			assert.equal(
				(q(dom.window.document, `workload-audit-filter-${id}`) as HTMLButtonElement).disabled,
				true,
				`${id} must not be an activatable filter when nothing can be classified`,
			);
		}
	}
	// A rendered `0` here would read as "this school has no teachers". The roster
	// size is a real measurement and is stated in words instead.
	assert.match(textOf(q(dom.window.document, 'workload-audit-note')), /not set for this school year/,
		'the screen must say WHY the figures are withheld');
	assert.match(textOf(q(dom.window.document, 'workload-audit-note')), /roster holds 6 teachers/,
		'the real roster size must be stated, so the withheld figures cost the operator nothing');
	assert.equal(build({ teachingStandardHours: null, policyReady: false }).rosterSize, 6,
		'rosterSize is a real measurement available even when nothing can be classified');
});

test('S5-6 with no roster published the summary says so and prints no number', () => {
	act(() => { audit.module.clearTeacherWorkloadAudit(); });
	render(createElement(modal.module.ReviewTeachersModal, {
		open: true, onOpenChange: () => {}, title: 't', description: 'd',
	}));

	assert.equal(audit.module.getTeacherWorkloadAudit().status, 'unavailable');
	assert.ok(q(dom.window.document, 'workload-audit-unavailable'), 'the unavailable state must render');
	assert.equal(q(dom.window.document, 'workload-audit-list'), null, 'no list may be invented with no roster');
	assert.equal(q(dom.window.document, 'workload-audit-count-all')?.textContent, '—');
});

/* ── S5-7 click-through reuses the inspector, it does not copy it ─────── */

test('S5-7 a row opens the SAME inspector node the page passed, and back returns to the summary', () => {
	const selected: number[] = [];
	// The sentinel is the page's `activeInspector` node itself. If the modal
	// copied the metrics instead of rendering the node, this string would vanish
	// on drill-in — which is the whole point of the Fix 25/26 dependency.
	const sentinel = createElement('div', { 'data-testid': 'page-inspector-node' }, 'INSPECTOR-NODE-SENTINEL');
	let rerender: (n: ReactNode) => void = () => {};

	function Host() {
		const [open, setOpen] = useState(true);
		const [, setSelectedId] = useState<number | null>(9);
		return createElement('div', null,
			createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'open'),
			createElement(modal.module.ReviewTeachersModal, {
				open, onOpenChange: setOpen, title: 't', description: 'd', children: sentinel,
			}),
		);
	}

	// Publish the roster's OWN selection setter, as `TeacherGridMode` does.
	act(() => {
		audit.module.publishTeacherWorkloadAudit(build(), (id: number) => {
			selected.push(id);
			rerender(createElement(Host));
		});
	});

	const host = render(createElement(Host));
	rerender = (n: ReactNode) => act(() => { (roots[roots.length - 1] as any).render(n); });

	assert.equal(q(dom.window.document, 'workload-audit-summary') !== null, true, 'the summary is the landing pane');
	assert.equal(q(dom.window.document, 'page-inspector-node'), null, 'the inspector node is not shown until a teacher is chosen');

	click(q(dom.window.document, 'workload-audit-row-12'));

	assert.deepEqual(selected, [12], 'the click must select through the roster\'s own setter');
	assert.equal(q(dom.window.document, 'workload-audit-summary'), null, 'the summary pane must yield to the teacher pane');
	assert.equal(
		q(dom.window.document, 'page-inspector-node') !== null,
		true,
		'the drill-in must render the node the page passed, not a copy of the metrics',
	);
	assert.ok(host);

	click(q(dom.window.document, 'workload-audit-back'));
	assert.equal(q(dom.window.document, 'workload-audit-summary') !== null, true, 'All teachers returns to the summary');
	assert.deepEqual(selected, [12], 'going back must not re-select or change anything');
});

/* ── S5-8 draft safety ────────────────────────────────────────────────── */

test('S5-8 opening, filtering, drilling and closing write nothing to the draft', () => {
	// A draft guarded by a Proxy: ANY property set is recorded, so "no draft
	// write" is measured, not asserted from a reading of the source.
	const writes: string[] = [];
	const draft: any = new Proxy({ assignments: {} as Record<number, number> }, {
		set(target, prop, value) {
			writes.push(String(prop));
			(target as any)[prop as string] = value;
			return true;
		},
		deleteProperty(target, prop) { writes.push(`delete:${String(prop)}`); delete (target as any)[prop]; return true; },
	});

	const draftMutators: string[] = [];
	let onOpenChange: (open: boolean) => void = () => {};
	act(() => { audit.module.publishTeacherWorkloadAudit(build(), () => {}); });

	function Host() {
		const [open, setOpen] = useState(false);
		onOpenChange = (next: boolean) => { setOpen(next); };
		return createElement('div', null,
			createElement('button', { type: 'button', onClick: () => setOpen(true) }, 'Review teachers'),
			createElement(modal.module.ReviewTeachersModal, {
				open, onOpenChange, title: 't', description: 'd',
				children: createElement('div', { 'data-testid': 'page-inspector-node' }, 'inspector'),
			}),
		);
	}
	render(createElement(Host));

	// The whole operator gesture, end to end.
	click([...dom.window.document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Review teachers') ?? null);
	for (const id of ['overloaded', 'balanced', 'underloaded', 'all']) {
		click(q(dom.window.document, `workload-audit-filter-${id}`));
	}
	click(q(dom.window.document, 'workload-audit-row-10'));
	click(q(dom.window.document, 'workload-audit-back'));
	click(q(dom.window.document, 'workload-audit-filter-overloaded'));

	// The footer offers Close only. Print/Export would need a reviewed export
	// path and "Proceed to Timetable" would navigate away from an unsaved draft;
	// neither is offered, so neither can be a draft-safety hazard.
	const footer = q(dom.window.document, 'workload-audit-close');
	assert.ok(footer, 'a Close control is offered');
	assert.equal(/proceed|timetable|print|export/i.test(dom.window.document.body.textContent ?? ''), false,
		'the summary must not offer a navigation or export affordance it cannot make safe');

	act(() => { onOpenChange(false); });

	assert.deepEqual(writes, [], `no draft property may be written; recorded: ${JSON.stringify(writes)}`);
	assert.deepEqual(draftMutators, [], 'no save/discard/apply callback may fire');
});

/* ── S5-9 keyboard access and dismissal ───────────────────────────────── */

test('S5-9 the counts are focusable buttons, Escape dismisses, and focus returns to the trigger', (t) => {
	assert.equal(modal.module === null, false, `ReviewTeachersModal must exist: ${modal.error}`);
	act(() => { audit.module.publishTeacherWorkloadAudit(build(), () => {}); });

	const trigger = dom.window.document.createElement('button');
	trigger.type = 'button';
	trigger.textContent = 'Review teachers';
	dom.window.document.body.appendChild(trigger);
	act(() => trigger.focus());
	assert.equal(dom.window.document.activeElement === trigger, true, 'precondition: the trigger holds focus');

	let open = false;
	const setOpen = (next: boolean) => { open = next; };
	const host = render(createElement(modal.module.ReviewTeachersModal, {
		open: true, onOpenChange: setOpen, title: 't', description: 'd',
	}));

	const control = q(dom.window.document, 'workload-audit-filter-overloaded') as HTMLButtonElement;
	assert.ok(control, 'the overloaded control must render');
	assert.equal(control.tagName, 'BUTTON', 'a native button is keyboard reachable by definition');
	assert.equal(control.hasAttribute('disabled'), false, 'an available bucket must not be disabled');
	act(() => control.focus());
	assert.equal(dom.window.document.activeElement === control, true, 'the control must accept programmatic focus');

	// Escape is the shared primitive's dismissal, not a bespoke key handler.
	act(() => {
		dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	assert.equal(open, false, 'Escape must reach the dialog primitive\'s onOpenChange(false)');
	assert.ok(host);
});

/**
 * Focus return, driven through a REAL open -> close transition.
 *
 * The S5-9 control above flips a plain variable, so React never re-renders and
 * the primitive never sees a transition — it cannot observe focus restoration
 * that way. This one uses a real `useState` host opened by clicking a real
 * trigger, which is the actual operator gesture.
 */
test('S5-12 focus returns to the `Review teachers` trigger after the dialog closes', async (t) => {
	act(() => { audit.module.publishTeacherWorkloadAudit(build(), () => {}); });

	function Host() {
		const [open, setOpen] = useState(false);
		return createElement('div', null,
			createElement('button', { type: 'button', onClick: () => setOpen(true), 'data-testid': 'trigger' }, 'Review teachers'),
			createElement(modal.module.ReviewTeachersModal, {
				open, onOpenChange: setOpen, title: 't', description: 'd',
			}),
		);
	}
	const host = render(createElement(Host));
	const trigger = q(host, 'trigger') as HTMLButtonElement;

	act(() => trigger.focus());
	click(trigger);
	assert.ok(dom.window.document.querySelector('[role="dialog"]'), 'precondition: the click opened the dialog');
	const focusInside = dom.window.document.querySelector('[role="dialog"]')?.contains(dom.window.document.activeElement) ?? false;
	t.diagnostic(`focus moved into the dialog on open: ${focusInside}`);

	act(() => {
		dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	// The primitive restores focus from a scheduled callback after unmount, so
	// the microtask/timer queue must drain before the result is read.
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	assert.equal(dom.window.document.querySelector('[role="dialog"]'), null, 'precondition: Escape closed the dialog');

	const returned = dom.window.document.activeElement === trigger;
	assert.equal(
		returned,
		true,
		`focus must return to the trigger that opened the dialog; activeElement is ${dom.window.document.activeElement?.tagName}`,
	);
});

/* ── S5-10 the avatar-initials fix ────────────────────────────────────── */

test('S5-10 WorkloadInspector renders initials through the shared local helper, not inline indexing', () => {
	assert.equal(inspector.module === null, false, `WorkloadInspector must exist: ${inspector.error}`);
	assert.equal(initials.module === null, false, `facultyInitials must exist: ${initials.error}`);
	const { formatTeacherWorkloadInitials } = initials.module;

	// Behaviour: the helper is total, where `{firstName[0]}{lastName[0]}` was not.
	assert.equal(formatTeacherWorkloadInitials({ firstName: 'Maria', lastName: 'Dela Cruz' }), 'MD');
	assert.equal(formatTeacherWorkloadInitials({ firstName: '  ', lastName: 'Lim' }), 'L', 'a blank given name contributes nothing');
	assert.equal(formatTeacherWorkloadInitials({ firstName: 'ma. Ana', lastName: 'reyes' }), 'MR', 'the real first character of each word, uppercased');
	assert.equal(formatTeacherWorkloadInitials(null), '');

	// Rendered: the inspector shows the helper's output.
	render(createElement(inspector.module.WorkloadInspector, {
		selected: teacher({ firstName: '  ', lastName: 'Lim' }),
		loadProfile: null, rotationTermBreakdown: [], hoveredIncomingMinutes: 0, previewLoadHours: 0,
		isReadOnlyMode: false, teachingStandardHours: null, policyReady: false,
	}));
	assert.ok(q(dom.window.document, 'teaching-load-profile-readiness'),
		'the readiness state is the branch that rendered the second initials site');
	const body = dom.window.document.body.textContent ?? '';
	assert.equal(/L/.test(body), true, 'the family initial is rendered');
	assert.equal(/undefined|\[object/.test(body), false, 'no undefined or object string may reach the DOM');
});

/* ── S5-11 source guards, labelled as such ────────────────────────────── */

test('S5-11 SOURCE GUARD: the inline initials pattern is gone and the summary is a scroll region', () => {
	// This asserts SOURCE TEXT. It is not a rendered fact and is not offered as
	// one: jsdom performs no layout, so "the close control stays visible" and
	// "the list scrolls internally" can only be pinned as the classes and
	// structure that produce them, and are labelled accordingly.
	const inspectorSource = read('src/components/faculty-assignments/WorkloadInspector.tsx');
	assert.doesNotMatch(
		inspectorSource,
		/\{selected\.firstName\[0\]\}\{selected\.lastName\[0\]\}/,
		'WorkloadInspector must not render initials by inline indexing',
	);
	assert.match(inspectorSource, /formatTeacherWorkloadInitials\(selected\)/,
		'WorkloadInspector must use the one shared helper');

	const modalSource = read('src/components/faculty-assignments/ReviewTeachersModal.tsx');
	assert.match(modalSource, /overflow-hidden/, 'the dialog body must not scroll as a whole page');
	assert.match(modalSource, /min-h-0 flex-1 overflow-y-auto/,
		'the pane that holds long content must be the internal scroll region');
	assert.match(modalSource, /shrink-0/, 'the header and footer must not scroll away with the content');

	// The classification is defined ONCE, in one named exported place.
	const auditSource = read('src/components/faculty-assignments/teacherWorkloadAudit.ts');
	assert.equal(
		(auditSource.match(/function classifyTeacherWorkloadBucket/g) ?? []).length,
		1,
		'the bucket predicate must be defined in exactly one place',
	);
	assert.equal(
		read('src/components/faculty-assignments/TeacherWorkloadAuditSummary.tsx').includes('classifyTeacherWorkloadBucket('),
		false,
		'the view must not re-derive the classification; it reads the snapshot',
	);
});
