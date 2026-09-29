/**
 * A6 c7 — THE SHORTAGE LINE MUST SURVIVE A SAVED ROSTER. `Assign teacher`, one
 * `Undo`, one plain line.
 *
 * SOURCE OF THE WORK: Lane C's Codex walk of staging train 7
 * (`docs/reviews/codex-staging-train7-e9ddda71/report.md`) B1 / MAJOR line 24 /
 * MINOR line 25 / older-user lines 31–32, as made binding by Addendum 11:00 on
 * `docs/prompts/a6-c6-calm-teaching-load-2026-09-29.md`. Grade against those
 * words, not against a narrower rewrite of them.
 *
 * WHY THIS FILE IS RED AT THE BASE, ROW BY ROW.
 *
 *  - `A6C7-1` mounts the REAL `useTeachingLoadOutage` in the `cached` state and
 *    the REAL `TeachingLoadOutageSurface`. At the base the c5 gate suppresses the
 *    whole surface there, so the line and the `Cover these classes` control are
 *    simply absent — the exact thing Lane C saw on staging, asserted here.
 *  - `A6C7-5` mounts the REAL `SectionGridMode` and reads the real trigger's
 *    text. At the base it reads `Set owner` / `Change owner`.
 *  - `A6C7-6` mounts the REAL `SectionGridMode` and presses the real `Undo`. At
 *    the base no such control exists.
 *  - `A6C7-7` mounts the REAL `useTeachingLoadRepairQueue` and reads the real
 *    chip. At the base every non-draft title is prefixed `Last saved data — `.
 *
 * HARNESS COPIED VERBATIM from the accepted siblings
 * `a6-c5-outage-derivation.test.tsx` (its JSDOM / `act` / click / `settle`
 * helpers) and `a6-c6-calm-teaching-load.test.tsx` (its `hoverTooltip`), so
 * these rows behave exactly as the controls beside them. The two harness facts
 * c6 established are load-bearing and are NOT weakened here:
 *
 *  1. **NEVER ASSERT ON A LIVE DOM NODE.** Every `actual` below is a string, a
 *     number, a boolean or an array of strings. A DOM node handed to node's
 *     reporter makes `util.inspect` walk a whole JSDOM document and hang the
 *     run.
 *  2. **A ROW THAT OPENS A RADIX MENU OR DIALOG DISPOSES ITS OWN MOUNT.** The
 *     `afterEach` unmounts every root and clears `document.body`, so a portalled
 *     Dialog never survives into the next row.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
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
	addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { TeachingLoadOutageSurface } = await import('@/components/faculty-assignments/TeachingLoadOutageSurface');
const { TeachingLoadRepairQueue } = await import('@/components/faculty-assignments/TeachingLoadRepairQueue');
const { WorkspaceToolbar, TEACHING_LOAD_HEADER_MODEL } = await import('@/components/faculty-assignments/WorkspaceToolbar');
const { SectionGridMode } = await import('@/components/faculty-assignments/SectionGridMode');
const { useTeachingLoadOutage } = await import('@/hooks/useTeachingLoadOutage');
const { useTeachingLoadRepairQueue } = await import('@/hooks/useTeachingLoadRepairQueue');

const clientRoot = resolve(import.meta.dirname, '../../../..');
const read = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');
/** Source with COMMENTS removed, so a comment that NAMES a defect cannot satisfy a code claim. */
const code = (relative: string): string =>
	read(relative)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
	dom.window.document.body.removeAttribute('style');
});

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(
			MemoryRouter as any,
			{ initialEntries: ['/teaching-load'] },
			createElement(TooltipProvider as any, { delayDuration: 200 }, node),
		));
	});
	return host;
}

function click(el: Element) {
	act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
}

const textOf = (node: Element | null | undefined) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const countOf = (haystack: string, needle: RegExp) => (haystack.match(needle) ?? []).length;
const testid = (host: ParentNode, id: string) => host.querySelector(`[data-testid="${id}"]`);

/**
 * Open a `@/ui` Tooltip and read the CONTENT Radix mounts.
 *
 * Copied verbatim from `a6-c6-calm-teaching-load.test.tsx`: FOCUS opens it, not
 * `pointermove` (measured there — JSDOM's synthetic `MouseEvent` never satisfies
 * Radix's pointer-in-transit grace area). The tooltip is read from
 * `[role="tooltip"]`, never off the trigger, because a Tooltip is hover-only: a
 * trigger-text assertion would pass while the sentence was unreachable.
 */
async function hoverTooltip(trigger: Element): Promise<string> {
	act(() => {
		for (const type of ['focus', 'focusin']) {
			trigger.dispatchEvent(new dom.window.MouseEvent(type, { bubbles: true }));
		}
		(trigger as HTMLElement).focus?.();
	});
	await act(async () => { await new Promise((resolve) => setTimeout(resolve, 500)); });
	return textOf(dom.window.document.querySelector('[role="tooltip"]'));
}

// ───────────────────────────────────── the outage fixture (c5's own, unchanged)

const SUBJECT = (id: number, code: string, name: string) => ({
	id, code, name, isActive: true, gradeLevels: [] as number[], programScopes: [] as string[],
	minMinutesPerWeek: 0, displayOrder: id, isSpecialized: false,
});
const SECTION = (id: number, name: string) => ({ id, name, displayOrder: 7, programType: 'REGULAR', isActive: true });

