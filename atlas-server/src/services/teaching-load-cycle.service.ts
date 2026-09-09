import { getDataContext } from '../lib/data-context.js';

const db = () => getDataContext();

export type TeachingLoadCycleSource = {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED' | 'UNCONFIGURED';
	version: number;
	initializedAt: string;
	updatedAt: string;
};

export type TeachingLoadCycleReadDiagnostic =
	| { mismatched: false }
	| { mismatched: true; code: 'CYCLE_STATE_MISMATCH'; persistedState: 'EMPTY' | 'POPULATED'; observedState: 'EMPTY' | 'POPULATED' };

export interface TeachingLoadCycleReadResult {
	source: TeachingLoadCycleSource;
	diagnostic: TeachingLoadCycleReadDiagnostic | null;
}

export async function ensureTeachingLoadCycle(schoolId: number, schoolYearId: number) {
	const ownershipCount = await db().subjectSectionOwnership.count({
		where: { schoolId, schoolYearId },
	});
	const expectedState = ownershipCount > 0 ? 'POPULATED' : 'EMPTY';
	const existing = await db().teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (!existing) {
		return db().teachingLoadCycle.create({
			data: { schoolId, schoolYearId, state: expectedState },
		});
	}
	if (existing.state === expectedState) {
		return existing;
	}
	return db().teachingLoadCycle.update({
		where: { id: existing.id },
		data: { state: expectedState, version: { increment: 1 } },
	});
}

export async function getTeachingLoadCycle(schoolId: number, schoolYearId: number) {
	return db().teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
}

export async function getOrCreateTeachingLoadCycleSource(schoolId: number, schoolYearId: number): Promise<TeachingLoadCycleSource> {
	const cycle = await ensureTeachingLoadCycle(schoolId, schoolYearId);
	return {
		schoolId,
		schoolYearId,
		state: cycle.state,
		version: cycle.version,
		initializedAt: cycle.initializedAt.toISOString(),
		updatedAt: cycle.updatedAt.toISOString(),
	};
}

/**
 * Genuinely read-only cycle source for passive GET paths. Serializes an
 * existing cycle without mutation; a missing cycle yields a typed UNCONFIGURED
 * readiness source; a persisted-state/observed-state mismatch is reported as a
 * diagnostic and never repaired during GET. Creation and version updates happen
 * only on explicit setup or mutation paths (ensure/refresh). An optional
 * transaction client keeps the read inside the caller's transaction.
 */
export async function readTeachingLoadCycleSource(
	schoolId: number,
	schoolYearId: number,
	client?: { teachingLoadCycle: { findUnique(args: unknown): Promise<unknown> }; subjectSectionOwnership: { count(args: unknown): Promise<number> } },
): Promise<TeachingLoadCycleReadResult> {
	const tx = client ?? (db() as never);
	const cycle = await (tx as any).teachingLoadCycle.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	if (!cycle) {
		return {
			source: {
				schoolId,
				schoolYearId,
				state: 'UNCONFIGURED',
				version: 0,
				initializedAt: '',
				updatedAt: '',
			},
			diagnostic: null,
		};
	}
	const source: TeachingLoadCycleSource = {
		schoolId: cycle.schoolId,
		schoolYearId: cycle.schoolYearId,
		state: cycle.state,
		version: cycle.version,
		initializedAt: cycle.initializedAt.toISOString(),
		updatedAt: cycle.updatedAt.toISOString(),
	};
	const ownershipCount = await (tx as any).subjectSectionOwnership.count({
		where: { schoolId, schoolYearId },
	});
	const observedState = ownershipCount > 0 ? 'POPULATED' : 'EMPTY';
	return {
		source,
		diagnostic: cycle.state === observedState
			? { mismatched: false }
			: {
				mismatched: true,
				code: 'CYCLE_STATE_MISMATCH',
				persistedState: cycle.state,
				observedState,
			},
	};
}

export async function refreshTeachingLoadCycle(
	schoolId: number,
	schoolYearId: number,
	client?: { teachingLoadCycle: { upsert(args: unknown): Promise<unknown> }; subjectSectionOwnership: { count(args: unknown): Promise<number> } },
) {
	const tx = client ?? (db() as never);
	const ownershipCount = await (tx as any).subjectSectionOwnership.count({
		where: { schoolId, schoolYearId },
	});
	return (tx as any).teachingLoadCycle.upsert({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
		create: { schoolId, schoolYearId, state: ownershipCount > 0 ? 'POPULATED' : 'EMPTY' },
		update: {
			state: ownershipCount > 0 ? 'POPULATED' : 'EMPTY',
			version: { increment: 1 },
		},
	});
}

export function serializeTeachingLoadCycle(cycle: {
	schoolId: number;
	schoolYearId: number;
	state: 'EMPTY' | 'POPULATED';
	version: number;
	initializedAt: Date;
	updatedAt: Date;
}): TeachingLoadCycleSource {
	return {
		schoolId: cycle.schoolId,
		schoolYearId: cycle.schoolYearId,
		state: cycle.state,
		version: cycle.version,
		initializedAt: cycle.initializedAt.toISOString(),
		updatedAt: cycle.updatedAt.toISOString(),
	};
}
