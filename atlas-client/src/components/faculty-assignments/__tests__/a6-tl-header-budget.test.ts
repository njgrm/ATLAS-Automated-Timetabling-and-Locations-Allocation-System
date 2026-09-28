/**
 * A6 c4 — Teaching Load to the AGENTS.md §8 Header budget, and the Guided-mode
 * removal that `a2c4c135` claimed but never did.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM `a3-c10-tl-header-density.test.ts`. That
 * file is the committed HEIGHT model and it is unchanged by this slice: T1–T9 all
 * still pass and its constants did not move. What this file adds is the three
 * things a height model cannot see:
 *
 *   G1  the workspace renders the grid on its first paint, and there is no
 *       second rendering of it anywhere in the page;
 *   G2  the header says ONE status, in ONE status line, with nothing cut off —
 *       which are claims about CONTENT and about class strings, not about pixels;
 *   G2  nothing the compaction moved became unreachable — a claim about the whole
 *       reachable surface, not about one band.
 *
 * EVERY ROW HERE IS WRITTEN SO THAT ITS DEFECT MAKES IT RED, AND EVERY MUTANT ROW
 * HAS BEEN BROKEN AND RESTORED BY HAND (see the return's mutant list). A row that
 * cannot go red is not evidence.
 *
 * THE INSTRUMENTS, AND THEIR LIMITS, STATED UP FRONT (AGENTS.md §11/§16: record
 * how a number was taken, and never report a measurement you did not make).
 *
 *   - Structure and content are read from `renderToStaticMarkup` output parsed by
 *     JSDOM, i.e. from SHIPPED MARKUP, not from source strings. Radix does not
 *     mount closed `TooltipContent`, so everything asserted here is something a
 *     scheduler can see without hovering.
 *   - `WIDTH` is a DECLARED ESTIMATE, not a measurement. JSDOM performs no layout
 *     and this worktree runs no browser, so glyph advances cannot be measured
 *     here. `TEXT_XS_ADVANCE_PX` is a deliberately CONSERVATIVE declared advance
 *     for 12px semibold sans (0.55em), so every width below is an OVER-estimate
 *     and a reword fails early rather than late. It guards the common case;
 *     `A6c4-G2-2` is the row that carries the operator's actual rule.
 *   - Source-level claims are read through `code()`, which strips comments, so a
 *     comment that merely NAMES a defect cannot make a row pass.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';

import { WorkspaceToolbar, TEACHING_LOAD_HEADER_MODEL } from '@/components/faculty-assignments/WorkspaceToolbar';
import { TeachingLoadRepairQueue, type TeachingLoadRepairQueueItem } from '@/components/faculty-assignments/TeachingLoadRepairQueue';
import { TeachingLoadFilterBar } from '@/components/faculty-assignments/TeachingLoadFilterBar';
import { TeachingLoadSummarySurface } from '@/components/faculty-assignments/TeachingLoadSummarySurface';
import { TeachingLoadTruthPanel } from '@/components/faculty-assignments/TeachingLoadTruthPanel';
import { TooltipProvider } from '@/ui/tooltip';
import { COVERAGE_MODE_CONFIG } from '@/lib/teaching-load-helpers';
import type { CoverageMode } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../../..');
const THIS_FILE = 'src/components/faculty-assignments/__tests__/a6-tl-header-budget.test.ts';
const source = (path: string): string => readFileSync(resolve(CLIENT_ROOT, path), 'utf8');

const PAGE_FILE = 'src/pages/TeachingLoad.tsx';
const TOOLBAR_FILE = 'src/components/faculty-assignments/WorkspaceToolbar.tsx';
const QUEUE_FILE = 'src/components/faculty-assignments/TeachingLoadRepairQueue.tsx';
const FILTER_FILE = 'src/components/faculty-assignments/TeachingLoadFilterBar.tsx';
const PLACEHOLDER_FILE = 'src/components/faculty-assignments/TeachingLoadGuidedModePlaceholder.tsx';

/** Strip comments, so a comment that NAMES a defect cannot satisfy a code claim. */
const stripComments = (text: string): string =>
	text
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/^[ \t]*\/\/.*$/gm, ' ');

function code(path: string): string {
	return stripComments(source(path));
}

// =============================================================================
// Fixtures. Every string below is a string the product itself writes.
// =============================================================================

const toolbarProps = {
	realAssignedPairs: 22,
	syntheticPlaceholderPairs: 1,
	unassignedPairs: 2,
	totalPairs: 24,
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
	workspaceStateLabel: 'Ready',
	workspaceStateDescription: 'Live roster verified.',
	workspaceStateNextAction: 'Assign the remaining classes.',
	activeDraftCount: 0,
	saving: false,
	onSave: () => {},
	onRetrySource: () => {},
};

