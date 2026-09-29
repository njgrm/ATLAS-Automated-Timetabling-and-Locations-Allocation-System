/**
 * A3 p1 — why Save is off, said out loud, for EVERY reason.
 *
 * THE DEFECT
 * ==========
 * On staging (2026-09-29) `/faculty/preferences` rendered a healthy teacher's
 * grid with Save and "Anything else" disabled and no reason anywhere on the
 * page. `writesDisabled` was true because `schoolYearId` was null, but the only
 * self-explaining case was `termUnresolved` — so the one case that actually
 * happened was the one case that said nothing. Five reasons could disable that
 * button and exactly one of them explained itself.
 *
 * WHAT IS PROVED HERE (labels corrected in A3 p1 correction round 1, N10 —
 * round 1 of this header said "R1-R5" for six rows and "48 combinations" for a
 * row that asserts 96; both numbers were wrong)
 * =============================================================================
 *  R1-R6  Each of the SIX reasons renders its own sentence, on the same row as
 *         the button, with Save disabled. R4 is the silent hole from the outage.
 *         R5 is the unresolved ordered term, and its sentence is the fixed
 *         short consequence — NOT the card's detailed reason, which is a
 *         different string owned by a different surface (B1), and which may
 *         legitimately contain a raw EnrollPro code (B2). B2's end-to-end proof,
 *         driven by a real coded payload, is A3P1-B3 in
 *         `a3p1-teacher-prefs-stale-read-polarity.test.ts`.
 *  R7      THE INVARIANT: `reason` is non-null if and only if writes are
 *         disabled, across all 48 combinations of the page's inputs (2 x 2 x 2
 *         x 2 nullable states x 3 resolution states — the whole input space).
 *         One function computes both, so the flag the button reads and the
 *         sentence the operator reads cannot drift apart. The round-1 figure
 *         of 96 counted a hand-written `unresolvedTermReason` dimension that
 *         B1 + B2 removed, so the number is restated to match reality. Every
 *         reason produced here is also asserted free of raw enum tokens.
 *  R8      A reason is NEVER shown when the page did not block the write, and a
 *         save in flight is not a reason (it would flicker on every press).
 *  R9      The reason is on the SAME row as the button, not a block above it.
 *  R10-R12 The save receipt is truthful about the next timetable, and honest
 *         when nothing was written.
 *  R13     N6: the header chip and the receipt sentence AGREE, so a save that
 *         wrote nothing cannot show "Saved" beside "Nothing to save".
 *  R14-R15 The chip's derived label for an unsaved teacher is honest.
 *
 * Run: `npm run test:a3p1-prefs-save`
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import type { ConcernSaveAvailabilityInput, ConcernYearResolution } from '../teacher-concern-helpers';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/a3p1-prefs-save',
	pretendToBeVisual: true,
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	localStorage: dom.window.localStorage,
	sessionStorage: dom.window.sessionStorage,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLSelectElement: dom.window.HTMLSelectElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	Element: dom.window.Element,
	DocumentFragment: dom.window.DocumentFragment,
	NodeFilter: dom.window.NodeFilter,
	SVGElement: dom.window.SVGElement,
	Node: dom.window.Node,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	getComputedStyle: dom.window.getComputedStyle,
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
	scrollTo: () => {},
	IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');
const { MemoryRouter } = await import('react-router-dom');

const { default: TeacherConcernWorkspace } = await import('../TeacherConcernWorkspace');
const { concernSaveStateLabel, concernSaveWroteAnything, describeSavedConcern, resolveConcernSaveAvailability } = await import('../teacher-concern-helpers');

/**
 * Render, then SNAPSHOT the HTML into a detached node before unmounting.
 * Unmounting clears the live host, so the markup must be copied out first or
 * every assertion reads an empty string and passes vacuously.
 */
async function renderAndUnmount(node: unknown): Promise<HTMLDivElement> {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	try {
		await act(async () => {
			root.render(createElement(MemoryRouter, { initialEntries: ['/faculty/preferences'] }, node as never));
		});
		await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
		const snapshot = dom.window.document.createElement('div');
		snapshot.innerHTML = host.innerHTML;
		return snapshot;
	} finally {
		await act(async () => { root.unmount(); });
		dom.window.document.body.removeChild(host);
	}
}

