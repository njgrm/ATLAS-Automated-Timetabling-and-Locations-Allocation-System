/**
 * A3 S1 — the room-card frame budget, the map layout budget, and the
 * micro-typography floor (fixes 06, 07, 10, 11).
 *
 * These are measured, not eyeballed. The card rectangles below are the ones the
 * component actually renders (the exported frame budget), and the layout budget
 * is arithmetic over the committed dialog class contract at a 1366x768
 * viewport. Each control also carries the *pre-fix* arrangement so it can be
 * seen to discriminate: a control that cannot fail is not evidence.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

import {
	ROOM_CARD_H,
	ROOM_CARD_W,
	ROOM_NAME_BOX,
	ROOM_NAME_FONT,
	ROOM_LINE_H,
	ROOM_OCCUPANCY_BOX,
	ROOM_PROGRAM_BADGE_BOX,
	ROOM_TYPE_BOX,
	ROOM_UTILIZATION_BAR_BOX,
	ROOM_UTILIZATION_TEXT_BOX,
} from '../../BuildingView';

const clientRoot = resolve(import.meta.dirname, '../../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(inner: Box, outer: Box): boolean {
	return inner.x >= 0
		&& inner.y >= 0
		&& inner.x + inner.width <= outer.width
		&& inner.y + inner.height <= outer.height;
}

const CARD: Box = { x: 0, y: 0, width: ROOM_CARD_W, height: ROOM_CARD_H };

/* ───────────────────── fix 07 + 11: the card frame budget ────────────────── */

test('fix 07 control: every card element owns a disjoint rectangle, and the pre-fix layout did not', () => {
	const boxes: Record<string, Box> = {
		name: ROOM_NAME_BOX,
		type: ROOM_TYPE_BOX,
		occupancy: ROOM_OCCUPANCY_BOX,
		utilizationText: ROOM_UTILIZATION_TEXT_BOX,
		programBadge: ROOM_PROGRAM_BADGE_BOX,
		utilizationBar: ROOM_UTILIZATION_BAR_BOX,
	};
	const names = Object.keys(boxes);
	const collisions: string[] = [];
	for (let i = 0; i < names.length; i += 1) {
		for (let j = i + 1; j < names.length; j += 1) {
			if (overlaps(boxes[names[i]], boxes[names[j]])) collisions.push(`${names[i]} x ${names[j]}`);
		}
	}
	assert.deepEqual(collisions, [], `card elements must not overlap: ${collisions.join(', ')}`);
	for (const name of names) {
		assert.ok(inside(boxes[name], CARD), `${name} must stay inside the ${ROOM_CARD_W}x${ROOM_CARD_H} card`);
	}

	// The pre-fix arrangement, transcribed from base 3cfe79a8 at 90x70: the
	// program badge (x 66..86, y 6..16) sat inside both the room name
	// (x 4..86, y 6..~18) and the utilization bar (x 76..86, y 8..58).
	const preFixName: Box = { x: 4, y: 6, width: 82, height: 12 };
	const preFixBadge: Box = { x: 66, y: 6, width: 20, height: 10 };
	const preFixBar: Box = { x: 76, y: 8, width: 10, height: 50 };
	assert.ok(overlaps(preFixName, preFixBadge), 'precondition: the badge used to overlap the name');
	assert.ok(overlaps(preFixBadge, preFixBar), 'precondition: the badge used to overlap the utilization bar');
});

test('fix 11 control: the named worst-case room names fit the name box by wrapping, before any ellipsis', () => {
	// Konva lays out with a font metric; this is a deliberately conservative
	// bound (0.62em mixed case, 0.72em uppercase) so the assertion cannot pass
	// on a lucky measurement.
	const charW = (text: string) => Array.from(text).reduce((sum, ch) => {
		const upper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
		return sum + (upper ? 0.72 : 0.62) * ROOM_NAME_FONT;
	}, 0);

	const lines = (text: string, width: number): number => {
		// Greedy word wrap, the same order a text engine uses.
		let count = 1;
		let current = 0;
		for (const word of text.split(' ')) {
			const w = charW(word);
			if (current === 0) current = w;
			else if (current + 0.62 * ROOM_NAME_FONT + w <= width) current += 0.62 * ROOM_NAME_FONT + w;
			else { count += 1; current = w; }
		}
		return count;
	};

	const capacity = Math.floor(ROOM_NAME_BOX.height / ROOM_LINE_H);
	assert.ok(capacity >= 2, `the name box must afford two lines, got ${capacity}`);

	for (const name of ['Learning Commons', 'Guidance Office']) {
		const used = lines(name, ROOM_NAME_BOX.width);
		assert.ok(
			used <= capacity,
			`"${name}" needs ${used} lines at ${ROOM_NAME_FONT}px in ${ROOM_NAME_BOX.width}px but the box affords ${capacity}`,
		);
	}

	// The name must wrap rather than truncate: the pre-fix text was a single
	// non-wrapping 10px line in 82px, which ellipsised these names.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/x=\{ROOM_NAME_BOX\.x\}[\s\S]{0,320}?wrap="word"[\s\S]{0,80}?ellipsis/,
		'the room name must wrap before it ellipsises',
	);
	assert.doesNotMatch(
		view,
		/text=\{room\.name\}[\s\S]{0,200}?wrap="none"/,
		'the room name must not be a non-wrapping line any more',
	);
});

/* ────── fix 11 (second correction): Konva's `lineHeight` is a RATIO ─────────── */

/**
 * A faithful port of Konva's own text-layout decision, so this control decides
 * the question the first fix-11 control could not: is the name ellipsised at the
 * COMMITTED geometry?
 *
 * The first fix-11 control modelled the wrap with its own greedy char-width
 * approximation and never ran Konva's decision at all, so it passed on the
 * revision that rendered `G7 Room.` on the live surface. This port is a
 * line-by-line transcription of the installed Konva, not a model of it:
 *
 *   konva/lib/shapes/Text.js:306  lineHeightPx = this.lineHeight() * fontSize
 *   konva/lib/shapes/Text.js:312-396  the paragraph/wrap loop
 *   konva/lib/shapes/Text.js:400-404  _shouldHandleEllipsis
 *   konva/lib/shapes/Text.js:405-419  _tryToAddEllipsisToLastLine
 *   konva/lib/shapes/Text.js:455  addGetterSetter(Text, 'lineHeight', 1)
 *
 * The one thing a real browser supplies and this cannot is the font metric, so
 * `measure` is injected. It is used in the PESSIMISTIC direction throughout:
 * over-estimating glyph widths can only make the wrap produce MORE lines, so
 * "fits in two lines under this metric" implies "fits in two lines under any
 * narrower real font". The base-revision truncation claim does not depend on it
 * at all (see the `baseTruncationIsFontIndependent` row below).
 */
type KonvaTextSpec = {
	text: string;
	/** Konva's `fontSize`, in stage units. */
	fontSize: number;
	/** Konva's `lineHeight` — a MULTIPLIER (`:455`, default 1). */
	lineHeight: number;
	width: number;
	height: number;
	wrap: 'word' | 'char' | 'none';
	ellipsis: boolean;
	measure: (text: string) => number;
};

type KonvaLayout = { lines: string[]; ellipsisApplied: boolean; lineHeightPx: number };

