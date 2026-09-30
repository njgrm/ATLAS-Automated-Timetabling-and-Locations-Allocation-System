/**
 * A6 — Teaching Load placement feasibility, client (operator decision 14).
 *
 * Proves the client contract end to end at the DOM level:
 *   - the guarded save issues NO PUT when the placement check blocks a class;
 *   - a placeable draft still saves (one PUT per teacher);
 *   - the ONE plain sentence is rendered (the server's own wording);
 *   - the ONE one-click alternative teacher who fits applies the swap;
 *   - the server's typed 409 blockers render the same way (race / other tab).
 *
 * Run: `npm run test:a6-tl-placement-client` (wired in atlas-client/package.json
 * in the same commit).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { act, createElement, useState } from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teaching-load',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	Event: dom.window.Event,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: dom.window.MouseEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	FocusEvent: dom.window.FocusEvent,
	CustomEvent: dom.window.CustomEvent,
	DOMRect: dom.window.DOMRect,
	MutationObserver: dom.window.MutationObserver,
	DocumentFragment: dom.window.DocumentFragment,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= (query: string) => ({
	matches: false, media: query, onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
	return { width: 320, height: 40, top: 0, left: 0, bottom: 40, right: 320, x: 0, y: 0, toJSON: () => ({}) };
};

const { createRoot } = await import('react-dom/client');
const lib = await import('@/lib/teaching-load-placement');
const { TeachingLoadPlacementNotice } = await import('@/components/faculty-assignments/TeachingLoadPlacementNotice');
const { TeachingLoadModals } = await import('@/components/faculty-assignments/TeachingLoadModals');

const SENTENCE = 'Grade 8 Makabansa cannot fit TLE Exploratory – ICT: Francis Miguel Navarro is already booked at the only free time.';

function blockerFixture(): InstanceType<typeof Object> & any {
	return {
		sectionId: 87,
		subjectId: 11,
		facultyId: 25,
		sectionName: 'Grade 8 Makabansa',
		subjectName: 'TLE Exploratory – ICT',
		facultyName: 'Francis Miguel Navarro',
		sentence: SENTENCE,
		alternatives: [{ facultyId: 99, facultyName: 'EDUARDO VILLAREAL', day: 'MONDAY', startTime: '11:30', endTime: '12:15' }],
	};
}

function blockedVerdict() {
	return {
		sectionId: 87, subjectId: 11, facultyId: 25,
		sectionName: 'Grade 8 Makabansa', subjectName: 'TLE Exploratory – ICT', facultyName: 'Francis Miguel Navarro',
		placeable: false, reason: 'NO_AVAILABLE_SLOT', sentence: SENTENCE,
		alternatives: [{ facultyId: 99, facultyName: 'EDUARDO VILLAREAL', day: 'MONDAY', startTime: '11:30', endTime: '12:15' }],
	};
}

const mounts: Array<{ root: any; host: HTMLElement }> = [];
afterEach(async () => {
	for (const { root, host } of mounts.splice(0)) {
		await act(async () => root.unmount());
		host.remove();
	}
	dom.window.document.body.innerHTML = '';
});

test('the guarded save issues NO PUT when a class cannot be placed', async () => {
	const putCalls: string[] = [];
	const api = {
		post: async () => ({ data: { lines: [blockedVerdict()] } }),
		put: async (url: string) => { putCalls.push(url); return { data: {} }; },
	};
	const outcome = await lib.runPlacementGuardedSave({
		api,
		schoolId: 1,
		schoolYearId: 9,
		drafts: [{ facultyId: 25, version: 1, assignments: [{ subjectId: 11, sectionIds: [87] }] }],
	});
	assert.equal(outcome.status, 'blocked');
	assert.equal(putCalls.length, 0, 'no PUT is issued on a blocked check');
	if (outcome.status === 'blocked') {
		assert.equal(outcome.blockers.length, 1);
		assert.equal(lib.describeBlocker(outcome.blockers[0]!), SENTENCE, 'the ONE plain sentence is the server wording');
		assert.equal(lib.firstAlternative(outcome.blockers[0]!)?.facultyName, 'EDUARDO VILLAREAL');
	}
});

test('a placeable draft still saves (one PUT per teacher)', async () => {
	const putCalls: string[] = [];
	const api = {
		post: async () => ({ data: { lines: [{ ...blockedVerdict(), placeable: true, sentence: null, alternatives: [] }] } }),
		put: async (url: string) => { putCalls.push(url); return { data: {} }; },
	};
	const outcome = await lib.runPlacementGuardedSave({
		api,
		schoolId: 1,
		schoolYearId: 9,
		drafts: [{ facultyId: 25, version: 1, assignments: [{ subjectId: 11, sectionIds: [87] }] }],
	});
	assert.equal(outcome.status, 'committed');
	assert.deepEqual(putCalls, ['/faculty-assignments/25']);
});

test('a transport failure in the check does not wedge the save', async () => {
	const putCalls: string[] = [];
	const api = {
		post: async () => { throw new Error('network'); },
		put: async (url: string) => { putCalls.push(url); return { data: {} }; },
	};
	const outcome = await lib.runPlacementGuardedSave({
		api,
		schoolId: 1,
		schoolYearId: 9,
		drafts: [{ facultyId: 25, version: 1, assignments: [{ subjectId: 11, sectionIds: [87] }] }],
	});
	assert.equal(outcome.status, 'committed');
	assert.deepEqual(putCalls, ['/faculty-assignments/25']);
});

test('the server 409 blockers render the same way (race / other tab)', () => {
	const error = { response: { data: { code: 'TEACHING_LOAD_UNPLACEABLE', details: { blockers: [blockerFixture()] } } } };
	const blockers = lib.blockersFromError(error);
	assert.equal(blockers.length, 1);
	assert.equal(lib.describeBlocker(blockers[0]!), SENTENCE);
	assert.equal(blockers[0]!.sectionId, 87);
	assert.notEqual(lib.blockersFromError(new Error('nope')).length, 1);
});

test('the one-click alternative moves exactly the blocked pair', () => {
	const current = [{ subjectId: 11, sectionIds: [87, 90] }, { subjectId: 12, sectionIds: [87] }];
	const removed = lib.withPlacementPair(current, 11, 87, 'remove');
	assert.deepEqual(removed, [{ subjectId: 11, sectionIds: [90] }, { subjectId: 12, sectionIds: [87] }]);
	const added = lib.withPlacementPair(removed, 11, 87, 'add');
	assert.deepEqual(added, [{ subjectId: 11, sectionIds: [90, 87] }, { subjectId: 12, sectionIds: [87] }]);
});

test('the notice renders ONE plain sentence and the one-click alternative applies', async () => {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	mounts.push({ root, host });
	const calls: Array<[string, string]> = [];
	const blocker = blockerFixture();
	await act(async () => {
		root.render(createElement(TeachingLoadPlacementNotice, {
			blockers: [blocker],
			onUseAlternative: (b: any, a: any) => calls.push([b.facultyName, a.facultyName]),
		}));
	});
	const sentence = host.querySelector('[data-testid="teaching-load-placement-sentence"]');
	assert.equal(sentence?.textContent, SENTENCE, 'the ONE plain sentence is rendered verbatim');
	const button = host.querySelector('[data-testid="teaching-load-placement-alternative"]') as HTMLElement | null;
	assert.ok(button, 'the one-click alternative is rendered');
	await act(async () => { button!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	assert.deepEqual(calls, [['Francis Miguel Navarro', 'EDUARDO VILLAREAL']], 'clicking the alternative swaps in the teacher who fits');
});

// ─── B2 (QA REJECT_UX): the refusal is never a trap ─────────────────────────

function modalsProps(blockers: any[], setBlockers: (next: any[]) => void) {
	return {
		summaryModalOpen: false,
		onSummaryModalOpenChange: () => {},
		autoFillResult: null,
		onApplySuggestion: () => {},
		suggestionApplying: false,
		saveWarningOpen: false,
		onSaveWarningOpenChange: () => {},
		onSaveConfirm: () => {},
		discardConfirmOpen: false,
		onDiscardConfirmOpenChange: () => {},
		onDiscardConfirm: () => {},
		activeDraftCount: 0,
		reviewModalOpen: false,
		onReviewModalOpenChange: () => {},
		reviewInspector: null,
		reviewTitle: 'Review',
		reviewDescription: 'Review',
		saveChangesConfirmOpen: false,
		onSaveChangesConfirmOpenChange: () => {},
		onSaveChangesConfirm: () => {},
		pendingChangeCount: 0,
		pendingChangeTeacherCount: 0,
		pendingChangeScope: '',
		placementBlockers: blockers,
		onUsePlacementAlternative: () => {},
		onDismissPlacementBlockers: () => setBlockers([]),
		placementBusy: false,
	};
}

async function mountBlockedSaveDialog(): Promise<HTMLElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	mounts.push({ root, host });
	function Harness() {
		const [blockers, setBlockers] = useState<any[]>([blockerFixture()]);
		return createElement(TeachingLoadModals as any, modalsProps(blockers, (next) => setBlockers(next)));
	}
	await act(async () => { root.render(createElement(Harness)); });
	return host;
}

test('the blocked-save dialog is dismissed by Escape and clears the blockers', async () => {
	await mountBlockedSaveDialog();
	assert.ok(dom.window.document.querySelector('[data-testid="teaching-load-placement-dialog"]'), 'the refusal dialog is open');
	await act(async () => {
		dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
	});
	assert.equal(dom.window.document.querySelector('[data-testid="teaching-load-placement-dialog"]'), null, 'Escape dismisses the refusal');
});

test('the blocked-save dialog has a visible Close control that clears the blockers', async () => {
	await mountBlockedSaveDialog();
	const close = dom.window.document.querySelector('[data-testid="teaching-load-placement-close"]') as HTMLElement | null;
	assert.ok(close, 'a visible way out is always rendered');
	await act(async () => { close!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	assert.equal(dom.window.document.querySelector('[data-testid="teaching-load-placement-dialog"]'), null, 'Close dismisses the refusal');
});

test('when no replacement teacher fits the notice still renders a way out', async () => {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	mounts.push({ root, host });
	let dismissed = 0;
	const blocker = { ...blockerFixture(), alternatives: [] };
	await act(async () => {
		root.render(createElement(TeachingLoadPlacementNotice, { blockers: [blocker], onDismiss: () => { dismissed += 1; } }));
	});
	assert.equal(host.querySelector('[data-testid="teaching-load-placement-alternative"]'), null, 'no alternative button is offered');
	assert.ok(host.querySelector('[data-testid="teaching-load-placement-guidance"]'), 'one short line says what to change');
	const dismiss = host.querySelector('[data-testid="teaching-load-placement-dismiss"]') as HTMLElement | null;
	assert.ok(dismiss, 'a way out is still rendered when nobody fits');
	assert.equal(host.querySelector('[data-testid="teaching-load-placement-sentence"]')?.textContent, SENTENCE);
	await act(async () => { dismiss!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
	assert.equal(dismissed, 1, 'the way out clears the refusal');
});
