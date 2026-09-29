/**
 * A2 mc, S4 — the preview speaks plain words. RENDERED evidence.
 *
 * THREE LEAKS, all measured at base `c57b8e1d`:
 *
 *  1. RAW ENGINE CODES. `manual-edit.service.ts:919` read
 *     `VIOLATION_TITLES[v.code] ?? v.code`, and the map had no entry for
 *     `SECTION_TIME_CONFLICT`, `ROOM_CAPACITY_EXCEEDED`, `UNASSIGNED_SECTION` or
 *     `INCOMPLETE_MODULAR_GROUP` — so the raw enum is literally what rendered.
 *  2. RAW INVARIANT TEXT. `manual-edit.service.ts:451` composed
 *     `Manual candidate ${entry.entryId} rejected by shared invariant: ${reason}.`
 *     and `buildHumanConflicts` falls back to `v.message` for any code without a
 *     `case`, so that engine sentence arrived as `humanDetail`.
 *  3. ONE CARD PER SOFT VIOLATION — 525 rows on the operator's drill.
 *
 * The rows below RENDER the real production `ManualEditConflictInspector` with a
 * preview carrying EVERY code the manual-edit path can emit, and read the
 * resulting DOM text. This is a rendered assertion on the real component, not a
 * source-text one (packet §6, S4e).
 *
 * Rows:
 *   S4a the request starts and `Checking this change…` is in the SAME slot the
 *        results occupy, before the await resolves;
 *   S4b/e no rendered text matches the raw-code / raw-invariant / raw-entry-id
 *        patterns, even when the server sends exactly what it used to send;
 *   S4c HARD conflicts come first and are deduplicated, with the count carried;
 *   S4d SOFT warnings are summarised by cause with a count and a plain next step
 *        — 525 cards become a handful of lines;
 *   S4f an unmapped code degrades to a plain sentence and never to the enum.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
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
const { ManualEditConflictInspector } = await import('@/components/manual-edit/ManualEditConflictInspector');
const {
	CHECKING_THIS_CHANGE,
	UNNAMED_RULE_TITLE,
	plainConflictTitle,
	plainConflictDetail,
	summarizeConflicts,
} = await import('@/lib/manual-edit-conflict-summary');

async function mount(element: unknown): Promise<HTMLElement> {
	const host = document.createElement('div');
	document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => { root.render(element as never); });
	return host;
}

function renderInspector(overrides: Record<string, unknown> = {}): Promise<HTMLElement> {
	return mount(createElement(ManualEditConflictInspector, {
		previewResult: null,
		previewLoading: false,
		entryViolations: [],
		commitLoading: false,
		onCommit: () => {},
		formatViolationMessage: (message: string) => message,
		...overrides,
	} as never));
}

/** Every code `manual-edit.service.ts` VIOLATION_TITLES maps, plus the four it missed. */
const EVERY_CODE = [
	'FACULTY_TIME_CONFLICT', 'ROOM_TIME_CONFLICT', 'SECTION_TIME_CONFLICT',
	'FACULTY_OVERLOAD', 'FACULTY_SUBJECT_NOT_QUALIFIED', 'LACKING_FACULTY',
	'INCOMPLETE_MODULAR_GROUP', 'ROOM_TYPE_MISMATCH', 'ROOM_FEATURE_MISMATCH',
	'FACULTY_DAILY_MAX_EXCEEDED', 'ROOM_CAPACITY_EXCEEDED', 'UNASSIGNED_SECTION',
];

/**
 * A preview shaped exactly like the server's worst case at base `c57b8e1d`:
 * the server's own `humanTitle`/`humanDetail` values, raw codes and the raw
 * invariant sentence included.
 */
function worstCasePreview() {
	const hard = EVERY_CODE.map((code, index) => ({
		code,
		severity: 'HARD' as const,
		// What the base server really sent for an unmapped code.
		humanTitle: ['SECTION_TIME_CONFLICT', 'ROOM_CAPACITY_EXCEEDED', 'UNASSIGNED_SECTION', 'INCOMPLETE_MODULAR_GROUP'].includes(code)
			? code
			: 'Faculty Time Conflict',
		// And what it really sent for a manual-candidate invariant rejection.
		humanDetail: `Manual candidate entry-${index + 1}::t1 rejected by shared invariant: ${code}.`,
	}));
	// The operator's drill: 525 soft warnings.
	const soft = Array.from({ length: 525 }, (_, index) => ({
		code: index % 2 === 0 ? 'FACULTY_EXCESSIVE_IDLE_GAP' : 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED',
		severity: 'SOFT' as const,
		humanTitle: 'Excessive Idle Gap',
		humanDetail: 'Mr Cruz has 95 min idle gap on Mon',
	}));
	return {
		allowed: false,
		hardViolations: hard.map((conflict) => ({ code: conflict.code, severity: 'HARD', message: '', schoolId: 1, schoolYearId: 1, runId: 1, entities: {} })),
		softViolations: [],
		violationDelta: { hardBefore: 6, hardAfter: 12, softBefore: 520, softAfter: 525 },
		humanConflicts: [...hard, ...soft],
		affectedEntries: [],
		policyImpactSummary: [],
	} as never;
}

