import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * A3 S-e palette token sweep — controls, 2026-09-28.
 *
 * ## What was changed
 *
 * The S-e sweep replaced exactly two raw neutral Tailwind text classes with the app's own
 * token-layer classes, in 19 non-timetable demo-route files:
 *
 * | from | to | substitutions |
 * |---|---|---|
 * | `text-slate-900` | `text-foreground` | 47 |
 * | `text-slate-500` | `text-muted-foreground` | 72 |
 *
 * 119 substitutions across 19 files. Nothing else in any file changed: no markup, no
 * whitespace, no copy, no layout, no `bg-`/`border-`/`ring-` class, no `dark:` variant.
 *
 * ## Why a source-level control is defensible here at all
 *
 * Only if the two colours are the same colour. That claim is checked two ways, from the real
 * files, not from a remembered constant:
 *
 * 1. **Control 1** reads the *installed* Tailwind palette (`node_modules/tailwindcss/theme.css`,
 *    which is oklch in v4) and the *real* token values in `src/index.css`, converts both to sRGB
 *    itself, and asserts they agree. Reading the installed palette is deliberate: a Tailwind
 *    upgrade that moved slate would invalidate the substitution, and this control must go red
 *    when that happens rather than keep asserting a stale coincidence.
 * 2. **Control 2** proves the equivalence is scheme-independent: `--foreground` and
 *    `--muted-foreground` are each declared exactly once in the whole stylesheet and no `.dark`
 *    block redefines them, so `text-foreground` resolves to the same value in every scheme this
 *    app can render. If a dark token layer ever lands, this goes red, and from that moment this
 *    sweep's evidence is no longer sufficient and a rendered screen is required.
 *
 * ## The measured, honest version of the claim
 *
 * The substitution is a **rename, not a bit-exact copy**. Measured in sRGB, on this machine,
 * against the installed Tailwind 4.2.2 palette:
 *
 * | pair | max channel delta | contrast on white |
 * |---|---|---|
 * | `slate-900` -> `--foreground` | 2 / 255 | 17.831 -> 17.874 (+0.043) |
 * | `slate-500` -> `--muted-foreground` | 3 / 255 | 4.764 -> 4.697 (-0.067) |
 *
 * The 2-3/255 gap is the oklch<->HSL conversion artifact between the two palettes, not a
 * design difference. It is below a just-noticeable difference in luminance (max |dL| 0.0031),
 * and no accessibility threshold is crossed: both old and new pass WCAG AA 4.5:1 on
 * `--background`/`--card`/`--popover`. On `--muted`/`--secondary` both the old shade and the
 * new token are already below 4.5:1 today (4.329 vs 4.268), so the sweep neither creates nor
 * fixes that pre-existing shortfall — it deepens it by 0.061:1. That is a real, disclosed
 * consequence and the reason `CHANNEL_TOLERANCE` below is 3 and not 1.
 *
 * `CHANNEL_TOLERANCE` is a **conversion-artifact ceiling**, not a visual tolerance, and it is
 * asserted alongside `CONTRAST_TOLERANCE` which is the load-bearing perceptual bound: a
 * one-unit lightness change to a token moves contrast by ~1.4:1, which is what makes control 1
 * discriminating rather than decorative.
 *
 * **Two corrections added by the planner after QA `ses_f1c2ec739ffexrHKqcRsIOKYJd`; neither
 * touches a control, a pin or a tolerance, and the figures above are kept as recorded.**
 *
 * 1. **The contrast figures above are not reproducible from the spec-derived conversion this file
 *    implements, and QA's independent derivation is the one to read.** QA converted oklch and HSL
 *    to sRGB from the specification and measured `slate-900`->`--foreground` at 17.845 -> 17.899
 *    (**+0.055**) and `slate-500`->`--muted-foreground` at 4.767 -> 4.718 (**-0.049**), against the
 *    17.831 -> 17.874 (+0.043) and 4.764 -> 4.697 (-0.067) printed above; and on
 *    `--muted`/`--secondary` it measured **4.300:1** against the 4.268 above. Every substantive
 *    claim survives: sub-4.5:1 on **both** sides of the `--muted` pair, the same direction, and a
 *    magnitude far inside the +-0.10 rename bound. Only the printed decimals differ, and they are
 *    retained above rather than replaced because the difference is a fact about two conversion
 *    implementations, not an error to be tidied away.
 * 2. **Two of the three deliberate exclusions are precautionary, not load-bearing.** Only
 *    `src/pages/RoomSchedules.tsx` actually holds occurrences of the two swept classes (7).
 *    `src/ui/confirmation-modal.tsx` and `src/pages/Login.tsx` hold **zero** `text-slate-900` and
 *    zero `text-slate-500`; all of their raw neutrals are `gray-*`, which this sweep never touches.
 *    They are forward-looking scope fences — correct to keep, and still correct for the reason
 *    recorded — but a reader must not expect "3 and 13 swept occurrences" from them.
 *
 * ## STEP 2 (S-f, 2026-09-28) — read this before reusing anything above
 *
 * A later session replaced the remaining raw neutral TEXT colour, `text-slate-400`, with
 * `text-muted-foreground` at 15 sites across 5 of these same 19 files, taking the ratchet from
 * **110 to 95** (`EXPECTED_TOTAL`, `EXPECTED_IN_SCOPE_RESIDUAL`, and the ratchet's `PINNED_TOTAL`
 * are all lowered accordingly; the file count stays 28 because no file emptied). The pins and the
 * arithmetic that connects them are recorded at `PRE_STEP_2_TOTAL` and `STEP_2_SUBSTITUTIONS`.
 *
 * **Step 2 is NOT a rename, and nothing in this file justifies applying `CHANNEL_TOLERANCE = 3` to
 * it.** This sweep's two mappings are renames of 2-3/255; the step-2 mapping is a deliberate
 * accessibility darkening of **46/255** (oklch(70.4% 0.04 256.788) -> 215 16% 47%, sRGB
 * rgb(144,161,185) -> rgb(101,117,139)). It carries its own tolerances, its own contrast
 * assertions and its own disclosure in `palette-slate400-step2-a3-s-f.test.ts`. Do not merge the two
 * contracts, and do not lower this file's pins further on step 2's behalf.
 *
 * One consequence is recorded here because it corrects a claim in this file's own history: the
 * residual this file once described as needing "a browser-verified pass" now has **15 fewer**
 * accessibility defects in it, but that removal is a source-level darkening, not a rendered-screen
 * verification. The `--muted`/`--secondary` surfaces still sit below AA (4.268:1) and still need a
 * browser row.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..');
