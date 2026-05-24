import { prisma } from '../lib/prisma.js';
import { fetchEnrollProActiveSchoolYear } from './section-adapter.js';

type RuntimeContextEvidenceType =
	| 'scheduling-policy'
	| 'section-mirror'
	| 'section-snapshot'
	| 'faculty-snapshot'
	| 'generation-run';

type RuntimeContextSource = 'atlas-persisted' | 'enrollpro-verified';

export type RuntimeContextEvidence = {
	type: RuntimeContextEvidenceType;
	schoolYearId: number;
	timestamp: string;
	source: string;
};

export type RuntimeContextResult = {
	schoolId: number;
	activeSchoolYearId: number;
	activeSchoolYearLabel: string | null;
	source: RuntimeContextSource;
	stale: boolean;
	resolvedAt: string;
	evidence: RuntimeContextEvidence[];
	upstream: {
		reachable: boolean;
		verified: boolean;
		matched: boolean | null;
	};
};

const CONTEXT_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

type YearEvidence = {
	yearId: number;
	timestamp: Date;
	type: RuntimeContextEvidenceType;
	source: string;
};

function pickBestRuntimeYear(evidence: YearEvidence[]): YearEvidence | null {
	if (evidence.length === 0) return null;

	const priority: RuntimeContextEvidenceType[] = [
		'scheduling-policy',
		'section-mirror',
		'section-snapshot',
		'faculty-snapshot',
		'generation-run',
	];

	for (const type of priority) {
		const matches = evidence.filter((item) => item.type === type);
		if (matches.length === 0) continue;
		matches.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
		return matches[0];
	}

	return null;
}

export async function resolveRuntimeContext(schoolId: number, authToken?: string): Promise<RuntimeContextResult | null> {
	const [policy, mirror, sectionSnapshot, facultySnapshot, generationRun] = await Promise.all([
		prisma.schedulingPolicy.findFirst({
			where: { schoolId },
			orderBy: [{ updatedAt: 'desc' }],
			select: { schoolYearId: true, updatedAt: true },
		}),
		prisma.sectionMirror.findFirst({
			where: { schoolId, isStale: false },
			orderBy: [{ lastSyncedAt: 'desc' }],
			select: { schoolYearId: true, lastSyncedAt: true },
		}),
		prisma.sectionSnapshot.findFirst({
			where: { schoolId },
			orderBy: [{ fetchedAt: 'desc' }],
			select: { schoolYearId: true, fetchedAt: true, source: true },
		}),
		prisma.facultySnapshot.findFirst({
			where: { schoolId },
			orderBy: [{ fetchedAt: 'desc' }],
			select: { schoolYearId: true, fetchedAt: true, source: true },
		}),
		prisma.generationRun.findFirst({
			where: { schoolId },
			orderBy: [{ createdAt: 'desc' }],
			select: { schoolYearId: true, createdAt: true },
		}),
	]);

	const evidence: YearEvidence[] = [];
	if (policy) {
		evidence.push({
			yearId: policy.schoolYearId,
			timestamp: policy.updatedAt,
			type: 'scheduling-policy',
			source: 'atlas.scheduling_policy',
		});
	}
	if (mirror) {
		evidence.push({
			yearId: mirror.schoolYearId,
			timestamp: mirror.lastSyncedAt,
			type: 'section-mirror',
			source: 'atlas.section_mirror',
		});
	}
	if (sectionSnapshot) {
		evidence.push({
			yearId: sectionSnapshot.schoolYearId,
			timestamp: sectionSnapshot.fetchedAt,
			type: 'section-snapshot',
			source: `atlas.section_snapshot:${sectionSnapshot.source}`,
		});
	}
	if (facultySnapshot) {
		evidence.push({
			yearId: facultySnapshot.schoolYearId,
			timestamp: facultySnapshot.fetchedAt,
			type: 'faculty-snapshot',
			source: `atlas.faculty_snapshot:${facultySnapshot.source}`,
		});
	}
	if (generationRun) {
		evidence.push({
			yearId: generationRun.schoolYearId,
			timestamp: generationRun.createdAt,
			type: 'generation-run',
			source: 'atlas.generation_run',
		});
	}

	const selected = pickBestRuntimeYear(evidence);
	if (!selected) return null;

	let source: RuntimeContextSource = 'atlas-persisted';
	let activeSchoolYearLabel: string | null = null;
	let upstreamReachable = false;
	let upstreamVerified = false;
	let upstreamMatched: boolean | null = null;

	try {
		const upstreamYear = await fetchEnrollProActiveSchoolYear(authToken);
		if (upstreamYear) {
			upstreamReachable = true;
			activeSchoolYearLabel = upstreamYear.yearLabel;
			upstreamMatched = upstreamYear.id === selected.yearId;
			if (upstreamMatched) {
				source = 'enrollpro-verified';
				upstreamVerified = true;
			}
		}
	} catch {
		// Keep atlas-persisted context when upstream is unavailable.
	}

	const stale = Date.now() - selected.timestamp.getTime() > CONTEXT_STALE_THRESHOLD_MS;

	return {
		schoolId,
		activeSchoolYearId: selected.yearId,
		activeSchoolYearLabel,
		source,
		stale,
		resolvedAt: new Date().toISOString(),
		evidence: evidence
			.sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
			.map((item) => ({
				type: item.type,
				schoolYearId: item.yearId,
				timestamp: item.timestamp.toISOString(),
				source: item.source,
			})),
		upstream: {
			reachable: upstreamReachable,
			verified: upstreamVerified,
			matched: upstreamMatched,
		},
	};
}