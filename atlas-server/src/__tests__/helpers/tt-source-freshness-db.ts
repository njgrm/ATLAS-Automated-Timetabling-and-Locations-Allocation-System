/**
 * TT-SOURCE-FRESHNESS-C04 — shared disposable-PostgreSQL harness.
 *
 * Provisions a NEW guarded disposable database (never the configured
 * development/live-like database), applies the canonical schema only inside it,
 * and seeds the smallest canonical fixture that can execute the real generation
 * / quick-place / setup-sync services. Every suite that imports this helper is
 * responsible for dropping the database in `finally` and asserting zero residue.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export const PSQL = 'D:/PostgreSQL/18/bin/psql.exe';
const WORKDIR = process.cwd();
const RUNTIME_ENV = 'D:/ATLAS-runtime-config/atlas-server.env';

function readEnvValue(path: string, key: string): string | null {
	try {
		const text = readFileSync(path, 'utf8');
		const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
		if (!line) return null;
		return line.slice(key.length + 1).trim().replace(/^"|"$/g, '');
	} catch {
		return null;
	}
}

export function readSourceDatabaseUrl(): string | null {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	// Server tests normally read atlas-server/.env; the durable runtime env is a
	// documented fallback for a fresh worktree checkout without a local .env.
	return readEnvValue(`${WORKDIR}/.env`, 'DATABASE_URL') ?? readEnvValue(RUNTIME_ENV, 'DATABASE_URL');
}

export function isDisposableHarnessAvailable(): boolean {
	const source = readSourceDatabaseUrl();
	return Boolean(source) && source!.startsWith('postgres') && existsSync(PSQL);
}

export function psql(args: string[], env: NodeJS.ProcessEnv): string {
	return execFileSync(PSQL, args, { env, stdio: 'pipe' }).toString().trim();
}

export type DisposableDatabase = {
	name: string;
	targetUrl: string;
	adminEnv: NodeJS.ProcessEnv;
	source: URL;
	drop: () => void;
	assertDropped: () => void;
};

/**
 * Create (or replace) a guarded `atlas_restore_drill_YYYYMMDD_<suffix>` database
 * and apply the canonical schema. Returns `null` when no PostgreSQL URL exists,
 * so callers can `skip` safely.
 */
export function provisionDisposableDatabase(suffix: string): DisposableDatabase | null {
	const sourceUrl = readSourceDatabaseUrl();
	if (!sourceUrl || !sourceUrl.startsWith('postgres') || !existsSync(PSQL)) return null;
	const source = new URL(sourceUrl);
	const name = `atlas_restore_drill_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${suffix}${randomBytes(3).toString('hex')}`;
	if (!/^atlas_restore_drill_[0-9]{8}_[a-z0-9]+$/.test(name)) {
		throw new Error(`disposable database name must satisfy the repository guard: ${name}`);
	}
	if (name === source.pathname.replace(/^\//, '')) {
		throw new Error('disposable database must never target the configured database');
	}

	const adminEnv: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: decodeURIComponent(source.password) };
	const targetUrl = (() => {
		const copy = new URL(source.toString());
		copy.pathname = `/${name}`;
		return copy.toString();
	})();

	const service = (dbName: string, sql: string) =>
		psql(['-h', source.hostname, '-p', source.port || '5432', '-U', decodeURIComponent(source.username), '-d', dbName, '-tAc', sql], adminEnv);

	try {
		service('postgres', `DROP DATABASE ${name} WITH (FORCE)`);
	} catch {
		/* not present */
	}
	service('postgres', `CREATE DATABASE ${name}`);

	execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema=../prisma/schema.prisma'], {
		env: { ...process.env, DATABASE_URL: targetUrl },
		cwd: WORKDIR,
		stdio: 'pipe',
		shell: true,
	});

	return {
		name,
		targetUrl,
		adminEnv,
		source,
		drop: () => {
			try {
				service('postgres', `DROP DATABASE ${name} WITH (FORCE)`);
			} catch {
				/* best effort */
			}
		},
		assertDropped: () => {
			const count = service('postgres', `SELECT count(*) FROM pg_database WHERE datname = '${name}'`);
			if (count !== '0') throw new Error(`disposable database ${name} was not dropped (zero residue violation)`);
		},
	};
}

export type CanonicalFixture = {
	schoolId: number;
	schoolYearId: number;
	subjectIdByCode: Record<string, number>;
	facultyId: number;
	roomId: number;
	sectionExternalId: number;
};

/**
 * Seed the canonical minimal fixture used by the source-freshness suites: one
 * active school/year with a verified ordered three-term contract, grade-7
 * regular MATH/ENG demand, one section, one qualified faculty, one teaching
 * room, and one owner per subject/section pair.
 */
