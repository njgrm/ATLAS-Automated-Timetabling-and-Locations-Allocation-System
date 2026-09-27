/**
 * A3-TITLE-STRIP-C3 — the two compact title strips are now ONE contract.
 *
 * ## What this stream changed
 *
 * `a3-c1-audit-20260928/route-table.md` measured three title densities on the
 * non-timetable routes. The `PageHeader` card (grade B) is OUT OF SCOPE and
 * untouched. The two COMPACT strips disagreed with each other and are the scope:
 *
 *   strip A  `/sections` `/subjects` `/teachers`  ->  AdminWorkspaceFrame
 *   strip B  `/teaching-load`                      ->  WorkspaceToolbar
 *
 * `CompactTitleStrip` (src/components/app-shell/CompactTitleStrip.tsx) now owns
 * the shell both render: one full-bleed outer treatment, one padding, one row
 * layout, and one status affordance that explains itself on hover with a
 * description AND a next action.
 *
 * ## OPEN DECISION — the per-page title scale is NOT unified, on purpose
 *
 * A's title is `text-lg lg:text-xl`; B's is `text-sm sm:text-base`. B was left
 * alone and A was left alone. Unifying them is a real product trade, not a
 * cleanup: the larger scale is friendlier to older operators, but it adds
 * vertical space to `/teachers` and `/teaching-load`, which carry ACCEPTED
 * browser rows 14 and 16 (no page scrollbar at 1366x768; more than one roster
 * row visible). This stream runs NO browser, so it cannot measure that trade at
 * a rendered screen. The decision is escalated, not guessed: **it needs one
 * rendered screen at 1366x768 on /teachers and /teaching-load before either
 * side may be adopted.** The two scale class strings are pinned verbatim below so
 * that whichever way it is decided, the change is a deliberate edit to a pinned
 * value and not a silent drift.
 *
 * ## Why the strip is full-bleed rather than a card (a forced consequence)
 *
 * Strip A's frame owns a viewport column with NO padding around the header, so
 * giving A a card treatment could only ever ADD height. Height-neutrality
 * therefore forces the full-bleed direction, and strip B had to follow it: B's
 * padded page band in TeachingLoad.tsx was redundant with the strip's own inset
 * and was removed. Nothing was rounded, padded or moved inward.
 *
 * ## How the height claim is made testable
 *
 * The property that matters is "neither header grew". It is asserted as a
 * measured number, not as a comment:
 *
 *   strip   container vertical box BEFORE   AFTER   delta
 *   A              13px (py-1.5 + border-b)   9px    -4px
 *   B              23px (band 13 + card 10)  9px   -14px
 *
 * `containerVerticalBox()` computes that from the REAL class strings, and
 * `PRE_CHANGE_*` holds the two BEFORE figures. The row's own height-driving
 * classes are pinned per page as exact sets, so the only way the header can grow
 * is through the container — which is exactly the number under test. A
 * reintroduced card inset (`rounded-*` on the outer) is a separate red: it means
 * a parent gained a padded band, which is how the height would come back.
 *
 * No rendered height was measured (this stream runs no browser). These are
 * declared-box figures derived from the Tailwind spacing scale, and they are
 * sufficient for the claim being made: the change is a pure reduction of the
 * container box, and the row content is byte-identical.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AdminWorkspaceFrame } from '@/components/admin-workspace/AdminWorkspace';
import { WorkspaceToolbar } from '@/components/faculty-assignments/WorkspaceToolbar';
import { COMPACT_TITLE_STRIP_CLASS, CompactTitleStrip } from '@/components/app-shell/CompactTitleStrip';
import { COVERAGE_MODE_CONFIG } from '@/lib/teaching-load-helpers';

const HERE = dirname(fileURLToPath(import.meta.url));
// src/components/app-shell/__tests__ -> atlas-client
const CLIENT_ROOT = resolve(HERE, '../../../..');

const source = (path: string): string => readFileSync(resolve(CLIENT_ROOT, path), 'utf8');

const STRIP_A_FILE = 'src/components/admin-workspace/AdminWorkspace.tsx';
const STRIP_B_FILE = 'src/components/faculty-assignments/WorkspaceToolbar.tsx';
const SHARED_FILE = 'src/components/app-shell/CompactTitleStrip.tsx';

// --- the height model ----------------------------------------------------------

/** Tailwind v4 default spacing scale: 1 unit = 0.25rem = 4px. */
const SPACING: Record<string, number> = {
	'0': 0,
	'0.5': 2,
	'1': 4,
	'1.5': 6,
	'2': 8,
	'2.5': 10,
	'3': 12,
	'3.5': 14,
	'4': 16,
};

