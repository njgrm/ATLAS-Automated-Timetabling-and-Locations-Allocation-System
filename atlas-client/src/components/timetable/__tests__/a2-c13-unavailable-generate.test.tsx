/**
 * A2 C13 (item 3) — rendered evidence that a DISABLED lifecycle control reads as
 * plainly unavailable, and that its reason is on screen.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `SimpleGenerateAction` rendered `variant="default"` with `disabled`. `default` is
 * a solid `bg-primary`, and the shared base adds `disabled:opacity-50`, so the
 * operator saw a PALE GREEN button: *"the disabled Generate reads as a pale-green
 * near-miss."* For a scheduler the worst reading is a control that looks like the
 * next step and is not.
 *
 * ── WHY NOT `disabled:opacity-100` ────────────────────────────────────────────
 * Two same-property Tailwind utilities are resolved by STYLESHEET order, not class
 * order, so that "fix" is a coin flip that flips on the next Tailwind build. The
 * base string is untouched. The defect is specifically the retained `bg-primary`,
 * so the row below asserts on COLOUR, not on opacity.
 *
 * ── WHY BOTH CONTROLS ARE IN ONE HOST ─────────────────────────────────────────
 * `SimplePublishAction` sits in the same header row and took the same `default`
 * variant when disabled. Rendering the two in one container is what lets the row
 * compare their class lists directly instead of asserting that each merely lacks
 * green. In the LIVE header the two occupy a mutually exclusive ternary slot and
 * never co-render; this host is a CONTROL COMPARISON, not a claim about a frame.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
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

const { createRoot } = await import('react-dom/client');
const { buttonVariants } = await import('@/ui/button-variants');
const {
	SimpleGenerateAction,
	SimplePublishAction,
	resolveSimpleGenerateActionState,
	resolveSimplePublishActionState,
	SETUP_INPUTS_NOT_READY_SHORT,
} = await import('@/components/timetable/simple/SimpleHeaderHelpers');
const { deriveTimetableCapabilities } = await import('@/lib/timetable-capabilities');

const mounted: Array<{ root: ReturnType<typeof createRoot>; host: HTMLElement }> = [];

after(() => {
	for (const { root, host } of mounted) {
		act(() => root.unmount());
		host.remove();
	}
});

function renderBoth(generate: Parameters<typeof resolveSimpleGenerateActionState>[0], publish: Parameters<typeof resolveSimplePublishActionState>[0]) {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	act(() => {
		root.render(createElement(
			'div',
			{ className: 'flex items-center gap-2' },
			createElement(SimpleGenerateAction, { primary: true, actionState: resolveSimpleGenerateActionState(generate), onClick: () => {} }),
			createElement(SimplePublishAction, { primary: true, actionState: resolveSimplePublishActionState(publish), onClick: () => {} }),
		));
	});
	mounted.push({ root, host });
	return host;
}

const testId = (host: HTMLElement, id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const tokens = (className: string) => new Set(className.split(/\s+/).filter(Boolean));

/**
 * The classes the shared `unavailable` variant contributes ON TOP OF THE BASE.
 *
 * `buttonVariants()` always emits the base string first, so comparing two variant
 * outputs and keeping what `unavailable` adds is what isolates the variant itself —
 * asserting on the whole output would only re-assert the shared base, which both
 * the old and the new variant carry identically.
 */
const UNAVAILABLE_ONLY_TOKENS = (() => {
	const base = tokens(buttonVariants({ variant: 'outline' }));
	return [...tokens(buttonVariants({ variant: 'unavailable' }))].filter((token) => !base.has(token));
})();

/**
 * L4 — a disabled Generate is grey, carries the new variant, and shows its reason
 * BESIDE it rather than only in a tooltip.
 *
 * The discriminating half is the COLOUR: at base the disabled Generate carries
 * `bg-primary`, so the first assert fails and the row cannot pass vacuously.
 */
