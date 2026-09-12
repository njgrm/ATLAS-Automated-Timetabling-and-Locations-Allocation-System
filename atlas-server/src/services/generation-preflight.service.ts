/**
 * GEN-C02R1 Finding F1 — one shared READ-ONLY generation preflight/assembly.
 *
 * Both the real generation trigger (`generation.service.ts`) and the canonical
 * readiness dry run (`generation-readiness.service.ts`) resolve the exact same
 * authoritative assembly here before any write occurs:
 *
 *   - actor-authorized school and the sole active, non-archived year;
 *   - verified ordered term contract and the canonical derived-demand revision;
 *   - active sections, exact `SubjectSectionOwnership` owners and their matching
 *     `FacultySubject` scope;
 *   - subjects, rooms/building scope, persisted scheduling policy, persisted
 *     grade windows, persisted class-program/template rows, special events,
 *     retained pre-generation drafts, and current occupancy;
 *   - the scheduler input, canonical shape contracts, validator policy, and every
 *     bound freshness/source revision the eventual write needs.
 *
 * This module performs NO writes and calls NO setup-healing writer. Missing
 * persisted setup is returned as a typed blocker owned by an explicit
 * setup/rollover surface. Drift between the bound assembly and the persisted
 * source is detected by `revalidateGenerationPreflight` before the first write.
 */

import { createHash } from 'node:crypto';

import { getDataContext, withDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import type { ScheduledEntry, ValidatorContext } from './constraint-validator.js';
import type {
	ConstructorInput,
	DemandItem,
	FacultySubjectInput,
	RoomInput,
	SubjectInput,
	TimetableShapeContract,
} from './schedule-constructor.js';
import { resolveTimetableShapeContract } from './schedule-constructor.js';
import {
	buildDerivedDemand,
	toPerTermDemandLines,
	toSchedulerDemandOverride,
	type DerivedDemandBlocker,
	type DerivedDemandSuccess,
	type DerivedPerTermDemandLine,
} from './derived-demand.service.js';
import type { SectionsByGrade } from './section-adapter.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import { DEFAULT_CONSTRAINT_CONFIG, POLICY_DEFAULTS, computeEffectiveWeeklyTeachingMinutes } from './scheduling-policy.service.js';
import { getTemplatePeriodProfiles } from './class-template.service.js';
import {
	readCanonicalClassProgramSlotsCoverage,
	resolveClassProgramSlots,
	normalizeInternalGradeId,
	type CanonicalTemplateCoverage,
} from './class-program-slot.service.js';
import { buildRunTimetableShapeContracts, normalizeProgramType } from './generation-shape-assembly.service.js';
import { consumeDraftPlacementsForRun, type DraftConsumeRejection } from './pre-generation-draft.service.js';
import type { VerifiedTermContract } from './enrollpro-term-contract.service.js';
import {
	validateTermTeacherResolution,
	validateTimetableShapePolicy,
	type TimetableShapePolicyBlocker,
} from './timetable-shape-policy.service.js';

const db = () => getDataContext();

export type GenerationBlockerCategory =
	| 'DEMAND_AUTHORITY'
	| 'DATA_GAP'
	| 'POLICY_BLOCKER'
	| 'RESOURCE_INFEASIBLE'
	| 'ALGORITHM_LIMIT';

export interface GenerationPreflightBlocker {
	code: string;
	category: GenerationBlockerCategory;
	termIdentity: string | null;
	sectionId: number | null;
	subjectId: number | null;
	subjectCode: string | null;
	entity: string;
	reason: string;
	owningSurface: string;
	nextAction: string;
}

export interface GenerationPreflightTeachingLoadCoverage {
	requiredPairs: number;
	ownedPairs: number;
	missingPairs: number;
	inactiveOrStalePairs: number;
	outsideScopePairs: number;
	missing: Array<{ subjectId: number; subjectCode: string; sectionMirrorId: number; sectionExternalId: number; termIdentities: string[] }>;
}

export interface GenerationPreflightRetained {
	available: boolean;
	lockedEntries: NonNullable<ConstructorInput['lockedEntries']>;
	prePlacedCount: number;
	invalidPrePlacedCount: number;
	skippedPrePlacedReasons: string[];
	acceptedPlacementIds: number[];
	rejectedPlacements: DraftConsumeRejection[];
}

export interface GenerationPreflightRevisions {
	derivedDemandRevision: string | null;
	termStructureRevision: string | null;
	teachingLoadRevision: string;
	policyRevision: string;
	shapeRevision: string;
	sourceRevision: string;
}

export interface GenerationPreflightAssembly {
	scope: { schoolId: number; schoolYearId: number };
	yearLabel: string | null;
	enforceShiftWindows: boolean;
	derived: DerivedDemandSuccess | null;
	derivedDemandBlockers: DerivedDemandBlocker[];
	derivedDemandRevision: string | null;
	termStructure: { format: 'TRIMESTER' | 'QUARTERS'; semanticRevision: string; terms: Array<{ identity: string; displayLabel: string; order: number }> } | null;
	sectionMirrorCount: number;
	sectionsByGrade: ConstructorInput['sectionsByGrade'];
	detectedScopes: Array<{ gradeLevel: number; programType: string }>;
	policyRow: Record<string, unknown> | null;
	policy: { present: boolean; id: number | null; periodLengthMinutes: number; periodsPerDay: number };
	faculty: any[];
	facultySubjects: FacultySubjectInput[];
	ownershipRows: any[];
	pairOwners: Record<string, number>;
	teachingLoadCoverage: GenerationPreflightTeachingLoadCoverage;
	rooms: any[];
	roomsWithGradeScope: RoomInput[];
	buildings: any[];
	subjects: any[];
	schedulableSubjects: SubjectInput[];
	preferences: any[];
	cohorts: any[];
	gradeWindows: any[];
	specialEvents: any[];
	slotCoverage: CanonicalTemplateCoverage[];
	missingSlotScopes: Array<{ gradeLevel: number; programType: string }>;
	missingWindows: Array<{ gradeLevel: number; programType: string }>;
	canonicalSlotsByGradeProgram: Map<string, Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>>;
	templateProfiles: Array<{ programType: string; periodLengthMinutes: number; periodsPerDay: number }>;
	classTemplatePeriods: Record<string, number>;
	timetableShapeContracts: TimetableShapeContract[];
	demand: DemandItem[];
	perTermDemandLines: DerivedPerTermDemandLine[];
	retained: GenerationPreflightRetained;
	schedulerCanRun: boolean;
	revisions: GenerationPreflightRevisions;
	blockers: GenerationPreflightBlocker[];
}

export interface GenerationPreflightResult {
	ok: boolean;
	scope: { schoolId: number; schoolYearId: number };
	assembly: GenerationPreflightAssembly;
	blockers: GenerationPreflightBlocker[];
}

export interface GenerationPreflightDependencies {
	client?: unknown;
	termContract?: VerifiedTermContract;
	/** Enforce persisted grade shift windows in the shape contracts (default false). */
	enforceShiftWindows?: boolean;
	/** Resolve retained drafts read-only (default true). */
	includeRetainedDrafts?: boolean;
}

/**
 * Unresolved 2026-2027 stakeholder decisions are surfaced as explicit notes.
 * They are never silently encoded into demand or shapes and never block
 * unrelated shape validation.
 */
export const STAKEHOLDER_DECISION_NOTES: string[] = [
	'Friday variant: the stakeholder note allowing ARAL to be replaced by TLE on Friday is not encoded as schedulable; it remains an explicit unresolved decision.',
	'Duplicate 12:15–13:00 row: Lunch Break remains blocked for class placement; the overlapping Flag Ceremony/HGP/TLE row remains template drift pending a Product decision.',
];

const KNOWN_GRADE_LEVELS = new Set([7, 8, 9, 10]);

function sha256(value: unknown): string {
	return createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex').toUpperCase();
}

function countByCode(codes: string[]): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const code of codes) counts[code] = (counts[code] ?? 0) + 1;
	return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function emptyTeachingLoadCoverage(): GenerationPreflightTeachingLoadCoverage {
	return { requiredPairs: 0, ownedPairs: 0, missingPairs: 0, inactiveOrStalePairs: 0, outsideScopePairs: 0, missing: [] };
}

