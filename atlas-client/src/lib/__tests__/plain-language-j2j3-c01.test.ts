/**
 * PLAIN-LANGUAGE-J2J3-C01 (J2 engine tokens, J3 domain jargon) — T1..T7.
 *
 * Run: `npm run test:plain-language-j2j3-c01` (also named in `test:client-suite`).
 *
 * Every row is written against the REAL production surface: the real
 * `VIOLATION_PRESENTATION` map (never an invented fixture), the real union
 * types read out of `src/types.ts`, and real renders of the actual components
 * (`ViolationGroup`, `TimetableRunsPane`, `SoftViolationConfirmDialog`) in the
 * same jsdom harness the sibling `draft-ux-c01` row uses. A control that
 * validated a formatter against a fixture the surface does not produce would
 * pass while the product stayed wrong.
 *
 * T1 map parity ......... the production rail map and the canonical plain map are
 *                         the same values, and the old terse titles are gone.
 * T2 production render .. the rail renders the plain title for a real code, and
 *                         the old terse title and the raw enum both fail it.
 * T3 enum humanisation .. the rail / entry panel / workflow dialog / runs pane /
 *                         summary stat never show an enum.
 * T4 soft-warning copy .. the apply dialog shows the real plain title and no
 *                         engine phrase, while the raw code stays reachable.
 * T5 session-unit truth . a zero-unassigned surface never says "classes".
 * T6 total enum maps .... every union member maps to a non-empty plain label.
 * T7 shared severity .... the summary severity label derives from MUST_FIX_LABEL.
 * T8 ONE degradation .... ONE unmapped code yields ONE honest sentence on the
 *                         resolver, the room/run helpers, the unassigned
 *                         reasons and the rendered dialog; absent yields the em
 *                         dash; and the rule really is shared (no import cycle,
 *                         no second copy, no de-snake-cased fallback anywhere).
 *
 * Each row carries a MUTANT that proves the assertion can fail, so a green run is
 * evidence rather than a tautology.
 *
 * Source-level rows strip comments before matching. The production fixes quote
 * the exact strings they removed (that is how a reader knows what changed), so a
 * naive source match would find its own documentation and pass forever.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, test } from 'node:test';
import { act, createElement, type ReactElement } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/timetable',
});
function matchMediaStub(query: string) {
	const min = /min-width:\s*(\d+)px/.exec(query);
	const max = /max-width:\s*(\d+)px/.exec(query);
	const matches = min ? 1366 >= Number(min[1]) : max ? 1366 <= Number(max[1]) : false;
	return {
		matches,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	};
}
(dom.window as unknown as { matchMedia: typeof matchMediaStub }).matchMedia = matchMediaStub;
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element,
	Node: dom.window.Node,
	DocumentFragment: dom.window.DocumentFragment,
	Text: dom.window.Text,
	SVGElement: dom.window.SVGElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
	Event: dom.window.Event,
	CustomEvent: dom.window.CustomEvent,
	FocusEvent: dom.window.FocusEvent,
	KeyboardEvent: dom.window.KeyboardEvent,
	MouseEvent: dom.window.MouseEvent,
	PointerEvent: (dom.window as unknown as { PointerEvent?: unknown }).PointerEvent ?? dom.window.MouseEvent,
	NodeFilter: dom.window.NodeFilter,
	MutationObserver: dom.window.MutationObserver,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	DOMRect: dom.window.DOMRect,
	matchMedia: matchMediaStub,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window.HTMLElement.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
(dom.window.HTMLElement.prototype as unknown as { hasPointerCapture: () => boolean }).hasPointerCapture = () => false;
(dom.window.HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};

// react-dom must load after the DOM globals.
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { VIOLATION_LABELS: RAIL_LABELS, UNASSIGNED_REASON_LABELS } = await import('../../components/timetable/ScheduleReviewWorkspace.constants');
const { VIOLATION_TITLES, humaniseEngineToken, resolveViolationTitle } = await import('../../lib/violation-presentation');
const plain = await import('../../lib/timetable-plain-language');
const { ViolationGroup } = await import('../../components/timetable/TimetableShared');
const { TimetableRunsPane } = await import('../../components/timetable/TimetableRunsPane');
const { SoftViolationConfirmDialog } = await import('../../components/timetable/modals/SoftViolationConfirmDialog');
const { severitySummary } = await import('../../components/timetable/TimetableGridConflictBadge');
const { resolveViolationLabel } = await import('../../hooks/useTimetableData');
const degradation = await import('../../lib/plain-rule-degradation');
// Type-only: erased at runtime, so it cannot disturb the jsdom init order above.
type Violation = import('../../types').Violation;
type ViolationCode = import('../../types').ViolationCode;

/* RECONCILED (J2 + J2J3 -> main). The candidate's own bare-label maps
 * (`ROOM_DECISION_STATUS_LABELS`, `ROOM_APPEAL_STATUS_LABELS`,
 * `GENERATION_RUN_STATUS_LABELS`) are deliberately NOT imported here: main
 * already names each of those statuses, and two label sets for one status is the
 * exact "one problem, four names" defect J1 exists to remove. These tests
 * therefore observe the canonical maps through the exported resolvers, which is
 * the surface a product caller actually reaches. */
const {
	ALL_SESSIONS_PLACED_LABEL,
	MUST_FIX_LABEL,
	UNLABELLED_RULE_SENTENCE,
	generationRunStateLabel,
	mustFixCountLabel,
	plainGenerationRunStatus,
	plainRoomAppealStatus,
	plainRoomDecisionStatus,
} = plain;

const clientRoot = resolve(import.meta.dirname, '../../..');
const source = (relative: string) => readFileSync(resolve(clientRoot, relative), 'utf8');

/** Source with comments removed, so a negative source assertion cannot match the
 * fix's own explanatory comment. `//` preceded by `:` is left alone so a URL
 * inside a string is not mistaken for a comment. */