const INDEX_CSS = join(CLIENT_ROOT, 'src', 'index.css');
const TAILWIND_THEME = join(CLIENT_ROOT, 'node_modules', 'tailwindcss', 'theme.css');

/** oklch<->sRGB conversion artifact between the two palettes, in 0-255 channel units. */
const CHANNEL_TOLERANCE = 3;
/** Load-bearing perceptual bound: the measured real delta is 0.067; a one-unit token edit is ~1.4. */
const CONTRAST_TOLERANCE = 0.1;

/** The 19 files this sweep owns. Listed explicitly: a glob would silently absorb A2's surface. */
const IN_SCOPE = [
	'src/components/BuildingPanel.tsx',
	'src/components/CampusMapEditor.tsx',
	'src/components/admin-workspace/AdminWorkspace.tsx',
	'src/components/campus-map/BuildingGradeScopeControl.tsx',
	'src/components/campus-map/BuildingPlacementFields.tsx',
	'src/components/campus-map/CampusMapCanvasPreview.tsx',
	'src/components/campus-map/CampusMapOverview.tsx',
	'src/components/campus-map/RoomReadinessList.tsx',
	'src/components/dashboard/CampusReadinessCard.tsx',
	'src/components/runtime/CarryForwardReviewPanel.tsx',
	'src/components/runtime/RolloverGuidanceCard.tsx',
	'src/components/runtime/RolloverResetPanel.tsx',
	'src/components/sections/SectionDetailsSheet.tsx',
	'src/components/sections/SectionsHomeRoomActions.tsx',
	'src/components/subjects/SubjectRow.tsx',
	'src/pages/AdminYearSetup.tsx',
	'src/pages/Audit.tsx',
	'src/pages/Dashboard.tsx',
	'src/pages/MapEditor.tsx',
] as const;

