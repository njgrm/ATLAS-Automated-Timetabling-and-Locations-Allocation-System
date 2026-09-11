/**
 * GEN-C02 — Canonical generation readiness / zero-write dry run.
 *
 * GEN-C02R1 F1: the authoritative input assembly now lives in the shared
 * read-only `generation-preflight.service.ts` and is consumed verbatim by both
 * this readiness dry run and the real `triggerGenerationRun()` entry point.
 * Readiness adds only the scheduler dry run, generic validator, canonical shape
 * validation, and the before/after zero-write signature.
 *
 * It NEVER creates runs, drafts, locks, audits, cycles, assignments, revisions,
 * snapshots, or notifications.
 */

import { createHash } from 'node:crypto';

import { getDataContext, withDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import { validateHardConstraints, type ScheduledEntry } from './constraint-validator.js';
import { runHybridScheduler } from './hybrid-scheduler.js';
import {
	buildGenerationPreflight,
	buildPreflightConstructorInput,
	buildPreflightValidatorContext,
	buildSectionScopeMap,
	classifyUnassignedBlocker,
	computePreflightRevisions,
	sortPreflightBlockers,
	STAKEHOLDER_DECISION_NOTES,
	validateCanonicalEntryShapes,
	summarizePreflightParity,
	type GenerationBlockerCategory,
	type GenerationPreflightBlocker,
	type GenerationPreflightAssembly,
	type GenerationPreflightDependencies,
	type GenerationPreflightResult,
	type GenerationPreflightRetained,
	type GenerationPreflightTeachingLoadCoverage,
} from './generation-preflight.service.js';
import type { CanonicalTemplateCoverage } from './class-program-slot.service.js';
import type { DerivedDemandBlocker } from './derived-demand.service.js';
import type { DraftConsumeRejection } from './pre-generation-draft.service.js';

const db = () => getDataContext();

export type GenerationReadinessBlockerCategory = GenerationBlockerCategory;
export type GenerationReadinessBlocker = GenerationPreflightBlocker;
export type GenerationReadinessDependencies = GenerationPreflightDependencies;

export interface GenerationReadinessDatabaseSignature {
	generationRunCount: number;
	generationRunMaxId: number | null;
	lockedSessionCount: number;
	lockedSessionMaxUpdatedAt: string | null;
	lockedSessionActionCount: number;
	auditLogCount: number;
	teachingLoadCycleVersions: number[];
	teachingLoadOwnershipCount: number;
}

export interface GenerationReadinessResult {
	scope: { schoolId: number; schoolYearId: number };
	status: 'READY' | 'BLOCKED';
	generateAllowed: boolean;
	/** true only when a real scheduler dry run executed without hard blockers. */
	schedulerExecuted: boolean;
	derivedDemandRevision: string | null;
	derivedDemandBlockers: DerivedDemandBlocker[];
	termStructure: { format: 'TRIMESTER' | 'QUARTERS'; terms: Array<{ identity: string; order: number }> } | null;
	totals: { lines: number; pairs: number; sessionsByTerm: Record<string, number> };
	teachingLoadCoverage: GenerationPreflightTeachingLoadCoverage;
	resources: {
		roomCount: number;
		teachingRoomCount: number;
		totalCapacity: number;
		featureCoverage: Record<string, number>;
	};
	gradeWindows: { resolvedCount: number; missingScopes: Array<{ gradeLevel: number; programType: string }> };
	classProgramSlots: { coverage: CanonicalTemplateCoverage[]; missingScopes: Array<{ gradeLevel: number; programType: string }> };
	policy: { present: boolean; id: number | null; periodLengthMinutes: number; periodsPerDay: number };
	retainedLocks: { draftCount: number; retainedCount: number; rejected: DraftConsumeRejection[] };
	scheduler: {
		ran: boolean;
		assignedCount: number;
		unassignedCount: number;
		policyBlockedCount: number;
		classesProcessed: number;
		selectedProfileId: string | null;
		runtimeMs: number;
	};
	violations: { hardCount: number; softCount: number; hardCodes: Record<string, number>; softCodes: Record<string, number> };
	blockers: GenerationReadinessBlocker[];
	/** Explicit unresolved stakeholder decisions surfaced (never silently encoded). */
	decisionNotes: string[];
	/** GEN-C02R1 F1: exact shared preflight parity summary. */
	preflight: ReturnType<typeof summarizePreflightParity>;
	databaseSignature: { before: GenerationReadinessDatabaseSignature; after: GenerationReadinessDatabaseSignature; zeroWrite: boolean };
}

function sha256(value: unknown): string {
	return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex').toUpperCase();
}

async function computeDatabaseSignature(schoolId: number, schoolYearId: number): Promise<GenerationReadinessDatabaseSignature> {
	const client = db() as any;
	const [generationRunCount, generationRunMax, lockedSessionCount, lockedSessionMax, lockedSessionActionCount, auditLogCount, cycleRows, teachingLoadOwnershipCount] = await Promise.all([
		client.generationRun.count(),
		client.generationRun.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }),
		client.lockedSession.count(),
		client.lockedSession.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
		client.lockedSessionAction.count(),
		client.auditLog.count(),
		client.teachingLoadCycle.findMany({ where: { schoolId, schoolYearId }, select: { version: true } }),
		client.subjectSectionOwnership.count({ where: { schoolId, schoolYearId } }),
	]);
	return {
		generationRunCount,
		generationRunMaxId: generationRunMax?.id ?? null,
		lockedSessionCount,
		lockedSessionMaxUpdatedAt: lockedSessionMax?.updatedAt ? new Date(lockedSessionMax.updatedAt).toISOString() : null,
		lockedSessionActionCount,
		auditLogCount,
		teachingLoadCycleVersions: (cycleRows as Array<{ version: number }>).map((row) => row.version).sort((a, b) => a - b),
		teachingLoadOwnershipCount,
	};
}

