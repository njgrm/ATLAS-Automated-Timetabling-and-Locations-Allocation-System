/**
 * Canonical generation readiness diagnostic (GEN-C01).
 *
 * Read-only dry-run that assembles the SAME authoritative inputs and invokes
 * the SAME scheduling core as the live generation trigger, without ever
 * creating a `GenerationRun`, `LockedSession`, audit event, publication, or
 * source-data write.
 *
 * Reports:
 *  - canonical curriculum demand (persisted offerings + term config + scoped
 *    ownership) as the required-sessions-by-term baseline;
 *  - the production scheduler outcome (placed/unassigned, hard/soft
 *    violations by code, runtime, termination reason);
 *  - source revisions for curriculum, Teaching Load, policy, faculty,
 *    sections, rooms, and term config.
 *
 * Every persistence path is intentionally absent: no model create/update/
 * delete/upsert, no audit log, no notification publication.
 */

import { getDataContext } from '../lib/data-context.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import { validateHardConstraints, type Violation } from './constraint-validator.js';
import { assembleGenerationInputs, buildGenerationValidatorContext, type GenerationInputAssemblyOptions } from './generation-input-assembly.service.js';
import { ensureEntriesHaveTermIndex } from './generation.service.js';
import { buildCanonicalTimetableDemand, type TimetableDemandResult } from './timetable-demand.service.js';
import { computeGenerationInputSnapshot, type GenerationInputSnapshot } from './generation-input-snapshot.service.js';
import { getTermConfig } from './term-config.service.js';
import { DEFAULT_CONSTRAINT_CONFIG } from './scheduling-policy.service.js';

const db = () => getDataContext();

export type DiagnosticStatus = 'CANDIDATE_READY' | 'BLOCKED' | 'ERROR';

/** Read-only active-year resolution for the diagnostic (never syncs, never mutates). */
export async function resolveActiveSchoolYearForDiagnostic(schoolId: number): Promise<{
	activeSchoolYearId: number | null;
	ambiguous: boolean;
	missing: boolean;
}> {
	const mirrors = await db().enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		select: { enrollProSchoolYearId: true },
	});
	if (mirrors.length === 0) return { activeSchoolYearId: null, ambiguous: false, missing: true };
	if (mirrors.length > 1) return { activeSchoolYearId: null, ambiguous: true, missing: false };
	return { activeSchoolYearId: mirrors[0].enrollProSchoolYearId, ambiguous: false, missing: false };
}

export interface CanonicalGenerationDiagnosticResult {
	schemaVersion: 1;
	status: DiagnosticStatus;
	scope: { schoolId: number; schoolYearId: number };
	startedAtIso: string;
	finishedAtIso: string;
	runtimeMs: number;
	terminationReason: string;
	signals: {
		sectionsTotal: number;
		sectionsMissing: boolean;
		facultyCount: number;
		facultySubjectRows: number;
		roomsCount: number;
		activeSubjectCount: number;
		cohortCount: number;
		gradeWindowCount: number;
		specialEventCount: number;
		policyMissing: boolean;
		canonicalClassProgramSlotGroupCount: number;
		termConfigPresent: boolean;
	};
	canonicalDemand: {
		totalLines: number;
		totalSessions: number;
		totalsByTerm: Record<string, number>;
		ownerStateTotals: TimetableDemandResult['ownerStateTotals'];
		hgExcluded: TimetableDemandResult['hgExcluded'];
	};
	productionDemand: {
		totalLines: number;
		totalSessions: number;
	};
	demandAlignment: {
		aligned: boolean;
		canonicalSessions: number;
		productionSessions: number;
		deltaSessions: number;
	};
	scheduler: {
		classesProcessed: number;
		assignedCount: number;
		unassignedCount: number;
		policyBlockedCount: number;
		selectedSeedProfile: string;
		hybridEnabled: boolean;
		repairImpact: unknown;
		termCounts: { term1: number; term2: number; term3: number };
		placedSessions: number;
	};
	violations: {
		hardCount: number;
		softCount: number;
		totalCount: number;
		byCode: Record<string, number>;
		hardByCode: Record<string, number>;
		softByCode: Record<string, number>;
	};
	sourceRevisions: {
		inputSnapshot: GenerationInputSnapshot;
		canonical: TimetableDemandResult['sourceRevision'];
		termConfig: { id: number; termCount: number; termIdentities: string[]; isActive: boolean; updatedAt: string } | null;
	};
}

