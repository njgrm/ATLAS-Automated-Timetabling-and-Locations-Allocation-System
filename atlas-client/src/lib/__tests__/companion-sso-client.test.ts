/**
 * COMPANION-SSO-C01 — client behavior proof.
 *
 * Rendered-output assertions for the Integrated Systems area plus the pure
 * decision logic that the `/auth/sso/callback`, `/auth/enrollpro/authorize`,
 * and Login `returnUrl` surfaces consume. No source-string assertions: the
 * Integrated Systems rows are asserted against the real rendered HTML.
 *
 * Run: `npx tsx --test src/lib/__tests__/companion-sso-client.test.ts`
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import { IntegratedSystems } from '@/components/app-shell/IntegratedSystems';
import { TooltipProvider } from '@/ui/tooltip';
import {
	buildIntegratedSystems,
	canUseEnrollProReverseSso,
	resolveEnrollProReverseStartUrl,
} from '@/lib/integrated-systems';
import {
	applyCompanionSsoOutcome,
	buildAuthorizeRequestBody,
	buildEnrollProAuthorizeLoginUrl,
	readFragmentValue,
	resolveCompanionSsoCallback,
	resolveSafeReturnUrl,
} from '@/lib/companion-sso-client';

const ENROLLPRO_START = 'https://ep.example/api/auth/companion-sso/atlas/reverse/start';

function renderIntegratedSystems(privilegedStaff: boolean, enrollProStartUrl = ENROLLPRO_START): string {
	return renderToStaticMarkup(
		createElement(
			TooltipProvider,
			null,
			createElement(IntegratedSystems, { privilegedStaff, enrollProStartUrl }),
		),
	);
}

/** Absolute URLs in the markup, excluding SVG/XML namespace declarations. */
function allHttpUrls(html: string): string[] {
	return (html.match(/https?:\/\/[^"'\s<]+/g) ?? []).filter((url) => !url.startsWith('http://www.w3.org/'));
}

/* ─── §4.5 / §5.12 Integrated Systems rendered output ──────────────────────── */

test('Integrated Systems renders AIMS, SMART, ATLAS, MRF in order with ATLAS as the non-clickable current system', () => {
	const html = renderIntegratedSystems(true);
	const aims = html.indexOf('AIMS');
	const smart = html.indexOf('SMART');
	const atlas = html.indexOf('ATLAS');
	const mrf = html.indexOf('MRF');
	assert.ok(aims >= 0 && smart > aims && atlas > smart && mrf > atlas, `unexpected order in ${html}`);

	const atlasTag = html.match(/<div[^>]*data-testid="integrated-system-atlas"[^>]*>/)?.[0] ?? '';
	assert.match(atlasTag, /aria-current="true"/);
	assert.match(html, /Current system/);
	// ATLAS must not be a link.
	assert.doesNotMatch(atlasTag, /href=/);
});

test('Integrated Systems disables AIMS/SMART/MRF with plain text and emits no raw companion URL', () => {
	const html = renderIntegratedSystems(true);
	for (const system of ['aims', 'smart', 'mrf']) {
		const match = html.match(new RegExp(`<div[^>]*data-testid="integrated-system-${system}"[^>]*>`));
		assert.ok(match, `${system} row must render`);
		assert.match(match![0], /aria-disabled="true"/);
	}
	// The ONLY absolute URL in the whole rendered area is the EnrollPro start URL.
	assert.deepEqual(allHttpUrls(html), [ENROLLPRO_START]);
	assert.doesNotMatch(html, /dashboard/i);
});

test('Integrated Systems enables EnrollPro only for privileged staff and uses the injected reverse/start URL', () => {
	const privileged = renderIntegratedSystems(true);
	assert.match(privileged, /data-testid="integrated-system-enrollpro"/);
	assert.match(privileged, new RegExp(`href="${ENROLLPRO_START}"`));

	const staffless = renderIntegratedSystems(false);
	assert.doesNotMatch(staffless, /integrated-system-enrollpro/);
	assert.deepEqual(allHttpUrls(staffless), []);
});

test('canUseEnrollProReverseSso gates the companion link to privileged staff roles', () => {
	for (const role of ['admin', 'officer', 'SYSTEM_ADMIN']) {
		assert.equal(canUseEnrollProReverseSso(role), true, `${role} must be privileged`);
	}
	for (const role of ['faculty', 'TEACHER', 'LEARNER', null, undefined]) {
		assert.equal(canUseEnrollProReverseSso(role), false, `${String(role)} must not be privileged`);
	}
	assert.deepEqual(buildIntegratedSystems(true).map((item) => item.key), ['AIMS', 'SMART', 'ATLAS', 'MRF']);
});

test('EnrollPro reverse start URL honors VITE_ENROLLPRO_SSO_START_URL then derives from VITE_ENROLLPRO_URL', () => {
	assert.equal(
		resolveEnrollProReverseStartUrl({ VITE_ENROLLPRO_SSO_START_URL: 'https://explicit.example/start' }),
		'https://explicit.example/start',
	);
	assert.equal(
		resolveEnrollProReverseStartUrl({ VITE_ENROLLPRO_URL: 'https://enrollpro.example/' }),
		'https://enrollpro.example/api/auth/companion-sso/atlas/reverse/start',
	);
	assert.equal(
		resolveEnrollProReverseStartUrl({}),
		'http://100.88.55.125:5173/api/auth/companion-sso/atlas/reverse/start',
	);
});

/* ─── §5.12 /auth/sso/callback fragment consumption ────────────────────────── */

test('readFragmentValue reads only the fragment and ignores an absent or query-only value', () => {
	assert.equal(readFragmentValue('#atlasToken=abc.def.ghi', 'atlasToken'), 'abc.def.ghi');
	assert.equal(readFragmentValue('#atlasToken=a%2Fb', 'atlasToken'), 'a/b');
	assert.equal(readFragmentValue('', 'atlasToken'), null);
	assert.equal(readFragmentValue('#other=1', 'atlasToken'), null);
});

test('resolveCompanionSsoCallback consumes the fragment token and never the query string', () => {
	assert.deepEqual(resolveCompanionSsoCallback('#atlasToken=eyJhbGciOi', ''), { kind: 'token', token: 'eyJhbGciOi' });
	// A token placed in the QUERY string must be ignored (never read from a URL
	// that reaches the server).
	assert.equal(resolveCompanionSsoCallback('', '?atlasToken=leaked').kind, 'error');
});

test('resolveCompanionSsoCallback returns a plain recoverable error for an ssoError or missing token', () => {
	const invalidCode = resolveCompanionSsoCallback('', '?ssoError=COMPANION_SSO_CODE_INVALID');
	assert.equal(invalidCode.kind, 'error');
	assert.match(invalidCode.kind === 'error' ? invalidCode.message : '', /expired or was already used/);
	// The raw error code must never be surfaced verbatim to the user.
	assert.doesNotMatch(invalidCode.kind === 'error' ? invalidCode.message : '', /COMPANION_SSO_CODE_INVALID/);

	const missing = resolveCompanionSsoCallback('', '');
	assert.equal(missing.kind, 'error');
	assert.match(missing.kind === 'error' ? missing.message : '', /No sign-in token/);
});

/* ─── §5.12 /auth/enrollpro/authorize resume + request ─────────────────────── */

test('buildEnrollProAuthorizeLoginUrl preserves the full authorize request as returnUrl without nesting login', () => {
	const authorizeUrl = '/auth/enrollpro/authorize?response_type=code&client_id=enrollpro&redirect_uri=R&state=S';
	const loginUrl = buildEnrollProAuthorizeLoginUrl(authorizeUrl);
	assert.ok(loginUrl.startsWith('/login?returnUrl='), loginUrl);
	const decoded = decodeURIComponent(loginUrl.slice('/login?returnUrl='.length));
	assert.equal(decoded, authorizeUrl);
	// Repeated rendering must not create /login?returnUrl=/login?returnUrl=...
	assert.doesNotMatch(decoded, /^\/login\?/);
});

test('buildAuthorizeRequestBody carries the four authorize parameters verbatim', () => {
	assert.deepEqual(
		buildAuthorizeRequestBody('?response_type=code&client_id=enrollpro&redirect_uri=R&state=S'),
		{ response_type: 'code', client_id: 'enrollpro', redirect_uri: 'R', state: 'S' },
	);
	assert.deepEqual(
		buildAuthorizeRequestBody(''),
		{ response_type: null, client_id: null, redirect_uri: null, state: null },
	);
});

/* ─── §3.3 Login returnUrl safety ──────────────────────────────────────────── */

test('resolveSafeReturnUrl accepts same-origin relative paths', () => {
	assert.equal(resolveSafeReturnUrl('/'), '/');
	assert.equal(resolveSafeReturnUrl('/teaching-load'), '/teaching-load');
	assert.equal(
		resolveSafeReturnUrl('/auth/enrollpro/authorize?response_type=code&client_id=enrollpro'),
		'/auth/enrollpro/authorize?response_type=code&client_id=enrollpro',
	);
});

test('resolveSafeReturnUrl rejects protocol-relative, absolute, scheme, backslash, and empty values', () => {
	for (const unsafe of [
		'//evil.example/path',
		'https://evil.example',
		'http://evil.example',
		'javascript:alert(1)',
		'\\evil.example',
		'relative/path',
		'',
		null,
		undefined,
	]) {
		assert.equal(resolveSafeReturnUrl(unsafe), null, `${String(unsafe)} must be rejected`);
	}
});

/* ─── §5.12 strip-before-navigation executable ordering (correction F2) ────── */

test('applyCompanionSsoOutcome executes STRIP then SET TOKEN then NAVIGATE for a token outcome', () => {
	const calls: string[] = [];
	applyCompanionSsoOutcome(
		{ kind: 'token', token: 'jwt.token.value' },
		{
			strip: () => calls.push('strip'),
			setToken: (token, remember) => calls.push(`setToken:${token}:${remember}`),
			navigate: (to, options) => calls.push(`navigate:${to}:${options.replace}`),
			onError: (message) => calls.push(`onError:${message}`),
		},
		() => {
			calls.push('resolveRole');
			return 'faculty';
		},
	);
	assert.deepEqual(calls, ['strip', 'setToken:jwt.token.value:false', 'resolveRole', 'navigate:/my:true']);
});

test('applyCompanionSsoOutcome strips first and never sets a token or navigates on an error outcome', () => {
	const calls: string[] = [];
	applyCompanionSsoOutcome(
		{ kind: 'error', message: 'This sign-in link expired or was already used. Start again from EnrollPro.' },
		{
			strip: () => calls.push('strip'),
			setToken: (token) => calls.push(`setToken:${token}`),
			navigate: (to) => calls.push(`navigate:${to}`),
			onError: (message) => calls.push(`onError:${message}`),
		},
	);
	assert.equal(calls[0], 'strip', 'the URL must be stripped before anything else');
	assert.deepEqual(calls, ['strip', 'onError:This sign-in link expired or was already used. Start again from EnrollPro.']);
	assert.ok(!calls.some((call) => call.startsWith('setToken')), 'no token may be set on an error outcome');
	assert.ok(!calls.some((call) => call.startsWith('navigate')), 'no navigation may occur on an error outcome');
});
