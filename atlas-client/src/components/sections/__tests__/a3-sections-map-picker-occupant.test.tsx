/**
 * A3 S1 — the occupied-room warning in the room picker (fix 03).
 *
 * The recorded defect: the popover body was a fixed `w-70` (17.5rem) and the
 * "Used by <section>" badge sat on the same non-wrapping flex row as the room
 * name, pushed to the far edge with `ml-auto`, while the room name carried
 * `truncate`. With a long section name the occupant was either clipped or the
 * row overflowed, so the warning the user is supposed to read before
 * displacing another section was unreadable.
 *
 * jsdom has no layout engine, so the "is it clipped" question is answered from
 * the committed class contract — the same width and height tokens the browser
 * would resolve — rather than asserted by eye. The occupant legibility is
 * asserted on the rendered element's own text and wrapping classes.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement, useState } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'https://njgrm.buru-degree.ts.net/sections',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	MouseEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
	HTMLInputElement: dom.window.HTMLInputElement,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.HTMLElement.prototype.hasPointerCapture = () => false;
(dom.window as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
	matches: false, media: q, onchange: null,
	addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
	dispatchEvent() { return false; },
});

const { createRoot } = await import('react-dom/client');
const { SectionRoomPicker } = await import('../SectionRoomPicker');
type RoomOption = import('../SectionRoomPicker').RoomOption;

let root: Root | null = null;
after(() => {
	if (root) act(() => { root!.unmount(); });
	dom.window.close();
});

/** A real section name, long enough to have clipped in 17.5rem. */
const LONG_OCCUPANT = 'Grade 9 - Bonifacio Special Program Section A';
const OPTIONS: RoomOption[] = [
	{ id: 201, name: 'Learning Commons', buildingName: 'Grade 9 Building', type: 'CLASSROOM' },
	{ id: 202, name: 'Guidance Office', buildingName: 'Grade 9 Building', type: 'OFFICE' },
];

function renderPicker(occupancy: Map<number, string>) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	root = createRoot(host);
	function Harness() {
		const [value, setValue] = useState<number | null>(null);
		return createElement(SectionRoomPicker, {
			sectionId: 11,
			sectionName: 'Grade 7 - Rizal',
			value,
			options: OPTIONS,
			onSelect: setValue,
			schoolId: 1,
			roomOccupancy: occupancy,
		});
	}
	act(() => { root!.render(createElement(Harness)); });
	return host;
}

function openPopover(host: HTMLElement) {
	const trigger = host.querySelector('[role="combobox"]') as HTMLElement;
	assert.ok(trigger, 'precondition: the combobox trigger exists');
	act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })); });
	// Radix opens on a pointerdown; drive that too so the control does not
	// depend on which event the primitive happens to listen to.
	const openNow = dom.window.document.querySelector('[role="listbox"]');
	if (!openNow) {
		act(() => { trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })); });
	}
	assert.ok(dom.window.document.querySelector('[role="listbox"]'), 'the room listbox must open');
}

test('fix 03 control: a long occupant name is fully readable, on its own wrapping line', () => {
	const host = renderPicker(new Map([[201, LONG_OCCUPANT]]));
	openPopover(host);

	const occupant = dom.window.document.querySelector('[data-testid="room-option-occupant"]') as HTMLElement;
	assert.ok(occupant, 'the occupied room must carry its occupant label');
	assert.equal(
		occupant.textContent,
		`Used by ${LONG_OCCUPANT}`,
		'the occupant label must contain the whole section name, not a shortened form',
	);
	assert.equal(occupant.dataset.occupiedFull, undefined, 'the label is not a data-attribute stand-in');

	// Legibility rests on the label being allowed to wrap, not on the room
	// name's truncate doing the work.
	assert.match(occupant.className, /break-words/, 'the occupant label must be allowed to break');
	assert.match(occupant.className, /whitespace-normal/, 'the occupant label must not be forced onto one line');
	assert.doesNotMatch(occupant.className, /\btruncate\b/, 'the occupant label must not be truncated');
	assert.doesNotMatch(occupant.className, /whitespace-nowrap/, 'the occupant label must not be nowrap');
	assert.doesNotMatch(occupant.className, /ml-auto/, 'the occupant label must not be pushed to the far edge of a shared row');
	assert.doesNotMatch(occupant.className, /uppercase/, 'an occupant name must not be shouted in caps at small size');
});

test('fix 03 control: the popover is viewport-relative, so nothing is clipped at 1280px', () => {
	const host = renderPicker(new Map([[201, LONG_OCCUPANT]]));
	openPopover(host);

	const listbox = dom.window.document.querySelector('[role="listbox"]') as HTMLElement;
	const content = listbox.closest('[data-radix-popper-content-wrapper]')?.firstElementChild
		?? listbox.parentElement?.parentElement;
	assert.ok(content, 'precondition: the popover body exists');
	const className = (content as HTMLElement).className;

	// The pre-fix width was a fixed token, which is the defect.
	assert.doesNotMatch(className, /\bw-70\b/, 'the fixed w-70 body is the recorded defect');
	assert.doesNotMatch(className, /\bw-\[\d+px\]/, 'the body must not return to a fixed pixel width');
	const widthToken = className.match(/w-\[(min\([^)]*\)|[^\]]*)\]/);
	assert.ok(widthToken, `the body must declare a viewport-relative width; got ${className}`);
	assert.match(widthToken![0], /100vw/, 'the width must be bounded by the viewport');

	// Resolve the committed tokens at 1280x768 and check both axes fit.
	const VIEWPORT_W = 1280;
	const VIEWPORT_H = 768;
	const remPx = (rem: number) => rem * 16;
	const minRem = Number(widthToken![0].match(/min\((\d+(?:\.\d+)?)rem/)?.[1] ?? '0');
	const vwMargin = Number(widthToken![0].match(/100vw-([\d.]+)rem/)?.[1] ?? '0');
	const resolvedWidth = Math.min(minRem * remPx(1), VIEWPORT_W - vwMargin * remPx(1));
	assert.ok(resolvedWidth <= VIEWPORT_W, `the popover must fit the viewport width, got ${resolvedWidth}px`);
	const heightToken = /\bh-(\d+)\b/.exec(className);
	assert.ok(heightToken, 'the popover must declare a bounded height');
	const resolvedHeight = Number(heightToken![1]) * 4; // Tailwind's h-<n> unit is 0.25rem
	assert.ok(resolvedHeight <= VIEWPORT_H, `the popover must fit the viewport height, got ${resolvedHeight}px`);

	// The footer is the last thing the user needs, so it must not be the
	// element that gets squeezed out.
	const footer = Array.from(dom.window.document.querySelectorAll('button'))
		.find((b) => (b.textContent ?? '').includes('Browse Interactive Map'));
	assert.ok(footer, 'the "Browse Interactive Map" footer control must be present');
	const footerEl = footer!.closest('div');
	assert.ok(footerEl?.className.includes('shrink-0'), 'the footer must be shrink-0 so it cannot be squeezed by the list');
	assert.ok(
		dom.window.document.body.textContent?.includes('Room already has a home section'),
		'the occupant warning must still be stated, not only implied by the badge',
	);
});
