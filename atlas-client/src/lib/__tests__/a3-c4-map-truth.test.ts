/**
 * A3 c4 — the campus map and the Building view must never print a use figure
 * they were not given.
 *
 * THE THREE DEFECTS THIS EXISTS TO PROVE ABSENT (Lane C, live `d31bfacb`).
 *
 * **A (#53, HIGH).** `CampusMap.tsx:80` read `buildingOccupancy?.get(b.id) ?? 0`
 * and line 144 rendered `` text={`${Math.round(occupancy)}% FILLED`} ``. The prop
 * is OPTIONAL, and the only caller that supplies it is `SectionRoomMapModal`.
 * The other caller — `timetable/CenterWorkspace.tsx:608` — passes nothing at
 * all, so every wing rendered a confident, fabricated `0% FILLED` while GR7 -
 * Luna had a full Term 2 week in G7 Room 103. An absent measurement rendered as
 * a measured zero: the exact class of fabrication this module was written to
 * kill, in the one file `1e417694` never converted.
 *
 * **B (HIGH).** The Building view's compact `n/a` was honest but UNLABELLED,
 * and it contradicted the tile's `0%` for the same building. `n/a` is correct —
 * `ROOM_UTILIZATION_TEXT_BOX` is 36x14 stage units and frozen — so the words have
 * to go where there is room for them: the DOM chrome, which is not a canvas.
 *
 * **C (Top-10 #4).** Map cards answered "how big?" (`CAPACITY 45`) and not "is it
 * free?". The Building view's room card is the card that shows capacity with no
 * use at all, and c0's header comment claimed its "full-detail surface is its
 * hover layer" — which was FALSE: the hover layer showed Type and Capacity and
 * never mentioned use. The legend in B and the Use row in C are therefore the
 * same surface, and the header comment it contradicted is corrected here.
 *
 * PERCENT, NOT "Used 32 of 40 periods" — a recorded decision, not an oversight.
 * The only real denominator is `pivotDraftToView`'s `availableMinutes`, a
 * DURATION (`slotMinutesTotal * DAYS.length`, `schedule-pivot.ts:186`), and the
 * value threaded to every consumer is `summary.utilizationPercent` alone. A
 * period COUNT would have to be invented from a percentage, which is the same
 * fabrication A is about. So C renders the measured percentage, labelled, from
 * the same reading the tile uses.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL,
	ROOM_UTILIZATION_LEGEND_TEXT,
	ROOM_UTILIZATION_UNKNOWN_FILL,
	ROOM_UTILIZATION_UNKNOWN_LABEL,
	ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT,
	ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT,
	buildingOccupancyBarPercent,
	buildingOccupancyTileLabel,
	isBuildingOccupancyKnown,
	roomUtilizationLabel,
} from '../room-utilization-display';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');
const source = (relative: string) => readFileSync(resolve(CLIENT_ROOT, relative), 'utf8');
const repoSource = (relative: string) => readFileSync(resolve(CLIENT_ROOT, '..', relative), 'utf8');

/**
 * Source with comments removed.
 *
 * These controls scan the source for the shape of the DEFECT, and the fix
 * documents that defect in prose — verbatim, including the `?? 0` it removed. A
 * comment that quotes the bug would otherwise satisfy a `must not match` control
 * forever after the bug is gone, and the control would then go green for the
 * wrong reason. The exact failure mode §11 records about control fixtures.
 *
 * Only block comments and whole-line `//` comments are stripped: a naive
 * `//`-to-end-of-line pass would corrupt a `https://` literal, and neither
 * owned file carries one. The limitation is recorded rather than papered over.
 */
const code = (relative: string) =>
	source(relative)
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('//'))
		.join('\n');

/**
 * Comment-stripped source with the IMPORT BLOCK ALSO REMOVED.
 *
 * Stripping the imports is what makes a legend control mean what its name says.
 * QA's mutation for this file deleted the `BuildingView` legend JSX, left the
 * import untouched, and the named test — "both map surfaces carry a
 * plain-language legend" — still passed, because the two identifiers survive at
 * `BuildingView.tsx:9` and `:11` inside
 * `import { … } from '@/lib/room-utilization-display'`. A bare
 * `assert.match(text, /ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT/)` is therefore a
 * test of the IMPORT LIST, not of a legend, and it cannot fail when its subject
 * is removed. That is the control §11 calls out, and the only cure is to stop
 * scanning the import block at all.
 *
 * Imports are necessary but not sufficient: stripping them stops the false
 * positive, but a constant could still be named in a `const` far from any
 * element and the bare scan would call that a render. `RENDERED` below closes
 * that second door.
 */
