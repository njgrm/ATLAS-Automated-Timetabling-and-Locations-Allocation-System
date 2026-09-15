import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import atlasApi from '@/lib/api';
import {
	buildAssignmentSignature,
	buildMultiOwnerSavedMap,
	buildOwnershipMap,
	buildOwnershipMapFromIndex,
	buildPendingOwnershipMap,
	buildEffectiveOwnershipMap,
	buildSectionMap,
	normalizeDraftAssignments,
	type FacultyAssignmentDraft,
	type SubjectSectionOwnershipIndexEntry,
} from '@/lib/faculty-assignment-helpers';
import {
	resolveActiveSchoolYearContext,
	type ActiveSchoolYearContextSource,
	isUpstreamBackedSchoolYearSource,
} from '@/lib/enrollpro-public-settings';
import { resolveActorSchoolId } from '@/lib/settings';
import { teachingLoadScopeParams } from '@/lib/faculty-assignment-helpers';
import {
	getCachedFacultyAssignmentsSummary,
	getCachedSectionSummary,
	getCachedSubjects,
	normalizeFacultySummarySnapshot,
	requestWithRetry,
	setCachedFacultyAssignmentsSummary,
	setCachedSectionSummary,
	setCachedSubjects,
	type FacultySummarySnapshot,
	type EffectiveWorkloadPolicyState,
	type WorkloadPolicyReadiness,
} from '@/lib/faculty-teaching-load-cache';
import type { TeachingLoadAuthorityDiagnosticsPayload } from '@/lib/teaching-load-authority-truth';
import { createScopeEpoch, type ScopeEpoch } from '@/lib/scope-request-epoch';
import { useAssignmentHistory } from '@/hooks/useAssignmentHistory';
import type {
	ExternalSection,
	HomeroomHintResponse,
	SectionAssignedClassesIndexResult,
	SectionSummaryResponse,
	Subject,
	FacultyAssignmentRecord,
	FacultySummary,
	TeachingLoadCoverageTotals,
	TeachingLoadIntegrityDiagnostics,
} from '@/types';

/**
 * C-6: the single scope-binding authority shared by every authority feed that
 * `fetchData` writes (faculty, subjects, sections, assigned-classes, coverage,
 * policy, the page loading flag, and the C-5 diagnostics read).
 *
 * A binding is the resolved scope identity plus the epoch token captured at
 * dispatch. It is deliberately a plain value, so a reply's currency can be
 * checked without React effect ordering ever being load bearing.
 */
export type ScopeBoundWrite = {
	scopeRef: { current: string | null };
	epoch: ScopeEpoch;
	scopeId: string;
	token: number;
};

/** True while `binding` still belongs to the scope in force. */
export function isScopeCurrent(binding: ScopeBoundWrite): boolean {
	return binding.scopeRef.current === binding.scopeId && binding.epoch.isCurrent(binding.token);
}

/**
 * C-6: apply a sibling authority-feed write only when the dispatching scope is
 * still the one in force. Returns true when the write was applied; false means an
 * obsolete-scope reply was discarded and NOTHING was written.
 */
export function commitScopeBoundWrite(binding: ScopeBoundWrite, write: () => void): boolean {
	if (!isScopeCurrent(binding)) return false;
	write();
	return true;
}

/**
 * C-6R: monotonic dispatch precedence.
 *
 * `openDiagnosticsScope` compares scope-id strings only, so without a dispatch
 * order a late-resolving OLDER invocation could re-open the epoch for its own
 * scope and make the newer invocation's binding look stale (precedence
 * inversion). Every invocation takes a monotonic id at dispatch; only the newest
 * id may bind a scope, write an authority feed, or clear a loading flag.
 */
export type DispatchPrecedence = {
	readonly latest: number;
	/** Take the next dispatch id for a new invocation. */
	begin(): number;
	/** True while `dispatchId` is still the newest dispatch issued. */
	isLatest(dispatchId: number): boolean;
};

export function createDispatchPrecedence(initial = 0): DispatchPrecedence {
	let latest = initial;
	return {
		get latest() {
			return latest;
		},
		begin() {
			latest += 1;
			return latest;
		},
		isLatest(dispatchId: number) {
			return dispatchId === latest;
		},
	};
}

/**
 * C-6R: the per-invocation dispatch scope that `fetchData` actually uses.
 *
 * This is the production authority for both questions a fetch must answer:
 *   - `isLatestDispatch()` — am I still the newest invocation for this hook?
 *   - `canWrite()` — may I write? (newest invocation AND, once bound, my scope
 *     still in force. An UNBOUND invocation is no longer supersession-blind.)
 *
 * `bind()` is refused unless this is still the newest dispatch, so a
 * late-resolving older invocation can never re-open the epoch over a newer
 * binding (the precedence inversion).
 */
export type FetchDispatchScope = {
	readonly dispatchId: number;
	isLatestDispatch(): boolean;
	/** Bind the resolved scope. Refused for a superseded invocation. */
	bind(scopeId: string): boolean;
	/** True when this invocation may write anything at all. */
	canWrite(): boolean;
	readonly binding: ScopeBoundWrite | null;
};

