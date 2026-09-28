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
 */

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
			if (/(amber|yellow)-[0-9]{2,3}/.test(readFileSync(child, 'utf8'))) {
				out.push(relative(SRC, child).split(sep).join('/'));
			}
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
		const source = readFileSync(join(SRC, rel), 'utf8');
		const raw = findRawWarningClasses(source);
		if (raw.length > 0) {
			offenders.push(`${rel}: ${raw.join(', ')} (${countRawWarningLines(source)} line(s))`);
		}
	}
	assert.deepEqual(offenders, [], `raw warning colour re-introduced in swept files -> ${offenders.join(' | ')}`);
});

test('repo-wide remaining raw amber/yellow count is pinned at 69 files / 238 lines', () => {
	// Derivation, pinned rather than remembered: baseline at 4c683e1f3 was 82 files /
	// 333 lines repo-wide and 95 lines inside these 13, so sweeping all 13 to zero leaves
	// 82 - 13 = 69 files and 333 - 95 = 238 lines. Moving either literal is a deliberate
	// act, never a side effect of an unrelated edit.
	const PINNED_REMAINING_FILES = 69;
	const PINNED_REMAINING_LINES = 238;

	const files = remainingFiles();
	const lines = files.reduce(
		(total, rel) => total + countRawWarningLines(readFileSync(join(SRC, rel), 'utf8')),
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
