import { prisma } from '../lib/prisma.js';
import { previewRolloverSync, resetDummyYearAndApplyRollover } from '../services/enrollpro-rollover.service.js';
import { triggerGenerationRun } from '../services/generation.service.js';
import { autoFill } from '../services/teaching-load-automation.service.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n════ ${name} ════`);
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
	assert(actual === expected, `${label} — expected ${String(expected)}, got ${String(actual)}`);
}

function assertGreaterThanOrEqual(actual: number, expected: number, label: string) {
	assert(actual >= expected, `${label} — expected >= ${expected}, got ${actual}`);
}

async function countReadinessRows(schoolId: number, schoolYearId: number) {
	const [
		sectionMirrors,
		facultyMirrors,
		generationRuns,
		schedulingPolicies,
		facultySubjects,
		ownerships,
		auditLogs,
		mirrors,
	] = await Promise.all([
		prisma.sectionMirror.count({ where: { schoolId, schoolYearId } }),
		prisma.facultyMirror.count({ where: { schoolId, isActiveForScheduling: true, isStale: false } }),
		prisma.generationRun.count({ where: { schoolId, schoolYearId } }),
		prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId } }),
		prisma.facultySubject.count({ where: { schoolId } }),
		prisma.subjectSectionOwnership.count({ where: { schoolId } }),
		prisma.auditLog.count({ where: { schoolId, schoolYearId } }),
		prisma.enrollProSchoolYearMirror.count({ where: { schoolId, enrollProSchoolYearId: schoolYearId } }),
	]);

	return {
		sectionMirrors,
		facultyMirrors,
		generationRuns,
		schedulingPolicies,
		facultySubjects,
		ownerships,
		auditLogs,
		mirrors,
	};
}

async function expectErrorCode(action: () => Promise<unknown>, expectedCode: string, label: string) {
	try {
		await action();
		assert(false, `${label} — expected ${expectedCode}, got success`);
	} catch (error) {
		const code = (error as { code?: string }).code;
		assertEqual(code, expectedCode, label);
	}
}

