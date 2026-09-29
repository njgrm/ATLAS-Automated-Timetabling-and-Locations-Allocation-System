/**
 * A5 C4 ITEM 1 (2026-09-29) — the term-authority banner must not hand a raw
 * SERVER CODE to the operator as its visible label.
 *
 * THE FINDING, VERBATIM (Lane C, Codex staging walk, `docs/reviews/codex-staging-train6-24e268fb/`):
 *   "Show `TERM_CACHE_INVALID` as *Term information needs updating before
 *    scheduling*, and put the code behind Help."
 *
 * WHAT IS ACTUALLY WRONG IN THE SOURCE, NOT IN THE COPY MAP
 *
 *  1. `SubjectTermAuthorityBanner.tsx` rendered the raw `code` as the popover
 *     trigger's visible label, in `font-mono text-[0.65rem]`. The operator's eye
 *     landed on an enum constant where a verb should be.
 *  2. The banner HEADLINE was derived from `state` alone, so `TERM_CACHE_INVALID`
 *     — which arrives as `VERIFIED_CACHED` — inherited the generic stale-source
 *     headline "Using saved EnrollPro year and terms". That headline names the
 *     SOURCE, not the thing that must be updated. It does not tell a scheduler
 *     that the *term* information is what has to be refreshed before they can
 *     schedule.
 *
 * `subject-source-utils.ts` already maps this code to calm description /
 * nextAction copy. That copy is ACCEPTED and is not touched by this change —
 * `A3-C4-3a` / `3b` / `3b2` pin it, and those pins must stay green.
 *
 * WHAT IS ASSERTED, AND WHY EACH ROW IS WORTH ITS PLACE
 *
 *  - `A5-C4-1a` the trigger's own text is plain words and the code is gone from
 *    the visible row. FAILS ON BASE: the trigger reads `TERM_CACHE_INVALID`.
 *  - `A5-C4-1b` the headline resolves FROM THE CODE, with the operator's own
 *    sentence. FAILS ON BASE: the headline is the state-derived one.
 *  - `A5-C4-1c` THE ANTI-DELETION CONTROL. A real `pointerdown` opens the real
 *    popover and the code AND the raw server sentence are both still inside it.
 *    This row is what stops "fix the label" from being satisfied by deleting the
 *    evidence: an implementation that dropped the code outright is red here.
 *  - `A5-C4-1d` the control case: a code with no mapping keeps today's
 *    state-derived headline, so the new resolver did not silently take over every
 *    state. This is the row that makes 1b attributable to the CODE rather than to
 *    a reworded fallback.
 *
 * THE FIXTURE IS THE REAL SERVER SENTENCE. `enrollpro-term-contract.service.ts`
 * emits six distinct sentences under this one code; the worst-reading one
 * ("Saved term contract failed its semantic revision check.") is the fixture,
 * because a fixture invented by the test would be the exact mistake `AGENTS.md`
 * §11 warns about.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act } from 'react';
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
	/* Set BEFORE React is imported (below). React builds its event plugin list at
	 * import time, so a `PointerEvent` installed afterwards is invisible to the
	 * synthetic `onPointerDown` that Radix's PopoverTrigger opens on — the popover
	 * would then never open and row 1c would be red for a harness reason instead
	 * of for the reason it claims. */
	PointerEvent: dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	DOMParser: dom.window.DOMParser,
	NodeList: dom.window.NodeList,
	AbortController: dom.window.AbortController,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
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
(dom.window.HTMLElement.prototype as unknown as { click: () => void }).click = function click(this: HTMLElement) {
	this.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
};
(dom.window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = dom.window.MouseEvent;

const { createRoot } = await import('react-dom/client');
const { SubjectTermAuthorityBanner } = await import('../SubjectTermAuthorityBanner');
const { resolveTermAuthorityCopy } = await import('../subject-source-utils');

type TermAuthority = import('../../../types').TermAuthority;

const OPERATOR_HEADLINE = 'Term information needs updating before scheduling.';

/** The real `TermContract` the server sends, so the banner renders its real shape. */
const TERM_CONTRACT = {
	schoolYear: { id: 1, yearLabel: '2026-2027' },
	format: 'SEMESTER',
	terms: [{ id: 1, label: 'Term 1', rank: 1 }],
	activeTermId: null,
	liveSemanticRevision: 'rev-1',
} as never;

function authority(overrides: Partial<TermAuthority>): TermAuthority {
	return {
		state: 'VERIFIED_CACHED',
		source: 'atlas-cache',
		degraded: true,
		code: null,
		message: '',
		contract: TERM_CONTRACT,
		...overrides,
	} as TermAuthority;
}

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

/** A real pointer sequence on the trigger, the way a mouse opens the popover. */
async function openPopover(trigger: Element): Promise<void> {
	await act(async () => {
		trigger.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		trigger.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
		trigger.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
	await act(async () => { await Promise.resolve(); });
}

function bannerEl(): HTMLElement | null {
	return document.body.querySelector('[data-testid="subject-term-authority"]');
}
function triggerEl(): HTMLElement | null {
	return document.body.querySelector('[data-testid="subject-term-authority-detail"]');
}

// ─────────────────────────────────────────────────────────────────────────────

test('A5-C4-1a: the diagnostic trigger reads plain words, and no raw code is visible on the banner', async () => {
	await render(
		<SubjectTermAuthorityBanner
			termAuthority={authority({
				code: 'TERM_CACHE_INVALID',
				message: 'Saved term contract failed its semantic revision check.',
			})}
		/>,
	);
	const trigger = triggerEl();
	assert.ok(trigger, 'the labelled diagnostic affordance is gone; the raw code has nowhere to live');

	const visible = (trigger.textContent ?? '').replace(/\s+/g, ' ').trim();
	assert.doesNotMatch(
		visible,
		/TERM_CACHE_INVALID/,
		`the trigger's visible label is still the raw server code: "${visible}"`,
	);
	assert.equal(visible, 'Help', `the trigger should read one plain word, it reads "${visible}"`);

	// The code is gone from the WHOLE visible banner, not merely from the trigger.
	const bannerText = (bannerEl()?.textContent ?? '').replace(/\s+/g, ' ');
	assert.doesNotMatch(
		bannerText,
		/TERM_CACHE_INVALID/,
		`a raw server code is still visible in the banner: "${bannerText}"`,
	);

	// AND it is gone from every element carrying a monospace face: a `font-mono`
	// chip is how a code presents itself as a code even when the text is a word.
	const monoText = Array.from(document.body.querySelectorAll('.font-mono'))
		.map((n) => (n.textContent ?? '').trim())
		.filter((t) => /^[A-Z][A-Z0-9_]{3,}$/.test(t));
	assert.deepEqual(monoText, [], `a raw code is still shown in a monospace chip: ${monoText.join(', ')}`);

	// The accessible name still carries the code, so nothing is lost to assistive tech.
	assert.match(
		trigger.getAttribute('aria-label') ?? '',
		/TERM_CACHE_INVALID/,
		'the accessible name no longer carries the code; the diagnostic is no longer reachable for a screen reader',
	);
	await unmount();
});

test('A5-C4-1b: the headline resolves FROM THE CODE, in the operator\'s own sentence', async () => {
	await render(
		<SubjectTermAuthorityBanner
			termAuthority={authority({
				code: 'TERM_CACHE_INVALID',
				message: 'Saved term contract failed its semantic revision check.',
			})}
		/>,
	);
	const bannerText = (bannerEl()?.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(
		bannerText,
		new RegExp(OPERATOR_HEADLINE.replace(/\./g, '\\.')),
		`the banner does not carry the operator's headline; it reads: "${bannerText}"`,
	);
	// The state-derived headline named the SOURCE, not the thing to fix. It must
	// not be what a scheduler reads for this code.
	assert.doesNotMatch(
		bannerText,
		/Using saved EnrollPro year and terms/,
		`TERM_CACHE_INVALID still inherits the generic stale-source headline: "${bannerText}"`,
	);

	// The resolver is the single place that decides the words, so the headline is
	// reachable there too and not re-derived in the component.
	const copy = resolveTermAuthorityCopy(
		authority({ code: 'TERM_CACHE_INVALID', message: 'Saved term contract failed its semantic revision check.' }) as never,
	);
	assert.equal(copy.headline, OPERATOR_HEADLINE, 'the resolver does not return the code-aware headline');
	await unmount();
});

test('A5-C4-1c ANTI-DELETION: behind the popover the code AND the raw server sentence are both still there', async () => {
	const rawMessage = 'Saved term contract failed its semantic revision check.';
	await render(
		<SubjectTermAuthorityBanner termAuthority={authority({ code: 'TERM_CACHE_INVALID', message: rawMessage })} />,
	);
	const trigger = triggerEl();
	assert.ok(trigger, 'no diagnostic affordance to open');

	await openPopover(trigger);
	const panel = document.body.querySelector('[data-radix-popper-content-wrapper]') as HTMLElement | null;
	assert.ok(panel, 'the popover did not open on a real pointerdown, so the diagnostic was not exercised');
	const panelText = (panel.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(panelText, /TERM_CACHE_INVALID/, `the raw code is no longer inside the popover: "${panelText}"`);
	assert.match(panelText, new RegExp(rawMessage.replace(/\./g, '\\.')), `the raw server sentence was destroyed: "${panelText}"`);
	await unmount();
});

test('A5-C4-1d CONTROL: a code with no mapping keeps today\'s state-derived headline', async () => {
	// Without this row, 1b would pass even if the resolver replaced EVERY headline
	// with one sentence — which would be a new over-claim, not a fix.
	const unmapped = resolveTermAuthorityCopy(
		authority({ code: 'TERM_CACHE_SOMETHING_ELSE', message: 'anything at all' }) as never,
	);
	assert.equal(unmapped.headline, '', 'an unmapped code invents a headline instead of falling back');
	assert.equal(
		unmapped.description,
		'ATLAS could not confirm the school year and terms it needs for scheduling.',
		'the generic fallback description changed; A3-C4-3b2 pins it and this is not its change',
	);

	// And the rendered banner for that unmapped code still carries the state headline.
	await render(<SubjectTermAuthorityBanner termAuthority={authority({ code: 'TERM_CACHE_SOMETHING_ELSE', message: 'anything at all' })} />);
	const bannerText = (bannerEl()?.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(
		bannerText,
		/Using saved EnrollPro year and terms/,
		`an unmapped code lost the state-derived headline it should keep: "${bannerText}"`,
	);
	await unmount();
});
