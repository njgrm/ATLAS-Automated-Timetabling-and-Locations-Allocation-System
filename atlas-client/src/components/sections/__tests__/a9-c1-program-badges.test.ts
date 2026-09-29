/**
 * A9 c1 (2026-09-30) — the `/sections` program badge is a solid dark fill with white text,
 * and a regular section shows a `BEC` badge instead of a second grey caption.
 *
 * THE DEFECT (operator `section.docx` item 6), quoted: *"change the color style of the badge
 * (BEC, STE, SPA, SPS). Currently it is in a lighter color and low opacity … follow how the
 * color is in the 2nd image (having darker background with white text)."* On the operator's own
 * screenshot `Bonifacio` carried `STE` and `Mabini` carried `SPS` as pale chips beside the
 * emerald `GR7` grade badge, so the program badge read as a second grade badge; and
 * `Aguinaldo`/`Luna` carried no badge at all, only a grey `REGULAR PROGRAM` caption.
 *
 * WHY THIS IS A COMPUTED CONTROL AND NOT A STRING MATCH. `AGENTS.md` §11 rejects a source-text
 * assertion as acceptance evidence for a user-facing change, and the hard limit here is a real,
 * measurable one — "white-on-fill contrast ≥ 4.5:1". So this file does the arithmetic the claim
 * needs: it reads the committed `PROGRAM_BADGE` map out of the shared module that renders it and
 * the oklch shades out of the Tailwind that is actually installed, converts both to sRGB itself,
 * and asserts the WCAG ratio. A reviewer reading a pass here is reading a measurement.
 *
 * WHY THE MAP IS READ FROM SOURCE AND NOT IMPORTED. The shared module is imported by
 * `SectionRow.tsx`/`SectionMobileCard.tsx`, which pull a React component graph (react-router, Radix,
 * Konva-adjacent imports) that needs a DOM to load; a raw import in a plain `tsx --test` process
 * would test the harness, not the colour. Reading the exported map's literal entries with the same
 * comment-stripping discipline the palette controls use keeps this control about the VALUES, which
 * is the part the operator asked to change.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..', '..');
/** A9 c1 R1: the map lives in the shared module both renderers import. */
const PROGRAM_BADGE_MODULE = resolve(CLIENT_ROOT, 'src/components/sections/program-badge.ts');
const SECTION_ROW = resolve(CLIENT_ROOT, 'src/components/sections/SectionRow.tsx');
const SECTION_MOBILE_CARD = resolve(CLIENT_ROOT, 'src/components/sections/SectionMobileCard.tsx');
const TAILWIND_THEME = resolve(CLIENT_ROOT, 'node_modules/tailwindcss/theme.css');
const WHITE: Rgb = [255, 255, 255];
/** WCAG AA for normal text. The packet's own floor. */
const AA_TEXT = 4.5;

/** The nine program codes the row can print — the packet's four plus the shipped extras. */
const EXPECTED_CODES = ['REGULAR', 'STE', 'SPA', 'SPS', 'SPJ', 'SPFL', 'SPTVE', 'OTHER'];

/* ─────────────────────────── colour maths (no library rounding is trusted) ─────────────────────────── */

type Rgb = readonly [number, number, number];

function oklchToSrgb(l: number, c: number, h: number): Rgb {
	const rad = (h * Math.PI) / 180;
	const a = c * Math.cos(rad);
	const b = c * Math.sin(rad);
	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const lc = l_ ** 3;
	const mc = m_ ** 3;
	const sc = s_ ** 3;
	const r = 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc;
	const g = -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc;
	const bl = -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc;
	const enc = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
	const clamp = (v: number) => Math.min(1, Math.max(0, enc(v)));
	return [clamp(r), clamp(g), clamp(bl)];
}

const to255 = (v: Rgb): Rgb => v.map((x) => Math.round(x * 255)) as unknown as Rgb;

function relativeLuminance(v: Rgb): number {
	const [r, g, b] = v.map((x) => {
		const c = x / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	}) as unknown as [number, number, number];
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: Rgb, b: Rgb): number {
	const l1 = relativeLuminance(a);
	const l2 = relativeLuminance(b);
	return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/* ─────────────────────────── readers over the real files ─────────────────────────── */

/** Strip comments so a design note that quotes a class can never satisfy the scan. */
function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.split('\n')
		.map((line) => {
			const i = line.indexOf('//');
			return i > 0 && line[i - 1] !== ':' ? line.slice(0, i) : line;
		})
		.join('\n');
}

