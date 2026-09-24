import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppBreadcrumbs, PageHeader } from '@/components/app-shell/PageHeader';
import { resolveRouteChrome } from '@/components/app-shell/navigation';
import {
	SmartDegradedState,
	SmartEmptyState,
	SmartErrorState,
	SmartLoadingState,
} from '@/components/smart/SmartPageShell';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');

function source(path: string): string {
	return readFileSync(resolve(CLIENT_ROOT, path), 'utf8');
}

const authenticatedRoutes = [
	'/', '/my', '/subjects', '/subjects/requirements',
	'/subjects/decision-workspace', '/teachers', '/teaching-load/history',
	'/teaching-load', '/faculty', '/assignments', '/sections',
	'/faculty/preferences', '/faculty/room-preferences', '/faculty/concerns',
	'/timetable', '/timetabling/how-it-works', '/room-schedules', '/schedules',
	'/map', '/audit', '/admin/year-setup',
];

test('every authenticated route resolves truthful chrome with no repeated group and leaf', () => {
	for (const route of authenticatedRoutes) {
		const chrome = resolveRouteChrome(route);
		assert.notEqual(chrome.title, 'ATLAS', `${route} needs a specific page title`);
		assert.equal(chrome.breadcrumbs.at(-1), chrome.title, `${route} leaf must equal its title`);
		assert.equal(new Set(chrome.breadcrumbs).size, chrome.breadcrumbs.length, `${route} repeats a breadcrumb label`);
	}
});

test('desktop breadcrumb is accessible and marks exactly one current leaf', () => {
	const html = renderToStaticMarkup(createElement(AppBreadcrumbs, {
		breadcrumbs: ['Teachers and Rooms', 'Teaching Load'],
	}));
	assert.match(html, /aria-label="breadcrumb"/);
	assert.match(html, /Teachers and Rooms/);
	assert.match(html, /Teaching Load/);
	assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
	assert.equal((html.match(/Teaching Load/g) ?? []).length, 1);
});

test('canonical PageHeader owns one h1 and one primary-action slot', () => {
	const html = renderToStaticMarkup(createElement(PageHeader, {
		title: 'Subjects',
		eyebrow: 'School setup',
		subtitle: 'Maintain the teaching catalog.',
		primaryAction: createElement('button', { type: 'button' }, 'Add subject'),
	}));
	assert.equal((html.match(/<h1/g) ?? []).length, 1);
	assert.equal((html.match(/data-page-primary-action/g) ?? []).length, 1);
	assert.match(html, /text-foreground/);
	assert.doesNotMatch(html, /text-(?:slate|zinc|gray)-/);
});

test('production shell consumes the shared breadcrumb and route resolver', () => {
	const appShell = source('src/components/AppShell.tsx');
	assert.match(appShell, /<AppBreadcrumbs breadcrumbs=\{routeChrome\.breadcrumbs\}/);
	assert.match(appShell, /resolveRouteChrome\(location\.pathname\)/);

	const smartShell = source('src/components/smart/SmartPageShell.tsx');
	assert.match(smartShell, /<PageHeader/);
	assert.doesNotMatch(smartShell, /<h1/);
});

test('shared loading, empty, degraded, and error states remain one accessible semantic set', () => {
	const html = renderToStaticMarkup(createElement('div', null,
		createElement(SmartLoadingState, { label: 'Loading subjects' }),
		createElement(SmartEmptyState, { title: 'No subjects', body: 'Add the first subject.' }),
		createElement(SmartDegradedState, { body: 'Last verified 5 minutes ago.' }),
		createElement(SmartErrorState, { title: 'Subjects unavailable', body: 'Retry the request.' }),
	));
	for (const testId of ['smart-loading-state', 'smart-empty-state', 'smart-degraded-state', 'smart-error-state']) {
		assert.match(html, new RegExp(`data-testid="${testId}"`));
	}
	assert.doesNotMatch(html, /(?:text|bg|border)-(?:slate|zinc|gray)-/);
});

function assertSharedChromeSources(pageHeader: string, card: string, smartShell: string): void {
	assert.match(pageHeader, /<Breadcrumb(?:\s|>)/);
	assert.doesNotMatch(`${pageHeader}\n${card}\n${smartShell}`, /(?:text|bg|border)-(?:slate|zinc|gray)-/);
	assert.match(smartShell, /<PageHeader/);
}

test('every shared app-shell consumer keeps arbitrary rem/px text values at the 12px minimum', () => {
	const appShellDirectory = resolve(CLIENT_ROOT, 'src/components/app-shell');
	const paths = [
		'src/components/AppShell.tsx',
		...readdirSync(appShellDirectory)
			.filter((entry) => entry.endsWith('.tsx'))
			.map((entry) => `src/components/app-shell/${entry}`),
	];
	const undersized: string[] = [];
	for (const path of paths) {
		for (const match of source(path).matchAll(/text-\[(\d*\.?\d+)(rem|px)\]/g)) {
			const numeric = Number.parseFloat(match[1]);
			const pixels = match[2] === 'rem' ? numeric * 16 : numeric;
			if (pixels < 12) undersized.push(`${path}: ${match[0]} (${pixels}px)`);
		}
	}
	assert.deepEqual(undersized, [], `shared shell contains sub-12px labels:\n${undersized.join('\n')}`);
});

test('shared chrome guard is load-bearing for missing breadcrumbs and raw neutral colors', () => {
	const pageHeader = source('src/components/app-shell/PageHeader.tsx');
	const card = source('src/ui/card.tsx');
	const smartShell = source('src/components/smart/SmartPageShell.tsx');
	assert.doesNotThrow(() => assertSharedChromeSources(pageHeader, card, smartShell));
	assert.throws(() => assertSharedChromeSources(pageHeader.replace('<Breadcrumb', '<div'), card, smartShell));
	assert.throws(() => assertSharedChromeSources(pageHeader, card.replace('border-border', 'border-zinc-200'), smartShell));
});

test('duplicate-label mutant is rejected by the breadcrumb conservation invariant', () => {
	const valid = resolveRouteChrome('/timetable').breadcrumbs;
	assert.equal(new Set(valid).size, valid.length);
	const duplicateLeafMutant = [...valid, valid.at(-1)!];
	assert.notEqual(new Set(duplicateLeafMutant).size, duplicateLeafMutant.length);
});
