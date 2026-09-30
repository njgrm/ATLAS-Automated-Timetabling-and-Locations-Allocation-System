import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNotProtectedDatabaseUnderTest } from '../lib/prisma.js';

const live = 'postgresql://u:p@localhost:5432/atlas_recovery_clean_rebuild_20260905';
const staging = 'postgresql://u:p@localhost:5432/atlas_staging';

test('refuses the live database under the test runner', () => {
	assert.throws(() => assertNotProtectedDatabaseUnderTest(live, { NODE_TEST_CONTEXT: 'child' }, []), /TESTS_NEVER_TOUCH_LIVE/);
	assert.throws(() => assertNotProtectedDatabaseUnderTest(live, {}, ['--test']), /TESTS_NEVER_TOUCH_LIVE/);
});

test('allows non-protected databases under the test runner', () => {
	assert.doesNotThrow(() => assertNotProtectedDatabaseUnderTest(staging, { NODE_TEST_CONTEXT: 'child' }, []));
});

test('allows the live database outside the test runner (the server itself)', () => {
	assert.doesNotThrow(() => assertNotProtectedDatabaseUnderTest(live, {}, ['dist/server.js']));
});

test('extra protected names come from ATLAS_PROTECTED_DATABASES', () => {
	assert.throws(
		() => assertNotProtectedDatabaseUnderTest(staging, { NODE_TEST_CONTEXT: 'child', ATLAS_PROTECTED_DATABASES: 'x, atlas_staging' }, []),
		/TESTS_NEVER_TOUCH_LIVE/,
	);
});

test('this very process is under the test runner, so the guard is live here', () => {
	assert.ok(Boolean(process.env.NODE_TEST_CONTEXT) || [...process.execArgv, ...process.argv].includes('--test'));
});
