/**
 * S2 — scheduler concern workspace + D6 focused suite.
 *
 * Decisive paths:
 *  1. D6 mechanical no-dangling search over the whole client `src` tree.
 *  2. The real concern client functions against a recording transport (URL,
 *     method, body) with fail-closed scope and zero dispatch on rejection.
 *  3. Navigation/route-chrome truth for `/faculty/concerns` and `/my`.
 *  4. Notes/room-request round trip and the shared drift mapping delegation.
 *  5. AGENTS §8 structural constraints on the new surfaces.
 *
 * Run: `npm run test:scheduler-concern`
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
	TeacherConcernScopeError,
	assertConcernScopeId,
	availabilityRecordToPickerSlots,
	buildFacultyAvailabilityPath,
	fetchConcernFaculty,
	fetchFacultyAvailability,
	fetchLatestRunInputState,
	pickerSlotsToAvailability,
	reviewFacultyAvailability,
	saveFacultyAvailabilityDraft,
	submitFacultyAvailability,
	type ConcernTransport,
} from '../teacher-concern-client';
import {
	composeConcernNotes,
	parseConcernNotes,
	resolveConcernDriftView,
} from '../teacher-concern-helpers';
import { facultyNav, getVisibleNavigation, navigationNav, resolveRouteChrome } from '../../app-shell/navigation';
import { resolveNotificationRoute } from '../../../hooks/useNotificationInbox';
import { describeRunInputDrift } from '../../timetable/timetableDriftRouting';
import type { FacultyAvailabilityRecord, FacultyAvailabilitySlot, GenerationInputComparison } from '@/types';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = resolve(HERE, '../../../..');
const SRC_ROOT = join(CLIENT_ROOT, 'src');

function source(relativePath: string): string {
	return readFileSync(resolve(CLIENT_ROOT, relativePath), 'utf8');
}

function walkSource(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const absolute = join(dir, entry.name);
		if (entry.isDirectory()) walkSource(absolute, out);
		else if (/\.tsx?$/.test(entry.name)) out.push(absolute);
	}
	return out;
}

/* ───────────────────────── D6 — no dangling portal links ───────────────────────── */

test('D6: no removed teacher-portal path survives anywhere in client src', () => {
	const removedPattern = /\/my\/(?:schedule|preferences|room-preferences)/;
	const offenders: string[] = [];
	for (const file of walkSource(SRC_ROOT)) {
		if (removedPattern.test(readFileSync(file, 'utf8'))) {
			offenders.push(file.slice(CLIENT_ROOT.length + 1).replace(/\\/g, '/'));
		}
	}
	assert.deepEqual(offenders, [], `removed /my/* references remain:\n  ${offenders.join('\n  ')}`);
});

test('D6: the three retired page components are deleted and unregistered', () => {
	for (const page of ['src/pages/MySchedule.tsx', 'src/pages/FacultyPreferences.tsx', 'src/pages/FacultyRoomPreferences.tsx']) {
		assert.equal(existsSync(resolve(CLIENT_ROOT, page)), false, `${page} must be deleted`);
	}
	const app = source('src/App.tsx');
	assert.doesNotMatch(app, /MySchedule|FacultyPreferences|FacultyRoomPreferences/);
	assert.doesNotMatch(app, /path: 'my\/(?:schedule|preferences|room-preferences)'/);
});

test('D6: the surviving portal and scheduler review routes stay registered', () => {
	const app = source('src/App.tsx');
	assert.match(app, /path: 'my',\s*\n\s*element: <MyDashboard \/>/);
	assert.match(app, /path: 'faculty\/preferences',\s*\n\s*element: <OfficerPreferences \/>/);
	assert.match(app, /path: 'faculty\/room-preferences',\s*\n\s*element: <OfficerRoomPreferences \/>/);
	assert.match(app, /path: 'faculty\/concerns',\s*\n\s*element: <TeacherConcerns \/>/);
});

