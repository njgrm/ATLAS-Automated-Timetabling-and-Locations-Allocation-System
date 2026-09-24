/**
 * TIMETABLE-HEADER-COLLAPSE-C01 — the single-row header (D1) and the
 * published-state / `Generate` prominence truth (D2/D3).
 *
 * Production path: this suite renders the real `TimetableSimpleHeader` with an
 * injected workspace context (the same entry path the route uses), then reads
 * the RENDERED markup. It measures structure, never pixels — jsdom/SSR has no
 * layout engine. The packet's grid-top target (≤ ~140 px at 1366×768) is a
 * post-deployment browser row and is deliberately NOT asserted here; only the
 * structural facts that make a one-row header possible are asserted:
 *   - exactly one status region and exactly one action cluster,
 *   - exactly one header row band, whose ≥1366 px declarations build a single
 *     non-wrapping flex row (`wide:flex-row` + `wide:flex-nowrap`),
 *   - exactly one filled (bg-primary) primary, which is never `Generate`.
 *
 * C1/C2 — the ≥1366 px declarations are proven against the BUILT CSS, not the
 * JSX source. The reviewed defect was that `min-[1366px]:*` arbitrary variants
 * were emitted BEFORE the `lg:` block, so at ≥1366 px `lg:flex`/`lg:hidden` won
 * the equal-specificity tie by source order and the collapse was inverted. This
 * suite now runs the same Tailwind pipeline the production build runs
 * (`@tailwindcss/node` compile → build → optimize) over the real
 * `src/index.css` theme, using the class tokens read from the RENDERED markup,
 * and asserts the emitted rule order and effective declaration. A source-string
 * match could not see the cascade and certified the opposite of the defect.
 *
 * Failing-first (D2/D3) — the control this file exists for. On the base commit:
 *   · a published run renders the outline `Generate` at `h-11` (44 px) beside a
 *     light `h-11` published chip → `height(published) > height(Generate)` is
 *     false, and `Generate` is the visually largest control on the row;
 *   · every non-published state renders `Generate` at `h-11` beside an `h-11`
 *     lifecycle primary → `height(primary) > height(Generate)` is false.
 * After the correction the published lifecycle surface keeps `h-11` while
 * `Generate` is demoted to `h-8` (32 px) in every state.
 *
 * Run: `npm run test:timetable-relaxed-main` (also named in `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { compile, optimize } from '@tailwindcss/node';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { TimetableSimpleHeader } from '../TimetableSimpleHeader';
import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import type { DraftReport } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function draftWithSummary(summary: Record<string, unknown>): DraftReport {
	return {
		runId: 42,
		status: 'COMPLETED',
		entries: [],
		unassignedItems: [],
		summary: summary as unknown as DraftReport['summary'],
		version: 3,
		finishedAt: null,
		createdAt: '2031-01-01T00:00:00.000Z',
	} as unknown as DraftReport;
}

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
		summary: { assignedCount: 0, classesProcessed: 0, hardViolationCount: 0, unassignedCount: 0 },
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
		termFilter: 2,
		onTermFilterChange: () => {},
		termOptions: [
			{ value: 'all', label: 'All terms' },
			{ value: '1', label: 'TERM 1' },
			{ value: '2', label: 'TERM 2' },
			{ value: '3', label: 'TERM 3' },
		],
		activeTermIndex: 2,
		...overrides,
	} as unknown as ScheduleReviewWorkspaceHeaderContext;
}

function renderHeader(overrides: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, null,
			createElement(TimetableSimpleHeader, {
				context: makeContext(overrides),
				layoutMode: 'simple',
				onLayoutModeChange: () => {},
				activeTask: null,
				onTaskChange: () => {},
			}),
		),
	);
}

function tagFor(markup: string, testId: string): string {
	const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
	assert.ok(match, `expected an element with data-testid="${testId}"`);
	return match[0];
}

function classOf(tag: string): string {
	return tag.match(/class="([^"]*)"/)?.[1] ?? '';
}

/* ── C1/C2 — the built-CSS cascade proof ─────────────────────────────────────
 *
 * These helpers run the SAME Tailwind pipeline the production build runs
 * (`@tailwindcss/node`: compile the real `src/index.css` theme → build the
 * candidate classes → `optimize` via lightningcss, exactly what the Vite plugin
 * does) and then evaluate the emitted utilities layer. This is deliberately not
 * a JSX source-string match: the reviewed defect lived in the emitted CSS order,
 * which source text cannot see.
 */