/** The workspace as the page builds it, with only the Save-affecting bits varied. */
function workspace(props: { writesDisabled: boolean; saveDisabledReason: string | null; facultyName?: string | null }) {
	return createElement(TeacherConcernWorkspace, {
		facultyName: props.facultyName === undefined ? 'AGUILAR, CARLO MIGUEL' : props.facultyName,
		availability: null,
		pickerSlots: [],
		onPickerChange: () => {},
		notes: '',
		onNotesChange: () => {},
		writesDisabled: props.writesDisabled,
		saving: false,
		onSave: () => {},
		saveDisabledReason: props.saveDisabledReason,
	});
}

function reasonNode(host: HTMLElement): HTMLElement | null {
	return host.querySelector('[data-testid="concern-save-disabled-reason"]');
}
function saveButton(host: HTMLElement): HTMLButtonElement | null {
	return host.querySelector('[data-testid="concern-save-button"]');
}

/** The page's own inputs for one of the six reasons. */
function inputsFor(reason: 'school' | 'yearPending' | 'yearFailed' | 'yearMissing' | 'term' | 'teacher' | 'none'): ConcernSaveAvailabilityInput {
	// No `unresolvedTermReason` here on purpose (B1 + B2): the Save row's term
	// sentence is a fixed consequence, not a function of the card's detail, so
	// this fixture has nothing to hand it. The card-side code path is proved
	// against a REAL coded payload in A3P1-B3.
	const base = { actorSchoolId: 1, schoolYearId: 2, activeTermIndex: 1, selectedFacultyId: 7, yearResolution: 'RESOLVED' as ConcernYearResolution };
	switch (reason) {
		case 'school': return { ...base, actorSchoolId: null };
		case 'yearPending': return { ...base, schoolYearId: null, yearResolution: 'PENDING' };
		case 'yearFailed': return { ...base, schoolYearId: null, yearResolution: 'FAILED' };
		case 'yearMissing': return { ...base, schoolYearId: null, yearResolution: 'RESOLVED' };
		case 'term': return { ...base, activeTermIndex: null };
		case 'teacher': return { ...base, selectedFacultyId: null };
		case 'none': return { ...base };
	}
}

// ═══ R1-R5 — one rendered sentence per reason, beside a disabled Save ═══════

const REASONS = [
	{ key: 'school', test: 'R1 no actor school scope', must: /no school/i },
	{ key: 'yearPending', test: 'R2 a read in flight', must: /checking/i },
	{ key: 'yearFailed', test: 'R3 the school year could not be read', must: /school year/i },
	{ key: 'yearMissing', test: 'R4 schoolYearId null with nothing pending or failed — the silent hole from the outage', must: /school year/i },
	{ key: 'term', test: 'R5 the ordered term is unresolved', must: /term/i },
	{ key: 'teacher', test: 'R6 no teacher chosen', must: /teacher/i },
] as const;

for (const entry of REASONS) {
	test(`A3P1 ${entry.test} renders its own sentence beside a disabled Save`, async () => {
		const availability = resolveConcernSaveAvailability(inputsFor(entry.key));
		assert.equal(availability.writesDisabled, true, `${entry.key} must disable writes`);
		assert.notEqual(availability.reason, null, `${entry.key} must produce a reason — a disabled write with no reason is the defect`);
		assert.match(availability.reason as string, entry.must, `${entry.key} names its own cause`);

		const host = await renderAndUnmount(workspace({ writesDisabled: true, saveDisabledReason: availability.reason }));
		const node = reasonNode(host);
		assert.notEqual(node, null, 'the reason is rendered');
		assert.equal(
			(node?.textContent ?? '').replace(/\s+/g, ' ').trim(),
			availability.reason,
			'the rendered sentence is the computed sentence, verbatim',
		);
		assert.equal(saveButton(host)?.disabled, true, 'Save is disabled while the reason is shown');
	});
}

