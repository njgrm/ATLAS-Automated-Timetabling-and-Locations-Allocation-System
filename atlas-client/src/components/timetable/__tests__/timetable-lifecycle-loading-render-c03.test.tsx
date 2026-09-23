import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import { act, createElement, Fragment, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
	url: 'http://localhost/timetable/pre-generation',
});
Object.assign(globalThis, {
	window: dom.window,
	document: dom.window.document,
	HTMLElement: dom.window.HTMLElement,
	MutationObserver: dom.window.MutationObserver,
	IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

let centerView = 'schedule';
let guardedTransitions = 0;
let navigateRoute: ((path: string) => void) | null = null;
let setRenderedCenterView: ((view: string) => void) | null = null;
let root: Root | null = null;

const workspaceState = {
	loading: true,
	draft: null,
	error: null,
	headerContext: {
		get centerView() { return centerView; },
		schoolId: 17,
		termFilter: 2,
		switchCenterViewWithGuard(action: () => void) {
			guardedTransitions += 1;
			action();
		},
		enterPolicyView: () => { centerView = 'policy'; setRenderedCenterView?.(centerView); },
		exitPolicyView: () => { centerView = 'schedule'; setRenderedCenterView?.(centerView); },
	},
	centerWorkspaceContext: {
		setCenterView: (view: string) => { centerView = view; setRenderedCenterView?.(view); },
	},
	dialogContext: { showLeavePreGenDialog: false },
	setLeftTab: () => undefined,
};

const hookUrl = import.meta.resolve('@/hooks/useScheduleReviewWorkspaceState');
mock.module(hookUrl, {
	namedExports: { useScheduleReviewWorkspaceState: () => workspaceState },
});

const { default: ScheduleReviewWorkspace } = await import('../ScheduleReviewWorkspace');

function RouteDriver() {
	const navigate = useNavigate();
	useEffect(() => { navigateRoute = navigate; }, [navigate]);
	return null;
}

function MountedWorkspace() {
	const [view, setView] = useState('schedule');
	centerView = view;
	setRenderedCenterView = setView;
	return createElement(MemoryRouter, { initialEntries: ['/timetable/pre-generation'] },
		createElement(Fragment, null,
			createElement(RouteDriver),
			createElement('div', { 'data-testid': 'actual-center-view' }, view),
			createElement(ScheduleReviewWorkspace),
		),
	);
}

after(async () => {
	if (root) await act(async () => { root?.unmount(); });
	dom.window.close();
	mock.restoreAll();
});

test('loading production workspace reconciles guarded direct route intent and keeps route-specific loading bounded', async () => {
	const container = document.getElementById('root');
	assert.ok(container);
	root = createRoot(container);
	await act(async () => { root?.render(createElement(MountedWorkspace)); });

	assert.equal(centerView, 'pre-generation', 'the mounted workspace must run guarded route synchronization before returning for loading');
	assert.equal(guardedTransitions, 1, 'the route must pass through the existing unsaved-change guard');
	assert.match(container.textContent ?? '', /Draft queue/);
	assert.match(container.textContent ?? '', /Loading this view…/);
	assert.match(container.querySelector('[data-testid="timetable-route-loading-state"]')?.className ?? '', /h-\[calc\(100svh-3\.5rem\)\]/,
		'the route-specific loading surface must retain its bounded viewport shell');
	assert.equal(container.querySelector('[data-testid="actual-center-view"]')?.textContent, 'pre-generation');

	for (const [path, view] of [
		['/timetable/setup', 'setup'],
		['/timetable/policies', 'policy'],
		['/timetable/runs', 'runs'],
		['/timetable/exports', 'exports'],
	] as const) {
		assert.ok(navigateRoute);
		await act(async () => { navigateRoute?.(path); });
		assert.equal(centerView, view, `${path} must reconcile while draft is null and loading is true`);
		assert.equal(container.querySelector('[data-testid="actual-center-view"]')?.textContent, view);
		assert.match(container.textContent ?? '', /Loading this view…/);
	}
});
