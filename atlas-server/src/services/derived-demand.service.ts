/**
 * DEMAND-C01 — Canonical derived demand authority.
 *
 * One deterministic, READ-ONLY demand contract derived from exactly three
 * authorities:
 *   1. the sole active, non-archived EnrollPro school year and its verified
 *      ordered term structure (TERM-CONSUME-C02);
 *   2. active ATLAS section mirrors; and
 *   3. ATLAS Subject scheduling metadata (`schedulingDisposition`,
 *      grade/program scope, rotation family + order, weekly minutes).
 *
 * Demand is set-wise: for every (active section, SCHEDULED_TEACHING subject)
 * pair whose grade and program scope match exactly, the subject occurs in every
 * ordered term unless it is a validated rotating-family member, in which case it
 * occurs only in the term selected by its rotation order.
 *
 * This module NEVER reads `SchoolYearOffering`, `OfferingTermAssignment`, or
 * `SchoolYearTermConfig` as authority, and NEVER writes anything. A typed
 * blocker is returned (never a silent fallback) when the ordered term structure
 * is unavailable or rotation metadata is missing/duplicate/out-of-range/
 * incomplete.
 */

import { createHash } from 'node:crypto';

import { canonicalStringify } from '../lib/canonical-json.js';
import { getDataContext } from '../lib/data-context.js';
import { normalizeGradeLevelSync } from './class-program-slot.service.js';
import { resolveEnrollProTermContract, type VerifiedTermContract } from './enrollpro-term-contract.service.js';
import type { DemandItem, SubjectInput } from './schedule-constructor.js';
import type { SectionsByGrade } from './section-adapter.js';

export type DerivedSchedulingDisposition = 'SCHEDULED_TEACHING' | 'REFERENCE_ONLY';

export type DerivedDemandBlockerCode =
	| 'ACTIVE_YEAR_UNAVAILABLE'
	| 'ACTIVE_YEAR_AMBIGUOUS'
	| 'INACTIVE_HISTORICAL_YEAR'
	| 'TERM_STRUCTURE_UNAVAILABLE'
	| 'TERM_STRUCTURE_EMPTY'
	| 'ROTATION_FAMILY_MISSING'
	| 'ROTATION_ORDER_MISSING'
	| 'ROTATION_ORDER_OUT_OF_RANGE'
	| 'ROTATION_ORDER_DUPLICATE'
	| 'ROTATION_INCOMPLETE';

export interface DerivedDemandBlocker {
	code: DerivedDemandBlockerCode;
	message: string;
	subjectId?: number;
	subjectCode?: string;
	rotationFamily?: string;
	rotationOrder?: number;
}

export interface DerivedSectionInput {
	sectionMirrorId: number;
	externalId: number;
	gradeLevel: number;
	programType: string | null;
	isActiveForScheduling: boolean;
	isStale: boolean;
}

export interface DerivedSubjectInput {
	id: number;
	code: string;
	name: string;
	schedulingDisposition: DerivedSchedulingDisposition;
	gradeLevels: number[];
	programScopes: string[];
	rotationFamily: string | null;
	modularOrder: number | null;
	minMinutesPerWeek: number;
	isActive: boolean;
}

export interface DerivedTermInput {
	identity: string;
	displayLabel: string;
	order: number;
}

export interface DerivedDemandInput {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	termFormat: 'TRIMESTER' | 'QUARTERS';
	/** Semantic revision of the verified ordered term structure (diagnostic identity). */
	termStructureRevision: string;
	terms: DerivedTermInput[];
	sections: DerivedSectionInput[];
	subjects: DerivedSubjectInput[];
	/** Day-shape period length; falls back to 45 when not supplied. */
	periodLengthMinutes?: number;
}

export interface DerivedTimetableLine {
	schoolId: number;
	schoolYearId: number;
	/** schoolId:schoolYearId:termIdentity:subjectId:sectionExternalId */
	identity: string;
	subjectId: number;
	subjectCode: string;
	subjectName: string;
	sectionMirrorId: number;
	sectionExternalId: number;
	gradeLevel: number;
	programType: string;
	termIdentity: string;
	termIndex: number;
	rotationFamily: string | null;
	rotationOrder: number | null;
	termMode: 'ALL' | 'ROTATING_FAMILY_MEMBER';
	weeklyMinutes: number;
	periodLengthMinutes: number;
	sessionsPerWeek: number;
}

