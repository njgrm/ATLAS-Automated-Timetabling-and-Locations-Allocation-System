/**
 * A7 c13 — no text on the Class Schedule is cut off with an ellipsis; it wraps.
 *
 * The screen is read by an older, mouse-first scheduler. Every string exercised
 * here is one they must read to act ("what changed", "which ceremony occupies
 * the slot", "who teaches the class", "what the drawer asks me to confirm"), so
 * a trailing `…` is a defect, not a density choice (AGENTS.md §8).
 *
 * These are STRUCTURAL rows, decided on class tokens: jsdom has no layout engine
 * and cannot measure a line. The declared wrap contract is what is asserted, and
 * the rendered pixel line count is a Lane C browser row.
 *
 * Run: `npm run test:a7-c13-clip`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import { SimpleChangeNotice, changeNoticeSentence } from '../simple/SimpleChangeNotice';
import { TimetableTaskDrawer } from '../TimetableTaskDrawer';
import { GeneratedViolationsPanel } from '../GeneratedRunRailPanels';
import type { LeftRailContentContext } from '../timetableContexts.types';
import type { Violation } from '@/types';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

function classTokens(tag: string): Set<string> {
	const match = tag.match(/class="([^"]*)"/);
	return new Set((match?.[1] ?? '').split(/\s+/).filter(Boolean));
}

function tagFor(markup: string, testid: string): string {
	return markup.match(new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`))?.[0] ?? '';
}

const CLIP_TOKENS = ['truncate', 'lg:truncate', 'text-ellipsis', 'overflow-hidden', 'line-clamp-1'];

function assertWraps(tokens: Set<string>, label: string): void {
	for (const clip of CLIP_TOKENS) {
		assert.equal(tokens.has(clip), false, `${label} must not carry \`${clip}\` (it would clip with an ellipsis)`);
	}
	const wraps = tokens.has('break-words') || tokens.has('whitespace-normal');
	assert.ok(wraps, `${label} must declare a wrap (\`break-words\` or \`whitespace-normal\`); got: ${[...tokens].join(' ')}`);
}

/* ── ITEM 1 — the change-notice sentence wraps ─────────────────────────────── */

test('ITEM 1: the change-notice sentence wraps at every width, never truncating the sentence', () => {
	const sentence = changeNoticeSentence(['Teaching Load', 'Teacher availability']);
	const markup = renderToStaticMarkup(createElement(SimpleChangeNotice, {
		sentence,
		changedAreas: ['Teaching Load', 'Teacher availability'],
	}));
	const tag = tagFor(markup, 'timetable-simple-drift-message');
	assert.ok(tag, 'the sentence span renders');
	assertWraps(classTokens(tag), 'the change-notice sentence');
	// The whole sentence is the text the scheduler must be able to read.
	assert.ok(markup.includes('Teaching Load and Teacher availability changed since this schedule was made.'),
		'the full two-area sentence is rendered');
});

test('ITEM 1: the historical 1-area and 3-area sentences are unchanged', () => {
	assert.equal(changeNoticeSentence(['Teaching Load']),
		'Teaching Load changed since this schedule was made.');
	assert.equal(changeNoticeSentence(['Teaching Load', 'Rooms', 'Teacher availability']),
		'Teaching Load and 2 other areas changed since this schedule was made.');
});

/* ── ITEM 4 — the task-drawer step text wraps ───────────────────────────────── */

