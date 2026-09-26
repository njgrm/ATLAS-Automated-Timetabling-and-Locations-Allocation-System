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
 *   4. `markdown-email-credential-pair`  an address paired with a password
 *   5. `json-credential-key`         a quoted credential key with a quoted value
 *   6. `env-fallback-literal`        `process.env.X || '<literal>'` / `?? '<literal>'`
 *
 * Rule 3 exists because rule 2 cannot see the real shape. The four credential
 * literals that survived the first two rounds of this guard were all
 * `bcrypt.hash('<literal>', 12)` bound to a variable named `adminHash` /
 * `facultyHash` — a keyword-on-the-line heuristic matches no part of that, and a
 * hashing call carrying a literal password is a structural signal on its own.
 *
 * Rule 6 exists for the same reason, and it is the rule that closes the class rather
 * than a site. The idiom this repository actually writes is
 * `const defaultPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? '<literal>'`,
 * and no other rule can see it: the literal belongs to the `??` operand rather than to
 * the assignment, and no hashing call takes it on that line. A live credential in the
 * login service survived three review rounds on exactly that shape, and a guard that
 * cannot express it would keep finding sites one dispatch at a time instead of the
 * class.
 *
 * Rule 4 was narrowed to Markdown by file class while its only real site was out of
 * scope. Its real shape then turned out to be in SOURCE — a seed's completion banner
 * printing `address / password` in a `.ts` file — so the file-class scoping is removed.
 * The rule's own negative controls (a versioned package specifier, and an object
 * literal putting an address and an unrelated field on one line) are structural and
 * hold in any file class, which is what the un-scoping rests on.
 *
 * Design points that are load-bearing, each paid for with a measured fact:
 *
 * - SCOPE IS PATH-BASED, never a per-line exemption list. Test directories,
 *   `*.test.*` / `*.spec.*` files and QA artifact trees are excluded by path, which is a
 *   class of location rather than a list of blessed lines. `.env.example` is IN
 *   scope: a template carrying a real password is a real password in every clone.
 *   ONE NARROWING, measured: authored Playwright spec source (`qa-artifacts/**\/*.spec.ts`)
 *   is IN scope, because a live credential survived a review cycle in exactly such a
 *   file and the `qa-artifacts/` exclusion made the whole directory invisible to this
 *   guard. The vendored Chrome profile under `atlas-client/qa-artifacts/` is refused
 *   first and by directory, so the narrowing cannot re-admit captured browser state.
 * - A LEADING UTF-8 BOM IS STRIPPED BEFORE ANY RULE RUNS. Rules 2 and 6 anchor on `^`
 *   under the `m` flag, and U+FEFF is an ordinary character, so a BOM-prefixed file
 *   defeated the anchoring and every position-anchored rule missed it. That bypass was
 *   measured, not imagined, and it is pinned by a test below.
 * - PLACEHOLDERS ARE CLASSIFIED BY SHAPE, never exempted by line. Classification is
 *   prefix-anchored (`isPlaceholder`), so `your_password` is a placeholder because of
 *   what it starts with, while an ordinary short password such as the stale local
 *   default's four-character segment matches no placeholder prefix and is still
 *   flagged. An earlier per-substring rule failed
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
 * DISCLOSED RESIDUAL GAP, pinned by a test rather than hidden: rule 6 is keyed on a
 * credential being NAMED — the environment key or the bound identifier must contain a
 * credential keyword. A fallback literal under a key that names nothing credentialic
 * (`const baseUrl = process.env.X ?? 'literal'`) is out of scope for rule 6. That is a
 * deliberate trade, not an oversight: this tree is full of legitimate
 * `process.env.ENROLLPRO_API ?? 'http://localhost:5000/api'` defaults, and keying the
 * rule on the literal's SHAPE to catch the rest flags a PostgreSQL bin directory and a
 * lifecycle phase, which is the per-line-exemption behaviour this guard exists to avoid.
 * The hashing-call rule is the backstop for the sink; the two together are asserted
 * below on the real shapes.
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