test('D6: notification deep links to the retired surfaces are inert, others preserved', () => {
	assert.equal(resolveNotificationRoute('preference', '9'), null);
	assert.equal(resolveNotificationRoute('room-request', '5'), null);
	assert.equal(resolveNotificationRoute('timetable', '12'), '/timetable?runId=12');
	assert.equal(resolveNotificationRoute('published-schedule', '7'), '/schedules?revision=7');
});

/* ───────────────────────── navigation + chrome ───────────────────────── */

test('faculty navigation is the single read-only /my dashboard', () => {
	assert.deepEqual(facultyNav.map((item) => item.to), ['/my']);
	assert.deepEqual(
		getVisibleNavigation({ role: 'faculty', capabilities: ['faculty:self-service'] }).map((item) => item.to),
		['/my'],
	);
});

test('the concern workspace has its own nav entry reachable to schedulers and admins', () => {
	const schedulerPaths = getVisibleNavigation({ role: 'scheduler', capabilities: ['timetable:read'] }).map((item) => item.to);
	assert.ok(schedulerPaths.includes('/faculty/concerns'), 'scheduler must see the concern workspace');
	assert.ok(getVisibleNavigation({ role: 'admin' }).map((item) => item.to).includes('/faculty/concerns'));
	assert.equal(navigationNav.length, 1);
});

test('the concern route resolves truthful chrome, not the ATLAS fallback', () => {
	const chrome = resolveRouteChrome('/faculty/concerns');
	assert.equal(chrome.title, 'Teacher Concerns');
	assert.equal(chrome.breadcrumbs.at(-1), 'Teacher Concerns');
	assert.equal(new Set(chrome.breadcrumbs).size, chrome.breadcrumbs.length);
});

/* ───────────────────────── the real client functions ───────────────────────── */

type RecordedCall = { method: string; url: string; data?: unknown; params?: Record<string, unknown> };

function recordingTransport(response: unknown, calls: RecordedCall[]): ConcernTransport {
	const transport = {
		get: async (url: string, config?: { params?: Record<string, unknown> }) => {
			calls.push(config?.params ? { method: 'get', url, params: config.params } : { method: 'get', url });
			return { data: response };
		},
		put: async (url: string, data?: unknown) => {
			calls.push({ method: 'put', url, data });
			return { data: response };
		},
		post: async (url: string, data?: unknown) => {
			calls.push({ method: 'post', url, data });
			return { data: response };
		},
		patch: async (url: string, data?: unknown) => {
			calls.push({ method: 'patch', url, data });
			return { data: response };
		},
	};
	return transport as unknown as ConcernTransport;
}

const RECORD: FacultyAvailabilityRecord = {
	id: 7,
	schoolId: 3,
	schoolYearId: 9,
	facultyId: 11,
	termIndex: 2,
	status: 'DRAFT',
	version: 4,
	notes: null,
	submittedAt: null,
	reviewedBy: null,
	reviewedAt: null,
	reviewerNotes: null,
	slots: [{ day: 'MONDAY', startTime: '08:00', endTime: '08:15', state: 'UNAVAILABLE' }],
};

test('fetchFacultyAvailability GETs the frozen path and returns the record or null', async () => {
	const calls: RecordedCall[] = [];
	const record = await fetchFacultyAvailability({ schoolId: 3, schoolYearId: 9, facultyId: 11 }, recordingTransport({ availability: RECORD }, calls));
	assert.equal(record?.version, 4);
	assert.deepEqual(calls, [{ method: 'get', url: '/faculty-availability/3/9/faculty/11' }]);

	const emptyCalls: RecordedCall[] = [];
	const empty = await fetchFacultyAvailability({ schoolId: 3, schoolYearId: 9, facultyId: 11 }, recordingTransport({ availability: null }, emptyCalls));
	assert.equal(empty, null);
});

