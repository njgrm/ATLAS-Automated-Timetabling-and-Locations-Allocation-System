import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

/**
 * A3-C8 warning-colour token — ratchet, 2026-09-28.
 *
 * ## Why this file exists
 *
 * The three earlier A3 palette ratchets (`test:a3-palette-ratchet-s-e`,
 * `test:a3-palette-token-sweep`, `test:a3-palette-slate400-step2-a3-s-f`) each enforce
 * against a pinned list of THREE files. A page carrying 27 raw colour classes is therefore
 * invisible to them, which is the standing finding the A3 handoff recorded. This ratchet is
 * deliberately built the other way round: it pins
 *
 *   (a) the 13 files A3-C8 actually swept — zero raw amber/yellow allowed, and
 *   (b) a REPO-WIDE remaining count with a pinned literal,
 *
 * so the next session cannot read a green run as "the sweep is finished", and so the
 * un-swept remainder stays visible as a number that has to be moved deliberately.
 *
 * ## Counting method — pinned, because two readings differ by ~2x
 *
 * For every count in this file the unit is **LINES CONTAINING a match**, not total
 * occurrences and not distinct class names:
 *
 *   `grep -hE '(amber|yellow)-[0-9]{2,3}' <files> | wc -l`
 *
 * The distinction is load-bearing, not pedantry. On the pre-sweep tree at base
 * `4c683e1f3` the same corpus measured **333 lines** but **642 total occurrences**
 * (and 83 files rather than 82, because `components/manual-edit/manual-edit-foundation.ts`
 * is a `.ts`). Total-occurrence counting also double-counts a single line that carries
 * three classes in one string. The baseline this ratchet descends from (82 files /
 * 333 lines / 95 in-sweep lines) reproduces EXACTLY under the lines-containing reading
 * and under no other, so that is the reading pinned here.
 *
 * Scope, also pinned: `atlas-client/src/pages/**` and `atlas-client/src/components/**`,
 * `*.tsx` only, EXCLUDING `components/timetable/**` (A2 owns it) and `__tests__`.
 *
 * ## Why the `.ts`-only exclusion of manual-edit-foundation.ts is LOAD-BEARING
 *
 * The counting scope is `.tsx` only, and a future session that "fixes" that to `.ts` would
 * silently sweep `components/manual-edit/manual-edit-foundation.ts`, whose `GRADE_BADGE`
 * carries `8: 'bg-yellow-100 text-yellow-700 border-yellow-300'` — the §8 G8 grade badge.
 * The exclusion is therefore not a counting artifact; it protects a grade colour. The same
 * defect was found LIVE inside this stream's own swept set on 2026-09-28: A3-C8's first
 * candidate turned `GRADE_COLORS[8]` in `components/sections/HomeRoomAutoAssignDialog.tsx`
 * into `bg-warning-muted text-warning`, breaking G8. Both files are pinned by name in the
 * `GRADE_BADGE_EXEMPTIONS` table and by the two guard rows below, so the exclusion and the
 * exemption are now proven rather than assumed.
 */

/**
 * Grade-badge lines that are deliberately NOT warning-semantic, and so are excluded from
 * every count in this file. Each entry is an EXACT source line plus the substrings that
 * line must still contain — so a row goes red if somebody re-sweeps a grade colour, and the
 * exemption can never quietly widen into a blanket allowlist.
 */
const GRADE_BADGE_EXEMPTIONS: { file: string; mustContain: string[] }[] = [
	{
		// Live grade badge, rendered wherever this file consumes `GRADE_COLORS`. Asserted
		// by reference, not by line number: a comment added above shifts the line and a
		// stale line citation is evidence pointing at the wrong place (§11).
		file: 'components/sections/HomeRoomAutoAssignDialog.tsx',
		mustContain: ["8: 'bg-yellow-100 text-yellow-700'"],
	},
	{
		// §8 G8 badge, `export const GRADE_BADGE`. This file is `.ts`, so it is already outside
		// the counting scope — the row exists so that stays a decision, not an accident.
		file: 'components/manual-edit/manual-edit-foundation.ts',
		mustContain: ["8: 'bg-yellow-100 text-yellow-700 border-yellow-300'"],
	},
];

