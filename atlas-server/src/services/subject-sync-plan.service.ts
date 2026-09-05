/**
 * Shared sync plan builder for subject-contract synchronization.
 *
 * Both preview and use the same plan builder to ensure they see
 * the exact same mutation plan. This eliminates the TOCTOU gap
 * and the wall-clock timestamp fingerprint defect.
 *
 * The plan builder is transaction-aware: it accepts a Prisma client
 * (or transaction client) so apply can use it inside a transaction.
 *
 * Idempotent: produces zero mutations when values already match.
 *
 * NOTE: The runtime sync planner currently uses hardcoded PROGRAM_OVERLAY_CODES
 * because the persisted offering model (Prompt 03) is not yet authorized.
 * Sync apply is blocked with OFFERING_MODEL_REQUIRED until the offering model
 * is available. This is the correct behavior per the prompt contract.
 */

import type { PrismaClient, ProgramType } from '@prisma/client';
import { canonicalHash, sortByKey } from '../lib/canonical-json.js';

/**
 * A single mutation in the sync plan.
 */
export type SyncMutation = {
	action: 'ACTIVATE' | 'DEACTIVATE' | 'CREATE' | 'UPDATE';
	code: string;
	name: string;
	reason: string;
	/** For CREATE/UPDATE: the target fields */
	fields?: Record<string, unknown>;
	/** For UPDATE: the before values */
	beforeValues?: Record<string, unknown>;
	/** For UPDATE: the after values */
	afterValues?: Record<string, unknown>;
	/** Subject ID where available */
	subjectId?: number;
	/** Before version */
	beforeVersion?: string;
};

/**
 * Source provenance information.
 */
export type SourceProvenance = {
	offeringsStatus: 'live' | 'degraded' | 'unavailable';
	sectionStatus: 'live' | 'degraded' | 'unavailable';
	mirrorStatus: 'live' | 'degraded' | 'unavailable';
	tleStatus: 'live' | 'degraded' | 'unavailable';
	degradationReason?: string;
};

/**
 * The complete sync plan.
 * Contains exact mutation data for fingerprinting.
 */
export type SyncPlan = {
	schoolId: number;
	schoolYearId: number;
	/** Stable source revision derived from the upstream data content */
	sourceRevision: string;
	/** Source provenance information */
	provenance: SourceProvenance;
	/** Whether the plan is applicable (false if any authoritative source is unavailable) */
	applicable: boolean;
	/** Whether the offering model is available (false until Prompt 03) */
	offeringModelAvailable: boolean;
	/** The normalized upstream dataset used to build the plan */
	sourceSnapshot: {
		offeredPrograms: string[];
		tleSpecializations: Array<{ code: string; name: string; gradeLevels: number[] }>;
	};
	mutations: SyncMutation[];
	summary: {
		activationCount: number;
		deactivationCount: number;
		creationCount: number;
		updateCount: number;
		totalChanges: number;
	};
};

// NOTE: PROGRAM_OVERLAY_CODES is hardcoded because the persisted offering model
// (Prompt 03) is not yet authorized. This is bootstrap compatibility data only.
// Runtime sync authority must come from persisted school-year offering rows.
const PROGRAM_OVERLAY_CODES: Record<ProgramType, string[]> = {
	REGULAR: [],
	STE: ['STE_ENV_SCI', 'STE_BIOTECH', 'STE_APPLIED_CHEM', 'STE_APPLIED_PHYS', 'STE_ROBOTICS', 'STE_RESEARCH'],
	SPA: ['SPA_SPEC'],
	SPS: ['SPS_SPEC'],
	OTHER: [],
};

const DYNAMIC_TLE_PREFIX = 'TLE_SPEC_';

/**
 * Compute a stable source revision from the upstream data.
 * Uses content hashing instead of wall-clock timestamps.
 * The same unchanged source produces the same revision.
 */
async function computeSourceRevision(
	offeredPrograms: Set<ProgramType>,
	tleSpecializations: Array<{ code: string; name: string; gradeLevels: number[] }>,
): Promise<string> {
	const snapshot = {
		offeredPrograms: [...offeredPrograms].sort(),
		tleSpecializations: sortByKey(tleSpecializations, (t) => t.code),
	};
	return canonicalHash(snapshot);
}

/**
 * Build the sync plan from upstream signals and current subject state.
 * Uses the provided prisma client/tx for all reads.
 *
 * This is the SINGLE source of truth for what the sync will do.
 * Both preview and apply MUST use this function.
 *
 * Idempotent: produces zero mutations when values already match.
 */
