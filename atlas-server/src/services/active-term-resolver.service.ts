/**
 * A5-C2A — THE canonical active ordered-term resolver.
 *
 * Before this module there were two independent active-term notions:
 *
 *  - `runtime-context.service.ts` (what the client/shell/Teacher Concerns read),
 *    which consulted the persisted verified ordered contract ONLY when
 *    EnrollPro was *unreachable*; and
 *  - `academic-term.service.ts` `interpretLiveActiveOrder` (what the
 *    availability authority and generation preflight use), which mapped a
 *    reachable typed `ACTIVE_TERM_UNRESOLVED` to an authoritative `null`.
 *
 * Both hard-failed on the same reachable, truthful EnrollPro 409
 * `ACTIVE_TERM_UNRESOLVED` — "no term contains today" — while the persisted
 * verified ordered-term snapshot for the SAME school year carried a resolvable
 * active term that the app shell already displayed. That is two sources of
 * truth for one fact, and it is the recorded root cause of the Teacher Concerns
 * "Active ordered term unresolved" dead end.
 *
 * This module is the single policy. Every consumer (runtime context, the
 * availability authority, generation preflight) calls it, so a read and a write
 * can never disagree about the active term again.
 *
 * ── Fail-closed invariants this module does NOT weaken ──
 *
 *  1. A missing term identity NEVER becomes Term 1. Every return is either a
 *     term that a verified authority actually named, or an explicit `null` with
 *     a typed reason. There is no default, clamp, cycle, or relabel anywhere.
 *  2. A cached term is RE-VERIFIED against the live semantic revision before it
 *     is treated as current. The ordered structure binds `semanticRevision`
 *     (school, year, format, exact ordered terms) and deliberately EXCLUDES
 *     active-term resolution, so a revision match proves the saved term belongs
 *     to the structure EnrollPro is serving right now. A mismatch fails closed.
 *  3. Writes stay disabled when term identity is genuinely unknown: the caller
 *     receives `termIndex: null` and keeps its own `TERM_AUTHORITY_UNRESOLVED`.
 *
 * ── Why the reachable-409 case is a labelled degraded read, not a hard failure ──
 *
 * `ACTIVE_TERM_UNRESOLVED` is a *correct, truthful* upstream answer: the host
 * clock sits outside every term of the active school year. It is not a
 * transport failure and it says nothing about the validity of the saved ordered
 * structure. Treating it as "no term exists" makes ATLAS contradict its own
 * verified, revision-matched snapshot — the two-sources-of-truth defect. So it
 * degrades to LABELLED saved data carrying the real capture time, and the client
 * renders that time. It never degrades silently.
 *
 * The bound on that degradation is the live semantic-revision match above; the
 * age bound below (`CACHED_TERM_MAX_AGE_MS`) is an additional honesty signal
 * that feeds the client wording, NOT a second correctness gate, because a
 * fail-closed TTL here would reintroduce the very contradiction this module
 * exists to remove.
 */

import { getDataContext } from '../lib/data-context.js';
import { derivePersistedActiveTerm, type PersistedTermBoundary } from './academic-term.service.js';
import { normalizePersistedTermStructure } from './derived-demand.service.js';
import type { TermContractFetchResult } from './enrollpro-term-contract.service.js';

/**
 * Injectable live-contract seam. The default implementation reuses the canonical
 * `fetchEnrollProTermContract` verifier (injected by `academic-term.service.ts`
 * to keep its own provider seam authoritative).
 */
export type CanonicalActiveTermProvider = (input: {
	schoolId: number;
	schoolYearId: number;
}) => Promise<TermContractFetchResult>;

/**
 * Where the active-term answer came from. `atlas-cache-*` values are the only
 * degraded ones and ALWAYS carry a non-null `cachedAt`.
 */
export type CanonicalActiveTermSource =
	/** Live EnrollPro named a term inside the live verified structure. */
	| 'enrollpro-verified'
	/** Saved verified snapshot, re-verified against the LIVE semantic revision. */
	| 'atlas-cache-verified'
	/** Saved verified snapshot while EnrollPro is unreachable (pre-existing RR-TERM-CACHE resilience). */
	| 'atlas-cache-offline'
	/** Live EnrollPro is reachable, truthfully names no term, and no revision-matched snapshot exists. */
	| 'enrollpro-unresolved'
	/** Live EnrollPro answered outside the ordered contract, or with a contradictory shape. */
	| 'enrollpro-contract-drift'
	/** EnrollPro could not be reached and there is no usable snapshot. */
	| 'enrollpro-unreachable'
	/** No live answer and no snapshot; ATLAS has no term authority at all. */
	| 'atlas-unverified';