/** One emitted style rule inside the utilities layer. */
interface EmittedRule {
	/** The rule's selector list, e.g. `.wide\:hidden`. */
	selector: string;
	/** The enclosing media condition without the `@media` keyword, e.g. `(min-width:85.375rem)`. */
	media: string | null;
	/** The rule's declaration block, e.g. `display:none`. */
	body: string;
	/** Character offset of the rule's `{` — source order is the cascade tie-breaker. */
	offset: number;
}

/**
 * Parse the emitted utilities layer into ordered rules with their media guard.
 * The layer is the only place these display utilities can live, and the scanner
 * only needs enough structure to recover `selector → media guard → offset`.
 */
function emittedUtilityRules(css: string): EmittedRule[] {
	const layerStart = css.indexOf('@layer utilities{');
	assert.ok(layerStart >= 0, 'the emitted CSS must contain an @layer utilities block');
	const rules: EmittedRule[] = [];
	const stack: Array<{ style: boolean; media: string | null }> = [];
	let buffer = '';
	let current: EmittedRule | null = null;
	let index = layerStart + '@layer utilities{'.length;
	while (index < css.length) {
		const char = css[index];
		if (char === '{') {
			const head = buffer.trim();
			buffer = '';
			if (head.startsWith('@')) {
				// At-rule frame (media, supports, keyframes, layer, property …).
				const enclosing = stack.length > 0 ? stack[stack.length - 1].media : null;
				const media = head.startsWith('@media')
					? `${enclosing ? `${enclosing} and ` : ''}${head.slice('@media'.length).trim()}`
					: enclosing;
				stack.push({ style: false, media });
				current = null;
			} else {
				current = {
					selector: head,
					media: stack.length > 0 ? stack[stack.length - 1].media : null,
					body: '',
					offset: index,
				};
				rules.push(current);
				stack.push({ style: true, media: current.media });
			}
			index += 1;
			continue;
		}
		if (char === '}') {
			const frame = stack.pop();
			// Minified output drops the final `;`, so flush the declaration block.
			if (frame?.style && current) current.body += buffer;
			current = null;
			buffer = '';
			index += 1;
			continue;
		}
		if (char === ';') {
			if (current) current.body += buffer;
			buffer = '';
			index += 1;
			continue;
		}
		buffer += char;
		index += 1;
	}
	return rules;
}

/** `wide:hidden` → `.wide\:hidden` (Tailwind's CSS selector escaping). */
function escapedSelector(candidate: string): string {
	return `.${candidate.replace(/[:.[\]%/]/g, (char) => `\\${char}`)}`;
}

/** The single emitted rule for a candidate class, or null. */
function emittedRuleFor(rules: EmittedRule[], candidate: string): EmittedRule | null {
	const selector = escapedSelector(candidate);
	return rules.find((rule) => rule.selector === selector) ?? null;
}

/** Resolve a media-feature length to px (in a media query `rem`/`em` use the initial 16px root). */
function lengthPx(raw: string): number | null {
	const match = raw.trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
	if (!match) return null;
	const value = Number(match[1]);
	return (match[2] ?? 'px') === 'px' ? value : value * 16;
}

/** The min-width (px) of a `(min-width:…)` guard, or null when the rule is unconditional. */
function minWidthPx(media: string | null): number | null {
	if (!media) return 0;
	const match = media.match(/min-width\s*:\s*([\d.]+(?:px|rem|em)?)/);
	if (!match) return null;
	return lengthPx(match[1]);
}

/**
 * The effective `display` for one candidate at a viewport width, evaluated the
 * way the cascade actually decides it: a rule applies when its media guard
 * matches, the selectors are single-class (equal specificity), so the LAST
 * applying declaration in source order wins. Returns null when no display
 * declaration applies.
 */