export interface DerivedTeachingLoadPair {
	schoolId: number;
	schoolYearId: number;
	/** schoolId:schoolYearId:subjectId:sectionExternalId */
	identity: string;
	subjectId: number;
	subjectCode: string;
	sectionMirrorId: number;
	sectionExternalId: number;
	gradeLevel: number;
	programType: string;
	rotationFamily: string | null;
	rotationOrder: number | null;
	termMode: 'ALL' | 'ROTATING_FAMILY_MEMBER';
	termIdentities: string[];
	weeklyMinutes: number;
	periodLengthMinutes: number;
	sessionsPerWeek: number;
}

export interface DerivedDemandSuccess {
	ok: true;
	scope: { schoolId: number; schoolYearId: number };
	yearLabel: string;
	/** Canonical semantic revision binding school/year, ordered terms, active sections, and Subject semantics. */
	revision: string;
	termStructure: {
		format: 'TRIMESTER' | 'QUARTERS';
		semanticRevision: string;
		terms: DerivedTermInput[];
	};
	periodLengthMinutes: number;
	timetableLines: DerivedTimetableLine[];
	teachingLoadPairs: DerivedTeachingLoadPair[];
	totalsByTerm: Record<string, number>;
	totalLines: number;
	totalPairs: number;
}

export interface DerivedDemandFailure {
	ok: false;
	scope: { schoolId: number; schoolYearId: number };
	blockers: DerivedDemandBlocker[];
}

export type DerivedDemandResult = DerivedDemandSuccess | DerivedDemandFailure;

function normalizeProgramType(programType: string | null | undefined): string {
	const normalized = (programType ?? '').trim().toUpperCase();
	if (normalized.length === 0) return 'OTHER';
	return normalized;
}

function normalizeRotationFamily(value: string | null | undefined): string | null {
	const normalized = (value ?? '').trim().toUpperCase();
	return normalized.length > 0 ? normalized : null;
}

function normalizeUpperSet(values: readonly string[] | null | undefined): string[] {
	return [...new Set((values ?? []).map((value) => value.trim().toUpperCase()).filter((value) => value.length > 0))].sort();
}

function normalizeGradeSet(values: readonly number[] | null | undefined): number[] {
	return [...new Set((values ?? []).map((value) => normalizeGradeLevelSync(value)))].sort((a, b) => a - b);
}

function sha256Upper(value: unknown): string {
	return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex').toUpperCase();
}

function blocker(code: DerivedDemandBlockerCode, message: string, extra: Partial<DerivedDemandBlocker> = {}): DerivedDemandBlocker {
	return { code, message, ...extra };
}

/**
 * Validate rotation metadata for the SCHEDULED_TEACHING subjects. Missing
 * family, missing order, out-of-range order, duplicate positions within a
 * family, and an incomplete family (does not cover every ordered term exactly
 * once) all fail closed with a typed blocker.
 */
export function validateRotationMetadata(
	subjects: DerivedSubjectInput[],
	termCount: number,
): DerivedDemandBlocker[] {
	const blockers: DerivedDemandBlocker[] = [];
	const byFamily = new Map<string, { subject: DerivedSubjectInput; order: number }[]>();

	for (const subject of subjects) {
		const family = normalizeRotationFamily(subject.rotationFamily);
		const order = subject.modularOrder;
		if (!family && order != null) {
			blockers.push(blocker('ROTATION_FAMILY_MISSING', `Subject ${subject.code} has a rotation order without a rotation family.`, { subjectId: subject.id, subjectCode: subject.code }));
			continue;
		}
		if (family && (order == null || !Number.isInteger(order))) {
			blockers.push(blocker('ROTATION_ORDER_MISSING', `Rotation family ${family} needs an explicit integer term order for ${subject.code}.`, { subjectId: subject.id, subjectCode: subject.code, rotationFamily: family }));
			continue;
		}
		if (!family || order == null) continue;
		if (order < 1 || order > termCount) {
			blockers.push(blocker('ROTATION_ORDER_OUT_OF_RANGE', `Rotation order ${order} for ${subject.code} is outside the ${termCount}-term contract.`, { subjectId: subject.id, subjectCode: subject.code, rotationFamily: family, rotationOrder: order }));
			continue;
		}
		const entries = byFamily.get(family) ?? [];
		entries.push({ subject, order });
		byFamily.set(family, entries);
	}

	for (const [family, entries] of byFamily) {
		const orderCounts = new Map<number, DerivedSubjectInput[]>();
		for (const entry of entries) {
			const list = orderCounts.get(entry.order) ?? [];
			list.push(entry.subject);
			orderCounts.set(entry.order, list);
		}
		for (const [order, subjectsAtOrder] of orderCounts) {
			if (subjectsAtOrder.length > 1) {
				for (const subject of subjectsAtOrder) {
					blockers.push(blocker('ROTATION_ORDER_DUPLICATE', `Rotation family ${family} has more than one subject at order ${order}.`, { subjectId: subject.id, subjectCode: subject.code, rotationFamily: family, rotationOrder: order }));
				}
			}
		}
	}

	return blockers;
}