/**
 * The strip container's vertical box in px: vertical padding + vertical borders.
 * Horizontal padding (`px-*`) and rounding are deliberately NOT counted — they
 * cannot change the height of a full-bleed bar.
 */
function containerVerticalBox(classNames: string): number {
	const classes = classNames.split(/\s+/).filter(Boolean);
	let padding = 0;
	// `py-*` sets BOTH edges, so it is counted twice; `pt-*`/`pb-*` once each.
	for (const [token, sides] of [['py', 2], ['pt', 1], ['pb', 1]] as const) {
		for (const c of classes) {
			if (c === token) {
				padding += SPACING['4'] * sides;
				continue;
			}
			if (c.startsWith(token + '-')) {
				const value = SPACING[c.slice(token.length + 1)];
				assert.ok(value !== undefined, 'unmodelled vertical spacing class: ' + c);
				padding += value * sides;
			}
		}
	}
	let border = 0;
	if (classes.includes('border')) border += 2;
	if (classes.includes('border-t')) border += 1;
	if (classes.includes('border-b')) border += 1;
	return padding + border;
}

/** The class string of the element carrying `data-testid` in a markup string. */
function elementWithTestId(html: string, testId: string): string {
	const marker = 'data-testid="' + testId + '"';
	const at = html.indexOf(marker);
	assert.ok(at > 0, 'no element carries data-testid=' + testId + '\n' + html.slice(0, 400));
	// The last "<" before the marker opens the tag that carries it; its ">"
	// closes it. Nothing between them can be a nested element.
	const open = html.lastIndexOf('<', at);
	const close = html.indexOf('>', at);
	assert.ok(open >= 0 && close > open, 'unterminated tag for data-testid=' + testId);
	const tag = html.slice(open, close + 1);
	const classAt = tag.indexOf('class="');
	assert.ok(classAt > 0, 'no class on data-testid=' + testId + ': ' + tag);
	const classEnd = tag.indexOf('"', classAt + 7);
	return tag.slice(classAt + 7, classEnd);
}

const has = (classNames: string, token: string): boolean => classNames.split(/\s+/).includes(token);
const hasPrefix = (classNames: string, prefix: string): boolean =>
	classNames.split(/\s+/).some((c) => c.startsWith(prefix));

// --- renderers for the two real call sites -------------------------------------

function renderStripA(sourceState: 'verified-live' | 'saved-data' = 'verified-live'): string {
	return renderToStaticMarkup(
		createElement(AdminWorkspaceFrame, {
			title: 'Subjects',
			description: 'Maintain the teaching catalog.',
			sourceState,
			lastVerified: '2026-09-28 09:00',
			primaryActions: createElement('button', { type: 'button' }, 'Add subject'),
			secondaryActions: createElement('button', { type: 'button' }, 'Import'),
			children: createElement('div', null, 'rows'),
		}),
	);
}

function renderStripB(overrides: Record<string, unknown> = {}): string {
	const props = {
		realAssignedPairs: 10,
		syntheticPlaceholderPairs: 3,
		unassignedPairs: 2,
		totalPairs: 15,
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
		coverageMode: 'REAL_FACULTY_STANDARD' as const,
		onCoverageModeChange: () => {},
		coverageModeConfig: COVERAGE_MODE_CONFIG,
		workspaceStateLabel: 'EnrollPro roster verified',
		workspaceStateDescription: 'ATLAS Teaching Load draft. Freshly verified.',
		workspaceStateNextAction: 'Review one teacher, then save the draft.',
		activeDraftCount: 0,
		saving: false,
		onSave: () => {},
		onRetrySource: () => {},
		...overrides,
	};
	return renderToStaticMarkup(createElement(WorkspaceToolbar, props as never));
}

