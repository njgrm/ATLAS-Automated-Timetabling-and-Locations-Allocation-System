/**
 * A2-TIMETABLE-CUSTODY (Lane C finding #63, MEDIUM) — ONE Undo on the Expert
 * screen, and no dangling reference left by the two that were removed.
 *
 * Finding #63, as recorded by the live run on `c5a9e832`:
 *
 *   "Two Undo buttons on one Expert screen, same name, same reason. A scheduler
 *    sees 'Undo last change' in the guidance bar and 'Undo' in the toolbar and
 *    cannot tell whether they differ; a screen reader hears the same name twice.
 *    Keep the toolbar one."
 *
 * The lane's own control inventory
 * (`docs/reviews/timetable-control-inventory-2026-09-26.md`, rows 140/141 and the
 * pass-2 correction) records the concrete consequence that pass 1 had missed:
 * both controls carried the **same** `data-testid="timetable-visible-undo"` and
 * the **same** `aria-label="Undo last manual timetable change"`, so
 * `getByTestId('timetable-visible-undo')` and
 * `getByRole('button', { name: 'Undo last manual timetable change' })` both
 * resolved to TWO nodes.
 *
 * Reading the render tree at the candidate base found THREE Undo affordances,
 * not two — see U0, which pins the inventory that was actually true:
 *
 *   1. `TimetableAdvancedHeaderHelp`        — the guidance bar, VISIBLE
 *   2. `TimetableUndoRedoControl`           — the toolbar Undo/Redo/History, VISIBLE
 *   3. `ScheduleReviewWorkspaceHeader`      — a THIRD Undo inside the collapsed
 *                                            "More tools" dropdown, and an
 *                                            icon-only button with no accessible
 *                                            name below the `xl` breakpoint
 *
 * 1 and 2 are simultaneously visible and are the pair finding #63 describes.
 * 3 never coexists with them (its Radix `DropdownMenuContent` is unmounted while
 * the menu is closed) and it carries its own distinct `timetable-header-undo`
 * testid, so it was not the reported defect — but it is a third control for the
 * identical action, and the instruction for this change was to reduce the screen
 * to the toolbar control. All three therefore reach one.
 *
 * THIS CANDIDATE REMOVES 1 AND 3 AND KEEPS 2. Nothing is deleted to make a test
 * pass: every accepted assertion that touched the removed controls is retained
 * and restated here against the surviving surface (AGENTS.md §16).
 *
 * Run: `npm run test:a2-undo-single-surface-a2`
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TimetableAdvancedHeaderHelp } from '../TimetableAdvancedHeaderHelp';
import { TimetableUndoRedoControl } from '../TimetableUndoRedoControl';

const here = fileURLToPath(new URL('.', import.meta.url));
const clientRoot = resolve(here, '../../../..');

function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

/**
 * Every PRODUCTION source under the timetable component tree.
 *
 * Test files are excluded on purpose: they legitimately quote the literals this
 * test counts (that is how the accepted assertions are written), so including
 * them would make every count meaningless. `__tests__` directories and `*.test.*`
 * files are the only exclusions — the walk is otherwise exhaustive, so a new
 * duplicate introduced anywhere in the surface is still caught.
 */
function allTimetableSources(): Array<[string, string]> {
	const dir = resolve(clientRoot, 'src/components/timetable');
	const out: Array<[string, string]> = [];
	const walk = (current: string): void => {
		for (const entry of readdirSync(current)) {
			const full = join(current, entry);
			if (statSync(full).isDirectory()) {
				if (entry === '__tests__' || entry === '__mocks__') continue;
				walk(full);
			} else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts') && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
				out.push([resolve(full).slice(clientRoot.length + 1).replace(/\\/g, '/'), readFileSync(full, 'utf8')]);
			}
		}
	};
	walk(dir);
	return out;
}