async function run() {
	const schoolId = 1;
	const activeSchoolYearId = 1;
	const staleSchoolYearId = 39;
	const officer = await prisma.atlasAuthAccount.findFirst({
		where: { schoolId, role: { in: ['admin', 'officer', 'SYSTEM_ADMIN'] }, isActive: true },
		orderBy: { id: 'asc' },
		select: { id: true },
	});
	const actorId = officer?.id ?? 0;

	section('Rollover preview contract');
	const beforePreview = await countReadinessRows(schoolId, activeSchoolYearId);
	const preview = await previewRolloverSync(schoolId);
	const afterPreview = await countReadinessRows(schoolId, activeSchoolYearId);
	assertEqual(preview.enrollProActiveYear?.id, activeSchoolYearId, 'EnrollPro active year is canonical schoolYearId=1');
	assertEqual(preview.enrollProActiveYear?.yearLabel, '2026-2027', 'EnrollPro active year label is 2026-2027');
	assertEqual(preview.drift.status, 'aligned', 'Rollover drift is aligned after dummy reset');
	assertEqual(preview.counts?.sectionCount, 20, 'EnrollPro section feed exposes 20 sections');
	assertEqual(preview.counts?.facultyCount, 24, 'EnrollPro faculty feed exposes 24 faculty');
	assertEqual(JSON.stringify(afterPreview), JSON.stringify(beforePreview), 'Rollover preview performs no local writes');

	section('Current-year mirror and empty Teaching Load contract');
	assertEqual(beforePreview.sectionMirrors, 20, 'ATLAS mirrors 20 current-year sections');
	assertGreaterThanOrEqual(beforePreview.facultyMirrors, 24, 'ATLAS has at least the 24 active EnrollPro faculty candidates');
	assertGreaterThanOrEqual(beforePreview.schedulingPolicies, 1, 'ATLAS has a current-year scheduling policy baseline');
	assertEqual(beforePreview.generationRuns, 0, 'ATLAS starts the active year without current-year generation runs');
	assertEqual(beforePreview.facultySubjects, 0, 'Teaching Load faculty-subject ownership starts empty');
	assertEqual(beforePreview.ownerships, 0, 'Teaching Load section ownership starts empty');

	section('Reset and generation guards');
	await expectErrorCode(
		() => resetDummyYearAndApplyRollover({
			schoolId,
			actorId,
			confirmReset: true,
			confirmationText: 'WRONG_CONFIRMATION',
		}),
		'CONFIRMATION_REQUIRED',
		'Dummy reset apply requires the exact confirmation phrase',
	);
	await expectErrorCode(
		() => triggerGenerationRun(schoolId, staleSchoolYearId, actorId),
		'ACTIVE_YEAR_DRIFT',
		'Stale-year generation is blocked by EnrollPro active-year drift',
	);
	await expectErrorCode(
		() => triggerGenerationRun(schoolId, activeSchoolYearId, actorId),
		'TEACHING_LOAD_REVIEW_REQUIRED',
		'Current-year generation is blocked until Teaching Load is reviewed',
	);

	section('Reversible setup-to-generation fixture');
	const beforeFixture = await countReadinessRows(schoolId, activeSchoolYearId);
	const createdRunIds: number[] = [];
	try {
		const fill = await autoFill(schoolId, activeSchoolYearId, undefined, {
			previewOnly: false,
			coverageMode: 'REAL_FACULTY_HARD_CAP',
		});
		const afterFill = await countReadinessRows(schoolId, activeSchoolYearId);
		assertGreaterThanOrEqual(fill.assignmentsCreated, 1, 'Teaching Load fixture creates normalized assignment rows');
		assertGreaterThanOrEqual(afterFill.ownerships, 1, 'Teaching Load fixture writes normalized section ownership');

		const run = await triggerGenerationRun(schoolId, activeSchoolYearId, actorId, {
			roomerStrategy: 'HOME_ROOM_FIRST',
		});
		createdRunIds.push(run.id);
		const persistedRun = await prisma.generationRun.findUnique({
			where: { id: run.id },
			select: { status: true, draftEntries: true },
		});
		assertEqual(persistedRun?.status, 'COMPLETED', 'Current-year generation succeeds after normalized Teaching Load fixture');
		assertGreaterThanOrEqual(Array.isArray(persistedRun?.draftEntries) ? persistedRun.draftEntries.length : 0, 1, 'Generated current-year timetable contains entries');
	} finally {
		if (createdRunIds.length > 0) {
			await prisma.manualScheduleEdit.deleteMany({ where: { schoolId, schoolYearId: activeSchoolYearId, runId: { in: createdRunIds } } });
			await prisma.followUpFlag.deleteMany({ where: { runId: { in: createdRunIds } } });
			await prisma.auditLog.deleteMany({
				where: {
					schoolId,
					schoolYearId: activeSchoolYearId,
					targetIds: { hasSome: createdRunIds },
				},
			});
			await prisma.generationRun.deleteMany({ where: { id: { in: createdRunIds } } });
		}
		await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } });
		await prisma.facultySubject.deleteMany({ where: { schoolId } });
	}
	const afterFixture = await countReadinessRows(schoolId, activeSchoolYearId);
	assertEqual(afterFixture.generationRuns, beforeFixture.generationRuns, 'Generation fixture cleanup restores current-year run count');
	assertEqual(afterFixture.facultySubjects, beforeFixture.facultySubjects, 'Generation fixture cleanup restores FacultySubject count');
	assertEqual(afterFixture.ownerships, beforeFixture.ownerships, 'Generation fixture cleanup restores SubjectSectionOwnership count');
	assertEqual(afterFixture.auditLogs, beforeFixture.auditLogs, 'Generation fixture cleanup restores current-year audit log count');

	console.log(`\nEnrollPro rollover readiness test complete: ${passCount} passed, ${failCount} failed.`);
	if (failCount > 0) {
		process.exitCode = 1;
	}
}

run()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
