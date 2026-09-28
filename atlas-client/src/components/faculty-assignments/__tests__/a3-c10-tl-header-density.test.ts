/**
 * A3-C10-S3 — Teaching Load header density: the vertical budget control.
 *
 * THE DEFECT. Lane C measured `/teaching-load` at 1366x768 against live release
 * a1db27d5: "first data row at ~430px of 768 under 7 stacked rows (title+draft
 * status, tabs, % staffed chips, summary bar, Next Step banner, search/filters,
 * group header)". The target is "at most 2 header rows", with the summary, the
 * % staffed figure and the Next Step content on one compact line.
 *
 * WHY A MODEL AND NOT A PIXEL. JSDOM performs no layout, so a control that
 * asserted "the row is 267px tall" would be asserting nothing. Instead the
 * header stack is an ORDERED LIST OF BLOCKS, each with an EXPLICIT declared
 * height in px, and every one of those numbers is RE-DERIVED here from the real
 * production class strings on the real rendered DOM. Change a Tailwind size and
 * the derived number moves and the budget assertion goes red on its own.
 *
 * THE MODEL, at a 768px-tall viewport (see the identical block in
 * `WorkspaceToolbar.tsx` and in this file's `HEADER_MODEL` table):
 *
 *   APP_CHROME_PX            56   the 3.5rem app bar above the route root
 *   STRIP_CONTAINER_BOX_PX    9   CompactTitleStrip `py-1` (4+4) + `border-b` (1)
 *   ROW_1_COMMAND_PX         28   tallest control on the command row
 *   ROW_2_BORDER_PX           1   the `border-t` hairline between the rows
 *   ROW_2_STATE_PX           28   tallest chip on the state line
 *   ---------------------------------------
 *   HEADER_TOTAL_PX          66   9 + 28 + 1 + 28
 *
 * The header budget this control asserts is 70px, with a hard ceiling of 2
 * rows. The same model run over the PRE-CHANGE block table is 5 rows / 229px,
 * so the model discriminates: `T6` runs it and fails on the old structure
 * without needing a pixel.
 *
 * WHAT IS NOT MODELLED, and why the conclusion still holds: the app bar above
 * the route, and the roster's own chrome (the search/filter band and the
 * department group header) below the header. Those are unchanged by this work,
 * so the SAVING transfers one-for-one. The absolute projection is therefore
 * `430 - saving`, i.e. how much higher the first assignment row now starts, and
 * not a claim about where some browser will put it.
 *
 * CONTROLS ARE ADDITIVE. Nothing here supersedes an existing assertion; the
 * pre-change structure is kept as an explicit table in `T6` so both shapes stay
 * legible in one place.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { WorkspaceToolbar } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import { TeachingLoadRepairQueue } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { STAFF_WORKLOAD_REVIEW_LABEL } from '@/components/faculty-assignments/teacherReviewEntry';
import { TooltipProvider } from '@/ui/tooltip';
import { COVERAGE_MODE_CONFIG } from '@/lib/teaching-load-helpers';
import type { CoverageMode } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
// src/components/faculty-assignments/__tests__ -> atlas-client
const CLIENT_ROOT = resolve(HERE, '../../../..');
const source = (path: string): string => readFileSync(resolve(CLIENT_ROOT, path), 'utf8');

const TOOLBAR_FILE = 'src/components/faculty-assignments/WorkspaceToolbar.tsx';
const PAGE_FILE = 'src/pages/TeachingLoad.tsx';
const TRUTH_PANEL_FILE = 'src/components/faculty-assignments/TeachingLoadTruthPanel.tsx';
const REPAIR_QUEUE_FILE = 'src/components/faculty-assignments/TeachingLoadRepairQueue.tsx';
const FILTER_BAR_FILE = 'src/components/faculty-assignments/TeachingLoadFilterBar.tsx';

// =============================================================================
// The declared height model. These are the numbers the control asserts against.
// =============================================================================

const HEADER_MODEL = {
	APP_CHROME_PX: 56,
	STRIP_CONTAINER_BOX_PX: 9,
	ROW_1_COMMAND_PX: 28,
	ROW_2_BORDER_PX: 1,
	ROW_2_CHIP_PX: 28,
	ROW_2_BAND_PX: 29,
	HEADER_TOTAL_PX: 66,
	/**
	 * The pre-change stack, DERIVED by the same model in `T6` from the base
	 * class strings: strip 9 + command 28 + tab row 45 + readiness 41 +
	 * truth band 42 + next-step banner 58. It is 223, not the 229 first
	 * estimated by hand — the banner's row is its `h-9` action button (36),
	 * not the stacked badge and description, so the model corrected it.
	 */
	PRE_CHANGE_HEADER_TOTAL_PX: 223,
	MEASURED_FIRST_ROW_BASELINE_PX: 430,
	/**
	 * A6 c4 (G2), re-derived from the CANDIDATE's class strings — the row is a
	 * `flex-wrap` band with no `truncate` on any of its members, and these four
	 * record what that replaced. They are asserted for agreement with the
	 * component's model by T1 and measured by `a6-tl-header-budget`; T1–T9 above
	 * are unchanged, and none of their constants moved.
	 */
	ROW_2_SUPERSEDED_TRUNCATE_COUNT: 5,
	ROW_2_SUPERSEDED_AMBER_PILL_COUNT: 1,
	ROW_2_WRAP_LINE_PX: 16,
	HEADER_TOTAL_IF_SENTENCE_WRAPS_PX: 74,
} as const;

/** The budget this control enforces. 66 + 4px of slack. */
const HEADER_BUDGET_PX = 70;
const MAX_HEADER_ROWS = 2;
/** "Materially": the first row must start at least this many px above 430. */
const MIN_SAVING_PX = 120;

// --- Tailwind readers. The model is only as good as these. --------------------

/** Tailwind v4 default spacing scale: one unit is 0.25rem = 4px. */
const SPACING: Record<string, number> = {
	'0': 0, '0.5': 2, '1': 4, '1.5': 6, '2': 8, '2.5': 10, '3': 12, '3.5': 14,
	'4': 16, '5': 20, '6': 24, '7': 28, '8': 32, '9': 36, '10': 40,
};