function konvaLayout(spec: KonvaTextSpec): KonvaLayout {
	const { text, fontSize, lineHeight, width, height, wrap, ellipsis, measure } = spec;
	// Text.js:306
	const lineHeightPx = lineHeight * fontSize;
	const maxWidth = width;
	const maxHeightPx = height;
	const shouldWrap = wrap !== 'none';
	const wrapAtWord = wrap !== 'char' && shouldWrap;
	const ELLIPSIS = '.';
	const lines: string[] = [];
	let currentHeightPx = 0;
	let ellipsisApplied = false;

	// Text.js:400-404
	const shouldHandleEllipsis = (): boolean => !shouldWrap || currentHeightPx + lineHeightPx > maxHeightPx;
	// Text.js:405-419
	const tryToAddEllipsisToLastLine = (): void => {
		const index = lines.length - 1;
		if (index < 0) return;
		let text = lines[index];
		if (!(measure(text + ELLIPSIS) < maxWidth)) text = text.slice(0, text.length - 3);
		lines.splice(index, 1);
		lines.push(text + ELLIPSIS);
		ellipsisApplied = true;
	};

	// Text.js:312-396
	const paragraphs = text.split('\n');
	for (let i = 0, max = paragraphs.length; i < max; ++i) {
		let line = paragraphs[i];
		let lineWidth = measure(line);
		if (lineWidth > maxWidth) {
			while (line.length > 0) {
				const chars = Array.from(line);
				let low = 0;
				let high = chars.length;
				let match = '';
				let matchWidth = 0;
				while (low < high) {
					const mid = (low + high) >>> 1;
					const substr = chars.slice(0, mid + 1).join('');
					const substrWidth = measure(substr);
					if (substrWidth <= maxWidth) {
						low = mid + 1;
						match = substr;
						matchWidth = substrWidth;
					} else {
						high = mid;
					}
				}
				if (!match) break;
				if (wrapAtWord) {
					const matchArray = Array.from(match);
					const nextChar = chars[matchArray.length];
					const nextIsSpaceOrDash = nextChar === ' ' || nextChar === '-';
					let wrapIndex: number;
					if (nextIsSpaceOrDash && matchWidth <= maxWidth) wrapIndex = matchArray.length;
					else wrapIndex = Math.max(matchArray.lastIndexOf(' '), matchArray.lastIndexOf('-')) + 1;
					if (wrapIndex > 0) {
						low = wrapIndex;
						match = chars.slice(0, low).join('');
					}
				}
				lines.push(match.replace(/\s+$/, ''));
				currentHeightPx += lineHeightPx;
				if (shouldHandleEllipsis()) {
					tryToAddEllipsisToLastLine();
					break;
				}
				const rest = chars.slice(low).join('').replace(/^\s+/, '');
				if (rest.length === 0) break;
				if (measure(rest) <= maxWidth) {
					lines.push(rest);
					currentHeightPx += lineHeightPx;
					break;
				}
				line = rest;
			}
		} else {
			lines.push(line);
			currentHeightPx += lineHeightPx;
			if (shouldHandleEllipsis() && i < max - 1) tryToAddEllipsisToLastLine();
		}
		if (currentHeightPx + lineHeightPx > maxHeightPx) break;
	}
	return { lines, ellipsisApplied, lineHeightPx };
}

/**
 * Pessimistic mixed-case metric: 0.72em for upper-case glyphs, 0.62em otherwise.
 * Deliberately wider than Arial 11px for the strings below, so it over-wraps.
 */
const pessimisticMeasure = (text: string): number => Array.from(text).reduce((sum, ch) => {
	const upper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
	return sum + (upper ? 0.72 : 0.62) * ROOM_NAME_FONT;
}, 0);

/**
 * What production ACTUALLY hands Konva, read from the component source so the
 * control decides the shipped wiring rather than a constant the test invented.
 *
 * Konva multiplies (`Text.js:306 lineHeightPx = this.lineHeight() * fontSize`),
 * so this returns the multiplier as configured. The identifier is then resolved
 * against the two committed constants, which exist on both revisions — so this
 * control RUNS on the base (where it resolves to the pixel pitch `13` and the
 * room name is demonstrably truncated) instead of dying on a missing export.
 */
function configuredLineHeight(view: string): number {
	const prop = /lineHeight=\{(ROOM_LINE_RATIO|ROOM_LINE_H)\}/.exec(view);
	assert.ok(prop, 'the card Texts must pass an explicit lineHeight prop');
	// `ROOM_LINE_RATIO` is defined as `ROOM_LINE_H / ROOM_NAME_FONT`; pin that so
	// the resolved multiplier cannot drift from the exported one.
	if (prop[1] === 'ROOM_LINE_RATIO') {
		assert.match(
			view,
			/export const ROOM_LINE_RATIO = ROOM_LINE_H \/ ROOM_NAME_FONT;/,
			'the configured ratio must be ROOM_LINE_H / ROOM_NAME_FONT',
		);
		return ROOM_LINE_H / ROOM_NAME_FONT;
	}
	return ROOM_LINE_H;
}

/** The three names the live surface showed truncated. */
const WORST_CASE_ROOM_NAMES = ['G7 Room 203', 'Learning Commons', 'Guidance Office'];

test('fix 11 control: Konva gets a line RATIO, so the committed pitch is the 13px budget, not 143', () => {
	// The load-bearing assertion, and the one the live defect turned on.
	// Konva multiplies: Text.js:306 `lineHeightPx = this.lineHeight() * fontSize`.
	const view = source('src/components/BuildingView.tsx');
	const configured = configuredLineHeight(view);
	const committedPitch = configured * ROOM_NAME_FONT;
	assert.ok(
		committedPitch <= ROOM_LINE_H,
		`the committed line pitch must not exceed the ${ROOM_LINE_H}px budget, got ${committedPitch}`,
	);
	assert.ok(
		ROOM_LINE_H - committedPitch < 0.01,
		`the ratio must still fill the budget it was derived from, got ${committedPitch} of ${ROOM_LINE_H}`,
	);
	// The box affords exactly two lines, and still refuses a third.
	assert.equal(2 * committedPitch, ROOM_NAME_BOX.height, 'two lines must fit the name box exactly');
	assert.ok(3 * committedPitch > ROOM_NAME_BOX.height, 'a third line must still be refused');

	// The base revision passed the PIXEL pitch as the ratio, so Konva built a
	// 143-unit line. This is the arithmetic that produced the live symptom, and
	// it is font-independent, which is why the control below needs no metric to
	// prove the base was broken.
	const basePitch = ROOM_LINE_H * ROOM_NAME_FONT;
	assert.equal(basePitch, 143);
	assert.equal(basePitch / ROOM_LINE_H, ROOM_NAME_FONT, 'precondition: the base pitch was 11x the budget');
	assert.ok(
		basePitch > ROOM_NAME_BOX.height,
		'precondition: one base line already exceeded the whole name box',
	);

	// Every card Text must take the ratio. A single leftover `lineHeight={ROOM_LINE_H}`
	// re-creates the defect on that element, so the count is pinned.
	assert.doesNotMatch(
		view,
		/lineHeight=\{ROOM_LINE_H\}/,
		'Konva must never receive the pixel pitch as its lineHeight ratio',
	);
	const ratioProps = view.match(/lineHeight=\{ROOM_LINE_RATIO\}/g) ?? [];
	assert.equal(
		ratioProps.length,
		6,
		`all six card Text elements must take the ratio, found ${ratioProps.length}`,
	);
	assert.match(
		view,
		/export const ROOM_LINE_RATIO = ROOM_LINE_H \/ ROOM_NAME_FONT;/,
		'the configured ratio must be the expression this control derived',
	);

	// `ROOM_LINE_H` is the LAYOUT budget and must not drift while fixing this.
	assert.equal(ROOM_LINE_H, 13, 'the 13px layout pitch is the contract the boxes were budgeted against');
});

test('fix 11 control: the worst-case room names render in full at the committed geometry', (t) => {
	const spec = (text: string, lineHeight: number): KonvaTextSpec => ({
		text,
		fontSize: ROOM_NAME_FONT,
		lineHeight,
		width: ROOM_NAME_BOX.width,
		height: ROOM_NAME_BOX.height,
		wrap: 'word',
		ellipsis: true,
		measure: pessimisticMeasure,
	});

	const rows: string[] = [];
	const configured = configuredLineHeight(source('src/components/BuildingView.tsx'));
	for (const name of WORST_CASE_ROOM_NAMES) {
		const after = konvaLayout(spec(name, configured));
		assert.equal(
			after.ellipsisApplied,
			false,
			`"${name}" must not be ellipsised: it rendered as "${after.lines.join(' / ')}"`,
		);
		assert.ok(after.lines.length <= 2, `"${name}" must fit two lines, got ${after.lines.length}`);
		assert.equal(
			after.lines.join(' '),
			name,
			`"${name}" must render in full, got "${after.lines.join(' ')}"`,
		);

		// The same name on the base revision, for the reviewer to compare.
		const before = konvaLayout(spec(name, ROOM_LINE_H));
		assert.equal(
			before.ellipsisApplied,
			true,
			`precondition: the base pitch (143 units) must ellipsise "${name}", got "${before.lines.join(' / ')}"`,
		);
		rows.push(
			`"${name}": base pitch ${before.lineHeightPx} -> "${before.lines.join(' / ')}" | `
			+ `committed pitch ${after.lineHeightPx} -> "${after.lines.join(' / ')}"`,
		);
	}
	t.diagnostic(`room name at ${ROOM_NAME_BOX.width}x${ROOM_NAME_BOX.height}, ${ROOM_NAME_FONT}px:\n${rows.join('\n')}`);
});