/** Count every occurrence of a literal across the whole timetable component tree. */
function occurrences(needle: string): Array<{ file: string; index: number }> {
	const hits: Array<{ file: string; index: number }> = [];
	for (const [file, text] of allTimetableSources()) {
		let index = text.indexOf(needle);
		while (index !== -1) {
			hits.push({ file, index });
			index = text.indexOf(needle, index + needle.length);
		}
	}
	return hits;
}

/**
 * Render the guidance bar with a POPULATED edit history — the exact live
 * condition under which it used to render its own Undo.
 *
 * The undo-only props are passed through a loose record on purpose: this test
 * must run against BOTH the pre-fix component (which requires them) and the
 * post-fix one (which no longer declares any of them), and `tsx` does not
 * typecheck. Post-fix these keys are inert leftovers, which is precisely what
 * U1 measures.
 */
function renderGuidanceBar(editHistoryCount: number, mode: 'schedule' | 'draft' = 'schedule'): string {
	return renderToStaticMarkup(
		createElement(TimetableAdvancedHeaderHelp, {
			mode,
			activeTaskHelper: 'Choose one unresolved session, then choose a green slot on the grid.',
			editHistoryCount,
			revertLoading: false,
			onRevertLastEdit: () => {},
			lastEditUndoable: true,
			undoBlockedReason: 'The last change to this schedule was itself an undo, so there is nothing left to undo.',
		} as never),
	);
}

/** The toolbar control as the Expert screen mounts it, with the live blocked reason. */
const LIVE_BLOCKED_REASON = 'The last change to this schedule was itself an undo, so there is nothing left to undo.';

function renderToolbar(overrides: Record<string, unknown> = {}): string {
	return renderToStaticMarkup(
		createElement(TimetableUndoRedoControl, {
			editHistoryCount: 2,
			revertLoading: false,
			revertLastEdit: async () => {},
			redoState: null,
			redoVersionStale: false,
			redoLastEdit: async () => {},
			clearRedo: () => {},
			setShowEditHistory: () => {},
			undoNotice: null,
			undoBlockedReason: LIVE_BLOCKED_REASON,
			...overrides,
		} as never),
	);
}

/* ── U0 the inventory that was actually true, pinned ────────────────────────── */

test('U0 the Expert screen had THREE Undo affordances; the one that stayed is the toolbar control', () => {
	// The two simultaneously-visible ones share one testid — this is the recorded
	// pre-fix defect and the reason the fix is an allowlist of ONE, not a rename.
	assert.equal(
		occurrences('data-testid="timetable-visible-undo"').length,
		1,
		'exactly one Undo control declares the shared testid',
	);
	assert.equal(
		occurrences('aria-label="Undo last manual timetable change"').length,
		1,
		'exactly one control declares the shared accessible name',
	);
	// Surface 2 is the survivor, and it is the one the finding told us to keep.
	assert.match(source('src/components/timetable/TimetableUndoRedoControl.tsx'), /data-testid="timetable-visible-undo"/);
	// Surface 3 is gone: the header dropdown Undo and its distinct testid.
	assert.equal(
		occurrences('timetable-header-undo').length,
		0,
		'the third Undo (the header "More tools" dropdown) no longer exists',
	);
	// Surface 1 is gone: the guidance bar declares no Undo at all.
	const guidance = source('src/components/timetable/TimetableAdvancedHeaderHelp.tsx');
	assert.doesNotMatch(guidance, /<Button/, 'the guidance bar renders no button of any kind');
	assert.doesNotMatch(guidance, /onRevertLastEdit/, 'and accepts no undo handler');
});

/* ── U1 the removed control is absent from the RENDERED surface ─────────────── */