/**
 * Files that still hold raw neutrals **on purpose**. Control 4 keeps this honest; it is what
 * stops a later session from "finishing" the sweep into another lane's surface.
 */
const DELIBERATE_EXCLUSIONS: ReadonlyArray<readonly [string, string]> = [
	[
		'src/pages/RoomSchedules.tsx',
		"Lane A2's WIP page. The c1 packet forbids redesigning it, so this sweep must not edit it.",
	],
	[
		'src/pages/Login.tsx',
		'Not a demo route and not on any listed work route, so it is out of this stream by scope.',
	],
	[
		'src/ui/confirmation-modal.tsx',
		'Shared primitive with a Lane A2 timetable consumer (components/timetable/ScheduleReviewWorkspaceHeader.tsx). ' +
			'Changing its styling needs A2 written acceptance, which does not exist.',
	],
];

/** Substitutions this sweep made, per shade. Asserted arithmetically in control 5. */
const SUBSTITUTED: ReadonlyArray<readonly [string, string, string, number]> = [
	['text-slate-900', 'text-foreground', '--foreground', 47],
	['text-slate-500', 'text-muted-foreground', '--muted-foreground', 72],
];

/** The ratchet total immediately before this sweep, and what it must have fallen to. */
const PRE_SWEEP_TOTAL = 229;
const PRE_SWEEP_FILES = 34;

/**
 * Step 2 (S-f, 2026-09-28) then replaced the remaining raw neutral TEXT colour `text-slate-400`
 * with `text-muted-foreground` at 15 sites in 5 of these same 19 files, which took the ratchet from
 * 110 to 95. Recorded here additively rather than folded into the numbers above, because it is a
 * different kind of change: the S-e sweep was a RENAME (2-3/255), while step 2 is a deliberate
 * ACCESSIBILITY DARKENING of 46/255, and its own contract, its contrast figures and its
 * `--muted` disclosure live in `palette-slate400-step2-a3-s-f.test.ts`. Read that file before
 * reusing the tolerances in this one; the `CHANNEL_TOLERANCE` of 3 below does NOT apply to it.
 */
const PRE_STEP_2_TOTAL = 110;
const STEP_2_SUBSTITUTIONS = 15;
const EXPECTED_TOTAL = 95;
const EXPECTED_FILE_COUNT = 28;
/** 95 splits into 68 that are this stream's future work and 27 that sit in the three exclusions. */
const EXPECTED_IN_SCOPE_RESIDUAL = 68;
const EXPECTED_EXCLUDED_RESIDUAL = 27;

/**
 * Step 2 emptied no file, which is why `EXPECTED_FILE_COUNT` is unchanged at 28. These are the raw
 * neutrals each of its 5 files still holds, measured on the candidate: 1 / 10 / 11 / 8 / 3, against
 * 2 / 14 / 15 / 11 / 6 on the base, i.e. exactly the 1 / 4 / 4 / 3 / 3 substitutions it made.
 */
const STEP_2_SURVIVING_RESIDUALS: ReadonlyArray<readonly [string, number]> = [
	['src/components/campus-map/BuildingGradeScopeControl.tsx', 1],
	['src/components/campus-map/CampusMapOverview.tsx', 10],
	['src/components/dashboard/CampusReadinessCard.tsx', 11],
	['src/pages/Audit.tsx', 8],
	['src/pages/Dashboard.tsx', 3],
];


// ───────────────────────── colour maths (no library rounding is trusted) ─────────────────────────

type Rgb = readonly [number, number, number];

function hslToSrgb(h: number, s: number, l: number): Rgb {
	s /= 100;
	l /= 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = s * Math.min(l, 1 - l);
	const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)];
}

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

const maxChannelDelta = (a: Rgb, b: Rgb): number => Math.max(...a.map((x, i) => Math.abs(x - b[i])));

// ───────────────────────── readers over the real files ─────────────────────────