test('saveFacultyAvailabilityDraft PUTs the explicit active term and composed payload', async () => {
	const calls: RecordedCall[] = [];
	const slots: FacultyAvailabilitySlot[] = [{ day: 'MONDAY', startTime: '08:00', endTime: '08:15', state: 'UNAVAILABLE' }];
	await saveFacultyAvailabilityDraft(
		{ schoolId: 3, schoolYearId: 9, facultyId: 11, termIndex: 2, slots, notes: 'note text', version: 4 },
		recordingTransport({ availability: RECORD }, calls),
	);
	assert.deepEqual(calls, [{
		method: 'put',
		url: '/faculty-availability/3/9/faculty/11',
		data: { termIndex: 2, slots, notes: 'note text', version: 4 },
	}]);
});

test('submitFacultyAvailability POSTs the submit path with the version CAS', async () => {
	const calls: RecordedCall[] = [];
	await submitFacultyAvailability(
		{ schoolId: 3, schoolYearId: 9, facultyId: 11, version: 4, slots: [], notes: null },
		recordingTransport({ availability: RECORD }, calls),
	);
	assert.deepEqual(calls, [{
		method: 'post',
		url: '/faculty-availability/3/9/faculty/11/submit',
		data: { version: 4, slots: [], notes: null },
	}]);
});

test('reviewFacultyAvailability PATCHes the review path and never invents a reviewer id', async () => {
	const calls: RecordedCall[] = [];
	await reviewFacultyAvailability(
		{ schoolId: 3, schoolYearId: 9, facultyId: 11, version: 4, decision: 'REVIEWED', reviewerNotes: 'ok' },
		recordingTransport({ availability: RECORD }, calls),
	);
	assert.deepEqual(calls, [{
		method: 'patch',
		url: '/faculty-availability/3/9/faculty/11/review',
		data: { version: 4, decision: 'REVIEWED', reviewerNotes: 'ok' },
	}]);
	const body = calls[0]?.data as Record<string, unknown>;
	assert.equal('reviewerId' in body, false, 'the server derives the reviewer from the session');
});

test('scope fails closed BEFORE any dispatch (no ?? 1 default)', async () => {
	const calls: RecordedCall[] = [];
	const transport = recordingTransport({ availability: null }, calls);
	await assert.rejects(
		() => fetchFacultyAvailability({ schoolId: 0, schoolYearId: 9, facultyId: 11 }, transport),
		TeacherConcernScopeError,
	);
	await assert.rejects(
		() => saveFacultyAvailabilityDraft({ schoolId: 3, schoolYearId: 9, facultyId: 11, termIndex: 0, slots: [], notes: null, version: null }, transport),
		TeacherConcernScopeError,
	);
	assert.deepEqual(calls, [], 'rejected scope must dispatch nothing');
	assert.throws(() => assertConcernScopeId(undefined, 'schoolId'), TeacherConcernScopeError);
	assert.equal(buildFacultyAvailabilityPath(3, 9, 11), '/faculty-availability/3/9/faculty/11');
});

test('fetchConcernFaculty scopes the roster and fetchLatestRunInputState reads the latest draft', async () => {
	const calls: RecordedCall[] = [];
	await fetchConcernFaculty(3, recordingTransport({ faculty: [{ id: 1 }] }, calls));
	assert.deepEqual(calls, [{ method: 'get', url: '/faculty', params: { schoolId: 3 } }]);

	const inputState = { status: 'STALE', message: 'x', actionHint: 'y', changedDomains: ['availability'], checkedAt: 'now' };
	const runCalls: RecordedCall[] = [];
	const result = await fetchLatestRunInputState(3, 9, recordingTransport({ inputState }, runCalls));
	assert.deepEqual(runCalls, [{ method: 'get', url: '/generation/3/9/runs/latest/draft' }]);
	assert.equal(result?.status, 'STALE');
});

/* ───────────────────────── notes + drift ───────────────────────── */

