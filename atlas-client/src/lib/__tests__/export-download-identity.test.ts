/**
 * EXPORT-FILENAME-FIX — server-authoritative download identity.
 *
 * Production-path proof against the real `dispatchSimpleExport` funnel used by
 * the Simple Timetable header and the RoomSchedules room program, plus the
 * shared `export-download` helpers. The operator defect: the client discarded
 * the server `Content-Disposition` and downloaded under a diverging/generic
 * name, so a valid OOXML payload could not be opened.
 *
 * Negative control: on the old behavior (client name only, no header parsing)
 * the header-driven assertions below fail because the server name would be
 * ignored, and an extension-less fallback would ship without an extension.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
	dispatchSimpleExport,
	resolveSimpleExportRequest,
	type SimpleExportDescriptor,
} from '../../components/timetable/simple/simpleExportRequests';
import {
	ensureFilenameExtension,
	extensionOf,
	mimeTypeForFilename,
	parseContentDispositionFilename,
	resolveDownloadFilename,
	withExportMimeType,
} from '../export-download';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CLASS_PROGRAM: SimpleExportDescriptor = {
	kind: 'class-program',
	url: '/api/v1/generation/1/9/runs/314/export/class-program.xlsx?termIndex=1',
	filename: 'class-program-SY2031-2032-term1.xlsx',
	termIndex: 1,
};

const TEACHER_PROGRAM: SimpleExportDescriptor = {
	kind: 'teacher-program',
	url: '/api/v1/generation/1/9/runs/314/export/teacher-program.docx?facultyId=7&termIndex=1',
	filename: 'teacher-program-7-SY2031-2032-term1.docx',
	termIndex: 1,
};

/** Captures the exact (objectUrl, filename) the production funnel resolves. */
function capturingDispatchDeps() {
	const downloads: Array<{ url: string; filename: string }> = [];
	const blobs: Blob[] = [];
	return {
		downloads,
		blobs,
		deps: {
			createObjectUrl: () => 'blob:captured',
			revokeObjectUrl: () => {},
			triggerDownload: (url: string, filename: string) => downloads.push({ url, filename }),
		},
	};
}

function responseWith(disposition: string | null, body = 'ooxml-bytes'): Response {
	const headers = new Headers();
	if (disposition !== null) headers.set('Content-Disposition', disposition);
	return new Response(new Blob([body], { type: XLSX_MIME }), { status: 200, headers });
}

// ─── (a) `filename="…"` is honoured verbatim ───

test('a quoted Content-Disposition filename becomes the exact download name', async () => {
	const { downloads, deps } = capturingDispatchDeps();
	const response = responseWith('attachment; filename="class-program-SY2031-2032-term1.xlsx"');
	const outcome = await dispatchSimpleExport(CLASS_PROGRAM, {
		...deps,
		fetchImpl: (async () => response) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});

	assert.equal(outcome, 'downloaded');
	assert.deepEqual(downloads, [
		{ url: 'blob:captured', filename: 'class-program-SY2031-2032-term1.xlsx' },
	], 'the server filename must win over the client mirror');
});

test('a server filename that differs from the client mirror still wins', async () => {
	// The client context carried a stale/absent label (`SY-UNLABELED`); the
	// server knows the persisted year. The server identity must be used.
	const staleMirror: SimpleExportDescriptor = {
		...CLASS_PROGRAM,
		filename: 'class-program-SY-UNLABELED-term1.xlsx',
	};
	const { downloads, deps } = capturingDispatchDeps();
	await dispatchSimpleExport(staleMirror, {
		...deps,
		fetchImpl: (async () => responseWith('attachment; filename="class-program-SY2031-2032-term1.xlsx"')) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});
	assert.equal(downloads[0]?.filename, 'class-program-SY2031-2032-term1.xlsx');
});

test('every live-verified server header resolves to its exact download name', () => {
	// The four headers captured live on run #314 (published).
	const liveHeaders: Array<[string, string]> = [
		['/api/v1/generation/1/9/runs/314/export/summary-teacher-schedule.xlsx?termIndex=1', 'summary-teacher-schedule-SY2031-2032-term1.xlsx'],
		['/api/v1/generation/1/9/runs/314/export/class-program.xlsx?termIndex=1', 'class-program-SY2031-2032-term1.xlsx'],
		['/api/v1/generation/1/9/runs/314/export/room-program.xlsx?termIndex=1', 'room-program-ALL-SY2031-2032-term1.xlsx'],
		['/api/v1/generation/1/9/runs/314/export/teacher-program.docx?facultyId=1&termIndex=1', 'teacher-program-1-SY2031-2032-term1.docx'],
	];
	for (const [url, serverName] of liveHeaders) {
		const filename = resolveDownloadFilename(
			new Response('', { headers: { 'Content-Disposition': `attachment; filename="${serverName}"` } }),
			'client-fallback.xlsx',
		);
		assert.equal(filename, serverName, `${url} downloads under the server identity`);
		assert.equal(
			ensureFilenameExtension(filename, url),
			serverName,
			`${url} keeps its authoritative extension`,
		);
	}
});

// ─── (b) RFC 5987 `filename*=UTF-8''…` is handled ───