function buildViolationShape(violations: Violation[]): CanonicalGenerationDiagnosticResult['violations'] {
	const byCode: Record<string, number> = {};
	const hardByCode: Record<string, number> = {};
	const softByCode: Record<string, number> = {};
	for (const violation of violations) {
		byCode[violation.code] = (byCode[violation.code] ?? 0) + 1;
		if (violation.severity === 'HARD') hardByCode[violation.code] = (hardByCode[violation.code] ?? 0) + 1;
		else softByCode[violation.code] = (softByCode[violation.code] ?? 0) + 1;
	}
	const hardCount = violations.filter((violation) => violation.severity === 'HARD').length;
	const softCount = violations.length - hardCount;
	return {
		hardCount,
		softCount,
		totalCount: violations.length,
		byCode,
		hardByCode,
		softByCode,
	};
}

function termCountsFromEntries(entries: Array<{ termIndex?: 1 | 2 | 3 }>): { term1: number; term2: number; term3: number } {
	const counts = { term1: 0, term2: 0, term3: 0 };
	for (const entry of entries) {
		if (entry.termIndex === 2) counts.term2 += 1;
		else if (entry.termIndex === 3) counts.term3 += 1;
		else counts.term1 += 1;
	}
	return counts;
}

/**
 * Read-only canonical generation diagnostic for (schoolId, schoolYearId).
 * Assembles the same inputs and invokes the same scheduling core as the live
 * trigger. Never writes.
 */
