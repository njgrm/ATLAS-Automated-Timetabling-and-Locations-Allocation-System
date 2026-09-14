/**
 * TT-SYNC-TERM-C03R4 — Per-term canonical setup synchronization.
 *
 * The mounted "Sync timetable setup" workflow previously matched retained
 * scheduled entries against demand using subject + section only, compared the
 * collapsed total of matching entries across every term with one term-agnostic
 * `sessionsPerWeek`, and rebuilt unassigned items without a term identity. A
 * complete Term 1 schedule could therefore falsely satisfy missing Term 2/Term 3
 * demand, and a wrong-term retained entry could suppress the correct term's
 * unresolved item.
 *
 * This service now reconciles against the SAME canonical per-term truth used by
 * generation, readiness, repair, selected-term views, and official outputs:
 *
 *   - demand comes from `buildDerivedDemand` -> `toPerPairDemandItems`, one
 *     `(subjectId, sectionId, termIndex)` line per applicable ordered term;
 *   - retained compact entries are expanded only through the canonical resolver
 *     `resolvePerTermScheduleEntries` (year-long lanes expand to every ordered
 *     term; rotating lanes use their `metadata.modularAssignments` term);
 *   - a present but invalid/out-of-contract term identity fails closed with a
 *     typed 409 and zero writes; it is never coerced to Term 1;
 *   - every persisted entry carries an explicit positive integer `termIndex` and
 *     a unique `entryId` with `sourceEntryId` retained, so a secondary sync is
 *     byte-stable;
 *   - every rebuilt unassigned item carries one explicit positive `termIndex`;
 *   - assigned + unassigned per-term sessions are asserted equal to canonical
 *     derived-demand per-term sessions before any write.
 *
 * Concurrency/authority: the write transaction re-reads the run, re-validates
 * its school/year/publication state and version, re-derives the canonical demand
 * revision through the transaction client (a changed source revision fails
 * closed with `SOURCE_AUTHORITY_STALE`), and performs a version-aware CAS on the
 * final write. An identical retry against already-synchronized state returns an
 * explicit replay result with zero writes.
 *
 * SOURCE-FRESHNESS BINDING: all computation reads run in ONE Serializable read
 * transaction and capture a complete `GenerationInputSnapshot` fingerprint. The
 * write transaction recomputes that snapshot through its own client and compares
 * the complete fingerprint; ANY covered input change (rooms/buildings,
 * grade-shift windows, scheduling policy, subjects, class templates, sections,
 * faculty mirrors, FacultySubject qualification/scope, or derived demand) aborts
 * with typed `SOURCE_AUTHORITY_STALE` and zero writes instead of attaching a
 * newer snapshot to output computed from older data.
 */

import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { withDataContext } from '../lib/data-context.js';
import { canonicalStringify } from '../lib/canonical-json.js';
import { loadRunContext, isPublishedSummary } from './manual-edit.service.js';
import { validateHardConstraints } from './constraint-validator.js';
import { type DemandItem, type UnassignedItem } from './schedule-constructor.js';
import { buildDerivedDemand, toPerPairDemandItems } from './derived-demand.service.js';
import { computeGenerationInputSnapshot, type GenerationInputSnapshot } from './generation-input-snapshot.service.js';
import { getSectionSummary } from './section.service.js';
import {
	PerTermResolutionError,
	resolvePerTermScheduleEntries,
	assertResolvedPerTermParity,
	type CanonicalTermSessionLine,
	type OrderedTermRef,
	type ResolvedPerTermEntry,
} from './per-term-schedule-resolution.service.js';
import { buildSectionRosterIndex, normalizeStoredAssignmentScope } from './faculty-assignment-scope.service.js';
import type { ScheduledEntry } from './constraint-validator.js';

const MAX_SERIALIZABLE_ATTEMPTS = 3;

interface ServiceError extends Error {
	statusCode: number;
	code: string;
	actionHint?: string;
}

function err(statusCode: number, code: string, message: string, actionHint?: string): ServiceError {
	const e = new Error(message) as ServiceError;
	e.statusCode = statusCode;
	e.code = code;
	if (actionHint) e.actionHint = actionHint;
	return e;
}

function isSerializationConflict(error: unknown): boolean {
	const failure = error as { code?: string; meta?: { code?: string } } | null;
	return failure?.code === 'P2034' || failure?.meta?.code === '40001';
}

type RetainedEntry = ScheduledEntry & { sourceEntryId?: string; fromRotatingFamily?: boolean };

type ResolvedRetainedEntry = ResolvedPerTermEntry & { sourceEntryId: string };

type ResolvedUnassignedItem = Omit<UnassignedItem, 'termIndex'> & { termIndex: number };

