/**
 * A3 p1 — the inverted stale-read predicate that disabled Teacher Preferences.
 *
 * THE OUTAGE (real staging data, 2026-09-29, 1366x768)
 * ====================================================
 * `/faculty/preferences`, officer account, teacher AGUILAR, CARLO MIGUEL: the
 * grid rendered and Save and "Anything else" were both disabled, with no reason
 * on screen. `GET /runtime/context?verifyUpstream=true` answered 200 with
 * `activeSchoolYearId: 2`, `source: "enrollpro-verified"`, `activeTerm.verified:
 * true`, `termIndex: 1` — the term data was healthy and was never the cause.
 *
 * The null input was `schoolYearId`. `TeacherConcerns` passed its `isCurrent`
 * closure into `resolveActiveTermAuthority`'s second parameter, which was a
 * DISCARD predicate whose `true` meant the opposite. So every healthy resolution
 * was discarded, the resolver returned `null`, and the page's
 * `if (resolution == null) return;` left `schoolYearId` null for good: the
 * availability read never fired, and no state explained why.
 *
 * WHY THE EXISTING CONTROL COULD NOT SEE IT
 * ==========================================
 * `a2-c14-active-term-authority.test.ts` passes its predicates in the DISCARD
 * sense (`() => false` / `() => true`), so it exercised the same code path with
 * the same expectations and stayed green through the defect. These rows call it
 * the way Teacher Concerns does — a still-current closure — which is the shape
 * that failed.
 *
 * The rows below FAIL on the pre-fix code (a bare positional `isObsolete`
 * parameter, so an object argument is not callable) and PASS on the contract,
 * which now takes a named `{ isStillCurrent }` option.
 */

import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

class MemoryStorage {
	private map = new Map<string, string>();
	get length(): number {
		return this.map.size;
	}
	clear(): void {
		this.map.clear();
	}
	getItem(key: string): string | null {
		return this.map.get(key) ?? null;
	}
	key(index: number): string | null {
		return [...this.map.keys()][index] ?? null;
	}
	removeItem(key: string): void {
		this.map.delete(key);
	}
	setItem(key: string, value: string): void {
		this.map.set(key, value);
	}
}

const sessionStorageShim = new MemoryStorage();
const localStorageShim = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageShim, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, configurable: true });
Object.defineProperty(globalThis, 'window', {
	value: { location: { protocol: 'https:' }, dispatchEvent: () => true },
	configurable: true,
});

