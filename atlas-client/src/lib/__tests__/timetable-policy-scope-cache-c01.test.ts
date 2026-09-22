/**
 * TIMETABLE-RELAXED-MAIN-C01 — C2 correction: sub-page pane request dedupe.
 *
 * The pre-action review found Candidate B changed no fetch-layer code: the
 * navigation-repeat dedupe was delivered by the scoped query cache committed
 * before this range's base (`4a4ea235`/`d2a94491`), while
 * `SchedulingPolicyPane.tsx` still issued three `atlasApi.get` reads per mount.
 *
 * This suite drives the REAL production read layer (`ensureTimetablePolicyAuxiliary`
 * → `timetableQueryClient` → the three policy endpoints) against a mocked
 * transport, so the request counts are observed rather than asserted from text.
 * It also carries the failing-first control (the pane must issue no direct read)
 * and the pre-correction mutant that repeats every read on revisit.
 *
 * Run: `npm run test:timetable-relaxed-main` (also named in `test:client-suite`).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test, { after } from 'node:test';

import atlasApi from '@/lib/api';
import { timetableQueryClient } from '@/lib/timetable-data/timetableQueryClient';
import {
	buildTimetableScopeKey,
	timetableGradeWindowsQueryKey,
	timetablePolicySpecialEventsQueryKey,
	timetableSectionsSummaryQueryKey,
	type ResolvedTimetableScope,
} from '@/lib/timetable-data/timetableQueryKeys';
import { ensureTimetablePolicyAuxiliary } from '@/lib/timetable-data/timetableServerState';

const clientRoot = resolve(import.meta.dirname, '../../..');
function source(path: string): string {
	return readFileSync(resolve(clientRoot, path), 'utf8');
}

const SCOPE: ResolvedTimetableScope = { schoolId: 1, schoolYearId: 9, runId: 42, termIndex: 2 };

/** The real response shapes the three policy endpoints return. */
function respond(url: string): unknown {
	if (/\/generation\/\d+\/\d+\/grade-windows$/.test(url)) {
		return { windows: [{ gradeLevel: 7, programType: null, startTime: '07:30', endTime: '17:00' }] };
	}
	if (/\/sections\/summary\/\d+\?schoolId=\d+$/.test(url)) {
		return { sections: [{ id: 701, name: 'G7AW', programType: 'REGULAR' }] };
	}
	if (/\/policies\/special-events\/\d+\/\d+$/.test(url)) {
		return { events: [{ eventType: 'RECESS', gradeGroup: '7-8', programType: null, label: 'Recess', startTime: '09:45', endTime: '10:00' }] };
	}
	throw new Error(`unexpected URL ${url}`);
}

type Stub = { calls: string[]; restore: () => void };

function stubTransport(): Stub {
	const originalGet = atlasApi.get;
	const calls: string[] = [];
	(atlasApi as unknown as { get: unknown }).get = async (url: string) => {
		calls.push(url);
		return { data: respond(url) };
	};
	return {
		calls,
		restore: () => {
			(atlasApi as unknown as { get: unknown }).get = originalGet;
			timetableQueryClient.clear();
		},
	};
}

test('C2: a sub-page revisit repeats no policy-auxiliary read already resolved for the same scope', async () => {
	const stub = stubTransport();
	try {
		timetableQueryClient.clear();

		// Cold visit: exactly one dispatch per endpoint, no endpoint twice.
		await ensureTimetablePolicyAuxiliary(SCOPE);
		const cold = stub.calls.length;
		assert.equal(cold, 3, `the cold pane visit must issue 3 dispatches (observed ${cold})`);
		assert.equal(new Set(stub.calls).size, cold, 'the cold visit already issues each endpoint once');

		// Index → sub-page → index revisits resolve from the scoped cache.
		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary(SCOPE);
		assert.equal(stub.calls.length, 0, `the first revisit must repeat no endpoint (observed ${stub.calls.length})`);

		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary(SCOPE);
		assert.equal(stub.calls.length, 0, `the second revisit must repeat no endpoint (observed ${stub.calls.length})`);
	} finally {
		stub.restore();
	}
});

test('C2: a scope change invalidates the policy-auxiliary cache', async () => {
	const stub = stubTransport();
	try {
		timetableQueryClient.clear();

		await ensureTimetablePolicyAuxiliary(SCOPE);
		assert.equal(stub.calls.length, 3, 'the first scope resolves three reads');

		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary({ ...SCOPE, schoolYearId: 10 });
		assert.equal(stub.calls.length, 3, 'a different school year must not reuse another scope snapshot');

		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary({ ...SCOPE, schoolId: 2 });
		assert.equal(stub.calls.length, 3, 'a different school must not reuse another scope snapshot');

		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary({ ...SCOPE, runId: 43 });
		assert.equal(stub.calls.length, 3, 'a different run must not reuse another scope snapshot');

		stub.calls.length = 0;
		await ensureTimetablePolicyAuxiliary({ ...SCOPE, termIndex: 3 });
		assert.equal(stub.calls.length, 3, 'a different term must not reuse another scope snapshot');
	} finally {
		stub.restore();
	}
});

