/**
 * RR-TERM-CACHE-C01R — actor-school scope and lifecycle for the narrow
 * term-authority repair workflow.
 *
 * The client has no DOM testing library, so the pure scope/lifecycle decisions
 * are exercised directly, and production caller wiring is proven from the real
 * caller/component sources plus the `/auth/me` resolution path.
 *
 * Run (client workspace):
 *   `npx tsx --test src/lib/__tests__/term-authority-actor-scope.test.ts`
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { TermCachePreviewResult } from '@/lib/settings';
import {
	acceptTermRepairPreview,
	bindTermRepairPreview,
	initialTermRepairScopeState,
	isResolvedActorSchoolId,
	isTermRepairPreviewApplicable,
	isTermRepairPreviewStale,
	resetTermRepairForScope,
	type TermRepairScopeState,
} from '@/lib/term-authority-repair-scope';

function previewFor(schoolId: number): TermCachePreviewResult {
	return {
		schoolId,
		schoolYearId: 7001,
		yearLabel: '2030-2031',
		mirrorId: 5,
		state: 'READY',
		code: null,
		message: 'ready',
		format: 'TRIMESTER',
		terms: [{ identity: 'T1', displayLabel: 'First', order: 1, startDate: null, endDate: null }],
		liveSemanticRevision: 'a'.repeat(64),
		persistedSemanticRevision: null,
		cachedAt: null,
		activeTermAvailability: 'UNRESOLVED',
		fingerprint: 'f'.repeat(64),
		confirmationText: `SAVE_TERM_AUTHORITY_${schoolId}_7001`,
		zeroWrite: true,
	};
}

function scopeStateFor(schoolId: number): TermRepairScopeState {
	const bound = bindTermRepairPreview(initialTermRepairScopeState(), schoolId, previewFor(schoolId));
	return { ...bound, confirmationText: previewFor(schoolId).confirmationText };
}

test('unresolved actor school is never a valid dispatch scope', () => {
	assert.equal(isResolvedActorSchoolId(null), false);
	assert.equal(isResolvedActorSchoolId(undefined), false);
	assert.equal(isResolvedActorSchoolId(0), false);
	assert.equal(isResolvedActorSchoolId(-3), false);
	assert.equal(isResolvedActorSchoolId(1.5), false);
	assert.equal(isResolvedActorSchoolId('2'), false);
	assert.equal(isResolvedActorSchoolId(2), true);
});

test('scope change clears preview, confirmation, error, and pending apply', () => {
	const state: TermRepairScopeState = {
		scopeSchoolId: 1,
		dialogOpen: true,
		preview: previewFor(1),
		confirmationText: 'SAVE_TERM_AUTHORITY_1_7001',
		error: 'boom',
		applying: true,
	};
	const reset = resetTermRepairForScope(state, 2);
	assert.deepEqual(reset, initialTermRepairScopeState());
	assert.equal(reset.preview, null);
	assert.equal(reset.confirmationText, '');
	assert.equal(reset.error, null);
	assert.equal(reset.applying, false);
	assert.equal(reset.dialogOpen, false);
});

test('a preview is only applicable to the school that produced it', () => {
	const state = scopeStateFor(1);
	assert.equal(isTermRepairPreviewApplicable(state, 1, state.confirmationText), true);
	assert.equal(isTermRepairPreviewStale(state, 1), false);
	// Switching to school 2 without clearing: the school-1 preview is stale.
	assert.equal(isTermRepairPreviewStale(state, 2), true);
	assert.equal(isTermRepairPreviewApplicable(state, 2, state.confirmationText), false);
});

test('stale school-1 preview cannot apply after switching to school 2', () => {
	const school1 = scopeStateFor(1);
	const switched = resetTermRepairForScope(school1, 2);
	assert.equal(switched.preview, null);
	assert.equal(isTermRepairPreviewApplicable(switched, 2, 'SAVE_TERM_AUTHORITY_1_7001'), false);
	assert.equal(isTermRepairPreviewApplicable(switched, 2, switched.confirmationText), false);
});

test('a preview for an unresolved school can never be submitted', () => {
	const state = scopeStateFor(1);
	assert.equal(isTermRepairPreviewApplicable(state, 0, state.confirmationText), false);
	assert.equal(isTermRepairPreviewApplicable(state, Number.NaN, state.confirmationText), false);
	assert.equal(isTermRepairPreviewApplicable(state, 1, 'wrong confirmation'), false);
});

test('a late-arriving preview for a previous school is rejected', () => {
	assert.equal(acceptTermRepairPreview(2, 1), false, 'school changed while the preview was in flight');
	assert.equal(acceptTermRepairPreview(1, 1), true);
	assert.equal(acceptTermRepairPreview(null, 1), false);
});

test('term-authority wrappers no longer default to school 1', () => {
	const settings = readFileSync(new URL('../settings.ts', import.meta.url), 'utf8');
	for (const fn of ['previewTermCacheSync', 'applyTermCacheSync']) {
		const start = settings.indexOf(`export async function ${fn}(`);
		assert.ok(start > 0, `${fn} exists`);
		const signature = settings.slice(start, settings.indexOf(')', start));
		assert.doesNotMatch(signature, /=\s*1(?!\d)/, `${fn} must not default schoolId to 1`);
		assert.match(signature, /schoolId:\s*number/, `${fn} requires an explicit schoolId: number`);
	}
});

test('production callers pass an actor-scoped school, and omitted-prop callers use the fail-closed wrapper', () => {
	const cardPath = new URL('../../components/runtime/RolloverGuidanceCard.tsx', import.meta.url);
	const card = readFileSync(cardPath, 'utf8');
	assert.doesNotMatch(card, /schoolId\s*=\s*1(?!\d)/, 'card has no school-1 default');
	assert.match(card, /export function ActorScopedRolloverGuidanceCard/, 'fail-closed wrapper is exported');
	assert.ok(card.includes('resolveActorSchoolId()'), 'wrapper resolves the authenticated actor school from /auth/me');
	assert.ok(card.includes('resetTermRepairForScope'), 'card clears repair state on actor-school change');
	assert.ok(card.includes('acceptTermRepairPreview'), 'card drops late-arriving stale preview responses');
	assert.ok(card.includes('isTermRepairPreviewApplicable'), 'card gates submit on the current actor school');

	const dashboard = readFileSync(new URL('../../pages/Dashboard.tsx', import.meta.url), 'utf8');
	assert.ok(dashboard.includes('actorSchoolId'), 'Dashboard consumes the authenticated actor school');
	assert.match(dashboard, /<RolloverGuidanceCard compact schoolId=\{actorSchoolId\}/, 'Dashboard passes the explicit actor school');

	const scheduleReview = readFileSync(new URL('../../components/timetable/ScheduleReviewWorkspaceHeader.tsx', import.meta.url), 'utf8');
	assert.match(scheduleReview, /<RolloverGuidanceCard compact schoolId=\{schoolId\}/, 'Schedule Review passes its resolved school');

	const teachingLoad = readFileSync(new URL('../../pages/TeachingLoad.tsx', import.meta.url), 'utf8');
	assert.match(teachingLoad, /<RolloverGuidanceCard compact schoolId=\{data\.schoolId\}/, 'Teaching Load passes its actor school');

	const adminYearSetup = readFileSync(new URL('../../pages/AdminYearSetup.tsx', import.meta.url), 'utf8');
	assert.match(adminYearSetup, /<RolloverGuidanceCard[\s\S]*?schoolId=\{schoolId\}/, 'Admin Year Setup passes the authenticated school');

	for (const page of ['Sections', 'Faculty']) {
		const source = readFileSync(new URL(`../../pages/${page}.tsx`, import.meta.url), 'utf8');
		assert.ok(source.includes('ActorScopedRolloverGuidanceCard'), `${page} uses the fail-closed actor-scoped wrapper`);
		assert.equal(/<RolloverGuidanceCard\b/.test(source), false, `${page} must not render the base card without a school`);
	}
});
