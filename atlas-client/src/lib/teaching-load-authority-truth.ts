/**
 * Canonical Teaching Load truth model (TL-OPERATOR-WORKSPACE-C05, R3).
 *
 * This module is the single presentational authority for the Teaching Load
 * summary. It DERIVES from the server's canonical read-only contracts and never
 * re-computes demand, policy, or qualification authority on the client.
 *
 * Source authority, in order:
 *   1. `GET /faculty-assignments/authority-diagnostics` — derived demand pairs,
 *      owned pairs, zero-load faculty, adviser mappings, advisory credit,
 *      legacy HG rows, and the persisted-policy overload totals.
 *   2. `GET /faculty-assignments/summary` — persisted workload policy + roster.
 *
 * Every metric is a typed `known | unknown`. `unknown` is rendered as a typed
 * unknown state and is NEVER substituted with `0` or an invented default such as
 * 30h/5h. A missing or unevaluated authority therefore fails closed.
 *
 * Pure: no React, no network.
 */

export type TeachingLoadAuthorityDemandPair = {
	key: string;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	gradeLevel: number;
	programType: string;
	weeklyMinutes: number;
};

export type TeachingLoadAuthorityOwnedPair = {
	ownershipId: number;
	pairKey: string;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	facultyId: number;
};

export type TeachingLoadAuthorityDiagnosticsPayload = {
	schoolId: number;
	schoolYearId: number;
	sourceRevision: string;
	fingerprint: string;
	generatedAt: string | null;
	demandedSubjectSectionPairs: TeachingLoadAuthorityDemandPair[];
	ownedSubjectSectionPairs: TeachingLoadAuthorityOwnedPair[];
	unownedActiveFaculty: Array<{ facultyId: number; name: string; department: string | null; specialization: string | null }>;
	validAdviserMappings: Array<{ facultyId: number; name: string; sectionId: number }>;
	legacyHgOwnershipRows: Array<{ ownershipId: number; subjectId: number; sectionId: number; facultyId: number }>;
	advisoryCreditEligibility: Array<{ facultyId: number; name: string; sectionId: number | null; eligible: boolean; creditMinutes: number; reason: string }>;
	overloadCapacityTotals: {
		policyStatus: 'CONFIGURED' | 'UNCONFIGURED';
		teachingStandardMinutes: number | null;
		hardCapMinutes: number | null;
		beforeTeachingMinutes: number;
		afterTeachingMinutes: number;
		beforeOverStandardCount: number;
		afterOverStandardCount: number;
		beforeOverHardCapCount: number;
		afterOverHardCapCount: number;
	};
	candidateCountsByDepartment: Array<{ department: string; candidateCount: number; demandedPairCount: number }>;
	unresolvedReasons: Array<{ code: string; scope: string; pairKey?: string; facultyId?: number; message: string }>;
	zeroWriteProof?: unknown;
};

/** A metric is either authoritative or explicitly unknown. Never coerced. */
export type TruthMetric<T> = { state: 'known'; value: T } | { state: 'unknown'; reason: string };

export function known<T>(value: T): TruthMetric<T> {
	return { state: 'known', value };
}

export function unknown<T>(reason: string): TruthMetric<T> {
	return { state: 'unknown', reason };
}

export function isKnown<T>(metric: TruthMetric<T>): metric is { state: 'known'; value: T } {
	return metric.state === 'known';
}

export type TeachingLoadTruthModel = {
	requiredPairs: TruthMetric<number>;
	assignedPairs: TruthMetric<{ real: number; placeholder: number; total: number }>;
	unresolvedPairs: TruthMetric<number>;
	actualTeachingMinutes: TruthMetric<number>;
	policyCapacity: TruthMetric<{ teachingStandardMinutes: number; hardCapMinutes: number | null }>;
	overload: TruthMetric<{ overStandardCount: number; overHardCapCount: number; excessMinutes: number }>;
	remainingCapacityMinutes: TruthMetric<number>;
	zeroLoadFaculty: TruthMetric<{ count: number; names: string[] }>;
	/** Roster authority: who is a class adviser. Independent of the policy. */
	adviserStatus: TruthMetric<{ count: number; names: string[] }>;
	/** Policy authority: adviser credit minutes. Unknown without a policy. */
	advisoryCreditMinutes: TruthMetric<number>;
	excludedHgRows: TruthMetric<{ count: number; explanation: string }>;
};

export type BuildTeachingLoadTruthInput = {
	diagnostics: TeachingLoadAuthorityDiagnosticsPayload | null | undefined;
	/** Faculty ids that are synthetic placeholder rows, from the summary roster. */
	placeholderFacultyIds?: Set<number>;
	/** Persisted policy readiness from `GET /faculty-assignments/summary`. */
	workloadPolicyStatus?: 'CONFIGURED' | 'UNCONFIGURED' | null;
};

const NO_AUTHORITY = 'Waiting for the canonical Teaching Load authority.';
const NO_POLICY = 'The workload policy for this school year is not configured.';
const NO_STANDARD = 'The canonical teaching standard is not available for this school year.';

function countUnresolvedPairs(diagnostics: TeachingLoadAuthorityDiagnosticsPayload): number {
	const owned = new Set(
		(diagnostics.ownedSubjectSectionPairs ?? [])
			.filter((row) => row && row.pairKey)
			.map((row) => row.pairKey),
	);
	// Unresolved is a set difference over canonical demand, never a blind
	// subtraction of two aggregate counts.
	return (diagnostics.demandedSubjectSectionPairs ?? []).filter((pair) => !owned.has(pair.key)).length;
}

