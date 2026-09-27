import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * S-e palette ratchet — A3 c1, 2026-09-28.
 *
 * ## What this is for
 *
 * The repo already has a rule against raw neutral Tailwind classes in shared chrome, and the rule
 * is real: `src/lib/__tests__/ux-r01-shared-chrome.test.ts:62` asserts
 * `assert.doesNotMatch(html, /(?:text|bg|border)-(?:slate|zinc|gray)-/)` against the rendered shared
 * state components, and its helper `assertSharedChromeSources` applies the same ban to **three**
 * files. So the contract is "no raw neutrals in shared chrome".
 *
 * **The enforcement covers three files. The debt is 200-odd occurrences across nearly forty.**
 * `components/admin-workspace/AdminWorkspace.tsx:178` renders the page `<h1>` for `/sections`,
 * `/subjects` and `/teachers` in `text-slate-900` — a raw neutral, on three of the four screens the
 * operator opens the product on — and no test in the repo sees it.
 *
 * ## Why a ratchet and not a sweep
 *
 * A3 deliberately did **not** sweep these tonight. The only verification that a raw grey became the
 * right token is a rendered screen at 1366x768, in both colour schemes, on every page that uses it —
 * and the c0 handoff already records that this client is **not** reliably light-only (15 `dark:`
 * occurrences across 5 files, not the 4 the earlier note claimed). A 200-occurrence blind colour
 * change made with no browser is exactly the unreviewable change `AGENTS.md` warns about, and it
 * would land on the same pages as the two accepted density rows (14/16).
 *
 * So this file does the safe half: it **measures and pins the current count so it can only go
 * down**, and it hands a sweep session an exact per-file worklist. Every step of the eventual sweep
 * is then individually revertible, and no step can silently make things worse.
 *
 * ## Scope, and why
 *
 * - every `.tsx` under `atlas-client/src`, excluding `__tests__` and `*.test.*` — tests legitimately
 *   assert on literal class strings, and pinning them would make the ratchet impossible to write.
 *   (Written this way deliberately: a `**` glob inside a block comment closes it at the `*` + `/`.)
 * - **Excluding `components/timetable/**`** — Lane A2 owns that surface and A3 must not create a
 *   dependency on it. The count below is A3-lane debt only, and A2's timetable occurrences are
 *   deliberately not this lane's problem.
 * - `text-` prefix only. `bg-`/`border-`/`ring-` on a surface is a different question with a
 *   different risk, and pinning it now would set a baseline nobody has reviewed. The full-scope
 *   measurement (450 occurrences, 53 files) is recorded in the c1 route table so the next sweep can
 *   decide the wider scope deliberately rather than inheriting it.
 */