function emptyRetained(): GenerationPreflightRetained {
	return { available: false, lockedEntries: [], prePlacedCount: 0, invalidPrePlacedCount: 0, skippedPrePlacedReasons: [], acceptedPlacementIds: [], rejectedPlacements: [] };
}

function preflightError(statusCode: number, code: string, message: string): Error & { statusCode: number; code: string } {
	const error = new Error(message) as Error & { statusCode: number; code: string };
	error.statusCode = statusCode;
	error.code = code;
	return error;
}

export function classifyShapePolicyBlocker(blocker: TimetableShapePolicyBlocker): GenerationPreflightBlocker {
	const resource = blocker.code === 'ROOMS_MISSING';
	const authority = blocker.code === 'TERM_CACHE_MISSING' || blocker.code === 'TERM_AUTHORITY_STALE' || blocker.code === 'ROTATION_TERM_INVALID';
	return {
		code: blocker.code,
		category: resource ? 'RESOURCE_INFEASIBLE' : authority ? 'DEMAND_AUTHORITY' : 'POLICY_BLOCKER',
		termIdentity: blocker.termIdentity,
		sectionId: blocker.sectionId,
		subjectId: blocker.subjectId,
		subjectCode: null,
		entity: blocker.entity,
		reason: blocker.message,
		owningSurface: blocker.owningSurface,
		nextAction: 'Resolve the named timetable authority, shape, policy, or resource prerequisite, then re-run readiness.',
	};
}

export function buildSectionScopeMap(sectionsByGrade: ConstructorInput['sectionsByGrade']): Map<number, { gradeLevel: number; programType: string }> {
	const map = new Map<number, { gradeLevel: number; programType: string }>();
	for (const grade of sectionsByGrade) {
		// Section gradeLevelId is an EnrollPro internal ID.
		const gradeLevel = normalizeInternalGradeId(grade.gradeLevelId);
		for (const section of grade.sections) {
			map.set(section.id, { gradeLevel, programType: normalizeProgramType((section as { programType?: string | null }).programType) });
		}
	}
	return map;
}

/**
 * GEN-C02R Correction 9: required weekly sessions for a section/term must fit
 * the authoritative canonical CLASS capacity (canonical CLASS rows × 5 days).
 * Overflow is a HARD pre-write blocker, never permission to leave the shape.
 */
export function computeCanonicalCapacityBlockers(args: {
	schoolId: number;
	schoolYearId: number;
	derived: DerivedDemandSuccess;
	sectionsByGrade: ConstructorInput['sectionsByGrade'];
	canonicalSlotsByGradeProgram: Map<string, Array<{ rowKind: string }>>;
}): GenerationPreflightBlocker[] {
	const blockers: GenerationPreflightBlocker[] = [];
	const sectionScope = buildSectionScopeMap(args.sectionsByGrade);
	const required = new Map<string, number>();
	for (const pair of args.derived.teachingLoadPairs) {
		for (const term of pair.termIdentities) {
			const key = `${pair.sectionExternalId}:${term}`;
			required.set(key, (required.get(key) ?? 0) + pair.sessionsPerWeek);
		}
	}
	for (const [key, sessions] of required) {
		const separatorIndex = key.indexOf(':');
		const sectionId = Number(key.slice(0, separatorIndex));
		const termIdentity = key.slice(separatorIndex + 1);
		const scope = sectionScope.get(sectionId);
		if (!scope) continue;
		const rows = args.canonicalSlotsByGradeProgram.get(`${scope.gradeLevel}:${scope.programType}`);
		const classRows = (rows ?? []).filter((row) => row.rowKind === 'CLASS').length;
		if (classRows === 0) continue;
		const capacity = classRows * 5;
		if (sessions > capacity) {
			blockers.push({
				code: 'CANONICAL_SHAPE_CAPACITY_EXCEEDED',
				category: 'POLICY_BLOCKER',
				termIdentity,
				sectionId,
				subjectId: null,
				subjectCode: null,
				entity: `school ${args.schoolId} · year ${args.schoolYearId} · section ${sectionId} · ${termIdentity} · grade ${scope.gradeLevel} ${scope.programType}`,
				reason: `Required ${sessions} weekly sessions exceed the ${capacity} canonical CLASS slots available for grade ${scope.gradeLevel} ${scope.programType} in ${termIdentity}.`,
				owningSurface: 'Class-program template / shift windows',
				nextAction: 'Reduce demand, correct the canonical class-program shape, or split the section; do not widen the shift to leave the canonical shape.',
			});
		}
	}
	return blockers;
}

/**
 * GEN-C02R Correction 8 / GEN-C02R1 F2: every scheduled entry must belong to
 * its exact grade/program canonical CLASS row set (or the authoritative shape
 * period slots when no canonical rows exist). A shape violation is a HARD
 * blocker that prevents generation even when the generic validator reports no
 * other violation. Exported so the stakeholder-shape suite exercises the real
 * production resolver rather than re-deriving the allowed rows.
 */
export function validateCanonicalEntryShapes(
	entries: ScheduledEntry[],
	shapeContracts: TimetableShapeContract[],
	sectionScope: Map<number, { gradeLevel: number; programType: string }>,
): GenerationPreflightBlocker[] {
	const blockers: GenerationPreflightBlocker[] = [];
	for (const entry of entries) {
		const scope = sectionScope.get(entry.sectionId);
		if (!scope) continue;
		const shape = resolveTimetableShapeContract(shapeContracts, scope.gradeLevel, scope.programType ?? null);
		if (!shape) continue;
		const canonicalClassSlots = shape.canonicalSlots?.filter((slot) => slot.rowKind === 'CLASS') ?? [];
		const allowed = canonicalClassSlots.length > 0 ? canonicalClassSlots : shape.periodSlots;
		const allowedKeys = new Set(allowed.map((slot) => `${slot.startTime}-${slot.endTime}`));
		const key = `${entry.startTime}-${entry.endTime}`;
		if (!allowedKeys.has(key)) {
			const termIdentity = (entry as ScheduledEntry & { termIndex?: number }).termIndex ? `T${(entry as ScheduledEntry & { termIndex?: number }).termIndex}` : null;
			blockers.push({
				code: 'CANONICAL_SHAPE_VIOLATION',
				category: 'POLICY_BLOCKER',
				termIdentity,
				sectionId: entry.sectionId,
				subjectId: entry.subjectId,
				subjectCode: null,
				entity: `Section ${entry.sectionId} · Subject ${entry.subjectId} · grade ${scope.gradeLevel} ${scope.programType}${termIdentity ? ` · ${termIdentity}` : ''} · ${entry.day} ${key}`,
				reason: `Scheduled entry ${key} is not an authoritative canonical CLASS row for grade ${scope.gradeLevel} ${scope.programType}${termIdentity ? ` in ${termIdentity}` : ''}.`,
				owningSurface: 'Class-program template / shift windows',
				nextAction: 'Correct the entry to a canonical CLASS row for its grade/program, then re-run readiness.',
			});
		}
	}
	return blockers;
}

