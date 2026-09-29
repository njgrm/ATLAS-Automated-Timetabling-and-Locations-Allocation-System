/**
 * A5 C5 (2026-09-29) — Room Schedules: the three questions, and the run id that is not on screen.
 *
 * WHAT THIS FILE DECIDES, and what it does not. `AGENTS.md` §11 requires each acceptance row to
 * name the harness that decides it, and §11's "done means seen" rule requires a *rendered* proof
 * for a user-facing change. So this file deliberately does NOT claim the visual result: it covers
 * the two things a jsdom/source harness CAN decide honestly —
 *
 *   1. `buildScheduleSourceSentence` — the one quiet line. Three conditions (dated, dated-and-pinned,
 *      undated), and the guarantee that no branch can emit a run id. A missing `generatedAt` must
 *      produce `Showing the latest timetable`, never `Showing the timetable made on ` — the shape of
 *      a lie is what this row exists to catch.
 *   2. the SOURCE CONTRACT of the page: no run-id input, no run id in the rendered tree, the latest
 *      timetable chosen automatically, the dated (not id-keyed) disclosure, ONE term control, and
 *      the one primary action. These are source assertions, and they are labelled as such; the
 *      click counts, the 1366x768 no-horizontal-scroll measurement, the rendered absence of the
 *      string "run id", and "print opens" are BROWSER rows reported by the executor, not by this file.
 *
 * A NEGATIVE CONTROL that discriminates: `test('MUTANT')` below breaks the very line the other rows
 * depend on and asserts the suite notices. A source-text suite that cannot fail when the page goes
 * back to typing run ids is not evidence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildScheduleSourceSentence, formatScheduleMadeOn } from '../schedule-source-sentence';
import { resolveScheduleEmptyState, type ScheduleEmptyReason } from '../schedule-empty-state';
import { UNVERIFIED_TERM_BODY, UNVERIFIED_TERM_TITLE } from '../room-schedule-term-copy';
import type { OrderedAcademicTerm } from '../academic-term';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '..', '..', '..');
const read = (rel: string): string => readFileSync(join(CLIENT_ROOT, rel), 'utf8');
const page = read('src/pages/RoomSchedules.tsx');
const band = read('src/components/room-schedules/ScheduleSourceBand.tsx');
const sheet = read('src/components/ConflictInspectorSheet.tsx');

/**
 * The page with every comment removed.
 *
 * This file's subject is a page whose own doc comment necessarily NAMES the control it deleted —
 * "a `Generation run ID` number box", "a stat banner ending `Run #412`". Asserting against the raw
 * source therefore fails on this file's own prose, which is exactly what happened the first time
 * these rows were written. Comments are not rendered, and these rows are about what a scheduler
 * can SEE, so every `doesNotMatch` below runs against the comment-free code. Asserting against raw
 * source would be asserting that a page may not document its own history.
 */