/** `text-xs` .. `text-base` line boxes, which can drive a row taller than any `h-N`. */
const LINE_BOX: Record<string, number> = {
	'text-xs': 16, 'text-sm': 20, 'text-base': 24, 'text-lg': 28,
};

const tokens = (className: string): string[] => (className ?? '').trim().split(/\s+/).filter(Boolean);

function fixedHeight(className: string): number | null {
	for (const token of tokens(className)) {
		// `size-N` is a square, so it is a fixed height for model purposes.
		const match = /^(?:h|size)-(\d+(?:\.\d+)?)$/.exec(token);
		if (match) return SPACING[match[1]];
	}
	return null;
}

/** Top padding in px. `py-N` sets both sides, so it counts on each. */
function padTop(className: string): number {
	return tokens(className).reduce((sum, token) => {
		const match = /^(?:p|py|pt)-(\d+(?:\.\d+)?)$/.exec(token);
		return match ? sum + SPACING[match[1]] : sum;
	}, 0);
}

/** Bottom padding in px. */
function padBottom(className: string): number {
	return tokens(className).reduce((sum, token) => {
		const match = /^(?:p|py|pb)-(\d+(?:\.\d+)?)$/.exec(token);
		return match ? sum + SPACING[match[1]] : sum;
	}, 0);
}

/** Top margin in px — this is what `mt-1.5` used to cost the removed rows. */
function marginTop(className: string): number {
	return tokens(className).reduce((sum, token) => {
		const match = /^(?:m|my|mt)-(\d+(?:\.\d+)?)$/.exec(token);
		return match ? sum + SPACING[match[1]] : sum;
	}, 0);
}

/** 1px per horizontal border edge. `border` = 2, `border-t` = 1. */
function borderBox(className: string): number {
	const set = new Set(tokens(className));
	if (set.has('border')) return 2;
	return (set.has('border-t') ? 1 : 0) + (set.has('border-b') ? 1 : 0);
}

/**
 * The container's own vertical box, when it is sized by its own padding and
 * borders rather than by a fixed height: `py-1` (4+4) + `border-b` (1) = 9.
 */
function containerVerticalBox(className: string): number {
	return padTop(className) + padBottom(className) + borderBox(className);
}

/** The tallest text line box in a subtree, for a `flex` row whose members are prose. */
function lineBoxOf(className: string): number {
	let lineBox = 0;
	for (const token of tokens(className)) lineBox = Math.max(lineBox, LINE_BOX[token] ?? 0);
	return lineBox;
}

/**
 * Is this element rendered at all? An `sr-only` line is clipped to 1px, a
 * `hidden` class is `display:none`, and Radix sets `hidden` on collapsed
 * disclosure content. None of them may contribute a row, and the walk must not
 * descend into them.
 */
function isRendered(element: Element): boolean {
	if (element.hasAttribute('hidden')) return false;
	if (element.getAttribute('aria-hidden') === 'true') return false;
	const className = element.getAttribute('class') ?? '';
	return !tokens(className).some((t) => t === 'hidden' || t === 'sr-only' || t === 'invisible');
}

/**
 * Tailwind is border-box, so an explicit `h-N` is the WHOLE box: padding and
 * border live inside it and must not be added on top. Without that rule the
 * `h-7 p-0.5 border` TabsList would read as 30px and every budget would drift.
 */
function boxHeight(element: Element): number {
	const className = element.getAttribute('class') ?? '';
	const fixed = fixedHeight(className);
	if (fixed !== null) return fixed;
	const children = Array.from(element.children).filter(isRendered);
	const content = children.length
		? Math.max(...children.map(boxHeight))
		: Math.max(lineBoxOf(className), 0);
	return content + padTop(className) + padBottom(className) + borderBox(className);
}

/** A row's occupied height: its box plus the margin that separates it. */
function rowHeight(row: Element): number {
	const className = row.getAttribute('class') ?? '';
	return boxHeight(row) + marginTop(className);
}

/** Strip a TSX file's comments, so prose about a rule cannot trip a rule. */
function code(path: string): string {
	return source(path)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/^[ \t]*\/\/.*$/gm, ' ');
}


// =============================================================================
// The real production composition, rendered the way TeachingLoad.tsx renders it.
// =============================================================================

const TRUTH_MODEL = {
	requiredPairs: { state: 'known', value: 42 },
	assignedPairs: { state: 'known', value: { real: 38, placeholder: 1, total: 39 } },
	unresolvedPairs: { state: 'known', value: 3 },
	actualTeachingMinutes: { state: 'known', value: 3_600 },
	policyCapacity: { state: 'known', value: { teachingStandardMinutes: 1_200, hardCapMinutes: 1_600 } },
	overload: { state: 'known', value: { overStandardCount: 2, overHardCapCount: 1, excessMinutes: 300 } },
	remainingCapacityMinutes: { state: 'known', value: 600 },
	zeroLoadFaculty: { state: 'known', value: { count: 1, names: ['Dela Cruz'] } },
	adviserStatus: { state: 'known', value: { count: 1, names: ['Santos'] } },
	advisoryCreditMinutes: { state: 'known', value: 300 },
	excludedHgRows: { state: 'known', value: { count: 1, explanation: 'Homeroom Guidance is guidance, not a teaching load.' } },
} as unknown as Parameters<typeof TeachingLoadTruthPanel>[0]['model'];

const REPAIR_ITEMS = [{
	id: 'missing-load',
	kind: 'missing-load' as const,
	title: '3 classes have no teacher',
	description: 'A scheduler officer should assign these before generating a timetable.',
	status: '3 awaiting assignment',
	// A6 C2 (Slice 5): the label is now the operator's, and it is imported from
	// the ONE opener module rather than retyped here, so this fixture cannot claim
	// a word the product does not render.
	actionLabel: STAFF_WORKLOAD_REVIEW_LABEL,
	countLabel: '3 to fix',
}];