export function classifyUnassignedBlocker(item: {
	sectionId: number;
	subjectId: number;
	gradeLevel: number;
	session: number;
	reason: string;
	roomAssignmentReason?: string;
	homeRoomFallbackCause?: string;
	termIndex?: number;
}, termIdentity: string | null, subjectCode: string | null = null): GenerationPreflightBlocker {
	const base = {
		termIdentity,
		sectionId: item.sectionId,
		subjectId: item.subjectId,
		subjectCode,
		entity: `Section ${item.sectionId} · Subject ${subjectCode ?? item.subjectId}${termIdentity ? ` · ${termIdentity}` : ''} · session ${item.session}`,
	};
	const roomReason = item.roomAssignmentReason;
	if (item.reason === 'NO_QUALIFIED_FACULTY' || roomReason === 'NO_QUALIFIED_FACULTY') {
		return {
			...base,
			code: 'TL_NO_QUALIFIED_OWNER',
			category: 'DATA_GAP',
			reason: 'No qualified faculty owner covers this section/subject demand.',
			owningSurface: 'Teaching Load',
			nextAction: 'Assign a qualified owner for this section/subject in Teaching Load, then re-run readiness.',
		};
	}
	if (item.reason === 'FACULTY_OVERLOADED' || roomReason === 'FACULTY_SLOT_UNAVAILABLE') {
		return {
			...base,
			code: 'WORKLOAD_POLICY_BLOCK',
			category: 'POLICY_BLOCKER',
			reason: 'Every candidate owner is at their workload/slot limit for this session.',
			owningSurface: 'Teaching Load / Scheduling policy',
			nextAction: 'Reduce assigned load or adjust the workload policy for this school year.',
		};
	}
	if (item.reason === 'NO_COMPATIBLE_ROOM' || item.reason === 'ROOM_CAPACITY_EXCEEDED' || roomReason === 'ROOM_PATH_EXHAUSTED' || roomReason === 'SPECIALIZED_ROOM_UNAVAILABLE' || roomReason === 'HOME_ROOM_UNAVAILABLE') {
		return {
			...base,
			code: 'ROOM_RESOURCE_UNAVAILABLE',
			category: 'RESOURCE_INFEASIBLE',
			reason: `No room matched the required type/features/capacity for this session${item.homeRoomFallbackCause ? ` (${item.homeRoomFallbackCause})` : ''}.`,
			owningSurface: 'Campus map / rooms',
			nextAction: 'Add or reclassify a suitable room (type, features, capacity), then re-run readiness.',
		};
	}
	if (roomReason === 'POLICY_SLOT_BLOCKED' || roomReason === 'NO_VALID_PERIOD_IN_POLICY_WINDOW') {
		return {
			...base,
			code: 'POLICY_WINDOW_BLOCK',
			category: 'POLICY_BLOCKER',
			reason: 'No valid period exists inside the configured policy/grade window for this session.',
			owningSurface: 'Scheduling policy / grade windows',
			nextAction: 'Widen the day-shape window or reduce the required weekly sessions, then re-run readiness.',
		};
	}
	return {
		...base,
		code: 'SEARCH_LIMIT_UNRESOLVED',
		category: 'ALGORITHM_LIMIT',
		reason: `The scheduler could not place this session (${item.reason}) within its bounded search.`,
		owningSurface: 'Generation algorithm',
		nextAction: 'Inspect coordinated resources for this grade/program and re-run readiness after data/policy fixes.',
	};
}

export function sortPreflightBlockers(blockers: GenerationPreflightBlocker[]): GenerationPreflightBlocker[] {
	return [...blockers].sort((a, b) =>
		`${a.category}:${a.code}:${String(a.sectionId ?? -1).padStart(12, '0')}:${String(a.subjectId ?? -1).padStart(12, '0')}:${a.entity}`
			.localeCompare(`${b.category}:${b.code}:${String(b.sectionId ?? -1).padStart(12, '0')}:${String(b.subjectId ?? -1).padStart(12, '0')}:${b.entity}`),
	);
}

function classifyDemandBlocker(blocker: DerivedDemandBlocker): GenerationPreflightBlocker {
	return {
		code: blocker.code,
		category: 'DEMAND_AUTHORITY',
		termIdentity: null,
		sectionId: null,
		subjectId: blocker.subjectId ?? null,
		subjectCode: blocker.subjectCode ?? null,
		entity: blocker.subjectCode ? `Subject ${blocker.subjectCode}` : 'Active school year / term structure',
		reason: blocker.message,
		owningSurface: 'Subject scheduling authority / EnrollPro term contract',
		nextAction: 'Resolve the ordered EnrollPro term contract and Subject rotation metadata, then re-run readiness.',
	};
}

async function loadReadOnlySectionsByGrade(schoolId: number, schoolYearId: number, client: any): Promise<SectionsByGrade[]> {
	const mirrors = await client.sectionMirror.findMany({
		where: { schoolId, schoolYearId, isStale: false },
		orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
	});
	const byGrade = new Map<number, SectionsByGrade>();
	for (const m of mirrors) {
		if (!byGrade.has(m.gradeLevelId)) {
			byGrade.set(m.gradeLevelId, { gradeLevelId: m.gradeLevelId, gradeLevelName: m.gradeLevelName, displayOrder: m.displayOrder, sections: [] });
		}
		byGrade.get(m.gradeLevelId)!.sections.push({
			mirrorId: m.id,
			id: m.externalId,
			name: m.name,
			maxCapacity: m.maxCapacity,
			enrolledCount: m.enrolledCount,
			gradeLevelId: m.gradeLevelId,
			gradeLevelName: m.gradeLevelName,
			displayOrder: m.displayOrder,
			homeRoomId: m.homeRoomId,
			buildingZoneId: m.buildingZoneId,
			programType: m.programType,
			programCode: m.programCode,
			programName: m.programName,
			isSpecialProgram: m.isSpecialProgram,
			tleProgramId: m.tleProgramId,
			tleSpecialization: m.tleSpecialization,
			tleProgramCategory: m.tleProgramCategory,
		});
	}
	return [...byGrade.values()].sort((a, b) => a.displayOrder - b.displayOrder);
}

function collectDetectedScopes(sectionsByGrade: ConstructorInput['sectionsByGrade']): Array<{ gradeLevel: number; programType: string }> {
	const scopes = new Map<string, { gradeLevel: number; programType: string }>();
	for (const grade of sectionsByGrade) {
		const gradeLevel = normalizeInternalGradeId(grade.gradeLevelId);
		for (const section of grade.sections) {
			const programType = normalizeProgramType(section.programType);
			const key = `${gradeLevel}:${programType}`;
			if (!scopes.has(key)) scopes.set(key, { gradeLevel, programType });
		}
	}
	return [...scopes.values()];
}

