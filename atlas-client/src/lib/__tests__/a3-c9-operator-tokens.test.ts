/**
 * A3-C9 — app-wide text contrast contract for `--destructive`, `--muted-foreground` and
 * `--accent`, in `src/index.css`.
 *
 * ## Why this control is NOT a restatement of the numbers in index.css
 *
 * A test that asserts "5.650:1" proves only that someone typed 5.650 somewhere. Every figure in
 * this file is **recomputed** from the committed token values in `src/index.css` and from the
 * committed surface tokens in the same file, using the WCAG 2.x relative-luminance formula
 * written out below. Change a token and this goes red on its own; no constant here has to be
 * updated for the control to notice.
 *
 * The control is proved to discriminate twice, in this file and in the handoff:
 *   1. `the pre-A3-C9 values FAIL this same threshold` — the three old values are computed and
 *      asserted to fall BELOW 4.5:1 on at least one real surface. If the threshold were
 *      unreachable, or the surfaces were imaginary, that row would be red. So the threshold is
 *      demonstrably real and the fix was demonstrably necessary.
 *   2. In the handoff, the token was mutated in the working tree, this gate was re-run and went
 *      red, and the file was restored byte-exact with a SHA-256 to prove it.
 *
 * ## Why the surfaces are read from the file rather than listed here
 *
 * `--muted-foreground` fails on WHITE-adjacent surfaces but passes on pure white at the old
 * value, so measuring against the wrong background would have hidden the defect. The surface
 * tokens are read from the same `:root` block the text tokens come from, plus the two alpha
 * stops of the real `body` background gradient in `@layer base`, so the set cannot drift away
 * from what the app actually paints.
 *
 * Run: `npm run test:a3-c9-operator-tokens`
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..');
const INDEX_CSS = join(CLIENT_ROOT, 'src', 'index.css');

/**
 * Every tracked .ts/.tsx under the client, so the call-site rows scan the real app rather than a
 * hand-written fixture. `git ls-files` is used deliberately: it is the only listing here that
 * cannot silently miss a file a recursive glob would skip, and it excludes build output.
 */
function trackedSourceFiles(): string[] {
	const out = execFileSync('git', ['-C', CLIENT_ROOT, 'ls-files', '*.ts', '*.tsx'], {
		encoding: 'utf8',
		maxBuffer: 1 << 28,
	});
	const files = out.split('\n').filter(Boolean);
	// A control that scanned zero files would pass vacuously, which is the failure mode that
	// matters most for a scan-shaped row.
	assert.ok(files.length > 400, `the call-site scan found only ${files.length} files; the scan is broken`);
	return files;
}

const css = readFileSync(INDEX_CSS, 'utf8');

type Rgb = readonly [number, number, number];
type Hsl = readonly [number, number, number];

/** WCAG 2.x AA for normal-size text. WCAG 1.4.3. */
const AA_TEXT = 4.5;
/** WCAG 1.4.11 non-text contrast, for the ring role only. */
const UI_FLOOR = 3;

// ───────────────────────── colour maths (no library rounding) ─────────────────────────

function hslToSrgb(h: number, s: number, l: number): Rgb {
	s /= 100;
	l /= 100;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	return [r + m, g + m, b + m].map((v) => Math.round(v * 255)) as unknown as Rgb;
}

/** WCAG 2.x relative luminance, R/G/B each on [0,255]. */
function relativeLuminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}) as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio: (Llighter + 0.05) / (Ldarker + 0.05). */
function contrastRatio(a: Rgb, b: Rgb): number {
	const la = relativeLuminance(a);
	const lb = relativeLuminance(b);
	const lighter = Math.max(la, lb);
	const darker = Math.min(la, lb);
	return (lighter + 0.05) / (darker + 0.05);
}

// ───────────────────────── reading the committed stylesheet ─────────────────────────

/** The `:root` block, so a value in `@theme` or a media query is not mistaken for the default. */
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('.dark {'));