/**
 * The REAL next step in its REAL blocked state: a read-only workspace whose
 * source is degraded. This is the state that used to render TWO amber surfaces
 * on row 2. The strings are the hook's and the toolbar's own per-state output
 * (`useTeachingLoadRepairQueue.ts`, `WorkspaceToolbar.tsx`), quoted rather than
 * reworded, because AGENTS.md §11 requires a control's fixture to come from the
 * surface the row is about.
 */
const BLOCKED_ITEM: TeachingLoadRepairQueueItem = {
	id: 'review-ready',
	kind: 'review-ready',
	title: 'Teaching Load not verified',
	description: 'ATLAS cannot confirm this because EnrollPro is not reachable, so it cannot say whether any class, over-cap teacher, or temporary substitute still needs review.',
	status: 'Unverified — EnrollPro is not reachable, so this figure is withheld.',
	actionLabel: 'Review staff workload',
	disabledReason: 'Read-only: verify the source first',
};

const WORKING_ITEM: TeachingLoadRepairQueueItem = {
	id: 'missing-load',
	kind: 'missing-load',
	title: 'Assign teachers to open classes',
	description: 'Some subject-section pairs still need a teacher. Review subject coverage to see exactly which sections are uncovered.',
	status: '2 section-subject pairs need a teacher.',
	actionLabel: 'Review subject coverage',
	countLabel: '2 open',
};

const DRAFT_ITEM: TeachingLoadRepairQueueItem = {
	id: 'save-draft',
	kind: 'save-draft',
	title: 'Save draft changes',
	description: 'You have unsaved Teaching Load changes. Save or discard them before moving to generation.',
	status: '3 draft teachers waiting to save.',
	actionLabel: 'Save 3',
	countLabel: '3 draft',
};

function queueElement(item: TeachingLoadRepairQueueItem) {
	return createElement(TeachingLoadRepairQueue, {
		items: [item],
		activeItemId: item.id,
		isReadOnly: Boolean(item.disabledReason),
		saving: false,
		onPrimaryAction: () => {},
	});
}

const renderQueue = (item: TeachingLoadRepairQueueItem): Document => {
	const html = renderToStaticMarkup(createElement(TooltipProvider, null, queueElement(item)));
	return new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
};

/** The whole strip, with the page's real next step in the state-line slot. */
const renderStrip = (
	toolbarOverrides: Record<string, unknown> = {},
	queueItem: TeachingLoadRepairQueueItem = WORKING_ITEM,
): Document => {
	const slot = renderToStaticMarkup(createElement(TooltipProvider, null, queueElement(queueItem)));
	const html = renderToStaticMarkup(createElement(WorkspaceToolbar, {
		...toolbarProps,
		...toolbarOverrides,
		stateLineSlot: createElement('div', { dangerouslySetInnerHTML: { __html: slot } }),
		// The page's own composition: the `Load summary` control is a SLOT on the
		// header, so the header host must receive it or the row would be measuring
		// a header that is missing a control the page really renders.
		loadSummaryAction: createElement(TeachingLoadSummarySurface, null),
		historyAction: createElement('a', { href: '/teaching-load/history', 'data-testid': 'teaching-load-history-link' }, 'Archived load'),
	} as never));
	return new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
};

const row2Of = (doc: Document) => doc.querySelector('[data-testid="teaching-load-readiness-strip"]')!;
const stripOf = (doc: Document) => doc.querySelector('[data-testid="teaching-load-command-header"]')!;
const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

// =============================================================================
// G1 — GUIDED MODE IS GONE
// =============================================================================

