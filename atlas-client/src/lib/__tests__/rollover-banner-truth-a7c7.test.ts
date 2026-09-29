/**
 * A7-C7 — the false "School year changed" banner.
 *
 * WHAT THE OPERATOR SAW (demo blocker, 2026-09-29):
 *   "School year changed to 2029-2030. 2022-2023 is archived and read-only."
 * EnrollPro had NOT rolled over. The server put an ATLAS-side school-year
 * surrogate into the EnrollPro id slot (see the server half of this packet,
 * `atlas-server/src/services/runtime-context.service.ts`), and the shell turned
 * that false id change into a rollover notice, then persisted it to localStorage
 * for 14 days so it reappeared on every load.
 *
 * These rows are the CLIENT half of the contract:
 *  - an archived year is never "the new active year";
 *  - a year the server did not itself confirm is never a rollover;
 *  - a persisted notice that the freshly verified context contradicts is DROPPED
 *    (and the durable entry removed, not just hidden);
 *  - an operator who is offline, or whose verification failed, does NOT lose a
 *    legitimate notice;
 *  - a genuine rollover still raises a notice, unchanged in shape and wording.
 *
 * These are pure-function rows over the real module, plus one wiring row that is
 * explicitly labelled a SCAN (it reads AppShell source; it does not render it).
 * The rendered proof for this packet is the planner's Lane C staging walk, not
 * this file — a source scan is not acceptance evidence for a user-facing change,
 * and it is not offered as such.
 *
 * Run: `npm run test:a7-c7-rollover-banner`
 */
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
	clearRolloverAwarenessNotice,
	createRolloverAwarenessNotice,
	evaluateRolloverTransition,
	persistRolloverAwarenessNotice,
	readRolloverAwarenessNotice,
	reconcilePersistedRolloverNotice,
	ROLLOVER_NOTICE_TTL_MS,
} from '@/lib/rollover-awareness';

function installMemoryStorage(): Map<string, string> {
	const store = new Map<string, string>();
	const storage = {
		get length() { return store.size; },
		clear: () => store.clear(),
		getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
		key: (index: number) => [...store.keys()][index] ?? null,
		removeItem: (key: string) => { store.delete(key); },
		setItem: (key: string, value: string) => { store.set(key, String(value)); },
	};
	(globalThis as unknown as { localStorage: typeof storage }).localStorage = storage;
	return store;
}

const SCHOOL = 1;
const GOOD_YEAR = { id: 1, label: '2022-2023' };
const FALSE_NEW_YEAR = { id: 8, label: '2029-2030' };
const REAL_NEW_YEAR = { id: 9, label: '2030-2031' };

let store: Map<string, string>;

beforeEach(() => { store = installMemoryStorage(); });
afterEach(() => { store.clear(); });

function falseNotice() {
	return createRolloverAwarenessNotice({
		schoolId: SCHOOL,
		activeSchoolYearId: FALSE_NEW_YEAR.id,
		activeSchoolYearLabel: FALSE_NEW_YEAR.label,
		previousSchoolYearId: GOOD_YEAR.id,
		previousSchoolYearLabel: GOOD_YEAR.label,
	});
}

/* ── Rule 1: an archived year is never "the new active year" ───────────── */

test('A7-C7-1: no notice when the new year is archived, even on a confirmed id change', () => {
	const transition = evaluateRolloverTransition({
		schoolId: SCHOOL,
		previous: { id: GOOD_YEAR.id, label: GOOD_YEAR.label },
		next: { id: FALSE_NEW_YEAR.id, label: FALSE_NEW_YEAR.label, archived: true, serverVerifiedActive: true },
	});
	assert.equal(transition.changed, false, 'an archived year must never be announced as the new active year');
	assert.equal(transition.notice, null);
	// Negative control for the row above: the SAME id change with the archived
	// flag cleared does produce a notice, so the refusal is the archived flag
	// and not a change in the id comparison.
	const live = evaluateRolloverTransition({
		schoolId: SCHOOL,
		previous: { id: GOOD_YEAR.id, label: GOOD_YEAR.label },
		next: { id: FALSE_NEW_YEAR.id, label: FALSE_NEW_YEAR.label, archived: false, serverVerifiedActive: true },
	});
	assert.equal(live.changed, true, 'the archived flag is the discriminating input, not the id difference');
});

test('A7-C7-2: no notice when the server did not itself confirm the new year', () => {
	const unverified = evaluateRolloverTransition({
		schoolId: SCHOOL,
		previous: { id: GOOD_YEAR.id, label: GOOD_YEAR.label },
		next: { id: FALSE_NEW_YEAR.id, label: FALSE_NEW_YEAR.label, archived: false, serverVerifiedActive: false },
	});
	assert.equal(unverified.changed, false, 'an unverified (atlas-persisted) year is not a rollover');
	assert.equal(unverified.notice, null);
});

/* ── Rule 2: a legitimate real rollover is untouched ───────────────────── */

test('A7-C7-3: a genuine, server-confirmed rollover still raises the notice', () => {
	const transition = evaluateRolloverTransition({
		schoolId: SCHOOL,
		previous: { id: GOOD_YEAR.id, label: GOOD_YEAR.label },
		next: { id: REAL_NEW_YEAR.id, label: REAL_NEW_YEAR.label, archived: false, serverVerifiedActive: true },
	});
	assert.equal(transition.changed, true, 'a real rollover must not be suppressed by the new refusals');
	assert.ok(transition.notice);
	assert.equal(transition.notice!.activeSchoolYearId, REAL_NEW_YEAR.id);
	assert.equal(transition.notice!.activeSchoolYearLabel, REAL_NEW_YEAR.label);
	assert.equal(transition.notice!.previousSchoolYearId, GOOD_YEAR.id);
	assert.equal(transition.notice!.previousSchoolYearLabel, GOOD_YEAR.label);
	// Same notice TYPE as before: no new type, no new field.
	assert.deepEqual(Object.keys(transition.notice!).sort(), [
		'activeSchoolYearId', 'activeSchoolYearLabel', 'changedAt',
		'previousSchoolYearId', 'previousSchoolYearLabel', 'schoolId',
	]);
});