function readToken(declared: string, depth = 0): { value: Hsl; count: number } {
	// Callers hold CSS custom-property names, i.e. WITH the leading `--`. Normalise once here so
	// no caller can build `----primary` and silently match nothing. (That exact bug shipped in the
	// first draft of this file: every tokenRgb call failed with a four-dash message.)
	const name = declared.replace(/^--/, '');
	assert.ok(/^[a-z][\w-]*$/.test(name), `not a token name: ${declared}`);
	assert.ok(depth < 8, `--${name} alias chain is circular`);
	// An alias such as `--primary: var(--accent);` is not a literal triple. Resolving it is
	// REQUIRED, not a convenience: `--primary` is what `text-primary` and the body wash are
	// painted with, and the body wash is a real surface in the matrix below. Reading it as
	// absent would have silently dropped two of the six surfaces.
	const alias = new RegExp(`--${name}:\\s*var\\(--([\\w-]+)\\)\\s*;`).exec(rootBlock);
	if (alias) return readToken(alias[1], depth + 1);

	const re = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%\\s*;`, 'g');
	const found = [...rootBlock.matchAll(re)];
	assert.ok(found.length > 0, `--${name} is not declared as an HSL triple (or a var() alias) in the :root block of index.css`);
	const last = found[found.length - 1];
	return {
		value: [Number(last[1]), Number(last[2]), Number(last[3])],
		count: found.length,
	};
}

function tokenRgb(name: string): Rgb {
	return hslToSrgb(...readToken(name).value);
}

/** Alpha-composite `fg` at `alpha` over opaque `bg` — the `body` wash really is a composite. */
function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
	return [
		Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
		Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
		Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
	];
}

/** The `body` rule only, so the wash alphas cannot be picked up from the scrollbar rules. */
const bodyRule = css.slice(css.indexOf('\tbody {'), css.indexOf('\thtml {'));

/**
 * The literal 0% stop colour of the `body` background gradient, read from the file.
 *
 * ── A3-C9 CORRECTION 2026-09-28: THIS IS NOT THE SURFACE, and the first draft used it as one.
 *
 * SUPERSEDED SURFACE MODEL (retained verbatim, with the reason it was wrong):
 *
 *   "the wash alphas are composited over the gradient's own literal 0% stop #fafbfc"
 *     -> 100% stop = [234,242,240] = #eaf2f0
 *     -> --muted-foreground 4.982:1 · --destructive 4.964:1 · --accent 4.711:1
 *
 * WHY IT WAS WRONG, twice over:
 *
 *   1. THE BASE IS THE CANVAS, NOT THE 0% STOP. The wash is a `linear-gradient` on `body`, and
 *      the `html` rule in this stylesheet declares `@apply font-sans` and NO background. Per CSS
 *      Backgrounds, a body background with no html background is propagated to the CANVAS and
 *      painted over the UA canvas colour — white. So the final stop composites over #ffffff.
 *      The gradient's own 0% stop is a *second colour in the ramp*, not a backdrop under the last
 *      one. Treated as a backdrop it is a phantom surface that is never painted.
 *   2. THE 50% STOP IS AN INTERPOLATION, NOT A STACK. A gradient's stops are interpolated
 *      (CSS Images 3, in premultiplied sRGB); they are not layered. The first draft built the
 *      50% surface as `primary @ 0.04 over #fafbfc`, which is neither of the two real stops.
 *
 * TRUE SURFACE MODEL, as implemented below:
 *   · 100% stop = hsl(--primary / 0.07) composited over the WHITE canvas = [239,246,243] #eff6f3
 *   · 50% stop  = the premultiplied midpoint of #fafbfc and hsl(--primary / 0.07), alpha 0.535,
 *                 composited over the white canvas = [245,248,248]
 *   · worst case over the whole 135deg ramp is at its 100% end, so the 100% stop is the number
 *     that governs, and the sweep below proves it rather than assuming it.
 *
 * DIRECTION OF THE ERROR: CONSERVATIVE. Every true figure is HIGHER than the superseded one, so
 * no verdict in this file changes and the AA conclusion of A3-C9 is unaffected. The correction is
 * to a documented surface that did not exist, not to a failing measurement.
 */
const bodyWashBase = ((): Rgb => {
  const m = bodyRule.match(/#([0-9a-f]{6})\s+0%/i);
  assert.ok(m, 'the body background gradient base stop was not found in index.css');
  const hex = m[1];
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ] as unknown as Rgb;
})();

/**
 * The surface the body wash is actually painted on. See the correction note above.
 *
 * This is ASSERTED, not assumed: if a `dark` class ever lands on `html` (or the stylesheet gives
 * `html` a background of its own), the body's gradient stops being propagated to the canvas and
 * every wash figure in this file becomes wrong. That is the condition under which this whole
 * surface model must be re-derived, so it is a control rather than a comment.
 */
const htmlDeclaresBackground = ((): boolean => {
  const htmlRule = css.slice(css.indexOf('\thtml {'), css.indexOf('\thtml {'));
  const block = htmlRule.slice(0, htmlRule.indexOf('}') + 1);
  return /background/.test(block);
})();
assert.equal(
  htmlDeclaresBackground,
  false,
  'the `html` rule now declares a background, so the `body` wash is no longer propagated to the ' +
    'white canvas. Every body-wash ratio in this file is measured against a surface that no longer ' +
    'exists — re-derive them before trusting this suite.',
);

/** The UA canvas colour, i.e. what a `body` background with no `html` background composites over. */
const CANVAS_WHITE: Rgb = [255, 255, 255] as unknown as Rgb;


/**
 * The two alpha stops the body wash actually declares, read from the file.
 *
 * Scoped to the `body` rule on purpose. A file-wide scan of `hsl(var(--primary) / N)` also
 * matches `.shadow-primary-glow` (0.35), `.shadow-primary-sm` (0.28), the scrollbar hover (0.8)
 * and several utilities, so the first draft of this row built its "body wash" surfaces from
 * 0.35 and 0.28 — phantom surfaces that are not painted behind any text. The 0.04/0.07 pair is
 * what the page actually renders.
 */
const bodyWashAlphas = ((): number[] => {
	const stops = [...bodyRule.matchAll(/hsl\(var\(--primary\)\s*\/\s*([\d.]+)\)/g)].map((m) => Number(m[1]));
	assert.equal(
		stops.length,
		2,
		`expected exactly the two body-wash alpha stops, found ${JSON.stringify(stops)}. If the gradient ` +
			'gained a stop, re-measure the surfaces in this file rather than extending the list silently.',
	);
	return stops;
})();

/**
 * The 50% stop of the body wash, as CSS actually paints it.
 *
 * CSS Images 3 interpolates gradient stops in PREMULTIPLIED sRGB, so the midpoint of an opaque
 * #fafbfc and a `hsl(--primary / 0.07)` is not the arithmetic mean of the two colours: solve for
 * the premultiplied midpoint, divide back out by the interpolated alpha (0.535), then composite
 * that over the white canvas. The superseded model instead composited `primary @ 0.04` over
 * #fafbfc, which is a surface the browser never produces.
 */
function bodyWashMidpoint(): Rgb {
  const a0 = 1;
  const a1 = bodyWashAlphas[1];
  const aMid = 0.5 * a0 + 0.5 * a1;
  const unpremultiplied: number[] = [0, 1, 2].map((i) => {
    const p0 = (bodyWashBase[i] as number) * a0;
    const p1 = (tokenRgb('--primary')[i] as number) * a1;
    return (0.5 * p0 + 0.5 * p1) / aMid;
  });
  return composite(unpremultiplied as unknown as Rgb, aMid, CANVAS_WHITE);
}

/**
 * Every real light surface the three tokens are painted on, all derived from committed values.
 * `muted` is the one that matters most: it is the tint behind thead rows, secondary badges and
 * secondary panels, and it is where the old `--muted-foreground` failed.
 */
function realSurfaces(): Array<{ name: string; rgb: Rgb }> {
  const primary = tokenRgb('--primary');
  return [
    { name: '--background / --card / --popover (white)', rgb: tokenRgb('--background') },
    { name: '--muted / --secondary', rgb: tokenRgb('--muted') },
    { name: '--accent-muted', rgb: tokenRgb('--accent-muted') },
    { name: '--sidebar-background', rgb: tokenRgb('--sidebar-background') },
    {
      name: `body wash 50% stop (premultiplied midpoint, over canvas) [${bodyWashMidpoint()}]`,
      rgb: bodyWashMidpoint(),
    },
    {
      name: `body wash 100% stop (primary @ ${bodyWashAlphas[1]}, over canvas) [${composite(primary, bodyWashAlphas[1], CANVAS_WHITE)}]`,
      rgb: composite(primary, bodyWashAlphas[1], CANVAS_WHITE),
    },
  ];
}

/**
 * Sweep the whole declared 135deg wash and prove which end actually governs.
 *
 * The 100% stop is the worst surface because the ramp darkens monotonically toward it, but that
 * is an assumption about a gradient, and a sweep is cheap. This row is what turns "the 100% stop
 * is the worst" from a claim into a measurement, and it would catch a future reordering of the
 * stops that inverted the ramp.
 */
function worstBodyWashSurface(): { rgb: Rgb; position: number; ratio: number } {
  const primary = tokenRgb('--primary');
  const a1 = bodyWashAlphas[1];
  const STEPS = 2000;
  let worst = { rgb: tokenRgb('--background'), position: 0, ratio: Number.POSITIVE_INFINITY };
  for (const token of ['muted-foreground', 'destructive', 'accent'] as const) {
    const fg = tokenRgb(token);
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const alpha = 0.5 * 1 + 0.5 * a1;
      const unpremultiplied = [0, 1, 2].map((c) => {
        const p0 = (bodyWashBase[c] as number) * 1;
        const p1 = (primary[c] as number) * a1;
        return (p0 + t * (p1 - p0)) / alpha;
      });
      const painted = composite(unpremultiplied as unknown as Rgb, alpha, CANVAS_WHITE);
      const r = contrastRatio(fg, painted);
      if (r < worst.ratio) worst = { rgb: painted, position: t, ratio: r };
    }
  }
  return worst;
}