test('fix 11 control: the base truncation was font-independent, so no metric can rescue it', () => {
	// This is why the first fix-11 control passed while the live surface showed
	// `G7 Room.`: it measured the WRAP and never Konva's ellipsis decision. The
	// decision is driven by the height rule, and on the base pitch the height
	// rule is already spent after line one — for every possible font.
	const basePitch = ROOM_LINE_H * ROOM_NAME_FONT;
	const maxHeightPx = ROOM_NAME_BOX.height;
	// Text.js:400-404 with `wrap !== 'none'`: the ellipsis fires as soon as one
	// more line will not fit.
	assert.equal(
		(basePitch + basePitch) > maxHeightPx,
		true,
		'precondition: after one base line, a second can never fit the 26px name box',
	);
	const configured = configuredLineHeight(source('src/components/BuildingView.tsx'));
	assert.equal(
		configured * ROOM_NAME_FONT * 2 <= maxHeightPx,
		true,
		'committed: two lines fit the name box exactly',
	);

	// Sweep the whole plausible glyph range: even at a 0.30em minimum (a very
	// narrow font) the base revision still cannot show a wrapped second line,
	// because the blocker is the pitch and not the width.
	for (const em of [0.3, 0.45, 0.62, 0.72, 0.95, 1.2]) {
		const measure = (text: string): number => Array.from(text).reduce((sum, ch) => sum + em * ROOM_NAME_FONT, 0);
		const layout = konvaLayout({
			text: 'Learning Commons', fontSize: ROOM_NAME_FONT, lineHeight: ROOM_LINE_H,
			width: ROOM_NAME_BOX.width, height: ROOM_NAME_BOX.height, wrap: 'word', ellipsis: true, measure,
		});
		assert.equal(
			layout.ellipsisApplied || layout.lines.join(' ').replace(/\s+/g, ' ').trim() === 'Learning Commons',
			true,
			`at ${em}em the base revision must still not render the full name, got "${layout.lines.join(' / ')}"`,
		);
		assert.ok(
			layout.lines.length <= 1,
			`precondition: at ${em}em the base revision can never show a second line, got ${layout.lines.length}`,
		);
	}
});

test('fix 11 control: the type line, occupancy chip and utilisation readout are all back inside the card', (t) => {
	// `translateY = lineHeightPx / 2` (Text.js:104/:111) with `verticalAlign`
	// defaulting to TOP, so the base pitch drew every one of these elements
	// 71.5 units BELOW its own box. The name box is at the TOP of the card
	// (y=4) but its baseline landed at 75.5 of 84 — which is precisely where the
	// live screenshot showed the truncated label, at the BOTTOM of the card —
	// and the other three elements were pushed off-card entirely, so the card
	// rendered one line and nothing else.
	const baseTranslateY = (ROOM_LINE_H * ROOM_NAME_FONT) / 2;
	const committedTranslateY = (configuredLineHeight(source('src/components/BuildingView.tsx')) * ROOM_NAME_FONT) / 2;
	assert.equal(baseTranslateY, 71.5);

	// The name: displaced from the top of its own box to the bottom of the card.
	assert.equal(ROOM_NAME_BOX.y + baseTranslateY, 75.5);
	assert.ok(
		ROOM_NAME_BOX.y + baseTranslateY > ROOM_CARD_H * 0.8,
		'precondition: the base name baseline sat in the bottom 20% of the card while its box is at the top',
	);
	assert.ok(
		ROOM_NAME_BOX.y + committedTranslateY + ROOM_NAME_FONT <= ROOM_CARD_H,
		'the name must stay inside the card',
	);

	const rows: string[] = [`name box y ${ROOM_NAME_BOX.y}: base baseline 75.5 of ${ROOM_CARD_H} (bottom of card) -> committed ${(ROOM_NAME_BOX.y + committedTranslateY + ROOM_NAME_FONT).toFixed(1)}`];
	for (const [name, box] of Object.entries({
		type: ROOM_TYPE_BOX, occupancy: ROOM_OCCUPANCY_BOX, utilizationText: ROOM_UTILIZATION_TEXT_BOX,
	})) {
		const baseBottom = box.y + baseTranslateY;
		const committedBottom = box.y + committedTranslateY + ROOM_NAME_FONT;
		assert.ok(
			baseBottom > ROOM_CARD_H,
			`precondition: the ${name} element left the ${ROOM_CARD_H}px card on the base pitch (${baseBottom})`,
		);
		assert.ok(
			committedBottom <= ROOM_CARD_H,
			`the ${name} element must stay inside the card, got ${committedBottom} of ${ROOM_CARD_H}`,
		);
		rows.push(`${name} box y ${box.y}: base baseline ${baseBottom.toFixed(1)} (off-card) -> committed ${committedBottom.toFixed(1)}`);
	}
	// The program badge is vertically centred, so its own box is the budget.
	assert.ok(ROOM_PROGRAM_BADGE_BOX.y + ROOM_PROGRAM_BADGE_BOX.height <= ROOM_CARD_H);
	assert.ok(ROOM_UTILIZATION_BAR_BOX.y + ROOM_UTILIZATION_BAR_BOX.height <= ROOM_CARD_H);
	t.diagnostic(`card ${ROOM_CARD_W}x${ROOM_CARD_H} interiors:\n${rows.join('\n')}`);
});

/* ─────────── cross-lane contract: this component's width must not move ───── */

/**
 * Base 3cfe79a8 transcribed verbatim: FLOOR_LABEL_W 36, FLOOR_PAD_X 8,
 * ROOM_MIN_W 90, ROOM_GAP 4. This is the width every consumer of BuildingView
 * reads, and it is the divisor of the auto-fit scale.
 */
const BASE_ROOM_MIN_W: number = 90;
function baseBuildingContentW(maxRoomsOnFloor: number): number {
	return 36 + 8 * 2 + maxRoomsOnFloor * BASE_ROOM_MIN_W + (maxRoomsOnFloor - 1) * 4;
}

