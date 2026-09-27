/**
 * A3-C6-DUPLICATE-COPY (stream A3, executor 2) — c6 packet item 4, findings F1
 * and F2: a raw code and a raw server string still reach an operator on two
 * routes they can reach.
 *
 * F1 — `DUPLICATE` on the Subjects page (the highest-traffic setup page)
 *
 *   A3-C5 left `DUPLICATE` deliberately unmapped, so the most common
 *   create-time rejection on that page resolves to the honest-but-vague generic
 *   sentence. The server facts were re-derived for this lane, not inherited:
 *
 *   - `atlas-server/src/routes/subject.router.ts:181-184` catches Prisma
 *     `P2002` on the `POST /subjects` create and answers 409
 *     `{ code: 'DUPLICATE', message: 'A subject with this code already exists
 *     for this school.' }`.
 *   - `createSubject` (subject.service.ts:1413-1635) performs exactly ONE
 *     Prisma write, `prisma.subject.create` (:1594), so a `P2002` on this
 *     route can only be that write.
 *   - `model Subject` carries exactly one unique constraint,
 *     `@@unique([schoolId, code], map: "uq_subjects_school_code")`
 *     (prisma/schema.prisma), and the router passes `actorSchoolId` as
 *     `schoolId`. So the conflict is provably (this school, this code) and
 *     nothing else.
 *   - It therefore conflicts on EVERY retry with the same code, which is
 *     exactly why c5 rejected "try again" in the shared fallback. The one
 *     errand an operator can actually carry out is to enter a different code,
 *     and there is a real control for it: `SubjectFormModal` renders the code
 *     input with its own validation (`subjects-form-*`, `SubjectFormModal.tsx:
 *     205` 'Subject code is required.') and `Subjects.tsx:419` returns
 *     `{ status: 'failed' }`, which keeps the dialog open on the same form.
 *
 *   The SERVER string and code in `atlas-server/**` are NOT this lane's and are
 *   untouched. Only the client-rendered wording is added, in the c5 shape.
 *
 * F2 — `OfficerPreferences.tsx` rendered the raw `preferenceStatus`
 *
 *   `statusBadge(status: string)` took `string`, not the union, so its
 *   `default:` branch was reachable for any value the wire delivered and
 *   rendered it verbatim. The three known states keep their exact labels and
 *   tones; only the fallback changes, per the c5 contract.
 *
 * FIXTURES ARE THE REAL SERVER STRINGS (§11)
 *
 *   Every server envelope below is copied from the source with the provenance
 *   recorded inline. The `MISSING_FIELDS` message is the real subject-router
 *   one and is deliberately NOT the five-field list some other route uses.
 *
 * NO ABSENCE-ONLY ASSERTION (the c5 vacuity lesson)
 *
 *   c5's `ENGINEER_STRINGS` was destructured as a 3-tuple but written as a
 *   2-tuple, which made its non-vacuity control silently vacuous. Three
 *   different defenses are therefore wired in here:
 *     - every absence assertion is paired with a positive control in the same
 *       test (the resolver is first shown to return specific, non-empty,
 *       code-keyed text);
 *     - the MAPPING TABLE IS PROVEN TO BE READ, in both directions, by
 *       `A3-C6-1e` — a table-ignoring constant resolver is a mutant that must
 *       go red against the generic-fallback controls, and a table-free
 *       resolver must go red against the mapped controls;
 *     - every phantom-errand scan is paired with a mutant that the SAME scan
 *       must catch, so a scan that rejects everything is itself caught.
 *
 * A SELF-CORRECTION FOUND BY THE FAILING-FIRST RUN
 *
 *   The first run of this file was RED for a reason that was the TEST's fault,
 *   not the production code's: the bare-retry mutant ("Try again — ATLAS could
 *   not complete that subject change.") was NOT caught by the role scan or the
 *   phantom-list scan, and the control reported that honestly instead of
 *   passing. That is the exact failure mode c5 documented for the fallback it
 *   removed — "'try again' is wrong for a 409 that will conflict again on every
 *   retry" — so a THIRD scan (`namesABareRetry`) was added rather than the
 *   mutant being weakened. It is a real, independent defect class: an operator
 *   told to retry a deterministic conflict is being sent in a circle. The
 *   c5 fallback's own pre-correction sentence is kept as its positive control,
 *   which proves the third scan does work the other two do not.
 *
 * Run: `npm run test:a3-c6-duplicate-copy`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';

import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

import {
	resolveSubjectMutationErrorCopy,
	type SubjectMutationErrorCopy,
} from '@/components/subjects/subject-source-utils';

/* ───────────────────────── jsdom harness ───────────────────────── */

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
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	SVGElement: dom.window.SVGElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLLabelElement: dom.window.HTMLLabelElement,
	HTMLFormElement: dom.window.HTMLFormElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
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
const { SubjectMutationDetailPopover } = await import('../SubjectMutationDetailPopover');
const { Button } = await import('@/ui/button');
const { Popover, PopoverContent, PopoverTrigger } = await import('@/ui/popover');

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
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