/**
 * VENDORED SUBTREES, excluded even when they sit under an INCLUDED prefix.
 *
 * `atlas-client/qa-artifacts/sections-chrome-profile/` is a committed Chrome profile:
 * roughly a thousand tracked binary-ish files whose incidental strings (cookie jars,
 * cached form values, extension manifests) would produce thousands of unrelated
 * matches and make the guard unusable. It is captured browser state, not authored
 * source, so it is excluded by DIRECTORY and checked FIRST — before the
 * authored-spec inclusion below — so a future vendored profile cannot re-enter scope
 * merely by containing a `.spec.ts` file.
 */
const EXCLUDED_QA_SUBTREES = ['qa-artifacts/sections-chrome-profile/'];

/**
 * AUTHORED Playwright spec source under a `qa-artifacts/` directory, which IS scanned.
 *
 * The `qa-artifacts/` segment exclusion above is right for evidence trees — screenshots,
 * profiles, captured HTML — but it was structurally blind to the one class of file under
 * that path that is source: the `.spec.ts` files a developer writes and runs. A live
 * credential survived a full review cycle in exactly such a file, as a
 * `process.env.X ?? '<literal>'` fallback, and no amount of dispatch would close the
 * class while the guard could not see the directory.
 *
 * So the scope is a PATH SHAPE, not a file list: any tracked `*.spec.ts` beneath a
 * `qa-artifacts/` directory is authored spec source and is scanned; everything else
 * under `qa-artifacts/` stays excluded. The shape cannot drift, because a new spec is in
 * scope the moment it is committed and an old one cannot leave scope.
 */
const QA_SPEC_SOURCE = /(^|\/)qa-artifacts\/.*\.spec\.ts$/;

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
 * Rule 4: an address paired with a password, e.g. ``admin@example.edu / `P4ssw0rd` ``.
 *
 * NOT scoped by file class. It was, and the scoping is removed: the shape occurs in
 * source, in a seeder's completion banner, and a rule that only looks at Markdown
 * cannot see a `.ts` file. Both negative controls below are structural rather than
 * file-shaped, so un-scoping changes which files are scanned, not what counts.
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

/**
 * Rule 6, keyed on the ENV FALLBACK IDIOM. Two independent patterns, because a
 * credential can be named on either side of the `=`:
 *
 *   (a) the ENVIRONMENT KEY names a credential — `process.env.ATLAS_*_PASSWORD ?? '...'`
 *   (b) the BOUND IDENTIFIER names one — `const defaultPassword = process.env.X ?? '...'`
 *
 * (b) is the pattern that sees the surviving site, where the binding is
 * `defaultPassword` and the env key happens to name a password too; either alone
 * catches it, and requiring both would miss a binding whose env key is innocuous.
 *
 * (b) REQUIRES the `||`/`??` to sit immediately after an `process.env` read. Loosening
 * it to "any operator anywhere in the assignment" produced a measured false positive on
 * a real line — `const yearToken = (available.yearLabel || 'UNLABELED').replace(...)` —
 * where `Token` names a school-year label, there is no environment read at all, and the
 * rule fired on ordinary code. The rule is about an ENVIRONMENT fallback, so the
 * environment read is part of the shape, not decoration.
 *
 * Both are keying on a NAME CLASS, never on a line list, which is what keeps the rule
 * quiet on this tree's many legitimate `process.env.ENROLLPRO_API ?? 'http://...'`
 * defaults: a base URL, a lifecycle phase, a token lifetime and a PostgreSQL bin
 * directory are not credentials and are not flagged. See the disclosed residual gap in
 * the header for what that trade does not cover.
 */
const ENV_FALLBACK_BY_ENV_KEY = new RegExp(
	'process\\.env\\.([A-Za-z0-9_]*(?:' + CREDENTIAL_KEYWORD + ')[A-Za-z0-9_]*)' +
		'[ \\t]*(?:\\|\\||\\?\\?)[ \\t]*([\'"`])([^\'"`\\n]{4,})\\2',
	'i',
);

