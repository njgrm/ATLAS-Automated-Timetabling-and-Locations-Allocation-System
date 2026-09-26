import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Committed-credential guard (SECRET-SCRUB-20260926).
 *
 * A credential-shaped literal committed to this repository is a credential in every
 * clone of it, and the GitHub repository is public. This guard makes that class of
 * defect fail the build instead of relying on reviewers to notice it.
 *
 * Two shapes are detected:
 *   1. a DSN carrying an inline password, and
 *   2. an assigned credential literal (`PASSWORD`/`SECRET`/`TOKEN`/`PRIVATE_KEY`).
 *
 * Three design points are load-bearing, and each was paid for with a measured fact:
 *
 * - SCOPE IS PATH-BASED, never a per-line exemption list. A repo-wide scan of rule 2
 *   returns dozens of matches, almost all of them synthetic fixtures inside test
 *   directories. A guard that flagged those would be pure noise and would be deleted.
 *   So test directories, `*.test.*` / `*.spec.*` files, and QA artifact trees are
 *   excluded by path, which is a class of location rather than a list of blessed lines.
 * - PLACEHOLDERS ARE CLASSIFIED BY SHAPE, never exempted by line. The rule is
 *   prefix-anchored (`isPlaceholder` below), so `your_password` is a placeholder
 *   because of what it *starts with*, and the same mechanism still flags a stale
 *   default DSN password such as the well-known `atlas:atlas`, which matches no
 *   placeholder prefix. An earlier per-substring rule failed exactly here: it matched
 *   `your-` and `your_` but not the `your_password` form, which made the five
 *   README.md DSNs look like live leaks. They were never leaks — they are
 *   documentation placeholders — so the defect was in this guard's classifier, not
 *   in the documentation. README.md is deliberately NOT modified.
 * - `.env.example` IS in scope. It is a template, and it was one of the offenders:
 *   a template that carries a real password is a real password in every clone.
 *
 * A file set read from `git ls-files` (not a hardcoded array) keeps the scope honest
 * as the tree changes. The file set is asserted, not assumed: an empty or
 * accidentally over-narrow scope would make this guard vacuously green.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..');

/** Directories whose contents are fixtures or artifacts, never production source. */
const EXCLUDED_SEGMENTS = ['node_modules/', 'qa-artifacts/', '__tests__/', '__fixtures__/'];

/** Test files can live outside `__tests__` (e.g. `qa-artifacts/*.test.ts`). */
const EXCLUDED_FILE_NAME = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Refuse to read absurdly large files; they are artifacts, not source literals. */
const MAX_BYTES = 4 * 1024 * 1024;

const DSN_WITH_INLINE_PASSWORD = /postgres(?:ql)?:\/\/[^:/\s'"]+:([^@/\s'"]+)@/gi;
const ASSIGNED_CREDENTIAL = /(PASSWORD|SECRET|TOKEN|PRIVATE_KEY)\s*[:=]\s*['"]([^'"]{4,})['"]/gi;

/** Any DSN, with or without an inline password. */
const DSN_SHAPE = /postgres(?:ql)?:\/\//i;

/**
 * Placeholder classification, by PREFIX rather than by substring.
 *
 * Prefix-anchoring is the structural form the packet requires: a value is accepted
 * or rejected because of the class its leading characters put it in, so a new
 * placeholder (`your_prod_password`, `change-me-later`) is accepted without editing
 * this guard, and a real credential is rejected without anyone adding an exemption.
 * Substring matching is not equivalent — it is why the earlier `your-`/`your_`
 * entry silently failed to cover the `your_password` form used throughout
 * README.md, which is a real documentation convention and not a leak.
 *
 * `atlas` (the stale local default DSN password) starts with none of these and is
 * therefore still flagged; that is asserted below, not assumed.
 */
const DSN_PLACEHOLDER_PREFIXES = [
	'your', // your / your_password / your_prod_password
	'your_',
	'your-',
	'change', // CHANGE_ME, change-this-to-a-random-secret, changeme
	'example',
	'placeholder',
	'xxx',
];

/**
 * The assigned-credential rule additionally accepts a `test`-prefixed value.
 *
 * Exactly one in-scope site needs it and it is not a credential: the disposable
 * database suite runner assigns synthetic `JWT_SECRET` / system-token values before
 * starting a throwaway PostgreSQL instance. It is a value *class*, so it is stated
 * as a class; it is not a per-line exemption.
 */
const ASSIGNED_PLACEHOLDER_PREFIXES = [...DSN_PLACEHOLDER_PREFIXES, 'test-', 'test_'];

/** Bracketed or interpolated values are unambiguously templates. */
const PLACEHOLDER_SHAPES = [/^<.*>$/, /\$\{[^}]*\}/];

