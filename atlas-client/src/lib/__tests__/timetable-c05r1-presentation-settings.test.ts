/**
 * BENEFICIARY-EXPORT-PARITY-C05R1 — client export-presentation settings
 * contract (packet section D).
 *
 * Proves the real client API module against a fake transport: scoped URL
 * building, zero dispatch while the scope is unresolved, typed stale/validation
 * errors, and the optimistic revision (CAS) save body. Also proves the editor
 * is reachable from the Simple Timetable download area and uses shadcn/Radix
 * controls.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SimpleExportMenu } from '../../components/timetable/simple/SimpleBeneficiaryControls';
import {
	ExportPresentationError,
	exportPresentationPreviewUrl,
	exportPresentationUrl,
	fetchExportPresentationProfile,
	previewExportPresentationSettings,
	saveExportPresentationSettings,
	toExportPresentationInput,
} from '../../components/timetable/simple/exportPresentationApi';

const clientRoot = resolve(import.meta.dirname, '../../..');

function source(relativePath: string): string {
	return readFileSync(resolve(clientRoot, relativePath), 'utf8');
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const PROFILE = {
	revision: 3,
	schoolHead: { name: 'JUDY ANN B. NONATO', title: 'School Head' },
	psds: { name: null, title: 'Public School District Supervisor' },
	cidChief: { name: null, title: 'Chief – Curriculum Implementation Division' },
	asds: { name: null, title: 'Assistant Schools Division Superintendent' },
	footerText: 'For every learner, we rise!',
};

test('the settings URLs are actor-school/year scoped', () => {
	assert.equal(exportPresentationUrl(7, 9), '/api/v1/export-presentation/7/9');
	assert.equal(exportPresentationPreviewUrl(7, 9), '/api/v1/export-presentation/7/9/preview');
});

test('an unresolved scope dispatches zero requests', async () => {
	let calls = 0;
	const fetchImpl = (async () => { calls += 1; return jsonResponse({ data: PROFILE }); }) as unknown as typeof fetch;
	await assert.rejects(() => fetchExportPresentationProfile(0, 9, { fetchImpl }), (error: unknown) =>
		error instanceof ExportPresentationError && error.code === 'SCOPE_REQUIRED');
	await assert.rejects(() => fetchExportPresentationProfile(7, 0, { fetchImpl }), (error: unknown) =>
		error instanceof ExportPresentationError && error.code === 'SCOPE_REQUIRED');
	assert.equal(calls, 0, 'an unresolved scope never dispatches');
});

test('the passive read loads the effective profile without a write', async () => {
	const seen: Array<{ url: string; method: string }> = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		seen.push({ url: String(input), method: init?.method ?? 'GET' });
		return jsonResponse({ data: PROFILE });
	}) as unknown as typeof fetch;

	const profile = await fetchExportPresentationProfile(7, 9, { fetchImpl, getAccessToken: () => 'token' });
	assert.equal(profile.revision, 3);
	assert.equal(profile.schoolHead.name, 'JUDY ANN B. NONATO');
	assert.deepEqual(seen, [{ url: '/api/v1/export-presentation/7/9', method: 'GET' }]);
	assert.deepEqual(toExportPresentationInput(profile), {
		schoolHeadName: 'JUDY ANN B. NONATO',
		schoolHeadTitle: 'School Head',
		psdsName: '',
		psdsTitle: 'Public School District Supervisor',
		cidChiefName: '',
		cidChiefTitle: 'Chief – Curriculum Implementation Division',
		asdsName: '',
		asdsTitle: 'Assistant Schools Division Superintendent',
		footerText: 'For every learner, we rise!',
		officialSchoolName: '',
		headerLine: '',
		regionLine: '',
		divisionLine: '',
		districtLine: '',
	});
});

test('preview posts the payload without persisting', async () => {
	let body: unknown = null;
	const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
		body = JSON.parse(String(init?.body));
		return jsonResponse({ data: { profile: PROFILE, currentRevision: 3 } });
	}) as unknown as typeof fetch;

	const result = await previewExportPresentationSettings(7, 9, { schoolHeadName: 'x' }, { fetchImpl, getAccessToken: () => 't' });
	assert.equal(result.currentRevision, 3);
	assert.deepEqual(body, { profile: { schoolHeadName: 'x' } });
});

test('save sends expectedRevision and the profile under PUT', async () => {
	const seen: Array<{ url: string; method: string; body: unknown }> = [];
	const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
		seen.push({ url: String(input), method: init?.method ?? 'GET', body: JSON.parse(String(init?.body)) });
		return jsonResponse({ data: { revision: 4, replayed: false, auditId: 77, profile: { ...PROFILE, revision: 4 } } });
	}) as unknown as typeof fetch;

	const result = await saveExportPresentationSettings(7, 9, 3, { schoolHeadName: 'NEW' }, { fetchImpl, getAccessToken: () => 't' });
	assert.equal(result.revision, 4);
	assert.equal(result.auditId, 77);
	assert.deepEqual(seen, [{
		url: '/api/v1/export-presentation/7/9',
		method: 'PUT',
		body: { expectedRevision: 3, profile: { schoolHeadName: 'NEW' } },
	}]);
});

test('a stale revision surfaces the typed CAS error', async () => {
	const fetchImpl = (async () => jsonResponse({ code: 'PRESENTATION_PROFILE_STALE', message: 'changed' }, 409)) as unknown as typeof fetch;
	await assert.rejects(
		() => saveExportPresentationSettings(7, 9, 1, {}, { fetchImpl, getAccessToken: () => 't' }),
		(error: unknown) => error instanceof ExportPresentationError && error.code === 'PRESENTATION_PROFILE_STALE' && error.status === 409,
	);
});

test('the editor is reachable from the official print panel', () => {
	const html = renderToStaticMarkup(createElement(SimpleExportMenu, {
		onOpenDownloadSchedules: () => {},
	}));
	assert.match(html, /Download schedules/);
	const printDialog = source('src/components/timetable/simple/SchedulerPrintDialog.tsx');
	assert.match(printDialog, /Header and signatories/);
	assert.match(printDialog, /onOpenPresentationSettings/);
	const header = source('src/components/timetable/TimetableSimpleHeader.tsx');
	assert.match(header, /ExportPresentationSettingsDialog/, 'the header renders the editor');
	assert.match(header, /onOpenPresentationSettings=\{\(\) => setPresentationSettingsOpen\(true\)\}/, 'the print panel opens the editor');
	assert.match(header, /schoolId=\{context\.schoolId\}/, 'the editor is bound to the resolved school');
	assert.match(header, /schoolYearId=\{context\.schoolYearId\}/, 'the editor is bound to the resolved school year');
});

test('the editor uses shadcn/Radix controls and no raw inputs', () => {
	const editor = source('src/components/timetable/simple/ExportPresentationSettingsDialog.tsx');
	assert.match(editor, /from '@\/ui\/dialog'/, 'the editor uses the shadcn dialog primitives');
	assert.match(editor, /from '@\/ui\/input'/, 'the editor uses the shadcn input primitive');
	assert.match(editor, /from '@\/ui\/label'/, 'the editor uses the shadcn label primitive');
	assert.match(editor, /expectedRevision/, 'the save binds the optimistic revision');
	assert.doesNotMatch(editor, /<select\b/, 'no raw native select is introduced');
});