// ═══ R7 — THE INVARIANT: reason non-null iff writes disabled ═══════════════

test('A3P1-R7 the reason is present if and only if writes are disabled, for every combination of page state', () => {
	const actorSchools = [1, null] as const;
	const schoolYears = [2, null] as const;
	const terms = [1, null] as const;
	const teachers = [7, null] as const;
	const resolutions: ConcernYearResolution[] = ['PENDING', 'RESOLVED', 'FAILED'];
	/*
	 * 48 combinations, and that is now the WHOLE input space: 2 x 2 x 2 x 2
	 * nullable states x 3 resolution states. Round 1 of this row carried a sixth
	 * dimension, a hand-written `unresolvedTermReason`, which made it 96 — and
	 * that dimension was also what let a raw enum into the sentence (B2). With
	 * the field gone there is nothing left to vary, and the count is restated to
	 * match reality rather than to look impressive. The term sentence's
	 * independence from any payload is pinned separately by A3P1-B4.
	 */
	const EXPECTED_COMBINATIONS = 48;

	let combinations = 0;
	for (const actorSchoolId of actorSchools) {
		for (const schoolYearId of schoolYears) {
			for (const activeTermIndex of terms) {
				for (const selectedFacultyId of teachers) {
					for (const yearResolution of resolutions) {
						const input: ConcernSaveAvailabilityInput = { actorSchoolId, schoolYearId, activeTermIndex, selectedFacultyId, yearResolution };
						const result = resolveConcernSaveAvailability(input);
						combinations += 1;
						const label = JSON.stringify({ actorSchoolId, schoolYearId, activeTermIndex, selectedFacultyId, yearResolution });
						assert.equal(
							result.reason !== null,
							result.writesDisabled,
							`reason/writesDisabled must agree for ${label} (reason: ${String(result.reason)})`,
						);
						if (result.writesDisabled) {
							assert.ok((result.reason ?? '').trim().length > 0, `a disabled write always has a non-empty reason for ${label}`);
							assert.doesNotMatch(
								result.reason ?? '',
								/[A-Z][A-Z0-9]*_[A-Z0-9_]+/,
								`B2: no raw enum token may reach the Save row for ${label}`,
							);
						}
					}
				}
			}
		}
	}
	assert.equal(combinations, EXPECTED_COMBINATIONS, "every combination of the page's inputs was covered");
});

test('A3P1-R8 a fully resolved page enables writes and shows NO reason', async () => {
	const availability = resolveConcernSaveAvailability(inputsFor('none'));
	assert.equal(availability.writesDisabled, false, 'a resolved year, term and teacher enables writes');
	assert.equal(availability.reason, null, 'an enabled write carries no reason — a reason next to a live Save would be noise');

	const host = await renderAndUnmount(workspace({ writesDisabled: false, saveDisabledReason: availability.reason }));
	assert.equal(reasonNode(host), null, 'no reason element is rendered when the page did not block the write');
	assert.equal(saveButton(host)?.disabled, false, 'Save is enabled');
});

test('A3P1-R9 a save in flight is not a reason, and never flicks one on screen', async () => {
	// `saving` disables the button, but the page did not block the write, so the
	// reason must stay hidden. Naming the in-flight state would put a sentence on
	// screen that appears and vanishes on every press.
	const host = await renderAndUnmount(workspace({ writesDisabled: false, saveDisabledReason: null }));
	assert.equal(reasonNode(host), null, 'no reason renders for the busy state');
});

test('A3P1-R10 the reason is rendered on the SAME row as the button, not as a separate block above it', async () => {
	const availability = resolveConcernSaveAvailability(inputsFor('term'));
	const host = await renderAndUnmount(workspace({ writesDisabled: true, saveDisabledReason: availability.reason }));
	const node = reasonNode(host);
	const button = saveButton(host);
	assert.notEqual(node, null, 'the reason rendered');
	assert.notEqual(button, null, 'the button rendered');
	// Same flex row: the reason is a sibling of the button, not a sibling of the
	// whole sticky block. AGENTS §8 forbids a helper sentence under a button.
	assert.equal(node?.parentElement, button?.parentElement, 'the reason and the button share one row');
});

