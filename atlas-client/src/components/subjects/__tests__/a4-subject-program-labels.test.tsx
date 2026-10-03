/**
 * Layout note — design before code for the bounded /subjects correction.
 * STAYS: readable subject names, grade-chip geometry, full program names in the
 * existing Tooltip, the no-scroll table frame, and the aligned Action column.
 * GOES: raw chip faces such as BEC, STE, SPA, and SPS; no extra row or control
 * is added. COMPACT: one shared glossary mapping uses Regular, Science, Arts,
 * and Sports on the existing one-line chip row while the Tooltip keeps detail.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/subjects' });
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	MutationObserver: dom.window.MutationObserver,
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createRoot } = await import('react-dom/client');
const { ProgramScopeChips } = await import('../ProgramScopeChips');

test('A4: rendered program chips use compact plain-language labels instead of raw codes', async () => {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root: Root = createRoot(host);
	try {
		await act(async () => {
			root.render(<ProgramScopeChips scopes={['REGULAR', 'STE', 'SPA', 'SPS']} />);
		});

		const container = host.querySelector('[data-testid="subject-program-chips"]');
		assert.ok(container, 'the program chip row is missing');
		const chips = Array.from(container.children) as HTMLElement[];
		const labels = chips.map((chip) => (chip.textContent ?? '').trim());
		assert.deepEqual(labels, ['Regular', 'Science', 'Arts', 'Sports']);
		for (const rawCode of ['BEC', 'STE', 'SPA', 'SPS']) {
			assert.equal(labels.includes(rawCode), false, `raw program code ${rawCode} is still visible`);
		}
		assert.deepEqual(
			chips.map((chip) => chip.getAttribute('aria-label')),
			[
				'Regular — Regular Program',
				'Science — Science, Technology, and Engineering',
				'Arts — Special Program in the Arts',
				'Sports — Special Program in Sports',
			],
			'full program names are no longer readable from the chip affordance',
		);
	} finally {
		await act(async () => { root.unmount(); });
		host.remove();
	}
});