const bothStrips = (): [string, string] => [renderStripA(), renderStripB()];

// --- 1. the unified contract is genuinely shared -------------------------------

test('both strips render byte-identical outer and row classes from the shared contract', () => {
	const [a, b] = bothStrips();
	const aOuter = elementWithTestId(a, 'admin-command-header');
	const bOuter = elementWithTestId(b, 'teaching-load-command-header');
	assert.equal(
		aOuter,
		COMPACT_TITLE_STRIP_CLASS.outer,
		"strip A's outer must be the shared outer class, unmodified",
	);
	assert.equal(
		bOuter,
		aOuter,
		"strip B's outer must be the SAME string as strip A's — this is the unification",
	);

	const aRow = elementWithTestId(a, 'setup-compact-command-header');
	const bRow = elementWithTestId(b, 'teaching-load-compact-command-header');
	assert.equal(aRow, COMPACT_TITLE_STRIP_CLASS.row, "strip A's row must be the shared row class");
	assert.equal(bRow, aRow, "strip B's row must be the SAME string as strip A's");
});

test('neither call site re-declares the strip shell locally', () => {
	// A local copy is exactly how these two strips diverged the first time: each
	// had its own outer, its own padding and its own row.
	for (const path of [STRIP_A_FILE, STRIP_B_FILE]) {
		const text = source(path);
		assert.doesNotMatch(
			text,
			/bg-background\/85 px-4 py-1 backdrop-blur-md/,
			path + ' must not carry a local copy of the strip outer',
		);
		assert.doesNotMatch(text, /flex min-w-0 flex-wrap items-center/, path + ' must not carry a local copy of the strip row');
		assert.match(text, /<CompactTitleStrip/, path + ' must render the shared strip');
		assert.match(text, /app-shell\/CompactTitleStrip/, path + ' must import the shared strip');
		assert.match(text, /statusDescription=/, path + ' must feed the shared status explanation');
		assert.match(text, /statusNextAction=/, path + ' must feed the shared status next action');
	}
	// And the shared module is the only place any of these class strings live.
	const shared = source(SHARED_FILE);
	for (const [key, value] of Object.entries(COMPACT_TITLE_STRIP_CLASS)) {
		assert.ok(shared.includes(value), 'the shared module must own the ' + key + ' class string');
	}
});

test('every preserved data-testid is still on the tree, with data-source-state intact', () => {
	const [a, b] = bothStrips();
	// Rendered-in-markup ids. A closed Popover/Tooltip renders no content, so
	// `setup-source-details-popover` and `setup-source-last-verified` are pinned
	// against the source below instead of against static markup.
	for (const testId of [
		'admin-command-header',
		'setup-compact-command-header',
		'admin-source-truth-summary',
		'teaching-load-command-header',
		'teaching-load-compact-command-header',
		'teaching-load-source-truth-summary',
		'teaching-load-tab-row',
		'teaching-load-readiness-strip',
		'compact-title-strip-status',
	]) {
		const where = [a, b].filter((html) => html.includes('data-testid="' + testId + '"'));
		assert.ok(where.length > 0, 'lost data-testid: ' + testId);
	}
	// Ids that live inside a CLOSED popover render nothing, and ids that arrive
	// through a prop (the alert chip's `testId`) are not attribute literals, so
	// these are pinned as strings against the source that owns them.
	for (const testId of [
		'setup-source-details-popover',
		'setup-source-last-verified',
		'setup-more-daily',
		'teaching-load-alert-over-cap',
		'teaching-load-alert-excess',
		'teaching-load-alert-teacher-x',
	]) {
		assert.ok(
			source(STRIP_A_FILE).includes(testId) || source(STRIP_B_FILE).includes(testId),
			'lost data-testid: ' + testId,
		);
	}
	// data-source-state is the value selectors read, on BOTH strips' status.
	assert.match(a, /data-source-state="verified-live"/, "strip A's chip must still carry data-source-state");
	assert.match(b, /data-source-state="live"/, "strip B's badge must still carry data-source-state");
	const cached = renderStripB({ dataSource: 'cached', isWorkspaceWritable: false, degradedWriteEnabled: false });
	assert.match(cached, /data-source-state="cached"/, 'the badge must follow the real dataSource value, not a literal');
});

