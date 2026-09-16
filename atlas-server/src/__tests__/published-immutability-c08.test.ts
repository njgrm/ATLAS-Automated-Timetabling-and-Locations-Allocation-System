/**
 * PUBLISHED-IMMUTABILITY-C08 — published revision as a historically reproducible artifact.
 *
 * Runs the REAL publication entry point (`publishSchedule`), the REAL published-read
 * service, the REAL mounted published-schedule router, the REAL export services, and
 * the REAL faculty synchronization invalidation path over a GUARDED DISPOSABLE
 * PostgreSQL database created by `provisionDisposableDatabase('c08')` and dropped with
 * a zero-residue assertion in `finally`. The configured source database is probed
 * read-only; it is never written.
 *
 * Real three-term fixture: one year-long `MATH` plus the term rotations
 * `BIO`/`CHEM`/`PHYSICS` (T1/T2/T3).
 *
 * Run: `npx tsx src/__tests__/published-immutability-c08.test.ts` (from `atlas-server`).
 */

import { readFileSync } from 'node:fs';

import { provisionDisposableDatabase } from './helpers/tt-source-freshness-db.js';

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

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/** Identity-only digest: excludes request-time fields (dates, effective revision). */
function publicDigest(payload: any): string {
	return JSON.stringify({
		snapshotState: payload?.source?.snapshotState,
		snapshotGaps: payload?.source?.snapshotGaps,
		termScope: payload?.source?.termScope,
		termIndex: payload?.source?.termIndex,
		activeTermVerified: payload?.source?.activeTermVerified,
		timeSlots: payload?.timeSlots,
		specialEvents: payload?.specialEvents,
		entries: payload?.entries,
	});
}

function exportContextDigest(ctx: any): string {
	return JSON.stringify({
		frozen: ctx?.frozenSnapshot ? 'FROZEN' : 'LIVE',
		subjects: [...ctx.subjectMap.entries()].sort((a: any, b: any) => a[0] - b[0]),
		faculty: [...ctx.facultyMap.entries()].sort((a: any, b: any) => a[0] - b[0]),
		rooms: [...ctx.roomMap.entries()].sort((a: any, b: any) => a[0] - b[0]),
		advisers: [...ctx.adviserMap.entries()].sort((a: any, b: any) => a[0] - b[0]),
		displaySlots: ctx.displaySlots,
		entries: ctx.entries,
	});
}

function matrixDigest(m: any): string {
	return JSON.stringify({
		gradeLevel: m?.gradeLevel,
		schoolYear: m?.schoolYear,
		sourceRunId: m?.sourceRunId,
		termIndex: m?.termIndex,
		timeRows: m?.timeRows,
		columns: m?.columns,
	});
}

function teacherDigest(s: any): string {
	return JSON.stringify({ teacher: s?.teacher, term: s?.term, rows: s?.rows, summary: s?.summary });
}

