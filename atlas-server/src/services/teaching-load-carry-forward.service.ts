/**
 * TL-RR01 — Teaching Load rollover carry-forward.
 *
 * One optional, audited workflow that lets a privileged actor reuse compatible
 * assignments from a same-school ARCHIVED year into the sole ACTIVE,
 * non-archived year. The preview is strictly set-based and zero-write; the apply
 * is a privileged, fingerprinted, Serializable transaction that is implemented
 * but never invoked against live data by this stream.
 *
 * Authority model:
 *  - Source reads are immutable: archived `SubjectSectionOwnership` /
 *    `FacultySubject` rows are never updated, created, or deleted.
 *  - Faculty are matched ONLY by stable external identity (never by row id).
 *  - Sections are matched by canonical grade + program + normalized name
 *    (never by old external/database id alone).
 *  - The target demand authority is `DERIVED_DEMAND_V2`; archived reference-only
 *    Subjects and obsolete demand are excluded.
 *  - Qualification, subject minutes, workload policy, actual teaching minutes,
 *    and hard caps are re-resolved against CURRENT target-year data. Advisory
 *    credit is neutral and can never hide a real teaching overload.
 *  - Fill-empty-only: an occupied target pair is always preserved.
 */

import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { canonicalStringify } from '../lib/canonical-json.js';
import { getDataContext } from '../lib/data-context.js';
import { computeTeachingLoadMinutes } from './faculty-assignment.service.js';
import { HG_SUBJECT_CODE } from './hg-advisory.service.js';
import { buildDepartmentAuthoritySourceRevision } from './department-authority.service.js';
import { buildDerivedDemand, type DerivedDemandResult, type DerivedTeachingLoadPair } from './derived-demand.service.js';
import {
	buildQualificationPolicySnapshot,
	evaluateQualificationWithPolicy,
	type QualificationPolicy,
} from './qualification-evaluator.service.js';
import { resolveEffectiveWorkloadPolicy } from './scheduling-policy.service.js';
import { readTeachingLoadCycleSource, refreshTeachingLoadCycle } from './teaching-load-cycle.service.js';
import { WORKLOAD_DEFAULTS } from './workload-policy.service.js';

const db = () => getDataContext();

const SCHEMA_VERSION = 'TL-RR01.1';
export const TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION = 'APPLY TEACHING LOAD CARRY-FORWARD';
export const PROGRAM_TYPE_VOCABULARY = ['REGULAR', 'STE', 'SPS', 'SPA'] as const;

// ─── Errors ──────────────────────────────────────────────────────────────────

type CarryForwardError = Error & { statusCode: number; code: string };

function err(statusCode: number, code: string, message: string): CarryForwardError {
	const error = new Error(message) as CarryForwardError;
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

export function isTransactionConflictError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034';
}

// ─── Canonical matching primitives (pure) ────────────────────────────────────