function buildSemanticRevisionPayload(input: {
	schoolId: number;
	schoolYearId: number;
	yearLabel: string;
	termFormat: 'TRIMESTER' | 'QUARTERS';
	termStructureRevision: string;
	terms: DerivedTermInput[];
	activeSections: Array<{ sectionMirrorId: number; externalId: number; gradeLevel: number; programType: string }>;
	scheduledSubjects: Array<{
		id: number;
		code: string;
		schedulingDisposition: DerivedSchedulingDisposition;
		gradeLevels: number[];
		programScopes: string[];
		rotationFamily: string | null;
		rotationOrder: number | null;
		minMinutesPerWeek: number;
		rotationMode: 'ALL' | 'ROTATING_FAMILY_MEMBER';
	}>;
}) {
	return {
		kind: 'DERIVED_DEMAND_V1',
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		yearLabel: input.yearLabel,
		termFormat: input.termFormat,
		termStructureRevision: input.termStructureRevision,
		terms: [...input.terms]
			.sort((a, b) => a.order - b.order)
			.map((term) => ({ identity: term.identity, order: term.order })),
		sections: [...input.activeSections].sort((a, b) => a.sectionMirrorId - b.sectionMirrorId),
		subjects: [...input.scheduledSubjects].sort((a, b) => a.id - b.id),
	};
}

/**
 * Pure, deterministic derivation. Zero I/O. Returns a typed blocker instead of
 * partial demand when the ordered term structure is missing or rotation metadata
 * is invalid.
 */