/* ── Rule 3: the durable false notice is dropped on load ───────────────── */

test('A7-C7-4: a persisted notice that disagrees with the verified year is dropped', () => {
	persistRolloverAwarenessNotice(falseNotice());
	assert.ok(readRolloverAwarenessNotice(SCHOOL), 'precondition: the bad notice is durable before the fix ships');

	const reconciled = reconcilePersistedRolloverNotice({
		notice: readRolloverAwarenessNotice(SCHOOL),
		verifiedYear: { id: GOOD_YEAR.id, archived: false },
	});
	assert.equal(reconciled, null, 'the operator stops seeing the false banner as soon as the server answers truthfully');
});

test('A7-C7-5: a persisted notice naming an archived year is dropped', () => {
	persistRolloverAwarenessNotice(falseNotice());
	const reconciled = reconcilePersistedRolloverNotice({
		notice: readRolloverAwarenessNotice(SCHOOL),
		verifiedYear: { id: FALSE_NEW_YEAR.id, archived: true },
	});
	assert.equal(reconciled, null, 'an archived year can never be the active year the notice claims');
});

test('A7-C7-6: an expired persisted notice is dropped and a matching one is kept', () => {
	const fresh = createRolloverAwarenessNotice({
		schoolId: SCHOOL,
		activeSchoolYearId: REAL_NEW_YEAR.id,
		activeSchoolYearLabel: REAL_NEW_YEAR.label,
		previousSchoolYearId: GOOD_YEAR.id,
		previousSchoolYearLabel: GOOD_YEAR.label,
	});
	persistRolloverAwarenessNotice(fresh);
	const kept = reconcilePersistedRolloverNotice({
		notice: readRolloverAwarenessNotice(SCHOOL),
		verifiedYear: { id: REAL_NEW_YEAR.id, archived: false },
	});
	assert.ok(kept, 'a notice that agrees with the verified year survives');
	assert.equal(kept!.activeSchoolYearId, REAL_NEW_YEAR.id);

	const stale = createRolloverAwarenessNotice({
		schoolId: SCHOOL,
		activeSchoolYearId: REAL_NEW_YEAR.id,
		activeSchoolYearLabel: REAL_NEW_YEAR.label,
		previousSchoolYearId: GOOD_YEAR.id,
		previousSchoolYearLabel: GOOD_YEAR.label,
	});
	stale.changedAt = new Date(Date.now() - ROLLOVER_NOTICE_TTL_MS - 60_000).toISOString();
	assert.equal(
		reconcilePersistedRolloverNotice({ notice: stale, verifiedYear: { id: REAL_NEW_YEAR.id, archived: false } }),
		null,
		'an expired notice is dropped even when it agrees',
	);
});

/* ── Rule 4: an offline / unverified operator keeps a legitimate notice ─── */

test('A7-C7-7: no verification result means the persisted notice is kept, not destroyed', () => {
	persistRolloverAwarenessNotice(falseNotice());
	const reconciled = reconcilePersistedRolloverNotice({
		notice: readRolloverAwarenessNotice(SCHOOL),
		verifiedYear: null,
	});
	assert.ok(reconciled, 'an offline operator must not lose a notice because the network is down');
	assert.equal(reconciled!.activeSchoolYearId, FALSE_NEW_YEAR.id);
});

test('A7-C7-8: nothing to reconcile is still nothing', () => {
	assert.equal(reconcilePersistedRolloverNotice({ notice: null, verifiedYear: { id: 1, archived: false } }), null);
	assert.equal(
		reconcilePersistedRolloverNotice({ notice: null, verifiedYear: null }),
		null,
		'an absent notice is never conjured from an unverified context',
	);
});

/* ── Wiring (SCAN, not a render) ────────────────────────────────────────── */

test('A7-C7-9 SCAN: the shell reconciles the durable entry and removes it when dropped', () => {
	const appShell = readFileSync(new URL('../../components/AppShell.tsx', import.meta.url), 'utf8');
	assert.ok(appShell.includes('reconcilePersistedRolloverNotice'), 'the shell reconciles the rehydrated notice');
	assert.ok(
		appShell.includes('if (reconciled === null && persisted !== null) {')
			&& appShell.includes('clearRolloverAwarenessNotice(actorSchoolId);'),
		'a dropped notice is removed from durable storage, not merely hidden',
	);
	assert.ok(
		appShell.includes("serverVerifiedActive: context.source === 'enrollpro-verified'"),
		'the notice requires the server to have confirmed the new year',
	);
	assert.ok(
		appShell.includes('archived: context.activeSchoolYearArchived === true'),
		'the notice carries the server archive verdict for the new year',
	);
	// A dropped notice must not survive as a durable entry. `clearRollover...`
	// is also the dismiss control's call, so the two paths are told apart by the
	// guard that names the reconciliation result.
	assert.equal((appShell.match(/clearRolloverAwarenessNotice\(actorSchoolId\)/g) ?? []).length, 2,
		'exactly two durable removals: the dismiss control and the reconciliation drop');
});