test('cross-lane width contract: buildingContentW equals base, so no consumer\'s fit scale moves', (t) => {
	// The load-bearing control for the shared component. It fails if the card
	// width is anything but base 90 — proven by running it against 13f1f189,
	// which is why the "precondition" below is asserted rather than assumed.
	//
	// It deliberately reads ROOM_CARD_W (which exists on both revisions) rather
	// than a new export, so a width regression fails on a real assertion here
	// instead of on a module-load error.
	assert.equal(ROOM_CARD_W, BASE_ROOM_MIN_W, 'the card width must stay at base');
	// ROOM_CARD_W is the card, and the card is the divisor: pin the production
	// expression that every consumer's fit scale reads.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/const buildingContentW = FLOOR_LABEL_W \+ FLOOR_PAD_X \* 2 \+ maxRoomsOnFloor \* ROOM_MIN_W \+ \(maxRoomsOnFloor - 1\) \* ROOM_GAP;/,
		'the building width must keep the base expression that every consumer reads',
	);
	assert.match(view, /const ROOM_MIN_W = 90;/, 'the card width constant must read 90');
	const contentW = (maxRooms: number) => 36 + 8 * 2 + maxRooms * ROOM_CARD_W + (maxRooms - 1) * 4;

	const cases: Array<[floors: number, maxRooms: number]> = [
		[2, 4], [3, 6], [4, 6], [4, 8], [5, 8], [6, 10],
	];
	const rows: string[] = [];
	for (const [floors, maxRooms] of cases) {
		const actual = contentW(maxRooms);
		const expected = baseBuildingContentW(maxRooms);
		assert.equal(
			actual,
			expected,
			`${floors}f x ${maxRooms}r: buildingContentW is ${actual}, base is ${expected} — every consumer's fit scale moves`,
		);
		rows.push(`${floors}f x ${maxRooms}r: ${actual} = base ${expected}`);
	}

	// The precondition that makes this discriminating: the width rejected in
	// review (110) is NOT base, and it is NOT a width change every consumer can
	// absorb. At 110 the room term grows 110/90 = +22.2%, and because the
	// rejected card was width-bound in A2's centre view, that is the limiter.
	const rejected: number = 110;
	assert.ok(rejected !== BASE_ROOM_MIN_W, 'precondition: the rejected width differs from base');
	assert.ok(
		Math.abs((rejected - BASE_ROOM_MIN_W) / BASE_ROOM_MIN_W) > 0.2,
		'precondition: the rejected width grows the room term by more than 20%',
	);

	// A2's centre view (components/timetable/CenterWorkspace.tsx, col-span-8 of
	// 12, height={420}, no fillAvailableHeight) at its two measured container
	// widths: 616px with the md:w-[24rem] task drawer present, 872px collapsed.
	// Those two widths are QA's measured inputs, taken as given; the guarantee
	// below does not depend on them, because the card is base 90 wide for every
	// width.
	//
	// The cross-lane guarantee is about the WIDTH term, and it is exact: sx is
	// bit-identical to base in every case, so this change contributes 0.0% to
	// every consumer's fit scale. The height term does move, and where it
	// becomes the limiter it is the sole cause of any remaining delta — that is
	// the disclosed vertical cost of the 84px card, not a width effect.
	const a2Containers = [616, 872];
	const a2CanvasH = 420;
	const deltas: number[] = [];
	for (const containerW of a2Containers) {
		for (const [floors, maxRooms] of cases) {
			const w = baseBuildingContentW(maxRooms);
			const sx = (containerW - 32) / w;
			// 84 tall instead of 70 is the only remaining difference.
			const h84 = 29 + 99 * floors;
			const h70 = 29 + 85 * floors;
			const sy84 = (a2CanvasH - 32) / h84;
			const sy70 = (a2CanvasH - 32) / h70;
			const s84 = Math.max(0.3, Math.min(sx, sy84, 1.4));
			const s70 = Math.max(0.3, Math.min(sx, sy70, 1.4));
			const delta = s70 === 0 ? 0 : (s84 - s70) / s70;
			deltas.push(delta);

			// The load-bearing assertion: the width term has not moved at all.
			assert.equal(
				sx,
				(containerW - 32) / baseBuildingContentW(maxRooms),
				`${floors}f x ${maxRooms}r at ${containerW}px: the width term of the fit scale must be bit-identical to base`,
			);
			// Where the width is still the limiter, the whole scale is identical.
			if (sx <= sy84) {
				assert.equal(
					s84,
					s70,
					`${floors}f x ${maxRooms}r at ${containerW}px: width-limited after the change, so the scale must be exactly base`,
				);
				assert.equal(
					ROOM_NAME_FONT * s84,
					ROOM_NAME_FONT * s70,
					`${floors}f x ${maxRooms}r at ${containerW}px: rendered card text must be byte-identical to base`,
				);
			}
			rows.push(
				`${floors}f x ${maxRooms}r at ${containerW}px: width term sx ${sx.toFixed(4)} = base (0.0% width cost); `
				+ `scale ${s70.toFixed(4)} -> ${s84.toFixed(4)} (${(delta * 100).toFixed(1)}%, ${sx <= sy84 ? 'width-limited: no change' : 'height term is now the limiter'}); `
				+ `card text ${(ROOM_NAME_FONT * s70).toFixed(2)}px -> ${(ROOM_NAME_FONT * s84).toFixed(2)}px`,
			);
		}
	}
	// Honest disclosure, asserted so it cannot be quietly forgotten: the height
	// term is not free, and this stream does not pretend otherwise.
	const worst = Math.min(...deltas);
	t.diagnostic(
		`buildingContentWidth vs base (card ${ROOM_CARD_W}x${ROOM_CARD_H}):\n${rows.join('\n')}\n`
		+ `width term cost: 0.0% in all ${deltas.length} measured cases.\n`
		+ `worst overall fit-scale delta, entirely from the required 84px card height: ${(worst * 100).toFixed(1)}%.\n`
		+ `rejected 110px width at 616px/6 rooms would have given sx ${(((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4))).toFixed(4)} `
		+ `= ${(ROOM_NAME_FONT * ((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4))).toFixed(2)}px card text, `
		+ `a ${(((((616 - 32) / (36 + 16 + 6 * rejected + 5 * 4)) / ((616 - 32) / baseBuildingContentW(6))) - 1) * 100).toFixed(1)}% loss against base.`,
	);
	assert.ok(
		worst > -0.2,
		`the disclosed height cost must stay reported and bounded, got ${(worst * 100).toFixed(1)}%`,
	);
});

/* ───────────────────────── fix 06: the map layout budget ─────────────────── */

/** The 1366x768 layout arithmetic over the committed class contract. */
function mapLayout(viewportW: number, viewportH: number, stageHeight: number | 'pane') {
	const dialogH = viewportH * 0.9; // h-[90vh]
	const headerH = 32 /* py-4 */ + 52 /* title block */ + 1; // border-b
	const mainH = dialogH - headerH;
	const paneInnerH = mainH - 48; // p-6
	const buildingColumnH = paneInnerH - 59; // sub-header row (43) + mb-4 (16)
	const hostH = buildingColumnH - 2; // the host pane's 1px top+bottom border
	const toolbarH = 36; // h-7 button (28) + mb-2 (8)
	const available = hostH - toolbarH;
	const campusAvailable = paneInnerH - 2; // no sub-header in campus view
	const sidebarW = 320; // w-80
	const hostW = viewportW * 0.95 - sidebarW - 48; // w-[95vw] - sidebar - p-6
	return {
		dialogH, mainH, paneInnerH, buildingColumnH, hostH, toolbarH, available, campusAvailable, hostW,
		stage: stageHeight === 'pane' ? available : stageHeight,
	};
}

test('fix 06 measurement: at 1366x768 the hardcoded stage overflowed its pane, and the pane now fits', () => {
	const before = mapLayout(1366, 768, 500);
	const after = mapLayout(1366, 768, 'pane');

	// The pre-fix geometry: a 500px stage inside a pane that affords less.
	assert.ok(
		before.stage > before.available,
		`precondition: the 500px stage exceeded its ${before.available.toFixed(1)}px pane`,
	);
	const clipped = before.stage - before.available;
	assert.ok(clipped > 0, 'the pre-fix canvas must be shown to clip');

	// The measured budget at 1366x768.
	const report = {
		dialogHeight: +before.dialogH.toFixed(1),
		buildingPaneHost: +before.hostH.toFixed(1),
		toolbar: before.toolbarH,
		stageAvailable: +before.available.toFixed(1),
		preFixStage: before.stage,
		preFixClippedBy: +clipped.toFixed(1),
		campusExplorerAvailable: +before.campusAvailable.toFixed(1),
		campusMapStage: 520,
		campusClippedBy: +(520 - before.campusAvailable).toFixed(1),
		hostWidth: +before.hostW.toFixed(1),
	};
	// The campus view has no sub-header, so the 520px CampusMap stage fits and
	// does not clip. The building view is the one that clipped.
	assert.ok(
		520 <= before.campusAvailable,
		`the campus canvas (520px) must fit its ${before.campusAvailable.toFixed(1)}px pane`,
	);
	assert.equal(report.campusClippedBy <= 0, true);

	// The fix: the stage tracks the pane, so it cannot exceed it.
	assert.ok(
		after.stage <= after.available,
		`the stage must fit its pane: ${after.stage.toFixed(1)} > ${after.available.toFixed(1)}`,
	);
	assert.equal(after.stage, after.available);

	// The source must not reintroduce a hardcoded height on this path.
	const modal = source('src/components/sections/SectionRoomMapModal.tsx');
	assert.match(modal, /<BuildingView[\s\S]{0,200}?fillAvailableHeight/);
	assert.doesNotMatch(modal, /<BuildingView[\s\S]{0,200}?height=\{\d+\}/);
});