interface Finding {
	readonly file: string;
	readonly line: number;
	readonly rule: string;
	/** Variable name or DSN user. Never the credential value. */
	readonly key: string;
}

export function isDsnpasswordPlaceholder(value: string): boolean {
	return classify(value, DSN_PLACEHOLDER_PREFIXES);
}

function classify(value: string, prefixes: string[]): boolean {
	if (PLACEHOLDER_SHAPES.some((shape) => shape.test(value))) return true;
	const normalized = value.toLowerCase();
	return prefixes.some((prefix) => normalized.startsWith(prefix));
}

function lineAt(text: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i += 1) {
		if (text.charCodeAt(i) === 10) line += 1;
	}
	return line;
}

const COMMENT_LINE = /^[\s]*(?:\/\/|\/\*|\*|#)/;

/**
 * Blank out whole-line comments, preserving offsets so line numbers stay truthful.
 *
 * A line beginning `//`, `*`, `#` or `/*` is a comment in every language this guard
 * reads (TS/JS, `.env`, shell, SQL, Markdown), so it cannot hold a real assignment.
 * This is a line-shape rule, not a blessed-line list. It earns its place: without it
 * the guard flags ordinary prose in doc comments, where a sentence containing the
 * word "token" followed by a quoted phrase reads as `token: "..."`. A guard that
 * fires on sentences gets deleted.
 */
function scanableText(text: string): string {
	return text
		.split('\n')
		.map((line) => (COMMENT_LINE.test(line) ? '' : line))
		.join('\n');
}

/** The DSN user, for the report. Never the password. */
function dsnUserOf(full: string, password: string): string {
	const schemeEnd = full.indexOf('://');
	const userinfo = full.slice(schemeEnd + 3, full.length - password.length - 1);
	return userinfo.replace(/:$/, '');
}

/**
 * Apply both rules to one file's text. Exported so the rules themselves are proven
 * load-bearing in every run, not only during the one-off anti-vacuity demonstration.
 */
export function findCredentialLiterals(file: string, text: string): Finding[] {
	const findings: Finding[] = [];
	const scan = scanableText(text);

	for (const match of scan.matchAll(DSN_WITH_INLINE_PASSWORD)) {
		const password = match[1];
		if (isDsnpasswordPlaceholder(password)) continue;
		findings.push({
			file,
			line: lineAt(text, match.index ?? 0),
			rule: 'dsn-with-inline-password',
			key: `DSN password for user "${dsnUserOf(match[0], password)}"`,
		});
	}

	for (const match of scan.matchAll(ASSIGNED_CREDENTIAL)) {
		// A DSN is judged once, by rule 1, which can see the password segment. Rule 2
		// sees only the whole string, so letting it also rule on a DSN would reject a
		// legitimate `postgresql://u:CHANGE_ME@h/db` assigned to a variable named
		// PASSWORD — a false positive of exactly the kind that gets a guard deleted.
		// Deferring on a value *class* ("is a DSN") keeps the rule structural.
		if (DSN_SHAPE.test(match[2])) continue;
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(text, match.index ?? 0),
			rule: 'assigned-credential-literal',
			key: match[1],
		});
	}

	return findings;
}

function isScannedPath(relative: string): boolean {
	if (EXCLUDED_SEGMENTS.some((segment) => relative.includes(segment))) return false;
	if (EXCLUDED_FILE_NAME.test(relative)) return false;
	return true;
}