export type CanonicalActiveTermResolution = {
	/** The resolved ordered term, or `null`. NEVER defaulted to Term 1. */
	termIndex: number | null;
	/** Exact identity from the verified contract/snapshot, or `null`. */
	termIdentity: string | null;
	source: CanonicalActiveTermSource;
	/** True only for `atlas-cache-*`: the answer came from saved data. */
	degraded: boolean;
	/** ISO capture time of the saved snapshot backing a degraded answer. */
	cachedAt: string | null;
	/** True when the snapshot is older than {@link CACHED_TERM_MAX_AGE_MS}. */
	cachedBeyondTtl: boolean;
	/**
	 * Whether the saved snapshot's `semanticRevision` was compared against the
	 * live revision. `true` = matched, `false` = did not match, `null` = no
	 * live structure was available to compare against.
	 */
	semanticRevisionMatched: boolean | null;
	/**
	 * A5-C2A — whether the LIVE ordered structure itself was verified. False when
	 * the live read failed before/while verifying the structure (an unverifiable
	 * `school-year` payload, a year/school mismatch, an unsupported format). That
	 * is not an answer about the ACTIVE TERM, so a consumer whose field is only
	 * "which term is active" may still consult the active-term-only adapter for
	 * this one field rather than reporting a structural failure as a term verdict.
	 */
	liveStructureVerified: boolean;
	code: string | null;
	message: string;
};

/**
 * Age beyond which a degraded (saved) answer is additionally reported as
 * beyond-TTL so the client can say so. It does NOT fail closed — see the module
 * comment. 7 days is chosen so an operator who has not re-synced term authority
 * still gets a working, clearly-labelled page instead of the recorded dead end.
 */
export const CACHED_TERM_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type PersistedActiveTermSnapshot = {
	terms: PersistedTermBoundary[];
	snapshotOrder: number | null;
	cachedAt: string;
	/**
	 * The opaque revision token EnrollPro issued when this snapshot was verified,
	 * or `null` when the stored snapshot carries none. It is REQUIRED for the
	 * reachable-`ACTIVE_TERM_UNRESOLVED` path (which must re-verify against the
	 * live revision before treating a saved term as current) and is not consulted
	 * on the pre-existing unreachable path, which never claimed live currency.
	 */
	semanticRevision: string | null;
};

type SnapshotClient = {
	enrollProSchoolYearMirror: {
		findUnique: (args: unknown) => Promise<{
			isActive: boolean;
			isArchived: boolean;
			termContractCache: unknown;
			termContractCachedAt: Date | null;
		} | null>;
	};
};

/**
 * Read the persisted verified ordered-term snapshot for one (school, year).
 * Read-only, network-free, and fail-closed on a malformed or foreign snapshot.
 *
 * Normalisation deliberately uses `normalizePersistedTermStructure` — the SAME
 * normaliser the pre-existing offline path used — so this change does not
 * narrow the already-accepted unreachable/resolver behaviour. The stored
 * `semanticRevision` is read opportunistically as an opaque token (a JSONB
 * round-trip cannot recompute the order-sensitive hash); it is required only by
 * the path that must prove currency, never by the offline path.
 */
export async function loadPersistedActiveTermSnapshot(
	schoolId: number,
	schoolYearId: number,
	client?: SnapshotClient,
): Promise<PersistedActiveTermSnapshot | null> {
	const dataClient = (client ?? getDataContext()) as SnapshotClient;
	let mirror: Awaited<ReturnType<SnapshotClient['enrollProSchoolYearMirror']['findUnique']>>;
	try {
		mirror = await dataClient.enrollProSchoolYearMirror.findUnique({
			where: { schoolId_enrollProSchoolYearId: { schoolId, enrollProSchoolYearId: schoolYearId } },
			select: { isActive: true, isArchived: true, termContractCache: true, termContractCachedAt: true },
		});
	} catch {
		return null;
	}
	if (!mirror || !mirror.isActive || mirror.isArchived) return null;
	if (!mirror.termContractCache || !mirror.termContractCachedAt) return null;
	const normalized = normalizePersistedTermStructure(mirror.termContractCache, schoolId, schoolYearId);
	if (!normalized.ok) return null;
	const stored = mirror.termContractCache as { activeTerm?: { order?: unknown }; semanticRevision?: unknown };
	const rawActive = stored.activeTerm;
	const snapshotOrder = rawActive && Number.isInteger(rawActive.order) ? Number(rawActive.order) : null;
	const cachedAt = new Date(mirror.termContractCachedAt);
	if (!Number.isFinite(cachedAt.getTime())) return null;
	return {
		terms: normalized.structure.terms.map((term) => ({
			identity: term.identity,
			order: term.order,
			startDate: term.startDate ?? null,
			endDate: term.endDate ?? null,
		})),
		snapshotOrder,
		cachedAt: cachedAt.toISOString(),
		semanticRevision: typeof stored.semanticRevision === 'string' && stored.semanticRevision.length > 0
			? stored.semanticRevision
			: null,
	};
}

