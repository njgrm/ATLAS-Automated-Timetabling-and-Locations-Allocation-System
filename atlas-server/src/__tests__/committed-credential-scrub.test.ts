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
 * The rules, and the shape each one is keyed on:
 *
 *   1. `dsn-with-inline-password`   a DSN carrying a password segment
 *   2. `assigned-credential-literal` a credential-named binding assigned a quoted value
 *   3. `password-hash-literal`       a password-hashing call given a literal
 *   4. `markdown-email-credential-pair`  docs pairing an address with a password
 *   5. `json-credential-key`         a quoted credential key with a quoted value
 *
 * Rule 3 exists because rule 2 cannot see the real shape. The four credential
 * literals that survived the first two rounds of this guard were all
 * `bcrypt.hash('<literal>', 12)` bound to a variable named `adminHash` /
 * `facultyHash` — a keyword-on-the-line heuristic matches no part of that, and a
 * hashing call carrying a literal password is a structural signal on its own.
 *
 * Design points that are load-bearing, each paid for with a measured fact:
 *
 * - SCOPE IS PATH-BASED, never a per-line exemption list. Test directories,
 *   `*.test.*` / `*.spec.*` files and QA artifact trees are excluded by path, which is
 *   a class of location rather than a list of blessed lines. `.env.example` is IN
 *   scope: a template carrying a real password is a real password in every clone.
 * - PLACEHOLDERS ARE CLASSIFIED BY SHAPE, never exempted by line. Classification is
 *   prefix-anchored (`isPlaceholder`), so `your_password` is a placeholder because of
 *   what it starts with, while the stale local default `atlas:atlas` matches no
 *   placeholder prefix and is still flagged. An earlier per-substring rule failed
 *   exactly here and made the README DSNs look like leaks; they are placeholders, so
 *   the defect was in this classifier, not in the documentation.
 * - COMMENT LINES ARE SCANNED. They were previously blanked, which made a
 *   commented-out credential invisible. The prose false positive that motivated the
 *   blanking is now handled structurally: rule 2 requires an assignment position
 *   (start of line, or after a statement/property boundary, optionally past a comment
 *   marker or `const`/`let`/`var`), so the sentence "…de-snake-case the token: …"
 *   is not an assignment and is not flagged. Skipping a line class would have hidden
 *   the credential; the rule was narrowed instead.
 * - REGEXES ARE NOT GLOBAL. `matchAll` on a `/g` regex consumes and mutates
 *   `lastIndex`, so a module-level global pattern silently truncated its scan on the
 *   second call and correctness depended on test order. Every pattern here is
 *   flag-free and `eachMatch` builds a fresh global clone per call, so a scan is
 *   independent of every scan before it.
 *
 * KNOWN GAP, disclosed rather than hidden: a `KEY = process.env.X || '<literal>'`
 * fallback literal is NOT covered. Adding that rule makes this guard red on a real
 * credential in `atlas-server/src/services/local-auth.service.ts` which is outside the
 * authority of the change that introduced the rule, so the rule is deferred to the
 * commit that fixes that site rather than shipped as a knowingly-red gate.
 *
 * A file set read from `git ls-files` (not a hardcoded array) keeps the scope honest as
 * the tree changes, and the file set is asserted, not assumed: an empty or
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

/** Identifiers that name a credential. `CREDENTIALS` is deliberately absent. */
const CREDENTIAL_KEYWORD = 'PASSWORD|PASSWD|SECRET|TOKEN|PRIVATE_KEY|API_?KEY';

/**
 * The user segment is now permitted to be EMPTY. `postgres://:<secret>@host/db` is a
 * real DSN shape and the previous `[^:/\s'"]+` requirement let it through unnoticed.
 */
