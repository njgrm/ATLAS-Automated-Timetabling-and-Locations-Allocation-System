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
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.title, 'Check schedule information');
	assert.equal(resolveTimetableLoadingIntent('/timetable/setup')?.message,
		'ATLAS is checking the school year and schedule information. No changes are made by this check.');
	const published = renderToStaticMarkup(createElement(SimplePublishedState, { followUpCount: 0 }));
	assert.match(published, /Published schedule — view only/);
	assert.doesNotMatch(published, /Published — read only/);
	assert.match(source('components/timetable/simple/SimpleDriftBanner.tsx'), /Schedule information changed since this schedule was generated/);
	assert.match(source('components/timetable/TimetableSimpleHeader.tsx'), /Checking schedule information/);
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
	const header = source('components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /resetSimpleWorkspaceFilters\(context\)/);
	assert.doesNotMatch(header, /SimpleFilterControls|SimpleActiveFilterChips/);
	assert.match(source('components/timetable/simple/SimpleHeaderHelpers.tsx'), /<SimpleFiltersContent context=\{context\} \/>/,
		'underlying review filtering remains available outside Simple header controls');
});

test('the 1366px header wraps intentionally instead of scrolling a one-line strip', () => {
	const header = source('components/timetable/TimetableSimpleHeader.tsx');
	const row = header.match(/data-testid="timetable-simple-header-row"[\s\S]*?className="([^"]+)"/)?.[1] ?? '';
	assert.match(row, /flex-col/);
	assert.doesNotMatch(row, /wide:flex-row|wide:flex-nowrap|overflow-x-auto/);
	assert.match(header, /data-testid="timetable-simple-status-region"[\s\S]*?className="[^"]*flex-wrap/);
	assert.doesNotMatch(header, /justify-start gap-1\.5 overflow-x-auto/);
});

test('timetable scroll regions use thin primary-token scrollbars in both browser engines', () => {
	const css = source('../index.css');
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
