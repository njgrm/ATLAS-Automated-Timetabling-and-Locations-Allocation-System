import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * A3 S-f palette step 2: text-slate-400 -> text-muted-foreground, 2026-09-28.
 *
 * ## What changed
 *
 * The remaining raw neutral TEXT colour, text-slate-400, was replaced with the app's own token
 * class text-muted-foreground in 5 non-timetable demo-route files, 15 sites:
 *
 * | file | sites |
 * |---|---|
 * | src/components/campus-map/BuildingGradeScopeControl.tsx | 1 (:36) |
 * | src/components/campus-map/CampusMapOverview.tsx | 4 (:506, :595, :620, :672) |
 * | src/components/dashboard/CampusReadinessCard.tsx | 4 (:457, :542, :567, :620) |
 * | src/pages/Audit.tsx | 3 (:748, :784, :788) |
 * | src/pages/Dashboard.tsx | 3 (:816, :859, :901) |
 *
 * 15 substitutions. Nothing else in any file changed: no markup, no spacing, no copy, no other
 * class, no reordering. Control 1 pins each site by its exact class string, so a reversion of any
 * single one of the 15 is a red build.
 *
 * ## THIS IS NOT A RENAME. It is a deliberate darkening. Do not "fix" it back.
 *
 * The S-e sweep (slate-900 -> --foreground, slate-500 -> --muted-foreground) was a rename, and its
 * CHANNEL_TOLERANCE of 3 guards that fact. THIS MAPPING IS NOT A RENAME and that tolerance must
 * not be copied here or widened to accommodate it. Measured on this machine against the installed
 * Tailwind 4.2.2 palette, converting oklch to sRGB the way palette-token-sweep-a3-s-e.test.ts does:
 *
 *   text-slate-400        = oklch(70.4% 0.04 256.788) -> sRGB rgb(144, 161, 185)
 *   --muted-foreground    = 215 16% 47%               -> sRGB rgb(101, 117, 139)
 *   per-channel delta     = 43 / 44 / 46, max 46 of 255
 *
 * 46/255 is a visible, intended darkening chosen to reach WCAG AA. Control 2 asserts the delta is
 * GREATER THAN the 3/255 rename ceiling on purpose: a future session that reads a red build here
 * and widens a tolerance, or reverts a site to "keep it looking the same", fails that assertion
 * first and is told this is accessibility work, not a colour regression.
 *
 * A packet for this stream described it as a near-exact rename with 2-3/255 deltas. That premise
 * was false, inherited from the S-e sweep, and did not transfer. The measured 46/255 is correct.
 *
 * ## A3-C9 (2026-09-28) — the token moved again, FURTHER DARKER. The 46/255 row above is
 * ## retained as history and is now the S-f value, not the current one.
 *
 *   text-slate-400        = rgb(144, 161, 185)   (unchanged; the installed palette did not move)
 *   --muted-foreground    = 215 16% 42%          -> sRGB rgb(90, 104, 124)   [was 215 16% 47%]
 *   per-channel delta     = 54 / 57 / 61, max 61 of 255   [was 43 / 44 / 46]
 *
 * Hue 215 and saturation 16 are UNCHANGED; only lightness moved 47% -> 42%. Same token, darker,
 * same reasoning, one step further. Control 2's band moves 40-50 -> 58-64 around the measured 61
 * and additionally pins the exact 61, so the band fails in BOTH directions and a drift back
 * toward the old, unreadable shade cannot pass.
 *
 * Why it moved: this file's own "STILL BELOW AA" disclosure below named the residual. `--muted-
 * foreground` is the app's SECONDARY TEXT token at **1292 `text-muted-foreground` call sites
 * across 190 files** (recursive `Get-ChildItem -Recurse -Include *.ts,*.tsx`), so 4.5:1 is the
 * applicable WCAG 1.4.3 floor, not the 3:1 UI floor, and it was failing on every light tint.
 *
 * ## Contrast, and the honest disclosure that goes with it
 *
 * | surface | text-slate-400 | --muted-foreground (S-f, 47%) | --muted-foreground (A3-C9, 42%) | WCAG AA 4.5:1 |
 * |---|---|---|---|---|
 * | --background / --card / --popover (white) | 2.630:1 | 4.697:1 | **5.650:1** | crosses AA |
 * | --muted / --secondary | 2.390:1 | 4.268:1 (**BELOW AA**) | **5.149:1** | **now crosses AA** |
 *
 * **SUPERSEDED 2026-09-28 by A3-C9, retained verbatim as history:**
 *
 * > **On --muted and --secondary this token is 4.268:1, which is still under 4.5:1. The sweep is a
 * > strict improvement on every surface (+2.067:1 on white, +1.878:1 on --muted) and a full AA pass
 * > ONLY on white and near-white surfaces.**
 *
 * That disclosure was true at S-f and was written down **because it was a defect**. A3-C9 fixed
 * the defect it named, so the disclosure is superseded by its own resolution: the token now clears
 * AA on `--muted` and `--secondary` at **5.149:1** as well, and control 2's former
 * "MANDATORY DISCLOSURE ... still under AA on --muted" row is **retained, inverted to assert the
 * fix**, and still gates. Nothing was quietly deleted: the failing claim is on the record above
 * and the replacement is beside it.
 *
 * This remains a SOURCE-LEVEL measured improvement on a global token shared with the timetable
 * and login surfaces. It is not a rendered-screen verification, and the A2 -> C handoff records
 * the timetable blast radius. Nothing in this file may be read as a claim that the app
 * now passes WCAG AA; on the two muted surfaces it does not, before or after.**
 *
 * (The packet's earlier 2.628 / 4.718 figures, and QA's 4.300 on --muted, are two other
 * conversion implementations. Both are retained in the S-e ratchet header as history. The figures
 * above are this file's, computed by the method in this file, and are what control 2 asserts.)
 *
 * ## The load-bearing site, and an exemption that was already retracted
 *
 * src/components/campus-map/BuildingGradeScopeControl.tsx:36 is an ENABLED control: the file
 * contains zero occurrences of "disabled", the element carries a live onClick, and line 36 itself
 * carries hover:text-slate-600, a hover state only an interactive control has. WCAG 1.4.3 exempts
 * only DISABLED controls, so nothing protects it. An earlier ratchet comment called it "a disabled
 * button ... a regression to preserve"; that false exemption was already corrected on main at
 * f3b8b7ab and is NOT reintroduced here. No site in this sweep is an exemption.
 *
 * ## MUST NOT TOUCH, enforced with reasons
 *
 * 1. src/components/faculty-assignments/StackedWorkloadBar.tsx:55 holds bg-slate-400. That is a
 *    background FILL, not text, and this is not a rename. Control 3 pins it.
 * 2. src/pages/RoomSchedules.tsx holds 2 text-slate-400. Lane A2's in-progress page, out of scope
 *    by decision. Control 3 pins the count at 2.
 * 3. src/components/timetable/** is Lane A2's surface. Control 3 walks it for real (130 files,
 *    never skipped) and pins zero text-slate-400, so the claim is measured rather than asserted.
 * 4. src/index.css is not edited. --muted-foreground is global and shared with timetable and login
 *    surfaces, so changing it is not local to this stream. Control 4 pins the file hash.
 */

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..');
const INDEX_CSS = join(CLIENT_ROOT, 'src', 'index.css');
const TAILWIND_THEME = join(CLIENT_ROOT, 'node_modules', 'tailwindcss', 'theme.css');
const SRC_ROOT = join(CLIENT_ROOT, 'src');
const TIMETABLE_DIR = join(SRC_ROOT, 'components', 'timetable');
const SWEEP_TEST = join(SRC_ROOT, 'lib', '__tests__', 'palette-token-sweep-a3-s-e.test.ts');
const RATCHET_TEST = join(SRC_ROOT, 'lib', '__tests__', 'palette-ratchet-a3-s-e.test.ts');

/**
 * The 15 sites, each pinned by the exact class string that carried text-slate-400 on the base.
 * 'from' must be present on the base and absent on the candidate; 'count' is how many times that
 * exact string occurred in that file on the base, so a file that moved only some of its identical
 * sites still fails.
 */
const SWEPT: ReadonlyArray<readonly [string, string, number]> = [
	[
		'src/components/campus-map/BuildingGradeScopeControl.tsx',
		'border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300',
		1,
	],
	[
		'src/components/campus-map/CampusMapOverview.tsx',
		'flex flex-col items-center justify-center py-12 text-center text-slate-400',
		1,
	],
	[
		'src/components/campus-map/CampusMapOverview.tsx',
		'absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400',
		1,
	],
	[
		'src/components/campus-map/CampusMapOverview.tsx',
		'text-center py-8 text-xs text-slate-400 border border-dashed rounded-xl',
		1,
	],
	['src/components/campus-map/CampusMapOverview.tsx', 'italic text-slate-400', 1],
	[
		'src/components/dashboard/CampusReadinessCard.tsx',
		'flex flex-col items-center justify-center py-12 text-center text-slate-400',
		1,
	],
	[
		'src/components/dashboard/CampusReadinessCard.tsx',
		'absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400',
		1,
	],
	[
		'src/components/dashboard/CampusReadinessCard.tsx',
		'text-center py-8 text-xs text-slate-400 border border-dashed rounded-xl',
		1,
	],
	['src/components/dashboard/CampusReadinessCard.tsx', 'italic text-slate-400', 1],
	[
		'src/pages/Audit.tsx',
		'absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400',
		1,
	],
	['src/pages/Audit.tsx', 'text-[0.68rem] font-bold uppercase tracking-wide text-slate-400', 2],
	['src/pages/Dashboard.tsx', 'text-xs font-bold uppercase tracking-wider text-slate-400', 1],
	[
		'src/pages/Dashboard.tsx',
		"state === 'done' ? 'text-emerald-600' : 'text-slate-400'",
		1,
	],
	[
		'src/pages/Dashboard.tsx',
		"item.done ? 'text-slate-400 line-through' : 'text-foreground'",
		1,
	],
];

const FROM_CLASS = 'text-slate-400';
const TO_CLASS = 'text-muted-foreground';

/** The five files this sweep owns. Explicit: a glob would silently absorb Lane A2's surface. */
const OWNED_FILES = [
	'src/components/campus-map/BuildingGradeScopeControl.tsx',
	'src/components/campus-map/CampusMapOverview.tsx',
	'src/components/dashboard/CampusReadinessCard.tsx',
	'src/pages/Audit.tsx',
	'src/pages/Dashboard.tsx',
] as const;

/** The ratchet-family pins after this sweep falls, all measured on the candidate (see control 5). */
const EXPECTED_RATCHET_TOTAL = 95;
const EXPECTED_RATCHET_FILE_COUNT = 28;
const EXPECTED_IN_SCOPE_RESIDUAL = 68;
const EXPECTED_EXCLUDED_RESIDUAL = 27;

/**
 * Raw neutrals each swept file still holds, so EXPECTED_RATCHET_FILE_COUNT is not taken on faith.
 * Measured on the candidate: 1 / 10 / 11 / 8 / 3, against 2 / 14 / 15 / 11 / 6 on the base, i.e.
 * exactly the 1 / 4 / 4 / 3 / 3 substitutions made here. None of the five emptied.
 */
const EXPECTED_RESIDUAL_PER_OWNED_FILE: ReadonlyArray<readonly [string, number]> = [
	['src/components/campus-map/BuildingGradeScopeControl.tsx', 1],
	['src/components/campus-map/CampusMapOverview.tsx', 10],
	['src/components/dashboard/CampusReadinessCard.tsx', 11],
	['src/pages/Audit.tsx', 8],
	['src/pages/Dashboard.tsx', 3],
];

/**
 * LF-normalised SHA-256 of src/index.css.
 * Method: read the file as bytes, decode utf8, replace CRLF with LF, re-encode utf8, sha256.
 * Normalising is deliberate: the worktree is checked out with CRLF, so a raw-bytes hash would be
 * checkout-dependent and would go red on a machine with different line endings. Index.css is not
 * in this stream's write scope, so this constant should not change; if a legitimate global token
 * change ever lands, this goes red on purpose and the value is recomputed in the same session.
 */
const INDEX_CSS_LF_SHA256 = '6fe45e63b43d123483d1c4e3b1f06f083baeea8b56acb5caa12ba2951cda3de2';

/**
 * ── SUPERSEDED 2026-09-28 by a3-c8-warning-token (A3-C8r1) ──────────────────────
 *
 * The pin above is the value this file was carrying, and it IS the base value: QA proved both
 * facts independently at candidate b1435a61e, and this commit re-proves the second one —
 *
 *   git show 4c683e1f3:atlas-client/src/index.css   (LF-normalised sha256)
 *     === SUPERSEDED_INDEX_CSS_LF_SHA256
 *
 * ORIGINAL INTENT: correct, and the row around it still carries it. Its purpose was to stop a
 * future session from silently editing a GLOBAL token shared with the timetable and login
 * surfaces. Nothing about that changed.
 *
 * WHY IT WENT RED: commit b1435a61e added a `--warning*` token family and a `.dark` block to
 * index.css, which is a legitimate global token change outside this stream's scope, exactly the
 * event the pin was written to catch. It is not a defect in the pin.
 *
 * SUPERSEDED BY: this commit (A3-C8r1), which carries the new value in
 * INDEX_CSS_LF_SHA256_REPINNED below, keeps the base value here verbatim for provenance, and
 * adds the control that proves the new value is a real descendant rather than a guess.
 *
 * AGENTS.md §16: never re-pin silently. Both values, both commits and the reason are on record.
 */
const SUPERSEDED_INDEX_CSS_LF_SHA256 = '6fe45e63b43d123483d1c4e3b1f06f083baeea8b56acb5caa12ba2951cda3de2';

/**
 * The current LF-normalised SHA-256 of src/index.css, after A3-C8r1.
 * Recomputed in the same session that changed the file, with the method above. See
 * SUPERSEDED_INDEX_CSS_LF_SHA256 for the value it replaces and why the pin moved.
 */
const INDEX_CSS_LF_SHA256_REPINNED_A3C8R1 = '91590da6958622ff254be55d1b8cc0c05aee47e57f56548bc5fbac4a401d8677';

/**
 * The pin A3-C8r1 set. Retained, never deleted (§16), and superseded on 2026-09-28 by
 * A3-C8r2 — a planner-applied DOCUMENTATION-ONLY correction that added the stated-limits
 * paragraph to the `.dark` block in index.css. No token value, no selector, no computed
 * colour changed in that commit; only a comment grew, and the pin fired on the comment.
 *
 * That firing is the pin working, not the pin being wrong, and it is the reason this
 * constant exists: it is the machine record that A3-C8r2 changed no colour. Diff
 * `aac241e6..a3c8r2` and read the token values — they are byte-identical.
 */
const INDEX_CSS_LF_SHA256_SUPERSEDED_A3C8R1 = INDEX_CSS_LF_SHA256_REPINNED_A3C8R1;

/**
 * ── SUPERSEDED 2026-09-28 by a3-c9 (A3-C9) ──────────────────────────────────────
 *
 * The pin above is the value this file carried from A3-C8r2, and it is still a real pin: the
 * working stylesheet is no longer byte-identical to it.
 *
 * WHY IT WENT RED, measured: A3-C9 changed THREE token values in index.css, none of them
 * documentation. `--muted-foreground` 215 16% 47% -> **215 16% 42%** (the change that matters
 * to this file), `--destructive` 0 84% 60% -> **0 84% 44%**, `--accent` and `--accent-ring`
 * 158 64% 40% -> **158 64% 29%**. Per-file delta for `atlas-client/src/index.css` against
 * base `a7ccb738a6b3ec6de19ae39ccede80552bd5c597`: **153 insertions, 7 deletions**, of which
 * the majority are the measured-contrast annotation blocks the `:root` annotation convention
 * requires next to a changed value. All three moved for the same reason and none is a comment-
 * only change, so this firing is a genuine value change and not a repeat of the A3-C8r2
 * documentation-only case.
 *
 * (An earlier draft of this note said 144 insertions. That figure was measured before the
 * annotation figures were corrected from an unrounded-float HSL conversion to 8-bit sRGB, which
 * grew the comments by 9 lines without moving a token value. Corrected here to the committed
 * delta rather than left as a number that no longer describes the commit it documents.)
 *
 * The failure message on this very row prescribes the remedy — "Re-measure and rewrite this
 * file and the handoff in the same commit if a global token change is genuinely intended" —
 * and this IS that commit. The handoff is the A2 -> C post recording the timetable blast
 * radius, because `--muted-foreground` is global and shared with the timetable surfaces.
 *
 * ORIGINAL INTENT: correct, and unchanged. Its purpose was to stop a future session from
 * silently editing a global token shared with the timetable and login surfaces. It caught
 * exactly that, twice, and both times the session was legitimate. AGENTS.md §16: never re-pin
 * silently. Both values, both commits, the per-file delta and the reason are on record.
 *
 * A WORTHLESS-DETAIL NOTE, because it is the kind of thing that gets rediscovered painfully:
 * this pin went red TWICE inside A3-C9 alone. The first firing was the real three-token value
 * change above. The second was AFTER the fix, when the measured-contrast figures in the new
 * `index.css` annotations were corrected from an unrounded-float HSL conversion to 8-bit sRGB
 * (the old `--destructive` on white is 3.783 unrounded, 3.781 rendered). No token value moved
 * in that second edit — only the published decimals did — and the pin fired anyway. That is
 * the pin working as a byte-detector, not a value-detector, and it is the concrete reason the
 * control below pins the TOKEN VALUES separately: the hash proves "no byte moved", the value
 * assertions prove "no colour moved", and neither substitutes for the other.
 */
const INDEX_CSS_LF_SHA256_SUPERSEDED_A3C9 = '51b95594beb80d5f488d4b36c20dcac3b06dd275d6bc52ef0f94df73dab4630e';

/**
 * A3-C9 BOUNDED CORRECTION (2026-09-28) — the value this pin held between the A3-C9 value change
 * and the wash-surface correction. Retained, not deleted, per AGENTS.md §16.
 *
 * THIRD FIRING OF THIS PIN INSIDE A3-C9, and the third of the same kind: NO TOKEN VALUE MOVED.
 * The per-file delta is COMMENT-ONLY. The C2 correction rewrote the surface model in the three
 * `index.css` contrast annotations: the "body wash" figures were measured by compositing the
 * wash alphas over the gradient's own `#fafbfc` 0% stop, which is a surface the browser never
 * paints (`html` declares no background, so the body gradient is propagated to the white
 * canvas), and the 50% stop was treated as a stack rather than a premultiplied interpolation.
 * The superseded model and its figures are retained, marked superseded, beside the corrected
 * ones. `--muted-foreground`, `--destructive`, `--accent` and `--accent-ring` are byte-identical.
 *
 * Proof that no value moved, for a reviewer who should not take this comment's word for it:
 *   git diff -U0 -- atlas-client/src/index.css | Select-String -Pattern "^[-+]\s*--"
 *   -> only comment lines; no `--token: value` declaration line appears at all.
 *
 * The token-value controls in this file are the load-bearing ones for a change like this; this
 * hash is a byte-detector, and it firing on a comment-only edit is the documented behaviour noted
 * immediately above, not evidence of a colour change.
 */