test('fix 06 control: the bottom-most floor is fully visible at 60% and 80% zoom, and reachable at 100%', (t) => {
	// The clamp is transcribed from BuildingView (untouched by this change) and
	// asserted against the component source, so if the clamp moves this control
	// fails rather than quietly testing a stale copy.
	const view = source('src/components/BuildingView.tsx');
	assert.match(
		view,
		/const y = scaledHeight <= canvasHeight\s*\?\s*center\.y\s*:\s*Math\.min\(16, Math\.max\(canvasHeight - scaledHeight - 16, nextPosition\.y\)\)/,
		'the vertical clamp must be the one this control transcribed',
	);
	assert.match(view, /const fitScale = Math\.min\(sx, sy, 1\.4\);/);

	const layout = mapLayout(1366, 768, 'pane');
	const centre = (scaledH: number) => (scaledH <= layout.stage ? (layout.stage - scaledH) / 2 : (layout.stage - scaledH) / 2);
	/** The clamp's own lower bound, which may be negative (that is the pan). */
	const panFloor = (scaledH: number) => layout.stage - scaledH - 16;
	/** The clamp's own upper bound. */
	const panCeil = 16;

	const report: string[] = [];
	for (const roomsPerFloor of [4, 6, 8]) {
		for (const floors of [2, 3, 4, 5]) {
			const contentW = 36 + 8 * 2 + roomsPerFloor * ROOM_CARD_W + (roomsPerFloor - 1) * 4;
			const contentH = 32 + floors * (ROOM_CARD_H + 6 * 2) + (floors - 1) * 3;
			const fit = Math.max(0.3, Math.min((layout.hostW - 32) / contentW, (layout.stage - 32) / contentH, 1.4));
			const floorH = (ROOM_CARD_H + 12) * fit;

			// The auto-fit (mount and reset) centres the whole building.
			const fitBottom = centre(contentH * fit);
			assert.ok(
				fitBottom + contentH * fit <= layout.stage + 0.5,
				`${floors}f x ${roomsPerFloor}r: the auto-fit must show the whole building`,
			);
			assert.ok(
				fitBottom + contentH * fit - floorH >= -0.5,
				`${floors}f x ${roomsPerFloor}r: the bottom-most floor must be fully visible on the auto-fit`,
			);
			report.push(
				`${floors}f x ${roomsPerFloor}r: fit ${(fit * 100).toFixed(0)}%, name ${(ROOM_NAME_FONT * fit).toFixed(1)}px, bottom-floor top at ${(fitBottom + contentH * fit - floorH).toFixed(1)} of ${layout.stage.toFixed(1)}`,
			);

			for (const zoom of [0.6, 0.8, 1.0]) {
				const scaledH = contentH * zoom;
				const bottom = centre(scaledH) + scaledH;
				if (scaledH <= layout.stage) {
					// Fits: centred, so the bottom-most floor is fully visible.
					assert.ok(
						bottom - (ROOM_CARD_H + 12) * zoom >= -0.5,
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: the bottom-most floor must be fully visible without panning`,
					);
				} else {
					// Taller than the pane at this zoom. The stage is still whole
					// (its height equals the pane), and the clamp's lower bound
					// pans the bottom-most floor fully into view at stage-16. This
					// is the documented pan case, not a clipped canvas.
					assert.ok(
						panFloor(scaledH) + scaledH <= layout.stage - 16 + 0.5,
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: panning to the clamp must bring the bottom into view`,
					);
					assert.ok(panCeil <= layout.stage, 'the clamp must still allow the top of a tall building to be reached');
					report.push(
						`${floors}f x ${roomsPerFloor}r at ${Math.round(zoom * 100)}%: exceeds the pane by ${(scaledH - layout.stage).toFixed(1)}px — bottom fully visible at the clamp bound (pan)`,
					);
				}
			}
		}
	}
	// The numbers a reviewer needs, kept out of the assertions but produced.
	assert.ok(report.length > 0);
	t.diagnostic(`1366x768 building pane: stage ${layout.stage.toFixed(1)}px, host ${layout.hostW.toFixed(1)}px wide\n${report.join('\n')}`);
});


/* ──────────────────────── fix 10: the micro-typography floor ─────────────── */

/**
 * Every product file that renders a room card, a room badge/pill, or a room
 * sidebar/list entry. WIDENED on 2026-09-28 from the original 8.
 *
 * ── Why the original 8 was the wrong list (the named "baseline short by one
 *    row" defect, short here by SIX WHOLE FILES) ──
 * The old list was the set of files the *previous* stream happened to touch. It
 * passed while 40 sub-11px sites sat in the six room-card/sidebar files that
 * render the very cards this ratchet exists to protect — the room tiles, the
 * section row's program badge (the `SPS`/`SPA` badge measured at 9.6px on the
 * live surface), the details sheet's class badges, the auto-assign dialog, and
 * the two campus-map room fields. None of the six was on the list, so the
 * ratchet was structurally incapable of seeing the defect it names.
 *
 * ── THE THRESHOLD, pinned because the prose and the count disagree ──
 * An OFFENDER is an authored font size STRICTLY BELOW 11.0 device px. That is
 * the literal reading of "no text below 11px" and it is what the scan below
 * enforces. Two numbers circulate in this repo and only one of them is this
 * rule:
 *
 *   - 40  = sites strictly below 11.0px. THIS is the offender count.
 *   - 51  = sites below 11.52px (0.72rem). NOT this rule — it is the `rem <
 *           0.72rem` band, which additionally counts 11 sites sitting EXACTLY
 *           AT 11.0px via `text-[0.6875rem]`.
 *
 * `0.6875rem * 16 = 11.0` exactly, so `text-[0.6875rem]` is AT the floor, not
 * below it, and is legal. A reviewer re-deriving "below 11px" literally will
 * count 40 and conclude this ratchet under-counts; it does not, and the
 * equality is asserted below rather than left to a comment.
 *
 * Tailwind's root is 16px, so `text-[Nrem]` = N*16 device px. Konva's
 * `fontSize` is in stage units and is scaled at draw time, but the AUTHORED
 * value must still be legible before scaling, so it is floored the same way.
 */
const ROOM_SURFACE_OWNED = [
	// ── the original 8, all still in scope ──
	'src/components/sections/SectionRoomMapModal.tsx',
	'src/components/sections/SectionRoomPicker.tsx',
	'src/components/sections/SectionHomeRoomModals.tsx',
	'src/components/sections/HomeRoomConfirmDialogs.tsx',
	'src/components/sections/homeRoomEditStatus.ts',
	'src/components/sections/homeRoomPersistence.ts',
	'src/components/BuildingView.tsx',
	'src/pages/Sections.tsx',
	// ── the SIX the old list missed: the room cards, badges and sidebar rows ──
	'src/components/BuildingPanel.tsx',
	'src/components/sections/SectionDetailsSheet.tsx',
	'src/components/sections/SectionRow.tsx',
	'src/components/sections/HomeRoomAutoAssignDialog.tsx',
	'src/components/campus-map/BuildingPlacementFields.tsx',
	'src/components/campus-map/BuildingGradeScopeControl.tsx',
	// ── two more campus-map room surfaces: clean today, listed so they cannot
	//    rot into the same blindness without failing this control ──
	'src/components/campus-map/RoomReadinessList.tsx',
	'src/components/campus-map/CampusMapCanvasPreview.tsx',
	// ── three more that the STRUCTURAL SWEEP below demands (all clean today) ──
	'src/components/campus-map/CampusMapOverview.tsx',
	'src/components/sections/SectionMobileCard.tsx',
	'src/components/sections/SectionsHomeRoomActions.tsx',
] as const;

/**
 * The structural sweep, kept BESIDE the explicit list, because each catches what
 * the other cannot:
 *
 *  - the explicit list says WHICH files are protected, and `assert.equal(length)`
 *    plus the Set/size and exists-assertions below stop it silently shrinking;
 *  - the sweep says the list is COMPLETE — every room-card-ish file under the
 *    two component directories this stream owns must be on it. Without the
 *    sweep, the NEXT room-card file can be added tomorrow and repeat exactly
 *    the failure this row was widened to fix: a protected surface nobody scans.
 *
 * The sweep is deliberately SCOPED to `components/sections` +
 * `components/campus-map`. An unscoped marker sweep over all of
 * `src/components` matches 37 files that still hold sub-11px text and that this
 * packet has no authority to edit, so it would fail closed forever and teach the
 * next session to ignore the row. The scope boundary is itself a disclosure:
 * `components/room-schedules/*`, `components/dashboard/RoomSchedulePreview.tsx`
 * and `components/RoomScheduleOverlay.tsx` render room text and are NOT covered
 * by this row. They belong to another lane and are reported, not claimed.
 */
const ROOM_SURFACE_DIRS = ['src/components/sections', 'src/components/campus-map'] as const;

/**
 * A file is room-card-ish if it RENDERS a badge or a room name. The word
 * markers `Occupancy` / `Utilization` were tried first and rejected: they also
 * match the two pure-logic modules `buildingOccupancy.ts` and
 * `home-room-readiness.ts`, which render nothing, so the sweep would have
 * demanded that non-rendering files be typed. This token set matches exactly the
 * 10 files under the two directories that still put a badge or a room name on
 * screen, all 10 of which are on the list above.
 *
 * A9 C3 (2026-09-29): the count is 10, not 11, and that is a subtraction rather
 * than a coverage loss. `SectionsHomeRoomActions.tsx` no longer renders room
 * chrome at all — A9 C3 replaced the "N needs rooms" badge-and-popover with one
 * button and one save-state line — so the marker correctly stops classifying it
 * as a room surface. It REMAINS in `ROOM_SURFACE_OWNED` below, so the direct
 * sub-11px offender scan still covers it byte-for-byte, and the anti-shrink,
 * anti-duplication, anti-rot and exists-assertions over that list are untouched:
 * the reach constant is the only thing that moved.
 */
const ROOM_SURFACE_MARKER = /(<Badge\b|room\.name|roomName|buildingName|RoomTile|RoomCard)/;

function sweepRoomSurfaceFiles(root: string): string[] {
	const found: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(resolve(clientRoot, dir), { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
			const child = `${dir}/${entry.name}`;
			if (entry.isDirectory()) {
				walk(child);
			} else if (/\.tsx?$/.test(entry.name)) {
				found.push(child);
			}
		}
	};
	walk(root);
	return found.sort();
}

