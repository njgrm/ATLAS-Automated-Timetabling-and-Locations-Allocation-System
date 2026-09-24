/**
 * GENERATION-AUTHORITY-REALISM-C07 — guarded disposable-PostgreSQL availability
 * freshness tier (C07-S11 partial).
 *
 * Run: `npx tsx src/__tests__/generation-authority-realism-c07-availability.test.ts`
 *
 * Skips safely when no PostgreSQL `DATABASE_URL` is configured. Never targets
 * the configured database: it provisions a NEW guarded disposable database
 * (`atlas_restore_drill_<yyyymmdd>_c07<rand>`), applies the canonical committed
 * schema ONLY inside it, proves that the availability freshness domain binds the
 * real `faculty_availabilities` + `faculty_availability_slots` rows (a persisted
 * reviewed availability edit changes the fingerprint and compares as STALE with
 * `availability` in `changedDomains`), and drops the database in `finally`.
 *
 * SCOPE NOTE (honest): this tier proves the availability DOMAIN binding on a
 * real PostgreSQL engine. It does NOT execute the full
 * `triggerGenerationRun` → `SOURCE_AUTHORITY_STALE` zero-write matrix for an
 * availability interleave; that mandatory row remains BLOCKED (see the executor
 * handoff). The existing `tt-source-freshness-generation-c04` disposable suite
 * covers the trigger write-time stale contract for the previously covered
 * domains.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { dropDisposableDatabaseWithRetry } from './helpers/drop-disposable-database.js';

const WORKDIR = process.cwd();
const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';

function readSourceDatabaseUrl(): string | null {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	for (const candidate of [`${WORKDIR}/.env`, 'D:/ATLAS/atlas-server/.env']) {
		try {
			const text = readFileSync(candidate, 'utf8');
			const line = text.split(/\r?\n/).find((entry) => entry.startsWith('DATABASE_URL='));
			if (line) return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
		} catch {
			/* try the next candidate */
		}
	}
	return null;
}

const SOURCE_URL = readSourceDatabaseUrl();
const RUNNABLE = Boolean(SOURCE_URL) && SOURCE_URL!.startsWith('postgres');

function psql(args: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, args, { env, stdio: 'pipe' }).toString().trim();
}