export interface SyncTimetableSetupResult {
	runId: number;
	version: number;
	replayed: boolean;
	noChange: boolean;
	updatedFacultyCount: number;
	/**
	 * D5/B-13: exact totals for retained, manually reviewed teacher assignments
	 * the sync preserved because they remain valid, and assignments that are no
	 * longer valid and require operator review. A conflicted pin aborts the sync
	 * with typed `TEACHER_PIN_CONFLICT`; a committed result therefore always has
	 * `conflictedFacultyPinCount === 0`.
	 */
	retainedFacultyPinCount: number;
	conflictedFacultyPinCount: number;
	displacedEntriesCount: number;
	addedUnassignedCount: number;
	hardViolationCount: number;
	softViolationCount: number;
	summary: unknown;
}

function canonicalEquals(left: unknown, right: unknown): boolean {
	return canonicalStringify(left ?? null) === canonicalStringify(right ?? null);
}

/**
 * Single source of truth for "the persisted synchronization output is bound to
 * the exact source snapshot that produced it".
 *
 * The read snapshot computes the output and captures its complete
 * `GenerationInputSnapshot` fingerprint. The write transaction recomputes the
 * snapshot through its own client; only complete fingerprint equality proves
 * that every covered input is unchanged between computation and persistence.
 *
 * This is extracted as a small named, exported pure predicate so the R5
 * interleave controls can demonstrate the mutant explicitly: a predicate that
 * always returns `true` (equivalent to deleting the comparison) accepts a
 * changed-domain snapshot pair and would let the write commit, while this real
 * predicate rejects it. The production service uses this exact predicate, so
 * the mutant control exercises the same comparison the service relies on.
 */
export function isInputSnapshotBound(
	readSnapshot: Pick<GenerationInputSnapshot, 'fingerprint'>,
	writeSnapshot: Pick<GenerationInputSnapshot, 'fingerprint'>,
): boolean {
	return readSnapshot.fingerprint === writeSnapshot.fingerprint;
}

/** Order-independent signature of the Teaching Load ownership authority. */
function ownershipSignature(map: ReadonlyMap<string, number | null>): string {
	return canonicalStringify(
		[...map.entries()]
			.map(([key, value]) => [key, value])
			.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
	);
}

/**
 * Volatile-free summary signature. `inputSnapshot.computedAt` changes on every
 * call, so replay detection compares the recomputed counters/diagnostics and the
 * per-domain fingerprints instead of the whole snapshot object.
 */
function summaryReplaySignature(summary: unknown): string {
	const source = summary && typeof summary === 'object' && !Array.isArray(summary)
		? (summary as Record<string, unknown>)
		: {};
	const snapshot = source.inputSnapshot && typeof source.inputSnapshot === 'object'
		? (source.inputSnapshot as Record<string, unknown>)
		: null;
	const domains = snapshot?.domains && typeof snapshot.domains === 'object'
		? (snapshot.domains as Record<string, unknown>)
		: null;
	const domainFingerprints = domains
		? Object.fromEntries(
			Object.entries(domains)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([domain, value]) => {
					const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
					return [domain, record?.fingerprint ?? null];
				}),
		)
		: null;
	return canonicalStringify({
		classesProcessed: source.classesProcessed ?? null,
		assignedCount: source.assignedCount ?? null,
		unassignedCount: source.unassignedCount ?? null,
		hardViolationCount: source.hardViolationCount ?? null,
		softViolationCount: source.softViolationCount ?? null,
		homeRoomAttemptedCount: source.homeRoomAttemptedCount ?? null,
		homeRoomAssignedCount: source.homeRoomAssignedCount ?? null,
		homeRoomSuccessRate: source.homeRoomSuccessRate ?? null,
		resourceDiagnostics: source.resourceDiagnostics ?? null,
		inputSnapshotSchemaVersion: snapshot?.schemaVersion ?? null,
		inputSnapshotDomains: domainFingerprints,
	});
}

/**
 * Expand retained compact entries only through the canonical resolver, with two
 * fail-closed guards the resolver alone cannot express:
 *   - a PRESENT but invalid/out-of-contract term identity is rejected (never
 *     reinterpreted as a year-long entry);
 *   - an existing `sourceEntryId` is preserved so repeated syncs are stable.
 */
