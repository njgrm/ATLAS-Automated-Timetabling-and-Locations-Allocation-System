/**
 * A7 C9 — RE-FIT: THE BADGE PILL'S LINE BOX MUST FIT THE BOX, AND MUST SURVIVE A CONSUMER.
 *
 * Operator, 2026-09-29: the type scale raised in `a528caa6` (c8 slice 1) made the
 * pages readable and, in the same commit, clipped 119 chips. Measured on staging at
 * 1366x768 across the 11 Part 2 pages, EVERY clipped chip carried `data-slot="badge"`:
 * the `Admin` role chip on all 11 pages, 103 `Ready` chips on /map, `View only` on
 * /teaching-load/history, and the Dashboard `Active Term` / `Live source` pills.
 *
 * ROOT CAUSE 1 (the population). `badgeVariants()` asked for `leading-none`, and the
 * ask did not survive. `cn()` runs tailwind-merge, and in Tailwind v4 a `text-*` SIZE
 * utility emits BOTH `font-size` and `line-height`, so twMerge classifies `text-xs` as
 * conflicting with the `leading-*` group and DELETES the primitive's `leading-none`
 * whenever a consumer re-states a size. The pill is a fixed `h-5` (20px) with a 1px
 * border and `py-0.5` — a 14px content box — so the 20px line box that came back was
 * cut by `overflow-hidden`. The fix is a line height published under a class name of
 * our own, which twMerge does not recognise and therefore cannot remove.
 *
 * ROOT CAUSE 2 (three chips). A `py-*` override on a fixed-height box: `py-1.5` (12px)
 * on the primitive's `h-5` leaves a 6px content box, `py-1` leaves 10px. Fixed box and
 * vertical padding have to add up.
 *
 * WHAT MAKES THIS A GATE AND NOT A COMMENT. A7C9-1 and A7C9-2 exercise the REAL merge
 * (`cn(badgeVariants(), <a consumer's real class string>)`, i.e. the actual tailwind-merge
 * call every `<Badge>` makes) and then compile the REAL `src/index.css` through
 * `@tailwindcss/node` and read the specificity back out of the emitted CSS. So the claim
 * "a consumer's `text-*` cannot win the line box" is answered by a build and a cascade
 * comparison, not by a grep for a class name that might not exist. A7C9-2's specificity
 * comparison exists because an ORDERING-dependent fix would be a false pass: the rule
 * is compared by specificity, so it keeps working when Tailwind reorders its output.
 *
 * A7C9-3 is the static half of the sweep the rendered walk cannot do: a collapsed or
 * hidden view renders no chip, so "I did not see it clipped" is not evidence that it is
 * not clipped. It reads every `<Badge>` in production and does the box arithmetic.
 *
 * A7C9-4 is the standing prohibition from this packet: no ellipsis machinery in the
 * primitive. An ellipsis is not a fit — it hides the word the scheduler came to read.
 *
 * It fails on the base commit `3b010e74` (recorded in the handoff) and passes after the
 * re-fit. It is wired into `atlas-client/package.json` twice on purpose — a named
 * script (`test:ux-badge-refit-a7c9`) and an entry in `test:client-suite` — because
 * AGENTS.md §11: "A test no gate runs is not evidence."
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compile, optimize } from '@tailwindcss/node';

// The REAL merge and the REAL primitive. Relative imports on purpose: these two modules
// are plain TypeScript with no JSX, and this keeps the gate independent of the bundler's
// alias resolution.
import { cn } from '../../lib/utils';
import { badgeVariants } from '../../ui/badge-variants';

const here = fileURLToPath(new URL('.', import.meta.url));
const clientRoot = resolve(here, '..', '..', '..');
const srcRoot = join(clientRoot, 'src');

/**
 * The class that carries the pill's line box, and the reason it is spelled here rather
 * than inside the test body: `badgeVariants()` names it, `index.css` declares it, and
 * this row proves the two are the same name. If the primitive ever stops shipping it,
 * A7C9-1 fails with this name in the message.
 */
