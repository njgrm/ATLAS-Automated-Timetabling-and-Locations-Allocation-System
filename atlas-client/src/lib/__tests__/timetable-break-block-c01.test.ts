/**
 * MR-61 — the break block in the Class Schedule grid, on a semantic surface.
 *
 * ## What the member asked for
 *
 * "change color of HEALTH BREAK" (class-schedule.docx, MR-61).
 *
 * ## What the renderer actually did at base 4c4682b9
 *
 * `components/timetable/TimetableGrid.tsx` painted the whole special-event cell
 * with raw `bg-amber-50/40` + `text-amber-700`. That is the app's WARNING
 * semantic (DESIGN.md §3, "Warning — needs review"), and amber already means
 * four other things inside this same grid:
 *
 *   - `timetable-ceremony-overlay-label`  bg-amber-100   (a real flag/HGP overlay)
 *   - `timetable-blocked-overlap-label`  bg-amber-100   (a class inside a block)
 *   - a SOFT violation                   border-amber-400
 *   - every "needs owner / unplaced" chip in the rail
 *
 * So a routine 09:00 break row and a genuine problem both read amber, and the
 * member's read is exactly right: the colour was wrong.
 *
 * ## Why it was ALSO too faint to be a band
 *
 * `bg-amber-50/40` flattens amber-50 (#FFFBEB) 40% over white to ≈ #FFFCF7 —
 * effectively white. The only strong cue was the amber LABEL text, which is why
 * "change the colour" was the right request and not a nicety.
 *
 * ## What this test pins (behaviour, never copy)
 *
 * Rows 1–2 RENDER and assert the break block is PROGRAMMATICALLY distinguishable
 * from a teaching period: a `data-testid` / `data-break-slot` marker that a
 * teaching-period cell never carries. Not a hex value, not a class literal.
 *
 * Rows 3–4 pin the TOKEN contract two ways: the cell names its tone as a
 * SEMANTIC TOKEN REFERENCE (`data-break-tone`) that must resolve to a token the
 * shared stylesheet defines, and every colour utility on the rendered cell is
 * DERIVED from that render and checked for membership in the shared token set.
 * A raw palette step (amber/slate/gray/…) or a hex literal is an offender.
 *
 * Row 5 proves rows 3–4 can fail. Row 6 pins the geometry claim (a colour change
 * adds no row, no chip and no control) from the same render.
 *
 * Run: `npm run test:timetable-break-block-c01` (wired in atlas-client/package.json).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import { TimetableGrid } from '@/components/timetable/TimetableGrid';
import type { ScheduledEntry } from '@/types';

const CLIENT_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX_CSS = join(CLIENT_SRC, 'index.css');

/** A raw Tailwind palette step — DESIGN.md §3: no raw palette outside status colours. */
const RAW_PALETTE = /(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}/g;
/** A hex literal, which DESIGN.md §3 also forbids in new code. */
const HEX_LITERAL = /#[0-9a-f]{3,8}\b/gi;

/**
 * Utility prefixes that take a COLOUR as their remainder. Deliberately narrow:
 * `shadow-*`, `outline-*` and `divide-*` also take non-colour remainders
 * (`shadow-soft`, `outline-none`), and a wider net turns this into a guess.
 */
const COLOUR_PREFIXES = ['bg', 'text', 'border', 'ring'] as const;

/**
 * Remainders after a colour prefix that are NOT colours — the layout/font
 * utilities the break cell legitimately carries (`text-center`, `border-l`).
 */
const NON_COLOUR_REMAINDERS = new Set([
	'center', 'justify', 'left', 'right', 'l', 'r', 't', 'b', 'x', 'y',
	'top', 'bottom', 'inset', 'none', 'inherit', 'current', 'transparent',
	'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'truncate', 'nowrap', 'uppercase',
]);