const ENV_FALLBACK_BY_BINDING = new RegExp(
	'(?:^[ \\t]*|(?<=[;,(.=&])[ \\t]*)' +
		'(?:(?:\\/\\/|#|\\*)[ \\t]*)?' +
		'(?:export[ \\t]+)?(?:(?:const|let|var)[ \\t]+)?' +
		`([A-Za-z0-9_]*?(?:${CREDENTIAL_KEYWORD}))[ \\t]*=[ \\t]*` +
		'[A-Za-z0-9_$.()\\[\\]\'"` ]{0,60}?process\\.env\\.[A-Za-z0-9_]+' +
		'[ \\t]*(?:\\|\\||\\?\\?)[ \\t]*([\'"`])([^\'"`\\n]{4,})\\2',
	'im',
);

/**
 * A whole DSN, so a rule-4 match that is really part of one can be recognised.
 *
 * Un-scoping rule 4 from Markdown to every file exposed a false positive this guard
 * would otherwise have shipped: in `postgresql://some_user:<secret>@db.internal:5432/app`
 * the address pattern happily reads the PASSWORD as the local part and the port plus
 * database name as the paired value. The password in such a line is rule 1's business
 * and rule 1 can see it; rule 4 cannot, so a pairing inside a DSN is deferred to rule 1
 * by value class, exactly as rule 2 defers a DSN assigned to a credential-named binding.
 */