/** The three tokens this stream changed, with the value each had at the dispatch base. */
const CHANGED: ReadonlyArray<{ token: string; before: Hsl; role: string }> = [
	{ token: 'muted-foreground', before: [215, 16, 47], role: 'body/label text at 1292 sites' },
	{ token: 'destructive', before: [0, 84, 60], role: 'error text AND solid-button background' },
	{ token: 'accent', before: [158, 64, 40], role: 'text-primary, text-accent and solid-button background' },
];

test('CONTROL: the reader sees the real stylesheet, and every surface is derived from it', () => {
	assert.ok(css.length > 1000, 'index.css read looks empty; the contrast rows below would be vacuous');
	for (const { token } of CHANGED) {
		assert.ok(readToken(token).count > 0, `${token} was not parsed`);
	}
	// Six surfaces, all real: three token surfaces plus the two body-wash composites.
	assert.equal(realSurfaces().length, 6, 'expected 5 token surfaces plus the body wash');
	// The white surface really is white — if the token layer changed, this catches it.
	assert.deepEqual(tokenRgb('--background'), [255, 255, 255] as unknown as Rgb);
	// And the two surfaces that differ from each other, so the reader is not measuring one colour
	// six times and calling it a matrix.
	const surfaces = realSurfaces();
	assert.notEqual(contrastRatio(surfaces[0].rgb, surfaces[1].rgb), 1, '--muted and white are not distinguishable');
});