export function normalizeCarryForwardSectionName(name: string | null | undefined): string {
	return (name ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeCarryForwardProgramType(programType: string | null | undefined): string {
	const upper = (programType ?? '').trim().toUpperCase();
	if ((PROGRAM_TYPE_VOCABULARY as readonly string[]).includes(upper)) return upper;
	return 'OTHER';
}

/**
 * Canonical section identity: grade + program + normalized name. Deliberately
 * excludes every database/external id so a re-IDed but semantically identical
 * section still matches, and an id-reused but renamed section does not.
 */
export function canonicalCarryForwardSectionKey(
	gradeLevel: number,
	programType: string | null | undefined,
	name: string,
): string {
	return `${gradeLevel}:${normalizeCarryForwardProgramType(programType)}:${normalizeCarryForwardSectionName(name)}`;
}

export interface CarryForwardSectionCandidate {
	sectionMirrorId: number;
	externalId: number;
	gradeLevel: number;
	programType: string | null;
	name: string;
}

export type CarryForwardSectionMatch =
	| { status: 'MATCH'; section: CarryForwardSectionCandidate }
	| { status: 'MISSING' }
	| { status: 'AMBIGUOUS'; candidates: CarryForwardSectionCandidate[] };

/**
 * Resolve a source section to exactly one target section by canonical identity.
 * Zero matches is MISSING; more than one distinct section sharing the canonical
 * identity is AMBIGUOUS (never an arbitrary pick).
 */
export function matchTargetSectionByCanonicalKey(
	source: Pick<CarryForwardSectionCandidate, 'gradeLevel' | 'programType' | 'name'>,
	targetSections: readonly CarryForwardSectionCandidate[],
): CarryForwardSectionMatch {
	const key = canonicalCarryForwardSectionKey(source.gradeLevel, source.programType, source.name);
	const matches = targetSections.filter(
		(section) => canonicalCarryForwardSectionKey(section.gradeLevel, section.programType, section.name) === key,
	);
	if (matches.length === 0) return { status: 'MISSING' };
	if (matches.length > 1) return { status: 'AMBIGUOUS', candidates: [...matches] };
	return { status: 'MATCH', section: matches[0] };
}

export interface CarryForwardFacultyCandidate {
	facultyMirrorId: number;
	externalId: number;
	employeeId: string | null;
}

export type CarryForwardFacultyMatch =
	| { status: 'MATCH'; faculty: CarryForwardFacultyCandidate }
	| { status: 'MISSING' }
	| { status: 'AMBIGUOUS'; candidates: CarryForwardFacultyCandidate[] };

/**
 * Resolve a source faculty identity to exactly one current faculty row using the
 * stable external identity only. Never matches by ATLAS row id.
 */
export function matchTargetFacultyByExternalIdentity<T extends CarryForwardFacultyCandidate>(
	source: CarryForwardFacultyCandidate | null | undefined,
	targetFaculty: readonly T[],
): { status: 'MATCH'; faculty: T } | { status: 'MISSING' } | { status: 'AMBIGUOUS'; candidates: T[] } {
	if (!source) return { status: 'MISSING' };
	const matches = targetFaculty.filter((faculty) => faculty.externalId === source.externalId);
	if (matches.length === 0) return { status: 'MISSING' };
	if (matches.length > 1) return { status: 'AMBIGUOUS', candidates: [...matches] };
	return { status: 'MATCH', faculty: matches[0] };
}

// ─── Classification (pure) ───────────────────────────────────────────────────

export type CarryForwardReason =
	| 'EXACT_CARRY'
	| 'ALREADY_OCCUPIED'
	| 'MISSING_FACULTY'
	| 'MISSING_SECTION'
	| 'NO_CURRENT_DEMAND'
	| 'UNQUALIFIED'
	| 'CAP_BLOCKED'
	| 'AMBIGUOUS'
	| 'OTHER';

export interface CarryForwardRowDecisionInput {
	targetSubjectResolved: boolean;
	targetSubjectActive: boolean;
	/** false when the source section could not be read from the archived year. */
	sourceSectionResolved: boolean;
	targetSectionMatch: 'MATCH' | 'MISSING' | 'AMBIGUOUS';
	/** true when another source row maps to the same target pair identity. */
	duplicateSourcePair: boolean;
	inCurrentDemand: boolean;
	alreadyOccupied: boolean;
	facultyResolved: boolean;
	facultyActive: boolean;
	qualified: boolean;
	capBlocked: boolean;
}

/**
 * Deterministic row disposition for the preview. The order encodes the
 * fill-empty-only contract: an occupied target pair is always preserved and is
 * never reported as carried.
 */
export function classifyCarryForwardRow(input: CarryForwardRowDecisionInput): CarryForwardReason {
	if (input.targetSectionMatch === 'AMBIGUOUS' || input.duplicateSourcePair) return 'AMBIGUOUS';
	if (input.targetSectionMatch === 'MISSING' || !input.sourceSectionResolved) return 'MISSING_SECTION';
	if (!input.targetSubjectResolved || !input.targetSubjectActive) return 'NO_CURRENT_DEMAND';
	if (!input.inCurrentDemand) return 'NO_CURRENT_DEMAND';
	if (input.alreadyOccupied) return 'ALREADY_OCCUPIED';
	if (!input.facultyResolved || !input.facultyActive) return 'MISSING_FACULTY';
	if (!input.qualified) return 'UNQUALIFIED';
	if (input.capBlocked) return 'CAP_BLOCKED';
	return 'EXACT_CARRY';
}

// ─── Fingerprint ─────────────────────────────────────────────────────────────

function sha256Upper(value: unknown): string {
	return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex').toUpperCase();
}

// ─── Snapshot types ──────────────────────────────────────────────────────────

export interface CarryForwardYearAuthority {
	mirrorId: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isActive: boolean;
	isArchived: boolean;
	syncStatus: string;
	archivedAt: string | null;
	archiveReason: string | null;
	updatedAt: string;
}

export interface CarryForwardCycleSnapshot {
	state: 'EMPTY' | 'POPULATED' | 'UNCONFIGURED' | 'MISMATCH';
	version: number;
	ownershipCount: number;
}

export interface CarryForwardSourceRow {
	ownershipId: number;
	sourceFacultyId: number;
	sourceFacultyExternalId: number | null;
	sourceSectionExternalId: number;
	sourceSubjectId: number;
	sourceSubjectCode: string | null;
}

export interface CarryForwardTargetSection {
	sectionMirrorId: number;
	externalId: number;
	gradeLevel: number;
	programType: string | null;
	name: string;
}

export interface CarryForwardTargetFaculty {
	facultyMirrorId: number;
	externalId: number;
	employeeId: string | null;
	firstName: string;
	lastName: string;
	department: string | null;
	specialization: string | null;
	canTeachOutsideDepartment: boolean;
	isClassAdviser: boolean;
	advisedSectionId: number | null;
	isActiveForScheduling: boolean;
	isPlaceholder: boolean;
	isStale: boolean;
	version: number;
}

export interface CarryForwardTargetSubject {
	id: number;
	code: string;
	name: string;
	minMinutesPerWeek: number;
	programScopes: string[];
	gradeLevels: number[];
	allowedSpecializations: string[];
	ownerDepartment: string | null;
	rotationFamily: string | null;
	modularGroupId: string | null;
	modularOrder: number | null;
	termGroupId: string | null;
	termCount: number | null;
	isActive: boolean;
	schedulingDisposition: 'SCHEDULED_TEACHING' | 'REFERENCE_ONLY';
}

interface CarryForwardDepartmentAuthority {
	aliases: Array<{ alias: string; department: string }>;
	labels: Array<{ code: string; label: string }>;
	subjectOwnerPrefixes: Array<{ prefix: string; department: string }>;
	crossDepartmentPermissions: Array<{ facultyId: number; subjectId: number }>;
	specializationAliases: Array<{ alias: string; canonical: string }>;
	revisionHash: string;
}

export interface CarryForwardWorkloadPolicy {
	teachingStandardMinutes: number;
	advisoryCreditMinutes: number;
	hardCapMinutes: number;
	status: 'CONFIGURED' | 'UNCONFIGURED';
}

export interface CarryForwardTargetOwnershipRow {
	ownershipId: number;
	subjectId: number;
	sectionId: number;
	facultyId: number;
}

export interface CarryForwardSourceSnapshot {
	authority: CarryForwardYearAuthority;
	cycle: CarryForwardCycleSnapshot;
	rows: CarryForwardSourceRow[];
	facultyExternalIdByFacultyId: Map<number, { externalId: number; employeeId: string | null }>;
	sectionsByExternalId: Map<number, CarryForwardSectionCandidate>;
	subjectCodeBySubjectId: Map<number, string>;
	revision: string;
}

export interface CarryForwardTargetSnapshot {
	authority: CarryForwardYearAuthority;
	cycle: CarryForwardCycleSnapshot;
	sections: CarryForwardTargetSection[];
	faculty: CarryForwardTargetFaculty[];
	subjects: CarryForwardTargetSubject[];
	ownership: CarryForwardTargetOwnershipRow[];
	facultySubjects: Array<{ id: number; facultyId: number; subjectId: number; sectionIds: number[]; gradeLevels: number[]; version: number }>;
	department: CarryForwardDepartmentAuthority;
	workloadPolicy: CarryForwardWorkloadPolicy;
	derivedDemand: DerivedDemandResult;
	revision: string;
}

// ─── Row / plan output ───────────────────────────────────────────────────────

export interface CarryForwardPlanRow {
	sourceOwnershipId: number;
	sourceFacultyId: number;
	sourceFacultyExternalId: number | null;
	sourceSectionExternalId: number;
	sourceSubjectId: number;
	sourceSubjectCode: string | null;
	sourceSectionKey: string | null;
	reason: CarryForwardReason;
	action: 'CARRY' | 'SKIP';
	targetSubjectId: number | null;
	targetSubjectCode: string | null;
	targetSectionMirrorId: number | null;
	targetSectionExternalId: number | null;
	targetSectionKey: string | null;
	targetFacultyId: number | null;
	targetFacultyExternalId: number | null;
	targetFacultyName: string | null;
	targetDepartment: string | null;
	weeklyMinutes: number;
	qualificationTier: number | null;
	detail: string | null;
}

export interface CarryForwardWorkloadChange {
	facultyId: number;
	name: string;
	beforeMinutes: number;
	afterMinutes: number;
	beforeStatus: string;
	afterStatus: string;
	changed: boolean;
}

export interface CarryForwardAdviserOutcome {
	facultyId: number;
	sectionId: number;
	satisfied: boolean;
	reason: string;
}

export interface CarryForwardDepartmentReview {
	department: string;
	carry: number;
	skipped: number;
}

export interface CarryForwardDistribution {
	zeroLoad: number;
	adviserOnly: number;
	belowStandard: number;
	atStandard: number;
	excess: number;
	overCap: number;
}

export interface CarryForwardPlan {
	sourceRevision: string;
	targetRevision: string;
	derivedDemandRevision: string | null;
	fingerprint: string;
	rows: CarryForwardPlanRow[];
	totals: Record<CarryForwardReason, number>;
	carriedRows: CarryForwardPlanRow[];
	beforeMinutes: Map<number, number>;
	afterMinutes: Map<number, number>;
}

// ─── Workload math (mirrors the production summary read path) ────────────────

type AssignedPairInput = { subject: CarryForwardTargetSubject; sectionId: number };

function minutesForPairs(pairs: AssignedPairInput[]): number {
	const bySubject = new Map<number, AssignedPairInput[]>();
	for (const pair of pairs) {
		const list = bySubject.get(pair.subject.id) ?? [];
		list.push(pair);
		bySubject.set(pair.subject.id, list);
	}
	const assignments = [...bySubject.entries()].map(([subjectId, list]) => {
		const subject = list[0].subject;
		return {
			subject: {
				id: subject.id,
				code: subject.code,
				rotationFamily: subject.rotationFamily,
				modularGroupId: subject.modularGroupId,
				modularOrder: subject.modularOrder,
				termGroupId: subject.termGroupId,
				termCount: subject.termCount,
				minMinutesPerWeek: subject.minMinutesPerWeek,
			},
			sectionIds: [...new Set(list.map((pair) => pair.sectionId))].sort((a, b) => a - b),
			gradeLevels: [] as number[],
		};
	});
	return computeTeachingLoadMinutes(assignments, 'section');
}

function workloadStatusOf(minutes: number, policy: CarryForwardWorkloadPolicy): string {
	if (minutes <= 0) return 'zero-load';
	if (policy.status !== 'CONFIGURED') return 'below-standard';
	if (minutes > policy.hardCapMinutes) return 'over-cap';
	if (minutes > policy.teachingStandardMinutes) return 'excess';
	if (minutes === policy.teachingStandardMinutes) return 'at-standard';
	return 'below-standard';
}

function distributionOf(
	faculty: CarryForwardTargetFaculty[],
	minutesByFaculty: Map<number, number>,
	policy: CarryForwardWorkloadPolicy,
	activeSectionIds: Set<number>,
): CarryForwardDistribution {
	let zeroLoad = 0;
	let adviserOnly = 0;
	let belowStandard = 0;
	let atStandard = 0;
	let excess = 0;
	let overCap = 0;
	for (const member of faculty) {
		if (!member.isActiveForScheduling || member.isStale || member.isPlaceholder) continue;
		const minutes = minutesByFaculty.get(member.facultyMirrorId) ?? 0;
		const status = workloadStatusOf(minutes, policy);
		if (status === 'zero-load') {
			zeroLoad += 1;
			if (member.isClassAdviser && member.advisedSectionId != null && activeSectionIds.has(member.advisedSectionId)) {
				adviserOnly += 1;
			}
		} else if (status === 'below-standard') belowStandard += 1;
		else if (status === 'at-standard') atStandard += 1;
		else if (status === 'excess') excess += 1;
		else if (status === 'over-cap') overCap += 1;
	}
	return { zeroLoad, adviserOnly, belowStandard, atStandard, excess, overCap };
}

// ─── Authority resolution ────────────────────────────────────────────────────

interface YearMirrorRow {
	id: number;
	enrollProSchoolYearId: number;
	yearLabel: string;
	isActive: boolean;
	isArchived: boolean;
	syncStatus: string;
	archivedAt: Date | null;
	archiveReason: string | null;
	updatedAt: Date;
}

function serializeAuthority(mirror: YearMirrorRow): CarryForwardYearAuthority {
	return {
		mirrorId: mirror.id,
		enrollProSchoolYearId: mirror.enrollProSchoolYearId,
		yearLabel: mirror.yearLabel,
		isActive: mirror.isActive,
		isArchived: mirror.isArchived,
		syncStatus: mirror.syncStatus,
		archivedAt: mirror.archivedAt ? new Date(mirror.archivedAt).toISOString() : null,
		archiveReason: mirror.archiveReason ?? null,
		updatedAt: new Date(mirror.updatedAt).toISOString(),
	};
}

export interface CarryForwardYearResolution {
	actorSchoolId: number;
	source: YearMirrorRow;
	target: YearMirrorRow;
}

async function resolveCarryForwardYears(
	client: unknown,
	actorSchoolId: number | null | undefined,
	schoolId: number,
	targetYearId: number,
	sourceYearId: number,
): Promise<CarryForwardYearResolution> {
	if (actorSchoolId == null) throw err(403, 'ACTOR_SCHOOL_REQUIRED', 'Carry-forward requires an authenticated actor school.');
	if (!Number.isInteger(actorSchoolId) || actorSchoolId <= 0 || actorSchoolId !== schoolId) {
		throw err(403, 'SCHOOL_MISMATCH', 'Request school does not match the authenticated actor school.');
	}
	if (!Number.isInteger(targetYearId) || targetYearId <= 0) throw err(400, 'INVALID_PARAM', 'targetSchoolYearId must be a positive integer.');
	if (!Number.isInteger(sourceYearId) || sourceYearId <= 0) throw err(400, 'INVALID_PARAM', 'sourceSchoolYearId must be a positive integer.');
	if (targetYearId === sourceYearId) throw err(409, 'SAME_YEAR', 'The carry-forward source and target years must be different.');

	const tx = client as any;
	const select = {
		id: true,
		enrollProSchoolYearId: true,
		yearLabel: true,
		isActive: true,
		isArchived: true,
		syncStatus: true,
		archivedAt: true,
		archiveReason: true,
		updatedAt: true,
	} as const;

	const [mirrors, activeMirrors] = await Promise.all([
		tx.enrollProSchoolYearMirror.findMany({ where: { schoolId }, select }),
		tx.enrollProSchoolYearMirror.findMany({ where: { schoolId, isActive: true, isArchived: false }, select, orderBy: [{ enrollProSchoolYearId: 'asc' }, { id: 'asc' }] }),
	]);

	const target = (mirrors as YearMirrorRow[]).find((mirror) => mirror.enrollProSchoolYearId === targetYearId);
	if (!target) throw err(404, 'YEAR_MIRROR_NOT_FOUND', 'No school-year mirror exists for the requested target year.');
	if (target.isArchived) throw err(409, 'TARGET_ARCHIVED', 'The target school year is archived and cannot receive carried-forward Teaching Load.');
	if (activeMirrors.length === 0) throw err(409, 'ACTIVE_YEAR_UNAVAILABLE', 'No active, non-archived school-year mirror exists for this school.');
	if ((activeMirrors as YearMirrorRow[]).length > 1) throw err(409, 'ACTIVE_YEAR_AMBIGUOUS', 'More than one active, non-archived school-year mirror exists for this school. Resolve the school-year authority before carrying forward.');
	if ((activeMirrors as YearMirrorRow[])[0].enrollProSchoolYearId !== targetYearId) {
		throw err(409, 'TARGET_NOT_ACTIVE', 'The requested target year is not the sole active, non-archived year.');
	}

	const source = (mirrors as YearMirrorRow[]).find((mirror) => mirror.enrollProSchoolYearId === sourceYearId);
	if (!source) throw err(404, 'SOURCE_YEAR_NOT_FOUND', 'No school-year mirror exists for the requested source year.');
	if (!source.isArchived) throw err(409, 'SOURCE_NOT_ARCHIVED', 'The carry-forward source year must be archived read-only history.');

	return { actorSchoolId, source, target };
}

function cycleSnapshot(
	read: { source: { state: string; version: number }; diagnostic?: unknown },
	ownershipCount: number,
): CarryForwardCycleSnapshot {
	const diagnostic = read.diagnostic as { mismatched?: boolean } | null | undefined;
	if (read.source.state === 'UNCONFIGURED') return { state: 'UNCONFIGURED', version: read.source.version, ownershipCount };
	if (diagnostic?.mismatched) return { state: 'MISMATCH', version: read.source.version, ownershipCount };
	const state = read.source.state === 'EMPTY' || read.source.state === 'POPULATED' ? read.source.state : 'UNCONFIGURED';
	return { state, version: read.source.version, ownershipCount };
}

// ─── Snapshot reads ──────────────────────────────────────────────────────────

export async function readCarryForwardSourceSnapshot(
	client: unknown,
	schoolId: number,
	sourceYearId: number,
	resolution: CarryForwardYearResolution,
): Promise<CarryForwardSourceSnapshot> {
	const tx = client as any;
	const [ownershipRows, sourceSections, faculties, subjects, cycleRead] = await Promise.all([
		tx.subjectSectionOwnership.findMany({
			where: { schoolId, schoolYearId: sourceYearId },
			select: { id: true, facultyId: true, subjectId: true, sectionId: true, facultySubjectId: true },
			orderBy: [{ sectionId: 'asc' }, { subjectId: 'asc' }],
		}),
		tx.sectionMirror.findMany({
			where: { schoolId, schoolYearId: sourceYearId },
			select: { externalId: true, name: true, displayOrder: true, programType: true },
		}),
		tx.facultyMirror.findMany({ where: { schoolId }, select: { id: true, externalId: true, employeeId: true } }),
		tx.subject.findMany({ where: { schoolId }, select: { id: true, code: true } }),
		readTeachingLoadCycleSource(schoolId, sourceYearId, tx),
	]);

	const facultyExternalIdByFacultyId = new Map<number, { externalId: number; employeeId: string | null }>();
	for (const faculty of faculties as any[]) {
		facultyExternalIdByFacultyId.set(faculty.id, { externalId: faculty.externalId, employeeId: faculty.employeeId ?? null });
	}
	const sectionsByExternalId = new Map<number, CarryForwardSectionCandidate>();
	for (const section of sourceSections as any[]) {
		sectionsByExternalId.set(section.externalId, {
			sectionMirrorId: 0,
			externalId: section.externalId,
			gradeLevel: section.displayOrder,
			programType: section.programType,
			name: section.name,
		});
	}
	const subjectCodeBySubjectId = new Map<number, string>();
	for (const subject of subjects as any[]) subjectCodeBySubjectId.set(subject.id, subject.code);

	const rows: CarryForwardSourceRow[] = (ownershipRows as any[]).map((row) => ({
		ownershipId: row.id,
		sourceFacultyId: row.facultyId,
		sourceFacultyExternalId: facultyExternalIdByFacultyId.get(row.facultyId)?.externalId ?? null,
		sourceSectionExternalId: row.sectionId,
		sourceSubjectId: row.subjectId,
		sourceSubjectCode: subjectCodeBySubjectId.get(row.subjectId) ?? null,
	}));

	const revision = sha256Upper({
		schemaVersion: SCHEMA_VERSION,
		kind: 'TL_CARRY_FORWARD_SOURCE',
		schoolId,
		sourceYearId,
		authority: serializeAuthority(resolution.source),
		cycle: {
			state: cycleRead.source.state,
			version: cycleRead.source.version,
		},
		rows: [...rows]
			.map((row) => ({
				ownershipId: row.ownershipId,
				facultyExternalId: row.sourceFacultyExternalId,
				sectionExternalId: row.sourceSectionExternalId,
				subjectCode: row.sourceSubjectCode,
			}))
			.sort((a, b) => a.ownershipId - b.ownershipId),
	});

	return {
		authority: serializeAuthority(resolution.source),
		cycle: cycleSnapshot(cycleRead as never, rows.length),
		rows,
		facultyExternalIdByFacultyId,
		sectionsByExternalId,
		subjectCodeBySubjectId,
		revision,
	};
}

export async function readCarryForwardTargetSnapshot(
	client: unknown,
	schoolId: number,
	targetYearId: number,
	resolution: CarryForwardYearResolution,
): Promise<CarryForwardTargetSnapshot> {
	const tx = client as any;
	const derivedDemand = await buildDerivedDemand(schoolId, targetYearId, { client: tx });

	const [
		sections,
		faculty,
		subjects,
		ownership,
		facultySubjects,
		departmentAliasRows,
		departmentLabelRows,
		subjectOwnerPrefixRows,
		crossDepartmentPermissions,
		specializationAliases,
		policyRow,
		cycleRead,
	] = await Promise.all([
		tx.sectionMirror.findMany({
			where: { schoolId, schoolYearId: targetYearId, isActiveForScheduling: true, isStale: false },
			select: { id: true, externalId: true, name: true, displayOrder: true, programType: true },
		}),
		tx.facultyMirror.findMany({ where: { schoolId }, orderBy: { id: 'asc' } }),
		tx.subject.findMany({ where: { schoolId } }),
		tx.subjectSectionOwnership.findMany({
			where: { schoolId, schoolYearId: targetYearId },
			select: { id: true, subjectId: true, sectionId: true, facultyId: true },
		}),
		tx.facultySubject.findMany({ where: { schoolId, schoolYearId: targetYearId }, select: { id: true, facultyId: true, subjectId: true, sectionIds: true, gradeLevels: true, version: true } }),
		tx.departmentAlias.findMany({ where: { schoolId }, select: { alias: true, department: true } }),
		tx.departmentLabel.findMany({ where: { schoolId }, select: { code: true, label: true } }),
		tx.subjectOwnerPrefix.findMany({ where: { schoolId }, select: { prefix: true, department: true } }),
		tx.crossDepartmentPermission.findMany({ where: { schoolId }, select: { facultyId: true, subjectId: true } }),
		tx.specializationAlias.findMany({ where: { schoolId }, select: { alias: true, canonical: true } }),
		tx.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId: targetYearId } },
			select: { teachingStandardMinutes: true, advisoryCreditMinutes: true, hardCapMinutes: true },
		}),
		readTeachingLoadCycleSource(schoolId, targetYearId, tx),
	]);

	const workloadResolution = resolveEffectiveWorkloadPolicy(policyRow);
	const departmentRevision = await buildDepartmentAuthoritySourceRevision(
		schoolId,
		departmentAliasRows as never,
		departmentLabelRows as never,
		null,
		null,
	);

	return {
		authority: serializeAuthority(resolution.target),
		cycle: cycleSnapshot(cycleRead as never, (ownership as any[]).length),
		sections: (sections as any[]).map((section) => ({
			sectionMirrorId: section.id,
			externalId: section.externalId,
			gradeLevel: section.displayOrder,
			programType: section.programType,
			name: section.name,
		})),
		faculty: (faculty as any[]).map((member) => ({
			facultyMirrorId: member.id,
			externalId: member.externalId,
			employeeId: member.employeeId ?? null,
			firstName: member.firstName,
			lastName: member.lastName,
			department: member.department,
			specialization: member.specialization,
			canTeachOutsideDepartment: member.canTeachOutsideDepartment,
			isClassAdviser: member.isClassAdviser,
			advisedSectionId: member.advisedSectionId,
			isActiveForScheduling: member.isActiveForScheduling,
			isPlaceholder: member.isPlaceholder,
			isStale: member.isStale,
			version: member.version,
		})),
		subjects: (subjects as any[]).map((subject) => ({
			id: subject.id,
			code: subject.code,
			name: subject.name,
			minMinutesPerWeek: subject.minMinutesPerWeek,
			programScopes: subject.programScopes,
			gradeLevels: subject.gradeLevels,
			allowedSpecializations: subject.allowedSpecializations,
			ownerDepartment: subject.ownerDepartment,
			rotationFamily: subject.rotationFamily,
			modularGroupId: subject.modularGroupId,
			modularOrder: subject.modularOrder,
			termGroupId: subject.termGroupId,
			termCount: subject.termCount,
			isActive: subject.isActive,
			schedulingDisposition: subject.schedulingDisposition === 'REFERENCE_ONLY' ? 'REFERENCE_ONLY' : 'SCHEDULED_TEACHING',
		})),
		ownership: (ownership as any[]).map((row) => ({ ownershipId: row.id, subjectId: row.subjectId, sectionId: row.sectionId, facultyId: row.facultyId })),
		facultySubjects: (facultySubjects as any[]).map((row) => ({ id: row.id, facultyId: row.facultyId, subjectId: row.subjectId, sectionIds: row.sectionIds, gradeLevels: row.gradeLevels, version: row.version })),
		department: {
			aliases: departmentAliasRows as never,
			labels: departmentLabelRows as never,
			subjectOwnerPrefixes: subjectOwnerPrefixRows as never,
			crossDepartmentPermissions: crossDepartmentPermissions as never,
			specializationAliases: specializationAliases as never,
			revisionHash: departmentRevision.revisionHash,
		},
		workloadPolicy: workloadResolution.policy
			? { ...workloadResolution.policy, status: 'CONFIGURED' }
			: { ...WORKLOAD_DEFAULTS, status: 'UNCONFIGURED' },
		derivedDemand,
		revision: sha256Upper({
			schemaVersion: SCHEMA_VERSION,
			kind: 'TL_CARRY_FORWARD_TARGET',
			schoolId,
			targetYearId,
			authority: serializeAuthority(resolution.target),
			cycle: { state: cycleRead.source.state, version: cycleRead.source.version },
			derivedDemandRevision: derivedDemand.ok ? derivedDemand.revision : null,
			derivedDemandBlockers: derivedDemand.ok ? [] : derivedDemand.blockers.map((blocker) => blocker.code).sort(),
			sections: [...(sections as any[])].map((row) => ({ id: row.id, externalId: row.externalId, name: row.name, displayOrder: row.displayOrder, programType: row.programType })).sort((a, b) => a.id - b.id),
			faculty: (faculty as any[]).map((row) => ({ id: row.id, externalId: row.externalId, department: row.department, specialization: row.specialization, canTeachOutsideDepartment: row.canTeachOutsideDepartment, isClassAdviser: row.isClassAdviser, advisedSectionId: row.advisedSectionId, isActiveForScheduling: row.isActiveForScheduling, isPlaceholder: row.isPlaceholder, isStale: row.isStale, version: row.version })).sort((a, b) => a.id - b.id),
			subjects: (subjects as any[]).map((row) => ({ id: row.id, code: row.code, minMinutesPerWeek: row.minMinutesPerWeek, programScopes: row.programScopes, gradeLevels: row.gradeLevels, allowedSpecializations: row.allowedSpecializations, ownerDepartment: row.ownerDepartment, rotationFamily: row.rotationFamily, modularOrder: row.modularOrder, termMode: row.termGroupId, isActive: row.isActive, schedulingDisposition: row.schedulingDisposition })).sort((a, b) => a.id - b.id),
			ownership: (ownership as any[]).map((row) => ({ id: row.id, subjectId: row.subjectId, sectionId: row.sectionId, facultyId: row.facultyId })).sort((a, b) => a.id - b.id),
			facultySubjects: (facultySubjects as any[]).map((row) => ({ id: row.id, facultyId: row.facultyId, subjectId: row.subjectId, sectionIds: [...row.sectionIds].sort((x: number, y: number) => x - y), version: row.version })).sort((a, b) => a.id - b.id),
			departmentRevision: departmentRevision.revisionHash,
			workloadPolicy: workloadResolution.policy,
		}),
	};
}

