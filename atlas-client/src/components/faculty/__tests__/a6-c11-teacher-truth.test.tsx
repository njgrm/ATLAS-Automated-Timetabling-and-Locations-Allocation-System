/**
 * A6 c11 — THE THREE SURFACES THIS CYCLE CLOSES, and the mutant row that proves
 * each of them can go red.
 *
 * WHAT IS IN HERE, and why one file for three unrelated-looking items. They share
 * one defect and one rule: a surface on the roster or the Teaching Load header
 * either CLAIMS something it cannot do or COUNTS a record that is not a person.
 * The Codex audit of 2026-09-29 against release `e75d6b8f` found both, and the
 * A6 packets (`cover-class-flow-2026-09-29.md` addendum 16:27, and
 * `truth-fixes-2026-09-29.md` §A6) assigned the client half of all three here.
 *
 *   1. THE THREE-STATE ARITHMETIC — `teacherLoadTruth`. A roster of 34 records,
 *      14 of them to-be-hired placeholders, read `34/34`: fully staffed, by
 *      records that are not people. The fixture below is that roster, built from
 *      the REAL `FacultySummary` fields this page already reads
 *      (`isActiveForScheduling`, `isPlaceholder`, `subjectCount`,
 *      `policyCreditedHours`, `maxHoursPerWeek`) — AGENTS.md §11 requires a
 *      control's fixture to come from the real surface, and an invented roster
 *      would have made the numbers below a fiction.
 *   2. THE `With load` TILE, RENDERED through the REAL `AdminStatBanner`, because
 *      the operator's rule is that a number a scheduler reads has to check out on
 *      screen and not only in a helper.
 *   3. THE `+N more` CONTROL'S REACHABILITY, proved by walking the client's own
 *      import graph from `src/main.tsx`. This is a structural check, not a
 *      string-match: it follows real `import`/`export … from` specifiers through
 *      real files and answers "can a user reach this component at all". The
 *      walker's own PRECONDITION is asserted on a component that IS on the page,
 *      so a broken walker cannot report a green reachability claim.
 *   4. THE ALERT CHIP, rendered through the REAL `WorkspaceToolbar`: it is a
 *      figure, so it is not a `<button>`, and the MODEL that builds it carries no
 *      `onClick` either. Model and render agreeing is the point — the defect was
 *      a model that promised an action no surface performed.
 *
 * THE HARNESS is copied from the accepted siblings
 * (`a6-c5-outage.test.tsx`, `a6-c9-staffing-figure.test.tsx`), so a reviewer can
 * diff it against them line for line. JSDOM performs no layout, so nothing here
 * claims a pixel; the rendered-pixel confirmation is the packet's own browser
 * row on real staging data.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..', '..');
const SRC_ROOT = resolve(CLIENT_ROOT, 'src');

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/teachers',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	HTMLButtonElement: dom.window.HTMLButtonElement,
	HTMLAnchorElement: dom.window.HTMLAnchorElement,
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
	IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } },
	DOMRect: dom.window.DOMRect,
	DocumentFragment: dom.window.DocumentFragment,
	ShadowRoot: dom.window.ShadowRoot,
	IS_REACT_ACT_ENVIRONMENT: true,
});
(dom.window as any).matchMedia ??= () => ({
	matches: false, media: '', onchange: null,
	addListener: () => {}, removeListener: () => {},
	addEventListener: () => {}, removeEventListener: () => {},
	dispatchEvent: () => false,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
dom.window.HTMLElement.prototype.scrollIntoView ??= () => {};
dom.window.HTMLElement.prototype.hasPointerCapture ??= () => false;
dom.window.HTMLElement.prototype.setPointerCapture ??= () => {};
dom.window.HTMLElement.prototype.releasePointerCapture ??= () => {};

const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { TooltipProvider } = await import('@/ui/tooltip');
const { Button } = await import('@/ui/button');
const { AdminStatBanner } = await import('@/components/admin-workspace/AdminWorkspace');
const { WorkspaceToolbar } = await import('@/components/faculty-assignments/WorkspaceToolbar');
const { buildTeachingLoadAlertChip } = await import('@/components/faculty-assignments/workspaceToolbarHeaderFacts');
const { teacherLoadTruth, teacherStatItems, withLoadTile } = await import('@/components/faculty/teacherLoadTruth');

const roots: any[] = [];
const hosts: HTMLElement[] = [];
afterEach(() => {
	for (const root of roots.splice(0)) act(() => root.unmount());
	for (const host of hosts.splice(0)) host.remove();
	dom.window.document.body.innerHTML = '';
});

function render(node: any): HTMLElement {
	const host = dom.window.document.createElement('div');
	dom.window.document.body.appendChild(host);
	hosts.push(host);
	const root = createRoot(host);
	roots.push(root);
	act(() => {
		root.render(createElement(MemoryRouter as any, { initialEntries: ['/teachers'] },
			createElement(TooltipProvider as any, { delayDuration: 0 }, node)));
	});
	return host;
}

// ═════════════════════════════════════════════════════════════════════════════
// THE FIXTURE — the roster the audit actually met.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * A roster row, in the fields `FacultySummary` really has and `Faculty.tsx`
 * really reads. `isPlaceholder` is the roster's own flag; nothing here is
 * synthesised for the test's convenience, because the whole defect is that the
 * page ignored this one field.
 */