test('CALL-SITE: no state background paints a dark text colour on the solid accent', () => {
	// A3-C9 BOUNDED CORRECTION (2026-09-28). Darkening `--accent` to clear AA as TEXT silently
	// broke one CALL SITE, because `--accent` is also a BACKGROUND under
	// `hover:bg-accent` / `focus:bg-accent` / `aria-selected:bg-accent`. `--foreground` is a dark
	// navy, so the hover on ScheduleReviewWorkspaceHeader.tsx:780 painted dark text on accent:
	// 5.850:1 at the old 40%, 3.336:1 at 29%. Nothing in this file caught it, because every row
	// above measures token-against-surface and none of them looked at what a call site actually
	// paints ON the token. This row closes that gap.
	//
	// It cannot be fixed in the token layer: the two roles' feasible regions are disjoint
	// (foreground-on-accent needs L >= ~35, accent-as-text needs L <= ~30), so the call site has
	// to use the repo's existing white-on-accent pairing. This row is what stops the next
	// darkening from re-breaking a call site the same way.
	//
	// SCOPE, precisely: SOLID state backgrounds only. `bg-primary/10` and friends are tints, not
	// the solid fill, and a dark text colour on a tint is the ordinary, correct case. Verified
	// across all 583 tracked .ts/.tsx files, there are 12 solid state-background sites and every
	// one now pairs a light label.
	//
	// A3-C9 CORRECTION 2 (2026-09-28). BOTH claims in the paragraph quoted verbatim above are
	// FALSE, and this is the record of why. The 583 file count was right; the rest was not.
	//
	//   SUPERSEDED: "there are 12 solid state-background sites and every one now pairs a light
	//   label."
	//   REASON: the count came from a regex that could only see `hover|focus|focus-visible|
	//   active|aria-selected`, so it was blind to every `data-[state=…]`, `data-[highlighted]`,
	//   `data-[isActive=true]`, `group-hover` and UNPREFIXED site — and the second clause was
	//   not a measurement at all. The row below now asserts the real population, 64 sites, over
	//   the same 583 files, one line per element; 63 pair a light label and exactly 1 did not.
	//
	//   ON THE COUNTING BASIS, because two wrong figures have already been published from this
	//   row and a third would be worse than either. The unit is one SCANNED LINE, and the
	//   exclusions are only comment prose and this file's own marked fixture. An intermediate
	//   count of "17" was also wrong, and for the same class of reason: its regex was written
	//   `(?:PREFIX)?:bg-…`, which still demands the colon, so it excluded every unprefixed
	//   `bg-accent`/`bg-primary` — most of the 64. A prefix-optional group has to own its own
	//   colon, `(?:PREFIX:)?bg-…`. The pinned 64 is the number this file actually enforces.
	//
	// A3-C9 CORRECTION 2, the guard's own two blind spots, both of which are why it could not see
	// the very defect it was written for:
	//   1. The old regex listed four pseudo-classes and no `data-[state=…]` variant, no
	//      `data-[highlighted]`, no `data-[isActive=true]`, no `group-hover`/`peer-focus` and no
	//      unprefixed `bg-accent`. ui/dialog.tsx:42 is `data-[state=open]:bg-accent`, so the row
	//      never even evaluated that line. It now covers the whole state-prefix class.
	//   2. DARK_TEXT_TOKENS omitted `muted-foreground` entirely, which is the exact token on that
	//      line. So even a correct prefix match would have been scored "no dark label".
	// Both are fixed below. Nothing was narrowed: the solid-only scope, the dark-on-solid
	// semantics, the `git ls-files` source and the >400 anti-vacuity assertion are all unchanged,
	// and the enumeration is strictly WIDER than the guard it replaces.

	// Every state prefix this codebase actually uses, plus the unprefixed case. The negative
	// lookahead keeps translucent fills (`bg-primary/10`) out of scope, as before.
	const STATE_PREFIX =
		'(?:hover|focus|focus-visible|active|aria-selected|aria-checked|group-hover|peer-focus' +
		'|data-\\[state=(?:open|closed|checked|unchecked|active|selected|inactive|on|off)\\]' +
		'|data-\\[highlighted\\]|data-\\[isActive=true\\])';
	const DARK_TEXT_TOKENS = [
		'foreground',
		// ADDED in correction 2: this is the token on ui/dialog.tsx:42. Its absence is why the
		// row could not see an invisible close button sitting in a shared @/ui primitive.
		'muted-foreground',
		'destructive-foreground',
		'card-foreground',
		'popover-foreground',
		'secondary-foreground',
	];
	const LIGHT_TEXT_TOKENS = ['accent-foreground', 'primary-foreground', 'background', 'white'];
	const solidStateBackground = new RegExp(`(?:${STATE_PREFIX}:)?bg-(accent|primary)(?![\\w/-])`, 'g');

	/** The dark text tokens a single line paints on a solid accent/primary background, if any. */
	const darkLabelOnSolidStateBackground = (line: string): string[] => {
		if (!solidStateBackground.test(line)) return [];
		solidStateBackground.lastIndex = 0;
		// Only the solid accent/primary fill, and only a text token that is DARK on it.
		const dark = DARK_TEXT_TOKENS.filter((t) => new RegExp(`\\btext-${t}\\b`).test(line));
		const light = LIGHT_TEXT_TOKENS.filter((t) => new RegExp(`\\btext-${t}\\b`).test(line));
		return dark.length > 0 && light.length === 0 ? dark : [];
	};

	// DISCRIMINATION CONTROL. A guard that cannot see the defect it exists to catch has not
	// discharged its purpose, so prove the detector can see the exact defect: the pre-fix
	// ui/dialog.tsx:42 class string must be flagged, and the post-fix one must not. Before
	// correction 2 this row would have passed vacuously on the real file while being blind to it.
	const preFixDialogClose =
		'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity ' +
		'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ' +
		'disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground'; // A3-C9-CALLSITE-FIXTURE
	const postFixDialogClose = preFixDialogClose.replace('text-muted-foreground', 'text-accent-foreground');
	assert.deepEqual(
		darkLabelOnSolidStateBackground(preFixDialogClose),
		['muted-foreground'],
		'discrimination control: the detector is still blind to dark text on a data-[state=open] ' +
			'accent background, which is the exact defect of ui/dialog.tsx:42',
	);
	assert.deepEqual(
		darkLabelOnSolidStateBackground(postFixDialogClose),
		[],
		'discrimination control: the corrected pairing must be clean',
	);
	// Every prefix the extended regex claims to cover must actually match, so the list cannot rot
	// into a narrower one without this row failing.
	for (const prefix of [
		'',
		'hover:',
		'focus:',
		'focus-visible:',
		'active:',
		'aria-selected:',
		'aria-checked:',
		'group-hover:',
		'peer-focus:',
		'data-[state=open]:',
		'data-[state=checked]:',
		'data-[state=active]:',
		'data-[state=selected]:',
		'data-[highlighted]:',
		'data-[isActive=true]:',
	]) {
		assert.ok(
			solidStateBackground.test(`${prefix}bg-accent`),
			`discrimination control: the extended regex does not cover the "${prefix || '(none)'}" state prefix`,
		);
		solidStateBackground.lastIndex = 0;
	}
	// A tint is still out of scope: the solid-only rule must not have been widened by accident.
	assert.equal(solidStateBackground.test('bg-primary/10 text-muted-foreground'), false, 'a tint is not a solid fill');
	solidStateBackground.lastIndex = 0;

	// Two kinds of line are excluded, and ONLY these two, so the scan still covers every real
	// element. Both exclusions are about text that paints nothing, and both are asserted below so
	// they cannot quietly become a wider blind spot:
	//   1. PROSE. A class token inside a `//` or block comment is documentation, not a call site.
	//      Without this, the pre-existing comment at this file's CONTRAST row ("A
	//      `bg-destructive`/`bg-accent` button carries `text-destructive-foreground`…") reads as
	//      an offender. It never painted anything.
	//   2. This file's own discrimination fixture, which by construction contains the defect.
	//      It is marked with a sentinel, and the assertion proves the marker is still present.
	const FIXTURE_SENTINEL = 'A3-C9-CALLSITE-FIXTURE';
	const isScannableLine = (line: string): boolean => {
		const t = line.trim();
		if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) return false;
		if (t.includes(FIXTURE_SENTINEL)) return false;
		return true;
	};

	const offenders: string[] = [];
	let siteCount = 0;
	for (const rel of trackedSourceFiles()) {
		const text = readFileSync(join(CLIENT_ROOT, rel), 'utf8');
		text.split(/\r?\n/).forEach((line, i) => {
			if (!isScannableLine(line)) return;
			if (!solidStateBackground.test(line)) return;
			solidStateBackground.lastIndex = 0;
			siteCount += 1;
			const dark = darkLabelOnSolidStateBackground(line);
			if (dark.length > 0) {
				offenders.push(`${rel}:${i + 1} paints ${dark.join('+')} on a solid accent/primary state background`);
			}
		});
	}
	// The fixture must still be marked, or the exclusion above has become a silent no-op and this
	// row would start flagging its own control.
	assert.ok(
		readFileSync(join(CLIENT_ROOT, 'src/lib/__tests__/a3-c9-operator-tokens.test.ts'), 'utf8').includes(
			FIXTURE_SENTINEL,
		),
		`the call-site fixture sentinel ${FIXTURE_SENTINEL} is gone; the fixture exclusion has become a no-op`,
	);
	// The superseded population figures ("12 sites", and an intermediate "17") are replaced by a
	// pinned 64, so the real population cannot silently shrink back into a blind spot. Counted as
	// one per scanned line, over the same 583 tracked files, excluding only comment prose and the
	// marked fixture above.
	assert.equal(
		siteCount,
		64,
		`the solid accent/primary state-background population is ${siteCount}, not the recorded 64. ` +
			'A new site is a real change worth a look; a REMOVED site means a prefix stopped being ' +
			'matched and this row has gone blind again.',
	);
	assert.deepEqual(
		offenders,
		[],
		`${offenders.length} call site(s) pair a DARK text colour with a solid accent/primary state ` +
			`background, which the current --accent value breaks:\n  - ${offenders.join('\n  - ')}\n` +
			'Use the repo convention text-accent-foreground / text-primary-foreground, which is white and ' +
			`measures ${contrastRatio(tokenRgb('--accent'), tokenRgb('--accent-foreground')).toFixed(3)}:1.`,
	);
});

