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
 */

import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
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

	// ─── 1. Preflight (read-only): live run context + live reference databases ───
	const refData = await loadRunContext(runId, schoolId, schoolYearId);
	const { run } = refData;
	if (isPublishedSummary(run.summary)) {
		throw err(409, 'RUN_ALREADY_PUBLISHED', 'This schedule is already published.');
	}

	const activeSubjects = await prisma.subject.findMany({
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

	const sectionSummary = await getSectionSummary(schoolYearId, schoolId);
	const activeSections = sectionSummary.sections;
	const sectionsByGrade = sectionSummary.gradeLevels;
	const activeSectionIds = new Set(activeSections.map((s) => s.id));

	const liveSectionEnrollment = new Map<number, number>();
	for (const s of activeSections) {
		liveSectionEnrollment.set(s.id, s.enrolledCount);
	}
	refData.sectionEnrollment = liveSectionEnrollment;

	const ownerships = await prisma.subjectSectionOwnership.findMany({
		where: { schoolId, schoolYearId },
	});
	const ownershipMap = new Map<string, number | null>();
	for (const o of ownerships) {
		ownershipMap.set(`${o.subjectId}:${o.sectionId}`, o.facultyId);
	}

	// ─── 2. Canonical derived demand (exact per-term authority) ───
	const derivedDemand = await buildDerivedDemand(schoolId, schoolYearId);
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

	const remaining = new Map<string, number>();
	for (const [key, line] of demandByKey) remaining.set(key, line.item.sessionsPerWeek);
	const keptCounts = new Map<string, number>();

	const newEntries: ResolvedRetainedEntry[] = [];
	let updatedFacultyCount = 0;
	let displacedEntriesCount = 0;

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
		if (entry.facultyId !== liveFacultyId) updatedFacultyCount++;

		newEntries.push({ ...entry, facultyId: liveFacultyId });
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
	const facultySubjectRows = await prisma.facultySubject.findMany({
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

	const qualifiedFacultyCoverageBySubject = buildQualifiedCoverageBySubject(demand, normalizedFacultySubjects);
	const slotSaturationByInterval = buildSlotSaturation(newEntries as unknown as ScheduledEntry[], refData.rooms.length);
	const unassignedBySubjectGrade = buildUnassignedBySubjectGrade(newUnassignedItems as unknown as UnassignedItem[], activeSubjectCodeById);
	const homeRoomStats = buildHomeRoomStats(newEntries as unknown as ScheduledEntry[], newUnassignedItems as unknown as UnassignedItem[]);
	const homeRoomFallbackDiagnostics = buildHomeRoomFallbackDiagnostics(newEntries as unknown as ScheduledEntry[], newUnassignedItems as unknown as UnassignedItem[]);

	// ─── 7. Transaction: re-validate authority + version, CAS, audit ───
	const persist = async (tx: Prisma.TransactionClient): Promise<SyncTimetableSetupResult> => {
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
		if (txDerivedDemand.revision !== derivedDemand.revision) {
			throw err(
				409,
				'SOURCE_AUTHORITY_STALE',
				'The schedule setup authority changed while setup sync was being prepared. Reload the run and sync again.',
			);
		}

		const txInputSnapshot: GenerationInputSnapshot = await computeGenerationInputSnapshot(schoolId, schoolYearId, tx);
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
			displacedEntriesCount,
			addedUnassignedCount,
			hardViolationCount,
			softViolationCount,
			summary: updatedSummary,
		};
	};

	for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt += 1) {
		try {
			return await prisma.$transaction(persist, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