/**
 * Pinned at 2026-09-28 against `origin/main` `025ac7d8`. **229 occurrences across 34 files**,
 * recomputed twice by independent means (this test, and a separate Python walk) so the pin is a
 * measurement and not an estimate — an earlier guess of 226 was caught red by this very control on
 * its first run, which is the behaviour a ratchet is supposed to have. Lower these as the sweep
 * lands, with the reason in the commit.
 *
 * **Lowered 2026-09-28 by the S-e exact-substitution sweep: 229 -> 110, 34 -> 28 files.**
 *
 * The fall is exactly the 119 substitutions that sweep made (47 `text-slate-900` ->
 * `text-foreground`, 72 `text-slate-500` -> `text-muted-foreground`) across 19 non-timetable
 * demo-route files, and nothing else: no markup, spacing, copy or non-`text-` class moved, proven
 * by a whole-file comparison against `HEAD` in `palette-token-sweep-a3-s-e.test.ts` control 5.
 * The 6-file drop is those six in-scope files whose only raw neutrals were the two swept shades,
 * so they left the count entirely.
 *
 * **The residual 110 is deliberately left for a browser-verified pass, not an oversight.** Those
 * occurrences are shades with no exact token (`slate-200/300/400/600/700/800`, `gray-*`), and
 * mapping them is a design judgement, not a rename, so it needs a rendered screen rather than a
 * rename proof. Their measured contrast and per-file inventory are recorded in the S-e handoff as
 * the input the next browser holder needs. Do not lower these pins again without a rendered screen
 * at 1366x768.
 *
 * **CORRECTION (A3 c2, planner-applied after QA `ses_f1c2ec739ffexrHKqcRsIOKYJd`) — the
 * residual is NOT uniform, and the earlier classification of part of it was false.** The previous
 * wording of this paragraph is retained above as history and is **superseded in two respects**;
 * `AGENTS.md` §16 forbids deleting an evidence row to close a finding, so the correction is added
 * beside it rather than in place of it.
 *
 * 1. **The `slate-200` and `slate-300` sites are genuinely decorative and must stay.** Measured on
 *    white they are 1.232:1 and 1.484:1. They are `|` separators (`src/pages/Audit.tsx:665,667,669`)
 *    and chevrons (`src/components/dashboard/CampusReadinessCard.tsx:436`,
 *    `src/components/campus-map/CampusMapOverview.tsx:485`, `src/pages/Dashboard.tsx:909`). They are
 *    not text and carry no information, so promoting them to a foreground token **would** be a
 *    regression. This part of the original reasoning is confirmed.
 * 2. **The `slate-400` sites are the opposite case, and calling them a regression was wrong.** Four
 *    of them are real content: three **search icons** (`CampusMapOverview.tsx:595`,
 *    `CampusReadinessCard.tsx:542`, `Audit.tsx:748`) and one **`line-through` completed item**
 *    (`Dashboard.tsx:901`). At `text-slate-400` = **2.628:1** on white they fail WCAG 1.4.11 (3:1
 *    for non-text) and AA (4.5:1 for text), and `text-muted-foreground` at 4.718:1 would **fix**
 *    them. Treat these as **accessibility work to do**, not as exemptions to preserve.
 * 3. **`src/components/campus-map/BuildingGradeScopeControl.tsx:36` is an ENABLED control, not a
 *    disabled one, and the original sentence calling it "a disabled button" is false.** The file
 *    contains zero occurrences of `disabled`, the element carries a live `onClick` (lines 38-43), and
 *    line 36 itself carries `hover:text-slate-600` — a hover state only an interactive control has.
 *    WCAG 1.4.3 exempts *disabled* controls and grants no exemption here, so there is nothing to
 *    protect. At 2.628:1 this is an active AA text failure on an enabled control.
 *
 * A later session must therefore **not** read this pin as blanket permission to leave the residual
 * alone: of the 110, the 6 decorative `slate-200/300` sites are correct as they are, and the 5
 * `slate-400` sites listed above are accessibility defects to fix, not exemptions.
 *
 * **LOWERED AGAIN 2026-09-28 by the S-f step-2 sweep: 110 -> 95, 28 -> 28 files.**
 *
 * All 15 `text-slate-400` sites in the c2 correction's item 2 and item 3 were replaced with
 * `text-muted-foreground` across 5 non-timetable demo-route files. The fall is exactly those 15
 * substitutions and nothing else; no file emptied, which is why the file count is unchanged.
 *
 * **This was a deliberate ACCESSIBILITY DARKENING, not a rename, and the pin must not be read as
 * evidence that appearance was preserved.** Measured against the installed Tailwind 4.2.2 palette,
 * `text-slate-400` = oklch(70.4% 0.04 256.788) = sRGB rgb(144, 161, 185) and `--muted-foreground` =
 * `215 16% 47%` = sRGB rgb(101, 117, 139), a per-channel delta of 43 / 44 / 46, **max 46 of 255**.
 * That is the opposite of the S-e sweep's 2-3/255 rename. Its own contract, tolerances and evidence
 * are in `src/lib/__tests__/palette-slate400-step2-a3-s-f.test.ts`.
 *
 * **DISCLOSED SHORTFALL, unchanged in kind by this sweep: on `--muted` and `--secondary` the token
 * is 4.268:1, still under WCAG AA 4.5:1.** The sweep is a strict improvement on every surface
 * (+2.067:1 on white from 2.630:1, +1.878:1 on `--muted` from 2.390:1) and a full AA pass only on
 * white and near-white surfaces. **Nothing here may be read as a claim that the app passes AA.**
 *
 * The c2 correction's item 3 — that `BuildingGradeScopeControl.tsx:36` is an ENABLED control with
 * no WCAG 1.4.3 exemption — is **confirmed and now acted on**: that site is one of the 15 swept.
 * No `text-slate-400` site is an exemption, and this pin is not a licence to leave the rest.
 */
const PINNED_TOTAL = 95;
const PINNED_FILE_COUNT = 28;

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(here, '..', '..', '..');
const SRC_ROOT = join(CLIENT_ROOT, 'src');

