/**
 * DOCX1 T7 (operator 30 Sep 2026) — the "Add temporary teacher" form.
 *
 * Implements locked operator-decision #10: names optional, no placeholder text, an
 * empty default department, and NO Specialization field.
 *
 * HARNESS: every row renders the REAL `CreatePlaceholderDialog` through jsdom (the
 * render/unmount discipline of the accepted sibling `a5-fix20-subject-discard`),
 * reads into plain data, and unmounts BEFORE asserting. `AGENTS.md` §11: a test that
 * only asserts source text is not acceptance evidence for a user-facing change, so
 * the create-payload row drives the REAL Save click and captures the body the
 * component actually sends, by spying on the shared `@/lib/api` singleton (the
 * established pattern in `a6-teachers-header-profile.test.tsx`).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/faculty' });
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
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	HTMLFormElement: dom.window.HTMLFormElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLOListElement: dom.window.HTMLOListElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { innerWidth: number }).innerWidth = 1366;
(dom.window as unknown as { innerHeight: number }).innerHeight = 768;
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
(dom.window.HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { CreatePlaceholderDialog } = await import('../CreatePlaceholderDialog');
const atlasApi = (await import('@/lib/api')).default;

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
	hostEl = document.createElement('div');
	document.body.appendChild(hostEl);
	root = createRoot(hostEl);
	await act(async () => { root?.render(node); });
	return hostEl;
}

async function unmount(): Promise<void> {
	if (root) await act(async () => { root?.unmount(); });
	root = null;
	hostEl?.remove();
	hostEl = null;
}

/** Radix opens popovers/selects on `pointerdown`; a click-only helper is a false negative. */
function click(el: Element | null): Promise<void> {
	return act(async () => {
		const target = el as HTMLElement;
		const init = { bubbles: true, cancelable: true, button: 0, ctrlKey: false };
		target.dispatchEvent(new dom.window.MouseEvent('pointerdown', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mousedown', init));
		target.dispatchEvent(new dom.window.MouseEvent('pointerup', { ...init, pointerType: 'mouse' } as never));
		target.dispatchEvent(new dom.window.MouseEvent('mouseup', init));
		target.dispatchEvent(new dom.window.MouseEvent('click', init));
	});
}

/** The add-mode form, with the operator's own two departments. */
function renderAddForm(): Promise<HTMLElement> {
	return render(
		<CreatePlaceholderDialog
			open
			onOpenChange={() => {}}
			onSuccess={() => {}}
			facultyToEdit={null}
			departments={['AP', 'MAPEH']}
		/>,
	);
}

const buttonByText = (text: string): HTMLButtonElement | null =>
	(Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined) ?? null;

test('A5DOCX1-T7-1 the name labels are marked optional and carry no required marker', async () => {
	await renderAddForm();

	const labels = Array.from(document.body.querySelectorAll('label')).map((l) => l.textContent?.trim());
	assert.ok(labels.includes('First name (optional)'), `no "First name (optional)" label; saw ${JSON.stringify(labels)}`);
	assert.ok(labels.includes('Last name (optional)'), `no "Last name (optional)" label; saw ${JSON.stringify(labels)}`);
	// No required marker survives on either name field.
	for (const l of document.body.querySelectorAll('label')) {
		const text = l.textContent ?? '';
		if (text.includes('First name') || text.includes('Last name')) {
			assert.doesNotMatch(text, /\*/, `a required "*" marker is still on the label "${text.trim()}"`);
		}
	}
	await unmount();
});

test('A5DOCX1-T7-2 the name inputs carry no placeholder attribute', async () => {
	await renderAddForm();
	const first = document.body.querySelector<HTMLInputElement>('#firstName');
	const last = document.body.querySelector<HTMLInputElement>('#lastName');
	assert.ok(first, '#firstName input not found');
	assert.ok(last, '#lastName input not found');
	assert.equal(first!.getAttribute('placeholder'), null, 'the first-name input still shows placeholder text');
	assert.equal(last!.getAttribute('placeholder'), null, 'the last-name input still shows placeholder text');
	await unmount();
});

test('A5DOCX1-T7-3 the Department trigger shows its placeholder and preselects nothing', async () => {
	await renderAddForm();
	const trigger = document.body.querySelector('#department');
	assert.ok(trigger, 'the Department trigger is missing');
	const text = (trigger!.textContent ?? '').replace(/\s+/g, ' ').trim();
	assert.match(text, /Select Department/, 'the Department trigger does not show its "Select Department" placeholder');
	// No department is preselected: the trigger must not name one of the options.
	assert.doesNotMatch(text, /Araling Panlipunan|MAPEH/, `a department is preselected on the trigger: "${text}"`);
	await unmount();
});

test('A5DOCX1-T7-4 the Specialization field is gone entirely', async () => {
	await renderAddForm();
	assert.equal(document.getElementById('specialization'), null, 'an element with id="specialization" still exists');
	assert.doesNotMatch(document.body.textContent ?? '', /Specialization/, 'the visible text "Specialization" is still rendered');
	await unmount();
});

test('A5DOCX1-T7-5 with both names blank the Save action is enabled and no error is rendered', async () => {
	await renderAddForm();
	const save = buttonByText('Add Temporary Teacher');
	assert.ok(save, 'the add-mode Save button is missing');
	assert.equal(save!.disabled, false, 'Save is disabled with blank names, which contradicts the optional-name contract');
	assert.equal(document.body.querySelectorAll('[role="alert"]').length, 0, 'a validation error is rendered for a blank name');
	await unmount();
});

test('A5DOCX1-T7-6 the create request omits `specialization` and passes the blank names through', async () => {
	const captured: Array<{ url: string; body: Record<string, unknown> }> = [];
	const originalPost = atlasApi.post;
	(atlasApi as unknown as { post: (url: string, body: Record<string, unknown>) => Promise<unknown> }).post = async (url, body) => {
		captured.push({ url: String(url), body });
		return { data: {} };
	};
	try {
		await renderAddForm();
		const save = buttonByText('Add Temporary Teacher');
		assert.ok(save, 'the add-mode Save button is missing');
		await click(save);

		assert.equal(captured.length, 1, 'the Save action did not issue exactly one create request');
		const { url, body } = captured[0];
		assert.equal(url, '/faculty/placeholders', 'the create request did not go to the placeholder endpoint');
		assert.equal('specialization' in body, false, 'the create request still sends a `specialization` key');
		assert.equal(body.firstName, '', 'the blank first name was not passed through as-is');
		assert.equal(body.lastName, '', 'the blank last name was not passed through as-is');
		assert.equal(body.department, null, 'an empty department did not send `null`');
	} finally {
		(atlasApi as unknown as { post: typeof originalPost }).post = originalPost;
		await unmount();
	}
});