function resolveRetainedEntries(
	baseEntries: readonly RetainedEntry[],
	termRefs: readonly OrderedTermRef[],
	subjectIdByCode: ReadonlyMap<string, number>,
): ResolvedRetainedEntry[] {
	const validOrders = new Set(termRefs.map((term) => term.order));

	for (const entry of baseEntries) {
		const rawTerm = (entry as { termIndex?: unknown }).termIndex;
		if (rawTerm !== undefined && rawTerm !== null) {
			if (typeof rawTerm !== 'number' || !Number.isInteger(rawTerm) || !validOrders.has(rawTerm)) {
				throw err(
					409,
					'INVALID_TERM_IDENTITY',
					`Retained entry ${entry.entryId} carries an out-of-contract term identity (${String(rawTerm)}). Resolve the verified ordered-term contract before syncing; ATLAS will not coerce it to Term 1.`,
				);
			}
		}
		const modular = entry.metadata?.modularAssignments;
		if (Array.isArray(modular)) {
			for (const assignment of modular) {
				const assignmentTerm = (assignment as { termIndex?: unknown } | null)?.termIndex;
				if (typeof assignmentTerm !== 'number' || !Number.isInteger(assignmentTerm) || !validOrders.has(assignmentTerm)) {
					throw err(
						409,
						'INVALID_TERM_IDENTITY',
						`Retained entry ${entry.entryId} has a rotating-family assignment outside the verified ordered-term contract.`,
					);
				}
			}
		}
	}

	const resolved: ResolvedRetainedEntry[] = [];
	for (const entry of baseEntries) {
		let expanded: ResolvedPerTermEntry[];
		try {
			expanded = resolvePerTermScheduleEntries([entry], termRefs, { subjectIdByCode });
		} catch (error) {
			if (error instanceof PerTermResolutionError) {
				throw err(409, 'INVALID_TERM_IDENTITY', error.message);
			}
			throw error;
		}
		for (const entryResolved of expanded) {
			resolved.push({
				...entryResolved,
				sourceEntryId: entry.sourceEntryId ?? entry.entryId,
				fromRotatingFamily: entryResolved.fromRotatingFamily || entry.fromRotatingFamily === true,
			});
		}
	}
	return resolved;
}