/** The committed `PROGRAM_BADGE` map, as `<code> -> <class string>`. */
function readProgramBadgeMap(): Map<string, string> {
	const code = stripComments(readFileSync(PROGRAM_BADGE_MODULE, 'utf8'));
	const block = /export const PROGRAM_BADGE: Record<string, string> = \{([\s\S]*?)\n\};/.exec(code);
	assert.ok(block, 'the exported PROGRAM_BADGE map was not found in program-badge.ts');
	const out = new Map<string, string>();
	for (const m of block[1].matchAll(/([A-Z]+):\s*'([^']+)'/g)) out.set(m[1], m[2]);
	return out;
}

/** The installed Tailwind palette's `bg-<family>-<shade>` sRGB values. */
function readInstalledShades(): Map<string, Rgb> {
	const theme = readFileSync(TAILWIND_THEME, 'utf8');
	const shades = new Map<string, Rgb>();
	const pattern = /--color-([a-z]+)-(\d{2,3}):\s*oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s*\)/g;
	for (const match of theme.matchAll(pattern)) {
		const [, family, shade, l, c, h] = match;
		shades.set(`bg-${family}-${shade}`, to255(oklchToSrgb(Number(l) / 100, Number(c), Number(h))));
	}
	assert.ok(shades.size > 20, `parsed only ${shades.size} shades from the installed Tailwind palette`);
	return shades;
}

const PROGRAM_BADGE = readProgramBadgeMap();
const SHADES = readInstalledShades();

// Load-time sanity: an empty scan would make every row below vacuously true.
sourceSanity();

/**
 * The background class and the text class of one entry.
 *
 * The whole point of the fix is a SOLID background with WHITE text, so this reads both out of
 * the entry rather than assuming the text token — a future pale fill or a dark text token is a
 * failure here, not something silently ignored.
 */
function classesOf(entry: string): { bg: string; text: string } {
	const bg = entry.split(/\s+/).find((token) => /^bg-[a-z]+-\d{2,3}$/.test(token));
	const text = entry.split(/\s+/).find((token) => token.startsWith('text-'));
	assert.ok(bg, `no solid background class in "${entry}"`);
	assert.ok(text, `no text colour class in "${entry}"`);
	return { bg, text };
}

/** Load-bearing: an empty scan would make every row below vacuously true. */
function sourceSanity(): void {
	const map = readProgramBadgeMap();
	assert.ok(map.size >= 7, `the PROGRAM_BADGE map parsed only ${map.size} entries`);
	assert.ok(readInstalledShades().size > 20, 'the Tailwind palette reader saw nothing');
}

/* ─────────────────────────────────── the controls ─────────────────────────────────── */

test('A9-C1-1: the map holds every program code, incl. REGULAR for the BEC badge', () => {
	for (const code of EXPECTED_CODES) {
		assert.ok(PROGRAM_BADGE.has(code), `PROGRAM_BADGE is missing the ${code} entry`);
	}
	// A regular section shows `REGULAR`, which `programBadgeLabel` renders as `BEC`.
	assert.match(PROGRAM_BADGE.get('REGULAR') ?? '', /bg-slate-700/, 'a regular section\'s fill must be dark');
});

test('A9-C1-2: no program badge is a pale chip — every fill is a solid dark 700 shade', () => {
	const offenders: string[] = [];
	for (const [code, entry] of PROGRAM_BADGE) {
		const { bg } = classesOf(entry);
		// The base revision's pale chips were `-50` surfaces. The operator's words were
		// "lighter color and low opacity"; a `-700` fill is the darkest token family step
		// this repo already uses for solid status, and 800/900 would be heavier than needed.
		if (!/-700$/.test(bg)) offenders.push(`${code}: ${bg}`);
	}
	assert.deepEqual(offenders, [], `program badge fills must be dark (-700): ${offenders.join(', ')}`);
});

test('A9-C1-3: every program badge uses WHITE text, not a tinted foreground', () => {
	const offenders: string[] = [];
	for (const [code, entry] of PROGRAM_BADGE) {
		const { text } = classesOf(entry);
		if (text !== 'text-white') offenders.push(`${code}: ${text}`);
	}
	assert.deepEqual(offenders, [], `program badge text must be white: ${offenders.join(', ')}`);
});