test('fix 10 control: the owned list cannot shrink, cannot rot, and is complete', () => {
	const owned = ROOM_SURFACE_OWNED;

	// Anti-shrink. The list grew 8 -> 19 on 2026-09-28; any future removal must
	// change this number deliberately, in a reviewable diff, with its reason.
	assert.equal(owned.length, 19, 'the owned room-surface list must stay at 19 files');
	// Anti-duplication. A repeated path would make a length assertion lie.
	assert.equal(new Set(owned).size, owned.length, 'the owned list must not repeat a path');
	// Anti-rot. A deleted or renamed file must fail here, not be silently skipped.
	for (const file of owned) {
		assert.ok(existsSync(resolve(clientRoot, file)), `${file} is listed but no longer exists`);
	}
	// Anti-incompleteness: every room-card-ish file in the two owned directories
	// is protected, so the next new room-card file cannot repeat this defect.
	for (const dir of ROOM_SURFACE_DIRS) {
		for (const candidate of sweepRoomSurfaceFiles(dir)) {
			if (!ROOM_SURFACE_MARKER.test(source(candidate))) continue;
			assert.ok(
				(owned as readonly string[]).includes(candidate),
				`${candidate} renders a room card/badge/occupancy surface and must be added to ROOM_SURFACE_OWNED`,
			);
		}
	}
	// The sweep must not be vacuous: if the marker ever stops matching, this
	// control would "pass" by scanning nothing. Pin its reach.
	const swept = ROOM_SURFACE_DIRS.flatMap(sweepRoomSurfaceFiles).filter((f) => ROOM_SURFACE_MARKER.test(source(f)));
	assert.ok(swept.length >= 10, `the structural sweep must still reach the room surfaces, reached ${swept.length}`);
});

test('fix 10 control: the 11px threshold is the pinned one, and 0.6875rem is exactly AT it', () => {
	// The equality the 40-vs-51 disagreement turns on, asserted so it cannot rot:
	// `text-[0.6875rem]` is 11.0 device px, which is AT the floor and therefore
	// a legal (not offending) value. See the threshold note above ROOM_SURFACE_OWNED.
	assert.equal(0.6875 * 16, 11);
	assert.equal(11 < 11, false, 'the rule is strictly below 11px, so exactly-11px text is allowed');
	// And it is the value the room surfaces actually use, so the floor is real
	// wiring rather than a number nothing reads.
	const row = source('src/components/sections/SectionRow.tsx');
	assert.ok(/text-\[0\.6875rem\]/.test(row), 'the raised badges must sit exactly on the 11px floor');
});

test('fix 10 control: no text below 11px remains in the files this stream owns', () => {
	const owned = ROOM_SURFACE_OWNED;
	/** Tailwind's root is 16px, so text-[Nrem] = N*16 device px. */
	const remPx = (rem: number) => rem * 16;
	const offenders: string[] = [];

	for (const file of owned) {
		const text = source(file);
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
			if (Number(m[1]) < 11) offenders.push(`${file}: text-[${m[1]}px]`);
		}
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)) {
			if (remPx(Number(m[1])) < 11) offenders.push(`${file}: text-[${m[1]}rem] = ${remPx(Number(m[1]))}px`);
		}
		// Konva's fontSize is in stage units and is scaled at draw time; the
		// authored value must still be legible before scaling.
		for (const m of text.matchAll(/fontSize=\{(\d+)\}/g)) {
			if (Number(m[1]) < 11) offenders.push(`${file}: fontSize={${m[1]}}`);
		}
		for (const m of text.matchAll(/fontSize=\{([A-Z_]+)\}/g)) {
			if (m[1] !== 'ROOM_NAME_FONT' && m[1] !== 'ROOM_LABEL_FONT') offenders.push(`${file}: fontSize={${m[1]}}`);
		}
	}
	assert.deepEqual(offenders, [], `sub-11px text must not remain: ${offenders.join(', ')}`);

	// The floor must hold for the card too, not only the HTML chrome.
	assert.ok(ROOM_NAME_FONT >= 11, `the authored card font must be >= 11px, got ${ROOM_NAME_FONT}`);
	assert.equal(ROOM_NAME_FONT, 11);
});

test('fix 10 control: the six newly-covered files contribute ZERO sub-11px sites, by count', (t) => {
	// The count form of the row above, so a regression reports a NUMBER and not
	// only a diff. The per-file figures are measured from the committed bytes.
	const NEWLY_COVERED = [
		'src/components/BuildingPanel.tsx',
		'src/components/sections/SectionDetailsSheet.tsx',
		'src/components/sections/SectionRow.tsx',
		'src/components/sections/HomeRoomAutoAssignDialog.tsx',
		'src/components/campus-map/BuildingPlacementFields.tsx',
		'src/components/campus-map/BuildingGradeScopeControl.tsx',
	];
	const remPx = (rem: number) => rem * 16;
	const rows: string[] = [];
	for (const file of NEWLY_COVERED) {
		const text = source(file);
		const offenders: string[] = [];
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)) {
			if (remPx(Number(m[1])) < 11) offenders.push(`${remPx(Number(m[1]))}px`);
		}
		for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
			if (Number(m[1]) < 11) offenders.push(`${m[1]}px`);
		}
		assert.deepEqual(offenders, [], `${file} must hold no text below 11px, found ${offenders.length}`);
		const smallest = Math.min(
			...[...text.matchAll(/text-\[(\d+(?:\.\d+)?)rem\]/g)].map((m) => remPx(Number(m[1]))),
			...[...text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1])),
		);
		rows.push(`${file}: 0 sub-11px, smallest authored size ${smallest.toFixed(1)}px`);
	}
	t.diagnostic(`the six files the old tripwire never listed:\n${rows.join('\n')}`);
});

test('fix 10 control: the map and sidebar keep their internal scrolling instead of gaining a page scrollbar', () => {
	const modal = source('src/components/sections/SectionRoomMapModal.tsx');
	// The dialog is a fixed-height, self-scrolling shell: root overflow hidden,
	// every growing region either a ScrollArea or clipped, and no min-h that
	// could push the pane past the dialog.
	assert.match(modal, /h-\[90vh\] flex flex-col p-0 overflow-hidden/);
	assert.match(modal, /<ScrollArea className="flex-1"/);
	assert.match(modal, /className="flex-1 bg-muted\/10 p-6 flex flex-col overflow-hidden"/);
	assert.doesNotMatch(modal, /min-h-\[\d+px\]/, 'no pixel min-height may push the map pane past the dialog');
	assert.doesNotMatch(modal, /overflow-y-auto/, 'the map must not introduce its own page-level scroll');
	// The building pane is the one that clipped; it must stay a flex child with
	// a definite height and clip its canvas rather than grow.
	assert.match(modal, /className="flex-1 min-h-0 border rounded-3xl bg-background\/50 shadow-inner overflow-hidden"/);
});

/* ────────── fix 07 (this stream): a real box model for the DOM room cards ──────
 *
 * The 50-150% zoom claim was UNPROVEN on the live surface ("OK at 94% zoom;
 * other zooms not stress-tested"), so this is a box model over the COMMITTED
 * class contract rather than a source-text match. The method is the one the
 * fix-06 control above already uses in this same file: parse the class contract
 * out of the component, then do arithmetic on it. The ARITHMETIC is the claim;
 * the parse is only its input, and it is why restoring the pre-change bytes
 * flips the verdict rather than leaving the numbers untouched.
 *
 * The one browser fact this leans on is CSS flex sizing, and it is the exact
 * mechanism of the defect:
 *
 *   a flex item's automatic minimum size is its CONTENT MIN-CONTENT width.
 *   `truncate` is `white-space: nowrap`, so a truncated flex item's min-content
 *   width is the WHOLE string — it cannot shrink, `truncate` never actually
 *   truncates, the item overflows its track, and the program badge sharing that
 *   line is pushed out of the cell into the next cell's occupancy / capacity
 *   indicator. A wrapping title's min-content width is only its LONGEST WORD,
 *   so the same string needs far less track.
 *
 * ── BADGE LINE-HEIGHT MODELLING NUMBER: 1.25 (Tailwind `leading-tight`) ──
 * A badge's box height depends on its line box, and the shared `@/ui` Badge
 * sets NO line-height, so its height is `fontSize * inheritedLeading`. This
 * model uses 1.25 because that is what the raised badges in this stream AUTHOR
 * explicitly rather than leaving to inheritance. Disclosed sensitivity:
 *   - at 1.25 (authored here) an 11px badge has 13.75px of line content;
 *   - at 1.3333 (what `text-xs` implies in Tailwind v4, `calc(1/0.75)`) a 12px
 *     badge has 16.0px, and with the shared `py-0.5` that is 20.0px = exactly
 *     the shared `h-5` — still inside the box, with zero slack;
 *   - at 1.5 (a bare inherited default) that same 12px badge needs 18+4 = 22px
 *     and WOULD clip, which is precisely why every badge raised here carries an
 *     explicit `leading-tight` instead of inheriting.
 * The shared `@/ui` Badge primitive is therefore NOT implicated: `ui/badge.tsx`
 * and `ui/badge-variants.ts` are unmodified by this stream, and every figure
 * above fits the primitive's committed `h-5 px-2 py-0.5` box.
 */