test('A6c4-G1-1 FAILING-FIRST: there is no second rendering of the Teaching Load workspace', () => {
	// This row FAILS on `ce1257c8`: the placeholder file exists there, the page
	// imports it, and the page gates the grid behind `advancedGridVisible`.
	//
	// WHY THIS IS A FIRST-PAINT CLAIM AND NOT JUST SOURCE TEXT. The removed branch
	// was the only thing that could stand between a scheduler and the roster, and
	// it was reachable from a real state: an active year with classes and no
	// assignments called `setAdvancedGridVisible(false)`, so the placeholder
	// rendered INSTEAD of the grid. Three facts together close that, and each one
	// can fail on its own:
	//   (1) the page's workspace region contains the two real view-mode branches
	//       and nothing that can be rendered instead of them;
	//   (2) it contains exactly ONE condition, so no state reaches "neither";
	//   (3) no file in `src/` renders the deleted placeholder any more.
	// The surviving branch is proved to render by `a6-teaching-load-surface`
	// A6-16.1-1, which mounts the real `TeacherGridMode` and reads a `Review load`
	// button off a real row. This file does not re-mount the page and does not
	// claim to.
	assert.equal(
		existsSync(resolve(CLIENT_ROOT, PLACEHOLDER_FILE)),
		false,
		`${PLACEHOLDER_FILE} must be deleted, not merely unrendered (it exists on ce1257c8)`,
	);

	const pageCode = code(PAGE_FILE);
	assert.doesNotMatch(pageCode, /TeachingLoadGuidedModePlaceholder/, 'the page must not import the placeholder');
	assert.doesNotMatch(pageCode, /\badvancedGridVisible\b/, 'the page must hold no `advancedGridVisible` state, gate or prop');
	assert.doesNotMatch(pageCode, /setAdvancedGridVisible/, 'nothing may re-open the grid from outside');

	// The region is bounded on BOTH sides by its own nodes, so the claim is about
	// the roster's subtree and not about the whole file.
	const from = pageCode.indexOf('data-testid="teaching-load-workspace"');
	const to = pageCode.indexOf('<TeachingLoadInspectorTriggers');
	assert.ok(from > 0 && to > from, 'the workspace region must be locatable between two of its own nodes');
	const region = pageCode.slice(from, to);
	assert.doesNotMatch(region, /TeachingLoadGuidedModePlaceholder/, 'no rendering may exist inside the workspace region');
	assert.match(region, /ui\.viewMode === 'teacher' \?/, 'the teacher grid branch is the one condition');
	assert.match(region, /<TeacherGridMode/, 'the teacher grid renders');
	assert.match(region, /<SectionGridMode/, 'the section grid renders');
	assert.equal(
		(region.match(/\?\s*\(/g) ?? []).length,
		1,
		'the workspace must have exactly ONE condition, so no state renders neither grid',
	);

	// (3) One directory walk, so a re-introduction ANYWHERE fails, not only in the
	// Teaching Load folder. Comments are stripped first, because this slice
	// deliberately NAMES the deleted component in prose at the site that removed
	// it — a control must not be falsified by the record of its own change. The
	// predicate is "RENDERS it", i.e. a JSX tag or an import, not a bare mention:
	// `tl-operator-workspace-c05` legitimately carries the component's PATH as a
	// string so it can assert the file is gone, and that is a control, not a
	// render. The one identity exclusion is this file, whose PLACEHOLDER_FILE
	// constant is a string literal rather than a comment.
	const RENDERS = [
		/<TeachingLoadGuidedModePlaceholder[\s/>]/,
		/import[^;]*\bTeachingLoadGuidedModePlaceholder\b[^;]*from/,
	];
	const offenders: string[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			if (entry === 'node_modules' || entry === 'dist') continue;
			const full = resolve(dir, entry);
			const stat = statSync(full);
			if (stat.isDirectory()) walk(full);
			else if (/\.(ts|tsx)$/.test(entry)) {
				const text = stripComments(readFileSync(full, 'utf8'));
				if (RENDERS.some((pattern) => pattern.test(text))) {
					// Normalised to forward slashes so the identity exclusion compares like with like on Windows.
					offenders.push(full.replace(`${CLIENT_ROOT}\\`, '').replace(/\\/g, '/'));
				}
			}
		}
	};
	walk(resolve(CLIENT_ROOT, 'src'));
	assert.deepEqual(offenders.filter((f) => f !== THIS_FILE), [], 'no source file may still render the deleted placeholder');
});

test('A6c4-G1-2 the next step keeps every claim it made before the gate went', () => {
	// Removing a prop is exactly the kind of change that quietly removes a
	// requirement with it, so each claim is re-asserted on the real component.
	for (const item of [WORKING_ITEM, BLOCKED_ITEM, DRAFT_ITEM]) {
		const doc = renderQueue(item);
		const chip = doc.querySelector('[data-testid="teaching-load-current-repair"]');
		assert.ok(chip, 'the next step must still render');
		assert.match(chip!.textContent ?? '', new RegExp(item.title), `${item.kind}: the task must survive`);
		assert.match(chip!.textContent ?? '', new RegExp(item.status), `${item.kind}: the live status must survive`);
		assert.ok(
			doc.querySelector('[data-testid="teaching-load-repair-status"]'),
			`${item.kind}: the live status must stay addressable by its test id`,
		);
		if (item.countLabel) {
			assert.match(chip!.textContent ?? '', new RegExp(item.countLabel), `${item.kind}: the COUNT must survive`);
		}
		const action = doc.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement;
		assert.ok(action, `${item.kind}: the ONE primary action must survive`);
		assert.match(action.textContent ?? '', new RegExp(item.actionLabel), `${item.kind}: its label must survive`);
	}
	// The safety reason is the one claim a hover must never own.
	const reason = renderQueue(BLOCKED_ITEM)
		.querySelector('[data-testid="teaching-load-repair-disabled-reason"]');
	assert.ok(reason, 'the disabled reason must still render');
	assert.match(textOf(reason), /Read-only: verify the source first/, 'and it must be visible text');
	assert.ok(
		reason!.closest('[data-testid="teaching-load-current-repair"]'),
		'it must be reachable from the chip that owns the action it disables',
	);
	// The description is the one thing that legitimately lives behind a hover,
	// and it is still there.
	assert.match(code(QUEUE_FILE), /\{currentItem\.description\}/, 'the tooltip still carries the description');
});