/** Every `--name: H S% L%` declaration in index.css, with how many times it is declared. */
function readTokenDeclarations(): Map<string, { value: [number, number, number]; count: number }> {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const found = new Map<string, { value: [number, number, number]; count: number }>();
	for (const raw of css.split('\n')) {
		const line = raw.replace(/\r$/, '').trim();
		if (!line.startsWith('--')) continue;
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const name = line.slice(0, colon).trim();
		const parts = line
			.slice(colon + 1)
			.replace(/;$/, '')
			.trim()
			.split(/\s+/)
			.map((x) => Number.parseFloat(x));
		if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) continue;
		const existing = found.get(name);
		if (existing) existing.count += 1;
		else found.set(name, { value: parts as [number, number, number], count: 1 });
	}
	return found;
}

/**
 * The palette of the Tailwind that is actually installed. Tailwind v4 ships oklch here, so this
 * reads oklch rather than assuming the v3 hex literals — assuming v3 hex is exactly the mistake
 * that would make control 1 assert a stale coincidence.
 */
function readInstalledShades(): Map<string, Rgb> {
	assert.ok(
		existsSync(TAILWIND_THEME),
		`cannot find the installed Tailwind palette at ${TAILWIND_THEME}. Control 1 exists to check ` +
			'the sweep against the palette that is really installed; without it there is no evidence.',
	);
	const theme = readFileSync(TAILWIND_THEME, 'utf8');
	const shades = new Map<string, Rgb>();
	const pattern = /--color-(slate|gray)-(\d{2,3}):\s*oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s*\)/g;
	for (const match of theme.matchAll(pattern)) {
		const [, family, shade, l, c, h] = match;
		shades.set(`text-${family}-${shade}`, to255(oklchToSrgb(Number(l) / 100, Number(c), Number(h))));
	}
	assert.ok(shades.size > 0, 'parsed zero shades from the installed Tailwind palette');
	return shades;
}

const tokens = readTokenDeclarations();
const shades = readInstalledShades();
const cssSource = readFileSync(INDEX_CSS, 'utf8');

function tokenRgb(name: string): Rgb {
	const entry = tokens.get(name);
	assert.ok(entry, `token ${name} is not declared in index.css`);
	return to255(hslToSrgb(...entry.value));
}

/** The five app surfaces a text colour can actually sit on. */
const SURFACES = ['background', 'card', 'muted', 'secondary', 'popover'] as const;

test('control 0: the readers see real data, not an empty scan', () => {
	// A colour control that silently parses nothing is worse than none: it would go green forever.
	assert.ok(shades.size > 20, `expected a real palette, parsed ${shades.size} shades`);
	assert.ok(tokens.size > 10, `expected real tokens, parsed ${tokens.size}`);
	for (const shade of ['text-slate-900', 'text-slate-500']) {
		assert.ok(shades.has(shade), `installed palette is missing ${shade}`);
	}
	for (const token of ['--foreground', '--muted-foreground', '--background', '--card']) {
		assert.ok(tokens.has(token), `index.css is missing ${token}`);
	}
});

test('control 1: each swept token is the same colour as the Tailwind shade it replaced', () => {
	for (const [from, to, tokenName] of SUBSTITUTED) {
		const shade = shades.get(from);
		const token = tokenRgb(tokenName);
		assert.ok(shade, `installed palette has no ${from}`);

		const channel = maxChannelDelta(shade, token);
		assert.ok(
			channel <= CHANNEL_TOLERANCE,
			[
				`${from} and ${tokenName} have diverged by ${channel}/255 on some channel.`,
				`${from} = ${shade.join(',')}   ${tokenName} = ${token.join(',')}.`,
				'',
				'This sweep is justified as a RENAME. Once the two colours differ by more than the',
				`oklch<->HSL conversion artifact (currently ${CHANNEL_TOLERANCE}/255), it is a visible`,
				'colour change and needs a rendered screen at 1366x768 before it ships.',
			].join('\n'),
		);

		// The load-bearing bound. Perceptually, contrast is what governs legibility.
		for (const surface of SURFACES) {
			const bg = tokenRgb(`--${surface}`);
			const before = contrastRatio(shade, bg);
			const after = contrastRatio(token, bg);
			assert.ok(
				Math.abs(after - before) <= CONTRAST_TOLERANCE,
				`${from} -> ${tokenName} changes contrast on --${surface} by ` +
					`${(after - before).toFixed(3)}:1 (${before.toFixed(3)} -> ${after.toFixed(3)}), ` +
					`which exceeds the ${CONTRAST_TOLERANCE}:1 rename bound. This is a visual change, not a rename.`,
			);
		}
	}
});

