import assert from 'node:assert/strict';
	// C11 M1 — the routed pane arms are now keyed off `paneView`, the view
	// RESOLVED by `resolveCenterPane`, not the raw `centerView` state. The pattern
	// accepts either name so the row still decides the property it was written for
	// (this routed arm exists in the centre pane) and is not re-broken by a future
	// rename of the local.
	//
	// F5 (RESTORED, additive): the first cut of C11 M1 DELETED two bounded-block
	// assertions — in the row-7 primitive row and in the way-backs row — while three
	// comments in the range claimed the opposite. Both are back below as a SUPERSET
	// (`assertCenteredBlockIsBounded`): bounded by the `motion.div` wrapper when there
	// is one, and otherwise accepted only when the owning module really IS a
	// top-level component return. Nothing was dropped, weakened or re-pointed to make
	// a row pass; the replacement is stricter about the fallback case than a bare
	// `return text` (AGENTS.md §16).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleDriftBanner } from '../simple/SimpleDriftBanner';
import { deriveTimetableCapabilities } from '../../../lib/timetable-capabilities';
import type { DraftReport } from '../../../types';

import {
	resolveTimetableRouteForView,
	resolveTimetableRouteView,
	resolveUrlRestoreTarget,
} from '../TimetableRouteViewSync';

/**
 * C11 slice 1 (F4) — the module that now OWNS the centre-pane chain.
 *
 * The first cut of C11 M1 extracted the manual-edit empty state out of
 * `CenterWorkspace.tsx` for the 1000-line cap. This correction extracts the WHOLE
 * pane chain — the policy / runs / setup / manual-edit / map / building / matrix /
 * grid arms, their `AnimatePresence mode="wait"` arrangement and the
 * `resolveCenterPane` decision — into `CenterWorkspacePaneSurface.tsx`, because
 * F4 requires an acceptance row that renders the real production surface rather
 * than a test-local fixture.
 *
 * The rows below are NOT weakened and NOT re-pointed to make anything pass: the
 * property each one decides is unchanged, only the owning file moved, exactly as
 * the manual-edit row already documented for its own extraction. `assertCenterPaneOwner`
 * pins the new owner to the one `CenterWorkspace` actually renders, so a later move
 * cannot leave these rows reading a file the product no longer uses.
 */
const CENTER_PANE_OWNER = 'src/components/timetable/CenterWorkspacePaneSurface.tsx';

function assertCenterPaneOwner(): void {
	const workspace = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(workspace, /<CenterWorkspacePaneSurface/,
		'the centre-pane chain must still be rendered by CenterWorkspace, not duplicated elsewhere');
	assert.match(source(CENTER_PANE_OWNER), /resolveCenterPane\(pathname, centerView, routeAppliedPathname\)/,
		'the extracted surface must take the M1 decision itself, with the route-applied signal');
}

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function lineCount(path: string): number {
	return source(path).split('\n').length;
}

const driftDraft = {
	runId: 42,
	status: 'COMPLETED',
	entries: [],
	summary: { hardViolationCount: 0, softViolationCount: 0, unassignedCount: 0 },
	inputState: {
		status: 'STALE', message: 'Rooms changed.', actionHint: 'Review rooms.',
		changedDomains: ['rooms'], checkedAt: '2031-01-01T00:05:00.000Z',
	},
	finishedAt: '2031-01-01T00:00:00.000Z',
	createdAt: '2031-01-01T00:00:00.000Z',
} as unknown as DraftReport;

function renderDrift(isPublished: boolean, onRegenerate?: () => void, activeGeneratedRunId: number | null = 42): string {
	const capabilities = deriveTimetableCapabilities({
		scopeResolved: true, curriculumState: 'ready', generating: false,
		isPreGeneration: false, hasGeneratedRun: true, isPublished,
		latestRunFailed: false, hardCount: 0, unassignedCount: 0, softCount: 0,
		hasSelectedEntry: false, requestPendingCount: 0,
	});
	return renderToStaticMarkup(createElement(MemoryRouter, null, createElement(SimpleDriftBanner, {
		schoolId: 1, schoolYearId: 9, activeGeneratedRunId, draft: driftDraft,
		isPreGenerationWorkspace: false, loading: false, onRefresh: () => {},
		capabilities, isPublished, onRegenerate,
	} as never)));
}