const DSN_WITH_INLINE_PASSWORD = /postgres(?:ql)?:\/\/[^:@\/\s'"]*:([^@/\s'"]+)@/i;

/**
 * Rule 2, keyed on an ASSIGNMENT POSITION rather than on the keyword merely appearing.
 *
 * The position is `^` under `m` (so a line start, including one after a newline) or a
 * statement/property delimiter consumed as a lookbehind, optionally past a comment
 * marker and `const`/`let`/`var`. That is what separates a real binding from prose that
 * happens to contain the word "token". The newline is handled by `^` rather than
 * consumed as a delimiter, because a consumed newline would be the match index and the
 * finding would report the previous line.
 */
const ASSIGNED_CREDENTIAL = new RegExp(
	'(?:^[ \\t]*|(?<=[;,(.=&])[ \\t]*)' +
		'(?:(?:\\/\\/|#|\\*)[ \\t]*)?' +
		'(?:export[ \\t]+)?(?:(?:const|let|var)[ \\t]+)?' +
		`(?:process\\.env\\.)?([A-Za-z0-9_]*?(?:${CREDENTIAL_KEYWORD}))` +
		'[ \\t]*[:=][ \\t]*[\'"]([^\'"]{4,})[\'"]',
	'im',
);

/**
 * Rule 3: a password-hashing call handed a string literal.
 *
 * Both the member form (`bcrypt.hash`, `argon2.hash`) and the bare function form
 * (`scrypt`, `pbkdf2`, and their Sync variants) are covered. The keyword must END the
 * callee name and the literal must be its first argument, so `outboundSecretEnv` and
 * `bcrypt.hash(adminPassword, 12)` are both correctly out of scope.
 */
const PASSWORD_HASH_LITERAL =
	/\b(?:(?:bcrypt|argon2|argon)\s*\.\s*(?:hash|hashSync|derive|deriveKey)|(?:scrypt|pbkdf2)(?:Sync)?)\s*\(\s*(['"])([^'"]{4,})\1/i;

/**
 * Rule 4: documentation pairing an address with a password, e.g.
 * ``admin@example.edu / `P4ssw0rd` ``.
 *
 * The address must end in an alphabetic TLD, which is what keeps `react-query@5.103.1`
 * — a package specifier, not a login — out. Only a run of separators and quotes may sit
 * between the address and the value, so an object literal's `email: 'x', department: 'y'`
 * cannot be read as a pairing.
 */
const MARKDOWN_CREDENTIAL_PAIR =
	/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}[\s'"`|]*[/|:=-]\s*['"`]?([^\s'"`;,]{6,})/i;

/** Rule 5: a quoted credential key with a quoted value. */
const JSON_CREDENTIAL_KEY =
	/["']\s*(?:password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key)\s*["']\s*:\s*(['"])([^'"]{4,})\1/i;

/** Any DSN, with or without an inline password. */
const DSN_SHAPE = /postgres(?:ql)?:\/\//i;

/**
 * Placeholder classification, by PREFIX rather than by substring.
 *
 * Prefix-anchoring is the structural form: a value is accepted or rejected because of
 * the class its leading characters put it in, so a new placeholder
 * (`your_prod_password`, `change-me-later`) is accepted without editing this guard and
 * a real credential is rejected without anyone adding an exemption. `atlas` (the stale
 * local default DSN password) starts with none of these and is therefore still flagged;
 * that is asserted below, not assumed.
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
 * starting a throwaway PostgreSQL instance. It is a value *class*, so it is stated as
 * a class; it is not a per-line exemption.
 */
const ASSIGNED_PLACEHOLDER_PREFIXES = [...DSN_PLACEHOLDER_PREFIXES, 'test-', 'test_'];

/** Bracketed or interpolated values are unambiguously templates. */
const PLACEHOLDER_SHAPES = [/^<.*>$/, /\$\{[^}]*\}/];

interface Finding {
	readonly file: string;
	readonly line: number;
	readonly rule: string;
	/** Variable name, DSN user, or rule identity. Never the credential value. */
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

/**
 * Iterate matches of a NON-GLOBAL pattern.
 *
 * `matchAll` mutates `lastIndex` on a `/g` pattern and begins the next call wherever
 * the previous one stopped, so a module-level global pattern made the second and later
 * scans of a session silently incomplete — the defect this helper exists to remove. A
 * fresh clone per call also means `.test()` and `.exec()` on the exported patterns
 * cannot poison a scan.
 */
function eachMatch(text: string, pattern: RegExp): RegExpMatchArray[] {
	return [...text.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))];
}

/** The DSN user, for the report. Never the password. */
function dsnUserOf(full: string, password: string): string {
	const schemeEnd = full.indexOf('://');
	const userinfo = full.slice(schemeEnd + 3, full.length - password.length - 1);
	const user = userinfo.replace(/:$/, '');
	return user.length > 0 ? user : '(no user segment)';
}

/**
 * Apply every rule to one file's text. Exported so the rules themselves are proven
 * load-bearing in every run, not only during the one-off anti-vacuity demonstration.
 */
export function findCredentialLiterals(file: string, text: string): Finding[] {
	const findings: Finding[] = [];
	const isMarkdown = file.toLowerCase().endsWith('.md');

	for (const match of eachMatch(text, DSN_WITH_INLINE_PASSWORD)) {
		const password = match[1];
		if (isDsnpasswordPlaceholder(password)) continue;
		findings.push({
			file,
			line: lineAt(text, match.index ?? 0),
			rule: 'dsn-with-inline-password',
			key: `DSN password for user "${dsnUserOf(match[0], password)}"`,
		});
	}

	for (const match of eachMatch(text, PASSWORD_HASH_LITERAL)) {
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(text, match.index ?? 0),
			rule: 'password-hash-literal',
			key: 'password hashing call argument',
		});
	}

	// Rule 4 is documentation-scoped by file class. A login presented in prose is the
	// shape it targets, and that surface is Markdown; a code file holding the same
	// pairing is reported by the other rules or by review, not by guessing.
	if (isMarkdown) {
		for (const match of eachMatch(text, MARKDOWN_CREDENTIAL_PAIR)) {
			if (classify(match[1], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
			findings.push({
				file,
				line: lineAt(text, match.index ?? 0),
				rule: 'markdown-email-credential-pair',
				key: 'documented login',
			});
		}
	}

	for (const match of eachMatch(text, JSON_CREDENTIAL_KEY)) {
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(text, match.index ?? 0),
			rule: 'json-credential-key',
			key: 'quoted credential key',
		});
	}

	for (const match of eachMatch(text, ASSIGNED_CREDENTIAL)) {
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
 * The placeholder classifier is the exact thing that was wrong in an earlier round, so
 * it is pinned by class rather than by anecdote. The rejections matter most: a value
 * matching no placeholder prefix is REJECTED, and so is a real-looking password.
 * Without those the guard would be vacuous in the other direction — green because it
 * flags nothing at all.
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
 * Rule 1, and the empty-user form the previous `+` quantifier missed.
 *
 * The first assertion is the requirement this change was opened for: the real
 * `bcrypt.hash('literal', 12)` shape is caught. The last is the non-blocking
 * `postgres://:<secret>@host/db` form.
 */
test('DSN rule: inline password flagged, empty-user form flagged, placeholders accepted', () => {
	assert.deepEqual(
		findCredentialLiterals('sample.ts', "const url = 'postgresql://some_user:Zq7f2xK9m@db.internal:5432/app';"),
		[
			{
				file: 'sample.ts',
				line: 1,
				rule: 'dsn-with-inline-password',
				key: 'DSN password for user "some_user"',
			},
		],
	);

	// The empty-user DSN. Previously missed: the user segment had to be non-empty.
	assert.deepEqual(
		findCredentialLiterals('sample.ts', "const url = 'postgresql://:Qa83nd1Lp@db.internal:5432/app';"),
		[
			{
				file: 'sample.ts',
				line: 1,
				rule: 'dsn-with-inline-password',
				key: 'DSN password for user "(no user segment)"',
			},
		],
	);

	assert.deepEqual(
		findCredentialLiterals('s.ts', "const url = 'postgresql://atlas:atlas@127.0.0.1:5432/atlas';").map((f) => f.rule),
		['dsn-with-inline-password'],
		'the stale local default DSN password must still be flagged',
	);
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const url = 'postgresql://u:CHANGE_ME@h:5432/d';"),
		[],
		'a placeholder DSN password is documentation, not a leak',
	);
	assert.deepEqual(findCredentialLiterals('s.ts', 'const url = process.env.DATABASE_URL;'), []);
});

/**
 * Rule 3, keyed on the hashing call rather than on a keyword. Every sample here is
 * invented for this test and is not any real credential.
 */
test('password-hash rule: a hashing call with a literal is flagged, placeholders and variables are not', () => {
	// The real surviving shape, with a synthetic value in place of the real one.
	assert.deepEqual(findCredentialLiterals('seed.js', "const adminHash = await bcrypt.hash('Zq7f2xK9m', 12);"), [
		{ file: 'seed.js', line: 1, rule: 'password-hash-literal', key: 'password hashing call argument' },
	]);
	// The other hashing families, and a variable argument, which is not a literal.
	for (const call of [
		"await argon2.hash('Zq7f2xK9m');",
		"await bcrypt.hashSync('Zq7f2xK9m', 10);",
		"await pbkdf2('Zq7f2xK9m', salt, 1000, 32, 'sha256');",
	]) {
		assert.deepEqual(
			findCredentialLiterals('s.ts', call).map((f) => f.rule),
			['password-hash-literal'],
			`${call} must be flagged`,
		);
	}
	assert.deepEqual(
		findCredentialLiterals('s.ts', 'const adminHash = await bcrypt.hash(adminPassword, 12);'),
		[],
		'a hashing call fed a variable is not a committed literal',
	);
	// The repository's own idiom, reading the value from the environment.
	assert.deepEqual(findCredentialLiterals('s.ts', "const adminHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD, 12);"), []);
	// A placeholder argument is documentation, not a leak.
	assert.deepEqual(findCredentialLiterals('s.ts', "const h = await bcrypt.hash('CHANGE_ME', 12);"), []);
	assert.deepEqual(findCredentialLiterals('s.ts', 'const h = await bcrypt.hash(`<password>`, 12);'), []);
});

/**
 * Rule 4, keyed on an address paired with an adjacent value. The negative controls are
 * the two real shapes that made a looser version of this rule unusable.
 */
test('markdown pairing rule: a documented login is flagged, package specifiers and object literals are not', () => {
	// The real shape, with a synthetic value in place of the real one.
	assert.deepEqual(
		findCredentialLiterals('README.md', '2. Log in as: `admin@example.edu` / `Zq7f2xK9m`'),
		[{ file: 'README.md', line: 1, rule: 'markdown-email-credential-pair', key: 'documented login' }],
	);
	assert.deepEqual(
		findCredentialLiterals('doc.md', '- Admin account: `admin@example.edu` / `Zq7f2xK9m`'),
		[{ file: 'doc.md', line: 1, rule: 'markdown-email-credential-pair', key: 'documented login' }],
	);
	// No quotes: the seed's completion banner shape.
	assert.deepEqual(
		findCredentialLiterals('doc.md', 'Log in to EnrollPro as admin@example.edu / Zq7f2xK9m').map((f) => f.rule),
		['markdown-email-credential-pair'],
	);
	// A placeholder is a placeholder.
	assert.deepEqual(findCredentialLiterals('doc.md', '- Admin: `admin@example.edu` / `your_password`'), []);
	assert.deepEqual(findCredentialLiterals('doc.md', '- Admin: `admin@example.edu` / `CHANGE_ME`'), []);

	// NEGATIVE CONTROL 1, a real site: a versioned package specifier. The alphabetic
	// TLD requirement is what keeps this out; `5.103.1` is not a TLD.
	assert.deepEqual(
		findCredentialLiterals(
			'evidence.md',
			'pinned `react-query@5.103.1` / `zod@3.24.1` so the comparison is reproducible',
		),
		[],
		'a package specifier is not a documented login',
	);

	// NEGATIVE CONTROL 2, a real site: twenty faculty stub rows in prisma/seed.js whose
	// object literals put an address and a quoted string on the same line. Only
	// separators and quotes may sit between an address and the paired value, so the
	// `, department:` text between them disqualifies the pairing.
	assert.deepEqual(
		findCredentialLiterals(
			'seed-data.js',
			"\t{ externalId: 1, firstName: 'Maria', lastName: 'Santos', email: 't-0001@deped.local', department: 'Languages', maxWeeklyHours: 30 },",
		),
		[],
		'an address followed by unrelated object fields is not a login pairing',
	);

	// Scoped to Markdown by file class, and stated rather than assumed.
	assert.deepEqual(
		findCredentialLiterals('src/seed.js', "const line = 'Log in as admin@example.edu / Zq7f2xK9m';"),
		[],
		'rule 4 is documentation-scoped by file class',
	);
});

/**
 * Rule 5, plus the two prose false positives that forced rule 2 to be keyed on an
 * assignment position instead of on a keyword appearing anywhere on the line.
 */
test('json-key rule and the assignment-position narrowing of rule 2', () => {
	// Rule 5: a quoted key the unquoted-key rule could not reach.
	for (const line of [
		'const body = JSON.stringify({ "password": "Zq7f2xK9m" });',
		"const body = JSON.stringify({ 'password': 'Zq7f2xK9m' });",
		'const body = JSON.stringify({ "api_key": "Zq7f2xK9m" });',
	]) {
		assert.deepEqual(
			findCredentialLiterals('s.ts', line).map((f) => f.rule),
			['json-credential-key'],
			`${line} must be flagged`,
		);
	}
	assert.deepEqual(findCredentialLiterals('s.ts', "const body = JSON.stringify({ 'password': 'CHANGE_ME' });"), []);

	// Rule 2 still fires on the real assignment shapes, at line start, after `const`,
	// and after `process.env.`.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "process.env.ADMIN_PASSWORD = 'Zq7f2xK9m';\nconst TOKEN = 'Qa83nd1Lp';").map(
			(f) => [f.rule, f.key, f.line],
		),
		[
			['assigned-credential-literal', 'ADMIN_PASSWORD', 1],
			['assigned-credential-literal', 'TOKEN', 2],
		],
	);
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'Zq7f2xK9m';").map((f) => f.rule),
		['assigned-credential-literal'],
	);

	// Rule 2 accepts each placeholder form, including the disposable-DB runner's class.
	for (const line of [
		"const PASSWORD = 'CHANGE_ME';",
		"const PASSWORD = '<your-password-here>';",
		"const PASSWORD = 'your_password';",
		"process.env.JWT_SECRET = 'test-gate-secret';",
	]) {
		assert.deepEqual(findCredentialLiterals('s.ts', line), [], `${line} is a placeholder`);
	}

	// A DSN assigned to a credential-named variable is judged once, by rule 1.
	assert.deepEqual(findCredentialLiterals('s.ts', "const PASSWORD = 'postgresql://u:CHANGE_ME@h:5432/d';"), []);
	assert.deepEqual(
		findCredentialLiterals('s.ts', "const PASSWORD = 'postgresql://u:Zq7f2xK9m@h:5432/d';").map((f) => f.rule),
		['dsn-with-inline-password'],
	);

	// NEGATIVE CONTROL 1, a real site: the Fetch API option. `credentials` is not a
	// credential and `include` is an enum value, so neither may be flagged.
	assert.deepEqual(
		findCredentialLiterals('useNotificationStream.ts', "method: 'GET', headers, credentials: 'include', signal,"),
		[],
	);
	assert.deepEqual(findCredentialLiterals('useNotificationStream.ts', "credentials: 'same-origin',"), []);

	// NEGATIVE CONTROL 2, a real site: a doc comment using the word "token" mid-sentence
	// followed by a colon and a quoted phrase. This is the prose that the removed
	// comment-blanking used to hide and that the assignment-position rule now excludes
	// on its own terms.
	const docComment =
		' * It deliberately does NOT de-snake-case the token: "faculty excessive idle gap"\n' +
		' * reads as a broken sentence, whereas this states the honest next step.\n';
	assert.deepEqual(
		findCredentialLiterals('plain-rule-degradation.ts', docComment),
		[],
		'prose that is not an assignment must not be flagged',
	);
});