/** Every character an operator can SEE or hear, across the host and the portal. */
function visibleText(): string {
	return `${document.body.textContent ?? ''}`;
}

async function click(el: Element): Promise<void> {
	await act(async () => {
		el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
		el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
	});
}

/* ───────────────────────── real server fixtures ───────────────────────── */

const DUPLICATE_ENVELOPE = {
	code: 'DUPLICATE',
	message: 'A subject with this code already exists for this school.',
	origin: 'atlas-server/src/routes/subject.router.ts:182',
} as const;

/** The c5 fallback, pinned. Any drift here is a failure, not a judgement call. */
const FALLBACK_DESCRIPTION = 'ATLAS could not complete that subject change.';
const FALLBACK_NEXT_ACTION =
	'ATLAS could not say what went wrong, so there is no specific action to take here.';

const DUPLICATE_DESCRIPTION = 'Another subject in this school already uses this subject code.';
const DUPLICATE_NEXT_ACTION = 'Enter a different subject code, then save the subject again.';

/**
 * The c5 phantom-errand predicates, restated (not imported) so this suite's
 * controls are independent of the suite it protects.
 */
const UNFALSIFIABLE_ERRANDS: ReadonlyArray<string> = [
	'administrator',
	'admin',
	'contact support',
	'contact it',
	'support team',
	'help desk',
	'it department',
	'call us',
	'raise a ticket',
	'submit a ticket',
];

function unfalsifiableErrandsIn(text: string): string[] {
	const lower = text.toLowerCase();
	return UNFALSIFIABLE_ERRANDS.filter((phrase) => lower.includes(phrase));
}

/** A "from the list" claim naming a control that does not exist. */
function namesAPhantomList(text: string): boolean {
	return /\bfrom the list\b/.test(text);
}

/**
 * A BARE RETRY, the third independent defect class. Sending an operator round a
 * deterministic failure is what c5 removed from the shared fallback; the
 * c5 pre-correction sentence below is this scan's positive control.
 *
 * The `i` flag is LOAD-BEARING, and its absence was found by this suite's own
 * non-vacuity check rather than by inspection: the first mutant used a
 * sentence-initial "Try again", the regex was case-sensitive, and the scan
 * silently reported the mutant as UNCAUGHT. A scan that misses a defect because
 * of capitalisation is a vacuous scan wearing a control's clothes.
 */
function namesABareRetry(text: string): boolean {
	return /\btry again\b/i.test(text);
}

const FALLBACK_NEXT_ACTION_BEFORE_CORRECTION =
	'Check the school connection, then try again. If it keeps failing, contact your ATLAS administrator.';

function operatorVisibleText(copy: SubjectMutationErrorCopy): string {
	return `${copy.description} ${copy.nextAction} ${copy.message}`;
}

/* ───────────────────────── F1 ───────────────────────── */

test('A3-C6-1a: DUPLICATE resolves to a specific plain sentence, NOT the generic fallback', () => {
	const copy = resolveSubjectMutationErrorCopy(DUPLICATE_ENVELOPE);

	assert.equal(
		copy.description,
		DUPLICATE_DESCRIPTION,
		'DUPLICATE: description must be the exact mapped sentence',
	);
	assert.equal(copy.nextAction, DUPLICATE_NEXT_ACTION, 'DUPLICATE: next action must be the exact mapped sentence');
	assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);

	// The whole point of F1: it must NOT be the vague fallback any more.
	assert.notEqual(
		copy.description,
		FALLBACK_DESCRIPTION,
		'DUPLICATE still resolves to the generic fallback description',
	);
	assert.notEqual(copy.nextAction, FALLBACK_NEXT_ACTION, 'DUPLICATE still resolves to the generic fallback action');

	// POSITIVE CONTROL: the resolver returns something specific and non-empty,
	// so the "not the fallback" claim above cannot be satisfied by ''.
	assert.ok(copy.description.length > 20, 'positive control: resolver returned nothing useful');
	assert.ok(copy.nextAction.length > 20, 'positive control: resolver returned no next action');

	// The operator-visible text must not carry the server sentence or its code.
	const visible = operatorVisibleText(copy);
	assert.ok(!visible.includes(DUPLICATE_ENVELOPE.message), 'the server sentence leaked into operator copy');
	assert.ok(!visible.includes('already exists'), 'the server phrasing leaked into operator copy');
	assert.ok(!/DUPLICATE/.test(visible), 'the raw code leaked into operator copy');

	// POSITIVE CONTROL #2 for the leak assertions: the same resolver DOES
	// return the raw sentence when handed it as the diagnostic channel, so the
	// leak check is discriminating and not satisfied by a resolver that
	// discards `rawMessage` entirely.
	assert.equal(copy.rawMessage, DUPLICATE_ENVELOPE.message, 'the raw sentence must survive for the diagnostic');
	assert.equal(copy.code, 'DUPLICATE', 'the raw code must survive for the diagnostic');
});