test('C2: an unresolved scope fails closed and dispatches nothing', async () => {
	const stub = stubTransport();
	try {
		timetableQueryClient.clear();
		await assert.rejects(
			() => ensureTimetablePolicyAuxiliary({ schoolId: null, schoolYearId: 9, runId: null, termIndex: 'all' }),
			/scope is unavailable/i,
		);
		await assert.rejects(
			() => ensureTimetablePolicyAuxiliary({ schoolId: 1, schoolYearId: null, runId: null, termIndex: 'all' }),
			/scope is unavailable/i,
		);
		assert.equal(stub.calls.length, 0, 'an unresolved scope must never dispatch a read');
	} finally {
		stub.restore();
	}
});

test('C2: the policy-auxiliary cache identity carries school/year/run/term', () => {
	const full = buildTimetableScopeKey(SCOPE);
	for (const part of ['school:1', 'year:9', 'run:42', 'term:2']) {
		assert.ok(full.includes(part), `the scope identity must carry ${part}`);
	}
	for (const key of [
		timetableGradeWindowsQueryKey(SCOPE),
		timetableSectionsSummaryQueryKey(SCOPE),
		timetablePolicySpecialEventsQueryKey(SCOPE),
	]) {
		assert.equal(key[key.length - 1], full, 'every policy-auxiliary key embeds the full scope identity');
		assert.ok(key.includes('policy'), 'the policy-auxiliary keys live in their own namespace');
	}
	// A change to any part of the tuple is a different cache entry.
	const variants: ResolvedTimetableScope[] = [
		{ ...SCOPE, schoolId: 2 },
		{ ...SCOPE, schoolYearId: 10 },
		{ ...SCOPE, runId: 43 },
		{ ...SCOPE, termIndex: 3 },
	];
	for (const variant of variants) {
		assert.notEqual(
			timetableGradeWindowsQueryKey(variant).join('/'),
			timetableGradeWindowsQueryKey(SCOPE).join('/'),
			'a scope change must produce a different key',
		);
	}
});

/* ── Failing-first control + pre-correction mutant ─────────────────────────── */

test('C2 failing-first control: the policy pane issues no direct transport read', () => {
	const pane = source('src/components/SchedulingPolicyPane.tsx');
	const directReads = pane.match(/atlasApi\.get</g) ?? [];
	assert.equal(
		directReads.length,
		0,
		`the pane still issues ${directReads.length} direct atlasApi.get read(s); its reads must route through the scoped cache`,
	);
	assert.match(pane, /ensureTimetablePolicyAuxiliary\(/, 'the pane must call the scoped loader');
	// The three endpoints still exist in the data layer the loader owns.
	const dataSources = source('src/lib/timetable-data/timetableDataSources.ts');
	for (const endpoint of ['/grade-windows', '/sections/summary/', '/policies/special-events/']) {
		assert.ok(dataSources.includes(endpoint), `the data layer must still own ${endpoint}`);
	}
});

test('C2 control mutant: the pre-correction direct-fetch pattern repeats every read on revisit', async () => {
	const stub = stubTransport();
	try {
		timetableQueryClient.clear();

		// The verbatim pre-correction `fetchAuxiliary` transport shape.
		const legacyDirectFetch = async (schoolId: number, schoolYearId: number) => {
			await Promise.all([
				atlasApi.get(`/generation/${schoolId}/${schoolYearId}/grade-windows`, { timeout: 8_000 }).catch(() => null),
				atlasApi.get(`/sections/summary/${schoolYearId}?schoolId=${schoolId}`, { timeout: 8_000 }).catch(() => null),
				atlasApi.get(`/policies/special-events/${schoolId}/${schoolYearId}`, { timeout: 8_000 }).catch(() => null),
			]);
		};

		await legacyDirectFetch(1, 9);
		assert.equal(stub.calls.length, 3, 'the uncached mount issues three reads');

		stub.calls.length = 0;
		await legacyDirectFetch(1, 9);
		assert.equal(
			stub.calls.length,
			3,
			'the uncached pane repeats every read on revisit — the defect the scoped loader removes',
		);
	} finally {
		stub.restore();
	}
});

after(() => {
	timetableQueryClient.clear();
});