const toolbarProps = {
	realAssignedPairs: 39,
	syntheticPlaceholderPairs: 1,
	unassignedPairs: 3,
	totalPairs: 42,
	overCapCount: 1,
	excessTeachingCount: 0,
	policyReady: true,
	onShowExcessTeachingLoad: () => {},
	onShowTemporarySubstitutes: () => {},
	autoFillLoading: false,
	autoFillEnabled: true,
	onAutoFillClick: () => {},
	viewMode: 'teacher',
	onViewModeChange: () => {},
	dataSource: 'live' as const,
	degradedWriteEnabled: false,
	isWorkspaceWritable: true,
	isOnline: true,
	dataSourceNotice: null,
	coverageMode: 'REAL_FACULTY_STANDARD' as CoverageMode,
	onCoverageModeChange: () => {},
	coverageModeConfig: COVERAGE_MODE_CONFIG,
	workspaceStateLabel: 'EnrollPro roster verified',
	workspaceStateDescription: 'ATLAS Teaching Load draft. Freshly verified.',
	workspaceStateNextAction: 'Review one teacher, then save the draft.',
	activeDraftCount: 0,
	saving: false,
	onSave: () => {},
	onRetrySource: () => {},
};

/**
 * Row 2 exactly as `TeachingLoad.tsx` builds it AFTER A6 C2: the repair queue
 * (which supplies the ONE primary action) and nothing else, because the
 * `% staffed` / `Classes without a teacher` / alert figures moved INTO the one
 * status sentence the toolbar itself renders, and the `Archived load` link moved
 * into the More menu.
 *
 * A6 C2 REMOVED the `TeachingLoadTruthPanel` from this fixture. It was never on
 * the production state line — FIX 38 had already moved it into the `Load summary`
 * dialog — so injecting it here measured a layout the product does not have, and
 * it was the reason T7 could assert four truth-panel test ids on "the state
 * line". The real panel is still covered, in its real dialog, by
 * `a6-teaching-load-surface` A6-C2-1.
 */
function renderStateLine(): string {
	// The page wraps the route in a TooltipProvider; so does CompactTitleStrip.
	// This matches that so the queue's description hover renders as it does live.
	return renderToStaticMarkup(
		createElement(
			TooltipProvider,
			null,
			createElement(TeachingLoadRepairQueue, {
				items: REPAIR_ITEMS,
				activeItemId: 'missing-load',
				isReadOnly: false,
				saving: false,
				onPrimaryAction: () => {},
			}),
		),
	);
}

function renderToolbar(): Document {
	const html = renderToStaticMarkup(
		createElement(WorkspaceToolbar, { ...toolbarProps, stateLineSlot: null } as never),
	);
	return new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
}

/** The strip, with the page's real state line inside row 2. */
function renderStrip(): {
	outer: Element;
	bands: Element[];
	stateLine: Element;
	commandRow: Element;
} {
	// One render of the strip with the page's real state line in the slot, so
	// every number below is measured on shipped markup.
	const html = renderToStaticMarkup(
		createElement(WorkspaceToolbar, {
			...toolbarProps,
			stateLineSlot: createElement('div', { dangerouslySetInnerHTML: { __html: renderStateLine() } }),
		} as never),
	);
	const doc = new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
	const outer = doc.querySelector('[data-testid="teaching-load-command-header"]')!;
	const bands = Array.from(outer.children).filter((child) => {
		const className = child.getAttribute('class') ?? '';
		return !tokens(className).includes('sr-only');
	});
	return {
		outer,
		bands,
		stateLine: doc.querySelector('[data-testid="teaching-load-readiness-strip"]')!,
		commandRow: doc.querySelector('[data-testid="teaching-load-compact-command-header"]')!,
	};
}

const { outer: STRIP_OUTER, bands: STRIP_BANDS, stateLine: STATE_LINE, commandRow: COMMAND_ROW } = renderStrip();

// =============================================================================
// The derived numbers. Nothing below is a literal copied out of a comment.
// =============================================================================

const pageSource = source(PAGE_FILE);
const appChromeRem = /100svh-(\d+(?:\.\d+)?)rem/.exec(pageSource);
const APP_CHROME_PX = appChromeRem ? Number(appChromeRem[1]) * 16 : NaN;

const STRIP_CONTAINER_BOX_PX = containerVerticalBox(STRIP_OUTER.getAttribute('class') ?? '');
const ROW_1_COMMAND_PX = rowHeight(COMMAND_ROW);
const ROW_2_BAND_PX = rowHeight(STATE_LINE);
const ROW_2_BORDER_PX = borderBox(STATE_LINE.getAttribute('class') ?? '');
/** The row's own chips, with the separating hairline taken out. */
const ROW_2_CHIP_PX = ROW_2_BAND_PX - ROW_2_BORDER_PX;
const HEADER_ROWS = STRIP_BANDS.length;
const HEADER_TOTAL_PX = STRIP_CONTAINER_BOX_PX + ROW_1_COMMAND_PX + ROW_2_BAND_PX;
const SAVED_PX = HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX - HEADER_TOTAL_PX;
const PROJECTED_FIRST_ROW_PX = HEADER_MODEL.MEASURED_FIRST_ROW_BASELINE_PX - SAVED_PX;


// =============================================================================
// T1 — the model is declared in the component, and the two copies agree.
// =============================================================================

test('T1 the component declares the height model, and this control declares the same numbers', () => {
	const declared = /export const TEACHING_LOAD_HEADER_MODEL = \{([\s\S]*?)\} as const;/.exec(source(TOOLBAR_FILE));
	assert.ok(declared, TOOLBAR_FILE + ' must export TEACHING_LOAD_HEADER_MODEL');
	for (const [key, value] of Object.entries(HEADER_MODEL)) {
		const match = new RegExp('\\b' + key + ':\\s*(\\d+)').exec(declared[1]);
		assert.ok(match, 'the component model must declare ' + key);
		assert.equal(
			Number(match[1]),
			value,
			`${key} drifted: component says ${match[1]}, this control says ${value}. The comment and the assertion must move together.`,
		);
	}
	// The internal arithmetic must hold too, or the constants are decoration.
	assert.equal(
		HEADER_MODEL.HEADER_TOTAL_PX,
		HEADER_MODEL.STRIP_CONTAINER_BOX_PX + HEADER_MODEL.ROW_1_COMMAND_PX + HEADER_MODEL.ROW_2_BAND_PX,
		'HEADER_TOTAL_PX must be the strip box + row 1 + row 2',
	);
	assert.equal(
		HEADER_MODEL.ROW_2_BAND_PX,
		HEADER_MODEL.ROW_2_BORDER_PX + HEADER_MODEL.ROW_2_CHIP_PX,
		'ROW_2_BAND_PX must be the separating hairline plus the tallest chip',
	);
	assert.equal(
		HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX,
		9 + 28 + 45 + 41 + 42 + 58,
		'PRE_CHANGE_HEADER_TOTAL_PX must be the derived pre-change stack: strip 9, command 28, tab row 45, readiness 41, truth band 42, next-step banner 58',
	);
});

