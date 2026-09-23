import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../../');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('direct timetable lifecycle routes retain route-specific intent while the latest run is loading', () => {
	const workspace = source('components/timetable/ScheduleReviewWorkspace.tsx');
	const loadingGate = workspace.match(/if \(state\.loading && !state\.draft\) \{[\s\S]*?\n\t\}/)?.[0] ?? '';
	assert.ok(loadingGate, 'the no-draft loading gate must remain explicit');
	assert.match(loadingGate, /resolveTimetableLoadingIntent\(location\.pathname\)/);
	assert.match(loadingGate, /TimetableRouteLoadingState/);
	assert.ok(loadingGate.indexOf('if (routeIntent) return <TimetableRouteLoadingState') < loadingGate.indexOf('return <TimetableSkeleton'),
		'route-specific state must precede the generic fallback');

	const routeSync = source('components/timetable/TimetableRouteViewSync.tsx');
	for (const [path, view] of [
		['/timetable/pre-generation', 'pre-generation'],
		['/timetable/setup', 'setup'],
		['/timetable/policies', 'policy'],
		['/timetable/runs', 'runs'],
		['/timetable/exports', 'exports'],
	]) {
		assert.match(routeSync, new RegExp(`case '${view}':[\\s\\S]*?guarded\\(enter`));
		assert.ok(routeSync.includes(path), `${path} must retain a route-specific loading surface`);
	}
	assert.doesNotMatch(loadingGate, /loadAll\(|fetch\(|atlasApi/,
		'route-specific loading feedback must not bypass actor/year/term dispatch gates');
});

test('pending session verification uses neutral shell identity instead of Guest', () => {
	const shell = source('components/AppShell.tsx');
	const sidebar = source('components/app-shell/AppSidebar.tsx');
	assert.match(shell, /sessionVerificationState/);
	assert.match(shell, /sessionVerificationState=\{sessionVerificationState\}/);
	assert.match(sidebar, /sessionVerificationState === 'verifying' \? 'Verifying session…' : bridgeUser\?\.role \?\? 'Guest'/);
	assert.match(shell, /setSessionVerificationState\('verifying'\)/);
	assert.match(shell, /setSessionVerificationState\('authenticated'\)/);
	assert.match(shell, /setSessionVerificationState\('unauthenticated'\)/);
});

test('desktop timetable controls keep view and searchable entity in the header with refinements anchored nearby', () => {
	const controls = source('components/timetable/simple/SimpleFilterControls.tsx');
	const schedule = source('components/timetable/simple/SimpleHeaderHelpers.tsx');
	const header = source('components/timetable/TimetableSimpleHeader.tsx');
	assert.match(controls, /from ['"]@\/ui\/popover['"]/);
	assert.match(controls, /<PopoverTrigger asChild>/);
	assert.match(controls, /<PopoverContent[^>]+data-testid="timetable-simple-filters-popover"/);
	assert.match(controls, /<SheetTrigger asChild>/);
	assert.match(controls, /data-testid="timetable-filters-mobile-trigger"/);
	assert.doesNotMatch(controls, /@\/ui\/dialog/);
	assert.match(controls, /timetable-active-filter-count/);
	assert.match(controls, /Remove \$\{filter\.label\} filter/);
	assert.match(schedule, /data-testid="timetable-simple-view-mode-select"/);
	assert.match(schedule, /<SearchableSelect/);
	assert.match(schedule, /View type/);
	assert.match(schedule, /className="[^"]*lg:hidden"/);
	assert.match(header, /hidden min-w-0 flex-1 lg:flex[^\"]*/);
	assert.doesNotMatch(header, /wide:hidden/);
});