test('C07-S11. the availability freshness domain binds real faculty_availabilities/faculty_availability_slots rows on a disposable PostgreSQL database', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const source = new URL(SOURCE_URL!);
	const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const disposableName = `atlas_restore_drill_${stamp}_c07${randomBytes(4).toString('hex')}`;
	// Repository guard: never the configured database, never a shared target.
	assert.match(disposableName, /^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/);
	assert.notEqual(disposableName, source.pathname.replace(/^\//, ''));

	const adminEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${disposableName}`;
		return copy.toString();
	})();

	let prisma: any = null;
	let disposableCreated = false;
	try {
		try {
			psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `DROP DATABASE ${disposableName} WITH (FORCE)`], adminEnv);
		} catch { /* not present */ }
		psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `CREATE DATABASE ${disposableName}`], adminEnv);
		disposableCreated = true;

		execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
			env: { ...process.env, DATABASE_URL: targetUrl },
			cwd: WORKDIR,
			stdio: 'pipe',
			shell: true,
		});

		process.env.DATABASE_URL = targetUrl;
		const { PrismaClient } = await import('@prisma/client');
		prisma = new PrismaClient({ datasourceUrl: targetUrl });
		await prisma.$connect();

		// ── Preflight census (no secrets) ──────────────────────────────────────
		const host = source.hostname;
		const port = source.port || '5432';
		const schoolCount = await prisma.school.count();
		const countRows = async (sql: string): Promise<Array<{ count: bigint }>> => (await prisma.$queryRawUnsafe(sql)) as Array<{ count: bigint }>;
		const migrationCount = await countRows('SELECT count(*)::bigint AS count FROM _prisma_migrations');
		const [{ count: availabilityCountBefore }] = await countRows(`SELECT count(*)::bigint AS count FROM faculty_availabilities`);
		console.log(`[C07-S11] target=${disposableName} host=${host} port=${port} class=DISPOSABLE schoolCount=${schoolCount} migrationCount=${Number(migrationCount[0].count)} availabilities=${Number(availabilityCountBefore)}`);
		assert.equal(schoolCount, 0, 'the disposable database must start empty');

		const { computeGenerationInputSnapshot, compareGenerationInputSnapshots, extractGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js');

		// Base fixture first, so the availability-only edit below is isolated.
		const school = await prisma.school.create({ data: { name: 'C07 Disposable', shortName: 'C07D' } });
		const faculty = await prisma.facultyMirror.create({
			data: { externalId: 990001, schoolId: school.id, firstName: 'Disposable', lastName: 'Teacher' },
		});

		// Zero availability rows: the domain still resolves.
		const before = await computeGenerationInputSnapshot(1, 1, prisma);
		assert.equal(before.schemaVersion, 3);
		assert.ok(before.domains.availability, 'availability domain must be emitted');
		const beforeAvailability = before.domains.availability.fingerprint;
		assert.equal(before.domains.availability.signals.availabilityCount, 0);
		assert.equal(before.domains.availability.signals.availabilitySlotCount, 0);

		// ── Persist ONLY a reviewed availability authority and prove the fingerprint changes ──
		const availability = await prisma.facultyAvailability.create({
			data: { schoolId: school.id, schoolYearId: 1, facultyId: faculty.id, termIndex: 1, status: 'REVIEWED' },
		});
		await prisma.facultyAvailabilitySlot.create({
			data: { availabilityId: availability.id, day: 'MONDAY', startTime: '06:00', endTime: '06:45', state: 'UNAVAILABLE' },
		});

		const after = await computeGenerationInputSnapshot(1, 1, prisma);
		assert.equal(after.domains.availability.signals.availabilityCount, 1);
		assert.equal(after.domains.availability.signals.availabilitySlotCount, 1);
		assert.notEqual(after.domains.availability.fingerprint, beforeAvailability, 'a persisted reviewed availability edit must change the availability fingerprint');
		assert.notEqual(after.fingerprint, before.fingerprint, 'a persisted reviewed availability edit must change the overall fingerprint');

		// ── Compare: the pre-edit snapshot must fail closed as STALE ────────────
		const runSnapshot = extractGenerationInputSnapshot({ inputSnapshot: before });
		assert.ok(runSnapshot);
		const comparison = compareGenerationInputSnapshots(runSnapshot, after);
		assert.equal(comparison.status, 'STALE');
		assert.ok(comparison.changedDomains.includes('availability'), 'availability must appear in changedDomains');
		assert.equal(comparison.changedDomains.length, 1, 'only the availability domain changed');

		// Removing the availability row reverts the domain fingerprint.
		await prisma.facultyAvailabilitySlot.deleteMany({ where: { availabilityId: availability.id } });
		await prisma.facultyAvailability.deleteMany({ where: { id: availability.id } });
		const reverted = await computeGenerationInputSnapshot(1, 1, prisma);
		assert.equal(reverted.domains.availability.signals.availabilitySlotCount, 0);
		assert.equal(reverted.domains.availability.fingerprint, beforeAvailability, 'removing the persisted row restores the pre-edit availability fingerprint');
	} finally {
		if (prisma) {
			try { await prisma.$disconnect(); } catch { /* ignore */ }
		}
		if (disposableCreated) {
			await dropDisposableDatabaseWithRetry({ source, adminEnv, name: disposableName });
			const residue = psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', 'postgres', '-tAc', `SELECT count(*) FROM pg_database WHERE datname = '${disposableName}'`], adminEnv);
			assert.equal(residue, '0', 'the disposable database must leave zero residue');
		}
	}
});
