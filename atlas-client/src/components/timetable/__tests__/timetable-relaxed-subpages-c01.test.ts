import assert from 'node:assert/strict';

import { assertCenterPaneOwnerIsRendered } from './centerPaneOwner';
	// C11 M1 — the routed pane arms are now keyed off `paneView`, the view
	// RESOLVED by `resolveCenterPane`, not the raw `centerView` state. The pattern
	// accepts either name so the row still decides the property it was written for
	// (this routed arm exists in CenterWorkspace) and is not re-broken by a future
	// rename of the local. The assertion is updated, never dropped (AGENTS.md §16).
import test from 'node:test';

import { isTimetableSchedulerView } from '../TimetableRouteViewSync';

test('TIMETABLE-RELAXED-SUBPAGES-C01: only schedule and pre-generation retain scheduler chrome', () => {
	assert.equal(isTimetableSchedulerView('schedule'), true);
	assert.equal(isTimetableSchedulerView('pre-generation'), true);

	for (const view of ['policy', 'map', 'manual-edit', 'building', 'runs', 'setup']) {
		assert.equal(isTimetableSchedulerView(view), false, `${view} must use its own relaxed sub-page shell`);
	}
});

test('TIMETABLE-RELAXED-SUBPAGES-C01: workspace gates full scheduler header and selection strip', async () => {
	const { readFileSync } = await import('node:fs');
	const { resolve } = await import('node:path');
	const workspace = readFileSync(resolve(import.meta.dirname, '..', 'ScheduleReviewWorkspace.tsx'), 'utf8');

	assert.match(workspace, /isTimetableSchedulerView\(state\.headerContext\.centerView\)/);
	assert.match(workspace, /showSchedulerChrome && state\.selectedEntry && layoutMode === 'simple'/);
	assert.match(workspace, /showSchedulerChrome \? \(layoutMode === 'simple' \?/);

	// C11 slice 1 (F4) — the centre-pane chain moved to
	// `CenterWorkspacePaneSurface.tsx` (the AGENTS.md §8 cap, plus F4's requirement
	// for a rendered row on the real surface). The property decided here is
	// UNCHANGED and nothing was removed or weakened; only the owning module is read
	// now, and `assertCenterPaneOwnerIsRendered()` pins the new owner to the one
	// CenterWorkspace actually renders.
	assertCenterPaneOwnerIsRendered();
	const center = readFileSync(resolve(import.meta.dirname, '..', 'CenterWorkspacePaneSurface.tsx'), 'utf8');
	for (const view of ['policy', 'runs', 'setup']) {
		assert.match(center, new RegExp(`(?:centerView|paneView) === '${view}'`), `${view} must have an explicit non-grid branch`);
	}
	assert.match(center, /<TimetableGrid/);
});