// ─── Qualification resolver ──────────────────────────────────────────────────

type CarryForwardQualificationResolver = (facultyId: number, subjectId: number, sectionProgramType: string) => Promise<{ eligible: boolean; tier: number | null }>;

export function buildCarryForwardQualificationResolver(
	snapshot: CarryForwardTargetSnapshot,
	schoolId = 0,
): CarryForwardQualificationResolver {
	const policy: QualificationPolicy = buildQualificationPolicySnapshot(
		schoolId,
		{
			departmentAliases: snapshot.department.aliases,
			departmentLabels: snapshot.department.labels,
			subjectOwnerPrefixes: snapshot.department.subjectOwnerPrefixes,
			crossDepartmentPermissions: snapshot.department.crossDepartmentPermissions,
			legacyCrossLanguageException: false,
			persistedOnly: true,
		},
	);
	const subjectById = new Map(snapshot.subjects.map((subject) => [subject.id, subject]));
	const facultyById = new Map(snapshot.faculty.map((member) => [member.facultyMirrorId, member]));
	const cache = new Map<string, { eligible: boolean; tier: number | null }>();

	return async (facultyId, subjectId, sectionProgramType) => {
		const cacheKey = `${facultyId}:${subjectId}:${normalizeCarryForwardProgramType(sectionProgramType)}`;
		const cached = cache.get(cacheKey);
		if (cached) return cached;
		const subject = subjectById.get(subjectId);
		const member = facultyById.get(facultyId);
		if (!subject || !member) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}
		if (subject.code.toUpperCase() === HG_SUBJECT_CODE) {
			cache.set(cacheKey, { eligible: false, tier: null });
			return { eligible: false, tier: null };
		}
		const result = evaluateQualificationWithPolicy(
			{
				facultyId: member.facultyMirrorId,
				facultyDepartment: member.department,
				facultySpecialization: member.specialization,
				canTeachOutsideDepartment: member.canTeachOutsideDepartment,
				subjectId: subject.id,
				subjectCode: subject.code,
				subjectName: subject.name,
				subjectOwnerDepartment: subject.ownerDepartment,
				subjectAllowedDepartments: subject.ownerDepartment ? [subject.ownerDepartment] : [],
				subjectAllowedSpecializations: subject.allowedSpecializations,
				subjectProgramScopes: subject.programScopes as never,
				sectionProgramType: normalizeCarryForwardProgramType(sectionProgramType) as never,
				specializationAliases: snapshot.department.specializationAliases,
			},
			policy,
		);
		const value = { eligible: result.eligible, tier: result.tier };
		cache.set(cacheKey, value);
		return value;
	};
}