function effectiveDisplay(rules: EmittedRule[], candidate: string, widthPx: number): string | null {
	const selector = escapedSelector(candidate);
	let winner: string | null = null;
	for (const rule of rules) {
		if (rule.selector !== selector) continue;
		const min = minWidthPx(rule.media);
		if (min === null || widthPx < min) continue;
		const declared = rule.body.match(/display\s*:\s*([^;]+)/);
		if (declared) winner = declared[1].trim();
	}
	return winner;
}

const builtCssCache = new Map<string, string>();

/**
 * Compile the real theme with the real candidate classes and return the
 * optimized (production-shape) CSS. The candidate list is derived from the
 * RENDERED class attributes, so the proof tracks the component output rather
 * than a hand-maintained copy of it.
 */
async function builtUtilitiesCss(candidates: string[]): Promise<string> {
	const key = [...candidates].sort().join(' ');
	const cached = builtCssCache.get(key);
	if (cached) return cached;
	const themeCss = readFileSync(resolve(clientRoot, 'src/index.css'), 'utf8');
	const compiled = await compile(themeCss, { base: clientRoot, onDependency: () => {} });
	const css = optimize(compiled.build(candidates), { minify: true }).code;
	builtCssCache.set(key, css);
	return css;
}

/** The class tokens of the elements whose cascade decides the one-row header. */
function headerCascadeCandidates(markup: string): string[] {
	const switcher = markup.match(/class="(hidden min-w-0 flex-1 lg:flex[^"]*)"/)?.[1];
	assert.ok(switcher, 'the inline schedule switcher class list must render');
	const sources = [
		classOf(tagFor(markup, 'timetable-simple-header-row')),
		classOf(tagFor(markup, 'timetable-simple-status-region')),
		switcher,
		classOf(tagFor(markup, 'timetable-simple-schedule-sheet-trigger')),
	];
	return sources.flatMap((list) => list.split(/\s+/).filter(Boolean));
}

/**
 * The effective rendered height, read from the element's own `h-*` utility
 * (Tailwind spacing = n × 4 px). `cn`/twMerge has already resolved the
 * `size` variant against the explicit class, so exactly one `h-N` survives.
 * `min-h-*` never matches: the class list is split on whitespace first.
 */
function heightPx(tag: string): number {
	const heights = classOf(tag).split(/\s+/).filter((token) => /^h-\d+(\.\d+)?$/.test(token));
	assert.equal(heights.length, 1, `expected exactly one effective h-* class, got "${classOf(tag)}"`);
	return Number(heights[0].slice(2)) * 4;
}

/** The committed counting rule (`timetable-ux-rehaul-c01`): a filled action is a `<button>` carrying `bg-primary`. */
function solidButtons(markup: string): string[] {
	return (markup.match(/<button[^>]*>/g) ?? []).filter((tag) => /\bbg-primary\b/.test(tag));
}

/**
 * The lifecycle primary slot for the rendered state: the button primary, the
 * publish-slot owner, or — for a published read-only run — the published status
 * surface, which is the lifecycle primary the header substitutes there.
 */
function lifecyclePrimaryTag(markup: string): string | null {
	for (const id of [
		'timetable-simple-primary-action',
		'timetable-simple-publish-action',
		'timetable-simple-published-state',
	]) {
		const tag = markup.match(new RegExp(`<[^>]*data-testid="${id}"[^>]*>`))?.[0];
		if (tag) return tag;
	}
	return null;
}