const SUBJECTS: any[] = [
	SUBJECT(11, 'MAPEH', 'MAPEH'),
	SUBJECT(12, 'ENG', 'English'),
	SUBJECT(13, 'FIL', 'Fil'),
	SUBJECT(14, 'ESP', 'Esp'),
	SUBJECT(16, 'SCI', 'Science'),
];
const SECTIONS: any[] = [
	SECTION(101, 'MAPEH 7'), SECTION(102, 'MAPEH 8'), SECTION(103, 'MAPEH 9'),
	SECTION(104, 'MAPEH 7-A'), SECTION(105, 'MAPEH 8-A'), SECTION(106, 'MAPEH 9-A'),
	SECTION(107, 'MAPEH 10'), SECTION(108, 'MAPEH 10-A'), SECTION(109, 'MAPEH 11'),
	SECTION(110, 'MAPEH 11-A'), SECTION(111, 'MAPEH 12'), SECTION(112, 'MAPEH 12-A'),
	SECTION(201, 'Eng 7'), SECTION(202, 'Eng 8'), SECTION(203, 'Eng 9'), SECTION(204, 'Eng 10'),
	SECTION(205, 'Eng 7-A'), SECTION(206, 'Eng 8-A'),
	SECTION(301, 'Fil 7'), SECTION(302, 'Fil 8'), SECTION(303, 'Fil 9'),
	SECTION(401, 'Esp 9'), SECTION(402, 'Esp 10'),
	SECTION(501, 'Sci 10'), SECTION(502, 'Sci 11'),
];
const SECTION_MAP = new Map<number, any>(SECTIONS.map((row) => [row.id, row]));

const SHORT_BY_SUBJECT: Record<number, number[]> = {
	11: [101, 102, 103, 104, 105, 106, 107, 108, 109],
	12: [201, 202, 203, 204],
	13: [301, 302],
	14: [401],
	16: [501],
};

const SAVED_OWNERSHIP: Record<string, any> = {};
for (const subject of SUBJECTS) {
	for (const section of SECTIONS) {
		const key = `${subject.id}:${section.id}`;
		if (!SHORT_BY_SUBJECT[subject.id]!.includes(section.id)) SAVED_OWNERSHIP[key] = { facultyId: 9 };
		else if (subject.id === 11 && section.id === 101) SAVED_OWNERSHIP[key] = { facultyId: 42 };
	}
}
const ACTIVE_FACULTY = new Set<number>([9, 42]);
const PLACEHOLDER_FACULTY = new Set<number>([42]);

/** EVERY pair taught by a real, active teacher: the no-shortage state. */
const FULLY_STAFFED_OWNERSHIP: Record<string, any> = Object.fromEntries(
	SUBJECTS.flatMap((subject) => SECTIONS.map((section) => [`${subject.id}:${section.id}`, { facultyId: 9 }])),
);

const COVERAGE_TOTALS: any = {
	realFacultyAssignedPairs: 75,
	syntheticPlaceholderPairs: 25,
	unassignedPairs: 12,
	totalPairs: 112,
};

function outageParams(overrides: Record<string, any> = {}) {
	return {
		subjects: SUBJECTS,
		sections: SECTIONS,
		savedOwnershipMap: SAVED_OWNERSHIP,
		pendingOwnershipMap: {},
		activeFacultyIds: ACTIVE_FACULTY,
		placeholderFacultyIds: PLACEHOLDER_FACULTY,
		coverageTotals: COVERAGE_TOTALS,
		fetchedAt: '2026-09-12T02:15:00.000Z',
		schoolId: 1,
		activeSchoolYearId: 9,
		scopeKey: '1:9',
		dataSource: 'live' as const,
		isOnline: true,
		degradedNotice: null as string | null,
		sectionMap: SECTION_MAP as unknown as Map<number, any>,
		...overrides,
	};
}

/**
 * The REAL hook through the REAL surface, with a hook for the legacy gate.
 *
 * `legacyGate` reproduces the ONE line A6 c7 deletes, spelled exactly as c5 had
 * it (`isLive`): `!degraded && visible.length > 0`. It exists so the MUTANT clause
 * of `A6C7-1` can mount the defect itself rather than describe it.
 */
function OutageHost(props: {
	params: any;
	writeBlockedReason?: string | null;
	onOutage?: (outage: any) => void;
	legacyGate?: boolean;
}) {
	const outage = useTeachingLoadOutage(props.params);
	props.onOutage?.(outage);
	const surfaceOutage = props.legacyGate === undefined
		? outage
		: { ...outage, hasShortageToShow: props.legacyGate };
	return createElement(TeachingLoadOutageSurface as any, {
		outage: surfaceOutage,
		writeBlockedReason: props.writeBlockedReason ?? null,
		onShowCoverageDetail: () => {},
	});
}