// --- 2. the status affordance ---------------------------------------------------

test('the status explains itself on hover on BOTH strips: description AND next action', () => {
	// Rendered evidence that both texts reach the page, through the same two
	// accessible surfaces: the hover tooltip and the sr-only truth summary.
	const a = renderStripA('saved-data');
	assert.match(a, /ATLAS is showing the last safe local copy/, "strip A's description must reach the page");
	assert.match(a, /Review what is visible, then reconnect or sync before relying on final status\./, "strip A's next action must reach the page");

	const b = renderStripB();
	assert.match(b, /ATLAS Teaching Load draft\. Freshly verified\./, "strip B's description must reach the page");
	assert.match(b, /Review one teacher, then save the draft\./, "strip B's next action must reach the page");

	// The shared component is what supplies the hover layer, exactly once.
	const shared = source(SHARED_FILE);
	assert.match(shared, /<Tooltip>/, 'the shared strip must own the hover affordance');
	assert.match(shared, /data-testid="compact-title-strip-status-tooltip"/, 'the hover layer needs a handle');
	assert.equal(
		(shared.match(/<Tooltip>/g) ?? []).length,
		1,
		'one status affordance per strip — two would double the explanation',
	);
	// The two call sites must not have kept a private copy of it.
	assert.doesNotMatch(source(STRIP_B_FILE), /workspaceStateDescription<\/p>/, 'strip B must not keep its own status tooltip');
	// Tooltip is hover, and it is rendered by the shared shell for both.
	assert.match(source(STRIP_A_FILE), /statusDescription=\{resolvedSourceCopy\.description\}/);
	assert.match(source(STRIP_B_FILE), /statusDescription=\{workspaceStateDescription\}/);
});

test('the status hover wrapper adds no box that could change the row height', () => {
	// Radix needs a measurable trigger, so a wrapper span is unavoidable. It is
	// only height-neutral if it carries no padding, margin or fixed height.
	assert.equal(
		containerVerticalBox(COMPACT_TITLE_STRIP_CLASS.status),
		0,
		'the status wrapper must contribute zero vertical box',
	);
	assert.ok(!has(COMPACT_TITLE_STRIP_CLASS.status, 'h-6'), 'the status wrapper must not pin a height');
	assert.ok(!has(COMPACT_TITLE_STRIP_CLASS.status, 'h-7') && !has(COMPACT_TITLE_STRIP_CLASS.status, 'h-8'), 'no fixed height');
});

// --- 3. the two things that must NOT drift -------------------------------------

test('each page keeps its own title scale, verbatim (OPEN DECISION — needs a screen)', () => {
	// These are the exact pre-change strings. Strip A: text-lg / lg:text-xl.
	// Strip B: text-sm / sm:text-base. See the OPEN DECISION in the header: a
	// rendered 1366x768 screen is required before either side is adopted, so this
	// pin exists to make a future scale change a deliberate, visible edit.
	assert.match(
		source(STRIP_A_FILE),
		/<h1 className="shrink-0 text-lg font-bold text-foreground lg:text-xl">\{title\}<\/h1>/,
		"strip A's title scale must stay text-lg lg:text-xl",
	);
	assert.match(
		source(STRIP_B_FILE),
		/<h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">Teaching Load<\/h1>/,
		"strip B's title scale must stay text-sm sm:text-base",
	);
	// The title is passed IN as a node, so the shared shell cannot normalize it.
	assert.match(source(SHARED_FILE), /title: ReactNode;/, 'the shared strip must not take title text');
	// Rendered, the shared shell emits whatever title node it is handed and
	// never an h1 of its own (the source text mentions h1 only in prose).
	const shellProbe = renderToStaticMarkup(
		createElement(CompactTitleStrip, {
			stripTestId: 'probe-strip',
			rowTestId: 'probe-row',
			title: createElement('span', null, 'Probe title'),
			status: createElement('span', null, 'Live'),
			statusDescription: 'A description.',
			statusNextAction: 'A next action.',
			actions: createElement('button', { type: 'button' }, 'Go'),
		} as never),
	);
	assert.equal((shellProbe.match(/<h1/g) ?? []).length, 0, 'the shared strip must not own an h1');
	// And both sites still own exactly one h1 (a3-page-title-c1 pins this too).
	for (const path of [STRIP_A_FILE, STRIP_B_FILE]) {
		assert.equal((source(path).match(/<h1/g) ?? []).length, 1, path + ' must still own exactly one h1');
	}
});

