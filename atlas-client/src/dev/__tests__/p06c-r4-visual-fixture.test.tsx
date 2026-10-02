import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/__dev/p06c-r4-visual-fixture' });
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
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const { P06cR4VisualFixture, p06cR4FixtureInternals } = await import('../P06cR4VisualFixture');
const { VIOLATION_PRESENTATION } = await import('@/lib/violation-presentation');
const { deriveSimplePublishReadiness } = await import('@/components/timetable/simplePublishReadiness');
const { ViolationGroup } = await import('@/components/timetable/TimetableShared');
const { placeholderViolation, readiness } = p06cR4FixtureInternals;

test('p06c development fixture mounts the production warning and readiness path', async () => {
	const root = createRoot(document.getElementById('root')!);
	await act(async () => { root.render(createElement(P06cR4VisualFixture)); });
	const text = document.body.textContent ?? '';
	assert.match(text, /Local development fixture · p06c/);
	assert.match(text, /Class assigned to a future teacher/);
	assert.match(text, /This class is assigned to a teacher who has not joined the school yet\./);
	assert.match(text, /Assign a teacher who is already available\./);
	assert.match(text, /2 classes need a time slot before this schedule can be published\./);
	assert.match(text, /1 Must fix problem and 2 classes need a time slot before this schedule can be published\./);
	assert.match(text, /Must fix · 1/);
	for (const forbidden of ['SYNTHETIC_PLACEHOLDER_OWNED', 'Faculty 16', 'MONDAY']) {
		assert.ok(!text.includes(forbidden), `${forbidden} must not appear in the rendered fixture`);
	}
	assert.equal(placeholderViolation.code, 'SYNTHETIC_PLACEHOLDER_OWNED');
	assert.equal(VIOLATION_PRESENTATION[placeholderViolation.code].title, 'Class assigned to a future teacher');
	assert.equal(typeof deriveSimplePublishReadiness, 'function');
	assert.equal(typeof ViolationGroup, 'function');
	assert.equal(readiness(0).totalUnresolved, 2);
	assert.equal(readiness(1).totalHardBlockers, 1);
	await act(async () => root.unmount());
});

after(() => dom.window.close());
