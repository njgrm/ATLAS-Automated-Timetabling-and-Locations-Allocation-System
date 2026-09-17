/**
 * CLIENT-QUALITY-C01 — flat ESLint configuration (repo root).
 *
 * `vite build` does not type-check and there was no ESLint in this repository,
 * so the two defects that reached the deployed release (`/timetable` React #310
 * from a hook declared after an early return, and an `any`-typed nullable
 * workload profile) had no static gate objecting. This config adds:
 *
 *   - react-hooks/rules-of-hooks = error  (catches #310)
 *   - react-hooks/exhaustive-deps  = warn
 *   - @typescript-eslint/no-explicit-any = error, bounded by a checked-in
 *     per-file ratchet baseline so existing offenders are grandfathered while
 *     new `any` cannot be added.
 *
 * Scope: the client source (`atlas-client/src`). Server lint adoption is a
 * separate scope decision and intentionally not implied here.
 *
 * Toolchain: the scoped, reproducible toolchain lives in
 * `ops/lint/toolchain/` (its own package.json + committed package-lock.json).
 * The plugins are required from that directory explicitly so the config resolves
 * from a clean checkout after only the scoped install, without depending on the
 * application `node_modules` (which is frequently a shared junction into another
 * worktree and must never be written through).
 */
const path = require('node:path');
const { createRequire } = require('node:module');

// Resolve the toolchain plugins from inside `ops/lint/toolchain/` so bare
// specifiers use that package's dependency tree (not the application
// node_modules junction). `typescript-eslint` ships `exports`-only, so a direct
// relative directory require would not resolve.
const toolchainRequire = createRequire(path.join(__dirname, 'ops', 'lint', 'toolchain', 'package.json'));
const tseslint = toolchainRequire('typescript-eslint');
const reactHooks = toolchainRequire('eslint-plugin-react-hooks');

const ratchetBaseline = require('./ops/lint/no-explicit-any-ratchet.json');
const rulesOfHooksBaseline = require('./ops/lint/rules-of-hooks-baseline.json');
const noExplicitAnyRatchet = require('./ops/lint/eslint-rules/no-explicit-any-ratchet.cjs');

const LINT_TARGET = ['atlas-client/src/**/*.{ts,tsx}'];
module.exports = tseslint.config(
	{
		ignores: [
			'**/dist/**',
			'**/node_modules/**',
			'**/test-results/**',
			'qa-artifacts/**',
			'ops/**',
			'prisma/**',
		],
	},
	{
		files: LINT_TARGET,
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'react-hooks': reactHooks,
		},
		rules: {
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',
			'@typescript-eslint/no-explicit-any': 'error',
		},
	},
	{
		// react-hooks/rules-of-hooks baseline: test-only manual renderers whose
		// hook call site cannot be expressed as a component/custom hook. The rule
		// stays `error` everywhere else; rationale lives in
		// ops/lint/rules-of-hooks-baseline.json.
		files: Object.keys(rulesOfHooksBaseline.files),
		rules: {
			'react-hooks/rules-of-hooks': 'off',
		},
	},
	{
		// Ratchet baseline: the checked-in offenders keep their recorded count for
		// now; the total may only decrease. Any occurrence above the recorded
		// count is an error, so a new `any` cannot be absorbed here either.
		files: Object.keys(ratchetBaseline.files),
		plugins: {
			'atlas-ratchet': {
				rules: { 'no-explicit-any-ratchet': noExplicitAnyRatchet },
			},
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'atlas-ratchet/no-explicit-any-ratchet': 'error',
		},
	},
);