const withoutImports = (text: string): string =>
	text
		// `import … from '<spec>'`, spanning the braces of a multi-line specifier
		// list, and the bare `import '<side-effect>'` form.
		.replace(/^[ \t]*import\s[\s\S]*?from\s*['"][^'"]*['"];?[ \t]*$/gm, '')
		.replace(/^[ \t]*import\s*['"][^'"]*['"];?[ \t]*$/gm, '');

/** Comment-stripped AND import-stripped source — what a RENDER claim may scan. */
const rendered = (relative: string) => withoutImports(code(relative));

/**
 * A JSX element open tag, then up to 600 characters, then a `{ … }` container.
 * The 600 is a bounded LOCAL window, not a parse: it only has to span the
 * element's own opening tag and the attribute or child it carries, which is why
 * it is immune to reformatting, to the identifier moving one line, and to
 * everything else in the file.
 */
const JSX_RENDER_PREFIX = String.raw`<[A-Za-z][\w.]*(?:[^<>{}]|\{[^{}]*\})*>[\s\S]{0,600}?\{\s*`;
/** …and the container's close, then a JSX element close tag. */
const JSX_RENDER_SUFFIX = String.raw`\s*\}[\s\S]{0,600}?</[A-Za-z][\w.]*>`;

/**
 * Matches only when `ident` is RENDERED: it sits in a `{ … }` expression
 * container INSIDE an element the component actually emits.
 *
 * Why the import block cannot satisfy this, twice over. The block is already
 * gone from `rendered()`, which is the load-bearing half. The second half is
 * structural: the pattern demands a JSX element open tag BEFORE the identifier
 * and a JSX element close tag AFTER it, and an import declaration is never
 * nested inside a JSX element — so however its braces are laid out, however the
 * specifier is wrapped, and whether it is named, defaulted, or re-exported, no
 * `import` can put an identifier between a `<tag …>` and a `</tag>`.
 */
const RENDERED = (ident: string) => new RegExp(`${JSX_RENDER_PREFIX}${ident}${JSX_RENDER_SUFFIX}`);

/**
 * The composed legend sentence exactly as both surfaces write it in JSX, so a
 * control can require the FULL wording inside a `@/ui` surface. The `&middot;`
 * separator and the brace spacing are matched loosely on purpose; only the two
 * constants and the surrounding `TooltipContent` are load-bearing.
 */
const FULL_SENTENCE_IN_TOOLTIP = new RegExp(
	String.raw`<TooltipContent>[\s\S]{0,400}?\{\s*ROOM_UTILIZATION_LEGEND_TEXT\s*\}[\s\S]{0,40}?&\s*middot\s*;[\s\S]{0,40}?\{\s*ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT\s*\}[\s\S]{0,200}?</TooltipContent>`,
);

/**
 * Where an identifier really is, so a red row is fixable. Separates the two
 * regressions a bare scan cannot tell apart: the name occurs nowhere outside its
 * import, or it occurs somewhere that is not a render.
 */
const renderDiagnosis = (file: string, ident: string, text: string): string => {
	const at = text.indexOf(ident);
	if (at < 0) {
		return `${file}: ${ident} occurs NOWHERE outside its import block — nothing renders it`;
	}
	return (
		`${file}: ${ident} occurs at offset ${at} but not in a JSX render position:\n…` +
		`${text.slice(Math.max(0, at - 140), at + 140)}…`
	);
};

const CAMPUS_MAP = 'src/components/CampusMap.tsx';
const BUILDING_VIEW = 'src/components/BuildingView.tsx';

/**
 * The real fixture for the fit control, taken from the real surface.
 *
 * `CampusMap` sizes the occupancy track `b.width - 12` and draws a 12-unit-tall
 * group, so the binding constraint is VERTICAL: a Konva `Text` with a `width`
 * WRAPS rather than overflows, and a second line at `fontSize 7` escapes the
 * 12-unit group and leaves the building. So the requirement is ONE line, and the
 * narrowest real building is the one that decides it. Inventing a narrower
 * building here would make the control prove something the campus does not have.
 */