/**
 * Comment lines are scanned. A commented-out credential is still a committed
 * credential, and this is the shape the removed line-blanking made invisible.
 */
test('comment lines are scanned: a commented-out credential is flagged', () => {
	assert.deepEqual(
		findCredentialLiterals('s.ts', "// const PASSWORD = 'Zq7f2xK9m';").map((f) => f.rule),
		['assigned-credential-literal'],
	);
	assert.deepEqual(
		findCredentialLiterals('setup.sh', "# ADMIN_TOKEN='Zq7f2xK9m'").map((f) => f.rule),
		['assigned-credential-literal'],
	);
	assert.deepEqual(
		findCredentialLiterals('s.ts', " * const API_KEY = 'Zq7f2xK9m'").map((f) => f.rule),
		['assigned-credential-literal'],
	);
	// A hashing call inside a comment is still a committed literal.
	assert.deepEqual(
		findCredentialLiterals('s.ts', "// const h = await bcrypt.hash('Zq7f2xK9m', 12);").map((f) => f.rule),
		['password-hash-literal'],
	);
	// Placeholders in comments stay accepted.
	assert.deepEqual(findCredentialLiterals('s.ts', "// const PASSWORD = 'CHANGE_ME';"), []);
	assert.deepEqual(findCredentialRelaxed('s.ts', "# set your_password before seeding"), []);
});