export function deriveCanonicalDemand(input: DerivedDemandInput): DerivedDemandResult {
	const scope = { schoolId: input.schoolId, schoolYearId: input.schoolYearId };
	const terms = [...input.terms].sort((a, b) => a.order - b.order);
	if (terms.length === 0) {
		return { ok: false, scope, blockers: [blocker('TERM_STRUCTURE_UNAVAILABLE', 'No verified ordered term structure is available for the active year.')] };
	}

	const scheduledSubjects = input.subjects.filter(
		(subject) => subject.isActive && subject.schedulingDisposition === 'SCHEDULED_TEACHING',
	);
	const rotationBlockers = validateRotationMetadata(scheduledSubjects, terms.length);
	if (rotationBlockers.length > 0) {
		return { ok: false, scope, blockers: rotationBlockers };
	}

	const activeSections = input.sections.filter((section) => section.isActiveForScheduling && !section.isStale);
	const periodLengthMinutes = input.periodLengthMinutes && input.periodLengthMinutes > 0 ? input.periodLengthMinutes : 45;

	const activeSectionsForRevision = activeSections.map((section) => ({
		sectionMirrorId: section.sectionMirrorId,
		externalId: section.externalId,
		gradeLevel: normalizeGradeLevelSync(section.gradeLevel),
		programType: normalizeProgramType(section.programType),
	}));
	const scheduledSubjectsForRevision = scheduledSubjects.map((subject) => ({
		id: subject.id,
		code: subject.code,
		schedulingDisposition: subject.schedulingDisposition,
		gradeLevels: normalizeGradeSet(subject.gradeLevels),
		programScopes: normalizeUpperSet(subject.programScopes),
		rotationFamily: normalizeRotationFamily(subject.rotationFamily),
		rotationOrder: subject.modularOrder,
		minMinutesPerWeek: subject.minMinutesPerWeek,
		rotationMode: (normalizeRotationFamily(subject.rotationFamily) ? 'ROTATING_FAMILY_MEMBER' : 'ALL') as 'ALL' | 'ROTATING_FAMILY_MEMBER',
	}));

	const revision = sha256Upper(buildSemanticRevisionPayload({
		schoolId: input.schoolId,
		schoolYearId: input.schoolYearId,
		yearLabel: input.yearLabel,
		termFormat: input.termFormat,
		termStructureRevision: input.termStructureRevision,
		terms,
		activeSections: activeSectionsForRevision,
		scheduledSubjects: scheduledSubjectsForRevision,
	}));

	const timetableLines: DerivedTimetableLine[] = [];
	const pairByKey = new Map<string, DerivedTeachingLoadPair>();
	const totalsByTerm: Record<string, number> = {};
	for (const term of terms) totalsByTerm[term.identity] = 0;

	for (const section of activeSections) {
		const sectionGrade = normalizeGradeLevelSync(section.gradeLevel);
		const sectionProgram = normalizeProgramType(section.programType);
		for (const subject of scheduledSubjects) {
			const subjectGrades = normalizeGradeSet(subject.gradeLevels);
			const subjectPrograms = normalizeUpperSet(subject.programScopes);
			if (!subjectGrades.includes(sectionGrade)) continue;
			if (!subjectPrograms.includes(sectionProgram)) continue;

			const family = normalizeRotationFamily(subject.rotationFamily);
			const order = subject.modularOrder;
			const applicableTerms = family && order != null
				? [terms[order - 1]]
				: terms;
			const termMode: 'ALL' | 'ROTATING_FAMILY_MEMBER' = family ? 'ROTATING_FAMILY_MEMBER' : 'ALL';
			const sessionsPerWeek = Math.max(1, Math.ceil(subject.minMinutesPerWeek / periodLengthMinutes));
			const termIdentities = applicableTerms.map((term) => term.identity);

			const pairIdentity = `${input.schoolId}:${input.schoolYearId}:${subject.id}:${section.externalId}`;
			if (!pairByKey.has(pairIdentity)) {
				pairByKey.set(pairIdentity, {
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					identity: pairIdentity,
					subjectId: subject.id,
					subjectCode: subject.code,
					sectionMirrorId: section.sectionMirrorId,
					sectionExternalId: section.externalId,
					gradeLevel: sectionGrade,
					programType: sectionProgram,
					rotationFamily: family,
					rotationOrder: order,
					termMode,
					termIdentities,
					weeklyMinutes: subject.minMinutesPerWeek,
					periodLengthMinutes,
					sessionsPerWeek,
				});
			}

			for (const term of applicableTerms) {
				const identity = `${input.schoolId}:${input.schoolYearId}:${term.identity}:${subject.id}:${section.externalId}`;
				timetableLines.push({
					schoolId: input.schoolId,
					schoolYearId: input.schoolYearId,
					identity,
					subjectId: subject.id,
					subjectCode: subject.code,
					subjectName: subject.name,
					sectionMirrorId: section.sectionMirrorId,
					sectionExternalId: section.externalId,
					gradeLevel: sectionGrade,
					programType: sectionProgram,
					termIdentity: term.identity,
					termIndex: term.order,
					rotationFamily: family,
					rotationOrder: order,
					termMode,
					weeklyMinutes: subject.minMinutesPerWeek,
					periodLengthMinutes,
					sessionsPerWeek,
				});
				totalsByTerm[term.identity] = (totalsByTerm[term.identity] ?? 0) + sessionsPerWeek;
			}
		}
	}

	timetableLines.sort((a, b) =>
		`${String(a.gradeLevel).padStart(2, '0')}:${a.programType}:${String(a.sectionExternalId).padStart(10, '0')}:${String(a.subjectId).padStart(10, '0')}:${String(a.termIndex).padStart(3, '0')}`
			.localeCompare(`${String(b.gradeLevel).padStart(2, '0')}:${b.programType}:${String(b.sectionExternalId).padStart(10, '0')}:${String(b.subjectId).padStart(10, '0')}:${String(b.termIndex).padStart(3, '0')}`),
	);
	const teachingLoadPairs = [...pairByKey.values()].sort((a, b) =>
		`${String(a.sectionExternalId).padStart(10, '0')}:${String(a.subjectId).padStart(10, '0')}`
			.localeCompare(`${String(b.sectionExternalId).padStart(10, '0')}:${String(b.subjectId).padStart(10, '0')}`),
	);

	return {
		ok: true,
		scope,
		yearLabel: input.yearLabel,
		revision,
		termStructure: {
			format: input.termFormat,
			semanticRevision: input.termStructureRevision,
			terms,
		},
		periodLengthMinutes,
		timetableLines,
		teachingLoadPairs,
		totalsByTerm,
		totalLines: timetableLines.length,
		totalPairs: teachingLoadPairs.length,
	};
}