const SEED_BUILDING_WIDTHS: ReadonlyArray<number> = [
	...repoSource('prisma/seed.js').matchAll(/\bx: \d+, y: \d+, width: (\d+), height: \d+, color: '#/g),
].map((m) => Number(m[1]));
const NARROWEST_REAL_BUILDING_WIDTH = Math.min(...SEED_BUILDING_WIDTHS);
const TILE_TRACK_WIDTH = NARROWEST_REAL_BUILDING_WIDTH - 12;
/** The tile group's height. A wrapped second line at fontSize 7 overflows it. */
const TILE_GROUP_HEIGHT = 12;
const TILE_FONT_SIZE = 7;

/* ───────────────────────── A: the tile's tri-state is a real contract ───────────────────────── */

test('A: an absent building reading is never a percentage, and a measured 0% still is', () => {
	// The exact state `CenterWorkspace.tsx:608` produces: no prop at all.
	assert.equal(
		buildingOccupancyTileLabel(undefined, 1),
		BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL,
		'no prop must render the unknown tile label',
	);
	assert.equal(buildingOccupancyTileLabel(null, 1), BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL);
	// A supplied map with no entry for this building — the other absent case.
	const partial = new Map([[1, 80]]);
	assert.equal(isBuildingOccupancyKnown(partial, 2), false);
	assert.equal(buildingOccupancyTileLabel(partial, 2), BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL);

	// THE DEFECT, as the assertion the pre-fix line 144 fails: `?? 0` printed
	// this for the absent case, which is why five busy wings all read 0%.
	assert.doesNotMatch(
		BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL,
		/%/,
		'the unknown tile must not wear a percentage sign — it would read as a measurement',
	);
	assert.doesNotMatch(
		BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL,
		/\b0\b/,
		'the unknown tile must not contain a zero — that is the fabricated figure',
	);

	// A genuinely measured zero is a real answer and must survive, or the fix
	// would have swallowed a true "nothing is scheduled here".
	for (const [pct, want] of [[0, '0% FILLED'], [55, '55% FILLED'], [100, '100% FILLED']] as const) {
		assert.equal(buildingOccupancyTileLabel(new Map([[1, pct]]), 1), want);
		assert.equal(isBuildingOccupancyKnown(new Map([[1, pct]]), 1), true);
	}
	// The two remain distinguishable at a glance, which is the whole point.
	assert.notEqual(
		buildingOccupancyTileLabel(new Map([[1, 0]]), 1),
		buildingOccupancyTileLabel(undefined, 1),
		'a measured 0% and an absent reading must not render the same string',
	);
	// A stored NaN renders as the string "NaN%" if it is not caught.
	assert.equal(buildingOccupancyTileLabel(new Map([[1, Number.NaN]]), 1), BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL);
});

test('A: the tile bar is geometry only, and the unknown bar is not the measured-zero green', () => {
	// An unmeasured bar has no extent. This is NOT a figure and must never be
	// rendered as one — the same contract `roomUtilizationBarPercent` carries.
	assert.equal(buildingOccupancyBarPercent(undefined, 1), 0);
	assert.equal(buildingOccupancyBarPercent(new Map([[1, 0]]), 1), 0, 'a measured zero has no extent, as before');
	assert.equal(buildingOccupancyBarPercent(new Map([[1, 62]]), 1), 62);

	// The neutral grey is deliberately not the ramp's green-at-zero, so an
	// unknown wing is not coloured like a genuinely empty one.
	const rampGreenAtZero = 'rgb(34,197,94)';
	assert.notEqual(ROOM_UTILIZATION_UNKNOWN_FILL, rampGreenAtZero);
	assert.doesNotMatch(ROOM_UTILIZATION_UNKNOWN_FILL, /rgb\(/, 'the unknown fill is a hex token, not a ramp output');
});

/* ───────────────────────── A: the CampusMap tile, on the real source ───────────────────────── */

test('A: CampusMap never defaults an absent building reading to zero', () => {
	const text = code(CAMPUS_MAP);
	// The literal fabrication. `buildingOccupancy?.get(b.id) ?? 0` is the exact
	// shape that turned a refusal into a confident `0% FILLED`. Scanned over
	// comment-stripped source: the fix quotes that line in its own explanation,
	// and a comment must not keep a `must not match` control satisfied.
	assert.doesNotMatch(
		text,
		/buildingOccupancy[^;\n]*?\?\?\s*0/,
		`${CAMPUS_MAP} still defaults an absent building reading to 0:\n${text.match(/buildingOccupancy[^;\n]*?\?\?\s*0/)?.[0]}`,
	);
	// The tile text must come from the shared contract, so a third screen cannot
	// invent its own wording the way this one did.
	assert.match(
		text,
		/buildingOccupancyTileLabel\(/,
		`${CAMPUS_MAP} must render the tile through buildingOccupancyTileLabel`,
	);
	assert.match(
		text,
		/isBuildingOccupancyKnown\(/,
		`${CAMPUS_MAP} must ask whether the reading exists before it colours anything`,
	);
	// The colour ramp is a MEASURED-FIGURE ramp; an unknown must never reach it,
	// or the tile wears green-at-zero and reads as a measured empty wing.
	assert.doesNotMatch(
		text,
		/getOccupancyColor\(\s*(?:occupancy|occupancyReading)[^)]*\)\s*\?\?/,
		'the ramp must not be reached for an unknown reading',
	);
	// The measured label must also be the shared contract, never a hand-built
	// template that can drift from it.
	assert.doesNotMatch(
		text,
		/text=\{`\$\{Math\.round\(occupancy\)\}% FILLED`\}/,
		'the tile must not format its own percentage inline',
	);
	// `data-utilization` is the DOM mark the sibling map already uses for a
	// measured-vs-unknown track, so a test or a stylesheet can tell them apart.
	assert.match(text, /data-utilization=/, `${CAMPUS_MAP} must mark a measured vs unknown tile track`);
});

test('A: the CampusMap tile geometry is unchanged, and the unknown label still fits one line', () => {
	const text = code(CAMPUS_MAP);
	// The occupancy group and its box are load-bearing for the building sizes.
	// The Group is allowed extra attributes (this change added
	// `data-utilization`) but NOT a moved or grown geometry.
	assert.match(text, /<Group x=\{6\} y=\{b\.height - 18\}/, 'the occupancy group must not move');
	// It must carry no box of its own: the group is positioned, and its extent
	// comes from the track rect and the text, so adding a `width`/`height` here
	// is how a legend would silently start growing the building's bar.
	const occupancyGroup = /<Group x=\{6\} y=\{b\.height - 18\}[^>]*>/.exec(text)?.[0] ?? '';
	assert.doesNotMatch(
		occupancyGroup,
		/\b(?:width|height|scaleY)=/,
		`the occupancy group must stay un-sized, got: ${occupancyGroup}`,
	);
	// An ellipsis is not a fix: a Konva `Text` with a `width` truncates or wraps,
	// so an over-long unknown label would read as a clipped claim.
	assert.doesNotMatch(text, /ellipsis=\{true\}/, 'the tile must not be ellipsised into a partial claim');
	assert.match(text, /width=\{b\.width - 12\}/, 'the occupancy track width must not change');
	assert.match(text, /height=\{12\}/, 'the occupancy track height must not change');
	assert.match(text, /fontSize=\{7\}/, 'the tile font must not shrink below 7');
	assert.doesNotMatch(text, /fontSize=\{[0-6]\}/, 'no sub-7px tile text');
	assert.doesNotMatch(text, /fontSize=\{(?:8|9|1[0-9])\}/, 'the tile font must not grow either — the box is 12 units tall');

	// THE FIT. Konva `Text` with a `width` WRAPS instead of overflowing, so the
	// binding constraint is that the label occupies exactly one line inside a
	// 12-unit-tall group. Bold Arial averages ~0.58em per glyph, so 7px is
	// ~4.06 units/glyph; the budget below is the widest glyph shape in the set.
	assert.ok(SEED_BUILDING_WIDTHS.length >= 11, 'precondition: the real seed still defines the campus buildings');
	assert.equal(NARROWEST_REAL_BUILDING_WIDTH, 180, 'precondition: the narrowest real building is still 180 units');
	assert.ok(TILE_TRACK_WIDTH > 0);

	const GLYPH_BUDGET_UNITS = TILE_FONT_SIZE * 0.62; // bold, and skewed to the wide end
	const measuredWidth = (label: string) => label.length * GLYPH_BUDGET_UNITS;
	// Both labels must fit the narrowest REAL building on one line, and the
	// unknown one must not be so long that it stops being a glance-readable token.
	assert.ok(
		measuredWidth(BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL) <= TILE_TRACK_WIDTH,
		`the unknown tile label must fit the narrowest real building on one line, got ~${measuredWidth(BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL)} units in ${TILE_TRACK_WIDTH}`,
	);
	assert.ok(
		measuredWidth('0% FILLED') <= TILE_TRACK_WIDTH,
		'precondition: the measured label it replaces also fits',
	);
	// One line means the text must not exceed the group's own height either.
	assert.ok(TILE_FONT_SIZE * 1.2 <= TILE_GROUP_HEIGHT, 'precondition: one line fits the group height');
	// And it must be a short token, not a sentence: 7px is a scan surface.
	assert.ok(
		BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL.length <= '0% FILLED'.length,
		`the unknown tile label must not be longer than the label it replaces, got "${BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL}"`,
	);
});

/* ───────────────────────── B: the label, in the DOM chrome that has room for words ───────────────────────── */

test('B: both map surfaces carry a plain-language legend, derived from the shared constants', () => {
	// `n/a` stays `n/a` — `ROOM_UTILIZATION_TEXT_BOX` is 36x14 and frozen, and
	// other work depends on that geometry. The WORDS go in the DOM.
	assert.equal(ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT, 'n/a');
	assert.equal(ROOM_UTILIZATION_UNKNOWN_LABEL, 'Not available');

	// Each surface's legend must SPELL OUT the token, or it labels nothing.
	assert.ok(
		ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT.includes(ROOM_UTILIZATION_UNKNOWN_LABEL_COMPACT),
		`the unknown legend must quote the token it explains, got "${ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT}"`,
	);
	assert.ok(
		ROOM_UTILIZATION_LEGEND_TEXT.length > 0,
		'the legend must say what the figure means, not just what the token is',
	);
	assert.doesNotMatch(ROOM_UTILIZATION_LEGEND_TEXT, /%/, 'the legend describes a share, and states no number');
	// A legend that read as a measurement would defeat its own purpose.
	assert.doesNotMatch(ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT, /%/, 'the unknown legend must not print a figure');

	for (const file of [CAMPUS_MAP, BUILDING_VIEW]) {
		// Scan import-stripped source, and require a RENDER. The bare identifier
		// match this replaces was satisfied by `BuildingView.tsx:9` and `:11` in
		// the import block, so the test named "both surfaces carry a legend"
		// passed on a surface that rendered no legend at all; QA reproduced that
		// by deleting the JSX and leaving the import.
		const text = rendered(file);
		// A precondition on the HELPER, not on the product. If the import strip
		// ever stopped matching, every control below would quietly degrade back
		// into a bare identifier scan and go green for the wrong reason — the
		// same trap `code()` documents one level up.
		assert.doesNotMatch(
			text,
			/^[ \t]*import\b/m,
			`precondition: the import strip must keep matching in ${file}, or these legend controls degrade to a bare identifier scan and stop proving a render`,
		);
		assert.match(
			text,
			RENDERED('ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT'),
			`${file} must RENDER the shared unknown legend — c0's "honest but unlabelled" verdict stands until it does. ${renderDiagnosis(file, 'ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT', text)}`,
		);
		assert.match(
			text,
			RENDERED('ROOM_UTILIZATION_LEGEND_TEXT'),
			`${file} must RENDER the shared legend sentence. ${renderDiagnosis(file, 'ROOM_UTILIZATION_LEGEND_TEXT', text)}`,
		);
		// Both surfaces read the SAME constants, so the one-truth requirement is
		// met by the strings themselves. It is deliberately NOT met by a shared
		// component: a legend component would have to live in a file this stream
		// does not own, and the constants already make divergence impossible.
		assert.doesNotMatch(
			text,
			/Use not available yet|not available yet/,
			`${file} must not re-word the legend inline; it must read the shared constant`,
		);
	}
});

test('B: the legend sentence is never hover-GATED — both surfaces emit the full words in an @/ui surface', () => {
	// N2, DECIDED AND RECORDED — QA accepted "visible DOM chrome, not hover-only"
	// for PRESENCE and for the 920px stage, but not for the complete sentence at
	// every width, and it left the choice open. The decision is KEEP `truncate`,
	// for a reason that is checkable rather than asserted:
	//
	//  - `truncate` is not the only path to the wording. BOTH surfaces already
	//    emit the SAME composed sentence inside a `<TooltipContent>` — a
	//    sanctioned `@/ui` surface, which §8 requires and which a raw `title=`
	//    would not be. So the complete sentence is always reachable by hover and
	//    is never truncated-into-ambiguity, which is what "hover-gated" means.
	//  - The alternative, dropping `truncate`, is strictly worse here. The legend
	//    is a TRAILING `ml-auto` item on a toolbar row whose height is bound by
	//    its `h-7` buttons specifically so that three of the four `BuildingView`
	//    callers keep a FIXED stage height. Letting the sentence wrap would grow
	//    that row and push every one of those stages down — the exact regression
	//    the geometry control below exists to prevent.
	//
	// So: no production change. What follows is the control that makes the
	// decision falsifiable — delete either `<TooltipContent>` and it goes red.
	//
	// WIDTH OF RECORD. The composed sentence is
	// `Use = share of periods in use · "n/a" = use not available yet`. At
	// `text-xs` (12px) in a muted sans that is ~6.0px per glyph, so ~384px. The
	// `CampusMap` toolbar row is the fixed 920px stage less `px-4` (32px) =
	// 888px, and its leading controls — three labelled `h-8` buttons (~254px),
	// the divider and its `mx-2` (~22px), and the uppercase `tracking-widest`
	// "Campus Map View" label (~150px) — consume ~430px, leaving ~450px. THE
	// SENTENCE IS THEREFORE COMPLETE at the 920px stage, which is the width QA
	// checked and accepted. Below roughly 780px of container width the trailing
	// item narrows far enough to ellipsize — the `BuildingView` panes are 500px
	// and 420px in two of its four callers, so this is the COMMON case there,
	// not an edge case — and the Tooltip below is what covers it.
	//
	// Glyph width and control widths above are ESTIMATES from the font size and
	// the class names, not a rendered measurement. The load-bearing, measured
	// half of this decision is structural: the full sentence is present in the
	// DOM inside a `@/ui` surface, so legibility never depends on the estimate.
	const composed = `${ROOM_UTILIZATION_LEGEND_TEXT} · ${ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT}`;
	// A legend is a scan surface, not a paragraph: the ceiling is what keeps the
	// `truncate` decision defensible at all. The exact figure is 61 characters
	// today — measured from the two constants via the same composition this row
	// builds, not transcribed by hand — and it is deliberately NOT pinned, so
	// copy-wording changes cannot fail a legibility control.
	assert.ok(
		composed.length <= 80,
		`the composed legend must stay a glanceable sentence; at ${composed.length} chars ("${composed}") it is a paragraph the toolbar cannot show`,
	);
	assert.ok(!/%/.test(composed), 'precondition: the sentence states no figure');

	for (const file of [CAMPUS_MAP, BUILDING_VIEW]) {
		const text = rendered(file);
		assert.doesNotMatch(
			text,
			/^[ \t]*import\b/m,
			`precondition: the import strip must keep matching in ${file}`,
		);
		assert.match(
			text,
			FULL_SENTENCE_IN_TOOLTIP,
			`${file}: the legend is \`truncate\`d, so the COMPLETE sentence must also be emitted inside a @/ui TooltipContent — otherwise the full wording is hover-gated and §8's ban on a raw title= leaves no way to reach it. ${renderDiagnosis(file, 'ROOM_UTILIZATION_LEGEND_TEXT', text)}`,
		);
	}
});

test('B: the legend changes no canvas geometry and adds no height to any pane', () => {
	// `map` is gone: its only assertion below now scans `rendered(CAMPUS_MAP)`
	// instead of `code(CAMPUS_MAP)`, so the binding was left dead. No assertion
	// was removed with it — the CampusMap legend check is STRICTER than before.
	const view = code(BUILDING_VIEW);

	// The frozen room-card geometry is untouched — the words went into the DOM
	// chrome precisely so it would stay untouched.
	assert.match(
		view,
		/export const ROOM_UTILIZATION_TEXT_BOX = \{ x: 4, y: 66, width: 36, height: 14 \} as const;/,
		'ROOM_UTILIZATION_TEXT_BOX must not widen or move',
	);
	assert.match(
		view,
		/export const ROOM_UTILIZATION_BAR_BOX = \{ x: 78, y: 5, width: 10, height: 62 \} as const;/,
		'ROOM_UTILIZATION_BAR_BOX must not widen or move',
	);
	assert.match(view, /x=\{ROOM_UTILIZATION_TEXT_BOX\.x\}/);
	assert.match(view, /width=\{ROOM_UTILIZATION_TEXT_BOX\.width\}/);

	// Height budget. Three of the four `BuildingView` callers pass a FIXED
	// height (CampusMapOverview 500, CampusReadinessCard 480, CenterWorkspace
	// 420) with `showToolbar`, and the host is not height-capped, so a legend on
	// its OWN ROW would push every one of those stages down. The legend therefore
	// lives INSIDE the existing toolbar row: `h-7` buttons bound that row's
	// height, and a `text-xs` line is 16px, so the row's height is unchanged and
	// the added height is exactly 0 in all four panes.
	assert.match(
		view,
		/<div ref=\{toolbarRef\} className="mb-2 flex items-center gap-1">/,
		'the toolbar row must stay a single row — the legend shares it rather than adding one',
	);
	// The legend must be a TRAILING item of the existing row, not a block above
	// it: a block would add its line box to all three fixed-height panes.
	const toolbarRow = /<div ref=\{toolbarRef\}[\s\S]*?<\/TooltipProvider>/.exec(view)?.[0] ?? '';
	assert.match(
		toolbarRow,
		/ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT/,
		'the legend must live inside the toolbar row, or the four panes each grow a line',
	);
	// The full sentence must remain reachable without a raw `title` attribute,
	// which the shared-chrome contract bans.
	assert.match(
		view,
		/Tooltip|HoverCard/,
		'the truncated legend needs a @/ui surface for its full sentence',
	);
	// Same rendered-position requirement as the legend test above, and for the
	// same reason: a bare `/ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT/` is satisfied
	// by `CampusMap.tsx:9` in the import block, so it would have gone green on a
	// map that renders no legend. This is the CampusMap half of that control.
	assert.match(
		rendered(CAMPUS_MAP),
		RENDERED('ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT'),
		`${CAMPUS_MAP} must place its RENDERED legend in its toolbar row`,
	);
});

/* ───────────────────────── C: the card answers "is this room free?" ───────────────────────── */

test('C: the room card shows USE beside CAPACITY, from the same reading the tile uses', () => {
	const text = code(BUILDING_VIEW);
	// The card that shows capacity with no use at all is the Building view's
	// hover room card. c0's header comment claimed this surface was the
	// full-detail one; it showed Type and Capacity and never mentioned use.
	assert.match(text, />Capacity</, 'precondition: the room card still renders its capacity row');
	// The Use row, with the same chrome as its Capacity neighbour so the card
	// reads as one table rather than a card that grew an afterthought.
	assert.match(
		text,
		/<span className="text-muted-foreground uppercase font-bold text-xs tracking-wide">Use<\/span>/,
		'the room card must gain a Use row styled exactly like its Capacity row',
	);
	// From the SAME source, never a `?? 0`, so the card and the canvas can never
	// disagree about the same room.
	assert.match(
		text,
		/roomUtilizationLabel\(roomUtilization, r\.id\)/,
		'the Use row must read the shared tri-state label for the hovered room',
	);
	assert.doesNotMatch(
		text,
		/roomUtilization\?\.get\(r\.id\)\s*\?\?\s*0/,
		'the Use row must not default the hovered room to 0%',
	);
	// Label and value must be ONE row, so the figure cannot be read as a
	// caption for the row below it.
	assert.match(
		text,
		/>Use<\/span>[\s\S]{0,400}?roomUtilizationLabel\(/,
		'the Use label and its value must be in the same row',
	);
	// The unknown case is marked, as the sibling map's track already is, so a
	// measured 0% and an absent reading are told apart in the DOM and not only
	// by the italic.
	assert.match(
		text,
		/data-utilization=\{isRoomUtilizationKnown\(roomUtilization, r\.id\) \? 'measured' : 'unknown'\}/,
		'the Use row must mark a measured vs unknown reading',
	);
	// DOM has room for words, so the unknown case is spelled out here rather
	// than left as the canvas-only `n/a` token.
	assert.doesNotMatch(
		text,
		/roomUtilizationCompactLabel\(roomUtilization, r\.id\)/,
		'the DOM card must use the long wording, not the canvas-only compact token',
	);
});

test('C: the tile and the card cannot disagree, because both read the same module', () => {
	// Behavioural, across BOTH surfaces' helpers, on the same map.
	for (const [pct, want] of [[0, '0%'], [62, '62%']] as const) {
		const map = new Map([[501, pct]]);
		assert.equal(
			roomUtilizationLabel(map, 501),
			want,
			'the card label and the canvas compact label are two forms of one reading',
		);
	}
	// The cross-surface claim: an absent reading is unknown on BOTH surfaces,
	// and the two wordings differ only in brevity, never in honesty.
	const absent = new Map<number, number>();
	assert.equal(roomUtilizationLabel(absent, 501), ROOM_UTILIZATION_UNKNOWN_LABEL);
	assert.equal(
		buildingOccupancyTileLabel(new Map([[1, 50]]), 1),
		'50% FILLED',
		'precondition: a measured building reading is still rendered',
	);
	assert.equal(
		buildingOccupancyTileLabel(absent, 1),
		BUILDING_UTILIZATION_UNKNOWN_TILE_LABEL,
		'the tile must not claim a building figure the card would refuse to show',
	);
});

/* ───────────────────────── hygiene: no new raw neutrals, no fabrication anywhere ───────────────────────── */

test('hygiene: neither owned file adds a raw neutral text colour', () => {
	// `palette-ratchet-a3-s-e.test.ts` pins the client-wide total of raw neutral
	// TEXT colours (95) and the file count (28), and `palette-token-sweep` pins
	// per-file residuals for `CampusMapOverview`. A `text-slate-*` added here
	// would move a pin another lane owns. The app's token layer is the
	// requirement, not a preference.
	//
	// PINNED, NOT ZERO. `BuildingView` already holds `text-gray-600` and
	// `text-slate-600` at base `6b84a3a6` — pre-existing A3-lane debt that is
	// not in either palette sweep's 19-file scope, so no other lane is expected
	// to sweep it. Asserting zero here would fail on a condition this change
	// did not create and would train the next reader to ignore the control, which
	// is the failure the §8 sub-11px control in the sibling file documents. The
	// pin is the ratchet: it may be lowered deliberately, never widened.
	const PINNED_BASE_RAW_NEUTRALS: Readonly<Record<string, number>> = {
		[CAMPUS_MAP]: 0,
		[BUILDING_VIEW]: 2,
	};
	for (const [file, pinned] of Object.entries(PINNED_BASE_RAW_NEUTRALS)) {
		const found = [...source(file).matchAll(/\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g)];
		assert.equal(
			found.length,
			pinned,
			`${file}: raw neutral text colours moved from the pinned ${pinned} to ${found.length} ` +
				`(${found.map((m) => m[0]).join(', ')}). Use text-foreground / text-muted-foreground, ` +
				'or lower this pin deliberately with a reason.',
		);
	}
	// The legend itself is the new markup, so it is checked directly rather than
	// only through the count above.
	for (const file of [CAMPUS_MAP, BUILDING_VIEW]) {
		assert.doesNotMatch(
			source(file),
			/ROOM_UTILIZATION_UNKNOWN_LEGEND_TEXT[\s\S]{0,300}?text-(?:slate|zinc|gray|neutral|stone)-/,
			`${file}: the legend must be built from theme tokens`,
		);
	}
});

test('hygiene: no raw `title` attribute and no native select were introduced', () => {
	// §8 of the shared-chrome contract: extra information goes through
	// `@/ui` HoverCard / Tooltip / Popover, never a raw `title`.
	for (const file of [CAMPUS_MAP, BUILDING_VIEW]) {
		assert.doesNotMatch(source(file), /<RoomUtilizationLegend[\s\S]{0,400}?\btitle=/);
	}
});