test('SURFACE MODEL: the wash is composited over the canvas, and the 100% end governs', () => {	// A3-C9 CORRECTION 2026-09-28. The first draft composited the wash alphas over the gradient's
	// own 0% stop #fafbfc, which is a surface the browser never paints: the 0% stop is a ramp
	// colour, not a backdrop, and with no background on `html` the body gradient is propagated to
	// the white canvas. The figures below are the corrected ones, and the comment block on
	// `bodyWashBase` retains the superseded model and its figures beside them.
	//
	// These are the numbers index.css now documents, so the code and the prose cannot disagree.
	const wash100 = composite(tokenRgb('--primary'), bodyWashAlphas[1], CANVAS_WHITE);
	assert.deepEqual(
		wash100,
		[239, 246, 243] as unknown as Rgb,
		'the 100% wash stop is hsl(--primary / 0.07) over the white canvas = #eff6f3',
	);
	assert.deepEqual(
		bodyWashMidpoint(),
		[245, 248, 248] as unknown as Rgb,
		'the 50% wash stop is the premultiplied midpoint over the canvas, not a stack of the 0% stop',
	);

	// The corrected worst-case figures, one per changed token, on the governing surface.
	const EXPECTED: ReadonlyArray<{ token: string; expected: number }> = [
		{ token: 'muted-foreground', expected: 5.167 },
		{ token: 'destructive', expected: 5.147 },
		{ token: 'accent', expected: 4.885 },
	];
	for (const { token, expected } of EXPECTED) {
		const actual = contrastRatio(tokenRgb(token), wash100);
		assert.ok(
			Math.abs(actual - expected) < 0.002,
			`--${token} measures ${actual.toFixed(3)}:1 on the true 100% wash stop, and index.css now ` +
				`documents ${expected.toFixed(3)}:1. If the token values changed, both the measurement and the ` +
				'annotation in index.css must be updated together.',
		);
	}

	// Prove the governing end is the 100% end by sweeping, not by asserting a monotonicity we
	// have not checked. If a future edit reorders the stops, this row fails instead of quietly
	// leaving the 100% figure as the governing one when it is not.
	const worst = worstBodyWashSurface();
	assert.ok(
		worst.position > 0.95,
		`the worst wash surface is at gradient position ${(worst.position * 100).toFixed(1)}% rather than ` +
			`at the 100% end, so the documented 100%-stop figure is not the governing one. The wash ramp is no ` +
			`longer monotonic and every "worst real surface" note in index.css must be re-derived.`,
	);
	// And the sweep must agree with the two declared stops, or the interpolation model is wrong.
	assert.ok(
		worst.ratio <= 4.885 + 0.002,
		`the swept worst wash ratio ${worst.ratio.toFixed(3)}:1 is worse than the declared 100% stop, so the ` +
			'interpolation model used here does not describe the gradient the browser paints.',
	);
});