/**
 * Flatten the derived teaching-load pairs into a stable, consumer-agnostic
 * demand identity list. Teaching Load reconciliation maps this into its own
 * `DemandPair` shape so all consumers agree on the same identities and total.
 */
export interface DerivedDemandPairIdentity {
	key: string;
	subjectId: number;
	subjectCode: string;
	sectionId: number;
	gradeLevel: number;
	programType: string;
	rotationFamily: string | null;
	rotationOrder: number | null;
	termMode: 'ALL' | 'ROTATING_FAMILY_MEMBER';
	termIdentities: string[];
	weeklyMinutes: number;
	periodLengthMinutes: number;
	sessionsPerWeek: number;
}

export function toDerivedDemandPairIdentities(result: DerivedDemandSuccess): DerivedDemandPairIdentity[] {
	return result.teachingLoadPairs
		.map((pair) => ({
			key: `${pair.subjectId}:${pair.sectionExternalId}`,
			subjectId: pair.subjectId,
			subjectCode: pair.subjectCode,
			sectionId: pair.sectionExternalId,
			gradeLevel: pair.gradeLevel,
			programType: pair.programType,
			rotationFamily: pair.rotationFamily,
			rotationOrder: pair.rotationOrder,
			termMode: pair.termMode,
			termIdentities: [...pair.termIdentities],
			weeklyMinutes: pair.weeklyMinutes,
			periodLengthMinutes: pair.periodLengthMinutes,
			sessionsPerWeek: pair.sessionsPerWeek,
		}))
		.sort((a, b) => a.key.localeCompare(b.key));
}

function toSectionDemandItem(
	pair: DerivedTeachingLoadPair,
	section: SectionsByGrade['sections'][number],
	subject: SubjectInput,
): DemandItem {
	const periodLength = pair.periodLengthMinutes;
	const sessions = Math.max(1, Math.ceil(pair.weeklyMinutes / periodLength));
	const duration = Math.ceil(pair.weeklyMinutes / sessions);
	return {
		sectionId: section.id,
		subjectId: pair.subjectId,
		subjectCode: pair.subjectCode,
		gradeLevel: pair.gradeLevel,
		sourceMinutesPerWeek: pair.weeklyMinutes,
		sessionsPerWeek: sessions,
		durationPerSession: duration,
		enrolledCount: section.enrolledCount,
		entryKind: 'SECTION',
		homeRoomId: section.homeRoomId ?? null,
		buildingZoneId: section.buildingZoneId ?? null,
		programType: section.programType ?? null,
		programCode: section.programCode ?? null,
		programName: section.programName ?? null,
		roomTypePreference: subject.preferredRoomType,
		adviserId: section.adviserId ?? null,
		adviserName: section.adviserName ?? null,
	};
}

/**
 * Project the derived demand contract into the canonical scheduler's
 * `DemandItem[]`. Rotating-family pairs for one section collapse into a single
 * modular demand item (one session per ordered term), exactly as the scheduler's
 * modular lane model expects; non-rotating pairs become one every-term item.
 * No legacy `computeDemand()` call is involved.
 */
