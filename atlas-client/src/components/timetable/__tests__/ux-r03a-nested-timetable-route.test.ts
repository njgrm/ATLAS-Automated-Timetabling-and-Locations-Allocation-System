import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { resolveTimetableRouteForView, resolveTimetableRouteView, resolveUrlRestoreTarget } from '../TimetableRouteViewSync';
import { resolveRouteChrome } from '../../app-shell/navigation';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function lineCount(path: string): number {
	return source(path).split('\n').length;
}

// --- Row 1: routes exist (index + policies share one mounted shell) ---

test('UX-R03a row 1: /timetable mounts the review shell with nested index and policies children', () => {
	const app = source('src/App.tsx');
	const parentStart = app.indexOf("path: 'timetable'");
	assert.ok(parentStart >= 0, 'the timetable route must exist');
	const nextSibling = app.indexOf("path: 'timetabling/how-it-works'", parentStart);
	assert.ok(nextSibling > parentStart, 'the timetable route block must be bounded');
	const block = app.slice(parentStart, nextSibling);
	assert.match(block, /element: <ScheduleReview \/>/);
	assert.match(block, /\{ index: true, element: null \}/);
	assert.match(block, /\{ path: 'policies', element: null \}/);
	// The index and policies children render an explicit `null` element: nothing
	// into the Outlet, so the workspace shell above them never unmounts. The
	// explicit null (vs an element-less child) also clears the router's
	// element-less leaf warning.
	assert.doesNotMatch(block, /\{ index: true \},/);
	assert.doesNotMatch(block, /path: 'policies' \},/);
});

test('UX-R03a row 1: ScheduleReview mounts the workspace once plus an Outlet', () => {
	const page = source('src/pages/ScheduleReview.tsx');
	assert.match(page, /<ScheduleReviewWorkspace \/>/);
	assert.equal((page.match(/<ScheduleReviewWorkspace \/>/g) ?? []).length, 1);
	assert.match(page, /<Outlet \/>/);
});

// --- Row 2: no remount, no request storm (structural; DOM identity needs a browser) ---

test('UX-R03a row 2: child navigations cannot unmount the shell or issue data requests', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	// The sync renders nothing and dispatches no data requests.
	assert.match(sync, /return null;/);
	assert.doesNotMatch(sync, /fetch\(|axios|useQuery|useMutation|XMLHttpRequest/);
	// The only effect is keyed on the pathname, so in-app view changes and
	// re-renders never retrigger it.
	assert.match(sync, /\}, \[pathname\]\);/);
	// No sibling flat timetable/policies route may exist: a sibling would mount
	// a second shell (remount + refetch) instead of reusing the nested one.
	const app = source('src/App.tsx');
	assert.doesNotMatch(app, /path: 'timetable\/policies'/);
});

test('UX-R03a row 2: route to view mapping keeps the schedule surface for every unrouted path', () => {
	assert.equal(resolveTimetableRouteView('/timetable'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/policies'), 'policy');
	assert.equal(resolveTimetableRouteView('/timetable/policies/'), 'policy');
	assert.equal(resolveTimetableRouteView('/timetable/anything-else'), 'schedule');
	// UX-R03e — runs and setup are real routed sub-pages now.
	assert.equal(resolveTimetableRouteView('/timetable/runs'), 'runs');
	assert.equal(resolveTimetableRouteView('/timetable/runs/'), 'runs');
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'setup');
	assert.equal(resolveTimetableRouteView('/timetable/setup/'), 'setup');
	// UX-R03c — exports is a real routed sub-page now; UX-R03e routes runs and setup too.
	assert.equal(resolveTimetableRouteView('/timetable/exports'), 'exports');
});

// --- Row 3: the guard is never bypassed ---

test('UX-R03a row 3: both route directions pass through the existing guarded setter', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /switchCenterViewWithGuard: \(action: \(\) => void\) => void/);
	assert.match(sync, /guarded\(enter\)/);
	assert.match(sync, /guarded\(exit\)/);
	// The sync must never set the view directly: that would bypass the guard.
	assert.doesNotMatch(sync, /setCenterView/);
	// The workspace wires the production guard and policy transitions in.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /<TimetableRouteViewSync/);
	assert.match(workspace, /switchCenterViewWithGuard=\{state\.headerContext\.switchCenterViewWithGuard\}/);
	assert.match(workspace, /enterPolicyView=\{state\.headerContext\.enterPolicyView\}/);
	assert.match(workspace, /exitPolicyView=\{state\.headerContext\.exitPolicyView\}/);
});

