import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	resolveTimetableRouteForView,
	resolveTimetableRouteView,
	resolveUrlRestoreTarget,
} from '../TimetableRouteViewSync';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function lineCount(path: string): number {
	return source(path).split('\n').length;
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

test('UX-R03b row 1: the four remaining center views are element-less nested children', () => {
	const block = timetableRouteBlock();
	assert.match(block, /element: <ScheduleReview \/>/);
	for (const child of ['pre-generation', 'map', 'manual-edit', 'building']) {
		assert.match(block, new RegExp(`\\{ path: '${child}' \\}`), `nested child '${child}' must exist`);
		assert.doesNotMatch(block, new RegExp(`path: '${child}', element:`), `child '${child}' must render nothing (shell stays mounted)`);
	}
	// The R03a contract is intact: index + policies keep working as before.
	assert.match(block, /\{ index: true \}/);
	assert.match(block, /\{ path: 'policies' \}/);
	assert.doesNotMatch(block, /\{ index: true, element:/);
	assert.doesNotMatch(block, /path: 'policies', element:/);
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
	assert.equal(resolveTimetableRouteView('/timetable/runs'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/exports'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/anything-else'), 'schedule');
});

// --- Row 2: selection-dependent panes are honest ---

test('UX-R03b row 2: manual-edit without a selection shows a truthful empty state', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	const withEntry = center.indexOf("centerView === 'manual-edit' && selectedEntry");
	const emptyOnly = center.indexOf(") : centerView === 'manual-edit' ? (");
	assert.ok(withEntry >= 0, 'the manual-edit pane must still require a selection');
	assert.ok(emptyOnly > withEntry, 'the empty state must follow the with-entry branch');
	const block = center.slice(emptyOnly, center.indexOf(") : centerView === 'map' ? (", emptyOnly));
	assert.match(block, /data-testid="timetable-manual-edit-empty-state"/);
	assert.match(block, /No class selected for manual edit/);
	// The copy names how to reach the pane: the schedule grid + selection actions.
	assert.match(block, /schedule grid/);
	assert.match(block, /Move, Change room, or Swap/);
	// The way back is a guarded view change, never a fabricated selection.
	assert.match(block, /setCenterView\('schedule'\)/);
	assert.doesNotMatch(block, /setSelectedEntry/);
	assert.doesNotMatch(block, /selectedEntry\s*=/);
});

test('UX-R03b row 2: building without a selection shows a truthful empty state', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	const withBuilding = center.indexOf("centerView === 'building' && selectedMapBuilding");
	const emptyOnly = center.indexOf(") : centerView === 'building' ? (");
	assert.ok(withBuilding >= 0, 'the building pane must still require a selection');
	assert.ok(emptyOnly > withBuilding, 'the empty state must follow the with-building branch');
	const block = center.slice(emptyOnly, center.indexOf(") : presentationMode === 'matrix'", emptyOnly));
	assert.match(block, /data-testid="timetable-building-empty-state"/);
	assert.match(block, /No building selected/);
	// The copy names how to reach the pane: the map + building selection.
	assert.match(block, /Open the map and select a building/);
	// The way back is a guarded view change, never a fabricated building.
	assert.match(block, /setCenterView\('map'\)/);
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
	assert.match(workspace, /enterPreGenerationView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('pre-generation'\)\}/);
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
	assert.match(sync, /\}, \[pathname\]\);/);
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
	assert.match(block, /\{ path: 'map' \}/);
	const app = source('src/App.tsx');
	// The standalone campus editor page stays where it is: same import, same route.
	assert.match(app, /const MapEditor = lazy\(\(\) => import\('\.\/pages\/MapEditor'\)\);/);
	assert.match(app, /\{\s*path: 'map',\s*element: <MapEditor \/>,\s*\}/);
	// Exactly one link path per surface: no timetable surface links at the editor.
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	const syncFile = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.doesNotMatch(center, /to="\/map"/);
	assert.doesNotMatch(syncFile, /to="\/map"/);
});

// --- Row 7: layout and primitives ---

test('UX-R03b row 7: the new empty states add no scroll surface, select, raw button, or sub-12px chrome', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	for (const testid of ['timetable-manual-edit-empty-state', 'timetable-building-empty-state']) {
		const anchor = center.indexOf(testid);
		assert.ok(anchor >= 0, `${testid} must exist`);
		const blockStart = center.lastIndexOf('<motion.div', anchor);
		const blockEnd = center.indexOf('</motion.div>', anchor);
		assert.ok(blockStart >= 0 && blockEnd > blockStart, `${testid} block must be bounded`);
		const block = center.slice(blockStart, blockEnd);
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

// --- Row 8: nothing is lost ---

test('UX-R03b row 8: the four views stay reachable with unchanged Generate/Publish/Preview/Sync call sites', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
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
	assert.match(simple, /Preview demand/);
	const drift = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(drift, /Sync with setup/);
	assert.match(drift, /timetable-simple-sync-setup/);
});