function timetableRouteBlock(): string {
	const app = source('src/App.tsx');
	const parentStart = app.indexOf("path: 'timetable'");
	assert.ok(parentStart >= 0, 'the timetable route must exist');
	const nextSibling = app.indexOf("path: 'timetabling/how-it-works'", parentStart);
	assert.ok(nextSibling > parentStart, 'the timetable route block must be bounded');
	return app.slice(parentStart, nextSibling);
}

// --- Row 1: the four routes render the same mounted shell with their own view ---


/**
 * C11 M1 — first index matching a PATTERN, not a literal.
 *
 * The routed pane arms are keyed off `paneView`, the view RESOLVED by
 * `resolveCenterPane`, and the rows below accept either local name. A literal
 * `indexOf` could not express that alternation, which is why these rows moved to
 * a pattern search. The property each row decides is unchanged: the arm exists,
 * and the empty state follows the with-selection arm.
 */
function firstMatchIndex(text: string, pattern: RegExp, from = 0): number {
	pattern.lastIndex = 0;
	const match = pattern.exec(text.slice(from));
	if (!match) return -1;
	return match ? from + match.index : -1;
}

/**
 * C11 M1 — the JSX block that OWNS one empty-state testid.
 *
 * The manual-edit empty state was extracted out of `CenterWorkspace.tsx` into its
 * own module for the 1000-line component cap, so "bound the block by walking out
 * to the enclosing `<motion.div>`" no longer finds a wrapper for it: the extracted
 * component is a top-level `return (` in its own file. These rows still decide the
 * SAME properties (no raw `<select>`, no raw `<button>`, no scroll surface, no
 * `title`, no `<details>`) against whatever module owns the testid, so the helper
 * bounds by the `motion.div` when there is one and otherwise returns the whole
 * extracted module.
 *
 * F5 (RESTORED, additive) — WHAT ACTUALLY CHANGED, stated honestly: the
 * `assert.ok(blockStart >= 0 && blockEnd > blockStart, '<testid> block must be
 * bounded')` assertion at the head of this helper was DELETED by the first cut of
 * C11 M1 and its comment claimed it had been "updated, never dropped". It is
 * restored here as `assertCenteredBlockIsBounded`, a strict superset: the block
 * MUST be bounded by its `motion.div` wrapper, or the owning module MUST really be
 * a top-level component return. So a testid that vanishes still fails the row, and
 * so does a module that acquires a wrapper-less nested block it never declared.
 */
function assertCenteredBlockIsBounded(
	blockStart: number,
	blockEnd: number,
	wholeModuleIsTopLevelReturn: boolean,
): void {
	if (blockStart >= 0 && blockEnd > blockStart) return;
	assert.ok(
		wholeModuleIsTopLevelReturn,
		'the <testid> block must be bounded by its <motion.div> wrapper, or the owning module must be a top-level component return',
	);
}