export function toSchedulerDemandOverride(
	result: DerivedDemandSuccess,
	sectionsByGrade: SectionsByGrade[],
	subjects: SubjectInput[],
): DemandItem[] {
	const sectionByExternalId = new Map<number, SectionsByGrade['sections'][number]>();
	for (const grade of sectionsByGrade) {
		for (const section of grade.sections) sectionByExternalId.set(section.id, section);
	}
	const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));

	const items: DemandItem[] = [];
	const modularGroups = new Map<string, DerivedTeachingLoadPair[]>();

	for (const pair of result.teachingLoadPairs) {
		const section = sectionByExternalId.get(pair.sectionExternalId);
		if (!section) continue;
		const subject = subjectById.get(pair.subjectId);
		if (!subject) continue;
		if (pair.termMode === 'ROTATING_FAMILY_MEMBER' && pair.rotationFamily) {
			const groupKey = `${pair.sectionExternalId}:${pair.rotationFamily}`;
			const group = modularGroups.get(groupKey) ?? [];
			group.push(pair);
			modularGroups.set(groupKey, group);
			continue;
		}
		items.push(toSectionDemandItem(pair, section, subject));
	}

	for (const group of modularGroups.values()) {
		const ordered = [...group].sort((a, b) => (a.rotationOrder ?? 0) - (b.rotationOrder ?? 0) || a.subjectId - b.subjectId);
		const first = ordered[0];
		const section = sectionByExternalId.get(first.sectionExternalId);
		const primarySubject = subjectById.get(first.subjectId);
		if (!section || !primarySubject) continue;
		const maxMinutes = Math.max(...ordered.map((pair) => pair.weeklyMinutes));
		const periodLength = first.periodLengthMinutes;
		const sessionsPerWeek = Math.max(1, Math.ceil(maxMinutes / periodLength));
		const durationPerSession = Math.ceil(maxMinutes / sessionsPerWeek);
		items.push({
			sectionId: section.id,
			subjectId: primarySubject.id,
			subjectCode: first.rotationFamily ?? first.subjectCode,
			gradeLevel: first.gradeLevel,
			sourceMinutesPerWeek: maxMinutes,
			sessionsPerWeek,
			durationPerSession,
			enrolledCount: section.enrolledCount,
			entryKind: 'SECTION',
			homeRoomId: section.homeRoomId ?? null,
			buildingZoneId: section.buildingZoneId ?? null,
			programType: section.programType ?? null,
			programCode: section.programCode ?? null,
			programName: section.programName ?? null,
			roomTypePreference: primarySubject.preferredRoomType,
			adviserId: section.adviserId ?? null,
			adviserName: section.adviserName ?? null,
			modularGroupId: first.rotationFamily,
			modularSubjects: ordered.map((pair, index) => ({
				subjectId: pair.subjectId,
				subjectCode: pair.subjectCode,
				modularOrder: pair.rotationOrder ?? index + 1,
				minMinutesPerWeek: pair.weeklyMinutes,
			})),
			modularExpectedCount: result.termStructure.terms.length,
		});
	}

	return items.sort((a, b) => a.gradeLevel - b.gradeLevel || a.sectionId - b.sectionId || a.subjectId - b.subjectId);
}

// ─── Loader (read-only) ──────────────────────────────────────────────────────
type DataContext = {
	enrollProSchoolYearMirror: { findMany: (args: unknown) => Promise<Array<{ enrollProSchoolYearId: number; yearLabel: string }>> };
	sectionMirror: { findMany: (args: unknown) => Promise<Array<{
		id: number; externalId: number; displayOrder: number; gradeLevelId: number; programType: string | null;
		isActiveForScheduling: boolean; isStale: boolean;
	}>> };
	subject: { findMany: (args: unknown) => Promise<Array<{
		id: number; code: string; name: string; schedulingDisposition: string; gradeLevels: number[];
		programScopes: string[]; rotationFamily: string | null; modularOrder: number | null; minMinutesPerWeek: number; isActive: boolean;
	}>> };
	schedulingPolicy: { findUnique: (args: unknown) => Promise<{ periodLengthMinutes: number | null } | null> };
};

function serviceError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

export interface SoleActiveYear {
	schoolYearId: number;
	yearLabel: string;
}

/**
 * Resolve the sole active, non-archived EnrollPro school year for a school.
 * Zero or more than one active year is a typed authority blocker.
 */
