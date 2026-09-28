/**
 * A5 / operator FIX-20 — "Cancel on a filled subject form discards fields; must
 * preserve through a confirmation."
 *
 * Assigned by Lane C at `docs/handoffs/lane-a-to-c.md:127`, graded against those
 * words rather than a narrower rewrite: the requirement is about EVERY close
 * path on a CHANGED form, and the confirmation must let the operator abandon the
 * cancellation and keep editing.
 *
 * HARNESS (AGENTS.md §11, "a proof artefact must actually discriminate"):
 * every control renders the REAL `SubjectFormModal` through jsdom and drives
 * the REAL event sequence. jsdom has no layout engine, so nothing here claims a
 * measured pixel result — the rendered-browser half of FIX-20 is the Playwright
 * row in `qa-artifacts/playwright/specs/a5-subjects-c1.spec.ts`.
 *
 * Each control is paired with its NEGATIVE: control 4 proves the untouched form
 * still closes immediately, which is what makes controls 1-3's "it asked first"
 * a statement about a FILLED form rather than a statement about the component
 * always showing a dialog.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/subjects' });
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
const { SubjectFormModal } = await import('../SubjectFormModal');
const { subjectToFormValues } = await import('../subject-form-utils');

let root: Root | null = null;
let hostEl: HTMLElement | null = null;
after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	hostEl?.remove();
	dom.window.close();
});

async function render(node: React.ReactNode): Promise<HTMLElement> {
	await unmount();
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

/** Radix opens its popovers on `pointerdown`; a click-only helper is a false negative. */
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

function setNativeValue(el: HTMLInputElement, value: string): Promise<void> {
	const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set;
	return act(async () => {
		setter?.call(el, value);
		el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
	});
}

/** The form dialog only. Scoped by testid so the confirmation's own "Cancel" can never be mistaken for it. */
function formDialog(): HTMLElement | null {
	return document.body.querySelector('[data-testid="subjects-form-dialog"]');
}

function formCancel(): HTMLElement | null {
	const dialog = formDialog();
	if (!dialog) return null;
	return Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cancel') ?? null;
}

function nameInput(): HTMLInputElement | null {
	return document.body.querySelector<HTMLInputElement>('input[placeholder="e.g. Mathematics Grade 10"]');
}

/**
 * The discard confirmation, found by its RENDERED TITLE and then scoped to the
 * dialog that carries it.
 *
 * Deliberately not a `data-testid` lookup: a control that found a node by a
 * testid this lane also wrote would pass even if the operator-facing wording
 * were wrong, and FIX-20 is a wording-bearing requirement. Anchoring on the
 * sentence the operator reads is what makes the wording itself the evidence.
 */
function discardConfirmation(): HTMLElement | null {
	const title = Array.from(document.body.querySelectorAll('h2, h3, p, span, div')).find(
		(el) => el.children.length === 0 && el.textContent?.trim() === 'Discard your changes?',
	);
	if (!title) return null;
	return title.closest('[role="dialog"]') as HTMLElement | null;
}

function confirmationButton(label: string): HTMLElement | null {
	const modal = discardConfirmation();
	if (!modal) return null;
	return Array.from(modal.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) ?? null;
}

function subjectFixture(overrides: Record<string, unknown> = {}) {
	return {
		id: 41,
		code: 'SCI10',
		name: 'Earth Science',
		displayCode: 'SCI10',
		outputLabel: null,
		ownerDepartment: 'SCI',
		allowedOwnerDepartments: [] as string[],
		qualificationPriority: 'DEPARTMENT_FIRST' as const,
		rotationFamily: null,
		minMinutesPerWeek: 225,
		preferredRoomType: 'CLASSROOM' as const,
		isActive: true,
		isSeedable: false,
		isSystemManaged: false,
		gradeLevels: [9, 10],
		interSectionEnabled: false,
		interSectionGradeLevels: [] as number[],
		modularGroupId: null,
		modularOrder: null,
		programScopes: ['REGULAR'],
		allowedSpecializations: [] as string[],
		requiredFeatures: [] as string[],
		rotationTermLabel: null,
		rotationTermRank: null,
		rotationTermGroupId: null,
		rotationTermCount: null,
		updatedAt: '2026-09-27T00:00:00.000Z',
		...overrides,
	} as never;
}

