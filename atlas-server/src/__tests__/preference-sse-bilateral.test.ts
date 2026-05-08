/**
 * preference-sse-bilateral.test.ts
 *
 * Verifies that:
 * 1. When a faculty member submits preferences, the scheduler SSE stream receives a
 *    PREFERENCE_SUBMITTED event.
 * 2. When the scheduler reviews a preference, the faculty SSE stream receives a
 *    PREFERENCE_REVIEWED event.
 */

import http from 'node:http';

import app from '../app.js';
import { prisma } from '../lib/prisma.js';

let passCount = 0;
let failCount = 0;

function section(name: string) {
	console.log(`\n═══ ${name} ═══`);
}

function assert(condition: boolean, label: string) {
	if (condition) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
	} else {
		failCount += 1;
		console.error(`  ✗ ${label}`);
	}
}

function assertEqual<T>(actual: T, expected: T, label: string) {
	if (actual === expected) {
		passCount += 1;
		console.log(`  ✓ ${label}`);
	} else {
		failCount += 1;
		console.error(`  ✗ ${label} — expected ${String(expected)}, got ${String(actual)}`);
	}
}

async function requestJson(
	baseUrl: string,
	path: string,
	options?: RequestInit,
): Promise<{ status: number; json: any }> {
	const res = await fetch(`${baseUrl}${path}`, options);
	let json: any = null;
	try {
		json = await res.json();
	} catch {
		json = null;
	}
	return { status: res.status, json };
}

async function readSseUntil(
	baseUrl: string,
	path: string,
	token: string,
	matcher: (chunk: string) => boolean,
	timeoutMs: number,
): Promise<string | null> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const res = await fetch(`${baseUrl}${path}`, {
			headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
			signal: controller.signal,
		});

		if (!res.body) return null;
		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const deadline = Date.now() + timeoutMs;

		while (Date.now() < deadline) {
			const result = await Promise.race([
				reader.read(),
				new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
					setTimeout(() => resolve({ done: true, value: undefined }), 300);
				}),
			]);
			if (result.done) continue;
			buffer += decoder.decode(result.value, { stream: true });
			if (matcher(buffer)) {
				reader.cancel().catch(() => {});
				return buffer;
			}
		}
		reader.cancel().catch(() => {});
		return null;
	} catch {
		return null;
	} finally {
		clearTimeout(timeoutId);
	}
}