test('U1 the guidance bar renders NO Undo even with a populated edit history, and its guidance is intact', () => {
	for (const count of [1, 2, 159]) {
		const markup = renderGuidanceBar(count);
		assert.doesNotMatch(
			markup,
			/data-testid="timetable-visible-undo"/,
			`editHistoryCount=${count} renders no Undo control`,
		);
		assert.doesNotMatch(markup, /Undo last change/, `editHistoryCount=${count} renders no "Undo last change" copy`);
		assert.doesNotMatch(markup, /Undo last manual timetable change/, `editHistoryCount=${count} claims no undo name`);
		// The bar's ONLY button is the status legend, which is a different action
		// and legitimately a control — so the assertion is about which buttons
		// render, not about there being none.
		assert.deepEqual(
			[...markup.matchAll(/data-testid="([^"]+)"/g)].map((match) => match[1]),
			['timetable-foolproof-help', 'timetable-foolproof-help-text', 'timetable-status-legend'],
			`editHistoryCount=${count} renders only the guidance and the status legend`,
		);
		assert.match(markup, /data-testid="timetable-status-legend"/, 'the status legend survives the removal');
	}
	// RETAINED, not weakened: the B2 guidance this bar exists for is untouched.
	const markup = renderGuidanceBar(2);
	assert.match(markup, /id="timetable-foolproof-help"/, 'the id every task button points at still exists');
	assert.match(markup, /data-testid="timetable-foolproof-help"/);
	assert.match(markup, /No precision dragging required\./, 'the plain-language lead is still visible');
	assert.match(markup, /ATLAS previews the result before anything is saved\./, 'the short guidance is still visible');
	assert.doesNotMatch(
		markup.match(/<div id="timetable-foolproof-help"[^>]*>/)?.[0] ?? '',
		/sr-only/,
		'the guidance root is still not screen-reader-only',
	);
	// Draft mode still names the draft review.
	const draft = renderGuidanceBar(2, 'draft');
	assert.match(draft, /The draft review opens before anything is saved\./);
	assert.doesNotMatch(draft, /ATLAS previews the result/);
});

/* ── U2 no dangling reference from the removed controls ─────────────────────── */

test('U2 removing the two Undo controls left no orphan handler, selector, test hook or aria-label', () => {
	const guidance = source('src/components/timetable/TimetableAdvancedHeaderHelp.tsx');
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');

	// No orphan handler: neither file accepts, passes, or wires an undo callback.
	for (const [label, text] of [['guidance bar', guidance], ['header', header]] as const) {
		assert.doesNotMatch(text, /onRevertLastEdit/, `${label} declares no undo handler prop`);
		assert.doesNotMatch(text, /revertLastEdit/, `${label} dispatches no undo handler`);
		assert.doesNotMatch(text, /lastEditUndoable/, `${label} re-derives no undo decision`);
		assert.doesNotMatch(text, /undoBlockedReason/, `${label} carries no undo-only reason`);
		assert.doesNotMatch(text, /revertLoading/, `${label} carries no undo-only loading flag`);
	}
	// No orphan selector: the removed testid is gone from every file, and the
	// surviving one is declared exactly once.
	assert.equal(occurrences('timetable-header-undo').length, 0, 'no orphan `timetable-header-undo` hook remains');
	// The guidance bar keeps its own contract: the id and testid other UI points at.
	assert.match(guidance, /id="timetable-foolproof-help"/);
	assert.match(guidance, /data-testid="timetable-foolproof-help"/);
	// The status legend that shared the guidance bar's action row survives it.
	assert.match(guidance, /TimetableStatusLegend/, 'the guidance bar still renders the status legend');
	assert.match(source('src/components/timetable/TimetableStatusLegend.tsx'), /export function TimetableStatusLegend/);
});

/* ── U3 the surviving control is still discoverable, named and honest ───────── */