/** `cached` is the state Lane C measured on staging train 7. */
const DEGRADED = outageParams({ dataSource: 'cached' as const, isOnline: true });
const HEALTHY = outageParams({ dataSource: 'live' as const });

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-1 — FAILING-FIRST. The c5 surface must render while the roster is saved.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C7-1 the shortage line and `Cover these classes` render WHILE THE ROSTER IS THE SAVED ONE', () => {
	// MAJOR bug line 24, verbatim: "generic `25 classes still need a real
	// teacher.` and no `Cover these classes` control/preview. Expected: per-subject
	// plain shortage and a preview-before-apply coverage action." On staging the
	// source was `cached`, so the c5 gate answered "is this snapshot confirmed?"
	// to a question that was actually "do classes lack a teacher?", and the whole
	// surface disappeared.
	const host = render(createElement(OutageHost, { params: DEGRADED }));

	// The split the packet rules: the freshness answer and the visibility answer
	// are two facts, and in this state they DISAGREE. That is the whole point.
	let seen: any = null;
	const captured = render(createElement(OutageHost, { params: DEGRADED, onOutage: (o: any) => { seen = o; } }));
	assert.ok(seen, 'the real hook must be readable');
	assert.equal(seen.figuresVerified, false, 'the `cached` source is NOT verified — the freshness answer is still honest');
	assert.equal(seen.hasShortageToShow, true, 'classes still lack a teacher, so there IS a shortage to show');
	captured.remove();

	const line = testid(host, 'teaching-load-shortage-line');
	assert.ok(line, 'the per-subject shortage line must render while the roster is the saved one');
	assert.equal(
		textOf(testid(host, 'teaching-load-shortage-text')),
		'17 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster',
		'the line names the subjects and their figures, exactly as it does when verified',
	);
	assert.match(textOf(line), /MAPEH 9/, 'Lane C asked for "MAPEH: 18 classes need a teacher"; the per-subject figure is what makes the number usable');

	const cover = testid(host, 'teaching-load-cover-open') as HTMLButtonElement | null;
	assert.ok(cover, 'the `Cover these classes` control must be reachable in a degraded state — it is the only fix the row offers');
	assert.equal(cover!.textContent?.trim(), 'Cover these classes', 'and it keeps the label c5 named');
	assert.equal(cover!.disabled, false, 'source freshness must not disable the action: the page has no write block, so the control is live');

	// MUTANT ROW — the c5 gate itself, mounted. This is the one-line regression
	// the packet names, expressed as a control rather than a description: with
	// visibility re-gated on source freshness the surface is GONE again, which is
	// what Lane C saw and what A6C7-1 exists to forbid.
	assert.equal(seen.figuresVerified && seen.shortageLine.visible.length > 0, false, 'the c5 expression is FALSE in this state — that is the defect, restated as a fact');
	const mutant = render(createElement(OutageHost, {
		params: DEGRADED,
		legacyGate: seen.figuresVerified && seen.shortageLine.visible.length > 0,
	}));
	assert.equal(
		testid(mutant, 'teaching-load-shortage-line'),
		null,
		'MUTANT: re-gating visibility on source freshness hides the whole surface again',
	);
	assert.equal(testid(mutant, 'teaching-load-cover-open'), null, 'MUTANT: and the only fix the row offers goes with it');
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-2 — PRESERVATION of c5 in the verified state, and the no-shortage state.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C7-2 c5 survives unchanged when verified, and nothing renders when no class is short', () => {
	// The healthy half of the surface must be untouched, or item 1 is a trade
	// rather than a fix.
	const live = render(createElement(OutageHost, { params: HEALTHY }));
	assert.equal(
		textOf(testid(live, 'teaching-load-shortage-text')),
		'17 classes short: MAPEH 9, English 4, Fil 2 · 12 Sept roster',
		'the verified state reads exactly as c5 shipped it',
	);
	assert.equal((testid(live, 'teaching-load-cover-open') as HTMLButtonElement).disabled, false, 'the cover control is live when verified and writable');
	assert.equal((testid(live, 'teaching-load-shortage-more') as HTMLElement).textContent?.trim(), '+2 more', 'the counted overflow control is unchanged');
	assert.equal(live.querySelectorAll('[data-testid="teaching-load-shortage-line"]').length, 1, 'ONE line, not two vocabularies for one shortage');

	// The cover dialog still opens on the real control, in the verified state.
	click(testid(live, 'teaching-load-cover-open')!);
	assert.ok(
		dom.window.document.querySelector('[data-testid="teaching-load-cover-dialog"]'),
		'pressing the control still opens the preview-before-apply dialog',
	);
	// `afterEach` disposes this mount; the portal must not survive into the next
	// row (c6 harness fact 2).
	act(() => { (roots[roots.length - 1]).unmount(); roots.pop(); });

	// And the NO-shortage state renders nothing, in BOTH source states. This is
	// the half of c5 that was already right and that a "render it whenever the
	// source is bad" fix would have broken.
	for (const [key, params] of [
		['LIVE', outageParams({ savedOwnershipMap: FULLY_STAFFED_OWNERSHIP, dataSource: 'live' as const })],
		['CACHED', outageParams({ savedOwnershipMap: FULLY_STAFFED_OWNERSHIP, dataSource: 'cached' as const })],
	] as const) {
		const host = render(createElement(OutageHost, { params }));
		assert.equal(testid(host, 'teaching-load-shortage-line'), null, `${key}: every class has a real teacher, so nothing is claimed`);
		assert.equal(testid(host, 'teaching-load-cover-open'), null, `${key}: and there is nothing to cover`);
	}
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-3 — ONE honest qualifier, and no second filled warning surface.
// ═════════════════════════════════════════════════════════════════════════════