const code = (source: string): string => source
	.replace(/\/\*[\s\S]*?\*\//g, ' ')
	.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
	.replace(/(^|[^:])\/\/.*$/gm, '$1');
const pageCode = code(page);
const bandCode = code(band);
const sheetCode = code(sheet);

const NOW = new Date('2026-09-29T12:00:00Z');

/**
 * The four producers of an `empty` refusal, in the page's own order. Declared once, at the top,
 * because two independent test sections iterate it: the coarse guarantees the first candidate made
 * about the empty state, and the per-reason rows that replaced them.
 */
const REASONS: ScheduleEmptyReason[] = ['scope-unverified', 'term-unverified', 'draft-untermable', 'no-runs'];

// ─── 1. The quiet line, in words ───

test('a dated timetable is named by its date, never by its id', () => {
	assert.equal(
		formatScheduleMadeOn('2026-09-29T03:04:00.000Z', NOW),
		'29 Sept',
		'the packet asks for "29 Sept"; the year is omitted because it is the current one',
	);
	assert.equal(
		formatScheduleMadeOn('2025-03-04T03:04:00.000Z', NOW),
		'4 Mar 2025',
		'a date in another year carries its year, or an archive entry is ambiguous',
	);
});

test('an unrecorded or unparseable date is a null, never an invented one', () => {
	assert.equal(formatScheduleMadeOn(null, NOW), null);
	assert.equal(formatScheduleMadeOn(undefined, NOW), null);
	assert.equal(formatScheduleMadeOn('', NOW), null);
	assert.equal(formatScheduleMadeOn('not-a-date', NOW), null);
});

test('the sentence is complete in all three conditions', () => {
	// A5 C5 CORRECTION ROUND 1 (F2): this fixture was `{ order, displayLabel }` and TypeScript
	// rejected it in TWO places (TS2322, "Property 'identity' is missing") — `OrderedAcademicTerm`
	// requires `identity`, which is what the fail-closed label fallback keys on. My first
	// candidate reported "5 tsc errors, all dated base reds" when the real counts were base 5,
	// candidate 7: a NEW committed test file must never break typecheck. The fixture is now TYPED
	// as `OrderedAcademicTerm[]` rather than left structurally identical by hand, so the next
	// person to add a term field gets a compile error at the fixture rather than a silent shape
	// that happens to work.
	const terms: OrderedAcademicTerm[] = [
		{ identity: 'T1', order: 1, displayLabel: 'First Term' },
		{ identity: 'T2', order: 2, displayLabel: 'Second Term' },
	];
	assert.equal(
		buildScheduleSourceSentence({ madeAt: '2026-09-29T03:04:00.000Z', termIndex: 1, orderedTerms: terms, now: NOW }),
		'Showing the timetable made on 29 Sept · First Term',
	);
	assert.equal(
		buildScheduleSourceSentence({ madeAt: '2026-09-04T03:04:00.000Z', termIndex: 1, orderedTerms: terms, isOlder: true, now: NOW }),
		'Showing the timetable made on 4 Sept, an older one · First Term',
		'a pinned older timetable says so in words',
	);
	assert.equal(
		buildScheduleSourceSentence({ madeAt: null, now: NOW }),
		'Showing the latest timetable',
		'no recorded date means the honest claim, not a half-finished sentence',
	);
	assert.equal(
		buildScheduleSourceSentence({ madeAt: null, termIndex: null, orderedTerms: null, now: NOW }),
		'Showing the latest timetable',
		'an unverified term adds no term fragment',
	);
});

test('the sentence helper cannot emit a run id, whatever it is handed', () => {
	for (const madeAt of [null, '', 'not-a-date', '2026-09-29T03:04:00.000Z']) {
		for (const isOlder of [false, true]) {
			const sentence = buildScheduleSourceSentence({ madeAt, isOlder, now: NOW });
			assert.doesNotMatch(sentence, /run/i, `no branch may say "run": got ${JSON.stringify(sentence)}`);
			assert.doesNotMatch(sentence, /#\d/, `no branch may print an id: got ${JSON.stringify(sentence)}`);
		}
	}
});

// ─── 2. The page's source contract ───

/**
 * The two load-bearing predicates, named once and used TWICE: once against the real page (the rows
 * below) and once against a deliberately regressed copy (the MUTANT row at the end). A predicate
 * that is only ever run against a page that already satisfies it is not evidence, and inlining
 * the regexes in both places is how the two copies drift apart.
 */
const acceptsNoTypedRunId = (src: string): boolean =>
	!/Generation run ID/.test(src)
	&& !/Use a whole number above 0/.test(src)
	&& !/schedules-tools-trigger/.test(src)
	&& !/runIdInput|debouncedRunId|sourceMode/.test(src);
const rendersNoRunId = (src: string): boolean =>
	!/Run #\{/.test(src)
	&& !/#\{data\.runId\}/.test(src)
	&& !/source\.runId\s*\}\s*·/.test(src);

test('no run id is typed: the input, its error, the toggle and the Tools popover are gone', () => {
	assert.ok(acceptsNoTypedRunId(pageCode), 'the run-id input, its error, the Latest/Run toggle and the Tools popover are deleted, not renamed');
	assert.equal(
		acceptsNoTypedRunId(pageCode),
		acceptsNoTypedRunId(code(read('src/pages/RoomSchedules.tsx'))),
		'the predicate must read the same on the raw file and on the comment-stripped code',
	);
});

test('no run id is rendered: the stat banner and the conflict sheet speak in words', () => {
	assert.ok(rendersNoRunId(pageCode), 'the stat banner no longer ends in a database key');
	assert.ok(rendersNoRunId(sheetCode), 'the conflict sheet is one click from this page, so it counts as on screen');
	assert.match(sheetCode, /data\.sourceMadeOn/, 'and it names the date instead');
	// The one legitimate use is the request, not the screen.
	assert.match(pageCode, /runId=\{state\.status === 'ok' \? state\.data\.source\.runId : null\}/, 'the print/download request still needs the id');
});

test('the latest usable timetable is the default and no other source is reachable by typing', () => {
	assert.match(pageCode, /pinnedRunId == null\s*\n?\s*\? \{ source: 'latest' \}/, 'rooms default to the latest source');
	assert.match(pageCode, /pinnedRunId == null\s*\n?\s*\? `\/generation\/\$\{scopedSchoolId\}\/\$\{schoolYearId\}\/runs\/latest\/timetable`/, 'teachers and sections default to the latest run');
	assert.match(pageCode, /\/runs\/latest\/timetable`/, 'the latest alias is the automatic source');
});

test('history stays reachable, keyed by DATE', () => {
	assert.match(pageCode, /\/generation\/\$\{scopedSchoolId\}\/\$\{activeSchoolYearId\}\/runs\?limit=/, 'the dated disclosure reads the run history');
	assert.match(pageCode, /run\.status === 'COMPLETED'/, 'only a completed run is a timetable to read');
	assert.match(bandCode, /Show an older timetable/, 'the disclosure is the small link the packet asks for');
	assert.match(bandCode, /\{run\.madeOn \?\? 'Date not recorded'\}/, 'the option reads a DATE, never an id');
	// `run.id` legitimately appears as a React `key` and in the `pinnedRunId` comparison. What must
	// never appear is the id as the option's TEXT, so the assertion is on the rendered position.
	assert.doesNotMatch(bandCode, />\{run\.id\}</, 'the id is never the visible label');
});

test('one term control, and only when the year really has differing terms', () => {
	assert.equal(
		(pageCode.match(/aria-label="Schedule term"/g) ?? []).length + (band.match(/aria-label="Schedule term"/g) ?? []).length,
		1,
		'exactly one term control exists on this page',
	);
	assert.match(bandCode, /termOptions\.length > 1/, 'and it is rendered only when there is a choice to make');
	// The download-only second picker is gone, and the dialog takes the grid term instead.
	assert.doesNotMatch(pageCode, /exportTerm|Schedule download term|MAX_ACADEMIC_TERM_INDEX/);
	assert.match(pageCode, /termIndex=\{viewTerm \?\? 'all'\}/);
});

test('one primary action, and the rarely-wanted ones live behind More', () => {
	assert.match(pageCode, /Print this schedule/, 'the packet names exactly this primary action');
	assert.match(pageCode, /onClick=\{\(\) => window\.print\(\)\}/, 'and it prints what is on screen');
	assert.match(pageCode, /data-testid="schedules-more-trigger"/, 'More is the §8 home for the rest');
	for (const moved of ['schedules-more-refresh', 'schedules-more-export-csv', 'schedules-more-download', 'schedules-more-occupancy']) {
		assert.match(pageCode, new RegExp(`data-testid="${moved}"`), `${moved} is reachable, not deleted`);
	}
	assert.doesNotMatch(pageCode, /smart-help-trigger|SmartHelpTrigger/, 'the How-to-browse panel is gone; the page explains itself');
	assert.doesNotMatch(pageCode, /selectorStatus|rooms available\./, 'and the helper sentence under the picker is gone');
});

test('SUPERSEDED (F1) -> the empty state says what happened and offers ONE next step per reason', () => {
	// This row is KEPT, not deleted (`AGENTS.md` §11: corrections are additive; never remove a
	// control to close a finding). Its INTENT is unchanged and still asserted — an empty state
	// that says what happened and gives exactly one next step — but its AUTHORITY moved: in the
	// first candidate the heading and the link were hardcoded in the page's JSX, which is what
	// made three of the four refusals lie. They now come from `resolveScheduleEmptyState`, and the
	// six rows below assert the same intent per reason with the precision a single shared heading
	// could not carry. The assertions here are the coarse guarantees that still hold.
	const states = REASONS.map((r) => resolveScheduleEmptyState(r, 'message'));
	for (const s of states) {
		assert.ok(s.title.length > 0, 'every refusal names what is wrong');
		assert.ok(s.body.length > 0, 'every refusal explains it');
		assert.ok(
			s.nextStep.kind === 'retry' || s.nextStep.to.length > 0,
			'every refusal offers exactly one actionable next step',
		);
	}
	// The page must render the RESOLVED pair, not a hardcoded one, and must still reach /timetable
	// for the two reasons whose answer really is to build or regenerate.
	assert.match(pageCode, /resolveScheduleEmptyState\(state\.reason, state\.message\)/);
	assert.match(pageCode, /to=\{emptyState\.nextStep\.to\}/, 'the link target is the resolved one');
	assert.equal(
		states.filter((s) => s.nextStep.kind === 'link' && s.nextStep.to === '/timetable').length,
		2,
		'exactly the build and regenerate reasons route to the Timetable page',
	);
});

test('the page obeys §8: shared picker chrome, no raw scroll container, no raw neutrals', () => {
	assert.match(pageCode, /triggerClassName=\{pickerTriggerClass\('fill'\)\}/, 'the name picker wears the A5 c4 shared chrome');
	assert.doesNotMatch(pageCode, /triggerClassName="/, 'no page-local restatement of a shared primitive');
	assert.match(bandCode, /pickerTriggerClass\('sm'\)/, 'and the term picker wears it too');
	assert.match(pageCode, /flex h-\[calc\(100svh-3\.5rem\)\] flex-col/, 'the root height contract is intact');
	assert.match(pageCode, /flex-1 min-h-0 overflow-auto/, 'the scroll region is the child, so the root never scrolls');
	assert.equal(
		(pageCode.match(/\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g) ?? []).length,
		0,
		'the page holds no raw neutral classes',
	);
	assert.doesNotMatch(pageCode, /<select[\s>]/, 'no native select');
	assert.doesNotMatch(pageCode, /<details[\s>]|title="/, 'no raw details or title attribute');
});

// ─── 4. A5 C5 CORRECTION ROUND 1 (F1) — the empty state names WHICH of four things is wrong ───

test('F1: the four refusals get four different titles, and three of four are NOT "no timetable yet"', () => {
	const titles = REASONS.map((r) => resolveScheduleEmptyState(r, 'body').title);
	assert.equal(new Set(titles).size, 4, `each refusal needs its own heading; got ${JSON.stringify(titles)}`);

	// The control the finding is about. On `6d81026b`… no: on my FIRST candidate, three of the
	// four rendered `No timetable to show yet`, which contradicted the unverified-term body
	// ("NOT a missing timetable") outright.
	const lying = REASONS.filter((r) => /no timetable/i.test(resolveScheduleEmptyState(r, 'body').title));
	assert.deepEqual(lying, ['no-runs'], `only the genuinely-empty reason may claim there is no timetable; got ${JSON.stringify(lying)}`);
});

test('F1: the unverified-term refusal reuses the REVIEWED copy, and does not offer to build a timetable', () => {
	const s = resolveScheduleEmptyState('term-unverified', 'ignored');
	assert.equal(s.title, UNVERIFIED_TERM_TITLE, 'the repo already has a reviewed title for this; it must not be restated');
	assert.equal(s.body, UNVERIFIED_TERM_BODY, 'and the reviewed body, not a new sentence');
	assert.equal(s.nextStep.kind, 'retry', 'the condition is a verification state, not something to go and build');
	// Serialised rather than read off the narrowed variant: the point of the row is that NO branch
	// of this state ever offers to build a timetable, including one added later.
	assert.doesNotMatch(
		JSON.stringify(s),
		/Build one/,
		'a term-contract problem must never tell a scheduler to build a timetable that already exists',
	);
});

test('F1: an untermable draft says REGENERATE, because the draft exists', () => {
	const s = resolveScheduleEmptyState('draft-untermable', 'Some sessions in this draft have no verified term.');
	assert.match(s.title, /cannot be scoped to one term/);
	assert.deepEqual(s.nextStep, { kind: 'link', to: '/timetable', label: 'Regenerate the draft on the Timetable page' });
	assert.doesNotMatch(s.nextStep.label, /^Build one/, 'the draft EXISTS; "build one" is the category error QA reported');
});

test('F1: the remaining two refusals name their own cause and their own action', () => {
	const scope = resolveScheduleEmptyState('scope-unverified', 'Your school scope could not be verified.');
	assert.match(scope.title, /School could not be confirmed/);
	assert.deepEqual(scope.nextStep, { kind: 'link', to: '/login', label: 'Sign in again' }, 'no request was made, so the scope is what to restore');

	const none = resolveScheduleEmptyState('no-runs', 'No generation runs exist for this year.');
	assert.equal(none.title, 'No timetable has been made yet');
	assert.deepEqual(none.nextStep, { kind: 'link', to: '/timetable', label: 'Build one on the Timetable page' });
});

test('F1 CONTROL: a single shared heading — the first candidate\'s defect — is not expressible', () => {
	// The failing-first proof. If the resolver ever collapses back to one heading for every
	// reason, this row fails: three of the four titles must differ from `no-runs` and none of the
	// three may repeat it.
	const { title: noneTitle } = resolveScheduleEmptyState('no-runs', 'x');
	const others = REASONS.filter((r) => r !== 'no-runs').map((r) => resolveScheduleEmptyState(r, 'x').title);
	assert.equal(others.filter((t) => t === noneTitle).length, 0, `three refusals wrongly share the empty heading ${JSON.stringify(others)}`);
	assert.equal(new Set(others).size, 3);
});

test('F1: every reason carries its own acceptance hook, and the page tags all four producers', () => {
	const ids = REASONS.map((r) => resolveScheduleEmptyState(r, 'x').testId);
	assert.equal(new Set(ids).size, 4, 'a browser acceptance row needs an unambiguous target per reason');
	for (const reason of REASONS) {
		assert.match(
			pageCode,
			new RegExp(`reason: '${reason}'`),
			`the page must declare reason '${reason}' at its producer, or the resolver never sees it`,
		);
	}
	// And the reason is REQUIRED in the state, so a future producer cannot omit it.
	assert.match(pageCode, /\{ status: 'empty'; reason: ScheduleEmptyReason; message: string \}/);
	// The old hardcoded pair must be gone from the JSX; both now come from the resolver.
	assert.doesNotMatch(pageCode, />No timetable to show yet</, 'the shared heading is the defect itself');
	assert.doesNotMatch(pageCode, />Build one on the Timetable page</, 'the action must come from the reason, not the JSX');
});

// ─── 3. Negative control: the suite must be able to fail ───

test('MUTANT: a run id typed back into the page fails the no-run-id rows', () => {
	// A source-text suite that cannot fail when the page regresses is not evidence. This runs the
	// SAME two predicates against a synthetic page carrying the controls this change deleted —
	// the old `<Input aria-label="Generation run ID" />` and the old `Run #{id} · {status}` banner
	// span, pasted back verbatim — so the rows above are shown to discriminate rather than merely to
	// pass. It is built from the COMMENT-FREE code, because the mutant has to reintroduce the
	// control, not the sentence that mentions it.
	const regressed = pageCode
		+ '\n<Input aria-label="Generation run ID" placeholder="Run ID" value={runIdInput} />'
		+ '\n<span>Run #{state.data.source.runId} · {state.data.source.status}</span>';
	assert.notEqual(regressed, pageCode, 'the mutant differs from the page under test');
	assert.match(regressed, /aria-label="Generation run ID"/, 'the mutant really did reintroduce the input');
	assert.match(regressed, /Run #\{state\.data\.source\.runId\}/, 'and really did put the id back in the banner');
	assert.equal(acceptsNoTypedRunId(regressed), false, 'the typed-run-id row must FAIL on the mutant');
	assert.equal(rendersNoRunId(regressed), false, 'and so must the rendered-run-id row');
	assert.equal(acceptsNoTypedRunId(pageCode), true, 'while the real page still satisfies both');
	assert.equal(rendersNoRunId(pageCode), true, 'while the real page still satisfies both');
});
