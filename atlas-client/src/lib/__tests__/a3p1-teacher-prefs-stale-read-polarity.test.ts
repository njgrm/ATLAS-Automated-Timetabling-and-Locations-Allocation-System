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
import { bindConcernTermResolution, resolveConcernSaveAvailability } from '@/components/faculty-shared/teacher-concern-helpers';

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

// ═══ D — B1 + B2: one string on the card, none on the Save row ══════════════

/**
 * A real UNRESOLVED upstream answer carrying a real error code — not a
 * hand-written sentence. This is the payload shape the server returns when
 * EnrollPro cannot resolve an active term, and it is the one that used to put
 * "EnrollPro reported TERM_AUTHORITY_STALE and …" into the Save row.
 *
 * `message` is null on purpose. `describeUnresolvedTermReason` returns
 * `message` when present and only falls through to the `EnrollPro reported
 * ${code}` branch when it is absent — so a payload carrying both would never
 * reach the code path at all, and this row would pass without testing the leak.
 */
function codedUnresolvedContextPayload(code: string) {
	return {
		...stagingVerifiedContextPayload(),
		activeTerm: {
			...stagingVerifiedContextPayload().activeTerm,
			verified: false,
			activeTerm: null,
			termIndex: null,
			matchedSchoolYear: false,
			code,
			message: null,
		},
	};
}

const CODES = ['TERM_AUTHORITY_STALE', 'ACTIVE_TERM_UNRESOLVED', 'TERM_STRUCTURE_UNAVAILABLE'];

test('A3P1-B3 the CARD keeps the real EnrollPro code, and the Save row never repeats or leaks it', async () => {
	for (const code of CODES) {
		invalidateActiveSchoolYearContext(1);
		runtimeContextResponder = async () => codedUnresolvedContextPayload(code);

		let cancelled = false;
		const resolution = await resolveActiveTermAuthority(1, { isStillCurrent: () => !cancelled }, { requireFreshVerifiedRead: true });

		// The CARD path: the detailed diagnostic, code included, as before.
		const bound = bindConcernTermResolution(resolution);
		assert.notEqual(bound, null, `${code}: an unresolved-but-readable term still binds`);
		const card = bound?.unresolvedTermReason ?? '';
		assert.match(card, new RegExp(code), `${code}: the card keeps the real upstream code — the diagnostic surface must not be dumbed down`);

		// The SAVE ROW path, for the page state that same answer produces.
		const availability = resolveConcernSaveAvailability({
			actorSchoolId: 1,
			schoolYearId: bound?.schoolYearId ?? 2,
			activeTermIndex: bound?.activeTermIndex ?? null,
			selectedFacultyId: 7,
			yearResolution: 'RESOLVED',
		});
		assert.equal(availability.writesDisabled, true, `${code}: an unresolved term disables writes`);
		const row = availability.reason ?? '';
		assert.doesNotMatch(row, new RegExp(code), `${code}: B2 — the Save row must not leak the raw enum`);
		assert.doesNotMatch(row, /[A-Z][A-Z0-9]*_[A-Z0-9_]+/, `${code}: B2 — no SNAKE_CASE enum token at all in the Save row`);
		assert.doesNotMatch(row, /EnrollPro reported/, `${code}: B2 — the Save row must not echo the card's code sentence`);
		// B1 — one sentence per place, never the same string twice on a screen.
		assert.notEqual(row, card, `${code}: B1 — the Save row must not reprint the card's sentence`);
		assert.ok(row.trim().length > 0, `${code}: the Save row still explains itself`);
	}
});

test('A3P1-B4 the Save-row sentence is fixed, so no term payload can change or duplicate it', () => {
	const base = { actorSchoolId: 1, schoolYearId: 2, activeTermIndex: null, selectedFacultyId: 7, yearResolution: 'RESOLVED' as const };
	const first = resolveConcernSaveAvailability(base).reason;
	// The same page state reached from three different upstream answers.
	for (const code of CODES) {
		assert.equal(
			resolveConcernSaveAvailability(base).reason,
			first,
			`${code}: the consequence sentence is independent of the upstream payload`,
		);
	}
	assert.match(first ?? '', /^Save is off until ATLAS verifies an active term\.$/, 'the sentence is short, code-free and about the control');
});

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

// ═══ C — the contract consults liveness at BOTH of its discard points ═══════

test('A3P1-E the resolver consults isStillCurrent before AND after the verified read', async () => {
	/*
	 * A3 p1 correction round 1, N8. The previous A3P1-E built its own object
	 * literal and then asserted properties of THAT literal, so it could not fail
	 * if the contract reverted to a bare positional predicate — it was a
	 * tautology wearing a control's clothes. This row instead drives the REAL
	 * `resolveActiveTermAuthority` and counts how often it asks.
	 *
	 * The contract has two discard points: after the fast read, and again after
	 * the `verifyUpstream: true` read. A page that goes stale DURING the
	 * verified read must still discard, and that is only observable by flipping
	 * the answer part-way through. So the closure is rigged to report "still
	 * current" for the first consultation and "stale" from then on, which can
	 * only take effect if the resolver really asks a second time.
	 */
	runtimeContextResponder = profileResponder();

	let calls = 0;
	let cancelled = false;
	const isStillCurrent = () => {
		calls += 1;
		return !cancelled && calls === 1;
	};

	const resolution = await resolveActiveTermAuthority(1, { isStillCurrent }, { requireFreshVerifiedRead: true });

	assert.equal(
		calls,
		2,
		'the resolver checks liveness at both discard points: once after the fast read, once after the verified read',
	);
	assert.equal(resolution, null, 'a read that goes stale during the verified read is discarded, not half-bound');
	assert.equal(bindConcernTermResolution(resolution), null, 'and the binding declines to act on it');
});

test('A3P1-E2 a liveness that never goes stale is never consulted into a discard', async () => {
	runtimeContextResponder = profileResponder();

	let calls = 0;
	let cancelled = false;
	const resolution = await resolveActiveTermAuthority(1, {
		isStillCurrent: () => {
			calls += 1;
			return !cancelled;
		},
	}, { requireFreshVerifiedRead: true });

	assert.ok(calls >= 1, 'liveness is consulted at least once');
	assert.notEqual(resolution, null, 'a live read is never discarded');
	assert.equal(resolution?.context.activeTerm?.termIndex, 1, 'and it carries the verified staging term');
});