// ─── Plan builder ────────────────────────────────────────────────────────────

function demandPairKey(subjectId: number, sectionExternalId: number): string {
	return `${subjectId}:${sectionExternalId}`;
}

export async function buildCarryForwardPlan(
	source: CarryForwardSourceSnapshot,
	target: CarryForwardTargetSnapshot,
	schoolId = 0,
): Promise<CarryForwardPlan> {
	const qualification = buildCarryForwardQualificationResolver(target, schoolId);

	const targetSubjectByCode = new Map<string, CarryForwardTargetSubject>();
	for (const subject of target.subjects) targetSubjectByCode.set(subject.code.trim().toUpperCase(), subject);
	const targetFacultyByExternalId = new Map<number, CarryForwardTargetFaculty>();
	for (const member of target.faculty) targetFacultyByExternalId.set(member.externalId, member);
	const targetFacultyByMirrorId = new Map<number, CarryForwardTargetFaculty>();
	for (const member of target.faculty) targetFacultyByMirrorId.set(member.facultyMirrorId, member);
	const subjectById = new Map(target.subjects.map((subject) => [subject.id, subject]));
	const sectionByMirrorId = new Map(target.sections.map((section) => [section.sectionMirrorId, section]));

	const demandPairs: DerivedTeachingLoadPair[] = target.derivedDemand.ok ? target.derivedDemand.teachingLoadPairs : [];
	const demandPairKeys = new Set(demandPairs.map((pair) => demandPairKey(pair.subjectId, pair.sectionExternalId)));

	const ownedPairKeys = new Set(target.ownership.map((row) => demandPairKey(row.subjectId, row.sectionId)));

	// Simulated target teaching load (advisory/ancillary intentionally excluded).
	const assignedByFaculty = new Map<number, AssignedPairInput[]>();
	for (const row of target.ownership) {
		const subject = subjectById.get(row.subjectId);
		if (!subject || subject.code.toUpperCase() === HG_SUBJECT_CODE) continue;
		const list = assignedByFaculty.get(row.facultyId) ?? [];
		list.push({ subject, sectionId: row.sectionId });
		assignedByFaculty.set(row.facultyId, list);
	}
	const simulatedMinutes = new Map<number, number>();
	const recomputeMinutes = () => {
		for (const [facultyId, pairs] of assignedByFaculty) simulatedMinutes.set(facultyId, minutesForPairs(pairs));
	};
	recomputeMinutes();

	const hardCap = target.workloadPolicy.status === 'CONFIGURED' ? target.workloadPolicy.hardCapMinutes : Number.POSITIVE_INFINITY;

	// Detect duplicate source rows that would resolve to the same target pair.
	const resolvedTargetPairByRow = new Map<number, { targetPairKey: string | null; sectionMirrorId: number | null; subjectId: number | null }>();
	const pairKeyCounts = new Map<string, number>();
	for (const row of source.rows) {
		const sourceSection = source.sectionsByExternalId.get(row.sourceSectionExternalId) ?? null;
		const subject = row.sourceSubjectCode ? targetSubjectByCode.get(row.sourceSubjectCode.trim().toUpperCase()) ?? null : null;
		let sectionMatch: CarryForwardSectionMatch = sourceSection ? matchTargetSectionByCanonicalKey(sourceSection, target.sections) : { status: 'MISSING' };
		const targetPairKey = sectionMatch.status === 'MATCH' && subject ? demandPairKey(subject.id, sectionMatch.section.externalId) : null;
		resolvedTargetPairByRow.set(row.ownershipId, { targetPairKey, sectionMirrorId: sectionMatch.status === 'MATCH' ? sectionMatch.section.sectionMirrorId : null, subjectId: subject?.id ?? null });
		if (targetPairKey) pairKeyCounts.set(targetPairKey, (pairKeyCounts.get(targetPairKey) ?? 0) + 1);
	}

	const rows: CarryForwardPlanRow[] = [];
	for (const row of source.rows) {
		const sourceSection = source.sectionsByExternalId.get(row.sourceSectionExternalId) ?? null;
		const subject = row.sourceSubjectCode ? targetSubjectByCode.get(row.sourceSubjectCode.trim().toUpperCase()) ?? null : null;
		const sectionMatch: CarryForwardSectionMatch = sourceSection
			? matchTargetSectionByCanonicalKey(sourceSection, target.sections)
			: { status: 'MISSING' };
		const resolved = resolvedTargetPairByRow.get(row.ownershipId)!;
		const duplicateSourcePair = resolved.targetPairKey != null && (pairKeyCounts.get(resolved.targetPairKey) ?? 0) > 1;

		const targetSection = sectionMatch.status === 'MATCH' ? sectionMatch.section : null;
		const inCurrentDemand = resolved.targetPairKey != null && demandPairKeys.has(resolved.targetPairKey);
		const alreadyOccupied = resolved.targetPairKey != null && ownedPairKeys.has(resolved.targetPairKey);

		const facultyMatch = matchTargetFacultyByExternalIdentity(
			row.sourceFacultyExternalId != null
				? { facultyMirrorId: row.sourceFacultyId, externalId: row.sourceFacultyExternalId, employeeId: null }
				: null,
			target.faculty,
		);
		const targetFaculty = facultyMatch.status === 'MATCH' ? facultyMatch.faculty : null;
		const facultyResolved = targetFaculty != null;
		const facultyActive = !!targetFaculty && targetFaculty.isActiveForScheduling && !targetFaculty.isStale && !targetFaculty.isPlaceholder;

		let qualified = false;
		let qualificationTier: number | null = null;
		if (targetFaculty && subject && targetSection && inCurrentDemand && !alreadyOccupied && facultyActive) {
			const resolution = await qualification(targetFaculty.facultyMirrorId, subject.id, targetSection.programType ?? 'REGULAR');
			qualified = resolution.eligible;
			qualificationTier = resolution.tier;
		}

		let capBlocked = false;
		if (qualified && targetFaculty && subject) {
			const current = simulatedMinutes.get(targetFaculty.facultyMirrorId) ?? 0;
			if (current + Math.max(0, subject.minMinutesPerWeek) > hardCap) capBlocked = true;
		}

		const reason = classifyCarryForwardRow({
			targetSubjectResolved: subject != null,
			targetSubjectActive: !!subject && subject.isActive && subject.schedulingDisposition === 'SCHEDULED_TEACHING',
			sourceSectionResolved: sourceSection != null,
			targetSectionMatch: sectionMatch.status,
			duplicateSourcePair,
			inCurrentDemand,
			alreadyOccupied,
			facultyResolved,
			facultyActive,
			qualified,
			capBlocked,
		});

		if (reason === 'EXACT_CARRY' && targetFaculty && subject && targetSection) {
			const list = assignedByFaculty.get(targetFaculty.facultyMirrorId) ?? [];
			list.push({ subject, sectionId: targetSection.externalId });
			assignedByFaculty.set(targetFaculty.facultyMirrorId, list);
			simulatedMinutes.set(targetFaculty.facultyMirrorId, minutesForPairs(list));
		}

		rows.push({
			sourceOwnershipId: row.ownershipId,
			sourceFacultyId: row.sourceFacultyId,
			sourceFacultyExternalId: row.sourceFacultyExternalId,
			sourceSectionExternalId: row.sourceSectionExternalId,
			sourceSubjectId: row.sourceSubjectId,
			sourceSubjectCode: row.sourceSubjectCode,
			sourceSectionKey: sourceSection
				? canonicalCarryForwardSectionKey(sourceSection.gradeLevel, sourceSection.programType, sourceSection.name)
				: null,
			reason,
			action: reason === 'EXACT_CARRY' ? 'CARRY' : 'SKIP',
			targetSubjectId: subject?.id ?? null,
			targetSubjectCode: subject?.code ?? null,
			targetSectionMirrorId: targetSection?.sectionMirrorId ?? null,
			targetSectionExternalId: targetSection?.externalId ?? null,
			targetSectionKey: targetSection
				? canonicalCarryForwardSectionKey(targetSection.gradeLevel, targetSection.programType, targetSection.name)
				: null,
			targetFacultyId: targetFaculty?.facultyMirrorId ?? null,
			targetFacultyExternalId: targetFaculty?.externalId ?? null,
			targetFacultyName: targetFaculty ? `${targetFaculty.lastName}, ${targetFaculty.firstName}` : null,
			targetDepartment: targetFaculty?.department ?? null,
			weeklyMinutes: subject?.minMinutesPerWeek ?? 0,
			qualificationTier,
			detail: describeReason(reason, { facultyMatch: facultyMatch.status, sectionMatch: sectionMatch.status, sourceSectionPresent: sourceSection != null }),
		});
	}

	rows.sort((a, b) => (a.targetSectionKey ?? a.sourceSectionKey ?? '').localeCompare(b.targetSectionKey ?? b.sourceSectionKey ?? '') || (a.targetSubjectCode ?? a.sourceSubjectCode ?? '').localeCompare(b.targetSubjectCode ?? b.sourceSubjectCode ?? '') || a.sourceOwnershipId - b.sourceOwnershipId);

	const totals: Record<CarryForwardReason, number> = {
		EXACT_CARRY: 0,
		ALREADY_OCCUPIED: 0,
		MISSING_FACULTY: 0,
		MISSING_SECTION: 0,
		NO_CURRENT_DEMAND: 0,
		UNQUALIFIED: 0,
		CAP_BLOCKED: 0,
		AMBIGUOUS: 0,
		OTHER: 0,
	};
	for (const row of rows) totals[row.reason] += 1;

	const carriedRows = rows.filter((row) => row.action === 'CARRY');

	const beforeMinutes = new Map<number, number>();
	for (const [facultyId, pairs] of assignedByFaculty) {
		const beforePairs = pairs.filter((pair) => !carriedRows.some((row) => row.targetFacultyId === facultyId && row.targetSubjectId === pair.subject.id && row.targetSectionExternalId === pair.sectionId));
		beforeMinutes.set(facultyId, minutesForPairs(beforePairs));
	}
	const afterMinutes = new Map<number, number>();
	for (const member of target.faculty) afterMinutes.set(member.facultyMirrorId, simulatedMinutes.get(member.facultyMirrorId) ?? 0);

	const fingerprint = sha256Upper({
		schemaVersion: SCHEMA_VERSION,
		kind: 'TL_CARRY_FORWARD_PLAN',
		sourceRevision: source.revision,
		targetRevision: target.revision,
		derivedDemandRevision: target.derivedDemand.ok ? target.derivedDemand.revision : null,
		workloadPolicy: target.workloadPolicy,
		departmentRevision: target.department.revisionHash,
		plan: carriedRows.map((row) => ({
			sourceOwnershipId: row.sourceOwnershipId,
			targetSubjectId: row.targetSubjectId,
			targetSectionMirrorId: row.targetSectionMirrorId,
			targetSectionExternalId: row.targetSectionExternalId,
			targetFacultyId: row.targetFacultyId,
			targetFacultyExternalId: row.targetFacultyExternalId,
			weeklyMinutes: row.weeklyMinutes,
			action: row.action,
			reason: row.reason,
		})),
		confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
	});

	return {
		sourceRevision: source.revision,
		targetRevision: target.revision,
		derivedDemandRevision: target.derivedDemand.ok ? target.derivedDemand.revision : null,
		fingerprint,
		rows,
		totals,
		carriedRows,
		beforeMinutes,
		afterMinutes,
	};
}

