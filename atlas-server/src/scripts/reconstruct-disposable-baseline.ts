/**
 * 05A disposable clean-rebuild reconstruction (DBR-05A.3), 05AR-corrected.
 * Truthful EMPTY-cycle baseline: never fabricates FacultySubject or
 * SubjectSectionOwnership rows (see DBR-05AR.1).
 *
 * Narrow, idempotent reconstruction entry point for ONE guarded disposable
 * target only. Every step is create-missing-only / upsert / guarded-once:
 * a second pass must not modify operator-owned data.
 *
 * Guarded target: atlas_recovery_clean_rebuild_20260905 (primary only).
 * Refuses atlas_db, atlas_recovery_cutover_candidate, shadow/secondary
 * targets, and any unknown database. Never runs root prisma/seed.js,
 * never uses schema-push / reset / destructive map reset, never writes
 * migration-history tables, never runs generation.
 *
 * Usage (from atlas-server, .env file untouched):
 *   $env:DATABASE_URL="postgresql://<user>:<pass>@localhost:5432/atlas_recovery_clean_rebuild_20260905?schema=public"
 *   npx tsx src/scripts/reconstruct-disposable-baseline.ts
 */
import { prisma } from '../lib/prisma.js';
import { fetchEnrollProActiveSchoolYear } from '../services/section-adapter.js';
import { syncFacultyFromExternal } from '../services/faculty.service.js';
import { syncSectionsFromExternal } from '../services/section.service.js';
import { syncCohorts } from '../services/cohort.service.js';
import { ensureDefaultSubjects } from '../services/subject.service.js';
import { seedCampusMap } from '../services/disposable-campus-fixture.service.js';
import { seedLocalAuthAccounts } from '../services/local-auth.service.js';
import { ensureTeachingLoadCycle } from '../services/teaching-load-cycle.service.js';
import {
	assertGuardedPrimaryTarget,
	targetDbNameFromUrl,
} from '../services/disposable-reconstruction-guard.service.js';

const REJECTED_SOURCES = new Set(['stub', 'auto-fallback', 'preserved-existing']);

// Same repository-reviewed alias coverage as seed-specialization-aliases.ts,
// parameterized by school instead of hardcoded to 1.
const ALIAS_MAPPINGS: Array<{ alias: string; canonical: string }> = [
	{ alias: 'Filipino', canonical: 'FIL' },
	{ alias: 'English', canonical: 'ENG' },
	{ alias: 'Mathematics', canonical: 'MATH' },
	{ alias: 'Science', canonical: 'SCI' },
	{ alias: 'Araling Panlipunan', canonical: 'AP' },
	{ alias: 'MAPEH', canonical: 'MAPEH' },
	{ alias: 'Edukasyon sa Pagpapakatao', canonical: 'ESP' },
	{ alias: 'Technology and Livelihood Education', canonical: 'TLE' },
	{ alias: 'Homeroom Guidance', canonical: 'HG' },
	{ alias: 'Languages', canonical: 'ENG' },
	{ alias: 'Social Studies', canonical: 'AP' },
	{ alias: 'Values', canonical: 'ESP' },
	{ alias: 'Guidance', canonical: 'HG' },
];

function targetDbName(): string {
	return targetDbNameFromUrl(process.env.DATABASE_URL ?? '');
}

function resolveServiceToken(): string {
	const token = process.env.ENROLLPRO_SERVICE_TOKEN;
	if (!token) throw new Error('UPSTREAM_UNAVAILABLE: ENROLLPRO_SERVICE_TOKEN is not configured');
	return token;
}

async function fetchPublicSchoolName(): Promise<string> {
	const base = (process.env.ENROLLPRO_API ?? '').replace(/\/$/, '');
	const res = await fetch(`${base}/settings/public`);
	if (!res.ok) throw new Error(`UPSTREAM_UNAVAILABLE: public settings responded ${res.status}`);
	const body = (await res.json()) as { schoolName?: string };
	if (!body.schoolName) throw new Error('UPSTREAM_UNAVAILABLE: public settings carry no schoolName');
	return body.schoolName;
}

function deriveShortName(schoolName: string): string {
	const initials = schoolName
		.split(/\s+/)
		.filter((w) => /^[A-Za-z]/.test(w))
		.map((w) => w[0]!.toUpperCase())
		.join('')
		.slice(0, 10);
	return initials || 'SCHOOL';
}