/** The real tracked file set, straight from Git so the scope cannot drift. */
export function scannedFiles(): string[] {
	const output = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z'], {
		encoding: 'utf8',
		maxBuffer: 64 * 1024 * 1024,
	});
	return output.split('\0').filter((entry) => entry.length > 0 && isScannedPath(entry)).sort();
}

function readTextOrNull(relative: string): string | null {
	const absolute = resolve(repoRoot, relative);
	let buffer: Buffer;
	try {
		buffer = readFileSync(absolute);
	} catch {
		// Tracked but absent (sparse checkout / skip-worktree): nothing to scan.
		return null;
	}
	if (buffer.length > MAX_BYTES) return null;
	if (buffer.includes(0)) return null; // binary artifact
	return buffer.toString('utf8');
}

test('no tracked production file contains a credential-shaped literal', () => {
	const files = scannedFiles();

	// Anti-vacuity for the SCOPE. A guard that scans nothing is green for free.
	assert.ok(
		files.length > 100,
		`expected a meaningful tracked file set to scan, got ${files.length} — the scope is broken, not clean`,
	);
	assert.ok(
		files.includes('atlas-server/.env.example'),
		'.env.example must stay in scope: a template carrying a real password is a real password in every clone',
	);
	assert.ok(
		!files.some((file) => file.includes('__tests__/') || EXCLUDED_FILE_NAME.test(file)),
		'test fixtures must be excluded by path so the guard is not noise',
	);

	const findings = files.flatMap((relative) => {
		const text = readTextOrNull(relative);
		return text === null ? [] : findCredentialLiterals(relative, text);
	});

	// The report deliberately carries file, line, rule and key only. The value is
	// never printed: a failing guard must not copy a credential into CI logs.
	assert.deepEqual(
		findings,
		[],
		`tracked production files contain credential-shaped literals (values redacted). ` +
			`Use an obvious placeholder (CHANGE_ME, <...>, your_..., example...) or read the value from the environment, ` +
			`then fail closed when it is absent:\n` +
			findings.map((f) => `  ${f.file}:${f.line} [${f.rule}] ${f.key} = <redacted>`).join('\n'),
	);
});

/**
 * The placeholder classifier is the exact thing that was wrong last round, so it is
 * pinned by class rather than by anecdote. Every accepted form below is the generic
 * shape; the last two assertions are the ones that matter most: a value matching no
 * placeholder prefix is REJECTED, and a real password in the documentation DSNs is
 * REJECTED too. Without those the guard would be vacuous in the other direction —
 * green because it flags nothing at all.
 */
test('placeholder classification is structural: prefix classes accepted, real values rejected', () => {
	for (const accepted of [
		'your_password',
		'YOUR_PASSWORD',
		'your_password_here',
		'your-password',
		'your',
		'CHANGE_ME',
		'changeme',
		'change-this-to-a-random-32-char-minimum-secret-key',
		'example_password',
		'placeholder-token',
		'xxxxxxxx',
	]) {
		assert.equal(
			isDsnpasswordPlaceholder(accepted),
			true,
			`${JSON.stringify(accepted)} starts with a placeholder prefix and must be accepted`,
		);
	}
	for (const shape of ['<your-password-here>', '${DB_PASSWORD}']) {
		assert.equal(isDsnpasswordPlaceholder(shape), true, `${shape} is a template shape`);
	}

	// The load-bearing rejections. A stale local default matches no placeholder
	// prefix and must be flagged; so must an ordinary-looking real password.
	for (const rejected of ['atlas', 'P4ssw0rd', 'hunter2', 'S3cret!', 'Db-Prod-9f2a']) {
		assert.equal(
			isDsnpasswordPlaceholder(rejected),
			false,
			`${JSON.stringify(rejected)} matches no placeholder class and must be flagged`,
		);
	}
});

/**
 * README.md is the two-way control: the documentation DSNs must stay unflagged
 * (they are placeholders, and this guard must not push authors to delete real
 * setup documentation), while the identical text with a real password substituted
 * must be flagged. Passing on README is therefore evidence of correct
 * classification, not evidence of a guard that finds nothing.
 */