test('A9-C1-4: white-on-fill clears WCAG AA 4.5:1 for every program badge', () => {
	const rows: string[] = [];
	const failures: string[] = [];
	for (const [code, entry] of PROGRAM_BADGE) {
		const { bg } = classesOf(entry);
		const fill = SHADES.get(bg);
		assert.ok(fill, `the installed Tailwind palette has no ${bg} (entry ${code})`);
		const ratio = contrastRatio(WHITE, fill);
		if (ratio < AA_TEXT) failures.push(`${code} (${bg}): ${ratio.toFixed(2)}:1`);
		rows.push(`${code} ${bg} ${ratio.toFixed(2)}:1`);
	}
	assert.deepEqual(
		failures,
		[],
		`these program badges fail the packet's 4.5:1 white-on-fill floor:\n  ${failures.join('\n  ')}\n\n${rows.join('\n')}`,
	);
});

test('A9-C1-5: the row no longer prints the duplicated "Regular Program" caption', () => {
	// The grey caption duplicated the BEC badge's meaning and sat where the program
	// badge now sits. The spelled-out special-program NAME is kept; the regular caption is not.
	const code = stripComments(readFileSync(SECTION_ROW, 'utf8'));
	assert.doesNotMatch(code, /'Regular Program'/, 'the duplicated regular-program caption came back');
	// The badge is the row's program signifier for a regular section too.
	assert.match(code, /programBadgeLabel\(/, 'the badge label must be derived, not hard-coded per branch');
});

test('A9-C1-6 (R1): the MOBILE card takes the SAME badge decision as the row, not a paler second copy', () => {
	// A9 c1 fixed the desktop row but left `SectionMobileCard.tsx` on the old pale
	// `bg-white` chip plus a grey `Regular Program` caption, so one section looked
	// like two different things on one page. The fix is one shared definition; this
	// control fails first on `51c2f2c3`, where the module does not exist and the
	// card still renders the pale chip.
	const card = stripComments(readFileSync(SECTION_MOBILE_CARD, 'utf8'));
	const module = stripComments(readFileSync(PROGRAM_BADGE_MODULE, 'utf8'));

	// Both renderers import the ONE shared definition...
	assert.match(
		card,
		/import\s*\{[^}]*programBadgeClass[^}]*\}\s*from\s*['"][^'"]*program-badge['"]/,
		'the mobile card must import the shared badge helpers',
	);
	assert.match(card, /programBadgeClass\(/, 'the mobile card must use the shared class decision');
	assert.match(card, /programBadgeLabel\(/, 'the mobile card must use the shared label');
	assert.match(card, /resolveProgramCode\(/, 'the mobile card must use the shared code resolution');

	// ...and neither card nor row keeps its own copy of the map.
	assert.doesNotMatch(card, /PROGRAM_BADGE\s*[:=]/, 'the mobile card must not define a second badge map');
	assert.doesNotMatch(card, /bg-white[^"'`]*text-xs[^"'`]*font-bold/, 'the old pale program chip must be gone');
	// The duplicated grey caption is deleted; the special PROGRAM NAME stays.
	assert.doesNotMatch(card, /'Regular Program'/, 'the duplicated regular-program caption came back');
	assert.match(card, /section\.programName/, 'the special program name must survive on the card');

	// The shared module is the single owner of the decision the two surfaces read.
	assert.match(module, /export function programBadgeClass/, 'the shared module owns the class function');
	assert.match(module, /export function resolveProgramCode/, 'the shared module owns the code resolver');
	assert.match(module, /export function programBadgeLabel/, 'the shared module owns the label function');
	// A regular section resolves to `REGULAR`, whose shared fill is dark slate:
	// both the row and the card read that one entry, never a card-local colour.
	assert.match(
		PROGRAM_BADGE.get('REGULAR') ?? '',
		/bg-slate-700/,
		'a regular section\'s shared badge must be the dark slate `BEC` fill',
	);
});

test('CONTROL (A9-C1): the contrast function CAN fail — a pale chip is reported below AA', () => {
	// The base revision's exact emerald chip. If this passes, the row above proves nothing.
	const pale = SHADES.get('bg-emerald-50');
	assert.ok(pale, 'the installed palette has no bg-emerald-50');
	const ratio = contrastRatio(WHITE, pale);
	assert.ok(ratio < AA_TEXT, `precondition: the old pale chip must fail AA, got ${ratio.toFixed(2)}:1`);
});
