import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/__dev/a2a5-unassigned-visual-fixture' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	SVGElement: dom.window.SVGElement,
	Event: dom.window.Event,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { A2A5UnassignedVisualFixture } = await import('../A2A5UnassignedVisualFixture');
const { TimetableTaskDrawer } = await import('@/components/timetable/TimetableTaskDrawer');
const { SimpleUnassignedSessionsPanel } = await import('@/components/timetable/GeneratedUnassignedPanel');
const CLIENT_ROOT = resolve(import.meta.dirname, '../../..');

test('A2+A5 dev fixture renders the real grouped queue with local-only actions and drawer Escape', async () => {
	const originalFetch = globalThis.fetch;
	let fetchCalls = 0;
	globalThis.fetch = (async () => {
		fetchCalls += 1;
		throw new Error('the synthetic fixture must never call fetch');
	}) as typeof fetch;
	const root = createRoot(document.getElementById('root')!);
	await act(async () => {
		root.render(createElement(MemoryRouter, null, createElement(A2A5UnassignedVisualFixture)));
	});
	const fixture = document.querySelector('[data-testid="a2a5-unassigned-visual-fixture"]');
	assert.ok(fixture);
	assert.match(fixture.textContent ?? '', /Local visual fixture · synthetic data only/);
	assert.match(fixture.textContent ?? '', /6 classes need a time slot/);
	assert.match(fixture.textContent ?? '', /Place a class from this term in a highlighted slot\./);
	const helper = [...fixture.querySelectorAll('p')].find((node) => node.textContent === 'Place a class from this term in a highlighted slot.');
	assert.ok(helper);
	assert.equal(helper.className.includes('line-clamp-1'), false, 'the A5 helper wraps instead of ending in an ellipsis');
	assert.equal(document.querySelectorAll('[data-testid="generated-unassigned-section"]').length, 3);
	const rows = [...document.querySelectorAll('[data-testid="generated-unassigned-row"]')];
	assert.equal(rows.length, 6);
	for (const row of rows) {
		const text = row.textContent ?? '';
		assert.equal((text.match(/Term 2/g) ?? []).length, 1);
		assert.equal((text.match(/Session [12]/g) ?? []).length, 1);
		assert.equal(row.querySelectorAll('button').length, 1);
	}
	const list = document.querySelector('[data-testid="generated-unassigned-list"]');
	assert.ok(list?.className.includes('overflow-auto'), 'the production queue owns the single scroll region');
	const drawer = document.querySelector('[data-testid="timetable-task-drawer"]');
	assert.ok(drawer?.className.includes('overflow-hidden'), 'the actual task drawer contains queue scrolling');
	assert.ok(drawer?.className.includes('inset-0'), 'the mobile drawer uses the full available workspace height');
	assert.equal(drawer?.className.includes('82svh'), false, 'the drawer does not reserve an artificial viewport gap');
	assert.ok(drawer?.className.includes('absolute') && drawer.className.includes('md:static'), 'the real drawer adapts from a mobile sheet to the desktop rail');
	assert.equal(document.querySelectorAll('[data-testid="timetable-task-drawer"]').length, 1);
	assert.equal(typeof TimetableTaskDrawer, 'object');
	assert.equal(typeof SimpleUnassignedSessionsPanel, 'function');

	await act(async () => {
		rows[0].querySelector('button')?.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
	});
	assert.match(document.querySelector('[data-testid="a2a5-fixture-status"]')?.textContent ?? '', /No request was sent/);
	assert.equal(fetchCalls, 0, 'Place remains an in-memory selection with no API calls');
	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	assert.equal(document.querySelector('[data-testid="timetable-task-drawer"]'), null, 'Escape closes the real drawer');

	const viteConfig = readFileSync(resolve(CLIENT_ROOT, 'vite.config.ts'), 'utf8');
	assert.match(viteConfig, /const a2a5UnassignedFixturePath = '\/__dev\/a2a5-unassigned-visual-fixture'/);
	assert.match(viteConfig, /command === 'serve' \? \[p06cVisualFixtureDevEntry\(\), a2a5UnassignedFixtureDevEntry\(\)\] : \[\]/);
	await act(async () => root.unmount());
	globalThis.fetch = originalFetch;
});

after(() => dom.window.close());