const LINE_BOX_CLASS = 'badge-line-box';

/** The primitive's own box, in px, at the c8 scale. `h-5` border-box, 1px border, `py-0.5`. */
const PRIMITIVE_HEIGHT_PX = 20;
const PRIMITIVE_BORDER_PX = 1;
const PRIMITIVE_PADDING_Y_PX = 2;
/** `--text-xs` is 0.875rem at the 16px root since `a528caa6`; see `a7-c8-type-scale.test.ts`. */
const PRIMITIVE_FONT_PX = 14;

// ─────────────────────────────────────────────────────────────────────────────
// A7C9-1 — the real merge keeps the line box.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE FIXTURES ARE THE REAL SURFACE, AND THE ROW CHECKS THAT.
 *
 * A fixture invented for a control is worse than no control: the 2026-09-21 precedent is
 * a formatter validated against text that already contained the answer while the live
 * page said something else. So each fixture below is a consumer's real `className` from a
 * named file, and every fixture is re-checked against that file in the same run — if a
 * consumer's classes change, the row fails here and the fixture is corrected, rather than
 * the row quietly certifying a class string the product no longer renders.
 */
const REAL_CONSUMERS: { file: string; what: string; className: string }[] = [
	{
		file: 'components/app-shell/AppSidebar.tsx',
		what: 'the `Admin` role chip, which rendered clipped on all 11 pages',
		className:
			'mt-0.5 min-h-5 w-fit border-purple-200 bg-purple-50 px-1 text-xs font-bold text-purple-700',
	},
	{
		file: 'components/campus-map/RoomReadinessList.tsx',
		what: 'the `Ready` status chip — 103 clipped instances on /map',
		// The rendered class string is this fragment plus the status tone; the fragment
		// carries the `text-xs` that did the damage, so it is the part that matters here.
		className: 'shrink-0 gap-1 text-xs',
	},
	{
		file: 'components/faculty-assignments/AutoFillSummaryModal.tsx',
		what: 'the `Review only` chip on /teaching-load/history',
		className:
			'bg-blue-50 text-blue-700 font-bold uppercase tracking-widest text-xs h-5 px-1.5 shadow-none border-blue-200',
	},
];