function describeReason(
	reason: CarryForwardReason,
	context: { facultyMatch: 'MATCH' | 'MISSING' | 'AMBIGUOUS'; sectionMatch: 'MATCH' | 'MISSING' | 'AMBIGUOUS'; sourceSectionPresent: boolean },
): string | null {
	switch (reason) {
		case 'EXACT_CARRY':
			return null;
		case 'ALREADY_OCCUPIED':
			return 'The target pair already has an owner; fill-empty-only never overwrites it.';
		case 'MISSING_FACULTY':
			return 'No current active same-school faculty matches the archived owner by stable external identity.';
		case 'MISSING_SECTION':
			return context.sourceSectionPresent
				? 'No current target section matches grade + program + normalized name.'
				: 'The archived source section no longer exists in the source-year mirror.';
		case 'NO_CURRENT_DEMAND':
			return 'The pair is not part of current DERIVED_DEMAND_V2 (reference-only, inactive, or obsolete demand).';
		case 'UNQUALIFIED':
			return 'The archived owner is not qualified for the current subject/department/program authority.';
		case 'CAP_BLOCKED':
			return 'Carrying this pair would push the faculty past the current hard cap on actual teaching minutes.';
		case 'AMBIGUOUS':
			return context.sectionMatch === 'AMBIGUOUS'
				? 'More than one current section matches the canonical identity; resolve the duplicate before carrying.'
				: 'Two archived rows resolve to the same current pair; resolve the duplicate before carrying.';
		default:
			return 'The row could not be classified automatically.';
	}
}