const INDEX_CSS_LF_SHA256_SUPERSEDED_A3C9_CORRECTION = '209ad24c199373ad02f9f1458d5a29246b04f7db6fdcf5b40136355fdc336535';

/**
 * The current LF-normalised SHA-256 of src/index.css, after A3-C9 + the bounded correction.
 * Recomputed in the same session that changed the file, with the `lfSha256` method above:
 *   node -e "const{createHash}=require('crypto'),{readFileSync}=require('fs');
 *            const f='src/index.css';
 *            console.log(createHash('sha256')
 *              .update(Buffer.from(readFileSync(f,'utf8').replace(/\r\n/g,'\n'),'utf8'))
 *              .digest('hex'));"
 *   -> c716be676f181e091ea6cd7c86568b7c368954d188edc35c4e5b0428b99c4e7a
 * Bound to this revision only (AGENTS.md §11: a computed artifact is valid only for the
 * revision and moment that produced it). See INDEX_CSS_LF_SHA256_SUPERSEDED_A3C9_CORRECTION for
 * the value it replaces and why the pin moved; see INDEX_CSS_LF_SHA256_SUPERSEDED_A3C9 for the
 * one before that, and the per-file delta and reason.
 */
const INDEX_CSS_LF_SHA256_REPINNED = 'c716be676f181e091ea6cd7c86568b7c368954d188edc35c4e5b0428b99c4e7a';