export async function syncTimetableSetup(
	schoolId: number,
	schoolYearId: number,
	runId: number,
	actorId: number,
	expectedRunVersion: number,
): Promise<SyncTimetableSetupResult> {
	if (!Number.isInteger(expectedRunVersion) || expectedRunVersion < 1) {
		throw err(400, 'INVALID_PARAM', 'expectedRunVersion must be a positive integer.');
	}

	// ─── 1-6. Transaction-bound read snapshot ─────────────────────────────────
	//
	// Every input that produces the synchronized entries, unassigned items,
	// violations, and resource diagnostics is read through ONE Serializable
	// read transaction on the singleton client, so the computed result is
	// derived from a single consistent source state. `withDataContext(readTx)`
	// also routes the `db()`-based helpers used here (`getOrCreatePolicy`,
	// `resolveRuntimeContext`) through the same snapshot instead of the global
	// singleton.
	//
	// The complete `GenerationInputSnapshot` fingerprint captured here is
	// compared against a transaction-bound recomputation inside the write
	// transaction below. A change to any covered domain (rooms/buildings,
	// grade-shift windows, scheduling policy, subjects, class templates,
	// sections, faculty mirrors, FacultySubject qualification/scope, or
	// Teaching Load ownership) fails closed with SOURCE_AUTHORITY_STALE and
	// zero writes.
	//
	// `getSectionSummary` is called with `allowExternalSync: false`: the sync
	// computation path must never perform `syncSectionsFromExternal` (an
	// external call plus mirror writes) inside a read snapshot. An empty
	// section mirror therefore fails closed before any write; the operator must
	// run the explicit section/rollover sync first.
	async function computeFromSnapshot(readTx: Prisma.TransactionClient) {
	const refData = await loadRunContext(runId, schoolId, schoolYearId, readTx);
	const { run } = refData;
	if (isPublishedSummary(run.summary)) {
		throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published.');
	}

	const activeSubjects = await readTx.subject.findMany({
		where: { schoolId, isActive: true },
		select: {
			id: true,
			code: true,
			name: true,
			ownerDepartment: true,
			qualificationPriority: true,
			minMinutesPerWeek: true,
			preferredRoomType: true,
			gradeLevels: true,
			interSectionEnabled: true,
			interSectionGradeLevels: true,
			programScopes: true,
			allowedSpecializations: true,
			requiredFeatures: true,
			modularGroupId: true,
			modularOrder: true,
		},
	});
	const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
	const activeSubjectCodeById = new Map(activeSubjects.map((s) => [s.id, s.code]));
	const subjectIdByCode = new Map(activeSubjects.map((s) => [s.code, s.id]));

	const sectionSummary = await getSectionSummary(schoolYearId, schoolId, undefined, {
		client: readTx,
		allowExternalSync: false,
		verifyRuntimeUpstream: false,
	});
	const activeSections = sectionSummary.sections;
	if (activeSections.length === 0) {
		throw err(
			409,
			'DERIVED_DEMAND_BLOCKED',
			'No active section mirror exists for this school year. Run the explicit section/rollover sync before syncing timetable setup; ATLAS will not auto-sync sections inside the read snapshot.',
		);
	}
	const sectionsByGrade = sectionSummary.gradeLevels;
	const activeSectionIds = new Set(activeSections.map((s) => s.id));

	const liveSectionEnrollment = new Map<number, number>();
	for (const s of activeSections) {
		liveSectionEnrollment.set(s.id, s.enrolledCount);
	}
	refData.sectionEnrollment = liveSectionEnrollment;

	const ownerships = await readTx.subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId },
	});
	const ownershipMap = new Map<string, number | null>();
	for (const o of ownerships) {
		ownershipMap.set(`${o.subjectId}:${o.sectionId}`, o.facultyId);
	}
	const preflightOwnershipSignature = ownershipSignature(ownershipMap);

	// ─── 2. Canonical derived demand (exact per-term authority) ───
	const derivedDemand = await buildDerivedDemand(schoolId, schoolYearId, { client: readTx as never });
	if (!derivedDemand.ok) {
		throw err(
			409,
			'DERIVED_DEMAND_BLOCKED',
			'The canonical derived demand could not be resolved for this school year. Resolve the ordered term contract and Subject rotation metadata before syncing.',
		);
	}
	const termRefs: OrderedTermRef[] = derivedDemand.termStructure.terms.map((term) => ({
		identity: term.identity,
		order: term.order,
		displayLabel: term.displayLabel,
	}));
	const termIndexByIdentity = new Map(termRefs.map((term) => [term.identity, term.order]));

	const demand = toPerPairDemandItems(
		derivedDemand,
		sectionsByGrade,
		activeSubjects as unknown as Parameters<typeof toPerPairDemandItems>[2],
	);

	const demandByKey = new Map<string, { item: DemandItem; termIndex: number }>();
	const canonicalLines: CanonicalTermSessionLine[] = [];
	for (const item of demand) {
		const applicableTerms = item.applicableTermIdentities ?? [];
		if (applicableTerms.length === 0) {
			throw err(
				409,
				'INVALID_TERM_IDENTITY',
				`Canonical derived demand for subject ${item.subjectId} section ${item.sectionId} carries no ordered term identity.`,
			);
		}
		for (const identity of applicableTerms) {
			const termIndex = termIndexByIdentity.get(identity);
			if (termIndex == null) {
				throw err(
					409,
					'INVALID_TERM_IDENTITY',
					`Canonical derived demand references term identity ${identity}, which is outside the verified ordered-term contract.`,
				);
			}
			const key = `${item.subjectId}:${item.sectionId}:${termIndex}`;
			if (demandByKey.has(key)) {
				throw err(409, 'INVALID_TERM_IDENTITY', `Canonical derived demand emitted a duplicate per-term line ${key}.`);
			}
			demandByKey.set(key, { item, termIndex });
			canonicalLines.push({
				subjectId: item.subjectId,
				sectionId: item.sectionId,
				termIndex,
				sessionsPerWeek: item.sessionsPerWeek,
			});
		}
	}

	// ─── 3. Reconcile retained entries against exact per-term demand ───
	const baseEntries = (run.draftEntries ?? []) as unknown as RetainedEntry[];
	const resolvedEntries = resolveRetainedEntries(baseEntries, termRefs, subjectIdByCode);

	// D5/B-13: teacher-pin validity is decided from the same read snapshot. A
	// retained entry facultyId is a manually reviewed pin: it is preserved while
	// it remains a valid active/qualified assignment for the retained
	// subject/section, and is reported as a typed conflict when it is not. It is
	// never silently rebound to the live ownership row.
	const facultySubjectRows = await readTx.facultySubject.findMany({
		where: { schoolId, schoolYearId },
		select: { facultyId: true, subjectId: true, gradeLevels: true, sectionIds: true },
	});
	const activeFacultyIdSet = new Set(refData.faculty.map((member) => member.id));
	const rosterIndex = buildSectionRosterIndex(sectionsByGrade);
	const normalizedFacultySubjects = facultySubjectRows
		.filter((assignment) => activeFacultyIdSet.has(assignment.facultyId))
		.map((assignment) => {
			const normalized = normalizeStoredAssignmentScope(assignment, rosterIndex);
			return {
				facultyId: assignment.facultyId,
				subjectId: assignment.subjectId,
				gradeLevels: normalized.gradeLevels,
				sectionIds: normalized.sectionIds,
			};
		});
	const isPinnedFacultyValid = (facultyId: number, subjectId: number, sectionId: number): boolean => {
		if (!activeFacultyIdSet.has(facultyId)) return false;
		return normalizedFacultySubjects.some((assignment) => {
			if (assignment.facultyId !== facultyId || assignment.subjectId !== subjectId) return false;
			const scoped = Array.isArray(assignment.sectionIds) && assignment.sectionIds.length > 0;
			if (scoped && !(assignment.sectionIds as number[]).includes(sectionId)) return false;
			return true;
		});
	};

	const remaining = new Map<string, number>();
	for (const [key, line] of demandByKey) remaining.set(key, line.item.sessionsPerWeek);
	const keptCounts = new Map<string, number>();

	const newEntries: ResolvedRetainedEntry[] = [];
	let updatedFacultyCount = 0;
	let displacedEntriesCount = 0;
	let retainedFacultyPinCount = 0;
	const facultyPinConflicts: Array<{
		entryId: string;
		subjectId: number;
		sectionId: number;
		termIndex: number;
		pinnedFacultyId: number;
		liveFacultyId: number | null;
	}> = [];

	for (const entry of resolvedEntries) {
		const subjectActive = activeSubjectIds.has(entry.subjectId);
		if (entry.entryKind === 'COHORT') {
			// `toPerPairDemandItems` never emits COHORT demand items on the
			// canonical path, so a protected cohort placement cannot be
			// represented as canonical per-term demand. Fail closed unless its
			// subject/member sections are inactive (then it is displaced).
			const memberSections = entry.cohortMemberSectionIds?.length ? entry.cohortMemberSectionIds : [entry.sectionId];
			const memberSectionsActive = memberSections.every((sectionId) => activeSectionIds.has(sectionId));
			if (!subjectActive || !memberSectionsActive) {
				displacedEntriesCount++;
				continue;
			}
			throw err(
				409,
				'COHORT_DEMAND_UNSUPPORTED',
				`Retained cohort entry ${entry.entryId} has no canonical per-term demand representation. Resolve cohort scheduling before syncing; ATLAS will not drop an active cohort placement silently.`,
			);
		}

		if (!subjectActive || !activeSectionIds.has(entry.sectionId)) {
			displacedEntriesCount++;
			continue;
		}

		const termIndex = entry.termIndex;
		const key = `${entry.subjectId}:${entry.sectionId}:${termIndex}`;
		const left = remaining.get(key);
		if (left === undefined || left <= 0) {
			// Not canonical demand for this exact term, or beyond the canonical
			// weekly session count. It must not suppress the correct term's item.
			displacedEntriesCount++;
			continue;
		}
		remaining.set(key, left - 1);
		keptCounts.set(key, (keptCounts.get(key) ?? 0) + 1);

		const ownershipKey = `${entry.subjectId}:${entry.sectionId}`;
		const liveFacultyId = ownershipMap.has(ownershipKey) ? ownershipMap.get(ownershipKey) ?? null : null;
		const pinnedFacultyId = entry.facultyId ?? null;
		let resolvedFacultyId: number | null;
		if (pinnedFacultyId === null) {
			// No manual pin: adopt the live owner (existing behavior).
			resolvedFacultyId = liveFacultyId;
			if (liveFacultyId !== null) updatedFacultyCount++;
		} else if (pinnedFacultyId === liveFacultyId) {
			resolvedFacultyId = pinnedFacultyId;
		} else if (isPinnedFacultyValid(pinnedFacultyId, entry.subjectId, entry.sectionId)) {
			// Preserve the reviewed assignment; keep valid swaps/manual placements.
			resolvedFacultyId = pinnedFacultyId;
			retainedFacultyPinCount++;
		} else {
			// Never silently rebind. Report and fail closed.
			facultyPinConflicts.push({
				entryId: entry.entryId,
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				termIndex,
				pinnedFacultyId,
				liveFacultyId,
			});
			resolvedFacultyId = pinnedFacultyId;
		}

		newEntries.push({ ...entry, facultyId: resolvedFacultyId });
	}

	if (facultyPinConflicts.length > 0) {
		const conflict = err(
			409,
			'TEACHER_PIN_CONFLICT',
			`${facultyPinConflicts.length} reviewed teacher assignment(s) are no longer valid under current ownership, qualification, section, and term authority; ${retainedFacultyPinCount} valid reviewed assignment(s) will be retained. ATLAS will not silently rebind them; review them before syncing.`,
		);
		(conflict as any).actionHint = 'Review the conflicted assignments in Teaching Load, then sync again.';
		(conflict as any).details = {
			retainedFacultyPinCount,
			conflictedFacultyPinCount: facultyPinConflicts.length,
			conflicts: facultyPinConflicts,
		};
		throw conflict;
	}

	// ─── 4. Rebuild term-scoped unresolved items for every missing session ───
	const newUnassignedItems: ResolvedUnassignedItem[] = [];
	let addedUnassignedCount = 0;
	for (const [key, line] of demandByKey) {
		const item = line.item;
		const resolvedCount = keptCounts.get(key) ?? 0;
		const sessionsNeeded = item.sessionsPerWeek;
		if (resolvedCount >= sessionsNeeded) continue;

		const ownershipKey = `${item.subjectId}:${item.sectionId}`;
		const liveFacultyId = ownershipMap.has(ownershipKey) ? ownershipMap.get(ownershipKey) ?? null : null;

		for (let session = resolvedCount + 1; session <= sessionsNeeded; session++) {
			let reason: UnassignedItem['reason'] = 'NO_AVAILABLE_SLOT';
			if (!liveFacultyId) {
				reason = 'NO_QUALIFIED_FACULTY';
			}
			addedUnassignedCount++;
			newUnassignedItems.push({
				sectionId: item.sectionId,
				subjectId: item.subjectId,
				gradeLevel: item.gradeLevel,
				session,
				reason,
				roomAssignmentReason: 'FALLBACK_UNRESOLVED',
				facultyId: liveFacultyId,
				entryKind: item.entryKind,
				programType: item.programType ?? null,
				programCode: item.programCode ?? null,
				programName: item.programName ?? null,
				cohortCode: item.cohortCode ?? null,
				cohortName: item.cohortName ?? null,
				cohortMemberSectionIds: item.cohortMemberSectionIds,
				cohortExpectedEnrollment: item.entryKind === 'COHORT' ? item.enrolledCount : null,
				adviserId: item.adviserId ?? null,
				adviserName: item.adviserName ?? null,
				homeRoomId: item.homeRoomId ?? null,
				termIndex: line.termIndex,
			});
		}
	}

	// ─── 5. Conservation invariant: assigned + unassigned == canonical demand ───
	const classesProcessed = canonicalLines.reduce((sum, line) => sum + line.sessionsPerWeek, 0);
	const assignedCount = newEntries.length;
	const unassignedCount = newUnassignedItems.length;
	if (assignedCount + unassignedCount !== classesProcessed) {
		throw err(
			409,
			'PER_TERM_CONSERVATION_VIOLATION',
			`Per-term conservation failed: ${assignedCount} assigned + ${unassignedCount} unassigned != ${classesProcessed} canonical sessions.`,
		);
	}
	assertResolvedPerTermParity(
		[
			...newEntries.map((entry) => ({
				subjectId: entry.subjectId,
				sectionId: entry.sectionId,
				termIndex: entry.termIndex,
				sourceEntryId: entry.sourceEntryId,
			})),
			...newUnassignedItems.map((item) => ({
				subjectId: item.subjectId,
				sectionId: item.sectionId,
				termIndex: item.termIndex,
				sourceEntryId: `unassigned:${item.subjectId}:${item.sectionId}:${item.termIndex}:${item.session}`,
			})),
		],
		canonicalLines,
	);

	// ─── 6. Recompute constraint validation + resource diagnostics ───
	refData.subjects = activeSubjects as any;
	const { buildValidatorCtx } = await import('./manual-edit.service.js');
	const validatorCtx = buildValidatorCtx(
		schoolId,
		schoolYearId,
		runId,
		newEntries as unknown as ScheduledEntry[],
		refData,
	);
	const validationResult = validateHardConstraints(validatorCtx);
	const violations = validationResult.violations;
	const hardViolationCount = violations.filter((v) => v.severity === 'HARD').length;
	const softViolationCount = violations.filter((v) => v.severity === 'SOFT').length;

	const {
		buildQualifiedCoverageBySubject,
		buildSlotSaturation,
		buildUnassignedBySubjectGrade,
		buildHomeRoomStats,
		buildHomeRoomFallbackDiagnostics,
	} = await import('./generation.service.js');

	const qualifiedFacultyCoverageBySubject = buildQualifiedCoverageBySubject(demand, normalizedFacultySubjects);
	const slotSaturationByInterval = buildSlotSaturation(newEntries as unknown as ScheduledEntry[], refData.rooms.length);
	const unassignedBySubjectGrade = buildUnassignedBySubjectGrade(newUnassignedItems as unknown as UnassignedItem[], activeSubjectCodeById);
	const homeRoomStats = buildHomeRoomStats(newEntries as unknown as ScheduledEntry[], newUnassignedItems as unknown as UnassignedItem[]);
	const homeRoomFallbackDiagnostics = buildHomeRoomFallbackDiagnostics(newEntries as unknown as ScheduledEntry[], newUnassignedItems as unknown as UnassignedItem[]);

	// Capture the complete input fingerprint from the SAME read snapshot that
	// produced the output above. `computedAt` is excluded from `fingerprint`, so
	// the write transaction can compare this deterministically.
	const readInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, readTx);

	return {
		newEntries,
		newUnassignedItems,
		violations,
		classesProcessed,
		assignedCount,
		unassignedCount,
		hardViolationCount,
		softViolationCount,
		homeRoomStats,
		qualifiedFacultyCoverageBySubject,
		slotSaturationByInterval,
		unassignedBySubjectGrade,
		homeRoomFallbackDiagnostics,
		termRefs,
		derivedDemandRevision: derivedDemand.revision,
		preflightOwnershipSignature,
		updatedFacultyCount,
		retainedFacultyPinCount,
		displacedEntriesCount,
		addedUnassignedCount,
		readInputSnapshot,
	};
	}

	// The read snapshot may be aborted by Serializable SSI after a concurrent
	// write to the same input rows. The computation is read-only and idempotent,
	// so it is retried with the same bounded budget as the write transaction and
	// fails closed with a typed conflict when it cannot be established. The
	// generous timeout accommodates the larger reference read set without holding
	// the snapshot across external I/O (upstream verification is disabled above).
	const computation = await (async () => {
		for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
			try {
				return await prisma.$transaction(
					async (readTx) => withDataContext(readTx, () => computeFromSnapshot(readTx)),
					{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000, maxWait: 10_000 },
				);
			} catch (error) {
				if (isSerializationConflict(error) && attempt < MAX_SERIALIZABLE_ATTEMPTS) continue;
				if (isSerializationConflict(error)) {
					throw err(
						409,
						'SYNC_TRANSACTION_CONFLICT',
						'Setup sync conflicted with another schedule change. Reload the run and sync again.',
					);
				}
				throw error;
			}
		}
		throw err(409, 'SYNC_TRANSACTION_CONFLICT', 'Setup sync could not complete. Reload the run and sync again.');
	})();

	// ─── 7. Transaction: re-validate authority + version, CAS, audit ───
	const persist = async (tx: Prisma.TransactionClient): Promise<SyncTimetableSetupResult> => {
		const {
			newEntries,
			newUnassignedItems,
			violations,
			classesProcessed,
			assignedCount,
			unassignedCount,
			hardViolationCount,
			softViolationCount,
			homeRoomStats,
			qualifiedFacultyCoverageBySubject,
			slotSaturationByInterval,
			unassignedBySubjectGrade,
			homeRoomFallbackDiagnostics,
			termRefs,
			derivedDemandRevision,
			preflightOwnershipSignature,
			updatedFacultyCount,
			retainedFacultyPinCount,
			displacedEntriesCount,
			addedUnassignedCount,
			readInputSnapshot,
		} = computation;

		const persisted = await tx.generationRun.findFirst({
			where: { id: runId, schoolId, schoolYearId },
			select: {
				id: true,
				version: true,
				status: true,
				summary: true,
				draftEntries: true,
				unassignedItems: true,
				violations: true,
			},
		});
		if (!persisted) throw err(404, 'RUN_NOT_FOUND', 'Generation run not found in this school/year scope.');
		if (persisted.status !== 'COMPLETED') throw err(400, 'RUN_NOT_COMPLETED', 'Setup sync can only be applied to COMPLETED runs.');
		if (isPublishedSummary(persisted.summary)) {
			throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published.');
		}
		if (persisted.version !== expectedRunVersion) {
			throw err(
				409,
				'RUN_VERSION_STALE',
				'This timetable changed while setup sync was being prepared. Reload the run and sync again.',
			);
		}

		// Revalidate the canonical source revision through the transaction client.
		// A changed term contract, section set, Subject semantics, or period length
		// makes the preflight decision stale; fail closed with zero writes.
		const txDerivedDemand = await buildDerivedDemand(schoolId, schoolYearId, { client: tx as never });
		if (!txDerivedDemand.ok) {
			throw err(
				409,
				'DERIVED_DEMAND_BLOCKED',
				'The canonical derived demand could not be re-resolved inside the sync transaction.',
			);
		}
		if (txDerivedDemand.revision !== derivedDemandRevision) {
			throw err(
				409,
				'SOURCE_AUTHORITY_STALE',
				'The schedule setup authority changed while setup sync was being prepared. Reload the run and sync again.',
			);
		}

		// The computed result also binds Teaching Load ownership (faculty
		// authority), which is not part of the derived-demand revision. Re-read
		// it through the transaction client and fail closed on drift.
		const txOwnerships = await tx.subjectSectionOwnership.findMany({
			where: { schoolId, schoolYearId },
			select: { subjectId: true, sectionId: true, facultyId: true },
		});
		const txOwnershipMap = new Map<string, number | null>();
		for (const ownership of txOwnerships) {
			txOwnershipMap.set(`${ownership.subjectId}:${ownership.sectionId}`, ownership.facultyId);
		}
		if (ownershipSignature(txOwnershipMap) !== preflightOwnershipSignature) {
			throw err(
				409,
				'SOURCE_AUTHORITY_STALE',
				'Teaching Load ownership changed while setup sync was being prepared. Reload the run and sync again.',
			);
		}

		const txInputSnapshot: GenerationInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, tx);
		// Bind the persisted output to the same source snapshot that produced it:
		// if ANY covered input changed between the read snapshot and this write
		// transaction, the transaction snapshot no longer matches, so the write
		// aborts with zero residue. This closes the launder gap where a newer
		// snapshot could be attached to output derived from older data (rooms,
		// buildings, grade-shift windows, scheduling policy, class templates,
		// faculty mirrors, FacultySubject qualification/scope, sections,
		// subjects, or derived demand).
		if (!isInputSnapshotBound(readInputSnapshot, txInputSnapshot)) {
			throw err(
				409,
				'SOURCE_AUTHORITY_STALE',
				'The timetable setup source changed while setup sync was being prepared. Reload the run and sync again.',
			);
		}
		const persistedSummary = (persisted.summary ?? {}) as Record<string, any>;
		const updatedSummary = {
			...persistedSummary,
			classesProcessed,
			assignedCount,
			unassignedCount,
			hardViolationCount,
			softViolationCount,
			homeRoomAttemptedCount: homeRoomStats.attempted,
			homeRoomAssignedCount: homeRoomStats.assigned,
			homeRoomSuccessRate: homeRoomStats.successRate,
			resourceDiagnostics: {
				...persistedSummary.resourceDiagnostics,
				qualifiedFacultyCoverageBySubject,
				slotSaturationByInterval,
				unassignedBySubjectGrade,
				homeRoomFallbackDiagnostics,
			},
			inputSnapshot: txInputSnapshot,
		};

		const noChange = canonicalEquals(newEntries, persisted.draftEntries ?? [])
			&& canonicalEquals(newUnassignedItems, persisted.unassignedItems ?? [])
			&& canonicalEquals(violations, persisted.violations ?? [])
			&& summaryReplaySignature(updatedSummary) === summaryReplaySignature(persistedSummary);

		if (noChange) {
			return {
				runId: persisted.id,
				version: persisted.version,
				replayed: true,
				noChange: true,
				updatedFacultyCount: 0,
				retainedFacultyPinCount,
				conflictedFacultyPinCount: 0,
				displacedEntriesCount: 0,
				addedUnassignedCount: 0,
				hardViolationCount,
				softViolationCount,
				summary: persisted.summary,
			};
		}

		const nextVersion = persisted.version + 1;
		const updated = await tx.generationRun.updateMany({
			where: { id: runId, version: expectedRunVersion },
			data: {
				draftEntries: newEntries as unknown as object[],
				unassignedItems: newUnassignedItems as unknown as object[],
				violations: violations as unknown as object[],
				summary: updatedSummary as unknown as object,
				version: nextVersion,
			},
		});
		if (updated.count !== 1) {
			throw err(
				409,
				'RUN_VERSION_STALE',
				'This timetable changed while setup sync was being saved. Reload the run and sync again.',
			);
		}

		await tx.auditLog.create({
			data: {
				schoolId,
				schoolYearId,
				action: 'GENERATION_RUN_SYNCED_WITH_SETUP',
				actorId,
				targetIds: [runId],
				metadata: {
					runId,
					previousVersion: persisted.version,
					nextVersion,
					updatedFacultyCount,
					displacedEntriesCount,
					addedUnassignedCount,
					hardViolationCount,
					softViolationCount,
					termCount: termRefs.length,
					timestamp: new Date().toISOString(),
				} as unknown as object,
			},
		});

		return {
			runId,
			version: nextVersion,
			replayed: false,
			noChange: false,
			updatedFacultyCount,
			retainedFacultyPinCount,
			conflictedFacultyPinCount: 0,
			displacedEntriesCount,
			addedUnassignedCount,
			hardViolationCount,
			softViolationCount,
			summary: updatedSummary,
		};
	};

	for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
		try {
			// The write transaction now also recomputes the complete input
			// snapshot through its own client to bind output to source. Use the
			// same bounded budget as the read snapshot so a larger reference set
			// does not hit Prisma's short interactive default timeout and abort a
			// valid sync.
			return await prisma.$transaction(persist, {
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
				timeout: 30_000,
				maxWait: 10_000,
			});
		} catch (error) {
			if (isSerializationConflict(error) && attempt < MAX_SERIALIZABLE_ATTEMPTS) {
				continue;
			}
			if (isSerializationConflict(error)) {
				throw err(
					409,
					'SYNC_TRANSACTION_CONFLICT',
					'Setup sync conflicted with another schedule change. Reload the run and sync again.',
				);
			}
			throw error;
		}
	}
	throw err(409, 'SYNC_TRANSACTION_CONFLICT', 'Setup sync could not complete. Reload the run and sync again.');
}