/** The 13 files A3-C8 swept. A literal, pinned, non-empty list — never a glob. */
const SWEPT_FILES = [
	'components/sections/SectionsStatusBanners.tsx',
	'components/sections/HomeRoomAutoAssignDialog.tsx',
	'components/sections/SectionHomeRoomModals.tsx',
	'components/runtime/RolloverGuidanceCard.tsx',
	'components/runtime/RolloverResetPanel.tsx',
	'components/faculty-dashboard/ActionQueue.tsx',
	'components/faculty-assignments/TeachingLoadTruthPanel.tsx',
	'components/faculty-assignments/TeachingLoadRepairQueue.tsx',
	'components/app-shell/NotificationBell.tsx',
	'components/smart/SmartPageShell.tsx',
	'components/subjects/SubjectCoverageSheet.tsx',
	'pages/TeacherConcerns.tsx',
	'components/faculty-assignments/AutoFillSummaryModal.tsx',
] as const;

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const INDEX_CSS = join(SRC, 'index.css');

/** The raw-class detector. Extracted as a pure function so the control below can exercise it. */
const RAW_WARNING = /(amber|yellow)-[0-9]{2,3}/g;

/**
 * Strip the exempted grade-badge lines from a source before counting, so the corpus means
 * "raw colour that is a WARNING semantic". The exemption is by exact line content, never by
 * line number, so an unrelated edit that shifts a line cannot silently change what is exempt.
 */
function stripGradeBadgeExemptions(rel: string, source: string): string {
	const entry = GRADE_BADGE_EXEMPTIONS.find((e) => e.file === rel);
	if (!entry) return source;
	return source
		.split(/\r?\n/)
		.filter((line) => !entry.mustContain.some((needle) => line.includes(needle)))
		.join('\n');
}

/** LINES containing at least one raw amber/yellow class. The pinned counting method. */
function countRawWarningLines(source: string): number {
	const lines = source.split(/\r?\n/);
	return lines.filter((line) => {
		RAW_WARNING.lastIndex = 0;
		return RAW_WARNING.test(line);
	}).length;
}

/** Every raw amber/yellow class in `source`, for a failure message that names the offender. */
function findRawWarningClasses(source: string): string[] {
	return [...new Set(source.match(RAW_WARNING) ?? [])].sort();
}

/** Repo-wide files still holding raw amber/yellow, under the pinned scope above. */
function remainingFiles(): string[] {
	const roots = ['pages', 'components'].map((dir) => join(SRC, dir));
	const out: string[] = [];
	const walk = (abs: string): void => {
		for (const entry of readdirSync(abs)) {
			const child = join(abs, entry);
			if (statSync(child).isDirectory()) {
				if (entry === '__tests__') continue;
				if (abs === join(SRC, 'components') && entry === 'timetable') continue;
				walk(child);
				continue;
			}
			if (!entry.endsWith('.tsx')) continue;
			const rel = relative(SRC, child).split(sep).join('/');
			const source = stripGradeBadgeExemptions(rel, readFileSync(child, 'utf8'));
			RAW_WARNING.lastIndex = 0;
			if (RAW_WARNING.test(source)) out.push(rel);
		}
	};
	for (const root of roots) walk(root);
	return out.sort();
}

test('index.css :root defines --warning plus -foreground, -muted and -border', () => {
	const css = readFileSync(INDEX_CSS, 'utf8');
	// The `:root` block only — so a token that merely exists somewhere in the file, or that
	// exists solely in the `.dark` pair, does not satisfy this row.
	const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
	assert.ok(root, 'index.css has no top-level :root block');
	for (const name of [
		'--warning',
		'--warning-foreground',
		'--warning-muted',
		'--warning-border',
	]) {
		assert.match(
			root[1],
			new RegExp(`^\\s*${name}:\\s*\\d+[\\s.]+\\d+%[\\s.]+\\d+%;`, 'm'),
			`:root does not define ${name} as an HSL channel triplet`
		);
	}
});

test('index.css .dark scope overrides all four warning tokens (defined-but-unreached pair)', () => {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/);
	assert.ok(dark, 'index.css has no .dark scope block');
	for (const name of [
		'--warning',
		'--warning-foreground',
		'--warning-muted',
		'--warning-border',
	]) {
		assert.match(
			dark[1],
			new RegExp(`^\\s*${name}:\\s*\\d+[\\s.]+\\d+%[\\s.]+\\d+%;`, 'm'),
			`.dark does not override ${name}`
		);
	}
	// The pair must actually differ, or it is a copy rather than a dark ramp.
	for (const name of [
		'--warning',
		'--warning-foreground',
		'--warning-muted',
		'--warning-border',
	]) {
		const light = css.match(new RegExp(`^\\s*${name}:\\s*(.+?);`, 'm'))?.[1];
		const darkVal = dark[1].match(new RegExp(`^\\s*${name}:\\s*(.+?);`, 'm'))?.[1];
		assert.notEqual(light, darkVal, `${name} is identical in :root and .dark`);
	}
});

