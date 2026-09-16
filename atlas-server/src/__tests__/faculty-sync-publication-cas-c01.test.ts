/**
 * FACULTY-SYNC-PUBLICATION-CAS-C01 — routine-sync publication CAS + R3 interval hardening.
 *
 * Runs the REAL `invalidateStaleCompletedRuns`, the REAL `publishSchedule`, the REAL
 * published read (`getPublishedSchedulePayload`), and the REAL routine-sync caller
 * (`syncFacultyFromExternal`) over a GUARDED DISPOSABLE PostgreSQL database created
 * by `provisionDisposableDatabase('fscas')` and dropped with a zero-residue
 * assertion in `finally`. The configured source database is probed read-only.
 *
 * Controls: C-A (un-publish/resurrection interleave), C-B (orphan interleave),
 * C-C (genuine invalidation preserved + truthful counters + R2.3b), replay
 * idempotency, C-D (R3 fail-closed interval parity with the producer), and C-E (the
 * real routine-sync caller path).
 *
 * Run: `npx tsx src/__tests__/faculty-sync-publication-cas-c01.test.ts` (from `atlas-server`).
 */

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { provisionDisposableDatabase } from './helpers/tt-source-freshness-db.js';
import type { InvalidateStaleCompletedRunsResult } from '../services/generation.service.js';

