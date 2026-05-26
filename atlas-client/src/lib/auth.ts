export const ATLAS_BRIDGE_TOKEN_KEY = 'atlas_bridge_token';
export const ATLAS_LOCAL_TOKEN_KEY = 'atlas_local_token';

export type AuthSource = 'bridge' | 'local';

const FACULTY_PORTAL_ROUTES = new Set([
	'/my',
	'/my/schedule',
	'/my/preferences',
	'/my/room-preferences',
]);

function readSessionStorage(key: string): string | null {
	try {
		return sessionStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeSessionStorage(key: string, value: string): void {
	try {
		sessionStorage.setItem(key, value);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function readLocalStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeLocalStorage(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function removeSessionStorage(key: string): void {
	try {
		sessionStorage.removeItem(key);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

function removeLocalStorage(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// Ignore storage write failures (private mode / restricted storage).
	}
}

export function getLocalToken(): string | null {
	const sessionToken = readSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
	if (sessionToken) return sessionToken;

	const rememberedToken = readLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	if (rememberedToken) {
		writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, rememberedToken);
		return rememberedToken;
	}

	return null;
}

export function getBridgeToken(): string | null {
	return readSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
}

export function getPreferredAccessToken(): string | null {
	return getLocalToken() ?? getBridgeToken();
}

export function setLocalToken(token: string, remember = false): void {
	writeSessionStorage(ATLAS_LOCAL_TOKEN_KEY, token);
	if (remember) {
		writeLocalStorage(ATLAS_LOCAL_TOKEN_KEY, token);
	} else {
		removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
	}
}

export function clearLocalToken(): void {
	removeSessionStorage(ATLAS_LOCAL_TOKEN_KEY);
	removeLocalStorage(ATLAS_LOCAL_TOKEN_KEY);
}

export function clearBridgeToken(): void {
	removeSessionStorage(ATLAS_BRIDGE_TOKEN_KEY);
}

export function clearUserRoleCache(): void {
	removeLocalStorage('userRole');
}

export function isFacultyPortalRoute(pathname: string): boolean {
	return FACULTY_PORTAL_ROUTES.has(pathname);
}

export function hasAnyAuthToken(): boolean {
	return Boolean(getPreferredAccessToken());
}

export function clearAtlasAuthStorage(): void {
	clearLocalToken();
	clearBridgeToken();
	clearUserRoleCache();
}