async function main() {
	const target = targetDbName();
	assertGuardedPrimaryTarget(target);
	console.log(`[reconstruct] Guard passed: target=${target}`);

	// 0. Upstream preflight BEFORE any write (read-only, fail-closed).
	const serviceToken = resolveServiceToken();
	const upstreamYear = await fetchEnrollProActiveSchoolYear(serviceToken);
	if (!upstreamYear) throw new Error('UPSTREAM_UNAVAILABLE: EnrollPro active school year is unreachable');
	const upstreamSchoolName = await fetchPublicSchoolName();
	const localYearId = upstreamYear.id; // runtime-observed, never hardcoded
	console.log(`[reconstruct] Upstream: school="${upstreamSchoolName}" year=${upstreamYear.id} (${upstreamYear.yearLabel})`);

	// 1. Explicit local school identity (find-or-create; never recreated).
	let school = await prisma.school.findFirst({ orderBy: { id: 'asc' } });
	if (!school) {
		school = await prisma.school.create({
			data: { name: upstreamSchoolName, shortName: deriveShortName(upstreamSchoolName) },
		});
		console.log(`[reconstruct] School created: id=${school.id} name="${school.name}"`);
	} else {
		console.log(`[reconstruct] School exists: id=${school.id} name="${school.name}" (preserved)`);
	}
	const schoolId = school.id;

	// 2. Explicit local-to-EnrollPro year mapping (upsert by stable external key).
	const mirror = await prisma.enrollProSchoolYearMirror.upsert({
		where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: upstreamYear.id } },
		update: { yearLabel: upstreamYear.yearLabel, isActive: true, lastVerifiedAt: new Date(), lastSyncedAt: new Date(), syncStatus: 'synced', sourceEndpoint: '/api/integration/v1/school-year' },
		create: { schoolId, enrollProSchoolYearId: upstreamYear.id, yearLabel: upstreamYear.yearLabel, isActive: true, lastVerifiedAt: new Date(), lastSyncedAt: new Date(), syncStatus: 'synced', sourceEndpoint: '/api/integration/v1/school-year' },
	});
	console.log(`[reconstruct] Year mirror: localYear=${localYearId} upstream=${mirror.enrollProSchoolYearId} (${mirror.yearLabel})`);

	// 3. Subject catalog proposals FIRST (create-missing-only; never overwrites
	//    operator fields). The catalog must exist before assignment derivation.
	await ensureDefaultSubjects(schoolId);
	console.log('[reconstruct] Subjects: ensureDefaultSubjects applied (create-missing-only)');

	// 4. EnrollPro-owned faculty mirrors (mirror reconcile ONLY: assignment
	//    seeding/pruning and advisory ownership are disabled here so
	//    reconstruction never manufactures Teaching Load rows (05AR: EMPTY
	//    cycle is the honest baseline; operator setup follows cutover).
	//    This keeps the second pass a provable no-op. Full reconcile
	//    side-effects remain production behavior for live rollover,
	//    out of 05A scope.)
	const facultyResult = await syncFacultyFromExternal(schoolId, localYearId, serviceToken, {
		seedAssignments: false,
		pruneSectionAssignments: false,
		syncAdvisoryAssignments: false,
		invalidateRuns: false,
	});
	if (REJECTED_SOURCES.has(facultyResult.source)) {
		throw new Error(`UPSTREAM_UNAVAILABLE: faculty source "${facultyResult.source}" is not EnrollPro authority`);
	}
	console.log(`[reconstruct] Faculty: source=${facultyResult.source} active=${facultyResult.activeCount}`);

	// 5. EnrollPro-owned section mirrors (direct external sync; fail-closed on error).
	const sectionResult = await syncSectionsFromExternal(schoolId, localYearId, serviceToken);
	console.log(`[reconstruct] Sections: synced=${sectionResult.synced} count=${sectionResult.count} removed=${sectionResult.removed} skipped=${sectionResult.skipped}`);

	// 6. Instructional cohorts from upstream.
	const cohortResult = await syncCohorts(schoolId, localYearId, serviceToken);
	console.log(`[reconstruct] Cohorts: ${JSON.stringify(cohortResult)}`);

	// 7. Additive test campus fixtures (resetMap=false: preserves intervening CRUD).
	const mapSummary = await seedCampusMap(schoolId, false);
	console.log(`[reconstruct] Campus: buildings +${mapSummary.buildingsCreated}/matched ${mapSummary.buildingsMatched}, rooms +${mapSummary.roomsCreated}/matched ${mapSummary.roomsMatched}`);

	// 8. Specialization aliases (upsert by stable natural key).
	let aliasesCreated = 0;
	for (const mapping of ALIAS_MAPPINGS) {
		const subject = await prisma.subject.findFirst({ where: { schoolId, code: mapping.canonical } });
		if (!subject) continue;
		const existing = await prisma.specializationAlias.findUnique({
			where: { schoolId_canonical_alias: { schoolId, canonical: mapping.canonical, alias: mapping.alias } },
		});
		if (!existing) {
			await prisma.specializationAlias.create({ data: { schoolId, alias: mapping.alias, canonical: mapping.canonical } });
			aliasesCreated++;
		}
	}
	console.log(`[reconstruct] Aliases: +${aliasesCreated} created (upsert-stable)`);

	// 9. Local auth accounts derived from reconstructed identities (upsert; idempotent).
	const authSeed = await seedLocalAuthAccounts({ schoolId });
	console.log(`[reconstruct] Auth: ${authSeed.created} created, ${authSeed.updated} updated`);

	// 10. Provenance-approved scheduling policy default (create-once; never overwrites).
	const existingPolicy = await prisma.schedulingPolicy.findFirst({ where: { schoolId, schoolYearId: localYearId } });
	if (!existingPolicy) {
		await prisma.schedulingPolicy.create({ data: { schoolId, schoolYearId: localYearId } });
		console.log('[reconstruct] Policy: default row created (schema defaults, operator-review-pending)');
	} else {
		console.log('[reconstruct] Policy: existing row preserved (operator-owned)');
	}

	// 11. Truthful EMPTY Teaching Load cycle through the canonical cycle
	//     service (05AR correction). Reconstruction never manufactures
	//     FacultySubject or SubjectSectionOwnership rows: operator Teaching
	//     Load setup after cutover is honestly pending. Fail closed if any
	//     assignment or ownership rows exist.
	const cycle = await ensureTeachingLoadCycle(schoolId, localYearId);
	console.log(`[reconstruct] TeachingLoadCycle: state=${cycle.state} version=${cycle.version}`);
	const ownershipCount = await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId: localYearId } });
	const facultySubjectCount = await prisma.facultySubject.count({ where: { schoolId, schoolYearId: localYearId } });
	if (ownershipCount !== 0 || facultySubjectCount !== 0) {
		throw new Error(
			`RECONSTRUCT: unexpected Teaching Load assignment rows (ownership=${ownershipCount} facultySubject=${facultySubjectCount}); refusing speculative baseline`,
		);
	}
	if (cycle.state !== 'EMPTY') {
		throw new Error(`RECONSTRUCT: Teaching Load cycle must be EMPTY, found ${cycle.state}`);
	}

	// 12. Domain census (observed values for this test baseline only, never business rules).
	const census = {
		target,
		schoolId,
		localYearId,
		upstreamYearId: upstreamYear.id,
		upstreamYearLabel: upstreamYear.yearLabel,
		schools: await prisma.school.count(),
		yearMirrors: await prisma.enrollProSchoolYearMirror.count({ where: { schoolId } }),
		facultyMirrors: await prisma.facultyMirror.count({ where: { schoolId } }),
		sectionMirrors: await prisma.sectionMirror.count({ where: { schoolId, schoolYearId: localYearId } }),
		subjects: await prisma.subject.count({ where: { schoolId } }),
		facultySubjects: await prisma.facultySubject.count({ where: { schoolId, schoolYearId: localYearId } }),
		ownerships: await prisma.subjectSectionOwnership.count({ where: { schoolId, schoolYearId: localYearId } }),
		cycles: await prisma.teachingLoadCycle.count({ where: { schoolId, schoolYearId: localYearId } }),
		cohorts: await prisma.instructionalCohort.count({ where: { schoolId, schoolYearId: localYearId } }),
		buildings: await prisma.building.count({ where: { schoolId } }),
		rooms: await prisma.room.count({ where: { building: { schoolId } } }),
		authAccounts: await prisma.atlasAuthAccount.count({ where: { schoolId } }),
		policies: await prisma.schedulingPolicy.count({ where: { schoolId, schoolYearId: localYearId } }),
		aliases: await prisma.specializationAlias.count({ where: { schoolId } }),
	};
	console.log(`[reconstruct] CENSUS ${JSON.stringify(census)}`);
}

main()
	.catch((error) => {
		console.error('[reconstruct] Failed:', error instanceof Error ? error.message : error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
