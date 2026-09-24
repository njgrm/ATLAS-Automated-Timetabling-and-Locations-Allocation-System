import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimplePublishedState, readinessLabel } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { resetSimpleWorkspaceFilters } from '@/components/timetable/simple/SimpleHeaderHelpers';
import { deriveSimpleLifecycleAction } from '@/lib/simple-timetable-state';
import { resolveTimetableLoadingIntent } from '@/components/timetable/timetable-route-loading-intent';
import { simpleSetupGuidance } from '@/components/timetable/TimetableSetupPane';

const clientRoot = resolve(import.meta.dirname, '../../..');
const source = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

function context(overrides: Record<string, unknown> = {}) {
	return {
		isPreGenerationWorkspace: false,
		schoolYearContext: { activeSchoolYearLabel: '2030-2031' },
		draft: null,
		summary: null,
		blockingHardCount: 0,
		softCount: 0,
		programFilter: 'all',
		entryKindFilter: 'all',
		severityFilter: 'all',
		...overrides,
	} as never;
}

test('Simple lifecycle labels describe the schedule and next action in plain language', () => {
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true })), 'Working schedule draft');
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true, curriculumReadiness: { state: 'loading', message: 'technical diagnostic' } })), 'Checking schedule information…');
	assert.equal(readinessLabel(context({ isPreGenerationWorkspace: true, curriculumReadiness: { state: 'failed', message: 'technical diagnostic' } })), 'Schedule check needs retry');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.title, 'Check schedule information');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.message,
		'ATLAS is checking the school year and schedule information. No changes are made by this check.');
	const published = renderToStaticMarkup(createElement(SimplePublishedState, { followUpCount: 0 }));
	assert.match(published, /Published schedule — view only/);
	assert.doesNotMatch(published, /Published — read only/);
	assert.match(source('src/components/timetable/simple/SimpleDriftBanner.tsx'), /Schedule information changed/);
	assert.match(source('src/lib/simple-timetable-state.ts'), /Checking schedule information…/);
});

test('entering the Simple workspace clears old grid filters without deleting filter behavior elsewhere', () => {
	const cleared: string[] = [];
	resetSimpleWorkspaceFilters({
		programFilter: 'special',
		entryKindFilter: 'subject',
		severityFilter: 'hard',
		setProgramFilter: (value: string) => cleared.push(`program:${value}`),
		setEntryKindFilter: (value: string) => cleared.push(`entry:${value}`),
		setSeverityFilter: (value: string) => cleared.push(`attention:${value}`),
	} as never);
	assert.deepEqual(cleared, ['program:all', 'entry:all', 'attention:all']);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /resetSimpleWorkspaceFilters\(context\)/);
	assert.doesNotMatch(header, /SimpleFilterControls|SimpleActiveFilterChips/);
	const workspaceState = source('src/hooks/useScheduleReviewWorkspaceState.ts');
	assert.match(workspaceState, /const \[programFilter, setProgramFilter\] = useState/);
	assert.match(workspaceState, /const \[entryKindFilter, setEntryKindFilter\] = useState/);
	assert.match(workspaceState, /const \[severityFilter, setSeverityFilter\] = useState/,
		'underlying review filtering remains available outside Simple header controls');
});

test('the 1366px header wraps intentionally instead of scrolling a one-line strip', () => {
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	const row = header.match(/className="([^"]+)"\s+data-testid="timetable-simple-header-row"/)?.[1] ?? '';
	assert.match(row, /flex-col/);
	assert.doesNotMatch(row, /wide:flex-row|wide:flex-nowrap|overflow-x-auto/);
	assert.match(header, /className="flex min-w-0 flex-wrap items-center gap-1\.5"/);
	assert.doesNotMatch(header, /justify-start gap-1\.5 overflow-x-auto/);
});

test('timetable scroll regions use thin primary-token scrollbars in both browser engines', () => {
	const css = source('src/index.css');
	assert.match(css, /\.scrollbar-thin\s*\{\s*scrollbar-width:\s*thin;/);
	assert.match(css, /scrollbar-color:\s*hsl\(var\(--primary\)\)/);
	assert.match(css, /\.scrollbar-thin::-webkit-scrollbar\s*\{\s*height:\s*6px;\s*width:\s*6px;/);
	assert.doesNotMatch(css, /\.scrollbar-thin\s*\{\s*scrollbar-width:\s*auto;/);
});

test('readiness remains fail-closed while checking and becomes an actionable retry on failure', () => {
	const checking = deriveSimpleLifecycleAction({
		hasGeneratedRun: false,
		isPreGeneration: true,
		curriculumState: 'loading',
	});
	assert.equal(checking.kind, 'retry-readiness');
	assert.equal(checking.disabled, true);
	assert.equal(checking.interactive, false);
	assert.equal(checking.label, 'Checking schedule information…');
	for (const state of ['failed', 'unavailable'] as const) {
		const retry = deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true, curriculumState: state });
		assert.equal(retry.kind, 'retry-readiness');
		assert.equal(retry.label, 'Retry schedule check');
		assert.equal(retry.disabled, false);
		assert.equal(retry.interactive, true);
	}
	assert.equal(deriveSimpleLifecycleAction({ hasGeneratedRun: false, isPreGeneration: true, curriculumState: 'loading' }).kind, 'retry-readiness');
});

test('setup guidance names what ATLAS found and the next safe step without claiming a change', () => {
	assert.match(simpleSetupGuidance({ state: 'loading' }), /ATLAS is checking schedule information/);
	assert.match(simpleSetupGuidance({ state: 'blocked' }), /Open Review readiness/);
	assert.match(simpleSetupGuidance({ state: 'failed' }), /Retry schedule check/);
	assert.match(simpleSetupGuidance({ state: 'ready' }), /ATLAS checked the schedule information/);
	for (const state of ['loading', 'blocked', 'failed', 'ready'] as const) {
		assert.doesNotMatch(simpleSetupGuidance({ state }), /updated|changed to/);
	}
});
