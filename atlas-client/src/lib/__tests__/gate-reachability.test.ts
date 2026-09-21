import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Gate reachability guard.
 *
 * `tsx --test` (like `node --test`) SILENTLY IGNORES a path that does not exist. A gate script that
 * names a deleted file therefore still exits 0 with a green tally from whatever files remain.
 *
 * Measured 2026-09-21: `test:ux-guardrails` named three files, two of which had been removed
 * (`ux-guardrails.test.ts`, `public-schedule-grade.test.ts`); it reported `tests 21 / pass 21 /
 * fail 0` from the single surviving file. That is a false green — `AGENTS.md` §11: "a test no gate
 * runs is not evidence".
 *
 * This test is deliberately part of the gate itself: it reads this package's `package.json`,
 * extracts every `src` TypeScript path named in every `test:` script, and fails if any of them is
 * missing. Adding it to a gate means the gate can no longer pass while part of its coverage is
 * absent.
 */

const here = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(here, '..', '..', '..', 'package.json');

test('every file named in a test:* script exists', () => {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
		scripts?: Record<string, string>;
	};
	const scripts = pkg.scripts ?? {};

	const named = new Map<string, string[]>();
	for (const [name, command] of Object.entries(scripts)) {
		if (!name.startsWith('test:')) continue;
		const paths = command.match(/src\/[\w./-]+\.tsx?/g) ?? [];
		if (paths.length > 0) named.set(name, paths);
	}

	assert.ok(named.size > 0, 'expected at least one test:* script naming a src/**/*.ts file');

	const missing: string[] = [];
	for (const [name, paths] of named) {
		for (const relative of paths) {
			if (!existsSync(join(packageJsonPath, '..', relative))) {
				missing.push(`${name} -> ${relative}`);
			}
		}
	}

	assert.deepEqual(
		missing,
		[],
		`test:* scripts name files that do not exist (a missing file is silently skipped, so the ` +
			`gate would still report green):\n  ${missing.join('\n  ')}`,
	);
});
