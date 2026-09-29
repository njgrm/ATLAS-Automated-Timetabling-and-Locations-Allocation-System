/**
 * A2 mc, S1 — one count, one list. RENDERED evidence.
 *
 * THE DEFECT (packet item 1), measured at base `c57b8e1d`: four numbers wore the
 * word "Must fix" over three populations, and — worse — the one list that blocks
 * publishing rendered `group.items.slice(0, 3)` plus a `Show N more` disclosure.
 * On the operator's own run that hid SEVEN of the TEN must-fix sessions behind a
 * control they had to discover.
 *
 * EVERY ROW BELOW RENDERS the real production component into a real JSDOM
 * document and reads the resulting DOM. Nothing here asserts that a string
 * appears in a source file, because per AGENTS.md a source-text assertion is not
 * acceptance evidence for a user-facing change.
 *
 * Rows:
 *   S1a RENDERED: all ten must-fix items are in the DOM; the `Show N more`
 *        disclosure is absent from the blocker group.
 *   S1b RENDERED + CLICK: every item carries its OWN repair control, and clicking
 *        the SEVENTH item's control dispatches THAT item's identity — not the
 *        group's first, which is what the old group-level resolution did.
 *   S1c RENDERED: the count line states the population and the scope it covers.
 *   S1d RENDERED: the WARNING row keeps its disclosure. A warning is reviewable
 *        and blocks nothing; removing its disclosure would be a different change.
 *   S1e SCOPE AUTHORITY: `hasBlockers`, `runWideBlockingHard` and
 *        `runWideUnassigned` are UNCHANGED by this slice. A2-C7 owns those; this
 *        slice labels and completes the list and must not re-derive the gate.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const CLIENT_ROOT = resolve(process.cwd());
const { createRoot } = await import('react-dom/client');
const { SimplePublishReadinessSheetBody } = await import('@/components/timetable/SimplePublishReadinessSheet');
const { deriveSimplePublishReadiness } = await import('@/components/timetable/simplePublishReadiness');

const sectionLabel = (id: number) => `7-Rizal ${id}`;
const subjectLabel = (id: number) => `TLE ${id}`;
const facultyLabel = (id: number) => `Mr Teacher ${id}`;

function container(): HTMLElement {
	const host = document.createElement('div');
	document.body.appendChild(host);
	return host;
}

async function mount(element: unknown): Promise<HTMLElement> {
	const host = container();
	const root = createRoot(host);
	await act(async () => { root.render(element as never); });
	return host;
}

/** The operator's real shape: ten unresolved sessions, all NO_AVAILABLE_SLOT. */
function tenUnresolvedDraft() {
	return {
		runId: 318,
		status: 'COMPLETED',
		entries: [],
		version: 4,
		finishedAt: null,
		createdAt: '2026-09-29T00:00:00.000Z',
		summary: { unassignedCount: 10, blockingHardViolationCount: 0, softViolationCount: 0 },
		unassignedItems: Array.from({ length: 10 }, (_, index) => ({
			sectionId: 100 + index,
			subjectId: 200 + index,
			gradeLevel: 7,
			session: index + 1,
			reason: 'NO_AVAILABLE_SLOT' as const,
			facultyId: 300 + index,
		})),
	} as never;
}

test('S1a RENDERED: every must-fix item is listed — the disclosure is gone from the blocker group', async () => {
	const readiness = deriveSimplePublishReadiness(
		tenUnresolvedDraft(),
		[],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 10, softCount: 0 },
	);
	const group = readiness.blockerGroups[0];
	assert.equal(group.count, 10, 'the derivation really holds ten must-fix sessions, so this row is not vacuous');

	const host = await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness,
		onNavigate: () => {},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));

	const items = host.querySelectorAll('[data-testid="timetable-simple-blocker-items"] > div');
	assert.equal(items.length, 10, 'all ten must-fix items render; the old code sliced to three');

	// The disclosure itself. The packet names the shape: a blocker group must not
	// carry a `Show N more` control at all.
	const blockerGroup = host.querySelector('[data-testid="timetable-simple-blocker-group"]');
	assert.ok(blockerGroup, 'the blocker group renders');
	assert.doesNotMatch(blockerGroup.textContent ?? '', /Show \d+ more|Show less/,
		'no must-fix item is behind a disclosure any more');
	assert.equal(blockerGroup.querySelectorAll('[aria-expanded]').length, 0,
		'and the group carries no expander element of any kind');

	// Every listed item names a real class — the old slice also hid the identity.
	assert.match(host.textContent ?? '', /7-Rizal 100 · TLE 200/, 'the first item still names its section and subject');
	assert.match(host.textContent ?? '', /7-Rizal 109 · TLE 209/, 'and so does the tenth, which the disclosure used to hide');
});