function summarizeTeachingLoadCoverage(
	derived: DerivedDemandSuccess,
	ownershipBySubjectSection: Map<string, any[]>,
	facultyById: Map<number, { isActiveForScheduling: boolean; isStale: boolean }>,
	scopeByFacultySubject: Map<string, any>,
): GenerationPreflightTeachingLoadCoverage {
	let ownedPairs = 0;
	let missingPairs = 0;
	let inactiveOrStalePairs = 0;
	let outsideScopePairs = 0;
	const missing: GenerationPreflightTeachingLoadCoverage['missing'] = [];
	for (const pair of derived.teachingLoadPairs) {
		const ownerRows = ownershipBySubjectSection.get(`${pair.subjectId}:${pair.sectionExternalId}`) ?? [];
		if (ownerRows.length === 0) {
			missingPairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		const owner = ownerRows[0];
		const faculty = facultyById.get(owner.facultyId);
		if (!faculty || faculty.isStale || !faculty.isActiveForScheduling) {
			inactiveOrStalePairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		const scope = scopeByFacultySubject.get(`${owner.facultyId}:${pair.subjectId}`);
		if (!scope) {
			outsideScopePairs += 1;
			missing.push({ subjectId: pair.subjectId, subjectCode: pair.subjectCode, sectionMirrorId: pair.sectionMirrorId, sectionExternalId: pair.sectionExternalId, termIdentities: [...pair.termIdentities] });
			continue;
		}
		ownedPairs += 1;
	}
	return {
		requiredPairs: derived.teachingLoadPairs.length,
		ownedPairs,
		missingPairs,
		inactiveOrStalePairs,
		outsideScopePairs,
		missing: missing.sort((a, b) => `${a.sectionExternalId}:${a.subjectId}`.localeCompare(`${b.sectionExternalId}:${b.subjectId}`)),
	};
}

function buildSourceRevisionPayload(assembly: GenerationPreflightAssembly): unknown {
	return {
		kind: 'GENERATION_PREFLIGHT_V1',
		schoolId: assembly.scope.schoolId,
		schoolYearId: assembly.scope.schoolYearId,
		derivedDemandRevision: assembly.derivedDemandRevision,
		termStructureRevision: assembly.termStructure?.semanticRevision ?? null,
		enforceShiftWindows: assembly.enforceShiftWindows,
		sections: assembly.sectionsByGrade.flatMap((grade) => grade.sections.map((section) => ({
			mirrorId: section.mirrorId,
			id: section.id,
			gradeLevelId: grade.gradeLevelId,
			programType: section.programType ?? null,
			enrolledCount: section.enrolledCount,
			homeRoomId: section.homeRoomId ?? null,
		}))),
		pairOwners: Object.entries(assembly.pairOwners).sort(([a], [b]) => a.localeCompare(b)),
		policy: { id: assembly.policy.id, periodLengthMinutes: assembly.policy.periodLengthMinutes, periodsPerDay: assembly.policy.periodsPerDay },
		gradeWindows: assembly.gradeWindows.map((window) => ({ gradeLevel: window.gradeLevel, programType: window.programType ?? null, startTime: window.startTime, endTime: window.endTime })),
		shapes: assembly.timetableShapeContracts.map((shape) => ({
			gradeLevel: shape.gradeLevel,
			programType: shape.programType,
			canonicalSlots: (shape.canonicalSlots ?? []).map((slot) => ({ startTime: slot.startTime, endTime: slot.endTime, rowKind: slot.rowKind })),
		})),
		demand: assembly.demand.map((item) => ({
			sectionId: item.sectionId,
			subjectId: item.subjectId,
			sessionsPerWeek: item.sessionsPerWeek,
			durationPerSession: item.durationPerSession,
			modularGroupId: item.modularGroupId ?? null,
		})),
		retainedAccepted: assembly.retained.acceptedPlacementIds,
	};
}

export function computePreflightRevisions(args: {
	derivedDemandRevision: string | null;
	termStructureRevision: string | null;
	ownershipRows: any[];
	pairOwners: Record<string, number>;
	policy: { id: number | null; periodLengthMinutes: number; periodsPerDay: number };
	gradeWindows: any[];
	shapes: TimetableShapeContract[];
}): GenerationPreflightRevisions {
	return {
		derivedDemandRevision: args.derivedDemandRevision,
		termStructureRevision: args.termStructureRevision,
		teachingLoadRevision: sha256({
			ownership: args.ownershipRows.map((row) => ({ subjectId: row.subjectId, sectionId: row.sectionId, facultyId: row.facultyId ?? null })).sort((a, b) => `${a.subjectId}:${a.sectionId}:${a.facultyId}`.localeCompare(`${b.subjectId}:${b.sectionId}:${b.facultyId}`)),
			pairOwners: Object.entries(args.pairOwners).sort(([a], [b]) => a.localeCompare(b)),
		}),
		policyRevision: sha256(args.policy),
		shapeRevision: sha256(args.shapes.map((shape) => ({ gradeLevel: shape.gradeLevel, programType: shape.programType, canonicalSlots: (shape.canonicalSlots ?? []).map((slot) => `${slot.startTime}-${slot.endTime}:${slot.rowKind}`) }))),
		sourceRevision: '',
	};
}

export function buildGenerationPreflight(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationPreflightDependencies = {},
): Promise<GenerationPreflightResult> {
	if (!Number.isInteger(schoolId) || schoolId <= 0) return Promise.reject(preflightError(400, 'INVALID_PARAM', 'schoolId must be a positive integer.'));
	if (!Number.isInteger(schoolYearId) || schoolYearId <= 0) return Promise.reject(preflightError(400, 'INVALID_PARAM', 'schoolYearId must be a positive integer.'));
	const run = () => buildGenerationPreflightWithContext(schoolId, schoolYearId, dependencies);
	return dependencies.client ? withDataContext(dependencies.client, run) : run();
}

async function buildGenerationPreflightWithContext(
	schoolId: number,
	schoolYearId: number,
	dependencies: GenerationPreflightDependencies,
): Promise<GenerationPreflightResult> {
	const client = db() as any;
	const enforceShiftWindows = dependencies.enforceShiftWindows === true;
	const blockers: GenerationPreflightBlocker[] = [];

	const policyRow = await client.schedulingPolicy.findUnique({
		where: { schoolId_schoolYearId: { schoolId, schoolYearId } },
	});
	const policy = {
		present: policyRow != null,
		id: policyRow?.id ?? null,
		periodLengthMinutes: policyRow?.periodLengthMinutes ?? POLICY_DEFAULTS.periodLengthMinutes,
		periodsPerDay: policyRow?.periodsPerDay ?? POLICY_DEFAULTS.periodsPerDay,
	};
	if (!policy.present) {
		blockers.push({
			code: 'POLICY_UNINITIALIZED',
			category: 'POLICY_BLOCKER',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Scheduling policy · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No scheduling policy row exists for this school year.',
			owningSurface: 'Scheduling policy',
			nextAction: 'Save the scheduling policy for this school year, then re-run readiness.',
		});
	}

	let derived: DerivedDemandSuccess | null = null;
	let derivedDemandBlockers: DerivedDemandBlocker[] = [];
	try {
		const derivedResult = await buildDerivedDemand(schoolId, schoolYearId, {
			termContract: dependencies.termContract,
			periodLengthMinutes: policy.periodLengthMinutes,
		});
		if (derivedResult.ok) {
			derived = derivedResult;
		} else {
			derivedDemandBlockers = derivedResult.blockers;
		}
	} catch (error) {
		const code = (error as { code?: string }).code;
		if (code === 'ACTIVE_YEAR_UNAVAILABLE' || code === 'ACTIVE_YEAR_AMBIGUOUS' || code === 'INACTIVE_HISTORICAL_YEAR') {
			derivedDemandBlockers = [{ code: code as DerivedDemandBlocker['code'], message: error instanceof Error ? error.message : String(error) }];
		} else {
			throw error;
		}
	}
	for (const blocker of derivedDemandBlockers) blockers.push(classifyDemandBlocker(blocker));
	if (derived && !dependencies.termContract && typeof client.enrollProSchoolYearMirror?.findUnique === 'function') {
		const authorityMirror = await client.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
			select: { termContractCache: true, termContractCachedAt: true },
		});
		const persistedRevision = (authorityMirror?.termContractCache as { semanticRevision?: unknown } | null)?.semanticRevision;
		if (typeof persistedRevision === 'string' && persistedRevision !== derived.termStructure.semanticRevision) {
			blockers.push({
				code: 'TERM_AUTHORITY_STALE',
				category: 'DEMAND_AUTHORITY',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Ordered term authority · school ${schoolId} · year ${schoolYearId}`,
				reason: 'The persisted term authority revision does not match the canonical ordered-term revision.',
				owningSurface: 'EnrollPro term authority cache',
				nextAction: 'Refresh and verify the ordered term authority, then re-run readiness.',
			});
		}
	}

	const sectionMirrorCount = await client.sectionMirror.count({ where: { schoolId, schoolYearId, isStale: false } });
	if (sectionMirrorCount === 0) {
		blockers.push({
			code: 'SECTION_SETUP_REQUIRED',
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Sections · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No active, non-stale section mirrors exist for this school year.',
			owningSurface: 'Sections / EnrollPro sync',
			nextAction: 'Sync and review sections from EnrollPro, then re-run readiness.',
		});
	}

	const [
		faculty,
		facultySubjectRows,
		rooms,
		subjects,
		preferences,
		buildings,
		specialEvents,
		gradeWindows,
		ownershipRows,
		cohorts,
	] = await Promise.all([
		client.facultyMirror.findMany({
			where: { schoolId, isActiveForScheduling: true, isStale: false },
			select: { id: true, maxHoursPerWeek: true, ancillaryMinutesPerWeek: true, department: true, isActiveForScheduling: true, isStale: true },
		}),
		client.facultySubject.findMany({ where: { schoolId, schoolYearId } }),
		client.room.findMany({
			where: { isTeachingSpace: true, building: { schoolId, isTeachingBuilding: true } },
			select: { id: true, type: true, isTeachingSpace: true, isSharedFacility: true, capacity: true, features: true, buildingId: true, buildingZoneId: true, building: { select: { gradeScope: true } } },
		}),
		client.subject.findMany({
			where: { schoolId, isActive: true },
			select: {
				id: true, code: true, name: true, ownerDepartment: true, qualificationPriority: true, minMinutesPerWeek: true,
				preferredRoomType: true, gradeLevels: true, interSectionEnabled: true, interSectionGradeLevels: true,
				programScopes: true, allowedSpecializations: true, requiredFeatures: true, modularGroupId: true, modularOrder: true,
			},
		}),
		client.facultyPreference.findMany({ where: { schoolId, schoolYearId }, select: { facultyId: true, status: true } }),
		client.building.findMany({ where: { schoolId }, select: { id: true, name: true, x: true, y: true } }),
		client.policySpecialEvent.findMany({ where: { schoolId, schoolYearId, enabled: true }, orderBy: [{ sortOrder: 'asc' }, { eventType: 'asc' }] }),
		client.gradeShiftWindow.findMany({ where: { schoolId, schoolYearId } }),
		client.subjectSectionOwnership.findMany({ where: { schoolId, schoolYearId } }),
		client.instructionalCohort.findMany({
			where: { schoolId, schoolYearId, isActive: true },
			orderBy: [{ gradeLevel: 'asc' }, { cohortCode: 'asc' }],
			select: {
				cohortCode: true,
				specializationCode: true,
				specializationName: true,
				gradeLevel: true,
				memberSectionIds: true,
				expectedEnrollment: true,
				preferredRoomType: true,
			},
		}),
	]);

	const sectionsByGrade = (sectionMirrorCount > 0
		? await loadReadOnlySectionsByGrade(schoolId, schoolYearId, client)
		: []) as ConstructorInput['sectionsByGrade'];
	const roomsWithGradeScope = rooms.map((r: any) => ({ ...r, buildingGradeScope: r.building?.gradeScope ?? [] })) as RoomInput[];
	if (rooms.length === 0) {
		blockers.push({
			code: 'ROOMS_MISSING',
			category: 'RESOURCE_INFEASIBLE',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Teaching rooms · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No teaching rooms are available for timetable placement.',
			owningSurface: 'Campus map / rooms',
			nextAction: 'Add or activate at least one teaching room, then re-run readiness.',
		});
	}

	const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
	const activeFacultyIdSet = new Set(faculty.map((member: any) => member.id));
	const facultySubjects = facultySubjectRows
		.filter((assignment: any) => activeFacultyIdSet.has(assignment.facultyId))
		.map((assignment: any) => {
			const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
			return { facultyId: assignment.facultyId, subjectId: assignment.subjectId, gradeLevels: normalized.gradeLevels, sectionIds: normalized.sectionIds };
		});

	const schedulableSubjects = subjects.filter((subject: any) => !/^(HG|ARAL)$/i.test(String(subject.code ?? ''))) as SubjectInput[];

	const facultyById = new Map<number, { isActiveForScheduling: boolean; isStale: boolean }>();
	for (const member of faculty) facultyById.set(member.id, { isActiveForScheduling: member.isActiveForScheduling, isStale: member.isStale });
	const scopeByFacultySubject = new Map<string, any>();
	for (const fs of facultySubjectRows) scopeByFacultySubject.set(`${fs.facultyId}:${fs.subjectId}`, fs);
	const ownershipBySubjectSection = new Map<string, any[]>();
	for (const row of ownershipRows) {
		const key = `${row.subjectId}:${row.sectionId}`;
		const list = ownershipBySubjectSection.get(key) ?? [];
		list.push(row);
		ownershipBySubjectSection.set(key, list);
	}

	const coverage = derived
		? summarizeTeachingLoadCoverage(derived, ownershipBySubjectSection, facultyById, scopeByFacultySubject)
		: emptyTeachingLoadCoverage();

	const pairOwners: Record<string, number> = {};
	for (const [key, rows] of ownershipBySubjectSection) {
		const owners = [...new Set(rows.map((row: any) => row.facultyId).filter((id: unknown): id is number => typeof id === 'number' && id > 0))];
		if (owners.length === 0) continue;
		const [subjectIdRaw, sectionIdRaw] = key.split(':');
		if (owners.length > 1) {
			blockers.push({
				code: 'TL_OWNERSHIP_CONFLICT',
				category: 'DATA_GAP',
				termIdentity: null,
				sectionId: Number(sectionIdRaw),
				subjectId: Number(subjectIdRaw),
				subjectCode: null,
				entity: `Ownership · subject ${subjectIdRaw} · section ${sectionIdRaw}`,
				reason: `Multiple canonical owners (${owners.join(', ')}) claim this section/subject pair.`,
				owningSurface: 'Teaching Load',
				nextAction: 'Reconcile the duplicate Teaching Load owners so exactly one remains, then re-run readiness.',
			});
			continue;
		}
		pairOwners[key] = owners[0];
	}
	if (ownershipRows.length === 0) {
		blockers.push({
			code: 'TEACHING_LOAD_REVIEW_REQUIRED',
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: null,
			subjectId: null,
			subjectCode: null,
			entity: `Teaching Load · school ${schoolId} · year ${schoolYearId}`,
			reason: 'No Teaching Load owner rows exist for this school year.',
			owningSurface: 'Teaching Load',
			nextAction: 'Open Teaching Load, assign section owners, save the load, then re-run generation.',
		});
	}
	for (const missing of coverage.missing) {
		blockers.push({
			code: 'TL_DEMAND_UNCOVERED',
			category: 'DATA_GAP',
			termIdentity: missing.termIdentities[0] ?? null,
			sectionId: missing.sectionExternalId,
			subjectId: missing.subjectId,
			subjectCode: missing.subjectCode,
			entity: `Section ${missing.sectionExternalId} · Subject ${missing.subjectCode}`,
			reason: 'Derived demand exists but no active Teaching Load owner covers this section/subject.',
			owningSurface: 'Teaching Load',
			nextAction: 'Assign a qualified owner for this section/subject in Teaching Load, then re-run readiness.',
		});
	}

	const slotCoverage = await readCanonicalClassProgramSlotsCoverage(schoolId, schoolYearId);
	const detectedScopes = collectDetectedScopes(sectionsByGrade);
	const slotCoverageByKey = new Map(slotCoverage.map((entry) => [`${entry.gradeLevel}:${entry.programType}`, entry]));
	const missingSlotScopes: Array<{ gradeLevel: number; programType: string }> = [];
	for (const scope of detectedScopes) {
		if (!KNOWN_GRADE_LEVELS.has(scope.gradeLevel)) continue;
		const entry = slotCoverageByKey.get(`${scope.gradeLevel}:${scope.programType}`);
		if (!entry || entry.issues.length > 0) {
			missingSlotScopes.push(scope);
			blockers.push({
				code: 'CANONICAL_TEMPLATE_INCOMPLETE',
				category: 'DATA_GAP',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Grade ${scope.gradeLevel} ${scope.programType}`,
				reason: 'The active-year class-program template is missing or incomplete.',
				owningSurface: 'Class-program template',
				nextAction: 'Review and complete the class-program template for this grade/program, then re-run readiness.',
			});
		}
	}

	const windowKeys = new Set((gradeWindows as any[]).map((w) => `${w.gradeLevel}:${normalizeProgramType(w.programType)}`));
	const missingWindows: Array<{ gradeLevel: number; programType: string }> = [];
	if (enforceShiftWindows) {
		for (const scope of detectedScopes) {
			if (!KNOWN_GRADE_LEVELS.has(scope.gradeLevel)) continue;
			const hasExact = windowKeys.has(`${scope.gradeLevel}:${scope.programType}`);
			const hasAll = windowKeys.has(`${scope.gradeLevel}:ALL`);
			if (!hasExact && !hasAll) {
				missingWindows.push(scope);
				blockers.push({
					code: 'GRADE_WINDOW_MISSING',
					category: 'POLICY_BLOCKER',
					termIdentity: null,
					sectionId: null,
					subjectId: null,
					subjectCode: null,
					entity: `Grade ${scope.gradeLevel} ${scope.programType}`,
					reason: 'No persisted grade shift window (exact or ALL) covers this grade/program.',
					owningSurface: 'Grade windows',
					nextAction: 'Set a grade shift window for this grade/program, then re-run readiness.',
				});
			}
		}
	}

	// ── Canonical shape contracts (persisted class-program template rows) ────
	const canonicalSlotsByGradeProgram = new Map<string, Array<{ startTime: string; endTime: string; subjectFamily: string | null; subjectLabel?: string | null; rowKind: string }>>();
	if (derived) {
		for (const scope of detectedScopes) {
			const allSlots = await resolveClassProgramSlots(schoolId, schoolYearId, scope.gradeLevel as any, scope.programType as any);
			if (allSlots.length > 0) {
				canonicalSlotsByGradeProgram.set(`${scope.gradeLevel}:${scope.programType}`, allSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime, subjectFamily: s.subjectFamily, subjectLabel: s.subjectLabel, rowKind: s.rowKind })));
			}
		}
	}
	const templateProfiles = await getTemplatePeriodProfiles(schoolId);
	const classTemplatePeriods: Record<string, number> = {};
	for (const profile of templateProfiles) classTemplatePeriods[profile.programType] = profile.periodLengthMinutes;
	const timetableShapeContracts = derived
		? buildRunTimetableShapeContracts({
			sectionsByGrade,
			gradeWindows: (enforceShiftWindows ? gradeWindows : []).map((gw: any) => ({ gradeLevel: gw.gradeLevel, programType: gw.programType ?? null, startTime: gw.startTime, endTime: gw.endTime })),
			templateProfiles,
			canonicalSlots: canonicalSlotsByGradeProgram,
			policy: {
				...(policyRow as any),
				periodLengthMinutes: policy.periodLengthMinutes,
				periodsPerDay: policy.periodsPerDay,
			} as ConstructorInput['policy'],
		})
		: [];

	// TT-SHAPE-DIAGNOSTIC-C02: bind the policy contract to the same derived
	// demand, ordered terms, canonical rows, sections, and rooms consumed by the
	// constructor. This is read-only and fails closed on shape drift.
	if (derived) {
		if (derived.totalLines === 0 || derived.totalPairs === 0) {
			blockers.push({
				code: 'EMPTY_DERIVED_DEMAND',
				category: 'DATA_GAP',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Derived demand · school ${schoolId} · year ${schoolYearId}`,
				reason: 'The canonical derived demand contains no timetable lines or teaching-load pairs; an empty schedule is never ready.',
				owningSurface: 'Derived demand / Subject authority',
				nextAction: 'Resolve active subject scope and Teaching Load demand, then re-run readiness.',
			});
		}
		const configuredFlagEvent = (specialEvents as any[]).find((event) => event.eventType === 'FLAG_OR_HGP' || /FLAG CEREMONY/i.test(String(event.label ?? '')));
		const configuredFlagDay = configuredFlagEvent
			? configuredFlagEvent.dayOfWeek ?? (configuredFlagEvent.eventType === 'FLAG_OR_HGP' ? 'MONDAY' : null)
			: 'MONDAY';
		const shapePolicyBlockers = validateTimetableShapePolicy({
			termAuthority: {
				format: derived.termStructure.format,
				terms: derived.termStructure.terms.map((term) => ({ identity: term.identity, order: term.order })),
				cachedAt: 'derived-demand-authority',
			},
			validateShiftWindows: enforceShiftWindows,
			shiftWindows: (gradeWindows as any[]).map((window) => ({ gradeLevel: window.gradeLevel, programType: normalizeProgramType(window.programType), startTime: window.startTime, endTime: window.endTime })),
			sections: sectionsByGrade.flatMap((grade) => grade.sections.map((section) => ({ id: section.id, gradeLevel: normalizeInternalGradeId(grade.gradeLevelId), programType: normalizeProgramType(section.programType) }))),
			shapes: timetableShapeContracts,
			rooms,
			subjects: subjects.map((subject: any) => ({ id: subject.id, code: subject.code, schedulingDisposition: subject.schedulingDisposition })),
			demandLines: derived.timetableLines.map((line) => ({ sectionExternalId: line.sectionExternalId, subjectId: line.subjectId, subjectCode: line.subjectCode, termIdentity: line.termIdentity, termIndex: line.termIndex, rotationFamily: line.rotationFamily })),
			flagCeremony: policyRow?.enableFlagCeremony ? { enabled: true, dayOfWeek: configuredFlagDay, startTime: configuredFlagEvent?.startTime ?? policyRow.flagCeremonyStartTime, endTime: configuredFlagEvent?.endTime ?? policyRow.flagCeremonyEndTime } : null,
		});
		for (const shapeBlocker of shapePolicyBlockers) blockers.push(classifyShapePolicyBlocker(shapeBlocker));
	}

	// ── Retained pre-generation drafts (real consumer, read-only) ───────────
	let retained = emptyRetained();
	if (derived && policy.present && sectionMirrorCount > 0 && dependencies.includeRetainedDrafts !== false) {
		try {
			const consumed = await consumeDraftPlacementsForRun(0, schoolId, schoolYearId, undefined, {
				readOnly: true,
				resolvedSectionsByGrade: sectionsByGrade,
				resolvedPolicyRecord: policyRow,
			});
			retained = {
				available: true,
				lockedEntries: consumed.lockedEntries ?? [],
				prePlacedCount: consumed.prePlacedCount,
				invalidPrePlacedCount: consumed.invalidPrePlacedCount,
				skippedPrePlacedReasons: consumed.skippedPrePlacedReasons,
				acceptedPlacementIds: consumed.acceptedPlacementIds,
				rejectedPlacements: consumed.rejectedPlacements,
			};
		} catch (error) {
			const code = (error as { code?: string }).code;
			const expected = new Set(['SECTION_SNAPSHOT_UNAVAILABLE', 'DERIVED_DEMAND_BLOCKED', 'POLICY_UNINITIALIZED']);
			if (code == null || !expected.has(code)) throw error;
			blockers.push({
				code,
				category: 'DATA_GAP',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Retained placements · school ${schoolId} · year ${schoolYearId}`,
				reason: error instanceof Error ? error.message : String(error),
				owningSurface: code === 'POLICY_UNINITIALIZED' ? 'Scheduling policy' : 'Sections / EnrollPro sync',
				nextAction: 'Resolve the named prerequisite, then re-run readiness.',
			});
		}
	}
	for (const rejected of retained.rejectedPlacements) {
		blockers.push({
			code: `RETAINED_LOCK_${rejected.code}`,
			category: 'DATA_GAP',
			termIdentity: null,
			sectionId: rejected.sectionId,
			subjectId: rejected.subjectId,
			subjectCode: null,
			entity: `Retained lock #${rejected.placementId}`,
			reason: rejected.reason,
			owningSurface: 'Pre-generation draft',
			nextAction: 'Fix or remove the rejected draft placement, then re-run readiness.',
		});
	}

	// ── Scheduler projection + exact per-term demand ────────────────────────
	let schedulerCanRun = Boolean(derived) && (derived?.totalLines ?? 0) > 0 && (derived?.totalPairs ?? 0) > 0 && sectionsByGrade.length > 0 && missingSlotScopes.length === 0 && policy.present;
	let demand: DemandItem[] = [];
	let perTermDemandLines: DerivedPerTermDemandLine[] = [];
	if (derived) {
		perTermDemandLines = toPerTermDemandLines(derived, pairOwners);
		for (const capacityBlocker of computeCanonicalCapacityBlockers({ schoolId, schoolYearId, derived, sectionsByGrade, canonicalSlotsByGradeProgram })) {
			blockers.push(capacityBlocker);
		}
	}
	if (schedulerCanRun && derived) {
		try {
			demand = toSchedulerDemandOverride(derived, sectionsByGrade, schedulableSubjects as Parameters<typeof toSchedulerDemandOverride>[2]);
		} catch (error) {
			const code = (error as { code?: string }).code;
			const projectionCodes = new Set(['ROTATION_DEMAND_INCONSISTENT', 'DERIVED_DEMAND_PROJECTION_PARITY_MISMATCH', 'DERIVED_DEMAND_PROJECTION_INCOMPLETE', 'PER_TERM_DEMAND_PARITY_MISMATCH']);
			if (code == null || !projectionCodes.has(code)) throw error;
			blockers.push({
				code,
				category: 'DEMAND_AUTHORITY',
				termIdentity: null,
				sectionId: null,
				subjectId: null,
				subjectCode: null,
				entity: `Derived demand projection · school ${schoolId} · year ${schoolYearId}`,
				reason: error instanceof Error ? error.message : String(error),
				owningSurface: 'Subject rotation authority',
				nextAction: 'Make every rotating-family member uniform per ordered term or correct the Subject rotation metadata, then re-run readiness.',
			});
			schedulerCanRun = false;
		}
	}

	const sortedBlockers = sortPreflightBlockers(blockers);
	const revisions = computePreflightRevisions({
		derivedDemandRevision: derived?.revision ?? null,
		termStructureRevision: derived ? derived.termStructure.semanticRevision : null,
		ownershipRows,
		pairOwners,
		policy,
		gradeWindows,
		shapes: timetableShapeContracts,
	});

	const assembly: GenerationPreflightAssembly = {
		scope: { schoolId, schoolYearId },
		yearLabel: derived?.yearLabel ?? null,
		enforceShiftWindows,
		derived,
		derivedDemandBlockers,
		derivedDemandRevision: derived?.revision ?? null,
		termStructure: derived
			? { format: derived.termStructure.format, semanticRevision: derived.termStructure.semanticRevision, terms: derived.termStructure.terms.map((term) => ({ identity: term.identity, displayLabel: term.displayLabel, order: term.order })) }
			: null,
		sectionMirrorCount,
		sectionsByGrade,
		detectedScopes,
		policyRow: policyRow ?? null,
		policy,
		faculty,
		facultySubjects,
		ownershipRows,
		pairOwners,
		teachingLoadCoverage: coverage,
		rooms,
		roomsWithGradeScope,
		buildings,
		subjects,
		schedulableSubjects,
		preferences,
		cohorts,
		gradeWindows,
		specialEvents,
		slotCoverage,
		missingSlotScopes,
		missingWindows,
		canonicalSlotsByGradeProgram,
		templateProfiles,
		classTemplatePeriods,
		timetableShapeContracts,
		demand,
		perTermDemandLines,
		retained,
		schedulerCanRun,
		revisions,
		blockers: sortedBlockers,
	};
	assembly.revisions.sourceRevision = sha256(buildSourceRevisionPayload(assembly));

	return {
		ok: sortedBlockers.length === 0,
		scope: { schoolId, schoolYearId },
		assembly,
		blockers: sortedBlockers,
	};
}

