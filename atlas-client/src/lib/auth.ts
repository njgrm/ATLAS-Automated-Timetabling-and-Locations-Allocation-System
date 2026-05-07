export const ATLAS_BRIDGE_TOKEN_KEY = 'atlas_bridge_token';
export const ATLAS_LOCAL_TOKEN_KEY = 'atlas_local_token';

export type AuthSource = 'bridge' | 'local';

export function getLocalToken(): string | null {
	return sessionStorage.getItem(ATLAS_LOCAL_TOKEN_KEY);
}

export function getBridgeToken(): string | null {
	return sessionStorage.getItem(ATLAS_BRIDGE_TOKEN_KEY);
}

export function getPreferredAccessToken(): string | null {
	return getLocalToken() ?? getBridgeToken();
}

export function hasAnyAuthToken(): boolean {
	return Boolean(getPreferredAccessToken());
}

export function clearAtlasAuthStorage(): void {
	sessionStorage.removeItem(ATLAS_LOCAL_TOKEN_KEY);
	sessionStorage.removeItem(ATLAS_BRIDGE_TOKEN_KEY);
	localStorage.removeItem('userRole');
}