// --- Row 3 (F2): a cancelled guard navigation restores the shown view's URL ---
// UX-R03b supersedes the unrouted half of this row: every existing center view
// now has its own route, so each view resolves to that route (the R03a
// contract — index/policies keep working — is preserved below).

test('UX-R03a row 3 F2: every center view resolves to the route that describes it', () => {
	assert.equal(resolveTimetableRouteForView('policy'), '/timetable/policies');
	assert.equal(resolveTimetableRouteForView('schedule'), '/timetable');
	// UX-R03b: the four remaining existing center views have their own routes.
	assert.equal(resolveTimetableRouteForView('pre-generation'), '/timetable/pre-generation');
	assert.equal(resolveTimetableRouteForView('manual-edit'), '/timetable/manual-edit');
	assert.equal(resolveTimetableRouteForView('map'), '/timetable/map');
	assert.equal(resolveTimetableRouteForView('building'), '/timetable/building');
});

test('UX-R03a row 3 F2: accepted navigations need no restore, cancelled ones restore the shown view', () => {
	// Accepted: the confirmed action sets the matching view, so the URL already matches.
	assert.equal(resolveUrlRestoreTarget('/timetable/policies', 'policy'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable', 'schedule'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable/', 'schedule'), null);
	// UX-R03b: each routed view keeps its own URL — no restore needed there either.
	assert.equal(resolveUrlRestoreTarget('/timetable/pre-generation', 'pre-generation'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable/manual-edit', 'manual-edit'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable/map', 'map'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable/building', 'building'), null);
	// Cancelled: the stale URL is replaced with the shown view's route, both directions.
	// UX-R03b: cancelling while on pre-generation restores its own route (this is
	// what closes the R03a double-dialog residual — see the UX-R03b pin test).
	assert.equal(resolveUrlRestoreTarget('/timetable/policies', 'pre-generation'), '/timetable/pre-generation');
	assert.equal(resolveUrlRestoreTarget('/timetable/policies', 'schedule'), '/timetable');
	assert.equal(resolveUrlRestoreTarget('/timetable', 'policy'), '/timetable/policies');
});

test('UX-R03a row 3 F2: the sync restores via replace navigation on guard-dialog close, never by setting view state', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /leaveDialogOpen: boolean/);
	assert.match(sync, /useNavigate/);
	assert.match(sync, /navigate\(target, \{ replace: true \}\)/);
	assert.match(sync, /resolveUrlRestoreTarget\(pathnameRef\.current, centerViewRef\.current\)/);
	// The restore path reads state only: the guard remains the sole view setter.
	assert.doesNotMatch(sync, /setCenterView/);
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /leaveDialogOpen=\{state\.dialogContext\.showLeavePreGenDialog\}/);
});

// --- Row 4: the More menu policy item is a real link ---

test('UX-R03a row 4: the More menu policy item links to the nested policy route', () => {
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /data-testid="timetable-more-policy"/);
	assert.match(menu, /to="\/timetable\/policies"/);
	assert.match(menu, /asChild/);
	assert.doesNotMatch(menu, /requestAnimationFrame/);
	assert.doesNotMatch(menu, /switchCenterViewWithGuard/);
	assert.match(menu, /onLayoutModeChange\('advanced'\)/);
});

