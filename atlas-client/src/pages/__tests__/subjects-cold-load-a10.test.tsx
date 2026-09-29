/**
 * A8-C5 S3 / acceptance row A10 — `/subjects` paints the saved catalog
 * immediately, refreshes behind it, and shows a real receipt.
 *
 * THE OPERATOR'S WORDS (`a8-c5-generation-always-fixable-2026-09-29.md`, addendum
 * 20:10): a scheduler waiting 20.5 s for `/subjects` thinks it is broken.
 *
 * THREE things are proved, and the third is the one that stops this being a
 * string-matching exercise:
 *
 *   1. FIRST PAINT IS A DECISION, NOT A WAIT. `readSavedSubjectCatalog` is what
 *      `Subjects.tsx#fetchSubjects` calls BEFORE it issues the request, so the
 *      rows on the first paint come from the browser copy and the skeleton is
 *      reserved for the one honest case — there is nothing saved to show. A cache
 *      miss must return null, never a fabricated empty list, because an
 *      authoritative-looking table of zero subjects is worse than a skeleton.
 *   2. THE RECEIPT DESCRIBES THE CATALOG ON SCREEN. The count and the timestamp
 *      are read out of the SAME record that produced the rows, the receipt is
 *      scoped to the school it was read for, and a corrupt or version-mismatched
 *      record is a miss rather than a partial paint.
 *   3. IT IS RENDERED, IN THE EXISTING PATTERN. Row 3 renders the REAL shared
 *      `AdminWorkspaceFrame` — the frame `Subjects.tsx` renders, with the real
 *      `AdminSourceStateChip` and the real `sr-only` truth summary inside it — and
 *      asserts the receipt sentence is in the output. No new receipt component
 *      was invented: the sentences are composed by the existing
 *      `resolveSubjectSourceCopy` and land in the existing source-state Popover.
 *
 * A4-PRESERVATION: `resolveSubjectSourceCopy` is called WITHOUT a receipt by
 * three other subjects surfaces and by an accepted A3-C4 suite. Its sentences
 * without a receipt are asserted byte-for-byte here, so this additive receipt
 * cannot have changed accepted copy.
 *
 * Run: `npm run test:a8-c5-subjects-cold-load` (also in `test:client-suite`).
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/subjects' });
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
	localStorage: dom.window.localStorage,
	getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
	requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
	ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
	matchMedia: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	}),
});
// `navigator` is a getter-only global in this runtime, so it is defined rather
// than assigned — the same shape `a8-c3-generate-gaps-groups.test.tsx` uses.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(dom.window as unknown as { matchMedia: unknown }).matchMedia = globalThis.matchMedia;

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const {
	readSavedSubjectCatalog,
	savedCatalogReceipt,
	writeSavedSubjectCatalog,
	formatCatalogServedAt,
	SUBJECT_CATALOG_CACHE_VERSION,
} = await import('@/components/subjects/subject-catalog-receipt');
const { resolveSubjectSourceCopy } = await import('@/components/subjects/subject-source-utils');
const { AdminWorkspaceFrame } = await import('@/components/admin-workspace/AdminWorkspace');
const { TooltipProvider } = await import('@/ui/tooltip');

const SCHOOL = 1;
const OTHER_SCHOOL = 2;

function subject(id: number) {
	return { id, code: `S${id}`, name: `Subject ${id}` };
}

function clearStorage() {
	globalThis.localStorage.clear();
}

// ─────────────────────────────────────────────────────────────────────────────
// (1) FIRST PAINT: paint the saved catalog, never a fabricated empty one.
// ─────────────────────────────────────────────────────────────────────────────
test('A10-a the saved catalog is readable for the first paint, and a miss is a miss', () => {
	clearStorage();

	// A cold device: nothing saved. The page must keep its skeleton, so this is
	// null — NOT an empty list.
	assert.equal(readSavedSubjectCatalog(SCHOOL), null, 'a device with nothing saved has nothing to paint');

	// A successful read is recorded and is immediately readable back.
	const served = writeSavedSubjectCatalog(SCHOOL, [subject(1), subject(2), subject(3)], new Date('2026-09-29T06:32:00.000Z'));
	assert.equal(served.source, 'live');
	assert.equal(served.count, 3);
	assert.equal(served.refreshing, false, 'a finished read is not a refresh in progress');

	const saved = readSavedSubjectCatalog(SCHOOL);
	assert.ok(saved, 'the catalog the page just painted must be readable on the next cold load');
	assert.equal(saved!.subjects.length, 3);
	assert.ok(Date.parse(saved!.savedAt) > 0, 'the receipt time is a real timestamp');

	// SCOPE: one school's catalog is never painted for another. This is the
	// isolation property that makes a browser-local copy safe at all.
	assert.equal(readSavedSubjectCatalog(OTHER_SCHOOL), null, 'another school must never read this school cache');
	assert.equal(readSavedSubjectCatalog(null), null, 'no school is no cache');
	assert.equal(readSavedSubjectCatalog(0), null, 'a non-positive school id is no cache');

	// The refresh receipt for a catalog painted from the copy.
	const painted = savedCatalogReceipt(saved!.subjects.length, saved!.savedAt);
	assert.equal(painted.source, 'saved');
	assert.equal(painted.count, 3);
	assert.equal(painted.refreshing, true, 'a cold paint is followed by a refresh still running');
});

// ─────────────────────────────────────────────────────────────────────────────
// (2) THE RECEIPT IS A FACT: scoped, complete, and never a partial paint.
// ─────────────────────────────────────────────────────────────────────────────
test('A10-b a corrupt, foreign or version-mismatched record is a miss, not a partial catalog', () => {
	clearStorage();
	const key = `atlas.subject-catalog.v1:${SCHOOL}`;
	const rows = [subject(1), subject(2)];

	// The negative controls, each of which would paint a WRONG table if accepted.
	const rejected: { label: string; raw: string }[] = [
		{ label: 'corrupt JSON', raw: '{not json' },
		{ label: 'wrong cache version', raw: JSON.stringify({ version: SUBJECT_CATALOG_CACHE_VERSION + 1, savedAt: '2026-09-29T06:32:00.000Z', subjects: rows }) },
		{ label: 'no timestamp', raw: JSON.stringify({ version: SUBJECT_CATALOG_CACHE_VERSION, subjects: rows }) },
		{ label: 'unparseable timestamp', raw: JSON.stringify({ version: SUBJECT_CATALOG_CACHE_VERSION, savedAt: 'yesterday-ish', subjects: rows }) },
		{ label: 'not a list', raw: JSON.stringify({ version: SUBJECT_CATALOG_CACHE_VERSION, savedAt: '2026-09-29T06:32:00.000Z', subjects: { a: 1 } }) },
		// The dangerous one: a stored list that no longer looks like a catalog.
		// Half-trusting it would show a scheduler a filtered subset of an older
		// catalog as though it were the whole one.
		{ label: 'rows that are not subjects', raw: JSON.stringify({ version: SUBJECT_CATALOG_CACHE_VERSION, savedAt: '2026-09-29T06:32:00.000Z', subjects: [subject(1), 'not-a-subject'] }) },
	];
	for (const { label, raw } of rejected) {
		globalThis.localStorage.setItem(key, raw);
		assert.equal(readSavedSubjectCatalog(SCHOOL), null, `${label} must be treated as no saved catalog`);
	}

	// POSITIVE CONTROL: the same slot with a well-formed record IS read. Without
	// this, the six rejections above would also pass on a reader that never reads
	// anything, and the row would be vacuous.
	globalThis.localStorage.setItem(key, JSON.stringify({
		version: SUBJECT_CATALOG_CACHE_VERSION,
		savedAt: '2026-09-29T06:32:00.000Z',
		subjects: rows,
	}));
	assert.equal(readSavedSubjectCatalog(SCHOOL)?.subjects.length, 2, 'a well-formed record IS read, so the rejections discriminate');
});

// ─────────────────────────────────────────────────────────────────────────────
// (3) THE RECEIPT IS RENDERED, in the existing source-state pattern.
// ─────────────────────────────────────────────────────────────────────────────
function renderSubjectsFrame(sourceState: Parameters<typeof resolveSubjectSourceCopy>[0], receipt: Parameters<typeof resolveSubjectSourceCopy>[1]) {
	const copy = resolveSubjectSourceCopy(sourceState, receipt);
	return renderToStaticMarkup(
		createElement(
			TooltipProvider,
			null,
			createElement(
				AdminWorkspaceFrame,
				{
					title: 'Subjects',
					description: 'The setup surface for ATLAS-owned subject metadata.',
					sourceState,
					sourceCopy: copy,
					stats: [],
					primaryActions: null,
					secondaryActions: null,
					children: null,
				},
			),
		),
	);
}

test('A10-c the receipt is rendered by the real frame: what was served, and when', () => {
	const now = new Date('2026-09-29T09:00:00.000Z');
	// 18:32 Manila on the same UTC day as `now` is 10:32 local; the formatter is
	// exercised separately below with a fixed clock, so here only the stable
	// parts of the sentence are asserted.
	const receipt = savedCatalogReceipt(128, '2026-09-29T06:32:00.000Z', true);
	const markup = renderSubjectsFrame('saved-data', receipt);
	const summary = /admin-source-truth-summary[^>]*>([\s\S]*?)<\/p>/.exec(markup);
	assert.ok(summary, 'the shared frame states the source truth for assistive technology, and that is where the receipt lands');
	const text = (summary![1] ?? '').replace(/<!--[^>]*-->/g, '');

	assert.match(text, /Using saved data/, 'the accepted chip label is unchanged');
	assert.match(text, /128 subjects/, 'the receipt states HOW MANY rows are on screen');
	assert.match(text, /from the copy saved on this device/, 'and says plainly that this is the local copy, not a live read');
	assert.match(text, /\d\d:\d\d/, 'and states WHEN it was served');
	assert.doesNotMatch(text, /…|\.\.\./, 'the receipt is never truncated (AGENTS.md section 8)');
	assert.doesNotMatch(text, /\b[A-Z][A-Z0-9_]{5,}\b/, 'the receipt leaks no engine token');
	assert.doesNotMatch(text, /undefined|NaN|\[object/, 'a missing field must never print itself');

	// The next action must NOT tell an operator with rows on screen to wait. That
	// sentence is the copy form of the 20.5 s defect.
	assert.match(text, /keep working/i, 'an operator already looking at rows is not waiting');
	assert.doesNotMatch(text, /Wait for the catalog to load/i, 'so the page must not tell them to wait');

	// A LIVE read says so, in the same shape and the same place.
	const live = renderSubjectsFrame('saved-data', {
		source: 'live', count: 1, servedAt: '2026-09-29T06:32:00.000Z', refreshing: false,
	});
	assert.match(live, /1 subject from the server/, 'a single row reads as one subject, and a live read says "from the server"');
	assert.match(live, /Add a subject if the catalog is missing one/, 'and a finished read offers the settled next action, not a background-refresh one');

	// NO SAVED DATA is still honest: no receipt is invented for it.
	const none = renderSubjectsFrame('no-saved-data', null);
	assert.match(none, /could not load a usable subject catalog/i, 'with nothing cached the page says so rather than inventing a receipt');
	assert.doesNotMatch(none, /from the copy saved on this device/, 'and it never claims a copy it does not have');
});

// ─────────────────────────────────────────────────────────────────────────────
// (4) A4-PRESERVATION: the accepted copy is unchanged for every existing caller.
// ─────────────────────────────────────────────────────────────────────────────
test('A10-d without a receipt the accepted A3-C4 copy is byte-identical', () => {
	assert.deepEqual(resolveSubjectSourceCopy('saved-data'), {
		description: 'ATLAS is showing the saved subject catalog for this school.',
		nextAction: 'Add a subject if the catalog is missing one, or open coverage for subjects at risk.',
	});
	assert.deepEqual(resolveSubjectSourceCopy('checking-source'), {
		description: 'ATLAS is loading the subject catalog for this school.',
		nextAction: 'Wait for the catalog to load before making curriculum changes.',
	});
	assert.deepEqual(resolveSubjectSourceCopy('no-saved-data'), {
		description: 'ATLAS could not load a usable subject catalog.',
		nextAction: 'Check the school connection, then retry loading the catalog.',
	});
	assert.deepEqual(resolveSubjectSourceCopy('verified-live'), {
		description: 'ATLAS is showing the saved subject catalog for this school.',
		nextAction: 'Open coverage for subjects with risk, or add a subject if the catalog is missing one.',
	});
	// And the time formatter, with a fixed clock, because the receipt's usefulness
	// depends on it being a time a human can read rather than an ISO string.
	// The inputs are built from LOCAL components, so the assertion holds in any
	// timezone instead of only in the one this machine happens to run in.
	const clock = new Date(2026, 8, 29, 12, 0, 0);
	const sameDay = new Date(2026, 8, 29, 6, 32, 0).toISOString();
	const previousDay = new Date(2026, 8, 28, 6, 32, 0).toISOString();
	assert.equal(formatCatalogServedAt(sameDay, clock), '06:32 today');
	assert.equal(formatCatalogServedAt(previousDay, clock), '28 Sep, 06:32');
	assert.equal(formatCatalogServedAt('not-a-date', clock), 'an unknown time', 'an unparseable time says so instead of printing NaN');
});