export function createFetchDispatchScope(
	precedence: DispatchPrecedence,
	scopeRef: { current: string | null },
	epoch: ScopeEpoch,
): FetchDispatchScope {
	const dispatchId = precedence.begin();
	let binding: ScopeBoundWrite | null = null;
	const isLatestDispatch = () => precedence.isLatest(dispatchId);
	return {
		dispatchId,
		isLatestDispatch,
		bind(scopeId: string) {
			if (!isLatestDispatch()) return false;
			openDiagnosticsScope(scopeRef, epoch, scopeId);
			binding = { scopeRef, epoch, scopeId, token: epoch.current };
			return true;
		},
		canWrite() {
			return isLatestDispatch() && (binding == null || isScopeCurrent(binding));
		},
		get binding() {
			return binding;
		},
	};
}

/**
 * C-5 (F2-COLD-LOAD). Open a new diagnostics epoch when — and only when — the
 * RESOLVED scope actually changed.
 *
 * This is called synchronously by `fetchData` for the scope it just resolved,
 * immediately before the request token is captured. That ordering is load
 * bearing: a render-time effect that opened the epoch instead would run AFTER
 * the capture on a cold-cache first load and invalidate the very request that
 * resolved the scope, leaving the truth panel permanently "Checking source".
 *
 * Returns true when a new epoch was opened.
 */
export function openDiagnosticsScope(
	scopeRef: { current: string | null },
	epoch: ScopeEpoch,
	scopeId: string,
): boolean {
	if (scopeRef.current === scopeId) return false;
	scopeRef.current = scopeId;
	epoch.begin();
	return true;
}

export type AuthorityDiagnosticsSetPayload = (payload: TeachingLoadAuthorityDiagnosticsPayload | null) => void;
export type AuthorityDiagnosticsSetLoading = (loading: boolean) => void;

export type AuthorityDiagnosticsLoadOutcome = 'persisted' | 'cleared' | 'discarded';

/**
 * C-6R3: dispatch-scoped ownership of the authority-diagnostics loading flag.
 *
 * The loading flag is a resource with exactly one owner: the dispatch that set
 * it. A bare boolean cannot express that, which is how a superseded invocation
 * could set the flag and then be discarded WITHOUT ever clearing it. When the
 * newest dispatch aborted before it could reach the diagnostics read (an
 * unresolved actor school or active year), no dispatch owned the clear and the
 * R3 truth panel stayed on "Checking source" with every metric unknown.
 *
 * Ownership is claimed on entry and released on EVERY exit path, so a superseded
 * reply terminates its own in-flight read. A release that no longer owns the
 * claim is refused, so it can never clear a newer active dispatch's flag.
 */
export type DiagnosticsLoadingOwnership = {
	/** The dispatch id that currently owns the loading flag, or null. */
	readonly ownerId: number | null;
	/** Take ownership for `dispatchId`. The caller sets the loading flag true. */
	claim(dispatchId: number): void;
	/** Drop ownership; true when `dispatchId` was still the owner. */
	release(dispatchId: number): boolean;
	/** Drop whatever claim is outstanding; true when a claim existed. */
	releaseAll(): boolean;
};

export function createDiagnosticsLoadingOwnership(initialOwner: number | null = null): DiagnosticsLoadingOwnership {
	let owner: number | null = initialOwner;
	return {
		get ownerId() {
			return owner;
		},
		claim(dispatchId: number) {
			owner = dispatchId;
		},
		release(dispatchId: number) {
			if (owner !== dispatchId) return false;
			owner = null;
			return true;
		},
		releaseAll() {
			if (owner === null) return false;
			owner = null;
			return true;
		},
	};
}

/**
 * C-6R3: terminal handoff for a fetch that finishes WITHOUT having engaged the
 * diagnostics read, i.e. it aborted while resolving the actor school or active
 * year. The inherited claim would otherwise stay set forever: the superseded
 * invocation that claimed it is no longer the newest dispatch, so its own
 * release is refused, and no newer dispatch ever takes the flag over.
 *
 * Only the NEWEST dispatch may terminate that claim — a superseded invocation
 * must never clear a newer active dispatch's loading flag. Returns true when a
 * claim was terminated.
 */
export function terminateDiagnosticsLoadingForLatestDispatch(
	ownership: DiagnosticsLoadingOwnership,
	isLatestDispatch: () => boolean,
	commit: AuthorityDiagnosticsSetLoading,
): boolean {
	if (!isLatestDispatch()) return false;
	if (!ownership.releaseAll()) return false;
	commit(false);
	return true;
}