// =============================================================================
// T2 — every constant is re-derived from the shipped classes, not trusted.
// =============================================================================

test('T2 the model is re-derived from the real class strings, not asserted against a comment', () => {
	assert.equal(APP_CHROME_PX, HEADER_MODEL.APP_CHROME_PX, 'the app bar above the route root is `3.5rem`');
	assert.equal(STRIP_CONTAINER_BOX_PX, HEADER_MODEL.STRIP_CONTAINER_BOX_PX, 'strip box = py-1 (4+4) + border-b (1)');
	assert.equal(ROW_1_COMMAND_PX, HEADER_MODEL.ROW_1_COMMAND_PX, 'the command row is as tall as its tallest control');
	assert.equal(ROW_2_BORDER_PX, HEADER_MODEL.ROW_2_BORDER_PX, 'only the 1px hairline separates the two rows');
	assert.equal(ROW_2_CHIP_PX, HEADER_MODEL.ROW_2_CHIP_PX, 'the state line is as tall as its tallest chip');
	assert.equal(ROW_2_BAND_PX, HEADER_MODEL.ROW_2_BAND_PX, 'row 2 is the hairline plus its tallest chip');
	assert.equal(
		HEADER_TOTAL_PX,
		HEADER_MODEL.HEADER_TOTAL_PX,
		`derived header total ${HEADER_TOTAL_PX}px != declared ${HEADER_MODEL.HEADER_TOTAL_PX}px`,
	);
	// The readers are not vacuous: they really do read padding, borders, heights
	// and margins — including the border-box rule, without which every
	// `h-N` + padding + border control would be double-counted.
	assert.equal(containerVerticalBox('py-1 border-b'), 9);
	assert.equal(containerVerticalBox('py-1.5 border'), 14);
	assert.equal(containerVerticalBox('shrink-0'), 0);
	assert.equal(fixedHeight('h-7 gap-1.5'), 28);
	assert.equal(fixedHeight('size-7 shrink-0'), 28);
	assert.equal(padTop('mt-1.5 border-t pt-1.5'), 6);
	assert.equal(padBottom('mt-1.5 border-t pt-1.5'), 0, 'a pt- class pads the top only');
	assert.equal(padTop('p-1.5'), 6);
	assert.equal(padBottom('p-1.5'), 6, 'a p- class pads both sides');
	assert.equal(marginTop('mt-1.5 border-t pt-1.5'), 6);
	assert.equal(borderBox('flex border-t border-border/40'), 1);
	assert.equal(
		boxHeight(makeEl('h-7 p-0.5 border')),
		28,
		'border-box: an h-7 with padding and a border is 28px, not 34px',
	);
	assert.equal(
		boxHeight(makeEl('py-1', ['text-xs'])),
		24,
		'a padded prose row is its line box plus its padding',
	);
	assert.equal(
		rowHeight(makeEl('mt-1.5 border-t pt-1.5', ['h-8'])),
		45,
		'the removed tab row cost mt 6 + border 1 + pt 6 + h-8 32 = 45px',
	);
	// A collapsed disclosure is not a row.
	assert.equal(boxHeight(makeEl('', ['hidden h-9'])), 0, 'a hidden child must not drive a row');
});

function makeEl(parentClass: string, childClasses: string[] = []): Element {
	const dom = new JSDOM(
		`<!doctype html><html><body><div class="${parentClass}">${childClasses
			.map((c) => `<span class="${c}">x</span>`)
			.join('')}</div></body></html>`,
	);
	return dom.window.document.querySelector('div')!;
}

// =============================================================================
// T3 — the header is at most TWO rows, and the switch is on row 1.
// =============================================================================

test('T3 the header is at most 2 rows, and the Teachers/Sections switch sits on row 1', () => {
	assert.equal(
		STRIP_BANDS.length,
		MAX_HEADER_ROWS,
		`the strip renders ${STRIP_BANDS.length} band rows (${STRIP_BANDS.map((b) => b.getAttribute('data-testid') ?? '(row)').join(', ')}); at most ${MAX_HEADER_ROWS} are allowed`,
	);
	assert.equal(COMMAND_ROW.getAttribute('data-testid'), 'teaching-load-compact-command-header');
	assert.equal(STRIP_BANDS[0], COMMAND_ROW, 'row 1 is the command row');
	assert.equal(STRIP_BANDS[1], STATE_LINE, 'row 2 is the single state line');

	// The switch moved ONTO row 1; it is no longer a band of its own.
	assert.ok(
		COMMAND_ROW.querySelector('[data-testid="teaching-load-tab-row"]'),
		'the Teachers/Sections switch must be inside the command row',
	);
	assert.equal(
		STRIP_BANDS.some((band) => band.hasAttribute('data-testid') && band.getAttribute('data-testid') === 'teaching-load-tab-row'),
		false,
		'the switch must not be a band row of its own any more',
	);
	// The switch is reachable from row 1 and its triggers are real controls.
	const tabRow = COMMAND_ROW.querySelector('[data-testid="teaching-load-tab-row"]')!;
	assert.equal(tabRow.querySelectorAll('[role="tab"], button').length >= 2, true, 'both Teachers and Sections must render');
	// Row 2 is the only other band: everything else the operator used to scroll
	// past is inside it.
	assert.equal(
		STRIP_BANDS.filter((band) => band === COMMAND_ROW || band === STATE_LINE).length,
		STRIP_BANDS.length,
		'the strip must contain the command row and the state line, and nothing else',
	);
});