test('U3 the surviving Undo is still discoverable, still named, and still states the reason', () => {
	const markup = renderToolbar();

	// Discoverable: the control group is marked, and Undo sits beside Redo and History.
	assert.match(markup, /data-testid="timetable-undo-redo-control"/, 'the control group is still marked');
	assert.match(markup, /data-testid="timetable-visible-undo"/, 'the Undo is still rendered');
	assert.match(markup, /data-testid="timetable-visible-redo"/, 'beside Redo');
	assert.match(markup, /data-testid="timetable-visible-history"/, 'and History');
	assert.match(markup, />History<|>Undo<|>Redo</, 'each carries a visible text label');

	// Named: a screen reader hears one distinct, descriptive name — not two of one name.
	assert.match(markup, /aria-label="Undo last manual timetable change"/);
	assert.equal(occurrences('aria-label="Undo last manual timetable change"').length, 1, 'the name is unique on the screen');

	// Honest: the same live blocked reason the duplicate used to repeat is still
	// VISIBLE (role=status), so removing the guidance-bar tooltip lost no information.
	assert.match(markup, /data-testid="timetable-undo-blocked-reason"/, 'the reason is rendered, not only hovered');
	assert.match(markup, /role="status"/);
	assert.ok(
		markup.includes(LIVE_BLOCKED_REASON),
		'the exact live reason the duplicate repeated is still stated verbatim',
	);
	// And the Undo is actually disabled, so a disabled control is what the operator sees.
	// Attribute order is not relied upon: the button's own opening tag is isolated.
	const undoTag = markup.match(/<button[^>]*data-testid="timetable-visible-undo"[^>]*>/)?.[0] ?? '';
	assert.ok(undoTag, 'the Undo button element is locatable on its own');
	assert.match(undoTag, /\sdisabled(\s|=|>|$)/, `the blocked Undo renders disabled (got ${undoTag})`);

	// A live Undo carries no reason banner and is enabled.
	const live = renderToolbar({ undoBlockedReason: null });
	assert.doesNotMatch(live, /data-testid="timetable-undo-blocked-reason"/, 'a live Undo states no blocked reason');
	const liveUndoTag = live.match(/<button[^>]*data-testid="timetable-visible-undo"[^>]*>/)?.[0] ?? '';
	assert.ok(liveUndoTag, 'the live Undo button element is locatable on its own');
	assert.doesNotMatch(liveUndoTag, /\sdisabled(\s|=|>|$)/, `a live Undo is enabled (got ${liveUndoTag})`);
});

/* ── U4 §8 gate on the touched surface ──────────────────────────────────────── */

test('U4 the touched surface obeys AGENTS.md §8 and the 1000-line cap', () => {
	const guidance = source('src/components/timetable/TimetableAdvancedHeaderHelp.tsx');
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	const toolbar = source('src/components/timetable/TimetableUndoRedoControl.tsx');

	for (const [label, text] of [
		['TimetableAdvancedHeaderHelp', guidance],
		['ScheduleReviewWorkspaceHeader', header],
		['TimetableUndoRedoControl', toolbar],
	] as const) {
		assert.doesNotMatch(text, /<button/, `${label} has no raw <button> (AGENTS.md §8)`);
		assert.doesNotMatch(text, /<details/, `${label} has no raw <details> (AGENTS.md §8)`);
		assert.doesNotMatch(text, /\stitle=/, `${label} has no HTML title= attribute (AGENTS.md §8)`);
		assert.doesNotMatch(text, /<select/, `${label} has no native <select> (AGENTS.md §8)`);
		assert.ok(text.split('\n').length <= 1000, `${label} stays inside the 1000-physical-line cap (AGENTS.md §8)`);
	}
	// No new scroll surface: the guidance bar's own layout is unchanged apart from
	// losing a child, and the no-scroll shell in the header is untouched.
	assert.doesNotMatch(guidance, /overflow-(auto|scroll|y)/, 'the guidance bar adds no scrolling region');
	assert.doesNotMatch(header, /calc\(100svh-3\.5rem\)/, 'the header adds no second height-locked root');
});

/* ── U5 the decision is documented where the decision is made ───────────────── */

test('U5 the shared Undo decision names the one surface that consumes it', () => {
	// `timetableUndoRedoState.ts` documented "all three header Undo surfaces". Left
	// as-is it would be a false claim about the code, so the enumeration is updated
	// beside the code it describes.
	const state = source('src/components/timetable/timetableUndoRedoState.ts');
	assert.doesNotMatch(state, /all three header Undo surfaces/, 'the stale three-surface enumeration is gone');
	assert.match(state, /TimetableUndoRedoControl/, 'and it names the surviving surface');
});