test('index.css @theme inline registers all four as --color-warning* utilities', () => {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const theme = css.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
	assert.ok(theme, 'index.css has no @theme inline block');
	for (const name of [
		'--warning',
		'--warning-foreground',
		'--warning-muted',
		'--warning-border',
	]) {
		const colorVar = `--color-${name.replace(/^--/, '')}`;
		assert.ok(
			theme[1].includes(`${colorVar}: hsl(var(${name}));`),
			`@theme inline does not register ${colorVar} as hsl(var(${name}))`
		);
	}
});

test('each of the 13 A3-C8 swept files holds zero raw amber-*/yellow-* classes', () => {
	assert.equal(SWEPT_FILES.length, 13, 'the pinned swept-file list must stay 13 files');
	const offenders: string[] = [];
	for (const rel of SWEPT_FILES) {
		const source = stripGradeBadgeExemptions(rel, readFileSync(join(SRC, rel), 'utf8'));
		const raw = findRawWarningClasses(source);
		if (raw.length > 0) {
			offenders.push(`${rel}: ${raw.join(', ')} (${countRawWarningLines(source)} line(s))`);
		}
	}
	assert.deepEqual(offenders, [], `raw warning colour re-introduced in swept files -> ${offenders.join(' | ')}`);
});

test('GUARD: HomeRoomAutoAssignDialog GRADE_COLORS[8] still carries its §8 yellow classes', () => {
	// The live defect this file was corrected for. A3-C8's first candidate rewrote this entry
	// to `bg-warning-muted text-warning`, which turned the G8 grade badge into a "needs
	// attention" colour. The exemption above is only safe because this row exists.
	const source = readFileSync(
		join(SRC, 'components/sections/HomeRoomAutoAssignDialog.tsx'),
		'utf8'
	);
	assert.match(
		source,
		/GRADE_COLORS[\s\S]*?8:\s*'bg-yellow-100 text-yellow-700'/,
		'GRADE_COLORS[8] is no longer the §8 G8 yellow. AGENTS.md §8 requires G8 yellow; the warning family must not encode a grade.'
	);
	// The other three grades are untouched too, so a future sweep cannot quietly claim G9.
	for (const [grade, expected] of [
		['7', 'bg-green-100 text-green-700'],
		['9', 'bg-red-100 text-red-700'],
		['10', 'bg-blue-100 text-blue-700'],
	] as const) {
		assert.ok(
			source.includes(`${grade}: '${expected}'`),
			`GRADE_COLORS[${grade}] is no longer '${expected}'`
		);
	}
	// And the badge is actually rendered, so this is live surface, not a dead constant.
	assert.ok(
		source.includes('GRADE_COLORS['),
		'GRADE_COLORS is never referenced; if the badge was deleted this guard is vacuous'
	);
});

test('GUARD: manual-edit-foundation GRADE_BADGE[8] still carries its §8 yellow classes', () => {
	// The `.ts`-only counting scope excludes this file. That exclusion is LOAD-BEARING for a
	// grade colour, not a counting artifact, so it is pinned here rather than left implicit.
	const source = readFileSync(
		join(SRC, 'components/manual-edit/manual-edit-foundation.ts'),
		'utf8'
	);
	assert.match(
		source,
		/GRADE_BADGE[\s\S]*?8:\s*'bg-yellow-100 text-yellow-700 border-yellow-300'/,
		'GRADE_BADGE[8] is no longer the §8 G8 yellow (bg-yellow-100 text-yellow-700 border-yellow-300).'
	);
	for (const [grade, expected] of [
		['7', 'bg-green-100 text-green-700 border-green-300'],
		['9', 'bg-red-100 text-red-700 border-red-300'],
		['10', 'bg-blue-100 text-blue-700 border-blue-300'],
	] as const) {
		assert.ok(source.includes(`${grade}: '${expected}'`), `GRADE_BADGE[${grade}] is no longer '${expected}'`);
	}
});

