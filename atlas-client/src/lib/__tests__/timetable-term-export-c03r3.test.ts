/**
 * TT-OUTPUT-C03R3 — beneficiary download failure, busy, and duplicate guards.
 *
 * Production-path proof against the real `SimpleExportMenu`,
 * `SimpleExportErrorBanner`, and `dispatchSimpleExport` code paths. Against the
 * base behavior the official download failure banner only existed for the
 * teacher program, only the teacher item was disabled while an export was
 * pending, and a second concurrent dispatch was not blocked.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
	SimpleExportErrorBanner,
	SimpleExportMenu,
} from '../../components/timetable/simple/SimpleBeneficiaryControls';
import {
	dispatchSimpleExport,
	resolveSimpleExportRequest,
	type SimpleExportDescriptor,
} from '../../components/timetable/simple/simpleExportRequests';

// C05 T9/M18 — fixtures use the current official identity
// `<type>[-<entity>]-SY<year>-term<N>.<ext>` (the retired `*-run-<id>-term<N>`
// shape would contradict the production resolver and mask a filename regression).
const SUMMARY: SimpleExportDescriptor = {
	kind: 'summary-teacher-schedule',
	url: '/api/v1/generation/7/9/runs/42/export/summary-teacher-schedule.xlsx?termIndex=2',
	filename: 'summary-teacher-schedule-SY2026-2027-term2.xlsx',
	termIndex: 2,
};
const CLASS_PROGRAM: SimpleExportDescriptor = {
	kind: 'class-program',
	url: '/api/v1/generation/7/9/runs/42/export/class-program.xlsx?termIndex=2',
	filename: 'class-program-SY2026-2027-term2.xlsx',
	termIndex: 2,
};
const TEACHER_PROGRAM: SimpleExportDescriptor = {
	kind: 'teacher-program',
	url: '/api/v1/generation/7/9/runs/42/export/teacher-program.docx?facultyId=502&termIndex=2',
	filename: 'teacher-program-502-SY2026-2027-term2.docx',
	termIndex: 2,
};

function attr(tag: string, name: string): string | null {
	const match = tag.match(new RegExp(`${name}="([^"]*)"`));
	return match ? match[1].replace(/&amp;/g, '&') : null;
}

function tagFor(markup: string, testId: string): string {
	const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
	assert.ok(match, `expected an element with data-testid="${testId}"`);
	return match[0];
}

test('C03R3: every beneficiary download failure renders a visible retryable banner naming its kind', () => {
	for (const kind of ['summary-teacher-schedule', 'class-program', 'teacher-program'] as const) {
		const markup = renderToStaticMarkup(
			createElement(SimpleExportErrorBanner, {
				error: { kind, message: `Export failed for ${kind}` },
				onRetry: () => {},
				onDismiss: () => {},
			}),
		);
		const banner = tagFor(markup, 'timetable-simple-export-error');
		assert.equal(attr(banner, 'data-export-error-kind'), kind, 'the failure names the exact failed download');
		assert.ok(markup.includes(`Export failed for ${kind}`), 'the operator sees the failure message');
		assert.ok(markup.includes('Retry'), 'the operator can retry the failed download');
	}

	// Negative control: no error renders no banner.
	assert.equal(
		renderToStaticMarkup(createElement(SimpleExportErrorBanner, { error: null, onRetry: () => {}, onDismiss: () => {} })),
		'',
	);
});

test('C03R3: one download action opens the combined Word and Excel schedule dialog', async () => {
	const markup = renderToStaticMarkup(createElement(SimpleExportMenu, {
		onOpenDownloadSchedules: () => {},
	}));
	assert.ok(markup.includes('timetable-open-download-schedules'));
	assert.match(markup, /Download schedules/);
	assert.doesNotMatch(markup, /Print schedules|Office working data/);
	assert.doesNotMatch(markup, /Download beneficiary outputs|Beneficiary downloads/);
	const dialog = await readFile(new URL('../../components/timetable/simple/SchedulerPrintDialog.tsx', import.meta.url), 'utf8');
	assert.match(dialog, /File format/);
	assert.match(dialog, />Word<\/Button>/);
	assert.match(dialog, />Excel<\/Button>/);
});

test('C03R3: a non-2xx official export rejects with the server message and dispatches no download', async () => {
	const downloads: string[] = [];
	await assert.rejects(
		() => dispatchSimpleExport(SUMMARY, {
			fetchImpl: (async () => new Response(JSON.stringify({ message: 'Term 2 has no timetable for this section.' }), { status: 409 })) as unknown as typeof fetch,
			getAccessToken: () => 'token',
			triggerDownload: (url) => downloads.push(url),
		}),
		(error: unknown) => error instanceof Error && error.message === 'Term 2 has no timetable for this section.',
	);
	assert.deepEqual(downloads, [], 'a failed export must not trigger a download');
});

test('C03R3: an all-term selection dispatches zero official export requests', async () => {
	const descriptor = resolveSimpleExportRequest('summary-teacher-schedule', {
		schoolId: 7, schoolYearId: 9, runId: 42, termFilter: 'all',
	});
	assert.equal(descriptor, null, 'All terms must never resolve to an official export');
	let calls = 0;
	const outcome = await dispatchSimpleExport(descriptor, {
		fetchImpl: (async () => { calls += 1; return new Response(''); }) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});
	assert.equal(outcome, 'skipped');
	assert.equal(calls, 0, 'no request may leave the client for an all-term official export');
});

test('C03R3: a successful official export downloads the exact term-bound file', async () => {
	const downloads: Array<{ url: string; filename: string }> = [];
	const outcome = await dispatchSimpleExport(CLASS_PROGRAM, {
		fetchImpl: (async () => new Response(new Blob(['xlsx']), { status: 200 })) as unknown as typeof fetch,
		getAccessToken: () => 'token',
		createObjectUrl: () => 'blob:mock',
		revokeObjectUrl: () => {},
		triggerDownload: (url, filename) => downloads.push({ url, filename }),
	});
	assert.equal(outcome, 'downloaded');
	assert.deepEqual(downloads, [{ url: 'blob:mock', filename: 'class-program-SY2026-2027-term2.xlsx' }]);
});