export function buildTeachingLoadTruthModel(input: BuildTeachingLoadTruthInput): TeachingLoadTruthModel {
	const diagnostics = input.diagnostics ?? null;
	if (!diagnostics) {
		return {
			requiredPairs: unknown(NO_AUTHORITY),
			assignedPairs: unknown(NO_AUTHORITY),
			unresolvedPairs: unknown(NO_AUTHORITY),
			actualTeachingMinutes: unknown(NO_AUTHORITY),
			policyCapacity: unknown(NO_AUTHORITY),
			overload: unknown(NO_AUTHORITY),
			remainingCapacityMinutes: unknown(NO_AUTHORITY),
			zeroLoadFaculty: unknown(NO_AUTHORITY),
			adviserStatus: unknown(NO_AUTHORITY),
			advisoryCreditMinutes: unknown(NO_AUTHORITY),
			excludedHgRows: unknown(NO_AUTHORITY),
		};
	}

	const placeholders = input.placeholderFacultyIds ?? new Set<number>();
	const ownedPairs = (diagnostics.ownedSubjectSectionPairs ?? []).filter(Boolean);
	let real = 0;
	let placeholder = 0;
	for (const row of ownedPairs) {
		if (placeholders.has(row.facultyId)) placeholder += 1;
		else real += 1;
	}

	const requiredPairs = (diagnostics.demandedSubjectSectionPairs ?? []).length;
	const unresolvedPairs = countUnresolvedPairs(diagnostics);

	const totals = diagnostics.overloadCapacityTotals;
	const policyConfigured =
		totals != null
		&& totals.policyStatus === 'CONFIGURED'
		&& input.workloadPolicyStatus !== 'UNCONFIGURED'
		&& typeof totals.teachingStandardMinutes === 'number'
		&& Number.isFinite(totals.teachingStandardMinutes)
		&& totals.teachingStandardMinutes > 0;

	const policyCapacity: TruthMetric<{ teachingStandardMinutes: number; hardCapMinutes: number | null }> = policyConfigured
		? known({
			teachingStandardMinutes: totals.teachingStandardMinutes as number,
			hardCapMinutes: typeof totals.hardCapMinutes === 'number' ? totals.hardCapMinutes : null,
		})
		: unknown(input.workloadPolicyStatus === 'UNCONFIGURED' ? NO_POLICY : NO_STANDARD);

	const actualTeachingMinutes: TruthMetric<number> = policyConfigured
		? known(totals.beforeTeachingMinutes)
		: unknown(policyConfigured ? NO_AUTHORITY : NO_STANDARD);

	// Overload is meaningful only against a persisted standard/hard cap.
	const overload: TruthMetric<{ overStandardCount: number; overHardCapCount: number; excessMinutes: number }> = policyConfigured
		? known({
			overStandardCount: totals.beforeOverStandardCount,
			overHardCapCount: totals.beforeOverHardCapCount,
			excessMinutes: Math.max(0, totals.beforeTeachingMinutes - (totals.teachingStandardMinutes as number)),
		})
		: unknown(input.workloadPolicyStatus === 'UNCONFIGURED' ? NO_POLICY : NO_STANDARD);

	// Remaining capacity is a per-scope aggregate that is only honest when the
	// count of teachers carrying the standard is authoritative.
	const remainingCapacityMinutes: TruthMetric<number> = policyConfigured
		? known(Math.max(0, (totals.teachingStandardMinutes as number) * Math.max(0, real) - totals.beforeTeachingMinutes))
		: unknown(input.workloadPolicyStatus === 'UNCONFIGURED' ? NO_POLICY : NO_STANDARD);

	const unowned = (diagnostics.unownedActiveFaculty ?? []).filter(Boolean);
	const advisoryRows = (diagnostics.advisoryCreditEligibility ?? []).filter((row) => row && row.eligible);
	const adviserNames = Array.from(
		new Set((diagnostics.validAdviserMappings ?? []).filter(Boolean).map((row) => row.name).filter(Boolean)),
	);

	// Adviser identity is roster authority and stays known without a policy;
	// the credited minutes are policy authority and must fail closed with it.
	const adviserStatus: TruthMetric<{ count: number; names: string[] }> = known({
		count: adviserNames.length,
		names: adviserNames,
	});
	const advisoryCreditMinutes: TruthMetric<number> = policyConfigured
		? known(advisoryRows.reduce((sum, row) => sum + (Number.isFinite(row.creditMinutes) ? row.creditMinutes : 0), 0))
		: unknown(input.workloadPolicyStatus === 'UNCONFIGURED' ? NO_POLICY : NO_STANDARD);

	const hgRows = (diagnostics.legacyHgOwnershipRows ?? []).filter(Boolean);

	return {
		requiredPairs: known(requiredPairs),
		assignedPairs: known({ real, placeholder, total: ownedPairs.length }),
		unresolvedPairs: known(unresolvedPairs),
		actualTeachingMinutes,
		policyCapacity,
		overload,
		remainingCapacityMinutes,
		zeroLoadFaculty: known({ count: unowned.length, names: unowned.map((row) => row.name).filter(Boolean) }),
		adviserStatus,
		advisoryCreditMinutes,
		excludedHgRows: known({
			count: hgRows.length,
			explanation:
				hgRows.length > 0
					? 'Homeroom Guidance / reference-only rows are excluded from Teaching Load demand and staffing counts.'
					: 'No Homeroom Guidance / reference-only rows were found for this scope.',
		}),
	};
}

/** Hours from authoritative minutes, rounded for display only. */
export function minutesToHours(minutes: number): number {
	return Math.round((minutes / 60) * 10) / 10;
}