// =============================================================================
// G2 — ONE STATUS LINE
// =============================================================================

test('A6c4-G2-1 MUTANT ROW: the degraded workspace shows exactly ONE amber surface', () => {
	// Lane C, train 3, T5, verbatim: "two amber lines when EnrollPro is
	// unreachable (saved-data status + Next step); merge into one."
	//
	// The defect was two FILLED warning surfaces on row 2: the header's degraded
	// notice, and the next step's own `disabledReason` pill in the same
	// `bg-warning-muted` treatment. The row counts filled warning surfaces, so
	// re-adding that pill — the one-line mutation — puts the count at 2 and fails.
	const doc = renderStrip(
		{ dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'EnrollPro could not be reached.' },
		BLOCKED_ITEM,
	);
	const row2 = row2Of(doc);
	assert.ok(row2, 'row 2 must render');

	const filled = Array.from(row2.querySelectorAll('*')).filter((el) =>
		/\bbg-warning-muted\b/.test(el.getAttribute('class') ?? ''),
	);
	assert.equal(
		filled.length,
		1,
		`row 2 must carry exactly ONE filled amber surface, found ${filled.length} ` +
			`(${filled.map((el) => el.getAttribute('data-testid') ?? el.tagName).join(', ')})`,
	);
	assert.equal(
		filled[0]!.getAttribute('data-testid'),
		'teaching-load-degraded-notice',
		'and that ONE amber surface is the header status line, not the next step',
	);
	assert.match(textOf(filled[0]!), /EnrollPro not reachable/, 'the single amber line must still name the cause');

	// The reason is still on row 2 — visible, and not a second pill and not a hover.
	const reason = row2.querySelector('[data-testid="teaching-load-repair-disabled-reason"]');
	assert.ok(reason, 'the safety reason must still be on row 2');
	assert.doesNotMatch(
		reason!.getAttribute('class') ?? '',
		/\bbg-warning-muted\b|\bborder\b/,
		'the reason is text on the next step, not a second bordered amber pill',
	);
	// Exactly one status SENTENCE, and the degraded notice REPLACES it rather
	// than accompanying it.
	assert.equal(
		row2.querySelectorAll('[data-testid="teaching-load-status-sentence"]').length,
		0,
		'the degraded row must not print the live status sentence beside the amber line',
	);
	// The next step is still a next step WITH ITS ACTION, not a status sentence.
	const action = row2.querySelector('[data-testid="teaching-load-repair-review"]') as HTMLButtonElement;
	assert.ok(action, 'the next step keeps its action while degraded');
	assert.equal(row2.querySelectorAll('button').length, 1, 'row 2 keeps exactly ONE action');
});

test('A6c4-G2-2 MUTANT ROW: no header string is truncated', () => {
	// AGENTS.md §8, verbatim: "No sentence is cut off with an ellipsis". The
	// mechanical form of that rule on this surface is `truncate` / `line-clamp-*`
	// on a node that renders header text. The one-line mutation — putting
	// `truncate` back on the status sentence — makes the first loop fail.
	const doc = renderStrip();
	const row2 = row2Of(doc);
	const strip = stripOf(doc);

	for (const [scope, name] of [[row2, 'row 2'], [strip, 'the header strip']] as const) {
		for (const el of Array.from(scope.querySelectorAll('*'))) {
			const cls = el.getAttribute('class') ?? '';
			const where = `${el.tagName}[${el.getAttribute('data-testid') ?? 'no id'}]`;
			assert.doesNotMatch(
				cls,
				/(^|\s)truncate(\s|$)/,
				`${name}: ${where} must not truncate — a scheduler cannot tell a clipped claim from a complete one`,
			);
			assert.doesNotMatch(cls, /line-clamp-/, `${name}: ${where} must not clamp; a clamp is an ellipsis by another name`);
		}
	}
	// The defect this replaced was five `truncate` class strings, and the model
	// declares that count, so the count is pinned too.
	assert.equal(
		TEACHING_LOAD_HEADER_MODEL.ROW_2_SUPERSEDED_TRUNCATE_COUNT,
		5,
		'the superseded truncate count is 5: two on the header, three on the next step',
	);
	assert.equal(
		(code(TOOLBAR_FILE).match(/(^|\s)truncate(\s|$)/g) ?? []).length
			+ (code(QUEUE_FILE).match(/(^|\s)truncate(\s|$)/g) ?? []).length,
		0,
		'no header source file may reintroduce a `truncate` class string',
	);
	// The row WRAPS instead. `flex-nowrap` is what made the band a squeeze, and a
	// wrapped line inside row 2 is still one band, not a third row.
	assert.match(row2.getAttribute('class') ?? '', /\bflex-wrap\b/, 'row 2 must wrap rather than nowrap its content');
	assert.doesNotMatch(
		row2.getAttribute('class') ?? '',
		/\bflex-nowrap\b|overflow-x-(auto|scroll)/,
		'and it must neither nowrap nor scroll sideways',
	);
});

