import { createHash } from 'node:crypto';

import type { Prisma, PrismaClient } from '@prisma/client';

import { getDataContext } from '../lib/data-context.js';
import { buildDerivedDemand } from './derived-demand.service.js';

export type GenerationInputDomain = 'teachingLoad' | 'policy' | 'rooms' | 'sections' | 'subjects' | 'derivedDemand';

export type GenerationInputDomainSnapshot = {
	fingerprint: string;
	signals: Record<string, number | string | null>;
};

export type GenerationInputSnapshot = {
	schemaVersion: 1;
	schoolId: number;
	schoolYearId: number;
	computedAt: string;
	fingerprint: string;
	domains: Record<GenerationInputDomain, GenerationInputDomainSnapshot>;
};

export type GenerationInputComparison = {
	status: 'FRESH' | 'STALE' | 'UNKNOWN';
	message: string;
	actionHint: string;
	changedDomains: GenerationInputDomain[];
	checkedAt: string;
	runFingerprint?: string;
	currentFingerprint?: string;
	missingReason?: 'MISSING_RUN_SNAPSHOT' | 'SNAPSHOT_VERSION_MISMATCH' | 'COMPARISON_FAILED';
};

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(',')}}`;
}

function hashPayload(value: unknown): string {
	return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function iso(value: Date | null | undefined): string | null {
	return value?.toISOString() ?? null;
}

function buildDomainSnapshot(signals: Record<string, number | string | null>): GenerationInputDomainSnapshot {
	return {
		fingerprint: hashPayload(signals),
		signals,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractGenerationInputSnapshot(summary: unknown): GenerationInputSnapshot | null {
	if (!isRecord(summary)) return null;
	const candidate = summary.inputSnapshot;
	if (!isRecord(candidate)) return null;
	if (candidate.schemaVersion !== 1) return null;
	if (typeof candidate.fingerprint !== 'string') return null;
	if (!isRecord(candidate.domains)) return null;
	return candidate as GenerationInputSnapshot;
}

export function compareGenerationInputSnapshots(
	runSnapshot: GenerationInputSnapshot | null,
	currentSnapshot: GenerationInputSnapshot,
	checkedAt = new Date().toISOString(),
): GenerationInputComparison {
	if (!runSnapshot) {
		return {
			status: 'UNKNOWN',
			message: 'ATLAS cannot compare this run with current inputs because it was generated before input snapshots were recorded.',
			actionHint: 'Keep reviewing the current draft, or regenerate when you need a draft that is checked against today\'s setup data.',
			changedDomains: [],
			checkedAt,
			currentFingerprint: currentSnapshot.fingerprint,
			missingReason: 'MISSING_RUN_SNAPSHOT',
		};
	}

	if (runSnapshot.schemaVersion !== currentSnapshot.schemaVersion) {
		return {
			status: 'UNKNOWN',
			message: 'ATLAS cannot compare this run because the input snapshot format changed after it was generated.',
			actionHint: 'Keep reviewing the current draft, or regenerate when you need a draft checked with the current setup contract.',
			changedDomains: [],
			checkedAt,
			runFingerprint: runSnapshot.fingerprint,
			currentFingerprint: currentSnapshot.fingerprint,
			missingReason: 'SNAPSHOT_VERSION_MISMATCH',
		};
	}

	const changedDomains = (Object.keys(currentSnapshot.domains) as GenerationInputDomain[])
		.filter((domain) => runSnapshot.domains[domain]?.fingerprint !== currentSnapshot.domains[domain].fingerprint);

	if (changedDomains.length === 0 && runSnapshot.fingerprint === currentSnapshot.fingerprint) {
		return {
			status: 'FRESH',
			message: 'This draft still matches the current Teaching Load, policy, room, section, and subject setup.',
			actionHint: 'Continue review or manual repair without regenerating unless you want a new draft.',
			changedDomains: [],
			checkedAt,
			runFingerprint: runSnapshot.fingerprint,
			currentFingerprint: currentSnapshot.fingerprint,
		};
	}

	return {
		status: 'STALE',
		message: 'Teaching load, policy, rooms, sections, or subjects changed after this draft was generated.',
		actionHint: 'Preview the changed inputs, make a manual repair, or regenerate a new draft when you are ready.',
		changedDomains,
		checkedAt,
		runFingerprint: runSnapshot.fingerprint,
		currentFingerprint: currentSnapshot.fingerprint,
	};
}

export async function computeGenerationInputSnapshot(
	schoolId: number,
	schoolYearId: number,
	client: Prisma.TransactionClient | PrismaClient = getDataContext(),
): Promise<GenerationInputSnapshot> {
	const [
		facultyMirrorAggregate,
		facultySubjectAggregate,
		ownershipAggregate,
		teachingLoadCycle,
		policy,
		gradeWindowAggregate,
		roomAggregate,
		buildingAggregate,
		sectionAggregate,
		subjectAggregate,
		classTemplateAggregate,
		classTemplateSubjectAggregate,
	] = await Promise.all([
		client.facultyMirror.aggregate({
			where: { schoolId, isStale: false },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.facultySubject.aggregate({
			where: { schoolId },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.subjectSectionOwnership.aggregate({
			where: { schoolId },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.teachingLoadCycle.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { id: true, state: true, version: true, updatedAt: true },
		}),
		client.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { id: true, updatedAt: true },
		}),
		client.gradeShiftWindow.aggregate({
			where: { schoolId, schoolYearId },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.room.aggregate({
			where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.building.aggregate({
			where: { schoolId, isTeachingBuilding: true },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.sectionMirror.aggregate({
			where: { schoolId, schoolYearId, isActiveForScheduling: true },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.subject.aggregate({
			where: { schoolId, isActive: true },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.classTemplate.aggregate({
			where: { schoolId, isActive: true },
			_count: { _all: true },
			_max: { id: true, updatedAt: true },
		}),
		client.classTemplateSubject.aggregate({
			where: { template: { schoolId } },
			_count: { _all: true },
			_max: { id: true, createdAt: true },
		}),
	]);
	// Exact row-content revision digests close the aggregate max/count blind spot:
	// any scoped source-row mutation changes at least one domain fingerprint, even
	// when IDs/counts are stable or timestamps are restored out of order.
	const exactRows = await client.$queryRawUnsafe<Array<{
		teachingLoad: string;
		policy: string;
		rooms: string;
		sections: string;
		subjects: string;
	}>>(`
		SELECT
			(SELECT md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."tableName", x.id), '')) FROM (
				SELECT 'faculty' AS "tableName", id, to_jsonb(f.*) AS row FROM faculty_mirrors f WHERE school_id = $1 AND is_stale = false
				UNION ALL SELECT 'facultySubject', id, to_jsonb(fs.*) FROM faculty_subjects fs WHERE school_id = $1
				UNION ALL SELECT 'ownership', id, to_jsonb(o.*) FROM subject_section_ownerships o WHERE school_id = $1 AND school_year_id = $2
				UNION ALL SELECT 'cycle', id, to_jsonb(c.*) FROM teaching_load_cycles c WHERE school_id = $1 AND school_year_id = $2
			) x) AS "teachingLoad",
			(SELECT md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."tableName", x.id), '')) FROM (
				SELECT 'policy' AS "tableName", id, to_jsonb(p.*) AS row FROM scheduling_policies p WHERE school_id = $1 AND school_year_id = $2
				UNION ALL SELECT 'window', id, to_jsonb(w.*) FROM grade_shift_windows w WHERE school_id = $1 AND school_year_id = $2
			) x) AS "policy",
			(SELECT md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."tableName", x.id), '')) FROM (
				SELECT 'building' AS "tableName", id, to_jsonb(b.*) AS row FROM buildings b WHERE school_id = $1 AND is_teaching_building = true
				UNION ALL SELECT 'room', r.id, to_jsonb(r.*) FROM rooms r JOIN buildings b ON b.id = r.building_id WHERE b.school_id = $1 AND b.is_teaching_building = true AND r.is_teaching_space = true
			) x) AS "rooms",
			(SELECT md5(COALESCE(string_agg(to_jsonb(s.*)::text, '|' ORDER BY s.id), '')) FROM section_mirrors s WHERE school_id = $1 AND school_year_id = $2 AND is_active_for_scheduling = true) AS "sections",
			(SELECT md5(COALESCE(string_agg(to_jsonb(x)::text, '|' ORDER BY x."tableName", x.id), '')) FROM (
				SELECT 'subject' AS "tableName", id, to_jsonb(s.*) AS row FROM subjects s WHERE school_id = $1 AND is_active = true
				UNION ALL SELECT 'template', id, to_jsonb(t.*) FROM class_templates t WHERE school_id = $1 AND is_active = true
				UNION ALL SELECT 'binding', cts.id, to_jsonb(cts.*) FROM class_template_subjects cts JOIN class_templates t ON t.id = cts.template_id WHERE t.school_id = $1
			) x) AS "subjects"
	`, schoolId, schoolYearId);
	const exact = exactRows[0];
	if (!exact) throw new Error('GENERATION_INPUT_EXACT_DIGEST_UNAVAILABLE');

	// DEMAND-C01R: bind the authoritative derived-demand revision (ordered EnrollPro
	// terms + active sections + Subject scheduling/room semantics + period length)
	// into generation/publication freshness through the supplied client. Legacy
	// SchoolYearTermConfig, SchoolYearOffering, and OfferingTermAssignment are
	// intentionally excluded from current-year authority.
	let derivedDemandSignals: Record<string, number | string | null>;
	try {
		const derived = await buildDerivedDemand(schoolId, schoolYearId, { client: client as never });
		derivedDemandSignals = derived.ok
			? {
				derivedDemandRevision: derived.revision,
				termFormat: derived.termStructure.format,
				termCount: derived.termStructure.terms.length,
				timetableLineCount: derived.totalLines,
				teachingLoadPairCount: derived.totalPairs,
			}
			: {
				derivedDemandRevision: null,
				derivedDemandBlockedCount: derived.blockers.length,
				derivedDemandBlockerCodes: derived.blockers.map((entry) => entry.code).sort().join(','),
			};
	} catch (error) {
		derivedDemandSignals = {
			derivedDemandRevision: null,
			derivedDemandBlockedCount: 1,
			derivedDemandBlockerCodes: (error as { code?: string }).code ?? 'ERROR',
		};
	}

	const domains: Record<GenerationInputDomain, GenerationInputDomainSnapshot> = {
		teachingLoad: buildDomainSnapshot({
			exactRevisionDigest: exact.teachingLoad,
			cycleId: teachingLoadCycle?.id ?? null,
			cycleState: teachingLoadCycle?.state ?? null,
			cycleVersion: teachingLoadCycle?.version ?? null,
			cycleUpdatedAt: iso(teachingLoadCycle?.updatedAt),
			facultyCount: facultyMirrorAggregate._count._all,
			facultyMaxId: facultyMirrorAggregate._max.id,
			facultyMaxUpdatedAt: iso(facultyMirrorAggregate._max.updatedAt),
			facultySubjectCount: facultySubjectAggregate._count._all,
			facultySubjectMaxId: facultySubjectAggregate._max.id,
			facultySubjectMaxUpdatedAt: iso(facultySubjectAggregate._max.updatedAt),
			sectionOwnershipCount: ownershipAggregate._count._all,
			sectionOwnershipMaxId: ownershipAggregate._max.id,
			sectionOwnershipMaxUpdatedAt: iso(ownershipAggregate._max.updatedAt),
		}),
		policy: buildDomainSnapshot({
			exactRevisionDigest: exact.policy,
			policyId: policy?.id ?? null,
			policyUpdatedAt: iso(policy?.updatedAt),
			gradeWindowCount: gradeWindowAggregate._count._all,
			gradeWindowMaxId: gradeWindowAggregate._max.id,
			gradeWindowMaxUpdatedAt: iso(gradeWindowAggregate._max.updatedAt),
		}),
		rooms: buildDomainSnapshot({
			exactRevisionDigest: exact.rooms,
			teachingRoomCount: roomAggregate._count._all,
			teachingRoomMaxId: roomAggregate._max.id,
			teachingRoomMaxUpdatedAt: iso(roomAggregate._max.updatedAt),
			teachingBuildingCount: buildingAggregate._count._all,
			teachingBuildingMaxId: buildingAggregate._max.id,
			teachingBuildingMaxUpdatedAt: iso(buildingAggregate._max.updatedAt),
		}),
		sections: buildDomainSnapshot({
			exactRevisionDigest: exact.sections,
			activeSectionCount: sectionAggregate._count._all,
			sectionMaxId: sectionAggregate._max.id,
			sectionMaxUpdatedAt: iso(sectionAggregate._max.updatedAt),
		}),
		subjects: buildDomainSnapshot({
			exactRevisionDigest: exact.subjects,
			activeSubjectCount: subjectAggregate._count._all,
			subjectMaxId: subjectAggregate._max.id,
			subjectMaxUpdatedAt: iso(subjectAggregate._max.updatedAt),
			activeTemplateCount: classTemplateAggregate._count._all,
			classTemplateMaxId: classTemplateAggregate._max.id,
			classTemplateMaxUpdatedAt: iso(classTemplateAggregate._max.updatedAt),
			classTemplateSubjectCount: classTemplateSubjectAggregate._count._all,
			classTemplateSubjectMaxId: classTemplateSubjectAggregate._max.id,
			classTemplateSubjectMaxCreatedAt: iso(classTemplateSubjectAggregate._max.createdAt),
		}),
		derivedDemand: buildDomainSnapshot(derivedDemandSignals),
	};

	return {
		schemaVersion: 1,
		schoolId,
		schoolYearId,
		computedAt: new Date().toISOString(),
		fingerprint: hashPayload(domains),
		domains,
	};
}

export async function compareCurrentInputsForRun(
	summary: unknown,
	schoolId: number,
	schoolYearId: number,
): Promise<GenerationInputComparison> {
	try {
		const currentSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId);
		const runSnapshot = extractGenerationInputSnapshot(summary);
		return compareGenerationInputSnapshots(runSnapshot, currentSnapshot);
	} catch {
		return {
			status: 'UNKNOWN',
			message: 'ATLAS could not check whether this draft still matches the latest setup data.',
			actionHint: 'Keep reviewing the current draft, then refresh or regenerate if you need a fully checked schedule.',
			changedDomains: [],
			checkedAt: new Date().toISOString(),
			missingReason: 'COMPARISON_FAILED',
		};
	}
}
