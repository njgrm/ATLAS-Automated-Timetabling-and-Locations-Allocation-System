/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — disposable PostgreSQL proof for the
 * append-only teacher-program presentation revision store.
 *
 * Provisions a NEW guarded disposable database (never the configured
 * development/live-like database) and applies the canonical migrations —
 * including `0003_teacher_program_presentation` — only inside it. Proves:
 *  - the migration source applies cleanly (the revision table exists);
 *  - a committed save appends exactly one revision + one audit row;
 *  - a no-change replay appends nothing;
 *  - concurrent saves at the same expected revision never lose an update:
 *    exactly one succeeds and the other fails closed with
 *    `PRESENTATION_PROFILE_STALE`;
 *  - a passive read is zero-write;
 *  - a non-active school year is rejected before any write;
 *  - every fixture row is removed and the database is dropped (zero residue).
 *
 * Run: `npx tsx src/__tests__/export-presentation-postgres.test.ts`
 * Skips safely when no PostgreSQL DATABASE_URL is configured.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { isDisposableHarnessAvailable, provisionDisposableDatabase } from './helpers/tt-source-freshness-db.js';

const RUNNABLE = isDisposableHarnessAvailable();

test('the presentation revision store is append-only, audited, CAS-safe and zero-residue on a disposable database', { skip: RUNNABLE ? false : 'DATABASE_URL is not configured' }, async () => {
	const disposable = provisionDisposableDatabase('c05r1');
	assert.ok(disposable, 'a disposable database must be provisioned');

	let prisma: any = null;
	let schoolId = 0;

	try {
		process.env.DATABASE_URL = disposable!.targetUrl;
		const prismaModule: any = await import('../lib/prisma.js');
		prisma = prismaModule.prisma;
		const serviceModule: any = await import('../services/export-presentation.service.js');
		const {
			PresentationProfileError,
			readEffectiveSignatoryProfile,
			saveSignatoryProfile,
		} = serviceModule;

		// ── Fixture: one disposable school with a single active year mirror ──
		const school = await prisma.school.create({
			data: { name: 'C05R1-DISPOSABLE — SAFE TO DELETE', shortName: 'C05R1' },
			select: { id: true },
		});
		schoolId = school.id;
		const schoolYearId = 9_300_001;
		await prisma.enrollProSchoolYearMirror.create({
			data: { schoolId, enrollProSchoolYearId: schoolYearId, yearLabel: '2026-2027', isActive: true, isArchived: false, syncStatus: 'synced' },
		});

		// The migration source applied: the revision delegate resolves.
		const table = await prisma.$queryRawUnsafe("SELECT to_regclass('public.teacher_program_presentation_revisions')::text AS name") as Array<{ name: string | null }>;
		assert.equal(table[0]?.name, 'teacher_program_presentation_revisions', 'migration 0003 created the revision table on the disposable database');

		// ── Committed save: one revision + one audit ──
		const first = await saveSignatoryProfile({
			schoolId, schoolYearId, actorId: 46, expectedRevision: 0,
			input: { schoolHeadName: 'JUDY ANN B. NONATO', psdsName: 'EMILIA L. ENGLIS', cidChiefName: 'ARCH. NELSON G. BEDAURE, PhD', asdsName: 'JULITO L. FELICANO, CESE', footerText: 'For every learner, we rise!' },
		});
		assert.equal(first.revision, 1);
		assert.equal(first.replayed, false);
		assert.equal(await prisma.teacherProgramPresentationRevision.count({ where: { schoolId, schoolYearId } }), 1);
		assert.equal(await prisma.auditLog.count({ where: { schoolId, action: 'TEACHER_PROGRAM_PRESENTATION_UPDATED' } }), 1);

		// ── Passive read: zero writes ──
		const before = {
			revisions: await prisma.teacherProgramPresentationRevision.count({ where: { schoolId, schoolYearId } }),
			audits: await prisma.auditLog.count({ where: { schoolId } }),
		};
		const profile = await readEffectiveSignatoryProfile({ schoolId, schoolYearId });
		assert.equal(profile.revision, 1);
		assert.equal(profile.schoolHead.name, 'JUDY ANN B. NONATO');
		assert.equal(await prisma.teacherProgramPresentationRevision.count({ where: { schoolId, schoolYearId } }), before.revisions, 'a passive read writes zero revisions');
		assert.equal(await prisma.auditLog.count({ where: { schoolId } }), before.audits, 'a passive read writes zero audits');

		// ── No-change replay: zero additional rows ──
		const replay = await saveSignatoryProfile({
			schoolId, schoolYearId, actorId: 46, expectedRevision: 1,
			input: { schoolHeadName: 'JUDY ANN B. NONATO', psdsName: 'EMILIA L. ENGLIS', cidChiefName: 'ARCH. NELSON G. BEDAURE, PhD', asdsName: 'JULITO L. FELICANO, CESE', footerText: 'For every learner, we rise!' },
		});
		assert.equal(replay.replayed, true);
		assert.equal(replay.revision, 1);
		assert.equal(await prisma.teacherProgramPresentationRevision.count({ where: { schoolId, schoolYearId } }), 1, 'a no-change replay appends no revision');
		assert.equal(await prisma.auditLog.count({ where: { schoolId, action: 'TEACHER_PROGRAM_PRESENTATION_UPDATED' } }), 1, 'a no-change replay appends no audit');

		// ── Concurrent CAS: exactly one winner, no lost update ──
		const pair = await Promise.allSettled([
			saveSignatoryProfile({ schoolId, schoolYearId, actorId: 46, expectedRevision: 1, input: { schoolHeadName: 'CONCURRENT A' } }),
			saveSignatoryProfile({ schoolId, schoolYearId, actorId: 46, expectedRevision: 1, input: { schoolHeadName: 'CONCURRENT B' } }),
		]);
		const fulfilled = pair.filter((result) => result.status === 'fulfilled');
		const rejected = pair.filter((result) => result.status === 'rejected');
		assert.equal(fulfilled.length, 1, 'exactly one concurrent save at the same revision commits');
		assert.equal(rejected.length, 1, 'the other concurrent save fails closed');
		const rejection = (rejected[0] as PromiseRejectedResult).reason;
		assert.ok(rejection instanceof PresentationProfileError, 'the rejection is the typed presentation error');
		assert.equal((rejection as InstanceType<any>).code, 'PRESENTATION_PROFILE_STALE');
		const revisionsAfterRace = await prisma.teacherProgramPresentationRevision.count({ where: { schoolId, schoolYearId } });
		assert.equal(revisionsAfterRace, 2, 'the race appended exactly one new revision (revision 2)');
		const auditsAfterRace = await prisma.auditLog.count({ where: { schoolId, action: 'TEACHER_PROGRAM_PRESENTATION_UPDATED' } });
		assert.equal(auditsAfterRace, 2, 'only the committed race winner added an audit row');

		// ── Non-active year: fail closed before any write ──
		await assert.rejects(
			() => saveSignatoryProfile({ schoolId, schoolYearId: schoolYearId + 1, actorId: 46, expectedRevision: 0, input: { schoolHeadName: 'NOPE' } }),
			(error: unknown) => error instanceof PresentationProfileError && (error as { code?: string }).code === 'SCHOOL_YEAR_NOT_ACTIVE',
		);
		assert.equal(await prisma.teacherProgramPresentationRevision.count({ where: { schoolId } }), 2, 'a rejected write appends nothing');
	} finally {
		if (prisma) {
			await prisma.teacherProgramPresentationRevision.deleteMany({ where: { schoolId } }).catch(() => undefined);
			await prisma.auditLog.deleteMany({ where: { schoolId } }).catch(() => undefined);
			await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
			await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => undefined);
			await prisma.$disconnect().catch(() => undefined);
		}
		disposable!.drop();
		disposable!.assertDropped();
	}
});