const AA = 4.5;
/** The S-e rename ceiling. Asserted to be EXCEEDED below, so nobody can widen their way to green. */
const S_E_RENAME_CEILING = 3;

// ───────────────────────── colour maths (copied from the S-e method, no library rounding) ─────────────────────────

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

const occurrences = (source: string, needle: string): number => source.split(needle).length - 1;

// ───────────────────────── readers over the real files ─────────────────────────

/** Every '--name: H S% L%' declaration in index.css, with how many times it is declared. */
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

/** The shade of the Tailwind that is actually installed. v4 ships oklch, so this reads oklch. */
function readInstalledShade(): Rgb {
	assert.ok(
		existsSync(TAILWIND_THEME),
		'cannot find the installed Tailwind palette at ' +
			TAILWIND_THEME +
			'. Control 2 checks this mapping against the palette that is really installed; without it there is no evidence.',
	);
	const theme = readFileSync(TAILWIND_THEME, 'utf8');
	const pattern = /--color-slate-400:\s*oklch\(\s*([0-9.]+)%\s+([0-9.]+)\s+([0-9.]+)\s*\)/;
	const match = pattern.exec(theme);
	assert.ok(match, 'the installed Tailwind palette no longer declares --color-slate-400 in oklch form');
	return to255(oklchToSrgb(Number(match[1]) / 100, Number(match[2]), Number(match[3])));
}