const DSN_SPAN = /postgres(?:ql)?:\/\/[^\s'";)\]]*/i;

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
/** A UTF-8 BOM decodes to U+FEFF, which is neither whitespace nor a line terminator. */
const BOM = '\uFEFF';

/**
 * Apply every rule to one file's text. Exported so the rules themselves are proven
 * load-bearing in every run, not only during the one-off anti-vacuity demonstration.
 *
 * A LEADING BOM IS STRIPPED HERE, before any rule sees the text. This is not cosmetic:
 * rules 2 and 6 anchor on `^` under the `m` flag, and a leading U+FEFF is an ordinary
 * character, so a BOM-prefixed file defeats the anchoring and every position-anchored
 * rule silently misses it. QA measured that bypass on a controlled pair — identical
 * content, only the first three bytes differing: without the BOM the rule fired, with
 * `EF BB BF` it did not. Stripping at this single entry point rather than only in the
 * file reader is deliberate: the reader is one caller, and the exported function is the
 * API every negative control and any future caller uses, so a reader-only fix would
 * leave the class open behind the public surface.
 */
export function findCredentialLiterals(file: string, text: string): Finding[] {
	const findings: Finding[] = [];
	const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	for (const match of eachMatch(source, DSN_WITH_INLINE_PASSWORD)) {
		const password = match[1];
		if (isDsnpasswordPlaceholder(password)) continue;
		findings.push({
			file,
			line: lineAt(source, match.index ?? 0),
			rule: 'dsn-with-inline-password',
			key: `DSN password for user "${dsnUserOf(match[0], password)}"`,
		});
	}

	for (const match of eachMatch(source, PASSWORD_HASH_LITERAL)) {
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(source, match.index ?? 0),
			rule: 'password-hash-literal',
			key: 'password hashing call argument',
		});
	}

	// Rule 4 is NOT file-class scoped. The real shape is a seeder's completion banner in
	// a `.ts` file, and its negative controls are structural, so a source file is scanned
	// exactly as a Markdown file is.
	//
	// A pairing that falls INSIDE a DSN is deferred to rule 1, which can see the password
	// segment. Without that, un-scoping this rule flags every DSN in the tree.
	const dsnSpans = eachMatch(source, DSN_SPAN).map(
		(match) => [match.index ?? 0, (match.index ?? 0) + match[0].length] as const,
	);
	const insideDsn = (index: number) => dsnSpans.some(([from, to]) => index >= from && index < to);

	for (const match of eachMatch(source, MARKDOWN_CREDENTIAL_PAIR)) {
		if (insideDsn(match.index ?? 0)) continue;
		if (classify(match[1], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(source, match.index ?? 0),
			rule: 'markdown-email-credential-pair',
			key: 'documented login',
		});
	}

	for (const match of eachMatch(source, JSON_CREDENTIAL_KEY)) {
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(source, match.index ?? 0),
			rule: 'json-credential-key',
			key: 'quoted credential key',
		});
	}

	for (const match of eachMatch(source, ASSIGNED_CREDENTIAL)) {
		// A DSN is judged once, by rule 1, which can see the password segment. Rule 2
		// sees only the whole string, so letting it also rule on a DSN would reject a
		// legitimate `postgresql://u:CHANGE_ME@h/db` assigned to a variable named
		// PASSWORD — a false positive of exactly the kind that gets a guard deleted.
		// Deferring on a value *class* ("is a DSN") keeps the rule structural.
		if (DSN_SHAPE.test(match[2])) continue;
		if (classify(match[2], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
		findings.push({
			file,
			line: lineAt(source, match.index ?? 0),
			rule: 'assigned-credential-literal',
			key: match[1],
		});
	}

	// Rule 6. The binding-name pattern runs first so the report names the local
	// identifier when both forms match one site; either way the two patterns overlap
	// deliberately, and the finding is deduplicated per line, because two reports of one
	// credential is one defect and a guard that over-reports trains people to ignore it.
	const envFallbackLines = new Set<number>();
	for (const pattern of [ENV_FALLBACK_BY_BINDING, ENV_FALLBACK_BY_ENV_KEY]) {
		for (const match of eachMatch(source, pattern)) {
			// Both patterns share one group layout: 1 = the credential name, 2 = the
			// quote, 3 = the value. Keeping that identical is what lets one loop report
			// either shape without a per-pattern special case.
			if (classify(match[3], ASSIGNED_PLACEHOLDER_PREFIXES)) continue;
			const line = lineAt(source, match.index ?? 0);
			if (envFallbackLines.has(line)) continue;
			envFallbackLines.add(line);
			findings.push({
				file,
				line,
				rule: 'env-fallback-literal',
				key: match[1] ?? '(environment fallback)',
			});
		}
	}

	return findings;
}

function isScannedPath(relative: string): boolean {
	// Order is load-bearing. A vendored subtree is refused first, so an inclusion rule
	// can never re-admit a captured browser profile.
	if (EXCLUDED_QA_SUBTREES.some((subtree) => relative.includes(subtree))) return false;
	if (QA_SPEC_SOURCE.test(relative)) return true;
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
		!files.some((file) => file.includes('__tests__/') || /\.(?:test)\.[cm]?[jt]sx?$/.test(file)),
		'test fixtures must be excluded by path so the guard is not noise',
	);
	// The `*.spec.*` half of the test-file exclusion is deliberately narrowed: authored
	// Playwright spec source under `qa-artifacts/` is source a developer writes and runs,
	// and a live credential survived a review cycle in exactly such a file. Only that
	// shape is re-included — asserted here so the narrowing cannot silently widen.
	assert.ok(
		files.includes('qa-artifacts/playwright/specs/teaching-load-post-qa-remediation.spec.ts'),
		'authored Playwright spec source under qa-artifacts must be in scope, and asserted rather than assumed',
	);
	assert.ok(
		files.every((file) => QA_SPEC_SOURCE.test(file) || !EXCLUDED_FILE_NAME.test(file)),
		'the only re-included test-file class is authored spec source under qa-artifacts/',
	);
	// ... and the vendored Chrome profile stays out even though it sits under the same
	// included prefix, or the guard would report thousands of incidental matches.
	assert.ok(
		!files.some((file) => file.includes('sections-chrome-profile/')),
		'the vendored Chrome profile is captured browser state, not authored source, and must stay excluded',
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
		findCredentialLiterals('s.ts', "const url = 'postgresql://atlas_user:Zq7f2xK9m@127.0.0.1:5432/atlas';").map(
			(f) => f.rule,
		),
		['dsn-with-inline-password'],
		'an ordinary non-placeholder DSN password must be flagged, including one of only four characters',
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

	// Un-scoped by file class, and stated rather than assumed: the same pairing in a
	// SOURCE file is now flagged, because the real site was a `.ts` completion banner.
	// The value here is synthetic; the real shape is asserted on the tree below.
	assert.deepEqual(
		findCredentialLiterals('src/seed.ts', "console.log('Log in as admin@example.edu / Zq7f2xK9m');").map((f) => f.rule),
		['markdown-email-credential-pair'],
		'rule 4 is not file-class scoped: a login printed by a seeder is a committed credential',
	);
});