async function run() {
	if (!process.env.JWT_SECRET) {
		process.env.JWT_SECRET = 'atlas-local-auth-test-secret';
	}

	const seededPassword = process.env.ATLAS_DEFAULT_AUTH_PASSWORD ?? 'Atlas2026!';

	// Resolve accounts
	const officerAccount = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'officer', isActive: true },
		orderBy: { id: 'asc' },
	});
	const facultyAccount = await prisma.atlasAuthAccount.findFirst({
		where: { role: 'faculty', isActive: true, facultyId: { not: null } },
		orderBy: { id: 'asc' },
	});

	if (!officerAccount || !facultyAccount?.facultyId) {
		console.error('\nRequired seeded accounts not found. Run realistic seed first.');
		process.exitCode = 1;
		return;
	}

	const facultyId = facultyAccount.facultyId;
	const schoolId = facultyAccount.schoolId;

	// ATLAS schoolYearId is a plain integer (no DB model); use 1 which is seeded by default.
	const syId = 1;

	// Clean up previous preference
	await prisma.facultyPreference.deleteMany({ where: { facultyId, schoolYearId: syId } });

	const server = http.createServer(app);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
	const address = server.address();
	if (!address || typeof address === 'string') {
		console.error('Unable to resolve ephemeral test server port.');
		server.close();
		process.exitCode = 1;
		return;
	}
	const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

	try {
		// Login both
		const officerLogin = await requestJson(baseUrl, '/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: officerAccount.email, password: seededPassword }),
		});
		assertEqual(officerLogin.status, 200, 'Officer login returns 200');
		const officerToken: string = officerLogin.json?.token ?? '';

		const facultyLogin = await requestJson(baseUrl, '/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: facultyAccount.email, password: seededPassword }),
		});
		assertEqual(facultyLogin.status, 200, 'Faculty login returns 200');
		const facultyToken: string = facultyLogin.json?.token ?? '';

		const facultyAuth = { 'content-type': 'application/json', Authorization: `Bearer ${facultyToken}` };
		const officerAuth = { 'content-type': 'application/json', Authorization: `Bearer ${officerToken}` };

		const sseEventsPath = `/preferences/${schoolId}/${syId}/events`;

		/* ── Section 1: Faculty submit → officer SSE ── */
		section('Faculty submit → officer receives PREFERENCE_SUBMITTED via SSE');

		// Start officer SSE listener before the submit
		const officerSsePromise = readSseUntil(
			baseUrl,
			sseEventsPath,
			officerToken,
			(text) => text.includes('PREFERENCE_SUBMITTED'),
			6000,
		);

		// Save draft first
		const draftRes = await requestJson(
			baseUrl,
			`/preferences/${schoolId}/${syId}/faculty/${facultyId}/draft`,
			{
				method: 'PUT',
				headers: facultyAuth,
				body: JSON.stringify({
					notes: 'SSE bilateral test',
					timeSlots: [],
					wellbeing: { pregnancySupport: false, physicalAilmentSupport: false, minimizeTravelTime: false, avoidUpperFloors: false },
					version: 1,
				}),
			},
		);
		assertEqual(draftRes.status, 200, 'Draft saved for SSE test');
		const draftVersion = draftRes.json?.preference?.version as number ?? 1;

		// Submit
		const submitRes = await requestJson(
			baseUrl,
			`/preferences/${schoolId}/${syId}/faculty/${facultyId}/submit`,
			{
				method: 'POST',
				headers: facultyAuth,
				body: JSON.stringify({
					notes: 'SSE bilateral test',
					timeSlots: [],
					wellbeing: { pregnancySupport: false, physicalAilmentSupport: false, minimizeTravelTime: false, avoidUpperFloors: false },
					version: draftVersion,
				}),
			},
		);
		assertEqual(submitRes.status, 200, 'Faculty submit returns 200');

		const officerSseBuffer = await officerSsePromise;
		assert(officerSseBuffer !== null, 'Officer SSE stream received PREFERENCE_SUBMITTED event');
		assert(
			officerSseBuffer?.includes('PREFERENCE_SUBMITTED') ?? false,
			'Officer SSE event type is PREFERENCE_SUBMITTED',
		);

		/* ── Section 2: Officer review → faculty SSE ── */
		section('Officer review → faculty receives PREFERENCE_REVIEWED via SSE');

		// Start faculty SSE listener before the review
		const facultySsePromise = readSseUntil(
			baseUrl,
			sseEventsPath,
			facultyToken,
			(text) => text.includes('PREFERENCE_REVIEWED'),
			6000,
		);

		// Get the submitted preference ID
		const prefDetail = await requestJson(
			baseUrl,
			`/preferences/${schoolId}/${syId}/faculty/${facultyId}/detail`,
			{ headers: { Authorization: `Bearer ${officerToken}` } },
		);
		assertEqual(prefDetail.status, 200, 'Officer can fetch preference detail');
		const prefId: number = prefDetail.json?.preference?.id;
		assert(!!prefId, 'Preference ID is returned');

		// Officer reviews
		const reviewRes = await requestJson(
			baseUrl,
			`/preferences/${schoolId}/${syId}/review/${prefId}`,
			{
				method: 'PATCH',
				headers: officerAuth,
				body: JSON.stringify({ reviewStatus: 'REVIEWED', reviewerNotes: 'Looks good' }),
			},
		);
		assertEqual(reviewRes.status, 200, 'Officer PATCH /review returns 200');

		const facultySseBuffer = await facultySsePromise;
		assert(facultySseBuffer !== null, 'Faculty SSE stream received PREFERENCE_REVIEWED event');
		assert(
			facultySseBuffer?.includes('PREFERENCE_REVIEWED') ?? false,
			'Faculty SSE event type is PREFERENCE_REVIEWED',
		);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await prisma.$disconnect();
	}

	console.log(`\n─── Results: ${passCount} passed, ${failCount} failed ───`);
	if (failCount > 0) process.exitCode = 1;
}

run().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