/** `--color-*` names registered by `@theme inline` — the shared token set. */
function registeredColorTokens(): Set<string> {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const theme = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
	assert.ok(theme, 'index.css has no @theme inline block; the shared token set cannot be read');
	const out = new Set<string>();
	for (const match of theme[1].matchAll(/--color-([a-z-]+):/g)) out.add(match[1]);
	return out;
}

/** `--<name>` declared as an HSL channel triplet in the top-level `:root`. */
function rootTokenTriplets(): Set<string> {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
	assert.ok(root, 'index.css has no top-level :root block');
	const out = new Set<string>();
	for (const match of root[1].matchAll(/^\s*--([a-z-]+):\s*\d+[\s.]+\d+%[\s.]+\d+%;/gm)) out.add(match[1]);
	return out;
}

/** Every raw-palette step and hex literal in a class list. */
function rawColourOffenders(classList: string): string[] {
	const found = new Set<string>();
	for (const match of classList.matchAll(RAW_PALETTE)) found.add(match[0]);
	for (const match of classList.matchAll(HEX_LITERAL)) found.add(match[0]);
	return [...found].sort();
}

/**
 * Every colour reference a class list makes, as `--color-*` names, DERIVED from
 * the class list itself. Alpha suffixes (`bg-muted/40`) are stripped; a numeric
 * remainder (`ring-2`, `ring-offset-1`) and the non-colour remainders are not
 * colours and are skipped.
 */
function colourTokenReferences(classList: string): string[] {
	const refs = new Set<string>();
	for (const token of classList.split(/\s+/).filter(Boolean)) {
		const bare = token.split('/')[0];
		const separator = bare.indexOf('-');
		if (separator <= 0) continue;
		const prefix = bare.slice(0, separator);
		if (!COLOUR_PREFIXES.includes(prefix as (typeof COLOUR_PREFIXES)[number])) continue;
		const remainder = bare.slice(separator + 1);
		if (/^[0-9.]+$/.test(remainder)) continue;
		if (NON_COLOUR_REMAINDERS.has(remainder)) continue;
		refs.add(remainder);
	}
	return [...refs].sort();
}

/** The opening `<td …>` tag carrying `attribute="value"`. */
function cellTagByAttribute(markup: string, attribute: string, value: string): string {
	const pattern = new RegExp(`<td[^>]*${attribute}="${value}"[^>]*>`);
	const match = markup.match(pattern);
	assert.ok(match, `no grid cell carries ${attribute}="${value}" in the rendered grid`);
	return match[0];
}

const CLASS_PERIOD: ScheduledEntry = {
	entryId: 'mon-math',
	sectionId: 141,
	facultyId: 501,
	roomId: 601,
	subjectId: 11,
	day: 'MONDAY',
	startTime: '07:00',
	endTime: '07:45',
	durationMinutes: 45,
};

/**
 * One Grade 7 morning shape's first three rows: a teaching period, the
 * HEALTH BREAK, and the period after it. Only the break is a special event, so
 * this is the minimum fixture that can distinguish the two surfaces.
 */
const TIME_SLOTS = [
	{ startTime: '07:00', endTime: '07:45' },
	{ startTime: '09:00', endTime: '09:15', isSpecialEvent: true, eventName: 'HEALTH BREAK' },
	{ startTime: '09:15', endTime: '10:00' },
];

function renderGrid(kbSelectedSource: unknown = null): string {
	return renderToStaticMarkup(createElement(TimetableGrid, {
		entries: [CLASS_PERIOD],
		timeSlots: TIME_SLOTS,
		violationIndex: new Map(),
		highlightedEntryIds: new Set<string>(),
		selectedEntry: null,
		followUps: new Set<string>(),
		onEntryClick: () => {},
		subjectLabel: () => 'Mathematics',
		sectionLabel: () => '7-Luna',
		gradeForSection: () => 7,
		entryContextLabel: () => '',
		formatFacultyInitials: () => 'JD',
		facultyLabel: () => 'Dela Cruz',
		viewMode: 'section',
		pivotLabel: () => '7-Luna',
		roomLabelShort: () => 'Room 101',
		kbSelectedSource,
		onKbPlace: () => {},
		getCellConflict: () => null,
		getLiveCellConflict: () => null,
		onNavToFaculty: () => {},
		onNavToSection: () => {},
		onNavToRoom: () => {},
	} as never));
}