// ─── Analysis helpers for the preview ────────────────────────────────────────

function perDepartmentReview(rows: CarryForwardPlanRow[]): CarryForwardDepartmentReview[] {
	const byDepartment = new Map<string, CarryForwardDepartmentReview>();
	for (const row of rows) {
		const department = row.targetDepartment ?? 'Unassigned';
		const entry = byDepartment.get(department) ?? { department, carry: 0, skipped: 0 };
		if (row.action === 'CARRY') entry.carry += 1;
		else entry.skipped += 1;
		byDepartment.set(department, entry);
	}
	return [...byDepartment.values()].sort((a, b) => a.department.localeCompare(b.department));
}

function adviserCoverage(
	target: CarryForwardTargetSnapshot,
	plan: CarryForwardPlan,
): CarryForwardAdviserOutcome[] {
	const activeSectionIds = new Set(target.sections.map((section) => section.externalId));
	const demandPairs = target.derivedDemand.ok ? target.derivedDemand.teachingLoadPairs : [];
	const ownedKeys = new Set(target.ownership.map((row) => demandPairKey(row.subjectId, row.sectionId)));
	for (const row of plan.carriedRows) {
		if (row.targetSubjectId != null && row.targetSectionExternalId != null) ownedKeys.add(demandPairKey(row.targetSubjectId, row.targetSectionExternalId));
	}
	const outcomes: CarryForwardAdviserOutcome[] = [];
	for (const member of target.faculty) {
		if (!member.isClassAdviser || member.advisedSectionId == null) continue;
		if (!member.isActiveForScheduling || member.isStale || member.isPlaceholder) continue;
		if (!activeSectionIds.has(member.advisedSectionId)) continue;
		const sectionDemand = demandPairs.filter((pair) => pair.sectionExternalId === member.advisedSectionId);
		const ownsAny = sectionDemand.some((pair) => {
			const key = demandPairKey(pair.subjectId, pair.sectionExternalId);
			// The adviser owns it when an existing/carried target ownership row is theirs.
			if (target.ownership.some((row) => demandPairKey(row.subjectId, row.sectionId) === key && row.facultyId === member.facultyMirrorId)) return true;
			return plan.carriedRows.some((row) => demandPairKey(row.targetSubjectId ?? 0, row.targetSectionExternalId ?? 0) === key && row.targetFacultyId === member.facultyMirrorId);
		});
		outcomes.push({
			facultyId: member.facultyMirrorId,
			sectionId: member.advisedSectionId,
			satisfied: ownsAny,
			reason: ownsAny ? 'SATISFIED' : sectionDemand.length === 0 ? 'NO_DEMANDED_SUBJECTS_IN_ADVISORY_SECTION' : 'NO_CARRIED_OR_EXISTING_OWNERSHIP',
		});
	}
	return outcomes;
}

// ─── Preview ────────────────────────────────────────────────────────────────

export interface TeachingLoadCarryForwardPreview {
	schemaVersion: string;
	schoolId: number;
	actorSchoolId: number;
	fingerprint: string;
	sourceRevision: string;
	targetRevision: string;
	derivedDemandRevision: string | null;
	generatedAt: string;
	sourceYear: CarryForwardYearAuthority & { cycle: CarryForwardCycleSnapshot };
	targetYear: CarryForwardYearAuthority & { cycle: CarryForwardCycleSnapshot; ownershipCount: number };
	workloadPolicy: CarryForwardWorkloadPolicy;
	totals: Record<CarryForwardReason, number>;
	totalsSummary: { sourceRows: number; carried: number; skipped: number };
	before: { ownershipCount: number; demandCount: number; distribution: CarryForwardDistribution };
	after: { distribution: CarryForwardDistribution; overloadChanges: CarryForwardWorkloadChange[] };
	perDepartment: CarryForwardDepartmentReview[];
	adviserCoverage: { satisfied: number; unsatisfied: number; outcomes: CarryForwardAdviserOutcome[] };
	rows: CarryForwardPlanRow[];
	confirmationText: string;
	zeroWriteProof: { preview: true; writes: 0 };
	authorizesMutation: false;
}

