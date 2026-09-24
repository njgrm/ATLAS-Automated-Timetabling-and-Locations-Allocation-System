import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { resolveTimetableLoadingIntent } from '../timetable-route-loading-intent';

const root = resolve(import.meta.dirname, '../../../');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

test('direct timetable lifecycle routes resolve their bounded loading copy', () => {
	assert.equal(resolveTimetableLoadingIntent('/timetable/pre-generation')?.title, 'Draft queue');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.title, 'Check schedule information');
	assert.equal(resolveTimetableLoadingIntent('/timetable/policies')?.title, 'Scheduling policies');
	assert.equal(resolveTimetableLoadingIntent('/timetable/runs')?.title, 'Generation history');
	assert.equal(resolveTimetableLoadingIntent('/timetable/exports'), null, 'legacy exports redirects into the schedule shell instead of a duplicate loading page');
	assert.equal(resolveTimetableLoadingIntent('/timetable'), null, 'the generic schedule keeps the standard skeleton');
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
	assert.match(controls, /<PopoverContent[^>]+data-testid="timetable-simple-filters-popover-content"/);
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