/**
 * F1: immediately before the first authorized generation write, re-resolve the
 * shared preflight and compare the bound revisions. Any drift (source content,
 * derived demand, or ordered term structure) returns a typed stale result so
 * the trigger can abort with zero writes instead of silently rebuilding from
 * different inputs.
 */
export interface GenerationPreflightRevalidation {
	ok: boolean;
	changed: string[];
	stale: boolean;
	current: GenerationPreflightResult;
}

export async function revalidateGenerationPreflight(
	assembly: GenerationPreflightAssembly,
	dependencies: GenerationPreflightDependencies = {},
): Promise<GenerationPreflightRevalidation> {
	const current = await buildGenerationPreflight(assembly.scope.schoolId, assembly.scope.schoolYearId, {
		...dependencies,
		enforceShiftWindows: assembly.enforceShiftWindows,
	});
	const changed: string[] = [];
	if (current.assembly.revisions.derivedDemandRevision !== assembly.revisions.derivedDemandRevision) changed.push('derivedDemandRevision');
	if (current.assembly.revisions.termStructureRevision !== assembly.revisions.termStructureRevision) changed.push('termStructureRevision');
	if (current.assembly.revisions.teachingLoadRevision !== assembly.revisions.teachingLoadRevision) changed.push('teachingLoadRevision');
	if (current.assembly.revisions.policyRevision !== assembly.revisions.policyRevision) changed.push('policyRevision');
	if (current.assembly.revisions.shapeRevision !== assembly.revisions.shapeRevision) changed.push('shapeRevision');
	if (current.assembly.revisions.sourceRevision !== assembly.revisions.sourceRevision) changed.push('sourceRevision');
	return { ok: changed.length === 0 && current.ok, changed, stale: changed.length > 0, current };
}