/**
 * Rule 6, on the idiom that hid a live credential in the login service for three
 * rounds. The positive samples use synthetic values; the negative controls are REAL
 * lines from this tree, taken from the surface rather than invented, because the
 * failure mode of a widened rule is a false positive that gets it deleted.
 */
test('env-fallback rule: a credential fallback literal is flagged, real non-credential fallbacks are not', () => {
	// (a) the environment key names a credential.
	for (const line of [
		"const pw = process.env.DB_PASSWORD ?? 'Zq7f2xK9m';",
		"const pw = process.env.ATLAS_SYSTEM_TOKEN || 'Zq7f2xK9m';",
		"process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'Zq7f2xK9m';",
	]) {
		assert.ok(
			findCredentialLiterals('s.ts', line).some((f) => f.rule === 'env-fallback-literal'),
			`${line} must be flagged`,
		);
	}

	// (b) the bound identifier names a credential. This is the surviving shape.
	assert.deepEqual(
		findCredentialLiterals(
			'atlas-server/src/services/local-auth.service.ts',
			"\tconst defaultPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Zq7f2xK9m';",
		),
		[
			{
				file: 'atlas-server/src/services/local-auth.service.ts',
				line: 1,
				rule: 'env-fallback-literal',
				key: 'defaultPassword',
			},
		],
		'the binding-name form must be flagged, and reported once',
	);

	// A placeholder fallback is documentation, not a leak.
	for (const line of [
		"const pw = process.env.DB_PASSWORD ?? 'CHANGE_ME';",
		"const pw = process.env.DB_PASSWORD ?? 'your_password';",
		"const secret = process.env.APP_SECRET || '<injected-at-deploy>';",
		"const pw = process.env.DB_PASSWORD ?? '${DB_PASSWORD}';",
	]) {
		assert.deepEqual(
			findCredentialLiterals('s.ts', line).filter((f) => f.rule === 'env-fallback-literal'),
			[],
			`${line} is a placeholder`,
		);
	}

	// NEGATIVE CONTROLS, real lines from this tree. Each is a committed fallback whose
	// value is NOT a credential; keying the rule on the literal's shape instead of on a
	// credential being NAMED is exactly what would flag all of these.
	const realNonCredentialFallbacks = [
		"const baseUrl = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';",
		"const base = process.env.ENROLLPRO_API ?? 'http://localhost:5000/api';",
		"const baseUrl = (input.baseUrl ?? process.env.ENROLLPRO_API ?? 'http://localhost:5000/api').replace(/\\/$/, '');",
		'const CURRENT_PHASE = process.env.ATLAS_LIFECYCLE_PHASE ?? \'SETUP\';',
		"const PG_BIN_DIR = process.env.ATLAS_PG_BIN_DIR ?? 'D:\\\\PostgreSQL\\\\18\\\\bin';",
		"const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '8h';",
		"const identifier = process.env.ATLAS_SEEDED_OFFICER_EMAIL ?? 'officer@deped.edu.ph';",
		'const target = targetDbNameFromUrl(process.env.DATABASE_URL ?? \'\');',
	];
	for (const line of realNonCredentialFallbacks) {
		assert.deepEqual(
			findCredentialLiterals('s.ts', line).filter((f) => f.rule === 'env-fallback-literal'),
			[],
			`${line} must not be flagged: it names no credential`,
		);
	}
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
	const envFallbackSample = "const defaultPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Zd4nKp9Xw';";

	const baseline = [
		findCredentialLiterals('a.ts', dsnSample),
		findCredentialLiterals('a.ts', assignedSample),
		findCredentialLiterals('b.js', hashSample),
		findCredentialLiterals('c.md', pairSample),
		findCredentialLiterals('d.ts', envFallbackSample),
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
		assert.deepEqual(
			findCredentialLiterals('d.ts', envFallbackSample),
			baseline[4],
			`env-fallback scan drifted on round ${round}`,
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

/**
 * N3, pinned: a leading UTF-8 BOM must not defeat a position-anchored rule.
 *
 * This is a regression pin for a MEASURED bypass, not a hypothetical. QA proved it with
 * a controlled pair whose only difference was the first three bytes (`EF BB BF`): without
 * the BOM the assigned-credential rule fired, with it the rule was silently missed,
 * because the rule anchors on `^` under the `m` flag and U+FEFF is an ordinary character.
 *
 * Both the positive and the negative side are asserted. Without the BOM the rule must
 * fire (so the sample is meaningful), and with the BOM the findings must be IDENTICAL —
 * same rule, same line, same key — because stripping the BOM is what makes a
 * BOM-prefixed file indistinguishable from a plain one.
 */
test('a leading UTF-8 BOM cannot defeat a position-anchored rule', () => {
	const anchored = "const API_KEY = 'Zq7f2xK9m';";
	const plain = findCredentialLiterals('s.ts', anchored);
	assert.ok(
		plain.some((f) => f.rule === 'assigned-credential-literal'),
		'without a BOM the anchored rule must fire, or this pin proves nothing',
	);

	// The BOM case, on the two anchored rules and on an unanchored one.
	assert.deepEqual(
		findCredentialLiterals('s.ts', BOM + anchored),
		plain,
		'a BOM-prefixed file must produce exactly the findings the same file produces without one',
	);
	assert.ok(
		findCredentialLiterals('s.ts', BOM + "const pw = process.env.DB_PASSWORD ?? 'Zq7f2xK9m';").some(
			(f) => f.rule === 'env-fallback-literal' && f.line === 1,
		),
		'rule 6 is also position-anchored on its binding form and must survive a BOM',
	);

	// Only a FILE-INITIAL BOM is stripped, and that boundary is deliberate and pinned.
	// A BOM elsewhere is content, not an encoding artefact, so it is left alone — which
	// means the anchored rule still misses a credential placed on a line that starts
	// with one. Asserted so the limit is stated rather than discovered, and so nobody
	// "fixes" it by stripping every U+FEFF without noticing what that would mean.
	const midText = `const first = 1;\n${BOM}const API_KEY = 'Zq7f2xK9m';`;
	assert.deepEqual(
		findCredentialLiterals('s.ts', midText).filter((f) => f.line === 2),
		[],
		'DISCLOSED LIMIT: a non-initial BOM is content and is not stripped, so it still defeats anchoring on its own line',
	);
	// ... and the lines around it are unaffected: the file-initial BOM fix does not
	// become a general "leading whitespace" tolerance.
	assert.ok(
		findCredentialLiterals('s.ts', midText + "\nconst API_KEY = 'Zq7f2xK9m';").some(
			(f) => f.rule === 'assigned-credential-literal' && f.line === 3,
		),
		'a following line is still scanned normally',
	);
});

/**
 * B1, two-way control on the newly-in-scope authored spec source.
 *
 * The credential that this control exists for was a `process.env.X ?? '<literal>'`
 * fallback in a Playwright spec under `qa-artifacts/`, in a directory the guard
 * structurally could not see. The control asserts both halves: the real file is IN the
 * scanned set (asserted from `git ls-files`, not assumed) and is clean, and the exact
 * idiom it used is flagged when planted back into that same file. A control that only
 * checked "clean" would pass on a file that had stopped being scanned.
 */
test('authored Playwright spec source under qa-artifacts is scanned, clean, and red on the old shape', () => {
	const specPath = 'qa-artifacts/playwright/specs/teaching-load-post-qa-remediation.spec.ts';

	assert.ok(scannedFiles().includes(specPath), `${specPath} must be in the scanned set`);

	const specText = readFileSync(resolve(repoRoot, specPath), 'utf8');
	assert.deepEqual(
		findCredentialLiterals(specPath, specText),
		[],
		'the authored spec must carry no credential-shaped literal',
	);

	// The spec reads its credential from the environment and fails closed when absent,
	// so the fix removed the literal, not the login.
	assert.ok(
		specText.includes('PLAYWRIGHT_ADMIN_PASSWORD'),
		'the spec must still authenticate with the seeded officer password',
	);
	assert.ok(
		/function requireEnv\(name: string\): string/.test(specText) &&
			/password: requireEnv\('PLAYWRIGHT_ADMIN_PASSWORD'\)/.test(specText),
		'the spec must resolve the password from the environment through a fail-closed reader',
	);

	// Red when the fallback idiom returns, planted into the real file text. Synthetic
	// value only.
	const regressed = findCredentialLiterals(
		specPath,
		"const ADMIN = { password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? 'Zq7f2xK9m' };\n" + specText,
	);
	assert.ok(
		regressed.some((f) => f.rule === 'env-fallback-literal' && f.line === 1),
		're-introducing the env-fallback credential idiom in the spec must be flagged',
	);
});

/**
 * The two real sites the widened authority covers, as a two-way control on the tree.
 *
 * Green on these two files is only evidence if the same files are actually scanned AND
 * the widened rules actually reach them. So each file is read from disk, asserted clean,
 * and then given the exact shape that was removed from it — with a synthetic value, not
 * the real one — and asserted to go red. A control that only checked "clean" would pass
 * on a file that had stopped being scanned.
 */
test('the two scrubbed source files are clean, and re-inserting each shape makes them red', () => {
	const authPath = 'atlas-server/src/services/local-auth.service.ts';
	const seedPath = 'atlas-server/src/scripts/seed-realistic.ts';
	const authText = readFileSync(resolve(repoRoot, authPath), 'utf8');
	const seedText = readFileSync(resolve(repoRoot, seedPath), 'utf8');

	// Both files are inside the scanned set. Asserted, not assumed.
	const scanned = scannedFiles();
	for (const path of [authPath, seedPath]) {
		assert.ok(scanned.includes(path), `${path} must be in scope for this control to mean anything`);
	}

	// Clean now.
	assert.deepEqual(
		findCredentialLiterals(authPath, authText).filter((f) => f.rule === 'env-fallback-literal'),
		[],
		'the login service must carry no env-fallback credential literal',
	);
	assert.deepEqual(
		findCredentialLiterals(seedPath, seedText).filter((f) => f.rule === 'markdown-email-credential-pair'),
		[],
		'the seeder must not print an address paired with a password',
	);

	// The auth service must also still HASH an env-supplied value rather than a literal,
	// which is the behaviour the fix had to preserve: a hashing call fed a variable is
	// not a committed literal, and a seeding call fed a variable is not either.
	assert.ok(
		/seedLocalAuthAccounts\(\s*\{[^}]*password:\s*seededAuthPassword/s.test(seedText),
		'the seeder must pass the environment-supplied password into the auth seed',
	);
	assert.ok(
		/^\s*password:\s*string;/m.test(authText),
		'the auth seed must require an explicit password parameter, so it cannot hold a default',
	);

	// Red when the shape returns. Synthetic values only.
	const authRegressed = findCredentialLiterals(
		authPath,
		"const defaultPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Zq7f2xK9m';\n" + authText,
	);
	assert.ok(
		authRegressed.some((f) => f.rule === 'env-fallback-literal' && f.line === 1),
		're-inserting the env-fallback shape into the login service must be flagged',
	);

	const seedRegressed = findCredentialLiterals(
		seedPath,
		"console.log('  Log in as admin@example.edu / Zq7f2xK9m');\n" + seedText,
	);
	assert.ok(
		seedRegressed.some((f) => f.rule === 'markdown-email-credential-pair' && f.line === 1),
		're-printing an address with a password in the seeder must be flagged in a source file',
	);
});