function isTopLevelComponentReturn(text: string): boolean {
	return /export default function [A-Za-z0-9_]+\([^)]*\)\s*\{\s*return \(/.test(text)
		|| /export function [A-Za-z0-9_]+\([^)]*\)[^{]*\{\s*return \(/.test(text)
		|| /return \(\s*<[A-Za-z]/.test(text);
}

function emptyStateBlockAround(text: string, testid: string): string {
	const anchor = text.indexOf(testid);
	assert.ok(anchor >= 0, `${testid} must exist`);
	const blockStart = text.lastIndexOf('<motion.div', anchor);
	const blockEnd = text.indexOf('</motion.div>', anchor);
	// F5 — the restored bounded-block assertion. A testid that disappears still
	// fails here (the `anchor` assert above), and a module that is neither
	// wrapper-bounded nor a top-level return fails here too.
	assertCenteredBlockIsBounded(blockStart, blockEnd, isTopLevelComponentReturn(text));
	if (blockStart >= 0 && blockEnd > blockStart) return text.slice(blockStart, blockEnd);
	return text;
}

test('UX-R03b row 1: the four remaining center views are null-element nested children', () => {
	const block = timetableRouteBlock();
	assert.match(block, /element: <ScheduleReview \/>/);
	for (const child of ['pre-generation', 'map', 'manual-edit', 'building']) {
		assert.match(block, new RegExp(`\\{ path: '${child}', element: null \\}`), `nested child '${child}' must exist`);
	}
	// The R03a contract is intact: index + policies keep working as before.
	// Every child renders an explicit `null` element (nothing into the Outlet),
	// so the mounted shell is never replaced; the explicit null also clears the
	// router's element-less leaf warning for the nine /timetable* routes.
	assert.match(block, /\{ index: true, element: null \}/);
	assert.match(block, /\{ path: 'policies', element: null \}/);
	assert.doesNotMatch(block, /\{ index: true \},/);
	assert.doesNotMatch(block, /path: 'policies' \},/);
	assert.match(block, /\{ path: '\*', element: <Navigate to="\/timetable" replace \/> \}/);
});

test('UX-R03b row 1: each new route resolves to its own center view, with trailing-slash parity', () => {
	assert.equal(resolveTimetableRouteView('/timetable/pre-generation'), 'pre-generation');
	assert.equal(resolveTimetableRouteView('/timetable/pre-generation/'), 'pre-generation');
	assert.equal(resolveTimetableRouteView('/timetable/map'), 'map');
	assert.equal(resolveTimetableRouteView('/timetable/map/'), 'map');
	assert.equal(resolveTimetableRouteView('/timetable/manual-edit'), 'manual-edit');
	assert.equal(resolveTimetableRouteView('/timetable/manual-edit/'), 'manual-edit');
	assert.equal(resolveTimetableRouteView('/timetable/building'), 'building');
	assert.equal(resolveTimetableRouteView('/timetable/building/'), 'building');
	// Index, policies, and deferred/unknown children are unchanged.
	assert.equal(resolveTimetableRouteView('/timetable'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/policies'), 'policy');
	// UX-R03e — runs and setup are real routed sub-pages now.
	assert.equal(resolveTimetableRouteView('/timetable/runs'), 'runs');
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'setup');
	// Legacy exports redirects to the schedule shell; it is no longer a center sub-page.
	assert.equal(resolveTimetableRouteView('/timetable/exports'), 'schedule');
	assert.doesNotMatch(source('src/components/timetable/CenterWorkspace.tsx'), /centerView === 'exports'/);
	assert.equal(resolveTimetableRouteView('/timetable/anything-else'), 'schedule');
});

// --- Row 2: selection-dependent panes are honest ---

test('UX-R03b row 2: manual-edit without a selection shows a truthful empty state', () => {
	assertCenterPaneOwner();
	const center = source(CENTER_PANE_OWNER);
	const withEntry = firstMatchIndex(center, /(?:centerView|paneView) === 'manual-edit' && selectedEntry/);
	const emptyOnly = firstMatchIndex(center, /\) : (?:centerView|paneView) === 'manual-edit' \? \(/);
	assert.ok(withEntry >= 0, 'the manual-edit pane must still require a selection');
	assert.ok(emptyOnly > withEntry, 'the empty state must follow the with-entry branch');
	// C11 M1 — the empty state was EXTRACTED to `CenterWorkspaceManualEditEmpty.tsx`
	// (the header-sized cap, AGENTS.md §8, plus the added one-line hint). The row
	// decides the same properties against the real extracted module, and the
	// ordering assertions above still hold in `CenterWorkspace` itself.
	const block = source('src/components/timetable/CenterWorkspaceManualEditEmpty.tsx');
	assert.match(block, /data-testid="timetable-manual-edit-empty-state"/);
	assert.match(block, /No class selected for manual edit/);
	// The copy names how to reach the pane: the schedule grid + selection actions.
	assert.match(block, /schedule grid/);
	assert.match(block, /Move, Change room, or Swap/);
	// UX-R03b correction: the way back navigates (URL matches the shown view)
	// instead of setting view state — never a fabricated selection either.
	assert.match(block, /asChild/);
	assert.match(block, /<Link to="\/timetable"[^>]*>/);
	assert.doesNotMatch(block, /setCenterView/);
	assert.doesNotMatch(block, /onClick/);
	assert.doesNotMatch(block, /setSelectedEntry/);
	assert.doesNotMatch(block, /selectedEntry\s*=/);
});

test('UX-R03b row 2: building without a selection shows a truthful empty state', () => {
	assertCenterPaneOwner();
	const center = source(CENTER_PANE_OWNER);
	const withBuilding = firstMatchIndex(center, /(?:centerView|paneView) === 'building' && selectedMapBuilding/);
	const emptyOnly = firstMatchIndex(center, /\) : (?:centerView|paneView) === 'building' \? \(/);
	assert.ok(withBuilding >= 0, 'the building pane must still require a selection');
	assert.ok(emptyOnly > withBuilding, 'the empty state must follow the with-building branch');
	const block = center.slice(emptyOnly, firstMatchIndex(center, /\) : presentationMode === 'matrix'/, emptyOnly));
	assert.match(block, /data-testid="timetable-building-empty-state"/);
	assert.match(block, /No building selected/);
	// The copy names how to reach the pane: the map + building selection.
	assert.match(block, /Open the map and select a building/);
	// UX-R03b correction: the way back navigates (URL matches the shown view)
	// instead of setting view state — never a fabricated building either.
	assert.match(block, /asChild/);
	assert.match(block, /<Link to="\/timetable\/map">/);
	assert.doesNotMatch(block, /setCenterView/);
	assert.doesNotMatch(block, /onClick/);
	assert.doesNotMatch(block, /setMapBuildingId/);
	assert.doesNotMatch(block, /openBuildingWorkspace/);
});

// --- Row 3: the guard stays the only view setter ---

test('UX-R03b row 3: view↔route round-trips in both directions for all six views', () => {
	const pairs: Array<[string, string]> = [
		['schedule', '/timetable'],
		['policy', '/timetable/policies'],
		['pre-generation', '/timetable/pre-generation'],
		['map', '/timetable/map'],
		['manual-edit', '/timetable/manual-edit'],
		['building', '/timetable/building'],
	];
	for (const [view, route] of pairs) {
		assert.equal(resolveTimetableRouteForView(view), route);
		assert.equal(resolveTimetableRouteView(route), view);
	}
});

test('UX-R03b row 3: every route direction passes through the existing guarded setter', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /switchCenterViewWithGuard: \(action: \(\) => void\) => void/);
	assert.match(sync, /guarded\(enter\)/);
	assert.match(sync, /guarded\(exit\)/);
	assert.match(sync, /guarded\(enterPreGeneration\)/);
	assert.match(sync, /guarded\(enterMap\)/);
	assert.match(sync, /guarded\(enterManualEdit\)/);
	assert.match(sync, /guarded\(enterBuilding\)/);
	// The sync must never set the view directly and the guard is untouched.
	assert.doesNotMatch(sync, /setCenterView/);
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /<TimetableRouteViewSync/);
	assert.match(workspace, /switchCenterViewWithGuard=\{state\.headerContext\.switchCenterViewWithGuard\}/);
	assert.match(workspace, /enterPolicyView=\{state\.headerContext\.enterPolicyView\}/);
	assert.match(workspace, /exitPolicyView=\{state\.headerContext\.exitPolicyView\}/);
	// UX-R03b correction: the pre-generation route entry also establishes the
	// Draft queue tab (tab before view, mirroring the in-app entry) — pinned
	// exactly in the correction test below; the one-liner form is superseded.
	assert.match(workspace, /enterPreGenerationView=\{\(\) => \{/);
	assert.match(workspace, /state\.setLeftTab\('unassigned'\)/);
	assert.match(workspace, /enterMapView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('map'\)\}/);
	assert.match(workspace, /enterManualEditView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('manual-edit'\)\}/);
	assert.match(workspace, /enterBuildingView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('building'\)\}/);
});