export async function seedCanonicalFixture(
	prisma: any,
	options: { schoolName?: string; schoolYearId?: number; sectionExternalId?: number } = {},
): Promise<CanonicalFixture> {
	const { getExpectedCanonicalSlots } = await import('../../services/class-program-slot.service.js');
	const schoolYearId = options.schoolYearId ?? 9_100_001;
	const sectionExternalId = options.sectionExternalId ?? 9_101;

	const school = await prisma.school.create({
		data: { name: options.schoolName ?? 'TT-SOURCE-FRESHNESS-DISPOSABLE — SAFE TO DELETE', shortName: 'TTSRC04' },
		select: { id: true },
	});
	const schoolId = school.id as number;

	await prisma.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: schoolYearId,
			yearLabel: '2026-2027',
			isActive: true,
			isArchived: false,
			termContractCache: {
				schoolId,
				schoolYear: { id: schoolYearId },
				format: 'TRIMESTER',
				terms: [
					{ identity: 'T1', displayLabel: 'First Trimester', order: 1 },
					{ identity: 'T2', displayLabel: 'Second Trimester', order: 2 },
					{ identity: 'T3', displayLabel: 'Third Trimester', order: 3 },
				],
			},
			termContractCachedAt: new Date(),
		},
	});
	await prisma.schedulingPolicy.create({
		data: { schoolId, schoolYearId, periodLengthMinutes: 60, periodsPerDay: 8, earliestStartTime: '07:00', latestEndTime: '17:00' },
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
		data: { schoolId, code: 'MATH', name: 'Mathematics', minMinutesPerWeek: 240, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true },
	});
	const eng = await prisma.subject.create({
		data: { schoolId, code: 'ENG', name: 'English', minMinutesPerWeek: 180, preferredRoomType: 'CLASSROOM' as const, gradeLevels: [7], programScopes: ['REGULAR' as const], isActive: true },
	});
	await prisma.sectionMirror.create({
		data: { externalId: sectionExternalId, schoolId, schoolYearId, name: '7-A', gradeLevelId: 17, gradeLevelName: 'Grade 7', displayOrder: 7, maxCapacity: 50, enrolledCount: 40, programType: 'REGULAR', isActiveForScheduling: true, isStale: false },
	});
	// A section snapshot is what manual-edit/quick-place qualification scope
	// normalization reads; without it the roster index is empty and every
	// retained assignment looks unqualified. Seed the minimal SectionsByGrade
	// payload for the fixture section.
	await prisma.sectionSnapshot.create({
		data: {
			schoolId,
			schoolYearId,
			payload: [{
				gradeLevelId: 17,
				gradeLevelName: 'Grade 7',
				displayOrder: 7,
				sections: [{
					id: sectionExternalId,
					name: '7-A',
					displayOrder: 7,
					gradeLevelId: 17,
					gradeLevelName: 'Grade 7',
					maxCapacity: 50,
					enrolledCount: 40,
					programType: 'REGULAR',
				}],
			}],
		},
	});
	const faculty = await prisma.facultyMirror.create({
		data: { externalId: 710, schoolId, firstName: 'A', lastName: 'Teacher', department: 'REGULAR', maxHoursPerWeek: 30, isActiveForScheduling: true, isStale: false },
	});
	for (const subject of [math, eng]) {
		const fs = await prisma.facultySubject.create({
			data: { facultyId: faculty.id, subjectId: subject.id, schoolId, schoolYearId, gradeLevels: [7], sectionIds: [sectionExternalId], assignedBy: 1 },
		});
		await prisma.subjectSectionOwnership.create({
			data: { schoolId, schoolYearId, facultySubjectId: fs.id, facultyId: faculty.id, subjectId: subject.id, sectionId: sectionExternalId },
		});
	}

	return {
		schoolId,
		schoolYearId,
		subjectIdByCode: { MATH: math.id, ENG: eng.id },
		facultyId: faculty.id,
		roomId: room.id,
		sectionExternalId,
	};
}

/** FK-safe teardown of a seeded canonical fixture (run before dropping the DB). */
export async function teardownCanonicalFixture(prisma: any, schoolId: number): Promise<void> {
	await prisma.manualScheduleEdit.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.generationRun.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.auditLog.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.subjectSectionOwnership.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.facultySubject.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.facultyMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.sectionMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.sectionSnapshot.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.room.deleteMany({ where: { building: { schoolId } } }).catch(() => undefined);
	await prisma.building.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.classProgramSlot.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.classTemplate.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.schedulingPolicy.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } }).catch(() => undefined);
	await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => undefined);
}