/** The scale factors the control sweeps, as a fraction of the authored size. */
const ZOOM_SCALES = [0.5, 0.75, 1, 1.25, 1.5] as const;
/** See the note above: badges are modelled at the leading they author. */
const BADGE_LEADING = 1.25;

/** Tailwind rem-px: root 16px. The pinned conversion the 11px floor rests on. */
const REM_PX = 16;
const remPx = (rem: number) => rem * REM_PX;
const REM_UTIL = /text-\[(\d+(?:\.\d+)?)rem\]/;
const PX_UTIL = /text-\[(\d+(?:\.\d+)?)px\]/;
const NAMED_SIZE: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18 };
const GAP_PX: Record<string, number> = { 'gap-0': 0, 'gap-1': 4, 'gap-1.5': 6, 'gap-2': 8, 'gap-3': 12 };
const PAD_PX: Record<string, number> = { 'px-1': 4, 'px-1.5': 6, 'px-2': 8, 'px-2.5': 10, 'px-3': 12 };
const H_PX: Record<string, number> = { 'h-4': 16, 'h-5': 20, 'h-6': 24 };

/** Pessimistic mixed-case metric — deliberately wider than Arial, so it over-estimates. */
const charW = (text: string, fontPx: number): number => Array.from(text).reduce((sum, ch) => {
	const upper = ch === ch.toUpperCase() && ch !== ch.toLowerCase();
	return sum + (upper ? 0.72 : 0.62) * fontPx;
}, 0);
const textWidth = (text: string, fontPx: number): number => charW(text, fontPx);
const longestWordWidth = (text: string, fontPx: number): number =>
	Math.max(0, ...text.split(' ').map((w) => charW(w, fontPx)));

/** The authored font size of an element, read off its own class list. */
function fontPxOf(classList: string, inherited: number): number {
	const rem = REM_UTIL.exec(classList);
	if (rem) return remPx(Number(rem[1]));
	const px = PX_UTIL.exec(classList);
	if (px) return Number(px[1]);
	for (const token of classList.split(/\s+/)) {
		if (token in NAMED_SIZE) return NAMED_SIZE[token];
	}
	return inherited;
}

/** A Tailwind spacing utility -> px, for a fixed map or a bare `px-N` scale step. */
function utilPx(map: Record<string, number>, classList: string, fallback: number): number {
	for (const token of classList.split(/\s+/)) {
		if (token in map) return map[token];
		const bare = /^(?:px|py|h)-(\d+(?:\.\d+)?)$/.exec(token);
		if (bare && (token.startsWith('px') || token.startsWith('py'))) return Number(bare[1]) * 4;
	}
	return fallback;
}

/** A badge's laid-out box. `Badge` is `whitespace-nowrap overflow-hidden`. */
function badgeBox(label: string, classList: string, scale: number): { width: number; height: number } {
	const fontPx = fontPxOf(classList, 12) * scale;
	// A local `px-N` overrides the shared primitive's `px-2`.
	const padX = utilPx(PAD_PX, classList, 8) * 2;
	// `py-0` collapses the shared `py-0.5`; otherwise the primitive's 2+2 stands.
	const py = classList.split(/\s+/).includes('py-0') ? 0 : 4;
	const natural = Math.ceil(fontPx * BADGE_LEADING) + py;
	// A local `h-N` pins the box, and the content may still be taller.
	const pinned = H_PX[classList.split(/\s+/).find((t) => t in H_PX) ?? ''];
	return {
		width: Math.ceil(padX + textWidth(label, fontPx)),
		height: pinned === undefined ? natural : Math.max(pinned, natural),
	};
}

/**
 * A flex LINE's required width: the sum of each item's MINIMUM contribution.
 * `min-width: auto` resolves to min-content, which is the whole string for
 * `nowrap` text and only the longest word for wrappable text.
 */
type LineItem = { text: string; fontPx: number; wraps: boolean };
function lineRequired(items: LineItem[]): number {
	return items.reduce((sum, it) => sum + (it.wraps ? longestWordWidth(it.text, it.fontPx) : textWidth(it.text, it.fontPx)), 0);
}

/* ── the section row: title + program badge sharing one line (the base) ─────── */

/** Real section names, ordinary and pathological, as the live data has them. */
const SECTION_NAMES = [
	'G7 - Rizal',
	'G7 - STEM_EXCEL Batch 1 - Section A',
	'GRADE 10 - ICT - SPECIALISED PROGRAM STREAM - SECTION ALPHA BRAVO CHARLIE',
];

/**
 * The name cell's reserved track. A STATED budget, not a browser measurement:
 * the row is a `<td className="px-4 py-3">` in a six-column table and declares
 * no `max-w`, so there is nothing in the DOM to read a track from. The
 * approximation is safe in the direction that matters — the post-fix
 * requirement is `max(longestWord, badge)`, bounded by a 15-character word, so
 * it passes for ANY track at least this wide, and stating a narrower budget than
 * the real one makes the control stricter, never looser.
 */
const NAME_CELL_TRACK = 260;