/** The counters every control reads. `closes` is the close-decision assertion. */
function harness() {
	const state = { saves: 0, closes: 0 };
	return {
		state,
		props: {
			open: true,
			mode: 'edit' as const,
			initialValues: subjectToFormValues(subjectFixture()),
			saving: false,
			onSave: async () => { state.saves += 1; return { status: 'saved' as const }; },
			// Inert, exactly as the A3-20 control does it, so the form stays
			// mounted and its fields can be inspected after the close decision.
			onClose: () => { state.closes += 1; },
		},
	};
}

// ===========================================================================
// FIX-20 — the four close paths on a CHANGED form all ask instead of closing.
// ===========================================================================

test('FIX-20: Cancel on a changed subject form asks before closing, and the fields survive the question', async () => {
	const fetchCalls: string[] = [];
	const originalFetch = globalThis.fetch;
	(globalThis as { fetch?: unknown }).fetch = (...args: unknown[]) => {
		fetchCalls.push(String(args[0]));
		return Promise.reject(new Error('network must not be reached on the Cancel path'));
	};
	try {
		const { state, props } = harness();
		await render(<SubjectFormModal {...props} />);

		const input = nameInput();
		assert.ok(input, 'subject name input not found');
		await setNativeValue(input, 'Earth Science (edited)');

		const cancel = formCancel();
		assert.ok(cancel, 'Cancel button not found');
		await click(cancel);

		// THE DEFECT: the form closed and the operator's edit went with it.
		assert.equal(state.closes, 0, 'Cancel on a CHANGED form closed without asking — this is the FIX-20 defect');

		// THE CONFIRMATION, with the wording the operator actually reads.
		const confirmation = discardConfirmation();
		assert.ok(confirmation, 'no discard confirmation was shown for a changed form');
		assert.match(
			confirmation.textContent ?? '',
			/has changes you have not saved/,
			'the confirmation does not state that there are unsaved changes',
		);
		assert.ok(
			confirmationButton('Discard changes'),
			'the confirmation offers no "Discard changes" answer, so the operator cannot choose to discard',
		);

		// THE PRESERVATION: the form is still there, still populated.
		const stillOpen = nameInput();
		assert.ok(stillOpen, 'the form was torn down behind the confirmation');
		assert.equal(stillOpen.value, 'Earth Science (edited)', 'the edited name was discarded by the Cancel attempt');

		// A3-20's non-action contract, still intact on this new path.
		assert.equal(state.saves, 0, 'asking to close invoked the save path');
		assert.deepEqual(fetchCalls, [], 'asking to close issued a network request');
		assert.equal(document.body.querySelector('[data-testid="subjects-form-result"]'), null, 'a save outcome was surfaced');
	} finally {
		(globalThis as { fetch?: unknown }).fetch = originalFetch;
	}
});

test('FIX-20: cancelling the cancellation keeps every field and returns the operator to editing', async () => {
	const { state, props } = harness();
	await render(<SubjectFormModal {...props} />);

	const input = nameInput();
	assert.ok(input);
	await setNativeValue(input, 'Earth Science (edited)');
	await click(formCancel());
	assert.ok(discardConfirmation(), 'no confirmation to cancel');

	// The "keep editing" answer.
	await click(confirmationButton('Cancel'));

	assert.equal(discardConfirmation(), null, 'cancelling the cancellation left the question on screen');
	assert.equal(state.closes, 0, 'cancelling the cancellation closed the form anyway');
	const back = nameInput();
	assert.ok(back, 'the form is gone after cancelling the cancellation');
	assert.equal(back.value, 'Earth Science (edited)', 'the edited name was lost when the cancellation was cancelled');

	// And the form is still usable: a further edit lands.
	await setNativeValue(back, 'Earth Science (edited again)');
	const finalInput = nameInput();
	assert.ok(finalInput);
	assert.equal(finalInput.value, 'Earth Science (edited again)', 'the form did not accept a further edit after the cancelled cancellation');
});

test('FIX-20: confirming the discard closes exactly once, without saving or requesting anything', async () => {
	const fetchCalls: string[] = [];
	const originalFetch = globalThis.fetch;
	(globalThis as { fetch?: unknown }).fetch = (...args: unknown[]) => {
		fetchCalls.push(String(args[0]));
		return Promise.reject(new Error('network must not be reached on the discard path'));
	};
	try {
		const { state, props } = harness();
		await render(<SubjectFormModal {...props} />);

		const input = nameInput();
		assert.ok(input);
		await setNativeValue(input, 'Earth Science (edited)');
		await click(formCancel());
		await click(confirmationButton('Discard changes'));

		assert.equal(state.closes, 1, 'discarding did not take exactly one close action');
		assert.equal(state.saves, 0, 'discarding invoked the save path');
		assert.deepEqual(fetchCalls, [], 'discarding issued a network request');
	} finally {
		(globalThis as { fetch?: unknown }).fetch = originalFetch;
	}
});