test('NEITHER header grew: the container vertical box shrank on both strips', () => {
	// BEFORE, measured from the pre-change class strings on this base
	// (e642f5e8): A `py-1.5` + `border-b` = 12 + 1; B a `py-1` + `border` card
	// (8 + 2 = 10) inside TeachingLoad's `py-1.5` + `border-b` band (12 + 1 = 13).
	const PRE_CHANGE_STRIP_A = 13;
	const PRE_CHANGE_STRIP_B = 23;

	const aOuter = elementWithTestId(renderStripA(), 'admin-command-header');
	assert.equal(
		containerVerticalBox(aOuter),
		9,
		"strip A's container box is py-1 (8) + border-b (1)",
	);
	assert.ok(
		containerVerticalBox(aOuter) <= PRE_CHANGE_STRIP_A,
		"strip A's container grew: " + containerVerticalBox(aOuter) + ' > ' + PRE_CHANGE_STRIP_A,
	);

	// Strip B is the strip plus the page band that used to wrap it, so its
	// container box is the sum of the two elements' vertical boxes.
	const bOuter = elementWithTestId(renderStripB(), 'teaching-load-command-header');
	const bandClasses = /<div className="([^"]*)">\s*<WorkspaceToolbar/.exec(source('src/pages/TeachingLoad.tsx'));
	assert.ok(bandClasses, 'TeachingLoad must still wrap the strip in its own band element');
	assert.equal(
		containerVerticalBox(bOuter) + containerVerticalBox(bandClasses[1]),
		9,
		"strip B's container box is the shared strip (9) plus a band that now adds nothing",
	);
	assert.ok(
		containerVerticalBox(bOuter) + containerVerticalBox(bandClasses[1]) <= PRE_CHANGE_STRIP_B,
		"strip B's container grew: " + (containerVerticalBox(bOuter) + containerVerticalBox(bandClasses[1])) + ' > ' + PRE_CHANGE_STRIP_B,
	);
});

test('no card inset came back on either strip', () => {
	// A rounded border on a full-bleed bar is the visual signature of the card
	// treatment, and the only way a padded parent could return.
	for (const [label, html, testId] of [
		['strip A', renderStripA(), 'admin-command-header'],
		['strip B', renderStripB(), 'teaching-load-command-header'],
	] as const) {
		const outer = elementWithTestId(html, testId);
		assert.ok(!hasPrefix(outer, 'rounded'), label + ' must not be a rounded card: ' + outer);
		assert.ok(!hasPrefix(outer, 'shadow'), label + ' must not carry a card shadow: ' + outer);
		assert.ok(!hasPrefix(outer, 'mx-'), label + ' must not be inset horizontally: ' + outer);
		assert.ok(!hasPrefix(outer, 'mt-') && !hasPrefix(outer, 'mb-'), label + ' must not add outer margin: ' + outer);
	}
});