test('S1b RENDERED + CLICKED: every item carries its own repair control, carrying THAT item', async () => {
	const readiness = deriveSimplePublishReadiness(
		tenUnresolvedDraft(),
		[],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 10, softCount: 0 },
	);
	const calls: Array<{ href: string; reason?: string; count?: number; identity: unknown }> = [];
	const host = await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness,
		onNavigate: (href: string, reason?: string, count?: number, identity?: unknown) => {
			calls.push({ href, reason, count, identity });
		},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));

	const rowActions = host.querySelectorAll<HTMLElement>('[data-testid="timetable-simple-blocker-item-action"]');
	assert.equal(rowActions.length, 10, 'every must-fix row has its own control, not just the group header');

	// Click the SEVENTH row's control — the one the disclosure used to hide.
	const seventh = rowActions[6];
	act(() => { seventh.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })); });
	assert.equal(calls.length, 1, 'one click dispatches exactly one repair');
	assert.deepEqual(calls[0].identity, { sectionId: 106, subjectId: 206, facultyId: 306 },
		'the deep link carries the SEVENTH item, so the repair lands on that row');
	assert.equal(calls[0].reason, 'NO_AVAILABLE_SLOT', 'and it keeps the group reason, so the destination resolver still routes it');
	assert.equal(calls[0].count, 10, 'the group count travels with it, so the banner states the true number');

	// Clickable must look clickable (§11): a real @/ui button, a verb in the label.
	assert.equal(seventh.tagName, 'BUTTON', 'the row action is a real button, not a bare text link');
	assert.match(seventh.textContent ?? '', /Place manually/, 'and it carries a verb');
	assert.notEqual(seventh.getAttribute('type'), null, 'a real control declares its type');
});

test('S1c RENDERED: every count states the population and the scope it covers', async () => {
	const unresolved = deriveSimplePublishReadiness(
		tenUnresolvedDraft(),
		[],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 10, softCount: 0 },
	);
	const host = await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness: unresolved,
		onNavigate: () => {},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));

	const population = host.querySelector('[data-testid="timetable-simple-blocker-population"]');
	assert.ok(population, 'the blocker group states its population');
	assert.match(population.textContent ?? '', /classes with no time yet/,
		'an unresolved-queue group says so in the SHARED plain noun, not a new one');
	assert.match(population.textContent ?? '', /in this list/,
		'and it says the number is the LIST, which is the whole S1c fix: the header chip counts a different population');
	const scopeBadge = host.querySelector('[data-testid="timetable-simple-blocker-scope"]');
	assert.equal(scopeBadge?.textContent, 'Whole year', 'the scope is still stated by the shared scope label');

	// A HARD-violation group names the OTHER population, so the two are distinct.
	const hardGroup = deriveSimplePublishReadiness(
		{ ...(tenUnresolvedDraft() as object), unassignedItems: [] } as never,
		[{ code: 'SECTION_TIME_CONFLICT', severity: 'HARD', message: 'overlap', schoolId: 1, schoolYearId: 1, runId: 1, entities: { sectionId: 5, subjectId: 6 } }],
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 1, unassignedCount: 0, softCount: 0 },
	).blockerGroups[0];
	assert.match(hardGroup.populationLabel, /Must fix problems/,
		'a HARD-violation group names must-fix problems, so the two lists cannot be read as one number');
});

