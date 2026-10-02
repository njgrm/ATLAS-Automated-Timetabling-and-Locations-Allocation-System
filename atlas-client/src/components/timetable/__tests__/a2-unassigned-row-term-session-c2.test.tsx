/**
 * A2 move-swap c2, Item 4 — every unassigned row must state its OWN term and
 * session, so five `GR8 - Makabansa, TLE, NAVARRO` rows are distinguishable.
 *
 * ── THE RECORDED DEFECT ──────────────────────────────────────────────────────
 *
 * The generated-run unassigned/blocker list showed five identical lines
 * (`GR8 - Makabansa, TLE, NAVARRO`) with nothing to tell them apart. The
 * unassigned violation carries its own ordered term and session in `meta`
 * (`generation.service.ts:1144-1151`), and the rail row carries the item's own
 * `termIndex`/`session`, but neither surface printed the term.
 *
 * ── WHAT THIS FILE DECIDES ───────────────────────────────────────────────────
 *
 * R1 RENDERED — five same-section/subject/teacher unassigned violations with
 *               different ordered terms and sessions render five DISTINCT row
 *               labels, each naming its term and session. Fails on base d707051e:
 *               `scopeLabel` did not exist, so all five rows were identical.
 * R2 VOCAB     — the ONE term vocabulary (`Term N`) is used, and a missing term
 *               identity says `All year` rather than inventing Term 1.
 *
 * Run: `npm run test:ux-a2-move-swap-c2`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/timetable' });
Object.assign(globalThis, {
	window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
	Element: dom.window.Element, Node: dom.window.Node, Text: dom.window.Text,
	Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, MouseEvent: dom.window.MouseEvent,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { createElement, act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { buildBlockerGroups, BlockerGroupCard } = await import('@/components/timetable/simple/SimpleTaskDrawerHelpers');
const { unassignedTermLabel } = await import('@/components/timetable/GeneratedUnassignedPanel');

const label = (value: string) => () => value;

/** Five unassigned sessions: same section/subject/teacher, different term+session. */
const TERM_SESSION_PAIRS: Array<[number | undefined, number]> = [
	[1, 1], [1, 2], [2, 1], [2, 2], [3, 1],
];
function violations() {
	return TERM_SESSION_PAIRS.map(([termIndex, session]) => ({
		code: 'UNASSIGNED_SECTION', severity: 'HARD', message: 'Section 71 subject 11 remained unassigned.',
		schoolId: 1, schoolYearId: 9, runId: 7,
		entities: { sectionId: 71, subjectId: 11, facultyId: 21 },
		meta: { session, termIndex },
	}));
}

test('R1 RENDERED: five same-entity rows with different terms/sessions render five distinguishable labels', async () => {
	const groups = buildBlockerGroups(violations() as never, label('GR8 - Makabansa'), label('TLE'), label('NAVARRO'), 'selected-term');
	assert.equal(groups.length, 1, 'one unassigned group');
	const group = groups[0];
	assert.equal(group.items.length, 5, 'all five sessions are listed');

	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	const root = createRoot(host);
	await act(async () => { root.render(createElement(BlockerGroupCard as never, { group, onNavigate: () => {} } as never)); });

	const rows = () => [...host.querySelectorAll('.rounded-lg.border-red-100')].map((el) => (el.textContent ?? '').trim());
	// The card shows three by default; expand to all five.
	const more = [...host.querySelectorAll('button')].find((button) => /Show \d+ more/.test(button.textContent ?? ''));
	assert.ok(more, 'the card offers to show the remaining rows');
	await act(async () => { more!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });

	const rendered = rows();
	assert.equal(rendered.length, 5, 'five rows are on screen');
	assert.equal(new Set(rendered).size, 5, 'the five same-entity rows are five DISTINCT labels');
	for (const row of rendered) {
		assert.match(row, /Term \d/, `the row states its term: ${row}`);
		assert.match(row, /Session \d/, `the row states its session: ${row}`);
	}

	await act(async () => { root.unmount(); });
	host.remove();
});

test('R2 VOCAB: the item\'s own term uses the one vocabulary, and a missing term says All year', () => {
	assert.equal(unassignedTermLabel(1), 'Term 1');
	assert.equal(unassignedTermLabel(3), 'Term 3');
	assert.equal(unassignedTermLabel(undefined), 'All year', 'a missing term identity never becomes Term 1');
	assert.equal(unassignedTermLabel(0), 'All year');
});