test('notes and room requests round-trip through the frozen single notes field', () => {
	const composed = composeConcernNotes('Needs morning prep time.', 'Move G7 Math to Room 204.');
	assert.ok(composed?.includes('[Notes for the scheduler]'));
	assert.ok(composed?.includes('[Room requests]'));
	assert.deepEqual(parseConcernNotes(composed), {
		notes: 'Needs morning prep time.',
		roomRequests: 'Move G7 Math to Room 204.',
	});
	assert.equal(composeConcernNotes('   ', '  '), null);
	assert.deepEqual(parseConcernNotes(null), { notes: '', roomRequests: '' });
	// A legacy free-text note is preserved verbatim as notes, never dropped.
	assert.deepEqual(parseConcernNotes('legacy free text'), { notes: 'legacy free text', roomRequests: '' });
	// Partial sections survive.
	assert.deepEqual(parseConcernNotes(composeConcernNotes('', 'only rooms')), { notes: '', roomRequests: 'only rooms' });
});

test('deriving the drift view delegates to the shared describeRunInputDrift', () => {
	const inputState = {
		status: 'STALE',
		message: 'Inputs changed',
		actionHint: 'Regenerate',
		changedDomains: ['availability'],
		checkedAt: '2026-09-25T00:00:00.000Z',
	} as unknown as GenerationInputComparison;
	const view = resolveConcernDriftView(inputState);
	const shared = describeRunInputDrift(inputState);
	assert.equal(view.drift.status, shared.status);
	assert.equal(view.drift.message, shared.message);
	assert.equal(view.drift.actionHint, shared.actionHint);
	assert.equal(view.drift.primaryHref, shared.primaryHref);
	assert.equal(view.availabilityChanged, true);
	assert.equal(view.regenerateHref, '/timetable');
	assert.equal(view.revisionHref, '/schedules');

	const fresh = resolveConcernDriftView({ ...inputState, status: 'FRESH', changedDomains: [] } as GenerationInputComparison);
	assert.equal(fresh.availabilityChanged, false);
	assert.equal(resolveConcernDriftView(null).drift.status, 'FRESH');
});

test('picker slots map to and from the frozen S1 slot shape', () => {
	const picker = availabilityRecordToPickerSlots(RECORD);
	assert.deepEqual(picker, [{ day: 'MONDAY', startTime: '08:00', endTime: '08:15', preference: 'UNAVAILABLE' }]);
	assert.deepEqual(pickerSlotsToAvailability(picker), [{ day: 'MONDAY', startTime: '08:00', endTime: '08:15', state: 'UNAVAILABLE' }]);
});

/* ───────────────────────── AGENTS §8 structural constraints ───────────────────────── */

test('the new concern React components stay under the 1000 physical-line cap', () => {
	for (const path of [
		'src/pages/TeacherConcerns.tsx',
		'src/components/faculty-shared/TeacherConcernWorkspace.tsx',
		'src/components/faculty-shared/RunAvailabilityDriftCard.tsx',
		'src/components/faculty-shared/AvailabilityPicker.tsx',
	]) {
		const lines = source(path).split('\n').length;
		assert.ok(lines <= 1000, `${path} is ${lines} lines (cap 1000)`);
	}
});

test('the new concern surfaces avoid raw select/details/title/button primitives', () => {
	for (const path of [
		'src/pages/TeacherConcerns.tsx',
		'src/components/faculty-shared/TeacherConcernWorkspace.tsx',
		'src/components/faculty-shared/RunAvailabilityDriftCard.tsx',
		'src/components/faculty-shared/AvailabilityPicker.tsx',
	]) {
		const text = source(path);
		assert.doesNotMatch(text, /<select\b/, `${path} must not use a native select`);
		assert.doesNotMatch(text, /<details\b/, `${path} must not use raw details`);
		assert.doesNotMatch(text, /title="/, `${path} must not use a raw title attribute`);
		assert.doesNotMatch(text, /<button[\s>]/, `${path} must not use a raw button`);
	}
});

test('the concern workspace consumes the read-only shared drift mapping without editing it', () => {
	const helper = source('src/components/faculty-shared/teacher-concern-helpers.ts');
	assert.match(helper, /import \{ describeRunInputDrift, type RunInputDrift \} from '@\/components\/timetable\/timetableDriftRouting'/);
	const routing = source('src/components/timetable/timetableDriftRouting.ts');
	assert.match(routing, /export function describeRunInputDrift/);
});