export async function resolveSoleActiveNonArchivedYear(
	schoolId: number,
	client: DataContext = getDataContext<DataContext>(),
): Promise<SoleActiveYear> {
	const rows = await client.enrollProSchoolYearMirror.findMany({
		where: { schoolId, isActive: true, isArchived: false },
		select: { enrollProSchoolYearId: true, yearLabel: true },
		orderBy: [{ enrollProSchoolYearId: 'asc' }, { id: 'asc' }],
	});
	if (rows.length === 0) {
		throw serviceError(409, 'ACTIVE_YEAR_UNAVAILABLE', 'No active, non-archived school-year mirror exists for this school.');
	}
	if (rows.length > 1) {
		throw serviceError(409, 'ACTIVE_YEAR_AMBIGUOUS', 'More than one active, non-archived school-year mirror exists for this school. Resolve the school-year authority before deriving demand.');
	}
	return { schoolYearId: rows[0].enrollProSchoolYearId, yearLabel: rows[0].yearLabel };
}

export interface DerivedDemandDependencies {
	client?: DataContext;
	termContract?: VerifiedTermContract;
	periodLengthMinutes?: number;
}

/**
 * Read-only derivation for one (schoolId, schoolYearId). The ordered term
 * structure is resolved from the verified/cached EnrollPro contract; offering
 * rows and persisted term-config rows are never consulted as authority.
 */
export async function buildDerivedDemand(
	schoolId: number,
	schoolYearId: number,
	dependencies: DerivedDemandDependencies = {},
): Promise<DerivedDemandResult> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) throw serviceError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.');
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) throw serviceError(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.');

	const client = dependencies.client ?? getDataContext<DataContext>();
	const activeYear = await resolveSoleActiveNonArchivedYear(schoolId, client);
	if (activeYear.schoolYearId !== schoolYearId) {
		throw serviceError(409, 'INACTIVE_HISTORICAL_YEAR', 'The requested school year is not the sole active, non-archived year and cannot derive current demand.');
	}

	const [sectionRows, subjectRows, policyRow] = await Promise.all([
		client.sectionMirror.findMany({
			where: { schoolId, schoolYearId, isActiveForScheduling: true, isStale: false },
			select: { id: true, externalId: true, displayOrder: true, gradeLevelId: true, programType: true, isActiveForScheduling: true, isStale: true },
		}),
		client.subject.findMany({
			where: { schoolId },
			select: {
				id: true, code: true, name: true, schedulingDisposition: true, gradeLevels: true, programScopes: true,
				rotationFamily: true, modularOrder: true, minMinutesPerWeek: true, isActive: true,
			},
		}),
		client.schedulingPolicy.findUnique({
			where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
			select: { periodLengthMinutes: true },
		}),
	]);

	let contract = dependencies.termContract;
	if (!contract) {
		const resolution = await resolveEnrollProTermContract({ schoolId, schoolYearId });
		if (resolution.state === 'BLOCKED' || !resolution.contract) {
			return {
				ok: false,
				scope: { schoolId, schoolYearId },
				blockers: [blocker('TERM_STRUCTURE_UNAVAILABLE', resolution.message || 'The EnrollPro ordered term structure is unavailable.')],
			};
		}
		contract = resolution.contract;
	}

	return deriveCanonicalDemand({
		schoolId,
		schoolYearId,
		yearLabel: activeYear.yearLabel,
		termFormat: contract.format,
		termStructureRevision: contract.semanticRevision,
		terms: contract.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order })),
		sections: sectionRows.map((section) => ({
			sectionMirrorId: section.id,
			externalId: section.externalId,
			gradeLevel: normalizeGradeLevelSync(section.displayOrder),
			programType: section.programType,
			isActiveForScheduling: section.isActiveForScheduling,
			isStale: section.isStale,
		})),
		subjects: subjectRows.map((subject) => ({
			id: subject.id,
			code: subject.code,
			name: subject.name,
			schedulingDisposition: (subject.schedulingDisposition === 'REFERENCE_ONLY' ? 'REFERENCE_ONLY' : 'SCHEDULED_TEACHING'),
			gradeLevels: subject.gradeLevels,
			programScopes: subject.programScopes,
			rotationFamily: subject.rotationFamily,
			modularOrder: subject.modularOrder,
			minMinutesPerWeek: subject.minMinutesPerWeek,
			isActive: subject.isActive,
		})),
		periodLengthMinutes: dependencies.periodLengthMinutes ?? policyRow?.periodLengthMinutes ?? 45,
	});
}