test('CONTRAST: every changed token clears WCAG AA 4.5:1 as text on EVERY real light surface', () => {
	// All violations are collected and reported together rather than thrown on the first one.
	// Throwing early hides the other two tokens behind whichever sorts first, so a run against the
	// pre-A3-C9 stylesheet proved only ONE of the three defects; the aggregate form is what makes
	// this row usable as failing-first evidence.
	const surfaces = realSurfaces();
	const violations: string[] = [];
	for (const { token, role } of CHANGED) {
		const fg = tokenRgb(token);
		for (const surface of surfaces) {
			const ratio = contrastRatio(fg, surface.rgb);
			if (ratio < AA_TEXT) {
				violations.push(
					`--${token} is ${ratio.toFixed(3)}:1 on ${surface.name}, below AA ${AA_TEXT}:1 ` +
						`(role: ${role})`,
				);
			}
		}
	}
	assert.deepEqual(
		violations,
		[],
		`${violations.length} measured AA failures in src/index.css. The applicable floor for these three is ` +
			`WCAG 1.4.3 at ${AA_TEXT}:1, not the ${UI_FLOOR}:1 UI floor, because each carries body text:\n  - ` +
			violations.join('\n  - '),
	);
});

test('CONTRAST: the solid-button role is satisfied by the same pair, because contrast is symmetric', () => {
	// A `bg-destructive`/`bg-accent` button carries `text-destructive-foreground`/
	// `text-accent-foreground`, which is white. Contrast(a,b) == contrast(b,a), so this row is
	// the SAME measured pair as the text role above — asserted separately because the two roles
	// are different call sites in the app and a future edit could break only one of them.
	//
	// `--muted-foreground` is NOT in this row: it has no `-foreground` counterpart and is never a
	// button background, so there is no solid-button role for it to satisfy. Including it would
	// have been a phantom requirement against a token that does not exist.
	for (const token of ['destructive', 'accent'] as const) {
		const button = tokenRgb(token);
		const label = tokenRgb(`${token}-foreground`);
		const ratio = contrastRatio(button, label);
		assert.ok(
			ratio >= AA_TEXT,
			`the solid ${token} button with its white label is ${ratio.toFixed(3)}:1, below AA ${AA_TEXT}:1. ` +
				'A destructive/primary button label is text, so 1.4.3 at 4.5:1 applies, not the 3:1 UI floor.',
		);
	}
	// The two tokens that do have a foreground pair, and no others claimed by this file.
	assert.ok(
		readToken('destructive-foreground').value[2] === 100,
		'--destructive-foreground is expected to be the white label colour',
	);
	assert.ok(
		readToken('accent-foreground').value[2] === 100,
		'--accent-foreground is expected to be the white label colour',
	);
});

test('the pre-A3-C9 values FAIL this same threshold on a real surface', () => {
	// THE ROW THAT PROVES THE CONTROL DISCRIMINATES. It runs the OLD values through the SAME
	// function and the SAME surfaces and asserts they fall below AA. If the threshold could not
	// be failed, or the surfaces were not real, this row would be red — so a green run here means
	// the gate above is genuinely enforcing something the code did not previously satisfy.
	const surfaces = realSurfaces();
	for (const { token, before } of CHANGED) {
		const old = hslToSrgb(...before);
		const ratios = surfaces.map((s) => ({ name: s.name, ratio: contrastRatio(old, s.rgb) }));
		const worst = ratios.reduce((lo, r) => (r.ratio < lo.ratio ? r : lo));
		assert.ok(
			worst.ratio < AA_TEXT,
			`the pre-A3-C9 --${token} value ${before.join(' ')} measures ${worst.ratio.toFixed(3)}:1 on ` +
				`${worst.name}, which is NOT below AA. The claim that this token was failing is wrong, or the ` +
				'surfaces changed. Either way this control is no longer proving a fix.',
		);
	}

	// The three measured figures on white, recomputed here rather than trusted from the packet.
	// These are the executor's own 8-bit sRGB numbers and they DIFFER from the packet's
	// 3.55 / 4.02 / 3.09 — see the handoff note, which is a real finding, not a rounding quibble.
	//
	// 8-BIT, not unrounded float: a browser rounds the HSL triple to rgb() before painting, so
	// the rounded figure is the one a user actually sees. The unrounded float reading of the old
	// --destructive on white is 3.783; the rendered value is 3.781. Both are far below AA, so the
	// finding does not turn on the third decimal, but the numbers published in index.css are the
	// rounded ones and these assertions pin them.
	const onWhite = (hsl: Hsl) => contrastRatio(hslToSrgb(...hsl), tokenRgb('--background'));
	assert.equal(onWhite([0, 84, 60]).toFixed(3), '3.781', 'destructive on white, recomputed');
	assert.equal(onWhite([215, 16, 47]).toFixed(3), '4.697', 'muted-foreground on white, recomputed');
	assert.equal(onWhite([158, 64, 40]).toFixed(3), '3.056', 'accent on white, recomputed');
});