/**
 * Build the real scheduler input from the bound assembly. Both the readiness dry
 * run and the real trigger use this so their scheduler inputs are identical.
 */
export function buildPreflightConstructorInput(
	assembly: GenerationPreflightAssembly,
	options: {
		roomerStrategy?: 'UNIVERSAL' | 'HOME_ROOM_FIRST';
		lockedEntries?: NonNullable<ConstructorInput['lockedEntries']>;
	} = {},
): ConstructorInput {
	const derived = assembly.derived;
	if (!derived) throw preflightError(409, 'GENERATION_PREFLIGHT_INCOMPLETE', 'The canonical derived demand is not available for this preflight.');
	return {
		schoolId: assembly.scope.schoolId,
		schoolYearId: assembly.scope.schoolYearId,
		roomingStrategy: options.roomerStrategy ?? 'HOME_ROOM_FIRST',
		sectionsByGrade: assembly.sectionsByGrade,
		subjects: assembly.schedulableSubjects,
		cohorts: assembly.cohorts,
		faculty: assembly.faculty.map((member: any) => ({
			id: member.id,
			maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
			department: member.department,
		})),
		facultySubjects: assembly.facultySubjects,
		rooms: assembly.roomsWithGradeScope,
		preferences: assembly.preferences.map((p: any) => ({ facultyId: p.facultyId, status: p.status, timeSlots: [] })),
		policy: {
			...(assembly.policyRow as any),
			periodLengthMinutes: assembly.policy.periodLengthMinutes,
			periodsPerDay: assembly.policy.periodsPerDay,
		} as ConstructorInput['policy'],
		lockedEntries: options.lockedEntries ?? assembly.retained.lockedEntries,
		gradeWindows: (assembly.enforceShiftWindows ? assembly.gradeWindows : []).map((gw: any) => ({ gradeLevel: gw.gradeLevel, programType: gw.programType ?? null, startTime: gw.startTime, endTime: gw.endTime })),
		buildings: assembly.buildings.map((b: any) => ({ id: b.id, name: b.name })),
		classTemplatePeriods: assembly.classTemplatePeriods,
		timetableShapes: assembly.timetableShapeContracts,
		demandOverride: assembly.demand,
		pairOwners: assembly.pairOwners,
	};
}