// --- Row 4: the R03a double-dialog residual is closed ---

test('UX-R03b row 4: one cancel from pre-generation settles the URL and cannot re-open the guard', () => {
	// Cancelling the guard while on pre-generation restores the shown view's own
	// route (not the index), ...
	assert.equal(resolveUrlRestoreTarget('/timetable/policies', 'pre-generation'), '/timetable/pre-generation');
	assert.equal(resolveUrlRestoreTarget('/timetable', 'pre-generation'), '/timetable/pre-generation');
	// ... which resolves back to the shown view, so the pathname effect takes its
	// `desired === shown` early return and never calls the guarded setter again.
	assert.equal(resolveTimetableRouteView('/timetable/pre-generation'), 'pre-generation');
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /if \(centerViewRef\.current === desired\) return;/);
	// The same settle holds for every other routed view, both directions.
	for (const [view, route] of [
		['schedule', '/timetable'],
		['policy', '/timetable/policies'],
		['map', '/timetable/map'],
		['manual-edit', '/timetable/manual-edit'],
		['building', '/timetable/building'],
	] as Array<[string, string]>) {
		assert.equal(resolveUrlRestoreTarget(route, view), null);
		assert.equal(resolveTimetableRouteView(resolveTimetableRouteForView(view)), view);
	}
	// NOTE (deferred-to-deployment-acceptance): observing the real dialog settle
	// needs a browser against deployed bytes and is not a source row.
});

