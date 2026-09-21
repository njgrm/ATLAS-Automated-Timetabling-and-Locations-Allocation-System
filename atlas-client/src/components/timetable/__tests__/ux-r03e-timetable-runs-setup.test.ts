import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import {
	resolveTimetableRouteForView,
	resolveTimetableRouteView,
	resolveUrlRestoreTarget,
} from '../TimetableRouteViewSync';
import { resolveRouteChrome } from '../../app-shell/navigation';

const clientRoot = resolve(import.meta.dirname, '../../../..');
const repoRoot = resolve(clientRoot, '..');
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

// --- UX-R03e (runs) row 1: the runs route is wired in both mapping directions ---

test('UX-R03e runs row 1: /timetable/runs resolves to its own center view, with trailing-slash parity', () => {
	assert.equal(resolveTimetableRouteView('/timetable/runs'), 'runs');
	assert.equal(resolveTimetableRouteView('/timetable/runs/'), 'runs');
	// Setup stays deferred in the runs checkpoint: still the schedule surface.
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'schedule');
	assert.equal(resolveTimetableRouteView('/timetable/anything-else'), 'schedule');
});

test('UX-R03e runs row 1: view↔route round-trips for the runs view', () => {
	assert.equal(resolveTimetableRouteForView('runs'), '/timetable/runs');
	assert.equal(resolveTimetableRouteView(resolveTimetableRouteForView('runs')), 'runs');
	assert.equal(resolveUrlRestoreTarget('/timetable/runs', 'runs'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable', 'runs'), '/timetable/runs');
});

test('UX-R03e runs row 1: every route direction passes through the existing guarded setter', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /guarded\(enterRuns\)/);
	assert.doesNotMatch(sync, /setCenterView/);
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /enterRunsView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('runs'\)\}/);
});

// --- UX-R03e (runs) row 1: App.tsx child, CenterWorkspace view, chrome override ---

test('UX-R03e runs row 1: runs is an element-less nested child (shell stays mounted)', () => {
	const block = timetableRouteBlock();
	assert.match(block, /\{ path: 'runs' \}/);
	assert.doesNotMatch(block, /path: 'runs', element:/);
	assert.doesNotMatch(block, /path: 'timetable\/runs'/);
});

test('UX-R03e runs row 1: CenterWorkspace renders the runs pane from threaded run-selection state', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /centerView === 'runs'/);
	assert.match(center, /<TimetableRunsPane/);
	assert.match(center, /runs=\{runs\}/);
	assert.match(center, /selectedRunId=\{runsSelectedId\}/);
	assert.match(center, /onSelectRun=\{onRunsSelect\}/);
	const state = readFileSync(resolve(repoRoot, 'atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts'), 'utf8');
	assert.match(state, /runsSelectedId: selectedRunId/);
	assert.match(state, /onRunsSelect: handleRunChange/);
});

test('UX-R03e runs row 1: the runs route resolves shell chrome instead of the ATLAS fallback', () => {
	const chrome = resolveRouteChrome('/timetable/runs');
	assert.equal(chrome.title, 'Runs');
	assert.deepEqual(chrome.breadcrumbs, ['Class Schedule', 'Runs']);
});

// --- UX-R03e (runs) row 1: the list renders from the existing endpoint, read-only ---

test('UX-R03e runs row 1: the pane renders endpoint fields with the existing selection, and no mutation', () => {
	const pane = source('src/components/timetable/TimetableRunsPane.tsx');
	// Strip doc comments: the honesty note names `summary` to say it is absent.
	const code = pane.replace(/\/\*[\s\S]*?\*\//g, '');
	// Only fields the list endpoint returns (listRuns select): no summary, no
	// published/blocker claims, no invented fields.
	for (const field of ['status', 'createdAt', 'durationMs', 'version', 'runType', 'startedAt', 'finishedAt', 'error']) {
		assert.ok(code.includes(field), `the pane must render the endpoint field '${field}'`);
	}
	assert.doesNotMatch(code, /summary/);
	assert.doesNotMatch(code, /isPublished/);
	// The run-selection mechanism the workspace already uses — not a second path.
	assert.match(code, /onSelectRun\(String\(run\.id\)\)/);
	assert.match(code, /to="\/timetable"/);
	// Read-only: no generation, publication, delete, or data request.
	assert.doesNotMatch(code, /fetch\(|atlasApi|axios|useQuery|useMutation|XMLHttpRequest/);
	assert.doesNotMatch(code, /handleTriggerGenerate|Generate schedule|Publish|Published|Delete|delete/);
	assert.doesNotMatch(code, /handleSyncSetup|runSyncSetup/);
});

test('UX-R03e runs row 1: the pane honors the endpoint response shape', () => {
	const router = readFileSync(resolve(repoRoot, 'atlas-server/src/routes/generation.router.ts'), 'utf8');
	assert.match(router, /\/:schoolId\/:schoolYearId\/runs/);
	assert.match(router, /genService\.listRuns/);
	assert.match(router, /res\.json\(\{ runs, count/);
	const service = readFileSync(resolve(repoRoot, 'atlas-server/src/services/generation.service.ts'), 'utf8');
	const listStart = service.indexOf('export async function listRuns');
	assert.ok(listStart >= 0, 'listRuns must exist');
	const listBlock = service.slice(listStart, service.indexOf('}', service.indexOf('updatedAt: true')) + 1);
	for (const field of ['id:', 'status:', 'runType:', 'triggeredBy:', 'startedAt:', 'finishedAt:', 'durationMs:', 'error:', 'version:', 'createdAt:', 'updatedAt:']) {
		assert.ok(listBlock.includes(field), `listRuns must select '${field}'`);
	}
	assert.doesNotMatch(listBlock, /summary/);
});

// --- UX-R03e (runs): layout and primitives ---

test('UX-R03e runs: the pane adds no native select, raw button, or sub-12px chrome', () => {
	const pane = source('src/components/timetable/TimetableRunsPane.tsx');
	assert.doesNotMatch(pane, /<select\b/);
	assert.doesNotMatch(pane, /<button[\s>]/);
	assert.doesNotMatch(pane, /title="/);
	assert.doesNotMatch(pane, /<details\b/);
	for (const match of pane.matchAll(/text-\[([0-9.]+)rem\]/g)) {
		assert.ok(Number(match[1]) >= 0.75, `runs pane contains ${match[0]}, below the 12px floor`);
	}
});

test('UX-R03e runs: every touched component file stays under the 1000-line cap', () => {
	for (const path of [
		'src/App.tsx',
		'src/components/timetable/TimetableRouteViewSync.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/CenterWorkspace.tsx',
		'src/components/timetable/TimetableRunsPane.tsx',
		'src/components/app-shell/navigation.ts',
	]) {
		const lines = lineCount(path);
		assert.ok(lines <= 1000, `${path} has ${lines} lines, over the 1000-line cap`);
	}
});
