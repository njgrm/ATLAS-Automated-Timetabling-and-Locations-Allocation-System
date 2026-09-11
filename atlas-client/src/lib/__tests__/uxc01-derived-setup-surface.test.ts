/**
 * UX-C01 — retired annual-requirements surface guards (hermetic).
 *
 * Failing-first scans over the real client source proving no normal route,
 * link, or API dispatch reaches the retired Curriculum Requirements / Decision
 * Workspace surfaces, and that the legacy deep links are non-mutating
 * replace-redirects into the Subjects setup view.
 *
 * Run: `npx tsx --test src/lib/__tests__/uxc01-derived-setup-surface.test.ts`
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SRC_ROOT = fileURLToPath(new URL('../../', import.meta.url));

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry === '__tests__' || entry === 'node_modules') continue;
		const full = join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			files.push(...collectSourceFiles(full));
			continue;
		}
		if (entry.endsWith('.ts') || entry.endsWith('.tsx')) files.push(full);
	}
	return files;
}

const SOURCE_FILES = collectSourceFiles(SRC_ROOT);

test('UX-C01: no non-test client source links or navigates to the retired requirements routes', () => {
	const offenders: string[] = [];
	for (const file of SOURCE_FILES) {
		const source = readFileSync(file, 'utf8');
		if (/to=\{?["'`]\/subjects\/requirements/.test(source)) offenders.push(`${file} -> /subjects/requirements link`);
		if (/to=\{?["'`]\/subjects\/decision-workspace/.test(source)) offenders.push(`${file} -> /subjects/decision-workspace link`);
	}
	assert.deepEqual(offenders, [], `retired requirement links must not exist: ${offenders.join(', ')}`);
});

test('UX-C01: no non-test client source dispatches the retired curriculum-requirements API', () => {
	const offenders: string[] = [];
	for (const file of SOURCE_FILES) {
		const source = readFileSync(file, 'utf8');
		if (/["'`]\/curriculum-requirements/.test(source)) offenders.push(file);
	}
	assert.deepEqual(offenders, [], `retired requirements API dispatches must not exist: ${offenders.join(', ')}`);
});

test('UX-C01: the app mounts legacy deep links as non-mutating replace-redirects to Subjects', () => {
	const appPath = join(SRC_ROOT, 'App.tsx');
	const source = readFileSync(appPath, 'utf8');
	assert.match(source, /path: 'subjects\/requirements'/);
	assert.match(source, /path: 'subjects\/decision-workspace'/);
	assert.equal((source.match(/<RetiredRequirementsRedirect \/>/g) ?? []).length, 2);
	assert.match(source, /to='\/subjects\?context=derived-setup'/);
	// The retired page components are no longer imported or mounted.
	assert.doesNotMatch(source, /CurriculumRequirements/);
	assert.doesNotMatch(source, /DecisionWorkspace/);
});

test('UX-C01: the setup navigation advertises Subjects, never a retired requirements entry', () => {
	const navPath = join(SRC_ROOT, 'components', 'app-shell', 'navigation.ts');
	const source = readFileSync(navPath, 'utf8');
	assert.doesNotMatch(source, /requirements/i);
	assert.match(source, /to: '\/subjects'/);
});