/** Build the exact validator context from the bound assembly. */
export function buildPreflightValidatorContext(
	assembly: GenerationPreflightAssembly,
	entries: ScheduledEntry[],
	runId: number,
): ValidatorContext {
	const policyRow = (assembly.policyRow ?? {}) as any;
	return {
		schoolId: assembly.scope.schoolId,
		schoolYearId: assembly.scope.schoolYearId,
		runId,
		entries,
		faculty: assembly.faculty.map((member: any) => ({
			id: member.id,
			maxHoursPerWeek: Math.floor(computeEffectiveWeeklyTeachingMinutes(member.maxHoursPerWeek, member.ancillaryMinutesPerWeek) / 60),
			department: member.department,
		})),
		facultySubjects: assembly.facultySubjects,
		rooms: assembly.rooms,
		subjects: assembly.subjects,
		sectionEnrollment: new Map(assembly.sectionsByGrade.flatMap((g) => g.sections.map((s) => [s.id, s.enrolledCount] as const))),
		policy: {
			...(assembly.policyRow as any),
			periodLengthMinutes: assembly.policy.periodLengthMinutes,
			periodsPerDay: assembly.policy.periodsPerDay,
			maxTeachingMinutesPerDay: policyRow.maxTeachingMinutesPerDay,
			enforceConsecutiveBreakAsHard: policyRow.enforceConsecutiveBreakAsHard,
		},
		travelPolicy: {
			enableTravelWellbeingChecks: policyRow.enableTravelWellbeingChecks,
			maxWalkingDistanceMetersPerTransition: policyRow.maxWalkingDistanceMetersPerTransition,
			maxBuildingTransitionsPerDay: policyRow.maxBuildingTransitionsPerDay,
			maxBackToBackTransitionsWithoutBuffer: policyRow.maxBackToBackTransitionsWithoutBuffer,
			maxIdleGapMinutesPerDay: policyRow.maxIdleGapMinutesPerDay,
			avoidEarlyFirstPeriod: policyRow.avoidEarlyFirstPeriod,
			avoidLateLastPeriod: policyRow.avoidLateLastPeriod,
		},
		vacantPolicy: {
			enableVacantAwareConstraints: policyRow.enableVacantAwareConstraints,
			targetFacultyDailyVacantMinutes: policyRow.targetFacultyDailyVacantMinutes,
			targetSectionDailyVacantPeriods: policyRow.targetSectionDailyVacantPeriods,
			maxCompressedTeachingMinutesPerDay: policyRow.maxCompressedTeachingMinutesPerDay,
		},
		buildings: assembly.buildings,
		roomBuildings: assembly.rooms.map((r: any) => ({ roomId: r.id, buildingId: r.buildingId })),
		constraintConfig: {
			...DEFAULT_CONSTRAINT_CONFIG,
			...(policyRow.constraintConfig as Record<string, { enabled: boolean; weight: number; treatAsHard: boolean }> ?? {}),
		},
	};
}

