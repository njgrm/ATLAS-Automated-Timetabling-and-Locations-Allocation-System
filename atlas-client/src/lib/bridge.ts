import { ATLAS_BRIDGE_TOKEN_KEY } from './auth';

export function captureBridgeToken(): string | null {
	const url = new URL(window.location.href);
	const urlToken = url.searchParams.get('bridgeToken');
	if (urlToken) {
		sessionStorage.setItem(ATLAS_BRIDGE_TOKEN_KEY, urlToken);
		// Clean URL without reload
		url.searchParams.delete('bridgeToken');
		url.searchParams.delete('from');
		window.history.replaceState({}, '', url.pathname);
		return urlToken;
	}
	return sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
}

export function getBackHref(): string {
	return (import.meta.env.VITE_ENROLLPRO_URL ?? 'http://100.88.55.125:5173') + '/dashboard';
}