async function main() {
	section('C08 setup. guarded disposable database');
	const dotEnv = readEnvFile(`${WORKDIR}/.env`);
	const runtimeEnv = readEnvFile(RUNTIME_ENV);
	const pick = (key: string) => process.env[key] ?? dotEnv[key] ?? runtimeEnv[key];
	const configuredSourceUrl = pick('DATABASE_URL');

	const disposable = provisionDisposableDatabase('c08');
	if (!disposable) {
		console.error('EXTERNALLY_BLOCKED(DISPOSABLE_DB_UNAVAILABLE)');
		process.exit(3);
	}
	// MUST precede the first import of ../lib/prisma.js.
	process.env.DATABASE_URL = disposable.targetUrl;
	for (const key of ['JWT_SECRET', 'ATLAS_SYSTEM_TOKEN']) {
		const value = pick(key);
		if (value) process.env[key] = value;
	}
	console.log(`[INFO] disposable database ready: ${disposable.name}`);

	const { createTestPrismaClient } = await import('../lib/prisma.js');
	const { withDataContext } = await import('../lib/data-context.js');
	const { publishSchedule } = await import('../services/publication-contract.service.js');
	const { computeGenerationInputSnapshot } = await import('../services/generation-input-snapshot.service.js');
	const {
		getPublishedSchedulePayload,
		resolvePublishedRunTermIndex,
	} = await import('../services/published-schedule.service.js');
	const { resolveRequestedTermIndex } = await import('../services/academic-term.service.js');
	const { readPublishedIdentitySnapshot, snapshotDigest } = await import('../services/published-identity-snapshot.service.js');
	const { loadExportContext, exportSummaryWorkbook, exportClassProgramWorkbook } = await import('../services/workbook-export.service.js');
	const { exportRoomProgramWorkbook } = await import('../services/room-program-export.service.js');
	const { generateClassProgramMatrix } = await import('../services/class-program-matrix.service.js');
	const { buildTeacherProgramExportShape } = await import('../services/teacher-program-export.service.js');
	const { invalidateStaleCompletedRuns } = await import('../services/generation.service.js');
	const { getExpectedCanonicalSlots } = await import('../services/class-program-slot.service.js');

	const prisma: any = createTestPrismaClient();
	const FIXTURE_NAME = `PUBLISHED-IMMUTABILITY-C08 FIXTURE — SAFE TO DELETE — ${Date.now()}`;
	const NOW = new Date();
	const ACTOR = 9_411;
	const schoolYearId = 9_100_101;
	const sectionExternalId = 9_101;

	let schoolId = 0;
	let runId = 0;
	let revisionId = 0;
	let subjectIds: Record<string, number> = {};
	let facultyId = 0;
	let roomId = 0;
	let buildingId = 0;
	let classInterval = '08:00-09:00';
	let server: any = null;
	let disposed = false;

	const read = async (options?: any, filter?: any) =>
		withDataContext(prisma, () => getPublishedSchedulePayload(schoolId, schoolYearId, options, filter));

	const readExportContext = async () =>
		withDataContext(prisma, () => loadExportContext({ schoolId, schoolYearId, runId, client: prisma }));

	try {
		section('F0. three-term canonical fixture (MATH year-long + BIO/CHEM/PHYSICS rotations)');
		const school = await prisma.school.create({
			data: { name: `${FIXTURE_NAME} A`, shortName: 'PUBIMC08A' },
			select: { id: true },
		});
		schoolId = school.id as number;

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
		buildingId = building.id;
		const room = await prisma.room.create({
			data: { buildingId: building.id, name: 'R1', type: 'CLASSROOM' as const, capacity: 50, isTeachingSpace: true, isSharedFacility: false, buildingZoneId: 'Z1' },
		});
		roomId = room.id;

		const math = await prisma.subject.create({
			data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 300, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true },
		});
		const bio = await prisma.subject.create({
			data: { schoolId, code: 'BIO', name: 'Biology', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: 'SCI', modularOrder: 1 },
		});
		const chem = await prisma.subject.create({
			data: { schoolId, code: 'CHEM', name: 'Chemistry', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: 'SCI', modularOrder: 2 },
		});
		const physics = await prisma.subject.create({
			data: { schoolId, code: 'PHYS', name: 'Physics', minMinutesPerWeek: 60, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true, rotationFamily: 'SCI', modularOrder: 3 },
		});
		subjectIds = { MATH: math.id, BIO: bio.id, CHEM: chem.id, PHYS: physics.id };

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
		const faculty = await prisma.facultyMirror.create({
			data: { externalId: 810, schoolId, firstName: 'Ada', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false, advisedSectionId: sectionExternalId, advisedSectionName: '7-A' },
		});
		facultyId = faculty.id;
		for (const subject of [math, bio, chem, physics]) {
			const fs = await prisma.facultySubject.create({
				data: { facultyId: faculty.id, subjectId: subject.id, schoolId, schoolYearId, gradeLevels: [7], sectionIds: [sectionExternalId], assignedBy: ACTOR },
			});
			await prisma.subjectSectionOwnership.create({
				data: { schoolId, schoolYearId, facultySubjectId: fs.id, facultyId: faculty.id, subjectId: subject.id, sectionId: sectionExternalId },
			});
		}
		await prisma.instructionalCohort.create({
			data: { schoolId, schoolYearId, cohortCode: 'COH1', specializationCode: 'SPEC1', specializationName: 'Specialization One', gradeLevel: 7, memberSectionIds: [sectionExternalId], expectedEnrollment: 40, isActive: true },
		});
		await prisma.policySpecialEvent.create({
			data: { schoolId, schoolYearId, eventType: 'FLAG_OR_HGP', label: 'Flag Ceremony', startTime: '07:00', endTime: '07:30', enabled: true, sortOrder: 0 },
		});
		// Signatory revision effective at publication time (the frozen published
		// program must keep rendering this revision after later edits).
		await prisma.teacherProgramPresentationRevision.create({
			data: { schoolId, schoolYearId, revision: 1, schoolHeadName: 'Frozen Head', createdBy: ACTOR, createdAt: new Date(NOW.getTime() - 86_400_000) },
		});

		const classSlots = await prisma.classProgramSlot.findMany({
			where: { schoolId, schoolYearId, gradeLevel: 7, programType: 'REGULAR', rowKind: 'CLASS', isActive: true },
			orderBy: { startTime: 'asc' },
			select: { startTime: true, endTime: true },
		});
		check(classSlots.length > 0, `canonical class intervals seeded (${classSlots.length})`);
		classInterval = `${classSlots[0].startTime}-${classSlots[0].endTime}`;
		const rotationInterval = `${classSlots[1].startTime}-${classSlots[1].endTime}`;

		const entry = (entryId: string, subjectId: number, termIndex: number, day: string, interval: string) => {
			const [startTime, endTime] = interval.split('-');
			return { entryId, subjectId, facultyId, roomId, sectionId: sectionExternalId, day, startTime, endTime, durationMinutes: 60, termIndex, entryKind: 'SECTION' };
		};
		const draftEntries = [
			...DAYS.map((day) => entry(`MATH-T1-${day}`, math.id, 1, day, classInterval)),
			...DAYS.map((day) => entry(`MATH-T2-${day}`, math.id, 2, day, classInterval)),
			...DAYS.map((day) => entry(`MATH-T3-${day}`, math.id, 3, day, classInterval)),
			entry('BIO-T1-MON', bio.id, 1, 'MONDAY', rotationInterval),
			entry('CHEM-T2-MON', chem.id, 2, 'MONDAY', rotationInterval),
			entry('PHYS-T3-MON', physics.id, 3, 'MONDAY', rotationInterval),
		];
		const timetableDisplaySlots = [
			...classSlots.map((slot: any) => ({ startTime: slot.startTime, endTime: slot.endTime, isSpecialEvent: false })),
			{ startTime: '07:00', endTime: '07:30', isSpecialEvent: true, eventName: 'Flag Ceremony', dayOfWeek: 'MONDAY' },
		];

		const inputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, prisma);
		const run = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: ACTOR,
				finishedAt: NOW,
				summary: { inputSnapshot, timetableDisplaySlots },
				violations: [],
				unassignedItems: [],
				draftEntries,
				version: 1,
			},
		});
		runId = run.id;
		check(runId > 0, `fixture committed (school=${schoolId} run=${runId} faculty=${facultyId} room=${roomId})`);

		// ── Gate 8: a rejected publication writes nothing ──
		section('G08. failed publication writes nothing (zero residue)');
		const blockedRun = await prisma.generationRun.create({
			data: {
				schoolId,
				schoolYearId,
				status: 'COMPLETED',
				runType: 'FULL',
				triggeredBy: ACTOR,
				finishedAt: NOW,
				summary: { inputSnapshot, timetableDisplaySlots },
				violations: [{ code: 'SECTION_TIME_CONFLICT', severity: 'HARD', message: 'fixture hard violation' }],
				unassignedItems: [],
				draftEntries,
				version: 1,
			},
		});
		const countsBeforeRejected = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId, action: 'GENERATION_RUN_PUBLISHED' } }),
			published: await prisma.generationRun.count({ where: { schoolId, summary: { path: ['isPublished'], equals: true } } }),
		};
		let rejectedCode = '';
		try {
			await withDataContext(prisma, () => publishSchedule(
				{ schoolId, schoolYearId, runId: blockedRun.id, actorId: ACTOR, actorSchoolId: schoolId },
				{ now: () => NOW, computeInputSnapshot: async () => inputSnapshot, publishEvent: () => undefined },
			));
		} catch (error) {
			rejectedCode = (error as { code?: string }).code ?? '';
		}
		const countsAfterRejected = {
			revisions: await prisma.publishedScheduleRevision.count({ where: { schoolId } }),
			audits: await prisma.auditLog.count({ where: { schoolId, action: 'GENERATION_RUN_PUBLISHED' } }),
			published: await prisma.generationRun.count({ where: { schoolId, summary: { path: ['isPublished'], equals: true } } }),
		};
		checkEqual(rejectedCode, 'PUBLISH_BLOCKED_HARD_VIOLATIONS', 'G08 rejected publish carries the typed blocker');
		check(JSON.stringify(countsBeforeRejected) === JSON.stringify(countsAfterRejected), `G08 zero database residue after rejection (${JSON.stringify(countsAfterRejected)})`);

		// ── Gate 1/3: real publication through the production entry point ──
		section('G01/G03. real publishSchedule + per-term rotation parity');
		await prisma.generationRun.delete({ where: { id: blockedRun.id } });
		const published = await withDataContext(prisma, () => publishSchedule(
			{ schoolId, schoolYearId, runId, actorId: ACTOR, actorSchoolId: schoolId },
			{ now: () => NOW, computeInputSnapshot: async () => inputSnapshot, publishEvent: () => undefined },
		));
		revisionId = published.revisionId;
		check(published.replayed === false, 'G01 initial publication committed (not a replay)');

		const baseRevision = await prisma.publishedScheduleRevision.findUnique({ where: { id: revisionId }, select: { metadata: true } });
		const frozenSnapshot = readPublishedIdentitySnapshot(baseRevision?.metadata);
		check(Boolean(frozenSnapshot), 'G01 base revision carries a valid publishedIdentitySnapshot');
		check(frozenSnapshot?.orderedTermContract?.terms?.length === 3, 'G01 frozen ordered-term contract has 3 terms');

		const allTerm = await read();
		checkEqual(allTerm.source.snapshotState, 'FROZEN', 'G01 published payload reports snapshotState=FROZEN');
		check(Array.isArray(allTerm.source.snapshotGaps) && allTerm.source.snapshotGaps.length === 0, 'G01 no frozen-identity gaps for a fully-referenced artifact');

		// Each per-term read is non-fatal: a mutant that removes the frozen
		// ordered-term contract must produce a named control FAIL rather than
		// aborting the disposable-PostgreSQL suite before the archived-term
		// control is reached (same intent as the G02 frozen-export controls).
		const termCodes = async (termIndex: number): Promise<string[]> => {
			try {
				const payload = await read({ termIndex });
				return payload.entries.map((e: any) => e.subject.code).sort();
			} catch (error) {
				check(false, `G03 term ${termIndex} resolves through the frozen ordered-term contract (error: ${(error as { code?: string }).code ?? 'error'})`);
				return [];
			}
		};
		const t1 = await termCodes(1);
		const t2 = await termCodes(2);
		const t3 = await termCodes(3);
		checkEqual(t1.join(','), 'BIO,MATH,MATH,MATH,MATH,MATH', 'G03 T1 = MATH year-long + BIO rotation');
		checkEqual(t2.join(','), 'CHEM,MATH,MATH,MATH,MATH,MATH', 'G03 T2 = MATH year-long + CHEM rotation');
		checkEqual(t3.join(','), 'MATH,MATH,MATH,MATH,MATH,PHYS', 'G03 T3 = MATH year-long + PHYSICS rotation');
		check(t1.includes('MATH') && t2.includes('MATH') && t3.includes('MATH'), 'G03 MATH (ALL term mode) present in every term');
		check(!t2.includes('BIO') && !t3.includes('BIO'), 'G03 BIO never leaks outside T1');
		check(!t1.includes('CHEM') && !t3.includes('CHEM'), 'G03 CHEM never leaks outside T2');
		check(!t1.includes('PHYS') && !t2.includes('PHYS'), 'G03 PHYSICS never leaks outside T3');

		const capturedPublic = publicDigest(allTerm);
		const capturedExport = exportContextDigest(await readExportContext());
		const capturedMatrix = matrixDigest(await withDataContext(prisma, () => generateClassProgramMatrix({ schoolId, schoolYearId, gradeLevel: 7, termIndex: 1, client: prisma })));
		const capturedTeacher = teacherDigest(await withDataContext(prisma, () => buildTeacherProgramExportShape({ schoolId, schoolYearId, runId, facultyId, termIndex: 1, client: prisma })));
		check(capturedMatrix.length > 0 && capturedTeacher.length > 0, 'G01 baseline artifact digests captured');

		// ── Gate 7: replay creates no duplicate revision/audit ──
		section('G07. publication replay is idempotent');
		const replay = await withDataContext(prisma, () => publishSchedule(
			{ schoolId, schoolYearId, runId, actorId: ACTOR, actorSchoolId: schoolId },
			{ now: () => NOW, computeInputSnapshot: async () => inputSnapshot, publishEvent: () => undefined },
		));
		checkEqual(replay.replayed, true, 'G07 replay is reported as a replay');
		checkEqual(replay.revisionId, revisionId, 'G07 replay returns the same revision');
		checkEqual(await prisma.publishedScheduleRevision.count({ where: { schoolId, sourceRunId: runId } }), 1, 'G07 replay creates no duplicate revision');
		checkEqual(await prisma.auditLog.count({ where: { schoolId, action: 'GENERATION_RUN_PUBLISHED', targetIds: { has: runId } } }), 1, 'G07 replay creates no duplicate publication audit');
		check(publicDigest(await read()) === capturedPublic, 'G07 replay does not alter the published artifact');

		// ── Gate 1/2: mutation categories → frozen equivalence ──
		section('G01. ten live-mutation categories leave the frozen artifact byte-stable');
		const identityStillFrozen = async (label: string) => {
			const publicNow = publicDigest(await read());
			const exportNow = exportContextDigest(await readExportContext());
			const matrixNow = matrixDigest(await withDataContext(prisma, () => generateClassProgramMatrix({ schoolId, schoolYearId, gradeLevel: 7, termIndex: 1, client: prisma })));
			const teacherNow = teacherDigest(await withDataContext(prisma, () => buildTeacherProgramExportShape({ schoolId, schoolYearId, runId, facultyId, termIndex: 1, client: prisma })));
			check(publicNow === capturedPublic, `G01 ${label}: published payload identity unchanged`);
			check(exportNow === capturedExport, `G01 ${label}: export-context identity unchanged`);
			check(matrixNow === capturedMatrix, `G01 ${label}: class-program matrix unchanged`);
			check(teacherNow === capturedTeacher, `G01 ${label}: teacher program unchanged`);
		};

		await prisma.subject.update({ where: { id: math.id }, data: { name: 'RENAMED MATHEMATICS', code: 'MATHX' } });
		await identityStillFrozen('M1 subject labels/codes');

		await prisma.facultyMirror.update({ where: { id: facultyId }, data: { firstName: 'Renamed', lastName: 'Renamed' } });
		await identityStillFrozen('M2 faculty labels/identities');

		await prisma.room.update({ where: { id: roomId }, data: { name: 'RENAMED ROOM', type: 'LABORATORY' as const, floor: 3 } });
		await prisma.building.update({ where: { id: buildingId }, data: { name: 'RENAMED BUILDING' } });
		await identityStillFrozen('M3 room/building/floor/type');

		await prisma.sectionMirror.update({
			where: { schoolId_schoolYearId_externalId: { schoolId, schoolYearId, externalId: sectionExternalId } },
			data: { name: 'RENAMED SECTION', gradeLevelName: 'Grade 9', programType: 'SPECIAL' },
		});
		await identityStillFrozen('M4 section name/grade/program');

		await prisma.instructionalCohort.updateMany({ where: { schoolId, schoolYearId }, data: { specializationName: 'RENAMED SPECIALIZATION' } });
		await prisma.subjectSectionOwnership.updateMany({ where: { schoolId, schoolYearId }, data: { specializationLabel: 'RENAMED OWNERSHIP LABEL' } });
		await identityStillFrozen('M5 specialization/cohort');

		await prisma.policySpecialEvent.updateMany({ where: { schoolId, schoolYearId }, data: { label: 'RENAMED FLAG EVENT', startTime: '06:00', endTime: '06:30' } });
		await prisma.schedulingPolicy.updateMany({ where: { schoolId, schoolYearId }, data: { lunchStartTime: '13:00', lunchEndTime: '14:00', maxTeachingMinutesPerDay: 999 } });
		await prisma.classProgramSlot.deleteMany({ where: { schoolId, schoolYearId, rowKind: 'CLASS' } });
		await identityStillFrozen('M5 policy/special events/display-slot sources');

		// ── Gate 18 control: current-year metadata while the year is still active ──
		section('G18. active-year metadata (positive control before archiving)');
		const activeRead = await read();
		checkEqual(activeRead.source.isActiveSchoolYear, true, 'G18 runtime-active year reports isActiveSchoolYear=true');
		checkEqual(activeRead.source.isHistorical, false, 'G18 runtime-active year reports isHistorical=false');

		// Category 7 — active-year election + ordered-term cache.
		await prisma.enrollProSchoolYearMirror.updateMany({ where: { schoolId, enrollProSchoolYearId: schoolYearId }, data: { isActive: false, isArchived: true, termContractCache: null as any, termContractCachedAt: null } });
		// M6 is the decisive control for this read: if the frozen term contract is
		// removed from the snapshot the resolution must fail closed. The control is
		// non-fatal so a mutant produces a control FAIL instead of a suite abort.
		let archivedRead: any = null;
		let archivedReadError: any = null;
		try { archivedRead = await read({ termIndex: 2 }); } catch (error) { archivedReadError = error; }
		check(!archivedReadError, `G01 archived per-term read resolves through the FROZEN ordered-term contract (error: ${archivedReadError?.code ?? 'none'})`);
		checkEqual(archivedRead?.source?.termIndex, 2, 'G01 archived per-term read returns the requested term');
		checkEqual(archivedRead?.source?.isActiveSchoolYear, false, 'G01 archived year is never elected current');
		checkEqual(archivedRead?.source?.isHistorical, true, 'G01 archived year reports isHistorical=true');
		check(Array.isArray(archivedRead?.entries) && archivedRead.entries.length > 0 && archivedRead.entries.every((e: any) => e.termIndex === 2), 'G01 archived T2 read returns only T2 entries');

		// Category 9 — signatory active configuration.
		await prisma.teacherProgramPresentationRevision.create({
			data: { schoolId, schoolYearId, revision: 2, schoolHeadName: 'Later Head', createdBy: ACTOR, createdAt: new Date(NOW.getTime() + 86_400_000) },
		});
		const teacherAfterSignatory = teacherDigest(await withDataContext(prisma, () => buildTeacherProgramExportShape({ schoolId, schoolYearId, runId, facultyId, termIndex: 1, client: prisma })));
		check(teacherAfterSignatory === capturedTeacher, 'G01 signatory/presentation edits leave the published teacher program unchanged');

		// Category 10 — faculty-synchronization inputs.
		await prisma.facultyMirror.update({ where: { id: facultyId }, data: { isStale: true, isActiveForScheduling: false } });
		await identityStillFrozen('M10 faculty-synchronization inputs');

		// ── Gate 2: archived reads + every official export succeed ──
		section('G02. archived per-term reads and every official export succeed');
		const archivedAll = await read();
		checkEqual(archivedAll.source.snapshotState, 'FROZEN', 'G02 archived all-term read is FROZEN');
		check(archivedAll.entries.length === 18, `G02 archived all-term read returns all 18 sessions (got ${archivedAll.entries.length})`);

		for (const termIndex of [1, 2, 3]) {
			let payload: any = null;
			let termError: any = null;
			try { payload = await read({ termIndex }); } catch (error) { termError = error; }
			check(!termError && Array.isArray(payload?.entries) && payload.entries.length > 0, `G02 archived term ${termIndex} read succeeds (${payload?.entries?.length ?? 0} entries, error ${termError?.code ?? 'none'})`);
		}

		// ── G02/M10 — the export route's term authority for a published run is the
		// FROZEN ordered-term contract; the live mirror cache is gone for this year.
		// Each control is non-fatal so a mutant yields a control FAIL, not an abort.
		let frozenExportTerm: number | undefined;
		let frozenExportTermError: any = null;
		try { frozenExportTerm = await withDataContext(prisma, () => resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, 2)); } catch (error) { frozenExportTermError = error; }
		check(!frozenExportTermError, `G02 archived export term resolves through the FROZEN ordered-term contract (error: ${frozenExportTermError?.code ?? 'none'})`);
		checkEqual(frozenExportTerm, 2, 'G02 archived export term value is the requested term');
		let frozenActiveExportTerm: number | undefined;
		let frozenActiveExportTermError: any = null;
		try { frozenActiveExportTerm = await withDataContext(prisma, () => resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, 'active')); } catch (error) { frozenActiveExportTermError = error; }
		check(!frozenActiveExportTermError, `G02 frozen contract resolves the persisted active term order (error: ${frozenActiveExportTermError?.code ?? 'none'})`);
		checkEqual(frozenActiveExportTerm, 1, 'G02 frozen active term order is the persisted value');
		let frozenOutOfContract = '';
		try {
			await withDataContext(prisma, () => resolvePublishedRunTermIndex(schoolId, schoolYearId, runId, 4));
		} catch (error) { frozenOutOfContract = (error as { code?: string }).code ?? ''; }
		checkEqual(frozenOutOfContract, 'TERM_INDEX_OUTSIDE_CONTRACT', 'G02 frozen export term authority rejects an out-of-contract term');
		let liveTermUnavailable = false;
		try {
			await withDataContext(prisma, () => resolveRequestedTermIndex(schoolId, schoolYearId, 2));
		} catch { liveTermUnavailable = true; }
		check(liveTermUnavailable, 'G02 live term authority is unavailable for the archived year (frozen path is load-bearing)');

		await prisma.facultyMirror.update({ where: { id: facultyId }, data: { isStale: false, isActiveForScheduling: true } });
		const summaryBuffer = await withDataContext(prisma, () => exportSummaryWorkbook({ schoolId, schoolYearId, runId, termIndex: 2, client: prisma }));
		check(summaryBuffer.length > 0, `G02 summary workbook exported from the archived year (${summaryBuffer.length} bytes)`);
		const classBuffer = await withDataContext(prisma, () => exportClassProgramWorkbook({ schoolId, schoolYearId, runId, termIndex: 2, client: prisma }));
		check(classBuffer.length > 0, `G02 class-program workbook exported from the archived year (${classBuffer.length} bytes)`);
		const roomBuffer = await withDataContext(prisma, () => exportRoomProgramWorkbook({ schoolId, schoolYearId, runId, termIndex: 2, roomId, client: prisma }));
		check(roomBuffer.length > 0, `G02 room-program workbook exported from the archived year (${roomBuffer.length} bytes)`);
		const matrix = await withDataContext(prisma, () => generateClassProgramMatrix({ schoolId, schoolYearId, gradeLevel: 7, termIndex: 3, client: prisma }));
		check(matrix.columns.length > 0 && matrix.columns[0].entries.length > 0, 'G02 class-program matrix exported from the archived year');
		const teacher = await withDataContext(prisma, () => buildTeacherProgramExportShape({ schoolId, schoolYearId, runId, facultyId, termIndex: 3, client: prisma }));
		check(teacher.rows.length > 0, 'G02 teacher program exported from the archived year');

		// ── Gate 4: `:termId` never selects a school year ──
		section('G04. mounted :termId route family is term-scoped, never a schoolYearId alias');
		// Re-elect the year as runtime-active (its term cache stays cleared): the term
		// family may not resolve the term from the live mirror at all.
		await prisma.enrollProSchoolYearMirror.updateMany({
			where: { schoolId, enrollProSchoolYearId: schoolYearId },
			data: { isActive: true, isArchived: false },
		});
		const express = (await import('express')).default;
		const { default: publishedRouter } = await import('../routes/published-schedule.router.js');
		const app = express();
		app.use('/api/v1', publishedRouter);
		app.use((error: any, _req: any, res: any, _next: any) => {
			res.status(error?.statusCode ?? 500).json({ code: error?.code ?? 'ERROR', message: error?.message ?? 'error' });
		});
		server = await new Promise<any>((resolveServer, rejectServer) => {
			const listener = app.listen(0, '127.0.0.1', () => resolveServer(listener));
			listener.on('error', rejectServer);
		});
		const baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
		const termRoute = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/schedules/published/2`);
		const termBody: any = await termRoute.json();
		checkEqual(termRoute.status, 200, 'G04 :termId route resolves the term, not a school year');
		checkEqual(termBody?.source?.termIndex, 2, 'G04 :termId is the resolved term index');
		checkEqual(termBody?.source?.schoolYearId, schoolYearId, 'G04 :termId never selects the school year');
		check((termBody?.entries ?? []).every((e: any) => e.termIndex === 2), 'G04 :termId filters entries to that term');
		const termSectionRoute = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/schedules/published/2/sections/${sectionExternalId}`);
		const termSectionBody: any = await termSectionRoute.json();
		checkEqual(termSectionRoute.status, 200, 'G04 :termId/sections sibling resolves the term');
		checkEqual(termSectionBody?.source?.termIndex, 2, 'G04 :termId/sections uses the term identity');
		checkEqual(termSectionBody?.source?.schoolYearId, schoolYearId, 'G04 :termId/sections never selects the school year');
		const outOfContract = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/schedules/published/4`);
		const outOfContractBody: any = await outOfContract.json().catch(() => ({}));
		checkEqual(outOfContract.status, 400, 'G04 out-of-contract :termId fails closed with 400');
		checkEqual(outOfContractBody?.code, 'TERM_INDEX_OUTSIDE_CONTRACT', 'G04 out-of-contract :termId carries the typed code');
		const syntacticallyInvalid = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/schedules/published/99`);
		const syntacticallyInvalidBody: any = await syntacticallyInvalid.json().catch(() => ({}));
		checkEqual(syntacticallyInvalid.status, 400, 'G04 syntactically-invalid :termId fails closed with 400');
		checkEqual(syntacticallyInvalidBody?.code, 'INVALID_TERM_INDEX', 'G04 syntactically-invalid :termId carries the typed code');
		const unknownSchool = await fetch(`${baseUrl}/api/v1/schools/${schoolId + 777}/schedules/published/2`);
		checkEqual(unknownSchool.status, 404, 'G04 cross-school :termId read fails closed with 404');

		// ── Gate 6: anonymous public routes expose only published data ──
		section('G06. anonymous reads expose only published data; cross-school fails closed');
		const anonymous = await fetch(`${baseUrl}/api/v1/schools/${schoolId}/school-years/${schoolYearId}/schedules/published`);
		const anonymousBody: any = await anonymous.json();
		checkEqual(anonymous.status, 200, 'G06 anonymous explicit-year published read returns 200');
		check(Array.isArray(anonymousBody?.entries) && anonymousBody.entries.length === 18, 'G06 anonymous read exposes only the published run entries');
		check(!JSON.stringify(anonymousBody).includes('inputSnapshot'), 'G06 anonymous read never leaks the internal run snapshot');
		let crossSchoolCode = '';
		try {
			await withDataContext(prisma, () => getPublishedSchedulePayload(schoolId + 777, schoolYearId));
		} catch (error) {
			crossSchoolCode = (error as { code?: string }).code ?? '';
		}
		checkEqual(crossSchoolCode, 'PUBLISHED_RUN_NOT_FOUND', 'G06 cross-school published read fails closed');

		// ── Gate 5: faculty sync never unpublishes or orphans the revision ──
		section('G05. routine faculty synchronization is non-destructive and audited');
		const beforeDriftRun = await prisma.generationRun.findUnique({ where: { id: runId }, select: { status: true, summary: true, version: true } });
		const beforeDriftSummary = beforeDriftRun?.summary as Record<string, unknown>;
		await prisma.facultyMirror.update({ where: { id: facultyId }, data: { isActiveForScheduling: false } });
		const invalidation = await invalidateStaleCompletedRuns(schoolId, schoolYearId);
		const afterDriftRun = await prisma.generationRun.findUnique({ where: { id: runId }, select: { status: true, summary: true, version: true } });
		const afterDriftSummary = afterDriftRun?.summary as Record<string, unknown>;
		checkEqual(afterDriftRun?.status, 'COMPLETED', 'G05 faculty sync never sets the published run to FAILED');
		checkEqual(afterDriftRun?.version, beforeDriftRun?.version, 'G05 published run version is preserved');
		checkEqual(afterDriftSummary?.isPublished, true, 'G05 faculty sync never unpublishes the run');
		checkEqual(afterDriftSummary?.publishedAt, beforeDriftSummary?.publishedAt, 'G05 publishedAt preserved through drift');
		checkEqual(afterDriftSummary?.publishedBy, beforeDriftSummary?.publishedBy, 'G05 publishedBy preserved through drift');
		check(!invalidation.unpublishedRunIds.includes(runId), 'G05 published run is excluded from the destructive path');
		check(invalidation.driftedPublishedRunIds.includes(runId), 'G05 published run records a typed drift marker');
		const driftAudit = await prisma.auditLog.count({ where: { schoolId, action: 'GENERATION_RUN_PUBLICATION_DRIFT_DETECTED', targetIds: { has: runId } } });
		checkEqual(driftAudit, 1, 'G05 drift is audited exactly once');
		const revisionIntact = await prisma.publishedScheduleRevision.count({ where: { id: revisionId, sourceRunId: runId, reason: 'INITIAL_PUBLICATION' } });
		checkEqual(revisionIntact, 1, 'G05 published revision is not orphaned');
		// Non-fatal: a mutant that restores the destructive unpublication makes
		// this read fail closed; that must be a named control FAIL, not an abort.
		let stillFrozenAfterSync: any = null;
		try { stillFrozenAfterSync = await read(); } catch (error) {
			check(false, `G05 published artifact is still readable after synchronization drift (error: ${(error as { code?: string }).code ?? 'error'})`);
		}
		if (stillFrozenAfterSync) {
			checkEqual(publicDigest(stillFrozenAfterSync), capturedPublic, 'G05 published artifact identity is unchanged after synchronization drift');
		}

		// ── Frozen snapshot consistency gate ──
		section('G01b. frozen snapshot consistency gate rejects contradictory publishes');
		const { assertSnapshotConsistency } = await import('../services/published-identity-snapshot.service.js');
		check(Boolean(frozenSnapshot), 'G01b snapshot available for the consistency control');
		let inconsistentCode = '';
		try {
			assertSnapshotConsistency({
				...frozenSnapshot!,
				displaySlots: frozenSnapshot!.displaySlots.map((slot) => (
					slot.kind === 'SPECIAL_EVENT' ? { ...slot, dayOfWeek: null } : slot
				)),
			} as any);
		} catch (error) {
			inconsistentCode = (error as { code?: string }).code ?? '';
		}
		checkEqual(inconsistentCode, 'PUBLICATION_SNAPSHOT_INCONSISTENT', 'G01b day-scoped event contradicted by a week-spanning slot is rejected');
		check(snapshotDigest(frozenSnapshot!).length > 0, 'G01b frozen snapshot digest is deterministic');

		// ── Gate 9: disposable database cleanup ──
		section('G09. disposable database cleanup');
		await prisma.$disconnect();
		disposable.drop();
		disposable.assertDropped();
		disposed = true;
		check(true, `G09 disposable database ${disposable.name} dropped and asserted absent`);

		if (configuredSourceUrl && configuredSourceUrl.startsWith('postgres')) {
			const { PrismaClient } = await import('@prisma/client');
			const sourceProbe = new PrismaClient({ datasourceUrl: configuredSourceUrl });
			try {
				const fixtureSchoolsInSource = await (sourceProbe as any).school.count({
					where: { name: { startsWith: 'PUBLISHED-IMMUTABILITY-C08 FIXTURE' } },
				});
				checkEqual(fixtureSchoolsInSource, 0, 'G09 zero C08 fixture residue in the configured source database');
			} finally {
				await sourceProbe.$disconnect();
			}
		}
	} finally {
		try { await prisma.$disconnect(); } catch { /* already disconnected */ }
		if (server) await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
		if (!disposed) {
			try { disposable.drop(); } catch { /* best effort */ }
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
