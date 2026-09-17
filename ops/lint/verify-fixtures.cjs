/**
 * CLIENT-QUALITY-C01 S2/S3 verifier.
 *
 * Runs the scoped ESLint toolchain against the deliberately-broken negative
 * controls and asserts each one exits NONZERO with the expected rule id. This
 * script itself exits 0 only when every fixture is correctly rejected, so
 * `npm run test:lint-fixtures` is a real regression that fails if the rules stop
 * firing (for example if a rule is downgraded or the parser is misconfigured).
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const eslintBin = path.join(__dirname, 'toolchain', 'node_modules', 'eslint', 'bin', 'eslint.js');
const configPath = path.join(__dirname, 'fixtures', 'eslint.config.cjs');

const CASES = [
	{
		file: path.join(__dirname, 'fixtures', 'hook-after-early-return.tsx'),
		rule: 'react-hooks/rules-of-hooks',
		label: 'S2 hook-after-early-return',
	},
	{
		file: path.join(__dirname, 'fixtures', 'new-explicit-any.tsx'),
		rule: '@typescript-eslint/no-explicit-any',
		label: 'S3 new-explicit-any',
	},
];

let failed = 0;
for (const testCase of CASES) {
	const result = spawnSync(
		process.execPath,
		[eslintBin, '--no-config-lookup', '--config', configPath, '--format', 'json', testCase.file],
		{ encoding: 'utf8' },
	);
	let ruleIds = [];
	try {
		const parsed = JSON.parse(result.stdout || '[]');
		ruleIds = parsed.flatMap((entry) => (entry.messages || []).map((message) => message.ruleId));
	} catch {
		ruleIds = [];
	}
	const rejected = result.status !== 0;
	const ruleFired = ruleIds.includes(testCase.rule);
	const ok = rejected && ruleFired;
	console.log(
		`${ok ? 'PASS' : 'FAIL'} ${testCase.label}: eslint exit=${result.status} ruleFired=${ruleFired} rules=[${[...new Set(ruleIds)].join(', ')}]`,
	);
	if (!ok) failed += 1;
}

if (failed > 0) {
	console.error(`FIXTURE VERIFICATION FAILED: ${failed} of ${CASES.length}`);
	process.exit(1);
}
console.log(`FIXTURE VERIFICATION PASSED: ${CASES.length}/${CASES.length} fixtures rejected with the expected rule`);