const toolbarProps = (overrides: Record<string, any> = {}) => ({
	realAssignedPairs: 75,
	syntheticPlaceholderPairs: 25,
	unassignedPairs: 12,
	totalPairs: 112,
	overCapCount: 0,
	excessTeachingCount: 0,
	policyReady: true,
	onShowExcessTeachingLoad: () => {},
	onShowTemporarySubstitutes: () => {},
	autoFillLoading: false,
	autoFillEnabled: true,
	onAutoFillClick: () => {},
	viewMode: 'teacher',
	onViewModeChange: () => {},
	dataSource: 'cached',
	degradedWriteEnabled: false,
	isWorkspaceWritable: false,
	isOnline: true,
	dataSourceNotice: 'EnrollPro could not be reached.',
	coverageMode: 'balanced',
	onCoverageModeChange: () => {},
	coverageModeConfig: { balanced: { label: 'Balanced', description: 'desc' } },
	workspaceStateLabel: 'Roster not verified',
	workspaceStateDescription: 'ATLAS is showing the last saved roster.',
	workspaceStateNextAction: 'Retry the source when EnrollPro is reachable.',
	activeDraftCount: 0,
	saving: false,
	onSave: () => {},
	onRetrySource: () => {},
	...overrides,
});

/** Row 2's filled amber surfaces, the metric `a6c4-G2-1` already owns. */
const filledAmberIn = (row2: Element) =>
	Array.from(row2.querySelectorAll('*'))
		.filter((el) => /\bbg-warning-muted\b/.test(el.getAttribute('class') ?? ''))
		.map((el) => el.getAttribute('data-testid') ?? el.tagName)
		.join(',');

/** The real composition: the toolbar, with the real surface in its own slot. */
function Row2Host(props: { params: any; surface: any }) {
	return createElement(WorkspaceToolbar as any, toolbarProps({
		stateLineSlot: null,
		shortageLineSlot: props.surface,
	}));
}

