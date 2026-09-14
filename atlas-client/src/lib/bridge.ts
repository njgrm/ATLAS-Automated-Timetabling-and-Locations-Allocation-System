import { ATLAS_BRIDGE_TOKEN_KEY, setBridgeToken } from './auth';
import { resolveEnrollProBackHref } from './companion-config';

export function captureBridgeToken(): string | null {
	const url = new URL(window.location.href);
	const urlToken = url.searchParams.get('bridgeToken');
	if (urlToken) {
		setBridgeToken(urlToken);
		// Clean URL without reload
		url.searchParams.delete('bridgeToken');
		url.searchParams.delete('from');
		window.history.replaceState({}, '', url.pathname);
		return urlToken;
	}
	return sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
}

/**
 * The reciprocal "Back to EnrollPro" dashboard link, or `null` when the
 * companion origin is not configured. Consumers must render no anchor for
 * `null` (fail closed) — never a raw-IP or stale fallback.
 */
export function getBackHref(): string | null {
	return resolveEnrollProBackHref();
}