/** Comments must not be able to satisfy a fixture. Same reason as `a7-c8-type-scale`. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => {
			const trimmed = line.trim();
			if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return '';
			const i = line.indexOf('//');
			return i > 0 && line[i - 1] !== ':' ? line.slice(0, i) : line;
		})
		.join('\n');
}

test('A7C9-1: the real cn() merge keeps the badge line box when a consumer re-states a size', () => {
	// The primitive on its own must ship the class — otherwise every later row is
	// asserting a class that nothing renders.
	const base = cn(badgeVariants());
	assert.ok(
		base.includes(LINE_BOX_CLASS),
		`A7C9-1: badgeVariants() does not ship \`${LINE_BOX_CLASS}\`, so a consumer's ` +
			'`text-*` still wins the line box. Merged base was: ' +
			base,
	);

	// Every Tailwind size step, not just the one that broke today. The defect is a
	// MECHANISM — a size utility conflicts with the leading group — so a list of exactly
	// `text-xs` would be a gate that stops working the day a consumer writes `text-sm`.
	for (const size of ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-[0.625rem]']) {
		const merged = cn(badgeVariants(), size);
		assert.ok(
			merged.includes(LINE_BOX_CLASS),
			`A7C9-1: cn(badgeVariants(), '${size}') dropped \`${LINE_BOX_CLASS}\`. twMerge ` +
				'removes class names it recognises as conflicting, so this is the row that ' +
				`fails if the line box goes back to being a \`leading-*\` utility. Merged: ${merged}`,
		);
	}

	// The same merge, with the class strings the real pages actually pass.
	for (const consumer of REAL_CONSUMERS) {
		const source = stripComments(readFileSync(join(srcRoot, consumer.file), 'utf8'));
		assert.ok(
			source.includes(consumer.className),
			`A7C9-1: the fixture for ${consumer.what} no longer appears verbatim in ` +
				`${consumer.file}. A control whose fixture has drifted from the surface is a ` +
				'control that certifies nothing — update the fixture to the real class string ' +
				'in the same commit that changed the consumer.',
		);
		const merged = cn(badgeVariants(), consumer.className);
		assert.ok(
			merged.includes(LINE_BOX_CLASS),
			`A7C9-1: cn(badgeVariants(), <${consumer.file}>) dropped \`${LINE_BOX_CLASS}\` ` +
				`for ${consumer.what}. Merged: ${merged}`,
		);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// A7C9-2 — a real Tailwind build emits the line box, and it outranks the utility.
// ─────────────────────────────────────────────────────────────────────────────

/** (ids, classes, elements) → one comparable number. `#id` 100, `.class` 10, tag 1. */
function specificity(selector: string): number {
	const ids = (selector.match(/#[\w-]+/g) ?? []).length;
	const classes = (selector.match(/\.[\w-]+/g) ?? []).length;
	const elements = (selector.replace(/#[\w-]+|\.[\w-]+/g, '').match(/[a-zA-Z][\w-]*/g) ?? []).length;
	return ids * 100 + classes * 10 + elements;
}

/**
 * Every emitted rule that DECLARES `line-height` and whose selector list mentions `cls`.
 *
 * The MINIMUM specificity across the selector list is returned, deliberately: a minifier
 * is allowed to merge rules with identical declarations into one comma-joined selector, and
 * the honest question is then the weakest selector that carries the declaration. Anything
 * softer than the minimum would let a merge change the answer.
 */
function lineHeightRule(css: string, cls: string): { selectors: string[]; decl: string } | undefined {
	for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = m[1]
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (!selectors.some((s) => s.includes(cls))) continue;
		const decl = /line-height:([^;}]+)/.exec(m[2])?.[1]?.trim();
		if (!decl) continue;
		return { selectors, decl };
	}
	return undefined;
}

test('A7C9-2: a real Tailwind build emits the line box at a specificity no `text-*` can win', async () => {
	const themeCss = readFileSync(join(srcRoot, 'index.css'), 'utf8');
	const compiled = await compile(themeCss, { base: clientRoot, onDependency: () => {} });
	const candidates = [LINE_BOX_CLASS, 'text-xs', 'text-sm', 'leading-none', 'h-5', 'py-0.5'];
	const css = optimize(compiled.build(candidates), { minify: true }).code;

	const badge = lineHeightRule(css, `.${LINE_BOX_CLASS}`);
	assert.ok(
		badge,
		`A7C9-2: no emitted rule declares a line height for \`.${LINE_BOX_CLASS}\`. The class ` +
			'is either not declared in index.css or the declaration was never compiled into the ' +
			'stylesheet, and a chip whose consumer re-states `text-xs` is clipped again. ' +
			'Compiled line-height rules:\n  ' +
			[...css.matchAll(/([^{}]+)\{([^{}]*line-height[^{}]*)\}/g)]
				.map((m) => m[1].trim())
				.join('\n  '),
	);

	// A unitless 1 is the whole mechanism: the line box is exactly the font size, so a
	// 14px `text-xs` gets a 14px line box inside a 14px content box. A px value here
	// would be a second hard-coded size to keep in step, and would clip `text-sm`.
	assert.equal(
		badge.decl,
		'1',
		`A7C9-2: \`.${LINE_BOX_CLASS}\` must declare a unitless \`line-height: 1\`, so the line ` +
			`box tracks whatever size a consumer sets. Emitted: "${badge.decl}".`,
	);

	// The comparison that makes this a real cascade claim rather than a string match. If
	// the class were plain `.badge-line-box` it would tie with `.text-xs` at (0,1,0) and
	// the winner would be decided by where the minifier happened to put the rule — which
	// is exactly the kind of fix that passes today and reverts on a Tailwind upgrade.
	for (const cls of ['text-xs', 'text-sm']) {
		const utility = lineHeightRule(css, `.${cls}`);
		assert.ok(utility, `A7C9-2: the \`.${cls}\` utility emitted no line height at all.`);
		const badgeMin = Math.min(...badge.selectors.map(specificity));
		const utilityMin = Math.min(...utility.selectors.map(specificity));
		assert.ok(
			badgeMin > utilityMin,
			`A7C9-2: \`.${LINE_BOX_CLASS}\` (specificity ${badgeMin}) must OUTRANK \`.${cls}\` ` +
				`(specificity ${utilityMin}). Equal specificity would leave the winner to ` +
				'source order, which Tailwind does not promise. Emit the line box under a ' +
				'compound selector, e.g. `.badge-line-box.badge-line-box`, so it wins by ' +
				'specificity rather than by position.',
		);
	}

	// The box the line box has to fit, pinned from the primitive's own classes. If a
	// future edit grows the pill, this row is where it shows up.
	const primitive = cn(badgeVariants());
	const h = /\bh-(\d+(?:\.\d+)?)\b/.exec(primitive);
	const py = /\bpy-(\d+(?:\.\d+)?)\b/.exec(primitive);
	assert.ok(h && py, `A7C9-1/2: could not read the primitive's box out of "${primitive}".`);
	assert.equal(Number(h[1]) * 4, PRIMITIVE_HEIGHT_PX, 'A7C9-2: the primitive is no longer h-5.');
	assert.equal(Number(py[1]) * 4, PRIMITIVE_PADDING_Y_PX, 'A7C9-2: the primitive is no longer py-0.5.');
	assert.equal(
		PRIMITIVE_HEIGHT_PX - PRIMITIVE_BORDER_PX * 2 - PRIMITIVE_PADDING_Y_PX * 2,
		PRIMITIVE_FONT_PX,
		'A7C9-2: the primitive\'s content box must equal the 14px `text-xs` face. If the box ' +
			'and the face drift apart, a correctly-sized line box clips anyway.',
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// A7C9-3 — the static half of the `py-*` sweep.
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_EXT = /\.(tsx?|jsx?)$/;
const isTestFile = (abs: string) =>
	abs.includes(`${sep}__tests__${sep}`) || /\.(test|spec)\.(tsx?|jsx?)$/.test(abs);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const abs = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === 'dist') continue;
			walk(abs, out);
		} else if (SOURCE_EXT.test(entry.name) && statSync(abs).isFile()) {
			out.push(abs);
		}
	}
	return out;
}

const rel = (abs: string) => relative(srcRoot, abs).split(sep).join('/');

/** Tailwind's spacing scale at the 16px root: `--spacing: 0.25rem`, so `n` is `n * 4` px. */
const spacingPx = (n: string) => Number(n) * 4;

const NAMED_FONT_PX: Record<string, number> = { xs: 14, sm: 15, base: 16, lg: 18, xl: 20 };
const ROOT_FONT_PX = 16;

/** The px a size token computes to, or `undefined` when it is a colour or unknown. */
function fontPx(tokens: string[]): number | undefined {
	for (const token of tokens) {
		const named = /^text-(xs|sm|base|lg|xl)$/.exec(token);
		if (named) return NAMED_FONT_PX[named[1]];
		const arbitrary = /^text-\[(\d*\.?\d+)(px|rem|em)?\]$/.exec(token);
		if (arbitrary) {
			const n = Number.parseFloat(arbitrary[1]);
			if (!arbitrary[2] || arbitrary[2] === 'px') return n;
			return n * ROOT_FONT_PX;
		}
	}
	return undefined;
}

test('A7C9-3: every `py-*` on a `<Badge>` leaves room for the line box it is asked to hold', () => {
	const offenders: string[] = [];
	let scanned = 0;

	for (const abs of walk(srcRoot).filter((f) => !isTestFile(f))) {
		const source = stripComments(readFileSync(abs, 'utf8'));
		for (const m of source.matchAll(/<Badge\b[\s\S]{0,600}?>/g)) {
			const tag = m[0];
			if (!/\bpy-/.test(tag)) continue;
			scanned += 1;
			const line = source.slice(0, m.index).split('\n').length;

			const tokens = tag.match(/[\w[\]#./:%-]+/g) ?? [];
			// `min-h-*` is a floor, not a fixed box: the element grows, so there is
			// nothing to add up. That is a correct way to use a `py-*`, not an oversight.
			if (tokens.some((t) => t.startsWith('min-h-'))) continue;
			const h = tokens.find((t) => /^h-\d/.test(t));
			if (!h) continue; // no fixed height at all: the box is content-sized.

			const py = tokens.find((t) => /^py-/.test(t))!;
			const border = tokens.find((t) => /^border-[2-9]$/.test(t)) ?? 'border';
			const borderPx = border === 'border' ? PRIMITIVE_BORDER_PX : Number(border.split('-')[1]);
			// The face is the consumer's if it states one, else the primitive's `text-xs`.
			const face = fontPx(tokens) ?? PRIMITIVE_FONT_PX;
			const content = spacingPx(h.split('-')[1]) - borderPx * 2 - spacingPx(py.split('-')[1]) * 2;

			if (content < face) {
				offenders.push(
					`${rel(abs)}:${line}  ${h} (${spacingPx(h.split('-')[1])}px) - ${borderPx * 2} ` +
						`border - ${py} (${spacingPx(py.split('-')[1]) * 2}) = ${content}px content ` +
						`box, for a ${face}px face -> ${face - content}px cut`,
				);
			}
		}
	}

	assert.ok(scanned > 0, 'A7C9-3: the sweep found no `<Badge py-*>` at all; the scan is broken.');
	assert.deepEqual(
		offenders,
		[],
		'A7C9-3: a vertical-padding override does not add up with the fixed height it is ' +
			'applied to, so `overflow-hidden` cuts the label.\n  ' +
			offenders.join('\n  ') +
			'\n  Fixed box and vertical padding must add up: `h-5` pairs with `py-0.5`, `py-1` ' +
			'needs `h-6`, `py-1.5` needs `h-7`. The cheapest fix is usually to drop the `py` ' +
			'and let the primitive supply it, which is what Dashboard.tsx now does. This row ' +
			'reads the SOURCE, because a collapsed or hidden view renders no chip and a ' +
			'rendered walk cannot see it.',
	);
});

// ─────────────────────────────────────────────────────────────────────────────
// A7C9-4 — the standing prohibition, as a row.
// ─────────────────────────────────────────────────────────────────────────────

test('A7C9-4: the primitive carries no ellipsis machinery', () => {
	const offenders: string[] = [];
	for (const relPath of ['index.css', 'ui/badge-variants.ts', 'ui/badge.tsx']) {
		readFileSync(join(srcRoot, relPath), 'utf8')
			.split('\n')
			.forEach((line, i) => {
				if (/(^|[\s"'`])truncate([\s"'`]|$)|text-ellipsis|line-clamp/.test(line)) {
					offenders.push(`${relPath}:${i + 1}  ${line.trim().slice(0, 120)}`);
				}
			});
	}
	assert.deepEqual(
		offenders,
		[],
		'A7C9-4: `truncate` / `text-ellipsis` / `line-clamp` must not appear in the primitive ' +
			'or the stylesheet.\n  ' +
			offenders.join('\n  ') +
			'\n  Re-fitting a pill means the line box fits the box. An ellipsis is not a fit: it ' +
			'hides the word the scheduler came to read, with no way to recover it.',
	);
});