const CLEAN_UNPUBLISHED = {
	draft: draftWithSummary({ runId: 42, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
	blockingHardCount: 0,
};

const HARD_BLOCKERS = {
	draft: draftWithSummary({ runId: 42, hardViolationCount: 1, softViolationCount: 0, unassignedCount: 0, isPublished: false }),
	hardCount: 1,
	blockingHardCount: 1,
	summary: { assignedCount: 5, classesProcessed: 5, hardViolationCount: 1, unassignedCount: 0 },
};

/** Run #317 / revision 43 shape: a published, read-only run with no follow-ups. */
const PUBLISHED_RUN = {
	draft: draftWithSummary({ runId: 317, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0, isPublished: true }),
	blockingHardCount: 0,
	summary: { assignedCount: 133, classesProcessed: 133, hardViolationCount: 0, unassignedCount: 0 },
};

const PUBLISHED_WITH_FOLLOW_UPS = {
	...PUBLISHED_RUN,
	draft: draftWithSummary({ runId: 317, hardViolationCount: 0, softViolationCount: 0, unassignedCount: 2, isPublished: true }),
	summary: { assignedCount: 131, classesProcessed: 133, hardViolationCount: 0, unassignedCount: 2 },
};

/* ── D1 — one row band, one status region, one action cluster ─────────────── */

test('D1 the header renders exactly one row band holding the one status region and the one action cluster', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);

	// Exactly one status region and exactly one header row band.
	assert.equal(
		(markup.match(/data-testid="timetable-simple-status-region"/g) ?? []).length,
		1,
		'exactly one status region may render',
	);
	assert.equal(
		(markup.match(/data-testid="timetable-simple-header-row"/g) ?? []).length,
		1,
		'exactly one header row band may render',
	);
	// Exactly one action cluster: one More disclosure and never two primaries.
	assert.equal((markup.match(/data-testid="timetable-simple-more-trigger"/g) ?? []).length, 1, 'one action cluster');
	assert.ok(
		(markup.match(/data-testid="timetable-simple-primary-action"/g) ?? []).length <= 1,
		'never two lifecycle primaries',
	);
	// The status chip renders inside the one status region.
	assert.match(markup, /data-testid="timetable-simple-readiness-chip"/);

	// Source structure: the row band is the single band that opens before the
	// status region, which opens before the first action-row control.
	const rowAt = markup.indexOf('data-testid="timetable-simple-header-row"');
	const regionAt = markup.indexOf('data-testid="timetable-simple-status-region"');
	const actionAt = markup.indexOf('data-testid="timetable-simple-term-switcher"');
	assert.ok(rowAt >= 0, 'the row band renders');
	assert.ok(rowAt < regionAt, 'the one row band opens before the status region');
	assert.ok(regionAt < actionAt, 'the status region and the action controls share the one row band');
});

test('D1 at ≥1366px the header uses bounded wrapping rows instead of a horizontal strip', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);

	const rowClasses = classOf(tagFor(markup, 'timetable-simple-header-row'));
	assert.match(rowClasses, /flex-col/);
	assert.doesNotMatch(rowClasses, /wide:flex-row|wide:flex-nowrap|overflow-x-auto/);
	assert.match(markup, /class="flex min-w-0 flex-wrap items-center gap-1\.5"/,
		'the status line wraps rather than clipping');
	assert.match(markup, /class="flex min-w-0 flex-wrap items-center gap-1\.5 px-3"/,
		'controls wrap cleanly at desktop widths');
	assert.doesNotMatch(markup, /justify-start gap-1\.5 overflow-x-auto/);
});

test('C1 the rendered header has no horizontal strip overflow at desktop widths', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	assert.doesNotMatch(markup, /wide:flex-row|wide:flex-nowrap|overflow-x-auto/);
	assert.match(markup, /class="flex min-w-0 flex-wrap items-center gap-1\.5 px-3"/);
});

test('D1 the mobile schedule entity sheet remains available', () => {
	const markup = renderHeader(CLEAN_UNPUBLISHED);

	// The inline switcher is for desktop; the sheet remains for touch-sized layouts.
	const switcher = markup.match(/class="(hidden min-w-0 flex-1 lg:flex[^"]*)"/)?.[1];
	assert.ok(switcher, 'the inline switcher must render');
	assert.match(switcher, /lg:flex/, 'the inline switcher shows from lg');
	const trigger = classOf(tagFor(markup, 'timetable-simple-schedule-sheet-trigger'));
	assert.match(trigger, /lg:hidden/, 'the sheet trigger is compact below lg');

	// The sheet's content is the unchanged shared chooser, so the full
	// Section/Teacher/Room chooser stays exactly one click away.
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /<SimpleScheduleControls/);
});

