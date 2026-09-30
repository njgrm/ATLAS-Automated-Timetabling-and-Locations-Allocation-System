import { PrismaClient } from '@prisma/client';

// Startup diagnostic: verify DATABASE_URL protocol is correct
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
	console.error('[prisma] ❌ DATABASE_URL is not set. Prisma queries will fail.');
} else if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
	console.error(`[prisma] ❌ DATABASE_URL has unexpected protocol: ${dbUrl.substring(0, 30)}...`);
} else {
	console.log('[prisma] ✔ DATABASE_URL protocol looks correct');
}

/**
 * Tests never touch live (2026-09-30). A rollover test once wrote 5 `schools` rows into the live database because
 * it inherited the live DATABASE_URL. Under the Node test runner, refuse to create a client for a protected database.
 * Extra names: ATLAS_PROTECTED_DATABASES (comma-separated).
 */
export const PROTECTED_DATABASES = ['atlas_recovery_clean_rebuild_20260905'];

export function assertNotProtectedDatabaseUnderTest(
	url: string | undefined,
	env: NodeJS.ProcessEnv = process.env,
	argv: readonly string[] = [...process.execArgv, ...process.argv],
): void {
	const underTest = Boolean(env.NODE_TEST_CONTEXT) || argv.includes('--test');
	if (!underTest || !url) return;
	let name = '';
	try {
		name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
	} catch {
		return;
	}
	const extra = (env.ATLAS_PROTECTED_DATABASES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	if ([...PROTECTED_DATABASES, ...extra].includes(name)) {
		throw new Error(`TESTS_NEVER_TOUCH_LIVE: DATABASE_URL names the protected database "${name}" under the test runner. Point tests at a disposable database.`);
	}
}

assertNotProtectedDatabaseUnderTest(dbUrl);

// Singleton Prisma client for production use
export const prisma = new PrismaClient();

/**
 * Create a new Prisma client for testing with extensions.
 * This allows tests to instrument the client without affecting the global singleton.
 */
export function createTestPrismaClient(): PrismaClient {
	return new PrismaClient({
		datasourceUrl: dbUrl,
	});
}