function sha256(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

let passCount = 0;
let failCount = 0;

function check(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function checkEqual(actual: unknown, expected: unknown, label: string) {
	check(actual === expected, `${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

const WORKDIR = process.cwd();
const RUNTIME_ENV = 'D:/ATLAS-runtime-config/atlas-server.env';
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

function readEnvFile(path: string): Record<string, string> {
	const out: Record<string, string> = {};
	try {
		for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			if (!key) continue;
			out[key] = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
		}
	} catch {
		/* absent */
	}
	return out;
}

async function main() {
	section('FSCAS setup. guarded disposable database');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];
	const configuredSourceUrl = pick('DATABASE_URL');

	const disposable = provisionDisposableDatabase('fscas');
	if (!disposable) {
		console.error('EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)');
		process.exit(3);
	}
	// MUST precede the first import of ../lib/prisma.js and ../services/faculty.service.js.
	process.env.DATABASE_URL = disposable.targetUrl;
	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	// The faculty/section adapters are module-level consts read at import time.
	process.env.FACULTY_ADAPTER = 'stub';
	process.env.SECTION_SOURCE_MODE = 'stub';
	console.log(`[INFO] disposable database ready: ${disposable.name}`);

	const { createTestPrismaClient } = await import('../lib/prisma.js');
	const { withDataContext } = await import('../lib/data-context.js');
	const { publishSchedule } = await import('../services/publication-contract.service.js');
	const { computeGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js');
	const { getPublishedSchedulePayload } = await import('../services/published-schedule.service.js');
	const { readPublishedIdentitySnapshot, assertSnapshotConsistency } = await import('../services/published-identity-snapshot.service.js');
	const { invalidateStaleCompletedRuns } = await import('../services/generation.service.js');
	const { syncFacultyFromExternal } = await import('../services/faculty.service.js');
	const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');
	const { buildRunTimetableShapeContracts } = await import('../services/generation-shape-assembly.service.js');
	const { buildUnionDisplaySlots, resolveContainingClassRow } = await import('../services/schedule-constructor.js');
	const { toConstructorSpecialEvents } = await import('../services/generation-preflight.service.js');

	const prisma: any = createTestPrismaClient();
	const NOW = new Date();
	const ACTOR = 9_431;
	let disposed = false;

	type Fixture = {
		suffix: string;
		schoolId: number;
		schoolYearId: number;
		sectionExternalId: number;
		anchorFacultyId: number;
		altFacultyId: number;
		subjectIds: Record<string, number>;
		roomId: number;
		classInterval: string;
		rotationInterval: string;
		inputSnapshot: unknown;
		timetableDisplaySlots: unknown[];
	};

	let fixtureCounter = 0;
	const schoolYearBase = 9_200_000;

	async function seedFixture(suffix: string): Promise<Fixture> {
		fixtureCounter += 1;
		const schoolYearId = schoolYearBase + fixtureCounter;
		const sectionExternalId = 9_500 + fixtureCounter;
		const school = await prisma.school.create({
			data: { name: `FACULTY-SYNC-CAS-C01 FIXTURE — SAFE TO DELETE — ${suffix} — ${Date.now()}`, shortName: `FSCAS${suffix.toUpperCase()}` },
			select: { id: true },
		});
		const schoolId = school.id as number;

		await prisma.enrollProSchoolYearMirror.create({
			data: {
				schoolId,
				enrollProSchoolYearId: schoolYearId,
				yearLabel: '2030-2031',
				isActive: true,
				isArchived: false,
				lastSyncedAt: NOW,
				termContractCachedAt: NOW,
				termContractCache: {
					schoolId,
					schoolYear: { id: schoolYearId, yearLabel: '2030-2031' },
					format: 'TRIMESTER',
					activeTerm: { identity: 'T1', order: 1 },
					terms: [
						{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
						{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
						{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
					],
				},
			},
		});
		await prisma.schedulingPolicy.create({
			data: {
				schoolId,
				schoolYearId,
				periodLengthMinutes: 60,
				periodsPerDay: 8,
				earliestStartTime: '07:00',
				latestEndTime: '17:00',
				lunchStartTime: '11:55',
				lunchEndTime: '12:55',
				enableRecess: true,
				recessStartTime: '09:45',
				recessEndTime: '10:00',
				enableFlagCeremony: true,
				flagCeremonyStartTime: '07:00',
				flagCeremonyEndTime: '07:30',
				advisoryCreditMinutes: 0,
			},
		});
		await prisma.classProgramSlot.createMany({
			data: getExpectedCanonicalSlots(7, 'REGULAR').map((slot: any) => ({
				schoolId,
				schoolYearId,
				gradeLevel: 7,
				programType: 'REGULAR' as const,
				startTime: slot.startTime,
				endTime: slot.endTime,
				rowKind: slot.rowKind as any,
				subjectFamily: slot.subjectFamily ?? null,
				subjectLabel: slot.subjectLabel ?? null,
				isActive: true,
			})),
		});
		await prisma.classTemplate.create({
			data: {
				schoolId,
				name: 'Regular',
				label: 'Regular',
				programType: 'REGULAR' as const,
				gradeApplicability: [7, 8, 9, 10],
				periodLengthMinutes: 60,
				periodsPerDay: 8,
				isActive: true,
			},
		});
		const building = await prisma.building.create({ data: { schoolId, name: 'Building 1', gradeScope: [7] } });
		const room = await prisma.room.create({
			data: { buildingId: building.id, name: 'R1', type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' },
		});
		const math = await prisma.subject.create({
			data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 300, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true },
		});
		const bio = await prisma.subject.create({
			data: { schoolId, code: 'BIO', name: 'Biology', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: `SCI${suffix}`, modularOrder: 1 },
		});
		const chem = await prisma.subject.create({
			data: { schoolId, code: 'CHEM', name: 'Chemistry', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: `SCI${suffix}`, modularOrder: 2 },
		});
		const physics = await prisma.subject.create({
			data: { schoolId, code: 'PHYS', name: 'Physics', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: `SCI${suffix}`, modularOrder: 3 },
		});
		await prisma.sectionMirror.create({
			data: { externalId: sectionExternalId, schoolId, schoolYearId, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
		});
		await prisma.sectionSnapshot.create({
			data: {
				schoolId,
				schoolYearId,
				payload: [{ gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, sections: [{ id: sectionExternalId, name: '7-A', displayOrder: 7, gradeLevelId: 17, gradeLevelName: 'Grade 7', maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR' }] }],
			},
		});
		const anchor = await prisma.facultyMirror.create({
			data: { externalId: 910 + fixtureCounter, schoolId, firstName: 'Anchor', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false, advisedSectionId: sectionExternalId, advisedSectionName: '7-A' },
		});
		const alt = await prisma.facultyMirror.create({
			data: { externalId: 950 + fixtureCounter, schoolId, firstName: 'Alternate', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false },
		});
		for (const subject of [math, bio, chem, physics]) {
			const fs = await prisma.facultySubject.create({
				data: { facultyId: anchor.id, subjectId: subject.id, schoolId, schoolYearId, gradeLevels: [7], sectionIds: [sectionExternalId], assignedBy: ACTOR },
			});
			await prisma.subjectSectionOwnership.create({
				data: { schoolId, schoolYearId, facultySubjectId: fs.id, facultyId: anchor.id, subjectId: subject.id, sectionId: sectionExternalId },
			});
		}
		await prisma.policySpecialEvent.createMany({
			data: [
				{ schoolId, schoolYearId, eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony / HGP', startTime: '07:00', endTime: '07:30', gradeGroup: null, programType: null, enabled: true, sortOrder: 1 },
				{ schoolId, schoolYearId, eventType: 'HEALTH_BREAK', label: 'Health Break', startTime: '09:00', endTime: '09:15', gradeGroup: '7-8', programType: null, enabled: true, sortOrder: 2 },
				{ schoolId, schoolYearId, eventType: 'LUNCH_BREAK', label: 'Lunch Break', startTime: '12:15', endTime: '13:00', gradeGroup: '7-8', programType: null, enabled: true, sortOrder: 3 },
			],
		});
		await prisma.teacherProgramPresentationRevision.create({
			data: { schoolId, schoolYearId, revision: 1, schoolHeadName: 'Frozen Head', createdBy: ACTOR, createdAt: new Date(NOW.getTime() - 86_400_000) },
		});

		const classSlots = await prisma.classProgramSlot.findMany({
			where: { schoolId, schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'CLASS', isActive: true },
			orderBy: { startTime: 'asc' },
			select: { startTime: true, endTime: true },
		});
		if (classSlots.length < 2) throw new Error('canonical class intervals were not seeded');
		const classInterval = `${classSlots[0].startTime}-${classSlots[0].endTime}`;
		const rotationInterval = `${classSlots[1].startTime}-${classSlots[1].endTime}`;

		const canonicalSlotRows = getExpectedCanonicalSlots(7, 'REGULAR').map((slot: any) => ({
			startTime: slot.startTime,
			endTime: slot.endTime,
			subjectFamily: slot.subjectFamily ?? null,
			subjectLabel: slot.subjectLabel ?? null,
			rowKind: slot.rowKind,
		}));
		const persistedSpecialEvents = await prisma.policySpecialEvent.findMany({
			where: { schoolId, schoolYearId, enabled: true },
			orderBy: [{ sortOrder: 'asc' }],
		});
		const timetableShapeContracts = buildRunTimetableShapeContracts({
			sectionsByGrade: [{ gradeLevelId: 17, sections: [{ programType: 'REGULAR' }] }],
			gradeWindows: [{ gradeLevel: 7, programType: 'REGULAR', startTime: '06:00', endTime: '13:00' }],
			templateProfiles: [{ programType: 'REGULAR', periodLengthMinutes: 45, periodsPerDay: 8 }],
			canonicalSlots: new Map<string, any>([['7:REGULAR', canonicalSlotRows]]),
			policy: {
				periodLengthMinutes: 45,
				periodsPerDay: 8,
				showSpecialEventsInGrid: true,
				specialEvents: toConstructorSpecialEvents(persistedSpecialEvents),
			} as any,
		});
		const timetableDisplaySlots = buildUnionDisplaySlots(timetableShapeContracts);
		const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, prisma);

		return {
			suffix,
			schoolId,
			schoolYearId,
			sectionExternalId,
			anchorFacultyId: anchor.id,
			altFacultyId: alt.id,
			subjectIds: { MATH: math.id, BIO: bio.id, CHEM: chem.id, PHYS: physics.id },
			roomId: room.id,
			classInterval,
			rotationInterval,
			inputSnapshot,
			timetableDisplaySlots,
		};
	}

	function draftEntriesFor(fixture: Fixture, facultyId: number) {
		const entry = (entryId: string, subjectId: number, termIndex: number, day: string, interval: string) => {
			const [startTime, endTime] = interval.split('-');
			return { entryId, subjectId, facultyId, roomId: fixture.roomId, sectionId: fixture.sectionExternalId, day, startTime, endTime, durationMinutes: 60, termIndex, entryKind: 'SECTION' };
		};
		return [
			...DAYS.map((day) => entry(`MATH-T1-${day}`, fixture.subjectIds.MATH, 1, day, fixture.classInterval)),
			...DAYS.map((day) => entry(`MATH-T2-${day}`, fixture.subjectIds.MATH, 2, day, fixture.classInterval)),
			...DAYS.map((day) => entry(`MATH-T3-${day}`, fixture.subjectIds.MATH, 3, day, fixture.classInterval)),
			entry('BIO-T1-MON', fixture.subjectIds.BIO, 1, 'MONDAY', fixture.rotationInterval),
			entry('CHEM-T2-MON', fixture.subjectIds.CHEM, 2, 'MONDAY', fixture.rotationInterval),
			entry('PHYS-T3-MON', fixture.subjectIds.PHYS, 3, 'MONDAY', fixture.rotationInterval),
		];
	}

	async function createCompletedRun(fixture: Fixture, facultyId: number): Promise<number> {
		const run = await prisma.generationRun.create({
			data: {
				schoolId: fixture.schoolId,
				schoolYearId: fixture.schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: ACTOR,
				finishedAt: NOW,
				summary: { inputSnapshot: fixture.inputSnapshot, timetableDisplaySlots: fixture.timetableDisplaySlots },
				violations: [],
				unassignedItems: [],
				draftEntries: draftEntriesFor(fixture, facultyId),
				version: 1,
			},
			select: { id: true },
		});
		return run.id as number;
	}

	const publish = (fixture: Fixture, runId: number) =>
		withDataContext(prisma, () => publishSchedule(
			{ schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, runId, actorId: ACTOR, actorSchoolId: fixture.schoolId },
			{ now: () => NOW, computeInputSnapshot: async () => fixture.inputSnapshot as any, publishEvent: () => undefined },
		));

	const deactivate = (facultyId: number) =>
		prisma.facultyMirror.update({ where: { id: facultyId }, data: { isActiveForScheduling: false } });

	const countPublished = (fixture: Fixture) =>
		prisma.generationRun.count({ where: { schoolId: fixture.schoolId, schoolYearId: fixture.schoolYearId, summary: { path: ['isPublished'], equals: true } } });

	const skipAuditCount = (fixture: Fixture, runId: number) =>
		prisma.auditLog.count({ where: { schoolId: fixture.schoolId, action: 'GENERATION_RUN_INVALIDATION_CONCURRENT_SKIPPED', targetIds: { has: runId } } });

	const publishedRead = (fixture: Fixture) =>
		withDataContext(prisma, () => getPublishedSchedulePayload(fixture.schoolId, fixture.schoolYearId));

	const safePublishedRead = async (fixture: Fixture): Promise<{ payload: any; code: string | null }> => {
		try {
			return { payload: await publishedRead(fixture), code: null };
		} catch (error) {
			return { payload: null, code: (error as { code?: string }).code ?? 'error' };
		}
	};

	try {
		// ── C-A: un-publish / resurrection interleave ──
		section('C-A. routine sync never resurrects a run retired by a concurrent publication');
		const fxA = await seedFixture('a');
		const runA = await createCompletedRun(fxA, fxA.anchorFacultyId);
		await publish(fxA, runA);
		const publishedA = await prisma.generationRun.findUnique({ where: { id: runA }, select: { version: true, summary: true } });
		checkEqual(publishedA?.version, 2, 'C-A precondition: real publishSchedule advanced R to version 2');
		await deactivate(fxA.anchorFacultyId);
		const runA2 = await createCompletedRun(fxA, fxA.altFacultyId);
		let interleavedA = false;
		const outcomeA = await withDataContext(prisma, () => invalidateStaleCompletedRuns(fxA.schoolId, fxA.schoolYearId, {
			afterClassification: async () => {
				await publish(fxA, runA2);
				interleavedA = true;
			},
		})) as InvalidateStaleCompletedRunsResult;
		check(interleavedA, 'C-A the concurrent publication really executed inside the interleave seam');
		const afterA = await prisma.generationRun.findUnique({ where: { id: runA }, select: { status: true, summary: true, version: true } });
		const afterASummary = afterA?.summary as Record<string, unknown>;
		checkEqual(afterA?.status, 'COMPLETED', 'C-A R stays COMPLETED (never FAILED)');
		checkEqual(afterA?.version, 3, 'C-A R version advanced only by the publication retire CAS');
		checkEqual(afterASummary?.isPublished, false, 'C-A R stays isPublished:false');
		checkEqual(afterASummary?.publicationSupersededByRunId, runA2, 'C-A R keeps its supersession pointer');
		check(typeof afterASummary?.publicationSupersededAt === 'string', 'C-A R keeps its supersession timestamp');
		checkEqual(afterASummary?.publicationIntegrity, undefined, 'C-A zero non-CAS writes for R (no drift summary applied)');
		checkEqual(Object.prototype.hasOwnProperty.call(afterASummary, 'publicationIntegrity'), false, 'C-A R summary carries no drift-integrity key after the CAS miss');
		checkEqual(await countPublished(fxA), 1, 'C-A exactly one run is isPublished===true');
		check(outcomeA.concurrentChangedRunIds.includes(runA), 'C-A typed outcome contains R');
		checkEqual(outcomeA.invalidatedCount, 0, 'C-A invalidatedCount is truthful (R was not set FAILED)');
		checkEqual(outcomeA.staleRunIds.length, 1, 'C-A staleRunIds keeps the classified-set meaning');
		checkEqual(await skipAuditCount(fxA, runA), 1, 'C-A exactly one concurrent-skip audit row for R');
		checkEqual(await prisma.auditLog.count({ where: { schoolId: fxA.schoolId, action: 'GENERATION_RUN_PUBLICATION_DRIFT_DETECTED', targetIds: { has: runA } } }), 0, 'C-A no drift audit was written on the CAS miss');
		const readA = await safePublishedRead(fxA);
		check(readA.code === null && Boolean(readA.payload), `C-A real published read still resolves (no 409 PUBLISHED_RUN_AMBIGUOUS; code=${readA.code ?? 'none'})`);

		// ── C-B: orphan interleave ──
		section('C-B. routine sync never orphans a run published by a concurrent publication');
		const fxB = await seedFixture('b');
		const runB = await createCompletedRun(fxB, fxB.anchorFacultyId);
		await deactivate(fxB.anchorFacultyId);
		let interleavedB = false;
		const outcomeB = await withDataContext(prisma, () => invalidateStaleCompletedRuns(fxB.schoolId, fxB.schoolYearId, {
			afterClassification: async () => {
				await publish(fxB, runB);
				interleavedB = true;
			},
		})) as InvalidateStaleCompletedRunsResult;
		check(interleavedB, 'C-B the concurrent publication really executed inside the interleave seam');
		const afterB = await prisma.generationRun.findUnique({ where: { id: runB }, select: { status: true, summary: true, version: true, error: true } });
		const afterBSummary = afterB?.summary as Record<string, unknown>;
		checkEqual(afterB?.status, 'COMPLETED', 'C-B R is never set FAILED');
		checkEqual(afterB?.error, null, 'C-B R carries no invalidation error');
		checkEqual(afterB?.version, 2, 'C-B R version advanced only by publication');
		checkEqual(afterBSummary?.isPublished, true, 'C-B isPublished===true survives');
		check(outcomeB.concurrentChangedRunIds.includes(runB), 'C-B typed outcome contains R');
		check(!outcomeB.unpublishedRunIds.includes(runB), 'C-B no destructive write recorded for R');
		checkEqual(await skipAuditCount(fxB, runB), 1, 'C-B exactly one concurrent-skip audit row for R');
		checkEqual(await prisma.generationRun.count({ where: { schoolId: fxB.schoolId, schoolYearId: fxB.schoolYearId, status: 'FAILED' } }), 0, 'C-B zero destructive writes for R');
		const revisionB = await prisma.publishedScheduleRevision.findFirst({ where: { schoolId: fxB.schoolId, schoolYearId: fxB.schoolYearId, sourceRunId: runB }, select: { id: true, metadata: true } });
		check(Boolean(revisionB), 'C-B R revision row still resolves through the published read path');
		const readB = await safePublishedRead(fxB);
		check(readB.code === null && (readB.payload as any)?.source?.runId === runB, `C-B real published read resolves R (code=${readB.code ?? 'none'})`);

		// ── C-C: genuine invalidation preserved (over-blocking control) ──
		section('C-C. genuine stale invalidation is preserved with truthful counters');
		const fxC = await seedFixture('c');
		const runC = await createCompletedRun(fxC, fxC.anchorFacultyId);
		await deactivate(fxC.anchorFacultyId);
		const outcomeC = await withDataContext(prisma, () => invalidateStaleCompletedRuns(fxC.schoolId, fxC.schoolYearId)) as InvalidateStaleCompletedRunsResult;
		const afterC = await prisma.generationRun.findUnique({ where: { id: runC }, select: { status: true, error: true, version: true } });
		checkEqual(afterC?.status, 'FAILED', 'C-C unpublished stale run is still invalidated');
		checkEqual(afterC?.error, 'INVALIDATED_BY_MIRROR_RESET', 'C-C typed invalidation error preserved');
		checkEqual(afterC?.version, 2, 'C-C destructive CAS increments the run version');
		check(outcomeC.staleRunIds.includes(runC), 'C-C staleRunIds keeps the classified-set meaning');
		checkEqual(outcomeC.invalidatedCount, 1, 'C-C invalidatedCount counts runs actually set FAILED');
		checkEqual(outcomeC.invalidatedCount, outcomeC.unpublishedRunIds.length, 'C-C invalidatedCount equals unpublishedRunIds length');
		check(outcomeC.unpublishedRunIds.includes(runC), 'C-C unpublishedRunIds is truthful (R2.3b)');
		checkEqual(await skipAuditCount(fxC, runC), 0, 'C-C no concurrent-skip audit for a matched CAS');
		const failedC = await prisma.generationRun.count({ where: { schoolId: fxC.schoolId, schoolYearId: fxC.schoolYearId, status: 'FAILED', error: 'INVALIDATED_BY_MIRROR_RESET' } });
		checkEqual(failedC, outcomeC.invalidatedCount, 'C-C invalidatedCount equals the DB count of runs actually set FAILED');

		// ── Gate 6: replay idempotency ──
		section('C-replay. a second no-input sync writes nothing and duplicates no audit');
		const fxR = await seedFixture('r');
		const runRplain = await createCompletedRun(fxR, fxR.anchorFacultyId);
		const runRpublished = await createCompletedRun(fxR, fxR.anchorFacultyId);
		await publish(fxR, runRpublished);
		await deactivate(fxR.anchorFacultyId);
		const firstR = await withDataContext(prisma, () => invalidateStaleCompletedRuns(fxR.schoolId, fxR.schoolYearId)) as InvalidateStaleCompletedRunsResult;
		const snapshotAfterFirst = await prisma.generationRun.findMany({
			where: { schoolId: fxR.schoolId, schoolYearId: fxR.schoolYearId },
			select: { id: true, status: true, version: true, summary: true },
		});
		const driftAuditsAfterFirst = await prisma.auditLog.count({ where: { schoolId: fxR.schoolId, action: 'GENERATION_RUN_PUBLICATION_DRIFT_DETECTED' } });
		const secondR = await withDataContext(prisma, () => invalidateStaleCompletedRuns(fxR.schoolId, fxR.schoolYearId)) as InvalidateStaleCompletedRunsResult;
		const snapshotAfterSecond = await prisma.generationRun.findMany({
			where: { schoolId: fxR.schoolId, schoolYearId: fxR.schoolYearId },
			select: { id: true, status: true, version: true, summary: true },
		});
		const driftAuditsAfterSecond = await prisma.auditLog.count({ where: { schoolId: fxR.schoolId, action: 'GENERATION_RUN_PUBLICATION_DRIFT_DETECTED' } });
		checkEqual(firstR.invalidatedCount, 1, 'replay first sync invalidated the one unpublished stale run');
		checkEqual(secondR.invalidatedCount, 0, 'replay second sync performs no destructive write');
		checkEqual(secondR.unpublishedRunIds.length, 0, 'replay second sync reports no destructive write');
		checkEqual(await skipAuditCount(fxR, runRplain), 0, 'replay no concurrent-skip audit for a matched CAS');
		const runRows = (rows: Array<{ id: number; status: string; version: number; summary: unknown }>) =>
			rows.map((row) => ({ id: row.id, status: row.status, version: row.version, integrity: (row.summary as Record<string, unknown> | null)?.publicationIntegrity ?? null }));
		checkEqual(sha256(runRows(snapshotAfterFirst)), sha256(runRows(snapshotAfterSecond)), 'replay no run row changed on the second sync (sha256)');
		checkEqual(driftAuditsAfterFirst, 1, 'replay the published run drift is audited exactly once after the first sync');
		checkEqual(driftAuditsAfterSecond, 1, 'replay no duplicate drift audit on the second sync');
		checkEqual(await countPublished(fxR), 1, 'replay exactly one published run remains');

		// ── C-D: R3 fail-closed interval parity with the producer ──
		section('C-D. the frozen-snapshot interval gate fails closed like the producer');
		const realSnapshot = readPublishedIdentitySnapshot(revisionB?.metadata);
		check(Boolean(realSnapshot), 'C-D a real frozen published snapshot is available');
		checkEqual(resolveContainingClassRow([{ startTime: '06:45', endTime: '07:30' }], '07:xx', '07:30'), undefined, "C-D the producer treats 07:xx as NaN (unresolved authority), never 420");
		let realSnapshotError: any = null;
		try { assertSnapshotConsistency(realSnapshot!); } catch (error) { realSnapshotError = error; }
		check(!realSnapshotError, `C-D the unmutated real frozen snapshot passes (error: ${realSnapshotError?.code ?? 'none'})`);
		const frozenDigestBefore: string = sha256(realSnapshot);
		const mutatedSnapshot: any = structuredClone(realSnapshot);
		const flagEvent = mutatedSnapshot.specialEvents.find((event: any) => /FLAG|HGP/i.test(event.eventType) || /flag|hgp/i.test(event.label));
		check(Boolean(flagEvent), 'C-D the canonical Flag/HGP frozen event is present');
		flagEvent.startTime = '07:xx';
		let mutatedError: any = null;
		try { assertSnapshotConsistency(mutatedSnapshot); } catch (error) { mutatedError = error; }
		checkEqual(mutatedError?.code, 'PUBLICATION_SNAPSHOT_INCONSISTENT', 'C-D a non-numeric interval is rejected (never silently read as 420)');
		checkEqual(mutatedError?.statusCode, 422, 'C-D the rejection keeps the typed 422');
		const contradictionKinds: string[] = (mutatedError?.details?.contradictions ?? []).map((item: any) => String(item?.kind));
		check(contradictionKinds.includes('EVENT_INTERVAL_MISSING'), `C-D the typed EVENT_INTERVAL_MISSING contradiction surfaces (${contradictionKinds.join(',')})`);
		checkEqual(sha256(realSnapshot), frozenDigestBefore, 'C-D the mutant operated on a copy (frozen snapshot sha256 unchanged)');

		// ── C-E: gate 10 — the real routine-sync caller path ──
		section('C-E. real syncFacultyFromExternal reaches the guarded write and reports truthful counters');
		const fxE = await seedFixture('e');
		const runEpublished = await createCompletedRun(fxE, fxE.anchorFacultyId);
		const runEplain = await createCompletedRun(fxE, fxE.anchorFacultyId);
		await publish(fxE, runEpublished);
		checkEqual(await countPublished(fxE), 1, 'C-E precondition: exactly one published run before sync');
		const syncResult = await withDataContext(prisma, () => syncFacultyFromExternal(fxE.schoolId, fxE.schoolYearId));
		checkEqual(syncResult.synced, true, 'C-E the real routine-sync caller completed');
		check(syncResult.deactivatedCount > 0, `C-E the stub reconciliation genuinely deactivated the fixture faculty (deactivatedCount=${syncResult.deactivatedCount})`);
		const invalidatedE = syncResult.invalidatedRuns as InvalidateStaleCompletedRunsResult;
		const afterEpublished = await prisma.generationRun.findUnique({ where: { id: runEpublished }, select: { status: true, summary: true, error: true } });
		const afterEplain = await prisma.generationRun.findUnique({ where: { id: runEplain }, select: { status: true, error: true } });
		const failedE = await prisma.generationRun.count({ where: { schoolId: fxE.schoolId, schoolYearId: fxE.schoolYearId, status: 'FAILED', error: 'INVALIDATED_BY_MIRROR_RESET' } });
		checkEqual(invalidatedE.invalidatedCount, failedE, 'C-E invalidatedCount equals the DB count of runs actually set FAILED');
		checkEqual(invalidatedE.unpublishedRunIds.length, failedE, 'C-E unpublishedRunIds matches the DB destructive set');
		check(invalidatedE.unpublishedRunIds.includes(runEplain), 'C-E the unpublished stale run is reported invalidated');
		check(!invalidatedE.unpublishedRunIds.includes(runEpublished), 'C-E the published run is excluded from the destructive path');
		check(invalidatedE.driftedPublishedRunIds.includes(runEpublished), 'C-E the published run drift is reported');
		checkEqual((afterEpublished?.summary as Record<string, unknown>)?.isPublished, true, 'C-E the published run is never un-published');
		checkEqual(afterEpublished?.status, 'COMPLETED', 'C-E the published run is never set FAILED');
		checkEqual(afterEpublished?.error, null, 'C-E the published run carries no invalidation error');
		checkEqual(afterEplain?.status, 'FAILED', 'C-E the unpublished stale run is invalidated');
		checkEqual(await countPublished(fxE), 1, 'C-E exactly one run remains isPublished===true');
		const readE = await safePublishedRead(fxE);
		check(readE.code === null && (readE.payload as any)?.source?.runId === runEpublished, `C-E the real published read resolves exactly one candidate (no 409; code=${readE.code ?? 'none'})`);

		// ── Cleanup ──
		section('CLEANUP. disposable database zero residue');
		await prisma.$disconnect();
		disposable.drop();
		disposable.assertDropped();
		disposed = true;
		check(true, `CLEANUP disposable database ${disposable.name} dropped and asserted absent`);
	} finally {
		try { await prisma.$disconnect(); } catch { /* already disconnected */ }
		if (!disposed) {
			try { disposable.drop(); disposable.assertDropped(); } catch { /* best effort */ }
		}
	}
}

main()
	.then(() => {
		console.log(`\n[SUMMARY] passed=${passCount} failed=${failCount}`);
		process.exitCode = failCount === 0 ? 0 : 1;
	})
	.catch((error) => {
		console.error(`\n[FATAL] ${error?.stack ?? error}`);
		process.exitCode = 1;
	});