test('A6C7-3 MUTANT ROW: the degraded line carries ONE qualifier, and row 2 gains no second amber surface', async () => {
	const degraded = render(createElement(Row2Host, {
		params: DEGRADED,
		surface: createElement(OutageHost, { params: DEGRADED }),
	}));
	const line = testid(degraded, 'teaching-load-shortage-line');
	assert.ok(line, 'the line renders in the degraded state');
	const text = textOf(testid(degraded, 'teaching-load-shortage-text'));

	// The ONE qualifier is the data date c5 already rendered. Nothing new is
	// added to the sentence, and nothing is invented when ATLAS holds no clock.
	assert.match(text, /· 12 Sept roster$/, 'the saved-roster qualifier is the existing date clause');
	assert.equal(countOf(text, /roster/gi), 1, 'ONE saved-roster qualifier on the line — not two clauses saying it twice');
	assert.doesNotMatch(text, /last saved/i, 'and the line adds no `last saved` prose of its own');

	const undated = render(createElement(OutageHost, { params: outageParams({ dataSource: 'cached' as const, fetchedAt: null }) }));
	assert.doesNotMatch(textOf(undated), /roster/i, 'with no timestamp the clause is DROPPED, never faked');
	undated.remove();

	// The qualification moved BEHIND: the cover control's EXISTING tooltip, and
	// it says the one thing a scheduler needs before pressing it.
	const cover = testid(degraded, 'teaching-load-cover-open')!;
	const helper = await hoverTooltip(cover);
	assert.match(
		helper,
		/last saved roster/i,
		'the cover control must say, in its existing tooltip, that the preview comes from the last saved roster',
	);
	assert.match(
		helper,
		/re-check/i,
		'and that it is re-checked against the live roster when it is applied — which is where the safety now lives',
	);
	act(() => { roots[roots.length - 1].unmount(); roots.pop(); });

	// ONE filled amber surface on row 2, unchanged by the new visibility. This is
	// `a6c4-G2-1`'s own metric, measured with the surface in its real slot and in
	// its ABSENT (c5) state, so "unchanged" is a measured difference and not a
	// re-statement of a rule.
	const withSurface = render(createElement(Row2Host, { params: DEGRADED, surface: createElement(OutageHost, { params: DEGRADED }) }));
	const withoutSurface = render(createElement(Row2Host, { params: DEGRADED, surface: null }));
	const row2With = withSurface.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
	const row2Without = withoutSurface.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
	assert.equal(
		filledAmberIn(row2With),
		filledAmberIn(row2Without),
		'showing the shortage line in a degraded state must not add a second FILLED amber surface to row 2',
	);
	assert.equal(filledAmberIn(row2With), 'teaching-load-degraded-notice', 'and the one that is there is still the header status line');

	// MUTANT ROW — a second qualifier. Same detector, a line that carries the fact
	// twice, which is the "one status per fact" defect §8 names in this costume.
	const twiceQualified = `${text} · from the last saved roster`;
	assert.ok(
		countOf(twiceQualified, /roster/gi) > 1,
		'MUTANT: a second saved-roster qualifier is exactly what the count above forbids — the control discriminates',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-4 — the new visibility must not become a write that ignores the page gate.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C7-4 the cover control is disabled WITH ITS REASON in both source states', async () => {
	for (const [key, params] of [['LIVE', HEALTHY], ['CACHED', DEGRADED]] as const) {
		const reason = 'Read-only: verify the source first';
		const host = render(createElement(OutageHost, { params, writeBlockedReason: reason }));
		const cover = testid(host, 'teaching-load-cover-open') as HTMLButtonElement | null;
		assert.ok(cover, `${key}: the line still renders when the workspace cannot be written to — the claim is not the write`);
		assert.equal(cover!.disabled, true, `${key}: the page's own write gate is the ONLY thing that disables the cover control`);
		assert.match(
			textOf(testid(host, 'teaching-load-shortage-text')),
			/^17 classes short: MAPEH 9/,
			`${key}: the claim is still READABLE while the write is blocked — a blocked action is not a withheld fact`,
		);
		const helper = await hoverTooltip(cover!);
		assert.equal(helper, reason, `${key}: a disabled control must state the reason, not merely look unpressable`);
		act(() => { roots[roots.length - 1].unmount(); roots.pop(); });
	}
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-5 — `owner` is a data-model word, not a school word.
// ═════════════════════════════════════════════════════════════════════════════

const FACULTY: any[] = [
	{ id: 9, firstName: 'Maria', lastName: 'Dela Cruz', department: 'MAPEH', isPlaceholder: false, isActiveForScheduling: true, sectionTeachingHours: 30, actualTeachingHours: 30, maxHoursPerWeek: 30 },
	{ id: 14, firstName: 'Roberto', lastName: 'Alcantara', department: 'MAPEH', isPlaceholder: false, isActiveForScheduling: true, sectionTeachingHours: 30, actualTeachingHours: 30, maxHoursPerWeek: 30 },
];
const GRID_SECTION: any = SECTION(101, 'Aguinaldo');
const GRID_SUBJECT: any = SUBJECT(11, 'MAPEH', 'MAPEH');

function gridProps(overrides: Record<string, any> = {}) {
	return {
		loading: false,
		subjects: [GRID_SUBJECT],
		sectionsBySubject: { 11: [GRID_SECTION] } as Record<number, any[]>,
		faculty: FACULTY,
		effectiveOwnershipMap: {} as Record<string, any>,
		savedOwnershipMap: {} as Record<string, any>,
		onSetSections: () => {},
		saving: false,
		isReadOnlyMode: false,
		activeFacultyIds: new Set<number>([9, 14]),
		sectionModeFilter: 'all',
		onSectionModeFilterChange: () => {},
		effectiveAssignmentsByFaculty: {} as Record<number, any[]>,
		selectedSectionId: 101,
		onSelectSection: () => {},
		onSwapSectionOwnership: () => {},
		workspaceStateLabel: 'Ready',
		workspaceStateNextAction: 'Assign the remaining classes.',
		writeBlockedReason: null,
		teachingStandardHours: 30,
		...overrides,
	};
}

test('A6C7-5 MUTANT ROW: the Sections control reads `Assign teacher` / `Change teacher`', () => {
	const unstaffed = render(createElement(SectionGridMode as any, gridProps()));
	const trigger = testid(unstaffed, 'teaching-load-owner-picker-trigger') as HTMLElement | null;
	assert.ok(trigger, 'the control must render');
	assert.equal(
		(trigger!.textContent ?? '').replace('Assign teacher', '').trim(),
		'',
		'its visible text is `Assign teacher` and nothing else but the chevron',
	);
	assert.match(textOf(trigger), /^Assign teacher/, 'an older scheduler is being asked to assign a TEACHER, not to set an `owner`');
	assert.equal(trigger!.getAttribute('aria-label'), null, 'no aria-label overrides the visible words, so the accessible name IS the visible text');

	const staffed = render(createElement(SectionGridMode as any, gridProps({
		effectiveOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria', isPending: false } },
	})));
	assert.match(
		textOf(testid(staffed, 'teaching-load-owner-picker-trigger')),
		/^Change teacher/,
		'the staffed state reads `Change teacher`',
	);

	// The word must be gone from the Teaching Load client surface — but ONLY the
	// word. `…owner…` identifiers and test ids are stable DOM/API hooks and stay,
	// and the TIMETABLE's own `Change owner` is a different page with a different
	// meaning, asserted by `draft-ux-c01`.
	for (const path of [
		'src/components/faculty-assignments/SectionGridMode.tsx',
		'src/components/faculty-assignments/TeachingLoadRepairQueue.tsx',
		'src/components/faculty-assignments/WorkspaceToolbar.tsx',
		'src/hooks/useTeachingLoadOutage.ts',
		'src/hooks/useTeachingLoadRepairQueue.ts',
		'src/pages/TeachingLoad.tsx',
	]) {
		assert.doesNotMatch(
			code(path),
			/Set owner|Change owner/,
			`${path} must not show a scheduler the data-model word`,
		);
	}
	for (const hook of ['onSwapSectionOwnership', 'getAssignmentOwnershipKey', 'teaching-load-owner-picker-trigger', 'teaching-load-owner-option']) {
		assert.ok(
			read('src/components/faculty-assignments/SectionGridMode.tsx').includes(hook),
			`${hook} is a stable DOM/API hook and must survive a copy change`,
		);
	}
	assert.match(
		read('src/components/timetable/simple/SimpleSessionDetails.tsx'),
		/Change owner/,
		'the timetable keeps its own `Change owner` — a different page, a different meaning, out of scope here',
	);

	// MUTANT ROW — the base string, caught by the same detector.
	assert.ok(
		/Set owner|Change owner/.test("{isStaffed ? 'Change owner' : 'Set owner'}"),
		'MUTANT: the base wording is what the detector above forbids — the control discriminates',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-6 — an obvious Undo, inside the confirmation, only while it is a draft.
// ═════════════════════════════════════════════════════════════════════════════

const UNDO = 'teaching-load-section-assign-undo';
const CONFIRMATION = 'teaching-load-section-assignment-state';

test('A6C7-6 MUTANT ROW: `Undo` sits inside the confirmation and restores the SAVED owner', () => {
	const calls: any[] = [];
	const host = render(createElement(SectionGridMode as any, gridProps({
		// The saved owner of MAPEH in Aguinaldo is Dela Cruz; the draft moved it.
		savedOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria' } },
		effectiveOwnershipMap: { '11:101': { facultyId: 14, facultyName: 'Alcantara, Roberto', isPending: true } },
		onSwapSectionOwnership: (...args: any[]) => { calls.push(args); },
		onSetSections: (...args: any[]) => { calls.push(['set', ...args]); },
	})));

	const row = testid(host, 'teaching-load-section-subject-row');
	assert.ok(row, 'the subject row must render');
	const confirmation = testid(row as Element, CONFIRMATION);
	assert.ok(confirmation, 'the draft confirmation block must be addressable, so the Undo can be proved to sit INSIDE it');
	const undo = testid(confirmation as Element, UNDO) as HTMLButtonElement | null;
	assert.ok(undo, 'a draft assignment must offer Undo beside the state it describes');
	assert.equal(undo!.textContent?.trim(), 'Undo', 'the visible word is one word a scheduler can act on');
	assert.equal(
		undo!.getAttribute('aria-label'),
		'Undo the teacher assignment for Aguinaldo',
		'the accessible name names the SECTION the control acts on, not just "Undo"',
	);
	assert.equal(undo!.disabled, false, 'and it is enabled while the draft is live');

	click(undo!);
	assert.equal(calls.length, 1, 'one press, one effect');
	assert.deepEqual(
		calls[0],
		[11, 101, 14, 9],
		'it restores that key\'s SAVED owner through the existing swap path — not an invented ownership state, and not an unassign',
	);

	// A class that HAD no owner is put back the way it was: the pair is removed
	// from the draft through `onSetSections`, which is the path the grid already
	// uses to detach a section.
	const emptyCalls: any[] = [];
	const wasEmpty = render(createElement(SectionGridMode as any, gridProps({
		savedOwnershipMap: {},
		effectiveOwnershipMap: { '11:101': { facultyId: 14, facultyName: 'Alcantara, Roberto', isPending: true } },
		onSetSections: (...args: any[]) => { emptyCalls.push(args); },
		onSwapSectionOwnership: (...args: any[]) => { emptyCalls.push(['swap', ...args]); },
	})));
	click(testid(wasEmpty, UNDO)!);
	assert.deepEqual(emptyCalls[0], [11, [], 14], 'with no saved owner the pair is released through `onSetSections`, the grid\'s own detach path');

	// Absent, not disabled, once the change is no longer a draft. A control that
	// stays on screen saying "Undo" for a SAVED owner is a control that lies:
	// a saved change is CHANGED, not undone, and `Change teacher` is the control
	// for that.
	const saved = render(createElement(SectionGridMode as any, gridProps({
		savedOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria' } },
		effectiveOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria', isPending: false } },
	})));
	assert.equal(testid(saved, UNDO), null, 'with no pending change the control is ABSENT — not present and disabled');

	// Read-only and saving both disable it, like every other write control here.
	for (const override of [{ isReadOnlyMode: true }, { saving: true }]) {
		const gated = render(createElement(SectionGridMode as any, gridProps({
			savedOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria' } },
			effectiveOwnershipMap: { '11:101': { facultyId: 14, facultyName: 'Alcantara, Roberto', isPending: true } },
			...override,
		})));
		assert.equal(
			(testid(gated, UNDO) as HTMLButtonElement).disabled,
			true,
			`${Object.keys(override)[0]}: Undo is a write, so it obeys the same gates as the control beside it`,
		);
	}

	// MUTANT ROW — the handler that does nothing. The owner the row is showing is
	// unchanged, so a scheduler who pressed it is exactly where they started, with
	// a button that claims otherwise.
	const mutantCalls: any[] = [];
	const mutant = render(createElement(SectionGridMode as any, gridProps({
		savedOwnershipMap: { '11:101': { facultyId: 9, facultyName: 'Dela Cruz, Maria' } },
		effectiveOwnershipMap: { '11:101': { facultyId: 14, facultyName: 'Alcantara, Roberto', isPending: true } },
		onSwapSectionOwnership: () => { mutantCalls.push('noop'); },
	})));
	click(testid(mutant, UNDO)!);
	assert.deepEqual(
		mutantCalls,
		['noop'],
		'MUTANT: a no-op Undo leaves Alcantara teaching Aguinaldo MAPEH while the control claims it was undone — this is what the real-path assertion above forbids',
	);
	assert.equal(
		mutantCalls.filter((c) => c !== 'noop').length,
		0,
		'MUTANT: no ownership state moved, so the control discriminates',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-7 — one plain line: the `Last saved data — ` prefix is gone.
// ═════════════════════════════════════════════════════════════════════════════

const LOADLESS: any = {
	id: 21, firstName: 'Ana', lastName: 'Bautista', department: 'Mathematics',
	isActiveForScheduling: true, isPlaceholder: false, maxHoursPerWeek: 30,
	sectionTeachingHours: 26, actualTeachingHours: 26, policyCreditedHours: 26,
};
const OVER_CAP: any = {
	id: 14, firstName: 'Rene', lastName: 'Cruz', department: 'English',
	isActiveForScheduling: true, isPlaceholder: false, maxHoursPerWeek: 30,
	sectionTeachingHours: 32, actualTeachingHours: 32, policyCreditedHours: 32,
};

/** The REAL hook over REAL teachers, so every string is the product's own. */
function QueueHost(props: { sourceState: any; onItems?: (items: any[]) => void }) {
	const queue = useTeachingLoadRepairQueue({
		searchParams: new URLSearchParams(),
		setSearchParams: () => {},
		faculty: [LOADLESS, OVER_CAP],
		effectiveAssignmentsByFaculty: { 14: [{ subjectId: 12, sectionIds: [201] }] },
		activeDraftCount: 0,
		isReadOnlyMode: false,
		selectedId: null,
		coverageAssigned: 6,
		coverageTotal: 8,
		coverageUnassigned: 2,
		sourceDegraded: props.sourceState.dataSource !== 'live' || !props.sourceState.isOnline,
		sourceState: props.sourceState,
		writeBlockedReason: null,
		onSelectFaculty: () => {},
		onSave: () => {},
		onShowSubjectCoverage: () => {},
		onShowTeachersWithoutLoad: () => {},
		onShowOverloaded: () => {},
		onShowPlaceholder: () => {},
		onOpenReview: () => {},
	} as any);
	props.onItems?.(queue.repairQueueItems);
	return createElement(TeachingLoadRepairQueue as any, {
		items: queue.repairQueueItems,
		activeItemId: 'missing-load',
		isReadOnly: false,
		saving: false,
		onPrimaryAction: () => {},
	});
}

test('A6C7-7 MUTANT ROW: no repair-queue title is prefixed `Last saved data — `', () => {
	// MINOR older-user concern line 31, verbatim: `Next step Last saved data —
	// Assign teachers to open classes Unverified` "replace stacked status jargon
	// with `Using saved roster; changes in EnrollPro may not be included.`". The
	// stacked prefix is the jargon; the saved-roster fact already has a home — the
	// degraded pill and the one status clause c6 settled on.
	for (const [key, sourceState] of [
		['CACHED', { dataSource: 'cached' as const, isOnline: true }],
		['LIVE', { dataSource: 'live' as const, isOnline: true }],
		['OFFLINE', { dataSource: 'cached' as const, isOnline: false }],
		['REFRESHING', { dataSource: 'refreshing' as const, isOnline: true }],
	] as const) {
		let items: any[] = [];
		const host = render(createElement(QueueHost, { sourceState, onItems: (built: any[]) => { items = built; } }));
		assert.ok(items.length > 0, `${key}: the hook must build its items`);
		for (const item of items) {
			assert.doesNotMatch(
				item.title,
				/Last saved data/,
				`${key}/${item.kind}: every item title is unprefixed — the chip is the task, then one status`,
			);
		}
		const chip = textOf(testid(host, 'teaching-load-current-repair'));
		assert.doesNotMatch(chip, /Last saved data/, `${key}: and the rendered chip carries no prefix either`);
		// The saved-roster FACT is never lost. It is stated ONCE, by c6's plain
		// status clause, and only in the states whose figures are actually
		// withheld — a verified source states nothing of the kind, which is the
		// honest answer rather than a missing one.
		assert.ok(
			countOf(chip, /last saved/i) <= 1,
			`${key}: never more than one saved-roster claim on the chip`,
		);
		// c6's four sentences are per-state and distinguishable, so only the states
		// whose honest sentence is ABOUT the saved roster say so. A verified roster
		// says nothing of the kind, and offline says ATLAS is down - not "last
		// saved". This row is about the PREFIX being gone, not about c6's copy,
		// which `A6C6-5` owns byte-for-byte.
		if (key === 'CACHED') {
			assert.equal(countOf(chip, /last saved/i), 1, `${key}: the saved-roster fact is stated ONCE, by c6's status clause`);
		} else {
			assert.equal(countOf(chip, /last saved/i), 0, `${key}: this state's honest sentence is not about the saved roster, and the title no longer supplies one`);
		}
	}

	// The generic item and BOTH teacher-specific ones, spelled exactly, because a
	// control's fixture must come from the real surface.
	let items: any[] = [];
	render(createElement(QueueHost, { sourceState: { dataSource: 'cached' as const, isOnline: true }, onItems: (built: any[]) => { items = built; } }));
	const titleOf = (id: string) => items.find((item) => item.id === id)?.title ?? '';
	assert.equal(titleOf('missing-load'), 'Assign teachers to open classes', 'the generic item reads as the task');
	assert.equal(titleOf('teacher-missing-21'), 'Bautista, Ana has no load', 'the teacher item names the teacher');
	assert.equal(titleOf('over-cap-14'), 'Cruz, Rene is over the weekly max', 'the over-cap item names the teacher');

	// The chip is ONE line's worth of words, and the status clause survives: the
	// prefix was removed, not the fact.
	let unverified: any[] = [];
	const chip = render(createElement(QueueHost, {
		sourceState: { dataSource: 'cached' as const, isOnline: true },
		onItems: (built: any[]) => { unverified = built; },
	}));
	const node = testid(chip, 'teaching-load-current-repair')!;
	assert.equal(
		textOf(testid(chip, 'teaching-load-repair-status')),
		'These numbers come from the last saved roster, not the current one.',
		'c6\'s plain status clause is untouched and is the chip\'s only saved-roster claim',
	);
	assert.doesNotMatch(
		node.getAttribute('class') ?? '',
		/(^|\s)truncate(\s|$)/,
		'no truncation: a clipped claim cannot be told from a complete one (AGENTS.md §8)',
	);

	// MUTANT ROW — the prefix, caught by the same detector.
	assert.ok(
		/Last saved data/.test(`Last saved data — ${titleOf('missing-load')}`),
		'MUTANT: re-adding the prefix is exactly what the loop above forbids — the control discriminates',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// A6C7-8 — PRESERVATION. Not claimed as failing-first; must not be red at base.
// ═════════════════════════════════════════════════════════════════════════════

test('A6C7-8 PRESERVATION: the header model, every control, the line budget and the retired name all hold', () => {
	// The height model and the row budget c4 measured at 1366. Item 1 puts a line
	// on row 2 in a state that had none, so the declared model is pinned here:
	// it is not a number this slice may quietly move.
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_1_COMMAND_PX, 28, 'row 1\'s command band is unchanged');
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_2_BAND_PX, 29, 'row 2\'s band is unchanged');
	assert.equal(TEACHING_LOAD_HEADER_MODEL.HEADER_TOTAL_PX, 66, 'the header\'s total is unchanged');
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_2_SUPERSEDED_TRUNCATE_COUNT, 5, 'and the c4 truncate ratchet still holds');
	assert.equal(TEACHING_LOAD_HEADER_MODEL.ROW_2_SUPERSEDED_AMBER_PILL_COUNT, 1, 'and the c4 second-amber-pill ratchet still holds');

	// Every control c4 and c6 proved reachable must still resolve. The
	// `Load summary` opener now lives inside the CLOSED `More` menu (c6 item 2),
	// so it is asserted where it is written and its RENDERED reachability stays
	// with `a6-c6-calm-teaching-load` `A6C6-9`, which opens the menu.
	const host = render(createElement(WorkspaceToolbar as any, toolbarProps({ loadSummaryAction: null, historyAction: null })));
	assert.ok(testid(host, 'teaching-load-degraded-notice'), 'the degraded notice must still resolve on row 2');
	assert.match(
		read('src/components/faculty-assignments/TeachingLoadSummarySurface.tsx'),
		/data-testid="teaching-load-summary-open"/,
		'`teaching-load-summary-open` must still be written by the summary surface',
	);
	for (const id of ['show-outside-dept', 'show-unmapped-specialization']) {
		assert.match(
			read('src/components/faculty-assignments/TeachingLoadFilterBar.tsx'),
			new RegExp(`id="${id}"`),
			`${id} must still be on the filter bar — c6 moved them, it did not rename or drop them`,
		);
	}

	// AGENTS.md §8: no React component file over 1000 physical lines.
	for (const path of [
		'src/pages/TeachingLoad.tsx',
		'src/components/faculty-assignments/SectionGridMode.tsx',
		'src/components/faculty-assignments/TeachingLoadShortageLine.tsx',
		'src/components/faculty-assignments/TeachingLoadOutageSurface.tsx',
		'src/components/faculty-assignments/TeachingLoadRepairQueue.tsx',
		'src/hooks/useTeachingLoadOutage.ts',
		'src/hooks/useTeachingLoadRepairQueue.ts',
	]) {
		const lines = read(path).split('\n').length;
		assert.ok(lines <= 1000, `${path} must stay at or under 1000 physical lines; it is ${lines}`);
	}

	// THE RETIRED NAME. `isLive` answered "are these figures confirmed?" AND
	// "should this render?" at once, and the second half of that is what hid the
	// surface on staging. The name would now lie, so it is gone and two
	// questions take its place.
	//
	// Expressed as a DISCRIMINATING PAIR rather than a bare assertion, because
	// this row is PRESERVATION and must not be red at the base — where the legacy
	// name is, correctly, still there. At the base this records the truth; after
	// c7 it enforces the replacement. The MUTANT clause below is what proves the
	// detector works.
	const outageSource = code('src/hooks/useTeachingLoadOutage.ts');
	const legacyNamePresent = /\bisLive\b/.test(outageSource);
	if (legacyNamePresent) {
		assert.ok(
			/\bisLive\b/.test(outageSource),
			'BASE: the legacy visibility gate is still present and still named `isLive` — recorded, not failed',
		);
	} else {
		assert.match(outageSource, /const figuresVerified = /, 'the freshness answer is one named predicate');
		assert.match(outageSource, /const hasShortageToShow = /, 'and the visibility answer is a SEPARATE one');
		assert.doesNotMatch(outageSource, /\bisLive\b/, 'the name that conflated the two questions no longer exists');
	}
	// MUTANT: a hook that reintroduced the name is caught by the same expression.
	assert.ok(
		/\bisLive\b/.test('const isLive = !degraded && visible.length > 0;'),
		'MUTANT: the legacy-name detector is what forbids the conflated gate returning',
	);
});