function beyondTtl(cachedAtIso: string, now: Date): boolean {
	const capturedMs = Date.parse(cachedAtIso);
	if (!Number.isFinite(capturedMs)) return true;
	return now.getTime() - capturedMs > CACHED_TERM_MAX_AGE_MS;
}

type ResolutionOptions = {
	provider: CanonicalActiveTermProvider;
	now?: Date;
	loadSnapshot?: (schoolId: number, schoolYearId: number) => Promise<PersistedActiveTermSnapshot | null>;
};

function unresolved(code: string | null, message: string): CanonicalActiveTermResolution {
	return {
		termIndex: null,
		termIdentity: null,
		source: 'enrollpro-unresolved',
		degraded: false,
		cachedAt: null,
		cachedBeyondTtl: false,
		semanticRevisionMatched: null,
		liveStructureVerified: true,
		code,
		message,
	};
}

function drift(code: string | null, message: string): CanonicalActiveTermResolution {
	return {
		termIndex: null,
		termIdentity: null,
		source: 'enrollpro-contract-drift',
		degraded: false,
		cachedAt: null,
		cachedBeyondTtl: false,
		semanticRevisionMatched: null,
		liveStructureVerified: true,
		code,
		message,
	};
}

function cached(
	source: 'atlas-cache-verified' | 'atlas-cache-offline',
	termIndex: number,
	termIdentity: string,
	cachedAt: string,
	now: Date,
	semanticRevisionMatched: boolean | null,
	code: string | null,
	message: string,
): CanonicalActiveTermResolution {
	return {
		termIndex,
		termIdentity,
		source,
		degraded: true,
		cachedAt,
		cachedBeyondTtl: beyondTtl(cachedAt, now),
		semanticRevisionMatched,
		liveStructureVerified: true,
		code,
		message,
	};
}

function isUnreachableCode(code: string): boolean {
	return code === 'ENROLLPRO_UNREACHABLE' || code === 'ENROLLPRO_ACTIVE_TERM_UNREACHABLE' || code === 'ENROLLPRO_SCHOOL_YEAR_UNAVAILABLE';
}

/**
 * THE canonical active ordered-term answer for every consumer.
 *
 * 1. Live EnrollPro names a term inside the live verified structure → use it.
 * 2. Live EnrollPro is reachable and truthfully names no term
 *    (`ACTIVE_TERM_UNRESOLVED`) → degrade to the saved snapshot ONLY when its
 *    `semanticRevision` equals the LIVE structure's revision, and label it with
 *    the real capture time. Otherwise fail closed.
 * 3. Live EnrollPro is unreachable → the pre-existing date-derived saved
 *    snapshot, labelled.
 * 4. Any other reachable live failure (contradictory identity, contract
 *    invalid, non-409 HTTP error) → fail closed with its typed code. It is
 *    never papered over with saved data, because it means the live answer
 *    contradicts the structure rather than merely omitting the active term.
 * 5. No live answer and no usable snapshot → `null` with a typed reason. The
 *    caller keeps `TERM_AUTHORITY_UNRESOLVED`. Never Term 1.
 */