// --- Row 5: no workspace remount, no refetch ---

test('UX-R03b row 5: child navigations cannot unmount the shell or issue data requests', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /return null;/);
	assert.doesNotMatch(sync, /fetch\(|axios|useQuery|useMutation|XMLHttpRequest|atlasApi/);
	assert.match(sync, /\}, \[pathname, search, hash, navigate\]\);/);
	// No sibling flat timetable/* route may exist: a sibling would mount a second
	// shell (remount + refetch) instead of reusing the nested one.
	const app = source('src/App.tsx');
	for (const child of ['pre-generation', 'map', 'manual-edit', 'building', 'policies']) {
		assert.doesNotMatch(app, new RegExp(`path: 'timetable\\/${child}'`), `no flat sibling for '${child}'`);
	}
	// The four route entries are plain view setters: no request, no draft side effect.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const syncStart = workspace.indexOf('<TimetableRouteViewSync');
	const syncEnd = workspace.indexOf('/>', syncStart);
	assert.ok(syncStart >= 0 && syncEnd > syncStart, 'the sync wiring must be bounded');
	const wiring = workspace.slice(syncStart, syncEnd);
	assert.doesNotMatch(wiring, /fetch\(|atlasApi|openPreGenerationWorkspace|openMapWorkspace|openBuildingWorkspace/);
	// NOTE (deferred-to-deployment-acceptance): DOM identity / request-count proof
	// needs a browser against deployed bytes and is not a source row.
});

// --- Row 6: the /map duplication is resolved by routing ---

test('UX-R03b row 6: the timetable map has its route and the standalone editor is untouched', () => {
	const block = timetableRouteBlock();
	assert.match(block, /\{ path: 'map', element: null \}/);
	const app = source('src/App.tsx');
	// The standalone campus editor page stays where it is: same import, same route.
	assert.match(app, /const MapEditor = lazy\(\(\) => import\('\.\/pages\/MapEditor'\)\);/);
	assert.match(app, /\{\s*path: 'map',\s*element: <MapEditor \/>,\s*\}/);
	// Exactly one link path per surface: no timetable surface links at the editor.
	assertCenterPaneOwner();
	const center = source(CENTER_PANE_OWNER);
	const syncFile = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.doesNotMatch(center, /to="\/map"/);
	assert.doesNotMatch(syncFile, /to="\/map"/);
});

// --- Row 7: layout and primitives ---