test('A3-C6-1b: the SHIPPED DUPLICATE sentence names no phantom errand, and the scans are non-vacuous', () => {
	/**
	 * THE SCANS RUN ON THE RESOLVER'S LIVE OUTPUT, not on this file's own
	 * constants. That distinction was found by a real source mutation, not by
	 * inspection: injecting "Ask a school administrator … then try again" into
	 * `SUBJECT_MUTATION_COPY` left this test GREEN while `A3-C6-1a` went red,
	 * because the earlier version of this test scanned the literal
	 * `DUPLICATE_NEXT_ACTION` declared here — the test's own copy of the
	 * intended sentence. A phantom-errand control that only polices its own
	 * fixture polices nothing. Everything below is computed from
	 * `resolveSubjectMutationErrorCopy`, and `A3-C6-1a`'s exact equality is
	 * what ties the two together.
	 */
	const shipped = resolveSubjectMutationErrorCopy(DUPLICATE_ENVELOPE);
	const shippedText = operatorVisibleText(shipped);

	// 1. Role / support-route scan.
	const roleHits = unfalsifiableErrandsIn(shippedText);
	assert.deepEqual(
		roleHits,
		[],
		`DUPLICATE: the SHIPPED copy names an errand ATLAS cannot support: ${roleHits.join(', ')} — "${shippedText}"`,
	);
	// 2. Phantom-list scan.
	assert.ok(
		!namesAPhantomList(shippedText),
		`DUPLICATE: the SHIPPED copy names a list that does not exist — "${shippedText}"`,
	);
	// 3. Bare-retry scan. The DUPLICATE conflict is deterministic, so telling
	//    an operator to retry is the c5 defect repeated. Note the shipped copy
	//    says "save the subject AGAIN" — that is the resubmit AFTER the
	//    substantive errand, not a retry on its own, so the scan keys on
	//    "try again" and not on the word "again".
	assert.ok(
		!namesABareRetry(shippedText),
		`DUPLICATE: the SHIPPED copy tells the operator to retry a conflict that repeats on every attempt — "${shippedText}"`,
	);
	// 4. The expected constants must still match the shipped copy, or 1-3 above
	//    are scanning something other than what ships.
	assert.equal(shipped.description, DUPLICATE_DESCRIPTION);
	assert.equal(shipped.nextAction, DUPLICATE_NEXT_ACTION);

	// 5. NON-VACUITY: four plausible wrong sentences, each of which MUST be
	//    caught, and caught by the SAME predicates used above. Two of them
	//    carry no role phrase at all, which is why the three scans are
	//    separate: a role-only scan would miss both.
	const mutants: ReadonlyArray<readonly [string, string]> = [
		['phantom role', 'Ask a school administrator to rename the other subject, then save again.'],
		['phantom list', 'Choose a different code from the list, then save again.'],
		['bare retry', 'Try again — ATLAS could not complete that subject change.'],
		[
			'c5 pre-correction fallback',
			FALLBACK_NEXT_ACTION_BEFORE_CORRECTION,
		],
	];
	let caught = 0;
	for (const [label, bad] of mutants) {
		assert.ok(
			unfalsifiableErrandsIn(bad).length > 0 || namesAPhantomList(bad) || namesABareRetry(bad),
			`${label}: the mutant was NOT caught — one of the three scans is vacuous`,
		);
		caught += 1;
	}
	assert.equal(caught, 4, 'A3-C6-1b: all four phantom-errand mutants must be caught');
	// And prove the scans are independent of each other:
	//  - the role scan alone must MISS the phantom-list mutant;
	//  - the role scan alone must MISS the bare-retry mutant;
	//  - the bare-retry scan alone must CATCH the c5 pre-correction fallback.
	assert.equal(
		unfalsifiableErrandsIn('Choose a different code from the list, then save again.').length,
		0,
		'A3-C6-1b: the role scan must MISS the phantom-list mutant, proving the list scan does independent work',
	);
	assert.equal(
		unfalsifiableErrandsIn('Try again — ATLAS could not complete that subject change.').length,
		0,
		'A3-C6-1b: the role scan must MISS the bare-retry mutant, proving the retry scan does independent work',
	);
	assert.equal(
		namesABareRetry(FALLBACK_NEXT_ACTION_BEFORE_CORRECTION),
		true,
		'A3-C6-1b: the retry scan must CATCH the c5 pre-correction fallback, proving the scan discriminates',
	);
	// And the live fallback must pass all three, or the scans are too eager.
	assert.equal(namesABareRetry(FALLBACK_NEXT_ACTION), false, 'the retry scan wrongly rejects the c5 fallback');
	assert.equal(namesAPhantomList(FALLBACK_NEXT_ACTION), false, 'the list scan wrongly rejects the c5 fallback');
	assert.deepEqual(unfalsifiableErrandsIn(FALLBACK_NEXT_ACTION), [], 'the role scan wrongly rejects the c5 fallback');
});