export async function resolveCanonicalActiveTerm(
	input: { schoolId: number; schoolYearId: number },
	options: ResolutionOptions,
): Promise<CanonicalActiveTermResolution> {
	const now = options.now ?? new Date();
	const loadSnapshot = options.loadSnapshot
		?? ((schoolId: number, schoolYearId: number) => loadPersistedActiveTermSnapshot(schoolId, schoolYearId));

	let live: TermContractFetchResult | null = null;
	try {
		live = await options.provider({ schoolId: input.schoolId, schoolYearId: input.schoolYearId });
	} catch {
		live = null;
	}

	// ── Live failure paths ──
	if (!live) {
		return unreachableResolution(input, options, loadSnapshot, now, null, 'The EnrollPro term authority could not be read.');
	}
	if (!live.ok) {
		if (!isUnreachableCode(live.error.code)) {
			// The live read failed BEFORE the ordered structure could be verified
			// (an unverifiable `school-year` payload, a year/school mismatch, an
			// unsupported format). That is not an answer about the active term.
			return { ...drift(live.error.code, live.error.message), liveStructureVerified: false };
		}
		return unreachableResolution(input, options, loadSnapshot, now, live.error.code, live.error.message);
	}

	const contract = live.contract;
	const liveOrder = contract.activeTerm && Number.isInteger(contract.activeTerm.order)
		? contract.activeTerm.order
		: null;

	// ── 1. Live resolved ──
	if (liveOrder != null) {
		return {
			termIndex: liveOrder,
			termIdentity: contract.activeTerm!.identity,
			source: 'enrollpro-verified',
			degraded: false,
			cachedAt: null,
			cachedBeyondTtl: false,
			semanticRevisionMatched: null,
			liveStructureVerified: true,
			code: null,
			message: contract.activeTermState?.message ?? `EnrollPro active term ${contract.activeTerm!.identity} verified.`,
		};
	}

	// ── 2. A structurally verified structure whose active-term read was NOT
	// reachable is the degraded/offline case, not a contract failure. This is
	// the pre-existing ACTIVE-TERM-LIVE-RESOLUTION-C01 semantic
	// (`activeTermState.reachable === false` → saved-snapshot fallback) and it
	// is preserved exactly.
	if (contract.activeTermState?.reachable === false) {
		return unreachableResolution(
			input, options, loadSnapshot, now,
			contract.activeTermState.code ?? 'ENROLLPRO_ACTIVE_TERM_UNREACHABLE',
			contract.activeTermState.message ?? 'The EnrollPro active-term authority is unreachable; the ordered term structure was verified independently.',
		);
	}

	// ── 3. Reachable, truthfully unresolved (the host-clock case) ──
	if (contract.activeTermState?.availability === 'UNRESOLVED' && contract.activeTermState.code === 'ACTIVE_TERM_UNRESOLVED') {
		const snapshot = await loadSnapshot(input.schoolId, input.schoolYearId);
		if (!snapshot) {
			return unresolved(
				'ACTIVE_TERM_UNRESOLVED',
				'EnrollPro reports that no term contains today, and ATLAS has no saved ordered term to fall back to.',
			);
		}
		// INVARIANT 2: a cached term is re-verified against the LIVE semantic
		// revision before it is treated as current. A snapshot with no stored
		// revision cannot prove currency, so it fails closed here.
		if (snapshot.semanticRevision == null || snapshot.semanticRevision !== contract.semanticRevision) {
			return unresolved(
				'TERM_AUTHORITY_STALE',
				snapshot.semanticRevision == null
					? 'The saved ordered terms carry no verification revision, so the active term cannot be re-verified against the live EnrollPro term structure.'
					: `The saved ordered terms no longer match EnrollPro (saved ${snapshot.semanticRevision}, live ${contract.semanticRevision}); the active term cannot be resolved from saved data.`,
			);
		}
		const derived = derivePersistedActiveTerm(snapshot.terms, snapshot.snapshotOrder, now);
		if (!derived) {
			return unresolved(
				'ACTIVE_TERM_UNRESOLVED',
				'EnrollPro reports that no term contains today, and the saved ordered terms do not name an active term either.',
			);
		}
		return cached(
			'atlas-cache-verified',
			derived.termIndex,
			derived.identity,
			snapshot.cachedAt,
			now,
			true,
			'ACTIVE_TERM_UNRESOLVED',
			`EnrollPro has no term containing today's date; using the saved ordered term ${derived.identity}, captured ${snapshot.cachedAt}, re-verified against the live EnrollPro term structure.`,
		);
	}

	// ── 4. Other reachable live failures stay fail-closed ──
	const availability = contract.activeTermState?.availability ?? 'UNAVAILABLE';
	return drift(
		contract.activeTermState?.code ?? 'ACTIVE_TERM_CONTRACT_DRIFT',
		contract.activeTermState?.message
			?? `EnrollPro returned an active-term state of ${availability} that ATLAS cannot map to an ordered term.`,
	);
}

async function unreachableResolution(
	input: { schoolId: number; schoolYearId: number },
	options: ResolutionOptions,
	loadSnapshot: NonNullable<ResolutionOptions['loadSnapshot']>,
	now: Date,
	code: string | null,
	message: string,
): Promise<CanonicalActiveTermResolution> {
	const snapshot = await loadSnapshot(input.schoolId, input.schoolYearId);
	if (snapshot) {
		const derived = derivePersistedActiveTerm(snapshot.terms, snapshot.snapshotOrder, now);
		if (derived) {
			return cached(
				'atlas-cache-offline',
				derived.termIndex,
				derived.identity,
				snapshot.cachedAt,
				now,
				null,
				code,
				`EnrollPro is unreachable; using the saved ordered term ${derived.identity}, captured ${snapshot.cachedAt}.`,
			);
		}
	}
	return {
		termIndex: null,
		termIdentity: null,
		source: 'enrollpro-unreachable',
		degraded: false,
		cachedAt: null,
		cachedBeyondTtl: false,
		semanticRevisionMatched: null,
		liveStructureVerified: false,
		code,
		message,
	};
}