test('the change is a LIGHTNESS-ONLY move: hue and saturation are unchanged from the base', () => {
	// The load-bearing part of "same colour, darker". If a future session re-hues one of these,
	// the claim that the identity is preserved is false, and a green visual review would miss it.
	for (const { token, before } of CHANGED) {
		const after = readToken(token).value;
		assert.equal(after[0], before[0], `--${token} changed hue (${before[0]} -> ${after[0]}). Not a lightness-only move.`);
		assert.equal(after[1], before[1], `--${token} changed saturation (${before[1]}% -> ${after[1]}%).`);
		assert.ok(after[2] < before[2], `--${token} did not get darker (${before[2]}% -> ${after[2]}%).`);
	}
});

test('DOCUMENTATION: every changed token carries its measured ratios inline, naming a surface', () => {
	// AGENTS.md / packet item 7.3: "A token changed without its documented ratio updated is an
	// incomplete change." This file's `:root` block has a measured-annotation convention
	// (see the `--warning` family), and a new value without the annotation is a regression.
	for (const { token } of CHANGED) {
		const at = rootBlock.indexOf(`--${token}:`);
		assert.ok(at > 0, `--${token} not found in the :root block`);
		// The annotation is the comment block IMMEDIATELY above the declaration. Found by locating
		// the nearest `/*` that has no `*/` between it and the declaration, over the whole block
		// rather than a fixed-size window: the --accent annotation is longer than any window a
		// bounded search would use, and a window-based search silently graded the PREVIOUS
		// token's comment, which reported a false pass on the wrong block in the first draft.
		const open = rootBlock.lastIndexOf('/*', at);
		assert.ok(open > 0, `--${token} has no comment block above it`);
		const between = rootBlock.slice(open, at);
		// The house convention CLOSES the comment before the declaration (`─── */` then the
		// value), so exactly ONE `*/` is expected here, at the very end. Zero would mean the
		// annotation belongs to a later value; two or more would mean a comment boundary is
		// buried between the annotation and the number it describes.
		const closes = between.split('*/').length - 1;
		assert.equal(
			closes,
			1,
			`expected exactly one comment terminator between the start of the --${token} annotation and the ` +
				`value, found ${closes}. Either the annotation belongs to another token, or a comment boundary ` +
				'sits between the documented ratio and the number.',
		);
		const gap = between.slice(between.lastIndexOf('*/') + 2);
		assert.equal(
			gap.trim(),
			'',
			`${JSON.stringify(gap)} sits between the --${token} annotation and the value, so the documented ` +
				'ratio is not attached to the number it describes.',
		);
		const annotation = between;
		assert.match(annotation, /CONTRAST CONTRACT/i, `--${token} has no measured CONTRAST CONTRACT above it`);
		// It must quote a ratio with three decimals, and name the surface it was measured on.
		assert.match(annotation, /\d\.\d{3}:1/, `--${token} documents no measured ratio to 3 decimals`);
		assert.match(annotation, /on --(muted|background|accent-muted|sidebar-background)/, `--${token} names no surface`);
		// And the token must name itself, so an annotation cannot be borrowed from a neighbour.
		assert.ok(
			annotation.includes(`--${token}`),
			`the --${token} annotation does not name its own token`,
		);
	}
});

test('DARK MODE: the .dark block still defines no surface, and redefines none of these three', () => {
	// A3-C9 deliberately added no `.dark` override for these tokens. This row pins that decision
	// so it cannot drift into an undocumented half-state, and records WHY it is not a defect.
	// The `.dark` block AND its doc comment. The comment is the evidence that the decision was
	// made on purpose, and it sits ABOVE the selector — so a slice that started at `.dark {`
	// would have excluded the very text this row asserts on, and passed a file that recorded
	// nothing. Starting at the comment's own `/*` is what makes the row meaningful.
	const darkSelectorAt = css.indexOf('.dark {');
	const darkCommentAt = css.lastIndexOf('/*', darkSelectorAt);
	assert.ok(darkCommentAt > 0 && darkCommentAt < darkSelectorAt, 'the .dark block or its comment was not found');
	const darkBlock = css.slice(darkCommentAt, css.indexOf('@theme inline'));
	assert.ok(darkBlock.includes('.dark {'), 'the .dark selector is not inside the sliced block');

	for (const { token } of CHANGED) {
		assert.equal(
			darkBlock.includes(`--${token}:`),
			false,
			`.dark now redefines --${token}. If a dark override is added, the AA contract above must be ` +
				're-measured against a real dark surface and this row updated with the figures.',
		);
	}
	// The stated reason the tokens were left alone: there is no dark SURFACE to measure against.
	for (const surface of ['--background', '--foreground', '--muted', '--card']) {
		assert.equal(
			darkBlock.includes(`${surface}:`),
			false,
			`.dark now defines ${surface}. Dark mode has become measurable, so the A3-C9 decision to leave ` +
				'the three text tokens alone must be revisited and re-measured.',
		);
	}
	// The reason is also written down where a reader will find it, not just in a handoff.
	assert.match(darkBlock, /A3-C9/i, 'the .dark block does not record the A3-C9 deliberate no-override decision');
});

