import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { resolveTimetableRouteView } from '../TimetableRouteViewSync';
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
	assert.match(block, /\{ index: true \}/);
	assert.match(block, /\{ path: 'policies' \}/);
	// The index and policies children are element-less: they render nothing into
	// the Outlet, so the workspace shell above them never unmounts.
	assert.doesNotMatch(block, /\{ index: true, element:/);
	assert.doesNotMatch(block, /path: 'policies', element:/);
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
	assert.equal(resolveTimetableRouteView('/timetable/runs'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/exports'), 'schedule');
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
	assert.match(block, /Scheduling policy \(Advanced\)/);
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
	// The Advanced header policy entry keeps its guarded in-place transition.
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
