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
 * Toolchain: `eslint`, `typescript-eslint`, and `eslint-plugin-react-hooks` are
 * installed into the executor worktree with `--no-save --no-package-lock`; the
 * reviewed release wiring must pin them in devDependencies before this gate
 * runs in CI.
 */
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');

const ratchetBaseline = require('./ops/lint/no-explicit-any-ratchet.json');
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