test('A3-C6-1c: the raw code and raw server text stay reachable in the @/ui popover', async () => {
	const copy = resolveSubjectMutationErrorCopy(DUPLICATE_ENVELOPE);
	const host = await render(
		<SubjectMutationDetailPopover
			code={copy.code}
			rawMessage={copy.rawMessage}
			context="Save subject"
		/>,
	);

	const trigger = host.querySelector('[data-testid="subject-mutation-detail"]');
	assert.ok(trigger, 'the diagnostic affordance must be present — the raw text is delayed, not lost');
	// §8: an affordance, never a native title=.
	assert.equal(
		host.querySelector('[title]'),
		null,
		'a native title attribute is forbidden by §8 — the raw text must live in an @/ui popover',
	);
	// The trigger is a real @/ui Button (a <button>), not a bare div or span.
	assert.equal(trigger.tagName, 'BUTTON', 'the popover trigger must be an @/ui Button element');

	// Closed: the raw sentence is NOT on screen.
	assert.ok(
		!visibleText().includes(DUPLICATE_ENVELOPE.message),
		'the raw server sentence is visible before the operator opens the diagnostic',
	);

	await click(trigger);
	assert.ok(
		visibleText().includes(DUPLICATE_ENVELOPE.message),
		'the raw server sentence must be reachable once the diagnostic is opened',
	);
	assert.ok(visibleText().includes('DUPLICATE'), 'the raw code must be reachable in the diagnostic');

	await unmount();
});

test('A3-C6-1d: the F1 CLASS — the generic fallback still fires and still says only what holds for all', () => {
	/**
	 * Every code c5 recorded as part of this heterogeneous class and NOT mapped
	 * by this lane, each with its REAL server provenance. The fallback's job is
	 * to describe what is true of all of them, so the class is asserted as a
	 * class rather than case by case.
	 */
	const keptUnmapped: ReadonlyArray<readonly [string, string, string]> = [
		[
			'MISSING_FIELDS',
			'code, name, minMinutesPerWeek, preferredRoomType, gradeLevels are required.',
			'atlas-server/src/routes/subject.router.ts:137',
		],
		[
			'CROSS_SCHOOL_YEAR_DENIED',
			'School year 2030 does not belong to school 1.',
			'atlas-server/src/routes/subject.router.ts:405 (also :442, :478)',
		],
		[
			'SYSTEM_TOKEN_NOT_CONFIGURED',
			'ATLAS_SYSTEM_TOKEN must be configured for integration-key authentication.',
			'atlas-server/src/middleware/authenticate.ts:150 (also :168)',
		],
		[
			'INVALID_SYSTEM_TOKEN',
			'Invalid ATLAS system token.',
			'atlas-server/src/middleware/authenticate.ts:155',
		],
		[
			'DELETE_PREVIEW_REQUIRED',
			'Subject deletion requires a fingerprinted preview before apply. Use the delete preview endpoint first.',
			'atlas-server/src/routes/subject.router.ts:239',
		],
	];

	for (const [code, serverMessage, origin] of keptUnmapped) {
		const copy = resolveSubjectMutationErrorCopy({ code, message: serverMessage });
		assert.equal(copy.description, FALLBACK_DESCRIPTION, `${code} (${origin}): fallback description drifted`);
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, `${code} (${origin}): fallback next action drifted`);
		assert.equal(copy.message, `${copy.description} ${copy.nextAction}`);
		// The raw sentence is preserved for the diagnostic and never shown.
		assert.equal(copy.rawMessage, serverMessage, `${code}: raw sentence destroyed`);
		assert.equal(copy.code, code, `${code}: raw code destroyed`);
		assert.ok(
			!operatorVisibleText(copy).includes(serverMessage),
			`${code}: the server sentence leaked into operator copy`,
		);
		// The fallback names no errand ATLAS cannot support, no phantom list,
		// and never a bare retry.
		assert.deepEqual(unfalsifiableErrandsIn(copy.nextAction), [], `${code}: fallback names a phantom errand`);
		assert.ok(!namesAPhantomList(copy.nextAction), `${code}: fallback names a phantom list`);
		assert.ok(!namesABareRetry(copy.nextAction), `${code}: fallback tells the operator to retry blindly`);
	}

	// The no-response network error: no body at all, and a RECEIVED body that
	// carries no code. The second case is why the class cannot be split into a
	// "could not reach ATLAS" sentence — that would be false for `{}`.
	for (const payload of [undefined, null, {}]) {
		const copy = resolveSubjectMutationErrorCopy(payload);
		assert.equal(copy.code, null, `${JSON.stringify(payload)}: code must be null`);
		assert.equal(copy.rawMessage, '');
		assert.equal(copy.description, FALLBACK_DESCRIPTION);
		assert.equal(copy.nextAction, FALLBACK_NEXT_ACTION, 'no-response fallback next action drifted');
	}
	// A non-string status must not become the word "undefined" on screen.
	const odd = resolveSubjectMutationErrorCopy({ code: 42, message: { toString: () => 'x' } });
	assert.ok(!odd.message.includes('undefined'), 'a non-string code became the word "undefined"');
	assert.equal(odd.code, null);
});