test('an RFC 5987 filename* value is percent-decoded and preferred', () => {
	assert.equal(
		parseContentDispositionFilename("attachment; filename*=UTF-8''class-program-SY2031-2032-term1.xlsx"),
		'class-program-SY2031-2032-term1.xlsx',
	);
	assert.equal(
		parseContentDispositionFilename("attachment; filename*=UTF-8''teacher-program-caf%C3%A9-SY2031-2032-term1.docx"),
		'teacher-program-café-SY2031-2032-term1.docx',
	);
	// filename* wins when both forms are present.
	assert.equal(
		parseContentDispositionFilename(
			"attachment; filename=\"legacy-name.xlsx\"; filename*=UTF-8''preferred-name.xlsx",
		),
		'preferred-name.xlsx',
	);
});

test('a filename* download reaches the matcher decoded', async () => {
	const { downloads, deps } = capturingDispatchDeps();
	await dispatchSimpleExport(TEACHER_PROGRAM, {
		...deps,
		fetchImpl: (async () => responseWith("attachment; filename*=UTF-8''teacher-program-7-SY2031-2032-term1.docx")) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});
	assert.equal(downloads[0]?.filename, 'teacher-program-7-SY2031-2032-term1.docx');
});

// ─── (c) missing header falls back to a year+extension name ───

test('a missing header falls back to the client name with year and extension', async () => {
	const { downloads, deps } = capturingDispatchDeps();
	await dispatchSimpleExport(CLASS_PROGRAM, {
		...deps,
		fetchImpl: (async () => responseWith(null)) as unknown as typeof fetch,
		getAccessToken: () => 'token',
	});
	const filename = downloads[0]?.filename ?? '';
	assert.equal(filename, 'class-program-SY2031-2032-term1.xlsx');
	assert.match(filename, /SY2031-2032/, 'the fallback keeps the school year');
	assert.match(filename, /\.xlsx$/, 'the fallback keeps the correct extension');
});

test('negative control: an extension-less fallback is repaired from the request URL', () => {
	// The old generic name and the bare `download` default both fail this control.
	const repaired = ensureFilenameExtension('class-program', CLASS_PROGRAM.url);
	assert.equal(repaired, 'class-program.xlsx');
	assert.notEqual(repaired, 'class-program');
	assert.notEqual(repaired, 'download');

	// A wrong extension is replaced by the authoritative one.
	assert.equal(
		ensureFilenameExtension('class-program-SY2031-2032-term1.csv', CLASS_PROGRAM.url),
		'class-program-SY2031-2032-term1.xlsx',
	);
	// An already-correct name is untouched.
	assert.equal(
		ensureFilenameExtension('class-program-SY2031-2032-term1.xlsx', CLASS_PROGRAM.url),
		'class-program-SY2031-2032-term1.xlsx',
	);
	// The teacher program keeps its own authoritative extension.
	assert.equal(
		ensureFilenameExtension('teacher-program-7', TEACHER_PROGRAM.url),
		'teacher-program-7.docx',
	);
});

test('resolveDownloadFilename prefers the header and degrades safely', () => {
	assert.equal(
		resolveDownloadFilename(
			new Response('', { headers: { 'Content-Disposition': 'attachment; filename="server-name.xlsx"' } }),
			'fallback.xlsx',
		),
		'server-name.xlsx',
	);
	assert.equal(
		resolveDownloadFilename({ headers: { get: () => null } } as unknown as Response, 'fallback.xlsx'),
		'fallback.xlsx',
	);
	// A malformed/empty header never blanks the name.
	assert.equal(
		resolveDownloadFilename({ headers: { get: () => 'attachment' } } as unknown as Response, 'fallback.xlsx'),
		'fallback.xlsx',
	);
	// Header path traversal is collapsed to a single safe segment.
	assert.equal(
		parseContentDispositionFilename('attachment; filename="..\\evil\\payload.xlsx"'),
		'payload.xlsx',
	);
});

// ─── (d) the blob MIME type matches the export kind ───

test('the blob MIME type matches the export kind', async () => {
	for (const [descriptor, expected] of [
		[CLASS_PROGRAM, XLSX_MIME],
		[TEACHER_PROGRAM, DOCX_MIME],
	] as const) {
		let observedType = '';
		await dispatchSimpleExport(descriptor, {
			// Server sent a generic type: the client must derive it from the name.
			fetchImpl: (async () => new Response(new Blob(['bytes'], { type: 'application/octet-stream' }), { status: 200 })) as unknown as typeof fetch,
			getAccessToken: () => 'token',
			createObjectUrl: (blob) => { observedType = blob.type; return 'blob:mime'; },
			revokeObjectUrl: () => {},
			triggerDownload: () => {},
		});
		assert.equal(observedType, expected, `${descriptor.kind} opens with the correct MIME type`);
	}

	// A correct server MIME type is preserved untouched.
	const xlsx = new Blob(['bytes'], { type: XLSX_MIME });
	assert.equal(withExportMimeType(xlsx, 'class-program-SY2031-2032-term1.xlsx').type, XLSX_MIME);

	// MIME resolution is extension-driven and falls back conservatively.
	assert.equal(mimeTypeForFilename('teacher-program-7-SY2031-2032-term1.docx'), DOCX_MIME);
	assert.equal(mimeTypeForFilename('mystery'), 'application/octet-stream');
	assert.equal(extensionOf('/x/class-program.xlsx?termIndex=1'), 'xlsx');
});

test('the real request resolvers still produce the school-year-bearing fallback', () => {
	const summary = resolveSimpleExportRequest('summary-teacher-schedule', {
		schoolId: 1, schoolYearId: 9, runId: 314, termFilter: 1, yearLabel: '2031-2032',
	});
	assert.equal(summary?.filename, 'summary-teacher-schedule-SY2031-2032-term1.xlsx');
});