const tokens = readTokenDeclarations();
const shade = readInstalledShade();
const cssSource = readFileSync(INDEX_CSS, 'utf8');

function tokenRgb(name: string): Rgb {
	const entry = tokens.get(name);
	assert.ok(entry, 'token ' + name + ' is not declared in index.css');
	return to255(hslToSrgb(...entry.value));
}

/** The five app surfaces a text colour can actually sit on. */
const NEAR_WHITE_SURFACES = ['background', 'card', 'popover'] as const;
const MUTED_SURFACES = ['muted', 'secondary'] as const;

const lfSha256 = (absPath: string): string =>
	createHash('sha256')
		.update(Buffer.from(readFileSync(absPath, 'utf8').replace(/\r\n/g, '\n'), 'utf8'))
		.digest('hex');

/**
 * The LF-normalised SHA-256 of a file AS IT WAS AT A COMMIT (A3-C8r1).
 *
 * Added so the superseded pin's provenance is proved from the base blob rather than asserted
 * from a remembered constant — AGENTS.md §11: a computed artifact is valid only for the
 * revision that produced it, and a hand-copied hash is exactly the thing that goes stale.
 *
 * Method matches `lfSha256` above: git hands back the blob with LF endings, so no
 * normalisation is needed; the CRLF replacement is applied anyway so the two functions cannot
 * disagree on a platform that checks out CRLF.
 *
 * Fails loudly rather than skipping. This gate runs inside a Git worktree of this repository;
 * if `git` is unreachable that is a broken environment, not a row to quietly mark
 * unperformed, and a silent skip would make this proof optional exactly when it is needed.
 */
const lfSha256AtRef = (ref: string, repoPath: string): string => {
	let blob: string;
	try {
		blob = execFileSync('git', ['-C', CLIENT_ROOT, 'show', `${ref}:${repoPath}`], {
			encoding: 'utf8',
			maxBuffer: 32 * 1024 * 1024,
		});
	} catch (err) {
		assert.fail(
			`could not read ${repoPath} at ${ref} via git, so the superseded pin's provenance cannot be ` +
				`proved and this row is NOT skippable: ${String(err)}`
		);
	}
	return createHash('sha256')
		.update(Buffer.from(blob.replace(/\r\n/g, '\n'), 'utf8'))
		.digest('hex');
};

/** Every .tsx/.ts under a directory, recursively, with no exclusions at all. */
function walkAll(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walkAll(full, out);
			continue;
		}
		if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
	}
	return out;
}

/** Mirrors the ratchet's own walk: .tsx only, no __tests__, no *.test.*, no components/timetable. */
function walkRatchetScope(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			if (entry === 'timetable' && dir.endsWith(sep + 'components')) continue;
			walkRatchetScope(full, out);
			continue;
		}
		if (!full.endsWith('.tsx')) continue;
		if (full.includes(sep + '__tests__' + sep)) continue;
		if (full.includes('.test.')) continue;
		out.push(full);
	}
	return out;
}

const RAW_NEUTRAL_TEXT = /\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g;

function ratchetResidual(): { total: number; files: { path: string; count: number }[] } {
	const files = walkRatchetScope(SRC_ROOT)
		.map((path) => ({
			path: relative(CLIENT_ROOT, path).split(sep).join('/'),
			count: (readFileSync(path, 'utf8').match(RAW_NEUTRAL_TEXT) ?? []).length,
		}))
		.filter((entry) => entry.count > 0);
	return { total: files.reduce((sum, entry) => sum + entry.count, 0), files };
}

// ───────────────────────── controls ─────────────────────────

test('control 0: the readers see real data, not an empty scan', () => {
	// A colour control that silently parses nothing is worse than none: it would go green forever.
	assert.ok(tokens.size > 10, 'expected real tokens in index.css, parsed ' + tokens.size);
	assert.ok(shadesPresent(), 'the installed palette has no text-slate-400 to compare against');
	assert.deepEqual(shade, [144, 161, 185], 'text-slate-400 converted to sRGB changed; re-read the header table');
	for (const surface of [...NEAR_WHITE_SURFACES, ...MUTED_SURFACES]) {
		assert.ok(tokens.has('--' + surface), 'index.css is missing --' + surface);
	}
	assert.ok(tokens.has('--muted-foreground'), 'index.css is missing --muted-foreground');
});

function shadesPresent(): boolean {
	return Array.isArray(shade) && shade.length === 3 && shade.every((n) => Number.isFinite(n));
}

test('control 1: all 15 sites carry the token and no owned file holds text-slate-400', () => {
	// 15 sites, pinned as 14 class strings: Audit.tsx:784 and :788 carry a byte-identical class
	// string, so that one anchor pins both with count 2. The site total is the sum of the counts.
	const sites = SWEPT.reduce((sum, [, , count]) => sum + count, 0);
	assert.equal(sites, 15, 'the swept-site list covers ' + sites + ' sites, not 15; a changed count means a scope edit');
	assert.equal(
		SWEPT.length,
		14,
		'the anchor list is 14 entries; a changed count means an anchor was merged or split without the site total moving',
	);

	// The exact class string each site carried on the base must be gone, and its replacement present
	// with the same multiplicity. A single reversion anywhere fails here.
	for (const [rel, from, count] of SWEPT) {
		const source = readFileSync(join(CLIENT_ROOT, rel), 'utf8');
		const to = from.split(FROM_CLASS).join(TO_CLASS);
		assert.notEqual(to, from, 'anchor for ' + rel + ' does not contain ' + FROM_CLASS + ', so it pins nothing');
		assert.equal(
			occurrences(source, from),
			0,
			rel +
				' still contains the pre-sweep class string "' +
				from +
				'" (' +
				occurrences(source, from) +
				' occurrence(s)). Every one of the 15 sites moved to ' +
				TO_CLASS +
				'; text-slate-400 is 2.630:1 on white and is an accessibility defect, not an appearance to preserve.',
		);
		assert.equal(
			occurrences(source, to),
			count,
			rel +
				' holds the replacement class string "' +
				to +
				'" ' +
				occurrences(source, to) +
				' time(s), expected ' +
				count +
				'. Sites sharing an identical class string must all have moved.',
		);
	}

	// And the blunt sweep-level check, so a new text-slate-400 introduced later is caught too.
	for (const rel of OWNED_FILES) {
		const source = readFileSync(join(CLIENT_ROOT, rel), 'utf8');
		assert.equal(
			occurrences(source, FROM_CLASS),
			0,
			rel + ' contains ' + occurrences(source, FROM_CLASS) + ' x ' + FROM_CLASS + '; this stream owns that class there.',
		);
	}
});