test('README.md placeholder DSNs are not flagged, and the same DSNs with a real password are', () => {
	const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

	// Fixture taken from the real surface, not invented.
	assert.ok(
		DSN_WITH_INLINE_PASSWORD.test(readme),
		'expected README.md to contain DSN examples for this control to be meaningful',
	);
	DSN_WITH_INLINE_PASSWORD.lastIndex = 0;

	assert.deepEqual(
		findCredentialLiterals('README.md', readme),
		[],
		'the committed README DSNs are documentation placeholders and must not be flagged',
	);

	// Same document, one character class swapped: the rule must now fire, once per site.
	const withRealPassword = readme.replace(/postgres(?:ql)?:\/\/[^:/\s'"]+:your_password@/gi, 'postgresql://atlas_user:P4ssw0rd@');
	const findings = findCredentialLiterals('README.md', withRealPassword);
	assert.ok(
		findings.length > 0,
		'proving the README pass is real detection: substituting a non-placeholder password must be flagged',
	);
	assert.deepEqual(
		[...new Set(findings.map((f) => f.rule))],
		['dsn-with-inline-password'],
		'only the DSN rule should fire for a DSN password substitution',
	);
});

/**
 * The permanent synthetic-sample control. These strings are invented for this
 * test and are not any real credential. It proves BOTH rules stay load-bearing in
 * every run, and that each rule is a no-op on its own placeholder form.
 */
test('the credential rules are load-bearing (shape control)', () => {
	const flaggedDsn = findCredentialLiterals(
		'sample.ts',
		"const url = 'postgresql://some_user:Zq7f2xK9m@db.internal:5432/app';",
	);
	assert.deepEqual(flaggedDsn, [
		{ file: 'sample.ts', line: 1, rule: 'dsn-with-inline-password', key: 'DSN password for user "some_user"' },
	]);

	const flaggedAssignment = findCredentialLiterals(
		'sample.ts',
		"process.env.ADMIN_PASSWORD = 'Zq7f2xK9m';\nconst TOKEN = 'Qa83nd1Lp';",
	);
	assert.deepEqual(
		flaggedAssignment.map((f) => f.rule),
		['assigned-credential-literal', 'assigned-credential-literal'],
	);
	assert.deepEqual(flaggedAssignment.map((f) => f.key), ['PASSWORD', 'TOKEN']);
	assert.deepEqual(flaggedAssignment.map((f) => f.line), [1, 2]);

	// Rule 2 alone: the placeholder forms of an assignment are accepted.
	assert.deepEqual(findCredentialLiterals('s.ts', "const PASSWORD = 'CHANGE_ME';"), []);
	assert.deepEqual(findCredentialLiterals('s.ts', "const PASSWORD = '<your-password-here>';"), []);
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'your_password';"),
		[],
		'the your_password form must be accepted here too — it is the form that regressed',
	);
	// The disposable-DB suite runner's synthetic value class.
	assert.deepEqual(findCredentialLiterals('s.ts', "process.env.JWT_SECRET = 'test-gate-secret';"), []);
	// A real password in the same shape is still caught.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'P4ssw0rd';").map((f) => f.rule),
		['assigned-credential-literal'],
	);

	// Rule 1 alone: an interpolated DSN password is a template, not a literal, and a
	// DSN assigned to a PASSWORD variable is judged once by rule 1 rather than twice.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'postgresql://u:CHANGE_ME@h:5432/d';"),
		[],
	);
	// ...but a real password inside that same DSN is still caught, by rule 1.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'postgresql://u:P4ssw0rd@h:5432/d';").map((f) => f.rule),
		['dsn-with-inline-password'],
	);
	// A stale default DSN password is caught by rule 1.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const url = 'postgresql://atlas:atlas@127.0.0.1:5432/atlas';").map((f) => f.rule),
		['dsn-with-inline-password'],
	);
	// Reading from the environment is not a literal at all.
	assert.deepEqual(findCredentialLiterals('s.ts', 'const PASSWORD = process.env.X;'), []);
});