export async function previewTeachingLoadCarryForward(
	schoolId: number,
	targetYearId: number,
	sourceYearId: number,
	actorSchoolId: number | null | undefined,
	client?: unknown,
): Promise<TeachingLoadCarryForwardPreview> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) throw err(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	const tx = client ?? db();
	const resolution = await resolveCarryForwardYears(tx, actorSchoolId, schoolId, targetYearId, sourceYearId);
	const source = await readCarryForwardSourceSnapshot(tx, schoolId, sourceYearId, resolution);
	const target = await readCarryForwardTargetSnapshot(tx, schoolId, targetYearId, resolution);

	if (!target.derivedDemand.ok) {
		throw err(409, 'DERIVED_DEMAND_BLOCKED', `Current demand authority is unavailable: ${target.derivedDemand.blockers.map((blocker) => blocker.code).join(', ')}.`);
	}

	const plan = await buildCarryForwardPlan(source, target, schoolId);

	const activeSectionIds = new Set(target.sections.map((section) => section.externalId));
	const beforeDistribution = distributionOf(target.faculty, plan.beforeMinutes, target.workloadPolicy, activeSectionIds);
	const afterDistribution = distributionOf(target.faculty, plan.afterMinutes, target.workloadPolicy, activeSectionIds);
	const overloadChanges: CarryForwardWorkloadChange[] = target.faculty
		.filter((member) => member.isActiveForScheduling && !member.isStale && !member.isPlaceholder)
		.map((member) => {
			const before = plan.beforeMinutes.get(member.facultyMirrorId) ?? 0;
			const after = plan.afterMinutes.get(member.facultyMirrorId) ?? 0;
			const beforeStatus = workloadStatusOf(before, target.workloadPolicy);
			const afterStatus = workloadStatusOf(after, target.workloadPolicy);
			return {
				facultyId: member.facultyMirrorId,
				name: `${member.lastName}, ${member.firstName}`,
				beforeMinutes: before,
				afterMinutes: after,
				beforeStatus,
				afterStatus,
				changed: afterStatus !== beforeStatus,
			};
		})
		.filter((entry) => entry.changed)
		.sort((a, b) => a.name.localeCompare(b.name) || a.facultyId - b.facultyId);

	const outcomes = adviserCoverage(target, plan);
	const sourceRows = source.rows.length;
	const carried = plan.carriedRows.length;

	return {
		schemaVersion: SCHEMA_VERSION,
		schoolId,
		actorSchoolId: resolution.actorSchoolId,
		fingerprint: plan.fingerprint,
		sourceRevision: plan.sourceRevision,
		targetRevision: plan.targetRevision,
		derivedDemandRevision: plan.derivedDemandRevision,
		generatedAt: new Date().toISOString(),
		sourceYear: { ...source.authority, cycle: source.cycle },
		targetYear: { ...target.authority, cycle: target.cycle, ownershipCount: target.ownership.length },
		workloadPolicy: target.workloadPolicy,
		totals: plan.totals,
		totalsSummary: { sourceRows, carried, skipped: sourceRows - carried },
		before: {
			ownershipCount: target.ownership.length,
			demandCount: target.derivedDemand.teachingLoadPairs.length,
			distribution: beforeDistribution,
		},
		after: { distribution: afterDistribution, overloadChanges },
		perDepartment: perDepartmentReview(plan.rows),
		adviserCoverage: {
			satisfied: outcomes.filter((outcome) => outcome.satisfied).length,
			unsatisfied: outcomes.filter((outcome) => !outcome.satisfied).length,
			outcomes,
		},
		rows: plan.rows,
		confirmationText: TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION,
		zeroWriteProof: { preview: true, writes: 0 },
		authorizesMutation: false,
	};
}

// ─── Apply ───────────────────────────────────────────────────────────────────

export interface ApplyTeachingLoadCarryForwardInput {
	actorSchoolId: number | null | undefined;
	actorId: number;
	schoolId: unknown;
	targetSchoolYearId: unknown;
	sourceSchoolYearId: unknown;
	expectedFingerprint: unknown;
	expectedSourceRevision: unknown;
	expectedTargetRevision: unknown;
	confirmationText: unknown;
}

export interface TeachingLoadCarryForwardRollbackReceipt {
	ownershipIds: number[];
	facultySubjectsCreated: number[];
	facultySubjectsUpdated: Array<{ id: number; sectionIdsBefore: number[]; versionBefore: number }>;
	cycleBefore: { state: string; version: number } | null;
}

export interface TeachingLoadCarryForwardApplyResult {
	schoolId: number;
	targetSchoolYearId: number;
	sourceSchoolYearId: number;
	fingerprint: string;
	carried: number;
	skipped: number;
	ownershipIdsWritten: number[];
	facultySubjectIdsWritten: number[];
	affectedFacultyIds: number[];
	operationId: number;
	replayed: boolean;
	revalidatedInTransaction: boolean;
	rollback: TeachingLoadCarryForwardRollbackReceipt;
}

function parsePositiveInt(value: unknown, field: string): number {
	if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
	if (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim())) {
		const parsed = Number(value.trim());
		if (Number.isSafeInteger(parsed)) return parsed;
	}
	throw err(400, 'INVALID_PARAM', `${field} must be a positive integer.`);
}

async function findCarryForwardReplay(
	tx: any,
	schoolId: number,
	targetYearId: number,
	fingerprint: string,
): Promise<{ operationId: number; carried: number; skipped: number; ownershipIdsWritten: number[]; facultySubjectIdsWritten: number[]; affectedFacultyIds: number[] } | null> {
	const audits = await tx.auditLog.findMany({
		where: { schoolId, schoolYearId: targetYearId, action: 'TEACHING_LOAD_CARRY_FORWARD' },
		orderBy: { id: 'desc' },
		select: { id: true, metadata: true },
		take: 50,
	});
	for (const audit of audits as Array<{ id: number; metadata: any }>) {
		const metadata = audit.metadata ?? {};
		if (metadata.fingerprint === fingerprint && metadata.schemaVersion === SCHEMA_VERSION) {
			return {
				operationId: audit.id,
				carried: Number(metadata.carried ?? 0),
				skipped: Number(metadata.skipped ?? 0),
				ownershipIdsWritten: Array.isArray(metadata.ownershipIdsWritten) ? metadata.ownershipIdsWritten.map(Number) : [],
				facultySubjectIdsWritten: Array.isArray(metadata.facultySubjectIdsWritten) ? metadata.facultySubjectIdsWritten.map(Number) : [],
				affectedFacultyIds: Array.isArray(metadata.affectedFacultyIds) ? metadata.affectedFacultyIds.map(Number) : [],
			};
		}
	}
	return null;
}

async function executeCarryForwardInTransaction(
	tx: Prisma.TransactionClient,
	schoolId: number,
	targetYearId: number,
	sourceYearId: number,
	actorId: number,
	plan: CarryForwardPlan,
	target: CarryForwardTargetSnapshot,
): Promise<Omit<TeachingLoadCarryForwardApplyResult, 'replayed' | 'revalidatedInTransaction'>> {
	const rollback: TeachingLoadCarryForwardRollbackReceipt = {
		ownershipIds: [],
		facultySubjectsCreated: [],
		facultySubjectsUpdated: [],
		cycleBefore: target.cycle.state === 'UNCONFIGURED' ? null : { state: target.cycle.state, version: target.cycle.version },
	};
	const ownershipIdsWritten: number[] = [];
	const facultySubjectIdsWritten: number[] = [];
	const affectedFacultyIds = new Set<number>();

	const anyTx = tx as any;
	const existingOwnershipKeys = new Set(target.ownership.map((row) => demandPairKey(row.subjectId, row.sectionId)));
	const facultySubjectByKey = new Map<string, { id: number; sectionIds: number[]; gradeLevels: number[]; version: number }>();
	for (const row of target.facultySubjects) facultySubjectByKey.set(`${row.facultyId}:${row.subjectId}`, row);
	const sectionGradeByExternal = new Map<number, number>();
	for (const section of target.sections) sectionGradeByExternal.set(section.externalId, section.gradeLevel);
	const deriveGradeLevels = (sectionIds: number[]) =>
		[...new Set(sectionIds.map((id) => sectionGradeByExternal.get(id)).filter((grade): grade is number => grade != null))].sort((a, b) => a - b);

	for (const row of plan.carriedRows) {
		const { targetSubjectId, targetSectionExternalId, targetFacultyId } = row;
		if (targetSubjectId == null || targetSectionExternalId == null || targetFacultyId == null) {
			throw err(409, 'PLAN_DRIFT', 'A carried-forward row lost its resolved target identity during apply.');
		}
		const pairKey = demandPairKey(targetSubjectId, targetSectionExternalId);
		if (existingOwnershipKeys.has(pairKey)) {
			throw err(409, 'TARGET_PAIR_ALREADY_OCCUPIED', 'A target pair became occupied during apply; fill-empty-only aborted with zero writes.');
		}

		// FacultySubject projection (create or extend) — never touches archived source rows.
		const fsKey = `${targetFacultyId}:${targetSubjectId}`;
		let facultySubjectId: number;
		const existingFs = facultySubjectByKey.get(fsKey);
		if (existingFs) {
			if (!existingFs.sectionIds.includes(targetSectionExternalId)) {
				rollback.facultySubjectsUpdated.push({ id: existingFs.id, sectionIdsBefore: [...existingFs.sectionIds], versionBefore: existingFs.version });
				const nextSectionIds = [...new Set([...existingFs.sectionIds, targetSectionExternalId])].sort((a, b) => a - b);
				const updated = await anyTx.facultySubject.update({
					where: { id: existingFs.id },
					data: { sectionIds: { set: nextSectionIds }, gradeLevels: { set: deriveGradeLevels(nextSectionIds) }, version: { increment: 1 } },
					select: { id: true },
				});
				facultySubjectByKey.set(fsKey, { ...existingFs, sectionIds: nextSectionIds, gradeLevels: deriveGradeLevels(nextSectionIds), version: existingFs.version + 1 });
				facultySubjectIdsWritten.push(updated.id);
			}
			facultySubjectId = existingFs.id;
		} else {
			const created = await anyTx.facultySubject.create({
				data: {
					schoolId,
					schoolYearId: targetYearId,
					facultyId: targetFacultyId,
					subjectId: targetSubjectId,
					sectionIds: [targetSectionExternalId],
					gradeLevels: deriveGradeLevels([targetSectionExternalId]),
					assignedBy: actorId,
				},
				select: { id: true },
			});
			facultySubjectByKey.set(fsKey, { id: created.id, sectionIds: [targetSectionExternalId], gradeLevels: deriveGradeLevels([targetSectionExternalId]), version: 1 });
			facultySubjectIdsWritten.push(created.id);
			rollback.facultySubjectsCreated.push(created.id);
			facultySubjectId = created.id;
		}

		const ownership = await anyTx.subjectSectionOwnership.create({
			data: { schoolId, schoolYearId: targetYearId, subjectId: targetSubjectId, sectionId: targetSectionExternalId, facultyId: targetFacultyId, facultySubjectId, assignedAt: new Date() },
			select: { id: true },
		});
		ownershipIdsWritten.push(ownership.id);
		rollback.ownershipIds.push(ownership.id);
		existingOwnershipKeys.add(pairKey);
		affectedFacultyIds.add(targetFacultyId);
	}

	if (ownershipIdsWritten.length > 0) {
		await refreshTeachingLoadCycle(schoolId, targetYearId, tx as never);
	}

	const audit = await anyTx.auditLog.create({
		data: {
			schoolId,
			schoolYearId: targetYearId,
			actorId,
			action: 'TEACHING_LOAD_CARRY_FORWARD',
			targetIds: ownershipIdsWritten,
			metadata: {
				schemaVersion: SCHEMA_VERSION,
				fingerprint: plan.fingerprint,
				sourceRevision: plan.sourceRevision,
				targetRevision: plan.targetRevision,
				sourceSchoolYearId: sourceYearId,
				carried: ownershipIdsWritten.length,
				skipped: plan.rows.length - ownershipIdsWritten.length,
				ownershipIdsWritten,
				facultySubjectIdsWritten,
				affectedFacultyIds: [...affectedFacultyIds],
			} as object,
		},
		select: { id: true },
	});

	return {
		schoolId,
		targetSchoolYearId: targetYearId,
		sourceSchoolYearId: sourceYearId,
		fingerprint: plan.fingerprint,
		carried: ownershipIdsWritten.length,
		skipped: plan.rows.length - ownershipIdsWritten.length,
		ownershipIdsWritten,
		facultySubjectIdsWritten,
		affectedFacultyIds: [...affectedFacultyIds],
		operationId: audit.id,
		rollback,
	};
}