function emptyTotals(): { lines: number; pairs: number; sessionsByTerm: Record<string, number> } {
	return { lines: 0, pairs: 0, sessionsByTerm: {} };
}

function countByCode(codes: string[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const code of codes) counts[code] = (counts[code] ?? 0) + 1;
	return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function readinessError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

export async function buildGenerationReadiness(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationReadinessDependencies = {},
): Promise<GenerationReadinessResult> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) throw readinessError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) throw readinessError(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');

	const run = () => buildGenerationReadinessWithContext(schoolId, schoolYearId, dependencies);
	return dependencies.client ? withDataContext(dependencies.client, run) : run();
}

async function buildGenerationReadinessWithContext(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationReadinessDependencies,
): Promise<GenerationReadinessResult> {
	const client = db() as any;
	const databaseBefore = await computeDatabaseSignature(schoolId, schoolYearId);

	const preflight: GenerationPreflightResult = await buildGenerationPreflight(schoolId, schoolYearId, dependencies);
	const assembly: GenerationPreflightAssembly = preflight.assembly;
	const blockers: GenerationReadinessBlocker[] = [...preflight.blockers];

	let scheduler: GenerationReadinessResult['scheduler'] = { ran: false, assignedCount: 0, unassignedCount: 0, policyBlockedCount: 0, classesProcessed: 0, selectedProfileId: null, runtimeMs: 0 };
	let violations: GenerationReadinessResult['violations'] = { hardCount: 0, softCount: 0, hardCodes: {}, softCodes: {} };

	if (assembly.schedulerCanRun && assembly.derived) {
		const constructorInput = buildPreflightConstructorInput(assembly, {});
		const schedulerStartedAt = Date.now();
		const result = runHybridScheduler(constructorInput);
		scheduler = {
			ran: true,
			assignedCount: result.assignedCount,
			unassignedCount: result.unassignedCount,
			policyBlockedCount: result.policyBlockedCount,
			classesProcessed: result.classesProcessed,
			selectedProfileId: result.selectedProfileId,
			runtimeMs: Date.now() - schedulerStartedAt,
		};

		const validatorCtx = buildPreflightValidatorContext(assembly, result.entries as ScheduledEntry[], 0);
		const validation = validateHardConstraints(validatorCtx);
		const hard = validation.violations.filter((v) => v.severity === 'HARD');
		const soft = validation.violations.filter((v) => v.severity === 'SOFT');
		violations = { hardCount: hard.length, softCount: soft.length, hardCodes: countByCode(hard.map((v) => v.code)), softCodes: countByCode(soft.map((v) => v.code)) };

		// GEN-C02R Correction 8: shape validation independent of the generic
		// validator. An out-of-shape entry is a HARD blocker.
		const shapeViolations = validateCanonicalEntryShapes(result.entries as ScheduledEntry[], assembly.timetableShapeContracts, buildSectionScopeMap(assembly.sectionsByGrade));
		for (const shapeViolation of shapeViolations) blockers.push(shapeViolation);
		if (shapeViolations.length > 0) {
			violations = {
				...violations,
				hardCount: violations.hardCount + shapeViolations.length,
				hardCodes: countByCode([...hard.map((v) => v.code), ...shapeViolations.map((v) => v.code)]),
			};
		}

		const subjectCodeById = new Map<number, string | null>(assembly.schedulableSubjects.map((s: any) => [s.id, (typeof s.code === 'string' ? s.code : null)]));
		const termIdentityByIndex = new Map(assembly.derived.termStructure.terms.map((t) => [t.order, t.identity]));
		for (const item of result.unassignedItems) {
			const termIdentity = typeof item.termIndex === 'number' ? termIdentityByIndex.get(item.termIndex) ?? null : null;
			blockers.push(classifyUnassignedBlocker(item as any, termIdentity, subjectCodeById.get(item.subjectId) ?? null));
		}
		for (const violation of hard) {
			blockers.push({
				code: violation.code,
				category: violation.code.includes('ROOM') ? 'RESOURCE_INFEASIBLE' : 'ALGORITHM_LIMIT',
				termIdentity: null,
				sectionId: violation.entities?.sectionId ?? null,
				subjectId: violation.entities?.subjectId ?? null,
				subjectCode: null,
				entity: `Run validation · ${violation.code}`,
				reason: violation.message,
				owningSurface: 'Generation assembly',
				nextAction: 'Resolve the reported hard conflict, then re-run readiness.',
			});
		}
	}

	// GEN-C02R Correction 8: zero-write truth is computed and bound BEFORE the
	// final status, so a non-zero-write diagnostic can never report generateAllowed.
	const databaseAfter = await computeDatabaseSignature(schoolId, schoolYearId);
	const zeroWrite = sha256(databaseBefore) === sha256(databaseAfter);

	const sortedBlockers = sortPreflightBlockers(blockers);
	const generateAllowed = sortedBlockers.length === 0 && scheduler.ran && violations.hardCount === 0 && zeroWrite;
	const status: GenerationReadinessResult['status'] = generateAllowed ? 'READY' : 'BLOCKED';

	const derived = assembly.derived;
	const termStructure = derived
		? { format: derived.termStructure.format, terms: derived.termStructure.terms.map((t) => ({ identity: t.identity, order: t.order })) }
		: null;

	return {
		scope: { schoolId, schoolYearId },
		status,
		generateAllowed,
		schedulerExecuted: scheduler.ran,
		derivedDemandRevision: derived?.revision ?? null,
		derivedDemandBlockers: assembly.derivedDemandBlockers,
		termStructure,
		totals: derived ? { lines: derived.totalLines, pairs: derived.totalPairs, sessionsByTerm: derived.totalsByTerm } : emptyTotals(),
		teachingLoadCoverage: assembly.teachingLoadCoverage,
		resources: {
			roomCount: assembly.rooms.length,
			teachingRoomCount: assembly.rooms.filter((r: any) => r.isTeachingSpace).length,
			totalCapacity: assembly.rooms.reduce((sum: number, r: any) => sum + (r.capacity ?? 0), 0),
			featureCoverage: countByCode(assembly.rooms.flatMap((r: any) => (r.features ?? []) as string[])),
		},
		gradeWindows: { resolvedCount: assembly.gradeWindows.length, missingScopes: assembly.missingWindows },
		classProgramSlots: { coverage: assembly.slotCoverage, missingScopes: assembly.missingSlotScopes },
		policy: assembly.policy,
		retainedLocks: {
			draftCount: assembly.retained.prePlacedCount + assembly.retained.invalidPrePlacedCount,
			retainedCount: assembly.retained.prePlacedCount,
			rejected: assembly.retained.rejectedPlacements,
		},
		scheduler,
		violations,
		blockers: sortedBlockers,
		decisionNotes: [...STAKEHOLDER_DECISION_NOTES],
		preflight: summarizePreflightParity(assembly),
		databaseSignature: { before: databaseBefore, after: databaseAfter, zeroWrite },
	};
}
