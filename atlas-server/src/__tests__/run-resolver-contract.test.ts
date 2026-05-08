import { prisma } from '../lib/prisma.js';
import { resolveActiveDraftRun } from '../services/active-draft-run-resolver.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
		return;
	}
	failCount += 1;
	console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
}

async function run() {
	const faculty = await prisma.facultyMirror.findFirst({
		where: { isActiveForScheduling: true, isStale: false },
		orderBy: { id: 'asc' },
		select: { id: true, schoolId: true },
	});
	const actor = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'officer', isActive: true },
		orderBy: { id: 'asc' },
		select: { id: true },
	});

	if (!faculty || !actor) {
		console.error('\nMissing seeded data for run resolver contract test.');
		process.exitCode = 1;
		return;
	}

	const schoolId = faculty.schoolId;
	const schoolYearId = 1;
	const createdRunIds: number[] = [];
	const now = Date.now();

	try {
		section('RUN-RESOLVER-01 latest draft run wins over older history');
		const olderRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actor.id,
				startedAt: new Date(now - 120000),
				finishedAt: new Date(now - 110000),
				durationMs: 1000,
				summary: {},
				violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
				draftEntries: [
					{
						entryId: `legacy-${Date.now()}`,
						subjectId: 1,
						sectionId: 1,
						facultyId: faculty.id,
						roomId: 1,
						day: 'MONDAY',
						startTime: '07:00',
						endTime: '08:00',
						durationMinutes: 60,
					},
				],
				unassignedItems: [],
			},
		});
		createdRunIds.push(olderRun.id);

		const latestRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actor.id,
				startedAt: new Date(now - 60000),
				finishedAt: new Date(now - 50000),
				durationMs: 1000,
				summary: {},
				violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
				draftEntries: [
					{
						entryId: `latest-${Date.now()}`,
						subjectId: 1,
						sectionId: 1,
						facultyId: faculty.id,
						roomId: 1,
						day: 'MONDAY',
						startTime: '08:00',
						endTime: '09:00',
						durationMinutes: 60,
					},
				],
				unassignedItems: [],
			},
		});
		createdRunIds.push(latestRun.id);

		const resolved = await resolveActiveDraftRun(schoolId, schoolYearId);
		assertEqual(resolved.id, latestRun.id, 'Resolver returns the latest draft run ID');

		section('RUN-RESOLVER-02 does not fall back when latest run is stale');
		const staleLatestRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: actor.id,
				startedAt: new Date(now - 20000),
				finishedAt: new Date(now - 15000),
				durationMs: 1000,
				summary: {},
				violations: { runId: 0, status: 'COMPLETED', violations: [], counts: { total: 0, byCode: {} } },
				draftEntries: [
					{
						entryId: `stale-${Date.now()}`,
						subjectId: 1,
						sectionId: 1,
						facultyId: 99999999,
						roomId: 1,
						day: 'MONDAY',
						startTime: '10:00',
						endTime: '11:00',
						durationMinutes: 60,
					},
				],
				unassignedItems: [],
			},
		});
		createdRunIds.push(staleLatestRun.id);

		let staleError: { code?: string; details?: { latestRunId?: number } } | null = null;
		try {
			await resolveActiveDraftRun(schoolId, schoolYearId);
		} catch (error) {
			staleError = error as { code?: string; details?: { latestRunId?: number } };
		}
		assert(Boolean(staleError), 'Resolver throws when latest run is stale');
		assertEqual(staleError?.code, 'STALE_RUN_DATA', 'Resolver returns STALE_RUN_DATA code');
		assertEqual(staleError?.details?.latestRunId, staleLatestRun.id, 'Resolver reports stale latest run ID');
	} finally {
		if (createdRunIds.length > 0) {
			await prisma.generationRun.deleteMany({ where: { id: { in: createdRunIds } } });
		}
		await prisma.$disconnect();
	}

	console.log(`\nSummary: ${passCount} passed, ${failCount} failed`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((error) => {
	console.error('\nUnhandled run resolver contract test error:', error);
	process.exit(1);
});