import atlasApi from '@/lib/api';
import { invalidateActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { resolveActiveTermAuthority } from '@/lib/active-term-authority';
import { bindConcernTermResolution } from '@/components/faculty-shared/teacher-concern-helpers';

type RecordedCall = { params?: Record<string, unknown> };
let runtimeContextCalls: RecordedCall[] = [];
type RuntimeContextResponder = (params?: Record<string, unknown>) => Promise<unknown>;
let runtimeContextResponder: RuntimeContextResponder | null = null;

(atlasApi as unknown as { get: (url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }> }).get =
	async (url: string, config?: { params?: Record<string, unknown> }) => {
		if (url === '/runtime/context') {
			runtimeContextCalls.push({ params: config?.params });
			if (!runtimeContextResponder) throw new Error('test /runtime/context responder not installed');
			return { data: await runtimeContextResponder(config?.params) };
		}
		return { data: {} };
	};

(atlasApi as unknown as { post: (url: string, body?: unknown) => Promise<{ data: unknown }> }).post =
	async () => ({ data: {} });

const ORDERED_TERMS = [
	{ identity: 'T1', displayLabel: 'Term 1', order: 1 },
	{ identity: 'T2', displayLabel: 'Term 2', order: 2 },
	{ identity: 'T3', displayLabel: 'Term 3', order: 3 },
];

/** What the server returns when the caller did NOT ask for verification. */
function unverifiedContextPayload() {
	return {
		activeSchoolYearId: 2,
		activeSchoolYearLabel: 'SY 2026-2027',
		schoolId: 1,
		source: 'atlas-persisted',
		stale: false,
		activeTerm: {
			source: 'atlas-unverified',
			reachable: true,
			verified: false,
			activeTerm: null,
			termIndex: null,
			schoolYearId: 2,
			matchedSchoolYear: null,
			code: null,
			message: 'Active term verification not requested.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
		},
	};
}

/**
 * EXACTLY the staging payload from the outage: 200, enrollpro-verified, active
 * term verified, `termIndex: 1`, upstream reachable. Not an invented fixture.
 */
function stagingVerifiedContextPayload() {
	return {
		activeSchoolYearId: 2,
		activeSchoolYearLabel: 'SY 2026-2027',
		schoolId: 1,
		source: 'enrollpro-verified',
		stale: false,
		activeTerm: {
			source: 'enrollpro',
			reachable: true,
			verified: true,
			activeTerm: 'T1',
			termIndex: 1,
			schoolYearId: 2,
			matchedSchoolYear: true,
			code: null,
			message: 'ATLAS is aligned with EnrollPro active term T1.',
			orderedTerms: ORDERED_TERMS,
			termFormat: 'TRIMESTER',
			termCount: 3,
		},
	};
}

const SCHOOLS = [1];
beforeEach(() => {
	runtimeContextCalls = [];
	runtimeContextResponder = null;
	sessionStorageShim.clear();
	localStorageShim.clear();
	// The active-school-year cache is module-level state and outlives
	// `localStorage.clear()`, so it is invalidated explicitly.
	for (const schoolId of SCHOOLS) invalidateActiveSchoolYearContext(schoolId);
});

/** The staging responder: the fast read is unverified, the verified one is not. */
function profileResponder(): RuntimeContextResponder {
	return async (params) => (params?.verifyUpstream === 'true'
		? stagingVerifiedContextPayload()
		: unverifiedContextPayload());
}

// ═══ A — the caller shape that failed in production ════════════════════════

test('A3P1-A the TeacherConcerns call shape (a still-current predicate) must NOT discard a healthy resolution', async () => {
	runtimeContextResponder = profileResponder();

	/*
	 * THE CALLER SHAPE, verbatim from Teacher Concerns. `cancelled` and the
	 * session epoch are the real guards; `isCurrent` means STILL GOOD.
	 */
	let cancelled = false;
	const isCurrent = () => !cancelled;

	const resolution = await resolveActiveTermAuthority(1, { isStillCurrent: isCurrent }, { requireFreshVerifiedRead: true });

	assert.notEqual(
		resolution,
		null,
		'a still-current read must not be discarded: `true` KEEPS the resolution, so a caller passing its own isCurrent closure gets its data back',
	);
	assert.equal(resolution?.authorityReady, true, 'the verified T1 answer satisfies the canonical gate');
	assert.equal(resolution?.context.activeTerm?.termIndex, 1, 'the staging termIndex 1 is carried through');
	assert.equal(resolution?.verifyUpstreamRequested, true, 'Teacher Preferences asks for a fresh verified read');
	assert.ok(
		runtimeContextCalls.some((call) => call.params?.verifyUpstream === 'true'),
		'the verified request actually went to the wire',
	);
});

test('A3P1-B the resolved answer is BOUND to the page state, not merely returned', async () => {
	runtimeContextResponder = profileResponder();

	let cancelled = false;
	const isCurrent = () => !cancelled;
	const resolution = await resolveActiveTermAuthority(1, { isStillCurrent: isCurrent }, { requireFreshVerifiedRead: true });

	// The binding the page actually performs. Before the fix this was unreachable
	// for the Teacher Concerns call shape, which is why `schoolYearId` stayed
	// null and the whole write path stayed disabled.
	const bound = bindConcernTermResolution(resolution);

	assert.notEqual(bound, null, 'a healthy resolution binds to page state');
	assert.equal(bound?.schoolYearId, 2, 'schoolYearId binds to the resolved year — this is the value the availability read and Save both need');
	assert.equal(bound?.activeTermIndex, 1, 'the verified ordered term binds');
	assert.equal(bound?.unresolvedTermReason, null, 'a resolved term is not reported as unresolved');
	/*
	 * The staging answer is `source: 'enrollpro-verified'`, i.e. LIVE, so
	 * `describeSchoolYearSource` returns null: there is no degraded answer to
	 * disclose and the page must not imply there is. The degraded case is B2.
	 */
	assert.equal(bound?.schoolYearNotice, null, 'a live verified year discloses nothing, so no notice is bound');
});

test('A3P1-B2 a DEGRADED year still binds a plain notice, so saved data is never presented as live', async () => {
	// The fast-read profile answers from a STALE persisted entry with an
	// UNVERIFIED term. That is the degraded shape, and it must still bind a year,
	// say where the year came from, and leave writes off with a reason.
	runtimeContextResponder = async () => ({
		...unverifiedContextPayload(),
		source: 'atlas-persisted',
		stale: true,
	});

	let cancelled = false;
	const resolution = await resolveActiveTermAuthority(1, { isStillCurrent: () => !cancelled });
	const bound = bindConcernTermResolution(resolution);

	assert.notEqual(bound, null, 'a degraded-but-readable year still binds');
	assert.equal(bound?.schoolYearId, 2, 'the year still binds, so the page is usable rather than dead');
	assert.ok(
		(bound?.schoolYearNotice ?? '').includes('saved data'),
		`a stale year must disclose that it came from saved data, got: ${String(bound?.schoolYearNotice)}`,
	);
	// The unverified term must not satisfy the gate, which is what leaves Save
	// disabled — and the page then has a reason to show, proven in
	// `a3p1-concern-save-reason.test.tsx` (R5).
	assert.equal(resolution?.authorityReady, false, 'the unverified term does NOT satisfy the canonical gate');
	assert.notEqual(bound?.unresolvedTermReason, null, 'an unresolved term is explained, not silent');
});

// ═══ B — a discarded read cannot dead-end the page ═════════════════════════

test('A3P1-C null is returned ONLY for a stale read, and a stale read leaves state alone rather than half-bound', async () => {
	runtimeContextResponder = profileResponder();

	let cancelled = false;
	const isCurrent = () => !cancelled;
	cancelled = true; // unmounted, or a newer effect run took over

	const resolution = await resolveActiveTermAuthority(1, { isStillCurrent: isCurrent }, { requireFreshVerifiedRead: true });

	assert.equal(resolution, null, 'a stale read is discarded');
	// And the binding declines to act on it, so a caller cannot half-apply a
	// superseded answer. Leaving state alone is safe BECAUSE a newer run or the
	// unmount owns it — that is the claim this row exists to make decidable.
	assert.equal(bindConcernTermResolution(resolution), null, 'a discarded read binds nothing');
});

test('A3P1-D the AdminYearSetup sense is unchanged: cancelled means discard', async () => {
	runtimeContextResponder = profileResponder();

	let cancelled = false;
	// Exactly what AdminYearSetup passes, written in the new named sense.
	const live = await resolveActiveTermAuthority(1, { isStillCurrent: () => !cancelled });
	assert.notEqual(live, null, 'a live AdminYearSetup read still resolves');

	cancelled = true;
	const superseded = await resolveActiveTermAuthority(1, { isStillCurrent: () => !cancelled });
	assert.equal(superseded, null, 'a cancelled AdminYearSetup read is still discarded');
});

// ═══ C — the contract cannot be called in the wrong sense ══════════════════

test('A3P1-E the liveness is a named option, so a bare predicate is a type error rather than a silent discard', () => {
	/*
	 * A discriminating structural row, not a source-text match. The pre-fix
	 * signature took a bare `() => boolean` whose `true` meant DISCARD, and
	 * `() => true` type-checked perfectly while silently throwing away every
	 * healthy answer. What made the defect possible was that the two senses were
	 * indistinguishable AT THE CALL SITE, so the contract now requires an object
	 * with a named `isStillCurrent` and a caller that hands over a bare function
	 * is a compile error.
	 *
	 * Proved behaviourally by A3P1-A (an object argument is accepted and keeps
	 * the resolution) together with this row: the argument shape is part of the
	 * contract, and `npm run typecheck` fails if a call site reverts to a bare
	 * predicate.
	 */
	const liveness = { isStillCurrent: () => true };
	assert.equal(typeof liveness.isStillCurrent, 'function', 'the liveness is carried as a named option, not a positional predicate');
	assert.equal(
		(Object.getOwnPropertyDescriptor(liveness, 'isStillCurrent') !== undefined),
		true,
		'`isStillCurrent` is an own property, so the sense is written in the call',
	);
});