export async function runCanonicalGenerationDiagnostic(
	schoolId: number,
	schoolYearId: number,
	options: GenerationInputAssemblyOptions = {},
): Promise<CanonicalGenerationDiagnosticResult> {
	const startedAt = Date.now();
	const startedAtIso = new Date().toISOString();
	const terminationReason: string[] = [];

	const activeYear = await resolveActiveSchoolYearForDiagnostic(schoolId);
	if (activeYear.ambiguous) terminationReason.push('ACTIVE_YEAR_AMBIGUOUS');
	if (activeYear.missing) terminationReason.push('ACTIVE_YEAR_MISSING');
	if (activeYear.activeSchoolYearId !== null && activeYear.activeSchoolYearId !== schoolYearId) {
		terminationReason.push(`ACTIVE_YEAR_MISMATCH: requested ${schoolYearId}, active ${activeYear.activeSchoolYearId}`);
	}

	const [assembled, canonical, termConfigRow, inputSnapshot] = await Promise.all([
		assembleGenerationInputs(schoolId, schoolYearId, { ...options, readOnly: true }),
		buildCanonicalTimetableDemand(schoolId, schoolYearId),
		getTermConfig(schoolId, schoolYearId),
		computeGenerationInputSnapshot(schoolId, schoolYearId),
	]);

	const canonicalDemand = {
		totalLines: canonical.totalLines,
		totalSessions: canonical.totalSessions,
		totalsByTerm: canonical.totalsByTerm,
		ownerStateTotals: canonical.ownerStateTotals,
		hgExcluded: canonical.hgExcluded,
	};
	const productionDemand = {
		totalLines: assembled.demand.length,
		totalSessions: assembled.demand.reduce((sum, item) => sum + item.sessionsPerWeek, 0),
	};
	const demandAligned = productionDemand.totalSessions === canonicalDemand.totalSessions;

	// Read-only preflight signals. Missing persisted readiness inputs are
	// reported honestly as gaps rather than seeded or invented.
	if (assembled.sectionsMissing) terminationReason.push('SECTIONS_MISSING');
	if (assembled.policyMissing) terminationReason.push('POLICY_MISSING');
	if (!termConfigRow) terminationReason.push('TERM_CONFIG_MISSING');
	if (assembled.gradeWindows.length === 0) terminationReason.push('GRADE_SHIFT_WINDOWS_MISSING');
	if (assembled.canonicalSlotsByGradeProgram.size === 0) terminationReason.push('CANONICAL_CLASS_PROGRAM_SLOTS_MISSING');
	if (!demandAligned) {
		terminationReason.push(
			`PRODUCTION_DEMAND_MISMATCH: production scheduler demand (${productionDemand.totalSessions}) does not equal canonical persisted-curriculum demand (${canonicalDemand.totalSessions})`,
		);
	}

	let scheduler: CanonicalGenerationDiagnosticResult['scheduler'] | null = null;
	let violations: CanonicalGenerationDiagnosticResult['violations'] = {
		hardCount: 0,
		softCount: 0,
		totalCount: 0,
		byCode: {},
		hardByCode: {},
		softByCode: {},
	};

	let status: DiagnosticStatus = 'CANDIDATE_READY';
	if (!assembled.sectionsMissing && !assembled.policyMissing && termConfigRow) {
		try {
			const result = runHybridScheduler(assembled.constructorInput);
			const entriesWithTerms = ensureEntriesHaveTermIndex(result.entries);

			const validatorCtx = buildGenerationValidatorContext({
				schoolId,
				schoolYearId,
				runId: 0,
				entries: entriesWithTerms,
				assembly: assembled,
				policyRecord: assembled.policyRecord!,
				constraintConfig: {
					...DEFAULT_CONSTRAINT_CONFIG,
					...(assembled.policyRecord?.constraintConfig as Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }> ?? {}),
				},
			});
			const validationResult = validateHardConstraints(validatorCtx);

			// Mirror the live generator's violation merge: modular warnings,
			// unassigned sessions, and zone imbalance are appended.
			const modularWarnings = result.modularWarnings ?? [];
			const modularWarningViolations: Violation[] = modularWarnings.map((warning) => ({
				code: warning.code,
				severity: 'SOFT',
				message: warning.message,
				schoolId,
				schoolYearId,
				runId: 0,
				entities: { sectionId: warning.sectionId, subjectId: warning.subjectId },
				meta: warning.meta,
			}));
			const unassignedViolations: Violation[] = result.unassignedItems.map((item) => ({
				code: item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE' ? 'SPECIALIZED_ROOM_UNAVAILABLE' : 'UNASSIGNED_SECTION',
				severity: item.roomAssignmentReason === 'SPECIALIZED_ROOM_UNAVAILABLE' ? 'SOFT' : 'HARD',
				message: `Section ${item.sectionId} subject ${item.subjectId} remained unassigned in session ${item.session}.`,
				schoolId,
				schoolYearId,
				runId: 0,
				entities: { sectionId: item.sectionId, subjectId: item.subjectId },
				meta: { reason: item.reason, roomAssignmentReason: item.roomAssignmentReason, session: item.session, gradeLevel: item.gradeLevel },
			}));
			const mergedViolations = [
				...validationResult.violations,
				...modularWarningViolations,
				...unassignedViolations,
			];
			violations = buildViolationShape(mergedViolations);

			scheduler = {
				classesProcessed: result.classesProcessed,
				assignedCount: result.assignedCount,
				unassignedCount: result.unassignedCount,
				policyBlockedCount: result.policyBlockedCount,
				selectedSeedProfile: result.selectedProfileId,
				hybridEnabled: result.hybridEnabled,
				repairImpact: result.repairImpact,
				termCounts: termCountsFromEntries(entriesWithTerms),
				placedSessions: result.assignedCount,
			};

			if (result.unassignedCount > 0) terminationReason.push(`UNASSIGNED_SESSIONS=${result.unassignedCount}`);
			if (violations.hardCount > 0) terminationReason.push(`HARD_VIOLATIONS=${violations.hardCount}`);
		} catch (error) {
			status = 'ERROR';
			terminationReason.push(`SCHEDULER_ERROR: ${error instanceof Error ? error.message : String(error)}`);
		}
	} else {
		status = 'BLOCKED';
	}

	if (status === 'CANDIDATE_READY') {
		// Zero hard violations + zero unassigned is the only candidate-ready path.
		if (violations.hardCount > 0 || (scheduler?.unassignedCount ?? 0) > 0) {
			status = 'BLOCKED';
		}
	}
	if (terminationReason.length > 0) status = 'BLOCKED';

	const finishedAtIso = new Date().toISOString();
	const result: CanonicalGenerationDiagnosticResult = {
		schemaVersion: 1,
		status,
		scope: { schoolId, schoolYearId },
		startedAtIso,
		finishedAtIso,
		runtimeMs: Date.now() - startedAt,
		terminationReason: terminationReason.join('; ') || 'OK',
		signals: {
			sectionsTotal: assembled.totalSections,
			sectionsMissing: assembled.sectionsMissing,
			facultyCount: assembled.faculty.length,
			facultySubjectRows: assembled.facultySubjectRows.length,
			roomsCount: assembled.rooms.length,
			activeSubjectCount: assembled.subjects.length,
			cohortCount: assembled.cohorts.length,
			gradeWindowCount: assembled.gradeWindows.length,
			specialEventCount: assembled.specialEvents.length,
			policyMissing: assembled.policyMissing,
			canonicalClassProgramSlotGroupCount: assembled.canonicalSlotsByGradeProgram.size,
			termConfigPresent: Boolean(termConfigRow),
		},
		canonicalDemand,
		productionDemand,
		demandAlignment: {
			aligned: demandAligned,
			canonicalSessions: canonicalDemand.totalSessions,
			productionSessions: productionDemand.totalSessions,
			deltaSessions: productionDemand.totalSessions - canonicalDemand.totalSessions,
		},
		scheduler: scheduler ?? {
			classesProcessed: 0,
			assignedCount: 0,
			unassignedCount: 0,
			policyBlockedCount: 0,
			selectedSeedProfile: 'NOT_RUN',
			hybridEnabled: false,
			repairImpact: null,
			termCounts: { term1: 0, term2: 0, term3: 0 },
			placedSessions: 0,
		},
		violations,
		sourceRevisions: {
			inputSnapshot,
			canonical: canonical.sourceRevision,
			termConfig: termConfigRow
				? {
						id: termConfigRow.id,
						termCount: termConfigRow.termCount,
						termIdentities: [...termConfigRow.termIdentities].sort((a, b) => a.localeCompare(b)),
						isActive: termConfigRow.isActive,
						updatedAt: termConfigRow.updatedAt.toISOString(),
					}
				: null,
		},
	};

	return result;
}