/** Deterministic aggregate shape/validator policy summary for parity checks. */
export function summarizePreflightParity(assembly: GenerationPreflightAssembly) {
	return {
		derivedDemandRevision: assembly.revisions.derivedDemandRevision,
		termStructureRevision: assembly.revisions.termStructureRevision,
		sourceRevision: assembly.revisions.sourceRevision,
		teachingLoadRevision: assembly.revisions.teachingLoadRevision,
		policyRevision: assembly.revisions.policyRevision,
		shapeRevision: assembly.revisions.shapeRevision,
		termIdentities: assembly.termStructure?.terms.map((term) => term.identity) ?? [],
		demandByTerm: assembly.derived?.totalsByTerm ?? {},
		demandIdentities: assembly.perTermDemandLines.map((line) => `${line.subjectId}:${line.sectionExternalId}:${line.termIdentity}`),
		pairOwners: assembly.pairOwners,
		shapeSignatures: assembly.timetableShapeContracts.map((shape) => ({
			gradeLevel: shape.gradeLevel,
			programType: shape.programType,
			classRows: (shape.canonicalSlots ?? []).filter((slot) => slot.rowKind === 'CLASS').map((slot) => `${slot.startTime}-${slot.endTime}`),
			displayRows: shape.displaySlots.map((slot) => `${slot.startTime}-${slot.endTime}${slot.isSpecialEvent ? ':event' : ''}`),
		})),
		validatorPolicy: {
			periodLengthMinutes: assembly.policy.periodLengthMinutes,
			periodsPerDay: assembly.policy.periodsPerDay,
			maxTeachingMinutesPerDay: (assembly.policyRow as any)?.maxTeachingMinutesPerDay ?? null,
			enforceConsecutiveBreakAsHard: (assembly.policyRow as any)?.enforceConsecutiveBreakAsHard ?? null,
		},
	};
}

export { countByCode };