test('ITEM 4: the task-drawer step text wraps instead of clipping', () => {
	const rail = new Proxy({ setSeverityFilter: () => {}, handleViolationSelect: () => {} }, {
		get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => {}),
	});
	const markup = renderToStaticMarkup(createElement(MemoryRouter, null,
		createElement(TimetableTaskDrawer, {
			task: 'publish',
			onTaskChange: () => {},
			leftRailContentContext: rail as never,
			hardCount: 0,
			blockingHardCount: 0,
			softCount: 0,
			unassignedCount: 0,
			assignedCount: 0,
			runId: 318,
			isPreGenerationWorkspace: false,
			onPublish: () => {},
			violations: [],
		} as never),
	));
	const steps = markup.match(/aria-label="Task steps"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
	assert.ok(steps, 'the task-steps region renders');
	assert.ok(steps.includes('Confirm blockers are clear'), 'step 1 is rendered in full, not `Confirm blockers are c…`');
	assert.ok(steps.includes('Publish the schedule'), 'step 2 is rendered in full');
	const spans = [...steps.matchAll(/<span class="([^"]*)"[^>]*>/g)].map((match) => match[1].split(/\s+/));
	for (const tokens of spans) {
		for (const clip of ['truncate', 'lg:truncate', 'text-ellipsis']) {
			assert.equal(tokens.includes(clip), false, `a step span must not carry \`${clip}\``);
		}
	}
	const stepSpans = spans.filter((tokens) => !tokens.includes('font-semibold')); // the `1.` / `2.` prefixes are font-semibold
	assert.ok(stepSpans.length >= 2, 'both step spans are found');
	assert.ok(stepSpans.every((tokens) => tokens.includes('break-words') || tokens.includes('whitespace-normal')),
		'each step span declares a wrap');
});

/* ── ITEM 5 — Review warnings shows warnings; an empty filter says why ─────── */

function softViolation(index: number): Violation {
	return {
		code: 'FACULTY_EXCESSIVE_IDLE_GAP',
		severity: 'SOFT',
		message: `Teacher has an idle gap (${index})`,
		entities: { facultyId: index },
	} as unknown as Violation;
}

function railContext(overrides: Record<string, unknown>): LeftRailContentContext {
	const base: Record<string, unknown> = {
		leftTab: 'violations',
		isPreGenerationWorkspace: false,
		hardViolationCount: 0,
		runWideBlockingHardCount: 0,
		violationScopeLabel: 'Term 1',
		topBlockers: [],
		violations: [],
		handleViolationSelect: () => {},
		setSeverityFilter: () => {},
		severityFilter: 'all',
		VIOLATION_LABELS: {},
		violationSearch: '',
		setViolationSearch: () => {},
		filteredViolations: [],
		violationsByCode: new Map(),
		violationsGroupPage: 10,
		setViolationsGroupPage: () => {},
		selectedViolation: null,
		setDrawerViolation: () => {},
		formatConstraintMessage: (message: string) => message,
		draftBoard: null,
		isDesktop: true,
		toast: { info: () => {}, error: () => {} },
		summary: { classesProcessed: 5, assignedCount: 5, unassignedCount: 0 },
		filteredUnassignedItems: [],
		programKindFilteredUnassignedItems: [],
		unassignedPageSize: 50,
		setUnassignedPageSize: () => {},
		UNASSIGNED_REASON_LABELS: {},
		unassignedReasonFilter: 'all',
		setUnassignedReasonFilter: () => {},
		resolveEntryProgramType: () => null,
		resolveEntryProgramCode: () => null,
		sectionLabel: (id: number) => `Section ${id}`,
		subjectLabel: (id: number) => `Subject ${id}`,
		roomLabelShort: (id: number) => `Room ${id}`,
		formatFacultyInitials: (id: number) => `T. ${id}`,
		followUps: new Set(),
		...overrides,
	};
	return new Proxy(base, { get: (target: Record<string, unknown>, key: string) => (key in target ? target[key] : () => {}) }) as unknown as LeftRailContentContext;
}

test('ITEM 5b: an empty filtered list names the filter and the hidden count instead of "No matching violations"', () => {
	const soft = [softViolation(1), softViolation(2), softViolation(3)];
	const markup = renderToStaticMarkup(createElement(GeneratedViolationsPanel, {
		context: railContext({ violations: soft, filteredViolations: [], severityFilter: 'hard' }),
		visibleViolationGroups: [],
		violationGroups: [],
		hasMoreViolationGroups: false,
	}));
	assert.equal(markup.includes('No matching violations'), false,
		'the generic dead-end sentence is gone');
	assert.ok(markup.includes('3'), 'the empty body names the hidden count');
	assert.ok(/warning/i.test(markup), 'and names what is hidden (warnings)');
	assert.ok(markup.includes('data-testid="generated-rail-show-all"'),
		'and offers one action to show the hidden entries');
	const empty = tagFor(markup, 'generated-rail-filtered-empty');
	assert.ok(empty, 'the empty state is marked');
});
