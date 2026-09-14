/**
 * COMPANION-CONFIG / ENROLLPRO-PROXY-RECOVERY-C01 — client fail-closed proof.
 *
 * Proves that every EnrollPro companion navigation derives from explicit
 * configuration only, that unresolved configuration never emits the retired
 * raw-IP URL, and that the personnel-login (logout) and reverse-SSO start
 * routes remain distinct, exact contracts. Rendered output is asserted against
 * the real components, not source text.
 *
 * Run: `npx tsx --test src/lib/__tests__/companion-config.test.ts`
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';

import { MemoryRouter } from 'react-router-dom';

import { BackToEnrollProLink } from '@/components/app-shell/BackToEnrollProLink';
import { IntegratedSystems } from '@/components/app-shell/IntegratedSystems';
import { MobileNavigationDrawer } from '@/components/app-shell/MobileNavigationDrawer';
import { AppSidebar } from '@/components/app-shell/AppSidebar';
import { SidebarProvider } from '@/ui/sidebar';
import { TooltipProvider } from '@/ui/tooltip';
import {
	resolveEnrollProBackHref,
	resolveEnrollProBase,
	resolveEnrollProLogoutRedirect,
	resolveEnrollProReverseStartUrl,
} from '@/lib/companion-config';

const BASE = 'https://dev-jegs.buru-degree.ts.net';
const RETIRED_RAW_IPS = ['100.88.55.125', '100.120.169.123'];

function render(element: ReturnType<typeof createElement>): string {
	return renderToStaticMarkup(createElement(TooltipProvider, null, element));
}

/* ─── Pure resolution ──────────────────────────────────────────────────────── */

test('resolveEnrollProBase trims and removes trailing slashes, and returns null when unset or blank', () => {
	assert.equal(resolveEnrollProBase({ VITE_ENROLLPRO_URL: `${BASE}/` }), BASE);
	assert.equal(resolveEnrollProBase({ VITE_ENROLLPRO_URL: `  ${BASE}//  ` }), BASE);
	assert.equal(resolveEnrollProBase({}), null);
	assert.equal(resolveEnrollProBase({ VITE_ENROLLPRO_URL: '   ' }), null);
});

test('reciprocal dashboard and logout routes are distinct and exact when configured', () => {
	assert.equal(resolveEnrollProBackHref({ VITE_ENROLLPRO_URL: BASE }), `${BASE}/dashboard`);
	assert.equal(resolveEnrollProLogoutRedirect({ VITE_ENROLLPRO_URL: BASE }), `${BASE}/personnel/login`);
	assert.equal(resolveEnrollProReverseStartUrl({ VITE_ENROLLPRO_URL: BASE }), `${BASE}/api/auth/companion-sso/atlas/reverse/start`);
	assert.notEqual(resolveEnrollProLogoutRedirect({ VITE_ENROLLPRO_URL: BASE }), resolveEnrollProReverseStartUrl({ VITE_ENROLLPRO_URL: BASE }));
	// An explicit SSO start URL wins over the derived one.
	assert.equal(
		resolveEnrollProReverseStartUrl({ VITE_ENROLLPRO_URL: BASE, VITE_ENROLLPRO_SSO_START_URL: 'https://explicit.example/start' }),
		'https://explicit.example/start',
	);
});

test('every resolver fails closed to null when the companion origin is not configured', () => {
	assert.equal(resolveEnrollProBackHref({}), null);
	assert.equal(resolveEnrollProLogoutRedirect({}), null);
	assert.equal(resolveEnrollProReverseStartUrl({}), null);
});

/* ─── Rendered fail-closed decisions ───────────────────────────────────────── */

test('BackToEnrollProLink renders no anchor when unresolved and the exact href when configured', () => {
	const unresolved = renderToStaticMarkup(createElement(BackToEnrollProLink, { href: null }));
	assert.equal(unresolved, '');
	for (const ip of RETIRED_RAW_IPS) assert.doesNotMatch(unresolved, new RegExp(ip.replaceAll('.', '\\.')));

	const resolved = renderToStaticMarkup(createElement(BackToEnrollProLink, { href: `${BASE}/dashboard` }));
	assert.match(resolved, /data-testid="back-to-enrollpro"/);
	assert.match(resolved, new RegExp(`href="${BASE}/dashboard"`));
	for (const ip of RETIRED_RAW_IPS) assert.doesNotMatch(resolved, new RegExp(ip.replaceAll('.', '\\.')));
});

test('BackToEnrollProLink defaults to the fail-closed client resolution (no VITE origin in tests)', () => {
	const html = renderToStaticMarkup(createElement(BackToEnrollProLink, {}));
	assert.equal(html, '');
});

test('IntegratedSystems renders EnrollPro as a disabled plain-text row when the start URL is unresolved', () => {
	const html = render(createElement(IntegratedSystems, { privilegedStaff: true, enrollProStartUrl: null }));
	const row = html.match(/<div[^>]*data-testid="integrated-system-enrollpro"[^>]*>/)?.[0] ?? '';
	assert.ok(row, 'the EnrollPro row must render');
	assert.match(row, /aria-disabled="true"/);
	assert.doesNotMatch(row, /href=/);
	assert.doesNotMatch(html, /href=/);
	for (const ip of RETIRED_RAW_IPS) assert.doesNotMatch(html, new RegExp(ip.replaceAll('.', '\\.')));
});

test('the mounted mobile drawer renders no back-to-EnrollPro anchor when the origin is unresolved', () => {
	const html = renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(
				TooltipProvider,
				null,
				createElement(MobileNavigationDrawer, {
					open: true,
					onClose: () => {},
					items: [],
					currentPathname: '/',
					onLogout: () => {},
					privilegedStaff: false,
				}),
			),
		),
	);
	assert.doesNotMatch(html, /back-to-enrollpro/);
	for (const ip of RETIRED_RAW_IPS) assert.doesNotMatch(html, new RegExp(ip.replaceAll('.', '\\.')));
});

test('the mounted desktop sidebar renders no back-to-EnrollPro anchor when the origin is unresolved', () => {
	const html = renderToStaticMarkup(
		createElement(
			MemoryRouter,
			null,
			createElement(
				TooltipProvider,
				null,
				createElement(
					SidebarProvider,
					null,
					createElement(AppSidebar, {
						schoolName: 'ATLAS High School',
						logoUrl: null,
						activeYearLabel: null,
						bridgeUser: null,
						pathname: '/',
						onLogout: () => {},
					}),
				),
			),
		),
	);
	assert.doesNotMatch(html, /back-to-enrollpro/);
	// The only anchor the unresolved sidebar may emit is the internal "Back to EnrollPro"
	// case is absent; assert no retired raw IP leaked into the markup.
	for (const ip of RETIRED_RAW_IPS) assert.doesNotMatch(html, new RegExp(ip.replaceAll('.', '\\.')));
});

test('IntegratedSystems emits the exact configured reverse start URL as the only companion href', () => {
	const start = `${BASE}/api/auth/companion-sso/atlas/reverse/start`;
	const html = render(createElement(IntegratedSystems, { privilegedStaff: true, enrollProStartUrl: start }));
	assert.match(html, new RegExp(`href="${start}"`));
	assert.equal((html.match(/href="/g) ?? []).length, 1);
	assert.doesNotMatch(html, /\/personnel\/login/);
});