test('CONTROL: the grade exemption is load-bearing, not a hole in the detector', () => {
	// The exemption must strip exactly the grade line and nothing else. If it stripped a whole
	// file, the swept-file row above would go vacuous for that file — so prove it does not.
	const rel = 'components/sections/HomeRoomAutoAssignDialog.tsx';
	const source = readFileSync(join(SRC, rel), 'utf8');
	const rawLines = source.split(/\r?\n/).filter((l) => /(amber|yellow)-[0-9]{2,3}/.test(l));
	assert.equal(
		rawLines.length,
		1,
		`expected exactly one exempted grade line in ${rel}, found ${rawLines.length}: ${rawLines.join(' | ')}`
	);
	assert.match(rawLines[0], /8:\s*'bg-yellow-100 text-yellow-700'/, 'the exempted line is not the G8 grade badge');
	assert.equal(
		countRawWarningLines(stripGradeBadgeExemptions(rel, source)),
		0,
		'the exemption did not remove the grade line'
	);
	// The detector still goes red the moment a NON-grade raw class is added to that same file.
	//
	// A9 C3 (2026-09-29): THE ANCHOR MOVED, and the reason is a vacuity this row would
	// otherwise have hidden. The injection used to target `const REASON_LABELS`, a line
	// that the A9-C3 rewrite of `HomeRoomAutoAssignDialog.tsx` DELETED (the enum labels are
	// now plain phrases in `@/lib/home-room-review-copy`). `String.replace` on a string that
	// is not present returns the receiver UNCHANGED, so the "contaminated" source was the
	// clean file, the count stayed 0, and this row — whose entire job is to prove the
	// exemption is not a hole in the detector — passed while testing nothing at all.
	//
	// The anchor is now `const GRADE_COLORS`, which is asserted present below, so a future
	// deletion of THAT would fail loudly instead of silently disarming the control.
	const ANCHOR = 'const GRADE_COLORS';
	assert.ok(
		source.includes(ANCHOR),
		`${rel} no longer contains "${ANCHOR}"; re-anchor this control's injection, because a ` +
			'`String.replace` on a missing needle returns the source unchanged and this row would ' +
			'pass while testing nothing',
	);
	const contaminated = source.replace(
		ANCHOR,
		'const WARNING_ICON_BADGE = "bg-amber-500";\n\nconst GRADE_COLORS',
	);
	assert.notEqual(
		contaminated,
		source,
		'the injection did not change the source, so the count below would be vacuous',
	);
	assert.equal(
		countRawWarningLines(stripGradeBadgeExemptions(rel, contaminated)),
		1,
		'a fabricated bg-amber-500 next to the grade exemption was not detected; the exemption is too broad',
	);
});