test('control 2 (A3-C9: the disclosure is inverted, the darkening is now measured): the mapping is a deliberate darkening that clears AA on EVERY surface', () => {
	// ── CONTROL 2 RETAINED, WITH ITS FINAL CLAUSE SUPERSEDED 2026-09-28 by A3-C9 ────
	//
	// The original title, retained verbatim as history:
	//   'control 2: the mapping is a deliberate darkening that crosses AA on white, and is still
	//    under AA on --muted'
	// and the original band, retained verbatim:
	//   assert.ok(delta >= 40 && delta <= 50, '... outside the recorded 40-50 band around the
	//              measured 46. Re-measure against the installed palette and update this file.')
	//
	// WHY THE TITLE CHANGED RATHER THAN THE ROW BEING DELETED: the clause "is still under AA on
	// --muted" was a MANDATORY DISCLOSURE, asserted specifically so it could not be quietly
	// deleted. It is now FACTUALLY FALSE and this file's own failure text said what to do about
	// exactly that case: "The measured figure is 4.268:1. If this genuinely changed, --muted
	// changed, and the header table and the handoff disclosure are stale and must be
	// re-measured and rewritten in the same commit." That is this commit. The disclosure is
	// STRENGTHENED, not dropped: the old row is retained below, inverted, asserting the
	// improvement; and the new band is pinned to the MEASURED delta rather than widened to
	// whatever happens to be green.
	//
	// MEASURED, A3-C9: --muted-foreground 215 16% 47% -> 215 16% 42%. Divergence from
	// `text-slate-400` moved 46/255 -> 61/255 (band 58-64). The +15/255 is the same AA
	// improvement this file already argued for, applied one step further, and the direction
	// assertion below is unchanged and still load-bearing.
	const token = tokenRgb('--muted-foreground');
	const delta = maxChannelDelta(shade, token);

	// The load-bearing guard on the framing. If this build is ever red, the answer is NOT "widen
	// CHANNEL_TOLERANCE" and NOT "put text-slate-400 back".
	assert.ok(
		delta > S_E_RENAME_CEILING,
		'text-slate-400 and --muted-foreground are now only ' +
			delta +
			'/255 apart, inside the ' +
			S_E_RENAME_CEILING +
			'/255 S-e rename ceiling. The measured delta on this machine is 61/255 (46/255 at S-f) and this ' +
			'sweep is an intentional accessibility darkening. If the palette or the token moved, re-measure and record both figures here.',
	);
	assert.ok(
		delta >= 58 && delta <= 64,
		'the measured channel delta is ' +
			delta +
			'/255, outside the recorded 58-64 band around the measured 61. Re-measure against the installed palette and update this file.',
	);
	// The band must be a two-sided pin, not a one-sided ceiling: a value that drifts BACK toward
	// the old, unreadable shade is a regression, not a pass.
	assert.equal(
		delta,
		61,
		'--muted-foreground is no longer the A3-C9 value. Every contrast figure in the header table was ' +
			'computed from 215 16% 42%; re-measure and re-record the AA contract in src/index.css in the same commit.',
	);

	// Before: the defect this sweep exists to remove.
	for (const surface of [...NEAR_WHITE_SURFACES, ...MUTED_SURFACES]) {
		const bg = tokenRgb('--' + surface);
		const before = contrastRatio(shade, bg);
		const after = contrastRatio(token, bg);
		assert.ok(
			before < AA,
			'text-slate-400 on --' + surface + ' is ' + before.toFixed(3) + ':1, already at or above AA. The premise of this sweep is wrong.',
		);
		// A strict improvement everywhere. Direction, not magnitude: the token is darker on purpose.
		assert.ok(
			after > before,
			'--muted-foreground (' +
				after.toFixed(3) +
				':1) does not improve on text-slate-400 (' +
				before.toFixed(3) +
				':1) on --' +
				surface +
				'. The whole point of this sweep is that the token is darker.',
		);
	}

	// SUPERSEDED 2026-09-28 by A3-C9, RETAINED VERBATIM AND INVERTED TO PASS:
	//
	//   // Crosses AA on white and near-white only.
	//   for (const surface of NEAR_WHITE_SURFACES) { ... assert.ok(after >= AA, ...); }
	//
	//   // MANDATORY DISCLOSURE, asserted so it cannot be quietly deleted: still under AA on --muted.
	//   for (const surface of MUTED_SURFACES) {
	//     assert.ok(after < AA, '--muted-foreground on --' + surface + ' is now ' + after.toFixed(3) +
	//       ':1, at or above AA 4.5:1. The measured figure is 4.268:1. ...');
	//   }
	//
	// The first block still holds unchanged and is still asserted below. The second block
	// asserted the KNOWN DEFECT (`after < AA`) as a standing disclosure. A3-C9 fixed the defect,
	// so that row is now inverted: it asserts the FIX. Deleting it would have destroyed the
	// disclosure record; inverting it keeps the evidence and makes it stronger.
	assert.ok(
		delta > 46,
		'the token drifted back toward the S-f value (46/255) or closer. The A3-C9 point was to move FURTHER ' +
			'darker, not less. Measured ' + delta + '/255.',
	);
	// Now clears AA on white AND on the muted surfaces, which is the whole improvement.
	for (const surface of [...NEAR_WHITE_SURFACES, ...MUTED_SURFACES]) {
		const after = contrastRatio(token, tokenRgb('--' + surface));
		assert.ok(
			after >= AA,
			'--muted-foreground on --' + surface + ' is ' + after.toFixed(3) + ':1, under AA 4.5:1. The token is global; a fix there is not local to this stream.',
		);
	}

	// The AA assertions must be able to notice a real edit, or they are decoration.
	const entry = tokens.get('--muted-foreground') as { value: [number, number, number] };
	const oneUnitUp = to255(hslToSrgb(...(entry.value.map((v, i) => (i === 2 ? v + 1 : v)) as [number, number, number])));
	const white = tokenRgb('--background');
	assert.ok(
		Math.abs(contrastRatio(oneUnitUp, white) - contrastRatio(token, white)) > 0.1,
		'a one-unit lightness change to --muted-foreground moves contrast by less than 0.1:1, so the AA assertions above would not notice a real token edit.',
	);

	// The mapping must stay scheme-independent, or it needs a rendered screen and not this file.
	assert.equal(
		(tokens.get('--muted-foreground') as { count: number }).count,
		1,
		'--muted-foreground is declared more than once in index.css. A second declaration (typically inside a .dark block) makes this mapping scheme-dependent, and a rendered screen is then required.',
	);
	// ── SUPERSEDED 2026-09-28 by a3-c8-warning-token (A3-C8r1) ────────────────────
	// ORIGINAL ROW, RETAINED VERBATIM, NOW INVERTED TO PASS:
	//
	//   assert.doesNotMatch(
	//     cssSource,
	//     /\.dark\s*\{/,
	//     'index.css now contains a .dark selector block. Re-verify this sweep on a rendered screen in each scheme.',
	//   );
	//
	// ORIGINAL INTENT: correct and worth keeping. If a `.dark` block redefined
	// --muted-foreground, the S-f mapping would stop being scheme-independent and this file's
	// source-level contrast proof would stop being sufficient. The row immediately above
	// (--muted-foreground declared exactly once in the whole stylesheet) enforces exactly that
	// and is UNCHANGED; only the blanket "there is no `.dark` block at all" clause is superseded.
	//
	// WHY IT IS UNDECIDABLE TODAY: the row demands a rendered screen "in each scheme", but there
	// is only one scheme. No file under atlas-client/src writes a `dark` class onto an element,
	// so `.dark` is never selected and there is no second screen to verify against.
	//
	// INTRODUCED BY: b1435a61e ("refactor(client): add a warning token family and sweep 13 A3
	// files onto it"), which added the `.dark { --warning* }` pair as a defined-but-unreached
	// surface. QA returned this row red on candidate b1435a61e.
	// SUPERSEDED BY: this commit (A3-C8r1), which replaces it with the decidable invariant
	// immediately below — the same replacement used in palette-token-sweep-a3-s-e.test.ts, so
	// the two gates cannot drift apart.
	//
	// AGENTS.md §16: a correction is additive to evidence, never subtractive. The original
	// assertion text and its failure message are kept visible above, and the replacement is
	// added BESIDE it.
	assert.match(
		cssSource,
		/\.dark\s*\{/,
		'index.css no longer contains a .dark selector block, so this superseded row no longer describes the file. The replacement row below (no file under src writes a dark class) still holds and still gates the dark pair.',
	);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * REPLACEMENT for the superseded row in `control 2`, A3-C8r1, 2026-09-28.
 * Identical in substance to the replacement in palette-token-sweep-a3-s-e.test.ts. Kept as a
 * second copy on purpose: each gate is run on its own by its own package.json script, so a
 * shared helper would mean one of them could be green without the other ever running.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Files deliberately excluded from the dark-writer scan.
 *
 * `__tests__` only: a test file is not shipped, not mounted, and cannot put a class on a
 * rendered element, while its fixture strings routinely spell `dark` in prose. Without the
 * exclusion this scan detects its own evidence. Narrow, and stated rather than buried.
 */
const DARK_WRITER_SCAN_EXCLUDE = /(?:^|[\\/])__tests__[\\/]/;

/**
 * A STANDALONE `dark` class token — not `dark:`, not `darkMode`.
 *
 * `index.css:9` declares `@custom-variant dark (&:is(.dark *))` and five files use 45 `dark:`
 * variants. Those are styles GATED ON a `.dark` class, not code that PUTS one on. Found by
 * running the scan, not by reasoning about it.
 */
const DARK_CLASS_TOKEN = /(?<![\w:-])dark(?![\w:-])/;

const CLASS_ATTR = /\b(?:className|class)\s*=\s*(?:\{`[^`]*`\}|"[^"]*"|'[^']*')/g;

const DARK_WRITER_PATTERNS: { label: string; re: RegExp }[] = [
	{
		label: "classList.add/toggle/remove('dark')",
		re: /classList\s*\.\s*(?:add|toggle|remove)\s*\(\s*[^)]*['"`]dark['"`]/,
	},
	{
		label: "setAttribute('class', ...) adding a standalone `dark`",
		re: /setAttribute\s*\(\s*['"`]class['"`]\s*,[^)]*(?<![\w:-])dark(?![\w:-])/,
	},
	{
		label: 'a theme provider applying colorScheme to the document',
		re: /(?:documentElement|document\.body|root)[\s\S]{0,40}colorScheme|style\s*=\s*\{\{[^}]*colorScheme/,
	},
];

/** Every `dark`-class writer under atlas-client/src. Empty means the `.dark` block is inert. */
function darkClassWriters(): string[] {
	const out: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir)) {
			const child = join(dir, entry);
			if (statSync(child).isDirectory()) {
				walk(child);
				continue;
			}
			if (!/\.(?:ts|tsx|css)$/.test(entry)) continue;
			const abs = child.split(sep).join('/');
			if (DARK_WRITER_SCAN_EXCLUDE.test(abs)) continue;
			readFileSync(child, 'utf8')
				.split(/\r?\n/)
				.forEach((line, i) => {
					const where = `${relative(CLIENT_ROOT, child)}:${i + 1}`;
					for (const { label, re } of DARK_WRITER_PATTERNS) {
						if (re.test(line)) out.push(`${where} (${label})`);
					}
					CLASS_ATTR.lastIndex = 0;
					for (const attr of line.match(CLASS_ATTR) ?? []) {
						if (DARK_CLASS_TOKEN.test(attr)) out.push(`${where} (a class attribute holding \`dark\`)`);
					}
				});
		}
	};
	walk(join(CLIENT_ROOT, 'src'));
	return out;
}

test('REPLACEMENT (A3-C8r1): the .dark block is a real dark pair AND no code can select it', () => {
	const dark = cssSource.match(/\.dark\s*\{([\s\S]*?)\n\}/);
	assert.ok(dark, 'index.css has no .dark scope block');
	const root = cssSource.match(/:root\s*\{([\s\S]*?)\n\}/);
	assert.ok(root, 'index.css has no top-level :root block');
	for (const name of ['--warning', '--warning-foreground', '--warning-muted', '--warning-border']) {
		const darkVal = dark[1].match(new RegExp(`^\\s*${name}:\\s*(.+?);`, 'm'))?.[1];
		const rootVal = root[1].match(new RegExp(`^\\s*${name}:\\s*(.+?);`, 'm'))?.[1];
		assert.ok(darkVal, `.dark does not define ${name}`);
		assert.ok(rootVal, `:root does not define ${name}`);
		assert.notEqual(darkVal, rootVal, `.dark ${name} is identical to :root (${darkVal}); the dark pair is a copy, not a ramp.`);
	}

	// The tripwire. The moment a writer appears, `.dark` is reachable, a second scheme exists,
	// and the rendered-screen demand in the superseded row becomes both possible and necessary.
	const writers = darkClassWriters();
	assert.deepEqual(
		writers,
		[],
		'a dark-class writer now exists, so the `.dark` block is REACHABLE and a rendered-screen ' +
			'review in each scheme is required — including this sweep. Offenders: ' +
			writers.join(', ') +
			'. This is the tripwire the superseded row above was reaching for; do not silence it.',
	);
});

test('CONTROL (A3-C8r1): the dark-writer scan CAN detect a writer, and is not fooled by `dark:` variants', () => {
	const writers: [string, string][] = [
		['classList.add', `document.documentElement.classList.add('dark')`],
		['classList.toggle', `root.classList.toggle('dark', next)`],
		['setAttribute', `el.setAttribute('class', cn('card dark'))`],
		['colorScheme on the document', `document.documentElement.style.colorScheme = 'dark';`],
		['className holding a standalone dark', `return <div className="rounded p-2 dark" />;`],
	];
	for (const [label, line] of writers) {
		const viaPatterns = DARK_WRITER_PATTERNS.filter(({ re }) => re.test(line));
		CLASS_ATTR.lastIndex = 0;
		const viaClassAttr = (line.match(CLASS_ATTR) ?? []).some((a) => DARK_CLASS_TOKEN.test(a));
		assert.ok(
			viaPatterns.length > 0 || viaClassAttr,
			`the fabricated ${label} writer "${line}" was not detected by any pattern; the replacement row cannot go red`,
		);
	}
	const notWriters: [string, string][] = [
		['a `dark:` Tailwind variant gated on the class', `className={\`border p-1 dark:bg-gray-900 dark:text-gray-300\`}`],
		['an identifier merely containing "dark"', `root.classList.add('darkModePreview')`],
		['converted warning markup', `className="bg-warning-muted text-warning"`],
		['the EnrollPro settings FIELD, not a theme application', `colorScheme: Record<string, unknown> | null;`],
	];
	for (const [label, line] of notWriters) {
		assert.deepEqual(
			DARK_WRITER_PATTERNS.filter(({ re }) => re.test(line)).map((p) => p.label),
			[],
			`false positive on ${label}: ${line}`,
		);
		CLASS_ATTR.lastIndex = 0;
		assert.equal(
			(line.match(CLASS_ATTR) ?? []).some((a) => DARK_CLASS_TOKEN.test(a)),
			false,
			`false positive on ${label} via the class-attribute check: ${line}`,
		);
	}
	assert.ok(DARK_WRITER_SCAN_EXCLUDE.test('src/lib/__tests__/anything.test.ts'), 'the __tests__ exclusion is not active');
	assert.ok(!DARK_WRITER_SCAN_EXCLUDE.test('src/components/app-shell/AppShell.tsx'), 'the exclusion is broader than __tests__');
});

test('control 3: every must-not-touch surface is intact, and the timetable walk is real', () => {
	// 1. StackedWorkloadBar: a background fill, not text. Not a rename, not in scope.
	const bar = readFileSync(
		join(CLIENT_ROOT, 'src/components/faculty-assignments/StackedWorkloadBar.tsx'),
		'utf8',
	);
	assert.equal(
		occurrences(bar, 'bg-slate-400'),
		1,
		'StackedWorkloadBar.tsx must keep its bg-slate-400 fill (line 55). That is a background colour, not text, and this sweep is a text sweep.',
	);
	assert.equal(
		occurrences(bar, FROM_CLASS),
		0,
		'StackedWorkloadBar.tsx now contains ' + FROM_CLASS + '. Verify it really is text before accepting it.',
	);

	// 2. RoomSchedules: Lane A2's in-progress page, out of scope by decision.
	const rooms = readFileSync(join(CLIENT_ROOT, 'src/pages/RoomSchedules.tsx'), 'utf8');
	assert.equal(
		occurrences(rooms, FROM_CLASS),
		2,
		'RoomSchedules.tsx must keep its 2 text-slate-400 sites (lines 721, 743). It is Lane A2\'s WIP page and out of scope by decision.',
	);

	// 3. The timetable surface: walked for real, never skipped, so a zero is a measurement.
	assert.ok(existsSync(TIMETABLE_DIR), 'components/timetable does not exist; the walk below would be vacuous');
	const timetableFiles = walkAll(TIMETABLE_DIR);
	assert.ok(
		timetableFiles.length > 50,
		'the timetable walk visited only ' + timetableFiles.length + ' files, so its zero would prove nothing.',
	);
	const timetableSlate400 = timetableFiles.reduce(
		(sum, path) => sum + occurrences(readFileSync(path, 'utf8'), FROM_CLASS),
		0,
	);
	assert.equal(
		timetableSlate400,
		0,
		'components/timetable/** now holds ' +
			timetableSlate400 +
			' x ' +
			FROM_CLASS +
			'. Lane A2 owns that surface. On the base it held zero, so no site there can have moved.',
	);
});

test('control 4 (SUPERSEDED 2026-09-28 by a3-c8-warning-token): index.css is byte-identical to the base', () => {
	// ── SUPERSEDED ROW, RETAINED VERBATIM, NOW INVERTED TO PASS ───────────────────
	//
	//   assert.equal(
	//     actual,
	//     INDEX_CSS_LF_SHA256,   // === '6fe45e63b43d123483d1c4e3b1f06f083baeea8b56acb5caa12ba2951cda3de2'
	//     'src/index.css changed. --muted-foreground is global and shared with timetable and login surfaces, so changing it is not local to this stream. Re-measure and rewrite this file and the handoff in the same commit if a global token change is genuinely intended.',
	//   );
	//
	// WHY IT IS SUPERSEDED, NOT VIOLATED: the pin did its job. It fired on a legitimate global
	// token change made by ANOTHER stream (b1435a61e, A3-C8, which added `--warning*` and a
	// `.dark` block to the same stylesheet). The failure message above prescribes exactly the
	// remedy — "re-measure and rewrite this file and the handoff in the same commit" — and this
	// is that commit.
	//
	// The INVERSION, stated rather than assumed: the base stylesheet IS still byte-identical to
	// the value it was pinned to. The working file is not, and that is the whole point. So the
	// superseded claim now asserts the BASE provenance (proved from the base blob, not from a
	// remembered constant) and the working-tree pin asserts the new, deliberately-computed value.
	// Neither direction is silently dropped.
	assert.equal(
		SUPERSEDED_INDEX_CSS_LF_SHA256,
		'6fe45e63b43d123483d1c4e3b1f06f083baeea8b56acb5caa12ba2951cda3de2',
		'the recorded superseded pin was edited. It is evidence; leave it verbatim.',
	);
	// The pin really was the base's hash — the fact QA established, re-established here.
	assert.equal(
		lfSha256AtRef('4c683e1f3', 'atlas-client/src/index.css'),
		SUPERSEDED_INDEX_CSS_LF_SHA256,
		`the superseded pin does not match src/index.css at base 4c683e1f3, so the provenance claim above is wrong. Measured ${lfSha256AtRef('4c683e1f3', 'atlas-client/src/index.css')}.`,
	);
	const actual = lfSha256(INDEX_CSS);
	assert.notEqual(
		actual,
		SUPERSEDED_INDEX_CSS_LF_SHA256,
		'src/index.css is byte-identical to the superseded (base) pin again, which means the A3-C8 warning family is no longer in the file. Either that was reverted deliberately or the repin below is stale.',
	);
});

test('control 4 (REPLACEMENT, A3-C8r2): index.css is byte-identical to the re-pinned value', () => {
	const actual = lfSha256(INDEX_CSS);
	assert.equal(
		actual,
		INDEX_CSS_LF_SHA256_REPINNED,
		'src/index.css changed again since A3-C8r2. --muted-foreground is global and shared with the ' +
			'timetable and login surfaces, so changing it is not local to any one stream. Re-measure and ' +
			'rewrite this file and the handoff in the same commit if a global token change is genuinely intended.',
	);
	// The A3-C8r2 commit was documentation-only. This row is the machine proof, and it is why the
	// r2 pin is not simply "moved again": it must be a DIFFERENT hash from the r1 pin, and the only
	// difference between the two revisions is a comment inside the `.dark` block. If a future edit
	// makes these two hashes equal, the comment was reverted and the stated-limits paragraph — the
	// artifact that stops a reader treating the tripwire as exhaustive — is gone.
	assert.notEqual(
		actual,
		INDEX_CSS_LF_SHA256_SUPERSEDED_A3C8R1,
		'the A3-C8r2 stated-limits paragraph is missing from index.css: this hash equals the pre-r2 value, so the only change recorded as a documentation correction was in fact a revert of it.',
	);
	// The specific declaration this sweep's contrast figures were computed from.
	//
	// A3-C8r1 history, retained: that commit added a NEW token family and a `.dark` block and did
	// not touch this token, so the value stayed [215, 16, 47] and every figure in the header
	// table still held. A3-C9 is the case the row was guarding against, and it is a real change:
	// the value is now [215, 16, 42]. The assertion follows the value, so the "every figure was
	// computed from it" claim can never silently go stale — if the token moves again this goes red.
	assert.deepEqual(
		tokens.get('--muted-foreground')?.value,
		[215, 16, 42],
		'--muted-foreground is no longer 215 16% 42%. Every contrast figure in the header table was computed from it.',
	);
	// The hue and saturation are the load-bearing part of A3-C9: the change is a lightness-only
	// darkening, so it stays the same cool grey rather than becoming a new colour. If a future
	// session re-hues it, the "same token, darker" claim is false and this goes red.
	const mutedForeground = tokens.get('--muted-foreground')?.value as [number, number, number];
	assert.equal(
		mutedForeground[0],
		215,
		'--muted-foreground changed hue. A3-C9 moved lightness only; a re-hue is a different change and needs its own record.',
	);
	assert.equal(
		mutedForeground[1],
		16,
		'--muted-foreground changed saturation. A3-C9 moved lightness only.',
	);
	assert.equal(
		(tokens.get('--muted-foreground') as { count: number }).count,
		1,
		'--muted-foreground is declared more than once in index.css; the A3-C8 `.dark` block must not redefine a token this file measured.',
	);
});

test('control 5: the ratchet pins fell by exactly these 15 substitutions and two files agree', () => {
	// No owned file was emptied, which is why the file count is unchanged at 28.
	for (const [rel, expected] of EXPECTED_RESIDUAL_PER_OWNED_FILE) {
		const count = (readFileSync(join(CLIENT_ROOT, rel), 'utf8').match(RAW_NEUTRAL_TEXT) ?? []).length;
		assert.equal(
			count,
			expected,
			rel + ' holds ' + count + ' raw neutral text colours, this file states ' + expected + '. If a file emptied, EXPECTED_RATCHET_FILE_COUNT is stale.',
		);
		assert.ok(count > 0, rel + ' was emptied by this sweep; the ratchet file count must fall with it');
	}

	const ratchet = ratchetResidual();
	assert.equal(ratchet.total, EXPECTED_RATCHET_TOTAL, 'measured ratchet-scope residual');
	assert.equal(ratchet.files.length, EXPECTED_RATCHET_FILE_COUNT, 'measured ratchet-scope file count');
	assert.equal(
		EXPECTED_RATCHET_TOTAL,
		110 - 15,
		'the expected ratchet total is not the pre-step-2 total of 110 minus this sweep\'s 15 substitutions',
	);
	assert.equal(
		EXPECTED_IN_SCOPE_RESIDUAL + EXPECTED_EXCLUDED_RESIDUAL,
		EXPECTED_RATCHET_TOTAL,
		'the in-scope and excluded residuals must sum to the ratchet total; no occurrence may be unaccounted for',
	);

	// Second agreement: read the sibling files as source and require them to state the same numbers.
	// A pin that only one file believes is a false green.
	const sweepSource = readFileSync(SWEEP_TEST, 'utf8');
	const ratchetSource = readFileSync(RATCHET_TEST, 'utf8');
	const read = (source: string, name: string): number =>
		Number(new RegExp('const ' + name + ' = (\\d+);').exec(source)?.[1]);
	const pairs: ReadonlyArray<readonly [string, number, number]> = [
		['sweep EXPECTED_TOTAL', read(sweepSource, 'EXPECTED_TOTAL'), EXPECTED_RATCHET_TOTAL],
		[
			'sweep EXPECTED_FILE_COUNT',
			read(sweepSource, 'EXPECTED_FILE_COUNT'),
			EXPECTED_RATCHET_FILE_COUNT,
		],
		[
			'sweep EXPECTED_IN_SCOPE_RESIDUAL',
			read(sweepSource, 'EXPECTED_IN_SCOPE_RESIDUAL'),
			EXPECTED_IN_SCOPE_RESIDUAL,
		],
		[
			'sweep EXPECTED_EXCLUDED_RESIDUAL',
			read(sweepSource, 'EXPECTED_EXCLUDED_RESIDUAL'),
			EXPECTED_EXCLUDED_RESIDUAL,
		],
		['ratchet PINNED_TOTAL', read(ratchetSource, 'PINNED_TOTAL'), EXPECTED_RATCHET_TOTAL],
		['ratchet PINNED_FILE_COUNT', read(ratchetSource, 'PINNED_FILE_COUNT'), EXPECTED_RATCHET_FILE_COUNT],
	];
	for (const [label, actualValue, expectedValue] of pairs) {
		assert.ok(
			Number.isFinite(actualValue),
			'could not read ' + label + ' out of its source file; this cross-check is blind.',
		);
		assert.equal(
			actualValue,
			expectedValue,
			label + ' states ' + actualValue + ', this file measured ' + expectedValue + '. Two files must agree before either is trusted.',
		);
	}
});
