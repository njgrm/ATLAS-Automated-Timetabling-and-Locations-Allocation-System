/**
 * WHAT IS RENDERED AND WHAT IS PINNED, AND WHY — read this before trusting a
 * count here.
 *
 * RENDERED in JSDOM with effects running, through the real `TimetableSimpleHeader`:
 *   - every tutorial step's target, for all three lifecycle states (row 37);
 *   - the schedule switcher's focusability (row 37);
 *   - the More menu's scroll region and its overflow cue, through the real
 *     `SimpleMoreScrollRegion` component (#50);
 *   - the absence of the school-names cue before a refresh happens (row 46).
 *
 * SOURCE-PINNED, with the specific reason and not as hand-waving: a Radix
 * `DropdownMenuContent` DOES NOT MOUNT in JSDOM here. Probed directly at this
 * base — `defaultOpen`, a controlled `open`, and `forceMount` all render no
 * item — and the repository already records the same limitation and the same
 * convention in `ux-r03a-nested-timetable-route.test.ts` ("Radix menu content is
 * client-only … the item contract is pinned at the source block instead"). Every
 * pinned row below therefore pins the EXACT item block, not the whole file, and
 * each one fails if the row it protects moves or changes shape.
 *
 * THE DEFECTS, each from a recorded live measurement:
 *   #49  "Advanced rules" silently SAVED the Expert layout in localStorage, so
 *         every later /timetable load — including a new tab — opened in Expert
 *         view, and the only way back was a 12px button one runner could not
 *         find and another could reach only on the second click.
 *   #50  25+ items in a 510px scrolling box whose content was 1464px, with a
 *         6px scrollbar and no "more below" cue: Help & display, Tools and
 *         Schedule data all sat below an unmarked fold.
 *   #56  the menu said "New version" while the dialog it opens said "Build a
 *         draft" and warned that the published schedule stays in use.
 *   row 37  the tutorial named "More > Schedule data > Export workbook" (an item
 *         that does not exist), "Show me" answered "Expert view is not available
 *         in the current view", and steps 1–2 showed no visible highlight.
 *   row 46  "Refresh school names" had no visible effect and no coverage for
 *         the menu entry (the committed suite only checks the setup pane).
 *
 * Run: `npm run test:a2-ux-menu2-c2`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { JSDOM } from 'jsdom';

import { BUILD_NEW_DRAFT_LABEL, PUBLISHED_SCHEDULE_STAYS_IN_USE } from '@/lib/timetable-plain-language';
import { TimetableSimpleHeader } from '../TimetableSimpleHeader';
import { PUBLISHED_GENERATE_DESCRIPTION, PUBLISHED_GENERATE_LABEL, simpleTutorialSteps } from '../simple/SimpleHeaderHelpers';
import { SimpleMoreScrollRegion } from '../simple/SimpleMoreMenuContent';
import type { ScheduleReviewWorkspaceHeaderContext } from '../buildScheduleReviewWorkspaceContexts';
import type { DraftReport, ScheduledEntry } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../../..');

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

/* ── JSDOM harness ──────────────────────────────────────────────────────────
 * The `ResizeObserver` stub is a no-op ON PURPOSE. The overflow cue measures
 * `scrollHeight - clientHeight`, and JSDOM reports 0 for both, so the cue must
 * stay hidden until a test defines real numbers on the element. That is what
 * makes the cue's own test below meaningful rather than decorative.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/a2-ux-menu2',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	Image: dom.window.Image,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.PointerEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
	IntersectionObserver: class {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
	scrollTo: () => {},
	IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter } = await import('react-router-dom');

/** The live layout-mode persistence, captured exactly as the parent does it. */
const LAYOUT_STORAGE_KEY = 'atlas_timetable_layout_mode';
function makeContext(overrides: Record<string, unknown> = {}): ScheduleReviewWorkspaceHeaderContext {
	return {
		isPreGenerationWorkspace: false,
		activeGeneratedRunId: 42,
		leftTab: 'violations',
		leftPanelRef: { current: null },
		presentationMode: 'workflow',
		setPresentationMode: () => {},
		viewMode: 'section',
		setViewMode: () => {},
		entityFilter: '701',
		setEntityFilter: () => {},
		focusSection: () => {},
		sectionFocusId: null,
		programFilter: 'all',
		entryKindFilter: 'all',
		violations: [],
		hardCount: 0,
		blockingHardCount: 0,
		softCount: 0,
		selectedRunId: '42',
		handleRunChange: () => {},
		runs: [{ id: 42, createdAt: '2031-01-01T00:00:00.000Z', status: 'COMPLETED' }],
		schoolYearContext: { activeSchoolYearLabel: '2030-2031', source: 'enrollpro-verified', activeTerm: null },
		schoolId: 1,
		curriculumReadiness: { state: 'ready', message: 'ready', diagnostic: { generateAllowed: true, zeroWrite: true, blockers: [] } },
		centerView: 'schedule',
		newDraftLoading: false,
		schoolYearId: 9,
		handleStartNewPreGenerationDraft: async () => {},
		draftPlacementCount: 0,
		openPreGenerationWorkspace: async () => {},
		returnToGeneratedRun: () => {},
		generating: false,
		loading: false,
		handleTriggerGenerate: () => {},
		draft: null,
		setPublishAcknowledged: () => {},
		setShowPublishDialog: () => {},
		exitPolicyView: () => {},
		switchCenterViewWithGuard: (action: () => void) => action(),
		enterPolicyView: () => {},
		openMapWorkspace: async () => {},
		handleRefresh: () => {},
		refreshReferenceLabels: () => {},
		referenceLookupStatus: { state: 'ready', label: 'References ready' },
		revertLoading: false,
		editHistoryCount: 0,
		revertLastEdit: async () => {},
		setShowEditHistory: () => {},
		tutorial: { start: () => {} },
		sectionLabel: (id: number) => `Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		facultyLabel: (id: number) => `Teacher ${id}`,
		setUnassignedReasonFilter: () => {},
		summary: { assignedCount: 12, classesProcessed: 12, hardViolationCount: 0, unassignedCount: 0 },
		requestPendingCount: 0,
		statusColor: () => '',
		formatDuration: () => '',
		formatTimestamp: () => '',
		groupedPivotEntities: [],
		pivotLabel: () => '',
		setSelectedEntry: () => {},
		hasSelectedEntry: false,
		setSelectedViolation: () => {},
		enterManualEditView: () => {},
		setPreGenKbSource: () => {},
		setKbSelectedSource: () => {},
		severityFilter: 'all',
		setSeverityFilter: () => {},
		setLeftTab: () => {},
		VIEW_MODE_LABELS: { section: 'Section', faculty: 'Teacher', room: 'Room' },
		PROGRAM_FILTER_OPTIONS: [],
		ENTRY_KIND_FILTER_OPTIONS: [],
		WELLBEING_CODES: new Set<string>(),
		CONFLICT_CODES: new Set<string>(),
		setProgramFilter: () => {},
		setEntryKindFilter: () => {},
		policy: { teacherMoveEnabled: true },
		policyAlignmentWarning: null,
		showFullDay: false,
		setShowFullDay: () => {},
		hiddenRowCount: 0,
		termFilter: 'all',
		onTermFilterChange: () => {},
		termOptions: [],
		activeTermIndex: null,
		...overrides,
	} as unknown as ScheduleReviewWorkspaceHeaderContext;
}

function draftWithSummary(summary: Record<string, unknown>): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [] as unknown as ScheduledEntry[],
		unassignedItems: [],
		summary: summary as unknown as DraftReport['summary'],
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

type Harness = { host: HTMLDivElement; unmount: () => Promise<void> };

async function renderHeader(overrides: Record<string, unknown> = {}): Promise<Harness> {
	dom.window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(
			createElement(
				MemoryRouter,
				null,
				createElement(TimetableSimpleHeader, {
					context: makeContext(overrides),
					layoutMode: 'simple',
					// The parent persists the layout exactly as
					// `ScheduleReviewWorkspace` does, so a layout write made by any
					// surface would be observable here and not only as a call count.
					onLayoutModeChange: (mode: string) => { dom.window.localStorage.setItem(LAYOUT_STORAGE_KEY, mode); },
					activeTask: null,
					onTaskChange: () => {},
				}),
			),
		);
	});
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
	return {
		host,
		unmount: async () => {
			await act(async () => { root.unmount(); });
			dom.window.document.body.removeChild(host);
		},
	};
}

/**
 * Render the More menu's own scroll region — the real component, outside Radix,
 * because the region is plain markup and JSDOM can measure it.
 */
async function renderScrollRegion(): Promise<{ region: HTMLElement; unmount: () => Promise<void> }> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => {
		root.render(createElement(SimpleMoreScrollRegion, null, createElement('p', null, 'content')));
	});
	await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
	const region = dom.window.document.querySelector('[data-testid="timetable-simple-more-scroll"]') as HTMLElement | null;
	assert.ok(region, 'the scroll region must render');
	return {
		region,
		unmount: async () => {
			await act(async () => { root.unmount(); });
			dom.window.document.body.removeChild(host);
		},
	};
}

/** The exact source block of one More-menu item, so a moved row fails the pin. */
function menuItemBlock(file: string, testId: string): string {
	const text = source(file);
	const anchor = text.indexOf(`data-testid="${testId}"`);
	assert.ok(anchor >= 0, `${file} must still contain ${testId}`);
	const start = text.lastIndexOf('<DropdownMenuItem', anchor);
	const end = text.indexOf('</DropdownMenuItem>', anchor);
	assert.ok(start >= 0 && end > start, `${testId} must be a bounded DropdownMenuItem block`);
	return text.slice(start, end);
}

/* ── #49 (a) — "Advanced rules" must not save the layout ──────────────────── */

test('#49 (a) the policy item cannot write the saved layout, and nothing else can either', () => {
	// Pinned at the item block (Radix menu content does not mount in JSDOM — see
	// the header note). The property is "navigating to the policy page does not
	// change the persisted layout mode", and the persisted write only exists
	// behind `onLayoutModeChange`, so the absence of that call in this exact block
	// IS the property.
	const block = menuItemBlock('src/components/timetable/simple/SimpleMoreMenuContent.tsx', 'timetable-more-policy');
	assert.match(block, /asChild/);
	assert.match(block, /<Link/);
	assert.match(block, /to="\/timetable\/policies"/);
	assert.match(block, /onClick=\{onClose\}/, 'it closes the menu and changes nothing else');
	assert.doesNotMatch(
		block,
		/onLayoutModeChange/,
		'#49 (a): opening Advanced rules must not save the Expert layout',
	);

	// Only executable code counts: the comment above the policy item names the
	// old wiring on purpose, to say what was removed and why.
	assert.equal(
		(codeOnly('src/components/timetable/simple/SimpleMoreMenuContent.tsx').match(/onLayoutModeChange\('advanced'\)/g) ?? []).length,
		1,
		'exactly one layout writer remains in the menu, so no second silent save can appear',
	);
});

test('#49 (a) control: the explicit Expert view item is still the one deliberate save', () => {
	// The negative control for the row above: the mechanism still exists, and it
	// is attached to the item whose NAME is the choice, not to a navigation.
	const block = menuItemBlock('src/components/timetable/simple/SimpleMoreMenuContent.tsx', 'timetable-layout-toggle');
	assert.match(
		block,
		/onSelect=\{\(event\) => \{ event\.preventDefault\(\); onClose\(\); onLayoutModeChange\('advanced'\); \}\}/,
		'choosing Expert view by name still changes and saves the layout',
	);
	assert.match(block, /Expert view/);
});

test('#49 (a) the parent persists the layout behind that one callback, so the fix is load-bearing', () => {
	// Without this, "no layout write in the menu" would be a claim about a
	// callback that does nothing. `setLayoutMode` writes localStorage, and the
	// header renders that same value on every later load.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /window\.localStorage\.setItem\('atlas_timetable_layout_mode', mode\)/);
	assert.match(
		workspace,
		/window\.localStorage\.getItem\('atlas_timetable_layout_mode'\) === 'advanced' \? 'advanced' : 'simple'/,
		'a saved layout is read back on every load, which is what made the silent save strand the user',
	);
});

/* ── #50 — the menu must not hide two thirds of itself ────────────────────── */

test('#50 every group is a first-level heading that states how many items it owns', () => {
	// Pinned at the source: the headings are Radix menu labels (no JSDOM mount).
	// Each row is the exact heading call, so a group that loses its count, or
	// loses its heading and goes back to being an implied section, fails.
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	for (const [group, count] of [
		['Daily tasks', 'dailyTaskCount'],
		['Expert tools', 'expertToolCount'],
		['Help & display', 'helpAndDisplayCount'],
		['Tools', '4'],
		['Schedule data', '3'],
	] as const) {
		assert.match(
			menu,
			new RegExp(`<MoreGroupHeading label="${group}" itemCount=\\{${count}\\} />`),
			`${group} must be a heading that says how many items it owns`,
		);
	}
	const heading = menu.slice(menu.indexOf('function MoreGroupHeading'), menu.indexOf('export function SimpleMoreScrollRegion'));
	// INTEGRATION (2026-09-28): the prop is `label`, not `title` — the component
	// was renamed to satisfy the `ux-r03a` guard that forbids a `title=` attribute
	// in this file. The intent of the row is unchanged: the heading must still be
	// addressable by its group name.
	assert.match(heading, /data-more-group=\{label\}/, 'the heading is addressable, so a test can find the group by name');
	assert.match(heading, /font-semibold/, 'a heading strong enough to scan past');
	assert.match(heading, /itemCount === 1 \? 'item' : 'items'/, 'the count is spelled out, never "(s)"');
});

test('#50 the scroll region is taller than the old cap and drops the 6px scrollbar', async () => {
	const harness = await renderScrollRegion();
	try {
		assert.match(harness.region.className, /max-h-\[min\(88svh,44rem\)\]/, '704px of list is visible, up from 512px');
		assert.doesNotMatch(harness.region.className, /scrollbar-thin/, 'a 6px scrollbar is not a cue');
		assert.match(harness.region.className, /overflow-y-auto/, 'it still scrolls, so the region keeps its own bound');
		// The no-scroll architecture is untouched: this is a bounded menu region,
		// not a page-level scroller.
		assert.doesNotMatch(harness.region.className, /100svh|fixed|sticky bottom/);
	} finally {
		await harness.unmount();
	}
});

test('#50 the overflow cue appears only when the content really is taller than the box', async () => {
	const harness = await renderScrollRegion();
	const { region } = harness;
	try {
		assert.equal(
			dom.window.document.querySelector('[data-testid="timetable-simple-more-overflow-cue"]'),
			null,
			'no measured overflow, no cue: the cue never claims a fold that is not there',
		);
		// The recorded live numbers: 1464px of content in a 510px box.
		const size = (content: number, visible: number, scrollTop = 0) => {
			Object.defineProperty(region, 'scrollHeight', { value: content, configurable: true });
			Object.defineProperty(region, 'clientHeight', { value: visible, configurable: true });
			Object.defineProperty(region, 'scrollTop', { value: scrollTop, configurable: true, writable: true });
		};
		size(1464, 510);
		await act(async () => { region.dispatchEvent(new dom.window.Event('scroll')); });
		await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
		const cue = dom.window.document.querySelector('[data-testid="timetable-simple-more-overflow-cue"]');
		assert.ok(cue, 'an overflowed list must say so in words');
		assert.equal(cue.getAttribute('data-overflow-state'), 'more');
		assert.match(cue.textContent ?? '', /More items below/i);
		assert.equal(cue.getAttribute('role'), 'status', 'the cue is announced, not just drawn');

		// At the end of the list the cue changes rather than lying about more.
		size(1464, 510, 954);
		await act(async () => { region.dispatchEvent(new dom.window.Event('scroll')); });
		await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
		const atEnd = dom.window.document.querySelector('[data-testid="timetable-simple-more-overflow-cue"]');
		assert.equal(atEnd?.getAttribute('data-overflow-state'), 'end');
		assert.match(atEnd?.textContent ?? '', /End of this list/i);

		// Back to a list that fits: the cue must disappear, not linger.
		size(400, 510);
		await act(async () => { region.dispatchEvent(new dom.window.Event('scroll')); });
		await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
		assert.equal(
			dom.window.document.querySelector('[data-testid="timetable-simple-more-overflow-cue"]'),
			null,
			'a list that fits says nothing about scrolling',
		);
	} finally {
		await harness.unmount();
	}
});

/* ── #56 — one verb for the generate action, on a published schedule ───────── */

test('#56 the published generate label and description are the one verb, derived not retyped', () => {
	// Rendered values, imported: these are the exact strings the menu item and
	// the header control put on screen.
	assert.equal(PUBLISHED_GENERATE_LABEL, BUILD_NEW_DRAFT_LABEL, 'the menu label is the copy module\'s one verb');
	assert.equal(
		PUBLISHED_GENERATE_DESCRIPTION,
		`${BUILD_NEW_DRAFT_LABEL}. ${PUBLISHED_SCHEDULE_STAYS_IN_USE}`,
		'it builds a draft, and says the schedule in use is untouched',
	);
	for (const retired of ['New version', 'Build a new version', 'Generate updated schedule?']) {
		assert.doesNotMatch(PUBLISHED_GENERATE_LABEL, new RegExp(retired), `"${retired}" is retired`);
		assert.doesNotMatch(PUBLISHED_GENERATE_DESCRIPTION, new RegExp(retired), `"${retired}" is retired`);
	}
});

test('#56 the More item and the header control carry that one verb and the reassurance', () => {
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	// The aria-label opens with the one verb, so a screen reader and the dialog
	// never hear two different actions.
	assert.match(
		actions,
		/aria-label=\{generate\.reason \? `\$\{generate\.published \? BUILD_NEW_DRAFT_LABEL : 'Generate schedule'\} — \$\{generate\.reason\}` : undefined\}/,
	);
	// The visible reassurance beside the label on a published schedule.
	assert.match(actions, /data-testid="timetable-more-generate-published-note"/);
	assert.match(actions, /\{PUBLISHED_SCHEDULE_STAYS_IN_USE\}/);
	assert.match(helpers, /aria-label=\{reason \? `\$\{published \? BUILD_NEW_DRAFT_LABEL : 'Generate schedule'\} — \$\{reason\}` : name\}/);

	// The retired phrases may survive only in a comment that records the rename.
	for (const name of ['src/components/timetable/simple/SimpleHeaderActions.tsx', 'src/components/timetable/simple/SimpleHeaderHelpers.tsx']) {
		assert.doesNotMatch(codeOnly(name), /New version|Build a new version/, `${name} must not render the retired verb`);
	}
});

test('#56 the tutorial and the menu cannot drift apart again', () => {
	// One verb, one source: the tutorial builds its sentence from the same
	// constant the menu item renders.
	for (const lifecycle of ['ready-no-run', 'generated-reviewable', 'published'] as const) {
		for (const step of simpleTutorialSteps(lifecycle)) {
			assert.doesNotMatch(step.body, /New version|Build a new version|Generate updated schedule/i, `${lifecycle}: "${step.title}"`);
		}
	}
	const tutorial = source('src/components/timetable/simple/SimpleTutorial.tsx');
	assert.match(tutorial, /\$\{morePath\('Schedule actions', BUILD_NEW_DRAFT_LABEL\)\}/, 'the tutorial names the action with the one verb');
	assert.match(tutorial, /\$\{PUBLISHED_SCHEDULE_STAYS_IN_USE\}/, 'and repeats the same reassurance the dialog gives');
});

/* ── row 37 — the tutorial must describe THIS app ─────────────────────────── */

const LIFECYCLE_STATES = [
	{ lifecycle: 'ready-no-run', context: {} as Record<string, unknown> },
	{
		lifecycle: 'generated-reviewable',
		context: { draft: draftWithSummary({ isPublished: false }) } as Record<string, unknown>,
	},
	{
		lifecycle: 'published',
		context: { draft: draftWithSummary({ isPublished: true }) } as Record<string, unknown>,
	},
] as const;

for (const { lifecycle, context } of LIFECYCLE_STATES) {
	test(`row 37 every "${lifecycle}" tutorial step points at a control that is actually rendered`, async () => {
		const harness = await renderHeader(context);
		try {
			const steps = simpleTutorialSteps(lifecycle);
			assert.ok(steps.length > 0, 'a lifecycle always has steps');
			for (const step of steps) {
				const candidates = [step.targetTestId, step.altTargetTestId].filter(Boolean) as string[];
				const resolved = candidates.some((testId) => dom.window.document.querySelector(`[data-testid="${testId}"]`));
				assert.ok(
					resolved,
					`"${step.title}" must resolve to a rendered control; tried ${candidates.join(', ')}`,
				);
			}
		} finally {
			await harness.unmount();
		}
	});
}

test('row 37 no step names a control that does not exist', () => {
	// The recorded failures, pinned as absences: "Export workbook" was never an
	// item, "Schedule data" does not hold the export, and the Expert-view toggle
	// is not a step target because it only exists while More is open.
	for (const lifecycle of ['ready-no-run', 'generated-reviewable', 'published'] as const) {
		for (const step of simpleTutorialSteps(lifecycle)) {
			assert.doesNotMatch(step.body, /Export workbook/i, `${lifecycle}: "${step.title}"`);
			assert.doesNotMatch(step.body, /Schedule data/i, `${lifecycle}: "${step.title}"`);
			assert.doesNotMatch(step.body, /curriculum-requirements/i, `${lifecycle}: "${step.title}"`);
			assert.notEqual(step.targetTestId, 'timetable-layout-toggle', `${lifecycle}: "${step.title}" targets a row that exists only while More is open`);
		}
	}
});

/** Source with every block and line comment removed, so a pin counts CODE. */
function codeOnly(path: string): string {
	return source(path)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => line.replace(/\/\/.*$/, ''))
		.join('\n');
}

/** Every More group label the menu actually renders, in either heading form. */
function renderedGroupNames(): string[] {
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	const actions = source('src/components/timetable/simple/SimpleHeaderActions.tsx');
	const names = [...`${menu}\n${actions}`.matchAll(/label="([^"]+)"/g)].map((m) => m[1]);
	names.push(...[`${menu}\n${actions}`].join('').match(/<DropdownMenuLabel[^>]*>Schedule actions<\/DropdownMenuLabel>/) ? ['Schedule actions'] : []);
	return names;
}

test('row 37 the switcher is focusable, so "Show me" can actually point at it', async () => {
	const harness = await renderHeader();
	try {
		const switcher = dom.window.document.querySelector('[data-testid="timetable-simple-schedule-switcher"]');
		assert.ok(switcher, 'the schedule switcher renders');
		assert.equal(switcher.getAttribute('tabindex'), '-1', 'a div target must be programmatically focusable or "Show me" cannot move focus');
	} finally {
		await harness.unmount();
	}
});

test('row 37 the tutorial only ever names More groups that the menu really renders', () => {
	// Both halves are source reads, and both fail if a group is renamed on one
	// side only: the group a step names, and the group the menu renders.
	const groups = renderedGroupNames();
	assert.ok(groups.length >= 5, `the menu must render its group headings: ${groups.join(', ')}`);
	for (const lifecycle of ['ready-no-run', 'generated-reviewable', 'published'] as const) {
		for (const step of simpleTutorialSteps(lifecycle)) {
			const named = /More, then ([A-Za-z &]+?), and choose/.exec(step.body);
			if (!named) continue;
			assert.ok(
				groups.includes(named[1]),
				`${lifecycle}: "${step.title}" names the group "${named[1]}", which must exist (${groups.join(', ')})`,
			);
		}
	}
});

/* ── row 46 — Refresh school names: real coverage for the menu entry ──────── */

test('row 46 the More menu entry refreshes the names and reports that it did', async () => {
	// Pinned at the menu item block (Radix menu content does not mount in JSDOM).
	// This is the row the control inventory recorded as UNTESTED: the committed
	// suite only ever checked the testid in the `/timetable/setup` pane.
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /<RefreshSetupNamesButton/, 'the menu keeps the shared control, so there is one implementation');
	const refreshCall = menu.slice(menu.indexOf('<RefreshSetupNamesButton'), menu.indexOf('/>', menu.indexOf('<RefreshSetupNamesButton')) + 2);
	assert.match(refreshCall, /onClose\(\)/, 'the menu still closes itself');
	assert.match(refreshCall, /context\.refreshReferenceLabels\(\)/, 'the shared refresh is still the one dispatch');
	assert.match(refreshCall, /onSchoolNamesRefreshed\?\.\(\)/, 'and it tells the header to show the cue');

	// The cue itself is a real header status surface, not a menu row: the menu
	// closes on click, so the cue has to live where the reader is looking next.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /onSchoolNamesRefreshed=\{\(\) => setSchoolNamesRefreshed\(true\)\}/, 'the header wires the cue');
	const cue = header.slice(header.indexOf('timetable-school-names-refreshed') - 400, header.indexOf('timetable-school-names-refreshed') + 400);
	assert.match(cue, /role="status"/, 'the cue is announced to assistive tech as well as drawn');
	assert.match(cue, /School names refreshed\. The schedule did not change\./);
	const sentence = 'School names refreshed. The schedule did not change.';
	assert.ok(
		sentence.split(/\s+/).length <= 15,
		`the cue stays inside the 15-word cap: ${sentence.split(/\s+/).length} words`,
	);
	assert.doesNotMatch(sentence, /rebuild|rebuilds|re-generated|changed the schedule/i, 'it never implies the schedule changed');
});

test('row 46 the header shows no refresh cue until one happens, and drops it with the run', async () => {
	const harness = await renderHeader();
	try {
		assert.equal(
			dom.window.document.querySelector('[data-testid="timetable-school-names-refreshed"]'),
			null,
			'a cue that is always on screen is not a cue',
		);
		assert.ok(
			dom.window.document.querySelector('[data-testid="timetable-refresh-setup-names"]') === null,
			'the control lives in the menu, not on the always-visible header row',
		);
	} finally {
		await harness.unmount();
	}
	// The cue is cleared when the run on screen changes, so it can never claim a
	// refresh that belongs to a different schedule.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /setSchoolNamesRefreshed\(false\);[\s\S]{0,40}\}, \[context\.draft\?\.runId\]\);/, 'the cue is bound to the run, not to the session');
});

/* ── U5 — no file this candidate owns renders the retired empty state ──────── */

test('U5 none of the four owned modules renders the retired empty-state wording', () => {
	for (const file of [
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
		'src/components/timetable/simple/SimpleHeaderHelpers.tsx',
		'src/components/timetable/simple/SimpleHeaderActions.tsx',
		'src/components/timetable/TimetableSimpleHeader.tsx',
	]) {
		const text = source(file);
		assert.doesNotMatch(text, /Planning draft/, `${file} must not render the retired empty state`);
		assert.doesNotMatch(text, /no generated run yet"/i, `${file} must not render the retired empty state as a label`);
	}
});
