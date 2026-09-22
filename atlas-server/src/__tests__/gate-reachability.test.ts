import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Server gate reachability guard (TEST-GATE-COVERAGE-C01, D4).
 *
 * Inverse of the scripts-to-files direction: every test file under `src/`
 * must be named by at least one `test:*` script in `atlas-server/package.json`. A test
 * no gate runs is not evidence (`AGENTS.md` §11) — without this guard an
 * orphaned suite rots silently, exactly as
 * `derived-demand-correction-c01r.test.ts` (controls 5, 7, 10) did when
 * `computeGenerationInputSnapshot` grew `.aggregate` calls its hand-built
 * prisma mock lacked.
 *
 * Mirrors `atlas-client/src/lib/__tests__/gate-reachability.test.ts`
 * (second `test(...)`). This file is itself named in the committed
 * `test:server-suite` script, so the guard is itself gated.
 */

const here = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(here, '..', '..', 'package.json');

test('every server test file is named by at least one test:* script', () => {
	const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
		scripts?: Record<string, string>;
	};
	const scripts = pkg.scripts ?? {};

	const named = new Set<string>();
	for (const [name, command] of Object.entries(scripts)) {
		if (!name.startsWith('test:')) continue;
		const paths = command.match(/src\/[\w./-]+\.tsx?/g) ?? [];
		for (const relative of paths) named.add(relative);
	}

	assert.ok(named.size > 0, 'expected at least one test:* script naming a src/**/*.ts file');

	const serverRoot = dirname(packageJsonPath);
	const srcRoot = join(serverRoot, 'src');
	const onDisk: string[] = [];
	const walk = (dir: string): void => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const absolute = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(absolute);
			} else if (/\.test\.tsx?$/.test(entry.name)) {
				onDisk.push(absolute.slice(serverRoot.length + 1).replace(/\\/g, '/'));
			}
		}
	};
	walk(srcRoot);
	onDisk.sort();

	assert.ok(onDisk.length > 0, 'expected at least one src/**/*.test.ts file on disk');

	const unreachable = onDisk.filter((relative) => !named.has(relative));

	assert.deepEqual(
		unreachable,
		[],
		`server test files exist that no test:* script runs (a test no gate runs is not evidence — ` +
			`add them to a gate):\n  ${unreachable.join('\n  ')}`,
	);
});