test('repo-wide remaining raw amber/yellow count is pinned (files and lines; derivation below)', () => {
	// Derivation, pinned rather than remembered: baseline at 4c683e1f3 was 82 files /
	// 333 lines repo-wide and 95 lines inside these 13, so sweeping all 13 to zero leaves
	// 82 - 13 = 69 files and 333 - 95 = 238 lines. Moving either literal is a deliberate
	// act, never a side effect of an unrelated edit.
	//
	// ── RE-PINNED 2026-09-28 by stream `a3-c8-audit` (packet c8 item 1) ─────────────
	//   files  69 -> 68
	//   lines 238 -> 232
	// Derivation, re-measured in the same commit rather than carried from a handoff: the
	// scope, exclusions and counting method in this file were replayed verbatim over the
	// base corpus (`pages/Audit.tsx` read at 7ea2abda, every other file from the tree) and
	// over the candidate corpus. `pages/Audit.tsx` was the ONLY file to leave the set and it
	// contributed EXACTLY 6 lines (6 -> 0). No file entered the set and no other file's line
	// count moved: `git diff --name-only 7ea2abda..HEAD` under the corpus roots reduces to
	// `atlas-client/src/pages/Audit.tsx` and nothing else. It needed NO exemption — the
	// amber/yellow it carried was warning-semantic, so it left the corpus on its merits.
	// `pages/Audit.tsx` is not in SWEPT_FILES above (it belongs to `a3-c8-audit`, not to the
	// 13 files S2 swept), so the swept-files row is unaffected by this re-pin.
	//
	// STANDING RULE for the next lane: move these two literals DELIBERATELY, with the
	// per-file delta measured and pasted. Do NOT widen the corpus scope, do NOT change the
	// counting method, do NOT add an exemption to absorb a file, and do NOT touch any other
	// constant to make a red row green. If a file had to be EXEMPTED to make this row pass,
	// that exemption is the defect and belongs in a report, not in this file. A pin that is
	// merely consistent with the tree is a description, not evidence.
	//
	// ── RE-PINNED 2026-09-28 by stream `a3-c9-sections` (packet c9 item 6) ─────────────
	//   files  68 -> 68   (unchanged)
	//   lines 232 -> 230
	// Derivation, measured over the same corpus in the same working tree as the gate run and
	// not carried from a handoff: `git diff --name-only a7ccb738..HEAD` under the corpus roots
	// reduces to `components/sections/SectionRoomPicker.tsx`, `components/sections/__tests__/
	// a3-sections-map-picker-occupant.test.tsx`, `components/sections/__tests__/
	// a3-room-picker-uniform-rows.test.tsx` and `package.json`. The two test files and
	// `package.json` are not corpus source, so the sole measured movement is the picker.
	// Per-file, counted with the same class-token shape as `countRawWarningLines`:
	//   components/sections/SectionRoomPicker.tsx   3 -> 1   (delta -2)
	// The two lines that left were the option-row occupancy treatment item 6 replaced: the
	// `bg-amber-50 text-amber-700 ... border-amber-200` occupant badge and the duplicate
	// `text-amber-700/80` "Room already has a home section" sentence that occupied a second
	// line inside the option. Both are now the measured `--warning` family
	// (`bg-warning-muted` / `text-warning-foreground` / `border-warning-border`), which is the
	// token family this gate exists to converge on. The file REMAINS in the corpus on its
	// merits: the pre-existing `room-picker-occupied-hint` banner still carries one raw amber
	// line, and it is a surface item 6 does not govern. That is why the file pin is unmoved
	// and only the line literal moves. No exemption was added, no scope was widened, and no
	// other constant was touched.
	// ── RE-PINNED 2026-09-29 by stream `a9-c3` (packet A9 c3: Sections + Campus) ──────────
	//   files  69 (at base 955d2e7a) -> 68 (at the candidate)
	//   lines 230 (the base PIN) -> 226, and the base COUNT was 231
	// A9-C3r (2026-09-29, review correction). THE FIRST VERSION OF THIS RE-PIN JUSTIFICATION
	// WAS WRONG ON BOTH CLAUSES, and the error matters more than the arithmetic. It read
	// "files 68 -> 68 (unchanged)" and "no file emptied, so the file pin is unmoved", asserting
	// that no file left the corpus. A reviewer measured the corpus with this file's own
	// `remainingFiles()` walk and the candidate is correct while that reasoning is not:
	//   - the base corpus at 955d2e7a holds 69 files, not 68, so this gate was ALREADY RED at
	//     base and A9-C3 turned it green — the file pin did not "stay" at 68, the count moved
	//     to it;
	//   - `components/sections/SectionsHomeRoomActions.tsx` DID empty out of the file list
	//     (1 -> 0), because the `N needs rooms` amber Popover/Badge it carried is gone.
	// Both readings were confirmed independently before this correction: a separate
	// `git ls-files` + `git show 955d2e7a` walk also returns 69 -> 68 with that one file
	// emptying. Nothing about the PIN VALUES is wrong — 68 files and 226 lines are the
	// candidate's true counts, which is why the suite is green at 14/14. What was wrong was
	// the story told about HOW they got there, and a pin whose derivation misdescribes the
	// movement is a pin a later reader cannot check.
	//
	// Derivation, measured with THIS file's own detector over the same corpus in the same
	// working tree as the gate run, and not carried from a handoff: `git diff --name-only
	// 955d2e7a..HEAD` under the corpus roots reduces to the A9-C3 client files, and the sole
	// movement is raw amber/yellow LEAVING, in three files, per `countRawWarningLines`:
	//   components/sections/SectionsHomeRoomActions.tsx   1 -> 0
	//       the `N needs rooms` amber Popover/Badge chip, replaced by one plain button and
	//       one save-state line. This is the file that EMPTIES, so the file count moves
	//       69 -> 68 with it; no coverage is lost, because "no longer holding raw amber" is
	//       the property this gate measures, and the sub-11px/UX coverage for that file
	//       lives in `a3-sections-map-layout.test.ts`'s `ROOM_SURFACE_OWNED` list, which this
	//       gate never governed and still contains the file;
	//   components/sections/SectionRow.tsx                4 -> 3
	//       the row's unresolved-room icon moved from raw `text-amber-600` to the measured
	//       `--warning` token family, which is the direction this gate exists to push; the
	//       file REMAINS in the corpus, on its `PROGRAM_BADGE` grade colours;
	//   components/campus-map/CampusMapOverview.tsx       6 -> 5
	//       the selected-building status Badge's raw amber pair, gone with the metric Cards
	//       and the `N need attention` badge the A9-C3 problems region replaced.
	// No raw amber/yellow was ADDED anywhere, and no file emptied, so the file pin is
	// unmoved. `HomeRoomAutoAssignDialog.tsx` stays at 0 after its G8 exemption, and the
	// fabrication control above is re-anchored to `const GRADE_COLORS` because the A9-C3
	// rewrite deleted the `const REASON_LABELS` line it used to inject before — a
	// `String.replace` on a missing needle returns the source unchanged, which had left that
	// control passing while testing nothing.
	//
	// DISCLOSED MEASUREMENT GAP, unchanged by this correction and not chased: this file's
	// aggregate moved 4 lines while the three per-file deltas above sum to 3. The difference
	// is one line in the BASE reading between this file's `readdirSync` walk and an
	// independent `git show` walk over `git ls-files`; the NOW value agrees at 226 either way,
	// and the pin is this file's own figure, so the pin was moved to what the gate measures
	// rather than to a second implementation's opinion. Recorded because a pin that silently
	// reconciles two disagreeing counts is the failure §11 warns about. The FILE count is NOT
	// subject to that gap: 69 -> 68 was measured both ways and agrees.
	const PINNED_REMAINING_FILES = 68;
	const PINNED_REMAINING_LINES = 226;

	const files = remainingFiles();
	const lines = files.reduce(
		(total, rel) =>
			total + countRawWarningLines(stripGradeBadgeExemptions(rel, readFileSync(join(SRC, rel), 'utf8'))),
		0
	);
	assert.equal(
		files.length,
		PINNED_REMAINING_FILES,
		`remaining raw-warning file count moved off its pin; a new file gained raw amber/yellow (or a file was swept without updating this literal). Offenders: ${files.join(', ')}`
	);
	assert.equal(
		lines,
		PINNED_REMAINING_LINES,
		`remaining raw-warning line count moved off its pin; ${PINNED_REMAINING_LINES} -> ${lines}`
	);
	// A3-C8 swept files are also absent from the repo-wide remainder — the two rows agree.
	for (const rel of SWEPT_FILES) {
		assert.ok(!files.includes(rel), `${rel} is both swept and still listed as remaining`);
	}
});