test('FIX-20: Escape on a changed form asks first instead of discarding the fields', async () => {
	const { state, props } = harness();
	await render(<SubjectFormModal {...props} />);

	const input = nameInput();
	assert.ok(input);
	await setNativeValue(input, 'Earth Science (edited)');

	await act(async () => {
		document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});

	assert.equal(state.closes, 0, 'Escape on a CHANGED form closed without asking');
	assert.ok(discardConfirmation(), 'Escape on a changed form raised no confirmation');
	const stillOpen = nameInput();
	assert.ok(stillOpen, 'the form was torn down by Escape on a changed form');
	assert.equal(stillOpen.value, 'Earth Science (edited)', 'Escape discarded the operator\'s edit');
});

test('FIX-20: an overlay click on a changed form asks first instead of discarding the fields', async () => {
	const { state, props } = harness();
	const host = await render(<SubjectFormModal {...props} />);

	const input = nameInput();
	assert.ok(input);
	await setNativeValue(input, 'Earth Science (edited)');

	// Radix dismisses an overlay click from a pointerdown OUTSIDE the content.
	await act(async () => {
		host.dispatchEvent(new dom.window.MouseEvent('pointerdown', {
			bubbles: true, cancelable: true, button: 0, ctrlKey: false, pointerType: 'mouse',
		} as never));
	});

	assert.equal(state.closes, 0, 'an overlay click on a CHANGED form closed without asking');
	assert.ok(discardConfirmation(), 'an overlay click on a changed form raised no confirmation');
	const stillOpen = nameInput();
	assert.ok(stillOpen, 'the form was torn down by an overlay click on a changed form');
	assert.equal(stillOpen.value, 'Earth Science (edited)', 'an overlay click discarded the operator\'s edit');
});

// ===========================================================================
// The NEGATIVE control: an UNTOUCHED form must still close immediately.
// Without this row, "it asked first" above could mean "it always shows a
// dialog", which would satisfy none of the operator's words.
// ===========================================================================

test('FIX-20 NEGATIVE: an untouched form closes immediately, with no confirmation at all', async () => {
	const { state, props } = harness();
	await render(<SubjectFormModal {...props} />);

	// Opened and left alone — not one setter has run.
	const cancel = formCancel();
	assert.ok(cancel, 'Cancel button not found');
	await click(cancel);

	assert.equal(state.closes, 1, 'an untouched form did not close immediately');
	assert.equal(discardConfirmation(), null, 'an untouched form raised a discard confirmation it has no reason to raise');
	assert.equal(state.saves, 0, 'closing an untouched form invoked the save path');
});

test('FIX-20: a change that is made and then reverted is not treated as a change', async () => {
	const { state, props } = harness();
	await render(<SubjectFormModal {...props} />);

	const input = nameInput();
	assert.ok(input);
	const original = input.value;
	await setNativeValue(input, 'Earth Science (edited)');
	await setNativeValue(nameInput() as HTMLInputElement, original);

	await click(formCancel());
	assert.equal(state.closes, 1, 'a reverted edit was treated as unsaved work');
	assert.equal(discardConfirmation(), null, 'a reverted edit raised a discard confirmation');
});

test('FIX-20: a successful save closes the form and leaves NO confirmation behind', async () => {
	// The page closes the form from its own save handler, so the modal never
	// calls `onClose`. A pending prompt must not outlive the dialog.
	function Page() {
		const [open, setOpen] = useState(true);
		return (
			<SubjectFormModal
				open={open}
				mode="edit"
				initialValues={subjectToFormValues(subjectFixture())}
				saving={false}
				onSave={async () => { setOpen(false); return { status: 'saved' as const }; }}
				onClose={() => setOpen(false)}
			/>
		);
	}
	await render(<Page />);

	const input = nameInput();
	assert.ok(input);
	await setNativeValue(input, 'Earth Science (edited)');

	const save = document.body.querySelector<HTMLButtonElement>('[data-testid="subjects-form-save"]');
	assert.ok(save, 'save button not found');
	await act(async () => {
		save.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});

	assert.equal(formDialog(), null, 'the form did not close after a successful save');
	assert.equal(discardConfirmation(), null, 'a discard confirmation outlived the form it belonged to');
});