test('UX-R03a row 4: the policy item block is a link, not a state dispatch', () => {
	// Radix menu content is client-only (it SSRs to '' even with forceMount),
	// so the item contract is pinned at the source block instead of by markup.
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	const anchor = menu.indexOf('data-testid="timetable-more-policy"');
	assert.ok(anchor >= 0, 'the policy menu item must exist');
	const itemStart = menu.lastIndexOf('<DropdownMenuItem', anchor);
	const itemEnd = menu.indexOf('</DropdownMenuItem>', anchor);
	assert.ok(itemStart >= 0 && itemEnd > itemStart, 'the policy item block must be bounded');
	const block = menu.slice(itemStart, itemEnd);
	assert.match(block, /asChild/);
	assert.match(block, /<Link/);
	assert.match(block, /to="\/timetable\/policies"/);
	assert.match(block, /Scheduling policy \(Expert\)/);
	assert.doesNotMatch(block, /onSelect/);
	assert.doesNotMatch(block, /preventDefault/);
	assert.doesNotMatch(block, /requestAnimationFrame/);
	assert.doesNotMatch(block, /switchCenterViewWithGuard|enterPolicyView/);
});

// --- Row 5: unknown child routes fall back to the index surface ---

test('UX-R03a row 5: unknown timetable children redirect to the index surface', () => {
	const app = source('src/App.tsx');
	const parentStart = app.indexOf("path: 'timetable'");
	const nextSibling = app.indexOf("path: 'timetabling/how-it-works'", parentStart);
	const block = app.slice(parentStart, nextSibling);
	assert.match(block, /\{ path: '\*', element: <Navigate to="\/timetable" replace \/> \}/);
});

// --- Row 6: layout invariants (structural; viewport measurement needs a browser) ---

test('UX-R03a row 6: no new scroll surface, select, raw button, or sub-12px chrome', () => {
	for (const path of [
		'src/components/timetable/TimetableRouteViewSync.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
		'src/pages/ScheduleReview.tsx',
	]) {
		const text = source(path);
		assert.doesNotMatch(text, /<select\b/);
		assert.doesNotMatch(text, /<button[\s>]/);
		assert.doesNotMatch(text, /overflow-auto/);
		assert.doesNotMatch(text, /title="/);
		for (const match of text.matchAll(/text-\[([0-9.]+)rem\]/g)) {
			assert.ok(Number(match[1]) >= 0.75, `${path} contains ${match[0]}, below the 12px floor`);
		}
	}
	// The workspace root keeps the no-scroll architecture.
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /flex flex-col h-\[calc\(100svh-3\.5rem\)\]/);
	// The nested policy route resolves shell chrome instead of the ATLAS fallback.
	const chrome = resolveRouteChrome('/timetable/policies');
	assert.equal(chrome.title, 'Scheduling Policy');
	assert.deepEqual(chrome.breadcrumbs, ['Class Schedule', 'Scheduling Policy']);
});

// --- Row 7: nothing is lost ---

test('UX-R03a row 7: the four unrouted views stay reachable with unchanged behaviour', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	for (const view of ['pre-generation', 'manual-edit', 'map', 'building']) {
		assert.ok(center.includes(`'${view}'`), `center view '${view}' must remain`);
	}
	// The Expert header policy entry keeps its guarded in-place transition.
	const header = source('src/components/timetable/ScheduleReviewWorkspaceHeader.tsx');
	assert.match(header, /switchCenterViewWithGuard\(enterPolicyView\)/);
	// Generate / Publish / Preview impact / Sync with setup handlers are untouched.
	const simple = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(simple, /handleTriggerGenerate/);
	assert.match(simple, /timetable-simple-generate-action|SimpleGenerateAction/);
});

// --- Row 8: the 1000-line component cap holds ---

test('UX-R03a row 8: every touched component file stays under the 1000-line cap', () => {
	for (const path of [
		'src/App.tsx',
		'src/pages/ScheduleReview.tsx',
		'src/components/timetable/TimetableRouteViewSync.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
		'src/components/app-shell/navigation.ts',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/CenterWorkspace.tsx',
	]) {
		const lines = lineCount(path);
		assert.ok(lines <= 1000, `${path} has ${lines} lines, over the 1000-line cap`);
	}
});
