export function captureBridgeToken(): string | null {
	const url = new URL(window.location.href);
	const urlToken = url.searchParams.get('bridgeToken');
	if (urlToken) {
		sessionStorage.setItem('atlas_bridge_token', urlToken);
		// Clean URL without reload
		url.searchParams.delete('bridgeToken');
		url.searchParams.delete('from');
		window.history.replaceState({}, '', url.pathname);
		return urlToken;
	}
	return sessionStorage.getItem('atlas_bridge_token');
}

export function getBackHref(): string {
	return (import.meta.env.VITE_ENROLLPRO_URL ?? 'http://localhost:5173') + '/dashboard';
}