export async function buildSyncPlan(
	prisma: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	schoolId: number,
	schoolYearId: number,
	upstreamSignals: {
		offeredPrograms: Set<ProgramType>;
		tleSpecializations: Array<{ code: string; name: string; gradeLevels: number[] }>;
		provenance: SourceProvenance;
	},
): Promise<SyncPlan> {
	const { offeredPrograms, tleSpecializations, provenance } = upstreamSignals;

	// Check if plan is applicable
	const applicable = provenance.offeringsStatus !== 'unavailable' &&
		provenance.sectionStatus !== 'unavailable';

	// The offering model is not yet available (Prompt 03 not authorized)
	// Sync apply will be blocked with OFFERING_MODEL_REQUIRED
	const offeringModelAvailable = false;

	// Get ALL relevant subjects (active and inactive) for idempotent planning
	const allSubjects = await prisma.subject.findMany({
		where: { schoolId },
		select: { id: true, code: true, name: true, isActive: true, programScopes: true, gradeLevels: true, updatedAt: true },
	});

	const mutations: SyncMutation[] = [];

	// 1. Program overlay deactivations
	for (const [programType, overlayCodes] of Object.entries(PROGRAM_OVERLAY_CODES) as Array<[ProgramType, string[]]>) {
		if (programType === 'REGULAR' || programType === 'OTHER') continue;
		if (!offeredPrograms.has(programType)) {
			for (const code of overlayCodes) {
				const subject = allSubjects.find((s) => s.code === code);
				if (subject && subject.isActive) {
					mutations.push({
						action: 'DEACTIVATE',
						code,
						name: subject.name,
						subjectId: subject.id,
						reason: `Program ${programType} not offered upstream`,
						beforeVersion: subject.updatedAt.toISOString(),
					});
				}
				// If already inactive, no mutation needed (idempotent)
			}
		}
	}

	// 2. Developmental Reading deactivation
	const spaOffered = offeredPrograms.has('SPA');
	const spsOffered = offeredPrograms.has('SPS');
	if (!spaOffered && !spsOffered) {
		const devlReading = allSubjects.find((s) => s.code === 'DEVL_READING');
		if (devlReading && devlReading.isActive) {
			mutations.push({
				action: 'DEACTIVATE',
				code: 'DEVL_READING',
				name: devlReading.name,
				subjectId: devlReading.id,
				reason: 'Neither SPA nor SPS offered upstream',
				beforeVersion: devlReading.updatedAt.toISOString(),
			});
		}
	}

	// 3. Dynamic TLE subjects
	if (tleSpecializations.length === 0) {
		// Deactivate all dynamic TLE subjects
		const dynamicTle = allSubjects.filter((s) => s.code.startsWith(DYNAMIC_TLE_PREFIX));
		for (const subject of dynamicTle) {
			if (subject.isActive) {
				mutations.push({
					action: 'DEACTIVATE',
					code: subject.code,
					name: subject.name,
					subjectId: subject.id,
					reason: 'No TLE specializations upstream',
					beforeVersion: subject.updatedAt.toISOString(),
				});
			}
		}
	} else {
		// Create or update dynamic TLE subjects
		for (const spec of tleSpecializations) {
			const code = `${DYNAMIC_TLE_PREFIX}${spec.code}`.slice(0, 64);
			const existing = allSubjects.find((s) => s.code === code);
			if (!existing) {
				mutations.push({
					action: 'CREATE',
					code,
					name: `TLE Specialization - ${spec.name}`,
					reason: `New TLE specialization: ${spec.name}`,
					fields: {
						gradeLevels: spec.gradeLevels,
						programScopes: ['REGULAR'],
						interSectionEnabled: true,
						interSectionGradeLevels: spec.gradeLevels,
						allowedSpecializations: [spec.code],
					},
				});
			} else {
				// Check if values actually differ (idempotent)
				const needsUpdate = JSON.stringify(existing.programScopes) !== JSON.stringify(['REGULAR']) ||
					JSON.stringify(existing.gradeLevels) !== JSON.stringify(spec.gradeLevels);
				if (needsUpdate) {
					mutations.push({
						action: 'UPDATE',
						code,
						name: existing.name,
						subjectId: existing.id,
						reason: `Update TLE specialization: ${spec.name}`,
						fields: {
							gradeLevels: spec.gradeLevels,
							programScopes: ['REGULAR'],
						},
						beforeValues: {
							programScopes: existing.programScopes,
							gradeLevels: existing.gradeLevels,
						},
						afterValues: {
							programScopes: ['REGULAR'],
							gradeLevels: spec.gradeLevels,
						},
						beforeVersion: existing.updatedAt.toISOString(),
					});
				}
				// If already correct, no mutation needed (idempotent)
			}
		}
	}

	// Compute stable source revision
	const sourceRevision = await computeSourceRevision(offeredPrograms, tleSpecializations);

	// Sort mutations deterministically
	const sortedMutations = sortByKey(mutations, (m) => `${m.action}:${m.code}`);

	return {
		schoolId,
		schoolYearId,
		sourceRevision,
		provenance,
		applicable,
		offeringModelAvailable,
		sourceSnapshot: {
			offeredPrograms: [...offeredPrograms].sort(),
			tleSpecializations: sortByKey(tleSpecializations, (t) => t.code),
		},
		mutations: sortedMutations,
		summary: {
			activationCount: sortedMutations.filter((m) => m.action === 'ACTIVATE').length,
			deactivationCount: sortedMutations.filter((m) => m.action === 'DEACTIVATE').length,
			creationCount: sortedMutations.filter((m) => m.action === 'CREATE').length,
			updateCount: sortedMutations.filter((m) => m.action === 'UPDATE').length,
			totalChanges: sortedMutations.length,
		},
	};
}