// =============================================================================
// T4 — the page's own bands are gone; only the rollover wrapper remains.
// =============================================================================

test('T4 the page stacks no header band of its own above the roster', () => {
	const shellAt = code(PAGE_FILE).indexOf('data-testid="teaching-load-content-shell"');
	const workspaceAt = code(PAGE_FILE).indexOf('data-testid="teaching-load-workspace"');
	assert.ok(shellAt > 0 && workspaceAt > shellAt, 'the main column must still exist');
	const column = code(PAGE_FILE).slice(shellAt, workspaceAt);

	// Before: three `shrink-0` bands (rollover, truth summary, next step).
	// After: the rollover wrapper only — it is A2/A3-owned and out of this fence.
	assert.equal(
		(column.match(/shrink-0/g) ?? []).length,
		1,
		'the main column must carry exactly one shrink-0 band, the out-of-fence rollover wrapper',
	);
	assert.match(column, /RolloverGuidanceCard/, 'the rollover wrapper is the one that remains');

	/**
	 * SUPERSEDED BY A6 C2 — the `Archived load` link is no longer a member of the
	 * state line. It is a NAVIGATION link, not a state chip, and Lane C measured
	 * the state line trying to hold 1,070px at 1366x768 with the link's own 117px
	 * among them. The operator's target header keeps `Archived load` off the two
	 * status rows, so it moved into the toolbar's More menu. The claim the
	 * assertion protected — nothing that belongs above the roster is stacked as
	 * its own band — is STRICTLY STRONGER below, which pins BOTH remaining
	 * members on the row AND the link's new home.
	 *
	 * The original expectation, verbatim:
	 *
	 *   for (const component of ['<TeachingLoadRepairQueue', 'data-testid="teaching-load-history-link"']) {
	 *     const at = pageSource.indexOf(component);
	 *     assert.ok(at > 0, 'the page must render ' + component);
	 *     const lineAt = pageSource.indexOf('const headerStateLine = (');
	 *     assert.ok(at > lineAt, component + ' must be composed into the state line, not stacked above the roster');
	 *   }
	 */
	const lineAt0 = pageSource.indexOf('const headerStateLine = (');
	const lineEnd0 = pageSource.indexOf('\n\t);', lineAt0);
	const queueAt0 = pageSource.indexOf('<TeachingLoadRepairQueue');
	assert.ok(queueAt0 > 0, 'the page must still render the repair queue');
	assert.ok(
		queueAt0 > lineAt0 && queueAt0 < lineEnd0,
		'the repair queue must be composed INTO the state line, not stacked above the roster',
	);
	// STRICTLY STRONGER: the link is still built by the page (one place to read
	// the reachability claim, and `client-quality-c01` reads it there), and it is
	// now positioned by the header's More menu instead of the status row.
	const historyAt = pageSource.indexOf('data-testid="teaching-load-history-link"');
	assert.ok(historyAt > 0, 'the page must still build the `Archived load` link itself');
	assert.ok(
		historyAt > lineEnd0,
		'the `Archived load` link must have moved OFF the state line and into the header action group',
	);
	assert.match(pageSource, /historyAction=\{/, 'the link must be handed to the header, which owns its position');
	assert.match(
		pageSource,
		/<Link to="\/teaching-load\/history" data-testid="teaching-load-history-link">/,
		'and it must still be a real link to the archived Teaching Load surface',
	);
	assert.match(pageSource, /stateLineSlot=\{headerStateLine\}/, 'the strip must receive the state line');

	/**
	 * SUPERSEDED BY FIX 38 — recorded, not deleted (AGENTS.md: corrections are
	 * additive; a control is never removed to close a finding).
	 *
	 * The assertion this replaces read:
	 *
	 *   assert.match(
	 *     pageSource.slice(pageSource.indexOf('<TeachingLoadTruthPanel'), ...+ 200),
	 *     /\binline\b/,
	 *     'the page must render the truth panel in its inline state-line form',
	 *   );
	 *
	 * It required the truth panel to sit in the state line in its `inline` form.
	 * FIX 38 (operator, 2026-09-28) asks for the opposite on this exact surface:
	 * the inline `TEACHING LOAD SUMMARY` band is removed and the breakdown moves
	 * behind one header button and a dialog. Keeping the old assertion would
	 * force the operator's requested change to be reverted; the claim it was
	 * protecting — "the truth panel is not stacked as its own band above the
	 * roster" — is STRICTLY STRONGER under the replacement below, and the
	 * `shrink-0` count above already carries the density claim.
	 *
	 * The panel NODE is still required to be built by the page, on the page's own
	 * `truthModel`; only its POSITION moved. That is asserted here.
	 */
	const panelAt = pageSource.indexOf('<TeachingLoadTruthPanel');
	assert.ok(panelAt > 0, 'the page must still build the truth panel itself, so there is one authority for every figure');
	const headerLineAt = pageSource.indexOf('const headerStateLine = (');
	const headerLineEnd = pageSource.indexOf('\n\t);', headerLineAt);
	assert.ok(headerLineAt > 0 && headerLineEnd > headerLineAt, 'the state line must be locatable as a region, not just a point');
	assert.ok(
		panelAt > headerLineEnd,
		'the truth panel must have moved OUT of the state line and into the `Load summary` dialog (FIX 38)',
	);
	assert.match(pageSource, /loadSummaryAction=\{/, 'the panel must be handed to the header action area, which owns the control');
	assert.match(
		pageSource.slice(panelAt, panelAt + 200),
		/\bexpanded\b/,
		'the dialog must render the panel in its expanded form, not the collapsed inline strip',
	);
	assert.doesNotMatch(
		pageSource.slice(headerLineAt, headerLineEnd),
		/TeachingLoadTruthPanel/,
		'the state line must not carry the truth panel any more (FIX 38)',
	);
});

// =============================================================================
// T5 — the budget, and the projection the operator actually gets.
// =============================================================================

test('T5 the derived header total is inside the budget, and the first data row starts materially higher', () => {
	assert.ok(
		HEADER_TOTAL_PX <= HEADER_BUDGET_PX,
		`the header is ${HEADER_TOTAL_PX}px, over the ${HEADER_BUDGET_PX}px budget at a 768px viewport`,
	);
	assert.ok(HEADER_ROWS <= MAX_HEADER_ROWS, `the header is ${HEADER_ROWS} rows, over the ${MAX_HEADER_ROWS}-row ceiling`);

	assert.ok(
		SAVED_PX >= MIN_SAVING_PX,
		`only ${SAVED_PX}px saved against the pre-change ${HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX}px; the control demands at least ${MIN_SAVING_PX}px`,
	);
	assert.ok(
		PROJECTED_FIRST_ROW_PX < HEADER_MODEL.MEASURED_FIRST_ROW_BASELINE_PX,
		'the first data row must start higher (a smaller y-offset) than the measured 430px baseline',
	);
	// And the roster's remaining height is what the criteria ask about: more
	// than one row of assignment content at 768px.
	const viewportAfterChrome = 768 - APP_CHROME_PX;
	assert.ok(
		viewportAfterChrome - HEADER_TOTAL_PX >= 3 * 40,
		`after the header, ${viewportAfterChrome - HEADER_TOTAL_PX}px of column remains, which must fit at least three 40px assignment rows`,
	);
});

// =============================================================================
// T6 — the model DISCRIMINATES: it fails on the pre-change structure.
// =============================================================================

test('T6 FAILING-FIRST: the same model fails on the pre-change five-row header', () => {
	/**
	 * The pre-change stack at base `c80c085`, as a box tree in the class strings
	 * that produced it. `wrapper` is the band that separated one row from the
	 * next (its margin, padding and top border); `box` is the row itself.
	 * The same readers that measure the shipped DOM measure this, so the two
	 * shapes are compared with one instrument.
	 */
	type PreChangeRow = { id: string; wrapper: string; box: Box };
	type Box = { cls: string; children?: Box[] };

	const boxOf = (box: Box): number => {
		const fixed = fixedHeight(box.cls);
		if (fixed !== null) return fixed;
		const content = box.children?.length
			? Math.max(...box.children.map(boxOf))
			: lineBoxOf(box.cls);
		return content + padTop(box.cls) + padBottom(box.cls) + borderBox(box.cls);
	};
	const offsetOf = (cls: string): number =>
		marginTop(cls) + padTop(cls) + padBottom(cls) + borderBox(cls);

	const PRE_CHANGE_ROWS: PreChangeRow[] = [
		// command row: the shared strip row; the tallest thing in it is an h-7
		// action button.
		{ id: 'command row', wrapper: '', box: { cls: 'flex flex-wrap items-center', children: [{ cls: 'h-7 gap-1.5' }] } },
		// Teachers/Sections: a band of its own, separated by mt-1.5 + border-t +
		// pt-1.5 around an h-8 Tabs.
		{ id: 'Teachers/Sections tab row', wrapper: 'mt-1.5 border-t pt-1.5', box: { cls: 'h-8' } },
		// readiness strip: same 13px separation around the h-7 chips.
		{ id: 'readiness strip (% staffed, no-teacher, alert chip)', wrapper: 'mt-1.5 border-t pt-1.5', box: { cls: 'h-7 shrink-0' } },
		// the canonical truth band: pt-1 wrapper, then a bordered card, then the
		// collapsed accordion trigger.
		{
			id: 'truth summary band',
			wrapper: 'pt-1',
			box: {
				cls: 'rounded-xl border px-2 py-1.5',
				children: [{ cls: 'py-1', children: [{ cls: 'text-xs' }] }],
			},
		},
		// the "Next step" banner: a py-1 section around a bordered card around a
		// row whose tallest member is the h-9 primary action.
		{
			id: 'next-step repair-queue banner',
			wrapper: 'px-2 py-1',
			box: {
				cls: 'rounded-xl border p-1.5',
				children: [
					{
						cls: 'flex items-center gap-2',
						children: [
							{ cls: 'size-7 shrink-0' },
							{ cls: 'min-w-0 flex-1', children: [{ cls: 'h-6 shrink-0' }, { cls: 'mt-0.5 text-xs leading-5' }] },
							{ cls: 'h-9 shrink-0' },
						],
					},
				],
			},
		},
	];

	for (const row of PRE_CHANGE_ROWS) {
		assert.ok(
			offsetOf(row.wrapper) + boxOf(row.box) > 0,
			'the pre-change ' + row.id + ' row must have a non-zero height, or the model is not reading it',
		);
	}

	const preChangeStripBox = containerVerticalBox('shrink-0 border-b bg-background/85 px-4 py-1');
	const preChangeBlocks = PRE_CHANGE_ROWS.map((row) => ({
		id: row.id,
		px: offsetOf(row.wrapper) + boxOf(row.box),
	}));
	const preChangeTotal = preChangeStripBox + preChangeBlocks.reduce((sum, row) => sum + row.px, 0);
	const preChangeRowCount = PRE_CHANGE_ROWS.length;

	assert.equal(preChangeStripBox, HEADER_MODEL.STRIP_CONTAINER_BOX_PX);
	assert.equal(
		preChangeTotal,
		HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX,
		`derived pre-change total ${preChangeTotal}px (${preChangeBlocks.map((r) => r.id + ' ' + r.px).join(', ')}) != declared ${HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX}px`,
	);
	assert.equal(preChangeRowCount, 5);

	// The two assertions this control exists to make, applied to the old stack.
	assert.ok(
		preChangeTotal > HEADER_BUDGET_PX,
		`the model must reject the pre-change header: ${preChangeTotal}px is over the ${HEADER_BUDGET_PX}px budget`,
	);
	assert.ok(
		preChangeRowCount > MAX_HEADER_ROWS,
		`the model must reject the pre-change header: ${preChangeRowCount} rows is over the ${MAX_HEADER_ROWS}-row ceiling`,
	);
	// The saving is what moved the first data row, and it is the whole point.
	assert.equal(SAVED_PX, HEADER_MODEL.PRE_CHANGE_HEADER_TOTAL_PX - HEADER_TOTAL_PX);
	assert.equal(PROJECTED_FIRST_ROW_PX, HEADER_MODEL.MEASURED_FIRST_ROW_BASELINE_PX - SAVED_PX);
});

// =============================================================================
// T7 — TRUTH IS NOT DECORATION: every compacted state is announced.
// =============================================================================

test('T7 every state compacted into row 2 is still visible and announced on the trigger', () => {
	const chip = STATE_LINE.querySelector('[data-testid="teaching-load-current-repair"]')!;
	assert.ok(chip, 'the next-step chip must be on the state line');
	const chipText = chip.textContent ?? '';

	// What moved: the queue's prose description. Everything that tells the
	// operator there is work to do must be in the trigger itself.
	assert.match(chipText, /Next step/, 'the chip must name what it is');
	assert.match(chipText, /3 to fix/, 'the chip must carry the queue count');
	assert.match(chipText, /3 classes have no teacher/, 'the chip must carry the task');
	assert.match(chipText, /3 awaiting assignment/, 'the chip must carry the live status');
	assert.doesNotMatch(
		chipText,
		/A scheduler officer should assign these/,
		'the prose description is the one thing behind the hover; it must not also be inlined',
	);
	assert.equal(
		chip.getAttribute('data-repair-kind'),
		'missing-load',
		'the chip must keep announcing which kind of work it is',
	);

	// The action is still a real control, with its label and its test id.
	const action = STATE_LINE.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement | null;
	assert.ok(action, 'the next-step primary action must stay on the state line');
	assert.match(
		action!.textContent ?? '',
		new RegExp(STAFF_WORKLOAD_REVIEW_LABEL),
		'the action keeps the label the ONE opener module declares (A6 C2 Slice 5)',
	);
	assert.equal(action!.disabled, false, 'the action must be operable in the loaded state');
	assert.ok(
		STATE_LINE.contains(action!),
		'the action must be inside the state line, not a band of its own',
	);

	// A SAFETY state is never behind a disclosure: the disabled reason is its
	// own visible chip naming the reason.
	const blocked = renderToStaticMarkup(
		createElement(TooltipProvider, null, createElement(TeachingLoadRepairQueue, {
			items: [{ ...REPAIR_ITEMS[0], disabledReason: 'Read-only: verify the source first' }],
			activeItemId: 'missing-load', isReadOnly: false, saving: false,
			onPrimaryAction: () => {},
		})),
	);
	const blockedDoc = new JSDOM(`<!doctype html><body>${blocked}</body>`).window.document;
	const reason = blockedDoc.querySelector('[data-testid="teaching-load-repair-disabled-reason"]')!;
	assert.ok(reason, 'the disabled reason must render');
	assert.match(reason.textContent ?? '', /Read-only: verify the source first/, 'the reason must be visible text, not a hover');

	/*
	 * SUPERSEDED BY A6 C2 — the row-2 composition assertions this control used to
	 * make, preserved VERBATIM as a copy claim. Each of them is a claim about
	 * WHICH SURFACE a piece of state appears on, and the operator's 2026-09-28
	 * spec (Major 1 + Major 2) contradicts all of them: row 2 is "one sentence of
	 * status + ONE primary action", the long summary belongs behind `Load
	 * summary`, and `Archived load` belongs in the More menu. Keeping them would
	 * force the requested change to be reverted.
	 *
	 *   // The canonical truth surface keeps its own one-line announcement.
	 *   const truthLine = STATE_LINE.querySelector('[data-testid="teaching-load-truth-summary-line"]')!;
	 *   assert.ok(truthLine, 'the truth summary line must stay on the state line');
	 *   assert.match(truthLine.textContent ?? '', /42 classes/, 'the summary must still state the class count');
	 *   assert.match(truthLine.textContent ?? '', /3 without a teacher/, 'the summary must still state the unassigned count');
	 *   // Source-of-truth state is not decoration either.
	 *   assert.ok(
	 *     STATE_LINE.querySelector('[data-testid="teaching-load-truth-source-badge"]'),
	 *     'the EnrollPro source-verification badge must stay reachable',
	 *   );
	 *   assert.match(
	 *     STATE_LINE.textContent ?? '',
	 *     /Up to date with EnrollPro/,
	 *     'the source badge must state its state',
	 *   );
	 *   assert.ok(
	 *     STATE_LINE.querySelector('[data-testid="teaching-load-truth-details"]'),
	 *     'the Details popover trigger must stay reachable',
	 *   );
	 *   // And the % staffed / unassigned / alert figures are all still on the line.
	 *   const lineText = STATE_LINE.textContent ?? '';
	 *   assert.match(lineText, /% staffed/, 'the % staffed figure must stay on the state line');
	 *   assert.match(lineText, /Classes without a teacher/, 'the unassigned count must stay on the state line');
	 *   assert.match(lineText, /Above weekly max: 1/, 'the alert chip must stay on the state line and state its number');
	 *   assert.ok(
	 *     STATE_LINE.querySelector('[data-testid="teaching-load-alert-over-cap"]'),
	 *     'the alert chip keeps its test id',
	 *   );
	 *
	 * WHAT SURVIVES, AS STRICTLY STRONGER ASSERTIONS. None of these is "the chip
	 * is on row 2" any more; each is "the state is still visible SOMEWHERE on the
	 * header, and the row-2 sentence is the one place it may be":
	 */
	const sentence = STATE_LINE.querySelector('[data-testid="teaching-load-status-sentence"]')!;
	assert.ok(sentence, 'row 2 must carry exactly ONE status sentence');
	assert.equal(
		STATE_LINE.querySelectorAll('[data-testid="teaching-load-status-sentence"]').length,
		1,
		'there must be one status sentence, not several competing ones',
	);
	// SUPERSEDED BY A6 c5 S3 (2026-09-29) — recorded, not deleted. The old
	// assertion was `assert.match(sentence.textContent, /95% staffed/)`, which
	// read (39 real + 1 synthetic placeholder) / 42 — it counted a to-be-hired
	// record as a teacher on a fixture that HAS a placeholder. A6 c5 fixes the
	// computation itself, so the corrected figure is 39/42 = 93%. The rule this
	// control exists for — "row 2 states the % staffed figure at all" — is
	// unchanged and is asserted by the line below.
	assert.match(sentence.textContent ?? '', /93% staffed/, 'the sentence must still state the % staffed figure');
	assert.match(sentence.textContent ?? '', /3 classes need a teacher/, 'the sentence must still state the classes needing a teacher');
	// The alert KEEPS its test id and its number, inside the sentence.
	assert.ok(
		STATE_LINE.querySelector('[data-testid="teaching-load-alert-over-cap"]'),
		'the alert must stay addressable by its test id',
	);
	assert.match(STATE_LINE.textContent ?? '', /Above weekly max: 1/, 'the alert must still state its number');
	// And row 2 scrolls no longer: the defect was a sideways scroller.
	assert.doesNotMatch(
		STATE_LINE.getAttribute('class') ?? '',
		/overflow-x-auto/,
		'row 2 must not scroll sideways; a long sentence truncates instead',
	);
	// The truth panel is NOT on row 2 any more — it is in the `Load summary`
	// dialog, on the page's own `truthModel` (FIX 38, and T4 above).
	assert.equal(
		STATE_LINE.querySelector('[data-testid="teaching-load-truth-panel"]') === null,
		true,
		'the truth panel must be in the `Load summary` dialog, not back on the state line',
	);
	assert.equal(
		STATE_LINE.querySelector('[data-testid="teaching-load-history-link"]') === null,
		true,
		'the `Archived load` link must be in the More menu, not on the state line',
	);
	// The long breakdown is STILL reachable, with all thirteen figures — asserted
	// on the real panel in its real dialog by `a6-teaching-load-surface`
	// A6-C2-1, so the numbers are not lost by moving them.
	assert.ok(TRUTH_MODEL, 'the truth model still exists for the dialog surface');
});

// =============================================================================
// T8 — every preserved data-testid, and the offline / read-only states.
// =============================================================================

test('T8 no data-testid was lost, and the degraded states still render', () => {
	const doc = renderToolbar();
	for (const testId of [
		'teaching-load-command-header',
		'teaching-load-compact-command-header',
		'teaching-load-source-truth-summary',
		'teaching-load-tab-row',
		'teaching-load-readiness-strip',
		'compact-title-strip-status',
	]) {
		assert.ok(doc.querySelector(`[data-testid="${testId}"]`), 'lost data-testid: ' + testId);
	}
	// The offline and read-only states are source-of-truth state, and the
	// compaction must not have made either of them unreachable or unstyled.
	for (const { state, pattern } of [
		{ state: { isOnline: false }, pattern: /Offline/ },
		{ state: { dataSource: 'cached' as const, isWorkspaceWritable: false, degradedWriteEnabled: false }, pattern: /Read-only/ },
		{ state: { dataSource: 'none' as const }, pattern: /ATLAS Teaching Load draft/ },
		{ state: { dataSource: 'refreshing' as const }, pattern: /Checking source/ },
	]) {
		const stateDoc = new JSDOM(
			`<!doctype html><body>${renderToStaticMarkup(
				createElement(WorkspaceToolbar, { ...toolbarProps, ...state, stateLineSlot: null } as never),
			)}</body>`,
		).window.document;
		const badge = stateDoc.querySelector('[data-source-state]')!;
		assert.ok(badge, 'the status badge must render for this state');
		assert.match(badge.textContent ?? '', pattern);
		// The recovery affordance for a lost source is a control, not a label.
		if (state.dataSource === 'none' || state.isOnline === false) {
			assert.match(
				stateDoc.body.textContent ?? '',
				/Retry source|Offline/,
				'a lost source must still offer the retry path on row 1',
			);
		}
	}
	// The repair-queue states are declared in production, not only the happy one.
	assert.match(code(REPAIR_QUEUE_FILE), /disabledReason/, 'the queue must still surface a disabled reason');
	assert.match(code(REPAIR_QUEUE_FILE), /'read-only'/, 'the read-only task kind must still exist');
});

// =============================================================================
// T9 — the repo rules this change could have broken.
// =============================================================================

test('T9 no raw widget, no new scroll container, and no oversized component', () => {
	for (const file of [TOOLBAR_FILE, TRUTH_PANEL_FILE, REPAIR_QUEUE_FILE, FILTER_BAR_FILE, PAGE_FILE]) {
		const text = code(file);
		assert.doesNotMatch(text, /<details/, file + ' must not use a raw <details>');
		assert.doesNotMatch(
			text,
			/<(div|span|p|button|section|li|ul)[^>]*\stitle=/,
			file + ' must not use an HTML title attribute for extra information',
		);
		assert.doesNotMatch(text, /<select[\s>]/, file + ' must not use a native <select>');
	}
	// The no-scroll architecture survives, and nothing here added a nested
	// vertical scroller. Prose describing the rule is stripped first, so this
	// is the rendered behaviour and not a mention of it.
	assert.match(code(PAGE_FILE), /h-\[calc\(100svh-3\.5rem\)\]/, 'the no-scroll root shell must survive');
	assert.match(code(PAGE_FILE), /flex-1 flex min-h-0/);
	assert.match(code(PAGE_FILE), /overflow-y-auto/);
	assert.match(code(PAGE_FILE), /min-h-\[140px\] flex-1/, 'the workspace must keep its min height');
	assert.doesNotMatch(code(TRUTH_PANEL_FILE), /overflow-y-auto/, 'the truth panel must stay horizontally-only');
	assert.doesNotMatch(code(FILTER_BAR_FILE), /overflow-(y-)?(auto|scroll)/, 'the filter bar must stay scroll-free');
	// §8: no React component file above 1000 physical lines.
	for (const file of [TOOLBAR_FILE, TRUTH_PANEL_FILE, REPAIR_QUEUE_FILE, FILTER_BAR_FILE, PAGE_FILE]) {
		const lines = source(file).split('\n').length;
		assert.ok(lines <= 1000, file + ' is ' + lines + ' lines, over the 1000-line ceiling');
	}
});