export type AuthorityDiagnosticsLoadDeps = {
	epoch: ScopeEpoch;
	scopeRef: { current: string | null };
	scopeId: string;
	request: () => Promise<{ data: TeachingLoadAuthorityDiagnosticsPayload | null }>;
	setPayload: AuthorityDiagnosticsSetPayload;
	setLoading: AuthorityDiagnosticsSetLoading;
	/**
	 * C-6R3: dispatch-scoped loading ownership. REQUIRED rather than optional: a
	 * bare boolean setter cannot express who owns the flag, and omitting the
	 * authority is exactly the fail-open shape that orphaned it. The loader claims
	 * on entry and releases on EVERY exit path — including a discarded superseded
	 * reply.
	 */
	loadingOwnership: DiagnosticsLoadingOwnership;
	/** C-6R3: this dispatch's identity within `loadingOwnership`. */
	loadingOwnerId: number;
	/**
	 * C-6R2: dispatch precedence. The reply is discarded when this invocation is no
	 * longer the newest dispatch — including for the SAME scope. Scope identity and
	 * epoch alone cannot detect a superseded same-scope dispatch, so this predicate
	 * is REQUIRED rather than optional: callers that only exercise scope transitions
	 * pass `() => true`.
	 */
	isLatestDispatch: () => boolean;
};

/**
 * C-5 (F2-COLD-LOAD) / C-6R2 / C-6R3. Production loader for the read-only
 * `/faculty-assignments/authority-diagnostics` read.
 *
 * Contract:
 *   - the epoch is opened for the resolved scope BEFORE the token capture, so a
 *     cold-cache first load persists and always clears its loading flag;
 *   - a reply from a SUPERSEDED DISPATCH is discarded first, because precedence is
 *     checked before scope currency — a newer same-scope dispatch must win;
 *   - a reply whose scope has been superseded (scope identity changed, or the
 *     epoch advanced) is discarded WITHOUT touching state, so it can neither
 *     overwrite the new scope's payload nor clear the new scope's loading flag;
 *   - a repeated resolution of the SAME scope does not open a new epoch, so it
 *     cannot self-invalidate;
 *   - the loading flag is claimed for this dispatch on entry and released on
 *     EVERY exit path, so a superseded reply terminates its own in-flight claim
 *     instead of orphaning it, while a newer owner is left untouched.
 */
export async function loadAuthorityDiagnosticsForScope(
	deps: AuthorityDiagnosticsLoadDeps,
): Promise<AuthorityDiagnosticsLoadOutcome> {
	const { epoch, scopeRef, scopeId, request, setPayload, setLoading, loadingOwnership, loadingOwnerId, isLatestDispatch } = deps;

	// Open the epoch for the resolved scope BEFORE capturing the token.
	openDiagnosticsScope(scopeRef, epoch, scopeId);
	const binding: ScopeBoundWrite = { scopeRef, epoch, scopeId, token: epoch.current };
	// C-6R2: dispatch precedence AND scope currency. The precedence term is what
	// catches a superseded SAME-scope dispatch, which scope+epoch cannot see.
	const isCurrent = () => isLatestDispatch() && isScopeCurrent(binding);

	// C-6R3: this dispatch now OWNS the loading flag. Every exit path releases the
	// claim — including a discarded superseded reply — so an in-flight read whose
	// newer dispatch never reached this loader still terminates instead of leaving
	// the panel stuck on "Checking source".
	loadingOwnership.claim(loadingOwnerId);
	setLoading(true);
	let outcome: AuthorityDiagnosticsLoadOutcome;
	try {
		const response = await request();
		if (!isCurrent()) return 'discarded';
		setPayload(response?.data ?? null);
		outcome = 'persisted';
	} catch {
		if (!isCurrent()) return 'discarded';
		setPayload(null);
		outcome = 'cleared';
	} finally {
		// C-6R3: clear only while this dispatch still owns the flag; a newer active
		// dispatch's claim survives its superseded sibling.
		if (loadingOwnership.release(loadingOwnerId)) setLoading(false);
	}
	if (!isCurrent()) return 'discarded';
	return outcome;
}