test('A6c4-G2-3 MUTANT ROW: no header string ends in an ellipsis', () => {
	// A literal `…` in a composed string is the copy form of the same defect, and
	// the header had one: the `refreshing` status sentence read `Checking EnrollPro
	// for the latest roster…`, which told a scheduler the sentence was clipped
	// when it was not. Re-adding the character fails below.
	for (const dataSource of ['live', 'refreshing', 'cached', 'none'] as const) {
		const text = textOf(row2Of(renderStrip({ dataSource, isWorkspaceWritable: dataSource === 'live' })));
		assert.doesNotMatch(text, /\u2026/, `the ${dataSource} header string must not end in an ellipsis: ${JSON.stringify(text)}`);
		assert.doesNotMatch(text, /\.{3,}/, `the ${dataSource} header string must not end in "..."`);
	}
	// The sentence is still complete and still says what it was saying.
	assert.match(
		textOf(row2Of(renderStrip({ dataSource: 'refreshing' }))),
		/Checking EnrollPro for the latest roster/,
		'the checking sentence keeps its words; only the ellipsis went',
	);
});

// =============================================================================
// G2 — NOTHING HIDDEN, ONE LOOK
// =============================================================================

test('A6c4-G2-4 nothing became unreachable: every preserved control still resolves', () => {
	// A control that cannot be reached is a regression, not a simplification, so
	// each id is resolved rather than assumed.
	const truthModel = {
		requiredPairs: { state: 'known', value: 42 },
		assignedPairs: { state: 'known', value: { real: 38, placeholder: 1, total: 39 } },
		unresolvedPairs: { state: 'known', value: 3 },
		actualTeachingMinutes: { state: 'known', value: 3600 },
		policyCapacity: { state: 'known', value: { teachingStandardMinutes: 1200, hardCapMinutes: 1600 } },
		overload: { state: 'known', value: { overStandardCount: 2, overHardCapCount: 1, excessMinutes: 300 } },
		remainingCapacityMinutes: { state: 'known', value: 600 },
		zeroLoadFaculty: { state: 'known', value: { count: 1, names: ['Dela Cruz'] } },
		adviserStatus: { state: 'known', value: { count: 1, names: ['Santos'] } },
		advisoryCreditMinutes: { state: 'known', value: 300 },
		excludedHgRows: { state: 'known', value: { count: 1, explanation: 'Homeroom Guidance is guidance, not a teaching load.' } },
	} as unknown as Parameters<typeof TeachingLoadTruthPanel>[0]['model'];

	// (a) Every truth-panel figure is still reachable from `Load summary`. The
	// panel is rendered here directly because Radix does not mount a closed
	// Dialog's content; the OPEN path — that `Load summary` really does mount
	// this panel — is proved by `a6-teaching-load-surface` A6-38-1, which clicks
	// the control and reads the breakdown off the dialog. This row's claim is the
	// narrower one the packet asks for: the panel and its figures still render.
	const panelDoc = new JSDOM(
		`<!doctype html><body>${renderToStaticMarkup(createElement(TooltipProvider, null,
			createElement(TeachingLoadTruthPanel, {
				expanded: true,
				vertical: true,
				model: truthModel,
				loading: false,
				sourceRevision: 'rev-1',
				upstreamVerified: true,
				unresolvedReasons: [],
			} as never),
		))}</body>`,
	).window.document;
	for (const id of [
		'teaching-load-truth-panel',
		'teaching-load-truth-summary',
		'teaching-load-truth-capacity',
		'teaching-load-truth-summary-line',
		'teaching-load-truth-source-badge',
		'teaching-load-truth-details',
	]) {
		assert.ok(panelDoc.querySelector(`[data-testid="${id}"]`), `the truth panel must still resolve ${id}`);
	}

	// (b) The next step's four claims resolve on row 2, in the WORST state.
	const row2 = row2Of(renderStrip(
		{ dataSource: 'cached', isWorkspaceWritable: false, dataSourceNotice: 'x' },
		BLOCKED_ITEM,
	));
	for (const id of [
		'teaching-load-repair-queue',
		'teaching-load-current-repair',
		'teaching-load-repair-status',
		'teaching-load-repair-disabled-reason',
		'teaching-load-repair-review',
	]) {
		assert.ok(row2.querySelector(`[data-testid="${id}"]`), `row 2 must still resolve ${id}`);
	}

	// (c) `Archived load` is built by the page, which owns the one place that
	// states the reachability claim; the header owns its position.
	const page = source(PAGE_FILE);
	assert.match(page, /data-testid="teaching-load-history-link"/, 'the page must still build the archived-load link');
	assert.match(page, /to="\/teaching-load\/history"/, 'and it must still be a real link to /teaching-load/history');
	assert.match(page, /historyAction=\{/, 'the header must own its position');

	// (d) The `Load summary` control is still on the header and still opens it.
	assert.ok(
		stripOf(renderStrip()).querySelector('[data-testid="teaching-load-summary-open"]'),
		'`Load summary` must still resolve from the header',
	);
});

test('A6c4-G2-5 the header states each status question exactly once, and has no helper sentence under a button', () => {
	const strip = stripOf(renderStrip({ activeDraftCount: 3 }));

	// §8: "ONE status chip … never two chips that say the same thing". The
	// ADJUDICATION this slice makes, written as a control rather than as prose:
	// the two chips are two DIFFERENT claims, so neither goes, and each is stated
	// exactly once. (a) The source claim — "is this data current?" — appears once.
	assert.equal(
		strip.querySelectorAll('[data-source-state]').length,
		1,
		'the source-verification claim must be stated exactly once on the header',
	);
	// (b) The draft claim — "is my work saved?" — appears once, and it is a
	// DIFFERENT claim: in the steady state the two chips read "EnrollPro roster
	// verified" and "Saved", which is not one sentence twice.
	assert.equal(
		strip.querySelectorAll('[data-testid="teaching-load-draft-chip"]').length,
		1,
		'the draft claim must be stated exactly once',
	);
	const source = strip.querySelector('[data-source-state]')!;
	const draft = strip.querySelector('[data-testid="teaching-load-draft-chip"]')!;
	assert.notEqual(
		textOf(source),
		textOf(draft),
		'the two chips must not render the same words, or the header states one thing twice',
	);
	assert.equal(draft.getAttribute('data-draft-state'), 'unsaved', 'and each chip still carries its own state attribute');
	// (c) Neither claim is restated in row 2's steady state, so the source claim
	// is not printed twice on the header in one glance.
	const steadyRow2 = textOf(row2Of(renderStrip({ activeDraftCount: 3 })));
	assert.doesNotMatch(
		steadyRow2,
		/EnrollPro roster verified/,
		'the source chip is the one place that claim is made; row 2 must not repeat it',
	);
	assert.doesNotMatch(steadyRow2, /Draft — not saved/, 'nor the draft claim');

	// §8: "no helper sentence under a button (put it in a `Tooltip`)". Every
	// button in the header is a control and none owns a sentence. An icon-only
	// control is allowed to be icon-only, but it must then carry an accessible
	// name — that is the other half of the same rule.
	for (const button of Array.from(strip.querySelectorAll('button'))) {
		const label = (button.textContent ?? '').trim();
		const accessibleName = (button.getAttribute('aria-label') ?? '').trim();
		assert.ok(
			label.length > 0 || accessibleName.length > 0,
			'every header button must have a visible label or an accessible name',
		);
		assert.doesNotMatch(
			label,
			/\.\s|\.$/,
			`the header button "${label}" must not be a sentence: an explanation belongs in a Tooltip, not in the button's own text`,
		);
	}
	// The one explanation on this header is the suggestion action's, and it is a
	// Tooltip — asserted on the trigger, since Radix does not mount closed
	// tooltip content into the tree.
	assert.match(
		code(TOOLBAR_FILE),
		/<TooltipContent[^>]*>\s*\{primaryAction\.helper\}\s*<\/TooltipContent>/,
		"the suggestion action's explanation must live in a Tooltip, not under the button",
	);
});

test('A6c4-G2-6 MUTANT ROW: the Teaching Load filter row is one look per control', () => {
	// §8: "Every picker … is the same `@/ui` primitive and the same variant … with
	// the same trigger size, border and placeholder style. No page-local
	// `className` overrides that change a primitive's look."
	//
	// The three defects fixed here and the one-line mutation each row defeats: the
	// caps override (put `uppercase tracking-tight` back on a trigger), the size
	// mismatch (`w-44` on one trigger), and the placeholder mismatch (drop
	// `placeholder:text-muted-foreground` from the search input).
	const doc = new JSDOM(
		`<!doctype html><body>${renderToStaticMarkup(createElement(TeachingLoadFilterBar, {
			searchQuery: '',
			onSearchQueryChange: () => {},
			filterStatus: 'all',
			onFilterStatusChange: () => {},
			statusFacetCounts: {},
			loadFilter: 'all',
			onLoadFilterChange: () => {},
			loadFacetCounts: { 'below-standard': 0, 'at-standard': 0, excess: 0 },
			departmentFilter: 'all',
			onDepartmentFilterChange: () => {},
			departmentOptions: [],
			filterAnnouncement: '',
			onClearTeachingLoadFilters: () => {},
			sortOrder: 'load-desc',
			onSortOrderChange: () => {},
			showFilters: true,
			onToggleFilters: () => {},
			showOutsideDept: false,
			onToggleOutsideDept: () => {},
			showUnmappedSpecialization: false,
			onShowUnmappedSpecializationChange: () => {},
			policyReady: true,
		} as never))}</body>`,
	).window.document;
	const primary = doc.querySelector('[data-testid="teaching-load-primary-filters"]')!;
	assert.ok(primary, 'the filter row must render');

	// SUPERSEDED at integration (2026-09-29), NOT deleted (AGENTS.md §16). This row
	// originally asserted, per picker, that the trigger carried no
	// `uppercase`/`tracking-` override, declared the same `w-*` width as its three
	// siblings, and kept `border-border/60` + `h-9`. Those were page-local chrome
	// strings on a Radix `@/ui/select` trigger, and A5 C3 slice B (`e8bb101b`,
	// `src/ui/filter-picker.tsx`) replaced the mechanism: these four controls are
	// now the ONE shared `FilterPicker`, which has **no `className` prop at all**,
	// so this page cannot restate a trigger's chrome even if it wanted to. The
	// per-token assertions are therefore unreachable, not merely redundant, and
	// A5's committed picker guard (`src/ui/__tests__/a5-c3-picker-guard.test.ts`,
	// `.../a5-c3-picker-contract.test.tsx`) now polices the rule repo-wide.
	//
	// The row's INTENT is unchanged and is re-asserted in the primitive's terms.
	assert.doesNotMatch(
		code(FILTER_FILE),
		/<SelectTrigger\b/,
		'this row must build its filters through the shared `@/ui` FilterPicker, not a bespoke `@/ui/select` trigger',
	);
	for (const name of ['Status', 'Department', 'Load', 'Sort']) {
		assert.match(
			code(FILTER_FILE),
			new RegExp(`<FilterPicker\\s+[\\s\\S]{0,120}?name="${name}"`),
			`the "${name}" filter must be the shared FilterPicker`,
		);
	}
	// The pickers keep the accessible names the committed controls assert. Losing
	// one would be a regression, not a simplification.
	for (const ariaLabel of ['Filter by status', 'Filter by department', 'Filter by load', 'Sort teachers']) {
		assert.match(code(FILTER_FILE), new RegExp(`ariaLabel="${ariaLabel}"`), `the "${ariaLabel}" picker must keep its accessible name`);
	}

	const PICKERS = ['Filter by status', 'Filter by department', 'Filter by load', 'Sort teachers'];
	// `FilterPicker` composes the selected option into the accessible name
	// (`aria-label="Grade: All grades"`, `src/ui/filter-picker.tsx`), so a prefix
	// match is what finds these triggers now, not an exact match.
	for (const name of PICKERS) {
		const trigger = primary.querySelector(`[aria-label^="${name}"]`)!;
		assert.ok(trigger, `the "${name}" picker must render`);
		assert.doesNotMatch(
			trigger.getAttribute('class') ?? '',
			// `tracking-normal` is not an override: it is the shared primitive's own
			// `PICKER_TRIGGER_TYPE_CLASS` (`src/ui/picker-trigger.ts`), which exists
			// precisely so a look-changing `tracking-tight` cannot be added on top.
			// A5 C3 introduced it, so this row must read it as the fix, not the defect.
			/\buppercase\b|\btracking-(?!normal\b)/,
			`the "${name}" picker must not override the primitive's text style: the header strip already forbids letter-spaced ALL-CAPS, and one control family cannot have two looks`,
		);
	}

	// The search input shares the pickers' placeholder style. It is an
	// `@/ui/input`, which does not carry it, so without this the two controls sit
	// side by side showing differently coloured placeholders.
	const search = primary.querySelector('input[aria-label="Search teachers"]')!;
	assert.ok(search, 'the search input must render');
	assert.match(
		search.getAttribute('class') ?? '',
		/\bplaceholder:text-muted-foreground\b/,
		'the search input must use the same placeholder style the select primitive gives the pickers',
	);
	// EXCEPTION, recorded not forgotten: A5 C3 slice B deliberately KEPT
	// `uppercase tracking-tight` on the two inclusion SWITCH labels and says why
	// in `TeachingLoadFilterBar.tsx` — "a Switch label is a different control, and
	// restyling it would be a change the sweep was not asked to make". This row
	// originally forbade caps on every label in the row, which is no longer true
	// and no longer this slice's call. The claim is narrowed to what is actually
	// true and still discriminating: caps are allowed on the inclusion switch
	// labels and nowhere else, so a new caps override anywhere else still fails.
	const shoutingLabels = Array.from(primary.querySelectorAll('label')).filter((label) =>
		/\buppercase\b|\btracking-/.test(label.getAttribute('class') ?? ''),
	);
	assert.ok(shoutingLabels.length <= 2, `only the two documented inclusion-switch labels may shout in caps, found ${shoutingLabels.length}`);
	for (const label of shoutingLabels) {
		assert.doesNotMatch(
			label.textContent ?? '',
			/^(Status|Load|Department|Sort)\b/,
			"a filter's own label must not be shouted in caps; only the inclusion switches are the documented exception",
		);
	}
	// SCOPE GUARD: this row is scoped to Teaching Load and must not have widened
	// into the repo-wide picker sweep that A5 owns.
	assert.doesNotMatch(
		code(FILTER_FILE),
		/\bTracking-tight\b/,
		'this slice removes the caps override; it must not introduce another page-local tracking override',
	);
});

test('A6c4-G2-7 the row has a declared WRAP fallback, and the steady state does not need it', () => {
	// The honest counterpart to removing `truncate`. A row that wraps instead of
	// cutting is only honest if the wrap is a FALLBACK: the state a scheduler
	// actually meets must still fit on one line, and the cost of the fallback is a
	// declared number rather than a shrug.
	//
	// METHOD, RECORDED (see the file header): `TEXT_XS_ADVANCE_PX` is a declared
	// conservative advance for 12px semibold sans, so every width below is an
	// OVER-estimate and a reword fails early. This guards the common case;
	// `A6c4-G2-2` is the row that carries the operator's rule.
	const TEXT_XS_ADVANCE_PX = 6.6;
	const VIEWPORT_PX = 1366;
	/** The strip's own horizontal inset, declared here because it is not measured. */
	const ROW_INSET_PX = 32;
	const available = VIEWPORT_PX - ROW_INSET_PX;
	const widthOf = (text: string) => text.length * TEXT_XS_ADVANCE_PX;

	// The STEADY state: the verified source, with the real next step beside it.
	const steady = row2Of(renderStrip());
	const steadyWidth =
		widthOf(textOf(steady.querySelector('[data-testid="teaching-load-status-sentence"]'))) +
		widthOf(textOf(steady.querySelector('[data-testid="teaching-load-current-repair"]'))) +
		widthOf(textOf(steady.querySelector('[data-testid="teaching-load-repair-review"]')));
	assert.ok(
		steadyWidth <= available,
		`the steady header must fit on one line: ${Math.round(steadyWidth)}px of declared text against ${available}px available — ` +
			'if this fails the row will wrap in the state a scheduler meets most, and the fix is shorter copy, not a smaller font',
	);

	// The WORST state is allowed to wrap, and the model says what that costs.
	const worst = row2Of(renderStrip(
		{
			dataSource: 'cached',
			isWorkspaceWritable: false,
			dataSourceNotice: 'x',
			savedAtLabel: '2026-09-28T09:14:00.000Z',
		},
		BLOCKED_ITEM,
	));
	const worstWidth =
		widthOf(textOf(worst.querySelector('[data-testid="teaching-load-degraded-notice"]'))) +
		widthOf(textOf(worst.querySelector('[data-testid="teaching-load-current-repair"]')));
	assert.ok(
		worstWidth > available,
		'this fixture is the declared worst case and is expected to exceed one line — if it no longer does, the wrap budget below is stale and the model must be re-derived',
	);

	// The model's arithmetic must hold, and the wrap must be declared honestly as
	// OVER budget rather than quietly absorbed.
	const M = TEACHING_LOAD_HEADER_MODEL;
	assert.equal(
		M.HEADER_TOTAL_IF_SENTENCE_WRAPS_PX,
		M.STRIP_CONTAINER_BOX_PX + M.ROW_1_COMMAND_PX + M.ROW_2_BORDER_PX + 2 * M.ROW_2_WRAP_LINE_PX + 4,
		"the wrapped total is strip 9 + command 28 + hairline 1 + two text lines + the status pill's py-0.5",
	);
	assert.ok(
		M.HEADER_TOTAL_IF_SENTENCE_WRAPS_PX > 70,
		'the wrap cost must be declared as OVER the 70px budget — that is the reason the wrap is a measured fallback and not the design',
	);
	assert.ok(M.HEADER_TOTAL_PX <= 70, 'and the one-line header must still be inside the 70px budget');
});