test('A3-C6-1e: the MAPPING TABLE IS ACTUALLY READ (the c5 non-vacuity control)', () => {
	// (a) The `DUPLICATE` key is physically present in the mapping table. This
	//     is the direct answer to the c5 lesson: a 2-tuple destructured as a
	//     3-tuple made that suite's non-vacuity control vacuous, so the table is
	//     read from source rather than inferred from a destructuring.
	const resolverSource = source('src/components/subjects/subject-source-utils.ts');
	assert.ok(
		/\n\tDUPLICATE:\s*\{/.test(resolverSource),
		'the DUPLICATE key is not in the SUBJECT_MUTATION_COPY table — the table was never edited',
	);

	// (b) The table is consulted, not a constant: the same resolver returns
	//     DIFFERENT specific text for two different mapped codes.
	const dup = resolveSubjectMutationErrorCopy(DUPLICATE_ENVELOPE);
	const stale = resolveSubjectMutationErrorCopy({
		code: 'STALE_WRITE',
		message: 'Subject was modified by another user. Refresh and retry.',
	});
	assert.notEqual(dup.description, stale.description, 'two codes resolved to one sentence — the table is not read');
	assert.notEqual(
		dup.nextAction,
		stale.nextAction,
		'two codes share one next action — the table is not read',
	);

	// (c) MUTANT: a table-IGNORING resolver that returns the DUPLICATE sentence
	//     for EVERYTHING must be caught by the generic-fallback controls above.
	//     Re-run the essential fallback assertion against it and require it to
	//     throw. Without this, 1d would pass against a resolver that had simply
	//     hard-coded one sentence.
	const tableIgnoringResolver = (payload: { code?: unknown; message?: unknown } | null | undefined) => ({
		description: DUPLICATE_DESCRIPTION,
		nextAction: DUPLICATE_NEXT_ACTION,
		message: `${DUPLICATE_DESCRIPTION} ${DUPLICATE_NEXT_ACTION}`,
		code: typeof payload?.code === 'string' ? payload.code : null,
		rawMessage: typeof payload?.message === 'string' ? payload.message : '',
	});
	assert.throws(
		() => {
			assert.equal(
				tableIgnoringResolver({ code: 'MISSING_FIELDS', message: 'x' }).description,
				FALLBACK_DESCRIPTION,
				'a table-ignoring resolver cannot answer the fallback control',
			);
		},
		'A3-C6-1e: the table-ignoring mutant was NOT caught — the mapping table is not proven to be read',
	);
	// (d) MUTANT: deleting the DUPLICATE entry is exactly "the table no longer
	//     has DUPLICATE", which is the same shape as (a) failing. Prove the
	//     source-level control is discriminating by running it against a
	//     resolver source that genuinely has no DUPLICATE key.
	//     The line terminator is matched EXPLICITLY as CRLF-or-LF: this file is
	//     checked out CRLF on this host, and the first attempt used a bare
	//     `\n\t},\n` which cannot match a CRLF line ending — so the deletion
	//     silently no-opped and the control reported the entry "could not be
	//     located". A mutation control that cannot perform its mutation is not a
	//     control.
	const DUPLICATE_ENTRY_PATTERN = /\r?\n\tDUPLICATE:\s*\{[\s\S]*?\r?\n\t\},\r?\n/;
	assert.ok(
		DUPLICATE_ENTRY_PATTERN.test(resolverSource),
		'the DUPLICATE entry could not be located in the source, so controls (a) and (d) are vacuous',
	);
	const sourceWithoutDuplicate = resolverSource.replace(DUPLICATE_ENTRY_PATTERN, '\r\n');
	assert.notEqual(
		sourceWithoutDuplicate,
		resolverSource,
		'the DUPLICATE entry could not be deleted, so the deletion mutant is vacuous',
	);
	assert.equal(
		/\r?\n\tDUPLICATE:\s*\{/.test(sourceWithoutDuplicate),
		false,
		'the deletion mutant must remove the DUPLICATE key',
	);

	// (e) An unrelated mapped entry is untouched — the fix is additive.
	assert.equal(
		resolveSubjectMutationErrorCopy({ code: 'INVALID_SUBJECT_NAME', message: 'name must be a non-empty string.' })
			.description,
		'The subject name cannot be empty.',
		'an existing mapped entry drifted',
	);
});

/* ───────────────────────── F2 ───────────────────────── */

const UNMAPPED_STATUS = 'FUTURE_STATUS_9X';

const MAPPED_PREFERENCE_STATUSES: ReadonlyArray<readonly [string, string, string]> = [
	['SUBMITTED', 'Submitted', 'success'],
	['DRAFT', 'Draft', 'warning'],
	['MISSING', 'Missing', 'danger'],
];

test('A3-C6-2a: the three mapped preference statuses keep their exact label and tone', async () => {
	const mod = await import('../../officer-preferences/PreferenceStatusBadge');
	const { resolvePreferenceStatusCopy, PreferenceStatusBadge } = mod as unknown as {
		resolvePreferenceStatusCopy: (status: string) => {
			recognised: boolean;
			label: string;
			variant: string;
			sentence: string;
			raw: string;
		};
		PreferenceStatusBadge: (props: { status: string }) => React.ReactElement;
	};

	// Pure resolver level, exact.
	for (const [status, label, variant] of MAPPED_PREFERENCE_STATUSES) {
		const copy = resolvePreferenceStatusCopy(status);
		assert.equal(copy.recognised, true, `${status}: a mapped status was reported unrecognised`);
		assert.equal(copy.label, label, `${status}: label drifted`);
		assert.equal(copy.variant, variant, `${status}: tone drifted`);
		assert.equal(copy.raw, status, `${status}: raw value destroyed`);
	}

	// And rendered level, so the claim is about the operator's screen.
	for (const [status, label] of MAPPED_PREFERENCE_STATUSES) {
		const host = await render(<PreferenceStatusBadge status={status} />);
		const badge = host.querySelector('[data-slot="badge"]');
		assert.ok(badge, `${status}: no badge rendered`);
		assert.equal(badge.textContent, label, `${status}: rendered label drifted`);
		await unmount();
	}
});

test('A3-C6-2b: an unmapped preferenceStatus renders NO raw code, and keeps it reachable in a popover', async () => {
	const mod = await import('../../officer-preferences/PreferenceStatusBadge');
	const { resolvePreferenceStatusCopy, PreferenceStatusBadge } = mod as unknown as {
		resolvePreferenceStatusCopy: (status: string) => {
			recognised: boolean;
			label: string;
			variant: string;
			sentence: string;
			raw: string;
		};
		PreferenceStatusBadge: (props: { status: string }) => React.ReactElement;
	};

	// --- resolver level ---------------------------------------------------
	const copy = resolvePreferenceStatusCopy(UNMAPPED_STATUS);
	assert.equal(copy.recognised, false, 'an unmapped status was reported as recognised');
	assert.ok(!copy.label.includes(UNMAPPED_STATUS), 'the raw code reached the label');
	assert.ok(copy.label.length > 0, 'positive control: the fallback label is empty');
	assert.ok(copy.sentence.length > 20, 'positive control: the fallback sentence is empty or trivial');
	assert.equal(copy.raw, UNMAPPED_STATUS, 'the raw value must survive for the diagnostic');

	// --- rendered level ---------------------------------------------------
	const host = await render(<PreferenceStatusBadge status={UNMAPPED_STATUS} />);

	// The defect: the raw value must not be visible anywhere on the badge.
	assert.ok(
		!visibleText().includes(UNMAPPED_STATUS),
		`the raw preferenceStatus "${UNMAPPED_STATUS}" is rendered on screen`,
	);
	const badge = host.querySelector('[data-slot="badge"]');
	assert.ok(badge, 'no badge rendered for an unmapped status');
	assert.ok(
		!badge.textContent?.includes(UNMAPPED_STATUS),
		'the raw preferenceStatus is rendered inside the badge',
	);
	// Plain words instead: a fixed, honest label with no part of the raw value.
	assert.equal(badge.textContent, copy.label, 'the badge label is not the resolver label');
	assert.ok(/[a-z]/.test(badge.textContent ?? ''), 'the badge label is not plain words');

	// A bare `title=` is what §8 forbids; the diagnostic must be an @/ui
	// affordance.
	assert.equal(
		host.querySelector('[title]'),
		null,
		'a native title attribute is forbidden by §8 — the raw value must live in an @/ui popover',
	);
	const trigger = host.querySelector('[data-testid="preference-status-detail"]');
	assert.ok(trigger, 'no @/ui popover affordance for the raw status — the raw value is lost, not delayed');
	assert.equal(trigger.tagName, 'BUTTON', 'the popover trigger must be an @/ui Button element, not a bare div');

	// Closed: the raw value is not on screen. Opened: it is reachable.
	assert.ok(
		!visibleText().includes(UNMAPPED_STATUS),
		'the raw status is visible before the operator opens the diagnostic',
	);
	await click(trigger);
	assert.ok(
		visibleText().includes(UNMAPPED_STATUS),
		'the raw status must be reachable once the @/ui diagnostic is opened',
	);
	assert.ok(
		visibleText().includes(copy.sentence),
		'the honest plain sentence must be shown alongside the raw value',
	);
	await unmount();
});

test('A3-C6-2c: a blank or absent status never renders the word "undefined"', async () => {
	const mod = await import('../../officer-preferences/PreferenceStatusBadge');
	const { resolvePreferenceStatusCopy, PreferenceStatusBadge } = mod as unknown as {
		resolvePreferenceStatusCopy: (status: unknown) => {
			recognised: boolean;
			label: string;
			variant: string;
			sentence: string;
			raw: string;
		};
		PreferenceStatusBadge: (props: { status: unknown }) => React.ReactElement;
	};

	for (const status of ['', '   ', null, undefined]) {
		const copy = resolvePreferenceStatusCopy(status);
		assert.equal(copy.recognised, false, `${JSON.stringify(status)}: must not be reported as recognised`);
		assert.equal(copy.raw, '', `${JSON.stringify(status)}: raw must be empty`);
		assert.ok(
			!copy.label.includes('undefined') && !copy.sentence.includes('undefined'),
			`${JSON.stringify(status)}: the word "undefined" reached operator copy`,
		);
		const host = await render(<PreferenceStatusBadge status={status} />);
		assert.ok(
			!visibleText().includes('undefined'),
			`${JSON.stringify(status)}: the word "undefined" was rendered`,
		);
		assert.ok(host.querySelector('[data-slot="badge"]'), 'a badge must still render');
		await unmount();
	}
});

test('A3-C6-2d: MUTANTS — a raw fallback, a native title, and a table-free badge are each caught', async () => {
	const { Badge } = await import('@/ui/badge');

	// MUTANT 1 — the exact defect being fixed: the `default:` branch rendering
	// the raw value. Run the F2b "no raw code on screen" assertion against it.
	const rawFallbackBadge = (props: { status: string }) => <Badge variant="secondary">{props.status}</Badge>;
	{
		const host = await render(rawFallbackBadge({ status: UNMAPPED_STATUS }));
		assert.throws(
			() => {
				assert.ok(
					!visibleText().includes(UNMAPPED_STATUS),
					`mutant 1: the raw status is rendered on screen: ${visibleText()}`,
				);
			},
			'A3-C6-2d: mutant 1 (raw fallback branch) was NOT caught — the F2b control is vacuous',
		);
		await unmount();
	}

	// MUTANT 2 — the §8 shortcut: a native `title=` instead of an @/ui popover.
	// Run the F2b "no title attribute" and "affordance present" assertions
	// against it.
	const titleAttrBadge = (props: { status: string }) => (
		<Badge variant="secondary" title={props.status}>
			Unrecognised status
		</Badge>
	);
	{
		const host = await render(titleAttrBadge({ status: UNMAPPED_STATUS }));
		assert.throws(
			() => {
				assert.equal(
					host.querySelector('[title]'),
					null,
					'mutant 2: a native title attribute is forbidden by §8',
				);
			},
			'A3-C6-2d: mutant 2 (native title) was NOT caught — the F2b control is vacuous',
		);
		assert.throws(
			() => {
				assert.ok(
					host.querySelector('[data-testid="preference-status-detail"]'),
					'mutant 2: no @/ui popover affordance',
				);
			},
			'A3-C6-2d: mutant 2 (native title) was NOT caught by the affordance control',
		);
		await unmount();
	}

	// MUTANT 3 — a `default:` branch that is a CONSTANT with no popover at all:
	// the raw value is neither shown nor reachable, so the diagnostic is lost
	// rather than delayed. This is the over-correction the c5 contract forbids.
	const rawDestroyingBadge = (props: { status: string }) => <Badge variant="secondary">Unrecognised status</Badge>;
	{
		await render(rawDestroyingBadge({ status: UNMAPPED_STATUS }));
		assert.ok(
			!visibleText().includes(UNMAPPED_STATUS),
			'positive control for mutant 3: the raw value must be absent while closed',
		);
		assert.throws(
			() => {
				assert.ok(
					document.body.querySelector('[data-testid="preference-status-detail"]'),
					'mutant 3: the raw value is destroyed with no affordance to reach it',
				);
			},
			'A3-C6-2d: mutant 3 (raw destroyed, no popover) was NOT caught — the affordance control is vacuous',
		);
		await unmount();
	}

	// MUTANT 4 — a div-as-trigger instead of an @/ui Button: a bare div is not
	// focusable, so a keyboard operator can never reach the diagnostic.
	const divTriggerBadge = (props: { status: string }) => (
		<div data-testid="preference-status-detail" tabIndex={-1}>
			<Badge variant="secondary">Unrecognised status</Badge>
		</div>
	);
	{
		const host = await render(divTriggerBadge({ status: UNMAPPED_STATUS }));
		assert.throws(
			() => {
				assert.equal(
					host.querySelector('[data-testid="preference-status-detail"]')?.tagName,
					'BUTTON',
					'mutant 4: the trigger must be a real button a keyboard can reach',
				);
			},
			'A3-C6-2d: mutant 4 (div trigger) was NOT caught — the trigger control is vacuous',
		);
		await unmount();
	}
});

test('A3-C6-2e: the pages are wired to the new badge and the raw fallback is gone from source', () => {
	const pageSource = source('src/pages/OfficerPreferences.tsx');

	// The defect, in the exact form it was written. The scanner is deliberately
	// NOT taught to ignore comments: a control that "knows" the literal is
	// harmless in prose would be a control a later author can satisfy by
	// quoting the defect instead of removing it, so this file's sibling comment
	// in OfficerPreferences.tsx is worded to avoid the literal entirely.
	assert.ok(
		!pageSource.includes("<Badge variant='secondary'>{status}</Badge>"),
		'OfficerPreferences.tsx still renders the raw preferenceStatus in its statusBadge default branch',
	);
	// POSITIVE CONTROL: the scanner is not vacuously passing. The page MUST
	// reference the new badge, and that literal genuinely has to be found.
	assert.ok(
		pageSource.includes('PreferenceStatusBadge'),
		'OfficerPreferences.tsx does not use PreferenceStatusBadge — the page was never wired to the fix',
	);
	assert.equal(
		pageSource.split('PreferenceStatusBadge status=').length - 1,
		2,
		'OfficerPreferences.tsx must render PreferenceStatusBadge at BOTH statusBadge call sites (row :543 and review detail :654)',
	);
	// The two sibling badges are NOT in this lane; assert they were left alone
	// rather than silently rewritten (this stream fixes what it can prove).
	assert.ok(pageSource.includes('case \'NEEDS_FOLLOW_UP\''), 'reviewBadge was altered — out of scope for this lane');
	assert.ok(pageSource.includes('return null;'), 'reviewBadge default was altered — out of scope for this lane');

	// §8 on the new component: an @/ui popover, never a native title.
	// Block comments are stripped before the literal scans. Without that, the
	// component's own explanatory comment — which necessarily NAMES the
	// forbidden `title=` attribute in order to say it is not used — trips the
	// scan, and a control that can be satisfied only by deleting the rationale
	// is a control that erodes its own evidence. Line comments are NOT stripped:
	// a stray `title=` in one deserves a reviewer's eye.
	const badgeSourceWithComments = source('src/components/officer-preferences/PreferenceStatusBadge.tsx');
	assert.ok(badgeSourceWithComments.includes("from '@/ui/popover'"), 'the new badge must use the @/ui popover primitive');
	const badgeCode = badgeSourceWithComments.replace(/\/\*[\s\S]*?\*\//g, '');
	assert.ok(
		!/\stitle=/.test(badgeCode),
		'the new badge must not use a native title attribute (§8)',
	);
	assert.ok(
		!badgeCode.includes('<details'),
		'the new badge must not use a raw <details> (§8)',
	);
	assert.ok(
		!/<select[\s>]/.test(badgeCode),
		'the new badge must not use a native <select> (§8)',
	);
	assert.ok(
		!badgeCode.includes('<button'),
		'the new badge must route its trigger through @/ui Button (§8)',
	);
	// POSITIVE CONTROL: stripping must not empty the source, or every scan
	// above would pass vacuously.
	assert.ok(
		badgeCode.includes('PopoverTrigger') && badgeCode.includes('PreferenceStatusBadge'),
		'comment stripping removed the code — the §8 scans above would be vacuous',
	);
});

test('A3-C6-2f: the sibling badges were inspected for the same defect class and are not the same class', () => {
	// `reviewBadge` (OfficerPreferences.tsx) and `decisionBadge`
	// (OfficerRoomPreferences.tsx:39-42) and the room-request
	// `statusBadge` (room-request-helpers.tsx:53) were all inspected for F2's
	// defect — a fallback that renders a RAW value. This test records the
	// finding so it cannot be lost, and asserts that none of them renders an
	// interpolation of its status argument.
	const officer = source('src/pages/OfficerPreferences.tsx');
	const roomPage = source('src/pages/OfficerRoomPreferences.tsx');
	const roomHelpers = source('src/components/faculty-room-preferences/room-request-helpers.tsx');

	// reviewBadge: its default returns null, so it can never render a raw code.
	assert.ok(
		/case 'NEEDS_FOLLOW_UP':[\s\S]{0,400}default:\s*\n\s*return null;/.test(officer),
		'reviewBadge no longer returns null on its default branch — re-inspect it',
	);
	// decisionBadge: its default is a FIXED 'Pending' string, not an
	// interpolation of `status`.
	assert.ok(
		/function decisionBadge\([^)]*\)[\s\S]{0,400}return <Badge variant='secondary'>Pending<\/Badge>;/.test(roomPage),
		'decisionBadge no longer renders a fixed Pending label — re-inspect it',
	);
	assert.ok(
		!/function decisionBadge\([^)]*\)[\s\S]{0,400}\{status\}/.test(roomPage),
		'decisionBadge now interpolates its status argument — that is the F2 defect, and this lane must fix it',
	);
	// room-request statusBadge: its final fallback is a fixed 'No request'.
	assert.ok(
		!roomHelpers.includes('>{status}<'),
		'the room-request statusBadge interpolates its status argument — that is the F2 defect class',
	);
});