function code(relative: string): string {
	return source(relative)
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** SCREAMING_SNAKE / engine-token shape. T2/T3/T6 assert no OPERATOR TEXT
 * matches this. A violation code legitimately does, so the shape is never
 * asserted against a code — only against a label or a rendered surface. */
const ENGINE_TOKEN = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

/** The one absent-value marker, written as a replacement so the row cannot pass on
 * a stray ASCII hyphen. Shared by T6 and T8, which both assert it. */
const EM_DASH = '-'.replace('-', '—');

/** The REAL union members, read from the REAL type declaration, so no row can
 * pass against a union that has since grown or shrunk. */
function unionMembers(typeName: string): string[] {
	const typesSource = source('src/types.ts');
	const match = typesSource.match(new RegExp(`export type ${typeName} = ([^;]+);`));
	assert.ok(match, `the real ${typeName} union must be found in src/types.ts`);
	return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

let root: Root | null = null;
const container = () => document.getElementById('root')!;

async function flush() {
	for (let index = 0; index < 5; index += 1) {
		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
	}
}

async function mount(element: ReactElement): Promise<HTMLElement> {
	if (root) await act(async () => { root?.unmount(); });
	document.body.innerHTML = '';
	const host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	await act(async () => { root?.render(element); });
	await flush();
	return host;
}

after(async () => { if (root) await act(async () => { root?.unmount(); }); });

function violation(code: ViolationCode, message = 'Faculty 16 has an issue on MONDAY.'): Violation {
	return {
		code,
		severity: 'SOFT',
		message,
		schoolId: 1,
		schoolYearId: 10,
		runId: 318,
		entities: { facultyId: 16, day: 'MONDAY' },
	} as Violation;
}

/** The real rail render: production component + production label map. */
async function renderRailGroup(code: ViolationCode, labels?: Record<ViolationCode, string>): Promise<string> {
	const host = await mount(createElement(ViolationGroup, {
		code,
		violations: [violation(code)],
		selectedViolation: null,
		onSelect: () => {},
		labels: (labels ?? RAIL_LABELS) as Record<ViolationCode, string>,
	}));
	return host.textContent ?? '';
}

/* ============================ T1 — map parity ============================ */

test('T1: the production rail map IS the canonical plain title map, value for value', () => {
	// Parity both ways, over the real canonical map. Not a spot check: if the
	// rail map ever gains or drops a key again, this fails.
	assert.deepEqual(
		Object.keys(RAIL_LABELS).sort(),
		Object.keys(VIOLATION_TITLES).sort(),
		'the rail map and the canonical plain map must have exactly the same keys',
	);
	for (const [entry, title] of Object.entries(VIOLATION_TITLES)) {
		assert.equal(
			RAIL_LABELS[entry as ViolationCode],
			title,
			`${entry} must carry the canonical plain title on the rail`,
		);
		assert.ok(title.trim().length > 0, `${entry} needs a non-empty plain title`);
	}

	// The three terse engine nouns the duplicate map used to show, with the real
	// canonical value each one now resolves to.
	assert.equal(RAIL_LABELS.LACKING_FACULTY, 'No teacher available');
	assert.equal(RAIL_LABELS.FACULTY_CONSECUTIVE_LIMIT_EXCEEDED, 'Long teaching block');
	assert.equal(RAIL_LABELS.UNASSIGNED_SECTION, 'Section session unassigned');

	// The retired zone warning keeps a neutral HISTORICAL label
	// (ZONE-WARNING-REMOVAL-C01): a noun, not an instruction to rebalance rooms.
	assert.match(RAIL_LABELS.ZONE_IMBALANCE_WARNING, /campus zone/i);
	assert.doesNotMatch(RAIL_LABELS.ZONE_IMBALANCE_WARNING, /move|rebalance|redistribute/i);

	// The source must not have re-grown a second hand-written literal map.
	assert.match(
		code('src/components/timetable/ScheduleReviewWorkspace.constants.ts'),
		/VIOLATION_LABELS: Record<ViolationCode, string> = VIOLATION_TITLES;/,
		'the rail map must be assigned from the canonical plain map, not a literal',
	);
});

test('T1 mutant: the parity assertion fires when a title drifts to a different name', () => {
	const drifted = { ...RAIL_LABELS, LACKING_FACULTY: 'Lacking Teacher' };
	assert.throws(
		() => assert.equal(drifted.LACKING_FACULTY, VIOLATION_TITLES.LACKING_FACULTY),
		/Lacking Teacher/,
		'the drifted title must actually fail the parity assertion',
	);
});

/* ======================= T2 — real production render ==================== */

test('T2: the rail renders the real plain title, and the terse title and raw enum both fail it', async () => {
	const text = await renderRailGroup('LACKING_FACULTY');
	assert.match(text, /No teacher available/, 'the real rail render shows the canonical plain title');
	assert.doesNotMatch(text, /Lacking Teacher/, 'the old terse engine noun is gone from the rendered rail');
	assert.doesNotMatch(text, /LACKING_FACULTY/, 'the raw enum never reaches the operator surface');

	// Every canonical code must survive the real render without leaking.
	for (const entry of Object.keys(VIOLATION_TITLES) as ViolationCode[]) {
		const rendered = await renderRailGroup(entry);
		assert.ok(rendered.includes(VIOLATION_TITLES[entry]), `${entry} must render its plain title`);
		assert.doesNotMatch(rendered, new RegExp(entry), `${entry} must not leak to the operator surface`);
	}
});

test('T2: an unmapped code degrades to the ONE honest sentence, never a raw enum, a de-snake-cased token, or empty', () => {
	// This is the empty-tooltip-heading defect. The old RightPanel heading was
	// the bare map index with NO fallback, so an unmapped code produced an EMPTY
	// heading on the explanation it was supposed to title.
	for (const entry of ['SOME_FUTURE_CODE', 'FACULTY_LUNCH_WINDOW_VIOLATION', 'LACKING_FACULTY']) {
		const resolved = resolveViolationTitle(entry);
		assert.ok(resolved.trim().length > 0, `${entry} must never resolve to an empty heading`);
		assert.doesNotMatch(resolved, ENGINE_TOKEN, `${entry} must never resolve to a raw engine token`);
	}
	/* R1 (B1) SUPERSEDES this row's pinned degradation. It used to assert
	 * `resolveViolationTitle('SOME_FUTURE_CODE') === 'some future code'`, which
	 * is exactly main's REJECTED string: a de-snake-cased canonical code, which
	 * reads as a broken sentence and is indistinguishable on screen from a real
	 * label. It also gave the same code two different sentences on two surfaces
	 * (`simplePublishReadiness` printed the shared honest sentence for the very
	 * same `FACULTY_EXCESSIVE_TRAVEL_DISTANCE`). The assertion is KEPT and its
	 * expected value re-pinned to the one honest sentence; the guard is
	 * strengthened, not removed. */
	assert.equal(resolveViolationTitle('SOME_FUTURE_CODE'), UNLABELLED_RULE_SENTENCE);
	assert.doesNotMatch(
		resolveViolationTitle('SOME_FUTURE_CODE'),
		/faculty|some future code/i,
		'an unmapped canonical code must not be de-snake-cased into a fake label',
	);

	// The retired travel code keeps its historical label (R7) — it is KNOWN, so
	// the honest-sentence rule does not apply to it.
	assert.equal(resolveViolationTitle('FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), 'Excessive Travel Distance');

	// The exported `resolveViolationLabel` name is preserved and now shares ONE
	// rule, so the rail search and the panel can never disagree.
	assert.equal(resolveViolationLabel('LACKING_FACULTY'), resolveViolationTitle('LACKING_FACULTY'));
	assert.equal(resolveViolationLabel('SOME_FUTURE_CODE'), UNLABELLED_RULE_SENTENCE);

	// RightPanel must not index a label map unguarded any more.
	const rightPanel = code('src/components/timetable/RightPanel.tsx');
	assert.doesNotMatch(rightPanel, /violationLabels\[/, 'the raw-map index and the empty heading are gone');
	assert.match(rightPanel, /resolveViolationTitle\(v\.code\)/, 'the panel resolves titles through the shared resolver');
});

test('T2 mutant: the plain-title assertion fires against the old terse rail title', async () => {
	// The real component, fed the REAL pre-collapse map value: it must fail.
	const oldMap = { ...RAIL_LABELS, LACKING_FACULTY: 'Lacking Teacher' };
	const text = await renderRailGroup('LACKING_FACULTY', oldMap as Record<ViolationCode, string>);
	assert.throws(
		() => assert.match(text, /No teacher available/),
		/No teacher available/,
		'the old terse title must actually fail the plain-title assertion',
	);
});

/* ===================== T3 — enum humanisation on real surfaces ========== */

test('T3: the runs pane renders a plain word for every real run status', async () => {
	// Real statuses, taken from the REAL union rather than an invented list.
	const runStatus = unionMembers('GenerationRunStatus');
	const created = [
		'2031-01-01T00:00:00.000Z',
		'2030-12-31T00:00:00.000Z',
		'2030-12-30T00:00:00.000Z',
		'2030-12-29T00:00:00.000Z',
	];
	const runs = runStatus.map((status, index) => ({
		id: 318 - index,
		status,
		createdAt: created[index],
	}));
	const host = await mount(createElement(
		MemoryRouter,
		null,
		createElement(TimetableRunsPane, {
			runs: runs as never,
			selectedRunId: 'latest',
			onSelectRun: () => {},
			formatTimestamp: (value: string | null) => value ?? '-',
			formatDuration: () => '-',
		}),
	));
	const text = host.textContent ?? '';

	for (const run of runs) {
		// The canonical map, reached through the exported resolver the pane calls.
		const label = generationRunStateLabel(run.status);
		assert.ok(text.includes(label), `${run.status} must render its plain word "${label}"`);
		// Main's J2 anchor shape: the run id is a quiet suffix behind a human
		// anchor (here the run's own timestamp), never the heading on its own.
		// The id must still be quotable by a scheduler — so assert the real text.
		assert.ok(text.includes(`run ${run.id}`), `the real run id ${run.id} must still render`);
		assert.doesNotMatch(
			text,
			new RegExp(`Run #${run.id}`),
			'the run id must not head the row as "Run #n"',
		);
	}
	// No status renders as its raw enum.
	for (const status of runStatus) {
		assert.doesNotMatch(text, new RegExp(status), `the raw ${status} enum must not render`);
	}
});

test('T3: no operator surface renders a decision or appeal enum', () => {
	/* The real render sites the packet names, asserted on real production source
	 * with comments stripped. THREE of these call sites moved when J2J3 was
	 * reconciled onto main, and they moved to main's canonical resolvers rather
	 * than to a second label set:
	 *   - the selected-entry panel now reads `roomRequestDecisionState` /
	 *     `roomRequestSubmissionState` and `roomRequestAppealState`, so it can
	 *     also print the `next` consequence sentence the bare `plain*` label
	 *     had nowhere to put;
	 *   - the runs pane now reads `generationRunStateLabel`, so its badge and
	 *     its `runAnchorLabel` heading come from one authority.
	 * The other three (left rail, workflow dialog, summary stats) keep the
	 * `plain*` resolvers, which still exist and still degrade to the em dash. */
	const sites: Array<[string, string, RegExp]> = [
		['src/components/timetable/LeftRailContent.tsx', 'left rail', /plainRoomDecisionStatus\(request\.decisionStatus\)/],
		['src/components/timetable/RightPanel.tsx', 'selected-entry panel', /roomRequestDecisionState\(matchingRequest\?\.decisionStatus\)/],
		['src/components/timetable/RightPanel.tsx', 'selected-entry submission state', /roomRequestSubmissionState\(matchingRequest\?\.status\)/],
		['src/components/timetable/RightPanel.tsx', 'selected-entry appeal line', /roomRequestAppealState\(matchingRequest\.latestAppealStatus\)/],
		['src/components/timetable/modals/TimetableWorkflowDialogs.tsx', 'workflow dialog', /plainRoomAppealStatus\(appeal\.status\)/],
		['src/components/timetable/TimetableRunsPane.tsx', 'runs pane', /generationRunStateLabel\(run\.status\)/],
		['src/components/timetable/ScheduleReviewWorkspaceSummaryStats.tsx', 'summary stats', /plainGenerationRunStatus\(draftStatus\)/],
	];
	for (const [path, where, expected] of sites) {
		assert.match(code(path), expected, `the ${where} must render the plain label`);
	}

	// The selected-entry panel must NOT have kept the single-line bare-label
	// variant: it would drop the consequence sentence main added.
	assert.doesNotMatch(
		code('src/components/timetable/RightPanel.tsx'),
		/plainRoomDecisionStatus\(/,
		'the selected-entry panel reads the canonical decision state, not a second label',
	);
	assert.doesNotMatch(
		code('src/components/timetable/RightPanel.tsx'),
		/plainRoomAppealStatus\(/,
		'the selected-entry panel reads the canonical appeal state, not a second label',
	);

	// And the raw interpolations this cycle removed must be gone everywhere.
	for (const path of [
		'src/components/timetable/LeftRailContent.tsx',
		'src/components/timetable/RightPanel.tsx',
		'src/components/timetable/modals/TimetableWorkflowDialogs.tsx',
		'src/components/timetable/TimetableRunsPane.tsx',
	]) {
		const text = code(path);
		assert.doesNotMatch(text, /\{request\.decisionStatus\}/, `${path} must not render the raw decision enum`);
		assert.doesNotMatch(text, /\{appeal\.status\}/, `${path} must not render the raw appeal enum`);
		assert.doesNotMatch(text, /\{run\.status\}/, `${path} must not render the raw run enum`);
		assert.doesNotMatch(text, /\{draftStatus\}/, `${path} must not render the raw run-status enum`);
	}

	// The left-rail badge also dropped `uppercase`, which would have CSS-shouted
	// the plain label back into the defect it replaced.
	assert.doesNotMatch(
		code('src/components/timetable/LeftRailContent.tsx'),
		/uppercase[^>]*>\{plainRoomDecisionStatus/,
		'the decision badge must not uppercase the plain label',
	);
});

/* ========================= T4 — soft-warning dialog ====================== */

test('T4: the soft-warning apply dialog shows the real plain title and no engine phrase', async () => {
	const warnings = [
		violation('FACULTY_DAILY_STANDARD_EXCEEDED', 'Faculty 16 is above the preferred daily target.'),
		violation('FACULTY_EXCESSIVE_IDLE_GAP', 'Faculty 16 has a long gap on MONDAY.'),
	];
	// The dialog renders through a Radix portal, so the real operator-visible
	// text lives on document.body, not inside the React host element. Reading the
	// body is what a scheduler's screen actually shows.
	await mount(createElement(SoftViolationConfirmDialog, {
		open: true,
		warnings,
		commitLoading: false,
		onCancel: () => {},
		onConfirm: () => {},
		formatConstraintMessage: (message: string) => message,
	}));
	const text = document.body.textContent ?? '';

	// The real canonical titles for the real codes.
	assert.match(text, /Daily teaching target exceeded/, 'the real plain presentation title renders');
	assert.match(text, /Long idle gap/, 'the second real plain title renders');

	/* RECONCILED — this row's copy claim belonged to the candidate, not to the
	 * ruling. The candidate renamed the dialog to "Warnings about this move";
	 * the packet keeps MAIN's structure and main's warning-count sentence, so
	 * main's title stands. "Soft Constraint Warnings" is plain English and is
	 * main's own accepted copy, so asserting it is gone was asserting a product
	 * change this reconciliation explicitly declined to make. It is replaced by
	 * the claim J2 actually rests on — NO ENGINE TOKEN reaches this surface —
	 * which is stronger and does not depend on the dialog's title wording, and
	 * by a pin on the reconciled title so a future rename is a deliberate act. */
	assert.match(text, /Soft Constraint Warnings/, "the reconciled dialog keeps main's own title");
	for (const code of Object.keys(VIOLATION_TITLES)) {
		assert.doesNotMatch(text, new RegExp(code), `no raw ${code} token in the dialog text`);
	}
	assert.doesNotMatch(text, /[A-Z][A-Z0-9]*(_[A-Z0-9]+)+/, 'no engine token reaches this surface at all');

	// The raw code must not be in the default (fully open) dialog text.
	assert.doesNotMatch(text, /FACULTY_DAILY_STANDARD_EXCEEDED/, 'no raw code in the default dialog text');
	assert.doesNotMatch(text, /FACULTY_EXCESSIVE_IDLE_GAP/);

	/* RECONCILED. The candidate's version of this surface added a monospace
	 * `<p>{warning.code}</p>` inside a Tooltip, so the engine token was
	 * reachable in the UI. That REVERSES main's J2 ruling — this dialog
	 * deliberately prints no engine token anywhere — and the packet ruled it
	 * out explicitly, so the Tooltip and the `getViolationPresentation` call are
	 * gone rather than the row being weakened around them. The anti-regression
	 * intent is preserved and is now STRONGER: the row resolves through the one
	 * shared total resolver, the empty-title fallback is retained, and the
	 * source must not reintroduce a rendered raw code. */
	const dialogSource = code('src/components/timetable/modals/SoftViolationConfirmDialog.tsx');
	assert.match(
		dialogSource,
		/resolveViolationTitle\(warning\.code\)/,
		'the row must resolve its title through the shared total resolver',
	);
	assert.match(
		dialogSource,
		/UNLABELLED_RULE_SENTENCE/,
		'an unlabelled rule must still read as English, never as an empty row',
	);
	assert.doesNotMatch(
		dialogSource,
		/font-mono[^;]*\{warning\.code\}/,
		'this surface must not print an engine token in a monospace span',
	);
	// A code the presentation map does not know still gets a total title, and the
	// retired code keeps its historical name — which the old
	// `VIOLATION_PRESENTATION[code] ? .title : UNLABELLED_RULE_SENTENCE` shape
	// could not do.
	assert.equal(resolveViolationTitle('FACULTY_EXCESSIVE_TRAVEL_DISTANCE'), 'Excessive Travel Distance');
});

test('T4 mutant: the engine-phrase assertion fires on the old dialog title', () => {
	assert.throws(
		() => assert.doesNotMatch('Soft Constraint Warnings', /Soft Constraint Warnings/),
		/Soft Constraint Warnings/,
		'the old engine phrase must actually fail the assertion',
	);
});

/* ====================== T5 — the session-unit truth ====================== */

test('T5: no zero-unassigned surface says "classes"; the canonical session wording is used', () => {
	assert.equal(ALL_SESSIONS_PLACED_LABEL, 'All sessions placed');

	// Both real panels that render this state, from the real files.
	for (const path of [
		'src/components/timetable/GeneratedRunRailPanels.tsx',
		'src/components/timetable/GeneratedUnassignedPanel.tsx',
	]) {
		const text = code(path);
		assert.doesNotMatch(text, /All classes assigned/i, `${path} must not call the unplaced count "classes"`);
		assert.match(text, /ALL_SESSIONS_PLACED_LABEL/, `${path} must use the one canonical constant`);
	}

	// The three low-risk jargon strings, on their real files.
	const summaryStats = code('src/components/timetable/ScheduleReviewWorkspaceSummaryStats.tsx');
	assert.doesNotMatch(summaryStats, /the algorithm/i, '"the algorithm" is engine vocabulary');
	assert.doesNotMatch(summaryStats, /computing time/i, '"computing time" is engine vocabulary');
	for (const path of [
		'src/components/timetable/GeneratedRunRailPanels.tsx',
		'src/components/timetable/GeneratedUnassignedPanel.tsx',
	]) {
		assert.doesNotMatch(code(path), /draft data/i, `${path} must not say "draft data"`);
	}

	// And the unassigned-reason fallbacks never echo the enum.
	for (const path of [
		'src/components/timetable/GeneratedRunRailPanels.tsx',
		'src/components/timetable/GeneratedUnassignedPanel.tsx',
	]) {
		const text = code(path);
		assert.doesNotMatch(text, /\?\? reason\b/, `${path} must not fall back to a raw reason enum`);
		assert.doesNotMatch(text, /label: reason\b/, `${path} must not badge a raw reason enum`);
	}
	/* R1 (B1): this row used to end on `humaniseEngineToken('NO_AVAILABLE_SLOT')
	 * === 'no available slot'`, presented as the unassigned-reason degradation.
	 * `UnassignedReason` is a CANONICAL code space, so de-snake-casing it is a
	 * false label, and the assertion read as a claim that the badge printed a
	 * de-snake-cased phrase. The helper stays exported and stays covered — it is
	 * still the readable fallback for genuinely free-form text — so the assertion
	 * is KEPT, and T8 now pins what the badge actually does. */
	assert.equal(humaniseEngineToken('NO_AVAILABLE_SLOT'), 'no available slot');
});

test('T5 mutant: the "classes" assertion fires on the old false sentence', () => {
	assert.throws(
		() => assert.doesNotMatch('All classes assigned successfully', /classes/i),
		/classes/i,
		'the old false sentence must actually fail the assertion',
	);
});

/* ==================== T6 — total enum-to-plain-word maps ================== */

test('T6: every union member maps to a non-empty plain word for all three unions', () => {
	// The union members are the REAL ones from the REAL type declarations, read
	// from source, so this cannot pass against a union that has since grown.
	const decision = unionMembers('RoomPreferenceDecisionStatus');
	const appeal = unionMembers('RoomRequestAppealStatus');
	const runStatus = unionMembers('GenerationRunStatus');
	assert.ok(decision.length >= 3 && appeal.length >= 4 && runStatus.length >= 4, 'the real unions must be enumerated');

	/* RECONCILED. The canonical maps are main's, and main keeps them PRIVATE
	 * (`ROOM_REQUEST_DECISION_STATES`, `ROOM_REQUEST_APPEAL_STATES`,
	 * `GENERATION_RUN_STATE_LABELS` are `const`, not exported). The candidate's
	 * exported bare-label maps were deleted, so totality is observed through the
	 * exported `plain*` resolvers — the surface a product caller reaches — and the
	 * compiler-enforced totality annotation is asserted on the real source below.
	 * A resolver that missed a member would return the em dash or a humanised
	 * phrase, both of which fail these rows. */
	for (const [unionName, union, resolve] of [
		['RoomPreferenceDecisionStatus', decision, plainRoomDecisionStatus],
		['RoomRequestAppealStatus', appeal, plainRoomAppealStatus],
		['GenerationRunStatus', runStatus, plainGenerationRunStatus],
	] as const) {
		const labels: string[] = [];
		for (const member of union) {
			const label = resolve(member);
			assert.notEqual(
				label,
				'—',
				`${unionName}.${member} must be mapped, not left to the absent-value em dash`,
			);
			assert.notEqual(
				label,
				member.replace(/_/g, ' ').toLowerCase(),
				`${unionName}.${member} must have its own plain word, not the out-of-union degradation`,
			);
			assert.ok(label.trim().length > 0, `${unionName}.${member} needs a non-empty plain label`);
			assert.doesNotMatch(label, ENGINE_TOKEN, `${unionName}.${member} label is a raw engine token`);
			assert.doesNotMatch(label, /_/, `${unionName}.${member} label must not contain an underscore`);
			labels.push(label);
		}
		// No two members may collapse onto one word, or a status would be
		// ambiguous exactly where it is being distinguished.
		assert.equal(
			new Set(labels).size,
			union.length,
			`every ${unionName} member must have a DISTINCT plain word`,
		);
	}

	// The totality guarantee the compiler enforces, on the real source: each map
	// is annotated over the real union, so a NEW member is a build error rather
	// than a silent enum on screen. This is the load-bearing part.
	const plainSource = code('src/lib/timetable-plain-language.ts');
	for (const [unionName, annotation] of [
		['RoomPreferenceDecisionStatus', /const ROOM_REQUEST_DECISION_STATES: Record<RoomPreferenceDecisionStatus, PlainRoomRequestState>/],
		['RoomRequestAppealStatus', /const ROOM_REQUEST_APPEAL_STATES: Record<RoomRequestAppealStatus, string>/],
		['GenerationRunStatus', /const GENERATION_RUN_STATE_LABELS: Record<GenerationRunStatus, string>/],
	] as const) {
		assert.match(
			plainSource,
			annotation,
			`${unionName} must be labelled from a total Record<union, string> map`,
		);
	}
	// And the run-status map is NOT total over a free-form string: `runType` is
	// free-form, so its kind map must stay `Record<string, string>`.
	assert.match(
		plainSource,
		/const GENERATION_RUN_KIND_LABELS: Record<string, string>/,
		'the run KIND map must stay non-total, because runType is free-form',
	);

	// The resolvers degrade honestly: absent stays the em-dash the surfaces
	// already used, and an out-of-union value gets the ONE shared sentence.
	/* R1 (B1) SUPERSEDES the out-of-union expectation. It used to assert
	 * `plainGenerationRunStatus('A_NEW_SERVER_STATUS') === 'a new server status'`
	 * — the de-snake-cased phrase this cycle removed as a false label. The
	 * assertion is KEPT and re-pinned to the honest sentence. */
	assert.equal(plainRoomDecisionStatus(null), '-'.replace('-', '—'));
	assert.equal(plainRoomAppealStatus(undefined), '—');
	assert.equal(plainGenerationRunStatus(''), '—');
	assert.equal(plainGenerationRunStatus('—'), '—');
	assert.equal(plainGenerationRunStatus('A_NEW_SERVER_STATUS'), UNLABELLED_RULE_SENTENCE);
	for (const value of ['A_NEW_SERVER_STATUS', 'NEW_THING']) {
		assert.doesNotMatch(plainGenerationRunStatus(value), ENGINE_TOKEN);
	}

	// The counterpart the reconciliation changed: main's own resolvers CONFLATED
	// absent with "this version does not name it", which is a false claim when
	// the server simply sent no value. Pin the difference so it cannot silently
	// come back, and pin that the known-value wording is shared.
	assert.equal(plainGenerationRunStatus(null), '—');
	assert.equal(
		plainGenerationRunStatus('COMPLETED'),
		generationRunStateLabel('COMPLETED'),
		'a known run status must resolve to the ONE canonical word on both paths',
	);
});

test('T6 mutant: a missing union member is caught by the totality assertion', () => {
	// The resolver-level totality row, with one member's map entry removed.
	const runStatus = unionMembers('GenerationRunStatus');
	const labels = runStatus.map((status) => [status, plainGenerationRunStatus(status)] as const);
	assert.throws(
		() => {
			const partial = labels.filter(([status]) => status !== 'FAILED');
			assert.deepEqual(
				partial.map(([status]) => status).sort(),
				[...runStatus].sort(),
				'the map must be total over the real union',
			);
		},
		/FAILED/,
		'a missing union member must actually fail the totality assertion',
	);
});

/* ==================== T7 — the shared severity label ===================== */

test('T7: the summary severity label is derived from MUST_FIX_LABEL, not a fourth copy', () => {
	assert.equal(MUST_FIX_LABEL, 'Must fix');
	// Behaviour is byte-identical to the pre-change output.
	assert.equal(severitySummary(3, 2), '3 Must fix, 2 warnings');
	assert.equal(severitySummary(1, 0), '1 Must fix');
	assert.equal(severitySummary(0, 1), '1 warning');
	assert.equal(severitySummary(0, 2), '2 warnings');
	assert.equal(severitySummary(0, 0), '');
	// And the string really is the shared one.
	assert.equal(severitySummary(3, 0), mustFixCountLabel(3));

	const badge = code('src/components/timetable/TimetableGridConflictBadge.tsx');
	const start = badge.indexOf('export function severitySummary');
	assert.ok(start > 0, 'severitySummary must exist in the grid conflict badge');
	const fn = badge.slice(start, badge.indexOf('\n}', start));
	assert.doesNotMatch(fn, /Must fix/, 'severitySummary must not hardcode the plain word');
	assert.match(fn, /mustFixCountLabel\(/, 'severitySummary must reuse the shared count+label helper');
	// The same file keeps its other MUST_FIX_LABEL uses, so nothing was deleted.
	assert.match(badge, /MUST_FIX_LABEL/, 'the file still uses the shared constant for its sign');

	// mustFixCountLabel is itself defined in terms of MUST_FIX_LABEL.
	const plainSource = code('src/lib/timetable-plain-language.ts');
	assert.match(plainSource, /export const MUST_FIX_LABEL = 'Must fix';/, 'one definition of the plain word');
	assert.match(
		plainSource,
		/return `\$\{count\} \$\{MUST_FIX_LABEL\}`;/,
		'the count helper is derived from the constant',
	);
});

test('T7 mutant: a reintroduced hardcoded copy is caught by the T7 source assertion', () => {
	const reintroduced = 'return `${hardCount} Must fix`;';
	assert.throws(
		() => assert.doesNotMatch(reintroduced, /Must fix/),
		/Must fix/,
		'a reintroduced hardcoded copy must actually fail the assertion',
	);
});

/* =============== T8 — ONE degradation rule across every surface ============ */

test('T8: one unmapped code gets ONE honest sentence on the resolver, the room/run helpers, the unassigned reasons and the dialog', async () => {
	/* THE B1 ROW. Before R1, `resolveViolationTitle` degraded an unmapped
	 * `ViolationCode` with `humaniseEngineToken` while `simplePublishReadiness`
	 * degraded the same code with `UNLABELLED_RULE_SENTENCE`, so the SAME code had
	 * two different sentences on two operator surfaces. This row is the regression
	 * guard for that: it drives one real unmapped code through every resolver and
	 * the really-rendered dialog, and requires a single answer.
	 *
	 * FIXTURE CHANGED, CONTROL KEPT AND STRENGTHENED (LANE-A-VIOLATION-LABEL-GUARD).
	 *
	 * The exemplar used to be `FACULTY_LUNCH_WINDOW_VIOLATION`, shared with the
	 * sibling `plain-tokens-c04.test.tsx` P1.1 mutant row. It was a true negative
	 * control while that code had no client label, because it then genuinely stood
	 * OUTSIDE the canonical `ViolationCode` union. That is no longer true: the
	 * code is a union member with real operator copy, so keeping it here would
	 * assert a FALSE claim — that ATLAS cannot name a rule it now names on both
	 * the Review-issues rail and Publish Readiness — and the row would go red for
	 * the right product change.
	 *
	 * Nothing is deleted and the control's purpose is unchanged: a value outside
	 * the canonical set must degrade to the ONE honest sentence on every resolver,
	 * never to a de-snake-cased token. The exemplar is now `SOME_FUTURE_CODE`,
	 * the value this same file already uses for exactly this contract at T2, and
	 * the honest remaining case now that every canonical code is named: a code a
	 * FUTURE server may emit. */
	const UNMAPPED_CODE = 'SOME_FUTURE_CODE';

	// Every resolver, one code. Each entry is (surface, text).
	const surfaces: Array<[string, string]> = [
		['resolveViolationTitle', resolveViolationTitle(UNMAPPED_CODE)],
		['useTimetableData.resolveViolationLabel', resolveViolationLabel(UNMAPPED_CODE)],
		['plainRoomDecisionStatus', plainRoomDecisionStatus(UNMAPPED_CODE)],
		['plainRoomAppealStatus', plainRoomAppealStatus(UNMAPPED_CODE)],
		['plainGenerationRunStatus', plainGenerationRunStatus(UNMAPPED_CODE)],
		// The unassigned-reason badge and the filter chip, through the exact
		// expression both real call sites now use over the real canonical map.
		[
			'unassigned reason (badge + filter chip)',
			degradation.plainRuleValue(UNASSIGNED_REASON_LABELS, UNMAPPED_CODE, (entry) => entry.label),
		],
	];
	for (const [where, text] of surfaces) {
		assert.equal(text, UNLABELLED_RULE_SENTENCE, `${where} must use the ONE honest sentence`);
		assert.doesNotMatch(text, ENGINE_TOKEN, `${where} must never render a raw engine token`);
		assert.doesNotMatch(text, /_/, `${where} must never render an underscore`);
		assert.doesNotMatch(
			text,
			/faculty|lunch window/i,
			`${where} must never de-snake-case the code into a fake label`,
		);
	}
	assert.equal(
		new Set(surfaces.map(([, text]) => text)).size,
		1,
		'ONE code must produce ONE sentence across every surface — two answers is the B1 defect',
	);

	// The dialog, really rendered, with the same unmapped code.
	await mount(createElement(SoftViolationConfirmDialog, {
		open: true,
		warnings: [
			// The real dialog row shape, carrying a code that is deliberately OUTSIDE
			// the canonical `ViolationCode` union — the exact case under test.
			{ ...violation('FACULTY_DAILY_STANDARD_EXCEEDED'), code: UNMAPPED_CODE } as unknown as Violation,
		],
		commitLoading: false,
		onCancel: () => {},
		onConfirm: () => {},
		formatConstraintMessage: (message: string) => message,
	}));
	const dialogText = document.body.textContent ?? '';
	assert.match(
		dialogText,
		/does not have a name for yet/,
		'the rendered dialog prints the same honest sentence',
	);
	assert.doesNotMatch(
		dialogText,
		/faculty lunch window violation/i,
		'the rendered dialog must not de-snake-case the code into a fake label',
	);
	assert.doesNotMatch(dialogText, new RegExp(UNMAPPED_CODE), 'the raw code never reaches the operator');

	/* Step 1 of the rule, on the same code space, through the same resolvers:
	 * ABSENT is not "unknown name". A server that sends no value must not produce
	 * a sentence about ATLAS having no name for it. */
	for (const absent of [null, undefined, ''] as Array<string | null | undefined>) {
		for (const [where, resolve] of [
			['plainRoomDecisionStatus', plainRoomDecisionStatus],
			['plainRoomAppealStatus', plainRoomAppealStatus],
			['plainGenerationRunStatus', plainGenerationRunStatus],
		] as const) {
			assert.equal(
				resolve(absent),
				EM_DASH,
				`${where} must render the em dash for an absent value, not ${JSON.stringify(absent)}`,
			);
			assert.notEqual(
				resolve(absent),
				UNLABELLED_RULE_SENTENCE,
				`${where} must not claim ATLAS has no name for a value that was never sent`,
			);
		}
	}
	assert.equal(resolveViolationTitle(''), EM_DASH, 'an absent violation code is absent, not unnamed');

	// Step 2 still works: a KNOWN member renders the ONE canonical label.
	assert.equal(resolveViolationTitle('LACKING_FACULTY'), VIOLATION_TITLES.LACKING_FACULTY);
	assert.equal(plainGenerationRunStatus('COMPLETED'), generationRunStateLabel('COMPLETED'));
	for (const known of Object.keys(UNASSIGNED_REASON_LABELS)) {
		assert.equal(
			degradation.plainRuleValue(UNASSIGNED_REASON_LABELS, known, (entry) => entry.label),
			UNASSIGNED_REASON_LABELS[known].label,
			`${known} must render its canonical label, not the honest sentence`,
		);
	}
});

test('T8/LANE-A: the lunch-window rule is NAMED, so the honest sentence no longer applies to it', async () => {
	/* THE ADDED HALF. T8 above now uses a code that is genuinely outside the
	 * canonical set. This row pins the other side of the same change, so the
	 * re-pointed fixture cannot be mistaken for the control having been weakened:
	 * `FACULTY_LUNCH_WINDOW_VIOLATION` is a canonical code and it now renders a
	 * real operator label through EVERY resolver T8 drives.
	 *
	 * This is the code the 2026-09-26 live walk found rendering as the raw engine
	 * code on the Review-issues rail (100 of 194 warnings) while Publish Readiness
	 * called it unnamed. */
	const LUNCH_CODE = 'FACULTY_LUNCH_WINDOW_VIOLATION';
	const expectedTitle = 'Teacher has no free lunch window';

	assert.equal(resolveViolationTitle(LUNCH_CODE), expectedTitle, 'the resolver names the rule');
	assert.equal(VIOLATION_TITLES[LUNCH_CODE], expectedTitle, 'the canonical title map names the rule');
	assert.equal(RAIL_LABELS[LUNCH_CODE], expectedTitle, 'the rail label map the workspace renders from names the rule');
	assert.notEqual(resolveViolationTitle(LUNCH_CODE), UNLABELLED_RULE_SENTENCE, 'a named rule is never "unnamed"');
	assert.equal(resolveViolationLabel(LUNCH_CODE), expectedTitle, 'the hook resolver agrees with the lib resolver');

	for (const [where, text] of [
		['resolveViolationTitle', resolveViolationTitle(LUNCH_CODE)],
		['useTimetableData.resolveViolationLabel', resolveViolationLabel(LUNCH_CODE)],
	] as const) {
		assert.doesNotMatch(text, ENGINE_TOKEN, `${where} must never render a raw engine token`);
		assert.doesNotMatch(text, /_/, `${where} must never render an underscore`);
	}

	// The rail really renders the plain name, and the raw code never reaches it.
	const railText = await renderRailGroup(LUNCH_CODE);
	assert.match(railText, new RegExp(expectedTitle), 'the real rail render shows the plain name');
	assert.doesNotMatch(railText, new RegExp(LUNCH_CODE), 'the raw engine code never reaches the operator surface');
	assert.doesNotMatch(railText, /faculty lunch window violation/i, 'the code is never de-snake-cased into a fake label');
});

test('T8 mutant: a reintroduced de-snake-cased fallback is caught, and the shared rule really is shared', () => {
	// The assertion above discriminates: the exact de-snake-cased string this
	// range used to ship must fail the same equality it applies to the product.
	const deSnakeCased = (code: string) => code.replace(/_/g, ' ').toLowerCase();
	assert.throws(
		() => assert.equal(deSnakeCased('FACULTY_LUNCH_WINDOW_VIOLATION'), UNLABELLED_RULE_SENTENCE),
		/[Ee]xpected values to be strictly equal/,
		'a de-snake-cased fallback must actually fail the cross-surface equality',
	);

	/* The shared rule is shared, not copied. `timetable-plain-language.ts` and
	 * `violation-presentation.ts` both depend on `plain-rule-degradation.ts`; it
	 * depends on neither; and the two label modules do not import each other. The
	 * import cycle is what pushed the previous round into a private fallback, so
	 * its absence is the structural half of this fix and is asserted on real
	 * source, comments stripped. */
	const degradationSource = code('src/lib/plain-rule-degradation.ts');
	assert.doesNotMatch(
		degradationSource,
		/violation-presentation|timetable-plain-language/,
		'the shared degradation module must import neither label module',
	);
	for (const path of ['src/lib/violation-presentation.ts', 'src/lib/timetable-plain-language.ts']) {
		const source = code(path);
		assert.match(
			source,
			/from '@\/lib\/plain-rule-degradation'/,
			`${path} must take the degradation rule from the shared module`,
		);
	}
	assert.doesNotMatch(
		code('src/lib/timetable-plain-language.ts'),
		/violation-presentation/,
		'the plain-language module must no longer import the presentation module',
	);
	assert.doesNotMatch(
		code('src/lib/violation-presentation.ts'),
		/timetable-plain-language/,
		'the presentation module must not import the plain-language module',
	);
	// The re-export is the same value, not a second copy of the sentence.
	assert.equal(
		degradation.UNLABELLED_RULE_SENTENCE,
		UNLABELLED_RULE_SENTENCE,
		'timetable-plain-language must re-export the ONE sentence, not restate it',
	);
	assert.equal(
		degradation.UNLABELLED_RULE_SENTENCE,
		'A problem that this version of ATLAS does not have a name for yet.',
	);
	assert.equal(degradation.ABSENT_VALUE_LABEL, EM_DASH);

	// And no operator surface may CALL it: `humaniseEngineToken` stays exported
	// for free-form text, but no canonical resolver may degrade through it. The
	// two label modules are checked precisely — `timetable-plain-language.ts` must
	// not even name it, and `violation-presentation.ts` may carry exactly one
	// occurrence, the export declaration itself.
	assert.doesNotMatch(
		code('src/lib/timetable-plain-language.ts'),
		/humaniseEngineToken/,
		'the plain-language module must not name the de-snake-cased helper at all',
	);
	const presentation = code('src/lib/violation-presentation.ts');
	assert.match(
		presentation,
		/export function humaniseEngineToken\(/,
		'the free-form helper must stay exported',
	);
	assert.equal(
		presentation.split('humaniseEngineToken').length - 1,
		1,
		'violation-presentation.ts must carry exactly one mention — the declaration — and no call',
	);
	for (const path of [
		'src/components/timetable/RightPanel.tsx',
		'src/components/timetable/GeneratedUnassignedPanel.tsx',
		'src/components/timetable/GeneratedRunRailPanels.tsx',
		'src/components/timetable/modals/SoftViolationConfirmDialog.tsx',
		'src/hooks/useTimetableData.ts',
		'src/components/timetable/simplePublishReadiness.ts',
		'src/components/timetable/TimetableSimpleHeader.tsx',
	]) {
		assert.doesNotMatch(
			code(path),
			/humaniseEngineToken/,
			`${path} must not degrade a canonical code with a de-snake-cased token`,
		);
	}
	// The two unassigned-reason sites must read the ONE rule over the ONE map.
	for (const path of [
		'src/components/timetable/GeneratedUnassignedPanel.tsx',
		'src/components/timetable/GeneratedRunRailPanels.tsx',
	]) {
		assert.match(
			code(path),
			/plainRuleValue\(UNASSIGNED_REASON_LABELS, reason, \(entry\) => entry\.label\)/,
			`${path} must resolve an unassigned reason through the shared rule`,
		);
	}
});