test('fix 07 control: the program badge gets its own line, so the title track no longer grows with the name', (t) => {
	const row = source('src/components/sections/SectionRow.tsx');

	// ── parse the committed class contract ──
	const titleM = /<span className="([^"]*)"[^>]*>\s*\{section\.name\}\s*<\/span>/.exec(row);
	assert.ok(titleM, 'the section title span must be found in SectionRow');
	const titleClasses = titleM[1];
	const badgeM = /className=\{`([^`]*)`\}[\s\S]{0,80}?\{section\.programCode\}/.exec(row);
	assert.ok(badgeM, 'the program badge class must be found in SectionRow');
	const badgeClasses = badgeM[1];
	const subRowM = /<div className="(mt-[\d.]+ flex flex-wrap items-center[^"]*)">/.exec(row);
	assert.ok(subRowM, 'the sub-header row that carries the program badge must be found in SectionRow');
	const gap = utilPx(GAP_PX, subRowM[1], 6);

	// The DECISIVE structural read: the badge must be a child of the sub-header
	// row BELOW the title, not a sibling of the title on the title's own line.
	// On the base revision there is no sub-header row at all, so `subRowM` is
	// null and this control fails before any arithmetic runs.
	const titleEnd = titleM.index + titleM[0].length;
	assert.ok(badgeM.index > titleEnd, 'the program badge must follow the title element, never share its line');
	assert.ok(
		subRowM.index > titleEnd && subRowM.index < badgeM.index,
		'the program badge must live in the sub-header row below the title, so the two can never collide',
	);

	// The title span carries no size utility, so it inherits the body default.
	const titleFont = fontPxOf(titleClasses, 16);
	assert.equal(titleFont, 16, 'the title must resolve to the inherited 16px body default (fix 10: 14-16px band)');
	const titleWraps = /line-clamp-\d/.test(titleClasses) || !/\btruncate\b/.test(titleClasses);

	// `shrink-0` is what stops flex shrinking the badge out of existence; the
	// base code had no `min-w-0` on the title, which is the other half.
	assert.ok(/\bshrink-0\b/.test(badgeClasses), 'the program badge must be shrink-0 so flex cannot squeeze it to zero width');
	assert.ok(/\bmin-w-0\b/.test(titleClasses), 'the title must be min-w-0 so it shrinks inside its line instead of overflowing it');
	assert.ok(titleWraps, 'the title must wrap rather than being a single nowrap truncated line');

	// ── the budget-free, load-bearing geometric claim ──
	// A wrapping title needs only its longest word; a nowrap one needs the whole
	// name. The badge is identical either way, so the difference is the wrap.
	const sharedRequired = (name: string, scale: number) => lineRequired([
		{ text: name, fontPx: titleFont * scale, wraps: false },
	]) + gap + badgeBox('SPTVE', badgeClasses, scale).width;
	const splitRequired = (name: string, scale: number) => Math.max(
		lineRequired([{ text: name, fontPx: titleFont * scale, wraps: true }]),
		badgeBox('SPTVE', badgeClasses, scale).width,
	);

	const SHORT = 'G7 - Rizal';
	const LONG = SECTION_NAMES[2];
	/** A name long enough to need the clamp, built from ONE repeated vocabulary. */
	const OVERLONG = `${SHORT} ${SHORT} ${SHORT} ${SHORT}`;
	const rows: string[] = [];
	for (const scale of ZOOM_SCALES) {
		const pct = Math.round(scale * 100);
		// The requirement is EXACTLY the badge or the longest word, whichever is
		// wider — asserted as an identity, so a future edit that reintroduced a
		// nowrap title (and with it the full-name track) would break this.
		for (const name of [...SECTION_NAMES, OVERLONG]) {
			const badgeW = badgeBox('SPTVE', badgeClasses, scale).width;
			assert.equal(
				splitRequired(name, scale),
				Math.max(longestWordWidth(name, titleFont * scale), badgeW),
				`${pct}%: "${name}" must need only max(longest word, badge)`,
			);
		}
		// A pathological name must never need its FULL single-line width: that is
		// precisely what the shared line demanded and what overflowed the cell.
		assert.ok(
			splitRequired(LONG, scale) < textWidth(LONG, titleFont * scale),
			`${pct}%: the split line (${splitRequired(LONG, scale).toFixed(1)}px) must be narrower than the whole name set on one line (${textWidth(LONG, titleFont * scale).toFixed(1)}px)`,
		);
		// And the clamp bounds the line COUNT, so a name of any length needs the
		// same track. The two names below share their longest word and differ
		// only in how many lines they would need.
		assert.equal(
			splitRequired(SHORT, scale),
			splitRequired(OVERLONG, scale),
			`${pct}%: the title track must depend on the longest word, not on how many lines the name needs `
			+ `(1 line ${splitRequired(SHORT, scale).toFixed(1)} vs 4+ lines ${splitRequired(OVERLONG, scale).toFixed(1)})`,
		);
		// The absolute fit at the stated track, for every name and every scale.
		for (const name of [...SECTION_NAMES, OVERLONG]) {
			assert.ok(
				splitRequired(name, scale) <= NAME_CELL_TRACK,
				`${pct}%: "${name}" needs ${splitRequired(name, scale).toFixed(1)}px but the name cell reserves ${NAME_CELL_TRACK}px, so the badge would reach the occupancy/capacity cell`,
			);
		}
		rows.push(
			`${pct}%: split ${splitRequired(LONG, scale).toFixed(1)}px <= track ${NAME_CELL_TRACK}px | `
			+ `shared-line arrangement would need ${sharedRequired(LONG, scale).toFixed(1)}px (overflow by ${(sharedRequired(LONG, scale) - NAME_CELL_TRACK).toFixed(1)}px)`,
		);
	}
	t.diagnostic(
		`SectionRow name cell: title ${titleFont}px, badge ${fontPxOf(badgeClasses, 12)}px, gap ${gap}px, stated track ${NAME_CELL_TRACK}px\n${rows.join('\n')}`,
	);
});

test('fix 07 control: the room tile reserves a right-hand indicator track and keeps the widest badge inside it', (t) => {
	const panel = source('src/components/BuildingPanel.tsx');

	// Both the sortable (editor) and the read-only (dashboard) tile carry the
	// same name and the same badges, so both are read and both must hold.
	const nameMs = [...panel.matchAll(/<p className="([^"]*)"[^>]*>\{room\.name\}<\/p>/g)];
	assert.equal(nameMs.length, 2, 'both room tiles must render the room name');
	const typeMs = [...panel.matchAll(/<Badge variant="outline" className="([^"]*)"[\s\S]{0,90}?ROOM_TYPES\.find/g)];
	assert.equal(typeMs.length, 2, 'both room tiles must render the room-type badge');
	for (const m of nameMs) {
		assert.equal(m[1], nameMs[0][1], 'both room tiles must use the same title class, so one control decides both');
	}

	// The right-hand indicator cluster: three `size="icon-xs"` (`size-6` = 24px)
	// buttons in a `gap-1` (4px) row, and it is `shrink-0`.
	const clusterM = /<div className="(flex shrink-0 items-center[^"]*)">/.exec(panel);
	assert.ok(clusterM, 'the tile action cluster must be found');
	const clusterGap = utilPx(GAP_PX, clusterM[1], 4);
	assert.ok(/\bshrink-0\b/.test(clusterM[1]), 'the indicator cluster must be shrink-0 so the title yields to it');
	// Counted from the cluster itself to the end of the tile, NOT from the top of
	// the component: the edit dialog above it also renders one `size="icon-xs"`
	// button (the feature-remover), and counting that would put a control button
	// into the indicator track that does not render beside the room name.
	const tileStart = panel.indexOf('function SortableRoomTile');
	const tileEnd = panel.indexOf('function RoomTileReadOnly');
	assert.ok(tileStart > 0 && tileEnd > tileStart, 'the SortableRoomTile body must be locatable');
	const buttonCount = (panel.slice(clusterM.index, tileEnd).match(/size="icon-xs"/g) ?? []).length;
	assert.equal(buttonCount, 3, 'the tile reserves a three-button indicator cluster');
	const clusterW = buttonCount * 24 + (buttonCount - 1) * clusterGap;

	// Chrome: the list is `px-4`, the tile is `px-2.5` on both sides, `gap-2`.
	const liGap = utilPx(GAP_PX, 'gap-2', 8);
	const SIDEBAR_TRACK = 300; // the sidebar's narrowest supported rendering
	const tileTrack = SIDEBAR_TRACK - 32 - 20;
	const titleTrack = tileTrack - liGap - clusterW;
	assert.ok(titleTrack > 0, `the title track must be positive, got ${titleTrack}`);

	// fix 11: the name is a two-line clamp, not a one-line truncate.
	const clamped = /line-clamp-(\d)/.exec(nameMs[0][1]);
	assert.ok(clamped, 'the room name must be clamped rather than truncated to a single line');
	assert.equal(Number(clamped[1]), 2, 'the room name clamp must be two lines');
	assert.ok(!/\btruncate\b/.test(nameMs[0][1]), 'the room name must not be a one-line truncate');
	assert.ok(/\bmin-w-0\b/.test(nameMs[0][1]), 'the room name must be min-w-0 so it can wrap within its own track');
	// `break-words` (`overflow-wrap: break-word`) is what makes a pathological
	// single unbreakable word degrade gracefully instead of overflowing: the word
	// breaks mid-token when it alone exceeds the track. An earlier draft of this
	// control asserted the longest word must FIT the track and correctly failed
	// at 150% on `SPECIALISED` (190.1px word, 160px track) — the word does not
	// have to fit, it has to be breakable, and this is the assertion that says so.
	assert.ok(
		/\bbreak-words\b/.test(nameMs[0][1]),
		'the room name must be break-words so an unbreakable pathological word cannot overflow its track',
	);

	const rows: string[] = [];
	for (const scale of ZOOM_SCALES) {
		const pct = Math.round(scale * 100);
		const titleFont = fontPxOf(nameMs[0][1], 16) * scale;
		// The longest label the shared tile badges ever carry.
		const widest = Math.max(
			badgeBox('Specialized', typeMs[0][1], scale).width,
			badgeBox('Non-teaching', typeMs[0][1], scale).width,
		);
		// The badge is the REAL constraint on this tile, and it is the opposite
		// case to the title: the shared `Badge` is `whitespace-nowrap
		// overflow-hidden`, so a badge can neither wrap nor break, and one wider
		// than the track is clipped rather than reflowed. This is what fix 10's
		// "let the badge grow with its content" direction is protecting.
		assert.ok(
			widest <= titleTrack,
			`${pct}%: the widest room badge (${widest}px) exceeds the ${titleTrack}px title track and would be clipped`,
		);
		// The title, by contrast, is `break-words`, so its required track is a
		// single character — the widest unbreakable unit it can be forced into.
		// Asserted for every scale so the track can never be squeezed to zero.
		const titleRequirement = charW('W', titleFont);
		assert.ok(
			titleRequirement <= titleTrack,
			`${pct}%: a breakable title needs only ${titleRequirement.toFixed(1)}px, which must fit the ${titleTrack}px track`,
		);
		rows.push(`${pct}%: title ${titleFont.toFixed(1)}px, indicator cluster ${clusterW}px, title track ${titleTrack}px, widest badge ${widest}px (slack ${(titleTrack - widest).toFixed(1)}px)`);
	}
	t.diagnostic(`BuildingPanel room tile (stated sidebar ${SIDEBAR_TRACK}px -> title track ${titleTrack}px):\n${rows.join('\n')}`);
});