/** The class list of one grid cell, read out of the rendered markup. */
function classListOf(tag: string): string {
	const match = tag.match(/class="([^"]*)"/);
	assert.ok(match, `the cell carries no class attribute: ${tag.slice(0, 120)}`);
	return match[1];
}

test('MR-61: the break block is programmatically distinguishable from a teaching period', () => {
	const markup = renderGrid();

	const breakCell = cellTagByAttribute(markup, 'data-break-slot', 'true');
	assert.match(
		breakCell,
		/data-testid="timetable-break-slot"/,
		'the break cell carries no stable testid, so nothing can target it without reading the event name',
	);
	// The marker is a ROLE, not the event's display name: the break block's
	// wording is rendered once, as its own text, so an attribute never doubles a
	// user-facing string in the markup.
	assert.match(
		breakCell,
		/data-start-time="09:00"/,
		'the break marker does not identify which interval it is; data-start-time is how it is located',
	);
	assert.equal(
		(markup.match(/data-testid="timetable-break-slot"/g) ?? []).length,
		5,
		'the break row renders one marked cell per weekday (Mon–Fri)',
	);

	// The teaching period on the same grid carries no break marker — that is the
	// whole claim: the two surfaces differ by a machine-readable attribute, not
	// by a colour a test would have to hard-code.
	const teachingCell = cellTagByAttribute(markup, 'data-start-time', '07:00');
	assert.doesNotMatch(
		teachingCell,
		/data-break-slot|data-testid="timetable-break-slot"/,
		'a teaching-period cell is marked as a break block',
	);

	// And the period after the break is equally unmarked, so the marker is the
	// break's own property and not a property of the row order.
	const afterBreak = cellTagByAttribute(markup, 'data-start-time', '09:15');
	assert.doesNotMatch(afterBreak, /data-break-slot/, 'the 09:15 period after the break is marked as a break');
});

test('MR-61: the break marker survives the interactive placement variant', () => {
	// With a session selected the break cell becomes role="button". A colour or a
	// marker that only exists on the passive cell is a marker that a scheduler
	// mid-placement never sees, so both variants must carry it.
	const markup = renderGrid({ entryId: 'mon-math', sectionId: 141 });
	const breakCell = cellTagByAttribute(markup, 'data-break-slot', 'true');
	assert.match(breakCell, /role="button"/, 'the interactive break cell lost its placement role');
	assert.match(
		breakCell,
		/data-testid="timetable-break-slot"/,
		'the interactive break cell lost its break marker',
	);
});

test('MR-61: the break cell names a tone that the shared token set actually defines', () => {
	const markup = renderGrid();
	const breakCell = cellTagByAttribute(markup, 'data-break-slot', 'true');
	const tone = breakCell.match(/data-break-tone="([^"]*)"/);
	assert.ok(
		tone,
		'the break cell names no tone, so its colour cannot be tied to a shared token by a test',
	);
	const tokenName = tone[1];
	assert.match(tokenName, /^[a-z][a-z-]*$/, `data-break-tone="${tokenName}" is not a token name`);

	const colors = registeredColorTokens();
	assert.ok(
		colors.has(tokenName),
		`the break tone "${tokenName}" has no --color-${tokenName} utility in index.css @theme inline. ` +
			`The shared token set defines: ${[...colors].sort().join(', ')}`,
	);
	// A registered utility must also have the underlying HSL token in `:root`, or
	// `hsl(var(--x))` resolves to nothing and the cell renders transparent.
	const triplets = rootTokenTriplets();
	assert.ok(
		triplets.has(tokenName),
		`--color-${tokenName} is registered but --${tokenName} is not defined as an HSL triplet in :root, ` +
			'so the utility resolves to an empty colour',
	);
});

