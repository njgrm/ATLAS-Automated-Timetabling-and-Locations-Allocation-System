/**
 * ACTOR-SCOPE-C01 correction — fail-closed dispatch guards for the Sections
 * child consumers.
 *
 * Drives the REAL exported production dispatchers used by the components:
 *   - `fetchSectionRoomMapBuildings` (SectionRoomMapModal)
 *   - `requestHomeRoomAutoAssign` (HomeRoomAutoAssignDialog preview + apply)
 *
 * A recording `atlasApi` proves that an unresolved/invalid actor school
 * dispatches ZERO requests, while a valid school dispatches exactly one request
 * carrying that school.
 *
 * Run: `npx tsx --test src/lib/__tests__/section-scope-dispatch.test.ts`
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import atlasApi from '@/lib/api';
import { fetchSectionRoomMapBuildings } from '@/components/sections/SectionRoomMapModal';
import { requestHomeRoomAutoAssign } from '@/components/sections/HomeRoomAutoAssignDialog';

type RecordedCall = { method: 'get' | 'post'; url: string; body?: Record<string, unknown> };
let recorded: RecordedCall[] = [];

(atlasApi as unknown as { get: (url: string) => Promise<{ data: unknown }> }).get = async (url: string) => {
	recorded.push({ method: 'get', url });
	if (url.includes('/buildings')) return { data: { buildings: [{ id: 11, name: 'Building 1', rooms: [] }] } };
	return { data: {} };
};

(atlasApi as unknown as { post: (url: string, body?: Record<string, unknown>) => Promise<{ data: unknown }> }).post =
	async (url: string, body?: Record<string, unknown>) => {
		recorded.push({ method: 'post', url, body });
		return { data: { schoolId: body?.schoolId, schoolYearId: 7001, mode: body?.mode, overwriteExisting: false, allowCrossGradeFallback: false, assignments: [], skipped: [], counts: { sectionsConsidered: 0, assigned: 0, skipped: 0, existingPreserved: 0, applied: 0 } } };
	};

beforeEach(() => { recorded = []; });

test('SectionRoomMapModal loader: invalid/absent actor school dispatches ZERO requests', async () => {
	for (const invalid of [0, -1, 1.5, Number.NaN]) {
		recorded = [];
		const result = await fetchSectionRoomMapBuildings(invalid);
		assert.equal(result, null, `schoolId ${String(invalid)} must fail closed`);
		assert.equal(recorded.length, 0, `schoolId ${String(invalid)} must dispatch zero requests`);
	}
});

test('SectionRoomMapModal loader: valid actor school dispatches exactly one request carrying that school', async () => {
	recorded = [];
	const result = await fetchSectionRoomMapBuildings(7);
	assert.ok(result != null, 'valid school loads buildings');
	assert.equal(recorded.length, 1);
	assert.equal(recorded[0].method, 'get');
	assert.equal(recorded[0].url, '/map/schools/7/buildings');
});

test('HomeRoomAutoAssignDialog: invalid/absent actor school dispatches ZERO preview/apply requests', async () => {
	for (const invalid of [0, -1, 1.5, Number.NaN]) {
		for (const mode of ['preview', 'apply'] as const) {
			recorded = [];
			const result = await requestHomeRoomAutoAssign({ schoolId: invalid, schoolYearId: 7001, mode, overwriteExisting: false, allowCrossGradeFallback: false });
			assert.equal(result, null, `schoolId ${String(invalid)} ${mode} must fail closed`);
			assert.equal(recorded.length, 0, `schoolId ${String(invalid)} ${mode} must dispatch zero requests`);
		}
	}
	// Invalid school year also fails closed.
	recorded = [];
	assert.equal(await requestHomeRoomAutoAssign({ schoolId: 7, schoolYearId: 0, mode: 'preview', overwriteExisting: false, allowCrossGradeFallback: false }), null);
	assert.equal(recorded.length, 0, 'invalid schoolYearId must dispatch zero requests');
});

test('HomeRoomAutoAssignDialog: valid actor school dispatches one request carrying that school', async () => {
	recorded = [];
	const result = await requestHomeRoomAutoAssign({ schoolId: 7, schoolYearId: 7001, mode: 'preview', overwriteExisting: false, allowCrossGradeFallback: false });
	assert.ok(result != null);
	assert.equal(recorded.length, 1);
	assert.equal(recorded[0].url, '/sections/home-rooms/7001/auto-assign');
	assert.equal(recorded[0].body?.schoolId, 7);
});