// ═══ R11-R13 — the receipt is truthful about the next timetable ═════════════

test('A3P1-R11 a successful save says the next timetable will use it', () => {
	const message = describeSavedConcern({
		teacherName: 'AGUILAR, CARLO MIGUEL',
		availabilityWindows: 2,
		roomNeeds: 1,
		hasNote: true,
		bindFailure: null,
	});
	assert.match(message, /next timetable/i, 'the receipt states the consequence for the next timetable');
	assert.match(message, /2 windows/, 'the receipt still names what was written');
	assert.doesNotMatch(message, /could not yet make it count/i, 'a bound save does not carry the failure wording');
});

test('A3P1-R12 a save the server could not bind says so, and does not claim the timetable will use it', () => {
	const message = describeSavedConcern({
		teacherName: 'AGUILAR, CARLO MIGUEL',
		availabilityWindows: 2,
		roomNeeds: 0,
		hasNote: false,
		bindFailure: 'the faculty record is stale',
	});
	assert.match(message, /could not yet make it count/i, 'the real refusal is stated');
	assert.doesNotMatch(message, /next timetable/i, 'an unbound save must NOT claim the next timetable will use it');
});

test('A3P1-R13 a save that wrote nothing does not claim the next timetable will use it', () => {
	const message = describeSavedConcern({
		teacherName: 'AGUILAR, CARLO MIGUEL',
		availabilityWindows: 0,
		roomNeeds: 0,
		hasNote: false,
		bindFailure: null,
	});
	assert.match(message, /nothing to save/i, 'an empty save says there was nothing');
	assert.doesNotMatch(
		message,
		/next timetable/i,
		'no record was written, so claiming the next timetable will use it would be a false receipt',
	);
	assert.doesNotMatch(message, /^Saved /, 'nothing was saved, so the receipt must not open with "Saved"');
});

// ═══ R14 — N6: the chip and the receipt are one statement, not two ═══════════

test('A3P1-R14 N6: an empty save leaves the chip NOT reading "Saved", and a real save does read it', () => {
	const empty = {
		teacherName: 'AGUILAR, CARLO MIGUEL',
		availabilityWindows: 0,
		roomNeeds: 0,
		hasNote: false,
		bindFailure: null,
	};
	/*
	 * The page derives the chip's TYPED outcome and the receipt from the SAME
	 * counts object through `concernSaveWroteAnything`, so this row asserts the
	 * pairing the page performs: wrote-nothing => no 'SAVED' outcome, and the
	 * chip then falls back to the record's own status.
	 */
	assert.equal(concernSaveWroteAnything(empty), false, 'an empty save wrote nothing');
	assert.equal(
		concernSaveWroteAnything({ ...empty, availabilityWindows: 1 }),
		true,
		'one painted window is something written',
	);
	assert.equal(concernSaveWroteAnything({ ...empty, hasNote: true }), true, 'a note is something written');
	assert.equal(concernSaveWroteAnything({ ...empty, roomNeeds: 1 }), true, 'a room need is something written');

	// And the sentence the operator reads next to the chip agrees.
	const emptyReceipt = describeSavedConcern(empty);
	assert.match(emptyReceipt, /nothing to save/i, 'the receipt says nothing was written');
	assert.doesNotMatch(emptyReceipt, /^Saved /, 'so the chip beside it must not be allowed to read "Saved"');
});

test('A3P1-R15 the chip label for a non-saved teacher is honest about being unsaved', () => {
	// The state the page lands in after an empty save: `saveOutcome` is null, so
	// the chip is derived from the record, which is not REVIEWED.
	assert.equal(
		concernSaveStateLabel({ selected: true, saved: false, bindFailure: false }),
		'Nothing saved yet',
		'the chip agrees with the receipt: nothing was written, so nothing is claimed',
	);
	assert.equal(concernSaveStateLabel({ selected: true, saved: true, bindFailure: false }), 'Saved', 'a real save still reads Saved');
});
