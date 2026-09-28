import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { remainingCapacityMinutesForLoadProfile } from '@/lib/faculty-assignment-helpers';
import type { LoadProfile } from '@/types';

/**
 * CLIENT-QUALITY-C01 regression controls for the two defects that reached the
 * deployed release with no gate objecting:
 *
 *  1. `/timetable` React #310 — `armSwapSessions` (a hook) was declared after
 *     the component's early returns, so the loading -> loaded transition
 *     rendered a different number of hooks than the previous render.
 *  2. `Cannot read properties of null (reading 'remainingHours')` — a
 *     null-typed workload profile was typed `any` and dereferenced.
 *
 * No DOM renderer (jsdom/happy-dom/react-test-renderer) is available in this
 * repository's dependency tree, and this lane may not install packages, so the
 * same-instance render transition is proven by the live route-smoke spec
 * (`qa-artifacts/playwright/specs/client-route-smoke.spec.ts`), which fails on
 * the deployed build with the real React #310. This file holds the hermetic
 * static/behavioural controls so the defect cannot silently return.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../..');

function clientSource(relativePath: string): string {
	return readFileSync(resolve(CLIENT_ROOT, relativePath), 'utf8');
}

/* ================================================================== *
 * #310 — no React hook may be declared after the first early return
 * ================================================================== */

test('#310 ScheduleReviewWorkspace declares every top-level hook before its first early return', () => {
	const source = clientSource('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const lines = source.split('\n');

	const componentStart = lines.findIndex((line) => /export default function ScheduleReviewWorkspace\(/.test(line));
	assert.ok(componentStart >= 0, 'the workspace component must exist');

	// The component body is indented with exactly one tab. Only one-tab `if (`
	// lines are the component-level early returns (nested `if`s are deeper).
	const firstEarlyReturn = lines.findIndex((line, index) => index > componentStart && /^\tif \(/.test(line));
	assert.ok(firstEarlyReturn > componentStart, 'the component must keep its early returns');

	const hooks: Array<{ line: number; text: string }> = [];
	for (let index = componentStart + 1; index < firstEarlyReturn; index += 1) {
		if (/^\t(?:const|let|var)\s+\w+\s*=\s*(use[A-Z]\w*)\(/.test(lines[index])) {
			hooks.push({ line: index + 1, text: lines[index].trim() });
		}
	}
	assert.ok(hooks.length > 0, 'the component must declare React hooks');

	// The original defect: `armSwapSessions` lived after the early returns.
	const afterEarlyReturn: string[] = [];
	for (let index = firstEarlyReturn; index < lines.length; index += 1) {
		if (/^\t(?:const|let|var)\s+armSwapSessions\s*=\s*useCallback\(/.test(lines[index])) {
			afterEarlyReturn.push(`${index + 1}: ${lines[index].trim()}`);
		}
		if (/^\t(?:const|let|var)\s+\w+\s*=\s*(use[A-Z]\w*)\(/.test(lines[index])) {
			afterEarlyReturn.push(`${index + 1}: ${lines[index].trim()}`);
		}
	}
	assert.deepEqual(
		afterEarlyReturn,
		[],
		`every component-level React hook must precede the first early return (line ${firstEarlyReturn + 1}); offenders: ${afterEarlyReturn.join(' | ')}`,
	);
});

test('#310 armSwapSessions is an unconditional hook declared before the loading/error/context returns', () => {
	const source = clientSource('src/components/timetable/ScheduleReviewWorkspace.tsx');
	const hookIndex = source.indexOf('\n\tconst armSwapSessions = useCallback(');
	// Match the real one-tab code line, not the explanatory comment that quotes
	// the same predicate.
	const loadingReturnMatch = source.match(/\n\tif \(state\.loading && !state\.draft\)/);
	const loadingReturnIndex = loadingReturnMatch?.index ?? -1;
	assert.ok(hookIndex >= 0, 'armSwapSessions must remain a useCallback hook');
	assert.ok(loadingReturnIndex >= 0, 'the loading early return must remain');
	assert.ok(
		hookIndex < loadingReturnIndex,
		'the swap-arming hook must be declared before the loading early return or React throws #310',
	);
});

/* ================================================================== *
 * remainingHours — the null workload profile must never be dereferenced
 * ================================================================== */

test('remaining capacity is null-safe for an unresolved workload profile', () => {
	// Pre-fix, this dereferenced `loadProfile.remainingHours` and threw
	// `Cannot read properties of null (reading 'remainingHours')`.
	assert.equal(remainingCapacityMinutesForLoadProfile(null), 0);
	assert.equal(remainingCapacityMinutesForLoadProfile(undefined as unknown as LoadProfile | null), 0);

	const profile: LoadProfile = {
		actualTeachingHours: 0,
		rawTeachingHours: 0,
		rotationOvercountHours: 0,
		equivalentHours: 0,
		creditedTotalHours: 0,
		overloadHours: 0,
		overCapHours: 0,
		remainingHours: 5,
		status: 'below-standard',
		statusLabel: 'Below standard',
		rotationFamilies: [],
		breakdown: [],
	};
	assert.equal(remainingCapacityMinutesForLoadProfile(profile), 300);
});

test('TeacherGridMode types loadProfile as nullable and never dereferences it directly', () => {
	const source = clientSource('src/components/faculty-assignments/TeacherGridMode.tsx');
	assert.match(source, /loadProfile: LoadProfile \| null;/);
	assert.doesNotMatch(source, /loadProfile\.remainingHours/);
	assert.match(source, /remainingCapacityMinutesForLoadProfile\(loadProfile\)/);
});

test('WorkloadInspector guards remainingHours on the nullable profile', () => {
	const source = clientSource('src/components/faculty-assignments/WorkloadInspector.tsx');
	assert.match(source, /loadProfile\?\.remainingHours\?\.toFixed\(1\) \?\? '0\.0'/);
});

/* ================================================================== *
 * In-page archived Teaching Load reachability
 * ================================================================== */

test('Teaching Load exposes the archived surface from within the page', () => {
	const source = clientSource('src/pages/TeachingLoad.tsx');
	assert.match(source, /data-testid="teaching-load-history-link"/);
	/*
	 * SUPERSEDED BY A6 C2 — as a COPY claim only, and only its second line.
	 *
	 *   assert.match(source, /<Link to="\/teaching-load\/history">/);
	 *
	 * A6 C2 (Major 1) moved the `Archived load` control off header row 2 and into
	 * the toolbar's More menu, and the page now writes its test id alongside the
	 * `to` attribute — so the literal no longer reads `<Link to="…">` with the
	 * bracket immediately after. The CLAIM the assertion protected — the archived
	 * surface is reachable from within the Teaching Load page, as a real link, not
	 * a handler or a comment — is unchanged, and the replacement below is
	 * STRICTLY STRONGER: it requires both attributes on the SAME `Link`, and it
	 * additionally requires the control to be handed to the header action group
	 * (so "reachable" means "rendered in the header", not merely "present in a
	 * file"). Nothing about the destination changed.
	 */
	assert.match(
		source,
		/<Link\s+to="\/teaching-load\/history"[^>]*data-testid="teaching-load-history-link"/,
		'the archived Teaching Load link must be ONE real link carrying both its destination and its test id',
	);
	assert.match(
		source,
		/historyAction=\{/,
		'the link must be handed to the header action group, which owns its position (A6 C2)',
	);
});