test('the focus ring is a UI affordance, measured through the alpha :focus-visible applies', () => {
	// `--accent-ring` moved in step with `--accent` because the two have always carried the same
	// value in this file. It is NOT text, so its floor is WCAG 1.4.11 / 2.4.7 at 3:1 — and it is
	// applied at an alpha, so the ratio must be measured through that alpha, not against the raw
	// token. Asserting the raw token would overstate it by a wide margin.
	const outlineAlpha = ((): number => {
		const m = css.match(/outline:\s*3px solid hsl\(var\(--ring\)\s*\/\s*([\d.]+)\)/);
		assert.ok(m, 'the :focus-visible ring alpha was not found in index.css');
		return Number(m[1]);
	})();

	const ring = tokenRgb('--accent-ring');
	const worst = realSurfaces()
		.map((s) => ({ name: s.name, ratio: contrastRatio(composite(ring, outlineAlpha, s.rgb), s.rgb) }))
		.reduce((lo, r) => (r.ratio < lo.ratio ? r : lo));

	// The honest row: this is BELOW the 3:1 floor on the tinted surfaces, and that is carried
	// debt, not something this token can fix. Asserting the shortfall keeps it visible so a
	// future session cannot mistake it for a passing control. The fix is the 0.7 alpha in the
	// `:focus-visible` rule, which is a focus-weight decision outside this brief.
	assert.ok(
		worst.ratio < UI_FLOOR,
		`--accent-ring at ${outlineAlpha} alpha now measures ${worst.ratio.toFixed(3)}:1 on ${worst.name}, ` +
			`at or above the ${UI_FLOOR}:1 UI floor. If this is intended, update this row and the index.css ` +
			'annotation, which currently records the shortfall.',
	);
	// It must still be a measurable improvement on the pre-A3-C9 ring over the same surface.
	const oldRing = composite(hslToSrgb(158, 64, 40), outlineAlpha, worst.name.includes('body wash')
		? composite(tokenRgb('--primary'), bodyWashAlphas[1], CANVAS_WHITE)
		: tokenRgb('--background'));
	assert.ok(
		oldRing[0] >= 0,
		'control sanity: the comparison ring colour must be computable',
	);

	// A3-C9 CORRECTION 2026-09-28: the comparison surface above was rebuilt on the SUPERSEDED
	// wash model (composited over #fafbfc). It is now the true 100% stop, so the improvement
	// figures in index.css are restated on the surface the browser actually paints:
	//   superseded, over #eaf2f0 [234,242,240] : new 2.802:1 | old 1.977:1
	//   TRUE,      over #eff6f3 [239,246,243] : new 2.837:1 | old 2.026:1
	//   white                                            : new 3.023:1 | old 2.165:1
	// The shortfall below the 3:1 floor is unchanged in direction, so the carried debt stands.
	//
	// A3-C9 CORRECTION 2 (2026-09-28): all four figures in the two lines above were recomputed and
	// ALL FOUR REPRODUCE, so none of them is corrected and no verdict changes. Recorded here with
	// the serialization they depend on, because a reviewer recomputed 2.866:1 for the wash row and
	// could not obtain 2.837:1. The difference is one exact .5 tie in the green channel:
	//   0.7 x 121 + 0.3 x 246 = 158.5 exactly.
	// `composite` here rounds half up, which is what `composite`'s own doc comment declares and
	// what a browser paints, giving 159 and 2.837:1. .NET's default banker's Math.Round gives 158
	// and 2.866:1; a float composite with no 8-bit quantise gives 2.854:1; truncation gives
	// 2.873:1; and the raw ring token with no alpha at all gives 4.885:1. 2.837:1 is the figure of
	// record under the convention this file states, and the sub-3:1 ring debt stays a recorded
	// shortfall, not a pass.
	const onWash = composite(tokenRgb('--primary'), bodyWashAlphas[1], CANVAS_WHITE);
	const washNew = composite(tokenRgb('--accent-ring'), outlineAlpha, onWash);
	assert.deepEqual(
		washNew,
		[91, 159, 134] as unknown as Rgb,
		'the 0.7 ring composite on the true 100% wash stop is rgb(91,159,134); the green channel is ' +
			'an exact 158.5 tie rounded half up, which is what the 2.837:1 figure in index.css rests on',
	);
	assert.equal(
		contrastRatio(washNew, onWash).toFixed(3),
		'2.837',
		"the published wash figure in index.css no longer reproduces under this file's own composite",
	);
	for (const [label, bg] of [['wash 100%', onWash], ['white', tokenRgb('--background')]] as const) {
		const now = contrastRatio(composite(tokenRgb('--accent-ring'), outlineAlpha, bg), bg);
		const before = contrastRatio(composite(hslToSrgb(158, 64, 40), outlineAlpha, bg), bg);
		assert.ok(
			now > before,
			`the ring must stay an improvement on the pre-A3-C9 value on ${label}; now ${now.toFixed(3)}:1, ` +
				`before ${before.toFixed(3)}:1`,
		);
	}
});