/**
 * Privileged, fingerprinted carry-forward apply. Implemented but never invoked
 * against live Teaching Load by this stream. The exact source revision, target
 * revision, fingerprint, and confirmation are required. Every authority is
 * re-read and re-computed inside one Serializable transaction; any drift aborts
 * with a typed 409 and zero partial writes. Only EMPTY target pairs are written;
 * the archived source, occupied target pairs, department authority, curriculum,
 * derived metadata, generation, publication, and catalog rows are never touched.
 */
export async function applyTeachingLoadCarryForward(input: ApplyTeachingLoadCarryForwardInput): Promise<TeachingLoadCarryForwardApplyResult> {
	const schoolId = parsePositiveInt(input.schoolId, 'schoolId');
	const targetYearId = parsePositiveInt(input.targetSchoolYearId, 'targetSchoolYearId');
	const sourceYearId = parsePositiveInt(input.sourceSchoolYearId, 'sourceSchoolYearId');
	if (input.actorSchoolId == null) throw err(403, 'ACTOR_SCHOOL_REQUIRED', 'Carry-forward apply requires an authenticated actor school.');
	if (!Number.isInteger(input.actorSchoolId) || input.actorSchoolId <= 0 || input.actorSchoolId !== schoolId) {
		throw err(403, 'SCHOOL_MISMATCH', 'Request school does not match the authenticated actor school.');
	}
	if (input.confirmationText !== TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION) {
		throw err(400, 'CONFIRMATION_REQUIRED', `confirmationText="${TEACHING_LOAD_CARRY_FORWARD_CONFIRMATION}" is required.`);
	}
	if (typeof input.expectedFingerprint !== 'string' || !input.expectedFingerprint) throw err(400, 'FINGERPRINT_REQUIRED', 'expectedFingerprint from the preview is required.');
	if (typeof input.expectedSourceRevision !== 'string' || !input.expectedSourceRevision) throw err(400, 'FINGERPRINT_REQUIRED', 'expectedSourceRevision from the preview is required.');
	if (typeof input.expectedTargetRevision !== 'string' || !input.expectedTargetRevision) throw err(400, 'FINGERPRINT_REQUIRED', 'expectedTargetRevision from the preview is required.');
	const expectedFingerprint = input.expectedFingerprint;
	const expectedSourceRevision = input.expectedSourceRevision;
	const expectedTargetRevision = input.expectedTargetRevision;

	try {
		return await db().$transaction(async (tx) => {
			const resolution = await resolveCarryForwardYears(tx, input.actorSchoolId, schoolId, targetYearId, sourceYearId);

			// Idempotent replay: an identical consumed plan returns the stored receipt with zero writes.
			const replay = await findCarryForwardReplay(tx as never, schoolId, targetYearId, expectedFingerprint);
			if (replay) {
				const replayReceipt: TeachingLoadCarryForwardApplyResult = {
					schoolId,
					targetSchoolYearId: targetYearId,
					sourceSchoolYearId: sourceYearId,
					fingerprint: expectedFingerprint,
					carried: replay.carried,
					skipped: replay.skipped,
					ownershipIdsWritten: replay.ownershipIdsWritten,
					facultySubjectIdsWritten: replay.facultySubjectIdsWritten,
					affectedFacultyIds: replay.affectedFacultyIds,
					operationId: replay.operationId,
					replayed: true,
					revalidatedInTransaction: true,
					rollback: { ownershipIds: [], facultySubjectsCreated: [], facultySubjectsUpdated: [], cycleBefore: null },
				};
				return replayReceipt;
			}

			const source = await readCarryForwardSourceSnapshot(tx, schoolId, sourceYearId, resolution);
			const target = await readCarryForwardTargetSnapshot(tx, schoolId, targetYearId, resolution);
			if (source.revision !== expectedSourceRevision) {
				throw err(409, 'SOURCE_DRIFT', 'The archived source Teaching Load changed since the preview. Re-run the preview before applying.');
			}
			if (target.revision !== expectedTargetRevision) {
				throw err(409, 'TARGET_DRIFT', 'The active Teaching Load target changed since the preview. Re-run the preview before applying.');
			}
			if (!target.derivedDemand.ok) {
				throw err(409, 'DERIVED_DEMAND_BLOCKED', `Current demand authority is unavailable: ${target.derivedDemand.blockers.map((blocker) => blocker.code).join(', ')}.`);
			}
			const plan = await buildCarryForwardPlan(source, target, schoolId);
			if (plan.fingerprint !== expectedFingerprint) {
				throw err(409, 'FINGERPRINT_MISMATCH', 'Carry-forward preview fingerprint does not match the current source. Re-run the preview before applying.');
			}

			if (plan.carriedRows.length === 0) {
				// Zero-write no-op: nothing to carry under this exact reviewed plan.
				const noOp: TeachingLoadCarryForwardApplyResult = {
					schoolId,
					targetSchoolYearId: targetYearId,
					sourceSchoolYearId: sourceYearId,
					fingerprint: plan.fingerprint,
					carried: 0,
					skipped: plan.rows.length,
					ownershipIdsWritten: [],
					facultySubjectIdsWritten: [],
					affectedFacultyIds: [],
					operationId: 0,
					replayed: true,
					revalidatedInTransaction: true,
					rollback: { ownershipIds: [], facultySubjectsCreated: [], facultySubjectsUpdated: [], cycleBefore: null },
				};
				return noOp;
			}

			const result = await executeCarryForwardInTransaction(tx, schoolId, targetYearId, sourceYearId, input.actorId, plan, target);
			const applied: TeachingLoadCarryForwardApplyResult = { ...result, replayed: false, revalidatedInTransaction: true };
			return applied;
		}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
	} catch (error: unknown) {
		if (isTransactionConflictError(error)) {
			throw err(409, 'TRANSACTION_CONFLICT', 'Concurrent carry-forward conflict: no partial writes occurred. Re-run the preview and retry the apply.');
		}
		throw error;
	}
}