test('nothing that sets a height inside either strip changed', () => {
	// The container box is only half the claim; this is the other half. Every
	// class that sets a height inside a strip is pinned per page, so a control
	// cannot be quietly enlarged on its way into the shared shell. Scoped to the
	// whole strip (row plus strip B's trailing rows), all of which are unchanged.
	const [a, b] = bothStrips();
	const aKept = [
		'shrink-0 text-lg font-bold text-foreground lg:text-xl', // strip A title
		'h-8 rounded-full', // the source chip
		'h-9 gap-2 rounded-xl', // More
		'h-10 rounded-xl', // SmartHelpTrigger's own height, reached via render
	];
	for (const kept of aKept) {
		assert.ok(a.includes(kept), 'strip A lost or changed a height-driving class: ' + kept);
	}
	const bKept = [
		'text-sm font-bold tracking-tight text-foreground sm:text-base', // strip B title
		'h-6 cursor-help rounded-full', // the status badge
		'h-7 gap-1.5', // the primary action
		'h-7 w-7 shadow-sm', // More
		'hidden h-7 shrink-0 px-2 text-xs sm:inline-flex', // SmartHelpTrigger
	];
	for (const kept of bKept) {
		assert.ok(b.includes(kept), 'strip B lost or changed a height-driving class: ' + kept);
	}
	// The two rows differ in control SIZES (that is the preserved per-page
	// density) but are identical in LAYOUT, which is what was unified.
	assert.equal(
		elementWithTestId(a, 'setup-compact-command-header'),
		elementWithTestId(b, 'teaching-load-compact-command-header'),
	);
});

// --- 4. controls: these assertions must reject the mutations they exist for ------

test('the height model rejects the three ways this could have gone wrong', () => {
	// 1. padding one notch up (the "add breathing room" change).
	assert.ok(containerVerticalBox('border-b px-4 py-2') > containerVerticalBox('border-b px-4 py-1'));
	// 2. reinstating the card inset on strip A.
	assert.ok(containerVerticalBox('rounded-xl border px-2 py-1') > containerVerticalBox('border-b px-4 py-1'));
	// 3. restoring Teaching Load's padded band.
	assert.ok(containerVerticalBox('border-b px-3 py-1.5') > containerVerticalBox('shrink-0'));
	// And the model is not vacuous: it really does read padding and borders.
	assert.equal(containerVerticalBox('py-1 border-b'), 9);
	assert.equal(containerVerticalBox('py-1.5 border'), 14);
	assert.equal(containerVerticalBox('shrink-0'), 0);
});

test('the byte-identical outer assertion rejects a diverged strip', () => {
	const outerOf = (classNames: string): string => {
		const html = '<div class="' + classNames + '" data-testid="x"></div>';
		return elementWithTestId(html, 'x');
	};
	assert.equal(outerOf(COMPACT_TITLE_STRIP_CLASS.outer), COMPACT_TITLE_STRIP_CLASS.outer);
	// A strip that reverts to the old card treatment no longer matches the other.
	assert.notEqual(outerOf('rounded-xl border border-border/40 bg-background px-2 py-1'), COMPACT_TITLE_STRIP_CLASS.outer);
});

test('the shared strip renders the contract it exports, given a minimal consumer', () => {
	const html = renderToStaticMarkup(
		createElement(CompactTitleStrip, {
			stripTestId: 'probe-strip',
			rowTestId: 'probe-row',
			title: createElement('h1', null, 'Probe'),
			status: createElement('span', null, 'Live'),
			statusDescription: 'A description.',
			statusNextAction: 'A next action.',
			actions: createElement('button', { type: 'button' }, 'Go'),
		} as never),
	);
	assert.equal(elementWithTestId(html, 'probe-strip'), COMPACT_TITLE_STRIP_CLASS.outer);
	assert.equal(elementWithTestId(html, 'probe-row'), COMPACT_TITLE_STRIP_CLASS.row);
	assert.ok(html.includes('data-testid="compact-title-strip-status"'));
	assert.equal(containerVerticalBox(elementWithTestId(html, 'probe-strip')), 9);
	// An optional trailing row renders inside the strip, after the row.
	const withTrailing = renderToStaticMarkup(
		createElement(CompactTitleStrip, {
			stripTestId: 'probe-strip',
			rowTestId: 'probe-row',
			title: createElement('h1', null, 'Probe'),
			status: createElement('span', null, 'Live'),
			statusDescription: 'A description.',
			statusNextAction: 'A next action.',
			actions: null as unknown as ReactNode,
			children: createElement('div', { 'data-testid': 'probe-trailing' }),
		} as never),
	);
	assert.ok(
		withTrailing.indexOf('data-testid="probe-trailing"') > withTrailing.indexOf('data-testid="probe-row"'),
	);
});
