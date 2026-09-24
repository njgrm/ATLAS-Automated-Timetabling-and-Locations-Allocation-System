import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { ScheduleReviewWorkspaceHeaderContext } from '@/components/timetable/buildScheduleReviewWorkspaceContexts';
import { SimpleFilterControls, resolveActiveSimpleFilters } from '@/components/timetable/simple/SimpleFilterControls';

const clientRoot = resolve(import.meta.dirname, '../../..');
const readSource = (path: string) => readFileSync(resolve(clientRoot, path), 'utf8');

const PROGRAM_OPTIONS = [
	{ value: 'all', label: 'All programs' },
	{ value: 'special', label: 'Special program' },
] as const;
const ENTRY_KIND_OPTIONS = [
	{ value: 'all', label: 'All entry types' },
	{ value: 'subject', label: 'Subjects only' },
] as const;

test('R02 resolves truthful active-filter labels and keeps unknown values visible', () => {
	assert.deepEqual(resolveActiveSimpleFilters({
		programFilter: 'all',
		entryKindFilter: 'all',
		severityFilter: 'all',
		programOptions: PROGRAM_OPTIONS,
		entryKindOptions: ENTRY_KIND_OPTIONS,
	}), []);

	assert.deepEqual(resolveActiveSimpleFilters({
		programFilter: 'special',
		entryKindFilter: 'subject',
		severityFilter: 'hard',
		programOptions: PROGRAM_OPTIONS,
		entryKindOptions: ENTRY_KIND_OPTIONS,
	}), [
		{ key: 'program', label: 'Special program' },
		{ key: 'entry-kind', label: 'Subjects only' },
		{ key: 'attention', label: 'Hard blockers' },
	]);

	assert.deepEqual(resolveActiveSimpleFilters({
		programFilter: 'future-program',
		entryKindFilter: 'all',
		severityFilter: 'future-attention',
		programOptions: PROGRAM_OPTIONS,
		entryKindOptions: ENTRY_KIND_OPTIONS,
	}), [
		{ key: 'program', label: 'future-program' },
		{ key: 'attention', label: 'future-attention' },
	]);
});

test('R02 renders the visible filter trigger, count, and removable active chips', () => {
	const context = {
		programFilter: 'special',
		entryKindFilter: 'subject',
		severityFilter: 'hard',
		PROGRAM_FILTER_OPTIONS: PROGRAM_OPTIONS,
		ENTRY_KIND_FILTER_OPTIONS: ENTRY_KIND_OPTIONS,
		setProgramFilter: () => {},
		setEntryKindFilter: () => {},
		setSeverityFilter: () => {},
	} as unknown as ScheduleReviewWorkspaceHeaderContext;

	const markup = renderToStaticMarkup(createElement(SimpleFilterControls, { context }));
	assert.match(markup, /data-testid="timetable-filters-trigger"/);
	assert.match(markup, /aria-label="Filters, 3 active"/);
	assert.match(markup, /data-testid="timetable-active-filter-count"[^>]*>3</);
	assert.match(markup, /Special program/);
	assert.match(markup, /Subjects only/);
	assert.match(markup, /Hard blockers/);
	assert.match(markup, /Remove Special program filter/);
	assert.match(markup, /Clear all/);
});

test('Simple header exposes no filters and More no longer duplicates filters or help', () => {
	const header = readSource('src/components/timetable/TimetableSimpleHeader.tsx');
	const menu = readSource('src/components/timetable/simple/SimpleMoreMenuContent.tsx');
	const controls = readSource('src/components/timetable/simple/SimpleFilterControls.tsx');

	assert.doesNotMatch(header, /SimpleFilterControls|SimpleActiveFilterChips/);
	assert.match(header, /resetSimpleWorkspaceFilters\(context\)/);
	assert.doesNotMatch(menu, />Filters</);
	assert.doesNotMatch(menu, />Tutorial</);
	assert.doesNotMatch(menu, />Status key</);
	assert.doesNotMatch(menu, /How this works/);
	assert.doesNotMatch(controls, /<select\b/);
	// C5 — the two mutually exclusive NEXT STEP task-prompt blocks collapsed into
	// the single lifecycle action control; no separate task-prompt band remains.
	assert.equal((header.match(/data-testid="timetable-simple-task-prompt"/g) ?? []).length, 0);
	assert.match(header, /data-testid="timetable-simple-primary-action"/);
});

test('R02 Simple timetable chrome does not use typography below the 12px floor', () => {
	for (const path of [
		'src/components/timetable/TimetableSimpleHeader.tsx',
		'src/components/timetable/ScheduleReviewWorkspace.tsx',
		'src/components/timetable/simple/SimpleBeneficiaryControls.tsx',
		'src/components/timetable/simple/SimpleDriftBanner.tsx',
		'src/components/timetable/simple/SimpleHeaderHelpers.tsx',
		'src/components/timetable/simple/SimpleMoreMenuContent.tsx',
		'src/components/timetable/simple/SimpleFilterControls.tsx',
	]) {
		const source = readSource(path);
		for (const match of source.matchAll(/text-\[([0-9.]+)rem\]/g)) {
			assert.ok(Number(match[1]) >= 0.75, `${path} contains ${match[0]}, below the 12px floor`);
		}
	}
});