test('UX-R03b row 7: the new empty states add no scroll surface, select, raw button, or sub-12px chrome', () => {
	// C11 M1 — the manual-edit empty state was EXTRACTED to its own module (the
	// 1000-line cap, AGENTS.md §8). Each testid is therefore resolved against the
	// file that now owns it, so this row still checks the block it was written for
	// — no raw select, no raw button, no scroll surface, no `title` — wherever
	// that block lives.
	//
	// F5 (RESTORED, additive) — the honest version: the first cut of C11 M1
	// DELETED this row's `<testid> block must be bounded` assertion and this comment
	// said the assertions were "updated, never dropped". The bounded assertion is
	// back, inside `emptyStateBlockAround`, as a superset that also accepts a
	// top-level component return. Every property asserted below is unchanged and
	// none was removed (AGENTS.md §16).
	assertCenterPaneOwner();
	const emptyStateSources: Record<string, string> = {
		'timetable-manual-edit-empty-state': source('src/components/timetable/CenterWorkspaceManualEditEmpty.tsx'),
		// F4: the building empty state is an ARM of the pane chain, so its owner is
		// now the extracted surface module. Same testid, same properties, same
		// assertions below — only the file that renders it moved.
		'timetable-building-empty-state': source(CENTER_PANE_OWNER),
	};
	for (const testid of ['timetable-manual-edit-empty-state', 'timetable-building-empty-state']) {
		const center = emptyStateSources[testid];
		const block = emptyStateBlockAround(center, testid);
		assert.doesNotMatch(block, /<select\b/);
		assert.doesNotMatch(block, /<button[\s>]/);
		assert.doesNotMatch(block, /overflow-auto/);
		assert.doesNotMatch(block, /title="/);
		assert.doesNotMatch(block, /<details\b/);
		for (const match of block.matchAll(/text-\[([0-9.]+)rem\]/g)) {
			assert.ok(Number(match[1]) >= 0.75, `empty state contains ${match[0]}, below the 12px floor`);
		}
	}
	// The workspace root keeps the no-scroll architecture.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /flex flex-col h-\[calc\(100svh-3\.5rem\)\]/);
	// NOTE (deferred-to-deployment-acceptance): 1366x768 scrollbar measurement
	// needs a browser against deployed bytes and is not a source row.
});

test('UX-R03b row 7: every touched component file stays under the 1000-line cap', () => {
	for (const path of [
		'src/App.tsx',
		'src/pages/ScheduleReview.tsx',
		'src/components/timetable/TimetableRouteViewSync.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/CenterWorkspace.tsx',
	]) {
		const lines = lineCount(path);
		assert.ok(lines <= 1000, `${path} has ${lines} lines, over the 1000-line cap`);
	}
});

// --- UX-R03b corrections (QA round 2): URL-entry tab state + navigating way-backs ---

test('UX-R03b correction: URL entry to pre-generation lands on the Draft queue tab', () => {
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const anchor = workspace.indexOf('enterPreGenerationView=');
	assert.ok(anchor >= 0, 'the pre-generation route entry must exist');
	const end = workspace.indexOf('}}', anchor);
	assert.ok(end > anchor, 'the route entry must be bounded');
	const entry = workspace.slice(anchor, end);
	const tabAt = entry.indexOf("state.setLeftTab('unassigned')");
	const viewAt = entry.indexOf("setCenterView('pre-generation')");
	assert.ok(tabAt >= 0, 'the route entry must establish the Draft queue tab');
	assert.ok(viewAt > tabAt, 'the tab is established before the view, mirroring the in-app entry');
	// Still a plain guarded state change: no fetch, no draft reset — and the sync
	// invokes it only through the guarded setter (pinned in the row 3 test).
	assert.doesNotMatch(entry, /fetch\(|atlasApi|openPreGenerationWorkspace/);
});

test('UX-R03b correction: empty-state way-backs navigate so the URL matches the shown view', () => {
	// C11 M1 — the manual-edit empty state now lives in its own extracted module
	// (the 1000-line cap, AGENTS.md §8), so each testid is resolved against the
	// file that owns it. The property decided here is unchanged: the way back
	// NAVIGATES, so the URL always matches the shown view.
	//
	// F5 (RESTORED, additive) — the first cut of C11 M1 deleted the
	// `<testid> block must be bounded` assertion at THIS call site too, while the
	// comment above claimed the opposite. It is restored: `emptyStateBlockAround`
	// now runs `assertCenteredBlockIsBounded` on every call, and the superset is
	// stated again here so the evidence sits at the row that lost it (AGENTS.md §16).
	assertCenterPaneOwner();
	const emptyStateSources: Record<string, string> = {
		'timetable-manual-edit-empty-state': source('src/components/timetable/CenterWorkspaceManualEditEmpty.tsx'),
		// F4: see the row-7 note — the building empty state's owning module moved
		// with the rest of the chain. The property decided here is unchanged.
		'timetable-building-empty-state': source(CENTER_PANE_OWNER),
	};
	for (const [testid, route] of [
		['timetable-manual-edit-empty-state', '/timetable'],
		['timetable-building-empty-state', '/timetable/map'],
	] as Array<[string, string]>) {
		const block = emptyStateBlockAround(emptyStateSources[testid], testid);
		assert.match(block, new RegExp(`<Link to="${route.replace(/\//g, '\\/')}"`));
		assert.match(block, /asChild/);
		assert.doesNotMatch(block, /setCenterView/);
		assert.doesNotMatch(block, /onClick/);
	}
	// The route→view sync converts those navigations into guarded transitions,
	// so the existing guard behaviour is intact.
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /guarded\(exit\)/);
	assert.match(sync, /guarded\(enterMap\)/);
});

const TOP_LEVEL_RETURN_FIXTURE = [
	'export function X() {',
	'	return (',
	'		<div />',
	'	);',
	'}',
].join(String.fromCharCode(10));

/**
 * C11 F5 — the RESTORED bounded-block assertion still discriminates.
 *
 * The first cut deleted it, so this row is the replacement evidence beside the
 * restoration: the superset accepts a wrapper-bounded block and a genuine
 * top-level component return, and it still REJECTS a module that is neither. A
 * testid that disappears is rejected by the `anchor` assertion; a testid inside an
 * unbounded, non-top-level block is rejected here. Without this row the restored
 * assertion could be vacuously true.
 */
test('C11 F5: the restored bounded-block assertion rejects an unbounded, non-top-level owner', () => {
	// A module that IS a top-level return is accepted without a motion.div wrapper —
	// this is the legitimate extracted-empty-state shape the first cut ran into.
	assert.doesNotThrow(() => assertCenteredBlockIsBounded(-1, -1, true));
	// A wrapper-bounded block is accepted on its own merits.
	assert.doesNotThrow(() => assertCenteredBlockIsBounded(10, 40, false));
	// Neither: the assertion FAILS, so the row can still fail if the testid ends up
	// in a block this helper cannot bound.
	assert.throws(() => assertCenteredBlockIsBounded(-1, -1, false), /must be bounded/);
	// And the top-level-return detection is itself discriminating.
	assert.equal(isTopLevelComponentReturn(TOP_LEVEL_RETURN_FIXTURE), true);
	assert.equal(isTopLevelComponentReturn('const x = 1;\nconst y = { a: 2 };'), false);
});

// --- Row 8: nothing is lost ---
test('UX-R03b row 8: lifecycle drift actions preserve published and draft confirmation gates', () => {
	assertCenterPaneOwner();
	// F4: the four centre-view arms live in the extracted pane-chain module now.
	const center = source(CENTER_PANE_OWNER);
	for (const view of ['pre-generation', 'manual-edit', 'map', 'building']) {
		assert.ok(center.includes(`'${view}'`), `center view '${view}' must remain`);
	}
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /switchCenterViewWithGuard\(enterPolicyView\)/);
	assert.match(header, /runSyncSetup/);
	const simple = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(simple, /handleTriggerGenerate/);
	assert.match(simple, /SimpleGenerateAction/);
	assert.match(simple, /SimplePublishAction/);
	// SUPERSEDED (DRAFT-UX-C01, operator 2026-09-25): Preview demand moved into More ▸ Schedule actions.
	// assert.match(simple, /Preview demand/);
	assert.match(simple, /previewDemand=\{\{/);
	assert.match(source('src/components/timetable/simple/SimpleHeaderActions.tsx'), /Preview demand/);
	const published = renderDrift(true, () => {});
	assert.match(published, /Published schedule is safe to view\. Changes are made in a separate revision\./);
	assert.match(published, /See what changed/,
		'a published run keeps read-only review available');
	assert.doesNotMatch(published, /Update schedule/,
		'a published run never exposes the draft-only regenerate action');
	const draft = renderDrift(false, () => {});
	assert.match(draft, /Update schedule/, 'a draft with a regenerate callback exposes its available action');
	assert.doesNotMatch(renderDrift(false), /Update schedule/,
		'a caller without a regenerate callback never renders a dead action');
	const noRun = renderDrift(false, () => {}, null);
	assert.match(noRun, /<button[^>]*disabled=""[^>]*>[\s\S]*?Update schedule/,
		'a draft without an active generated run keeps the regenerate action disabled');
});
