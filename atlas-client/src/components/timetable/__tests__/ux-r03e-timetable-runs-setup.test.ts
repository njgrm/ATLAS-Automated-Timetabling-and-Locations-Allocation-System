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
	// UX-R03e (setup) — setup is a real routed sub-page now.
	assert.equal(resolveTimetableRouteView('/timetable/setup'), 'setup');
	assert.equal(resolveTimetableRouteView('/timetable/setup/'), 'setup');
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

test('UX-R03e runs: its touched component files stay under the 1000-line cap', () => {
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

// --- UX-R03e (setup) row 2: the setup route is wired in both mapping directions ---

test('UX-R03e setup row 2: view↔route round-trips for the setup view', () => {
	assert.equal(resolveTimetableRouteForView('setup'), '/timetable/setup');
	assert.equal(resolveTimetableRouteView(resolveTimetableRouteForView('setup')), 'setup');
	assert.equal(resolveUrlRestoreTarget('/timetable/setup', 'setup'), null);
	assert.equal(resolveUrlRestoreTarget('/timetable', 'setup'), '/timetable/setup');
});

test('UX-R03e setup row 2: every route direction passes through the existing guarded setter', () => {
	const sync = source('src/components/timetable/TimetableRouteViewSync.tsx');
	assert.match(sync, /guarded\(enterSetup\)/);
	assert.doesNotMatch(sync, /setCenterView/);
	const workspace = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(workspace, /enterSetupView=\{\(\) => state\.centerWorkspaceContext\.setCenterView\('setup'\)\}/);
});

// --- UX-R03e (setup) row 2: App.tsx child, CenterWorkspace view, chrome override ---

test('UX-R03e setup row 2: setup is an element-less nested child (shell stays mounted)', () => {
	const block = timetableRouteBlock();
	assert.match(block, /\{ path: 'setup' \}/);
	assert.doesNotMatch(block, /path: 'setup', element:/);
	assert.doesNotMatch(block, /path: 'timetable\/setup'/);
});

test('UX-R03e setup row 2: CenterWorkspace renders the setup pane from threaded setup inputs', () => {
	const center = source('src/components/timetable/CenterWorkspace.tsx');
	assert.match(center, /centerView === 'setup'/);
	assert.match(center, /<TimetableSetupPane/);
	assert.match(center, /inputs=\{setupInputs\}/);
	assert.match(center, /sectionLabel=\{sectionLabel\}/);
	assert.match(center, /subjectLabel=\{subjectLabel\}/);
	assert.match(center, /facultyLabel=\{facultyLabel\}/);
	assert.match(center, /onStartSimpleTask=\{setupOnStartTask\}/);
	assert.match(center, /onSetRepairOrigin=\{setupOnSetRepairOrigin\}/);
	// The hook binds the same state the Simple header consumes; the two
	// component-scoped callbacks arrive through the body, not the hook.
	const state = readFileSync(resolve(repoRoot, 'atlas-client/src/hooks/useScheduleReviewWorkspaceState.ts'), 'utf8');
	for (const field of [
		'setupInputs: { schoolId, schoolYearId, activeGeneratedRunId, draft',
		'onRefresh: handleRefresh, onRefreshSetupNames: refreshReferenceLabels',
		'curriculumReadiness, hasSelectedEntry',
		'blockingHardCount, softCount, summary, violations, schoolYearContext',
		'setLeftTab, setPresentationMode: handlePresentationModeChange',
		'setUnassignedReasonFilter, setSelectedViolation, setSeverityFilter',
	]) {
		assert.ok(state.includes(field), `the hook must thread '${field}' into setupInputs`);
	}
	const body = source('src/components/timetable/ScheduleReviewWorkspaceBody.tsx');
	assert.match(body, /setupOnStartTask=\{onSimpleTaskChange\}/);
	assert.match(body, /setupOnSetRepairOrigin=\{onSetupSetRepairOrigin \?\? null\}/);
	const shell = source('src/components/timetable/ScheduleReviewWorkspace.tsx');
	assert.match(shell, /onSetupSetRepairOrigin=\{setRepairOrigin\}/);
});

test('UX-R03e setup row 2: the setup route resolves shell chrome instead of the ATLAS fallback', () => {
	const chrome = resolveRouteChrome('/timetable/setup');
	assert.equal(chrome.title, 'Setup');
	assert.deepEqual(chrome.breadcrumbs, ['Class Schedule', 'Setup']);
});

// --- UX-R03e (setup) row 2: the pane composes the named existing controls ---

test('UX-R03e setup row 2: the pane renders the drift banner directly with no second sync handler', () => {
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.match(pane, /<SimpleDriftBanner/);
	assert.match(pane, /data-testid="timetable-setup-pane"/);
	// Strip doc comments: the honesty note names the shared unit to say it is
	// reused, not duplicated. The code must contain no second sync handler.
	const code = pane.replace(/\/\*[\s\S]*?\*\//g, '');
	assert.doesNotMatch(code, /handleSyncSetup|runSyncSetup|createSyncSetupInFlightGuard/);
	const banner = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(banner, /runSyncSetup/);
	assert.match(banner, /createSyncSetupInFlightGuard/);
	// The header keeps its own drift entry point.
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<SimpleDriftBanner/);
});

test('UX-R03e setup row 2: header and pane share one readiness-chip implementation', () => {
	const shared = source('src/components/timetable/simple/SimpleSetupSharedControls.tsx');
	assert.match(shared, /export function resolveSimpleReadiness/);
	assert.match(shared, /export function SimpleReadinessChip/);
	assert.match(shared, /data-testid="timetable-simple-readiness-chip"/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<SimpleReadinessChip/);
	assert.match(header, /resolveSimpleReadiness\(/);
	// The inline chip JSX is gone from the header: the testid lives in the
	// shared module now, and the header keeps its readiness consumers.
	assert.doesNotMatch(header, /timetable-simple-readiness-chip/);
	assert.match(header, /publishBlockedReason/);
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.match(pane, /<SimpleReadinessChip/);
	assert.match(pane, /resolveSimpleReadiness\(/);
	// The label derivation itself is untouched in its home module.
	const helpers = source('src/components/timetable/simple/SimpleHeaderHelpers.tsx');
	assert.match(helpers, /export function readinessLabel/);
});

test('UX-R03e setup row 2: header menu and pane share one refresh implementation', () => {
	const shared = source('src/components/timetable/simple/SimpleSetupSharedControls.tsx');
	assert.match(shared, /export function RefreshSetupNamesButton/);
	assert.match(shared, /data-testid="timetable-refresh-setup-names"/);
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /<RefreshSetupNamesButton/);
	assert.match(menu, /onRefreshNames=\{\(\) => \{ onClose\(\); context\.refreshReferenceLabels\(\); \}\}/);
	// The inline refresh button is gone from the menu: the testid lives in the
	// shared module now, and the menu keeps its refresh entry point.
	assert.doesNotMatch(menu, /timetable-refresh-setup-names/);
	assert.match(menu, /refreshReferenceLabels/);
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.match(pane, /<RefreshSetupNamesButton/);
	assert.match(pane, /onRefreshSetupNames/);
});

test('UX-R03e setup row 2: header sheet and pane sheet share one repair dispatch', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /<SimplePublishReadinessSheet/);
	assert.match(header, /export function dispatchSimpleReadinessRepair/);
	assert.match(header, /resolveBlockerDestination\(reason, href\)/);
	assert.match(header, /dispatchSimpleReadinessRepair\(\{/);
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.match(pane, /<SimplePublishReadinessSheet/);
	// The pane shares the dispatcher's canonical home (the header module):
	// one implementation, no fork, no second dispatch body in the pane.
	assert.match(pane, /import \{ dispatchSimpleReadinessRepair \} from '@\/components\/timetable\/TimetableSimpleHeader'/);
	assert.match(pane, /dispatchSimpleReadinessRepair\(\{/);
	assert.doesNotMatch(pane.replace(/\/\*[\s\S]*?\*\//g, ''), /resolveBlockerDestination\(reason, href\)/);
	// Same sheet content inputs in both places: draft, violations, labels, run-wide counts.
	for (const prop of ['draft={', 'violations={', 'sectionLabel={', 'subjectLabel={', 'facultyLabel={', 'blockingHardCount:', 'unassignedCount:', 'softCount:']) {
		assert.ok(header.includes(prop), `the header sheet must keep '${prop}'`);
		assert.ok(pane.includes(prop), `the pane sheet must use '${prop}'`);
	}
});

// --- UX-R03e (setup) row 3: every existing entry point keeps working ---

test('UX-R03e setup row 3: header, menu, and banner entry points are preserved', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /handleTriggerGenerate/);
	assert.match(header, /SimpleGenerateAction/);
	assert.match(header, /SimplePublishAction/);
	assert.match(header, /Preview demand/);
	assert.match(header, /data-testid="timetable-simple-more-trigger"/);
	const menu = source('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	assert.match(menu, /data-testid="timetable-more-policy"/);
	assert.match(menu, /Refresh timetable/);
	const banner = source('src/components/timetable/simple/SimpleDriftBanner.tsx');
	assert.match(banner, /Sync with setup/);
	assert.match(banner, /timetable-simple-sync-setup/);
});

// --- UX-R03e (setup): no new behaviour, no new data path ---

test('UX-R03e setup: the pane dispatches no data requests and sets no view state', () => {
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	const code = pane.replace(/\/\*[\s\S]*?\*\//g, '');
	assert.doesNotMatch(code, /fetch\(|atlasApi|axios|useQuery|useMutation|XMLHttpRequest/);
	assert.doesNotMatch(code, /handleTriggerGenerate|SimplePublishAction|Delete/);
	assert.doesNotMatch(code, /setCenterView/);
	// Way-backs navigate so the URL matches the shown view, like every other pane.
	assert.match(code, /<Link to="\/timetable">/);
	// Capabilities mirror the header derivation from the same inputs (no forked gate).
	assert.match(code, /deriveTimetableCapabilities\(/);
	assert.match(code, /summarizeGenerationReadiness\(/);
	assert.match(code, /isRunPublishedStrict\(/);
});

test('UX-R03e setup: the pane adds no native select, raw button, or sub-12px chrome', () => {
	const pane = source('src/components/timetable/TimetableSetupPane.tsx');
	assert.doesNotMatch(pane, /<select\b/);
	assert.doesNotMatch(pane, /<button[\s>]/);
	assert.doesNotMatch(pane, /title="/);
	assert.doesNotMatch(pane, /<details\b/);
	for (const match of pane.matchAll(/text-\[([0-9.]+)rem\]/g)) {
		assert.ok(Number(match[1]) >= 0.75, `setup pane contains ${match[0]}, below the 12px floor`);
	}
});

test('UX-R03e setup: the new test file is wired into the committed route-keys script', () => {
	const pkg = JSON.parse(readFileSync(resolve(clientRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
	const script = pkg.scripts['test:timetable-route-keys'];
	assert.ok(script.includes('src/components/timetable/__tests__/ux-r03e-timetable-runs-setup.test.ts'), 'the new suite must run in the committed script');
});

test('UX-R03e setup: every touched component file stays under the 1000-line cap', () => {
	for (const path of [
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
		'src/components/timetable/simple/SimpleSetupSharedControls.tsx',
		'src/components/timetable/TimetableSetupPane.tsx',
		'src/components/timetable/ScheduleReviewWorkspaceBody.tsx',
		'src/components/timetable/CenterWorkspace.tsx',
	]) {
		const lines = lineCount(path);
		assert.ok(lines <= 1000, `${path} has ${lines} lines, over the 1000-line cap`);
	}
});