test('S4a RENDERED: the instant a preview starts, "Checking this change…" appears where the results appear', async () => {
	const host = await renderInspector({ previewLoading: true });
	const checking = host.querySelector('[data-testid="manual-edit-preview-checking"]');
	assert.ok(checking, 'the checking state renders while the request is in flight');
	assert.equal(host.querySelector('[data-testid="manual-edit-preview-checking-text"]')?.textContent, CHECKING_THIS_CHANGE);
	assert.equal(CHECKING_THIS_CHANGE, 'Checking this change…', 'the exact operator sentence, not a spinner alone');
	assert.equal(host.querySelector('[data-testid="manual-edit-hard-conflict"]'), null,
		'and no result is claimed before the server has answered');

	// It is GONE once the results land — the same slot, not an added band.
	const resolved = await renderInspector({ previewLoading: false, previewResult: worstCasePreview() });
	assert.equal(resolved.querySelector('[data-testid="manual-edit-preview-checking"]'), null,
		'the checking sentence is replaced by the results, in the same slot');
});

test('S4b/e RENDERED: no raw code, no raw invariant sentence, no raw entry id reaches the screen', async () => {
	const host = await renderInspector({ previewResult: worstCasePreview() });
	const text = host.textContent ?? '';
	// The packet's own forbidden pattern, asserted on RENDERED text.
	assert.doesNotMatch(text, /SECTION_TIME_CONFLICT/, 'the raw engine code is unreachable from rendered text');
	assert.doesNotMatch(text, /rejected by shared invariant/, 'the engine phrase is unreachable');
	assert.doesNotMatch(text, /Manual candidate/, 'and so is the engine subject');
	assert.doesNotMatch(text, /entry-\d+::t\d/, 'no raw entry id is printed');
	// The four codes the base server had no title for now read in plain words.
	for (const plain of ['Section double-booked', 'Room is too small for this class', 'This class was not placed', 'Incomplete modular group']) {
		assert.match(text, new RegExp(plain), `"${plain}" is what the operator reads instead of the enum`);
	}
	// The packet's target sentence survives: the FACULTY_TIME_CONFLICT detail is
	// still the approved plain wording, not a scrubbed mess.
	assert.match(text, /ATLAS refused this change because it breaks a rule every class must follow/,
		'the invariant refusal is stated as a sentence about the rule');
});

test('S4c RENDERED: blockers come FIRST, deduplicated, with the count carried', async () => {
	// One blocker reported for ten sections: ONE cause, not ten cards.
	const repeated = Array.from({ length: 10 }, () => ({
		code: 'FACULTY_TIME_CONFLICT',
		severity: 'HARD' as const,
		humanTitle: 'Faculty Time Conflict',
		humanDetail: 'Mr Cruz is already teaching ESP on Mon 7:00 AM–7:45 AM',
	}));
	const soft = [{
		code: 'FACULTY_EXCESSIVE_IDLE_GAP',
		severity: 'SOFT' as const,
		humanTitle: 'Excessive Idle Gap',
		humanDetail: 'Mr Cruz has 95 min idle gap on Mon',
	}];
	const host = await renderInspector({
		previewResult: {
			allowed: false,
			hardViolations: repeated.map((conflict) => ({ code: conflict.code, severity: 'HARD', message: '', schoolId: 1, schoolYearId: 1, runId: 1, entities: {} })),
			softViolations: [],
			violationDelta: { hardBefore: 9, hardAfter: 10, softBefore: 0, softAfter: 1 },
			humanConflicts: [...soft, ...repeated],
			affectedEntries: [],
			policyImpactSummary: [],
		} as never,
	});

	const cards = host.querySelectorAll('[data-testid="manual-edit-hard-conflict"]');
	assert.equal(cards.length, 1, 'ten identical blocker reports are ONE card, not ten');
	assert.equal(cards[0].getAttribute('data-conflict-occurrences'), '10', 'and it carries the real count');
	assert.equal(host.querySelector('[data-testid="manual-edit-hard-conflict-occurrences"]')?.textContent, '× 10');

	// HARD renders before SOFT even though the SOFT conflict was first in the array.
	const html = host.innerHTML;
	assert.ok(
		html.indexOf('manual-edit-hard-conflict') < html.indexOf('manual-edit-soft-cause'),
		'blockers render first, whatever order the server sent them in',
	);
});