/** Small helper so the placeholder-in-comment control reads as prose it is. */
function findCredentialRelaxed(file: string, text: string): Finding[] {
	return findCredentialLiterals(file, text);
}

/**
 * Order independence (FIX 1d).
 *
 * The previous patterns carried `/g` at module scope, so `matchAll` inherited and
 * advanced `lastIndex` between calls. The suite passed only because an incidental
 * `lastIndex = 0` and a lucky test ordering put the full scan first; reorder the
 * tests, or add one, and the scan silently truncated. These assertions run the same
 * text repeatedly, in an interleaved order, and require identical output every time.
 */
test('scans are order-independent: repeated and interleaved scans return identical findings', () => {
	const dsnSample = "const url = 'postgresql://some_user:Zq7f2xK9m@db.internal:5432/app';";
	const assignedSample = "process.env.ADMIN_PASSWORD = 'Qa83nd1Lp';\nconst TOKEN = 'Hb3nRt6Yw';";
	const hashSample = "const adminHash = await bcrypt.hash('Vc5mKp8Xq', 12);";
	const pairSample = 'Log in as `admin@example.edu` / `Zq7f2xK9m`';

	const baseline = [
		findCredentialLiterals('a.ts', dsnSample),
		findCredentialLiterals('a.ts', assignedSample),
		findCredentialLiterals('b.js', hashSample),
		findCredentialLiterals('c.md', pairSample),
	];

	// Repeat, and interleave a different text between calls of the same pattern.
	for (let round = 0; round < 3; round += 1) {
		findCredentialLiterals('noise.ts', dsnSample);
		findCredentialLiterals('other.ts', assignedSample);
		assert.deepEqual(findCredentialLiterals('a.ts', dsnSample), baseline[0], `DSN scan drifted on round ${round}`);
		assert.deepEqual(
			findCredentialLiterals('a.ts', assignedSample),
			baseline[1],
			`assigned scan drifted on round ${round}`,
		);
		assert.deepEqual(
			findCredentialLiterals('b.js', hashSample),
			baseline[2],
			`hash scan drifted on round ${round}`,
		);
		assert.deepEqual(
			findCredentialLiterals('c.md', pairSample),
			baseline[3],
			`markdown scan drifted on round ${round}`,
		);
	}

	// And every baseline is non-empty: an order-independence test over a guard that
	// finds nothing would pass without proving anything.
	for (const [index, findings] of baseline.entries()) {
		assert.ok(findings.length > 0, `baseline ${index} must be non-empty for this control to mean anything`);
	}
});