test('CONTROL: the detector is not vacuous — a fabricated text-amber-600 IS detected', () => {
	// A ratchet that cannot go red is not evidence (AGENTS.md §11). The detector is exercised
	// against a synthetic string the sweep never produced, and against a string it must ignore.
	const fabricated = '<div className="rounded p-2 text-amber-600" />';
	assert.equal(
		countRawWarningLines(fabricated),
		1,
		'detector missed a fabricated text-amber-600 class'
	);
	assert.equal(
		findRawWarningClasses(fabricated).length,
		1,
		'detector did not report the fabricated amber class'
	);
	// And the negative side: already-converted markup must read as clean.
	assert.equal(
		countRawWarningLines('<div className="bg-warning-muted text-warning-foreground" />'),
		0,
		'detector flagged converted token markup as raw'
	);
});

/* ═══════════════════════════════════════════════════════════════════════════
 * CONTRAST GATE — A3-C8r1 (2026-09-28)
 *
 * A3-C8's own handoff asserted one measured ratio and it was the WRONG role: it
 * reported --warning-foreground at "≈9.9:1" when the measured value is 8.415:1, an
 * overstatement of ~1.5x, and it never measured the role that actually regressed.
 * The first candidate's most common mapping was
 *
 *     text-amber-700 on bg-amber-50  ->  text-warning on bg-warning-muted
 *
 * which measured 4.842:1 at base (AA) and 3.132:1 at the candidate (FAIL) at 23
 * sites, because --warning was authored for the ICON/accent role and then used for
 * body text 32 times.
 *
 * So: every figure below is COMPUTED IN THIS FILE from the real token values read
 * out of src/index.css. A ratio asserted in a handoff is a claim; a ratio asserted
 * here is a gate. The values are not imported from a comment and not hard-coded.
 * ═══════════════════════════════════════════════════════════════════════════ */

type Rgb = [number, number, number];

/** Parse `--name: H S% L%;` out of a token block body. */
function readTriplet(block: string, name: string): [number, number, number] {
	const raw = block.match(new RegExp(`^\\s*${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%;`, 'm'));
	assert.ok(raw, `no "--${name}: H S% L%;" declaration found in the block`);
	return [Number(raw[1]), Number(raw[2]), Number(raw[3])];
}

/** The `:root` and `.dark` block bodies, read from the real stylesheet. */
function tokenBlocks(): { root: string; dark: string } {
	const css = readFileSync(INDEX_CSS, 'utf8');
	const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
	const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/);
	assert.ok(root, 'index.css has no top-level :root block');
	assert.ok(dark, 'index.css has no .dark block');
	return { root: root[1], dark: dark[1] };
}

/** HSL -> sRGB, the same standard conversion CSS itself uses for `hsl()`. */
export function hslToRgb(h: number, s: number, l: number): Rgb {
	const sn = s / 100;
	const ln = l / 100;
	const k = (n: number) => (n + h / 30) % 12;
	const a = sn * Math.min(ln, 1 - ln);
	const f = (n: number) =>
		ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
	return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb;
}

