/**
 * A6-TL-DEMAND-SOURCE-C01 — Teaching Load must read the ONE canonical demand
 * pair universe that generation readiness reads.
 *
 * The defect (operator-confirmed live, 2026-09-30): the Teaching Load header read
 * `100% staffed` while generation readiness saw 4 AP gaps. Three server sites
 * re-derived their own `subject × section` universe from the SectionMirror's
 * `displayOrder`, while `buildDerivedDemand` reads the EnrollPro grade NAME
 * (`resolveSectionGradeLevel`). Wherever the two differ, Teaching Load silently
 * omits a pair readiness requires.
 *
 * This suite is FAILING-FIRST. On the base commit the fixture below makes
 * `getAssignmentSummary.coverageTotals.totalPairs` exclude the AP pair (and the
 * derived `% staffed` read 100) while `buildDerivedDemand` /
 * `summarizeTeachingLoadCoverage` require it with `missingPairs >= 1`.
 *
 * Fixture shape (deterministic, minimal):
 * - one active, non-archived year with a verified 3-term contract + policy row;
 * - ONE section named "Grade 9" whose mirror `displayOrder` is 12 (NOT 9);
 * - `REG` with `gradeLevels [9, 12]` — matches on BOTH authorities;
 * - `AP` with `gradeLevels [9]` — matches the grade NAME only, never
 *   `displayOrder = 12`; no ownership row, so readiness sees it open;
 * - only `REG:section` is owned, so the base figure is exactly 100.
 *
 * Disposable database only (AGENTS.md §5/§13): the runner
 * (`npm run test:server-db`) gives each file its own
 * `atlas_restore_drill_<yyyymmdd>_<suffix>` database and drops it. The suite
 * fails closed before the first write when `DATABASE_URL` is not disposable.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireDisposableDatabase } from './helpers/disposable-database-guard.js';

requireDisposableDatabase('a6-tl-demand-source-c01.test.ts');

let passCount = 0;
let failCount = 0;

function section(title: string) {
	console.log(`\n=== ${title} ===`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`[PASS] ${label}`);
		return;
	}
	failCount += 1;
	console.error(`[FAIL] ${label}`);
}

function loadServerEnv() {
	const here = dirname(fileURLToPath(import.meta.url));
	try {
		const content = readFileSync(resolve(here, '../../.env'), 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eq = trimmed.indexOf('=');
			if (eq < 0) continue;
			const key = trimmed.slice(0, eq).trim();
			const value = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) process.env[key] = value;
		}
	} catch {}
}

const WRITE_ACTIONS = new Set([
	'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany',
	'executeRaw', 'queryRaw',
]);

async function main() {
	loadServerEnv();
	if (!process.env.DATABASE_URL) {
		console.error('[FAIL] DATABASE_URL is unavailable; cannot run the A6 TL demand-source test.');
		process.exit(1);
	}

	const prismaModule = (await import('../lib/prisma.js')) as any;
	const dataContext = (await import('../lib/data-context.js')) as any;
	const assignmentService = (await import('../services/faculty-assignment.service.js')) as any;
	const derivedDemand = (await import('../services/derived-demand.service.js')) as any;
	const preflight = (await import('../services/generation-preflight.service.js')) as any;

	const base = (prismaModule as any).createTestPrismaClient();
	const recorded: Array<{ model?: string; action: string }> = [];
	const instrumented = base.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }: any) {
					recorded.push({ model, action: operation });
					return query(args);
				},
			},
		},
	});

	// ─── Fixture ────────────────────────────────────────────────────────────
	const school = await instrumented.school.create({
		data: { name: 'A6-TL-DEMAND FIXTURE — SAFE TO DELETE', shortName: 'A6TLDEM' },
		select: { id: true },
	});
	const schoolId = school.id as number;
	const schoolYearId = 9077;

	await instrumented.enrollProSchoolYearMirror.create({
		data: {
			schoolId,
			enrollProSchoolYearId: schoolYearId,
			yearLabel: '2030-2031',
			isActive: true,
			isArchived: false,
			syncStatus: 'synced',
			termContractCache: {
				schoolId,
				schoolYear: { id: schoolYearId, yearLabel: '2030-2031' },
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
	await instrumented.schedulingPolicy.create({ data: { schoolId, schoolYearId } });

	// The grade NAME says Grade 9; the mirror's displayOrder is deliberately 12
	// so the two authorities disagree.
	const sectionExternalId = 4120;
	await instrumented.sectionMirror.create({
		data: {
			externalId: sectionExternalId,
			schoolId,
			schoolYearId,
			name: 'Mabini',
			gradeLevelId: 22,
			gradeLevelName: 'Grade 9',
			displayOrder: 12,
			maxCapacity: 50,
			enrolledCount: 40,
			programType: 'REGULAR',
			isActiveForScheduling: true,
			isStale: false,
		},
	});

	const reg = await instrumented.subject.create({
		data: {
			schoolId, code: 'REG9', name: 'Regular Subject', minMinutesPerWeek: 240,
			gradeLevels: [9, 12], programScopes: ['REGULAR'],
			schedulingDisposition: 'SCHEDULED_TEACHING', isActive: true,
		},
		select: { id: true },
	});
	const ap = await instrumented.subject.create({
		data: {
			schoolId, code: 'AP', name: 'Advanced Placement Subject', minMinutesPerWeek: 240,
			gradeLevels: [9], programScopes: ['REGULAR'],
			schedulingDisposition: 'SCHEDULED_TEACHING', isActive: true,
		},
		select: { id: true },
	});
	const apId = ap.id as number;
	const regId = reg.id as number;

	const faculty = await instrumented.facultyMirror.create({
		data: {
			externalId: 7001, schoolId, firstName: 'Real', lastName: 'Teacher',
			department: 'Science', isActiveForScheduling: true, isStale: false, isPlaceholder: false,
		},
		select: { id: true },
	});
	const facultyId = faculty.id as number;

	const facultySubject = await instrumented.facultySubject.create({
		data: { facultyId, subjectId: regId, schoolId, schoolYearId, gradeLevels: [9, 12], sectionIds: [sectionExternalId], assignedBy: 1 },
		select: { id: true },
	});
	await instrumented.subjectSectionOwnership.create({
		data: {
			schoolId, schoolYearId, facultySubjectId: facultySubject.id as number,
			facultyId, subjectId: regId, sectionId: sectionExternalId,
		},
	});

	// ─── Readiness (the parity target) ───────────────────────────────────────
	const derived = await dataContext.withDataContext(instrumented, () =>
		(derivedDemand as any).buildDerivedDemand(schoolId, schoolYearId),
	);
	assert(derived?.ok === true, 'canonical derived demand resolves on the fixture');
	if (!derived?.ok) {
		console.log(`\nTotal: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
		process.exit(1);
	}
	const ownershipBySubjectSection = new Map<string, any[]>();
	ownershipBySubjectSection.set(`${regId}:${sectionExternalId}`, [
		{ subjectId: regId, sectionId: sectionExternalId, facultyId },
	]);
	const facultyById = new Map<number, { isActiveForScheduling: boolean; isStale: boolean; isPlaceholder?: boolean }>();
	facultyById.set(facultyId, { isActiveForScheduling: true, isStale: false, isPlaceholder: false });
	const scopeByFacultySubject = new Map<string, any>();
	scopeByFacultySubject.set(`${facultyId}:${regId}`, { facultyId, subjectId: regId, sectionIds: [sectionExternalId], gradeLevels: [9, 12] });
	const readinessCoverage = (preflight as any).summarizeTeachingLoadCoverage(
		derived, ownershipBySubjectSection, facultyById, scopeByFacultySubject,
	);
	const requiredPairs = readinessCoverage.requiredPairs as number;
	const missingPairs = readinessCoverage.missingPairs as number;
	const canonicalHasApPair = derived.teachingLoadPairs.some(
		(pair: any) => pair.subjectId === apId && pair.sectionExternalId === sectionExternalId,
	);

	section('readiness (the authority)');
	console.log(`[INFO] canonical requiredPairs=${requiredPairs} missingPairs=${missingPairs} hasApPair=${canonicalHasApPair}`);
	assert(requiredPairs === 2, `readiness requires both pairs (got ${requiredPairs})`);
	assert(canonicalHasApPair, 'canonical derived demand includes the AP : section pair');
	assert(missingPairs >= 1, `readiness reports at least one missing pair (got ${missingPairs})`);

	section('pure unit row: canonical pair mapping');
	const mapper = (derivedDemand as any).toTeachingLoadDemandPairs;
	assert(typeof mapper === 'function', 'canonical pair mapper is exported');
	if (typeof mapper === 'function') {
		const purePairs = mapper(derived) as Array<any>;
		assert(purePairs.length === requiredPairs, `pure mapping preserves totalPairs (${purePairs.length} === ${requiredPairs})`);
		assert(
			purePairs.some((pair) => pair.subjectId === apId && pair.sectionId === sectionExternalId),
			'pure mapping keeps the AP pair, keyed subjectId:sectionId',
		);
	}

	// ─── Teaching Load (the divergence) ──────────────────────────────────────
	section('Teaching Load reads the canonical universe');
	recorded.length = 0;
	const summary = await dataContext.withDataContext(instrumented, () =>
		(assignmentService as any).getAssignmentSummary(schoolId, schoolYearId),
	);
	const coverage = await dataContext.withDataContext(instrumented, () =>
		(assignmentService as any).getActiveSubjectCoverageSummary(schoolId, schoolYearId),
	);

	const totalPairs = summary.coverageTotals.totalPairs as number;
	const realPairs = summary.coverageTotals.realFacultyAssignedPairs as number;
	const staffedPercent = totalPairs > 0 ? Math.round((realPairs / totalPairs) * 100) : 0;
	console.log(`[INFO] TL totalPairs=${totalPairs} realPairs=${realPairs} staffedPercent=${staffedPercent}`);
	console.log(`[INFO] TL demandReady=${summary.coverageTotals.teachingLoadDemandReady} demandRevision=${summary.coverageTotals.teachingLoadDemandRevision ?? 'null'}`);

	// R2 (the single-source parity row): TL's denominator IS readiness's required set.
	assert(
		totalPairs === requiredPairs,
		`TL totalPairs equals readiness requiredPairs (${totalPairs} === ${requiredPairs})`,
	);
	// R1: never `100% staffed` while a required pair is missing.
	assert(
		!(staffedPercent === 100 && missingPairs > 0),
		`TL does not report 100% while readiness reports ${missingPairs} missing pair(s) (staffedPercent=${staffedPercent})`,
	);
	assert(summary.coverageTotals.teachingLoadDemandReady === true, 'TL summary reports canonical demand ready');

	// R3: the AP pair is a candidate / uncovered row in the suggestion coverage.
	const apRow = (coverage.rows as any[]).find((row) => row.subjectId === apId);
	assert(apRow != null, 'suggestion coverage contains an AP row');
	if (apRow) {
		console.log(`[INFO] AP relevantSectionCount=${apRow.relevantSectionCount} uncoveredSectionCount=${apRow.uncoveredSectionCount}`);
		assert(apRow.relevantSectionCount === 1, `AP row relevantSectionCount is 1 (got ${apRow.relevantSectionCount})`);
		assert(apRow.uncoveredSectionCount === 1, `AP row uncoveredSectionCount is 1 (got ${apRow.uncoveredSectionCount})`);
		assert(
			(apRow.uncoveredSections as any[]).some((section) => section.sectionId === sectionExternalId),
			'AP uncovered row names the section',
		);
	}

	// R8: the read path performs zero writes.
	const writes = recorded.filter((stmt) => WRITE_ACTIONS.has(stmt.action));
	assert(
		writes.length === 0,
		`TL read path performs zero Prisma writes (observed ${JSON.stringify(writes.slice(0, 5))})`,
	);
	assert(recorded.length > 0, `TL read path performed reads (${recorded.length} statements observed)`);

	// ─── R4: fail closed when canonical demand is unavailable ────────────────
	section('fail closed when canonical demand is unavailable');
	await instrumented.enrollProSchoolYearMirror.updateMany({
		where: { schoolId, enrollProSchoolYearId: schoolYearId },
		data: { termContractCache: null as any, termContractCachedAt: null },
	});
	const blockedSummary = await dataContext.withDataContext(instrumented, () =>
		(assignmentService as any).getAssignmentSummary(schoolId, schoolYearId),
	);
	console.log(`[INFO] blocked demandReady=${blockedSummary.coverageTotals.teachingLoadDemandReady} blockers=${(blockedSummary.coverageTotals.teachingLoadDemandBlockers ?? []).map((b: any) => b.code).join(',')}`);
	assert(
		blockedSummary.coverageTotals.teachingLoadDemandReady === false,
		'unavailable canonical demand yields a typed not-ready status',
	);
	assert(
		Array.isArray(blockedSummary.coverageTotals.teachingLoadDemandBlockers)
			&& blockedSummary.coverageTotals.teachingLoadDemandBlockers.length > 0,
		'not-ready summary carries the typed blockers',
	);

	// ─── Teardown: zero residue ──────────────────────────────────────────────
	const cleanup = (prismaModule as any).createTestPrismaClient();
	try {
		await cleanup.subjectSectionOwnership.deleteMany({ where: { schoolId } });
		await cleanup.facultySubject.deleteMany({ where: { schoolId } });
		await cleanup.facultyMirror.deleteMany({ where: { schoolId } });
		await cleanup.subject.deleteMany({ where: { schoolId } });
		await cleanup.sectionMirror.deleteMany({ where: { schoolId } });
		await cleanup.schedulingPolicy.deleteMany({ where: { schoolId } });
		await cleanup.enrollProSchoolYearMirror.deleteMany({ where: { schoolId } });
		await cleanup.school.deleteMany({ where: { id: schoolId } });
		const residue =
			(await cleanup.subjectSectionOwnership.count({ where: { schoolId } }))
			+ (await cleanup.facultySubject.count({ where: { schoolId } }))
			+ (await cleanup.facultyMirror.count({ where: { schoolId } }))
			+ (await cleanup.subject.count({ where: { schoolId } }))
			+ (await cleanup.sectionMirror.count({ where: { schoolId } }))
			+ (await cleanup.schedulingPolicy.count({ where: { schoolId } }))
			+ (await cleanup.enrollProSchoolYearMirror.count({ where: { schoolId } }))
			+ (await cleanup.school.count({ where: { id: schoolId } }));
		assert(residue === 0, `zero residue across all fixture-scoped models (found ${residue})`);
	} finally {
		await cleanup.$disconnect();
	}

	await base.$disconnect();

	console.log(`\n=== A6 TL demand-source C01 ===`);
	console.log(`Total: ${passCount + failCount}, Passed: ${passCount}, Failed: ${failCount}`);
	if (failCount > 0) process.exit(1);
}

main().catch((error) => {
	console.error(`[FAIL] A6 TL demand-source test crashed: ${String(error?.message ?? error).slice(0, 300)}`);
	process.exit(1);
});