test('L4 a disabled Generate carries no primary colour, uses the unavailable variant, and shows its reason beside it', () => {
	const blocked = deriveTimetableCapabilities({
		scopeResolved: true,
		curriculumState: 'blocked',
		generating: false,
		isPreGeneration: false,
		hasGeneratedRun: false,
		isPublished: false,
		latestRunFailed: false,
		hardCount: 0,
		unassignedCount: 0,
		softCount: 0,
		hasSelectedEntry: false,
		requestPendingCount: 0,
	});
	const gate = blocked.gates.generation;
	assert.ok(gate.reason, 'the control under test is genuinely disabled by a real gate');
	// The short form is authored beside the full reason at the SAME `denied()` call,
	// so the two cannot drift — and the visible sentence obeys §8's ≤ 6 words.
	assert.ok(gate.shortReason, 'a gate with a reason also carries a short form');
	assert.ok(gate.shortReason.split(/\s+/).length <= 6, `the visible reason is ≤ 6 words, got "${gate.shortReason}"`);

	const host = renderBoth(
		{ canPlanOrGenerate: false, loading: false, generating: false, gateReason: gate.reason, gateShortReason: gate.shortReason },
		{ publicationEnabled: false, isRunPublished: false, gateReason: 'No generated timetable exists yet to publish.', gateShortReason: 'No generated schedule to publish' },
	);

	const generate = testId(host, 'timetable-simple-generate-action');
	assert.ok(generate, 'Generate renders');
	assert.equal(generate.getAttribute('disabled'), '', 'the control under test really is disabled');

	// THE DEFECT. A solid green at 50% opacity is a pale-green near-miss.
	assert.doesNotMatch(generate.className, /\bbg-primary\b/, 'a disabled control must not wear the primary background');
	assert.doesNotMatch(generate.className, /\btext-primary-foreground\b/, 'nor its paired foreground');
	assert.doesNotMatch(generate.className, /\btext-(emerald|green|primary)\b/, 'nor any green at all');
	// ...and it wears the shared unavailable treatment instead.
	const generateTokens = tokens(generate.className);
	for (const token of UNAVAILABLE_ONLY_TOKENS) {
		assert.ok(generateTokens.has(token), `the disabled Generate carries the shared unavailable class "${token}"`);
	}

	// A7 c12b (decision 8 / CORRECTION item 3) SUPERSEDED the visible sentence for
	// THIS gate: the operator named the bare `Setup inputs are not ready` line as
	// part of the crowded header, and §8 puts a disabled control's reason in a
	// `@/ui` Tooltip. `GatedAction` still carries it, and the full sentence stays on
	// the control's aria-label asserted below. The old claim is retained as the
	// superseded row (AGENTS.md §16):
	//   const reason = testId(host, 'timetable-simple-generate-short-reason');
	//   assert.equal(reason.textContent, gate.shortReason);
	assert.equal(gate.shortReason, SETUP_INPUTS_NOT_READY_SHORT,
		'precondition: this is the one sentence decision 8 removes, and the constant and the gate agree');
	assert.equal(testId(host, 'timetable-simple-generate-short-reason'), null,
		'the standalone `Setup inputs are not ready` sentence is no longer a visible row');
	// The FULL sentence is still on the control, so nothing depends on seeing the line.
	assert.equal(
		generate.getAttribute('aria-label'),
		`Generate schedule — ${gate.reason}`,
		'the accessible name keeps the full sentence verbatim',
	);
	assert.doesNotMatch(host.innerHTML, /\stitle=/, 'no raw title attribute carries the explanation');
});

/**
 * L5 — the disabled Publish wears the SAME unavailable treatment.
 *
 * At base it also wears `default`, so this row fails on the shared-class comparison
 * exactly as L4 fails on the colour.
 */
test('L5 a disabled Publish in the same row uses the same unavailable classes as the disabled Generate', () => {
	const host = renderBoth(
		{ canPlanOrGenerate: false, loading: false, generating: false, gateReason: 'Setup inputs for the active school year are not ready yet.', gateShortReason: 'Setup inputs are not ready' },
		{ publicationEnabled: false, isRunPublished: false, gateReason: 'Fix 3 hard blockers before publishing.', gateShortReason: 'Fix 3 hard blockers' },
	);

	const generate = testId(host, 'timetable-simple-generate-action');
	const publish = testId(host, 'timetable-simple-publish-action');
	assert.ok(generate && publish, 'both lifecycle controls render');
	assert.equal(generate.getAttribute('disabled'), '');
	assert.equal(publish.getAttribute('disabled'), '');

	// One row, one "unavailable" look (§8 "One look per control").
	const generateTokens = tokens(generate.className);
	const publishTokens = tokens(publish.className);
	for (const token of UNAVAILABLE_ONLY_TOKENS) {
		assert.ok(publishTokens.has(token), `the disabled Publish carries "${token}" too`);
		assert.ok(generateTokens.has(token), `and so does the disabled Generate: "${token}"`);
	}
	for (const token of publishTokens) {
		if (!token.startsWith('h-') && !token.startsWith('gap-') && !token.startsWith('px-') && !token.startsWith('text-')) {
			assert.ok(generateTokens.has(token), `the two unavailable looks differ on "${token}" — one look per control`);
		}
	}
	assert.doesNotMatch(publish.className, /\bbg-primary\b/);
	assert.doesNotMatch(publish.className, /\bbg-secondary\b/);
	assert.doesNotMatch(generate.className, /\bbg-secondary\b/);

	// A7 c12b (CORRECTION item 3) narrows the A2 C13 override to the ONE sentence
	// the operator objected to: the Generate setup sentence is Tooltip-only, while
	// Publish keeps its VISIBLE reason. Retained as the superseded row:
	//   const generateReason = testId(host, 'timetable-simple-generate-short-reason');
	//   assert.equal(generateReason.className, publishReason.className);
	assert.equal(testId(host, 'timetable-simple-generate-short-reason'), null,
		'the setup sentence is Tooltip-only on Generate');
	const publishReason = testId(host, 'timetable-simple-publish-short-reason');
	assert.ok(publishReason, 'Publish keeps its visible reason — the override is narrowed, not withdrawn');
});

/**
 * L5b — the enabled state is UNCHANGED. This is the control that keeps L4/L5 honest:
 * a fix that made every button grey would satisfy the rows above and break the
 * product, so the primary slot must still be a solid `bg-primary` when it can act.
 */
test('L5b the ENABLED Generate and Publish still wear the solid primary — the unavailable look is disabled-only', () => {
	const host = renderBoth(
		{ canPlanOrGenerate: true, loading: false, generating: false, gateReason: null },
		{ publicationEnabled: true, isRunPublished: false, gateReason: null },
	);
	const generate = testId(host, 'timetable-simple-generate-action');
	const publish = testId(host, 'timetable-simple-publish-action');
	assert.ok(generate && publish);
	assert.equal(generate.getAttribute('disabled'), null, 'an available Generate is enabled');
	assert.match(generate.className, /\bbg-primary\b/, 'and is still the solid primary');
	assert.match(publish.className, /\bbg-primary\b/, 'Publish too');
	assert.equal(testId(host, 'timetable-simple-generate-short-reason'), null, 'no reason is printed for a control that can act');
	assert.equal(testId(host, 'timetable-simple-publish-short-reason'), null);
});