/** Compute a stable read-only database signature for before/after equality proof. */
export async function computeDatabaseSignature(schoolId: number, schoolYearId: number): Promise<{ sha256: string; probes: Record<string, string | number> }> {
	const [runCount, ownershipMax, fsMax, policyUpdated, sectionMax, roomMax, subjectMax, cycleVersion, offeringMax, windowCount, migrationCount] = await Promise.all([
		db().generationRun.count({ where: { schoolId, schoolYearId } }),
		db().subjectSectionOwnership.aggregate({ where: { schoolId, schoolYearId }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().facultySubject.aggregate({ where: { schoolId, schoolYearId }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().schedulingPolicy.findUnique({ where: { schoolId_schoolYearId: { schoolId, schoolYearId } }, select: { updatedAt: true } }),
		db().sectionMirror.aggregate({ where: { schoolId, schoolYearId }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().room.aggregate({ where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().subject.aggregate({ where: { schoolId, isActive: true }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().teachingLoadCycle.findUnique({ where: { schoolId_schoolYearId: { schoolId, schoolYearId } }, select: { version: true, updatedAt: true } }),
		db().schoolYearOffering.aggregate({ where: { schoolId, schoolYearId }, _max: { id: true, updatedAt: true }, _count: { _all: true } }),
		db().gradeShiftWindow.count({ where: { schoolId, schoolYearId } }),
		db().$queryRaw`SELECT count(*)::int AS n FROM _prisma_migrations`,
	]);
	const payload = {
		runCount,
		ownership: { count: ownershipMax._count._all, maxId: ownershipMax._max.id, maxUpdatedAt: ownershipMax._max.updatedAt?.toISOString() ?? null },
		facultySubject: { count: fsMax._count._all, maxId: fsMax._max.id, maxUpdatedAt: fsMax._max.updatedAt?.toISOString() ?? null },
		policyUpdatedAt: policyUpdated?.updatedAt?.toISOString() ?? null,
		sections: { count: sectionMax._count._all, maxId: sectionMax._max.id, maxUpdatedAt: sectionMax._max.updatedAt?.toISOString() ?? null },
		rooms: { count: roomMax._count._all, maxId: roomMax._max.id, maxUpdatedAt: roomMax._max.updatedAt?.toISOString() ?? null },
		subjects: { count: subjectMax._count._all, maxId: subjectMax._max.id, maxUpdatedAt: subjectMax._max.updatedAt?.toISOString() ?? null },
		cycle: { version: cycleVersion?.version ?? null, updatedAt: cycleVersion?.updatedAt?.toISOString() ?? null },
		offerings: { count: offeringMax._count._all, maxId: offeringMax._max.id, maxUpdatedAt: offeringMax._max.updatedAt?.toISOString() ?? null },
		gradeWindowCount: windowCount,
		migrationCount: (migrationCount as Array<{ n: number }>)?.[0]?.n ?? 0,
	};
	const canonicalJson = JSON.stringify(payload);
	const { createHash } = await import('node:crypto');
	const sha256 = createHash('sha256').update(canonicalJson).digest('hex');
	return { sha256, probes: payload as unknown as Record<string, string | number> };
}