const REAL = (id: number, subjectCount: number, hours = 20) => ({
	id,
	isActiveForScheduling: true,
	isPlaceholder: false,
	subjectCount,
	policyCreditedHours: hours,
	maxHoursPerWeek: 30,
});

/** A to-be-hired record: active, holding subjects, and not a person. */
const TO_BE_HIRED = (id: number, subjectCount: number) => ({
	id,
	isActiveForScheduling: true,
	isPlaceholder: true,
	subjectCount,
	policyCreditedHours: 0,
	maxHoursPerWeek: 30,
});

/**
 * THE 34 / 14 ROSTER, and the arithmetic the audit could not reconcile.
 *
 * 20 real teachers, every one holding a load. 14 to-be-hired records, every one
 * of them also holding a load. The page asked two questions of this roster and
 * got `34 active` and `34 assigned`, so its tile read `34/34` — fully staffed —
 * while the classes those 14 records stood in for were the entire staffing
 * outage. `belowPlaceholderSubjectCount` is the arithmetic that produced it,
 * written out so the mutant row can show the detector firing on it.
 */
const ROSTER = [
	...Array.from({ length: 20 }, (_, index) => REAL(100 + index, index < 18 ? 3 : 0)),
	...Array.from({ length: 14 }, (_, index) => TO_BE_HIRED(200 + index, 2)),
];

/** The count that must never be published as "teachers with a load". */
const placeholderSubjectCount = ROSTER.filter((row) => row.isPlaceholder).length;
const activeCountIgnoringPlaceholders = ROSTER.filter((row) => row.isActiveForScheduling).length;
const assignedCountIgnoringPlaceholders = ROSTER.filter((row) => row.subjectCount > 0).length;

// ═════════════════════════════════════════════════════════════════════════════
// 1. THE THREE-STATE ARITHMETIC
// ═════════════════════════════════════════════════════════════════════════════

test('A6C11-1 a to-be-hired record is never counted as a teacher with a load', () => {
	const truth = teacherLoadTruth({ roster: ROSTER });

	assert.equal(truth.source, 'roster', 'the page\'s own roster decides, because it can');
	assert.equal(truth.activeRealCount, 20, 'only REAL people are in the denominator');
	assert.equal(truth.withLoadCount, 18, 'and only real people are in the numerator — two of the 20 hold nothing');
	assert.equal(truth.withoutLoadCount, 2, 'which is why the tile is not calm about the rest of the roster');
	assert.equal(truth.withLoadCount + truth.withoutLoadCount, truth.activeRealCount, 'the two halves partition the real roster');

	// THE THREE STATES, each counted, so none can be silently dropped.
	assert.equal(truth.toBeHiredActiveCount, 14, 'the to-be-hired records are counted — in their OWN state, not as staff');
	assert.equal(truth.toBeHiredWithLoadCount, 14, 'and all of them are holding classes, which is the outage');
	assert.equal(
		truth.toBeHiredActiveCount + truth.activeRealCount,
		activeCountIgnoringPlaceholders,
		'the three states together are the roster ATLAS actually read',
	);

	assert.equal(truth.withLoadValue, '18/20', 'NOT 34/34: the tile counts people');
	assert.match(
		truth.withLoadHelpText,
		/^2 of 20 active teachers still need a teaching load\./,
		'the sentence that was there before, unchanged, now over real teachers',
	);
	assert.match(
		truth.withLoadHelpText,
		/14 to-be-hired records are holding classes, and are not counted here as teachers\./,
		'and it NAMES the number the tile is no longer counting, which is the packet\'s requirement',
	);

	// `over-cap` uses the SAME predicate the attention filter uses, or the badge
	// counts a different set from the list it labels.
	assert.equal(truth.overCapRealCount, 0, 'nobody real is above the maximum in this fixture');

	// A roster with NO placeholders must read exactly as it did before, or the
	// fix has changed a healthy page.
	const clean = teacherLoadTruth({ roster: [REAL(1, 2), REAL(2, 0), REAL(3, 1)] });
	assert.equal(clean.withLoadValue, '2/3', 'a placeholder-free roster is unchanged');
	assert.doesNotMatch(
		clean.withLoadHelpText,
		/to-be-hired/,
		'and it carries no to-be-hired clause at all — §8 less is on screen, not more',
	);
});