/* ── D2 — the published run is dominated by its published lifecycle surface ─ */

test('D2 (failing-first) a published run is dominated by the published lifecycle surface, never by Generate', () => {
	const markup = renderHeader(PUBLISHED_RUN);
	const generate = tagFor(markup, 'timetable-simple-generate-action');
	const published = tagFor(markup, 'timetable-simple-published-state');

	// Generate stays present: two committed contracts require it in the render.
	assert.match(markup, /<span>Generate<\/span>/, 'Generate remains present in the header render');

	// The published state is the lifecycle primary for a read-only run: an
	// honest status surface, never an action button.
	assert.doesNotMatch(published, /^<button\b/, 'the published lifecycle surface is not an action button');
	assert.match(published, /role="status"/);
	assert.match(published, /Published/);
	assert.match(published, /view only/);
	assert.equal(solidButtons(markup).length, 0, 'a published run has no filled action');

	// The failing-first assertion: the published lifecycle surface must strictly
	// out-size the Generate control. On the base commit both render at h-11
	// (44px), so Generate is the largest control and this fails.
	const publishedPx = heightPx(published);
	const generatePx = heightPx(generate);
	assert.ok(
		publishedPx > generatePx,
		`the published lifecycle surface (${publishedPx}px) must out-size the demoted Generate (${generatePx}px)`,
	);
});

/* ── D3 — Generate is never the largest control ──────────────────────────── */

test('D3 the lifecycle primary strictly out-sizes Generate in every renderable state', () => {
	const states: Array<[string, Record<string, unknown>]> = [
		['no run yet', { draft: null, isPreGenerationWorkspace: false }],
		['hard blockers', HARD_BLOCKERS],
		['publish-ready clean run', CLEAN_UNPUBLISHED],
		['published run', PUBLISHED_RUN],
		['published run with follow-ups', PUBLISHED_WITH_FOLLOW_UPS],
	];
	for (const [name, overrides] of states) {
		const markup = renderHeader(overrides);
		const generate = tagFor(markup, 'timetable-simple-generate-action');
		const primary = lifecyclePrimaryTag(markup);
		assert.ok(primary, `${name}: a lifecycle primary must render`);
		const primaryPx = heightPx(primary);
		const generatePx = heightPx(generate);
		assert.ok(
			primaryPx > generatePx,
			`${name}: the lifecycle primary (${primaryPx}px) must out-size Generate (${generatePx}px)`,
		);
	}
});

test('D1/D3 exactly one filled primary per state, and Generate is never it', () => {
	const states: Array<[string, Record<string, unknown>, number]> = [
		['no run yet', { draft: null, isPreGenerationWorkspace: false }, 1],
		['hard blockers', HARD_BLOCKERS, 1],
		['publish-ready clean run', CLEAN_UNPUBLISHED, 1],
		['published run', PUBLISHED_RUN, 0],
	];
	for (const [name, overrides, expected] of states) {
		const markup = renderHeader(overrides);
		const solid = solidButtons(markup);
		assert.equal(solid.length, expected, `${name}: filled action count`);
		for (const tag of solid) {
			assert.doesNotMatch(
				tag,
				/data-testid="timetable-simple-generate-action"/,
				`${name}: Generate is never the filled primary`,
			);
		}
	}
});

/* ── Boundaries that must survive the collapse ───────────────────────────── */

test('the collapse preserves the strict publication predicate, the one status region, and the Generate/Publish presence contracts', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /isRunPublishedStrict/, 'the strict publication predicate is unchanged');
	// Generate, Publish and the term-bound export trigger stay present.
	assert.match(header, /<SimpleGenerateAction/);
	assert.match(header, /<SimplePublishedState|<SimplePublishAction/);
	const markup = renderHeader(CLEAN_UNPUBLISHED);
	assert.match(markup, /data-testid="timetable-simple-generate-action"/);
	assert.match(markup, /data-testid="timetable-simple-publish-action"/);
	assert.match(markup, /data-testid="timetable-simple-export-trigger"/);
});