export function useTeachingLoadData() {
	const [searchParams, setSearchParams] = useSearchParams();
	const [faculty, setFaculty] = useState<FacultySummary[]>([]);
	const [schoolId, setSchoolId] = useState<number | null>(null);
	const [activeSchoolYearLabel, setActiveSchoolYearLabel] = useState<string | null>(null);
	const [subjects, setSubjects] = useState<Subject[]>([]);
	const [sectionSummary, setSectionSummary] = useState<SectionSummaryResponse | null>(null);
	const [sectionAssignedClassesIndex, setSectionAssignedClassesIndex] = useState<SectionAssignedClassesIndexResult | null>(null);
	const [savedOwnershipIndex, setSavedOwnershipIndex] = useState<SubjectSectionOwnershipIndexEntry[]>([]);
	const [coverageTotals, setCoverageTotals] = useState<TeachingLoadCoverageTotals | null>(null);
	const [workloadPolicy, setWorkloadPolicy] = useState<EffectiveWorkloadPolicyState | null>(null);
	const [workloadPolicyStatus, setWorkloadPolicyStatus] = useState<WorkloadPolicyReadiness>('UNCONFIGURED');
	// Canonical read-only Teaching Load truth. Null is the typed unknown state;
	// it is never replaced with a fabricated count or policy default.
	const [authorityDiagnostics, setAuthorityDiagnostics] = useState<TeachingLoadAuthorityDiagnosticsPayload | null>(null);
	const [authorityDiagnosticsLoading, setAuthorityDiagnosticsLoading] = useState(false);
	// C-5 (F2-COLD-LOAD): scope-bound epoch + resolved scope identity for the
	// diagnostics read. Correctness must NOT depend on React effect ordering — the
	// epoch is opened synchronously by `fetchData` for the scope it just resolved,
	// immediately before the token is captured. See `openDiagnosticsScope` /
	// `loadAuthorityDiagnosticsForScope`.
	const diagnosticsEpochRef = useRef(createScopeEpoch());
	const diagnosticsScopeRef = useRef<string | null>(null);
	// C-6R3: dispatch-scoped ownership of `authorityDiagnosticsLoading`. A bare
	// boolean let a superseded invocation inherit the flag and never clear it.
	const diagnosticsLoadingOwnershipRef = useRef(createDiagnosticsLoadingOwnership());
	// C-6R3: terminal release for a scope reset or unmount — the flag must return
	// to false and no stale claim may survive the teardown of its scope.
	const releaseDiagnosticsLoadingOwnership = useCallback(() => {
		if (diagnosticsLoadingOwnershipRef.current.releaseAll()) {
			setAuthorityDiagnosticsLoading(false);
		}
	}, []);
	// C-6R: monotonic dispatch precedence so a late-resolving OLDER fetch can never
	// bind a scope, write a feed, or clear a loading flag over a newer one.
	const dispatchPrecedenceRef = useRef(createDispatchPrecedence());
	const [activeSchoolYearId, setActiveSchoolYearId] = useState<number | null>(null);
	const [activeTermIndex, setActiveTermIndex] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [selectedId, setSelectedId] = useState<number | null>(() => {
		const queryValue = searchParams.get('facultyId');
		return queryValue ? Number(queryValue) : null;
	});
	const [subjectFocusId, setSubjectFocusId] = useState<number | null>(() => {
		const queryValue = searchParams.get('subjectId');
		if (!queryValue) return null;
		const parsed = Number(queryValue);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const [sectionFocusId, setSectionFocusId] = useState<number | null>(() => {
		const queryValue = searchParams.get('sectionId');
		if (!queryValue) return null;
		const parsed = Number(queryValue);
		return Number.isNaN(parsed) ? null : parsed;
	});
	const [dataSource, setDataSource] = useState<'live' | 'cached' | 'refreshing' | 'none'>('none');
	const [degradedNotice, setDegradedNotice] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(() => navigator.onLine);
	const [homeroomHint, setHomeroomHint] = useState<HomeroomHintResponse | null>(null);
	const [draftAssignmentsByFaculty, setDraftAssignmentsByFaculty] = useState<Record<number, FacultyAssignmentDraft[]>>({});
	const [error, setError] = useState<string | null>(null);

	const hasSectionWorkspaceEvidence =
		(sectionAssignedClassesIndex?.sections?.length ?? 0) > 0
		|| (sectionSummary?.sections?.length ?? 0) > 0;

	const hasLocalWriteEvidence = Boolean(
		activeSchoolYearId
		&& hasSectionWorkspaceEvidence
		&& subjects.length > 0
		&& faculty.length > 0,
	);
	const degradedWriteEnabled = isOnline && dataSource === 'cached' && hasLocalWriteEvidence;
	const canPersistAssignments = isOnline && Boolean(activeSchoolYearId) && (dataSource === 'live' || hasLocalWriteEvidence);
	const isReadOnlyMode = !canPersistAssignments;

	// Every mutable draft, selection, and cache is keyed to the resolved actor
	// scope so a rollover or school switch can never leak state across years.
	const scopeKey = schoolId != null && activeSchoolYearId != null ? `${schoolId}:${activeSchoolYearId}` : null;

	const activeFacultyIds = useMemo(() => new Set(faculty.map((f) => f.id)), [faculty]);

	const fetchData = useCallback(async (options?: { forceRefresh?: boolean }) => {
		const forceRefresh = options?.forceRefresh === true;
		// C-6R: take this invocation's dispatch id BEFORE the first await, so every
		// later write can be proven to belong to the newest invocation.
		const dispatchScope = createFetchDispatchScope(
			dispatchPrecedenceRef.current,
			diagnosticsScopeRef,
			diagnosticsEpochRef.current,
		);
		const isLatestDispatch = () => dispatchScope.isLatestDispatch();
		setLoading(true);
		setError(null);

		let schoolYearId: number | null = null;
		let resolvedSchoolId: number | null = null;
		let yearContextSource: ActiveSchoolYearContextSource = 'cache';
		// C-6R: a write is allowed only when this is still the newest dispatch AND —
		// once a scope is bound — that scope is still the one in force. The
		// previously supersession-blind unbound branch is gone: an older invocation
		// that never resolved its scope now writes nothing.
		const scopeBindingIsCurrent = () => dispatchScope.canWrite();

		try {
			// Actor school first: the authenticated session owns the school scope.
			// No fallback to a hardcoded school literal — unresolved stays an error.
			const actorSchoolId = await resolveActorSchoolId();
			if (actorSchoolId == null) {
				throw Object.assign(new Error('Teaching Load needs a signed-in scheduler account with a school assignment.'), {
					code: 'SCHOOL_UNRESOLVED',
				});
			}
			const schoolYearContext = await resolveActiveSchoolYearContext({
				schoolId: actorSchoolId,
				forceRefresh,
				allowEnrollProFallback: false,
			});
			const scope = teachingLoadScopeParams(actorSchoolId, schoolYearContext.activeSchoolYearId);
			resolvedSchoolId = scope.schoolId;
			// Local const: non-null inside this try block (also safe inside closures below).
			const school = scope.schoolId;
			schoolYearId = scope.schoolYearId;
			yearContextSource = schoolYearContext.source;

			// C-6R: only the newest dispatch may publish actor-school/year identity.
			// These setters drive `scopeKey` and the draft/selection invalidation, so a
			// superseded invocation that resolves late must not re-point the hook at
			// its stale scope. Binding is gated for the same reason: an older
			// invocation must never re-open the epoch over a newer scope (which would
			// invert precedence and make the newer binding look stale).
			if (isLatestDispatch()) {
				setSchoolId(school);
				setActiveSchoolYearLabel(schoolYearContext.activeSchoolYearLabel ?? null);
				setActiveTermIndex(schoolYearContext.activeTerm?.termIndex ?? null);

				// C-6: bind this fetch to the resolved scope BEFORE any reply can be
				// consumed. Opening the epoch here (not in an effect) keeps a cold load
				// from self-invalidating, and gives every sibling authority feed below a
				// single currency check so an obsolete reply writes nothing.
				dispatchScope.bind(`${school}:${schoolYearId}`);
			}

			if (!forceRefresh) {
				const cachedSummary = getCachedFacultyAssignmentsSummary(school, schoolYearId, {
					maxAgeMs: 3 * 60 * 1000,
				});
				const cachedSubjects = getCachedSubjects(school, { maxAgeMs: 3 * 60 * 1000 });
				const cachedSections = getCachedSectionSummary(school, schoolYearId, { maxAgeMs: 3 * 60 * 1000 });

				if (cachedSummary && cachedSubjects && cachedSections && scopeBindingIsCurrent()) {
					setActiveSchoolYearId(schoolYearId);
					setFaculty(cachedSummary.data.faculty);
					setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
					setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
					setWorkloadPolicy(cachedSummary.data.workloadPolicy ?? null);
					setWorkloadPolicyStatus(cachedSummary.data.workloadPolicyStatus ?? 'UNCONFIGURED');
					setSubjects(cachedSubjects.data);
					setSectionSummary(cachedSections.data);
					setDataSource(isOnline ? 'refreshing' : 'cached');
					setDegradedNotice(
						isOnline
							? 'Verifying live teaching load data before enabling edits. Showing your last saved snapshot in the meantime.'
							: 'Offline mode: showing your last saved teaching load snapshot in read-only mode.',
					);
					setLoading(false);
				}
			}

			const [facultyRes, subjectsRes, sectionsRes, sectionAssignedClassesRes] = await Promise.all([
				requestWithRetry(
					() =>
						atlasApi.get<{
							faculty: FacultySummary[];
							ownershipIndex?: SubjectSectionOwnershipIndexEntry[];
							coverageTotals?: TeachingLoadCoverageTotals;
							integrityDiagnostics?: TeachingLoadIntegrityDiagnostics;
							workloadPolicy?: EffectiveWorkloadPolicyState | null;
							workloadPolicyStatus?: WorkloadPolicyReadiness;
							fetchedAt?: string | null;
						}>						(
							'/faculty-assignments/summary',
							{ params: { schoolId: school, schoolYearId } },
						),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<{ subjects: Subject[] }>('/subjects', { params: { schoolId: school } }),
					{ attempts: 2, delayMs: 300 },
				),
				requestWithRetry(
					() => atlasApi.get<SectionSummaryResponse>(`/sections/summary/${schoolYearId}`, { params: { schoolId: school } }),
					{ attempts: 2, delayMs: 400 },
				),
				requestWithRetry(
					() => atlasApi.get<SectionAssignedClassesIndexResult>('/sections/assigned-classes', {
						params: { schoolId: school, schoolYearId, includeDiagnostics: true },
					}),
					{ attempts: 2, delayMs: 400 },
				),
			]);

			const normalizedSummary = normalizeFacultySummarySnapshot({
				faculty: facultyRes.data.faculty,
				ownershipIndex: facultyRes.data.ownershipIndex ?? [],
				coverageTotals: facultyRes.data.coverageTotals,
				integrityDiagnostics: facultyRes.data.integrityDiagnostics,
				workloadPolicy: facultyRes.data.workloadPolicy ?? null,
				workloadPolicyStatus: facultyRes.data.workloadPolicyStatus ?? 'UNCONFIGURED',
				fetchedAt: facultyRes.data.fetchedAt ?? null,
				schoolYearId,
			});
			if (!normalizedSummary) {
				throw new Error('Teaching Load summary payload is incompatible with the current client contract.');
			}
			const normalizedSubjects = Array.isArray(subjectsRes.data.subjects) ? subjectsRes.data.subjects : [];
			const normalizedSectionSummary = {
				...sectionsRes.data,
				sections: Array.isArray((sectionsRes.data as any)?.sections) ? (sectionsRes.data as any).sections : [],
				gradeLevels: Array.isArray((sectionsRes.data as any)?.gradeLevels) ? (sectionsRes.data as any).gradeLevels : [],
				contractWarnings: Array.isArray((sectionsRes.data as any)?.contractWarnings) ? (sectionsRes.data as any).contractWarnings : [],
			};

			// C-6: an obsolete-scope reply must not write ANY sibling authority feed.
			// Every setter below (faculty, subjects, sections, assigned-classes,
			// coverage, policy, dataSource, notice, error) is gated on the scope that
			// dispatched this request still being the one in force.
			if (scopeBindingIsCurrent()) {
				setActiveSchoolYearId(schoolYearId);
				setFaculty(normalizedSummary.faculty);
				setSavedOwnershipIndex(normalizedSummary.ownershipIndex);
				setCoverageTotals(normalizedSummary.coverageTotals ?? null);
				setWorkloadPolicy(normalizedSummary.workloadPolicy ?? null);
				setWorkloadPolicyStatus(normalizedSummary.workloadPolicyStatus ?? 'UNCONFIGURED');
				setSubjects(normalizedSubjects);
				setSectionSummary(normalizedSectionSummary as SectionSummaryResponse);
				setSectionAssignedClassesIndex(sectionAssignedClassesRes.data);
				setCachedFacultyAssignmentsSummary(school, schoolYearId, normalizedSummary);
				setCachedSubjects(school, normalizedSubjects);
				setCachedSectionSummary(school, schoolYearId, normalizedSectionSummary as SectionSummaryResponse);
				const isUpstreamContext = isUpstreamBackedSchoolYearSource(yearContextSource);
				const isUpstreamBacked = isUpstreamContext && normalizedSectionSummary.source === 'enrollpro';
				setDataSource(isUpstreamBacked ? 'live' : 'cached');
				setDegradedNotice(
					isUpstreamBacked
						? null
						: isUpstreamContext
						? 'Teaching load context is sourced from ATLAS mirror. EnrollPro connection is active.'
						: 'Teaching load data is available from ATLAS runtime cache while upstream verification is unavailable.',
				);
				setError(null);
			}

			// Canonical read-only truth surface. Non-fatal by design: a diagnostics
			// failure must not break the assignment workspace, and it must never be
			// masked with an invented number — a null payload renders the typed
			// unknown state instead. Read-only GET with zero write side effects.
			//
			// C-5 (F2-COLD-LOAD): guarded by the RESOLVED SCOPE IDENTITY, not by
			// render ordering. Opening the epoch here, synchronously for the scope we
			// just resolved and before the token capture, is what stops a cold-cache
			// first load from invalidating its own in-flight request.
			// C-6R: only the newest dispatch may touch the diagnostics scope. The loader
			// opens the epoch for the scope it is given, so an older invocation reaching
			// here would invert precedence over the newer binding.
			if (isLatestDispatch()) {
				await loadAuthorityDiagnosticsForScope({
					epoch: diagnosticsEpochRef.current,
					scopeRef: diagnosticsScopeRef,
					scopeId: `${school}:${schoolYearId}`,
					request: () => requestWithRetry(
						() => atlasApi.get<TeachingLoadAuthorityDiagnosticsPayload>(
							'/faculty-assignments/authority-diagnostics',
							{ params: { schoolId: school, schoolYearId } },
						),
						{ attempts: 1, delayMs: 300 },
					),
					// C-6R3: the diagnostics read owns its loading flag per dispatch, so
					// a superseded reply releases only its own claim.
					loadingOwnership: diagnosticsLoadingOwnershipRef.current,
					loadingOwnerId: dispatchScope.dispatchId,
					setPayload: setAuthorityDiagnostics,
					setLoading: setAuthorityDiagnosticsLoading,
					// C-6R2: the reply is also gated on dispatch precedence, so a
					// superseded same-scope reply cannot overwrite a newer payload.
					isLatestDispatch,
				});
			}
		} catch (requestError: any) {
			const cachedSummary = schoolYearId && resolvedSchoolId ? getCachedFacultyAssignmentsSummary(resolvedSchoolId, schoolYearId) : null;
			const cachedSubjects = resolvedSchoolId ? getCachedSubjects(resolvedSchoolId) : null;
			const cachedSections = schoolYearId && resolvedSchoolId ? getCachedSectionSummary(resolvedSchoolId, schoolYearId) : null;

			// C-6: a superseded fetch must not overwrite or clear the current scope's
			// state — including its fallback notice, error, and loading flag.
			if (!scopeBindingIsCurrent()) {
				// Obsolete scope: the newer fetch owns the workspace state.
			} else if (schoolYearId && cachedSummary && cachedSubjects && cachedSections) {
				setActiveSchoolYearId(schoolYearId);
				setFaculty(cachedSummary.data.faculty);
				setSavedOwnershipIndex(cachedSummary.data.ownershipIndex ?? []);
				setCoverageTotals(cachedSummary.data.coverageTotals ?? null);
				setWorkloadPolicy(cachedSummary.data.workloadPolicy ?? null);
				setWorkloadPolicyStatus(cachedSummary.data.workloadPolicyStatus ?? 'UNCONFIGURED');
				setSubjects(cachedSubjects.data);
				setSectionSummary(cachedSections.data);
				setSectionAssignedClassesIndex(null);
				setDataSource('cached');
				setDegradedNotice('Live teaching load data is unavailable. You are viewing your last saved snapshot in read-only mode.');
				setError(null);
			} else {
				setDataSource('none');
				setCoverageTotals(null);
				setWorkloadPolicy(null);
				setWorkloadPolicyStatus('UNCONFIGURED');
				setSectionAssignedClassesIndex(null);
				setAuthorityDiagnostics(null);
				setDegradedNotice(null);
				setError(requestError?.response?.data?.message ?? requestError?.message ?? 'Failed to load teaching load data.');
			}
		} finally {
			// C-6: a superseded fetch must not clear a loading flag that now belongs
			// to the newer fetch for the current scope.
			if (scopeBindingIsCurrent()) setLoading(false);
			// C-6R3: the NEWEST dispatch is the terminal owner of the diagnostics
			// loading flag. When it aborts before it can reach the diagnostics read —
			// an unresolved actor school or active year — it must still terminate the
			// claim a superseded dispatch left set, or the panel is stuck on
			// "Checking source" with no dispatch left to clear it. A superseded
			// invocation returns without touching the newer active claim.
			terminateDiagnosticsLoadingForLatestDispatch(
				diagnosticsLoadingOwnershipRef.current,
				isLatestDispatch,
				setAuthorityDiagnosticsLoading,
			);
		}
	}, [isOnline]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	useEffect(() => {
		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	}, []);

	// NOTE: URL intent (facultyId, sectionId, subjectId) is now applied once
	// per navigation entry by useTeachingLoadRouteIntent in TeachingLoad.tsx.
	// This hook only initializes from URL on first mount and falls back to
	// the first faculty member when no valid selection exists.

	// Initialize selectedId from URL on first mount only
	useEffect(() => {
		const queryValue = searchParams.get('facultyId');
		if (queryValue) {
			const parsed = Number(queryValue);
			if (!Number.isNaN(parsed)) {
				setSelectedId(parsed);
				return;
			}
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Fall back to first faculty when selection is invalid and faculty list is loaded
	useEffect(() => {
		if (faculty.length === 0) {
			setSelectedId(null);
			return;
		}
		if (selectedId == null || !faculty.some((member) => member.id === selectedId)) {
			setSelectedId(faculty[0].id);
		}
	}, [faculty, selectedId]);

	const allKnownSections = useMemo(() => {
		return [...(sectionSummary?.sections ?? [])].sort(
			(left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name) || left.id - right.id,
		);
	}, [sectionSummary]);

	const sectionMap = useMemo(() => buildSectionMap(allKnownSections), [allKnownSections]);

	const toDraftAssignmentsLocal = useCallback((
		assignments: FacultyAssignmentRecord[],
	): FacultyAssignmentDraft[] => {
		return normalizeDraftAssignments(
			assignments.map((assignment) => ({
				subjectId: assignment.subjectId,
				sectionIds: assignment.sectionIds,
				gradeLevels: assignment.gradeLevels,
			})),
			sectionMap,
		);
	}, [sectionMap]);

	const savedAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = toDraftAssignmentsLocal(member.assignments);
		}
		return result;
	}, [faculty, toDraftAssignmentsLocal]);

	const effectiveDraftAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const [facultyIdRaw, assignments] of Object.entries(draftAssignmentsByFaculty)) {
			const facultyId = Number(facultyIdRaw);
			const normalized = normalizeDraftAssignments(assignments, sectionMap);
			const savedSignature = buildAssignmentSignature(savedAssignmentsByFaculty[facultyId] ?? []);
			if (buildAssignmentSignature(normalized) !== savedSignature) {
				result[facultyId] = normalized;
			}
		}
		return result;
	}, [draftAssignmentsByFaculty, savedAssignmentsByFaculty, sectionMap]);

	const effectiveAssignmentsByFaculty = useMemo(() => {
		const result: Record<number, FacultyAssignmentDraft[]> = {};
		for (const member of faculty) {
			result[member.id] = effectiveDraftAssignmentsByFaculty[member.id] ?? savedAssignmentsByFaculty[member.id] ?? [];
		}
		return result;
	}, [faculty, effectiveDraftAssignmentsByFaculty, savedAssignmentsByFaculty]);

	const activeDraftCount = useMemo(() => Object.keys(effectiveDraftAssignmentsByFaculty).length, [effectiveDraftAssignmentsByFaculty]);

	const facultyNames = useMemo(
		() => Object.fromEntries(faculty.map((member) => [member.id, `${member.lastName}, ${member.firstName}`])),
		[faculty],
	);

	const savedOwnershipMap = useMemo(
		() => (savedOwnershipIndex.length > 0
			? buildOwnershipMapFromIndex(savedOwnershipIndex)
			: buildOwnershipMap(savedAssignmentsByFaculty, facultyNames, 'saved')),
		[facultyNames, savedAssignmentsByFaculty, savedOwnershipIndex],
	);

	const savedConflictMap = useMemo(
		() => buildMultiOwnerSavedMap(savedAssignmentsByFaculty, facultyNames),
		[facultyNames, savedAssignmentsByFaculty],
	);

	const pendingOwnershipMap = useMemo(
		() => buildPendingOwnershipMap(savedAssignmentsByFaculty, effectiveDraftAssignmentsByFaculty, facultyNames),
		[effectiveDraftAssignmentsByFaculty, facultyNames, savedAssignmentsByFaculty],
	);

	const effectiveOwnershipMap = useMemo(
		() => buildEffectiveOwnershipMap(effectiveAssignmentsByFaculty, facultyNames, pendingOwnershipMap),
		[effectiveAssignmentsByFaculty, facultyNames, pendingOwnershipMap],
	);

	const selected = useMemo(
		() => faculty.find((member) => member.id === selectedId) ?? null,
		[faculty, selectedId],
	);

	const { canUndo, canRedo, pushHistory, handleUndo, handleRedo, handleResetAssignments } = useAssignmentHistory({
		scopeKey,
		selectedId: selected?.id ?? null,
		subjects,
		effectiveAssignmentsByFaculty,
		savedAssignmentsByFaculty,
		sectionMap,
		setDraftAssignmentsByFaculty,
	});

	// A resolved scope change invalidates every mutable draft and focus before
	// any request or edit can act on the new school/year.
	useEffect(() => {
		setDraftAssignmentsByFaculty({});
		setSelectedId(null);
		setSubjectFocusId(null);
		setSectionFocusId(null);
		setHomeroomHint(null);
		// Authority truth is scope-bound: a stale panel must never describe the
		// previous school/year. The EPOCH is deliberately NOT opened here (C-5):
		// the resolving fetch opens it synchronously for the scope it resolved, so a
		// cold-cache first load cannot invalidate its own in-flight request. This
		// effect only clears the panel so the previous scope's numbers never linger.
		setAuthorityDiagnostics(null);
		// C-6R3: the scope change also drops any outstanding diagnostics loading
		// claim, so an in-flight read from the previous school/year — or from a
		// logout/actor change — can never orphan the panel on "Checking source".
		releaseDiagnosticsLoadingOwnership();
	}, [scopeKey, setDraftAssignmentsByFaculty]); // eslint-disable-line react-hooks/exhaustive-deps

	// C-6R3: unmount must drop any outstanding diagnostics loading claim too. A
	// reply that lands after teardown cannot leave a remounted instance loading
	// forever, and the flag returns to false.
	useEffect(() => {
		return () => {
			releaseDiagnosticsLoadingOwnership();
		};
	}, [releaseDiagnosticsLoadingOwnership]);

	useEffect(() => {
		if (!selected) {
			setHomeroomHint(null);
			return;
		}

		let cancelled = false;
		atlasApi
			.get<HomeroomHintResponse>(`/faculty/${selected.id}/homeroom-hint`)
			.then(({ data }) => {
				if (!cancelled) {
					setHomeroomHint(data);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHomeroomHint(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [selected]);

	return {
		faculty,
		schoolId,
		activeSchoolYearLabel,
		subjects,
		sectionSummary,
		sectionAssignedClassesIndex,
		coverageTotals,
		workloadPolicy,
		workloadPolicyStatus,
		authorityDiagnostics,
		authorityDiagnosticsLoading,
		activeSchoolYearId,
		scopeKey,
		activeTermIndex,
		loading,
		saving,
		setSaving,
		selectedId,
		setSelectedId,
		subjectFocusId,
		setSubjectFocusId,
		sectionFocusId,
		setSectionFocusId,
		dataSource,
		degradedNotice,
		degradedWriteEnabled,
		isOnline,
		homeroomHint,
		draftAssignmentsByFaculty,
		setDraftAssignmentsByFaculty,
		error,
		setError,
		fetchData,
		canPersistAssignments,
		isReadOnlyMode,
		activeFacultyIds,
		allKnownSections,
		sectionMap,
		savedAssignmentsByFaculty,
		effectiveDraftAssignmentsByFaculty,
		effectiveAssignmentsByFaculty,
		activeDraftCount,
		facultyNames,
		savedOwnershipMap,
		savedConflictMap,
		pendingOwnershipMap,
		effectiveOwnershipMap,
		selected,
		canUndo,
		canRedo,
		pushHistory,
		handleUndo,
		handleRedo,
		handleResetAssignments,
	};
}