/** WCAG 2.x relative luminance. */
function relativeLuminance([r, g, b]: Rgb): number {
	const lin = (c: number) => {
		const v = c / 255;
		return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio, 1..21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
	const l1 = relativeLuminance(a);
	const l2 = relativeLuminance(b);
	const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
	return (hi + 0.05) / (lo + 0.05);
}

/** Flatten `hsl(var(--x) over <backdrop>)` at the given alpha, the way Tailwind's `/NN` does. */
function tinted(foreground: Rgb, alpha: number, backdrop: Rgb): Rgb {
	return foreground.map((v, i) => Math.round(v * alpha + backdrop[i] * (1 - alpha))) as Rgb;
}

const AA_TEXT = 4.5;
const AA_UI = 3;

test('CONTRAST: light scheme — every text role of the warning family clears WCAG AA 4.5:1', () => {
	const { root } = tokenBlocks();
	const warning = hslToRgb(...readTriplet(root, '--warning'));
	const foreground = hslToRgb(...readTriplet(root, '--warning-foreground'));
	const muted = hslToRgb(...readTriplet(root, '--warning-muted'));
	const white: Rgb = [255, 255, 255];
	const mutedHalf = tinted(muted, 0.5, white);

	const rows: [string, number, number][] = [
		['--warning on --warning-muted (the 32-site body-text role)', contrastRatio(warning, muted), AA_TEXT],
		['--warning on white (banner copy on a plain card)', contrastRatio(warning, white), AA_TEXT],
		['--warning on bg-warning-muted/50 (SectionHomeRoomModals header)', contrastRatio(warning, mutedHalf), AA_TEXT],
		['--warning-foreground on --warning-muted', contrastRatio(foreground, muted), AA_TEXT],
		['--warning-foreground on bg-warning-muted/50', contrastRatio(foreground, mutedHalf), AA_TEXT],
		// NotificationBell:93 renders `bg-warning` with `text-white`. At base that was
		// `bg-amber-500` with `text-white` = 2.148:1 (a pre-existing AA failure, now fixed
		// for free by the darkening).
		['text-white on bg-warning (unread-count badge)', contrastRatio(white, warning), AA_TEXT],
	];
	for (const [label, actual, floor] of rows) {
		assert.ok(
			actual >= floor,
			`${label} measures ${actual.toFixed(3)}:1, below the required ${floor}:1. Darken the token in index.css :root; do NOT lower this threshold.`
		);
	}
});

test('CONTRAST: light scheme — the icon/accent and border roles clear the 3:1 UI floor, or are pinned debt', () => {
	const { root } = tokenBlocks();
	const warning = hslToRgb(...readTriplet(root, '--warning'));
	const muted = hslToRgb(...readTriplet(root, '--warning-muted'));
	const border = hslToRgb(...readTriplet(root, '--warning-border'));
	const white: Rgb = [255, 255, 255];

	// The AlertTriangle/AlertCircle icons sit on `bg-warning/10`, i.e. the token at 10% over
	// the panel. That is a UI component (WCAG 1.4.11), so it must clear 3:1.
	const chipOverPanel = tinted(warning, 0.1, muted);
	const chipOverWhite = tinted(warning, 0.1, white);
	assert.ok(
		contrastRatio(warning, chipOverPanel) >= AA_UI,
		`--warning icon on bg-warning/10 over --warning-muted is ${contrastRatio(warning, chipOverPanel).toFixed(3)}:1, below the 3:1 UI floor`
	);
	assert.ok(
		contrastRatio(warning, chipOverWhite) >= AA_UI,
		`--warning icon on bg-warning/10 over white is ${contrastRatio(warning, chipOverWhite).toFixed(3)}:1, below the 3:1 UI floor`
	);

	// KNOWN, PINNED DEBT — asserted, not hidden. --warning-border is a decorative hairline
	// around a panel whose own text already sits above 5:1, and WCAG 1.4.11 exempts purely
	// decorative boundaries. The floor here is the *measured debt ceiling*, not AA: if a
	// future edit makes the border WORSE, this row goes red and forces a decision. Reaching
	// a true 3:1 needs `41 78% 40%` (#b68316), which changes the token's role from a tint to
	// a heavy rule — a product decision, not a silent one.
	const borderRatio = contrastRatio(border, muted);
	assert.ok(
		borderRatio >= 2.0,
		`--warning-border on --warning-muted fell to ${borderRatio.toFixed(3)}:1, worse than the pinned 2.081:1 debt level (1.190:1 at A3-C8, 1.201:1 for the base border-amber-200 on bg-amber-50).`
	);
	assert.ok(
		borderRatio < AA_UI,
		`--warning-border is now ${borderRatio.toFixed(3)}:1, i.e. it reached 3:1. That was expected to be a deliberate role change to \`41 78% 40%\`; record it in index.css rather than letting it happen by accident.`
	);
});

test('CONTRAST: dark pair, computed from the real .dark block values', () => {
	const { dark } = tokenBlocks();
	const warning = hslToRgb(...readTriplet(dark, '--warning'));
	const foreground = hslToRgb(...readTriplet(dark, '--warning-foreground'));
	const muted = hslToRgb(...readTriplet(dark, '--warning-muted'));
	const white: Rgb = [255, 255, 255];

	// Body text.
	assert.ok(
		contrastRatio(foreground, muted) >= AA_TEXT,
		`dark --warning-foreground on dark --warning-muted is ${contrastRatio(foreground, muted).toFixed(3)}:1, below 4.5:1`
	);
	// Icon/accent on the dark surface: WCAG 1.4.11.
	assert.ok(
		contrastRatio(warning, muted) >= AA_UI,
		`dark --warning on dark --warning-muted is ${contrastRatio(warning, muted).toFixed(3)}:1, below the 3:1 UI floor`
	);
	// The same NotificationBell badge, in the dark pair. A3-C8r1's 42 88% 62% gave 1.687:1.
	assert.ok(
		contrastRatio(white, warning) >= AA_TEXT,
		`dark text-white on dark bg-warning is ${contrastRatio(white, warning).toFixed(3)}:1, below 4.5:1`
	);
	// An icon must be distinguishable from the label beside it. A3-C8r1 measured 1.434:1 here.
	assert.ok(
		contrastRatio(warning, foreground) >= AA_UI,
		`dark --warning icon vs dark --warning-foreground label is ${contrastRatio(warning, foreground).toFixed(3)}:1; the icon and its own label are nearly the same lightness`
	);
});

test('CONTRAST: the hue and saturation are unchanged, so the darkening is not a re-hue', () => {
	// A contrast fix is allowed to move lightness. It is not allowed to reach AA by turning the
	// token red, brown, or grey. Pinned to the A3-C8 values: only lightness may move.
	const { root, dark } = tokenBlocks();
	const [h, s] = readTriplet(root, '--warning');
	assert.equal(h, 35, '--warning hue moved off 35deg; a re-hue is a design change, not a contrast fix');
	assert.equal(s, 76, '--warning saturation moved off 76%; desaturating into grey is not a contrast fix');
	// And the family is still recognisably amber: hue within amber's band, saturation well clear
	// of the greys.
	assert.ok(h >= 25 && h <= 50, `--warning hue ${h} has left the amber band`);
	assert.ok(s >= 60, `--warning saturation ${s} is too close to grey to read as amber`);

	// Same discipline for the dark accent, which had to move a long way to satisfy two roles.
	const [dh, ds] = readTriplet(dark, '--warning');
	assert.ok(dh >= 25 && dh <= 50, `dark --warning hue ${dh} has left the amber band`);
	assert.ok(ds >= 60, `dark --warning saturation ${ds} is too close to grey to read as amber`);
});

test('CONTROL: the contrast function CAN fail — a fabricated low-contrast pair is reported below AA', () => {
	// The single most important control in this file. A contrast gate whose function always
	// returns a passing number is decoration. So: build a pair that is genuinely low contrast
	// and prove the function says so. `35 76% 44%` is A3-C8r1's --warning, the value that
	// caused the regression — measured here as the negative.
	const failing = hslToRgb(35, 76, 44);
	const muted = hslToRgb(...readTriplet(tokenBlocks().root, '--warning-muted'));
	const onMuted = contrastRatio(failing, muted);
	const onWhite = contrastRatio(failing, [255, 255, 255]);
	assert.ok(
		onMuted < AA_TEXT,
		`the control pair measured ${onMuted.toFixed(3)}:1, which is NOT below 4.5:1 — this control can no longer prove the gate can fail`
	);
	assert.ok(
		onWhite < AA_TEXT,
		`the control pair measured ${onWhite.toFixed(3)}:1 on white, which is NOT below 4.5:1`
	);
	// Known-truth anchors, so a broken conversion cannot pass by accident in the other
	// direction. Pure black on pure white is exactly 21:1 by definition.
	assert.ok(
		Math.abs(contrastRatio([0, 0, 0], [255, 255, 255]) - 21) < 0.01,
		'black-on-white did not measure 21:1, so the conversion itself is wrong'
	);
	assert.ok(
		Math.abs(contrastRatio([255, 255, 255], [255, 255, 255]) - 1) < 0.01,
		'a colour against itself did not measure 1:1, so the ratio is not bounded below'
	);
	// And the corrected token must genuinely clear what the rejected one failed.
	const corrected = hslToRgb(...readTriplet(tokenBlocks().root, '--warning'));
	assert.ok(
		contrastRatio(corrected, muted) > onMuted + 1.5,
		'--warning is not meaningfully darker than the value this file rejected'
	);
});