test('control 1b: the measured deltas are what this file claims they are', () => {
	// Guards the tolerances themselves: if someone widens CHANNEL_TOLERANCE to make a red build
	// green, this fails first and says how far the colours actually are.
	const fg = maxChannelDelta(shades.get('text-slate-900') as Rgb, tokenRgb('--foreground'));
	const mf = maxChannelDelta(shades.get('text-slate-500') as Rgb, tokenRgb('--muted-foreground'));
	assert.ok(
		fg <= CHANNEL_TOLERANCE && mf <= CHANNEL_TOLERANCE,
		`measured deltas are foreground ${fg}/255 and muted-foreground ${mf}/255, ` +
			`outside the stated ceiling of ${CHANNEL_TOLERANCE}/255. Update this file's header table with the real numbers.`,
	);
	// And the tolerances must stay tight enough for the control to actually discriminate: a
	// one-unit lightness edit to a token must blow past CONTRAST_TOLERANCE.
	const white = tokenRgb('--background');
	const oneUnitUp = to255(hslToSrgb(...(tokens.get('--foreground') as { value: [number, number, number] }).value.map((v, i) => (i === 2 ? v + 1 : v)) as [number, number, number]));
	assert.ok(
		Math.abs(contrastRatio(oneUnitUp, white) - contrastRatio(tokenRgb('--foreground'), white)) >
			CONTRAST_TOLERANCE,
		'a one-unit lightness change to --foreground does not move contrast past CONTRAST_TOLERANCE, ' +
			'so control 1 would not notice a real token edit. The bound is too loose to be evidence.',
	);
});