/**
 * Compute the fingerprint for a sync plan.
 * Uses the deterministic canonicalizer.
 */
export async function computeSyncPlanFingerprint(plan: SyncPlan): Promise<string> {
	// Hash the entire plan structure (excluding the fingerprint itself)
	const fingerprintData = {
		schoolId: plan.schoolId,
		schoolYearId: plan.schoolYearId,
		sourceRevision: plan.sourceRevision,
		applicable: plan.applicable,
		mutations: plan.mutations,
	};
	return canonicalHash(fingerprintData);
}

/**
 * Apply a sync plan within a transaction.
 * Returns exact affected-row counts.
 * Enforces optimistic concurrency: zero-row conditional updates abort with SYNC_DRIFT.
 */
export async function applySyncPlan(
	tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
	plan: SyncPlan,
): Promise<{
	activatedCount: number;
	deactivatedCount: number;
	createdCount: number;
	updatedCount: number;
}> {
	let activatedCount = 0;
	let deactivatedCount = 0;
	let createdCount = 0;
	let updatedCount = 0;

	for (const mutation of plan.mutations) {
		switch (mutation.action) {
			case 'DEACTIVATE': {
				// Use subjectId + expected version for optimistic concurrency
				const where: any = { schoolId: plan.schoolId, code: mutation.code, isActive: true };
				if (mutation.subjectId && mutation.beforeVersion) {
					where.id = mutation.subjectId;
					where.updatedAt = new Date(mutation.beforeVersion);
				}
				const result = await tx.subject.updateMany({
					where,
					data: { isActive: false },
				});
				if (result.count === 0 && mutation.subjectId) {
					throw new Error('SYNC_DRIFT');
				}
				deactivatedCount += result.count;
				break;
			}
			case 'ACTIVATE': {
				const where: any = { schoolId: plan.schoolId, code: mutation.code, isActive: false };
				if (mutation.subjectId && mutation.beforeVersion) {
					where.id = mutation.subjectId;
					where.updatedAt = new Date(mutation.beforeVersion);
				}
				const result = await tx.subject.updateMany({
					where,
					data: { isActive: true },
				});
				if (result.count === 0 && mutation.subjectId) {
					throw new Error('SYNC_DRIFT');
				}
				activatedCount += result.count;
				break;
			}
			case 'CREATE': {
				try {
					await tx.subject.create({
						data: {
							schoolId: plan.schoolId,
							code: mutation.code,
							name: mutation.name,
							...(mutation.fields ?? {}),
						} as any,
					});
					createdCount++;
				} catch (err: any) {
					// Handle concurrent insert as drift
					if (err?.code === 'P2002') {
						throw new Error('SYNC_DRIFT');
					}
					throw err;
				}
				break;
			}
			case 'UPDATE': {
				if (mutation.fields && mutation.subjectId) {
					const where: any = {
						id: mutation.subjectId,
						schoolId: plan.schoolId,
					};
					if (mutation.beforeVersion) {
						where.updatedAt = new Date(mutation.beforeVersion);
					}
					const result = await tx.subject.update({
						where,
						data: mutation.fields,
					});
					if (!result) {
						throw new Error('SYNC_DRIFT');
					}
					updatedCount++;
				}
				break;
			}
		}
	}

	return { activatedCount, deactivatedCount, createdCount, updatedCount };
}