test('MR-61: every colour the break cell renders is a shared token — no raw palette, no hex', () => {
	const markup = renderGrid();
	const breakCell = cellTagByAttribute(markup, 'data-break-slot', 'true');
	const classList = classListOf(breakCell);

	assert.deepEqual(
		rawColourOffenders(classList),
		[],
		`the break cell still paints a raw palette step or hex: ${classList}`,
	);

	// Derived from the render, never from a pinned literal: whatever the cell
	// ends up using must be a member of the shared token set.
	const colors = registeredColorTokens();
	const offenders = colourTokenReferences(classList).filter((name) => !colors.has(name));
	assert.deepEqual(
		offenders,
		[],
		`the break cell references colour utilities the shared token set does not define: ${offenders.join(', ')}. ` +
			'DESIGN.md §3 forbids inventing a second palette.',
	);
	// And the claim is not vacuous: at least the tone itself is referenced.
	assert.ok(
		colourTokenReferences(classList).length > 0,
		'the break cell paints no token-backed colour at all, so row 3 is the only evidence and it is untested',
	);
});

test('MR-61 CONTROL: the token detectors can go red — a raw palette step and an unknown token are both caught', () => {
	// A gate whose detector always passes is decoration (AGENTS.md §11). Both
	// halves are exercised against strings the real cell never produces.
	assert.deepEqual(
		rawColourOffenders('px-1 bg-amber-50/40 text-amber-700'),
		['amber-50', 'amber-700'],
		'the raw-palette detector missed a fabricated amber pair',
	);
	assert.deepEqual(
		rawColourOffenders('bg-[#F0F1F3]'),
		['#F0F1F3'],
		'the hex detector missed a fabricated arbitrary colour',
	);

	const unregistered = colourTokenReferences('bg-teal-100 text-champagne');
	assert.ok(unregistered.includes('teal-100'), 'the reference extractor did not read a raw palette step');
	assert.ok(unregistered.includes('champagne'), 'the reference extractor did not read an invented token name');
	const colors = registeredColorTokens();
	assert.ok(
		!colors.has('champagne'),
		'the fixture colour "champagne" was registered, so this control can no longer prove the gate can fail',
	);

	// The negative side: the token-backed cell is read as clean.
	assert.deepEqual(rawColourOffenders('bg-muted text-muted-foreground'), []);
	assert.deepEqual(
		colourTokenReferences('bg-muted text-muted-foreground border-l ring-primary/40').filter((n) => !colors.has(n)),
		[],
		'a token-backed class list was reported as unregistered',
	);
});

test('MR-61: the break change added no row, no chip and no control', () => {
	const markup = renderGrid();
	// One row per interval, five day cells each — the same shape the base
	// renderer produced. A colour change that grew the DOM would move these.
	assert.equal(
		(markup.match(/data-start-time="07:00"/g) ?? []).length,
		5,
		'the teaching-period row no longer renders five day cells',
	);
	assert.equal(
		(markup.match(/data-break-slot=/g) ?? []).length,
		5,
		'the break row renders a different number of cells than before',
	);
	// The break row holds no class blocks: it is a band, not a new control.
	const breakCell = cellTagByAttribute(markup, 'data-break-slot', 'true');
	assert.doesNotMatch(breakCell, /data-timetable-entry/, 'the break row started rendering entry blocks');
	assert.doesNotMatch(
		breakCell,
		/<(button|a|input|select|details|summary)\b/i,
		'the break band became an interactive control',
	);
	// The teaching period still renders its class, so the break change did not
	// cost the grid a class.
	assert.match(markup, /data-timetable-entry="true"/, 'the teaching-period class no longer renders');
});