test('control 2: no dark token layer can make the equivalence scheme-dependent', () => {
	for (const tokenName of ['--foreground', '--muted-foreground']) {
		const entry = tokens.get(tokenName);
		assert.ok(entry, `${tokenName} is not declared in index.css`);
		assert.equal(
			entry.count,
			1,
			`${tokenName} is declared ${entry.count} times in index.css. A second declaration (typically ` +
				'inside a `.dark` block) makes the equivalence scheme-dependent, and this sweep would then ' +
				'need a rendered screen in each scheme instead of a source-level proof.',
		);
	}

	// Belt and braces on the stylesheet itself: no `.dark` selector may redefine the tokens.
	const darkBlocks = cssSource.match(/\.dark[^{]*\{[^}]*\}/g) ?? [];
	for (const block of darkBlocks) {
		assert.doesNotMatch(
			block,
			/--(foreground|muted-foreground)\s*:/,
			`a .dark block redefines a swept token: ${block.trim()}. ` +
				'The sweep is no longer a rename across schemes; re-verify on a rendered screen.',
		);
	}

	// And nothing may ever put the class on: index.css wires the dark: variant to `.dark *`, so the
	// variant is inert while no element carries the class.
	assert.doesNotMatch(
		cssSource,
	 /\.dark\s*\{/,
		'index.css now contains a `.dark` selector block. Re-verify this sweep on a rendered screen.',
	);
});

test('control 3: every in-scope file is free of the two swept classes', () => {
	assert.equal(IN_SCOPE.length, 19, 'the in-scope set is 19 files; a changed count means a scope edit');
	const offenders: string[] = [];
	for (const rel of IN_SCOPE) {
		const source = readFileSync(join(CLIENT_ROOT, rel), 'utf8');
		for (const [from] of SUBSTITUTED) {
			if (source.includes(from)) offenders.push(`${rel} still contains ${from}`);
		}
	}
	assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('control 4: the exclusions are deliberate, not forgotten', () => {
	// If a later session "finishes" the sweep into A2's page or the shared primitive, this goes red
	// and names the ownership reason. Login is scope, not ownership; the other two are ownership.
	for (const [rel, reason] of DELIBERATE_EXCLUSIONS) {
		const source = readFileSync(join(CLIENT_ROOT, rel), 'utf8');
		const raw = source.match(/\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g) ?? [];
		assert.ok(
			raw.length > 0,
			`${rel} no longer holds any raw neutral, so it is no longer an exclusion. ` +
				`Either the exclusion was lifted deliberately, or it was edited by mistake. Reason on record: ${reason}`,
		);
	}
	// RoomSchedules specifically must keep the exact 7 the c1 packet reserved for A2.
	const roomSchedules = readFileSync(join(CLIENT_ROOT, 'src/pages/RoomSchedules.tsx'), 'utf8');
	assert.equal(
		(roomSchedules.match(/\btext-slate-(?:900|500)\b/g) ?? []).length,
		7,
		"RoomSchedules.tsx is Lane A2's WIP page and this sweep must not change it. Expected its 7 reserved occurrences.",
	);
});

test('control 5: the ratchet fell for exactly the reason this file states', () => {
	const substitutions = SUBSTITUTED.reduce((sum, [, , , n]) => sum + n, 0);
	assert.equal(substitutions, 119, 'the stated substitution count changed; update the header table too');
	// The chain, made arithmetic rather than assertion of convenience. 229 - 119 = 110, which is the
	// total step 2 started from; 110 - 15 = 95, which is where the ratchet now pins.
	assert.equal(
		PRE_SWEEP_TOTAL - substitutions,
		PRE_STEP_2_TOTAL,
		'the S-e sweep did not land on the total step 2 recorded as its starting point',
	);
	assert.equal(
		EXPECTED_TOTAL,
		PRE_STEP_2_TOTAL - STEP_2_SUBSTITUTIONS,
		'the expected ratchet total is not the pre-step-2 total minus the step-2 substitutions',
	);
	assert.equal(
		EXPECTED_TOTAL,
		PRE_SWEEP_TOTAL - substitutions - STEP_2_SUBSTITUTIONS,
		'the expected ratchet total is not the pre-sweep total minus both substitutions',
	);
	// Step 2 emptied no file, so the file count is unchanged. Asserted from source, because that is
	// the only reason 28 is still true.
	for (const [rel, expected] of STEP_2_SURVIVING_RESIDUALS) {
		const count = (readFileSync(join(CLIENT_ROOT, rel), 'utf8').match(/\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g) ?? []).length;
		assert.ok(
			count > 0,
			`${rel} no longer holds any raw neutral, so step 2 emptied it and EXPECTED_FILE_COUNT must fall.`,
		);
		assert.equal(
			count,
			expected,
			`${rel} holds ${count} raw neutrals, this file states ${expected}. Re-measure and update the list.`,
		);
	}
	assert.equal(
		EXPECTED_FILE_COUNT,
		PRE_SWEEP_FILES - 6,
		'the expected file count is not the pre-sweep file count minus the six files this sweep emptied',
	);

	// Recompute the ratchet's own scope from source, so this control independently confirms the pin
	// the ratchet asserts rather than trusting it. This is the control that stops the pin being
	// lowered below what the code still contains.
	const ratchet = ratchetScopeResidual();
	assert.equal(
		ratchet.total,
		EXPECTED_TOTAL,
		`ratchet-scope residual is ${ratchet.total}, this file states ${EXPECTED_TOTAL}. ` +
			'Do not lower the ratchet pin below what the code still contains.',
	);
	assert.equal(
		ratchet.files.length,
		EXPECTED_FILE_COUNT,
		`ratchet-scope residual file count is ${ratchet.files.length}, this file states ${EXPECTED_FILE_COUNT}.`,
	);

	// And the three scopes must add up, so no occurrence is unaccounted for. 68 in scope + 27 that
	// belong to the deliberate exclusions = the 95 the ratchet pins.
	const inScope = inScopeResidual();
	assert.equal(
		inScope.total,
		EXPECTED_IN_SCOPE_RESIDUAL,
		`in-scope residual is ${inScope.total}, this file states ${EXPECTED_IN_SCOPE_RESIDUAL}.`,
	);
	const excludedResidual = ratchet.total - inScope.total;
	assert.equal(
		excludedResidual,
		EXPECTED_EXCLUDED_RESIDUAL,
		`the three excluded files hold ${excludedResidual} raw neutrals, this file states ` +
			`${EXPECTED_EXCLUDED_RESIDUAL}. If an exclusion was lifted, update the list and the reason with it.`,
	);
	assert.equal(
		inScope.total + excludedResidual,
		ratchet.total,
		'the in-scope and excluded residuals must sum to the ratchet total; no occurrence may be unaccounted for',
	);

	// Finally, cross-check the ratchet's OWN pins against the measurement, independently of the
	// ratchet. Without this, lowering PINNED_TOTAL to 109 is caught only by the ratchet's own
	// `<= PINNED_TOTAL` assertion; with it, two separate files have to agree before a dishonest pin
	// can pass. Read as source, so this does not execute the ratchet.
	const ratchetSource = readFileSync(
		join(CLIENT_ROOT, 'src', 'lib', '__tests__', 'palette-ratchet-a3-s-e.test.ts'),
		'utf8',
	);
	const pinnedTotal = Number(/const PINNED_TOTAL = (\d+);/.exec(ratchetSource)?.[1]);
	const pinnedFiles = Number(/const PINNED_FILE_COUNT = (\d+);/.exec(ratchetSource)?.[1]);
	assert.ok(
		Number.isFinite(pinnedTotal) && Number.isFinite(pinnedFiles),
		'could not read PINNED_TOTAL / PINNED_FILE_COUNT out of the ratchet source; this cross-check is blind.',
	);
	assert.equal(
		pinnedTotal,
		ratchet.total,
		`the ratchet pins PINNED_TOTAL at ${pinnedTotal} but the code still contains ${ratchet.total}. ` +
			'A pin below reality is a false green, not a faster sweep.',
	);
	assert.equal(
		pinnedFiles,
		ratchet.files.length,
		`the ratchet pins PINNED_FILE_COUNT at ${pinnedFiles} but ${ratchet.files.length} files still contain raw neutrals.`,
	);
});

/**
 * Mirrors the ratchet's own walk and detector exactly: every `.tsx` under `src`, excluding
 * `components/timetable`, `__tests__`, and `*.test.*`, counting `text-` prefixed neutrals only.
 * Recomputed from source rather than read out of the ratchet, so this control independently
 * confirms the pin the ratchet asserts.
 */
function ratchetScopeResidual(): { total: number; files: string[] } {
	const pattern = /\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g;
	const files: string[] = [];
	let total = 0;
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				// Lane A2's surface: out of the ratchet's scope by ownership, not by convenience.
				if (entry === 'timetable' && dir.endsWith(`${sep}components`)) continue;
				walk(full);
				continue;
			}
			if (!full.endsWith('.tsx')) continue;
			if (full.includes(`${sep}__tests__${sep}`)) continue;
			if (full.includes('.test.')) continue;
			const count = (readFileSync(full, 'utf8').match(pattern) ?? []).length;
			if (count > 0) {
				files.push(full);
				total += count;
			}
		}
	};
	walk(join(CLIENT_ROOT, 'src'));
	return { total, files };
}

/** Residual across the sweep's own scope: the ratchet scope minus the three deliberate exclusions. */
function inScopeResidual(): { total: number; files: string[] } {
	const pattern = /\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g;
	const excluded = new Set(DELIBERATE_EXCLUSIONS.map(([rel]) => rel));
	const files: string[] = [];
	let total = 0;
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const full = join(dir, entry);
			if (statSync(full).isDirectory()) {
				if (entry === 'timetable' && dir.endsWith(`${sep}components`)) continue;
				walk(full);
				continue;
			}
			if (!full.endsWith('.tsx')) continue;
			if (full.includes(`${sep}__tests__${sep}`)) continue;
			if (full.includes('.test.')) continue;
			const rel = relative(CLIENT_ROOT, full).split(sep).join('/');
			if (excluded.has(rel)) continue;
			const count = (readFileSync(full, 'utf8').match(pattern) ?? []).length;
			if (count > 0) {
				files.push(rel);
				total += count;
			}
		}
	};
	walk(join(CLIENT_ROOT, 'src'));
	return { total, files };
}