/** Raw neutral text colours, the thing the committed shared-chrome contract already bans. */
const RAW_NEUTRAL_TEXT = /\btext-(?:slate|zinc|gray|neutral|stone)-\d{2,3}\b/g;

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			// Lane A2's surface: out of scope for this lane, by ownership, not by convenience.
			if (entry === 'timetable' && dir.endsWith(`${sep}components`)) continue;
			walk(full, out);
			continue;
		}
		if (!full.endsWith('.tsx')) continue;
		if (full.includes(`${sep}__tests__${sep}`)) continue;
		if (full.includes('.test.')) continue;
		out.push(full);
	}
	return out;
}

function toRepoPath(absolute: string): string {
	return relative(CLIENT_ROOT, absolute).split(sep).join('/');
}

/** Count raw neutrals per file. Exported in spirit: the next test asserts this detector works. */
function measure(): { total: number; files: { path: string; count: number }[] } {
	const files = walk(SRC_ROOT)
		.map((path) => {
			const source = readFileSync(path, 'utf8');
			const count = (source.match(RAW_NEUTRAL_TEXT) ?? []).length;
			return { path: toRepoPath(path), count };
		})
		.filter((entry) => entry.count > 0)
		.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
	return { total: files.reduce((sum, entry) => sum + entry.count, 0), files };
}

const measured = measure();

/** Render the per-file worklist a sweep session needs, worst offender first. */
function worklist(): string {
	return measured.files.map((entry) => `  ${String(entry.count).padStart(3)}  ${entry.path}`).join('\n');
}

test('the raw-neutral text detector actually detects, on a synthetic string', () => {
	// A ratchet that cannot see anything is worse than no ratchet: it would go green forever while
	// the debt grows. This pins the detector itself, independently of the repository's contents.
	const synthetic = '<span className="text-slate-500 text-gray-900 text-foreground text-slate-50">x</span>';
	assert.equal((synthetic.match(RAW_NEUTRAL_TEXT) ?? []).length, 3, 'three of the four are raw neutrals');
	assert.doesNotMatch('className="text-foreground text-muted-foreground"', RAW_NEUTRAL_TEXT);
	assert.doesNotMatch('className="bg-slate-100"', RAW_NEUTRAL_TEXT, 'bg- is out of this ratchet scope');
	assert.doesNotMatch('className="text-slate"', RAW_NEUTRAL_TEXT, 'a bare name with no shade is not a shade');
});

test('the ratchet sees the debt it is pinning', () => {
	// Proves the pin is anchored to something real rather than to an empty scan.
	assert.ok(measured.total > 0, 'measured zero raw neutrals: the detector is broken, not the repo clean');
	assert.ok(
		measured.files.length > 1,
		'expected raw neutrals in more than one file; a single file suggests the walk is not recursing',
	);
	assert.equal(
		measured.total,
		measured.files.reduce((sum, entry) => sum + entry.count, 0),
		'the total must equal the sum of the per-file counts',
	);
});

test('Lane A2\'s timetable surface is not counted', () => {
	const timetable = measured.files.filter((entry) => entry.path.includes('/components/timetable/'));
	assert.deepEqual(timetable, [], 'timetable occurrences must be excluded: that surface is Lane A2\'s');
});

test('S-e ratchet: raw neutral text colours must not increase', () => {
	assert.ok(
		measured.total <= PINNED_TOTAL,
		[
			`raw neutral text colours ROSE to ${measured.total}, pinned at ${PINNED_TOTAL}.`,
			'Use the app\'s token layer (text-foreground, text-muted-foreground) instead of',
			'text-slate-*/text-gray-*, or update the pin deliberately with a reason.',
			'',
			'Per-file worklist, worst first:',
			worklist(),
		].join('\n'),
	);
	assert.ok(
		measured.files.length <= PINNED_FILE_COUNT,
		`raw-neutral file count ROSE to ${measured.files.length}, pinned at ${PINNED_FILE_COUNT}.\n\n${worklist()}`,
	);
});

test('the pins are honest about what they measure', () => {
	// Guards against someone lowering the pins to make a red build green without doing the sweep.
	// A sweep is allowed to lower them; it is not allowed to lower them below what is still there
	// with no accompanying change, which this cannot fully detect — so it records the shape instead.
	assert.ok(PINNED_TOTAL > 0 && PINNED_FILE_COUNT > 0, 'pins must be positive');
	assert.ok(
		PINNED_TOTAL >= PINNED_FILE_COUNT,
		'the total must be at least the file count; otherwise one file holds them all and the pin is meaningless',
	);
	assert.ok(
		measured.total <= PINNED_TOTAL,
		`current ${measured.total} already exceeds the pin ${PINNED_TOTAL}: the pin is stale, not the code`,
	);
});