test('S4d RENDERED: soft warnings are summarised by cause — 525 cards become a handful of lines', async () => {
	const host = await renderInspector({ previewResult: worstCasePreview() });
	const causes = host.querySelectorAll('[data-testid="manual-edit-soft-cause"]');
	assert.equal(causes.length, 2, '525 warnings of two causes render as TWO lines');
	assert.equal(host.querySelectorAll('[data-testid="manual-edit-hard-conflict"]').length, 12,
		'twelve distinct blockers are twelve distinct causes');

	const idle = Array.from(causes).find((node) => node.getAttribute('data-warning-code') === 'FACULTY_EXCESSIVE_IDLE_GAP');
	assert.ok(idle, 'the idle-gap cause is listed');
	assert.equal(idle.getAttribute('data-warning-count'), '263', 'and it carries the REAL count for its cause');
	assert.match(idle.textContent ?? '', /263 warnings/, 'stated in words beside the cause');
	assert.match(idle.textContent ?? '', /Move a class into the gap/, 'with the plain next step for THAT cause');
	const consecutive = Array.from(causes).find((node) => node.getAttribute('data-warning-code') === 'FACULTY_CONSECUTIVE_LIMIT_EXCEEDED');
	assert.equal(consecutive?.getAttribute('data-warning-count'), '262', 'each cause carries its own real count');
	assert.match(consecutive?.textContent ?? '', /Break the run of periods/,
		'and a different cause gets a different next step, so the summary is not one repeated line');

	assert.ok((host.textContent ?? '').length < 8000,
		`the rendered results stay readable; 525 cards would not fit this budget (got ${(host.textContent ?? '').length} chars)`);
});

test('S4f an unmapped code degrades to a plain sentence, never to the enum', () => {
	assert.equal(plainConflictTitle('A_CODE_NOBODY_MAPPED', 'A_CODE_NOBODY_MAPPED'), UNNAMED_RULE_TITLE,
		'the title guard replaces a raw title even when the server sends one');
	assert.equal(plainConflictTitle('A_CODE_NOBODY_MAPPED', null), UNNAMED_RULE_TITLE);
	assert.equal(plainConflictDetail('A_CODE_NOBODY_MAPPED', 'broke A_RAW_TOKEN here'), 'broke a scheduling rule here',
		'a residual raw token in the DETAIL is replaced by words, not printed');
	assert.equal(
		plainConflictDetail('X', 'Manual candidate entry-9::t1 rejected by shared invariant: ROOM_CAPACITY_EXCEEDED.'),
		'ATLAS refused this change because it breaks a rule every class must follow: Room is too small for this class.',
		'the whole invariant sentence, including its raw reason, is composed away',
	);
	// A real server sentence is preserved, not over-scrubbed.
	assert.equal(plainConflictDetail('FACULTY_OVERLOAD', 'Mr Cruz exceeds weekly teaching hour limit'), 'Mr Cruz exceeds weekly teaching hour limit');
	// The guard is stateless: a `/g` regex would alternate here and let the second
	// token through.
	for (let i = 0; i < 3; i += 1) {
		assert.equal(plainConflictTitle('UNMAPPED', 'FIRST_RAW'), UNNAMED_RULE_TITLE, `probe ${i + 1} is stateless`);
	}
});

test('S4g the summary derivation is pure: HARD first, then SOFT by cause', () => {
	const { hard, soft } = summarizeConflicts([
		{ code: 'B_SOFT', severity: 'SOFT', humanTitle: 't', humanDetail: 'd' },
		{ code: 'A_HARD', severity: 'HARD', humanTitle: 't', humanDetail: 'd' },
		{ code: 'B_SOFT', severity: 'SOFT', humanTitle: 't', humanDetail: 'd' },
	] as never);
	assert.deepEqual(hard.map((c) => c.code), ['A_HARD']);
	assert.equal(hard[0].occurrences, 1);
	assert.equal(soft.length, 1, 'two SOFT of one cause are one line');
	assert.equal(soft[0].count, 2);
	assert.equal(soft[0].sameDetail, true, 'identical details need no "and the rest differ" clause');
});