test('S1d RENDERED: the WARNING row keeps its disclosure — a warning blocks nothing', async () => {
	const readiness = deriveSimplePublishReadiness(
		{ ...(tenUnresolvedDraft() as object), unassignedItems: [], summary: { unassignedCount: 0, softViolationCount: 6 } } as never,
		Array.from({ length: 6 }, (_, index) => ({
			code: 'FACULTY_EXCESSIVE_IDLE_GAP',
			severity: 'SOFT' as const,
			message: 'idle',
			schoolId: 1,
			schoolYearId: 1,
			runId: 1,
			entities: { sectionId: 10 + index, subjectId: 20 + index, facultyId: 30 + index },
		})),
		sectionLabel,
		subjectLabel,
		facultyLabel,
		{ blockingHardCount: 0, unassignedCount: 0, softCount: 6 },
	);
	assert.equal(readiness.warningGroups[0].count, 6, 'six warnings of one cause, so the disclosure is needed');

	const host = await mount(createElement(SimplePublishReadinessSheetBody, {
		readiness,
		onNavigate: () => {},
		onCopySummary: () => {},
		onDownloadCsv: () => {},
		onClose: () => {},
	} as never));

	const expand = host.querySelectorAll('[data-testid="timetable-simple-warning-expand"]');
	assert.equal(expand.length, 1, 'the warning disclosure is untouched — this slice changed must-fix items only');
	assert.equal(host.querySelectorAll('[data-testid="timetable-simple-warning-item"]').length, 3,
		'and the warning row still shows three items before the disclosure');
});

test('S1e SCOPE AUTHORITY: the publication gate numbers are untouched by this slice', () => {
	const draft = tenUnresolvedDraft();
	const withAuthority = deriveSimplePublishReadiness(
		draft, [], sectionLabel, subjectLabel, facultyLabel,
		{ blockingHardCount: 6, unassignedCount: 10, softCount: 4 },
	);
	// The header chip reads run-wide 6 and this list is the unresolved queue. The
	// two differ, and nothing in this slice changes either.
	assert.equal(withAuthority.runWideBlockingHard, 6, 'the run-wide HARD gate is the server number, unchanged');
	assert.equal(withAuthority.runWideUnassigned, 10, 'the run-wide unresolved gate is unchanged');
	assert.equal(withAuthority.hasBlockers, true, 'and the gate still decides on those two alone');

	// The rendering list is a DIFFERENT population, and it says so.
	const listed = withAuthority.blockerGroups.reduce((sum, group) => sum + group.count, 0);
	assert.equal(listed, 10, 'the blocker list holds the ten unresolved sessions, not the six HARD violations');
	assert.notEqual(listed, withAuthority.runWideBlockingHard,
		'the two figures legitimately differ, which is exactly why each must now say what it covers');
});

test('S1f WIRING: the blocker row keeps its 44px repair targets and its screen-reader names', () => {
	// Labelled WIRING because "does not look clickable" is not a runtime property
	// this harness can read off a CSS-less JSDOM. The rendered rows above prove the
	// controls EXIST and are clickable; this row pins the dimensions and the names.
	const sheet = readFileSync(resolve(CLIENT_ROOT, 'src/components/timetable/SimplePublishReadinessSheet.tsx'), 'utf8');
	assert.doesNotMatch(sheet, /className="h-7 shrink-0 gap-1 text-xs"/, 'no sub-44px repair control');
	assert.match(sheet, /timetable-simple-blocker-item-action/);
	assert.match(sheet, /aria-label=\{`\$\{group\.actionLabel\}: \$\{item\.sectionLabel\}, \$\{item\.subjectLabel\}`\}/,
		'each item control has its own screen-reader name, naming its own row');
	assert.match(sheet, /sessions affected/, 'the accepted count wording is preserved');
});

test('S1g WIRING: package.json names every test file this slice created, so no gate is dead', () => {
	// AGENTS.md §11: "a test no gate runs is not evidence", and the precedent is a
	// script that named two deleted files and still exited 0 with a green tally.
	const pkg = JSON.parse(readFileSync(resolve(CLIENT_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
	const script = pkg.scripts['test:ux-a2-mc-manual-controls'];
	assert.ok(script, 'the slice has its own package.json script');
	for (const file of [
		'a2-mc-one-count-one-list.test.tsx',
		'a2-mc-warning-row-identity.test.ts',
		'a2-mc-move-swap-offers.test.tsx',
		'a2-mc-plain-words-preview.test.tsx',
		'a2-mc-edit-receipt.test.ts',
	]) {
		assert.ok(script.includes(file), `${file} is reachable from test:ux-a2-mc-manual-controls`);
		assert.doesNotMatch(script, /--max-old-space-size=(?!6144)/, 'every .tsx render test runs with the 6144MB cap (A2 c12 OOM precedent)');
	}
});