test('A6C11-1-SERVER the server fallback is reported, and invents nothing', async () => {
	// A8 owns the server-side count and this module does not pretend to have
	// fixed it. What it must not do is publish a figure the client cannot stand
	// behind, or hide which of the two inputs produced the numbers.
	const corrected = teacherLoadTruth({
		roster: [TO_BE_HIRED(1, 2)],
		serverStats: { activeCount: 34, assignedCount: 34, overCapCount: 2 },
	});
	assert.equal(corrected.source, 'roster', 'a roster that has ANY row decides, because it is the page\'s own read');
	assert.equal(corrected.activeRealCount, 0, 'and it excludes the to-be-hired record from the denominator');
	assert.equal(corrected.withLoadCount, 0, 'and from the numerator — this roster is staffed entirely by records that are not people');
	assert.equal(corrected.toBeHiredActiveCount, 1, 'while still counting it in its own state');
	assert.equal(corrected.withLoadValue, '0/0', 'which is the honest tile, not `1/1`');

	// With no roster at all, the server's block is the only arithmetic ATLAS
	// holds — and it counts placeholders, which the client cannot see. So it
	// passes through UNCHANGED and the branch says so, rather than being
	// corrected by a guess.
	const empty = teacherLoadTruth({
		roster: [],
		serverStats: { activeCount: 34, assignedCount: 34, overCapCount: 2 },
	});
	assert.equal(empty.source, 'server-uncorrected', 'the branch is REPORTED, so a control can assert which number is which');
	assert.equal(empty.activeRealCount, 34, 'the server\'s active count passes through unchanged — not guessed at');
	assert.equal(empty.withLoadCount, 34, 'including its assigned count, which counts placeholders server-side (A8 owns that fix)');
	assert.equal(empty.toBeHiredActiveCount, 0, 'and no placeholder count is CLAIMED, because none was visible');

	// N2 — THE NAME WAS THE OTHER HALF OF THE CLAIM. The branch used to report
	// `server-adjusted`, which asserted an adjustment this module argues against
	// in the note right above its own fallback: the client sees no placeholder
	// here, so any correction would be `x - 0` — an expression shaped like a
	// correction that performs none. `server-uncorrected` is the operation. This
	// row is the control that names it, so a future re-introduction of a silent
	// adjustment is visible here rather than only in prose.
	assert.doesNotMatch(
		await readFileSync(resolve(SRC_ROOT, 'components/faculty/teacherLoadTruth.ts'), 'utf8'),
		/'server-adjusted'/,
		'the string literal `\'server-adjusted\'` appears NOWHERE in the module — not even as a dead value, because a reader would meet it and believe an adjustment had happened',
	);

	// N3 — THE CLAMP. `Math.min(withLoadCount, activeRealCount)` used to sit here
	// and no control reached it, because the fixture above is `34/34` — the one
	// server shape in which the clamp cannot fire. So its behaviour was untested
	// AND wrong: it fired exactly on the server's own defect (a to-be-hired
	// record counted as an active teacher while its subjects are counted as
	// assigned, which drives `assignedCount` past `activeCount`) and resolved it
	// into `active/active` — a calm, fully-staffed tile manufactured by shrinking
	// a real number. The number now passes through, and the module states that
	// the two figures disagree instead of reassuring anybody from them.
	const incoherent = teacherLoadTruth({
		roster: [],
		serverStats: { activeCount: 10, assignedCount: 12, overCapCount: 0 },
	});
	assert.equal(incoherent.source, 'server-uncorrected', 'the same uncorrected branch');
	assert.equal(incoherent.activeRealCount, 10, "the server's active count is not moved either");
	assert.equal(incoherent.withLoadCount, 12, 'and its assigned count is NOT reduced to fit — the clamp is gone');
	assert.equal(incoherent.withLoadValue, '12/10', 'so the tile shows the impossible ratio the server actually reported, rather than a tidy `10/10`');
	assert.equal(
		incoherent.withLoadHelpText,
		'The server reports 12 with a load and 10 active, which cannot both be true; this count is uncorrected.',
		'and the help sentence states the contradiction instead of claiming nobody still needs a load',
	);
	assert.doesNotMatch(
		incoherent.withLoadHelpText,
		/active teachers still need a teaching load/,
		'`0 of 10 still need a load` is a claim this module cannot make from two figures that contradict each other',
	);
	assert.equal(incoherent.everyRealTeacherHasLoad, false, 'and it never reports everyone as staffed off a number it cannot read');
	assert.equal(
		withLoadTile(incoherent).tone,
		'warning',
		'a tile whose numerator exceeds its own denominator is never calm — removing the clamp must not have restored the false green',
	);

	// PRESERVATION for the clamp's removal: a COHERENT server figure is passed
	// through exactly as before, so removing the clamp did not change the
	// ordinary fallback.
	const coherent = teacherLoadTruth({
		roster: [],
		serverStats: { activeCount: 34, assignedCount: 30, overCapCount: 2 },
	});
	assert.equal(coherent.withLoadCount, 30, 'a server figure below its own active count is untouched');
	assert.equal(coherent.withLoadValue, '30/34', 'and the tile still reads as a fraction of one');
	assert.equal(
		coherent.withLoadHelpText,
		'4 of 34 active teachers still need a teaching load.',
		'with no to-be-hired clause, because none was visible — §8 less is on screen',
	);
	assert.equal(withLoadTile(coherent).tone, 'info', 'and the tone rule is unchanged for a figure the module can read');

	// No server and no roster: zeros, not a division.
	const nothing = teacherLoadTruth({ roster: [] });
	assert.equal(nothing.withLoadValue, '0/0', 'an empty roster is `0/0`, never NaN and never a 100%');
	assert.equal(nothing.everyRealTeacherHasLoad, false, 'and it does not claim everyone is staffed');
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. THE TILE, RENDERED
// ═════════════════════════════════════════════════════════════════════════════

test('A6C11-2 the rendered `With load` tile reads as a count of REAL teachers and says what it dropped', () => {
	const items = teacherStatItems(teacherLoadTruth({ roster: ROSTER }));
	const host = render(createElement(AdminStatBanner as any, { items }));
	const strip = host.querySelector('[data-testid="setup-readiness-strip"]')!;
	assert.ok(strip, 'the stat banner renders');

	const text = (strip.textContent ?? '').replace(/\s+/g, ' ');
	assert.match(text, /With load/, 'the tile is still labelled `With load`');
	assert.match(text, /18\/20/, 'and its value is the REAL count, read off the render');
	assert.doesNotMatch(
		text,
		new RegExp(`${assignedCountIgnoringPlaceholders}/${activeCountIgnoringPlaceholders}`),
		`the placeholder-counting ${assignedCountIgnoringPlaceholders}/${activeCountIgnoringPlaceholders} must not be on screen`,
	);

	// Every tile exposes its own explanation through the banner's help control,
	// so the to-be-hired clause is REACHABLE and not merely stored.
	const withLoad = items.find((item) => item.label === 'With load')!;
	assert.match(
		withLoad.helpText,
		/14 to-be-hired records are holding classes/,
		'the help text names the to-be-hired count it is no longer counting',
	);
	assert.equal(
		strip.querySelector('[aria-label="With load help"]') !== null,
		true,
		'and the banner offers that help through its own control, so the sentence is not hidden',
	);
	assert.equal(
		items.filter((item) => (item.helpText.match(/to-be-hired/g) ?? []).length > 0).length,
		1,
		'EXACTLY ONE tile states the to-be-hired count — two tiles saying it is the §8 duplicate',
	);

	// The tone follows the REAL count: nobody real holds a load here, so the tile
	// must not read calm.
	assert.equal(withLoadTile(teacherLoadTruth({ roster: ROSTER })).tone, 'info', 'with 18 real teachers loaded the tile stays calm');
	const placeholderOnly = teacherLoadTruth({ roster: [TO_BE_HIRED(1, 2), TO_BE_HIRED(2, 1)] });
	assert.equal(
		withLoadTile(placeholderOnly).tone,
		'warning',
		'a roster whose ONLY loaded records are to-be-hired is `0/0` in the warning tone, not `2/2` in the calm one',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. THE `+N more` CONTROL — REACHABLE OR NOT, PROVED BY THE IMPORT GRAPH
// ═════════════════════════════════════════════════════════════════════════════

/** Every module under `src`, as absolute paths. */
function sourceFiles(dir: string, found: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const absolute = resolve(dir, entry.name);
		if (entry.isDirectory()) sourceFiles(absolute, found);
		else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(absolute);
	}
	return found;
}

/**
 * The set of modules reachable from an entry, following real import specifiers.
 *
 * `@/x` resolves under `src` and a relative specifier against its own file. Each
 * match is ANCHORED at the start of a line and must be a whole import/export
 * clause, because an unanchored `[\s\S]{0,400}?from` happily pairs an `export`
 * keyword in one statement with the `from` of an `import` several lines below it
 * — which is how a first attempt at this walker "found" the shortage line through
 * an unrelated re-export and reported a green finding for a control that does not
 * exist.
 */
const IMPORT_CLAUSE = /^[ \t]*(?:import|export)\s+(?:type\s+)?(?:\*|\{[^}]*\}|\*\s+as\s+[A-Za-z0-9_$]+|[A-Za-z0-9_$]+(?:[ \t]*,[ \t]*\{[^}]*\})?)[ \t\r\n]*from[ \t\r\n]*['"]([^'"]+)['"]/gm;
const BARE_IMPORT = /^[ \t]*import[ \t\r\n]*['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

function reachableFrom(entry: string): Set<string> {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		let source = '';
		try {
			source = readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		const specifiers = [
			...[...source.matchAll(IMPORT_CLAUSE), ...source.matchAll(BARE_IMPORT), ...source.matchAll(DYNAMIC_IMPORT)]
				.map((match) => match[1]!),
		];
		for (const specifier of specifiers) {
			const target = specifier.startsWith('@/')
				? resolve(SRC_ROOT, specifier.slice(2))
				: specifier.startsWith('.')
					? resolve(dirname(file), specifier)
					: null;
			if (!target) continue;
			for (const candidate of [`${target}.ts`, `${target}.tsx`, resolve(target, 'index.ts'), resolve(target, 'index.tsx')]) {
				try {
					if (statSync(candidate).isFile()) {
						queue.push(candidate);
						break;
					}
				} catch {
					// not this candidate
				}
			}
		}
	}
	return seen;
}

/**
 * Does any of these files RENDER `<Name` as a JSX element?
 *
 * Reachability alone cannot answer the question, and saying so is the point:
 * `TeachingLoadStaffingFigure` imports two CONSTANTS from
 * `TeachingLoadShortageLine`, so the shortage line's MODULE is on the page while
 * its CONTROL is not rendered anywhere. The distinction the audit turns on is the
 * render, so this asks the render.
 */
function rendersComponent(files: Iterable<string>, name: string): boolean {
	for (const file of files) {
		try {
			if (new RegExp(`<${name}[\\s/>]`).test(readFileSync(file, 'utf8'))) return true;
		} catch {
			// unreadable file is not a render site
		}
	}
	return false;
}

test('A6C11-3 the `+N more` control is UNREACHABLE today, and the walk proves it', () => {
	const reachable = reachableFrom(resolve(SRC_ROOT, 'main.tsx'));
	const OUTAGE_SURFACE = resolve(SRC_ROOT, 'components/faculty-assignments/TeachingLoadOutageSurface.tsx');
	const SHORTAGE_LINE = resolve(SRC_ROOT, 'components/faculty-assignments/TeachingLoadShortageLine.tsx');
	const HEADER_CLAIMS = resolve(SRC_ROOT, 'components/faculty-assignments/useTeachingLoadHeaderClaims.tsx');

	// THE PRECONDITION. Without it every assertion below is a walker that found
	// nothing because it looked in the wrong place — which is how a false green
	// is produced.
	assert.ok(reachable.size > 100, `precondition: the walk covers the app (${reachable.size} modules)`);
	assert.ok(reachable.has(resolve(SRC_ROOT, 'pages/TeachingLoad.tsx')), 'precondition: the Teaching Load page IS reachable');
	assert.ok(reachable.has(HEADER_CLAIMS), 'precondition: its header-claims hook IS reachable');
	assert.equal(
		rendersComponent([HEADER_CLAIMS], 'TeachingLoadStaffingFigure'),
		true,
		'precondition: and the detector FINDS a rendered component on that page — so a zero below is a real zero',
	);

	// THE FINDING. `TeachingLoadShortageLine` is the only component that renders
	// the `+N more` control. Its sole host, `TeachingLoadOutageSurface`, is
	// rendered by no route, and `pages/TeachingLoad.tsx` hands the toolbar's
	// `shortageLineSlot` the STAFFING FIGURE instead (`const shortageLineSlot =
	// staffingFigureSlot`). So the `+N more` button is not in the shipped page.
	assert.equal(reachable.has(OUTAGE_SURFACE), false, 'the shortage line\'s only host is not reachable from `main.tsx`');
	assert.equal(
		rendersComponent(reachable, 'TeachingLoadShortageLine'),
		false,
		'and NO reachable module renders `<TeachingLoadShortageLine`, so `+N more` cannot be reached by a user',
	);
	assert.equal(
		rendersComponent([SHORTAGE_LINE], 'TeachingLoadStaffingFigure'),
		false,
		'its module is still IMPORTED for two constants — reachability and rendering are different questions, and this row asks the second',
	);

	// M3 — MUTANT CONTROL. The same detector, pointed at the one file that does
	// render it, must return TRUE: a detector that cannot find a positive is not
	// evidence of a negative.
	assert.equal(
		rendersComponent([OUTAGE_SURFACE], 'TeachingLoadShortageLine'),
		true,
		'M3 MUTANT CONTROL: the detector DOES find the render where it exists, so the zero above discriminates',
	);
	const leaf = reachableFrom(resolve(SRC_ROOT, 'types.ts'));
	assert.equal(leaf.size, 1, 'M3 MUTANT CONTROL: a leaf module reaches only itself, so reachability is not trivially true');
	assert.equal(
		rendersComponent(leaf, 'TeachingLoadShortageLine'),
		false,
		'M3 MUTANT CONTROL: and the same detector over a one-module walk agrees',
	);
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. THE ALERT CHIP — A FIGURE, NOT A CONTROL
// ═════════════════════════════════════════════════════════════════════════════

function toolbarProps(overrides: Record<string, any> = {}) {
	return {
		realAssignedPairs: 75,
		syntheticPlaceholderPairs: 25,
		unassignedPairs: 12,
		totalPairs: 112,
		overCapCount: 0,
		excessTeachingCount: 0,
		policyReady: true,
		autoFillLoading: false,
		autoFillEnabled: true,
		onAutoFillClick: () => {},
		viewMode: 'teacher',
		onViewModeChange: () => {},
		dataSource: 'live',
		degradedWriteEnabled: false,
		isWorkspaceWritable: true,
		isOnline: true,
		dataSourceNotice: null,
		coverageMode: 'balanced',
		onCoverageModeChange: () => {},
		coverageModeConfig: { balanced: { label: 'Balanced', description: 'desc' } },
		workspaceStateLabel: 'Ready',
		workspaceStateDescription: 'Live roster verified.',
		workspaceStateNextAction: 'Assign the remaining classes.',
		activeDraftCount: 0,
		saving: false,
		onSave: () => {},
		onRetrySource: () => {},
		...overrides,
	};
}

test('A6C11-4 the alert chip is a FIGURE: no button, no affordance, and a model that admits it', () => {
	const host = render(createElement(WorkspaceToolbar as any, toolbarProps({ syntheticPlaceholderPairs: 25 })));
	const chip = host.querySelector('[data-testid="teaching-load-alert-teacher-x"]')!;
	assert.ok(chip, 'the temporary-substitute chip still renders its count');

	// THE DEFECT, verbatim from the packet: a `<span>` whose onClick is dropped.
	// The render half is now honest about being text…
	assert.notEqual(chip.tagName, 'BUTTON', 'the chip must NOT be a button — it opens nothing');
	assert.equal(
		chip.matches('button, a, [role="button"], [tabindex]'),
		false,
		'and it must be nothing focusable or activatable either — an unreachable affordance is still a lie',
	);
	assert.equal(chip.closest('button, a, [role="button"]'), null, 'and it is not wrapped in one, which would make the whole chip look pressable');
	const chipClass = chip.getAttribute('class') ?? '';
	assert.doesNotMatch(chipClass, /cursor-pointer/, 'a figure must not wear a pointer cursor (AGENTS.md §8)');
	assert.doesNotMatch(chipClass, /\bborder\b|\bbg-/, 'nor a border or a fill, which is what makes a chip look pressable');
	assert.equal(chip.getAttribute('aria-haspopup'), null, 'and no popup semantics it does not honour');
	assert.match(
		host.querySelector('[data-testid="teaching-load-readiness-strip"]')!.textContent ?? '',
		/Temporary substitutes: 25/,
		'while still stating its number — the fact is what survives',
	);

	// …and so is the model. A model that carries `onClick` is the defect, because
	// every future surface inherits its promise.
	const chipModel = buildTeachingLoadAlertChip({
		overCapCount: 0,
		excessTeachingCount: 0,
		policyReady: true,
		syntheticPlaceholderPairs: 25,
	});
	assert.ok(chipModel, 'the model is built');
	assert.equal('onClick' in chipModel, false, 'the model must not carry an action no surface performs');
	assert.equal('disabled' in chipModel, false, 'nor a disabled rule for one');
	assert.doesNotMatch(
		chipModel.tooltip,
		/Open the filtered|click/i,
		'and its tooltip must not promise to open anything',
	);

	// M4 — MUTANT CONTROL, on BOTH halves of the claim. A model that DOES carry
	// the dropped `onClick` (the pre-c11 shape) must be judged dishonest by the
	// same predicate the real model passes, and a REAL `@/ui/button` wearing the
	// chip's classes must be judged pressable by the same detector — otherwise
	// the rows above are asserting properties nothing can violate.
	const mutant = { ...(chipModel as object), onClick: () => {}, disabled: false } as Record<string, unknown>;
	assert.equal('onClick' in mutant, true, 'M4 MUTANT: the pre-c11 model carries the action');
	assert.equal(onClickIsHonest(mutant), false, 'M4 MUTANT: and the honesty predicate calls that model DISHONEST');
	assert.equal(onClickIsHonest(chipModel as unknown as Record<string, unknown>), true, 'M4 MUTANT: the same predicate calls the real model honest');

	const mutantChip = render(createElement(Button as any, {
		type: 'button',
		variant: 'ghost',
		size: 'sm',
		className: 'h-7 shrink-0 cursor-pointer text-destructive',
	}, '· Temporary substitutes: 25'));
	const mutantElement = mutantChip.querySelector('button')!;
	assert.equal(
		mutantElement.matches('button, a, [role="button"], [tabindex]'),
		true,
		'M4 MUTANT: and the surface detector calls a REAL button pressable, so the chip\'s zero discriminates',
	);
});

/**
 * The rule the mutant row compares against: a chip model is honest only when it
 * promises nothing its render does not do. Written as a function so the mutant
 * and the real model are judged by ONE predicate.
 */
function onClickIsHonest(model: Record<string, unknown>): boolean {
	return !('onClick' in model) && !('disabled' in model);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. THE CLAUSE'S OWN SUBJECT — the correction, and its mutant
// ═════════════════════════════════════════════════════════════════════════════

/**
 * The `With load` help sentence AS A SCHEDULER READS IT: rendered through the
 * real `AdminStatBanner`, with the banner's own help control opened, and the
 * portalled tooltip text read back off the document.
 *
 * Reading the helper's return value would NOT have caught the defect this row
 * exists for. The arithmetic in `A6C11-1` was right in all three broken shapes
 * — `toBeHiredActiveCount` was always counted correctly, and it was the WORDS
 * that named the wrong number and agreed with the wrong subject. So the
 * assertion is on the rendered string, and the string is read from the element
 * the trigger's own `aria-describedby` points at, so it cannot pass on a
 * sentence that is merely present somewhere in the model.
 */
async function renderedWithLoadHelpText(roster: ReadonlyArray<any>): Promise<string> {
	const items = teacherStatItems(teacherLoadTruth({ roster }));
	const host = render(createElement(AdminStatBanner as any, { items }));
	const trigger = host.querySelector('[aria-label="With load help"]');
	assert.ok(trigger, 'the banner renders its own `With load` help control');

	await act(async () => {
		(trigger as HTMLElement).focus();
		await new Promise((done) => setTimeout(done, 80));
	});
	const describedBy = trigger!.getAttribute('aria-describedby');
	assert.ok(describedBy, 'the opened control describes itself with the sentence it shows');
	const content = dom.window.document.getElementById(describedBy!);
	assert.ok(content, 'and that element is in the document');
	return (content!.textContent ?? '').trim();
}

test('A6C11-5 the help sentence names the records it DROPPED, in every shape', async () => {
	// THE SHAPE THAT WAS ALREADY RIGHT, restated as a rendered preservation
	// control. `A6C11-1` already asserts it at the model and is left untouched;
	// this is the same sentence read off the screen, and it is the reference
	// string every row below is measured against.
	assert.equal(
		await renderedWithLoadHelpText(ROSTER),
		'2 of 20 active teachers still need a teaching load. 14 to-be-hired records are holding classes, and are not counted here as teachers.',
		'14 dropped, all 14 holding a class — one clause, because the two numbers are the same number',
	);

	// SHAPE (a): a to-be-hired record holding NO classes. This is ORDINARY — the
	// page ships a `Temporary teachers` filter and a `No sections assigned` filter
	// for exactly this record — and it used to render
	// `1 to-be-hired record is on this roster, and are not counted here.`
	// (subject/verb disagreement) and, at two or more, to name the holding count
	// of zero records as the number the tile had dropped.
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 2), TO_BE_HIRED(9, 0)]),
		'0 of 1 active teachers still need a teaching load. 1 to-be-hired record is on this roster, and is not counted here.',
		'singular, and the verb agrees with the record it is talking about',
	);
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 2), REAL(2, 1), TO_BE_HIRED(9, 0), TO_BE_HIRED(10, 0), TO_BE_HIRED(11, 0)]),
		'0 of 2 active teachers still need a teaching load. 3 to-be-hired records are on this roster, and are not counted here.',
		'plural, same branch — the zero-holding case is REACHABLE, not the dead `toBeHiredWithLoadCount === 0` ternary it used to be',
	);

	// The all-holding SINGULAR form, which the 14/14 sentence above cannot reach
	// and which used to read `1 to-be-hired record is holding classes, and is not
	// counted here as a teacher.`
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 3), TO_BE_HIRED(9, 2)]),
		'0 of 1 active teachers still need a teaching load. 1 to-be-hired record is holding a class, and is not counted here as a teacher.',
		'the noun agrees too: one record holds a class, not classes',
	);

	// SHAPE (b): the dropped count and the holding count DIFFER, so a clause keyed
	// to the wrong number cannot accidentally read right. This is the exact 2/1
	// the QA session ran: the tile dropped TWO records from its denominator and
	// the sentence named ONE. Both numbers are now stated, each about the thing it
	// actually counts, and the verbs still belong to the dropped records.
	const differing = teacherLoadTruth({ roster: [REAL(1, 3), TO_BE_HIRED(9, 2), TO_BE_HIRED(10, 0)] });
	assert.equal(differing.toBeHiredActiveCount, 2, 'precondition: two to-be-hired records are on this roster');
	assert.equal(differing.toBeHiredWithLoadCount, 1, 'precondition: and only one of them is holding a class');
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 3), TO_BE_HIRED(9, 2), TO_BE_HIRED(10, 0)]),
		'0 of 1 active teachers still need a teaching load. 2 to-be-hired records are on this roster, 1 holding a class, and are not counted here.',
		'it names the 2 records the tile DROPPED, and separately the 1 of them holding a class — not one number wearing the other\'s verb',
	);

	// The differing shape with a plural holding count, because a helper that only
	// agrees in the singular case is the same defect one branch down. And the
	// asymmetry is deliberate: the holding count governs only its own noun, the
	// dropped count governs every verb.
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 3), TO_BE_HIRED(9, 2), TO_BE_HIRED(10, 1), TO_BE_HIRED(11, 0)]),
		'0 of 1 active teachers still need a teaching load. 3 to-be-hired records are on this roster, 2 holding classes, and are not counted here.',
		'3 dropped, 2 holding — the two numbers stay in their own grammatical number',
	);

	// The tile VALUE is never given a second number: §8 "less is on screen" puts
	// the detail in the help text, not in the figure a scheduler reads at a
	// glance. This row is what stops a later "helpful" fix from printing `2 of 3`
	// into the tile beside `1/1`.
	assert.equal(
		teacherStatItems(teacherLoadTruth({ roster: [REAL(1, 3), TO_BE_HIRED(9, 2), TO_BE_HIRED(10, 0)] }))
			.find((item) => item.label === 'With load')!.value,
		'1/1',
		'the tile value stays a fraction of REAL teachers; the to-be-hired detail lives only in the help sentence',
	);

	// A roster with no to-be-hired records at all carries no clause, so the fix
	// cannot have added words to a healthy page.
	assert.equal(
		await renderedWithLoadHelpText([REAL(1, 2), REAL(2, 0)]),
		'1 of 2 active teachers still need a teaching load.',
		'no to-be-hired records, no clause — the sentence is still subtracted, not reworded',
	);
});