/**
 * README.md is the two-way control on the committed tree: the documentation DSNs must
 * stay unflagged (they are placeholders, and this guard must not push authors to
 * delete real setup documentation), while the identical text with a real password
 * substituted must be flagged. Passing on README is therefore evidence of correct
 * classification, not evidence of a guard that finds nothing.
 */
test('README.md placeholder DSNs are not flagged, and the same DSNs with a real password are', () => {
	const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

	// Fixture taken from the real surface, not invented. The pattern is flag-free, so
	// `.test()` here cannot carry a `lastIndex` into any later scan.
	assert.ok(
		DSN_WITH_INLINE_PASSWORD.test(readme),
		'expected README.md to contain DSN examples for this control to be meaningful',
	);
	// The documented admin login must still be discoverable after the scrub: the fix
	// removed the password, not the instruction. This is what keeps a future edit from
	// "fixing" the finding by deleting the setup step.
	assert.ok(
		readme.includes('admin@deped.edu.ph'),
		'README.md must still document the admin login address, not delete the setup step',
	);
	assert.ok(
		readme.includes('SEED_ADMIN_PASSWORD') && readme.includes('SEED_FACULTY_PASSWORD'),
		'README.md must document the variables the ATLAS seed now requires',
	);

	assert.deepEqual(
		findCredentialLiterals('README.md', readme),
		[],
		'the committed README must carry no credential-shaped literal',
	);

	// Same document, one character class swapped: the rule must now fire, once per site.
	const withRealPassword = readme.replace(
		/postgres(?:ql)?:\/\/[^:/\s'"]+:your_password@/gi,
		'postgresql://atlas_user:Qa83nd1Lp@',
	);
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

	// And the documented-login rule, on the real README shape, with a synthetic value.
	assert.deepEqual(
		findCredentialLiterals('README.md', '2. Log in as: `admin@example.edu` / `Qa83nd1Lp`').map((f) => f.rule),
		['markdown-email-credential-pair'],
	);
});
