import assert from 'node:assert/strict';
import test from 'node:test';
import React, { useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { useScheduleReviewWorkspaceState } from '@/hooks/useScheduleReviewWorkspaceState';
import atlasApi from '@/lib/api';
import { invalidateActiveSchoolYearContext } from '@/lib/enrollpro-public-settings';
import { ATLAS_LOCAL_TOKEN_KEY } from '@/lib/auth';

function allTermsGrid() {
	return React.createElement('div', { 'data-testid': 'all-terms-grid' },
		[1, 2, 3].map((term) => React.createElement('div', { key: term, 'data-timetable-entry-id': `term-${term}` }, `Term ${term}`)));
}

const verifiedRuntimeContext = {
	activeSchoolYearId: 9, activeSchoolYearLabel: '2026-2027', schoolId: 7,
	source: 'enrollpro-verified', stale: false, cachedAt: new Date().toISOString(),
	activeTerm: { source: 'enrollpro-verified', reachable: true, verified: true, activeTerm: 'Term 2', termIndex: 2,
		schoolYearId: 9, matchedSchoolYear: true, code: null, message: 'Verified',
		orderedTerms: [{ identity: 'T1', displayLabel: 'Term 1', order: 1 }, { identity: 'T2', displayLabel: 'Term 2', order: 2 }] },
};
class MemoryStorage {
	private values = new Map<string, string>();
	getItem(key: string) { return this.values.get(key) ?? null; }
	setItem(key: string, value: string) { this.values.set(key, value); }
	removeItem(key: string) { this.values.delete(key); }
	clear() { this.values.clear(); }
}
const sessionStorageShim = new MemoryStorage();
const localStorageShim = new MemoryStorage();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageShim, configurable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageShim, configurable: true });
Object.defineProperty(globalThis, 'window', { value: {
	matchMedia: () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }),
	location: { href: 'http://localhost:5174/timetable' },
}, configurable: true });
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true, configurable: true });

type Snapshot = { termFilter: unknown; state: string };
function ProductionWorkspaceLifecycleProbe({ onSnapshot }: { onSnapshot: (snapshot: Snapshot) => void }) {
	const state = useScheduleReviewWorkspaceState();
	const [allMarkup, setAllMarkup] = useState<React.ReactNode>(null);
	const termFilter = state.headerContext?.termFilter ?? null;
	const setupState = termFilter === null ? 'setup-required' : 'ready';
	useEffect(() => {
		onSnapshot({ termFilter, state: setupState });
		if (termFilter === 'all') setAllMarkup(allTermsGrid());
	}, [setupState, termFilter]);
	return React.createElement('div', { 'data-testid': 'workspace-lifecycle', 'data-term': String(termFilter), 'data-state': setupState },
		React.createElement('button', { 'data-action': 'all-terms', onClick: () => state.headerContext?.onTermFilterChange?.('all') }, 'All terms'),
		termFilter === 'all' ? allMarkup : null);
}

function apiFixture(verified: boolean) {
	const calls: string[] = [];
	const get = async (url: string) => {
		calls.push(url);
		if (url === '/auth/me') return { data: { user: { schoolId: 7, role: 'admin' } } };
		if (url === '/runtime/context') return { data: verified ? verifiedRuntimeContext :
			{ ...verifiedRuntimeContext, activeTerm: { ...verifiedRuntimeContext.activeTerm, verified: false, termIndex: null, activeTerm: null, source: 'atlas-unverified', orderedTerms: [] } } };
		if (url.includes('/runs/41') || url.includes('/runs/latest')) return { data: { runId: 41, version: 1, entries: [], violations: [], summary: { unassignedCount: 0, hardViolationCount: 0, softViolationCount: 0 } } };
		if (url.includes('/runs')) return { data: { runs: [] } };
		if (url.includes('/pre-generation-drafts')) return { data: { counts: { draft: 0, placed: 0, unassigned: 0 }, items: [] } };
		if (url.includes('/readiness')) return { data: { readiness: { status: 'READY', blocking: [], warnings: [] } } };
		if (url.includes('/grade-windows')) return { data: { windows: [] } };
		if (url.includes('/policies/')) return { data: { policy: { teacherMoveEnabled: false } } };
		if (url.includes('/subjects')) return { data: { subjects: [] } };
		if (url.includes('/faculty')) return { data: { faculty: [] } };
		if (url.includes('/buildings')) return { data: { buildings: [] } };
		if (url.includes('/sections')) return { data: { sections: [], total: 0 } };
		if (url.includes('/room-preferences')) return { data: { counts: { pending: 0 }, requests: [] } };
		return { data: {} };
	};
	return { calls, get };
}
async function settle() { await new Promise((resolve) => setTimeout(resolve, 40)); }
async function mountLifecycle(verified: boolean, snapshots: Snapshot[]) {
	sessionStorageShim.clear(); localStorageShim.clear(); sessionStorageShim.setItem(ATLAS_LOCAL_TOKEN_KEY, 'eyJhbGciOiJub25lIn0.eyJzdWJqZWN0IjoiMSIsInNjaG9vbElkIjo3LCJyb2xlIjoiYWRtaW4ifQ.');
	invalidateActiveSchoolYearContext(7);
	const fixture = apiFixture(verified); const originalGet = (atlasApi as any).get; const originalRequest = (atlasApi as any).request;
	(atlasApi as any).get = fixture.get;
	(atlasApi as any).request = async (config: { url?: string }) => fixture.get((config.url ?? '').replace(/^\/api\/v1/, ''));
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	let renderer: ReactTestRenderer;
	renderer = create(React.createElement(QueryClientProvider, { client: queryClient },
		React.createElement(MemoryRouter, null, React.createElement(ProductionWorkspaceLifecycleProbe, { onSnapshot: (s) => snapshots.push(s) }))));
	await settle();
	return { fixture, renderer: renderer!, restore: () => { (atlasApi as any).get = originalGet; (atlasApi as any).request = originalRequest; queryClient.clear(); } };
}

test('real production hook lifecycle gates reads, defaults to verified T2, then permits deliberate All terms', async () => {
	const snapshots: Snapshot[] = []; const mounted = await mountLifecycle(true, snapshots);
	try {
		assert.ok(snapshots.some((snapshot) => snapshot.termFilter === 2));
		assert.ok(mounted.fixture.calls.some((url) => url.includes('/runs')));
		const button = mounted.renderer.root.findByProps({ 'data-action': 'all-terms' });
		await act(async () => { button.props.onClick(); }); await settle();
		assert.ok(snapshots.some((snapshot) => snapshot.termFilter === 'all'));
		const rendered = JSON.stringify(mounted.renderer.toJSON());
		assert.match(rendered, /term-1/); assert.match(rendered, /term-2/); assert.match(rendered, /term-3/);
		assert.doesNotMatch(rendered, /timetable-cell-overflow-trigger|timetable-cell-overflow-sheet/);
	} finally { mounted.restore(); }
});

test('real production hook remains bounded when term authority is missing', async () => {
	const snapshots: Snapshot[] = []; const mounted = await mountLifecycle(false, snapshots);
	try {
		assert.ok(snapshots.some((snapshot) => snapshot.state === 'setup-required'));
		assert.equal(mounted.fixture.calls.filter((url) => url.includes('/runs') || url.includes('/subjects') || url.includes('/faculty') || url.includes('/sections')).length, 0);
		assert.equal(snapshots.some((snapshot) => typeof snapshot.termFilter === 'number' || snapshot.termFilter === 'all'), false);
	} finally { mounted.restore(); }
});
